import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_EPOCH_MAGIC,
  SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_EPOCH_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_EPOCH_STATUS_READY,
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI,
  SCHROEDER_SPATIAL_QUERY_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  createSchroederBoundedAtlasPlan,
  createSchroederSpatialEpochBuildPlan,
  createSchroederSpatialEpochLayout,
  decodeSchroederSignedOrderKey,
  encodeSchroederSignedOrderKey,
  validateSchroederSpatialEpochConsumerDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  schroederSpatialEpochAssembleWgsl,
  schroederSpatialEpochKeyWgsl
} from '../ulg-gpu-abi/src/schroederSpatialEpochWgsl.js';
import {
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_BYTES,
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_OFFSET_WORDS,
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES,
  SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_WORDS
} from '../ulg-gpu-abi/src/schroederMechanicsSpatialAuthorityWgsl.js';
import {
  createSchroederSpatialEpochGpu,
  releaseSchroederSpatialEpochGenerationAfterQueue,
  resolveSchroederSpatialDirectoryActiveNodeSource,
  runSchroederSpatialEpochGenerationWebGpu,
  runSchroederSpatialEpochGenerationWithBackpressureWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';

function createFakeDevice(overrides = {}) {
  const buffers = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  const submissions = [];
  const commandEncoders = [];
  const device = {
    buffers,
    pipelines,
    bindGroups,
    writes,
    submissions,
    commandEncoders,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256,
      ...overrides.limits
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        writes.push({
          buffer,
          offset,
          byteLength: data.byteLength,
          snapshot: bytes.slice().buffer
        });
      },
      submit(commandBuffers) {
        submissions.push(commandBuffers);
      },
      onSubmittedWorkDone() {
        return Promise.resolve();
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      return descriptor;
    },
    createComputePipeline(descriptor) {
      const pipeline = {
        ...descriptor,
        getBindGroupLayout(index) {
          return { pipeline: descriptor.label, entryPoint: descriptor.compute.entryPoint, index };
        }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder(descriptor) {
      commandEncoders.push(descriptor);
      return createFakeEncoder();
    }
  };
  return device;
}

function createFakeEncoder() {
  const events = [];
  return {
    events,
    clearBuffer(buffer, offset = 0, size = null) {
      events.push({ kind: 'clear', label: buffer.label, offset, size });
    },
    beginComputePass(descriptor = {}) {
      const event = { kind: 'pass', descriptor, commands: [] };
      events.push(event);
      let pipeline = null;
      let bindGroup = null;
      return {
        setPipeline(value) { pipeline = value.label; },
        setBindGroup(index, value) { bindGroup = { index, label: value.label }; },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.commands.push({ pipeline, bindGroup, dispatch: [x, y, z] });
        },
        dispatchWorkgroupsIndirect(buffer, byteOffset = 0) {
          event.commands.push({
            pipeline,
            bindGroup,
            dispatchIndirect: { label: buffer.label, byteOffset }
          });
        },
        end() { event.ended = true; }
      };
    },
    finish() {
      return { label: 'fake-spatial-command-buffer', events };
    }
  };
}

function createDirectSpatialActiveNodeList(device, overrides = {}) {
  const activeNodeBuffer = overrides.activeNodeBuffer ?? device.createBuffer({
    label: 'direct-spatial-active-node-source',
    size: 2 * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  return {
    schema: 'peercompute.ulg.schroeder-active-node-list-execution.v0',
    status: 'schroeder-active-node-list-submitted',
    spatialDirectorySourceSchema:
      'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
    spatialDirectorySourceStatus: 'schroeder-spatial-directory-source-ready',
    spatialDirectorySourceReady: true,
    spatialEpochSourceSchema: 'peercompute.ulg.schroeder-spatial-active-node-source.v1',
    spatialEpochSourceStatus: 'schroeder-spatial-active-node-source-ready',
    spatialEpochSourceReady: true,
    spatialEpochLevelSpacingMode: 'base-grid-spacing-times-pow2-level',
    spatialEpochPositionAuthority: 'same-epoch-pre-integration-particle-state',
    spatialEpochMinLevel: -1,
    spatialEpochMaxLevel: 1,
    spatialEpochBaseGridSpacingM: 0.25,
    spatialEpochChartId: 0,
    activeCandidateCount: 2,
    activeNodeStrideFloats: 16,
    activeNodeBuffer,
    spatialEpochStorageGeneration: 11,
    spatialEpochPhysicsTick: 13,
    spatialEpochPhysicsSubstep: 0,
    spatialEpochPositionEpoch: 17,
    spatialEpochTopologyEpoch: 19,
    spatialEpochChartEpoch: 23,
    spatialEpochLevelEpoch: 29,
    spatialEpochSupportEpoch: 31,
    phaseVolumeAssignmentOverlayEnabled: false,
    ...overrides,
    activeNodeBuffer
  };
}

test('spatial epoch ABI fixes exact keys, identity header, and compact directory offsets', () => {
  assert.equal(SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT.length, 48);
  assert.equal(SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS, 48);
  assert.equal(SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT[20], 'logicalRequiredWords:u32');
  assert.equal(SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT[21], 'logicalAdmittedWords:u32');
  assert.equal(
    SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT[47],
    'physicalAddressUpperBoundWords:u32'
  );
  assert.deepEqual(SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT.slice(3, 11), [
    'generationId:u32',
    'deviceOrdinal:u32',
    'laneOrdinal:u32',
    'leaseToken:u32',
    'sourceFamilyId:u32',
    'storageGeneration:u32',
    'physicsTick:u32',
    'physicsSubstep:u32'
  ]);
  const layout = createSchroederSpatialEpochLayout({ sourceCapacity: 8, cellCapacity: 8 });
  assert.equal(layout.cellKeysOffsetWords, 48);
  assert.equal(layout.cellOffsetsOffsetWords, 88);
  assert.equal(layout.cellMembersOffsetWords, 97);
  assert.equal(layout.particleToCellOffsetWords, 105);
  assert.equal(layout.queryEvidenceCapacityOffsetWords, 113);
  assert.equal(layout.queryEvidenceWordCapacity, SCHROEDER_SPATIAL_QUERY_EVIDENCE_WORDS);
  assert.equal(layout.wordLength, 117);
  assert.equal(layout.byteLength, 468);
  assert.equal(SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS, 1);
  assert.equal(SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY, 2);
  assert.match(SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI.consumerDispatchLinearization, /workgroup\.y/);
});

test('signed structural order keys round trip and preserve i32 ordering', () => {
  const values = [-0x8000_0000, -17, -1, 0, 1, 29, 0x7fff_ffff];
  const keys = values.map(encodeSchroederSignedOrderKey);
  assert.deepEqual(keys, [...keys].sort((left, right) => left - right));
  assert.deepEqual(keys.map(decodeSchroederSignedOrderKey), values);
});

test('bounded atlas plans prove a collision-free u32 product and are always normalized', () => {
  const atlas = createSchroederBoundedAtlasPlan({
    chartMin: 0,
    chartCount: 2,
    levelMin: -1,
    levelCount: 2,
    cellMin: [-1, -1, 0],
    cellCount: [2, 2, 2]
  });
  assert.equal(atlas.ordinalCount, 32);
  assert.equal(atlas.sortKeyWordCount, 1);
  const plan = createSchroederSpatialEpochBuildPlan({
    sourceCount: 8,
    sourceCapacity: 8,
    atlas: { ...atlas, chartCount: 1 }
  });
  assert.equal(plan.atlas.chartCount, 1);
  assert.notEqual(plan.atlas, atlas);
  assert.throws(
    () => createSchroederSpatialEpochBuildPlan({
      sourceCount: 1,
      sourceCapacity: 1,
      atlas: { chartCount: 0 }
    }),
    /chartCount/
  );
  assert.throws(
    () => createSchroederBoundedAtlasPlan({
      chartCount: 65536,
      levelCount: 65536,
      cellCount: [2, 1, 1]
    }),
    /ordinal count/
  );
});

test('exact-near plans reserve immutable live query evidence and reject ambiguous geometry', () => {
  const exactNearQueryProfile = {
    schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
    status: 'schroeder-spatial-exact-near-query-profile-ready',
    ready: true,
    sourceCount: 3,
    chartId: 7,
    minLevel: -2,
    maxLevel: 1,
    levelCount: 4,
    baseGridSpacingM: 0.125,
    levelSpacingMode: 'base-grid-spacing-times-pow2-level',
    positionAuthority: 'same-epoch-pre-integration-particle-state'
  };
  const plan = createSchroederSpatialEpochBuildPlan({
    sourceCount: 3,
    sourceCapacity: 8,
    sortMode: 'lexicographic-u32x5',
    exactNearQueryProfile
  });
  assert.equal(plan.sourceAdapterId, SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY);
  assert.equal(plan.queryEvidenceOffsetWords, plan.layout.particleToCellOffsetWords + 3);
  assert.equal(plan.queryEvidenceWordCount, SCHROEDER_SPATIAL_QUERY_EVIDENCE_WORDS);
  assert.deepEqual([
    plan.queryGeometryEvidence.chartId,
    plan.queryGeometryEvidence.minLevel,
    plan.queryGeometryEvidence.maxLevel,
    plan.queryGeometryEvidence.baseGridSpacingM
  ], [7, -2, 1, 0.125]);
  assert.equal(Object.isFrozen(plan.queryGeometryEvidence), true);
  assert.equal(plan.exactNearQueryProfile, plan.queryGeometryEvidence);

  assert.throws(
    () => createSchroederSpatialEpochBuildPlan({
      sourceCount: 3,
      sourceCapacity: 8,
      exactNearQueryProfile: { ...exactNearQueryProfile, sourceCount: 2 }
    }),
    /sourceCount/
  );
  assert.throws(
    () => createSchroederSpatialEpochBuildPlan({
      sourceCount: 3,
      sourceCapacity: 8,
      exactNearQueryProfile: {
        ...exactNearQueryProfile,
        minLevel: -40,
        maxLevel: -40,
        levelCount: 1,
        baseGridSpacingM: 0.125
      }
    }),
    /active-row clamp/
  );
});

test('host descriptor validation never converts encode-time identity into GPU completion', () => {
  const identity = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
    magic: SCHROEDER_SPATIAL_EPOCH_MAGIC,
    abiVersion: SCHROEDER_SPATIAL_EPOCH_VERSION,
    generationId: 7,
    deviceId: 'device-a',
    laneId: 'lane-a',
    leaseToken: 11
  };
  assert.deepEqual(validateSchroederSpatialEpochConsumerDescriptor(identity, {
    generationId: 7,
    deviceId: 'device-a'
  }), {
    admitted: false,
    compatible: true,
    status: 'schroeder-spatial-epoch-gpu-admission-unproven'
  });
  assert.equal(validateSchroederSpatialEpochConsumerDescriptor({
    ...identity,
    statusFlags: SCHROEDER_SPATIAL_EPOCH_STATUS_READY,
    gpuCompletionProven: true
  }).status, 'schroeder-spatial-epoch-rejected-not-admitted');
  assert.equal(validateSchroederSpatialEpochConsumerDescriptor({
    ...identity,
    statusFlags: SCHROEDER_SPATIAL_EPOCH_STATUS_READY
      | SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED
      | SCHROEDER_SPATIAL_EPOCH_STATUS_FAIL_CLOSED,
    gpuCompletionProven: true
  }).status, 'schroeder-spatial-epoch-rejected-fail-closed');
  assert.equal(validateSchroederSpatialEpochConsumerDescriptor({
    ...identity,
    statusFlags: SCHROEDER_SPATIAL_EPOCH_STATUS_READY
      | SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED,
    gpuCompletionProven: true
  }).admitted, true);
  assert.equal(validateSchroederSpatialEpochConsumerDescriptor(identity, {
    leaseToken: 12
  }).field, 'leaseToken');
});

test('spatial WGSL admits the established active-row status and derives duplicate groups safely', () => {
  assert.match(schroederSpatialEpochKeyWgsl, /\(u32\(round\(status_f\)\) & 31u\) > 0u/);
  assert.match(schroederSpatialEpochKeyWgsl, /\(u32\(round\(status_f\)\) & 128u\) == 0u/);
  assert.match(schroederSpatialEpochKeyWgsl, /source_index <= 16777215u/);
  assert.match(schroederSpatialEpochKeyWgsl, /value == trunc\(value\)/);
  assert.match(schroederSpatialEpochKeyWgsl, /source_particle_f == f32\(source_index\)/);
  assert.doesNotMatch(schroederSpatialEpochKeyWgsl, /0\.0001/);
  assert.match(schroederSpatialEpochKeyWgsl, /floor\(position \/ native_spacing\)/);
  assert.doesNotMatch(schroederSpatialEpochKeyWgsl, /max\(native_spacing, 0\.000001\)/);
  assert.match(schroederSpatialEpochKeyWgsl, /row_chart == params\.query_chart_id/);
  assert.match(
    schroederSpatialEpochKeyWgsl,
    /bitcast<u32>\(native_spacing\) == bitcast<u32>\(expected_spacing\)/
  );
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /inclusive_head_count = sorted_group_indices\[sorted_position \+ 1u\]/
  );
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /let is_head = sorted_position == unique_offsets\[group_index\]/
  );
  assert.match(schroederSpatialEpochAssembleWgsl, /fn saturating_add_u32/);
  assert.match(schroederSpatialEpochAssembleWgsl, /consumer_dispatch\[1\] = dispatch_y/);
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /directory\[query_evidence_offset_words \+ 3u\]/
  );
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /SOURCE_ADAPTER_EXACT_NEAR_QUERY/
  );
});

