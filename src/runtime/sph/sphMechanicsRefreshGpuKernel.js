import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmMechanicsRefreshWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { createSphExactMechanicsRefreshWgsl } from './sphExactMechanicsRefreshWgsl.js';
import { prepareSphExactMechanicsRefresh } from './sphExactMechanicsRefreshGpu.js';
import { assertSphMechanicsGasLayout } from '../../../ulg-gpu-abi/src/sphGasConstitutive.js';
import { assertSphCondensableInitializationMatches } from './sphCondensableParticleInitialization.js';
import {
  computeBufferBinding,
  cancelQueueOrderedCleanupClaim,
  createQueueOrderedCleanupClaimIssuer,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup,
  registerQueueOrderedCleanupClaim,
  submitQueueOrderedFinalConsumerWork,
  releaseSubmittedWorkCleanupQueueOrdered,
  unwrapWebGpuCacheDevice
} from '../webgpuComputeLayout.js';

const mechanicsMaterialBankWarmInputBufferCache = new WeakMap();
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
import {
  tagWebGpuBufferDevice,
  typedArrayContentFingerprint,
  webGpuBufferDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  appendGpuReadbackTelemetryObservation,
  createGpuReadbackTelemetry
} from './sphGpuReadbackTelemetry.js';

export const ULG_MLS_MPM_MECHANICS_REFRESH_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-refresh.v0';
const mechanicsRefreshCleanupClaimIssuer =
  createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'mls-mpm-mechanics-refresh-submitted-work'
  });
export const ULG_MLS_MPM_MECHANICS_MATERIAL_PHASE_UPLOAD_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-material-phase-upload.v0';

const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const PHASE_CHANGE_REST_VOLUME_RATIO_RESET_THRESHOLD = 2;
const exactRefreshPreparations = new WeakMap();

// Bookkeeping only: each standard runner's private map is the actual issuer.
// A seal created directly with this helper cannot authenticate a stage.
export function createPostMechanicsStageOutputSeal(result, inputs, { onLastRelease = null } = {}) {
  const output = Object.freeze(Object.fromEntries([
    'stateBuffer', 'thermoBuffer', 'mechanicsBuffer', 'residentProductMass'
  ].map((key) => [key, result[key] ?? null])));
  const historyFields = ['productEventBuffer', 'productEventBufferByteLength', 'productEventRowCount',
    'productEventStrideFloats', 'productEventStrideBytes', 'reactionPlacementRolledBack',
    'reactionPlacementTransactionOutcome'];
  const history = output.residentProductMass;
  const historySnapshot = history ? historyFields.map((key) => [key, history[key]]) : [];
  // These fields select/own the continuation. Protect them as well as the
  // buffers: a changed summary must not skip a real carrier debit while its
  // emitted product history survives, and a new .result cannot redirect the
  // closure's retainedStageSource lookup to a structural copy.
  const selectors = ['result', 'reactionSummary', 'ownsStateBuffer', 'ownsThermoBuffer',
    'ownsMechanicsBuffer', 'componentOwnership', 'bufferOwnership'];
  const selectorSnapshot = selectors.map((key) => [key, result[key]]);
  const nestedSelectors = ['reactionSummary', 'componentOwnership', 'bufferOwnership']
    .filter((key) => result[key] && typeof result[key] === 'object')
    .map((key) => [result[key], Object.entries(result[key])]);
  let held = true;
  let holdCount = 1;
  const releaseHold = () => {
    if (--holdCount !== 0) return;
    const callback = onLastRelease;
    onLastRelease = null;
    callback?.();
  };
  let retired = false;
  const guarded = [];
  for (const [owner, key] of [
    [result, 'destroyOutputParticleBuffers'],
    [result, 'destroyOutputParticleBufferComponents'],
    [output.residentProductMass, 'destroyResidentProductMassBuffers']
  ]) {
    if (typeof owner?.[key] !== 'function') continue;
    const destroy = owner[key];
    const guard = function (...args) {
      if (holdCount) throw new Error('Captured post-mechanics output still has an owner read');
      retired = true;
      return destroy.apply(this, args);
    };
    owner[key] = guard;
    guarded.push([owner, key, guard]);
  }
  const validate = () => {
    if (retired || Object.entries(output).some(([key, value]) => (result[key] ?? null) !== value)
        || historySnapshot.some(([key, value]) => history[key] !== value)
        || selectorSnapshot.some(([key, value]) => result[key] !== value)
        || nestedSelectors.some(([object, entries]) => Object.keys(object).length !== entries.length
          || entries.some(([key, value]) => object[key] !== value))
        || guarded.some(([owner, key, guard]) => owner[key] !== guard)) {
      throw new Error('Captured post-mechanics producer output was changed or retired');
    }
    return true;
  };
  return Object.freeze({ result, inputs: Object.freeze({ ...inputs }), output,
    validate,
    retain() {
      validate();
      if (!held) throw new Error('Captured post-mechanics owner has closed read admission');
      holdCount++;
      let active = true;
      return Object.freeze({
        validate() {
          if (!active) throw new Error('Captured post-mechanics read was released');
          return validate();
        },
        release() { if (!active) return false; active = false; releaseHold(); return true; }
      });
    },
    release() { if (!held) return false; held = false; releaseHold(); return true; } });
}

