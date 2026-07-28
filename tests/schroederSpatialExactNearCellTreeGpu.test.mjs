import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_HEADER_WORDS,
  SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_WORDS,
  SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_REVERSE_CELL_PLUS_ONE,
  SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_STATUS_READY,
  SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_V2_ABI,
  SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_V2_HEADER_LAYOUT,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_V2_SCHEMA,
  createSchroederSpatialExactNearCellTreeLayout,
  createSchroederSpatialExactNearCellTreePlan,
  createSchroederSpatialExactNearCellTreeV2Layout,
  createSchroederSpatialExactNearCellTreeV2Plan
} from '../ulg-gpu-abi/src/schroederSpatialExactNearCellTree.js';
import {
  createSchroederSpatialExactNearCellTreeTraversalV2Wgsl,
  schroederSpatialExactNearCellTreeV2Wgsl,
  schroederSpatialExactNearCellTreeWgsl
} from '../ulg-gpu-abi/src/schroederSpatialExactNearCellTreeWgsl.js';
import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
} from '../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  SCHROEDER_SPATIAL_EPOCH_MAGIC,
  SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
  createSchroederSpatialEpochLayout,
  createSchroederSpatialEpochV2Layout
} from '../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
  createSchroederSpatialActiveSourceFingerprint,
  createSchroederSpatialActiveSourceViewLayout
} from '../ulg-gpu-abi/src/schroederSpatialActiveSourceView.js';
import {
  createSchroederSpatialExactNearCellTreeGpu,
  resolveSchroederSpatialExactNearCellTreeForConsumer
} from '../src/runtime/sph/schroederSpatialExactNearCellTreeGpu.js';
import {
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function createFakeEncoder() {
  const events = [];
  return {
    events,
    clearBuffer(buffer, offset = 0, size = null) {
      events.push({ kind: 'clear', buffer, offset, size });
    },
    beginComputePass(descriptor = {}) {
      const event = { kind: 'pass', descriptor, commands: [] };
      events.push(event);
      let pipeline = null;
      return {
        setPipeline(value) { pipeline = value; },
        setBindGroup() {},
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.commands.push({ pipeline: pipeline?.compute?.entryPoint, x, y, z });
        },
        end() { event.ended = true; }
      };
    }
  };
}

function createFakeDevice() {
  const buffers = [];
  const writes = [];
  const device = {
    buffers,
    writes,
    limits: {
      maxBufferSize: 128 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65535
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, data: new Uint8Array(
          data.buffer,
          data.byteOffset,
          data.byteLength
        ).slice() });
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroy() { this.destroyed = true; }
      };
      buffers.push(buffer);
      return tagWebGpuBufferDevice(buffer, device);
    },
    createShaderModule(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) { return { index, entryPoint: descriptor.compute.entryPoint }; }
      };
    },
    createBindGroup(descriptor) { return descriptor; }
  };
  return device;
}

function createSpatialExecution(device, { sourceCapacity = 8, sourceCount = 3 } = {}) {
  const layout = createSchroederSpatialEpochLayout({
    sourceCapacity,
    cellCapacity: sourceCapacity
  });
  const directoryBuffer = device.createBuffer({
    label: 'exact-cell-tree-directory',
    size: layout.byteLength,
    usage: 128
  });
  let execution = null;
  const ownerRuntime = {
    ownsExecution(candidate) { return candidate === execution; }
  };
  execution = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
    status: 'schroeder-spatial-epoch-gpu-encoded',
    released: false,
    ownerRuntime,
    sourceCount,
    sourceCapacity,
    layout,
    directoryBuffer,
    generationId: 7,
    deviceOrdinal: 0,
    laneOrdinal: 0,
    leaseToken: 7,
    sourceFamilyId: 17,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 19,
    topologyEpoch: 23,
    chartEpoch: 29,
    levelEpoch: 31,
    supportEpoch: 37,
    buildOrdinal: 7,
    exactNearQueryProfile: { ready: true },
    queryChartId: 0,
    queryLevelCount: 3,
    queryMinLevel: -1,
    queryBaseGridSpacingM: 0.25
  };
  return execution;
}

