import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_SCHEMA,
  ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
  ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA,
  ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_SOLVER_TASK_BRIDGE_SCHEMA,
  ULG_MLS_MPM_WEBGPU_OCEAN_HOT_LOOP_BUDGET_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_SPH_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA,
  ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA,
  SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS,
  ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA,
  ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
  ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA,
  createSphThermalPhaseStageComputeTask,
  createSphSpatialGasLedgerProducerStageComputeTask,
  createSphGasCellEosProducerStageComputeTask,
  createSphPressureInterfaceStageComputeTask,
  createMlsMpmMechanicsGridUpdateStageComputeTask,
  createMlsMpmResidentStepComputeTask,
  createMlsMpmResidentStepsComputeTask,
  createMlsMpmResidentStepGpuFenceReport,
  destroyMlsMpmResidentStepBuffers,
  destroyMlsMpmResidentStepsBuffers,
  runSphThermalPhaseStageComputeTask,
  runSphSpatialGasLedgerProducerStageComputeTask,
  runSphGasCellEosProducerStageComputeTask,
  runSphPressureInterfaceStageComputeTask,
  runMlsMpmMechanicsGridUpdateStageComputeTask,
  runMlsMpmResidentStepComputeTask,
  runMlsMpmResidentStepsComputeTask,
  runMlsMpmResidentStepsWithOptionalWebGpu,
  runMlsMpmResidentStepWithOptionalWebGpu,
  createSphReactionProductStageComputeTask,
  runSphReactionProductStageComputeTask,
  runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks,
  runMlsMpmMechanicsP2gStageComputeTask,
  runMlsMpmMechanicsG2pStageComputeTask,
  submitMlsMpmResidentStepComputeTask,
  submitMlsMpmResidentStepsComputeTask,
  summarizeMlsMpmResidentHotLoopBudget
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import { projectMlsMpmP2gGridCpu } from '../src/runtime/sph/sphGridGpuKernel.js';
import {
  runMlsMpmGridUpdateWithOptionalWebGpu,
  updateMlsMpmGridCpu
} from '../src/runtime/sph/sphGridUpdateGpuKernel.js';
import { reconstructMlsMpmG2pCpu } from '../src/runtime/sph/sphG2pGpuKernel.js';
import {
  MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS,
  runMlsMpmResidentSummaryWebGpu
} from '../src/runtime/sph/sphMlsMpmGpuSummary.js';
import { ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA } from '../src/runtime/sph/sphReactionGpuSummary.js';
import { tagResidentProductMassDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import { buildMlsMpmMechanicsMaterialTable } from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import {
  RESIDENT_STATE_FAMILIES,
  ULG_RESIDENT_STATE_AUTHORITY_LEDGER_SCHEMA
} from '../src/runtime/residentStateAuthority.js';

function manualBuffers({
  position = [1.25, 1.25, 1.25],
  velocity = [2, 0, 0],
  massKg = 8,
  smoothingLengthM = 1,
  restDensityKgPerM3 = 8,
  mechanicsDtS = 0.1
} = {}) {
  const state = new Float32Array([
    position[0], position[1], position[2], massKg,
    velocity[0], velocity[1], velocity[2], 123
  ]);
  const thermo = new Float32Array(12);
  thermo[3] = restDensityKgPerM3;
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  mechanics[18] = 1;
  mechanics[19] = massKg / restDensityKgPerM3;
  mechanics[20] = 1;
  mechanics[21] = 1;
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
      gridCflFactor: 10,
      gravityMPerS2: [0, 0, 0],
      mechanics
    }
  };
}

function nearlyEqual(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

const MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES = MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;

function nodeOffset(gridSpec, nodeI, nodeJ, nodeK, strideFloats) {
  const [, gny, gnz] = gridSpec.gridDims;
  return (((nodeI + gridSpec.gridShift) * gny + (nodeJ + gridSpec.gridShift)) * gnz + (nodeK + gridSpec.gridShift))
    * strideFloats;
}

function pressureInterfaceForceSolverFixture({
  centroid = [1, 1, 1],
  force = [8, 0, 0],
  reactionForce = [-8, 0, 0],
  pressurePa = 100000,
  status = 1,
  forceApplicationStatus = 'solver-ready-not-applied',
  gridForceApplicationApproved = false
} = {}) {
  const forceRowValues = new Float32Array(SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length);
  forceRowValues.set([
    0, 1, 2, 0,
    centroid[0], centroid[1], centroid[2], 1,
    force[0], force[1], force[2],
    reactionForce[0], reactionForce[1], reactionForce[2],
    pressurePa, status
  ]);
  return {
    schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
    status: 'pressure-interface-force-solver-ready',
    forceCouplingStatus: 'pressure-force-solver-ready-not-applied',
    forceApplicationStatus,
    gridForceApplicationApproved,
    forceApplicationTarget: 'pending-mls-mpm-grid-force-consumer',
    forceRowCount: 1,
    forceRowValues
  };
}

function pressureInterfaceGridForceAdmissionFixture({
  forceRowCount = 1,
  sourceHotBufferKey = 'ulg:test:pressure-interface-admitted-hot-buffer'
} = {}) {
  return {
    schema: 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0',
    status: 'pressure-interface-grid-force-consumption-approved',
    gridForceApplicationApproved: true,
    publicationStatus: 'worker-retained-pressure-interface-output-admitted',
    hotBufferKey: sourceHotBufferKey,
    pressureInterfaceForceRowCount: forceRowCount,
    outputFamilies: ['pressure-interface-force-rows']
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

function fakeBufferTracker() {
  return {
    destroyed: 0,
    buffer(label) {
      return {
        label,
        destroy: () => {
          this.destroyed += 1;
        }
      };
    }
  };
}

function fakeGpuResidentLaneManager() {
  const activeLeases = new Map();
  const calls = {
    acquire: [],
    complete: [],
    reject: []
  };
  let leaseOrdinal = 0;
  const fenceSatisfied = (status) => [
    'gpu-fence-completed',
    'queue-work-completed',
    'readback-map-completed',
    'ordered-before-consumer-queue-completed'
  ].includes(String(status || ''));
  return {
    calls,
    get activeLeaseCount() {
      return activeLeases.size;
    },
    acquireLease(spec) {
      const leaseId = `${spec.laneId || 'gpu-lane'}:lease:${++leaseOrdinal}`;
      const lease = {
        schema: 'peercompute.compute.gpu-resident-lane-lease.v0',
        leaseId,
        laneId: spec.laneId,
        stateKey: spec.stateKey,
        domainKey: spec.domainKey,
        solverId: spec.solverId,
        taskId: spec.taskId,
        owner: spec.owner,
        readFamilies: [...(spec.readFamilies || [])],
        writeFamilies: [...(spec.writeFamilies || [])],
        retainedBufferRefs: [...(spec.retainedBufferRefs || [])],
        queueFencePolicy: spec.queueFencePolicy,
        copyBudget: { ...(spec.copyBudget || {}) },
        status: 'active'
      };
      activeLeases.set(leaseId, lease);
      calls.acquire.push({ spec: { ...spec, copyBudget: { ...(spec.copyBudget || {}) } }, lease });
      return { ...lease, readFamilies: [...lease.readFamilies], writeFamilies: [...lease.writeFamilies], retainedBufferRefs: [...lease.retainedBufferRefs] };
    },
    completeLease(leaseId, options = {}) {
      const lease = activeLeases.get(leaseId);
      if (!lease) throw new Error(`unknown fake GPU resident lane lease: ${leaseId}`);
      const retainedBufferRefs = [...(options.retainedBufferRefs || lease.retainedBufferRefs || [])];
      const gpuFence = {
        schema: 'peercompute.compute.gpu-fence-report.v0',
        status: options.status || options.queueCompletionStatus || 'queue-work-completed',
        method: options.method || options.queueCompletionMethod || 'queue.onSubmittedWorkDone',
        fenceSatisfied: fenceSatisfied(options.status || options.queueCompletionStatus || 'queue-work-completed'),
        required: true,
        laneId: lease.laneId,
        stateKey: lease.stateKey,
        queueFencePolicy: lease.queueFencePolicy,
        queueCompletionStatus: options.queueCompletionStatus || options.status || null,
        queueCompletionMethod: options.queueCompletionMethod || options.method || null,
        retainedBufferRefs,
        source: options.source || 'fake-gpu-resident-lane-manager'
      };
      const completedLease = {
        ...lease,
        status: gpuFence.fenceSatisfied ? 'completed' : 'completed-unsatisfied-fence',
        retainedBufferRefs,
        gpuFence
      };
      const execution = {
        schema: 'peercompute.compute.gpu-resident-lane-execution.v0',
        lease: completedLease,
        gpuFence,
        lane: {
          laneId: lease.laneId,
          stateKey: lease.stateKey,
          retainedBufferRefs,
          lastFence: gpuFence
        }
      };
      activeLeases.delete(leaseId);
      calls.complete.push({ leaseId, options: { ...options, retainedBufferRefs }, execution });
      return execution;
    },
    rejectLease(leaseId, reason) {
      const lease = activeLeases.get(leaseId);
      activeLeases.delete(leaseId);
      calls.reject.push({ leaseId, reason, lease });
      return {
        schema: 'peercompute.compute.gpu-resident-lane-execution.v0',
        lease: lease ? { ...lease, status: 'rejected', releaseReason: reason } : null,
        gpuFence: null,
        lane: lease ? { laneId: lease.laneId, stateKey: lease.stateKey } : null
      };
    }
  };
}

function noFullReadbackResidentStepFixture() {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const options = {
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    p2gRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-unread'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-unread'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        queueCompletionStatus: 'queue-work-completed',
        queueCompletionMethod: 'queue.onSubmittedWorkDone',
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-unread'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-unread'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  };
  return { buffers, tracker, sourceThermoBuffer, options };
}

function residentProductMassHandle({
  label,
  rowCount,
  byteLength,
  unplacedProductMassKg = rowCount,
  unplacedGasProductMassKg = 0,
  generationCount = 1,
  sourceRowCounts = null,
  sourceByteLengths = null,
  gasSpeciesRows = []
} = {}) {
  const productEventBuffer = {
    label,
    destroyed: false,
    destroy() {
      this.destroyed = true;
    }
  };
  let destroyCalls = 0;
  const gasSpeciesLedger = gasSpeciesRows.length > 0
    ? {
        schema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
        status: 'gas-species-compact-ledger-ready',
        records: gasSpeciesRows.map((row, index) => ({
          status: 'ready',
          statusCode: 1,
          gasProductIndex: index,
          eventCount: row.eventCount ?? 1,
          visibleMassKg: row.visibleMassKg ?? 0,
          unplacedMassKg: row.unplacedMassKg ?? row.massKg ?? 0,
          ...row
        })),
        bySpecies: Object.fromEntries(gasSpeciesRows.map((row, index) => [
          String(row.material).toLowerCase(),
          {
            material: String(row.material).toLowerCase(),
            materialId: row.materialId ?? index + 1,
            massKg: row.massKg ?? 0,
            moles: row.moles ?? 0,
            visibleMassKg: row.visibleMassKg ?? 0,
            unplacedMassKg: row.unplacedMassKg ?? row.massKg ?? 0,
            eventCount: row.eventCount ?? 1,
            gasProductIndices: [index],
            fullParticleReadbackPerformed: false
          }
        ])),
        recordCount: gasSpeciesRows.length,
        speciesCount: gasSpeciesRows.length,
        fullParticleReadbackPerformed: false
      }
    : null;
  const handle = {
    schema: ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA,
    status: 'resident-product-mass-buffer-retained',
    source: 'test-resident-product-event-buffer',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: byteLength,
    productEventRowCount: rowCount,
    productEventActiveEventCount: rowCount,
    productEventStrideFloats: 32,
    productEventStrideBytes: 128,
    productEventGenerationCount: generationCount,
    productEventSourceRowCounts: sourceRowCounts ? [...sourceRowCounts] : [rowCount],
    productInventorySchema: 'peercompute.ulg.sph-gpu-reaction-product-inventory.v0',
    productInventoryCount: rowCount,
    gasSpeciesLedgerSchema: gasSpeciesLedger?.schema ?? null,
    gasSpeciesLedger,
    gasSpeciesLedgerCount: gasSpeciesLedger?.recordCount ?? 0,
    gasSpeciesReadbackByteLength: gasSpeciesLedger ? gasSpeciesLedger.recordCount * 32 : 0,
    sealedBoxGasProductMoles: gasSpeciesRows.reduce((sum, row) => sum + (Number(row.moles) || 0), 0),
    visibleProductMassKg: 0,
    unplacedProductMassKg,
    unplacedGasProductMassKg,
    consumeMassPolicy: 'unplaced-product-mass-only',
    visibleMassAlreadyInParticleBuffers: true,
    mergeSourceProductEventBufferCount: sourceByteLengths?.length ?? generationCount,
    mergeSourceProductEventRowCounts: sourceRowCounts ? [...sourceRowCounts] : [rowCount],
    mergeSourceProductEventBufferByteLengths: sourceByteLengths ? [...sourceByteLengths] : [byteLength],
    eosCouplingStatus: 'resident-product-mass-eos-sidecar-ready',
    forceCouplingStatus: 'strict-force-coupling-blocked',
    destroyResidentProductMassBuffers() {
      destroyCalls += 1;
      productEventBuffer.destroy();
    },
    scientificValidation: false,
    chemistryValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
  Object.defineProperty(handle, 'destroyCalls', {
    get() {
      return destroyCalls;
    }
  });
  return handle;
}

function compactSpatialGasRowsFixture(rows = [
  {
    positionM: [0.5, 1, 1],
    materialId: 7,
    massKg: 0.04,
    moles: 100,
    temperatureK: 300,
    supportVolumeM3: 1,
    productTermIndex: 0,
    sourceRowIndex: 0
  },
  {
    positionM: [1.5, 1, 1],
    materialId: 7,
    massKg: 0.06,
    moles: 200,
    temperatureK: 300,
    supportVolumeM3: 1,
    productTermIndex: 0,
    sourceRowIndex: 1
  }
]) {
  const values = new Float32Array(rows.length * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS);
  rows.forEach((row, index) => {
    const offset = index * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS;
    values[offset] = row.positionM[0];
    values[offset + 1] = row.positionM[1];
    values[offset + 2] = row.positionM[2];
    values[offset + 3] = row.materialId;
    values[offset + 4] = row.massKg;
    values[offset + 5] = row.moles;
    values[offset + 6] = row.temperatureK;
    values[offset + 7] = row.supportVolumeM3;
    values[offset + 8] = row.productTermIndex;
    values[offset + 9] = row.sourceRowIndex ?? index;
    values[offset + 10] = row.statusCode ?? 1;
    values[offset + 11] = row.routingId ?? 1;
  });
  return values;
}

function productEventRowsFixture(rows = [
  {
    positionM: [0.5, 0.5, 0.5],
    materialId: 3022823,
    massKg: 0.01,
    moles: 5,
    temperatureK: 293.15,
    supportVolumeM3: 0,
    productTermIndex: 0,
    sourceParticleIndex: 0
  },
  {
    positionM: [3.5, 3.5, 3.5],
    materialId: 3022823,
    massKg: 0.02,
    moles: 10,
    temperatureK: 293.15,
    supportVolumeM3: 0,
    productTermIndex: 0,
    sourceParticleIndex: 1
  }
]) {
  const stride = 32;
  const values = new Float32Array(rows.length * stride);
  rows.forEach((row, index) => {
    const offset = index * stride;
    values[offset] = row.positionM[0];
    values[offset + 1] = row.positionM[1];
    values[offset + 2] = row.positionM[2];
    values[offset + 3] = row.massKg;
    values[offset + 4] = row.materialId;
    values[offset + 5] = row.productTermIndex;
    values[offset + 6] = row.reactionIndex ?? 0;
    values[offset + 7] = row.sourceParticleIndex ?? index;
    values[offset + 8] = row.partnerParticleIndex ?? -1;
    values[offset + 9] = row.moles;
    values[offset + 10] = row.routingId ?? 1;
    values[offset + 11] = row.phaseId ?? 2;
    values[offset + 12] = row.visibleMassKg ?? 0;
    values[offset + 13] = row.unplacedMassKg ?? row.massKg;
    values[offset + 14] = row.coefficient ?? 1;
    values[offset + 15] = row.molarMassKgPerMol ?? (row.massKg / row.moles);
    values[offset + 16] = row.temperatureK;
    values[offset + 17] = row.restDensityKgPerM3 ?? 0;
    values[offset + 18] = row.statusCode ?? 1;
    values[offset + 20] = row.velocityMPerS?.[0] ?? 0;
    values[offset + 21] = row.velocityMPerS?.[1] ?? 0;
    values[offset + 22] = row.velocityMPerS?.[2] ?? 0;
    values[offset + 23] = row.supportVolumeM3 ?? 0;
  });
  return values;
}

function fakeSummaryDevice(summaryValues) {
  const createdBuffers = [];
  const bindGroups = [];
  const dispatches = [];
  const indirectDispatches = [];
  const shaderModules = [];
  const copies = [];
  const clears = [];
  const submissions = [];
  const writes = [];
  return {
    createdBuffers,
    bindGroups,
    dispatches,
    indirectDispatches,
    shaderModules,
    copies,
    clears,
    submissions,
    writes,
    queue: {
      writeBuffer(buffer, offset, data) {
        const copy = data?.buffer
          ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
          : null;
        buffer.lastWrite = copy;
        writes.push({ label: buffer.label, offset, byteLength: data.byteLength, data: copy });
      },
      async onSubmittedWorkDone() {},
      submit(commands) {
        submissions.push(commands);
      }
    },
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        },
        async mapAsync() {},
        getMappedRange() {
          return summaryValues.buffer.slice(
            summaryValues.byteOffset,
            summaryValues.byteOffset + summaryValues.byteLength
          );
        },
        unmap() {
          this.unmapped = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule({ code }) {
      const module = { code };
      shaderModules.push(module);
      return module;
    },
    createComputePipeline({ compute }) {
      return {
        compute,
        getBindGroupLayout(index) {
          return { index, entryPoint: compute.entryPoint };
        }
      };
    },
    createBindGroup({ layout, entries }) {
      const bindGroup = { layout, entries };
      bindGroups.push(bindGroup);
      return bindGroup;
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          return {
            setPipeline(pipeline) {
              this.pipeline = pipeline;
            },
            setBindGroup(index, bindGroup) {
              this.bindGroup = { index, bindGroup };
            },
            dispatchWorkgroups(count) {
              dispatches.push({ count, pipeline: this.pipeline, bindGroup: this.bindGroup?.bindGroup });
            },
            dispatchWorkgroupsIndirect(buffer, offset) {
              const data = buffer.lastWrite ? new Uint32Array(buffer.lastWrite) : new Uint32Array();
              indirectDispatches.push({
                buffer,
                offset,
                workgroupCountX: data[0] ?? null,
                workgroupCountY: data[1] ?? null,
                workgroupCountZ: data[2] ?? null,
                pipeline: this.pipeline,
                bindGroup: this.bindGroup?.bindGroup
              });
            },
            end() {
              this.ended = true;
            }
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          copies.push({ source, sourceOffset, destination, destinationOffset, size });
        },
        clearBuffer(buffer, offset, size) {
          clears.push({ buffer, offset, size });
        },
        finish() {
          return {
            dispatches: [...dispatches],
            indirectDispatches: [...indirectDispatches],
            copies: [...copies],
            clears: [...clears]
          };
        }
      };
    }
  };
}

test('MLS-MPM resident step runs the full CPU reference chain when WebGPU is not requested', async () => {
  const buffers = manualBuffers();
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: false,
    boxDimsM: [3, 3, 3]
  });

  assert.equal(step.schema, ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA);
  assert.equal(step.stepSchema, ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA);
  assert.equal(step.backend, 'cpu-reference');
  assert.equal(step.status, 'resident-step-cpu-or-fallback');
  assert.equal(step.stageBackends.p2g, 'cpu-reference');
  assert.equal(step.stageBackends.gridUpdate, 'cpu-reference');
  assert.equal(step.stageBackends.g2p, 'cpu-reference');
  assert.equal(step.readbackMode, 'full-parity-readback');
  assert.equal(step.normalHotLoopReadbackFree, false);
  assert.equal(step.gpuAuthoritativeState, false);
  assert.equal(step.residentBuffersRetained, false);
  assert.equal(step.residentAuthorityLedger.schema, ULG_RESIDENT_STATE_AUTHORITY_LEDGER_SCHEMA);
  assert.equal(step.residentAuthorityLedgerStatus, 'resident-authority-ledger-ready');
  assert.equal(step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage, 'g2p');
  assert.equal(step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].ownerStage, 'g2p');
  assert.equal(step.diagnostics.residentAuthorityParticleOwner, 'g2p');
  assert.equal(step.diagnostics.particleCount, 1);
  assert.equal(step.diagnostics.sourceMassKg, 8);
  assert.equal(step.diagnostics.massDeltaKg, 0);
  assert.ok(step.state instanceof Float32Array);
  assert.ok(step.mechanics instanceof Float32Array);
  assert.equal(step.fullPhysicsValidation, false);
});

test('MLS-MPM resident step preserves shifted grid origin into G2P', async () => {
  const buffers = manualBuffers({
    position: [2.5, 2.5, 2.5],
    velocity: [0, 0, 0],
    smoothingLengthM: 1,
    mechanicsDtS: 0.01
  });
  const gravity = [0, -9.80665, 0];
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: false,
    gridSpacingM: 1,
    boxDimsM: [3, 3, 3],
    dt: 0.01,
    gravityMPerS2: gravity,
    cflFactor: 10
  });

  assert.equal(step.gridUpdate.gridShift, 1);
  assert.equal(step.g2pReconstruction.gridShift, 1);
  nearlyEqual(step.state[5], gravity[1] * 0.01, 1e-6);
  nearlyEqual(step.state[1], 2.5 + gravity[1] * 0.01 * 0.01, 1e-6);
});

