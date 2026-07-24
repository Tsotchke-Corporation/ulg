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
  SCHROEDER_SPATIAL_REACTION_DISCOVERY_PIPELINE_CACHE_VERSION,
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
import {
  createSchroederSpatialReactionProductPlacementAuthorityWebGpu
} from '../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function createFakeEncoder(label = null) {
  const events = [];
  return {
    label,
    events,
    clearBuffer(buffer, offset = 0, size = null) {
      events.push({ kind: 'clear', label: buffer.label, offset, size });
    },
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
      const words = source._writtenData instanceof Uint32Array
        ? source._writtenData.slice()
        : new Uint32Array(Math.max(1, size / Uint32Array.BYTES_PER_ELEMENT));
      if (source.label.includes('reaction-discovery-evidence')) {
        const particleCount = words[12];
        words[0] = particleCount;
        words[1] = particleCount;
        words[2] = 0;
        words[3] = particleCount * 2;
        words[4] = particleCount;
        words[5] = 0;
        words[6] = Math.min(1, particleCount);
        words[7] = particleCount;
        words[8] = 0;
        words[14] = 0;
        words[15] = 0;
      }
      destination._mappedData = words;
      events.push({
        kind: 'copy',
        source: source.label,
        sourceOffset,
        destination: destination.label,
        destinationOffset,
        size
      });
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
  const bindGroupLayouts = [];
  const mapCalls = [];
  const unmapCalls = [];
  const device = {
    buffers,
    writes,
    submissions,
    shaderModules,
    bindGroupLayouts,
    mapCalls,
    unmapCalls,
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
        if (offset === 0 && ArrayBuffer.isView(data)) {
          buffer._writtenData = new data.constructor(data);
        }
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
        async mapAsync(mode) {
          mapCalls.push({ buffer: this, mode });
        },
        getMappedRange() {
          const data = this._mappedData
            ?? new Uint8Array(this.size);
          return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        },
        unmap() { unmapCalls.push(this); },
        destroy() { this.destroyed = true; }
      };
      buffers.push(buffer);
      return tagWebGpuBufferDevice(buffer, device);
    },
    createShaderModule(descriptor) {
      shaderModules.push(descriptor);
      return descriptor;
    },
    createBindGroupLayout(descriptor) {
      bindGroupLayouts.push(descriptor);
      return descriptor;
    },
    createPipelineLayout(descriptor) { return descriptor; },
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

