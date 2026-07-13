import {
  SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
  SCHROEDER_SPATIAL_EPOCH_MAGIC,
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  createSchroederSpatialEpochBuildPlan,
  createSchroederSpatialEpochLayout
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  schroederSpatialEpochAssembleWgsl,
  schroederSpatialEpochKeyWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialEpochWgsl.js';
import { createWebGpuStableRadixScanUnique } from '../webgpuRadixScanUnique.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId,
  webGpuDeviceMismatchInfo
} from './sphGpuDeviceIdentity.js';

export {
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  schroederSpatialEpochAssembleWgsl,
  schroederSpatialEpochKeyWgsl
};

export const SCHROEDER_SPATIAL_EPOCH_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES = 160;
export const SCHROEDER_SPATIAL_EPOCH_ARENA_COUNT_DEFAULT = 2;
export const SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS = 1;

const ACTIVE_NODE_STRIDE_FLOATS = 16;
const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const PARAMS_BUFFER_BYTES = 256;
const MAX_EXACT_F32_INTEGER = 0x00ff_ffff;
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
  if (offset !== SCHROEDER_SPATIAL_EPOCH_PARAMS_BYTES) {
    throw new Error(`spatial epoch params ABI packed ${offset} bytes, expected 160`);
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
        4 * UINT32_BYTES,
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
      sortUniqueOrdinal
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
        exactKeyBuffer: arena.exactKeyBuffer,
        sortKeyBuffer: arena.sortKeyBuffer,
        sortedIndicesBuffer: radixUnique.sortedIndicesBuffer,
        radixUnique,
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
          + 4
          + 3
          + (radixUnique.clearedWordCount ?? 0),
        physicalDirectoryHighWaterWordsUpperBound: Math.max(
          plan.layout.cellOffsetsOffsetWords + 1,
          plan.layout.particleToCellOffsetWords + plan.sourceCount
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
        released: false,
        _executionToken: executionToken,
        _arena: arena
      };
      return execution;
    } catch (error) {
      if (radixUnique) {
        arena.radix.releaseExecution(radixUnique, { discardedEncoder: true });
      }
      releaseArena(arena, executionToken);
      throw error;
    }
  }

  function finalizeReleaseExecution(execution, { radixReleased = false } = {}) {
    if (!execution || execution.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA) {
      throw new TypeError('releaseExecution requires a Schroeder spatial epoch execution');
    }
    if (execution.released === true) return false;
    const arena = execution._arena;
    if (!arena || arena !== arenas[execution.arenaIndex]) {
      throw new Error('spatial epoch execution does not belong to this runtime');
    }
    if (!radixReleased) {
      arena.radix.releaseExecution(execution.radixUnique, { discardedEncoder: true });
    }
    const released = releaseArena(arena, execution._executionToken);
    execution.released = released;
    return released;
  }

  function releaseExecution(execution, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError(
        'releaseExecution is only for a discarded encoder; use releaseExecutionAfter '
        + 'with a submission-fence thenable after submission'
      );
    }
    return finalizeReleaseExecution(execution);
  }

  async function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence || typeof submissionFence.then !== 'function') {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    if (!execution || execution.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA) {
      throw new TypeError('releaseExecution requires a Schroeder spatial epoch execution');
    }
    if (execution.released === true) return false;
    const arena = execution._arena;
    if (!arena || arena !== arenas[execution.arenaIndex]) {
      throw new Error('spatial epoch execution does not belong to this runtime');
    }
    await arena.radix.releaseExecutionAfter(execution.radixUnique, submissionFence);
    return finalizeReleaseExecution(execution, { radixReleased: true });
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

  return {
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
    releaseExecution,
    releaseExecutionAfter,
    allocationEntries,
    destroy
  };
}
