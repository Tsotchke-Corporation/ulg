import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1
} from '../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD
} from '../ulg-gpu-abi/src/schroederSpatialMechanicalPairGraph.js';
import {
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS,
  SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE,
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE,
  SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
  SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
  classifySchroederSpatialMechanicalPair,
  destroySchroederSpatialMechanicalProposalRuntime,
  evaluateSchroederSpatialMechanicalPairProposal,
  isLiveSchroederSpatialMechanicalProposal,
  runSchroederSpatialMechanicalProposalWebGpu,
  schroederSpatialMechanicalPairRequiresUnilateralContact,
  schroederSpatialMechanicalPairSharesPhaseLineage,
  schroederSpatialMechanicalGraphControlWgsl,
  schroederSpatialMechanicalGraphSolverWgsl,
  schroederSpatialMechanicalProposalApplyWgsl,
  schroederSpatialMechanicalProposalWgsl
} from '../src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js';
import {
  isFinalizedSchroederSpatialExactNearConsumerReceipt,
  isSchroederSpatialExactNearResidentConsumerBinding,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  runMlsMpmG2pWebGpu
} from '../src/runtime/sph/sphG2pGpuKernel.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

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
  const event = { descriptor, clears: [], passes: [], copies: [] };
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
          const command = { dispatch: [x, y, z] };
          pass.commands.push(command);
          device.dispatches.push({
            encoder: event,
            pass,
            pipeline: pass.pipeline,
            bindGroup: pass.bindGroup?.bindGroup,
            ...command
          });
        },
        dispatchWorkgroupsIndirect(buffer, offset) {
          const command = { dispatchIndirect: { buffer, offset } };
          pass.commands.push(command);
          device.dispatches.push({
            encoder: event,
            pass,
            pipeline: pass.pipeline,
            bindGroup: pass.bindGroup?.bindGroup,
            ...command
          });
        },
        end() { pass.ended = true; }
      };
    },
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
      event.copies.push({ source, sourceOffset, destination, destinationOffset, size });
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
    dispatches: [],
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
        const bytes = copyBytes(data);
        if (Number.isFinite(buffer?.size) && offset + bytes.byteLength > buffer.size) {
          throw new RangeError(
            `writeBuffer overflow for ${buffer.label}: ${offset + bytes.byteLength} > ${buffer.size}`
          );
        }
        device.writes.push({ buffer, offset, bytes });
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

function taggedBuffer(device, label, size, usage = 128) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function createActiveNodeList(
  device,
  particleCount,
  { minLevel = 0, maxLevel = minLevel } = {}
) {
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
    spatialEpochMinLevel: minLevel,
    spatialEpochMaxLevel: maxLevel,
    spatialEpochBaseGridSpacingM: 0.25,
    spatialEpochChartId: 0,
    activeCandidateCount: particleCount,
    activeNodeStrideFloats: 16,
    activeNodeBuffer: taggedBuffer(
      device,
      'mechanical-proposal-active-node-source',
      particleCount * 16 * Float32Array.BYTES_PER_ELEMENT
    ),
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

function createLevelAssignment(
  device,
  particleCount,
  sourceStateBuffer,
  { minLevel = 0, maxLevel = minLevel } = {}
) {
  const assignmentBuffer = taggedBuffer(
    device,
    'mechanical-proposal-level-assignment-source',
    particleCount * 16 * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: 16,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    sourceStateBuffer,
    sourceStateBufferBorrowed: true,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 19,
    chartEpoch: 23,
    levelEpoch: 29,
    supportEpoch: 31,
    minLevel,
    maxLevel,
    chartId: 0,
    baseGridSpacingM: 0.25,
    phaseVolumeAssignmentOverlayEnabled: false
  };
}

function liveFixture(
  particleCount = 2,
  {
    identityEnabled = true,
    minLevel = 0,
    maxLevel = minLevel,
    sourceRowLayout = 'active-node'
  } = {}
) {
  const device = createFakeDevice();
  const state = new Float32Array(particleCount * 8);
  const thermo = new Float32Array(particleCount * 12);
  const mechanics = new Float32Array(particleCount * 32);
  for (let index = 0; index < particleCount; index += 1) {
    state.set([
      1 + 0.5 * index, 1, 1, index + 1,
      index === 0 ? 1 : -1, 0, 0, 0
    ], index * 8);
    thermo[index * 12] = index + 1;
    mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], index * 32);
    mechanics[index * 32 + 18] = 1;
    mechanics[index * 32 + 19] = 1;
    mechanics[index * 32 + 20] = 1;
    mechanics[index * 32 + 21] = 1;
    mechanics[index * 32 + 26] = 1;
  }
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    stateBuffer: taggedBuffer(device, 'mechanical-source-state', state.byteLength),
    thermoBuffer: taggedBuffer(device, 'mechanical-source-thermo', thermo.byteLength),
    ...(identityEnabled
      ? { identityBuffer: taggedBuffer(device, 'mechanical-source-identity', particleCount * 4) }
      : {})
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    mechanicsBuffer: taggedBuffer(device, 'mechanical-source-mechanics', mechanics.byteLength)
  };
  const levelAssignment = sourceRowLayout === 'level-assignment'
    ? createLevelAssignment(
        device,
        particleCount,
        sphParticleUpload.stateBuffer,
        { minLevel, maxLevel }
      )
    : null;
  const activeNodeList = levelAssignment
    ? null
    : createActiveNodeList(device, particleCount, { minLevel, maxLevel });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    ...(levelAssignment ? { levelAssignment } : { activeNodeList }),
    particleCount
  });
  assert.equal(generation.selected, true);
  const gridDims = [4, 4, 4];
  const gridNodeCount = gridDims[0] * gridDims[1] * gridDims[2];
  return {
    device,
    generation,
    spatialSource: levelAssignment || activeNodeList,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state,
      thermo,
      smoothingLengthM: 0.25
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics,
      mechanicsDtS: 0.001,
      particleSeparationRelaxation: 0.35,
      particleSeparationVelocityDamping: 0.25
    },
    sphParticleUpload,
    mlsMpmParticleUpload,
    gridUpdate: {
      schema: ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
      updateSchema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
      backend: 'webgpu',
      particleCount,
      gridSpacingM: 0.25,
      gridDims,
      gridNodeCount,
      gridShift: 1,
      dt: 0.001,
      updatedGridNodes: new Float32Array(gridNodeCount * 8)
    }
  };
}

async function settleDeferredCleanup(device) {
  await device.queue.onSubmittedWorkDone();
  await new Promise((resolve) => setImmediate(resolve));
}

function assertVectorNearZero(vector, tolerance = 1e-12) {
  for (const value of vector) assert.ok(Math.abs(value) <= tolerance, String(vector));
}

test('mechanical pair policy skips one solid body but handles material and domain interfaces', () => {
  const base = {
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 7,
    otherMaterialId: 7,
    domainId: 11,
    otherDomainId: 11,
    identityEnabled: true
  };
  assert.deepEqual(classifySchroederSpatialMechanicalPair(base), {
    handled: false,
    reason: 'same-body-solid'
  });
  assert.equal(classifySchroederSpatialMechanicalPair({
    ...base,
    otherDomainId: 12
  }).handled, true);
  assert.equal(classifySchroederSpatialMechanicalPair({
    ...base,
    otherMaterialId: 8
  }).handled, true);
  assert.equal(classifySchroederSpatialMechanicalPair({
    ...base,
    phaseClass: 1,
    otherPhaseClass: 1
  }).handled, true);
  assert.equal(classifySchroederSpatialMechanicalPair({
    ...base,
    otherPhaseClass: 0
  }).handled, false);
  assert.equal(schroederSpatialMechanicalPairRequiresUnilateralContact({
    ...base,
    otherMaterialId: 8
  }), true);
  assert.equal(schroederSpatialMechanicalPairRequiresUnilateralContact({
    ...base,
    otherDomainId: 12
  }), true);
  assert.equal(schroederSpatialMechanicalPairRequiresUnilateralContact({
    ...base,
    phaseClass: 1,
    otherPhaseClass: 1
  }), false);
  assert.equal(schroederSpatialMechanicalPairRequiresUnilateralContact({
    ...base,
    phaseClass: 1,
    otherPhaseClass: 2
  }), true);
  assert.equal(schroederSpatialMechanicalPairRequiresUnilateralContact({
    ...base,
    phaseClass: 2,
    otherPhaseClass: 1
  }), true);
});

