import {
  SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
  SCHROEDER_SPATIAL_EPOCH_MAGIC,
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SCHROEDER_SPATIAL_QUERY_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_QUERY_GEOMETRY_SINGLE_CHART_POW2,
  SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  createSchroederSpatialEpochBuildPlan,
  createSchroederSpatialEpochLayout
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  schroederSpatialEpochAssembleWgsl,
  schroederSpatialEpochKeyWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialEpochWgsl.js';
import {
  SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES,
  SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_WORDS
} from '../../../ulg-gpu-abi/src/schroederMechanicsSpatialAuthorityWgsl.js';
import {
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0,
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES,
  ULG_SCHROEDER_SPATIAL_CONSUMER_AUTHENTICATION_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA,
  createSchroederSpatialExactNearExpectationV1Data,
  resolveSchroederSpatialSupportProfileContract
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import { createWebGpuStableRadixScanUnique } from '../webgpuRadixScanUnique.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId,
  webGpuDeviceMismatchInfo
} from './sphGpuDeviceIdentity.js';
import { createSchroederSpatialMechanicsViewGpu } from './schroederSpatialMechanicsViewGpu.js';
import {
  createSchroederSpatialMechanicsFieldViewGpu
} from './schroederSpatialMechanicsFieldViewGpu.js';
import {
  createSchroederSpatialPhaseVolumeMomentGpu
} from './schroederSpatialPhaseVolumeMomentGpu.js';
import {
  createSchroederSpatialHierarchyViewGpu
} from './schroederSpatialHierarchyViewGpu.js';
import {
  createSchroederSpatialParentFieldViewGpu
} from './schroederSpatialParentFieldViewGpu.js';
import {
  createSchroederSpatialAggregateViewGpu
} from './schroederSpatialAggregateViewGpu.js';

export {
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  schroederSpatialEpochAssembleWgsl,
  schroederSpatialEpochKeyWgsl
};

export const SCHROEDER_SPATIAL_EPOCH_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES = 192;
export const SCHROEDER_SPATIAL_EPOCH_ARENA_COUNT_DEFAULT = 2;
export const ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA =
  'peercompute.ulg.schroeder-spatial-epoch-generation.v1';
export const ULG_SCHROEDER_SPATIAL_DIRECTORY_SOURCE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1';

const ACTIVE_NODE_STRIDE_FLOATS = 16;
const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const PARAMS_BUFFER_BYTES = 256;
const MAX_EXACT_F32_INTEGER = 0x00ff_ffff;
const DIRECT_SPATIAL_EPOCH_ARENA_COUNT = 3;
const DIRECT_MECHANICS_VIEW_RUNTIME_CACHE_LIMIT = 4;
const DIRECT_MECHANICS_FIELD_VIEW_DRAINING_RUNTIME_LIMIT =
  DIRECT_SPATIAL_EPOCH_ARENA_COUNT * 2;
const DIRECT_MECHANICS_FIELD_VIEW_RUNTIME_READY =
  'schroeder-spatial-mechanics-field-view-gpu-runtime-ready';
const directSpatialEpochRuntimeCache = new WeakMap();
const exactNearConsumerAuthentications = new WeakMap();
const finalizedExactNearConsumerReceipts = new WeakSet();
const ownedSpatialEpochGenerations = new WeakSet();
const postSubmitCleanupGenerationOrigins = new WeakMap();
const spatialEpochGenerationRetirements = new WeakMap();
const deviceLossTerminalizedSpatialRuntimes = new WeakSet();
const spatialEpochLostDevices = new WeakSet();
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function positiveInteger(value, label, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function nonNegativeInteger(value, label, max = 0xffff_ffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > max) {
    throw new RangeError(`${label} must be an integer in [0, ${max}]`);
  }
  return number;
}

function exactU32OrNull(value, { positive = false } = {}) {
  if (typeof value !== 'number') return null;
  const number = value;
  if (
    !Number.isInteger(number)
    || number < (positive ? 1 : 0)
    || number > 0xffff_ffff
  ) return null;
  return number === 0 ? 0 : number;
}

function exactI32OrNull(value) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) return null;
  return value === 0 ? 0 : value;
}

function exactFiniteNumberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positivePowerOfTwoCapacity(value) {
  const count = Math.max(1, Math.trunc(Number(value) || 1));
  let capacity = 1;
  while (capacity < count) capacity *= 2;
  return capacity;
}

function unavailableSpatialDirectorySource(source, device, status, reason, extra = {}) {
  return {
    schema: ULG_SCHROEDER_SPATIAL_DIRECTORY_SOURCE_SCHEMA,
    sourceSchema: source?.schema ?? null,
    sourceStatus: source?.status ?? null,
    status,
    reason,
    ready: false,
    sourceCount: 0,
    sourceDeviceId: null,
    consumerDeviceId: device ? webGpuDeviceId(device) : null,
    ...extra
  };
}

/**
 * Admit the temporary active-node adapter as a source for the generic spatial
 * directory.  This contract is intentionally weaker than an exact-near law
 * view: phase-volume overlays are legal here because each active-node row
 * carries its own native spacing.  A law that derives query radii from a
 * level-wide spacing profile must still require its own spacing sidecar.
 */
export function resolveSchroederSpatialDirectoryActiveNodeSource(
  activeNodeList = null,
  { device = null, particleCount = null } = {}
) {
  const source = activeNodeList;
  if (!source) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-unavailable',
      'No active-node source was provided'
    );
  }
  if (
    source.spatialDirectorySourceSchema !== ULG_SCHROEDER_SPATIAL_DIRECTORY_SOURCE_SCHEMA
    || source.spatialDirectorySourceReady !== true
    || source.spatialDirectorySourceStatus !== 'schroeder-spatial-directory-source-ready'
  ) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-contract',
      source.spatialDirectorySourceStatus
        || 'The active-node source does not publish the canonical directory adapter contract'
    );
  }
  const activeNodeBuffer = source.activeNodeBuffer || source.buffer || null;
  if (!activeNodeBuffer) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-buffer',
      'The active-node source has no retained GPU buffer'
    );
  }
  const mismatch = webGpuDeviceMismatchInfo({ buffer: activeNodeBuffer, device });
  if (mismatch.mismatch) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-device',
      'The active-node source belongs to another WebGPU device',
      {
        sourceDeviceId: mismatch.sourceDeviceId,
        consumerDeviceId: mismatch.consumerDeviceId
      }
    );
  }
  const sourceCount = exactU32OrNull(
    source.activeCandidateCount ?? source.activeNodeCount ?? source.particleCount
  );
  const expectedCount = particleCount == null ? sourceCount : exactU32OrNull(particleCount);
  if (sourceCount == null || sourceCount < 1 || expectedCount == null || sourceCount !== expectedCount) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-count',
      `Active-node count ${sourceCount ?? 'missing'} does not match particle count ${expectedCount ?? 'missing'}`,
      { sourceCount: sourceCount ?? 0 }
    );
  }
  const strideFloats = exactU32OrNull(source.activeNodeStrideFloats);
  if (strideFloats !== ACTIVE_NODE_STRIDE_FLOATS) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-stride',
      `Active-node stride ${strideFloats ?? 'missing'} is not ${ACTIVE_NODE_STRIDE_FLOATS}`,
      { sourceCount }
    );
  }
  const requiredBytes = sourceCount * ACTIVE_NODE_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  if (Number.isFinite(Number(activeNodeBuffer.size)) && Number(activeNodeBuffer.size) < requiredBytes) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-buffer-size',
      `Active-node buffer has ${activeNodeBuffer.size} bytes; ${requiredBytes} required`,
      { sourceCount }
    );
  }
  const storageGeneration = exactU32OrNull(source.spatialEpochStorageGeneration, {
    positive: true
  });
  const physicsTick = exactU32OrNull(source.spatialEpochPhysicsTick);
  const physicsSubstep = exactU32OrNull(source.spatialEpochPhysicsSubstep);
  const positionEpoch = exactU32OrNull(source.spatialEpochPositionEpoch);
  const topologyEpoch = exactU32OrNull(source.spatialEpochTopologyEpoch);
  const chartEpoch = exactU32OrNull(source.spatialEpochChartEpoch);
  const levelEpoch = exactU32OrNull(source.spatialEpochLevelEpoch);
  const supportEpoch = exactU32OrNull(source.spatialEpochSupportEpoch);
  if (
    storageGeneration == null
    || physicsTick == null
    || physicsSubstep == null
    || positionEpoch == null
    || topologyEpoch == null
    || chartEpoch == null
    || levelEpoch == null
    || supportEpoch == null
  ) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-generation',
      'The active-node source lacks a complete immutable buffer/epoch generation',
      { sourceCount }
    );
  }
  const exactNearMinLevel = exactI32OrNull(source.spatialEpochMinLevel);
  const exactNearMaxLevel = exactI32OrNull(source.spatialEpochMaxLevel);
  const exactNearBaseGridSpacingM = exactFiniteNumberOrNull(
    source.spatialEpochBaseGridSpacingM
  );
  const exactNearChartId = exactU32OrNull(source.spatialEpochChartId);
  const exactNearLevelCount = exactNearMinLevel == null || exactNearMaxLevel == null
    ? null
    : exactNearMaxLevel - exactNearMinLevel + 1;
  const exactNearQueryProfileReady = Boolean(
    source.spatialEpochSourceSchema
      === 'peercompute.ulg.schroeder-spatial-active-node-source.v1'
    && source.spatialEpochSourceReady === true
    && source.spatialEpochSourceStatus === 'schroeder-spatial-active-node-source-ready'
    && source.spatialEpochLevelSpacingMode
      === 'base-grid-spacing-times-pow2-level'
    && source.spatialEpochPositionAuthority
      === 'same-epoch-pre-integration-particle-state'
    && Number.isInteger(exactNearMinLevel)
    && Number.isInteger(exactNearMaxLevel)
    && exactNearLevelCount > 0
    && exactNearLevelCount <= 64
    && exactNearChartId != null
    && exactNearChartId <= 0x00ff_ffff
    && exactNearBaseGridSpacingM > 0
    && Number.isFinite(exactNearBaseGridSpacingM * (2 ** exactNearMinLevel))
    && exactNearBaseGridSpacingM * (2 ** exactNearMinLevel) > 0
    && Number.isFinite(exactNearBaseGridSpacingM * (2 ** exactNearMaxLevel))
    && exactNearBaseGridSpacingM * (2 ** exactNearMaxLevel) > 0
    && source.phaseVolumeAssignmentOverlayEnabled !== true
  );
  const exactNearQueryProfile = Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
    status: exactNearQueryProfileReady
      ? 'schroeder-spatial-exact-near-query-profile-ready'
      : 'schroeder-spatial-exact-near-query-profile-unavailable',
    ready: exactNearQueryProfileReady,
    sourceSchema: source.spatialEpochSourceSchema ?? null,
    sourceStatus: source.spatialEpochSourceStatus ?? null,
    sourceBuffer: activeNodeBuffer,
    activeNodeBuffer,
    sourceCount,
    chartId: exactNearChartId,
    minLevel: Number.isInteger(exactNearMinLevel) ? exactNearMinLevel : null,
    maxLevel: Number.isInteger(exactNearMaxLevel) ? exactNearMaxLevel : null,
    levelCount: Number.isInteger(exactNearLevelCount) ? exactNearLevelCount : null,
    baseGridSpacingM: Number.isFinite(exactNearBaseGridSpacingM)
      ? exactNearBaseGridSpacingM
      : null,
    levelSpacingMode: source.spatialEpochLevelSpacingMode ?? null,
    positionAuthority: source.spatialEpochPositionAuthority ?? null,
    storageGeneration,
    physicsTick,
    physicsSubstep,
    positionEpoch,
    topologyEpoch,
    chartEpoch,
    levelEpoch,
    supportEpoch
  });
  return {
    schema: ULG_SCHROEDER_SPATIAL_DIRECTORY_SOURCE_SCHEMA,
    sourceSchema: source.schema ?? null,
    sourceStatus: source.status ?? null,
    status: 'schroeder-spatial-directory-source-ready',
    reason: null,
    ready: true,
    sourceBuffer: activeNodeBuffer,
    activeNodeBuffer,
    sourceRowLayoutId: SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0,
    sourceRowStrideFloats: strideFloats,
    sourceCount,
    activeNodeStrideFloats: strideFloats,
    storageGeneration,
    physicsTick,
    physicsSubstep,
    positionEpoch,
    topologyEpoch,
    chartEpoch,
    levelEpoch,
    supportEpoch,
    phaseVolumeAssignmentOverlayEnabled:
      source.phaseVolumeAssignmentOverlayEnabled === true,
    exactNearQueryProfile,
    sourceDeviceId: mismatch.sourceDeviceId,
    consumerDeviceId: mismatch.consumerDeviceId
  };
}

/**
 * Admit level-assignment rows directly as the canonical spatial source. The
 * rows already contain the exact level, native spacing, status, position and
 * chart needed by both directory key emission and the compact mechanics view.
 */
export function resolveSchroederSpatialDirectoryLevelAssignmentSource(
  levelAssignment = null,
  { device = null, particleCount = null } = {}
) {
  const source = levelAssignment;
  if (
    source?.schema !== 'peercompute.ulg.schroeder-level-assignment-execution.v0'
    || source?.status !== 'schroeder-level-assignment-submitted'
    || source?.bufferFamilyGenerationStatus
      !== 'schroeder-particle-buffer-family-generation-ready'
  ) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-contract',
      'The level-assignment execution does not publish a ready immutable buffer family'
    );
  }
  if (!source?.assignmentBuffer) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-buffer',
      'The level-assignment source has no retained GPU buffer'
    );
  }
  const sourceBuffer = source.assignmentBuffer;
  const mismatch = webGpuDeviceMismatchInfo({ buffer: sourceBuffer, device });
  if (mismatch.mismatch) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-device',
      'The level-assignment source belongs to another WebGPU device',
      mismatch
    );
  }
  const sourceStateBuffer = source.sourceStateBuffer || null;
  const sourceStateMismatch = sourceStateBuffer
    ? webGpuDeviceMismatchInfo({ buffer: sourceStateBuffer, device })
    : { mismatch: false };
  if (sourceStateMismatch.mismatch) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-state-device',
      'The level-assignment source-state authority belongs to another WebGPU device',
      sourceStateMismatch
    );
  }
  // Strict raw V0*J diagnostics are optional for the directory itself. Keep
  // an exact borrowed mechanics source only when this assignment can prove it
  // is same-device and large enough for the immutable 32-float mechanics row;
  // otherwise leave the core spatial generation live and omit the sidecar.
  const sourceMechanicsCandidate = source.sourceMechanicsBuffer || null;
  const sourceMechanicsMismatch = sourceMechanicsCandidate
    ? webGpuDeviceMismatchInfo({ buffer: sourceMechanicsCandidate, device })
    : { mismatch: false };
  // A frozen fine-substep refresh updates the assignment position/state source
  // but does not rebind or authenticate a current mechanics-family buffer.
  // Its spread prior pointer is therefore deliberately insufficient for raw
  // V0*J lineage. A fresh macro-boundary classifier remains admissible.
  const frozenFineRefresh = source.refreshMode === 'frozen-fine-substep'
    || source.levelClassificationMode === 'frozen-macro-step-no-reclassification';
  const sourceCount = exactU32OrNull(source.particleCount);
  const expectedCount = particleCount == null ? sourceCount : exactU32OrNull(particleCount);
  const strideFloats = exactU32OrNull(source.assignmentStrideFloats);
  if (
    sourceCount == null
    || sourceCount < 1
    || expectedCount == null
    || sourceCount !== expectedCount
    || strideFloats !== ACTIVE_NODE_STRIDE_FLOATS
  ) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-layout',
      'Level-assignment count or 16-float row layout is invalid',
      { sourceCount: sourceCount ?? 0 }
    );
  }
  const requiredBytes = sourceCount * strideFloats * Float32Array.BYTES_PER_ELEMENT;
  if (Number.isFinite(Number(sourceBuffer.size)) && Number(sourceBuffer.size) < requiredBytes) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-buffer-size',
      `Level-assignment buffer has ${sourceBuffer.size} bytes; ${requiredBytes} required`,
      { sourceCount }
    );
  }
  const requiredMechanicsBytes = sourceCount * 32 * Float32Array.BYTES_PER_ELEMENT;
  const sourceMechanicsByteLength = Number(sourceMechanicsCandidate?.size);
  const sourceMechanicsAdmitted = Boolean(
    sourceMechanicsCandidate
    && source.sourceMechanicsBufferBorrowed === true
    && frozenFineRefresh !== true
    && sourceMechanicsMismatch.mismatch !== true
    && (!Number.isFinite(sourceMechanicsByteLength)
      || sourceMechanicsByteLength >= requiredMechanicsBytes)
  );
  const sourceMechanicsProvenanceStatus = sourceMechanicsAdmitted
    ? 'schroeder-spatial-directory-source-mechanics-v0j-ready'
    : sourceMechanicsCandidate == null
      ? 'schroeder-spatial-directory-source-mechanics-v0j-unavailable'
      : sourceMechanicsMismatch.mismatch === true
        ? 'schroeder-spatial-directory-source-mechanics-v0j-device-mismatch'
      : source.sourceMechanicsBufferBorrowed !== true
          ? 'schroeder-spatial-directory-source-mechanics-v0j-not-borrowed'
          : frozenFineRefresh === true
            ? 'schroeder-spatial-directory-source-mechanics-v0j-frozen-refresh-unreproved'
          : 'schroeder-spatial-directory-source-mechanics-v0j-buffer-too-small';
  const identity = {
    storageGeneration: exactU32OrNull(source.storageGeneration, { positive: true }),
    physicsTick: exactU32OrNull(source.physicsTick),
    physicsSubstep: exactU32OrNull(source.physicsSubstep),
    positionEpoch: exactU32OrNull(source.positionEpoch),
    topologyEpoch: exactU32OrNull(source.topologyEpoch),
    chartEpoch: exactU32OrNull(source.chartEpoch),
    levelEpoch: exactU32OrNull(source.levelEpoch),
    supportEpoch: exactU32OrNull(source.supportEpoch)
  };
  if (Object.values(identity).some((value) => value == null)) {
    return unavailableSpatialDirectorySource(
      source,
      device,
      'schroeder-spatial-directory-source-rejected-generation',
      'The level-assignment source lacks a complete immutable buffer/epoch generation',
      { sourceCount }
    );
  }
  const minLevel = exactI32OrNull(source.minLevel);
  const maxLevel = exactI32OrNull(source.maxLevel);
  const chartId = exactU32OrNull(source.chartId);
  const rawBaseGridSpacingM = exactFiniteNumberOrNull(source.baseGridSpacingM);
  const baseGridSpacingM = rawBaseGridSpacingM == null
    ? null
    : Math.fround(rawBaseGridSpacingM);
  const levelCount = minLevel == null || maxLevel == null ? null : maxLevel - minLevel + 1;
  const profileReady = Number.isInteger(levelCount)
    && levelCount >= 1
    && levelCount <= 64
    && chartId != null
    && chartId <= MAX_EXACT_F32_INTEGER
    && baseGridSpacingM > 0
    && Number.isFinite(baseGridSpacingM * (2 ** minLevel))
    && baseGridSpacingM * (2 ** minLevel) >= 0.000001
    && Number.isFinite(baseGridSpacingM * (2 ** maxLevel));
  const exactNearQueryProfile = Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
    status: profileReady
      ? 'schroeder-spatial-exact-near-query-profile-ready'
      : 'schroeder-spatial-exact-near-query-profile-unavailable',
    ready: profileReady,
    sourceBuffer,
    assignmentBuffer: sourceBuffer,
    sourceAssignmentBuffer: source.sourceAssignmentBuffer ?? null,
    sourceStateBuffer,
    sourceStateBufferBorrowed: source.sourceStateBufferBorrowed === true,
    sourceMechanicsBuffer: sourceMechanicsAdmitted ? sourceMechanicsCandidate : null,
    sourceMechanicsBufferBorrowed: sourceMechanicsAdmitted,
    sourceMechanicsBufferByteLength: sourceMechanicsAdmitted
      ? requiredMechanicsBytes
      : 0,
    sourceMechanicsProvenanceStatus,
    sourceCount,
    chartId,
    minLevel,
    maxLevel,
    levelCount,
    baseGridSpacingM,
    levelSpacingMode: 'base-grid-spacing-times-pow2-level',
    positionAuthority: 'same-epoch-pre-integration-particle-state',
    ...identity
  });
  return {
    schema: ULG_SCHROEDER_SPATIAL_DIRECTORY_SOURCE_SCHEMA,
    sourceSchema: source.schema ?? null,
    sourceStatus: source.status ?? null,
    status: profileReady
      ? 'schroeder-spatial-directory-source-ready'
      : 'schroeder-spatial-directory-source-rejected-level-contract',
    reason: profileReady ? null : 'The level-assignment source lacks exact-near level geometry',
    ready: profileReady,
    sourceBuffer,
    sourceStateBuffer,
    sourceStateBufferBorrowed: source.sourceStateBufferBorrowed === true,
    sourceMechanicsBuffer: sourceMechanicsAdmitted ? sourceMechanicsCandidate : null,
    sourceMechanicsBufferBorrowed: sourceMechanicsAdmitted,
    sourceMechanicsBufferByteLength: sourceMechanicsAdmitted
      ? requiredMechanicsBytes
      : 0,
    sourceMechanicsProvenanceStatus,
    sourceCount,
    sourceRowLayoutId: SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceRowStrideFloats: strideFloats,
    phaseVolumeAssignmentOverlayEnabled: false,
    levelClassificationMode: source.levelClassificationMode ?? null,
    levelReclassificationPerformed:
      source.levelReclassificationPerformed === true,
    exactNearQueryProfile,
    ...identity,
    sourceDeviceId: mismatch.sourceDeviceId,
    consumerDeviceId: mismatch.consumerDeviceId
  };
}

