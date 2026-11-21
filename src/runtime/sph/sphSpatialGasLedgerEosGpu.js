import { validateSphTransportPacketMode } from './sphConservativeTransferPacketWgsl.js';
import { sphAerosolSourceFamily } from './sphAerosolSpatialBinding.js';
import {
  acquireSchroederSpatialSuccessorParticleProductRead,
  acquireSchroederSpatialSuccessorAerosolRead,
  validateSchroederSpatialSuccessorParticleProductRead,
  resolveSchroederSpatialSuccessorSourceFamily,
  releaseSchroederSpatialSuccessorSourceFamilyLease
} from './schroederSpatialSuccessorSourceFamily.js';
import {
  SPH_SPATIAL_GAS_MIXTURE_MOMENT_ROW_FLOATS,
  decodeSphSpatialGasMixtureMomentRows,
  sphSpatialGasMixtureMomentsWgsl
} from './sphSpatialGasMixtureMoments.js';
import {
  SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_EPOCH_MAGIC,
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_FLOATS,
  SPH_SPATIAL_GAS_FREE_VOLUME_VERSION,
  SCHROEDER_QUADRATIC_CONTROL_VOLUME_PROJECTION_VERSION,
  createSchroederQuadraticControlVolumeDescriptor,
  schroederQuadraticControlVolumeProjectionWgsl,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT,
  ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
  validateSchroederSpatialParentFieldViewDescriptor,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  ULG_SCHROEDER_SPATIAL_DIRECTORY_SOURCE_SCHEMA,
  ULG_SCHROEDER_SPATIAL_GPU_LOGICAL_COUNT_SOURCE_SCHEMA,
  acquireSchroederSpatialEpochGenerationConsumerLease,
  canReleaseSchroederSpatialEpochGenerationConsumerLeaseQueueOrderedAfterFinalConsumer,
  canReleaseSchroederSpatialEpochGenerationConsumerLeaseAndGenerationQueueOrderedAfterFinalConsumer,
  canReleaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer,
  ownsSchroederSpatialEpochGenerationConsumerLease,
  quarantineSchroederSpatialEpochGenerationAfterDeviceLoss,
  releaseSchroederSpatialEpochGenerationConsumerLease,
  releaseSchroederSpatialEpochGenerationConsumerLeaseAfter,
  releaseSchroederSpatialEpochGenerationConsumerLeaseQueueOrderedAfterFinalConsumer,
  releaseSchroederSpatialEpochGenerationAfterQueue,
  releaseSchroederSpatialEpochGenerationConsumerLeaseAndGenerationQueueOrderedAfterFinalConsumer,
  releaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer,
  runSchroederSpatialEpochGenerationWithBackpressureWebGpu,
  validateSchroederSpatialEpochGenerationLevelAssignment
} from './schroederSpatialEpochGpu.js';
import {
  abandonSphSpatialGasFreeVolumeEosAuthority,
  acquireSphSpatialGasFreeVolumePressureChain,
  activeSphSpatialGasFreeVolumeExecutionCount,
  createSphSpatialGasFreeVolumeGpu,
  canReleaseSphSpatialGasFreeVolumeExecutionQueueOrdered,
  describeSphSpatialGasFreeVolumeExecution,
  destroySphSpatialGasFreeVolumeGpu,
  encodeSphSpatialGasFreeVolumeEosAuthority,
  encodeSphSpatialGasFreeVolumeGpu,
  isSphSpatialGasFreeVolumeExecutionSubmitted,
  releaseSphSpatialGasFreeVolumeExecution,
  releaseSphSpatialGasFreeVolumeExecutionAfter,
  releaseSphSpatialGasFreeVolumeExecutionAfterDeviceLoss,
  releaseSphSpatialGasFreeVolumeExecutionQueueOrdered,
  submitSphSpatialGasFreeVolumeEosAuthority
} from './sphSpatialGasFreeVolumeGpu.js';
import {
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_MAGIC,
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES,
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED,
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY,
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_VERSION,
  productEventLiveCountCopyDescriptor,
  residentProductEventCountAuthorityRegistered,
  validateProductEventLiveCountCopyDescriptor
} from './sphResidentProductHistoryGpu.js';
import {
  residentProductMassDevice,
  tagWebGpuBufferDevice,
  webGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId,
  webGpuDeviceMismatchInfo
} from './sphGpuDeviceIdentity.js';
import {
  assertSphLegacyMassPathAllowed,
  ensureSphGpuParticleBufferSetBorrowLifecycle,
  acquireSphParticleExactMassRead, releaseSphParticleExactMassRead
} from './sphGpuBuffers.js';
import { prepareSphExactHistoryGasViews } from './sphExactHistoryP2gGpu.js';
import {
  cancelQueueOrderedCleanupClaim,
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  createQueueOrderedCleanupClaimIssuer,
  registerQueueOrderedCleanupClaim,
  releaseSubmittedWorkCleanupQueueOrdered
} from '../webgpuComputeLayout.js';
import { createWebGpuU32ExclusiveScan } from '../webgpuRadixScanUnique.js';
import {
  createGpuReadbackTelemetryAccumulator,
  mergeGpuReadbackTelemetry
} from './sphGpuReadbackTelemetry.js';
import {
  normalizeSphSpatialGasSpeciesDiagnostics,
  encodeSphSpatialGasSpeciesDiagnostics,
  decodeSphSpatialGasSpeciesDiagnosticPacket
} from './sphSpatialGasSpeciesDiagnostics.js';

export const ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA_V1 =
  'peercompute.ulg.sph-retained-spatial-gas-ledger-source.v1';
export const ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V1 =
  'peercompute.ulg.sph-retained-gas-cell-eos-source.v1';
export const ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA_V1 =
  'peercompute.ulg.sph-spatial-gas-ledger-eos-execution.v1';
export const ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA_V2 =
  'peercompute.ulg.sph-retained-spatial-gas-ledger-source.v2';
export const ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2 =
  'peercompute.ulg.sph-retained-gas-cell-eos-source.v2';
export const ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA_V2 =
  'peercompute.ulg.sph-spatial-gas-ledger-eos-execution.v2';
export const ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA_V3 =
  'peercompute.ulg.sph-retained-spatial-gas-ledger-source.v3';
export const ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3 =
  'peercompute.ulg.sph-retained-gas-cell-eos-source.v3';
export const ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA_V3 =
  'peercompute.ulg.sph-spatial-gas-ledger-eos-execution.v3';
export const ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA_V4 =
  'peercompute.ulg.sph-retained-spatial-gas-ledger-source.v4';
export const ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA_V4 =
  'peercompute.ulg.sph-spatial-gas-ledger-eos-execution.v4';
export const ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA_V5 =
  'peercompute.ulg.sph-retained-spatial-gas-ledger-source.v5';
export const ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V4 =
  'peercompute.ulg.sph-retained-gas-cell-eos-source.v4';
export const ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA_V5 =
  'peercompute.ulg.sph-spatial-gas-ledger-eos-execution.v5';
export const ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA =
  'peercompute.ulg.sph-retained-spatial-gas-ledger-source.v7';
export const ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA =
  'peercompute.ulg.sph-retained-gas-cell-eos-source.v5';
export const ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-ledger-eos-execution.v7';
export const ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA =
  'peercompute.ulg.sph-gas-pressure-authority-telemetry.v1';
export const ULG_SPH_GAS_PRESSURE_CONSUMER_RECEIPT_SCHEMA =
  'peercompute.ulg.sph-gas-pressure-consumer-receipt.v1';
export const ULG_SPH_GAS_PRESSURE_MECHANICS_BINDING_SCHEMA =
  'peercompute.ulg.sph-gas-pressure-mechanics-binding.v2';

export const SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS =
  SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_FLOATS;
export const SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS = 16;
export const SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS = 12;
export const SPH_SPATIAL_GAS_LEDGER_EOS_WORKGROUP_SIZE = 64;
export const SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_COUNT = 3;
export const SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC = 0x5347_4133;
export const SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION = 4;
export const SPH_SPATIAL_GAS_AUTHORITY_CONTROL_WORDS = 36;
export const SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES =
  SPH_SPATIAL_GAS_AUTHORITY_CONTROL_WORDS * Uint32Array.BYTES_PER_ELEMENT;

export const SPH_SPATIAL_GAS_AUTHORITY_STATUS = Object.freeze({
  INITIALIZED: 1 << 0,
  COMPACT_READY: 1 << 1,
  DIRECTORY_READY: 1 << 2,
  EOS_READY: 1 << 3,
  PRESSURE_READY: 1 << 4,
  EMPTY: 1 << 5,
  FAILED: 0x8000_0000
});
export const SPH_SPATIAL_GAS_AUTHORITY_ERROR = Object.freeze({
  INVALID_CANDIDATE: 1 << 0,
  CONSERVATION: 1 << 1,
  COMPACTION_OVERFLOW: 1 << 2,
  DIRECTORY_REJECTED: 1 << 3,
  EOS_INVALID: 1 << 4,
  COUNT_MISMATCH: 1 << 5,
  GENERATION_MISMATCH: 1 << 6,
  CAPACITY_OVERFLOW: 1 << 7,
  FREE_VOLUME_INVALID: 1 << 8,
  PRODUCT_HISTORY_AUTHORITY_INVALID: 1 << 9
});
export const SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS = Object.freeze({
  MAGIC: 0,
  VERSION: 1,
  STATUS_FLAGS: 2,
  ERROR_FLAGS: 3,
  EXECUTION_GENERATION: 4,
  COMPLETION_GENERATION: 5,
  SOURCE_STORAGE_GENERATION: 6,
  SOURCE_CAPACITY: 7,
  LIVE_RESIDUAL_COUNT: 8,
  DIRECTORY_GENERATION: 9,
  DIRECTORY_CELL_COUNT: 10,
  READY_PRESSURE_COUNT: 11,
  INVALID_CANDIDATE_COUNT: 12,
  COMPACTION_OVERFLOW_COUNT: 13,
  DIRECTORY_ERROR_COUNT: 14,
  EOS_ERROR_COUNT: 15,
  SS_KEY_DISPATCH_X: 16,
  SS_KEY_DISPATCH_Y: 17,
  SS_KEY_DISPATCH_Z: 18,
  SS_ASSEMBLE_DISPATCH_X: 19,
  SS_ASSEMBLE_DISPATCH_Y: 20,
  SS_ASSEMBLE_DISPATCH_Z: 21,
  EOS_AGGREGATE_DISPATCH_X: 22,
  EOS_AGGREGATE_DISPATCH_Y: 23,
  EOS_AGGREGATE_DISPATCH_Z: 24,
  EOS_GRADIENT_DISPATCH_X: 25,
  EOS_GRADIENT_DISPATCH_Y: 26,
  EOS_GRADIENT_DISPATCH_Z: 27,
  COMPACT_STRIDE: 28,
  ACTIVE_NODE_STRIDE: 29,
  PRESSURE_STRIDE: 30,
  FREE_VOLUME_READY_COUNT: 31,
  PROJECTION_VERSION: 32,
  CONTROL_VOLUME_GEOMETRY_SEAL: 33
});

export const SPH_SPATIAL_GAS_DIAGNOSTICS_NONE = 'none';
export const SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE =
  'full-spatial-gas-oracle';

const SPATIAL_GAS_UNION_POSITION_AUTHORITY =
  'particle-xn-or-reaction-product-event-birth-position';
const SPATIAL_GAS_UNION_SOURCE_FAMILY =
  'sph-particle-and-reaction-residual-gas-ledger';
const DEFAULT_GAS_CONSTANT_J_PER_MOL_K = 8.31446261815324;
const DEFAULT_GAS_TEMPERATURE_K = 293.15;
const SPH_SPATIAL_GAS_COMPACT_CAPACITY_FLOOR_ROWS = 4096;
const SPH_PARTICLE_STATE_STRIDE_FLOATS =
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length;
const SPH_PARTICLE_THERMO_STRIDE_FLOATS =
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length;
const SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS =
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length;
const MAX_EXACT_F32_INTEGER = 0x00ff_ffff;
const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const FLOAT32_BYTES = Float32Array.BYTES_PER_ELEMENT;
const PARAMS_BUFFER_BYTES = 256;

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

const deviceRuntimes = new WeakMap();
const retainedExecutions = new WeakMap();
// Only the original EOS invocation issues this borrowed numerical input to
// its own free-volume encoder. It is not a history/count/inventory owner.
const retainedGasHistoryVolumeInputs = new WeakMap();

export function resolveSphSpatialGasHistoryVolumeInput(input, { device, generation, encoder, gasDirectory } = {}) {
  if (input == null) return null;
  const record = retainedGasHistoryVolumeInputs.get(input);
  if (!record || record.device !== device || record.generation !== generation
      || record.encoder !== encoder || record.gasDirectory !== gasDirectory) {
    throw new TypeError('Gas occupied volume requires the original EOS history input and encoder');
  }
  record.validate();
  return record;
}
const retainedSpatialGasSources = new WeakMap();
const retainedGasCellSources = new WeakMap();
const retainedPressureConsumerReceipts = new WeakMap();
const retainedPressureMechanicsBindings = new WeakMap();
const retainedPressureMechanicsFamilies = new WeakMap();
const retainedChainPressureInputs = new WeakMap();

export function resolveSphSpatialGasChainPressureInput(input, {device,execution} = {}) {
  const original=retainedChainPressureInputs.get(input);
  if(!original || original.device!==device || original.execution!==execution) {
    throw new TypeError('Chain pressure requires its original EOS-issued input');
  }
  original.validate();return original;
}

// One original EOS owner, one ordered consumer for every native level. The
// last consumer retires the owner through its existing queue-order claim.
export function beginSphSpatialGasPressureMechanicsFamily(source, {device,generation,ambientPressurePa} = {}) {
  const record=livePressureSourceRecord(source);
  const levels=generation?.mechanicsLevelViews;
  if(device!==record.device || generation!==record.schroederSpatialEpochGeneration
    || !Array.isArray(levels) || levels.length<3 || levels.length>6
    || levels.length!==generation.mechanicsLevelCount || record.pressureMechanicsFamily
    || !Number.isFinite(ambientPressurePa) || ambientPressurePa<0) {
    throw pressureMechanicsBindingError('Multilevel pressure requires one complete original native family and common ambient pressure');
  }
  const handle=Object.freeze({});
  const input=Object.freeze({});
  const family={handle,input,record,fields:Object.freeze(levels.map(level=>level.mechanicsFieldView)),
    ambientPressurePa:Math.fround(ambientPressurePa),completed:0,closed:false,projectionEncoded:false,projection:null};
  const validate=()=>{
    if(record.pressureMechanicsFamily!==family || family.closed || record.terminal || record.released
      || record.releasePromise || record.releaseAttempted || record.slot.retainedExecution!==record.execution
      || record.slot.ownerToken!==record.ownerToken
      || !ownsSchroederSpatialEpochGenerationConsumerLease(record.generationConsumerLease,generation)) {
      throw pressureMechanicsBindingError('Multilevel pressure family lost its original owner');
    }
  };
  record.pressureMechanicsFamily=family;
  retainedChainPressureInputs.set(input,Object.freeze({device,execution:record.gasFreeVolumeExecution,validate,
    pressureBuffer:record.slot.gasPressureCellsBuffer,controlBuffer:record.slot.controlBuffer,
    directoryBuffer:record.spatialGeneration.execution.directoryBuffer}));
  try {
    family.projection=acquireSphSpatialGasFreeVolumePressureChain(record.gasFreeVolumeExecution,input);
    retainedPressureMechanicsFamilies.set(handle,family);return handle;
  }catch(error){record.pressureMechanicsFamily=null;retainedChainPressureInputs.delete(input);throw error;}
}

export function finishSphSpatialGasPressureMechanicsFamily(handle) {
  const family=retainedPressureMechanicsFamilies.get(handle);
  if(!family || family.closed || family.completed!==family.fields.length || !family.record.released) {
    throw pressureMechanicsBindingError('Every native pressure consumer must submit before family completion');
  }
  family.closed=true;retainedChainPressureInputs.delete(family.input);return true;
}

export function abortSphSpatialGasPressureMechanicsFamily(handle) {
  const family=retainedPressureMechanicsFamilies.get(handle);
  if(!family || family.closed)return false;
  const record=family.record;
  if(record.activePressureConsumerReceipt)abandonSphSpatialGasPressureAuthority(record.activePressureConsumerReceipt);
  family.closed=true;retainedChainPressureInputs.delete(family.input);
  // Only the failed path needs the established final-consumer fence. A
  // throwing submit already quarantines this graph until device loss.
  return record.terminal || record.released || releaseSphSpatialGasLedgerEosAfterQueue(record.execution);
}

export function encodeSphSpatialGasPressureMechanicsChainProjection(binding,{device,encoder,ambientPressurePa}={}) {
  const b=retainedPressureMechanicsBindings.get(binding);
  if(!b || b.device!==device || b.record.activePressureConsumerReceipt!==b.receipt) {
    throw pressureMechanicsBindingError('Pressure projection requires the exact borrowed mechanics binding');
  }
  const family=b.record.pressureMechanicsFamily;
  if(!family)return false;
  const receipt=retainedPressureConsumerReceipts.get(b.receipt);
  if(family.closed || receipt.state!=='borrowed' || receipt.familyIndex!==family.completed
    || !Object.is(Math.fround(ambientPressurePa),family.ambientPressurePa)) {
    throw pressureMechanicsBindingError('Native pressure must use the original family order and ambient pressure');
  }
  family.projection.validate();
  if(!family.projectionEncoded){
    if(family.completed!==0)throw pressureMechanicsBindingError('Pressure transpose must precede every native consumer');
    family.projection.encode(encoder,b.paramsBuffer);family.projectionEncoded=true;
  }
  receipt.projectionPrepared=true;
  return true;
}
const retainedSourceBorrowAccounting = new WeakMap();
const lostDevices = new WeakSet();
const vaporAerosolCandidates = new WeakMap();
const vaporAerosolProducerReads = new WeakMap();
// The optional caloric compiler consumes the existing thermal graph builder.
// Load it only after retaining the source; an eager EOS -> thermal import
// would reintroduce the thermal/reaction entry-order cycle.
let caloricAdmissionModulePromise = null;
const caloricAdmissionModule = () => (caloricAdmissionModulePromise
  ??= import('./sphSpatialGasCaloricAdmission.js'));
const GAS_PRESSURE_QUEUE_ORDERED_PRODUCER_FAMILY =
  'sph-spatial-gas-ledger-eos-v5-pressure-authority';
const gasPressureQueueOrderedCleanupClaimIssuer =
  createQueueOrderedCleanupClaimIssuer({
    producerFamily: GAS_PRESSURE_QUEUE_ORDERED_PRODUCER_FAMILY
  });

function pressureAuthorityError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function exactPressureSourceRecord(source) {
  const record = retainedGasCellSources.get(source);
  return record?.gasCellSource === source ? record : null;
}

function terminalizePressureConsumerReceipt(record) {
  const receipt = record.activePressureConsumerReceipt;
  const receiptRecord = retainedPressureConsumerReceipts.get(receipt);
  if (receiptRecord?.record === record && receiptRecord.state === 'borrowed') {
    receiptRecord.state = 'terminal';
  }
  record.activePressureConsumerReceipt = null;
}

function exactU32(value, label, { positive = false } = {}) {
  const number = value;
  if (
    typeof number !== 'number'
    ||
    !Number.isInteger(number)
    || number < (positive ? 1 : 0)
    || number > 0xffff_ffff
  ) {
    throw new RangeError(
      `${label} must be an integer in [${positive ? 1 : 0}, 4294967295]`
    );
  }
  return number;
}

function positiveFiniteF32(value, label) {
  const number = Math.fround(Number(value));
  if (!Number.isFinite(number) || !(number > 0)) {
    throw new RangeError(`${label} must be a positive finite f32`);
  }
  return number;
}

