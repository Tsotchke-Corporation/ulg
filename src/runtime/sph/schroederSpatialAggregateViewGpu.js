import {
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_AUTH_DISPATCH_SLOT,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_CELL_DISPATCH_SLOT,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_DISPATCH_WORDS,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_INTERNAL_DISPATCH_SLOT,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_PARAMS_BYTES,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_WORDS,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_TREE_ARITY,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_AGGREGATE_VIEW_SCHEMA,
  createSchroederSpatialAggregateViewPlan,
  schroederSpatialAggregateDispatchOffsetBytes
} from '../../../ulg-gpu-abi/src/schroederSpatialAggregateView.js';
import {
  schroederSpatialAggregateViewWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialAggregateViewWgsl.js';
import {
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import { createWebGpuStableRadixScanUnique } from '../webgpuRadixScanUnique.js';
import {
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function aggregateError(message, code, ErrorType = Error) {
  const error = new ErrorType(message);
  error.code = code;
  return error;
}

function positiveInteger(value, label, max = 0xffff_ffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function assertDevice(device) {
  if (
    !device?.createBuffer
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroup
    || !device?.queue?.writeBuffer
  ) {
    throw new TypeError('spatial aggregate view requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (
    !encoder?.beginComputePass
    || !encoder?.clearBuffer
  ) {
    throw new TypeError(
      'spatial aggregate view encoding requires a caller-owned GPUCommandEncoder-like object'
    );
  }
}

function createOwnedBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function bufferSizeAtLeast(buffer, byteLength, label) {
  const size = Number(buffer?.size);
  if (Number.isFinite(size) && size < byteLength) {
    throw new RangeError(`${label} has ${size} bytes; ${byteLength} required`);
  }
}

function identityFieldsMatch(left, right) {
  return [
    'storageGeneration',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ].every((field) => Object.is(left?.[field], right?.[field]));
}

function aggregateParamsData(plan, spatialExecution) {
  const data = new ArrayBuffer(SCHROEDER_SPATIAL_AGGREGATE_VIEW_PARAMS_BYTES);
  const view = new DataView(data);
  const u32 = (word, value) => view.setUint32(word * 4, Number(value) >>> 0, true);
  u32(0, plan.sourceCount);
  u32(1, plan.sourceCapacity);
  u32(2, plan.cellCapacity);
  u32(3, plan.sourceRowLayoutId);
  u32(4, plan.stateStrideFloats);
  u32(5, plan.thermoStrideFloats);
  u32(6, plan.identityStrideWords);
  u32(7, plan.layout.wordLength);
  u32(8, plan.generationId);
  u32(9, plan.deviceOrdinal);
  u32(10, plan.laneOrdinal);
  u32(11, plan.leaseToken);
  u32(12, plan.sourceFamilyId);
  u32(13, plan.storageGeneration);
  u32(14, plan.physicsTick);
  u32(15, plan.physicsSubstep);
  u32(16, plan.positionEpoch);
  u32(17, plan.topologyEpoch);
  u32(18, plan.chartEpoch);
  u32(19, plan.levelEpoch);
  u32(20, plan.supportEpoch);
  u32(21, plan.completionOrdinal);
  u32(22, spatialExecution.layout.wordLength);
  u32(23, spatialExecution.layout.cellCapacity);
  u32(24, spatialExecution.sourceAdapterId);
  u32(25, SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_WORDS);
  u32(26, SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_WORDS);
  u32(27, SCHROEDER_SPATIAL_AGGREGATE_VIEW_TREE_ARITY);
  u32(28, SCHROEDER_SPATIAL_AGGREGATE_VIEW_WORKGROUP_SIZE);
  u32(29, SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT);
  u32(30, SCHROEDER_SPATIAL_AGGREGATE_VIEW_DISPATCH_WORDS);
  u32(31, SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY);
  u32(32, plan.layout.wordLength);
  u32(33, plan.activeMemberProjection.memberOffsetWords);
  u32(34, plan.activeMemberProjection.memberCapacity);
  u32(35, plan.physicalWordLength);
  return data;
}

function encodeDirectPass(encoder, pipeline, bindGroup, workgroups, label) {
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...workgroups);
  pass.end();
  return 1;
}

function encodeIndirectPass(encoder, pipeline, bindGroup, buffer, offset, label) {
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroupsIndirect(buffer, offset);
  pass.end();
  return 1;
}

export function createSchroederSpatialAggregateViewGpu(device, {
  maxSourceCount,
  cellCapacity = maxSourceCount,
  arenaCount = 2,
  label = 'ulg-schroeder-spatial-aggregate-view'
} = {}) {
  assertDevice(device);
  const resolvedMaxSourceCount = positiveInteger(maxSourceCount, 'maxSourceCount');
  const resolvedCellCapacity = positiveInteger(
    cellCapacity,
    'cellCapacity',
    resolvedMaxSourceCount
  );
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const template = createSchroederSpatialAggregateViewPlan({
    sourceCount: 1,
    sourceCapacity: resolvedMaxSourceCount,
    cellCapacity: resolvedCellCapacity,
    sourceRowLayoutId: 1,
    generationId: 1,
    deviceOrdinal: 0,
    laneOrdinal: 0,
    leaseToken: 0,
    sourceFamilyId: 0,
    storageGeneration: 1,
    physicsTick: 0,
    physicsSubstep: 0,
    positionEpoch: 0,
    topologyEpoch: 0,
    chartEpoch: 0,
    levelEpoch: 0,
    supportEpoch: 0
  });
  const maxStorageBuffersPerShaderStage = positiveInteger(
    device.limits?.maxStorageBuffersPerShaderStage ?? 8,
    'device.limits.maxStorageBuffersPerShaderStage',
    0xffff
  );
  if (maxStorageBuffersPerShaderStage < 8) {
    throw new RangeError('spatial aggregate view requires eight storage bindings');
  }
  const maxBufferSize = positiveInteger(
    device.limits?.maxBufferSize ?? 256 * 1024 * 1024,
    'device.limits.maxBufferSize',
    Number.MAX_SAFE_INTEGER
  );
  const maxStorageBufferBindingSize = positiveInteger(
    device.limits?.maxStorageBufferBindingSize ?? maxBufferSize,
    'device.limits.maxStorageBufferBindingSize',
    Number.MAX_SAFE_INTEGER
  );
  if (
    template.physicalByteLength > maxBufferSize
    || template.physicalByteLength > maxStorageBufferBindingSize
  ) {
    throw new RangeError('spatial aggregate view exceeds the WebGPU storage buffer limit');
  }
  const mortonKeyByteLength = (
    resolvedMaxSourceCount
      * SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS
      * UINT32_BYTES
  );
  if (
    !Number.isSafeInteger(mortonKeyByteLength)
    || mortonKeyByteLength > maxBufferSize
    || mortonKeyByteLength > maxStorageBufferBindingSize
  ) {
    throw new RangeError('spatial aggregate Morton keys exceed the WebGPU storage buffer limit');
  }
  const maxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension'
  );
  if (
    Math.ceil(
      template.layout.maxRecordCount
        / SCHROEDER_SPATIAL_AGGREGATE_VIEW_WORKGROUP_SIZE
    ) > maxComputeWorkgroupsPerDimension
  ) {
    throw new RangeError('spatial aggregate authentication dispatch exceeds the WebGPU limit');
  }
  if (
    Math.ceil(
      resolvedMaxSourceCount
        / SCHROEDER_SPATIAL_AGGREGATE_VIEW_WORKGROUP_SIZE
    ) > maxComputeWorkgroupsPerDimension
  ) {
    throw new RangeError('spatial aggregate Morton emission dispatch exceeds the WebGPU limit');
  }

  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: schroederSpatialAggregateViewWgsl
  });
  const pipeline = (entryPoint) => device.createComputePipeline({
    label: `${label}-${entryPoint.replaceAll('_', '-')}-pipeline`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  const pipelines = Object.freeze({
    initialize: pipeline('initialize_aggregate_view'),
    initializeRecords: pipeline('initialize_aggregate_records'),
    emitMortonKeys: pipeline('emit_aggregate_morton_keys'),
    leaves: pipeline('reduce_cell_leaves'),
    buildPrefixTopology: pipeline('build_aggregate_prefix_topology'),
    buildEscapeRopes: pipeline('build_aggregate_escape_ropes'),
    reduceInternals: pipeline('reduce_aggregate_internals'),
    authenticate: pipeline('authenticate_aggregate_topology'),
    finalize: pipeline('finalize_aggregate_view')
  });
  const deviceId = webGpuDeviceId(device);
  let destroyed = false;
  let deviceLossObserved = false;
  let serial = 0;
  let runtime = null;
  const executionOwnership = new WeakMap();
  const executionRetirements = new WeakMap();
  const releasedExecutions = new WeakSet();
  const submittedExecutions = new WeakSet();

  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => {
    const arenaLabel = `${label}-arena-${arenaIndex}`;
    return {
      arenaIndex,
      inUse: false,
      retired: false,
      destroyedOwnedBuffers: new Set(),
      radixDeviceLossRetired: false,
      token: null,
      paramsBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-params`,
        SCHROEDER_SPATIAL_AGGREGATE_VIEW_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      aggregateViewBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-view`,
        template.physicalByteLength,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      dispatchBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-dispatch`,
        template.layout.dispatchByteLength,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.INDIRECT
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      mortonKeyBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-morton-keys`,
        mortonKeyByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
      ),
      radix: createWebGpuStableRadixScanUnique(device, {
        maxElementCount: resolvedMaxSourceCount,
        maxKeyWordCount: SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS,
        label: `${arenaLabel}-radix`,
        maxComputeWorkgroupsPerDimension,
        retainConstantScanParamsBuffers: true,
        retainVariableScanParamsBuffers: true,
        retainedParamsSlotCount: 1
      })
    };
  });

  const allocationEntriesForArena = (arena) => [
    {
      role: 'aggregate-view-params',
      arenaIndex: arena.arenaIndex,
      buffer: arena.paramsBuffer
    },
    {
      role: 'aggregate-view-records',
      arenaIndex: arena.arenaIndex,
      buffer: arena.aggregateViewBuffer
    },
    {
      role: 'aggregate-view-indirect-dispatch',
      arenaIndex: arena.arenaIndex,
      buffer: arena.dispatchBuffer
    },
    {
      role: 'aggregate-view-morton-keys',
      arenaIndex: arena.arenaIndex,
      buffer: arena.mortonKeyBuffer
    },
    ...arena.radix.allocationEntries().map((entry) => ({
      ...entry,
      role: `aggregate-view-${entry.role}`,
      arenaIndex: arena.arenaIndex
    }))
  ];
  const retainedGpuBufferBytesPerArena = Object.freeze(arenas.map((arena) => (
    allocationEntriesForArena(arena).reduce((sum, entry) => {
      const byteLength = Number(entry.buffer?.size);
      if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
        throw new RangeError(`${entry.role} does not expose a safe GPUBuffer size`);
      }
      return sum + byteLength;
    }, 0)
  )));
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
          'spatial aggregate device-loss arena retirement was incomplete'
        );
    }
    arena.radixDeviceLossRetired = true;
    return true;
  }

  function acquireArena() {
    if (destroyed) {
      throw aggregateError(
        'spatial aggregate view runtime is destroyed',
        'ERR_SCHROEDER_AGGREGATE_VIEW_RUNTIME_DESTROYED'
      );
    }
    if (deviceLossObserved) {
      throw aggregateError(
        'spatial aggregate view runtime observed device loss',
        'ERR_SCHROEDER_AGGREGATE_VIEW_DEVICE_LOST'
      );
    }
    const arena = arenas.find((candidate) => (
      candidate.inUse === false && candidate.retired === false
    ));
    if (!arena) {
      throw aggregateError(
        'spatial aggregate view arenas are under backpressure',
        'ERR_SCHROEDER_AGGREGATE_VIEW_ARENA_EXHAUSTED'
      );
    }
    const token = Object.freeze({ serial: ++serial, arenaIndex: arena.arenaIndex });
    arena.inUse = true;
    arena.token = token;
    return { arena, token };
  }

  function bindGroup(pipelineObject, entries, suffix, arenaIndex) {
    return device.createBindGroup({
      label: `${label}-arena-${arenaIndex}-${suffix}-bindings`,
      layout: pipelineObject.getBindGroupLayout(0),
      entries
    });
  }

  function assertSpatialExecution(spatialExecution) {
    let owned = false;
    try {
      owned = spatialExecution?.ownerRuntime?.ownsExecution?.(spatialExecution) === true;
    } catch {
      owned = false;
    }
    if (
      spatialExecution?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
      || spatialExecution.released === true
      || !owned
      || ![
        'schroeder-spatial-epoch-gpu-encoded',
        'schroeder-spatial-epoch-gpu-build-submitted'
      ].includes(spatialExecution.status)
      || !spatialExecution.directoryBuffer
      || !spatialExecution.sourceBuffer
      || spatialExecution.sourceCount < 1
      || spatialExecution.sourceCapacity !== resolvedMaxSourceCount
      || spatialExecution.layout?.cellCapacity !== resolvedCellCapacity
      || spatialExecution.sortUniqueOrdinal !== spatialExecution.buildOrdinal
      || !webGpuBufferMatchesDevice(spatialExecution.directoryBuffer, device)
      || !webGpuBufferMatchesDevice(spatialExecution.sourceBuffer, device)
    ) {
      throw new TypeError(
        'spatial aggregate view requires an exact live encoded or submitted SS spatial generation'
      );
    }
  }

  function resolveParticleAuthority(spatialExecution, spatialSource, particleBufferSet) {
    if (
      !spatialSource
      || spatialSource.ready !== true
      || spatialSource.sourceBuffer !== spatialExecution.sourceBuffer
      || spatialSource.sourceStateBufferBorrowed !== true
      || spatialSource.sourceCount !== spatialExecution.sourceCount
      || !identityFieldsMatch(spatialSource, spatialExecution)
    ) {
      throw new TypeError(
        'spatial aggregate view requires the exact immutable spatial source descriptor'
      );
    }
    if (
      !particleBufferSet
      || particleBufferSet.status !== 'webgpu-uploaded'
      || particleBufferSet.particleCount !== spatialExecution.sourceCount
      || particleBufferSet.stateBuffer !== spatialSource.sourceStateBuffer
      || particleBufferSet.stateStrideBytes !== SPH_GPU_PARTICLE_STATE_FLOATS * 4
      || particleBufferSet.thermoStrideBytes !== SPH_GPU_PARTICLE_THERMO_FLOATS * 4
      || particleBufferSet.identityStrideBytes !== SPH_GPU_PARTICLE_IDENTITY_UINTS * 4
      || !identityFieldsMatch(particleBufferSet, spatialExecution)
    ) {
      throw new TypeError(
        'spatial aggregate view requires one exact same-generation SPH particle buffer family'
      );
    }
    const buffers = [
      ['stateBuffer', particleBufferSet.stateBuffer, SPH_GPU_PARTICLE_STATE_FLOATS],
      ['thermoBuffer', particleBufferSet.thermoBuffer, SPH_GPU_PARTICLE_THERMO_FLOATS],
      ['identityBuffer', particleBufferSet.identityBuffer, SPH_GPU_PARTICLE_IDENTITY_UINTS]
    ];
    for (const [role, buffer, stride] of buffers) {
      if (!buffer || !webGpuBufferMatchesDevice(buffer, device)) {
        throw new TypeError(`aggregate ${role} must belong to the spatial generation device`);
      }
      bufferSizeAtLeast(
        buffer,
        spatialExecution.sourceCount * stride * UINT32_BYTES,
        `aggregate ${role}`
      );
    }
    return {
      stateBuffer: particleBufferSet.stateBuffer,
      thermoBuffer: particleBufferSet.thermoBuffer,
      identityBuffer: particleBufferSet.identityBuffer
    };
  }

  function createRetirementRecord(execution, ownership) {
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

  function encode(encoder, {
    spatialExecution,
    spatialSource,
    particleBufferSet
  } = {}) {
    assertEncoder(encoder);
    assertSpatialExecution(spatialExecution);
    const particleAuthority = resolveParticleAuthority(
      spatialExecution,
      spatialSource,
      particleBufferSet
    );
    const plan = createSchroederSpatialAggregateViewPlan({
      sourceCount: spatialExecution.sourceCount,
      sourceCapacity: spatialExecution.sourceCapacity,
      cellCapacity: spatialExecution.layout.cellCapacity,
      sourceRowLayoutId: spatialExecution.sourceRowLayoutId,
      generationId: spatialExecution.generationId,
      deviceOrdinal: spatialExecution.deviceOrdinal,
      laneOrdinal: spatialExecution.laneOrdinal,
      leaseToken: spatialExecution.leaseToken,
      sourceFamilyId: spatialExecution.sourceFamilyId,
      storageGeneration: spatialExecution.storageGeneration,
      physicsTick: spatialExecution.physicsTick,
      physicsSubstep: spatialExecution.physicsSubstep,
      positionEpoch: spatialExecution.positionEpoch,
      topologyEpoch: spatialExecution.topologyEpoch,
      chartEpoch: spatialExecution.chartEpoch,
      levelEpoch: spatialExecution.levelEpoch,
      supportEpoch: spatialExecution.supportEpoch,
      completionOrdinal: spatialExecution.buildOrdinal,
      stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
      thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
      identityStrideWords: SPH_GPU_PARTICLE_IDENTITY_UINTS
    });
    const { arena, token } = acquireArena();
    let radixSort = null;
    try {
      device.queue.writeBuffer(
        arena.paramsBuffer,
        0,
        aggregateParamsData(plan, spatialExecution)
      );
      encoder.clearBuffer(arena.aggregateViewBuffer);
      encoder.clearBuffer(arena.dispatchBuffer);
      const paramsResource = {
        buffer: arena.paramsBuffer,
        offset: 0,
        size: SCHROEDER_SPATIAL_AGGREGATE_VIEW_PARAMS_BYTES
      };
      const directoryEntry = {
        binding: 0,
        resource: { buffer: spatialExecution.directoryBuffer }
      };
      const sourceEntry = {
        binding: 1,
        resource: { buffer: spatialExecution.sourceBuffer }
      };
      const stateEntry = {
        binding: 2,
        resource: { buffer: particleAuthority.stateBuffer }
      };
      const thermoEntry = {
        binding: 3,
        resource: { buffer: particleAuthority.thermoBuffer }
      };
      const identityEntry = {
        binding: 4,
        resource: { buffer: particleAuthority.identityBuffer }
      };
      const aggregateEntry = {
        binding: 5,
        resource: { buffer: arena.aggregateViewBuffer }
      };
      const paramsEntry = { binding: 6, resource: paramsResource };
      const dispatchEntry = {
        binding: 7,
        resource: { buffer: arena.dispatchBuffer }
      };
      const mortonKeyEntry = {
        binding: 8,
        resource: { buffer: arena.mortonKeyBuffer }
      };
      const initializeGroup = bindGroup(
        pipelines.initialize,
        [
          directoryEntry,
          sourceEntry,
          stateEntry,
          thermoEntry,
          identityEntry,
          aggregateEntry,
          paramsEntry,
          dispatchEntry
        ],
        'initialize',
        arena.arenaIndex
      );
      const initializeRecordsGroup = bindGroup(
        pipelines.initializeRecords,
        [aggregateEntry, paramsEntry],
        'initialize-records',
        arena.arenaIndex
      );
      const emitMortonKeysGroup = bindGroup(
        pipelines.emitMortonKeys,
        [directoryEntry, aggregateEntry, paramsEntry, mortonKeyEntry],
        'emit-morton-keys',
        arena.arenaIndex
      );
      let aggregateDispatchCount = 0;
      aggregateDispatchCount += encodeDirectPass(
        encoder,
        pipelines.initialize,
        initializeGroup,
        [1, 1, 1],
        `${label}Initialize`
      );
      aggregateDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.initializeRecords,
        initializeRecordsGroup,
        arena.dispatchBuffer,
        schroederSpatialAggregateDispatchOffsetBytes(
          SCHROEDER_SPATIAL_AGGREGATE_VIEW_AUTH_DISPATCH_SLOT
        ),
        `${label}InitializeRecords`
      );
      const mortonKeyDispatchWorkgroups = Object.freeze([
        Math.ceil(plan.sourceCount / SCHROEDER_SPATIAL_AGGREGATE_VIEW_WORKGROUP_SIZE),
        1,
        1
      ]);
      aggregateDispatchCount += encodeDirectPass(
        encoder,
        pipelines.emitMortonKeys,
        emitMortonKeysGroup,
        mortonKeyDispatchWorkgroups,
        `${label}EmitMortonKeys`
      );
      radixSort = arena.radix.encodeSort(encoder, {
        keyBuffer: arena.mortonKeyBuffer,
        elementCount: plan.sourceCount,
        keyWordCount: SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS,
        keyStrideWords: SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS,
        generationId: plan.generationId,
        retainedParamsSlotIndex: 0
      });
      if (
        radixSort.paramsBufferCreationCount !== 0
        || radixSort.paramsBufferResidency !== 'retained-slot-arena'
        || radixSort.paramsSlotIndex !== 0
        || radixSort.transientBuffers?.length !== 0
      ) {
        throw aggregateError(
          'spatial aggregate Morton sort escaped its retained arena',
          'ERR_SCHROEDER_AGGREGATE_VIEW_RADIX_RESIDENCY'
        );
      }
      const sortedIndicesEntry = {
        binding: 9,
        resource: { buffer: radixSort.sortedIndicesBuffer }
      };
      const leavesGroup = bindGroup(
        pipelines.leaves,
        [
          directoryEntry,
          sourceEntry,
          stateEntry,
          thermoEntry,
          identityEntry,
          aggregateEntry,
          paramsEntry,
          mortonKeyEntry,
          sortedIndicesEntry
        ],
        'leaves',
        arena.arenaIndex
      );
      const buildPrefixTopologyGroup = bindGroup(
        pipelines.buildPrefixTopology,
        [aggregateEntry, paramsEntry, mortonKeyEntry, sortedIndicesEntry],
        'build-prefix-topology',
        arena.arenaIndex
      );
      const buildEscapeRopesGroup = bindGroup(
        pipelines.buildEscapeRopes,
        [aggregateEntry, paramsEntry],
        'build-escape-ropes',
        arena.arenaIndex
      );
      const reduceInternalsGroup = bindGroup(
        pipelines.reduceInternals,
        [aggregateEntry, paramsEntry, sortedIndicesEntry],
        'reduce-internals',
        arena.arenaIndex
      );
      const authenticateGroup = bindGroup(
        pipelines.authenticate,
        [directoryEntry, aggregateEntry, paramsEntry, mortonKeyEntry, sortedIndicesEntry],
        'authenticate',
        arena.arenaIndex
      );
      const finalizeGroup = bindGroup(
        pipelines.finalize,
        [directoryEntry, aggregateEntry, paramsEntry, dispatchEntry],
        'finalize',
        arena.arenaIndex
      );
      aggregateDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.leaves,
        leavesGroup,
        arena.dispatchBuffer,
        schroederSpatialAggregateDispatchOffsetBytes(
          SCHROEDER_SPATIAL_AGGREGATE_VIEW_CELL_DISPATCH_SLOT
        ),
        `${label}ReduceLeaves`
      );
      aggregateDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.buildPrefixTopology,
        buildPrefixTopologyGroup,
        arena.dispatchBuffer,
        schroederSpatialAggregateDispatchOffsetBytes(
          SCHROEDER_SPATIAL_AGGREGATE_VIEW_INTERNAL_DISPATCH_SLOT
        ),
        `${label}BuildPrefixTopology`
      );
      aggregateDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.buildEscapeRopes,
        buildEscapeRopesGroup,
        arena.dispatchBuffer,
        schroederSpatialAggregateDispatchOffsetBytes(
          SCHROEDER_SPATIAL_AGGREGATE_VIEW_AUTH_DISPATCH_SLOT
        ),
        `${label}BuildEscapeRopes`
      );
      aggregateDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.reduceInternals,
        reduceInternalsGroup,
        arena.dispatchBuffer,
        schroederSpatialAggregateDispatchOffsetBytes(
          SCHROEDER_SPATIAL_AGGREGATE_VIEW_INTERNAL_DISPATCH_SLOT
        ),
        `${label}ReduceInternals`
      );
      aggregateDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.authenticate,
        authenticateGroup,
        arena.dispatchBuffer,
        schroederSpatialAggregateDispatchOffsetBytes(
          SCHROEDER_SPATIAL_AGGREGATE_VIEW_AUTH_DISPATCH_SLOT
        ),
        `${label}AuthenticateTopology`
      );
      aggregateDispatchCount += encodeDirectPass(
        encoder,
        pipelines.finalize,
        finalizeGroup,
        [1, 1, 1],
        `${label}Finalize`
      );
      const encodedDispatchCount = aggregateDispatchCount
        + radixSort.encodedDispatchCount;
      const encodedComputePassCount = aggregateDispatchCount
        + radixSort.encodedComputePassCount;
      const execution = {
        ...plan,
        schema: ULG_SCHROEDER_SPATIAL_AGGREGATE_VIEW_SCHEMA,
        status: 'schroeder-spatial-aggregate-view-gpu-encoded',
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        spatialExecution,
        spatialSource,
        particleBufferSet,
        sourceStateBuffer: particleAuthority.stateBuffer,
        sourceThermoBuffer: particleAuthority.thermoBuffer,
        sourceIdentityBuffer: particleAuthority.identityBuffer,
        aggregateViewBuffer: arena.aggregateViewBuffer,
        activeMemberProjectionBuffer: arena.aggregateViewBuffer,
        activeMemberOffsetWords: plan.activeMemberProjection.memberOffsetWords,
        activeMemberCapacity: plan.activeMemberProjection.memberCapacity,
        aggregatePhysicalWordLength: plan.physicalWordLength,
        aggregatePhysicalByteLength: plan.physicalByteLength,
        indirectDispatchBuffer: arena.dispatchBuffer,
        mortonKeyBuffer: arena.mortonKeyBuffer,
        sortedIndicesBuffer: radixSort.sortedIndicesBuffer,
        mortonSortedIndicesBuffer: radixSort.sortedIndicesBuffer,
        leafIndirectDispatchOffsetBytes:
          schroederSpatialAggregateDispatchOffsetBytes(
            SCHROEDER_SPATIAL_AGGREGATE_VIEW_CELL_DISPATCH_SLOT
          ),
        cellIndirectDispatchOffsetBytes:
          schroederSpatialAggregateDispatchOffsetBytes(
            SCHROEDER_SPATIAL_AGGREGATE_VIEW_CELL_DISPATCH_SLOT
          ),
        internalIndirectDispatchOffsetBytes:
          schroederSpatialAggregateDispatchOffsetBytes(
            SCHROEDER_SPATIAL_AGGREGATE_VIEW_INTERNAL_DISPATCH_SLOT
          ),
        recordIndirectDispatchOffsetBytes:
          schroederSpatialAggregateDispatchOffsetBytes(
            SCHROEDER_SPATIAL_AGGREGATE_VIEW_AUTH_DISPATCH_SLOT
          ),
        authIndirectDispatchOffsetBytes:
          schroederSpatialAggregateDispatchOffsetBytes(
            SCHROEDER_SPATIAL_AGGREGATE_VIEW_AUTH_DISPATCH_SLOT
          ),
        topologyMode: SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY,
        mortonKeyWordCount: SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS,
        mortonKeyStrideWords: SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS,
        mortonPrefixBitCount: SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT,
        mortonSortElementCount: plan.sourceCount,
        mortonKeyDispatchWorkgroups,
        radixPassCount: radixSort.passCount,
        radixDigitPassCount: radixSort.passCount,
        radixParamsBufferResidency: radixSort.paramsBufferResidency,
        radixParamsSlotIndex: radixSort.paramsSlotIndex,
        radixBindGroupCreationCount: radixSort.bindGroupCreationCount,
        radixBindGroupReuseCount: radixSort.bindGroupReuseCount,
        radixEncodedDispatchCount: radixSort.encodedDispatchCount,
        radixEncodedComputePassCount: radixSort.encodedComputePassCount,
        paramsWriteCount: 1 + (radixSort.paramsWriteCount ?? 0),
        encodedDispatchCount,
        encodedComputePassCount,
        aggregateEncodedDispatchCount: aggregateDispatchCount,
        retainedGpuBufferBytes: retainedGpuBufferBytesPerArena[arena.arenaIndex],
        retainedGpuBufferBytesAllArenas: retainedGpuBufferBytes,
        gpuBufferCreationCountDuringEncode: radixSort.paramsBufferCreationCount,
        bufferAllocationCountDuringEncode: radixSort.transientBuffers.length,
        readbackPerformed: false,
        fullReadbackPerformed: false,
        submitPerformed: false,
        releaseScheduled: false,
        submissionOwnership: 'caller',
        constructionComplexity: plan.constructionComplexity,
        traversalComplexity: plan.traversalComplexity,
        contributionRowCount: 0,
        materializedCandidateRowCount: 0,
        perSourceCandidateBudget: null,
        topology:
          'canonical-cell-morton-prefix-binary-authenticated-parent-child-escape-ropes'
      };
      Object.defineProperty(execution, 'ownerRuntime', {
        value: runtime,
        enumerable: false
      });
      Object.defineProperty(execution, 'released', {
        get() { return releasedExecutions.has(execution); },
        enumerable: true
      });
      const ownership = {
        arena,
        token,
        spatialExecution,
        spatialSource,
        particleBufferSet,
        particleAuthority,
        radixSort,
        mortonKeyBuffer: arena.mortonKeyBuffer,
        sortedIndicesBuffer: radixSort.sortedIndicesBuffer,
        topologyMode: SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY
      };
      executionOwnership.set(execution, ownership);
      createRetirementRecord(execution, ownership);
      return execution;
    } catch (error) {
      try {
        if (radixSort) {
          arena.radix.releaseExecution(radixSort, { discardedEncoder: true });
        }
      } finally {
        arena.inUse = false;
        arena.token = null;
      }
      throw error;
    }
  }

  function ownershipFor(execution) {
    const ownership = executionOwnership.get(execution);
    if (
      !ownership
      || releasedExecutions.has(execution)
      || ownership.arena.token !== ownership.token
      || ownership.arena.inUse !== true
      || execution.ownerRuntime !== runtime
      || execution.aggregateViewBuffer !== ownership.arena.aggregateViewBuffer
      || execution.activeMemberProjectionBuffer
        !== ownership.arena.aggregateViewBuffer
      || execution.activeMemberOffsetWords !== execution.layout.wordLength
      || execution.activeMemberCapacity !== execution.sourceCapacity
      || execution.aggregatePhysicalWordLength
        !== execution.layout.wordLength + execution.sourceCapacity
      || execution.indirectDispatchBuffer !== ownership.arena.dispatchBuffer
      || execution.mortonKeyBuffer !== ownership.mortonKeyBuffer
      || execution.sortedIndicesBuffer !== ownership.sortedIndicesBuffer
      || execution.mortonSortedIndicesBuffer !== ownership.sortedIndicesBuffer
      || execution.topologyMode !== ownership.topologyMode
      || execution.spatialExecution !== ownership.spatialExecution
      || execution.spatialSource !== ownership.spatialSource
      || execution.particleBufferSet !== ownership.particleBufferSet
      || execution.sourceStateBuffer !== ownership.particleAuthority.stateBuffer
      || execution.sourceThermoBuffer !== ownership.particleAuthority.thermoBuffer
      || execution.sourceIdentityBuffer !== ownership.particleAuthority.identityBuffer
    ) {
      throw aggregateError(
        'spatial aggregate view execution is not owned by this runtime',
        'ERR_SCHROEDER_AGGREGATE_VIEW_FOREIGN_EXECUTION'
      );
    }
    return ownership;
  }

  function retirementFor(execution) {
    const record = executionRetirements.get(execution);
    if (!record || record.execution !== execution) {
      throw aggregateError(
        'spatial aggregate view execution lacks an exact retirement record',
        'ERR_SCHROEDER_AGGREGATE_VIEW_FOREIGN_EXECUTION'
      );
    }
    if (!record.completed) ownershipFor(execution);
    return record;
  }

  function ownsExecution(execution) {
    try {
      ownershipFor(execution);
      return true;
    } catch {
      return false;
    }
  }

  function markExecutionSubmitted(execution) {
    ownershipFor(execution);
    if (submittedExecutions.has(execution)) return false;
    submittedExecutions.add(execution);
    execution.submitPerformed = true;
    execution.status = 'schroeder-spatial-aggregate-view-gpu-build-submitted';
    return true;
  }

  function markExecutionSubmissionUncertain(execution) {
    ownershipFor(execution);
    submittedExecutions.add(execution);
    execution.submitPerformed = true;
    execution.status = 'schroeder-spatial-aggregate-view-submission-uncertain';
    return true;
  }

  function isExecutionSubmitted(execution) {
    return submittedExecutions.has(execution)
      && ownsExecution(execution)
      && execution.submitPerformed === true;
  }

  function finishRetirement(record, {
    deviceLost = false,
    radixReleased = false
  } = {}) {
    if (record.completed) return true;
    const { execution, ownership } = record;
    const { arena, token } = ownership;
    if (arena.token !== token || arena.inUse !== true) {
      throw aggregateError(
        'spatial aggregate arena ownership changed before retirement',
        'ERR_SCHROEDER_AGGREGATE_VIEW_FOREIGN_EXECUTION'
      );
    }
    if (deviceLost) {
      destroyArenaOwnedBuffersAfterDeviceLoss(arena);
    } else if (!radixReleased) {
      arena.radix.releaseExecution(
        ownership.radixSort,
        { discardedEncoder: true }
      );
    }
    arena.inUse = false;
    arena.token = null;
    arena.retired = deviceLost;
    releasedExecutions.add(execution);
    submittedExecutions.delete(execution);
    executionOwnership.delete(execution);
    execution.releaseScheduled = false;
    execution.status = deviceLost
      ? 'schroeder-spatial-aggregate-view-device-loss-retired'
      : 'schroeder-spatial-aggregate-view-released';
    record.activeAttempt = null;
    record.completed = true;
    record.resolveCompletion(true);
    return true;
  }

  function releaseExecution(execution, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError('releaseExecution requires { discardedEncoder: true }');
    }
    const record = retirementFor(execution);
    if (record.completed) return true;
    if (submittedExecutions.has(execution)) {
      throw new Error('submitted spatial aggregate view requires a queue fence');
    }
    if (record.activeAttempt) {
      throw new Error('spatial aggregate view retirement is already in flight');
    }
    return finishRetirement(record);
  }

  function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence?.then) {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    const record = retirementFor(execution);
    if (record.completed) return record.completionPromise;
    if (deviceLossObserved) return runtime.quarantineExecutionAfterDeviceLoss(execution);
    if (!submittedExecutions.has(execution)) {
      throw new Error('unsubmitted spatial aggregate view requires discarded-encoder release');
    }
    if (record.activeAttempt) return record.activeAttempt.promise;
    const attempt = {
      mode: 'queue-fence',
      ordinal: ++record.nextAttemptOrdinal,
      promise: null
    };
    record.activeAttempt = attempt;
    execution.releaseScheduled = true;
    let radixRelease;
    try {
      radixRelease = record.ownership.arena.radix.releaseExecutionAfter(
        record.ownership.radixSort,
        submissionFence
      );
    } catch (error) {
      record.activeAttempt = null;
      execution.releaseScheduled = false;
      throw error;
    }
    const promise = Promise.race([
      Promise.resolve(radixRelease).then((released) => ({
        kind: 'radix-release',
        released
      })),
      record.completionPromise.then(() => ({
        kind: 'terminal-completion',
        released: true
      }))
    ]).then(
      (result) => {
        if (result.kind === 'terminal-completion') return true;
        if (record.activeAttempt !== attempt) return record.completionPromise;
        if (result.released !== true) {
          throw new Error('spatial aggregate radix owner did not confirm release');
        }
        return finishRetirement(record, { radixReleased: true });
      },
      (error) => {
        if (record.activeAttempt !== attempt) return record.completionPromise;
        record.activeAttempt = null;
        execution.releaseScheduled = false;
        execution.status = 'schroeder-spatial-aggregate-view-release-blocked';
        throw error;
      }
    ).catch((error) => {
      if (record.activeAttempt === attempt) {
        record.activeAttempt = null;
        execution.releaseScheduled = false;
        execution.status = 'schroeder-spatial-aggregate-view-release-blocked';
      }
      throw error;
    });
    attempt.promise = promise;
    promise.catch(() => {});
    return promise;
  }

  function quarantineExecutionAfterDeviceLoss(execution) {
    const record = retirementFor(execution);
    if (record.completed) return record.completionPromise;
    const exactLossEvidence = record.deviceLossEvidence ?? device?.lost;
    if (!exactLossEvidence || typeof exactLossEvidence.then !== 'function') {
      throw aggregateError(
        'device-loss quarantine requires the exact GPUDevice.lost promise',
        'ERR_SCHROEDER_AGGREGATE_VIEW_DEVICE_LOSS_EVIDENCE',
        TypeError
      );
    }
    if (
      record.deviceLossEvidence != null
      && record.deviceLossEvidence !== exactLossEvidence
    ) {
      throw aggregateError(
        'device-loss evidence changed for one aggregate execution',
        'ERR_SCHROEDER_AGGREGATE_VIEW_DEVICE_LOSS_EVIDENCE'
      );
    }
    record.deviceLossEvidence = exactLossEvidence;
    deviceLossObserved = true;
    runtime.status = 'schroeder-spatial-aggregate-view-runtime-device-loss-quarantined';
    if (record.activeAttempt?.mode === 'device-loss') {
      return record.activeAttempt.promise;
    }
    record.activeAttempt?.promise?.catch?.(() => {});
    const attempt = {
      mode: 'device-loss',
      ordinal: ++record.nextAttemptOrdinal,
      promise: null
    };
    record.activeAttempt = attempt;
    execution.releaseScheduled = true;
    execution.status = 'schroeder-spatial-aggregate-view-device-loss-quarantined';
    const promise = Promise.resolve(exactLossEvidence).then(
      () => {
        if (record.activeAttempt !== attempt) return record.completionPromise;
        return finishRetirement(record, { deviceLost: true });
      },
      (error) => {
        if (record.activeAttempt !== attempt) return record.completionPromise;
        record.activeAttempt = null;
        execution.releaseScheduled = false;
        execution.status =
          'schroeder-spatial-aggregate-view-device-loss-retirement-blocked';
        throw error;
      }
    ).catch((error) => {
      if (record.activeAttempt === attempt) {
        record.activeAttempt = null;
        execution.releaseScheduled = false;
        execution.status =
          'schroeder-spatial-aggregate-view-device-loss-retirement-blocked';
      }
      throw error;
    });
    attempt.promise = promise;
    promise.catch(() => {});
    return promise;
  }

  function executionRetirementCompletionPromise(execution) {
    return retirementFor(execution).completionPromise;
  }

  function activeExecutionCount() {
    return arenas.reduce((count, arena) => count + (arena.inUse ? 1 : 0), 0);
  }

  function allocationEntries() {
    return arenas.flatMap(allocationEntriesForArena);
  }

  function destroy() {
    if (destroyed) return true;
    if (arenas.some((arena) => arena.inUse)) return false;
    destroyed = true;
    for (const arena of arenas) {
      for (const buffer of [
        arena.paramsBuffer,
        arena.aggregateViewBuffer,
        arena.dispatchBuffer,
        arena.mortonKeyBuffer
      ]) {
        if (arena.destroyedOwnedBuffers.has(buffer)) continue;
        buffer.destroy?.();
        arena.destroyedOwnedBuffers.add(buffer);
      }
      if (!arena.radixDeviceLossRetired) arena.radix.destroy();
    }
    runtime.status = 'schroeder-spatial-aggregate-view-gpu-runtime-destroyed';
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_AGGREGATE_VIEW_SCHEMA,
    status: 'schroeder-spatial-aggregate-view-gpu-runtime-ready',
    deviceId,
    arenaCount: resolvedArenaCount,
    maxSourceCount: resolvedMaxSourceCount,
    cellCapacity: resolvedCellCapacity,
    layout: template.layout,
    topologyMode: SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY,
    mortonKeyWordCount: SCHROEDER_SPATIAL_AGGREGATE_VIEW_MORTON_KEY_WORDS,
    mortonPrefixBitCount: SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT,
    mortonKeyByteLengthPerArena: mortonKeyByteLength,
    pipelineCount: Object.keys(pipelines).length + arenas.reduce(
      (sum, arena) => sum + arena.radix.pipelineCount,
      0
    ),
    aggregatePipelineCount: Object.keys(pipelines).length,
    radixPipelineCountPerArena: arenas[0].radix.pipelineCount,
    retainedGpuBufferBytes,
    retainedGpuBufferBytesPerArena,
    normalHotLoopReadbackFree: true,
    encode,
    ownsExecution,
    markExecutionSubmitted,
    markExecutionSubmissionUncertain,
    isExecutionSubmitted,
    releaseExecution,
    releaseExecutionAfter,
    quarantineExecutionAfterDeviceLoss,
    executionRetirementCompletionPromise,
    activeExecutionCount,
    allocationEntries,
    destroy
  };
  return runtime;
}
