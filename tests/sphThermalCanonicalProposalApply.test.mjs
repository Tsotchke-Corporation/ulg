import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1
} from '../ulg-gpu-abi/src/index.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import {
  SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL,
  runSchroederSpatialThermalProposalWebGpu,
  schroederSpatialThermalDerivedPrepassWgsl
} from '../src/runtime/sph/schroederSpatialThermalProposalsGpu.js';
import {
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  createSchroederSpatialEpochTransaction
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import {
  buildSphGpuParticleBuffers
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import { createSphState } from '../src/runtime/sph/sphState.js';
import {
  buildSphThermalClosureGraphBuffers,
  buildSphThermalMaterialTable,
  buildSphThermalPhaseResponseTable,
  createSphThermalStepWebGpuEncoderStage,
  SPH_THERMAL_CANONICAL_PROPOSAL_ROW_WORDS,
  SPH_THERMAL_CANONICAL_PROPOSAL_VERSION,
  sphThermalStepWgsl,
  uploadSphThermalResponseGraphBuffers
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
    bindGroups: [],
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
    createBindGroup(descriptor) {
      device.bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder(descriptor) { return createFakeEncoder(device, descriptor); }
  };
  return device;
}

function createActiveNodeList(device, particleCount) {
  const activeNodeBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'thermal-apply-active-node-source',
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
    spatialEpochPhysicsSubstep: 2,
    spatialEpochPositionEpoch: 17,
    spatialEpochTopologyEpoch: 19,
    spatialEpochChartEpoch: 23,
    spatialEpochLevelEpoch: 29,
    spatialEpochSupportEpoch: 31,
    phaseVolumeAssignmentOverlayEnabled: false
  };
}

function taggedBuffer(device, label, size) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage: 128 }), device);
}

function liveCanonicalThermalFixture() {
  const closures = createReferenceMaterialClosures();
  const materialProperties = { h2o: closures.h2o.properties };
  const sphParticleState = buildSphGpuParticleBuffers(createSphState({
    smoothingLengthM: 0.1,
    dimension: 3,
    particles: [
      {
        id: 'hot',
        material: 'h2o',
        x: [2, 2, 2],
        v: [0, 0, 0],
        massKg: 1,
        specificInternalEnergyJPerKg:
          specificInternalEnergyJPerKg(materialProperties.h2o, 330)
      },
      {
        id: 'cold',
        material: 'h2o',
        x: [2.08, 2, 2],
        v: [0, 0, 0],
        massKg: 1,
        specificInternalEnergyJPerKg:
          specificInternalEnergyJPerKg(materialProperties.h2o, 250)
      }
    ]
  }), { materialProperties });
  const particleCount = sphParticleState.particleCount;
  const device = createFakeDevice();
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList: createActiveNodeList(device, particleCount),
    particleCount
  });
  assert.equal(generation.selected, true);
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const thermalClosureGraphSet = buildSphThermalClosureGraphBuffers(thermalMaterialTable);
  const thermalPhaseResponseTable = buildSphThermalPhaseResponseTable(
    thermalMaterialTable,
    thermalClosureGraphSet
  );
  const thermalResponseGraphUpload = uploadSphThermalResponseGraphBuffers(device, {
    thermalMaterialTable,
    thermalClosureGraphSet,
    thermalClosureGraphBank: thermalClosureGraphSet.graphBank,
    thermalPhaseResponseTable
  });
  const sphParticleUpload = {
    stateBuffer: taggedBuffer(
      device,
      'canonical-thermal-source-state',
      sphParticleState.state.byteLength
    ),
    thermoBuffer: taggedBuffer(
      device,
      'canonical-thermal-source-thermo',
      sphParticleState.thermo.byteLength
    )
  };
  const mlsMpmParticleUpload = {
    mechanicsBuffer: taggedBuffer(
      device,
      'canonical-thermal-source-mechanics',
      particleCount * 24 * Float32Array.BYTES_PER_ELEMENT
    )
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
  const proposal = runSchroederSpatialThermalProposalWebGpu({
    device,
    generation,
    schroederSpatialEpochTransaction,
    sphParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    thermalResponseGraphUpload,
    dtS: 0.001
  });
  return {
    device,
    generation,
    proposal,
    dtS: 0.001,
    sphParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederSpatialEpochTransaction,
    proposalStateBuffer: sphParticleUpload.stateBuffer,
    proposalThermoBuffer: sphParticleUpload.thermoBuffer,
    thermalMaterialTable,
    thermalClosureGraphSet,
    thermalPhaseResponseTable,
    thermalResponseGraphUpload
  };
}

