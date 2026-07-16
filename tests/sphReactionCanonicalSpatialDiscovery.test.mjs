import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { sphReactionStepWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  GPU_PHASE_IDS,
  stableOpticalMaterialId
} from '../src/runtime/material/opticalGpuBuffers.js';
import {
  buildSphThermalMaterialTable
} from '../src/runtime/sph/sphThermalGpuKernel.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  buildSphReactionTable,
  runSphReactionStepWebGpu
} from '../src/runtime/sph/sphReactionGpuKernel.js';
import {
  destroySchroederSpatialReactionDiscoveryProposalCache,
  runSchroederSpatialReactionDiscoveryProposalWebGpu
} from '../src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js';
import {
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';

const materialProperties = {
  a: {
    molarMassKgPerMol: 0.01,
    phases: [{
      name: 'solid',
      temperatureRange: [0, 2000],
      cpJPerKgK: 1000,
      densityKgPerM3: 1000,
      bulkModulusPa: 1e6,
      shearModulusPa: 2e5
    }],
    transitions: []
  },
  b: {
    molarMassKgPerMol: 0.02,
    phases: [{
      name: 'liquid',
      temperatureRange: [0, 2000],
      cpJPerKgK: 1200,
      densityKgPerM3: 800,
      bulkModulusPa: 8e5,
      shearModulusPa: 0
    }],
    transitions: []
  },
  ab: {
    molarMassKgPerMol: 0.03,
    phases: [{
      name: 'liquid',
      temperatureRange: [0, 3000],
      cpJPerKgK: 1500,
      densityKgPerM3: 500,
      bulkModulusPa: 5e5,
      shearModulusPa: 0
    }],
    transitions: []
  }
};

function packedPair() {
  const state = new Float32Array(2 * SPH_GPU_PARTICLE_STATE_FLOATS);
  state.set([0, 0, 0, 2, 0, 0, 0, 100], 0);
  state.set([0.04, 0, 0, 4, 0, 0, 0, 200], SPH_GPU_PARTICLE_STATE_FLOATS);
  const thermo = new Float32Array(2 * SPH_GPU_PARTICLE_THERMO_FLOATS);
  thermo.set([
    stableOpticalMaterialId('a'),
    GPU_PHASE_IDS.solid,
    600,
    1000,
    1,
    0,
    0,
    0,
    0.1,
    1,
    1,
    0
  ], 0);
  thermo.set([
    stableOpticalMaterialId('b'),
    GPU_PHASE_IDS.liquid,
    600,
    800,
    0,
    1,
    0,
    0,
    0.1,
    1,
    1,
    0
  ], SPH_GPU_PARTICLE_THERMO_FLOATS);
  const mechanics = new Float32Array(2 * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS);
  for (let index = 0; index < 2; index += 1) {
    const offset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    mechanics.set([
      1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 1, 0.002,
      index === 0 ? 1 : 0, 1, 1e6, 2e5,
      8e5, 30, 1, 1,
      0, 0, 0, 0
    ], offset);
  }
  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      status: 'canonical-reaction-test-source',
      particleCount: 2,
      step: 4,
      time: 0.04,
      smoothingLengthM: 0.1,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      status: 'canonical-reaction-test-source',
      particleCount: 2,
      step: 4,
      time: 0.04,
      mechanics
    }
  };
}

function reactionTableWithoutSummary() {
  const table = buildSphReactionTable([{
    a: 'a',
    b: 'b',
    product: 'ab',
    activationTemperatureK: 500,
    phaseRequirements: { a: ['solid'], b: ['liquid'] },
    specificEnthalpyJPerKg: -1000
  }], {
    materialProperties,
    contactRadiusM: 0.1
  });
  // The fake-device integration test audits the reaction dispatch itself. A
  // zero summary term count prevents the independent compact-ledger pipeline
  // from obscuring the exact pack -> resolve -> unpack sequence.
  return { ...table, productTermCount: 0, gasProductCount: 0 };
}

function createFakeEncoder(label = null) {
  const events = [];
  return {
    label,
    events,
    clearBuffer(buffer, offset = 0, size = null) {
      events.push({ kind: 'clear', buffer: buffer.label, offset, size });
    },
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
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
      return {
        setPipeline(value) { pipeline = value.label; },
        setBindGroup(index, value) {
          event.commands.push({ kind: 'bind-group', index, label: value.label ?? null });
        },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.commands.push({ kind: 'dispatch', pipeline, workgroups: [x, y, z] });
        },
        dispatchWorkgroupsIndirect(buffer, byteOffset = 0) {
          event.commands.push({
            kind: 'dispatch-indirect',
            pipeline,
            buffer: buffer.label,
            byteOffset
          });
        },
        end() { event.ended = true; }
      };
    },
    finish() { return { label: label || 'fake-command-buffer', events }; }
  };
}

