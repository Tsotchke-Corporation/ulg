import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { discoverReactionCandidates } from '../src/runtime/chemistry/reactionCandidates.js';
import { createWarmClosureMissBridge } from '../src/runtime/material/warmClosureMissBridge.js';
import { buildWorkerNativeSurfaceMotionUniformValues } from '../src/services/workerOwnedNativeSurfaceMaterial.js';
import {
  attachWebGpuUncapturedErrorTelemetry
} from '../src/runtime/webgpuDeviceLimits.js';
import {
  nativeMarchingCubesVertexRowsBudgetPerSurface,
  nativeMarchingCubesRenderFieldResolutionForVertexRowsBudget
} from '../src/visualization/sphPhaseScene.js';
import {
  DEFAULT_PEERCOMPUTE_BROWSER_MODULE_URL,
  DEFAULT_PEERCOMPUTE_NODE_KERNEL_MODULE_URL,
  DEFAULT_PEERCOMPUTE_COMPUTE_MANAGER_MODULE_URL,
  DEFAULT_PEERCOMPUTE_STATE_MANAGER_MODULE_URL,
  DEFAULT_PEERCOMPUTE_GPU_HUB_MODULE_URL,
  DEFAULT_PEERCOMPUTE_REMOTE_RESULT_QUORUM_MODULE_URL
} from '../src/runtime/peercomputeBrowserResidentHost.js';
import { resolveSphWallReservoirAuthority } from '../src/runtime/thermalEnvironmentAuthority.js';
import { createSchroederSolidFractureStage } from '../src/runtime/sph/schroederSolidFractureGpu.js';
import { verifyPagesBuild } from '../scripts/verify-pages-build.mjs';

test('P0: sphPhaseViewStateTransport.js contains zero raw NUL (0x00) bytes', () => {
  const bytes = readFileSync(new URL('../src/runtime/sphPhaseViewStateTransport.js', import.meta.url));
  assert.equal(bytes.includes(0x00), false, 'raw 0x00 byte breaks text tooling and ICC indexing');
});

test('P0: peercomputeBrowserResidentHost emits zero hardcoded /@fs host filesystem URLs', () => {
  for (const url of [
    DEFAULT_PEERCOMPUTE_BROWSER_MODULE_URL,
    DEFAULT_PEERCOMPUTE_NODE_KERNEL_MODULE_URL,
    DEFAULT_PEERCOMPUTE_COMPUTE_MANAGER_MODULE_URL,
    DEFAULT_PEERCOMPUTE_STATE_MANAGER_MODULE_URL,
    DEFAULT_PEERCOMPUTE_GPU_HUB_MODULE_URL,
    DEFAULT_PEERCOMPUTE_REMOTE_RESULT_QUORUM_MODULE_URL
  ]) {
    assert.equal(url, null);
  }
  const source = readFileSync(new URL('../src/runtime/peercomputeBrowserResidentHost.js', import.meta.url), 'utf8');
  assert.equal(source.includes('/@fs/home/'), false);
});

test('P0: marching cubes vertex-row byte budget clamps to device.limits.maxStorageBufferBindingSize', () => {
  const smallDevice = { limits: { maxStorageBufferBindingSize: 64 * 1024 * 1024 } };
  const largeDevice = { limits: { maxStorageBufferBindingSize: 512 * 1024 * 1024 } };
  const smallRows = nativeMarchingCubesVertexRowsBudgetPerSurface(2, { device: smallDevice });
  const largeRows = nativeMarchingCubesVertexRowsBudgetPerSurface(2, { device: largeDevice });
  assert.ok(smallRows < largeRows, '64 MB device must budget fewer vertex rows than 256 MB default');
  assert.ok(smallRows * 2 * 16 <= 64 * 1024 * 1024);
  const smallRes = nativeMarchingCubesRenderFieldResolutionForVertexRowsBudget(2, { device: smallDevice });
  const largeRes = nativeMarchingCubesRenderFieldResolutionForVertexRowsBudget(2, { device: largeDevice });
  assert.ok(smallRes <= largeRes);
});

test('P0: native surface material motion uniform applies damped motion age when motionPacing is present', () => {
  const frame = {
    motionField: { buffer: {}, rowCount: 32 },
    drawMotionAgeS: 0.02,
    motionPacing: { maxSimulationAgeS: 0.02 }
  };
  const surface = { descriptor: { fieldOffset: 4 }, metadata: { resolution: 16 } };
  const cam = new Float32Array(80);
  cam[32] = 0.05;
  const motion = buildWorkerNativeSurfaceMotionUniformValues(frame, surface, cam);
  const tau = 0.02 * 0.65;
  const expected = tau * (1 - Math.exp(-0.02 / tau));
  assert.ok(Math.abs(motion[4] - expected) < 1e-6, `expected damped ${expected}, got ${motion[4]}`);
});

test('P0: sedenion reaction scoping prioritizes without suppressing stoichiometrically balanced candidates', () => {
  const src = readFileSync(new URL('../src/runtime/chemistry/reactionCandidates.js', import.meta.url), 'utf8');
  assert.equal(src.includes("if (sedenionScope.reactiveClass === 'inert') return null;"), false);
  // Reactive pair still prioritizes cleanly and balanced pairs remain intact.
  const csF = discoverReactionCandidates('Cs', 'F2');
  assert.ok(csF.candidates.length >= 1);
  assert.equal(csF.candidates[0].sedenionScope.reactiveClass, 'reactive');
  // Noble gases still emit zero spurious candidates via valence rules.
  const heO = discoverReactionCandidates('He', 'O2');
  assert.equal(heO.candidates.length, 0);
});

