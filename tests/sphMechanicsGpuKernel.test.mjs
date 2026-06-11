import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mlsMpmMechanicsPredictWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import { buildSphPhaseDemoState } from '../src/runtime/sphPhaseDemo.js';
import {
  buildMlsMpmGpuParticleBuffers,
  buildSphGpuParticleBuffers
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  ULG_MLS_MPM_GPU_MECHANICS_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_MECHANICS_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_MECHANICS_PREDICTION_SCHEMA,
  createMlsMpmMechanicsParityReport,
  predictMlsMpmMechanicsCpu,
  runMlsMpmMechanicsPredictWithOptionalWebGpu
} from '../src/runtime/sph/sphMechanicsGpuKernel.js';

function nearlyEqual(actual, expected, tolerance = 1e-5) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function fixtureBuffers() {
  const demo = buildSphPhaseDemoState({ dropParticleEdge: 1, baseParticleEdge: 1 });
  const particle = demo.state.particles[0];
  particle.x = [1, 2, 3];
  particle.v = [0.5, 0.25, -0.125];
  particle.specificInternalEnergyJPerKg = 12345;
  particle.mpmF = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  particle.mpmC = new Float64Array([0.2, 0.03, 0, 0, -0.1, 0, 0, 0, 0.05]);
  particle.mpmJ = 1;
  particle.mpmVolume0 = particle.massKg / particle.restDensityKgPerM3;
  particle.mpmSolid = true;
  return {
    demo,
    sphParticleState: buildSphGpuParticleBuffers(demo.state, {
      materialProperties: demo.materialProperties
    }),
    mlsMpmParticleState: buildMlsMpmGpuParticleBuffers(demo.state, {
      materialProperties: demo.materialProperties
    })
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

test('MLS-MPM mechanics prediction WGSL declares vec4 storage buffers and compute entrypoint', () => {
  assert.match(mlsMpmMechanicsPredictWgsl, /struct MechanicsParams/);
  assert.match(mlsMpmMechanicsPredictWgsl, /var<storage, read> sph_state/);
  assert.match(mlsMpmMechanicsPredictWgsl, /var<storage, read> sph_thermo/);
  assert.match(mlsMpmMechanicsPredictWgsl, /var<storage, read> mls_mechanics/);
  assert.match(mlsMpmMechanicsPredictWgsl, /var<storage, read_write> out_sph_state/);
  assert.match(mlsMpmMechanicsPredictWgsl, /var<storage, read_write> out_mls_mechanics/);
  assert.match(mlsMpmMechanicsPredictWgsl, /fn det3/);
  assert.match(mlsMpmMechanicsPredictWgsl, /@compute @workgroup_size\(64\)/);
});

test('CPU MLS-MPM mechanics prediction updates position, velocity, F, and J only', () => {
  const { sphParticleState, mlsMpmParticleState } = fixtureBuffers();
  const beforeState = sphParticleState.state.slice();
  const beforeMechanics = mlsMpmParticleState.mechanics.slice();
  const dt = 0.1;
  const result = predictMlsMpmMechanicsCpu({
    sphParticleState,
    mlsMpmParticleState,
    dt,
    gravityMPerS2: [0, -10, 0],
    boxDimsM: [5, 5, 5]
  });

  assert.equal(result.schema, ULG_MLS_MPM_GPU_MECHANICS_PREDICTION_SCHEMA);
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.kernelScope, 'particle-local-ballistic-apic-deformation-predictor');
  nearlyEqual(result.state[4], beforeState[4]);
  nearlyEqual(result.state[5], beforeState[5] - 1);
  nearlyEqual(result.state[6], beforeState[6]);
  nearlyEqual(result.state[0], beforeState[0] + result.state[4] * dt);
  nearlyEqual(result.state[1], beforeState[1] + result.state[5] * dt);
  nearlyEqual(result.state[2], beforeState[2] + result.state[6] * dt);
  assert.equal(result.state[7], beforeState[7], 'specific internal energy must remain unchanged');
  nearlyEqual(result.mechanics[0], 1.02);
  nearlyEqual(result.mechanics[1], 0.003);
  nearlyEqual(result.mechanics[4], 0.99);
  nearlyEqual(result.mechanics[8], 1.005);
  nearlyEqual(result.mechanics[18], result.mechanics[0] * result.mechanics[4] * result.mechanics[8], 2e-4);
  assert.equal(result.mechanics[19], beforeMechanics[19], 'rest volume is copied');
  assert.equal(result.mechanics[20], beforeMechanics[20], 'solid flag is copied');
  assert.equal(result.p2gValidation, false);
  assert.equal(result.gridValidation, false);
  assert.equal(result.g2pValidation, false);
  assert.equal(result.sphValidation, false);
  assert.equal(result.phaseChangeValidation, false);
  assert.equal(result.fullPhysicsValidation, false);
});

test('CPU MLS-MPM mechanics prediction clamps box walls without changing mass or energy', () => {
  const { sphParticleState, mlsMpmParticleState } = fixtureBuffers();
  sphParticleState.state[0] = 0.01;
  sphParticleState.state[4] = -1;
  const result = predictMlsMpmMechanicsCpu({
    sphParticleState,
    mlsMpmParticleState,
    dt: 1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5]
  });

  assert.equal(result.state[0], 0);
  assert.equal(result.state[4], 0);
  assert.equal(result.state[3], sphParticleState.state[3]);
  assert.equal(result.state[7], sphParticleState.state[7]);
});