test('different-lineage solid/liquid companions use unilateral non-penetration', () => {
  const proposal = evaluateSchroederSpatialMechanicalPairProposal({
    selfIndex: 3,
    otherIndex: 12,
    phaseLineageCapacity: 8,
    phaseLaneCount: 4,
    phaseClass: 2,
    otherPhaseClass: 1,
    materialId: 3061144,
    otherMaterialId: 3061144,
    position: [0, 0.18, 0],
    otherPosition: [0, 0, 0],
    velocity: [0, -2, 0],
    otherVelocity: [0, 0, 0],
    massKg: 7,
    otherMassKg: 7,
    restVolumeM3: 0.008,
    otherRestVolumeM3: 0.008,
    relaxation: 0,
    normalVelocityDamping: 0
  });
  assert.equal(proposal.handled, true);
  assert.equal(proposal.unilateralContact, true);
  assert.ok(proposal.positionDeltaM[1] > 0);
  assert.ok(proposal.otherPositionDeltaM[1] < 0);
  assert.ok(Math.abs(
    proposal.positionDeltaM[1] + proposal.otherPositionDeltaM[1]
  ) < 1e-12);
  assert.ok(Math.abs(
    proposal.velocityDeltaMPerS[1] + proposal.otherVelocityDeltaMPerS[1]
  ) < 1e-12);
});

test('unilateral material contact closes overlap with conservative inverse-mass response', () => {
  const massKg = 56;
  const otherMassKg = 7;
  const proposal = evaluateSchroederSpatialMechanicalPairProposal({
    phaseClass: 1,
    otherPhaseClass: 2,
    materialId: 26,
    otherMaterialId: 3061144,
    domainId: 2,
    otherDomainId: 1,
    position: [0, 0.18, 0],
    otherPosition: [0, 0, 0],
    velocity: [0, -4, 0],
    otherVelocity: [0, 0, 0],
    massKg,
    otherMassKg,
    restVolumeM3: 0.008,
    otherRestVolumeM3: 0.008,
    relaxation: 0,
    normalVelocityDamping: 0
  });
  assert.equal(proposal.unilateralContact, true);
  assert.ok(proposal.overlapM > 0);
  const separationAfterProjection = 0.18
    + proposal.positionDeltaM[1]
    - proposal.otherPositionDeltaM[1];
  assert.ok(Math.abs(separationAfterProjection - proposal.restDistanceM) < 1e-12);
  assert.ok(Math.abs(proposal.velocityDeltaMPerS[1] - (4 / 9)) < 1e-12);
  assert.ok(Math.abs(proposal.otherVelocityDeltaMPerS[1] + (32 / 9)) < 1e-12);
  const relativeNormalVelocityAfterProjection = -4
    + proposal.velocityDeltaMPerS[1]
    - proposal.otherVelocityDeltaMPerS[1];
  assert.ok(Math.abs(relativeNormalVelocityAfterProjection) < 1e-12);
  assert.ok(Math.abs(
    massKg * proposal.velocityDeltaMPerS[1]
      + otherMassKg * proposal.otherVelocityDeltaMPerS[1]
  ) < 1e-12);
});

test('unilateral position rollback preserves the pair center of mass', () => {
  const proposal = evaluateSchroederSpatialMechanicalPairProposal({
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 26,
    otherMaterialId: 3061144,
    domainId: 2,
    otherDomainId: 1,
    epochPosition: [0, 0.2, 0],
    position: [0, 0.17, 0],
    otherEpochPosition: [0, 0, 0],
    otherPosition: [0, 0, 0],
    massKg: 56,
    otherMassKg: 7,
    restVolumeM3: 0.008,
    otherRestVolumeM3: 0.008,
    relaxation: 0,
    normalVelocityDamping: 0
  });
  assert.equal(proposal.unilateralContact, true);
  assert.ok(Math.abs(proposal.positionDeltaM[1] - (0.03 / 9)) < 1e-12);
  assert.ok(Math.abs(proposal.otherPositionDeltaM[1] + (0.24 / 9)) < 1e-12);
  assert.ok(Math.abs(
    56 * proposal.positionDeltaM[1]
      + 7 * proposal.otherPositionDeltaM[1]
  ) < 1e-12);
});

test('unilateral swept contact preserves the pre-step side after a cohort inversion', () => {
  const proposal = evaluateSchroederSpatialMechanicalPairProposal({
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 26,
    otherMaterialId: 3061144,
    domainId: 2,
    otherDomainId: 1,
    epochPosition: [0, 0.21, 0],
    position: [0, -0.01, 0],
    otherEpochPosition: [0, 0, 0],
    otherPosition: [0, 0, 0],
    massKg: 56,
    otherMassKg: 7,
    restVolumeM3: 0.008,
    otherRestVolumeM3: 0.008
  });
  assert.equal(proposal.unilateralContact, true);
  assert.equal(proposal.sweptContact, true);
  assert.equal(proposal.cohortInverted, true);
  assert.ok(proposal.sweptDistanceM < 1e-12);
  assert.deepEqual(proposal.normal, [0, 1, 0]);
  assert.ok(Math.abs(proposal.positionDeltaM[1] - (0.21 / 9)) < 1e-12);
  assert.ok(Math.abs(proposal.otherPositionDeltaM[1] + (1.68 / 9)) < 1e-12);
  const projectedSeparation = -0.01
    + proposal.positionDeltaM[1]
    - proposal.otherPositionDeltaM[1];
  assert.ok(Math.abs(projectedSeparation - proposal.restDistanceM) < 1e-12);
});

test('non-collinear swept contact uses a central time-of-impact normal and conserves angular momentum', () => {
  const input = {
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 26,
    otherMaterialId: 3061144,
    domainId: 2,
    otherDomainId: 1,
    epochPosition: [0, 0.6, 0],
    otherEpochPosition: [0, -0.6, 0],
    position: [0.1, -0.1, 0],
    otherPosition: [-0.1, 0.1, 0],
    velocity: [0.1, -0.7, 0],
    otherVelocity: [-0.1, 0.7, 0],
    massKg: 1,
    otherMassKg: 1,
    restVolumeM3: 1,
    otherRestVolumeM3: 1,
    selfIndex: 0,
    otherIndex: 1
  };
  const proposal = evaluateSchroederSpatialMechanicalPairProposal(input);
  assert.equal(proposal.unilateralContact, true);
  assert.equal(proposal.sweptContact, true);
  assert.equal(proposal.cohortInverted, true);
  assert.ok(Math.abs(proposal.sweptImpactT - 0.143149944392626) < 1e-12);
  assert.ok(Math.abs(proposal.normal[0] - 0.0286299888785252) < 1e-12);
  assert.ok(Math.abs(proposal.normal[1] - 0.999590077850323) < 1e-12);

  const add = (left, right) => left.map((value, axis) => value + right[axis]);
  const subtract = (left, right) => left.map((value, axis) => value - right[axis]);
  const dot = (left, right) => left.reduce(
    (sum, value, axis) => sum + value * right[axis],
    0
  );
  const angularMomentumZ = (positions, velocities) => positions.reduce(
    (sum, position, index) => sum
      + position[0] * velocities[index][1]
      - position[1] * velocities[index][0],
    0
  );
  const positionsBefore = [input.position, input.otherPosition];
  const velocitiesBefore = [input.velocity, input.otherVelocity];
  const positionsAfter = [
    add(input.position, proposal.positionDeltaM),
    add(input.otherPosition, proposal.otherPositionDeltaM)
  ];
  const velocitiesAfter = [
    add(input.velocity, proposal.velocityDeltaMPerS),
    add(input.otherVelocity, proposal.otherVelocityDeltaMPerS)
  ];
  const finalDelta = subtract(positionsAfter[0], positionsAfter[1]);
  const finalRelativeVelocity = subtract(velocitiesAfter[0], velocitiesAfter[1]);
  assert.ok(dot(finalDelta, proposal.normal) >= proposal.restDistanceM - 1e-12);
  assert.ok(dot(finalDelta, [0, 1, 0]) > 0);
  assert.ok(dot(finalRelativeVelocity, proposal.normal) >= -1e-12);
  assertVectorNearZero(add(proposal.positionDeltaM, proposal.otherPositionDeltaM));
  assertVectorNearZero(add(proposal.velocityDeltaMPerS, proposal.otherVelocityDeltaMPerS));
  assert.ok(Math.abs(
    angularMomentumZ(positionsAfter, velocitiesAfter)
      - angularMomentumZ(positionsBefore, velocitiesBefore)
  ) < 1e-12);

  const swapped = evaluateSchroederSpatialMechanicalPairProposal({
    ...input,
    phaseClass: input.otherPhaseClass,
    otherPhaseClass: input.phaseClass,
    materialId: input.otherMaterialId,
    otherMaterialId: input.materialId,
    domainId: input.otherDomainId,
    otherDomainId: input.domainId,
    epochPosition: input.otherEpochPosition,
    otherEpochPosition: input.epochPosition,
    position: input.otherPosition,
    otherPosition: input.position,
    velocity: input.otherVelocity,
    otherVelocity: input.velocity,
    selfIndex: 1,
    otherIndex: 0
  });
  assertVectorNearZero(add(proposal.normal, swapped.normal));
  assertVectorNearZero(subtract(proposal.positionDeltaM, swapped.otherPositionDeltaM));
  assertVectorNearZero(subtract(proposal.otherPositionDeltaM, swapped.positionDeltaM));
  assertVectorNearZero(subtract(proposal.velocityDeltaMPerS, swapped.otherVelocityDeltaMPerS));
  assertVectorNearZero(subtract(proposal.otherVelocityDeltaMPerS, swapped.velocityDeltaMPerS));
});

