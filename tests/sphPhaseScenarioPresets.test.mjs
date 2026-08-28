import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetById,
  sphPhaseScenarioPresetUrl
} from '../src/runtime/sphPhaseScenarioPresets.js';
import {
  SPH_INITIAL_BODIES_SCHEMA,
  parseSphInitialBodies
} from '../src/runtime/sphInitialBodies.js';

const SHARED_WORKER_OWNED_SS_RUNTIME = Object.freeze({
  renderer: 'native-webgpu',
  surfaceDraw: 'native-webgpu-surface-consumer',
  surfaceOverlay: '0',
  renderOwnership: 'worker-owned-resident-render-producer',
  workerOffscreenPresentation: '1',
  workerParticleOverlay: '0',
  residentWorkers: '1',
  residentComputeManagerMode: 'worker-owned-resident-lane',
  contactSolver: '1',
  ss: '1',
  schroederLevel: '0',
  schroederMinLevel: '0',
  schroederPortableSummary: '1',
  schroederActiveNodeIndex: '1',
  schroederActiveNodeSortedIndex: '1',
  schroederLawQueue: '1',
  schroederLawNeighborCandidates: '1',
  schroederPhaseVolumeMigration: '1'
});

function selectKeys(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}

// The four standard scenes share the worker-owned single-source SS runtime
// and the framework-liveness acceptance track. The two adaptive-laws
// performance presets deliberately deviate and are asserted explicitly
// below: bulk-water keeps ss=1 but turns law structures off (Tier-0
// substrate), water-realtime runs the pre-Schroeder fused path (ss=0)
// because the canonical lane still freezes bulk liquid rigid (the Phase-A
// gap recorded in plan/todo/scale-adaptive-law-activation-plan.md).
const STANDARD_MATRIX_PRESETS = SPH_PHASE_SCENARIO_PRESETS.filter(
  (entry) => entry.standardMatrixEnabled !== false
);

test('standard presets share one worker-owned single-source SS runtime', () => {
  const sharedKeys = Object.keys(SHARED_WORKER_OWNED_SS_RUNTIME);
  for (const entry of SPH_PHASE_SCENARIO_PRESETS) {
    assert.equal(Object.isFrozen(entry.runtime), true, entry.id);
  }
  for (const entry of STANDARD_MATRIX_PRESETS) {
    assert.deepEqual(
      selectKeys(entry.runtime, sharedKeys),
      SHARED_WORKER_OWNED_SS_RUNTIME,
      entry.id
    );
    const expectedHierarchy = entry.id === 'cesium-fluorine'
      ? {
          schroederMaxLevel: '1',
          schroederCrossLevelCoupling: '0',
          schroederTwoLevel: '1',
          schroederMechanicsFieldPairV2: '1'
        }
      : {
          schroederMaxLevel: '0',
          schroederCrossLevelCoupling: '0',
          schroederTwoLevel: '0',
          schroederMechanicsFieldPairV2: '0'
        };
    assert.deepEqual(
      selectKeys(entry.runtime, Object.keys(expectedHierarchy)),
      expectedHierarchy,
      `${entry.id}:hierarchy`
    );
  }
  assert.deepEqual(
    Object.fromEntries(SPH_PHASE_SCENARIO_PRESETS.map((entry) => [
      entry.id,
      entry.runtime.residentStepsPerSchedule
    ])),
    {
      'water-cycle': '16',
      'iron-ice-quench': '16',
      'sodium-water': '64',
      'cesium-fluorine': '16',
      'bulk-water': '64',
      'water-realtime': '64'
    }
  );
  for (const entry of STANDARD_MATRIX_PRESETS) {
    assert.equal(
      entry.frameworkValidation?.acceptanceTrack,
      'framework-liveness',
      entry.id
    );
    assert.equal(entry.frameworkValidation?.batches, 2, entry.id);
    assert.equal(entry.frameworkValidation?.batchSteps, 128, entry.id);
    assert.equal(
      entry.frameworkValidation?.minVisualFrameTimeSpanS,
      0.128,
      entry.id
    );
    assert.equal(entry.frameworkValidation?.checkpoints.length, 3, entry.id);
    assert.equal(
      entry.frameworkValidation?.checkpoints.at(-1)?.id,
      'bounded-terminal',
      entry.id
    );
  }
});

test('adaptive-laws presets declare their runtime deviations explicitly', () => {
  const bulk = sphPhaseScenarioPresetById('bulk-water');
  assert.equal(bulk.standardMatrixEnabled, false);
  assert.deepEqual(selectKeys(bulk.runtime, [
    'ss',
    'ambientPressurePa',
    'contactSolver',
    'schroederLawQueue',
    'schroederLawNeighborCandidates',
    'schroederPhaseVolumeMigration',
    'schroederActiveNodeSortedIndex',
    'submitBurstSteps'
  ]), {
    ss: '1',
    ambientPressurePa: '0',
    contactSolver: '1',
    schroederLawQueue: '0',
    schroederLawNeighborCandidates: '0',
    schroederPhaseVolumeMigration: '0',
    schroederActiveNodeSortedIndex: '0',
    submitBurstSteps: '8'
  });
  const realtime = sphPhaseScenarioPresetById('water-realtime');
  assert.equal(realtime.standardMatrixEnabled, false);
  assert.equal(realtime.runtime.ss, '0');
  assert.equal(realtime.runtime.ambientPressurePa, '0');
  assert.equal(realtime.controls.dropn, '16');
  assert.equal(realtime.controls.basen, '32');
  // Drop cube top (ironh + 0.2 * dropn) must stay inside the box and its
  // bottom above the base cube top so geometry preflight admits the scene.
  const dropBottom = Number(realtime.controls.ironh);
  const dropTop = dropBottom + 0.2 * Number(realtime.controls.dropn);
  const baseTop = 0.2 * Number(realtime.controls.basen);
  assert.ok(dropBottom > baseTop);
  assert.ok(dropTop < Number(realtime.controls.boxy));
});

