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
import { createWebGpuStableRadixScanUnique } from '../webgpuRadixScanUnique.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId,
  webGpuDeviceMismatchInfo
} from './sphGpuDeviceIdentity.js';

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
const directSpatialEpochRuntimeCache = new WeakMap();
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
    activeNodeBuffer,
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
  u32(0);
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
    activeNodeBuffer,
    sourceCount,
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
    if (!activeNodeBuffer) {
      throw new TypeError('spatial epoch encoding requires activeNodeBuffer');
    }
    if (!webGpuBufferMatchesDevice(activeNodeBuffer, device)) {
      const mismatch = webGpuDeviceMismatchInfo({ buffer: activeNodeBuffer, device });
      const error = new Error('activeNodeBuffer belongs to a different WebGPU device');
      error.code = 'ERR_SCHROEDER_SPATIAL_DEVICE_MISMATCH';
      Object.assign(error, mismatch);
      throw error;
    }
    const resolvedSourceCount = nonNegativeInteger(
      sourceCount,
      'sourceCount',
      resolvedMaxSourceCount
    );
    const requiredActiveNodeBytes = resolvedSourceCount
      * ACTIVE_NODE_STRIDE_FLOATS
      * Float32Array.BYTES_PER_ELEMENT;
    if (
      Number.isFinite(Number(activeNodeBuffer.size))
      && Number(activeNodeBuffer.size) < requiredActiveNodeBytes
    ) {
      throw new RangeError(
        `activeNodeBuffer has ${activeNodeBuffer.size} bytes; ${requiredActiveNodeBytes} required`
      );
    }
    const activeNodeBindingSize = Math.min(
      Number.isFinite(Number(activeNodeBuffer.size))
        ? Number(activeNodeBuffer.size)
        : activeNodeByteLength,
      activeNodeByteLength
    );
    if (activeNodeBindingSize > maxStorageBufferBindingSize) {
      throw new RangeError(
        `active-node binding requires ${activeNodeBindingSize} bytes beyond `
        + 'maxStorageBufferBindingSize'
      );
    }
    const resolvedSourceFamilyId = sourceFamilyId == null
      ? fnv1a32(sourceFamily)
      : sourceFamilyId;
    const plan = createSchroederSpatialEpochBuildPlan({
      sourceCount: resolvedSourceCount,
      sourceCapacity: resolvedMaxSourceCount,
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
            activeNodeBuffer,
            activeNodeBindingSize
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
      Object.defineProperty(execution, 'activeNodeBuffer', {
        value: activeNodeBuffer,
        enumerable: true,
        writable: false,
        configurable: false
      });
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
        activeNodeBuffer,
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
      && execution.activeNodeBuffer === ownership.activeNodeBuffer
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
      && webGpuBufferMatchesDevice(ownership.activeNodeBuffer, device)
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
    capacity,
    generation: 0,
    buildCount: 0,
    liveGenerations: []
  };
  runtimes.set(capacity, entry);
  return { entry, cacheHit: false };
}

/**
 * Build one retained, same-device directory generation for a direct SS step.
 * Submission happens here so every later queue submission observes the
 * completed directory in WebGPU queue order.  The caller must schedule release
 * only after the final consumer has submitted.
 */
export function runSchroederSpatialEpochGenerationWebGpu({
  device,
  activeNodeList,
  particleCount = null,
  laneId = 'direct-schroeder-scene',
  sourceFamily = 'schroeder-active-node-particles',
  allowPhaseVolumeOverlay = false
} = {}) {
  if (!device?.createCommandEncoder || !device?.queue?.submit) {
    throw new TypeError(
      'runSchroederSpatialEpochGenerationWebGpu requires a WebGPU-like device and queue'
    );
  }
  let source = resolveSchroederSpatialDirectoryActiveNodeSource(activeNodeList, {
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
      activeNodeList,
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
  let cache = null;
  let execution = null;
  let submissionPerformed = false;
  try {
    cache = directSpatialEpochRuntime(device, source.sourceCount);
    const { entry, cacheHit } = cache;
    const generationId = (entry.generation % 0xffff_fffe) + 1;
    const encoder = device.createCommandEncoder({
      label: 'ulg-schroeder-direct-spatial-epoch-build'
    });
    execution = entry.runtime.encode(encoder, {
      activeNodeBuffer: source.activeNodeBuffer,
      sourceCount: source.sourceCount,
      sortMode: 'lexicographic-u32x5',
      generationId,
      leaseToken: generationId,
      sourceFamily,
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
    device.queue.submit([encoder.finish()]);
    submissionPerformed = true;
    if (entry.runtime.markExecutionSubmitted(execution) !== true) {
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
    if (execution && !submissionPerformed && cache?.entry?.runtime) {
      try {
        cache.entry.runtime.releaseExecution(execution, { discardedEncoder: true });
      } catch {
        // Preserve the original build/admission error.
      }
    }
    return {
      schema: ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA,
      status: error?.code === 'ERR_SCHROEDER_SPATIAL_ARENA_EXHAUSTED'
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
      releaseScheduled: false,
      runtimeCapacity: cache?.entry?.capacity ?? null,
      arenaCapacity: cache?.entry?.runtime?.arenaCount ?? null,
      runtimeCacheHit: Boolean(cache?.cacheHit)
    };
  }
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
      const error = new Error(
        'spatial epoch arena owner release completed without confirming retirement'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_ARENA_BACKPRESSURE_RELEASE_FAILED';
      error.arenaCapacity = entry.runtime.arenaCount;
      error.liveGenerationCount = entry.liveGenerations.length;
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
  let ownerRuntimeOwnsExecution = false;
  let ownerRuntimeSubmissionProven = false;
  try {
    ownerRuntimeOwnsExecution = ownerRuntime?.ownsExecution?.(
      generation.execution
    ) === true;
    ownerRuntimeSubmissionProven = ownerRuntime?.isExecutionSubmitted?.(
      generation.execution
    ) === true;
  } catch {
    ownerRuntimeOwnsExecution = false;
    ownerRuntimeSubmissionProven = false;
  }
  if (
    ownerRuntime?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
    || ownerRuntime.status !== 'schroeder-spatial-epoch-gpu-runtime-ready'
    || ownerRuntime.deviceId !== releaseDeviceId
    || ownerRuntime !== generation.execution.ownerRuntime
    || typeof ownerRuntime.releaseExecutionAfter !== 'function'
    || !ownerRuntimeOwnsExecution
    || !ownerRuntimeSubmissionProven
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
    ownerReleasePromise = generation.runtime
      .releaseExecutionAfter(generation.execution, fence);
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
      if (released === true || generation.execution?.released === true) {
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
      return markReleaseUnconfirmed(
        error instanceof Error ? error.message : String(error)
      );
    });
  generation.releasePromise = releaseAttemptPromise;
  return true;
}