function createFakeDevice() {
  const device = {
    buffers: [],
    createdBufferDescriptors: [],
    pipelineDescriptors: [],
    submissions: [],
    writes: [],
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
        device.writes.push({ buffer, offset, byteLength: data.byteLength });
      },
      submit(commandBuffers) { device.submissions.push(commandBuffers); },
      onSubmittedWorkDone() { return Promise.resolve(); }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroyCount: 0,
        destroy() {
          this.destroyed = true;
          this.destroyCount += 1;
        }
      };
      device.buffers.push(buffer);
      device.createdBufferDescriptors.push(descriptor);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      device.pipelineDescriptors.push(descriptor);
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
    label: 'canonical-reaction-active-node-source',
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

test('canonical reaction resolve fail-closes every post-thermal mutation precondition', () => {
  const resolveStart = sphReactionStepWgsl.indexOf(
    'fn resolve(@builtin(global_invocation_id)'
  );
  const resolveEnd = sphReactionStepWgsl.indexOf(
    'fn unpack(@builtin(global_invocation_id)',
    resolveStart
  );
  assert.ok(resolveStart > 0 && resolveEnd > resolveStart);
  const resolveSource = sphReactionStepWgsl.slice(resolveStart, resolveEnd);
  assert.match(resolveSource, /proposal\.x >= f32\(params\.particle_count\)/);
  assert.match(resolveSource, /proposal\.y >= f32\(params\.reaction_count\)/);
  assert.match(resolveSource, /reaction_index >= params\.reaction_count/);
  assert.match(resolveSource, /partner_proposal\.x[^;]+particle_index/s);
  assert.match(resolveSource, /partner_proposal\.y != proposal\.y/);
  assert.match(resolveSource, /rx2\.x != 1\.0/);
  assert.match(resolveSource, /self_is_a == self_is_b/);
  assert.match(resolveSource, /proposal\.z != expected_self_role/);
  assert.match(resolveSource, /partner_proposal\.z != expected_partner_role/);
  assert.match(resolveSource, /phase_mask_satisfied\(rx1\.z, self_thermo\.y\)/);
  assert.match(resolveSource, /phase_mask_satisfied\(rx1\.w, partner_thermo\.y\)/);
  assert.match(resolveSource, /max\(self_thermo\.z, partner_thermo\.z\) < rx0\.w/);
  assert.match(resolveSource, /current_distance2 > contact_radius2/);
  assert.match(resolveSource, /pos_mass\.w <= 0\.0/);
  assert.match(resolveSource, /partner_pos_mass\.w <= 0\.0/);
  assert.match(resolveSource, /reaction_value_finite\(current_distance2\)/);
  const firstMutation = resolveSource.indexOf('write_product_particle(');
  assert.ok(firstMutation > resolveSource.indexOf('partner_proposal.y != proposal.y'));
  assert.ok(firstMutation > resolveSource.indexOf('pos_mass.w <= 0.0'));
  assert.ok(firstMutation > resolveSource.indexOf('current_distance2 > contact_radius2'));
});