test('MLS-MPM grid update blocks pressure-interface force rows without admitted grid-force approval', () => {
  const buffers = manualBuffers({
    position: [2, 2, 2],
    velocity: [0, 0, 0],
    mechanicsDtS: 0.25
  });
  const projection = projectMlsMpmP2gGridCpu({
    ...buffers,
    gridSpacingM: 1,
    boxDimsM: [5, 5, 5]
  });
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture({
    centroid: [2, 2, 2],
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  const update = updateMlsMpmGridCpu({
    p2gGridProjection: projection,
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10,
    pressureInterfaceForceSolver
  });

  assert.equal(update.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(update.pressureInterfaceGridForceAdmissionApproved, false);
  assert.equal(update.pressureInterfaceGridForceAdmissionStatus, 'pressure-interface-grid-force-consumption-blocked');
  assert.equal(update.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-blocked-not-approved');
  assert.equal(update.pressureInterfaceForceConsumerStatus, 'blocked-pressure-force-solver-not-approved-for-grid-application');
  assert.equal(update.pressureInterfaceForceRowCount, 0);
  assert.equal(update.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0);
});

test('MLS-MPM grid update consumes admitted pressure-interface force rows as grid impulses', () => {
  const buffers = manualBuffers({
    position: [2, 2, 2],
    velocity: [0, 0, 0],
    mechanicsDtS: 0.25
  });
  const projection = projectMlsMpmP2gGridCpu({
    ...buffers,
    gridSpacingM: 1,
    boxDimsM: [5, 5, 5]
  });
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture({
    centroid: [2, 2, 2],
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  const pressureInterfaceGridForceAdmission = pressureInterfaceGridForceAdmissionFixture();
  const update = updateMlsMpmGridCpu({
    p2gGridProjection: projection,
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10,
    pressureInterfaceForceSolver,
    pressureInterfaceGridForceAdmission
  });
  const sourceCenterOffset = nodeOffset(projection, 2, 2, 2, projection.gridNodeStrideFloats);
  const centerOffset = nodeOffset(update, 2, 2, 2, update.gridNodeStrideFloats);
  const centerWeight = 0.75 ** 3;
  const expectedCenterImpulse = 0.25 * 8 * centerWeight;
  const expectedCenterVelocity = expectedCenterImpulse / projection.gridNodes[sourceCenterOffset];

  assert.equal(update.schema, ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA);
  assert.equal(update.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(update.pressureInterfaceForceSolverStatus, 'pressure-interface-force-solver-ready');
  assert.equal(update.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(update.pressureInterfaceGridForceAdmissionStatus, 'pressure-interface-grid-force-consumption-approved');
  assert.equal(update.pressureInterfaceGridForceAdmissionSourceHotBufferKey, 'ulg:test:pressure-interface-admitted-hot-buffer');
  assert.equal(update.pressureInterfaceForceCouplingStatus, 'pressure-force-solver-ready-not-applied');
  assert.equal(update.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-applied');
  assert.equal(update.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-consumed');
  assert.equal(update.pressureInterfaceAppliedImpulseSource, 'grid-node-distributed-impulse');
  assert.equal(update.pressureInterfaceImpulseProofStatus, 'actual-grid-node-impulse');
  assert.equal(update.pressureInterfaceForceRowCount, 1);
  nearlyEqual(update.pressureInterfaceAppliedImpulseNSeconds[0], 2, 1e-5);
  nearlyEqual(update.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 2, 1e-5);
  nearlyEqual(update.updatedGridNodes[centerOffset], projection.gridNodes[sourceCenterOffset], 1e-5);
  nearlyEqual(update.updatedGridNodes[centerOffset + 1], expectedCenterVelocity, 1e-5);
  nearlyEqual(update.updatedGridNodes[centerOffset + 2], 0, 1e-6);
  nearlyEqual(update.updatedGridNodes[centerOffset + 3], 0, 1e-6);
});

test('MLS-MPM grid update optional WebGPU path forwards pressure force rows', async () => {
  const buffers = manualBuffers({
    position: [1, 1, 1],
    velocity: [0, 0, 0],
    mechanicsDtS: 0.25
  });
  const projection = projectMlsMpmP2gGridCpu({
    ...buffers,
    gridSpacingM: 1,
    boxDimsM: [3, 3, 3]
  });
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture({
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  const pressureInterfaceGridForceAdmission = pressureInterfaceGridForceAdmissionFixture();
  const pressureInterfaceForceRowsBuffer = { label: 'pressure-interface-force-rows' };
  let runnerCalls = 0;
  const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection: projection,
    pressureInterfaceForceRowsBuffer,
    pressureInterfaceForceSolver,
    pressureInterfaceGridForceAdmission,
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    webGpuRunner(args) {
      runnerCalls += 1;
      assert.equal(args.pressureInterfaceForceRowsBuffer, pressureInterfaceForceRowsBuffer);
      assert.equal(args.pressureInterfaceForceSolver, pressureInterfaceForceSolver);
      assert.equal(args.pressureInterfaceGridForceAdmission, pressureInterfaceGridForceAdmission);
      const result = updateMlsMpmGridCpu(args);
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(runnerCalls, 1);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(execution.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(execution.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-applied');
  assert.equal(execution.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-consumed');
  assert.equal(execution.pressureInterfaceAppliedImpulseSource, 'grid-node-distributed-impulse');
  assert.equal(execution.pressureInterfaceImpulseProofStatus, 'actual-grid-node-impulse');
  assert.equal(execution.pressureInterfaceForceRowCount, 1);
  nearlyEqual(execution.pressureInterfaceAppliedImpulseNSeconds[0], 2, 1e-5);
});

test('MLS-MPM resident step routes pressure-interface force solver into grid update', async () => {
  const buffers = manualBuffers({
    position: [1, 1, 1],
    velocity: [0, 0, 0],
    mechanicsDtS: 0.25
  });
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture({
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  const pressureInterfaceGridForceAdmission = pressureInterfaceGridForceAdmissionFixture();
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: false,
    boxDimsM: [3, 3, 3],
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    cflFactor: 10,
    pressureInterfaceForceSolver,
    pressureInterfaceGridForceAdmission
  });

  assert.equal(step.schema, ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA);
  assert.equal(step.gridUpdate.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(step.gridUpdate.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(step.gridUpdate.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-applied');
  assert.equal(step.gridUpdate.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-consumed');
  assert.equal(step.gridUpdate.pressureInterfaceAppliedImpulseSource, 'grid-node-distributed-impulse');
  assert.equal(step.gridUpdate.pressureInterfaceImpulseProofStatus, 'actual-grid-node-impulse');
  assert.equal(step.pressureInterfaceForceSolver, pressureInterfaceForceSolver);
  assert.equal(step.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(step.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(step.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-applied');
  assert.equal(step.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-consumed');
  assert.equal(step.pressureInterfaceAppliedImpulseSource, 'grid-node-distributed-impulse');
  assert.equal(step.pressureInterfaceImpulseProofStatus, 'actual-grid-node-impulse');
  assert.equal(step.diagnostics.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-applied');
  assert.equal(step.diagnostics.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(step.diagnostics.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-consumed');
  assert.equal(step.diagnostics.pressureInterfaceAppliedImpulseSource, 'grid-node-distributed-impulse');
  assert.equal(step.diagnostics.pressureInterfaceImpulseProofStatus, 'actual-grid-node-impulse');
  assert.equal(step.diagnostics.pressureInterfaceForceRowCount, 1);
  nearlyEqual(step.diagnostics.pressureInterfaceAppliedImpulseNSeconds[0], 2, 1e-5);
});

test('MLS-MPM grid-update stage task consumes admitted pressure-interface rows with evidence', async () => {
  const buffers = manualBuffers({
    position: [1, 1, 1],
    velocity: [0, 0, 0],
    mechanicsDtS: 0.25
  });
  const projection = projectMlsMpmP2gGridCpu({
    ...buffers,
    gridSpacingM: 1,
    boxDimsM: [3, 3, 3]
  });
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture({
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  const pressureInterfaceGridForceAdmission = pressureInterfaceGridForceAdmissionFixture();
  const task = createMlsMpmMechanicsGridUpdateStageComputeTask({
    p2gGridProjection: projection,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:grid-update-pressure-admitted',
    pressureInterfaceForceSolver,
    pressureInterfaceGridForceAdmission,
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [3, 3, 3],
    cflFactor: 10,
    preferWebGpu: false
  });

  assert.equal(task.schema, ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(task.data.pressureInterfaceForceSolver, pressureInterfaceForceSolver);
  assert.equal(task.data.pressureInterfaceGridForceAdmission, pressureInterfaceGridForceAdmission);

  const result = await runMlsMpmMechanicsGridUpdateStageComputeTask(task.data);

  assert.equal(result.computeTaskResultSchema, ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(result.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(result.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-applied');
  assert.equal(result.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-consumed');
  assert.equal(result.pressureInterfaceImpulseProofStatus, 'actual-grid-node-impulse');
  assert.equal(result.mechanicsGridUpdateStageTaskEvidence.passed, true);
  assert.equal(result.mechanicsGridUpdateStageTaskEvidence.pressureInterface.suppressed, false);
  assert.equal(result.mechanicsGridUpdateStageTaskEvidence.pressureInterface.admittedAndApproved, true);
  assert.equal(result.mechanicsGridUpdateStageTaskAuthority.authoritativeStateMutation, false);
});

test('MLS-MPM resident summary WebGPU runner uses two-pass compact readback', async () => {
  const particleCount = 65;
  const gridNodeCount = 130;
  const summaryValues = new Float32Array([
    particleCount, gridNodeCount, 17, 12,
    12, 0, 4, 5,
    6, 7, 8, 9,
    3, 3, 3, 2.5,
    0.125, 0.9, 1.1, 1,
    5, 4, 2, 1,
    450, 273, 900, 65,
    0, 65, 12, 1,
    1, 2, 3, 4,
    5, 6, -1, -2,
    -3, 7, 8, 9,
    0, 0.5, 1, 10,
    11, 12, 1, 1,
    12, 12, 0, 0,
    1, 0, 10, 10,
    20, 12, 1, 2,
    3, -1, -2, -3,
    7, 8, 9, 2.5,
    4, 4, 5, 6,
    0, 0.5, 1, 10,
    11, 12, 1.5, 0
  ]);
  const device = fakeSummaryDevice(summaryValues);
  const tracker = fakeBufferTracker();
  const sourceStateBuffer = tracker.buffer('source-state');
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const retainedThermoBuffer = tracker.buffer('retained-thermal-thermo');
  const sourceMechanicsBuffer = tracker.buffer('source-mechanics');
  const nextStateBuffer = tracker.buffer('next-state');
  const nextMechanicsBuffer = tracker.buffer('next-mechanics');
  const updatedGridBuffer = tracker.buffer('updated-grid');
  const summary = await runMlsMpmResidentSummaryWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state: new Float32Array(particleCount * 8)
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics: new Float32Array(particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length)
    },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: sourceStateBuffer,
      thermoBuffer: sourceThermoBuffer
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: sourceMechanicsBuffer
    },
    gridUpdate: {
      gridNodeCount,
      gpuResult: { updatedGridBuffer }
    },
    g2pReconstruction: {
      stateBuffer: nextStateBuffer,
      mechanicsBuffer: nextMechanicsBuffer
    },
    thermalStep: {
      result: {
        thermoBuffer: retainedThermoBuffer
      }
    }
  });

  assert.equal(summary.status, 'compact-summary-ready');
  assert.equal(summary.reductionStrategy, 'two-pass-workgroup-reduction');
  assert.equal(summary.compactPartialSummaryCount, 5);
  assert.equal(summary.compactPartialSummaryByteLength, 5 * MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(summary.compactReductionWorkgroupSize, 32);
  assert.equal(summary.compactReadbackByteLength, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(summary.compactReadbackFloatCount, MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
  assert.equal(summary.queueCompletionStatus, 'readback-map-completed');
  assert.equal(summary.queueCompletionMethod, 'mapAsync(readback-buffer)');
  assert.equal(summary.timing.schema, 'peercompute.ulg.mls-mpm-resident-summary-timing.v0');
  assert.equal(summary.timing.queueFenceAttribution, 'mapAsync(readback-buffer)-may-include-prior-queued-resident-work');
  assert.equal(summary.timing.compactReadbackByteLength, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(summary.timing.summaryKernelDispatchCount, 2);
  assert.equal(summary.timing.summaryWorkgroupCount, 6);
  assert.equal(Number.isFinite(summary.timing.mapAsyncWaitMs), true);
  assert.equal(summary.mapAsyncWaitMs, summary.timing.mapAsyncWaitMs);
  assert.equal(summary.queueFenceAttribution, summary.timing.queueFenceAttribution);
  assert.equal(summary.sourceStateBufferMode, 'borrowed-webgpu-upload');
  assert.equal(summary.thermoBufferMode, 'retained-thermal-output');
  assert.equal(summary.sourceMechanicsBufferMode, 'borrowed-webgpu-upload');
  assert.equal(summary.summaryScope, 'full');
  assert.equal(summary.gridNodeScanCount, gridNodeCount);
  assert.equal(summary.gridNodeScanSkipped, false);
  assert.equal(summary.activeGridNodeCountAvailable, true);
  assert.equal(summary.activeGridNodeSummaryStatus, 'active-grid-node-summary-ready');
  assert.equal(summary.activeGridNodeCount, 17);
  assert.equal(summary.massDeltaKg, 0);
  assert.deepEqual(summary.momentumDeltaKgMPerS, [3, 3, 3]);
  assert.deepEqual(summary.sourceCenterOfMassM, [1, 2, 3]);
  assert.deepEqual(summary.nextCenterOfMassM, [4, 5, 6]);
  assert.deepEqual(summary.centerOfMassDeltaM, [3, 3, 3]);
  assert.deepEqual(summary.sourcePositionBoundsM, {
    status: 'position-bounds-ready',
    min: [-1, -2, -3],
    max: [7, 8, 9],
    massKg: 12
  });
  assert.deepEqual(summary.nextPositionBoundsM, {
    status: 'position-bounds-ready',
    min: [0, 0.5, 1],
    max: [10, 11, 12],
    massKg: 12
  });
  assert.equal(summary.cohortSummaryAvailable, true);
  assert.equal(summary.cohortDiagnostics.status, 'cohort-summary-ready');
  assert.equal(summary.cohortDiagnostics.readbackRequired, false);
  assert.equal(summary.cohortDiagnostics.base.status, 'cohort-summary-ready');
  assert.equal(summary.cohortDiagnostics.base.startIndex, 0);
  assert.equal(summary.cohortDiagnostics.base.endIndex, 10);
  assert.equal(summary.cohortDiagnostics.base.count, 10);
  assert.equal(summary.cohortDiagnostics.base.massKg, 12);
  assert.deepEqual(summary.cohortDiagnostics.base.centerOfMassM, [1, 2, 3]);
  assert.deepEqual(summary.cohortDiagnostics.base.boundsM.min, [-1, -2, -3]);
  assert.deepEqual(summary.cohortDiagnostics.base.boundsM.max, [7, 8, 9]);
  assert.equal(summary.cohortDiagnostics.base.maxSpeedMPerS, 2.5);
  assert.equal(summary.cohortDiagnostics.drop.status, 'cohort-summary-ready');
  assert.equal(summary.cohortDiagnostics.drop.startIndex, 10);
  assert.equal(summary.cohortDiagnostics.drop.endIndex, 20);
  assert.equal(summary.cohortDiagnostics.drop.count, 10);
  assert.equal(summary.cohortDiagnostics.drop.massKg, 4);
  assert.deepEqual(summary.cohortDiagnostics.drop.centerOfMassM, [4, 5, 6]);
  assert.deepEqual(summary.cohortDiagnostics.drop.boundsM.min, [0, 0.5, 1]);
  assert.deepEqual(summary.cohortDiagnostics.drop.boundsM.max, [10, 11, 12]);
  assert.equal(summary.cohortDiagnostics.drop.maxSpeedMPerS, 1.5);
  assert.deepEqual(summary.phaseMassKg, { solid: 5, liquid: 4, gas: 2, plasma: 1 });
  assert.equal(summary.temperatureMassWeightedMeanK, 450);
  assert.equal(summary.minTemperatureK, 273);
  assert.equal(summary.maxTemperatureK, 900);
  assert.equal(summary.thermalReadyCount, 65);
  assert.equal(summary.thermalProblemCount, 0);
  assert.equal(summary.thermalPhaseSummaryAvailable, true);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [5, 1]);
  assert.equal(device.bindGroups.length, 2);
  assert.equal(device.bindGroups[0].entries.length, 8);
  assert.equal(device.bindGroups[1].entries.length, 3);
  assert.equal(device.copies.length, 1);
  assert.equal(device.copies[0].size, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(device.writes[0].byteLength, 32);
  assert.equal(device.createdBuffers.find((buffer) => buffer.label === 'ulg-mls-mpm-resident-summary-partials').size, 5 * MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(device.createdBuffers.find((buffer) => buffer.label === 'ulg-mls-mpm-resident-summary-readback').unmapped, true);
  assert.equal(summary.compactSummaryBufferAuthority, 'diagnostics-only');
  assert.equal(summary.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(summary.residentBufferLeaseResourceCount, 3);
  assert.equal(summary.residentBufferLeaseActiveLeaseCount, 0);
  assert.equal(summary.residentBufferLeaseSummary.destroyedResourceCount, 3);
  assert.equal(device.createdBuffers.every((buffer) => buffer.destroyed), true);
});

test('MLS-MPM resident summary can skip the active-grid scan for particle-visual diagnostics', async () => {
  const particleCount = 20;
  const gridNodeCount = 160;
  const summaryValues = new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
  summaryValues[0] = particleCount;
  summaryValues[1] = 0;
  summaryValues[2] = 123;
  summaryValues[3] = 12;
  summaryValues[4] = 12;
  summaryValues[5] = 0;
  summaryValues[19] = 1;
  summaryValues[20] = 5;
  summaryValues[21] = 4;
  summaryValues[22] = 2;
  summaryValues[23] = 1;
  summaryValues[24] = 450;
  summaryValues[27] = particleCount;
  summaryValues[30] = 12;
  summaryValues[31] = 1;
  summaryValues[50] = 1;
  summaryValues[51] = 1;
  summaryValues[52] = 12;
  summaryValues[53] = 12;
  summaryValues[56] = 1;
  summaryValues[57] = 0;
  summaryValues[58] = 8;
  summaryValues[59] = 8;
  summaryValues[60] = 20;
  summaryValues[61] = 8;
  summaryValues[72] = 4;
  const device = fakeSummaryDevice(summaryValues);
  const tracker = fakeBufferTracker();
  const summary = await runMlsMpmResidentSummaryWebGpu({
    device,
    summaryScope: 'particle-visual',
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state: new Float32Array(particleCount * 8)
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics: new Float32Array(particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length)
    },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo')
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics')
    },
    gridUpdate: {
      gridNodeCount,
      gpuResult: { updatedGridBuffer: tracker.buffer('updated-grid') }
    },
    g2pReconstruction: {
      stateBuffer: tracker.buffer('next-state'),
      mechanicsBuffer: tracker.buffer('next-mechanics')
    }
  });

  assert.equal(summary.summaryScope, 'particle-visual');
  assert.equal(summary.gridNodeCount, gridNodeCount);
  assert.equal(summary.gridNodeScanCount, 0);
  assert.equal(summary.gridNodeScanSkipped, true);
  assert.equal(summary.activeGridNodeCount, null);
  assert.equal(summary.activeGridNodeCountAvailable, false);
  assert.equal(summary.activeGridNodeSummaryStatus, 'active-grid-node-summary-not-requested');
  assert.equal(summary.compactPartialSummaryCount, 1);
  assert.equal(summary.compactPartialSummaryByteLength, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(summary.timing.summaryWorkgroupCount, 2);
  assert.equal(summary.timing.queueFenceAttribution, 'mapAsync(readback-buffer)-may-include-prior-queued-resident-work');
  assert.equal(summary.massDeltaKg, 0);
  assert.equal(summary.cohortSummaryAvailable, true);
  assert.equal(summary.cohortDiagnostics.base.count, 8);
  assert.equal(summary.cohortDiagnostics.drop.count, 12);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [1, 1]);
  assert.equal(device.createdBuffers.find((buffer) => buffer.label === 'ulg-mls-mpm-resident-summary-partials').size, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(device.createdBuffers.every((buffer) => buffer.destroyed), true);
});

test('MLS-MPM resident summary can emit GPU active-grid dispatch plan buffers', async () => {
  const particleCount = 4;
  const gridNodeCount = 512;
  const summaryValues = new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
  summaryValues[0] = particleCount;
  summaryValues[1] = gridNodeCount;
  summaryValues[15] = 2;
  summaryValues[19] = 1;
  summaryValues[44] = 1.25;
  summaryValues[45] = 1.25;
  summaryValues[46] = 1.25;
  summaryValues[47] = 1.5;
  summaryValues[48] = 1.5;
  summaryValues[49] = 1.5;
  summaryValues[51] = 1;
  const device = fakeSummaryDevice(summaryValues);
  const tracker = fakeBufferTracker();
  const summary = await runMlsMpmResidentSummaryWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state: new Float32Array(particleCount * 8)
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics: new Float32Array(particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length)
    },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo')
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics')
    },
    gridUpdate: {
      gridNodeCount,
      gridDims: [8, 8, 8],
      gridShift: 4,
      gridSpacingM: 0.25,
      gpuResult: { updatedGridBuffer: tracker.buffer('updated-grid') }
    },
    g2pReconstruction: {
      gridNodeCount,
      gridDims: [8, 8, 8],
      gridShift: 4,
      gridSpacingM: 0.25,
      stateBuffer: tracker.buffer('next-state'),
      mechanicsBuffer: tracker.buffer('next-mechanics')
    },
    activeGridDispatchPlan: {
      requested: true,
      dt: 0.001,
      stepCount: 2,
      gravityMPerS2: [0, -9.80665, 0],
      safetyCells: 1
    }
  });

  assert.equal(summary.status, 'compact-summary-ready');
  assert.equal(summary.timing.summaryKernelDispatchCount, 3);
  assert.equal(summary.timing.summaryWorkgroupCount, 18);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [16, 1, 1]);
  assert.equal(device.bindGroups.length, 3);
  assert.match(device.shaderModules.at(-1).code, /ActiveGridDispatchFromSummaryParams|dispatch_args|dispatch_metadata/);
  assert.equal(summary.activeGridDispatchPlan.status, 'gpu-active-grid-summary-dispatch-plan-ready');
  assert.equal(summary.activeGridDispatchPlan.source, 'compact-summary-gpu-sidecar');
  assert.equal(summary.activeGridDispatchPlan.dispatchArgsBufferRetained, true);
  assert.equal(summary.activeGridDispatchPlan.dispatchArgsBufferByteLength, 12);
  assert.equal(summary.activeGridDispatchPlan.metadataBufferRetained, true);
  assert.equal(summary.activeGridDispatchPlan.metadataBufferByteLength, 64);
  assert.deepEqual(summary.activeGridDispatchPlan.gridDims, [8, 8, 8]);
  assert.equal(summary.activeGridDispatchPlan.gridShift, 4);
  assert.equal(summary.activeGridDispatchPlan.gridSpacingM, 0.25);
  assert.equal(summary.activeGridDispatchPlan.safetyCells, 1);
  assert.equal(summary.activeGridDispatchPlan.stepCount, 2);
  assert.equal(summary.activeGridDispatchPlan.normalHotLoopReadbackFree, true);
  assert.equal(summary.activeGridDispatchPlanBuffersRetained, true);
  assert.equal(summary.activeGridDispatchPlanDispatchArgsBuffer.label, 'ulg-mls-mpm-active-grid-summary-dispatch-args');
  assert.equal(summary.activeGridDispatchPlanMetadataBuffer.label, 'ulg-mls-mpm-active-grid-summary-dispatch-metadata');
  assert.equal(summary.activeGridDispatchPlanDispatchArgsBuffer.destroyed, false);
  assert.equal(summary.activeGridDispatchPlanMetadataBuffer.destroyed, false);
  assert.equal(device.createdBuffers.find((buffer) => buffer.label === 'ulg-mls-mpm-active-grid-summary-dispatch-params').destroyed, true);
  summary.destroyActiveGridDispatchPlanBuffers();
  assert.equal(summary.activeGridDispatchPlanDispatchArgsBuffer.destroyed, true);
  assert.equal(summary.activeGridDispatchPlanMetadataBuffer.destroyed, true);
});

test('MLS-MPM resident summary can emit active-grid dispatch plan buffers without compact readback', async () => {
  const particleCount = 4;
  const gridNodeCount = 512;
  const summaryValues = new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
  summaryValues[0] = particleCount;
  summaryValues[1] = gridNodeCount;
  summaryValues[15] = 2;
  summaryValues[19] = 1;
  summaryValues[44] = 1.25;
  summaryValues[45] = 1.25;
  summaryValues[46] = 1.25;
  summaryValues[47] = 1.5;
  summaryValues[48] = 1.5;
  summaryValues[49] = 1.5;
  summaryValues[51] = 1;
  const device = fakeSummaryDevice(summaryValues);
  const tracker = fakeBufferTracker();
  const summary = await runMlsMpmResidentSummaryWebGpu({
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state: new Float32Array(particleCount * 8)
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics: new Float32Array(particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length)
    },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo')
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics')
    },
    gridUpdate: {
      gridNodeCount,
      gridDims: [8, 8, 8],
      gridShift: 4,
      gridSpacingM: 0.25,
      gpuResult: { updatedGridBuffer: tracker.buffer('updated-grid') }
    },
    g2pReconstruction: {
      gridNodeCount,
      gridDims: [8, 8, 8],
      gridShift: 4,
      gridSpacingM: 0.25,
      stateBuffer: tracker.buffer('next-state'),
      mechanicsBuffer: tracker.buffer('next-mechanics')
    },
    readCompactSummary: false,
    activeGridDispatchPlan: {
      requested: true,
      dt: 0.001,
      stepCount: 2,
      gravityMPerS2: [0, -9.80665, 0],
      safetyCells: 1
    }
  });

  assert.equal(summary.status, 'compact-summary-plan-only-ready');
  assert.equal(summary.readbackMode, 'no-compact-summary-readback');
  assert.equal(summary.compactGpuSummaryAvailable, false);
  assert.equal(summary.compactGpuSummaryStatus, 'not-read-no-compact-summary-readback');
  assert.equal(summary.timing.mapAsyncWaitMs, null);
  assert.equal(summary.timing.decodeMs, 0);
  assert.equal(summary.timing.compactReadbackByteLength, 0);
  assert.equal(summary.normalHotLoopReadbackFree, true);
  assert.equal(summary.activeGridDispatchPlan.status, 'gpu-active-grid-summary-dispatch-plan-ready');
  assert.equal(summary.activeGridDispatchPlan.source, 'compact-summary-gpu-sidecar');
  assert.equal(summary.activeGridDispatchPlanBuffersRetained, true);
  assert.equal(summary.activeGridDispatchPlanDispatchArgsBuffer.label, 'ulg-mls-mpm-active-grid-summary-dispatch-args');
  assert.equal(summary.activeGridDispatchPlanMetadataBuffer.label, 'ulg-mls-mpm-active-grid-summary-dispatch-metadata');
  assert.equal(summary.activeGridDispatchPlanDispatchArgsBuffer.destroyed, false);
  assert.equal(summary.activeGridDispatchPlanMetadataBuffer.destroyed, false);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [16, 1, 1]);
  assert.equal(device.bindGroups.length, 3);
  assert.equal(device.copies.length, 0);
  assert.equal(device.createdBuffers.some((buffer) => buffer.label === 'ulg-mls-mpm-resident-summary-readback'), false);
  summary.destroyActiveGridDispatchPlanBuffers();
  assert.equal(summary.activeGridDispatchPlanDispatchArgsBuffer.destroyed, true);
  assert.equal(summary.activeGridDispatchPlanMetadataBuffer.destroyed, true);
});

test('MLS-MPM resident step shares retained stage buffers across WebGPU stages', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceStateBuffer = tracker.buffer('source-state');
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const sourceMechanicsBuffer = tracker.buffer('source-mechanics');
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: sourceStateBuffer,
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: sourceMechanicsBuffer,
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    p2gRunner(args) {
      const result = projectMlsMpmP2gGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        gridBuffer: tracker.buffer('p2g-grid'),
        gridBufferByteLength: result.gridNodes.byteLength,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      assert.equal(args.p2gGridBuffer?.label, 'p2g-grid');
      const result = updateMlsMpmGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        updatedGridBuffer: tracker.buffer('updated-grid'),
        updatedGridBufferByteLength: result.updatedGridNodes.byteLength,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      assert.equal(args.updatedGridBuffer?.label, 'updated-grid');
      assert.equal(args.retainOutputParticleBuffers, true);
      const result = reconstructMlsMpmG2pCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        stateBuffer: tracker.buffer('g2p-state'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics'),
        stateBufferByteLength: result.state.byteLength,
        mechanicsBufferByteLength: result.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(step.backend, 'webgpu');
  assert.equal(step.status, 'resident-step-webgpu-executed');
  assert.equal(step.stageStatus.p2g, 'webgpu-executed');
  assert.equal(step.stageStatus.gridUpdate, 'webgpu-executed');
  assert.equal(step.stageStatus.g2p, 'webgpu-executed');
  assert.equal(step.residentBuffersRetained, true);
  assert.equal(step.stageBuffersRetained, true);
  assert.equal(step.g2pOutputBuffersRetained, true);
  assert.equal(step.residentBufferMode, 'retained-stage-and-output-buffers');
  assert.equal(step.nextParticleStateBufferByteLength, step.state.byteLength);
  assert.equal(step.nextParticleMechanicsBufferByteLength, step.mechanics.byteLength);
  assert.equal(step.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.deepEqual(step.particlePingPong, {
    sourceSlot: 0,
    nextSlot: 1,
    step: 0,
    nextStep: 1,
    time: 0,
    nextTime: 0.1
  });
  assert.equal(step.nextParticleUploads.sphParticleUpload.slot, 1);
  assert.equal(step.nextParticleUploads.sphParticleUpload.ownsStateBuffer, true);
  assert.equal(step.nextParticleUploads.sphParticleUpload.ownsThermoBuffer, false);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.slot, 1);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.ownsMechanicsBuffer, true);
  assert.equal(step.diagnostics.activeGridNodeCount > 0, true);
  assert.equal(step.diagnostics.sourceMomentumKgMPerS[0], 16);
  assert.equal(Number.isFinite(step.diagnostics.maxSpeedMPerS), true);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 4);
});

test('MLS-MPM resident step cleanup preserves continuation buffers requested by the next owner', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    readbackMode: 'no-full-readback',
    boxDimsM: [3, 3, 3],
    p2gRunner(args) {
      const projection = projectMlsMpmP2gGridCpu(args);
      return {
        ...projection,
        backend: 'webgpu',
        readbackMode: 'no-full-readback',
        fullReadbackPerformed: false,
        gridBuffer: tracker.buffer('p2g-grid'),
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      const update = updateMlsMpmGridCpu(args);
      return {
        ...update,
        backend: 'webgpu',
        readbackMode: 'no-full-readback',
        fullReadbackPerformed: false,
        updatedGridBuffer: tracker.buffer('updated-grid'),
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      const reconstruction = reconstructMlsMpmG2pCpu(args);
      const stateBuffer = tracker.buffer('next-state');
      const mechanicsBuffer = tracker.buffer('next-mechanics');
      return {
        ...reconstruction,
        backend: 'webgpu',
        readbackMode: 'no-full-readback',
        fullReadbackPerformed: false,
        stateBuffer,
        mechanicsBuffer,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers() {
          stateBuffer.destroy();
          mechanicsBuffer.destroy();
        }
      };
    }
  });

  const continuationBuffers = [
    step.nextParticleUploads.sphParticleUpload.stateBuffer,
    step.nextParticleUploads.sphParticleUpload.thermoBuffer,
    step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer
  ];
  destroyMlsMpmResidentStepBuffers(step, { preserveBuffers: continuationBuffers });
  assert.equal(tracker.destroyed, 2);
});

test('MLS-MPM resident step falls forward through CPU stages after a WebGPU parity failure', async () => {
  const buffers = manualBuffers();
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    p2gRunner(args) {
      const result = projectMlsMpmP2gGridCpu(args);
      result.gridNodes = result.gridNodes.slice();
      result.gridNodes[0] += 100;
      return { ...result, backend: 'webgpu' };
    },
    parityTolerances: { p2g: 1e-9 }
  });

  assert.equal(step.backend, 'cpu-reference');
  assert.equal(step.stageStatus.p2g, 'webgpu-parity-failed');
  assert.equal(step.stageBackends.p2g, 'cpu-reference');
  assert.equal(step.stageBackends.gridUpdate, 'cpu-reference');
  assert.equal(step.stageBackends.g2p, 'cpu-reference');
  assert.equal(step.residentBuffersRetained, false);
  assert.equal(step.fullPhysicsValidation, false);
});

test('MLS-MPM resident step can retain buffers without full readback', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const gpuResidentLaneManager = fakeGpuResidentLaneManager();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const p2gInputs = [];
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    gpuResidentLaneManager,
    gpuResidentLaneId: 'ulg:test:sph-resident',
    gpuResidentLaneStateKey: 'ulg:test:sph-resident-state',
    gpuResidentLaneDomainKey: 'ulg:test-domain',
    p2gRunner(args) {
      p2gInputs.push({
        readbackMode: args.readbackMode,
        stateBufferLabel: args.sphParticleUpload?.stateBuffer?.label ?? null
      });
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-unread'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.p2gGridBuffer?.label, 'p2g-grid-unread');
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-unread'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        queueCompletionStatus: 'queue-work-completed',
        queueCompletionMethod: 'queue.onSubmittedWorkDone',
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.updatedGridBuffer?.label, 'updated-grid-unread');
      assert.equal(args.retainOutputParticleBuffers, true);
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-unread'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-unread'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(p2gInputs[0].readbackMode, 'no-full-readback');
  assert.equal(p2gInputs[0].stateBufferLabel, 'source-state');
  assert.equal(step.backend, 'webgpu');
  assert.equal(step.status, 'resident-step-webgpu-executed');
  assert.equal(step.stageStatus.p2g, 'webgpu-executed-no-full-readback');
  assert.equal(step.stageStatus.gridUpdate, 'webgpu-executed-no-full-readback');
  assert.equal(step.stageStatus.g2p, 'webgpu-executed-no-full-readback');
  assert.equal(step.readbackMode, 'no-full-readback');
  assert.equal(step.normalHotLoopReadbackFree, true);
  assert.equal(step.renderStateReadbackAvailable, false);
  assert.equal(step.gpuAuthoritativeState, false);
  assert.equal(step.residentBuffersRetained, true);
  assert.equal(step.residentAuthorityLedgerStatus, 'resident-authority-ledger-ready');
  assert.equal(step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage, 'g2p');
  assert.equal(step.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].ownerStage, 'g2p');
  assert.ok(step.residentAuthorityWarnings.includes('cpu-mirrors-stale-unless-admitted-readback'));
  assert.equal(step.diagnostics.residentAuthorityLedgerStatus, 'resident-authority-ledger-ready');
  assert.equal(step.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.equal(step.nextParticleStateBufferByteLength, buffers.sphParticleState.state.byteLength);
  assert.equal(step.nextParticleMechanicsBufferByteLength, buffers.mlsMpmParticleState.mechanics.byteLength);
  assert.equal(step.state.length, 0);
  assert.equal(step.mechanics.length, 0);
  assert.equal(step.p2gGridProjection.webgpuParity.status, 'not-run-no-full-readback');
  assert.equal(step.gridUpdate.webgpuParity.status, 'not-run-no-full-readback');
  assert.equal(step.g2pReconstruction.webgpuParity.status, 'not-run-no-full-readback');
  assert.equal(step.diagnostics.activeGridNodeCount, null);
  assert.equal(step.diagnostics.massDeltaKg, null);
  assert.equal(step.diagnostics.compactGpuSummaryAvailable, false);
  assert.equal(gpuResidentLaneManager.calls.acquire.length, 1);
  assert.equal(gpuResidentLaneManager.calls.complete.length, 1);
  assert.equal(gpuResidentLaneManager.calls.reject.length, 0);
  assert.equal(gpuResidentLaneManager.activeLeaseCount, 0);
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.laneId, 'ulg:test:sph-resident');
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.stateKey, 'ulg:test:sph-resident-state');
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.domainKey, 'ulg:test-domain');
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.copyBudget.uploadBytes, 0);
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.copyBudget.readbackBytes, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.copyBudget.retainedBytes, buffers.sphParticleState.state.byteLength + buffers.sphParticleState.thermo.byteLength + buffers.mlsMpmParticleState.mechanics.byteLength);
  assert.equal(gpuResidentLaneManager.calls.acquire[0].spec.copyBudget.compactSummaryBytes, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(gpuResidentLaneManager.calls.complete[0].options.queueCompletionStatus, 'queue-work-completed');
  assert.equal(gpuResidentLaneManager.calls.complete[0].options.queueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.deepEqual(gpuResidentLaneManager.calls.complete[0].options.retainedBufferRefs, [
    'p2g-grid-buffer',
    'updated-grid-buffer',
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
  assert.equal(step.gpuResidentLane.schema, 'peercompute.ulg.mls-mpm-resident-gpu-lane-adapter.v0');
  assert.equal(step.gpuResidentLaneStatus, 'gpu-resident-lane-completed');
  assert.equal(step.gpuResidentLaneLeaseId, gpuResidentLaneManager.calls.acquire[0].lease.leaseId);
  assert.equal(step.gpuResidentLaneFenceStatus, 'queue-work-completed');
  assert.equal(step.gpuResidentLaneFenceSatisfied, true);
  assert.deepEqual(step.gpuResidentLaneRetainedBufferRefs, [
    'p2g-grid-buffer',
    'updated-grid-buffer',
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
  assert.equal(step.diagnostics.gpuResidentLaneStatus, 'gpu-resident-lane-completed');
  assert.equal(step.diagnostics.gpuResidentLaneLeaseId, gpuResidentLaneManager.calls.acquire[0].lease.leaseId);
  assert.equal(step.diagnostics.gpuResidentLaneFenceStatus, 'queue-work-completed');
  assert.equal(step.diagnostics.gpuResidentLaneFenceSatisfied, true);
  assert.equal(step.diagnostics.gpuResidentLaneRetainedBufferRefCount, 5);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 4);
});

test('MLS-MPM resident step can opt into fused no-full mechanics dispatch', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    fuseNoFullResidentMechanics: true,
    summaryRunner({ gridUpdate, g2pReconstruction, summaryScope }) {
      assert.equal(gridUpdate.fusedResidentMechanics, true);
      assert.equal(g2pReconstruction.fusedResidentMechanics, true);
      return {
        schema: 'peercompute.ulg.mls-mpm-resident-summary-execution.v0',
        backend: 'webgpu',
        status: 'compact-summary-ready',
        compactGpuSummaryAvailable: true,
        readbackMode: 'no-full-readback',
        summaryScope,
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: gridUpdate.gridNodeCount,
        activeGridNodeCount: null,
        activeGridNodeCountAvailable: false,
        activeGridNodeSummaryStatus: 'active-grid-node-summary-not-requested',
        gridNodeScanCount: 0,
        gridNodeScanSkipped: true,
        sourceMassKg: 8,
        nextMassKg: 8,
        massDeltaKg: 0,
        sourceMomentumKgMPerS: [0, 0, 0],
        nextMomentumKgMPerS: [0, 0, 0],
        momentumDeltaKgMPerS: [0, 0, 0],
        sourceCenterOfMassM: [1.25, 1.25, 1.25],
        nextCenterOfMassM: [1.25, 1.25, 1.25],
        centerOfMassDeltaM: [0, 0, 0],
        sourcePositionBoundsM: {
          status: 'position-bounds-ready',
          min: [1.25, 1.25, 1.25],
          max: [1.25, 1.25, 1.25],
          massKg: 8
        },
        nextPositionBoundsM: {
          status: 'position-bounds-ready',
          min: [1.25, 1.25, 1.25],
          max: [1.25, 1.25, 1.25],
          massKg: 8
        },
        maxSpeedMPerS: 0,
        maxDisplacementM: 0,
        minVolumeRatioJ: 1,
        maxVolumeRatioJ: 1,
        phaseMassKg: { solid: 0, liquid: 8, gas: 0, plasma: 0 },
        phaseMassTotalKg: 8,
        temperatureMassWeightedMeanK: 0,
        minTemperatureK: 0,
        maxTemperatureK: 0,
        thermalReadyCount: 1,
        thermalProblemCount: 0,
        thermalPhaseSummaryAvailable: true,
        compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
        timing: {
          schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
          totalMs: 0,
          setupMs: 0,
          encodeMs: 0,
          submitMs: 0,
          mapAsyncWaitMs: 0,
          decodeMs: 0,
          queueFenceAttribution: 'unit-summary-runner',
          summaryKernelDispatchCount: 0,
          summaryWorkgroupCount: 0,
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES
        },
        mapAsyncWaitMs: 0,
        queueFenceAttribution: 'unit-summary-runner'
      };
    }
  });

  assert.equal(step.backend, 'webgpu');
  assert.equal(step.status, 'resident-step-webgpu-executed');
  assert.equal(step.readbackMode, 'no-full-readback');
  assert.equal(step.stageTiming.fusedResidentMechanics, true);
  assert.equal(step.stageTiming.stageMs.p2gGridProjection, 0);
  assert.equal(step.stageTiming.stageMs.gridUpdate, 0);
  assert.equal(step.stageTiming.stageMs.g2pReconstruction, 0);
  assert.equal(step.p2gGridProjection.fusedResidentMechanics, true);
  assert.equal(step.gridUpdate.fusedResidentMechanics, true);
  assert.equal(step.g2pReconstruction.fusedResidentMechanics, true);
  assert.equal(step.dispatchTopologyStatus, 'resident-dispatch-topology-ready');
  assert.equal(step.cpuParticleLoopInHotPath, false);
  assert.equal(step.stageTiming.dispatchTopology.status, 'resident-dispatch-topology-ready');
  assert.equal(step.stageTiming.dispatchTopology.p2g.topology, 'particle-parallel-scatter');
  assert.equal(step.stageTiming.dispatchTopology.p2g.dispatchAxis, 'particle');
  assert.equal(step.stageTiming.dispatchTopology.p2g.particleLoopInShader, false);
  assert.equal(step.stageTiming.dispatchTopology.p2g.perParticleLocalStencilNodeCount, 27);
  assert.equal(step.stageTiming.dispatchTopology.g2p.topology, 'particle-parallel-gather');
  assert.equal(step.stageTiming.dispatchTopology.g2p.dispatchAxis, 'particle');
  assert.deepEqual(step.stageTiming.dispatchTopology.particleParallelStages, ['p2g', 'g2p']);
  assert.equal(step.stageTiming.dispatchTopology.cpuParticleLoopInHotPath, false);
  assert.equal(step.stageTiming.dispatchTopology.totalDispatches, 4);
  assert.equal(step.p2gGridProjection.dispatchTopology.topology, 'particle-parallel-scatter');
  assert.equal(step.p2gGridProjection.residentDispatchTopology, step.stageTiming.dispatchTopology);
  assert.equal(step.diagnostics.dispatchTopologyStatus, 'resident-dispatch-topology-ready');
  assert.equal(step.diagnostics.cpuParticleLoopInHotPath, false);
  assert.deepEqual(step.diagnostics.particleParallelStages, ['p2g', 'g2p']);
  assert.equal(step.diagnostics.particleScaleStabilitySchema, 'peercompute.ulg.mls-mpm-g2p-particle-scale-stability.v0');
  assert.equal(step.diagnostics.particleScaleStabilityStatus, 'gpu-g2p-cap-policy-applied-in-shader');
  assert.equal(step.diagnostics.particleScalePolicyAppliedInG2p, true);
  assert.equal(step.diagnostics.particleScalePolicyAppliedInShader, true);
  assert.equal(step.diagnostics.particleScaleMaxRadiusGrowthRatioAllowed, 4);
  assert.equal(step.diagnostics.particleScaleMaxVolumeRatioJAllowed, 64);
  assert.equal(step.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.equal(step.nextParticleStateBufferByteLength, buffers.sphParticleState.state.byteLength);
  assert.equal(step.nextParticleMechanicsBufferByteLength, buffers.mlsMpmParticleState.mechanics.byteLength);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(device.submissions.length, 1);
  assert.equal(device.dispatches.length, 4);
});

test('MLS-MPM resident step can active-grid fused no-full mechanics dispatch', async () => {
  const buffers = manualBuffers({
    position: [1.5, 1.5, 1.5],
    velocity: [0, 0, 0],
    smoothingLengthM: 0.25
  });
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    fuseNoFullResidentMechanics: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 1,
    summaryRunner: null
  });

  const activeGridDispatch = step.stageTiming.activeGridDispatch;
  assert.equal(step.stageTiming.fusedResidentMechanics, true);
  assert.equal(activeGridDispatch.useActiveGrid, true);
  assert.ok(activeGridDispatch.activeNodeCount < activeGridDispatch.fullGridNodeCount);
  assert.equal(step.p2gGridProjection.activeGridDispatch.useActiveGrid, true);
  assert.equal(step.gridUpdate.activeGridDispatch.useActiveGrid, true);
  assert.equal(step.g2pReconstruction.activeGridDispatch.useActiveGrid, true);
  assert.equal(step.stageTiming.dispatchTopology.gridUpdate.dispatchAxis, 'active-grid-node');
  assert.equal(step.stageTiming.dispatchTopology.p2gFinalize.dispatchAxis, 'active-grid-node');
  assert.equal(step.stageTiming.dispatchTopology.p2gAccumulatorClear.dispatchAxis, 'active-grid-node');
  assert.equal(step.stageTiming.dispatchTopology.p2gAccumulatorClear.bufferClearMode, 'active-grid-compute-clear');
  assert.equal(
    step.stageTiming.dispatchTopology.p2gFinalize.dispatchWorkgroupsPerSubstep,
    Math.ceil(activeGridDispatch.activeNodeCount / 64)
  );
  assert.equal(
    step.stageTiming.dispatchTopology.p2gAccumulatorClear.dispatchWorkgroupsPerSubstep,
    Math.ceil(activeGridDispatch.activeNodeCount / 64)
  );
  assert.equal(step.stageTiming.dispatchTopology.totalDispatches, 5);
  assert.equal(step.stageTiming.activeGridIndirectDispatch.status, 'cpu-seeded-active-grid-indirect-dispatch-ready');
  assert.equal(step.stageTiming.activeGridIndirectDispatch.dispatchMode, 'dispatchWorkgroupsIndirect');
  assert.equal(step.stageTiming.activeGridIndirectDispatch.indirectDispatchUseCount, 3);
  assert.equal(step.stageTiming.dispatchTopology.p2gFinalize.dispatchSubmissionMode, 'dispatchWorkgroupsIndirect');
  assert.equal(step.stageTiming.dispatchTopology.gridUpdate.indirectDispatchUsed, true);
  assert.equal(step.stageTiming.compactSummaryRequested, false);
  assert.equal(step.stageTiming.activeGridDispatchPlanOnlyRequested, true);
  assert.equal(step.compactGpuSummary.status, 'compact-summary-plan-only-ready');
  assert.equal(step.compactGpuSummary.readbackMode, 'no-compact-summary-readback');
  assert.equal(step.compactGpuSummary.timing.mapAsyncWaitMs, null);
  assert.equal(step.residentActiveGridDispatchPlanHint.status, 'active-grid-summary-dispatch-plan-hint-ready');
  assert.equal(step.nextParticleUploads.activeGridDispatchPlanHint.status, 'active-grid-summary-dispatch-plan-hint-ready');
  assert.equal(device.dispatches.length, 5);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [1, 1, 154, 1, 1]);
  assert.equal(device.indirectDispatches.length, 3);
  assert.deepEqual(
    device.indirectDispatches.map((entry) => entry.workgroupCountX),
    Array(3).fill(Math.ceil(activeGridDispatch.activeNodeCount / 64))
  );
  assert.ok(device.indirectDispatches[0].workgroupCountX < Math.ceil(activeGridDispatch.fullGridNodeCount / 64));
  assert.equal(device.copies.length, 0);
  assert.equal(device.clears.length, 0);
  destroyMlsMpmResidentStepBuffers(step);
});

test('MLS-MPM resident step rejects a GPU resident lane lease when WebGPU device acquisition fails', async () => {
  const buffers = manualBuffers();
  const gpuResidentLaneManager = fakeGpuResidentLaneManager();
  await assert.rejects(
    () => runMlsMpmResidentStepWithOptionalWebGpu({
      ...buffers,
      preferWebGpu: true,
      navigatorRef: {
        gpu: {
          async requestAdapter() {
            throw new Error('synthetic adapter failure');
          }
        }
      },
      gpuResidentLaneManager,
      gpuResidentLaneId: 'ulg:test:sph-resident-failure',
      gpuResidentLaneStateKey: 'ulg:test:sph-resident-state'
    }),
    /synthetic adapter failure/
  );

  assert.equal(gpuResidentLaneManager.calls.acquire.length, 1);
  assert.equal(gpuResidentLaneManager.calls.complete.length, 0);
  assert.equal(gpuResidentLaneManager.calls.reject.length, 1);
  assert.equal(gpuResidentLaneManager.calls.reject[0].leaseId, gpuResidentLaneManager.calls.acquire[0].lease.leaseId);
  assert.equal(gpuResidentLaneManager.calls.reject[0].reason, 'resident-step-error');
  assert.equal(gpuResidentLaneManager.activeLeaseCount, 0);
});

test('MLS-MPM resident step compute task declares ComputeManager GPU lane and fence requirements', async () => {
  const { buffers, options } = noFullReadbackResidentStepFixture();
  const task = createMlsMpmResidentStepComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-step-task',
    laneId: 'ulg:test:sph-resident',
    stateKey: 'ulg:test:sph-state',
    domainKey: 'ulg:test-domain',
    retainedBufferRefs: ['sph-state-buffer', 'mls-mpm-mechanics-buffer']
  });

  assert.equal(task.schema, ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA);
  assert.equal(task.runtime, 'js');
  assert.equal(task.module, './sphMlsMpmGpuStep.js');
  assert.equal(task.exportName, 'runMlsMpmResidentStepComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.returnEnvelope, true);
  assert.equal(task.gpuFence.schema, 'peercompute.compute.gpu-fence-requirement.v0');
  assert.equal(task.gpuFence.required, true);
  assert.equal(task.gpuFence.laneId, 'ulg:test:sph-resident');
  assert.equal(task.gpuFence.stateKey, 'ulg:test:sph-state');
  assert.equal(task.gpuResidentLane.schema, 'peercompute.compute.gpu-resident-lane-task.v0');
  assert.equal(task.gpuResidentLane.localExecution, 'inline');
  assert.equal(task.gpuResidentLane.laneId, 'ulg:test:sph-resident');
  assert.equal(task.gpuResidentLane.stateKey, 'ulg:test:sph-state');
  assert.equal(task.gpuResidentLane.domainKey, 'ulg:test-domain');
  assert.equal(task.gpuResidentLane.copyBudget.readbackBytes, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(task.gpuResidentLane.copyBudget.retainedBytes, buffers.sphParticleState.state.byteLength + buffers.sphParticleState.thermo.byteLength + buffers.mlsMpmParticleState.mechanics.byteLength);
  assert.deepEqual(task.webgpu.retainedBufferRefs, ['sph-state-buffer', 'mls-mpm-mechanics-buffer']);
  assert.equal(task.data.gpuResidentLaneManager, undefined);
  assert.equal(task.data.gpuFenceRequirement.laneId, 'ulg:test:sph-resident');
  assert.equal(task.data.gpuResidentLane.stateKey, 'ulg:test:sph-state');
});

test('MLS-MPM resident step compute task handler returns explicit GPU fence evidence without local double leasing', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const ignoredLaneManager = fakeGpuResidentLaneManager();
  const task = createMlsMpmResidentStepComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    laneId: 'ulg:test:sph-resident',
    stateKey: 'ulg:test:sph-state',
    gpuResidentLaneManager: ignoredLaneManager
  });
  const result = await runMlsMpmResidentStepComputeTask(task.data);

  assert.equal(result.schema, ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA);
  assert.equal(result.computeTaskResultSchema, ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA);
  assert.equal(result.status, 'resident-step-webgpu-executed');
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.status, 'queue-work-completed');
  assert.equal(result.gpuFence.method, 'queue.onSubmittedWorkDone');
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.laneId, 'ulg:test:sph-resident');
  assert.equal(result.gpuFence.stateKey, 'ulg:test:sph-state');
  assert.deepEqual(result.gpuFence.retainedBufferRefs, [
    'p2g-grid-buffer',
    'updated-grid-buffer',
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
  assert.equal(result.gpuResidentLaneStatus, undefined);
  assert.equal(ignoredLaneManager.calls.acquire.length, 0);
  const directFence = createMlsMpmResidentStepGpuFenceReport(result, task.gpuFence);
  assert.equal(directFence.fenceSatisfied, true);
  assert.equal(directFence.laneId, 'ulg:test:sph-resident');
});

test('MLS-MPM resident step fence accepts deferred cleanup for retained WebGPU no-full chains', () => {
  const fence = createMlsMpmResidentStepGpuFenceReport({
    backend: 'webgpu',
    status: 'resident-step-webgpu-executed',
    readbackMode: 'no-full-readback',
    normalHotLoopReadbackFree: true,
    residentBuffersRetained: true,
    gridUpdate: {
      queueCompletionStatus: 'queue-submitted-cleanup-deferred',
      queueCompletionMethod: 'deferred unified fused mechanics cleanup'
    },
    nextParticleUploads: {
      sphParticleUpload: {
        stateBuffer: { label: 'retained-state-buffer' },
        thermoBuffer: { label: 'retained-thermo-buffer' }
      },
      mlsMpmParticleUpload: {
        mechanicsBuffer: { label: 'retained-mechanics-buffer' }
      }
    }
  }, {
    required: true,
    laneId: 'ulg:test:sph-resident',
    stateKey: 'ulg:test:sph-state'
  });

  assert.equal(fence.status, 'queue-submitted-cleanup-deferred');
  assert.equal(fence.method, 'deferred unified fused mechanics cleanup');
  assert.equal(fence.fenceSatisfied, true);
  assert.equal(
    fence.satisfactionReason,
    'retained-webgpu-no-full-readback-chain-submitted-before-deferred-cleanup'
  );
  assert.equal(fence.laneId, 'ulg:test:sph-resident');
  assert.equal(fence.stateKey, 'ulg:test:sph-state');
});

test('SPH thermal phase stage compute task declares retained thermo lane output without authority mutation', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceStateBuffer = tracker.buffer('g2p-state-in');
  const sourceThermoBuffer = tracker.buffer('source-thermo-in');
  const task = createSphThermalPhaseStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:thermal-phase-stage',
    laneId: 'ulg:test:thermal-phase-lane',
    stateKey: 'ulg:test:thermal-phase-state',
    domainKey: 'ulg:test-domain',
    preferWebGpu: true,
    sphParticleState: buffers.sphParticleState,
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state-upload'),
      thermoBuffer: sourceThermoBuffer
    },
    sourceStateBuffer,
    sourceThermoBuffer,
    boxDimsM: [5, 5, 5],
    dtS: 0.1
  });

  assert.equal(task.schema, ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(task.exportName, 'runSphThermalPhaseStageComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.suppressCommitDelta, true);
  assert.equal(task.gpuFence.required, true);
  assert.equal(task.gpuFence.laneId, 'ulg:test:thermal-phase-lane');
  assert.equal(task.gpuResidentLane.owner, 'ulg-thermal-phase-law');
  assert.deepEqual(task.writeFamilies, ['sph-thermo-phase']);
  assert.deepEqual(task.webgpu.retainedBufferRefs, ['sph-state-buffer', 'sph-thermo-buffer']);

  const result = await runSphThermalPhaseStageComputeTask({
    ...task.data,
    thermalStepRunner(args) {
      assert.equal(args.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
      assert.equal(args.sourceStateBuffer, sourceStateBuffer);
      assert.equal(args.sourceThermoBuffer, sourceThermoBuffer);
      assert.equal(args.retainOutputParticleBuffers, true);
      return {
        schema: 'peercompute.ulg.sph-gpu-thermal-step-execution.v0',
        backend: 'webgpu',
        status: 'webgpu-accepted',
        webgpuStatus: { status: 'webgpu-executed' },
        result: {
          schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
          backend: 'webgpu',
          status: 'thermal-step-executed',
          particleCount: buffers.sphParticleState.particleCount,
          state: new Float32Array(),
          thermo: new Float32Array(),
          stateBuffer: tracker.buffer('thermal-state-out'),
          thermoBuffer: tracker.buffer('thermal-thermo-out'),
          stateBufferByteLength: buffers.sphParticleState.state.byteLength,
          thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
          retainedOutputParticleBuffers: true,
          readbackMode: 'full-parity-readback',
          fullReadbackPerformed: true,
          normalHotLoopReadbackFree: false
        }
      };
    }
  });

  assert.equal(result.computeTaskResultSchema, ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(result.computeTaskId, 'ulg:test:thermal-phase-stage');
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'webgpu-accepted');
  assert.equal(result.stateBuffer.label, 'thermal-state-out');
  assert.equal(result.thermoBuffer.label, 'thermal-thermo-out');
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.thermalPhaseStageTaskEvidence.schema, 'peercompute.ulg.thermal-phase-stage-task-evidence.v0');
  assert.equal(result.thermalPhaseStageTaskEvidence.passed, true);
  assert.deepEqual(result.thermalPhaseStageTaskEvidence.candidateWriteFamilies, ['sph-thermo-phase']);
  assert.ok(result.thermalPhaseStageTaskEvidence.mustNotWriteFamilies.includes('resident-product-mass'));
  assert.equal(result.thermalPhaseStageTaskAuthority.status, 'compute-manager-owned-non-mutating-thermal-phase-stage-task');
  assert.equal(result.thermalPhaseStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(result.thermalPhaseStageTaskAuthority.commitDeltaSuppressed, true);
});

test('SPH gas-cell EOS producer stage publishes retained gas pressure cell rows', async () => {
  const spatialGasSpeciesLedger = {
    schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
    status: 'spatial-gas-species-ledger-ready',
    source: 'test-spatial-product-events',
    spatialGasSourceBufferRetained: true,
    retainedSpatialGasSourceBufferRefs: ['resident-product-mass-buffer'],
    cellDims: [2, 1, 1],
    cellCount: 2,
    cells: [
      {
        index: 0,
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.04, moles: 200, temperatureK: 300 }
        }
      },
      {
        index: 1,
        gridIndex: [1, 0, 0],
        centerM: [1.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.06, moles: 300, temperatureK: 300 }
        }
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'gpu-resident-reaction-pressure-summary',
    source: 'gpu-resident-product-mass-gas-species-ledger',
    totalPressurePa: 180000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    spatialGasSpeciesLedger
  };
  const device = fakeSummaryDevice(new Float32Array(0));
  const task = createSphGasCellEosProducerStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:gas-cell-eos-producer-stage',
    laneId: 'ulg:test:gas-cell-eos-lane',
    stateKey: 'ulg:test:gas-cell-eos-state',
    domainKey: 'ulg:test-domain',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    gasPressureSummary,
    device
  });

  assert.equal(task.schema, ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(task.exportName, 'runSphGasCellEosProducerStageComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.suppressCommitDelta, true);
  assert.deepEqual(task.readFamilies, ['resident-spatial-gas-species-ledger', 'resident-product-mass']);
  assert.deepEqual(task.writeFamilies, ['resident-gas-pressure']);
  assert.deepEqual(task.webgpu.retainedBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(task.gpuFence.required, true);
  assert.equal(task.gpuFence.laneId, 'ulg:test:gas-cell-eos-lane');
  assert.equal(task.gpuResidentLane.owner, 'ulg-resident-gas-cell-eos-law');

  const result = await runSphGasCellEosProducerStageComputeTask(task.data);

  assert.equal(result.computeTaskResultSchema, ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(result.computeTaskId, 'ulg:test:gas-cell-eos-producer-stage');
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'gas-cell-eos-producer-stage-ready');
  assert.equal(result.fullReadbackPerformed, false);
  assert.equal(result.normalHotLoopReadbackFree, true);
  assert.equal(result.queueCompletionStatus, 'queue-work-completed');
  assert.equal(result.queueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.equal(result.gasCellField.localPressureGradientReady, true);
  assert.equal(result.gasCellField.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(result.pressureInterfaceGasPressureCellRowCount, 2);
  assert.equal(result.pressureInterfaceGasPressureCellRowStrideFloats, 12);
  assert.equal(result.pressureInterfaceGasPressureCellRowByteLength, 96);
  assert.equal(result.pressureInterfaceGasPressureCellRowsBufferRetained, true);
  assert.equal(result.gasPressureCellsBuffer.label, 'ulg-sph-gas-cell-eos-pressure-cells-out');
  assert.deepEqual(result.retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(result.retainedGasCellFieldSourceReady, true);
  assert.equal(result.retainedGasCellFieldSource.schema, 'peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0');
  assert.equal(result.retainedGasCellFieldSource.sourceTaskId, 'ulg:test:gas-cell-eos-producer-stage');
  assert.deepEqual(result.retainedGasCellFieldSource.retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(result.retainedGasCellFieldSource.pressureInterfaceGasPressureCellRowByteLength, 96);
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gasCellEosProducerStageTaskEvidence.schema, 'peercompute.ulg.gas-cell-eos-producer-stage-task-evidence.v0');
  assert.equal(result.gasCellEosProducerStageTaskEvidence.passed, true);
  assert.deepEqual(result.gasCellEosProducerStageTaskEvidence.candidateWriteFamilies, ['resident-gas-pressure']);
  assert.ok(result.gasCellEosProducerStageTaskEvidence.mustNotWriteFamilies.includes('pressure-interface-force-rows'));
  assert.equal(result.gasCellEosProducerStageTaskAuthority.status, 'compute-manager-owned-non-mutating-gas-cell-eos-producer-stage-task');
  assert.equal(result.gasCellEosProducerStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(result.gasCellEosProducerStageTaskAuthority.pressureInterfaceMutationApproved, false);

  result.destroyGasPressureCellsBuffer?.();
  assert.equal(result.gasPressureCellsBuffer.destroyed, true);
});

test('SPH spatial gas ledger producer stage derives compact ledger from retained product-event rows', async () => {
  const compactRows = compactSpatialGasRowsFixture();
  const device = fakeSummaryDevice(compactRows);
  const residentProductMass = residentProductMassHandle({
    label: 'resident-product-events',
    rowCount: 2,
    byteLength: 2 * 32 * Float32Array.BYTES_PER_ELEMENT
  });
  const reactionTable = {
    schema: 'peercompute.ulg.sph-gpu-reaction-table.v0',
    productTermMetadata: [
      { productTermIndex: 0, material: 'h2', routing: 'gas' }
    ]
  };
  const task = createSphSpatialGasLedgerProducerStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:spatial-gas-ledger-producer-stage',
    laneId: 'ulg:test:spatial-gas-ledger-lane',
    stateKey: 'ulg:test:spatial-gas-ledger-state',
    domainKey: 'ulg:test-domain',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    residentProductMass,
    reactionTable,
    boxDimsM: [2, 2, 2],
    device
  });

  assert.equal(task.schema, ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(task.exportName, 'runSphSpatialGasLedgerProducerStageComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.suppressCommitDelta, true);
  assert.deepEqual(task.readFamilies, ['resident-product-mass', 'reaction-closure-table']);
  assert.deepEqual(task.writeFamilies, ['resident-spatial-gas-species-ledger']);
  assert.deepEqual(task.webgpu.retainedBufferRefs, ['resident-spatial-gas-species-ledger-buffer']);
  assert.equal(task.gpuFence.required, true);
  assert.equal(task.gpuResidentLane.owner, 'ulg-resident-spatial-gas-ledger-law');

  const result = await runSphSpatialGasLedgerProducerStageComputeTask(task.data);

  assert.equal(result.computeTaskResultSchema, ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(result.computeTaskId, 'ulg:test:spatial-gas-ledger-producer-stage');
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'spatial-gas-ledger-producer-stage-ready');
  assert.equal(result.fullProductEventReadbackPerformed, false);
  assert.equal(result.compactSpatialGasReadbackPerformed, true);
  assert.equal(result.compactSpatialGasReadbackByteLength, 96);
  assert.equal(result.compactSpatialGasRowCount, 2);
  assert.equal(result.spatialGasSpeciesLedger.schema, ULG_SPH_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA);
  assert.equal(result.spatialGasSpeciesLedger.status, 'spatial-gas-species-ledger-ready');
  assert.equal(result.spatialGasSpeciesLedger.cellCount, 2);
  assert.equal(result.aggregateSpatialGasLedgerFallbackUsed, false);
  assert.equal(result.spatialGasLedgerDerivation, 'positioned-product-event-rows');
  assert.equal(result.spatialGasPositionSource, 'resident-product-event-row-positions');
  assert.equal(result.spatialGasSpeciesLedger.cells[0].bySpecies.h2.moles, 100);
  assert.equal(result.spatialGasSpeciesLedger.cells[1].bySpecies.h2.moles, 200);
  assert.deepEqual(result.retainedSpatialGasSourceBufferRefs, ['resident-product-mass-buffer']);
  assert.deepEqual(result.retainedSpatialGasLedgerBufferRefs, ['resident-spatial-gas-species-ledger-buffer']);
  assert.equal(result.retainedSpatialGasLedgerSourceReady, true);
  assert.equal(result.retainedSpatialGasLedgerSource.schema, ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA);
  assert.equal(result.retainedSpatialGasLedgerSource.sourceTaskId, 'ulg:test:spatial-gas-ledger-producer-stage');
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.spatialGasLedgerProducerStageTaskEvidence.schema, 'peercompute.ulg.spatial-gas-ledger-producer-stage-task-evidence.v0');
  assert.equal(result.spatialGasLedgerProducerStageTaskEvidence.passed, true);
  assert.deepEqual(result.spatialGasLedgerProducerStageTaskEvidence.candidateWriteFamilies, ['resident-spatial-gas-species-ledger']);
  assert.ok(result.spatialGasLedgerProducerStageTaskEvidence.mustNotWriteFamilies.includes('resident-gas-pressure'));
  assert.equal(result.spatialGasLedgerProducerStageTaskAuthority.status, 'compute-manager-owned-non-mutating-spatial-gas-ledger-producer-stage-task');
  assert.equal(result.spatialGasLedgerProducerStageTaskAuthority.authoritativeStateMutation, false);

  result.destroySpatialGasLedgerRowsBuffer?.();
  assert.equal(result.spatialGasLedgerRowsBuffer.destroyed, true);
});

test('SPH spatial gas ledger producer blocks cross-device retained product-event buffers before binding', async () => {
  const sourceDevice = fakeSummaryDevice(compactSpatialGasRowsFixture());
  const consumerDevice = fakeSummaryDevice(compactSpatialGasRowsFixture());
  const residentProductMass = tagResidentProductMassDevice(residentProductMassHandle({
    label: 'cross-device-product-events',
    rowCount: 2,
    byteLength: 2 * 32 * Float32Array.BYTES_PER_ELEMENT,
    gasSpeciesRows: [
      { material: 'h2', materialId: 1, massKg: 0.002016, moles: 1, unplacedMassKg: 0.002016 }
    ]
  }), sourceDevice);

  const result = await runSphSpatialGasLedgerProducerStageComputeTask({
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    residentProductMass,
    reactionTable: {
      schema: 'peercompute.ulg.sph-gpu-reaction-table.v0',
      productTermMetadata: [
        { productTermIndex: 0, material: 'h2', routing: 'gas' }
      ]
    },
    boxDimsM: [2, 2, 2],
    device: consumerDevice
  });

  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.status, 'spatial-gas-ledger-producer-stage-ready');
  assert.equal(result.executionSource, 'aggregate-gas-ledger-single-cell-spatial-fallback');
  assert.equal(result.webgpuStatus.status, 'blocked-cross-device-product-event-buffer');
  assert.equal(result.productEventBufferDeviceMismatch, true);
  assert.equal(result.compactSpatialGasReadbackPerformed, false);
  assert.equal(result.fullProductEventReadbackPerformed, false);
  assert.equal(consumerDevice.bindGroups.length, 0);
  assert.equal(consumerDevice.dispatches.length, 0);
  assert.equal(result.spatialGasSpeciesLedger.status, 'spatial-gas-species-ledger-ready');
  assert.equal(result.spatialGasSpeciesLedger.cells[0].bySpecies.h2.moles, 1);
});

test('SPH spatial gas ledger producer blocks globally tagged cross-device product-event buffers', async () => {
  const sourceDevice = fakeSummaryDevice(compactSpatialGasRowsFixture());
  const consumerDevice = fakeSummaryDevice(compactSpatialGasRowsFixture());
  const residentProductMass = residentProductMassHandle({
    label: 'globally-tagged-product-events',
    rowCount: 2,
    byteLength: 2 * 32 * Float32Array.BYTES_PER_ELEMENT,
    gasSpeciesRows: [
      { material: 'h2', materialId: 1, massKg: 0.002016, moles: 1, unplacedMassKg: 0.002016 }
    ]
  });
  Object.defineProperty(residentProductMass, Symbol.for('peercompute.ulg.webgpu.device'), {
    value: sourceDevice,
    configurable: true
  });
  Object.defineProperty(residentProductMass.productEventBuffer, Symbol.for('peercompute.ulg.webgpu.device'), {
    value: sourceDevice,
    configurable: true
  });

  const result = await runSphSpatialGasLedgerProducerStageComputeTask({
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    residentProductMass,
    reactionTable: {
      schema: 'peercompute.ulg.sph-gpu-reaction-table.v0',
      productTermMetadata: [
        { productTermIndex: 0, material: 'h2', routing: 'gas' }
      ]
    },
    boxDimsM: [2, 2, 2],
    device: consumerDevice
  });

  assert.equal(result.webgpuStatus.status, 'blocked-cross-device-product-event-buffer');
  assert.equal(result.productEventBufferDeviceMismatch, true);
  assert.equal(result.productEventBufferSourceDeviceId.startsWith('ulg-webgpu-device:'), true);
  assert.equal(result.productEventBufferConsumerDeviceId.startsWith('ulg-webgpu-device:'), true);
  assert.notEqual(result.productEventBufferSourceDeviceId, result.productEventBufferConsumerDeviceId);
  assert.equal(consumerDevice.bindGroups.length, 0);
  assert.equal(consumerDevice.dispatches.length, 0);
});

test('SPH spatial gas ledger producer derives positioned gas rows when product support volume is missing', async () => {
  const productEventRows = productEventRowsFixture();
  const result = await runSphSpatialGasLedgerProducerStageComputeTask({
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    productEventRows,
    productEventRowCount: 2,
    productEventStrideFloats: 32,
    boxDimsM: [4, 4, 4],
    reactionTable: {
      schema: 'peercompute.ulg.sph-gpu-reaction-table.v0',
      productTermMetadata: [
        { productTermIndex: 0, material: 'h2', routing: 'gas' }
      ]
    },
    residentProductMass: {
      schema: 'peercompute.ulg.sph-resident-product-mass.v0',
      status: 'resident-product-mass-buffer-retained',
      productEventBufferRetained: true,
      productEventRowCount: 2,
      productEventStrideFloats: 32,
      gasSpeciesLedger: {
        schema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
        status: 'gas-species-resident-ledger-ready',
        records: [{
          material: 'h2',
          materialId: 3022823,
          massKg: 0.03,
          moles: 15,
          temperatureK: 293.15,
          eventCount: 2,
          status: 'ready'
        }]
      }
    }
  });

  assert.equal(result.status, 'spatial-gas-ledger-producer-stage-ready');
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.aggregateSpatialGasLedgerFallbackUsed, false);
  assert.equal(result.executionSource, 'cpu-product-event-compact-spatial-gas-ledger');
  assert.equal(result.spatialGasLedgerDerivation, 'positioned-product-event-rows');
  assert.equal(result.spatialGasPositionSource, 'resident-product-event-row-positions');
  assert.equal(result.spatialGasSupportVolumeFallbackM3, 32);
  assert.equal(result.spatialGasSpeciesLedger.spatialGasSupportVolumeSource, 'product-event-row-support-volume-or-derived-gas-ledger-share');
  assert.equal(result.spatialGasSpeciesLedger.sourceEventRowCount, 2);
  assert.equal(result.spatialGasSpeciesLedger.cellCount, 2);
  assert.deepEqual(result.spatialGasSpeciesLedger.cellDims, [2, 2, 2]);
  assert.equal(result.spatialGasSpeciesLedger.cells[0].bySpecies.h2.moles, 5);
  assert.equal(result.spatialGasSpeciesLedger.cells[1].bySpecies.h2.moles, 10);
  assert.equal(result.compactSpatialGasRows[7], 32);
  assert.equal(result.compactSpatialGasRows[SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS + 7], 32);
});

test('SPH spatial gas ledger producer stage falls back to aggregate gas ledger when retained event rows are positionless', async () => {
  const compactRows = new Float32Array(2 * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS);
  const result = await runSphSpatialGasLedgerProducerStageComputeTask({
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    productEventCompactRows: compactRows,
    productEventRowCount: 2,
    productEventStrideFloats: 32,
    boxDimsM: [4, 4, 4],
    residentProductMass: {
      schema: 'peercompute.ulg.sph-resident-product-mass.v0',
      status: 'resident-product-mass-buffer-retained',
      productEventBufferRetained: true,
      productEventRowCount: 2,
      productEventStrideFloats: 32,
      gasSpeciesLedger: {
        schema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
        status: 'gas-species-resident-ledger-ready',
        records: [{
          material: 'h2',
          materialId: 3022823,
          massKg: 0.02,
          moles: 10,
          temperatureK: 293.15,
          eventCount: 4,
          status: 'ready'
        }]
      }
    },
    gasPressureSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'gpu-resident-reaction-pressure-summary',
      boxDimsM: [4, 4, 4]
    }
  });

  assert.equal(result.status, 'spatial-gas-ledger-producer-stage-ready');
  assert.equal(result.aggregateSpatialGasLedgerFallbackUsed, true);
  assert.equal(result.executionSource, 'aggregate-gas-ledger-single-cell-spatial-fallback');
  assert.equal(result.fullProductEventReadbackPerformed, false);
  assert.equal(result.compactSpatialGasRowCount, 2);
  assert.equal(result.spatialGasLedgerDerivation, 'aggregate-gas-ledger-single-cell-sealed-box');
  assert.equal(result.spatialGasPositionSource, 'aggregate-gas-ledger-no-positioned-product-events');
  assert.equal(result.spatialGasSpeciesLedger.status, 'spatial-gas-species-ledger-ready');
  assert.equal(result.spatialGasSpeciesLedger.cellCount, 1);
  assert.deepEqual(result.spatialGasSpeciesLedger.cellDims, [1, 1, 1]);
  assert.deepEqual(result.spatialGasSpeciesLedger.cells[0].centerM, [2, 2, 2]);
  assert.equal(result.spatialGasSpeciesLedger.cells[0].volumeM3, 64);
  assert.equal(result.spatialGasSpeciesLedger.cells[0].bySpecies.h2.moles, 10);
  assert.equal(result.retainedSpatialGasLedgerSourceReady, false);
});

test('ComputeManager stage chain runs gas-cell EOS producer before pressureInterface import consumption', async () => {
  const buffers = manualBuffers({
    position: [1, 1, 1],
    velocity: [0, 0, 0],
    massKg: 8,
    restDensityKgPerM3: 8,
    mechanicsDtS: 1 / 60
  });
  const pressureFor = (pressurePa) => (pressurePa * 4) / (8.31446261815324 * 300);
  const compactRows = compactSpatialGasRowsFixture([
    {
      positionM: [0.5, 1, 1],
      materialId: 7,
      massKg: 0.04,
      moles: pressureFor(120000),
      temperatureK: 300,
      supportVolumeM3: 4,
      productTermIndex: 0,
      sourceRowIndex: 0
    },
    {
      positionM: [1.5, 1, 1],
      materialId: 7,
      massKg: 0.06,
      moles: pressureFor(180000),
      temperatureK: 300,
      supportVolumeM3: 4,
      productTermIndex: 0,
      sourceRowIndex: 1
    }
  ]);
  const device = fakeSummaryDevice(compactRows);
  const residentProductMass = residentProductMassHandle({
    label: 'resident-product-events-for-spatial-ledger',
    rowCount: 2,
    byteLength: 2 * 32 * Float32Array.BYTES_PER_ELEMENT
  });
  const reactionTable = {
    schema: 'peercompute.ulg.sph-gpu-reaction-table.v0',
    productTermMetadata: [
      { productTermIndex: 0, material: 'h2', routing: 'gas' }
    ]
  };
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0]
      }
    ]
  };
  const admissionCalls = [];
  const importCalls = [];
  const residentAuthorityHost = {
    publishPressureInterfaceGasCellFieldAdmission(options) {
      admissionCalls.push(options);
      return {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission-hot-buffer-publication.v0',
        status: 'pressure-interface-gas-cell-field-admission-published',
        committed: true,
        hotBufferKey: 'ulg:test:gas-eos-stage-chain-admission-hot-buffer',
        pressureInterfaceGasCellFieldAdmission: {
          schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
          status: 'pressure-interface-gas-cell-field-consumption-approved',
          gasCellFieldConsumptionApproved: true,
          sourceHotBufferKey: 'ulg:test:gas-eos-stage-chain-admission-hot-buffer',
          retainedGasCellFieldSource: options.source.retainedGasCellFieldSource,
          retainedGasPressureBufferRefs: options.retainedGasPressureBufferRefs,
          workerRetainedGasPressureBufferRefs: options.workerRetainedGasPressureBufferRefs
        }
      };
    },
    publishPressureInterfaceGasCellFieldImportSource(options) {
      importCalls.push(options);
      return {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import-hot-buffer-publication.v0',
        status: 'pressure-interface-gas-cell-field-import-published',
        committed: true,
        hotBufferKey: 'ulg:test:gas-eos-stage-chain-import-hot-buffer',
        pressureInterfaceGasCellFieldImport: {
          schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
          status: 'pressure-interface-gas-cell-field-import-ready',
          sourceHotBufferKey: 'ulg:test:gas-eos-stage-chain-import-hot-buffer',
          retainedGasCellFieldSource: options.source.retainedGasCellFieldSource,
          retainedGasPressureBufferRefs: options.retainedGasPressureBufferRefs,
          workerRetainedGasPressureBufferRefs: options.workerRetainedGasPressureBufferRefs,
          pressureInterfaceGasPressureCellRowCount: options.source.pressureInterfaceGasPressureCellRowCount,
          pressureInterfaceGasPressureCellRowStrideFloats: options.source.pressureInterfaceGasPressureCellRowStrideFloats,
          pressureInterfaceGasPressureCellRowByteLength: options.source.pressureInterfaceGasPressureCellRowByteLength,
          pressureInterfaceGasCellFieldAdmission: options.pressureInterfaceGasCellFieldAdmission,
          gasCellFieldSnapshot: options.gasCellFieldSnapshot
        }
      };
    }
  };
  const leases = new Map();
  const computeManager = {
    submitTask(task) {
      const data = { ...task.data };
      if (task.exportName === 'runSphSpatialGasLedgerProducerStageComputeTask') {
        return runSphSpatialGasLedgerProducerStageComputeTask({ ...data, preferWebGpu: true, device });
      }
      if (task.exportName === 'runSphGasCellEosProducerStageComputeTask') {
        return runSphGasCellEosProducerStageComputeTask({ ...data, preferWebGpu: true, device });
      }
      if (task.exportName === 'runSphPressureInterfaceStageComputeTask') {
        return runSphPressureInterfaceStageComputeTask({ ...data, preferWebGpu: false });
      }
      if (task.exportName === 'runMlsMpmMechanicsP2gStageComputeTask') {
        return runMlsMpmMechanicsP2gStageComputeTask({ ...data, preferWebGpu: false });
      }
      if (task.exportName === 'runMlsMpmMechanicsGridUpdateStageComputeTask') {
        return runMlsMpmMechanicsGridUpdateStageComputeTask({ ...data, preferWebGpu: false });
      }
      if (task.exportName === 'runMlsMpmMechanicsG2pStageComputeTask') {
        return runMlsMpmMechanicsG2pStageComputeTask({ ...data, preferWebGpu: false });
      }
      throw new Error(`unexpected task export ${task.exportName}`);
    },
    acquireGpuResidentLaneLease(spec) {
      const lease = {
        schema: 'peercompute.compute.gpu-resident-lane-lease.v0',
        leaseId: `${spec.laneId}:lease`,
        laneId: spec.laneId,
        stateKey: spec.stateKey,
        domainKey: spec.domainKey || null,
        queueFencePolicy: spec.queueFencePolicy,
        stagePlan: {
          schema: 'peercompute.compute.gpu-resident-lane-stage-plan.v0',
          contractSchema: spec.residentSequenceLaneContract.schema,
          status: 'stage-plan-ready',
          defaultEnabled: spec.residentSequenceLaneContract.defaultEnabled === true,
          stageCount: spec.residentSequenceLaneContract.passDagStages.length
        },
        residentSequenceLaneContract: spec.residentSequenceLaneContract
      };
      leases.set(lease.leaseId, lease);
      return lease;
    },
    async executeGpuResidentLaneStagePlan(leaseId, options = {}) {
      const lease = leases.get(leaseId);
      const stageResults = [];
      let input = options.input || null;
      for (const stage of lease.residentSequenceLaneContract.passDagStages) {
        const stageResult = await options.stageExecutors[stage.id]({ stage, input, lease });
        stageResults.push({
          stageId: stage.id,
          status: 'completed',
          executorSource: 'test-stage-executor',
          retainedBufferRefs: stageResult.retainedBufferRefs || [],
          summary: stageResult.summary || {},
          workerResidency: { status: 'blocked-worker-backend-missing' }
        });
        input = stageResult.value;
      }
      return {
        schema: 'peercompute.compute.gpu-resident-lane-stage-execution.v0',
        status: 'completed',
        completedStageCount: stageResults.length,
        stageResults,
        retainedBufferRefs: [...new Set(stageResults.flatMap((entry) => entry.retainedBufferRefs))],
        stagePlan: lease.stagePlan,
        gpuFence: {
          schema: 'peercompute.compute.gpu-fence-report.v0',
          status: 'queue-work-completed',
          required: true,
          fenceSatisfied: true
        }
      };
    },
    completeGpuResidentLaneLease(leaseId, result = {}) {
      const lease = leases.get(leaseId);
      return {
        schema: 'peercompute.compute.gpu-resident-lane-execution.v0',
        status: result.status || 'queue-work-completed',
        stagePlan: lease.stagePlan,
        gpuFence: {
          schema: 'peercompute.compute.gpu-fence-report.v0',
          status: 'queue-work-completed',
          required: true,
          fenceSatisfied: true,
          retainedBufferRefs: result.retainedBufferRefs || []
        }
      };
    },
    rejectGpuResidentLaneLease(leaseId, reason) {
      return { schema: 'peercompute.compute.gpu-resident-lane-rejection.v0', leaseId, status: 'rejected', reason };
    }
  };

  const step = await runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
    ...buffers,
    computeManager,
    modulePath: './sphMlsMpmGpuStep.js',
    stageTaskIdPrefix: 'ulg:test:gas-cell-eos-stage-chain',
    useNativeTaskGraph: false,
    useGpuHubResidentStageExecutors: false,
    preferWebGpu: true,
    readbackMode: 'full-parity-readback',
    includeSpatialGasLedgerProducerStage: true,
    includeGasCellEosProducerStage: true,
    includePressureInterfaceStage: true,
    residentProductMass,
    reactionTable,
    gasPressureSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'gpu-resident-reaction-pressure-summary',
      totalPressurePa: 180000,
      boxVolumeM3: 8,
      boxDimsM: [2, 2, 2],
      bySpecies: {}
    },
    materialInterfaceField,
    residentAuthorityHost,
    gpuResidentLaneId: 'ulg:test:gas-cell-eos-stage-chain-lane',
    gpuResidentLaneStateKey: 'ulg:test:gas-cell-eos-stage-chain-state'
  });

  assert.deepEqual(step.mechanicsStageTaskChain.stageOrder, [
    'p2g',
    'spatialGasLedgerProducer',
    'gasCellEosProducer',
    'pressureInterface',
    'gridUpdate',
    'g2p'
  ]);
  assert.equal(step.mechanicsStageTaskChain.gpuResidentLaneStageExecutionCompletedStageCount, 6);
  assert.equal(step.mechanicsStageTaskChain.stageTaskResultSchemas.spatialGasLedgerProducer, ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(step.mechanicsStageTaskChain.stageTaskResultSchemas.gasCellEosProducer, ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(step.mechanicsStageTaskChain.stageTaskResultSchemas.pressureInterface, ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(step.mechanicsStageTaskChain.stageTaskEvidencePassed.spatialGasLedgerProducer, true);
  assert.equal(step.mechanicsStageTaskChain.stageTaskEvidencePassed.gasCellEosProducer, true);
  assert.equal(step.mechanicsStageTaskChain.stageTaskEvidencePassed.pressureInterface, true);
  assert.equal(step.mechanicsStageTaskChain.spatialGasLedgerProducerReady, true);
  assert.equal(step.mechanicsStageTaskChain.spatialGasLedgerProducerCellCount, 2);
  assert.equal(step.mechanicsStageTaskChain.spatialGasLedgerProducerFullProductEventReadbackPerformed, false);
  assert.equal(step.mechanicsStageTaskChain.gasCellEosProducerImportPublicationStatus, 'gas-cell-eos-producer-import-published');
  assert.equal(step.mechanicsStageTaskChain.gasCellEosProducerPressureInterfaceImportReady, true);
  assert.equal(step.mechanicsStageTaskChain.gasCellEosProducerPressureInterfaceAdmissionApproved, true);
  assert.deepEqual(step.mechanicsStageTaskChain.gasCellEosProducerRetainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(admissionCalls.length, 1);
  assert.equal(importCalls.length, 1);
  assert.equal(admissionCalls[0].sourceStage, 'gasCellEosProducer');
  assert.equal(importCalls[0].source.retainedGasCellFieldSource.schema, ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA);
  assert.equal(importCalls[0].gasCellFieldSnapshot.localPressureGradientReady, true);
  assert.equal(
    step.mechanicsStageTaskChain.gpuResidentLaneStageTaskLaneSummaries.pressureInterface.pressureInterfaceGasCellFieldImportReady,
    true
  );
});

test('SPH pressure interface stage compute task declares retained force-row output without authority mutation', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0]
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 120000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
  };
  const task = createSphPressureInterfaceStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:pressure-interface-stage',
    laneId: 'ulg:test:pressure-interface-lane',
    stateKey: 'ulg:test:pressure-interface-state',
    domainKey: 'ulg:test-domain',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    gasPressureSummary,
    materialInterfaceField
  });

  assert.equal(task.schema, ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(task.exportName, 'runSphPressureInterfaceStageComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.suppressCommitDelta, true);
  assert.equal(task.gpuFence.required, true);
  assert.equal(task.gpuFence.laneId, 'ulg:test:pressure-interface-lane');
  assert.equal(task.gpuResidentLane.owner, 'ulg-pressure-interface-force-law');
  assert.deepEqual(task.writeFamilies, ['pressure-interface-force-rows']);
  assert.deepEqual(task.webgpu.retainedBufferRefs, ['pressure-interface-force-rows-buffer']);

  const result = await runSphPressureInterfaceStageComputeTask(task.data);

  assert.equal(result.computeTaskResultSchema, ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(result.computeTaskId, 'ulg:test:pressure-interface-stage');
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.pressureInterfaceForcePreview.schema, 'peercompute.ulg.sph-pressure-interface-force-preview.v0');
  assert.equal(result.pressureInterfaceForceSolver.schema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(result.pressureInterfaceForceSolver.status, 'pressure-interface-force-solver-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, false);
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.equal(result.forceRowCount, 2);
  assert.equal(result.forceRowValues.length, 2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length);
  assert.equal(result.pressureInterfaceForceRowsRetained, true);
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.schema, 'peercompute.ulg.pressure-interface-stage-task-evidence.v0');
  assert.equal(result.pressureInterfaceStageTaskEvidence.passed, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(result.pressureInterfaceStageTaskEvidence.localPressureGradientReady, false);
  assert.equal(result.pressureInterfaceStageTaskEvidence.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.deepEqual(result.pressureInterfaceStageTaskEvidence.candidateWriteFamilies, ['pressure-interface-force-rows']);
  assert.ok(result.pressureInterfaceStageTaskEvidence.mustNotWriteFamilies.includes('resident-product-mass'));
  assert.equal(result.pressureInterfaceStageTaskAuthority.status, 'compute-manager-owned-non-mutating-pressure-interface-stage-task');
  assert.equal(result.pressureInterfaceStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(result.pressureInterfaceStageTaskAuthority.gridForceApplicationApproved, false);
  assert.equal(result.pressureInterfaceStageTaskAuthority.commitDeltaSuppressed, true);
});

test('SPH pressure interface stage requires admission before consuming local gas-cell pressure fields', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0]
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 120000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] },
    gasCellField: {
      localPressureGradientReady: true,
      cellDims: [2, 1, 1],
      cells: [
        {
          gridIndex: [0, 0, 0],
          centerM: [0.5, 1, 1],
          pressurePa: 120000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        },
        {
          gridIndex: [1, 0, 0],
          centerM: [1.5, 1, 1],
          pressurePa: 180000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        }
      ]
    }
  };

  const result = await runSphPressureInterfaceStageComputeTask({
    computeTaskId: 'ulg:test:pressure-interface-stage-local-gas-blocked',
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    gasPressureSummary,
    materialInterfaceField,
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, true);
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionStatus, 'pressure-interface-gas-cell-field-admission-required');
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionApproved, false);
  assert.equal(result.pressureInterfaceGasCellFieldConsumerStatus, 'blocked-local-gas-cell-field-admission-required');
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldAdmissionStatus, 'pressure-interface-gas-cell-field-admission-required');
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldAdmissionApproved, false);
  assert.equal(result.pressureInterfaceStageTaskAuthority.pressureInterfaceGasCellFieldAdmissionRequired, true);
  assert.equal(result.pressureInterfaceStageTaskAuthority.pressureInterfaceGasCellFieldAdmissionApproved, false);
});

test('SPH pressure interface stage records admitted local gas-cell pressure field consumption', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 1,
    elementCount: 1,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 120000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] },
    gasCellField: {
      localPressureGradientReady: true,
      cellDims: [1, 1, 1],
      cells: [
        {
          gridIndex: [0, 0, 0],
          centerM: [0.5, 1, 1],
          pressurePa: 120000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 8
        }
      ]
    }
  };
  const pressureInterfaceGasCellFieldAdmission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    sourceHotBufferKey: 'ulg:test:gas-cell-hot-buffer',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer']
  };

  const result = await runSphPressureInterfaceStageComputeTask({
    computeTaskId: 'ulg:test:pressure-interface-stage-local-gas-admitted',
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    gasPressureSummary,
    materialInterfaceField,
    pressureInterfaceGasCellFieldAdmission,
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionSchema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA);
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionStatus, 'pressure-interface-gas-cell-field-consumption-approved');
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(result.pressureInterfaceGasCellFieldConsumerStatus, 'admitted-local-gas-cell-field-consumer-ready');
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(result.pressureInterfaceStageTaskAuthority.pressureInterfaceGasCellFieldAdmissionRequired, true);
  assert.equal(result.pressureInterfaceStageTaskAuthority.pressureInterfaceGasCellFieldAdmissionApproved, true);
});