function checkedBytes(elements, elementBytes, label) {
  const byteLength = elements * elementBytes;
  if (!Number.isSafeInteger(byteLength) || byteLength < 4) {
    throw new RangeError(`${label} byte length is not safely addressable`);
  }
  return byteLength;
}

function assertDevice(device) {
  if (
    !device?.queue?.writeBuffer
    || !device?.createBuffer
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroup
  ) {
    throw new TypeError('Schroeder spatial epoch requires a GPUDevice-like object');
  }
}

function assertEncoder(encoder) {
  if (!encoder?.clearBuffer || !encoder?.beginComputePass) {
    throw new TypeError(
      'Schroeder spatial epoch encoding requires a caller-owned GPUCommandEncoder-like object'
    );
  }
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value ?? '')) {
    hash ^= character.codePointAt(0) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function dispatchShapeForInvocationCount(invocationCount, maxWorkgroupsPerDimension) {
  const count = nonNegativeInteger(invocationCount, 'invocationCount');
  if (count === 0) return [0, 0, 1];
  const groupCount = Math.ceil(count / SCHROEDER_SPATIAL_EPOCH_WORKGROUP_SIZE);
  const x = Math.min(groupCount, maxWorkgroupsPerDimension);
  const y = Math.ceil(groupCount / x);
  if (y > maxWorkgroupsPerDimension) {
    throw new RangeError(
      `spatial epoch dispatch requires ${groupCount} workgroups beyond `
      + `${maxWorkgroupsPerDimension}x${maxWorkgroupsPerDimension}`
    );
  }
  return [x, y, 1];
}

function timestampProfilingIsActive(timestampProfiler) {
  return typeof timestampProfiler?.beginComputePassDescriptor === 'function'
    && timestampProfiler.active !== false;
}

function timestampPassDescriptor(timestampProfiler, label, metadata) {
  if (timestampProfilingIsActive(timestampProfiler)) {
    return timestampProfiler.beginComputePassDescriptor(label, metadata) || { label };
  }
  return { label };
}

function encodeComputeDispatch(
  encoder,
  pipeline,
  bindGroup,
  dispatch,
  label,
  timestampProfiler,
  timestampMetadata
) {
  if (dispatch[0] === 0 || dispatch[1] === 0 || dispatch[2] === 0) return 0;
  const pass = encoder.beginComputePass(
    timestampPassDescriptor(timestampProfiler, label, timestampMetadata)
  );
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(dispatch[0], dispatch[1], dispatch[2]);
  pass.end();
  return 1;
}

function paramsDataForPlan(plan, {
  keyDispatchX,
  assembleDispatchX,
  consumerDispatchXLimit
}) {
  const atlas = plan.atlas || {
    chartMin: 0,
    chartCount: 0,
    levelMin: 0,
    levelCount: 0,
    cellMin: [0, 0, 0],
    cellCount: [0, 0, 0]
  };
  const buffer = new ArrayBuffer(SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES);
  const view = new DataView(buffer);
  let offset = 0;
  const u32 = (value) => {
    view.setUint32(offset, value >>> 0, true);
    offset += UINT32_BYTES;
  };
  const i32 = (value) => {
    view.setInt32(offset, value | 0, true);
    offset += UINT32_BYTES;
  };
  const f32 = (value) => {
    view.setFloat32(offset, value, true);
    offset += UINT32_BYTES;
  };
  u32(plan.sourceCount);
  u32(plan.sourceCapacity);
  u32(plan.cellCapacity);
  u32(plan.sortKeyWordCount);
  u32(plan.sortMode);
  u32(plan.generationId);
  u32(plan.deviceOrdinal);
  u32(plan.laneOrdinal);
  u32(plan.sourceFamilyId);
  u32(plan.storageGeneration);
  u32(plan.physicsTick);
  u32(plan.physicsSubstep);
  u32(plan.positionEpoch);
  u32(plan.topologyEpoch);
  u32(plan.chartEpoch);
  u32(plan.levelEpoch);
  u32(plan.supportEpoch);
  u32(plan.leaseToken);
  u32(plan.buildOrdinal);
  u32(plan.sortUniqueOrdinal);
  u32(atlas.chartMin);
  u32(atlas.chartCount);
  i32(atlas.levelMin);
  u32(atlas.levelCount);
  i32(atlas.cellMin[0]);
  u32(atlas.cellCount[0]);
  i32(atlas.cellMin[1]);
  u32(atlas.cellCount[1]);
  i32(atlas.cellMin[2]);
  u32(atlas.cellCount[2]);
  u32(plan.layout.headerWords);
  u32(plan.layout.cellKeysOffsetWords);
  u32(plan.layout.cellOffsetsOffsetWords);
  u32(plan.layout.cellMembersOffsetWords);
  u32(plan.layout.particleToCellOffsetWords);
  u32(plan.layout.wordLength);
  u32(plan.requiredDirectoryCapacityWords);
  u32(keyDispatchX);
  u32(assembleDispatchX);
  u32(consumerDispatchXLimit);
  u32(plan.queryGeometryMode);
  u32(plan.queryChartId);
  i32(plan.queryMinLevel);
  i32(plan.queryMaxLevel);
  f32(plan.queryBaseGridSpacingM);
  u32(plan.sourceRowLayoutId);
  u32(0);
  u32(0);
  if (offset !== SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES) {
    throw new Error(
      `spatial epoch params ABI packed ${offset} bytes, expected ${SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES}`
    );
  }
  return new Uint8Array(buffer);
}

function bindGroupForKey(device, arena, pipeline, activeNodeBuffer, activeNodeBindingSize) {
  const cached = arena.keyBindGroups.get(activeNodeBuffer);
  if (cached) {
    arena.bindGroupReuseCount += 1;
    return cached;
  }
  const bindGroup = device.createBindGroup({
    label: `${arena.label}-key-bind-group`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: activeNodeBuffer, offset: 0, size: activeNodeBindingSize }
      },
      { binding: 1, resource: { buffer: arena.exactKeyBuffer } },
      { binding: 2, resource: { buffer: arena.sortKeyBuffer } },
      { binding: 3, resource: { buffer: arena.evidenceBuffer } },
      {
        binding: 4,
        resource: {
          buffer: arena.paramsBuffer,
          offset: 0,
          size: SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES
        }
      }
    ]
  });
  arena.keyBindGroups.set(activeNodeBuffer, bindGroup);
  arena.bindGroupCreationCount += 1;
  return bindGroup;
}

function bindGroupForAssembly(device, arena, pipeline, radixUnique) {
  const sortedIndicesBuffer = radixUnique.sortedIndicesBuffer;
  const cached = arena.assembleBindGroups.get(sortedIndicesBuffer);
  if (cached) {
    arena.bindGroupReuseCount += 1;
    return cached;
  }
  const bindGroup = device.createBindGroup({
    label: `${arena.label}-assemble-bind-group`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: arena.exactKeyBuffer } },
      { binding: 1, resource: { buffer: sortedIndicesBuffer } },
      {
        binding: 2,
        resource: { buffer: radixUnique.uniqueGroupIndexBySortedPositionBuffer }
      },
      { binding: 3, resource: { buffer: radixUnique.uniqueOffsetsBuffer } },
      { binding: 4, resource: { buffer: radixUnique.uniqueEvidenceBuffer } },
      { binding: 5, resource: { buffer: arena.evidenceBuffer } },
      { binding: 6, resource: { buffer: arena.directoryBuffer } },
      {
        binding: 8,
        resource: {
          buffer: arena.paramsBuffer,
          offset: 0,
          size: SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES
        }
      }
    ]
  });
  arena.assembleBindGroups.set(sortedIndicesBuffer, bindGroup);
  arena.bindGroupCreationCount += 1;
  return bindGroup;
}

function bindGroupForFinalize(device, arena, pipeline, radixUnique) {
  if (arena.finalizeBindGroup) {
    arena.bindGroupReuseCount += 1;
    return arena.finalizeBindGroup;
  }
  arena.finalizeBindGroup = device.createBindGroup({
    label: `${arena.label}-finalize-bind-group`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 4, resource: { buffer: radixUnique.uniqueEvidenceBuffer } },
      { binding: 5, resource: { buffer: arena.evidenceBuffer } },
      { binding: 6, resource: { buffer: arena.directoryBuffer } },
      { binding: 7, resource: { buffer: arena.consumerDispatchBuffer } },
      {
        binding: 8,
        resource: {
          buffer: arena.paramsBuffer,
          offset: 0,
          size: SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES
        }
      }
    ]
  });
  arena.bindGroupCreationCount += 1;
  return arena.finalizeBindGroup;
}