test('thermal apply WGSL validates the complete canonical header before pair rows', () => {
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /fn thermal_prepass_reachable_energy_domain\(/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /row1\.x != previous_energy_hi[\s\S]*first\.y != previous_temperature_hi/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /var energy_lo = max\(reachable_domain\.energy_lo, lower_inverse\.energy\)/);
  assert.match(schroederSpatialThermalDerivedPrepassWgsl,
    /var energy_hi = min\(reachable_domain\.energy_hi, upper_inverse\.energy\)/);
  assert.doesNotMatch(schroederSpatialThermalDerivedPrepassWgsl,
    /max\(selection\.energy_lo, lower_inverse\.energy\)/);
  assert.match(sphThermalStepWgsl, /canonical_proposal_enabled: u32/);
  assert.match(sphThermalStepWgsl, /fn thermal_carrier_phase_classification\(/);
  assert.match(sphThermalStepWgsl,
    /phase_from == classification\.x[\s\S]*phase_to == classification\.x/);
  assert.match(sphThermalStepWgsl,
    /classification\.y == 1u && abs\(row0\.y - 2\.0\) < 0\.5/);
  assert.match(sphThermalStepWgsl,
    /thermal_temperature_slope\(row0\.x, vel_u\.w, row0\.y, row1\)/);
  assert.match(sphThermalStepWgsl,
    /let other_row1 = thermo_row1\(other\)[\s\S]*other_row0\.y,[\s\S]*other_row1/);
  assert.match(sphThermalStepWgsl, /THERMAL_PROPOSAL_MAGIC: u32 = 0x54504831u/);
  assert.equal(SPH_THERMAL_CANONICAL_PROPOSAL_VERSION, 2);
  assert.equal(SPH_THERMAL_CANONICAL_PROPOSAL_ROW_WORDS, 4);
  assert.match(sphThermalStepWgsl, /THERMAL_PROPOSAL_VERSION: u32 = 2u/);
  assert.match(sphThermalStepWgsl, /thermal_bins\[6u\] == 0u/);
  assert.match(sphThermalStepWgsl, /thermal_bins\[7u\] == 0u/);
  assert.match(
    sphThermalStepWgsl,
    /thermal_bins\[15u\] == params\.particle_count/
  );
  for (const word of [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15]) {
    assert.match(sphThermalStepWgsl, new RegExp(`thermal_bins\\[${word}u\\]`));
  }
  assert.match(sphThermalStepWgsl, new RegExp(
    `THERMAL_CONDUCTION_SUPPORT_PROFILE_ID: u32 = 0x${
      SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1.toString(16).padStart(8, '0')
    }u`
  ));
  assert.match(sphThermalStepWgsl, new RegExp(
    `THERMAL_RADIATION_SUPPORT_PROFILE_ID: u32 = 0x${
      SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1.toString(16).padStart(8, '0')
    }u`
  ));
  assert.match(sphThermalStepWgsl, /let proposed_u_lo = bitcast<f32>/);
  assert.match(sphThermalStepWgsl, /let proposed_u_hi = bitcast<f32>/);
  assert.match(
    sphThermalStepWgsl,
    /proposed_next_u >= proposed_u_lo[\s\S]*proposed_next_u <= proposed_u_hi/
  );
  assert.match(
    sphThermalStepWgsl,
    /if \(params\.canonical_proposal_enabled == 1u\) \{[\s\S]*du = du \+ conduction_du;[\s\S]*\} else \{[\s\S]*clamp_du_to_temperature_range/
  );
  assert.match(sphThermalStepWgsl, /fn thermal_carrier_energy_domain\(/);
  assert.match(sphThermalStepWgsl,
    /fn canonical_thermal_reachable_energy_domain\(/);
  assert.match(sphThermalStepWgsl,
    /response1\.x != previous_energy_hi[\s\S]*first\.y != previous_temperature_hi/);
  assert.match(sphThermalStepWgsl,
    /proposed_u_lo >= canonical_reachable_domain\.x[\s\S]*proposed_u_hi <= canonical_reachable_domain\.y/);
  assert.match(sphThermalStepWgsl,
    /canonical_thermal_open_reservoir_delta\([\s\S]*equilibrium_limited_du,[\s\S]*vel_u\.w,[\s\S]*current_u,[\s\S]*carrier_domain\.x,[\s\S]*carrier_domain\.y/);
  assert.match(sphThermalStepWgsl,
    /if \(params\.canonical_proposal_enabled == 1u\) \{[\s\S]*canonical_reachable_domain_ready[\s\S]*canonical_reachable_domain\.x,[\s\S]*canonical_reachable_domain\.y/);
  assert.match(sphThermalStepWgsl, /fn clamp_du_to_energy_domain\(/);
  assert.match(
    sphThermalStepWgsl,
    /carrier_u_lo = carrier_domain\.x;[\s\S]*for \(var face = 0u; face < 6u;[\s\S]*clamp_du_to_energy_domain/
  );
  assert.match(
    sphThermalStepWgsl,
    /let candidate_next_u = vel_u\.w \+ du;[\s\S]*thermal_value_finite\(candidate_next_u\)[\s\S]*carrier_u_lo,[\s\S]*carrier_u_hi/
  );
});

test('thermal WebGPU consumes one authenticated canonical proposal without legacy lookup', () => {
  const fixture = liveCanonicalThermalFixture();
  assert.equal(
    fixture.proposal.authorizeQueueOrderedCanonicalApplyRetirement({
      generation: fixture.generation,
      execution: fixture.generation.execution
    }),
    true
  );
  const postMechanicsStateBuffer = taggedBuffer(
    fixture.device,
    'canonical-thermal-post-mechanics-apply-state',
    fixture.sphParticleState.state.byteLength
  );
  const postMechanicsThermoBuffer = taggedBuffer(
    fixture.device,
    'canonical-thermal-post-mechanics-apply-thermo',
    fixture.sphParticleState.thermo.byteLength
  );
  const borrowedLegacyBins = taggedBuffer(
    fixture.device,
    'legacy-bins-must-not-bind',
    1024
  );
  const stage = createSphThermalStepWebGpuEncoderStage({
    ...fixture,
    schroederSpatialEpochGeneration: fixture.generation,
    schroederSpatialThermalProposal: fixture.proposal,
    proposalStateBuffer: postMechanicsStateBuffer,
    proposalThermoBuffer: postMechanicsThermoBuffer,
    sourceStateBuffer: postMechanicsStateBuffer,
    sourceThermoBuffer: postMechanicsThermoBuffer,
    neighborBins: {
      binsBuffer: borrowedLegacyBins,
      capacity: 16,
      nx: 4,
      ny: 4,
      nz: 4,
      cellSizeM: 0.2
    },
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback'
  });

  const paramsWrite = fixture.device.writes.findLast(
    ({ buffer }) => buffer.label === 'ulg-sph-thermal-params'
  );
  const params = new DataView(
    paramsWrite.bytes.buffer,
    paramsWrite.bytes.byteOffset,
    paramsWrite.bytes.byteLength
  );
  assert.equal(paramsWrite.bytes.byteLength, 144);
  assert.equal(params.getUint32(72, true), 0);
  assert.equal(params.getUint32(76, true), 0);
  assert.equal(params.getUint32(80, true), 0);
  assert.equal(params.getUint32(84, true), 0);
  assert.equal(params.getUint32(88, true), 0);
  assert.equal(params.getFloat32(92, true), 0);
  assert.equal(params.getUint32(104, true), 1);
  assert.equal(params.getUint32(108, true), fixture.generation.execution.generationId);
  assert.equal(params.getUint32(112, true), fixture.generation.execution.supportEpoch);
  assert.equal(params.getUint32(116, true), fixture.generation.execution.positionEpoch);
  assert.equal(params.getUint32(120, true), fixture.generation.execution.topologyEpoch);
  assert.equal(params.getUint32(124, true), fixture.generation.execution.storageGeneration);
  assert.equal(params.getUint32(128, true), fixture.generation.execution.physicsTick);
  assert.equal(params.getUint32(132, true), fixture.generation.execution.physicsSubstep);

  const thermalBindGroup = fixture.device.bindGroups.at(-1);
  assert.equal(
    thermalBindGroup.entries.find(({ binding }) => binding === 0).resource.buffer,
    postMechanicsStateBuffer
  );
  assert.equal(
    thermalBindGroup.entries.find(({ binding }) => binding === 1).resource.buffer,
    postMechanicsThermoBuffer
  );
  assert.equal(
    fixture.proposal.thermalProposalSourceAuthority.stateBuffer,
    fixture.sphParticleUpload.stateBuffer
  );
  assert.equal(
    fixture.proposal.thermalProposalSourceAuthority.thermoBuffer,
    fixture.sphParticleUpload.thermoBuffer
  );
  assert.equal(
    thermalBindGroup.entries.find(({ binding }) => binding === 10).resource.buffer,
    fixture.proposal.proposalBuffer
  );
  assert.notEqual(
    thermalBindGroup.entries.find(({ binding }) => binding === 10).resource.buffer,
    borrowedLegacyBins
  );
  assert.equal(
    stage.result.neighborLookupMode,
    'canonical-schroeder-spatial-thermal-proposals'
  );
  assert.equal(stage.result.canonicalSpatialThermalProposal, true);
  assert.equal(
    stage.result.canonicalSpatialThermalGenerationId,
    fixture.generation.execution.generationId
  );
  assert.equal(stage.result.legacyPrivateSpatialBuildCount, 0);
  assert.equal(stage.result.legacyFixedCandidateBuildCount, 0);
  assert.equal(stage.result.legacyExhaustiveTraversalCount, 0);
  assert.equal(
    stage.result.canonicalSpatialThermalConsumerReceipts['thermal-conduction'],
    fixture.proposal.consumerReceipt('thermal-conduction')
  );
  assert.equal(
    stage.result.canonicalSpatialThermalConsumerReceipts['thermal-radiation'],
    fixture.proposal.consumerReceipt('thermal-radiation')
  );
  assert.equal(
    fixture.proposal.activeSourceProjectionMode,
    SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL,
    'the active-node fixture intentionally exercises the local active-rank fallback'
  );
  assert.ok(
    fixture.proposal.thermalCandidateCsr,
    'the canonical fixture must retain the bounded thermal candidate CSR receipt'
  );
  assert.equal(
    stage.result.canonicalThermalProposal.producerStage.thermalCandidateCsrEnabled,
    true
  );
  assert.equal(
    stage.result.canonicalThermalProposal.producerStage.proposalDispatchCount,
    8
  );
  const encoder = fixture.device.createCommandEncoder({
    label: 'canonical-matched-time-producer-and-apply'
  });
  stage.encode(encoder);
  assert.equal(
    Object.hasOwn(stage.result, 'queueOrderedCleanupClaim'),
    false,
    'the retained-output claim cannot exist before primary submission'
  );
  fixture.device.queue.submit([encoder.finish()]);
  assert.equal(stage.markSubmittedWork(), true);
  assert.equal(
    Object.hasOwn(stage.result, 'queueOrderedCleanupClaim'),
    true
  );
  assert.equal(
    Object.keys(stage.result).includes('queueOrderedCleanupClaim'),
    false
  );
  assert.deepEqual(
    fixture.device.encoders.at(-1).passes.map((pass) => pass.descriptor.label),
    [
      'ulg-schroeder-spatial-thermal-derived-prepass',
      'ulg-schroeder-spatial-thermal-conductivity-finalize',
      'ulg-schroeder-spatial-thermal-active-dispatch-finalize',
      'ulg-schroeder-spatial-thermal-directional-budget',
      'ulg-schroeder-spatial-thermal-csr-validate-rows',
      'ulg-schroeder-spatial-thermal-csr-seal',
      'ulg-schroeder-spatial-thermal-budget-resolve',
      'ulg-schroeder-spatial-thermal-reciprocal-limited-proposal',
      'ulg-sph-thermal-v2-canonical-proposal-apply'
    ]
  );
  assert.equal(
    stage.result.canonicalThermalProposal.matchedTimeStateBuffer,
    postMechanicsStateBuffer
  );
  assert.equal(
    fixture.proposal.matchedTimeProducerSubmissionObserved,
    true
  );

  stage.cleanupSubmittedWork();
  assert.equal(fixture.proposal.proposalBuffer.destroyCount, 0);
});

test('thermal WebGPU fails closed for incomplete, stale, cross-device, or undersized proposals', () => {
  const fixture = liveCanonicalThermalFixture();
  const createStage = (overrides = {}) => createSphThermalStepWebGpuEncoderStage({
    ...fixture,
    schroederSpatialEpochGeneration: fixture.generation,
    schroederSpatialThermalProposal: fixture.proposal,
    readbackMode: 'no-full-readback',
    ...overrides
  });

  assert.throws(
    () => createStage({ schroederSpatialThermalProposal: null }),
    /requires both the retained spatial generation and its proposal/
  );
  assert.throws(
    () => createStage({ schroederSpatialEpochGeneration: { ...fixture.generation } }),
    /not the live proposal issued for the retained generation/
  );
  const tinyProposalBuffer = taggedBuffer(fixture.device, 'tiny-thermal-proposal', 4);
  assert.throws(
    () => createStage({
      schroederSpatialThermalProposal: {
        ...fixture.proposal,
        proposalBuffer: tinyProposalBuffer,
        thermalConductionProposalBuffer: tinyProposalBuffer,
        thermalRadiationProposalBuffer: tinyProposalBuffer
      }
    }),
    /not a complete same-device particle row set/
  );
  assert.throws(
    () => createStage({
      proposalStateBuffer: taggedBuffer(
        fixture.device,
        'same-device-wrong-xn-state',
        fixture.sphParticleState.state.byteLength
      )
    }),
    /producer and apply must bind the exact same current state and thermo buffers/
  );
  const otherDevice = createFakeDevice();
  assert.throws(
    () => createStage({ device: otherDevice }),
    /source state and thermo buffers must belong|consumer device does not own|not a complete same-device|not authenticated/
  );
});
