import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mlsMpmP2gGridProjectionWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL,
  MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
  MLS_MPM_GPU_GRID_NODE_FLOATS,
  ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  createMlsMpmGridSpec,
  createProjectionParamsArray,
  createMlsMpmP2gGridProjectionParityReport,
  mlsMpmMechanicsFieldProductRouteCertificateWgsl,
  projectMlsMpmP2gGridCpu,
  resolveMlsMpmP2gBackendPolicy,
  runMlsMpmP2gGridProjectionWebGpu,
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  runMlsMpmP2gGridProjectionWithOptionalWebGpu,
  validateLocallySubmittedMlsMpmActiveSourceDenseP2g,
  validateLocallySubmittedMlsMpmMechanicsFieldP2g
} from '../src/runtime/sph/sphGridGpuKernel.js';
import {
  abortSchroederTwoLevelMacroAuthorityAfter,
  claimSchroederFusedCoarseTerminalOutput,
  createSchroederCanonicalParticleContinuation,
  createSchroederFineMicroepochAuthority,
  createSchroederFusedCoarseTerminalTransaction,
  createSchroederFusedFineSubstepTransaction,
  createSchroederTwoLevelMacroAuthority,
  discardSchroederFusedCoarseTerminalTransaction,
  discardSchroederFusedFineSubstepTransaction,
  markSchroederFusedCoarseTerminalStageSubmissionObserved,
  markSchroederFusedCoarseTerminalStageSubmitted,
  quarantineSchroederFusedCoarseTerminalTransaction,
  retireSchroederFineMicroepochAfter,
  schroederFusedCoarseTerminalTransactionState,
  schroederFusedFineSubstepTransactionState,
  validateSchroederFineMicroepochAuthority,
  validateSchroederFusedCoarseTerminalTransaction
} from '../src/runtime/sph/schroederFusedFineSubstepGpu.js';
import {
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  createSchroederFrozenLevelAssignmentRefreshGpu
} from '../src/runtime/sph/schroederFrozenLevelAssignmentRefreshGpu.js';
import {
  SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS,
  ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_STATUS,
  runMlsMpmGridUpdateWebGpu,
  validateLocallySubmittedMlsMpmActiveSourceDenseGridUpdate,
  validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate,
  validateSubmittedMlsMpmMechanicsFieldGridUpdate
} from '../src/runtime/sph/sphGridUpdateGpuKernel.js';
import {
  claimLocallySubmittedMlsMpmFusedG2pOutputForContinuation,
  runMlsMpmG2pWebGpu,
  validateLocallySubmittedMlsMpmFusedG2p
} from '../src/runtime/sph/sphG2pGpuKernel.js';
import {
  createSchroederCrossLevelRefluxLedgerGpu,
  createSchroederSpatialParentFieldMechanicsWorkspaceGpu,
  validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu,
  validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu
} from '../src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js';
import {
  MECHANICS_FIELD_P2G_CONTRIBUTION_FLOATS,
  destroyMlsMpmResidentStepBuffers,
  runMlsMpmResidentStepWithOptionalWebGpu
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_READER_PHASE,
  admitSchroederSpatialEpochTransactionReader,
  createSchroederSpatialEpochTransaction
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import {
  buildMlsMpmMechanicsMaterialTable
} from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import {
  runSchroederSpatialMechanicalProposalWebGpu
} from '../src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js';
import {
  destroyMlsMpmMechanicsMaterialPhaseUpload,
  uploadMlsMpmMechanicsMaterialPhaseRecords
} from '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  createResidentProductEventCountControlWords,
  registerResidentProductEventCountAuthority
} from '../src/runtime/sph/sphResidentProductHistoryGpu.js';

function nearlyEqual(actual, expected, tolerance = 1e-5) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function manualBuffers({
  position = [1.25, 1.25, 1.25],
  velocity = [2, 3, 4],
  massKg = 8,
  affineC = [0, 0, 0, 0, 0, 0, 0, 0, 0],
  smoothingLengthM = 1,
  restDensityKgPerM3 = 8,
  volumeRatioJ = 1,
  restVolumeM3 = massKg / restDensityKgPerM3,
  solidFlag = 1,
  effectiveBulkModulusPa = 0,
  shearModulusPa = 0,
  lameLambdaPa = 0,
  soundSpeedMPerS = 0,
  eosModelId = 0,
  hydrostaticPressurePa = 0,
  phaseFractions = [0, 0, 0, 0],
  mechanicsDtS = 0
} = {}) {
  const state = new Float32Array([
    position[0], position[1], position[2], massKg,
    velocity[0], velocity[1], velocity[2], 123
  ]);
  const thermo = new Float32Array(12);
  thermo[3] = restDensityKgPerM3;
  thermo.set(phaseFractions, 4);
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  mechanics.set(affineC, 9);
  mechanics[18] = volumeRatioJ;
  mechanics[19] = restVolumeM3;
  mechanics[20] = solidFlag;
  mechanics[21] = 1;
  mechanics[22] = effectiveBulkModulusPa;
  mechanics[23] = shearModulusPa;
  mechanics[24] = lameLambdaPa;
  mechanics[25] = soundSpeedMPerS;
  mechanics[26] = eosModelId;
  mechanics[27] = 1;
  mechanics[28] = hydrostaticPressurePa;
  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      smoothingLengthM,
      step: 0,
      time: 0,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      step: 0,
      time: 0,
      mechanicsDtS,
      mechanics
    }
  };
}

function nodeOffset(gridSpec, nodeI, nodeJ, nodeK) {
  const [, gny, gnz] = gridSpec.gridDims;
  return (((nodeI + gridSpec.shift) * gny + (nodeJ + gridSpec.shift)) * gnz + (nodeK + gridSpec.shift))
    * MLS_MPM_GPU_GRID_NODE_FLOATS;
}

function summarizeGrid(gridNodes) {
  let mass = 0;
  const momentum = [0, 0, 0];
  let activeNodes = 0;
  for (let offset = 0; offset < gridNodes.length; offset += MLS_MPM_GPU_GRID_NODE_FLOATS) {
    mass += gridNodes[offset];
    momentum[0] += gridNodes[offset + 1];
    momentum[1] += gridNodes[offset + 2];
    momentum[2] += gridNodes[offset + 3];
    if (gridNodes[offset + 7] === 1) activeNodes += 1;
  }
  return { mass, momentum, activeNodes };
}

function maxNodeMomentumAbs(gridNodes) {
  let maxMomentum = 0;
  for (let offset = 0; offset < gridNodes.length; offset += MLS_MPM_GPU_GRID_NODE_FLOATS) {
    maxMomentum = Math.max(
      maxMomentum,
      Math.abs(gridNodes[offset + 1]),
      Math.abs(gridNodes[offset + 2]),
      Math.abs(gridNodes[offset + 3])
    );
  }
  return maxMomentum;
}

function residentProductMassFromRows(rows, overrides = {}) {
  return {
    schema: 'peercompute.ulg.sph-resident-product-mass.v0',
    status: 'resident-product-mass-buffer-retained',
    productEventRows: rows,
    productEventRowCount: rows.length / SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    productEventActiveEventCount: 1,
    unplacedProductMassKg: 3,
    consumeMassPolicy: 'unplaced-product-mass-only',
    eosCouplingStatus: 'resident-product-mass-p2g-eos-sidecar-ready',
    ...overrides
  };
}

function productEventRows({
  position = [1.25, 1.25, 1.25],
  massKg = 4,
  materialId = 300,
  productTermIndex = 0,
  reactionIndex = 0,
  sourceParticleIndex = 0,
  partnerParticleIndex = 1,
  moles = 1,
  routingId = 1,
  phaseId = 3,
  visibleMassKg = 1,
  unplacedMassKg = 3,
  temperatureK = 400,
  restDensityKgPerM3 = 1,
  velocityMPerS = [0, 0, 0],
  supportVolumeM3 = 0,
  effectiveBulkModulusPa = 0,
  shearModulusPa = 0,
  lameLambdaPa = 0,
  soundSpeedMPerS = 0,
  eosModelId = 0,
  solidFlag = 0,
  mechanicsStatus = 1,
  status = 1
} = {}) {
  const rows = new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
  rows[0] = position[0];
  rows[1] = position[1];
  rows[2] = position[2];
  rows[3] = massKg;
  rows[4] = materialId;
  rows[5] = productTermIndex;
  rows[6] = reactionIndex;
  rows[7] = sourceParticleIndex;
  rows[8] = partnerParticleIndex;
  rows[9] = moles;
  rows[10] = routingId;
  rows[11] = phaseId;
  rows[12] = visibleMassKg;
  rows[13] = unplacedMassKg;
  rows[14] = 1;
  rows[15] = massKg / Math.max(moles, 1e-9);
  rows[16] = temperatureK;
  rows[17] = restDensityKgPerM3;
  rows[18] = status;
  rows[20] = velocityMPerS[0];
  rows[21] = velocityMPerS[1];
  rows[22] = velocityMPerS[2];
  rows[23] = supportVolumeM3;
  rows[24] = effectiveBulkModulusPa;
  rows[25] = shearModulusPa;
  rows[26] = lameLambdaPa;
  rows[27] = soundSpeedMPerS;
  rows[28] = eosModelId;
  rows[29] = solidFlag;
  rows[30] = mechanicsStatus;
  return rows;
}

function gpuResidentProductHistory(fixture, {
  routingId = 1,
  rowCapacity = 65,
  liveRowCount = 1,
  generation = 73,
  seal = 0x7a51c30d
} = {}) {
  const { device } = fixture;
  const rows = new Float32Array(
    rowCapacity * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
  );
  rows.set(productEventRows({
    position: [0.5, 0.5, 0.5],
    massKg: 1,
    routingId,
    phaseId: routingId === 1 ? 3 : 2,
    visibleMassKg: 0,
    unplacedMassKg: 1,
    status: 1
  }));
  const productEventBuffer = device.createBuffer({
    label: `mechanics-field-product-history-route-${routingId}`,
    size: rows.byteLength,
    usage: 128 | 4 | 8
  });
  tagWebGpuBufferDevice(productEventBuffer, device);
  device.queue.writeBuffer(productEventBuffer, 0, rows);
  const controlOffsetBytes = 256;
  const controlBuffer = device.createBuffer({
    label: `mechanics-field-product-history-control-route-${routingId}`,
    size: controlOffsetBytes + 256,
    usage: 128 | 4 | 8 | 256
  });
  const residentProductMass = {
    schema: 'peercompute.ulg.sph-resident-product-mass.v0',
    status: 'resident-product-mass-merged-gpu-resident',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: productEventBuffer.size,
    productEventRowCount: rowCapacity,
    productEventStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    productEventActiveEventCount: null,
    unplacedProductMassKg: 1,
    consumeMassPolicy: 'unplaced-product-mass-only',
    eosCouplingStatus: 'resident-product-mass-p2g-eos-sidecar-ready'
  };
  const authority = registerResidentProductEventCountAuthority(
    residentProductMass,
    {
      device,
      controlBuffer,
      controlOffsetBytes,
      rowCapacity,
      rowStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
      generation,
      seal
    }
  );
  device.queue.writeBuffer(
    controlBuffer,
    controlOffsetBytes,
    createResidentProductEventCountControlWords({
      liveRowCount,
      rowCapacity,
      rowStrideVec4: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS / 4,
      generation,
      seal
    })
  );
  return {
    authority,
    controlBuffer,
    controlOffsetBytes,
    productEventBuffer,
    residentProductMass,
    rowCapacity,
    rows
  };
}

function webGpuNavigator() {
  return {
    gpu: {
      async requestAdapter() {
        return {
          async requestDevice() {
            return { lost: new Promise(() => {}) };
          }
        };
      }
    }
  };
}

function fakeP2gDevice() {
  const createdBuffers = [];
  const createdPipelines = [];
  const bindGroups = [];
  const dispatches = [];
  const passTrace = [];
  const writes = [];
  const clears = [];
  const copies = [];
  const submissions = [];
  const shaderModules = [];
  const device = {
    createdBuffers,
    createdPipelines,
    bindGroups,
    dispatches,
    passTrace,
    writes,
    clears,
    copies,
    submissions,
    shaderModules,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 16,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const copy = data instanceof ArrayBuffer
          ? data.slice(0)
          : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        writes.push({
          label: buffer.label,
          offset,
          byteLength: data.byteLength,
          data: copy
        });
      },
      submit(commandBuffers) {
        submissions.push(commandBuffers);
      },
      async onSubmittedWorkDone() {}
    },
    createBuffer(desc) {
      const buffer = {
        label: desc.label,
        size: desc.size,
        usage: desc.usage,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule(desc) {
      shaderModules.push(desc);
      return { code: desc.code };
    },
    createBindGroupLayout(desc) {
      return { entries: desc.entries };
    },
    createPipelineLayout(desc) {
      return { bindGroupLayouts: desc.bindGroupLayouts };
    },
    createComputePipeline(desc) {
      createdPipelines.push(desc);
      return {
        desc,
        getBindGroupLayout() {
          return { entries: [] };
        }
      };
    },
    createBindGroup(desc) {
      bindGroups.push(desc);
      return { entries: desc.entries };
    },
    createCommandEncoder() {
      return {
        clearBuffer(buffer, offset = 0, size = null) {
          clears.push({ buffer, offset, size });
        },
        beginComputePass() {
          let pipeline = null;
          return {
            setPipeline(value) {
              pipeline = value;
            },
            setBindGroup() {},
            dispatchWorkgroups(x, y = 1, z = 1) {
              dispatches.push([x, y, z]);
              passTrace.push({
                kind: 'direct',
                entryPoint: pipeline?.desc?.compute?.entryPoint ?? null
              });
            },
            dispatchWorkgroupsIndirect(buffer, offset = 0) {
              dispatches.push(['indirect', buffer, offset]);
              passTrace.push({
                kind: 'indirect',
                entryPoint: pipeline?.desc?.compute?.entryPoint ?? null
              });
            },
            end() {}
          };
        },
        copyBufferToBuffer(
          source,
          sourceOffset,
          destination,
          destinationOffset,
          size
        ) {
          copies.push({
            source,
            sourceOffset,
            destination,
            destinationOffset,
            size
          });
        },
        finish() {
          return {};
        }
      };
    }
  };
  return device;
}

function canonicalSpatialEpochGenerationFixture(device, {
  directoryBuffer = {
    label: 'retained-schroeder-spatial-directory',
    size: 256
  },
  evidenceBuffer = {
    label: 'retained-schroeder-spatial-evidence',
    size: 80,
    destroyed: false,
    destroy() {
      this.destroyed = true;
    }
  }
} = {}) {
  const exactNearQueryProfile = Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
    status: 'schroeder-spatial-exact-near-query-profile-ready',
    ready: true,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    sourceCount: 1,
    chartId: 0,
    minLevel: -2,
    maxLevel: 2,
    levelCount: 5,
    baseGridSpacingM: 0.25,
    levelSpacingMode: 'base-grid-spacing-times-pow2-level',
    positionAuthority: 'same-epoch-pre-integration-particle-state',
    storageGeneration: 23,
    physicsTick: 53,
    physicsSubstep: 59,
    positionEpoch: 29,
    topologyEpoch: 31,
    chartEpoch: 61,
    levelEpoch: 67,
    supportEpoch: 71
  });
  tagWebGpuBufferDevice(directoryBuffer, device);
  tagWebGpuBufferDevice(evidenceBuffer, device);
  return {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    selected: true,
    ready: true,
    source: { phaseVolumeAssignmentOverlayEnabled: false },
    execution: {
      schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
      submitPerformed: true,
      directoryBuffer,
      evidenceBuffer,
      evidenceBufferByteLength: 80,
      mechanicsEvidenceOffsetBytes: 16,
      mechanicsEvidenceByteLength: 64,
      sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
      exactNearQueryProfile,
      queryGeometryEvidence: exactNearQueryProfile,
      generationId: 17,
      storageGeneration: 23,
      positionEpoch: 29,
      topologyEpoch: 31,
      deviceOrdinal: 37,
      laneOrdinal: 41,
      leaseToken: 43,
      sourceFamilyId: 47,
      physicsTick: 53,
      physicsSubstep: 59,
      chartEpoch: 61,
      levelEpoch: 67,
      supportEpoch: 71,
      layout: { byteLength: 256 }
    }
  };
}

function fusedP2gProducerFixture({
  fineSubstepCount = 1,
  createMacroAuthority: shouldCreateMacroAuthority = true,
  mechanicsLevelCount = 2
} = {}) {
  const device = fakeP2gDevice();
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    position: [0.5, 0.5, 0.5],
    smoothingLengthM: 0.25,
    mechanicsDtS: 0.005
  });
  const stateBuffer = device.createBuffer({
    label: 'fused-p2g-state',
    size: sphParticleState.state.byteLength,
    usage: 128
  });
  const thermoBuffer = device.createBuffer({
    label: 'fused-p2g-thermo',
    size: sphParticleState.thermo.byteLength,
    usage: 128
  });
  const identityBuffer = device.createBuffer({
    label: 'fused-p2g-identity',
    size: Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const mechanicsBuffer = device.createBuffer({
    label: 'fused-p2g-mechanics',
    size: mlsMpmParticleState.mechanics.byteLength,
    usage: 128
  });
  const assignmentBuffer = device.createBuffer({
    label: 'fused-p2g-assignment',
    size: 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  for (const buffer of [
    stateBuffer,
    thermoBuffer,
    identityBuffer,
    mechanicsBuffer,
    assignmentBuffer
  ]) {
    tagWebGpuBufferDevice(buffer, device);
  }
  const levelAssignment = {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount: 1,
    assignmentStrideFloats: 16,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    sourceStateBuffer: stateBuffer,
    sourceStateBufferBorrowed: true,
    sourceThermoBuffer: thermoBuffer,
    sourceThermoBufferBorrowed: true,
    sourceThermoBufferByteLength: thermoBuffer.size,
    sourceMechanicsBuffer: mechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    sourceMechanicsBufferByteLength: mechanicsBuffer.size,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 19,
    chartEpoch: 23,
    levelEpoch: 29,
    supportEpoch: 31,
    minLevel: 0,
    maxLevel: mechanicsLevelCount > 1 ? 1 : 0,
    chartId: 0,
    baseGridSpacingM: 0.25
  };
  const fineGrid = createMlsMpmGridSpec({
    boxDimsM: [1, 1, 1],
    gridSpacingM: 0.25
  });
  const coarseGrid = createMlsMpmGridSpec({
    boxDimsM: [1, 1, 1],
    gridSpacingM: 0.5
  });
  fineGrid.gridShift = fineGrid.shift;
  coarseGrid.gridShift = coarseGrid.shift;
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: 1,
    particleIdentityBuffer: identityBuffer,
    particleIdentityStrideWords: 1,
    mechanicsLevels: [
      { selectedLevel: 0, mechanicsGrid: fineGrid },
      { selectedLevel: 1, mechanicsGrid: coarseGrid }
    ].slice(0, mechanicsLevelCount)
  });
  assert.equal(
    generation.ready,
    true,
    `${generation.status}: ${generation.reason ?? 'no reason'}`
  );
  if (mechanicsLevelCount > 1) {
    assert.ok(generation.parentFieldView);
  } else {
    assert.equal(generation.parentFieldView, null);
    assert.equal(generation.mechanicsFieldView?.selectedLevel, 0);
  }
  const sphParticleUpload = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount: 1,
    stateBuffer,
    thermoBuffer,
    identityBuffer,
    stateStrideBytes: 8 * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes: 12 * Float32Array.BYTES_PER_ELEMENT,
    identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
    stateBufferByteLength: stateBuffer.size,
    thermoBufferByteLength: thermoBuffer.size,
    identityBufferByteLength: identityBuffer.size,
    storageGeneration: levelAssignment.storageGeneration,
    bufferFamilyGeneration: levelAssignment.storageGeneration,
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    physicsTick: levelAssignment.physicsTick,
    physicsSubstep: levelAssignment.physicsSubstep,
    positionEpoch: levelAssignment.positionEpoch,
    topologyEpoch: levelAssignment.topologyEpoch,
    chartEpoch: levelAssignment.chartEpoch,
    levelEpoch: levelAssignment.levelEpoch,
    supportEpoch: levelAssignment.supportEpoch
  };
  const mlsMpmParticleUpload = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount: 1,
    mechanicsBuffer,
    mechanicsStrideBytes:
      MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT,
    mechanicsBufferByteLength: mechanicsBuffer.size,
    storageGeneration: levelAssignment.storageGeneration,
    bufferFamilyGeneration: levelAssignment.storageGeneration,
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    physicsTick: levelAssignment.physicsTick,
    physicsSubstep: levelAssignment.physicsSubstep,
    positionEpoch: levelAssignment.positionEpoch,
    topologyEpoch: levelAssignment.topologyEpoch,
    chartEpoch: levelAssignment.chartEpoch,
    levelEpoch: levelAssignment.levelEpoch,
    supportEpoch: levelAssignment.supportEpoch
  };
  const canonicalEpoch = {
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload
  };
  if (!shouldCreateMacroAuthority) {
    return {
      device,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      canonicalEpoch,
      generation,
      levelAssignment,
      fineGrid,
      coarseGrid,
      macroAuthority: null,
      microepochAuthority: null,
      particleContinuation: null,
      transaction: null,
      refluxLedger: null,
      fineSubstepCount,
      fineDt: 0.005,
      macroDt: Math.fround(0.005 * fineSubstepCount),
      predictorThetaDt: 0.005
    };
  }
  const refluxLedger = createSchroederCrossLevelRefluxLedgerGpu(device, {
    parentFieldCapacity: generation.parentFieldView.parentFieldCapacity,
    coarseFieldCapacity: generation.parentFieldView.coarseFieldCapacity,
    completionOrdinal: generation.execution.generationId,
    fineSubstepCount,
    fineLevel: 0,
    coarseLevel: 1,
    coarseGridSpacingM:
      generation.parentFieldView.coarseFieldView.gridSpacingM
  });
  const macroAuthority = createSchroederTwoLevelMacroAuthority({
    device,
    canonicalEpoch,
    refluxLedger,
    fineSubstepCount,
    fineLevel: 0,
    coarseLevel: 1,
    fineDt: 0.005,
    macroDt: Math.fround(0.005 * fineSubstepCount)
  });
  const particleContinuation = createSchroederCanonicalParticleContinuation({
    device,
    macroAuthority,
    sphParticleUpload,
    mlsMpmParticleUpload,
    ordinal: 0
  });
  const microepochAuthority = createSchroederFineMicroepochAuthority({
    device,
    macroAuthority,
    canonicalEpoch,
    particleContinuation,
    substepOrdinal: 0
  });
  const transaction = createSchroederFusedFineSubstepTransaction({
    device,
    macroAuthority,
    microepochAuthority,
    particleContinuation,
    substepOrdinal: 0
  });
  return {
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    canonicalEpoch,
    generation,
    levelAssignment,
    fineGrid,
    coarseGrid,
    macroAuthority,
    microepochAuthority,
    particleContinuation,
    transaction,
    refluxLedger,
    fineSubstepCount,
    fineDt: 0.005,
    macroDt: Math.fround(0.005 * fineSubstepCount),
    predictorThetaDt: 0.005
  };
}

function runFusedP2gProducer(
  fixture,
  sphParticleUpload = fixture.sphParticleUpload,
  projectionDt = fixture.fineDt
) {
  return runMlsMpmP2gGridProjectionWebGpu({
    device: fixture.device,
    sphParticleState: fixture.sphParticleState,
    mlsMpmParticleState: fixture.mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: fixture.generation,
    canonicalSpatialRequired: true,
    mechanicsFieldMode: 'required',
    canonicalParticleContinuation: fixture.particleContinuation,
    fusedFineSubstepTransaction: fixture.transaction,
    gridSpacingM: 0.25,
    boxDimsM: [1, 1, 1],
    dt: projectionDt,
    readbackMode: 'no-full-readback'
  });
}

function runTerminalP2gProducer(fixture, {
  transaction,
  generation,
  continuation,
  sphParticleUpload,
  mlsMpmParticleUpload
}, overrides = {}) {
  return runMlsMpmP2gGridProjectionWebGpu({
    device: fixture.device,
    sphParticleState: fixture.sphParticleState,
    mlsMpmParticleState: fixture.mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederSelectedLevel: transaction.macroAuthority.coarseLevel,
    schroederSpatialEpochGeneration: generation,
    canonicalSpatialRequired: true,
    mechanicsFieldMode: 'required',
    canonicalParticleContinuation: continuation,
    fusedCoarseTerminalTransaction: transaction,
    gridSpacingM: transaction.coarseFieldView.gridSpacingM,
    boxDimsM: [1, 1, 1],
    dt: transaction.macroAuthority.macroDt,
    readbackMode: 'no-full-readback',
    ...overrides
  });
}

function runFusedGridUpdateProducer(fixture, p2gProjection, overrides = {}) {
  return runMlsMpmGridUpdateWebGpu({
    device: fixture.device,
    p2gGridProjection: p2gProjection,
    mechanicsFieldMode: 'required',
    fusedFineSubstepTransaction: fixture.transaction,
    mechanicsFieldEnergyReceipt: { deferSeal: true },
    dt: 0.005,
    gravityMPerS2: [0, -9.80665, 0],
    boxDimsM: [1, 1, 1],
    cflFactor: 0.4,
    readbackMode: 'no-full-readback',
    ...overrides
  });
}

function runCoarseP2gProducer(
  fixture,
  projectionDt = fixture.predictorThetaDt
) {
  return runMlsMpmP2gGridProjectionWebGpu({
    device: fixture.device,
    sphParticleState: fixture.sphParticleState,
    mlsMpmParticleState: fixture.mlsMpmParticleState,
    sphParticleUpload: fixture.sphParticleUpload,
    mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
    schroederSelectedLevel: 1,
    schroederSpatialEpochGeneration: fixture.generation,
    canonicalSpatialRequired: true,
    mechanicsFieldMode: 'required',
    gridSpacingM: 0.5,
    boxDimsM: [1, 1, 1],
    dt: projectionDt,
    readbackMode: 'no-full-readback'
  });
}

async function fusedFineCorrectionWorkspace(fixture) {
  const fineProjection = await runFusedP2gProducer(fixture);
  const coarseProjection = await runCoarseP2gProducer(fixture);
  const runtime = createSchroederSpatialParentFieldMechanicsWorkspaceGpu(
    fixture.device,
    {
      parentFieldCapacity: fixture.generation.parentFieldView.parentFieldCapacity,
      fineFieldCapacity: fixture.generation.parentFieldView.fineFieldCapacity,
      arenaCount: 1
    }
  );
  const predictorEncoder = fixture.device.createCommandEncoder();
  const execution = runtime.encodePredictors(predictorEncoder, {
    parentFieldView: fixture.generation.parentFieldView,
    fineP2gProjection: fineProjection,
    coarseP2gProjection: coarseProjection,
    dt: fixture.predictorThetaDt,
    fineDt: fixture.fineDt,
    macroDt: fixture.macroDt,
    fineSubstepOrdinal: 0,
    fineSubstepCount: fixture.fineSubstepCount,
    gravityMPerS2: [0, -9.80665, 0],
    boxDimsM: [1, 1, 1],
    refluxLedger: fixture.refluxLedger,
    fusedFineSubstepTransaction: fixture.transaction
  });
  fixture.device.queue.submit([predictorEncoder.finish()]);
  runtime.markPredictorsSubmitted(execution);
  const gridUpdate = await runFusedGridUpdateProducer(fixture, fineProjection);
  return {
    runtime,
    execution,
    fineProjection,
    coarseProjection,
    gridUpdate
  };
}

async function submittedFusedFineCorrection(fixture) {
  const chain = await fusedFineCorrectionWorkspace(fixture);
  const encoder = fixture.device.createCommandEncoder();
  const correction = chain.runtime.encodeFineCorrection(
    encoder,
    chain.execution,
    {
      fineGridUpdate: chain.gridUpdate,
      fusedFineSubstepTransaction: fixture.transaction
    }
  );
  fixture.device.queue.submit([encoder.finish()]);
  chain.runtime.markTerminalSubmissionObserved(chain.execution);
  chain.runtime.markTerminalSubmitted(chain.execution);
  return { ...chain, correction };
}

function runFusedG2pProducer(fixture, correction, overrides = {}) {
  return runMlsMpmG2pWebGpu({
    device: fixture.device,
    sphParticleState: fixture.sphParticleState,
    mlsMpmParticleState: fixture.mlsMpmParticleState,
    gridUpdate: correction,
    sphParticleUpload: fixture.sphParticleUpload,
    mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
    dt: fixture.fineDt,
    boxDimsM: [1, 1, 1],
    internalPressureScale: correction.sourceProjection.internalPressureScale,
    liquidWallDampingAlpha: 0,
    liquidWallDampingDistanceM: 0,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: fixture.generation,
    schroederSpatialMechanicalProposal: null,
    fusedFineSubstepTransaction: fixture.transaction,
    canonicalSpatialRequired: true,
    mechanicsFieldMode: 'required',
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback',
    ...overrides
  });
}

function nextParticleUploads(fixture, g2p) {
  const storageGeneration = fixture.levelAssignment.storageGeneration + 1;
  const physicsSubstep = fixture.levelAssignment.physicsSubstep + 1;
  const positionEpoch = fixture.levelAssignment.positionEpoch + 1;
  const identity = {
    storageGeneration,
    bufferFamilyGeneration: storageGeneration,
    bufferFamilyGenerationStatus:
      'resident-particle-buffer-family-generation-advanced',
    physicsTick: fixture.levelAssignment.physicsTick,
    physicsSubstep,
    positionEpoch,
    topologyEpoch: fixture.levelAssignment.topologyEpoch,
    chartEpoch: fixture.levelAssignment.chartEpoch,
    levelEpoch: fixture.levelAssignment.levelEpoch,
    supportEpoch: fixture.levelAssignment.supportEpoch
  };
  return {
    sphParticleUpload: {
      ...fixture.sphParticleUpload,
      ...identity,
      stateBuffer: g2p.stateBuffer,
      stateBufferByteLength: g2p.stateBufferByteLength
    },
    mlsMpmParticleUpload: {
      ...fixture.mlsMpmParticleUpload,
      ...identity,
      mechanicsBuffer: g2p.mechanicsBuffer,
      mechanicsBufferByteLength: g2p.mechanicsBufferByteLength
    }
  };
}

function frozenSuccessorLevelAssignment(fixture, uploads) {
  const runtime = createSchroederFrozenLevelAssignmentRefreshGpu(
    fixture.device,
    {
      maxParticleCount: fixture.levelAssignment.particleCount,
      arenaCount: 1
    }
  );
  const options = {
    priorLevelAssignment: fixture.levelAssignment,
    currentSphParticleUpload: uploads.sphParticleUpload,
    currentMlsMpmParticleUpload: uploads.mlsMpmParticleUpload,
    physicsTick: uploads.sphParticleUpload.physicsTick,
    physicsSubstep: uploads.sphParticleUpload.physicsSubstep
  };
  const frozenFineSubstepAuthorityProof =
    runtime.proveFineSubstepAuthority(options);
  const encoder = fixture.device.createCommandEncoder();
  const levelAssignment = runtime.encode(encoder, {
    ...options,
    frozenFineSubstepAuthorityProof
  });
  fixture.device.queue.submit([encoder.finish()]);
  assert.equal(runtime.markExecutionSubmitted(levelAssignment), true);
  return { levelAssignment, runtime };
}

async function releaseFusedG2pFixture(fixture, chain, reason) {
  await chain.runtime.releaseExecutionAfter(
    chain.execution,
    fixture.device.queue.onSubmittedWorkDone()
  );
  chain.runtime.destroy();
  await abortSchroederTwoLevelMacroAuthorityAfter(
    fixture.device,
    fixture.macroAuthority,
    {
      microepochAuthority: fixture.microepochAuthority,
      reason: new Error(reason)
    }
  );
  fixture.refluxLedger.destroy();
}

test('required mechanics-field P2G rejects resident product history without exact GPU live-count authority', async () => {
  const fixture = fusedP2gProducerFixture({
    createMacroAuthority: false,
    mechanicsLevelCount: 1
  });
  const residentProductMass = residentProductMassFromRows(productEventRows({
    position: [0.5, 0.5, 0.5],
    massKg: 1,
    visibleMassKg: 0,
    unplacedMassKg: 1,
    status: 1
  }));
  const submissionCountBefore = fixture.device.submissions.length;

  await assert.rejects(
    runMlsMpmP2gGridProjectionWebGpu({
      device: fixture.device,
      sphParticleState: fixture.sphParticleState,
      mlsMpmParticleState: fixture.mlsMpmParticleState,
      sphParticleUpload: fixture.sphParticleUpload,
      mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
      schroederSelectedLevel: 0,
      schroederSpatialEpochGeneration: fixture.generation,
      canonicalSpatialRequired: true,
      mechanicsFieldMode: 'required',
      residentProductMass,
      gridSpacingM: 0.25,
      boxDimsM: [1, 1, 1],
      dt: 0.005,
      readbackMode: 'no-full-readback'
    }),
    /Mechanics-field P2G requires an exact GPU-authored product-event live-count authority/
  );
  assert.equal(fixture.device.submissions.length, submissionCountBefore);
});

