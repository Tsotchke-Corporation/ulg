import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSphPhaseDemo,
  particleThermalState,
  surfaceEmissive
} from '../src/runtime/sphPhaseDemo.js';
import {
  normalizeSphInitialBodies,
  parseSphInitialBodies,
  serializeSphInitialBodies
} from '../src/runtime/sphInitialBodies.js';
import {
  createSphNuclearCherenkovController,
  supportedIsotopesForMaterial
} from '../src/runtime/sph/sphNuclearCherenkovBridge.js';
import {
  STUDIO_CUSTOM_TEMPLATES,
  buildLaunchParamsFromStagedConfig,
  buildStagedConfigFromCustomTemplate,
  validateStagedSimulationConfig
} from '../src/visualization/ulgSimStudioModel.js';
import { createSphPhaseScenario } from '../src/runtime/thermoPreflight.js';

test('SPH Studio custom templates for Liquid Mercury and Co-60 Cherenkov Pool validate cleanly and preserve isotope metadata', () => {
  assert.deepEqual(STUDIO_CUSTOM_TEMPLATES.map((t) => t.id), ['mercury-water-drop', 'cherenkov-pool']);

  const hgCfg = buildStagedConfigFromCustomTemplate('mercury-water-drop');
  const hgVal = validateStagedSimulationConfig(hgCfg);
  assert.equal(hgVal.valid, true, `Hg template invalid: ${hgVal.errors.join('; ')}`);
  assert.equal(hgVal.overlaps.length, 0);
  const hgLaunch = buildLaunchParamsFromStagedConfig(hgCfg);
  assert.ok(hgLaunch.bodies.includes('"Hg"'));

  const chCfg = buildStagedConfigFromCustomTemplate('cherenkov-pool');
  const chVal = validateStagedSimulationConfig(chCfg);
  assert.equal(chVal.valid, true, `Cherenkov template invalid: ${chVal.errors.join('; ')}`);
  assert.equal(chVal.overlaps.length, 0);
  const serialized = serializeSphInitialBodies(chCfg.bodies);
  const reparsed = parseSphInitialBodies(serialized);
  assert.equal(reparsed.bodies[1].isotope, 'Co-60');

  assert.throws(() => normalizeSphInitialBodies([
    { ...chCfg.bodies[1], isotope: 'Bogus-999' }
  ]), /invalid-isotope|must be one of/);
  assert.deepEqual([...supportedIsotopesForMaterial('Co')], ['Co-60']);
  assert.deepEqual([...supportedIsotopesForMaterial('U')], ['U-238']);
  assert.deepEqual([...supportedIsotopesForMaterial('Fe')], []);
});

test('SPH Studio createSphPhaseDemo resolves relativistic liquid Mercury (Hg) at 293 K with zero hacks', () => {
  const hgCfg = buildStagedConfigFromCustomTemplate('mercury-water-drop');
  const scenario = createSphPhaseScenario({ boxDimensionsM: hgCfg.boxDimensionsM });
  const driver = createSphPhaseDemo({
    scenario,
    mechanics: 'sph',
    initialBodies: hgCfg.bodies.map((b) => ({
      ...b,
      centerM: [b.centerM[0] + 1, b.centerM[1], b.centerM[2] + 1],
      particlesPerEdge: [2, 2, 2]
    })),
    physicalLawGroups: { reactions: false }
  });

  const states = particleThermalState(driver.demo);
  const hgStates = states.filter((s) => s.material === 'Hg');
  assert.ok(hgStates.length === 8);
  assert.ok(hgStates.every((s) => s.phase === 'liquid'), `Hg at 293.15 K must be liquid, got ${hgStates.map((s) => s.phase)}`);
  assert.equal(driver.nuclearCherenkovSummary().enabled, false);
});

test('Phase 8 live SPH bridge: Co-60 in water heats via nucleon-conserving decay and emits Frank-Tamm Cherenkov blue; vacuum & H-3 fail closed', () => {
  const chCfg = buildStagedConfigFromCustomTemplate('cherenkov-pool');
  const scenario = createSphPhaseScenario({ boxDimensionsM: chCfg.boxDimensionsM });
  const driver = createSphPhaseDemo({
    scenario,
    mechanics: 'sph',
    initialBodies: chCfg.bodies.map((b) => ({
      ...b,
      centerM: [b.centerM[0] + 1, b.centerM[1], b.centerM[2] + 1],
      particlesPerEdge: [2, 2, 2]
    })),
    physicalLawGroups: { reactions: false }
  });

  const before = driver.nuclearCherenkovSummary();
  assert.equal(before.enabled, true);
  assert.equal(before.medium, 'h2o-liquid');
  assert.equal(before.cherenkovActive, true);
  assert.ok(before.cherenkovBeta > before.cherenkovThresholdBeta);
  assert.ok(before.cherenkovAngleDeg > 30 && before.cherenkovAngleDeg < 45);
  assert.ok(before.cherenkovSrgb[2] > before.cherenkovSrgb[0], 'Cherenkov emission must be blue-dominant');
  assert.equal(before.validation.scientificValidation, false);

  const coEnergyBefore = driver.demo.state.particles
    .filter((p) => p.material === 'Co')
    .reduce((s, p) => s + p.specificInternalEnergyJPerKg, 0);

  driver.step();
  const after = driver.nuclearCherenkovSummary();
  assert.ok(after.totalDecays > 0);
  assert.ok(after.totalDepositedThermalEnergyJ > 0);
  assert.ok(after.nucleonConservationRelError < 1e-12);

  const coEnergyAfter = driver.demo.state.particles
    .filter((p) => p.material === 'Co')
    .reduce((s, p) => s + p.specificInternalEnergyJPerKg, 0);
  assert.ok(coEnergyAfter > coEnergyBefore, 'Decay thermal deposition must increase Co-60 particle internal energy');

  const emissive = surfaceEmissive(driver.demo);
  assert.ok(Array.isArray(emissive.Co) && emissive.Co[2] > emissive.Co[0], 'Cherenkov surface emissive must carry CIE blue');

  // Fail-closed controls: Co-60 in vacuum (n = 1.0) and low-energy H-3 in water (beta < 1/n)
  const vacuumCtrl = createSphNuclearCherenkovController({
    bodies: [chCfg.bodies[1]],
    environmentMode: 'vacuum'
  });
  assert.equal(vacuumCtrl.getSnapshot().cherenkovActive, false);
  assert.deepEqual([...vacuumCtrl.getSnapshot().cherenkovSrgb], [0, 0, 0]);

  const tritiumCtrl = createSphNuclearCherenkovController({
    bodies: [
      chCfg.bodies[0],
      { ...chCfg.bodies[1], material: 'H', isotope: 'H-3' }
    ],
    environmentMode: 'vacuum'
  });
  assert.equal(tritiumCtrl.getSnapshot().cherenkovActive, false);
  assert.deepEqual([...tritiumCtrl.getSnapshot().cherenkovSrgb], [0, 0, 0]);
});
