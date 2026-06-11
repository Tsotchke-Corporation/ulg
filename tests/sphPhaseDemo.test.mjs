import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSphPhaseDemoState,
  createSphPhaseDemo,
  particleRenderDescriptors,
  particleThermalState,
  phaseMassSummary
} from '../src/runtime/sphPhaseDemo.js';
import { materialDerivationSummary } from '../src/runtime/material/propertyProvenance.js';

test('demo default builds with fully derived material closures', () => {
  const demo = buildSphPhaseDemoState();
  assert.ok(demo.counts.total > 0);
  for (const key of ['fe', 'h2o', 'air']) {
    const summary = materialDerivationSummary(demo.materialProperties[key]);
    assert.equal(summary.fullyLowerLevelDerived, true);
    assert.equal(summary.hasReferenceFallbacks, false);
    assert.equal(summary.hasReducedEstimates, false);
  }
});

test('demo initial state: hot molten-iron block on a cold ice block', () => {
  const demo = buildSphPhaseDemoState();
  assert.ok(demo.counts.drop > 0 && demo.counts.base > 0);
  assert.equal(demo.counts.total, demo.counts.drop + demo.counts.base);
  assert.equal(demo.dropMaterial, 'fe');
  assert.equal(demo.baseMaterial, 'h2o');
  const fe = demo.state.particles.filter((p) => p.material === 'fe');
  const ice = demo.state.particles.filter((p) => p.material === 'h2o');
  const feLiquidus = demo.materialProperties.fe.transitions[0].temperatureK;
  assert.ok(fe.every((p) => p.temperatureK > feLiquidus));
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
  // Iron starts molten from its derived liquidus, ice starts solid from its derived H2O closure.
  assert.ok(ironStates.every((t) => t.phase === 'liquid'));
  assert.ok(iceStates.every((t) => t.phase === 'solid'));
  const summary = phaseMassSummary(demo);
  assert.equal(summary.ironSolidFraction, 0);
  assert.ok(summary.byMaterialPhase.h2o.solid > 0);
});

test('particle render descriptors preserve simulation material and closure phase', () => {
  const demo = buildSphPhaseDemoState();
  const descriptors = particleRenderDescriptors(demo);
  const ice = descriptors.find((d) => d.material === 'h2o');
  const iron = descriptors.find((d) => d.material === 'fe');
  assert.equal(ice.phase, 'solid');
  assert.equal(ice.renderKey, 'ice');
  assert.equal(iron.phase, 'liquid');
  assert.equal(iron.renderKey, 'fe');
});

test('demo driver: preflight feasible, stepping stays bounded and finite', () => {
  const driver = createSphPhaseDemo();
  const pre = driver.preflight();
  assert.equal(pre.feasibility.feasible, true);
  assert.equal(pre.closureBacked, true);
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
