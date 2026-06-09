import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSphState } from '../src/runtime/sph/sphState.js';
import { computeAccelerationsAndEnergyRates, cubicSplineKernel } from '../src/runtime/sph/sphOperators.js';
import { runSphPhaseCarrier, summarizePhases } from '../src/runtime/sph/sphPhaseCarrier.js';
import { sphTotals } from '../src/runtime/sph/sphConservation.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import { createSphPhaseSimulationArtifact } from '../ulg-gpu-abi/src/index.js';

const CV_AIR = 718;

function gasBlob({ dimension = 3, h = 0.1, spacing = 0.06, n = 3, temperatureK = 300, perturb = 0 } = {}) {
  const particles = [];
  const range = [...Array(n).keys()];
  const center = (n - 1) / 2;
  for (const i of range) {
    for (const j of range) {
      for (const k of (dimension === 3 ? range : [0])) {
        const x = dimension === 3 ? [i * spacing, j * spacing, k * spacing] : [i * spacing, j * spacing];
        // A gentle divergent velocity perturbation about the blob centre (net momentum ~0 by symmetry).
        const v = x.map((xd, d) => perturb * (xd - center * spacing));
        particles.push({ id: `g${i}-${j}-${k}`, material: 'air', x, v, massKg: 1e-3, specificInternalEnergyJPerKg: CV_AIR * temperatureK });
      }
    }
  }
  return createSphState({ particles, smoothingLengthM: h, dimension });
}

test('cubic-spline kernel is positive at the centre and vanishes beyond 2h', () => {
  assert.ok(cubicSplineKernel(0, 0.1, 3) > 0);
  assert.equal(cubicSplineKernel(0.2, 0.1, 3), 0);
  assert.equal(cubicSplineKernel(0.25, 0.1, 3), 0);
});

test('symmetric pressure forces conserve momentum exactly (sum of m*a is ~0)', () => {
  const state = gasBlob({ perturb: 0.0 });
  const { accelerations } = computeAccelerationsAndEnergyRates(state.particles, {
    dimension: 3, h: state.smoothingLengthM, gamma: 1.4, gravity: null, alpha: 0, beta: 0
  });
  const net = [0, 0, 0];
  let magnitudeSum = 0;
  state.particles.forEach((p, i) => {
    for (let d = 0; d < 3; d += 1) {
      net[d] += p.massKg * accelerations[i][d];
      magnitudeSum += Math.abs(p.massKg * accelerations[i][d]);
    }
  });
  const netMagnitude = Math.sqrt(net.reduce((s, v) => s + v * v, 0));
  // Net momentum change is zero to floating-point round-off relative to the force scale.
  assert.ok(netMagnitude / (magnitudeSum + 1e-30) < 1e-10, `net/scale=${netMagnitude / (magnitudeSum + 1e-30)}`);
});

test('inviscid carrier run conserves total energy and momentum', () => {
  const initial = gasBlob({ perturb: 2.0 });
  const before = sphTotals(initial);
  const result = runSphPhaseCarrier(initial, { dimension: 3, gamma: 1.4, alpha: 0, beta: 0, dt: 1e-5, steps: 40 });
  const after = result.finalTotals;
  const energyDrift = Math.abs(after.totalEnergyJ - before.totalEnergyJ) / Math.abs(before.totalEnergyJ);
  assert.ok(energyDrift < 1e-2, `relative energy drift ${energyDrift}`);
  assert.ok(after.momentumMagnitudeKgMPerS < 1e-9, `momentum magnitude ${after.momentumMagnitudeKgMPerS}`);
  assert.ok(Math.abs(after.massKg - before.massKg) < 1e-12);
  assert.equal(result.conservationReport.schema, 'peercompute.ulg.conservation-report.v0');
});

test('particle phase emerges from specific internal energy via the closure', () => {
  const { h2o } = createReferenceMaterialClosures();
  const iceU = specificInternalEnergyJPerKg(h2o.properties, 250);
  const waterU = specificInternalEnergyJPerKg(h2o.properties, 320);
  const state = createSphState({
    smoothingLengthM: 0.1,
    dimension: 3,
    particles: [
      { id: 'ice0', material: 'h2o', x: [0, 0, 0], massKg: 1, specificInternalEnergyJPerKg: iceU },
      { id: 'ice1', material: 'h2o', x: [0.05, 0, 0], massKg: 1, specificInternalEnergyJPerKg: iceU },
      { id: 'water0', material: 'h2o', x: [0.1, 0, 0], massKg: 1, specificInternalEnergyJPerKg: waterU }
    ]
  });
  const summary = summarizePhases(state, { h2o: h2o.properties });
  assert.equal(summary.h2o.solid.count, 2);
  assert.equal(summary.h2o.liquid.count, 1);
  assert.equal(summary.h2o.solid.massKg, 2);
});

test('SPH phase simulation artifact stays evidence-only', () => {
  const initial = gasBlob({ perturb: 1.0 });
  const result = runSphPhaseCarrier(initial, { dimension: 3, dt: 1e-5, steps: 5 });
  const artifact = createSphPhaseSimulationArtifact({
    artifactId: 'ulg:sph-phase.simulation',
    scenarioId: 'sph-phase-ice-on-molten-iron',
    dt: result.dt,
    steps: result.steps,
    particleCount: initial.particles.length,
    initialTotals: result.initialTotals,
    finalTotals: result.finalTotals,
    conservationReport: result.conservationReport,
    phaseSummary: result.phaseSummary
  });
  assert.equal(artifact.schema, 'peercompute.ulg.sph-phase-simulation-artifact.v0');
  for (const flag of ['sphValidation', 'phaseChangeValidation', 'materialValidation', 'scientificValidation', 'fullPhysicsValidation']) {
    assert.equal(artifact[flag], false);
  }
  assert.ok(artifact.validation.blockers.includes('sph-phase-carrier-reference-not-validated-physics'));
});
