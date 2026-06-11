import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mlsMpmGridUpdateWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  MLS_MPM_GPU_GRID_VELOCITY_FLOATS,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  createMlsMpmGridUpdateParityReport,
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

test('MLS-MPM grid update WGSL declares grid update bindings', () => {
  assert.match(mlsMpmGridUpdateWgsl, /struct GridUpdateParams/);
  assert.match(mlsMpmGridUpdateWgsl, /var<storage, read> p2g_grid_nodes/);
  assert.match(mlsMpmGridUpdateWgsl, /var<storage, read_write> updated_grid_nodes/);
  assert.match(mlsMpmGridUpdateWgsl, /params.cfl_factor/);
  assert.match(mlsMpmGridUpdateWgsl, /@compute @workgroup_size\(64\)/);
});

test('CPU MLS-MPM grid update converts momentum to velocity and applies gravity', () => {
  const p2gGridProjection = manualP2gProjection();
  const update = updateMlsMpmGridCpu({
    p2gGridProjection,
    dt: 0.1,
    gravityMPerS2: [0, -10, 0],
    boxDimsM: [3, 3, 3],
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

test('CPU MLS-MPM grid update applies CFL clamp and sealed-wall normal clamp', () => {
  const cfl = updateMlsMpmGridCpu({
    p2gGridProjection: manualP2gProjection({ momentum: [100, 0, 0] }),
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [3, 3, 3],
    cflFactor: 0.2
  });
  nearlyEqual(cfl.updatedGridNodes[1], 2);

  const wall = updateMlsMpmGridCpu({
    p2gGridProjection: manualP2gProjection({ momentum: [-4, 0, 0], nodePosition: [0, 1, 1] }),
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [3, 3, 3],
    cflFactor: 10
  });
  nearlyEqual(wall.updatedGridNodes[1], 0);
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