test('SPH pressure interface stage consumes an admitted retained gas-cell field import', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0]
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 120000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
  };
  const pressureInterfaceGasCellFieldAdmission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    sourceHotBufferKey: 'ulg:test:gas-cell-import-hot-buffer',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer']
  };
  const pressureInterfaceGasCellFieldImport = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
    status: 'pressure-interface-gas-cell-field-import-ready',
    sourceHotBufferKey: 'ulg:test:gas-cell-import-hot-buffer',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    pressureInterfaceGasCellFieldAdmission,
    gasCellFieldSnapshot: {
      localPressureGradientReady: true,
      cellDims: [2, 1, 1],
      cells: [
        {
          gridIndex: [0, 0, 0],
          centerM: [0.5, 1, 1],
          pressurePa: 120000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        },
        {
          gridIndex: [1, 0, 0],
          centerM: [1.5, 1, 1],
          pressurePa: 180000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        }
      ]
    }
  };

  const result = await runSphPressureInterfaceStageComputeTask({
    computeTaskId: 'ulg:test:pressure-interface-stage-local-gas-import',
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    gasPressureSummary,
    materialInterfaceField,
    pressureInterfaceGasCellFieldImport,
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, true);
  assert.deepEqual(result.pressureInterfaceForceSolver.gasInterfacePressureRangePa, [120000, 180000]);
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(result.pressureInterfaceGasCellFieldImportSchema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA);
  assert.equal(result.pressureInterfaceGasCellFieldImportStatus, 'pressure-interface-gas-cell-field-import-ready');
  assert.equal(result.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(result.pressureInterfaceGasCellFieldImportSourceHotBufferKey, 'ulg:test:gas-cell-import-hot-buffer');
  assert.deepEqual(result.pressureInterfaceGasCellFieldImportRetainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldImportSourceHotBufferKey, 'ulg:test:gas-cell-import-hot-buffer');
  assert.equal(result.pressureInterfaceStageTaskAuthority.pressureInterfaceGasCellFieldImportReady, true);
});

