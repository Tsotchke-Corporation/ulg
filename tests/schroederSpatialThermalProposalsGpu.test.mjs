import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMISSION_WORD,
  SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMITTED,
  SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_REJECTED,
  SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK,
  SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE,
  SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL,
  SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE,
  SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_RANK_COUNT_WORD,
  SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_OFFSET_BYTES,
  SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_SENTINEL,
  SCHROEDER_SPATIAL_THERMAL_CONSUMER,
  SCHROEDER_SPATIAL_THERMAL_CONSUMERS,
  SCHROEDER_SPATIAL_THERMAL_CURRENT_ACTIVE_SOURCE_COUNT_WORD,
  SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS,
  SCHROEDER_SPATIAL_THERMAL_CSR_DEFAULT_ROW_STRIDE,
  SCHROEDER_SPATIAL_THERMAL_CSR_MAGIC,
  SCHROEDER_SPATIAL_THERMAL_CSR_ROW_STATE_WRITING,
  SCHROEDER_SPATIAL_THERMAL_CSR_ROW_STRIDE_WORD,
  SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_EXACT_NEAR_REWALK,
  SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY,
  SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_UNIFORM_COMPLETION,
  SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_WORD,
  SCHROEDER_SPATIAL_THERMAL_CSR_VERSION,
  SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_INVALID,
  SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW,
  SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_READY,
  SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS,
  SCHROEDER_SPATIAL_THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD,
  SCHROEDER_SPATIAL_THERMAL_EVIDENCE_LAYOUT,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_MAGIC,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_LAYOUT,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_VERSION,
  ULG_SCHROEDER_SPATIAL_THERMAL_CANDIDATE_CSR_SCHEMA,
  classicThermalBinnedProposalWgsl,
  classicThermalCandidateProposalWgsl,
  classicThermalProposalWgsl,
  createClassicThermalProposalWebGpuEncoderStage,
  createSchroederSpatialMatchedTimeThermalProposalEncoderStage,
  destroyClassicThermalProposalRuntime,
  destroySchroederSpatialThermalProposalRuntime,
  evaluateSchroederSpatialThermalPairProposal,
  runSchroederSpatialThermalProposalWebGpu,
  schroederSpatialThermalDerivedPrepassWgsl,
  schroederSpatialThermalProposalWgsl
} from '../src/runtime/sph/schroederSpatialThermalProposalsGpu.js';
import {
  isSchroederSpatialExactNearResidentConsumerBinding,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  createSchroederSpatialEpochTransaction
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  issuePostSeparationThermalBinAuthority,
  postSeparationThermalBinAuthorityLiveness,
  releasePostSeparationThermalBinAuthorityAfterQueue
} from '../src/runtime/sph/sphPostSeparationThermalBinAuthority.js';
import {
  SPH_THERMAL_PAIR_CONDUCTION_RATE_DEFAULT,
  SPH_THERMAL_RADIATION_PAIR_RANGE_RADII,
  SPH_THERMAL_STEFAN_BOLTZMANN_W_PER_M2_K4
} from '../src/runtime/sph/sphThermalGpuKernel.js';

function copyBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    );
  }
  return new Uint8Array();
}

function createFakeEncoder(device, descriptor = {}) {
  const event = { descriptor, clears: [], copies: [], passes: [] };
  device.encoders.push(event);
  return {
    clearBuffer(buffer, offset = 0, size = null) {
      event.clears.push({ buffer, offset, size });
    },
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
      event.copies.push({
        source,
        sourceOffset,
        destination,
        destinationOffset,
        size
      });
    },
    beginComputePass(passDescriptor = {}) {
      const pass = { descriptor: passDescriptor, commands: [] };
      event.passes.push(pass);
      return {
        setPipeline(pipeline) { pass.pipeline = pipeline; },
        setBindGroup(index, bindGroup) { pass.bindGroup = { index, bindGroup }; },
        dispatchWorkgroups(x, y = 1, z = 1) {
          pass.commands.push({ dispatch: [x, y, z] });
        },
        dispatchWorkgroupsIndirect(buffer, offset = 0) {
          pass.commands.push({ dispatchIndirect: { buffer, offset } });
        },
        end() { pass.ended = true; }
      };
    },
    finish() { return event; }
  };
}

function createFakeDevice() {
  const device = {
    buffers: [],
    writes: [],
    submissions: [],
    encoders: [],
    shaderModules: [],
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 12,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        device.writes.push({ buffer, offset, bytes: copyBytes(data) });
      },
      submit(commandBuffers) { device.submissions.push(commandBuffers); },
      onSubmittedWorkDone() { return Promise.resolve(); }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyCount: 0,
        destroy() { this.destroyCount += 1; }
      };
      device.buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      device.shaderModules.push(descriptor);
      return descriptor;
    },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) { return { index }; }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder(descriptor) { return createFakeEncoder(device, descriptor); }
  };
  return device;
}

function createActiveNodeList(device, particleCount = 2) {
  const activeNodeBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'thermal-proposal-active-node-source',
    size: particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
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

function liveFixture(particleCount = 2) {
  const device = createFakeDevice();
  const activeNodeList = createActiveNodeList(device, particleCount);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount
  });
  assert.equal(generation.selected, true);
  const buffer = (label, size) => tagWebGpuBufferDevice(device.createBuffer({
    label,
    size,
    usage: 128
  }), device);
  const responseRecordBuffer = buffer('thermal-response-records', 2 * 8 * 4);
  const responseBuffer = buffer('thermal-responses', 2 * 16 * 4);
  const graphNodeBuffer = buffer('thermal-graph-nodes', 8 * 16);
  const graphSampleBuffer = buffer('thermal-graph-samples', 8 * 16);
  const sphParticleUpload = {
    stateBuffer: buffer('thermal-source-state', particleCount * 2 * 16),
    thermoBuffer: buffer('thermal-source-thermo', particleCount * 3 * 16)
  };
  const mlsMpmParticleUpload = {
    mechanicsBuffer: buffer('thermal-source-mechanics', particleCount * 24 * 4)
  };
  const schroederSpatialEpochTransaction =
    createSchroederSpatialEpochTransaction({
      device,
      generation,
      sphParticleUpload,
      mlsMpmParticleUpload,
      requiredReaderIds: [],
      enabledConsumerReaderIds: [
        'thermal-conduction',
        'thermal-radiation'
      ],
      consumerSupportProfileIds: {
        'thermal-conduction':
          SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1,
        'thermal-radiation':
          SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1
      }
    });
  return {
    device,
    generation,
    schroederSpatialEpochTransaction,
    sphParticleState: {
      particleCount,
      smoothingLengthM: 0.125
    },
    sphParticleUpload,
    mlsMpmParticleUpload,
    thermalResponseGraphUpload: {
      schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      destroyed: false,
      materialCount: 2,
      responseCount: 2,
      graphCount: 1,
      nodeCount: 8,
      sampleCount: 8,
      responseRecordBuffer,
      responseBuffer,
      graphNodeBuffer,
      graphSampleBuffer
    }
  };
}

