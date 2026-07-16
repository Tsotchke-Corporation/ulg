import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA
} from '../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_SPATIAL_REACTION_DISCOVERY_CONSUMER_ID,
  SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_LAYOUT,
  SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_LAYOUT,
  ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA,
  destroySchroederSpatialReactionDiscoveryProposalCache,
  maxReactionContactRadiusM,
  resolveSchroederSpatialReactionDiscoveryProposalForConsumer,
  runSchroederSpatialReactionDiscoveryProposalWebGpu,
  schroederSpatialReactionDiscoveryProposalWgsl
} from '../src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js';
import {
  isFinalizedSchroederSpatialExactNearConsumerReceipt,
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';

function createFakeEncoder(label = null) {
  const events = [];
  return {
    label,
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
    finish() { return { label: label || 'fake-command-buffer', events }; }
  };
}

function createFakeDevice() {
  const buffers = [];
  const writes = [];
  const submissions = [];
  const shaderModules = [];
  const device = {
    buffers,
    writes,
    submissions,
    shaderModules,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({
          buffer,
          offset,
          data: ArrayBuffer.isView(data)
            ? new data.constructor(data)
            : data.slice(0)
        });
      },
      submit(commandBuffers) { submissions.push(commandBuffers); },
      onSubmittedWorkDone() { return Promise.resolve(); }
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
      shaderModules.push(descriptor);
      return descriptor;
    },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) {
          return {
            label: `${descriptor.label}-layout-${index}`,
            pipeline: descriptor.label,
            entryPoint: descriptor.compute.entryPoint,
            index
          };
        }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder(descriptor = {}) {
      return createFakeEncoder(descriptor.label);
    }
  };
  return device;
}

function createActiveNodeList(device) {
  const activeNodeBuffer = device.createBuffer({
    label: 'reaction-discovery-active-node-source',
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
    phaseVolumeAssignmentOverlayEnabled: false
  };
}

function createReactionTable() {
  const records = new Float32Array([
    1, 2, 3, 900,
    -1000, 0.35, 1, 2,
    1, 0, 0, 0,
    2, 4, 5, 1100,
    -500, 0.75, 2, 4,
    1, 0, 0, 0,
    6, 7, 8, 100,
    -100, 4.0, 1, 1,
    254, 0, 0, 0
  ]);
  return {
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionCount: 3,
    records,
    combinedRecords: records
  };
}

test('reaction discovery exposes the existing one-proposal ABI and one uncapped canonical traversal', () => {
  assert.deepEqual(SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_ROW_LAYOUT, [
    'partnerParticleIndex:f32',
    'reactionIndex:f32',
    'reactantRole:f32',
    'distanceSquaredM2:f32'
  ]);
  assert.equal(SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_LAYOUT.length, 16);
  assert.equal(maxReactionContactRadiusM(createReactionTable()), Math.fround(0.75));
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /fn ss_exact_near_directory_admitted/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /ss_exact_near_source_at_member/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /fn reaction_discovery_consider_pair/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /fn seal\(/
  );
  assert.doesNotMatch(schroederSpatialReactionDiscoveryProposalWgsl, /particle_bin/i);
  assert.doesNotMatch(schroederSpatialReactionDiscoveryProposalWgsl, /candidate_budget/i);
  assert.doesNotMatch(schroederSpatialReactionDiscoveryProposalWgsl, /activation_k/i);
  assert.doesNotMatch(schroederSpatialReactionDiscoveryProposalWgsl, /phase_mask/i);
  assert.doesNotMatch(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /for\s*\([^)]*other[^)]*params\.particle_count/
  );
});

