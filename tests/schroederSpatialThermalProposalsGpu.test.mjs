import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_OFFSET_BYTES,
  SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_SENTINEL,
  SCHROEDER_SPATIAL_THERMAL_CONSUMER,
  SCHROEDER_SPATIAL_THERMAL_CONSUMERS,
  SCHROEDER_SPATIAL_THERMAL_EVIDENCE_LAYOUT,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_MAGIC,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_LAYOUT,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS,
  destroySchroederSpatialThermalProposalRuntime,
  evaluateSchroederSpatialThermalPairProposal,
  runSchroederSpatialThermalProposalWebGpu,
  schroederSpatialThermalDerivedPrepassWgsl,
  schroederSpatialThermalProposalWgsl
} from '../src/runtime/sph/schroederSpatialThermalProposalsGpu.js';
import {
  isFinalizedSchroederSpatialExactNearConsumerReceipt,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
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
  const event = { descriptor, clears: [], passes: [] };
  device.encoders.push(event);
  return {
    clearBuffer(buffer, offset = 0, size = null) {
      event.clears.push({ buffer, offset, size });
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
  return {
    device,
    generation,
    sphParticleState: {
      particleCount,
      smoothingLengthM: 0.125
    },
    sphParticleUpload: {
      stateBuffer: buffer('thermal-source-state', particleCount * 2 * 16),
      thermoBuffer: buffer('thermal-source-thermo', particleCount * 3 * 16)
    },
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
  assert.deepEqual(SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_LAYOUT, [
    'conductionSpecificEnergyDeltaJPerKg:f32',
    'radiationSpecificEnergyDeltaJPerKg:f32',
    'neighborMinTemperatureK:f32',
    'neighborMaxTemperatureK:f32'
  ]);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_LAYOUT[6],
    'conductionInvalidCount:atomic<u32>');
  assert.equal(SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_LAYOUT[7],
    'radiationInvalidCount:atomic<u32>');
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_OFFSET_BYTES, 104);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_SENTINEL, 1);
  assert.equal(SCHROEDER_SPATIAL_THERMAL_EVIDENCE_LAYOUT.length, 16);
});

test('thermal proposal WGSL preserves pair laws and has no private or exhaustive lookup', () => {
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /thermal_prepass_temperature_slope_from_graph/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /0\.238732414637843 \* mass_kg \/ rest_density_kg_per_m3/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /atomicMax\(&thermal_derived\[2u\], temperature_bits\)/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /atomicMax\(&thermal_derived\[3u\], ~temperature_bits\)/);
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
    /thermal_mark_invalid\(true\)[\s\S]*thermal_mark_invalid\(false\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /thermal_flush_evidence\(index: u32, count: u32, is_conduction: bool\)/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /global_max_temperature_bits == global_min_temperature_bits/);
  assert.match(schroederSpatialThermalProposalWgsl,
    /if \(self_pos_mass\.w <= 0\.0\)/);
  assert.doesNotMatch(schroederSpatialThermalProposalWgsl,
    /atomicAdd\(&traversal_evidence\[3u\], 1u\)/);
  assert.doesNotMatch(schroederSpatialThermalProposalWgsl,
    /atomicAdd\(&traversal_evidence\[4u\], 1u\)/);
  assert.doesNotMatch(schroederSpatialThermalProposalWgsl,
    /for\s*\(var other\s*=\s*0u;\s*other\s*<\s*thermal_params\.particle_count/);
  assert.doesNotMatch(schroederSpatialThermalProposalWgsl, /thermal_bins|bin_capacity/);
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

test('thermal proposal submission returns exact receipts, resident guard buffers, and cached ownership', async () => {
  const fixture = liveFixture();
  const beforeBufferCount = fixture.device.buffers.length;
  const result = runSchroederSpatialThermalProposalWebGpu({
    ...fixture,
    dtS: 0.001
  });
  assert.equal(result.ready, true);
  assert.equal(result.traversalCount, 1);
  assert.equal(result.traversalCountPerConsumer, 1);
  assert.equal(result.sharedTraversalConsumerCount, 2);
  assert.equal(result.consumerReceipt('thermal-conduction').consumerId,
    'thermal-conduction');
  assert.equal(result.consumerReceipt('thermal-radiation').consumerId,
    'thermal-radiation');
  assert.equal(
    isFinalizedSchroederSpatialExactNearConsumerReceipt(
      result.consumerReceipt('thermal-conduction')
    ),
    true
  );
  assert.equal(
    isFinalizedSchroederSpatialExactNearConsumerReceipt(
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
  assert.equal(result.canonicalApplyMode.replacesLegacyNeighborBinding, 10);
  assert.equal(result.privateBuildCount, 0);
  assert.equal(result.fixedCandidateBuildCount, 0);
  assert.equal(result.exhaustiveTraversalCount, 0);
  assert.equal(result.candidateBudget, null);
  assert.equal(result.fullParticleReadbackPerformed, false);
  assert.equal(result.bufferOwnership, 'device-arena-runtime-cache');
  assert.equal(result.ownsProposalBuffer, false);
  assert.ok(fixture.device.buffers.length > beforeBufferCount);

  const thermalEncoder = fixture.device.encoders.at(-1);
  assert.deepEqual(thermalEncoder.passes.map((pass) => pass.descriptor.label), [
    'ulg-schroeder-spatial-thermal-derived-prepass',
    'ulg-schroeder-spatial-thermal-fused-conduction-radiation-proposal'
  ]);
  const proposalHeaderWrite = fixture.device.writes.find(
    ({ buffer, offset }) => buffer === result.proposalBuffer && offset === 0
  );
  const header = new Uint32Array(
    proposalHeaderWrite.bytes.buffer,
    proposalHeaderWrite.bytes.byteOffset,
    SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS
  );
  assert.equal(header[0], SCHROEDER_SPATIAL_THERMAL_PROPOSAL_MAGIC);
  assert.equal(header[2], fixture.generation.execution.generationId);
  assert.equal(header[6], 0);
  assert.equal(header[7], 0);

  assert.throws(
    () => runSchroederSpatialThermalProposalWebGpu({ ...fixture, dtS: 0.001 }),
    /still leased/
  );
  assert.equal(result.releaseAfterCanonicalApplySubmittedWork(), true);
  await fixture.device.queue.onSubmittedWorkDone();
  await new Promise((resolve) => setImmediate(resolve));
  const bufferCountAfterWarmup = fixture.device.buffers.length;
  const reused = runSchroederSpatialThermalProposalWebGpu({
    ...fixture,
    dtS: 0.001
  });
  assert.equal(reused.runtimeCacheHit, true);
  assert.equal(fixture.device.buffers.length, bufferCountAfterWarmup);
  assert.equal(reused.releaseAfterCanonicalApplySubmittedWork(), true);
  await fixture.device.queue.onSubmittedWorkDone();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(destroySchroederSpatialThermalProposalRuntime(fixture.device), true);
  assert.ok(result.proposalBuffer.destroyCount >= 1);
});

test('thermal proposal authority rejects stale generations and foreign closure buffers', () => {
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
  }), /not authenticated|generation/i);

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