function liveActiveRankFixture(particleCount = 2) {
  const fixture = liveFixture(particleCount);
  const assignmentBuffer = tagWebGpuBufferDevice(fixture.device.createBuffer({
    label: 'thermal-active-rank-level-assignment-source',
    size: particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), fixture.device);
  const levelAssignment = {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: 16,
    assignmentBuffer,
    assignmentBufferByteLength: particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    sourceStateBuffer: fixture.sphParticleUpload.stateBuffer,
    sourceStateBufferBorrowed: true,
    minLevel: 0,
    maxLevel: 0,
    chartId: 0,
    baseGridSpacingM: 0.125,
    storageGeneration: 41,
    physicsTick: 43,
    physicsSubstep: 0,
    positionEpoch: 47,
    topologyEpoch: 53,
    chartEpoch: 59,
    levelEpoch: 61,
    supportEpoch: 67,
    phaseVolumeAssignmentOverlayEnabled: false
  };
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device: fixture.device,
    levelAssignment,
    particleCount
  });
  assert.equal(generation.selected, true, generation.reason);
  assert.equal(generation.aggregateView, null);
  assert.ok(generation.activeRankView);
  const schroederSpatialEpochTransaction = createSchroederSpatialEpochTransaction({
    device: fixture.device,
    generation,
    sphParticleUpload: fixture.sphParticleUpload,
    mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
    requiredReaderIds: [],
    enabledConsumerReaderIds: [
      'thermal-conduction',
      'thermal-radiation'
    ],
    consumerSupportProfileIds: {
      'thermal-conduction': SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1,
      'thermal-radiation': SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1
    }
  });
  return {
    ...fixture,
    generation,
    levelAssignment,
    schroederSpatialEpochTransaction
  };
}

test('thermal proposal ABI is two-profile, resident, and binding-10 compatible', () => {
  assert.deepEqual(SCHROEDER_SPATIAL_THERMAL_CONSUMERS, [
    {
      consumerId: 'thermal-conduction',
      supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1
    },
    {
      consumerId: 'thermal-radiation',
      supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1
    }
  ]);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS, 16);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS, 4);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_PROPOSAL_VERSION, 2);
  assert.equal(
    ULG_SCHROEDER_SPATIAL_THERMAL_CANDIDATE_CSR_SCHEMA,
    'peercompute.ulg.schroeder-spatial-thermal-candidate-csr.v1'
  );
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_MAGIC, 0x5443_5331);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_VERSION, 5);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS, 8);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_ROW_STRIDE_WORD, 4);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_WORD, 7);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_DEFAULT_ROW_STRIDE, 1025);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_ROW_STATE_WRITING, 0xffff_ffff);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_READY, 1);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_INVALID, 2);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW, 4);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_UNIFORM_COMPLETION, 1);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY, 2);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_EXACT_NEAR_REWALK, 4);
  assert.deepEqual(SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_LAYOUT, [
    'limitedConductionSpecificEnergyDeltaJPerKg:f32',
    'limitedRadiationSpecificEnergyDeltaJPerKg:f32',
    'lowerSpecificInternalEnergyBoundJPerKg:f32',
    'upperSpecificInternalEnergyBoundJPerKg:f32'
  ]);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_LAYOUT[6],
    'conductionInvalidCount:atomic<u32>');
  assert.equal(SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_LAYOUT[7],
    'radiationInvalidCount:atomic<u32>');
  assert.equal(SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_LAYOUT[15],
    'publishedRowCount:atomic<u32>');
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_OFFSET_BYTES, 104);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_SENTINEL, 1);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_EVIDENCE_LAYOUT.length, 16);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS, 9);
  assert.equal(
    SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMISSION_WORD,
    5
  );
  assert.equal(SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMITTED, 1);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_REJECTED, 2);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE, 0);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE, 1);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL, 2);
  assert.equal(
    SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK,
    3
  );
  assert.equal(
    SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_LAYOUT[5],
    'activeMemberProjectionAdmission:atomic<u32>'
  );
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CURRENT_ACTIVE_SOURCE_COUNT_WORD, 6);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD, 7);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_RANK_COUNT_WORD, 8);
  assert.equal(
    SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_LAYOUT[6],
    'currentActiveSourceCount:atomic<u32>'
  );
  assert.equal(
    SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_LAYOUT[7],
    'expectedActiveMemberCount:atomic<u32>'
  );
  assert.equal(
    SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_LAYOUT[8],
    'materializedActiveSourceRankCount:atomic<u32>'
  );
});