test('required mechanics-field P2G admits exact gas-only GPU product history without scatter, readback, or host fence', async () => {
  const fixture = fusedP2gProducerFixture({
    createMacroAuthority: false,
    mechanicsLevelCount: 1
  });
  const history = gpuResidentProductHistory(fixture, { routingId: 1 });
  const originalFence = fixture.device.queue.onSubmittedWorkDone;
  let hostQueueFenceCount = 0;
  fixture.device.queue.onSubmittedWorkDone = (...args) => {
    hostQueueFenceCount += 1;
    return originalFence.apply(fixture.device.queue, args);
  };
  const traceStart = fixture.device.passTrace.length;
  const dispatchStart = fixture.device.dispatches.length;
  const bufferStart = fixture.device.createdBuffers.length;
  const fieldRuntime = fixture.generation.mechanicsFieldView.ownerRuntime;
  const fieldExecution = fixture.generation.mechanicsFieldView;
  const candidateKeyEntries = fieldRuntime.allocationEntries().filter(
    ({ role }) => (
      role === 'mechanics-field-candidate-keys'
    )
  );
  assert.equal(candidateKeyEntries.length, fieldRuntime.arenaCount);
  assert.equal(
    Number(fieldExecution.candidateKeyBuffer?.size),
    fieldExecution.layout.candidateCapacity
      * MECHANICS_FIELD_P2G_CONTRIBUTION_FLOATS
      * Float32Array.BYTES_PER_ELEMENT
  );
  const projection = await runMlsMpmP2gGridProjectionWebGpu({
    device: fixture.device,
    sphParticleState: fixture.sphParticleState,
    mlsMpmParticleState: fixture.mlsMpmParticleState,
    sphParticleUpload: fixture.sphParticleUpload,
    mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: fixture.generation,
    canonicalSpatialRequired: true,
    mechanicsFieldMode: 'required',
    residentProductMass: history.residentProductMass,
    gridSpacingM: 0.25,
    boxDimsM: [1, 1, 1],
    dt: 0.005,
    readbackMode: 'no-full-readback'
  });

  assert.equal(hostQueueFenceCount, 0);
  assert.equal(projection.fullReadbackPerformed, false);
  assert.equal(projection.normalHotLoopReadbackFree, true);
  assert.equal(
    projection.mechanicsFieldP2gContributionBufferOwnership,
    'mechanics-field-candidate-arena-phase-alias'
  );
  assert.equal(
    projection.mechanicsFieldP2gContributionBufferAllocatedBytes,
    0
  );
  assert.equal(
    projection.mechanicsFieldP2gContributionBufferRequiredBytes,
    Number(fieldExecution.candidateKeyBuffer.size)
  );
  assert.equal(
    projection.mechanicsFieldP2gContributionBufferCapacityBytes,
    Number(fieldExecution.candidateKeyBuffer.size)
  );
  assert.equal(
    projection.mechanicsFieldP2gContributionBufferAllocationPerformed,
    false
  );
  assert.equal(
    fixture.device.createdBuffers
      .slice(bufferStart)
      .some(({ label }) => (
        label === 'ulg-mls-mpm-staged-p2g-deterministic-field-contributions'
      )),
    false,
    'the resident P2G call must not allocate a fresh contribution buffer'
  );
  assert.equal(
    candidateKeyEntries.every(({ buffer }) => buffer.destroyed === false),
    true
  );
  assert.equal(
    fixture.device.bindGroups.some(({ entries }) => (
      entries?.find(({ binding }) => binding === 5)?.resource?.buffer
        === fieldExecution.candidateKeyBuffer
    )),
    true,
    'staged P2G must bind the exact live field-arena candidate phase alias'
  );
  assert.equal(projection.residentProductMassCoupledEventCount, 0);
  assert.equal(projection.residentProductMassCoupledUnplacedMassKg, 0);
  assert.equal(
    projection.residentProductMassProductEventDispatchMode,
    'gpu-authenticated-gas-only-no-mechanics-scatter'
  );
  assert.equal(
    projection.residentProductMassGridCouplingStatus,
    'resident-product-mass-gas-only-certified-no-mechanics-p2g-scatter'
  );
  assert.equal(
    fixture.device.createdBuffers
      .slice(bufferStart)
      .some((buffer) => (buffer.usage & 1) !== 0),
    false
  );
  assert.equal(
    fixture.device.copies.some(
      (copy) => copy.source === history.controlBuffer
    ),
    false,
    'mechanics-field admission binds the control record directly'
  );

  const mechanicsParamsWrite = fixture.device.writes.findLast(
    (write) => write.label === 'ulg-mls-mpm-p2g-mechanics-field-params'
  );
  assert.ok(mechanicsParamsWrite);
  assert.equal(
    new DataView(mechanicsParamsWrite.data).getUint32(36, true),
    0,
    'mechanics P2G retains zero resident-product scatter count'
  );
  const certificateParamsWrite = fixture.device.writes.findLast(
    (write) => write.label
      === 'ulg-mls-mpm-p2g-mechanics-field-product-route-certificate-params'
  );
  assert.ok(certificateParamsWrite);
  assert.equal(certificateParamsWrite.byteLength, 32);
  const certificateParams = new Uint32Array(certificateParamsWrite.data);
  assert.deepEqual(Array.from(certificateParams.slice(3, 7)), [
    history.authority.generation,
    history.authority.seal,
    history.rowCapacity,
    SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS / 4
  ]);

  const certificateBindGroup = fixture.device.bindGroups.findLast(
    ({ entries }) => entries?.some(
      (entry) => entry.binding === 0
        && entry.resource?.buffer === history.productEventBuffer
    ) && entries?.some(
      (entry) => entry.binding === 2
        && entry.resource?.buffer === history.controlBuffer
    )
  );
  assert.ok(certificateBindGroup);
  assert.deepEqual(
    certificateBindGroup.entries.find((entry) => entry.binding === 2)
      .resource,
    {
      buffer: history.controlBuffer,
      offset: history.controlOffsetBytes,
      size: 32
    }
  );
  const trace = fixture.device.passTrace.slice(traceStart);
  const certificateTraceIndex = trace.findIndex(
    ({ entryPoint }) => entryPoint === 'certify_resident_product_gas_only'
  );
  assert.equal(
    trace.filter(
      ({ entryPoint }) => entryPoint === 'certify_resident_product_gas_only'
    ).length,
    1
  );
  assert.deepEqual(
    fixture.device.dispatches[dispatchStart + certificateTraceIndex],
    [2, 1, 1],
    '65 capacity rows are covered by two 64-lane workgroups'
  );
  assert.equal(
    trace.some(({ entryPoint }) => entryPoint === 'scatter_product_events'),
    false
  );
  fixture.device.queue.onSubmittedWorkDone = originalFence;
});

test('mechanics-field product-route certificate structurally fail-closes a live condensed residual before validation', async () => {
  const fixture = fusedP2gProducerFixture({
    createMacroAuthority: false,
    mechanicsLevelCount: 1
  });
  const history = gpuResidentProductHistory(fixture, { routingId: 0 });
  assert.equal(history.rows[10], 0);
  assert.equal(history.rows[13], 1);
  const traceStart = fixture.device.passTrace.length;
  const pipelineStart = fixture.device.createdPipelines.length;

  await runMlsMpmP2gGridProjectionWebGpu({
    device: fixture.device,
    sphParticleState: fixture.sphParticleState,
    mlsMpmParticleState: fixture.mlsMpmParticleState,
    sphParticleUpload: fixture.sphParticleUpload,
    mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: fixture.generation,
    canonicalSpatialRequired: true,
    mechanicsFieldMode: 'required',
    residentProductMass: history.residentProductMass,
    gridSpacingM: 0.25,
    boxDimsM: [1, 1, 1],
    dt: 0.005,
    readbackMode: 'no-full-readback'
  });

  assert.match(
    mlsMpmMechanicsFieldProductRouteCertificateWgsl,
    /product_events\[row_base \+ 2u\]\.z/
  );
  assert.match(
    mlsMpmMechanicsFieldProductRouteCertificateWgsl,
    /product_events\[row_base \+ 3u\]\.y/
  );
  assert.match(
    mlsMpmMechanicsFieldProductRouteCertificateWgsl,
    /unplaced_mass_kg > 0\.0 && routing_id != PRODUCT_ROUTE_GAS/
  );
  assert.match(
    mlsMpmMechanicsFieldProductRouteCertificateWgsl,
    /atomicOr\(&mechanics_field_view\[2u\], FIELD_PRODUCT_ROUTE_REJECTED\)/
  );
  assert.match(
    mlsMpmMechanicsFieldProductRouteCertificateWgsl,
    /product_history_control\[6u\] == certificate\.expected_generation/
  );
  assert.equal(
    fixture.device.createdPipelines.slice(pipelineStart).some(
      ({ compute }) => compute?.entryPoint
        === 'certify_resident_product_gas_only'
    ),
    true
  );
  assert.equal(
    fixture.device.createdPipelines.slice(pipelineStart).some(
      ({ compute }) => compute?.entryPoint === 'scatter_product_events'
    ),
    false
  );
  const entryPoints = fixture.device.passTrace
    .slice(traceStart)
    .map(({ entryPoint }) => entryPoint);
  const finalPreflightIndex = entryPoints.indexOf(
    'preflight_mechanics_field_layout'
  );
  const certificateIndex = entryPoints.indexOf(
    'certify_resident_product_gas_only'
  );
  const validationIndex = entryPoints.indexOf(
    'validate_compact_mechanics_nodes'
  );
  const clearIndex = entryPoints.indexOf('clear_accumulators');
  assert.ok(finalPreflightIndex >= 0);
  assert.ok(certificateIndex > finalPreflightIndex);
  assert.ok(validationIndex > certificateIndex);
  assert.ok(clearIndex > validationIndex);
});

test('canonical spatial v2 dense P2G authenticates one exact level and preserves resident product scatter', async () => {
  const fixture = fusedP2gProducerFixture({
    createMacroAuthority: false,
    mechanicsLevelCount: 1
  });
  const residentProductMass = residentProductMassFromRows(productEventRows({
    position: [0.5, 0.5, 0.5],
    massKg: 1,
    visibleMassKg: 0,
    unplacedMassKg: 1,
    status: 1
  }));
  const createdBufferCountBeforeP2g =
    fixture.device.createdBuffers.length;
  const submissionCountBeforeP2g = fixture.device.submissions.length;
  const originalP2gFence = fixture.device.queue.onSubmittedWorkDone;
  let p2gHostQueueFenceCount = 0;
  fixture.device.queue.onSubmittedWorkDone = (...args) => {
    p2gHostQueueFenceCount += 1;
    return originalP2gFence.apply(fixture.device.queue, args);
  };

  const projection = await runMlsMpmP2gGridProjectionWebGpu({
    device: fixture.device,
    sphParticleState: fixture.sphParticleState,
    mlsMpmParticleState: fixture.mlsMpmParticleState,
    sphParticleUpload: fixture.sphParticleUpload,
    mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: fixture.generation,
    canonicalSpatialRequired: true,
    mechanicsFieldMode: 'disabled',
    residentProductMass,
    gridSpacingM: 0.25,
    boxDimsM: [1, 1, 1],
    dt: 0.005,
    retainGridBuffer: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(projection.activeSourceDenseCompatibilityEnabled, true);
  assert.equal(
    projection.activeSourceDenseCompatibilityScope,
    'single-level-exact-query'
  );
  assert.equal(
    projection.activeSourceDenseCompatibilityPreflight,
    'gpu-one-workgroup-before-particle-and-product-scatter'
  );
  assert.equal(
    projection.gridStateAuthority,
    'dense-mls-mpm-grid-state-v2-active-source-product-aware'
  );
  assert.equal(projection.residentProductMassInputProductEventCount, 1);
  assert.equal(projection.residentProductMassCoupledEventCount, 1);
  assert.equal(projection.readbackMode, 'no-full-readback');
  assert.equal(projection.fullReadbackPerformed, false);
  assert.ok(projection.gridBuffer);
  assert.equal(
    fixture.device.submissions.length,
    submissionCountBeforeP2g + 1
  );
  assert.equal(fixture.device.submissions.at(-1).length, 1);
  assert.equal(p2gHostQueueFenceCount, 0);
  assert.equal(projection.hostQueueFenceCount, 0);
  assert.equal(projection.normalHotLoopReadbackFree, true);
  assert.equal(projection.queueOrderedCleanupReceipt?.completed, true);
  assert.equal(
    projection.queueOrderedCleanupReceipt?.hostQueueFenceCount,
    0
  );
  const p2gAttemptBuffers = fixture.device.createdBuffers.slice(
    createdBufferCountBeforeP2g
  );
  assert.ok(p2gAttemptBuffers.length > 1);
  assert.equal(
    p2gAttemptBuffers.every((buffer) => (
      buffer === projection.gridBuffer || buffer.destroyed === true
    )),
    true
  );
  assert.equal(projection.gridBuffer.destroyed, false);
  fixture.device.queue.onSubmittedWorkDone = originalP2gFence;

  const paramsWrite = fixture.device.writes.findLast(
    (write) => write.label === 'ulg-mls-mpm-p2g-active-source-v2-dense-params'
  );
  assert.ok(paramsWrite);
  assert.equal(paramsWrite.byteLength, 224);
  const params = new DataView(paramsWrite.data);
  assert.equal(
    params.getUint32(144, true),
    fixture.generation.activeSourceView.physicalSourceCapacity
  );
  assert.equal(
    params.getUint32(148, true),
    fixture.generation.activeSourceView.activeSourceCapacity
  );
  assert.equal(
    params.getUint32(172, true),
    fixture.generation.activeSourceView.buildOrdinal
  );
  assert.ok(params.getUint32(172, true) > 0);
  for (let offset = 176; offset < 224; offset += 4) {
    assert.equal(params.getUint32(offset, true), 0);
  }

  const denseBindGroup = fixture.device.bindGroups.findLast(
    (bindGroup) => bindGroup.entries.some(
      (entry) => entry.binding === 6
        && entry.resource?.buffer === projection.gridBuffer
    )
  );
  assert.ok(denseBindGroup);
  assert.equal(
    denseBindGroup.entries.find((entry) => entry.binding === 7)
      ?.resource?.buffer,
    fixture.generation.execution.evidenceBuffer
  );
  assert.equal(
    denseBindGroup.entries.find((entry) => entry.binding === 8)
      ?.resource?.buffer,
    fixture.generation.activeSourceView.activeSourceViewBuffer
  );

  const entryPoints = fixture.device.passTrace.map(
    (pass) => pass.entryPoint
  );
  const preflightIndex = entryPoints.indexOf(
    'preflight_active_source_dense_single_level'
  );
  const mainIndex = entryPoints.indexOf('main', preflightIndex + 1);
  const productIndex = entryPoints.indexOf(
    'scatter_product_events',
    mainIndex + 1
  );
  const finalizeIndex = entryPoints.indexOf(
    'finalize_grid',
    productIndex + 1
  );
  assert.ok(preflightIndex >= 0);
  assert.ok(mainIndex > preflightIndex);
  assert.ok(productIndex > mainIndex);
  assert.ok(finalizeIndex > productIndex);
  assert.equal(
    fixture.device.createdBuffers.some((buffer) => (buffer.usage & 1) !== 0),
    false
  );

  assert.equal(validateLocallySubmittedMlsMpmActiveSourceDenseP2g(
    fixture.device,
    projection,
    {
      schroederSpatialEpochGeneration: fixture.generation,
      selectedLevel: 0,
      gridBuffer: projection.gridBuffer,
      requireNoFullReadback: true
    }
  ), true);
  assert.equal(validateLocallySubmittedMlsMpmActiveSourceDenseP2g(
    fixture.device,
    { ...projection },
    {
      schroederSpatialEpochGeneration: fixture.generation,
      selectedLevel: 0,
      gridBuffer: projection.gridBuffer,
      requireNoFullReadback: true
    }
  ), false);

  const gridUpdate = await runMlsMpmGridUpdateWebGpu({
    device: fixture.device,
    p2gGridProjection: projection,
    mechanicsFieldMode: 'disabled',
    dt: 0.005,
    gravityMPerS2: [0, -9.80665, 0],
    boxDimsM: [1, 1, 1],
    cflFactor: 0.4,
    retainUpdatedGridBuffer: true,
    readbackMode: 'no-full-readback'
  });
  assert.equal(gridUpdate.sourceProjection, projection);
  assert.equal(gridUpdate.activeSourceDenseCompatibilityEnabled, true);
  assert.equal(
    gridUpdate.gridStateAuthority,
    'dense-mls-mpm-grid-state-v2-active-source-product-aware'
  );
  assert.equal(gridUpdate.readbackMode, 'no-full-readback');
  assert.equal(gridUpdate.fullReadbackPerformed, false);
  assert.ok(gridUpdate.updatedGridBuffer);
  assert.equal(validateLocallySubmittedMlsMpmActiveSourceDenseGridUpdate(
    fixture.device,
    gridUpdate,
    {
      sourceProjection: projection,
      schroederSpatialEpochGeneration: fixture.generation,
      selectedLevel: 0,
      updatedGridBuffer: gridUpdate.updatedGridBuffer,
      revalidateSourceProjection: true
    }
  ), true);
  assert.equal(validateLocallySubmittedMlsMpmActiveSourceDenseGridUpdate(
    fixture.device,
    { ...gridUpdate },
    {
      sourceProjection: projection,
      schroederSpatialEpochGeneration: fixture.generation,
      selectedLevel: 0,
      updatedGridBuffer: gridUpdate.updatedGridBuffer,
      revalidateSourceProjection: true
    }
  ), false);

  const denseG2pArgs = {
    device: fixture.device,
    sphParticleState: fixture.sphParticleState,
    mlsMpmParticleState: fixture.mlsMpmParticleState,
    sphParticleUpload: fixture.sphParticleUpload,
    mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
    dt: 0.005,
    boxDimsM: [1, 1, 1],
    internalPressureScale: projection.internalPressureScale,
    liquidWallDampingAlpha: 0,
    liquidWallDampingDistanceM: 0,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: fixture.generation,
    canonicalSpatialRequired: true,
    mechanicsFieldMode: 'disabled',
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback'
  };
  const submissionCountBeforeCopiedGridUpdate =
    fixture.device.submissions.length;
  const outputBufferCountBeforeCopiedGridUpdate =
    fixture.device.createdBuffers.filter(
      (buffer) => buffer.label === 'ulg-mls-mpm-g2p-state-out'
        || buffer.label === 'ulg-mls-mpm-g2p-mechanics-out'
    ).length;
  await assert.rejects(
    runMlsMpmG2pWebGpu({
      ...denseG2pArgs,
      gridUpdate: { ...gridUpdate }
    }),
    (error) => {
      assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
      assert.equal(
        error.status,
        'active-source-v2-dense-grid-update-provenance-rejected'
      );
      return true;
    }
  );
  assert.equal(
    fixture.device.submissions.length,
    submissionCountBeforeCopiedGridUpdate
  );
  assert.equal(
    fixture.device.createdBuffers.filter(
      (buffer) => buffer.label === 'ulg-mls-mpm-g2p-state-out'
        || buffer.label === 'ulg-mls-mpm-g2p-mechanics-out'
    ).length,
    outputBufferCountBeforeCopiedGridUpdate
  );

  const mechanicalProposal =
    runSchroederSpatialMechanicalProposalWebGpu({
      device: fixture.device,
      generation: fixture.generation,
      sphParticleState: fixture.sphParticleState,
      mlsMpmParticleState: fixture.mlsMpmParticleState,
      sphParticleUpload: fixture.sphParticleUpload,
      mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
      boxDimsM: [1, 1, 1],
      gridSpacingM: 0.25,
      relaxation: 0,
      normalVelocityDamping: 0,
      selectedLevel: 0
    });
  assert.equal(mechanicalProposal.ready, true);
  const g2p = await runMlsMpmG2pWebGpu({
    ...denseG2pArgs,
    gridUpdate,
    schroederSpatialMechanicalProposal: mechanicalProposal,
  });
  assert.equal(g2p.activeSourceDenseCompatibilityEnabled, true);
  assert.equal(
    g2p.activeSourceDenseCompatibilityScope,
    'single-level-exact-query'
  );
  assert.equal(
    g2p.activeSourceDenseCompatibilityProvenance,
    'locally-submitted-p2g-grid-update-g2p-chain'
  );
  assert.equal(g2p.sourceGridUpdate, gridUpdate);
  assert.equal(g2p.readbackMode, 'no-full-readback');
  assert.equal(g2p.fullReadbackPerformed, false);
  assert.equal(g2p.retainedOutputParticleBuffers, true);
  assert.equal(
    fixture.device.createdBuffers.some((buffer) => (buffer.usage & 1) !== 0),
    false
  );
  assert.equal(g2p.destroyOutputParticleBufferComponents({
    state: true,
    mechanics: true
  }), true);
  assert.equal(mechanicalProposal.releaseAfterSubmittedWork(), true);
  await mechanicalProposal.releasePromise;
  gridUpdate.destroyUpdatedGridBuffer();
  projection.destroyGridBuffer();
});

test('canonical spatial v2 dense P2G owns exact submitted cleanup across failure windows', async (t) => {
  const runDenseP2g = (fixture) =>
    runMlsMpmP2gGridProjectionWebGpu({
      device: fixture.device,
      sphParticleState: fixture.sphParticleState,
      mlsMpmParticleState: fixture.mlsMpmParticleState,
      sphParticleUpload: fixture.sphParticleUpload,
      mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
      schroederSelectedLevel: 0,
      schroederSpatialEpochGeneration: fixture.generation,
      canonicalSpatialRequired: true,
      mechanicsFieldMode: 'disabled',
      gridSpacingM: 0.25,
      boxDimsM: [1, 1, 1],
      dt: 0.005,
      retainGridBuffer: true,
      readbackMode: 'no-full-readback'
    });

  await t.test('submit failure destroys every attempted allocation without fencing and permits replay', async () => {
    const fixture = fusedP2gProducerFixture({
      createMacroAuthority: false,
      mechanicsLevelCount: 1
    });
    const originalSubmit = fixture.device.queue.submit;
    const originalFence = fixture.device.queue.onSubmittedWorkDone;
    let hostQueueFenceCount = 0;
    fixture.device.queue.onSubmittedWorkDone = (...args) => {
      hostQueueFenceCount += 1;
      return originalFence.apply(fixture.device.queue, args);
    };
    fixture.device.queue.submit = () => {
      throw new Error('injected dense P2G queue.submit failure');
    };
    const submissionsBefore = fixture.device.submissions.length;
    const createdBefore = fixture.device.createdBuffers.length;

    await assert.rejects(
      runDenseP2g(fixture),
      /injected dense P2G queue\.submit failure/
    );

    fixture.device.queue.submit = originalSubmit;
    assert.equal(fixture.device.submissions.length, submissionsBefore);
    assert.equal(hostQueueFenceCount, 0);
    const failedAttemptBuffers =
      fixture.device.createdBuffers.slice(createdBefore);
    assert.ok(failedAttemptBuffers.length > 0);
    assert.equal(
      failedAttemptBuffers.every((buffer) => buffer.destroyed === true),
      true
    );

    const replay = await runDenseP2g(fixture);
    assert.equal(fixture.device.submissions.length, submissionsBefore + 1);
    assert.equal(hostQueueFenceCount, 0);
    assert.equal(replay.normalHotLoopReadbackFree, true);
    assert.equal(replay.queueOrderedCleanupReceipt?.completed, true);
    assert.equal(replay.gridBuffer.destroyed, false);
    replay.destroyGridBuffer();
    fixture.device.queue.onSubmittedWorkDone = originalFence;
  });

  await t.test('post-submit provenance failure fences once and destroys the unpublished grid', async () => {
    const fixture = fusedP2gProducerFixture({
      createMacroAuthority: false,
      mechanicsLevelCount: 1
    });
    const activeSourceRuntime =
      fixture.generation.activeSourceView.ownerRuntime;
    const originalIsExecutionSubmitted =
      activeSourceRuntime.isExecutionSubmitted;
    const originalFence = fixture.device.queue.onSubmittedWorkDone;
    let hostQueueFenceCount = 0;
    fixture.device.queue.onSubmittedWorkDone = (...args) => {
      hostQueueFenceCount += 1;
      return originalFence.apply(fixture.device.queue, args);
    };
    const submissionsBefore = fixture.device.submissions.length;
    const createdBefore = fixture.device.createdBuffers.length;
    activeSourceRuntime.isExecutionSubmitted = (execution) => (
      fixture.device.submissions.length > submissionsBefore
        ? false
        : originalIsExecutionSubmitted.call(activeSourceRuntime, execution)
    );

    await assert.rejects(
      runDenseP2g(fixture),
      /submitted ActiveSource-v2 dense P2G does not match its exact single-level producer inputs/
    );

    assert.equal(fixture.device.submissions.length, submissionsBefore + 1);
    assert.equal(hostQueueFenceCount, 1);
    await new Promise((resolve) => setImmediate(resolve));
    const failedAttemptBuffers =
      fixture.device.createdBuffers.slice(createdBefore);
    assert.ok(failedAttemptBuffers.length > 0);
    assert.equal(
      failedAttemptBuffers.every((buffer) => buffer.destroyed === true),
      true
    );
    assert.equal(
      failedAttemptBuffers.find(
        (buffer) => buffer.label === 'ulg-mls-mpm-p2g-grid-out'
      )?.destroyed,
      true
    );

    activeSourceRuntime.isExecutionSubmitted =
      originalIsExecutionSubmitted;
    const replay = await runDenseP2g(fixture);
    assert.equal(fixture.device.submissions.length, submissionsBefore + 2);
    assert.equal(hostQueueFenceCount, 1);
    assert.equal(replay.queueOrderedCleanupReceipt?.completed, true);
    replay.destroyGridBuffer();
    fixture.device.queue.onSubmittedWorkDone = originalFence;
  });
});

test('canonical spatial v2 dense P2G copies and authenticates an immutable GPU product count before indirect scatter', async () => {
  const fixture = fusedP2gProducerFixture({
    createMacroAuthority: false,
    mechanicsLevelCount: 1
  });
  const rowCapacity = 32768;
  const productEventBuffer = fixture.device.createBuffer({
    label: 'gpu-count-product-history',
    size: rowCapacity * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
      * Float32Array.BYTES_PER_ELEMENT,
    usage: 128 | 4 | 8
  });
  const controlBuffer = fixture.device.createBuffer({
    label: 'gpu-count-product-history-control',
    size: 2 * 256,
    usage: 128 | 4 | 8 | 256
  });
  tagWebGpuBufferDevice(productEventBuffer, fixture.device);
  const residentProductMass = {
    schema: 'peercompute.ulg.sph-resident-product-mass.v0',
    status: 'resident-product-mass-merged-gpu-resident',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: productEventBuffer.size,
    productEventRowCount: rowCapacity,
    productEventStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    productEventActiveEventCount: null,
    unplacedProductMassKg: 1,
    consumeMassPolicy: 'unplaced-product-mass-only',
    eosCouplingStatus: 'resident-product-mass-p2g-eos-sidecar-ready'
  };
  const controlOffsetBytes = 256;
  const generation = 73;
  const seal = 0x7a51c30d;
  const authority = registerResidentProductEventCountAuthority(
    residentProductMass,
    {
      device: fixture.device,
      controlBuffer,
      controlOffsetBytes,
      rowCapacity,
      rowStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
      generation,
      seal
    }
  );
  const args = {
    device: fixture.device,
    sphParticleState: fixture.sphParticleState,
    mlsMpmParticleState: fixture.mlsMpmParticleState,
    sphParticleUpload: fixture.sphParticleUpload,
    mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: fixture.generation,
    canonicalSpatialRequired: true,
    mechanicsFieldMode: 'disabled',
    gridSpacingM: 0.25,
    boxDimsM: [1, 1, 1],
    dt: 0.005,
    retainGridBuffer: true,
    readbackMode: 'no-full-readback'
  };

  const submissionCountBeforeTornClone = fixture.device.submissions.length;
  await assert.rejects(
    runMlsMpmP2gGridProjectionWebGpu({
      ...args,
      residentProductMass: { ...residentProductMass }
    }),
    /torn product-event live-count authority/
  );
  assert.equal(
    fixture.device.submissions.length,
    submissionCountBeforeTornClone
  );

  const projection = await runMlsMpmP2gGridProjectionWebGpu({
    ...args,
    residentProductMass
  });
  assert.equal(
    projection.residentProductMassInputProductEventCountAuthority,
    'gpu-authored-filtered-live-prefix'
  );
  assert.equal(
    projection.residentProductMassInputProductEventRowCapacity,
    rowCapacity
  );
  assert.equal(
    projection.residentProductMassInputProductEventCountHostKnown,
    false
  );
  assert.equal(
    projection.residentProductMassProductEventDispatchMode,
    'gpu-authored-indirect-live-count'
  );

  const paramsWrite = fixture.device.writes.findLast(
    (write) =>
      write.label === 'ulg-mls-mpm-p2g-active-source-v2-dense-params'
  );
  assert.equal(paramsWrite.byteLength, 224);
  const params = new DataView(paramsWrite.data);
  for (let offset = 176; offset < 208; offset += 4) {
    assert.equal(params.getUint32(offset, true), 0);
  }
  assert.equal(params.getUint32(208, true), generation);
  assert.equal(params.getUint32(212, true), seal);
  assert.equal(params.getUint32(216, true), rowCapacity);
  assert.equal(params.getUint32(220, true), 8);

  const paramsBuffer = fixture.device.createdBuffers.findLast(
    (buffer) =>
      buffer.label === 'ulg-mls-mpm-p2g-active-source-v2-dense-params'
  );
  assert.deepEqual(
    fixture.device.copies.slice(-2),
    [
      {
        source: controlBuffer,
        sourceOffset: controlOffsetBytes + 12,
        destination: paramsBuffer,
        destinationOffset: 36,
        size: 4
      },
      {
        source: controlBuffer,
        sourceOffset: controlOffsetBytes,
        destination: paramsBuffer,
        destinationOffset: 176,
        size: 32
      }
    ]
  );
  const productDispatch = fixture.device.dispatches.findLast(
    (dispatch) =>
      dispatch[0] === 'indirect'
      && dispatch[1] === controlBuffer
  );
  assert.deepEqual(
    productDispatch,
    ['indirect', controlBuffer, authority.indirectOffsetBytes]
  );
  assert.equal(
    fixture.device.passTrace.findLast(
      (pass) => pass.entryPoint === 'scatter_product_events'
    )?.kind,
    'indirect'
  );
  assert.match(
    fixture.device.shaderModules.find(
      (module) =>
        module.code.includes('preflight_active_source_dense_single_level')
        && module.code.includes('p2g_product_history_control_admitted')
    )?.code ?? '',
    /expected_product_history_row_stride_vec4 == 8u/
  );
  assert.equal(
    fixture.device.createdBuffers.some((buffer) => (buffer.usage & 1) !== 0),
    false
  );
  const wrappedProjection = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    ...args,
    residentProductMass,
    preferWebGpu: true
  });
  assert.equal(
    wrappedProjection.residentProductMassInputProductEventCountAuthority,
    'gpu-authored-filtered-live-prefix'
  );
  assert.equal(
    wrappedProjection.residentProductMassInputProductEventRowCapacity,
    rowCapacity
  );
  assert.equal(
    wrappedProjection.residentProductMassInputProductEventCountHostKnown,
    false
  );
  assert.equal(
    wrappedProjection.residentProductMassProductEventDispatchMode,
    'gpu-authored-indirect-live-count'
  );
  wrappedProjection.gpuResult.destroyGridBuffer();
  projection.destroyGridBuffer();
});

test('canonical spatial v2 dense P2G rejects a multilevel ActiveSource before allocation or submission', async () => {
  const fixture = fusedP2gProducerFixture({
    createMacroAuthority: false,
    mechanicsLevelCount: 2
  });
  const residentProductMass = residentProductMassFromRows(productEventRows({
    position: [0.5, 0.5, 0.5],
    massKg: 1,
    visibleMassKg: 0,
    unplacedMassKg: 1,
    status: 1
  }));
  const bufferCountBefore = fixture.device.createdBuffers.length;
  const pipelineCountBefore = fixture.device.createdPipelines.length;
  const submissionCountBefore = fixture.device.submissions.length;

  await assert.rejects(
    runMlsMpmP2gGridProjectionWebGpu({
      device: fixture.device,
      sphParticleState: fixture.sphParticleState,
      mlsMpmParticleState: fixture.mlsMpmParticleState,
      sphParticleUpload: fixture.sphParticleUpload,
      mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
      schroederSelectedLevel: 0,
      schroederSpatialEpochGeneration: fixture.generation,
      canonicalSpatialRequired: true,
      mechanicsFieldMode: 'disabled',
      residentProductMass,
      gridSpacingM: 0.25,
      boxDimsM: [1, 1, 1],
      dt: 0.005,
      retainGridBuffer: true,
      readbackMode: 'no-full-readback'
    }),
    (error) => {
      assert.equal(
        error.code,
        'ERR_CANONICAL_SPATIAL_V2_DENSE_SINGLE_LEVEL_REQUIRED'
      );
      assert.match(
        error.message,
        /limited to one exact ActiveSource query level/
      );
      return true;
    }
  );
  assert.equal(fixture.device.createdBuffers.length, bufferCountBefore);
  assert.equal(fixture.device.createdPipelines.length, pipelineCountBefore);
  assert.equal(fixture.device.submissions.length, submissionCountBefore);
});

async function fusedCoarseTerminalP2gFixture() {
  const fixture = fusedP2gProducerFixture();
  const chain = await submittedFusedFineCorrection(fixture);
  const g2p = await runFusedG2pProducer(fixture, chain.correction);
  const uploads = nextParticleUploads(fixture, g2p);
  const continuation = createSchroederCanonicalParticleContinuation({
    device: fixture.device,
    macroAuthority: fixture.macroAuthority,
    ...uploads,
    ordinal: 1,
    priorContinuation: fixture.particleContinuation,
    sourceTransaction: fixture.transaction,
    g2pReconstruction: g2p
  });
  const {
    levelAssignment: successorLevelAssignment,
    runtime: successorAssignmentRuntime
  } = frozenSuccessorLevelAssignment(fixture, uploads);
  const successorGeneration = runSchroederSpatialEpochGenerationWebGpu({
    device: fixture.device,
    levelAssignment: successorLevelAssignment,
    particleCount: 1,
    particleIdentityBuffer: fixture.sphParticleUpload.identityBuffer,
    particleIdentityStrideWords: 1,
    mechanicsLevels: [
      { selectedLevel: 0, mechanicsGrid: fixture.fineGrid },
      { selectedLevel: 1, mechanicsGrid: fixture.coarseGrid }
    ]
  });
  assert.equal(
    successorGeneration.ready,
    true,
    successorGeneration.reason ?? successorGeneration.status
  );
  const successorCanonicalEpoch = {
    generation: successorGeneration,
    ...uploads
  };
  const successorMicroepoch = createSchroederFineMicroepochAuthority({
    device: fixture.device,
    macroAuthority: fixture.macroAuthority,
    canonicalEpoch: successorCanonicalEpoch,
    particleContinuation: continuation,
    priorMicroepochAuthority: fixture.microepochAuthority,
    substepOrdinal: 1
  });
  assert.equal(await retireSchroederFineMicroepochAfter(
    fixture.device,
    fixture.microepochAuthority,
    { successorMicroepochAuthority: successorMicroepoch }
  ), true);
  const terminalTransaction = createSchroederFusedCoarseTerminalTransaction({
    device: fixture.device,
    macroAuthority: fixture.macroAuthority,
    microepochAuthority: successorMicroepoch,
    particleContinuation: continuation
  });
  return {
    fixture,
    chain,
    g2p,
    uploads,
    continuation,
    successorGeneration,
    successorLevelAssignment,
    successorAssignmentRuntime,
    successorCanonicalEpoch,
    successorMicroepoch,
    terminalTransaction
  };
}

function terminalP2gOptions(terminal, transaction = terminal.terminalTransaction) {
  return {
    terminalTransaction: transaction,
    macroAuthority: terminal.fixture.macroAuthority,
    microepochAuthority: terminal.successorMicroepoch,
    particleContinuation: terminal.continuation,
    fieldExecution: terminal.successorMicroepoch.parentFieldView.coarseFieldView,
    mutationSegment: transaction.p2gMutation,
    priorArtifact: null,
    requireDeferred: true,
    proposalMode: 'proposal-deferred-to-post-mechanics'
  };
}

function runTerminalFixtureP2g(
  terminal,
  transaction = terminal.terminalTransaction,
  overrides = {}
) {
  return runTerminalP2gProducer(terminal.fixture, {
    transaction,
    generation: terminal.successorGeneration,
    continuation: terminal.continuation,
    ...terminal.uploads
  }, overrides);
}