test('phase companions from one conserved lineage never become contact pairs', () => {
  assert.equal(schroederSpatialMechanicalPairSharesPhaseLineage({
    selfIndex: 3,
    otherIndex: 11,
    lineageCapacity: 8,
    phaseLaneCount: 4
  }), true);
  const proposal = evaluateSchroederSpatialMechanicalPairProposal({
    selfIndex: 3,
    otherIndex: 11,
    phaseLineageCapacity: 8,
    phaseLaneCount: 4,
    phaseClass: 1,
    otherPhaseClass: 2,
    materialId: 26,
    otherMaterialId: 26,
    position: [0, 0, 0],
    otherPosition: [0, 0, 0],
    massKg: 1,
    otherMassKg: 1,
    restVolumeM3: 0.008,
    otherRestVolumeM3: 0.008
  });
  assert.equal(proposal.handled, false);
  assert.equal(proposal.reason, 'same-phase-carrier-lineage');
  assertVectorNearZero(proposal.positionDeltaM);
});

test('same-material liquid separation keeps optional velocity damping disabled', () => {
  const proposal = evaluateSchroederSpatialMechanicalPairProposal({
    phaseClass: 1,
    otherPhaseClass: 1,
    materialId: 3061144,
    otherMaterialId: 3061144,
    position: [0, 0.18, 0],
    otherPosition: [0, 0, 0],
    velocity: [0, -4, 0],
    otherVelocity: [0, 0, 0],
    restVolumeM3: 0.008,
    otherRestVolumeM3: 0.008,
    relaxation: 0.5,
    normalVelocityDamping: 0
  });
  assert.equal(proposal.unilateralContact, false);
  assertVectorNearZero(proposal.velocityDeltaMPerS);
  assertVectorNearZero(proposal.otherVelocityDeltaMPerS);
  assert.ok(Math.abs(proposal.positionDeltaM[1] - 0.005) < 1e-12);
});

test('manufactured contact proposal preserves position COM and dissipates residual closing speed', () => {
  const massKg = 2;
  const otherMassKg = 5;
  const proposal = evaluateSchroederSpatialMechanicalPairProposal({
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 1,
    otherMaterialId: 2,
    domainId: 3,
    otherDomainId: 3,
    position: [0, 0, 0],
    otherPosition: [0.5, 0, 0],
    velocity: [1, 0, 0],
    otherVelocity: [-0.5, 0, 0],
    massKg,
    otherMassKg,
    restVolumeM3: 1,
    otherRestVolumeM3: 1,
    relaxation: 0.35,
    normalVelocityDamping: 0.25
  });
  assert.equal(proposal.handled, true);
  assert.ok(proposal.overlapM > 0);
  assertVectorNearZero(proposal.positionDeltaM.map(
    (value, axis) => massKg * value + otherMassKg * proposal.otherPositionDeltaM[axis]
  ));
  const velocity = [1, 0, 0].map(
    (value, axis) => value + proposal.velocityDeltaMPerS[axis]
  );
  const otherVelocity = [-0.5, 0, 0].map(
    (value, axis) => value + proposal.otherVelocityDeltaMPerS[axis]
  );
  const normal = [-1, 0, 0];
  const relativeNormalVelocity = velocity.reduce(
    (sum, value, axis) => sum + (value - otherVelocity[axis]) * normal[axis],
    0
  );
  assert.ok(Math.abs(relativeNormalVelocity) < 1e-12);
  const initialKineticEnergy = 0.5 * massKg * (1 ** 2)
    + 0.5 * otherMassKg * (0.5 ** 2);
  const finalKineticEnergy = 0.5 * massKg * velocity.reduce(
    (sum, value) => sum + value * value,
    0
  ) + 0.5 * otherMassKg * otherVelocity.reduce(
    (sum, value) => sum + value * value,
    0
  );
  assert.ok(finalKineticEnergy <= initialKineticEnergy + 1e-12);
});