test('SPH pressure interface stage declares retained gas-cell buffers for local imports', () => {
  const pressureInterfaceGasCellFieldAdmission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    sourceHotBufferKey: 'ulg:test:gas-cell-import-hot-buffer',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer']
  };
  const pressureInterfaceGasCellFieldImport = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
    status: 'pressure-interface-gas-cell-field-import-ready',
    sourceHotBufferKey: 'ulg:test:gas-cell-import-hot-buffer',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    pressureInterfaceGasCellFieldAdmission,
    gasCellFieldSnapshot: {
      localPressureGradientReady: true,
      cellDims: [2, 1, 1],
      cells: [
        {
          gridIndex: [0, 0, 0],
          centerM: [0.5, 1, 1],
          pressurePa: 120000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        },
        {
          gridIndex: [1, 0, 0],
          centerM: [1.5, 1, 1],
          pressurePa: 180000,
          pressureGradientPaPerM: [0, 0, 0],
          volumeM3: 4
        }
      ]
    }
  };

  const task = createSphPressureInterfaceStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:pressure-interface-stage-local-gas-import-retained-refs',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    pressureInterfaceGasCellFieldImport,
    materialInterfaceField: {
      schema: 'peercompute.ulg.sph-material-interface-field.v0',
      status: 'material-interface-field-ready',
      readySurfaceCount: 1,
      totalSurfaceAreaM2: 1,
      elements: []
    }
  });

  assert.deepEqual(task.webgpu.retainedBufferRefs, [
    'pressure-interface-force-rows-buffer',
    'resident-gas-pressure-cells-buffer'
  ]);
  assert.deepEqual(task.gpuFence.retainedBufferRefs, [
    'pressure-interface-force-rows-buffer',
    'resident-gas-pressure-cells-buffer'
  ]);
  assert.deepEqual(task.gpuResidentLane.retainedBufferRefs, [
    'pressure-interface-force-rows-buffer',
    'resident-gas-pressure-cells-buffer'
  ]);
  assert.deepEqual(task.data.gpuFenceRequirement.retainedBufferRefs, [
    'pressure-interface-force-rows-buffer',
    'resident-gas-pressure-cells-buffer'
  ]);
});

