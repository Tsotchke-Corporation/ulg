import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmMechanicsRefreshWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import { MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT } from '../material/materialPropertyBank.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  findMechanicsMaterialPhaseRecord,
  ULG_MLS_MPM_MECHANICS_MATERIAL_BANK_WARM_INPUT_CONSUMER_SCHEMA,
  MLS_MPM_MECHANICS_MATERIAL_PHASE_FLOATS,
  ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA
} from './sphMechanicsMaterialTable.js';

export const ULG_MLS_MPM_MECHANICS_REFRESH_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-refresh.v0';
export const ULG_MLS_MPM_MECHANICS_MATERIAL_PHASE_UPLOAD_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-material-phase-upload.v0';

const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const PHASE_CHANGE_REST_VOLUME_RATIO_RESET_THRESHOLD = 2;

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function resetMechanicsDeformation(mechanics, mechanicsOffset) {
  mechanics[mechanicsOffset] = 1;
  mechanics[mechanicsOffset + 1] = 0;
  mechanics[mechanicsOffset + 2] = 0;
  mechanics[mechanicsOffset + 3] = 0;
  mechanics[mechanicsOffset + 4] = 1;
  mechanics[mechanicsOffset + 5] = 0;
  mechanics[mechanicsOffset + 6] = 0;
  mechanics[mechanicsOffset + 7] = 0;
  mechanics[mechanicsOffset + 8] = 1;
  for (let index = 9; index <= 17; index += 1) mechanics[mechanicsOffset + index] = 0;
  mechanics[mechanicsOffset + 18] = 1;
}

function shouldResetMechanicsForPhaseChange(mechanics, mechanicsOffset, phaseMechanics, nextRestVolumeM3) {
  const previousRestVolumeM3 = finiteNumber(mechanics[mechanicsOffset + 19], 0);
  const previousSolid = finiteNumber(mechanics[mechanicsOffset + 20], 0) > 0.5;
  const nextSolid = finiteNumber(phaseMechanics.solidFlag, 0) > 0.5;
  const previousEosModelId = Math.round(finiteNumber(mechanics[mechanicsOffset + 26], 0));
  const nextEosModelId = Math.round(finiteNumber(phaseMechanics.eosModelId, 0));
  const mechanicsModelChanged = previousSolid !== nextSolid || previousEosModelId !== nextEosModelId;
  if (!mechanicsModelChanged || !(previousRestVolumeM3 > 0) || !(nextRestVolumeM3 > 0)) return false;
  const ratio = Math.max(
    previousRestVolumeM3 / nextRestVolumeM3,
    nextRestVolumeM3 / previousRestVolumeM3
  );
  return ratio >= PHASE_CHANGE_REST_VOLUME_RATIO_RESET_THRESHOLD;
}

function assertRefreshInputs({ sphParticleState, mlsMpmParticleState, mechanicsMaterialTable }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM mechanics refresh requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM mechanics refresh requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle counts must match for mechanics refresh');
  }
  if (mechanicsMaterialTable?.schema !== ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA) {
    throw new TypeError('MLS-MPM mechanics refresh requires a mechanics material table');
  }
}

function writeStorageBuffer(device, label, data, extraUsage = 0) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | extraUsage
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function resolveMechanicsMaterialBankWarmInputShaderBinding(device, {
  sphParticleState = null,
  mlsMpmParticleState = null,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null
} = {}) {
  const uploadCandidates = [
    {
      buffer: sphParticleUpload?.materialPropertyBankWarmInputBuffer || null,
      rowCount: sphParticleUpload?.materialPropertyBankWarmInputRowCount,
      source: 'sph-particle-upload'
    },
    {
      buffer: mlsMpmParticleUpload?.materialPropertyBankWarmInputBuffer || null,
      rowCount: mlsMpmParticleUpload?.materialPropertyBankWarmInputRowCount,
      source: 'mls-mpm-particle-upload'
    }
  ];
  for (const candidate of uploadCandidates) {
    const rowCount = Math.max(0, Math.round(finiteNumber(candidate.rowCount, 0)));
    if (candidate.buffer && rowCount > 0) {
      return {
        buffer: candidate.buffer,
        rowCount,
        bufferSource: candidate.source,
        borrowed: true,
        destroy() {}
      };
    }
  }
  const packedCandidates = [
    {
      table: sphParticleState?.materialPropertyBankWarmInputTable,
      source: 'sph-particle-state'
    },
    {
      table: mlsMpmParticleState?.materialPropertyBankWarmInputTable,
      source: 'mls-mpm-particle-state'
    }
  ];
  for (const candidate of packedCandidates) {
    const packedRows = candidate.table?.rows;
    const packedRowCount = Math.max(0, Math.round(finiteNumber(candidate.table?.rowCount, 0)));
    if (packedRows?.byteLength > 0 && packedRowCount > 0) {
      const buffer = writeStorageBuffer(
        device,
        'ulg-mls-mpm-mechanics-material-bank-warm-input-rows',
        packedRows
      );
      return {
        buffer,
        rowCount: packedRowCount,
        bufferSource: candidate.source,
        borrowed: false,
        destroy() {
          buffer.destroy?.();
        }
      };
    }
  }
  const emptyBuffer = writeStorageBuffer(
    device,
    'ulg-mls-mpm-mechanics-material-bank-warm-input-rows-empty',
    new Float32Array(MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT.length)
  );
  return {
    buffer: emptyBuffer,
    rowCount: 0,
    bufferSource: 'empty',
    borrowed: false,
    destroy() {
      emptyBuffer.destroy?.();
    }
  };
}

