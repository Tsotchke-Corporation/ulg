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
  assert.equal(water.validation.batches, 18);
  assert.equal(water.validation.batchSteps, 512);
  assert.equal(water.validation.timeoutMs, 1200000);
  assert.equal(water.validation.minVisualFrameTimeSpanS, 4.5);

  const quench = sphPhaseScenarioPresetById('iron-ice-quench');
  assert.equal(quench.controls.drop, 'fe');
  assert.equal(quench.controls.base, 'h2o');
  assert.ok(Number(quench.controls.dropt) > 1811);
  assert.ok(Number(quench.controls.baset) < 273.15);
  assert.equal(quench.controls.dropn, '6');
  assert.equal(quench.controls.basen, '10');
  assert.equal(quench.controls.boxx, '10');
  assert.equal(quench.controls.boxy, '10');
  assert.equal(quench.controls.boxz, '10');
  assert.equal(quench.controls.ironh, '2');
  assert.equal(quench.controls.lawst, '1');
  assert.deepEqual(quench.runtime, {
    sceneLengthScale: '0.014',
    wallModel: 'adiabatic',
    ss: '1'
  });
  assert.equal(quench.validation.batches, 16);
  assert.equal(quench.validation.timeoutMs, 1200000);
  assert.deepEqual(
    SPH_PHASE_SCENARIO_PRESETS
      .filter((entry) => entry.id !== 'iron-ice-quench')
      .map((entry) => [entry.id, entry.controls.lawst]),
    [
      ['water-cycle', '0'],
      ['sodium-water', '0'],
      ['cesium-fluorine', '0']
    ]
  );

  const sodium = sphPhaseScenarioPresetById('sodium-water');
  assert.equal(sodium.controls.boxx, '3');
  assert.equal(sodium.controls.boxy, '3');
  assert.equal(sodium.controls.boxz, '3');
  assert.deepEqual(sodium.runtime, {
    sdt: '0.001',
    cfl: '0.6',
    cflSafety: '0.4',
    avAlpha: '0',
    residentStepsPerSchedule: '128',
    residentComputeManagerMode: 'direct',
    residentInterfaceRefreshMode: 'pipelined',
    cameraPositionNormalized: '0.78,0.31,1.55',
    cameraTargetNormalized: '0.50,0.31,0.50'
  });
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
    for (const [key, value] of Object.entries(entry.runtime)) {
      assert.equal(parsed.searchParams.get(key), value, `${entry.id}:${key}`);
    }
  }
  assert.equal(sphPhaseScenarioPresetUrl('missing'), null);
});
