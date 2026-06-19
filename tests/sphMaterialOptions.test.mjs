import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ELEMENT_MATERIAL_OPTIONS,
  ELEMENT_UI_METADATA,
  MATERIAL_OPTIONS
} from '../src/visualization/sphMaterialOptions.js';

test('SPH material options expose element names in dropdown labels', () => {
  const labels = MATERIAL_OPTIONS.map((option) => option.label);
  assert.ok(labels.includes('Iron (Fe, Z=26) - derived element'));
  assert.ok(labels.includes('Gold (Au, Z=79) - derived element'));
  assert.ok(labels.includes('Palladium (Pd, Z=46) - derived element'));
  assert.ok(labels.includes('Sodium (Na, Z=11) - derived element'));
  assert.ok(labels.includes('Water (H2O) - derived compound'));
});

test('SPH material options preserve runtime material keys while showing human names', () => {
  const fe = MATERIAL_OPTIONS.find((option) => option.symbol === 'Fe');
  const au = MATERIAL_OPTIONS.find((option) => option.symbol === 'Au');
  assert.equal(fe.key, 'fe');
  assert.equal(fe.name, 'Iron');
  assert.equal(au.key, 'Au');
  assert.equal(au.name, 'Gold');
});

test('MoonLab-style element picker metadata carries periodic-table layout', () => {
  const au = ELEMENT_MATERIAL_OPTIONS.find((option) => option.symbol === 'Au');
  const u = ELEMENT_MATERIAL_OPTIONS.find((option) => option.symbol === 'U');
  assert.deepEqual(
    { Z: au.Z, period: au.period, group: au.group, category: au.category },
    { Z: 79, period: 6, group: 11, category: 'transition' }
  );
  assert.deepEqual(
    { Z: u.Z, period: u.period, group: u.group, category: u.category },
    { Z: 92, period: 9, group: 7, category: 'actinide' }
  );
});

test('SPH element picker excludes unavailable noble-gas material closures', () => {
  assert.equal(ELEMENT_UI_METADATA.length, 118);
  assert.equal(ELEMENT_MATERIAL_OPTIONS.some((option) => option.symbol === 'He'), false);
  assert.equal(ELEMENT_MATERIAL_OPTIONS.some((option) => option.symbol === 'Og'), false);
  assert.equal(ELEMENT_MATERIAL_OPTIONS.some((option) => option.symbol === 'Pd'), true);
  assert.equal(ELEMENT_MATERIAL_OPTIONS.some((option) => option.symbol === 'Na'), true);
});