test('direct spatial generation retains one directory through the final queue fence', async () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const { activeNodeBuffer } = activeNodeList;

  const source = resolveSchroederSpatialDirectoryActiveNodeSource(activeNodeList, {
    device,
    particleCount: 2
  });
  assert.equal(source.ready, true);
  assert.equal(source.storageGeneration, 11);
  assert.equal(source.exactNearQueryProfile.ready, true);
  assert.equal(
    source.exactNearQueryProfile.status,
    'schroeder-spatial-exact-near-query-profile-ready'
  );
  assert.equal(source.exactNearQueryProfile.activeNodeBuffer, activeNodeBuffer);
  assert.deepEqual(
    [
      source.exactNearQueryProfile.minLevel,
      source.exactNearQueryProfile.maxLevel,
      source.exactNearQueryProfile.levelCount,
      source.exactNearQueryProfile.baseGridSpacingM,
      source.exactNearQueryProfile.positionEpoch,
      source.exactNearQueryProfile.supportEpoch
    ],
    [-1, 1, 3, 0.25, 17, 31]
  );

  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  assert.equal(generation.ready, true);
  assert.equal(generation.selected, true);
  assert.equal(generation.directoryBuildCount, 1);
  assert.equal(generation.privateLookupBuildCount, 0);
  assert.equal(generation.execution.submitPerformed, true);
  assert.equal(generation.execution.activeNodeBuffer, activeNodeBuffer);
  assert.equal(
    generation.execution.sourceAdapterId,
    SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
  );
  assert.equal(generation.execution.exactNearQueryProfile.ready, true);
  assert.equal(generation.execution.exactNearQueryProfile.chartId, 0);
  assert.equal(generation.execution.exactNearQueryProfile.minLevel, -1);
  assert.equal(generation.execution.exactNearQueryProfile.maxLevel, 1);
  assert.equal(generation.execution.exactNearQueryProfile.baseGridSpacingM, 0.25);
  assert.equal(Object.isFrozen(generation.execution.queryGeometryEvidence), true);
  assert.equal(
    Object.getOwnPropertyDescriptor(generation.execution, 'sourceAdapterId')?.writable,
    false
  );
  assert.equal(
    Object.getOwnPropertyDescriptor(generation.execution, 'exactNearQueryProfile')?.writable,
    false
  );
  const spatialParamsWrite = device.writes.find(
    ({ buffer, byteLength }) => /-arena-0-params$/.test(buffer.label) && byteLength === 192
  );
  assert.ok(spatialParamsWrite);
  const spatialParamsView = new DataView(spatialParamsWrite.snapshot);
  assert.deepEqual([
    spatialParamsView.getUint32(160, true),
    spatialParamsView.getUint32(164, true),
    spatialParamsView.getInt32(168, true),
    spatialParamsView.getInt32(172, true),
    spatialParamsView.getFloat32(176, true)
  ], [1, 0, -1, 1, 0.25]);
  assert.equal(generation.execution.ownerRuntime, generation.runtime);
  assert.equal(generation.runtime.ownsExecution(generation.execution), true);
  assert.equal(generation.runtime.isExecutionSubmitted(generation.execution), true);
  assert.throws(
    () => { generation.execution.submitPerformed = false; },
    TypeError
  );
  assert.equal(generation.execution.submitPerformed, true);
  assert.throws(
    () => generation.runtime.releaseExecution(
      generation.execution,
      { discardedEncoder: true }
    ),
    (error) => error?.code
      === 'ERR_SCHROEDER_SPATIAL_SUBMITTED_EXECUTION_REQUIRES_FENCE'
  );
  assert.equal(generation.runtime.ownsExecution(generation.execution), true);
  assert.equal(generation.releaseScheduled, false);
  assert.equal(device.submissions.length, 1);
  const foreignDevice = createFakeDevice();
  let foreignFenceCount = 0;
  foreignDevice.queue.onSubmittedWorkDone = () => {
    foreignFenceCount += 1;
    throw new Error('foreign queue must not fence an owner generation');
  };
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, foreignDevice),
    false
  );
  assert.equal(foreignFenceCount, 0);
  assert.equal(generation.releaseScheduled, false);
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-retained-device-mismatch'
  );
  const ownerRuntime = generation.runtime;
  const ownerFence = device.queue.onSubmittedWorkDone;
  let ownerFenceCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    ownerFenceCount += 1;
    return ownerFence();
  };
  generation.runtime = { ...ownerRuntime };
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    false
  );
  assert.equal(ownerFenceCount, 0);
  assert.equal(generation.releaseScheduled, false);
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-retained-owner-mismatch'
  );
  generation.runtime = ownerRuntime;
  device.queue.onSubmittedWorkDone = () => {
    ownerFenceCount += 1;
    throw new Error('transient owner fence failure');
  };
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    false
  );
  assert.equal(generation.releaseScheduled, false);
  assert.equal(generation.releasePromise, null);
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-retained-fence-error'
  );
  assert.match(generation.releaseReason, /transient owner fence failure/);
  device.queue.onSubmittedWorkDone = () => {
    ownerFenceCount += 1;
    return ownerFence();
  };
  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(ownerFenceCount, 2);
  assert.equal(await generation.releasePromise, true);
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-released-after-final-consumer'
  );
  assert.equal(generation.releaseReason, null);

  const overlay = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList: {
      ...activeNodeList,
      phaseVolumeAssignmentOverlayEnabled: true
    },
    particleCount: 2
  });
  assert.equal(overlay.ready, false);
  assert.equal(
    overlay.status,
    'schroeder-spatial-directory-source-rejected-overlay-for-mechanics'
  );
  assert.equal(overlay.directoryBuildCount, 0);
  assert.equal(device.submissions.length, 1);
});

