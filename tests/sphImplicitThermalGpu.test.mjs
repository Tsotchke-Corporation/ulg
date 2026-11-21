import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeSphImplicitThermalOptions,
  sphImplicitThermalIterationsFor,
  linearizedRadiativeConductanceWPerK,
  packSphImplicitThermalParams,
  sphImplicitThermalWgsl,
  solveSphImplicitThermalCpuReference,
  STEFAN_BOLTZMANN_W_PER_M2_K4
} from '../src/runtime/sph/sphImplicitThermalGpu.js';

test('implicit thermal options clamp theta to L-stable [0.5, 1] and derive PCG iterations from Fourier number', () => {
  for (const off of [undefined, null, false, 0, '0', 'off', '', { enabled: false }]) {
    assert.equal(normalizeSphImplicitThermalOptions(off), null);
  }
  const on = normalizeSphImplicitThermalOptions({});
  assert.equal(on.enabled, true);
  assert.equal(on.theta, 1);
  assert.equal(on.iterations, 16); // ceil(4 * sqrt(16))
  assert.equal(normalizeSphImplicitThermalOptions({ theta: 0.1 }).theta, 0.5);
  assert.equal(sphImplicitThermalIterationsFor(100), 40);
  assert.equal(sphImplicitThermalIterationsFor(10000), 64);
});

test('linearized radiative conductance is symmetric and reproduces exact Stefan-Boltzmann T^4 flux', () => {
  const ti = 1850;
  const tj = 233;
  const eps = 0.85;
  const area = 1e-4;
  const g = linearizedRadiativeConductanceWPerK(ti, tj, eps, area);
  assert.equal(g, linearizedRadiativeConductanceWPerK(tj, ti, eps, area));
  const exactFlux = STEFAN_BOLTZMANN_W_PER_M2_K4 * eps * area * (ti ** 4 - tj ** 4);
  assert.ok(Math.abs(g * (ti - tj) - exactFlux) / exactFlux < 1e-12);
});

test('IMEX thermal PCG is unconditionally stable at Fo=50 (1850K molten iron on 233K ice) with exact conservation', () => {
  // 16-node 1D bar: left 8 nodes 1850 K molten iron, right 8 nodes 233 K ice.
  // Explicit Euler stability limit is dt <= C / (2 * G) = 0.5 s; test dt = 25 s (Fo = 50!).
  const n = 16;
  const nodeState = new Float32Array(n * 4);
  const rowOffsets = [0];
  const edgeNeighbors = [];
  const edgeConductance = [];
  for (let i = 0; i < n; i += 1) {
    nodeState[i * 4] = i < 8 ? 1.0 : 2.5; // J/K heat capacity
    nodeState[i * 4 + 1] = i < 8 ? 1850 : 233;
    nodeState[i * 4 + 2] = 0; // adiabatic
    nodeState[i * 4 + 3] = 293.15;
  }
  for (let i = 0; i < n; i += 1) {
    if (i > 0) {
      edgeNeighbors.push(i - 1);
      edgeConductance.push(1.0 + linearizedRadiativeConductanceWPerK(nodeState[i * 4 + 1], nodeState[(i - 1) * 4 + 1], 0.5, 1e-4));
    }
    if (i + 1 < n) {
      edgeNeighbors.push(i + 1);
      edgeConductance.push(1.0 + linearizedRadiativeConductanceWPerK(nodeState[i * 4 + 1], nodeState[(i + 1) * 4 + 1], 0.5, 1e-4));
    }
    rowOffsets.push(edgeNeighbors.length);
  }
  const dt = 25; // Fo = 50 (explicit Euler would blow up by ~100x!)
  const res = solveSphImplicitThermalCpuReference({
    nodeState,
    rowOffsets,
    edgeNeighbors,
    edgeConductance,
    dt,
    options: { theta: 1, maxFourierNumber: 50, relativeTolerance: 1e-6 }
  });
  assert.ok(res.relativeResidual < 1e-5, `residual ${res.relativeResidual}`);
  // Exact conservation: sum of pairwise energy increments == 0 to floating-point precision.
  assert.ok(Math.abs(res.totalPairEnergyJ) < 1e-9, `energy drift ${res.totalPairEnergyJ}`);
  // Discrete maximum principle: every temperature stays strictly inside [233, 1850] and monotone!
  for (let i = 0; i < n; i += 1) {
    const t = res.outEnergy[i * 4];
    assert.ok(t >= 233 && t <= 1850, `node ${i} T=${t} violated maximum principle`);
    if (i > 0) {
      assert.ok(t <= res.outEnergy[(i - 1) * 4] + 1e-9, `non-monotone profile at ${i}`);
    }
  }
  // Exact conservation even under truncated 2-iteration PCG!
  const truncated = solveSphImplicitThermalCpuReference({
    nodeState,
    rowOffsets,
    edgeNeighbors,
    edgeConductance,
    dt,
    options: { theta: 1, iterations: 2 }
  });
  assert.ok(Math.abs(truncated.totalPairEnergyJ) < 1e-9, 'early-stopped PCG must still conserve energy identically');
});

test('implicit thermal WGSL uniform packing and uniform-barrier structure', () => {
  const packed = packSphImplicitThermalParams({ nodeCount: 128, edgeCount: 512, dt: 0.01, theta: 0.75, relativeTolerance: 1e-4 });
  assert.equal(packed.byteLength, 32);
  const u = new Uint32Array(packed);
  const f = new Float32Array(packed);
  assert.equal(u[0], 128);
  assert.equal(u[1], 512);
  assert.equal(f[2], Math.fround(0.01));
  assert.equal(f[3], Math.fround(0.75));
  for (const name of ['it_reduce_init', 'it_reduce_pap', 'it_reduce_rz_new']) {
    const body = sphImplicitThermalWgsl.split(`fn ${name}(`)[1].split('\n}\n')[0];
    assert.doesNotMatch(body, /return;/, `${name} must reach workgroupBarrier from uniform control flow`);
  }
});