function createOutputStorageBuffer(device, label, byteLength, extraUsage = 0) {
  return device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | extraUsage
  });
}

export function uploadMlsMpmMechanicsMaterialPhaseRecords(device, mechanicsMaterialTable) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('uploadMlsMpmMechanicsMaterialPhaseRecords requires a WebGPU-like device');
  }
  if (mechanicsMaterialTable?.schema !== ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA) {
    throw new TypeError('MLS-MPM mechanics material phase upload requires a mechanics material table');
  }
  const recordsBuffer = writeStorageBuffer(
    device,
    'ulg-mls-mpm-mechanics-material-phase-records',
    mechanicsMaterialTable.records
  );
  let destroyed = false;
  return {
    schema: ULG_MLS_MPM_MECHANICS_MATERIAL_PHASE_UPLOAD_SCHEMA,
    status: 'webgpu-uploaded',
    sourceMaterialTableSchema: mechanicsMaterialTable.schema,
    phaseRecordCount: mechanicsMaterialTable.phaseRecordCount,
    recordsByteLength: mechanicsMaterialTable.records.byteLength,
    recordsBuffer,
    materialPhaseBuffer: recordsBuffer,
    destroyMechanicsMaterialPhaseUpload() {
      if (destroyed) return;
      destroyed = true;
      recordsBuffer.destroy?.();
      this.destroyed = true;
    },
    destroyed: false,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

export function destroyMlsMpmMechanicsMaterialPhaseUpload(upload) {
  if (!upload) return;
  if (typeof upload.destroyMechanicsMaterialPhaseUpload === 'function') {
    upload.destroyMechanicsMaterialPhaseUpload();
    return;
  }
  upload.recordsBuffer?.destroy?.();
  upload.materialPhaseBuffer?.destroy?.();
  upload.destroyed = true;
}

function uploadedMechanicsMaterialPhaseRecordsMatch(upload, mechanicsMaterialTable) {
  return Boolean(
    upload?.status === 'webgpu-uploaded'
    && upload.destroyed !== true
    && (upload.recordsBuffer || upload.materialPhaseBuffer)
    && upload.sourceMaterialTableSchema === mechanicsMaterialTable?.schema
    && upload.phaseRecordCount === mechanicsMaterialTable?.phaseRecordCount
    && upload.recordsByteLength === mechanicsMaterialTable?.records?.byteLength
  );
}

function createParamsArray({ particleCount, phaseRecordCount, materialBankWarmInputRowCount = 0 }) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, phaseRecordCount, true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(materialBankWarmInputRowCount, 0))), true);
  view.setUint32(12, 0, true);
  return buffer;
}

