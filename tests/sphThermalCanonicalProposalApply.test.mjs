import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1
} from '../ulg-gpu-abi/src/index.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import {
  runSchroederSpatialThermalProposalWebGpu
} from '../src/runtime/sph/schroederSpatialThermalProposalsGpu.js';
import {
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
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
  const proposal = runSchroederSpatialThermalProposalWebGpu({
    device,
    generation,
    sphParticleState,
    sphParticleUpload,
    thermalResponseGraphUpload,
    dtS: 0.001
  });
  return {
    device,
    generation,
    proposal,
    sphParticleState,
    sphParticleUpload,
    thermalMaterialTable,
    thermalClosureGraphSet,
    thermalPhaseResponseTable,
    thermalResponseGraphUpload
  };
}

test('thermal apply WGSL validates the complete canonical header before pair rows', () => {
  assert.match(sphThermalStepWgsl, /canonical_proposal_enabled: u32/);
  assert.match(sphThermalStepWgsl, /THERMAL_PROPOSAL_MAGIC: u32 = 0x54504831u/);
  assert.match(sphThermalStepWgsl, /thermal_bins\[6u\] == 0u/);
  assert.match(sphThermalStepWgsl, /thermal_bins\[7u\] == 0u/);
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
  assert.match(
    sphThermalStepWgsl,
    /proposed_conduction_du \+ proposed_radiation_du[\s\S]*clamp_du_to_temperature_range\([\s\S]*conduction_du/
  );
  assert.match(
    sphThermalStepWgsl,
    /clamp_du_to_temperature_range\([\s\S]*for \(var face = 0u; face < 6u;[\s\S]*ambient_temperature_k/
  );
});

test('thermal WebGPU consumes one authenticated canonical proposal without legacy lookup', () => {
  const fixture = liveCanonicalThermalFixture();
  const borrowedLegacyBins = taggedBuffer(
    fixture.device,
    'legacy-bins-must-not-bind',
    1024
  );
  const stage = createSphThermalStepWebGpuEncoderStage({
    ...fixture,
    schroederSpatialEpochGeneration: fixture.generation,
    schroederSpatialThermalProposal: fixture.proposal,
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
  const otherDevice = createFakeDevice();
  assert.throws(
    () => createStage({ device: otherDevice }),
    /consumer device does not own|not a complete same-device|not authenticated/
  );
});
