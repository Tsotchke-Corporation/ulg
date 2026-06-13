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
  ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  destroyMlsMpmResidentStepBuffers,
  destroyMlsMpmResidentStepsBuffers,
  runMlsMpmResidentStepsWithOptionalWebGpu,
  runMlsMpmResidentStepWithOptionalWebGpu
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import { projectMlsMpmP2gGridCpu } from '../src/runtime/sph/sphGridGpuKernel.js';
import {
  runMlsMpmGridUpdateWithOptionalWebGpu,
  updateMlsMpmGridCpu
} from '../src/runtime/sph/sphGridUpdateGpuKernel.js';
import { reconstructMlsMpmG2pCpu } from '../src/runtime/sph/sphG2pGpuKernel.js';
import { runMlsMpmResidentSummaryWebGpu } from '../src/runtime/sph/sphMlsMpmGpuSummary.js';
import { ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA } from '../src/runtime/sph/sphReactionGpuSummary.js';

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
  status = 1
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
    forceApplicationStatus: 'solver-ready-not-applied',
    forceApplicationTarget: 'pending-mls-mpm-grid-force-consumer',
    forceRowCount: 1,
    forceRowValues
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

function fakeSummaryDevice(summaryValues) {
  const createdBuffers = [];
  const bindGroups = [];
  const dispatches = [];
  const shaderModules = [];
  const copies = [];
  const submissions = [];
  const writes = [];
  return {
    createdBuffers,
    bindGroups,
    dispatches,
    shaderModules,
    copies,
    submissions,
    writes,
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ label: buffer.label, offset, byteLength: data.byteLength });
      },
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
            end() {
              this.ended = true;
            }
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          copies.push({ source, sourceOffset, destination, destinationOffset, size });
        },
        finish() {
          return { dispatches: [...dispatches], copies: [...copies] };
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
  assert.equal(step.diagnostics.particleCount, 1);
  assert.equal(step.diagnostics.sourceMassKg, 8);
  assert.equal(step.diagnostics.massDeltaKg, 0);
  assert.ok(step.state instanceof Float32Array);
  assert.ok(step.mechanics instanceof Float32Array);
  assert.equal(step.fullPhysicsValidation, false);
});