function createSpatialV2Execution(
  device,
  {
    physicalSourceCount = 8,
    activeSourceCapacity = 3
  } = {}
) {
  const sourceBuffer = device.createBuffer({
    label: 'exact-cell-tree-v2-source',
    size: physicalSourceCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const activeLayout = createSchroederSpatialActiveSourceViewLayout({
    physicalSourceCapacity: physicalSourceCount,
    activeSourceCapacity
  });
  const activeSourceViewBuffer = device.createBuffer({
    label: 'exact-cell-tree-v2-active-source',
    size: activeLayout.byteLength,
    usage: 128 | 256
  });
  const layout = createSchroederSpatialEpochV2Layout({
    physicalSourceCapacity: physicalSourceCount,
    activeSourceCapacity,
    cellCapacity: activeSourceCapacity
  });
  const directoryBuffer = device.createBuffer({
    label: 'exact-cell-tree-v2-directory',
    size: layout.byteLength,
    usage: 128
  });
  const identity = {
    generationId: 7,
    deviceOrdinal: 0,
    laneOrdinal: 0,
    leaseToken: 7,
    sourceFamilyId: 17,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 19,
    topologyEpoch: 23,
    chartEpoch: 29,
    levelEpoch: 31,
    supportEpoch: 37,
    buildOrdinal: 7
  };
  const sourceFingerprint = createSchroederSpatialActiveSourceFingerprint({
    ...identity,
    physicalSourceCount,
    physicalSourceCapacity: physicalSourceCount,
    activeSourceCapacity,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceRowStrideFloats: 16,
    queryGeometryMode: 1,
    queryChartId: 0,
    queryMinLevel: -1,
    queryMaxLevel: 1,
    queryBaseGridSpacingM: 0.25
  });
  let activeSourceView = null;
  const activeOwnerRuntime = {
    ownsExecution(candidate) {
      return candidate === activeSourceView;
    }
  };
  activeSourceView = {
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
    status: 'schroeder-spatial-active-source-view-gpu-encoded',
    ready: true,
    selected: true,
    sourceBuffer,
    activeSourceViewBuffer,
    layout: activeLayout,
    physicalSourceCount,
    physicalSourceCapacity: physicalSourceCount,
    activeSourceCapacity,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceRowStrideFloats: 16,
    ...identity,
    sourceFingerprint,
    activeDispatchOffsetBytes: activeLayout.activeDispatchOffsetBytes,
    candidateDispatchOffsetBytes: activeLayout.candidateDispatchOffsetBytes,
    physicalDispatchOffsetBytes: activeLayout.physicalDispatchOffsetBytes,
    ownerRuntime: activeOwnerRuntime
  };
  let execution = null;
  const ownerRuntime = {
    ownsExecution(candidate) {
      return candidate === execution;
    }
  };
  execution = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
    status: 'schroeder-spatial-epoch-v2-gpu-encoded',
    magic: SCHROEDER_SPATIAL_EPOCH_MAGIC,
    abiVersion: SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
    reverseEncoding: SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
    deviceId: webGpuDeviceId(device),
    released: false,
    ownerRuntime,
    sourceBuffer,
    sourceCount: physicalSourceCount,
    sourceCapacity: physicalSourceCount,
    physicalSourceCount,
    physicalSourceCapacity: physicalSourceCount,
    activeSourceCapacity,
    layout,
    directoryBuffer,
    activeSourceView,
    activeSourceViewBuffer,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    ...identity,
    exactNearQueryProfile: { ready: true },
    queryChartId: 0,
    queryLevelCount: 3,
    queryMinLevel: -1,
    queryBaseGridSpacingM: 0.25
  };
  return execution;
}

test('exact-cell tree ABI fixes a power-of-two complete hierarchy without candidate rows', () => {
  const layout = createSchroederSpatialExactNearCellTreeLayout({ cellCapacity: 7 });
  assert.equal(layout.headerWords, SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_HEADER_WORDS);
  assert.equal(layout.nodeWords, SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_WORDS);
  assert.equal(layout.leafCapacity, 8);
  assert.equal(layout.nodeCapacity, 15);
  assert.equal(layout.wordLength, 40 + 15 * 8);

  const plan = createSchroederSpatialExactNearCellTreePlan({
    sourceCount: 3,
    sourceCapacity: 8,
    cellCapacity: 8,
    generationId: 7,
    deviceOrdinal: 0,
    laneOrdinal: 0,
    leaseToken: 7,
    sourceFamilyId: 17,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 19,
    topologyEpoch: 23,
    chartEpoch: 29,
    levelEpoch: 31,
    supportEpoch: 37,
    directoryCapacityWords: 200,
    cellKeysOffsetWords: 48,
    cellOffsetsOffsetWords: 88,
    cellMembersOffsetWords: 97,
    particleToCellOffsetWords: 105,
    completionOrdinal: 7
  });
  assert.equal(plan.materializedCandidateRows, false);
  assert.equal(plan.perSourceCandidateBudget, null);
  assert.throws(
    () => createSchroederSpatialExactNearCellTreeLayout({ cellCapacity: 0 }),
    /cellCapacity/
  );
  const insufficientStorageDevice = createFakeDevice();
  insufficientStorageDevice.limits.maxStorageBuffersPerShaderStage = 1;
  assert.throws(
    () => createSchroederSpatialExactNearCellTreeGpu(insufficientStorageDevice, {
      maxSourceCount: 8,
      cellCapacity: 8
    }),
    /two storage bindings/
  );
});

test('exact-cell tree v2 authenticates the active CSR span and physical reverse encoding', () => {
  assert.equal(SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_V2_HEADER_LAYOUT.length, 40);
  assert.equal(
    SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_V2_HEADER_LAYOUT[16],
    'physicalSourceCount:u32'
  );
  assert.equal(
    SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_V2_HEADER_LAYOUT[34],
    'activeSourceCount:u32'
  );
  assert.equal(
    SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_V2_HEADER_LAYOUT[35],
    'reverseEncoding:u32'
  );
  assert.equal(SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_V2_ABI.version, 2);
  assert.equal(
    SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_V2_ABI.activeSourceCountAuthorityWord,
    37
  );

  const layout = createSchroederSpatialExactNearCellTreeV2Layout({
    cellCapacity: 8
  });
  assert.equal(layout.version, 2);
  assert.equal(layout.leafCapacity, 8);
  assert.equal(layout.nodeCapacity, 15);

  const plan = createSchroederSpatialExactNearCellTreeV2Plan({
    physicalSourceCount: 12,
    physicalSourceCapacity: 16,
    cellCapacity: 8,
    generationId: 7,
    deviceOrdinal: 0,
    laneOrdinal: 0,
    leaseToken: 7,
    sourceFamilyId: 17,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 19,
    topologyEpoch: 23,
    chartEpoch: 29,
    levelEpoch: 31,
    supportEpoch: 37,
    directoryCapacityWords: 135,
    cellKeysOffsetWords: 48,
    cellOffsetsOffsetWords: 88,
    cellMembersOffsetWords: 97,
    physicalToCellPlusOneOffsetWords: 113,
    completionOrdinal: 7
  });
  assert.equal(plan.abiVersion, 2);
  assert.equal(plan.physicalSourceCount, 12);
  assert.equal(plan.physicalSourceCapacity, 16);
  assert.equal(plan.physicalToCellPlusOneOffsetWords, 113);
  assert.equal(plan.activeSourceCountAuthorityWord, 37);
  assert.equal(
    plan.reverseEncoding,
    SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_REVERSE_CELL_PLUS_ONE
  );

  const traversal = createSchroederSpatialExactNearCellTreeTraversalV2Wgsl({
    treeBindingName: 'level_assignment_tree',
    directoryBindingName: 'level_assignment_directory'
  });
  assert.match(
    traversal,
    /expected: SchroederSpatialExactNearExpectationV2/
  );
  assert.match(traversal, /SS_EXACT_CELL_TREE_VERSION: u32 = 2u/);
  assert.match(
    traversal,
    /level_assignment_tree\[34u\][\s\S]*level_assignment_directory\[SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT\]/
  );
  assert.match(
    traversal,
    /level_assignment_tree\[35u\] == SS_EXACT_CELL_TREE_REVERSE_CELL_PLUS_ONE/
  );

  assert.match(
    schroederSpatialExactNearCellTreeV2Wgsl,
    /var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV2/
  );
  assert.match(schroederSpatialExactNearCellTreeV2Wgsl, /TREE_VERSION: u32 = 2u/);
  assert.match(
    schroederSpatialExactNearCellTreeV2Wgsl,
    /tree_store\(\s*H_ACTIVE_SOURCE_COUNT,\s*spatial_directory\[SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT\]/
  );
  assert.match(
    schroederSpatialExactNearCellTreeV2Wgsl,
    /end > tree_load\(H_ACTIVE_SOURCE_COUNT\)/
  );
  assert.doesNotMatch(
    schroederSpatialExactNearCellTreeWgsl,
    /H_ACTIVE_SOURCE_COUNT/
  );
});

test('exact-cell tree builds once from an owned directory and fails closed for stale consumers', async () => {
  const device = createFakeDevice();
  const spatialExecution = createSpatialExecution(device);
  const runtime = createSchroederSpatialExactNearCellTreeGpu(device, {
    maxSourceCount: 8,
    cellCapacity: 8,
    arenaCount: 1
  });
  const buffersBeforeEncode = device.buffers.length;
  const firstEncoder = createFakeEncoder();
  const first = runtime.encode(firstEncoder, { spatialExecution });

  assert.equal(first.encodedDispatchCount, 6);
  assert.equal(first.materializedCandidateRowCount, 0);
  assert.equal(first.privateLookupBuildCount, 0);
  assert.equal(first.retainedGpuBufferBytes, runtime.retainedGpuBufferBytes);
  assert.equal(device.buffers.length, buffersBeforeEncode);
  assert.equal(firstEncoder.events.filter((event) => event.kind === 'pass').length, 6);
  assert.deepEqual(
    firstEncoder.events.filter((event) => event.kind === 'pass')
      .flatMap((event) => event.commands.map((command) => command.pipeline)),
    [
      'initialize_exact_near_cell_tree',
      'build_exact_near_cell_tree_leaves',
      'reduce_exact_near_cell_tree_level',
      'reduce_exact_near_cell_tree_level',
      'reduce_exact_near_cell_tree_level',
      'finalize_exact_near_cell_tree'
    ]
  );
  const treeBuildCommands = firstEncoder.events
    .filter((event) => event.kind === 'pass')
    .flatMap((event) => event.commands);
  assert.deepEqual(
    treeBuildCommands.slice(1, 5).map((command) => [command.x, command.y, command.z]),
    [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]
  );
  assert.equal(runtime.markExecutionSubmitted(first), true);
  assert.equal(runtime.isExecutionSubmitted(first), true);
  const admitted = resolveSchroederSpatialExactNearCellTreeForConsumer(first, {
    device,
    spatialExecution,
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
  });
  assert.equal(admitted.ready, true);
  assert.equal(admitted.treeBuffer, first.treeBuffer);

  const originalTreeBuffer = first.treeBuffer;
  first.treeBuffer = device.createBuffer({
    label: 'forged-exact-cell-tree',
    size: originalTreeBuffer.size,
    usage: 128
  });
  assert.equal(runtime.isExecutionSubmitted(first), false);
  assert.equal(
    resolveSchroederSpatialExactNearCellTreeForConsumer(first, {
      device,
      spatialExecution,
      supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
    }).ready,
    false
  );
  first.treeBuffer = originalTreeBuffer;
  assert.equal(runtime.isExecutionSubmitted(first), true);
  assert.throws(
    () => runtime.releaseExecution(first),
    /discardedEncoder/
  );
  assert.throws(
    () => runtime.releaseExecution(first, { discardedEncoder: true }),
    /requires a queue fence/
  );
  assert.throws(
    () => runtime.releaseExecutionAfter(first, null),
    /submission-fence thenable/
  );
  let resolveReleaseFence;
  const releaseFence = new Promise((resolve) => {
    resolveReleaseFence = resolve;
  });
  const consumerLease = runtime.acquireExecutionConsumerLease(first, {
    consumerId: 'thermal-source-cell-native-test'
  });
  assert.equal(
    runtime.ownsExecutionConsumerLease(consumerLease, first),
    true
  );
  const pendingRelease = runtime.releaseExecutionAfter(first, releaseFence);
  assert.equal(first.releaseScheduled, true);
  assert.equal(
    resolveSchroederSpatialExactNearCellTreeForConsumer(first, {
      device,
      spatialExecution,
      supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
    }).ready,
    false
  );
  const admittedUnderLease =
    resolveSchroederSpatialExactNearCellTreeForConsumer(first, {
      device,
      spatialExecution,
      supportProfileId:
        SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
      consumerLease
    });
  assert.equal(admittedUnderLease.ready, true);
  assert.equal(admittedUnderLease.consumerLease, consumerLease);
  resolveReleaseFence();
  await Promise.resolve();
  assert.equal(first.released, false);
  let resolveConsumerFence;
  const pendingConsumerRelease =
    runtime.releaseExecutionConsumerLeaseAfter(
      consumerLease,
      new Promise((resolve) => {
        resolveConsumerFence = resolve;
      })
    );
  assert.equal(consumerLease.releaseScheduled, true);
  assert.equal(first.released, false);
  resolveConsumerFence();
  assert.equal(await pendingConsumerRelease, true);
  assert.equal(await pendingRelease, true);
  assert.equal(consumerLease.released, true);
  assert.equal(
    resolveSchroederSpatialExactNearCellTreeForConsumer(first, {
      device,
      spatialExecution,
      supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
    }).ready,
    false
  );
  const second = runtime.encode(createFakeEncoder(), { spatialExecution });
  assert.equal(runtime.markExecutionSubmitted(second), true);
  assert.equal(await runtime.releaseExecutionAfter(second, Promise.resolve()), true);
  assert.equal(runtime.destroy(), true);
});

test('exact-cell tree runtime selects v2 pipelines and authenticates exact ActiveSource lineage', async () => {
  const device = createFakeDevice();
  const spatialExecution = createSpatialV2Execution(device);
  const runtime = createSchroederSpatialExactNearCellTreeGpu(device, {
    maxSourceCount: 8,
    cellCapacity: 3,
    arenaCount: 1
  });
  const buffersBeforeEncode = device.buffers.length;
  const encoder = createFakeEncoder();
  const execution = runtime.encode(encoder, { spatialExecution });

  assert.equal(
    execution.schema,
    ULG_SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_V2_SCHEMA
  );
  assert.equal(execution.abiVersion, 2);
  assert.equal(execution.physicalSourceCount, 8);
  assert.equal(execution.physicalSourceCapacity, 8);
  assert.equal(execution.activeSourceCountAuthorityWord, 37);
  assert.equal(execution.spatialExecution, spatialExecution);
  assert.equal(execution.directoryBuffer, spatialExecution.directoryBuffer);
  assert.equal(device.buffers.length, buffersBeforeEncode);
  assert.equal(
    device.writes.some((write) => (
      write.buffer === execution.expectationBuffer
      && new Uint32Array(
        write.data.buffer,
        write.data.byteOffset,
        write.data.byteLength / Uint32Array.BYTES_PER_ELEMENT
      )[0] === 8
    )),
    true
  );
  assert.equal(runtime.markExecutionSubmitted(execution), true);
  assert.equal(
    resolveSchroederSpatialExactNearCellTreeForConsumer(execution, {
      device,
      spatialExecution,
      supportProfileId:
        SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
    }).ready,
    true
  );

  const originalActiveSourceViewBuffer =
    spatialExecution.activeSourceViewBuffer;
  spatialExecution.activeSourceViewBuffer = device.createBuffer({
    label: 'forged-v2-active-source-buffer',
    size: originalActiveSourceViewBuffer.size,
    usage: 128 | 256
  });
  assert.throws(
    () => runtime.encode(createFakeEncoder(), { spatialExecution }),
    /active-source-authority/
  );
  spatialExecution.activeSourceViewBuffer = originalActiveSourceViewBuffer;
  assert.equal(
    await runtime.releaseExecutionAfter(execution, Promise.resolve()),
    true
  );
  assert.equal(runtime.destroy(), true);
});