test('mechanical WGSL retains one checked CSR graph through four sealed Jacobi rounds', () => {
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT.length, 16);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT.length, 48);
  assert.equal(SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS, 48);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT, 1);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /ss_exact_near_directory_admitted\(spatial_expectation\)/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /fn mechanical_graph_pair_policy/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /fn materialize_contact_graph/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /let dispatch_ordinal = global_id\.x[\s\S]*ss_exact_near_source_at_member\([\s\S]*source_rank[\s\S]*self_index = source_lookup\.source_index/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /fn mechanical_graph_allocate_append_slot/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /atomicAdd\(&graph_control\[11u\], 1u\)/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /atomicMin\(&graph_control\[11u\], capacity \+ 1u\)/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /append_records\[append_base \+ 2u\] = pair_rank/);
  assert.doesNotMatch(schroederSpatialMechanicalProposalWgsl,
    /mechanical_graph_source_selected\(other_index\)/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /level != mechanical_params\.apply_selected_level/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /mechanical_graph_support_row_base[\s\S]*mechanical_graph_cached_epoch_position/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /fn mechanical_graph_pair_within_symmetric_envelope/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /let rest_distance_m = 0\.5 \* \(self_diameter \+ other_diameter\)[\s\S]*self_displacement_m[\s\S]*other_displacement_m[\s\S]*self_diameter[\s\S]*other_diameter[\s\S]*self_wall_projection_m[\s\S]*other_wall_projection_m/);
  const graphEnvelopeSource = schroederSpatialMechanicalProposalWgsl.slice(
    schroederSpatialMechanicalProposalWgsl.indexOf(
      'fn mechanical_graph_pair_within_symmetric_envelope('
    ),
    schroederSpatialMechanicalProposalWgsl.indexOf(
      'fn mechanical_graph_allocate_append_slot()'
    )
  );
  assert.ok(
    graphEnvelopeSource.indexOf('if (\n    !unilateral')
      < graphEnvelopeSource.indexOf('let self_displacement_m')
  );
  assert.match(
    graphEnvelopeSource,
    /unilateral: bool[\s\S]*!unilateral[\s\S]*current_distance_m < rest_distance_m/
  );
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /let current_pair_radius_m = rest_distance_m[\s\S]*current_distance_m <= current_pair_radius_m/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /let mixed_law_query_radius_m = 3\.0 \* max\(global_max_diameter, 0\.0\)[\s\S]*4\.0 \* max\(global_max_displacement_m, 0\.0\)[\s\S]*2\.0 \* max\(global_max_wall_projection_m, 0\.0\)/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /let homogeneous_liquid_material_bits = atomicLoad\(&global_support_bits\[\s*4u\s*\]\);[\s\S]*let homogeneous_liquid_certificate =\s*mechanical_params\.retain_complete_authenticated_cell_cliques == 0u[\s\S]*support_reduction_complete[\s\S]*homogeneous_liquid_material_bits[\s\S]*global_support_bits\[\s*5u\s*\]/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /let homogeneous_liquid_query_radius_m = 0\.5 \* \([\s\S]*self_diameter_m[\s\S]*global_max_diameter[\s\S]*self_displacement_m[\s\S]*global_max_displacement_m/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /let query_radius_m = select\(\s*mixed_law_query_radius_m,\s*homogeneous_liquid_query_radius_m,\s*homogeneous_liquid_certificate\s*\)/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /fn mechanical_graph_wall_projection_bound[\s\S]*length\(clamp\(position, lower, upper\) - position\)/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /mechanical_graph_pair_within_symmetric_envelope\([\s\S]*self_cache,[\s\S]*other_endpoint/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /fn mechanical_graph_support_descriptor[\s\S]*fn mechanical_graph_material_bits/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /global_support_bits\[support_base \+ 7u\][\s\S]*bitcast<u32>\(material_id\)/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /global_support_bits\[support_base \+ 3u\][\s\S]*mechanical_graph_source_phase_class\(particle_index\) << 1u/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /atomicOr\([\s\S]*global_support_bits\[support_base \+ 3u\][\s\S]*mechanical_graph_source_phase_class\(particle_index\) << 1u/);
  const supportReductionSource = schroederSpatialMechanicalProposalWgsl.slice(
    schroederSpatialMechanicalProposalWgsl.indexOf('fn reduce_support('),
    schroederSpatialMechanicalProposalWgsl.indexOf(
      'fn mechanical_graph_materialize_cell('
    )
  );
  assert.match(
    supportReductionSource,
    /mechanical_aggregate_record_preflight\(record_index\)[\s\S]*atomicAdd\(&global_support_bits\[seal_word\], 1u\)/
  );
  assert.match(
    supportReductionSource,
    /record_index = record_index \+ mechanical_params\.particle_count/
  );
  assert.match(
    supportReductionSource,
    /source_phase_class != 1u[\s\S]*global_support_bits\[\s*5u\s*\]/
  );
  assert.match(
    supportReductionSource,
    /atomicCompareExchangeWeak\([\s\S]*global_support_bits\[\s*4u\s*\],[\s\S]*(?:0xffffffff|4294967295)u,[\s\S]*material_bits/
  );
  assert.match(
    schroederSpatialMechanicalProposalWgsl,
    /fn mechanical_aggregate_record_preflight[\s\S]*mechanical_aggregate_topology_fingerprint\(record_index\)[\s\S]*projected_source != member\.source_index[\s\S]*MECHANICAL_SUPPORT_ACTIVE_PROJECTION_MEMBER/
  );
  const materializeSource = schroederSpatialMechanicalProposalWgsl.slice(
    schroederSpatialMechanicalProposalWgsl.indexOf('fn materialize_contact_graph('),
    schroederSpatialMechanicalProposalWgsl.indexOf(
      '// ULG_MECHANICAL_AGGREGATE_BRANCH_END'
    )
  );
  assert.match(materializeSource, new RegExp(
    `preflight_seal != cell_count \\* 2u - 1u[\\s\\S]*graph_control\\[14u\\],[\\s\\S]*${
      SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MALFORMED_TRAVERSAL
    }u`
  ));
  assert.match(
    materializeSource,
    /self_support_descriptor[\s\S]*MECHANICAL_SUPPORT_ACTIVE_PROJECTION_MEMBER/
  );
  assert.match(
    materializeSource,
    /let self_cache = MechanicalGraphSelfCache\([\s\S]*self_endpoint,[\s\S]*self_pos_mass\.xyz,[\s\S]*self_epoch_position/
  );
  assert.ok(
    materializeSource.indexOf('if (same_body_solid_subtree)')
      < materializeSource.indexOf('let minimum = vec3<f32>(')
  );
  assert.doesNotMatch(
    materializeSource,
    /MECHANICAL_AGGREGATE_RECORD_REVALIDATION_COMPILED|mechanical_aggregate_topology_fingerprint|mechanical_aggregate_empty_payload_exact/
  );
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /fn mechanical_graph_pair_policy[\s\S]*other_endpoint\.descriptor & 1u\) == 0u/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /struct MechanicalGraphEndpointMetadata[\s\S]*struct MechanicalGraphSelfCache[\s\S]*struct MechanicalGraphPairPolicy[\s\S]*fn mechanical_graph_load_endpoint_metadata/);
  const peerMetadataLoaderSource = schroederSpatialMechanicalProposalWgsl.slice(
    schroederSpatialMechanicalProposalWgsl.indexOf(
      'fn mechanical_graph_load_endpoint_metadata('
    ),
    schroederSpatialMechanicalProposalWgsl.indexOf(
      'fn mechanical_graph_load_self_endpoint_metadata('
    )
  );
  assert.doesNotMatch(peerMetadataLoaderSource, /source_identity/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /let other_endpoint = mechanical_graph_load_endpoint_metadata\(other_index\)[\s\S]*let pair_policy = mechanical_graph_pair_policy\([\s\S]*pair_policy\.unilateral != 0u/);
  const pairPolicySource = schroederSpatialMechanicalProposalWgsl.slice(
    schroederSpatialMechanicalProposalWgsl.indexOf(
      'fn mechanical_graph_pair_policy('
    ),
    schroederSpatialMechanicalProposalWgsl.indexOf(
      'fn mechanical_graph_wall_projection_bound('
    )
  );
  assert.match(
    pairPolicySource,
    /same_material[\s\S]*both_solid[\s\S]*source_identity\[other_index\][\s\S]*same_body_solid[\s\S]*solid_liquid_interface[\s\S]*MechanicalGraphPairPolicy\(1u/
  );
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /retain_complete_authenticated_cell_cliques != 0u[\s\S]*shares_authenticated_cell[\s\S]*epoch_distance_m <= pair_radius_m/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /source_counts\[self_index\] = local_rank/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /mechanical_graph_evidence_saturating_add\(\s*40u,\s*candidate_count/);
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD
      .projectedPeerVisitCount,
    47
  );
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /projected_peer_visit_count == 0xffffffffu[\s\S]*mechanical_graph_load_endpoint_metadata\(other_index\)/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /mechanical_graph_evidence_saturating_add\(\s*47u,\s*projected_peer_visit_count/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /particle_count <= 46340u[\s\S]*atomicAdd\(&traversal_evidence\[word\], value\)[\s\S]*prior <= 0xffffffffu - value/);
  assert.doesNotMatch(schroederSpatialMechanicalProposalWgsl,
    /solver_iteration_count\) \* global_max_diameter/);
  assert.doesNotMatch(schroederSpatialMechanicalProposalWgsl,
    /separation_bins|bin_capacity|candidate_budget/i);
  assert.doesNotMatch(schroederSpatialMechanicalProposalWgsl,
    /for\s*\(var other_index\s*=\s*0u/);

  assert.match(schroederSpatialMechanicalGraphControlWgsl,
    /required_count != append_attempt_count/);
  assert.match(schroederSpatialMechanicalGraphControlWgsl,
    /source_offsets\[particle_count\] = required_count/);
  assert.match(schroederSpatialMechanicalGraphControlWgsl,
    /source_offsets\[arrayLength\(&source_counts\)\] = required_count/);
  assert.match(schroederSpatialMechanicalGraphControlWgsl,
    /dispatchWorkgroupsIndirect|graph_control\[29u\]/);
  assert.match(schroederSpatialMechanicalGraphControlWgsl,
    new RegExp(
      `fn index_contact_graph_csr[\\s\\S]*slot_count = degree \\* 3u[\\s\\S]*${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.DUPLICATE_ENDPOINT}u`
    ));
  assert.match(schroederSpatialMechanicalGraphControlWgsl,
    /fn mechanical_graph_control_row_contains[\s\S]*resident_peer == peer_index[\s\S]*resident_peer == 0xffffffffu/);
  assert.match(schroederSpatialMechanicalGraphControlWgsl,
    new RegExp(
      `fn validate_contact_graph_csr[\\s\\S]*!mechanical_graph_control_row_contains[\\s\\S]*${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MISSING_RECIPROCAL}u`
    ));
  assert.match(schroederSpatialMechanicalGraphControlWgsl,
    new RegExp(
      `fn validate_contact_graph_csr[\\s\\S]*atomicLoad\\(&graph_control\\[14u\\]\\) != 0u\\) \\{ return; \\}[\\s\\S]*${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.STAGE_ORDER}u`
    ));

  for (let iteration = 0; iteration < 4; iteration += 1) {
    assert.match(schroederSpatialMechanicalGraphSolverWgsl,
      new RegExp(`fn measure_iteration_${iteration}`));
    assert.match(schroederSpatialMechanicalGraphSolverWgsl,
      new RegExp(`fn solve_iteration_${iteration}`));
    assert.doesNotMatch(schroederSpatialMechanicalGraphSolverWgsl,
      new RegExp(`fn measure_energy_iteration_${iteration}`));
    assert.match(schroederSpatialMechanicalGraphSolverWgsl,
      new RegExp(`fn allocate_energy_iteration_${iteration}`));
  }
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /fn verify_contact_energy/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /fn verify_contact_residual/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /MECHANICAL_SOLVER_EDGE_INACTIVE_BIT: u32 = 0x80000000u/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /fn mechanical_measure_iteration[\s\S]*csr_peers\[cursor\] = mechanical_solver_encode_measured_peer/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /fn mechanical_solve_iteration[\s\S]*mechanical_solver_edge_inactive\(encoded_peer\)[\s\S]*mechanical_solver_peer_index\(encoded_peer\)/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /fn mechanical_allocate_energy_iteration[\s\S]*mechanical_solver_edge_inactive\(encoded_peer\)[\s\S]*mechanical_solver_peer_index\(encoded_peer\)/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /fn verify_contact_residual[\s\S]*row_bounds_valid[\s\S]*csr_peers\[cursor\] = mechanical_solver_peer_index\(csr_peers\[cursor\]\)[\s\S]*let other_index = csr_peers\[cursor\][\s\S]*mechanical_solver_pair\(self_index, other_index, false\)/);
  const pairLawSource = schroederSpatialMechanicalGraphSolverWgsl.slice(
    schroederSpatialMechanicalGraphSolverWgsl.indexOf('fn mechanical_solver_pair('),
    schroederSpatialMechanicalGraphSolverWgsl.indexOf('fn mechanical_measure_iteration(')
  );
  assert.ok(
    pairLawSource.indexOf('if (!unilateral && !include_soft)')
      < pairLawSource.indexOf('let self_pos_mass')
  );
  assert.ok(
    pairLawSource.indexOf('if (!unilateral)')
      < pairLawSource.indexOf('let epoch_delta')
  );
  assert.match(pairLawSource,
    /if \(overlap <= 0\.0\) \{ return mechanical_solver_zero_pair\(1u\); \}/);
  assert.ok((schroederSpatialMechanicalGraphSolverWgsl.match(
    /active_pair == 0u\) \{ continue; \}/g
  ) || []).length >= 4);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /swept_impact_t[\s\S]*sweep_c \/ max\(entry_denominator[\s\S]*swept_impact_normal/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /inverse_mass_share/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let position_trust_capacity_m = select\([\s\S]*self_diameter_m \+ initial_displacement_m,[\s\S]*particle_scales\[self_index\]\.z,[\s\S]*iteration > 0u/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let remaining_position_trust_m = select\([\s\S]*position_trust_capacity_m,[\s\S]*particle_scales\[self_index\]\.w,[\s\S]*iteration > 0u/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let position_degree_scale = select\([\s\S]*position_max_pair_dx_m \/ max\(position_sum_length_m[\s\S]*let position_trust_scale = select\([\s\S]*position_degree_scale[\s\S]*remaining_position_trust_m \/ max\(position_triangle_sum_m/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let position_triangle_sum_m = barrier_dx_triangle_sum_m[\s\S]*soft_dx_triangle_sum_m/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let scale = vec4<f32>\(\s*position_trust_scale,\s*velocity_stability_scale,\s*position_trust_capacity_m,\s*remaining_position_trust_m\s*\)/);
  assert.doesNotMatch(schroederSpatialMechanicalGraphSolverWgsl,
    /fn mechanical_solver_scale/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /result\.velocity_normal = normal/);
  assert.doesNotMatch(schroederSpatialMechanicalGraphSolverWgsl,
    /pair_velocity_delta_length > 1\.0e-12/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let position_scale = min\(self_scale\.x, other_scale\.x\)[\s\S]*let velocity_scale = min\(self_scale\.y, other_scale\.y\)[\s\S]*return vec4<f32>\(\s*position_scale,\s*velocity_scale,\s*position_scale,\s*velocity_scale\s*\)/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /spent_position_trust_m[\s\S]*prior_position_trust_m[\s\S]*particle_scales\[self_index\]\.z = position_trust_capacity_m[\s\S]*particle_scales\[self_index\]\.w = remaining_position_trust_m/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let self_pair_dv = pair_scale\.y \* pair\.barrier_dv\s*\+ pair_scale\.w \* pair\.soft_dv/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /fn mechanical_energy_effective_pair_dv[\s\S]*return pair_scale\.y \* pair\.barrier_dv\s*\+ pair_scale\.w \* pair\.soft_dv/);
  const solveIterationSource = schroederSpatialMechanicalGraphSolverWgsl.slice(
    schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      'fn mechanical_solve_iteration'
    ),
    schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      'fn mechanical_energy_effective_pair_dv'
    )
  );
  assert.match(solveIterationSource,
    /let other_pair_dv = -\(pos_mass\.w \/ other_mass\) \* self_pair_dv/);
  assert.doesNotMatch(solveIterationSource,
    /mechanical_solver_pair\(\s*other_index,\s*self_index/);
  const edgeLossSource = schroederSpatialMechanicalGraphSolverWgsl.slice(
    schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      'fn mechanical_edge_linear_loss('
    ),
    schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      'fn mechanical_allocate_energy_iteration'
    )
  );
  assert.match(edgeLossSource,
    /let high_pair_dv = -\(low_mass \/ high_mass\) \* low_pair_dv/);
  assert.equal(
    edgeLossSource.match(/mechanical_energy_effective_pair_dv\(/g)?.length,
    1
  );
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /quadratic_energy_j\s*> half_linear_loss_budget_j \+ budget_tolerance_j/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /atomicLoad\(&graph_control\[26u\]\) != mechanical_params\.particle_count/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    new RegExp(`${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u`));

  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /fn publish_contact_proposal/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /fn seal_contact_proposal/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /fn seal_contact_proposal[\s\S]*traversal_evidence\[2u\], 5u/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /fn commit_contact_proposal/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /atomicLoad\(&graph_control\[17u\]\)[\s\S]*mechanical_params\.particle_count/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /atomicLoad\(&graph_control\[18u\]\)[\s\S]*mechanical_params\.particle_count/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    new RegExp(`${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.PROPOSAL_PUBLISHED}u`));
  const publishSource = schroederSpatialMechanicalProposalApplyWgsl.slice(
    schroederSpatialMechanicalProposalApplyWgsl.indexOf(
      'fn publish_contact_proposal'
    ),
    schroederSpatialMechanicalProposalApplyWgsl.indexOf(
      'fn seal_contact_proposal'
    )
  );
  assert.doesNotMatch(publishSource, /traversal_evidence\[2u\].*3u/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /fn seal_contact_proposal[\s\S]*rows_complete[\s\S]*traversal_evidence\[2u\], 3u/);
  assert.doesNotMatch(schroederSpatialMechanicalProposalApplyWgsl,
    /level_assignments/);
});

test('level-assignment spatial sources use SS-authenticated identity and level selection', async () => {
  const graphSelectionSource = schroederSpatialMechanicalProposalWgsl.slice(
    schroederSpatialMechanicalProposalWgsl.indexOf(
      'fn materialize_contact_graph'
    )
  );
  assert.match(graphSelectionSource, /ss_exact_near_cell_for_source/);
  assert.match(graphSelectionSource, /ss_exact_near_cell_key_word/);
  assert.match(graphSelectionSource, /ss_exact_near_signed_order_key/);
  assert.doesNotMatch(graphSelectionSource, /spatial_source_rows/);
  assert.doesNotMatch(graphSelectionSource, /base \+ (?:10|11)u/);

  const solverSelectionSource = schroederSpatialMechanicalGraphSolverWgsl.slice(
    schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      'fn mechanical_solver_selected'
    ),
    schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      'fn mechanical_solver_phase_class'
    )
  );
  assert.match(solverSelectionSource, /verified CSR graph/);
  assert.doesNotMatch(solverSelectionSource, /spatial_source_rows/);
  assert.doesNotMatch(solverSelectionSource, /base \+ (?:10|11)u/);

  const fixture = liveFixture(2, {
    sourceRowLayout: 'level-assignment'
  });
  assert.equal(
    fixture.generation.source.sourceRowLayoutId,
    SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
  );
  assert.equal(
    fixture.generation.source.sourceBuffer,
    fixture.spatialSource.assignmentBuffer
  );

  const proposal = runSchroederSpatialMechanicalProposalWebGpu(fixture);
  const encoder = fixture.device.createCommandEncoder();
  assert.equal(proposal.encodeApply(encoder, {
    stateBuffer: fixture.sphParticleUpload.stateBuffer,
    mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer
  }), true);
  const traversalDispatch = fixture.device.dispatches.find(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-contact-graph-traversal'
  );
  assert.ok(traversalDispatch);
  assert.equal(
    traversalDispatch.bindGroup.entries.find(({ binding }) => binding === 5)
      ?.resource?.buffer,
    fixture.spatialSource.assignmentBuffer
  );
  const solverDispatch = fixture.device.dispatches.find(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-contact-graph-measure-0'
  );
  assert.ok(solverDispatch);
  assert.equal(
    solverDispatch.bindGroup.entries.find(({ binding }) => binding === 9)
      ?.resource?.buffer,
    fixture.spatialSource.assignmentBuffer
  );

  assert.equal(proposal.releaseAfterSubmittedWork(), true);
  assert.equal(await proposal.releasePromise, true);
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});

