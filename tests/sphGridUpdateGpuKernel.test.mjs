import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mlsMpmGridUpdateWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  MLS_MPM_GPU_GRID_VELOCITY_FLOATS,
  SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  createMlsMpmGridUpdateParityReport,
  runMlsMpmGridUpdateWebGpu,
  runMlsMpmGridUpdateWithOptionalWebGpu,
  updateMlsMpmGridCpu
} from '../src/runtime/sph/sphGridUpdateGpuKernel.js';

function nearlyEqual(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function manualP2gProjection({ mass = 2, momentum = [4, 0, 0], nodePosition = [1, 1, 1] } = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
    projectionSchema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
    backend: 'cpu-reference',
    particleCount: 1,
    gridSpacingM: 1,
    gridDims: [4, 4, 4],
    gridNodeCount: 1,
    gridShift: 1,
    dt: 0.1,
    gridNodeStrideFloats: 8,
    gridNodes: new Float32Array([
      mass, momentum[0], momentum[1], momentum[2],
      nodePosition[0], nodePosition[1], nodePosition[2], mass > 0 ? 1 : 0
    ])
  };
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

function fakeGridUpdateDevice() {
  const createdBuffers = [];
  const dispatches = [];
  const device = {
    createdBuffers,
    dispatches,
    queue: {
      writeBuffer() {},
      submit() {},
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
      return { code: desc.code };
    },
    createBindGroupLayout(desc) {
      return { entries: desc.entries };
    },
    createPipelineLayout(desc) {
      return { bindGroupLayouts: desc.bindGroupLayouts };
    },
    createComputePipeline(desc) {
      return {
        desc,
        getBindGroupLayout() {
          return { entries: [] };
        }
      };
    },
    createBindGroup(desc) {
      return { entries: desc.entries };
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups(x, y = 1, z = 1) {
              dispatches.push([x, y, z]);
            },
            end() {}
          };
        },
        copyBufferToBuffer() {},
        finish() {
          return {};
        }
      };
    }
  };
  return device;
}

test('MLS-MPM grid update WGSL declares grid update bindings', () => {
  assert.match(mlsMpmGridUpdateWgsl, /struct GridUpdateParams/);
  assert.match(mlsMpmGridUpdateWgsl, /var<storage, read> p2g_grid_nodes/);
  assert.match(mlsMpmGridUpdateWgsl, /var<storage, read_write> updated_grid_nodes/);
  assert.match(mlsMpmGridUpdateWgsl, /params.cfl_factor/);
  assert.match(mlsMpmGridUpdateWgsl, /@compute @workgroup_size\(64\)/);
});

test('CPU MLS-MPM grid update converts momentum to velocity and applies gravity', () => {
  const p2gGridProjection = manualP2gProjection({ nodePosition: [2, 2, 2] });
  const update = updateMlsMpmGridCpu({
    p2gGridProjection,
    dt: 0.1,
    gravityMPerS2: [0, -10, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10
  });

  assert.equal(update.schema, ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA);
  assert.equal(update.backend, 'cpu-reference');
  assert.equal(update.kernelScope, 'mls-mpm-grid-velocity-update-gravity-cfl-walls');
  assert.equal(update.gridNodeStrideFloats, MLS_MPM_GPU_GRID_VELOCITY_FLOATS);
  nearlyEqual(update.updatedGridNodes[0], 2);
  nearlyEqual(update.updatedGridNodes[1], 2);
  nearlyEqual(update.updatedGridNodes[2], -1);
  nearlyEqual(update.updatedGridNodes[3], 0);
  nearlyEqual(update.updatedGridNodes[7], 1);
  assert.equal(update.gridUpdateValidation, false);
  assert.equal(update.g2pValidation, false);
  assert.equal(update.fullPhysicsValidation, false);
});

test('CPU MLS-MPM grid update applies CFL clamp and floor no-slip clamp', () => {
  const cfl = updateMlsMpmGridCpu({
    p2gGridProjection: manualP2gProjection({ momentum: [100, 0, 0], nodePosition: [2, 2, 2] }),
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 0.2
  });
  nearlyEqual(cfl.updatedGridNodes[1], 2);

  const wall = updateMlsMpmGridCpu({
    p2gGridProjection: manualP2gProjection({ momentum: [3, -4, 5], nodePosition: [2, 1, 2] }),
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10
  });
  nearlyEqual(wall.updatedGridNodes[1], 0);
  nearlyEqual(wall.updatedGridNodes[2], 0);
  nearlyEqual(wall.updatedGridNodes[3], 0);
});

test('CPU MLS-MPM grid update clamps exactly one-cell wall boundary nodes', () => {
  const lower = updateMlsMpmGridCpu({
    p2gGridProjection: manualP2gProjection({ momentum: [0, -4, 0], nodePosition: [2, 1, 2] }),
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10
  });
  const upper = updateMlsMpmGridCpu({
    p2gGridProjection: manualP2gProjection({ momentum: [0, 4, 0], nodePosition: [2, 4, 2] }),
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10
  });

  nearlyEqual(lower.updatedGridNodes[2], 0);
  nearlyEqual(upper.updatedGridNodes[2], 0);
});

test('optional MLS-MPM grid update returns CPU reference when WebGPU is not requested', async () => {
  const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection: manualP2gProjection(),
    preferWebGpu: false,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          throw new Error('should not request WebGPU');
        }
      }
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.gridShift, 1);
  assert.equal(execution.webgpuStatus.status, 'not-requested');
  assert.equal(execution.fullPhysicsValidation, false);
});

