import {
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
  createSchroederSpatialActiveSourceFingerprint,
  createSchroederSpatialActiveSourceViewLayout
} from '../../../ulg-gpu-abi/src/schroederSpatialActiveSourceView.js';
import {
  createSchroederSpatialActiveSourceViewWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialActiveSourceViewWgsl.js';
import {
  SCHROEDER_SPATIAL_QUERY_GEOMETRY_GENERIC,
  SCHROEDER_SPATIAL_QUERY_GEOMETRY_SINGLE_CHART_POW2
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import { createWebGpuU32ExclusiveScan } from '../webgpuRadixScanUnique.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId,
  webGpuDeviceMismatchInfo
} from './sphGpuDeviceIdentity.js';

export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PARAMS_BYTES = 192;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PARAMS_BUFFER_BYTES = 256;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_EVIDENCE_WORDS = 16;
export const SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ARENA_COUNT_DEFAULT = 3;

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
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

function exactI32(value, label) {
  const number = Number(value);
  if (
    !Number.isInteger(number)
    || number < -0x8000_0000
    || number > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must be an i32`);
  }
  return number | 0;
}

function finiteF32(value, label, { positive = false } = {}) {
  const number = Math.fround(Number(value));
  if (!Number.isFinite(number) || (positive && !(number > 0))) {
    throw new RangeError(
      `${label} must be ${positive ? 'positive and ' : ''}finite as f32`
    );
  }
  return number;
}

function checkedBytes(elements, elementBytes, label) {
  const byteLength = elements * elementBytes;
  if (!Number.isSafeInteger(byteLength) || byteLength < UINT32_BYTES) {
    throw new RangeError(`${label} byte length is not safely addressable`);
  }
  return byteLength;
}

function fnv1a32(value) {
  let hash = 0x811c_9dc5;
  for (const character of String(value ?? '')) {
    hash ^= character.codePointAt(0) & 0xff;
    hash = Math.imul(hash, 0x0100_0193) >>> 0;
  }
  return hash >>> 0;
}

function assertDevice(device) {
  if (
    !device?.queue?.writeBuffer
    || !device?.createBuffer
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroup
  ) {
    throw new TypeError(
      'Schroeder active-source view requires a WebGPU-like device'
    );
  }
}

function assertEncoder(encoder) {
  if (!encoder?.clearBuffer || !encoder?.beginComputePass) {
    throw new TypeError(
      'Schroeder active-source view encoding requires a caller-owned command encoder'
    );
  }
}

function dispatchShapeForInvocationCount(
  invocationCount,
  maxComputeWorkgroupsPerDimension
) {
  const count = nonNegativeInteger(invocationCount, 'invocationCount');
  if (count === 0) return [0, 0, 1];
  const groupCount = Math.ceil(
    count / SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_WORKGROUP_SIZE
  );
  const x = Math.min(groupCount, maxComputeWorkgroupsPerDimension);
  const y = Math.ceil(groupCount / x);
  if (y > maxComputeWorkgroupsPerDimension) {
    throw new RangeError(
      `active-source dispatch requires ${groupCount} workgroups beyond `
      + `${maxComputeWorkgroupsPerDimension}x${maxComputeWorkgroupsPerDimension}`
    );
  }
  return [x, y, 1];
}

function encodeDispatch(
  encoder,
  pipeline,
  bindGroup,
  dispatch,
  label,
  timestampProfiler = null,
  metadata = {}
) {
  if (dispatch.some((dimension) => dimension === 0)) return 0;
  const descriptor = typeof timestampProfiler?.beginComputePassDescriptor === 'function'
    && timestampProfiler.active !== false
    ? timestampProfiler.beginComputePassDescriptor(label, metadata) || { label }
    : { label };
  const pass = encoder.beginComputePass(descriptor);
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...dispatch);
  pass.end();
  return 1;
}

function normalizeQueryProfile(profile) {
  if (profile?.ready !== true) {
    return Object.freeze({
      queryGeometryMode: SCHROEDER_SPATIAL_QUERY_GEOMETRY_GENERIC,
      queryChartId: 0,
      queryMinLevel: 0,
      queryMaxLevel: 0,
      queryBaseGridSpacingM: 0
    });
  }
  const queryChartId = nonNegativeInteger(
    profile.chartId,
    'exactNearQueryProfile.chartId',
    0x00ff_ffff
  );
  const queryMinLevel = exactI32(
    profile.minLevel,
    'exactNearQueryProfile.minLevel'
  );
  const queryMaxLevel = exactI32(
    profile.maxLevel,
    'exactNearQueryProfile.maxLevel'
  );
  if (queryMaxLevel < queryMinLevel || queryMaxLevel - queryMinLevel >= 64) {
    throw new RangeError(
      'exactNearQueryProfile must contain between one and 64 ordered levels'
    );
  }
  return Object.freeze({
    queryGeometryMode: SCHROEDER_SPATIAL_QUERY_GEOMETRY_SINGLE_CHART_POW2,
    queryChartId,
    queryMinLevel,
    queryMaxLevel,
    queryBaseGridSpacingM: finiteF32(
      profile.baseGridSpacingM,
      'exactNearQueryProfile.baseGridSpacingM',
      { positive: true }
    )
  });
}

function paramsData({
  physicalSourceCount,
  physicalSourceCapacity,
  activeSourceCapacity,
  sourceRowLayoutId,
  generationId,
  deviceOrdinal,
  laneOrdinal,
  leaseToken,
  sourceFamilyId,
  storageGeneration,
  physicsTick,
  physicsSubstep,
  positionEpoch,
  topologyEpoch,
  chartEpoch,
  levelEpoch,
  supportEpoch,
  buildOrdinal,
  sourceFingerprint,
  classifyDispatchX,
  scatterDispatchX,
  dispatchXLimit,
  layout,
  queryProfile,
  capacityTierOrdinal,
  clearedWords
}) {
  const buffer = new ArrayBuffer(
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PARAMS_BYTES
  );
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
  u32(physicalSourceCount);
  u32(physicalSourceCapacity);
  u32(activeSourceCapacity);
  u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS);
  u32(sourceRowLayoutId);
  u32(generationId);
  u32(deviceOrdinal);
  u32(laneOrdinal);
  u32(leaseToken);
  u32(sourceFamilyId);
  u32(storageGeneration);
  u32(physicsTick);
  u32(physicsSubstep);
  u32(positionEpoch);
  u32(topologyEpoch);
  u32(chartEpoch);
  u32(levelEpoch);
  u32(supportEpoch);
  u32(buildOrdinal);
  u32(sourceFingerprint);
  u32(classifyDispatchX);
  u32(scatterDispatchX);
  u32(dispatchXLimit);
  u32(layout.headerWords);
  u32(layout.activeToPhysicalOffsetWords);
  u32(layout.physicalToActiveOffsetWords);
  u32(layout.wordLength);
  u32(queryProfile.queryGeometryMode);
  u32(queryProfile.queryChartId);
  i32(queryProfile.queryMinLevel);
  i32(queryProfile.queryMaxLevel);
  f32(queryProfile.queryBaseGridSpacingM);
  u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_WORKGROUP_SIZE);
  u32(64);
  u32(27);
  u32(capacityTierOrdinal);
  u32(layout.physicalSourceCapacity);
  u32(layout.physicalSourceCapacity);
  u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_EVIDENCE_WORDS);
  u32(clearedWords);
  while (offset < SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PARAMS_BYTES) u32(0);
  if (offset !== SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PARAMS_BYTES) {
    throw new Error(
      `active-source params ABI packed ${offset} bytes, expected `
      + `${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PARAMS_BYTES}`
    );
  }
  return new Uint8Array(buffer);
}

export function createSchroederSpatialActiveSourceViewGpu(device, {
  maxPhysicalSourceCount,
  maxSourceCount = maxPhysicalSourceCount,
  activeSourceCapacity = maxPhysicalSourceCount ?? maxSourceCount,
  arenaCount = SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ARENA_COUNT_DEFAULT,
  label = 'ulg-schroeder-spatial-active-source-view'
} = {}) {
  assertDevice(device);
  const resolvedPhysicalCapacity = positiveInteger(
    maxPhysicalSourceCount ?? maxSourceCount,
    'maxPhysicalSourceCount',
    0x0100_0000
  );
  const resolvedActiveCapacity = positiveInteger(
    activeSourceCapacity ?? resolvedPhysicalCapacity,
    'activeSourceCapacity',
    resolvedPhysicalCapacity
  );
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const layout = createSchroederSpatialActiveSourceViewLayout({
    physicalSourceCapacity: resolvedPhysicalCapacity,
    activeSourceCapacity: resolvedActiveCapacity
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
  const maxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension',
    0xffff_ffff
  );
  if (
    maxUniformBufferBindingSize
      < SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PARAMS_BYTES
  ) {
    throw new RangeError(
      'active-source params exceed maxUniformBufferBindingSize'
    );
  }
  dispatchShapeForInvocationCount(
    resolvedPhysicalCapacity,
    maxComputeWorkgroupsPerDimension
  );
  const sourceCapacityBytes = checkedBytes(
    resolvedPhysicalCapacity
      * SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS,
    Float32Array.BYTES_PER_ELEMENT,
    'active-source input'
  );
  const mapScratchBytes = checkedBytes(
    resolvedPhysicalCapacity,
    UINT32_BYTES,
    'active-source scratch'
  );
  for (const [role, byteLength] of [
    ['active-source input', sourceCapacityBytes],
    ['active-source public view', layout.byteLength],
    ['active-source scratch', mapScratchBytes]
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

  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: createSchroederSpatialActiveSourceViewWgsl(layout)
  });
  const classifyPipeline = device.createComputePipeline({
    label: `${label}-classify-pipeline`,
    layout: 'auto',
    compute: { module, entryPoint: 'classify_active_sources' }
  });
  const scatterPipeline = device.createComputePipeline({
    label: `${label}-scatter-pipeline`,
    layout: 'auto',
    compute: { module, entryPoint: 'scatter_active_sources' }
  });
  const finalizePipeline = device.createComputePipeline({
    label: `${label}-finalize-pipeline`,
    layout: 'auto',
    compute: { module, entryPoint: 'finalize_active_source_view' }
  });
  const deviceId = webGpuDeviceId(device);
  const defaultDeviceOrdinal = fnv1a32(deviceId);
  const createOwnedBuffer = (bufferLabel, size, usage) => tagWebGpuBufferDevice(
    device.createBuffer({ label: bufferLabel, size, usage }),
    device
  );
  let destroyed = false;
  let deviceLossObserved = false;
  let executionSerial = 0;
  let runtimeApi = null;
  const liveExecutions = new WeakSet();
  const submittedExecutions = new WeakSet();
  const releasedExecutions = new WeakSet();
  const releaseInFlightExecutions = new WeakSet();
  const executionOwnership = new WeakMap();

  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => {
    const arenaLabel = `${label}-arena-${arenaIndex}`;
    return {
      arenaIndex,
      label: arenaLabel,
      inUse: false,
      retired: false,
      token: null,
      paramsBuffer: createOwnedBuffer(
        `${arenaLabel}-params`,
        SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PARAMS_BUFFER_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      activeSourceViewBuffer: createOwnedBuffer(
        `${arenaLabel}-view`,
        layout.byteLength,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
          | GPU_BUFFER_USAGE.INDIRECT
      ),
      flagsBuffer: createOwnedBuffer(
        `${arenaLabel}-flags`,
        mapScratchBytes,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      prefixBuffer: createOwnedBuffer(
        `${arenaLabel}-prefix`,
        mapScratchBytes,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      evidenceBuffer: createOwnedBuffer(
        `${arenaLabel}-evidence`,
        SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_EVIDENCE_WORDS * UINT32_BYTES,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      scan: createWebGpuU32ExclusiveScan(device, {
        maxElementCount: resolvedPhysicalCapacity,
        label: `${arenaLabel}-scan`,
        maxComputeWorkgroupsPerDimension,
        retainParamsBuffer: true,
        retainedParamsSlotCount: 1
      }),
      bindGroupsBySource: new WeakMap(),
      destroyedBuffers: new Set()
    };
  });

  const directEntries = (arena) => [
    { role: 'active-source-params', buffer: arena.paramsBuffer },
    { role: 'active-source-view', buffer: arena.activeSourceViewBuffer },
    { role: 'active-source-flags', buffer: arena.flagsBuffer },
    { role: 'active-source-prefix', buffer: arena.prefixBuffer },
    { role: 'active-source-evidence', buffer: arena.evidenceBuffer }
  ];
  const allocationEntriesForArena = (arena) => [
    ...directEntries(arena).map((entry) => ({
      ...entry,
      arenaIndex: arena.arenaIndex
    })),
    ...arena.scan.allocationEntries().map((entry) => ({
      ...entry,
      role: `active-source-${entry.role}`,
      arenaIndex: arena.arenaIndex
    }))
  ];
  const retainedGpuBufferBytesPerArena = Object.freeze(arenas.map((arena) => (
    allocationEntriesForArena(arena).reduce((sum, entry) => {
      const size = Number(entry.buffer?.size);
      if (!Number.isSafeInteger(size) || size < 0) {
        throw new RangeError(`${entry.role} does not expose a safe buffer size`);
      }
      return sum + size;
    }, 0)
  )));
  const retainedGpuBufferBytes = retainedGpuBufferBytesPerArena.reduce(
    (sum, size) => sum + size,
    0
  );

  function acquireArena(requestedArenaIndex = null) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (deviceLossObserved) {
      const error = new Error(`${label} observed device loss`);
      error.code = 'ERR_SCHROEDER_SPATIAL_DEVICE_LOST';
      throw error;
    }
    const arena = requestedArenaIndex == null
      ? arenas.find((candidate) => !candidate.inUse && !candidate.retired) ?? null
      : arenas[nonNegativeInteger(
          requestedArenaIndex,
          'arenaIndex',
          resolvedArenaCount - 1
        )];
    if (!arena || arena.inUse || arena.retired) {
      const error = new Error(`${label} active-source arena is exhausted`);
      error.code = 'ERR_SCHROEDER_ACTIVE_SOURCE_VIEW_ARENA_EXHAUSTED';
      error.arenaCapacity = resolvedArenaCount;
      throw error;
    }
    executionSerial += 1;
    arena.inUse = true;
    arena.token = Object.freeze({
      serial: executionSerial,
      arenaIndex: arena.arenaIndex
    });
    return arena;
  }

  function releaseArena(arena, token, { retired = false } = {}) {
    if (!arena?.inUse || arena.token !== token) return false;
    arena.inUse = false;
    arena.token = null;
    arena.retired = retired;
    return true;
  }

  function bindGroupsForSource(arena, sourceBuffer, sourceBindingSize) {
    let bySize = arena.bindGroupsBySource.get(sourceBuffer);
    if (!bySize) {
      bySize = new Map();
      arena.bindGroupsBySource.set(sourceBuffer, bySize);
    }
    const cached = bySize.get(sourceBindingSize);
    if (cached) return { ...cached, reused: true };
    const entries = [
      {
        binding: 0,
        resource: { buffer: sourceBuffer, offset: 0, size: sourceBindingSize }
      },
      { binding: 1, resource: { buffer: arena.flagsBuffer } },
      { binding: 2, resource: { buffer: arena.prefixBuffer } },
      { binding: 3, resource: { buffer: arena.activeSourceViewBuffer } },
      { binding: 4, resource: { buffer: arena.evidenceBuffer } },
      {
        binding: 5,
        resource: {
          buffer: arena.paramsBuffer,
          offset: 0,
          size: SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PARAMS_BYTES
        }
      }
    ];
    const created = {
      classify: device.createBindGroup({
        label: `${arena.label}-classify-bind-group`,
        layout: classifyPipeline.getBindGroupLayout(0),
        entries
      }),
      scatter: device.createBindGroup({
        label: `${arena.label}-scatter-bind-group`,
        layout: scatterPipeline.getBindGroupLayout(0),
        entries
      }),
      finalize: device.createBindGroup({
        label: `${arena.label}-finalize-bind-group`,
        layout: finalizePipeline.getBindGroupLayout(0),
        entries
      })
    };
    bySize.set(sourceBindingSize, created);
    return { ...created, reused: false };
  }

  function publicExecutionMatchesOwnership(execution, ownership) {
    return execution?.ownerRuntime === runtimeApi
      && execution.arenaIndex === ownership.arena.arenaIndex
      && execution.arenaGeneration === ownership.token.serial
      && execution.sourceBuffer === ownership.sourceBuffer
      && execution.activeSourceViewBuffer === ownership.arena.activeSourceViewBuffer
      && execution.flagsBuffer === ownership.arena.flagsBuffer
      && execution.prefixBuffer === ownership.arena.prefixBuffer
      && execution.evidenceBuffer === ownership.arena.evidenceBuffer;
  }

  function ownershipFor(execution, { allowInFlight = false } = {}) {
    if (
      !execution
      || execution.schema !== ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA
      || releasedExecutions.has(execution)
    ) return null;
    const ownership = executionOwnership.get(execution);
    if (
      !ownership
      || !liveExecutions.has(execution)
      || (!allowInFlight && releaseInFlightExecutions.has(execution))
      || !publicExecutionMatchesOwnership(execution, ownership)
      || ownership.arena.inUse !== true
      || ownership.arena.token !== ownership.token
    ) {
      const error = new Error(
        'active-source execution does not belong to this runtime'
      );
      error.code = 'ERR_SCHROEDER_ACTIVE_SOURCE_VIEW_FOREIGN_EXECUTION';
      throw error;
    }
    return ownership;
  }

  function encode(encoder, {
    sourceBuffer,
    physicalSourceCount,
    sourceCount = physicalSourceCount,
    sourceRowLayoutId =
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    generationId = 1,
    deviceOrdinal = defaultDeviceOrdinal,
    laneOrdinal = 0,
    leaseToken = generationId,
    sourceFamily = 'schroeder-level-assignment-particles',
    sourceFamilyId = null,
    storageGeneration = 0,
    physicsTick = 0,
    physicsSubstep = 0,
    positionEpoch = 0,
    topologyEpoch = 0,
    chartEpoch = 0,
    levelEpoch = 0,
    supportEpoch = 0,
    buildOrdinal = generationId,
    exactNearQueryProfile = null,
    capacityTierOrdinal = 0,
    arenaIndex = null,
    timestampProfiler = null,
    timestampMetadata = {}
  } = {}) {
    assertEncoder(encoder);
    if (!sourceBuffer) {
      throw new TypeError('active-source encoding requires sourceBuffer');
    }
    if (!webGpuBufferMatchesDevice(sourceBuffer, device)) {
      const error = new Error('active-source sourceBuffer belongs to another device');
      error.code = 'ERR_SCHROEDER_ACTIVE_SOURCE_VIEW_DEVICE_MISMATCH';
      Object.assign(error, webGpuDeviceMismatchInfo({ buffer: sourceBuffer, device }));
      throw error;
    }
    const resolvedSourceCount = positiveInteger(
      physicalSourceCount ?? sourceCount,
      'physicalSourceCount',
      resolvedPhysicalCapacity
    );
    const requiredSourceBytes = checkedBytes(
      resolvedSourceCount
        * SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS,
      Float32Array.BYTES_PER_ELEMENT,
      'active-source input'
    );
    if (
      Number.isFinite(Number(sourceBuffer.size))
      && Number(sourceBuffer.size) < requiredSourceBytes
    ) {
      throw new RangeError(
        `sourceBuffer has ${sourceBuffer.size} bytes; ${requiredSourceBytes} required`
      );
    }
    if (requiredSourceBytes > maxStorageBufferBindingSize) {
      throw new RangeError(
        'active-source input exceeds maxStorageBufferBindingSize'
      );
    }
    const identity = Object.freeze({
      generationId: nonNegativeInteger(generationId, 'generationId'),
      deviceOrdinal: nonNegativeInteger(deviceOrdinal, 'deviceOrdinal'),
      laneOrdinal: nonNegativeInteger(laneOrdinal, 'laneOrdinal'),
      leaseToken: nonNegativeInteger(leaseToken, 'leaseToken'),
      sourceFamilyId: sourceFamilyId == null
        ? fnv1a32(sourceFamily)
        : nonNegativeInteger(sourceFamilyId, 'sourceFamilyId'),
      storageGeneration: nonNegativeInteger(
        storageGeneration,
        'storageGeneration'
      ),
      physicsTick: nonNegativeInteger(physicsTick, 'physicsTick'),
      physicsSubstep: nonNegativeInteger(physicsSubstep, 'physicsSubstep'),
      positionEpoch: nonNegativeInteger(positionEpoch, 'positionEpoch'),
      topologyEpoch: nonNegativeInteger(topologyEpoch, 'topologyEpoch'),
      chartEpoch: nonNegativeInteger(chartEpoch, 'chartEpoch'),
      levelEpoch: nonNegativeInteger(levelEpoch, 'levelEpoch'),
      supportEpoch: nonNegativeInteger(supportEpoch, 'supportEpoch'),
      buildOrdinal: nonNegativeInteger(buildOrdinal, 'buildOrdinal')
    });
    const resolvedSourceRowLayoutId = nonNegativeInteger(
      sourceRowLayoutId,
      'sourceRowLayoutId'
    );
    const queryProfile = normalizeQueryProfile(exactNearQueryProfile);
    const resolvedCapacityTierOrdinal = nonNegativeInteger(
      capacityTierOrdinal,
      'capacityTierOrdinal'
    );
    const sourceFingerprint = createSchroederSpatialActiveSourceFingerprint({
      ...identity,
      physicalSourceCount: resolvedSourceCount,
      physicalSourceCapacity: resolvedPhysicalCapacity,
      activeSourceCapacity: resolvedActiveCapacity,
      sourceRowLayoutId: resolvedSourceRowLayoutId,
      sourceRowStrideFloats:
        SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS,
      ...queryProfile
    });
    const classifyDispatch = dispatchShapeForInvocationCount(
      resolvedPhysicalCapacity,
      maxComputeWorkgroupsPerDimension
    );
    const scatterDispatch = dispatchShapeForInvocationCount(
      resolvedSourceCount,
      maxComputeWorkgroupsPerDimension
    );
    const clearedWords =
      SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS
      + resolvedActiveCapacity
      + resolvedPhysicalCapacity
      + SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_EVIDENCE_WORDS;
    const arena = acquireArena(arenaIndex);
    const token = arena.token;
    let preparedScan = null;
    try {
      device.queue.writeBuffer(arena.paramsBuffer, 0, paramsData({
        physicalSourceCount: resolvedSourceCount,
        physicalSourceCapacity: resolvedPhysicalCapacity,
        activeSourceCapacity: resolvedActiveCapacity,
        sourceRowLayoutId: resolvedSourceRowLayoutId,
        ...identity,
        sourceFingerprint,
        classifyDispatchX: classifyDispatch[0],
        scatterDispatchX: scatterDispatch[0],
        dispatchXLimit: maxComputeWorkgroupsPerDimension,
        layout,
        queryProfile,
        capacityTierOrdinal: resolvedCapacityTierOrdinal,
        clearedWords
      }));
      encoder.clearBuffer(
        arena.activeSourceViewBuffer,
        0,
        SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS * UINT32_BYTES
      );
      encoder.clearBuffer(arena.evidenceBuffer);
      const bindGroups = bindGroupsForSource(
        arena,
        sourceBuffer,
        requiredSourceBytes
      );
      const metadata = {
        ...timestampMetadata,
        generationId: identity.generationId,
        physicalSourceCount: resolvedSourceCount,
        physicalSourceCapacity: resolvedPhysicalCapacity,
        activeSourceCapacity: resolvedActiveCapacity,
        arenaIndex: arena.arenaIndex
      };
      const classifyDispatchCount = encodeDispatch(
        encoder,
        classifyPipeline,
        bindGroups.classify,
        classifyDispatch,
        `${label}Classify`,
        timestampProfiler,
        metadata
      );
      preparedScan = arena.scan.prepare({
        inputBuffer: arena.flagsBuffer,
        outputBuffer: arena.prefixBuffer,
        elementCount: resolvedSourceCount,
        retainedParamsSlotIndex: 0
      });
      arena.scan.encodePrepared(encoder, preparedScan, {
        timestampProfiler,
        timestampMetadata: metadata,
        labelPrefix: `${label}ActivePrefix`
      });
      const scatterDispatchCount = encodeDispatch(
        encoder,
        scatterPipeline,
        bindGroups.scatter,
        scatterDispatch,
        `${label}Scatter`,
        timestampProfiler,
        metadata
      );
      const finalizeDispatchCount = encodeDispatch(
        encoder,
        finalizePipeline,
        bindGroups.finalize,
        [1, 1, 1],
        `${label}Finalize`,
        timestampProfiler,
        metadata
      );
      const execution = {
        schema: ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
        status: 'schroeder-spatial-active-source-view-gpu-encoded',
        ready: true,
        selected: true,
        submitPerformed: false,
        sourceBuffer,
        activeSourceViewBuffer: arena.activeSourceViewBuffer,
        flagsBuffer: arena.flagsBuffer,
        prefixBuffer: arena.prefixBuffer,
        evidenceBuffer: arena.evidenceBuffer,
        layout,
        physicalSourceCount: resolvedSourceCount,
        physicalSourceCapacity: resolvedPhysicalCapacity,
        activeSourceCapacity: resolvedActiveCapacity,
        sourceRowLayoutId: resolvedSourceRowLayoutId,
        sourceRowStrideFloats:
          SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS,
        ...identity,
        sourceFamily,
        sourceFingerprint,
        queryGeometryMode: queryProfile.queryGeometryMode,
        queryChartId: queryProfile.queryChartId,
        queryMinLevel: queryProfile.queryMinLevel,
        queryMaxLevel: queryProfile.queryMaxLevel,
        queryBaseGridSpacingM: queryProfile.queryBaseGridSpacingM,
        capacityTierOrdinal: resolvedCapacityTierOrdinal,
        activeDispatchOffsetBytes: layout.activeDispatchOffsetBytes,
        candidateDispatchOffsetBytes: layout.candidateDispatchOffsetBytes,
        physicalDispatchOffsetBytes: layout.physicalDispatchOffsetBytes,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        classifyDispatchWorkgroups: Object.freeze([...classifyDispatch]),
        scatterDispatchWorkgroups: Object.freeze([...scatterDispatch]),
        encodedDispatchCount: classifyDispatchCount
          + preparedScan.encodedDispatchCount
          + scatterDispatchCount
          + finalizeDispatchCount,
        encodedComputePassCount: classifyDispatchCount
          + preparedScan.encodedComputePassCount
          + scatterDispatchCount
          + finalizeDispatchCount,
        paramsWriteCount: 1 + (preparedScan.paramsWriteCount ?? 0),
        bindGroupCacheHit: bindGroups.reused,
        clearedWordCount: clearedWords,
        retainedGpuBufferBytes:
          retainedGpuBufferBytesPerArena[arena.arenaIndex],
        retainedGpuBufferBytesAllArenas: retainedGpuBufferBytes,
        gpuBufferCreationCountDuringEncode: 0,
        readbackPerformed: false,
        submissionOwnership: 'caller',
        releaseRequirement:
          'after-caller-submission-fence-or-discarded-encoder'
      };
      Object.defineProperty(execution, 'ownerRuntime', {
        value: runtimeApi,
        enumerable: false,
        writable: false,
        configurable: false
      });
      Object.defineProperty(execution, 'released', {
        get() { return releasedExecutions.has(execution); },
        enumerable: true,
        configurable: false
      });
      const ownership = Object.freeze({
        arena,
        token,
        preparedScan,
        sourceBuffer
      });
      executionOwnership.set(execution, ownership);
      liveExecutions.add(execution);
      return execution;
    } catch (error) {
      if (preparedScan) {
        try {
          arena.scan.releasePrepared(preparedScan, { discardedEncoder: true });
        } catch {
          // Preserve the original encode failure.
        }
      }
      releaseArena(arena, token);
      throw error;
    }
  }

  function ownsExecution(execution) {
    if (
      !liveExecutions.has(execution)
      || releasedExecutions.has(execution)
      || releaseInFlightExecutions.has(execution)
    ) return false;
    try {
      return ownershipFor(execution) != null
        && webGpuBufferMatchesDevice(execution.activeSourceViewBuffer, device)
        && webGpuBufferMatchesDevice(execution.sourceBuffer, device);
    } catch {
      return false;
    }
  }

  function markExecutionSubmitted(execution) {
    const ownership = ownershipFor(execution);
    if (!ownership || submittedExecutions.has(execution)) return false;
    submittedExecutions.add(execution);
    execution.submitPerformed = true;
    return true;
  }

  function isExecutionSubmitted(execution) {
    return submittedExecutions.has(execution)
      && ownsExecution(execution)
      && execution.submitPerformed === true;
  }

  function finalizeRelease(execution, ownership, {
    scanReleased = false,
    deviceLost = false
  } = {}) {
    if (releasedExecutions.has(execution)) return true;
    if (deviceLost) {
      for (const { buffer } of directEntries(ownership.arena)) {
        if (ownership.arena.destroyedBuffers.has(buffer)) continue;
        buffer.destroy?.();
        ownership.arena.destroyedBuffers.add(buffer);
      }
      ownership.arena.scan.destroy();
    } else if (!scanReleased) {
      ownership.arena.scan.releasePrepared(
        ownership.preparedScan,
        { discardedEncoder: true }
      );
    }
    const released = releaseArena(ownership.arena, ownership.token, {
      retired: deviceLost
    });
    if (released) {
      releasedExecutions.add(execution);
      submittedExecutions.delete(execution);
      releaseInFlightExecutions.delete(execution);
      liveExecutions.delete(execution);
      executionOwnership.delete(execution);
    }
    return released;
  }

  function releaseExecution(execution, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError(
        'releaseExecution is only for a discarded encoder; use '
        + 'releaseExecutionAfter after submission'
      );
    }
    if (releasedExecutions.has(execution)) return false;
    if (submittedExecutions.has(execution)) {
      const error = new Error(
        'submitted active-source execution requires a queue fence'
      );
      error.code =
        'ERR_SCHROEDER_ACTIVE_SOURCE_VIEW_SUBMITTED_EXECUTION_REQUIRES_FENCE';
      throw error;
    }
    const ownership = ownershipFor(execution);
    return finalizeRelease(execution, ownership);
  }

  function canReleaseExecutionQueueOrdered(execution) {
    try {
      if (releasedExecutions.has(execution)) return false;
      const ownership = ownershipFor(execution);
      return Boolean(
        submittedExecutions.has(execution)
        && !releaseInFlightExecutions.has(execution)
        && ownership.arena.scan.canReleasePreparedQueueOrdered?.(
          ownership.preparedScan
        ) === true
      );
    } catch {
      return false;
    }
  }

  function releaseExecutionQueueOrdered(execution) {
    if (!canReleaseExecutionQueueOrdered(execution)) {
      const error = new Error(
        'queue-ordered active-source release requires an exact submitted idle execution'
      );
      error.code =
        'ERR_SCHROEDER_ACTIVE_SOURCE_VIEW_QUEUE_ORDERED_RELEASE_STALE';
      throw error;
    }
    const ownership = ownershipFor(execution);
    const scanReleased =
      ownership.arena.scan.releasePreparedQueueOrdered?.(
        ownership.preparedScan
      );
    if (scanReleased !== true) {
      throw new Error(
        'queue-ordered active-source scan owner did not confirm release'
      );
    }
    return finalizeRelease(execution, ownership, { scanReleased: true });
  }

  function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence?.then) {
      return Promise.reject(new TypeError(
        'releaseExecutionAfter requires a submission-fence thenable'
      ));
    }
    if (releasedExecutions.has(execution)) return Promise.resolve(false);
    let ownership;
    try {
      ownership = ownershipFor(execution);
      if (!submittedExecutions.has(execution)) {
        const error = new Error(
          'unsubmitted active-source execution requires discarded-encoder release'
        );
        error.code =
          'ERR_SCHROEDER_ACTIVE_SOURCE_VIEW_UNSUBMITTED_EXECUTION_REQUIRES_DISCARD';
        throw error;
      }
    } catch (error) {
      return Promise.reject(error);
    }
    releaseInFlightExecutions.add(execution);
    let scanRelease;
    try {
      scanRelease = ownership.arena.scan.releasePreparedAfter(
        ownership.preparedScan,
        submissionFence
      );
    } catch (error) {
      releaseInFlightExecutions.delete(execution);
      return Promise.reject(error);
    }
    const completion = Promise.resolve(scanRelease).then(
      (released) => {
        if (released !== true) {
          throw new Error(
            'active-source scan owner did not confirm queue-fenced release'
          );
        }
        return finalizeRelease(execution, ownership, { scanReleased: true });
      },
      (error) => {
        releaseInFlightExecutions.delete(execution);
        throw error;
      }
    );
    completion.catch(() => {});
    return completion;
  }

  function quarantineExecutionAfterDeviceLoss(execution) {
    if (releasedExecutions.has(execution)) return Promise.resolve(false);
    let ownership;
    try {
      ownership = ownershipFor(execution, { allowInFlight: true });
    } catch (error) {
      return Promise.reject(error);
    }
    const lossEvidence = device?.lost;
    if (!lossEvidence?.then) {
      return Promise.reject(new TypeError(
        'active-source device-loss quarantine requires GPUDevice.lost'
      ));
    }
    deviceLossObserved = true;
    releaseInFlightExecutions.add(execution);
    const completion = Promise.resolve(lossEvidence).then(() => (
      finalizeRelease(execution, ownership, { deviceLost: true })
    ));
    completion.catch(() => {});
    return completion;
  }

  function allocationEntries() {
    return arenas.flatMap(allocationEntriesForArena);
  }

  function activeExecutionCount() {
    return arenas.filter((arena) => arena.inUse).length;
  }

  function destroy() {
    if (destroyed) return false;
    const active = arenas.filter((arena) => arena.inUse);
    if (active.length > 0) {
      const error = new Error(`${label} has active executions`);
      error.code = 'ERR_SCHROEDER_ACTIVE_SOURCE_VIEW_ACTIVE_EXECUTIONS';
      throw error;
    }
    destroyed = true;
    for (const arena of arenas) {
      for (const { buffer } of directEntries(arena)) {
        if (arena.destroyedBuffers.has(buffer)) continue;
        buffer.destroy?.();
        arena.destroyedBuffers.add(buffer);
      }
      if (!arena.retired) arena.scan.destroy();
      arena.bindGroupsBySource = new WeakMap();
    }
    return true;
  }

  runtimeApi = {
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
    status: 'schroeder-spatial-active-source-view-gpu-runtime-ready',
    deviceId,
    physicalSourceCapacity: resolvedPhysicalCapacity,
    activeSourceCapacity: resolvedActiveCapacity,
    arenaCount: resolvedArenaCount,
    layout,
    retainedGpuBufferBytesPerArena,
    retainedGpuBufferBytes,
    pipelineCount: 3 + arenas.reduce(
      (sum, arena) => sum + arena.scan.pipelineCount,
      0
    ),
    submissionOwnership: 'caller',
    readbackPolicy: 'fixed-header-or-explicit-probe-only',
    encode,
    ownsExecution,
    markExecutionSubmitted,
    isExecutionSubmitted,
    releaseExecution,
    canReleaseExecutionQueueOrdered,
    releaseExecutionQueueOrdered,
    releaseExecutionAfter,
    quarantineExecutionAfterDeviceLoss,
    allocationEntries,
    activeExecutionCount,
    destroy
  };
  return runtimeApi;
}