test('direct spatial generation backpressure preserves one fresh generation per tick', async () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const pendingFenceResolvers = [];
  device.queue.onSubmittedWorkDone = () => new Promise((resolve) => {
    pendingFenceResolvers.push(resolve);
  });
  const generations = [];

  for (let index = 0; index < 8; index += 1) {
    const pendingGeneration =
      runSchroederSpatialEpochGenerationWithBackpressureWebGpu({
        device,
        activeNodeList,
        particleCount: 2
      });
    if (index >= 3) {
      assert.equal(pendingFenceResolvers.length, 3);
      pendingFenceResolvers.shift()();
    }
    const generation = await pendingGeneration;
    generations.push(generation);
    assert.equal(generation.selected, true);
    assert.equal(generation.arenaCapacity, 3);
    assert.equal(generation.directoryBuildCount, 1);
    assert.equal(generation.privateLookupBuildCount, 0);
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
      true
    );
  }

  assert.deepEqual(
    generations.map((generation) => generation.execution.generationId),
    [1, 2, 3, 4, 5, 6, 7, 8]
  );
  assert.deepEqual(
    generations.map((generation) => generation.backpressureWaitCount),
    [0, 0, 0, 1, 1, 1, 1, 1]
  );
  assert.equal(device.submissions.length, 8);
  for (const resolveFence of pendingFenceResolvers.splice(0)) resolveFence();
  assert.deepEqual(
    await Promise.all(generations.map((generation) => generation.releasePromise)),
    Array(8).fill(true)
  );
});

