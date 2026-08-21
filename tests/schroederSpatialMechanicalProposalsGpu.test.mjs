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
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_BYTES,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_VERSION,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_BYTES,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_DISPATCHES,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_WALL_REFINEMENT_ROUNDS,
  SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S,
  SCHROEDER_SPATIAL_MECHANICAL_RECIPROCAL_LAPLACIAN_BOUND_FACTOR,
  SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_POSITION_TRUST_DIAMETERS,
  SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
  SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
  classifySchroederSpatialMechanicalPair,
  createSchroederSpatialMechanicalProposalCapture,
  describeSchroederSpatialMechanicalProposalCapture,
  destroySchroederSpatialMechanicalProposalCapture,
  destroySchroederSpatialMechanicalProposalRuntime,
  evaluateSchroederSpatialMechanicalPhaseGeometryOcclusion,
  evaluateSchroederSpatialMechanicalInterfaceFaceContact,
  evaluateSchroederSpatialMechanicalPairProposal,
  isLiveSchroederSpatialMechanicalProposal,
  runSchroederSpatialMechanicalProposalWebGpu,
  schroederSpatialMechanicalPairRequiresUnilateralContact,
  schroederSpatialMechanicalPairSharesPhaseLineage,
  schroederSpatialMechanicalGraphControlWgsl,
  schroederSpatialMechanicalGraphSolverWgsl,
  schroederSpatialMechanicalInterfaceReceiptWgsl,
  schroederSpatialMechanicalProposalApplyWgsl,
  schroederSpatialMechanicalProposalV2FlatWgsl,
  schroederSpatialMechanicalProposalV2Wgsl,
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
    bindGroupLayouts: [],
    pipelineLayouts: [],
    computePipelines: [],
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
    createBindGroupLayout(descriptor) {
      device.bindGroupLayouts.push(descriptor);
      return descriptor;
    },
    createPipelineLayout(descriptor) {
      device.pipelineLayouts.push(descriptor);
      return descriptor;
    },
    createComputePipeline(descriptor) {
      const pipeline = {
        ...descriptor,
        getBindGroupLayout(index) { return { index }; }
      };
      device.computePipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      device.bindGroups.push(descriptor);
      return descriptor;
    },
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

test('unilateral finite-volume contact closes diagonal lattice gaps on the selected face', () => {
  const proposal = evaluateSchroederSpatialMechanicalPairProposal({
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 26,
    otherMaterialId: 3061144,
    domainId: 2,
    otherDomainId: 1,
    position: [0.9, 0.9, 0],
    otherPosition: [0, 0, 0],
    massKg: 1,
    otherMassKg: 1,
    restVolumeM3: 1,
    otherRestVolumeM3: 1
  });
  assert.equal(proposal.unilateralContact, true);
  assert.equal(proposal.handled, true);
  assert.ok(proposal.distanceM > proposal.restDistanceM);
  assert.deepEqual(proposal.normal, [1, 0, 0]);
  assert.ok(Math.abs(proposal.positionDeltaM[0] - 0.05) < 1e-12);
  assert.equal(proposal.positionDeltaM[1], 0);
  assert.ok(Math.abs(proposal.otherPositionDeltaM[0] + 0.05) < 1e-12);
  assert.equal(Math.abs(proposal.otherPositionDeltaM[1]), 0);
});

test('finite-volume contact retains closing velocity across only its f32 face shell', () => {
  const nearFace = evaluateSchroederSpatialMechanicalPairProposal({
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 26,
    otherMaterialId: 3061144,
    domainId: 2,
    otherDomainId: 1,
    position: [0, 0.10000002, 0],
    otherPosition: [0, 0, 0],
    epochPosition: [0, 0.10000002, 0],
    otherEpochPosition: [0, 0, 0],
    velocity: [0, -0.25, 0],
    otherVelocity: [0, 0, 0],
    massKg: 1,
    otherMassKg: 1,
    restVolumeM3: 0.001,
    otherRestVolumeM3: 0.001
  });
  assert.equal(nearFace.handled, true);
  assert.equal(nearFace.overlapM, 0);
  assertVectorNearZero(nearFace.positionDeltaM);
  assertVectorNearZero(nearFace.otherPositionDeltaM);
  assert.ok(nearFace.velocityDeltaMPerS[1] > 0);
  assert.ok(nearFace.otherVelocityDeltaMPerS[1] < 0);

  const physicalGap = evaluateSchroederSpatialMechanicalPairProposal({
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 26,
    otherMaterialId: 3061144,
    domainId: 2,
    otherDomainId: 1,
    position: [0, 0.10001, 0],
    otherPosition: [0, 0, 0],
    epochPosition: [0, 0.10001, 0],
    otherEpochPosition: [0, 0, 0],
    velocity: [0, -0.25, 0],
    otherVelocity: [0, 0, 0],
    massKg: 1,
    otherMassKg: 1,
    restVolumeM3: 0.001,
    otherRestVolumeM3: 0.001
  });
  assert.equal(physicalGap.handled, false);
  assert.equal(physicalGap.reason, 'outside-pair-support');

  const dormantFrame = {
    admitted: false,
    normal: [0, 1, 0],
    responseNormal: [0, 1, 0],
    responseProjection: 1,
    supportDistanceM: 0.1
  };
  const dormantPhysicalGap =
    evaluateSchroederSpatialMechanicalPairProposal({
      phaseClass: 2,
      otherPhaseClass: 2,
      materialId: 26,
      otherMaterialId: 3061144,
      domainId: 2,
      otherDomainId: 1,
      position: [0, 0.10001, 0],
      otherPosition: [0, 0, 0],
      velocity: [0, -0.25, 0],
      otherVelocity: [0, 0, 0],
      massKg: 1,
      otherMassKg: 1,
      restVolumeM3: 0.001,
      otherRestVolumeM3: 0.001,
      frozenMatchingFrame: dormantFrame
    });
  assert.equal(dormantPhysicalGap.handled, false);
  assertVectorNearZero(dormantPhysicalGap.positionDeltaM);
  assertVectorNearZero(dormantPhysicalGap.velocityDeltaMPerS);

  const dormantTangentialGap =
    evaluateSchroederSpatialMechanicalPairProposal({
      phaseClass: 2,
      otherPhaseClass: 2,
      materialId: 26,
      otherMaterialId: 3061144,
      domainId: 2,
      otherDomainId: 1,
      position: [0.10001, 0.09, 0],
      otherPosition: [0, 0, 0],
      velocity: [0, -0.25, 0],
      otherVelocity: [0, 0, 0],
      massKg: 1,
      otherMassKg: 1,
      restVolumeM3: 0.001,
      otherRestVolumeM3: 0.001,
      frozenMatchingFrame: dormantFrame
    });
  assert.equal(dormantTangentialGap.handled, false);
  assertVectorNearZero(dormantTangentialGap.positionDeltaM);
  assertVectorNearZero(dormantTangentialGap.velocityDeltaMPerS);

  const dormantFaceShell =
    evaluateSchroederSpatialMechanicalPairProposal({
      phaseClass: 2,
      otherPhaseClass: 2,
      materialId: 26,
      otherMaterialId: 3061144,
      domainId: 2,
      otherDomainId: 1,
      position: [0, 0.10000002, 0],
      otherPosition: [0, 0, 0],
      velocity: [0, -0.25, 0],
      otherVelocity: [0, 0, 0],
      massKg: 1,
      otherMassKg: 1,
      restVolumeM3: 0.001,
      otherRestVolumeM3: 0.001,
      frozenMatchingFrame: dormantFrame
    });
  assert.equal(dormantFaceShell.handled, true);
  assert.equal(dormantFaceShell.overlapM, 0);
  assert.ok(dormantFaceShell.velocityDeltaMPerS[1] > 0);
  assert.ok(dormantFaceShell.otherVelocityDeltaMPerS[1] < 0);
});

test('matching cleanup keeps one frozen supporting face when dynamic geometry switches axes', () => {
  const shared = {
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 26,
    otherMaterialId: 3061144,
    domainId: 2,
    otherDomainId: 1,
    massKg: 1,
    otherMassKg: 1,
    restVolumeM3: 1,
    otherRestVolumeM3: 1
  };
  const initial = evaluateSchroederSpatialMechanicalPairProposal({
    ...shared,
    position: [0.9, 0.8, 0],
    otherPosition: [0, 0, 0]
  });
  assert.deepEqual(initial.normal, [1, 0, 0]);
  assert.deepEqual(initial.responseNormal, initial.normal);
  assert.equal(initial.responseProjection, 1);
  const frozenMatchingFrame = {
    normal: initial.normal,
    responseNormal: initial.responseNormal,
    responseProjection: initial.responseProjection,
    supportDistanceM: initial.supportDistanceM
  };
  const moved = {
    ...shared,
    position: [0.8, 0.9, 0],
    otherPosition: [0, 0, 0]
  };
  const dynamicallyRemeasured =
    evaluateSchroederSpatialMechanicalPairProposal(moved);
  const frozen = evaluateSchroederSpatialMechanicalPairProposal({
    ...moved,
    frozenMatchingFrame
  });
  assert.deepEqual(dynamicallyRemeasured.normal, [0, 1, 0]);
  assert.deepEqual(frozen.normal, [1, 0, 0]);
  assert.deepEqual(frozen.responseNormal, initial.responseNormal);
  assert.equal(frozen.responseProjection, initial.responseProjection);
  const finalPosition = moved.position.map(
    (value, axis) => value + frozen.positionDeltaM[axis]
  );
  const finalOtherPosition = moved.otherPosition.map(
    (value, axis) => value + frozen.otherPositionDeltaM[axis]
  );
  const finalDelta = finalPosition.map(
    (value, axis) => value - finalOtherPosition[axis]
  );
  assert.ok(Math.abs(finalDelta[0] - initial.supportDistanceM) < 1e-12);
  assertVectorNearZero(frozen.positionDeltaM.map(
    (value, axis) => value + frozen.otherPositionDeltaM[axis]
  ));
  const secondPass = evaluateSchroederSpatialMechanicalPairProposal({
    ...moved,
    position: finalPosition,
    otherPosition: finalOtherPosition,
    frozenMatchingFrame
  });
  assert.ok(secondPass.overlapM < 1e-12);
  assertVectorNearZero(secondPass.positionDeltaM);
  assertVectorNearZero(secondPass.otherPositionDeltaM);
});

test('matching cleanup drops an admitted frozen face after tangential support is lost', () => {
  const shared = {
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 26,
    otherMaterialId: 3061144,
    domainId: 2,
    otherDomainId: 1,
    massKg: 1,
    otherMassKg: 1,
    restVolumeM3: 1,
    otherRestVolumeM3: 1
  };
  const initial = evaluateSchroederSpatialMechanicalPairProposal({
    ...shared,
    position: [0.9, 0.9, 0],
    otherPosition: [0, 0, 0]
  });
  assert.deepEqual(initial.normal, [1, 0, 0]);
  const frozenMatchingFrame = {
    admitted: true,
    normal: initial.normal,
    responseNormal: initial.responseNormal,
    responseProjection: initial.responseProjection,
    supportDistanceM: initial.supportDistanceM
  };
  const tangentiallyDisjoint = evaluateSchroederSpatialMechanicalPairProposal({
    ...shared,
    position: [0.9, 1.1, 0],
    otherPosition: [0, 0, 0],
    velocity: [-0.02, 0, 0],
    otherVelocity: [0, 0, 0],
    frozenMatchingFrame
  });
  assert.equal(tangentiallyDisjoint.handled, false);
  assert.equal(tangentiallyDisjoint.reason, 'outside-pair-support');
  assertVectorNearZero(tangentiallyDisjoint.positionDeltaM);
  assertVectorNearZero(tangentiallyDisjoint.otherPositionDeltaM);
  assertVectorNearZero(tangentiallyDisjoint.velocityDeltaMPerS);
  assertVectorNearZero(tangentiallyDisjoint.otherVelocityDeltaMPerS);
});