test('standard SPH scenario presets encode the four requested scenes', () => {
  assert.deepEqual(
    SPH_PHASE_SCENARIO_PRESETS.map((entry) => entry.id),
    [
      'water-cycle',
      'iron-ice-quench',
      'sodium-water',
      'cesium-fluorine',
      'bulk-water',
      'water-realtime'
    ]
  );
  assert.deepEqual(
    STANDARD_MATRIX_PRESETS.map((entry) => entry.id),
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
  assert.deepEqual(selectKeys(quench.runtime, [
    'sceneLengthScale',
    'wallModel'
  ]), {
    sceneLengthScale: '0.014',
    wallModel: 'adiabatic'
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
      ['cesium-fluorine', '0'],
      ['bulk-water', '0'],
      ['water-realtime', '0']
    ]
  );

  const sodium = sphPhaseScenarioPresetById('sodium-water');
  assert.equal(sodium.controls.boxx, '3');
  assert.equal(sodium.controls.boxy, '3');
  assert.equal(sodium.controls.boxz, '3');
  assert.deepEqual(selectKeys(sodium.runtime, [
    'sdt',
    'cfl',
    'cflSafety',
    'avAlpha',
    'reactionProductReserveMinimumLiveFraction',
    'residentStepsPerSchedule',
    'residentInterfaceRefreshMode',
    'cameraPositionNormalized',
    'cameraTargetNormalized'
  ]), {
    sdt: '0.001',
    cfl: '0.6',
    cflSafety: '0.4',
    avAlpha: '0',
    reactionProductReserveMinimumLiveFraction: '1',
    residentStepsPerSchedule: '64',
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
  assert.deepEqual(selectKeys(cesium.runtime, [
    'cfl',
    'cflSafety',
    'schroederMaxLevel',
    'schroederTwoLevel',
    'schroederTwoLevelAuthority',
    'schroederTwoLevelSubsteps',
    'schroederCrossLevelCoupling',
    'schroederMechanicsFieldPairV2'
  ]), {
    cfl: '0.8',
    cflSafety: '0.2',
    schroederMaxLevel: '1',
    schroederTwoLevel: '1',
    schroederTwoLevelAuthority: 'authoritative',
    schroederTwoLevelSubsteps: '2',
    schroederCrossLevelCoupling: '0',
    schroederMechanicsFieldPairV2: '1'
  });
  const cesiumBodies = parseSphInitialBodies(cesium.runtime.bodies);
  assert.equal(cesiumBodies.schema, SPH_INITIAL_BODIES_SCHEMA);
  assert.deepEqual(cesiumBodies.bodies, [
    {
      id: 'base',
      domainId: 1,
      material: 'F',
      sizeM: [1, 1, 1],
      centerM: [2, 0.5, 2],
      temperatureK: 293.15,
      particlesPerEdge: [5, 5, 5],
      velocityMPerS: [0, 0, 0],
      legacyRole: 'base'
    },
    {
      id: 'drop',
      domainId: 2,
      material: 'Cs',
      sizeM: [0.6, 0.6, 0.6],
      centerM: [2, 1.31, 2],
      temperatureK: 293.15,
      particlesPerEdge: [5, 5, 5],
      velocityMPerS: [0, 0, 0],
      legacyRole: 'drop'
    }
  ]);
  assert.deepEqual(
    cesiumBodies.bodies[0].sizeM.map((size, axis) => (
      size / cesiumBodies.bodies[0].particlesPerEdge[axis]
    )),
    [0.2, 0.2, 0.2]
  );
  assert.deepEqual(
    cesiumBodies.bodies[1].sizeM.map((size, axis) => (
      size / cesiumBodies.bodies[1].particlesPerEdge[axis]
    )),
    [0.12, 0.12, 0.12]
  );
  const cesiumFinePitchM = 0.6 / 5;
  const cesiumFineSupportRadiusM = Math.cbrt(
    (3 * cesiumFinePitchM ** 3) / (4 * Math.PI)
  );
  assert.equal(
    Number(cesium.runtime.schroederBaseGridSpacingM),
    cesiumFineSupportRadiusM / 1.5
  );
  assert.deepEqual(cesium.validation.expectedMaterialPresent, ['csf']);
  assert.equal(cesium.validation.initialMaxTemperatureK, 293.15);
  assert.equal(cesium.validation.minimumReactionTemperatureRiseK, 500);
  assert.equal(cesium.validation.batches, 10);
  assert.equal(cesium.validation.batchSteps, 256);
  assert.equal(cesium.frameworkValidation.acceptanceTrack, 'framework-liveness');
  assert.equal(cesium.frameworkValidation.batches, 2);
  assert.equal(cesium.frameworkValidation.batchSteps, 128);
  assert.deepEqual(
    cesium.frameworkValidation.checkpoints.map(({ id }) => id),
    ['initial', 'reaction-active', 'bounded-terminal']
  );
  assert.deepEqual(
    cesium.frameworkValidation.expectedMaterialPresent,
    cesium.validation.expectedMaterialPresent
  );
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