test('SPH pressure interface stage blocks gas-cell field imports without retained refs', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 1,
    elementCount: 1,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      }
    ]
  };
  const pressureInterfaceGasCellFieldAdmission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    sourceHotBufferKey: 'ulg:test:gas-cell-import-hot-buffer'
  };
  const result = await runSphPressureInterfaceStageComputeTask({
    computeTaskId: 'ulg:test:pressure-interface-stage-local-gas-import-blocked',
    preferWebGpu: false,
    readbackMode: 'no-full-readback',
    gasPressureSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'synthetic-pressure',
      totalPressurePa: 120000,
      boxVolumeM3: 8,
      boxDimsM: [2, 2, 2],
      bySpecies: {},
      strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
    },
    materialInterfaceField,
    pressureInterfaceGasCellFieldImport: {
      schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
      status: 'pressure-interface-gas-cell-field-import-ready',
      sourceHotBufferKey: 'ulg:test:gas-cell-import-hot-buffer',
      retainedGasPressureBufferRefs: [],
      pressureInterfaceGasCellFieldAdmission,
      gasCellFieldSnapshot: {
        localPressureGradientReady: true,
        cellDims: [1, 1, 1],
        cells: [
          {
            gridIndex: [0, 0, 0],
            centerM: [0.5, 1, 1],
            pressurePa: 180000,
            pressureGradientPaPerM: [0, 0, 0],
            volumeM3: 8
          }
        ]
      }
    },
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, false);
  assert.equal(result.pressureInterfaceGasCellFieldImportReady, false);
  assert.equal(result.pressureInterfaceGasCellFieldImportStatus, 'pressure-interface-gas-cell-field-import-retained-buffer-ref-required');
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionStatus, 'not-required-uniform-pressure-field');
  assert.equal(result.pressureInterfaceGasCellFieldAdmissionApproved, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureInterfaceGasCellFieldImportReady, false);
});

test('SPH pressure interface stage compute task can produce force rows with WebGPU', async () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normal: [1, 0, 0],
        normalAreaVectorM2: [1, 0, 0]
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normal: [-1, 0, 0],
        normalAreaVectorM2: [-1, 0, 0]
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status: 'synthetic-pressure',
    totalPressurePa: 120000,
    boxVolumeM3: 8,
    boxDimsM: [2, 2, 2],
    bySpecies: {},
    strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
  };
  const device = fakeSummaryDevice(new Float32Array(2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length));
  const result = await runSphPressureInterfaceStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    computeTaskId: 'ulg:test:pressure-interface-stage-webgpu',
    preferWebGpu: true,
    readbackMode: 'full-parity-readback',
    device,
    gpuFenceRequirement: {
      schema: 'peercompute.compute.gpu-fence-requirement.v0',
      required: true,
      laneId: 'ulg:test:pressure-interface-lane',
      stateKey: 'ulg:test:pressure-interface-state'
    },
    gasPressureSummary,
    materialInterfaceField,
    expectedOutputFamilies: ['pressure-interface-force-rows'],
    pressureInterfaceStageTask: true
  });

  assert.equal(result.computeTaskResultSchema, ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.webgpuStatus.status, 'webgpu-executed');
  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.queueCompletionStatus, 'readback-map-completed');
  assert.equal(result.queueCompletionMethod, 'mapAsync(readback-buffer)');
  assert.equal(result.fullReadbackPerformed, true);
  assert.equal(result.normalHotLoopReadbackFree, false);
  assert.equal(result.forceRowCount, 2);
  assert.equal(result.forceRowValues.length, 2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length);
  assert.equal(result.forceRowsBuffer.label, 'ulg-sph-pressure-interface-force-rows-out');
  assert.equal(result.forceRowsBufferByteLength, 2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(result.forceRowStrideFloats, SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length);
  assert.equal(result.forceRowByteLength, 2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(result.pressureInterfaceForceRowsBufferRetained, true);
  assert.equal(result.pressureInterfaceForceSolver.backend, 'webgpu');
  assert.equal(result.pressureInterfaceForceSolver.status, 'pressure-interface-force-solver-ready');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, false);
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.equal(result.pressureInterfaceStageTaskEvidence.passed, true);
  assert.equal(result.pressureInterfaceStageTaskEvidence.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(result.pressureInterfaceStageTaskEvidence.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.equal(result.pressureInterfaceStageTaskEvidence.executionSource, 'sphPressureInterfaceForceRowsWebGpu');
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(device.dispatches.length > 0, true);
  assert.ok(device.writes.some((entry) => entry.label === 'ulg-sph-pressure-interface-elements-in'));
  assert.ok(device.writes.some((entry) => entry.label === 'ulg-sph-pressure-interface-force-params'));
});

test('SPH reaction product stage compute task declares retained product lane output without authority mutation', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceStateBuffer = tracker.buffer('reaction-state-in');
  const sourceThermoBuffer = tracker.buffer('reaction-thermo-in');
  const sourceMechanicsBuffer = tracker.buffer('reaction-mechanics-in');
  const productEventBuffer = tracker.buffer('reaction-product-events');
  const task = createSphReactionProductStageComputeTask({
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:reaction-product-stage',
    laneId: 'ulg:test:reaction-product-lane',
    stateKey: 'ulg:test:reaction-product-state',
    domainKey: 'ulg:test-domain',
    preferWebGpu: true,
    sphParticleState: buffers.sphParticleState,
    mlsMpmParticleState: buffers.mlsMpmParticleState,
    reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v0', reactionCount: 1, productTermCount: 1, gasProductCount: 0 },
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: sourceStateBuffer,
      thermoBuffer: sourceThermoBuffer
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: sourceMechanicsBuffer
    },
    sourceStateBuffer,
    sourceThermoBuffer,
    sourceMechanicsBuffer
  });

  assert.equal(task.schema, ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(task.exportName, 'runSphReactionProductStageComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.suppressCommitDelta, true);
  assert.equal(task.gpuFence.required, true);
  assert.equal(task.gpuFence.laneId, 'ulg:test:reaction-product-lane');
  assert.equal(task.gpuResidentLane.owner, 'ulg-reaction-product-gas-law');
  assert.deepEqual(task.writeFamilies, ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'resident-product-mass']);
  assert.deepEqual(task.webgpu.retainedBufferRefs, ['sph-state-buffer', 'sph-thermo-buffer', 'mls-mpm-mechanics-buffer', 'resident-product-mass-buffer']);

  const result = await runSphReactionProductStageComputeTask({
    ...task.data,
    reactionStepRunner(args) {
      assert.equal(args.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
      assert.equal(args.mlsMpmParticleUpload.mechanicsBuffer, sourceMechanicsBuffer);
      assert.equal(args.sourceStateBuffer, sourceStateBuffer);
      assert.equal(args.sourceThermoBuffer, sourceThermoBuffer);
      assert.equal(args.sourceMechanicsBuffer, sourceMechanicsBuffer);
      assert.equal(args.retainOutputParticleBuffers, true);
      return {
        schema: 'peercompute.ulg.sph-gpu-reaction-step-execution.v0',
        backend: 'webgpu',
        status: 'webgpu-accepted',
        webgpuStatus: { status: 'webgpu-executed' },
        result: {
          schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
          backend: 'webgpu',
          status: 'reaction-step-executed',
          particleCount: buffers.sphParticleState.particleCount,
          reactionCount: 1,
          productTermCount: 1,
          gasProductCount: 0,
          state: new Float32Array(),
          thermo: new Float32Array(),
          mechanics: new Float32Array(),
          stateBuffer: tracker.buffer('reaction-state-out'),
          thermoBuffer: tracker.buffer('reaction-thermo-out'),
          mechanicsBuffer: tracker.buffer('reaction-mechanics-out'),
          stateBufferByteLength: buffers.sphParticleState.state.byteLength,
          thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
          mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
          residentProductMass: {
            schema: ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA,
            status: 'resident-product-mass-buffer-retained',
            productEventBuffer,
            productEventBufferRetained: true,
            productEventBufferByteLength: 64,
            productEventRowCount: 1
          },
          residentProductMassStatus: 'resident-product-mass-buffer-retained',
          residentProductMassBufferRetained: true,
          retainedOutputParticleBuffers: true,
          readbackMode: 'full-parity-readback',
          fullReadbackPerformed: true,
          normalHotLoopReadbackFree: false
        }
      };
    }
  });

  assert.equal(result.computeTaskResultSchema, ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_SCHEMA);
  assert.equal(result.computeTaskId, 'ulg:test:reaction-product-stage');
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'webgpu-accepted');
  assert.equal(result.stateBuffer.label, 'reaction-state-out');
  assert.equal(result.thermoBuffer.label, 'reaction-thermo-out');
  assert.equal(result.mechanicsBuffer.label, 'reaction-mechanics-out');
  assert.equal(result.residentProductMass.productEventBuffer, productEventBuffer);
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.required, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.reactionProductStageTaskEvidence.schema, 'peercompute.ulg.reaction-product-stage-task-evidence.v0');
  assert.equal(result.reactionProductStageTaskEvidence.passed, true);
  assert.deepEqual(result.reactionProductStageTaskEvidence.candidateWriteFamilies, [
    'sph-particle-state',
    'sph-thermo-phase',
    'mls-mpm-mechanics',
    'resident-product-mass'
  ]);
  assert.ok(result.reactionProductStageTaskEvidence.mustNotWriteFamilies.includes('pressure-interface-force-rows'));
  assert.equal(result.reactionProductStageTaskAuthority.status, 'compute-manager-owned-non-mutating-reaction-product-stage-task');
  assert.equal(result.reactionProductStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(result.reactionProductStageTaskAuthority.commitDeltaSuppressed, true);
});

test('MLS-MPM resident step compute task submit helper uses a ComputeManager-compatible submitTask surface', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const submitted = [];
  const computeManager = {
    submitTask(task) {
      submitted.push(task);
      return Promise.resolve({ acceptedTaskId: task.id, laneId: task.gpuResidentLane?.laneId });
    }
  };

  const result = await submitMlsMpmResidentStepComputeTask({
    computeManager,
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:submit-task',
    laneId: 'ulg:test:sph-resident-submit',
    stateKey: 'ulg:test:sph-state-submit'
  });

  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].schema, ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA);
  assert.equal(submitted[0].gpuResidentLane.laneId, 'ulg:test:sph-resident-submit');
  assert.equal(submitted[0].gpuFence.stateKey, 'ulg:test:sph-state-submit');
  assert.deepEqual(result, {
    acceptedTaskId: 'ulg:test:submit-task',
    laneId: 'ulg:test:sph-resident-submit'
  });
});

test('MLS-MPM resident steps compute task declares a ComputeManager GPU lane pass DAG', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const task = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-steps-task',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    domainKey: 'ulg:test-domain',
    stepCount: 3,
    compactSummaryMode: 'final-only'
  });

  assert.equal(task.schema, ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA);
  assert.equal(task.runtime, 'js');
  assert.equal(task.exportName, 'runMlsMpmResidentStepsComputeTask');
  assert.equal(task.residency, 'gpu-lane');
  assert.equal(task.gpuResidentLane.schema, 'peercompute.compute.gpu-resident-lane-task.v0');
  assert.equal(task.gpuResidentLane.laneId, 'ulg:test:sph-resident-steps');
  assert.equal(task.gpuResidentLane.stateKey, 'ulg:test:sph-state-steps');
  assert.equal(task.gpuResidentLane.domainKey, 'ulg:test-domain');
  assert.equal(task.gpuResidentLane.copyBudget.readbackBytes, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(task.gpuResidentLane.copyBudget.compactSummaryBytes, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(task.gpuResidentLane.activeGridDispatchPolicy.enabled, false);
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.schema, 'peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0');
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.sequenceRequested, false);
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.sequenceRunnable, false);
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.defaultEnabled, false);
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.sequenceMode, 'per-step-resident-pass-dag');
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.activeGridDispatchPolicy.enabled, false);
  assert.equal(task.webgpu.activeGridDispatchPolicy.enabled, false);
  assert.equal(task.webgpu.residentSequenceLaneContract.sequenceRunnable, false);
  assert.equal(task.lawGraphNode.schema, 'peercompute.ulg.law-graph-node-task-ref.v0');
  assert.equal(task.lawGraphNode.nodeId, 'ulg-mls-mpm-sph-resident-pass-dag');
  assert.equal(task.lawGraphNode.runtimeTarget, 'webgpu-resident-lane');
  assert.equal(task.lawGraphNode.activeGridDispatchPolicy.enabled, false);
  assert.equal(task.lawGraphNode.residentSequenceLaneContract.authority, 'compute-manager-gpuhub-resident-lane-contract');
  assert.deepEqual(task.readFamilies, task.gpuResidentLane.readFamilies);
  assert.deepEqual(task.expectedOutputFamilies, task.writeFamilies);
  assert.equal(task.data.gpuResidentLaneManager, undefined);
  assert.equal(task.data.stepCount, 3);
  assert.equal(task.data.lawGraphNode.nodeId, 'ulg-mls-mpm-sph-resident-pass-dag');
  assert.equal(task.data.residentSequenceLaneContract.sequenceMode, 'per-step-resident-pass-dag');
});

test('MLS-MPM resident steps compute task can budget no compact-summary readback', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const task = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-steps-no-summary-task',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    domainKey: 'ulg:test-domain',
    stepCount: 3,
    compactSummaryMode: 'none'
  });

  assert.equal(task.data.compactSummaryMode, 'none');
  assert.equal(task.gpuResidentLane.copyBudget.readbackBytes, 0);
  assert.equal(task.gpuResidentLane.copyBudget.compactSummaryBytes, 0);
  assert.equal(task.webgpu.copyBudget.readbackBytes, 0);
  assert.equal(task.webgpu.copyBudget.compactSummaryBytes, 0);
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.compactSummaryMode, 'none');
  assert.equal(task.gpuResidentLane.residentSequenceLaneContract.sequenceRunnable, false);
});

test('MLS-MPM resident steps expose WebGPU-Ocean hot-loop budget diagnostics', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const budget = summarizeMlsMpmResidentHotLoopBudget({
    ...options,
    stepCount: 4,
    compactSummaryMode: 'none'
  });

  assert.equal(budget.schema, ULG_MLS_MPM_WEBGPU_OCEAN_HOT_LOOP_BUDGET_SCHEMA);
  assert.equal(budget.status, 'webgpu-ocean-hot-loop-no-readback-budget');
  assert.equal(budget.normalHotLoopReadbackFree, true);
  assert.equal(budget.noSummaryReadback, true);
  assert.equal(budget.compactSummaryStepCount, 0);
  assert.equal(budget.readbackBytes, 0);
  assert.equal(budget.compactSummaryBytes, 0);

  const activeGridTask = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:resident-steps-hot-loop-budget-task',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    domainKey: 'ulg:test-domain',
    stepCount: 4,
    compactSummaryMode: 'none',
    activeGridDispatchPlanRefreshMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true
  });

  assert.equal(activeGridTask.webgpu.hotLoopBudget.schema, ULG_MLS_MPM_WEBGPU_OCEAN_HOT_LOOP_BUDGET_SCHEMA);
  assert.equal(activeGridTask.webgpu.hotLoopBudget.status, 'webgpu-ocean-hot-loop-no-readback-budget');
  assert.equal(activeGridTask.webgpu.hotLoopBudget.activeGridEnabled, true);
  assert.equal(activeGridTask.webgpu.hotLoopBudget.activeGridDispatchPlanFinalOnly, true);
  assert.equal(activeGridTask.webgpu.hotLoopBudget.readbackBytes, 0);
  assert.equal(activeGridTask.gpuResidentLane.hotLoopBudget, activeGridTask.webgpu.hotLoopBudget);
  assert.equal(activeGridTask.lawGraphNode.hotLoopBudget.status, 'webgpu-ocean-hot-loop-no-readback-budget');
  assert.equal(activeGridTask.data.hotLoopBudget.copyBudget.readbackBytes, 0);
  assert.equal(activeGridTask.gpuResidentLane.copyBudget.readbackBytes, 0);
});

