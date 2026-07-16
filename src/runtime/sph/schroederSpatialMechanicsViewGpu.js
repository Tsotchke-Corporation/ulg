import {
  SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_PARAMS_BYTES,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
  createSchroederSpatialMechanicsViewPlan
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  schroederSpatialMechanicsViewWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsViewWgsl.js';
import {
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import { createWebGpuU32ExclusiveScan } from '../webgpuRadixScanUnique.js';
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
    throw new TypeError('compact mechanics view requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
    throw new TypeError('compact mechanics view encoding requires a GPUCommandEncoder-like object');
  }
}

function createOwnedBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function mechanicsParamsData(plan, spatialExecution) {
  const data = new ArrayBuffer(SCHROEDER_SPATIAL_MECHANICS_VIEW_PARAMS_BYTES);
  const view = new DataView(data);
  const u32 = (offset, value) => view.setUint32(offset, Number(value) >>> 0, true);
  const i32 = (offset, value) => view.setInt32(offset, Number(value) | 0, true);
  const f32 = (offset, value) => view.setFloat32(offset, Math.fround(Number(value)), true);
  u32(0, plan.sourceCount);
  u32(4, plan.sourceRowStrideFloats);
  u32(8, plan.sourceRowLayoutId);
  i32(12, plan.selectedLevel);
  u32(16, plan.gridNodeCount);
  u32(20, plan.gridDims[0]);
  u32(24, plan.gridDims[1]);
  u32(28, plan.gridDims[2]);
  u32(32, plan.gridShift);
  u32(36, plan.occupancyWordCount);
  u32(40, plan.nodeCapacity);
  u32(44, plan.generationId);
  f32(48, plan.gridSpacingM);
  f32(52, 1 / plan.gridSpacingM);
  u32(56, plan.deviceOrdinal);
  u32(60, plan.laneOrdinal);
  u32(64, plan.leaseToken);
  u32(68, plan.sourceFamilyId);
  u32(72, plan.storageGeneration);
  u32(76, plan.physicsTick);
  u32(80, plan.physicsSubstep);
  u32(84, plan.positionEpoch);
  u32(88, plan.topologyEpoch);
  u32(92, plan.chartEpoch);
  u32(96, plan.levelEpoch);
  u32(100, plan.supportEpoch);
  u32(104, plan.completionOrdinal);
  u32(108, spatialExecution.layout.wordLength);
  u32(112, spatialExecution.layout.cellCapacity);
  u32(116, plan.layout.wordLength);
  u32(120, plan.layout.nodeOffsetWords);
  u32(124, plan.layout.headerOffsetWords);
  u32(128, plan.layout.headerWords);
  u32(132, spatialExecution.sourceAdapterId);
  u32(136, spatialExecution.queryChartId);
  i32(140, spatialExecution.queryMinLevel);
  i32(144, spatialExecution.queryMaxLevel);
  f32(148, spatialExecution.queryBaseGridSpacingM);
  u32(152, spatialExecution.queryEvidenceWordCount);
  u32(156, SCHROEDER_SPATIAL_MECHANICS_VIEW_WORKGROUP_SIZE);
  u32(
    160,
    plan.layout.nodeOffsetWords + plan.layout.occupancyWordCount
  );
  return data;
}

function encodePass(encoder, pipeline, bindGroup, workgroups, label) {
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...workgroups);
  pass.end();
  return 1;
}