test('direct spatial generation backpressure fails closed without an owner release', async () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const generations = Array.from({ length: 3 }, () => (
    runSchroederSpatialEpochGenerationWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    })
  ));
  await assert.rejects(
    runSchroederSpatialEpochGenerationWithBackpressureWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    }),
    (error) => error?.code
      === 'ERR_SCHROEDER_SPATIAL_ARENA_BACKPRESSURE_UNRELEASABLE'
  );
  assert.equal(device.submissions.length, 3);
  for (const generation of generations) {
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
      true
    );
  }
  await Promise.all(generations.map((generation) => generation.releasePromise));
});

test('failed generation-owner fence preserves the live arena and permits a confirmed retry', async () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  device.queue.onSubmittedWorkDone = () => Promise.reject(
    new Error('intentional owner fence rejection')
  );

  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    true
  );
  const failedAttempt = generation.releasePromise;
  assert.equal(await failedAttempt, false);
  assert.equal(generation.releaseScheduled, false);
  assert.equal(generation.releasePromise, null);
  assert.equal(generation.runtime.ownsExecution(generation.execution), true);
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-release-unconfirmed'
  );
  assert.match(generation.releaseReason, /intentional owner fence rejection/);
  assert.equal(generation.releaseAttemptCount, 1);
  assert.equal(generation.releaseFailureCount, 1);

  device.queue.onSubmittedWorkDone = () => Promise.resolve(true);
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    true
  );
  assert.equal(await generation.releasePromise, true);
  assert.equal(generation.releaseScheduled, true);
  assert.equal(generation.runtime.ownsExecution(generation.execution), false);
  assert.equal(generation.releaseAttemptCount, 2);
  assert.equal(generation.releaseFailureCount, 1);
});

