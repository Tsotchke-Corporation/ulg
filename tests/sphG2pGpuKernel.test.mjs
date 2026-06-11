import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mlsMpmG2pReconstructWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  createMlsMpmG2pParityReport,
  reconstructMlsMpmG2pCpu,
  runMlsMpmG2pWithOptionalWebGpu
} from '../src/runtime/sph/sphG2pGpuKernel.js';
import { MLS_MPM_GPU_GRID_VELOCITY_FLOATS } from '../src/runtime/sph/sphGridUpdateGpuKernel.js';

function nearlyEqual(actual, expected, tolerance = 1e-5) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function nodeIndex({ gridDims, gridShift }, i, j, k) {
  const [, gny, gnz] = gridDims;
  return ((i + gridShift) * gny + (j + gridShift)) * gnz + (k + gridShift);
}

function fixture({ position = [1.25, 1.25, 1.25], gridVelocity = [2, 0, 0], dt = 0.1 } = {}) {
  const state = new Float32Array([
    position[0], position[1], position[2], 8,
    0, 0, 0, 123
  ]);
  const thermo = new Float32Array(12);
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  mechanics[18] = 1;
  mechanics[19] = 1;
  mechanics[20] = 1;
  mechanics[21] = 1;
  const gridDims = [7, 7, 7];
  const gridShift = 1;
  const gridNodeCount = gridDims[0] * gridDims[1] * gridDims[2];
  const updatedGridNodes = new Float32Array(gridNodeCount * MLS_MPM_GPU_GRID_VELOCITY_FLOATS);
  for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
    const offset = nodeIndex({ gridDims, gridShift }, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
    updatedGridNodes.set([
      1,
      gridVelocity[0],
      gridVelocity[1],
      gridVelocity[2],
      i,
      j,
      k,
      1
    ], offset);
  }
  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      state,
      thermo,
      smoothingLengthM: 1
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      mechanics,
      mechanicsDtS: dt
    },
    gridUpdate: {
      schema: ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
      updateSchema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
      backend: 'cpu-reference',
      particleCount: 1,
      gridSpacingM: 1,
      gridDims,
      gridNodeCount,
      gridShift,
      dt,
      updatedGridNodes
    }
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

test('MLS-MPM G2P WGSL declares particle and grid bindings', () => {
  assert.match(mlsMpmG2pReconstructWgsl, /struct G2pParams/);
  assert.match(mlsMpmG2pReconstructWgsl, /var<storage, read> updated_grid_nodes/);
  assert.match(mlsMpmG2pReconstructWgsl, /var<storage, read_write> out_sph_state/);
  assert.match(mlsMpmG2pReconstructWgsl, /var<storage, read_write> out_mls_mechanics/);
  assert.match(mlsMpmG2pReconstructWgsl, /g2p_cubic_root_positive/);
  assert.match(mlsMpmG2pReconstructWgsl, /@compute @workgroup_size\(64\)/);
});

test('CPU MLS-MPM G2P reconstructs velocity and advects without affine strain in constant grid flow', () => {
  const { sphParticleState, mlsMpmParticleState, gridUpdate } = fixture();
  const result = reconstructMlsMpmG2pCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    boxDimsM: [3, 3, 3]
  });

  assert.equal(result.schema, ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA);
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.kernelScope, 'mls-mpm-g2p-velocity-affine-deformation-reconstruction');
  nearlyEqual(result.state[0], 1.45);
  nearlyEqual(result.state[4], 2);
  nearlyEqual(result.state[5], 0);
  nearlyEqual(result.mechanics[0], 1);
  nearlyEqual(result.mechanics[4], 1);
  nearlyEqual(result.mechanics[8], 1);
  nearlyEqual(result.mechanics[18], 1);
  nearlyEqual(result.mechanics[9], 0, 1e-4);
  assert.equal(result.g2pValidation, false);
  assert.equal(result.fullPhysicsValidation, false);
});

test('CPU MLS-MPM G2P clamps particle walls and inward velocity', () => {
  const { sphParticleState, mlsMpmParticleState, gridUpdate } = fixture({
    position: [0.05, 1.25, 1.25],
    gridVelocity: [-2, 0, 0],
    dt: 0.1
  });
  const result = reconstructMlsMpmG2pCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    boxDimsM: [3, 3, 3]
  });

  assert.equal(result.state[0], 0);
  assert.equal(result.state[4], 0);
});

test('optional MLS-MPM G2P returns CPU reference when WebGPU is not requested', async () => {
  const args = fixture();
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...args,
    preferWebGpu: false,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          throw new Error('should not request WebGPU');
        }
      }
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'not-requested');
});

test('optional MLS-MPM G2P falls back when WebGPU is unavailable', async () => {
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...fixture(),
    preferWebGpu: true,
    navigatorRef: {}
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'blocked-webgpu-unavailable');
  assert.equal(execution.webgpuStatus.fallback, 'cpu-reference');
});

test('optional MLS-MPM G2P accepts a parity-passing WebGPU result', async () => {
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...fixture(),
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = reconstructMlsMpmG2pCpu(args);
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuParity.schema, ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA);
  assert.equal(execution.webgpuParity.status, 'pass');
});

test('optional MLS-MPM G2P rejects parity drift and keeps CPU output', async () => {
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...fixture(),
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = reconstructMlsMpmG2pCpu(args);
      result.backend = 'webgpu';
      result.state = result.state.slice();
      result.state[0] += 1;
      return result;
    },
    parityTolerance: 1e-8
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'webgpu-parity-failed');
  assert.equal(execution.webgpuParity.status, 'fail');
  assert.ok(execution.webgpuParity.maxStateAbs > 0.5);
});

test('MLS-MPM G2P parity report is explicit and non-scientific', () => {
  const cpuReference = reconstructMlsMpmG2pCpu(fixture());
  const parity = createMlsMpmG2pParityReport({
    cpuReference,
    gpuResult: { ...cpuReference, backend: 'webgpu' }
  });

  assert.equal(parity.schema, ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA);
  assert.equal(parity.status, 'pass');
  assert.equal(parity.scientificValidation, false);
  assert.equal(parity.sphValidation, false);
  assert.equal(parity.phaseChangeValidation, false);
  assert.equal(parity.fullPhysicsValidation, false);
});