test('MLS-MPM resident steps compute task handler returns fence evidence without local double leasing', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const ignoredLaneManager = fakeGpuResidentLaneManager();
  const task = createMlsMpmResidentStepsComputeTask({
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    laneId: 'ulg:test:sph-resident-steps',
    stateKey: 'ulg:test:sph-state-steps',
    stepCount: 2,
    compactSummaryMode: 'final-only',
    gpuResidentLaneManager: ignoredLaneManager
  });
  task.data.peerComputeSolverTask = {
    schema: ULG_MLS_MPM_RESIDENT_STEPS_SOLVER_TASK_BRIDGE_SCHEMA,
    status: 'solver-task-created',
    created: true,
    solverTaskSchema: 'peercompute.compute.solver-task.v0',
    solverId: 'ulg-mls-mpm-sph-resident-steps',
    taskFamily: 'ulg-mls-mpm-sph-resident-steps',
    affinityKey: 'ulg-mls-mpm-sph-resident-steps:ulg:test:sph-state-steps',
    warmDeltaScope: 'ulg-sph-resident-pass-dag'
  };
  const result = await runMlsMpmResidentStepsComputeTask(task.data);

  assert.equal(result.schema, ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA);
  assert.equal(result.computeTaskResultSchema, ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA);
  assert.equal(result.computeTaskSchema, ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA);
  assert.equal(result.peerComputeSolverTask.schema, ULG_MLS_MPM_RESIDENT_STEPS_SOLVER_TASK_BRIDGE_SCHEMA);
  assert.equal(result.peerComputeSolverTask.created, true);
  assert.equal(result.peerComputeSolverTask.solverTaskSchema, 'peercompute.compute.solver-task.v0');
  assert.equal(result.status, 'resident-steps-executed');
  assert.equal(result.completedStepCount, 2);
  assert.equal(result.gpuFence.schema, 'peercompute.compute.gpu-fence-report.v0');
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuFence.laneId, 'ulg:test:sph-resident-steps');
  assert.equal(result.gpuFence.stateKey, 'ulg:test:sph-state-steps');
  assert.equal(result.residentSequenceLaneContract.schema, 'peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0');
  assert.equal(result.residentSequenceLaneContract.sequenceRequested, false);
  assert.equal(result.residentSequenceLaneContract.defaultEnabled, false);
  assert.deepEqual(result.gpuFence.retainedBufferRefs, [
    'p2g-grid-buffer',
    'updated-grid-buffer',
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
  assert.equal(result.lawGraphNode.nodeId, 'ulg-mls-mpm-sph-resident-pass-dag');
  assert.equal(result.commitDelta.schema, ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA);
  assert.equal(result.commitDelta.taskId, task.id);
  assert.equal(result.commitDelta.scope, 'ulg-sph-resident-pass-dag');
  assert.equal(result.commitDelta.payload.schema, ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA);
  assert.equal(result.commitDelta.payload.stateKey, 'ulg:test:sph-state-steps');
  assert.equal(result.commitDelta.payload.completedStepCount, 2);
  assert.equal(result.commitDelta.payload.lawGraphNode.nodeId, 'ulg-mls-mpm-sph-resident-pass-dag');
  assert.equal(result.commitDelta.payload.residentSequenceLaneContract.schema, 'peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0');
  assert.equal(result.commitDelta.payload.residentSequenceLaneContract.sequenceMode, 'per-step-resident-pass-dag');
  assert.deepEqual(result.commitDelta.payload.outputFamilies, task.expectedOutputFamilies);
  assert.equal(result.commitDelta.payload.gpuFence.fenceSatisfied, true);
  assert.deepEqual(result.commitDelta.payload.retainedBufferRefs, [
    'p2g-grid-buffer',
    'updated-grid-buffer',
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
  assert.equal(result.commitDelta.payload.finalStep.normalHotLoopReadbackFree, true);
  assert.equal(result.commitDelta.payload.stepSummaries.length, 2);
  assert.equal(result.commitDelta.payload.finalStep.diagnostics.gpuResidentLaneFenceSatisfied, false);
  assert.equal(result.gpuResidentLaneStatus, undefined);
  assert.equal(ignoredLaneManager.calls.acquire.length, 0);
  destroyMlsMpmResidentStepsBuffers(result);
});

test('MLS-MPM resident steps compute task submit helper uses a ComputeManager-compatible submitTask surface', async () => {
  const { options } = noFullReadbackResidentStepFixture();
  const submitted = [];
  const solverCreateCalls = [];
  const computeManager = {
    solverRegistry: {
      createTask(solverId, input = {}) {
        solverCreateCalls.push({ solverId, input });
        return {
          id: input.id,
          solverId,
          taskFamily: solverId,
          runtime: 'js',
          module: './registered-resident-solver.js',
          exportName: 'runMlsMpmResidentStepsComputeTask',
          webgpu: input.webgpu,
          affinityKey: `${solverId}:${input.stateKey}`,
          data: {
            schema: 'peercompute.compute.solver-task.v0',
            solver: {
              id: solverId,
              kind: 'sph-mls-mpm-resident-pass-dag',
              warmDelta: {
                scope: input.scope,
                schema: 'peercompute.ulg.mls-mpm-resident-steps.delta.v0'
              }
            },
            stateKey: input.stateKey,
            scope: input.scope,
            input: input.input,
            ...input.data
          }
        };
      }
    },
    submitTask(task) {
      submitted.push(task);
      return Promise.resolve({ acceptedTaskId: task.id, laneId: task.gpuResidentLane?.laneId });
    }
  };

  const result = await submitMlsMpmResidentStepsComputeTask({
    computeManager,
    ...options,
    modulePath: './sphMlsMpmGpuStep.js',
    taskId: 'ulg:test:submit-steps-task',
    laneId: 'ulg:test:sph-resident-steps-submit',
    stateKey: 'ulg:test:sph-state-steps-submit',
    stepCount: 2,
    compactSummaryMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 4
  });

  assert.equal(submitted.length, 1);
  assert.equal(solverCreateCalls.length, 1);
  assert.equal(solverCreateCalls[0].solverId, 'ulg-mls-mpm-sph-resident-steps');
  assert.equal(solverCreateCalls[0].input.id, 'ulg:test:submit-steps-task');
  assert.equal(solverCreateCalls[0].input.stateKey, 'ulg:test:sph-state-steps-submit');
  assert.equal(solverCreateCalls[0].input.input.laneId, 'ulg:test:sph-resident-steps-submit');
  assert.equal(solverCreateCalls[0].input.input.stepCount, 2);
  assert.equal(solverCreateCalls[0].input.input.activeGridDispatchPolicy.enabled, true);
  assert.equal(solverCreateCalls[0].input.input.activeGridDispatchPolicy.safetyCells, 4);
  assert.equal(solverCreateCalls[0].input.input.residentSequenceLaneContract.sequenceRunnable, true);
  assert.equal(
    solverCreateCalls[0].input.input.residentSequenceLaneContract.sequenceMode,
    'fused-no-full-active-grid-mechanics-sequence'
  );
  assert.equal(submitted[0].schema, ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA);
  assert.equal(submitted[0].module, './registered-resident-solver.js');
  assert.equal(submitted[0].data.schema, 'peercompute.compute.solver-task.v0');
  assert.equal(submitted[0].peerComputeSolverTask.schema, ULG_MLS_MPM_RESIDENT_STEPS_SOLVER_TASK_BRIDGE_SCHEMA);
  assert.equal(submitted[0].peerComputeSolverTask.created, true);
  assert.equal(submitted[0].peerComputeSolverTask.solverTaskSchema, 'peercompute.compute.solver-task.v0');
  assert.equal(submitted[0].peerComputeSolverTask.affinityKey, 'ulg-mls-mpm-sph-resident-steps:ulg:test:sph-state-steps-submit');
  assert.equal(submitted[0].data.peerComputeSolverTask.created, true);
  assert.equal(submitted[0].gpuResidentLane.laneId, 'ulg:test:sph-resident-steps-submit');
  assert.equal(submitted[0].gpuResidentLane.activeGridDispatchPolicy.enabled, true);
  assert.equal(submitted[0].gpuResidentLane.residentSequenceLaneContract.sequenceRunnable, true);
  assert.equal(submitted[0].gpuResidentLane.residentSequenceLaneContract.activeGridDispatchPolicy.enabled, true);
  assert.equal(submitted[0].gpuResidentLane.residentSequenceLaneContract.defaultEnabled, false);
  assert.equal(submitted[0].webgpu.activeGridDispatchPolicy.enabled, true);
  assert.equal(submitted[0].webgpu.residentSequenceLaneContract.sequenceMode, 'fused-no-full-active-grid-mechanics-sequence');
  assert.equal(submitted[0].data.activeGridDispatchPolicy.enabled, true);
  assert.equal(submitted[0].data.residentSequenceLaneContract.promotionStatus, 'active-grid-opt-in-scene-evidence-ready');
  assert.equal(submitted[0].data.activeGridDispatchPolicy.requiresFusedResidentSequence, true);
  assert.equal(submitted[0].gpuFence.stateKey, 'ulg:test:sph-state-steps-submit');
  assert.equal(submitted[0].lawGraphNode.nodeId, 'ulg-mls-mpm-sph-resident-pass-dag');
  assert.equal(submitted[0].data.gpuResidentLane.laneId, 'ulg:test:sph-resident-steps-submit');
  assert.equal(submitted[0].data.gpuFenceRequirement.stateKey, 'ulg:test:sph-state-steps-submit');
  assert.deepEqual(result, {
    acceptedTaskId: 'ulg:test:submit-steps-task',
    laneId: 'ulg:test:sph-resident-steps-submit'
  });
});

test('MLS-MPM resident step can attach a compact GPU summary without full state readback', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  let summaryCalls = 0;
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    compactSummaryScope: 'particle-visual',
    p2gRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-summary'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-summary'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-summary'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-summary'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    summaryRunner(args) {
      summaryCalls += 1;
      assert.equal(args.summaryScope, 'particle-visual');
      assert.equal(args.sphParticleUpload.stateBuffer.label, 'source-state');
      assert.equal(args.mlsMpmParticleUpload.mechanicsBuffer.label, 'source-mechanics');
      assert.equal(args.gridUpdate.gpuResult.updatedGridBuffer.label, 'updated-grid-summary');
      assert.equal(args.g2pReconstruction.stateBuffer.label, 'g2p-state-summary');
      assert.equal(args.g2pReconstruction.mechanicsBuffer.label, 'g2p-mechanics-summary');
      return {
        schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
        backend: 'webgpu',
        status: 'compact-summary-ready',
        summaryScope: 'particle-visual',
        particleCount: 1,
        gridNodeCount: 512,
        gridNodeScanCount: 0,
        gridNodeScanSkipped: true,
        activeGridNodeCount: null,
        activeGridNodeCountAvailable: false,
        activeGridNodeSummaryStatus: 'active-grid-node-summary-not-requested',
        sourceMassKg: 8,
        nextMassKg: 8,
        massDeltaKg: 0,
        sourceMomentumKgMPerS: [16, 0, 0],
        nextMomentumKgMPerS: [15, 0, 0],
        momentumDeltaKgMPerS: [-1, 0, 0],
        maxSpeedMPerS: 1.875,
        maxDisplacementM: 0.1875,
        minVolumeRatioJ: 0.98,
        maxVolumeRatioJ: 1.02,
        phaseMassKg: { solid: 3, liquid: 4, gas: 1, plasma: 0 },
        temperatureMassWeightedMeanK: 420,
        minTemperatureK: 273,
        maxTemperatureK: 1200,
        thermalReadyCount: 1,
        thermalProblemCount: 0,
        finiteTemperatureCount: 1,
        phaseMassTotalKg: 8,
        thermalPhaseSummaryAvailable: true,
        thermalSummaryStatus: 'thermal-phase-summary-ready',
        readbackMode: 'compact-summary-readback',
        compactGpuSummaryAvailable: true,
        compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
        reductionStrategy: 'two-pass-workgroup-reduction',
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
  });

  assert.equal(summaryCalls, 1);
  assert.equal(step.readbackMode, 'no-full-readback');
  assert.equal(step.state.length, 0);
  assert.equal(step.mechanics.length, 0);
  assert.equal(step.compactGpuSummary.status, 'compact-summary-ready', step.compactGpuSummary.reason);
  assert.equal(step.diagnostics.compactGpuSummaryAvailable, true);
  assert.equal(step.diagnostics.compactGpuSummaryStatus, 'compact-summary-ready');
  assert.equal(step.diagnostics.compactGpuSummaryReadbackMode, 'compact-summary-readback');
  assert.equal(step.diagnostics.compactSummaryScope, 'particle-visual');
  assert.equal(step.diagnostics.activeGridNodeCountAvailable, false);
  assert.equal(step.diagnostics.activeGridNodeSummaryStatus, 'active-grid-node-summary-not-requested');
  assert.equal(step.diagnostics.gridNodeScanCount, 0);
  assert.equal(step.diagnostics.gridNodeScanSkipped, true);
  assert.equal(step.diagnostics.compactReadbackByteLength, MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES);
  assert.equal(step.diagnostics.compactSummaryReductionStrategy, 'two-pass-workgroup-reduction');
  assert.equal(step.diagnostics.activeGridNodeCount, null);
  assert.equal(step.stageTiming.compactSummaryScope, 'particle-visual');
  assert.equal(step.diagnostics.massDeltaKg, 0);
  assert.equal(step.diagnostics.maxSpeedMPerS, 1.875);
  assert.deepEqual(step.diagnostics.phaseMassKg, { solid: 3, liquid: 4, gas: 1, plasma: 0 });
  assert.equal(step.diagnostics.temperatureMassWeightedMeanK, 420);
  assert.equal(step.diagnostics.thermalReadyCount, 1);
  assert.equal(step.diagnostics.thermalProblemCount, 0);
  assert.equal(step.diagnostics.thermalPhaseSummaryAvailable, true);
  assert.deepEqual(step.diagnostics.momentumDeltaKgMPerS, [-1, 0, 0]);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 4);
});

test('MLS-MPM resident step can refresh SPH state and thermo through a retained thermal GPU step', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const thermalResponseGraphUpload = {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseCount: 3,
    graphCount: 3
  };
  let thermalCalls = 0;
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    thermalStepOptions: {
      thermalResponseGraphUpload
    },
    p2gRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-thermal'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-thermal'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-before-thermal'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-after-thermal'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    thermalStepRunner(args) {
      thermalCalls += 1;
      assert.equal(args.sourceStateBuffer.label, 'g2p-state-before-thermal');
      assert.equal(args.sourceThermoBuffer, sourceThermoBuffer);
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.retainOutputParticleBuffers, true);
      assert.equal(args.thermalResponseGraphUpload, thermalResponseGraphUpload);
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer('thermal-state-after-g2p'),
        thermoBuffer: tracker.buffer('thermal-thermo-after-g2p'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
        },
        scientificValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
  });

  assert.equal(thermalCalls, 1);
  assert.equal(step.stageStatus.thermal, 'thermal-step-executed');
  assert.equal(step.stageBackends.thermal, 'webgpu');
  assert.equal(step.g2pStateBufferReplacedByThermalStep, true);
  assert.equal(step.thermalStateBufferHandoffStatus, 'thermal-state-buffer-drives-next-particles');
  assert.equal(step.thermalThermoBufferHandoffStatus, 'thermal-thermo-buffer-drives-next-particles');
  assert.equal(step.thermalMechanicsRefreshStatus, 'mechanics-constitutive-refresh-pending-after-thermal-state');
  assert.ok(step.residentAuthorityWarnings.includes('mechanics-constitutive-refresh-pending-after-thermal-state'));
  assert.equal(step.diagnostics.thermalMechanicsRefreshStatus, 'mechanics-constitutive-refresh-pending-after-thermal-state');
  assert.equal(step.nextParticleBufferMode, 'retained-thermal-output-and-g2p-mechanics-buffers');
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'thermal-state-after-g2p');
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer.label, 'thermal-thermo-after-g2p');
  assert.equal(step.nextParticleUploads.sphParticleUpload.ownsThermoBuffer, true);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'g2p-mechanics-after-thermal');
  assert.equal(step.nextParticleThermoBufferByteLength, buffers.sphParticleState.thermo.byteLength);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 6);
});

test('MLS-MPM resident step refreshes mechanics after a retained thermal GPU step', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const thermalResponseGraphUpload = {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseCount: 3,
    graphCount: 3
  };
  const mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable({
    h2o: {
      molarMassKgPerMol: 0.018,
      phases: [
        { name: 'liquid', densityKgPerM3: 1000, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273.15, 373.15] }
      ]
    }
  });
  let mechanicsRefreshCalls = 0;
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    mechanicsMaterialTable,
    thermalStepOptions: {
      thermalResponseGraphUpload
    },
    p2gRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-mechanics-refresh'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-mechanics-refresh'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-before-mechanics-refresh'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-before-refresh'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true
      };
    },
    thermalStepRunner() {
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer('thermal-state-for-mechanics-refresh'),
        thermoBuffer: tracker.buffer('thermal-thermo-for-mechanics-refresh'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true
      };
    },
    mechanicsRefreshRunner(args) {
      mechanicsRefreshCalls += 1;
      assert.equal(args.sourceStateBuffer.label, 'thermal-state-for-mechanics-refresh');
      assert.equal(args.sourceThermoBuffer.label, 'thermal-thermo-for-mechanics-refresh');
      assert.equal(args.sourceMechanicsBuffer.label, 'g2p-mechanics-before-refresh');
      assert.equal(args.mechanicsMaterialTable, mechanicsMaterialTable);
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.retainOutputParticleBuffers, true);
      return {
        schema: 'peercompute.ulg.mls-mpm-mechanics-refresh.v0',
        backend: 'webgpu',
        status: 'mechanics-constitutive-refresh-executed',
        particleCount: buffers.sphParticleState.particleCount,
        mechanics: new Float32Array(),
        mechanicsBuffer: tracker.buffer('refreshed-mechanics-after-thermal'),
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true
      };
    }
  });

  assert.equal(mechanicsRefreshCalls, 1);
  assert.equal(step.stageStatus.mechanicsRefresh, 'mechanics-constitutive-refresh-executed');
  assert.equal(step.stageBackends.mechanicsRefresh, 'webgpu');
  assert.equal(step.thermalMechanicsRefreshStatus, 'mechanics-constitutive-refreshed-after-thermal-state');
  assert.equal(step.diagnostics.thermalMechanicsRefreshStatus, 'mechanics-constitutive-refreshed-after-thermal-state');
  assert.equal(step.g2pMechanicsBufferReplacedByMechanicsRefresh, true);
  assert.equal(step.nextParticleBufferMode, 'retained-thermal-output-and-refreshed-mechanics-buffers');
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'refreshed-mechanics-after-thermal');
  assert.equal(step.residentAuthorityFamilyOwners.mechanics.ownerStage, 'mechanics-constitutive-refresh');
  assert.equal(step.residentAuthorityFamilyOwners.mechanics.status, 'mechanics-constitutive-refresh-drives-next-particles');
  assert.equal(step.residentAuthorityWarnings.includes('mechanics-constitutive-refresh-pending-after-thermal-state'), false);
  assert.equal(step.residentAuthorityWarnings.includes('thermal-stage-not-mechanics-authority'), false);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 7);
});

test('MLS-MPM resident no-full step runs reaction from retained GPU buffers', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const thermalResponseGraphUpload = {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseCount: 3,
    graphCount: 3
  };
  let reactionCalls = 0;
  let thermalDestroyCalls = 0;
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v0', reactionCount: 1 },
    thermalStepOptions: {
      thermalResponseGraphUpload
    },
    reactionStepOptions: {
      thermalResponseGraphUpload
    },
    p2gRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-reaction'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-reaction'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-before-thermal'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-before-reaction'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    thermalStepRunner(args) {
      assert.equal(args.thermalResponseGraphUpload, thermalResponseGraphUpload);
      const thermalStateBuffer = tracker.buffer('thermal-state-before-reaction');
      const thermalThermoBuffer = tracker.buffer('thermal-thermo-before-reaction');
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: thermalStateBuffer,
        thermoBuffer: thermalThermoBuffer,
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          thermalDestroyCalls += 1;
          thermalStateBuffer.destroy();
          thermalThermoBuffer.destroy();
        }
      };
    },
    reactionStepRunner(args) {
      reactionCalls += 1;
      assert.equal(args.sourceStateBuffer.label, 'thermal-state-before-reaction');
      assert.equal(args.sourceThermoBuffer.label, 'thermal-thermo-before-reaction');
      assert.equal(args.sourceMechanicsBuffer.label, 'g2p-mechanics-before-reaction');
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.retainOutputParticleBuffers, true);
      assert.equal(args.readCompactReactionSummary, false);
      assert.equal(args.readReactionGasSpeciesSummary, false);
      assert.equal(args.readReactionProductInventory, false);
      assert.equal(args.readReactionAtomResidual, false);
      assert.equal(args.thermalResponseGraphUpload, thermalResponseGraphUpload);
      const productEventBuffer = tracker.buffer('reaction-product-events-after-thermal');
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('reaction-state-after-thermal'),
        thermoBuffer: tracker.buffer('reaction-thermo-after-thermal'),
        mechanicsBuffer: tracker.buffer('reaction-mechanics-after-thermal'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        reactionSummary: {
          schema: ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
          backend: 'webgpu',
          status: 'reaction-compact-summary-ready',
          reactionSummaryAvailable: true,
          visibleProductMassKg: 3,
          visibleGasProductMassKg: 1,
          outputGasPhaseMassKg: 1,
          changedMaterialCount: 2,
          changedMassCount: 1,
          canonicalReactionEventCount: 1,
          consumedReactantMassKg: 6,
          expectedProductMassKg: 6,
          rawProductMassKg: 6.4,
          ledgerVisibleProductMassKg: 5,
          ledgerUnplacedProductMassKg: 1,
          ledgerGasProductMassKg: 1,
          ledgerVisibleGasProductMassKg: 0.5,
          ledgerUnplacedGasProductMassKg: 0.5,
          sealedBoxGasProductMoles: 250,
          reactionHeatJ: 6000,
          ledgerMassResidualKg: 0.4,
          ledgerReadyEventCount: 1,
          ledgerProblemEventCount: 0,
	          proposalMutualPairCount: 1,
	          compactLedgerAvailable: true,
	          productInventoryCount: 2,
	          productInventoryReadbackByteLength: 128,
	          productEventRowCount: 64,
	          productEventActiveEventCount: 1,
	          productEventReadbackByteLength: 0,
	          productEventBufferByteLength: 4096,
	          productEventBufferRetained: true,
	          productEventBuffer,
	          destroyProductEventBuffer() {
	            productEventBuffer.destroy();
	          },
	          productInventory: {
            schema: 'peercompute.ulg.sph-gpu-reaction-product-inventory.v0',
            status: 'product-inventory-compact-ledger-ready',
            recordCount: 2,
            materialCount: 2,
            records: [
              { material: 'ab', materialId: 300, massKg: 5, visibleMassKg: 5, unplacedMassKg: 0, moles: 83.333, productTermIndex: 0 },
              { material: 'c2', materialId: 400, massKg: 1, visibleMassKg: 0.5, unplacedMassKg: 0.5, moles: 250, productTermIndex: 1 }
            ],
            byMaterial: {
              ab: { material: 'ab', materialId: 300, massKg: 5, visibleMassKg: 5, unplacedMassKg: 0, moles: 83.333, productTermIndices: [0] },
              c2: { material: 'c2', materialId: 400, massKg: 1, visibleMassKg: 0.5, unplacedMassKg: 0.5, moles: 250, productTermIndices: [1] }
            },
            fullParticleReadbackPerformed: false
          },
          atomResidualCount: 2,
          atomResidualReadbackByteLength: 64,
          atomResidualSummary: {
            schema: ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
            status: 'atom-residual-compact-ledger-ready',
            recordCount: 2,
            maxAbsAtomResidualMol: 0,
            chargeResidualMol: 0,
            atomResidualMolByZ: { 1: 0 },
            records: [
              { reactionIndex: 0, termKind: 'reactant', termIndex: 0, atomicNumberZ: 1, atomResidualMol: -2, chargeResidualMol: 0, eventCount: 1 },
              { reactionIndex: 0, termKind: 'product', termIndex: 0, atomicNumberZ: 1, atomResidualMol: 2, chargeResidualMol: 0, eventCount: 1 }
            ],
            fullParticleReadbackPerformed: false
          },
          strictReactionGate: {
            schema: 'peercompute.ulg.sph-reaction-strict-gate.v0',
            status: 'strict-reaction-gate-pass',
            blockers: [],
            warnings: [],
            strictForceCouplingAllowed: true
          },
          readbackMode: 'compact-reaction-summary-readback',
          compactReadbackByteLength: 128,
          reductionStrategy: 'two-pass-workgroup-reduction',
          visibleOnly: true,
          unplacedProductInventoryIncluded: true
        },
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(reactionCalls, 1);
  assert.equal(step.stageStatus.thermal, 'thermal-step-executed');
  assert.equal(step.stageStatus.reaction, 'reaction-step-executed');
  assert.equal(step.stageBackends.reaction, 'webgpu');
  assert.equal(step.thermalOutputReplacedByReactionStep, true);
  assert.equal(step.g2pMechanicsBufferReplacedByReactionStep, true);
  assert.equal(step.nextParticleBufferMode, 'retained-reaction-output-buffers');
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'reaction-state-after-thermal');
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer.label, 'reaction-thermo-after-thermal');
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'reaction-mechanics-after-thermal');
  assert.equal(step.nextParticleMechanicsBufferByteLength, buffers.mlsMpmParticleState.mechanics.byteLength);
  assert.equal(step.diagnostics.reactionSummaryStatus, 'reaction-compact-summary-ready');
  assert.equal(step.diagnostics.reactionSummaryAvailable, true);
  assert.equal(step.diagnostics.reactionSummaryReadbackMode, 'compact-reaction-summary-readback');
  assert.equal(step.diagnostics.reactionSummaryReadbackByteLength, 128);
  assert.equal(step.diagnostics.reactionVisibleProductMassKg, 3);
  assert.equal(step.diagnostics.reactionVisibleGasProductMassKg, 1);
  assert.equal(step.diagnostics.reactionOutputGasPhaseMassKg, 1);
  assert.equal(step.diagnostics.reactionChangedMaterialCount, 2);
  assert.equal(step.diagnostics.reactionChangedMassCount, 1);
  assert.equal(step.diagnostics.reactionCanonicalEventCount, 1);
  assert.equal(step.diagnostics.reactionConsumedReactantMassKg, 6);
  assert.equal(step.diagnostics.reactionLedgerUnplacedProductMassKg, 1);
  assert.equal(step.diagnostics.reactionLedgerGasProductMassKg, 1);
  assert.equal(step.diagnostics.reactionLedgerUnplacedGasProductMassKg, 0.5);
  assert.equal(step.diagnostics.reactionSealedBoxGasProductMoles, 250);
  assert.equal(step.diagnostics.reactionHeatJ, 6000);
  assert.equal(step.diagnostics.reactionLedgerMassResidualKg, 0.4);
	  assert.equal(step.diagnostics.reactionCompactLedgerAvailable, true);
	  assert.equal(step.diagnostics.reactionProductInventoryCount, 2);
	  assert.equal(step.diagnostics.reactionProductInventoryReadbackByteLength, 128);
	  assert.equal(step.diagnostics.reactionProductEventRowCount, 64);
	  assert.equal(step.diagnostics.reactionProductEventActiveEventCount, 1);
	  assert.equal(step.diagnostics.reactionProductEventReadbackByteLength, 0);
	  assert.equal(step.diagnostics.reactionProductEventBufferByteLength, 4096);
	  assert.equal(step.diagnostics.reactionProductEventBufferRetained, true);
	  assert.equal(step.residentProductMass.schema, ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA);
	  assert.equal(step.residentProductMass.status, 'resident-product-mass-buffer-retained');
	  assert.equal(step.residentProductMass.productEventBuffer.label, 'reaction-product-events-after-thermal');
	  assert.equal(step.residentProductMass.consumeMassPolicy, 'unplaced-product-mass-only');
	  assert.equal(step.residentProductMassEosCouplingStatus, 'resident-product-mass-p2g-eos-sidecar-ready');
	  assert.equal(step.diagnostics.reactionResidentProductMassStatus, 'resident-product-mass-buffer-retained');
	  assert.equal(step.diagnostics.reactionResidentProductMassBufferRetained, true);
	  assert.equal(step.diagnostics.reactionResidentProductMassBufferByteLength, 4096);
	  assert.equal(step.diagnostics.reactionResidentProductMassProductEventRowCount, 64);
	  assert.equal(step.diagnostics.reactionResidentProductMassUnplacedProductMassKg, 1);
	  assert.equal(step.diagnostics.reactionResidentProductMassUnplacedGasProductMassKg, 0.5);
	  assert.equal(step.diagnostics.reactionResidentProductMassEosCouplingStatus, 'resident-product-mass-p2g-eos-sidecar-ready');
	  assert.equal(step.diagnostics.reactionProductInventory.byMaterial.c2.unplacedMassKg, 0.5);
  assert.deepEqual(step.diagnostics.reactionProductInventory.byMaterial.ab.productTermIndices, [0]);
  assert.equal(step.diagnostics.reactionAtomResidualCount, 2);
  assert.equal(step.diagnostics.reactionAtomResidualReadbackByteLength, 64);
  assert.equal(step.diagnostics.reactionAtomResidualSummary.maxAbsAtomResidualMol, 0);
  assert.equal(step.diagnostics.reactionAtomResidualSummary.chargeResidualMol, 0);
  assert.equal(step.diagnostics.reactionAtomResidualSummary.records[0].termKind, 'reactant');
  assert.equal(step.diagnostics.reactionStrictGateStatus, 'strict-reaction-gate-pass');
  assert.deepEqual(step.diagnostics.reactionStrictGateBlockers, []);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(thermalDestroyCalls, 1);
	  assert.equal(tracker.destroyed, 10);
});