const mechanicsSourceCaptures = new WeakMap();
export function resolveMlsMpmMechanicsRefreshSourceCapture(result, token) {
  const seal = mechanicsSourceCaptures.get(token);
  if (!seal || seal.result !== result) throw new Error('Unknown mechanics source capture');
  seal.validate();
  return seal;
}

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

function mechanicsDeformationDeterminant(mechanics, offset) {
  const a = mechanics[offset];
  const b = mechanics[offset + 1];
  const c = mechanics[offset + 2];
  const d = mechanics[offset + 3];
  const e = mechanics[offset + 4];
  const f = mechanics[offset + 5];
  const g = mechanics[offset + 6];
  const h = mechanics[offset + 7];
  const i = mechanics[offset + 8];
  return a * (e * i - f * h)
    - b * (d * i - f * g)
    + c * (d * h - e * g);
}

function mechanicsAuthorityRowFinite(mechanics, offset) {
  for (let lane = 0; lane < MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS; lane += 1) {
    if (!Number.isFinite(Number(mechanics[offset + lane]))) return false;
  }
  return true;
}

function determinantMatchesVolumeRatio(mechanics, offset, volumeRatioJ) {
  const determinant = mechanicsDeformationDeterminant(mechanics, offset);
  return Number.isFinite(determinant)
    && Math.abs(determinant - volumeRatioJ)
      <= Math.max(1e-5, Math.abs(volumeRatioJ) * 1e-2);
}

function resetMechanicsDeformation(mechanics, mechanicsOffset, volumeRatioJ = 1) {
  const isotropicScale = Math.cbrt(Math.max(finiteNumber(volumeRatioJ, 1), 1e-20));
  mechanics[mechanicsOffset] = isotropicScale;
  mechanics[mechanicsOffset + 1] = 0;
  mechanics[mechanicsOffset + 2] = 0;
  mechanics[mechanicsOffset + 3] = 0;
  mechanics[mechanicsOffset + 4] = isotropicScale;
  mechanics[mechanicsOffset + 5] = 0;
  mechanics[mechanicsOffset + 6] = 0;
  mechanics[mechanicsOffset + 7] = 0;
  mechanics[mechanicsOffset + 8] = isotropicScale;
  for (let index = 9; index <= 17; index += 1) mechanics[mechanicsOffset + index] = 0;
  mechanics[mechanicsOffset + 18] = volumeRatioJ;
}

function rescaleMechanicsDeformation(
  mechanics,
  mechanicsOffset,
  previousVolumeRatioJ,
  nextVolumeRatioJ
) {
  const ratio = Math.max(
    finiteNumber(nextVolumeRatioJ, 0)
      / Math.max(finiteNumber(previousVolumeRatioJ, 0), 1e-20),
    1e-20
  );
  const scale = Math.cbrt(ratio);
  for (let index = 0; index <= 8; index += 1) {
    mechanics[mechanicsOffset + index] *= scale;
  }
  mechanics[mechanicsOffset + 18] = nextVolumeRatioJ;
}

function shouldResetMechanicsForPhaseChange(mechanics, mechanicsOffset, phaseMechanics, nextRestVolumeM3) {
  const previousRestVolumeM3 = finiteNumber(mechanics[mechanicsOffset + 19], 0);
  if (!(nextRestVolumeM3 > 0)) return false;
  const previousReferenceValid = previousRestVolumeM3 > 0
    && finiteNumber(mechanics[mechanicsOffset + 18], 0) > 0
    && Math.round(finiteNumber(mechanics[mechanicsOffset + 21], 0)) === 1
    && Math.round(finiteNumber(mechanics[mechanicsOffset + 27], 0)) === 1;
  if (!previousReferenceValid) return true;
  const previousSolid = finiteNumber(mechanics[mechanicsOffset + 20], 0) > 0.5;
  const nextSolid = finiteNumber(phaseMechanics.solidFlag, 0) > 0.5;
  const previousEosModelId = Math.round(finiteNumber(mechanics[mechanicsOffset + 26], 0));
  const nextEosModelId = Math.round(finiteNumber(phaseMechanics.eosModelId, 0));
  const mechanicsModelChanged = previousSolid !== nextSolid || previousEosModelId !== nextEosModelId;
  if (!mechanicsModelChanged) return false;
  const ratio = Math.max(
    previousRestVolumeM3 / nextRestVolumeM3,
    nextRestVolumeM3 / previousRestVolumeM3
  );
  return ratio >= PHASE_CHANGE_REST_VOLUME_RATIO_RESET_THRESHOLD;
}

