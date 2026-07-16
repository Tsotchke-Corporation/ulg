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
const directSpatialEpochRuntimeCache = new WeakMap();
const exactNearConsumerAuthentications = new WeakMap();
const finalizedExactNearConsumerReceipts = new WeakSet();
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
    sourceStateBuffer,
    sourceStateBufferBorrowed: source.sourceStateBufferBorrowed === true,
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
    sourceCount,
    sourceRowLayoutId: SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceRowStrideFloats: strideFloats,
    phaseVolumeAssignmentOverlayEnabled: false,
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
  const submittedExecutions = new WeakSet();
  const releasedExecutions = new WeakSet();
  const releaseInFlightExecutions = new WeakSet();
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
      executionToken: null,
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

  function acquireArena(requestedArenaIndex = null) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    let arena = null;
    if (requestedArenaIndex !== null && requestedArenaIndex !== undefined) {
      arena = arenas[nonNegativeInteger(
        requestedArenaIndex,
        'arenaIndex',
        resolvedArenaCount - 1
      )];
    } else {
      arena = arenas.find((candidate) => !candidate.inUse) || null;
    }
    if (!arena || arena.inUse) {
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
      const keyDispatchCount = encodeComputeDispatch(
        encoder,
        keyPipeline,
        keyBindGroup,
        keyDispatch,
        `${label}KeyEmission`,
        timestampProfiler,
        metadata
      );
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
      executionOwnership.set(execution, Object.freeze({
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
      }));
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

  function ownedExecutionRecord(execution) {
    if (!execution || execution.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA) {
      throw new TypeError('releaseExecution requires a Schroeder spatial epoch execution');
    }
    if (releasedExecutions.has(execution)) return null;
    const ownership = executionOwnership.get(execution);
    if (
      !ownership
      || !liveExecutions.has(execution)
      || releaseInFlightExecutions.has(execution)
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

  function finalizeReleaseExecution(execution, ownership, { radixReleased = false } = {}) {
    if (!radixReleased) {
      ownership.arena.radix.releaseExecution(
        ownership.radixUnique,
        { discardedEncoder: true }
      );
    }
    const released = releaseArena(ownership.arena, ownership.executionToken);
    if (released) {
      releasedExecutions.add(execution);
      liveExecutions.delete(execution);
      submittedExecutions.delete(execution);
      executionOwnership.delete(execution);
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
    if (submittedExecutions.has(execution)) {
      const error = new Error(
        'submitted spatial epoch execution requires releaseExecutionAfter with a queue fence'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_SUBMITTED_EXECUTION_REQUIRES_FENCE';
      throw error;
    }
    const ownership = ownedExecutionRecord(execution);
    if (!ownership) return false;
    return finalizeReleaseExecution(execution, ownership);
  }

  async function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence || typeof submissionFence.then !== 'function') {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    const ownership = ownedExecutionRecord(execution);
    if (!ownership) return false;
    if (!submittedExecutions.has(execution)) {
      const error = new Error(
        'unsubmitted spatial epoch execution requires discarded-encoder release'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_UNSUBMITTED_EXECUTION_REQUIRES_DISCARD';
      throw error;
    }
    releaseInFlightExecutions.add(execution);
    try {
      await ownership.arena.radix.releaseExecutionAfter(
        ownership.radixUnique,
        submissionFence
      );
      return finalizeReleaseExecution(
        execution,
        ownership,
        { radixReleased: true }
      );
    } finally {
      releaseInFlightExecutions.delete(execution);
    }
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
      ]) buffer.destroy?.();
      arena.radix.destroy();
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
    capacity,
    generation: 0,
    buildCount: 0,
    liveGenerations: []
  };
  runtimes.set(capacity, entry);
  return { entry, cacheHit: false };
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
  laneId = 'direct-schroeder-scene',
  sourceFamily = null,
  allowPhaseVolumeOverlay = false,
  mechanicsGrid = null,
  selectedLevel = 0
} = {}) {
  if (!device?.createCommandEncoder || !device?.queue?.submit) {
    throw new TypeError(
      'runSchroederSpatialEpochGenerationWebGpu requires a WebGPU-like device and queue'
    );
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
  if (mechanicsGrid && source.exactNearQueryProfile?.ready !== true) {
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
    mechanicsGrid
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
  let cache = null;
  let execution = null;
  let mechanicsViewExecution = null;
  let mechanicsViewRuntime = null;
  let submissionPerformed = false;
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
    const encoder = device.createCommandEncoder({
      label: 'ulg-schroeder-direct-spatial-epoch-build'
    });
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
      laneId
    });
    mechanicsViewRuntime = directMechanicsViewRuntime(device, entry, mechanicsGrid);
    if (mechanicsViewRuntime) {
      mechanicsViewExecution = mechanicsViewRuntime.encode(encoder, {
        sourceBuffer: source.sourceBuffer || source.activeNodeBuffer,
        sourceCount: source.sourceCount,
        sourceRowLayoutId: source.sourceRowLayoutId,
        selectedLevel,
        spatialExecution: execution
      });
    }
    device.queue.submit([encoder.finish()]);
    submissionPerformed = true;
    if (!markSubmittedOrConfirm(mechanicsViewRuntime, mechanicsViewExecution)) {
      throw new Error('compact mechanics view runtime did not authenticate the submitted execution');
    }
    if (!markSubmittedOrConfirm(entry.runtime, execution)) {
      throw new Error('spatial epoch runtime did not authenticate the submitted execution');
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
    entry.liveGenerations.push(generation);
    return generation;
  } catch (error) {
    if (submissionPerformed && cache?.entry && execution) {
      const spatialSubmitted = markSubmittedOrConfirm(
        cache.entry.runtime,
        execution
      );
      const mechanicsSubmitted = markSubmittedOrConfirm(
        mechanicsViewRuntime,
        mechanicsViewExecution
      );
      cache.entry.generation = Math.max(cache.entry.generation, generationId);
      cache.entry.buildCount += 1;
      if (spatialSubmitted && mechanicsSubmitted) {
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
          releaseScheduled: false,
          releaseStatus: 'spatial-epoch-post-submit-cleanup-awaiting-fence'
        };
        Object.defineProperty(postSubmitCleanupGeneration, 'directRuntimeEntry', {
          value: cache.entry,
          enumerable: false,
          writable: false,
          configurable: false
        });
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
    if (mechanicsViewExecution && !submissionPerformed && mechanicsViewRuntime) {
      try {
        mechanicsViewRuntime.releaseExecution(mechanicsViewExecution, { discardedEncoder: true });
      } catch {
        // Preserve the original build/admission error.
      }
    }
    return {
      schema: ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA,
      status: (
        error?.code === 'ERR_SCHROEDER_SPATIAL_ARENA_EXHAUSTED'
        || error?.code === 'ERR_SCHROEDER_MECHANICS_VIEW_ARENA_EXHAUSTED'
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
        mechanicsReleased: liveGeneration?.mechanicsView == null
          || liveGeneration.mechanicsView.released === true,
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

/** Schedule arena release against a fence taken after every generation reader. */
export function releaseSchroederSpatialEpochGenerationAfterQueue(
  generation,
  device
) {
  if (
    generation?.selected !== true
    || generation?.execution?.submitPerformed !== true
    || generation.releaseScheduled === true
  ) return false;
  const releaseDeviceId = webGpuDeviceId(device);
  if (
    releaseDeviceId == null
    || generation.execution.deviceId !== releaseDeviceId
    || !generation.execution.directoryBuffer
    || !webGpuBufferMatchesDevice(generation.execution.directoryBuffer, device)
  ) {
    generation.releaseStatus = 'spatial-epoch-generation-retained-device-mismatch';
    generation.releaseReason = 'Only the generation owner device may fence and release its arena';
    return false;
  }
  const ownerRuntime = generation.runtime || null;
  const mechanicsViewExecution = generation.mechanicsView || null;
  const mechanicsViewRuntime = generation.mechanicsViewRuntime || null;
  const spatialAlreadyReleased = generation.execution.released === true;
  const mechanicsAlreadyReleased = mechanicsViewExecution?.released === true;
  let ownerRuntimeOwnsExecution = spatialAlreadyReleased;
  let ownerRuntimeSubmissionProven = spatialAlreadyReleased;
  let mechanicsRuntimeOwnsExecution = mechanicsViewExecution == null
    || mechanicsAlreadyReleased;
  let mechanicsRuntimeSubmissionProven = mechanicsViewExecution == null
    || mechanicsAlreadyReleased;
  try {
    if (!spatialAlreadyReleased) {
      ownerRuntimeOwnsExecution = ownerRuntime?.ownsExecution?.(
        generation.execution
      ) === true;
      ownerRuntimeSubmissionProven = ownerRuntime?.isExecutionSubmitted?.(
        generation.execution
      ) === true;
    }
    if (mechanicsViewExecution && !mechanicsAlreadyReleased) {
      mechanicsRuntimeOwnsExecution = mechanicsViewRuntime?.ownsExecution?.(
        mechanicsViewExecution
      ) === true;
      mechanicsRuntimeSubmissionProven = mechanicsViewRuntime?.isExecutionSubmitted?.(
        mechanicsViewExecution
      ) === true;
    }
  } catch {
    ownerRuntimeOwnsExecution = false;
    ownerRuntimeSubmissionProven = false;
    mechanicsRuntimeOwnsExecution = false;
    mechanicsRuntimeSubmissionProven = false;
  }
  if (
    (!spatialAlreadyReleased && (
      ownerRuntime?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
    || ownerRuntime.status !== 'schroeder-spatial-epoch-gpu-runtime-ready'
    || ownerRuntime.deviceId !== releaseDeviceId
    || ownerRuntime !== generation.execution.ownerRuntime
    || typeof ownerRuntime.releaseExecutionAfter !== 'function'
    || !ownerRuntimeOwnsExecution
    || !ownerRuntimeSubmissionProven
    ))
    || (mechanicsViewExecution && !mechanicsAlreadyReleased && (
      mechanicsViewRuntime !== mechanicsViewExecution.ownerRuntime
      || mechanicsViewRuntime?.deviceId !== releaseDeviceId
      || typeof mechanicsViewRuntime?.releaseExecutionAfter !== 'function'
      || !mechanicsRuntimeOwnsExecution
      || !mechanicsRuntimeSubmissionProven
    ))
  ) {
    generation.releaseStatus = 'spatial-epoch-generation-retained-owner-mismatch';
    generation.releaseReason = 'Only the exact live runtime owner may fence and release its execution';
    return false;
  }
  if (typeof device?.queue?.onSubmittedWorkDone !== 'function') {
    generation.releaseStatus = 'spatial-epoch-generation-retained-no-fence-api';
    return false;
  }
  let fence;
  let ownerReleasePromise;
  try {
    fence = device.queue.onSubmittedWorkDone();
    if (!fence || typeof fence.then !== 'function') {
      throw new TypeError('queue completion fence must be a thenable');
    }
    const releaseOperations = [];
    if (!spatialAlreadyReleased) {
      releaseOperations.push(
        generation.runtime.releaseExecutionAfter(generation.execution, fence)
      );
    }
    if (mechanicsViewExecution && !mechanicsAlreadyReleased) {
      releaseOperations.push(
        mechanicsViewRuntime.releaseExecutionAfter(mechanicsViewExecution, fence)
      );
    }
    ownerReleasePromise = Promise.allSettled(releaseOperations).then(
      (results) => {
        generation.releaseOperationResults = results.map((result, index) => ({
          owner: index === 0 && !spatialAlreadyReleased
            ? 'spatial-directory'
            : 'compact-mechanics-view',
          status: result.status,
          confirmed: result.status === 'fulfilled' && result.value === true,
          reason: result.status === 'rejected'
            ? (result.reason instanceof Error
                ? result.reason.message
                : String(result.reason))
            : null
        }));
        const bothExecutionsReleased = generation.execution?.released === true
          && (!mechanicsViewExecution || mechanicsViewExecution.released === true);
        if (bothExecutionsReleased) return true;
        const rejected = results.find((result) => result.status === 'rejected');
        if (rejected) throw rejected.reason;
        return results.length === 0
          || results.every((result) => result.value === true);
      }
    );
    if (!ownerReleasePromise || typeof ownerReleasePromise.then !== 'function') {
      throw new TypeError('generation owner release must return a thenable');
    }
  } catch (error) {
    generation.releaseScheduled = false;
    generation.releasePromise = null;
    generation.releaseStatus = 'spatial-epoch-generation-retained-fence-error';
    generation.releaseReason = error instanceof Error ? error.message : String(error);
    return false;
  }
  generation.releaseScheduled = true;
  generation.releaseReason = null;
  generation.releaseStatus = 'spatial-epoch-generation-release-scheduled-after-final-consumer';
  generation.releaseAttemptCount = (generation.releaseAttemptCount ?? 0) + 1;
  const removeLiveGeneration = () => {
    const entry = generation.directRuntimeEntry;
    if (!entry?.liveGenerations) return;
    const generationIndex = entry.liveGenerations.indexOf(generation);
    if (generationIndex >= 0) entry.liveGenerations.splice(generationIndex, 1);
  };
  const markReleaseUnconfirmed = (reason) => {
    generation.releaseScheduled = false;
    generation.releasePromise = null;
    generation.releaseFailureCount = (generation.releaseFailureCount ?? 0) + 1;
    generation.releaseStatus = 'spatial-epoch-generation-release-unconfirmed';
    generation.releaseReason = reason;
    return false;
  };
  const releaseAttemptPromise = Promise.resolve(ownerReleasePromise)
    .then((released) => {
      if (
        released === true
        || (
          generation.execution?.released === true
          && (!mechanicsViewExecution || mechanicsViewExecution.released === true)
        )
      ) {
        generation.releaseStatus =
          'spatial-epoch-generation-released-after-final-consumer';
        generation.releaseReason = null;
        removeLiveGeneration();
        return true;
      }
      return markReleaseUnconfirmed(
        'generation owner did not confirm spatial epoch release'
      );
    }, (error) => {
      if (
        generation.execution?.released === true
        && (!mechanicsViewExecution || mechanicsViewExecution.released === true)
      ) {
        generation.releaseStatus =
          'spatial-epoch-generation-released-after-final-consumer';
        generation.releaseReason = null;
        removeLiveGeneration();
        return true;
      }
      return markReleaseUnconfirmed(
        error instanceof Error ? error.message : String(error)
      );
    });
  generation.releasePromise = releaseAttemptPromise;
  return true;
}