function runTerminalFixtureGridUpdate(
  terminal,
  p2gProjection,
  transaction = terminal.terminalTransaction,
  overrides = {}
) {
  return runMlsMpmGridUpdateWebGpu({
    device: terminal.fixture.device,
    p2gGridProjection: p2gProjection,
    mechanicsFieldMode: 'required',
    fusedCoarseTerminalTransaction: transaction,
    mechanicsFieldEnergyReceipt: { deferSeal: true },
    dt: transaction.macroAuthority.macroDt,
    gravityMPerS2: [0, -9.80665, 0],
    boxDimsM: [1, 1, 1],
    cflFactor: 0.4,
    readbackMode: 'no-full-readback',
    ...overrides
  });
}

function terminalGridUpdateOptions(
  terminal,
  p2gProjection,
  transaction = terminal.terminalTransaction
) {
  return {
    terminalTransaction: transaction,
    macroAuthority: terminal.fixture.macroAuthority,
    microepochAuthority: terminal.successorMicroepoch,
    particleContinuation: terminal.continuation,
    fieldExecution: terminal.successorMicroepoch.parentFieldView.coarseFieldView,
    mutationSegment: transaction.gridUpdateMutation,
    priorArtifact: p2gProjection,
    requireDeferred: true,
    proposalMode: 'proposal-deferred-to-post-mechanics'
  };
}

function terminalWorkspaceRuntime(terminal, { arenaCount = 1 } = {}) {
  const parentFieldView = terminal.successorMicroepoch.parentFieldView;
  return createSchroederSpatialParentFieldMechanicsWorkspaceGpu(
    terminal.fixture.device,
    {
      parentFieldCapacity: parentFieldView.parentFieldCapacity,
      fineFieldCapacity: parentFieldView.fineFieldCapacity,
      arenaCount
    }
  );
}

function encodeTerminalWorkspace(
  terminal,
  coarseGridUpdate,
  runtime = terminalWorkspaceRuntime(terminal),
  overrides = {}
) {
  const encoder = overrides.encoder
    ?? terminal.fixture.device.createCommandEncoder();
  const transaction = overrides.fusedCoarseTerminalTransaction
    ?? terminal.terminalTransaction;
  const artifact = runtime.encodeCoarseTerminal(encoder, {
    parentFieldView: terminal.successorMicroepoch.parentFieldView,
    coarseGridUpdate,
    refluxLedger: terminal.fixture.refluxLedger,
    fineSubstepCount: terminal.fixture.macroAuthority.fineSubstepCount,
    fineDt: terminal.fixture.macroAuthority.fineDt,
    fusedCoarseTerminalTransaction: transaction,
    ...overrides
  });
  return {
    runtime,
    encoder,
    artifact,
    execution: artifact.parentFieldMechanicsWorkspaceExecution
  };
}

async function terminalWorkspaceInputFixture() {
  const terminal = await fusedCoarseTerminalP2gFixture();
  const p2gProjection = await runTerminalFixtureP2g(terminal);
  const gridUpdate = await runTerminalFixtureGridUpdate(
    terminal,
    p2gProjection
  );
  return { terminal, p2gProjection, gridUpdate };
}

async function submittedTerminalWorkspaceFixture() {
  const input = await terminalWorkspaceInputFixture();
  const encoded = encodeTerminalWorkspace(input.terminal, input.gridUpdate);
  input.terminal.fixture.device.queue.submit([encoded.encoder.finish()]);
  encoded.runtime.markTerminalSubmissionObserved(encoded.execution);
  encoded.runtime.markTerminalSubmitted(encoded.execution);
  return { ...input, ...encoded };
}

function runTerminalG2pProducer(chain, overrides = {}) {
  const { terminal, artifact } = chain;
  const { fixture, terminalTransaction } = terminal;
  return runMlsMpmG2pWebGpu({
    device: fixture.device,
    sphParticleState: fixture.sphParticleState,
    mlsMpmParticleState: fixture.mlsMpmParticleState,
    gridUpdate: artifact,
    ...terminal.uploads,
    dt: fixture.macroAuthority.macroDt,
    boxDimsM: [1, 1, 1],
    internalPressureScale: artifact.sourceProjection.internalPressureScale,
    liquidWallDampingAlpha: 0,
    liquidWallDampingDistanceM: 0,
    schroederSelectedLevel: fixture.macroAuthority.coarseLevel,
    schroederSpatialEpochGeneration: terminal.successorGeneration,
    schroederSpatialMechanicalProposal: null,
    fusedCoarseTerminalTransaction: terminalTransaction,
    canonicalSpatialRequired: true,
    mechanicsFieldMode: 'required',
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback',
    ...overrides
  });
}

function terminalG2pOptions(chain, transaction = chain.terminal.terminalTransaction) {
  const { terminal, artifact } = chain;
  return {
    terminalTransaction: transaction,
    macroAuthority: terminal.fixture.macroAuthority,
    microepochAuthority: terminal.successorMicroepoch,
    particleContinuation: terminal.continuation,
    fieldExecution: terminal.successorMicroepoch.parentFieldView.coarseFieldView,
    priorArtifact: artifact,
    proposalMode: 'proposal-deferred-to-post-mechanics'
  };
}

function terminalFinalParticleUploads(chain, g2p) {
  return {
    finalSphParticleUpload: {
      ...chain.terminal.uploads.sphParticleUpload,
      stateBuffer: g2p.stateBuffer,
      stateBufferByteLength: g2p.stateBufferByteLength
    },
    finalMlsMpmParticleUpload: {
      ...chain.terminal.uploads.mlsMpmParticleUpload,
      mechanicsBuffer: g2p.mechanicsBuffer,
      mechanicsBufferByteLength: g2p.mechanicsBufferByteLength
    }
  };
}

async function releaseTerminalG2pFixture(chain, reason) {
  await chain.runtime.releaseExecutionAfter(
    chain.execution,
    chain.terminal.fixture.device.queue.onSubmittedWorkDone()
  );
  chain.runtime.destroy();
  await releaseTerminalP2gFixture(chain.terminal, reason);
}

async function releaseTerminalP2gFixture(terminal, reason) {
  const {
    fixture,
    chain,
    successorGeneration,
    successorMicroepoch,
    terminalTransaction
  } = terminal;
  const state = schroederFusedCoarseTerminalTransactionState(
    fixture.device,
    terminalTransaction
  );
  if (state?.status === 'reserved') {
    discardSchroederFusedCoarseTerminalTransaction(
      fixture.device,
      terminalTransaction,
      { discardedEncoder: true }
    );
  }
  await chain.runtime.releaseExecutionAfter(
    chain.execution,
    fixture.device.queue.onSubmittedWorkDone()
  );
  chain.runtime.destroy();
  await abortSchroederTwoLevelMacroAuthorityAfter(
    fixture.device,
    fixture.macroAuthority,
    {
      microepochAuthority: successorMicroepoch,
      reason: new Error(reason)
    }
  );
  if (!successorGeneration.releaseScheduled) {
    releaseSchroederSpatialEpochGenerationAfterQueue(
      successorGeneration,
      fixture.device
    );
  }
  if (successorGeneration.releasePromise) {
    await successorGeneration.releasePromise;
  }
  fixture.refluxLedger.destroy();
}

test('MLS-MPM P2G grid projection WGSL declares particle-parallel scatter bindings', () => {
  assert.match(mlsMpmP2gGridProjectionWgsl, /struct P2gProjectionParams/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> sph_state/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> sph_thermo/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> mls_mechanics/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read_write> grid_accumulators: array<atomic<i32>>/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@group\(0\) @binding\(6\) var<storage, read_write> grid_nodes/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /resident_product_event_count: u32/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /internal_pressure_scale: f32/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> product_events/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@group\(0\) @binding\(7\) var<storage, read> schroeder_level_assignments/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@group\(0\) @binding\(8\) var<storage, read> schroeder_spatial_directory/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /schroeder_filter_enabled: u32/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /schroeder_spatial_directory_enabled: u32/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn p2g_spatial_directory_admitted/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /particle_to_cell_offset_words/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn p2g_particle_enabled/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn packed_pressure/);
  // The depth-frozen hydrostatic prestress (row7.x) must NOT feed the stress:
  // pressure comes from the EOS via tracked J only.
  assert.doesNotMatch(mlsMpmP2gGridProjectionWgsl, /max\(row7\.x, 0\.0\)/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /return max\(0\.0, sound_speed_m_per_s \* sound_speed_m_per_s/);
  // Cavitation clamp: condensed tension is floored at a small fraction of the
  // Tait stiffness instead of the unbounded signed law (tensile pairing fix).
  assert.match(mlsMpmP2gGridProjectionWgsl, /pow\(ratio, 7\.0\) - 1\.0\);/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /return max\(pressure, -0\.05 \* stiffness\);/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn corotated_stress/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn scatter_product_events/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn finalize_grid/);
  assert.doesNotMatch(mlsMpmP2gGridProjectionWgsl, /for \(var particle_index = 0u; particle_index < params\.particle_count/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@compute @workgroup_size\(64\)/);
});

test('MLS-MPM P2G backend policy keeps Ocean-tiled replacement explicit and fail-closed', () => {
  const current = resolveMlsMpmP2gBackendPolicy({
    requestedBackend: 'particle-parallel-scatter'
  });
  assert.equal(current.schema, ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA);
  assert.equal(current.status, 'resident-scatter-backend-selected');
  assert.equal(current.effectiveBackend, MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER);
  assert.equal(current.particleLoopInHotPath, false);

  const experimental = resolveMlsMpmP2gBackendPolicy({
    requestedBackend: MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL
  });
  assert.equal(experimental.schema, ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA);
  assert.equal(experimental.status, 'ocean-tiled-backend-fallback-resident-scatter');
  assert.equal(experimental.requestedBackend, MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL);
  assert.equal(experimental.effectiveBackend, MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER);
  assert.equal(experimental.fallbackReason, 'ocean-tiled-p2g-kernel-not-available');
  assert.equal(experimental.experimentalBackendRequested, true);
  assert.equal(experimental.oceanTiledKernelAvailable, false);
  assert.equal(experimental.particleLoopInHotPath, false);
});

test('CPU MLS-MPM P2G grid projection conserves mass and linear momentum without affine C', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const summary = summarizeGrid(projection.gridNodes);
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;

  assert.equal(projection.schema, ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA);
  assert.equal(projection.backend, 'cpu-reference');
  assert.equal(projection.kernelScope, 'particle-parallel-scatter-p2g-stress-momentum-projection');
  assert.equal(projection.gridNodeStrideFloats, 8);
  nearlyEqual(summary.mass, 8, 1e-5);
  nearlyEqual(summary.momentum[0], 16, 1e-5);
  nearlyEqual(summary.momentum[1], 24, 1e-5);
  nearlyEqual(summary.momentum[2], 32, 1e-5);
  assert.equal(summary.activeNodes, 27);
  nearlyEqual(projection.gridNodes[centerOffset], 8 * centerWeight);
  nearlyEqual(projection.gridNodes[centerOffset + 1], 8 * centerWeight * 2);
  nearlyEqual(projection.gridNodes[centerOffset + 2], 8 * centerWeight * 3);
  nearlyEqual(projection.gridNodes[centerOffset + 3], 8 * centerWeight * 4);
  assert.equal(projection.p2gProjectionValidation, false);
  assert.equal(projection.stressProjectionValidation, false);
  assert.equal(projection.gridValidation, false);
  assert.equal(projection.g2pValidation, false);
  assert.equal(projection.fullPhysicsValidation, false);
});

test('CPU MLS-MPM P2G keeps cavitation-clamped condensed tensile pressure', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 4,
    restDensityKgPerM3: 4,
    restVolumeM3: 1,
    volumeRatioJ: 2,
    solidFlag: 0,
    soundSpeedMPerS: 10,
    eosModelId: 1,
    mechanicsDtS: 0.1
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const summary = summarizeGrid(projection.gridNodes);
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;
  // Signed tension survives below rest density but is floored at the
  // cavitation-scale fraction of the Tait stiffness (-0.05 * B): a liquid
  // cavitates rather than sustaining bulk-scale tension, and the unbounded
  // branch drove the MLS-MPM tensile pairing instability.
  const taitStiffnessPa = 4 * 10 * 10 / 7;
  const expectedPressurePa = Math.max(
    taitStiffnessPa * ((0.5 ** 7) - 1),
    -0.05 * taitStiffnessPa
  );
  const expectedStressScale = -0.1 * 2 * 4;
  const expectedAffineDiagonal = expectedStressScale * -expectedPressurePa;
  const expectedNodeMomentum = centerWeight * expectedAffineDiagonal * -0.25;

  nearlyEqual(summary.mass, 4, 1e-5);
  nearlyEqual(summary.momentum[0], 0, 1e-5);
  nearlyEqual(summary.momentum[1], 0, 1e-5);
  nearlyEqual(summary.momentum[2], 0, 1e-5);
  assert.ok(maxNodeMomentumAbs(projection.gridNodes) > 0);
  nearlyEqual(projection.gridNodes[centerOffset + 1], expectedNodeMomentum, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 2], expectedNodeMomentum, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 3], expectedNodeMomentum, 1e-5);
});

test('WebGPU MLS-MPM P2G binds a full product-event row for zero-event runs', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const device = fakeP2gDevice();
  const projection = await runMlsMpmP2gGridProjectionWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    ambientPressurePa: 101325,
    readbackMode: 'no-full-readback'
  });
  const productEventBuffer = device.createdBuffers.find(
    (buffer) => buffer.label === 'ulg-mls-mpm-p2g-resident-product-events-in'
  );

  assert.equal(projection.backend, 'webgpu');
  assert.equal(projection.readbackMode, 'no-full-readback');
  assert.equal(projection.ambientPressureAppliedInStressProjection, true);
  assert.equal(projection.p2gBackendPolicyStatus, 'resident-scatter-backend-selected');
  assert.equal(projection.p2gBackendEffective, MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER);
  assert.equal(projection.residentProductMassInputProductEventCount, 0);
  assert.ok(productEventBuffer);
  const paramsWrite = device.writes.find((write) => write.label === 'ulg-mls-mpm-p2g-params');
  assert.ok(paramsWrite);
  assert.equal(new DataView(paramsWrite.data).getFloat32(68, true), 101325);
  assert.equal(
    productEventBuffer.size,
    SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
});

test('non-transaction mechanics-field P2G rejects particle-family drift before allocation', async () => {
  const fixture = fusedP2gProducerFixture();
  const field = fixture.generation.parentFieldView.coarseFieldView;
  const fieldRuntime = field.ownerRuntime;
  const allocationsBefore = fixture.device.createdBuffers.length;
  const submissionsBefore = fixture.device.submissions.length;
  fixture.sphParticleState.particleCount = 2;
  fixture.mlsMpmParticleState.particleCount = 2;

  await assert.rejects(
    runCoarseP2gProducer(fixture),
    (error) => {
      assert.equal(
        error.code,
        'ERR_MECHANICS_FIELD_P2G_PARTICLE_FAMILY_MISMATCH'
      );
      return true;
    }
  );
  assert.equal(fixture.device.createdBuffers.length, allocationsBefore);
  assert.equal(fixture.device.submissions.length, submissionsBefore);
  assert.deepEqual(fieldRuntime.stateMutationState(field), {
    ordinal: 0,
    encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    operation: 'topology-ready',
    pending: false,
    publicationLocked: false,
    quarantined: false
  });

  fixture.sphParticleState.particleCount = 1;
  fixture.mlsMpmParticleState.particleCount = 1;
  const successfulAllocationsBefore = fixture.device.createdBuffers.length;
  const successfulDispatchesBefore = fixture.device.dispatches.length;
  const projection = await runCoarseP2gProducer(fixture);
  assert.equal(projection.mechanicsFieldViewExecution, field);
  assert.equal(projection.activeSourceP2gEnabled, true);
  assert.ok(
    fixture.device.dispatches
      .slice(successfulDispatchesBefore)
      .some((dispatch) => (
        dispatch[0] === 'indirect'
        && dispatch[1]
          === fixture.generation.activeSourceView.activeSourceViewBuffer
        && dispatch[2]
          === fixture.generation.activeSourceView.activeDispatchOffsetBytes
      )),
    'staged P2G must dispatch through the GPU-authored ActiveSource row'
  );
  assert.equal(
    fixture.device.createdBuffers
      .slice(successfulAllocationsBefore)
      .some((buffer) => (buffer.usage & 1) !== 0),
    false,
    'staged ActiveSource-v2 P2G must not allocate MAP_READ buffers'
  );
  assert.equal(projection.mechanicsFieldIndirectDispatchDimensions, 2);
  assert.equal(
    projection.mechanicsFieldIndirectDispatchLinearization,
    'linearGroup=workgroup.x+workgroup.y*dispatchX'
  );
  assert.equal(
    projection.mechanicsFieldSourceDispatchWorkgroups,
    field.sourceDispatchWorkgroups
  );
  assert.equal(
    projection.mechanicsFieldCandidateDispatchWorkgroups,
    field.candidateDispatchWorkgroups
  );
  assert.equal(
    projection.mechanicsFieldP2gReductionMode,
    'stable-radix-ordered-field-reduction'
  );
  assert.equal(fieldRuntime.stateMutationState(field).ordinal, 1);
  await abortSchroederTwoLevelMacroAuthorityAfter(
    fixture.device,
    fixture.macroAuthority,
    {
      microepochAuthority: fixture.microepochAuthority,
      reason: new Error('non-transaction particle-family drift fixture cleanup')
    }
  );
  fixture.refluxLedger.destroy();
});

test('single-level S9-A/B surface stress runs the standalone 18-central-bond lifecycle', async () => {
  const fixture = fusedP2gProducerFixture({
    createMacroAuthority: false,
    mechanicsLevelCount: 1
  });
  const {
    device,
    generation,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload
  } = fixture;
  const transaction = createSchroederSpatialEpochTransaction({
    device,
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload,
    twoLevelAuthoritative: false,
    enabledConsumerReaderIds: [],
    consumerSupportProfileIds: {}
  });
  const readerInputs = {
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload
  };
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  }), true);

  const p2gGridProjection = await runMlsMpmP2gGridProjectionWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: generation,
    canonicalSpatialRequired: true,
    mechanicsFieldMode: 'required',
    gridSpacingM: 0.25,
    boxDimsM: [1, 1, 1],
    dt: 0.005,
    readbackMode: 'no-full-readback'
  });
  assert.equal(
    p2gGridProjection.mechanicsFieldViewExecution,
    generation.mechanicsFieldView
  );

  const zeroCoefficientMaterialTable =
    buildMlsMpmMechanicsMaterialTable({
      h2o: {
        molarMassKgPerMol: 0.018015,
        phases: [{
          name: 'liquid',
          densityKgPerM3: 997,
          bulkModulusPa: 2.2e9,
          shearModulusPa: 0,
          cpJPerKgK: 4184,
          temperatureRange: [273.15, 373.15]
        }]
      }
    }, {
      surfaceTensionEnabled: true
    });
  const zeroCoefficientUpload =
    uploadMlsMpmMechanicsMaterialPhaseRecords(
      device,
      zeroCoefficientMaterialTable
    );
  await assert.rejects(
    runMlsMpmGridUpdateWebGpu({
      device,
      p2gGridProjection,
      mechanicsFieldMode: 'required',
      schroederSpatialEpochTransaction: transaction,
      mechanicsMaterialTable: zeroCoefficientMaterialTable,
      mechanicsMaterialPhaseUpload: zeroCoefficientUpload,
      dt: 0.005,
      gravityMPerS2: [0, -9.80665, 0],
      boxDimsM: [1, 1, 1],
      cflFactor: 0.4,
      readbackMode: 'no-full-readback',
      retainUpdatedGridBuffer: false
    }),
    /lacks a positive mechanics material coefficient/
  );
  destroyMlsMpmMechanicsMaterialPhaseUpload(zeroCoefficientUpload);

  const mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable({
    h2o: {
      molarMassKgPerMol: 0.018015,
      phases: [{
        name: 'liquid',
        densityKgPerM3: 997,
        bulkModulusPa: 2.2e9,
        shearModulusPa: 0,
        cpJPerKgK: 4184,
        dynamicViscosityPaS: 0.001,
        surfaceTensionNPerM: 0.072,
        temperatureRange: [273.15, 373.15]
      }]
    }
  }, {
    viscosityEnabled: true,
    surfaceTensionEnabled: true
  });
  const mechanicsMaterialPhaseUpload =
    uploadMlsMpmMechanicsMaterialPhaseRecords(
      device,
      mechanicsMaterialTable
    );
  const traceStart = device.passTrace.length;
  const update = await runMlsMpmGridUpdateWebGpu({
    device,
    p2gGridProjection,
    mechanicsFieldMode: 'required',
    schroederSpatialEpochTransaction: transaction,
    mechanicsMaterialTable,
    mechanicsMaterialPhaseUpload,
    dt: 0.005,
    gravityMPerS2: [0, -9.80665, 0],
    boxDimsM: [1, 1, 1],
    cflFactor: 0.4,
    readbackMode: 'no-full-readback',
    retainUpdatedGridBuffer: false
  });
  const expectedLifecycle = [
    'initialize_surface_stress',
    ...SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS,
    'validate_surface_stress',
    'commit_surface_stress'
  ];
  const lifecycleSet = new Set(expectedLifecycle);
  const lifecycleTrace = device.passTrace
    .slice(traceStart)
    .filter(({ entryPoint }) => lifecycleSet.has(entryPoint));
  assert.deepEqual(
    lifecycleTrace.map(({ entryPoint }) => entryPoint),
    expectedLifecycle
  );
  assert.equal(
    lifecycleTrace.every(({ kind }) => kind === 'indirect'),
    true
  );
  assert.equal(
    device.createdPipelines.some(
      ({ compute }) => compute?.entryPoint === 'stage_transport'
    ),
    false
  );
  const surfaceBindGroups = device.bindGroups.filter(({ entries }) => (
    Array.isArray(entries)
    && entries.map(({ binding }) => binding).join(',') === '0,4,5,6,7'
  ));
  assert.equal(
    surfaceBindGroups.length,
    1,
    'the identical explicit surface-stress layout shares one bind group across the lifecycle'
  );

  assert.equal(update.phaseVolumeSurfaceStressRequested, true);
  assert.equal(update.phaseVolumeSurfaceStressSubmitted, true);
  assert.equal(
    update.phaseVolumeSurfaceStressSubmission?.schema,
    ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_SCHEMA
  );
  assert.equal(
    update.phaseVolumeSurfaceStressSubmission?.status,
    ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_STATUS
  );
  assert.equal(
    update.phaseVolumeSurfaceStressSubmission?.dispatchCount,
    SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS.length
  );
  assert.equal(
    update.phaseVolumeSurfaceStressSubmission?.lifecycleDispatchCount,
    expectedLifecycle.length
  );
  assert.equal(
    update.phaseVolumeSurfaceStressSubmission?.lifecycleMode,
    'standalone-s9ab-initialize-ambient-eighteen-central-bonds-validate-commit'
  );
  assert.equal(
    update.phaseVolumeSurfaceStressSubmission?.ambientBuoyancyMode,
    'field-local-s9ab-current-volume-ambient-source'
  );
  assert.equal(
    update.phaseVolumeSurfaceStressSubmission?.levelRole,
    'single'
  );
  assert.equal(update.phaseVolumeSurfaceStressSubmission?.twoLevel, false);
  assert.equal(
    update.phaseVolumeSurfaceStressSubmission
      ?.positiveSurfaceTensionPhaseRecordCount,
    1
  );
  assert.equal(
    update.phaseVolumeSurfaceStressSubmission
      ?.surfaceTensionCoefficientStatus,
    'positive-surface-tension-coefficient-ready'
  );
  assert.deepEqual(
    update.phaseVolumeSurfaceStressSubmission?.entryPoints,
    SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS
  );

  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
    ...readerInputs
  }), true);
  destroyMlsMpmMechanicsMaterialPhaseUpload(
    mechanicsMaterialPhaseUpload
  );
});

test('single-level surface stress forces the resident pass DAG instead of fused mechanics', async () => {
  const fixture = fusedP2gProducerFixture({
    createMacroAuthority: false,
    mechanicsLevelCount: 1
  });
  const {
    device,
    generation,
    levelAssignment,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload
  } = fixture;
  const transaction = createSchroederSpatialEpochTransaction({
    device,
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload,
    twoLevelAuthoritative: false,
    enabledConsumerReaderIds: [],
    consumerSupportProfileIds: {}
  });
  const mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable({
    h2o: {
      molarMassKgPerMol: 0.018015,
      phases: [{
        name: 'liquid',
        densityKgPerM3: 997,
        bulkModulusPa: 2.2e9,
        shearModulusPa: 0,
        cpJPerKgK: 4184,
        dynamicViscosityPaS: 0.001,
        surfaceTensionNPerM: 0.072,
        temperatureRange: [273.15, 373.15]
      }]
    }
  }, {
    viscosityEnabled: true,
    surfaceTensionEnabled: true
  });
  const mechanicsMaterialPhaseUpload =
    uploadMlsMpmMechanicsMaterialPhaseRecords(
      device,
      mechanicsMaterialTable
    );
  const progress = [];
  const traceStart = device.passTrace.length;
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederLevelAssignment: levelAssignment,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: generation,
    schroederSpatialEpochTransaction: transaction,
    canonicalSpatialRequired: true,
    mechanicsMaterialTable,
    mechanicsRefreshOptions: {
      mechanicsMaterialPhaseUpload
    },
    preferWebGpu: true,
    device,
    gridSpacingM: 0.25,
    boxDimsM: [1, 1, 1],
    gravityMPerS2: [0, 0, 0],
    dt: 0.005,
    readbackMode: 'no-full-readback',
    fuseNoFullResidentMechanics: true,
    summaryRunner: null,
    onResidentStageProgress(event) {
      if (event.status === 'resident-stage-started') {
        progress.push(event.stage);
      }
    }
  });
  assert.equal(step.stageTiming.fusedResidentMechanics, false);
  assert.equal(progress.includes('fusedMechanics'), false);
  assert.ok(
    progress.indexOf('p2gGridProjection')
      < progress.indexOf('gridUpdate')
  );
  assert.ok(
    progress.indexOf('gridUpdate')
      < progress.indexOf('g2pReconstruction')
  );

  const expectedLifecycle = [
    'initialize_surface_stress',
    ...SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS,
    'validate_surface_stress',
    'commit_surface_stress'
  ];
  const lifecycleSet = new Set(expectedLifecycle);
  assert.deepEqual(
    device.passTrace
      .slice(traceStart)
      .filter(({ entryPoint }) => lifecycleSet.has(entryPoint))
      .map(({ entryPoint }) => entryPoint),
    expectedLifecycle
  );
  assert.equal(
    step.gridUpdate.phaseVolumeSurfaceStressSubmission?.lifecycleMode,
    'standalone-s9ab-initialize-ambient-eighteen-central-bonds-validate-commit'
  );
  assert.equal(
    step.gridUpdate.phaseVolumeSurfaceStressSubmission?.ambientBuoyancyMode,
    'field-local-s9ab-current-volume-ambient-source'
  );
  assert.equal(
    step.gridUpdate.phaseVolumeSurfaceStressSubmission?.lifecycleDispatchCount,
    expectedLifecycle.length
  );
  assert.equal(
    step.gridUpdate.phaseVolumeSurfaceStressSubmission?.levelRole,
    'single'
  );
  assert.equal(
    step.gridUpdate.phaseVolumeSurfaceStressSubmission?.twoLevel,
    false
  );
  destroyMlsMpmResidentStepBuffers(step);
  destroyMlsMpmMechanicsMaterialPhaseUpload(
    mechanicsMaterialPhaseUpload
  );
});

test('non-transaction mechanics-field P2G uses exact queue-ordered arena ownership', async (t) => {
  const cleanup = async (fixture, reason) => {
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error(reason)
      }
    );
    fixture.refluxLedger.destroy();
  };

  await t.test('P2G success retires its arena at one nonempty submit without a host fence', async () => {
    const fixture = fusedP2gProducerFixture();
    const fineProjection = await runFusedP2gProducer(fixture);
    const originalFence = fixture.device.queue.onSubmittedWorkDone;
    let hostQueueFenceCount = 0;
    fixture.device.queue.onSubmittedWorkDone = (...args) => {
      hostQueueFenceCount += 1;
      return originalFence.apply(fixture.device.queue, args);
    };
    const submissionsBefore = fixture.device.submissions.length;
    const createdBefore = fixture.device.createdBuffers.length;

    const projection = await runCoarseP2gProducer(fixture);

    assert.equal(fixture.device.submissions.length, submissionsBefore + 1);
    assert.equal(fixture.device.submissions.at(-1).length, 1);
    assert.equal(hostQueueFenceCount, 0);
    assert.equal(projection.normalHotLoopReadbackFree, true);
    assert.equal(projection.observedHostQueueFenceCount, 0);
    assert.equal(projection.hostQueueFenceCount, 0);
    assert.equal(projection.queueOrderedCleanupReceipt?.completed, true);
    assert.equal(
      projection.queueOrderedCleanupReceipt?.hostQueueFenceCount,
      0
    );
    await Promise.resolve();
    await Promise.resolve();
    const submittedScratch = fixture.device.createdBuffers.slice(createdBefore);
    assert.equal(submittedScratch.length, 0);
    for (const borrowed of [
      fixture.sphParticleUpload.stateBuffer,
      fixture.sphParticleUpload.thermoBuffer,
      fixture.sphParticleUpload.identityBuffer,
      fixture.mlsMpmParticleUpload.mechanicsBuffer,
      fixture.generation.execution.directoryBuffer,
      fixture.generation.execution.evidenceBuffer,
      fixture.generation.parentFieldView.fineFieldView.fieldViewBuffer,
      fixture.generation.parentFieldView.coarseFieldView.fieldViewBuffer,
      fixture.generation.parentFieldView.fineFieldView.stableCandidateOrderBuffer,
      fixture.generation.parentFieldView.coarseFieldView.stableCandidateOrderBuffer
    ]) {
      assert.equal(borrowed.destroyed, false);
    }

    const parentFieldView = fixture.generation.parentFieldView;
    const workspaceRuntime =
      createSchroederSpatialParentFieldMechanicsWorkspaceGpu(
        fixture.device,
        {
          parentFieldCapacity: parentFieldView.parentFieldCapacity,
          fineFieldCapacity: parentFieldView.fineFieldCapacity,
          arenaCount: 1
        }
      );
    const execution = workspaceRuntime.encodePredictors(
      fixture.device.createCommandEncoder(),
      {
        parentFieldView,
        fineP2gProjection: fineProjection,
        coarseP2gProjection: projection,
        dt: fixture.predictorThetaDt,
        fineDt: fixture.fineDt,
        macroDt: fixture.macroDt,
        fineSubstepOrdinal: 0,
        fineSubstepCount: fixture.fineSubstepCount,
        gravityMPerS2: [0, -9.80665, 0],
        boxDimsM: [1, 1, 1],
        refluxLedger: fixture.refluxLedger,
        fusedFineSubstepTransaction: fixture.transaction
      }
    );
    assert.equal(workspaceRuntime.ownsExecution(execution), true);
    assert.equal(
      workspaceRuntime.releaseExecution(
        execution,
        { discardedEncoder: true }
      ),
      true
    );
    workspaceRuntime.destroy();

    fixture.device.queue.onSubmittedWorkDone = originalFence;
    await cleanup(fixture, 'standalone P2G zero-fence success cleanup');
  });

  await t.test('P2G submit failure preserves arena controls and permits an exact same-field replay', async () => {
    const fixture = fusedP2gProducerFixture();
    const field = fixture.generation.parentFieldView.coarseFieldView;
    const fieldRuntime = field.ownerRuntime;
    const originalSubmit = fixture.device.queue.submit;
    const originalFence = fixture.device.queue.onSubmittedWorkDone;
    let hostQueueFenceCount = 0;
    fixture.device.queue.onSubmittedWorkDone = (...args) => {
      hostQueueFenceCount += 1;
      return originalFence.apply(fixture.device.queue, args);
    };
    fixture.device.queue.submit = () => {
      throw new Error('injected standalone P2G queue.submit failure');
    };
    const submissionsBefore = fixture.device.submissions.length;
    const createdBefore = fixture.device.createdBuffers.length;

    await assert.rejects(
      runCoarseP2gProducer(fixture),
      /injected standalone P2G queue\.submit failure/
    );

    fixture.device.queue.submit = originalSubmit;
    assert.equal(fixture.device.submissions.length, submissionsBefore);
    assert.equal(hostQueueFenceCount, 0);
    assert.deepEqual(fieldRuntime.stateMutationState(field), {
      ordinal: 0,
      encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
      operation: 'topology-ready',
      pending: false,
      publicationLocked: false,
      quarantined: false
    });
    const failedAttemptBuffers =
      fixture.device.createdBuffers.slice(createdBefore);
    assert.equal(failedAttemptBuffers.length, 0);
    assert.equal(
      Object.values(fieldRuntime.p2gWorkspaceForExecution(field))
        .every((buffer) => buffer.destroyed === false),
      true
    );

    const replay = await runCoarseP2gProducer(fixture);
    assert.equal(fixture.device.submissions.length, submissionsBefore + 1);
    assert.equal(hostQueueFenceCount, 0);
    assert.equal(replay.normalHotLoopReadbackFree, true);
    assert.equal(replay.queueOrderedCleanupReceipt?.completed, true);
    assert.equal(fieldRuntime.stateMutationState(field).ordinal, 1);

    fixture.device.queue.onSubmittedWorkDone = originalFence;
    await cleanup(fixture, 'standalone P2G submit replay cleanup');
  });

  await t.test('P2G post-submit publication failure fences once and quarantines its arena', async () => {
    const fixture = fusedP2gProducerFixture();
    const field = fixture.generation.parentFieldView.coarseFieldView;
    const fieldRuntime = field.ownerRuntime;
    const originalMark = fieldRuntime.markStateMutationSubmitted;
    const originalFence = fixture.device.queue.onSubmittedWorkDone;
    let hostQueueFenceCount = 0;
    fixture.device.queue.onSubmittedWorkDone = (...args) => {
      hostQueueFenceCount += 1;
      return originalFence.apply(fixture.device.queue, args);
    };
    const injected = new Error('injected standalone P2G artifact publication failure');
    fieldRuntime.markStateMutationSubmitted = () => { throw injected; };
    const submissionsBefore = fixture.device.submissions.length;
    const createdBefore = fixture.device.createdBuffers.length;

    await assert.rejects(runCoarseP2gProducer(fixture), (error) => error === injected);
    assert.equal(fixture.device.submissions.length, submissionsBefore + 1);
    assert.equal(hostQueueFenceCount, 1);
    assert.deepEqual(fieldRuntime.stateMutationState(field), {
      ordinal: 0,
      encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
      operation: 'topology-ready',
      pending: true,
      publicationLocked: false,
      quarantined: true
    });
    assert.equal(fieldRuntime.isCurrentStateArtifact(field, {
      mutationOrdinal: 1,
      stateEncoding:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
    }), false);
    await new Promise((resolve) => setImmediate(resolve));
    const failedAttemptBuffers =
      fixture.device.createdBuffers.slice(createdBefore);
    assert.equal(failedAttemptBuffers.length, 0);
    fieldRuntime.markStateMutationSubmitted = originalMark;
    fixture.device.queue.onSubmittedWorkDone = originalFence;
    await cleanup(fixture, 'standalone P2G quarantine test cleanup');
  });
});

