import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carrierStepWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import { createClosureHandle } from '../src/runtime/closureHandle.js';
import { createCarrierRuntime, createDefaultCarrierState } from '../src/runtime/carrierRuntime.js';
import {
  ULG_CARRIER_WEBGPU_PARITY_SCHEMA,
  runCarrierRuntimeWithOptionalWebGpu
} from '../src/runtime/webgpuCarrierKernel.js';
import { hashPayload } from '../ulg-gpu-abi/src/index.js';

function createOscillatorClosure() {
  const inputHash = hashPayload({ closureKind: 'toy-two-particle-oscillator', runtime: 'webgpu-test' });
  const methodHash = hashPayload({ mode: 'table-interpolation', potential: 'harmonic' });
  const samples = [];
  for (let index = 0; index <= 120; index += 1) {
    const r = 0.6 + index * 0.01;
    const displacement = r - 1;
    samples.push({
      r,
      energy: 0.5 * displacement * displacement,
      dEdr: displacement
    });
  }
  return {
    closureId: 'toy-oscillator-webgpu-test-closure',
    sourceService: 'eshkol',
    closureKind: 'toy-two-particle-oscillator',
    inputHash,
    methodHash,
    inputs: [{ name: 'r' }],
    outputs: [{ name: 'energy' }],
    derivatives: [{ output: 'energy', axis: 'r', name: 'dEdr' }],
    execution: {
      mode: 'table-interpolation',
      table: {
        axisName: 'r',
        outputName: 'energy',
        derivativeName: 'dEdr',
        samples
      }
    },
    validity: { r: [0.6, 1.8] },
    validation: { status: 'pass', scientificValidation: false, fullPhysicsValidation: false },
    provenance: { inputHash, methodHash }
  };
}

test('carrier-step WGSL exposes storage buffers, table sampling, and compute entrypoint', () => {
  assert.match(carrierStepWgsl, /struct CarrierBody/);
  assert.match(carrierStepWgsl, /struct ClosureTableSample/);
  assert.match(carrierStepWgsl, /var<storage, read_write> bodies/);
  assert.match(carrierStepWgsl, /var<storage, read> samples: array<ClosureTableSample>/);
  assert.match(carrierStepWgsl, /fn sample_derivative/);
  assert.match(carrierStepWgsl, /@compute @workgroup_size\(1\)/);
});

test('optional WebGPU carrier path returns CPU reference when WebGPU is not requested', async () => {
  const closureArtifact = createOscillatorClosure();
  const closureHandle = createClosureHandle(closureArtifact);
  const result = await runCarrierRuntimeWithOptionalWebGpu({
    closureArtifact,
    closureHandle,
    initialState: createDefaultCarrierState({ separation: 1.2 }),
    steps: 16,
    dt: 0.002,
    preferWebGpu: false,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          throw new Error('should not be called');
        }
      }
    }
  });

  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.webgpuStatus.status, 'not-requested');
  assert.equal(result.deltas.length, 16);
  assert.equal(result.deltas[0].fieldClosureSampleSummary.schema, 'peercompute.ulg.field-closure-sample-summary.v0');
  assert.equal(result.deltas[0].fieldClosureSampleSummary.status, 'pass');
  assert.equal(result.deltas[0].fieldClosureSampleSummary.validityStatus, 'in-range');
  assert.equal(result.deltas[0].fieldClosureSampleSummary.closureRefreshRecommended, false);
  assert.equal(result.deltas[0].fieldClosureSampleSummary.fullPhysicsValidation, false);
});

test('optional WebGPU carrier path falls back to CPU reference without navigator.gpu', async () => {
  const closureArtifact = createOscillatorClosure();
  const closureHandle = createClosureHandle(closureArtifact);
  const result = await runCarrierRuntimeWithOptionalWebGpu({
    closureArtifact,
    closureHandle,
    initialState: createDefaultCarrierState({ separation: 1.2 }),
    steps: 16,
    dt: 0.002,
    preferWebGpu: true,
    navigatorRef: {},
    toleranceProfile: {
      name: 'toy-carrier-reference',
      energyAbs: 2e-5,
      momentumAbs: 1e-12
    }
  });

  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.webgpuStatus.status, 'blocked-webgpu-unavailable');
  assert.equal(result.webgpuStatus.fallback, 'cpu-reference');
  assert.equal(result.deltas.length, 16);
  assert.equal(result.invariants.status, 'pass');
});