function createActiveNodeList(device, particleCount = 2) {
  const activeNodeBuffer = device.createBuffer({
    label: 'reaction-discovery-active-node-source',
    size: particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const sourceStateBuffer = device.createBuffer({
    label: 'reaction-discovery-canonical-position-state',
    size: particleCount * 2 * 4 * Float32Array.BYTES_PER_ELEMENT,
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
    activeCandidateCount: particleCount,
    activeNodeStrideFloats: 16,
    activeNodeBuffer,
    sourceStateBuffer,
    sourceStateBufferBorrowed: true,
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

function createReactionRecord({
  materialA,
  materialB,
  activationTemperatureK = 100,
  contactRadiusM = 0.5,
  phaseMaskA = 1,
  phaseMaskB = 2,
  status = 1
}) {
  return [
    materialA, materialB, 99, activationTemperatureK,
    -1000, contactRadiusM, phaseMaskA, phaseMaskB,
    status, 0, 0, 0
  ];
}

function createMaterialPairIndexTable() {
  const records = new Float32Array([
    ...createReactionRecord({ materialA: 4, materialB: 2 }),
    ...createReactionRecord({ materialA: 2, materialB: 4 }),
    ...createReactionRecord({ materialA: 4, materialB: 2 }),
    ...createReactionRecord({ materialA: 6, materialB: 8, status: 0 }),
    ...createReactionRecord({ materialA: 8, materialB: 6, contactRadiusM: 0 }),
    ...createReactionRecord({ materialA: 9, materialB: 9 }),
    ...createReactionRecord({ materialA: 7, materialB: 3 })
  ]);
  return {
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionCount: 7,
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
  assert.equal(SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_LAYOUT.length, 27);
  assert.deepEqual(
    SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_LAYOUT.slice(-7, -3),
    [
      'maximumDisplacementBits:u32',
      'displacementCertificateStatusBits:u32',
      'authorityActiveCount:u32',
      'currentActiveCount:u32'
    ]
  );
  assert.deepEqual(
    SCHROEDER_SPATIAL_REACTION_DISCOVERY_EVIDENCE_LAYOUT.slice(-3),
    [
      'exactCellTreeNodeVisitCount:u32',
      'exactCellTreeLeafVisitCount:u32',
      'exactCellTreeMemberVisitCount:u32'
    ]
  );
  assert.equal(maxReactionContactRadiusM(createReactionTable()), Math.fround(0.75));
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /fn ss_exact_near_directory_admitted/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /fn ss_exact_cell_tree_admitted/
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
    /fn reaction_discovery_rule_index_lookup/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /fn reaction_discovery_consider_indexed_reactions/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /collect_diagnostic_evidence: u32/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /S9D_HOT_COUNTER_AGGREGATION_BEGIN/
  );
  assert.equal(
    SCHROEDER_SPATIAL_REACTION_DISCOVERY_PIPELINE_CACHE_VERSION,
    'v4-s9d-hot-counter-aggregation'
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /fn reaction_discovery_flush_hot_counters\(\) -> bool/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /return previous <= 0xffffffffu - count/
  );
  const considerPairStart = schroederSpatialReactionDiscoveryProposalWgsl.indexOf(
    'fn reaction_discovery_consider_pair('
  );
  const considerPairEnd = schroederSpatialReactionDiscoveryProposalWgsl.indexOf(
    '@compute @workgroup_size(64)\nfn propose',
    considerPairStart
  );
  const considerPairSource = schroederSpatialReactionDiscoveryProposalWgsl.slice(
    considerPairStart,
    considerPairEnd
  );
  assert.match(considerPairSource, /reaction_discovery_rule_index_lookup/);
  assert.match(considerPairSource, /reaction_discovery_consider_all_reactions/);
  assert.doesNotMatch(
    considerPairSource,
    /for\s*\(\s*var reaction_index = 0u;/
  );
  const proposeStart = schroederSpatialReactionDiscoveryProposalWgsl.indexOf(
    '@compute @workgroup_size(64)\nfn propose'
  );
  const proposeEnd = schroederSpatialReactionDiscoveryProposalWgsl.indexOf(
    '@compute @workgroup_size(64)\nfn seal',
    proposeStart
  );
  const proposeSource = schroederSpatialReactionDiscoveryProposalWgsl.slice(
    proposeStart,
    proposeEnd
  );
  assert.match(proposeSource, /ss_exact_cell_tree_node_intersects/);
  assert.match(proposeSource, /reaction_discovery_reset_hot_counters\(\)/);
  assert.match(proposeSource, /reaction_discovery_flush_hot_counters\(\)/);
  assert.doesNotMatch(proposeSource, /atomicAdd\(&traversal_evidence\[5u\]/);
  assert.doesNotMatch(proposeSource, /atomicAdd\(&traversal_evidence\[8u\]/);
  assert.doesNotMatch(proposeSource, /ss_exact_near_lower_bound_cell_key/);
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /fn seal\(/
  );
  assert.doesNotMatch(schroederSpatialReactionDiscoveryProposalWgsl, /particle_bin/i);
  assert.doesNotMatch(schroederSpatialReactionDiscoveryProposalWgsl, /candidate_budget/i);
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /reaction_discovery_phase_mask_satisfied/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /max\(self_thermo0\.z, other_thermo0\.z\) < row0\.w/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /prepare_displacement_certificate/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /@compute @workgroup_size\(64\)\s*fn prepare_displacement_certificate/
  );
  assert.match(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS/
  );
  assert.doesNotMatch(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /@compute @workgroup_size\(1\)\s*fn prepare_displacement_certificate/
  );
  assert.doesNotMatch(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /for\s*\([^)]*source_index[^)]*params\.particle_count/
  );
  assert.doesNotMatch(
    schroederSpatialReactionDiscoveryProposalWgsl,
    /for\s*\([^)]*other[^)]*params\.particle_count/
  );
});

test('reaction discovery packs canonical material pairs once and preserves original rule order', async () => {
  const device = createFakeDevice();
  const activeNodeList = createActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  const sourceThermoBuffer = device.createBuffer({
    label: 'reaction-discovery-material-pair-index-thermo',
    size: 96,
    usage: 128
  });
  const table = createMaterialPairIndexTable();
  // Discovery executes the combined upload, not the separately exposed table
  // records. Preserve that exact source of truth if a caller presents a stale
  // records mirror.
  table.records = table.records.slice();
  table.records[0] = 1234;
  const proposal = await runSchroederSpatialReactionDiscoveryProposalWebGpu({
    device,
    generation,
    sourceStateBuffer: activeNodeList.sourceStateBuffer,
    sourceThermoBuffer,
    reactionTable: table
  });

  assert.equal(proposal.reactionRuleIndex.mode, 'material-pair-indexed');
  assert.equal(proposal.reactionRuleIndex.pairCount, 2);
  assert.equal(proposal.reactionRuleIndex.ruleCount, 4);
  const suffix = proposal.reactionRuleIndex.upload.slice(table.combinedRecords.length);
  assert.deepEqual(Array.from(suffix), [
    2, 4, 0, 3,
    3, 7, 3, 1,
    0, 1, 2, 6
  ]);
  // Disabled, zero-radius, and same-material rows are omitted only because
  // the original WGSL predicate deterministically rejects them.
  assert.deepEqual(Array.from(suffix.slice(8)), [0, 1, 2, 6]);

  proposal.destroy();
  releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
  await generation.releasePromise;
  assert.equal(destroySchroederSpatialReactionDiscoveryProposalCache(device), true);
});

test('reaction discovery leaves the single-rule fast path as the exact full scan', async () => {
  const device = createFakeDevice();
  const activeNodeList = createActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  const sourceThermoBuffer = device.createBuffer({
    label: 'reaction-discovery-single-rule-thermo',
    size: 96,
    usage: 128
  });
  const source = createReactionTable();
  const records = source.records.slice(0, 12);
  const singleRuleTable = {
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionCount: 1,
    records,
    combinedRecords: records
  };
  const proposal = await runSchroederSpatialReactionDiscoveryProposalWebGpu({
    device,
    generation,
    sourceStateBuffer: activeNodeList.sourceStateBuffer,
    sourceThermoBuffer,
    reactionTable: singleRuleTable
  });
  assert.equal(proposal.reactionRuleIndex.mode, 'full-rule-scan');
  assert.equal(
    proposal.reactionRuleIndex.reason,
    'single-reaction-full-scan-is-cheaper'
  );
  proposal.destroy();
  releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
  await generation.releasePromise;
  assert.equal(destroySchroederSpatialReactionDiscoveryProposalCache(device), true);
});

test('reaction discovery binds the exact generation and optionally observes a compact GPU seal', async () => {
  const device = createFakeDevice();
  const activeNodeList = createActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  const sourceStateBuffer = activeNodeList.sourceStateBuffer;
  const sourceThermoBuffer = device.createBuffer({
    label: 'reaction-discovery-source-thermo',
    size: 2 * 3 * 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const reactionTable = createReactionTable();
  const timestampEvents = [];
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(encoder, descriptor) {
      const token = { encoder, descriptor };
      timestampEvents.push({ kind: 'begin', token });
      return token;
    },
    endEncoderSpan(encoder, token) {
      assert.equal(encoder, token.encoder);
      timestampEvents.push({ kind: 'end', token });
    }
  };
  const proposal = await runSchroederSpatialReactionDiscoveryProposalWebGpu({
    device,
    generation,
    sphParticleState: { particleCount: 2 },
    sourceStateBuffer,
    sourceThermoBuffer,
    reactionTable,
    gpuTimestampRecorder,
    observeGpuEvidence: true
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
  assert.equal(proposal.exactNearCellTree, generation.exactNearCellTree);
  assert.equal(
    proposal.exactNearCellTreeBuffer,
    generation.exactNearCellTree.treeBuffer
  );
  assert.equal(proposal.displacementCertificateBuffer, proposal.evidenceBuffer);
  assert.equal(proposal.epochIdentity.positionEpoch, 17);
  assert.equal(proposal.particleCount, 2);
  assert.equal(proposal.reactionCount, 3);
  assert.equal(proposal.proposalRowStrideFloats, 4);
  assert.equal(proposal.proposalBufferByteLength, 32);
  assert.equal(proposal.reactionRuleIndex.mode, 'material-pair-indexed');
  assert.equal(proposal.reactionRuleIndex.pairCount, 2);
  assert.equal(proposal.reactionRuleIndex.ruleCount, 2);
  assert.equal(proposal.reactionRuleIndex.pairOffsetVec4s, 9);
  assert.equal(proposal.reactionRuleIndex.ruleOffsetVec4s, 11);
  assert.equal(proposal.reactionRecordPrefixByteLength, 144);
  assert.equal(proposal.reactionRecordUploadByteLength, 192);
  assert.equal(typeof proposal.reactionDiscoveryPayloadFingerprint, 'string');
  assert.equal(proposal.reactionRecordBufferOwned, false);
  assert.equal(
    proposal.reactionRecordBufferOwnership,
    'per-device-canonical-generation-arena-cache'
  );
  assert.equal(proposal.bufferOwnership, 'per-device-canonical-generation-arena-cache');
  assert.equal(proposal.bufferCreationCount, 6);
  assert.equal(proposal.arenaWarmReuse, false);
  assert.equal(proposal.traversalCount, 1);
  assert.equal(proposal.sealDispatchCount, 1);
  assert.equal(proposal.privateLookupBuildCount, 0);
  assert.equal(proposal.fixedCandidateBuildCount, 0);
  assert.equal(proposal.exhaustiveTraversalCount, 0);
  assert.equal(proposal.candidateBudget, null);
  assert.equal(proposal.fullReadbackPerformed, false);
  assert.equal(proposal.readbackMode, 'no-full-readback');
  assert.equal(proposal.positionAuthorityIdentityExact, true);
  assert.equal(
    proposal.sourcePositionAuthority,
    'exact-canonical-generation-source-state-buffer'
  );
  assert.equal(
    proposal.gpuEvidence.schema,
    ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA
  );
  assert.equal(proposal.gpuEvidence.residentCounterBuffer, proposal.evidenceBuffer);
  assert.equal(proposal.gpuEvidence.residentCountersObserved, true);
  assert.equal(proposal.gpuEvidence.compactReadbackByteLength, 108);
  assert.equal(proposal.evidenceObservationRequested, true);
  assert.equal(
    proposal.evidenceObservationMode,
    'explicit-compact-diagnostic-observation'
  );
  assert.equal(device.mapCalls.length, 1);
  assert.equal(device.unmapCalls.length, 1);
  assert.equal(proposal.observedEvidence.ruleIndexPairLookupCount, 0);
  assert.equal(proposal.observedEvidence.ruleIndexPairMissCount, 0);
  assert.equal(proposal.observedEvidence.ruleIndexRuleVisitCount, 0);
  assert.equal(proposal.observedEvidence.fullRuleScanRuleVisitCount, 0);
  assert.equal(proposal.observedEvidence.exactCellTreeNodeVisitCount, 0);
  assert.equal(proposal.observedEvidence.exactCellTreeLeafVisitCount, 0);
  assert.equal(proposal.observedEvidence.exactCellTreeMemberVisitCount, 0);
  assert.equal(proposal.receipt.consumerId, 'reaction-discovery');
  assert.equal(proposal.receipt.gpuAuthenticated, true);
  assert.equal(isFinalizedSchroederSpatialExactNearConsumerReceipt(proposal.receipt), true);
  const consumerView = resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
    proposal,
    {
      device,
      generation,
      particleCount: 2,
      reactionCount: 3,
      reactionTable,
      sourceStateBuffer,
      sourceThermoBuffer
    }
  );
  assert.equal(consumerView.admitted, true);
  assert.equal(consumerView.proposalBuffer, proposal.proposalBuffer);
  assert.equal(consumerView.receipt, proposal.receipt);
  const exactConsumerOptions = {
    device,
    generation,
    particleCount: 2,
    reactionCount: 3,
    reactionTable,
    sourceStateBuffer,
    sourceThermoBuffer
  };
  const swappedStateBuffer = device.createBuffer({
    label: 'reaction-discovery-swapped-current-state',
    size: sourceStateBuffer.size,
    usage: 128
  });
  const swappedThermoBuffer = device.createBuffer({
    label: 'reaction-discovery-swapped-current-thermo',
    size: sourceThermoBuffer.size,
    usage: 128
  });
  for (const rejected of [
    resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
      proposal,
      { ...exactConsumerOptions, sourceStateBuffer: swappedStateBuffer }
    ),
    resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
      proposal,
      { ...exactConsumerOptions, sourceThermoBuffer: swappedThermoBuffer }
    ),
    resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
      { ...proposal },
      exactConsumerOptions
    ),
    resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
      proposal,
      {
        ...exactConsumerOptions,
        generation: {
          ...generation,
          execution: { ...generation.execution }
        }
      }
    )
  ]) {
    assert.equal(rejected.admitted, false);
    assert.equal(
      rejected.status,
      'schroeder-spatial-reaction-discovery-proposal-rejected-authenticity'
    );
  }
  assert.equal(resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
    proposal,
    {
      device,
      generation,
      particleCount: 2,
      reactionCount: 3,
      reactionTable: {
        ...reactionTable,
        combinedRecords: reactionTable.combinedRecords.slice()
      },
      sourceStateBuffer,
      sourceThermoBuffer
    }
  ).admitted, false);
  assert.equal(resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
    proposal,
    {
      device,
      generation,
      particleCount: 2,
      reactionCount: 3,
      reactionTable,
      sourceStateBuffer: null,
      sourceThermoBuffer
    }
  ).admitted, false);

  const expectationWrite = device.writes.find(({ buffer }) => (
    buffer.label.startsWith('ulg-schroeder-spatial-reaction-discovery-expectation-arena-')
  ));
  assert.ok(expectationWrite);
  assert.equal(
    expectationWrite.data[2],
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
  );
  const paramsWrite = device.writes.find(({ buffer }) => (
    buffer.label.startsWith('ulg-schroeder-spatial-reaction-discovery-params-arena-')
  ));
  assert.ok(paramsWrite);
  const paramsView = new DataView(paramsWrite.data);
  assert.equal(paramsView.getUint32(32, true), 1);
  assert.equal(paramsView.getUint32(36, true), 9);
  assert.equal(paramsView.getUint32(40, true), 2);
  assert.equal(paramsView.getUint32(44, true), 11);
  assert.equal(paramsView.getUint32(48, true), 2);
  assert.equal(paramsView.getUint32(52, true), 12);
  assert.equal(paramsView.getUint32(56, true), 1);
  assert.equal(paramsView.getUint32(60, true), 0);
  const reactionUploadWrite = device.writes.find(({ buffer, data }) => (
    buffer === proposal.reactionRecordBuffer && data instanceof Float32Array
  ));
  assert.ok(reactionUploadWrite);
  assert.deepEqual(
    Array.from(reactionUploadWrite.data.slice(0, reactionTable.combinedRecords.length)),
    Array.from(reactionTable.combinedRecords)
  );
  assert.deepEqual(
    Array.from(reactionUploadWrite.data.slice(reactionTable.combinedRecords.length)),
    [1, 2, 0, 1, 2, 4, 1, 1, 0, 1, 0, 0]
  );
  const stageSubmission = device.submissions.at(-1)[0];
  const stagePasses = stageSubmission.events.filter(({ kind }) => kind === 'pass');
  assert.deepEqual(
    stagePasses.map(({ descriptor }) => descriptor.label),
    [
      'ulg-schroeder-spatial-reaction-discovery-displacement-certificate',
      'ulg-schroeder-spatial-reaction-discovery-proposal',
      'ulg-schroeder-spatial-reaction-discovery-seal'
    ]
  );
  assert.deepEqual(stagePasses.map(({ commands }) => commands[0].dispatch), [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
  ]);
  assert.deepEqual(
    timestampEvents
      .filter(({ kind }) => kind === 'begin')
      .map(({ token }) => token.descriptor.stage),
    [
      'spatial-displacement-certificate',
      'candidate-traversal',
      'proposal-seal'
    ]
  );
  assert.equal(
    timestampEvents.filter(({ kind }) => kind === 'end').length,
    3
  );
  assert.equal(
    device.shaderModules.some(({ code }) => code === schroederSpatialReactionDiscoveryProposalWgsl),
    true
  );
  const proposalLayout = device.bindGroupLayouts.find(({ label }) => (
    label === 'ulg-schroeder-spatial-reaction-discovery-proposal-bind-group-layout'
  ));
  assert.ok(proposalLayout);
  assert.equal(
    proposalLayout.entries.filter(({ buffer }) => (
      buffer?.type === 'storage' || buffer?.type === 'read-only-storage'
    )).length,
    device.limits.maxStorageBuffersPerShaderStage
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

test('reaction discovery hot path keeps the submitted seal GPU-resident with zero host maps', async () => {
  const particleCount = 130;
  const device = createFakeDevice();
  const activeNodeList = createActiveNodeList(device, particleCount);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount
  });
  const sourceStateBuffer = activeNodeList.sourceStateBuffer;
  const sourceThermoBuffer = device.createBuffer({
    label: 'reaction-discovery-unobserved-source-thermo',
    size: particleCount * 3 * 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const reactionTable = createReactionTable();
  const proposal = await runSchroederSpatialReactionDiscoveryProposalWebGpu({
    device,
    generation,
    sourceStateBuffer,
    sourceThermoBuffer,
    reactionTable
  });

  assert.equal(proposal.ready, true);
  assert.equal(proposal.observedEvidence, null);
  assert.equal(proposal.evidenceObservationRequested, false);
  assert.equal(proposal.evidenceObservationReadbackByteLength, 0);
  assert.equal(proposal.gpuEvidence.residentCountersObserved, false);
  assert.equal(proposal.gpuEvidence.compactReadbackByteLength, 0);
  assert.equal(proposal.bufferCreationCount, 5);
  assert.equal(device.mapCalls.length, 0);
  assert.equal(device.unmapCalls.length, 0);
  const submission = device.submissions.at(-1)[0];
  assert.equal(
    submission.events.some(({ kind }) => kind === 'copy'),
    false
  );
  const passes = submission.events.filter(({ kind }) => kind === 'pass');
  assert.deepEqual(passes.map(({ commands }) => commands[0].dispatch), [
    [3, 1, 1],
    [3, 1, 1],
    [3, 1, 1]
  ]);
  assert.equal(proposal.displacementCertificateWorkgroupCount, 3);
  assert.equal(
    proposal.displacementCertificateReductionStrategy,
    'particle-parallel-atomic-u32-max-and-topology-reduction'
  );
  assert.equal(resolveSchroederSpatialReactionDiscoveryProposalForConsumer(
    proposal,
    {
      device,
      generation,
      particleCount,
      reactionCount: reactionTable.reactionCount,
      reactionTable,
      sourceStateBuffer,
      sourceThermoBuffer
    }
  ).admitted, true);
  const paramsWrite = device.writes.find(({ buffer }) => (
    buffer.label.startsWith('ulg-schroeder-spatial-reaction-discovery-params-arena-')
  ));
  assert.ok(paramsWrite);
  assert.equal(new DataView(paramsWrite.data).getUint32(56, true), 0);

  proposal.destroy();
  releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
  await generation.releasePromise;
  assert.equal(destroySchroederSpatialReactionDiscoveryProposalCache(device), true);
});

test('reaction-product placement authority rejects public buffers without an authenticated placement source family', async () => {
  const device = createFakeDevice();
  const activeNodeList = createActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  const sourceThermoBuffer = device.createBuffer({
    label: 'placement-source-thermo',
    size: 96,
    usage: 128
  });
  const successorStateBuffer = device.createBuffer({
    label: 'placement-successor-state',
    size: 64,
    usage: 128
  });
  const successorThermoBuffer = device.createBuffer({
    label: 'placement-successor-thermo',
    size: 96,
    usage: 128
  });
  const successorMechanicsBuffer = device.createBuffer({
    label: 'placement-successor-mechanics',
    size: 256,
    usage: 128
  });
  assert.throws(() => createSchroederSpatialReactionProductPlacementAuthorityWebGpu({
    device,
    generation,
    particleCount: 2,
    productEventCapacity: 6,
    sourceStateBuffer: { label: 'untagged-placement-source', size: 64 },
    sourceThermoBuffer,
    successorStateBuffer,
    successorThermoBuffer,
    successorMechanicsBuffer
  }), { code: 'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_SOURCE_FAMILY_BRAND' });
  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(await generation.releasePromise, true);
});

test('reaction discovery preserves a borrowed reaction record buffer across teardown', async () => {
  const device = createFakeDevice();
  const activeNodeList = createActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  const sourceStateBuffer = activeNodeList.sourceStateBuffer;
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
  const proposal = await runSchroederSpatialReactionDiscoveryProposalWebGpu({
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
  assert.equal(proposal.reactionRuleIndex.mode, 'full-rule-scan');
  assert.equal(
    proposal.reactionRuleIndex.reason,
    'borrowed-caller-reaction-record-buffer'
  );
  assert.equal(
    proposal.reactionRecordUploadByteLength,
    createReactionTable().combinedRecords.byteLength
  );
  proposal.destroy();
  releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
  await generation.releasePromise;
  destroySchroederSpatialReactionDiscoveryProposalCache(device);
  assert.equal(borrowedReactionRecordBuffer.destroyed, false);
});

test('reaction discovery reuses buffers when the canonical spatial arena rotates back', async () => {
  const device = createFakeDevice();
  const activeNodeList = createActiveNodeList(device);
  const sourceStateBuffer = activeNodeList.sourceStateBuffer;
  const sourceThermoBuffer = device.createBuffer({
    label: 'arena-reuse-source-thermo',
    size: 96,
    usage: 128
  });
  const reactionTable = createReactionTable();
  const artifacts = [];
  for (let index = 0; index < 4; index += 1) {
    const generation = runSchroederSpatialEpochGenerationWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    });
    const artifact = await runSchroederSpatialReactionDiscoveryProposalWebGpu({
      device,
      generation,
      sourceStateBuffer,
      sourceThermoBuffer,
      reactionTable
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
  assert.equal(artifacts[3].reactionRuleIndex, artifacts[0].reactionRuleIndex);
  assert.equal(destroySchroederSpatialReactionDiscoveryProposalCache(device), true);
});