test('non-transaction mechanics-field stages quarantine submitted state before failed publication', async (t) => {
  const cleanup = async (fixture, reason) => {
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error(reason)
      }
    );
    fixture.refluxLedger.destroy();
  };

  await t.test('grid update keeps P2G provenance pending and quarantined', async () => {
    const fixture = fusedP2gProducerFixture();
    const field = fixture.generation.parentFieldView.coarseFieldView;
    const fieldRuntime = field.ownerRuntime;
    const projection = await runCoarseP2gProducer(fixture);
    const originalMark = fieldRuntime.markStateMutationSubmitted;
    const injected = new Error(
      'injected standalone grid-update artifact publication failure'
    );
    fieldRuntime.markStateMutationSubmitted = () => { throw injected; };
    const submissionsBefore = fixture.device.submissions.length;

    await assert.rejects(runMlsMpmGridUpdateWebGpu({
      device: fixture.device,
      p2gGridProjection: projection,
      mechanicsFieldMode: 'required',
      mechanicsFieldEnergyReceipt: { deferSeal: true },
      dt: fixture.predictorThetaDt,
      gravityMPerS2: [0, -9.80665, 0],
      boxDimsM: [1, 1, 1],
      cflFactor: 0.4,
      readbackMode: 'no-full-readback'
    }), (error) => error === injected);
    assert.equal(fixture.device.submissions.length, submissionsBefore + 1);
    assert.deepEqual(fieldRuntime.stateMutationState(field), {
      ordinal: 1,
      encoding:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
      operation: 'p2g-mass-momentum-gradient-submitted',
      pending: true,
      publicationLocked: false,
      quarantined: true
    });
    assert.equal(fieldRuntime.isCurrentStateArtifact(field, {
      mutationOrdinal: 2,
      stateEncoding:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
    }), false);
    fieldRuntime.markStateMutationSubmitted = originalMark;
    await cleanup(fixture, 'standalone grid-update quarantine test cleanup');
  });

  await t.test('parent coarse terminal quarantines after submission but before publication', async () => {
    const { terminal, gridUpdate } = await terminalWorkspaceInputFixture();
    const fixture = terminal.fixture;
    const parentFieldView = terminal.successorMicroepoch.parentFieldView;
    const field = parentFieldView.coarseFieldView;
    const fieldRuntime = field.ownerRuntime;
    const workspaceRuntime = terminalWorkspaceRuntime(terminal);
    const { encoder, artifact } = encodeTerminalWorkspace(
      terminal,
      gridUpdate,
      workspaceRuntime
    );
    const execution = artifact.parentFieldMechanicsWorkspaceExecution;
    fixture.device.queue.submit([encoder.finish()]);
    workspaceRuntime.markTerminalSubmissionObserved(execution);
    const originalMark = fieldRuntime.markStateMutationSequenceStageSubmitted;
    const injected = new Error(
      'injected parent coarse-terminal artifact publication failure'
    );
    fieldRuntime.markStateMutationSequenceStageSubmitted = (...args) => {
      originalMark(...args);
      throw injected;
    };

    assert.throws(
      () => workspaceRuntime.markTerminalSubmitted(execution),
      (error) => error === injected
    );
    assert.deepEqual(fieldRuntime.stateMutationState(field), {
      ordinal: 0,
      encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
      operation: 'topology-ready',
      pending: true,
      publicationLocked: true,
      quarantined: true
    });
    assert.equal(workspaceRuntime.isTerminalSubmitted(execution), false);
    fieldRuntime.markStateMutationSequenceStageSubmitted = originalMark;
    await workspaceRuntime.releaseExecutionAfter(
      execution,
      fixture.device.queue.onSubmittedWorkDone()
    );
    workspaceRuntime.destroy();
    await releaseTerminalP2gFixture(
      terminal,
      'parent coarse-terminal quarantine test cleanup'
    );
  });
});

test('single-submit resident mechanics uses only the sparse field and quarantines failed publication', async (t) => {
  const runFieldStep = (fixture) => runMlsMpmResidentStepWithOptionalWebGpu({
    sphParticleState: fixture.sphParticleState,
    mlsMpmParticleState: fixture.mlsMpmParticleState,
    sphParticleUpload: fixture.sphParticleUpload,
    mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
    schroederLevelAssignment: fixture.levelAssignment,
    schroederSelectedLevel: 1,
    schroederSpatialEpochGeneration: fixture.generation,
    canonicalSpatialRequired: true,
    observeCanonicalSpatialAuthority: false,
    mechanicsFieldMode: 'required',
    gridSpacingM: 0.5,
    boxDimsM: [1, 1, 1],
    preferWebGpu: true,
    device: fixture.device,
    readbackMode: 'no-full-readback',
    fuseNoFullResidentMechanics: true,
    summaryRunner: null
  });
  const releaseGeneration = async (fixture) => {
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(
        fixture.generation,
        fixture.device
      ),
      true
    );
    assert.equal(await fixture.generation.releasePromise, true);
  };

  await t.test('success allocates no dense P2G or updated-grid buffers', async () => {
    const fixture = fusedP2gProducerFixture({ createMacroAuthority: false });
    const createdBefore = fixture.device.createdBuffers.length;
    const step = await runFieldStep(fixture);
    const createdLabels = fixture.device.createdBuffers
      .slice(createdBefore)
      .map(({ label }) => label);

    assert.equal(step.p2gGridProjection.mechanicsFieldViewEnabled, true);
    assert.equal(step.gridUpdate.mechanicsFieldViewEnabled, true);
    assert.equal(step.p2gGridProjection.gridBuffer, null);
    assert.equal(step.gridUpdate.updatedGridBuffer, null);
    assert.equal(step.p2gGridProjection.gridBufferByteLength, 0);
    assert.equal(step.gridUpdate.updatedGridBufferByteLength, 0);
    assert.equal(step.stageBuffersRetained, true);
    assert.equal(step.residentBuffersRetained, true);
    assert.equal(step.readbackMode, 'no-full-readback');
    assert.equal(createdLabels.includes('ulg-mls-mpm-fused-p2g-grid-out'), false);
    assert.equal(createdLabels.includes('ulg-mls-mpm-fused-grid-update-out'), false);
    destroyMlsMpmResidentStepBuffers(step);
    await releaseGeneration(fixture);
  });

  await t.test('post-submit commit failure leaves the sparse field quarantined', async () => {
    const fixture = fusedP2gProducerFixture({ createMacroAuthority: false });
    const field = fixture.generation.parentFieldView.coarseFieldView;
    const fieldRuntime = field.ownerRuntime;
    const originalMark = fieldRuntime.markStateMutationSubmitted;
    const injected = new Error(
      'injected single-submit mechanics artifact publication failure'
    );
    fieldRuntime.markStateMutationSubmitted = () => { throw injected; };
    const createdBefore = fixture.device.createdBuffers.length;
    const submissionsBefore = fixture.device.submissions.length;

    await assert.rejects(runFieldStep(fixture), (error) => error === injected);
    assert.ok(fixture.device.submissions.length > submissionsBefore);
    assert.deepEqual(fieldRuntime.stateMutationState(field), {
      ordinal: 0,
      encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
      operation: 'topology-ready',
      pending: true,
      publicationLocked: false,
      quarantined: true
    });
    const createdLabels = fixture.device.createdBuffers
      .slice(createdBefore)
      .map(({ label }) => label);
    assert.equal(createdLabels.includes('ulg-mls-mpm-fused-p2g-grid-out'), false);
    assert.equal(createdLabels.includes('ulg-mls-mpm-fused-grid-update-out'), false);
    fieldRuntime.markStateMutationSubmitted = originalMark;
    await releaseGeneration(fixture);
  });
});

test('fused WebGPU P2G authenticates strict provenance and poisons post-submit failures', async (t) => {
  const runFusedP2g = (
    fixture,
    sphParticleUpload = fixture.sphParticleUpload,
    projectionDt = fixture.fineDt,
    overrides = {}
  ) => (
    runMlsMpmP2gGridProjectionWebGpu({
      device: fixture.device,
      sphParticleState: fixture.sphParticleState,
      mlsMpmParticleState: fixture.mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
      schroederSelectedLevel: 0,
      schroederSpatialEpochGeneration: fixture.generation,
      canonicalSpatialRequired: true,
      mechanicsFieldMode: 'required',
      canonicalParticleContinuation: fixture.particleContinuation,
      fusedFineSubstepTransaction: fixture.transaction,
      gridSpacingM: 0.25,
      boxDimsM: [1, 1, 1],
      dt: projectionDt,
      readbackMode: 'no-full-readback',
      ...overrides
    })
  );

  await t.test('success advances exactly once and rejects clones', async () => {
    const fixture = fusedP2gProducerFixture();
    let hostQueueFenceCount = 0;
    const originalOnSubmittedWorkDone =
      fixture.device.queue.onSubmittedWorkDone;
    fixture.device.queue.onSubmittedWorkDone = (...args) => {
      hostQueueFenceCount += 1;
      return originalOnSubmittedWorkDone.apply(fixture.device.queue, args);
    };
    const projection = await runFusedP2g(fixture);
    assert.equal(hostQueueFenceCount, 0);
    assert.equal(projection.queueOrderedCleanupReceipt?.completed, true);
    assert.equal(
      projection.queueOrderedCleanupReceipt?.hostQueueFenceCount,
      0
    );
    const contributionBuffer =
      fixture.microepochAuthority.fineFieldView.candidateKeyBuffer;
    const stableOrderBuffer =
      fixture.microepochAuthority.fineFieldView.stableCandidateOrderBuffer;
    assert.ok(contributionBuffer);
    assert.equal(
      fixture.device.createdBuffers.some(({ label }) => (
        label === 'ulg-mls-mpm-staged-p2g-deterministic-field-contributions'
      )),
      false
    );
    // Slice 9 widened the deterministic contribution record to 12 floats: the
    // third vec4 carries weighted represented volume, weighted V*p, and
    // pressure publication evidence alongside the mass/momentum vec4s.
    assert.equal(MECHANICS_FIELD_P2G_CONTRIBUTION_FLOATS, 12);
    assert.equal(
      contributionBuffer.size,
      fixture.microepochAuthority.fineFieldView.layout.candidateCapacity
        * MECHANICS_FIELD_P2G_CONTRIBUTION_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    );
    assert.equal(
      projection.mechanicsFieldP2gContributionBufferAllocatedBytes,
      0
    );
    assert.equal(
      projection.mechanicsFieldP2gContributionBufferRequiredBytes,
      contributionBuffer.size
    );
    assert.equal(
      projection.mechanicsFieldP2gContributionBufferCapacityBytes,
      contributionBuffer.size
    );
    assert.equal(
      projection.mechanicsFieldP2gContributionBufferAllocationPerformed,
      false
    );
    assert.equal(
      projection.mechanicsFieldP2gContributionBufferOwnership,
      'mechanics-field-candidate-arena-phase-alias'
    );
    assert.equal(
      projection.mechanicsFieldP2gReductionMode,
      'stable-radix-ordered-field-reduction'
    );
    assert.equal(
      projection.mechanicsFieldP2gReductionOrder,
      'stable-radix-equal-key-preserves-particle-stencil-candidate-order'
    );
    const deterministicP2gBindGroups = fixture.device.bindGroups.filter(({ entries }) => (
      entries?.find(({ binding }) => binding === 5)?.resource?.buffer
        === contributionBuffer
    ));
    assert.ok(deterministicP2gBindGroups.length > 0);
    for (const group of deterministicP2gBindGroups) {
      assert.equal(
        group.entries.find(({ binding }) => binding === 6)?.resource?.buffer,
        stableOrderBuffer
      );
      assert.equal(
        group.layout.entries.find(({ binding }) => binding === 5)?.buffer?.type,
        'storage'
      );
      assert.equal(
        group.layout.entries.find(({ binding }) => binding === 6)?.buffer?.type,
        'read-only-storage'
      );
    }
    assert.ok(fixture.device.shaderModules.some(({ code }) => (
      code.includes('fn p2g_field_group_lower_bound(field_index: u32)')
      && code.includes(
        '@binding(6) var<storage, read> p2g_field_sorted_candidate_indices'
      )
      && !code.includes('p2g_field_atomic_add_f32')
    )));
    const options = {
      transaction: fixture.transaction,
      macroAuthority: fixture.macroAuthority,
      microepochAuthority: fixture.microepochAuthority,
      particleContinuation: fixture.particleContinuation,
      fieldExecution: fixture.microepochAuthority.fineFieldView,
      mutationSegment: fixture.transaction.p2gMutation,
      priorArtifact: null,
      requireDeferred: true,
      proposalMode: 'proposal-deferred-to-post-mechanics'
    };
    assert.equal(fixture.device.submissions.length, 2);
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      projection,
      options
    ), true);
    const substitutedStableOrderBuffer = fixture.device.createBuffer({
      label: 'same-device-substituted-p2g-stable-order',
      size: stableOrderBuffer.size,
      usage: stableOrderBuffer.usage
    });
    tagWebGpuBufferDevice(substitutedStableOrderBuffer, fixture.device);
    fixture.microepochAuthority.fineFieldView.stableCandidateOrderBuffer =
      substitutedStableOrderBuffer;
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      projection,
      options
    ), false);
    fixture.microepochAuthority.fineFieldView.stableCandidateOrderBuffer =
      stableOrderBuffer;
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      projection,
      options
    ), true);
    substitutedStableOrderBuffer.destroy();
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      { ...projection },
      options
    ), false);
    projection.particleCount += 1;
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      projection,
      options
    ), false);
    projection.particleCount -= 1;
    const exactStateStrideBytes = fixture.sphParticleUpload.stateStrideBytes;
    fixture.sphParticleUpload.stateStrideBytes += Float32Array.BYTES_PER_ELEMENT;
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      projection,
      options
    ), false);
    fixture.sphParticleUpload.stateStrideBytes = exactStateStrideBytes;
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      projection,
      options
    ), true);
    // Pressure-law provenance: the sealed pressure rows are only meaningful
    // together with the law that produced them, so tampering with the ambient
    // reference, the EOS gauge scale, or the declared consumer mask must break
    // the origin match exactly like a substituted buffer does.
    assert.equal(
      typeof projection.mechanicsFieldPressureRequiredConsumerMask,
      'number'
    );
    for (const key of [
      'ambientPressurePa',
      'internalPressureScale',
      'mechanicsFieldPressureRequiredConsumerMask'
    ]) {
      const exact = projection[key];
      projection[key] = Number(exact) + 1;
      assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
        fixture.device,
        projection,
        options
      ), false, `tampered ${key} must not authenticate`);
      projection[key] = exact;
      assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
        fixture.device,
        projection,
        options
      ), true, `restored ${key} must authenticate`);
    }
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(contributionBuffer.destroyed, false);
    assert.equal(stableOrderBuffer.destroyed, false);
    assert.deepEqual(schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    ), {
      status: 'p2g-submitted',
      stageIndex: 1,
      submissionObservedStage: null,
      nextStage: 'grid-update',
      submittedStageCount: 1,
      g2pSubmitted: false,
      gpuReceiptStatus: 'not-submitted',
      gpuReceiptVerified: false,
      quarantineReason: null
    });
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('success fixture ends after P2G')
      }
    );
  });

  await t.test('count and particle ABI drift fail before allocation and release the claim', async () => {
    const fixture = fusedP2gProducerFixture();
    const createdAtStart = fixture.device.createdBuffers.length;
    const submissionsAtStart = fixture.device.submissions.length;
    const assertStillReserved = () => {
      const state = schroederFusedFineSubstepTransactionState(
        fixture.device,
        fixture.transaction
      );
      assert.equal(state.status, 'reserved');
      assert.equal(state.stageIndex, 0);
      assert.equal(fixture.device.createdBuffers.length, createdAtStart);
      assert.equal(fixture.device.submissions.length, submissionsAtStart);
    };

    const originalSphCount = fixture.sphParticleState.particleCount;
    const originalMlsCount = fixture.mlsMpmParticleState.particleCount;
    fixture.sphParticleState.particleCount = originalSphCount + 1;
    fixture.mlsMpmParticleState.particleCount = originalMlsCount + 1;
    await assert.rejects(
      runFusedP2g(fixture),
      /exact pending transaction and particle continuation/
    );
    fixture.sphParticleState.particleCount = originalSphCount;
    fixture.mlsMpmParticleState.particleCount = originalMlsCount;
    assertStillReserved();

    const exactSphUploadSchema = fixture.sphParticleUpload.schema;
    fixture.sphParticleUpload.schema = ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA;
    await assert.rejects(
      runFusedP2g(fixture),
      /exact pending transaction and particle continuation/
    );
    fixture.sphParticleUpload.schema = exactSphUploadSchema;
    assertStillReserved();

    const exactMlsUploadSchema = fixture.mlsMpmParticleUpload.schema;
    fixture.mlsMpmParticleUpload.schema = ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA;
    await assert.rejects(
      runFusedP2g(fixture),
      /exact pending transaction and particle continuation/
    );
    fixture.mlsMpmParticleUpload.schema = exactMlsUploadSchema;
    assertStillReserved();

    await assert.rejects(
      runFusedP2g(fixture, {
        ...fixture.sphParticleUpload,
        stateStrideBytes:
          fixture.sphParticleUpload.stateStrideBytes
          + Float32Array.BYTES_PER_ELEMENT
      }),
      /exact pending transaction and particle continuation/
    );
    assertStillReserved();

    await assert.rejects(
      runFusedP2g(fixture, {
        ...fixture.sphParticleUpload,
        thermoBufferByteLength:
          fixture.sphParticleUpload.thermoBufferByteLength
          + Float32Array.BYTES_PER_ELEMENT
      }),
      /exact pending transaction and particle continuation/
    );
    assertStillReserved();

    const exactStateBufferSize = fixture.sphParticleUpload.stateBuffer.size;
    fixture.sphParticleUpload.stateBuffer.size = exactStateBufferSize - 4;
    await assert.rejects(
      runFusedP2g(fixture),
      /exact pending transaction and particle continuation/
    );
    fixture.sphParticleUpload.stateBuffer.size = exactStateBufferSize;
    assertStillReserved();

    const fieldExecution = fixture.microepochAuthority.fineFieldView;
    const exactCandidateKeyBufferSize = fieldExecution.candidateKeyBuffer.size;
    fieldExecution.candidateKeyBuffer.size = exactCandidateKeyBufferSize - 4;
    await assert.rejects(
      runFusedP2g(fixture),
      (error) => (
        error?.code === 'ERR_MECHANICS_FIELD_P2G_SCRATCH_AUTHORITY'
        && /capacity-bounded arena candidate buffer/.test(error.message)
      )
    );
    fieldExecution.candidateKeyBuffer.size = exactCandidateKeyBufferSize;
    assertStillReserved();

    const foreignStateBuffer = {
      label: 'foreign-fused-p2g-state',
      size: fixture.sphParticleUpload.stateBufferByteLength,
      destroyed: false,
      destroy() {
        this.destroyed = true;
      }
    };
    tagWebGpuBufferDevice(foreignStateBuffer, {});
    await assert.rejects(
      runFusedP2g(fixture, {
        ...fixture.sphParticleUpload,
        stateBuffer: foreignStateBuffer
      }),
      /exact pending transaction and particle continuation/
    );
    assert.equal(foreignStateBuffer.destroyed, false);
    assertStillReserved();

    await runFusedP2g(fixture);
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('particle ABI preflight fixture cleanup')
      }
    );
  });

  await t.test('post-import CPU count mutation is rejected before encoding and remains retryable', async () => {
    const fixture = fusedP2gProducerFixture();
    const submissionsAtStart = fixture.device.submissions.length;
    const pending = runFusedP2g(fixture);
    fixture.sphParticleState.particleCount += 1;
    fixture.mlsMpmParticleState.particleCount += 1;
    await assert.rejects(
      pending,
      /producer claim or exact transaction provenance is stale/
    );
    fixture.sphParticleState.particleCount -= 1;
    fixture.mlsMpmParticleState.particleCount -= 1;
    assert.equal(fixture.device.submissions.length, submissionsAtStart);
    assert.equal(schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    ).status, 'reserved');
    await runFusedP2g(fixture);
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('post-import count mutation fixture cleanup')
      }
    );
  });

  await t.test('r=2 rejects macro-dt P2G before submission and remains retryable', async () => {
    const fixture = fusedP2gProducerFixture({ fineSubstepCount: 2 });
    await assert.rejects(
      runFusedP2g(fixture, fixture.sphParticleUpload, fixture.macroDt),
      /exact pending transaction and particle continuation/
    );
    let state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'reserved');
    assert.equal(state.stageIndex, 0);
    assert.equal(state.submissionObservedStage, null);
    assert.equal(fixture.device.submissions.length, 1);
    await runFusedP2g(fixture);
    state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'p2g-submitted');
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('wrong fine dt fixture cleanup')
      }
    );
    fixture.refluxLedger.destroy();
  });

  await t.test('wrong upload object fails before submission and exact retry succeeds', async () => {
    const fixture = fusedP2gProducerFixture();
    const submissionsAtStart = fixture.device.submissions.length;
    const createdAtStart = fixture.device.createdBuffers.length;
    await assert.rejects(
      runFusedP2g(fixture, { ...fixture.sphParticleUpload }),
      /exact pending transaction and particle continuation/
    );
    assert.equal(fixture.device.submissions.length, submissionsAtStart);
    assert.equal(fixture.device.createdBuffers.length, createdAtStart);
    const state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'reserved');
    assert.equal(state.stageIndex, 0);
    assert.equal(state.submissionObservedStage, null);
    await runFusedP2g(fixture);
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('wrong upload object fixture cleanup')
      }
    );
  });

  await t.test('post-submit upload ABI mutation quarantines and destroys the arena', async () => {
    const fixture = fusedP2gProducerFixture();
    const fineField = fixture.microepochAuthority.fineFieldView;
    const fieldRuntime = fineField.ownerRuntime;
    const originalSubmit = fixture.device.queue.submit;
    const exactStateStrideBytes = fixture.sphParticleUpload.stateStrideBytes;
    fixture.device.queue.submit = (commandBuffers) => {
      originalSubmit(commandBuffers);
      fixture.sphParticleUpload.stateStrideBytes +=
        Float32Array.BYTES_PER_ELEMENT;
    };
    await assert.rejects(
      runFusedP2g(fixture),
      /stage submission observation is stale|does not match its exact fused producer inputs/
    );
    fixture.device.queue.submit = originalSubmit;
    fixture.sphParticleUpload.stateStrideBytes = exactStateStrideBytes;
    assert.equal(fixture.device.submissions.length, 2);
    const state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'quarantined');
    assert.equal(state.stageIndex, 0);
    assert.equal(state.submissionObservedStage, 'p2g');
    assert.equal(fieldRuntime.isStateArtifactQuarantined(fineField), true);
    assert.equal(fieldRuntime.quarantinedArenaCount(), 1);
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('post-submit upload ABI mutation')
      }
    );
    assert.equal(fieldRuntime.ownsExecution(fineField), false);
    assert.equal(fineField.fieldViewBuffer.destroyed, true);
  });

  await t.test('synchronous queue-submit failure discards before observation and preserves reuse', async () => {
    const fixture = fusedP2gProducerFixture();
    const fineField = fixture.microepochAuthority.fineFieldView;
    const fieldRuntime = fineField.ownerRuntime;
    const originalSubmit = fixture.device.queue.submit;
    fixture.device.queue.submit = () => {
      throw new Error('injected P2G queue.submit failure');
    };
    await assert.rejects(
      runFusedP2g(fixture),
      /injected P2G queue\.submit failure/
    );
    fixture.device.queue.submit = originalSubmit;
    assert.equal(fixture.device.submissions.length, 1);
    const state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'discarded');
    assert.equal(state.stageIndex, 0);
    assert.equal(state.submissionObservedStage, null);
    assert.equal(fieldRuntime.stateMutationState(fineField).pending, false);
    assert.equal(fieldRuntime.isStateArtifactQuarantined(fineField), false);
    const usableBeforeRetirement = fieldRuntime.usableArenaCount();
    const activeBeforeRetirement = fieldRuntime.activeExecutionCount();
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('pre-submit failure fixture cleanup')
      }
    );
    assert.equal(fieldRuntime.ownsExecution(fineField), false);
    assert.equal(fieldRuntime.activeExecutionCount(), activeBeforeRetirement - 1);
    assert.equal(fieldRuntime.usableArenaCount(), usableBeforeRetirement);
    assert.equal(fieldRuntime.retiredArenaCount(), 0);
    assert.equal(fineField.fieldViewBuffer.destroyed, false);
  });
});

test('fused coarse-terminal WebGPU P2G is exact, claimed, and fail-closed', async (t) => {
  await t.test('one claimed producer submits once and publishes only its exact artifact', async () => {
    const terminal = await fusedCoarseTerminalP2gFixture();
    const { fixture, terminalTransaction } = terminal;
    const createdBefore = fixture.device.createdBuffers.length;
    const submissionsBefore = fixture.device.submissions.length;
    const pending = runTerminalFixtureP2g(terminal);
    assert.throws(
      () => markSchroederFusedCoarseTerminalStageSubmissionObserved(
        fixture.device,
        terminalTransaction,
        { stage: 'p2g' }
      ),
      /submission observation is stale, foreign, or out of order/
    );
    const competing = runTerminalFixtureP2g(terminal);
    const [first, second] = await Promise.allSettled([pending, competing]);
    assert.equal(first.status, 'fulfilled');
    assert.equal(second.status, 'rejected');
    assert.match(second.reason.message, /already has an active producer/);
    const projection = first.value;
    const options = terminalP2gOptions(terminal);
    assert.equal(fixture.device.submissions.length, submissionsBefore + 1);
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      projection,
      options
    ), true);
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      { ...projection },
      options
    ), false);
    projection.particleCount += 1;
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      projection,
      options
    ), false);
    projection.particleCount -= 1;
    const identityStrideBytes = terminal.uploads.sphParticleUpload.identityStrideBytes;
    terminal.uploads.sphParticleUpload.identityStrideBytes += 4;
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      projection,
      options
    ), false);
    terminal.uploads.sphParticleUpload.identityStrideBytes = identityStrideBytes;
    assert.equal(schroederFusedCoarseTerminalTransactionState(
      fixture.device,
      terminalTransaction
    ).stageIndex, 1);
    await new Promise((resolve) => setImmediate(resolve));
    const owned = fixture.device.createdBuffers.slice(createdBefore);
    assert.equal(owned.length, 0);
    for (const borrowed of [
      terminal.uploads.sphParticleUpload.stateBuffer,
      terminal.uploads.sphParticleUpload.thermoBuffer,
      terminal.uploads.sphParticleUpload.identityBuffer,
      terminal.uploads.mlsMpmParticleUpload.mechanicsBuffer
    ]) {
      assert.equal(borrowed.destroyed, false);
    }
    await releaseTerminalP2gFixture(
      terminal,
      'terminal P2G exact producer fixture cleanup'
    );
  });

  await t.test('E_r, C_r, level, dt, count, and ABI drift fail before allocation', async () => {
    const terminal = await fusedCoarseTerminalP2gFixture();
    const { fixture, terminalTransaction } = terminal;
    const createdBefore = fixture.device.createdBuffers.length;
    const submissionsBefore = fixture.device.submissions.length;
    const assertReservedWithoutWork = () => {
      const state = schroederFusedCoarseTerminalTransactionState(
        fixture.device,
        terminalTransaction
      );
      assert.equal(state.status, 'reserved');
      assert.equal(state.stageIndex, 0);
      assert.equal(state.submissionObservedStage, null);
      assert.equal(fixture.device.createdBuffers.length, createdBefore);
      assert.equal(fixture.device.submissions.length, submissionsBefore);
    };
    const rejectPreflight = async (overrides) => {
      await assert.rejects(
        runTerminalFixtureP2g(terminal, terminalTransaction, overrides),
        /requires exact E_r\/C_r, level, and macro timestep/
      );
      assertReservedWithoutWork();
    };
    await assert.rejects(
      runTerminalFixtureP2g(terminal, terminalTransaction, {
        fusedFineSubstepTransaction: fixture.transaction
      }),
      /either a fused fine transaction or fused coarse-terminal transaction, never both/
    );
    assertReservedWithoutWork();
    await rejectPreflight({
      schroederSpatialEpochGeneration: fixture.generation
    });
    await rejectPreflight({
      canonicalParticleContinuation: fixture.particleContinuation
    });
    await rejectPreflight({
      sphParticleUpload: { ...terminal.uploads.sphParticleUpload }
    });
    await rejectPreflight({ schroederSelectedLevel: 0 });
    await rejectPreflight({ dt: fixture.fineDt });
    await rejectPreflight({
      sphParticleState: { ...fixture.sphParticleState, particleCount: 0 },
      mlsMpmParticleState: { ...fixture.mlsMpmParticleState, particleCount: 0 }
    });
    await rejectPreflight({
      sphParticleState: { ...fixture.sphParticleState, particleCount: 2 },
      mlsMpmParticleState: { ...fixture.mlsMpmParticleState, particleCount: 2 }
    });
    const exactIdentityStrideBytes =
      terminal.uploads.sphParticleUpload.identityStrideBytes;
    terminal.uploads.sphParticleUpload.identityStrideBytes += 4;
    await rejectPreflight({});
    terminal.uploads.sphParticleUpload.identityStrideBytes =
      exactIdentityStrideBytes;
    const exactIdentityBufferByteLength =
      terminal.uploads.sphParticleUpload.identityBufferByteLength;
    terminal.uploads.sphParticleUpload.identityBufferByteLength += 4;
    await rejectPreflight({});
    terminal.uploads.sphParticleUpload.identityBufferByteLength =
      exactIdentityBufferByteLength;
    await rejectPreflight({
      sphParticleUpload: {
        ...terminal.uploads.sphParticleUpload,
        stateBufferByteLength:
          terminal.uploads.sphParticleUpload.stateBufferByteLength + 4
      }
    });
    const exactStateSize = terminal.uploads.sphParticleUpload.stateBuffer.size;
    terminal.uploads.sphParticleUpload.stateBuffer.size = exactStateSize - 4;
    await rejectPreflight({});
    terminal.uploads.sphParticleUpload.stateBuffer.size = exactStateSize;
    const exactIdentityBufferSize =
      terminal.uploads.sphParticleUpload.identityBuffer.size;
    terminal.uploads.sphParticleUpload.identityBuffer.size = 0;
    await rejectPreflight({});
    terminal.uploads.sphParticleUpload.identityBuffer.size =
      exactIdentityBufferSize;
    terminal.uploads.sphParticleUpload.stateBuffer.destroyed = true;
    await rejectPreflight({});
    terminal.uploads.sphParticleUpload.stateBuffer.destroyed = false;
    const foreignStateBuffer = {
      size: terminal.uploads.sphParticleUpload.stateBufferByteLength,
      destroyed: false,
      destroy() {
        this.destroyed = true;
      }
    };
    tagWebGpuBufferDevice(foreignStateBuffer, {});
    await rejectPreflight({
      sphParticleUpload: {
        ...terminal.uploads.sphParticleUpload,
        stateBuffer: foreignStateBuffer
      }
    });
    assert.equal(foreignStateBuffer.destroyed, false);

    const createdBeforeAwaitDrift = fixture.device.createdBuffers.length;
    const pending = runTerminalFixtureP2g(terminal);
    fixture.sphParticleState.particleCount += 1;
    fixture.mlsMpmParticleState.particleCount += 1;
    await assert.rejects(
      pending,
      /producer claim or exact transaction provenance is stale/
    );
    fixture.sphParticleState.particleCount -= 1;
    fixture.mlsMpmParticleState.particleCount -= 1;
    assert.equal(fixture.device.submissions.length, submissionsBefore);
    assert.equal(schroederFusedCoarseTerminalTransactionState(
      fixture.device,
      terminalTransaction
    ).status, 'reserved');
    const awaitDriftAllocations = fixture.device.createdBuffers
      .slice(createdBeforeAwaitDrift);
    assert.equal(awaitDriftAllocations.length, 0);
    const createdBeforeAbiAwaitDrift = fixture.device.createdBuffers.length;
    const abiPending = runTerminalFixtureP2g(terminal);
    terminal.uploads.sphParticleUpload.identityStrideBytes += 4;
    await assert.rejects(
      abiPending,
      /producer claim or exact transaction provenance is stale/
    );
    terminal.uploads.sphParticleUpload.identityStrideBytes =
      exactIdentityStrideBytes;
    assert.equal(fixture.device.submissions.length, submissionsBefore);
    assert.equal(schroederFusedCoarseTerminalTransactionState(
      fixture.device,
      terminalTransaction
    ).status, 'reserved');
    const abiAwaitDriftAllocations = fixture.device.createdBuffers
      .slice(createdBeforeAbiAwaitDrift);
    assert.equal(abiAwaitDriftAllocations.length, 0);
    const projection = await runTerminalFixtureP2g(terminal);
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      projection,
      terminalP2gOptions(terminal)
    ), true);
    for (const borrowed of [
      terminal.uploads.sphParticleUpload.stateBuffer,
      terminal.uploads.sphParticleUpload.thermoBuffer,
      terminal.uploads.sphParticleUpload.identityBuffer,
      terminal.uploads.mlsMpmParticleUpload.mechanicsBuffer
    ]) {
      assert.equal(borrowed.destroyed, false);
    }
    await releaseTerminalP2gFixture(
      terminal,
      'terminal P2G preflight and await-drift fixture cleanup'
    );
  });

  await t.test('arena-owned P2G controls allocate nothing on the hot path', async () => {
    const terminal = await fusedCoarseTerminalP2gFixture();
    const { fixture, successorMicroepoch } = terminal;
    const submissionsBefore = fixture.device.submissions.length;
    const coarseField = successorMicroepoch.parentFieldView.coarseFieldView;
    const p2gWorkspace = coarseField.ownerRuntime.p2gWorkspaceForExecution(
      coarseField
    );
    const borrowed = [
      terminal.uploads.sphParticleUpload.stateBuffer,
      terminal.uploads.sphParticleUpload.thermoBuffer,
      terminal.uploads.sphParticleUpload.identityBuffer,
      terminal.uploads.mlsMpmParticleUpload.mechanicsBuffer
    ];
    const originalCreateBuffer = fixture.device.createBuffer;
    const createdBefore = fixture.device.createdBuffers.length;
    fixture.device.createBuffer = () => {
      throw new Error('terminal P2G performed a hot buffer allocation');
    };
    const projection = await runTerminalFixtureP2g(terminal);
    fixture.device.createBuffer = originalCreateBuffer;
    assert.equal(fixture.device.createdBuffers.length, createdBefore);
    assert.equal(fixture.device.submissions.length, submissionsBefore + 1);
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      projection,
      terminalP2gOptions(terminal)
    ), true);
    assert.equal(borrowed.every((buffer) => buffer.destroyed === false), true);
    assert.equal(
      Object.values(p2gWorkspace).every((buffer) => buffer.destroyed === false),
      true
    );

    await releaseTerminalP2gFixture(
      terminal,
      'terminal P2G arena-owned control fixture cleanup'
    );
  });

  await t.test('params-write and submit failures discard the old transaction and require a fresh brand', async () => {
    for (const mode of ['params-write-lock-after-effect', 'submit-sequence-after-effect']) {
      const terminal = await fusedCoarseTerminalP2gFixture();
      const { fixture, successorMicroepoch } = terminal;
      const oldTransaction = terminal.terminalTransaction;
      const coarseField = successorMicroepoch.parentFieldView.coarseFieldView;
      const fieldRuntime = coarseField.ownerRuntime;
      const createdBefore = fixture.device.createdBuffers.length;
      const submissionsBefore = fixture.device.submissions.length;
      const originalWriteBuffer = fixture.device.queue.writeBuffer;
      const originalSubmit = fixture.device.queue.submit;
      const originalDiscardSequence = fieldRuntime.discardStateMutationSequence;
      const originalDiscardLock = fieldRuntime.discardStatePublicationLock;
      let cleanupHookCalls = 0;
      if (mode.startsWith('params-write')) {
        fixture.device.queue.writeBuffer = (buffer, ...args) => {
          if (buffer.label === 'ulg-mls-mpm-p2g-mechanics-field-params') {
            throw new Error('injected terminal P2G params write failure');
          }
          return originalWriteBuffer(buffer, ...args);
        };
        fieldRuntime.discardStatePublicationLock = (...args) => {
          cleanupHookCalls += 1;
          originalDiscardLock(...args);
          throw new Error('injected lock discard throw after effect');
        };
      } else {
        fixture.device.queue.submit = () => {
          throw new Error('injected terminal P2G queue.submit failure');
        };
        fieldRuntime.discardStateMutationSequence = (...args) => {
          cleanupHookCalls += 1;
          originalDiscardSequence(...args);
          throw new Error('injected sequence discard throw after effect');
        };
      }
      await assert.rejects(
        runTerminalFixtureP2g(terminal),
        mode.startsWith('params-write')
          ? /injected terminal P2G params write failure/
          : /injected terminal P2G queue\.submit failure/
      );
      fixture.device.queue.writeBuffer = originalWriteBuffer;
      fixture.device.queue.submit = originalSubmit;
      fieldRuntime.discardStateMutationSequence = originalDiscardSequence;
      fieldRuntime.discardStatePublicationLock = originalDiscardLock;
      assert.equal(cleanupHookCalls, 1);
      assert.equal(schroederFusedCoarseTerminalTransactionState(
        fixture.device,
        oldTransaction
      ).status, 'discarded');
      assert.equal(validateSchroederFusedCoarseTerminalTransaction(
        fixture.device,
        oldTransaction
      ), false);
      assert.equal(
        fieldRuntime.stateMutationState(coarseField).pending,
        false
      );
      assert.equal(
        fieldRuntime.isStatePublicationLockActive(
          coarseField,
          oldTransaction.coarsePublicationLock
        ),
        false
      );
      assert.equal(fixture.device.submissions.length, submissionsBefore);
      const failedAttemptBuffers = fixture.device.createdBuffers.slice(createdBefore);
      assert.equal(failedAttemptBuffers.length, 0);
      assert.equal(
        Object.values(fieldRuntime.p2gWorkspaceForExecution(coarseField))
          .every((buffer) => buffer.destroyed === false),
        true
      );
      for (const borrowed of [
        terminal.uploads.sphParticleUpload.stateBuffer,
        terminal.uploads.sphParticleUpload.thermoBuffer,
        terminal.uploads.sphParticleUpload.identityBuffer,
        terminal.uploads.mlsMpmParticleUpload.mechanicsBuffer
      ]) {
        assert.equal(borrowed.destroyed, false);
      }

      const freshTransaction = createSchroederFusedCoarseTerminalTransaction({
        device: fixture.device,
        macroAuthority: fixture.macroAuthority,
        microepochAuthority: successorMicroepoch,
        particleContinuation: terminal.continuation
      });
      assert.notEqual(freshTransaction, oldTransaction);
      terminal.terminalTransaction = freshTransaction;
      const projection = await runTerminalFixtureP2g(terminal);
      assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
        fixture.device,
        projection,
        terminalP2gOptions(terminal)
      ), true);
      await releaseTerminalP2gFixture(
        terminal,
        `terminal P2G ${mode} fixture cleanup`
      );
    }
  });

  await t.test('post-submit ABI drift quarantines both fields despite fence and cleanup failures', async () => {
    for (const fenceMode of ['throw', 'reject']) {
      const terminal = await fusedCoarseTerminalP2gFixture();
      const { fixture, successorMicroepoch, terminalTransaction } = terminal;
      const coarseField = successorMicroepoch.parentFieldView.coarseFieldView;
      const fineField = successorMicroepoch.fineFieldView;
      const coarseRuntime = coarseField.ownerRuntime;
      const fineRuntime = fineField.ownerRuntime;
      const originalSubmit = fixture.device.queue.submit;
      const originalFence = fixture.device.queue.onSubmittedWorkDone;
      const createdBefore = fixture.device.createdBuffers.length;
      const p2gWorkspace = coarseRuntime.p2gWorkspaceForExecution(coarseField);
      const sphUpload = terminal.uploads.sphParticleUpload;
      const exactStateStrideBytes = sphUpload.stateStrideBytes;
      const exactIdentityByteLength = sphUpload.identityBufferByteLength;
      fixture.device.queue.submit = (commandBuffers) => {
        originalSubmit(commandBuffers);
        if (fenceMode === 'throw') {
          sphUpload.stateStrideBytes += Float32Array.BYTES_PER_ELEMENT;
        } else {
          sphUpload.identityBufferByteLength += Uint32Array.BYTES_PER_ELEMENT;
        }
      };
      fixture.device.queue.onSubmittedWorkDone = fenceMode === 'throw'
        ? () => {
            throw new Error('injected terminal P2G cleanup fence throw');
          }
        : () => Promise.reject(
            new Error('injected terminal P2G cleanup fence rejection')
          );
      await assert.rejects(
        runTerminalFixtureP2g(terminal),
        /submission observation is stale|does not match its exact fused producer inputs/
      );
      fixture.device.queue.submit = originalSubmit;
      fixture.device.queue.onSubmittedWorkDone = originalFence;
      sphUpload.stateStrideBytes = exactStateStrideBytes;
      sphUpload.identityBufferByteLength = exactIdentityByteLength;
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(fixture.device.createdBuffers.length, createdBefore);
      assert.equal(
        Object.values(p2gWorkspace).every((buffer) => buffer.destroyed === false),
        true
      );
      const state = schroederFusedCoarseTerminalTransactionState(
        fixture.device,
        terminalTransaction
      );
      assert.equal(state.status, 'quarantined');
      assert.equal(state.stageIndex, 0);
      assert.equal(state.submissionObservedStage, 'p2g');
      assert.equal(coarseRuntime.isStateArtifactQuarantined(coarseField), true);
      assert.equal(fineRuntime.isStateArtifactQuarantined(fineField), true);
      for (const borrowed of [
        terminal.uploads.sphParticleUpload.stateBuffer,
        terminal.uploads.sphParticleUpload.thermoBuffer,
        terminal.uploads.sphParticleUpload.identityBuffer,
        terminal.uploads.mlsMpmParticleUpload.mechanicsBuffer
      ]) {
        assert.equal(borrowed.destroyed, false);
      }
      await releaseTerminalP2gFixture(
        terminal,
        `terminal P2G post-submit ${fenceMode} fixture cleanup`
      );
      assert.equal(coarseRuntime.ownsExecution(coarseField), false);
      assert.equal(fineRuntime.ownsExecution(fineField), false);
      assert.equal(coarseField.fieldViewBuffer.destroyed, true);
      assert.equal(fineField.fieldViewBuffer.destroyed, true);
    }
  });
});