function nonNegativeFiniteF32(value, label) {
  const number = Math.fround(Number(value));
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${label} must be a non-negative finite f32`);
  }
  return number;
}

function finiteF32(value, label) {
  const number = Math.fround(Number(value));
  if (!Number.isFinite(number)) {
    throw new RangeError(`${label} must be a finite f32`);
  }
  return number;
}

function nextPowerOfTwo(value) {
  let capacity = 1;
  while (capacity < value) capacity *= 2;
  return capacity;
}

function alignedBytes(value) {
  return Math.max(4, Math.ceil(value / 4) * 4);
}

export function sphSpatialGasLedgerEosDispatchWorkgroups(device, rowCount) {
  const count = exactU32(rowCount, 'spatial gas rowCount', { positive: true });
  const required = Math.max(
    1,
    Math.ceil(count / SPH_SPATIAL_GAS_LEDGER_EOS_WORKGROUP_SIZE)
  );
  const advertisedLimit = Number(
    device?.limits?.maxComputeWorkgroupsPerDimension ?? 65_535
  );
  const limit = Number.isInteger(advertisedLimit) && advertisedLimit > 0
    ? advertisedLimit
    : 65_535;
  if (required > limit) {
    const error = new RangeError(
      `spatial gas/EOS dispatch requires ${required} x-workgroups; device limit is ${limit}`
    );
    error.code = 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_DISPATCH_LIMIT';
    error.requiredWorkgroups = required;
    error.maxComputeWorkgroupsPerDimension = limit;
    throw error;
  }
  return required;
}

function signedOrderKey(value) {
  return ((value | 0) ^ 0x8000_0000) >>> 0;
}

function createOwnedBuffer(device, descriptor) {
  const rawBuffer = device.createBuffer(descriptor);
  try {
    return tagWebGpuBufferDevice(rawBuffer, device);
  } catch (primaryError) {
    try {
      rawBuffer?.destroy?.();
    } catch {
      // Preserve the provenance-tagging failure after best-effort retirement.
    }
    throw primaryError;
  }
}

function destroyBufferOnce(slot, buffer) {
  if (!buffer || slot.destroyedBuffers.has(buffer)) return false;
  slot.destroyedBuffers.add(buffer);
  buffer.destroy?.();
  return true;
}

function destroySlot(slot) {
  if (slot.destroyed) return false;
  slot.destroyed = true;
  let primaryError = null;
  for (const buffer of [
    slot.compactRowsBuffer,
    slot.activeNodeBuffer,
    slot.gasPressureCellsBuffer,
    slot.gasMixtureMomentsBuffer,
    ...slot.caloricBuffers,
    slot.candidateFlagsBuffer,
    slot.candidateOffsetsBuffer,
    slot.controlBuffer,
    slot.paramsBuffer,
    ...slot.speciesDiagnosticBuffers
  ]) {
    try {
      destroyBufferOnce(slot, buffer);
    } catch (error) {
      primaryError ??= error;
    }
  }
  if (!slot.compactionScanDestroyed && slot.compactionScan) {
    slot.compactionScanDestroyed = true;
    try {
      slot.compactionScan.destroy?.();
    } catch (error) {
      primaryError ??= error;
    }
  }
  if (primaryError) throw primaryError;
  return true;
}

function promiseFromConfirmedThenable(value) {
  if (
    value == null
    || (typeof value !== 'object' && typeof value !== 'function')
  ) return null;
  let then;
  try {
    then = value.then;
  } catch {
    return null;
  }
  if (typeof then !== 'function') return null;
  return new Promise((resolve, reject) => {
    try {
      then.call(value, resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
}

function quarantineRetainedExecution(record, status, unknownSource) {
  record.releaseAttempted = true;
  record.quarantined = true;
  record.terminal = true;
  record.status = status;
  record.slot.terminal = true;
  if (unknownSource) {
    record.deferredCleanupReadbackTelemetry.markUnknown(unknownSource);
  }
  return false;
}

function createArenaSlot(device, capacity, arenaIndex) {
  const label = `ulg-sph-spatial-gas-ledger-eos-${capacity}-arena-${arenaIndex}`;
  const slot = {
    arenaIndex,
    label,
    capacity,
    inUse: false,
    terminal: false,
    destroyed: false,
    executionSerial: 0,
    ownerToken: null,
    releasePromise: null,
    retainedExecution: null,
    pendingFailure: null,
    destroyedBuffers: new Set(),
    compactionScanDestroyed: false,
    candidateFlagsBuffer: null,
    candidateOffsetsBuffer: null,
    controlBuffer: null,
    compactionScan: null,
    compactRowsBuffer: null,
    activeNodeBuffer: null,
    gasPressureCellsBuffer: null,
    gasMixtureMomentsBuffer: null,
    caloricBuffers: [],
    caloricRowsBuffer: null,
    caloricTableBuffer: null,
    caloricTableByteLength: 0,
    paramsBuffer: null,
    speciesDiagnosticBuffers: [],
    speciesDiagnosticParamsBuffer: null,
    speciesDiagnosticRowsBuffer: null,
    speciesDiagnosticClosureBuffer: null
  };
  const allocatedBuffers = [];
  const allocateBuffer = (descriptor) => {
    const rawBuffer = device.createBuffer(descriptor);
    // Register ownership before provenance tagging: host-object inspection may
    // throw even after createBuffer succeeded, and that raw allocation must
    // still participate in the construction rollback.
    allocatedBuffers.push(rawBuffer);
    return tagWebGpuBufferDevice(rawBuffer, device);
  };
  try {
    slot.candidateFlagsBuffer = allocateBuffer({
      label: `${label}-candidate-flags`,
      size: alignedBytes(capacity * UINT32_BYTES),
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    });
    slot.candidateOffsetsBuffer = allocateBuffer({
      label: `${label}-candidate-offsets`,
      size: alignedBytes(capacity * UINT32_BYTES),
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    });
    slot.controlBuffer = allocateBuffer({
      label: `${label}-authority-control`,
      size: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES,
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    });
    slot.compactionScan = createWebGpuU32ExclusiveScan(device, {
      maxElementCount: capacity,
      fixedElementCount: capacity,
      retainParamsBuffer: true,
      label: `${label}-candidate-scan`
    });
    slot.compactRowsBuffer = allocateBuffer({
      label: `${label}-compact-rows`,
      size: alignedBytes(
        capacity * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS * FLOAT32_BYTES
      ),
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    });
    slot.activeNodeBuffer = allocateBuffer({
      label: `${label}-active-node-adapter`,
      size: alignedBytes(
        capacity * SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS * FLOAT32_BYTES
      ),
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    });
    slot.gasPressureCellsBuffer = allocateBuffer({
      label: `${label}-gas-pressure-cells`,
      size: alignedBytes(
        capacity * SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS * FLOAT32_BYTES
      ),
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    });
    slot.gasMixtureMomentsBuffer = allocateBuffer({
      label: `${label}-gas-mixture-moments`,
      size: alignedBytes(capacity * SPH_SPATIAL_GAS_MIXTURE_MOMENT_ROW_FLOATS * FLOAT32_BYTES),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    });
    slot.paramsBuffer = allocateBuffer({
      label: `${label}-params`,
      size: PARAMS_BUFFER_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    return slot;
  } catch (primaryError) {
    if (slot.compactionScan) {
      slot.compactionScanDestroyed = true;
      try {
        slot.compactionScan.destroy?.();
      } catch {
        // Preserve the construction failure while still retiring siblings.
      }
    }
    for (let index = allocatedBuffers.length - 1; index >= 0; index -= 1) {
      const buffer = allocatedBuffers[index];
      if (slot.destroyedBuffers.has(buffer)) continue;
      slot.destroyedBuffers.add(buffer);
      try {
        buffer.destroy?.();
      } catch {
        // Every allocation is attempted exactly once; preserve primaryError.
      }
    }
    slot.destroyed = true;
    throw primaryError;
  }
}

function terminalizeRuntimeAfterDeviceLoss(runtime) {
  if (runtime.terminal) return false;
  runtime.terminal = true;
  lostDevices.add(runtime.device);
  const quarantinedFreeVolumeExecutions = new Set();
  const quarantineFreeVolumeExecution = (owner) => {
    const freeVolumeExecution = owner?.gasFreeVolumeExecution;
    const freeVolumeRuntime = owner?.gasFreeVolumeRuntime;
    if (
      !freeVolumeExecution
      || !freeVolumeRuntime
      || quarantinedFreeVolumeExecutions.has(freeVolumeExecution)
    ) {
      return false;
    }
    quarantinedFreeVolumeExecutions.add(freeVolumeExecution);
    try {
      const retirement =
        releaseSphSpatialGasFreeVolumeExecutionAfterDeviceLoss(
          freeVolumeRuntime,
          freeVolumeExecution,
          runtime.device.lost
        );
      retirement.then(() => {
        if (
          activeSphSpatialGasFreeVolumeExecutionCount(freeVolumeRuntime) !== 0
        ) return;
        try {
          destroySphSpatialGasFreeVolumeGpu(freeVolumeRuntime);
        } catch {
          // A sibling device-loss retirement owns the final destroy attempt.
        }
      }).catch(() => {});
      return true;
    } catch {
      // A retained execution record and its pending-failure record may alias
      // the same child. The first exact quarantine owns retirement.
      return false;
    }
  };
  for (const slot of runtime.slots) {
    slot.terminal = true;
    const pendingFailure = slot.pendingFailure;
    if (
      pendingFailure
      && pendingFailure.ownerToken === slot.ownerToken
    ) {
      pendingFailure.terminal = true;
      pendingFailure.status = 'spatial-gas-ledger-eos-failure-device-lost';
      pendingFailure.releaseSourceBorrow();
      if (pendingFailure.spatialGeneration) {
        quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
          pendingFailure.spatialGeneration,
          runtime.device
        );
      }
      if (pendingFailure.schroederSpatialEpochGeneration) {
        quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
          pendingFailure.schroederSpatialEpochGeneration,
          runtime.device
        );
      }
      quarantineFreeVolumeExecution(pendingFailure);
      slot.pendingFailure = null;
    }
    const execution = slot.retainedExecution;
    if (execution) {
      const record = retainedExecutions.get(execution);
      if (record) {
        if (!record.terminal) {
          record.terminal = true;
          record.status = 'spatial-gas-ledger-eos-device-lost';
        }
        terminalizePressureConsumerReceipt(record);
        // Idempotent even when an earlier unconfirmed fence already marked the
        // record terminal; device loss is what finally makes borrow retirement
        // and buffer destruction safe for that quarantined execution.
        record.releaseSourceBorrow();
        if (record.spatialGeneration) {
          quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
            record.spatialGeneration,
            runtime.device
          );
        }
        if (record.schroederSpatialEpochGeneration) {
          quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
            record.schroederSpatialEpochGeneration,
            runtime.device
          );
        }
        quarantineFreeVolumeExecution(record);
      }
    }
    destroySlot(slot);
  }
  for (const freeVolumeRuntime of runtime.gasFreeVolumeRuntimes.values()) {
    if (
      activeSphSpatialGasFreeVolumeExecutionCount(freeVolumeRuntime) !== 0
    ) continue;
    try {
      destroySphSpatialGasFreeVolumeGpu(freeVolumeRuntime);
    } catch {
      // An already-scheduled child retirement owns destruction.
    }
  }
  return true;
}

function runtimeForCapacity(device, capacity) {
  if (lostDevices.has(device)) {
    const error = new Error('spatial gas ledger/EOS device is lost');
    error.code = 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_DEVICE_LOST';
    throw error;
  }
  let byCapacity = deviceRuntimes.get(device);
  let runtime = byCapacity?.get(capacity);
  if (runtime) return runtime;
  const slots = [];
  try {
    for (
      let arenaIndex = 0;
      arenaIndex < SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_COUNT;
      arenaIndex += 1
    ) {
      slots.push(createArenaSlot(device, capacity, arenaIndex));
    }
    runtime = {
      schema: 'peercompute.ulg.sph-spatial-gas-ledger-eos-arena.v1',
      status: 'spatial-gas-ledger-eos-arena-ready',
      device,
      deviceId: webGpuDeviceId(device),
      capacity,
      terminal: false,
      acquireCount: 0,
      reuseCount: 0,
      gasFreeVolumeRuntimes: new Map(),
      slots
    };
    const lost = device?.lost;
    const lostThen = lost?.then;
    if (typeof lostThen === 'function') {
      lostThen.call(
        lost,
        () => terminalizeRuntimeAfterDeviceLoss(runtime),
        () => terminalizeRuntimeAfterDeviceLoss(runtime)
      );
    }
    if (runtime.terminal || lostDevices.has(device)) {
      const error = new Error(
        'spatial gas ledger/EOS device was lost during arena construction'
      );
      error.code = 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_DEVICE_LOST';
      throw error;
    }
    if (!byCapacity) {
      byCapacity = new Map();
      deviceRuntimes.set(device, byCapacity);
    }
    byCapacity.set(capacity, runtime);
  } catch (primaryError) {
    for (let index = slots.length - 1; index >= 0; index -= 1) {
      try {
        destroySlot(slots[index]);
      } catch {
        // Preserve the construction/subscription failure after full rollback.
      }
    }
    throw primaryError;
  }
  return runtime;
}

function gasFreeVolumeRuntimeFor({
  runtime,
  device,
  cellCapacity,
  fineFieldCapacity,
  coarseFieldCapacity,
  nativeFieldCapacities = null,
  parentFieldCapacities = null,
  label
}) {
  const key = `${cellCapacity}:${fineFieldCapacity}:${coarseFieldCapacity}:${nativeFieldCapacities?.join(',') ?? ''}:${parentFieldCapacities?.join(',') ?? ''}`;
  let freeVolumeRuntime = runtime.gasFreeVolumeRuntimes.get(key);
  if (freeVolumeRuntime) return freeVolumeRuntime;
  freeVolumeRuntime = createSphSpatialGasFreeVolumeGpu(device, {
    cellCapacity,
    fineFieldCapacity,
    coarseFieldCapacity,
    nativeFieldCapacities,
    parentFieldCapacities,
    arenaCount: SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_COUNT,
    label
  });
  runtime.gasFreeVolumeRuntimes.set(key, freeVolumeRuntime);
  return freeVolumeRuntime;
}

async function acquireArenaSlot(
  device,
  rowCount,
  { onBeforeBackpressureAwait = null } = {}
) {
  const capacity = nextPowerOfTwo(rowCount);
  const runtime = runtimeForCapacity(device, capacity);
  let backpressureWaitCount = 0;
  for (;;) {
    if (runtime.terminal) {
      const error = new Error('spatial gas ledger/EOS arena is terminal');
      error.code = 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_TERMINAL';
      throw error;
    }
    const slot = runtime.slots.find((candidate) => (
      !candidate.inUse && !candidate.terminal && !candidate.destroyed
    ));
    if (slot) {
      slot.inUse = true;
      slot.executionSerial += 1;
      slot.ownerToken = Object.freeze({
        arenaIndex: slot.arenaIndex,
        serial: slot.executionSerial
      });
      slot.releasePromise = null;
      runtime.acquireCount += 1;
      if (backpressureWaitCount > 0 || slot.executionSerial > 1) {
        runtime.reuseCount += 1;
      }
      return {
        runtime,
        slot,
        capacity,
        backpressureWaited: backpressureWaitCount > 0,
        backpressureWaitCount
      };
    }
    const pendingReleases = runtime.slots
      .map((candidate) => candidate.releasePromise)
      .filter((promise) => typeof promise?.then === 'function');
    if (pendingReleases.length === 0) {
      const error = new Error(
        'spatial gas ledger/EOS arena exhausted without a scheduled final-consumer release'
      );
      error.code = 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_BACKPRESSURE';
      error.capacity = capacity;
      error.arenaCount = runtime.slots.length;
      throw error;
    }
    backpressureWaitCount += 1;
    onBeforeBackpressureAwait?.(backpressureWaitCount);
    await Promise.any(pendingReleases.map((promise) => (
      Promise.resolve(promise).then((released) => {
        if (released === true) return true;
        throw new Error('spatial gas arena release was not confirmed');
      })
    )));
  }
}

function releaseSlot(record, confirmed) {
  if (record.slot.ownerToken !== record.ownerToken) return false;
  if (record.slot.retainedExecution !== record.execution) return false;
  record.slot.releasePromise = null;
  record.status = confirmed
    ? 'spatial-gas-ledger-eos-released-after-final-consumer'
    : 'spatial-gas-ledger-eos-release-unconfirmed';
  if (confirmed === true) {
    terminalizePressureConsumerReceipt(record);
    record.releaseSourceBorrow();
    record.slot.retainedExecution = null;
    record.slot.ownerToken = null;
    record.slot.inUse = false;
    record.released = true;
    record.quarantined = false;
    record.terminal = true;
    return true;
  }
  // A rejected/unconfirmed fence is not permission to reuse or destroy memory
  // that the device may still reference. Keep the source borrow and all owned
  // buffers quarantined until device loss proves that no queued work survives.
  record.quarantined = true;
  record.terminal = true;
  record.slot.terminal = true;
  record.deferredCleanupReadbackTelemetry.markUnknown(
    'spatial-gas-final-consumer-cleanup-fence-unconfirmed'
  );
  return false;
}

function sourceBorrowFor(source) {
  let descriptor;
  try {
    descriptor = source && Object.getOwnPropertyDescriptor(
      source,
      '__ulgActiveBorrowCount'
    );
  } catch {
    return null;
  }
  if (!descriptor) {
    return null;
  }
  // Snapshot the admitted accessor. Calling its original getter/setter keeps
  // the real source owner's private counter reachable even if a caller later
  // freezes or redefines the public observation surface.
  const readObservedCount = () => {
    try {
      if (typeof descriptor.get === 'function') {
        return descriptor.get.call(source) | 0;
      }
      return Reflect.get(source, '__ulgActiveBorrowCount') | 0;
    } catch {
      return Object.hasOwn(descriptor, 'value') ? descriptor.value | 0 : 0;
    }
  };
  const writeObservedCount = (value) => {
    try {
      if (typeof descriptor.set === 'function') {
        descriptor.set.call(source, value);
        return true;
      }
      if (Object.hasOwn(descriptor, 'value')) {
        return Reflect.set(source, '__ulgActiveBorrowCount', value);
      }
    } catch {
      return false;
    }
    return false;
  };
  let accounting = retainedSourceBorrowAccounting.get(source);
  if (!accounting) {
    accounting = { activeCount: 0 };
    retainedSourceBorrowAccounting.set(source, accounting);
  }
  accounting.activeCount += 1;
  if (!writeObservedCount(Math.max(0, readObservedCount()) + 1)) {
    accounting.activeCount -= 1;
    return null;
  }
  let released = false;
  const release = () => {
    if (released) return false;
    // Consume the private borrow first. Public accounting is observational and
    // a frozen/non-writable property must never strand the exact private owner.
    released = true;
    accounting.activeCount = Math.max(0, accounting.activeCount - 1);
    writeObservedCount(Math.max(0, readObservedCount() - 1));
    return true;
  };
  release.canRelease = () => released === false;
  release.isReleased = () => released === true;
  release.activeCount = () => accounting.activeCount;
  return release;
}

function sourceBorrowSetFor(sources) {
  const releases = [];
  const uniqueSources = [...new Set(sources.filter(Boolean))];
  for (const source of uniqueSources) {
    const release = sourceBorrowFor(source);
    if (typeof release !== 'function') {
      for (const acquired of releases.reverse()) acquired();
      return null;
    }
    releases.push(release);
  }
  let released = false;
  const releaseAll = () => {
    if (released) return false;
    released = true;
    let confirmed = true;
    for (const release of [...releases].reverse()) {
      confirmed = release() === true && confirmed;
    }
    return confirmed;
  };
  releaseAll.canRelease = () => (
    released === false
    && releases.every((release) => release.canRelease?.() === true)
  );
  releaseAll.isReleased = () => (
    released === true
    && releases.every((release) => release.isReleased?.() === true)
  );
  releaseAll.activeCount = () => releases.reduce(
    (total, release) => total + Math.max(0, release.activeCount?.() ?? 0),
    0
  );
  return releaseAll;
}

// A published pair is stronger than two independently borrowed buffers. Cold,
// partial and private fine-step inventories remain usable by legacy pressure,
// but cannot silently become complete caloric-mixture sources.
function retainParticleProductSourcePair({ device, sphParticleUpload,
  mlsMpmParticleUpload, residentProductMass, consumerLease, epochIdentity, required, particleCount }) {
  const read = acquireSchroederSpatialSuccessorParticleProductRead({ device,
    sphParticleUpload, mlsMpmParticleUpload, residentProductMass, consumerLease,
    consumerStage: 'retained-spatial-gas-mixture', required });
  if (!read) return null;
  let released = false;
  const release = () => {
    if (released) return false;
    const receipt = releaseSchroederSpatialSuccessorSourceFamilyLease(
      read.sourceFamily, read.ownerReadToken, { device });
    released = receipt.released === true;
    return released;
  };
  const validate = () => {
    if (released || read.particleCount !== particleCount || !validateSchroederSpatialSuccessorParticleProductRead(read, {
      device, sphParticleUpload, mlsMpmParticleUpload, residentProductMass
    }) || Object.keys(epochIdentity).some((field) => read.epochIdentity[field] !== epochIdentity[field])) {
      throw new TypeError('Gas mixture lost its exact published particle/product source epoch');
    }
  };
  // A queue-ordered EOS drain must not become the last hold behind the older
  // retirement fence. The original parent remains live until its existing
  // outer-step fence covers these submissions. Without it, use confirmed-fence
  // cleanup, never interpret a bare submit as completed source-family reads.
  const canReleaseQueueOrdered = () => {
    if (released || !consumerLease) return false;
    try {
      validate();
      resolveSchroederSpatialSuccessorSourceFamily(read.sourceFamily, { device,
        sphParticleUpload, mlsMpmParticleUpload, consumerLease });
      return true;
    } catch { return false; }
  };
  try { validate(); } catch (error) { release(); throw error; }
  const acquireAerosolRead = () => {
    validate();
    return acquireSchroederSpatialSuccessorAerosolRead({ device,
      sphParticleUpload, mlsMpmParticleUpload, consumerLease: read.ownerReadToken });
  };
  return { validate, release, canReleaseQueueOrdered, acquireAerosolRead, isReleased: () => released,
    read, sphParticleUpload, mlsMpmParticleUpload, residentProductMass };
}

function withParticleProductSourceBorrow(sourceBorrow, pair) {
  if (!pair) return sourceBorrow;
  const release = () => {
    // Drain the private token before invoking public source-borrow accessors.
    const pairReleased = pair.isReleased() || pair.release();
    const buffersReleased = sourceBorrow.isReleased() || sourceBorrow();
    return pairReleased && buffersReleased;
  };
  release.canRelease = () => sourceBorrow.canRelease() && pair.canReleaseQueueOrdered();
  release.releaseQueueOrdered = () => {
    // Other cleanup operations may invoke public setters. Recheck at the
    // actual child drain, not only at the earlier retirement preflight.
    if (!release.canRelease()) return false;
    return release();
  };
  release.isReleased = () => sourceBorrow.isReleased() && pair.isReleased();
  release.activeCount = () => sourceBorrow.activeCount() + (pair.isReleased() ? 0 : 1);
  return release;
}

function withCanonicalParticleExactMassBorrow(sourceBorrow, canonicalRead) {
  if (!canonicalRead) return sourceBorrow;
  let canonicalReleased = false;
  const release = () => {
    if (!canonicalReleased) {
      canonicalReleased = true;
      void canonicalRead.release();
    }
    const buffersReleased = sourceBorrow.isReleased() || sourceBorrow();
    return buffersReleased;
  };
  release.canRelease = () => !canonicalReleased && sourceBorrow.canRelease();
  release.releaseQueueOrdered = () => {
    if (!release.canRelease()) return false;
    return release();
  };
  release.isReleased = () => canonicalReleased && sourceBorrow.isReleased();
  release.activeCount = () => sourceBorrow.activeCount() + (canonicalReleased ? 0 : 1);
  return release;
}

function prepareCaloricBuffers(device, slot, records) {
  if (!slot.caloricRowsBuffer) {
    const raw = device.createBuffer({ label: `${slot.label}-caloric-cells`,
      size: alignedBytes(slot.capacity * 8 * FLOAT32_BYTES),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST });
    slot.caloricBuffers.push(raw);
    slot.caloricRowsBuffer = tagWebGpuBufferDevice(raw, device);
  }
  if (!slot.caloricTableBuffer || slot.caloricTableByteLength !== records.byteLength) {
    // This slot has no previous live consumer. Register the new allocation
    // before tagging and retain any failed setup for the same arena cleanup.
    const raw = device.createBuffer({ label: `${slot.label}-caloric-materials`,
      size: records.byteLength, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
    slot.caloricBuffers.push(raw);
    const buffer = tagWebGpuBufferDevice(raw, device);
    if (slot.caloricTableBuffer) {
      destroyBufferOnce(slot, slot.caloricTableBuffer);
      slot.caloricBuffers = slot.caloricBuffers.filter((entry) => entry !== slot.caloricTableBuffer);
    }
    slot.caloricTableBuffer = buffer;
    slot.caloricTableByteLength = records.byteLength;
  }
  device.queue.writeBuffer(slot.caloricTableBuffer, 0, records);
}

function rejectedExecution(status, reason, extra = {}) {
  return {
    schema: ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA,
    status,
    reason,
    ready: false,
    selected: false,
    backend: 'webgpu-rejected',
    failClosed: true,
    normalHotLoopReadbackFree: true,
    mapAsyncCount: 0,
    hostMaterializedRowCount: 0,
    queueCompletionFenceWaited: false,
    ...extra
  };
}

function normalizeEpochIdentity(epochIdentity = null) {
  try {
    return {
      storageGeneration: exactU32(
        epochIdentity?.storageGeneration,
        'epochIdentity.storageGeneration',
        { positive: true }
      ),
      physicsTick: exactU32(epochIdentity?.physicsTick, 'epochIdentity.physicsTick'),
      physicsSubstep: exactU32(
        epochIdentity?.physicsSubstep,
        'epochIdentity.physicsSubstep'
      ),
      positionEpoch: exactU32(
        epochIdentity?.positionEpoch,
        'epochIdentity.positionEpoch'
      ),
      topologyEpoch: exactU32(
        epochIdentity?.topologyEpoch,
        'epochIdentity.topologyEpoch'
      ),
      chartEpoch: exactU32(epochIdentity?.chartEpoch, 'epochIdentity.chartEpoch'),
      levelEpoch: exactU32(epochIdentity?.levelEpoch, 'epochIdentity.levelEpoch'),
      supportEpoch: exactU32(
        epochIdentity?.supportEpoch,
        'epochIdentity.supportEpoch'
      )
    };
  } catch (error) {
    return { error };
  }
}

function normalizeAuthoritativeSpatialGasGrid(
  spatialGasGrid,
  schroederSpatialEpochGeneration
) {
  try {
    if (
      schroederSpatialEpochGeneration?.ready !== true
      || schroederSpatialEpochGeneration?.selected !== true
    ) {
      throw new TypeError(
        'retained gas EOS requires one live selected Schroeder generation'
      );
    }
    const levelViews = Array.isArray(
      schroederSpatialEpochGeneration.mechanicsLevelViews
    )
      ? schroederSpatialEpochGeneration.mechanicsLevelViews
      : [];
    if (levelViews.length < 1 || levelViews.length > 6) {
      throw new RangeError(
        'retained gas EOS supports one through six mechanics levels'
      );
    }
    const selected = levelViews[levelViews.length - 1];
    const field = selected?.mechanicsFieldView;
    const gridDims = Array.from(spatialGasGrid?.gridDims || []);
    const fieldGridDims = Array.from(field?.gridDims || []);
    const gridNodeCount = exactU32(
      spatialGasGrid?.gridNodeCount,
      'spatialGasGrid.gridNodeCount',
      { positive: true }
    );
    const gridShift = exactU32(
      spatialGasGrid?.gridShift,
      'spatialGasGrid.gridShift'
    );
    const gridSpacingM = positiveFiniteF32(
      spatialGasGrid?.gridSpacingM,
      'spatialGasGrid.gridSpacingM'
    );
    const selectedLevel = Number(spatialGasGrid?.selectedLevel);
    if (
      gridDims.length !== 3
      || gridDims.some((value) => (
        !Number.isSafeInteger(value) || value < 1
      ))
      || gridDims.reduce((product, value) => product * value, 1)
        !== gridNodeCount
      || fieldGridDims.length !== 3
      || fieldGridDims.some((value, axis) => value !== gridDims[axis])
      || field?.gridNodeCount !== gridNodeCount
      || field?.gridShift !== gridShift
      || !Object.is(Math.fround(field?.gridSpacingM), gridSpacingM)
      || field?.selectedLevel !== selectedLevel
      || selected?.selectedLevel !== selectedLevel
    ) {
      throw new TypeError(
        'spatialGasGrid must be the exact selected mechanics occupancy grid'
      );
    }
    return Object.freeze({
      selectedLevel,
      gridDims: Object.freeze(gridDims),
      gridNodeCount,
      gridShift,
      gridSpacingM,
      levelCount: levelViews.length
    });
  } catch (error) {
    return { error };
  }
}

async function normalizeProductEventSource({
  device,
  retainedProductEventSource = null,
  residentProductMass = null,
  productEventBuffer = null,
  productEventRowCount = null,
  productEventStrideFloats = null
}) {
  const source = retainedProductEventSource || residentProductMass || null;
  const buffer = productEventBuffer || source?.productEventBuffer || null;
  let exactHistoryLayout = null;
  if (source && 'exactProductHistoryLayout' in source) {
    const history = await import('./sphMlsMpmGpuStep.js');
    exactHistoryLayout = history.resolveResidentProductExactHistoryLayout(source, { device });
  } else {
    assertSphLegacyMassPathAllowed({ productEventBuffer: buffer }, 'Spatial gas product events');
  }
  const advertised = Boolean(
    source
    || productEventBuffer
    || productEventRowCount != null
    || productEventStrideFloats != null
  );
  if (!advertised) {
    return {
      present: false,
      source: null,
      buffer: null,
      rowCount: 0,
      strideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
      requiredBytes: 0,
      liveCountDescriptor: null,
      liveRowCountUpperBound: 0
    };
  }
  const rowCount = Number(
    productEventRowCount ?? source?.productEventRowCount
  );
  const strideFloats = Number(
    productEventStrideFloats ?? source?.productEventStrideFloats
      ?? SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
  );
  if (!source || source.productEventBufferRetained !== true) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-unretained-source',
        'A retained product-event source is required'
      )
    };
  }
  if (!buffer || buffer !== source.productEventBuffer) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-buffer',
        'The exact retained product-event buffer was not provided'
      )
    };
  }
  if (
    !Number.isInteger(rowCount)
    || rowCount < 1
    || rowCount > MAX_EXACT_F32_INTEGER
  ) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-count',
        `Product-event row count must be in [1, ${MAX_EXACT_F32_INTEGER}]`,
        { productEventRowCount: Number.isFinite(rowCount) ? rowCount : null }
      )
    };
  }
  const expectedStride = exactHistoryLayout?.rowWords ?? SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS;
  if (strideFloats !== expectedStride) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-stride',
        `Product-event stride must be ${expectedStride} words`,
        { productEventStrideFloats: strideFloats }
      )
    };
  }
  const requiredBytes = rowCount * strideFloats * FLOAT32_BYTES;
  if (
    Number.isFinite(Number(buffer.size))
    && Number(buffer.size) < requiredBytes
  ) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-byte-length',
        `Product-event buffer has ${buffer.size} bytes; ${requiredBytes} required`,
        { requiredProductEventByteLength: requiredBytes }
      )
    };
  }
  if (
    Number.isFinite(Number(buffer.usage))
    && (Number(buffer.usage) & GPU_BUFFER_USAGE.STORAGE) === 0
  ) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-usage',
        'The retained product-event buffer is not storage-bindable'
      )
    };
  }
  if (
    Number.isFinite(Number(device?.limits?.maxStorageBufferBindingSize))
    && requiredBytes > Number(device.limits.maxStorageBufferBindingSize)
  ) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-binding-size',
        `Product-event binding requires ${requiredBytes} bytes beyond maxStorageBufferBindingSize`,
        { requiredProductEventByteLength: requiredBytes }
      )
    };
  }
  const mismatch = webGpuDeviceMismatchInfo({
    buffer,
    residentProductMass: source,
    device
  });
  const sourceDevice = residentProductMassDevice(source)
    || webGpuBufferDevice(buffer)
    || source.productEventDevice
    || null;
  if (mismatch.mismatch || sourceDevice !== device) {
    return {
      error: rejectedExecution(
        sourceDevice
          ? 'spatial-gas-ledger-eos-rejected-cross-device-source'
          : 'spatial-gas-ledger-eos-rejected-unknown-source-device',
        sourceDevice
          ? 'The retained product-event source belongs to another WebGPU device'
          : 'The retained product-event source has no exact WebGPU device provenance',
        {
          sourceDeviceId: sourceDevice ? webGpuDeviceId(sourceDevice) : null,
          consumerDeviceId: webGpuDeviceId(device)
        }
      )
    };
  }
  const liveCountDescriptor = productEventLiveCountCopyDescriptor(
    source,
    device
  );
  if (
    (
      source.productEventLiveCountAuthority
      || residentProductEventCountAuthorityRegistered(source)
    )
    && !liveCountDescriptor
  ) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-torn-live-count-authority',
        'The retained product-event source has a torn GPU live-count authority'
      )
    };
  }
  if (
    liveCountDescriptor
    && (
      !validateProductEventLiveCountCopyDescriptor(liveCountDescriptor, {
        handle: source,
        device
      })
      || liveCountDescriptor.controlBuffer !== liveCountDescriptor.buffer
      || liveCountDescriptor.controlPrefixByteLength
        !== SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES
      || liveCountDescriptor.expectedMagic
        !== SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_MAGIC
      || liveCountDescriptor.expectedVersion
        !== SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_VERSION
      || liveCountDescriptor.expectedReadyStatus
        !== SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY
      || liveCountDescriptor.expectedFailedStatus
        !== SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED
      || liveCountDescriptor.expectedGeneration
        !== liveCountDescriptor.generation
      || liveCountDescriptor.expectedSeal !== liveCountDescriptor.seal
      || liveCountDescriptor.expectedRowCapacity
        !== liveCountDescriptor.rowCapacity
      || liveCountDescriptor.expectedRowStrideVec4 * 4
        !== liveCountDescriptor.rowStrideFloats
      || liveCountDescriptor.hostObserved !== false
      || liveCountDescriptor.rowCapacity !== rowCount
      || liveCountDescriptor.rowStrideFloats !== strideFloats
      || liveCountDescriptor.expectedRowCapacity !== rowCount
      || liveCountDescriptor.expectedRowStrideVec4 !== strideFloats / 4
      || !Number.isInteger(liveCountDescriptor.controlOffsetBytes)
      || liveCountDescriptor.controlOffsetBytes < 0
      || Number(liveCountDescriptor.controlBuffer?.size)
        < liveCountDescriptor.controlOffsetBytes
          + SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES
      || (
        Number.isFinite(Number(liveCountDescriptor.controlBuffer?.usage))
        && (
          Number(liveCountDescriptor.controlBuffer.usage)
          & GPU_BUFFER_USAGE.COPY_SRC
        ) === 0
      )
    )
  ) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-live-count-abi',
        'The GPU live-count authority does not match the retained product-event capacity and row ABI'
      )
    };
  }
  if (!Object.hasOwn(source, '__ulgActiveBorrowCount')) {
    return {
      error: rejectedExecution(
        'spatial-gas-ledger-eos-rejected-source-lifecycle',
        'The retained product-event source does not expose its exact consumer-borrow lifecycle'
      )
    };
  }
  const declaredLiveRowCountUpperBound = Number(
    source.productEventLiveRowCountUpperBound
  );
  const liveRowCountUpperBound =
    liveCountDescriptor
    && Number.isInteger(declaredLiveRowCountUpperBound)
    && declaredLiveRowCountUpperBound >= 1
      ? Math.min(rowCount, declaredLiveRowCountUpperBound)
      : rowCount;
  return {
    present: true,
    source,
    buffer,
    rowCount,
    strideFloats,
    requiredBytes,
    liveCountDescriptor,
    liveRowCountUpperBound,
    exactHistoryLayout
  };
}

function normalizeParticleSource({
  device,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  particleStateBuffer = null,
  particleThermoBuffer = null,
  particleCount = null,
  particleStateStrideFloats = null,
  particleThermoStrideFloats = null,
  schroederSpatialEpochGeneration = null,
  schroederLevelAssignment = null,
  deferLifecycleToCurrentPair = false
}) {
  const advertised = Boolean(
    sphParticleUpload
    || particleStateBuffer
    || particleThermoBuffer
    || particleCount != null
    || particleStateStrideFloats != null
    || particleThermoStrideFloats != null
  );
  if (!advertised) {
    return {
      present: false,
      source: null,
      stateBuffer: null,
      thermoBuffer: null,
      particleCount: 0,
      stateStrideFloats: SPH_PARTICLE_STATE_STRIDE_FLOATS,
      thermoStrideFloats: SPH_PARTICLE_THERMO_STRIDE_FLOATS,
      stateRequiredBytes: 0,
      thermoRequiredBytes: 0
    };
  }
  const source = sphParticleUpload;
  const stateBuffer = particleStateBuffer || source?.stateBuffer || null;
  const thermoBuffer = particleThermoBuffer || source?.thermoBuffer || null;
  const count = Number(particleCount ?? source?.particleCount);
  const stateStrideFloats = Number(
    particleStateStrideFloats
      ?? (Number.isFinite(Number(source?.stateStrideBytes))
        ? Number(source.stateStrideBytes) / FLOAT32_BYTES
        : SPH_PARTICLE_STATE_STRIDE_FLOATS)
  );
  const thermoStrideFloats = Number(
    particleThermoStrideFloats
      ?? (Number.isFinite(Number(source?.thermoStrideBytes))
        ? Number(source.thermoStrideBytes) / FLOAT32_BYTES
        : SPH_PARTICLE_THERMO_STRIDE_FLOATS)
  );
  const reject = (status, reason, extra = {}) => ({
    error: rejectedExecution(status, reason, extra)
  });
  if (
    !source
    || source.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || source.status !== 'webgpu-uploaded'
    || source.destroyed === true
  ) {
    return reject(
      'spatial-gas-ledger-eos-rejected-particle-source',
      'An exact live SPH particle-buffer-set source is required'
    );
  }
  if (
    !stateBuffer
    || !thermoBuffer
    || stateBuffer !== source.stateBuffer
    || thermoBuffer !== source.thermoBuffer
  ) {
    return reject(
      'spatial-gas-ledger-eos-rejected-particle-source-buffer',
      'The exact retained SPH state and thermo buffers were not provided'
    );
  }
  if (stateBuffer === thermoBuffer) {
    return reject(
      'spatial-gas-ledger-eos-rejected-particle-buffer-alias',
      'Particle state and thermo buffers must be distinct exact ABI families'
    );
  }
  if (
    !Number.isInteger(count)
    || count < 1
    || count > MAX_EXACT_F32_INTEGER
  ) {
    return reject(
      'spatial-gas-ledger-eos-rejected-particle-count',
      `Particle count must be in [1, ${MAX_EXACT_F32_INTEGER}]`,
      { particleCount: Number.isFinite(count) ? count : null }
    );
  }
  if (
    stateStrideFloats !== SPH_PARTICLE_STATE_STRIDE_FLOATS
    || thermoStrideFloats !== SPH_PARTICLE_THERMO_STRIDE_FLOATS
    || source.stateStrideBytes
      !== SPH_PARTICLE_STATE_STRIDE_FLOATS * FLOAT32_BYTES
    || source.thermoStrideBytes
      !== SPH_PARTICLE_THERMO_STRIDE_FLOATS * FLOAT32_BYTES
  ) {
    return reject(
      'spatial-gas-ledger-eos-rejected-particle-stride',
      `Particle state/thermo strides must be ${SPH_PARTICLE_STATE_STRIDE_FLOATS}/${SPH_PARTICLE_THERMO_STRIDE_FLOATS} floats`,
      { particleStateStrideFloats: stateStrideFloats,
        particleThermoStrideFloats: thermoStrideFloats }
    );
  }
  const stateRequiredBytes = count * stateStrideFloats * FLOAT32_BYTES;
  const thermoRequiredBytes = count * thermoStrideFloats * FLOAT32_BYTES;
  for (const [name, buffer, requiredBytes, declaredBytes] of [
    ['state', stateBuffer, stateRequiredBytes, source.stateBufferByteLength],
    ['thermo', thermoBuffer, thermoRequiredBytes, source.thermoBufferByteLength]
  ]) {
    const exactDeclaredBytes = Number(declaredBytes);
    const strideBytes = name === 'state'
      ? stateStrideFloats * FLOAT32_BYTES
      : thermoStrideFloats * FLOAT32_BYTES;
    if (
      !Number.isSafeInteger(exactDeclaredBytes)
      || exactDeclaredBytes < requiredBytes
      || exactDeclaredBytes % strideBytes !== 0
      || (
        Number.isFinite(Number(buffer.size))
        && Number(buffer.size) < exactDeclaredBytes
      )
    ) {
      return reject(
        'spatial-gas-ledger-eos-rejected-particle-byte-length',
        `Particle ${name} buffer cannot expose its exact live ABI prefix from the declared allocation`,
        {
          particleBufferFamily: name,
          requiredParticleByteLength: requiredBytes,
          declaredParticleByteLength: Number.isFinite(exactDeclaredBytes)
            ? exactDeclaredBytes
            : null
        }
      );
    }
    if (
      Number.isFinite(Number(buffer.usage))
      && (Number(buffer.usage) & GPU_BUFFER_USAGE.STORAGE) === 0
    ) {
      return reject(
        'spatial-gas-ledger-eos-rejected-particle-usage',
        `Particle ${name} buffer is not storage-bindable`,
        { particleBufferFamily: name }
      );
    }
    if (
      Number.isFinite(Number(device?.limits?.maxStorageBufferBindingSize))
      && requiredBytes > Number(device.limits.maxStorageBufferBindingSize)
    ) {
      return reject(
        'spatial-gas-ledger-eos-rejected-particle-binding-size',
        `Particle ${name} binding exceeds maxStorageBufferBindingSize`,
        { particleBufferFamily: name, requiredParticleByteLength: requiredBytes }
      );
    }
    if (webGpuBufferDevice(buffer) !== device) {
      const sourceDevice = webGpuBufferDevice(buffer);
      return reject(
        sourceDevice
          ? 'spatial-gas-ledger-eos-rejected-cross-device-particle-source'
          : 'spatial-gas-ledger-eos-rejected-unknown-particle-source-device',
        sourceDevice
          ? `Particle ${name} buffer belongs to another WebGPU device`
          : `Particle ${name} buffer has no exact WebGPU device provenance`,
        {
          particleBufferFamily: name,
          sourceDeviceId: sourceDevice ? webGpuDeviceId(sourceDevice) : null,
          consumerDeviceId: webGpuDeviceId(device)
        }
      );
    }
  }
  if (!validateSchroederSpatialEpochGenerationLevelAssignment(
    schroederSpatialEpochGeneration,
    {
      device,
      levelAssignment: schroederLevelAssignment,
      sphParticleUpload: source,
      mlsMpmParticleUpload
    }
  )) {
    return reject(
      'spatial-gas-ledger-eos-rejected-particle-generation',
      'Particle state/thermo buffers are not the exact source of the selected spatial generation'
    );
  }
  try {
    if (!deferLifecycleToCurrentPair && !ensureSphGpuParticleBufferSetBorrowLifecycle(source)) {
      return reject(
        'spatial-gas-ledger-eos-rejected-particle-source-lifecycle',
        'Particle source cannot publish the required retained borrow lifecycle'
      );
    }
  } catch {
    return reject(
      'spatial-gas-ledger-eos-rejected-particle-source-lifecycle',
      'Particle source cannot publish the required retained borrow lifecycle'
    );
  }
  return {
    present: true,
    source,
    stateBuffer,
    thermoBuffer,
    particleCount: count,
    stateStrideFloats,
    thermoStrideFloats,
    stateRequiredBytes,
    thermoRequiredBytes
  };
}

function adapterParams({
  rowCount,
  sourceCapacity,
  strideFloats,
  productSourcePresent,
  productCandidateCapacity,
  particleCount,
  particleStateStrideFloats,
  particleThermoStrideFloats,
  candidateCount,
  cellSizeM,
  chartId,
  level,
  executionGeneration,
  fallbackTemperatureK,
  liveCountDescriptor = null,
  requireCompleteOccupancy = false
}) {
  const expectedMagic = liveCountDescriptor?.expectedMagic
    ?? SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_MAGIC;
  const expectedVersion = liveCountDescriptor?.expectedVersion
    ?? SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_VERSION;
  const expectedReadyStatus = liveCountDescriptor?.expectedReadyStatus
    ?? SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY;
  const expectedFailedStatus = liveCountDescriptor?.expectedFailedStatus
    ?? SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED;
  const expectedGeneration = liveCountDescriptor?.expectedGeneration ?? 1;
  const expectedSeal = liveCountDescriptor?.expectedSeal ?? 1;
  const expectedRowCapacity = liveCountDescriptor?.expectedRowCapacity
    ?? rowCount;
  const expectedRowStrideVec4 = liveCountDescriptor?.expectedRowStrideVec4
    ?? strideFloats / 4;
  const data = new ArrayBuffer(PARAMS_BUFFER_BYTES);
  const view = new DataView(data);
  // The first eight words are a queue-ordered copy destination for the exact
  // resident product-history control prefix. Legacy retained sources start
  // with an equivalent host-count prefix and do not claim GPU count authority.
  view.setUint32(0, expectedMagic, true);
  view.setUint32(4, expectedVersion, true);
  view.setUint32(8, expectedReadyStatus, true);
  view.setUint32(12, rowCount, true);
  view.setUint32(16, expectedRowCapacity, true);
  view.setUint32(20, expectedRowStrideVec4, true);
  view.setUint32(24, expectedGeneration, true);
  view.setUint32(28, expectedSeal, true);
  view.setUint32(32, expectedMagic, true);
  view.setUint32(36, expectedVersion, true);
  view.setUint32(40, expectedReadyStatus, true);
  view.setUint32(44, expectedFailedStatus, true);
  view.setUint32(48, expectedGeneration, true);
  view.setUint32(52, expectedSeal, true);
  view.setUint32(56, expectedRowCapacity, true);
  view.setUint32(60, expectedRowStrideVec4, true);
  view.setUint32(64, sourceCapacity, true);
  view.setUint32(68, strideFloats, true);
  view.setUint32(72, SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS, true);
  view.setUint32(76, SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS, true);
  view.setUint32(80, executionGeneration, true);
  view.setUint32(84, chartId, true);
  view.setInt32(88, level, true);
  view.setFloat32(92, cellSizeM, true);
  view.setFloat32(96, fallbackTemperatureK, true);
  view.setUint32(100, productSourcePresent ? 1 : 0, true);
  view.setUint32(104, productCandidateCapacity, true);
  view.setUint32(108, particleCount, true);
  view.setUint32(112, particleStateStrideFloats, true);
  view.setUint32(116, particleThermoStrideFloats, true);
  view.setUint32(120, candidateCount, true);
  view.setUint32(124, requireCompleteOccupancy ? 1 : 0, true);
  return new Uint8Array(data);
}

function initialAuthorityControl({
  executionGeneration,
  storageGeneration,
  sourceCapacity,
  gasControlVolumeDescriptor
}) {
  const words = new Uint32Array(SPH_SPATIAL_GAS_AUTHORITY_CONTROL_WORDS);
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.MAGIC] =
    SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.VERSION] =
    SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.STATUS_FLAGS] =
    SPH_SPATIAL_GAS_AUTHORITY_STATUS.INITIALIZED;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.EXECUTION_GENERATION] =
    executionGeneration;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.SOURCE_STORAGE_GENERATION] =
    storageGeneration;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.SOURCE_CAPACITY] =
    sourceCapacity;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.COMPACT_STRIDE] =
    SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.ACTIVE_NODE_STRIDE] =
    SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.PRESSURE_STRIDE] =
    SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.PROJECTION_VERSION] =
    gasControlVolumeDescriptor.version;
  words[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.CONTROL_VOLUME_GEOMETRY_SEAL] =
    gasControlVolumeDescriptor.seal;
  return words;
}

function eosParams({
  sourceCapacity,
  executionGeneration,
  generation,
  gasFreeVolume,
  gasConstantJPerMolK,
  cellSizeM,
  fallbackTemperatureK,
  chartId,
  level,
  gasControlVolumeDescriptor
}) {
  const execution = generation.execution;
  const layout = execution.layout;
  const data = new ArrayBuffer(PARAMS_BUFFER_BYTES);
  const view = new DataView(data);
  view.setUint32(0, sourceCapacity, true);
  view.setUint32(4, SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS, true);
  view.setUint32(8, SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS, true);
  view.setUint32(12, execution.generationId, true);
  view.setUint32(16, layout.wordLength, true);
  view.setUint32(20, layout.cellCapacity, true);
  view.setUint32(24, layout.cellKeysOffsetWords, true);
  view.setUint32(28, layout.cellOffsetsOffsetWords, true);
  view.setUint32(32, layout.cellMembersOffsetWords, true);
  view.setUint32(36, layout.particleToCellOffsetWords, true);
  view.setUint32(40, chartId, true);
  view.setUint32(44, signedOrderKey(level), true);
  view.setFloat32(48, gasConstantJPerMolK, true);
  view.setFloat32(52, cellSizeM, true);
  view.setFloat32(56, fallbackTemperatureK, true);
  view.setUint32(60, executionGeneration, true);
  view.setUint32(64, gasFreeVolume.gasFreeVolumeGeneration, true);
  view.setUint32(68, gasFreeVolume.sourceGeneration, true);
  view.setUint32(72, gasFreeVolume.directoryGeneration, true);
  view.setUint32(76, gasFreeVolume.storageGeneration, true);
  view.setUint32(80, gasFreeVolume.gasFreeVolumeCellCapacity, true);
  view.setUint32(84, gasFreeVolume.gasFreeVolumeRowStrideFloats, true);
  gasControlVolumeDescriptor.boundsWords.forEach((word, index) => {
    view.setUint32(88 + index * 4, word, true);
  });
  view.setUint32(136, gasControlVolumeDescriptor.version, true);
  view.setUint32(140, gasControlVolumeDescriptor.seal, true);
  view.setInt32(144, gasControlVolumeDescriptor.gridShift, true);
  gasControlVolumeDescriptor.gridDims.forEach((dimension, axis) => {
    view.setUint32(148 + axis * 4, dimension, true);
  });
  view.setUint32(160, gasControlVolumeDescriptor.gridNodeCount, true);
  if (gasFreeVolume.aerosol) {
    view.setUint32(164, 1, true);
    view.setUint32(168, gasFreeVolume.aerosol.familyId, true);
    view.setUint32(172, gasFreeVolume.aerosol.generation, true);
    view.setUint32(176, gasFreeVolume.aerosol.capacity, true);
    view.setUint32(180, gasFreeVolume.aerosol.version, true);
  }
  return new Uint8Array(data);
}

export const sphSpatialGasLedgerCandidateUnionAdapterWgsl = /* wgsl */ `
struct SpatialGasAdapterParams {
  product_history_magic: u32,
  product_history_version: u32,
  product_history_status: u32,
  source_row_count: u32,
  product_history_row_capacity: u32,
  product_history_row_stride_vec4: u32,
  product_history_generation: u32,
  product_history_seal: u32,
  expected_product_history_magic: u32,
  expected_product_history_version: u32,
  expected_product_history_ready_status: u32,
  expected_product_history_failed_status: u32,
  expected_product_history_generation: u32,
  expected_product_history_seal: u32,
  expected_product_history_row_capacity: u32,
  expected_product_history_row_stride_vec4: u32,
  source_capacity: u32,
  product_event_stride: u32,
  compact_stride: u32,
  active_node_stride: u32,
  execution_generation: u32,
  chart_id: u32,
  level: i32,
  cell_size_m: f32,
  fallback_temperature_k: f32,
  product_source_present: u32,
  product_candidate_capacity: u32,
  particle_count: u32,
  particle_state_stride: u32,
  particle_thermo_stride: u32,
  candidate_count: u32,
  require_complete_occupancy: u32,
};

@group(0) @binding(0) var<storage, read> product_events: array<f32>;
@group(0) @binding(1) var<storage, read_write> candidate_flags: array<u32>;
@group(0) @binding(2) var<storage, read> candidate_offsets: array<u32>;
@group(0) @binding(3) var<storage, read_write> compact_rows: array<f32>;
@group(0) @binding(4) var<storage, read_write> active_nodes: array<f32>;
@group(0) @binding(5) var<storage, read_write> authority: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> params: SpatialGasAdapterParams;
@group(0) @binding(7) var<storage, read> particle_state: array<f32>;
@group(0) @binding(8) var<storage, read> particle_thermo: array<f32>;

const CONTROL_MAGIC: u32 = 0x53474133u;
const CONTROL_VERSION: u32 = ${SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION}u;
const STATUS_INITIALIZED: u32 = 1u;
const STATUS_COMPACT_READY: u32 = 2u;
const STATUS_EMPTY: u32 = 32u;
const STATUS_FAILED: u32 = 0x80000000u;
const ERROR_INVALID_CANDIDATE: u32 = 1u;
const ERROR_CONSERVATION: u32 = 2u;
const ERROR_COMPACTION_OVERFLOW: u32 = 4u;
const ERROR_PRODUCT_HISTORY_AUTHORITY_INVALID: u32 = 512u;
const AVOGADRO_ENTITIES_PER_MOL: f32 = 6.02214076e23;
const PARTICLE_PHASE_GAS: f32 = 3.0;
const PARTICLE_PHASE_FRACTION_TOLERANCE: f32 = 1.0e-5;

fn finite_f32(value: f32) -> bool {
  return (bitcast<u32>(value) & 0x7f800000u) != 0x7f800000u;
}

fn product_history_authority_ready() -> bool {
  return params.product_source_present == 0u || (
    params.product_history_magic
      == params.expected_product_history_magic
    && params.product_history_version
      == params.expected_product_history_version
    && params.product_history_status
      == params.expected_product_history_ready_status
    && (
      params.product_history_status
      & params.expected_product_history_failed_status
    ) == 0u
    && params.source_row_count <= params.product_history_row_capacity
    && params.product_history_row_capacity
      == params.expected_product_history_row_capacity
    && params.product_history_row_stride_vec4
      == params.expected_product_history_row_stride_vec4
    && params.product_history_generation
      == params.expected_product_history_generation
    && params.product_history_seal == params.expected_product_history_seal
  );
}

fn zero_publication_outputs() {
  atomicStore(&authority[5u], 0u);
  atomicStore(&authority[8u], 0u);
  atomicStore(&authority[9u], 0u);
  atomicStore(&authority[10u], 0u);
  atomicStore(&authority[11u], 0u);
  for (var word = 16u; word < 28u; word = word + 1u) {
    atomicStore(&authority[word], 0u);
  }
  atomicStore(&authority[31u], 0u);
}

@compute @workgroup_size(64)
fn classify_gas_candidates(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate_index = global_id.x;
  if (candidate_index >= params.source_capacity) {
    return;
  }
  candidate_flags[candidate_index] = 0u;
  if (!product_history_authority_ready()) {
    atomicOr(
      &authority[3u],
      ERROR_PRODUCT_HISTORY_AUTHORITY_INVALID
    );
    return;
  }
  if (candidate_index >= params.candidate_count) { return; }
  if (candidate_index >= params.product_candidate_capacity) {
    let particle_index = candidate_index - params.product_candidate_capacity;
    if (particle_index >= params.particle_count) { return; }
    let state = particle_index * params.particle_state_stride;
    let thermo = particle_index * params.particle_thermo_stride;
    let mass = particle_state[state + 3u];
    // A fixed-capacity row may retain its former phase after its inventory is
    // consumed. Exactly zero mass owns no gas moles or volume, so it is inert
    // regardless of historical status. Negative/non-finite masses still
    // reach the gas-indication validation below and fail closed.
    if (finite_f32(mass) && mass == 0.0) { return; }
    let phase = particle_thermo[thermo + 1u];
    let solid_fraction = particle_thermo[thermo + 4u];
    let liquid_fraction = particle_thermo[thermo + 5u];
    let gas_fraction = particle_thermo[thermo + 6u];
    let plasma_fraction = particle_thermo[thermo + 7u];
    let status = particle_thermo[thermo + 10u];
    let gas_phase_declared = finite_f32(phase)
      && phase > PARTICLE_PHASE_GAS - 0.5
      && phase < PARTICLE_PHASE_GAS + 0.5;
    let one_hot_gas_fraction_declared = finite_f32(solid_fraction)
      && abs(solid_fraction) <= PARTICLE_PHASE_FRACTION_TOLERANCE
      && finite_f32(liquid_fraction)
      && abs(liquid_fraction) <= PARTICLE_PHASE_FRACTION_TOLERANCE
      && finite_f32(gas_fraction)
      && abs(gas_fraction - 1.0) <= PARTICLE_PHASE_FRACTION_TOLERANCE
      && finite_f32(plasma_fraction)
      && abs(plasma_fraction) <= PARTICLE_PHASE_FRACTION_TOLERANCE;
    if (!gas_phase_declared && !one_hot_gas_fraction_declared) { return; }
    let position = vec3<f32>(
      particle_state[state + 0u],
      particle_state[state + 1u],
      particle_state[state + 2u]
    );
    let material_id = particle_thermo[thermo + 0u];
    let temperature = particle_thermo[thermo + 2u];
    let rest_density = particle_thermo[thermo + 3u];
    let represented_entities = particle_thermo[thermo + 9u];
    let active_status = finite_f32(status) && status > 0.5 && status < 3.5;
    let pure_gas = gas_phase_declared
      && finite_f32(solid_fraction)
      && abs(solid_fraction) <= PARTICLE_PHASE_FRACTION_TOLERANCE
      && finite_f32(liquid_fraction)
      && liquid_fraction >= -PARTICLE_PHASE_FRACTION_TOLERANCE
      && finite_f32(gas_fraction)
      && gas_fraction > PARTICLE_PHASE_FRACTION_TOLERANCE
      && abs(liquid_fraction + gas_fraction - 1.0) <= PARTICLE_PHASE_FRACTION_TOLERANCE
      && finite_f32(plasma_fraction)
      && abs(plasma_fraction) <= PARTICLE_PHASE_FRACTION_TOLERANCE;
    let particle_valid = pure_gas && active_status
      && all(vec3<bool>(
        finite_f32(position.x),
        finite_f32(position.y),
        finite_f32(position.z)
      ))
      && finite_f32(mass) && mass > 0.0
      && finite_f32(material_id) && material_id > 0.0
      && finite_f32(temperature) && temperature > 0.0
      && finite_f32(rest_density) && rest_density > 0.0
      && finite_f32(represented_entities) && represented_entities > 0.0;
    if (!particle_valid) {
      atomicOr(&authority[3u], ERROR_INVALID_CANDIDATE);
      atomicAdd(&authority[12u], 1u);
      return;
    }
    candidate_flags[candidate_index] = 1u;
    return;
  }
  let row_index = candidate_index;
  if (params.product_source_present == 0u) { return; }
  if (row_index >= params.source_row_count) { return; }
  let source = row_index * params.product_event_stride;
  let routing = product_events[source + 10u];
  let source_status = product_events[source + 18u];
  let gas_routed_ready = finite_f32(routing)
    && routing > 0.5 && routing < 1.5
    && finite_f32(source_status) && source_status > 0.5;
  if (!gas_routed_ready) {
    // Current-stage free volume includes carrier V0*J and retained parcels,
    // but not independent unplaced condensed products. Reject that domain;
    // silently omitting its occupied volume would overstate the gas space.
    if (params.require_complete_occupancy != 0u) {
      let residual_mass = product_events[source + 13u];
      if (!finite_f32(residual_mass) || residual_mass != 0.0) {
        atomicOr(&authority[3u], ERROR_INVALID_CANDIDATE);
        atomicAdd(&authority[12u], 1u);
      }
    }
    return;
  }

  let total_mass = product_events[source + 3u];
  let total_moles = product_events[source + 9u];
  let placed_mass = product_events[source + 12u];
  let unplaced_mass = product_events[source + 13u];
  let density = product_events[source + 17u];
  let scalars_valid = finite_f32(total_mass) && total_mass >= 0.0
    && finite_f32(total_moles) && total_moles >= 0.0
    && finite_f32(placed_mass) && placed_mass >= 0.0
    && finite_f32(unplaced_mass) && unplaced_mass >= 0.0
    && finite_f32(density) && density > 0.0;
  if (!scalars_valid) {
    atomicOr(&authority[3u], ERROR_INVALID_CANDIDATE);
    atomicAdd(&authority[12u], 1u);
    return;
  }
  let partition_mass = placed_mass + unplaced_mass;
  let conservation_tolerance = max(1.0e-7, max(total_mass, partition_mass) * 1.0e-4);
  if (
    !finite_f32(partition_mass)
    || !finite_f32(conservation_tolerance)
    || abs(total_mass - partition_mass) > conservation_tolerance
  ) {
    atomicOr(&authority[3u], ERROR_CONSERVATION);
    atomicAdd(&authority[12u], 1u);
    return;
  }
  if (unplaced_mass == 0.0) { return; }

  let position = vec3<f32>(
    product_events[source + 0u],
    product_events[source + 1u],
    product_events[source + 2u]
  );
  let material_id = product_events[source + 4u];
  let product_term = product_events[source + 5u];
  let residual_fraction = unplaced_mass / total_mass;
  let residual_moles = total_moles * residual_fraction;
  let residual_volume = unplaced_mass / density;
  let candidate_valid = total_mass > 0.0 && total_moles > 0.0
    && all(vec3<bool>(
      finite_f32(position.x),
      finite_f32(position.y),
      finite_f32(position.z)
    ))
    && finite_f32(material_id) && material_id > 0.0
    && finite_f32(product_term) && product_term >= 0.0
    && finite_f32(residual_fraction) && residual_fraction > 0.0
    && residual_fraction <= 1.0001
    && finite_f32(residual_moles) && residual_moles > 0.0
    && finite_f32(residual_volume) && residual_volume > 0.0;
  if (!candidate_valid) {
    atomicOr(&authority[3u], ERROR_INVALID_CANDIDATE);
    atomicAdd(&authority[12u], 1u);
    return;
  }
  candidate_flags[candidate_index] = 1u;
}

@compute @workgroup_size(1)
fn finalize_compaction() {
  if (!product_history_authority_ready()) {
    atomicOr(
      &authority[3u],
      ERROR_PRODUCT_HISTORY_AUTHORITY_INVALID
    );
  }
  if (
    atomicLoad(&authority[0u]) != CONTROL_MAGIC
    || atomicLoad(&authority[1u]) != CONTROL_VERSION
    || atomicLoad(&authority[4u]) != params.execution_generation
    || atomicLoad(&authority[7u]) != params.source_capacity
  ) {
    atomicOr(&authority[3u], ERROR_INVALID_CANDIDATE);
  }
  if (
    params.product_source_present != 0u
    && params.source_row_count > params.product_candidate_capacity
  ) {
    atomicOr(&authority[3u], ERROR_COMPACTION_OVERFLOW);
    atomicStore(
      &authority[13u],
      params.source_row_count - params.product_candidate_capacity
    );
  }
  if (
    params.candidate_count > params.source_capacity
    || params.product_candidate_capacity + params.particle_count
      != params.candidate_count
  ) {
    atomicOr(&authority[3u], ERROR_COMPACTION_OVERFLOW);
    atomicStore(
      &authority[13u],
      max(1u, params.candidate_count - min(
        params.candidate_count,
        params.source_capacity
      ))
    );
  }
  var live_count = 0u;
  if (params.source_capacity > 0u) {
    let last = params.source_capacity - 1u;
    live_count = candidate_offsets[last] + candidate_flags[last];
  }
  if (live_count > params.source_capacity) {
    atomicOr(&authority[3u], ERROR_COMPACTION_OVERFLOW);
    atomicStore(&authority[13u], live_count - params.source_capacity);
  }
  let errors = atomicLoad(&authority[3u]);
  if (errors != 0u) {
    zero_publication_outputs();
    atomicStore(&authority[2u], STATUS_INITIALIZED | STATUS_FAILED);
    return;
  }
  var status = STATUS_INITIALIZED | STATUS_COMPACT_READY;
  if (live_count == 0u) { status = status | STATUS_EMPTY; }
  atomicStore(&authority[2u], status);
  atomicStore(&authority[8u], live_count);
  let dispatch_x = (live_count + 63u) / 64u;
  atomicStore(&authority[16u], dispatch_x);
  atomicStore(&authority[17u], select(1u, 0u, dispatch_x == 0u));
  atomicStore(&authority[18u], select(1u, 0u, dispatch_x == 0u));
  atomicStore(&authority[19u], dispatch_x);
  atomicStore(&authority[20u], select(1u, 0u, dispatch_x == 0u));
  atomicStore(&authority[21u], select(1u, 0u, dispatch_x == 0u));
}

@compute @workgroup_size(64)
fn scatter_compact_rows(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let source_index = global_id.x;
  if (
    source_index >= params.source_capacity
    || candidate_flags[source_index] == 0u
    || atomicLoad(&authority[3u]) != 0u
    || (atomicLoad(&authority[2u]) & STATUS_COMPACT_READY) == 0u
  ) { return; }
  let output_index = candidate_offsets[source_index];
  let live_count = atomicLoad(&authority[8u]);
  if (output_index >= live_count || output_index >= params.source_capacity) {
    atomicOr(&authority[3u], ERROR_COMPACTION_OVERFLOW);
    atomicAdd(&authority[13u], 1u);
    atomicOr(&authority[2u], STATUS_FAILED);
    atomicStore(&authority[8u], 0u);
    return;
  }
  let compact = output_index * params.compact_stride;
  let active_base = output_index * params.active_node_stride;
  for (var word = 0u; word < params.active_node_stride; word = word + 1u) {
    active_nodes[active_base + word] = 0.0;
  }
  for (var word = 0u; word < params.compact_stride; word = word + 1u) {
    compact_rows[compact + word] = 0.0;
  }

  var position = vec3<f32>(0.0);
  var material_id = 0.0;
  var mass_kg = 0.0;
  var moles = 0.0;
  var temperature_k = params.fallback_temperature_k;
  var support_volume_m3 = 0.0;
  var source_discriminant = -1.0;
  var source_row_index = 0.0;
  var routing = 1.0;
  var source_specific_u = 0.0;
  var source_temperature_k = 0.0;
  var source_phase_id = 0.0;
  if (source_index < params.product_candidate_capacity) {
    let source = source_index * params.product_event_stride;
    let total_mass = product_events[source + 3u];
    let unplaced_mass = product_events[source + 13u];
    let residual_fraction = clamp(unplaced_mass / total_mass, 0.0, 1.0);
    let residual_moles = product_events[source + 9u] * residual_fraction;
    let residual_volume = unplaced_mass / product_events[source + 17u];
    if (
      !finite_f32(residual_fraction) || !(residual_fraction > 0.0)
      || !finite_f32(residual_moles) || !(residual_moles > 0.0)
      || !finite_f32(residual_volume) || !(residual_volume > 0.0)
    ) {
      atomicOr(&authority[3u], ERROR_INVALID_CANDIDATE);
      atomicAdd(&authority[12u], 1u);
      atomicOr(&authority[2u], STATUS_FAILED);
      atomicStore(&authority[8u], 0u);
      return;
    }
    let source_temperature = product_events[source + 16u];
    position = vec3<f32>(
      product_events[source + 0u],
      product_events[source + 1u],
      product_events[source + 2u]
    );
    material_id = product_events[source + 4u];
    mass_kg = unplaced_mass;
    moles = residual_moles;
    temperature_k = select(
      params.fallback_temperature_k,
      source_temperature,
      finite_f32(source_temperature) && source_temperature > 0.0
    );
    support_volume_m3 = residual_volume;
    source_discriminant = product_events[source + 5u];
    source_row_index = f32(source_index);
    routing = product_events[source + 10u];
    source_specific_u = product_events[source + 19u];
    source_temperature_k = source_temperature;
    source_phase_id = product_events[source + 11u];
  } else {
    let particle_index = source_index - params.product_candidate_capacity;
    let state = particle_index * params.particle_state_stride;
    let thermo = particle_index * params.particle_thermo_stride;
    position = vec3<f32>(
      particle_state[state + 0u],
      particle_state[state + 1u],
      particle_state[state + 2u]
    );
    let vapor_fraction = clamp(particle_thermo[thermo + 6u], 0.0, 1.0);
    material_id = particle_thermo[thermo + 0u];
    mass_kg = particle_state[state + 3u] * vapor_fraction;
    moles = (particle_thermo[thermo + 9u] * vapor_fraction) / AVOGADRO_ENTITIES_PER_MOL;
    temperature_k = particle_thermo[thermo + 2u];
    support_volume_m3 = mass_kg / particle_thermo[thermo + 3u];
    source_discriminant = -1.0;
    source_row_index = f32(particle_index);
    routing = 1.0;
    source_specific_u = particle_state[state + 7u];
    source_temperature_k = temperature_k;
    source_phase_id = particle_thermo[thermo + 1u];
    if (
      !finite_f32(moles) || !(moles > 0.0)
      || !finite_f32(support_volume_m3) || !(support_volume_m3 > 0.0)
    ) {
      atomicOr(&authority[3u], ERROR_INVALID_CANDIDATE);
      atomicAdd(&authority[12u], 1u);
      atomicOr(&authority[2u], STATUS_FAILED);
      atomicStore(&authority[8u], 0u);
      return;
    }
  }
  compact_rows[compact + 0u] = position.x;
  compact_rows[compact + 1u] = position.y;
  compact_rows[compact + 2u] = position.z;
  compact_rows[compact + 3u] = material_id;
  compact_rows[compact + 4u] = mass_kg;
  compact_rows[compact + 5u] = moles;
  compact_rows[compact + 6u] = temperature_k;
  compact_rows[compact + 7u] = support_volume_m3;
  compact_rows[compact + 8u] = source_discriminant;
  compact_rows[compact + 9u] = source_row_index;
  compact_rows[compact + 10u] = 1.0;
  compact_rows[compact + 11u] = routing;
  compact_rows[compact + 12u] = source_specific_u;
  compact_rows[compact + 13u] = source_temperature_k;
  compact_rows[compact + 14u] = source_phase_id;

  active_nodes[active_base + 0u] = f32(params.level);
  active_nodes[active_base + 8u] = params.cell_size_m;
  active_nodes[active_base + 10u] = f32(output_index);
  active_nodes[active_base + 11u] = 1.0;
  active_nodes[active_base + 12u] = position.x;
  active_nodes[active_base + 13u] = position.y;
  active_nodes[active_base + 14u] = position.z;
  active_nodes[active_base + 15u] = f32(params.chart_id);
}
`;

// Compatibility export for downstream shader-contract probes authored before
// particle candidates joined the retained source domain.
export const sphSpatialGasLedgerProductEventAdapterWgsl =
  sphSpatialGasLedgerCandidateUnionAdapterWgsl;

function gasLedgerEosWgsl(caloricModule = null) { return /* wgsl */ `
${schroederQuadraticControlVolumeProjectionWgsl}

struct SpatialGasEosParams {
  source_capacity: u32,
  compact_stride: u32,
  pressure_stride: u32,
  directory_generation_id: u32,
  directory_capacity_words: u32,
  cell_capacity: u32,
  cell_keys_offset_words: u32,
  cell_offsets_offset_words: u32,
  cell_members_offset_words: u32,
  particle_to_cell_offset_words: u32,
  chart_id: u32,
  level_order_key: u32,
  gas_constant_j_per_mol_k: f32,
  cell_size_m: f32,
  fallback_temperature_k: f32,
  execution_generation: u32,
  free_volume_generation: u32,
  free_volume_source_generation: u32,
  free_volume_directory_generation: u32,
  free_volume_storage_generation: u32,
  free_volume_cell_capacity: u32,
  free_volume_row_words: u32,
  lower_cell_x: i32,
  lower_fraction_x: f32,
  upper_cell_x: i32,
  upper_fraction_x: f32,
  lower_cell_y: i32,
  lower_fraction_y: f32,
  upper_cell_y: i32,
  upper_fraction_y: f32,
  lower_cell_z: i32,
  lower_fraction_z: f32,
  upper_cell_z: i32,
  upper_fraction_z: f32,
  projection_version: u32,
  geometry_seal: u32,
  grid_shift: i32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  grid_node_count: u32,
  aerosol_enabled: u32,
  aerosol_family_id: u32,
  aerosol_generation: u32,
  aerosol_capacity: u32,
  aerosol_version: u32,
};

@group(0) @binding(0) var<storage, read> compact_rows: array<f32>;
@group(0) @binding(1) var<storage, read> directory: array<u32>;
@group(0) @binding(2) var<storage, read_write> pressure_cells: array<f32>;
@group(0) @binding(3) var<uniform> params: SpatialGasEosParams;
@group(0) @binding(4) var<storage, read_write> authority: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read> gas_free_volume: array<u32>;
@group(0) @binding(6) var<storage, read> gas_free_volume_control: array<u32>;

${sphSpatialGasMixtureMomentsWgsl}
${caloricModule?.sphSpatialGasCaloricAdmissionWgsl ?? ''}

const SPATIAL_MAGIC: u32 = 0x53534531u;
const SPATIAL_VERSION: u32 = 1u;
const SPATIAL_STATUS_READY: u32 = 1u;
const SPATIAL_STATUS_ADMITTED: u32 = 2u;
const SPATIAL_STATUS_REJECT_MASK: u32 = 28u;
const SPATIAL_SORT_LEXICOGRAPHIC: u32 = 2u;
const SPATIAL_ACTIVE_NODE_ADAPTER: u32 = 1u;
const CONTROL_MAGIC: u32 = 0x53474133u;
const CONTROL_VERSION: u32 = ${SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION}u;
const CONTROL_STATUS_INITIALIZED: u32 = 1u;
const CONTROL_STATUS_COMPACT_READY: u32 = 2u;
const CONTROL_STATUS_DIRECTORY_READY: u32 = 4u;
const CONTROL_STATUS_EOS_READY: u32 = 8u;
const CONTROL_STATUS_PRESSURE_READY: u32 = 16u;
const CONTROL_STATUS_EMPTY: u32 = 32u;
const CONTROL_STATUS_FAILED: u32 = 0x80000000u;
const CONTROL_ERROR_DIRECTORY_REJECTED: u32 = 8u;
const CONTROL_ERROR_EOS_INVALID: u32 = 16u;
const CONTROL_ERROR_COUNT_MISMATCH: u32 = 32u;
const CONTROL_ERROR_GENERATION_MISMATCH: u32 = 64u;
const CONTROL_ERROR_FREE_VOLUME_INVALID: u32 = 256u;
const FREE_VOLUME_ROW_STRIDE: u32 = 4u;
const FREE_VOLUME_STATUS_READY: u32 = 1u;
const FREE_VOLUME_STATUS_ADMITTED: u32 = 2u;
const FREE_VOLUME_STATUS_FAIL_CLOSED: u32 = 4u;
const FREE_VOLUME_MAGIC: u32 = 0x53474631u;
const FREE_VOLUME_VERSION: u32 = ${SPH_SPATIAL_GAS_FREE_VOLUME_VERSION}u;

fn finite_f32(value: f32) -> bool {
  return (bitcast<u32>(value) & 0x7f800000u) != 0x7f800000u;
}

fn control_volume_projection_ready() -> bool {
  let bounds = array<u32, 12>(
    bitcast<u32>(params.lower_cell_x), bitcast<u32>(params.lower_fraction_x),
    bitcast<u32>(params.upper_cell_x), bitcast<u32>(params.upper_fraction_x),
    bitcast<u32>(params.lower_cell_y), bitcast<u32>(params.lower_fraction_y),
    bitcast<u32>(params.upper_cell_y), bitcast<u32>(params.upper_fraction_y),
    bitcast<u32>(params.lower_cell_z), bitcast<u32>(params.lower_fraction_z),
    bitcast<u32>(params.upper_cell_z), bitcast<u32>(params.upper_fraction_z)
  );
  return params.projection_version == ${SCHROEDER_QUADRATIC_CONTROL_VOLUME_PROJECTION_VERSION}u
    && atomicLoad(&authority[32u]) == params.projection_version
    && atomicLoad(&authority[33u]) == params.geometry_seal
    && qcv_descriptor_seal(
      params.projection_version,
      params.cell_size_m,
      vec3<i32>(-params.grid_shift),
      vec3<u32>(params.grid_nx, params.grid_ny, params.grid_nz),
      params.grid_node_count,
      params.chart_id,
      bitcast<i32>(params.level_order_key ^ 0x80000000u),
      bounds
    ) == params.geometry_seal;
}

fn authority_identity_ready() -> bool {
  let control_status = atomicLoad(&authority[2u]);
  return atomicLoad(&authority[0u]) == CONTROL_MAGIC
    && atomicLoad(&authority[1u]) == CONTROL_VERSION
    && atomicLoad(&authority[4u]) == params.execution_generation
    && atomicLoad(&authority[7u]) == params.source_capacity
    && atomicLoad(&authority[8u]) <= params.source_capacity
    && atomicLoad(&authority[28u]) == params.compact_stride
    && atomicLoad(&authority[30u]) == params.pressure_stride
    && control_volume_projection_ready()
    && (control_status & (
      CONTROL_STATUS_INITIALIZED | CONTROL_STATUS_COMPACT_READY
    )) == (CONTROL_STATUS_INITIALIZED | CONTROL_STATUS_COMPACT_READY)
    && (control_status & CONTROL_STATUS_FAILED) == 0u;
}

fn directory_contract_ready() -> bool {
  let status = directory[2u];
  let live_count = atomicLoad(&authority[8u]);
  return authority_identity_ready()
    && directory[0u] == SPATIAL_MAGIC
    && directory[1u] == SPATIAL_VERSION
    && (status & (SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED))
      == (SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED)
    && (status & SPATIAL_STATUS_REJECT_MASK) == 0u
    && directory[3u] == params.directory_generation_id
    && directory[8u] == atomicLoad(&authority[6u])
    && directory[16u] == live_count
    && directory[17u] == params.source_capacity
    && directory[18u] <= live_count
    && directory[19u] == params.cell_capacity
    && directory[22u] == params.directory_capacity_words
    && directory[23u] == 0u
    && directory[24u] == 0u
    && directory[25u] == 5u
    && directory[26u] == 5u
    && directory[27u] == SPATIAL_SORT_LEXICOGRAPHIC
    && directory[28u] == 48u
    && directory[29u] == params.cell_keys_offset_words
    && directory[30u] == params.cell_offsets_offset_words
    && directory[31u] == params.cell_members_offset_words
    && directory[32u] == params.particle_to_cell_offset_words
    && directory[33u] == directory[35u]
    && directory[35u] != 0u
    && directory[36u] == params.directory_generation_id
    && directory[37u] == live_count
    && directory[38u] == directory[18u]
    && directory[39u] == 1u
    && directory[40u] == 0u
    && directory[41u] == 1u
    && directory[42u] == atomicLoad(&authority[22u])
    && directory[43u] == atomicLoad(&authority[23u])
    && directory[44u] == atomicLoad(&authority[24u])
    && directory[42u] == atomicLoad(&authority[25u])
    && directory[43u] == atomicLoad(&authority[26u])
    && directory[44u] == atomicLoad(&authority[27u])
    && directory[46u] == SPATIAL_ACTIVE_NODE_ADAPTER;
}

fn directory_ready() -> bool {
  return directory_contract_ready() && atomicLoad(&authority[3u]) == 0u;
}

fn free_volume_contract_ready() -> bool {
  let status = gas_free_volume_control[2u];
  // Absence is part of the exact source contract too: an enabled volume
  // header cannot be consumed by an EOS call which omitted that reservoir.
  let aerosol_matches = gas_free_volume_control[35u] == params.aerosol_enabled
    && gas_free_volume_control[36u] == params.aerosol_family_id
    && gas_free_volume_control[37u] == params.aerosol_generation
    && gas_free_volume_control[38u] == params.aerosol_capacity
    && gas_free_volume_control[42u] == params.aerosol_version;
  let aerosol_ready = select(
    params.aerosol_enabled == 0u && params.aerosol_family_id == 0u
      && params.aerosol_generation == 0u && params.aerosol_capacity == 0u
      && params.aerosol_version == 0u && gas_free_volume_control[39u] == 0u
      && gas_free_volume_control[40u] == 0u && gas_free_volume_control[43u] == 0u,
    params.aerosol_enabled == 1u && params.aerosol_family_id != 0u
      && params.aerosol_capacity > 0u && params.aerosol_version == 1u
      && gas_free_volume_control[39u] == params.aerosol_capacity
      && gas_free_volume_control[40u] <= params.aerosol_capacity
      && gas_free_volume_control[43u] == params.free_volume_generation,
    params.aerosol_enabled != 0u);
  return gas_free_volume_control[0u] == FREE_VOLUME_MAGIC
    && gas_free_volume_control[1u] == FREE_VOLUME_VERSION
    && (status & (
      FREE_VOLUME_STATUS_READY | FREE_VOLUME_STATUS_ADMITTED
    )) == (FREE_VOLUME_STATUS_READY | FREE_VOLUME_STATUS_ADMITTED)
    && (status & FREE_VOLUME_STATUS_FAIL_CLOSED) == 0u
    && gas_free_volume_control[3u] == 0u
    && gas_free_volume_control[41u] == 0u
    && aerosol_matches && aerosol_ready
    && gas_free_volume_control[4u] == params.free_volume_generation
    && gas_free_volume_control[5u] == params.free_volume_source_generation
    && gas_free_volume_control[6u] == params.free_volume_directory_generation
    && gas_free_volume_control[7u] == params.free_volume_storage_generation
    && gas_free_volume_control[8u] == params.free_volume_cell_capacity
    && gas_free_volume_control[9u] == params.free_volume_row_words
    && gas_free_volume_control[33u] == params.projection_version
    && gas_free_volume_control[34u] == params.geometry_seal
    && gas_free_volume_control[15u] == directory[18u]
    && gas_free_volume_control[22u] == directory[18u];
}

fn record_eos_error(error_flag: u32) {
  atomicOr(&authority[3u], error_flag);
  atomicAdd(&authority[15u], 1u);
}

fn linear_cell_index(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>,
  dispatch_x: u32
) -> u32 {
  let linear_group = workgroup_id.x
    + workgroup_id.y * max(dispatch_x, 1u);
  return linear_group * 64u + local_id.x;
}

const STAGED_DISPATCH_EXCLUDED: u32 = 0xffffffffu;

// A1: the cell index under the staged consumer dispatch words (x, y, z at
// authority[word..word+2], copied from the directory's consumer dispatch in
// this encoder). The launch's own linear group is admitted only if the staged
// indirect launch would have run it, so an indirect launch (shape x, y, 1)
// and a direct 1D launch over a host ceiling run exactly the same groups with
// the same cell indices. Workgroup-uniform.
fn staged_linear_cell_index(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>,
  num_workgroups: vec3<u32>,
  snapshot_word: u32
) -> u32 {
  let staged_x = atomicLoad(&authority[snapshot_word]);
  let staged_y = atomicLoad(&authority[snapshot_word + 1u]);
  let staged_z = atomicLoad(&authority[snapshot_word + 2u]);
  let linear_group = workgroup_id.x
    + workgroup_id.y * num_workgroups.x
    + workgroup_id.z * num_workgroups.x * num_workgroups.y;
  if (staged_z == 0u || linear_group >= staged_x * staged_y) {
    return STAGED_DISPATCH_EXCLUDED;
  }
  return linear_group * 64u + local_id.x;
}

fn key_word(cell_index: u32, word: u32) -> u32 {
  return directory[params.cell_keys_offset_words + cell_index * 5u + word];
}

fn decoded_signed_order_key(value: u32) -> i32 {
  return bitcast<i32>(value ^ 0x80000000u);
}

fn compare_cell_key(cell_index: u32, sought_key: array<u32, 5>) -> i32 {
  for (var word = 0u; word < 5u; word = word + 1u) {
    let actual = key_word(cell_index, word);
    if (actual < sought_key[word]) { return -1; }
    if (actual > sought_key[word]) { return 1; }
  }
  return 0;
}

fn find_cell(sought_key: array<u32, 5>) -> u32 {
  var low = 0u;
  var high = directory[18u];
  loop {
    if (low >= high) { break; }
    let middle = low + (high - low) / 2u;
    let comparison = compare_cell_key(middle, sought_key);
    if (comparison < 0) {
      low = middle + 1u;
    } else {
      high = middle;
    }
  }
  if (low < directory[18u] && compare_cell_key(low, sought_key) == 0) {
    return low;
  }
  return 0xffffffffu;
}

@compute @workgroup_size(64)
fn aggregate_cells(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(num_workgroups) num_workgroups: vec3<u32>
) {
  let cell_index = staged_linear_cell_index(
    local_id,
    workgroup_id,
    num_workgroups,
    22u
  );
  if (cell_index == STAGED_DISPATCH_EXCLUDED) { return; }
  if (
    !directory_ready()
    || !free_volume_contract_ready()
    || cell_index >= directory[18u]
  ) {
    return;
  }
  let output = cell_index * params.pressure_stride;
  for (var word = 0u; word < params.pressure_stride; word = word + 1u) {
    pressure_cells[output + word] = 0.0;
  }
  if (
    key_word(cell_index, 0u) != params.chart_id
    || key_word(cell_index, 1u) != params.level_order_key
  ) {
    record_eos_error(CONTROL_ERROR_EOS_INVALID);
    return;
  }
  let member_begin = directory[params.cell_offsets_offset_words + cell_index];
  let member_end = directory[params.cell_offsets_offset_words + cell_index + 1u];
  let live_count = atomicLoad(&authority[8u]);
  if (member_begin > member_end || member_end > live_count) {
    record_eos_error(CONTROL_ERROR_EOS_INVALID);
    return;
  }

  var total_moles = 0.0;
  var total_mass_kg = 0.0;
  var mole_temperature_k = 0.0;
  var mixture = gas_mixture_empty();
  ${caloricModule ? 'var caloric = gas_caloric_empty();' : ''}
  for (var member = member_begin; member < member_end; member = member + 1u) {
    let source_index = directory[params.cell_members_offset_words + member];
    if (source_index >= live_count) {
      record_eos_error(CONTROL_ERROR_EOS_INVALID);
      return;
    }
    let row = source_index * params.compact_stride;
    let status = compact_rows[row + 10u];
    let routing = compact_rows[row + 11u];
    let moles = compact_rows[row + 5u];
    let position_m = vec3<f32>(
      compact_rows[row + 0u],
      compact_rows[row + 1u],
      compact_rows[row + 2u]
    );
    let row_ready = status > 0.5
      && routing > 0.5
      && routing < 1.5
      && finite_f32(moles)
      && moles > 0.0
      && all(vec3<bool>(
        finite_f32(position_m.x),
        finite_f32(position_m.y),
        finite_f32(position_m.z)
      ));
    let source_mass_kg = compact_rows[row + 4u];
    if (!row_ready || !finite_f32(source_mass_kg) || !(source_mass_kg > 0.0)) {
      record_eos_error(CONTROL_ERROR_EOS_INVALID);
      return;
    }
    let source_temperature = compact_rows[row + 6u];
    let temperature_k = select(
      params.fallback_temperature_k,
      source_temperature,
      finite_f32(source_temperature) && source_temperature > 0.0
    );
    total_moles = total_moles + moles;
    total_mass_kg = total_mass_kg + source_mass_kg;
    mole_temperature_k = mole_temperature_k + moles * temperature_k;
    mixture = gas_mixture_add(mixture, row);
    ${caloricModule ? 'caloric = gas_caloric_add(caloric, row);' : ''}
  }
  let free_volume_row = cell_index * FREE_VOLUME_ROW_STRIDE;
  let geometric_volume_m3 = bitcast<f32>(
    gas_free_volume[free_volume_row + 0u]
  );
  let condensed_volume_m3 = bitcast<f32>(
    gas_free_volume[free_volume_row + 1u]
  );
  let free_volume_m3 = bitcast<f32>(
    gas_free_volume[free_volume_row + 2u]
  );
  let free_volume_status = gas_free_volume[free_volume_row + 3u];
  let free_volume_ready =
    (free_volume_status & (
      FREE_VOLUME_STATUS_READY | FREE_VOLUME_STATUS_ADMITTED
    )) == (FREE_VOLUME_STATUS_READY | FREE_VOLUME_STATUS_ADMITTED)
    && (free_volume_status & FREE_VOLUME_STATUS_FAIL_CLOSED) == 0u
    && finite_f32(geometric_volume_m3)
    && geometric_volume_m3 > 0.0
    && finite_f32(condensed_volume_m3)
    && condensed_volume_m3 >= 0.0
    && condensed_volume_m3 <= geometric_volume_m3
    && finite_f32(free_volume_m3)
    && free_volume_m3 > 0.0
    && abs(
      (geometric_volume_m3 - condensed_volume_m3) - free_volume_m3
    ) <= max(1e-7, geometric_volume_m3 * 1e-5);
  if (!(total_moles > 0.0) || !free_volume_ready) {
    record_eos_error(CONTROL_ERROR_FREE_VOLUME_INVALID);
    return;
  }
  if (!finite_f32(total_mass_kg) || !(total_mass_kg > 0.0)) {
    record_eos_error(CONTROL_ERROR_EOS_INVALID);
    return;
  }
  let pressure_pa = mole_temperature_k
    * params.gas_constant_j_per_mol_k / free_volume_m3;
  let cell = vec3<i32>(
    decoded_signed_order_key(key_word(cell_index, 2u)),
    decoded_signed_order_key(key_word(cell_index, 3u)),
    decoded_signed_order_key(key_word(cell_index, 4u))
  );
  let extent = vec3<f32>(
    qcv_primal_axis_extent(cell.x, params.lower_cell_x, params.lower_fraction_x,
      params.upper_cell_x, params.upper_fraction_x),
    qcv_primal_axis_extent(cell.y, params.lower_cell_y, params.lower_fraction_y,
      params.upper_cell_y, params.upper_fraction_y),
    qcv_primal_axis_extent(cell.z, params.lower_cell_z, params.lower_fraction_z,
      params.upper_cell_z, params.upper_fraction_z)
  ) * params.cell_size_m;
  let descriptor_volume_m3 = extent.x * extent.y * extent.z;
  if (any(extent <= vec3<f32>(0.0))
    || !finite_f32(descriptor_volume_m3)
    || bitcast<u32>(descriptor_volume_m3) != gas_free_volume[free_volume_row]) {
    record_eos_error(CONTROL_ERROR_FREE_VOLUME_INVALID);
    return;
  }
  // Only the final display/gradient position is world f32. Clipping and
  // volume arithmetic above remain in canonical cell-local coordinates.
  let center_fraction = vec3<f32>(
    qcv_primal_axis_center_fraction(cell.x, params.lower_cell_x, params.lower_fraction_x,
      params.upper_cell_x, params.upper_fraction_x),
    qcv_primal_axis_center_fraction(cell.y, params.lower_cell_y, params.lower_fraction_y,
      params.upper_cell_y, params.upper_fraction_y),
    qcv_primal_axis_center_fraction(cell.z, params.lower_cell_z, params.lower_fraction_z,
      params.upper_cell_z, params.upper_fraction_z)
  );
  let center_m = (vec3<f32>(cell) + center_fraction) * params.cell_size_m;
  if (
    !finite_f32(pressure_pa)
    || pressure_pa < 0.0
    || !all(vec3<bool>(
      finite_f32(center_m.x),
      finite_f32(center_m.y),
      finite_f32(center_m.z)
    ))
  ) {
    record_eos_error(CONTROL_ERROR_EOS_INVALID);
    return;
  }
  pressure_cells[output + 0u] = f32(decoded_signed_order_key(key_word(cell_index, 2u)));
  pressure_cells[output + 1u] = f32(decoded_signed_order_key(key_word(cell_index, 3u)));
  pressure_cells[output + 2u] = f32(decoded_signed_order_key(key_word(cell_index, 4u)));
  pressure_cells[output + 3u] = 1.0;
  pressure_cells[output + 4u] = center_m.x;
  pressure_cells[output + 5u] = center_m.y;
  pressure_cells[output + 6u] = center_m.z;
  pressure_cells[output + 7u] = pressure_pa;
  pressure_cells[output + 8u] = 0.0;
  pressure_cells[output + 9u] = 0.0;
  pressure_cells[output + 10u] = 0.0;
  pressure_cells[output + 11u] = free_volume_m3;
  gas_mixture_write(cell_index, mixture);
  ${caloricModule ? 'gas_caloric_write(cell_index, caloric);' : ''}
  atomicAdd(&authority[11u], 1u);
  atomicAdd(&authority[31u], 1u);
}

fn ready_neighbor(cell_index: u32) -> bool {
  if (cell_index == 0xffffffffu || cell_index >= directory[18u]) {
    return false;
  }
  let row = cell_index * params.pressure_stride;
  return pressure_cells[row + 3u] > 0.5
    && finite_f32(pressure_cells[row + 7u])
    && pressure_cells[row + 7u] >= 0.0;
}

fn neighbor_key(cell_index: u32, axis: u32, positive: bool) -> array<u32, 5> {
  var key: array<u32, 5>;
  for (var word = 0u; word < 5u; word = word + 1u) {
    key[word] = key_word(cell_index, word);
  }
  let component = 2u + axis;
  if (positive) {
    if (key[component] == 0xffffffffu) {
      key[0u] = 0xffffffffu;
      key[1u] = 0xffffffffu;
      return key;
    }
    key[component] = key[component] + 1u;
  } else {
    if (key[component] == 0u) {
      key[0u] = 0xffffffffu;
      key[1u] = 0xffffffffu;
      return key;
    }
    key[component] = key[component] - 1u;
  }
  return key;
}

@compute @workgroup_size(64)
fn derive_gradients(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(num_workgroups) num_workgroups: vec3<u32>
) {
  let cell_index = staged_linear_cell_index(
    local_id,
    workgroup_id,
    num_workgroups,
    25u
  );
  if (cell_index == STAGED_DISPATCH_EXCLUDED) { return; }
  if (
    !directory_ready()
    || cell_index >= directory[18u]
  ) {
    return;
  }
  let output = cell_index * params.pressure_stride;
  if (pressure_cells[output + 3u] <= 0.5) {
    record_eos_error(CONTROL_ERROR_EOS_INVALID);
    return;
  }
  let center_pressure = pressure_cells[output + 7u];
  var gradient = vec3<f32>(0.0);
  for (var axis = 0u; axis < 3u; axis = axis + 1u) {
    let plus_index = find_cell(neighbor_key(cell_index, axis, true));
    let minus_index = find_cell(neighbor_key(cell_index, axis, false));
    let plus_ready = ready_neighbor(plus_index);
    let minus_ready = ready_neighbor(minus_index);
    var component = 0.0;
    if (plus_ready && minus_ready) {
      let plus = plus_index * params.pressure_stride;
      let minus = minus_index * params.pressure_stride;
      let distance_m = 2.0 * params.cell_size_m;
      if (distance_m != 0.0) {
        component = (pressure_cells[plus + 7u] - pressure_cells[minus + 7u])
          / distance_m;
      }
    } else if (plus_ready) {
      let plus = plus_index * params.pressure_stride;
      let distance_m = params.cell_size_m;
      if (distance_m != 0.0) {
        component = (pressure_cells[plus + 7u] - center_pressure) / distance_m;
      }
    } else if (minus_ready) {
      let minus = minus_index * params.pressure_stride;
      let distance_m = params.cell_size_m;
      if (distance_m != 0.0) {
        component = (center_pressure - pressure_cells[minus + 7u]) / distance_m;
      }
    }
    if (finite_f32(component)) {
      gradient[axis] = component;
    }
  }
  pressure_cells[output + 8u] = gradient.x;
  pressure_cells[output + 9u] = gradient.y;
  pressure_cells[output + 10u] = gradient.z;
}

@compute @workgroup_size(1)
fn finalize_eos() {
  let identity_ready = authority_identity_ready();
  let directory_ready_for_eos = directory_contract_ready();
  let free_volume_ready_for_eos = free_volume_contract_ready();
  let live_count = atomicLoad(&authority[8u]);
  let directory_cell_count = select(0u, directory[18u], directory_ready_for_eos);
  if (!identity_ready) {
    atomicOr(&authority[3u], CONTROL_ERROR_GENERATION_MISMATCH);
    atomicAdd(&authority[15u], 1u);
  } else if (!directory_ready_for_eos) {
    atomicOr(&authority[3u], CONTROL_ERROR_DIRECTORY_REJECTED);
    atomicAdd(&authority[14u], 1u);
  } else if (!free_volume_ready_for_eos) {
    atomicOr(&authority[3u], CONTROL_ERROR_FREE_VOLUME_INVALID);
    atomicAdd(&authority[15u], 1u);
  } else if (atomicLoad(&authority[11u]) != directory_cell_count) {
    atomicOr(&authority[3u], CONTROL_ERROR_COUNT_MISMATCH);
    atomicAdd(&authority[15u], 1u);
  } else if (atomicLoad(&authority[31u]) != directory_cell_count) {
    atomicOr(&authority[3u], CONTROL_ERROR_FREE_VOLUME_INVALID);
    atomicAdd(&authority[15u], 1u);
  }

  let errors = atomicLoad(&authority[3u]);
  if (errors == 0u) {
    atomicStore(&authority[9u], directory[3u]);
    atomicStore(&authority[10u], directory_cell_count);
    atomicStore(&authority[5u], params.execution_generation);
    var status = atomicLoad(&authority[2u])
      | CONTROL_STATUS_DIRECTORY_READY
      | CONTROL_STATUS_EOS_READY
      | CONTROL_STATUS_PRESSURE_READY;
    if (live_count == 0u) { status = status | CONTROL_STATUS_EMPTY; }
    atomicStore(&authority[2u], status);
  } else {
    atomicOr(&authority[2u], CONTROL_STATUS_FAILED);
    atomicStore(&authority[5u], 0u);
    atomicStore(&authority[8u], 0u);
    atomicStore(&authority[9u], 0u);
    atomicStore(&authority[10u], 0u);
    atomicStore(&authority[11u], 0u);
    for (var word = 16u; word < 28u; word = word + 1u) {
      atomicStore(&authority[word], 0u);
    }
    atomicStore(&authority[31u], 0u);
  }
}
`;

}
export const sphSpatialGasLedgerEosWgsl = gasLedgerEosWgsl();

function adapterPipelines(device, exactHistory = false) {
  // The genuine source/count ABI stays unchanged. Only the numeric binding
  // is residual-only, and a failed projection invalidates the entire union.
  let code = sphSpatialGasLedgerCandidateUnionAdapterWgsl;
  if (exactHistory) {
    for (const [before, after] of [
      ['const CONTROL_MAGIC:', '@group(0) @binding(9) var<storage,read> exact_history_validation:array<u32>;\nconst CONTROL_MAGIC:'],
      ['fn product_history_authority_ready() -> bool {',
        'fn product_history_authority_ready() -> bool {\n  if(exact_history_validation[0u]!=0u || exact_history_validation[1u]!=0x48503247u){return false;}'],
      ['let residual_volume = unplaced_mass / density;', 'let residual_volume = product_events[source + 23u];'],
      ['let residual_volume = unplaced_mass / product_events[source + 17u];', 'let residual_volume = product_events[source + 23u];'],
      // The exact projection already contains ONLY current residual mass and
      // moles. Re-dividing identical f32 masses may yield 1-ulp on a native
      // reciprocal implementation, silently debiting the projected moles.
      ['let residual_fraction = unplaced_mass / total_mass;',
        'let residual_fraction = select(-1.0, 1.0, unplaced_mass == total_mass);'],
      ['let residual_fraction = clamp(unplaced_mass / total_mass, 0.0, 1.0);',
        'let residual_fraction = select(-1.0, 1.0, unplaced_mass == total_mass);'],
      ['if (params.require_complete_occupancy != 0u) {',
        `if (params.require_complete_occupancy != 0u && !(routing==0.0 && source_status==1.0
          && (product_events[source+11u]==1.0 || product_events[source+11u]==2.0))) {`]
    ]) {
      if (code.split(before).length !== 2) throw new Error(`Original gas adapter changed: ${before}`);
      code = code.replace(before, after);
    }
  }
  const variant = exactHistory ? 'exact-history.v3' : 'v6';
  const validationBinding = exactHistory ? [computeBufferBinding(9, 'read-only-storage')] : [];
  return {
    classify: createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-sph-spatial-gas-ledger-candidate-union-classify.${variant}`,
      label: 'ulg-sph-spatial-gas-ledger-candidate-union-classify',
      code,
      entryPoint: 'classify_gas_candidates',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform'),
        computeBufferBinding(7, 'read-only-storage'),
        computeBufferBinding(8, 'read-only-storage'),
        ...validationBinding
      ]
    }),
    finalize: createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-sph-spatial-gas-ledger-candidate-union-finalize.${variant}`,
      label: 'ulg-sph-spatial-gas-ledger-candidate-union-finalize',
      code,
      entryPoint: 'finalize_compaction',
      bindings: [
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform'),
        ...validationBinding
      ]
    }),
    scatter: createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-sph-spatial-gas-ledger-candidate-union-scatter.${variant}`,
      label: 'ulg-sph-spatial-gas-ledger-candidate-union-scatter',
      code,
      entryPoint: 'scatter_compact_rows',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'storage'),
        computeBufferBinding(4, 'storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform'),
        computeBufferBinding(7, 'read-only-storage'),
        computeBufferBinding(8, 'read-only-storage'),
        ...validationBinding
      ]
    })
  };
}