test('benchmark timestamp spans subdivide the contact bundle without changing its dispatch topology', async () => {
  const fixture = liveFixture(2, { identityEnabled: false });
  const begun = [];
  const ended = [];
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(_encoder, descriptor) {
      begun.push(descriptor);
      return descriptor;
    },
    endEncoderSpan(_encoder, token) {
      ended.push(token);
    }
  };
  const proposal = runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    gpuTimestampRecorder
  });
  const encoder = fixture.device.createCommandEncoder();
  const dispatchStart = fixture.device.dispatches.length;
  assert.equal(proposal.encodeApply(encoder, {
    stateBuffer: fixture.sphParticleUpload.stateBuffer,
    mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer
  }), true);

  const expectedStages = [
    'build',
    'initialize',
    'support-reduction',
    'materialize',
    'count-scan',
    'finalize',
    'scatter-validate',
    'iteration-0',
    'iteration-1',
    'iteration-2',
    'iteration-3',
    'energy-residual-verify',
    'publish',
    'seal-commit'
  ];
  assert.deepEqual(begun.map(({ stage }) => stage), expectedStages);
  assert.deepEqual(ended.map(({ stage }) => stage), [
    'initialize',
    'support-reduction',
    'materialize',
    'build',
    ...expectedStages.slice(4)
  ]);
  assert.ok(begun.every(({ producerId, spanClass }) => (
    producerId.startsWith('schroeder-spatial-mechanical-contact-graph:')
      && spanClass === 'same-production-command-encoder'
  )));
  assert.deepEqual(
    fixture.device.encoders.at(-1).passes.map(({ descriptor }) => descriptor.label),
    [
      'ulg-schroeder-spatial-mechanical-contact-graph-initialize',
      'ulg-schroeder-spatial-mechanical-contact-graph-support-reduction',
      'ulg-schroeder-spatial-mechanical-contact-graph-materialize',
      'ulg-schroeder-spatial-mechanical-contact-graph-countsGroupedScan',
      'ulg-schroeder-spatial-mechanical-contact-graph-finalize',
      'ulg-schroeder-spatial-mechanical-contact-graph-scatter-validate',
      'ulg-schroeder-spatial-mechanical-contact-graph-iteration-0',
      'ulg-schroeder-spatial-mechanical-contact-graph-iteration-1',
      'ulg-schroeder-spatial-mechanical-contact-graph-iteration-2',
      'ulg-schroeder-spatial-mechanical-contact-graph-iteration-3',
      'ulg-schroeder-spatial-mechanical-contact-graph-verify',
      'ulg-schroeder-spatial-mechanical-contact-graph-publish',
      'ulg-schroeder-spatial-mechanical-contact-graph-commit'
    ]
  );
  assert.equal(
    proposal.encodedDispatchCount,
    fixture.device.dispatches.length - dispatchStart
  );
  assert.equal(proposal.encodedComputePassCount, 13);

  assert.equal(proposal.releaseAfterSubmittedWork(), true);
  assert.equal(await proposal.releasePromise, true);
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});