export function createSchroederSpatialMechanicsViewGpu(device, {
  maxSourceCount,
  gridNodeCount,
  gridDims,
  gridShift,
  gridSpacingM,
  arenaCount = 2,
  label = 'ulg-schroeder-spatial-mechanics-view'
} = {}) {
  assertDevice(device);
  const resolvedMaxSourceCount = positiveInteger(maxSourceCount, 'maxSourceCount');
  const resolvedGridNodeCount = positiveInteger(gridNodeCount, 'gridNodeCount');
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const template = createSchroederSpatialMechanicsViewPlan({
    sourceCount: 1,
    selectedLevel: 0,
    gridNodeCount: resolvedGridNodeCount,
    gridDims,
    gridShift,
    gridSpacingM,
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
  if (maxStorageBuffersPerShaderStage < 4) {
    throw new RangeError('compact mechanics view requires four storage bindings');
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
  const maxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension'
  );
  for (const [role, byteLength] of [
    ['mechanics view', template.layout.byteLength],
    ['mechanics occupancy', template.layout.occupancyByteLength],
    ['mechanics occupancy counts', template.layout.wordCountByteLength],
    ['mechanics occupancy offsets', template.layout.wordCountByteLength],
    ['mechanics source', resolvedMaxSourceCount * 16 * Float32Array.BYTES_PER_ELEMENT]
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
  const sourceWorkgroups = Math.ceil(
    resolvedMaxSourceCount / SCHROEDER_SPATIAL_MECHANICS_VIEW_WORKGROUP_SIZE
  );
  const occupancyWorkgroups = Math.ceil(
    template.layout.occupancyWordCount
      / SCHROEDER_SPATIAL_MECHANICS_VIEW_WORKGROUP_SIZE
  );
  const indirectNodeWorkgroups = Math.ceil(
    Math.min(
      resolvedGridNodeCount,
      resolvedMaxSourceCount * 27
    ) / SCHROEDER_SPATIAL_MECHANICS_VIEW_WORKGROUP_SIZE
  );
  if (
    sourceWorkgroups > maxComputeWorkgroupsPerDimension
    || occupancyWorkgroups > maxComputeWorkgroupsPerDimension
    || indirectNodeWorkgroups > maxComputeWorkgroupsPerDimension
  ) {
    throw new RangeError(
      'compact mechanics view x-dispatch exceeds maxComputeWorkgroupsPerDimension'
    );
  }

  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: schroederSpatialMechanicsViewWgsl
  });
  const pipelines = Object.freeze({
    mark: device.createComputePipeline({
      label: `${label}-mark-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'mark_mechanics_nodes' }
    }),
    count: device.createComputePipeline({
      label: `${label}-count-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'count_occupied_words' }
    }),
    scatter: device.createComputePipeline({
      label: `${label}-scatter-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'scatter_mechanics_nodes' }
    }),
    finalize: device.createComputePipeline({
      label: `${label}-finalize-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'finalize_mechanics_view' }
    })
  });
  const deviceId = webGpuDeviceId(device);
  let destroyed = false;
  let serial = 0;
  const executionOwnership = new WeakMap();
  const releasedExecutions = new WeakSet();
  const submittedExecutions = new WeakSet();
  const releaseInFlight = new WeakSet();
  let runtime = null;

  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => {
    const arenaLabel = `${label}-arena-${arenaIndex}`;
    return {
      arenaIndex,
      inUse: false,
      token: null,
      paramsBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-params`,
        SCHROEDER_SPATIAL_MECHANICS_VIEW_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      occupancyBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-occupancy`,
        template.layout.occupancyByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      occupancyCountBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-occupancy-counts`,
        template.layout.wordCountByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      occupancyOffsetBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-occupancy-offsets`,
        template.layout.wordCountByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      mechanicsViewBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-view`,
        template.layout.byteLength,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.INDIRECT
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      scan: createWebGpuU32ExclusiveScan(device, {
        maxElementCount: template.layout.occupancyWordCount,
        fixedElementCount: template.layout.occupancyWordCount,
        retainParamsBuffer: true,
        label: `${arenaLabel}-occupancy-scan`
      })
    };
  });

  const allocationEntriesForArena = (arena) => [
    { role: 'mechanics-view-params', arenaIndex: arena.arenaIndex, buffer: arena.paramsBuffer },
    { role: 'mechanics-view-occupancy', arenaIndex: arena.arenaIndex, buffer: arena.occupancyBuffer },
    { role: 'mechanics-view-occupancy-counts', arenaIndex: arena.arenaIndex, buffer: arena.occupancyCountBuffer },
    { role: 'mechanics-view-occupancy-offsets', arenaIndex: arena.arenaIndex, buffer: arena.occupancyOffsetBuffer },
    { role: 'mechanics-view-nodes', arenaIndex: arena.arenaIndex, buffer: arena.mechanicsViewBuffer },
    ...arena.scan.allocationEntries().map((entry) => ({
      ...entry,
      role: `mechanics-view-${entry.role}`,
      arenaIndex: arena.arenaIndex
    }))
  ];
  const retainedGpuBufferBytes = arenas.reduce((sum, arena) => (
    sum + allocationEntriesForArena(arena).reduce(
      (arenaSum, entry) => arenaSum + Number(entry.buffer?.size ?? 0),
      0
    )
  ), 0);

  function acquireArena() {
    const arena = arenas.find((candidate) => candidate.inUse === false);
    if (!arena) {
      const error = new Error('compact mechanics view arenas are under backpressure');
      error.code = 'ERR_SCHROEDER_MECHANICS_VIEW_ARENA_EXHAUSTED';
      throw error;
    }
    const token = Object.freeze({ serial: ++serial, arenaIndex: arena.arenaIndex });
    arena.inUse = true;
    arena.token = token;
    return { arena, token };
  }

  function releaseArena(arena, token) {
    if (!arena.inUse || arena.token !== token) return false;
    arena.inUse = false;
    arena.token = null;
    return true;
  }

  function bindGroup(
    devicePipeline,
    arena,
    sourceBuffer,
    directoryBuffer,
    bindings,
    sourceBindingSize,
    directoryBindingSize
  ) {
    const resources = new Map([
      [0, { buffer: sourceBuffer, offset: 0, size: sourceBindingSize }],
      [1, { buffer: directoryBuffer, offset: 0, size: directoryBindingSize }],
      [2, { buffer: arena.occupancyBuffer }],
      [3, { buffer: arena.occupancyCountBuffer }],
      [4, { buffer: arena.occupancyOffsetBuffer }],
      [5, { buffer: arena.mechanicsViewBuffer }],
      [7, { buffer: arena.paramsBuffer }]
    ]);
    return device.createBindGroup({
      label: `${label}-arena-${arena.arenaIndex}-bindings`,
      layout: devicePipeline.getBindGroupLayout(0),
      entries: bindings.map((binding) => ({
        binding,
        resource: resources.get(binding)
      }))
    });
  }

  function encode(encoder, {
    sourceBuffer,
    sourceCount,
    sourceRowLayoutId,
    selectedLevel,
    spatialExecution
  } = {}) {
    if (destroyed) throw new Error('compact mechanics view runtime is destroyed');
    assertEncoder(encoder);
    if (!sourceBuffer || !webGpuBufferMatchesDevice(sourceBuffer, device)) {
      throw new TypeError('compact mechanics view sourceBuffer must belong to the runtime device');
    }
    if (
      !spatialExecution?.directoryBuffer
      || !webGpuBufferMatchesDevice(spatialExecution.directoryBuffer, device)
    ) {
      throw new TypeError('compact mechanics view requires a same-device spatial directory');
    }
    const resolvedSourceCount = positiveInteger(
      sourceCount,
      'sourceCount',
      resolvedMaxSourceCount
    );
    let spatialOwnerAdmitted = false;
    try {
      spatialOwnerAdmitted = spatialExecution.ownerRuntime?.ownsExecution?.(
        spatialExecution
      ) === true;
    } catch {
      spatialOwnerAdmitted = false;
    }
    if (
      spatialExecution.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
      || spatialExecution.status !== 'schroeder-spatial-epoch-gpu-encoded'
      || spatialExecution.submitPerformed !== false
      || spatialExecution.released === true
      || !spatialOwnerAdmitted
      || spatialExecution.sourceBuffer !== sourceBuffer
      || spatialExecution.sourceCount !== resolvedSourceCount
      || spatialExecution.sourceRowLayoutId !== sourceRowLayoutId
      || spatialExecution.sourceAdapterId
        !== SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
      || spatialExecution.exactNearQueryProfile?.ready !== true
      || spatialExecution.queryGeometryEvidence
        !== spatialExecution.exactNearQueryProfile
    ) {
      throw new TypeError(
        'compact mechanics view requires the exact live encoded spatial source authority'
      );
    }
    const requiredSourceBytes = resolvedSourceCount * 16 * Float32Array.BYTES_PER_ELEMENT;
    if (Number.isFinite(Number(sourceBuffer.size)) && Number(sourceBuffer.size) < requiredSourceBytes) {
      throw new RangeError(
        `compact mechanics sourceBuffer has ${sourceBuffer.size} bytes; ${requiredSourceBytes} required`
      );
    }
    const directoryBindingSize = Number(spatialExecution.layout?.byteLength);
    if (
      !Number.isSafeInteger(directoryBindingSize)
      || directoryBindingSize < 4
      || directoryBindingSize > maxStorageBufferBindingSize
      || (
        Number.isFinite(Number(spatialExecution.directoryBuffer.size))
        && Number(spatialExecution.directoryBuffer.size) < directoryBindingSize
      )
    ) {
      throw new RangeError('compact mechanics spatial directory binding size is invalid');
    }
    const plan = createSchroederSpatialMechanicsViewPlan({
      sourceCount: resolvedSourceCount,
      sourceRowLayoutId,
      selectedLevel,
      gridNodeCount: resolvedGridNodeCount,
      gridDims: template.gridDims,
      gridShift: template.gridShift,
      gridSpacingM: template.gridSpacingM,
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
      completionOrdinal: spatialExecution.buildOrdinal
    });
    const { arena, token } = acquireArena();
    try {
      device.queue.writeBuffer(arena.paramsBuffer, 0, mechanicsParamsData(plan, spatialExecution));
      encoder.clearBuffer(arena.occupancyBuffer);
      encoder.clearBuffer(
        arena.mechanicsViewBuffer,
        0,
        SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS * UINT32_BYTES
      );
      const markBindGroup = bindGroup(
        pipelines.mark,
        arena,
        sourceBuffer,
        spatialExecution.directoryBuffer,
        [0, 1, 2, 5, 7],
        requiredSourceBytes,
        directoryBindingSize
      );
      const countBindGroup = bindGroup(
        pipelines.count,
        arena,
        sourceBuffer,
        spatialExecution.directoryBuffer,
        [2, 3, 7],
        requiredSourceBytes,
        directoryBindingSize
      );
      const scatterBindGroup = bindGroup(
        pipelines.scatter,
        arena,
        sourceBuffer,
        spatialExecution.directoryBuffer,
        [2, 4, 5, 7],
        requiredSourceBytes,
        directoryBindingSize
      );
      const finalizeBindGroup = bindGroup(
        pipelines.finalize,
        arena,
        sourceBuffer,
        spatialExecution.directoryBuffer,
        [1, 3, 4, 5, 7],
        requiredSourceBytes,
        directoryBindingSize
      );
      let encodedDispatchCount = 0;
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.mark,
        markBindGroup,
        [Math.max(1, Math.ceil(plan.sourceCount / SCHROEDER_SPATIAL_MECHANICS_VIEW_WORKGROUP_SIZE)), 1, 1],
        `${label}MarkNodes`
      );
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.count,
        countBindGroup,
        [Math.max(1, Math.ceil(plan.occupancyWordCount / SCHROEDER_SPATIAL_MECHANICS_VIEW_WORKGROUP_SIZE)), 1, 1],
        `${label}CountOccupancy`
      );
      const preparedScan = arena.scan.prepare({
        inputBuffer: arena.occupancyCountBuffer,
        outputBuffer: arena.occupancyOffsetBuffer,
        elementCount: plan.occupancyWordCount
      });
      arena.scan.encodePrepared(encoder, preparedScan, {
        labelPrefix: `${label}Occupancy`
      });
      encodedDispatchCount += preparedScan.encodedDispatchCount;
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.scatter,
        scatterBindGroup,
        [Math.max(1, Math.ceil(plan.occupancyWordCount / SCHROEDER_SPATIAL_MECHANICS_VIEW_WORKGROUP_SIZE)), 1, 1],
        `${label}ScatterNodes`
      );
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.finalize,
        finalizeBindGroup,
        [1, 1, 1],
        `${label}Finalize`
      );
      const execution = {
        ...plan,
        schema: ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
        status: 'schroeder-spatial-mechanics-view-gpu-encoded',
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        sourceBuffer,
        directoryBuffer: spatialExecution.directoryBuffer,
        mechanicsViewBuffer: arena.mechanicsViewBuffer,
        indirectDispatchBuffer: arena.mechanicsViewBuffer,
        indirectDispatchOffsetBytes:
          SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS * UINT32_BYTES,
        occupancyBuffer: arena.occupancyBuffer,
        occupancyCountBuffer: arena.occupancyCountBuffer,
        occupancyOffsetBuffer: arena.occupancyOffsetBuffer,
        encodedDispatchCount,
        encodedComputePassCount: 4 + (preparedScan.encodedComputePassCount ?? 1),
        retainedGpuBufferBytes,
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        readbackPerformed: false,
        submitPerformed: false,
        submissionOwnership: 'caller',
        particleAligned: false,
        uniqueOrdering: 'strict-ascending-dense-grid-index'
      };
      Object.defineProperty(execution, 'ownerRuntime', {
        value: runtime,
        enumerable: false
      });
      Object.defineProperty(execution, 'released', {
        get() {
          return releasedExecutions.has(execution);
        },
        enumerable: true
      });
      executionOwnership.set(execution, { arena, token, sourceBuffer, spatialExecution });
      return execution;
    } catch (error) {
      releaseArena(arena, token);
      throw error;
    }
  }

  function ownershipFor(execution) {
    const ownership = executionOwnership.get(execution);
    if (
      !ownership
      || releasedExecutions.has(execution)
      || releaseInFlight.has(execution)
      || ownership.arena.token !== ownership.token
      || ownership.arena.inUse !== true
      || execution.ownerRuntime !== runtime
      || execution.mechanicsViewBuffer !== ownership.arena.mechanicsViewBuffer
      || execution.indirectDispatchBuffer !== ownership.arena.mechanicsViewBuffer
      || execution.sourceBuffer !== ownership.sourceBuffer
      || execution.directoryBuffer !== ownership.spatialExecution.directoryBuffer
    ) {
      const error = new Error('compact mechanics view execution is not owned by this runtime');
      error.code = 'ERR_SCHROEDER_MECHANICS_VIEW_FOREIGN_EXECUTION';
      throw error;
    }
    return ownership;
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
    Object.defineProperty(execution, 'submitPerformed', {
      value: true,
      enumerable: true
    });
    Object.defineProperty(execution, 'status', {
      value: 'schroeder-spatial-mechanics-view-gpu-build-submitted',
      enumerable: true
    });
    return true;
  }

  function isExecutionSubmitted(execution) {
    return submittedExecutions.has(execution)
      && ownsExecution(execution)
      && execution.submitPerformed === true;
  }

  function finalizeRelease(execution, ownership) {
    const released = releaseArena(ownership.arena, ownership.token);
    if (released) {
      releasedExecutions.add(execution);
      submittedExecutions.delete(execution);
      executionOwnership.delete(execution);
    }
    return released;
  }

  function releaseExecution(execution, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError('releaseExecution requires { discardedEncoder: true }');
    }
    if (submittedExecutions.has(execution)) {
      throw new Error('submitted compact mechanics view requires a queue fence');
    }
    return finalizeRelease(execution, ownershipFor(execution));
  }

  async function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence?.then) {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    const ownership = ownershipFor(execution);
    if (!submittedExecutions.has(execution)) {
      throw new Error('unsubmitted compact mechanics view requires discarded-encoder release');
    }
    releaseInFlight.add(execution);
    try {
      await submissionFence;
      return finalizeRelease(execution, ownership);
    } finally {
      releaseInFlight.delete(execution);
    }
  }

  function destroy() {
    if (destroyed) return false;
    if (arenas.some((arena) => arena.inUse)) {
      throw new Error('compact mechanics view runtime still has active executions');
    }
    destroyed = true;
    for (const arena of arenas) {
      for (const buffer of [
        arena.paramsBuffer,
        arena.occupancyBuffer,
        arena.occupancyCountBuffer,
        arena.occupancyOffsetBuffer,
        arena.mechanicsViewBuffer
      ]) buffer.destroy?.();
      arena.scan.destroy();
    }
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
    status: 'schroeder-spatial-mechanics-view-gpu-runtime-ready',
    deviceId,
    maxSourceCount: resolvedMaxSourceCount,
    gridNodeCount: resolvedGridNodeCount,
    gridDims: template.gridDims,
    gridShift: template.gridShift,
    gridSpacingM: template.gridSpacingM,
    arenaCount: resolvedArenaCount,
    layout: template.layout,
    pipelineCount: 4 + arenas.reduce((sum, arena) => sum + arena.scan.pipelineCount, 0),
    retainedGpuBufferBytes,
    encode,
    ownsExecution,
    markExecutionSubmitted,
    isExecutionSubmitted,
    releaseExecution,
    releaseExecutionAfter,
    allocationEntries: () => arenas.flatMap(allocationEntriesForArena),
    activeExecutionCount: () => arenas.filter((arena) => arena.inUse).length,
    destroy
  };
  return runtime;
}

export {
  SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS,
  ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
  schroederSpatialMechanicsViewWgsl
};