function eosPipelines(device, caloricModule = null) {
  // Two material-general layouts, not kernels compiled per material/reaction.
  const code = caloricModule ? gasLedgerEosWgsl(caloricModule) : sphSpatialGasLedgerEosWgsl;
  const variant = caloricModule ? 'caloric.v2' : 'v5';
  const bindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'uniform'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'read-only-storage'),
    computeBufferBinding(11, 'storage')
  ];
  if (caloricModule) bindings.push(computeBufferBinding(12, 'read-only-storage'),
    computeBufferBinding(13, 'storage'));
  return {
    aggregate: createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-sph-spatial-gas-ledger-eos-aggregate.${variant}`,
      label: 'ulg-sph-spatial-gas-ledger-eos-aggregate',
      code,
      entryPoint: 'aggregate_cells',
      bindings
    }),
    gradient: createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-sph-spatial-gas-ledger-eos-gradient.${variant}`,
      label: 'ulg-sph-spatial-gas-ledger-eos-gradient',
      code,
      entryPoint: 'derive_gradients',
      bindings
    }),
    finalize: createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-sph-spatial-gas-ledger-eos-finalize.${variant}`,
      label: 'ulg-sph-spatial-gas-ledger-eos-finalize',
      code,
      entryPoint: 'finalize_eos',
      bindings
    })
  };
}

function makeBindGroup(device, label, layout, entries) {
  return device.createBindGroup({ label, layout, entries });
}

function activeNodeDirectorySource({
  slot,
  capacity,
  executionGeneration,
  epochIdentity,
  cellSizeM,
  chartId,
  level
}) {
  const logicalSourceCountAuthority = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_GPU_LOGICAL_COUNT_SOURCE_SCHEMA,
    status: 'schroeder-spatial-gpu-logical-count-source-ready',
    ready: true,
    buffer: slot.controlBuffer,
    byteOffset:
      SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.LIVE_RESIDUAL_COUNT
      * UINT32_BYTES,
    sourceCapacity: capacity,
    storageGeneration: epochIdentity.storageGeneration,
    executionGeneration
  });
  return {
    schema: 'peercompute.ulg.sph-spatial-gas-active-node-adapter.v2',
    status: 'sph-spatial-gas-active-node-adapter-submitted',
    spatialDirectorySourceSchema: ULG_SCHROEDER_SPATIAL_DIRECTORY_SOURCE_SCHEMA,
    spatialDirectorySourceStatus: 'schroeder-spatial-directory-source-ready',
    spatialDirectorySourceReady: true,
    spatialEpochSourceSchema:
      'peercompute.ulg.sph-gas-candidate-union-spatial-source.v1',
    spatialEpochSourceStatus: 'sph-gas-candidate-union-spatial-source-ready',
    spatialEpochSourceReady: true,
    spatialEpochPositionAuthority: SPATIAL_GAS_UNION_POSITION_AUTHORITY,
    spatialEpochLevelSpacingMode: 'uniform-gas-cell-size',
    spatialEpochBaseGridSpacingM: cellSizeM,
    spatialEpochMinLevel: level,
    spatialEpochMaxLevel: level,
    spatialEpochChartId: chartId,
    activeCandidateCount: capacity,
    activeNodeCount: capacity,
    activeNodeStrideFloats: SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS,
    activeNodeBuffer: slot.activeNodeBuffer,
    buffer: slot.activeNodeBuffer,
    logicalSourceCountAuthority,
    logicalSourceCountGpuAuthored: true,
    spatialEpochStorageGeneration: epochIdentity.storageGeneration,
    spatialEpochPhysicsTick: epochIdentity.physicsTick,
    spatialEpochPhysicsSubstep: epochIdentity.physicsSubstep,
    spatialEpochPositionEpoch: epochIdentity.positionEpoch,
    spatialEpochTopologyEpoch: epochIdentity.topologyEpoch,
    spatialEpochChartEpoch: epochIdentity.chartEpoch,
    spatialEpochLevelEpoch: epochIdentity.levelEpoch,
    spatialEpochSupportEpoch: epochIdentity.supportEpoch,
    phaseVolumeAssignmentOverlayEnabled: false,
    sourceValidityAuthority:
      'stable-gpu-candidate-union-compaction-with-authenticated-logical-prefix-count'
  };
}

function scheduleFailureCleanup({
  device,
  slot,
  ownerToken,
  spatialGeneration = null,
  schroederSpatialEpochGeneration = null,
  generationConsumerLease = null,
  gasFreeVolumeRuntime = null,
  gasFreeVolumeExecution = null,
  releaseSourceBorrow,
  readbackTelemetry = null,
  workSubmitted = false
}) {
  if (workSubmitted !== true) {
    // No command using the borrowed source or arena slot reached the queue, so
    // synchronous retirement is exact and avoids consuming a slot forever on
    // a setup/validation exception.
    releaseSourceBorrow();
    if (generationConsumerLease) {
      releaseSchroederSpatialEpochGenerationConsumerLease(
        generationConsumerLease,
        { discardedEncoder: true }
      );
    }
    if (
      gasFreeVolumeRuntime
      && gasFreeVolumeExecution
      && !isSphSpatialGasFreeVolumeExecutionSubmitted(
        gasFreeVolumeRuntime,
        gasFreeVolumeExecution
      )
    ) {
      releaseSphSpatialGasFreeVolumeExecution(
        gasFreeVolumeRuntime,
        gasFreeVolumeExecution,
        { discardedEncoder: true }
      );
    }
    if (slot.ownerToken === ownerToken) {
      slot.pendingFailure = null;
      slot.retainedExecution = null;
      slot.releasePromise = null;
      slot.ownerToken = null;
      slot.inUse = false;
    }
    return Promise.resolve(true);
  }
  const failureRecord = {
    ownerToken,
    spatialGeneration,
    schroederSpatialEpochGeneration,
    generationConsumerLease,
    gasFreeVolumeRuntime,
    gasFreeVolumeExecution,
    releaseSourceBorrow,
    released: false,
    terminal: false,
    status: 'spatial-gas-ledger-eos-submit-failure-awaiting-retirement'
  };
  slot.pendingFailure = failureRecord;
  let completion = null;
  let submissionFence = null;
  const submissionFenceProvider = device.queue?.onSubmittedWorkDone;
  if (typeof submissionFenceProvider === 'function') {
    let submissionFenceCandidate = null;
    let submissionFenceProviderReturned = false;
    try {
      submissionFenceCandidate = submissionFenceProvider.call(device.queue);
      submissionFenceProviderReturned = true;
    } catch {
      readbackTelemetry?.markUnknown(
        'spatial-gas-submit-failure-cleanup-fence-provider-error'
      );
    }
    submissionFence = promiseFromConfirmedThenable(submissionFenceCandidate);
    if (submissionFence) {
      readbackTelemetry?.recordDeferredCleanupHostQueueFence(
        1,
        'spatial-gas-submit-failure-cleanup'
      );
    } else if (submissionFenceProviderReturned) {
      readbackTelemetry?.markUnknown(
        'spatial-gas-submit-failure-cleanup-fence-provider-nonthenable'
      );
    }
  } else {
    readbackTelemetry?.markUnknown(
      'spatial-gas-submit-failure-cleanup-fence-provider-missing'
    );
  }
  if (
    spatialGeneration?.ready !== true
    && spatialGeneration?.releaseScheduled === true
    && typeof spatialGeneration?.releasePromise?.then === 'function'
  ) {
    // Schroeder may return a rejected public result after retaining a private
    // post-submit cleanup generation whose fence was already scheduled. Its
    // v1 result covers backpressure awaits, not that cleanup fence, so account
    // for the exact nested fence here before this owner awaits it.
    readbackTelemetry?.recordDeferredCleanupHostQueueFence(
      1,
      'spatial-gas-submit-failure-spatial-generation-cleanup'
    );
    completion = spatialGeneration.releasePromise;
  } else if (spatialGeneration?.selected === true) {
    try {
      let scheduled = false;
      if (spatialGeneration.ready === true) {
        scheduled =
          releaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer(
            spatialGeneration,
            device
          );
      } else {
        readbackTelemetry?.recordDeferredCleanupHostQueueFence(
          1,
          'spatial-gas-submit-failure-spatial-generation-cleanup'
        );
        scheduled = releaseSchroederSpatialEpochGenerationAfterQueue(
          spatialGeneration,
          device
        );
      }
      if (scheduled || spatialGeneration.releaseScheduled === true) {
        completion = spatialGeneration.releasePromise;
      } else {
        readbackTelemetry?.markUnknown(
          'spatial-gas-submit-failure-spatial-generation-cleanup-result'
        );
      }
    } catch (error) {
      // A ready generation normally retires queue-ordered with no extra host
      // fence. If that exact-owner path fails, retain the legacy fenced
      // cleanup, count its invocation, and mark any failure as unknown.
      try {
        readbackTelemetry?.recordDeferredCleanupHostQueueFence(
          1,
          'spatial-gas-submit-failure-spatial-generation-cleanup'
        );
        const scheduled = releaseSchroederSpatialEpochGenerationAfterQueue(
          spatialGeneration,
          device
        );
        if (scheduled || spatialGeneration.releaseScheduled === true) {
          completion = spatialGeneration.releasePromise;
        } else {
          readbackTelemetry?.markUnknown(
            'spatial-gas-submit-failure-spatial-generation-cleanup-result'
          );
        }
      } catch {
        completion = null;
        readbackTelemetry?.markUnknown(
          'spatial-gas-submit-failure-spatial-generation-cleanup-error'
        );
      }
    }
  }
  if (!completion && submissionFence) {
    completion = Promise.resolve(submissionFence).then(() => true);
  }
  if (!completion || !submissionFence) {
    // There is no proof that submitted commands stopped using this slot. Fail
    // closed by quarantining the slot and its source borrow until device loss.
    slot.terminal = true;
    failureRecord.terminal = true;
    failureRecord.status =
      'spatial-gas-ledger-eos-submit-failure-quarantined-no-fence';
    const quarantinePromise = Promise.resolve(false);
    slot.releasePromise = quarantinePromise;
    return quarantinePromise;
  }
  const dependentReleases = [Promise.resolve(completion)];
  if (generationConsumerLease) {
    dependentReleases.push(
      releaseSchroederSpatialEpochGenerationConsumerLeaseAfter(
        generationConsumerLease,
        submissionFence
      )
    );
  }
  if (gasFreeVolumeRuntime && gasFreeVolumeExecution) {
    if (isSphSpatialGasFreeVolumeExecutionSubmitted(
      gasFreeVolumeRuntime,
      gasFreeVolumeExecution
    )) {
      dependentReleases.push(
        releaseSphSpatialGasFreeVolumeExecutionAfter(
          gasFreeVolumeRuntime,
          gasFreeVolumeExecution,
          submissionFence
        )
      );
    } else {
      releaseSphSpatialGasFreeVolumeExecution(
        gasFreeVolumeRuntime,
        gasFreeVolumeExecution,
        { discardedEncoder: true }
      );
    }
  }
  const releasePromise = Promise.all(dependentReleases).then((results) => {
    const confirmed = results.every((value) => value === true);
    if (
      slot.ownerToken !== ownerToken
      || slot.pendingFailure !== failureRecord
    ) return false;
    slot.releasePromise = null;
    if (confirmed) {
      failureRecord.releaseSourceBorrow();
      failureRecord.released = true;
      failureRecord.status =
        'spatial-gas-ledger-eos-submit-failure-retired';
      const attachedExecution = slot.retainedExecution;
      const attachedRecord = retainedExecutions.get(attachedExecution);
      if (attachedRecord?.ownerToken === ownerToken) {
        attachedRecord.terminal = true;
        attachedRecord.status = 'spatial-gas-ledger-eos-submit-failure-retired';
      }
      slot.pendingFailure = null;
      slot.retainedExecution = null;
      slot.ownerToken = null;
      slot.inUse = false;
      return true;
    }
    const attachedRecord = retainedExecutions.get(slot.retainedExecution);
    if (attachedRecord?.ownerToken === ownerToken) {
      attachedRecord.terminal = true;
      attachedRecord.status = 'spatial-gas-ledger-eos-submit-failure-unconfirmed';
    }
    failureRecord.terminal = true;
    failureRecord.status =
      'spatial-gas-ledger-eos-submit-failure-unconfirmed';
    slot.terminal = true;
    return false;
  }, () => {
    const attachedRecord = retainedExecutions.get(slot.retainedExecution);
    if (attachedRecord?.ownerToken === ownerToken) {
      attachedRecord.terminal = true;
      attachedRecord.status = 'spatial-gas-ledger-eos-submit-failure-unconfirmed';
    }
    failureRecord.terminal = true;
    failureRecord.status =
      'spatial-gas-ledger-eos-submit-failure-unconfirmed';
    slot.terminal = true;
    slot.releasePromise = null;
    return false;
  });
  slot.releasePromise = releasePromise;
  return releasePromise;
}

function attachLifecycleTarget(target, record) {
  Object.defineProperties(target, {
    releaseStatus: {
      enumerable: true,
      get() { return record.status; }
    },
    releaseError: {
      enumerable: true,
      get() { return record.releaseError; }
    },
    releaseAttempted: {
      enumerable: true,
      get() { return record.releaseAttempted; }
    },
    releaseScheduled: {
      enumerable: true,
      get() { return Boolean(record.releasePromise); }
    },
    releasePromise: {
      enumerable: true,
      get() { return record.releasePromise; }
    },
    released: {
      enumerable: true,
      get() { return record.released; }
    },
    releaseQuarantined: {
      enumerable: true,
      get() { return record.quarantined; }
    },
    terminal: {
      enumerable: true,
      get() { return record.terminal; }
    },
    gasPressureAuthorityConsumerSubmitted: {
      enumerable: true,
      get() { return record.pressureConsumerSubmitted; }
    },
    gasPressureAuthorityConsumerBorrowed: {
      enumerable: true,
      get() { return Boolean(record.activePressureConsumerReceipt); }
    },
    deferredCleanupReadbackTelemetrySnapshot: {
      enumerable: true,
      value: () => record.deferredCleanupReadbackTelemetry.snapshot()
    }
  });
}

function attachLifecycle(execution, spatialSource, gasCellSource, record) {
  retainedExecutions.set(execution, record);
  retainedSpatialGasSources.set(spatialSource, record);
  retainedGasCellSources.set(gasCellSource, record);
  attachLifecycleTarget(execution, record);
  attachLifecycleTarget(spatialSource, record);
  attachLifecycleTarget(gasCellSource, record);
  Object.defineProperties(execution, {
    oracleDiagnostics: {
      enumerable: true,
      get() { return record.oracleDiagnostics; }
    }
  });
}

function queueOrderedPressureRetirementContext(record) {
  if (
    !record
    || record.terminal
    || record.released
    || record.releasePromise
    || record.releaseAttempted
    || record.pressureConsumerSubmitted
    || record.activeExchangeOperation
    || record.execution !== record.slot.retainedExecution
    || record.slot.ownerToken !== record.ownerToken
    || record.slot.terminal
    || record.slot.destroyed
    || record.queueOrderedCleanupClaim == null
    || typeof record.queueOrderedCleanup !== 'function'
    || record.releaseSourceBorrow?.canRelease?.() !== true
  ) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_QUEUE_ORDERED_STALE',
      'queue-ordered gas pressure retirement requires one exact live retained owner'
    );
  }
  if (!canReleaseSphSpatialGasFreeVolumeExecutionQueueOrdered(
    record.gasFreeVolumeRuntime,
    record.gasFreeVolumeExecution
  )) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_QUEUE_ORDERED_FREE_VOLUME_BUSY',
      'queue-ordered gas pressure retirement requires its exact submitted free-volume execution'
    );
  }
  if (!canReleaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer(
    record.spatialGeneration,
    record.device
  )) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_QUEUE_ORDERED_GAS_SPATIAL_BUSY',
      'queue-ordered gas pressure retirement requires its exact idle gas spatial generation'
    );
  }
  const sourceRetirementReady =
    record.queueOrderedRetirementMode === 'source-consumer-lease-only'
      ? canReleaseSchroederSpatialEpochGenerationConsumerLeaseQueueOrderedAfterFinalConsumer(
          record.generationConsumerLease,
          record.schroederSpatialEpochGeneration,
          record.device
        )
      : record.queueOrderedRetirementMode === 'source-consumer-lease-and-generation'
        && canReleaseSchroederSpatialEpochGenerationConsumerLeaseAndGenerationQueueOrderedAfterFinalConsumer(
          record.generationConsumerLease,
          record.schroederSpatialEpochGeneration,
          record.device
        );
  if (!sourceRetirementReady) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_QUEUE_ORDERED_SOURCE_SPATIAL_BUSY',
      record.queueOrderedRetirementMode === 'source-consumer-lease-only'
        ? 'queue-ordered gas pressure mechanics retirement requires its exact live source-generation consumer lease'
        : 'queue-ordered gas pressure retirement requires its exact sole source-generation consumer lease'
    );
  }
  return record;
}

function gasPressureQueueOrderedCleanupOperation(
  owner,
  cleanup,
  confirmCleanup
) {
  let value;
  let thrown = null;
  try {
    value = cleanup();
  } catch (error) {
    thrown = error instanceof Error ? error : new Error(String(error));
  }
  let confirmed = false;
  try {
    confirmed = confirmCleanup(value) === true;
  } catch (error) {
    if (!thrown) {
      thrown = error instanceof Error ? error : new Error(String(error));
    }
  }
  if (!confirmed && !thrown) {
    thrown = new Error(
      `queue-ordered gas pressure owner ${owner} did not confirm release`
    );
  }
  return {
    result: {
      owner,
      status: thrown ? 'rejected' : 'fulfilled',
      confirmed,
      reason: thrown?.message ?? null
    },
    failure: confirmed ? null : thrown
  };
}

function releaseGasPressureOwnerQueueOrdered(record) {
  queueOrderedPressureRetirementContext(record);
  record.releaseAttempted = true;
  record.status =
    'spatial-gas-ledger-eos-queue-ordered-final-consumer-retirement';
  // This is one consumed queue-order capability, so cleanup is synchronous
  // all-settled: every independent child is attempted even if a sibling
  // throws. Still-live owners remain quarantined; released siblings can reuse
  // their own arenas without replaying this authority.
  const outcomes = [
    gasPressureQueueOrderedCleanupOperation(
      'gas-free-volume-execution',
      () => releaseSphSpatialGasFreeVolumeExecutionQueueOrdered(
        record.gasFreeVolumeRuntime,
        record.gasFreeVolumeExecution
      ),
      () => describeSphSpatialGasFreeVolumeExecution(
        record.gasFreeVolumeExecution,
        { device: record.device }
      )?.releasedObserved === true
    ),
    gasPressureQueueOrderedCleanupOperation(
      'gas-spatial-generation',
      () => releaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer(
        record.spatialGeneration,
        record.device
      ),
      (value) => value === true
    ),
    gasPressureQueueOrderedCleanupOperation(
      record.queueOrderedRetirementMode === 'source-consumer-lease-only'
        ? 'source-spatial-generation-consumer-lease'
        : 'source-spatial-generation-and-consumer-lease',
      () => record.queueOrderedRetirementMode === 'source-consumer-lease-only'
        ? releaseSchroederSpatialEpochGenerationConsumerLeaseQueueOrderedAfterFinalConsumer(
            record.generationConsumerLease,
            record.schroederSpatialEpochGeneration,
            record.device
          )
        : releaseSchroederSpatialEpochGenerationConsumerLeaseAndGenerationQueueOrderedAfterFinalConsumer(
            record.generationConsumerLease,
            record.schroederSpatialEpochGeneration,
            record.device
          ),
      (value) => Boolean(
        value === true
        && !ownsSchroederSpatialEpochGenerationConsumerLease(
          record.generationConsumerLease,
          record.schroederSpatialEpochGeneration
        )
      )
    ),
    gasPressureQueueOrderedCleanupOperation(
      'retained-product-source-borrow',
      () => record.releaseSourceBorrow.releaseQueueOrdered
        ? record.releaseSourceBorrow.releaseQueueOrdered() : record.releaseSourceBorrow(),
      () => record.releaseSourceBorrow.isReleased?.() === true
    )
  ];
  const operationResults = Object.freeze(outcomes.map(({ result }) => (
    Object.freeze(result)
  )));
  record.queueOrderedRetirementOperationResults = operationResults;
  terminalizePressureConsumerReceipt(record);
  if (outcomes.every(({ result }) => result.confirmed === true)) {
    record.slot.releasePromise = null;
    record.slot.retainedExecution = null;
    record.slot.ownerToken = null;
    record.slot.inUse = false;
    record.released = true;
    record.quarantined = false;
    record.terminal = true;
    record.status =
      'spatial-gas-ledger-eos-released-queue-ordered-after-pressure-consumer';
    return true;
  }
  const error = new AggregateError(
    outcomes.map(({ failure }) => failure).filter(Boolean),
    'queue-ordered gas pressure retirement quarantined one or more still-live owners'
  );
  error.code = 'ERR_SPH_GAS_PRESSURE_AUTHORITY_QUEUE_ORDERED_RETIREMENT_TERMINAL';
  error.operationResults = operationResults;
  record.releaseError = error.message;
  record.quarantined = true;
  record.terminal = true;
  record.slot.releasePromise = null;
  record.slot.terminal = true;
  record.status =
    'spatial-gas-ledger-eos-queue-ordered-retirement-quarantined';
  throw error;
}

/** True only for the producer-issued source identity; clones never authenticate. */
export function isExactSphSpatialGasPressureAuthoritySource(source) {
  return exactPressureSourceRecord(source) !== null;
}

/**
 * Return a portable observation snapshot. It is deliberately neither a live
 * capability nor sufficient input to the pressure binder.
 */
export function describeSphSpatialGasPressureAuthority(source, options = {}) {
  const record = exactPressureSourceRecord(source);
  if (!record) return null;
  const exactDevice = options?.device === record.device;
  const observation = {
    schema: ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA,
    status: 'gas-pressure-authority-telemetry-only',
    telemetryOnly: true,
    bindable: false,
    sourceSchema: ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
    sourceStatusObserved: 'retained-gas-cell-eos-source-submitted',
    readyObserved: true,
    exactSourceObserved: true,
    deviceAuthenticated: exactDevice,
    releaseStatusObserved: record.status,
    releaseScheduledObserved: Boolean(record.releasePromise),
    releasedObserved: record.released,
    terminalObserved: record.terminal,
    consumerBorrowedObserved: Boolean(record.activePressureConsumerReceipt),
    consumerSubmittedObserved: record.pressureConsumerSubmitted,
    sourceBorrowReleasedObserved:
      record.releaseSourceBorrow?.isReleased?.() === true,
    sourceBorrowPrivateActiveCountObserved:
      record.releaseSourceBorrow?.activeCount?.() ?? null,
    queueOrderedRetirementOperationResults:
      record.queueOrderedRetirementOperationResults
  };
  if (exactDevice) {
    Object.assign(observation, {
      executionGeneration: record.executionGeneration,
      storageGeneration: record.storageGeneration,
      spatialGenerationId: record.spatialGenerationId,
      pressureCellCapacity: record.capacity,
      pressureCellStrideFloats: SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS,
      epochIdentity: record.epochIdentity
    });
  }
  return Object.freeze(observation);
}

function livePressureSourceRecord(source) {
  const record = exactPressureSourceRecord(source);
  if (!record) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_UNBRANDED',
      'Gas pressure encoding requires the exact producer-issued v4 source'
    );
  }
  if (
    record.terminal
    || record.released
    || record.releasePromise
    || record.slot.terminal
    || record.slot.destroyed
    || record.spatialGeneration?.releaseScheduled === true
    || record.spatialGeneration?.released === true
  ) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_TERMINAL',
      'Gas pressure authority is releasing, released, or terminal'
    );
  }
  if (
    record.execution !== record.slot.retainedExecution
    || record.slot.ownerToken !== record.ownerToken
    || record.spatialGeneration?.selected !== true
    || record.spatialGeneration?.execution?.generationId
      !== record.spatialGenerationId
  ) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_OWNER_MISMATCH',
      'Gas pressure authority no longer matches its live arena generation'
    );
  }
  if (record.activePressureConsumerReceipt || record.activeExchangeOperation) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_BORROWED',
      'Gas pressure authority already has an outstanding consumer receipt'
    );
  }
  if (record.pressureConsumerSubmitted) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_CONSUMED',
      'Gas pressure authority has already been submitted by its pressure consumer'
    );
  }
  return record;
}

function pressureEntryError(message) {
  return pressureAuthorityError(
    'ERR_SPH_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID',
    message
  );
}

function ownDataDescriptor(target, key, label) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(target, key);
  } catch (cause) {
    const error = pressureEntryError(`${label} could not be inspected`);
    error.cause = cause;
    throw error;
  }
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
    throw pressureEntryError(`${label} must be an own data property`);
  }
  return descriptor;
}

function snapshotPressurePublicEntries(
  publicEntries,
  device,
  reservedBindings = Object.freeze([3, 6])
) {
  if (!Array.isArray(publicEntries)) {
    throw pressureEntryError('publicEntries must be a dense Array');
  }
  const lengthDescriptor = ownDataDescriptor(
    publicEntries,
    'length',
    'publicEntries.length'
  );
  const length = lengthDescriptor.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > 64) {
    throw pressureEntryError('publicEntries length is invalid');
  }
  let arrayKeys;
  try {
    arrayKeys = Reflect.ownKeys(publicEntries);
  } catch (cause) {
    const error = pressureEntryError('publicEntries keys could not be inspected');
    error.cause = cause;
    throw error;
  }
  const allowedArrayKeys = new Set([
    'length',
    ...Array.from({ length }, (_, index) => String(index))
  ]);
  if (arrayKeys.some((key) => !allowedArrayKeys.has(key))) {
    throw pressureEntryError('publicEntries must not contain extra properties');
  }
  const seenBindings = new Set();
  const snapshot = [];
  for (let index = 0; index < length; index += 1) {
    const entry = ownDataDescriptor(
      publicEntries,
      String(index),
      `publicEntries[${index}]`
    ).value;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw pressureEntryError(`publicEntries[${index}] must be an object`);
    }
    let entryKeys;
    try {
      entryKeys = Reflect.ownKeys(entry);
    } catch (cause) {
      const error = pressureEntryError(
        `publicEntries[${index}] keys could not be inspected`
      );
      error.cause = cause;
      throw error;
    }
    if (
      entryKeys.length !== 2
      || !entryKeys.includes('binding')
      || !entryKeys.includes('resource')
    ) {
      throw pressureEntryError(
        `publicEntries[${index}] must contain only binding and resource`
      );
    }
    const binding = ownDataDescriptor(
      entry,
      'binding',
      `publicEntries[${index}].binding`
    ).value;
    if (!Number.isInteger(binding) || binding < 0 || binding > 0xffff_ffff) {
      throw pressureEntryError(
        `publicEntries[${index}].binding must be a u32`
      );
    }
    if (reservedBindings.includes(binding)) {
      throw pressureAuthorityError(
        'ERR_SPH_GAS_PRESSURE_AUTHORITY_RESERVED_BINDING',
        `Gas pressure authority privately owns binding ${binding}`
      );
    }
    if (seenBindings.has(binding)) {
      throw pressureEntryError(`publicEntries repeats binding ${binding}`);
    }
    seenBindings.add(binding);
    const resource = ownDataDescriptor(
      entry,
      'resource',
      `publicEntries[${index}].resource`
    ).value;
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
      throw pressureEntryError(
        `publicEntries[${index}].resource must be a buffer binding object`
      );
    }
    let resourceKeys;
    try {
      resourceKeys = Reflect.ownKeys(resource);
    } catch (cause) {
      const error = pressureEntryError(
        `publicEntries[${index}].resource keys could not be inspected`
      );
      error.cause = cause;
      throw error;
    }
    if (
      !resourceKeys.includes('buffer')
      || resourceKeys.some((key) => (
        key !== 'buffer' && key !== 'offset' && key !== 'size'
      ))
    ) {
      throw pressureEntryError(
        `publicEntries[${index}].resource is not a canonical buffer binding`
      );
    }
    const buffer = ownDataDescriptor(
      resource,
      'buffer',
      `publicEntries[${index}].resource.buffer`
    ).value;
    const bufferDevice = webGpuBufferDevice(buffer);
    if (
      (!buffer || (typeof buffer !== 'object' && typeof buffer !== 'function'))
      || (bufferDevice && bufferDevice !== device)
    ) {
      throw pressureEntryError(
        `publicEntries[${index}].resource.buffer is not a same-device buffer`
      );
    }
    const resourceSnapshot = { buffer };
    if (resourceKeys.includes('offset')) {
      const offset = ownDataDescriptor(
        resource,
        'offset',
        `publicEntries[${index}].resource.offset`
      ).value;
      if (!Number.isSafeInteger(offset) || offset < 0) {
        throw pressureEntryError(
          `publicEntries[${index}].resource.offset must be a non-negative safe integer`
        );
      }
      resourceSnapshot.offset = offset;
    }
    if (resourceKeys.includes('size')) {
      const size = ownDataDescriptor(
        resource,
        'size',
        `publicEntries[${index}].resource.size`
      ).value;
      if (!Number.isSafeInteger(size) || size < 1) {
        throw pressureEntryError(
          `publicEntries[${index}].resource.size must be a positive safe integer`
        );
      }
      resourceSnapshot.size = size;
    }
    snapshot.push(Object.freeze({
      binding,
      resource: Object.freeze(resourceSnapshot)
    }));
  }
  return Object.freeze(snapshot);
}

function reservePressureConsumerReceipt(
  record,
  consumerKind = 'pressure-interface'
) {
  const queueOrderedRetirementMode =
    consumerKind === 'schroeder-spatial-gas-pressure-boundary'
      ? 'source-consumer-lease-only'
      : consumerKind === 'pressure-interface'
        ? 'source-consumer-lease-and-generation'
        : null;
  if (
    queueOrderedRetirementMode == null
    || record.queueOrderedRetirementMode != null
    || (record.pressureMechanicsFamily && (record.pressureMechanicsFamily.closed || record.pressureMechanicsFamily.failed
      || consumerKind !== 'schroeder-spatial-gas-pressure-boundary'))
  ) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_CONSUMER_KIND_INVALID',
      'Gas pressure authority requires one exact supported consumer kind'
    );
  }
  const receipt = Object.freeze({
    schema: ULG_SPH_GAS_PRESSURE_CONSUMER_RECEIPT_SCHEMA,
    status: 'gas-pressure-authority-consumer-borrowed',
    consumerKind,
    deviceId: record.deviceId,
    executionGeneration: record.executionGeneration,
    storageGeneration: record.storageGeneration,
    pressureCellCapacity: record.capacity,
    pressureCellStrideFloats: SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS
  });
  const receiptRecord = {
    receipt,
    record,
    state: 'borrowed',
    consumerKind,
    bindCount: 0
  };
  retainedPressureConsumerReceipts.set(receipt, receiptRecord);
  record.activePressureConsumerReceipt = receipt;
  record.queueOrderedRetirementMode = queueOrderedRetirementMode;
  record.pressureConsumerBindCount += 1;
  return receipt;
}

/**
 * Encode the exact same-device pressure authority without publishing either
 * owner buffer. Bindings 3 and 6 are installed inside this owner boundary.
 */
export function encodeSphSpatialGasPressureAuthority(source, options = {}) {
  const record = livePressureSourceRecord(source);
  const receipt = reservePressureConsumerReceipt(record);
  try {
    // The borrow is reserved before inspecting caller-controlled options,
    // arrays, or proxies. Reentrant descriptor traps therefore cannot release
    // and reissue the private slot between validation and setBindGroup.
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw pressureAuthorityError(
        'ERR_SPH_GAS_PRESSURE_AUTHORITY_OPTIONS_INVALID',
        'Gas pressure encoding options must be an object'
      );
    }
    let optionKeys;
    try {
      optionKeys = Reflect.ownKeys(options);
    } catch (cause) {
      const error = pressureAuthorityError(
        'ERR_SPH_GAS_PRESSURE_AUTHORITY_OPTIONS_INVALID',
        'Gas pressure encoding options could not be inspected'
      );
      error.cause = cause;
      throw error;
    }
    const allowedOptionKeys = new Set([
      'device',
      'passEncoder',
      'bindGroupLayout',
      'bindGroupIndex',
      'publicEntries'
    ]);
    if (optionKeys.some((key) => !allowedOptionKeys.has(key))) {
      throw pressureAuthorityError(
        'ERR_SPH_GAS_PRESSURE_AUTHORITY_OPTIONS_INVALID',
        'Gas pressure encoding options contain an unsupported property'
      );
    }
    const device = ownDataDescriptor(
      options,
      'device',
      'gas pressure options.device'
    ).value;
    const passEncoder = ownDataDescriptor(
      options,
      'passEncoder',
      'gas pressure options.passEncoder'
    ).value;
    const bindGroupLayout = ownDataDescriptor(
      options,
      'bindGroupLayout',
      'gas pressure options.bindGroupLayout'
    ).value;
    const publicEntries = ownDataDescriptor(
      options,
      'publicEntries',
      'gas pressure options.publicEntries'
    ).value;
    const bindGroupIndex = optionKeys.includes('bindGroupIndex')
      ? ownDataDescriptor(
          options,
          'bindGroupIndex',
          'gas pressure options.bindGroupIndex'
        ).value
      : 0;
    if (record.device !== device) {
      throw pressureAuthorityError(
        'ERR_SPH_GAS_PRESSURE_AUTHORITY_DEVICE_MISMATCH',
        'Gas pressure authority belongs to another WebGPU device'
      );
    }
    if (
      !Number.isInteger(bindGroupIndex)
      || bindGroupIndex < 0
      || bindGroupIndex > 0xffff_ffff
    ) {
      throw pressureAuthorityError(
        'ERR_SPH_GAS_PRESSURE_AUTHORITY_BIND_GROUP_INDEX_INVALID',
        'Gas pressure bindGroupIndex must be a u32'
      );
    }
    const publicSnapshot = snapshotPressurePublicEntries(publicEntries, device);
    const createBindGroup = device?.createBindGroup;
    const setBindGroup = passEncoder?.setBindGroup;
    if (typeof createBindGroup !== 'function') {
      throw new TypeError('device.createBindGroup must be a function');
    }
    if (typeof setBindGroup !== 'function') {
      throw new TypeError('passEncoder.setBindGroup must be a function');
    }
    if (!bindGroupLayout || (
      typeof bindGroupLayout !== 'object'
      && typeof bindGroupLayout !== 'function'
    )) {
      throw new TypeError('bindGroupLayout must be a WebGPU layout object');
    }
    const bindGroup = createBindGroup.call(device, {
      label: `ulg-sph-gas-pressure-authority-${record.executionGeneration}`,
      layout: bindGroupLayout,
      entries: [
        ...publicSnapshot,
        {
          binding: 3,
          resource: { buffer: record.slot.gasPressureCellsBuffer }
        },
        {
          binding: 6,
          resource: { buffer: record.slot.controlBuffer }
        }
      ]
    });
    setBindGroup.call(passEncoder, bindGroupIndex, bindGroup);
    const receiptRecord = retainedPressureConsumerReceipts.get(receipt);
    if (receiptRecord?.state === 'borrowed') receiptRecord.bindCount += 1;
  } catch (error) {
    abandonSphSpatialGasPressureAuthority(receipt);
    throw error;
  }
  return Object.freeze({
    receipt,
    executionGeneration: record.executionGeneration,
    storageGeneration: record.storageGeneration,
    gasPressureCellRowCapacity: record.capacity,
    pressureInterfaceGasPressureCellRowStrideFloats:
      SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS
  });
}

const SPH_GAS_PRESSURE_MECHANICS_PUBLIC_BINDINGS = Object.freeze([
  0,
  1,
  2,
  5,
  7
]);
const SPH_GAS_PRESSURE_MECHANICS_PRIVATE_BINDINGS = Object.freeze([
  3,
  4,
  6,
  8
]);
const SPH_GAS_PRESSURE_EPOCH_FIELDS = Object.freeze([
  'storageGeneration',
  'physicsTick',
  'physicsSubstep',
  'positionEpoch',
  'topologyEpoch',
  'chartEpoch',
  'levelEpoch',
  'supportEpoch'
]);

function pressureMechanicsBindingError(message, cause = null) {
  const error = pressureAuthorityError(
    'ERR_SPH_GAS_PRESSURE_MECHANICS_AUTHORITY_ADMISSION',
    message
  );
  if (cause != null) error.cause = cause;
  return error;
}

function pressureMechanicsOption(options, key) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(options, key);
  } catch (cause) {
    throw pressureMechanicsBindingError(
      `Gas pressure mechanics options.${key} could not be inspected`,
      cause
    );
  }
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
    throw pressureMechanicsBindingError(
      `Gas pressure mechanics options.${key} must be an own data property`
    );
  }
  return descriptor.value;
}

function exactPressureMechanicsOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw pressureMechanicsBindingError(
      'Gas pressure mechanics binding options must be an object'
    );
  }
  let optionKeys;
  try {
    optionKeys = Reflect.ownKeys(options);
  } catch (cause) {
    throw pressureMechanicsBindingError(
      'Gas pressure mechanics binding options could not be inspected',
      cause
    );
  }
  const allowed = new Set([
    'device',
    'bindGroupLayout',
    'publicEntries',
    'phaseVolumeAuthority',
    'chartId'
  ]);
  if (optionKeys.some((key) => !allowed.has(key))) {
    throw pressureMechanicsBindingError(
      'Gas pressure mechanics binding options contain an unsupported property'
    );
  }
  return Object.freeze({
    device: pressureMechanicsOption(options, 'device'),
    bindGroupLayout: pressureMechanicsOption(options, 'bindGroupLayout'),
    publicEntries: pressureMechanicsOption(options, 'publicEntries'),
    phaseVolumeAuthority: pressureMechanicsOption(
      options,
      'phaseVolumeAuthority'
    ),
    chartId: pressureMechanicsOption(options, 'chartId')
  });
}

function pressureMechanicsEpochMatches(record, authority) {
  const identity = authority?.epochIdentity;
  return SPH_GAS_PRESSURE_EPOCH_FIELDS.every((field) => (
    Object.is(identity?.[field], record.epochIdentity[field])
    && Object.is(
      authority?.mechanicsFieldView?.[field],
      record.epochIdentity[field]
    )
  ));
}

function pressureMechanicsFieldGridMatches(field, expected, selectedLevel) {
  const dims = Array.from(field?.gridDims || []);
  return dims.length === 3
    && dims.every((value, axis) => Object.is(value, expected.gridDims[axis]))
    && Object.is(field?.gridNodeCount, expected.gridNodeCount)
    && Object.is(field?.gridShift, expected.gridShift)
    && Object.is(Math.fround(field?.gridSpacingM), expected.gridSpacingM)
    && Object.is(field?.selectedLevel, selectedLevel);
}

function pressureMechanicsMapping(record, authority) {
  const targetField = authority?.mechanicsFieldView ?? null;
  const gasField = record.selectedMechanicsFieldView ?? null;
  const generation = record.schroederSpatialEpochGeneration ?? null;
  const levelViews = Array.isArray(generation?.mechanicsLevelViews)
    ? generation.mechanicsLevelViews
    : [];
  const family=record.pressureMechanicsFamily;
  if(family){
    const index=family.fields.indexOf(targetField);
    if(family.closed || index!==family.completed || index<0
      || authority.selectedLevel!==targetField.selectedLevel || gasField!==family.fields.at(-1)) {
      throw pressureMechanicsBindingError('Pressure family requires each original native S9 consumer exactly once in order');
    }
    family.projection.validate();
    return Object.freeze({mode:'chain-adjoint',targetField,gasField,parentFieldView:null,
      familyIndex:index,coefficientBuffer:family.projection.nativeBuffers[index],
      completionOrdinal:family.projection.completionOrdinal});
  }
  if (
    targetField === gasField
    && Object.is(authority?.selectedLevel, record.level)
    && pressureMechanicsFieldGridMatches(
      targetField,
      record.spatialGasGrid,
      record.level
    )
  ) {
    return Object.freeze({
      mode: 'same-level',
      targetField,
      gasField,
      parentFieldView: null
    });
  }
  const parentFieldView = generation?.parentFieldView ?? null;
  const fineLevelView = levelViews[0] ?? null;
  const coarseLevelView = levelViews[1] ?? null;
  const parentAdmission = validateSchroederSpatialParentFieldViewDescriptor(
    parentFieldView
  );
  if (
    generation?.ready !== true
    || generation?.selected !== true
    || levelViews.length !== 2
    || generation?.mechanicsLevelCount !== 2
    || fineLevelView?.mechanicsFieldView !== targetField
    || coarseLevelView?.mechanicsFieldView !== gasField
    || targetField !== parentFieldView?.fineFieldView
    || gasField !== parentFieldView?.coarseFieldView
    || parentFieldView?.schema
      !== ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA
    || parentAdmission?.admitted !== true
    || !webGpuBufferMatchesDevice(parentFieldView?.parentFieldViewBuffer, record.device)
    || !Object.is(targetField?.selectedLevel + 1, gasField?.selectedLevel)
    || !Object.is(authority?.selectedLevel, targetField?.selectedLevel)
    || !Object.is(record.level, gasField?.selectedLevel)
    || !pressureMechanicsFieldGridMatches(
      targetField,
      parentFieldView?.fineGrid ?? {},
      targetField?.selectedLevel
    )
    || !pressureMechanicsFieldGridMatches(
      gasField,
      record.spatialGasGrid,
      record.level
    )
    || !Object.is(
      Math.fround(Number(targetField?.gridSpacingM) * 2),
      Math.fround(Number(gasField?.gridSpacingM))
    )
    || !Object.is(parentFieldView?.fineLevel, targetField?.selectedLevel)
    || !Object.is(parentFieldView?.coarseLevel, gasField?.selectedLevel)
    || !Object.is(parentFieldView?.fineFieldCapacity, targetField?.fieldCapacity)
    || !Object.is(parentFieldView?.coarseFieldCapacity, gasField?.fieldCapacity)
    || !Object.is(
      parentFieldView?.fineFieldView?.completionOrdinal,
      targetField?.completionOrdinal
    )
    || !Object.is(
      parentFieldView?.coarseFieldView?.completionOrdinal,
      gasField?.completionOrdinal
    )
  ) {
    throw pressureMechanicsBindingError(
      'Gas pressure mechanics fine target requires the exact live two-level parent-field CSR joining its S9 field to the producer coarse field'
    );
  }
  return Object.freeze({
    mode: 'fine-to-coarse-parent-adjoint',
    targetField,
    gasField,
    parentFieldView
  });
}

function validatePressureMechanicsAuthority(record, authority, chartId) {
  const targetField = authority?.mechanicsFieldView ?? null;
  if (
    authority?.schema
      !== 'peercompute.ulg.schroeder-spatial-phase-volume-surface-stress-authority.v1'
    || authority?.status
      !== 'schroeder-spatial-phase-volume-surface-stress-authority-ready'
    || authority?.generation !== record.schroederSpatialEpochGeneration
    || authority?.mechanicsFieldViewBuffer
      !== targetField?.fieldViewBuffer
    || authority?.phaseVolumeReceiptControlBuffer == null
    || authority?.phaseVolumeMomentBuffer == null
    || authority?.phaseVolumeReceipt?.mechanicsFieldView
      !== targetField
    || authority?.phaseVolumeMoment?.mechanicsFieldView
      !== targetField
    || authority?.phaseVolumeReceipt?.phaseVolumeMoment
      !== authority.phaseVolumeMoment
    || authority?.phaseVolumeReceipt?.controlBuffer
      !== authority.phaseVolumeReceiptControlBuffer
    || authority?.phaseVolumeMoment?.momentBuffer
      !== authority.phaseVolumeMomentBuffer
    || !Number.isSafeInteger(authority?.fieldCapacity)
    || authority.fieldCapacity < 1
    || authority.fieldCapacity !== authority.phaseVolumeReceipt?.fieldCapacity
    || authority.fieldCapacity !== targetField?.fieldCapacity
    || !pressureMechanicsEpochMatches(record, authority)
    || !Object.is(chartId, record.chartId)
    || !ownsSchroederSpatialEpochGenerationConsumerLease(
      record.generationConsumerLease,
      record.schroederSpatialEpochGeneration,
      record.device
    )
  ) {
    throw pressureMechanicsBindingError(
      'Gas pressure mechanics binding requires the exact live S9-A/S9-B field, epoch, chart, level, and grid used by its v4 producer'
    );
  }
  return pressureMechanicsMapping(record, authority);
}

function pressureMechanicsDirectoryMetadata(record) {
  const execution = record.spatialGeneration?.execution;
  const layout = execution?.layout;
  if (
    execution?.generationId !== record.spatialGenerationId
    || execution?.directoryBuffer == null
    || !layout
    || !Number.isSafeInteger(layout.wordLength)
    || layout.wordLength < 1
    || !Number.isSafeInteger(layout.cellCapacity)
    || layout.cellCapacity < 1
  ) {
    throw pressureMechanicsBindingError(
      'Gas pressure mechanics binding lost its exact sorted gas directory'
    );
  }
  return Object.freeze({
    schema: execution.directorySchema ?? layout.schema ?? null,
    abiVersion: execution.directoryAbiVersion ?? execution.abiVersion ?? null,
    generationId: record.spatialGenerationId,
    capacityWords: layout.wordLength,
    byteLength: layout.byteLength,
    cellCapacity: layout.cellCapacity,
    cellKeysOffsetWords: layout.cellKeysOffsetWords,
    cellOffsetsOffsetWords: layout.cellOffsetsOffsetWords,
    cellMembersOffsetWords: layout.cellMembersOffsetWords,
    memberToCellOffsetWords:
      layout.particleToCellOffsetWords
      ?? layout.physicalToCellPlusOneOffsetWords
      ?? null
  });
}

function pressureMechanicsPublicEntriesMatchAuthority(entries, authority) {
  if (
    entries.length !== SPH_GAS_PRESSURE_MECHANICS_PUBLIC_BINDINGS.length
    || entries.some((entry, index) => (
      entry.binding !== SPH_GAS_PRESSURE_MECHANICS_PUBLIC_BINDINGS[index]
      || Reflect.ownKeys(entry.resource).length !== 1
      || !Object.hasOwn(entry.resource, 'buffer')
    ))
  ) return false;
  const buffers = new Map(entries.map((entry) => [
    entry.binding,
    entry.resource.buffer
  ]));
  return buffers.get(0) === authority.mechanicsFieldViewBuffer
    && buffers.get(1) === authority.phaseVolumeReceiptControlBuffer
    && buffers.get(2) === authority.phaseVolumeMomentBuffer;
}

/**
 * Reserve the exact v4 pressure owner for the mechanics boundary operator and
 * create one opaque bind-group capability. Only metadata and a branded handle
 * escape; pressure rows, the gas directory, authority control, and bind group
 * stay private to this module.
 */
export function createSphSpatialGasPressureMechanicsAuthorityBinding(
  source,
  options = {}
) {
  const record = livePressureSourceRecord(source);
  const receipt = reservePressureConsumerReceipt(
    record,
    'schroeder-spatial-gas-pressure-boundary'
  );
  try {
    const {
      device,
      bindGroupLayout,
      publicEntries,
      phaseVolumeAuthority,
      chartId
    } = exactPressureMechanicsOptions(options);
    if (device !== record.device) {
      throw pressureAuthorityError(
        'ERR_SPH_GAS_PRESSURE_AUTHORITY_DEVICE_MISMATCH',
        'Gas pressure mechanics authority belongs to another WebGPU device'
      );
    }
    if (!Number.isInteger(chartId) || chartId < 0 || chartId > MAX_EXACT_F32_INTEGER) {
      throw pressureMechanicsBindingError(
        'Gas pressure mechanics chartId must be an exact non-negative f32 integer'
      );
    }
    const mapping = validatePressureMechanicsAuthority(
      record,
      phaseVolumeAuthority,
      chartId
    );
    const publicSnapshot = snapshotPressurePublicEntries(
      publicEntries,
      device,
      SPH_GAS_PRESSURE_MECHANICS_PRIVATE_BINDINGS
    ).slice().sort((left, right) => left.binding - right.binding);
    if (!pressureMechanicsPublicEntriesMatchAuthority(
      publicSnapshot,
      phaseVolumeAuthority
    )) {
      throw pressureMechanicsBindingError(
        'Gas pressure mechanics public bindings must be exactly 0/1/2/5/7 with the admitted mechanics field and S9-A/S9-B buffers'
      );
    }
    if (!bindGroupLayout || (
      typeof bindGroupLayout !== 'object'
      && typeof bindGroupLayout !== 'function'
    )) {
      throw new TypeError('bindGroupLayout must be a WebGPU layout object');
    }
    const createBindGroup = device?.createBindGroup;
    if (typeof createBindGroup !== 'function') {
      throw new TypeError('device.createBindGroup must be a function');
    }
    const directoryMetadata = pressureMechanicsDirectoryMetadata(record);
    const receiptRecord=retainedPressureConsumerReceipts.get(receipt);
    if(mapping.mode==='chain-adjoint'){
      const family=record.pressureMechanicsFamily;
      receiptRecord.familyIndex=mapping.familyIndex;
      if(mapping.familyIndex<family.fields.length-1){
        receiptRecord.queueOrderedCleanup=()=>{
          if(family.closed || family.failed || family.completed!==mapping.familyIndex
            || record.activePressureConsumerReceipt!==receipt || receiptRecord.state!=='borrowed'
            || receiptRecord.projectionPrepared!==true) throw pressureMechanicsBindingError('Pressure family member retirement is stale');
          return true;
        };
        receiptRecord.queueOrderedCleanupClaim=registerQueueOrderedCleanupClaim(gasPressureQueueOrderedCleanupClaimIssuer,
          device,{producerOutput:receipt,cleanup:receiptRecord.queueOrderedCleanup});
      }
    }
    const parentFieldViewBuffer = mapping.coefficientBuffer ?? mapping.parentFieldView?.parentFieldViewBuffer
      // The v2 shader never reads binding 8 in same-level mode. Reuse the
      // already-private read-only directory allocation as a non-authoritative
      // dummy so callers still cannot substitute topology.
      ?? record.spatialGeneration.execution.directoryBuffer;
    const bindGroup = createBindGroup.call(device, {
      label: `ulg-sph-gas-pressure-mechanics-${record.executionGeneration}`,
      layout: bindGroupLayout,
      entries: [
        ...publicSnapshot,
        {
          binding: 3,
          resource: { buffer: record.slot.gasPressureCellsBuffer }
        },
        {
          binding: 4,
          resource: {
            buffer: record.spatialGeneration.execution.directoryBuffer,
            offset: 0,
            size: record.spatialGeneration.execution.layout.byteLength
          }
        },
        {
          binding: 6,
          resource: { buffer: record.slot.controlBuffer }
        },
        {
          binding: 8,
          resource: mapping.parentFieldView
            ? {
                buffer: parentFieldViewBuffer,
                offset: 0,
                size: mapping.parentFieldView.layout.byteLength
              }
            : { buffer: parentFieldViewBuffer }
        }
      ].sort((left, right) => left.binding - right.binding)
    });
    const binding = Object.freeze({
      schema: ULG_SPH_GAS_PRESSURE_MECHANICS_BINDING_SCHEMA,
      status: 'gas-pressure-mechanics-authority-borrowed',
      receipt,
      deviceId: record.deviceId,
      executionGeneration: record.executionGeneration,
      storageGeneration: record.storageGeneration,
      epochIdentity: record.epochIdentity,
      chartId: record.chartId,
      level: mapping.targetField.selectedLevel,
      targetLevel: mapping.targetField.selectedLevel,
      gasLevel: record.level,
      crossLevelMappingMode: mapping.mode,
      fieldCapacity: phaseVolumeAuthority.fieldCapacity,
      gasPressureCellRowCapacity: record.capacity,
      gasPressureCellRowStrideFloats:
        SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS,
      gasDirectory: directoryMetadata,
      gasGridDims: record.spatialGasGrid.gridDims,
      gasGridNodeCount: record.spatialGasGrid.gridNodeCount,
      gasGridShift: record.spatialGasGrid.gridShift,
      gasGridSpacingM: record.spatialGasGrid.gridSpacingM,
      gasGridOriginM: record.boxMinM,
      gasGridMaxM: record.boxMaxM,
      gasControlVolumeDescriptor: record.gasControlVolumeDescriptor,
      targetGridDims: Object.freeze([
        ...Array.from(mapping.targetField.gridDims || [])
      ]),
      targetGridNodeCount: mapping.targetField.gridNodeCount,
      targetGridShift: mapping.targetField.gridShift,
      targetGridSpacingM: Math.fround(mapping.targetField.gridSpacingM),
      parentGenerationId: mapping.mode==='chain-adjoint' ? phaseVolumeAuthority.generationId : mapping.parentFieldView?.generationId ?? 0,
      parentCompletionOrdinal:
        mapping.completionOrdinal ?? mapping.parentFieldView?.completionOrdinal ?? 0,
      parentFieldCapacity: mapping.mode==='chain-adjoint' ? phaseVolumeAuthority.fieldCapacity : mapping.parentFieldView?.parentFieldCapacity ?? 0,
      parentFieldWordCapacity: mapping.mode==='chain-adjoint' ? 64+phaseVolumeAuthority.fieldCapacity : mapping.parentFieldView?.capacityWords ?? 0
    });
    retainedPressureMechanicsBindings.set(binding, {
      binding,
      receipt,
      record,
      device,
      bindGroup,
      paramsBuffer:publicSnapshot.find(entry=>entry.binding===7).resource.buffer,
      bindCount: 0
    });
    return binding;
  } catch (error) {
    abandonSphSpatialGasPressureAuthority(receipt);
    throw error;
  }
}

/** Install one private mechanics bind group on any pass in the same encoding. */
export function bindSphSpatialGasPressureMechanicsAuthority(
  binding,
  {
    device,
    passEncoder,
    bindGroupIndex = 0
  } = {}
) {
  const bindingRecord = retainedPressureMechanicsBindings.get(binding);
  const receiptRecord = retainedPressureConsumerReceipts.get(
    bindingRecord?.receipt
  );
  if (
    !bindingRecord
    || bindingRecord.binding !== binding
    || bindingRecord.device !== device
    || receiptRecord?.record !== bindingRecord.record
    || receiptRecord?.receipt !== bindingRecord.receipt
    || receiptRecord?.consumerKind
      !== 'schroeder-spatial-gas-pressure-boundary'
    || receiptRecord?.state !== 'borrowed'
    || bindingRecord.record.activePressureConsumerReceipt
      !== bindingRecord.receipt
  ) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_MECHANICS_AUTHORITY_BINDING_INVALID',
      'Gas pressure mechanics binding requires its exact live same-device handle'
    );
  }
  if (
    !Number.isInteger(bindGroupIndex)
    || bindGroupIndex < 0
    || bindGroupIndex > 0xffff_ffff
  ) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_BIND_GROUP_INDEX_INVALID',
      'Gas pressure mechanics bindGroupIndex must be a u32'
    );
  }
  const setBindGroup = passEncoder?.setBindGroup;
  if (typeof setBindGroup !== 'function') {
    throw new TypeError('passEncoder.setBindGroup must be a function');
  }
  setBindGroup.call(passEncoder, bindGroupIndex, bindingRecord.bindGroup);
  bindingRecord.bindCount += 1;
  receiptRecord.bindCount += 1;
  return true;
}

export function sphSpatialGasPressureAuthorityQueueOrderedClaim(
  receipt,
  device
) {
  const receiptRecord = retainedPressureConsumerReceipts.get(receipt);
  const record = receiptRecord?.record;
  if (
    !record
    || receiptRecord.receipt !== receipt
    || receiptRecord.state !== 'borrowed'
    || receiptRecord.bindCount < 1
    || record.activePressureConsumerReceipt !== receipt
    || record.device !== device
  ) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_RECEIPT_INVALID',
      'Gas pressure queue claim requires its exact borrowed receipt and device'
    );
  }
  queueOrderedPressureRetirementContext(record);
  if(record.pressureMechanicsFamily && (receiptRecord.projectionPrepared!==true
    || record.pressureMechanicsFamily.failed || record.pressureMechanicsFamily.closed
    || receiptRecord.familyIndex!==record.pressureMechanicsFamily.completed)) {
    throw pressureMechanicsBindingError('Pressure family member lacks its original prepared projection');
  }
  return receiptRecord.queueOrderedCleanupClaim ?? record.queueOrderedCleanupClaim;
}

export function retireSphSpatialGasPressureAuthorityQueueOrdered(
  receipt,
  device,
  queueOrderedFinalConsumer
) {
  const receiptRecord = retainedPressureConsumerReceipts.get(receipt);
  const record = receiptRecord?.record;
  if (
    !record
    || receiptRecord.receipt !== receipt
    || receiptRecord.state !== 'borrowed'
    || record.activePressureConsumerReceipt !== receipt
    || record.device !== device
  ) return false;
  queueOrderedPressureRetirementContext(record);
  try {
    releaseSubmittedWorkCleanupQueueOrdered(
      device,
      receiptRecord.queueOrderedCleanup ?? record.queueOrderedCleanup,
      {
        queueOrderedFinalConsumer,
        producerClaim: receiptRecord.queueOrderedCleanupClaim ?? record.queueOrderedCleanupClaim,
        producerOutput: receiptRecord.queueOrderedCleanupClaim ? receipt : record.gasCellSource,
        producerFamily: GAS_PRESSURE_QUEUE_ORDERED_PRODUCER_FAMILY
      }
    );
  } catch (error) {
    if (record.terminal) receiptRecord.state = 'terminal';
    throw error;
  }
  receiptRecord.state = 'submitted';
  record.activePressureConsumerReceipt = null;
  const family=record.pressureMechanicsFamily;
  if(family){family.completed++;record.queueOrderedRetirementMode=null;}
  record.pressureConsumerSubmitted = !family || family.completed===family.fields.length;
  record.pressureConsumerSubmitCount += 1;
  return true;
}

/** Mark the exact receipt immediately after the pressure command is submitted. */
export function markSphSpatialGasPressureAuthoritySubmitted(receipt) {
  const receiptRecord = retainedPressureConsumerReceipts.get(receipt);
  const record = receiptRecord?.record;
  if (
    !record
    || record.pressureMechanicsFamily
    || receiptRecord.receipt !== receipt
    || receiptRecord.state !== 'borrowed'
    || record.activePressureConsumerReceipt !== receipt
    || record.terminal
    || record.released
    || record.releasePromise
    || record.slot.ownerToken !== record.ownerToken
    || record.slot.retainedExecution !== record.execution
  ) {
    return false;
  }
  receiptRecord.state = 'submitted';
  record.activePressureConsumerReceipt = null;
  record.pressureConsumerSubmitted = true;
  record.pressureConsumerSubmitCount += 1;
  return true;
}

/** Abandon only a pre-submit borrow so a later valid consumer may retry. */
export function abandonSphSpatialGasPressureAuthority(receipt) {
  const receiptRecord = retainedPressureConsumerReceipts.get(receipt);
  const record = receiptRecord?.record;
  if (
    !record
    || receiptRecord.receipt !== receipt
    || receiptRecord.state !== 'borrowed'
    || record.activePressureConsumerReceipt !== receipt
  ) {
    return false;
  }
  receiptRecord.state = 'abandoned';
  if(receiptRecord.queueOrderedCleanupClaim){
    cancelQueueOrderedCleanupClaim(receiptRecord.queueOrderedCleanupClaim,record.device,
      {producerOutput:receipt,cleanup:receiptRecord.queueOrderedCleanup});
  }
  if(record.pressureMechanicsFamily)record.pressureMechanicsFamily.failed=true;
  record.activePressureConsumerReceipt = null;
  record.queueOrderedRetirementMode = null;
  record.pressureConsumerAbandonCount += 1;
  return true;
}

/**
 * A throwing queue.submit has unknown acceptance semantics. Revoke the receipt
 * and quarantine the complete owner graph until device loss rather than
 * treating that uncertainty as a retryable pre-submit abandonment.
 */
export function quarantineSphSpatialGasPressureAuthorityAfterSubmitFailure(
  receipt,
  device,
  reason = null
) {
  const receiptRecord = retainedPressureConsumerReceipts.get(receipt);
  const record = receiptRecord?.record;
  if (
    !record
    || receiptRecord.receipt !== receipt
    || receiptRecord.state !== 'borrowed'
    || record.activePressureConsumerReceipt !== receipt
    || record.device !== device
  ) return false;
  receiptRecord.state = 'terminal';
  record.activePressureConsumerReceipt = null;
  record.pressureConsumerSubmitted = true;
  record.pressureConsumerSubmitCount += 1;
  record.releaseError = typeof reason === 'string' && reason.length > 0
    ? reason
    : 'queue.submit failed with unknown acceptance';
  record.quarantined = true;
  record.terminal = true;
  record.slot.terminal = true;
  record.status =
    'spatial-gas-ledger-eos-pressure-consumer-submit-failure-quarantined';
  return true;
}

/**
 * Build one retained particle/product-residual candidate union, its
 * family-specific SS directory, and the local ideal-gas EOS pressure rows
 * without mapping or fencing the normal hot path. The returned owner must be
 * released only after its final same-queue consumer has submitted.
 */
export async function runSphSpatialGasLedgerEosRetainedWebGpu({
  device,
  retainedProductEventSource = null,
  residentProductMass = null,
  productEventBuffer = null,
  productEventRowCount = null,
  productEventStrideFloats = null,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  particleStateBuffer = null,
  particleThermoBuffer = null,
  particleCount = null,
  particleStateStrideFloats = null,
  particleThermoStrideFloats = null,
  schroederLevelAssignment = null,
  epochIdentity = null,
  schroederSpatialEpochGeneration = null,
  aerosolFamily = undefined,
  spatialGasGrid = null,
  boxMinM = [0, 0, 0],
  boxMaxM = null,
  spatialGasCellSizeM = null,
  spatialGasSupportVolumeFallbackM3 = 0,
  fallbackTemperatureK = DEFAULT_GAS_TEMPERATURE_K,
  gasConstantJPerMolK = DEFAULT_GAS_CONSTANT_J_PER_MOL_K,
  chartId = 0,
  level = 0,
  laneId = 'sph-spatial-gas-ledger-eos',
  diagnosticsMode = SPH_SPATIAL_GAS_DIAGNOSTICS_NONE,
  speciesDiagnostics = null,
  authenticateParticleProductSource = false,
  sourceFamilyConsumerLease = null,
  postMechanicsGasSource = null,
  schroederParticleContinuation = null,
  caloricAuthority = null,
  caloricThermalMaterialTable = null
} = {}) {
  if (
    !device?.createBuffer
    || !device?.createCommandEncoder
    || !device?.queue?.writeBuffer
    || !device?.queue?.submit
  ) {
    throw new TypeError(
      'runSphSpatialGasLedgerEosRetainedWebGpu requires a WebGPU-like device and queue'
    );
  }
  const retainedReadbackTelemetry = createGpuReadbackTelemetryAccumulator({
    scope: 'sph-spatial-gas-ledger-eos-retained'
  });
  let spatialGeneration = null;
  let spatialGenerationAttempted = false;
  let canonicalExactMassRead = null;
  const releaseCanonicalOnEarlyExit = () => {
    if (canonicalExactMassRead) {
      void canonicalExactMassRead.release();
      canonicalExactMassRead = null;
    }
  };
  const retainedReadbackTelemetrySnapshot = () => mergeGpuReadbackTelemetry([
    {
      source: 'retained-spatial-gas-eos',
      telemetry: retainedReadbackTelemetry.snapshot()
    },
    ...(spatialGeneration ? [{
      source: 'schroeder-spatial-generation',
      telemetry: spatialGeneration
    }] : [])
  ], {
    scope: 'sph-spatial-gas-ledger-eos-retained'
  });
  const rejectedExecutionWithTelemetry = (status, reason, extra = {}) => {
    releaseCanonicalOnEarlyExit();
    return {
      ...rejectedExecution(status, reason, extra),
      ...retainedReadbackTelemetrySnapshot()
    };
  };
  let expectedAerosolFamily = aerosolFamily;
  try {
    if (sphParticleUpload != null) {
      const uploadFamily = sphAerosolSourceFamily(sphParticleUpload);
      if (aerosolFamily !== undefined && aerosolFamily !== uploadFamily) {
        throw new TypeError('EOS aerosol input conflicts with the supplied particle upload family');
      }
      // A supplied upload declares absence explicitly too. Do not let an
      // unsealed legacy generation hide its known aerosol inventory, or let
      // an upload which omitted the reservoir consume a nonempty SS source.
      expectedAerosolFamily = uploadFamily;
    }
  } catch (error) {
    return rejectedExecutionWithTelemetry('spatial-gas-ledger-eos-rejected-aerosol-source', error.message);
  }
  if (
    diagnosticsMode !== SPH_SPATIAL_GAS_DIAGNOSTICS_NONE
    && diagnosticsMode !== SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE
  ) {
    return rejectedExecutionWithTelemetry(
      'spatial-gas-ledger-eos-rejected-diagnostics-mode',
      `Unsupported diagnostics mode: ${diagnosticsMode}`
    );
  }
  const normalizedEpoch = normalizeEpochIdentity(epochIdentity);
  if (normalizedEpoch.error) {
    return rejectedExecutionWithTelemetry(
      'spatial-gas-ledger-eos-rejected-epoch-identity',
      normalizedEpoch.error.message
    );
  }
  const normalizedProductSource = await normalizeProductEventSource({
    device,
    retainedProductEventSource,
    residentProductMass,
    productEventBuffer,
    productEventRowCount,
    productEventStrideFloats
  });
  if (normalizedProductSource.error) {
    return {
      ...normalizedProductSource.error,
      ...retainedReadbackTelemetrySnapshot()
    };
  }
  if (
    schroederParticleContinuation != null
    && postMechanicsGasSource == null
    && sphParticleUpload != null
  ) {
    try {
      const fusedMod = await import('./schroederFusedFineSubstepGpu.js');
      canonicalExactMassRead = fusedMod.acquireSchroederCanonicalParticleExactMassRead(
        device,
        schroederParticleContinuation,
        { sphParticleUpload, mlsMpmParticleUpload }
      );
    } catch (error) {
      return rejectedExecutionWithTelemetry(
        'spatial-gas-ledger-eos-rejected-particle-source-lifecycle',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  const normalizedParticleSource = normalizeParticleSource({
    device,
    sphParticleUpload,
    mlsMpmParticleUpload,
    particleStateBuffer,
    particleThermoBuffer,
    particleCount,
    particleStateStrideFloats,
    particleThermoStrideFloats,
    schroederSpatialEpochGeneration,
    schroederLevelAssignment,
    // This only defers lifetime admission: the private current pair or canonical
    // fine-substep exact-mass continuation must be authenticated and retained
    // before allocating or submitting work.
    deferLifecycleToCurrentPair: postMechanicsGasSource != null || canonicalExactMassRead != null
  });
  if (normalizedParticleSource.error) {
    releaseCanonicalOnEarlyExit();
    return {
      ...normalizedParticleSource.error,
      ...retainedReadbackTelemetrySnapshot()
    };
  }
  if (
    normalizedProductSource.present !== true
    && normalizedParticleSource.present !== true
  ) {
    return rejectedExecutionWithTelemetry(
      'spatial-gas-ledger-eos-rejected-empty-source-domain',
      'At least one exact product-event or particle candidate source is required'
    );
  }
  if (
    normalizedProductSource.present === true
    && normalizedParticleSource.present === true
    && (
      normalizedProductSource.buffer === normalizedParticleSource.stateBuffer
      || normalizedProductSource.buffer
        === normalizedParticleSource.thermoBuffer
    )
  ) {
    return rejectedExecutionWithTelemetry(
      'spatial-gas-ledger-eos-rejected-cross-family-buffer-alias',
      'Product-event, particle-state, and particle-thermo sources must use distinct exact ABI buffers'
    );
  }
  const productCandidateCapacity = normalizedProductSource.present === true
    ? Math.min(
        normalizedProductSource.rowCount,
        Math.max(
          SPH_SPATIAL_GAS_COMPACT_CAPACITY_FLOOR_ROWS,
          normalizedProductSource.liveRowCountUpperBound
        )
      )
    : 0;
  const candidateCount = productCandidateCapacity
    + normalizedParticleSource.particleCount;
  if (
    !Number.isSafeInteger(candidateCount)
    || candidateCount < 1
    || candidateCount > MAX_EXACT_F32_INTEGER
  ) {
    return rejectedExecutionWithTelemetry(
      'spatial-gas-ledger-eos-rejected-union-capacity',
      `Combined gas candidate count must be in [1, ${MAX_EXACT_F32_INTEGER}]`,
      {
        productCandidateCapacity,
        particleCount: normalizedParticleSource.particleCount,
        candidateCount: Number.isFinite(candidateCount) ? candidateCount : null
      }
    );
  }
  const compactCapacityRowBound = candidateCount;
  let normalizedSpeciesDiagnostics;
  try {
    normalizedSpeciesDiagnostics = normalizeSphSpatialGasSpeciesDiagnostics(
      speciesDiagnostics, device, nextPowerOfTwo(compactCapacityRowBound)
    );
  } catch (error) {
    return rejectedExecutionWithTelemetry(
      'spatial-gas-ledger-eos-rejected-species-diagnostic', error.message
    );
  }
  const normalizedGrid = normalizeAuthoritativeSpatialGasGrid(
    spatialGasGrid,
    schroederSpatialEpochGeneration
  );
  if (normalizedGrid.error) {
    return rejectedExecutionWithTelemetry(
      'spatial-gas-ledger-eos-rejected-spatial-grid',
      normalizedGrid.error.message
    );
  }
  let cellSizeM;
  let supportVolumeFallbackM3;
  let resolvedFallbackTemperatureK;
  let resolvedGasConstant;
  let resolvedChartId;
  let resolvedLevel;
  let resolvedBoxMinM;
  let resolvedBoxMaxM;
  let gasControlVolumeDescriptor;
  let capacityDispatchCount;
  try {
    supportVolumeFallbackM3 = nonNegativeFiniteF32(
      spatialGasSupportVolumeFallbackM3,
      'spatialGasSupportVolumeFallbackM3'
    );
    const inferredCellSizeM = spatialGasCellSizeM == null
      ? normalizedGrid.gridSpacingM
      : spatialGasCellSizeM;
    cellSizeM = positiveFiniteF32(inferredCellSizeM, 'spatialGasCellSizeM');
    if (!Object.is(cellSizeM, normalizedGrid.gridSpacingM)) {
      throw new TypeError(
        'spatialGasCellSizeM must equal the selected SS occupancy spacing'
      );
    }
    resolvedFallbackTemperatureK = positiveFiniteF32(
      fallbackTemperatureK,
      'fallbackTemperatureK'
    );
    resolvedGasConstant = positiveFiniteF32(
      gasConstantJPerMolK,
      'gasConstantJPerMolK'
    );
    resolvedChartId = exactU32(chartId, 'chartId');
    if (resolvedChartId > MAX_EXACT_F32_INTEGER) {
      throw new RangeError('chartId exceeds exact f32 integer identity');
    }
    resolvedLevel = Number(level);
    if (
      !Number.isInteger(resolvedLevel)
      || resolvedLevel < -MAX_EXACT_F32_INTEGER
      || resolvedLevel > MAX_EXACT_F32_INTEGER
    ) {
      throw new RangeError('level exceeds exact f32 signed integer identity');
    }
    if (resolvedLevel !== normalizedGrid.selectedLevel) {
      throw new TypeError(
        'spatial gas level must equal the selected SS occupancy level'
      );
    }
    if (
      (!Array.isArray(boxMinM) && !ArrayBuffer.isView(boxMinM))
      || (!Array.isArray(boxMaxM) && !ArrayBuffer.isView(boxMaxM))
      || boxMinM.length !== 3
      || boxMaxM.length !== 3
    ) {
      throw new TypeError('boxMinM and boxMaxM must be array-like vec3 values');
    }
    resolvedBoxMinM = Object.freeze(Array.from(
      boxMinM,
      (value, axis) => {
        finiteF32(value, `boxMinM[${axis}]`);
        return Number(value);
      }
    ));
    resolvedBoxMaxM = Object.freeze(Array.from(
      boxMaxM,
      (value, axis) => {
        finiteF32(value, `boxMaxM[${axis}]`);
        return Number(value);
      }
    ));
    if (
      resolvedBoxMaxM.some((value, axis) => (
        !(value > resolvedBoxMinM[axis])
      ))
    ) {
      throw new RangeError(
        'boxMaxM must be strictly greater than boxMinM on every axis'
      );
    }
    gasControlVolumeDescriptor = createSchroederQuadraticControlVolumeDescriptor({
      ...normalizedGrid,
      chartId: resolvedChartId,
      selectedLevel: resolvedLevel,
      boxMinM: resolvedBoxMinM,
      boxMaxM: resolvedBoxMaxM
    });
    capacityDispatchCount = sphSpatialGasLedgerEosDispatchWorkgroups(
      device,
      nextPowerOfTwo(compactCapacityRowBound)
    );
  } catch (error) {
    return rejectedExecutionWithTelemetry(
      error?.code === 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_DISPATCH_LIMIT'
        ? 'spatial-gas-ledger-eos-rejected-dispatch-limit'
        : 'spatial-gas-ledger-eos-rejected-grid-contract',
      error.message,
      error?.code === 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_DISPATCH_LIMIT'
        ? {
            errorCode: error.code,
            requiredWorkgroups: error.requiredWorkgroups,
            maxComputeWorkgroupsPerDimension:
              error.maxComputeWorkgroupsPerDimension
          }
        : {}
    );
  }

  let releaseSourceBorrow = sourceBorrowSetFor([
    ...(normalizedProductSource.present === true
      ? [normalizedProductSource.source]
      : []),
    ...(normalizedParticleSource.present === true
        && postMechanicsGasSource == null
        && canonicalExactMassRead == null
      ? [normalizedParticleSource.source]
      : [])
  ]);
  if (typeof releaseSourceBorrow !== 'function') {
    return rejectedExecutionWithTelemetry(
      'spatial-gas-ledger-eos-rejected-source-lifecycle',
      'Unable to acquire every exact retained gas-candidate source borrow'
    );
  }
  if (canonicalExactMassRead) {
    releaseSourceBorrow = withCanonicalParticleExactMassBorrow(
      releaseSourceBorrow,
      canonicalExactMassRead
    );
    canonicalExactMassRead = null;
  }
  let particleProductSourcePair = null;
  try {
    if (typeof authenticateParticleProductSource !== 'boolean'
      || (sourceFamilyConsumerLease != null && !authenticateParticleProductSource && !caloricAuthority)) {
      throw new TypeError('Gas source-pair admission requires an explicit complete-source request');
    }
    if (authenticateParticleProductSource || caloricAuthority != null || postMechanicsGasSource != null) {
      if (!normalizedParticleSource.present) {
        throw new TypeError('A complete gas mixture must include its exact particle source');
      }
      if (normalizedProductSource.present && (
        normalizedProductSource.rowCount !== normalizedProductSource.source.productEventRowCount
        || normalizedProductSource.strideFloats !== normalizedProductSource.source.productEventStrideFloats
        || normalizedProductSource.buffer !== normalizedProductSource.source.productEventBuffer
      )) {
        throw new TypeError('A complete gas mixture cannot truncate or substitute its retained product history');
      }
      const pairOptions = { device,
        sphParticleUpload, mlsMpmParticleUpload,
        residentProductMass: normalizedProductSource.source,
        consumerLease: sourceFamilyConsumerLease, epochIdentity: normalizedEpoch,
        required: caloricAuthority != null, particleCount: normalizedParticleSource.particleCount };
      if (postMechanicsGasSource != null) {
        if (sourceFamilyConsumerLease != null) {
          throw new TypeError('A current private gas source cannot use a published source-family lease');
        }
        const current = await import('./sphPostMechanicsGasStateGpu.js');
        particleProductSourcePair = current.retainSphPostMechanicsGasSourcePair(postMechanicsGasSource, {
          ...pairOptions, generation: schroederSpatialEpochGeneration,
          levelAssignment: schroederLevelAssignment
        });
      } else {
        particleProductSourcePair = retainParticleProductSourcePair(pairOptions);
      }
      releaseSourceBorrow = withParticleProductSourceBorrow(releaseSourceBorrow, particleProductSourcePair);
    }
  } catch (error) {
    releaseSourceBorrow();
    return rejectedExecutionWithTelemetry('spatial-gas-ledger-eos-rejected-particle-product-pair',
      error.message, { errorCode: error.code ?? null });
  }
  let generationConsumerLease;
  try {
    generationConsumerLease =
      acquireSchroederSpatialEpochGenerationConsumerLease(
        schroederSpatialEpochGeneration,
        { consumerId: `${laneId}:gas-free-volume` }
      );
  } catch (error) {
    releaseSourceBorrow();
    return rejectedExecutionWithTelemetry(
      'spatial-gas-ledger-eos-rejected-spatial-generation-lease',
      error instanceof Error ? error.message : String(error),
      { errorCode: error?.code ?? null }
    );
  }
  let arena;
  try {
    arena = await acquireArenaSlot(device, compactCapacityRowBound, {
      onBeforeBackpressureAwait: () => {
        retainedReadbackTelemetry.recordAwaitedBackpressureHostQueueFence(
          1,
          'spatial-gas-arena-release-backpressure'
        );
      }
    });
  } catch (error) {
    releaseSourceBorrow();
    releaseSchroederSpatialEpochGenerationConsumerLease(
      generationConsumerLease,
      { discardedEncoder: true }
    );
    return rejectedExecutionWithTelemetry(
      error.code === 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_BACKPRESSURE'
        ? 'spatial-gas-ledger-eos-backpressure'
        : 'spatial-gas-ledger-eos-rejected-arena',
      error.message,
      { errorCode: error.code ?? null }
    );
  }
  const {
    runtime,
    slot,
    capacity,
    backpressureWaited,
    backpressureWaitCount
  } = arena;
  const ownerToken = slot.ownerToken;
  const executionGeneration = exactU32(
    ownerToken.serial,
    'spatial gas execution generation',
    { positive: true }
  );
  let adapterSubmissionAttempted = false;
  let adapterSubmitted = false;
  let gasFreeVolumeRuntime = null;
  let gasFreeVolumeExecution = null;
  let gasFreeVolumeEosReceipt = null;
  let adapterScanDispatchCount = 0;
  let queueOrderedPressureRecord = null;
  let caloricModule = null;
  let caloricData = null;
  let exactHistoryProjection = null;
  let exactHistoryVolumeInput = null;
  try {
    particleProductSourcePair?.validate();
    if (normalizedProductSource.exactHistoryLayout) {
      if (!sphParticleUpload?.identityBuffer) {
        throw new TypeError('Exact gas history requires its associated particle identity');
      }
      const history = await import('./sphMlsMpmGpuStep.js');
      const source = history.acquireResidentProductExactHistoryRead(normalizedProductSource.source,
        { device, identityBuffer: sphParticleUpload.identityBuffer });
      const allocations = new Set();
      let released = false;
      // Join the existing EOS failure/retirement lifecycle before any awaited
      // allocation or compilation. The original paired owner supplies the
      // parent hold when queue-ordered retirement is admitted.
      releaseSourceBorrow = withParticleProductSourceBorrow(releaseSourceBorrow, {
        isReleased: () => released,
        canReleaseQueueOrdered: () => { source.validate(); return true; },
        release: () => {
          if (released) return true;
          if (exactHistoryVolumeInput) retainedGasHistoryVolumeInputs.delete(exactHistoryVolumeInput);
          for (const buffer of allocations) { buffer.destroy(); allocations.delete(buffer); }
          source.release(); released = true; return true;
        }
      });
      exactHistoryProjection = await prepareSphExactHistoryGasViews({ device, source,
        allocate: descriptor => { const buffer = device.createBuffer(descriptor); allocations.add(buffer); return buffer; } });
    }
    if (caloricAuthority != null) {
      caloricModule = await caloricAdmissionModule();
      particleProductSourcePair.validate();
      caloricData = caloricModule.resolveSphSpatialGasCaloricAuthority(caloricAuthority,
        { thermalMaterialTable: caloricThermalMaterialTable });
      prepareCaloricBuffers(device, slot, caloricData.records);
    }
    const adapter = adapterPipelines(device, exactHistoryProjection != null);
    const productBindingBuffer = exactHistoryProjection?.outputBuffer ?? (normalizedProductSource.present === true
      ? normalizedProductSource.buffer
      : normalizedParticleSource.stateBuffer);
    const productBindingByteLength = exactHistoryProjection?.outputBuffer.size ?? (normalizedProductSource.present === true
      ? normalizedProductSource.requiredBytes
      : normalizedParticleSource.stateRequiredBytes);
    const productBindingStride = exactHistoryProjection ? SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS : normalizedProductSource.strideFloats;
    const exactHistoryValidationEntry = exactHistoryProjection
      ? [{ binding: 9, resource: { buffer: exactHistoryProjection.validationBuffer } }] : [];
    const particleStateBindingBuffer = normalizedParticleSource.present === true
      ? normalizedParticleSource.stateBuffer
      : normalizedProductSource.buffer;
    const particleStateBindingByteLength = normalizedParticleSource.present === true
      ? normalizedParticleSource.stateRequiredBytes
      : normalizedProductSource.requiredBytes;
    const particleThermoBindingBuffer = normalizedParticleSource.present === true
      ? normalizedParticleSource.thermoBuffer
      : normalizedProductSource.buffer;
    const particleThermoBindingByteLength = normalizedParticleSource.present === true
      ? normalizedParticleSource.thermoRequiredBytes
      : normalizedProductSource.requiredBytes;
    device.queue.writeBuffer(slot.controlBuffer, 0, initialAuthorityControl({
      executionGeneration,
      storageGeneration: normalizedEpoch.storageGeneration,
      sourceCapacity: capacity,
      gasControlVolumeDescriptor
    }));
    device.queue.writeBuffer(slot.paramsBuffer, 0, adapterParams({
      rowCount: normalizedProductSource.rowCount,
      sourceCapacity: capacity,
      strideFloats: productBindingStride,
      productSourcePresent: normalizedProductSource.present === true,
      productCandidateCapacity,
      particleCount: normalizedParticleSource.particleCount,
      particleStateStrideFloats:
        normalizedParticleSource.stateStrideFloats,
      particleThermoStrideFloats:
        normalizedParticleSource.thermoStrideFloats,
      candidateCount,
      cellSizeM,
      chartId: resolvedChartId,
      level: resolvedLevel,
      executionGeneration,
      fallbackTemperatureK: resolvedFallbackTemperatureK,
      liveCountDescriptor: normalizedProductSource.liveCountDescriptor,
      requireCompleteOccupancy: postMechanicsGasSource != null || exactHistoryProjection != null
    }));
    const classifyBindGroup = makeBindGroup(
      device,
      `${slot.label}-adapter-classify-bind-group`,
      adapter.classify.bindGroupLayout,
      [
        ...exactHistoryValidationEntry,
        {
          binding: 0,
          resource: {
            buffer: productBindingBuffer,
            offset: 0,
            size: productBindingByteLength
          }
        },
        { binding: 1, resource: { buffer: slot.candidateFlagsBuffer } },
        { binding: 5, resource: { buffer: slot.controlBuffer } },
        { binding: 6, resource: { buffer: slot.paramsBuffer } },
        {
          binding: 7,
          resource: {
            buffer: particleStateBindingBuffer,
            offset: 0,
            size: particleStateBindingByteLength
          }
        },
        {
          binding: 8,
          resource: {
            buffer: particleThermoBindingBuffer,
            offset: 0,
            size: particleThermoBindingByteLength
          }
        }
      ]
    );
    const finalizeBindGroup = makeBindGroup(
      device,
      `${slot.label}-adapter-finalize-bind-group`,
      adapter.finalize.bindGroupLayout,
      [
        ...exactHistoryValidationEntry,
        { binding: 1, resource: { buffer: slot.candidateFlagsBuffer } },
        { binding: 2, resource: { buffer: slot.candidateOffsetsBuffer } },
        { binding: 5, resource: { buffer: slot.controlBuffer } },
        { binding: 6, resource: { buffer: slot.paramsBuffer } }
      ]
    );
    const scatterBindGroup = makeBindGroup(
      device,
      `${slot.label}-adapter-scatter-bind-group`,
      adapter.scatter.bindGroupLayout,
      [
        ...exactHistoryValidationEntry,
        {
          binding: 0,
          resource: {
            buffer: productBindingBuffer,
            offset: 0,
            size: productBindingByteLength
          }
        },
        { binding: 1, resource: { buffer: slot.candidateFlagsBuffer } },
        { binding: 2, resource: { buffer: slot.candidateOffsetsBuffer } },
        { binding: 3, resource: { buffer: slot.compactRowsBuffer } },
        { binding: 4, resource: { buffer: slot.activeNodeBuffer } },
        { binding: 5, resource: { buffer: slot.controlBuffer } },
        { binding: 6, resource: { buffer: slot.paramsBuffer } },
        {
          binding: 7,
          resource: {
            buffer: particleStateBindingBuffer,
            offset: 0,
            size: particleStateBindingByteLength
          }
        },
        {
          binding: 8,
          resource: {
            buffer: particleThermoBindingBuffer,
            offset: 0,
            size: particleThermoBindingByteLength
          }
        }
      ]
    );
    const adapterEncoder = device.createCommandEncoder({
      label: `${slot.label}-adapter-encoder`
    });
    exactHistoryProjection?.encode(adapterEncoder);
    if (normalizedProductSource.liveCountDescriptor) {
      if (typeof adapterEncoder.copyBufferToBuffer !== 'function') {
        throw new Error(
          'GPU-count product history requires device-side gas source-count propagation'
        );
      }
      adapterEncoder.copyBufferToBuffer(
        normalizedProductSource.liveCountDescriptor.controlBuffer,
        normalizedProductSource.liveCountDescriptor.controlOffsetBytes,
        slot.paramsBuffer,
        0,
        normalizedProductSource.liveCountDescriptor.controlPrefixByteLength
      );
    }
    const classifyPass = adapterEncoder.beginComputePass({
      label: `${slot.label}-adapter-classify-pass`
    });
    classifyPass.setPipeline(adapter.classify.pipeline);
    classifyPass.setBindGroup(0, classifyBindGroup);
    classifyPass.dispatchWorkgroups(capacityDispatchCount);
    classifyPass.end();
    const preparedScan = slot.compactionScan.prepare({
      inputBuffer: slot.candidateFlagsBuffer,
      outputBuffer: slot.candidateOffsetsBuffer,
      elementCount: capacity
    });
    slot.compactionScan.encodePrepared(adapterEncoder, preparedScan, {
      labelPrefix: `${slot.label}-adapter-candidate`
    });
    adapterScanDispatchCount = preparedScan.encodedDispatchCount;
    const finalizePass = adapterEncoder.beginComputePass({
      label: `${slot.label}-adapter-finalize-pass`
    });
    finalizePass.setPipeline(adapter.finalize.pipeline);
    finalizePass.setBindGroup(0, finalizeBindGroup);
    finalizePass.dispatchWorkgroups(1);
    finalizePass.end();
    const scatterPass = adapterEncoder.beginComputePass({
      label: `${slot.label}-adapter-scatter-pass`
    });
    scatterPass.setPipeline(adapter.scatter.pipeline);
    scatterPass.setBindGroup(0, scatterBindGroup);
    scatterPass.dispatchWorkgroups(capacityDispatchCount);
    scatterPass.end();
    // Encoder finalization is still provably pre-submit. Once queue.submit is
    // entered, however, a throw has unknown acceptance semantics. Record the
    // attempt immediately before that call so cleanup cannot recycle the
    // source borrow or arena slot while accepted GPU work may still use them.
    const adapterCommandBuffer = adapterEncoder.finish();
    exactHistoryProjection?.validate();
    particleProductSourcePair?.validate();
    adapterSubmissionAttempted = true;
    device.queue.submit([adapterCommandBuffer]);
    adapterSubmitted = true;

    const directorySource = activeNodeDirectorySource({
      slot,
      capacity,
      executionGeneration,
      epochIdentity: normalizedEpoch,
      cellSizeM,
      chartId: resolvedChartId,
      level: resolvedLevel
    });
    spatialGenerationAttempted = true;
    spatialGeneration = await runSchroederSpatialEpochGenerationWithBackpressureWebGpu({
      device,
      activeNodeList: directorySource,
      particleCount: capacity,
      laneId,
      sourceFamily: SPATIAL_GAS_UNION_SOURCE_FAMILY,
      allowPhaseVolumeOverlay: false
    });
    particleProductSourcePair?.validate();
    if (caloricModule && !caloricModule.validateSphSpatialGasCaloricAuthority(caloricAuthority,
      { thermalMaterialTable: caloricThermalMaterialTable })) {
      throw new TypeError('Gas caloric table changed during retained source construction');
    }
    if (
      spatialGeneration?.ready !== true
      || spatialGeneration?.selected !== true
      || spatialGeneration?.execution?.sourceBuffer !== slot.activeNodeBuffer
      || spatialGeneration?.execution?.directoryBuffer == null
      || spatialGeneration?.execution?.logicalSourceCountAuthority
        !== directorySource.logicalSourceCountAuthority
      || spatialGeneration?.source?.logicalSourceCountAuthority
        !== directorySource.logicalSourceCountAuthority
      || spatialGeneration?.source?.positionEpoch !== normalizedEpoch.positionEpoch
      || spatialGeneration?.source?.topologyEpoch !== normalizedEpoch.topologyEpoch
    ) {
      const reason = spatialGeneration?.reason
        || 'The gas source-family SS directory was not retained and generation-bound';
      const cleanupPromise = scheduleFailureCleanup({
        device,
        slot,
        ownerToken,
        spatialGeneration,
        schroederSpatialEpochGeneration,
        generationConsumerLease,
        gasFreeVolumeRuntime,
        gasFreeVolumeExecution,
        releaseSourceBorrow,
        readbackTelemetry: retainedReadbackTelemetry,
        workSubmitted: adapterSubmissionAttempted
      });
      return rejectedExecutionWithTelemetry(
        'spatial-gas-ledger-eos-rejected-spatial-generation',
        reason,
        {
          cleanupScheduled: true,
          cleanupPromise,
          spatialGenerationStatus: spatialGeneration?.status ?? null
        }
      );
    }

    const mechanicsLevelViews =
      schroederSpatialEpochGeneration.mechanicsLevelViews;
    const fineFieldCapacity =
      mechanicsLevelViews[0].mechanicsFieldView.fieldCapacity;
    const coarseFieldCapacity = mechanicsLevelViews.length > 1
      ? mechanicsLevelViews.at(-1).mechanicsFieldView.fieldCapacity
      : 0;
    gasFreeVolumeRuntime = gasFreeVolumeRuntimeFor({
      runtime,
      device,
      cellCapacity: spatialGeneration.execution.layout.cellCapacity,
      fineFieldCapacity,
      coarseFieldCapacity,
      nativeFieldCapacities: mechanicsLevelViews.length > 2
        ? mechanicsLevelViews.map(v=>v.mechanicsFieldView.fieldCapacity) : null,
      parentFieldCapacities: mechanicsLevelViews.length > 2
        ? schroederSpatialEpochGeneration.mechanicsAdjacentLevelPairs.map(p=>p.parentFieldView.parentFieldCapacity) : null,
      label: `${slot.label}-gas-free-volume`
    });
    const eosEncoder = device.createCommandEncoder({
      label: `${slot.label}-eos-encoder`
    });
    if (exactHistoryProjection) {
      exactHistoryVolumeInput = Object.freeze({});
      retainedGasHistoryVolumeInputs.set(exactHistoryVolumeInput, Object.freeze({
        device, generation: schroederSpatialEpochGeneration, encoder: eosEncoder,
        gasDirectory: spatialGeneration.execution,
        buffer: exactHistoryProjection.outputBuffer, validationBuffer: exactHistoryProjection.validationBuffer,
        descriptor: normalizedProductSource.liveCountDescriptor,
        validate: () => {
          if (!retainedGasHistoryVolumeInputs.has(exactHistoryVolumeInput)) throw new TypeError('Gas history input retired');
          exactHistoryProjection.validate(); particleProductSourcePair?.validate();
          if (!validateSchroederSpatialEpochGenerationLevelAssignment(schroederSpatialEpochGeneration,
            { device, levelAssignment: schroederLevelAssignment, sphParticleUpload, mlsMpmParticleUpload })) {
            throw new TypeError('Gas history input lost its original particle occupancy generation');
          }
          return true;
        }
      }));
    }
    gasFreeVolumeExecution = encodeSphSpatialGasFreeVolumeGpu(
      gasFreeVolumeRuntime,
      eosEncoder,
      {
      gasDirectory: spatialGeneration.execution,
      generationReadFamily: generationConsumerLease,
      aerosolFamily: expectedAerosolFamily,
      retainedHistoryInput: exactHistoryVolumeInput,
      grid: {
        ...normalizedGrid,
        chartId: resolvedChartId
      },
      chartId: resolvedChartId,
      boxMinM: resolvedBoxMinM,
      boxMaxM: resolvedBoxMaxM,
      gasControlVolumeDescriptor
      }
    );
    const pipelines = eosPipelines(device, caloricModule);
    device.queue.writeBuffer(slot.paramsBuffer, 0, eosParams({
      sourceCapacity: capacity,
      executionGeneration,
      generation: spatialGeneration,
      gasFreeVolume: gasFreeVolumeExecution,
      gasConstantJPerMolK: resolvedGasConstant,
      cellSizeM,
      fallbackTemperatureK: resolvedFallbackTemperatureK,
      chartId: resolvedChartId,
      level: resolvedLevel,
      gasControlVolumeDescriptor
    }));
    const eosEntries = [
      { binding: 0, resource: { buffer: slot.compactRowsBuffer } },
      {
        binding: 1,
        resource: { buffer: spatialGeneration.execution.directoryBuffer }
      },
      { binding: 2, resource: { buffer: slot.gasPressureCellsBuffer } },
      { binding: 3, resource: { buffer: slot.paramsBuffer } },
      { binding: 4, resource: { buffer: slot.controlBuffer } },
      { binding: 11, resource: { buffer: slot.gasMixtureMomentsBuffer } }
    ];
    if (caloricModule) eosEntries.push(
      { binding: 12, resource: { buffer: slot.caloricTableBuffer } },
      { binding: 13, resource: { buffer: slot.caloricRowsBuffer } });
    eosEncoder.copyBufferToBuffer(
      spatialGeneration.execution.consumerDispatchBuffer,
      0,
      slot.controlBuffer,
      SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.EOS_AGGREGATE_DISPATCH_X
        * UINT32_BYTES,
      3 * UINT32_BYTES
    );
    eosEncoder.copyBufferToBuffer(
      spatialGeneration.execution.consumerDispatchBuffer,
      0,
      slot.controlBuffer,
      SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.EOS_GRADIENT_DISPATCH_X
        * UINT32_BYTES,
      3 * UINT32_BYTES
    );
    // A1: launch the aggregate and gradient kernels directly over the
    // directory's cell-capacity ceiling instead of dispatchWorkgroupsIndirect
    // (about 0.3 ms of GPU-process validation each on Chromium). The kernels
    // admit only the groups the staged words copied above would have run
    // (staged_linear_cell_index), so both launches are exact. Capacities past
    // one dispatch dimension keep the indirect launch.
    const directConsumerGroups = Math.ceil(
      Math.max(0, Number(spatialGeneration.execution.cellCapacity) || 0) / 64
    );
    const directConsumerDispatch = directConsumerGroups > 0
      && directConsumerGroups <= (Number(device?.limits?.maxComputeWorkgroupsPerDimension) || 65535)
      && globalThis.__ulgForceIndirectFieldConsumers !== true;
    const dispatchStagedDirectoryConsumer = (pass) => (directConsumerDispatch
      ? pass.dispatchWorkgroups(directConsumerGroups)
      : pass.dispatchWorkgroupsIndirect(
        spatialGeneration.execution.consumerDispatchBuffer,
        0
      ));
    const aggregatePass = eosEncoder.beginComputePass({
      label: `${slot.label}-eos-aggregate-pass`
    });
    aggregatePass.setPipeline(pipelines.aggregate.pipeline);
    gasFreeVolumeEosReceipt = encodeSphSpatialGasFreeVolumeEosAuthority(
      gasFreeVolumeExecution,
      null,
      {
        device,
        encoder: eosEncoder,
        pass: 'aggregate',
        passEncoder: aggregatePass,
        bindGroupLayout: pipelines.aggregate.bindGroupLayout,
        bindGroupIndex: 0,
        publicEntries: eosEntries
      }
    ).receipt;
    dispatchStagedDirectoryConsumer(aggregatePass);
    aggregatePass.end();
    const gradientPass = eosEncoder.beginComputePass({
      label: `${slot.label}-eos-gradient-pass`
    });
    gradientPass.setPipeline(pipelines.gradient.pipeline);
    encodeSphSpatialGasFreeVolumeEosAuthority(
      gasFreeVolumeExecution,
      gasFreeVolumeEosReceipt,
      {
        device,
        encoder: eosEncoder,
        pass: 'gradient',
        passEncoder: gradientPass,
        bindGroupLayout: pipelines.gradient.bindGroupLayout,
        bindGroupIndex: 0,
        publicEntries: eosEntries
      }
    );
    dispatchStagedDirectoryConsumer(gradientPass);
    gradientPass.end();
    const finalizerPass = eosEncoder.beginComputePass({
      label: `${slot.label}-eos-finalizer-pass`
    });
    finalizerPass.setPipeline(pipelines.finalize.pipeline);
    encodeSphSpatialGasFreeVolumeEosAuthority(
      gasFreeVolumeExecution,
      gasFreeVolumeEosReceipt,
      {
        device,
        encoder: eosEncoder,
        pass: 'finalize',
        passEncoder: finalizerPass,
        bindGroupLayout: pipelines.finalize.bindGroupLayout,
        bindGroupIndex: 0,
        publicEntries: eosEntries
      }
    );
    finalizerPass.dispatchWorkgroups(1);
    finalizerPass.end();
    const speciesDiagnosticDescriptor = encodeSphSpatialGasSpeciesDiagnostics({
      device, slot, allocate: createOwnedBuffer, encoder: eosEncoder,
      eosEntries: eosEntries.filter((entry) => entry.binding < 11),
      eosWgsl: sphSpatialGasLedgerEosWgsl, options: normalizedSpeciesDiagnostics,
      productBuffer: productBindingBuffer, productByteLength: productBindingByteLength,
      productCapacity: productCandidateCapacity,
      productStride: productBindingStride,
      particleCount: normalizedParticleSource.particleCount,
      dispatch: capacityDispatchCount
    });
    if (
      submitSphSpatialGasFreeVolumeEosAuthority(
        gasFreeVolumeEosReceipt,
        device
      ) !== true
    ) {
      throw new Error(
        'gas free-volume EOS authority did not submit its exact execution'
      );
    }

    const deviceId = webGpuDeviceId(device);
    const compactRowByteLength = capacity
      * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
      * FLOAT32_BYTES;
    const pressureRowByteLength = capacity
      * SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS
      * FLOAT32_BYTES;
    const frozenEpochIdentity = Object.freeze({ ...normalizedEpoch });
    const sourceMode = normalizedProductSource.present === true
      ? (normalizedParticleSource.present === true ? 'mixed' : 'product-event-only')
      : 'particle-only';
    const retainedSpatialGasLedgerSource = {
      schema: ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA,
      status: 'retained-spatial-gas-ledger-source-submitted',
      ready: true,
      deviceId,
      sourceFamily: SPATIAL_GAS_UNION_SOURCE_FAMILY,
      sourceMode,
      particleProductSourcePaired: particleProductSourcePair != null,
      caloricMemberAdmissionEnabled: caloricModule != null,
      exchangeIntervalAdmitted: false,
      positionAuthority: SPATIAL_GAS_UNION_POSITION_AUTHORITY,
      sourceProductEventRowCount: normalizedProductSource.rowCount,
      sourceProductEventCandidateCapacity: productCandidateCapacity,
      sourceProductEventStrideFloats: normalizedProductSource.strideFloats,
      sourceParticleCount: normalizedParticleSource.particleCount,
      sourceParticleStateStrideFloats:
        normalizedParticleSource.stateStrideFloats,
      sourceParticleThermoStrideFloats:
        normalizedParticleSource.thermoStrideFloats,
      gasCandidateUnionCount: candidateCount,
      gasCandidateUnionOrder:
        'unplaced-product-event-prefix-then-phase-pure-particle-prefix',
      compactSpatialGasRowCapacity: capacity,
      compactSpatialGasRowCountHostKnown: false,
      compactSpatialGasRowStrideFloats:
        SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS,
      compactSpatialGasRowByteLength: compactRowByteLength,
      activeNodeRowCapacity: capacity,
      activeNodeRowStrideFloats: SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS,
      gasAuthorityControlSchema:
        'peercompute.ulg.sph-spatial-gas-authority-control.v4',
      gasAuthorityControlByteLength: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES,
      gasAuthorityControlMagic: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC,
      gasAuthorityControlVersion: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION,
      gasAuthorityControlOffsets: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS,
      gasControlVolumeDescriptor,
      executionGeneration,
      storageGeneration: normalizedEpoch.storageGeneration,
      spatialEpochGenerationId: spatialGeneration.execution.generationId,
      spatialEpochDirectoryByteLength: spatialGeneration.execution.layout.byteLength,
      gasFreeVolumeSchema: gasFreeVolumeExecution.gasFreeVolumeSchema,
      gasFreeVolumeAerosol: gasFreeVolumeExecution.aerosol,
      gasFreeVolumeGeneration:
        gasFreeVolumeExecution.gasFreeVolumeGeneration,
      gasFreeVolumeCellCapacity:
        gasFreeVolumeExecution.gasFreeVolumeCellCapacity,
      gasFreeVolumeRowStrideFloats:
        gasFreeVolumeExecution.gasFreeVolumeRowStrideFloats,
      epochIdentity: frozenEpochIdentity,
      spatialGasCellSizeM: cellSizeM,
      spatialGasSupportVolumeFallbackM3: supportVolumeFallbackM3,
      sourceValidityAuthority:
        'gpu-compacted-logical-prefix-inside-authenticated-capacity-allocation',
      consumerAccessProtocol:
        'same-device-exact-opaque-retained-gpu-authority.v6',
      lifecycleOwner: 'spatial-gas-ledger-eos-final-consumer-owner',
      finalConsumerReleaseRequired: true,
      diagnosticsMode
    };
    const retainedGasCellFieldSource = {
      schema: ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
      status: 'retained-gas-cell-eos-source-submitted',
      ready: true,
      deviceId,
      gasPressureCellRowCapacity: capacity,
      pressureInterfaceGasPressureCellRowCapacity: capacity,
      pressureInterfaceGasPressureCellRowStrideFloats:
        SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS,
      pressureInterfaceGasPressureCellRowByteLength: pressureRowByteLength,
      pressureInterfaceGasPressureCellRowsBufferRetained: true,
      gasPressureCellRowsBufferBorrowed: false,
      gasAuthorityControlSchema:
        'peercompute.ulg.sph-spatial-gas-authority-control.v4',
      gasAuthorityControlByteLength: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES,
      gasAuthorityControlMagic: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC,
      gasAuthorityControlVersion: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION,
      gasAuthorityControlOffsets: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS,
      gasPressureCellLogicalCountAuthority:
        'gas-authority-control-ready-pressure-count-u32',
      gasControlVolumeDescriptor,
      executionGeneration,
      storageGeneration: normalizedEpoch.storageGeneration,
      epochIdentity: frozenEpochIdentity,
      gasPressureCellCountAuthority:
        'gpu-authenticated-directory-header-cell-count-with-zero-sealed-capacity-tail',
      sourceSpatialGasLedgerGenerationId:
        spatialGeneration.execution.generationId,
      gasFreeVolumeSchema: gasFreeVolumeExecution.gasFreeVolumeSchema,
      gasFreeVolumeGeneration:
        gasFreeVolumeExecution.gasFreeVolumeGeneration,
      gasFreeVolumeSourceGeneration:
        gasFreeVolumeExecution.sourceGeneration,
      gasFreeVolumeStorageGeneration:
        gasFreeVolumeExecution.storageGeneration,
      gasFreeVolumePressureDenominatorAuthority:
        'same-generation-condensed-occupancy-free-volume-sidecar',
      gasFreeVolumeAerosol: gasFreeVolumeExecution.aerosol,
      pressureInterfaceGasPressureCellVolumeWord11Authority:
        'free-volume-m3-not-parcel-represented-volume',
      pressureFieldMode: 'local-gas-cell-pressure-gradient',
      pressureFieldResolution: 'schroeder-spatial-directory-cells',
      localPressureGradientReady: false,
      localPressureGradientStatus:
        'gpu-authenticated-readiness-in-authority-control-buffer',
      gasCellFieldSnapshot: null,
      hostMaterialized: false,
      eosPressureClosure:
        'ideal-gas-law-per-directory-cell-authoritative-free-volume',
      scientificValidation: false,
      gasValidation: false,
      fullPhysicsValidation: false,
      consumerAccessProtocol:
        'same-device-exact-opaque-retained-gpu-authority.v6',
      finalConsumerReleaseRequired: true
    };
    const execution = {
      schema: ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA,
      status: 'spatial-gas-ledger-eos-gpu-submitted',
      reason: null,
      ready: true,
      selected: true,
      backend: 'webgpu-retained-same-device',
      deviceId,
      sourceMode,
      particleProductSourcePaired: particleProductSourcePair != null,
      caloricMemberAdmissionEnabled: caloricModule != null,
      exchangeIntervalAdmitted: false,
      productEventRowCount: normalizedProductSource.rowCount,
      productEventCandidateCapacity: productCandidateCapacity,
      productEventStrideFloats: normalizedProductSource.strideFloats,
      particleCount: normalizedParticleSource.particleCount,
      particleStateStrideFloats: normalizedParticleSource.stateStrideFloats,
      particleThermoStrideFloats: normalizedParticleSource.thermoStrideFloats,
      gasCandidateUnionCount: candidateCount,
      compactSpatialGasRowCapacity: capacity,
      compactSpatialGasRowCountHostKnown: false,
      compactSpatialGasRowStrideFloats:
        SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS,
      compactSpatialGasRowByteLength: compactRowByteLength,
      spatialGasLedgerRowsBufferRetained: true,
      spatialGasLedgerRowsBufferBorrowed: false,
      spatialGenerationId: spatialGeneration.execution.generationId,
      gasPressureCellRowCapacity: capacity,
      pressureInterfaceGasPressureCellRowCapacity: capacity,
      pressureInterfaceGasPressureCellRowStrideFloats:
        SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS,
      pressureInterfaceGasPressureCellRowByteLength: pressureRowByteLength,
      pressureInterfaceGasPressureCellRowsBufferRetained: true,
      gasAuthorityControlSchema:
        'peercompute.ulg.sph-spatial-gas-authority-control.v4',
      gasAuthorityControlByteLength: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES,
      gasAuthorityControlMagic: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC,
      gasAuthorityControlVersion: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION,
      gasAuthorityControlOffsets: SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS,
      executionGeneration,
      storageGeneration: normalizedEpoch.storageGeneration,
      epochIdentity: frozenEpochIdentity,
      retainedSpatialGasLedgerSourceSchema:
        ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA,
      retainedSpatialGasLedgerSourceStatus:
        retainedSpatialGasLedgerSource.status,
      retainedSpatialGasLedgerSourceReady: true,
      retainedSpatialGasLedgerSource,
      retainedGasCellFieldSourceSchema:
        ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
      retainedGasCellFieldSourceStatus: retainedGasCellFieldSource.status,
      retainedGasCellFieldSourceReady: true,
      retainedGasCellFieldSource,
      spatialGasSpeciesLedger: null,
      speciesDiagnostics: speciesDiagnosticDescriptor,
      gasCellFieldSnapshot: null,
      normalHotLoopReadbackFree: true,
      compactSpatialGasReadbackPerformed: false,
      compactSpatialGasReadbackByteLength: 0,
      gasCellEosReadbackPerformed: false,
      gasCellEosReadbackByteLength: 0,
      mapAsyncCount: 0,
      hostMaterializedRowCount: 0,
      queueCompletionFenceWaited: false,
      queueCompletionStatus: 'queue-submitted-no-host-wait',
      queueCompletionMethod: 'same-device-queue-order',
      adapterDispatchCount: 3 + adapterScanDispatchCount,
      adapterDirectDispatchCount: 3,
      adapterScanDispatchCount,
      spatialDirectoryBuildCount: 1,
      gasFreeVolumeBuildCount: 1,
      gasFreeVolumeAerosol: gasFreeVolumeExecution.aerosol,
      gasControlVolumeDescriptor,
      gasFreeVolumeProjectionScaling:
        'quadratic-capacity-node-scatter-at-most-eight-primal-cell-targets',
      privateSpatialLookupBuildCount: 0,
      exhaustiveSpatialScanCount: 0,
      eosDispatchCount: 3,
      eosIndirectDispatchCount: 2,
      eosFinalizerDispatchCount: 1,
      arenaCapacity: capacity,
      arenaIndex: slot.arenaIndex,
      arenaBackpressureWaited: backpressureWaited,
      arenaBackpressureWaitCount: backpressureWaitCount,
      arenaBufferReuseCount: runtime.reuseCount,
      diagnosticsMode,
      failClosed: true,
      ...retainedReadbackTelemetrySnapshot()
    };
    const deferredCleanupReadbackTelemetry =
      createGpuReadbackTelemetryAccumulator({
        scope: 'sph-spatial-gas-ledger-eos-final-consumer-cleanup'
      });
    const record = {
      execution,
      spatialSource: retainedSpatialGasLedgerSource,
      gasCellSource: retainedGasCellFieldSource,
      device,
      deviceId,
      runtime,
      slot,
      ownerToken,
      spatialGeneration,
      schroederSpatialEpochGeneration,
      generationConsumerLease,
      gasFreeVolumeRuntime,
      gasFreeVolumeExecution,
      capacity,
      executionGeneration,
      spatialGenerationId: spatialGeneration.execution.generationId,
      storageGeneration: normalizedEpoch.storageGeneration,
      epochIdentity: frozenEpochIdentity,
      chartId: resolvedChartId,
      level: resolvedLevel,
      spatialGasGrid: normalizedGrid,
      gasConstantJPerMolK: resolvedGasConstant,
      boxMinM: resolvedBoxMinM,
      boxMaxM: resolvedBoxMaxM,
      gasControlVolumeDescriptor,
      productSource: normalizedProductSource.source,
      particleSource: normalizedParticleSource.source,
      selectedMechanicsFieldView:
        mechanicsLevelViews[mechanicsLevelViews.length - 1].mechanicsFieldView,
      releaseSourceBorrow,
      deferredCleanupReadbackTelemetry,
      particleProductSourcePair,
      caloricModule,
      caloricAuthority,
      caloricThermalMaterialTable,
      productEventLiveCountDescriptor: normalizedProductSource.liveCountDescriptor ?? null,
      activeExchangeOperation: null,
      exchangeCandidateIssued: false,
      releaseAttempted: false,
      releaseError: null,
      queueOrderedRetirementOperationResults: Object.freeze([]),
      releasePromise: null,
      released: false,
      quarantined: false,
      terminal: false,
      oracleDiagnostics: null,
      speciesDiagnostics: speciesDiagnosticDescriptor,
      activePressureConsumerReceipt: null,
      pressureMechanicsFamily: null,
      pressureConsumerSubmitted: false,
      pressureConsumerBindCount: 0,
      pressureConsumerSubmitCount: 0,
      pressureConsumerAbandonCount: 0,
      queueOrderedRetirementMode: null,
      queueOrderedCleanupClaim: null,
      queueOrderedCleanup: null,
      status: 'spatial-gas-ledger-eos-retained-for-final-consumer'
    };
    record.queueOrderedCleanup = () => releaseGasPressureOwnerQueueOrdered(
      record
    );
    record.queueOrderedCleanupClaim = registerQueueOrderedCleanupClaim(
      gasPressureQueueOrderedCleanupClaimIssuer,
      device,
      {
        producerOutput: retainedGasCellFieldSource,
        cleanup: record.queueOrderedCleanup
      }
    );
    queueOrderedPressureRecord = record;
    slot.pendingFailure = null;
    slot.retainedExecution = execution;
    attachLifecycle(
      execution,
      retainedSpatialGasLedgerSource,
      retainedGasCellFieldSource,
      record
    );
    Object.freeze(retainedSpatialGasLedgerSource);
    Object.freeze(retainedGasCellFieldSource);

    if (diagnosticsMode === SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE) {
      record.oracleDiagnostics = await observeSphSpatialGasLedgerEosOracle(
        execution
      );
    }
    return Object.freeze(execution);
  } catch (error) {
    if (queueOrderedPressureRecord?.queueOrderedCleanupClaim) {
      try {
        cancelQueueOrderedCleanupClaim(
          queueOrderedPressureRecord.queueOrderedCleanupClaim,
          device,
          {
            producerOutput: queueOrderedPressureRecord.gasCellSource,
            cleanup: queueOrderedPressureRecord.queueOrderedCleanup
          }
        );
      } catch {
        // Preserve the primary failure. This path precedes publication, so a
        // non-cancellable claim can only be quarantined by the existing
        // failure-cleanup/device-loss owner below.
      }
    }
    if (gasFreeVolumeEosReceipt) {
      abandonSphSpatialGasFreeVolumeEosAuthority(gasFreeVolumeEosReceipt);
    }
    if (spatialGenerationAttempted && !spatialGeneration) {
      retainedReadbackTelemetry.markUnknown(
        'schroeder-spatial-generation-result-missing'
      );
    }
    const cleanupPromise = scheduleFailureCleanup({
      device,
      slot,
      ownerToken,
      spatialGeneration,
      schroederSpatialEpochGeneration,
      generationConsumerLease,
      gasFreeVolumeRuntime,
      gasFreeVolumeExecution,
      releaseSourceBorrow,
      readbackTelemetry: retainedReadbackTelemetry,
      workSubmitted: adapterSubmissionAttempted
    });
    return rejectedExecutionWithTelemetry(
      'spatial-gas-ledger-eos-rejected-submit',
      error instanceof Error ? error.message : String(error),
      {
        errorCode: error?.code ?? null,
        adapterSubmissionAttempted,
        adapterSubmitted,
        spatialGenerationStatus: spatialGeneration?.status ?? null,
        cleanupScheduled: true,
        cleanupPromise
      }
    );
  }
}

/** Prescribed, conservative existing-droplet transfer on an exact retained
 * particle/history/aerosol family. This is deliberately NOT a law-discovery,
 * kinetic-rate, timestep or publication API. No public output buffers or live
 * aerosol family are issued. A later real stage must seal its interval and join
 * the existing shared debit/outer-publication gate before any adoption.
 */
export async function runSphSpatialVaporAerosolExchangeCandidate(execution, options = {}) {
  const record = retainedExecutions.get(execution);
  if (!record || record.execution !== execution || !record.particleProductSourcePair
      || !record.caloricModule || record.exchangeCandidateIssued) {
    throw new TypeError('Vapor/aerosol exchange requires an unused exact paired caloric EOS');
  }
  // Reserve before any caller-controlled properties or async module loading.
  // This is a separate consumer, never a fabricated pressure receipt.
  livePressureSourceRecord(record.gasCellSource);
  if(record.pressureMechanicsFamily) throw new TypeError('Vapor exchange cannot borrow a native pressure consumer family');
  const operation = Object.freeze({});
  record.activeExchangeOperation = operation;
  let aerosolRead = null, exactParticleRead = null, exactPostMechanicsRead = null, currentModule = null;
  let releaseAerosolRead = null, owner = null;
  const validate = () => {
    if (record.activeExchangeOperation !== operation || record.terminal || record.released
        || record.releaseAttempted || record.releasePromise || record.slot.destroyed
        || record.slot.terminal || record.slot.ownerToken !== record.ownerToken
        || record.slot.retainedExecution !== execution || record.pressureConsumerSubmitted
        || record.activePressureConsumerReceipt || record.spatialGeneration?.releaseScheduled
        || record.spatialGeneration?.released) {
      throw new TypeError('Vapor/aerosol exchange lost its retained EOS owner');
    }
    record.particleProductSourcePair.validate();
    record.caloricModule.validateSphSpatialGasCaloricAuthority(record.caloricAuthority,
      { thermalMaterialTable: record.caloricThermalMaterialTable });
  };
  try {
    validate();
    if (!options || Object.getPrototypeOf(options) !== Object.prototype
        || Reflect.ownKeys(options).some((key) => !['surfaceModels', 'edges', 'pressureWorkMode', 'rateModels', 'rateIntegration', 'rateSubsteps', 'transportPacketMode'].includes(key))) {
      throw new TypeError('Exchange accepts only explicit surfaceModels and prescribed edges');
    }
    const data = (key) => {
      const descriptor = Object.getOwnPropertyDescriptor(options, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
        throw new TypeError('Exchange inputs must be own data properties');
      }
      return descriptor.value;
    };
    const materialData = record.caloricModule.resolveSphSpatialGasExchangeMaterials(
      record.caloricAuthority, { thermalMaterialTable: record.caloricThermalMaterialTable,
        surfaceModels: data('surfaceModels') });
    const pressureWorkMode = Object.hasOwn(options, 'pressureWorkMode') ? data('pressureWorkMode') : 'prescribed';
    if (!['prescribed', 'initial-cell-pressure'].includes(pressureWorkMode)) {
      throw new TypeError('Unknown vapor exchange pressure-work mode');
    }
    const rateData = Object.hasOwn(options, 'rateModels')
      ? record.caloricModule.resolveSphSpatialGasExchangeRates(record.caloricAuthority, {
        thermalMaterialTable: record.caloricThermalMaterialTable,
        surfaceModels: data('surfaceModels'), rateModels: data('rateModels') }) : null;
    if (rateData && pressureWorkMode !== 'initial-cell-pressure') {
      throw new TypeError('State-derived rates require original-cell pressure work');
    }
    const rateIntegration = Object.hasOwn(options, 'rateIntegration') ? data('rateIntegration') : 'initial-rate';
    if (!['initial-rate', 'midpoint'].includes(rateIntegration) || (!rateData && rateIntegration !== 'initial-rate')) {
      throw new TypeError('Rate integration requires state-derived rates and a supported method');
    }
    const rateSubsteps = Object.hasOwn(options, 'rateSubsteps') ? data('rateSubsteps') : 1;
    if (!Number.isSafeInteger(rateSubsteps) || rateSubsteps < 1 || rateSubsteps > 1024
        || (rateSubsteps & (rateSubsteps - 1)) !== 0 || (rateSubsteps !== 1 && rateIntegration !== 'midpoint')) {
      throw new TypeError('Rate substeps require midpoint and a power of two from 1 through 1024');
    }
    const transportPacketMode = validateSphTransportPacketMode(Object.hasOwn(options, 'transportPacketMode')
      ? data('transportPacketMode') : 'exact-rational');
    const edges = data('edges');
    // The lower encoder snapshots/validates edges before its first await.
    // Keep the exact data identity, not accessors that can retire a source.
    if (!Array.isArray(edges) || Object.getPrototypeOf(edges) !== Array.prototype) {
      throw new TypeError('Exchange requires an ordinary explicit edge array');
    }
    const fields = ['gasKind', 'gasIndex', 'parcelIndex', 'materialRow', 'deltaMassKg',
      'transportEnthalpyCorrectionJ', 'conductiveHeatJ', 'pressureWorkIntoLiquidJ'];
    const edgeCopy = [];
    for (let i = 0; i < edges.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(edges, String(i));
      const edge = descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : null;
      if (!edge || Object.getPrototypeOf(edge) !== Object.prototype
          || Reflect.ownKeys(edge).some((key) => !fields.includes(key))) {
        throw new TypeError('Exchange edges must be complete ordinary data, without accessors');
      }
      const copy = {};
      for (const field of fields) {
        const lane = Object.getOwnPropertyDescriptor(edge, field);
        if (!lane || !Object.hasOwn(lane, 'value') || typeof lane.value !== 'number') {
          throw new TypeError('Exchange edge lanes must be own numeric data');
        }
        copy[field] = lane.value;
      }
      edgeCopy.push(Object.freeze(copy));
    }
    const [encoder, parcels] = await Promise.all([
      import('./sphVaporAerosolExchangeGpu.js'), import('./sphAerosolParcelGpu.js')
    ]);
    validate();
    const pair = record.particleProductSourcePair;
    releaseAerosolRead = parcels.releaseSphAerosolParcelRead;
    aerosolRead = pair.acquireAerosolRead();
    if (!aerosolRead) throw new TypeError('Exchange requires an existing exact retained aerosol population');
    if (aerosolRead.exactQuantities) {
      if (pair.acquireExactQuantityRead) {
        currentModule = await import('./sphMlsMpmPostMechanicsClosure.js');
        validate(); exactPostMechanicsRead = pair.acquireExactQuantityRead();
      }
      if (!exactPostMechanicsRead) exactParticleRead = acquireSphParticleExactMassRead(pair.sphParticleUpload,
        record.device, { mlsMpmParticleUpload: pair.mlsMpmParticleUpload });
    }
    validate();
    let pressureGeometryWords = null;
    if (pressureWorkMode === 'initial-cell-pressure') {
      const fine = record.schroederSpatialEpochGeneration.mechanicsLevelViews[0].mechanicsFieldView;
      const coarse = record.spatialGasGrid;
      pressureGeometryWords = new Uint32Array(24);
      pressureGeometryWords.set([record.gasFreeVolumeExecution.exactLevelCount, 0, fine.gridShift, 0,
        ...fine.gridDims, coarse.gridShift, ...coarse.gridDims, 0,
        ...record.gasControlVolumeDescriptor.boundsWords]);
      new Float32Array(pressureGeometryWords.buffer)[1] = fine.gridSpacingM;
    }
    owner = await encoder.runSphVaporAerosolExchangeCandidateGpu({ device: record.device,
      sourceStateBuffer: pair.sphParticleUpload.stateBuffer,
      sourceThermoBuffer: pair.sphParticleUpload.thermoBuffer,
      sourceMechanicsBuffer: pair.mlsMpmParticleUpload.mechanicsBuffer,
      particleCount: pair.read.particleCount, residentProductMass: pair.residentProductMass,
      productEventLiveCountDescriptor: record.productEventLiveCountDescriptor,
      aerosolRead, exactParticleRead, exactPostMechanicsRead, eosControlBuffer: record.slot.controlBuffer,
      compactRowsBuffer: record.slot.compactRowsBuffer, caloricRowsBuffer: record.slot.caloricRowsBuffer,
      pressureCellsBuffer: record.slot.gasPressureCellsBuffer, pressureWorkMode,
      pressureGeometryWords,
      compactCapacity: record.capacity, cellCapacity: record.capacity,
      // Private normalized geometry used by this actual EOS directory. An
      // exchange request cannot supply or override its own neighborhood size.
      spatialGasCellSizeM: record.spatialGasGrid.gridSpacingM,
      spatialGasConstantJPerMolK: record.gasConstantJPerMolK,
      executionGeneration: record.executionGeneration, materialRows: materialData.records,
      rateRows: rateData?.records ?? null,
      rateIntegration, rateSubsteps, transportPacketMode,
      edges: edgeCopy });
    validate();
    if (!owner.ready) {
      const diagnostic = Object.freeze({ ready: false, status: owner.status,
        receipt: owner.receipt, kineticAuthorization: false, exchangeIntervalAdmitted: false,
        outerPublicationAdmitted: false, sourceMutation: false });
      await owner.release(); owner = null;
      return diagnostic;
    }
    const candidate = Object.freeze({ schema: 'peercompute.ulg.spatial-vapor-aerosol-candidate.v1',
      ready: true, status: 'conservative-candidate-only', conservativeTransferAdmitted: true,
      kineticAuthorization: false, exchangeIntervalAdmitted: false, outerPublicationAdmitted: false,
      mechanicsContinuationAdmitted: false, pressureRequiresRefresh: true,
      scientificValidation: false, sourceMutation: false, epochIdentity: record.epochIdentity,
      rateModel: rateData?.model ?? null, rateIntervalSeconds: owner.rateIntervalSeconds,
      rateIntegration: owner.rateIntegration, rateSubsteps: owner.rateSubsteps, transportPacketMode: owner.transportPacketMode,
      executionGeneration: record.executionGeneration, sourceFamily: pair.read.sourceFamily,
      materialNames: materialData.materials, receipt: owner.receipt });
    let currentExactSource = null;
    if (exactPostMechanicsRead) currentExactSource = currentModule.resolveMlsMpmPostMechanicsExactGasRead(
      exactPostMechanicsRead, { device: record.device });
    vaporAerosolCandidates.set(candidate, { owner, busy: false, releaseRequested: false,
      releasePromise: null, producerIssued: false, device: record.device,
      sourcePair: pair, currentExactSource, edges: Object.freeze(edgeCopy) });
    record.exchangeCandidateIssued = true;
    owner = null;
    return candidate;
  } finally {
    // The encoder completes its LAST source read fence (or confirmed device
    // loss) before settling, including failure. Never reuse a predecessor's
    // retirement fence for this consumer.
    try { if (owner) await owner.release(); }
    finally {
      if (aerosolRead) releaseAerosolRead(aerosolRead);
      if (exactParticleRead) await releaseSphParticleExactMassRead(exactParticleRead);
      if (exactPostMechanicsRead) currentModule.releaseMlsMpmPostMechanicsExactGasRead(exactPostMechanicsRead);
      if (record.activeExchangeOperation === operation) record.activeExchangeOperation = null;
    }
  }
}

/** Retain this original completed producer for its actual current closure.
 * This is a numerical stage read: it grants no kinetic interval or publication.
 * Source identity is sealed while the current EOS pair is still live; subsequent
 * reads own the completed outputs and do not depend on that predecessor fence.
 */
export function acquireSphSpatialVaporAerosolProducerRead(candidate, { device, closure } = {}) {
  const record = vaporAerosolCandidates.get(candidate);
  if (!record || record.device !== device || record.busy || record.releaseRequested || record.producerIssued
      || !record.currentExactSource || !closure || record.sourcePair.sourceClosure !== closure) {
    throw new TypeError('Exchange producer capture requires its original current closure and unused candidate');
  }
  record.sourcePair.validate();
  const packet = record.sourcePair.sourcePacket, source = record.currentExactSource;
  const hold = record.owner.retainProducer();
  const value = Object.freeze({ device, closure, sourcePacket: packet,
    sourceHistory: packet.residentProductMass, sourceInventoryGeneration: source.massRead.generation,
    sourceParticleRead: source.sourceParticleRead, particleCount: packet.particleCount,
    stateBuffer: hold.stateBuffer, thermoBuffer: hold.thermoBuffer, mechanicsBuffer: hold.mechanicsBuffer,
    parcelBuffer: hold.parcelBuffer, endpoints: hold.exactQuantities.endpoints,
    format: hold.exactQuantities.format, edges: record.edges });
  const token = Object.freeze({ schema: 'peercompute.ulg.exact-vapor-exchange-producer-read.v1' });
  vaporAerosolProducerReads.set(token, { candidate, record, hold, value, closed: false });
  record.producerIssued = true;
  return token;
}

export function resolveSphSpatialVaporAerosolProducerRead(token, { device } = {}) {
  const read = vaporAerosolProducerReads.get(token);
  if (!read || read.closed || read.value.device !== device) {
    throw new TypeError('Unknown, copied, released or foreign exact exchange producer read');
  }
  read.hold.validate(); return read.value;
}

export function forkSphSpatialVaporAerosolProducerRead(token, { device } = {}) {
  const value = resolveSphSpatialVaporAerosolProducerRead(token, { device });
  const parent = vaporAerosolProducerReads.get(token);
  // Forking must also remain possible after the public candidate closes.
  const hold = parent.hold.retain();
  const fork = Object.freeze({ schema: 'peercompute.ulg.exact-vapor-exchange-producer-read.v1' });
  vaporAerosolProducerReads.set(fork, { candidate: parent.candidate, record: parent.record, hold, value, closed: false });
  return fork;
}

export function releaseSphSpatialVaporAerosolProducerRead(token) {
  const read = vaporAerosolProducerReads.get(token);
  if (!read) throw new TypeError('Unknown exact exchange producer read release');
  if (read.closed) return false;
  read.closed = true; return read.hold.release();
}

/** Explicit native numerical oracle only; never a simulation readback loop. */
export async function observeSphSpatialVaporAerosolExchangeCandidate(candidate) {
  const record = vaporAerosolCandidates.get(candidate);
  if (!record || record.busy || record.releaseRequested) {
    throw new TypeError('Unissued, busy or retiring vapor/aerosol candidate');
  }
  record.busy = true;
  try { return await record.owner.observe(); }
  finally { record.busy = false; }
}

export function releaseSphSpatialVaporAerosolExchangeCandidate(candidate) {
  const record = vaporAerosolCandidates.get(candidate);
  if (!record || record.busy) return false;
  if (record.releaseRequested) return record.releasePromise;
  record.releaseRequested = true;
  record.releasePromise = record.owner.release();
  return record.releasePromise;
}

/** Schedule the one generation-owner fence after the final queue consumer. */
export function releaseSphSpatialGasLedgerEosAfterQueue(execution) {
  const record = retainedExecutions.get(execution);
  if (
    !record
    || record.terminal
    || record.released
    || record.releasePromise
    || record.releaseAttempted
  ) {
    return false;
  }
  if (record.activePressureConsumerReceipt || record.activeExchangeOperation
    || (record.pressureMechanicsFamily && !record.pressureMechanicsFamily.closed)) {
    record.status =
      'spatial-gas-ledger-eos-release-blocked-active-pressure-consumer';
    return false;
  }
  if (
    record.execution !== execution
    || record.slot.ownerToken !== record.ownerToken
    || record.slot.retainedExecution !== execution
  ) {
    record.status = 'spatial-gas-ledger-eos-release-owner-mismatch';
    return false;
  }
  record.releaseAttempted = true;
  const finalConsumerFenceProvider = record.device.queue?.onSubmittedWorkDone;
  if (typeof finalConsumerFenceProvider !== 'function') {
    return quarantineRetainedExecution(
      record,
      'spatial-gas-ledger-eos-release-quarantined-fence-provider-missing',
      'spatial-gas-final-consumer-cleanup-fence-provider-missing'
    );
  }
  let finalConsumerFenceCandidate;
  try {
    finalConsumerFenceCandidate = finalConsumerFenceProvider.call(
      record.device.queue
    );
  } catch (error) {
    record.releaseError = error instanceof Error ? error.message : String(error);
    return quarantineRetainedExecution(
      record,
      'spatial-gas-ledger-eos-release-quarantined-fence-provider-error',
      'spatial-gas-final-consumer-cleanup-fence-provider-error'
    );
  }
  const finalConsumerFence = promiseFromConfirmedThenable(
    finalConsumerFenceCandidate
  );
  if (!finalConsumerFence) {
    return quarantineRetainedExecution(
      record,
      'spatial-gas-ledger-eos-release-quarantined-fence-provider-nonthenable',
      'spatial-gas-final-consumer-cleanup-fence-provider-nonthenable'
    );
  }
  record.deferredCleanupReadbackTelemetry
    .recordDeferredCleanupHostQueueFence(
      1,
      'spatial-gas-final-consumer-cleanup'
    );
  let scheduled = false;
  try {
    scheduled =
      releaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer(
        record.spatialGeneration,
        record.device
      );
  } catch (error) {
    record.status =
      'spatial-gas-ledger-eos-release-queue-ordered-child-error';
    record.deferredCleanupReadbackTelemetry.markUnknown(
      `spatial-generation-queue-ordered-release-error:${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return quarantineRetainedExecution(
      record,
      'spatial-gas-ledger-eos-release-quarantined-child-error',
      'spatial-gas-final-consumer-cleanup-child-error'
    );
  }
  if (
    scheduled !== true
    && record.spatialGeneration.releaseScheduled !== true
  ) {
    return quarantineRetainedExecution(
      record,
      record.spatialGeneration.releaseStatus
        || 'spatial-gas-ledger-eos-release-quarantined-child-rejected',
      'spatial-gas-final-consumer-cleanup-child-result-unconfirmed'
    );
  }
  record.status = 'spatial-gas-ledger-eos-release-scheduled-after-final-consumer';
  const spatialGenerationRelease = promiseFromConfirmedThenable(
    record.spatialGeneration.releasePromise
  );
  if (!spatialGenerationRelease) {
    return quarantineRetainedExecution(
      record,
      'spatial-gas-ledger-eos-release-quarantined-child-promise-missing',
      'spatial-gas-final-consumer-cleanup-child-promise-missing'
    );
  }
  const dependentReleases = [
    finalConsumerFence.then(() => true),
    spatialGenerationRelease
  ];
  if (record.generationConsumerLease) {
    dependentReleases.push(
      releaseSchroederSpatialEpochGenerationConsumerLeaseAfter(
        record.generationConsumerLease,
        finalConsumerFence
      )
    );
  }
  if (record.gasFreeVolumeRuntime && record.gasFreeVolumeExecution) {
    dependentReleases.push(
      releaseSphSpatialGasFreeVolumeExecutionAfter(
        record.gasFreeVolumeRuntime,
        record.gasFreeVolumeExecution,
        finalConsumerFence
      )
    );
  }
  record.releasePromise = Promise.all(dependentReleases).then(
    (results) => releaseSlot(
      record,
      results.every((confirmed) => confirmed === true)
    ),
    () => releaseSlot(record, false)
  );
  record.slot.releasePromise = record.releasePromise;
  return true;
}