test('a materialize-only timestamp recorder preserves the mechanical contact bundle', async () => {
  const fixture = liveFixture(2, { identityEnabled: false });
  const begun = [];
  const ended = [];
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(_encoder, descriptor) {
      if (
        descriptor.stage !== 'materialize'
        || descriptor.producerId
          !== 'schroeder-spatial-mechanical-contact-graph:materialize'
      ) {
        return null;
      }
      const token = { ...descriptor };
      begun.push(token);
      return token;
    },
    endEncoderSpan(_encoder, token) {
      ended.push(token);
    }
  };
  const proposal = runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    gpuTimestampRecorder
  });
  const encoder = fixture.device.createCommandEncoder();
  const dispatchStart = fixture.device.dispatches.length;
  assert.equal(proposal.encodeApply(encoder, {
    stateBuffer: fixture.sphParticleUpload.stateBuffer,
    mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer
  }), true);

  assert.deepEqual(begun.map(({ stage }) => stage), ['materialize']);
  assert.deepEqual(ended.map(({ stage }) => stage), ['materialize']);
  assert.equal(begun[0].spanClass, 'same-production-command-encoder');
  assert.equal(proposal.encodedComputePassCount, 13);
  assert.equal(
    proposal.encodedDispatchCount,
    fixture.device.dispatches.length - dispatchStart
  );

  assert.equal(proposal.releaseAfterSubmittedWork(), true);
  assert.equal(await proposal.releasePromise, true);
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});