test('arena backpressure rejects an unconfirmed owner release instead of reusing its arena', async () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const generations = Array.from({ length: 3 }, () => (
    runSchroederSpatialEpochGenerationWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    })
  ));
  device.queue.onSubmittedWorkDone = () => Promise.reject(
    new Error('intentional backpressure fence rejection')
  );
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generations[0], device),
    true
  );

  await assert.rejects(
    runSchroederSpatialEpochGenerationWithBackpressureWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    }),
    (error) => error?.code
      === 'ERR_SCHROEDER_SPATIAL_ARENA_BACKPRESSURE_RELEASE_FAILED'
  );
  assert.equal(generations[0].runtime.ownsExecution(generations[0].execution), true);
  assert.equal(device.submissions.length, 3);

  device.queue.onSubmittedWorkDone = () => Promise.resolve(true);
  for (const generation of generations) {
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
      true
    );
  }
  assert.deepEqual(
    await Promise.all(generations.map((generation) => generation.releasePromise)),
    [true, true, true]
  );
});

test('arena backpressure proceeds when any scheduled owner release is confirmed', async () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const generations = Array.from({ length: 3 }, () => (
    runSchroederSpatialEpochGenerationWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    })
  ));
  const fenceSettlers = [];
  device.queue.onSubmittedWorkDone = () => new Promise((resolve, reject) => {
    fenceSettlers.push({ resolve, reject });
  });
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generations[0], device),
    true
  );
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generations[1], device),
    true
  );

  const pendingGeneration =
    runSchroederSpatialEpochGenerationWithBackpressureWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    });
  fenceSettlers[0].reject(new Error('intentional first owner fence rejection'));
  await Promise.resolve();
  fenceSettlers[1].resolve();
  const nextGeneration = await pendingGeneration;

  assert.equal(nextGeneration.selected, true);
  assert.equal(nextGeneration.execution.generationId, 4);
  assert.equal(nextGeneration.backpressureWaitCount, 1);
  assert.equal(generations[0].runtime.ownsExecution(generations[0].execution), true);
  assert.equal(generations[1].runtime.ownsExecution(generations[1].execution), false);
  assert.equal(device.submissions.length, 4);

  device.queue.onSubmittedWorkDone = () => Promise.resolve(true);
  for (const generation of [generations[0], generations[2], nextGeneration]) {
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
      true
    );
  }
  assert.deepEqual(
    await Promise.all(
      [generations[0], generations[2], nextGeneration]
        .map((generation) => generation.releasePromise)
    ),
    [true, true, true]
  );
});