async function mappedBufferCopy(device, sourceBuffer, byteLength, label, sourceOffset = 0) {
  const size = alignedBytes(byteLength);
  const readback = createOwnedBuffer(device, {
    label,
    size,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    const encoder = device.createCommandEncoder({ label: `${label}-encoder` });
    encoder.copyBufferToBuffer(sourceBuffer, sourceOffset, readback, 0, size);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPU_MAP_MODE.READ, 0, size);
    const copy = readback.getMappedRange(0, size).slice(0, byteLength);
    readback.unmap();
    return copy;
  } finally {
    readback.destroy?.();
  }
}

function decodeCompactOracle(values) {
  const rows = [];
  for (
    let offset = 0;
    offset + SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS <= values.length;
    offset += SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
  ) {
    if (!(values[offset + 10] > 0.5)) continue;
    const sourceDiscriminant = values[offset + 8];
    const particleSource = Object.is(sourceDiscriminant, -1);
    rows.push({
      positionM: Array.from(values.slice(offset, offset + 3)),
      materialId: values[offset + 3],
      massKg: values[offset + 4],
      moles: values[offset + 5],
      temperatureK: values[offset + 6],
      supportVolumeM3: values[offset + 7],
      sourceKind: particleSource ? 'particle' : 'product-event',
      sourceDiscriminant,
      productTermIndex: particleSource ? null : sourceDiscriminant,
      particleIndex: particleSource ? values[offset + 9] : null,
      sourceRowIndex: values[offset + 9],
      status: values[offset + 10],
      routingId: values[offset + 11],
      sourceSpecificInternalEnergyJPerKg: values[offset + 12],
      sourceTemperatureK: values[offset + 13],
      sourcePhaseId: values[offset + 14]
    });
  }
  return rows;
}