test('optional MLS-MPM mechanics prediction returns CPU reference when WebGPU is not requested', async () => {
  const { sphParticleState, mlsMpmParticleState } = fixtureBuffers();
  const execution = await runMlsMpmMechanicsPredictWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    preferWebGpu: false,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          throw new Error('should not request WebGPU');
        }
      }
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_MECHANICS_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'not-requested');
  assert.equal(execution.scientificValidation, false);
  assert.equal(execution.sphValidation, false);
  assert.equal(execution.phaseChangeValidation, false);
});

test('optional MLS-MPM mechanics prediction falls back when WebGPU is unavailable', async () => {
  const { sphParticleState, mlsMpmParticleState } = fixtureBuffers();
  const execution = await runMlsMpmMechanicsPredictWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    preferWebGpu: true,
    navigatorRef: {}
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'blocked-webgpu-unavailable');
  assert.equal(execution.webgpuStatus.fallback, 'cpu-reference');
});

test('optional MLS-MPM mechanics prediction accepts a parity-passing WebGPU result', async () => {
  const { sphParticleState, mlsMpmParticleState } = fixtureBuffers();
  const execution = await runMlsMpmMechanicsPredictWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = predictMlsMpmMechanicsCpu(args);
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuParity.schema, ULG_MLS_MPM_GPU_MECHANICS_PARITY_SCHEMA);
  assert.equal(execution.webgpuParity.status, 'pass');
  assert.equal(execution.fullPhysicsValidation, false);
});

test('optional MLS-MPM mechanics prediction rejects parity drift and keeps CPU output', async () => {
  const { sphParticleState, mlsMpmParticleState } = fixtureBuffers();
  const execution = await runMlsMpmMechanicsPredictWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = predictMlsMpmMechanicsCpu(args);
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

test('MLS-MPM mechanics parity report is explicit and non-scientific', () => {
  const { sphParticleState, mlsMpmParticleState } = fixtureBuffers();
  const cpuReference = predictMlsMpmMechanicsCpu({ sphParticleState, mlsMpmParticleState });
  const parity = createMlsMpmMechanicsParityReport({
    cpuReference,
    gpuResult: { ...cpuReference, backend: 'webgpu' }
  });

  assert.equal(parity.schema, ULG_MLS_MPM_GPU_MECHANICS_PARITY_SCHEMA);
  assert.equal(parity.status, 'pass');
  assert.equal(parity.scientificValidation, false);
  assert.equal(parity.sphValidation, false);
  assert.equal(parity.phaseChangeValidation, false);
  assert.equal(parity.fullPhysicsValidation, false);
});