test('MLS-MPM grid update consumes pressure-interface force rows as grid impulses', () => {
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
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture();
  const update = updateMlsMpmGridCpu({
    p2gGridProjection: projection,
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [3, 3, 3],
    cflFactor: 10,
    pressureInterfaceForceSolver
  });
  const sourceCenterOffset = nodeOffset(projection, 1, 1, 1, projection.gridNodeStrideFloats);
  const centerOffset = nodeOffset(update, 1, 1, 1, update.gridNodeStrideFloats);
  const centerWeight = 0.75 ** 3;
  const expectedCenterImpulse = 0.25 * 8 * centerWeight;
  const expectedCenterVelocity = expectedCenterImpulse / projection.gridNodes[sourceCenterOffset];

  assert.equal(update.schema, ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA);
  assert.equal(update.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(update.pressureInterfaceForceSolverStatus, 'pressure-interface-force-solver-ready');
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
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture();
  const pressureInterfaceForceRowsBuffer = { label: 'pressure-interface-force-rows' };
  let runnerCalls = 0;
  const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection: projection,
    pressureInterfaceForceRowsBuffer,
    pressureInterfaceForceSolver,
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [3, 3, 3],
    cflFactor: 10,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    webGpuRunner(args) {
      runnerCalls += 1;
      assert.equal(args.pressureInterfaceForceRowsBuffer, pressureInterfaceForceRowsBuffer);
      assert.equal(args.pressureInterfaceForceSolver, pressureInterfaceForceSolver);
      const result = updateMlsMpmGridCpu(args);
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(runnerCalls, 1);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
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
  const pressureInterfaceForceSolver = pressureInterfaceForceSolverFixture();
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: false,
    boxDimsM: [3, 3, 3],
    dt: 0.25,
    gravityMPerS2: [0, 0, 0],
    cflFactor: 10,
    pressureInterfaceForceSolver
  });

  assert.equal(step.schema, ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA);
  assert.equal(step.gridUpdate.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(step.gridUpdate.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-applied');
  assert.equal(step.gridUpdate.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-consumed');
  assert.equal(step.gridUpdate.pressureInterfaceAppliedImpulseSource, 'grid-node-distributed-impulse');
  assert.equal(step.gridUpdate.pressureInterfaceImpulseProofStatus, 'actual-grid-node-impulse');
  assert.equal(step.pressureInterfaceForceSolver, pressureInterfaceForceSolver);
  assert.equal(step.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(step.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-applied');
  assert.equal(step.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-consumed');
  assert.equal(step.pressureInterfaceAppliedImpulseSource, 'grid-node-distributed-impulse');
  assert.equal(step.pressureInterfaceImpulseProofStatus, 'actual-grid-node-impulse');
  assert.equal(step.diagnostics.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-applied');
  assert.equal(step.diagnostics.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-consumed');
  assert.equal(step.diagnostics.pressureInterfaceAppliedImpulseSource, 'grid-node-distributed-impulse');
  assert.equal(step.diagnostics.pressureInterfaceImpulseProofStatus, 'actual-grid-node-impulse');
  assert.equal(step.diagnostics.pressureInterfaceForceRowCount, 1);
  nearlyEqual(step.diagnostics.pressureInterfaceAppliedImpulseNSeconds[0], 2, 1e-5);
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
    0, 65, 12, 1
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
  assert.equal(summary.compactPartialSummaryCount, 3);
  assert.equal(summary.compactPartialSummaryByteLength, 384);
  assert.equal(summary.compactReductionWorkgroupSize, 64);
  assert.equal(summary.compactReadbackByteLength, 128);
  assert.equal(summary.compactReadbackFloatCount, 32);
  assert.equal(summary.sourceStateBufferMode, 'borrowed-webgpu-upload');
  assert.equal(summary.thermoBufferMode, 'retained-thermal-output');
  assert.equal(summary.sourceMechanicsBufferMode, 'borrowed-webgpu-upload');
  assert.equal(summary.activeGridNodeCount, 17);
  assert.equal(summary.massDeltaKg, 0);
  assert.deepEqual(summary.momentumDeltaKgMPerS, [3, 3, 3]);
  assert.deepEqual(summary.phaseMassKg, { solid: 5, liquid: 4, gas: 2, plasma: 1 });
  assert.equal(summary.temperatureMassWeightedMeanK, 450);
  assert.equal(summary.minTemperatureK, 273);
  assert.equal(summary.maxTemperatureK, 900);
  assert.equal(summary.thermalReadyCount, 65);
  assert.equal(summary.thermalProblemCount, 0);
  assert.equal(summary.thermalPhaseSummaryAvailable, true);
  assert.deepEqual(device.dispatches.map((entry) => entry.count), [3, 1]);
  assert.equal(device.bindGroups.length, 2);
  assert.equal(device.bindGroups[0].entries.length, 8);
  assert.equal(device.bindGroups[1].entries.length, 3);
  assert.equal(device.copies.length, 1);
  assert.equal(device.copies[0].size, 128);
  assert.equal(device.writes[0].byteLength, 16);
  assert.equal(device.createdBuffers.find((buffer) => buffer.label === 'ulg-mls-mpm-resident-summary-partials').size, 384);
  assert.equal(device.createdBuffers.find((buffer) => buffer.label === 'ulg-mls-mpm-resident-summary-readback').unmapped, true);
  assert.equal(device.createdBuffers.every((buffer) => buffer.destroyed), true);
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
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 4);
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
      assert.equal(args.sphParticleUpload.stateBuffer.label, 'source-state');
      assert.equal(args.mlsMpmParticleUpload.mechanicsBuffer.label, 'source-mechanics');
      assert.equal(args.gridUpdate.gpuResult.updatedGridBuffer.label, 'updated-grid-summary');
      assert.equal(args.g2pReconstruction.stateBuffer.label, 'g2p-state-summary');
      assert.equal(args.g2pReconstruction.mechanicsBuffer.label, 'g2p-mechanics-summary');
      return {
        schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
        backend: 'webgpu',
        status: 'compact-summary-ready',
        particleCount: 1,
        gridNodeCount: 512,
        activeGridNodeCount: 7,
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
        compactReadbackByteLength: 128,
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
  assert.equal(step.compactGpuSummary.status, 'compact-summary-ready');
  assert.equal(step.diagnostics.compactGpuSummaryAvailable, true);
  assert.equal(step.diagnostics.compactGpuSummaryStatus, 'compact-summary-ready');
  assert.equal(step.diagnostics.compactGpuSummaryReadbackMode, 'compact-summary-readback');
  assert.equal(step.diagnostics.compactReadbackByteLength, 128);
  assert.equal(step.diagnostics.compactSummaryReductionStrategy, 'two-pass-workgroup-reduction');
  assert.equal(step.diagnostics.activeGridNodeCount, 7);
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
  assert.equal(step.g2pStateBufferReplacedByThermalStep, false);
  assert.equal(step.thermalStateBufferHandoffStatus, 'thermal-state-buffer-skipped-mechanical-state-from-g2p');
  assert.equal(step.thermalThermoBufferHandoffStatus, 'thermal-thermo-buffer-drives-next-particles');
  assert.equal(step.nextParticleBufferMode, 'retained-thermal-output-and-g2p-mechanics-buffers');
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'g2p-state-before-thermal');
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer.label, 'thermal-thermo-after-g2p');
  assert.equal(step.nextParticleUploads.sphParticleUpload.ownsThermoBuffer, true);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'g2p-mechanics-after-thermal');
  assert.equal(step.nextParticleThermoBufferByteLength, buffers.sphParticleState.thermo.byteLength);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 6);
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
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
        backend: 'webgpu',
        status: 'thermal-step-executed',
        particleCount: buffers.sphParticleState.particleCount,
        state: new Float32Array(),
        thermo: new Float32Array(),
        stateBuffer: tracker.buffer('thermal-state-before-reaction'),
        thermoBuffer: tracker.buffer('thermal-thermo-before-reaction'),
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
	      reactionCalls += 1;
	      assert.equal(args.sourceStateBuffer.label, 'thermal-state-before-reaction');
	      assert.equal(args.sourceThermoBuffer.label, 'thermal-thermo-before-reaction');
	      assert.equal(args.sourceMechanicsBuffer.label, 'g2p-mechanics-before-reaction');
	      assert.equal(args.readbackMode, 'no-full-readback');
	      assert.equal(args.retainOutputParticleBuffers, true);
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
          compactReadbackByteLength: 128,
          reductionStrategy: 'two-pass-workgroup-reduction'
        }
      };
    }
  });

  assert.equal(step.reactionOutputParticleMutation, false);
  assert.equal(step.reactionOutputBufferHandoffStatus, 'reaction-output-buffers-skipped-no-particle-mutation');
  assert.equal(step.thermalOutputReplacedByReactionStep, false);
  assert.equal(step.g2pMechanicsBufferReplacedByReactionStep, false);
  assert.equal(step.thermalStateBufferHandoffStatus, 'thermal-state-buffer-skipped-mechanical-state-from-g2p');
  assert.equal(step.thermalThermoBufferHandoffStatus, 'thermal-thermo-buffer-drives-next-particles');
  assert.equal(step.nextParticleBufferMode, 'retained-thermal-output-and-g2p-mechanics-buffers');
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'g2p-state-before-noop-reaction');
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
  const device = fakeSummaryDevice(new Float32Array(32));
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

  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(carriedResidentProductMass.destroyCalls, 0);
  assert.equal(carriedResidentProductMass.productEventBuffer.destroyed, false);
  assert.equal(emittedResidentProductMass.destroyCalls, 1);
  assert.equal(emittedResidentProductMass.productEventBuffer.destroyed, true);
  assert.equal(step.residentProductMass.productEventBuffer.destroyed, true);
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
          compactReadbackByteLength: 128,
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