test('thermal proposal WGSL shares one pair-law core across exact-near and classic bins', () => {
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /thermal_prepass_temperature_slope_from_graph/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /thermal_prepass_carrier_phase_classification/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /thermal_prepass_carrier_selection/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /thermal_prepass_energy_inverse_for_temperature/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /fn resolve_budget/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /source_thermo\[particle_index \* 3u \+ 1u\]/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /phase_from == classification\.x[\s\S]*phase_to == classification\.x/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /classification\.y == 1u && abs\(row0\.y - 2\.0\) < 0\.5/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /thermal_prepass_temperature_from_graph\([\s\S]*vel_u\.w/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /0\.238732414637843 \* mass_kg \/ rest_density_kg_per_m3/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /atomicMax\(&thermal_derived\[2u\], temperature_bits\)/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /atomicMax\(&thermal_derived\[3u\], ~temperature_bits\)/);
  assert.match(
    schroederSpatialThermalDerivedPrepassWgsl,
    /@binding\(9\) var<storage, read> preflight_spatial_directory/
  );
  assert.match(
    schroederSpatialThermalDerivedPrepassWgsl,
    /@binding\(10\) var<storage, read> preflight_spatial_aggregate_view/
  );
  assert.match(
    schroederSpatialThermalDerivedPrepassWgsl,
    /@binding\(11\) var<storage, read_write> thermal_active_dispatch/
  );
  const deriveEntryPoint = schroederSpatialThermalDerivedPrepassWgsl.slice(
    schroederSpatialThermalDerivedPrepassWgsl.indexOf('fn derive('),
    schroederSpatialThermalDerivedPrepassWgsl.indexOf('fn resolve_budget(')
  );
  assert.match(
    deriveEntryPoint,
    /source_rank == 0u[\s\S]*thermal_prepass_active_member_projection_admitted\(\)/
  );
  assert.match(
    deriveEntryPoint,
    /dispatch_source_count = preflight_spatial_aggregate_view\[96u\][\s\S]*thermal_active_dispatch\[0u\]/
  );
  assert.match(
    schroederSpatialThermalDerivedPrepassWgsl,
    /fn thermal_prepass_active_rank_view_admitted\(\) -> bool[\s\S]*THERMAL_PREFLIGHT_ACTIVE_RANK_STATUS_EXACT[\s\S]*preflight_spatial_aggregate_view\[49u\]/
  );
  assert.match(
    deriveEntryPoint,
    /THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK[\s\S]*dispatch_source_count = preflight_spatial_aggregate_view\[26u\]/
  );
  assert.match(
    deriveEntryPoint,
    /thermal_prepass_active_rank_membership_matches\([\s\S]*current_active[\s\S]*THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_active_source_rank_at_ordinal\(/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_active_rank_view_source_at_ordinal\([\s\S]*active_source_indices_offset[\s\S]*spatial_directory\[spatial_directory\[31u\] \+ source_rank\] != source_index/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_active_rank_view_cell_range\([\s\S]*prefix_offset \+ member_end/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /selected_source_rank[\s\S]*left_active_count/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /thermal_bulk_dormant_projection_evidence[\s\S]*thermal_active_source_rank_sidecar_word/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK[\s\S]*thermal_active_rank_view_source_at_ordinal\(global_id\.x, false\)/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /active_ordinal_begin[\s\S]*thermal_active_rank_view_cell_range[\s\S]*active_lookup\.source_rank < member_range\.begin/
  );
  assert.match(
    deriveEntryPoint,
    /THERMAL_PREFLIGHT_ACTIVE_MEMBER_REJECTED[\s\S]*THERMAL_PREFLIGHT_ACTIVE_MEMBER_ADMITTED/
  );
  assert.match(
    deriveEntryPoint,
    /THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL[\s\S]*0xffffffffu[\s\S]*thermal_prepass_source_at_rank\(source_rank\)[\s\S]*atomicStore\(&thermal_derived\[local_sidecar_word\], source_rank\)/
  );
  assert.match(
    deriveEntryPoint,
    /fn finalize_active_dispatch\([\s\S]*current_active_count == materialized_active_count[\s\S]*thermal_active_dispatch\[0u\]/
  );
  assert.match(schroederSpatialThermalProposalWgsl,
    /ss_exact_near_directory_admitted\(conduction_expectation\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /ss_exact_near_directory_admitted\(radiation_expectation\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /ss_exact_near_cell_member_range/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /thermal_params\.conduction_rate[\s\S]*other_temperature - self_temperature/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /stefan_boltzmann_w_per_m2_k4[\s\S]*thermal_pow4\(other_temperature\) - thermal_pow4\(self_temperature\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /equalizing_energy_j \* THERMAL_PAIR_RELAXATION_LIMIT/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /min\(self_gain_scale, other_loss_scale\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /min\(self_loss_scale, other_gain_scale\)/);
  assert.match(schroederSpatialThermalProposalWgsl, /fn budget/);
  assert.match(schroederSpatialThermalProposalWgsl, /fn propose/);
  assert.match(schroederSpatialThermalProposalWgsl, /fn budget_binned/);
  assert.match(schroederSpatialThermalProposalWgsl, /fn propose_binned/);
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /@binding\(11\) var<storage, read_write> thermal_csr_source_row_states/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /@binding\(12\) var<storage, read_write> thermal_csr_unused/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /@binding\(13\) var<storage, read_write> thermal_csr_control_and_peers/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_csr_claim_source_row[\s\S]*?loop \{[\s\S]*?atomicCompareExchangeWeak[\s\S]*?claim\.old_value != 0u/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_csr_capture_candidate\([\s\S]*?capture_row\.base[\s\S]*?atomicStore\([\s\S]*?fn validate_thermal_csr_rows\([\s\S]*?fn seal_thermal_csr\(/
  );
  assert.doesNotMatch(
    schroederSpatialThermalProposalWgsl,
    /finalize_thermal_csr_counts|scatter_thermal_csr|source_counts_or_offsets/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /csr_lookup && thermal_csr_replay_admitted\(\)[\s\S]*?\} else \{[\s\S]*?for \(\s*var level_ordinal/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_csr_mark_route\(route_bits: u32\)[\s\S]*?THERMAL_CSR_ROUTE_WORD/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /!budget_mode && lookup_mode == 2u[\s\S]*?thermal_csr_mark_route\(select\([\s\S]*?THERMAL_CSR_ROUTE_EXACT_NEAR_REWALK[\s\S]*?THERMAL_CSR_ROUTE_REPLAY[\s\S]*?thermal_csr_replay_admitted\(\)/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /thermal_csr_capture_abandoned[\s\S]*?thermal_csr_abort_capture/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /THERMAL_CSR_SKIPPED_MEMBER_BIT \| thermal_csr_skipped_member_count/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_visit_fused_pair\([\s\S]*?\) -> u32 \{[\s\S]*?other_index == self_index[\s\S]*?THERMAL_PAIR_VISIT_OUTCOME_SELF[\s\S]*?other_pos_mass\.w <= 0\.0[\s\S]*?THERMAL_PAIR_VISIT_OUTCOME_NO_REPLAY[\s\S]*?distance_squared_m2[\s\S]*?THERMAL_PAIR_VISIT_OUTCOME_NO_REPLAY[\s\S]*?conduction_hit[\s\S]*?radiation_hit[\s\S]*?THERMAL_PAIR_VISIT_OUTCOME_REPLAY/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /let thermal_pair_visit_outcome = thermal_visit_fused_pair\([\s\S]*?\);[\s\S]*?thermal_pair_visit_outcome[\s\S]*?THERMAL_PAIR_VISIT_OUTCOME_NO_REPLAY[\s\S]*?thermal_csr_add_skipped_member_count\([\s\S]*?1u[\s\S]*?else if \(!thermal_csr_capture_candidate\(/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /!budget_mode && thermal_params\.candidate_capacity != 0u/
  );
  for (const classicSource of [
    classicThermalProposalWgsl,
    classicThermalBinnedProposalWgsl,
    classicThermalCandidateProposalWgsl
  ]) {
    assert.doesNotMatch(classicSource, /thermal_csr_/);
  }
  assert.match(schroederSpatialThermalProposalWgsl,
    /fn thermal_traverse_exact_source_rank[\s\S]*active_rank_prevalidated: bool[\s\S]*ss_exact_near_source_at_member\([\s\S]*source_rank[\s\S]*thermal_traverse_particle\([\s\S]*lookup\.source_index,[\s\S]*budget_mode,[\s\S]*0u,[\s\S]*active_rank_prevalidated/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /thermal_traverse_exact_source_rank\(global_id\.x, true, false\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /thermal_traverse_exact_source_rank\(global_id\.x, false, false\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /thermal_traverse_particle\(global_id\.x, true, 1u, false\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /thermal_traverse_particle\(global_id\.x, false, 1u, false\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /thermal_mark_invalid\(true\)[\s\S]*thermal_mark_invalid\(false\)/);
  const cachedProjectionAdmission = /fn thermal_active_member_projection_admitted\(\) -> bool \{[\s\S]*?atomicLoad\([\s\S]*?THERMAL_ACTIVE_MEMBER_PROJECTION_ADMISSION_WORD[\s\S]*?== THERMAL_ACTIVE_MEMBER_PROJECTION_ADMITTED;[\s\S]*?\}/;
  assert.match(schroederSpatialThermalProposalWgsl, cachedProjectionAdmission);
  assert.match(classicThermalProposalWgsl, cachedProjectionAdmission);
  assert.match(classicThermalBinnedProposalWgsl, cachedProjectionAdmission);
  assert.match(classicThermalCandidateProposalWgsl, cachedProjectionAdmission);
  assert.doesNotMatch(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_projection_(?:mix_u32|fingerprint)/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /next_u < energy_lo[\s\S]*next_u > energy_hi/
  );
  assert.doesNotMatch(
    schroederSpatialThermalProposalWgsl,
    /next_u < energy_lo - tolerance|next_u > energy_hi \+ tolerance/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /atomicAdd\(&thermal_proposals\[15u\], 1u\)/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_publish_proposal_row\(row_offset: u32, row: vec4<f32>\)/
  );
  assert.equal(
    schroederSpatialThermalProposalWgsl.match(
      /\bthermal_publish_proposal_row\(/g
    )?.length,
    4
  );
  assert.equal(
    schroederSpatialThermalProposalWgsl.match(
      /atomicAdd\(&thermal_proposals\[15u\], 1u\)/g
    )?.length,
    1
  );
  const inactiveRowBranch = schroederSpatialThermalProposalWgsl.indexOf(
    'if (self_pos_mass.w <= 0.0)'
  );
  const uniformTemperatureBranch = schroederSpatialThermalProposalWgsl.indexOf(
    'if (global_max_temperature_bits == global_min_temperature_bits)',
    inactiveRowBranch
  );
  const boundedLiveRowBranch = schroederSpatialThermalProposalWgsl.indexOf(
    'let energy_lo = thermal_derived_value(particle_index, 6u)',
    uniformTemperatureBranch
  );
  const proposalTraversalEnd = schroederSpatialThermalProposalWgsl.indexOf(
    '@compute @workgroup_size(64)\nfn budget',
    boundedLiveRowBranch
  );
  assert.ok(
    inactiveRowBranch >= 0
      && uniformTemperatureBranch > inactiveRowBranch
      && boundedLiveRowBranch > uniformTemperatureBranch
      && proposalTraversalEnd > boundedLiveRowBranch
  );
  const publicationCount = (begin, end) => (
    schroederSpatialThermalProposalWgsl
      .slice(begin, end)
      .match(/\bthermal_publish_proposal_row\(/g)?.length ?? 0
  );
  assert.equal(publicationCount(inactiveRowBranch, uniformTemperatureBranch), 1);
  assert.equal(publicationCount(uniformTemperatureBranch, boundedLiveRowBranch), 1);
  assert.equal(publicationCount(boundedLiveRowBranch, proposalTraversalEnd), 1);
  assert.match(schroederSpatialThermalProposalWgsl,
    /thermal_flush_evidence\(index: u32, count: u32, is_conduction: bool\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /global_max_temperature_bits == global_min_temperature_bits/);
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_uniform_completion_admitted\(\) -> bool[\s\S]*current_active_count == 0u[\s\S]*THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE[\s\S]*expected_active_count == particle_count[\s\S]*THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL[\s\S]*THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK[\s\S]*current_active_count == expected_active_count[\s\S]*return false/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_uniform_completion_workgroup_admitted\([\s\S]*workgroupBarrier\(\)/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_record_uniform_completion\(budget_mode: bool\)[\s\S]*thermal_evidence_add\(0u, source_count, true\)[\s\S]*thermal_csr_mark_route\(THERMAL_CSR_ROUTE_UNIFORM_COMPLETION\)[\s\S]*atomicAdd\(&thermal_proposals\[15u\], source_count\)/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_publish_uniform_completion_row\(particle_index: u32\)[\s\S]*thermal_proposals\[row_offset \+ 2u\][\s\S]*thermal_derived\[derived_row_offset \+ 6u\]/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_publish_uniform_completion_active_ordinal\(active_ordinal: u32\)[\s\S]*thermal_active_rank_view_source_at_ordinal\(active_ordinal, false\)[\s\S]*thermal_publish_uniform_completion_row\(lookup\.source_index\)/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_materialize_uniform_completion_active_ordinal\(active_ordinal: u32\)[\s\S]*thermal_active_source_rank_sidecar_word\(active_ordinal\)[\s\S]*atomicStore\(&thermal_derived\[sidecar_word\], lookup\.source_rank\)/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn propose\([\s\S]*THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK[\s\S]*THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD[\s\S]*thermal_publish_uniform_completion_active_ordinal\(global_id\.x\)/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_active_rank_view_source_at_ordinal\([\s\S]*prevalidated: bool[\s\S]*if \(prevalidated\)[\s\S]*active_ranks_offset \+ active_ordinal[\s\S]*active_source_indices_offset \+ active_ordinal/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_active_rank_view_cell_range\([\s\S]*prevalidated: bool[\s\S]*if \(prevalidated\)[\s\S]*prefix_offset \+ member_begin[\s\S]*prefix_offset \+ member_end/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /current_active_count != expected_active_count[\s\S]*materialized_active_count != expected_active_count[\s\S]*thermal_traverse_exact_source_rank\([\s\S]*projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK/
  );
  assert.match(
    schroederSpatialThermalProposalWgsl,
    /fn thermal_traverse_particle\([\s\S]*active_rank_prevalidated: bool[\s\S]*use_prevalidated_active_rank[\s\S]*thermal_active_rank_view_cell_range\([\s\S]*use_prevalidated_active_rank[\s\S]*thermal_active_rank_view_source_at_ordinal\([\s\S]*use_prevalidated_active_rank/
  );
  assert.match(schroederSpatialThermalProposalWgsl,
    /if \(self_pos_mass\.w <= 0\.0\)/);
  assert.doesNotMatch(schroederSpatialThermalProposalWgsl,
    /atomicAdd\(&traversal_evidence\[3u\], 1u\)/);
  assert.doesNotMatch(schroederSpatialThermalProposalWgsl,
    /atomicAdd\(&traversal_evidence\[4u\], 1u\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /spatial_directory\[cell\] > bin_capacity/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /thermal_evidence_add\(15u, 1u, true\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /other_index < thermal_params\.particle_count/);
  assert.equal(
    schroederSpatialThermalProposalWgsl.match(
      /fn thermal_visit_fused_pair\(/g
    )?.length,
    1
  );
  assert.doesNotMatch(schroederSpatialThermalProposalWgsl, /candidate_budget/i);
});

test('manufactured thermal pair proposals are symmetric and energy conserving', () => {
  assert.equal(SPH_THERMAL_PAIR_CONDUCTION_RATE_DEFAULT, 1500);
  assert.equal(SPH_THERMAL_RADIATION_PAIR_RANGE_RADII, 4);
  assert.equal(SPH_THERMAL_STEFAN_BOLTZMANN_W_PER_M2_K4, 5.670374419e-8);
  const common = {
    distanceM: 0.08,
    smoothingLengthM: 0.05,
    radiusM: 0.04,
    otherRadiusM: 0.05,
    massKg: 2,
    otherMassKg: 3,
    temperatureK: 300,
    otherTemperatureK: 900,
    temperatureSlopeKdPerJPerKg: 0.002,
    otherTemperatureSlopeKdPerJPerKg: 0.003,
    emissivity: 0.8,
    otherEmissivity: 0.6,
    dtS: 0.01
  };
  const forward = evaluateSchroederSpatialThermalPairProposal(common);
  const reverse = evaluateSchroederSpatialThermalPairProposal({
    ...common,
    radiusM: common.otherRadiusM,
    otherRadiusM: common.radiusM,
    massKg: common.otherMassKg,
    otherMassKg: common.massKg,
    temperatureK: common.otherTemperatureK,
    otherTemperatureK: common.temperatureK,
    temperatureSlopeKdPerJPerKg: common.otherTemperatureSlopeKdPerJPerKg,
    otherTemperatureSlopeKdPerJPerKg: common.temperatureSlopeKdPerJPerKg,
    emissivity: common.otherEmissivity,
    otherEmissivity: common.emissivity
  });
  assert.ok(Math.abs(forward.conductionEnergyJ + reverse.conductionEnergyJ) < 1e-12);
  assert.ok(Math.abs(forward.radiationEnergyJ + reverse.radiationEnergyJ) < 1e-12);
  assert.ok(Math.abs(
    forward.conductionSpecificEnergyDeltaJPerKg * common.massKg
      + reverse.conductionSpecificEnergyDeltaJPerKg * common.otherMassKg
  ) < 1e-12);
  assert.ok(Math.abs(
    forward.radiationSpecificEnergyDeltaJPerKg * common.massKg
      + reverse.radiationSpecificEnergyDeltaJPerKg * common.otherMassKg
  ) < 1e-12);
  assert.equal(forward.neighborMinTemperatureK, 300);
  assert.equal(forward.neighborMaxTemperatureK, 900);
});

test('manufactured microscopic steam and hot-iron proposal is bounded and conservative', () => {
  const steamMassKg = (917 / 125) * 1e-7 * 1.01;
  const ironMassKg = 1507.68 / 27;
  const common = {
    distanceM: 0.1,
    smoothingLengthM: 0.248,
    radiusM: 0.0066,
    otherRadiusM: 0.118,
    massKg: steamMassKg,
    otherMassKg: ironMassKg,
    temperatureK: 373.15,
    otherTemperatureK: 1850,
    temperatureSlopeKdPerJPerKg: 0.000501002,
    otherTemperatureSlopeKdPerJPerKg: 0.0002,
    emissivity: 0,
    otherEmissivity: 0,
    dtS: 5e-4
  };
  const steam = evaluateSchroederSpatialThermalPairProposal(common);
  const iron = evaluateSchroederSpatialThermalPairProposal({
    ...common,
    radiusM: common.otherRadiusM,
    otherRadiusM: common.radiusM,
    massKg: common.otherMassKg,
    otherMassKg: common.massKg,
    temperatureK: common.otherTemperatureK,
    otherTemperatureK: common.temperatureK,
    temperatureSlopeKdPerJPerKg: common.otherTemperatureSlopeKdPerJPerKg,
    otherTemperatureSlopeKdPerJPerKg: common.temperatureSlopeKdPerJPerKg
  });

  assert.ok(steam.conductionEnergyJ > 0);
  assert.ok(steam.conductionEnergyJ < 1);
  assert.ok(steam.conductionSpecificEnergyDeltaJPerKg > 0);
  assert.ok(steam.conductionSpecificEnergyDeltaJPerKg < 1e6);
  assert.ok(Math.abs(steam.conductionEnergyJ + iron.conductionEnergyJ) < 1e-12);
  assert.ok(Math.abs(
    steam.conductionSpecificEnergyDeltaJPerKg * steamMassKg
      + iron.conductionSpecificEnergyDeltaJPerKg * ironMassKg
  ) < 1e-12);
});

test('thermal proposal selects the authenticated base active-rank epoch view', async () => {
  const fixture = liveActiveRankFixture(2);
  const result = runSchroederSpatialThermalProposalWebGpu({
    ...fixture,
    dtS: 0.001
  });
  assert.equal(
    result.activeSourceProjectionMode,
    SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
  );
  assert.equal(result.activeRankView, fixture.generation.activeRankView);
  assert.equal(
    result.activeRankViewAdmissionStatus,
    'schroeder-spatial-active-rank-view-admitted-host-descriptor'
  );
  assert.equal(
    result.activeProjectionViewBuffer,
    fixture.generation.activeRankView.activeRankViewBuffer
  );
  assert.equal(result.hierarchyTraversalCount, 2);
  assert.equal(result.preferredHierarchyTraversalCount, 1);
  assert.equal(
    result.thermalCandidateCsr?.schema,
    ULG_SCHROEDER_SPATIAL_THERMAL_CANDIDATE_CSR_SCHEMA
  );
  assert.equal(result.thermalCandidateCsr?.failClosed, true);
  assert.deepEqual(result.thermalCandidateCsr?.routeEvidence, {
    schema: 'peercompute.ulg.schroeder-spatial-thermal-candidate-csr-route-evidence.v1',
    magic: SCHROEDER_SPATIAL_THERMAL_CSR_MAGIC,
    version: SCHROEDER_SPATIAL_THERMAL_CSR_VERSION,
    controlWordCount: SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS,
    readbackByteLength: SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS * 4,
    statusWord: 6,
    routeWord: SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_WORD,
    statusBits: {
      ready: SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_READY,
      invalid: SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_INVALID,
      overflow: SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW,
      rowsFinalized: 8,
      validated: 16
    },
    routeBits: {
      uniformCompletion: SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_UNIFORM_COMPLETION,
      replay: SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY,
      exactNearRewalk: SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_EXACT_NEAR_REWALK
    },
    capturePolicy: 'diagnostic-only-explicit-control-header-readback',
    normalHotLoopReadbackFree: true
  });
  assert.equal(
    result.thermalCandidateCsr?.overflowPolicy,
    'candidate-receipt-fail-closed-then-authenticated-exact-near-rewalk-no-truncated-source-row-publication'
  );
  assert.equal(
    result.thermalCandidateCsr.sourceRowStateBuffer.usage & 128,
    128,
    'fixed source-row state must carry STORAGE usage'
  );
  assert.equal(result.thermalCandidateCsr.rowStride,
    SCHROEDER_SPATIAL_THERMAL_CSR_DEFAULT_ROW_STRIDE);
  const stage = createSchroederSpatialMatchedTimeThermalProposalEncoderStage({
    device: fixture.device,
    currentStateBuffer: fixture.sphParticleUpload.stateBuffer,
    currentThermoBuffer: fixture.sphParticleUpload.thermoBuffer,
    thermalResponseGraphUpload: fixture.thermalResponseGraphUpload,
    ...result.preparedLawConfig,
    schroederSpatialThermalProposal: result
  });
  const encoder = fixture.device.createCommandEncoder({
    label: 'thermal-active-rank-unit-encoder'
  });
  stage.encode(encoder);
  fixture.device.queue.submit([encoder.finish()]);
  assert.equal(stage.markSubmittedWork(), true);
  const thermalEncoder = fixture.device.encoders.at(-1);
  const passes = thermalEncoder.passes;
  assert.deepEqual(passes.map((pass) => pass.descriptor.label), [
    'ulg-schroeder-spatial-thermal-derived-prepass',
    'ulg-schroeder-spatial-thermal-directional-budget',
    'ulg-schroeder-spatial-thermal-csr-validate-rows',
    'ulg-schroeder-spatial-thermal-csr-seal',
    'ulg-schroeder-spatial-thermal-budget-resolve',
    'ulg-schroeder-spatial-thermal-reciprocal-limited-proposal'
  ]);
  for (const index of [1, 5]) {
    assert.deepEqual(passes[index].commands[0].dispatchIndirect, {
      buffer: result.activeDispatchBuffer,
      offset: 0
    });
  }
  assert.deepEqual(thermalEncoder.copies, []);
  assert.equal(result.releaseAfterCanonicalApplySubmittedWork(), true);
  await fixture.device.queue.onSubmittedWorkDone();
});

test('a stale uniform CPU mirror cannot suppress the thermal candidate receipt', async () => {
  const fixture = liveFixture(2);
  const state = new Float32Array(2 * 8);
  const thermo = new Float32Array(2 * 12);
  for (let index = 0; index < 2; index += 1) {
    state[index * 8 + 3] = 1;
    state[index * 8 + 7] = 1234;
  }
  const result = runSchroederSpatialThermalProposalWebGpu({
    ...fixture,
    sphParticleState: {
      ...fixture.sphParticleState,
      state,
      thermo,
      // The retained GPU state can have changed after G2P even though this
      // CPU mirror remains uniformly 1234 J/kg. The GPU prepass—not this
      // mirror—must decide whether the pairwise fast path is empty.
      cpuStateStale: true
    },
    dtS: 0.001
  });
  assert.equal(
    result.thermalCandidateCsr?.schema,
    ULG_SCHROEDER_SPATIAL_THERMAL_CANDIDATE_CSR_SCHEMA
  );
  assert.equal(result.thermalCandidateCsrUnavailableReason, null);
  assert.equal(result.preferredHierarchyTraversalCount, 1);
  assert.equal(result.abandonPreparedWork('stale-cpu-mirror-unit'), true);
  await fixture.device.queue.onSubmittedWorkDone();
  await new Promise((resolve) => setImmediate(resolve));
});

test('thermal proposal preparation defers matched-time work and returns resident bindings with cached ownership', async () => {
  const fixture = liveFixture();
  const beforeBufferCount = fixture.device.buffers.length;
  const beforeEncoderCount = fixture.device.encoders.length;
  const beforeSubmissionCount = fixture.device.submissions.length;
  const result = runSchroederSpatialThermalProposalWebGpu({
    ...fixture,
    dtS: 0.001
  });
  assert.equal(result.ready, true);
  assert.equal(result.status, 'schroeder-spatial-thermal-proposal-prepared');
  assert.equal(fixture.device.encoders.length, beforeEncoderCount);
  assert.equal(fixture.device.submissions.length, beforeSubmissionCount);
  assert.equal(result.traversalCount, 2);
  assert.equal(result.traversalCountPerConsumer, 2);
  assert.equal(result.sharedTraversalConsumerCount, 2);
  assert.equal(result.consumerReceipt('thermal-conduction').consumerId,
    'thermal-conduction');
  assert.equal(result.consumerReceipt('thermal-radiation').consumerId,
    'thermal-radiation');
  assert.equal(
    isSchroederSpatialExactNearResidentConsumerBinding(
      result.consumerReceipt('thermal-conduction')
    ),
    true
  );
  assert.equal(
    isSchroederSpatialExactNearResidentConsumerBinding(
      result.consumerReceipt('thermal-radiation')
    ),
    true
  );
  assert.equal(result.thermalConductionProposalBuffer, result.proposalBuffer);
  assert.equal(result.thermalRadiationProposalBuffer, result.proposalBuffer);
  assert.equal(
    result.artifactDescriptors['thermal-conduction'].consumerReceiptBuffer,
    result.conductionEvidenceBuffer
  );
  assert.equal(result.artifactDescriptors['thermal-conduction'].owned, false);
  assert.equal(
    result.artifactDescriptors['thermal-radiation'].consumerReceiptBuffer,
    result.radiationEvidenceBuffer
  );
  assert.equal(result.proposalRowByteOffset, 64);
  assert.equal(result.activeProposalByteLength, 64 + 2 * 16);
  assert.deepEqual(result.canonicalApplyMode.invalidHeaderWordIndices, [6, 7]);
  assert.equal(result.canonicalApplyMode.publishedRowCountHeaderWord, 15);
  assert.equal(
    result.thermalProposalSourceAuthority.stateBuffer,
    fixture.sphParticleUpload.stateBuffer
  );
  assert.equal(
    result.thermalProposalSourceAuthority.mechanicsBuffer,
    fixture.mlsMpmParticleUpload.mechanicsBuffer
  );
  assert.equal(
    result.thermalProposalSourceAuthority.positionAuthority,
    'immutable-pre-integration-x-n'
  );
  assert.equal(result.canonicalApplyMode.replacesLegacyNeighborBinding, 10);
  assert.equal(result.privateBuildCount, 0);
  assert.equal(result.fixedCandidateBuildCount, 0);
  assert.equal(result.exhaustiveTraversalCount, 0);
  assert.equal(result.candidateBudget, null);
  assert.equal(result.hierarchyTraversalCount, 2);
  assert.equal(result.preferredHierarchyTraversalCount, 1);
  assert.equal(
    result.reciprocalTraversalMode,
    'fixed-source-row-thermal-candidate-replay-or-authenticated-exact-near-rewalk'
  );
  assert.equal(result.maximumHierarchyTraversalCount, 2);
  assert.equal(
    result.thermalCandidateCsrFallbackMode,
    'authenticated-exact-near-directory-rewalk-on-unsealed-row-receipt'
  );
  assert.equal(
    result.thermalCandidateCsr?.schema,
    ULG_SCHROEDER_SPATIAL_THERMAL_CANDIDATE_CSR_SCHEMA
  );
  assert.ok(result.thermalCandidateCsr?.candidateCapacity >= result.particleCount);
  assert.equal(result.fullParticleReadbackPerformed, false);
  assert.equal(result.derivedHeaderWords, 9);
  assert.equal(result.activeDerivedByteLength, (9 + 2 * 8 + 2) * 4);
  assert.equal(result.activeDispatchBuffer.size, 12);
  assert.equal(result.activeDispatchBuffer.usage, 396);
  assert.equal(
    result.activeSourceProjectionMode,
    SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL
  );
  assert.equal(result.bufferOwnership, 'device-arena-runtime-cache');
  assert.equal(result.ownsProposalBuffer, false);
  assert.ok(fixture.device.buffers.length > beforeBufferCount);

  const currentStateBuffer = tagWebGpuBufferDevice(fixture.device.createBuffer({
    label: 'thermal-current-post-mechanics-state',
    size: fixture.sphParticleState.particleCount * 2 * 16,
    usage: 128
  }), fixture.device);
  const materializeArgs = {
    device: fixture.device,
    currentStateBuffer,
    currentThermoBuffer: fixture.sphParticleUpload.thermoBuffer,
    thermalResponseGraphUpload: fixture.thermalResponseGraphUpload,
    ...result.preparedLawConfig
  };
  assert.throws(
    () => createSchroederSpatialMatchedTimeThermalProposalEncoderStage({
      ...materializeArgs,
      schroederSpatialThermalProposal: { ...result }
    }),
    /exact runtime-issued proposal artifact/
  );
  for (const [field, value] of [
    ['dtS', result.preparedLawConfig.dtS + 0.25],
    ['smoothingLengthM', result.preparedLawConfig.smoothingLengthM + 0.25],
    ['conductionRate', result.preparedLawConfig.conductionRate + 1]
  ]) {
    assert.throws(
      () => createSchroederSpatialMatchedTimeThermalProposalEncoderStage({
        ...materializeArgs,
        [field]: value,
        schroederSpatialThermalProposal: result
      }),
      new RegExp(`${field} does not match`)
    );
  }
  const timestampBegun = [];
  const timestampEnded = [];
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(_encoder, descriptor) {
      timestampBegun.push(descriptor);
      return descriptor;
    },
    endEncoderSpan(_encoder, token) {
      timestampEnded.push(token);
    }
  };
  const producerStage =
    createSchroederSpatialMatchedTimeThermalProposalEncoderStage({
      ...materializeArgs,
      schroederSpatialThermalProposal: result,
      gpuTimestampRecorder
    });
  assert.equal(result.matchedTimeStateBuffer, currentStateBuffer);
  assert.equal(result.matchedTimeProducerEncoded, false);
  const encoder = fixture.device.createCommandEncoder({
    label: 'thermal-producer-apply-owner'
  });
  producerStage.encode(encoder);
  fixture.device.queue.submit([encoder.finish()]);
  assert.equal(producerStage.markSubmittedWork(), true);
  assert.equal(result.matchedTimeProducerSubmissionObserved, true);
  const thermalEncoder = fixture.device.encoders.at(-1);
  assert.deepEqual(thermalEncoder.passes.map((pass) => pass.descriptor.label), [
    'ulg-schroeder-spatial-thermal-derived-prepass',
    'ulg-schroeder-spatial-thermal-active-dispatch-finalize',
    'ulg-schroeder-spatial-thermal-directional-budget',
    'ulg-schroeder-spatial-thermal-csr-validate-rows',
    'ulg-schroeder-spatial-thermal-csr-seal',
    'ulg-schroeder-spatial-thermal-budget-resolve',
    'ulg-schroeder-spatial-thermal-reciprocal-limited-proposal'
  ]);
  assert.deepEqual(
    thermalEncoder.passes[0].bindGroup.bindGroup.entries.map(({ binding }) => binding),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  );
  assert.deepEqual(thermalEncoder.passes[0].commands[0], { dispatch: [1, 1, 1] });
  assert.deepEqual(thermalEncoder.passes[2].commands[0], { dispatch: [1, 1, 1] });
  assert.deepEqual(thermalEncoder.passes.at(-1).commands[0], { dispatch: [1, 1, 1] });
  assert.deepEqual(thermalEncoder.copies, []);
  assert.equal(
    thermalEncoder.passes[0].bindGroup.bindGroup.entries[9].resource.buffer,
    fixture.generation.execution.directoryBuffer
  );
  assert.deepEqual(
    timestampBegun.map(({ producerId, stage, spanClass, generationId }) => ({
      producerId,
      stage,
      spanClass,
      generationId
    })),
    [
      'derived-prepass',
      'active-dispatch-finalize',
      'directional-budget',
      'candidate-csr-validate-rows',
      'candidate-csr-seal',
      'budget-resolve',
      'reciprocal-limited-proposal'
    ].map((stage) => ({
      producerId: `schroeder-spatial-thermal:${stage}`,
      stage,
      spanClass: 'same-production-command-encoder',
      generationId: fixture.generation.execution.generationId
    }))
  );
  assert.deepEqual(timestampEnded, timestampBegun);
  const proposalHeaderWrite = fixture.device.writes.find(
    ({ buffer, offset }) => buffer === result.proposalBuffer && offset === 0
  );
  const header = new Uint32Array(
    proposalHeaderWrite.bytes.buffer,
    proposalHeaderWrite.bytes.byteOffset,
    SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS
  );
  assert.equal(header[0], SCHROEDER_SPATIAL_THERMAL_PROPOSAL_MAGIC);
  assert.equal(header[1], SCHROEDER_SPATIAL_THERMAL_PROPOSAL_VERSION);
  assert.equal(header[2], fixture.generation.execution.generationId);
  assert.equal(header[6], 0);
  assert.equal(header[7], 0);

  assert.throws(
    () => createSchroederSpatialMatchedTimeThermalProposalEncoderStage({
      device: fixture.device,
      schroederSpatialThermalProposal: result,
      currentStateBuffer,
      currentThermoBuffer: fixture.sphParticleUpload.thermoBuffer,
      ...result.preparedLawConfig
    }),
    /single-use/
  );

  assert.throws(
    () => runSchroederSpatialThermalProposalWebGpu({ ...fixture, dtS: 0.001 }),
    /still leased/
  );
  assert.equal(result.releaseAfterCanonicalApplySubmittedWork(), true);
  await fixture.device.queue.onSubmittedWorkDone();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(result.terminalDisposition, 'submitted-released');
  assert.equal(result.lifecycleStatus, 'released');
  const bufferCountAfterWarmup = fixture.device.buffers.length;
  const reused = runSchroederSpatialThermalProposalWebGpu({
    ...fixture,
    dtS: 0.001
  });
  assert.equal(reused.runtimeCacheHit, true);
  assert.equal(fixture.device.buffers.length, bufferCountAfterWarmup);
  assert.equal(reused.abandonPreparedWork('unit-prepared-abandonment'), true);
  await fixture.device.queue.onSubmittedWorkDone();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reused.terminalDisposition, 'prepared-abandoned');
  assert.equal(reused.terminalReason, 'unit-prepared-abandonment');

  const encodeFailure = runSchroederSpatialThermalProposalWebGpu({
    ...fixture,
    dtS: 0.001
  });
  const encodeFailureStage =
    createSchroederSpatialMatchedTimeThermalProposalEncoderStage({
      ...materializeArgs,
      ...encodeFailure.preparedLawConfig,
      schroederSpatialThermalProposal: encodeFailure
    });
  assert.throws(
    () => encodeFailureStage.encode({
      clearBuffer() {},
      copyBufferToBuffer() {},
      beginComputePass() {
        throw new Error('injected matched-time encode failure');
      }
    }),
    /injected matched-time encode failure/
  );
  assert.equal(
    encodeFailure.abandonPreparedWork('unit-encode-failure'),
    true
  );
  await fixture.device.queue.onSubmittedWorkDone();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(encodeFailure.terminalDisposition, 'encode-failed-quarantined');
  assert.equal(encodeFailure.abandonPreparedWork('duplicate'), false);

  const afterFailure = runSchroederSpatialThermalProposalWebGpu({
    ...fixture,
    dtS: 0.001
  });
  assert.equal(afterFailure.runtimeCacheHit, true);
  assert.equal(fixture.device.buffers.length, bufferCountAfterWarmup);
  assert.equal(afterFailure.abandonPreparedWork('final-cleanup'), true);
  await fixture.device.queue.onSubmittedWorkDone();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(destroySchroederSpatialThermalProposalRuntime(fixture.device), true);
  assert.ok(result.proposalBuffer.destroyCount >= 1);
});

test('classic thermal v2 stage rejects unauthenticated bins and reuses its exhaustive reference arena', () => {
  const fixture = liveFixture();
  const binsBuffer = tagWebGpuBufferDevice(fixture.device.createBuffer({
    label: 'classic-thermal-refreshed-bins',
    size: 5 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), fixture.device);
  const args = {
    device: fixture.device,
    sphParticleState: fixture.sphParticleState,
    stateBuffer: fixture.sphParticleUpload.stateBuffer,
    thermoBuffer: fixture.sphParticleUpload.thermoBuffer,
    thermalResponseGraphUpload: fixture.thermalResponseGraphUpload,
    neighborBins: {
      binsBuffer,
      capacity: 4,
      nx: 1,
      ny: 1,
      nz: 1,
      cellSizeM: 0.5,
      refreshedAfterSeparation: true,
      positionAuthority: 'post-separation-in-place-state'
    },
    dtS: 0.001
  };
  const submissionCountBeforeStage = fixture.device.submissions.length;
  const first = createClassicThermalProposalWebGpuEncoderStage(args);
  const encoder = fixture.device.createCommandEncoder({
    label: 'classic-thermal-v2-combined-submission'
  });
  first.encode(encoder);
  encoder.finish();
  assert.equal(fixture.device.submissions.length, submissionCountBeforeStage);
  assert.equal(first.normalLookupBinned, false);
  assert.equal(first.lookupMode,
    'immutable-source-deterministic-exhaustive');
  assert.equal(first.proposalDispatchCount, 4);
  assert.equal(first.producerApplySubmissionPolicy,
    'caller-single-command-buffer');
  assert.equal(first.binnedTraversalCount, 0);
  assert.equal(first.exhaustiveTraversalConfiguredCount, 2);
  assert.equal(first.exhaustiveTraversalPotentialCount, 0);
  assert.equal(first.residentOverflowFallbackCapable, false);
  assert.equal(
    first.neighborBinsFallbackReason,
    'post-separation-bin-authority-unproven'
  );
  assert.equal(first.fallbackEvidenceWord, 15);
  assert.equal(first.schroederSpatialBuildCount, 0);
  assert.deepEqual(fixture.device.encoders.at(-1).passes.map(
    (pass) => pass.descriptor.label
  ), [
    'ulg-classic-thermal-v2-derived-prepass',
    'ulg-classic-thermal-v2-directional-budget',
    'ulg-classic-thermal-v2-budget-resolve',
    'ulg-classic-thermal-v2-reciprocal-limited-proposal'
  ]);
  assert.deepEqual(
    fixture.device.encoders.at(-1).passes[0].bindGroup.bindGroup.entries
      .map(({ binding }) => binding),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  );
  assert.ok(fixture.device.encoders.at(-1).passes.every(
    (pass) => pass.commands.every((command) => 'dispatch' in command)
  ));
  assert.equal(first.cleanupSubmittedWork(), true);
  const warmBufferCount = fixture.device.buffers.length;
  const second = createClassicThermalProposalWebGpuEncoderStage(args);
  assert.equal(second.runtimeCacheHit, true);
  assert.equal(fixture.device.buffers.length, warmBufferCount);
  assert.equal(second.cleanupSubmittedWork(), true);
  assert.equal(destroyClassicThermalProposalRuntime(fixture.device), true);
  assert.ok(first.proposalBuffer.destroyCount >= 1);
});

test('classic thermal v2 consumes only a runtime-issued post-separation bin authority', async () => {
  const fixture = liveFixture();
  const binsBuffer = tagWebGpuBufferDevice(fixture.device.createBuffer({
    label: 'classic-thermal-authenticated-post-separation-bins',
    size: 5 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), fixture.device);
  const authority = issuePostSeparationThermalBinAuthority({
    device: fixture.device,
    stateBuffer: fixture.sphParticleUpload.stateBuffer,
    binsBuffer,
    particleCount: fixture.sphParticleState.particleCount,
    capacity: 4,
    nx: 1,
    ny: 1,
    nz: 1,
    cellSizeM: 0.5,
    producerSubmission: { commandBuffer: {} }
  });
  const stage = createClassicThermalProposalWebGpuEncoderStage({
    device: fixture.device,
    sphParticleState: fixture.sphParticleState,
    stateBuffer: fixture.sphParticleUpload.stateBuffer,
    thermoBuffer: fixture.sphParticleUpload.thermoBuffer,
    thermalResponseGraphUpload: fixture.thermalResponseGraphUpload,
    neighborBins: authority,
    dtS: 0.001
  });
  assert.equal(stage.normalLookupBinned, true);
  assert.equal(
    stage.lookupMode,
    'authenticated-post-separation-binned-with-resident-overflow-fallback'
  );
  assert.equal(stage.binnedTraversalCount, 2);
  assert.equal(stage.proposalDispatchCount, 5);
  assert.equal(stage.fixedCandidateBuildCount, 1);
  assert.equal(stage.exhaustiveTraversalConfiguredCount, 0);
  assert.equal(stage.exhaustiveTraversalPotentialCount, 2);
  assert.equal(stage.residentOverflowFallbackCapable, true);
  assert.equal(stage.neighborBinsFallbackReason, null);
  assert.equal(
    stage.neighborBinsPositionAuthority,
    'post-separation-g2p-output-state'
  );
  assert.doesNotMatch(
    classicThermalBinnedProposalWgsl,
    /ss_exact_near_lower_bound_cell_key/
  );
  assert.match(
    classicThermalCandidateProposalWgsl,
    /other_index = spatial_directory\[[\s\S]*?thermal_visit_fused_pair\(/
  );
  const encoder = fixture.device.createCommandEncoder();
  stage.encode(encoder);
  encoder.finish();
  assert.deepEqual(fixture.device.encoders.at(-1).passes.map(
    (pass) => pass.descriptor.label
  ), [
    'ulg-classic-thermal-v2-derived-prepass',
    'ulg-classic-thermal-v2-candidate-build',
    'ulg-classic-thermal-v2-directional-budget',
    'ulg-classic-thermal-v2-budget-resolve',
    'ulg-classic-thermal-v2-reciprocal-limited-proposal'
  ]);
  assert.equal(stage.cleanupSubmittedWork(), true);
  assert.equal(
    releasePostSeparationThermalBinAuthorityAfterQueue(authority, {
      device: fixture.device,
      completionFence: Promise.resolve()
    }),
    true
  );
  await postSeparationThermalBinAuthorityLiveness(authority).releasePromise;
  assert.equal(
    postSeparationThermalBinAuthorityLiveness(authority).destroyCount,
    1
  );
  assert.equal(destroyClassicThermalProposalRuntime(fixture.device), true);
});

test('thermal proposal authority rejects stale generations and foreign closure buffers', () => {
  const swapped = liveFixture();
  const swappedStateBuffer = tagWebGpuBufferDevice(swapped.device.createBuffer({
    label: 'same-device-swapped-thermal-state',
    size: swapped.sphParticleState.particleCount * 2 * 16,
    usage: 128
  }), swapped.device);
  assert.throws(() => runSchroederSpatialThermalProposalWebGpu({
    ...swapped,
    sphParticleUpload: {
      ...swapped.sphParticleUpload,
      stateBuffer: swappedStateBuffer
    }
  }), /transaction-owned immutable x_n family/);

  const stale = liveFixture();
  const staleGeneration = {
    ...stale.generation,
    execution: {
      ...stale.generation.execution,
      positionEpoch: stale.generation.execution.positionEpoch + 1
    }
  };
  assert.throws(() => runSchroederSpatialThermalProposalWebGpu({
    ...stale,
    generation: staleGeneration
  }), /transaction-owned immutable x_n family|not authenticated|generation/i);

  const foreign = liveFixture();
  const foreignDevice = createFakeDevice();
  const foreignBuffer = tagWebGpuBufferDevice(foreignDevice.createBuffer({
    label: 'foreign-thermal-response',
    size: 64,
    usage: 128
  }), foreignDevice);
  assert.throws(() => runSchroederSpatialThermalProposalWebGpu({
    ...foreign,
    thermalResponseGraphUpload: {
      ...foreign.thermalResponseGraphUpload,
      responseBuffer: foreignBuffer
    }
  }), /canonical generation device/);
  assert.equal(destroySchroederSpatialThermalProposalRuntime(foreign.device), false);
});