function materialBankWarmInputConsumerForOutput(mechanicsMaterialTable, {
  shaderBound = false,
  shaderBinding = null,
  shaderRowCount = 0,
  bufferSource = null
} = {}) {
  const consumer = mechanicsMaterialTable?.materialPropertyBankWarmInputConsumer ?? {
    schema: ULG_MLS_MPM_MECHANICS_MATERIAL_BANK_WARM_INPUT_CONSUMER_SCHEMA,
    status: 'no-material-bank-warm-input-table',
    sourceSchema: null,
    sourceRowCount: 0,
    matchedMaterialCount: 0,
    consumer: 'mls-mpm-mechanics-material-table',
    consumedAs: 'non-authoritative-warm-input-metadata-before-closure-derived-mechanics-eos-tables',
    strictSourceOfTruth: false,
    shaderBound: false,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
  const boundRowCount = Math.max(0, Math.round(finiteNumber(shaderRowCount, 0)));
  const bound = shaderBound === true && boundRowCount > 0;
  return {
    ...consumer,
    status: bound
      ? 'mechanics-material-bank-warm-inputs-bound-in-shader'
      : consumer.status,
    consumedAs: bound
      ? 'non-authoritative-shader-bound-warm-input-metadata-before-closure-derived-mechanics-eos-tables'
      : consumer.consumedAs,
    shaderBound: bound,
    shaderBinding: bound ? shaderBinding : null,
    shaderRowCount: bound ? boundRowCount : 0,
    bufferSource: bound ? bufferSource : null
  };
}

async function readBuffer(device, sourceBuffer, byteLength) {
  const readback = device.createBuffer({
    label: 'ulg-mls-mpm-mechanics-refresh-readback',
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(sourceBuffer, 0, readback, 0, byteLength);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPU_MAP_MODE.READ);
  const copy = readback.getMappedRange().slice(0);
  readback.unmap();
  readback.destroy?.();
  return copy;
}

function outputEnvelope({
  backend,
  sphParticleState,
  mlsMpmParticleState,
  mechanicsMaterialTable,
  mechanics,
  mechanicsBuffer = null,
  mechanicsBufferByteLength = 0,
  mechanicsMaterialPhaseUpload = null,
  mechanicsMaterialPhaseUploadReused = false,
  retainedOutputParticleBuffers = false,
  readbackMode = FULL_READBACK_MODE,
  outputBufferInitializationMode = null,
  destroyOutputParticleBuffers = null,
  mechanicsMaterialBankWarmInputShaderBinding = null
}) {
  const mechanicsMaterialBankWarmInputConsumer = materialBankWarmInputConsumerForOutput(
    mechanicsMaterialTable,
    mechanicsMaterialBankWarmInputShaderBinding || {}
  );
  return {
    schema: ULG_MLS_MPM_MECHANICS_REFRESH_SCHEMA,
    backend,
    status: 'mechanics-constitutive-refresh-executed',
    particleCount: sphParticleState.particleCount,
    mechanicsMaterialTableSchema: mechanicsMaterialTable.schema,
    phaseRecordCount: mechanicsMaterialTable.phaseRecordCount,
    sourceSchema: mlsMpmParticleState.schema,
    targetSchema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    mechanics,
    mechanicsBuffer,
    mechanicsBufferByteLength,
    mechanicsMaterialPhaseUploadStatus: mechanicsMaterialPhaseUpload?.status ?? null,
    mechanicsMaterialPhaseUploadReused: Boolean(mechanicsMaterialPhaseUploadReused),
    mechanicsMaterialPhaseRecordsByteLength: mechanicsMaterialPhaseUpload?.recordsByteLength
      ?? mechanicsMaterialTable.records.byteLength,
    mechanicsMaterialBankWarmInputConsumer,
    mechanicsMaterialBankWarmInputRowCount:
      mechanicsMaterialBankWarmInputConsumer.sourceRowCount
        ?? mechanicsMaterialTable.materialPropertyBankWarmInputRowCount
        ?? 0,
    mechanicsMaterialBankWarmInputMatchedMaterialCount:
      mechanicsMaterialBankWarmInputConsumer.matchedMaterialCount
        ?? mechanicsMaterialTable.materialPropertyBankWarmInputMatchedMaterialCount
        ?? 0,
    retainedOutputParticleBuffers,
    readbackMode,
    outputBufferInitializationMode,
    normalHotLoopReadbackFree: readbackMode === NO_FULL_READBACK_MODE,
    destroyOutputParticleBuffers,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

export function refreshMlsMpmMechanicsCpu({
  sphParticleState,
  mlsMpmParticleState,
  mechanicsMaterialTable,
  sourceState = sphParticleState?.state,
  sourceThermo = sphParticleState?.thermo,
  sourceMechanics = mlsMpmParticleState?.mechanics
} = {}) {
  assertRefreshInputs({ sphParticleState, mlsMpmParticleState, mechanicsMaterialTable });
  const state = sourceState || sphParticleState.state;
  const thermo = sourceThermo || sphParticleState.thermo;
  const source = sourceMechanics || mlsMpmParticleState.mechanics;
  const mechanics = new Float32Array(source);
  for (let index = 0; index < sphParticleState.particleCount; index += 1) {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const mechanicsOffset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const materialId = thermo[thermoOffset];
    const phaseId = thermo[thermoOffset + 1];
    const phaseMechanics = findMechanicsMaterialPhaseRecord(mechanicsMaterialTable, materialId, phaseId);
    if (phaseMechanics.status !== 1) continue;
    const restDensity = finiteNumber(thermo[thermoOffset + 3], 0) > 0
      ? finiteNumber(thermo[thermoOffset + 3], 0)
      : phaseMechanics.restDensityKgPerM3;
    const restVolumeM3 = restDensity > 0
      ? Math.max(finiteNumber(state[stateOffset + 3], 0), 0) / restDensity
      : 0;
    if (shouldResetMechanicsForPhaseChange(mechanics, mechanicsOffset, phaseMechanics, restVolumeM3)) {
      resetMechanicsDeformation(mechanics, mechanicsOffset);
    }
    mechanics[mechanicsOffset + 19] = restDensity > 0
      ? restVolumeM3
      : 0;
    mechanics[mechanicsOffset + 20] = phaseMechanics.solidFlag;
    mechanics[mechanicsOffset + 21] = phaseMechanics.status;
    mechanics[mechanicsOffset + 22] = phaseMechanics.effectiveBulkModulusPa;
    mechanics[mechanicsOffset + 23] = phaseMechanics.shearModulusPa;
    mechanics[mechanicsOffset + 24] = phaseMechanics.lameLambdaPa;
    mechanics[mechanicsOffset + 25] = phaseMechanics.soundSpeedMPerS;
    mechanics[mechanicsOffset + 26] = phaseMechanics.eosModelId;
    mechanics[mechanicsOffset + 27] = phaseMechanics.status;
    mechanics[mechanicsOffset + 29] = phaseMechanics.dynamicViscosityPaS;
    mechanics[mechanicsOffset + 30] = phaseMechanics.surfaceTensionNPerM;
  }
  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    mlsMpmParticleState,
    mechanicsMaterialTable,
    mechanics,
    mechanicsBufferByteLength: mechanics.byteLength,
    retainedOutputParticleBuffers: false,
    readbackMode: FULL_READBACK_MODE
  });
}

export function createMlsMpmMechanicsRefreshWebGpuEncoderStage({
  device,
  sphParticleState,
  mlsMpmParticleState,
  mechanicsMaterialTable,
  mechanicsMaterialPhaseUpload = null,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  sourceStateBuffer = null,
  sourceThermoBuffer = null,
  sourceMechanicsBuffer = null,
  retainOutputParticleBuffers = false,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  assertRefreshInputs({ sphParticleState, mlsMpmParticleState, mechanicsMaterialTable });
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmMechanicsRefreshWebGpu requires a WebGPU-like device');
  }
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const borrowedStateBuffer = sourceStateBuffer || sphParticleUpload?.stateBuffer || null;
  const borrowedThermoBuffer = sourceThermoBuffer || sphParticleUpload?.thermoBuffer || null;
  const borrowedMechanicsBuffer = sourceMechanicsBuffer || mlsMpmParticleUpload?.mechanicsBuffer || null;
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-mechanics-refresh-source-state', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-mechanics-refresh-source-thermo', sphParticleState.thermo);
  const mechanicsBuffer = borrowedMechanicsBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-mechanics-refresh-source-mechanics', mlsMpmParticleState.mechanics);
  const borrowedMaterialPhaseUpload = uploadedMechanicsMaterialPhaseRecordsMatch(
    mechanicsMaterialPhaseUpload,
    mechanicsMaterialTable
  )
    ? mechanicsMaterialPhaseUpload
    : null;
  const localMaterialPhaseUpload = borrowedMaterialPhaseUpload
    ? null
    : uploadMlsMpmMechanicsMaterialPhaseRecords(device, mechanicsMaterialTable);
  const materialPhaseUpload = borrowedMaterialPhaseUpload || localMaterialPhaseUpload;
  const materialPhaseBuffer = materialPhaseUpload.recordsBuffer || materialPhaseUpload.materialPhaseBuffer;
  const materialBankWarmInputBinding = resolveMechanicsMaterialBankWarmInputShaderBinding(device, {
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload
  });
  const outputBufferInitializationMode = 'shader-copies-source-mechanics-rows';
  const outMechanicsBuffer = createOutputStorageBuffer(
    device,
    'ulg-mls-mpm-mechanics-refresh-output-mechanics',
    mlsMpmParticleState.mechanics.byteLength,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const paramsBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-mechanics-refresh-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
    particleCount: sphParticleState.particleCount,
    phaseRecordCount: mechanicsMaterialTable.phaseRecordCount,
    materialBankWarmInputRowCount: materialBankWarmInputBinding.rowCount
  }));
  const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-mls-mpm-mechanics-refresh.v4',
    label: 'ulg-mls-mpm-mechanics-refresh',
    code: mlsMpmMechanicsRefreshWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'uniform'),
      computeBufferBinding(6, 'read-only-storage')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: thermoBuffer } },
      { binding: 2, resource: { buffer: mechanicsBuffer } },
      { binding: 3, resource: { buffer: materialPhaseBuffer } },
      { binding: 4, resource: { buffer: outMechanicsBuffer } },
      { binding: 5, resource: { buffer: paramsBuffer } },
      { binding: 6, resource: { buffer: materialBankWarmInputBinding.buffer } }
    ]
  });
  const mechanics = new Float32Array();
  const cleanup = () => {
    if (!borrowedStateBuffer) stateBuffer.destroy?.();
    if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
    if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
    if (localMaterialPhaseUpload) destroyMlsMpmMechanicsMaterialPhaseUpload(localMaterialPhaseUpload);
    materialBankWarmInputBinding.destroy?.();
    paramsBuffer.destroy?.();
    if (!retainOutputParticleBuffers) outMechanicsBuffer.destroy?.();
  };
  const result = outputEnvelope({
    backend: 'webgpu',
    sphParticleState,
    mlsMpmParticleState,
    mechanicsMaterialTable,
    mechanics,
    mechanicsBuffer: outMechanicsBuffer,
    mechanicsBufferByteLength: mlsMpmParticleState.mechanics.byteLength,
    mechanicsMaterialPhaseUpload: materialPhaseUpload,
    mechanicsMaterialPhaseUploadReused: Boolean(borrowedMaterialPhaseUpload),
    retainedOutputParticleBuffers: retainOutputParticleBuffers,
    readbackMode,
    outputBufferInitializationMode,
    mechanicsMaterialBankWarmInputShaderBinding: {
      shaderBound: materialBankWarmInputBinding.rowCount > 0,
      shaderBinding: 6,
      shaderRowCount: materialBankWarmInputBinding.rowCount,
      bufferSource: materialBankWarmInputBinding.bufferSource
    },
    destroyOutputParticleBuffers() {
      outMechanicsBuffer.destroy?.();
    }
  });
  return {
    schema: 'peercompute.ulg.mls-mpm-mechanics-refresh-encoder-stage.v0',
    status: 'mechanics-refresh-encoder-stage-ready',
    backend: 'webgpu',
    readbackMode,
    result,
    mechanicsBuffer: outMechanicsBuffer,
    mechanicsBufferByteLength: mlsMpmParticleState.mechanics.byteLength,
    encode(encoder) {
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
      pass.end();
    },
    cleanupSubmittedWork: cleanup
  };
}