test('canonical reaction mode dispatches only pack, resolve, unpack and preserves borrowed artifacts', async () => {
  const device = createFakeDevice();
  const packed = packedPair();
  const table = reactionTableWithoutSummary();
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const activeNodeList = createActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  const sourceStateBuffer = device.createBuffer({
    label: 'canonical-reaction-source-state',
    size: packed.sphParticleState.state.byteLength,
    usage: 128
  });
  const sourceThermoBuffer = device.createBuffer({
    label: 'canonical-reaction-source-thermo',
    size: packed.sphParticleState.thermo.byteLength,
    usage: 128
  });
  const sourceMechanicsBuffer = device.createBuffer({
    label: 'canonical-reaction-source-mechanics',
    size: packed.mlsMpmParticleState.mechanics.byteLength,
    usage: 128
  });
  const discovery = runSchroederSpatialReactionDiscoveryProposalWebGpu({
    device,
    generation,
    sphParticleState: packed.sphParticleState,
    sourceStateBuffer,
    sourceThermoBuffer,
    reactionTable: table
  });
  const borrowedProposalBuffer = discovery.proposalBuffer;
  const borrowedReactionRecordBuffer = discovery.reactionRecordBuffer;

  const reactionRunInputs = {
    device,
    ...packed,
    reactionTable: table,
    thermalMaterialTable,
    sourceStateBuffer,
    sourceThermoBuffer,
    sourceMechanicsBuffer,
    readbackMode: 'no-full-readback',
    retainOutputParticleBuffers: true
  };
  const allocationCountBeforeIncompleteCanonicalCalls =
    device.createdBufferDescriptors.length;
  await assert.rejects(
    runSphReactionStepWebGpu({
      ...reactionRunInputs,
      schroederSpatialEpochGeneration: generation
    }),
    /requires both the spatial epoch generation and its reaction discovery proposal/
  );
  await assert.rejects(
    runSphReactionStepWebGpu({
      ...reactionRunInputs,
      schroederSpatialReactionDiscoveryProposal: discovery
    }),
    /requires both the spatial epoch generation and its reaction discovery proposal/
  );
  assert.equal(
    device.createdBufferDescriptors.length,
    allocationCountBeforeIncompleteCanonicalCalls
  );

  device.createdBufferDescriptors.length = 0;
  device.pipelineDescriptors.length = 0;
  device.submissions.length = 0;
  const result = await runSphReactionStepWebGpu({
    ...reactionRunInputs,
    schroederSpatialEpochGeneration: generation,
    schroederSpatialReactionDiscoveryProposal: discovery
  });
  await new Promise((resolve) => setImmediate(resolve));

  const allocatedLabels = device.createdBufferDescriptors.map(({ label }) => label);
  assert.equal(allocatedLabels.some((label) => /reaction-particle-bin/.test(label)), false);
  assert.equal(allocatedLabels.includes('ulg-sph-reaction-proposals'), false);
  assert.equal(allocatedLabels.includes('ulg-sph-reaction-records-and-product-phases'), false);
  assert.equal(allocatedLabels.some((label) => /reaction-schroeder-law/.test(label)), false);
  const reactionPipelineLabels = device.pipelineDescriptors
    .map(({ label }) => label)
    .filter((label) => label?.startsWith('ulg-sph-reaction-'));
  assert.equal(reactionPipelineLabels.includes('ulg-sph-reaction-particle-bins'), false);
  assert.equal(reactionPipelineLabels.includes('ulg-sph-reaction-propose'), false);
  assert.equal(reactionPipelineLabels.includes('ulg-sph-reaction-pack-source'), true);
  assert.equal(reactionPipelineLabels.includes('ulg-sph-reaction-resolve'), true);
  assert.equal(reactionPipelineLabels.includes('ulg-sph-reaction-unpack'), true);

  const reactionCommandBuffer = device.submissions.at(-1)[0];
  const dispatchedPipelines = reactionCommandBuffer.events
    .filter(({ kind }) => kind === 'pass')
    .flatMap(({ commands }) => commands)
    .filter(({ kind }) => kind === 'dispatch')
    .map(({ pipeline }) => pipeline);
  assert.deepEqual(dispatchedPipelines, [
    'ulg-sph-reaction-pack-source',
    'ulg-sph-reaction-resolve',
    'ulg-sph-reaction-unpack'
  ]);

  assert.equal(result.canonicalSpatialReactionDiscovery, true);
  assert.equal(result.canonicalSpatialReactionDiscoveryStatus,
    'schroeder-spatial-reaction-discovery-proposal-admitted');
  assert.equal(result.canonicalSpatialReactionDiscoveryGenerationId,
    generation.execution.generationId);
  assert.equal(result.canonicalSpatialReactionDiscoveryConsumerId, 'reaction-discovery');
  assert.equal(result.canonicalSpatialReactionDiscoverySupportProfileId,
    discovery.supportProfileId);
  assert.equal(result.canonicalSpatialReactionDiscoveryEpochIdentity,
    discovery.epochIdentity);
  assert.equal(result.canonicalSpatialReactionDiscoveryReceipt, discovery.receipt);
  assert.equal(result.canonicalSpatialReactionDiscoveryProvenance.receipt,
    discovery.receipt);
  assert.equal(result.canonicalSpatialReactionDiscoveryProvenance.traversalCount, 1);
  assert.equal(result.canonicalSpatialReactionDiscoveryProposalPipelineDispatchCount, 0);
  assert.equal(result.canonicalSpatialReactionDiscoveryPrivateParticleBinDispatchCount, 0);
  assert.equal(result.legacyPrivateSpatialBuildCount, 0);
  assert.equal(result.legacyFixedCandidateBuildCount, 0);
  assert.equal(result.legacyExhaustiveTraversalCount, 0);
  assert.equal(result.reactionParticleBinGridEnabled, false);
  assert.equal(result.reactionParticleBinGridCellCount, 0);
  assert.equal(result.reactionProposalNeighborMode,
    'canonical-spatial-reaction-discovery-proposals');

  assert.equal(discovery.released, false);
  assert.equal(borrowedProposalBuffer.destroyed, false);
  assert.equal(borrowedProposalBuffer.destroyCount, 0);
  assert.equal(borrowedReactionRecordBuffer.destroyed, false);
  assert.equal(borrowedReactionRecordBuffer.destroyCount, 0);
  result.destroyOutputParticleBuffers?.();
  discovery.destroy();
  releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
  await generation.releasePromise;
  destroySchroederSpatialReactionDiscoveryProposalCache(device);
});
