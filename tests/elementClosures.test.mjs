import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveElementProperties } from '../src/runtime/material/elementClosures.js';

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

test('phase-transition / cohesion properties are flagged null (need atomization), nothing validated', () => {
  const al = deriveElementProperties(13, fast);
  assert.equal(al.meltingPointK, null);
  assert.equal(al.cohesiveEnergyEvPerAtom, null);
  assert.equal(al.closureBacked, true);
  assert.equal(al.validation.eosValidation, false);
  assert.equal(al.validation.scientificValidation, false);
});