test('reaction discovery binds and receipts the exact retained generation without readback', async () => {
  const device = createFakeDevice();
  const activeNodeList = createActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  const sourceStateBuffer = device.createBuffer({
    label: 'reaction-discovery-source-state',
    size: 2 * 2 * 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const sourceThermoBuffer = device.createBuffer({
    label: 'reaction-discovery-source-thermo',
    size: 2 * 3 * 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const proposal = runSchroederSpatialReactionDiscoveryProposalWebGpu({
    device,
    generation,
    sphParticleState: { particleCount: 2 },
    sourceStateBuffer,
    sourceThermoBuffer,
    reactionTable: createReactionTable()
  });

  assert.equal(proposal.schema, ULG_SCHROEDER_SPATIAL_REACTION_DISCOVERY_PROPOSAL_SCHEMA);
  assert.equal(proposal.ready, true);
  assert.equal(proposal.consumerId, SCHROEDER_SPATIAL_REACTION_DISCOVERY_CONSUMER_ID);
  assert.equal(proposal.consumerId, 'reaction-discovery');
  assert.equal(
    proposal.supportProfileId,
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
  );
  assert.equal(proposal.generationId, generation.execution.generationId);
  assert.equal(proposal.epochIdentity.positionEpoch, 17);
  assert.equal(proposal.particleCount, 2);
  assert.equal(proposal.reactionCount, 3);
  assert.equal(proposal.proposalRowStrideFloats, 4);
  assert.equal(proposal.proposalBufferByteLength, 32);
  assert.equal(proposal.reactionRecordBufferOwned, false);
  assert.equal(
    proposal.reactionRecordBufferOwnership,
    'per-device-canonical-generation-arena-cache'
  );
  assert.equal(proposal.bufferOwnership, 'per-device-canonical-generation-arena-cache');
  assert.equal(proposal.bufferCreationCount, 5);
  assert.equal(proposal.arenaWarmReuse, false);
  assert.equal(proposal.traversalCount, 1);
  assert.equal(proposal.sealDispatchCount, 1);
  assert.equal(proposal.privateLookupBuildCount, 0);
  assert.equal(proposal.fixedCandidateBuildCount, 0);
  assert.equal(proposal.exhaustiveTraversalCount, 0);
  assert.equal(proposal.candidateBudget, null);
  assert.equal(proposal.fullReadbackPerformed, false);
  assert.equal(proposal.readbackMode, 'no-full-readback');
  assert.equal(
    proposal.gpuEvidence.schema,
    ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA
  );
  assert.equal(proposal.gpuEvidence.residentCounterBuffer, proposal.evidenceBuffer);
  assert.equal(proposal.gpuEvidence.residentCountersObserved, false);
  assert.equal(proposal.receipt.consumerId, 'reaction-discovery');
  assert.equal(proposal.receipt.gpuAuthenticated, true);
  assert.equal(isFinalizedSchroederSpatialExactNearConsumerReceipt(proposal.receipt), true);
  const consumerView = resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
    proposal,
    {
      device,
      generation,
      particleCount: 2,
      reactionCount: 3
    }
  );
  assert.equal(consumerView.admitted, true);
  assert.equal(consumerView.proposalBuffer, proposal.proposalBuffer);
  assert.equal(consumerView.receipt, proposal.receipt);

  const expectationWrite = device.writes.find(({ buffer }) => (
    buffer.label.startsWith('ulg-schroeder-spatial-reaction-discovery-expectation-arena-')
  ));
  assert.ok(expectationWrite);
  assert.equal(
    expectationWrite.data[2],
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
  );
  const stageSubmission = device.submissions.at(-1)[0];
  const stagePasses = stageSubmission.events.filter(({ kind }) => kind === 'pass');
  assert.deepEqual(
    stagePasses.map(({ descriptor }) => descriptor.label),
    [
      'ulg-schroeder-spatial-reaction-discovery-proposal',
      'ulg-schroeder-spatial-reaction-discovery-seal'
    ]
  );
  assert.deepEqual(stagePasses.map(({ commands }) => commands[0].dispatch), [
    [1, 1, 1],
    [1, 1, 1]
  ]);
  assert.equal(
    device.shaderModules.some(({ code }) => code === schroederSpatialReactionDiscoveryProposalWgsl),
    true
  );

  const cachedReactionBuffer = proposal.reactionRecordBuffer;
  assert.equal(proposal.destroy(), true);
  assert.equal(proposal.destroy(), false);
  assert.equal(proposal.released, true);
  assert.equal(resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
    proposal,
    { device, generation }
  ).admitted, false);
  assert.equal(proposal.proposalBuffer.destroyed, false);
  assert.equal(proposal.evidenceBuffer.destroyed, false);
  assert.equal(cachedReactionBuffer.destroyed, false);
  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(await generation.releasePromise, true);
  assert.equal(destroySchroederSpatialReactionDiscoveryProposalCache(device), true);
  assert.equal(proposal.proposalBuffer.destroyed, true);
  assert.equal(proposal.evidenceBuffer.destroyed, true);
  assert.equal(cachedReactionBuffer.destroyed, true);
});

test('reaction discovery preserves a borrowed reaction record buffer across teardown', async () => {
  const device = createFakeDevice();
  const activeNodeList = createActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  const sourceStateBuffer = device.createBuffer({
    label: 'borrowed-source-state',
    size: 64,
    usage: 128
  });
  const sourceThermoBuffer = device.createBuffer({
    label: 'borrowed-source-thermo',
    size: 96,
    usage: 128
  });
  const borrowedReactionRecordBuffer = device.createBuffer({
    label: 'borrowed-reaction-records',
    size: createReactionTable().combinedRecords.byteLength,
    usage: 128
  });
  const proposal = runSchroederSpatialReactionDiscoveryProposalWebGpu({
    device,
    generation,
    sourceStateBuffer,
    sourceThermoBuffer,
    reactionTable: createReactionTable(),
    reactionRecordBuffer: borrowedReactionRecordBuffer
  });
  assert.equal(proposal.reactionRecordBuffer, borrowedReactionRecordBuffer);
  assert.equal(proposal.reactionRecordBufferOwned, false);
  assert.equal(proposal.reactionRecordBufferOwnership, 'borrowed-caller-buffer');
  proposal.destroy();
  releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
  await generation.releasePromise;
  destroySchroederSpatialReactionDiscoveryProposalCache(device);
  assert.equal(borrowedReactionRecordBuffer.destroyed, false);
});

test('reaction discovery reuses buffers when the canonical spatial arena rotates back', async () => {
  const device = createFakeDevice();
  const activeNodeList = createActiveNodeList(device);
  const sourceStateBuffer = device.createBuffer({
    label: 'arena-reuse-source-state',
    size: 64,
    usage: 128
  });
  const sourceThermoBuffer = device.createBuffer({
    label: 'arena-reuse-source-thermo',
    size: 96,
    usage: 128
  });
  const artifacts = [];
  for (let index = 0; index < 4; index += 1) {
    const generation = runSchroederSpatialEpochGenerationWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    });
    const artifact = runSchroederSpatialReactionDiscoveryProposalWebGpu({
      device,
      generation,
      sourceStateBuffer,
      sourceThermoBuffer,
      reactionTable: createReactionTable()
    });
    artifacts.push(artifact);
    artifact.destroy();
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
    await generation.releasePromise;
  }
  assert.deepEqual(artifacts.map(({ spatialArenaIndex }) => spatialArenaIndex), [0, 0, 0, 0]);
  assert.deepEqual(artifacts.map(({ bufferCreationCount }) => bufferCreationCount), [5, 0, 0, 0]);
  assert.equal(artifacts[3].arenaWarmReuse, true);
  assert.equal(artifacts[3].proposalBuffer, artifacts[0].proposalBuffer);
  assert.equal(artifacts[3].evidenceBuffer, artifacts[0].evidenceBuffer);
  assert.equal(artifacts[3].reactionRecordBuffer, artifacts[0].reactionRecordBuffer);
  assert.equal(destroySchroederSpatialReactionDiscoveryProposalCache(device), true);
});