test('fused coarse-terminal WebGPU grid update is exact, claimed, and retry-safe', async (t) => {
  await t.test('one claimed producer advances 1→2 and only its exact artifact authenticates', async () => {
    const terminal = await fusedCoarseTerminalP2gFixture();
    const p2gProjection = await runTerminalFixtureP2g(terminal);
    const { fixture, terminalTransaction } = terminal;
    const createdBefore = fixture.device.createdBuffers.length;
    const submissionsBefore = fixture.device.submissions.length;
    const pending = runTerminalFixtureGridUpdate(terminal, p2gProjection);
    const competing = runTerminalFixtureGridUpdate(terminal, p2gProjection);
    const [first, second] = await Promise.allSettled([pending, competing]);
    assert.equal(first.status, 'fulfilled');
    assert.equal(second.status, 'rejected');
    assert.match(second.reason.message, /already has a producer|not ready/);
    const update = first.value;
    const options = terminalGridUpdateOptions(terminal, p2gProjection);
    assert.equal(fixture.device.submissions.length, submissionsBefore + 1);
    assert.equal(update.mechanicsFieldMutationInputOrdinal, 1);
    assert.equal(update.mechanicsFieldMutationOutputOrdinal, 2);
    assert.equal(update.mechanicsFieldIndirectDispatchDimensions, 2);
    assert.equal(
      update.mechanicsFieldIndirectDispatchLinearization,
      'linearGroup=workgroup.x+workgroup.y*dispatchX'
    );
    assert.equal(
      update.mechanicsFieldSourceDispatchWorkgroups,
      p2gProjection.mechanicsFieldViewExecution.sourceDispatchWorkgroups
    );
    assert.equal(
      update.mechanicsFieldCandidateDispatchWorkgroups,
      p2gProjection.mechanicsFieldViewExecution.candidateDispatchWorkgroups
    );
    assert.equal(update.fusedCoarseTerminalTransaction, terminalTransaction);
    assert.equal(update.terminalMicroepochAuthority, terminal.successorMicroepoch);
    assert.equal(update.sourceParticleContinuation, terminal.continuation);
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate(
      fixture.device,
      update,
      options
    ), true);
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate(
      fixture.device,
      { ...update },
      options
    ), false);
    const forged = {};
    Object.defineProperty(
      forged,
      Symbol.for('peercompute.ulg.mechanics-field-grid-update-origin-validator.v0'),
      {
        value: () => true,
        enumerable: false,
        configurable: false,
        writable: false
      }
    );
    assert.equal(validateSubmittedMlsMpmMechanicsFieldGridUpdate(
      fixture.device,
      forged
    ), false);
    assert.deepEqual(schroederFusedCoarseTerminalTransactionState(
      fixture.device,
      terminalTransaction
    ), {
      status: 'grid-update-submitted',
      stageIndex: 2,
      submissionObservedStage: null,
      nextStage: 'coarse-terminal',
      submittedStageCount: 2,
      g2pSubmitted: false,
      outputClaimed: false,
      gpuReceiptStatus: 'not-submitted',
      quarantineReason: null
    });
    await new Promise((resolve) => setImmediate(resolve));
    const owned = fixture.device.createdBuffers.slice(createdBefore);
    assert.equal(owned.length, 0);
    assert.equal(update.mechanicsFieldGridUpdateWorkspaceBorrowed, true);
    assert.equal(update.mechanicsFieldGridUpdateHotPathAllocationCount, 0);
    assert.equal(
      terminal.successorMicroepoch.parentFieldView.coarseFieldView
        .fieldViewBuffer.destroyed,
      false
    );
    const fineField = terminal.successorMicroepoch.fineFieldView;
    const coarseField = terminal.successorMicroepoch.parentFieldView.coarseFieldView;
    await releaseTerminalP2gFixture(
      terminal,
      'terminal grid update exact producer fixture cleanup'
    );
    assert.equal(fineField.ownerRuntime.ownsExecution(fineField), false);
    assert.equal(coarseField.ownerRuntime.ownsExecution(coarseField), false);
    assert.equal(fineField.fieldViewBuffer.destroyed, true);
    assert.equal(coarseField.fieldViewBuffer.destroyed, true);
  });

  await t.test('wrong mode, E_r, C_r, field, level, dt, prior, and receipt do zero work', async () => {
    const terminal = await fusedCoarseTerminalP2gFixture();
    const p2gProjection = await runTerminalFixtureP2g(terminal);
    const { fixture, terminalTransaction } = terminal;
    const createdBefore = fixture.device.createdBuffers.length;
    const submissionsBefore = fixture.device.submissions.length;
    const assertGridReadyWithoutWork = () => {
      const state = schroederFusedCoarseTerminalTransactionState(
        fixture.device,
        terminalTransaction
      );
      assert.equal(state.status, 'p2g-submitted');
      assert.equal(state.stageIndex, 1);
      assert.equal(state.submissionObservedStage, null);
      assert.equal(fixture.device.createdBuffers.length, createdBefore);
      assert.equal(fixture.device.submissions.length, submissionsBefore);
    };
    await assert.rejects(
      runTerminalFixtureGridUpdate(terminal, p2gProjection, terminalTransaction, {
        fusedFineSubstepTransaction: fixture.transaction
      }),
      /either a fused fine transaction or fused coarse-terminal transaction, never both/
    );
    assertGridReadyWithoutWork();
    for (const [overrides, pattern] of [
      [{ p2gGridProjection: { ...p2gProjection } }, /exact locally submitted P2G artifact/],
      [{ fusedCoarseTerminalTransaction: { ...terminalTransaction } }, /exact locally submitted P2G artifact/],
      [{ dt: terminalTransaction.macroAuthority.macroDt + 0.001 }, /exact locally submitted P2G artifact/],
      [{ mechanicsFieldEnergyReceipt: { deferSeal: false } }, /deferred heat sealing/]
    ]) {
      await assert.rejects(
        runTerminalFixtureGridUpdate(
          terminal,
          overrides.p2gGridProjection ?? p2gProjection,
          overrides.fusedCoarseTerminalTransaction ?? terminalTransaction,
          overrides
        ),
        pattern
      );
      assertGridReadyWithoutWork();
    }
    const exactLevel = p2gProjection.schroederLevelFilter.selectedLevel;
    p2gProjection.schroederLevelFilter.selectedLevel = exactLevel + 1;
    await assert.rejects(
      runTerminalFixtureGridUpdate(terminal, p2gProjection),
      /exact locally submitted P2G artifact/
    );
    p2gProjection.schroederLevelFilter.selectedLevel = exactLevel;
    assertGridReadyWithoutWork();
    const exactField = p2gProjection.mechanicsFieldViewExecution;
    p2gProjection.mechanicsFieldViewExecution = fixture.transaction.fineFieldView;
    await assert.rejects(
      runTerminalFixtureGridUpdate(terminal, p2gProjection),
      /exact locally submitted P2G artifact/
    );
    p2gProjection.mechanicsFieldViewExecution = exactField;
    assertGridReadyWithoutWork();

    const exactIdentityStrideBytes =
      terminal.uploads.sphParticleUpload.identityStrideBytes;
    terminal.uploads.sphParticleUpload.identityStrideBytes += 4;
    await assert.rejects(
      runTerminalFixtureGridUpdate(terminal, p2gProjection),
      /exact locally submitted P2G artifact/
    );
    terminal.uploads.sphParticleUpload.identityStrideBytes =
      exactIdentityStrideBytes;
    assertGridReadyWithoutWork();

    // Same device, but an authentic E0/C0 fine transaction rather than this
    // terminal producer's exact E_r/C_r authority pair.  This keeps the
    // lineage rejection independent of the foreign-device preflight below.
    await assert.rejects(
      runTerminalFixtureGridUpdate(
        terminal,
        p2gProjection,
        fixture.transaction
      ),
      /exact locally submitted P2G artifact/
    );
    assertGridReadyWithoutWork();

    const foreignTerminal = await fusedCoarseTerminalP2gFixture();
    await assert.rejects(
      runTerminalFixtureGridUpdate(
        terminal,
        p2gProjection,
        foreignTerminal.terminalTransaction
      ),
      /exact locally submitted P2G artifact/
    );
    assertGridReadyWithoutWork();
    await releaseTerminalP2gFixture(
      foreignTerminal,
      'foreign authentic E_r C_r grid preflight fixture cleanup'
    );

    await runTerminalFixtureGridUpdate(terminal, p2gProjection);
    await releaseTerminalP2gFixture(
      terminal,
      'terminal grid update preflight fixture cleanup'
    );
  });

  await t.test('TOCTOU, create, write, and submit failures clean up and retry stage 1', async () => {
    const terminal = await fusedCoarseTerminalP2gFixture();
    const p2gProjection = await runTerminalFixtureP2g(terminal);
    const { fixture, terminalTransaction } = terminal;
    const submissionsBefore = fixture.device.submissions.length;
    const assertGridReady = () => {
      const state = schroederFusedCoarseTerminalTransactionState(
        fixture.device,
        terminalTransaction
      );
      assert.equal(state.status, 'p2g-submitted');
      assert.equal(state.stageIndex, 1);
      assert.equal(state.submissionObservedStage, null);
      assert.equal(fixture.device.submissions.length, submissionsBefore);
    };

    let createdBefore = fixture.device.createdBuffers.length;
    const pending = runTerminalFixtureGridUpdate(terminal, p2gProjection);
    const exactProjectionDt = p2gProjection.dt;
    p2gProjection.dt += 0.001;
    await assert.rejects(
      pending,
      /lost its exact pending transaction before submission/
    );
    p2gProjection.dt = exactProjectionDt;
    assertGridReady();
    let failedBuffers = fixture.device.createdBuffers.slice(createdBefore);
    assert.equal(failedBuffers.length, 0);
    assertGridReady();

    const originalWriteBuffer = fixture.device.queue.writeBuffer;
    const gridUpdateWorkspace = terminal.successorMicroepoch.parentFieldView
      .coarseFieldView.ownerRuntime.gridUpdateWorkspaceForExecution(
        terminal.successorMicroepoch.parentFieldView.coarseFieldView
      );
    fixture.device.queue.writeBuffer = (buffer, ...args) => {
      if (buffer === gridUpdateWorkspace.paramsBuffer) {
        throw new Error('injected terminal grid params write failure');
      }
      return originalWriteBuffer(buffer, ...args);
    };
    await assert.rejects(
      runTerminalFixtureGridUpdate(terminal, p2gProjection),
      /injected terminal grid params write failure/
    );
    fixture.device.queue.writeBuffer = originalWriteBuffer;
    assert.equal(gridUpdateWorkspace.paramsBuffer.destroyed, false);
    assert.equal(gridUpdateWorkspace.indirectBuffer.destroyed, false);
    assertGridReady();

    const originalSubmit = fixture.device.queue.submit;
    createdBefore = fixture.device.createdBuffers.length;
    fixture.device.queue.submit = () => {
      throw new Error('injected terminal grid queue.submit failure');
    };
    await assert.rejects(
      runTerminalFixtureGridUpdate(terminal, p2gProjection),
      /injected terminal grid queue\.submit failure/
    );
    fixture.device.queue.submit = originalSubmit;
    failedBuffers = fixture.device.createdBuffers.slice(createdBefore);
    assert.equal(failedBuffers.length, 0);
    assertGridReady();
    assert.equal(
      terminal.successorMicroepoch.parentFieldView.coarseFieldView
        .fieldViewBuffer.destroyed,
      false
    );

    await runTerminalFixtureGridUpdate(terminal, p2gProjection);
    await releaseTerminalP2gFixture(
      terminal,
      'terminal grid retry fixture cleanup'
    );
  });

  await t.test('post-submit drift quarantines both fields through fence failures', async () => {
    for (const fenceMode of ['throw', 'reject']) {
      const terminal = await fusedCoarseTerminalP2gFixture();
      const p2gProjection = await runTerminalFixtureP2g(terminal);
      const { fixture, terminalTransaction, successorMicroepoch } = terminal;
      const fineField = successorMicroepoch.fineFieldView;
      const coarseField = successorMicroepoch.parentFieldView.coarseFieldView;
      const fineRuntime = fineField.ownerRuntime;
      const coarseRuntime = coarseField.ownerRuntime;
      const originalCreateBuffer = fixture.device.createBuffer;
      const originalSubmit = fixture.device.queue.submit;
      const originalFence = fixture.device.queue.onSubmittedWorkDone;
      const created = [];
      let destroyCalls = 0;
      fixture.device.createBuffer = (descriptor) => {
        const buffer = originalCreateBuffer(descriptor);
        created.push(buffer);
        if (created.length === 1) {
          const originalDestroy = buffer.destroy.bind(buffer);
          buffer.destroy = () => {
            destroyCalls += 1;
            if (destroyCalls === 1) {
              throw new Error('injected terminal grid cleanup destroy failure');
            }
            originalDestroy();
          };
        }
        return buffer;
      };
      const exactProjectionDt = p2gProjection.dt;
      fixture.device.queue.submit = (commandBuffers) => {
        originalSubmit(commandBuffers);
        p2gProjection.dt += 0.001;
      };
      fixture.device.queue.onSubmittedWorkDone = fenceMode === 'throw'
        ? () => {
            throw new Error('injected terminal grid cleanup fence throw');
          }
        : () => Promise.reject(
            new Error('injected terminal grid cleanup fence rejection')
          );
      await assert.rejects(
        runTerminalFixtureGridUpdate(terminal, p2gProjection),
        /does not match its exact fused producer inputs|stage is stale, foreign, or out of order/
      );
      fixture.device.createBuffer = originalCreateBuffer;
      fixture.device.queue.submit = originalSubmit;
      fixture.device.queue.onSubmittedWorkDone = originalFence;
      p2gProjection.dt = exactProjectionDt;
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(created.length, 0);
      assert.equal(destroyCalls, 0);
      const state = schroederFusedCoarseTerminalTransactionState(
        fixture.device,
        terminalTransaction
      );
      assert.equal(state.status, 'quarantined');
      assert.equal(state.stageIndex, 1);
      assert.equal(state.submissionObservedStage, 'grid-update');
      assert.equal(fineRuntime.isStateArtifactQuarantined(fineField), true);
      assert.equal(coarseRuntime.isStateArtifactQuarantined(coarseField), true);
      assert.equal(coarseField.fieldViewBuffer.destroyed, false);
      await releaseTerminalP2gFixture(
        terminal,
        `terminal grid post-submit ${fenceMode} fixture cleanup`
      );
      assert.equal(fineRuntime.ownsExecution(fineField), false);
      assert.equal(coarseRuntime.ownsExecution(coarseField), false);
      assert.equal(fineField.fieldViewBuffer.destroyed, true);
      assert.equal(coarseField.fieldViewBuffer.destroyed, true);
    }
  });
});

test('fused coarse-terminal workspace owns exact reflux submission', async (t) => {
  const strictOptions = (terminal, gridUpdate) => ({
    terminalTransaction: terminal.terminalTransaction,
    macroAuthority: terminal.fixture.macroAuthority,
    microepochAuthority: terminal.successorMicroepoch,
    particleContinuation: terminal.continuation,
    fieldExecution:
      terminal.successorMicroepoch.parentFieldView.coarseFieldView,
    mutationSegment: terminal.terminalTransaction.coarseTerminalMutation,
    priorArtifact: gridUpdate,
    requireDeferred: true,
    proposalMode: 'proposal-deferred-to-post-mechanics'
  });

  await t.test('exact submit advances 2→3 and mints only a local artifact', async () => {
    const { terminal, gridUpdate } = await terminalWorkspaceInputFixture();
    const coarseField =
      terminal.successorMicroepoch.parentFieldView.coarseFieldView;
    const fieldBuffer = coarseField.fieldViewBuffer;
    const runtimeBufferStart = terminal.fixture.device.createdBuffers.length;
    const runtime = terminalWorkspaceRuntime(terminal);
    const retainedBufferCount = terminal.fixture.device.createdBuffers.length;
    const chain = encodeTerminalWorkspace(terminal, gridUpdate, runtime);
    assert.equal(
      terminal.fixture.device.createdBuffers.length,
      retainedBufferCount
    );
    assert.equal(chain.artifact.previousGridUpdate, gridUpdate);
    assert.equal(chain.artifact.sourceProjection, gridUpdate.sourceProjection);
    assert.equal(
      chain.artifact.fusedCoarseTerminalTransaction,
      terminal.terminalTransaction
    );
    assert.equal(chain.artifact.terminalMicroepochAuthority, terminal.successorMicroepoch);
    assert.equal(chain.artifact.sourceParticleContinuation, terminal.continuation);
    assert.equal(chain.artifact.mechanicsFieldMutationInputOrdinal, 2);
    assert.equal(chain.artifact.mechanicsFieldMutationOutputOrdinal, 3);
    assert.equal(validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu(
      terminal.fixture.device,
      chain.artifact,
      strictOptions(terminal, gridUpdate)
    ), false);
    terminal.fixture.device.queue.submit([chain.encoder.finish()]);
    chain.runtime.markTerminalSubmissionObserved(chain.execution);
    chain.runtime.markTerminalSubmitted(chain.execution);
    const state = schroederFusedCoarseTerminalTransactionState(
      terminal.fixture.device,
      terminal.terminalTransaction
    );
    assert.equal(state.status, 'coarse-terminal-submitted');
    assert.equal(state.stageIndex, 3);
    assert.equal(state.submissionObservedStage, null);
    assert.equal(state.nextStage, 'g2p');
    assert.equal(chain.artifact.status, 'submitted-unverified');
    assert.equal(chain.artifact.fieldStateUpdateSubmittedInPlace, true);
    assert.equal(chain.artifact.mechanicsFieldEnergyReceipt.deferSeal, false);
    assert.equal(chain.artifact.mechanicsFieldEnergyReceipt.fieldMutationOrdinal, 3);
    assert.equal(validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu(
      terminal.fixture.device,
      chain.artifact,
      strictOptions(terminal, gridUpdate)
    ), true);
    assert.equal(validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu(
      terminal.fixture.device,
      { ...chain.artifact },
      strictOptions(terminal, gridUpdate)
    ), false);
    const exactDt = chain.artifact.dt;
    chain.artifact.dt += 0.001;
    assert.equal(validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu(
      terminal.fixture.device,
      chain.artifact,
      strictOptions(terminal, gridUpdate)
    ), false);
    chain.artifact.dt = exactDt;
    await assert.rejects(
      chain.runtime.releaseExecutionAfter(
        chain.execution,
        Promise.reject(new Error('injected terminal workspace fence rejection'))
      ),
      /injected terminal workspace fence rejection/
    );
    assert.equal(chain.runtime.activeExecutionCount(), 1);
    assert.throws(
      () => chain.runtime.destroy(),
      /active executions/
    );
    assert.equal(
      await chain.runtime.releaseExecutionAfter(
        chain.execution,
        terminal.fixture.device.queue.onSubmittedWorkDone()
      ),
      true
    );
    assert.equal(validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu(
      terminal.fixture.device,
      chain.artifact,
      strictOptions(terminal, gridUpdate)
    ), false);
    assert.equal(chain.runtime.destroy(), true);
    assert.equal(
      terminal.fixture.device.createdBuffers
        .slice(runtimeBufferStart)
        .every((buffer) => buffer.destroyed),
      true
    );
    assert.equal(fieldBuffer.destroyed, false);
    await releaseTerminalP2gFixture(
      terminal,
      'terminal workspace exact producer fixture cleanup'
    );
    assert.equal(fieldBuffer.destroyed, true);
  });

  await t.test('claim precedes encoder effects and discarded work is retryable', async () => {
    const { terminal, gridUpdate } = await terminalWorkspaceInputFixture();
    const runtime = terminalWorkspaceRuntime(terminal, { arenaCount: 2 });
    const downgradedEncoder = terminal.fixture.device.createCommandEncoder();
    const downgradedWrites = terminal.fixture.device.writes.length;
    assert.throws(
      () => runtime.encodeCoarseTerminal(downgradedEncoder, {
        parentFieldView: terminal.successorMicroepoch.parentFieldView,
        coarseGridUpdate: gridUpdate,
        refluxLedger: terminal.fixture.refluxLedger,
        fineSubstepCount: terminal.fixture.macroAuthority.fineSubstepCount,
        fineDt: terminal.fixture.macroAuthority.fineDt,
        fusedCoarseTerminalTransaction: null
      }),
      /exact submitted topology/
    );
    assert.equal(terminal.fixture.device.writes.length, downgradedWrites);
    const first = encodeTerminalWorkspace(terminal, gridUpdate, runtime);
    assert.throws(
      () => markSchroederFusedCoarseTerminalStageSubmissionObserved(
        terminal.fixture.device,
        terminal.terminalTransaction,
        { stage: 'coarse-terminal' }
      ),
      /stale, foreign, or out of order/
    );
    assert.throws(
      () => markSchroederFusedCoarseTerminalStageSubmitted(
        terminal.fixture.device,
        terminal.terminalTransaction,
        {
          stage: 'coarse-terminal',
          artifact: first.artifact,
          priorArtifact: gridUpdate
        }
      ),
      /stale, foreign, or out of order/
    );
    assert.equal(schroederFusedCoarseTerminalTransactionState(
      terminal.fixture.device,
      terminal.terminalTransaction
    ).stageIndex, 2);
    const secondEncoder = terminal.fixture.device.createCommandEncoder();
    const secondClearsBefore = terminal.fixture.device.clears.length;
    const secondDispatchesBefore = terminal.fixture.device.dispatches.length;
    const secondWritesBefore = terminal.fixture.device.writes.length;
    assert.throws(
      () => encodeTerminalWorkspace(terminal, gridUpdate, runtime, {
        encoder: secondEncoder
      }),
      /already has a producer or is not ready/
    );
    assert.equal(terminal.fixture.device.clears.length, secondClearsBefore);
    assert.equal(
      terminal.fixture.device.dispatches.length,
      secondDispatchesBefore
    );
    assert.equal(terminal.fixture.device.writes.length, secondWritesBefore);
    assert.equal(runtime.activeExecutionCount(), 1);
    assert.equal(runtime.releaseExecution(
      first.execution,
      { discardedEncoder: true }
    ), true);
    assert.equal(runtime.activeExecutionCount(), 0);

    for (const [overrides, pattern] of [
      [{ coarseGridUpdate: { ...gridUpdate } }, /already has a producer or is not ready/],
      [{ refluxLedger: { ...terminal.fixture.refluxLedger } }, /exact submitted topology/],
      [{ fineDt: terminal.fixture.macroAuthority.fineDt + 0.001 }, /exact E_r\/C_r/],
      [{ parentFieldView: terminal.fixture.generation.parentFieldView }, /exact submitted topology/]
    ]) {
      const encoder = terminal.fixture.device.createCommandEncoder();
      const writesBefore = terminal.fixture.device.writes.length;
      const clearsBefore = terminal.fixture.device.clears.length;
      const dispatchesBefore = terminal.fixture.device.dispatches.length;
      assert.throws(
        () => encodeTerminalWorkspace(terminal, gridUpdate, runtime, {
          encoder,
          ...overrides
        }),
        pattern
      );
      assert.equal(terminal.fixture.device.writes.length, writesBefore);
      assert.equal(terminal.fixture.device.clears.length, clearsBefore);
      assert.equal(terminal.fixture.device.dispatches.length, dispatchesBefore);
      assert.equal(runtime.activeExecutionCount(), 0);
      const state = schroederFusedCoarseTerminalTransactionState(
        terminal.fixture.device,
        terminal.terminalTransaction
      );
      assert.equal(state.status, 'grid-update-submitted');
      assert.equal(state.stageIndex, 2);
    }

    const retry = encodeTerminalWorkspace(terminal, gridUpdate, runtime);
    assert.equal(runtime.activeExecutionCount(), 1);
    assert.equal(runtime.releaseExecution(
      retry.execution,
      { discardedEncoder: true }
    ), true);
    assert.equal(runtime.destroy(), true);
    await releaseTerminalP2gFixture(
      terminal,
      'terminal workspace claim fixture cleanup'
    );
  });

  await t.test('partial encoder and callback TOCTOU require exact discard proof', async () => {
    for (const failureMode of ['hostile-encoder', 'callback-toctou']) {
      const { terminal, gridUpdate } = await terminalWorkspaceInputFixture();
      const runtime = terminalWorkspaceRuntime(terminal);
      const encoder = terminal.fixture.device.createCommandEncoder();
      const originalBeginComputePass = encoder.beginComputePass;
      let passOrdinal = 0;
      if (failureMode === 'hostile-encoder') {
        encoder.beginComputePass = (...args) => {
          const pass = originalBeginComputePass(...args);
          const injectAfterFirstCommand = (dispatch) => (...dispatchArgs) => {
            passOrdinal += 1;
            if (passOrdinal === 2) {
              const hostile = new Error(
                'injected terminal workspace mid-encoder failure'
              );
              Object.defineProperty(hostile, 'code', {
                value: 'HOSTILE_NON_WRITABLE_CODE',
                configurable: false,
                writable: false
              });
              throw hostile;
            }
            return dispatch(...dispatchArgs);
          };
          pass.dispatchWorkgroups = injectAfterFirstCommand(
            pass.dispatchWorkgroups.bind(pass)
          );
          pass.dispatchWorkgroupsIndirect = injectAfterFirstCommand(
            pass.dispatchWorkgroupsIndirect.bind(pass)
          );
          return pass;
        };
      } else {
        encoder.beginComputePass = (...args) => {
          const pass = originalBeginComputePass(...args);
          const originalDispatch = pass.dispatchWorkgroups;
          pass.dispatchWorkgroups = (...dispatchArgs) => {
            originalDispatch(...dispatchArgs);
            if (passOrdinal === 0) gridUpdate.dt += 0.001;
            passOrdinal += 1;
          };
          return pass;
        };
      }
      let failure = null;
      assert.throws(
        () => encodeTerminalWorkspace(terminal, gridUpdate, runtime, { encoder }),
        (error) => {
          failure = error;
          return error?.code
            === 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_FAILED_ENCODING_PENDING_DISCARD'
            && error?.failedEncoding?.schema
              === 'peercompute.ulg.schroeder-parent-field-failed-terminal-encoding.v1';
        }
      );
      assert.ok(terminal.fixture.device.clears.length > 0);
      assert.ok(terminal.fixture.device.dispatches.length > 0);
      assert.equal(runtime.activeExecutionCount(), 1);
      assert.throws(
        () => encodeTerminalWorkspace(terminal, gridUpdate, runtime),
        /already has a producer or is not ready/
      );
      assert.throws(
        () => runtime.destroy(),
        /active executions/
      );
      assert.throws(
        () => runtime.discardFailedTerminalEncoding(
          { ...failure.failedEncoding },
          { discardedEncoder: true }
        ),
        /stale or foreign/
      );
      assert.throws(
        () => runtime.discardFailedTerminalEncoding(failure.failedEncoding),
        /requires \{ discardedEncoder: true \}/
      );
      if (failureMode === 'callback-toctou') gridUpdate.dt -= 0.001;
      assert.equal(runtime.discardFailedTerminalEncoding(
        failure.failedEncoding,
        { discardedEncoder: true }
      ), true);
      assert.equal(runtime.activeExecutionCount(), 0);
      const state = schroederFusedCoarseTerminalTransactionState(
        terminal.fixture.device,
        terminal.terminalTransaction
      );
      assert.equal(state.status, 'grid-update-submitted');
      assert.equal(state.stageIndex, 2);
      const retry = encodeTerminalWorkspace(terminal, gridUpdate, runtime);
      assert.equal(runtime.releaseExecution(
        retry.execution,
        { discardedEncoder: true }
      ), true);
      assert.equal(runtime.destroy(), true);
      await releaseTerminalP2gFixture(
        terminal,
        `terminal workspace ${failureMode} failed-encoding cleanup`
      );
    }
  });

  await t.test('write and submit failures release the capability for exact retry', async () => {
    const { terminal, gridUpdate } = await terminalWorkspaceInputFixture();
    const runtime = terminalWorkspaceRuntime(terminal);
    const originalWrite = terminal.fixture.device.queue.writeBuffer;
    terminal.fixture.device.queue.writeBuffer = () => {
      throw new Error('injected terminal workspace params write failure');
    };
    assert.throws(
      () => encodeTerminalWorkspace(terminal, gridUpdate, runtime),
      /injected terminal workspace params write failure/
    );
    terminal.fixture.device.queue.writeBuffer = originalWrite;
    assert.equal(runtime.activeExecutionCount(), 0);
    let state = schroederFusedCoarseTerminalTransactionState(
      terminal.fixture.device,
      terminal.terminalTransaction
    );
    assert.equal(state.status, 'grid-update-submitted');
    assert.equal(state.stageIndex, 2);

    const failedSubmit = encodeTerminalWorkspace(terminal, gridUpdate, runtime);
    const originalSubmit = terminal.fixture.device.queue.submit;
    terminal.fixture.device.queue.submit = () => {
      throw new Error('injected terminal workspace queue.submit failure');
    };
    assert.throws(
      () => terminal.fixture.device.queue.submit([failedSubmit.encoder.finish()]),
      /injected terminal workspace queue\.submit failure/
    );
    terminal.fixture.device.queue.submit = originalSubmit;
    assert.equal(runtime.releaseExecution(
      failedSubmit.execution,
      { discardedEncoder: true }
    ), true);
    state = schroederFusedCoarseTerminalTransactionState(
      terminal.fixture.device,
      terminal.terminalTransaction
    );
    assert.equal(state.status, 'grid-update-submitted');
    assert.equal(state.stageIndex, 2);

    const retry = encodeTerminalWorkspace(terminal, gridUpdate, runtime);
    assert.equal(runtime.releaseExecution(
      retry.execution,
      { discardedEncoder: true }
    ), true);
    assert.equal(runtime.destroy(), true);
    await releaseTerminalP2gFixture(
      terminal,
      'terminal workspace failure retry fixture cleanup'
    );
  });

  await t.test('arena allocation and destroy retry clean every owned buffer', () => {
    const device = fakeP2gDevice();
    const originalCreateBuffer = device.createBuffer;
    const partialBuffers = [];
    let createCalls = 0;
    let partialDestroyCalls = 0;
    device.createBuffer = (descriptor) => {
      createCalls += 1;
      if (createCalls === 3) {
        throw new Error('injected workspace partial arena allocation failure');
      }
      const buffer = originalCreateBuffer(descriptor);
      partialBuffers.push(buffer);
      if (partialBuffers.length === 1) {
        const originalDestroy = buffer.destroy.bind(buffer);
        buffer.destroy = () => {
          partialDestroyCalls += 1;
          if (partialDestroyCalls === 1) {
            throw new Error('injected workspace partial cleanup failure');
          }
          originalDestroy();
        };
      }
      return buffer;
    };
    assert.throws(
      () => createSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
        parentFieldCapacity: 1,
        fineFieldCapacity: 1,
        arenaCount: 1
      }),
      /injected workspace partial arena allocation failure/
    );
    device.createBuffer = originalCreateBuffer;
    assert.equal(partialBuffers.length, 2);
    assert.equal(partialDestroyCalls, 2);
    assert.equal(partialBuffers.every((buffer) => buffer.destroyed), true);

    const runtimeBufferStart = device.createdBuffers.length;
    const runtime = createSchroederSpatialParentFieldMechanicsWorkspaceGpu(
      device,
      {
        parentFieldCapacity: 1,
        fineFieldCapacity: 1,
        arenaCount: 1
      }
    );
    const runtimeBuffers = device.createdBuffers.slice(runtimeBufferStart);
    let runtimeDestroyCalls = 0;
    const originalDestroy = runtimeBuffers[0].destroy.bind(runtimeBuffers[0]);
    runtimeBuffers[0].destroy = () => {
      runtimeDestroyCalls += 1;
      if (runtimeDestroyCalls === 1) {
        throw new Error('injected workspace destroy retry failure');
      }
      originalDestroy();
    };
    assert.equal(runtime.destroy(), true);
    assert.equal(runtimeDestroyCalls, 2);
    assert.equal(runtimeBuffers.every((buffer) => buffer.destroyed), true);
  });

  await t.test('post-submit public and prior drift quarantine both fields', async () => {
    for (const tamper of ['public-mirror', 'prior-grid']) {
      const { terminal, gridUpdate } = await terminalWorkspaceInputFixture();
      const fineField = terminal.successorMicroepoch.fineFieldView;
      const coarseField =
        terminal.successorMicroepoch.parentFieldView.coarseFieldView;
      const fineRuntime = fineField.ownerRuntime;
      const coarseRuntime = coarseField.ownerRuntime;
      const chain = encodeTerminalWorkspace(terminal, gridUpdate);
      terminal.fixture.device.queue.submit([chain.encoder.finish()]);
      if (tamper === 'public-mirror') {
        chain.execution.predictorDt += 0.001;
        assert.throws(
          () => chain.runtime.markTerminalSubmissionObserved(chain.execution),
          /public mirrors changed/
        );
      } else {
        gridUpdate.dt += 0.001;
        chain.runtime.markTerminalSubmissionObserved(chain.execution);
        assert.throws(
          () => chain.runtime.markTerminalSubmitted(chain.execution),
          /does not match its exact fused producer inputs|exact locally submitted P2G artifact|stale, foreign, or out of order/
        );
      }
      const state = schroederFusedCoarseTerminalTransactionState(
        terminal.fixture.device,
        terminal.terminalTransaction
      );
      assert.equal(state.status, 'quarantined');
      assert.equal(state.stageIndex, 2);
      assert.equal(state.submissionObservedStage, 'coarse-terminal');
      assert.equal(fineRuntime.isStateArtifactQuarantined(fineField), true);
      assert.equal(coarseRuntime.isStateArtifactQuarantined(coarseField), true);
      assert.equal(validateLocallySubmittedSchroederSpatialParentFieldCoarseTerminalGpu(
        terminal.fixture.device,
        chain.artifact,
        strictOptions(terminal, gridUpdate)
      ), false);
      assert.equal(
        await chain.runtime.releaseExecutionAfter(
          chain.execution,
          terminal.fixture.device.queue.onSubmittedWorkDone()
        ),
        true
      );
      assert.equal(chain.runtime.destroy(), true);
      assert.equal(coarseField.fieldViewBuffer.destroyed, false);
      await releaseTerminalP2gFixture(
        terminal,
        `terminal workspace ${tamper} quarantine fixture cleanup`
      );
      assert.equal(fineRuntime.ownsExecution(fineField), false);
      assert.equal(coarseRuntime.ownsExecution(coarseField), false);
      assert.equal(fineField.fieldViewBuffer.destroyed, true);
      assert.equal(coarseField.fieldViewBuffer.destroyed, true);
    }
  });
});