test('optional WebGPU carrier path rejects parity drift and keeps CPU result', async () => {
  const closureArtifact = createOscillatorClosure();
  const closureHandle = createClosureHandle(closureArtifact);
  const initialState = createDefaultCarrierState({ separation: 1.2 });
  const result = await runCarrierRuntimeWithOptionalWebGpu({
    closureArtifact,
    closureHandle,
    initialState,
    steps: 16,
    dt: 0.002,
    preferWebGpu: true,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          return {
            async requestDevice() {
              return { lost: new Promise(() => {}) };
            }
          };
        }
      }
    },
    async webGpuRunner({ closureHandle: runnerClosureHandle, initialState: runnerInitialState, steps, dt, toleranceProfile }) {
      const runtime = createCarrierRuntime({
        closureHandle: runnerClosureHandle,
        dt,
        toleranceProfile
      });
      const result = runtime.run(runnerInitialState, steps);
      result.backend = 'webgpu';
      result.finalState = {
        ...result.finalState,
        bodies: result.finalState.bodies.map((body, index) => ({
          ...body,
          x: body.x + (index === 0 ? 1 : 0)
        }))
      };
      return result;
    },
    parityTolerance: 1e-8
  });

  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.webgpuStatus.status, 'webgpu-parity-failed');
  assert.equal(result.webgpuParity.schema, ULG_CARRIER_WEBGPU_PARITY_SCHEMA);
  assert.equal(result.webgpuParity.status, 'fail');
  assert.ok(result.webgpuParity.maxPositionAbs > 0.5);
});

test('optional WebGPU carrier path accepts a parity-passing WebGPU result', async () => {
  const closureArtifact = createOscillatorClosure();
  const closureHandle = createClosureHandle(closureArtifact);
  const result = await runCarrierRuntimeWithOptionalWebGpu({
    closureArtifact,
    closureHandle,
    initialState: createDefaultCarrierState({ separation: 1.2 }),
    steps: 16,
    dt: 0.002,
    preferWebGpu: true,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          return {
            async requestDevice() {
              return { lost: new Promise(() => {}) };
            }
          };
        }
      }
    },
    async webGpuRunner({ closureHandle: runnerClosureHandle, initialState, steps, dt, toleranceProfile }) {
      const runtime = createCarrierRuntime({
        closureHandle: runnerClosureHandle,
        dt,
        toleranceProfile
      });
      return {
        ...runtime.run(initialState, steps),
        backend: 'webgpu'
      };
    },
    parityTolerance: 1e-8
  });

  assert.equal(result.backend, 'webgpu');
  assert.equal(result.webgpuStatus.status, 'webgpu-executed');
  assert.equal(result.webgpuParity.schema, ULG_CARRIER_WEBGPU_PARITY_SCHEMA);
  assert.equal(result.webgpuParity.status, 'pass');
  assert.equal(result.deltas.length, 16);
  assert.equal(result.deltas[0].fieldClosureSampleSummary.schema, 'peercompute.ulg.field-closure-sample-summary.v0');
  assert.equal(result.deltas[0].fieldClosureSampleSummary.status, 'pass');
  assert.equal(result.deltas[0].fieldClosureSampleSummary.validityStatus, 'in-range');
  assert.equal(result.deltas[0].fieldClosureSampleSummary.closureRefreshRecommended, false);
  assert.equal(result.deltas[0].fieldClosureSampleSummary.fullPhysicsValidation, false);
});

test('optional WebGPU carrier path reports device-lost CPU fallback', async () => {
  const closureArtifact = createOscillatorClosure();
  const closureHandle = createClosureHandle(closureArtifact);
  const deviceLostEvents = [];
  const result = await runCarrierRuntimeWithOptionalWebGpu({
    closureArtifact,
    closureHandle,
    initialState: createDefaultCarrierState({ separation: 1.2 }),
    steps: 16,
    dt: 0.002,
    preferWebGpu: true,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          return {
            async requestDevice() {
              return { lost: Promise.resolve({ reason: 'destroyed' }) };
            }
          };
        }
      }
    },
    onDeviceLost(info) {
      deviceLostEvents.push(info.reason);
    },
    async webGpuRunner() {
      throw new Error('runner should not execute after immediate device loss');
    }
  });

  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.webgpuStatus.status, 'webgpu-device-lost-fallback');
  assert.equal(result.webgpuStatus.reason, 'destroyed');
  assert.deepEqual(deviceLostEvents, ['destroyed']);
});

test('WebGPU parity schema stays explicit and non-scientific when exported', () => {
  assert.equal(ULG_CARRIER_WEBGPU_PARITY_SCHEMA, 'peercompute.ulg.carrier-webgpu-parity.v0');
});