function decodePressureOracle(values) {
  const cells = [];
  for (
    let offset = 0;
    offset + SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS <= values.length;
    offset += SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS
  ) {
    if (!(values[offset + 3] > 0.5)) continue;
    cells.push({
      index: offset / SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS,
      gridIndex: Array.from(values.slice(offset, offset + 3)),
      centerM: Array.from(values.slice(offset + 4, offset + 7)),
      pressurePa: values[offset + 7],
      pressureGradientPaPerM: Array.from(values.slice(offset + 8, offset + 11)),
      volumeM3: values[offset + 11],
      status: 'local-gas-pressure-cell-ready'
    });
  }
  return cells;
}

function decodeAuthorityControlOracle(copy, record) {
  const words = new Uint32Array(copy);
  const at = SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS;
  const status = words[at.STATUS_FLAGS] >>> 0;
  const errors = words[at.ERROR_FLAGS] >>> 0;
  const requiredReady = SPH_SPATIAL_GAS_AUTHORITY_STATUS.INITIALIZED
    | SPH_SPATIAL_GAS_AUTHORITY_STATUS.COMPACT_READY
    | SPH_SPATIAL_GAS_AUTHORITY_STATUS.DIRECTORY_READY
    | SPH_SPATIAL_GAS_AUTHORITY_STATUS.EOS_READY
    | SPH_SPATIAL_GAS_AUTHORITY_STATUS.PRESSURE_READY;
  const invalid = (
    words[at.MAGIC] !== SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC
    || words[at.VERSION] !== SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION
    || words[at.EXECUTION_GENERATION] !== record.executionGeneration
    || words[at.COMPLETION_GENERATION] !== record.executionGeneration
    || words[at.SOURCE_STORAGE_GENERATION] !== record.storageGeneration
    || words[at.SOURCE_CAPACITY] !== record.capacity
    || words[at.COMPACT_STRIDE] !== SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
    || words[at.ACTIVE_NODE_STRIDE] !== SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS
    || words[at.PRESSURE_STRIDE] !== SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS
    || words[at.PROJECTION_VERSION] !== record.gasControlVolumeDescriptor.version
    || words[at.CONTROL_VOLUME_GEOMETRY_SEAL] !== record.gasControlVolumeDescriptor.seal
    || errors !== 0
    || (status & SPH_SPATIAL_GAS_AUTHORITY_STATUS.FAILED) !== 0
    || (status & requiredReady) !== requiredReady
  );
  const liveResidualCount = words[at.LIVE_RESIDUAL_COUNT] >>> 0;
  const directoryCellCount = words[at.DIRECTORY_CELL_COUNT] >>> 0;
  const readyPressureCount = words[at.READY_PRESSURE_COUNT] >>> 0;
  if (
    invalid
    || liveResidualCount > record.capacity
    || directoryCellCount > liveResidualCount
    || readyPressureCount !== directoryCellCount
  ) {
    const error = pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_CONTROL_INVALID',
      'Gas authority control did not publish one complete authenticated prefix'
    );
    error.controlWords = Object.freeze(Array.from(words, (word) => word >>> 0));
    throw error;
  }
  return {
    words,
    status,
    errors,
    liveResidualCount,
    directoryGeneration: words[at.DIRECTORY_GENERATION] >>> 0,
    directoryCellCount,
    readyPressureCount,
    empty: (status & SPH_SPATIAL_GAS_AUTHORITY_STATUS.EMPTY) !== 0
  };
}