test('fused WebGPU grid update consumes exact P2G once and isolates stale attempts', async (t) => {
  const strictOptions = (fixture, p2gProjection) => ({
    transaction: fixture.transaction,
    macroAuthority: fixture.macroAuthority,
    microepochAuthority: fixture.microepochAuthority,
    particleContinuation: fixture.particleContinuation,
    fieldExecution: fixture.microepochAuthority.fineFieldView,
    mutationSegment: fixture.transaction.gridUpdateMutation,
    priorArtifact: p2gProjection,
    requireDeferred: true,
    proposalMode: 'proposal-deferred-to-post-mechanics'
  });

  await t.test('success advances exactly once and rejects clones', async () => {
    const fixture = fusedP2gProducerFixture();
    let hostQueueFenceCount = 0;
    const originalOnSubmittedWorkDone =
      fixture.device.queue.onSubmittedWorkDone;
    fixture.device.queue.onSubmittedWorkDone = (...args) => {
      hostQueueFenceCount += 1;
      return originalOnSubmittedWorkDone.apply(fixture.device.queue, args);
    };
    const p2gProjection = await runFusedP2gProducer(fixture);
    const update = await runFusedGridUpdateProducer(fixture, p2gProjection);
    assert.equal(hostQueueFenceCount, 0);
    assert.equal(update.queueOrderedCleanupReceipt, undefined);
    assert.equal(update.mechanicsFieldGridUpdateWorkspaceBorrowed, true);
    assert.equal(update.mechanicsFieldGridUpdateHotPathAllocationCount, 0);
    assert.equal(fixture.device.submissions.length, 3);
    assert.equal(update.mechanicsFieldEnergyReceipt.deferSeal, true);
    assert.equal(update.proposalMode, 'proposal-deferred-to-post-mechanics');
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate(
      fixture.device,
      update,
      strictOptions(fixture, p2gProjection)
    ), true);
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate(
      fixture.device,
      { ...update },
      strictOptions(fixture, p2gProjection)
    ), false);
    const state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'grid-update-submitted');
    assert.equal(state.stageIndex, 2);
    assert.equal(state.submissionObservedStage, null);
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('success fixture ends after grid update')
      }
    );
  });

  await t.test('nondeferred receipt fails before submission and stays grid-ready', async () => {
    const fixture = fusedP2gProducerFixture();
    const p2gProjection = await runFusedP2gProducer(fixture);
    await assert.rejects(
      runFusedGridUpdateProducer(fixture, p2gProjection, {
        mechanicsFieldEnergyReceipt: { deferSeal: false }
      }),
      /requires deferred heat sealing/
    );
    assert.equal(fixture.device.submissions.length, 2);
    const state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'p2g-submitted');
    assert.equal(state.stageIndex, 1);
    assert.equal(state.submissionObservedStage, null);
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('nondeferred grid fixture cleanup')
      }
    );
  });

  await t.test('r=2 rejects macro-dt grid update before submission and retries fineDt', async () => {
    const fixture = fusedP2gProducerFixture({ fineSubstepCount: 2 });
    const p2gProjection = await runFusedP2gProducer(fixture);
    await assert.rejects(
      runFusedGridUpdateProducer(fixture, p2gProjection, {
        dt: fixture.macroDt
      }),
      /exact locally submitted P2G artifact/
    );
    let state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'p2g-submitted');
    assert.equal(state.stageIndex, 1);
    assert.equal(state.submissionObservedStage, null);
    assert.equal(fixture.device.submissions.length, 2);
    await runFusedGridUpdateProducer(fixture, p2gProjection);
    state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'grid-update-submitted');
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('wrong grid dt fixture cleanup')
      }
    );
    fixture.refluxLedger.destroy();
  });

  await t.test('post-submit source mutation quarantines before publication', async () => {
    const fixture = fusedP2gProducerFixture();
    const p2gProjection = await runFusedP2gProducer(fixture);
    const originalSubmit = fixture.device.queue.submit;
    fixture.device.queue.submit = (commandBuffers) => {
      originalSubmit(commandBuffers);
      p2gProjection.dt += 0.001;
    };
    await assert.rejects(
      runFusedGridUpdateProducer(fixture, p2gProjection),
      /exact P2G projection|exact fused producer inputs|stale, foreign, or out of order/
    );
    fixture.device.queue.submit = originalSubmit;
    assert.equal(fixture.device.submissions.length, 3);
    const state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'quarantined');
    assert.equal(state.stageIndex, 1);
    assert.equal(state.submissionObservedStage, 'grid-update');
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      p2gProjection,
      {
        transaction: fixture.transaction,
        macroAuthority: fixture.macroAuthority,
        microepochAuthority: fixture.microepochAuthority,
        particleContinuation: fixture.particleContinuation,
        fieldExecution: fixture.microepochAuthority.fineFieldView,
        mutationSegment: fixture.transaction.p2gMutation,
        priorArtifact: null,
        requireDeferred: true,
        proposalMode: 'proposal-deferred-to-post-mechanics'
      }
    ), false);
    const fineField = fixture.microepochAuthority.fineFieldView;
    assert.equal(fineField.ownerRuntime.isStateArtifactQuarantined(fineField), true);
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('post-submit grid mark failure')
      }
    );
    assert.equal(fineField.ownerRuntime.ownsExecution(fineField), false);
    assert.equal(fineField.fieldViewBuffer.destroyed, true);
  });

  await t.test('synchronous submit failure stays grid-ready for an exact retry', async () => {
    const fixture = fusedP2gProducerFixture();
    const p2gProjection = await runFusedP2gProducer(fixture);
    const originalSubmit = fixture.device.queue.submit;
    fixture.device.queue.submit = () => {
      throw new Error('injected grid queue.submit failure');
    };
    await assert.rejects(
      runFusedGridUpdateProducer(fixture, p2gProjection),
      /injected grid queue\.submit failure/
    );
    fixture.device.queue.submit = originalSubmit;
    let state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'p2g-submitted');
    assert.equal(state.stageIndex, 1);
    assert.equal(state.submissionObservedStage, null);
    assert.equal(fixture.device.submissions.length, 2);
    const update = await runFusedGridUpdateProducer(fixture, p2gProjection);
    state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'grid-update-submitted');
    assert.equal(state.stageIndex, 2);
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate(
      fixture.device,
      update,
      strictOptions(fixture, p2gProjection)
    ), true);
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('grid retry fixture cleanup')
      }
    );
  });

  await t.test('concurrent same-artifact calls submit once without poisoning the winner', async () => {
    const fixture = fusedP2gProducerFixture();
    const p2gProjection = await runFusedP2gProducer(fixture);
    const attempts = await Promise.allSettled([
      runFusedGridUpdateProducer(fixture, p2gProjection),
      runFusedGridUpdateProducer(fixture, p2gProjection)
    ]);
    assert.equal(attempts.filter(({ status }) => status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(({ status }) => status === 'rejected').length, 1);
    assert.equal(fixture.device.submissions.length, 3);
    const winner = attempts.find(({ status }) => status === 'fulfilled').value;
    const state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'grid-update-submitted');
    assert.equal(state.stageIndex, 2);
    assert.equal(state.submissionObservedStage, null);
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate(
      fixture.device,
      winner,
      strictOptions(fixture, p2gProjection)
    ), true);
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('concurrent grid fixture cleanup')
      }
    );
  });
});

test('fused WebGPU fine correction owns exact reflux provenance and observation', async (t) => {
  const strictOptions = (fixture, chain) => ({
    transaction: fixture.transaction,
    macroAuthority: fixture.macroAuthority,
    microepochAuthority: fixture.microepochAuthority,
    particleContinuation: fixture.particleContinuation,
    fieldExecution: fixture.microepochAuthority.fineFieldView,
    mutationSegment: fixture.transaction.fineCorrectionMutation,
    priorArtifact: chain.gridUpdate,
    requireDeferred: true,
    proposalMode: 'proposal-deferred-to-post-mechanics'
  });

  await t.test('submission mints ordinal-3 receipt, advances once, and rejects clones', async () => {
    const fixture = fusedP2gProducerFixture();
    const chain = await fusedFineCorrectionWorkspace(fixture);
    const encoder = fixture.device.createCommandEncoder();
    const correction = chain.runtime.encodeFineCorrection(
      encoder,
      chain.execution,
      {
        fineGridUpdate: chain.gridUpdate,
        deltaScale: 1,
        maxCorrectionMPerS: 0,
        fusedFineSubstepTransaction: fixture.transaction
      }
    );
    assert.equal(correction.mechanicsFieldEnergyReceipt, null);
    assert.equal(validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
      fixture.device,
      correction,
      strictOptions(fixture, chain)
    ), false);
    fixture.device.queue.submit([encoder.finish()]);
    chain.runtime.markTerminalSubmissionObserved(chain.execution);
    chain.runtime.markTerminalSubmitted(chain.execution);
    assert.equal(correction.mechanicsFieldMutationInputOrdinal, 2);
    assert.equal(correction.mechanicsFieldMutationOutputOrdinal, 3);
    assert.equal(correction.mechanicsFieldEnergyReceipt.fieldMutationOrdinal, 3);
    assert.equal(correction.mechanicsFieldEnergyReceipt.deferSeal, false);
    assert.equal(
      correction.mechanicsFieldEnergyReceipt.status,
      'energy-ready-submitted-unverified'
    );
    assert.equal(correction.mechanicsFieldEnergyReceipt.refluxLedger, fixture.refluxLedger);
    assert.equal(validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
      fixture.device,
      correction,
      strictOptions(fixture, chain)
    ), true);
    assert.equal(validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
      fixture.device,
      { ...correction },
      strictOptions(fixture, chain)
    ), false);
    const state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'fine-correction-submitted');
    assert.equal(state.stageIndex, 3);
    assert.equal(state.submissionObservedStage, null);
    assert.throws(
      () => chain.runtime.markTerminalSubmitted(chain.execution),
      /not awaiting submission/
    );
    assert.equal(
      await chain.runtime.releaseExecutionAfter(
        chain.execution,
        fixture.device.queue.onSubmittedWorkDone()
      ),
      true
    );
    assert.equal(validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
      fixture.device,
      correction,
      strictOptions(fixture, chain)
    ), false);
    assert.equal(chain.runtime.destroy(), true);
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('fine correction success fixture cleanup')
      }
    );
    assert.equal(
      fixture.refluxLedger.status,
      'schroeder-cross-level-reflux-ledger-gpu-destroyed'
    );
    assert.equal(fixture.refluxLedger.buffer.destroyed, true);
    assert.equal(fixture.refluxLedger.destroy(), false);
  });

  await t.test('r=2 and r=4 admit cumulative theta predictors instead of macro-dt predictors', async () => {
    for (const fineSubstepCount of [2, 4]) {
      const fixture = fusedP2gProducerFixture({ fineSubstepCount });
      const chain = await fusedFineCorrectionWorkspace(fixture);
      assert.equal(chain.fineProjection.dt, fixture.fineDt);
      assert.equal(chain.gridUpdate.dt, fixture.fineDt);
      assert.equal(chain.coarseProjection.dt, fixture.predictorThetaDt);
      assert.equal(chain.execution.predictorDt, fixture.predictorThetaDt);
      assert.notEqual(chain.coarseProjection.dt, fixture.macroDt);
      const encoder = fixture.device.createCommandEncoder();
      chain.runtime.encodeFineCorrection(encoder, chain.execution, {
        fineGridUpdate: chain.gridUpdate,
        fusedFineSubstepTransaction: fixture.transaction
      });
      fixture.device.queue.submit([encoder.finish()]);
      chain.runtime.markTerminalSubmissionObserved(chain.execution);
      chain.runtime.markTerminalSubmitted(chain.execution);
      const state = schroederFusedFineSubstepTransactionState(
        fixture.device,
        fixture.transaction
      );
      assert.equal(state.status, 'fine-correction-submitted');
      await chain.runtime.releaseExecutionAfter(
        chain.execution,
        fixture.device.queue.onSubmittedWorkDone()
      );
      chain.runtime.destroy();
      await abortSchroederTwoLevelMacroAuthorityAfter(
        fixture.device,
        fixture.macroAuthority,
        {
          microepochAuthority: fixture.microepochAuthority,
          reason: new Error(`r=${fineSubstepCount} theta fixture cleanup`)
        }
      );
      fixture.refluxLedger.destroy();
    }
  });

  await t.test('r=2 rejects a full-macro coarse predictor before workspace submission', async () => {
    const fixture = fusedP2gProducerFixture({ fineSubstepCount: 2 });
    const fineProjection = await runFusedP2gProducer(fixture);
    const wrongCoarseProjection = await runCoarseP2gProducer(
      fixture,
      fixture.macroDt
    );
    const runtime = createSchroederSpatialParentFieldMechanicsWorkspaceGpu(
      fixture.device,
      {
        parentFieldCapacity: fixture.generation.parentFieldView.parentFieldCapacity,
        fineFieldCapacity: fixture.generation.parentFieldView.fineFieldCapacity,
        arenaCount: 1
      }
    );
    assert.throws(
      () => runtime.encodePredictors(fixture.device.createCommandEncoder(), {
        parentFieldView: fixture.generation.parentFieldView,
        fineP2gProjection: fineProjection,
        coarseP2gProjection: wrongCoarseProjection,
        dt: fixture.predictorThetaDt,
        fineDt: fixture.fineDt,
        macroDt: fixture.macroDt,
        fineSubstepOrdinal: 0,
        fineSubstepCount: 2,
        gravityMPerS2: [0, -9.80665, 0],
        boxDimsM: [1, 1, 1],
        refluxLedger: fixture.refluxLedger,
        fusedFineSubstepTransaction: fixture.transaction
      }),
      /exact local macro reflux ledger and substep/
    );
    assert.equal(runtime.activeExecutionCount(), 0);
    runtime.destroy();
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('wrong theta fixture cleanup')
      }
    );
    fixture.refluxLedger.destroy();
  });

  await t.test('synchronous submit failure rolls back only the unsubmitted encoding and retries', async () => {
    const fixture = fusedP2gProducerFixture();
    const chain = await fusedFineCorrectionWorkspace(fixture);
    const firstEncoder = fixture.device.createCommandEncoder();
    const firstCorrection = chain.runtime.encodeFineCorrection(
      firstEncoder,
      chain.execution,
      {
        fineGridUpdate: chain.gridUpdate,
        fusedFineSubstepTransaction: fixture.transaction
      }
    );
    const originalSubmit = fixture.device.queue.submit;
    fixture.device.queue.submit = () => {
      throw new Error('injected fine-correction queue.submit failure');
    };
    assert.throws(
      () => fixture.device.queue.submit([firstEncoder.finish()]),
      /injected fine-correction queue\.submit failure/
    );
    fixture.device.queue.submit = originalSubmit;
    let state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'grid-update-submitted');
    assert.equal(state.stageIndex, 2);
    assert.equal(state.submissionObservedStage, null);
    assert.equal(chain.runtime.resetUnsubmittedFineCorrection(
      chain.execution,
      { discardedEncoder: true }
    ), true);
    assert.equal(
      firstCorrection.status,
      'parent-field-fine-correction-discarded-unsubmitted'
    );
    const retryEncoder = fixture.device.createCommandEncoder();
    const retryCorrection = chain.runtime.encodeFineCorrection(
      retryEncoder,
      chain.execution,
      {
        fineGridUpdate: chain.gridUpdate,
        fusedFineSubstepTransaction: fixture.transaction
      }
    );
    assert.notEqual(retryCorrection, firstCorrection);
    fixture.device.queue.submit([retryEncoder.finish()]);
    chain.runtime.markTerminalSubmissionObserved(chain.execution);
    chain.runtime.markTerminalSubmitted(chain.execution);
    state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'fine-correction-submitted');
    assert.equal(state.stageIndex, 3);
    assert.equal(validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
      fixture.device,
      retryCorrection,
      strictOptions(fixture, chain)
    ), true);
    await chain.runtime.releaseExecutionAfter(
      chain.execution,
      fixture.device.queue.onSubmittedWorkDone()
    );
    chain.runtime.destroy();
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('fine correction submit retry fixture cleanup')
      }
    );
    fixture.refluxLedger.destroy();
  });

  await t.test('two workspaces cannot claim one correction transaction', async () => {
    const fixture = fusedP2gProducerFixture();
    const fineProjection = await runFusedP2gProducer(fixture);
    const coarseProjection = await runCoarseP2gProducer(fixture);
    const runtime = createSchroederSpatialParentFieldMechanicsWorkspaceGpu(
      fixture.device,
      {
        parentFieldCapacity: fixture.generation.parentFieldView.parentFieldCapacity,
        fineFieldCapacity: fixture.generation.parentFieldView.fineFieldCapacity,
        arenaCount: 2
      }
    );
    const predictorExecutions = Array.from({ length: 2 }, () => {
      const encoder = fixture.device.createCommandEncoder();
      const execution = runtime.encodePredictors(encoder, {
        parentFieldView: fixture.generation.parentFieldView,
        fineP2gProjection: fineProjection,
        coarseP2gProjection: coarseProjection,
        dt: fixture.predictorThetaDt,
        fineDt: fixture.fineDt,
        macroDt: fixture.macroDt,
        fineSubstepOrdinal: 0,
        fineSubstepCount: 1,
        gravityMPerS2: [0, -9.80665, 0],
        boxDimsM: [1, 1, 1],
        refluxLedger: fixture.refluxLedger,
        fusedFineSubstepTransaction: fixture.transaction
      });
      fixture.device.queue.submit([encoder.finish()]);
      runtime.markPredictorsSubmitted(execution);
      return execution;
    });
    const gridUpdate = await runFusedGridUpdateProducer(fixture, fineProjection);
    const winnerEncoder = fixture.device.createCommandEncoder();
    const winner = runtime.encodeFineCorrection(
      winnerEncoder,
      predictorExecutions[0],
      {
        fineGridUpdate: gridUpdate,
        fusedFineSubstepTransaction: fixture.transaction
      }
    );
    assert.throws(
      () => runtime.encodeFineCorrection(
        fixture.device.createCommandEncoder(),
        predictorExecutions[1],
        {
          fineGridUpdate: gridUpdate,
          fusedFineSubstepTransaction: fixture.transaction
        }
      ),
      /exact deferred-receipt fine field update/
    );
    fixture.device.queue.submit([winnerEncoder.finish()]);
    runtime.markTerminalSubmissionObserved(predictorExecutions[0]);
    runtime.markTerminalSubmitted(predictorExecutions[0]);
    assert.equal(validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
      fixture.device,
      winner,
      {
        transaction: fixture.transaction,
        macroAuthority: fixture.macroAuthority,
        microepochAuthority: fixture.microepochAuthority,
        particleContinuation: fixture.particleContinuation,
        fieldExecution: fixture.microepochAuthority.fineFieldView,
        mutationSegment: fixture.transaction.fineCorrectionMutation,
        priorArtifact: gridUpdate,
        requireDeferred: true,
        proposalMode: 'proposal-deferred-to-post-mechanics'
      }
    ), true);
    const state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'fine-correction-submitted');
    assert.equal(state.stageIndex, 3);
    await Promise.all(predictorExecutions.map((execution) => (
      runtime.releaseExecutionAfter(
        execution,
        fixture.device.queue.onSubmittedWorkDone()
      )
    )));
    runtime.destroy();
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('fine correction claim concurrency cleanup')
      }
    );
    fixture.refluxLedger.destroy();
  });

  await t.test('post-submit public-kind tampering observes then quarantines', async () => {
    const fixture = fusedP2gProducerFixture();
    const chain = await fusedFineCorrectionWorkspace(fixture);
    const encoder = fixture.device.createCommandEncoder();
    chain.runtime.encodeFineCorrection(encoder, chain.execution, {
      fineGridUpdate: chain.gridUpdate,
      fusedFineSubstepTransaction: fixture.transaction
    });
    fixture.device.queue.submit([encoder.finish()]);
    chain.execution.terminalKind = 'forged-terminal-kind';
    assert.throws(
      () => chain.runtime.markTerminalSubmissionObserved(chain.execution),
      /public mirrors changed/
    );
    const state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'quarantined');
    assert.equal(state.submissionObservedStage, 'fine-correction');
    await chain.runtime.releaseExecutionAfter(
      chain.execution,
      fixture.device.queue.onSubmittedWorkDone()
    );
    chain.runtime.destroy();
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('fine correction public-kind tamper cleanup')
      }
    );
    fixture.refluxLedger.destroy();
  });

  await t.test('post-encode artifact mutation or freezing cannot authenticate GPU work', async () => {
    for (const tamper of ['dt', 'freeze']) {
      const fixture = fusedP2gProducerFixture();
      const chain = await fusedFineCorrectionWorkspace(fixture);
      const encoder = fixture.device.createCommandEncoder();
      const correction = chain.runtime.encodeFineCorrection(
        encoder,
        chain.execution,
        {
          fineGridUpdate: chain.gridUpdate,
          fusedFineSubstepTransaction: fixture.transaction
        }
      );
      if (tamper === 'dt') correction.dt += 0.001;
      else Object.freeze(correction);
      fixture.device.queue.submit([encoder.finish()]);
      if (tamper === 'dt') {
        assert.throws(
          () => chain.runtime.markTerminalSubmissionObserved(chain.execution),
          /public mirrors changed/
        );
      } else {
        chain.runtime.markTerminalSubmissionObserved(chain.execution);
        assert.throws(
          () => chain.runtime.markTerminalSubmitted(chain.execution),
          /read only|Cannot assign/
        );
      }
      const state = schroederFusedFineSubstepTransactionState(
        fixture.device,
        fixture.transaction
      );
      assert.equal(state.status, 'quarantined');
      assert.equal(validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
        fixture.device,
        correction,
        strictOptions(fixture, chain)
      ), false);
      await chain.runtime.releaseExecutionAfter(
        chain.execution,
        fixture.device.queue.onSubmittedWorkDone()
      );
      chain.runtime.destroy();
      await abortSchroederTwoLevelMacroAuthorityAfter(
        fixture.device,
        fixture.macroAuthority,
        {
          microepochAuthority: fixture.microepochAuthority,
          reason: new Error(`fine correction ${tamper} tamper cleanup`)
        }
      );
      fixture.refluxLedger.destroy();
    }
  });

  await t.test('post-submit workspace-lineage mutation deletes origin and quarantines', async () => {
    const fixture = fusedP2gProducerFixture();
    const chain = await fusedFineCorrectionWorkspace(fixture);
    const encoder = fixture.device.createCommandEncoder();
    const capturedCorrection = chain.runtime.encodeFineCorrection(
      encoder,
      chain.execution,
      {
        fineGridUpdate: chain.gridUpdate,
        fusedFineSubstepTransaction: fixture.transaction
      }
    );
    fixture.device.queue.submit([encoder.finish()]);
    chain.execution.predictorDt += 0.001;
    assert.throws(
      () => chain.runtime.markTerminalSubmissionObserved(chain.execution),
      /public mirrors changed/
    );
    const state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'quarantined');
    assert.equal(state.stageIndex, 2);
    assert.equal(state.submissionObservedStage, 'fine-correction');
    assert.equal(validateLocallySubmittedSchroederSpatialParentFieldFineCorrectionGpu(
      fixture.device,
      capturedCorrection,
      strictOptions(fixture, chain)
    ), false);
    assert.equal(
      await chain.runtime.releaseExecutionAfter(
        chain.execution,
        fixture.device.queue.onSubmittedWorkDone()
      ),
      true
    );
    assert.equal(chain.runtime.destroy(), true);
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: fixture.microepochAuthority,
        reason: new Error('fine correction rejection fixture cleanup')
      }
    );
    assert.equal(
      fixture.refluxLedger.status,
      'schroeder-cross-level-reflux-ledger-gpu-destroyed'
    );
    assert.equal(fixture.refluxLedger.buffer.destroyed, true);
    assert.equal(fixture.refluxLedger.destroy(), false);
  });
});