export function createSchroederSpatialEpochGpu(device, {
  maxSourceCount,
  cellCapacity = maxSourceCount,
  arenaCount = SCHROEDER_SPATIAL_EPOCH_ARENA_COUNT_DEFAULT,
  label = 'ulg-schroeder-spatial-epoch'
} = {}) {
  assertDevice(device);
  if (spatialEpochLostDevices.has(device)) {
    const error = new Error('cannot create a spatial epoch runtime on a lost device');
    error.code = 'ERR_SCHROEDER_SPATIAL_DEVICE_LOST';
    throw error;
  }
  const resolvedMaxSourceCount = positiveInteger(
    maxSourceCount,
    'maxSourceCount',
    MAX_EXACT_F32_INTEGER + 1
  );
  const resolvedCellCapacity = positiveInteger(
    cellCapacity,
    'cellCapacity',
    resolvedMaxSourceCount
  );
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const layout = createSchroederSpatialEpochLayout({
    sourceCapacity: resolvedMaxSourceCount,
    cellCapacity: resolvedCellCapacity
  });
  const maxBufferSize = positiveInteger(
    device.limits?.maxBufferSize ?? 256 * 1024 * 1024,
    'device.limits.maxBufferSize'
  );
  const maxStorageBufferBindingSize = positiveInteger(
    device.limits?.maxStorageBufferBindingSize ?? 128 * 1024 * 1024,
    'device.limits.maxStorageBufferBindingSize'
  );
  const maxUniformBufferBindingSize = positiveInteger(
    device.limits?.maxUniformBufferBindingSize ?? 64 * 1024,
    'device.limits.maxUniformBufferBindingSize'
  );
  const maxStorageBuffersPerShaderStage = positiveInteger(
    device.limits?.maxStorageBuffersPerShaderStage ?? 8,
    'device.limits.maxStorageBuffersPerShaderStage',
    0xffff
  );
  const maxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension',
    0xffff_ffff
  );
  if (maxUniformBufferBindingSize < SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES) {
    throw new RangeError('spatial epoch params exceed maxUniformBufferBindingSize');
  }
  if (maxStorageBuffersPerShaderStage < 8) {
    throw new RangeError('spatial epoch assembly requires eight storage bindings per stage');
  }
  dispatchShapeForInvocationCount(resolvedMaxSourceCount + 1, maxComputeWorkgroupsPerDimension);

  const activeNodeByteLength = checkedBytes(
    resolvedMaxSourceCount * ACTIVE_NODE_STRIDE_FLOATS,
    Float32Array.BYTES_PER_ELEMENT,
    'active-node source'
  );
  const keyByteLength = checkedBytes(
    resolvedMaxSourceCount * SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
    UINT32_BYTES,
    'spatial key'
  );
  for (const [role, byteLength] of [
    ['active-node source', activeNodeByteLength],
    ['spatial key', keyByteLength],
    ['spatial directory', layout.byteLength]
  ]) {
    if (byteLength > maxBufferSize) {
      throw new RangeError(`${role} requires ${byteLength} bytes beyond maxBufferSize`);
    }
    if (byteLength > maxStorageBufferBindingSize) {
      throw new RangeError(
        `${role} requires ${byteLength} bytes beyond maxStorageBufferBindingSize`
      );
    }
  }

  const keyModule = device.createShaderModule({
    label: `${label}-key-shader`,
    code: schroederSpatialEpochKeyWgsl
  });
  const assembleModule = device.createShaderModule({
    label: `${label}-assemble-shader`,
    code: schroederSpatialEpochAssembleWgsl
  });
  const keyPipeline = device.createComputePipeline({
    label: `${label}-key-pipeline`,
    layout: 'auto',
    compute: { module: keyModule, entryPoint: 'emit_spatial_keys' }
  });
  const assemblePipeline = device.createComputePipeline({
    label: `${label}-assemble-pipeline`,
    layout: 'auto',
    compute: { module: assembleModule, entryPoint: 'assemble_directory' }
  });
  const finalizePipeline = device.createComputePipeline({
    label: `${label}-finalize-pipeline`,
    layout: 'auto',
    compute: { module: assembleModule, entryPoint: 'finalize_directory' }
  });
  const deviceId = webGpuDeviceId(device);
  const defaultDeviceOrdinal = fnv1a32(deviceId);
  let destroyed = false;
  let executionSerial = 0;
  const liveExecutions = new WeakSet();
  const executionOwnership = new WeakMap();
  const executionRetirements = new WeakMap();
  const submittedExecutions = new WeakSet();
  const releasedExecutions = new WeakSet();
  const releaseInFlightExecutions = new WeakSet();
  let deviceLossObserved = false;
  let runtimeApi = null;

  const createOwnedBuffer = (bufferLabel, size, usage) => tagWebGpuBufferDevice(
    device.createBuffer({ label: bufferLabel, size, usage }),
    device
  );
  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => {
    const arenaLabel = `${label}-arena-${arenaIndex}`;
    return {
      arenaIndex,
      label: arenaLabel,
      inUse: false,
      retired: false,
      executionToken: null,
      destroyedOwnedBuffers: new Set(),
      radixDeviceLossRetired: false,
      paramsBuffer: createOwnedBuffer(
        `${arenaLabel}-params`,
        PARAMS_BUFFER_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      exactKeyBuffer: createOwnedBuffer(
        `${arenaLabel}-exact-keys`,
        keyByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
      ),
      sortKeyBuffer: createOwnedBuffer(
        `${arenaLabel}-sort-keys`,
        keyByteLength,
        GPU_BUFFER_USAGE.STORAGE
      ),
      evidenceBuffer: createOwnedBuffer(
        `${arenaLabel}-evidence`,
        SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      directoryBuffer: createOwnedBuffer(
        `${arenaLabel}-directory`,
        layout.byteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      consumerDispatchBuffer: createOwnedBuffer(
        `${arenaLabel}-consumer-dispatch`,
        3 * UINT32_BYTES,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
          | GPU_BUFFER_USAGE.INDIRECT
      ),
      radix: createWebGpuStableRadixScanUnique(device, {
        maxElementCount: resolvedMaxSourceCount,
        maxKeyWordCount: SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
        label: `${arenaLabel}-radix`,
        maxComputeWorkgroupsPerDimension,
        retainConstantScanParamsBuffers: true,
        retainVariableScanParamsBuffers: true,
        retainedParamsSlotCount: 1
      }),
      keyBindGroups: new WeakMap(),
      assembleBindGroups: new WeakMap(),
      finalizeBindGroup: null,
      bindGroupCreationCount: 0,
      bindGroupReuseCount: 0
    };
  });

  const allocationEntriesForArena = (arena) => [
    { role: 'spatial-params', arenaIndex: arena.arenaIndex, buffer: arena.paramsBuffer },
    { role: 'spatial-exact-keys', arenaIndex: arena.arenaIndex, buffer: arena.exactKeyBuffer },
    { role: 'spatial-sort-keys', arenaIndex: arena.arenaIndex, buffer: arena.sortKeyBuffer },
    { role: 'spatial-evidence', arenaIndex: arena.arenaIndex, buffer: arena.evidenceBuffer },
    { role: 'spatial-directory', arenaIndex: arena.arenaIndex, buffer: arena.directoryBuffer },
    {
      role: 'spatial-consumer-dispatch',
      arenaIndex: arena.arenaIndex,
      buffer: arena.consumerDispatchBuffer
    },
    ...arena.radix.allocationEntries().map((entry) => ({
      ...entry,
      role: `spatial-${entry.role}`,
      arenaIndex: arena.arenaIndex
    }))
  ];
  const retainedGpuBufferBytesPerArena = Object.freeze(arenas.map((arena) =>
    allocationEntriesForArena(arena).reduce((sum, entry) => {
      const byteLength = Number(entry.buffer?.size);
      if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
        throw new RangeError(`${entry.role} does not expose a safe GPUBuffer size`);
      }
      return sum + byteLength;
    }, 0)));
  const retainedGpuBufferBytes = retainedGpuBufferBytesPerArena.reduce(
    (sum, byteLength) => sum + byteLength,
    0
  );

  function destroyArenaOwnedBuffersAfterDeviceLoss(arena) {
    const failures = [];
    for (const { buffer } of allocationEntriesForArena(arena)) {
      if (!buffer || arena.destroyedOwnedBuffers.has(buffer)) continue;
      try {
        buffer.destroy?.();
        arena.destroyedOwnedBuffers.add(buffer);
      } catch (error) {
        if (buffer.destroyed === true) {
          arena.destroyedOwnedBuffers.add(buffer);
        } else {
          failures.push(error);
        }
      }
    }
    if (failures.length > 0) {
      throw failures.length === 1
        ? failures[0]
        : new AggregateError(
          failures,
          'spatial epoch device-loss arena retirement was incomplete'
        );
    }
    arena.radixDeviceLossRetired = true;
    return true;
  }

  function createExecutionRetirementRecord(execution, ownership) {
    let resolveCompletion;
    const completionPromise = new Promise((resolve) => {
      resolveCompletion = resolve;
    });
    const record = {
      execution,
      ownership,
      completed: false,
      completionPromise,
      resolveCompletion,
      activeAttempt: null,
      nextAttemptOrdinal: 0,
      deviceLossEvidence: null
    };
    executionRetirements.set(execution, record);
    return record;
  }

  function retirementRecordFor(execution) {
    const record = executionRetirements.get(execution);
    if (
      !record
      || execution?.ownerRuntime !== runtimeApi
      || execution.arenaIndex !== record.ownership.arenaIndex
      || execution.arenaGeneration !== record.ownership.executionToken.serial
    ) {
      const error = new Error('spatial epoch execution does not belong to this runtime');
      error.code = 'ERR_SCHROEDER_SPATIAL_FOREIGN_EXECUTION';
      throw error;
    }
    return record;
  }

  function acquireArena(requestedArenaIndex = null) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (deviceLossObserved) {
      const error = new Error(`${label} observed device loss`);
      error.code = 'ERR_SCHROEDER_SPATIAL_DEVICE_LOST';
      throw error;
    }
    let arena = null;
    if (requestedArenaIndex !== null && requestedArenaIndex !== undefined) {
      arena = arenas[nonNegativeInteger(
        requestedArenaIndex,
        'arenaIndex',
        resolvedArenaCount - 1
      )];
    } else {
      arena = arenas.find(
        (candidate) => !candidate.inUse && candidate.retired !== true
      ) || null;
    }
    if (!arena || arena.inUse || arena.retired === true) {
      const error = new Error(`${label} spatial arena is exhausted`);
      error.code = 'ERR_SCHROEDER_SPATIAL_ARENA_EXHAUSTED';
      error.arenaCapacity = resolvedArenaCount;
      error.requestedArenaIndex = requestedArenaIndex ?? null;
      throw error;
    }
    executionSerial += 1;
    arena.inUse = true;
    arena.executionToken = Object.freeze({ serial: executionSerial, arenaIndex: arena.arenaIndex });
    return arena;
  }

  function releaseArena(arena, executionToken) {
    if (!arena?.inUse || arena.executionToken !== executionToken) return false;
    arena.inUse = false;
    arena.executionToken = null;
    return true;
  }

  function encode(encoder, {
    sourceBuffer = null,
    activeNodeBuffer,
    sourceCount,
    sourceRowLayoutId = SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0,
    sortMode = 'bounded-atlas-u32',
    atlas = null,
    generationId = 1,
    deviceOrdinal = defaultDeviceOrdinal,
    laneOrdinal = 0,
    sourceFamily = 'schroeder-active-node-particles',
    sourceFamilyId = null,
    storageGeneration = 0,
    physicsTick = 0,
    physicsSubstep = 0,
    positionEpoch = 0,
    topologyEpoch = 0,
    chartEpoch = 0,
    levelEpoch = 0,
    supportEpoch = 0,
    leaseToken = 0,
    buildOrdinal = 1,
    sortUniqueOrdinal = 1,
    exactNearQueryProfile = null,
    laneId = 'default',
    arenaIndex = null,
    timestampProfiler = null,
    timestampMetadata = {},
    gpuTimestampRecorder = null,
    dispatchIndirectProvider = null
  } = {}) {
    assertEncoder(encoder);
    if (sourceBuffer && activeNodeBuffer && sourceBuffer !== activeNodeBuffer) {
      throw new TypeError('sourceBuffer and activeNodeBuffer must reference the same GPU buffer');
    }
    const resolvedSourceBuffer = sourceBuffer || activeNodeBuffer || null;
    if (!resolvedSourceBuffer) {
      throw new TypeError('spatial epoch encoding requires sourceBuffer');
    }
    if (!webGpuBufferMatchesDevice(resolvedSourceBuffer, device)) {
      const mismatch = webGpuDeviceMismatchInfo({ buffer: resolvedSourceBuffer, device });
      const error = new Error('sourceBuffer belongs to a different WebGPU device');
      error.code = 'ERR_SCHROEDER_SPATIAL_DEVICE_MISMATCH';
      Object.assign(error, mismatch);
      throw error;
    }
    const resolvedSourceCount = nonNegativeInteger(
      sourceCount,
      'sourceCount',
      resolvedMaxSourceCount
    );
    const requiredSourceBytes = resolvedSourceCount
      * ACTIVE_NODE_STRIDE_FLOATS
      * Float32Array.BYTES_PER_ELEMENT;
    if (
      Number.isFinite(Number(resolvedSourceBuffer.size))
      && Number(resolvedSourceBuffer.size) < requiredSourceBytes
    ) {
      throw new RangeError(
        `sourceBuffer has ${resolvedSourceBuffer.size} bytes; ${requiredSourceBytes} required`
      );
    }
    const sourceBindingSize = Math.min(
      Number.isFinite(Number(resolvedSourceBuffer.size))
        ? Number(resolvedSourceBuffer.size)
        : activeNodeByteLength,
      activeNodeByteLength
    );
    if (sourceBindingSize > maxStorageBufferBindingSize) {
      throw new RangeError(
        `spatial source binding requires ${sourceBindingSize} bytes beyond `
        + 'maxStorageBufferBindingSize'
      );
    }
    const resolvedSourceFamilyId = sourceFamilyId == null
      ? fnv1a32(sourceFamily)
      : sourceFamilyId;
    const plan = createSchroederSpatialEpochBuildPlan({
      sourceCount: resolvedSourceCount,
      sourceCapacity: resolvedMaxSourceCount,
      sourceRowLayoutId,
      cellCapacity: resolvedCellCapacity,
      sortMode,
      atlas,
      generationId,
      deviceOrdinal,
      laneOrdinal,
      sourceFamilyId: resolvedSourceFamilyId,
      storageGeneration,
      physicsTick,
      physicsSubstep,
      positionEpoch,
      topologyEpoch,
      chartEpoch,
      levelEpoch,
      supportEpoch,
      leaseToken,
      buildOrdinal,
      sortUniqueOrdinal,
      exactNearQueryProfile
    });
    const keyDispatch = dispatchShapeForInvocationCount(
      resolvedSourceCount,
      maxComputeWorkgroupsPerDimension
    );
    const assembleDispatch = dispatchShapeForInvocationCount(
      resolvedSourceCount + 1,
      maxComputeWorkgroupsPerDimension
    );
    const arena = acquireArena(arenaIndex);
    const executionToken = arena.executionToken;
    const bindGroupCreationCountBefore = arena.bindGroupCreationCount;
    const bindGroupReuseCountBefore = arena.bindGroupReuseCount;
    let radixUnique = null;
    try {
      device.queue.writeBuffer(arena.paramsBuffer, 0, paramsDataForPlan(plan, {
        keyDispatchX: Math.max(keyDispatch[0], 1),
        assembleDispatchX: Math.max(assembleDispatch[0], 1),
        consumerDispatchXLimit: maxComputeWorkgroupsPerDimension
      }));
      encoder.clearBuffer(arena.evidenceBuffer);
      encoder.clearBuffer(
        arena.directoryBuffer,
        0,
        SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS * UINT32_BYTES
      );
      encoder.clearBuffer(arena.consumerDispatchBuffer);

      const keyBindGroup = plan.sourceCount > 0
        ? bindGroupForKey(
            device,
            arena,
            keyPipeline,
            resolvedSourceBuffer,
            sourceBindingSize
          )
        : null;
      const metadata = {
        ...timestampMetadata,
        generationId: plan.generationId,
        sourceCount: plan.sourceCount,
        arenaIndex: arena.arenaIndex
      };
      const keyTimestampSpan = gpuTimestampRecorder?.active === true
        && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
        ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
            producerId: 'schroeder-spatial-key-emission',
            stage: 'key-emission',
            spanClass: 'same-production-command-encoder',
            ...metadata
          })
        : null;
      const keyDispatchCount = encodeComputeDispatch(
        encoder,
        keyPipeline,
        keyBindGroup,
        keyDispatch,
        `${label}KeyEmission`,
        timestampProfiler,
        metadata
      );
      if (keyTimestampSpan) {
        gpuTimestampRecorder.endEncoderSpan(encoder, keyTimestampSpan);
      }
      radixUnique = arena.radix.encodeSortUnique(encoder, {
        keyBuffer: arena.sortKeyBuffer,
        elementCount: plan.sourceCount,
        keyWordCount: plan.sortKeyWordCount,
        keyStrideWords: plan.sortKeyWordCount,
        generationId: plan.generationId,
        consumerWorkgroupSize: SCHROEDER_SPATIAL_EPOCH_WORKGROUP_SIZE,
        retainedParamsSlotIndex: 0,
        timestampProfiler,
        timestampMetadata: metadata,
        gpuTimestampRecorder,
        dispatchIndirectProvider
      });
      const assembleBindGroup = bindGroupForAssembly(
        device,
        arena,
        assemblePipeline,
        radixUnique
      );
      const finalizeBindGroup = bindGroupForFinalize(
        device,
        arena,
        finalizePipeline,
        radixUnique
      );
      const assembleDispatchCount = encodeComputeDispatch(
        encoder,
        assemblePipeline,
        assembleBindGroup,
        assembleDispatch,
        `${label}AssembleDirectory`,
        timestampProfiler,
        metadata
      );
      const finalizeDispatchCount = encodeComputeDispatch(
        encoder,
        finalizePipeline,
        finalizeBindGroup,
        [1, 1, 1],
        `${label}FinalizeDirectory`,
        timestampProfiler,
        metadata
      );
      const execution = {
        ...plan,
        schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
        magic: SCHROEDER_SPATIAL_EPOCH_MAGIC,
        abiVersion: SCHROEDER_SPATIAL_EPOCH_VERSION,
        status: 'schroeder-spatial-epoch-gpu-encoded',
        statusFlags: null,
        gpuCompletionProven: false,
        gpuAdmissionAuthority: 'directory-header-and-zeroed-indirect-dispatch',
        deviceId,
        laneId,
        sourceFamily,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: executionToken.serial,
        directoryBuffer: arena.directoryBuffer,
        consumerDispatchBuffer: arena.consumerDispatchBuffer,
        evidenceBuffer: arena.evidenceBuffer,
        evidenceBufferByteLength: SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES,
        mechanicsEvidenceOffsetBytes: 4 * UINT32_BYTES,
        mechanicsEvidenceByteLength:
          SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES - 4 * UINT32_BYTES,
        exactKeyBuffer: arena.exactKeyBuffer,
        sortKeyBuffer: arena.sortKeyBuffer,
        sortedIndicesBuffer: radixUnique.sortedIndicesBuffer,
        encodedDispatchCount: keyDispatchCount
          + radixUnique.encodedDispatchCount
          + assembleDispatchCount
          + finalizeDispatchCount,
        encodedComputePassCount: keyDispatchCount
          + radixUnique.encodedComputePassCount
          + assembleDispatchCount
          + finalizeDispatchCount,
        keyDispatchWorkgroups: Object.freeze([...keyDispatch]),
        assembleDispatchWorkgroups: Object.freeze([...assembleDispatch]),
        radixPassCount: radixUnique.radixPassCount,
        radixDigitPassCount: radixUnique.radixPassCount,
        paramsWriteCount: 1 + radixUnique.paramsWriteCount,
        spatialBindGroupCreationCount:
          arena.bindGroupCreationCount - bindGroupCreationCountBefore,
        spatialBindGroupReuseCount: arena.bindGroupReuseCount - bindGroupReuseCountBefore,
        clearedWordCount: SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS
          + SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_WORDS
          + 3
          + (radixUnique.clearedWordCount ?? 0),
        physicalDirectoryHighWaterWordsUpperBound: Math.max(
          plan.layout.cellOffsetsOffsetWords + 1,
          plan.layout.particleToCellOffsetWords + plan.sourceCount,
          plan.queryGeometryMode === SCHROEDER_SPATIAL_QUERY_GEOMETRY_SINGLE_CHART_POW2
            ? plan.queryEvidenceOffsetWords + SCHROEDER_SPATIAL_QUERY_EVIDENCE_WORDS
            : 0
        ),
        retainedGpuBufferBytes: retainedGpuBufferBytesPerArena[arena.arenaIndex],
        retainedGpuBufferBytesAllArenas: retainedGpuBufferBytes,
        timestampMode: timestampProfilingIsActive(timestampProfiler)
          ? 'instrumented-dispatch-granular-nonrepresentative'
          : 'disabled-grouped-production-pass-structure',
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        readbackPerformed: false,
        submitPerformed: false,
        submissionOwnership: 'caller',
        releaseRequirement: 'after-caller-submission-fence-or-discarded-encoder',
        released: false
      };
      Object.defineProperty(execution, 'sourceBuffer', {
        value: resolvedSourceBuffer,
        enumerable: true,
        writable: false,
        configurable: false
      });
      if (plan.sourceRowLayoutId === SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0) {
        Object.defineProperty(execution, 'activeNodeBuffer', {
          value: resolvedSourceBuffer,
          enumerable: true,
          writable: false,
          configurable: false
        });
      }
      Object.defineProperties(execution, {
        sourceAdapterId: {
          value: plan.sourceAdapterId,
          enumerable: true,
          writable: false,
          configurable: false
        },
        exactNearQueryProfile: {
          value: plan.exactNearQueryProfile,
          enumerable: true,
          writable: false,
          configurable: false
        },
        queryGeometryEvidence: {
          value: plan.queryGeometryEvidence,
          enumerable: true,
          writable: false,
          configurable: false
        }
      });
      Object.defineProperty(execution, 'ownerRuntime', {
        value: runtimeApi,
        enumerable: false,
        writable: false,
        configurable: false
      });
      Object.defineProperty(execution, 'released', {
        get() {
          return releasedExecutions.has(execution);
        },
        enumerable: true,
        configurable: false
      });
      const executionOwner = Object.freeze({
        arena,
        executionToken,
        arenaIndex: arena.arenaIndex,
        deviceId,
        directoryBuffer: arena.directoryBuffer,
        consumerDispatchBuffer: arena.consumerDispatchBuffer,
        evidenceBuffer: arena.evidenceBuffer,
        exactKeyBuffer: arena.exactKeyBuffer,
        sortKeyBuffer: arena.sortKeyBuffer,
        sortedIndicesBuffer: radixUnique.sortedIndicesBuffer,
        radixUnique,
        sourceBuffer: resolvedSourceBuffer,
        sourceAdapterId: plan.sourceAdapterId,
        exactNearQueryProfile: plan.exactNearQueryProfile,
        queryGeometryEvidence: plan.queryGeometryEvidence
      });
      executionOwnership.set(execution, executionOwner);
      createExecutionRetirementRecord(execution, executionOwner);
      liveExecutions.add(execution);
      return execution;
    } catch (error) {
      if (radixUnique) {
        arena.radix.releaseExecution(radixUnique, { discardedEncoder: true });
      }
      releaseArena(arena, executionToken);
      throw error;
    }
  }

  function publicExecutionMatchesOwnership(execution, ownership) {
    return execution?.ownerRuntime === runtimeApi
      && execution.deviceId === ownership.deviceId
      && execution.arenaIndex === ownership.arenaIndex
      && execution.directoryBuffer === ownership.directoryBuffer
      && execution.consumerDispatchBuffer === ownership.consumerDispatchBuffer
      && execution.evidenceBuffer === ownership.evidenceBuffer
      && execution.exactKeyBuffer === ownership.exactKeyBuffer
      && execution.sortKeyBuffer === ownership.sortKeyBuffer
      && execution.sortedIndicesBuffer === ownership.sortedIndicesBuffer
      && execution.sourceBuffer === ownership.sourceBuffer
      && execution.sourceAdapterId === ownership.sourceAdapterId
      && execution.exactNearQueryProfile === ownership.exactNearQueryProfile
      && execution.queryGeometryEvidence === ownership.queryGeometryEvidence;
  }

  function rawOwnedExecutionRecord(execution) {
    if (!execution || execution.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA) {
      throw new TypeError('releaseExecution requires a Schroeder spatial epoch execution');
    }
    if (releasedExecutions.has(execution)) return null;
    const ownership = executionOwnership.get(execution);
    if (
      !ownership
      || !liveExecutions.has(execution)
      || !publicExecutionMatchesOwnership(execution, ownership)
      || ownership.arena !== arenas[ownership.arenaIndex]
      || ownership.arena.inUse !== true
      || ownership.arena.executionToken !== ownership.executionToken
    ) {
      const error = new Error('spatial epoch execution does not belong to this runtime');
      error.code = 'ERR_SCHROEDER_SPATIAL_FOREIGN_EXECUTION';
      throw error;
    }
    return ownership;
  }

  function ownedExecutionRecord(execution) {
    const ownership = rawOwnedExecutionRecord(execution);
    if (ownership && releaseInFlightExecutions.has(execution)) {
      const error = new Error('spatial epoch execution does not belong to this runtime');
      error.code = 'ERR_SCHROEDER_SPATIAL_FOREIGN_EXECUTION';
      throw error;
    }
    return ownership;
  }

  function finalizeReleaseExecution(execution, ownership, {
    radixReleased = false,
    deviceLost = false,
    retirementRecord = retirementRecordFor(execution)
  } = {}) {
    if (retirementRecord.completed) return true;
    if (deviceLost) {
      destroyArenaOwnedBuffersAfterDeviceLoss(ownership.arena);
    } else if (!radixReleased) {
      ownership.arena.radix.releaseExecution(
        ownership.radixUnique,
        { discardedEncoder: true }
      );
    }
    const released = releaseArena(ownership.arena, ownership.executionToken);
    if (released) {
      ownership.arena.retired = deviceLost === true;
      releasedExecutions.add(execution);
      liveExecutions.delete(execution);
      submittedExecutions.delete(execution);
      executionOwnership.delete(execution);
      releaseInFlightExecutions.delete(execution);
      retirementRecord.activeAttempt = null;
      retirementRecord.completed = true;
      retirementRecord.resolveCompletion(true);
    }
    return released;
  }

  function ownsExecution(execution) {
    if (
      !liveExecutions.has(execution)
      || releasedExecutions.has(execution)
      || releaseInFlightExecutions.has(execution)
    ) return false;
    const ownership = executionOwnership.get(execution);
    return Boolean(
      ownership
      && execution?.schema === ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
      && publicExecutionMatchesOwnership(execution, ownership)
      && ownership.arena === arenas[ownership.arenaIndex]
      && ownership.arena.inUse === true
      && ownership.arena.executionToken === ownership.executionToken
      && webGpuBufferMatchesDevice(ownership.directoryBuffer, device)
      && webGpuBufferMatchesDevice(ownership.sourceBuffer, device)
    );
  }

  function markExecutionSubmitted(execution) {
    const ownership = ownedExecutionRecord(execution);
    if (!ownership) return false;
    if (submittedExecutions.has(execution)) return false;
    submittedExecutions.add(execution);
    Object.defineProperty(execution, 'submitPerformed', {
      value: true,
      enumerable: true,
      writable: false,
      configurable: false
    });
    Object.defineProperty(execution, 'status', {
      value: 'schroeder-spatial-epoch-gpu-build-submitted',
      enumerable: true,
      writable: false,
      configurable: false
    });
    return true;
  }

  function isExecutionSubmitted(execution) {
    return submittedExecutions.has(execution)
      && ownsExecution(execution)
      && execution.submitPerformed === true
      && execution.status === 'schroeder-spatial-epoch-gpu-build-submitted';
  }

  function releaseExecution(execution, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError(
        'releaseExecution is only for a discarded encoder; use releaseExecutionAfter '
        + 'with a submission-fence thenable after submission'
      );
    }
    const retirementRecord = retirementRecordFor(execution);
    if (retirementRecord.completed) return false;
    if (submittedExecutions.has(execution)) {
      const error = new Error(
        'submitted spatial epoch execution requires releaseExecutionAfter with a queue fence'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_SUBMITTED_EXECUTION_REQUIRES_FENCE';
      throw error;
    }
    const ownership = ownedExecutionRecord(execution);
    if (!ownership) return false;
    return finalizeReleaseExecution(execution, ownership, { retirementRecord });
  }

  function releaseExecutionAfter(execution, submissionFence) {
    try {
    if (!submissionFence || typeof submissionFence.then !== 'function') {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    const retirementRecord = retirementRecordFor(execution);
    if (retirementRecord.completed) {
      return retirementRecord.completionPromise;
    }
    if (deviceLossObserved) {
      return quarantineExecutionAfterDeviceLoss(execution);
    }
    if (retirementRecord.activeAttempt) {
      return retirementRecord.activeAttempt.promise;
    }
    const ownership = rawOwnedExecutionRecord(execution);
    if (!ownership) return false;
    if (!submittedExecutions.has(execution)) {
      const error = new Error(
        'unsubmitted spatial epoch execution requires discarded-encoder release'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_UNSUBMITTED_EXECUTION_REQUIRES_DISCARD';
      throw error;
    }
    const attempt = {
      mode: 'queue-fence',
      ordinal: ++retirementRecord.nextAttemptOrdinal,
      promise: null
    };
    retirementRecord.activeAttempt = attempt;
    releaseInFlightExecutions.add(execution);
    let radixRelease;
    try {
      radixRelease = ownership.arena.radix.releaseExecutionAfter(
        ownership.radixUnique,
        submissionFence
      );
    } catch (error) {
      retirementRecord.activeAttempt = null;
      releaseInFlightExecutions.delete(execution);
      throw error;
    }
    const releaseAttempt = Promise.race([
      Promise.resolve(radixRelease).then((released) => ({
        kind: 'radix-release',
        released
      })),
      retirementRecord.completionPromise.then(() => ({
        kind: 'terminal-completion',
        released: true
      }))
    ]).then(
      (result) => {
        if (result.kind === 'terminal-completion') return true;
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        if (result.released !== true) {
          throw new Error('spatial epoch radix owner did not confirm release');
        }
        return finalizeReleaseExecution(execution, ownership, {
          radixReleased: true,
          retirementRecord
        });
      },
      (error) => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        retirementRecord.activeAttempt = null;
        releaseInFlightExecutions.delete(execution);
        throw error;
      }
    );
    attempt.promise = releaseAttempt;
    releaseAttempt.catch(() => {});
    return releaseAttempt;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function quarantineExecutionAfterDeviceLoss(execution) {
    const retirementRecord = retirementRecordFor(execution);
    if (retirementRecord.completed) {
      return retirementRecord.completionPromise;
    }
    const ownership = rawOwnedExecutionRecord(execution);
    if (!ownership) return retirementRecord.completionPromise;
    if (retirementRecord.activeAttempt?.mode === 'device-loss') {
      return retirementRecord.activeAttempt.promise;
    }
    const exactLossEvidence = retirementRecord.deviceLossEvidence ?? device?.lost;
    if (!exactLossEvidence || typeof exactLossEvidence.then !== 'function') {
      const error = new TypeError(
        'spatial epoch device-loss quarantine requires the exact GPUDevice.lost promise'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_DEVICE_LOSS_EVIDENCE';
      throw error;
    }
    if (
      retirementRecord.deviceLossEvidence != null
      && retirementRecord.deviceLossEvidence !== exactLossEvidence
    ) {
      const error = new Error(
        'spatial epoch device-loss evidence changed for one execution'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_DEVICE_LOSS_EVIDENCE';
      throw error;
    }
    retirementRecord.deviceLossEvidence = exactLossEvidence;
    deviceLossObserved = true;
    if (retirementRecord.activeAttempt) {
      retirementRecord.activeAttempt.promise.catch(() => {});
    }
    const attempt = {
      mode: 'device-loss',
      ordinal: ++retirementRecord.nextAttemptOrdinal,
      promise: null
    };
    retirementRecord.activeAttempt = attempt;
    releaseInFlightExecutions.add(execution);
    runtimeApi.status = 'schroeder-spatial-epoch-gpu-runtime-device-loss-quarantined';
    const lossAttempt = Promise.resolve(exactLossEvidence).then(
      () => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        return finalizeReleaseExecution(execution, ownership, {
          deviceLost: true,
          retirementRecord
        });
      },
      (error) => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        retirementRecord.activeAttempt = null;
        releaseInFlightExecutions.delete(execution);
        throw error;
      }
    ).catch((error) => {
      if (retirementRecord.activeAttempt === attempt) {
        retirementRecord.activeAttempt = null;
        releaseInFlightExecutions.delete(execution);
      }
      throw error;
    });
    attempt.promise = lossAttempt;
    lossAttempt.catch(() => {});
    return lossAttempt;
  }

  function executionRetirementCompletionPromise(execution) {
    return retirementRecordFor(execution).completionPromise;
  }

  function allocationEntries() {
    return arenas.flatMap(allocationEntriesForArena);
  }

  function destroy() {
    if (destroyed) return false;
    const active = arenas.filter((arena) => arena.inUse).map((arena) => arena.arenaIndex);
    if (active.length > 0) {
      const error = new Error(`${label} has active spatial executions in arenas ${active.join(', ')}`);
      error.code = 'ERR_SCHROEDER_SPATIAL_ACTIVE_EXECUTIONS';
      error.arenaIndices = active;
      throw error;
    }
    destroyed = true;
    for (const arena of arenas) {
      for (const buffer of [
        arena.paramsBuffer,
        arena.exactKeyBuffer,
        arena.sortKeyBuffer,
        arena.evidenceBuffer,
        arena.directoryBuffer,
        arena.consumerDispatchBuffer
      ]) {
        if (arena.destroyedOwnedBuffers.has(buffer)) continue;
        buffer.destroy?.();
        arena.destroyedOwnedBuffers.add(buffer);
      }
      if (!arena.radixDeviceLossRetired) arena.radix.destroy();
      arena.keyBindGroups = new WeakMap();
      arena.assembleBindGroups = new WeakMap();
      arena.finalizeBindGroup = null;
    }
    return true;
  }

  runtimeApi = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
    status: 'schroeder-spatial-epoch-gpu-runtime-ready',
    deviceId,
    maxSourceCount: resolvedMaxSourceCount,
    cellCapacity: resolvedCellCapacity,
    arenaCount: resolvedArenaCount,
    layout,
    retainedGpuBufferBytesPerArena,
    retainedGpuBufferBytes,
    pipelineCount: 3 + arenas.reduce((sum, arena) => sum + arena.radix.pipelineCount, 0),
    submissionOwnership: 'caller',
    readbackPolicy: 'fixed-evidence-or-explicit-probe-only',
    encode,
    ownsExecution,
    markExecutionSubmitted,
    isExecutionSubmitted,
    releaseExecution,
    releaseExecutionAfter,
    quarantineExecutionAfterDeviceLoss,
    executionRetirementCompletionPromise,
    allocationEntries,
    destroy
  };
  return runtimeApi;
}

function directSpatialEpochRuntime(device, sourceCount) {
  const capacity = positivePowerOfTwoCapacity(sourceCount);
  let runtimes = directSpatialEpochRuntimeCache.get(device);
  if (!runtimes) {
    runtimes = new Map();
    directSpatialEpochRuntimeCache.set(device, runtimes);
  }
  let entry = runtimes.get(capacity);
  if (entry) return { entry, cacheHit: true };
  const runtime = createSchroederSpatialEpochGpu(device, {
    maxSourceCount: capacity,
    cellCapacity: capacity,
    arenaCount: DIRECT_SPATIAL_EPOCH_ARENA_COUNT,
    label: `ulg-schroeder-direct-spatial-epoch-${capacity}`
  });
  entry = {
    runtime,
    mechanicsViewRuntimes: new Map(),
    mechanicsFieldViewRuntimes: new Map(),
    mechanicsFieldViewDrainingRuntimes: new Set(),
    phaseVolumeMomentRuntimes: new Map(),
    hierarchyViewRuntimes: new Map(),
    parentFieldViewRuntimes: new Map(),
    aggregateViewRuntime: null,
    capacity,
    generation: 0,
    buildCount: 0,
    liveGenerations: []
  };
  runtimes.set(capacity, entry);
  return { entry, cacheHit: false };
}

function mechanicsFieldViewCacheBackpressure(message) {
  const error = new Error(message);
  error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_CACHE_BACKPRESSURE';
  return error;
}

function directMechanicsFieldViewActiveExecutions(entry, runtime) {
  const executions = [];
  const seen = new Set();
  for (const generation of entry.liveGenerations) {
    for (const levelView of generationMechanicsLevelViews(generation)) {
      if (levelView.mechanicsFieldViewRuntime !== runtime) continue;
      const execution = levelView.mechanicsFieldView;
      if (!execution || execution.released === true) continue;
      let owned = false;
      try {
        owned = runtime.ownsExecution(execution) === true;
      } catch {
        owned = false;
      }
      if (!owned || seen.has(execution)) {
        throw mechanicsFieldViewCacheBackpressure(
          'mechanics field cache rollover could not prove every exact live owner'
        );
      }
      seen.add(execution);
      executions.push(execution);
    }
  }
  return executions;
}

function finalizeDirectMechanicsFieldViewDrain(entry, record) {
  if (record.destroyed) return true;
  if (record.retirementConfirmed !== true) return false;
  if (record.runtime.activeExecutionCount() !== 0) {
    record.failureReason =
      'mechanics field drain retained an active execution after exact retirement';
    return false;
  }
  try {
    if (record.runtime.destroy() !== true) {
      throw new Error('mechanics field draining runtime destruction was replayed');
    }
    record.destroyed = true;
    entry.mechanicsFieldViewDrainingRuntimes.delete(record);
    return true;
  } catch (error) {
    record.failureReason = error instanceof Error ? error.message : String(error);
    return false;
  }
}

function reapDirectMechanicsFieldViewDrainingRuntimes(entry) {
  if (!entry?.mechanicsFieldViewDrainingRuntimes) return;
  for (const record of entry.mechanicsFieldViewDrainingRuntimes) {
    finalizeDirectMechanicsFieldViewDrain(entry, record);
  }
}

function prepareDirectMechanicsFieldViewDrain(entry, key, runtime) {
  const executions = directMechanicsFieldViewActiveExecutions(entry, runtime);
  const activeExecutionCount = runtime.activeExecutionCount();
  if (executions.length !== activeExecutionCount) {
    throw mechanicsFieldViewCacheBackpressure(
      'mechanics field cache rollover active-owner accounting was incomplete'
    );
  }
  if (
    executions.length > 0
    && entry.mechanicsFieldViewDrainingRuntimes.size
      >= DIRECT_MECHANICS_FIELD_VIEW_DRAINING_RUNTIME_LIMIT
  ) {
    throw mechanicsFieldViewCacheBackpressure(
      'mechanics field cache draining-runtime bound is exhausted'
    );
  }
  const retirementPromises = executions.map((execution) => {
    const completion = runtime.executionRetirementCompletionPromise(execution);
    if (!completion || typeof completion.then !== 'function') {
      throw mechanicsFieldViewCacheBackpressure(
        'mechanics field cache rollover lost an exact retirement completion'
      );
    }
    return completion;
  });
  return { key, runtime, executions, retirementPromises };
}

function beginDirectMechanicsFieldViewDrain(entry, prepared) {
  const {
    key,
    runtime,
    executions,
    retirementPromises
  } = prepared;
  if (executions.length === 0) {
    if (runtime.destroy() !== true) {
      throw mechanicsFieldViewCacheBackpressure(
        'idle depleted mechanics field runtime destruction was not confirmed'
      );
    }
    return null;
  }
  const record = {
    key,
    runtime,
    executions: Object.freeze([...executions]),
    retirementConfirmed: false,
    destroyed: false,
    completionPromise: null,
    failureReason: null
  };
  entry.mechanicsFieldViewDrainingRuntimes.add(record);
  const completionPromise = Promise.all(retirementPromises).then((confirmed) => {
    if (confirmed.some((retired) => retired !== true)) {
      throw new Error(
        'mechanics field draining runtime retirement was not confirmed'
      );
    }
    record.retirementConfirmed = true;
    if (!finalizeDirectMechanicsFieldViewDrain(entry, record)) {
      throw new Error(
        record.failureReason
        ?? 'mechanics field draining runtime remained live after retirement'
      );
    }
    return true;
  }).catch((error) => {
    record.failureReason = error instanceof Error ? error.message : String(error);
    throw error;
  });
  record.completionPromise = completionPromise;
  completionPromise.catch(() => {});
  return record;
}

function createDirectMechanicsFieldViewRuntime(
  device,
  entry,
  mechanicsGrid,
  identityStrideWords,
  dims
) {
  return createSchroederSpatialMechanicsFieldViewGpu(device, {
    maxSourceCount: entry.capacity,
    gridNodeCount: mechanicsGrid.gridNodeCount,
    gridDims: dims,
    gridShift: mechanicsGrid.gridShift,
    gridSpacingM: mechanicsGrid.gridSpacingM,
    identityStrideWords,
    arenaCount: DIRECT_SPATIAL_EPOCH_ARENA_COUNT,
    label: `ulg-schroeder-direct-mechanics-field-view-${entry.capacity}-${dims.join('x')}`
  });
}

function directMechanicsFieldViewRuntime(device, entry, mechanicsGrid, identityStrideWords) {
  if (!mechanicsGrid) return null;
  reapDirectMechanicsFieldViewDrainingRuntimes(entry);
  const dims = Array.from(mechanicsGrid.gridDims || []);
  const key = [
    mechanicsGrid.gridNodeCount,
    dims[0],
    dims[1],
    dims[2],
    mechanicsGrid.gridShift,
    Math.fround(mechanicsGrid.gridSpacingM),
    identityStrideWords
  ].join(':');
  let runtime = entry.mechanicsFieldViewRuntimes.get(key);
  if (runtime) {
    const availableArenaCount = runtime.availableArenaCount();
    const irreversiblyDepleted = availableArenaCount === 0
      && (
        runtime.retiredArenaCount() > 0
        || runtime.quarantinedArenaCount() > 0
      );
    if (irreversiblyDepleted) {
      if (
        runtime.status !== DIRECT_MECHANICS_FIELD_VIEW_RUNTIME_READY
        || deviceLossTerminalizedSpatialRuntimes.has(runtime)
        || spatialEpochLostDevices.has(device)
      ) {
        throw mechanicsFieldViewCacheBackpressure(
          'device-loss mechanics field runtime cannot be cache-rotated'
        );
      }
      const prepared = prepareDirectMechanicsFieldViewDrain(entry, key, runtime);
      const replacement = createDirectMechanicsFieldViewRuntime(
        device,
        entry,
        mechanicsGrid,
        identityStrideWords,
        dims
      );
      try {
        beginDirectMechanicsFieldViewDrain(entry, prepared);
      } catch (error) {
        replacement.destroy();
        throw error;
      }
      entry.mechanicsFieldViewRuntimes.delete(key);
      entry.mechanicsFieldViewRuntimes.set(key, replacement);
      return replacement;
    }
    entry.mechanicsFieldViewRuntimes.delete(key);
    entry.mechanicsFieldViewRuntimes.set(key, runtime);
  }
  if (!runtime) {
    if (
      entry.mechanicsFieldViewRuntimes.size
        >= DIRECT_MECHANICS_VIEW_RUNTIME_CACHE_LIMIT
    ) {
      const retired = [...entry.mechanicsFieldViewRuntimes.entries()].find(
        ([, candidate]) => candidate.activeExecutionCount?.() === 0
      );
      if (!retired) {
        const error = new Error(
          'mechanics field view runtime cache is under live-generation backpressure'
        );
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_CACHE_BACKPRESSURE';
        throw error;
      }
      const [retiredKey, retiredRuntime] = retired;
      entry.mechanicsFieldViewRuntimes.delete(retiredKey);
      retiredRuntime.destroy();
    }
    runtime = createDirectMechanicsFieldViewRuntime(
      device,
      entry,
      mechanicsGrid,
      identityStrideWords,
      dims
    );
    entry.mechanicsFieldViewRuntimes.set(key, runtime);
  }
  return runtime;
}

function directPhaseVolumeMomentRuntime(device, entry, mechanicsFieldView) {
  if (!mechanicsFieldView) return null;
  const arenaCount = entry.directArenaCount ?? DIRECT_SPATIAL_EPOCH_ARENA_COUNT;
  const runtimeCacheLimit = 4;
  const key = [
    mechanicsFieldView.sourceCapacity,
    mechanicsFieldView.fieldCapacity
  ].join(':');
  let runtime = entry.phaseVolumeMomentRuntimes.get(key);
  if (runtime) {
    entry.phaseVolumeMomentRuntimes.delete(key);
    entry.phaseVolumeMomentRuntimes.set(key, runtime);
    return runtime;
  }
  if (
    entry.phaseVolumeMomentRuntimes.size
      >= runtimeCacheLimit
  ) {
    const retired = [...entry.phaseVolumeMomentRuntimes.entries()].find(
      ([, candidate]) => candidate.activeExecutionCount?.() === 0
    );
    if (!retired) {
      const error = new Error(
        'phase-volume moment runtime cache is under live-generation backpressure'
      );
      error.code = 'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_CACHE_BACKPRESSURE';
      throw error;
    }
    const [retiredKey, retiredRuntime] = retired;
    entry.phaseVolumeMomentRuntimes.delete(retiredKey);
    if (retiredRuntime.destroy() !== true) {
      const error = new Error(
        'idle phase-volume moment runtime destruction was not confirmed'
      );
      error.code = 'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_CACHE_BACKPRESSURE';
      throw error;
    }
  }
  runtime = createSchroederSpatialPhaseVolumeMomentGpu(device, {
    maxSourceCount: mechanicsFieldView.sourceCapacity,
    fieldCapacity: mechanicsFieldView.fieldCapacity,
    arenaCount,
    label: `ulg-schroeder-direct-phase-volume-moment-${mechanicsFieldView.sourceCapacity}-${mechanicsFieldView.fieldCapacity}-arenas-${arenaCount}`
  });
  entry.phaseVolumeMomentRuntimes.set(key, runtime);
  return runtime;
}

function directMechanicsViewRuntime(device, entry, mechanicsGrid) {
  if (!mechanicsGrid) return null;
  const dims = Array.from(mechanicsGrid.gridDims || []);
  const key = [
    mechanicsGrid.gridNodeCount,
    dims[0],
    dims[1],
    dims[2],
    mechanicsGrid.gridShift,
    Math.fround(mechanicsGrid.gridSpacingM)
  ].join(':');
  let runtime = entry.mechanicsViewRuntimes.get(key);
  if (runtime) {
    entry.mechanicsViewRuntimes.delete(key);
    entry.mechanicsViewRuntimes.set(key, runtime);
  }
  if (!runtime) {
    if (
      entry.mechanicsViewRuntimes.size
        >= DIRECT_MECHANICS_VIEW_RUNTIME_CACHE_LIMIT
    ) {
      const retired = [...entry.mechanicsViewRuntimes.entries()].find(
        ([, candidate]) => candidate.activeExecutionCount?.() === 0
      );
      if (!retired) {
        const error = new Error(
          'compact mechanics view runtime cache is under live-generation backpressure'
        );
        error.code = 'ERR_SCHROEDER_MECHANICS_VIEW_CACHE_BACKPRESSURE';
        throw error;
      }
      const [retiredKey, retiredRuntime] = retired;
      entry.mechanicsViewRuntimes.delete(retiredKey);
      retiredRuntime.destroy();
    }
    runtime = createSchroederSpatialMechanicsViewGpu(device, {
      maxSourceCount: entry.capacity,
      gridNodeCount: mechanicsGrid.gridNodeCount,
      gridDims: dims,
      gridShift: mechanicsGrid.gridShift,
      gridSpacingM: mechanicsGrid.gridSpacingM,
      arenaCount: DIRECT_SPATIAL_EPOCH_ARENA_COUNT,
      label: `ulg-schroeder-direct-mechanics-view-${entry.capacity}-${dims.join('x')}`
    });
    entry.mechanicsViewRuntimes.set(key, runtime);
  }
  return runtime;
}

function directHierarchyViewRuntime(device, entry, fineGrid, coarseGrid) {
  if (!fineGrid || !coarseGrid) return null;
  const fineDims = Array.from(fineGrid.gridDims || []);
  const coarseDims = Array.from(coarseGrid.gridDims || []);
  const key = [
    fineGrid.gridNodeCount,
    ...fineDims,
    fineGrid.gridShift,
    Math.fround(fineGrid.gridSpacingM),
    coarseGrid.gridNodeCount,
    ...coarseDims,
    coarseGrid.gridShift,
    Math.fround(coarseGrid.gridSpacingM)
  ].join(':');
  let runtime = entry.hierarchyViewRuntimes.get(key);
  if (runtime) {
    entry.hierarchyViewRuntimes.delete(key);
    entry.hierarchyViewRuntimes.set(key, runtime);
  }
  if (!runtime) {
    if (entry.hierarchyViewRuntimes.size >= DIRECT_MECHANICS_VIEW_RUNTIME_CACHE_LIMIT) {
      const retired = [...entry.hierarchyViewRuntimes.entries()].find(
        ([, candidate]) => candidate.activeExecutionCount?.() === 0
      );
      if (!retired) {
        const error = new Error(
          'spatial hierarchy view runtime cache is under live-generation backpressure'
        );
        error.code = 'ERR_SCHROEDER_HIERARCHY_VIEW_CACHE_BACKPRESSURE';
        throw error;
      }
      const [retiredKey, retiredRuntime] = retired;
      entry.hierarchyViewRuntimes.delete(retiredKey);
      retiredRuntime.destroy();
    }
    runtime = createSchroederSpatialHierarchyViewGpu(device, {
      fineGrid,
      coarseGrid,
      arenaCount: DIRECT_SPATIAL_EPOCH_ARENA_COUNT,
      label: `ulg-schroeder-direct-hierarchy-view-${entry.capacity}-${fineDims.join('x')}-${coarseDims.join('x')}`
    });
    entry.hierarchyViewRuntimes.set(key, runtime);
  }
  return runtime;
}

function directParentFieldViewRuntime(
  device,
  entry,
  fineGrid,
  coarseGrid,
  fineFieldCapacity,
  coarseFieldCapacity
) {
  if (!fineGrid || !coarseGrid) return null;
  const fineDims = Array.from(fineGrid.gridDims || []);
  const coarseDims = Array.from(coarseGrid.gridDims || []);
  const key = [
    fineGrid.gridNodeCount,
    ...fineDims,
    fineGrid.gridShift,
    Math.fround(fineGrid.gridSpacingM),
    fineFieldCapacity,
    coarseGrid.gridNodeCount,
    ...coarseDims,
    coarseGrid.gridShift,
    Math.fround(coarseGrid.gridSpacingM),
    coarseFieldCapacity
  ].join(':');
  let runtime = entry.parentFieldViewRuntimes.get(key);
  if (runtime) {
    entry.parentFieldViewRuntimes.delete(key);
    entry.parentFieldViewRuntimes.set(key, runtime);
  }
  if (!runtime) {
    if (
      entry.parentFieldViewRuntimes.size
        >= DIRECT_MECHANICS_VIEW_RUNTIME_CACHE_LIMIT
    ) {
      const retired = [...entry.parentFieldViewRuntimes.entries()].find(
        ([, candidate]) => candidate.activeExecutionCount?.() === 0
      );
      if (!retired) {
        const error = new Error(
          'spatial parent-field view runtime cache is under live-generation backpressure'
        );
        error.code = 'ERR_SCHROEDER_PARENT_FIELD_VIEW_CACHE_BACKPRESSURE';
        throw error;
      }
      const [retiredKey, retiredRuntime] = retired;
      entry.parentFieldViewRuntimes.delete(retiredKey);
      retiredRuntime.destroy();
    }
    runtime = createSchroederSpatialParentFieldViewGpu(device, {
      fineGrid,
      coarseGrid,
      fineFieldCapacity,
      coarseFieldCapacity,
      arenaCount: DIRECT_SPATIAL_EPOCH_ARENA_COUNT,
      label: `ulg-schroeder-direct-parent-field-view-${entry.capacity}-${fineDims.join('x')}-${coarseDims.join('x')}`
    });
    entry.parentFieldViewRuntimes.set(key, runtime);
  }
  return runtime;
}

function directAggregateViewRuntime(device, entry) {
  if (!entry.aggregateViewRuntime) {
    entry.aggregateViewRuntime = createSchroederSpatialAggregateViewGpu(device, {
      maxSourceCount: entry.capacity,
      cellCapacity: entry.capacity,
      arenaCount: DIRECT_SPATIAL_EPOCH_ARENA_COUNT,
      label: `ulg-schroeder-direct-aggregate-view-${entry.capacity}`
    });
  }
  return entry.aggregateViewRuntime;
}

function normalizeMechanicsLevelSpecs({
  mechanicsGrid = null,
  selectedLevel = 0,
  mechanicsLevels = null
} = {}) {
  const requested = Array.isArray(mechanicsLevels)
    ? mechanicsLevels
    : (mechanicsGrid ? [{ mechanicsGrid, selectedLevel }] : []);
  if (requested.length > 2) {
    throw new RangeError(
      'direct spatial generation supports at most two adjacent mechanics levels'
    );
  }
  const normalized = requested.map((entry, index) => {
    const grid = entry?.mechanicsGrid || entry?.grid || null;
    if (!grid) {
      throw new TypeError(`mechanicsLevels[${index}] requires a mechanicsGrid`);
    }
    const level = Number(entry?.selectedLevel ?? entry?.level);
    if (!Number.isInteger(level) || level < -0x8000_0000 || level > 0x7fff_ffff) {
      throw new RangeError(`mechanicsLevels[${index}].selectedLevel must be an i32`);
    }
    return Object.freeze({ selectedLevel: level, mechanicsGrid: grid });
  }).sort((left, right) => left.selectedLevel - right.selectedLevel);
  if (
    normalized.length === 2
    && (
      normalized[1].selectedLevel !== normalized[0].selectedLevel + 1
      || Math.fround(Number(normalized[1].mechanicsGrid?.gridSpacingM))
        !== Math.fround(Number(normalized[0].mechanicsGrid?.gridSpacingM) * 2)
    )
  ) {
    throw new RangeError(
      'two-level mechanics views require adjacent levels with an exact 2:1 f32 spacing ratio'
    );
  }
  return Object.freeze(normalized);
}

function generationMechanicsLevelViews(generation) {
  if (Array.isArray(generation?.mechanicsLevelViews)) {
    return generation.mechanicsLevelViews;
  }
  if (
    !generation?.mechanicsView
    && !generation?.mechanicsFieldView
    && !generation?.phaseVolumeMoment
  ) return [];
  return [{
    selectedLevel: generation?.mechanicsView?.selectedLevel
      ?? generation?.mechanicsFieldView?.selectedLevel
      ?? generation?.phaseVolumeMoment?.selectedLevel
      ?? null,
    mechanicsView: generation.mechanicsView || null,
    mechanicsViewRuntime: generation.mechanicsViewRuntime || null,
    mechanicsFieldView: generation.mechanicsFieldView || null,
    mechanicsFieldViewRuntime: generation.mechanicsFieldViewRuntime || null,
    phaseVolumeMoment: generation.phaseVolumeMoment || null,
    phaseVolumeMomentRuntime: generation.phaseVolumeMomentRuntime || null
  }];
}

/**
 * Build one retained, same-device directory generation for a direct SS step.
 * Submission happens here so every later queue submission observes the
 * completed directory in WebGPU queue order.  The caller must schedule release
 * only after the final consumer has submitted.
 */
export function runSchroederSpatialEpochGenerationWebGpu({
  device,
  levelAssignment = null,
  activeNodeList,
  particleCount = null,
  particleIdentityBuffer = null,
  particleIdentityStrideWords = 1,
  particleBufferSet = null,
  laneId = 'direct-schroeder-scene',
  sourceFamily = null,
  allowPhaseVolumeOverlay = false,
  mechanicsGrid = null,
  selectedLevel = 0,
  mechanicsLevels = null,
  mechanicsFieldForceRadixFallback = false,
  gpuTimestampRecorder = null
} = {}) {
  if (!device?.createCommandEncoder || !device?.queue?.submit) {
    throw new TypeError(
      'runSchroederSpatialEpochGenerationWebGpu requires a WebGPU-like device and queue'
    );
  }
  if (spatialEpochLostDevices.has(device)) {
    const error = new Error('cannot build a spatial generation on a lost device');
    error.code = 'ERR_SCHROEDER_SPATIAL_DEVICE_LOST';
    throw error;
  }
  let source = levelAssignment
    ? resolveSchroederSpatialDirectoryLevelAssignmentSource(levelAssignment, {
        device,
        particleCount
      })
    : resolveSchroederSpatialDirectoryActiveNodeSource(activeNodeList, {
        device,
        particleCount
      });
  // The generic directory format can represent an overlay because every row
  // carries native spacing. The first mounted mechanics view cannot consume
  // one yet: P2G would use overlay levels while G2P still uses the base level
  // assignment. Reject that split authority before spending a GPU build.
  if (
    source.ready === true
    && source.phaseVolumeAssignmentOverlayEnabled === true
    && allowPhaseVolumeOverlay !== true
  ) {
    source = unavailableSpatialDirectorySource(
      levelAssignment || activeNodeList,
      device,
      'schroeder-spatial-directory-source-rejected-overlay-for-mechanics',
      'P2G/G2P do not yet share phase-volume overlay authority',
      {
        phaseVolumeAssignmentOverlayEnabled: true,
        sourceCount: source.sourceCount,
        sourceDeviceId: source.sourceDeviceId,
        consumerDeviceId: source.consumerDeviceId
      }
    );
  }
  if (source.ready !== true) {
    return {
      schema: ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA,
      status: source.status,
      reason: source.reason,
      ready: false,
      selected: false,
      source,
      directoryBuildCount: 0,
      privateLookupBuildCount: 0,
      releaseScheduled: false
    };
  }
  let mechanicsLevelSpecs;
  try {
    mechanicsLevelSpecs = normalizeMechanicsLevelSpecs({
      mechanicsGrid,
      selectedLevel,
      mechanicsLevels
    });
  } catch (error) {
    return {
      schema: ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA,
      status: 'schroeder-spatial-mechanics-view-rejected-level-contract',
      reason: error instanceof Error ? error.message : String(error),
      ready: false,
      selected: false,
      source,
      directoryBuildCount: 0,
      privateLookupBuildCount: 0,
      releaseScheduled: false
    };
  }
  if (mechanicsLevelSpecs.length > 0 && source.exactNearQueryProfile?.ready !== true) {
    return {
      schema: ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA,
      status: 'schroeder-spatial-mechanics-view-rejected-query-profile',
      reason: 'compact mechanics requires an admitted exact-near query profile',
      ready: false,
      selected: false,
      source,
      directoryBuildCount: 0,
      privateLookupBuildCount: 0,
      releaseScheduled: false
    };
  }
  if (
    mechanicsLevelSpecs.length > 0
    && (
      !source.sourceStateBuffer
      || source.sourceStateBufferBorrowed !== true
    )
  ) {
    return {
      schema: ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA,
      status: 'schroeder-spatial-mechanics-view-rejected-state-provenance',
      reason: 'compact mechanics requires the exact borrowed retained source-state buffer used by level assignment',
      ready: false,
      selected: false,
      source,
      directoryBuildCount: 0,
      privateLookupBuildCount: 0,
      releaseScheduled: false
    };
  }
  const phaseVolumeMomentSourceAdmitted = Boolean(
    source.sourceRowLayoutId
      === SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
    && source.sourceMechanicsBuffer
    && source.sourceMechanicsBufferBorrowed === true
    && source.sourceMechanicsProvenanceStatus
      === 'schroeder-spatial-directory-source-mechanics-v0j-ready'
    && webGpuBufferMatchesDevice(source.sourceMechanicsBuffer, device)
  );
  let cache = null;
  let execution = null;
  let mechanicsViewExecution = null;
  let mechanicsViewRuntime = null;
  let mechanicsFieldViewExecution = null;
  let mechanicsFieldViewRuntime = null;
  let phaseVolumeMomentExecution = null;
  let phaseVolumeMomentRuntime = null;
  let mechanicsLevelViews = [];
  let hierarchyViewExecution = null;
  let hierarchyViewRuntime = null;
  let parentFieldViewExecution = null;
  let parentFieldViewRuntime = null;
  let aggregateViewExecution = null;
  let aggregateViewRuntime = null;
  let submissionPerformed = false;
  let generationEncoder = null;
  let generationId = 0;
  let postSubmitCleanupGeneration = null;
  let postSubmitCleanupError = null;
  const markSubmittedOrConfirm = (ownerRuntime, ownedExecution) => {
    if (!ownedExecution) return true;
    try {
      if (ownerRuntime?.isExecutionSubmitted?.(ownedExecution) === true) {
        return true;
      }
      const marked = ownerRuntime?.markExecutionSubmitted?.(ownedExecution);
      return marked === true
        || ownerRuntime?.isExecutionSubmitted?.(ownedExecution) === true;
    } catch {
      return false;
    }
  };
  try {
    cache = directSpatialEpochRuntime(device, source.sourceCount);
    const { entry, cacheHit } = cache;
    const resolvedSourceFamily = sourceFamily || (
      source.sourceRowLayoutId === SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
        ? 'schroeder-level-assignment-particles'
        : 'schroeder-active-node-particles'
    );
    generationId = (entry.generation % 0xffff_fffe) + 1;
    generationEncoder = device.createCommandEncoder({
      label: 'ulg-schroeder-direct-spatial-epoch-build'
    });
    const encoder = generationEncoder;
    execution = entry.runtime.encode(encoder, {
      sourceBuffer: source.sourceBuffer || source.activeNodeBuffer,
      sourceCount: source.sourceCount,
      sourceRowLayoutId: source.sourceRowLayoutId,
      sortMode: 'lexicographic-u32x5',
      generationId,
      leaseToken: generationId,
      sourceFamily: resolvedSourceFamily,
      storageGeneration: source.storageGeneration,
      physicsTick: source.physicsTick,
      physicsSubstep: source.physicsSubstep,
      positionEpoch: source.positionEpoch,
      topologyEpoch: source.topologyEpoch,
      chartEpoch: source.chartEpoch,
      levelEpoch: source.levelEpoch,
      supportEpoch: source.supportEpoch,
      buildOrdinal: generationId,
      sortUniqueOrdinal: generationId,
      exactNearQueryProfile: source.exactNearQueryProfile?.ready === true
        ? source.exactNearQueryProfile
        : null,
      laneId,
      gpuTimestampRecorder
    });
    const viewBuildTimestampSpan = gpuTimestampRecorder?.active === true
      && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
      ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
          producerId: 'schroeder-spatial-derived-view-build',
          stage: 'view-build',
          spanClass: 'same-production-command-encoder',
          generationId,
          laneId,
          sourceFamily: resolvedSourceFamily,
          physicsTick: source.physicsTick,
          physicsSubstep: source.physicsSubstep
        })
      : null;
    for (const levelSpec of mechanicsLevelSpecs) {
      const levelMechanicsViewRuntime = directMechanicsViewRuntime(
        device,
        entry,
        levelSpec.mechanicsGrid
      );
      const mechanicsViewTimestampSpan = gpuTimestampRecorder?.active === true
        && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
        ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
            producerId: 'schroeder-spatial-mechanics-view-build',
            stage: 'mechanics-view-build',
            spanClass: 'same-production-command-encoder',
            generationId,
            laneId,
            selectedLevel: levelSpec.selectedLevel,
            sourceFamily: resolvedSourceFamily,
            physicsTick: source.physicsTick,
            physicsSubstep: source.physicsSubstep
          })
        : null;
      const levelMechanicsViewExecution = levelMechanicsViewRuntime?.encode(encoder, {
        sourceBuffer: source.sourceBuffer || source.activeNodeBuffer,
        sourceCount: source.sourceCount,
        sourceRowLayoutId: source.sourceRowLayoutId,
        selectedLevel: levelSpec.selectedLevel,
        spatialExecution: execution
      });
      if (mechanicsViewTimestampSpan) {
        gpuTimestampRecorder.endEncoderSpan(
          encoder,
          mechanicsViewTimestampSpan
        );
      }
      // Record the compact execution before acquiring the paired field arena.
      // Field acquisition can fail under authentic backpressure; cleanup must
      // still own and discard the already-acquired compact execution.
      const levelView = {
        selectedLevel: levelSpec.selectedLevel,
        mechanicsGrid: levelSpec.mechanicsGrid,
        mechanicsView: levelMechanicsViewExecution,
        mechanicsViewRuntime: levelMechanicsViewRuntime,
        mechanicsFieldView: null,
        mechanicsFieldViewRuntime: null,
        phaseVolumeMoment: null,
        phaseVolumeMomentRuntime: null
      };
      mechanicsLevelViews.push(levelView);
      if (particleIdentityBuffer) {
        if (!webGpuBufferMatchesDevice(particleIdentityBuffer, device)) {
          throw new TypeError(
            'mechanics field identity buffer must belong to the generation device'
          );
        }
        levelView.mechanicsFieldViewRuntime = directMechanicsFieldViewRuntime(
          device,
          entry,
          levelSpec.mechanicsGrid,
          positiveInteger(particleIdentityStrideWords, 'particleIdentityStrideWords', 16)
        );
        const mechanicsFieldTimestampSpan = gpuTimestampRecorder?.active === true
          && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
          ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
              producerId: 'schroeder-spatial-mechanics-field-view-build',
              stage: 'mechanics-field-view-build',
              spanClass: 'same-production-command-encoder',
              generationId,
              laneId,
              selectedLevel: levelSpec.selectedLevel,
              sourceFamily: resolvedSourceFamily,
              physicsTick: source.physicsTick,
              physicsSubstep: source.physicsSubstep
            })
          : null;
        levelView.mechanicsFieldView = levelView.mechanicsFieldViewRuntime.encode(encoder, {
          sourceBuffer: source.sourceBuffer || source.activeNodeBuffer,
          identityBuffer: particleIdentityBuffer,
          sourceCount: source.sourceCount,
          sourceRowLayoutId: source.sourceRowLayoutId,
          identityStrideWords: particleIdentityStrideWords,
          selectedLevel: levelSpec.selectedLevel,
          parentMechanicsView: levelMechanicsViewExecution,
          forceRadixFallback: mechanicsFieldForceRadixFallback,
          gpuTimestampRecorder,
          timestampMetadata: {
            laneId,
            sourceFamily: resolvedSourceFamily,
            physicsTick: source.physicsTick,
            physicsSubstep: source.physicsSubstep
          }
        });
        if (mechanicsFieldTimestampSpan) {
          gpuTimestampRecorder.endEncoderSpan(
            encoder,
            mechanicsFieldTimestampSpan
          );
        }
        if (phaseVolumeMomentSourceAdmitted) {
          levelView.phaseVolumeMomentRuntime = directPhaseVolumeMomentRuntime(
            device,
            entry,
            levelView.mechanicsFieldView
          );
          const phaseVolumeMomentTimestampSpan = gpuTimestampRecorder?.active === true
            && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
            ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
                producerId: 'schroeder-spatial-phase-volume-moment-build',
                stage: 'phase-volume-moment-build',
                spanClass: 'same-production-command-encoder',
                generationId,
                laneId,
                selectedLevel: levelSpec.selectedLevel,
                sourceFamily: resolvedSourceFamily,
                physicsTick: source.physicsTick,
                physicsSubstep: source.physicsSubstep
              })
            : null;
          levelView.phaseVolumeMoment = levelView.phaseVolumeMomentRuntime.encode(encoder, {
            sourceBuffer: source.sourceBuffer || source.activeNodeBuffer,
            sourceMechanicsBuffer: source.sourceMechanicsBuffer,
            sourceMechanicsBufferBorrowed: true,
            mechanicsFieldView: levelView.mechanicsFieldView,
            gpuTimestampRecorder,
            timestampMetadata: {
              laneId,
              sourceFamily: resolvedSourceFamily,
              physicsTick: source.physicsTick,
              physicsSubstep: source.physicsSubstep
            }
          });
          if (phaseVolumeMomentTimestampSpan) {
            gpuTimestampRecorder.endEncoderSpan(
              encoder,
              phaseVolumeMomentTimestampSpan
            );
          }
        }
      }
    }
    mechanicsViewExecution = mechanicsLevelViews[0]?.mechanicsView || null;
    mechanicsViewRuntime = mechanicsLevelViews[0]?.mechanicsViewRuntime || null;
    mechanicsFieldViewExecution = mechanicsLevelViews[0]?.mechanicsFieldView || null;
    mechanicsFieldViewRuntime = mechanicsLevelViews[0]?.mechanicsFieldViewRuntime || null;
    phaseVolumeMomentExecution = mechanicsLevelViews[0]?.phaseVolumeMoment || null;
    phaseVolumeMomentRuntime = mechanicsLevelViews[0]?.phaseVolumeMomentRuntime || null;
    if (mechanicsLevelViews.length === 2) {
      hierarchyViewRuntime = directHierarchyViewRuntime(
        device,
        entry,
        mechanicsLevelViews[0].mechanicsGrid,
        mechanicsLevelViews[1].mechanicsGrid
      );
      hierarchyViewExecution = hierarchyViewRuntime.encode(encoder, {
        spatialExecution: execution,
        fineMechanicsView: mechanicsLevelViews[0].mechanicsView,
        coarseMechanicsView: mechanicsLevelViews[1].mechanicsView
      });
      if (mechanicsLevelViews.every((levelView) => levelView.mechanicsFieldView)) {
        parentFieldViewRuntime = directParentFieldViewRuntime(
          device,
          entry,
          mechanicsLevelViews[0].mechanicsGrid,
          mechanicsLevelViews[1].mechanicsGrid,
          mechanicsLevelViews[0].mechanicsFieldView.fieldCapacity,
          mechanicsLevelViews[1].mechanicsFieldView.fieldCapacity
        );
        parentFieldViewExecution = parentFieldViewRuntime.encode(encoder, {
          mechanicsFieldViews: mechanicsLevelViews.map(
            (levelView) => levelView.mechanicsFieldView
          ),
          hierarchyView: hierarchyViewExecution
        });
      }
    }
    if (particleBufferSet) {
      aggregateViewRuntime = directAggregateViewRuntime(device, entry);
      aggregateViewExecution = aggregateViewRuntime.encode(encoder, {
        spatialExecution: execution,
        spatialSource: source,
        particleBufferSet
      });
    }
    if (viewBuildTimestampSpan) {
      gpuTimestampRecorder.endEncoderSpan(
        encoder,
        viewBuildTimestampSpan
      );
    }
    device.queue.submit([encoder.finish()]);
    submissionPerformed = true;
    if (!markSubmittedOrConfirm(entry.runtime, execution)) {
      throw new Error('spatial epoch runtime did not authenticate the submitted execution');
    }
    if (mechanicsLevelViews.some((levelView) => !markSubmittedOrConfirm(
      levelView.mechanicsViewRuntime,
      levelView.mechanicsView
    ))) {
      throw new Error('compact mechanics view runtime did not authenticate the submitted execution');
    }
    if (mechanicsLevelViews.some((levelView) => !markSubmittedOrConfirm(
      levelView.mechanicsFieldViewRuntime,
      levelView.mechanicsFieldView
    ))) {
      throw new Error('mechanics field view runtime did not authenticate the submitted execution');
    }
    if (mechanicsLevelViews.some((levelView) => !markSubmittedOrConfirm(
      levelView.phaseVolumeMomentRuntime,
      levelView.phaseVolumeMoment
    ))) {
      throw new Error('phase-volume moment runtime did not authenticate the submitted execution');
    }
    if (!markSubmittedOrConfirm(hierarchyViewRuntime, hierarchyViewExecution)) {
      throw new Error('spatial hierarchy view runtime did not authenticate the submitted execution');
    }
    if (!markSubmittedOrConfirm(parentFieldViewRuntime, parentFieldViewExecution)) {
      throw new Error('spatial parent-field view runtime did not authenticate the submitted execution');
    }
    if (!markSubmittedOrConfirm(aggregateViewRuntime, aggregateViewExecution)) {
      throw new Error('spatial aggregate view runtime did not authenticate the submitted execution');
    }
    entry.generation = generationId;
    entry.buildCount += 1;
    const generation = {
      schema: ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA,
      status: 'schroeder-spatial-epoch-generation-submitted',
      reason: null,
      ready: true,
      selected: true,
      source,
      execution,
      runtime: entry.runtime,
      mechanicsView: mechanicsViewExecution,
      mechanicsViewRuntime,
      mechanicsFieldView: mechanicsFieldViewExecution,
      mechanicsFieldViewRuntime,
      phaseVolumeMoment: phaseVolumeMomentExecution,
      phaseVolumeMomentRuntime,
      mechanicsLevelViews: Object.freeze(mechanicsLevelViews.map((levelView) => (
        Object.freeze(levelView)
      ))),
      mechanicsLevelCount: mechanicsLevelViews.length,
      mechanicsLevels: Object.freeze(mechanicsLevelViews.map((levelView) => (
        levelView.selectedLevel
      ))),
      hierarchyView: hierarchyViewExecution,
      hierarchyViewRuntime,
      parentFieldView: parentFieldViewExecution,
      parentFieldViewRuntime,
      aggregateView: aggregateViewExecution,
      aggregateViewRuntime,
      runtimeCapacity: entry.capacity,
      arenaCapacity: entry.runtime.arenaCount,
      runtimeCacheHit: cacheHit,
      runtimeBuildCount: entry.buildCount,
      directoryBuildCount: 1,
      privateLookupBuildCount: 0,
      releaseScheduled: false,
      releaseStatus: 'spatial-epoch-generation-retained-for-consumers'
    };
    Object.defineProperty(generation, 'directRuntimeEntry', {
      value: entry,
      enumerable: false,
      writable: false,
      configurable: false
    });
    ownedSpatialEpochGenerations.add(generation);
    entry.liveGenerations.push(generation);
    return generation;
  } catch (error) {
    if (
      !submissionPerformed
      && generationEncoder
      && typeof gpuTimestampRecorder?.discardEncoderSpans === 'function'
    ) {
      try {
        gpuTimestampRecorder.discardEncoderSpans(generationEncoder);
      } catch {
        // Preserve the original build/admission error.
      }
    }
    if (submissionPerformed && cache?.entry && execution) {
      const spatialSubmitted = markSubmittedOrConfirm(
        cache.entry.runtime,
        execution
      );
      const mechanicsSubmitted = mechanicsLevelViews.every((levelView) => (
        markSubmittedOrConfirm(levelView.mechanicsViewRuntime, levelView.mechanicsView)
      ));
      const mechanicsFieldSubmitted = mechanicsLevelViews.every((levelView) => (
        markSubmittedOrConfirm(
          levelView.mechanicsFieldViewRuntime,
          levelView.mechanicsFieldView
        )
      ));
      const phaseVolumeMomentSubmitted = mechanicsLevelViews.every((levelView) => (
        markSubmittedOrConfirm(
          levelView.phaseVolumeMomentRuntime,
          levelView.phaseVolumeMoment
        )
      ));
      const hierarchySubmitted = markSubmittedOrConfirm(
        hierarchyViewRuntime,
        hierarchyViewExecution
      );
      const parentFieldSubmitted = markSubmittedOrConfirm(
        parentFieldViewRuntime,
        parentFieldViewExecution
      );
      const aggregateSubmitted = markSubmittedOrConfirm(
        aggregateViewRuntime,
        aggregateViewExecution
      );
      cache.entry.generation = Math.max(cache.entry.generation, generationId);
      cache.entry.buildCount += 1;
      if (
        spatialSubmitted
        && mechanicsSubmitted
        && mechanicsFieldSubmitted
        && phaseVolumeMomentSubmitted
        && hierarchySubmitted
        && parentFieldSubmitted
        && aggregateSubmitted
      ) {
        postSubmitCleanupGeneration = {
          schema: ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA,
          status: 'schroeder-spatial-epoch-post-submit-cleanup-retained',
          reason: error instanceof Error ? error.message : String(error),
          ready: false,
          selected: true,
          source,
          execution,
          runtime: cache.entry.runtime,
          mechanicsView: mechanicsViewExecution,
          mechanicsViewRuntime,
          mechanicsFieldView: mechanicsFieldViewExecution,
          mechanicsFieldViewRuntime,
          phaseVolumeMoment: phaseVolumeMomentExecution,
          phaseVolumeMomentRuntime,
          mechanicsLevelViews: Object.freeze(mechanicsLevelViews.map((levelView) => (
            Object.freeze(levelView)
          ))),
          mechanicsLevelCount: mechanicsLevelViews.length,
          mechanicsLevels: Object.freeze(mechanicsLevelViews.map((levelView) => (
            levelView.selectedLevel
          ))),
          hierarchyView: hierarchyViewExecution,
          hierarchyViewRuntime,
          parentFieldView: parentFieldViewExecution,
          parentFieldViewRuntime,
          aggregateView: aggregateViewExecution,
          aggregateViewRuntime,
          releaseScheduled: false,
          releaseStatus: 'spatial-epoch-post-submit-cleanup-awaiting-fence'
        };
        Object.defineProperty(postSubmitCleanupGeneration, 'directRuntimeEntry', {
          value: cache.entry,
          enumerable: false,
          writable: false,
          configurable: false
        });
        ownedSpatialEpochGenerations.add(postSubmitCleanupGeneration);
        cache.entry.liveGenerations.push(postSubmitCleanupGeneration);
        releaseSchroederSpatialEpochGenerationAfterQueue(
          postSubmitCleanupGeneration,
          device
        );
      } else {
        postSubmitCleanupError =
          'submitted execution ownership could not be authenticated for cleanup';
      }
    }
    if (execution && !submissionPerformed && cache?.entry?.runtime) {
      try {
        cache.entry.runtime.releaseExecution(execution, { discardedEncoder: true });
      } catch {
        // Preserve the original build/admission error.
      }
    }
    if (!submissionPerformed) {
      try {
        parentFieldViewRuntime?.releaseExecution?.(
          parentFieldViewExecution,
          { discardedEncoder: true }
        );
      } catch {
        // Preserve the original build/admission error.
      }
      try {
        aggregateViewRuntime?.releaseExecution?.(
          aggregateViewExecution,
          { discardedEncoder: true }
        );
      } catch {
        // Preserve the original build/admission error.
      }
      for (const levelView of mechanicsLevelViews) {
        try {
          levelView.mechanicsViewRuntime?.releaseExecution?.(
            levelView.mechanicsView,
            { discardedEncoder: true }
          );
        } catch {
          // Preserve the original build/admission error.
        }
        try {
          levelView.phaseVolumeMomentRuntime?.releaseExecution?.(
            levelView.phaseVolumeMoment,
            { discardedEncoder: true }
          );
        } catch {
          // Preserve the original build/admission error.
        }
        try {
          levelView.mechanicsFieldViewRuntime?.releaseExecution?.(
            levelView.mechanicsFieldView,
            { discardedEncoder: true }
          );
        } catch {
          // Preserve the original build/admission error.
        }
      }
      try {
        hierarchyViewRuntime?.releaseExecution?.(
          hierarchyViewExecution,
          { discardedEncoder: true }
        );
      } catch {
        // Preserve the original build/admission error.
      }
    }
    const rejectedGeneration = {
      schema: ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA,
      status: (
        error?.code === 'ERR_SCHROEDER_SPATIAL_ARENA_EXHAUSTED'
        || error?.code === 'ERR_SCHROEDER_MECHANICS_VIEW_ARENA_EXHAUSTED'
        || error?.code === 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_ARENA_EXHAUSTED'
        || error?.code === 'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_ARENA_EXHAUSTED'
        || error?.code === 'ERR_SCHROEDER_HIERARCHY_VIEW_ARENA_EXHAUSTED'
        || error?.code === 'ERR_SCHROEDER_PARENT_FIELD_VIEW_ARENA_EXHAUSTED'
        || error?.code === 'ERR_SCHROEDER_AGGREGATE_VIEW_ARENA_EXHAUSTED'
        || error?.code === 'ERR_SCHROEDER_MECHANICS_VIEW_CACHE_BACKPRESSURE'
        || error?.code === 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_CACHE_BACKPRESSURE'
        || error?.code === 'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_CACHE_BACKPRESSURE'
        || error?.code === 'ERR_SCHROEDER_HIERARCHY_VIEW_CACHE_BACKPRESSURE'
        || error?.code === 'ERR_SCHROEDER_PARENT_FIELD_VIEW_CACHE_BACKPRESSURE'
      )
        ? 'schroeder-spatial-epoch-generation-backpressure'
        : 'schroeder-spatial-epoch-generation-rejected',
      reason: error instanceof Error ? error.message : String(error),
      errorCode: error?.code ?? null,
      ready: false,
      selected: false,
      source,
      execution: null,
      directoryBuildCount: 0,
      privateLookupBuildCount: 0,
      releaseScheduled: postSubmitCleanupGeneration?.releaseScheduled === true,
      releaseStatus: postSubmitCleanupGeneration?.releaseStatus
        ?? (postSubmitCleanupError
          ? 'spatial-epoch-post-submit-cleanup-unconfirmed'
          : 'spatial-epoch-generation-not-submitted'),
      releasePromise: postSubmitCleanupGeneration?.releasePromise ?? null,
      postSubmitCleanupError,
      runtimeCapacity: cache?.entry?.capacity ?? null,
      arenaCapacity: cache?.entry?.runtime?.arenaCount ?? null,
      runtimeCacheHit: Boolean(cache?.cacheHit)
    };
    if (postSubmitCleanupGeneration) {
      postSubmitCleanupGenerationOrigins.set(
        rejectedGeneration,
        postSubmitCleanupGeneration
      );
    }
    return rejectedGeneration;
  }
}

