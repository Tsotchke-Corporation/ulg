import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSphPhaseDemoState,
  createSphPhaseDemo,
  particleThermalState,
  phaseMassSummary
} from '../src/runtime/sphPhaseDemo.js';

test('demo initial state: hot molten-iron block on a cold ice block', () => {
  const demo = buildSphPhaseDemoState();
  assert.ok(demo.counts.drop > 0 && demo.counts.base > 0);
  assert.equal(demo.counts.total, demo.counts.drop + demo.counts.base);
  assert.equal(demo.dropMaterial, 'fe');
  assert.equal(demo.baseMaterial, 'h2o');
  const fe = demo.state.particles.filter((p) => p.material === 'fe');
  const ice = demo.state.particles.filter((p) => p.material === 'h2o');
  assert.ok(fe.every((p) => p.temperatureK === 1850));
  assert.ok(ice.every((p) => p.temperatureK === 233.15));
  // Iron sits above the ice (higher y).
  const minIronY = Math.min(...fe.map((p) => p.x[1]));
  const maxIceY = Math.max(...ice.map((p) => p.x[1]));
  assert.ok(minIronY >= maxIceY - 1e-9);
});

test('particle phase + temperature come from the closure energy', () => {
  const demo = buildSphPhaseDemoState();
  const thermal = particleThermalState(demo);
  const ironStates = thermal.filter((t) => t.material === 'fe');
  const iceStates = thermal.filter((t) => t.material === 'h2o');
  // Iron starts molten (1850 K > 1811 K melting), ice solid.
  assert.ok(ironStates.every((t) => t.phase === 'liquid'));
  assert.ok(iceStates.every((t) => t.phase === 'solid'));
  const summary = phaseMassSummary(demo);
  assert.equal(summary.ironSolidFraction, 0);
  assert.ok(summary.byMaterialPhase.h2o.solid > 0);
});

test('demo driver: preflight feasible, stepping stays bounded and finite', () => {
  const driver = createSphPhaseDemo();
  const pre = driver.preflight();
  assert.equal(pre.feasibility.feasible, true);
  for (let i = 0; i < 5; i += 1) driver.step();
  const totals = driver.totals();
  assert.ok(Number.isFinite(totals.totalEnergyJ));
  assert.ok(Number.isFinite(totals.momentumMagnitudeKgMPerS));
  // Display safeguards keep every particle inside the sealed box.
  for (const p of driver.demo.state.particles) {
    for (let d = 0; d < 3; d += 1) {
      assert.ok(p.x[d] >= 0 && p.x[d] <= driver.demo.box.edgeM);
    }
  }
});