test('directory generation identity accepts only exact numeric u32 fields and preserves zero', () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const missing = Symbol('missing');
  const invalidIdentityFields = [
    ['missing physics tick', 'spatialEpochPhysicsTick', missing],
    ['null physics substep', 'spatialEpochPhysicsSubstep', null],
    ['boolean position epoch', 'spatialEpochPositionEpoch', false],
    ['empty topology epoch', 'spatialEpochTopologyEpoch', ''],
    ['coercible chart epoch', 'spatialEpochChartEpoch', '23'],
    ['array level epoch', 'spatialEpochLevelEpoch', []],
    ['object support epoch', 'spatialEpochSupportEpoch', { valueOf: () => 31 }],
    ['bigint storage generation', 'spatialEpochStorageGeneration', 11n]
  ];

  for (const [label, field, value] of invalidIdentityFields) {
    const candidate = { ...activeNodeList };
    if (value === missing) delete candidate[field];
    else candidate[field] = value;
    const source = resolveSchroederSpatialDirectoryActiveNodeSource(candidate, {
      device,
      particleCount: 2
    });
    assert.equal(source.ready, false, label);
    assert.equal(
      source.status,
      'schroeder-spatial-directory-source-rejected-generation',
      label
    );
  }

  const zeroEpochSource = resolveSchroederSpatialDirectoryActiveNodeSource({
    ...activeNodeList,
    spatialEpochStorageGeneration: 1,
    spatialEpochPhysicsTick: 0,
    spatialEpochPhysicsSubstep: 0,
    spatialEpochPositionEpoch: 0,
    spatialEpochTopologyEpoch: 0,
    spatialEpochChartEpoch: 0,
    spatialEpochLevelEpoch: 0,
    spatialEpochSupportEpoch: 0,
    spatialEpochMinLevel: 0,
    spatialEpochMaxLevel: 0,
    spatialEpochChartId: 0
  }, {
    device,
    particleCount: 2
  });
  assert.equal(zeroEpochSource.ready, true);
  assert.deepEqual(
    [
      zeroEpochSource.physicsTick,
      zeroEpochSource.physicsSubstep,
      zeroEpochSource.positionEpoch,
      zeroEpochSource.topologyEpoch,
      zeroEpochSource.chartEpoch,
      zeroEpochSource.levelEpoch,
      zeroEpochSource.supportEpoch,
      zeroEpochSource.exactNearQueryProfile.chartId,
      zeroEpochSource.exactNearQueryProfile.minLevel,
      zeroEpochSource.exactNearQueryProfile.maxLevel
    ],
    Array(10).fill(0)
  );
  assert.equal(zeroEpochSource.exactNearQueryProfile.ready, true);
  assert.equal(zeroEpochSource.exactNearQueryProfile.levelCount, 1);
});

test('exact-near query profile rejects missing, coercible, and out-of-range numerics', () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const missing = Symbol('missing');
  const invalidQueryFields = [
    ['missing minimum level', 'spatialEpochMinLevel', missing, 'minLevel'],
    ['null maximum level', 'spatialEpochMaxLevel', null, 'maxLevel'],
    ['boolean minimum level', 'spatialEpochMinLevel', false, 'minLevel'],
    ['empty maximum level', 'spatialEpochMaxLevel', '', 'maxLevel'],
    ['coercible minimum level', 'spatialEpochMinLevel', '-1', 'minLevel'],
    ['coercible chart id', 'spatialEpochChartId', '0', 'chartId'],
    ['array chart id', 'spatialEpochChartId', [], 'chartId'],
    ['object maximum level', 'spatialEpochMaxLevel', { valueOf: () => 1 }, 'maxLevel'],
    ['fractional minimum level', 'spatialEpochMinLevel', -0.5, 'minLevel'],
    ['non-finite maximum level', 'spatialEpochMaxLevel', Infinity, 'maxLevel'],
    ['minimum level below i32', 'spatialEpochMinLevel', -0x8000_0001, 'minLevel'],
    ['maximum level above i32', 'spatialEpochMaxLevel', 0x8000_0000, 'maxLevel'],
    ['coercible base spacing', 'spatialEpochBaseGridSpacingM', '0.25', 'baseGridSpacingM']
  ];

  for (const [label, field, value, profileField] of invalidQueryFields) {
    const candidate = { ...activeNodeList };
    if (value === missing) delete candidate[field];
    else candidate[field] = value;
    const source = resolveSchroederSpatialDirectoryActiveNodeSource(candidate, {
      device,
      particleCount: 2
    });
    assert.equal(source.ready, true, label);
    assert.equal(source.exactNearQueryProfile.ready, false, label);
    assert.equal(
      source.exactNearQueryProfile.status,
      'schroeder-spatial-exact-near-query-profile-unavailable',
      label
    );
    assert.equal(source.exactNearQueryProfile[profileField], null, label);
  }
});