export async function runMlsMpmMechanicsRefreshWebGpu(args = {}) {
  const stage = createMlsMpmMechanicsRefreshWebGpuEncoderStage(args);
  const { device, mlsMpmParticleState, retainOutputParticleBuffers = false } = args;
  const noFullReadback = stage.readbackMode === NO_FULL_READBACK_MODE;
  const encoder = device.createCommandEncoder();
  stage.encode(encoder);
  device.queue.submit([encoder.finish()]);
  if (!noFullReadback) {
    stage.result.mechanics = new Float32Array(
      await readBuffer(device, stage.mechanicsBuffer, mlsMpmParticleState.mechanics.byteLength)
    );
  }
  if (noFullReadback) {
    deferSubmittedWorkCleanup(device, stage.cleanupSubmittedWork);
  } else {
    stage.cleanupSubmittedWork();
  }
  if (!retainOutputParticleBuffers) {
    stage.result.mechanicsBuffer = null;
  }
  return stage.result;
}

export async function runMlsMpmMechanicsRefreshWithOptionalWebGpu({
  preferWebGpu = false,
  device = null,
  readbackMode = FULL_READBACK_MODE,
  ...args
} = {}) {
  if (
    preferWebGpu
    && device?.createBuffer
    && device.queue?.writeBuffer
  ) {
    return runMlsMpmMechanicsRefreshWebGpu({
      ...args,
      device,
      readbackMode
    });
  }
  return refreshMlsMpmMechanicsCpu(args);
}