test('matching cleanup preserves a genuine sweep through its frozen face', () => {
  const shared = {
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 26,
    otherMaterialId: 3061144,
    domainId: 2,
    otherDomainId: 1,
    epochPosition: [1.2, 0.9, 0],
    otherEpochPosition: [0, 0, 0],
    position: [0.9, 1.02, 0],
    otherPosition: [0, 0, 0],
    velocity: [-0.02, 0, 0],
    otherVelocity: [0, 0, 0],
    massKg: 1,
    otherMassKg: 1,
    restVolumeM3: 1,
    otherRestVolumeM3: 1
  };
  const swept = evaluateSchroederSpatialMechanicalPairProposal(shared);
  assert.equal(swept.handled, true);
  assert.equal(swept.sweptContact, true);
  assert.deepEqual(swept.normal, [1, 0, 0]);
  const frozen = evaluateSchroederSpatialMechanicalPairProposal({
    ...shared,
    frozenMatchingFrame: {
      admitted: true,
      normal: swept.normal,
      responseNormal: swept.responseNormal,
      responseProjection: swept.responseProjection,
      supportDistanceM: swept.supportDistanceM
    }
  });
  assert.equal(frozen.handled, true);
  assert.equal(frozen.sweptContact, true);
  assert.deepEqual(frozen.normal, [1, 0, 0]);
  assert.ok(frozen.positionDeltaM[0] > 0);
  assert.ok(frozen.velocityDeltaMPerS[0] > 0);
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

test('cohort inversion without tangential face overlap remains disjoint', () => {
  const input = {
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 26,
    otherMaterialId: 3061144,
    domainId: 2,
    otherDomainId: 1,
    epochPosition: [1.2, 1.2, 0],
    otherEpochPosition: [0, 0, 0],
    position: [-1.2, 1.2, 0],
    otherPosition: [0, 0, 0],
    velocity: [-1, 0, 0],
    otherVelocity: [0, 0, 0],
    massKg: 1,
    otherMassKg: 1,
    restVolumeM3: 1,
    otherRestVolumeM3: 1
  };
  const face = evaluateSchroederSpatialMechanicalInterfaceFaceContact(input);
  const proposal = evaluateSchroederSpatialMechanicalPairProposal(input);

  assert.equal(face.contact, false);
  assert.equal(face.reason, 'outside-swept-face-support');
  assert.equal(proposal.unilateralContact, true);
  assert.equal(proposal.handled, false);
  assert.equal(proposal.reason, 'outside-pair-support');
  assert.equal(proposal.overlapM, 0);
  assertVectorNearZero(proposal.positionDeltaM);
  assertVectorNearZero(proposal.otherPositionDeltaM);
  assertVectorNearZero(proposal.velocityDeltaMPerS);
  assertVectorNearZero(proposal.otherVelocityDeltaMPerS);

  const finiteVolumeSource = schroederSpatialMechanicalGraphSolverWgsl.slice(
    schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      'fn mechanical_solver_finite_volume_contact('
    ),
    schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      'fn mechanical_solver_pair_response('
    )
  );
  assert.doesNotMatch(
    finiteVolumeSource,
    /else if \(cohort_inverted/
  );
  assert.match(
    finiteVolumeSource,
    /if \(!admitted\) \{ return rejected; \}/
  );
});

test('non-collinear swept contact preserves tangential motion at its finite-volume face', () => {
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
  assert.ok(Math.abs(proposal.sweptImpactT - 1 / 7) < 1e-12);
  assert.deepEqual(proposal.normal, [0, 1, 0]);
  assert.deepEqual(proposal.responseNormal, proposal.normal);
  assert.equal(proposal.responseProjection, 1);

  const add = (left, right) => left.map((value, axis) => value + right[axis]);
  const subtract = (left, right) => left.map((value, axis) => value - right[axis]);
  const dot = (left, right) => left.reduce(
    (sum, value, axis) => sum + value * right[axis],
    0
  );
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
  assert.equal(finalRelativeVelocity[0], input.velocity[0] - input.otherVelocity[0]);
  assert.equal(Math.abs(proposal.positionDeltaM[0]), 0);
  assert.equal(Math.abs(proposal.otherPositionDeltaM[0]), 0);
  assert.equal(Math.abs(proposal.velocityDeltaMPerS[0]), 0);
  assert.equal(Math.abs(proposal.otherVelocityDeltaMPerS[0]), 0);
  assertVectorNearZero(add(proposal.positionDeltaM, proposal.otherPositionDeltaM));
  assertVectorNearZero(add(proposal.velocityDeltaMPerS, proposal.otherVelocityDeltaMPerS));

  const frozenMatchingFrame = {
    normal: proposal.normal,
    responseNormal: proposal.responseNormal,
    responseProjection: proposal.responseProjection,
    supportDistanceM: proposal.supportDistanceM,
    sweptContact: proposal.sweptContact,
    sweptImpactT: proposal.sweptImpactT,
    cohortInverted: proposal.cohortInverted
  };
  const movedInput = {
    ...input,
    position: [0.4, -0.1, 0],
    otherPosition: [-0.4, 0.1, 0]
  };
  const movedDynamic =
    evaluateSchroederSpatialMechanicalPairProposal(movedInput);
  const movedFrozen = evaluateSchroederSpatialMechanicalPairProposal({
    ...movedInput,
    frozenMatchingFrame
  });
  assert.deepEqual(movedDynamic.normal, proposal.normal);
  assert.deepEqual(movedDynamic.responseNormal, proposal.responseNormal);
  assert.deepEqual(movedFrozen.normal, proposal.normal);
  assert.deepEqual(movedFrozen.responseNormal, proposal.responseNormal);
  assert.equal(movedFrozen.responseProjection, proposal.responseProjection);
  const movedPositionsAfter = [
    add(movedInput.position, movedFrozen.positionDeltaM),
    add(movedInput.otherPosition, movedFrozen.otherPositionDeltaM)
  ];
  const movedVelocitiesAfter = [
    add(movedInput.velocity, movedFrozen.velocityDeltaMPerS),
    add(movedInput.otherVelocity, movedFrozen.otherVelocityDeltaMPerS)
  ];
  const movedFinalDelta = subtract(
    movedPositionsAfter[0],
    movedPositionsAfter[1]
  );
  const movedFinalRelativeVelocity = subtract(
    movedVelocitiesAfter[0],
    movedVelocitiesAfter[1]
  );
  assert.ok(
    dot(movedFinalDelta, proposal.normal)
      >= proposal.supportDistanceM - 1e-12
  );
  assert.ok(dot(movedFinalRelativeVelocity, proposal.normal) >= -1e-12);
  assertVectorNearZero(add(
    movedFrozen.positionDeltaM,
    movedFrozen.otherPositionDeltaM
  ));
  assertVectorNearZero(add(
    movedFrozen.velocityDeltaMPerS,
    movedFrozen.otherVelocityDeltaMPerS
  ));
  const kineticEnergy = (velocities) => 0.5 * (
    dot(velocities[0], velocities[0])
      + dot(velocities[1], velocities[1])
  );
  const kineticBefore = kineticEnergy([
    movedInput.velocity,
    movedInput.otherVelocity
  ]);
  const kineticAfter = kineticEnergy(movedVelocitiesAfter);
  assert.ok(kineticAfter <= kineticBefore + 1e-12);
  assert.ok(kineticBefore - kineticAfter >= -1e-12);
  const movedSecondPass = evaluateSchroederSpatialMechanicalPairProposal({
    ...movedInput,
    position: movedPositionsAfter[0],
    otherPosition: movedPositionsAfter[1],
    velocity: movedVelocitiesAfter[0],
    otherVelocity: movedVelocitiesAfter[1],
    frozenMatchingFrame
  });
  assert.ok(movedSecondPass.overlapM < 1e-12);
  assertVectorNearZero(movedSecondPass.positionDeltaM);
  assertVectorNearZero(movedSecondPass.velocityDeltaMPerS);

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

test('only exposed phase-lineage union cells own external contact geometry', () => {
  const lineageCapacity = 8;
  const phaseLaneCount = 4;
  const outerSolid = {
    index: 3,
    massKg: 8,
    restVolumeM3: 0.008,
    phaseClass: 2,
    materialId: 26,
    position: [0, 0, 0],
    epochPosition: [0, 0, 0]
  };
  const innerLiquid = {
    index: 11,
    massKg: 1,
    restVolumeM3: 0.001,
    phaseClass: 1,
    materialId: 26,
    position: [0, 0, 0],
    epochPosition: [0, 0, 0]
  };
  const inner = evaluateSchroederSpatialMechanicalPhaseGeometryOcclusion({
    selfIndex: innerLiquid.index,
    lineageCapacity,
    phaseLaneCount,
    carriers: [outerSolid, innerLiquid]
  });
  assert.deepEqual(inner, {
    valid: true,
    occluded: true,
    ownerIndex: outerSolid.index,
    reason: 'contained-by-lineage-companion'
  });
  const outer = evaluateSchroederSpatialMechanicalPhaseGeometryOcclusion({
    selfIndex: outerSolid.index,
    lineageCapacity,
    phaseLaneCount,
    carriers: [outerSolid, innerLiquid]
  });
  assert.equal(outer.valid, true);
  assert.equal(outer.occluded, false);
  assert.equal(outer.ownerIndex, null);

  const exposedNow = evaluateSchroederSpatialMechanicalPhaseGeometryOcclusion({
    selfIndex: innerLiquid.index,
    lineageCapacity,
    phaseLaneCount,
    carriers: [
      outerSolid,
      { ...innerLiquid, position: [0.051, 0, 0] }
    ]
  });
  assert.equal(exposedNow.occluded, false);
  const exposedDuringSweep =
    evaluateSchroederSpatialMechanicalPhaseGeometryOcclusion({
      selfIndex: innerLiquid.index,
      lineageCapacity,
      phaseLaneCount,
      carriers: [
        outerSolid,
        { ...innerLiquid, epochPosition: [0.051, 0, 0] }
      ]
    });
  assert.equal(exposedDuringSweep.occluded, false);

  const gasEnvelope =
    evaluateSchroederSpatialMechanicalPhaseGeometryOcclusion({
      selfIndex: outerSolid.index,
      lineageCapacity,
      phaseLaneCount,
      carriers: [
        outerSolid,
        {
          ...innerLiquid,
          index: 19,
          restVolumeM3: 8,
          phaseClass: 0
        }
      ]
    });
  assert.equal(gasEnvelope.occluded, false);

  const equalLower = {
    ...outerSolid,
    index: 1,
    restVolumeM3: 0.008
  };
  const equalHigher = {
    ...innerLiquid,
    index: 9,
    restVolumeM3: 0.008
  };
  const equalTie = evaluateSchroederSpatialMechanicalPhaseGeometryOcclusion({
    selfIndex: equalHigher.index,
    lineageCapacity,
    phaseLaneCount,
    carriers: [equalLower, equalHigher]
  });
  assert.equal(equalTie.occluded, true);
  assert.equal(equalTie.ownerIndex, equalLower.index);
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

test('mechanical interface receipt measures deterministic static and swept cell faces', () => {
  const aligned = evaluateSchroederSpatialMechanicalInterfaceFaceContact({
    position: [0, 0, 0],
    otherPosition: [1, 0, 0],
    restVolumeM3: 1,
    otherRestVolumeM3: 1
  });
  assert.equal(aligned.contact, true);
  assert.equal(aligned.sweptContact, false);
  assert.equal(aligned.normalAxis, 0);
  assert.equal(aligned.areaM2, 1);

  const staggered = evaluateSchroederSpatialMechanicalInterfaceFaceContact({
    position: [0, 0, 0],
    otherPosition: [1, 0.5, 0],
    restVolumeM3: 1,
    otherRestVolumeM3: 1
  });
  const reciprocal = evaluateSchroederSpatialMechanicalInterfaceFaceContact({
    position: [1, 0.5, 0],
    otherPosition: [0, 0, 0],
    restVolumeM3: 1,
    otherRestVolumeM3: 1
  });
  assert.equal(staggered.areaM2, 0.5);
  assert.equal(reciprocal.areaM2, staggered.areaM2);
  assert.equal(reciprocal.normalAxis, staggered.normalAxis);

  const edgeOnly = evaluateSchroederSpatialMechanicalInterfaceFaceContact({
    position: [0, 0, 0],
    otherPosition: [1, 1, 0],
    restVolumeM3: 1,
    otherRestVolumeM3: 1
  });
  const cornerOnly = evaluateSchroederSpatialMechanicalInterfaceFaceContact({
    position: [0, 0, 0],
    otherPosition: [1, 1, 1],
    restVolumeM3: 1,
    otherRestVolumeM3: 1
  });
  const decimalLatticeEdgeOnly =
    evaluateSchroederSpatialMechanicalInterfaceFaceContact({
      position: [0.07000000000000002, 0.0364, 0.07],
      otherPosition: [0.0672, 0.0336, 0.07],
      restVolumeM3: 0.0028 ** 3,
      otherRestVolumeM3: 0.0028 ** 3
    });
  const f32EdgeM = Math.fround(0.0028);
  const f32LatticeEdgeOnly =
    evaluateSchroederSpatialMechanicalInterfaceFaceContact({
      position: [
        Math.fround(0.0364),
        Math.fround(0.07),
        Math.fround(0.07)
      ],
      otherPosition: [
        Math.fround(0.0392),
        Math.fround(0.0672),
        Math.fround(0.07)
      ],
      restVolumeM3: f32EdgeM ** 3,
      otherRestVolumeM3: f32EdgeM ** 3
    });
  const finiteThinFace =
    evaluateSchroederSpatialMechanicalInterfaceFaceContact({
      position: [0, 0, 0],
      otherPosition: [1, Math.fround(1 - 1e-4), 0],
      restVolumeM3: 1,
      otherRestVolumeM3: 1
    });
  assert.equal(edgeOnly.contact, false);
  assert.equal(cornerOnly.contact, false);
  assert.equal(decimalLatticeEdgeOnly.contact, false);
  assert.equal(f32LatticeEdgeOnly.contact, false);
  assert.equal(finiteThinFace.contact, true);
  assert.ok(finiteThinFace.areaM2 > 9e-5);

  const swept = evaluateSchroederSpatialMechanicalInterfaceFaceContact({
    position: [0, 0, 0],
    otherPosition: [-2, 0.25, 0],
    epochPosition: [0, 0, 0],
    otherEpochPosition: [2, 0.25, 0],
    restVolumeM3: 1,
    otherRestVolumeM3: 1
  });
  assert.equal(swept.contact, true);
  assert.equal(swept.sweptContact, true);
  assert.equal(swept.normalAxis, 0);
  assert.equal(swept.impactT, 0.25);
  assert.equal(swept.areaM2, 0.75);

  const separating = evaluateSchroederSpatialMechanicalInterfaceFaceContact({
    position: [0, 0, 0],
    otherPosition: [3, 0, 0],
    epochPosition: [0, 0, 0],
    otherEpochPosition: [2, 0, 0],
    restVolumeM3: 1,
    otherRestVolumeM3: 1
  });
  assert.equal(separating.contact, false);
});

test('sixteen local wall refinements contract the unequal-mass wall-contact tail', () => {
  const lowMassKg = 3.917e-6;
  const highMassKg = 1.532e-4;
  const refine = ({ rounds, projectLowUpperWall }) => {
    let lowVelocity = 0;
    let highVelocity = 1;
    let lowPairImpulse = 0;
    let highPairImpulse = 0;
    let pairKineticDeltaJ = 0;
    let wallKineticDeltaJ = 0;
    let priorWallClipped = true;
    let completedRounds = 0;
    for (let round = 0; round < rounds; round += 1) {
      const approach = lowVelocity - highVelocity;
      if (
        round > 0
        && (
          !priorWallClipped
          || approach
            >= -SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
        )
      ) break;
      const relativeVelocityDelta = Math.max(-approach, 0);
      const lowVelocityDelta =
        highMassKg / (lowMassKg + highMassKg) * relativeVelocityDelta;
      const highVelocityDelta =
        -(lowMassKg / highMassKg) * lowVelocityDelta;
      const pairBeforeJ = 0.5 * (
        lowMassKg * lowVelocity ** 2
          + highMassKg * highVelocity ** 2
      );
      lowVelocity += lowVelocityDelta;
      highVelocity += highVelocityDelta;
      const pairAfterJ = 0.5 * (
        lowMassKg * lowVelocity ** 2
          + highMassKg * highVelocity ** 2
      );
      pairKineticDeltaJ += pairAfterJ - pairBeforeJ;
      lowPairImpulse += lowMassKg * lowVelocityDelta;
      highPairImpulse += highMassKg * highVelocityDelta;
      const wallBeforeJ = 0.5 * lowMassKg * lowVelocity ** 2;
      priorWallClipped = projectLowUpperWall && lowVelocity > 0;
      if (priorWallClipped) lowVelocity = 0;
      wallKineticDeltaJ +=
        0.5 * lowMassKg * lowVelocity ** 2 - wallBeforeJ;
      completedRounds += 1;
    }
    return {
      approachResidual: Math.max(highVelocity - lowVelocity, 0),
      completedRounds,
      highVelocity,
      lowVelocity,
      lowPairImpulse,
      highPairImpulse,
      pairKineticDeltaJ,
      wallKineticDeltaJ
    };
  };

  const oneRound = refine({ rounds: 1, projectLowUpperWall: true });
  const sixteenRounds = refine({
    rounds: SCHROEDER_SPATIAL_MECHANICAL_MATCHING_WALL_REFINEMENT_ROUNDS,
    projectLowUpperWall: true
  });
  const contraction = highMassKg / (lowMassKg + highMassKg);
  assert.equal(sixteenRounds.completedRounds, 16);
  assert.ok(
    Math.abs(
      sixteenRounds.approachResidual - contraction ** 16
    ) < 1e-12
  );
  assert.ok(
    sixteenRounds.approachResidual < oneRound.approachResidual
  );
  assert.ok(
    Math.abs(
      sixteenRounds.lowPairImpulse + sixteenRounds.highPairImpulse
    ) < 1e-18
  );
  assert.ok(sixteenRounds.pairKineticDeltaJ <= 1e-18);
  assert.ok(sixteenRounds.wallKineticDeltaJ <= 0);
  assert.ok(
    Math.abs(
      sixteenRounds.pairKineticDeltaJ
        + Math.max(0, -sixteenRounds.pairKineticDeltaJ)
    ) < 1e-18
  );
  assert.ok(
    Math.abs(
      sixteenRounds.wallKineticDeltaJ
        + Math.max(0, -sixteenRounds.wallKineticDeltaJ)
    ) < 1e-18
  );

  const ordinaryPair = refine({
    rounds: SCHROEDER_SPATIAL_MECHANICAL_MATCHING_WALL_REFINEMENT_ROUNDS,
    projectLowUpperWall: false
  });
  assert.equal(ordinaryPair.completedRounds, 1);
  assert.ok(Math.abs(ordinaryPair.lowVelocity - contraction) < 1e-12);
  assert.ok(Math.abs(ordinaryPair.highVelocity - contraction) < 1e-12);
});

test('bounded three-body weighted PAV is permutation invariant, conservative, and narrowly gated', () => {
  const centerMassKg = 3.917e-6;
  const endpointMassKg = 1.532e-4;
  const dot = (left, right) => left.reduce(
    (sum, value, axis) => sum + value * right[axis],
    0
  );
  const subtract = (left, right) => left.map(
    (value, axis) => value - right[axis]
  );
  const normalize = (value) => {
    const length = Math.hypot(...value);
    return value.map((component) => component / length);
  };
  const near = (actual, expected, tolerance, message) => {
    assert.ok(
      Math.abs(actual - expected) <= tolerance,
      `${message}: ${actual} versus ${expected}`
    );
  };
  const particlesByKey = Object.freeze({
    center: Object.freeze({
      key: 'center',
      massKg: centerMassKg,
      position: Object.freeze([0, 0, 0]),
      velocity: Object.freeze([0, -0.1, 0])
    }),
    right: Object.freeze({
      key: 'right',
      massKg: endpointMassKg,
      position: Object.freeze([0, 1, 0]),
      velocity: Object.freeze([0, -1, 0])
    }),
    left: Object.freeze({
      key: 'left',
      massKg: endpointMassKg,
      position: Object.freeze([0, -1, 0]),
      velocity: Object.freeze([0, 0.2, 0])
    })
  });
  const priorLedgerByKey = Object.freeze({
    center: Object.freeze({ x: 2e-8, y: 3e-8, z: 5e-8, w: 100 }),
    right: Object.freeze({ x: 7e-8, y: 11e-8, z: 13e-8, w: 200 }),
    left: Object.freeze({ x: 17e-8, y: 19e-8, z: 23e-8, w: 300 })
  });
  const solveReference = ({
    particles,
    centerIndex,
    primaryIndex,
    secondaryIndex,
    inboundSelectorCount = 1,
    primaryPositionResidualRatio = 0,
    primaryPositionUpdateRatio = 0,
    secondaryPositionResidualRatio = 0,
    secondaryPositionUpdateRatio = 0,
    primaryResponseAlignment = 1,
    secondaryResponseAlignment = 1,
    wallClipped = false,
    secondaryNormalOverride = null
  }) => {
    const center = particles[centerIndex];
    const primary = particles[primaryIndex];
    const secondary = particles[secondaryIndex];
    const primaryNormal = normalize(subtract(
      center.position,
      primary.position
    ));
    const secondaryNormal = secondaryNormalOverride || normalize(subtract(
      center.position,
      secondary.position
    ));
    const centerMass = center.massKg;
    const primaryMass = primary.massKg;
    const secondaryMass = secondary.massKg;
    if (
      !(centerMass > 0)
      || primaryMass / centerMass < 16
      || secondaryMass / centerMass < 16
      || inboundSelectorCount !== 1
      || dot(primaryNormal, secondaryNormal) > -1 + 1e-6
      || primaryResponseAlignment < 1 - 1e-6
      || secondaryResponseAlignment < 1 - 1e-6
      || primaryPositionResidualRatio > 0.5
      || primaryPositionUpdateRatio > 0.5
      || secondaryPositionResidualRatio > 0.5
      || secondaryPositionUpdateRatio > 0.5
      || wallClipped
    ) {
      return null;
    }
    const primaryVelocity = dot(primary.velocity, primaryNormal);
    const centerVelocity = dot(center.velocity, primaryNormal);
    const secondaryVelocity = dot(secondary.velocity, primaryNormal);
    if (
      !(primaryVelocity > centerVelocity + 1e-5)
      || !(centerVelocity > secondaryVelocity + 1e-5)
    ) {
      return null;
    }
    const totalMassKg = primaryMass + centerMass + secondaryMass;
    const commonVelocity = (
      primaryMass * primaryVelocity
      + centerMass * centerVelocity
      + secondaryMass * secondaryVelocity
    ) / totalMassKg;
    const finalVelocities = new Map();
    const kineticDeltaByKey = new Map();
    for (const particle of [primary, center, secondary]) {
      const initialNormalVelocity = dot(particle.velocity, primaryNormal);
      const finalVelocity = particle.velocity.map(
        (value, axis) => value
          + (commonVelocity - initialNormalVelocity) * primaryNormal[axis]
      );
      finalVelocities.set(particle.key, finalVelocity);
      kineticDeltaByKey.set(
        particle.key,
        0.5 * particle.massKg * (
          dot(finalVelocity, finalVelocity)
          - dot(particle.velocity, particle.velocity)
        )
      );
    }
    const aggregateKineticDeltaJ = [...kineticDeltaByKey.values()].reduce(
      (sum, value) => sum + value,
      0
    );
    const heatJ = Math.max(0, -aggregateKineticDeltaJ);
    const nextLedgerByKey = new Map();
    const nextSpecificEnergyByKey = new Map();
    for (const particle of [primary, center, secondary]) {
      const prior = priorLedgerByKey[particle.key];
      const next = {
        x: prior.x + kineticDeltaByKey.get(particle.key),
        y: prior.y + heatJ * particle.massKg / totalMassKg,
        z: prior.z,
        w: prior.w
      };
      nextLedgerByKey.set(particle.key, next);
      nextSpecificEnergyByKey.set(
        particle.key,
        next.w + (next.y + next.z) / particle.massKg
      );
    }
    return {
      primaryKey: primary.key,
      secondaryKey: secondary.key,
      commonVelocity,
      primaryImpulseKgMPerS:
        primaryMass * (primaryVelocity - commonVelocity),
      secondaryImpulseKgMPerS:
        secondaryMass * (commonVelocity - secondaryVelocity),
      aggregateKineticDeltaJ,
      heatJ,
      finalVelocities,
      kineticDeltaByKey,
      nextLedgerByKey,
      nextSpecificEnergyByKey,
      totalMassKg
    };
  };

  const permutations = [
    ['center', 'right', 'left'],
    ['center', 'left', 'right'],
    ['right', 'center', 'left'],
    ['right', 'left', 'center'],
    ['left', 'center', 'right'],
    ['left', 'right', 'center']
  ];
  const expectedWorldVelocityY = (
    centerMassKg * particlesByKey.center.velocity[1]
    + endpointMassKg * particlesByKey.right.velocity[1]
    + endpointMassKg * particlesByKey.left.velocity[1]
  ) / (centerMassKg + 2 * endpointMassKg);
  let rightPrimaryResult = null;
  for (const permutation of permutations) {
    const particles = permutation.map((key) => particlesByKey[key]);
    const centerIndex = permutation.indexOf('center');
    const endpointIndices = [
      permutation.indexOf('right'),
      permutation.indexOf('left')
    ].sort((left, right) => left - right);
    const result = solveReference({
      particles,
      centerIndex,
      primaryIndex: endpointIndices[0],
      secondaryIndex: endpointIndices[1]
    });
    assert.ok(result, permutation.join('/'));
    if (result.primaryKey === 'right') rightPrimaryResult = result;
    for (const key of ['center', 'right', 'left']) {
      const finalVelocity = result.finalVelocities.get(key);
      near(finalVelocity[0], particlesByKey[key].velocity[0], 1e-15, key);
      near(finalVelocity[1], expectedWorldVelocityY, 1e-15, key);
      near(finalVelocity[2], particlesByKey[key].velocity[2], 1e-15, key);
      const prior = priorLedgerByKey[key];
      const next = result.nextLedgerByKey.get(key);
      near(
        next.x - prior.x,
        result.kineticDeltaByKey.get(key),
        1e-18,
        `${key} kinetic ledger`
      );
      near(
        next.y - prior.y,
        result.heatJ * particlesByKey[key].massKg / result.totalMassKg,
        1e-18,
        `${key} heat ledger`
      );
      assert.equal(next.z, prior.z);
      assert.equal(next.w, prior.w);
      near(
        result.nextSpecificEnergyByKey.get(key),
        next.w + (next.y + next.z) / particlesByKey[key].massKg,
        1e-15,
        `${key} specific energy`
      );
    }
    const momentumDelta = ['center', 'right', 'left'].reduce(
      (sum, key) => sum + particlesByKey[key].massKg * (
        result.finalVelocities.get(key)[1]
        - particlesByKey[key].velocity[1]
      ),
      0
    );
    near(momentumDelta, 0, 1e-18, 'three-body momentum');
    near(
      [...result.kineticDeltaByKey.values()].reduce(
        (sum, value) => sum + value,
        0
      ) + result.heatJ,
      0,
      1e-18,
      'three-body kinetic/internal closure'
    );
  }
  assert.ok(rightPrimaryResult);
  near(
    rightPrimaryResult.commonVelocity,
    0.396213227119365,
    1e-15,
    'weighted PAV velocity'
  );
  near(
    rightPrimaryResult.primaryImpulseKgMPerS,
    9.250013360531328e-5,
    1e-18,
    'primary impulse'
  );
  near(
    rightPrimaryResult.secondaryImpulseKgMPerS,
    9.133986639468673e-5,
    1e-18,
    'secondary impulse'
  );
  near(
    rightPrimaryResult.aggregateKineticDeltaJ,
    -5.532604008159398e-5,
    1e-18,
    'aggregate kinetic delta'
  );

  const canonicalParticles = [
    particlesByKey.center,
    particlesByKey.right,
    particlesByKey.left
  ];
  const canonical = {
    particles: canonicalParticles,
    centerIndex: 0,
    primaryIndex: 1,
    secondaryIndex: 2
  };
  const withParticle = (index, patch) => canonicalParticles.map(
    (particle, particleIndex) => particleIndex === index
      ? { ...particle, ...patch }
      : particle
  );
  assert.equal(solveReference({
    ...canonical,
    particles: withParticle(1, { massKg: 15.999 * centerMassKg })
  }), null);
  assert.equal(solveReference({
    ...canonical,
    inboundSelectorCount: 0
  }), null);
  assert.equal(solveReference({
    ...canonical,
    inboundSelectorCount: 2
  }), null);
  assert.equal(solveReference({
    ...canonical,
    secondaryNormalOverride: [0, -1, 0]
  }), null);
  assert.equal(solveReference({
    ...canonical,
    primaryResponseAlignment: 0.99
  }), null);
  assert.equal(solveReference({
    ...canonical,
    primaryPositionResidualRatio: 0.500001
  }), null);
  assert.equal(solveReference({
    ...canonical,
    secondaryPositionUpdateRatio: 0.500001
  }), null);
  assert.equal(solveReference({
    ...canonical,
    wallClipped: true
  }), null);
  assert.equal(solveReference({
    ...canonical,
    particles: withParticle(1, {
      velocity: [0, -(0.1 + 1e-5), 0]
    })
  }), null);
  assert.equal(solveReference({
    ...canonical,
    particles: withParticle(2, {
      velocity: [0, -(0.1 - 1e-5), 0]
    })
  }), null);
});

test('bounded three-body 2x2 contact projection couples non-collinear faces exactly', () => {
  const dot = (left, right) => left.reduce(
    (sum, value, axis) => sum + value * right[axis],
    0
  );
  const add = (left, right) => left.map(
    (value, axis) => value + right[axis]
  );
  const subtract = (left, right) => left.map(
    (value, axis) => value - right[axis]
  );
  const scale = (value, factor) => value.map(
    (component) => component * factor
  );
  const nearVector = (actual, expected, tolerance, message) => {
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(
        Math.abs(actual[axis] - expected[axis]) <= tolerance,
        `${message}[${axis}]: ${actual[axis]} versus ${expected[axis]}`
      );
    }
  };
  const center = {
    key: 'center',
    massKg: 1,
    velocity: [0, 0, 0]
  };
  const primary = {
    key: 'primary',
    massKg: 32,
    normal: [-1, 0, 0],
    velocity: [-1, 0, 0]
  };
  const secondaryNormal = [0, -1, 0];
  const secondary = {
    key: 'secondary',
    massKg: 48,
    normal: secondaryNormal,
    velocity: scale(secondaryNormal, 0.5)
  };
  for (const endpoint of [primary, secondary]) {
    assert.ok(
      endpoint.massKg >= 16 * center.massKg,
      'manufactured block satisfies the production endpoint-mass gate'
    );
    assert.equal(
      endpoint.normal.reduce(
        (sum, component) => sum + Math.abs(component),
        0
      ),
      1,
      'manufactured contact uses a production-reachable axis face normal'
    );
  }
  assert.equal(dot(primary.normal, secondary.normal), 0);
  const solve = (first, second) => {
    const centerInverseMass = 1 / center.massKg;
    const firstInverseMass = 1 / first.massKg;
    const secondInverseMass = 1 / second.massKg;
    const firstResidual = dot(
      subtract(center.velocity, first.velocity),
      first.normal
    );
    const secondResidual = dot(
      subtract(center.velocity, second.velocity),
      second.normal
    );
    assert.ok(firstResidual < -1e-5);
    assert.ok(secondResidual < -1e-5);
    const effectiveFirstMass = centerInverseMass + firstInverseMass;
    const effectiveSecondMass = centerInverseMass + secondInverseMass;
    const effectiveCrossMass =
      centerInverseMass * dot(first.normal, second.normal);
    const determinant =
      effectiveFirstMass * effectiveSecondMass
        - effectiveCrossMass * effectiveCrossMass;
    assert.ok(determinant > 0);
    const firstLambda = (
      -firstResidual * effectiveSecondMass
        + effectiveCrossMass * secondResidual
    ) / determinant;
    const secondLambda = (
      -secondResidual * effectiveFirstMass
        + effectiveCrossMass * firstResidual
    ) / determinant;
    assert.ok(firstLambda > 0);
    assert.ok(secondLambda > 0);
    const centerVelocity = add(
      center.velocity,
      scale(
        add(
          scale(first.normal, firstLambda),
          scale(second.normal, secondLambda)
        ),
        centerInverseMass
      )
    );
    const firstVelocity = add(
      first.velocity,
      scale(first.normal, -firstLambda * firstInverseMass)
    );
    const secondVelocity = add(
      second.velocity,
      scale(second.normal, -secondLambda * secondInverseMass)
    );
    return {
      velocities: new Map([
        [center.key, centerVelocity],
        [first.key, firstVelocity],
        [second.key, secondVelocity]
      ]),
      firstResidual: dot(
        subtract(centerVelocity, firstVelocity),
        first.normal
      ),
      secondResidual: dot(
        subtract(centerVelocity, secondVelocity),
        second.normal
      )
    };
  };
  const forward = solve(primary, secondary);
  const reversed = solve(secondary, primary);
  nearVector(
    forward.velocities.get('center'),
    reversed.velocities.get('center'),
    1e-12,
    'center permutation'
  );
  nearVector(
    forward.velocities.get('primary'),
    reversed.velocities.get('primary'),
    1e-12,
    'primary permutation'
  );
  nearVector(
    forward.velocities.get('secondary'),
    reversed.velocities.get('secondary'),
    1e-12,
    'secondary permutation'
  );
  const particleIndexLayouts = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0]
  ];
  for (const [
    centerIndex,
    primaryIndex,
    secondaryIndex
  ] of particleIndexLayouts) {
    assert.equal(
      new Set([centerIndex, primaryIndex, secondaryIndex]).size,
      3
    );
    const endpoints = [
      { ...primary, particleIndex: primaryIndex },
      { ...secondary, particleIndex: secondaryIndex }
    ].sort((left, right) => left.particleIndex - right.particleIndex);
    const layoutResult = solve(endpoints[0], endpoints[1]);
    for (const particle of [center, primary, secondary]) {
      nearVector(
        layoutResult.velocities.get(particle.key),
        forward.velocities.get(particle.key),
        1e-12,
        `${particle.key} index layout ${centerIndex}/${primaryIndex}/${secondaryIndex}`
      );
    }
  }
  assert.ok(Math.abs(forward.firstResidual) <= 1e-12);
  assert.ok(Math.abs(forward.secondResidual) <= 1e-12);
  const initialMomentum = [center, primary, secondary].reduce(
    (sum, particle) => add(
      sum,
      scale(particle.velocity, particle.massKg)
    ),
    [0, 0, 0]
  );
  const finalMomentum = [center, primary, secondary].reduce(
    (sum, particle) => add(
      sum,
      scale(
        forward.velocities.get(particle.key),
        particle.massKg
      )
    ),
    [0, 0, 0]
  );
  nearVector(finalMomentum, initialMomentum, 1e-12, 'block momentum');
  const kineticEnergy = (velocities) => [center, primary, secondary].reduce(
    (sum, particle) => {
      const velocity = velocities.get(particle.key);
      return sum + 0.5 * particle.massKg * dot(velocity, velocity);
    },
    0
  );
  const initialVelocities = new Map([
    [center.key, center.velocity],
    [primary.key, primary.velocity],
    [secondary.key, secondary.velocity]
  ]);
  assert.ok(
    kineticEnergy(forward.velocities) <= kineticEnergy(initialVelocities)
  );
});

test('bounded four-body star projection is feasible, conservative, and leaf-permutation stable', () => {
  const f32 = Math.fround;
  const add = (left, right) => f32(f32(left) + f32(right));
  const multiply = (left, right) => f32(f32(left) * f32(right));
  const solveAxis = ({ massesKg, initialU, contactSigns }) => {
    let best = null;
    for (let contactMask = 0; contactMask < 8; contactMask += 1) {
      const active = [1, 2, 4].map(
        (bit) => (contactMask & bit) !== 0
      );
      const present = contactSigns.map((value) => Math.abs(value) > 0.5);
      if (active.some((value, index) => value && !present[index])) {
        continue;
      }
      let pooledMassKg = massesKg[1];
      let pooledMomentum = multiply(massesKg[1], initialU[1]);
      for (const [activeIndex, slot] of [[0, 0], [1, 2], [2, 3]]) {
        if (!active[activeIndex]) continue;
        pooledMassKg = add(pooledMassKg, massesKg[slot]);
        pooledMomentum = add(
          pooledMomentum,
          multiply(massesKg[slot], initialU[slot])
        );
      }
      const sharedU = f32(pooledMomentum / pooledMassKg);
      const candidateU = initialU.slice();
      candidateU[1] = sharedU;
      if (active[0]) candidateU[0] = sharedU;
      if (active[1]) candidateU[2] = sharedU;
      if (active[2]) candidateU[3] = sharedU;
      const residuals = [0, 2, 3].map(
        (slot, index) => f32(
          contactSigns[index] * f32(candidateU[1] - candidateU[slot])
        )
      );
      if (residuals.some(
        (value, index) => present[index] && value < -1e-5
      )) {
        continue;
      }
      let objective = f32(0);
      for (let slot = 0; slot < 4; slot += 1) {
        const delta = f32(candidateU[slot] - initialU[slot]);
        objective = add(
          objective,
          multiply(massesKg[slot], multiply(delta, delta))
        );
      }
      if (!best || objective < best.objective) {
        best = { candidateU, contactMask, objective, residuals };
      }
    }
    return best;
  };
  const canonicalMasses = [32, 1, 48, 24].map(f32);
  const canonicalInitial = [1, -2, -3, 0.5].map(f32);
  const canonicalSigns = [1, -1, 1].map(f32);
  const canonical = solveAxis({
    massesKg: canonicalMasses,
    initialU: canonicalInitial,
    contactSigns: canonicalSigns
  });
  assert.ok(canonical);
  assert.equal(canonical.contactMask, 7);
  assert.ok(canonical.residuals.every((value) => value >= -1e-5));
  assert.equal(new Set(canonical.candidateU).size, 1);
  const permutations = [
    [0, 2, 3],
    [0, 3, 2],
    [2, 0, 3],
    [2, 3, 0],
    [3, 0, 2],
    [3, 2, 0]
  ];
  const signByCanonicalSlot = new Map([[0, 1], [2, -1], [3, 1]]);
  for (const permutation of permutations) {
    const slots = [permutation[0], 1, permutation[1], permutation[2]];
    const result = solveAxis({
      massesKg: slots.map((slot) => canonicalMasses[slot]),
      initialU: slots.map((slot) => canonicalInitial[slot]),
      contactSigns: permutation.map(
        (slot) => f32(signByCanonicalSlot.get(slot))
      )
    });
    assert.ok(result, permutation.join('/'));
    const restored = new Array(4);
    slots.forEach((slot, index) => { restored[slot] = result.candidateU[index]; });
    for (let slot = 0; slot < 4; slot += 1) {
      assert.ok(
        Math.abs(restored[slot] - canonical.candidateU[slot]) <= 2e-6,
        `${permutation.join('/')} slot ${slot}`
      );
    }
    const initialMomentum = canonicalMasses.reduce(
      (sum, mass, slot) => sum + mass * canonicalInitial[slot],
      0
    );
    const finalMomentum = canonicalMasses.reduce(
      (sum, mass, slot) => sum + mass * restored[slot],
      0
    );
    assert.ok(Math.abs(finalMomentum - initialMomentum) <= 2e-5);
    const initialEnergy = canonicalMasses.reduce(
      (sum, mass, slot) => sum + 0.5 * mass * canonicalInitial[slot] ** 2,
      0
    );
    const finalEnergy = canonicalMasses.reduce(
      (sum, mass, slot) => sum + 0.5 * mass * restored[slot] ** 2,
      0
    );
    assert.ok(finalEnergy <= initialEnergy + 2e-5);
  }
});

test('bounded four-body path projection is exact, conservative, and reversal stable', () => {
  const f32 = Math.fround;
  const solveAxis = ({ massesKg, initialU, edgeSigns }) => {
    let best = null;
    for (let contactMask = 0; contactMask < 8; contactMask += 1) {
      const active = [1, 2, 4].map(
        (bit) => (contactMask & bit) !== 0
      );
      const present = edgeSigns.map((value) => Math.abs(value) > 0.5);
      if (active.some((value, index) => value && !present[index])) {
        continue;
      }
      const candidateU = initialU.slice();
      const pool = (slots) => {
        const mass = slots.reduce(
          (sum, slot) => f32(sum + massesKg[slot]),
          f32(0)
        );
        const momentum = slots.reduce(
          (sum, slot) => f32(
            sum + f32(massesKg[slot] * initialU[slot])
          ),
          f32(0)
        );
        const sharedU = f32(momentum / mass);
        for (const slot of slots) candidateU[slot] = sharedU;
      };
      if (contactMask === 1 || contactMask === 5) pool([0, 1]);
      if (contactMask === 2) pool([1, 2]);
      if (contactMask === 4 || contactMask === 5) pool([2, 3]);
      if (contactMask === 3) pool([0, 1, 2]);
      if (contactMask === 6) pool([1, 2, 3]);
      if (contactMask === 7) pool([0, 1, 2, 3]);
      const residuals = [
        f32(edgeSigns[0] * f32(candidateU[1] - candidateU[0])),
        f32(edgeSigns[1] * f32(candidateU[1] - candidateU[2])),
        f32(edgeSigns[2] * f32(candidateU[2] - candidateU[3]))
      ];
      if (residuals.some(
        (value, index) => present[index] && value < -1e-5
      )) {
        continue;
      }
      const objective = candidateU.reduce((sum, value, slot) => {
        const delta = f32(value - initialU[slot]);
        return f32(sum + f32(massesKg[slot] * f32(delta * delta)));
      }, f32(0));
      if (!best || objective < best.objective) {
        best = { candidateU, contactMask, objective, residuals };
      }
    }
    return best;
  };
  const massesKg = [32, 1, 48, 24].map(f32);
  const initialU = [2, 0, 0, 1].map(f32);
  const edgeSigns = [1, 1, 1].map(f32);
  const forward = solveAxis({ massesKg, initialU, edgeSigns });
  assert.ok(forward);
  assert.equal(forward.contactMask, 5);
  assert.equal(forward.candidateU[0], forward.candidateU[1]);
  assert.equal(forward.candidateU[2], forward.candidateU[3]);
  assert.ok(forward.candidateU[1] > forward.candidateU[2]);
  const reversed = solveAxis({
    massesKg: massesKg.toReversed(),
    initialU: initialU.toReversed(),
    edgeSigns: [edgeSigns[2], -edgeSigns[1], edgeSigns[0]].map(f32)
  });
  assert.ok(reversed);
  assert.deepEqual(
    reversed.candidateU.toReversed(),
    forward.candidateU
  );
  const momentum = (velocity) => massesKg.reduce(
    (sum, massKg, slot) => sum + massKg * velocity[slot],
    0
  );
  const kineticEnergy = (velocity) => massesKg.reduce(
    (sum, massKg, slot) => sum + 0.5 * massKg * velocity[slot] ** 2,
    0
  );
  assert.ok(Math.abs(
    momentum(forward.candidateU) - momentum(initialU)
  ) <= 2e-5);
  assert.ok(
    kineticEnergy(forward.candidateU) <= kineticEnergy(initialU) + 2e-5
  );
  const fullyCoupled = solveAxis({
    massesKg,
    initialU: [1, -2, -3, 0.5].map(f32),
    edgeSigns: [1, -1, 1].map(f32)
  });
  assert.ok(fullyCoupled);
  assert.equal(fullyCoupled.contactMask, 7);
  assert.equal(new Set(fullyCoupled.candidateU).size, 1);
});

test('opposing-axis wall active set removes the heavy-light alternating mode exactly', () => {
  const massesKg = [32, 1, 48];
  const initialU = [1, -2, -3];
  const geometryWallActive = [true, false, false];
  const inwardScalarSigns = [1, 0, 0];
  const tolerance = 1e-12;
  const nearArray = (actual, expected, message) => {
    assert.equal(actual.length, expected.length, `${message} length`);
    for (let index = 0; index < expected.length; index += 1) {
      assert.ok(
        Math.abs(actual[index] - expected[index]) <= tolerance,
        `${message}[${index}]: expected ${expected[index]}, got ${actual[index]}`
      );
    }
  };
  let best = null;
  for (let wallMask = 0; wallMask < 8; wallMask += 1) {
    const wallFixed = [1, 2, 4].map((bit) => (wallMask & bit) !== 0);
    if (wallFixed.some(
      (fixed, index) => fixed && !geometryWallActive[index]
    )) {
      continue;
    }
    const q = initialU.map((value, index) => (
      wallFixed[index] ? 0 : value
    ));
    const inverseMass = massesKg.map((massKg, index) => (
      wallFixed[index] ? 0 : 1 / massKg
    ));
    const residual = [q[1] - q[0], q[2] - q[1]];
    const matrix11 = inverseMass[0] + inverseMass[1];
    const matrix22 = inverseMass[1] + inverseMass[2];
    const matrix12 = -inverseMass[1];
    for (let contactMask = 0; contactMask < 4; contactMask += 1) {
      const contactActive = [
        (contactMask & 1) !== 0,
        (contactMask & 2) !== 0
      ];
      let lambda = [0, 0];
      if (contactActive[0] && contactActive[1]) {
        const determinant =
          matrix11 * matrix22 - matrix12 * matrix12;
        if (determinant > tolerance) {
          lambda = [
            (-residual[0] * matrix22 + matrix12 * residual[1])
              / determinant,
            (-matrix11 * residual[1] + matrix12 * residual[0])
              / determinant
          ];
        } else if (residual.some((value) => Math.abs(value) > tolerance)) {
          continue;
        }
      } else if (contactActive[0]) {
        if (matrix11 > tolerance) {
          lambda[0] = -residual[0] / matrix11;
        } else if (Math.abs(residual[0]) > tolerance) {
          continue;
        }
      } else if (contactActive[1]) {
        if (matrix22 > tolerance) {
          lambda[1] = -residual[1] / matrix22;
        } else if (Math.abs(residual[1]) > tolerance) {
          continue;
        }
      }
      if (lambda.some((value) => value < -tolerance)) continue;
      lambda = lambda.map((value) => Math.max(0, value));
      const pairImpulse = [
        -lambda[0],
        lambda[0] - lambda[1],
        lambda[1]
      ];
      const candidateU = q.map(
        (value, index) => value + inverseMass[index] * pairImpulse[index]
      );
      const candidateResidual = [
        candidateU[1] - candidateU[0],
        candidateU[2] - candidateU[1]
      ];
      if (candidateResidual.some((value, index) => (
        contactActive[index]
          ? Math.abs(value) > tolerance
          : value < -tolerance
      ))) {
        continue;
      }
      const wallImpulse = candidateU.map((value, index) => (
        massesKg[index] * (value - initialU[index]) - pairImpulse[index]
      ));
      const wallFeasible = candidateU.every((value, index) => (
        wallFixed[index]
          ? Math.abs(value) <= tolerance
            && inwardScalarSigns[index] * wallImpulse[index] >= -tolerance
          : Math.abs(wallImpulse[index]) <= tolerance
            && (
              !geometryWallActive[index]
              || inwardScalarSigns[index] * value >= -tolerance
            )
      ));
      if (!wallFeasible) continue;
      const objective = candidateU.reduce(
        (sum, value, index) => sum
          + massesKg[index] * (value - initialU[index]) ** 2,
        0
      );
      if (!best || objective < best.objective) {
        best = {
          wallMask,
          contactMask,
          lambda,
          pairImpulse,
          wallImpulse,
          candidateU,
          objective
        };
      }
    }
  }
  assert.ok(best);
  assert.equal(best.wallMask, 1, 'only the lower primary is wall-fixed');
  assert.equal(best.contactMask, 3, 'both opposing contacts are active');
  nearArray(best.candidateU, [0, 0, 0], 'joint velocity');
  nearArray(best.lambda, [146, 144], 'joint lambda');
  nearArray(best.pairImpulse, [-146, 2, 144], 'pair impulse');
  nearArray(best.wallImpulse, [114, 0, 0], 'wall impulse');
  assert.equal(
    best.pairImpulse.reduce((sum, value) => sum + value, 0),
    0,
    'pair impulses preserve internal momentum'
  );
  const oldMidpointPairWorkJ = best.pairImpulse.reduce(
    (sum, impulse, index) => sum
      + 0.5 * impulse * (initialU[index] + best.candidateU[index]),
    0
  );
  const oldMidpointWallWorkJ = best.wallImpulse.reduce(
    (sum, impulse, index) => sum
      + 0.5 * impulse * (initialU[index] + best.candidateU[index]),
    0
  );
  assert.ok(Math.abs(oldMidpointPairWorkJ - (-291)) <= tolerance);
  assert.ok(
    Math.abs(oldMidpointWallWorkJ - 57) <= tolerance,
    'simultaneous midpoint impulse splitting falsely assigns active wall gain'
  );
  const aggregateMassKg = massesKg.reduce((sum, value) => sum + value, 0);
  const contactOnlyU = initialU.reduce(
    (sum, value, index) => sum + massesKg[index] * value,
    0
  ) / aggregateMassKg;
  const pairKineticDeltaJ = initialU.reduce(
    (sum, value, index) => sum + 0.5 * massesKg[index] * (
      contactOnlyU ** 2 - value ** 2
    ),
    0
  );
  const wallKineticDeltaJ = best.candidateU.reduce(
    (sum, value, index) => sum + 0.5 * massesKg[index] * (
      value ** 2 - contactOnlyU ** 2
    ),
    0
  );
  const kineticDeltaJ = best.candidateU.reduce(
    (sum, value, index) => sum + 0.5 * massesKg[index] * (
      value ** 2 - initialU[index] ** 2
    ),
    0
  );
  assert.ok(Math.abs(contactOnlyU - (-114 / 81)) <= tolerance);
  assert.ok(Math.abs(pairKineticDeltaJ - (-153.77777777777777)) <= tolerance);
  assert.ok(Math.abs(wallKineticDeltaJ - (-80.22222222222223)) <= tolerance);
  assert.ok(Math.abs(kineticDeltaJ - (-234)) <= tolerance);
  assert.ok(
    Math.abs(
      kineticDeltaJ - pairKineticDeltaJ - wallKineticDeltaJ
    ) <= tolerance
  );
});

test('axis-separable box active set resolves orthogonal, same-sign, and tangential wall blocks', () => {
  const tolerance = 1e-10;
  const massesKg = [32, 1, 48];
  const nearArray = (actual, expected, message) => {
    assert.equal(actual.length, expected.length, `${message} length`);
    for (let index = 0; index < expected.length; index += 1) {
      assert.ok(
        Math.abs(actual[index] - expected[index]) <= tolerance,
        `${message}[${index}]: expected ${expected[index]}, got ${actual[index]}`
      );
    }
  };
  const solveAxis = ({
    initialU,
    contactSigns,
    geometryWallActive,
    inwardWallSigns
  }) => {
    let best = null;
    for (let wallMask = 0; wallMask < 8; wallMask += 1) {
      const wallFixed = [1, 2, 4].map(
        (bit) => (wallMask & bit) !== 0
      );
      if (wallFixed.some(
        (fixed, index) => fixed && !geometryWallActive[index]
      )) {
        continue;
      }
      const q = initialU.map((value, index) => (
        wallFixed[index] ? 0 : value
      ));
      const inverseMass = massesKg.map((massKg, index) => (
        wallFixed[index] ? 0 : 1 / massKg
      ));
      const residual = [
        contactSigns[0] * (q[1] - q[0]),
        contactSigns[1] * (q[1] - q[2])
      ];
      const matrix11 = inverseMass[0] + inverseMass[1];
      const matrix22 = inverseMass[1] + inverseMass[2];
      const matrix12 =
        contactSigns[0] * contactSigns[1] * inverseMass[1];
      for (let contactMask = 0; contactMask < 4; contactMask += 1) {
        const contactActive = [
          (contactMask & 1) !== 0,
          (contactMask & 2) !== 0
        ];
        if (contactActive.some(
          (active, index) => active && contactSigns[index] === 0
        )) {
          continue;
        }
        let lambda = [0, 0];
        if (contactActive[0] && contactActive[1]) {
          const determinant =
            matrix11 * matrix22 - matrix12 * matrix12;
          if (determinant > tolerance) {
            lambda = [
              (-residual[0] * matrix22 + matrix12 * residual[1])
                / determinant,
              (-matrix11 * residual[1] + matrix12 * residual[0])
                / determinant
            ];
          } else if (residual.some(
            (value) => Math.abs(value) > tolerance
          )) {
            continue;
          }
        } else if (contactActive[0]) {
          if (matrix11 > tolerance) {
            lambda[0] = -residual[0] / matrix11;
          } else if (Math.abs(residual[0]) > tolerance) {
            continue;
          }
        } else if (contactActive[1]) {
          if (matrix22 > tolerance) {
            lambda[1] = -residual[1] / matrix22;
          } else if (Math.abs(residual[1]) > tolerance) {
            continue;
          }
        }
        if (lambda.some((value) => value < -tolerance)) continue;
        lambda = lambda.map((value) => Math.max(0, value));
        const pairImpulse = [
          -contactSigns[0] * lambda[0],
          contactSigns[0] * lambda[0]
            + contactSigns[1] * lambda[1],
          -contactSigns[1] * lambda[1]
        ];
        const candidateU = q.map(
          (value, index) => value + inverseMass[index] * pairImpulse[index]
        );
        const candidateResidual = [
          contactSigns[0] * (candidateU[1] - candidateU[0]),
          contactSigns[1] * (candidateU[1] - candidateU[2])
        ];
        if (candidateResidual.some((value, index) => (
          contactSigns[index] !== 0
          && (
            contactActive[index]
              ? Math.abs(value) > tolerance
              : value < -tolerance
          )
        ))) {
          continue;
        }
        const wallImpulse = candidateU.map((value, index) => (
          massesKg[index] * (value - initialU[index]) - pairImpulse[index]
        ));
        if (!candidateU.every((value, index) => (
          wallFixed[index]
            ? Math.abs(value) <= tolerance
              && inwardWallSigns[index] * wallImpulse[index] >= -tolerance
            : Math.abs(wallImpulse[index]) <= tolerance
              && (
                !geometryWallActive[index]
                || inwardWallSigns[index] * value >= -tolerance
              )
        ))) {
          continue;
        }
        const objective = candidateU.reduce(
          (sum, value, index) => sum
            + massesKg[index] * (value - initialU[index]) ** 2,
          0
        );
        if (!best || objective < best.objective) {
          best = {
            wallMask,
            contactMask,
            lambda,
            pairImpulse,
            wallImpulse,
            candidateU,
            objective
          };
        }
      }
    }
    assert.ok(best, 'one certified scalar active set must exist');
    return best;
  };

  const orthogonalX = solveAxis({
    initialU: [1, -2, 0],
    contactSigns: [1, 0],
    geometryWallActive: [true, false, false],
    inwardWallSigns: [-1, 0, 0]
  });
  nearArray(orthogonalX.candidateU, [0, 0, 0], 'orthogonal x');
  nearArray(orthogonalX.lambda, [2, 0], 'orthogonal x lambda');
  nearArray(orthogonalX.wallImpulse, [-30, 0, 0], 'orthogonal x wall');

  const orthogonalY = solveAxis({
    initialU: [0, -3, 1],
    contactSigns: [0, 1],
    geometryWallActive: [false, false, true],
    inwardWallSigns: [0, 0, -1]
  });
  nearArray(orthogonalY.candidateU, [0, 0, 0], 'orthogonal y');
  nearArray(orthogonalY.lambda, [0, 3], 'orthogonal y lambda');
  nearArray(orthogonalY.wallImpulse, [0, 0, -45], 'orthogonal y wall');

  const sameDirection = solveAxis({
    initialU: [1, -2, 1],
    contactSigns: [1, 1],
    geometryWallActive: [true, false, false],
    inwardWallSigns: [-1, 0, 0]
  });
  nearArray(
    sameDirection.candidateU,
    [0, 46 / 49, 46 / 49],
    'same-direction release'
  );
  nearArray(
    sameDirection.lambda,
    [0, 144 / 49],
    'same-direction lambda'
  );
  nearArray(
    sameDirection.wallImpulse,
    [-32, 0, 0],
    'same-direction wall'
  );

  const opposingContact = solveAxis({
    initialU: [1, -2, -3],
    contactSigns: [1, -1],
    geometryWallActive: [false, false, false],
    inwardWallSigns: [0, 0, 0]
  });
  nearArray(
    opposingContact.candidateU,
    [-38 / 27, -38 / 27, -38 / 27],
    'opposing contact lane'
  );
  const tangentialWall = solveAxis({
    initialU: [2, 0, 0],
    contactSigns: [0, 0],
    geometryWallActive: [true, false, false],
    inwardWallSigns: [-1, 0, 0]
  });
  nearArray(tangentialWall.candidateU, [0, 0, 0], 'tangential wall');
  nearArray(tangentialWall.wallImpulse, [-64, 0, 0], 'tangential impulse');
  assert.ok(
    Math.abs(
      0.5 * massesKg[0] * (
        tangentialWall.candidateU[0] ** 2 - 2 ** 2
      ) - (-64)
    ) <= tolerance
  );
});

test('f32 three-block primal broadcasts active components under the public residual tolerance', () => {
  const f32 = Math.fround;
  const add = (left, right) => f32(f32(left) + f32(right));
  const multiply = (left, right) => f32(f32(left) * f32(right));
  const divide = (left, right) => f32(f32(left) / f32(right));
  const massesKg = [
    1.3965959624e-6,
    1.5776516094e-8,
    1.2773078879e-6
  ].map(f32);
  const initialU = [
    1.2526974678,
    2.8563659191,
    3.8162369728
  ].map(f32);
  const weightedAverage = (indices) => {
    let momentum = f32(0);
    let mass = f32(0);
    for (const index of indices) {
      momentum = add(momentum, multiply(massesKg[index], initialU[index]));
      mass = add(mass, massesKg[index]);
    }
    return divide(momentum, mass);
  };
  const componentPrimal = ({ wallMask, contactMask }) => {
    const wallFixed = [1, 2, 4].map((bit) => (wallMask & bit) !== 0);
    const primaryActive = (contactMask & 1) !== 0;
    const secondaryActive = (contactMask & 2) !== 0;
    if (primaryActive && secondaryActive) {
      const sharedU = wallFixed.some(Boolean)
        ? f32(0)
        : weightedAverage([0, 1, 2]);
      return [sharedU, sharedU, sharedU];
    }
    if (primaryActive) {
      const sharedU = wallFixed[0] || wallFixed[1]
        ? f32(0)
        : weightedAverage([0, 1]);
      return [
        sharedU,
        sharedU,
        wallFixed[2] ? f32(0) : initialU[2]
      ];
    }
    if (secondaryActive) {
      const sharedU = wallFixed[1] || wallFixed[2]
        ? f32(0)
        : weightedAverage([1, 2]);
      return [
        wallFixed[0] ? f32(0) : initialU[0],
        sharedU,
        sharedU
      ];
    }
    return initialU.map((value, index) => (
      wallFixed[index] ? f32(0) : value
    ));
  };
  const f32Bits = (value) => new Uint32Array(
    new Float32Array([value]).buffer
  )[0];
  const kineticEnergy = (velocity) => velocity.reduce(
    (sum, value, index) => sum
      + 0.5 * massesKg[index] * value * value,
    0
  );
  const initialKineticEnergy = kineticEnergy(initialU);
  for (let wallMask = 0; wallMask < 8; wallMask += 1) {
    for (let contactMask = 0; contactMask < 4; contactMask += 1) {
      const candidateU = componentPrimal({ wallMask, contactMask });
      if ((contactMask & 1) !== 0) {
        assert.equal(
          f32Bits(candidateU[0]),
          f32Bits(candidateU[1]),
          `primary equality for wall=${wallMask} contact=${contactMask}`
        );
      }
      if ((contactMask & 2) !== 0) {
        assert.equal(
          f32Bits(candidateU[1]),
          f32Bits(candidateU[2]),
          `secondary equality for wall=${wallMask} contact=${contactMask}`
        );
      }
      for (let index = 0; index < 3; index += 1) {
        if ((wallMask & (1 << index)) !== 0) {
          assert.equal(
            f32Bits(candidateU[index]),
            0,
            `wall equality for wall=${wallMask} contact=${contactMask}`
          );
        }
      }
      assert.ok(
        kineticEnergy(candidateU) <= initialKineticEnergy + 1e-12,
        `mass-metric projection cannot add energy for ${wallMask}:${contactMask}`
      );
      if (wallMask === 0) {
        const initialMomentum = initialU.reduce(
          (sum, value, index) => sum + massesKg[index] * value,
          0
        );
        const finalMomentum = candidateU.reduce(
          (sum, value, index) => sum + massesKg[index] * value,
          0
        );
        assert.ok(
          Math.abs(finalMomentum - initialMomentum) <= 2e-12,
          `internal momentum closes for contact mask ${contactMask}`
        );
      }
    }
  }

  // A marked support may be exactly satisfied before the mutual primary is
  // applied and still belong to the coupled active set. This is the minimal
  // A-B/B-C cycle that the reservation path must assemble.
  {
    const cycleMassesKg = [32, 1, 48];
    const cycleU = [1, 0, 0];
    const primaryResidual = cycleU[1] - cycleU[0];
    const secondaryResidual = -(cycleU[1] - cycleU[2]);
    const matrix11 = 1 / cycleMassesKg[0] + 1 / cycleMassesKg[1];
    const matrix22 = 1 / cycleMassesKg[1] + 1 / cycleMassesKg[2];
    const matrix12 = -1 / cycleMassesKg[1];
    const determinant = matrix11 * matrix22 - matrix12 * matrix12;
    const primaryLambda = (
      -primaryResidual * matrix22
        + matrix12 * secondaryResidual
    ) / determinant;
    const secondaryLambda = (
      -matrix11 * secondaryResidual
        + matrix12 * primaryResidual
    ) / determinant;
    assert.equal(primaryResidual, -1);
    assert.ok(secondaryResidual === 0);
    assert.ok(primaryLambda > 0);
    assert.ok(secondaryLambda > 0);
    const sharedU = cycleMassesKg[0]
      / cycleMassesKg.reduce((sum, massKg) => sum + massKg, 0);
    assert.ok(Math.abs(sharedU - 32 / 81) <= Number.EPSILON);
  }

  // The former inverse-mass reconstruction admitted this concrete f32 result
  // under its conditioning envelope even though the public verifier rejects
  // the primary residual. One shared scalar removes that discrepancy exactly.
  const inverseMassPrimal = [
    f32(2.479506015777588),
    f32(2.4795167446136475),
    f32(2.479511022567749)
  ];
  assert.ok(
    Math.abs(f32(inverseMassPrimal[1] - inverseMassPrimal[0]))
      > SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
  );
  const broadcastPrimal = componentPrimal({
    wallMask: 0,
    contactMask: 3
  });
  assert.equal(f32Bits(broadcastPrimal[0]), 1075753028);
  assert.equal(f32Bits(broadcastPrimal[0]), f32Bits(broadcastPrimal[1]));
  assert.equal(f32Bits(broadcastPrimal[1]), f32Bits(broadcastPrimal[2]));
});

test('f32 block momentum accepts finite unequal-mass cancellation within the unit-conditioned pair floor', () => {
  const f32 = Math.fround;
  const add = (left, right) => f32(f32(left) + f32(right));
  const multiply = (left, right) => f32(f32(left) * f32(right));
  const divide = (left, right) => f32(f32(left) / f32(right));
  const massesKg = [100_000, 3, 100_000].map(f32);
  const initialU = [
    -7.499714684e-6,
    -3.801381899e-5,
    -7.499714684e-6
  ].map(f32);
  const initialMomentum = add(
    add(
      multiply(massesKg[0], initialU[0]),
      multiply(massesKg[1], initialU[1])
    ),
    multiply(massesKg[2], initialU[2])
  );
  const aggregateMassKg = add(add(massesKg[0], massesKg[1]), massesKg[2]);
  const pooledU = divide(initialMomentum, aggregateMassKg);
  const impulses = initialU.map((velocity, index) => multiply(
    massesKg[index],
    f32(pooledU - velocity)
  ));
  const momentumResidual = add(add(impulses[0], impulses[1]), impulses[2]);
  const momentumConditioning = add(
    add(Math.abs(impulses[0]), Math.abs(impulses[1])),
    Math.abs(impulses[2])
  );
  const formerConditioningTolerance = multiply(
    multiply(256, 1.1920929e-7),
    Math.max(momentumConditioning, f32(1e-6))
  );
  const unitConditionedTolerance = multiply(
    multiply(256, 1.1920929e-7),
    Math.max(momentumConditioning, f32(1))
  );

  assert.equal(pooledU, f32(-7.500172615e-6));
  assert.equal(momentumResidual, f32(-4.518369678e-8));
  assert.ok(
    Math.abs(momentumResidual) > formerConditioningTolerance,
    'the former conditioning-only tolerance rejects finite f32 cancellation'
  );
  assert.ok(
    Math.abs(momentumResidual) <= unitConditionedTolerance,
    'the established unit-conditioned pair floor contains f32 cancellation'
  );
  assert.ok(
    Math.abs(momentumResidual) <= 2e-5,
    'the accepted cancellation remains inside the public momentum receipt bound'
  );

  const boostedMassesKg = [55.84, 7.336, 55.84].map(f32);
  const boostedInput = [
    [1.0848989486694336, -4.0488972663879395],
    [1.0797810554504395, -4.029797077178955],
    [1.0848989486694336, -4.036698818206787]
  ].map((velocity) => velocity.map(f32));
  const pooled = (leftIndex, rightIndex, axis) => divide(
    add(
      multiply(
        boostedMassesKg[leftIndex],
        boostedInput[leftIndex][axis]
      ),
      multiply(
        boostedMassesKg[rightIndex],
        boostedInput[rightIndex][axis]
      )
    ),
    add(boostedMassesKg[leftIndex], boostedMassesKg[rightIndex])
  );
  const boostedOutput = [
    [boostedInput[0][0], pooled(0, 1, 1)],
    [pooled(1, 2, 0), pooled(0, 1, 1)],
    [pooled(1, 2, 0), boostedInput[2][1]]
  ];
  const boostedImpulses = boostedOutput.map((velocity, particleIndex) => (
    velocity.map((component, axis) => multiply(
      boostedMassesKg[particleIndex],
      f32(component - boostedInput[particleIndex][axis])
    ))
  ));
  const boostedResidual = [0, 1].map((axis) => add(
    add(boostedImpulses[0][axis], boostedImpulses[1][axis]),
    boostedImpulses[2][axis]
  ));
  const length2 = (vector) => f32(Math.hypot(...vector));
  const boostedResidualLength = length2(boostedResidual);
  const boostedConditioning = add(
    add(length2(boostedImpulses[0]), length2(boostedImpulses[1])),
    length2(boostedImpulses[2])
  );
  const boostedFormerTolerance = multiply(
    multiply(256, 1.1920929e-7),
    Math.max(boostedConditioning, f32(1e-6))
  );
  const boostedUnitTolerance = multiply(
    multiply(256, 1.1920929e-7),
    Math.max(boostedConditioning, f32(1))
  );
  assert.equal(boostedResidual[0], f32(2.00048089e-6));
  assert.equal(boostedResidual[1], f32(-9.171664715e-6));
  assert.equal(boostedResidualLength, f32(9.387297723e-6));
  assert.ok(boostedResidualLength > boostedFormerTolerance);
  assert.ok(boostedResidualLength <= boostedUnitTolerance);
  assert.ok(
    boostedResidualLength <= 2e-5,
    'the boosted orthogonal block remains inside the public momentum bound'
  );

  const threeBlockStart = schroederSpatialMechanicalGraphSolverWgsl.indexOf(
    'fn mechanical_matching_three_block('
  );
  const threeBlockEnd = schroederSpatialMechanicalGraphSolverWgsl.indexOf(
    '@compute @workgroup_size(64)\nfn initialize_matching_cleanup_constraints',
    threeBlockStart
  );
  assert.ok(threeBlockStart >= 0 && threeBlockEnd > threeBlockStart);
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl.slice(
      threeBlockStart,
      threeBlockEnd
    ),
    /let momentum_tolerance = max\(\s*1\.0e-6,\s*256\.0 \* 1\.1920929e-7 \* max\(momentum_conditioning, 1\.0\)/
  );
  const fourBlockStart = schroederSpatialMechanicalGraphSolverWgsl.indexOf(
    'fn mechanical_matching_four_block('
  );
  assert.ok(fourBlockStart >= 0 && threeBlockStart > fourBlockStart);
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl.slice(
      fourBlockStart,
      threeBlockStart
    ),
    /let momentum_tolerance = max\(\s*1\.0e-6,\s*256\.0 \* 1\.1920929e-7 \* max\(momentum_conditioning, 1\.0\)/
  );
});

test('mechanical WGSL retains one checked CSR graph through sixteen sealed Jacobi rounds', () => {
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT.length, 16);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT.length, 48);
  assert.equal(SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS, 48);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT, 1);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_POSITION_TRUST_DIAMETERS, 16);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES, 512);
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES,
    512
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES,
    'production must encode the proven worst-case cleanup horizon while GPU early-tail certification suppresses converged work'
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES & 1,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES & 1,
    'the production encode budget must retain the logical terminal buffer parity'
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH,
    1
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_DISPATCHES,
    512
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_DISPATCHES
      * SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_HEADER_WORDS,
    5
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES,
    1024
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS,
    131072
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH
      * SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS,
    131072,
    'the one-pass owner must retain the explicit frontier incident-CSR admission cap'
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS,
    64
  );
  assert.ok(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS ** 3
      + SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS ** 2
      <= 270000,
    'the contained terminal four-path admission threshold must keep its loose cubic cursor-loop bound small'
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_WALL_REFINEMENT_ROUNDS,
    16
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S,
    1e-5
  );
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_RECIPROCAL_LAPLACIAN_BOUND_FACTOR,
    2
  );
  const stabilityScale = (diagonalTensorBound) => 1 / Math.max(
    SCHROEDER_SPATIAL_MECHANICAL_RECIPROCAL_LAPLACIAN_BOUND_FACTOR
      * diagonalTensorBound,
    1
  );
  assert.equal(
    stabilityScale(0.5),
    1,
    'one equal-mass isolated edge keeps its exact one-pass correction'
  );
  const equalMassContactSheetDegree = 4;
  const contactSheetScale = stabilityScale(
    equalMassContactSheetDegree / 2
  );
  assert.equal(
    1 - contactSheetScale * equalMassContactSheetDegree,
    0,
    'the alternating graph-Laplacian mode contracts instead of mapping to -1'
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /2\.0\s*\*\s*velocity_operator_bound/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /let velocity_operator_bound =\s*velocity_tensor_00 \+ velocity_tensor_11 \+ velocity_tensor_22/
  );
  assert.match(
    schroederSpatialMechanicalInterfaceReceiptWgsl,
    /fn interface_receipt_face_at_delta\([\s\S]*normal_separation_m[\s\S]*overlap_a_m \* overlap_b_m/
  );
  assert.match(
    schroederSpatialMechanicalInterfaceReceiptWgsl,
    /fn interface_receipt_tangent_zero_tolerance_m\([\s\S]*16\.0 \* 1\.1920929e-7[\s\S]*overlap_a_m <= tangent_zero_tolerance_m/
  );
  assert.match(
    schroederSpatialMechanicalInterfaceReceiptWgsl,
    /fn interface_receipt_swept_axis_interval\([\s\S]*let entry_t = max\(interval_x\.x/
  );
  assert.match(
    schroederSpatialMechanicalInterfaceReceiptWgsl,
    /let impact_face = interface_receipt_face_at_delta\([\s\S]*return impact_face\.area_m2/
  );
  const wgslFunctionSource = (name) => {
    const start = schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      `fn ${name}(`
    );
    assert.notEqual(start, -1, `${name} WGSL function was not found`);
    const bodyStart = schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      '{',
      start
    );
    assert.notEqual(bodyStart, -1, `${name} WGSL body was not found`);
    let depth = 0;
    for (
      let cursor = bodyStart;
      cursor < schroederSpatialMechanicalGraphSolverWgsl.length;
      cursor += 1
    ) {
      const character = schroederSpatialMechanicalGraphSolverWgsl[cursor];
      if (character === '{') depth += 1;
      if (character !== '}') continue;
      depth -= 1;
      if (depth === 0) {
        return schroederSpatialMechanicalGraphSolverWgsl.slice(
          start,
          cursor + 1
        );
      }
    }
    assert.fail(`${name} WGSL body was not balanced`);
  };
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /struct MechanicalMatchingThreeBlockResult\s*\{/
  );
  const matchingThreeBlockSource = wgslFunctionSource(
    'mechanical_matching_three_block'
  );
  const matchingFourBlockSource = wgslFunctionSource(
    'mechanical_matching_four_block'
  );
  const matchingFourPathCandidateSource = wgslFunctionSource(
    'mechanical_matching_four_path_candidate'
  );
  const matchingFourPathAxisSource = wgslFunctionSource(
    'mechanical_matching_four_path_axis_active_set'
  );
  const matchingFourPathSource = wgslFunctionSource(
    'mechanical_matching_four_path_block'
  );
  const matchingFourBlockAxisSource = wgslFunctionSource(
    'mechanical_matching_four_block_axis_active_set'
  );
  const matchingFourBlockBoxAxisSource = wgslFunctionSource(
    'mechanical_matching_four_block_box_axis_active_set'
  );
  const matchingFourBlockBoxWallSource = wgslFunctionSource(
    'mechanical_matching_four_block_box_wall_active_set'
  );
  const matchingInboundOrderSource = wgslFunctionSource(
    'mechanical_matching_inbound_candidate_better'
  );
  const matchingAxisActiveSetSource = wgslFunctionSource(
    'mechanical_matching_three_block_axis_active_set'
  );
  const matchingAxisPrimalSource = wgslFunctionSource(
    'mechanical_matching_three_block_axis_primal'
  );
  const matchingBoxWallActiveSetSource = wgslFunctionSource(
    'mechanical_matching_three_block_box_wall_active_set'
  );
  assert.match(matchingThreeBlockSource, /\bcenter_index\b/);
  assert.match(matchingThreeBlockSource, /\bprimary_index\b/);
  assert.match(matchingThreeBlockSource, /\bsecondary_index\b/);
  assert.match(
    matchingThreeBlockSource,
    /primary_pos_mass\.w <= center_pos_mass\.w/
  );
  assert.match(
    matchingThreeBlockSource,
    /candidate_pos_mass\.w <= center_pos_mass\.w/
  );
  assert.match(matchingThreeBlockSource,
    /let secondary_better = mechanical_matching_inbound_candidate_better\(/);
  assert.match(matchingThreeBlockSource,
    /tertiary_index = secondary_index/);
  assert.match(matchingThreeBlockSource,
    /eligible_inbound_count == 2u && terminal_star_window/);
  assert.doesNotMatch(matchingThreeBlockSource,
    /eligible_inbound_count >= 2u/);
  assert.match(matchingThreeBlockSource,
    /mechanical_matching_current_pass\(\) \+ 16u/);
  assert.match(matchingThreeBlockSource,
    /mechanical_matching_four_block\(/);
  assert.match(matchingInboundOrderSource,
    /candidate_priority > incumbent_priority/);
  assert.match(matchingInboundOrderSource,
    /candidate_face_alignment > incumbent_face_alignment/);
  assert.match(matchingInboundOrderSource,
    /candidate_rank < incumbent_rank/);
  assert.match(
    matchingThreeBlockSource,
    /if \(eligible_inbound_count == 0u\) \{ return result; \}/
  );
  assert.doesNotMatch(
    matchingThreeBlockSource,
    /eligible_inbound_count != 1u/
  );
  assert.doesNotMatch(
    matchingThreeBlockSource,
    /16\.0 \* center_pos_mass\.w/
  );
  assert.match(matchingFourBlockAxisSource, /contact_mask < 8u/);
  assert.match(matchingFourBlockAxisSource,
    /candidate_u\.y = shared_u/);
  assert.match(matchingFourBlockAxisSource,
    /objective < result\.objective/);
  assert.match(matchingFourBlockSource,
    /result\.member_count = 4u/);
  assert.match(matchingFourBlockSource,
    /\(active_contact_mask & 7u\) != 7u/);
  assert.match(matchingFourBlockSource,
    /primary_contact_impulse > 0\.0/);
  assert.match(matchingFourBlockSource,
    /secondary_contact_impulse > 0\.0/);
  assert.match(matchingFourBlockSource,
    /tertiary_contact_impulse > 0\.0/);
  assert.match(matchingFourBlockSource,
    /primary_wall\.clipped != 0u[\s\S]*mechanical_matching_four_block_box_wall_active_set\(/);
  assert.match(matchingFourPathCandidateSource,
    /mechanical_solver_edge_inactive\(encoded_bridge_peer\)/);
  assert.match(matchingFourPathCandidateSource,
    /candidate\.light_mass_ratio > result\.light_mass_ratio/);
  assert.match(matchingFourPathSource,
    /reciprocal_candidate\.body_0_index != candidate\.body_0_index/);
  assert.match(matchingFourPathSource,
    /result\.path_owner = select\(0u, 1u, mutual_low > partner_low\)/);
  assert.match(matchingFourPathSource,
    /\(\(x_axis\.contact_mask \| y_axis\.contact_mask \| z_axis\.contact_mask\) & 7u\)/);
  assert.match(matchingFourPathAxisSource, /contact_mask < 8u/);
  assert.match(matchingFourPathAxisSource,
    /edge_2_sign \* \(candidate_u\.z - candidate_u\.w\)/);
  assert.match(matchingFourBlockBoxAxisSource, /wall_mask < 16u/);
  assert.match(matchingFourBlockBoxAxisSource, /contact_mask < 8u/);
  assert.match(matchingFourBlockBoxAxisSource,
    /diagonal\.x \* cofactor_11/);
  assert.match(matchingFourBlockBoxAxisSource,
    /primary_wall_constraint\.inward_scalar_sign \* wall_impulse\.x/);
  assert.match(matchingFourBlockBoxWallSource,
    /\(active_contact_mask & 7u\) != 7u/);
  assert.match(matchingFourBlockBoxWallSource,
    /mechanical_matching_four_wall_energy_allocation\(/);
  assert.match(matchingFourBlockBoxWallSource,
    /result\.member_count = 4u/);
  assert.match(matchingThreeBlockSource, /\b0\.5\b/);
  assert.match(matchingThreeBlockSource, /\b1\.0e-5\b/);
  assert.match(matchingThreeBlockSource, /\bdot\(/);
  assert.match(matchingThreeBlockSource, /\beffective_determinant\b/);
  assert.match(matchingThreeBlockSource, /\bprimary_lambda\b/);
  assert.match(matchingThreeBlockSource, /\bsecondary_lambda\b/);
  assert.match(
    matchingThreeBlockSource,
    /abs\(proposed_primary_residual\)[\s\S]*block_residual_tolerance_m_per_s/
  );
  assert.match(
    matchingThreeBlockSource,
    /abs\(proposed_secondary_residual\)[\s\S]*block_residual_tolerance_m_per_s/
  );
  assert.doesNotMatch(matchingThreeBlockSource, /\bcommon_u\b/);
  assert.match(matchingThreeBlockSource, /\baggregate_kinetic_delta_j\b/);
  assert.match(matchingThreeBlockSource, /\bpair_heat_j\b/);
  assert.match(
    matchingThreeBlockSource,
    /mechanical_matching_three_block_box_wall_active_set\(/
  );
  assert.doesNotMatch(
    matchingThreeBlockSource,
    /dot\(primary_normal, secondary_normal\) <= -1\.0 \+ 1\.0e-6/
  );
  assert.match(
    matchingAxisActiveSetSource,
    /wall_mask < 8u/
  );
  assert.match(
    matchingAxisActiveSetSource,
    /contact_mask < 4u/
  );
  assert.match(
    matchingAxisActiveSetSource,
    /primary_contact_sign \* secondary_contact_sign \* center_d/
  );
  assert.match(
    matchingAxisActiveSetSource,
    /matrix_11 \* matrix_22 - matrix_12 \* matrix_12/
  );
  assert.match(
    matchingAxisActiveSetSource,
    /mechanical_matching_three_block_axis_primal\(/
  );
  assert.match(
    matchingAxisPrimalSource,
    /return vec3<f32>\(shared_u\)/
  );
  assert.match(
    matchingAxisActiveSetSource,
    /candidate_primary_residual >= -velocity_tolerance_m_per_s/
  );
  assert.doesNotMatch(
    matchingBoxWallActiveSetSource,
    /128\.0 \* 1\.1920929e-7[\s\S]*final_primary_residual/
  );
  assert.match(
    matchingBoxWallActiveSetSource,
    /let x_axis = mechanical_matching_three_block_axis_active_set\(/
  );
  assert.match(
    matchingBoxWallActiveSetSource,
    /let y_axis = mechanical_matching_three_block_axis_active_set\(/
  );
  assert.match(
    matchingBoxWallActiveSetSource,
    /let z_axis = mechanical_matching_three_block_axis_active_set\(/
  );
  assert.match(
    matchingBoxWallActiveSetSource,
    /wall_kinetic_delta_x_j[\s\S]*wall_kinetic_delta_y_j[\s\S]*wall_kinetic_delta_z_j/
  );
  assert.match(
    matchingBoxWallActiveSetSource,
    /total_kinetic_delta_j[\s\S]*pair_kinetic_delta_j[\s\S]*wall_kinetic_delta_j/
  );
  assert.doesNotMatch(
    matchingAxisActiveSetSource,
    /atomic(?:Add|And|CompareExchangeWeak|Exchange|Load|Max|Min|Or|Store|Sub|Xor)\(/
  );
  assert.doesNotMatch(
    matchingAxisPrimalSource,
    /atomic(?:Add|And|CompareExchangeWeak|Exchange|Load|Max|Min|Or|Store|Sub|Xor)\(/
  );
  assert.doesNotMatch(
    matchingBoxWallActiveSetSource,
    /atomic(?:Add|And|CompareExchangeWeak|Exchange|Load|Max|Min|Or|Store|Sub|Xor)\(/
  );
  assert.doesNotMatch(
    matchingThreeBlockSource,
    /atomic(?:Add|And|CompareExchangeWeak|Exchange|Load|Max|Min|Or|Store|Sub|Xor)\(/
  );
  assert.doesNotMatch(
    matchingFourBlockSource,
    /atomic(?:Add|And|CompareExchangeWeak|Exchange|Load|Max|Min|Or|Store|Sub|Xor)\(/
  );
  assert.doesNotMatch(
    matchingFourBlockAxisSource,
    /atomic(?:Add|And|CompareExchangeWeak|Exchange|Load|Max|Min|Or|Store|Sub|Xor)\(/
  );
  assert.doesNotMatch(
    matchingFourBlockBoxAxisSource,
    /atomic(?:Add|And|CompareExchangeWeak|Exchange|Load|Max|Min|Or|Store|Sub|Xor)\(/
  );
  assert.doesNotMatch(
    matchingFourBlockBoxWallSource,
    /atomic(?:Add|And|CompareExchangeWeak|Exchange|Load|Max|Min|Or|Store|Sub|Xor)\(/
  );
  assert.doesNotMatch(
    matchingFourPathCandidateSource,
    /atomic(?:Add|And|CompareExchangeWeak|Exchange|Load|Max|Min|Or|Store|Sub|Xor)\(/
  );
  assert.doesNotMatch(
    matchingFourPathAxisSource,
    /atomic(?:Add|And|CompareExchangeWeak|Exchange|Load|Max|Min|Or|Store|Sub|Xor)\(/
  );
  assert.doesNotMatch(
    matchingFourPathSource,
    /atomic(?:Add|And|CompareExchangeWeak|Exchange|Load|Max|Min|Or|Store|Sub|Xor)\(/
  );
  assert.doesNotMatch(
    matchingThreeBlockSource,
    /\b(?:1146|2459|3061144)u\b/
  );
  const matchingFinalizeSource = schroederSpatialMechanicalGraphSolverWgsl.slice(
    schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      'fn finalize_matching_cleanup_pass_body()'
    ),
    schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      'fn restore_matching_cleanup_trust('
    )
  );
  assert.match(matchingFinalizeSource,
    /mechanical_matching_applied_pair_count_word\(pass_index\)/);
  assert.match(matchingFinalizeSource,
    /completed_pass = pass_index \+ 1u/);
  assert.match(matchingFinalizeSource,
    /mechanical_matching_selection_count_word\(completed_pass\)/);
  assert.match(matchingFinalizeSource,
    /mechanical_matching_wall_count_word\(completed_pass\)/);
  assert.match(matchingFinalizeSource,
    /&graph_control\[128u\],[\s\S]*512u/);
  assert.match(matchingFinalizeSource,
    /bitcast<f32>\(terminal_position_ratio\) <= 1\.0/);
  assert.match(matchingFinalizeSource,
    /\(pass_index & 1u\)\s*== 1u/);
  assert.match(matchingFinalizeSource,
    /atomicStore\(&matching_cleanup_dispatch\[0u\], 0u\)/);
  assert.match(matchingFinalizeSource,
    /zero matching with residual remaining[\s\S]*next selection pass clears/);
  const matchingTrustRestoreSource = wgslFunctionSource(
    'restore_matching_cleanup_trust'
  );
  const residualVerifySource = wgslFunctionSource('verify_contact_residual');
  assert.match(
    matchingTrustRestoreSource,
    /mechanical_matching_current_pass\(\)\s*!= 512u/
  );
  assert.match(
    matchingTrustRestoreSource,
    /ITERATION_INCOMPLETE|1024u/
  );
  assert.match(
    residualVerifySource,
    /&graph_control\[128u\][\s\S]*?\)\s*!= 512u/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /@group\(0\) @binding\(14\) var<storage, read_write> matching_cleanup_dispatch/
  );
  const matchingSelectSource =
    schroederSpatialMechanicalGraphSolverWgsl.slice(
      schroederSpatialMechanicalGraphSolverWgsl.indexOf(
        'fn mechanical_matching_edge_rank('
      ),
      schroederSpatialMechanicalGraphSolverWgsl.indexOf(
        'fn copy_matching_cleanup_state('
      )
    );
  const matchingConstraintPairSource =
    schroederSpatialMechanicalGraphSolverWgsl.slice(
      schroederSpatialMechanicalGraphSolverWgsl.indexOf(
        'fn mechanical_matching_constraint_pair('
      ),
      schroederSpatialMechanicalGraphSolverWgsl.indexOf(
        'fn initialize_matching_cleanup_constraints('
      )
    );
  const matchingConstraintInitializerSource =
    schroederSpatialMechanicalGraphSolverWgsl.slice(
      schroederSpatialMechanicalGraphSolverWgsl.indexOf(
        'fn initialize_matching_cleanup_constraints('
      ),
      schroederSpatialMechanicalGraphSolverWgsl.indexOf(
        'fn mechanical_matching_preflight('
      )
    );
  assert.match(matchingSelectSource,
    /fn mechanical_matching_edge_rank\(low_index: u32, high_index: u32\)/);
  assert.match(matchingSelectSource,
    /fn mechanical_matching_constraint_code\(normal: vec3<f32>\) -> f32/);
  assert.match(matchingSelectSource,
    /fn mechanical_matching_constraint_code_valid\([\s\S]*let code = abs\(constraint\.w\)/);
  assert.match(matchingSelectSource,
    /fn mechanical_matching_constraint_normal\([\s\S]*u32\(abs\(constraint\.w\)\) - 1u/);
  assert.match(matchingConstraintPairSource,
    /if \(all\(constraint == vec4<f32>\(0\.0\)\)\)[\s\S]*mechanical_solver_zero_pair\(1u\)/);
  assert.match(matchingSelectSource,
    /fn mechanical_matching_constraint_face_active\(/);
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /fn mechanical_solver_aabb_tangent_zero_tolerance_m\([\s\S]*16\.0 \* 1\.1920929e-7[\s\S]*tangent_a > tangent_zero_tolerance_m/
  );
  assert.match(
    matchingSelectSource,
    /half_sum_m - abs\(tangent_a_m\) > tangent_zero_tolerance_m[\s\S]*half_sum_m - abs\(tangent_b_m\) > tangent_zero_tolerance_m/
  );
  assert.match(matchingSelectSource,
    /fn mechanical_matching_positive_constraint_swept_active\([\s\S]*swept_contact\.swept_contact != 0u[\s\S]*dot\(swept_contact\.normal, constraint_normal\)/);
  assert.match(matchingConstraintPairSource,
    /if \(!current_face_active && !positive_swept_face_active\)/);
  assert.doesNotMatch(matchingConstraintPairSource,
    /constraint\.w < 0\.0/);
  assert.match(matchingConstraintPairSource,
    /let constraint_normal = mechanical_matching_constraint_normal\(constraint\)/);
  assert.match(matchingConstraintPairSource,
    /let response_normal = constraint\.xyz/);
  assert.match(matchingConstraintPairSource,
    /let response_projection = dot\(response_normal, constraint_normal\)/);
  assert.match(matchingConstraintPairSource,
    /support_distance_m - dot\(current_delta, constraint_normal\)/);
  assert.doesNotMatch(matchingConstraintPairSource,
    /mechanical_solver_finite_volume_contact|mechanical_matching_dynamic_velocity_pair/);
  assert.match(matchingConstraintInitializerSource,
    /let finite_volume_contact = mechanical_solver_finite_volume_contact/);
  assert.match(matchingConstraintInitializerSource,
    /let constraint_code =\s*mechanical_matching_constraint_code\(constraint_normal\)/);
  assert.match(matchingConstraintInitializerSource,
    /constraint = vec4<f32>\(\s*response_normal,\s*select\(\s*-constraint_code,\s*constraint_code,\s*finite_volume_contact\.admitted != 0u/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /fn mechanical_matching_jacobi_residual_converged\(\) -> bool/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /position_ratio <= 1\.0[\s\S]*velocity_residual_m_per_s <= 1\.0e-5/);
  assert.match(matchingSelectSource,
    /begin_new_sweep[\s\S]*MECHANICAL_SOLVER_EDGE_PEER_MASK[\s\S]*MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT/);
  assert.match(matchingSelectSource,
    /pass_index == 0u[\s\S]*mechanical_matching_jacobi_residual_converged\(\)[\s\S]*return;/);
  assert.match(matchingSelectSource,
    /!mechanical_solver_edge_inactive\(encoded_peer\)/);
  assert.match(matchingSelectSource,
    /mechanical_solver_edge_inactive\(encoded_peer\)[\s\S]*self_mass > peer_mass/);
  assert.doesNotMatch(matchingSelectSource,
    /self_mass >= 16\.0 \* peer_mass/);
  assert.match(matchingSelectSource,
    /best_peer >= mechanical_params\.particle_count[\s\S]*reserved_peer < mechanical_params\.particle_count/);
  assert.match(matchingSelectSource,
    /bitcast<f32>\(best_cursor\)[\s\S]*bitcast<f32>\(reserved_cursor\)/);
  assert.match(matchingThreeBlockSource,
    /if \(!\(primary_relative_velocity < -1\.0e-5\)\) \{ return result; \}/);
  assert.match(matchingThreeBlockSource,
    /candidate_selected_peer != center_index[\s\S]*candidate_selection\.w/);
  assert.match(matchingThreeBlockSource,
    /selected_peer_selection\.x\) == candidate_index[\s\S]*continue;/);
  assert.match(matchingThreeBlockSource,
    /uses_independent_reservation[\s\S]*mechanical_solver_edge_inactive\(csr_peers\[cursor\]\)[\s\S]*mechanical_solver_edge_inactive\(csr_peers\[candidate_cursor\]\)/);
  assert.match(matchingThreeBlockSource,
    /candidate_position_ratio[\s\S]*candidate_position_update_ratio[\s\S]*candidate_velocity_ratio[\s\S]*candidate_priority = max/);
  assert.doesNotMatch(matchingThreeBlockSource,
    /!\(secondary_relative_velocity < -1\.0e-5\)/);
  assert.match(matchingSelectSource,
    /let better = priority > best_priority/);
  assert.match(matchingSelectSource,
    /priority == best_priority[\s\S]*face_alignment > best_face_alignment/);
  assert.match(matchingSelectSource,
    /let constraint_normal = mechanical_matching_constraint_normal\(\s*matching_constraints\[cursor\]/);
  assert.match(matchingSelectSource,
    /face_alignment == best_face_alignment[\s\S]*edge_rank < best_rank/);
  assert.match(matchingSelectSource,
    /bitcast<f32>\(best_cursor\)/);
  const matchingCopySource = schroederSpatialMechanicalGraphSolverWgsl.slice(
    schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      'fn copy_matching_cleanup_state_for_index('
    ),
    schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      'fn apply_matching_cleanup_edge_for_index('
    )
  );
  assert.match(matchingCopySource, />= 512u/);
  assert.match(matchingCopySource,
    /output_state\[self_index \* 2u\] = input_state\[self_index \* 2u\]/);
  const matchingApplySource =
    schroederSpatialMechanicalGraphSolverWgsl.slice(
      schroederSpatialMechanicalGraphSolverWgsl.indexOf(
        'fn apply_matching_cleanup_edge_for_index('
      ),
      schroederSpatialMechanicalGraphSolverWgsl.indexOf(
        '@compute @workgroup_size(1)\nfn replay_matching_cleanup_refinement_trace()'
      )
    );
  assert.match(matchingApplySource,
    /let low_cursor = bitcast<u32>\(selection\.z\)/);
  assert.match(matchingApplySource,
    /length\(low_constraint\.xyz - high_constraint\.xyz\) > 1\.0e-5/);
  assert.match(matchingApplySource,
    /low_constraint\.w != high_constraint\.w/);
  assert.match(matchingApplySource,
    /csr_peers\[low_cursor\][\s\S]*mechanical_matching_mark_edge_inactive/);
  assert.match(
    matchingApplySource,
    /mechanical_matching_three_block\(/
  );
  assert.match(
    matchingApplySource,
    /terminal_path_window[\s\S]*mechanical_matching_four_path_block\(/
  );
  assert.match(
    matchingApplySource,
    /three_block\.topology == 1u[\s\S]*three_block\.path_owner == 0u/
  );
  assert.match(
    matchingApplySource,
    /mechanical_matching_applied_pair_count_word\(pass_index\)[\s\S]*2u/
  );
  assert.match(
    matchingApplySource,
    /three_block\.member_count == 4u[\s\S]*mechanical_matching_applied_pair_count_word\(pass_index\)[\s\S]*3u/
  );
  assert.match(
    matchingApplySource,
    /center_next_wall_heat_j[\s\S]*center_wall_kinetic_delta_j/
  );
  assert.match(
    matchingApplySource,
    /center_next_pair_heat_j \+ center_next_wall_heat_j/
  );
  const matchingRefinementSource =
    schroederSpatialMechanicalGraphSolverWgsl.slice(
      schroederSpatialMechanicalGraphSolverWgsl.indexOf(
        'fn mechanical_matching_refine_wall_velocity_pair('
      ),
      schroederSpatialMechanicalGraphSolverWgsl.indexOf(
        'fn initialize_matching_cleanup_constraints('
      )
    );
  assert.match(
    matchingRefinementSource,
    /refinement_round\s*< 16u/
  );
  assert.match(
    matchingRefinementSource,
    /refinement_round > 0u[\s\S]*!prior_wall_clipped[\s\S]*approach_m_per_s >= -1\.0e-5/
  );
  assert.match(
    matchingRefinementSource,
    /mechanical_matching_project_wall_velocity\([\s\S]*low_pair_velocity[\s\S]*mechanical_matching_project_wall_velocity\([\s\S]*high_pair_velocity/
  );
  assert.doesNotMatch(
    matchingRefinementSource,
    /atomic(?:Add|And|CompareExchangeWeak|Exchange|Load|Max|Min|Or|Store|Sub|Xor)\(/
  );
  assert.doesNotMatch(
    matchingApplySource,
    /energy_ledger\[mechanical_energy_base\((?:low|high)_index\)\]\s*=/
  );
  const matchingReplaySource =
    schroederSpatialMechanicalGraphSolverWgsl.slice(
      schroederSpatialMechanicalGraphSolverWgsl.indexOf(
        '@compute @workgroup_size(1)\nfn replay_matching_cleanup_refinement_trace()'
      ),
      schroederSpatialMechanicalGraphSolverWgsl.indexOf(
        'fn trace_matching_cleanup_apply()'
      )
    );
  const matchingTargetBlockSource = wgslFunctionSource(
    'mechanical_diagnostic_capture_target_three_block'
  );
  assert.match(
    matchingReplaySource,
    /@compute @workgroup_size\(1\)[\s\S]*fn replay_matching_cleanup_refinement_trace\(\)/
  );
  assert.match(
    matchingReplaySource,
    /mechanical_matching_relative_velocity_delta\([\s\S]*mechanical_matching_refine_wall_velocity_pair\(/
  );
  assert.match(
    matchingReplaySource,
    /mechanical_matching_three_block\(/
  );
  assert.match(
    matchingReplaySource,
    /terminal_path_window[\s\S]*mechanical_matching_four_path_block\(/
  );
  assert.ok(
    Array.from(
      schroederSpatialMechanicalGraphSolverWgsl.matchAll(
        /mechanical_matching_three_block\(/g
      )
    ).length >= 3,
    'production and diagnostic replay share the bounded three-body helper'
  );
  assert.match(
    matchingThreeBlockSource,
    /mechanical_solver_peer_index\(\s*csr_peers\[/
  );
  assert.match(
    matchingReplaySource,
    /mechanical_solver_edge_inactive\(csr_peers\[/
  );
  assert.match(matchingTargetBlockSource,
    /block\.member_count == 4u[\s\S]*block\.tertiary_index/);
  assert.doesNotMatch(matchingReplaySource,
    /fallback_(?:secondary|tertiary)_markers_active/);
  assert.equal(
    Array.from(
      schroederSpatialMechanicalGraphSolverWgsl.matchAll(
        /position\.x <= lower\.x \+ lower_tolerance_m\.x/g
      )
    ).length,
    3,
    'main solve, local refinement, and terminal cleanup enforce lower-wall complementarity'
  );
  assert.equal(
    Array.from(
      schroederSpatialMechanicalGraphSolverWgsl.matchAll(
        /position\.x >= upper\.x - upper_tolerance_m\.x/g
      )
    ).length,
    3,
    'main solve, local refinement, and terminal cleanup enforce upper-wall complementarity'
  );
  for (const entryPoint of [
    'select_matching_cleanup_edge_for_index',
    'apply_matching_cleanup_edge_for_index',
    'project_matching_cleanup_walls_for_index'
  ]) {
    const start = schroederSpatialMechanicalGraphSolverWgsl.indexOf(
      `fn ${entryPoint}(`
    );
    assert.notEqual(start, -1);
    const source = schroederSpatialMechanicalGraphSolverWgsl.slice(
      start,
      start + 1200
    );
    assert.match(source, /pass_index[\s\S]*>= 512u[\s\S]*\) \{ return; \}/);
  }
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /ss_exact_near_directory_admitted\(spatial_expectation\)/);
  assert.match(
    schroederSpatialMechanicalProposalV2Wgsl,
    /const SS_EXACT_NEAR_ABI_VERSION_V2: u32 = 2u;/
  );
  assert.match(
    schroederSpatialMechanicalProposalV2Wgsl,
    /var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV2;/
  );
  assert.match(
    schroederSpatialMechanicalProposalV2FlatWgsl,
    /dispatch_ordinal >= spatial_directory\[37u\]/
  );
  assert.doesNotMatch(
    schroederSpatialMechanicalProposalV2FlatWgsl,
    /dispatch_ordinal >= mechanical_params\.particle_count/
  );
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
  assert.doesNotMatch(
    schroederSpatialMechanicalProposalWgsl,
    /let current_pair_radius_m/
  );
  assert.match(
    schroederSpatialMechanicalProposalWgsl,
    /return epoch_distance_m <= pair_radius_m/
  );
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /let mixed_law_query_radius_m = 33\.0 \* max\(global_max_diameter, 0\.0\)[\s\S]*4\.0 \* max\(global_max_displacement_m, 0\.0\)[\s\S]*2\.0 \* max\(global_max_wall_projection_m, 0\.0\)/);
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
  assert.match(
    schroederSpatialMechanicalProposalWgsl,
    /const MECHANICAL_SUPPORT_PHASE_GEOMETRY_OCCLUDED: u32 = 16u/
  );
  const phaseGeometrySource = schroederSpatialMechanicalProposalWgsl.slice(
    schroederSpatialMechanicalProposalWgsl.indexOf(
      'fn mechanical_graph_phase_geometry_occlusion('
    ),
    schroederSpatialMechanicalProposalWgsl.indexOf(
      'fn mechanical_graph_pair_policy('
    )
  );
  const pairPolicySource = schroederSpatialMechanicalProposalWgsl.slice(
    schroederSpatialMechanicalProposalWgsl.indexOf(
      'fn mechanical_graph_pair_policy('
    ),
    schroederSpatialMechanicalProposalWgsl.indexOf(
      'fn mechanical_graph_wall_projection_bound('
    )
  );
  assert.match(
    phaseGeometrySource,
    /peer_class != 1u && peer_class != 2u/
  );
  assert.match(
    phaseGeometrySource,
    /all\(current_delta <= vec3<f32>\(containment_limit_m\)\)[\s\S]*all\(epoch_delta <= vec3<f32>\(containment_limit_m\)\)/
  );
  assert.match(
    phaseGeometrySource,
    /peer_edge_m > self_edge_m \+ tolerance_m[\s\S]*peer_index < index/
  );
  assert.match(
    pairPolicySource,
    /self_endpoint\.descriptor \| other_endpoint\.descriptor[\s\S]*MECHANICAL_SUPPORT_PHASE_GEOMETRY_OCCLUDED/
  );
  assert.match(
    supportReductionSource,
    /mechanical_graph_phase_geometry_occlusion\(particle_index\)[\s\S]*MECHANICAL_SUPPORT_PHASE_GEOMETRY_OCCLUDED/
  );
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

  assert.equal(
    (schroederSpatialMechanicalGraphSolverWgsl.match(
      /@group\(0\) @binding\(0\) var<storage/g
    ) || []).length,
    1
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /@binding\(0\) var<storage, read_write> input_state/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /fn run_matching_cleanup_global_owner/
  );
  const ownerEntryPoint = schroederSpatialMechanicalGraphSolverWgsl.indexOf(
    'fn run_matching_cleanup_global_owner'
  );
  assert.ok(ownerEntryPoint > 0);
  assert.doesNotMatch(
    schroederSpatialMechanicalGraphSolverWgsl.slice(0, ownerEntryPoint),
    /input_state\[[^\]]+\]\s*=/
  );
  assert.equal(
    (schroederSpatialMechanicalGraphSolverWgsl.match(
      /input_state\[[^\]]+\]\s*=/g
    ) || []).length,
    2
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE \+ self_index/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /MECHANICAL_MATCHING_OWNER_FRONTIER_BIT/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /MECHANICAL_MATCHING_OWNER_CONTACT_BIT/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /let frozen_pair = mechanical_matching_constraint_pair\([\s\S]*frozen_pair\.active_pair != 0u[\s\S]*atomicOr\([\s\S]*ACTIVE_FLAG_BASE \+ peer_index/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /let expand_frontier =[\s\S]*mechanical_matching_constraint_pair\([\s\S]*storageBarrier\(\);[\s\S]*let execute_pass =/
  );
  const ownerFrontierCountsSource = wgslFunctionSource(
    'mechanical_matching_owner_frontier_counts'
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /@compute @workgroup_size\(128\)\s*fn run_matching_cleanup_global_owner/
  );
  assert.match(
    ownerFrontierCountsSource,
    /if \(lane == 0u\) \{[\s\S]*mechanical_matching_owner_active_count[\s\S]*mechanical_matching_owner_contact_count[\s\S]*mechanical_matching_owner_cursor_count[\s\S]*mechanical_matching_owner_count_invalid[\s\S]*\}\s*workgroupBarrier\(\);/
  );
  assert.match(
    ownerFrontierCountsSource,
    /var self_index = lane;[\s\S]*self_index = self_index \+ 128u[\s\S]*if \(frontier_active\) \{[\s\S]*let degree = end - begin;[\s\S]*local_cursor_count = local_cursor_count \+ degree;/
  );
  assert.doesNotMatch(
    ownerFrontierCountsSource,
    /if \(contact_active\) \{[^}]*cursor_count/
  );
  assert.match(
    ownerFrontierCountsSource,
    /if \(local_cursor_count > published_total - degree\)[\s\S]*atomicAdd\([\s\S]*mechanical_matching_owner_cursor_count[\s\S]*prior_cursor_count > published_total - local_cursor_count/
  );
  assert.equal(
    (ownerFrontierCountsSource.match(/workgroupBarrier\(\);/g) || []).length,
    2,
    'the striped frontier reduction must use two uniform barriers'
  );
  const ownerSource = wgslFunctionSource(
    'run_matching_cleanup_global_owner'
  );
  assert.equal(
    (ownerSource.match(/mechanical_matching_owner_frontier_counts\(/g) || [])
      .length,
    2,
    'owner must certify the complete frontier before and after expansion'
  );
  assert.match(
    ownerSource,
    /mechanical_matching_owner_frontier_counts\([\s\S]*lane,[\s\S]*published_total_before_expansion[\s\S]*if \(lane == 0u\)[\s\S]*workgroupBarrier\(\);[\s\S]*let expand_frontier =/
  );
  assert.match(
    ownerSource,
    /storageBarrier\(\);[\s\S]*mechanical_matching_owner_frontier_counts\([\s\S]*lane,[\s\S]*published_total_after_expansion[\s\S]*if \(lane == 0u && expand_frontier\)/
  );
  assert.match(
    ownerSource,
    new RegExp(
      `mechanical_matching_persistent_pass \\+ 16u[\\s\\S]*frontier_counts_after_expansion\\.active_cursor_count[\\s\\S]*> ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS}u`
    )
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT: u32 = 0x40000000u/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /fn select_matching_cleanup_edge_for_index[\s\S]*!full_selection[\s\S]*!mechanical_matching_edge_ever_active\(encoded_peer\)[\s\S]*continue;/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /fn select_matching_cleanup_edge_for_index\([\s\S]*force_full_selection: bool[\s\S]*let full_selection = force_full_selection/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /fn select_matching_cleanup_edge\([\s\S]*select_matching_cleanup_edge_for_index\(global_id\.x, true\);/
  );
  assert.match(
    ownerSource,
    /select_matching_cleanup_edge_for_index\(self_index, false\);/
  );
  assert.match(
    ownerSource,
    /if \(mechanical_matching_edge_ever_active\(encoded_peer\)\) \{[\s\S]*continue;[\s\S]*mechanical_matching_constraint_pair/
  );
  assert.match(
    ownerSource,
    /peer_prior_flags[\s\S]*MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /atomicAnd\([\s\S]*~MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /csr_peers\[cursor\] = csr_peers\[cursor\][\s\S]*MECHANICAL_SOLVER_EDGE_PEER_MASK[\s\S]*MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /csr_peers\[cursor\] = peer_index;/
  );
  assert.doesNotMatch(
    schroederSpatialMechanicalGraphSolverWgsl,
    /ACTIVE_INDEX_BASE|INDEX_MASK|active_slot/
  );
  assert.match(
    schroederSpatialMechanicalGraphSolverWgsl,
    /mechanical_params\.particle_count\s*- mechanical_matching_persistent_contact_count/
  );
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /@binding\(16\) var<uniform> mechanical_solver_iteration/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /fn measure_runtime_iteration/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /fn solve_runtime_iteration/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /fn allocate_energy_runtime_iteration/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /iteration < mechanical_params\.solver_iteration_count/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /iteration == 0u/);
  assert.doesNotMatch(schroederSpatialMechanicalGraphSolverWgsl,
    /fn (?:measure|solve|allocate_energy)_iteration_\d+/);
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
    /fn verify_contact_residual[\s\S]*row_bounds_valid[\s\S]*csr_peers\[cursor\] = mechanical_solver_peer_index\(csr_peers\[cursor\]\)[\s\S]*let other_index = csr_peers\[cursor\][\s\S]*mechanical_matching_constraint_pair\(\s*low_index,\s*high_index,\s*cursor/);
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
    /fn mechanical_solver_finite_volume_contact[\s\S]*mechanical_solver_swept_aabb_axis_interval[\s\S]*source_normal_axis[\s\S]*support_distance_m = half_sum_m/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /inverse_mass_share/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let position_trust_capacity_m = select\([\s\S]*16\.0[\s\S]*self_diameter_m[\s\S]*2\.0 \* initial_displacement_m[\s\S]*current_wall_projection_m,[\s\S]*particle_scales\[self_index\]\.z,[\s\S]*iteration > 0u/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let remaining_position_trust_m = max\([\s\S]*position_trust_capacity_m[\s\S]*initial_displacement_m[\s\S]*current_wall_projection_m/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let position_degree_scale = select\([\s\S]*position_max_pair_dx_m \/ max\(position_sum_length_m[\s\S]*let position_trust_scale = select\([\s\S]*position_degree_scale[\s\S]*remaining_position_trust_m \/ max\(position_triangle_sum_m/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let position_triangle_sum_m = barrier_dx_triangle_sum_m[\s\S]*soft_dx_triangle_sum_m/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let scale = vec4<f32>\(\s*position_trust_scale,\s*velocity_stability_scale,\s*position_trust_capacity_m,\s*remaining_position_trust_m\s*\)/);
  assert.doesNotMatch(schroederSpatialMechanicalGraphSolverWgsl,
    /fn mechanical_solver_scale/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /kinetic_delta_speed_squared[\s\S]*let radial_dv[\s\S]*let face_dv[\s\S]*relative_dv = radial_dv \+ face_dv[\s\S]*result\.barrier_dx = inverse_mass_share[\s\S]*response_normal[\s\S]*result\.velocity_normal = select/);
  assert.doesNotMatch(schroederSpatialMechanicalGraphSolverWgsl,
    /angular_momentum_preserving_swept_overlap/);
  assert.doesNotMatch(schroederSpatialMechanicalGraphSolverWgsl,
    /pair_velocity_delta_length > 1\.0e-12/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /let position_scale = min\(self_scale\.x, other_scale\.x\)[\s\S]*let velocity_scale = min\(self_scale\.y, other_scale\.y\)[\s\S]*let coupled_scale = min\(position_scale, velocity_scale\)[\s\S]*return vec4<f32>\(\s*coupled_scale,\s*coupled_scale,\s*coupled_scale,\s*coupled_scale\s*\)/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /spent_position_trust_m[\s\S]*prior_position_trust_m[\s\S]*particle_scales\[self_index\]\.z = position_trust_capacity_m[\s\S]*particle_scales\[self_index\]\.w = remaining_position_trust_m/);
  assert.match(schroederSpatialMechanicalGraphSolverWgsl,
    /next_epoch_displacement_m[\s\S]*position_trust_capacity_m - next_epoch_displacement_m/);
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
    /mechanical_solve_count_word\(final_iteration\)/);
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
      === 'ulg-schroeder-spatial-mechanical-contact-graph-measure-runtime'
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

test('fixed-count mechanical proposal scan retires in same-queue order without a host fence', () => {
  const fixture = liveFixture(2);
  let hostFenceCount = 0;
  fixture.device.queue.onSubmittedWorkDone = () => {
    hostFenceCount += 1;
    return Promise.resolve();
  };
  const proposal = runSchroederSpatialMechanicalProposalWebGpu(fixture);
  const encoder = fixture.device.createCommandEncoder();
  assert.equal(proposal.encodeApply(encoder, {
    stateBuffer: fixture.sphParticleUpload.stateBuffer,
    mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer
  }), true);

  assert.equal(proposal.lifecycleStatus, 'encoded');
  assert.equal(proposal.submissionObserved, false);
  assert.equal(proposal.canReleaseQueueOrdered(), false);
  assert.throws(
    () => proposal.releaseQueueOrdered(),
    /requires an exact submitted idle proposal/
  );
  assert.equal(proposal.released, false);
  assert.equal(proposal.lifecycleStatus, 'encoded');
  fixture.device.queue.submit([encoder.finish()]);
  assert.equal(proposal.markSubmittedWork(), true);
  assert.equal(proposal.markSubmittedWork(), false);
  assert.equal(proposal.submissionObserved, true);
  assert.equal(proposal.lifecycleStatus, 'submitted');
  assert.equal(proposal.canReleaseQueueOrdered(), true);
  assert.equal(proposal.releaseQueueOrdered(), true);
  assert.equal(proposal.released, true);
  assert.equal(proposal.lifecycleStatus, 'released');
  assert.equal(hostFenceCount, 0);
  assert.equal(proposal.canReleaseQueueOrdered(), false);
  assert.throws(
    () => proposal.releaseQueueOrdered(),
    /requires an exact submitted idle proposal/
  );
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});

test('benchmark timestamps retain one coarse span around bounded owner cleanup', async () => {
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
    ...Array.from({ length: 16 }, (_, iteration) => `iteration-${iteration}`),
    'matching-cleanup-global-owner',
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
      ...Array.from(
        { length: 16 },
        (_, iteration) =>
          `ulg-schroeder-spatial-mechanical-contact-graph-iteration-${iteration}`
      ),
      'ulg-schroeder-spatial-mechanical-matching-cleanup-global-owner',
      'ulg-schroeder-spatial-mechanical-contact-graph-verify',
      'ulg-schroeder-spatial-mechanical-contact-graph-publish',
      'ulg-schroeder-spatial-mechanical-contact-graph-commit'
    ]
  );
  const matchingOwnerDispatches = fixture.device.dispatches.filter(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-matching-cleanup-global-owner'
  );
  assert.equal(
    matchingOwnerDispatches.length,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_DISPATCHES
  );
  assert.ok(matchingOwnerDispatches.every(({ dispatch }) => (
    JSON.stringify(dispatch) === JSON.stringify([1, 1, 1])
  )));
  assert.equal(
    fixture.device.dispatches.some(({ pipeline }) => (
      /^ulg-schroeder-spatial-mechanical-matching-cleanup-(select|copy|apply|walls|finalize)$/
        .test(pipeline?.label || '')
    )),
    false
  );
  const ownerLayoutEntries = matchingOwnerDispatches[0]
    ?.pipeline?.layout?.bindGroupLayouts?.[0]?.entries ?? [];
  assert.equal(
    ownerLayoutEntries.find(({ binding }) => binding === 0)?.buffer?.type,
    'storage'
  );
  assert.equal(
    ownerLayoutEntries.filter(({ buffer }) => buffer?.type !== 'uniform').length,
    fixture.device.limits.maxStorageBuffersPerShaderStage
  );
  assert.equal(
    matchingOwnerDispatches[0]?.bindGroup?.entries?.find(
      ({ binding }) => binding === 14
    )?.resource?.buffer,
    proposal.conditionalDispatchBuffer
  );
  assert.equal(
    proposal.encodedDispatchCount,
    fixture.device.dispatches.length - dispatchStart
  );
  assert.equal(
    proposal.encodedComputePassCount,
    26
  );

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
  assert.equal(
    proposal.encodedComputePassCount,
    26
  );
  assert.equal(
    proposal.encodedDispatchCount,
    fixture.device.dispatches.length - dispatchStart
  );

  assert.equal(proposal.releaseAfterSubmittedWork(), true);
  assert.equal(await proposal.releasePromise, true);
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});

test('diagnostic trace uses one caller-owned slot and trace-only portable bindings', async () => {
  const fixture = liveFixture(2, { identityEnabled: true });
  const traceBuffer = taggedBuffer(
    fixture.device,
    'mechanical-diagnostic-trace',
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_BYTES,
    0x4 | 0x8 | 0x80
  );
  const proposal = runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    diagnosticTrace: {
      buffer: traceBuffer,
      byteOffset: 0,
      materialAId: 1,
      materialBId: 2
    }
  });
  assert.equal(
    proposal.matchingCleanupLogicalPassCount,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
  );
  assert.equal(
    proposal.matchingCleanupEncodedPassCount,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES,
    'diagnostic trace retains every physical pass needed by its logical rows'
  );
  assert.equal(proposal.matchingCleanupOwnerPassesPerDispatch, null);
  assert.equal(proposal.matchingCleanupOwnerDispatchCount, 0);
  assert.equal(proposal.matchingCleanupOwnerMaxActiveParticles, null);
  assert.equal(proposal.matchingCleanupOwnerMaxIncidentCursors, null);
  assert.equal(
    proposal.matchingCleanupOwnerTerminalMaxIncidentCursors,
    null
  );
  assert.equal(proposal.diagnosticTrace.buffer, traceBuffer);
  assert.equal(
    proposal.diagnosticTrace.byteLength,
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_BYTES
  );
  assert.equal(proposal.diagnosticTrace.targetIndices, null);
  const headerWrite = fixture.device.writes.findLast(
    ({ buffer }) => buffer === traceBuffer
  );
  assert.ok(headerWrite);
  const headerWords = new Uint32Array(
    headerWrite.bytes.buffer,
    headerWrite.bytes.byteOffset,
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_WORDS
  );
  assert.equal(
    headerWords[0],
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_MAGIC
  );
  assert.equal(
    headerWords[1],
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_VERSION
  );
  assert.equal(
    headerWords[2],
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.HEADER_VALID
  );
  assert.equal(headerWords[10], 2);
  assert.equal(
    headerWords[11],
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
  );

  const dispatchStart = fixture.device.dispatches.length;
  assert.equal(proposal.encodeApply(
    fixture.device.createCommandEncoder(),
    {
      stateBuffer: fixture.sphParticleUpload.stateBuffer,
      mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer
    }
  ), true);
  const encodedDispatches = fixture.device.dispatches.slice(dispatchStart);
  const proposalEncoder = fixture.device.encoders.at(-1);
  const diagnosticCleanupPass = proposalEncoder.passes.find(
    ({ descriptor }) => descriptor.label
      === 'ulg-schroeder-spatial-mechanical-matching-cleanup-diagnostic'
  );
  assert.ok(diagnosticCleanupPass);
  assert.notEqual(
    diagnosticCleanupPass,
    proposalEncoder.passes.find(({ descriptor }) => descriptor.label
      === 'ulg-schroeder-spatial-mechanical-contact-graph-solve')
  );
  const legacyCleanupDispatches = encodedDispatches.filter(
    ({ pipeline }) => (
      /^ulg-schroeder-spatial-mechanical-matching-cleanup-(select|copy|apply|walls)$/
        .test(pipeline?.label ?? '')
    )
  );
  assert.equal(
    legacyCleanupDispatches.length,
    4 * SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
  );
  assert.ok(legacyCleanupDispatches.every(({ dispatch, dispatchIndirect }) => (
    Array.isArray(dispatch) && dispatchIndirect == null
  )));
  for (const pass of proposalEncoder.passes) {
    const passDispatches = encodedDispatches.filter(
      ({ pass: dispatchPass }) => dispatchPass === pass
    );
    const indirectBuffers = new Set(
      passDispatches
        .map(({ dispatchIndirect }) => dispatchIndirect?.buffer)
        .filter(Boolean)
    );
    const writableStorageBuffers = new Set();
    for (const dispatch of passDispatches) {
      const layoutEntries =
        dispatch.pipeline?.layout?.bindGroupLayouts?.[0]?.entries ?? [];
      for (const layoutEntry of layoutEntries) {
        if (layoutEntry.buffer?.type !== 'storage') continue;
        const resource = dispatch.bindGroup?.entries?.find(
          ({ binding }) => binding === layoutEntry.binding
        )?.resource?.buffer;
        if (resource) writableStorageBuffers.add(resource);
      }
    }
    for (const indirectBuffer of indirectBuffers) {
      assert.equal(
        writableStorageBuffers.has(indirectBuffer),
        false,
        `compute pass ${pass.descriptor.label} aliases writable storage and indirect usage`
      );
    }
  }
  const traceDispatches = encodedDispatches
    .filter(({ pipeline }) => pipeline?.label?.includes(
      'mechanical-diagnostic-trace'
    ));
  assert.equal(
    traceDispatches.filter(({ pipeline }) => pipeline.label.endsWith(
      '-trace-refinement-replay'
    )).length,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
  );
  assert.equal(
    traceDispatches.filter(({ pipeline }) => pipeline.label.endsWith(
      '-trace-apply'
    )).length,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
  );
  for (
    let cleanupPass = 0;
    cleanupPass < SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;
    cleanupPass += 1
  ) {
    assert.ok(
      traceDispatches[cleanupPass * 2].pipeline.label.endsWith(
        '-trace-refinement-replay'
      )
    );
    assert.ok(
      traceDispatches[cleanupPass * 2 + 1].pipeline.label.endsWith(
        '-trace-apply'
      )
    );
  }
  const replayDispatchIndices = [];
  const wallDispatchIndices = [];
  const traceApplyDispatchIndices = [];
  const finalizeDispatchIndices = [];
  encodedDispatches.forEach(({ pipeline }, dispatchIndex) => {
    const label = pipeline?.label ?? '';
    if (label.endsWith('-trace-refinement-replay')) {
      replayDispatchIndices.push(dispatchIndex);
    } else if (label.endsWith('-matching-cleanup-walls')) {
      wallDispatchIndices.push(dispatchIndex);
    } else if (label.endsWith('-trace-apply')) {
      traceApplyDispatchIndices.push(dispatchIndex);
    } else if (label.endsWith('-matching-cleanup-finalize')) {
      finalizeDispatchIndices.push(dispatchIndex);
    }
  });
  assert.equal(
    wallDispatchIndices.length,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
  );
  assert.equal(
    finalizeDispatchIndices.length,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
  );
  for (
    let cleanupPass = 0;
    cleanupPass < SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;
    cleanupPass += 1
  ) {
    assert.ok(
      replayDispatchIndices[cleanupPass] < wallDispatchIndices[cleanupPass]
    );
    assert.ok(
      wallDispatchIndices[cleanupPass]
        < traceApplyDispatchIndices[cleanupPass]
    );
    assert.ok(
      traceApplyDispatchIndices[cleanupPass]
        < finalizeDispatchIndices[cleanupPass]
    );
    assert.equal(
      encodedDispatches[traceApplyDispatchIndices[cleanupPass]]
        .bindGroup.entries.find(({ binding }) => binding === 1)
        ?.resource?.buffer,
      encodedDispatches[wallDispatchIndices[cleanupPass]]
        .bindGroup.entries.find(({ binding }) => binding === 1)
        ?.resource?.buffer
    );
  }
  for (const stage of ['measure', 'select', 'materialize']) {
    assert.equal(
      traceDispatches.filter(({ pipeline }) => pipeline.label.endsWith(
        `-trace-${stage}`
      )).length,
      1
    );
  }
  const replayDispatch = traceDispatches.find(({ pipeline }) => (
    pipeline.label.endsWith('-trace-refinement-replay')
  ));
  assert.ok(replayDispatch);
  const expectedReplayBindings = [
    0, 1, 2, 3, 5, 6, 8, 9, 10, 11, 12, 13, 15
  ];
  const replayLayoutEntries =
    replayDispatch.pipeline.layout?.bindGroupLayouts?.[0]?.entries ?? [];
  assert.deepEqual(
    replayLayoutEntries.map(({ binding }) => binding),
    expectedReplayBindings
  );
  assert.deepEqual(
    replayDispatch.bindGroup.entries.map(({ binding }) => binding),
    expectedReplayBindings
  );
  assert.equal(
    replayLayoutEntries.find(({ binding }) => binding === 11)?.buffer?.type,
    'uniform'
  );
  assert.equal(
    replayLayoutEntries.find(({ binding }) => binding === 0)?.buffer?.type,
    'storage'
  );
  assert.equal(
    replayLayoutEntries.filter(
      ({ buffer }) => buffer?.type !== 'uniform'
    ).length,
    fixture.device.limits.maxStorageBuffersPerShaderStage
  );
  assert.equal(
    replayLayoutEntries.find(({ binding }) => binding === 5)?.buffer?.type,
    'storage'
  );
  assert.equal(
    replayDispatch.bindGroup.entries.find(({ binding }) => binding === 2)
      ?.resource?.buffer,
    fixture.sphParticleUpload.thermoBuffer
  );
  assert.equal(
    replayDispatch.bindGroup.entries.find(({ binding }) => binding === 5)
      ?.resource?.buffer,
    proposal.directedPeerBuffer
  );
  assert.equal(
    replayDispatch.bindGroup.entries.find(({ binding }) => binding === 6)
      ?.resource?.buffer,
    proposal.sourceOffsetBuffer
  );
  assert.equal(
    replayDispatch.bindGroup.entries.find(({ binding }) => binding === 15)
      ?.resource?.buffer,
    traceBuffer
  );
  for (const { pipeline, bindGroup } of traceDispatches) {
    const layoutEntries =
      pipeline.layout?.bindGroupLayouts?.[0]?.entries ?? [];
    assert.ok(
      layoutEntries.filter(
        ({ buffer }) => buffer?.type !== 'uniform'
      ).length <= fixture.device.limits.maxStorageBuffersPerShaderStage
    );
    assert.equal(
      bindGroup.entries.find(({ binding }) => binding === 15)
        ?.resource?.buffer,
      traceBuffer
    );
  }
  const diagnosticSolverModule = replayDispatch.pipeline.compute?.module;
  for (const pipeline of fixture.device.computePipelines.filter(
    ({ compute }) => compute?.module === diagnosticSolverModule
  )) {
    const bindingZero = pipeline.layout?.bindGroupLayouts?.[0]?.entries?.find(
      ({ binding }) => binding === 0
    );
    if (bindingZero) assert.equal(bindingZero.buffer?.type, 'storage');
  }
  assert.equal(
    proposal.encodedDispatchCount,
    fixture.device.dispatches.length - dispatchStart
  );
  assert.equal(proposal.releaseAfterSubmittedWork(), true);
  assert.equal(await proposal.releasePromise, true);
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});

test('diagnostic targeted tail preserves the base trace and initializes aligned per-pass rows', async () => {
  const fixture = liveFixture(2, { identityEnabled: true });
  const traceBuffer = taggedBuffer(
    fixture.device,
    'mechanical-diagnostic-targeted-trace',
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_BYTES,
    0x4 | 0x8 | 0x80
  );
  const proposal = runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    diagnosticTrace: {
      buffer: traceBuffer,
      byteOffset: 0,
      materialAId: 1,
      materialBId: 2,
      targetIndices: [0, 1]
    }
  });
  assert.equal(
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_BYTES % 256,
    0
  );
  assert.equal(
    proposal.diagnosticTrace.byteLength,
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_BYTES
  );
  assert.deepEqual(proposal.diagnosticTrace.targetIndices, [0, 1]);
  const headerWrite = fixture.device.writes.findLast(
    ({ buffer }) => buffer === traceBuffer
  );
  assert.ok(headerWrite);
  const words = new Uint32Array(
    headerWrite.bytes.buffer,
    headerWrite.bytes.byteOffset,
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS
  );
  assert.equal(
    words[0],
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_MAGIC
  );
  const tailHeader =
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
  assert.equal(
    words[tailHeader],
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC
  );
  assert.equal(
    words[tailHeader + 1],
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION
  );
  assert.equal(
    words[tailHeader + 2],
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS.HEADER_VALID
  );
  assert.equal(
    words[tailHeader + 4],
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
  );
  assert.equal(
    words[tailHeader + 5],
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS
  );
  assert.deepEqual(
    [words[tailHeader + 6], words[tailHeader + 7]],
    [0, 1]
  );
  const firstRow =
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD;
  const lastRow = firstRow
    + (
      SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
        * SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
      - 1
    ) * SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS;
  assert.deepEqual(
    Array.from(words.slice(firstRow, firstRow + 5)),
    [0, 0, 0xffff_ffff, 0xffff_ffff, 0xffff_ffff]
  );
  assert.deepEqual(
    Array.from(words.slice(lastRow, lastRow + 5)),
    [
      SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES - 1,
      1,
      0xffff_ffff,
      0xffff_ffff,
      0xffff_ffff
    ]
  );
  assert.equal(proposal.releaseAfterSubmittedWork(), true);
  assert.equal(await proposal.releasePromise, true);
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});

test('opaque proposal capture records GPU history and final state without wrapping the live proposal or fencing', () => {
  const fixture = liveFixture(2, { identityEnabled: true });
  let queueFenceCount = 0;
  fixture.device.queue.onSubmittedWorkDone = () => {
    queueFenceCount += 1;
    return Promise.resolve();
  };
  assert.throws(
    () => createSchroederSpatialMechanicalProposalCapture({
      sequenceStepCount: 0
    }),
    /positive safe integer/u
  );
  const capture = createSchroederSpatialMechanicalProposalCapture({
    sequenceStepCount: 2
  });
  assert.throws(
    () => describeSchroederSpatialMechanicalProposalCapture({ ...capture }),
    /exact handle/u
  );

  const first = runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    capture,
    sequenceIndex: 0,
    sequenceStepCount: 2
  });
  const firstEncoder = fixture.device.createCommandEncoder();
  assert.equal(first.encodeApply(firstEncoder, {
    stateBuffer: fixture.sphParticleUpload.stateBuffer,
    mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer
  }), true);
  const firstEncoderEvent = fixture.device.encoders.at(-1);
  assert.equal(isLiveSchroederSpatialMechanicalProposal(first, {
    device: fixture.device,
    generation: fixture.generation
  }), true);
  const firstCapture = describeSchroederSpatialMechanicalProposalCapture(
    capture
  );
  assert.equal(firstCapture.status, 'capturing');
  assert.equal(firstCapture.encodedStepCount, 1);
  assert.equal(firstCapture.complete, false);
  assert.equal(firstCapture.lastProposal, first);
  assert.equal(firstCapture.hostQueueFenceCount, 0);
  assert.equal(firstCapture.buffer.label,
    'ulg-schroeder-spatial-mechanical-proposal-capture');
  assert.equal(firstEncoderEvent.copies.filter(
    ({ destination }) => destination === firstCapture.buffer
  ).length, 3);
  fixture.device.queue.submit([firstEncoder.finish()]);
  assert.equal(first.markSubmittedWork(), true);
  assert.equal(first.releaseQueueOrdered(), true);
  assert.equal(queueFenceCount, 0);

  assert.throws(
    () => runSchroederSpatialMechanicalProposalWebGpu({
      ...fixture,
      capture,
      sequenceIndex: 0,
      sequenceStepCount: 2
    }),
    /strict sequence order/u
  );
  const second = runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    capture,
    sequenceIndex: 1,
    sequenceStepCount: 2
  });
  const secondEncoder = fixture.device.createCommandEncoder();
  assert.equal(second.encodeApply(secondEncoder, {
    stateBuffer: fixture.sphParticleUpload.stateBuffer,
    mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer
  }), true);
  const secondEncoderEvent = fixture.device.encoders.at(-1);
  const complete = describeSchroederSpatialMechanicalProposalCapture(capture);
  assert.equal(complete.status, 'complete');
  assert.equal(complete.encodedStepCount, 2);
  assert.equal(complete.complete, true);
  assert.equal(complete.lastProposal, second);
  assert.equal(complete.device, fixture.device);
  assert.equal(complete.particleCount, 2);
  assert.equal(complete.buffer.size, complete.layout.totalByteLength);
  const captureCopies = secondEncoderEvent.copies.filter(
    ({ destination }) => destination === complete.buffer
  );
  assert.equal(captureCopies.length, 7);
  assert.deepEqual(
    captureCopies.slice(0, 3).map(({ destinationOffset, size }) => [
      destinationOffset,
      size
    ]),
    [
      [complete.layout.history.strideByteLength, complete.layout.history.control.byteLength],
      [
        complete.layout.history.strideByteLength
          + complete.layout.history.evidence.byteOffset,
        complete.layout.history.evidence.byteLength
      ],
      [
        complete.layout.history.strideByteLength
          + complete.layout.history.matchingCleanup.byteOffset,
        complete.layout.history.matchingCleanup.byteLength
      ]
    ]
  );
  assert.deepEqual(
    captureCopies.slice(3).map(({ destinationOffset, size }) => [
      destinationOffset,
      size
    ]),
    Object.values(complete.layout.final).map(({ byteOffset, byteLength }) => [
      byteOffset,
      byteLength
    ])
  );
  assert.deepEqual(
    captureCopies.map(({ source }) => source),
    [
      second.graphControlBuffer,
      second.evidence.buffer,
      second.matchingCleanupControlBuffer,
      fixture.sphParticleUpload.stateBuffer,
      second.contactGraph.sourceThermoBuffer,
      fixture.mlsMpmParticleUpload.mechanicsBuffer,
      second.contactGraph.sourceIdentityBuffer
    ]
  );
  fixture.device.queue.submit([secondEncoder.finish()]);
  assert.equal(second.markSubmittedWork(), true);
  assert.equal(second.releaseQueueOrdered(), true);
  assert.equal(queueFenceCount, 0);
  const captureBuffer = complete.buffer;
  assert.equal(destroySchroederSpatialMechanicalProposalCapture(capture), true);
  assert.equal(captureBuffer.destroyCount, 1);
  assert.equal(destroySchroederSpatialMechanicalProposalCapture(capture), false);
  assert.throws(
    () => describeSchroederSpatialMechanicalProposalCapture(capture),
    /destroyed/u
  );
  assert.equal(destroySchroederSpatialMechanicalProposalRuntime(
    fixture.device
  ), true);
});

test('deferred post-G2P residual solve publishes truthful resident bindings and reuses its exact arena', async () => {
  const fixture = liveFixture(2, { identityEnabled: false });
  const beforeProposalBuffers = fixture.device.buffers.length;
  const first = runSchroederSpatialMechanicalProposalWebGpu(fixture);
  assert.equal(first.ready, true);
  assert.equal(first.traversalCount, SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT);
  assert.equal(first.solverIterationCount, SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS);
  assert.equal(
    first.matchingCleanupLogicalPassCount,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
  );
  assert.equal(
    first.matchingCleanupEncodedPassCount,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES
  );
  assert.equal(
    first.matchingCleanupOwnerPassesPerDispatch,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH
  );
  assert.equal(
    first.matchingCleanupOwnerDispatchCount,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_DISPATCHES
  );
  assert.equal(
    first.matchingCleanupOwnerMaxActiveParticles,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES
  );
  assert.equal(
    first.matchingCleanupOwnerMaxIncidentCursors,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS
  );
  assert.equal(
    first.matchingCleanupOwnerTerminalMaxIncidentCursors,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS
  );
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
  const matchingConstraintBuffer = fixture.device.buffers.find(
    ({ label }) => label.startsWith(
      'ulg-schroeder-spatial-mechanical-matching-constraints-'
    )
  );
  assert.ok(matchingConstraintBuffer);
  assert.equal(
    matchingConstraintBuffer.size,
    first.directedPairCapacity * 16
  );
  assert.equal(
    first.matchingConstraintByteLength,
    matchingConstraintBuffer.size
  );
  assert.equal(
    first.totalRetainedGraphByteLength,
    first.retainedGraphByteLength
      + matchingConstraintBuffer.size
      + first.matchingCleanupOwnerWorkspaceByteLength
      - first.contactGraph.layout.bufferLayouts.conditionalDispatch.byteLength
  );
  assert.equal(
    first.conditionalDispatchBuffer.size,
    first.matchingCleanupOwnerWorkspaceByteLength
  );
  assert.equal(
    first.contactGraph.totalRetainedByteLength,
    first.totalRetainedGraphByteLength
  );
  assert.ok(
    first.totalRetainedGraphByteLength <= first.configuredRetainedByteBudget
  );
  assert.equal('matchingConstraintBuffer' in first, false);
  assert.equal('matchingConstraintBuffer' in first.contactGraph, false);
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
  assert.equal(
    first.contactGraph.matchingCleanupControlBuffer,
    first.matchingCleanupControlBuffer
  );
  assert.equal(
    first.contactGraph.layout.bufferLayouts.matchingCleanupControl.wordLength,
    3_596
  );
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
    'ulg-schroeder-spatial-mechanical-matching-cleanup-global-owner',
    'ulg-schroeder-spatial-mechanical-contact-graph-publish',
    'ulg-schroeder-spatial-mechanical-contact-graph-commit'
  ]);
  assert.deepEqual(proposalEncoder.clears.map(({ offset, size }) => [offset, size]), [
    [0, null],
    [0, null],
    [0, null]
  ]);
  assert.equal(
    proposalEncoder.clears[2].buffer,
    first.conditionalDispatchBuffer
  );
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
  const supportReductionDispatch = fixture.device.dispatches
    .slice(dispatchStart)
    .find(({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-contact-graph-support-reduction');
  assert.equal(
    supportReductionDispatch?.pipeline?.layout?.bindGroupLayouts?.[0]
      ?.entries?.find(({ binding }) => binding === 0)?.buffer?.type,
    'read-only-storage'
  );
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
    ...Array.from({ length: 16 }, () => [
      'ulg-schroeder-spatial-mechanical-contact-graph-measure-runtime',
      'ulg-schroeder-spatial-mechanical-contact-graph-solve-runtime',
      'ulg-schroeder-spatial-mechanical-contact-graph-energy-allocate-runtime'
    ]).flat(),
    'ulg-schroeder-spatial-mechanical-matching-constraints-initialize',
    ...Array.from(
      {
        length: SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_DISPATCHES
      },
      () => 'ulg-schroeder-spatial-mechanical-matching-cleanup-global-owner'
    ),
    'ulg-schroeder-spatial-mechanical-matching-cleanup-restore-trust',
    'ulg-schroeder-spatial-mechanical-contact-energy-verify',
    'ulg-schroeder-spatial-mechanical-contact-residual-verify',
    'ulg-schroeder-spatial-mechanical-contact-interface-receipt-initialize',
    'ulg-schroeder-spatial-mechanical-contact-interface-receipt-materialize',
    'ulg-schroeder-spatial-mechanical-proposal-publish',
    'ulg-schroeder-spatial-mechanical-proposal-seal',
    'ulg-schroeder-spatial-mechanical-proposal-commit',
    'ulg-schroeder-spatial-mechanical-contact-interface-receipt-seal'
  ]);
  const zeroContactDispatch = fixture.device.dispatches.find(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-proposal-zero-contact-complete'
  );
  assert.deepEqual(zeroContactDispatch?.dispatchIndirect, {
    buffer: first.conditionalDispatchBuffer,
    offset: first.contactGraph.conditionalDispatchOffsetBytes
  });
  assert.notEqual(first.conditionalDispatchBuffer.usage & 128, 0);
  assert.notEqual(first.conditionalDispatchBuffer.usage & 256, 0);
  const directSolverDispatch = fixture.device.dispatches.find(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-contact-graph-solve-runtime'
  );
  assert.deepEqual(directSolverDispatch?.dispatch, [1, 1, 1]);
  const runtimeSolverPipelines = fixture.device.computePipelines.filter(
    ({ label }) => /contact-graph-(?:measure|solve|energy-allocate)-runtime$/
      .test(label || '')
  );
  assert.equal(runtimeSolverPipelines.length, 3);
  assert.equal(
    new Set(runtimeSolverPipelines.map(({ layout }) => layout)).size,
    1
  );
  assert.equal(
    fixture.device.computePipelines.some(({ label }) => (
      /contact-graph-(?:measure|solve|energy-allocate)-\d+$/.test(label || '')
    )),
    false
  );
  assert.equal(
    fixture.device.computePipelines.some(({ label }) => (
      String(label || '').includes('diagnostic-trace')
    )),
    false
  );
  const runtimeSolverDispatches = fixture.device.dispatches.filter(
    ({ pipeline }) => /contact-graph-(?:measure|solve|energy-allocate)-runtime$/
      .test(pipeline?.label || '')
  );
  assert.equal(
    runtimeSolverDispatches.length,
    3 * SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS
  );
  for (
    let iteration = 0;
    iteration < SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS;
    iteration += 1
  ) {
    const stageDispatches = runtimeSolverDispatches.slice(
      iteration * 3,
      iteration * 3 + 3
    );
    assert.equal(
      new Set(stageDispatches.map(({ bindGroup: group }) => group)).size,
      1
    );
    const iterationResource = stageDispatches[0]?.bindGroup?.entries?.find(
      ({ binding }) => binding === 16
    )?.resource;
    assert.equal(
      iterationResource?.offset,
      iteration * fixture.device.limits.minUniformBufferOffsetAlignment
    );
    assert.equal(
      iterationResource?.size,
      4 * Uint32Array.BYTES_PER_ELEMENT
    );
  }
  const matchingOwnerDispatches = fixture.device.dispatches.filter(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-matching-cleanup-global-owner'
  );
  assert.equal(
    matchingOwnerDispatches.length,
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_DISPATCHES
  );
  assert.ok(matchingOwnerDispatches.every(({ dispatch }) => (
    JSON.stringify(dispatch) === JSON.stringify([1, 1, 1])
  )));
  assert.equal(
    fixture.device.computePipelines.some(({ label }) => (
      /^ulg-schroeder-spatial-mechanical-matching-cleanup-(select|copy|apply|walls|finalize)$/
        .test(label || '')
    )),
    false,
    'production must not eagerly build the legacy five-stage cleanup topology'
  );
  const matchingOwnerPipeline = matchingOwnerDispatches[0]?.pipeline;
  const sharedSolverModule = runtimeSolverPipelines[0]?.compute?.module;
  assert.equal(matchingOwnerPipeline?.compute?.module, sharedSolverModule);
  assert.equal(
    fixture.device.shaderModules.filter(({ code }) => (
      code === schroederSpatialMechanicalGraphSolverWgsl
    )).length,
    1
  );
  for (const pipeline of fixture.device.computePipelines.filter(
    ({ compute }) => compute?.module === sharedSolverModule
  )) {
    const bindingZero = pipeline.layout?.bindGroupLayouts?.[0]?.entries?.find(
      ({ binding }) => binding === 0
    );
    if (bindingZero) assert.equal(bindingZero.buffer?.type, 'storage');
  }
  const matchingOwnerLayoutEntries =
    matchingOwnerPipeline?.layout?.bindGroupLayouts?.[0]?.entries ?? [];
  assert.equal(
    matchingOwnerLayoutEntries.find(({ binding }) => binding === 0)
      ?.buffer?.type,
    'storage'
  );
  assert.equal(
    matchingOwnerLayoutEntries.filter(
      ({ buffer }) => buffer?.type !== 'uniform'
    ).length,
    fixture.device.limits.maxStorageBuffersPerShaderStage
  );
  assert.equal(
    matchingOwnerDispatches[0]?.bindGroup?.entries?.find(
      ({ binding }) => binding === 14
    )?.resource?.buffer,
    first.conditionalDispatchBuffer
  );
  const matchingOwnerWgsl = matchingOwnerPipeline?.compute?.module?.code;
  const matchingOwnerEntryWgsl = matchingOwnerWgsl.slice(
    matchingOwnerWgsl.indexOf('fn run_matching_cleanup_global_owner(')
  );
  assert.match(
    matchingOwnerWgsl,
    /@binding\(0\) var<storage, read_write> input_state/
  );
  assert.match(matchingOwnerWgsl, /if \(constraint\.w != 0\.0\)/);
  assert.match(
    matchingOwnerWgsl,
    /mechanical_matching_prior_applied_pair_count\(pass_index\)/
  );
  assert.match(matchingOwnerWgsl, /finalize_matching_cleanup_pass_body\(\)/);
  assert.match(matchingOwnerWgsl, /storageBarrier\(\)/);
  assert.match(
    matchingOwnerEntryWgsl,
    /let dispatch_active = workgroupUniformLoad\([\s\S]*&mechanical_matching_persistent_dispatch_active[\s\S]*\);[\s\S]*if \(dispatch_active == 0u\) \{[\s\S]*atomicStore\(&matching_cleanup_dispatch\[0u\], 0u\);[\s\S]*return;[\s\S]*\}[\s\S]*storageBarrier\(\);/
  );
  assert.doesNotMatch(matchingOwnerWgsl, /component_mode|atomic spin/i);
  assert.ok(first.encodedDispatchCount <= 640);
  const energyVerifyDispatch = fixture.device.dispatches.find(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-contact-energy-verify'
  );
  assert.equal(
    energyVerifyDispatch?.bindGroup?.entries?.find(
      ({ binding }) => binding === 10
    )?.resource?.buffer,
    first.evidence.buffer
  );
  const residualVerifyDispatch = fixture.device.dispatches.find(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-contact-residual-verify'
  );
  const residualVerifyLayoutEntries =
    residualVerifyDispatch?.pipeline?.layout?.bindGroupLayouts?.[0]?.entries;
  assert.deepEqual(
    residualVerifyLayoutEntries?.map(({ binding }) => binding),
    [0, 3, 5, 6, 8, 9, 10, 11, 13]
  );
  assert.ok(
    residualVerifyLayoutEntries.filter(
      ({ buffer }) => buffer?.type !== 'uniform'
    ).length <= fixture.device.limits.maxStorageBuffersPerShaderStage
  );
  assert.deepEqual(
    residualVerifyDispatch?.bindGroup?.entries?.map(({ binding }) => binding),
    [0, 3, 5, 6, 8, 9, 10, 11, 13]
  );
  assert.equal(
    residualVerifyLayoutEntries?.find(({ binding }) => binding === 13)
      ?.buffer?.type,
    'storage'
  );
  assert.equal(
    residualVerifyDispatch?.bindGroup?.entries?.find(
      ({ binding }) => binding === 13
    )?.resource?.buffer,
    matchingConstraintBuffer
  );
  const zeroApplyDispatch = fixture.device.dispatches.find(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-proposal-zero-contact-complete'
  );
  assert.equal(
    zeroApplyDispatch?.bindGroup?.entries?.find(
      ({ binding }) => binding === 7
    )?.resource?.buffer,
    first.matchingCleanupControlBuffer
  );
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
  assert.equal(first.encodedComputePassCount, 7);
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
  assert.ok(warm.totalRetainedGraphByteLength <= 64 * 1024);
  assert.ok(64 * 1024 - warm.totalRetainedGraphByteLength < 32);
  assert.equal(
    fixture.device.buffers.filter(
      ({ label }) => label.startsWith(
        'ulg-schroeder-spatial-mechanical-matching-constraints-'
      )
    ).at(-1).size,
    warm.directedPairCapacity * 16
  );
  assert.equal(warm.releaseAfterSubmittedWork(), true);
  assert.equal(await warm.releasePromise, true);
  await settleDeferredCleanup(fixture.device);

  const constrained = runSchroederSpatialMechanicalProposalWebGpu({
    ...fixture,
    pairGraphByteBudget: 20 * 1024
  });
  assert.equal(constrained.proposalPoolCacheHit, false);
  assert.ok(constrained.candidateByteBudget <= 20 * 1024);
  assert.equal(constrained.configuredRetainedByteBudget, 20 * 1024);
  assert.ok(constrained.totalRetainedGraphByteLength <= 20 * 1024);
  assert.ok(20 * 1024 - constrained.totalRetainedGraphByteLength < 32);
  assert.equal(
    fixture.device.buffers.filter(
      ({ label }) => label.startsWith(
        'ulg-schroeder-spatial-mechanical-matching-constraints-'
      )
    ).at(-1).size,
    constrained.directedPairCapacity * 16
  );
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
    pairGraphByteBudget: 15_428 + 31 * 32
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