test('caller-owned runtime keeps two complete variable-count arenas resident and GPU-gated', async () => {
  const device = createFakeDevice();
  const runtime = createSchroederSpatialEpochGpu(device, {
    maxSourceCount: 8,
    cellCapacity: 8,
    arenaCount: 2,
    label: 'spatial-test'
  });
  const activeNodeBuffer = device.createBuffer({
    label: 'active-node-source',
    size: 8 * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const allocationBuffers = runtime.allocationEntries().map(({ buffer }) => buffer);
  const bufferCountBeforeEncode = device.buffers.length;
  const atlas = {
    chartMin: 0,
    chartCount: 2,
    levelMin: -1,
    levelCount: 2,
    cellMin: [-1, -1, 0],
    cellCount: [2, 2, 2]
  };

  const first = runtime.encode(createFakeEncoder(), {
    activeNodeBuffer,
    sourceCount: 8,
    sortMode: 'bounded-atlas-u32',
    atlas,
    generationId: 1,
    deviceOrdinal: 9,
    laneOrdinal: 3,
    sourceFamilyId: 4,
    storageGeneration: 5,
    physicsTick: 6,
    physicsSubstep: 1,
    leaseToken: 7
  });
  const second = runtime.encode(createFakeEncoder(), {
    activeNodeBuffer,
    sourceCount: 6,
    sortMode: 'lexicographic-u32x5',
    generationId: 2,
    timestampProfiler: {
      beginComputePassDescriptor(label, metadata) { return { label, metadata }; }
    }
  });
  assert.equal(first.arenaIndex, 0);
  assert.equal(second.arenaIndex, 1);
  assert.equal(first.activeNodeBuffer, activeNodeBuffer);
  assert.equal(first.sourceAdapterId, SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS);
  assert.equal(first.exactNearQueryProfile, null);
  assert.equal(first.queryGeometryEvidence.modeName, 'generic-per-row-native-spacing');
  assert.equal(runtime.ownsExecution(first), true);
  assert.equal(runtime.ownsExecution(second), true);
  assert.deepEqual(
    Object.getOwnPropertyDescriptor(first, 'activeNodeBuffer'),
    {
      value: activeNodeBuffer,
      writable: false,
      enumerable: true,
      configurable: false
    }
  );
  assert.equal(first.ownerRuntime, runtime);
  assert.equal(
    Object.getOwnPropertyDescriptor(first, 'ownerRuntime')?.enumerable,
    false
  );
  assert.equal(Object.hasOwn(first, '_arena'), false);
  assert.equal(Object.hasOwn(first, '_executionToken'), false);
  assert.equal(Object.hasOwn(first, 'radixUnique'), false);
  assert.equal(first.status, 'schroeder-spatial-epoch-gpu-encoded');
  assert.equal(first.radixPassCount, 8);
  assert.equal(second.radixPassCount, 40);
  assert.equal(second.timestampMode, 'instrumented-dispatch-granular-nonrepresentative');
  assert.equal(first.statusFlags, null);
  assert.equal(first.gpuCompletionProven, false);
  assert.equal(first.submitPerformed, false);
  assert.equal(first.readbackPerformed, false);
  assert.equal(first.bufferAllocationCountDuringEncode, 0);
  assert.equal(first.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_WORDS, 16);
  assert.equal(SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_BYTES, 64);
  assert.equal(SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_OFFSET_WORDS, 4);
  assert.equal(SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_WORDS, 20);
  assert.equal(SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES, 80);
  assert.equal(first.evidenceBuffer.size, 80);
  assert.equal(first.evidenceBufferByteLength, 80);
  assert.equal(first.mechanicsEvidenceOffsetBytes, 16);
  assert.equal(first.mechanicsEvidenceByteLength, 64);
  assert.equal(first.clearedWordCount, 83);
  assert.equal(first.paramsWriteCount, 5);
  assert.equal(first.radixDigitPassCount, 8);
  assert.equal(
    runtime.retainedGpuBufferBytes,
    runtime.retainedGpuBufferBytesPerArena.reduce((sum, bytes) => sum + bytes, 0)
  );
  assert.equal(first.retainedGpuBufferBytes, runtime.retainedGpuBufferBytesPerArena[0]);
  assert.ok(first.retainedGpuBufferBytes > first.layout.byteLength);
  const keyBinding = device.bindGroups.find((entry) => entry.label === 'spatial-test-arena-0-key-bind-group');
  assert.equal(keyBinding.entries[0].resource.size, 8 * 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(device.buffers.length, bufferCountBeforeEncode);
  assert.equal(device.submissions.length, 0);
  assert.equal(device.commandEncoders.length, 0);
  assert.throws(
    () => runtime.encode(createFakeEncoder(), {
      activeNodeBuffer,
      sourceCount: 4,
      atlas
    }),
    (error) => error?.code === 'ERR_SCHROEDER_SPATIAL_ARENA_EXHAUSTED'
  );
  assert.throws(
    () => runtime.destroy(),
    (error) => error?.code === 'ERR_SCHROEDER_SPATIAL_ACTIVE_EXECUTIONS'
  );

  const transplantedOwnershipFields = [
    'arenaIndex',
    'directoryBuffer',
    'consumerDispatchBuffer',
    'evidenceBuffer',
    'exactKeyBuffer',
    'sortKeyBuffer',
    'sortedIndicesBuffer'
  ];
  const firstOwnershipSnapshot = Object.fromEntries(
    transplantedOwnershipFields.map((field) => [field, first[field]])
  );
  for (const field of transplantedOwnershipFields) first[field] = second[field];
  assert.equal(runtime.ownsExecution(first), false);
  assert.equal(runtime.ownsExecution(second), true);
  assert.throws(
    () => runtime.releaseExecution(first, { discardedEncoder: true }),
    (error) => error?.code === 'ERR_SCHROEDER_SPATIAL_FOREIGN_EXECUTION'
  );
  assert.equal(runtime.ownsExecution(second), true);
  for (const field of transplantedOwnershipFields) {
    first[field] = firstOwnershipSnapshot[field];
  }
  assert.equal(runtime.ownsExecution(first), true);
  await assert.rejects(
    runtime.releaseExecutionAfter(first, Promise.resolve()),
    (error) => error?.code
      === 'ERR_SCHROEDER_SPATIAL_UNSUBMITTED_EXECUTION_REQUIRES_DISCARD'
  );
  assert.equal(runtime.markExecutionSubmitted(second), true);
  assert.throws(
    () => runtime.encode(createFakeEncoder(), {
      activeNodeBuffer,
      sourceCount: 4,
      atlas,
      arenaIndex: second.arenaIndex
    }),
    (error) => error?.code === 'ERR_SCHROEDER_SPATIAL_ARENA_EXHAUSTED'
  );

  assert.throws(() => runtime.releaseExecution(first), /discarded encoder/);
  const clonedFirst = { ...first };
  assert.throws(
    () => runtime.releaseExecution(clonedFirst, { discardedEncoder: true }),
    /does not belong to this runtime/
  );
  await assert.rejects(
    runtime.releaseExecutionAfter(clonedFirst, Promise.resolve()),
    /does not belong to this runtime/
  );
  const foreignRuntime = createSchroederSpatialEpochGpu(device, {
    maxSourceCount: 8,
    cellCapacity: 8,
    arenaCount: 1,
    label: 'foreign-spatial-test'
  });
  assert.throws(
    () => foreignRuntime.releaseExecution(first, { discardedEncoder: true }),
    /does not belong to this runtime/
  );
  await assert.rejects(
    foreignRuntime.releaseExecutionAfter(first, Promise.resolve()),
    /does not belong to this runtime/
  );
  assert.equal(foreignRuntime.destroy(), true);
  assert.equal(runtime.ownsExecution(first), true);
  assert.equal(runtime.releaseExecution(first, { discardedEncoder: true }), true);
  assert.equal(runtime.ownsExecution(first), false);
  assert.equal(first.released, true);
  const bufferCountBeforeReuse = device.buffers.length;
  const third = runtime.encode(createFakeEncoder(), {
    activeNodeBuffer,
    sourceCount: 4,
    atlas,
    generationId: 3
  });
  assert.equal(third.arenaIndex, 0);
  assert.equal(runtime.ownsExecution(third), true);
  assert.equal(device.buffers.length, bufferCountBeforeReuse);
  assert.ok(third.spatialBindGroupReuseCount >= 3);
  assert.equal(runtime.releaseExecution(third, { discardedEncoder: true }), true);
  assert.equal(runtime.ownsExecution(third), false);
  assert.equal(third.released, true);
  assert.equal(runtime.releaseExecution(third, { discardedEncoder: true }), false);
  await assert.rejects(runtime.releaseExecutionAfter(second, null), /submission-fence thenable/);
  assert.equal(await runtime.releaseExecutionAfter(second, Promise.resolve()), true);
  assert.equal(runtime.ownsExecution(second), false);
  assert.equal(second.released, true);
  assert.deepEqual(runtime.allocationEntries().map(({ buffer }) => buffer), allocationBuffers);
  assert.equal(runtime.destroy(), true);
  assert.equal(allocationBuffers.every((buffer) => buffer.destroyed), true);
});

test('runtime rejects non-portable stage limits and active-node capacity ambiguity', () => {
  assert.throws(
    () => createSchroederSpatialEpochGpu(createFakeDevice({
      limits: { maxStorageBuffersPerShaderStage: 7 }
    }), { maxSourceCount: 8 }),
    /eight storage bindings/
  );
  const device = createFakeDevice();
  const runtime = createSchroederSpatialEpochGpu(device, {
    maxSourceCount: 8,
    arenaCount: 1
  });
  const undersized = device.createBuffer({ label: 'undersized', size: 16, usage: 128 });
  assert.throws(
    () => runtime.encode(createFakeEncoder(), {
      activeNodeBuffer: undersized,
      sourceCount: 8
    }),
    /bytes; 512 required/
  );
  runtime.destroy();
});