function rejectedExactNearConsumerAuthentication({
  consumerId = null,
  supportProfileId = null,
  status,
  reason,
  field = null,
  expected = undefined,
  actual = undefined
}) {
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_CONSUMER_AUTHENTICATION_SCHEMA,
    status,
    reason,
    ready: false,
    admitted: false,
    authenticated: false,
    gpuAuthenticated: false,
    generationBound: false,
    consumerId,
    supportProfileId,
    ...(field == null ? {} : { field }),
    ...(expected === undefined ? {} : { expected }),
    ...(actual === undefined ? {} : { actual })
  });
}

function exactNearEpochIdentity(execution) {
  return Object.freeze({
    storageGeneration: execution.storageGeneration,
    physicsTick: execution.physicsTick,
    physicsSubstep: execution.physicsSubstep,
    positionEpoch: execution.positionEpoch,
    topologyEpoch: execution.topologyEpoch,
    chartEpoch: execution.chartEpoch,
    levelEpoch: execution.levelEpoch,
    supportEpoch: execution.supportEpoch
  });
}

function exactNearIdentityMatches(left, right) {
  if (!left || !right) return false;
  return [
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ].every((field) => Object.is(left[field], right[field]));
}

/**
 * Resolve one law consumer onto the exact retained generation that owns its
 * directory and source buffer. This authenticates host-side binding identity;
 * the reusable WGSL module still validates the completed v1 directory header
 * on-device before the first traversal.
 */
