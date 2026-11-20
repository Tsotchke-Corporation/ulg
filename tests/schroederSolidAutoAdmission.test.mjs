import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSphPhaseDemoState } from '../src/runtime/sphPhaseDemo.js';
import {
  sphInitialBodiesFromLegacyDropBase,
  sphInitialBodiesFromLegacyPhaseControls
} from '../src/runtime/sphInitialBodies.js';
import { sphPhaseScenarioPresetById } from '../src/runtime/sphPhaseScenarioPresets.js';
import { createSphPhaseScenario } from '../src/runtime/thermoPreflight.js';

function buildPresetDemo(presetId, { coherentRigidSolids = true, overrideBaseMechanicsMode = null, environment = null } = {}) {
  const preset = sphPhaseScenarioPresetById(presetId);
  const controls = preset.controls;
  const sceneLengthScale = Number(preset.runtime.sceneLengthScale ?? 1);
  const wallFaces = Object.fromEntries([
    ['xMin', 'wxmin'],
    ['xMax', 'wxmax'],
    ['yMin', 'wymin'],
    ['yMax', 'wymax'],
    ['zMin', 'wzmin'],
    ['zMax', 'wzmax']
  ].map(([faceId, key]) => [faceId, Number(controls[key])]));
  const scenario = createSphPhaseScenario({
    wallFaces,
    ...(preset.runtime.wallModel ? { wallModel: preset.runtime.wallModel } : {}),
    sceneLengthScale,
    boxDimensionsM: ['boxx', 'boxy', 'boxz'].map((key) => Number(controls[key]))
  });
  let initialBodies = sphInitialBodiesFromLegacyPhaseControls({
    baseMaterial: controls.base,
    dropMaterial: controls.drop,
    baseTemperatureK: Number(controls.baset),
    dropTemperatureK: Number(controls.dropt),
    baseParticlesPerEdge: Number(controls.basen),
    dropParticlesPerEdge: Number(controls.dropn),
    referenceBaseEdgeM: scenario.referenceGeometry.iceEdgeM,
    referenceBaseParticlesPerEdge: 5,
    sceneLengthScale,
    referenceBoxDimensionsM: scenario.referenceGeometry.boxDimensionsM,
    referenceBaseBottomM: Number(controls.iceh),
    referenceDropBottomM: Number(controls.ironh)
  });
  if (overrideBaseMechanicsMode) {
    initialBodies = {
      ...initialBodies,
      bodies: initialBodies.bodies.map((b) => (b.id === 'base' ? { ...b, mechanicsMode: overrideBaseMechanicsMode } : b))
    };
  }
  return buildSphPhaseDemoState({
    scenario,
    initialBodies,
    environment,
    mechanics: 'mlsmpm',
    coherentRigidSolids,
    allowReducedProductProperties: true
  });
}

test('coherentRigidSolids admits cold inert ice on iron-ice-quench and keeps molten iron fluid', () => {
  const demo = buildPresetDemo('iron-ice-quench', { coherentRigidSolids: true });
  assert.ok(demo.state.rigidBodies, 'iron-ice-quench admits coherent rigid ice by default');
  assert.equal(demo.state.rigidBodies.bodies.length, 1);
  assert.equal(demo.state.rigidBodies.bodies[0].sourceBodyId, 'base');
  assert.equal(demo.state.rigidBodies.bodies[0].material, 'h2o');
  assert.equal(demo.state.rigidBodies.bodies[0].seed.members.length, 1000);
  assert.ok(demo.state.rigidBodies.bodies[0].thermal, 'ice body carries full melt-release thermal closure');
  assert.equal(demo.state.rigidBodies.fluidThermal.length > 0, true);

  const releaseSlots = demo.state.particles.filter((p) => p.solidReleaseSlot === true && p.phaseCompanionSlot !== true);
  assert.equal(releaseSlots.length, 1000, '1000 primary dormant liquid release slots reserved for ice melt');
  const spareSlots = demo.state.particles.filter((p) => p.spareProductSlot === true);
  assert.ok(spareSlots.every((p) => p.solidReleaseSlot !== true), 'spare product slots never inherit solidReleaseSlot');
  const moltenIron = demo.state.particles.filter((p) => p.material === 'fe' && p.massKg > 0);
  assert.equal(moltenIron.length, 216, 'molten iron drop remains in the fluid continuum');
});

test('coherentRigidSolids keeps reactive solids (sodium-water and cesium-fluorine) in continuum', () => {
  const sodium = buildPresetDemo('sodium-water', { coherentRigidSolids: true });
  assert.equal(sodium.state.rigidBodies ?? null, null, 'reactive Na solid stays in continuum so Na+H2O chemistry executes');

  const cesiumBodies = sphInitialBodiesFromLegacyDropBase({
    baseMaterial: 'F',
    dropMaterial: 'Cs',
    baseSizeM: [1, 1, 1],
    dropSizeM: [0.6, 0.6, 0.6],
    baseCenterM: [2, 0.5, 2],
    dropCenterM: [2, 1.31, 2],
    baseTemperatureK: 293.15,
    dropTemperatureK: 293.15,
    baseParticlesPerEdge: [5, 5, 5],
    dropParticlesPerEdge: [5, 5, 5]
  });
  const cesium = buildSphPhaseDemoState({
    scenario: createSphPhaseScenario({ boxDimensionsM: [5, 5, 5] }),
    initialBodies: cesiumBodies,
    mechanics: 'mlsmpm',
    coherentRigidSolids: true,
    allowReducedProductProperties: true
  });
  assert.equal(cesium.state.rigidBodies ?? null, null, 'reactive Cs solid stays in continuum so Cs+F2 chemistry executes');
});

test('explicit mechanicsMode=continuum and coherentRigidSolids=false opt out cleanly', () => {
  const explicitContinuum = buildPresetDemo('iron-ice-quench', {
    coherentRigidSolids: true,
    overrideBaseMechanicsMode: 'continuum'
  });
  assert.equal(explicitContinuum.state.rigidBodies ?? null, null);

  const disabled = buildPresetDemo('iron-ice-quench', { coherentRigidSolids: false });
  assert.equal(disabled.state.rigidBodies ?? null, null);
});

test('COMMON_RUNTIME enables rigidSolids by default across all presets', () => {
  const preset = sphPhaseScenarioPresetById('iron-ice-quench');
  assert.equal(preset.runtime.rigidSolids, '1');
});