function assertRefreshInputs({ sphParticleState, mlsMpmParticleState, mechanicsMaterialTable }) {
  assertSphMechanicsGasLayout(mechanicsMaterialTable);
  assertSphCondensableInitializationMatches(sphParticleState, mlsMpmParticleState);
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
  return tagWebGpuBufferDevice(buffer, device);
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
      if (typeof globalThis.GPUDevice === 'function' && device instanceof globalThis.GPUDevice) {
        const cacheKeyDevice = unwrapWebGpuCacheDevice(device);
        let rowCache = mechanicsMaterialBankWarmInputBufferCache.get(cacheKeyDevice);
        if (!rowCache) {
          rowCache = new WeakMap();
          mechanicsMaterialBankWarmInputBufferCache.set(cacheKeyDevice, rowCache);
        }
        let cachedBuffer = rowCache.get(packedRows);
        if (!cachedBuffer) {
          cachedBuffer = writeStorageBuffer(
            device,
            'ulg-mls-mpm-mechanics-material-bank-warm-input-rows',
            packedRows
          );
          rowCache.set(packedRows, cachedBuffer);
        }
        return {
          buffer: cachedBuffer,
          rowCount: packedRowCount,
          bufferSource: `${candidate.source}-cached`,
          borrowed: true,
          destroy() {}
        };
      }
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
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | extraUsage
  }), device);
}