/**
 * Explicit O(N) diagnostic oracle. Only this path materializes compact/EOS
 * rows on the host; the separate species diagnostic copies one fixed packet.
 */
export async function observeSphSpatialGasLedgerEosOracle(execution) {
  const record = retainedExecutions.get(execution);
  if (
    !record
    || record.terminal
    || record.released
    || record.releasePromise
    || record.slot.ownerToken !== record.ownerToken
    || record.slot.retainedExecution !== execution
    || record.execution !== execution
  ) {
    throw new Error('spatial gas ledger/EOS oracle requires a live retained execution');
  }
  const controlCopy = await mappedBufferCopy(
    record.device,
    record.slot.controlBuffer,
    SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES,
    'ulg-sph-spatial-gas-ledger-full-oracle-control'
  );
  const control = decodeAuthorityControlOracle(controlCopy, record);
  // Control observation yields. Do not copy a new arena occupant's rows if
  // the original final pressure consumer retired this owner in that gap.
  if (record.terminal || record.released || record.releasePromise || record.releaseAttempted
    || record.quarantined || record.slot.ownerToken !== record.ownerToken
    || record.slot.retainedExecution !== execution) {
    throw new Error('spatial gas ledger/EOS oracle lost its retained owner during control observation');
  }
  record.particleProductSourcePair?.validate();
  const compactByteLength = control.liveResidualCount
    * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
    * FLOAT32_BYTES;
  const pressureByteLength = control.readyPressureCount
    * SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS
    * FLOAT32_BYTES;
  const headerByteLength = SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS * UINT32_BYTES;
  const mixtureByteLength = control.readyPressureCount
    * SPH_SPATIAL_GAS_MIXTURE_MOMENT_ROW_FLOATS * FLOAT32_BYTES;
  const caloricByteLength = record.caloricModule ? control.readyPressureCount * 8 * FLOAT32_BYTES : 0;
  const [compactCopy, pressureCopy, directoryHeaderCopy, mixtureCopy, caloricCopy] = await Promise.all([
    mappedBufferCopy(
      record.device,
      record.slot.compactRowsBuffer,
      compactByteLength,
      'ulg-sph-spatial-gas-ledger-full-oracle-compact'
    ),
    mappedBufferCopy(
      record.device,
      record.slot.gasPressureCellsBuffer,
      pressureByteLength,
      'ulg-sph-spatial-gas-ledger-full-oracle-pressure'
    ),
    mappedBufferCopy(
      record.device,
      record.spatialGeneration.execution.directoryBuffer,
      headerByteLength,
      'ulg-sph-spatial-gas-ledger-full-oracle-directory-header'
    ),
    mappedBufferCopy(record.device, record.slot.gasMixtureMomentsBuffer,
      mixtureByteLength, 'ulg-sph-spatial-gas-ledger-full-oracle-mixture'),
    record.caloricModule ? mappedBufferCopy(record.device, record.slot.caloricRowsBuffer,
      caloricByteLength, 'ulg-sph-spatial-gas-ledger-full-oracle-caloric') : null
  ]);
  record.particleProductSourcePair?.validate();
  const compactValues = new Float32Array(compactCopy);
  const pressureValues = new Float32Array(pressureCopy);
  const directoryHeader = new Uint32Array(directoryHeaderCopy);
  if (
    directoryHeader[0] !== SCHROEDER_SPATIAL_EPOCH_MAGIC
    || directoryHeader[1] !== SCHROEDER_SPATIAL_EPOCH_VERSION
    || directoryHeader[3] !== control.directoryGeneration
    || directoryHeader[16] !== control.liveResidualCount
    || directoryHeader[17] !== record.capacity
    || directoryHeader[18] !== control.directoryCellCount
    || directoryHeader[37] !== control.liveResidualCount
    || directoryHeader[38] !== control.directoryCellCount
  ) {
    throw pressureAuthorityError(
      'ERR_SPH_GAS_PRESSURE_AUTHORITY_DIRECTORY_INVALID',
      'Gas authority directory header disagrees with its sealed control record'
    );
  }
  const compactRows = decodeCompactOracle(compactValues);
  const pressureCells = decodePressureOracle(pressureValues);
  const caloricCells = record.caloricModule
    ? record.caloricModule.decodeSphSpatialGasCaloricAdmissionRows(new Float32Array(caloricCopy)) : null;
  return {
    schema: 'peercompute.ulg.sph-spatial-gas-ledger-eos-oracle.v4',
    status: 'spatial-gas-ledger-eos-full-oracle-observed',
    explicitDiagnostic: true,
    diagnosticsMode: SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE,
    mapAsyncCount: record.caloricModule ? 6 : 5,
    readbackByteLength:
      SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES
      + compactByteLength + pressureByteLength + headerByteLength + mixtureByteLength + caloricByteLength,
    hostMaterializedRowCount: compactRows.length + pressureCells.length + control.readyPressureCount
      + (caloricCells?.length ?? 0),
    mixtureMoments: decodeSphSpatialGasMixtureMomentRows(new Float32Array(mixtureCopy)),
    caloricCells,
    particleProductSourcePaired: record.particleProductSourcePair != null,
    mixtureCaloricClosureAdmitted: Boolean(caloricCells?.length && caloricCells.every((cell) => cell.ready)),
    exchangeIntervalAdmitted: false,
    compactValues,
    compactRows,
    pressureValues,
    pressureCells,
    controlWords: control.words,
    controlStatusFlags: control.status,
    controlErrorFlags: control.errors,
    liveGasCandidateCount: control.liveResidualCount,
    // Compatibility diagnostic name from the product-residual-only source.
    liveResidualCount: control.liveResidualCount,
    readyPressureCount: control.readyPressureCount,
    empty: control.empty,
    directoryHeader,
    directoryCellCount: control.directoryCellCount,
    directoryStatusFlags: directoryHeader[2] ?? 0,
    directoryGenerationId: directoryHeader[3] ?? 0,
    scientificValidation: false,
    gasValidation: false,
    fullPhysicsValidation: false
  };
}

