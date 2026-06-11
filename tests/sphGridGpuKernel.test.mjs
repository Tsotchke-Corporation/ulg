import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mlsMpmP2gGridProjectionWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  MLS_MPM_GPU_GRID_NODE_FLOATS,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  createMlsMpmGridSpec,
  createMlsMpmP2gGridProjectionParityReport,
  projectMlsMpmP2gGridCpu,
  runMlsMpmP2gGridProjectionWithOptionalWebGpu
} from '../src/runtime/sph/sphGridGpuKernel.js';

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
  smoothingLengthM = 1
} = {}) {
  const state = new Float32Array([
    position[0], position[1], position[2], massKg,
    velocity[0], velocity[1], velocity[2], 123
  ]);
  const thermo = new Float32Array(12);
  const mechanics = new Float32Array(24);
  mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  mechanics.set(affineC, 9);
  mechanics[18] = 1;
  mechanics[19] = 1;
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

test('MLS-MPM P2G grid projection WGSL declares gather-form grid bindings', () => {
  assert.match(mlsMpmP2gGridProjectionWgsl, /struct P2gProjectionParams/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> sph_state/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> sph_thermo/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> mls_mechanics/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read_write> grid_nodes/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /for \(var particle_index/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@compute @workgroup_size\(64\)/);
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
  assert.equal(projection.kernelScope, 'gather-form-p2g-mass-momentum-projection');
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
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuParity.schema, ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA);
  assert.equal(execution.webgpuParity.status, 'pass');
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
