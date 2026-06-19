import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmMechanicsRefreshWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  findMechanicsMaterialPhaseRecord,
  MLS_MPM_MECHANICS_MATERIAL_PHASE_FLOATS,
  ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA
} from './sphMechanicsMaterialTable.js';

export const ULG_MLS_MPM_MECHANICS_REFRESH_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-refresh.v0';

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

function createOutputStorageBuffer(device, label, byteLength, extraUsage = 0) {
  return device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | extraUsage
  });
}

function createParamsArray({ particleCount, phaseRecordCount }) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, phaseRecordCount, true);
  view.setUint32(8, 0, true);
  view.setUint32(12, 0, true);
  return buffer;
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
  retainedOutputParticleBuffers = false,
  readbackMode = FULL_READBACK_MODE,
  outputBufferInitializationMode = null,
  destroyOutputParticleBuffers = null
}) {
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

export async function runMlsMpmMechanicsRefreshWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  mechanicsMaterialTable,
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
  const materialPhaseBuffer = writeStorageBuffer(
    device,
    'ulg-mls-mpm-mechanics-material-phase-records',
    mechanicsMaterialTable.records
  );
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
    phaseRecordCount: mechanicsMaterialTable.phaseRecordCount
  }));
  const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-mls-mpm-mechanics-refresh.v3',
    label: 'ulg-mls-mpm-mechanics-refresh',
    code: mlsMpmMechanicsRefreshWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'uniform')
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
      { binding: 5, resource: { buffer: paramsBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
  pass.end();
  device.queue.submit([encoder.finish()]);
  let mechanics = new Float32Array();
  if (!noFullReadback) {
    mechanics = new Float32Array(await readBuffer(device, outMechanicsBuffer, mlsMpmParticleState.mechanics.byteLength));
  }
  const cleanup = () => {
    if (!borrowedStateBuffer) stateBuffer.destroy?.();
    if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
    if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
    materialPhaseBuffer.destroy?.();
    paramsBuffer.destroy?.();
    if (!retainOutputParticleBuffers) outMechanicsBuffer.destroy?.();
  };
  if (noFullReadback) {
    deferSubmittedWorkCleanup(device, cleanup);
  } else {
    cleanup();
  }
  return outputEnvelope({
    backend: 'webgpu',
    sphParticleState,
    mlsMpmParticleState,
    mechanicsMaterialTable,
    mechanics,
    mechanicsBuffer: outMechanicsBuffer,
    mechanicsBufferByteLength: mlsMpmParticleState.mechanics.byteLength,
    retainedOutputParticleBuffers: retainOutputParticleBuffers,
    readbackMode,
    outputBufferInitializationMode,
    destroyOutputParticleBuffers() {
      outMechanicsBuffer.destroy?.();
    }
  });
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