test('deferred post-G2P residual solve publishes truthful resident bindings and reuses its exact arena', async () => {
  const fixture = liveFixture(2, { identityEnabled: false });
  const beforeProposalBuffers = fixture.device.buffers.length;
  const first = runSchroederSpatialMechanicalProposalWebGpu(fixture);
  assert.equal(first.ready, true);
  assert.equal(first.traversalCount, SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT);
  assert.equal(first.solverIterationCount, SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS);
  assert.equal(first.multiConsumerTraversal, true);
  assert.equal(first.proposalPoolCacheHit, false);
  assert.equal(first.proposalCapacity, 2);
  const supportBuffer = fixture.device.buffers.find(
    ({ label }) => label.startsWith(
      'ulg-schroeder-spatial-mechanical-global-support-bound-'
    )
  );
  assert.ok(supportBuffer);
  assert.equal(supportBuffer.size, (6 + first.proposalCapacity * 8 + 1) * 4);
  assert.equal(
    first.minimumDirectedPairsPerParticle,
    SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE
  );
  assert.equal(first.minimumDirectedPairCapacity, 32);
  assert.ok(first.directedPairCapacity >= first.minimumDirectedPairCapacity);
  assert.equal(
    first.candidateByteBudget,
    first.directedPairCapacity * 16
  );
  assert.equal(
    first.retainedGraphByteLength,
    first.contactGraph.retainedByteLength
  );
  assert.equal(first.proposalHeaderWords, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS);
  assert.equal(first.proposalRowWords, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS);
  assert.equal(first.proposalRowByteOffset, 64);
  assert.equal(first.energyLedgerBuffer, first.proposalBuffer);
  assert.equal(first.energyLedgerAliasedToProposalRows, true);
  assert.equal(first.energyLedgerByteOffset, first.proposalRowByteOffset);
  assert.equal(
    first.energyLedgerAliasLifetime,
    'solver-scratch-until-proposal-publication'
  );
  assert.equal(first.contactGraph.energyLedgerBuffer, first.proposalBuffer);
  assert.equal(first.contactGraph.energyLedgerAliasedToProposalRows, true);
  assert.equal(
    first.contactGraph.energyLedgerByteOffset,
    first.proposalRowByteOffset
  );
  assert.equal(
    first.contactGraph.energyLedgerAliasLifetime,
    'solver-scratch-until-proposal-publication'
  );
  assert.equal(first.privateBuildCount, 0);
  assert.equal(first.fixedCandidateBuildCount, 0);
  assert.equal(first.exhaustiveTraversalCount, 0);
  assert.equal(first.candidateBudget, null);
  assert.equal(first.fullParticleReadbackPerformed, false);
  assert.equal(isLiveSchroederSpatialMechanicalProposal(first, {
    device: fixture.device,
    generation: fixture.generation
  }), true);

  const expectedProfiles = [
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1
  ];
  const receipts = SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.map(
    ({ consumerId }) => first.consumerReceipt(consumerId)
  );
  assert.equal(new Set(receipts).size, 3);
  assert.deepEqual(receipts.map(({ supportProfileId }) => supportProfileId), expectedProfiles);
  assert.ok(receipts.every((receipt) => (
    receipt.generationId === fixture.generation.execution.generationId
    && receipt.expectedTraversalCount === SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT
    && receipt.traversalCount === null
    && receipt.candidateVisitCount === null
    && receipt.consumerMaskHitCount === null
    && receipt.migratedProposalCount === null
    && receipt.candidateBytesRequired === null
    && receipt.candidateBytesAdmitted === null
    && receipt.candidateBytesCapacity === null
    && receipt.candidateOverflowBytes === null
    && receipt.gpuAuthenticated === false
    && receipt.resultAuthenticated === false
    && receipt.countersObserved === false
    && receipt.residentEvidence.evidenceBuffer === first.evidence.buffer
    && receipt.residentEvidence.controlBuffer === first.graphControlBuffer
    && receipt.residentEvidence.candidateVisitCountWord === 40
    && receipt.residentEvidence.evidenceWordCount === 48
    && receipt.privateLookupBuildCount === 0
    && receipt.fixedCandidateBuildCount === 0
    && receipt.exhaustiveTraversalCount === 0
    && isSchroederSpatialExactNearResidentConsumerBinding(receipt)
    && !isFinalizedSchroederSpatialExactNearConsumerReceipt(receipt)
  )));
  assert.equal(new Set(receipts.map(({ residentEvidence }) => (
    residentEvidence.evidenceBuffer
  ))).size, 1);

  assert.equal(first.sourcePositionAuthority,
    'post-g2p-state-with-swept-pre-integration-ss-directory');
  const proposalCommandEncoder = fixture.device.createCommandEncoder();
  const dispatchStart = fixture.device.dispatches.length;
  first.encodeApply(proposalCommandEncoder, {
    stateBuffer: fixture.sphParticleUpload.stateBuffer,
    mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer
  });
  const proposalEncoder = fixture.device.encoders.at(-1);
  assert.deepEqual(proposalEncoder.passes.map(({ descriptor }) => descriptor.label), [
    'ulg-schroeder-spatial-mechanical-contact-graph-build',
    'ulg-schroeder-spatial-mechanical-contact-graph-countsGroupedScan',
    'ulg-schroeder-spatial-mechanical-contact-graph-finalize',
    'ulg-schroeder-spatial-mechanical-contact-graph-solve',
    'ulg-schroeder-spatial-mechanical-contact-graph-publish',
    'ulg-schroeder-spatial-mechanical-contact-graph-commit'
  ]);
  assert.deepEqual(proposalEncoder.clears.map(({ offset, size }) => [offset, size]), [
    [0, null],
    [0, null]
  ]);
  assert.equal(proposalEncoder.copies.length, 2);
  assert.equal(proposalEncoder.copies[0].source, first.graphControlBuffer);
  assert.equal(proposalEncoder.copies[0].destination, first.indirectDispatchBuffer);
  assert.equal(proposalEncoder.copies[0].size, 12);
  assert.equal(proposalEncoder.copies[1].source, first.graphControlBuffer);
  assert.equal(
    proposalEncoder.copies[1].destination,
    first.conditionalDispatchBuffer
  );
  assert.equal(proposalEncoder.copies[1].size, 12);
  const labels = fixture.device.dispatches.slice(dispatchStart).map(
    ({ pipeline }) => pipeline.label
  );
  assert.deepEqual(labels.slice(0, 3), [
    'ulg-schroeder-spatial-mechanical-contact-graph-initialize',
    'ulg-schroeder-spatial-mechanical-contact-graph-support-reduction',
    'ulg-schroeder-spatial-mechanical-contact-graph-traversal'
  ]);
  assert.equal(labels.filter((label) => (
    label === 'ulg-schroeder-spatial-mechanical-contact-graph-traversal'
  )).length, 1);
  const finalizeIndex = labels.indexOf(
    'ulg-schroeder-spatial-mechanical-contact-graph-finalize-counts'
  );
  assert.ok(finalizeIndex >= 3);
  assert.deepEqual(labels.slice(finalizeIndex), [
    'ulg-schroeder-spatial-mechanical-contact-graph-finalize-counts',
    'ulg-schroeder-spatial-mechanical-contact-graph-scatter-csr',
    'ulg-schroeder-spatial-mechanical-contact-graph-index-csr',
    'ulg-schroeder-spatial-mechanical-contact-graph-validate-csr',
    'ulg-schroeder-spatial-mechanical-proposal-zero-contact-complete',
    'ulg-schroeder-spatial-mechanical-contact-graph-measure-0',
    'ulg-schroeder-spatial-mechanical-contact-graph-solve-0',
    'ulg-schroeder-spatial-mechanical-contact-graph-energy-allocate-0',
    'ulg-schroeder-spatial-mechanical-contact-graph-measure-1',
    'ulg-schroeder-spatial-mechanical-contact-graph-solve-1',
    'ulg-schroeder-spatial-mechanical-contact-graph-energy-allocate-1',
    'ulg-schroeder-spatial-mechanical-contact-graph-measure-2',
    'ulg-schroeder-spatial-mechanical-contact-graph-solve-2',
    'ulg-schroeder-spatial-mechanical-contact-graph-energy-allocate-2',
    'ulg-schroeder-spatial-mechanical-contact-graph-measure-3',
    'ulg-schroeder-spatial-mechanical-contact-graph-solve-3',
    'ulg-schroeder-spatial-mechanical-contact-graph-energy-allocate-3',
    'ulg-schroeder-spatial-mechanical-contact-energy-verify',
    'ulg-schroeder-spatial-mechanical-contact-residual-verify',
    'ulg-schroeder-spatial-mechanical-proposal-publish',
    'ulg-schroeder-spatial-mechanical-proposal-seal',
    'ulg-schroeder-spatial-mechanical-proposal-commit'
  ]);
  const zeroContactDispatch = fixture.device.dispatches.find(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-proposal-zero-contact-complete'
  );
  assert.deepEqual(zeroContactDispatch?.dispatchIndirect, {
    buffer: first.conditionalDispatchBuffer,
    offset: first.contactGraph.conditionalDispatchOffsetBytes
  });
  const directSolverDispatch = fixture.device.dispatches.find(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-contact-graph-solve-0'
  );
  assert.deepEqual(directSolverDispatch?.dispatch, [1, 1, 1]);
  const indexDispatch = fixture.device.dispatches.find(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-contact-graph-index-csr'
  );
  assert.equal(
    indexDispatch?.pipeline?.layout?.bindGroupLayouts?.[0]?.entries?.find(
      ({ binding }) => binding === 2
    )?.buffer?.type,
    'storage'
  );
  assert.equal(first.lifecycleStatus, 'encoded');
  assert.equal(first.encodedDispatchCount, labels.length);
  assert.equal(first.encodedComputePassCount, 6);
  assert.throws(() => first.encodeApply(
    fixture.device.createCommandEncoder(),
    {
      stateBuffer: fixture.sphParticleUpload.stateBuffer,
      mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer
    }
  ), /single-use/);
  const headerWrite = fixture.device.writes.find(
    ({ buffer, offset }) => buffer === first.proposalBuffer && offset === 0
  );
  const header = new Uint32Array(
    headerWrite.bytes.buffer,
    headerWrite.bytes.byteOffset,
    SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS
  );
  assert.equal(header[0], SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC);
  assert.equal(header[2], fixture.generation.execution.generationId);
  assert.equal(header[4], 2);
  assert.equal(header[14], SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT);
  assert.equal(header[15], 3);
  assert.equal(
    fixture.device.writes.some(({ buffer }) => (
      String(buffer.label).includes('identity-disabled')
    )),
    false,
    'WebGPU zero initialization avoids a per-tick JS identity upload'
  );
  assert.equal(
    fixture.device.buffers.some(({ label }) => /separation-(bins|params|corrections)/.test(label)),
    false
  );
  assert.throws(
    () => runSchroederSpatialMechanicalProposalWebGpu(fixture),
    /still leased/
  );

  assert.equal(first.releaseAfterSubmittedWork(), true);
  assert.ok(first.releasePromise instanceof Promise);
  assert.equal(await first.releasePromise, true);
  await settleDeferredCleanup(fixture.device);
  assert.equal(first.proposalBuffer.destroyCount, 0);
  const bufferCountAfterWarmup = fixture.device.buffers.length;
  const second = runSchroederSpatialMechanicalProposalWebGpu(fixture);
  assert.equal(second.proposalPoolCacheHit, true);
  assert.equal(second.proposalBuffer, first.proposalBuffer);
  assert.equal(second.evidence.buffer, first.evidence.buffer);
  assert.deepEqual(second.evidence.traversalBuffers, first.evidence.traversalBuffers);
  assert.equal(fixture.device.buffers.length, bufferCountAfterWarmup);
  assert.ok(fixture.device.buffers.length > beforeProposalBuffers);
  assert.equal(second.releaseAfterSubmittedWork(), true);
  assert.equal(await second.releasePromise, true);
  await settleDeferredCleanup(fixture.device);
  assert.equal(second.proposalBuffer.destroyCount, 0);
  assert.equal(destroySchroederSpatialMechanicalProposalRuntime(fixture.device), true);
  assert.equal(second.proposalBuffer.destroyCount, 1);
});

