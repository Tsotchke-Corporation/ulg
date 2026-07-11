import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetById,
  sphPhaseScenarioPresetUrl
} from '../src/runtime/sphPhaseScenarioPresets.js';

test('standard SPH scenario presets encode the four requested scenes', () => {
  assert.deepEqual(
    SPH_PHASE_SCENARIO_PRESETS.map((entry) => entry.id),
    ['water-cycle', 'iron-ice-quench', 'sodium-water', 'cesium-fluorine']
  );

  const water = sphPhaseScenarioPresetById('water-cycle');
  assert.equal(water.controls.drop, 'h2o');
  assert.equal(water.controls.base, 'h2o');
  assert.equal(water.controls.dropt, '300');
  assert.equal(water.controls.baset, '300');
  assert.equal(water.controls.wymin, '400');
  assert.equal(water.controls.wymax, '200');
  assert.deepEqual(
    Object.fromEntries(['lawmech', 'lawg', 'laweos', 'lawp', 'lawt', 'lawr', 'lawv', 'lawst']
      .map((key) => [key, water.controls[key]])),
    {
      lawmech: '1',
      lawg: '1',
      laweos: '1',
      lawp: '1',
      lawt: '1',
      lawr: '1',
      lawv: '1',
      lawst: '0'
    }
  );
  assert.equal(water.controls.blob, '1');

  const quench = sphPhaseScenarioPresetById('iron-ice-quench');
  assert.equal(quench.controls.drop, 'fe');
  assert.equal(quench.controls.base, 'h2o');
  assert.ok(Number(quench.controls.dropt) > 1811);
  assert.ok(Number(quench.controls.baset) < 273.15);

  const sodium = sphPhaseScenarioPresetById('sodium-water');
  assert.deepEqual(sodium.validation.expectedMaterialPresent, ['naoh', 'h2']);
  assert.equal(sodium.validation.initialMaxTemperatureK, 300);
  assert.equal(sodium.validation.minimumReactionTemperatureRiseK, 50);
  assert.equal(sodium.validation.minimumHydrogenRiseM, 0.05);

  const cesium = sphPhaseScenarioPresetById('cesium-fluorine');
  assert.equal(cesium.controls.drop, 'Cs');
  assert.equal(cesium.controls.base, 'F');
  assert.deepEqual(cesium.validation.expectedMaterialPresent, ['csf']);
  assert.equal(cesium.validation.initialMaxTemperatureK, 293.15);
  assert.equal(cesium.validation.minimumReactionTemperatureRiseK, 500);
});

test('SPH preset URLs round-trip the preset id and all control values', () => {
  for (const entry of SPH_PHASE_SCENARIO_PRESETS) {
    const url = sphPhaseScenarioPresetUrl(entry.id, { visualCapture: '1' });
    assert.ok(url);
    const parsed = new URL(url, 'https://ulg.invalid');
    assert.equal(parsed.searchParams.get('scenario'), entry.id);
    assert.equal(parsed.searchParams.get('visualCapture'), '1');
    for (const [key, value] of Object.entries(entry.controls)) {
      assert.equal(parsed.searchParams.get(key), value, `${entry.id}:${key}`);
    }
  }
  assert.equal(sphPhaseScenarioPresetUrl('missing'), null);
});