/** Copy one diagnostic packet while the exact EOS owner is still live. */
export async function observeSphSpatialGasSpeciesDiagnostics(execution, { cellIndex = 0 } = {}) {
  const record = retainedExecutions.get(execution);
  if (!record || !record.speciesDiagnostics || record.terminal || record.released
    || record.releasePromise || record.releaseAttempted || record.quarantined
    || record.slot.ownerToken !== record.ownerToken
    || record.slot.retainedExecution !== execution || record.execution !== execution) {
    throw new Error('Species diagnostic requires an enabled live retained EOS execution');
  }
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= record.capacity) {
    throw new RangeError('Species diagnostic cellIndex exceeds the retained capacity');
  }
  const rowBytes = record.speciesDiagnostics.rowWords * UINT32_BYTES;
  // Copy is submitted synchronously before mapAsync yields. Later same-queue
  // retirement/reuse cannot change the captured diagnostic packet.
  const packet = await mappedBufferCopy(
    record.device, record.slot.speciesDiagnosticRowsBuffer, rowBytes,
    'ulg-sph-spatial-gas-species-diagnostic-packet', cellIndex * rowBytes
  );
  return decodeSphSpatialGasSpeciesDiagnosticPacket(packet, record, cellIndex);
}

export function sphSpatialGasLedgerEosArenaStats(device) {
  const byCapacity = deviceRuntimes.get(device);
  const runtimes = byCapacity ? [...byCapacity.values()] : [];
  const gasFreeVolumeRuntimes = runtimes.flatMap(
    (runtime) => [...runtime.gasFreeVolumeRuntimes.values()]
  );
  const gasFreeVolumeBufferCount = gasFreeVolumeRuntimes.reduce(
    (sum, runtime) => sum + runtime.retainedGpuBufferCount,
    0
  );
  const gasFreeVolumeBufferByteLength = gasFreeVolumeRuntimes.reduce(
    (sum, runtime) => sum + runtime.retainedGpuBufferBytes,
    0
  );
  return Object.freeze({
    schema: 'peercompute.ulg.sph-spatial-gas-ledger-eos-arena-stats.v1',
    status: runtimes.length
      ? 'spatial-gas-ledger-eos-arena-stats-ready'
      : 'spatial-gas-ledger-eos-arena-uninitialized',
    deviceId: device ? webGpuDeviceId(device) : null,
    runtimeCount: runtimes.length,
    capacities: Object.freeze(runtimes.map((runtime) => runtime.capacity)),
    retainedBufferCount: runtimes.reduce(
      (sum, runtime) => sum + runtime.slots.reduce(
        (slotSum, slot) => slotSum + 8 + slot.speciesDiagnosticBuffers.length + slot.caloricBuffers.length
          + slot.compactionScan.allocationEntries().length,
        0
      ),
      0
    ) + gasFreeVolumeBufferCount,
    retainedBufferByteLength: runtimes.reduce(
      (sum, runtime) => sum + runtime.slots.reduce((slotSum, slot) => {
        const direct = [
          slot.compactRowsBuffer,
          slot.activeNodeBuffer,
          slot.gasPressureCellsBuffer,
          slot.gasMixtureMomentsBuffer,
          ...slot.caloricBuffers,
          slot.candidateFlagsBuffer,
          slot.candidateOffsetsBuffer,
          slot.controlBuffer,
          slot.paramsBuffer,
          ...slot.speciesDiagnosticBuffers
        ];
        const scan = slot.compactionScan.allocationEntries()
          .map((entry) => entry.buffer);
        return slotSum + [...direct, ...scan].reduce(
          (byteSum, buffer) => byteSum + Math.max(0, Number(buffer?.size) || 0),
          0
        );
      }, 0), 0
    ) + gasFreeVolumeBufferByteLength,
    inUseSlotCount: runtimes.reduce(
      (sum, runtime) => sum + runtime.slots.filter((slot) => slot.inUse).length,
      0
    ),
    acquireCount: runtimes.reduce((sum, runtime) => sum + runtime.acquireCount, 0),
    reuseCount: runtimes.reduce((sum, runtime) => sum + runtime.reuseCount, 0),
    terminal: lostDevices.has(device)
  });
}