export function uploadMlsMpmMechanicsMaterialPhaseRecords(device, mechanicsMaterialTable) {
  assertSphMechanicsGasLayout(mechanicsMaterialTable);
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
  const a4GasTableData = mechanicsMaterialTable.a4GasResponseTable?.data;
  const a4GasResponseTableBuffer = a4GasTableData instanceof Float32Array && a4GasTableData.length > 0
    ? writeStorageBuffer(
      device,
      'ulg-mls-mpm-a4-gas-response-table',
      a4GasTableData
    )
    : null;
  if (a4GasResponseTableBuffer && mechanicsMaterialTable.a4GasResponseStatus) {
    globalThis.__ulgA4GasResponseStatus = Object.freeze({
      ...mechanicsMaterialTable.a4GasResponseStatus,
      gpuTableUploaded: true,
      gpuTableBytes: a4GasTableData.byteLength
    });
  }
  let destroyed = false;
  return {
    schema: ULG_MLS_MPM_MECHANICS_MATERIAL_PHASE_UPLOAD_SCHEMA,
    status: 'webgpu-uploaded',
    sourceMaterialTableSchema: mechanicsMaterialTable.schema,
    sourceMaterialTableContentFingerprint: typedArrayContentFingerprint(
      mechanicsMaterialTable.records
    ),
    phaseRecordCount: mechanicsMaterialTable.phaseRecordCount,
    recordsByteLength: mechanicsMaterialTable.records.byteLength,
    recordsBuffer,
    materialPhaseBuffer: recordsBuffer,
    a4GasResponseTableBuffer,
    a4GasResponseStatus: mechanicsMaterialTable.a4GasResponseStatus ?? null,
    destroyMechanicsMaterialPhaseUpload() {
      if (destroyed) return;
      destroyed = true;
      recordsBuffer.destroy?.();
      a4GasResponseTableBuffer?.destroy?.();
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

export function diagnoseUploadedMechanicsMaterialPhaseRecordsMatch(
  upload,
  mechanicsMaterialTable,
  device = null
) {
  const buffer = upload?.recordsBuffer || upload?.materialPhaseBuffer || null;
  const sourceDevice = webGpuBufferDevice(buffer);
  let layoutValid = true;
  try { assertSphMechanicsGasLayout(mechanicsMaterialTable); } catch { layoutValid = false; }
  const tableFingerprint = typedArrayContentFingerprint(
    mechanicsMaterialTable?.records
  );
  const diagnostics = {
    schema:
      'peercompute.ulg.mls-mpm-mechanics-material-phase-upload-match.v0',
    statusUploaded: upload?.status === 'webgpu-uploaded',
    notDestroyed: upload?.destroyed !== true,
    bufferPresent: Boolean(buffer),
    schemaMatch:
      layoutValid && upload?.sourceMaterialTableSchema === mechanicsMaterialTable?.schema,
    fingerprintMatch:
      upload?.sourceMaterialTableContentFingerprint === tableFingerprint,
    countMatch:
      upload?.phaseRecordCount === mechanicsMaterialTable?.phaseRecordCount,
    byteLengthMatch:
      upload?.recordsByteLength === mechanicsMaterialTable?.records?.byteLength,
    sameDevice: !device || sourceDevice === device,
    uploadStatus: upload?.status ?? null,
    uploadDestroyed: upload?.destroyed === true,
    uploadSchema: upload?.sourceMaterialTableSchema ?? null,
    tableSchema: mechanicsMaterialTable?.schema ?? null,
    uploadFingerprint:
      upload?.sourceMaterialTableContentFingerprint ?? null,
    tableFingerprint,
    uploadPhaseRecordCount: upload?.phaseRecordCount ?? null,
    tablePhaseRecordCount: mechanicsMaterialTable?.phaseRecordCount ?? null,
    uploadRecordsByteLength: upload?.recordsByteLength ?? null,
    tableRecordsByteLength: mechanicsMaterialTable?.records?.byteLength ?? null,
    sourceDeviceId: sourceDevice ? webGpuDeviceId(sourceDevice) : null,
    consumerDeviceId: device ? webGpuDeviceId(device) : null
  };
  return Object.freeze({
    ...diagnostics,
    matches: Boolean(
      diagnostics.statusUploaded
      && diagnostics.notDestroyed
      && diagnostics.bufferPresent
      && diagnostics.schemaMatch
      && diagnostics.fingerprintMatch
      && diagnostics.countMatch
      && diagnostics.byteLengthMatch
      && diagnostics.sameDevice
    )
  });
}

export function uploadedMechanicsMaterialPhaseRecordsMatch(
  upload,
  mechanicsMaterialTable,
  device = null
) {
  return diagnoseUploadedMechanicsMaterialPhaseRecordsMatch(
    upload,
    mechanicsMaterialTable,
    device
  ).matches;
}

function createParamsArray({ particleCount, phaseRecordCount, gasConstitutiveOffsetVec4 = 0, materialBankWarmInputRowCount = 0 }) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, phaseRecordCount, true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(materialBankWarmInputRowCount, 0))), true);
  view.setUint32(12, gasConstitutiveOffsetVec4, true);
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
  mechanicsMaterialBankWarmInputShaderBinding = null,
  authorityValidationStatus = 'not-observed',
  authorityValidationFailureCount = null,
  authorityValidationBuffer = null,
  readbackTelemetry = createGpuReadbackTelemetry({
    scope: 'mls-mpm-mechanics-refresh',
    complete: false,
    unknownSources: ['unclassified-mechanics-refresh-backend']
  })
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
    authorityValidationStatus,
    authorityValidationFailureCount,
    authorityValidationBuffer,
    fullReadbackPerformed: readbackMode !== NO_FULL_READBACK_MODE,
    fullParticleReadbackPerformed:
      readbackMode !== NO_FULL_READBACK_MODE,
    fullParticleReadbackFree:
      readbackMode === NO_FULL_READBACK_MODE,
    ...readbackTelemetry,
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
  let authorityValidationFailed = false;
  for (let index = 0; index < sphParticleState.particleCount; index += 1) {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const mechanicsOffset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const massKg = Number(state[stateOffset + 3]);
    if (massKg === 0) continue;
    if (!Number.isFinite(massKg) || massKg < 0) {
      authorityValidationFailed = true;
      break;
    }
    const materialId = Number(thermo[thermoOffset]);
    const phaseId = Number(thermo[thermoOffset + 1]);
    if (!Number.isFinite(materialId) || !Number.isFinite(phaseId)) {
      authorityValidationFailed = true;
      break;
    }
    const phaseMechanics = findMechanicsMaterialPhaseRecord(mechanicsMaterialTable, materialId, phaseId, thermo[thermoOffset + 2]);
    const phaseMechanicsValues = [
      phaseMechanics.restDensityKgPerM3,
      phaseMechanics.effectiveBulkModulusPa,
      phaseMechanics.shearModulusPa,
      phaseMechanics.lameLambdaPa,
      phaseMechanics.soundSpeedMPerS,
      phaseMechanics.eosModelId,
      phaseMechanics.solidFlag,
      phaseMechanics.status,
      phaseMechanics.dynamicViscosityPaS,
      phaseMechanics.surfaceTensionNPerM
    ];
    const restDensity = Number(thermo[thermoOffset + 3]);
    if (
      phaseMechanics.status !== 1
      || phaseMechanics.soundSpeedMPerS < 0
      || !phaseMechanicsValues.every(Number.isFinite)
      || !Number.isFinite(restDensity)
      || !(restDensity > 0)
      || !mechanicsAuthorityRowFinite(mechanics, mechanicsOffset)
    ) {
      authorityValidationFailed = true;
      break;
    }
    const restVolumeM3 = massKg / restDensity;
    const previousVolumeRatioJ = Number(mechanics[mechanicsOffset + 18]);
    const previousRestVolumeM3 = Number(mechanics[mechanicsOffset + 19]);
    const previousCurrentVolumeM3 = previousVolumeRatioJ * previousRestVolumeM3;
    const previousVolumeAuthorityValid = previousVolumeRatioJ > 0
      && previousRestVolumeM3 > 0
      && Number.isFinite(previousCurrentVolumeM3)
      && previousCurrentVolumeM3 > 0
      && Math.round(mechanics[mechanicsOffset + 21]) === 1
      && Math.round(mechanics[mechanicsOffset + 27]) === 1
      && determinantMatchesVolumeRatio(
        mechanics,
        mechanicsOffset,
        previousVolumeRatioJ
      );
    if (
      !(restVolumeM3 > 0)
      || !Number.isFinite(restVolumeM3)
      || !previousVolumeAuthorityValid
    ) {
      authorityValidationFailed = true;
      break;
    }
    const currentVolumeM3 = previousCurrentVolumeM3;
    const nextVolumeRatioJ = currentVolumeM3 / restVolumeM3;
    if (!(nextVolumeRatioJ > 0) || !Number.isFinite(nextVolumeRatioJ)) {
      authorityValidationFailed = true;
      break;
    }
    if (shouldResetMechanicsForPhaseChange(mechanics, mechanicsOffset, phaseMechanics, restVolumeM3)) {
      resetMechanicsDeformation(mechanics, mechanicsOffset, nextVolumeRatioJ);
    } else {
      rescaleMechanicsDeformation(
        mechanics,
        mechanicsOffset,
        previousVolumeRatioJ,
        nextVolumeRatioJ
      );
    }
    mechanics[mechanicsOffset + 18] = nextVolumeRatioJ;
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
    if (
      !mechanicsAuthorityRowFinite(mechanics, mechanicsOffset)
      || !determinantMatchesVolumeRatio(
        mechanics,
        mechanicsOffset,
        nextVolumeRatioJ
      )
    ) {
      authorityValidationFailed = true;
      break;
    }
  }
  const publishedMechanics = authorityValidationFailed
    ? new Float32Array(source)
    : mechanics;
  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    mlsMpmParticleState,
    mechanicsMaterialTable,
    mechanics: publishedMechanics,
    mechanicsBufferByteLength: publishedMechanics.byteLength,
    retainedOutputParticleBuffers: false,
    readbackMode: FULL_READBACK_MODE,
    authorityValidationStatus: authorityValidationFailed
      ? 'mechanics-refresh-authority-rejected'
      : 'mechanics-refresh-authority-accepted',
    authorityValidationFailureCount: authorityValidationFailed ? 1 : 0
  });
}

