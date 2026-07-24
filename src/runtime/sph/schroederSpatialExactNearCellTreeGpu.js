import {
  SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_SCHEMA,
  createSchroederSpatialExactNearCellTreeLayout,
  createSchroederSpatialExactNearCellTreePlan
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNearCellTree.js';
import {
  schroederSpatialExactNearCellTreeWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNearCellTreeWgsl.js';
import {
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
  createSchroederSpatialExactNearExpectationV1Data
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const TREE_PARAMS_BYTES = 32;
const TREE_LEVEL_PARAMS_BYTES = 8;
const TREE_LEVEL_UNIFORM_STRIDE_BYTES = 256;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function exactPositiveInteger(value, label, max = 0xffff_ffff) {
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
    throw new TypeError('exact-near cell tree requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
    throw new TypeError(
      'exact-near cell tree encoding requires a caller-owned GPUCommandEncoder-like object'
    );
  }
}

function createBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, size),
    usage
  }), device);
}

function checkBufferLimit(device, byteLength, label) {
  const limits = [
    Number(device?.limits?.maxBufferSize),
    Number(device?.limits?.maxStorageBufferBindingSize)
  ].filter((value) => Number.isFinite(value) && value > 0);
  const limit = limits.length > 0 ? Math.min(...limits) : Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(byteLength) || byteLength < 4 || byteLength > limit) {
    throw new RangeError(`${label} exceeds the WebGPU buffer limit`);
  }
}

function assertOwnedSpatialExecution(spatialExecution, device, maxSourceCount, cellCapacity) {
  let owned = false;
  try {
    owned = spatialExecution?.ownerRuntime?.ownsExecution?.(spatialExecution) === true;
  } catch {
    owned = false;
  }
  if (
    spatialExecution?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
    || spatialExecution?.released === true
    || !owned
    || ![
      'schroeder-spatial-epoch-gpu-encoded',
      'schroeder-spatial-epoch-gpu-build-submitted'
    ].includes(spatialExecution.status)
    || spatialExecution.sourceCapacity !== maxSourceCount
    || spatialExecution.layout?.cellCapacity !== cellCapacity
    || !spatialExecution.directoryBuffer
    || !webGpuBufferMatchesDevice(spatialExecution.directoryBuffer, device)
  ) {
    throw new TypeError(
      'exact-near cell tree requires one exact live canonical spatial execution'
    );
  }
}

function planForSpatialExecution(spatialExecution) {
  return createSchroederSpatialExactNearCellTreePlan({
    sourceCount: spatialExecution.sourceCount,
    sourceCapacity: spatialExecution.sourceCapacity,
    cellCapacity: spatialExecution.layout.cellCapacity,
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
    directoryCapacityWords: spatialExecution.layout.wordLength,
    cellKeysOffsetWords: spatialExecution.layout.cellKeysOffsetWords,
    cellOffsetsOffsetWords: spatialExecution.layout.cellOffsetsOffsetWords,
    cellMembersOffsetWords: spatialExecution.layout.cellMembersOffsetWords,
    particleToCellOffsetWords: spatialExecution.layout.particleToCellOffsetWords,
    completionOrdinal: spatialExecution.buildOrdinal
  });
}

function expectationDataForSpatialExecution(spatialExecution, supportProfileId) {
  if (
    !spatialExecution?.exactNearQueryProfile?.ready
    || !Number.isInteger(spatialExecution.queryChartId)
    || !Number.isInteger(spatialExecution.queryLevelCount)
    || !Number.isInteger(spatialExecution.queryMinLevel)
    || !Number.isFinite(spatialExecution.queryBaseGridSpacingM)
  ) {
    throw new TypeError(
      'exact-near cell tree requires the canonical execution query-geometry profile'
    );
  }
  return createSchroederSpatialExactNearExpectationV1Data({
    sourceCount: spatialExecution.sourceCount,
    derivationEnabled: true,
    supportProfileId,
    chartId: spatialExecution.queryChartId,
    levelCount: spatialExecution.queryLevelCount,
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
    minLevel: spatialExecution.queryMinLevel,
    baseGridSpacingM: spatialExecution.queryBaseGridSpacingM,
    cellKeysOffsetWords: spatialExecution.layout.cellKeysOffsetWords,
    cellOffsetsOffsetWords: spatialExecution.layout.cellOffsetsOffsetWords,
    cellMembersOffsetWords: spatialExecution.layout.cellMembersOffsetWords,
    particleToCellOffsetWords: spatialExecution.layout.particleToCellOffsetWords,
    directoryCapacityWords: spatialExecution.layout.wordLength,
    sourceCapacity: spatialExecution.sourceCapacity,
    cellCapacity: spatialExecution.layout.cellCapacity
  });
}