test('MLS-MPM resident no-full step skips no-op reaction output buffers for next source', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const thermalResponseGraphUpload = {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    responseCount: 3,
    graphCount: 3
  };
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v0', reactionCount: 1 },
    thermalStepOptions: { thermalResponseGraphUpload },
    reactionStepOptions: { thermalResponseGraphUpload },
    p2gRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-noop-reaction'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-noop-reaction'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-before-noop-reaction'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-before-noop-reaction'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    thermalStepRunner() {
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer('thermal-state-before-noop-reaction'),
        thermoBuffer: tracker.buffer('thermal-thermo-before-noop-reaction'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true
      };
    },
    reactionStepRunner() {
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('reaction-state-noop'),
        thermoBuffer: tracker.buffer('reaction-thermo-noop'),
        mechanicsBuffer: tracker.buffer('reaction-mechanics-noop'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        reactionSummary: {
          schema: ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
          backend: 'webgpu',
          status: 'reaction-compact-summary-ready',
          reactionSummaryAvailable: true,
          changedMaterialCount: 0,
          changedMassCount: 0,
          visibleProductMassKg: 0,
          visibleGasProductMassKg: 0,
          outputGasPhaseMassKg: 0,
          canonicalReactionEventCount: 0,
          consumedReactantMassKg: 0,
          expectedProductMassKg: 0,
          rawProductMassKg: 0,
          ledgerVisibleProductMassKg: 0,
          ledgerUnplacedProductMassKg: 0,
          ledgerGasProductMassKg: 0,
          ledgerVisibleGasProductMassKg: 0,
          ledgerUnplacedGasProductMassKg: 0,
          sealedBoxGasProductMoles: 0,
          reactionHeatJ: 0,
          ledgerReadyEventCount: 0,
          ledgerProblemEventCount: 0,
          productEventActiveEventCount: 0,
          compactLedgerAvailable: true,
          readbackMode: 'compact-reaction-summary-readback',
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
          reductionStrategy: 'two-pass-workgroup-reduction'
        }
      };
    }
  });

  assert.equal(step.reactionOutputParticleMutation, false);
  assert.equal(step.reactionOutputBufferHandoffStatus, 'reaction-output-buffers-skipped-no-particle-mutation');
  assert.equal(step.thermalOutputReplacedByReactionStep, false);
  assert.equal(step.g2pMechanicsBufferReplacedByReactionStep, false);
  assert.equal(step.thermalStateBufferHandoffStatus, 'thermal-state-buffer-drives-next-particles');
  assert.equal(step.thermalThermoBufferHandoffStatus, 'thermal-thermo-buffer-drives-next-particles');
  assert.equal(step.thermalMechanicsRefreshStatus, 'mechanics-constitutive-refresh-pending-after-thermal-state');
  assert.ok(step.residentAuthorityWarnings.includes('mechanics-constitutive-refresh-pending-after-thermal-state'));
  assert.equal(step.nextParticleBufferMode, 'retained-thermal-output-and-g2p-mechanics-buffers');
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'thermal-state-before-noop-reaction');
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer.label, 'thermal-thermo-before-noop-reaction');
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'g2p-mechanics-before-noop-reaction');
  assert.equal(step.diagnostics.reactionSummaryAvailable, true);
  assert.equal(step.diagnostics.reactionCanonicalEventCount, 0);
  assert.equal(step.diagnostics.reactionConsumedReactantMassKg, 0);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 9);
});

test('MLS-MPM resident step merges carried and emitted product-event buffers on the GPU', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const carriedResidentProductMass = residentProductMassHandle({
    label: 'carried-product-events',
    rowCount: 2,
    byteLength: 256,
    unplacedProductMassKg: 2,
    unplacedGasProductMassKg: 1,
    generationCount: 2,
    sourceRowCounts: [1, 1],
    sourceByteLengths: [128, 128],
    gasSpeciesRows: [
      { material: 'h2', materialId: 1, massKg: 0.002016, moles: 1, unplacedMassKg: 0.002016 },
      { material: 'o2', materialId: 2, massKg: 0.032, moles: 1, unplacedMassKg: 0.032 }
    ]
  });
  const emittedResidentProductMass = residentProductMassHandle({
    label: 'emitted-product-events',
    rowCount: 3,
    byteLength: 384,
    unplacedProductMassKg: 3,
    unplacedGasProductMassKg: 1.5,
    gasSpeciesRows: [
      { material: 'h2', materialId: 1, massKg: 0.004032, moles: 2, unplacedMassKg: 0.004032 }
    ]
  });
  const p2gInputs = [];
  let mergeFenceCount = 0;
  device.queue.onSubmittedWorkDone = async () => {
    mergeFenceCount += 1;
  };

  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    residentProductMass: carriedResidentProductMass,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    thermalStepRunner: null,
    reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v0', reactionCount: 1 },
    summaryRunner: null,
    p2gRunner(args) {
      p2gInputs.push(args.residentProductMass);
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-merge'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        residentProductMassGridCouplingStatus: 'resident-product-mass-grid-coupled',
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-merge'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner() {
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-merge'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-merge'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    reactionStepRunner() {
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('reaction-state-merge'),
        thermoBuffer: tracker.buffer('reaction-thermo-merge'),
        mechanicsBuffer: tracker.buffer('reaction-mechanics-merge'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        residentProductMass: emittedResidentProductMass,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(p2gInputs[0], carriedResidentProductMass);
  assert.equal(step.inputResidentProductMassStatus, 'resident-product-mass-buffer-retained');
  assert.equal(step.emittedResidentProductMassStatus, 'resident-product-mass-buffer-retained');
  assert.equal(step.residentProductMassStatus, 'resident-product-mass-merged-gpu-resident');
  assert.equal(step.residentProductMassMergeStatus, 'resident-product-mass-merged-gpu-resident');
  assert.equal(step.residentProductMassMergeQueueCompletionStatus, 'queue-work-completed');
  assert.equal(step.residentProductMassMergeQueueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.equal(step.residentProductMass.productEventMergeQueueCompletionStatus, 'queue-work-completed');
  assert.equal(step.residentProductMass.productEventMergeQueueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.equal(step.residentProductMassProductEventRowCount, 5);
  assert.equal(step.mergedResidentProductMassProductEventRowCount, 5);
  assert.equal(step.residentProductMassGenerationCount, 3);
  assert.equal(step.residentProductMassBufferByteLength, 640);
  assert.equal(step.residentProductMassMergedBufferByteLength, 640);
  assert.equal(step.residentProductMassUnplacedProductMassKg, 5);
  assert.equal(step.residentProductMassUnplacedGasProductMassKg, 2.5);
  assert.equal(step.residentProductMassGasSpeciesLedgerCount, 2);
  assert.equal(step.residentProductMassSealedBoxGasProductMoles, 4);
  assert.equal(step.residentProductMass.gasSpeciesLedger.bySpecies.h2.moles, 3);
  assert.equal(step.residentProductMass.gasSpeciesLedger.bySpecies.o2.moles, 1);
  assert.equal(step.residentProductMassMergedInputBufferRetained, true);
  assert.equal(step.residentProductMassMergedEmittedBufferRetained, true);
  assert.equal(step.residentProductMassGridCouplingStatus, 'resident-product-mass-grid-coupled');
  assert.deepEqual(step.residentProductMass.productEventSourceRowCounts, [1, 1, 3]);
  assert.equal(step.residentProductMass.mergeSourceProductEventBufferCount, 3);
  assert.deepEqual(step.residentProductMass.mergeSourceProductEventBufferByteLengths, [128, 128, 384]);
  assert.equal(step.nextParticleUploads.residentProductMass, step.residentProductMass);
  assert.equal(step.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-active');
  assert.equal(step.residentBufferLeaseResourceCount, 3);
  assert.equal(step.residentBufferLeaseActiveLeaseCount, 1);
  assert.equal(
    step.residentBufferLeaseSummary.resources['resident-product-mass:ulg-sph-resident-product-mass-merged-product-events:5:640'].activeLeaseCount,
    1
  );
  assert.equal(device.copies.length, 2);
  assert.equal(device.copies[0].source, carriedResidentProductMass.productEventBuffer);
  assert.equal(device.copies[0].destination, step.residentProductMass.productEventBuffer);
  assert.equal(device.copies[0].destinationOffset, 0);
  assert.equal(device.copies[0].size, 256);
  assert.equal(device.copies[1].source, emittedResidentProductMass.productEventBuffer);
  assert.equal(device.copies[1].destination, step.residentProductMass.productEventBuffer);
  assert.equal(device.copies[1].destinationOffset, 256);
  assert.equal(device.copies[1].size, 384);
  assert.equal(device.submissions.length, 1);
  assert.equal(mergeFenceCount, 1);

  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(carriedResidentProductMass.destroyCalls, 0);
  assert.equal(carriedResidentProductMass.productEventBuffer.destroyed, false);
  assert.equal(emittedResidentProductMass.destroyCalls, 1);
  assert.equal(emittedResidentProductMass.productEventBuffer.destroyed, true);
  assert.equal(step.residentProductMass.productEventBuffer.destroyed, true);
  assert.equal(step.residentBufferLeaseCleanupStatus, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(step.residentBufferLeaseCleanup.destroyedResourceCount, 2);
});

test('MLS-MPM resident step cleanup preserves explicitly leased product-event buffers', () => {
  const preservedResidentProductMass = residentProductMassHandle({
    label: 'preserved-product-events',
    rowCount: 1,
    byteLength: 128
  });
  const step = {
    particlePingPong: { nextStep: 7, nextTime: 0.7 },
    residentProductMass: preservedResidentProductMass,
    nextParticleUploads: {
      residentProductMass: preservedResidentProductMass,
      sphParticleUpload: {
        ownsStateBuffer: false,
        ownsThermoBuffer: false
      },
      mlsMpmParticleUpload: {
        ownsMechanicsBuffer: false
      }
    }
  };

  destroyMlsMpmResidentStepBuffers(step, {
    preserveResidentProductMass: preservedResidentProductMass
  });

  assert.equal(preservedResidentProductMass.destroyCalls, 0);
  assert.equal(preservedResidentProductMass.productEventBuffer.destroyed, false);
  assert.equal(step.residentBufferLeaseCleanupStatus, 'resident-buffer-lease-ledger-active');
  assert.equal(step.residentBufferLeaseCleanup.skippedDestroyCount, 1);
  assert.equal(step.residentBufferLeaseCleanup.events[0].status, 'destroy-skipped-active-lease');
});

test('MLS-MPM resident step rejects stale CPU mirrors without retained GPU uploads', async () => {
  const buffers = manualBuffers();
  await assert.rejects(
    () => runMlsMpmResidentStepWithOptionalWebGpu({
      ...buffers,
      sphParticleState: {
        ...buffers.sphParticleState,
        status: 'gpu-resident-unread-ready',
        cpuStateStale: true
      },
      preferWebGpu: false
    }),
    /Stale SPH CPU mirror cannot drive/
  );

  await assert.rejects(
    () => runMlsMpmResidentStepWithOptionalWebGpu({
      ...buffers,
      mlsMpmParticleState: {
        ...buffers.mlsMpmParticleState,
        status: 'gpu-resident-unread-ready',
        cpuStateStale: true
      },
      preferWebGpu: false
    }),
    /Stale MLS-MPM CPU mirror cannot drive/
  );
});

test('MLS-MPM resident step accepts stale CPU mirrors when retained GPU uploads are authoritative', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    stateBuffer: tracker.buffer('authoritative-stale-sph-state'),
    thermoBuffer: tracker.buffer('authoritative-stale-sph-thermo'),
    ownsStateBuffer: false,
    ownsThermoBuffer: false,
    slot: 1
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    mechanicsBuffer: tracker.buffer('authoritative-stale-mls-mechanics'),
    ownsMechanicsBuffer: false,
    slot: 1
  };
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleState: {
      ...buffers.sphParticleState,
      status: 'gpu-resident-unread-ready',
      cpuStateStale: true
    },
    mlsMpmParticleState: {
      ...buffers.mlsMpmParticleState,
      status: 'gpu-resident-unread-ready',
      cpuStateStale: true
    },
    sphParticleUpload,
    mlsMpmParticleUpload,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    p2gRunner(args) {
      assert.equal(args.sphParticleUpload.stateBuffer.label, 'authoritative-stale-sph-state');
      assert.equal(args.mlsMpmParticleUpload.mechanicsBuffer.label, 'authoritative-stale-mls-mechanics');
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('stale-guard-p2g-grid'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      assert.equal(args.p2gGridBuffer.label, 'stale-guard-p2g-grid');
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('stale-guard-updated-grid'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      assert.equal(args.updatedGridBuffer.label, 'stale-guard-updated-grid');
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('stale-guard-next-state'),
        mechanicsBuffer: tracker.buffer('stale-guard-next-mechanics'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(step.status, 'resident-step-webgpu-executed');
  assert.equal(step.readbackMode, 'no-full-readback');
  assert.equal(step.normalHotLoopReadbackFree, true);
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'stale-guard-next-state');
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'stale-guard-next-mechanics');
});

test('MLS-MPM resident steps ping-pong retained particle buffers across repeated steps', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const p2gInputs = [];
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    p2gRunner(args) {
      p2gInputs.push({
        stateBufferLabel: args.sphParticleUpload?.stateBuffer?.label ?? null,
        mechanicsBufferLabel: args.mlsMpmParticleUpload?.mechanicsBuffer?.label ?? null
      });
      const result = projectMlsMpmP2gGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        gridBuffer: tracker.buffer(`p2g-grid-${p2gInputs.length}`),
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      const result = updateMlsMpmGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        updatedGridBuffer: tracker.buffer(`updated-grid-${p2gInputs.length}`),
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      const result = reconstructMlsMpmG2pCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        stateBuffer: tracker.buffer(`g2p-state-${p2gInputs.length}`),
        mechanicsBuffer: tracker.buffer(`g2p-mechanics-${p2gInputs.length}`),
        stateBufferByteLength: result.state.byteLength,
        mechanicsBufferByteLength: result.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA);
  assert.equal(execution.stepCount, 2);
  assert.equal(execution.completedStepCount, 2);
  assert.equal(execution.retainedIntermediateStepCount, 0);
  assert.equal(execution.finalStep.particlePingPong.sourceSlot, 1);
  assert.equal(execution.finalStep.particlePingPong.nextSlot, 0);
  assert.equal(execution.finalStep.particlePingPong.step, 1);
  assert.equal(execution.finalStep.particlePingPong.nextStep, 2);
  assert.equal(execution.nextSphParticleState.step, 2);
  assert.equal(execution.nextSphParticleState.time, 0.2);
  assert.equal(execution.nextSphParticleState.status, 'gpu-resident-readback-ready');
  assert.equal(execution.nextSphParticleState.cpuStateStale, false);
  assert.equal(execution.nextMlsMpmParticleState.step, 2);
  assert.equal(execution.nextMlsMpmParticleState.status, 'gpu-resident-readback-ready');
  assert.equal(execution.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.equal(execution.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'g2p-state-2');
  assert.equal(execution.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'g2p-mechanics-2');
  assert.equal(execution.stepSummaries[0].particlePingPong.sourceSlot, 0);
  assert.equal(execution.stepSummaries[0].particlePingPong.nextSlot, 1);
  assert.equal(execution.stepSummaries[1].particlePingPong.sourceSlot, 1);
  assert.equal(execution.stepSummaries[1].particlePingPong.nextSlot, 0);
  assert.equal(p2gInputs[0].stateBufferLabel, 'source-state');
  assert.equal(p2gInputs[1].stateBufferLabel, 'g2p-state-1');
  assert.equal(p2gInputs[1].mechanicsBufferLabel, 'g2p-mechanics-1');
  assert.equal(execution.finalStep.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(tracker.destroyed, 4);
  destroyMlsMpmResidentStepsBuffers(execution);
  assert.equal(tracker.destroyed, 8);
});

test('MLS-MPM resident steps compactSummaryMode none skips no-full summary readback', async () => {
  const { options, tracker } = noFullReadbackResidentStepFixture();
  let summaryCallCount = 0;
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...options,
    stepCount: 2,
    compactSummaryMode: 'none',
    summaryRunner() {
      summaryCallCount += 1;
      throw new Error('compact summary should not run in none mode');
    }
  });

  assert.equal(summaryCallCount, 0);
  assert.equal(execution.compactSummaryMode, 'none');
  assert.equal(execution.completedStepCount, 2);
  assert.equal(execution.finalStep.stageTiming.compactSummaryRequested, false);
  assert.equal(execution.finalStep.stageTiming.stageMs.compactSummary, 0);
  assert.equal(execution.finalStep.diagnostics.compactGpuSummaryAvailable, false);
  assert.equal(execution.stepSummaries[0].diagnostics.compactGpuSummaryAvailable, false);
  assert.equal(execution.stepSummaries[1].diagnostics.compactGpuSummaryAvailable, false);
  assert.equal(execution.nextSphParticleState.status, 'gpu-resident-unread-ready');
  assert.equal(execution.nextMlsMpmParticleState.status, 'gpu-resident-unread-ready');
  destroyMlsMpmResidentStepsBuffers(execution);
  assert.ok(tracker.destroyed > 0);
});

test('MLS-MPM fused resident sequence can run active-grid with compactSummaryMode none', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const originalOnSubmittedWorkDone = device.queue.onSubmittedWorkDone;
  let summaryCallCount = 0;
  let queueFenceCount = 0;
  device.queue.onSubmittedWorkDone = async () => {
    queueFenceCount += 1;
    await originalOnSubmittedWorkDone.call(device.queue);
  };
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'none',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 1,
    measureFusedSequenceQueueFence: true,
    summaryRunner() {
      summaryCallCount += 1;
      throw new Error('compact summary should not run in none-mode fused sequence');
    }
  });

  assert.equal(summaryCallCount, 0);
  assert.equal(execution.status, 'resident-steps-executed');
  assert.equal(execution.compactSummaryMode, 'none');
  assert.equal(execution.fusedResidentSequence.status, 'fused-resident-sequence-executed');
  assert.equal(execution.fusedResidentSequence.activeGridDispatch.useActiveGrid, true);
  assert.equal(execution.finalStep.stageTiming.fusedResidentSequence, true);
  assert.equal(execution.finalStep.stageTiming.fusedResidentSequenceStepCount, 2);
  assert.equal(execution.finalStep.stageTiming.compactSummaryRequested, false);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanOnlyRequested, true);
  assert.equal(execution.finalStep.compactGpuSummary.status, 'compact-summary-plan-only-ready');
  assert.equal(execution.finalStep.compactGpuSummary.readbackMode, 'no-compact-summary-readback');
  assert.equal(execution.finalStep.compactGpuSummary.timing.mapAsyncWaitMs, null);
  assert.equal(Number.isFinite(execution.finalStep.stageTiming.stageMs.compactSummary), true);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatch.useActiveGrid, true);
  assert.ok(queueFenceCount >= 1);
  assert.equal(execution.finalStep.stageTiming.queueFenceStatus.fusedMechanicsSequence, 'complete');
  assert.equal(execution.finalStep.stageTiming.queueFenceMethod.fusedMechanicsSequence, 'queue.onSubmittedWorkDone');
  assert.equal(Number.isFinite(execution.finalStep.stageTiming.queueFenceMs.fusedMechanicsSequence), true);
  assert.equal(execution.fusedResidentSequence.queueFenceRequested, true);
  assert.equal(execution.fusedResidentSequence.queueFenceStatus, 'complete');
  assert.equal(execution.stepSummaries[0].compactSummaryAvailable, false);
  assert.equal(execution.stepSummaries[1].compactSummaryAvailable, false);
  assert.equal(device.submissions.length, 2);
  assert.equal(execution.finalStep.stageTiming.activeGridIndirectDispatch.dispatchMode, 'dispatchWorkgroupsIndirect');
  assert.equal(execution.finalStep.stageTiming.activeGridIndirectDispatch.indirectDispatchUseCount, 6);
  assert.equal(device.dispatches.length, 7);
  assert.equal(device.indirectDispatches.length, 6);
  assert.equal(device.copies.length, 0);
  destroyMlsMpmResidentStepsBuffers(execution);
});

test('MLS-MPM resident steps can opt into one-submit fused mechanics sequence', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    summaryRunner({ sphParticleUpload, mlsMpmParticleUpload, g2pReconstruction, gridUpdate }) {
      assert.equal(sphParticleUpload.stateBuffer.label, 'ulg-mls-mpm-fused-sequence-g2p-state-ping-a');
      assert.equal(mlsMpmParticleUpload.mechanicsBuffer.label, 'ulg-mls-mpm-fused-sequence-g2p-mechanics-ping-a');
      assert.equal(g2pReconstruction.stateBuffer.label, 'ulg-mls-mpm-fused-sequence-g2p-state-ping-b');
      assert.equal(gridUpdate.fusedResidentSequence, true);
      return {
        schema: 'peercompute.ulg.mls-mpm-resident-summary-execution.v0',
        backend: 'webgpu',
        status: 'compact-summary-ready',
        compactGpuSummaryAvailable: true,
        readbackMode: 'no-full-readback',
        summaryScope: 'full',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: gridUpdate.gridNodeCount,
        activeGridNodeCount: null,
        activeGridNodeCountAvailable: false,
        activeGridNodeSummaryStatus: 'active-grid-node-summary-not-requested',
        gridNodeScanCount: 0,
        gridNodeScanSkipped: true,
        sourceMassKg: 8,
        nextMassKg: 8,
        massDeltaKg: 0,
        maxSpeedMPerS: 0,
        maxDisplacementM: 0,
        minVolumeRatioJ: 1,
        maxVolumeRatioJ: 1,
        phaseMassKg: { solid: 0, liquid: 8, gas: 0, plasma: 0 },
        phaseMassTotalKg: 8,
        thermalPhaseSummaryAvailable: true,
        compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
        timing: {
          schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
          totalMs: 0,
          setupMs: 0,
          encodeMs: 0,
          submitMs: 0,
          mapAsyncWaitMs: 0,
          decodeMs: 0,
          queueFenceAttribution: 'unit-summary-runner',
          summaryKernelDispatchCount: 0,
          summaryWorkgroupCount: 0,
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES
        },
        mapAsyncWaitMs: 0,
        queueFenceAttribution: 'unit-summary-runner'
      };
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA);
  assert.equal(execution.status, 'resident-steps-executed');
  assert.equal(execution.stepCount, 2);
  assert.equal(execution.completedStepCount, 2);
  assert.equal(execution.fusedResidentSequence.status, 'fused-resident-sequence-executed');
  assert.equal(execution.fusedResidentSequence.commandSubmissionCount, 1);
  assert.equal(execution.finalStep.stageTiming.fusedResidentSequence, true);
  assert.equal(execution.finalStep.stageTiming.fusedResidentSequenceStepCount, 2);
  assert.equal(execution.finalStep.particlePingPong.sourceSlot, 1);
  assert.equal(execution.finalStep.particlePingPong.nextSlot, 0);
  assert.equal(execution.finalStep.particlePingPong.step, 1);
  assert.equal(execution.finalStep.particlePingPong.nextStep, 2);
  assert.equal(execution.nextSphParticleState.step, 2);
  assert.equal(execution.nextSphParticleState.time, 0.2);
  assert.equal(execution.nextSphParticleState.cpuStateStale, true);
  assert.equal(execution.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'ulg-mls-mpm-fused-sequence-g2p-state-ping-b');
  assert.equal(execution.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(execution.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'ulg-mls-mpm-fused-sequence-g2p-mechanics-ping-b');
  assert.equal(execution.stepSummaries.length, 2);
  assert.equal(execution.stepSummaries[0].status, 'resident-step-fused-sequence-intermediate');
  assert.equal(execution.stepSummaries[1].status, 'resident-step-webgpu-executed');
  assert.equal(execution.stepSummaries[0].fusedResidentSequence, true);
  assert.equal(device.submissions.length, 1);
  assert.equal(device.dispatches.length, 8);
  assert.equal(device.createdBuffers.filter((buffer) => buffer.destroyed).length, 8);
  destroyMlsMpmResidentStepsBuffers(execution);
  assert.equal(device.createdBuffers.filter((buffer) => buffer.destroyed).length, device.createdBuffers.length);
});