export function resolveSchroederSpatialExactNearConsumerGeneration(
  generation,
  {
    device = null,
    runtime = null,
    consumerId = null,
    supportProfileId = null,
    sourceBuffer = null,
    expected: expectedIdentity = {}
  } = {}
) {
  const reject = (status, reason, details = {}) => (
    rejectedExactNearConsumerAuthentication({
      consumerId,
      supportProfileId,
      status,
      reason,
      ...details
    })
  );
  if (typeof consumerId !== 'string' || consumerId.trim().length === 0) {
    return reject(
      'schroeder-spatial-consumer-authentication-rejected-consumer',
      'consumerId must be a non-empty string'
    );
  }
  const profile = resolveSchroederSpatialSupportProfileContract(supportProfileId);
  if (!profile) {
    return reject(
      'schroeder-spatial-consumer-authentication-rejected-support-profile',
      'supportProfileId is not a registered exact-near v1 support contract'
    );
  }
  if (
    generation?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA
    || generation.ready !== true
    || generation.selected !== true
    || generation.status !== 'schroeder-spatial-epoch-generation-submitted'
  ) {
    return reject(
      'schroeder-spatial-consumer-authentication-rejected-generation',
      'generation is not a submitted retained Schroeder spatial generation'
    );
  }
  const execution = generation.execution;
  const ownerRuntime = runtime ?? generation.runtime ?? null;
  const source = generation.source;
  if (
    execution?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
    || execution.magic !== SCHROEDER_SPATIAL_EPOCH_MAGIC
    || execution.abiVersion !== SCHROEDER_SPATIAL_EPOCH_VERSION
    || execution.status !== 'schroeder-spatial-epoch-gpu-build-submitted'
    || execution.submitPerformed !== true
    || execution.released === true
    || generation.releaseScheduled === true
  ) {
    return reject(
      'schroeder-spatial-consumer-authentication-rejected-execution',
      'generation execution is not live, submitted, and retained for consumers'
    );
  }
  const consumerDeviceId = device ? webGpuDeviceId(device) : null;
  if (!device || consumerDeviceId == null || execution.deviceId !== consumerDeviceId) {
    return reject(
      'schroeder-spatial-consumer-authentication-rejected-device',
      'consumer device does not own the retained generation',
      { field: 'deviceId', expected: execution.deviceId, actual: consumerDeviceId }
    );
  }
  if (
    ownerRuntime !== generation.runtime
    || ownerRuntime !== execution.ownerRuntime
    || ownerRuntime?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
    || ownerRuntime.status !== 'schroeder-spatial-epoch-gpu-runtime-ready'
    || ownerRuntime.deviceId !== consumerDeviceId
  ) {
    return reject(
      'schroeder-spatial-consumer-authentication-rejected-runtime',
      'consumer runtime is not the exact live generation owner'
    );
  }
  let runtimeOwnsExecution = false;
  let runtimeSubmittedExecution = false;
  try {
    runtimeOwnsExecution = ownerRuntime.ownsExecution(execution) === true;
    runtimeSubmittedExecution = ownerRuntime.isExecutionSubmitted(execution) === true;
  } catch {
    runtimeOwnsExecution = false;
    runtimeSubmittedExecution = false;
  }
  if (!runtimeOwnsExecution || !runtimeSubmittedExecution) {
    return reject(
      'schroeder-spatial-consumer-authentication-rejected-runtime-ownership',
      'runtime cannot prove ownership and submission of the exact execution'
    );
  }
  const retainedSourceBuffer = source?.sourceBuffer ?? source?.activeNodeBuffer ?? null;
  const expectedSourceBuffer = sourceBuffer ?? retainedSourceBuffer;
  if (
    source?.ready !== true
    || source.status !== 'schroeder-spatial-directory-source-ready'
    || !retainedSourceBuffer
    || expectedSourceBuffer !== retainedSourceBuffer
    || execution.sourceBuffer !== retainedSourceBuffer
    || (source.exactNearQueryProfile?.sourceBuffer
      ?? source.exactNearQueryProfile?.activeNodeBuffer) !== retainedSourceBuffer
    || !webGpuBufferMatchesDevice(retainedSourceBuffer, device)
    || !execution.directoryBuffer
    || !webGpuBufferMatchesDevice(execution.directoryBuffer, device)
  ) {
    return reject(
      'schroeder-spatial-consumer-authentication-rejected-source-buffer',
      'source/directory buffers do not form one same-device retained family'
    );
  }
  if (
    execution.sourceAdapterId !== SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    || execution.exactNearQueryProfile?.ready !== true
    || source.exactNearQueryProfile?.ready !== true
    || execution.queryGeometryMode !== SCHROEDER_SPATIAL_QUERY_GEOMETRY_SINGLE_CHART_POW2
  ) {
    return reject(
      'schroeder-spatial-consumer-authentication-rejected-query-profile',
      'generation does not carry an admitted exact-near query geometry profile'
    );
  }
  const sourceIdentityChecks = [
    ['sourceCount', source.sourceCount, execution.sourceCount],
    ['storageGeneration', source.storageGeneration, execution.storageGeneration],
    ['physicsTick', source.physicsTick, execution.physicsTick],
    ['physicsSubstep', source.physicsSubstep, execution.physicsSubstep],
    ['positionEpoch', source.positionEpoch, execution.positionEpoch],
    ['topologyEpoch', source.topologyEpoch, execution.topologyEpoch],
    ['chartEpoch', source.chartEpoch, execution.chartEpoch],
    ['levelEpoch', source.levelEpoch, execution.levelEpoch],
    ['supportEpoch', source.supportEpoch, execution.supportEpoch],
    ['chartId', source.exactNearQueryProfile.chartId, execution.queryChartId],
    ['minLevel', source.exactNearQueryProfile.minLevel, execution.queryMinLevel],
    ['maxLevel', source.exactNearQueryProfile.maxLevel, execution.queryMaxLevel],
    [
      'baseGridSpacingM',
      Math.fround(source.exactNearQueryProfile.baseGridSpacingM),
      execution.queryBaseGridSpacingM
    ]
  ];
  for (const [field, expected, actual] of sourceIdentityChecks) {
    if (!Object.is(expected, actual)) {
      return reject(
        'schroeder-spatial-consumer-authentication-rejected-source-identity',
        `source identity field ${field} does not match the directory generation`,
        { field, expected, actual }
      );
    }
  }
  const optionalIdentityChecks = [
    ['deviceId', execution.deviceId],
    ['laneId', execution.laneId],
    ['generationId', execution.generationId],
    ['deviceOrdinal', execution.deviceOrdinal],
    ['laneOrdinal', execution.laneOrdinal],
    ['leaseToken', execution.leaseToken],
    ['sourceFamily', execution.sourceFamily],
    ['sourceFamilyId', execution.sourceFamilyId],
    ['sourceAdapterId', execution.sourceAdapterId],
    ['sourceCount', execution.sourceCount],
    ['storageGeneration', execution.storageGeneration],
    ['physicsTick', execution.physicsTick],
    ['physicsSubstep', execution.physicsSubstep],
    ['positionEpoch', execution.positionEpoch],
    ['topologyEpoch', execution.topologyEpoch],
    ['chartEpoch', execution.chartEpoch],
    ['levelEpoch', execution.levelEpoch],
    ['supportEpoch', execution.supportEpoch]
  ];
  for (const [field, actual] of optionalIdentityChecks) {
    if (
      Object.hasOwn(expectedIdentity, field)
      && !Object.is(expectedIdentity[field], actual)
    ) {
      return reject(
        'schroeder-spatial-consumer-authentication-rejected-expected-identity',
        `consumer expectation ${field} does not match the retained generation`,
        { field, expected: expectedIdentity[field], actual }
      );
    }
  }
  let expectationData;
  try {
    expectationData = createSchroederSpatialExactNearExpectationV1Data({
      sourceCount: execution.sourceCount,
      derivationEnabled: true,
      supportProfileId,
      chartId: execution.queryChartId,
      levelCount: execution.queryLevelCount,
      generationId: execution.generationId,
      deviceOrdinal: execution.deviceOrdinal,
      laneOrdinal: execution.laneOrdinal,
      leaseToken: execution.leaseToken,
      sourceFamilyId: execution.sourceFamilyId,
      storageGeneration: execution.storageGeneration,
      physicsTick: execution.physicsTick,
      physicsSubstep: execution.physicsSubstep,
      positionEpoch: execution.positionEpoch,
      topologyEpoch: execution.topologyEpoch,
      chartEpoch: execution.chartEpoch,
      levelEpoch: execution.levelEpoch,
      supportEpoch: execution.supportEpoch,
      minLevel: execution.queryMinLevel,
      baseGridSpacingM: execution.queryBaseGridSpacingM,
      cellKeysOffsetWords: execution.layout.cellKeysOffsetWords,
      cellOffsetsOffsetWords: execution.layout.cellOffsetsOffsetWords,
      cellMembersOffsetWords: execution.layout.cellMembersOffsetWords,
      particleToCellOffsetWords: execution.layout.particleToCellOffsetWords,
      directoryCapacityWords: execution.layout.wordLength,
      sourceCapacity: execution.sourceCapacity,
      cellCapacity: execution.cellCapacity
    });
  } catch (error) {
    return reject(
      'schroeder-spatial-consumer-authentication-rejected-expectation',
      error instanceof Error ? error.message : String(error)
    );
  }
  const epochIdentity = exactNearEpochIdentity(execution);
  const receipt = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA,
    status: 'schroeder-spatial-epoch-consumer-binding-authenticated',
    authenticated: true,
    gpuAuthenticated: false,
    submitPerformed: true,
    generationBound: true,
    consumerId,
    phase: profile.phase,
    supportProfileId,
    artifactFamily: profile.artifactFamily,
    deviceId: consumerDeviceId,
    generationId: execution.generationId,
    epochIdentity,
    traversalCount: 0,
    candidateVisitCount: 0,
    consumerMaskHitCount: 0,
    migratedProposalCount: 0,
    candidateBytesRequired: 0,
    candidateBytesAdmitted: 0,
    candidateBytesCapacity: 0,
    candidateOverflowBytes: 0,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    overflowed: false,
    partialPublication: false,
    fallbackObserved: false,
    fullReadbackPerformed: false
  });
  const authentication = {
    schema: ULG_SCHROEDER_SPATIAL_CONSUMER_AUTHENTICATION_SCHEMA,
    status: 'schroeder-spatial-consumer-bindings-authenticated',
    reason: null,
    ready: true,
    admitted: true,
    authenticated: true,
    gpuAuthenticated: false,
    generationBound: true,
    consumerId,
    supportProfileId,
    supportProfile: profile,
    deviceId: consumerDeviceId,
    generationId: execution.generationId,
    epochIdentity,
    sourceFamily: execution.sourceFamily,
    sourceFamilyId: execution.sourceFamilyId,
    sourceAdapterId: execution.sourceAdapterId,
    sourceCount: execution.sourceCount,
    sourceBuffer: retainedSourceBuffer,
    directoryBuffer: execution.directoryBuffer,
    expectationData,
    expectationUniformBytes: SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES,
    gpuDirectoryAdmissionRequired: true,
    gpuDirectoryAdmissionMode: 'consumer-wgsl-v1-fail-closed',
    receipt,
    generation,
    execution,
    runtime: ownerRuntime
  };
  exactNearConsumerAuthentications.set(authentication, {
    generation,
    execution,
    runtime: ownerRuntime,
    device,
    profile,
    receipt,
    finalizedReceipt: null
  });
  return Object.freeze(authentication);
}