function treeParamsData(plan) {
  return new Uint32Array([
    plan.layout.leafCapacity,
    plan.layout.nodeCapacity,
    plan.layout.nodeOffsetWords,
    plan.layout.treeDepth,
    plan.layout.wordLength,
    plan.layout.cellCapacity,
    plan.layout.nodeWords,
    0
  ]);
}

function levelParamsData(levelStart, levelCount) {
  return new Uint32Array([levelStart, levelCount]);
}

function encodePass(encoder, pipeline, bindGroup, workgroups, label) {
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...workgroups);
  pass.end();
  return 1;
}

export function createSchroederSpatialExactNearCellTreeGpu(device, {
  maxSourceCount,
  cellCapacity = maxSourceCount,
  arenaCount = 2,
  label = 'ulg-schroeder-spatial-exact-near-cell-tree'
} = {}) {
  assertDevice(device);
  const resolvedMaxSourceCount = exactPositiveInteger(
    maxSourceCount,
    'maxSourceCount'
  );
  const resolvedCellCapacity = exactPositiveInteger(cellCapacity, 'cellCapacity');
  if (resolvedCellCapacity > resolvedMaxSourceCount) {
    throw new RangeError('cellCapacity must not exceed maxSourceCount');
  }
  const resolvedArenaCount = exactPositiveInteger(arenaCount, 'arenaCount', 8);
  const layout = createSchroederSpatialExactNearCellTreeLayout({
    cellCapacity: resolvedCellCapacity
  });
  checkBufferLimit(device, layout.byteLength, 'exact-near cell tree');
  checkBufferLimit(
    device,
    SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES,
    'exact-near cell-tree expectation uniform'
  );
  const maxStorageBuffers = Number(device.limits?.maxStorageBuffersPerShaderStage);
  if (Number.isFinite(maxStorageBuffers) && maxStorageBuffers > 0 && maxStorageBuffers < 2) {
    throw new RangeError('exact-near cell tree requires two storage bindings');
  }
  const maxWorkgroups = Number(device.limits?.maxComputeWorkgroupsPerDimension);
  const maximumLeafWorkgroups = Math.ceil(
    resolvedCellCapacity / SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_WORKGROUP_SIZE
  );
  if (Number.isFinite(maxWorkgroups) && maxWorkgroups > 0 && maximumLeafWorkgroups > maxWorkgroups) {
    throw new RangeError('exact-near cell tree leaf dispatch exceeds the WebGPU limit');
  }

  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: schroederSpatialExactNearCellTreeWgsl
  });
  const pipelines = Object.freeze({
    initialize: device.createComputePipeline({
      label: `${label}-initialize-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'initialize_exact_near_cell_tree' }
    }),
    leaves: device.createComputePipeline({
      label: `${label}-leaves-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'build_exact_near_cell_tree_leaves' }
    }),
    reduce: device.createComputePipeline({
      label: `${label}-reduce-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'reduce_exact_near_cell_tree_level' }
    }),
    finalize: device.createComputePipeline({
      label: `${label}-finalize-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'finalize_exact_near_cell_tree' }
    })
  });

  const deviceId = webGpuDeviceId(device);
  let destroyed = false;
  let serial = 0;
  const executionOwnership = new WeakMap();
  const submittedExecutions = new WeakSet();
  const releasedExecutions = new WeakSet();
  const releaseInFlight = new WeakSet();
  let runtime = null;
  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => {
    const prefix = `${label}-arena-${arenaIndex}`;
    return {
      arenaIndex,
      inUse: false,
      token: null,
      treeBuffer: createBuffer(
        device,
        `${prefix}-tree`,
        layout.byteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      expectationBuffer: createBuffer(
        device,
        `${prefix}-expectation`,
        SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      paramsBuffer: createBuffer(
        device,
        `${prefix}-params`,
        TREE_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      levelParamsBuffer: createBuffer(
        device,
        `${prefix}-level-params`,
        Math.max(TREE_LEVEL_UNIFORM_STRIDE_BYTES, layout.treeDepth * TREE_LEVEL_UNIFORM_STRIDE_BYTES),
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      )
    };
  });

  function allocationEntries() {
    return arenas.flatMap((arena) => [
      { role: 'exact-near-cell-tree', arenaIndex: arena.arenaIndex, buffer: arena.treeBuffer },
      { role: 'exact-near-cell-tree-expectation', arenaIndex: arena.arenaIndex, buffer: arena.expectationBuffer },
      { role: 'exact-near-cell-tree-params', arenaIndex: arena.arenaIndex, buffer: arena.paramsBuffer },
      { role: 'exact-near-cell-tree-level-params', arenaIndex: arena.arenaIndex, buffer: arena.levelParamsBuffer }
    ]);
  }

  const retainedGpuBufferBytes = allocationEntries().reduce(
    (sum, entry) => sum + Number(entry.buffer?.size ?? 0),
    0
  );

  function acquireArena() {
    if (destroyed) {
      const error = new Error('exact-near cell tree runtime is destroyed');
      error.code = 'ERR_SCHROEDER_EXACT_CELL_TREE_RUNTIME_DESTROYED';
      throw error;
    }
    const arena = arenas.find((candidate) => candidate.inUse === false);
    if (!arena) {
      const error = new Error('exact-near cell tree arenas are under backpressure');
      error.code = 'ERR_SCHROEDER_EXACT_CELL_TREE_ARENA_EXHAUSTED';
      throw error;
    }
    const token = Object.freeze({ serial: ++serial, arenaIndex: arena.arenaIndex });
    arena.inUse = true;
    arena.token = token;
    return { arena, token };
  }

  function ownershipFor(execution) {
    const ownership = executionOwnership.get(execution);
    if (
      !ownership
      || releasedExecutions.has(execution)
      || ownership.runtime !== runtime
      || ownership.arena.inUse !== true
      || ownership.arena.token !== ownership.token
      || execution?.schema !== ULG_SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_SCHEMA
      || execution?.ownerRuntime !== runtime
      || execution?.deviceId !== deviceId
      || execution?.arenaIndex !== ownership.arena.arenaIndex
      || execution?.arenaGeneration !== ownership.token.serial
      || execution?.spatialExecution !== ownership.spatialExecution
      || execution?.directoryBuffer !== ownership.directoryBuffer
      || execution?.treeBuffer !== ownership.arena.treeBuffer
      || execution?.expectationBuffer !== ownership.arena.expectationBuffer
      || execution?.supportProfileId !== ownership.supportProfileId
      || execution?.layout !== ownership.plan.layout
    ) {
      const error = new Error('exact-near cell tree execution is not owned by this runtime');
      error.code = 'ERR_SCHROEDER_EXACT_CELL_TREE_FOREIGN_EXECUTION';
      throw error;
    }
    return ownership;
  }

  function releaseOwnedExecution(execution, ownership = ownershipFor(execution)) {
    if (releasedExecutions.has(execution)) return false;
    if (ownership.arena.inUse && ownership.arena.token === ownership.token) {
      ownership.arena.inUse = false;
      ownership.arena.token = null;
    }
    submittedExecutions.delete(execution);
    executionOwnership.delete(execution);
    execution.status = 'schroeder-spatial-exact-near-cell-tree-released';
    releasedExecutions.add(execution);
    return true;
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
    if (!ownsExecution(execution)) return false;
    submittedExecutions.add(execution);
    execution.status = 'schroeder-spatial-exact-near-cell-tree-build-submitted';
    execution.submitPerformed = true;
    return true;
  }

  function isExecutionSubmitted(execution) {
    return ownsExecution(execution)
      && submittedExecutions.has(execution)
      && execution.submitPerformed === true;
  }

  function releaseExecution(execution, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError('releaseExecution requires { discardedEncoder: true }');
    }
    const ownership = ownershipFor(execution);
    if (submittedExecutions.has(execution)) {
      const error = new Error('submitted exact-near cell tree requires a queue fence');
      error.code = 'ERR_SCHROEDER_EXACT_CELL_TREE_SUBMITTED_RELEASE';
      throw error;
    }
    return releaseOwnedExecution(execution, ownership);
  }

  function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence?.then) {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    if (releasedExecutions.has(execution)) return Promise.resolve(false);
    const ownership = ownershipFor(execution);
    if (releaseInFlight.has(execution)) return execution.releasePromise;
    if (!submittedExecutions.has(execution)) {
      const error = new Error('cannot schedule release for an unsubmitted exact-near cell tree');
      error.code = 'ERR_SCHROEDER_EXACT_CELL_TREE_UNSUBMITTED_RELEASE';
      throw error;
    }
    releaseInFlight.add(execution);
    const completion = Promise.resolve(submissionFence)
      .then(() => releaseOwnedExecution(execution, ownership))
      .catch((error) => {
        execution.releaseScheduled = false;
        execution.status = 'schroeder-spatial-exact-near-cell-tree-release-blocked';
        throw error;
      })
      .finally(() => releaseInFlight.delete(execution));
    execution.releaseScheduled = true;
    execution.releasePromise = completion;
    completion.catch(() => {});
    return completion;
  }

  function quarantineExecutionAfterDeviceLoss(execution) {
    if (releasedExecutions.has(execution)) return false;
    const ownership = ownershipFor(execution);
    execution.deviceLost = true;
    return releaseOwnedExecution(execution, ownership);
  }

  function bindGroup(pipeline, entries, suffix, arenaIndex) {
    return device.createBindGroup({
      label: `${label}-arena-${arenaIndex}-${suffix}-bindings`,
      layout: pipeline.getBindGroupLayout(0),
      entries
    });
  }

  function encode(encoder, {
    spatialExecution,
    supportProfileId = SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
  } = {}) {
    assertEncoder(encoder);
    assertOwnedSpatialExecution(
      spatialExecution,
      device,
      resolvedMaxSourceCount,
      resolvedCellCapacity
    );
    const plan = planForSpatialExecution(spatialExecution);
    const expectationData = expectationDataForSpatialExecution(
      spatialExecution,
      supportProfileId
    );
    const { arena, token } = acquireArena();
    try {
      device.queue.writeBuffer(arena.expectationBuffer, 0, expectationData);
      device.queue.writeBuffer(arena.paramsBuffer, 0, treeParamsData(plan));
      for (let depth = 0; depth < plan.layout.treeDepth; depth += 1) {
        const levelStart = (2 ** depth) - 1;
        const levelCount = 2 ** depth;
        device.queue.writeBuffer(
          arena.levelParamsBuffer,
          depth * TREE_LEVEL_UNIFORM_STRIDE_BYTES,
          levelParamsData(levelStart, levelCount)
        );
      }
      encoder.clearBuffer(arena.treeBuffer);
      const initializationEntries = [
        { binding: 0, resource: { buffer: spatialExecution.directoryBuffer } },
        { binding: 1, resource: { buffer: arena.treeBuffer } },
        { binding: 2, resource: { buffer: arena.expectationBuffer } },
        { binding: 3, resource: { buffer: arena.paramsBuffer } }
      ];
      const leafEntries = [
        { binding: 0, resource: { buffer: spatialExecution.directoryBuffer } },
        { binding: 1, resource: { buffer: arena.treeBuffer } },
        { binding: 2, resource: { buffer: arena.expectationBuffer } },
        { binding: 3, resource: { buffer: arena.paramsBuffer } }
      ];
      let encodedDispatchCount = 0;
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.initialize,
        bindGroup(
          pipelines.initialize,
          initializationEntries,
          'initialize',
          arena.arenaIndex
        ),
        [1, 1, 1],
        `${label}Initialize`
      );
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.leaves,
        bindGroup(pipelines.leaves, leafEntries, 'leaves', arena.arenaIndex),
        [maximumLeafWorkgroups, 1, 1],
        `${label}Leaves`
      );
      for (let depth = plan.layout.treeDepth - 1; depth >= 0; depth -= 1) {
        const levelCount = 2 ** depth;
        const levelEntries = [
          { binding: 1, resource: { buffer: arena.treeBuffer } },
          { binding: 3, resource: { buffer: arena.paramsBuffer } },
          {
            binding: 4,
            resource: {
              buffer: arena.levelParamsBuffer,
              offset: depth * TREE_LEVEL_UNIFORM_STRIDE_BYTES,
              size: TREE_LEVEL_PARAMS_BYTES
            }
          }
        ];
        encodedDispatchCount += encodePass(
          encoder,
          pipelines.reduce,
          bindGroup(pipelines.reduce, levelEntries, `reduce-${depth}`, arena.arenaIndex),
          [
            Math.ceil(levelCount / SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_WORKGROUP_SIZE),
            1,
            1
          ],
          `${label}ReduceLevel${depth}`
        );
      }
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.finalize,
        bindGroup(
          pipelines.finalize,
          [
            { binding: 1, resource: { buffer: arena.treeBuffer } },
            { binding: 3, resource: { buffer: arena.paramsBuffer } }
          ],
          'finalize',
          arena.arenaIndex
        ),
        [1, 1, 1],
        `${label}Finalize`
      );
      const execution = {
        ...plan,
        schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_SCHEMA,
        status: 'schroeder-spatial-exact-near-cell-tree-encoded',
        ready: true,
        backend: 'webgpu',
        deviceId,
        ownerRuntime: runtime,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        spatialExecution,
        directoryBuffer: spatialExecution.directoryBuffer,
        treeBuffer: arena.treeBuffer,
        expectationBuffer: arena.expectationBuffer,
        supportProfileId,
        encodedDispatchCount,
        encodedComputePassCount: encodedDispatchCount,
        treeBuildDispatchCount: encodedDispatchCount,
        materializedCandidateRowCount: 0,
        privateLookupBuildCount: 0,
        fixedCandidateBudget: null,
        fullReadbackPerformed: false,
        submitPerformed: false,
        releaseScheduled: false,
        retainedGpuBufferBytes: Number(arena.treeBuffer.size ?? layout.byteLength)
          + Number(arena.expectationBuffer.size ?? 0)
          + Number(arena.paramsBuffer.size ?? 0)
          + Number(arena.levelParamsBuffer.size ?? 0)
      };
      Object.defineProperties(execution, {
        ownerRuntime: { value: runtime, enumerable: true },
        released: {
          get() { return releasedExecutions.has(execution); },
          enumerable: true
        }
      });
      executionOwnership.set(execution, {
        runtime,
        arena,
        token,
        plan,
        spatialExecution,
        directoryBuffer: spatialExecution.directoryBuffer,
        supportProfileId
      });
      return execution;
    } catch (error) {
      if (arena.inUse && arena.token === token) {
        arena.inUse = false;
        arena.token = null;
      }
      throw error;
    }
  }

  function destroy() {
    if (destroyed) return false;
    const active = arenas.filter((arena) => arena.inUse).map((arena) => arena.arenaIndex);
    if (active.length > 0) {
      const error = new Error(`exact-near cell tree has active arenas ${active.join(', ')}`);
      error.code = 'ERR_SCHROEDER_EXACT_CELL_TREE_ACTIVE_EXECUTIONS';
      throw error;
    }
    destroyed = true;
    for (const arena of arenas) {
      arena.treeBuffer.destroy?.();
      arena.expectationBuffer.destroy?.();
      arena.paramsBuffer.destroy?.();
      arena.levelParamsBuffer.destroy?.();
    }
    runtime.status = 'schroeder-spatial-exact-near-cell-tree-runtime-destroyed';
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_SCHEMA,
    status: 'schroeder-spatial-exact-near-cell-tree-runtime-ready',
    deviceId,
    maxSourceCount: resolvedMaxSourceCount,
    cellCapacity: resolvedCellCapacity,
    arenaCount: resolvedArenaCount,
    layout,
    retainedGpuBufferBytes,
    submissionOwnership: 'caller',
    readbackPolicy: 'explicit-probe-only',
    encode,
    ownsExecution,
    markExecutionSubmitted,
    isExecutionSubmitted,
    releaseExecution,
    releaseExecutionAfter,
    quarantineExecutionAfterDeviceLoss,
    allocationEntries,
    destroy
  };
  return runtime;
}