test('MLS-MPM resident fused mechanics sequence can opt into active-grid dispatch', async () => {
  const buffers = manualBuffers({ velocity: [0, 0, 0] });
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const summaryPlanArgsBuffer = tracker.buffer('summary-plan-args');
  summaryPlanArgsBuffer.lastWrite = new Uint32Array([4, 1, 1]).buffer;
  const summaryPlanMetadataBuffer = tracker.buffer('summary-plan-metadata');
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'final-only',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 1,
    summaryRunner({ gridUpdate }) {
      assert.equal(gridUpdate.fusedResidentSequence, true);
      assert.equal(gridUpdate.activeGridDispatch.useActiveGrid, true);
      return {
        schema: 'peercompute.ulg.mls-mpm-resident-summary-execution.v0',
        backend: 'webgpu',
        status: 'compact-summary-ready',
        compactGpuSummaryAvailable: true,
        readbackMode: 'no-full-readback',
        summaryScope: 'full',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: gridUpdate.gridNodeCount,
        activeGridNodeCount: null,
        activeGridNodeCountAvailable: false,
        activeGridNodeSummaryStatus: 'active-grid-node-summary-not-requested',
        gridNodeScanCount: 0,
        gridNodeScanSkipped: true,
        sourcePositionBoundsM: {
          status: 'position-bounds-ready',
          min: [1.25, 1.25, 1.25],
          max: [1.25, 1.25, 1.25],
          massKg: 8
        },
        nextPositionBoundsM: {
          status: 'position-bounds-ready',
          min: [1.125, 1.2, 1.175],
          max: [1.375, 1.4, 1.425],
          massKg: 8
        },
        sourceMassKg: 8,
        nextMassKg: 8,
        massDeltaKg: 0,
        maxSpeedMPerS: 0,
        maxDisplacementM: 0,
        minVolumeRatioJ: 1,
        maxVolumeRatioJ: 1,
        phaseMassKg: { solid: 0, liquid: 8, gas: 0, plasma: 0 },
        phaseMassTotalKg: 8,
        thermalPhaseSummaryAvailable: true,
        compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
        activeGridDispatchPlan: {
          schema: 'peercompute.ulg.mls-mpm-active-grid-summary-dispatch-plan.v0',
          status: 'gpu-active-grid-summary-dispatch-plan-ready',
          source: 'compact-summary-gpu-sidecar',
          dispatchArgsBufferRetained: true,
          dispatchArgsBufferByteLength: 12,
          metadataBufferRetained: true,
          metadataBufferByteLength: 64,
          metadataUintCount: 16,
          workgroupSize: 64,
          gridDims: [...gridUpdate.gridDims],
          gridShift: gridUpdate.gridShift,
          gridNodeCount: gridUpdate.gridNodeCount,
          gridSpacingM: gridUpdate.gridSpacingM,
          safetyCells: 1,
          stepCount: 2,
          dt: buffers.mlsMpmParticleState.mechanicsDtS,
          gravityMPerS2: [0, 0, 0],
          normalHotLoopReadbackFree: true
        },
        activeGridDispatchPlanDispatchArgsBuffer: summaryPlanArgsBuffer,
        activeGridDispatchPlanMetadataBuffer: summaryPlanMetadataBuffer,
        activeGridDispatchPlanDispatchArgsBufferByteLength: 12,
        activeGridDispatchPlanMetadataBufferByteLength: 64,
        activeGridDispatchPlanBuffersRetained: true,
        destroyActiveGridDispatchPlanBuffers() {
          summaryPlanArgsBuffer.destroy();
          summaryPlanMetadataBuffer.destroy();
        },
        timing: {
          schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
          totalMs: 0,
          setupMs: 0,
          encodeMs: 0,
          submitMs: 0,
          mapAsyncWaitMs: 0,
          decodeMs: 0,
          queueFenceAttribution: 'unit-summary-runner',
          summaryKernelDispatchCount: 0,
          summaryWorkgroupCount: 0,
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES
        },
        mapAsyncWaitMs: 0,
        queueFenceAttribution: 'unit-summary-runner'
      };
    }
  });

  const activeGridDispatch = execution.fusedResidentSequence.activeGridDispatch;
  assert.equal(activeGridDispatch.status, 'active-grid-dispatch-ready');
  assert.equal(activeGridDispatch.useActiveGrid, true);
  assert.equal(activeGridDispatch.fullGridNodeCount, 512);
  assert.ok(activeGridDispatch.activeNodeCount < activeGridDispatch.fullGridNodeCount);
  assert.equal(execution.finalStep.p2gGridProjection.activeGridDispatch.useActiveGrid, true);
  assert.equal(execution.finalStep.gridUpdate.activeGridDispatch.useActiveGrid, true);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatch.useActiveGrid, true);
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.substepCount, 2);
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.totalDispatches, 10);
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.p2g.topology, 'particle-parallel-scatter');
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.g2p.dispatchAxis, 'particle');
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.p2gAccumulatorClear.dispatchAxis, 'active-grid-node');
  assert.equal(
    execution.finalStep.stageTiming.dispatchTopology.p2gAccumulatorClear.bufferClearMode,
    'active-grid-compute-clear'
  );
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.gridUpdate.dispatchAxis, 'active-grid-node');
  assert.equal(execution.finalStep.fusedResidentSequence.dispatchTopology.totalDispatches, 10);
  assert.equal(execution.finalStep.fusedResidentSequence.dispatchCount, 10);
  assert.equal(
    execution.finalStep.stageTiming.activeGridIndirectDispatch.status,
    'cpu-seeded-active-grid-indirect-dispatch-ready'
  );
  assert.equal(execution.finalStep.stageTiming.activeGridIndirectDispatch.dispatchMode, 'dispatchWorkgroupsIndirect');
  assert.equal(execution.finalStep.stageTiming.activeGridIndirectDispatch.indirectDispatchUseCount, 6);
  assert.equal(execution.finalStep.stageTiming.dispatchTopology.gridUpdate.dispatchSubmissionMode, 'dispatchWorkgroupsIndirect');
  assert.equal(execution.stepSummaries[0].diagnostics.dispatchTopologyStatus, 'resident-dispatch-topology-ready');
  assert.equal(execution.stepSummaries[0].diagnostics.cpuParticleLoopInHotPath, false);
  assert.equal(execution.finalStep.residentPositionBoundsSource, 'compact-gpu-summary-next-bounds');
  assert.equal(execution.nextSphParticleState.residentPositionBoundsSource, 'compact-gpu-summary-next-bounds');
  assert.deepEqual(execution.nextSphParticleState.residentPositionBoundsM.min, [1.125, 1.2, 1.175]);
  assert.deepEqual(execution.nextSphParticleState.residentPositionBoundsM.max, [1.375, 1.4, 1.425]);
  assert.equal(execution.nextSphParticleState.residentMaxSpeedMPerS, 0);
  assert.equal(
    execution.nextSphParticleState.residentActiveGridDispatchPlanHint.status,
    'active-grid-summary-dispatch-plan-hint-ready'
  );
  assert.equal(execution.nextSphParticleState.residentActiveGridDispatchPlanHint.dispatchArgsBuffer, summaryPlanArgsBuffer);
  assert.equal(execution.nextParticleUploads.activeGridDispatchPlanHint.metadataBuffer, summaryPlanMetadataBuffer);
  assert.equal(device.clears.length, 0);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [1, 1, 1, 1]);
  assert.deepEqual(device.indirectDispatches.map((entry) => entry.workgroupCountX), [4, 4, 4, 4, 4, 4]);
  const second = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleState: execution.nextSphParticleState,
    mlsMpmParticleState: execution.nextMlsMpmParticleState,
    sphParticleUpload: execution.nextParticleUploads.sphParticleUpload,
    mlsMpmParticleUpload: execution.nextParticleUploads.mlsMpmParticleUpload,
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'none',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 1
  });
  assert.equal(
    second.finalStep.stageTiming.activeGridIndirectDispatch.status,
    'gpu-summary-active-grid-indirect-dispatch-ready'
  );
  assert.equal(second.finalStep.stageTiming.activeGridIndirectDispatch.source, 'compact-summary-gpu-sidecar');
  assert.equal(second.finalStep.stageTiming.activeGridIndirectDispatch.dispatchPlanHintBorrowed, true);
  assert.equal(second.finalStep.stageTiming.activeGridIndirectDispatch.ownsBuffer, false);
  assert.equal(second.finalStep.stageTiming.activeGridIndirectDispatch.metadataBufferByteLength, 64);
  assert.equal(second.finalStep.stageTiming.activeGridDispatchPlanOnlyRequested, true);
  assert.equal(second.finalStep.compactGpuSummary.status, 'compact-summary-plan-only-ready');
  assert.equal(second.finalStep.compactGpuSummary.readbackMode, 'no-compact-summary-readback');
  assert.equal(
    second.nextSphParticleState.residentActiveGridDispatchPlanHint.status,
    'active-grid-summary-dispatch-plan-hint-ready'
  );
  assert.equal(second.nextSphParticleState.residentActiveGridDispatchPlanHint.source, 'compact-summary-gpu-sidecar');
  assert.deepEqual(device.indirectDispatches.slice(-6).map((entry) => entry.buffer.label), [
    'summary-plan-args',
    'summary-plan-args',
    'summary-plan-args',
    'summary-plan-args',
    'summary-plan-args',
    'summary-plan-args'
  ]);
  destroyMlsMpmResidentStepsBuffers(execution);
  destroyMlsMpmResidentStepsBuffers(second);
});

test('MLS-MPM resident fused mechanics sequence carries active-grid bounds across unread batches', async () => {
  const buffers = manualBuffers({
    position: [2.5, 2.5, 2.5],
    velocity: [0, 0, 0],
    smoothingLengthM: 0.25
  });
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const baseOptions = {
    ...buffers,
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [5, 5, 5],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'none',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridSafetyCells: 1
  };
  const first = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...baseOptions,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    }
  });
  const second = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...baseOptions,
    sphParticleState: first.nextSphParticleState,
    mlsMpmParticleState: first.nextMlsMpmParticleState,
    sphParticleUpload: first.nextParticleUploads.sphParticleUpload,
    mlsMpmParticleUpload: first.nextParticleUploads.mlsMpmParticleUpload
  });

  assert.equal(first.fusedResidentSequence.activeGridDispatch.useActiveGrid, true);
  assert.equal(first.nextSphParticleState.cpuStateStale, true);
  assert.equal(first.nextSphParticleState.residentPositionBoundsM.status, 'resident-active-grid-predicted-bounds');
  assert.equal(first.nextSphParticleState.residentPositionBoundsSource, 'active-grid-predicted-bounds');
  assert.equal(second.fusedResidentSequence.activeGridDispatch.useActiveGrid, true);
  assert.equal(second.fusedResidentSequence.activeGridDispatch.boundsSource, 'resident-position-bounds');
  assert.notEqual(second.fusedResidentSequence.activeGridDispatch.reason, 'position-bounds-unavailable');
  assert.equal(
    second.fusedResidentSequence.activeGridDispatch.activeNodeCount,
    first.fusedResidentSequence.activeGridDispatch.activeNodeCount
  );
  assert.deepEqual(first.nextSphParticleState.residentPositionBoundsM.min, [2.5, 2.5, 2.5]);
  assert.deepEqual(first.nextSphParticleState.residentPositionBoundsM.max, [2.5, 2.5, 2.5]);
  destroyMlsMpmResidentStepsBuffers(first);
  destroyMlsMpmResidentStepsBuffers(second);
});

test('MLS-MPM resident steps avoid full-grid per-step fused fallback when thermal blocks fused sequence', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const thermalInputs = [];
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'final-only',
    compactSummaryScope: 'particle-visual',
    fuseNoFullResidentMechanicsSequence: true,
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    thermalStepRunner(args) {
      thermalInputs.push({
        stateBufferLabel: args.sourceStateBuffer?.label ?? null,
        thermoBufferLabel: args.sourceThermoBuffer?.label ?? null,
        readbackMode: args.readbackMode
      });
      const index = thermalInputs.length;
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer(`thermal-state-${index}`),
        thermoBuffer: tracker.buffer(`thermal-thermo-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
        }
      };
    },
    summaryRunner({ gridUpdate, g2pReconstruction, thermalStep, summaryScope }) {
      assert.notEqual(gridUpdate.fusedResidentMechanics, true);
      assert.notEqual(g2pReconstruction.fusedResidentMechanics, true);
      assert.equal(thermalStep?.backend, 'webgpu');
      return {
        schema: 'peercompute.ulg.mls-mpm-resident-summary-execution.v0',
        backend: 'webgpu',
        status: 'compact-summary-ready',
        compactGpuSummaryAvailable: true,
        readbackMode: 'no-full-readback',
        summaryScope,
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: gridUpdate.gridNodeCount,
        activeGridNodeCount: null,
        activeGridNodeCountAvailable: false,
        activeGridNodeSummaryStatus: 'active-grid-node-summary-not-requested',
        gridNodeScanCount: 0,
        gridNodeScanSkipped: true,
        sourceMassKg: 8,
        nextMassKg: 8,
        massDeltaKg: 0,
        maxSpeedMPerS: 0,
        maxDisplacementM: 0,
        minVolumeRatioJ: 1,
        maxVolumeRatioJ: 1,
        phaseMassKg: { solid: 0, liquid: 8, gas: 0, plasma: 0 },
        phaseMassTotalKg: 8,
        thermalPhaseSummaryAvailable: true,
        compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
        timing: {
          schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
          totalMs: 0,
          setupMs: 0,
          encodeMs: 0,
          submitMs: 0,
          mapAsyncWaitMs: 0,
          decodeMs: 0,
          queueFenceAttribution: 'unit-summary-runner',
          summaryKernelDispatchCount: 0,
          summaryWorkgroupCount: 0,
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES
        },
        mapAsyncWaitMs: 0,
        queueFenceAttribution: 'unit-summary-runner'
      };
    }
  });

  assert.equal(execution.fusedResidentSequence, undefined);
  assert.equal(execution.finalStep.stageTiming.fusedResidentMechanics, false);
  assert.equal(execution.finalStep.stageTiming.fusedResidentSequence, undefined);
  assert.equal(execution.finalStep.stageTiming.thermalRequested, true);
  assert.ok(execution.finalStep.stageTiming.stageMs.p2gGridProjection > 0);
  assert.ok(execution.finalStep.stageTiming.stageMs.gridUpdate > 0);
  assert.ok(execution.finalStep.stageTiming.stageMs.g2pReconstruction > 0);
  assert.equal(thermalInputs.length, 2);
  assert.notEqual(thermalInputs[0].stateBufferLabel, 'ulg-mls-mpm-fused-g2p-state-out');
  assert.notEqual(thermalInputs[1].stateBufferLabel, 'ulg-mls-mpm-fused-g2p-state-out');
  assert.equal(device.submissions.length, 6);
  assert.equal(device.dispatches.length, 8);
  destroyMlsMpmResidentStepsBuffers(execution);
});

test('MLS-MPM resident steps can defer active-grid plan-only summary until final thermal step', async () => {
  const buffers = manualBuffers({
    position: [1.25, 1.25, 1.25],
    velocity: [0, 0, 0],
    smoothingLengthM: 0.25
  });
  const tracker = fakeBufferTracker();
  const device = fakeSummaryDevice(new Float32Array(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS));
  const thermalInputs = [];
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: tracker.buffer('source-thermo'),
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 3,
    preferWebGpu: true,
    device,
    boxDimsM: [3, 3, 3],
    gravityMPerS2: [0, 0, 0],
    readbackMode: 'no-full-readback',
    compactSummaryMode: 'none',
    fuseNoFullResidentMechanicsSequence: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    activeGridDispatchPlanRefreshMode: 'final-only',
    activeGridSafetyCells: 1,
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    thermalStepRunner(args) {
      thermalInputs.push({
        sourceStateBuffer: args.sourceStateBuffer?.label ?? null,
        readbackMode: args.readbackMode
      });
      const index = thermalInputs.length;
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer(`deferred-thermal-state-${index}`),
        thermoBuffer: tracker.buffer(`deferred-thermal-thermo-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
        }
      };
    }
  });

  assert.equal(execution.activeGridDispatchPlanRefreshMode, 'final-only');
  assert.equal(execution.fusedResidentSequence, undefined);
  assert.equal(thermalInputs.length, 3);
  assert.equal(execution.stepSummaries.length, 3);
  for (const summary of execution.stepSummaries.slice(0, 2)) {
    assert.equal(summary.stageTiming.activeGridDispatchPlanOnlyEligible, true);
    assert.equal(summary.stageTiming.activeGridDispatchPlanOnlyRequested, false);
    assert.equal(summary.stageTiming.activeGridDispatchPlanRefreshMode, 'final-only');
    assert.equal(summary.stageTiming.activeGridDispatchPlanRefreshFinalStep, false);
    assert.equal(
      summary.stageTiming.activeGridDispatchPlanRefreshSkippedReason,
      'active-grid-plan-refresh-deferred-until-final-step'
    );
    assert.equal(summary.diagnostics.activeGridDispatchPlanStatus ?? null, null);
  }
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanOnlyEligible, true);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanOnlyRequested, true);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanRefreshMode, 'final-only');
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanRefreshFinalStep, true);
  assert.equal(execution.finalStep.stageTiming.activeGridDispatchPlanRefreshSkippedReason, null);
  assert.equal(execution.finalStep.compactGpuSummary.status, 'compact-summary-plan-only-ready');
  assert.equal(execution.finalStep.compactGpuSummary.readbackMode, 'no-compact-summary-readback');
  assert.equal(
    execution.nextSphParticleState.residentActiveGridDispatchPlanHint.status,
    'active-grid-summary-dispatch-plan-hint-ready'
  );
  destroyMlsMpmResidentStepsBuffers(execution);
});

test('MLS-MPM resident steps ping-pong unread retained buffers across repeated steps', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const p2gInputs = [];
  const reactionInputs = [];
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
    reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v0', reactionCount: 1 },
    p2gRunner(args) {
      p2gInputs.push({
        readbackMode: args.readbackMode,
        stateBufferLabel: args.sphParticleUpload?.stateBuffer?.label ?? null,
        mechanicsBufferLabel: args.mlsMpmParticleUpload?.mechanicsBuffer?.label ?? null,
        cpuStateStale: args.sphParticleState?.cpuStateStale ?? false,
        residentProductMassStatus: args.residentProductMass?.status ?? null,
        residentProductMassProductEventRowCount: args.residentProductMass?.productEventRowCount ?? 0,
        residentProductMassUnplacedProductMassKg: args.residentProductMass?.unplacedProductMassKg ?? null
      });
      const index = p2gInputs.length;
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer(`p2g-grid-unread-${index}`),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      const index = p2gInputs.length;
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer(`updated-grid-unread-${index}`),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      const index = p2gInputs.length;
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer(`g2p-state-unread-${index}`),
        mechanicsBuffer: tracker.buffer(`g2p-mechanics-unread-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    },
    thermalStepRunner(args) {
      const index = p2gInputs.length;
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer(`thermal-state-unread-${index}`),
        thermoBuffer: tracker.buffer(`thermal-thermo-unread-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: args.readbackMode,
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
        }
      };
    },
    reactionStepRunner(args) {
      const index = p2gInputs.length;
      reactionInputs.push({
        stateBufferLabel: args.sourceStateBuffer?.label ?? null,
        thermoBufferLabel: args.sourceThermoBuffer?.label ?? null,
        mechanicsBufferLabel: args.sourceMechanicsBuffer?.label ?? null,
        cpuStateStale: args.sphParticleState?.cpuStateStale ?? false
      });
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer(`reaction-state-unread-${index}`),
        thermoBuffer: tracker.buffer(`reaction-thermo-unread-${index}`),
        mechanicsBuffer: tracker.buffer(`reaction-mechanics-unread-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        reactionSummary: {
          schema: ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
          backend: 'webgpu',
          status: 'reaction-compact-summary-ready',
          reactionSummaryAvailable: true,
          canonicalReactionEventCount: index,
          consumedReactantMassKg: 6 * index,
          ledgerVisibleProductMassKg: 5 * index,
          ledgerUnplacedProductMassKg: index,
          ledgerGasProductMassKg: index,
          ledgerVisibleGasProductMassKg: 0,
          ledgerUnplacedGasProductMassKg: index,
          sealedBoxGasProductMoles: 250 * index,
          reactionHeatJ: 6000 * index,
	          ledgerMassResidualKg: 0.4 * index,
	          compactLedgerAvailable: true,
	          productInventoryCount: 2,
	          productInventoryReadbackByteLength: 128,
	          productEventRowCount: 32 * index,
	          productEventActiveEventCount: index,
	          productEventReadbackByteLength: 0,
	          productEventBufferByteLength: 2048 * index,
	          productEventBufferRetained: true,
	          productInventory: {
            schema: 'peercompute.ulg.sph-gpu-reaction-product-inventory.v0',
            status: 'product-inventory-compact-ledger-ready',
            recordCount: 2,
            materialCount: 2,
            records: [
              { material: 'ab', materialId: 300, massKg: 5 * index, visibleMassKg: 5 * index, unplacedMassKg: 0, moles: 83.333 * index, productTermIndex: 0 },
              { material: 'c2', materialId: 400, massKg: index, visibleMassKg: 0, unplacedMassKg: index, moles: 250 * index, productTermIndex: 1 }
            ],
            byMaterial: {
              ab: { material: 'ab', materialId: 300, massKg: 5 * index, visibleMassKg: 5 * index, unplacedMassKg: 0, moles: 83.333 * index, productTermIndices: [0] },
              c2: { material: 'c2', materialId: 400, massKg: index, visibleMassKg: 0, unplacedMassKg: index, moles: 250 * index, productTermIndices: [1] }
            },
            fullParticleReadbackPerformed: false
          },
          atomResidualCount: 2,
          atomResidualReadbackByteLength: 64,
          atomResidualSummary: {
            schema: ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
            status: 'atom-residual-compact-ledger-ready',
            recordCount: 2,
            maxAbsAtomResidualMol: 0,
            chargeResidualMol: 0,
            atomResidualMolByZ: { 1: 0 },
            records: [
              { reactionIndex: 0, termKind: 'reactant', termIndex: 0, atomicNumberZ: 1, atomResidualMol: -2 * index, chargeResidualMol: 0, eventCount: index },
              { reactionIndex: 0, termKind: 'product', termIndex: 0, atomicNumberZ: 1, atomResidualMol: 2 * index, chargeResidualMol: 0, eventCount: index }
            ],
            fullParticleReadbackPerformed: false
          },
          strictReactionGate: {
            schema: 'peercompute.ulg.sph-reaction-strict-gate.v0',
            status: 'strict-reaction-gate-pass',
            blockers: [],
            warnings: [],
            strictForceCouplingAllowed: true
          },
          readbackMode: 'compact-reaction-summary-readback',
          compactReadbackByteLength: MLS_MPM_GPU_RESIDENT_SUMMARY_BYTES,
          visibleOnly: true,
          unplacedProductInventoryIncluded: true
        },
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.thermoBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(execution.readbackMode, 'no-full-readback');
  assert.equal(execution.normalHotLoopReadbackFree, true);
  assert.equal(execution.renderStateReadbackAvailable, false);
  assert.equal(execution.gpuAuthoritativeState, false);
  assert.equal(execution.residentAuthorityLedgerStatus, 'resident-authority-ledger-ready');
  assert.equal(execution.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage, 'reaction-step');
  assert.equal(execution.residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].ownerStage, 'reaction-step');
  assert.equal(execution.finalStep.particlePingPong.sourceSlot, 1);
  assert.equal(execution.finalStep.particlePingPong.nextSlot, 0);
  assert.equal(execution.nextSphParticleState.step, 2);
  assert.equal(execution.nextSphParticleState.time, 0.2);
  assert.equal(execution.nextSphParticleState.status, 'gpu-resident-unread-ready');
  assert.equal(execution.nextSphParticleState.cpuStateStale, true);
  assert.equal(execution.nextSphParticleState.state, buffers.sphParticleState.state);
  assert.equal(execution.nextMlsMpmParticleState.step, 2);
  assert.equal(execution.nextMlsMpmParticleState.status, 'gpu-resident-unread-ready');
  assert.equal(execution.nextMlsMpmParticleState.cpuStateStale, true);
  assert.equal(execution.nextMlsMpmParticleState.mechanics, buffers.mlsMpmParticleState.mechanics);
  assert.equal(execution.nextParticleBufferMode, 'retained-reaction-output-buffers');
  assert.equal(execution.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'reaction-state-unread-2');
  assert.equal(execution.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'reaction-mechanics-unread-2');
  assert.equal(execution.stepSummaries[0].readbackMode, 'no-full-readback');
  assert.equal(execution.stepSummaries[1].readbackMode, 'no-full-readback');
  assert.equal(execution.stepSummaries[0].residentAuthorityLedgerStatus, 'resident-authority-ledger-ready');
  assert.equal(execution.stepSummaries[1].residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage, 'reaction-step');
  assert.equal(execution.stepSummaries[1].residentAuthorityFamilyOwners[RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS].ownerStage, 'resident-product-mass-handle');
  assert.equal(execution.stepSummaries[0].normalHotLoopReadbackFree, true);
  assert.equal(execution.stepSummaries[1].normalHotLoopReadbackFree, true);
  assert.equal(execution.stepSummaries[0].diagnostics.reactionSummaryStatus, 'reaction-compact-summary-ready');
  assert.equal(execution.stepSummaries[1].diagnostics.reactionSummaryStatus, 'reaction-compact-summary-ready');
  assert.equal(execution.stepSummaries[1].diagnostics.reactionCanonicalEventCount, 2);
  assert.equal(execution.stepSummaries[1].diagnostics.reactionLedgerUnplacedGasProductMassKg, 2);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionSealedBoxGasProductMoles, 500);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductInventoryCount, 2);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductInventoryReadbackByteLength, 128);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductEventRowCount, 64);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductEventActiveEventCount, 2);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductEventReadbackByteLength, 0);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductEventBufferByteLength, 4096);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionProductEventBufferRetained, true);
	  assert.equal(execution.stepSummaries[1].residentProductMassStatus, 'resident-product-mass-summary-only');
	  assert.equal(execution.stepSummaries[1].residentProductMassProductEventRowCount, 64);
	  assert.equal(execution.stepSummaries[1].residentProductMassUnplacedProductMassKg, 2);
	  assert.equal(execution.stepSummaries[1].residentProductMassEosCouplingStatus, 'resident-product-mass-summary-only-no-eos-buffer');
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionResidentProductMassStatus, 'resident-product-mass-summary-only');
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionResidentProductMassProductEventRowCount, 64);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionResidentProductMassUnplacedProductMassKg, 2);
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionResidentProductMassEosCouplingStatus, 'resident-product-mass-summary-only-no-eos-buffer');
	  assert.equal(execution.stepSummaries[1].diagnostics.reactionAtomResidualCount, 2);
  assert.equal(execution.stepSummaries[1].diagnostics.reactionAtomResidualReadbackByteLength, 64);
  assert.equal(execution.stepSummaries[1].diagnostics.reactionStrictGateStatus, 'strict-reaction-gate-pass');
  assert.equal(p2gInputs[0].stateBufferLabel, 'source-state');
  assert.equal(p2gInputs[0].residentProductMassStatus, null);
  assert.equal(p2gInputs[1].stateBufferLabel, 'reaction-state-unread-1');
  assert.equal(p2gInputs[1].mechanicsBufferLabel, 'reaction-mechanics-unread-1');
  assert.equal(p2gInputs[1].cpuStateStale, true);
  assert.equal(p2gInputs[1].residentProductMassStatus, 'resident-product-mass-summary-only');
  assert.equal(p2gInputs[1].residentProductMassProductEventRowCount, 32);
  assert.equal(p2gInputs[1].residentProductMassUnplacedProductMassKg, 1);
  assert.equal(reactionInputs[0].stateBufferLabel, 'thermal-state-unread-1');
  assert.equal(reactionInputs[1].cpuStateStale, true);
  assert.equal(execution.finalStep.state.length, 0);
  assert.equal(execution.finalStep.diagnostics.massDeltaKg, null);
  assert.equal(execution.finalStep.nextParticleUploads.sphParticleUpload.thermoBuffer.label, 'reaction-thermo-unread-2');
  assert.equal(tracker.destroyed, 9);
  destroyMlsMpmResidentStepsBuffers(execution);
  assert.equal(tracker.destroyed, 18);
});