function exactNonNegativeCounter(value, label) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < 0
    || value > Number.MAX_SAFE_INTEGER
  ) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

/** Finalize one runtime-issued binding receipt with law-owned GPU evidence. */
export function finalizeSchroederSpatialExactNearConsumerReceipt(
  authentication,
  gpuEvidence
) {
  const record = exactNearConsumerAuthentications.get(authentication);
  if (!record || authentication?.receipt !== record.receipt) {
    throw new TypeError('authentication was not issued by the live spatial epoch runtime');
  }
  if (record.finalizedReceipt) return record.finalizedReceipt;
  if (
    gpuEvidence?.schema !== ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA
    || gpuEvidence.status !== 'schroeder-spatial-exact-near-gpu-authenticated'
    || gpuEvidence.gpuAuthenticated !== true
    || gpuEvidence.consumerId !== authentication.consumerId
    || gpuEvidence.supportProfileId !== authentication.supportProfileId
    || gpuEvidence.generationId !== authentication.generationId
    || !exactNearIdentityMatches(gpuEvidence.epochIdentity, authentication.epochIdentity)
  ) {
    throw new TypeError('GPU evidence does not authenticate this exact consumer generation');
  }
  if (
    record.generation.releaseScheduled === true
    || record.execution.released === true
    || record.runtime.ownsExecution(record.execution) !== true
    || record.runtime.isExecutionSubmitted(record.execution) !== true
  ) {
    throw new Error('consumer receipt cannot finalize after generation retirement begins');
  }
  const traversalCount = exactNonNegativeCounter(
    gpuEvidence.traversalCount,
    'traversalCount'
  );
  if (traversalCount !== 1) {
    throw new RangeError('an enabled exact-near consumer must authenticate exactly one traversal');
  }
  const counters = Object.fromEntries([
    'candidateVisitCount',
    'consumerMaskHitCount',
    'migratedProposalCount',
    'candidateBytesRequired',
    'candidateBytesAdmitted',
    'candidateBytesCapacity',
    'candidateOverflowBytes',
    'privateLookupBuildCount',
    'fixedCandidateBuildCount',
    'exhaustiveTraversalCount'
  ].map((field) => [
    field,
    exactNonNegativeCounter(gpuEvidence[field] ?? 0, field)
  ]));
  if (
    counters.candidateBytesRequired > counters.candidateBytesCapacity
    || counters.candidateBytesAdmitted !== counters.candidateBytesRequired
    || counters.candidateOverflowBytes !== 0
    || counters.privateLookupBuildCount !== 0
    || counters.fixedCandidateBuildCount !== 0
    || counters.exhaustiveTraversalCount !== 0
    || gpuEvidence.overflowed === true
    || gpuEvidence.partialPublication === true
    || gpuEvidence.fallbackObserved === true
    || gpuEvidence.fullReadbackPerformed === true
  ) {
    throw new Error('GPU evidence violates exact-near fail-closed residency invariants');
  }
  const finalizedReceipt = Object.freeze({
    ...record.receipt,
    status: 'schroeder-spatial-epoch-consumer-receipt-finalized',
    gpuAuthenticated: true,
    traversalCount,
    ...counters
  });
  record.finalizedReceipt = finalizedReceipt;
  finalizedExactNearConsumerReceipts.add(finalizedReceipt);
  return finalizedReceipt;
}