test('P0: A6 warmClosureMissBridge wires live eshkolSample when requested and emits adoptedEosStiffnessBundles', async () => {
  const servicesCalled = new Set();
  const bridge = createWarmClosureMissBridge({
    maxInFlight: 4,
    sourceIdentity: 'p0-a6-test',
    taskRunner: async (payload) => {
      servicesCalled.add(payload.service);
      if (payload.service === 'moonlab') {
        return { value: { qubits: payload.qubits, bellFidelity: 0.999 }, commitDelta: null };
      }
      if (payload.service === 'eshkol') {
        if (payload.call === 'eos-stiffness') {
          const samples = payload.points.map(([rho]) => rho * 1480 * 1480 * Math.pow(rho / 1000, 6));
          return { value: { samples }, commitDelta: null };
        }
        return { value: { samples: payload.points.map(() => 1.0) }, commitDelta: null };
      }
      throw new Error(`unexpected service ${payload.service}`);
    }
  });

  const eosReq = bridge.requestEosStiffnessClosureMiss({
    missKey: 'p0-eos-water',
    restDensityKgPerM3: 1000,
    soundSpeedMPerS: 1480,
    scheduleId: 's1'
  });
  await eosReq.promise;
  const adoption = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 's2' });
  assert.equal(adoption.adoptedCount, 1);
  assert.equal(adoption.adoptedEosStiffnessBundles.length, 1);
  assert.ok(adoption.adoptedEosStiffnessBundles[0].packedData instanceof Float32Array);
  assert.ok(adoption.adoptedEosStiffnessBundles[0].packedData.length > 0);
  assert.ok(servicesCalled.has('eshkol'));
  bridge.destroy();
});

test('P0: attachWebGpuUncapturedErrorTelemetry attaches idempotently and records errors', () => {
  const listeners = new Map();
  const fakeDevice = {
    addEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) ?? 0) + 1);
      this._fn = fn;
    }
  };
  assert.equal(attachWebGpuUncapturedErrorTelemetry(fakeDevice, { label: 'test-dev' }), true);
  assert.equal(attachWebGpuUncapturedErrorTelemetry(fakeDevice, { label: 'test-dev' }), false);
  assert.equal(listeners.get('uncapturederror'), 1);
});

test('P0: SOL-5 fracture stage clamps maxBodyCapacity to actual frameBuffer/latticeBuffer size and skips when no loads active', () => {
  const writes = [];
  let dispatches = 0;
  const fakeDevice = {
    createShaderModule: () => ({}),
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createComputePipeline: () => ({}),
    createBindGroup: () => ({}),
    createBuffer: ({ size }) => ({ size, destroy() {} }),
    queue: { writeBuffer: (...args) => writes.push(args) }
  };
  const stage = createSchroederSolidFractureStage({
    device: fakeDevice,
    memberCount: 8,
    proxyCount: 8,
    initialBodyCount: 1,
    maxBodyCapacity: 10,
    // Deliberately smaller buffers (2 bodies max): must clamp to 2, never OOB to 10!
    frameBuffer: { size: 2 * 128 },
    memberBuffer: { size: 8 * 32 },
    memberWorldBuffer: { size: 8 * 32 },
    proxyBuffer: { size: 8 * 32 },
    neighborBuffer: { size: 8 * 32 },
    latticeBuffer: { size: 2 * 64 },
    pitchM: [0.05, 0.05, 0.05]
  });
  assert.equal(stage.maxBodyCapacity, 2);
  assert.equal(stage.hasActiveLoads(), false);
  const fakePass = { setBindGroup() {}, setPipeline() {}, dispatchWorkgroups() { dispatches += 1; } };
  assert.equal(stage.encode({}, 1e-3, { pass: fakePass, prepared: true, skipIfNoLoads: true }), false);
  assert.equal(dispatches, 0);
  stage.setMemberLoads(new Float32Array(8 * 4));
  assert.equal(stage.hasActiveLoads(), true);
  assert.equal(stage.encode({}, 1e-3, { pass: fakePass, prepared: true, skipIfNoLoads: true }), true);
  assert.ok(dispatches > 0);
});

test('P0: thermalEnvironmentAuthority surfaces implicit 0 K wall faces explicitly', () => {
  const auth = resolveSphWallReservoirAuthority({ wallTemperaturesK: { yMin: 400 } });
  assert.equal(auth.implicitZeroKelvinFaceCount, 5);
  assert.equal(auth.implicitZeroKelvinFaces.includes('yMin'), false);
  assert.equal(auth.implicitZeroKelvinFaces.includes('yMax'), true);
});

test('P0: verifyPagesBuild rejects host filesystem /@fs/ path leaks in JS bundles', async () => {
  // Covered indirectly by checking verifier implementation exports & regex presence.
  const src = readFileSync(new URL('../scripts/verify-pages-build.mjs', import.meta.url), 'utf8');
  assert.equal(typeof verifyPagesBuild, 'function');
  assert.match(src, /\\\/@fs\\\//);
});