/** Destroy only fully idle warm arenas. Live retained outputs fail closed. */
export function destroySphSpatialGasLedgerEosGpu(device) {
  const byCapacity = deviceRuntimes.get(device);
  if (!byCapacity) return false;
  if ([...byCapacity.values()].some((runtime) => (
    runtime.slots.some((slot) => slot.inUse)
    || [...runtime.gasFreeVolumeRuntimes.values()].some(
      (freeVolumeRuntime) => (
        activeSphSpatialGasFreeVolumeExecutionCount(freeVolumeRuntime) > 0
      )
    )
  ))) {
    return false;
  }
  for (const runtime of byCapacity.values()) {
    runtime.terminal = true;
    for (const slot of runtime.slots) {
      slot.terminal = true;
      destroySlot(slot);
    }
    for (const freeVolumeRuntime of runtime.gasFreeVolumeRuntimes.values()) {
      destroySphSpatialGasFreeVolumeGpu(freeVolumeRuntime);
    }
  }
  deviceRuntimes.delete(device);
  return true;
}

export const SPH_SPATIAL_GAS_LEDGER_EOS_DIRECTORY_ABI = Object.freeze({
  schema: ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA,
  productEventRowStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  particleStateRowStrideFloats: SPH_PARTICLE_STATE_STRIDE_FLOATS,
  particleThermoRowStrideFloats: SPH_PARTICLE_THERMO_STRIDE_FLOATS,
  compactRowStrideFloats: SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS,
  compactRowLayout: Object.freeze([
    'positionXM:f32',
    'positionYM:f32',
    'positionZM:f32',
    'materialId:f32',
    'massKg:f32',
    'moles:f32',
    'temperatureK:f32',
    'supportVolumeM3:f32',
    'sourceDiscriminant:f32(-1=particle,nonnegative=productTermIndex)',
    'sourceRowOrParticleIndex:f32',
    'ready:f32',
    'gasRoutingId:f32'
  ]),
  activeNodeRowStrideFloats: SPH_SPATIAL_GAS_ACTIVE_NODE_ROW_FLOATS,
  pressureCellRowStrideFloats: SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS,
  pressureCellLayout: Object.freeze([
    'cellX:f32',
    'cellY:f32',
    'cellZ:f32',
    'ready:f32',
    'centerXM:f32',
    'centerYM:f32',
    'centerZM:f32',
    'pressurePa:f32',
    'gradientXPaPerM:f32',
    'gradientYPaPerM:f32',
    'gradientZPaPerM:f32',
    'freeVolumeM3:f32'
  ]),
  sourcePositionAuthority: SPATIAL_GAS_UNION_POSITION_AUTHORITY,
  sourceFamily: SPATIAL_GAS_UNION_SOURCE_FAMILY,
  candidateUnionOrder:
    'unplaced-product-event-prefix-then-phase-pure-particle-prefix',
  directoryAuthority: 'generic-schroeder-spatial-epoch-v1',
  sparseSourcePolicy:
    'stable-gpu-compacted-logical-prefix-with-capacity-sized-allocation',
  normalReadbackPolicy: 'none',
  diagnosticReadbackPolicy: SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE,
  retirementPolicy: 'final-consumer-queue-fence-generation-owner',
  scientificValidation: false
});

// Keep the shader-side constants visibly tied to the imported SS ABI.
if (
  SCHROEDER_SPATIAL_EPOCH_MAGIC !== 0x53534531
  || SCHROEDER_SPATIAL_EPOCH_VERSION !== 1
  || SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS !== 48
) {
  throw new Error('Spatial gas ledger/EOS WGSL requires Schroeder spatial epoch ABI v1');
}