test('fused WebGPU G2P owns the exact correction and output continuation', async (t) => {
  const strictOptions = (fixture, chain) => ({
    transaction: fixture.transaction,
    macroAuthority: fixture.macroAuthority,
    microepochAuthority: fixture.microepochAuthority,
    particleContinuation: fixture.particleContinuation,
    fieldExecution: fixture.microepochAuthority.fineFieldView,
    priorArtifact: chain.correction,
    proposalMode: 'proposal-deferred-to-post-mechanics'
  });

  await t.test('success submits once, defers proposals, and transfers output ownership', async () => {
    const fixture = fusedP2gProducerFixture();
    const chain = await submittedFusedFineCorrection(fixture);
    fixture.sphParticleState.state = new Float32Array(16);
    fixture.mlsMpmParticleState.mechanics = new Float32Array(64);
    const submissionsBefore = fixture.device.submissions.length;
    const traceStart = fixture.device.passTrace.length;
    const g2p = await runFusedG2pProducer(fixture, chain.correction);
    assert.equal(fixture.device.submissions.length, submissionsBefore + 1);
    assert.deepEqual(
      fixture.device.passTrace
        .slice(traceStart)
        .map(({ entryPoint }) => entryPoint)
        .filter((entryPoint) => [
          'claim_g2p_energy_receipt',
          'measure_g2p_energy_receipt',
          'consume_g2p_energy_receipt',
          'consume_g2p_fine_reflux_receipt',
          'consume_g2p_coarse_reflux_receipt'
        ].includes(entryPoint)),
      [
        'claim_g2p_energy_receipt',
        'measure_g2p_energy_receipt',
        'consume_g2p_energy_receipt',
        'consume_g2p_fine_reflux_receipt'
      ]
    );
    assert.equal(g2p.proposalMode, 'proposal-deferred-to-post-mechanics');
    assert.equal(g2p.mechanicalProposalApplied, false);
    assert.equal(g2p.stateBufferByteLength, 8 * Float32Array.BYTES_PER_ELEMENT);
    assert.equal(
      g2p.mechanicsBufferByteLength,
      MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
        * Float32Array.BYTES_PER_ELEMENT
    );
    assert.equal(validateLocallySubmittedMlsMpmFusedG2p(
      fixture.device,
      g2p,
      strictOptions(fixture, chain)
    ), true);
    assert.equal(validateLocallySubmittedMlsMpmFusedG2p(
      fixture.device,
      g2p,
      {
        ...strictOptions(fixture, chain),
        transaction: undefined,
        terminalTransaction: fixture.transaction
      }
    ), false);
    assert.equal(validateLocallySubmittedMlsMpmFusedG2p(
      fixture.device,
      { ...g2p },
      strictOptions(fixture, chain)
    ), false);
    assert.equal(schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    ).stageIndex, 4);

    const uploads = nextParticleUploads(fixture, g2p);
    assert.throws(() => createSchroederCanonicalParticleContinuation({
      device: fixture.device,
      macroAuthority: fixture.macroAuthority,
      ...uploads,
      ordinal: 1,
      priorContinuation: fixture.particleContinuation,
      sourceTransaction: fixture.transaction,
      g2pReconstruction: { ...g2p }
    }), /exact initial family|claim the exact live G2P/);
    const continuation = createSchroederCanonicalParticleContinuation({
      device: fixture.device,
      macroAuthority: fixture.macroAuthority,
      ...uploads,
      ordinal: 1,
      priorContinuation: fixture.particleContinuation,
      sourceTransaction: fixture.transaction,
      g2pReconstruction: g2p
    });
    assert.equal(continuation.stateBuffer, g2p.stateBuffer);
    assert.equal(continuation.mechanicsBuffer, g2p.mechanicsBuffer);
    assert.equal(g2p.destroyOutputParticleBuffers(), false);
    assert.equal(g2p.stateBuffer.destroyed, false);
    assert.equal(g2p.mechanicsBuffer.destroyed, false);
    const {
      levelAssignment: successorLevelAssignment
    } = frozenSuccessorLevelAssignment(fixture, uploads);
    const successorGeneration = runSchroederSpatialEpochGenerationWebGpu({
      device: fixture.device,
      levelAssignment: successorLevelAssignment,
      particleCount: 1,
      particleIdentityBuffer: fixture.sphParticleUpload.identityBuffer,
      particleIdentityStrideWords: 1,
      mechanicsLevels: [
        { selectedLevel: 0, mechanicsGrid: fixture.fineGrid },
        { selectedLevel: 1, mechanicsGrid: fixture.coarseGrid }
      ]
    });
    assert.equal(
      successorGeneration.ready,
      true,
      successorGeneration.reason ?? successorGeneration.status
    );
    const successorCanonicalEpoch = {
      generation: successorGeneration,
      ...uploads
    };
    const successorMicroepoch = createSchroederFineMicroepochAuthority({
      device: fixture.device,
      macroAuthority: fixture.macroAuthority,
      canonicalEpoch: successorCanonicalEpoch,
      particleContinuation: continuation,
      priorMicroepochAuthority: fixture.microepochAuthority,
      substepOrdinal: 1
    });
    assert.equal(validateSchroederFineMicroepochAuthority(
      fixture.device,
      successorMicroepoch,
      {
        canonicalEpoch: successorCanonicalEpoch,
        particleContinuation: continuation,
        substepOrdinal: 1
      }
    ), true);
    assert.equal(await retireSchroederFineMicroepochAfter(
      fixture.device,
      fixture.microepochAuthority,
      { successorMicroepochAuthority: successorMicroepoch }
    ), true);
    assert.equal(validateSchroederFineMicroepochAuthority(
      fixture.device,
      fixture.microepochAuthority
    ), false);
    assert.equal(validateSchroederFineMicroepochAuthority(
      fixture.device,
      fixture.microepochAuthority,
      { requireLive: false }
    ), true);
    const terminalCoarseField =
      successorMicroepoch.parentFieldView.coarseFieldView;
    const terminalFineField = successorMicroepoch.fineFieldView;
    const terminalCoarseRuntime = terminalCoarseField.ownerRuntime;
    const terminalFineRuntime = terminalFineField.ownerRuntime;
    const originalReserveTerminalSequence =
      terminalCoarseRuntime.reserveStateMutationSequence;
    const injectedReservationFailure = new Error(
      'injected coarse-terminal sequence reservation failure'
    );
    terminalCoarseRuntime.reserveStateMutationSequence = () => {
      throw injectedReservationFailure;
    };
    assert.throws(
      () => createSchroederFusedCoarseTerminalTransaction({
        device: fixture.device,
        macroAuthority: fixture.macroAuthority,
        microepochAuthority: successorMicroepoch,
        particleContinuation: continuation
      }),
      (error) => error === injectedReservationFailure
    );
    terminalCoarseRuntime.reserveStateMutationSequence =
      originalReserveTerminalSequence;
    assert.equal(terminalCoarseRuntime.ownsExecution(terminalCoarseField), true);
    assert.equal(
      terminalCoarseRuntime.stateMutationState(terminalCoarseField)
        .publicationLocked,
      false
    );

    const terminalTransaction =
      createSchroederFusedCoarseTerminalTransaction({
        device: fixture.device,
        macroAuthority: fixture.macroAuthority,
        microepochAuthority: successorMicroepoch,
        particleContinuation: continuation
      });
    assert.equal(validateSchroederFusedCoarseTerminalTransaction(
      fixture.device,
      terminalTransaction,
      {
        stage: 'p2g',
        macroAuthority: fixture.macroAuthority,
        microepochAuthority: successorMicroepoch,
        particleContinuation: continuation
      }
    ), true);
    assert.deepEqual(terminalTransaction.mutationSequence.stages.map(
      (segment) => [segment.expectedOrdinal, segment.outputOrdinal]
    ), [[0, 1], [1, 2], [2, 3]]);
    assert.deepEqual(schroederFusedCoarseTerminalTransactionState(
      fixture.device,
      terminalTransaction
    ), {
      status: 'reserved',
      stageIndex: 0,
      submissionObservedStage: null,
      nextStage: 'p2g',
      submittedStageCount: 0,
      g2pSubmitted: false,
      outputClaimed: false,
      gpuReceiptStatus: 'not-submitted',
      quarantineReason: null
    });
    assert.equal(discardSchroederFusedCoarseTerminalTransaction(
      fixture.device,
      terminalTransaction,
      { discardedEncoder: true }
    ), true);
    assert.equal(validateSchroederFusedCoarseTerminalTransaction(
      fixture.device,
      terminalTransaction
    ), false);
    assert.equal(schroederFusedCoarseTerminalTransactionState(
      fixture.device,
      terminalTransaction
    )?.status, 'discarded');
    assert.equal(terminalCoarseRuntime.ownsExecution(terminalCoarseField), true);
    assert.equal(
      terminalCoarseRuntime.stateMutationState(terminalCoarseField)
        .publicationLocked,
      false
    );
    assert.equal(validateSchroederFineMicroepochAuthority(
      fixture.device,
      successorMicroepoch,
      {
        canonicalEpoch: successorCanonicalEpoch,
        particleContinuation: continuation,
        substepOrdinal: 1
      }
    ), true);
    const retriedTerminalTransaction =
      createSchroederFusedCoarseTerminalTransaction({
        device: fixture.device,
        macroAuthority: fixture.macroAuthority,
        microepochAuthority: successorMicroepoch,
        particleContinuation: continuation
      });
    assert.notEqual(retriedTerminalTransaction, terminalTransaction);
    assert.equal(validateSchroederFusedCoarseTerminalTransaction(
      fixture.device,
      retriedTerminalTransaction,
      { stage: 'p2g' }
    ), true);
    const terminalP2g = await runTerminalP2gProducer(fixture, {
      transaction: retriedTerminalTransaction,
      generation: successorGeneration,
      continuation,
      ...uploads
    });
    const terminalP2gOptions = {
      terminalTransaction: retriedTerminalTransaction,
      macroAuthority: fixture.macroAuthority,
      microepochAuthority: successorMicroepoch,
      particleContinuation: continuation,
      fieldExecution: terminalCoarseField,
      mutationSegment: retriedTerminalTransaction.p2gMutation,
      priorArtifact: null,
      requireDeferred: true,
      proposalMode: 'proposal-deferred-to-post-mechanics'
    };
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      terminalP2g,
      terminalP2gOptions
    ), true);
    assert.equal(validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      fixture.device,
      { ...terminalP2g },
      terminalP2gOptions
    ), false);
    assert.equal(schroederFusedCoarseTerminalTransactionState(
      fixture.device,
      retriedTerminalTransaction
    ).stageIndex, 1);
    assert.throws(() => discardSchroederFusedCoarseTerminalTransaction(
      fixture.device,
      terminalTransaction,
      { discardedEncoder: true }
    ), /only an unsubmitted fused coarse-terminal transaction can be discarded/);

    fixture.device.lost = Promise.resolve({
      reason: 'destroyed',
      message: 'injected terminal lifecycle device loss'
    });
    let terminalFineQuarantineCount = 0;
    const originalFineQuarantine =
      terminalFineRuntime.quarantineCurrentStateArtifact;
    terminalFineRuntime.quarantineCurrentStateArtifact = (...args) => {
      terminalFineQuarantineCount += 1;
      if (terminalFineQuarantineCount === 1) {
        throw new Error('injected terminal fine-field quarantine failure');
      }
      return originalFineQuarantine(...args);
    };
    markSchroederFusedCoarseTerminalStageSubmissionObserved(
      fixture.device,
      retriedTerminalTransaction,
      { stage: 'grid-update' }
    );
    assert.throws(
      () => quarantineSchroederFusedCoarseTerminalTransaction(
        fixture.device,
        retriedTerminalTransaction,
        new Error('injected post-observation terminal failure')
      ),
      /injected terminal fine-field quarantine failure/
    );
    assert.equal(
      terminalCoarseRuntime.isStateArtifactQuarantined(terminalCoarseField),
      true
    );
    assert.equal(
      terminalFineRuntime.isStateArtifactQuarantined(terminalFineField),
      false
    );
    assert.throws(
      () => quarantineSchroederFusedCoarseTerminalTransaction(
        fixture.device,
        retriedTerminalTransaction
      ),
      /only a submitted fused coarse-terminal transaction can be quarantined/
    );

    let terminalFineRetirementCount = 0;
    let terminalCoarseRetirementCount = 0;
    let terminalPairRetirementCount = 0;
    const terminalFieldsShareRuntime =
      terminalFineRuntime === terminalCoarseRuntime;
    const originalFineRetirement =
      terminalFineRuntime.quarantineExecutionAfterDeviceLoss;
    const originalCoarseRetirement =
      terminalCoarseRuntime.quarantineExecutionAfterDeviceLoss;
    const injectedTerminalRetirementFailure = new Error(
      'injected terminal fine-field retirement failure'
    );
    if (terminalFieldsShareRuntime) {
      // A v2 paired-field runtime retires both child views through one atomic
      // arena attempt. Both child calls must observe the same first-attempt
      // failure; a later retry delegates both calls to the shared owner.
      const injectedPairRetirement = Promise.reject(
        injectedTerminalRetirementFailure
      );
      injectedPairRetirement.catch(() => {});
      terminalFineRuntime.quarantineExecutionAfterDeviceLoss = (...args) => {
        terminalPairRetirementCount += 1;
        if (terminalPairRetirementCount <= 2) {
          return injectedPairRetirement;
        }
        return originalFineRetirement(...args);
      };
    } else {
      terminalFineRuntime.quarantineExecutionAfterDeviceLoss =
        async (...args) => {
          terminalFineRetirementCount += 1;
          if (terminalFineRetirementCount === 1) {
            throw injectedTerminalRetirementFailure;
          }
          return originalFineRetirement(...args);
        };
      terminalCoarseRuntime.quarantineExecutionAfterDeviceLoss =
        async (...args) => {
          terminalCoarseRetirementCount += 1;
          return originalCoarseRetirement(...args);
        };
    }
    await chain.runtime.releaseExecutionAfter(
      chain.execution,
      fixture.device.queue.onSubmittedWorkDone()
    );
    assert.equal(validateLocallySubmittedMlsMpmFusedG2p(
      fixture.device,
      g2p,
      strictOptions(fixture, chain)
    ), false);
    assert.equal(continuation.stateBuffer, g2p.stateBuffer);
    chain.runtime.destroy();
    const firstTerminalAbort = abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: successorMicroepoch,
        reason: new Error('first split terminal abort attempt'),
        deviceLost: true
      }
    );
    if (terminalFieldsShareRuntime) {
      await assert.rejects(firstTerminalAbort, (error) => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(
          error.errors,
          [
            injectedTerminalRetirementFailure,
            injectedTerminalRetirementFailure
          ]
        );
        return true;
      });
    } else {
      await assert.rejects(
        firstTerminalAbort,
        /injected terminal fine-field retirement failure/
      );
    }
    assert.equal(terminalFineQuarantineCount, 1);
    assert.equal(
      terminalFieldsShareRuntime
        ? terminalPairRetirementCount
        : terminalFineRetirementCount,
      terminalFieldsShareRuntime ? 2 : 1
    );
    assert.equal(terminalCoarseRetirementCount, terminalFieldsShareRuntime ? 0 : 1);
    assert.equal(terminalFineRuntime.ownsExecution(terminalFineField), true);
    assert.equal(
      terminalCoarseRuntime.ownsExecution(terminalCoarseField),
      terminalFieldsShareRuntime
    );
    await abortSchroederTwoLevelMacroAuthorityAfter(
      fixture.device,
      fixture.macroAuthority,
      {
        microepochAuthority: successorMicroepoch,
        reason: new Error('split terminal abort retry'),
        deviceLost: true
      }
    );
    assert.equal(
      terminalFieldsShareRuntime
        ? terminalPairRetirementCount
        : terminalFineRetirementCount,
      terminalFieldsShareRuntime ? 4 : 2
    );
    assert.equal(terminalCoarseRetirementCount, terminalFieldsShareRuntime ? 0 : 1);
    assert.equal(terminalFineRuntime.ownsExecution(terminalFineField), false);
    assert.equal(terminalCoarseRuntime.ownsExecution(terminalCoarseField), false);

    let genericFieldRuntimeTouches = 0;
    for (const fieldRuntime of [terminalFineRuntime, terminalCoarseRuntime]) {
      for (const method of [
        'ownsExecution',
        'isExecutionSubmitted',
        'releaseExecutionAfter'
      ]) {
        fieldRuntime[method] = () => {
          genericFieldRuntimeTouches += 1;
          throw new Error(`generic release touched retired field via ${method}`);
        };
      }
    }
    assert.equal(successorGeneration.releaseScheduled, false);
    assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(
      successorGeneration,
      fixture.device
    ), true);
    assert.equal(await successorGeneration.releasePromise, true);
    assert.equal(genericFieldRuntimeTouches, 0);
    assert.equal(successorGeneration.releaseOperationResults.some(
      ({ owner }) => owner.startsWith('mechanics-field-view-level-')
    ), false);
    fixture.refluxLedger.destroy();
  });

  await t.test('destroyed producer output cannot mint a continuation', async () => {
    const fixture = fusedP2gProducerFixture();
    const chain = await submittedFusedFineCorrection(fixture);
    const g2p = await runFusedG2pProducer(fixture, chain.correction);
    const uploads = nextParticleUploads(fixture, g2p);
    assert.equal(g2p.destroyOutputParticleBuffers(), true);
    assert.equal(g2p.destroyOutputParticleBuffers(), false);
    assert.throws(() => createSchroederCanonicalParticleContinuation({
      device: fixture.device,
      macroAuthority: fixture.macroAuthority,
      ...uploads,
      ordinal: 1,
      priorContinuation: fixture.particleContinuation,
      sourceTransaction: fixture.transaction,
      g2pReconstruction: g2p
    }), /claim the exact live G2P/);
    await releaseFusedG2pFixture(
      fixture,
      chain,
      'destroyed fused G2P fixture cleanup'
    );
  });

  await t.test('synchronous submit failure releases its claim for an exact retry', async () => {
    const fixture = fusedP2gProducerFixture();
    const chain = await submittedFusedFineCorrection(fixture);
    const originalSubmit = fixture.device.queue.submit;
    fixture.device.queue.submit = () => {
      throw new Error('injected fused G2P queue.submit failure');
    };
    await assert.rejects(
      runFusedG2pProducer(fixture, chain.correction),
      /injected fused G2P queue\.submit failure/
    );
    fixture.device.queue.submit = originalSubmit;
    assert.equal(schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    ).status, 'fine-correction-submitted');
    const retry = await runFusedG2pProducer(fixture, chain.correction);
    assert.equal(validateLocallySubmittedMlsMpmFusedG2p(
      fixture.device,
      retry,
      strictOptions(fixture, chain)
    ), true);
    await releaseFusedG2pFixture(
      fixture,
      chain,
      'retried fused G2P fixture cleanup'
    );
  });

  await t.test('concurrent calls acquire one producer claim and submit once', async () => {
    const fixture = fusedP2gProducerFixture();
    const chain = await submittedFusedFineCorrection(fixture);
    const submissionsBefore = fixture.device.submissions.length;
    const results = await Promise.allSettled([
      runFusedG2pProducer(fixture, chain.correction),
      runFusedG2pProducer(fixture, chain.correction)
    ]);
    assert.deepEqual(
      results.map((result) => result.status).sort(),
      ['fulfilled', 'rejected']
    );
    assert.equal(fixture.device.submissions.length, submissionsBefore + 1);
    assert.match(
      String(results.find((result) => result.status === 'rejected').reason),
      /already has an exact producer claim/
    );
    await releaseFusedG2pFixture(
      fixture,
      chain,
      'concurrent fused G2P fixture cleanup'
    );
  });

  await t.test('post-submit correction mutation quarantines and destroys outputs', async () => {
    const fixture = fusedP2gProducerFixture();
    const chain = await submittedFusedFineCorrection(fixture);
    const createdBefore = fixture.device.createdBuffers.length;
    const originalSubmit = fixture.device.queue.submit;
    fixture.device.queue.submit = (commandBuffers) => {
      originalSubmit(commandBuffers);
      chain.correction.dt += 0.001;
    };
    await assert.rejects(
      runFusedG2pProducer(fixture, chain.correction),
      /exact correction|exact fused artifact publication|does not match its exact correction/
    );
    fixture.device.queue.submit = originalSubmit;
    const state = schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    );
    assert.equal(state.status, 'quarantined');
    assert.equal(state.stageIndex, 3);
    assert.equal(state.submissionObservedStage, 'g2p');
    await new Promise((resolve) => setImmediate(resolve));
    const outputs = fixture.device.createdBuffers
      .slice(createdBefore)
      .filter((buffer) => [
        'ulg-mls-mpm-g2p-state-out',
        'ulg-mls-mpm-g2p-mechanics-out'
      ].includes(buffer.label));
    assert.equal(outputs.length, 2);
    assert.equal(outputs.every((buffer) => buffer.destroyed), true);
    await assert.rejects(
      runFusedG2pProducer(fixture, chain.correction),
      /exact correction|exact pending transaction|provenance/
    );
    await releaseFusedG2pFixture(
      fixture,
      chain,
      'post-submit poisoned fused G2P fixture cleanup'
    );
  });

  await t.test('partial allocation failure destroys prior buffers and remains retryable', async () => {
    const fixture = fusedP2gProducerFixture();
    const chain = await submittedFusedFineCorrection(fixture);
    const originalCreateBuffer = fixture.device.createBuffer;
    const created = [];
    fixture.device.createBuffer = (descriptor) => {
      if (created.length === 1) {
        throw new Error('injected fused G2P createBuffer failure');
      }
      const buffer = originalCreateBuffer(descriptor);
      created.push(buffer);
      return buffer;
    };
    await assert.rejects(
      runFusedG2pProducer(fixture, chain.correction),
      /injected fused G2P createBuffer failure/
    );
    fixture.device.createBuffer = originalCreateBuffer;
    assert.equal(created.length, 1);
    assert.equal(created[0].destroyed, true);
    assert.equal(schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    ).status, 'fine-correction-submitted');
    await runFusedG2pProducer(fixture, chain.correction);
    await releaseFusedG2pFixture(
      fixture,
      chain,
      'partial allocation fused G2P fixture cleanup'
    );
  });

  await t.test('write failure survives fence and one-shot cleanup failures', async () => {
    const fixture = fusedP2gProducerFixture();
    const chain = await submittedFusedFineCorrection(fixture);
    const originalCreateBuffer = fixture.device.createBuffer;
    const originalWriteBuffer = fixture.device.queue.writeBuffer;
    const originalOnSubmittedWorkDone =
      fixture.device.queue.onSubmittedWorkDone;
    const created = [];
    let throwingDestroyCalls = 0;
    fixture.device.createBuffer = (descriptor) => {
      const buffer = originalCreateBuffer(descriptor);
      created.push(buffer);
      if (descriptor.label === 'ulg-mls-mpm-g2p-state-out') {
        const originalDestroy = buffer.destroy.bind(buffer);
        buffer.destroy = () => {
          throwingDestroyCalls += 1;
          if (throwingDestroyCalls === 1) {
            throw new Error('injected one-shot cleanup failure');
          }
          originalDestroy();
        };
      }
      return buffer;
    };
    fixture.device.queue.writeBuffer = () => {
      throw new Error('injected fused G2P writeBuffer failure');
    };
    fixture.device.queue.onSubmittedWorkDone = () => {
      throw new Error('injected cleanup fence construction failure');
    };
    await assert.rejects(
      runFusedG2pProducer(fixture, chain.correction),
      /injected fused G2P writeBuffer failure/
    );
    fixture.device.createBuffer = originalCreateBuffer;
    fixture.device.queue.writeBuffer = originalWriteBuffer;
    fixture.device.queue.onSubmittedWorkDone = originalOnSubmittedWorkDone;
    assert.ok(created.length >= 2);
    assert.equal(throwingDestroyCalls, 2);
    assert.equal(created.every((buffer) => buffer.destroyed), true);
    assert.equal(
      chain.correction.mechanicsFieldViewExecution.ownerRuntime
        .g2pWorkspaceForExecution(
          chain.correction.mechanicsFieldViewExecution
        ).paramsBuffer.destroyed,
      false
    );
    assert.equal(schroederFusedFineSubstepTransactionState(
      fixture.device,
      fixture.transaction
    ).status, 'fine-correction-submitted');
    await runFusedG2pProducer(fixture, chain.correction);
    await releaseFusedG2pFixture(
      fixture,
      chain,
      'write failure fused G2P fixture cleanup'
    );
  });
});

test('fused coarse-terminal WebGPU G2P owns the exact final S* output', async (t) => {
  await t.test('success publishes stage four and transfers S* exactly once', async () => {
    const chain = await submittedTerminalWorkspaceFixture();
    const { terminal } = chain;
    const submissionsBefore = terminal.fixture.device.submissions.length;
    const traceStart = terminal.fixture.device.passTrace.length;
    const g2p = await runTerminalG2pProducer(chain);
    assert.equal(
      terminal.fixture.device.submissions.length,
      submissionsBefore + 1
    );
    assert.deepEqual(
      terminal.fixture.device.passTrace
        .slice(traceStart)
        .map(({ entryPoint }) => entryPoint)
        .filter((entryPoint) => [
          'claim_g2p_energy_receipt',
          'measure_g2p_energy_receipt',
          'consume_g2p_energy_receipt',
          'consume_g2p_fine_reflux_receipt',
          'consume_g2p_coarse_reflux_receipt'
        ].includes(entryPoint)),
      [
        'claim_g2p_energy_receipt',
        'measure_g2p_energy_receipt',
        'consume_g2p_energy_receipt',
        'consume_g2p_coarse_reflux_receipt'
      ]
    );
    assert.equal(g2p.proposalMode, 'proposal-deferred-to-post-mechanics');
    assert.equal(g2p.mechanicalProposalApplied, false);
    assert.equal(g2p.fusedCoarseTerminalTransaction, terminal.terminalTransaction);
    assert.equal(g2p.fusedFineSubstepTransaction, undefined);
    assert.equal(g2p.terminalMicroepochAuthority, terminal.successorMicroepoch);
    assert.equal(g2p.fineMicroepochAuthority, undefined);
    assert.equal(validateLocallySubmittedMlsMpmFusedG2p(
      terminal.fixture.device,
      g2p,
      terminalG2pOptions(chain)
    ), true);
    assert.equal(validateLocallySubmittedMlsMpmFusedG2p(
      terminal.fixture.device,
      g2p,
      {
        ...terminalG2pOptions(chain),
        terminalTransaction: undefined,
        transaction: terminal.terminalTransaction
      }
    ), false);
    assert.equal(validateLocallySubmittedMlsMpmFusedG2p(
      terminal.fixture.device,
      { ...g2p },
      terminalG2pOptions(chain)
    ), false);
    assert.deepEqual(schroederFusedCoarseTerminalTransactionState(
      terminal.fixture.device,
      terminal.terminalTransaction
    ), {
      status: 'g2p-submitted-unverified',
      stageIndex: 4,
      submissionObservedStage: null,
      nextStage: null,
      submittedStageCount: 3,
      g2pSubmitted: true,
      outputClaimed: false,
      gpuReceiptStatus: 'submitted-unverified',
      quarantineReason: null
    });

    const finalUploads = terminalFinalParticleUploads(chain, g2p);
    assert.equal(claimLocallySubmittedMlsMpmFusedG2pOutputForContinuation(
      terminal.fixture.device,
      g2p,
      {
        transaction: terminal.terminalTransaction,
        macroAuthority: terminal.fixture.macroAuthority,
        microepochAuthority: terminal.successorMicroepoch,
        particleContinuation: terminal.continuation,
        fieldExecution: terminal.terminalTransaction.coarseFieldView,
        priorArtifact: chain.artifact,
        proposalMode: 'proposal-deferred-to-post-mechanics',
        nextOrdinal: terminal.continuation.ordinal + 1,
        nextSphParticleUpload: finalUploads.finalSphParticleUpload,
        nextMlsMpmParticleUpload: finalUploads.finalMlsMpmParticleUpload
      }
    ), false);
    assert.throws(() => createSchroederCanonicalParticleContinuation({
      device: terminal.fixture.device,
      macroAuthority: terminal.fixture.macroAuthority,
      sphParticleUpload: finalUploads.finalSphParticleUpload,
      mlsMpmParticleUpload: finalUploads.finalMlsMpmParticleUpload,
      ordinal: terminal.continuation.ordinal + 1,
      priorContinuation: terminal.continuation,
      sourceTransaction: terminal.terminalTransaction,
      g2pReconstruction: g2p
    }), /ordinal is replayed or out of order/);
    const forgedFinalUploads = {
      ...finalUploads,
      finalSphParticleUpload: {
        ...finalUploads.finalSphParticleUpload,
        identityBufferByteLength:
          finalUploads.finalSphParticleUpload.identityBufferByteLength + 4
      }
    };
    assert.equal(claimSchroederFusedCoarseTerminalOutput(
      terminal.fixture.device,
      terminal.terminalTransaction,
      { g2pReconstruction: g2p, ...forgedFinalUploads }
    ), false);
    assert.equal(claimSchroederFusedCoarseTerminalOutput(
      terminal.fixture.device,
      terminal.terminalTransaction,
      { g2pReconstruction: { ...g2p }, ...finalUploads }
    ), false);
    assert.equal(claimSchroederFusedCoarseTerminalOutput(
      terminal.fixture.device,
      { ...terminal.terminalTransaction },
      { g2pReconstruction: g2p, ...finalUploads }
    ), false);
    assert.equal(claimSchroederFusedCoarseTerminalOutput(
      terminal.fixture.device,
      terminal.fixture.transaction,
      { g2pReconstruction: g2p, ...finalUploads }
    ), false);
    assert.equal(schroederFusedCoarseTerminalTransactionState(
      terminal.fixture.device,
      terminal.terminalTransaction
    ).outputClaimed, false);
    assert.equal(claimSchroederFusedCoarseTerminalOutput(
      terminal.fixture.device,
      terminal.terminalTransaction,
      { g2pReconstruction: g2p, ...finalUploads }
    ), true);
    assert.equal(claimSchroederFusedCoarseTerminalOutput(
      terminal.fixture.device,
      terminal.terminalTransaction,
      { g2pReconstruction: g2p, ...finalUploads }
    ), false);
    assert.equal(schroederFusedCoarseTerminalTransactionState(
      terminal.fixture.device,
      terminal.terminalTransaction
    ).outputClaimed, true);
    assert.equal(g2p.destroyOutputParticleBuffers(), false);
    assert.equal(g2p.stateBuffer.destroyed, false);
    assert.equal(g2p.mechanicsBuffer.destroyed, false);
    await releaseTerminalG2pFixture(chain, 'terminal S* success cleanup');
  });

  await t.test('wrong mode, stripped brand, timing, and ABI fail before submit', async () => {
    const chain = await submittedTerminalWorkspaceFixture();
    const { terminal } = chain;
    const device = terminal.fixture.device;
    const submissionsBefore = device.submissions.length;
    const rejectedRuns = [
      {
        fusedCoarseTerminalTransaction: null
      },
      {
        gridUpdate: { ...chain.artifact },
        fusedCoarseTerminalTransaction: null
      },
      {
        dt: terminal.fixture.macroAuthority.macroDt + 0.001
      },
      {
        schroederSelectedLevel: terminal.fixture.macroAuthority.fineLevel
      },
      {
        sphParticleUpload: {
          ...terminal.uploads.sphParticleUpload,
          identityStrideBytes:
            terminal.uploads.sphParticleUpload.identityStrideBytes + 4
        }
      }
    ];
    for (const overrides of rejectedRuns) {
      await assert.rejects(
        runTerminalG2pProducer(chain, overrides),
        /brand|provenance|authenticate|exact|requires/
      );
    }
    assert.equal(device.submissions.length, submissionsBefore);
    assert.equal(schroederFusedCoarseTerminalTransactionState(
      device,
      terminal.terminalTransaction
    ).stageIndex, 3);
    await releaseTerminalG2pFixture(chain, 'terminal rejection matrix cleanup');
  });

  await t.test('synchronous submit failure and concurrent calls remain exact', async () => {
    const submitFailureChain = await submittedTerminalWorkspaceFixture();
    const submitFailureDevice = submitFailureChain.terminal.fixture.device;
    const originalSubmit = submitFailureDevice.queue.submit;
    submitFailureDevice.queue.submit = () => {
      throw new Error('injected terminal G2P queue.submit failure');
    };
    await assert.rejects(
      runTerminalG2pProducer(submitFailureChain),
      /injected terminal G2P queue\.submit failure/
    );
    submitFailureDevice.queue.submit = originalSubmit;
    assert.equal(schroederFusedCoarseTerminalTransactionState(
      submitFailureDevice,
      submitFailureChain.terminal.terminalTransaction
    ).stageIndex, 3);
    const retry = await runTerminalG2pProducer(submitFailureChain);
    assert.equal(validateLocallySubmittedMlsMpmFusedG2p(
      submitFailureDevice,
      retry,
      terminalG2pOptions(submitFailureChain)
    ), true);
    await releaseTerminalG2pFixture(
      submitFailureChain,
      'terminal submit retry cleanup'
    );

    const concurrentChain = await submittedTerminalWorkspaceFixture();
    const concurrentDevice = concurrentChain.terminal.fixture.device;
    const submissionsBefore = concurrentDevice.submissions.length;
    const results = await Promise.allSettled([
      runTerminalG2pProducer(concurrentChain),
      runTerminalG2pProducer(concurrentChain)
    ]);
    assert.deepEqual(
      results.map((result) => result.status).sort(),
      ['fulfilled', 'rejected']
    );
    assert.equal(concurrentDevice.submissions.length, submissionsBefore + 1);
    assert.match(
      String(results.find((result) => result.status === 'rejected').reason),
      /already has an exact producer claim/
    );
    await releaseTerminalG2pFixture(
      concurrentChain,
      'terminal concurrent producer cleanup'
    );
  });

  await t.test('params-write mutation cleans immediately behind a pending fence and retries', async () => {
    const chain = await submittedTerminalWorkspaceFixture();
    const { terminal } = chain;
    const device = terminal.fixture.device;
    const upload = terminal.uploads.sphParticleUpload;
    const originalIdentityStrideBytes = upload.identityStrideBytes;
    const originalWriteBuffer = device.queue.writeBuffer;
    const originalFence = device.queue.onSubmittedWorkDone;
    const createdBefore = device.createdBuffers.length;
    const submissionsBefore = device.submissions.length;
    device.queue.onSubmittedWorkDone = () => new Promise(() => {});
    device.queue.writeBuffer = (buffer, offset, data) => {
      originalWriteBuffer(buffer, offset, data);
      if (buffer.label === 'ulg-mls-mpm-g2p-params') {
        upload.identityStrideBytes = originalIdentityStrideBytes + 4;
      }
    };
    await assert.rejects(
      runTerminalG2pProducer(chain),
      /after parameter upload|provenance-lost-after-params-write|frozen input/
    );
    device.queue.writeBuffer = originalWriteBuffer;
    device.queue.onSubmittedWorkDone = originalFence;
    upload.identityStrideBytes = originalIdentityStrideBytes;
    assert.equal(device.submissions.length, submissionsBefore);
    const failedOwnedBuffers = device.createdBuffers
      .slice(createdBefore)
      .filter((buffer) => buffer.label?.startsWith('ulg-mls-mpm-g2p-'));
    assert.ok(failedOwnedBuffers.length >= 2);
    assert.equal(failedOwnedBuffers.every((buffer) => buffer.destroyed), true);
    assert.equal(
      terminal.terminalTransaction.coarseFieldView.ownerRuntime
        .g2pWorkspaceForExecution(
          terminal.terminalTransaction.coarseFieldView
        ).paramsBuffer.destroyed,
      false
    );
    assert.equal(schroederFusedCoarseTerminalTransactionState(
      device,
      terminal.terminalTransaction
    ).stageIndex, 3);
    await runTerminalG2pProducer(chain);
    await releaseTerminalG2pFixture(chain, 'terminal params TOCTOU cleanup');
  });

  await t.test('encoder-finish mutation produces zero submits and an exact retry', async () => {
    const chain = await submittedTerminalWorkspaceFixture();
    const { terminal } = chain;
    const device = terminal.fixture.device;
    const upload = terminal.uploads.sphParticleUpload;
    const originalIdentityByteLength = upload.identityBufferByteLength;
    const originalCreateCommandEncoder = device.createCommandEncoder;
    const submissionsBefore = device.submissions.length;
    device.createCommandEncoder = (...args) => {
      const encoder = originalCreateCommandEncoder(...args);
      const originalFinish = encoder.finish;
      encoder.finish = (...finishArgs) => {
        const commandBuffer = originalFinish(...finishArgs);
        upload.identityBufferByteLength = originalIdentityByteLength + 4;
        return commandBuffer;
      };
      return encoder;
    };
    await assert.rejects(
      runTerminalG2pProducer(chain),
      /after command encoding|provenance-lost-before-submit|frozen input/
    );
    device.createCommandEncoder = originalCreateCommandEncoder;
    upload.identityBufferByteLength = originalIdentityByteLength;
    assert.equal(device.submissions.length, submissionsBefore);
    assert.equal(schroederFusedCoarseTerminalTransactionState(
      device,
      terminal.terminalTransaction
    ).stageIndex, 3);
    await runTerminalG2pProducer(chain);
    await releaseTerminalG2pFixture(chain, 'terminal finish TOCTOU cleanup');
  });

  await t.test('post-submit input mutation quarantines both fields and destroys outputs', async () => {
    const chain = await submittedTerminalWorkspaceFixture();
    const { terminal } = chain;
    const device = terminal.fixture.device;
    const upload = terminal.uploads.sphParticleUpload;
    const originalIdentityStrideBytes = upload.identityStrideBytes;
    const originalSubmit = device.queue.submit;
    const originalFence = device.queue.onSubmittedWorkDone;
    const createdBefore = device.createdBuffers.length;
    let resolveFence;
    const submittedFence = new Promise((resolve) => {
      resolveFence = resolve;
    });
    device.queue.onSubmittedWorkDone = () => submittedFence;
    device.queue.submit = (commandBuffers) => {
      originalSubmit(commandBuffers);
      upload.identityStrideBytes = originalIdentityStrideBytes + 4;
    };
    await assert.rejects(
      runTerminalG2pProducer(chain),
      /exact fused artifact publication|frozen input|submission observation is stale/
    );
    device.queue.submit = originalSubmit;
    upload.identityStrideBytes = originalIdentityStrideBytes;
    const state = schroederFusedCoarseTerminalTransactionState(
      device,
      terminal.terminalTransaction
    );
    assert.equal(state.status, 'quarantined');
    assert.equal(state.stageIndex, 3);
    assert.equal(state.outputClaimed, false);
    const fineField = terminal.successorMicroepoch.fineFieldView;
    const coarseField = terminal.successorMicroepoch.parentFieldView.coarseFieldView;
    assert.equal(fineField.ownerRuntime.isStateArtifactQuarantined(fineField), true);
    assert.equal(
      coarseField.ownerRuntime.isStateArtifactQuarantined(coarseField),
      true
    );
    await new Promise((resolve) => setImmediate(resolve));
    const outputs = device.createdBuffers
      .slice(createdBefore)
      .filter((buffer) => [
        'ulg-mls-mpm-g2p-state-out',
        'ulg-mls-mpm-g2p-mechanics-out'
      ].includes(buffer.label));
    assert.equal(outputs.length, 2);
    assert.equal(outputs.every((buffer) => buffer.destroyed === false), true);
    resolveFence();
    await submittedFence;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(outputs.every((buffer) => buffer.destroyed), true);
    device.queue.onSubmittedWorkDone = originalFence;
    await releaseTerminalG2pFixture(chain, 'terminal post-submit quarantine cleanup');
  });

  await t.test('field-completion callback mutation cannot escape stage-four publication', async () => {
    const chain = await submittedTerminalWorkspaceFixture();
    const { terminal } = chain;
    const device = terminal.fixture.device;
    const coarseField = terminal.successorMicroepoch.parentFieldView.coarseFieldView;
    const fineField = terminal.successorMicroepoch.fineFieldView;
    const fieldRuntime = coarseField.ownerRuntime;
    const upload = terminal.uploads.sphParticleUpload;
    const originalIdentityByteLength = upload.identityBufferByteLength;
    const originalComplete = fieldRuntime.completeStateMutationSequence;
    const createdBefore = device.createdBuffers.length;
    fieldRuntime.completeStateMutationSequence = (...args) => {
      const result = originalComplete(...args);
      upload.identityBufferByteLength = originalIdentityByteLength + 4;
      return result;
    };
    await assert.rejects(
      runTerminalG2pProducer(chain),
      /field completion|lifecycle publication|publication provenance/
    );
    fieldRuntime.completeStateMutationSequence = originalComplete;
    upload.identityBufferByteLength = originalIdentityByteLength;
    const state = schroederFusedCoarseTerminalTransactionState(
      device,
      terminal.terminalTransaction
    );
    assert.equal(state.status, 'quarantined');
    assert.equal(state.outputClaimed, false);
    assert.equal(fieldRuntime.isStateArtifactQuarantined(coarseField), true);
    assert.equal(fineField.ownerRuntime.isStateArtifactQuarantined(fineField), true);
    await new Promise((resolve) => setImmediate(resolve));
    const outputs = device.createdBuffers
      .slice(createdBefore)
      .filter((buffer) => [
        'ulg-mls-mpm-g2p-state-out',
        'ulg-mls-mpm-g2p-mechanics-out'
      ].includes(buffer.label));
    assert.equal(outputs.length, 2);
    assert.equal(outputs.every((buffer) => buffer.destroyed === false), true);
    await releaseTerminalG2pFixture(
      chain,
      'terminal completion callback quarantine cleanup'
    );
    assert.equal(outputs.every((buffer) => buffer.destroyed), true);
  });

  await t.test('retained output destruction is complete and retryable', async () => {
    const chain = await submittedTerminalWorkspaceFixture();
    const g2p = await runTerminalG2pProducer(chain);
    const originalStateDestroy = g2p.stateBuffer.destroy.bind(g2p.stateBuffer);
    const originalMechanicsDestroy =
      g2p.mechanicsBuffer.destroy.bind(g2p.mechanicsBuffer);
    let stateDestroyCalls = 0;
    let mechanicsDestroyCalls = 0;
    g2p.stateBuffer.destroy = () => {
      stateDestroyCalls += 1;
      if (stateDestroyCalls <= 2) {
        throw new Error('injected retained state destroy failure');
      }
      originalStateDestroy();
    };
    g2p.mechanicsBuffer.destroy = () => {
      mechanicsDestroyCalls += 1;
      originalMechanicsDestroy();
    };
    assert.throws(
      () => g2p.destroyOutputParticleBuffers(),
      /destruction was incomplete/
    );
    assert.equal(g2p.stateBuffer.destroyed, false);
    assert.equal(g2p.mechanicsBuffer.destroyed, true);
    assert.equal(g2p.destroyOutputParticleBuffers(), true);
    assert.equal(g2p.destroyOutputParticleBuffers(), false);
    assert.equal(stateDestroyCalls, 3);
    assert.equal(mechanicsDestroyCalls, 1);
    assert.equal(g2p.stateBuffer.destroyed, true);
    await releaseTerminalG2pFixture(chain, 'terminal output destructor cleanup');
  });
});