test('optional MLS-MPM grid update falls back when WebGPU is unavailable', async () => {
  const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection: manualP2gProjection(),
    preferWebGpu: true,
    navigatorRef: {}
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'blocked-webgpu-unavailable');
  assert.equal(execution.webgpuStatus.fallback, 'cpu-reference');
});

test('WebGPU MLS-MPM grid update binds a full pressure-force row for zero-force runs', async () => {
  const device = fakeGridUpdateDevice();
  const update = await runMlsMpmGridUpdateWebGpu({
    device,
    p2gGridProjection: manualP2gProjection(),
    readbackMode: 'no-full-readback'
  });
  const pressureForceBuffer = device.createdBuffers.find(
    (buffer) => buffer.label === 'ulg-mls-mpm-grid-update-pressure-force-rows'
  );

  assert.equal(update.backend, 'webgpu');
  assert.equal(update.readbackMode, 'no-full-readback');
  assert.equal(update.queueCompletionStatus, 'queue-submitted-cleanup-deferred');
  assert.equal(update.queueCompletionMethod, 'deferred queue.onSubmittedWorkDone cleanup');
  assert.equal(update.pressureInterfaceForceRowCount, 0);
  assert.ok(pressureForceBuffer);
  assert.equal(
    pressureForceBuffer.size,
    SPH_PRESSURE_INTERFACE_FORCE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
});

test('WebGPU MLS-MPM grid update blocks ready-but-not-applied pressure rows by default', async () => {
  const device = fakeGridUpdateDevice();
  const update = await runMlsMpmGridUpdateWebGpu({
    device,
    p2gGridProjection: manualP2gProjection(),
    pressureInterfaceForceSolver: pressureInterfaceForceSolverFixture(),
    dt: 0.25,
    readbackMode: 'no-full-readback'
  });

  assert.equal(update.backend, 'webgpu');
  assert.equal(update.readbackMode, 'no-full-readback');
  assert.equal(update.queueCompletionStatus, 'queue-submitted-cleanup-deferred');
  assert.equal(update.queueCompletionMethod, 'deferred queue.onSubmittedWorkDone cleanup');
  assert.equal(update.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(update.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-blocked-not-approved');
  assert.equal(update.pressureInterfaceForceConsumerStatus, 'blocked-pressure-force-solver-not-approved-for-grid-application');
  assert.equal(update.pressureInterfaceAppliedImpulseSource, 'not-applied-solver-ready-not-approved');
  assert.equal(update.pressureInterfaceImpulseProofStatus, 'solver-force-application-status-not-approved');
  assert.equal(update.pressureInterfaceForceRowCount, 0);
  nearlyEqual(update.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0, 1e-9);
});

test('WebGPU MLS-MPM grid update marks approved no-readback pressure impulse as submitted but unverified', async () => {
  const device = fakeGridUpdateDevice();
  const update = await runMlsMpmGridUpdateWebGpu({
    device,
    p2gGridProjection: manualP2gProjection(),
    pressureInterfaceForceSolver: pressureInterfaceForceSolverFixture({
      forceApplicationStatus: 'apply-to-mls-mpm-grid'
    }),
    dt: 0.25,
    readbackMode: 'no-full-readback'
  });

  assert.equal(update.backend, 'webgpu');
  assert.equal(update.readbackMode, 'no-full-readback');
  assert.equal(update.queueCompletionStatus, 'queue-submitted-cleanup-deferred');
  assert.equal(update.queueCompletionMethod, 'deferred queue.onSubmittedWorkDone cleanup');
  assert.equal(update.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(update.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-submitted-unverified');
  assert.equal(update.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-submitted-unverified-no-full-readback');
  assert.equal(update.pressureInterfaceAppliedImpulseSource, 'pressure-force-row-sum-unverified-no-full-readback');
  assert.equal(update.pressureInterfaceImpulseProofStatus, 'submitted-to-gpu-grid-update-no-full-readback');
  assert.equal(update.pressureInterfaceForceRowCount, 1);
  nearlyEqual(update.pressureInterfaceAppliedImpulseNSeconds[0], 2, 1e-5);
  nearlyEqual(update.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 2, 1e-5);
});

test('optional MLS-MPM grid update accepts a parity-passing WebGPU result', async () => {
  const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection: manualP2gProjection(),
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = updateMlsMpmGridCpu(args);
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuParity.schema, ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA);
  assert.equal(execution.webgpuParity.status, 'pass');
});

test('optional MLS-MPM grid update rejects parity drift and keeps CPU output', async () => {
  const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection: manualP2gProjection(),
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = updateMlsMpmGridCpu(args);
      result.backend = 'webgpu';
      result.updatedGridNodes = result.updatedGridNodes.slice();
      result.updatedGridNodes[1] += 1;
      return result;
    },
    parityTolerance: 1e-8
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'webgpu-parity-failed');
  assert.equal(execution.webgpuParity.status, 'fail');
  assert.ok(execution.webgpuParity.maxGridAbs > 0.5);
});

test('MLS-MPM grid update parity report is explicit and non-scientific', () => {
  const cpuReference = updateMlsMpmGridCpu({ p2gGridProjection: manualP2gProjection() });
  const parity = createMlsMpmGridUpdateParityReport({
    cpuReference,
    gpuResult: { ...cpuReference, backend: 'webgpu' }
  });

  assert.equal(parity.schema, ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA);
  assert.equal(parity.status, 'pass');
  assert.equal(parity.scientificValidation, false);
  assert.equal(parity.sphValidation, false);
  assert.equal(parity.phaseChangeValidation, false);
  assert.equal(parity.fullPhysicsValidation, false);
});
