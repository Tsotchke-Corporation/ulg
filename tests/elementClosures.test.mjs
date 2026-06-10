import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveElementProperties, elementMaterialClosure } from '../src/runtime/material/elementClosures.js';

// Fast, coarse-grid derivation for the test (light elements only).
const fast = { gridPointsN: 600, rMaxBohr: 30 };

test('simple metals derive finite bulk/thermal/optical properties of the right order', () => {
  // [Z, symbol, density kg/m^3, Debye K] references.
  const cases = [[3, 'Li', 534, 344], [11, 'Na', 971, 158], [19, 'K', 862, 91], [13, 'Al', 2700, 428]];
  for (const [Z, sym, rhoRef, tdRef] of cases) {
    const p = deriveElementProperties(Z, fast);
    assert.equal(p.symbol, sym);
    assert.ok(p.metallicModelApplicable);
    assert.ok(p.densityKgPerM3 > 0 && Number.isFinite(p.densityKgPerM3));
    assert.ok(p.bulkModulusPa > 0 && Number.isFinite(p.bulkModulusPa));
    assert.ok(p.debyeTemperatureK > 0 && p.soundSpeedMPerS > 0);
    assert.ok(p.cpJPerKgK > 0);
    assert.ok(p.opticalColorSrgb.every((c) => c >= 0 && c <= 1));
    // Order-of-magnitude agreement (this is a simple-metal model, not validated):
    assert.ok(p.densityKgPerM3 > rhoRef / 6 && p.densityKgPerM3 < rhoRef * 6, `${sym} density ${p.densityKgPerM3.toFixed(0)} vs ${rhoRef}`);
    assert.ok(p.debyeTemperatureK > tdRef / 3 && p.debyeTemperatureK < tdRef * 3, `${sym} Debye ${p.debyeTemperatureK.toFixed(0)} vs ${tdRef}`);
  }
});

test('empty-core radius is derived from the atomic DFT and the WS radius is sensible', () => {
  const na = deriveElementProperties(11, fast);
  assert.ok(na.emptyCoreRadiusBohr > 0.5 && na.emptyCoreRadiusBohr < 4);
  assert.ok(na.equilibriumWignerSeitzRadiusBohr > 2 && na.equilibriumWignerSeitzRadiusBohr < 8);
});

test('closed-shell / full-sp atoms are flagged outside the free-electron model, not faked', () => {
  for (const Z of [2, 10, 18]) { // He, Ne, Ar
    const p = deriveElementProperties(Z, fast);
    assert.equal(p.metallicModelApplicable, false);
    assert.ok(p.densityKgPerM3 === undefined);
  }
});

test('melting + shear are derived (Lindemann from Debye, Poisson from bulk), nothing validated', () => {
  const al = deriveElementProperties(13, fast);
  assert.ok(al.meltingPointK > 0 && Number.isFinite(al.meltingPointK)); // Lindemann from derived theta_D
  assert.ok(al.shearModulusPa > 0 && al.shearModulusPa < al.bulkModulusPa); // Poisson shear < bulk
  assert.equal(al.closureBacked, true);
  assert.equal(al.validation.eosValidation, false);
  assert.equal(al.validation.scientificValidation, false);
});

test('elementMaterialClosure derives a solid+liquid closure for any metal; none for noble gases', () => {
  const na = elementMaterialClosure(11, fast); // sodium
  assert.equal(na.symbol, 'Na');
  assert.equal(na.properties.phases.length, 2);
  assert.ok(na.properties.phases[0].shearModulusPa > 0); // solid resists shear
  assert.equal(na.properties.phases[1].shearModulusPa, 0); // liquid flows
  assert.ok(na.properties.transitions[0].latentHeatJPerKg > 0); // Richards' rule fusion
  assert.equal(elementMaterialClosure(18, fast), null); // Argon: not a metal
});