test('a tighter pair-graph byte budget cannot reuse an oversized warm arena', async () => {
  const fixture = liveFixture(2);
  const warm = runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    pairGraphByteBudget: 64 * 1024
  });
  assert.ok(warm.candidateByteBudget <= 64 * 1024);
  assert.equal(warm.configuredRetainedByteBudget, 64 * 1024);
  assert.equal(warm.releaseAfterSubmittedWork(), true);
  assert.equal(await warm.releasePromise, true);
  await settleDeferredCleanup(fixture.device);

  const constrained = runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    pairGraphByteBudget: 16 * 1024
  });
  assert.equal(constrained.proposalPoolCacheHit, false);
  assert.ok(constrained.candidateByteBudget <= 16 * 1024);
  assert.equal(constrained.configuredRetainedByteBudget, 16 * 1024);
  assert.notEqual(constrained.proposalBuffer, warm.proposalBuffer);
  assert.equal(warm.proposalBuffer.destroyCount, 1);
  assert.ok(
    constrained.directedPairCapacity < warm.directedPairCapacity,
    `${constrained.directedPairCapacity} !< ${warm.directedPairCapacity}`
  );

  assert.equal(constrained.releaseAfterSubmittedWork(), true);
  assert.equal(await constrained.releasePromise, true);
  await settleDeferredCleanup(fixture.device);
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});

test('explicit mechanical graph budgets below the sixteen-row floor fail before allocation', () => {
  const fixture = liveFixture(2);
  const beforeBuffers = fixture.device.buffers.length;
  assert.throws(() => runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    pairGraphByteBudget: 672 + 31 * 16
  }), /cannot admit the required 32 directed pairs/);
  assert.equal(fixture.device.buffers.length, beforeBuffers);
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});

test('mechanical proposal arena allocation and initialization failures retry without leaks or stale leases', async () => {
  const allocationFixture = liveFixture(2);
  const allocationStart = allocationFixture.device.buffers.length;
  const createBuffer = allocationFixture.device.createBuffer;
  let allocationFailureInjected = false;
  allocationFixture.device.createBuffer = (descriptor) => {
    if (
      !allocationFailureInjected
      && String(descriptor?.label).includes('contact-graph-evidence')
    ) {
      allocationFailureInjected = true;
      throw new Error('injected mechanical arena allocation failure');
    }
    return createBuffer(descriptor);
  };
  assert.throws(
    () => runSchroederSpatialMechanicalProposalWebGpu(allocationFixture),
    /injected mechanical arena allocation failure/
  );
  const partialAllocations = allocationFixture.device.buffers.slice(
    allocationStart
  );
  assert.ok(partialAllocations.length > 0);
  assert.ok(partialAllocations.every(({ destroyCount }) => destroyCount === 1));
  allocationFixture.device.createBuffer = createBuffer;
  const afterAllocationRetry = runSchroederSpatialMechanicalProposalWebGpu(
    allocationFixture
  );
  assert.equal(afterAllocationRetry.proposalPoolAcquisitionCount, 1);
  assert.equal(afterAllocationRetry.releaseAfterSubmittedWork(), true);
  assert.equal(await afterAllocationRetry.releasePromise, true);
  destroySchroederSpatialMechanicalProposalRuntime(allocationFixture.device);

  const initializationFixture = liveFixture(2);
  const writeBuffer = initializationFixture.device.queue.writeBuffer;
  let initializationFailureInjected = false;
  initializationFixture.device.queue.writeBuffer = (buffer, offset, data) => {
    if (
      !initializationFailureInjected
      && String(buffer?.label).includes('mechanical-expectation')
    ) {
      initializationFailureInjected = true;
      throw new Error('injected mechanical arena initialization failure');
    }
    return writeBuffer(buffer, offset, data);
  };
  assert.throws(
    () => runSchroederSpatialMechanicalProposalWebGpu(initializationFixture),
    /injected mechanical arena initialization failure/
  );
  initializationFixture.device.queue.writeBuffer = writeBuffer;
  const afterInitializationRetry = runSchroederSpatialMechanicalProposalWebGpu(
    initializationFixture
  );
  assert.equal(afterInitializationRetry.proposalPoolCacheHit, true);
  assert.equal(afterInitializationRetry.proposalPoolAcquisitionCount, 1);
  assert.equal(afterInitializationRetry.releaseAfterSubmittedWork(), true);
  assert.equal(await afterInitializationRetry.releasePromise, true);
  destroySchroederSpatialMechanicalProposalRuntime(initializationFixture.device);
});

test('canonical G2P applies the authenticated proposal before authority finalization and creates no private bins', async () => {
  const fixture = liveFixture();
  const proposal = runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    selectedLevel: 0
  });
  const dispatchStart = fixture.device.dispatches.length;
  const bufferStart = fixture.device.buffers.length;
  const result = await runMlsMpmG2pWebGpu({
    ...fixture,
    device: fixture.device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    retainOutputParticleBuffers: true,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: fixture.generation,
    schroederSpatialMechanicalProposal: proposal,
    canonicalSpatialRequired: true,
    observeCanonicalSpatialAuthority: true
  });
  const labels = fixture.device.dispatches.slice(dispatchStart).map(
    ({ pipeline }) => pipeline?.label
  );
  assert.equal(labels[0], 'ulg-mls-mpm-g2p-reconstruct');
  assert.equal(labels.at(-1), 'ulg-mls-mpm-g2p-finalize-spatial-authority');
  assert.equal(labels.filter((label) => (
    label === 'ulg-schroeder-spatial-mechanical-contact-graph-traversal'
  )).length, 1);
  assert.ok(labels.indexOf(
    'ulg-schroeder-spatial-mechanical-proposal-commit'
  ) < labels.indexOf('ulg-mls-mpm-g2p-finalize-spatial-authority'));
  assert.equal(labels.some((label) => String(label).startsWith(
    'ulg-mls-mpm-particle-separation-'
  )), false);
  assert.equal(fixture.device.buffers.slice(bufferStart).some(
    ({ label }) => /separation-(bins|params|corrections)/.test(String(label))
  ), false);
  assert.equal(result.separationCanonicalSpatialAuthorityGate, true);
  assert.equal(result.oldLevelAssignmentLookupRemoved, true);
  const selectedLevelWrite = fixture.device.writes.find(({ buffer, offset }) => (
    String(buffer?.label || '').startsWith(
      'ulg-schroeder-spatial-mechanical-params-'
    ) && offset === 44
  ));
  assert.equal(selectedLevelWrite, undefined);
  assert.equal(proposal.uniformQueryLevel, 0);
  assert.equal(
    proposal.applyLevelFilterPolicy,
    'constructor-bound-selected-level'
  );
  const traversalDispatch = fixture.device.dispatches.slice(dispatchStart).find(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-contact-graph-traversal'
  );
  assert.ok(traversalDispatch);
  assert.equal(
    traversalDispatch.bindGroup.entries.find(({ binding }) => binding === 5)
      ?.resource?.buffer,
    fixture.generation.source.sourceBuffer
  );
  assert.equal(webGpuBufferMatchesDevice(result.stateBuffer, fixture.device), true);
  assert.equal(webGpuBufferMatchesDevice(result.mechanicsBuffer, fixture.device), true);
  result.destroyOutputParticleBuffers();
  assert.equal(proposal.releaseAfterSubmittedWork(), true);
  await settleDeferredCleanup(fixture.device);
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});

test('mechanical proposal binds a genuine multi-level selection immutably and encodes once', async () => {
  const fixture = liveFixture(2, { minLevel: 0, maxLevel: 1 });
  assert.throws(() => runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    selectedLevel: -1
  }), /outside the authenticated spatial range 0\.\.1/);
  assert.throws(() => runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    selectedLevel: 2
  }), /outside the authenticated spatial range 0\.\.1/);
  const proposal = runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    selectedLevel: 1
  });
  assert.equal(proposal.uniformQueryLevel, null);
  assert.equal(proposal.selectedLevel, 1);
  assert.equal(
    proposal.applyLevelFilterPolicy,
    'constructor-bound-selected-level'
  );
  const apply = (selectedLevel) => proposal.encodeApply(
    fixture.device.createCommandEncoder(),
    {
      stateBuffer: fixture.sphParticleUpload.stateBuffer,
      mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer,
      selectedLevel
    }
  );
  const selectedLevelWrites = () => fixture.device.writes.filter(
    ({ buffer, offset }) => String(buffer?.label || '').startsWith(
      'ulg-schroeder-spatial-mechanical-params-'
    ) && offset === 44
  );

  assert.throws(() => apply(0), /immutable constructor binding/);
  assert.equal(apply(1), true);
  assert.equal(selectedLevelWrites().length, 0);
  assert.throws(() => apply(1), /single-use/);

  assert.equal(proposal.releaseAfterSubmittedWork(), true);
  await settleDeferredCleanup(fixture.device);
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});