export function createMlsMpmMechanicsRefreshWebGpuEncoderStage(args = {}) {
  const exact = exactRefreshPreparations.get(args) ?? null;
  const {
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
  } = args;
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
    mechanicsMaterialTable,
    device
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
  // Never size GPU outputs from the CPU arrays alone: under GPU-resident
  // continuation the CPU copies can be stale or detached (byteLength 0).
  const outMechanicsBuffer = createOutputStorageBuffer(
    device,
    'ulg-mls-mpm-mechanics-refresh-output-mechanics',
    Math.max(
      mlsMpmParticleState.mechanics.byteLength,
      mlsMpmParticleState.particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT
    ),
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
    gasConstitutiveOffsetVec4: mechanicsMaterialTable.gasConstitutiveOffsetVec4 ?? 0,
    materialBankWarmInputRowCount: materialBankWarmInputBinding.rowCount
  }));
  const authorityValidationBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-mechanics-refresh-authority-validation',
    size: Uint32Array.BYTES_PER_ELEMENT,
    usage: GPU_BUFFER_USAGE.STORAGE
      | GPU_BUFFER_USAGE.COPY_DST
      | GPU_BUFFER_USAGE.COPY_SRC
  });
  if (exact?.retainAcceptance) exact.retainAcceptanceBuffer(authorityValidationBuffer);
  device.queue.writeBuffer(
    authorityValidationBuffer,
    0,
    new Uint32Array([0])
  );
  const refreshCode = exact ? createSphExactMechanicsRefreshWgsl() : mlsMpmMechanicsRefreshWgsl;
  const extraBindings = exact ? [computeBufferBinding(8, 'read-only-storage')] : [];
  const refreshPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-mls-mpm-mechanics-refresh.v5-transactional-main${exact ? '-exact-quantities-v1' : ''}`,
    label: 'ulg-mls-mpm-mechanics-refresh',
    code: refreshCode,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'uniform'),
      computeBufferBinding(6, 'read-only-storage'),
      computeBufferBinding(7, 'storage'),
      ...extraBindings
    ]
  });
  const commitPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-mls-mpm-mechanics-refresh.v5-transactional-commit${exact ? '-exact-quantities-v1' : ''}`,
    label: 'ulg-mls-mpm-mechanics-refresh-commit',
    code: refreshCode,
    entryPoint: 'commit_or_restore',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'uniform'),
      computeBufferBinding(6, 'read-only-storage'),
      computeBufferBinding(7, 'storage'),
      ...extraBindings
    ]
  });
  const bindGroupEntries = [
    { binding: 0, resource: { buffer: stateBuffer } },
    { binding: 1, resource: { buffer: thermoBuffer } },
    { binding: 2, resource: { buffer: mechanicsBuffer } },
    { binding: 3, resource: { buffer: materialPhaseBuffer } },
    { binding: 4, resource: { buffer: outMechanicsBuffer } },
    { binding: 5, resource: { buffer: paramsBuffer } },
    { binding: 6, resource: { buffer: materialBankWarmInputBinding.buffer } },
    { binding: 7, resource: { buffer: authorityValidationBuffer } },
    ...(exact ? [{ binding: 8, resource: { buffer: exact.projectionBuffer } }] : [])
  ];
  exact?.bind(authorityValidationBuffer);
  const bindGroup = createCachedExplicitBindGroup(device, {
    label: 'ulg-mls-mpm-mechanics-refresh-main',
    layout: refreshPipeline.bindGroupLayout,
    entries: bindGroupEntries
  });
  const commitBindGroup = createCachedExplicitBindGroup(device, {
    label: 'ulg-mls-mpm-mechanics-refresh-commit',
    layout: commitPipeline.bindGroupLayout,
    entries: bindGroupEntries
  });
  const mechanics = new Float32Array();
  const destroyedBuffers = new Set();
  let localMaterialPhaseUploadDestroyed = false;
  let materialBankWarmInputDestroyed = false;
  let cleanupComplete = false;
  const destroyBufferOnce = (buffer) => {
    if (!buffer || destroyedBuffers.has(buffer)) return;
    buffer.destroy?.();
    destroyedBuffers.add(buffer);
  };
  const cleanup = () => {
    if (cleanupComplete) return;
    let firstError = null;
    for (const buffer of [
      !borrowedStateBuffer ? stateBuffer : null,
      !borrowedThermoBuffer ? thermoBuffer : null,
      !borrowedMechanicsBuffer ? mechanicsBuffer : null,
      paramsBuffer,
      exact?.retainAcceptance || retainOutputParticleBuffers ? null : authorityValidationBuffer,
      !retainOutputParticleBuffers ? outMechanicsBuffer : null
    ]) {
      try {
        destroyBufferOnce(buffer);
      } catch (error) {
        firstError ??= error;
      }
    }
    if (
      localMaterialPhaseUpload
      && !localMaterialPhaseUploadDestroyed
    ) {
      try {
        destroyMlsMpmMechanicsMaterialPhaseUpload(
          localMaterialPhaseUpload
        );
        localMaterialPhaseUploadDestroyed = true;
      } catch (error) {
        firstError ??= error;
      }
    }
    if (!materialBankWarmInputDestroyed) {
      try {
        materialBankWarmInputBinding.destroy?.();
        materialBankWarmInputDestroyed = true;
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
    exact?.cleanupTransient();
    cleanupComplete = true;
  };
  const result = outputEnvelope({
    backend: 'webgpu',
    encodedDispatchCount: exact ? 8 : 2,
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
    authorityValidationStatus:
      'mechanics-refresh-authority-validation-gpu-resident',
    authorityValidationBuffer,
    readbackTelemetry: readbackMode === NO_FULL_READBACK_MODE
      ? createGpuReadbackTelemetry({
          scope: 'mls-mpm-mechanics-refresh-webgpu',
          mapAsyncCount: 0,
          readbackBytes: 0
        })
      : createGpuReadbackTelemetry({
          scope: 'mls-mpm-mechanics-refresh-webgpu',
          complete: false,
          unknownSources: ['full-readback-pending']
        }),
    destroyOutputParticleBuffers() {
      destroyBufferOnce(outMechanicsBuffer);
      if (!exact?.retainAcceptance) destroyBufferOnce(authorityValidationBuffer);
      // The exchange capture retains its acceptance word until its last
      // consumer releases it; a preserved mechanics buffer cannot leak it.
      exact?.destroyOutput();
    }
  });
  return {
    schema: 'peercompute.ulg.mls-mpm-mechanics-refresh-encoder-stage.v0',
    status: 'mechanics-refresh-encoder-stage-ready',
    backend: 'webgpu',
    encodedDispatchCount: exact ? 8 : 2,
    readbackMode,
    result,
    mechanicsBuffer: outMechanicsBuffer,
    mechanicsBufferByteLength: mlsMpmParticleState.mechanics.byteLength,
    encode(encoder) {
      exact?.encode(encoder);
      const pass = encoder.beginComputePass();
      pass.setPipeline(refreshPipeline.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
      pass.end();
      const commitPass = encoder.beginComputePass();
      commitPass.setPipeline(commitPipeline.pipeline);
      commitPass.setBindGroup(0, commitBindGroup);
      commitPass.dispatchWorkgroups(
        Math.ceil(sphParticleState.particleCount / 64)
      );
      commitPass.end();
      exact?.encode(encoder, true);
    },
    cleanupSubmittedWork: cleanup
  };
}

export async function runMlsMpmMechanicsRefreshWebGpu(args = {}) {
  if (args.exactReactionResult == null && args.exactReactionSourceCapture == null
      && args.exactThermalResult == null && args.exactThermalSourceCapture == null
      && args.exactVaporProducerRead == null && args.exactPhaseResult == null && args.exactPhaseSourceCapture == null) {
    return runMechanicsRefreshWebGpu(args);
  }
  const capturedArgs = { ...args };
  const exact = await prepareSphExactMechanicsRefresh(capturedArgs);
  exactRefreshPreparations.set(capturedArgs, exact);
  try {
    return await runMechanicsRefreshWebGpu(capturedArgs);
  } catch (error) {
    const cleanup = exact.abandon().then(() => {
      exact.stage?.cleanupSubmittedWork();
      exact.stage?.result.destroyOutputParticleBuffers();
    });
    void cleanup.catch(() => {});
    error.exactMechanicsRefreshCleanupCompletion = cleanup;
    throw error;
  } finally {
    exactRefreshPreparations.delete(capturedArgs);
  }
}

async function runMechanicsRefreshWebGpu(args) {
  const exact = exactRefreshPreparations.get(args) ?? null;
  const token = args.postMechanicsSourceCapture ?? null;
  if (token) {
    if (mechanicsSourceCaptures.has(token)) throw new Error('Mechanics source capture cannot replay');
    mechanicsSourceCaptures.set(token, null);
    if (args.retainOutputParticleBuffers !== true) throw new Error('Mechanics capture requires retained outputs');
  }
  const capturedInputs = token ? { device: args.device, sphParticleState: args.sphParticleState,
    mechanicsMaterialTable: args.mechanicsMaterialTable,
    mlsMpmParticleState: args.mlsMpmParticleState, sourceStateBuffer: args.sourceStateBuffer,
    sourceThermoBuffer: args.sourceThermoBuffer, sourceMechanicsBuffer: args.sourceMechanicsBuffer } : null;
  const stage = createMlsMpmMechanicsRefreshWebGpuEncoderStage(args);
  if (exact) exact.stage = stage;
  const {
    device,
    mlsMpmParticleState,
    retainOutputParticleBuffers = false,
    queueOrderedProducerClaims = []
  } = args;
  const noFullReadback = stage.readbackMode === NO_FULL_READBACK_MODE;
  const exactConsumerClaims =
    Array.isArray(queueOrderedProducerClaims)
      ? queueOrderedProducerClaims
      : [];
  const authenticatedQueueOrderedRoute =
    noFullReadback && exactConsumerClaims.length > 0;
  const encoder = device.createCommandEncoder();
  stage.encode(encoder);
  const commandBuffer = encoder.finish();
  exact?.markSubmitted();
  let submittedWorkCleanupClaim = null;
  let submittedWorkFinalConsumer = null;
  if (authenticatedQueueOrderedRoute) {
    submittedWorkCleanupClaim = registerQueueOrderedCleanupClaim(
      mechanicsRefreshCleanupClaimIssuer,
      device,
      {
        producerOutput: stage,
        cleanup: stage.cleanupSubmittedWork
      }
    );
    try {
      submittedWorkFinalConsumer =
        submitQueueOrderedFinalConsumerWork(
          device,
          [commandBuffer],
          {
            finalConsumerOwner: stage,
            producerClaims: [
              ...exactConsumerClaims,
              submittedWorkCleanupClaim
            ]
          }
        );
    } catch (error) {
      cancelQueueOrderedCleanupClaim(
        submittedWorkCleanupClaim,
        device,
        {
          producerOutput: stage,
          cleanup: stage.cleanupSubmittedWork
        }
      );
      throw error;
    }
  } else {
    device.queue.submit([commandBuffer]);
  }
  if (!noFullReadback) {
    const [mechanicsBytes, validationBytes] = await Promise.all([
      readBuffer(
        device,
        stage.mechanicsBuffer,
        mlsMpmParticleState.mechanics.byteLength
      ),
      readBuffer(
        device,
        stage.result.authorityValidationBuffer,
        Uint32Array.BYTES_PER_ELEMENT
      )
    ]);
    stage.result.mechanics = new Float32Array(mechanicsBytes);
    const failureCount = new Uint32Array(validationBytes)[0];
    stage.result.authorityValidationFailureCount = failureCount;
    stage.result.authorityValidationStatus = failureCount === 0
      ? 'mechanics-refresh-authority-accepted'
      : 'mechanics-refresh-authority-rejected';
    Object.assign(stage.result, createGpuReadbackTelemetry({
      scope: 'mls-mpm-mechanics-refresh-webgpu',
      mapAsyncCount: 2,
      readbackBytes:
        Math.max(4, mlsMpmParticleState.mechanics.byteLength)
        + Uint32Array.BYTES_PER_ELEMENT
    }));
  }
  if (noFullReadback) {
    if (authenticatedQueueOrderedRoute) {
      Object.defineProperty(
        stage.result,
        'queueOrderedFinalConsumerCapability',
        {
          value: submittedWorkFinalConsumer,
          enumerable: false
        }
      );
      try {
        const cleanupReceipt = releaseSubmittedWorkCleanupQueueOrdered(
          device,
          stage.cleanupSubmittedWork,
          {
            queueOrderedFinalConsumer: submittedWorkFinalConsumer,
            producerClaim: submittedWorkCleanupClaim,
            producerOutput: stage,
            producerFamily:
              'mls-mpm-mechanics-refresh-submitted-work'
          }
        );
        Object.assign(stage.result, {
          submittedWorkCleanupReceipt: cleanupReceipt,
          submittedWorkCleanupStatus: cleanupReceipt.status,
          submittedWorkCleanupHostQueueFenceCount:
            cleanupReceipt.hostQueueFenceCount,
          submittedWorkCleanupMethod: cleanupReceipt.queueCompletionMethod
        });
      } catch (error) {
        deferSubmittedWorkCleanup(
          device,
          stage.cleanupSubmittedWork
        );
        appendGpuReadbackTelemetryObservation(stage.result, {
          hostQueueFenceCount: 1,
          deferredCleanupHostQueueFenceCount: 1
        }, {
          source: 'mechanics-refresh-submitted-work-cleanup-retry'
        });
        Object.assign(stage.result, {
          submittedWorkCleanupStatus:
            'queue-ordered-local-cleanup-retry-deferred-after-host-queue-fence',
          submittedWorkCleanupError:
            error instanceof Error ? error.message : String(error),
          submittedWorkCleanupHostQueueFenceCount: 1,
          submittedWorkCleanupMethod:
            'gpu-queue-on-submitted-work-done'
        });
      }
    } else {
      deferSubmittedWorkCleanup(device, stage.cleanupSubmittedWork);
      appendGpuReadbackTelemetryObservation(stage.result, {
        hostQueueFenceCount: 1,
        deferredCleanupHostQueueFenceCount: 1
      }, {
        source: 'mechanics-refresh-submitted-work-cleanup'
      });
      Object.assign(stage.result, {
        submittedWorkCleanupStatus:
          'submitted-work-cleanup-deferred-after-host-queue-fence',
        submittedWorkCleanupHostQueueFenceCount: 1,
        submittedWorkCleanupMethod:
          'gpu-queue-on-submitted-work-done'
      });
    }
  } else {
    stage.cleanupSubmittedWork();
  }
  if (!retainOutputParticleBuffers) {
    stage.result.mechanicsBuffer = null;
  }
  if (token) {
    const base = createPostMechanicsStageOutputSeal(stage.result, capturedInputs,
      { onLastRelease: exact?.releaseSource ?? null });
    mechanicsSourceCaptures.set(token, exact ? Object.freeze({ ...base,
      exactMechanics: Object.freeze({ quantityBuffer: exact.quantityBuffer, quantityLayout: exact.quantityLayout,
        format: exact.format, source: exact.source }),
      sourceCleanupCompletion: exact.sourceCleanupCompletion,
      transferExactQuantities() { base.validate(); exact.validateOutput(); exact.transferQuantities(); },
      validate() { base.validate(); exact.validateOutput(); return true; }
    }) : base);
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