/** True only for the exact immutable object issued by the private finalizer. */
export function isFinalizedSchroederSpatialExactNearConsumerReceipt(receipt) {
  return Boolean(
    receipt
    && finalizedExactNearConsumerReceipts.has(receipt)
    && receipt.schema === ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA
    && receipt.status === 'schroeder-spatial-epoch-consumer-receipt-finalized'
    && receipt.authenticated === true
    && receipt.gpuAuthenticated === true
    && receipt.generationBound === true
    && receipt.traversalCount === 1
  );
}

/**
 * Build one direct generation while respecting the retained arena window.
 *
 * A resident batch may enqueue more ticks than the direct runtime has arenas.
 * Once the window is full, wait only on an already-scheduled generation-owner
 * release and retry the exact source epoch.  An exhausted runtime with no
 * scheduled release is an ownership error, not permission to bypass the
 * canonical directory.
 */
export async function runSchroederSpatialEpochGenerationWithBackpressureWebGpu(
  options = {}
) {
  let waitCount = 0;
  let waitMs = 0;
  for (;;) {
    const generation = runSchroederSpatialEpochGenerationWebGpu(options);
    if (generation.status !== 'schroeder-spatial-epoch-generation-backpressure') {
      generation.backpressureWaitCount = waitCount;
      generation.backpressureWaitMs = waitMs;
      generation.backpressureStatus = waitCount > 0
        ? 'schroeder-spatial-epoch-generation-backpressure-resolved'
        : 'schroeder-spatial-epoch-generation-backpressure-not-required';
      return generation;
    }

    const sourceCount = generation.source?.sourceCount;
    if (!Number.isInteger(sourceCount) || sourceCount < 1) {
      const error = new Error(
        'spatial epoch arena backpressure lacks a valid source capacity'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_ARENA_BACKPRESSURE_SOURCE';
      throw error;
    }
    const { entry } = directSpatialEpochRuntime(options.device, sourceCount);
    const scheduledReleases = entry.liveGenerations
      .map((liveGeneration) => liveGeneration?.releasePromise)
      .filter((releasePromise) => typeof releasePromise?.then === 'function');
    if (scheduledReleases.length === 0) {
      const error = new Error(
        'spatial epoch arena is exhausted without a scheduled generation-owner release'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_ARENA_BACKPRESSURE_UNRELEASABLE';
      error.arenaCapacity = entry.runtime.arenaCount;
      error.liveGenerationCount = entry.liveGenerations.length;
      error.rejectedGenerationStatus = generation.status ?? null;
      error.rejectedGenerationErrorCode = generation.errorCode ?? null;
      error.rejectedGenerationReason = generation.reason ?? null;
      const cause = new Error(
        generation.reason || 'spatial generation child artifact is under backpressure'
      );
      cause.code = generation.errorCode ?? null;
      error.cause = cause;
      throw error;
    }
    waitCount += 1;
    const waitStartedAtMs = globalThis.performance?.now?.() ?? Date.now();
    let released = false;
    try {
      released = await Promise.any(
        scheduledReleases.map((releasePromise) => (
          Promise.resolve(releasePromise).then((confirmed) => {
            if (confirmed === true) return true;
            throw new Error(
              'generation owner did not confirm spatial epoch release'
            );
          })
        ))
      );
    } catch {
      released = false;
    }
    waitMs += (globalThis.performance?.now?.() ?? Date.now()) - waitStartedAtMs;
    if (released !== true) {
      const releaseDiagnostics = entry.liveGenerations.map((liveGeneration) => ({
        generationId: liveGeneration?.execution?.generationId ?? null,
        status: liveGeneration?.releaseStatus ?? null,
        reason: liveGeneration?.releaseReason ?? null,
        spatialReleased: liveGeneration?.execution?.released === true,
        mechanicsReleased: generationMechanicsLevelViews(liveGeneration).every(
          (levelView) => levelView.mechanicsView == null
            || levelView.mechanicsView.released === true
        ),
        mechanicsFieldReleased: generationMechanicsLevelViews(liveGeneration).every(
          (levelView) => levelView.mechanicsFieldView == null
            || levelView.mechanicsFieldView.released === true
        ),
        phaseVolumeMomentReleased: generationMechanicsLevelViews(liveGeneration).every(
          (levelView) => levelView.phaseVolumeMoment == null
            || levelView.phaseVolumeMoment.released === true
        ),
        hierarchyReleased: liveGeneration?.hierarchyView == null
          || liveGeneration.hierarchyView.released === true,
        parentFieldReleased: liveGeneration?.parentFieldView == null
          || liveGeneration.parentFieldView.released === true,
        aggregateReleased: liveGeneration?.aggregateView == null
          || liveGeneration.aggregateView.released === true,
        operations: liveGeneration?.releaseOperationResults ?? []
      }));
      const error = new Error(
        'spatial epoch arena owner release completed without confirming retirement: '
        + JSON.stringify(releaseDiagnostics)
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_ARENA_BACKPRESSURE_RELEASE_FAILED';
      error.arenaCapacity = entry.runtime.arenaCount;
      error.liveGenerationCount = entry.liveGenerations.length;
      error.releaseDiagnostics = releaseDiagnostics;
      throw error;
    }
  }
}

function generationOwnedArtifacts(generation) {
  return [{
    role: 'spatial-directory',
    execution: generation.execution,
    runtime: generation.runtime
  }, ...generationMechanicsLevelViews(generation).flatMap((levelView) => [
    ...(levelView.mechanicsView ? [{
      role: `compact-mechanics-view-level-${levelView.selectedLevel}`,
      execution: levelView.mechanicsView,
      runtime: levelView.mechanicsViewRuntime
    }] : []),
    ...(levelView.mechanicsFieldView ? [{
      role: `mechanics-field-view-level-${levelView.selectedLevel}`,
      execution: levelView.mechanicsFieldView,
      runtime: levelView.mechanicsFieldViewRuntime
    }] : []),
    ...(levelView.phaseVolumeMoment ? [{
      role: `phase-volume-moment-level-${levelView.selectedLevel}`,
      execution: levelView.phaseVolumeMoment,
      runtime: levelView.phaseVolumeMomentRuntime
    }] : [])
  ]), ...(generation?.parentFieldView ? [{
    role: 'spatial-parent-field-view',
    execution: generation.parentFieldView,
    runtime: generation.parentFieldViewRuntime
  }] : []), ...(generation?.aggregateView ? [{
    role: 'spatial-aggregate-view',
    execution: generation.aggregateView,
    runtime: generation.aggregateViewRuntime
  }] : []), ...(generation?.hierarchyView ? [{
    role: 'spatial-hierarchy-view',
    execution: generation.hierarchyView,
    runtime: generation.hierarchyViewRuntime
  }] : [])];
}

function exactOwnedSpatialEpochGeneration(generation) {
  if (ownedSpatialEpochGenerations.has(generation)) return generation;
  const cleanupGeneration = postSubmitCleanupGenerationOrigins.get(generation);
  if (ownedSpatialEpochGenerations.has(cleanupGeneration)) {
    return cleanupGeneration;
  }
  const error = new TypeError(
    'spatial epoch retirement requires an exact runtime-created generation'
  );
  error.code = 'ERR_SCHROEDER_SPATIAL_GENERATION_FOREIGN';
  throw error;
}

function mirrorGenerationRetirement(record, values) {
  for (const alias of record.aliases) Object.assign(alias, values);
}

function generationRetirementRecord(generation, device) {
  const ownedGeneration = exactOwnedSpatialEpochGeneration(generation);
  const currentArtifacts = generationOwnedArtifacts(ownedGeneration);
  if (currentArtifacts.some((artifact) => (
    artifact.runtime !== artifact.execution?.ownerRuntime
  ))) {
    const error = new Error(
      'spatial epoch generation public artifact ownership changed'
    );
    error.code = 'ERR_SCHROEDER_SPATIAL_GENERATION_OWNER_MISMATCH';
    throw error;
  }
  const releaseDeviceId = webGpuDeviceId(device);
  if (
    releaseDeviceId == null
    || ownedGeneration?.execution?.deviceId !== releaseDeviceId
    || !ownedGeneration.execution.directoryBuffer
    || !webGpuBufferMatchesDevice(
      ownedGeneration.execution.directoryBuffer,
      device
    )
  ) {
    const error = new Error(
      'only the generation owner device may retire its exact artifact family'
    );
    error.code = 'ERR_SCHROEDER_SPATIAL_GENERATION_DEVICE_MISMATCH';
    throw error;
  }
  let record = spatialEpochGenerationRetirements.get(ownedGeneration);
  if (!record) {
    let resolveCompletion;
    const completionPromise = new Promise((resolve) => {
      resolveCompletion = resolve;
    });
    record = {
      generation: ownedGeneration,
      device,
      deviceId: releaseDeviceId,
      artifacts: Object.freeze(currentArtifacts),
      aliases: new Set([ownedGeneration]),
      completionPromise,
      resolveCompletion,
      completed: false,
      activeAttempt: null,
      nextAttemptOrdinal: 0,
      deviceLossEvidence: null,
      lossRequested: false,
      capability: null
    };
    spatialEpochGenerationRetirements.set(ownedGeneration, record);
  } else if (record.device !== device || record.deviceId !== releaseDeviceId) {
    const error = new Error(
      'spatial epoch retirement device changed for one exact generation'
    );
    error.code = 'ERR_SCHROEDER_SPATIAL_GENERATION_DEVICE_MISMATCH';
    throw error;
  } else if (
    currentArtifacts.length !== record.artifacts.length
    || currentArtifacts.some((artifact, index) => (
      artifact.role !== record.artifacts[index].role
      || artifact.execution !== record.artifacts[index].execution
      || artifact.runtime !== record.artifacts[index].runtime
    ))
  ) {
    const error = new Error(
      'spatial epoch generation public artifact family changed'
    );
    error.code = 'ERR_SCHROEDER_SPATIAL_GENERATION_OWNER_MISMATCH';
    throw error;
  }
  if (generation !== ownedGeneration) {
    record.aliases.add(generation);
    spatialEpochGenerationRetirements.set(generation, record);
    Object.assign(generation, {
      releaseScheduled: ownedGeneration.releaseScheduled,
      releaseStatus: ownedGeneration.releaseStatus,
      releaseReason: ownedGeneration.releaseReason,
      releasePromise: ownedGeneration.releasePromise
    });
  }
  return record;
}

function generationArtifactsReleased(record) {
  return record.artifacts.every(
    (artifact) => artifact.execution?.released === true
  );
}

function removeLiveSpatialEpochGeneration(record) {
  const entry = record.generation.directRuntimeEntry;
  if (!entry?.liveGenerations) return;
  const index = entry.liveGenerations.indexOf(record.generation);
  if (index >= 0) entry.liveGenerations.splice(index, 1);
  reapDirectMechanicsFieldViewDrainingRuntimes(entry);
}

function terminalizeSpatialArtifactRuntimeAfterDeviceLoss(runtime) {
  if (!runtime || deviceLossTerminalizedSpatialRuntimes.has(runtime)) return;
  const lostEncode = () => {
    const error = new Error('spatial artifact runtime is terminal after device loss');
    error.code = 'ERR_SCHROEDER_SPATIAL_DEVICE_LOST';
    throw error;
  };
  runtime.status = `${runtime.schema || 'schroeder-spatial-runtime'}-device-loss-terminal`;
  if (typeof runtime.encode === 'function') runtime.encode = lostEncode;
  deviceLossTerminalizedSpatialRuntimes.add(runtime);
}

function completeSpatialEpochGenerationRetirement(record, {
  deviceLost = false,
  operationResults = []
} = {}) {
  if (record.completed) return true;
  if (!generationArtifactsReleased(record)) {
    throw new Error(
      'generation retirement cannot complete while an owned artifact remains live'
    );
  }
  if (deviceLost) {
    spatialEpochLostDevices.add(record.device);
    for (const artifact of record.artifacts) {
      terminalizeSpatialArtifactRuntimeAfterDeviceLoss(artifact.runtime);
    }
  }
  record.completed = true;
  record.activeAttempt = null;
  mirrorGenerationRetirement(record, {
    releaseScheduled: true,
    releaseStatus: deviceLost
      ? 'spatial-epoch-generation-device-loss-retired'
      : 'spatial-epoch-generation-released-after-final-consumer',
    releaseReason: null,
    releaseOperationResults: operationResults
  });
  removeLiveSpatialEpochGeneration(record);
  record.resolveCompletion(true);
  return true;
}

function validateLiveGenerationArtifacts(record) {
  for (const artifact of record.artifacts) {
    if (artifact.execution?.released === true) continue;
    const exactMechanicsFieldRetirementInFlight =
      artifact.role.startsWith('mechanics-field-view-level-')
      && artifact.runtime?.isExecutionRetirementInFlight?.(
        artifact.execution
      ) === true;
    if (
      artifact.runtime !== artifact.execution?.ownerRuntime
      || artifact.runtime?.deviceId !== record.deviceId
      || typeof artifact.runtime?.releaseExecutionAfter !== 'function'
      || (
        exactMechanicsFieldRetirementInFlight !== true
        && (
          artifact.runtime?.ownsExecution?.(artifact.execution) !== true
          || artifact.runtime?.isExecutionSubmitted?.(artifact.execution) !== true
        )
      )
    ) {
      const error = new Error(
        `generation artifact ${artifact.role} lost its exact submitted owner`
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_GENERATION_OWNER_MISMATCH';
      throw error;
    }
  }
  return true;
}

function operationResult(artifact, result) {
  return {
    owner: artifact.role,
    status: result.status,
    confirmed: result.status === 'fulfilled' && result.value === true,
    reason: result.status === 'rejected'
      ? (result.reason instanceof Error
          ? result.reason.message
          : String(result.reason))
      : null
  };
}

function retireGenerationArtifactAfterDeviceLoss(
  artifact,
  exactLossEvidence,
  reason
) {
  if (artifact.execution?.released === true) return Promise.resolve(true);
  const { runtime, execution } = artifact;
  if (typeof runtime?.quarantineExecutionAfterDeviceLoss === 'function') {
    return runtime.quarantineExecutionAfterDeviceLoss(execution);
  }
  if (
    artifact.role.startsWith('mechanics-field-view-level-')
    && typeof runtime?.stateMutationState === 'function'
    && typeof runtime?.quarantineCurrentStateArtifact === 'function'
    && typeof runtime?.retireQuarantinedExecutionAfter === 'function'
  ) {
    const state = runtime.stateMutationState(execution);
    if (state.quarantined !== true) {
      runtime.quarantineCurrentStateArtifact(execution, {
        mutationOrdinal: state.ordinal,
        stateEncoding: state.encoding,
        reason
      });
    }
    return runtime.retireQuarantinedExecutionAfter(
      execution,
      { deviceLost: true }
    );
  }
  return runtime.releaseExecutionAfter(execution, exactLossEvidence);
}

function retireGenerationMechanicsFieldAtCurrentQueueBoundary(artifact) {
  const { runtime, execution } = artifact;
  if (
    typeof runtime?.isStateArtifactQuarantined === 'function'
    && typeof runtime?.retireQuarantinedExecutionAfter === 'function'
    && runtime.isStateArtifactQuarantined(execution) === true
  ) {
    return runtime.retireQuarantinedExecutionAfter(execution);
  }
  return runtime.releaseExecutionAfter(execution);
}

function startSpatialEpochGenerationRetirement(record, {
  deviceLost = false
} = {}) {
  if (record.completed) return record.completionPromise;
  if (deviceLost) {
    const exactLossEvidence = record.deviceLossEvidence ?? record.device?.lost;
    if (!exactLossEvidence || typeof exactLossEvidence.then !== 'function') {
      const error = new TypeError(
        'generation device-loss retirement requires the exact GPUDevice.lost promise'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_GENERATION_DEVICE_LOSS_EVIDENCE';
      throw error;
    }
    if (
      record.deviceLossEvidence != null
      && record.deviceLossEvidence !== exactLossEvidence
    ) {
      const error = new Error(
        'generation device-loss evidence changed for one exact generation'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_GENERATION_DEVICE_LOSS_EVIDENCE';
      throw error;
    }
    record.deviceLossEvidence = exactLossEvidence;
    record.lossRequested = true;
    if (record.activeAttempt?.mode === 'queue-fence') {
      record.activeAttempt.requestDeviceLoss(exactLossEvidence);
      return record.completionPromise;
    }
    if (record.activeAttempt?.mode === 'device-loss') {
      return record.activeAttempt.promise;
    }
    validateLiveGenerationArtifacts(record);
    const attempt = {
      mode: 'device-loss',
      ordinal: ++record.nextAttemptOrdinal,
      promise: null,
      operations: []
    };
    record.activeAttempt = attempt;
    mirrorGenerationRetirement(record, {
      releaseScheduled: true,
      releaseStatus: 'spatial-epoch-generation-device-loss-quarantined',
      releaseReason: null
    });
    const lossReason = new Error('WebGPU device loss retired the spatial epoch');
    attempt.operations = record.artifacts
      .filter((artifact) => artifact.execution?.released !== true)
      .map((artifact) => Promise.resolve(exactLossEvidence).then(() => {
        spatialEpochLostDevices.add(record.device);
        return retireGenerationArtifactAfterDeviceLoss(
          artifact,
          exactLossEvidence,
          lossReason
        );
      }));
    const activeArtifacts = record.artifacts.filter(
      (artifact) => artifact.execution?.released !== true
    );
    const lossAttempt = Promise.allSettled(attempt.operations).then((results) => {
      if (record.activeAttempt !== attempt) return record.completionPromise;
      const operationResults = results.map(
        (result, index) => operationResult(activeArtifacts[index], result)
      );
      if (generationArtifactsReleased(record)) {
        return completeSpatialEpochGenerationRetirement(record, {
          deviceLost: true,
          operationResults
        });
      }
      record.activeAttempt = null;
      const rejected = results.find((result) => result.status === 'rejected');
      const error = rejected?.reason instanceof Error
        ? rejected.reason
        : new Error('generation device-loss retirement was not confirmed');
      mirrorGenerationRetirement(record, {
        releaseScheduled: false,
        releaseStatus: 'spatial-epoch-generation-device-loss-retirement-blocked',
        releaseReason: error.message,
        releaseOperationResults: operationResults
      });
      throw error;
    });
    attempt.promise = lossAttempt;
    mirrorGenerationRetirement(record, { releasePromise: lossAttempt });
    lossAttempt.catch(() => {});
    return lossAttempt;
  }

  if (record.lossRequested) {
    return startSpatialEpochGenerationRetirement(record, { deviceLost: true });
  }
  if (record.activeAttempt) return record.activeAttempt.promise;
  validateLiveGenerationArtifacts(record);
  if (typeof record.device?.queue?.onSubmittedWorkDone !== 'function') {
    mirrorGenerationRetirement(record, {
      releaseScheduled: false,
      releaseStatus: 'spatial-epoch-generation-retained-no-fence-api'
    });
    return null;
  }
  let ownerFence;
  try {
    ownerFence = record.device.queue.onSubmittedWorkDone();
  } catch (error) {
    mirrorGenerationRetirement(record, {
      releaseScheduled: false,
      releasePromise: null,
      releaseStatus: 'spatial-epoch-generation-retained-fence-error',
      releaseReason: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
  if (!ownerFence || typeof ownerFence.then !== 'function') {
    mirrorGenerationRetirement(record, {
      releaseScheduled: false,
      releasePromise: null,
      releaseStatus: 'spatial-epoch-generation-retained-fence-error',
      releaseReason: 'queue completion fence must be a thenable'
    });
    return null;
  }
  const attempt = {
    mode: 'queue-fence',
    ordinal: ++record.nextAttemptOrdinal,
    promise: null,
    operations: [],
    requestDeviceLoss: null,
    deviceLossWon: false
  };
  let requestDeviceLoss;
  const requestedLossWinner = new Promise((resolve) => {
    requestDeviceLoss = (exactLossEvidence) => resolve(
      Promise.resolve(exactLossEvidence).then((info) => ({
        kind: 'device-loss',
        evidence: exactLossEvidence,
        info
      }))
    );
  });
  attempt.requestDeviceLoss = requestDeviceLoss;
  const initialLossEvidence = record.device?.lost;
  if (initialLossEvidence && typeof initialLossEvidence.then === 'function') {
    record.deviceLossEvidence = initialLossEvidence;
  }
  const retirementWinner = Promise.race([
    Promise.resolve(ownerFence).then(() => ({
      kind: 'queue-fence',
      evidence: ownerFence,
      info: null
    })),
    ...(record.deviceLossEvidence ? [
      Promise.resolve(record.deviceLossEvidence).then((info) => ({
        kind: 'device-loss',
        evidence: record.deviceLossEvidence,
        info
      }))
    ] : []),
    requestedLossWinner
  ]).then((winner) => {
    if (
      record.lossRequested
      && winner.kind !== 'device-loss'
      && record.deviceLossEvidence
    ) {
      return Promise.resolve(record.deviceLossEvidence).then((info) => ({
        kind: 'device-loss',
        evidence: record.deviceLossEvidence,
        info
      }));
    }
    return winner;
  });
  record.activeAttempt = attempt;
  const activeArtifacts = record.artifacts.filter(
    (artifact) => artifact.execution?.released !== true
  );
  // Mechanics-field retirement mints its own authenticated queue fence and
  // intentionally rejects caller-provided thenables.  Start that fence at the
  // same queue boundary as the generation owner fence; delaying invocation
  // until the owner fence resolves would make the child fence include younger
  // generations already admitted by the bounded arena window.
  const earlyRuntimeOwnedReleases = new Map();
  for (const artifact of activeArtifacts) {
    if (
      artifact.role.startsWith('mechanics-field-view-level-')
      && artifact.runtime?.releaseFencePolicy
        === 'runtime-owned-current-queue-at-invocation'
    ) {
      const release = retireGenerationMechanicsFieldAtCurrentQueueBoundary(
        artifact
      );
      release.catch(() => {});
      earlyRuntimeOwnedReleases.set(artifact, release);
    }
  }
  attempt.operations = activeArtifacts.map((artifact) => (
    retirementWinner.then((winner) => {
      if (winner.kind === 'device-loss') {
        attempt.deviceLossWon = true;
        spatialEpochLostDevices.add(record.device);
        const reason = new Error(
          winner.info?.message || winner.info?.reason || 'WebGPU device lost'
        );
        return retireGenerationArtifactAfterDeviceLoss(
          artifact,
          winner.evidence,
          reason
        );
      }
      const earlyRelease = earlyRuntimeOwnedReleases.get(artifact);
      if (earlyRelease) return earlyRelease;
      return artifact.runtime.releaseExecutionAfter(
        artifact.execution,
        winner.evidence
      );
    })
  ));
  const normalAttempt = Promise.allSettled(attempt.operations).then((results) => {
    if (record.activeAttempt !== attempt) return record.completionPromise;
    const operationResults = results.map(
      (result, index) => operationResult(activeArtifacts[index], result)
    );
    if (generationArtifactsReleased(record)) {
      return completeSpatialEpochGenerationRetirement(record, {
        deviceLost: attempt.deviceLossWon,
        operationResults
      });
    }
    record.activeAttempt = null;
    const rejected = results.find((result) => result.status === 'rejected');
    const reason = rejected
      ? (rejected.reason instanceof Error
          ? rejected.reason.message
          : String(rejected.reason))
      : 'generation owner did not confirm spatial epoch release';
    mirrorGenerationRetirement(record, {
      releaseScheduled: false,
      releasePromise: null,
      releaseStatus: attempt.deviceLossWon
        ? 'spatial-epoch-generation-device-loss-retirement-blocked'
        : 'spatial-epoch-generation-release-unconfirmed',
      releaseReason: reason,
      releaseFailureCount: (record.generation.releaseFailureCount ?? 0) + 1,
      releaseOperationResults: operationResults
    });
    return false;
  });
  attempt.promise = normalAttempt;
  mirrorGenerationRetirement(record, {
    releaseScheduled: true,
    releaseReason: null,
    releaseStatus:
      'spatial-epoch-generation-release-scheduled-after-final-consumer',
    releaseAttemptCount: (record.generation.releaseAttemptCount ?? 0) + 1,
    releasePromise: normalAttempt
  });
  normalAttempt.catch(() => {});
  return normalAttempt;
}

export function schroederSpatialEpochGenerationRetirementCapability(
  generation,
  device
) {
  const record = generationRetirementRecord(generation, device);
  if (!record.capability) {
    record.capability = Object.freeze({
      completionPromise: record.completionPromise,
      retry({ deviceLost = false } = {}) {
        const attempt = startSpatialEpochGenerationRetirement(record, {
          deviceLost
        });
        return attempt ?? Promise.resolve(false);
      }
    });
  }
  return record.capability;
}

export function quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
  generation,
  device
) {
  return schroederSpatialEpochGenerationRetirementCapability(
    generation,
    device
  ).retry({ deviceLost: true });
}

/**
 * Preserve the legacy hierarchy DI seam for normal queue-fence release only.
 * Stable retirement capabilities and device-loss quarantine intentionally do
 * not call this helper: those paths require a module-minted generation brand.
 */
function releaseStructurallyOwnedSpatialEpochGenerationAfterQueue(
  generation,
  device
) {
  if (
    generation?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA
    || generation.selected !== true
    || generation.execution?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
    || generation.execution.submitPerformed !== true
    || generation.releaseScheduled === true
  ) return false;
  const releaseDeviceId = webGpuDeviceId(device);
  if (
    releaseDeviceId == null
    || generation.execution.deviceId !== releaseDeviceId
    || !generation.execution.directoryBuffer
    || !webGpuBufferMatchesDevice(
      generation.execution.directoryBuffer,
      device
    )
  ) {
    generation.releaseStatus = 'spatial-epoch-generation-retained-device-mismatch';
    generation.releaseReason =
      'Only the generation owner device may fence and release its arena';
    return false;
  }
  const artifacts = generationOwnedArtifacts(generation);
  try {
    for (const artifact of artifacts) {
      if (artifact.execution?.released === true) continue;
      if (
        (artifact.role === 'spatial-directory' && (
          artifact.runtime?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
          || artifact.runtime?.status
            !== 'schroeder-spatial-epoch-gpu-runtime-ready'
        ))
        || artifact.runtime !== artifact.execution?.ownerRuntime
        || artifact.runtime?.deviceId !== releaseDeviceId
        || typeof artifact.runtime?.releaseExecutionAfter !== 'function'
        || artifact.runtime?.ownsExecution?.(artifact.execution) !== true
        || artifact.runtime?.isExecutionSubmitted?.(artifact.execution) !== true
      ) {
        throw new Error(
          `legacy generation artifact ${artifact.role} lost its exact owner`
        );
      }
    }
  } catch (error) {
    generation.releaseStatus = 'spatial-epoch-generation-retained-owner-mismatch';
    generation.releaseReason = error instanceof Error
      ? error.message
      : String(error);
    return false;
  }
  if (typeof device?.queue?.onSubmittedWorkDone !== 'function') {
    generation.releaseStatus = 'spatial-epoch-generation-retained-no-fence-api';
    return false;
  }
  let ownerFence;
  let activeArtifacts;
  let releaseOperations;
  try {
    ownerFence = device.queue.onSubmittedWorkDone();
    if (!ownerFence || typeof ownerFence.then !== 'function') {
      throw new TypeError('queue completion fence must be a thenable');
    }
    activeArtifacts = artifacts.filter(
      (artifact) => artifact.execution?.released !== true
    );
    releaseOperations = activeArtifacts.map((artifact) => (
      artifact.runtime.releaseExecutionAfter(
        artifact.execution,
        ownerFence
      )
    ));
  } catch (error) {
    generation.releaseScheduled = false;
    generation.releasePromise = null;
    generation.releaseStatus = 'spatial-epoch-generation-retained-fence-error';
    generation.releaseReason = error instanceof Error
      ? error.message
      : String(error);
    return false;
  }
  generation.releaseScheduled = true;
  generation.releaseReason = null;
  generation.releaseStatus =
    'spatial-epoch-generation-release-scheduled-after-final-consumer';
  generation.releaseAttemptCount = (generation.releaseAttemptCount ?? 0) + 1;
  const releaseAttempt = Promise.allSettled(releaseOperations).then((results) => {
    generation.releaseOperationResults = results.map(
      (result, index) => operationResult(activeArtifacts[index], result)
    );
    if (results.every(
      (result) => result.status === 'fulfilled' && result.value === true
    )) {
      generation.releaseStatus =
        'spatial-epoch-generation-released-after-final-consumer';
      generation.releaseReason = null;
      const entry = generation.directRuntimeEntry;
      const liveIndex = entry?.liveGenerations?.indexOf(generation) ?? -1;
      if (liveIndex >= 0) entry.liveGenerations.splice(liveIndex, 1);
      reapDirectMechanicsFieldViewDrainingRuntimes(entry);
      return true;
    }
    generation.releaseScheduled = false;
    generation.releasePromise = null;
    generation.releaseFailureCount =
      (generation.releaseFailureCount ?? 0) + 1;
    const rejected = results.find((result) => result.status === 'rejected');
    generation.releaseStatus = 'spatial-epoch-generation-release-unconfirmed';
    generation.releaseReason = rejected
      ? (rejected.reason instanceof Error
          ? rejected.reason.message
          : String(rejected.reason))
      : 'generation owner did not confirm spatial epoch release';
    return false;
  });
  generation.releasePromise = releaseAttempt;
  return true;
}

/** Schedule arena release against a fence taken after every generation reader. */
export function releaseSchroederSpatialEpochGenerationAfterQueue(
  generation,
  device
) {
  if (
    !ownedSpatialEpochGenerations.has(generation)
    && !postSubmitCleanupGenerationOrigins.has(generation)
  ) {
    return releaseStructurallyOwnedSpatialEpochGenerationAfterQueue(
      generation,
      device
    );
  }
  let record;
  try {
    record = generationRetirementRecord(generation, device);
  } catch (error) {
    if (generation && typeof generation === 'object') {
      generation.releaseStatus = error?.code
        === 'ERR_SCHROEDER_SPATIAL_GENERATION_DEVICE_MISMATCH'
        ? 'spatial-epoch-generation-retained-device-mismatch'
        : 'spatial-epoch-generation-retained-owner-mismatch';
      generation.releaseReason = error instanceof Error
        ? error.message
        : String(error);
    }
    return false;
  }
  if (record.completed || record.activeAttempt) return false;
  try {
    const attempt = startSpatialEpochGenerationRetirement(record);
    return attempt != null;
  } catch (error) {
    mirrorGenerationRetirement(record, {
      releaseScheduled: false,
      releasePromise: null,
      releaseStatus: error?.code
        === 'ERR_SCHROEDER_SPATIAL_GENERATION_OWNER_MISMATCH'
        ? 'spatial-epoch-generation-retained-owner-mismatch'
        : 'spatial-epoch-generation-retained-fence-error',
      releaseReason: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}