test('CPU MLS-MPM P2G uses the ambient-referenced CFL-reduced gas closure for admitted gas', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 1,
    restDensityKgPerM3: 1,
    restVolumeM3: 1,
    solidFlag: 0,
    soundSpeedMPerS: 340,
    eosModelId: 2,
    phaseFractions: [0, 0, 1, 0],
    mechanicsDtS: 0.01
  });
  const atmosphere = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    ambientPressurePa: 101325
  });
  const vacuum = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    ambientPressurePa: 0
  });
  const reducedSoundSpeedBuffers = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 1,
    restDensityKgPerM3: 1,
    restVolumeM3: 1,
    solidFlag: 0,
    soundSpeedMPerS: 170,
    eosModelId: 2,
    phaseFractions: [0, 0, 1, 0],
    mechanicsDtS: 0.01
  });
  const reducedSoundSpeedVacuum = projectMlsMpmP2gGridCpu({
    ...reducedSoundSpeedBuffers,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    ambientPressurePa: 0
  });

  assert.equal(atmosphere.ambientPressureAppliedInStressProjection, true);
  nearlyEqual(maxNodeMomentumAbs(atmosphere.gridNodes), 0, 1e-6);
  const vacuumMomentum = maxNodeMomentumAbs(vacuum.gridNodes);
  const reducedSoundSpeedMomentum = maxNodeMomentumAbs(reducedSoundSpeedVacuum.gridNodes);
  assert.ok(vacuumMomentum > 0);
  nearlyEqual(reducedSoundSpeedMomentum / vacuumMomentum, 0.25, 1e-5);
});

test('WebGPU MLS-MPM P2G can filter particles by retained Schroeder level assignment', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const device = fakeP2gDevice();
  const assignmentBuffer = { label: 'retained-schroeder-assignment-buffer' };
  const projection = await runMlsMpmP2gGridProjectionWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    readbackMode: 'no-full-readback',
    schroederLevelAssignment: {
      particleCount: 1,
      assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length,
      assignmentBuffer
    },
    schroederSelectedLevel: 2
  });

  assert.equal(projection.backend, 'webgpu');
  assert.equal(projection.schroederLevelFilterEnabled, true);
  assert.equal(projection.schroederSelectedLevel, 2);
  assert.equal(projection.schroederLevelFilter.assignmentStrideFloats, SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length);
  assert.equal(projection.schroederLevelFilter.authorityBindingMode, 'precanonical-level-assignment');
  assert.equal(projection.schroederLevelFilter.oldLevelAssignmentLookupRemoved, false);
  assert.equal(
    device.createdBuffers.some((buffer) => buffer.label === 'ulg-mls-mpm-p2g-schroeder-level-assignments-dummy'),
    false
  );
  assert.ok(device.bindGroups[0].entries.some((entry) => (
    entry.binding === 7 && entry.resource.buffer === assignmentBuffer
  )));
  assert.equal(
    device.bindGroups[0].layout.entries.find((entry) => entry.binding === 7)?.buffer?.type,
    'read-only-storage'
  );
  assert.equal(projection.schroederSpatialDirectoryEnabled, false);
  assert.equal(projection.schroederSpatialDirectoryFallback, true);
  assert.equal(projection.schroederSpatialDirectoryFallbackScope, 'host-binding-only');
  assert.equal(projection.schroederSpatialHostBindingAdmitted, false);
  assert.equal(projection.schroederSpatialHostBindingFallback, true);
  assert.equal(projection.schroederSpatialGpuAdmissionObserved, false);
  assert.equal(projection.schroederSpatialGpuAdmissionStatus, 'not-applicable-host-binding-fallback');
  assert.equal(projection.schroederSpatialGpuFallbackObserved, null);
});

test('WebGPU MLS-MPM P2G binds canonical evidence and ignores legacy assignment payloads', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const device = fakeP2gDevice();
  const generation = canonicalSpatialEpochGenerationFixture(device);
  const { directoryBuffer, evidenceBuffer } = generation.execution;
  const legacyAssignment = new Proxy({}, {
    get() {
      throw new Error('canonical P2G inspected obsolete level-assignment authority');
    }
  });
  const projection = await runMlsMpmP2gGridProjectionWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    readbackMode: 'no-full-readback',
    schroederLevelAssignment: legacyAssignment,
    schroederSelectedLevel: 2,
    schroederSpatialEpochGeneration: generation,
    canonicalSpatialRequired: true,
    observeCanonicalSpatialAuthority: true
  });

  assert.equal(device.submissions.length, 1);
  assert.equal(projection.schroederSpatialDirectoryEnabled, true);
  assert.equal(projection.schroederSpatialDirectoryFallback, false);
  assert.equal(projection.schroederSpatialDirectoryFallbackScope, 'host-binding-only');
  assert.equal(projection.schroederSpatialHostBindingAdmitted, true);
  assert.equal(projection.schroederSpatialHostBindingFallback, false);
  assert.equal(projection.schroederSpatialGpuAdmissionObserved, false);
  assert.equal(projection.schroederSpatialGpuAdmissionStatus, 'shader-validates-at-dispatch-no-host-readback');
  assert.equal(projection.schroederSpatialGpuFallbackObserved, null);
  assert.equal(projection.schroederSpatialDirectory.generationId, 17);
  assert.equal(projection.schroederSpatialDirectory.storageGeneration, 23);
  assert.equal(projection.schroederSpatialDirectory.positionEpoch, 29);
  assert.equal(projection.schroederSpatialDirectory.topologyEpoch, 31);
  assert.equal(projection.schroederSpatialDirectory.evidenceBufferByteLength, 80);
  assert.equal(projection.schroederLevelFilter.authorityBindingMode, 'canonical-spatial-epoch');
  assert.equal(projection.schroederLevelFilter.oldLevelAssignmentLookupRemoved, true);
  assert.equal(projection.schroederLevelFilter.retainedAssignmentBuffer, false);
  assert.equal(projection.schroederLevelFilter.assignmentBufferByteLength, 0);
  assert.equal(projection.schroederLevelFilter.spatialEvidenceEnabled, true);
  for (const group of device.bindGroups) {
    assert.equal(
      group.entries.find((entry) => entry.binding === 7)?.resource?.buffer,
      evidenceBuffer
    );
    assert.equal(
      group.entries.find((entry) => entry.binding === 8)?.resource?.buffer,
      directoryBuffer
    );
    assert.equal(
      group.layout.entries.find((entry) => entry.binding === 7)?.buffer?.type,
      'storage'
    );
  }
  assert.ok(device.shaderModules.length > 0);
  for (const shader of device.shaderModules) {
    assert.doesNotMatch(shader.code, /schroeder_level_assignments/);
    assert.match(shader.code, /schroeder_spatial_authority_evidence/);
  }
  assert.deepEqual(
    device.clears
      .filter((clear) => clear.buffer === evidenceBuffer)
      .map(({ offset, size }) => [offset, size]),
    [[16, 64]]
  );
  assert.equal(evidenceBuffer.destroyed, false);
  const paramsWrite = device.writes.find((write) => write.label === 'ulg-mls-mpm-p2g-params');
  assert.ok(paramsWrite);
  assert.equal(paramsWrite.byteLength, 144);
  const params = new DataView(paramsWrite.data);
  assert.equal(params.getUint32(44, true), 1);
  assert.equal(params.getInt32(48, true), 2);
  assert.equal(params.getUint32(52, true), SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length);
  const canonicalIdentityWords = new Map([
    [56, 1],
    [60, 23],
    [80, 29],
    [84, 31],
    [88, 1],
    [92, 17],
    [96, 37],
    [100, 41],
    [104, 43],
    [108, 47],
    [112, 53],
    [116, 59],
    [120, 61],
    [124, 67],
    [128, 71],
    [132, 1],
    [136, 0],
    [140, 0]
  ]);
  for (const [offset, expected] of canonicalIdentityWords) {
    assert.equal(params.getUint32(offset, true), expected, `identity word at byte ${offset}`);
  }
});

test('WebGPU MLS-MPM P2G rejects host-invalid canonical generations without submission or fallback', async (t) => {
  const cases = [
    {
      name: 'released execution',
      status: 'canonical-spatial-directory-rejected-released-generation',
      invalidate(generation) {
        generation.execution.released = true;
      }
    },
    {
      name: 'wrong generation schema',
      status: 'canonical-spatial-directory-rejected-schema',
      invalidate(generation) {
        generation.schema = 'peercompute.ulg.schroeder-spatial-epoch-generation.invalid';
      }
    },
    {
      name: 'wrong execution schema',
      status: 'canonical-spatial-directory-rejected-schema',
      invalidate(generation) {
        generation.execution.schema = 'peercompute.ulg.schroeder-spatial-epoch.invalid';
      }
    },
    {
      name: 'cross-device directory buffer',
      status: 'canonical-spatial-directory-rejected-device',
      invalidate(generation) {
        const foreignDirectoryBuffer = {
          label: 'foreign-schroeder-spatial-directory',
          size: 256
        };
        tagWebGpuBufferDevice(foreignDirectoryBuffer, {});
        generation.execution.directoryBuffer = foreignDirectoryBuffer;
      }
    },
    {
      name: 'cross-device evidence buffer',
      status: 'canonical-spatial-directory-rejected-device',
      invalidate(generation) {
        const foreignEvidenceBuffer = {
          label: 'foreign-schroeder-spatial-evidence',
          size: 80
        };
        tagWebGpuBufferDevice(foreignEvidenceBuffer, {});
        generation.execution.evidenceBuffer = foreignEvidenceBuffer;
      }
    },
    {
      name: 'undersized evidence buffer',
      status: 'canonical-spatial-directory-rejected-evidence-capacity',
      invalidate(generation) {
        generation.execution.evidenceBuffer.size = 16;
      }
    },
    {
      name: 'torn exact-near query profile',
      status: 'canonical-spatial-directory-rejected-query-geometry',
      invalidate(generation) {
        generation.execution.queryGeometryEvidence = {
          ...generation.execution.exactNearQueryProfile
        };
      }
    },
    {
      name: 'phase-volume overlay authority',
      status: 'canonical-spatial-directory-rejected-overlay-authority',
      invalidate(generation) {
        generation.source.phaseVolumeAssignmentOverlayEnabled = true;
      }
    },
    {
      name: 'overlay authority takes precedence over a wrong schema',
      status: 'canonical-spatial-directory-rejected-overlay-authority',
      invalidate(generation) {
        generation.source.phaseVolumeAssignmentOverlayEnabled = true;
        generation.schema = 'peercompute.ulg.schroeder-spatial-epoch-generation.invalid';
      }
    },
    {
      name: 'selected level is not an exact i32',
      status: 'canonical-spatial-selected-level-rejected',
      selectedLevel: Number.NaN,
      invalidate() {}
    },
    {
      name: 'required generation is not selected',
      status: 'canonical-spatial-directory-requested-but-unavailable',
      invalidate(generation) {
        generation.selected = false;
      }
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const { sphParticleState, mlsMpmParticleState } = manualBuffers();
      const device = fakeP2gDevice();
      const generation = canonicalSpatialEpochGenerationFixture(device);
      testCase.invalidate(generation);

      await assert.rejects(
        runMlsMpmP2gGridProjectionWebGpu({
          device,
          sphParticleState,
          mlsMpmParticleState,
          gridSpacingM: 1,
          boxDimsM: [2, 2, 2],
          readbackMode: 'no-full-readback',
          schroederLevelAssignment: {
            particleCount: 999,
            assignmentStrideFloats: 0,
            assignments: 'malformed-obsolete-authority'
          },
          schroederSelectedLevel: testCase.selectedLevel ?? 2,
          schroederSpatialEpochGeneration: generation,
          canonicalSpatialRequired: true
        }),
        (error) => {
          assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
          assert.equal(error.status, testCase.status);
          return true;
        }
      );
      assert.equal(device.submissions.length, 0);
      assert.equal(device.bindGroups.length, 0);
      assert.equal(device.dispatches.length, 0);
      assert.equal(device.writes.length, 0);
    });
  }
});

test('WebGPU MLS-MPM P2G reports Ocean-tiled fallback before the replacement kernel exists', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const device = fakeP2gDevice();
  const projection = await runMlsMpmP2gGridProjectionWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    readbackMode: 'no-full-readback',
    p2gBackend: MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL
  });

  assert.equal(projection.backend, 'webgpu');
  assert.equal(projection.readbackMode, 'no-full-readback');
  assert.equal(projection.p2gBackendPolicy.schema, ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA);
  assert.equal(projection.p2gBackendPolicyStatus, 'ocean-tiled-backend-fallback-resident-scatter');
  assert.equal(projection.p2gBackendRequested, MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL);
  assert.equal(projection.p2gBackendEffective, MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER);
  assert.equal(projection.p2gBackendFallbackReason, 'ocean-tiled-p2g-kernel-not-available');
  assert.equal(projection.p2gBackendPolicy.particleLoopInHotPath, false);
  assert.deepEqual(device.dispatches, [[1, 1, 1], [6, 1, 1]]);
});

test('CPU MLS-MPM P2G grid projection deposits unplaced resident product mass generically', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const rows = productEventRows({
    position: [1.25, 1.25, 1.25],
    visibleMassKg: 1,
    unplacedMassKg: 3,
    status: 1
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    residentProductMass: residentProductMassFromRows(rows)
  });
  const summary = summarizeGrid(projection.gridNodes);
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;

  nearlyEqual(summary.mass, 11, 1e-5);
  nearlyEqual(summary.momentum[0], 16, 1e-5);
  nearlyEqual(summary.momentum[1], 24, 1e-5);
  nearlyEqual(summary.momentum[2], 32, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset], 11 * centerWeight, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 1], 8 * centerWeight * 2, 1e-5);
  assert.equal(projection.residentProductMassInputProductEventCount, 1);
  assert.equal(projection.residentProductMassCoupledEventCount, 1);
  nearlyEqual(projection.residentProductMassCoupledUnplacedMassKg, 3);
  assert.equal(projection.residentProductMassGridCouplingStatus, 'resident-product-mass-coupled-to-cpu-p2g-grid');
  assert.equal(projection.residentProductMassEosCouplingStatus, 'resident-product-mass-p2g-eos-sidecar-ready');
});

test('CPU MLS-MPM P2G grid projection ignores visible or inactive resident product event mass', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const rows = productEventRows({
    visibleMassKg: 4,
    unplacedMassKg: 0,
    status: 1
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    residentProductMass: residentProductMassFromRows(rows, { unplacedProductMassKg: 0 })
  });
  const summary = summarizeGrid(projection.gridNodes);

  nearlyEqual(summary.mass, 8, 1e-5);
  assert.equal(projection.residentProductMassInputProductEventCount, 1);
  assert.equal(projection.residentProductMassCoupledEventCount, 0);
  assert.equal(projection.residentProductMassGridCouplingStatus, 'resident-product-mass-coupled-to-cpu-p2g-grid');
});

test('CPU MLS-MPM P2G grid projection consumes resident product event velocity and EOS mechanics', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 0,
    restDensityKgPerM3: 1,
    restVolumeM3: 0,
    mechanicsDtS: 0.1
  });
  const rows = productEventRows({
    position: [1.25, 1.25, 1.25],
    massKg: 8,
    visibleMassKg: 0,
    unplacedMassKg: 8,
    velocityMPerS: [1, 2, 3],
    supportVolumeM3: 1,
    restDensityKgPerM3: 4,
    soundSpeedMPerS: 10,
    eosModelId: 2
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    dt: 0.1,
    residentProductMass: residentProductMassFromRows(rows, { unplacedProductMassKg: 8 })
  });
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;
  const expectedPressurePa = 400;
  const expectedDiagonalAffine = (-0.1 * 1 * 4) * -expectedPressurePa;
  const pressureMomentum = expectedDiagonalAffine * -0.25;

  nearlyEqual(projection.gridNodes[centerOffset], 8 * centerWeight, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 1], centerWeight * (8 * 1 + pressureMomentum), 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 2], centerWeight * (8 * 2 + pressureMomentum), 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 3], centerWeight * (8 * 3 + pressureMomentum), 1e-5);
});

test('CPU MLS-MPM P2G law isolation disables resident product event EOS pressure', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 0,
    restDensityKgPerM3: 1,
    restVolumeM3: 0,
    mechanicsDtS: 0.1
  });
  const rows = productEventRows({
    position: [1.25, 1.25, 1.25],
    massKg: 8,
    visibleMassKg: 0,
    unplacedMassKg: 8,
    velocityMPerS: [1, 2, 3],
    supportVolumeM3: 1,
    restDensityKgPerM3: 4,
    soundSpeedMPerS: 10,
    eosModelId: 2
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    dt: 0.1,
    internalPressureScale: 0,
    residentProductMass: residentProductMassFromRows(rows, { unplacedProductMassKg: 8 })
  });
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;

  nearlyEqual(projection.gridNodes[centerOffset], 8 * centerWeight, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 1], centerWeight * 8 * 1, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 2], centerWeight * 8 * 2, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 3], centerWeight * 8 * 3, 1e-5);
  assert.equal(projection.internalPressureScale, 0);
});

test('CPU MLS-MPM P2G grid projection includes APIC affine velocity contribution per node', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    affineC: [1, 0, 0, 0, 0, 0, 0, 0, 0]
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;
  const nodeMinusParticleX = -0.25;

  nearlyEqual(projection.gridNodes[centerOffset + 1], 8 * centerWeight * (2 + nodeMinusParticleX), 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 2], 8 * centerWeight * 3, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 3], 8 * centerWeight * 4, 1e-5);
});

test('CPU MLS-MPM P2G grid projection includes derived pressure stress contribution per node', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 8,
    restDensityKgPerM3: 4,
    restVolumeM3: 1,
    volumeRatioJ: 1,
    solidFlag: 0,
    soundSpeedMPerS: 10,
    eosModelId: 2,
    phaseFractions: [0, 0, 1, 0],
    mechanicsDtS: 0.1
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;
  const expectedPressurePa = 10 ** 2 * 8;
  const expectedStressScale = -0.1 * 1 * 4;
  const expectedAffineDiagonal = expectedStressScale * -expectedPressurePa;
  const expectedNodeMomentum = centerWeight * expectedAffineDiagonal * -0.25;

  nearlyEqual(projection.gridNodes[centerOffset + 1], expectedNodeMomentum, 1e-3);
  nearlyEqual(projection.gridNodes[centerOffset + 2], expectedNodeMomentum, 1e-3);
  nearlyEqual(projection.gridNodes[centerOffset + 3], expectedNodeMomentum, 1e-3);
});

test('CPU MLS-MPM P2G applies admitted gauge pressure as inward condensed-particle stress', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 8,
    restDensityKgPerM3: 8,
    restVolumeM3: 1,
    volumeRatioJ: 1,
    solidFlag: 1,
    shearModulusPa: 10,
    lameLambdaPa: 10,
    mechanicsDtS: 0.1
  });
  sphParticleState.thermo[4] = 1;
  const positive = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    externalGaugePressurePa: 100,
    externalGaugePressureEnabled: true
  });
  const negative = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    externalGaugePressurePa: -100,
    externalGaugePressureEnabled: true
  });
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const lowerNodeOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;
  const expectedInwardMomentum = centerWeight * 10;

  nearlyEqual(positive.gridNodes[lowerNodeOffset + 1], expectedInwardMomentum, 1e-5);
  nearlyEqual(positive.gridNodes[lowerNodeOffset + 2], expectedInwardMomentum, 1e-5);
  nearlyEqual(positive.gridNodes[lowerNodeOffset + 3], expectedInwardMomentum, 1e-5);
  nearlyEqual(negative.gridNodes[lowerNodeOffset + 1], -expectedInwardMomentum, 1e-5);
  nearlyEqual(summarizeGrid(positive.gridNodes).momentum[0], 0, 1e-5);
  assert.equal(positive.externalGaugePressureAppliedInStressProjection, true);
  assert.equal(positive.externalGaugePressureTarget, 'condensed-particle-solid-plus-liquid-fraction');
});

test('CPU MLS-MPM P2G external gauge pressure excludes gas and plasma carriers', () => {
  const buffers = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 8,
    restDensityKgPerM3: 8,
    restVolumeM3: 1,
    volumeRatioJ: 1,
    solidFlag: 0,
    mechanicsDtS: 0.1
  });
  const baseline = projectMlsMpmP2gGridCpu({
    ...buffers,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  for (const phaseOffset of [6, 7]) {
    buffers.sphParticleState.thermo.fill(0, 4, 8);
    buffers.sphParticleState.thermo[phaseOffset] = 1;
    const projection = projectMlsMpmP2gGridCpu({
      ...buffers,
      gridSpacingM: 1,
      boxDimsM: [2, 2, 2],
      externalGaugePressurePa: 100,
      externalGaugePressureEnabled: true
    });
    assert.deepEqual(projection.gridNodes, baseline.gridNodes);
  }
});

test('MLS-MPM P2G packs external gauge pressure into the existing uniform padding lanes', () => {
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const params = createProjectionParamsArray(
    gridSpec,
    7,
    0.001,
    0,
    1,
    null,
    101325,
    -3787.5,
    true
  );
  const view = new DataView(params);
  assert.equal(params.byteLength, 144);
  nearlyEqual(view.getFloat32(72, true), -3787.5, 1e-6);
  assert.equal(view.getUint32(76, true), 1);
  assert.match(mlsMpmP2gGridProjectionWgsl, /external_gauge_pressure_pa: f32/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /thermo1\.x \+ thermo1\.y/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /sigma\.x \+ vec3<f32>\(external_pressure/);
  assert.doesNotMatch(
    mlsMpmP2gGridProjectionWgsl,
    /schroeder_spatial_required != 0u\) \{\s*return false/
  );
});

test('CPU MLS-MPM P2G includes explicit hydrostatic pressure lane', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 4,
    restDensityKgPerM3: 4,
    restVolumeM3: 1,
    volumeRatioJ: 1,
    solidFlag: 0,
    soundSpeedMPerS: 0,
    eosModelId: 1,
    hydrostaticPressurePa: 25,
    mechanicsDtS: 0.1
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;
  const expectedStressScale = -0.1 * 1 * 4;
  const expectedAffineDiagonal = expectedStressScale * -25;
  const expectedNodeMomentum = centerWeight * expectedAffineDiagonal * -0.25;

  nearlyEqual(projection.gridNodes[centerOffset + 1], expectedNodeMomentum, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 2], expectedNodeMomentum, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 3], expectedNodeMomentum, 1e-5);
});

test('CPU MLS-MPM P2G can disable internal material EOS pressure for law isolation', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 8,
    restDensityKgPerM3: 4,
    restVolumeM3: 1,
    volumeRatioJ: 1,
    solidFlag: 0,
    soundSpeedMPerS: 10,
    eosModelId: 2,
    hydrostaticPressurePa: 25,
    mechanicsDtS: 0.1
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    internalPressureScale: 0
  });
  const summary = summarizeGrid(projection.gridNodes);

  nearlyEqual(summary.mass, 8, 1e-5);
  nearlyEqual(summary.momentum[0], 0, 1e-5);
  nearlyEqual(summary.momentum[1], 0, 1e-5);
  nearlyEqual(summary.momentum[2], 0, 1e-5);
  assert.equal(projection.internalPressureScale, 0);
});

test('optional MLS-MPM P2G grid projection returns CPU reference when WebGPU is not requested', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    preferWebGpu: false,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          throw new Error('should not request WebGPU');
        }
      }
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.gridShift, 1);
  assert.equal(execution.webgpuStatus.status, 'not-requested');
  assert.equal(execution.p2gProjectionValidation, false);
  assert.equal(execution.fullPhysicsValidation, false);
});

test('optional MLS-MPM P2G grid projection falls back when WebGPU is unavailable', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    preferWebGpu: true,
    navigatorRef: {}
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'blocked-webgpu-unavailable');
  assert.equal(execution.webgpuStatus.fallback, 'cpu-reference');
});

test('optional MLS-MPM P2G grid projection never CPU-fallbacks selected canonical intent', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const generation = canonicalSpatialEpochGenerationFixture(fakeP2gDevice());

  await assert.rejects(
    runMlsMpmP2gGridProjectionWithOptionalWebGpu({
      sphParticleState,
      mlsMpmParticleState,
      gridSpacingM: 1,
      boxDimsM: [2, 2, 2],
      preferWebGpu: true,
      navigatorRef: {},
      schroederLevelAssignment: {
        particleCount: 999,
        assignmentStrideFloats: 0,
        assignments: 'malformed-obsolete-authority'
      },
      schroederSelectedLevel: 2,
      schroederSpatialEpochGeneration: generation
    }),
    (error) => {
      assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
      assert.equal(error.status, 'canonical-spatial-webgpu-device-unavailable');
      return true;
    }
  );
});

test('optional canonical P2G preserves structured device-loss reason and message after submission', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const device = fakeP2gDevice();
  let resolveDeviceLost;
  device.lost = new Promise((resolve) => {
    resolveDeviceLost = resolve;
  });
  const generation = canonicalSpatialEpochGenerationFixture(device);
  const lossInfo = Object.freeze({
    reason: 'unknown',
    message: 'Dawn queue reset diagnostic'
  });
  let runnerCallCount = 0;

  await assert.rejects(
    runMlsMpmP2gGridProjectionWithOptionalWebGpu({
      sphParticleState,
      mlsMpmParticleState,
      gridSpacingM: 1,
      boxDimsM: [2, 2, 2],
      preferWebGpu: true,
      device,
      schroederSelectedLevel: 2,
      schroederSpatialEpochGeneration: generation,
      canonicalSpatialRequired: true,
      async webGpuRunner() {
        runnerCallCount += 1;
        resolveDeviceLost(lossInfo);
        await Promise.resolve();
        return {};
      }
    }),
    (error) => {
      assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
      assert.equal(error.status, 'canonical-spatial-webgpu-device-lost');
      assert.match(error.message, /reason=unknown/);
      assert.match(error.message, /message=Dawn queue reset diagnostic/);
      assert.equal(error.cause, lossInfo);
      return true;
    }
  );
  assert.equal(runnerCallCount, 1);
});

test('optional MLS-MPM P2G grid projection accepts a parity-passing WebGPU result', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = projectMlsMpmP2gGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        denseGridBufferAllocatedBytes: 4,
        denseAccumulatorBufferAllocatedBytes: 0,
        mechanicsFieldP2gContributionBufferAllocatedBytes: 0,
        mechanicsFieldP2gContributionBufferRequiredBytes: 864,
        mechanicsFieldP2gContributionBufferCapacityBytes: 864,
        mechanicsFieldP2gContributionBufferAllocationPerformed: false,
        mechanicsFieldP2gReductionMode: 'stable-radix-ordered-field-reduction',
        mechanicsFieldP2gReductionOrder:
          'stable-radix-equal-key-preserves-particle-stencil-candidate-order'
      };
    }
  });

  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuParity.schema, ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA);
  assert.equal(execution.webgpuParity.status, 'pass');
  assert.equal(execution.denseGridBufferAllocatedBytes, 4);
  assert.equal(execution.denseAccumulatorBufferAllocatedBytes, 0);
  assert.equal(execution.mechanicsFieldP2gContributionBufferAllocatedBytes, 0);
  assert.equal(execution.mechanicsFieldP2gContributionBufferRequiredBytes, 864);
  assert.equal(execution.mechanicsFieldP2gContributionBufferCapacityBytes, 864);
  assert.equal(
    execution.mechanicsFieldP2gContributionBufferAllocationPerformed,
    false
  );
  assert.equal(
    execution.mechanicsFieldP2gReductionMode,
    'stable-radix-ordered-field-reduction'
  );
  assert.equal(
    execution.mechanicsFieldP2gReductionOrder,
    'stable-radix-equal-key-preserves-particle-stencil-candidate-order'
  );
});

test('optional MLS-MPM P2G grid projection forwards resident product mass into WebGPU runner metadata', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const residentProductMass = residentProductMassFromRows(productEventRows());
  let seenResidentProductMass = null;
  let seenAmbientPressurePa = null;
  const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    residentProductMass,
    ambientPressurePa: 101325,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      seenResidentProductMass = args.residentProductMass;
      seenAmbientPressurePa = args.ambientPressurePa;
      const result = projectMlsMpmP2gGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        residentProductMassGridCouplingStatus: 'resident-product-mass-bound-to-p2g-grid'
      };
    }
  });

  assert.equal(seenResidentProductMass, residentProductMass);
  assert.equal(seenAmbientPressurePa, 101325);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.residentProductMassStatus, 'resident-product-mass-buffer-retained');
  assert.equal(execution.residentProductMassInputProductEventCount, 1);
  assert.equal(execution.residentProductMassCoupledEventCount, 1);
  assert.equal(execution.residentProductMassGridCouplingStatus, 'resident-product-mass-bound-to-p2g-grid');
  assert.equal(execution.residentProductMassEosCouplingStatus, 'resident-product-mass-p2g-eos-sidecar-ready');
});

test('optional MLS-MPM P2G grid projection rejects parity drift and keeps CPU output', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = projectMlsMpmP2gGridCpu(args);
      result.backend = 'webgpu';
      result.gridNodes = result.gridNodes.slice();
      result.gridNodes[0] += 1;
      return result;
    },
    parityTolerance: 1e-8
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'webgpu-parity-failed');
  assert.equal(execution.webgpuParity.status, 'fail');
  assert.ok(execution.webgpuParity.maxGridAbs > 0.5);
});

test('MLS-MPM P2G grid projection parity report is explicit and non-scientific', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const cpuReference = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const parity = createMlsMpmP2gGridProjectionParityReport({
    cpuReference,
    gpuResult: { ...cpuReference, backend: 'webgpu' }
  });

  assert.equal(parity.schema, ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA);
  assert.equal(parity.status, 'pass');
  assert.equal(parity.scientificValidation, false);
  assert.equal(parity.sphValidation, false);
  assert.equal(parity.phaseChangeValidation, false);
  assert.equal(parity.fullPhysicsValidation, false);
});

test('MLS-MPM P2G parity ignores inactive node position metadata only', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const cpuReference = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const gpuGrid = cpuReference.gridNodes.slice();
  gpuGrid[4] = 123;
  gpuGrid[5] = -456;
  gpuGrid[6] = 789;
  const parity = createMlsMpmP2gGridProjectionParityReport({
    cpuReference,
    gpuResult: { ...cpuReference, backend: 'webgpu', gridNodes: gpuGrid },
    tolerance: 1e-8
  });

  assert.equal(cpuReference.gridNodes[0], 0);
  assert.equal(cpuReference.gridNodes[7], 0);
  assert.equal(parity.status, 'pass');
  assert.equal(parity.maxGridAbs, 0);
  assert.equal(parity.ignoredInactivePositionMaxAbs, 789);
  assert.equal(parity.ignoredInactivePositionCount, 3);
});