/** Validate the exact tree handoff before a law binds it as a storage input. */
export function resolveSchroederSpatialExactNearCellTreeForConsumer(
  cellTree,
  { device, spatialExecution, supportProfileId = null } = {}
) {
  let owned = false;
  let submitted = false;
  try {
    owned = cellTree?.ownerRuntime?.ownsExecution?.(cellTree) === true;
    submitted = cellTree?.ownerRuntime?.isExecutionSubmitted?.(cellTree) === true;
  } catch {
    owned = false;
    submitted = false;
  }
  const identityFields = [
    'generationId', 'deviceOrdinal', 'laneOrdinal', 'leaseToken',
    'sourceFamilyId', 'storageGeneration', 'physicsTick', 'physicsSubstep',
    'positionEpoch', 'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch'
  ];
  const identityMatches = identityFields.every((field) => (
    Object.is(cellTree?.[field], spatialExecution?.[field])
  ));
  if (
    !owned
    || !submitted
    || cellTree?.schema !== ULG_SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_SCHEMA
    || cellTree?.status !== 'schroeder-spatial-exact-near-cell-tree-build-submitted'
    || cellTree?.released === true
    || cellTree?.releaseScheduled === true
    || cellTree?.deviceLost === true
    || cellTree?.submitPerformed !== true
    || cellTree?.spatialExecution !== spatialExecution
    || cellTree?.directoryBuffer !== spatialExecution?.directoryBuffer
    || !webGpuBufferMatchesDevice(cellTree?.treeBuffer, device)
    || !identityMatches
    || (supportProfileId != null && cellTree.supportProfileId !== supportProfileId)
  ) {
    return Object.freeze({
      ready: false,
      status: 'schroeder-spatial-exact-near-cell-tree-rejected-consumer-identity'
    });
  }
  return Object.freeze({
    ready: true,
    status: 'schroeder-spatial-exact-near-cell-tree-admitted-consumer-identity',
    treeBuffer: cellTree.treeBuffer,
    tree: cellTree
  });
}
