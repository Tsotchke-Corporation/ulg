import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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

const ROOT = path.resolve(import.meta.dirname, '..');

test('Star Spec anti-hack static gate: zero screen-space Cherenkov overlay, zero h2o hardcoding in nuclear bridge/GPU, zero fake blue solid Co metal', () => {
  const studioSrc = fs.readFileSync(path.join(ROOT, 'src/visualization/ulgSimStudioApp.js'), 'utf8');
  assert.ok(!studioSrc.includes('ulg-cherenkov-aura'), 'Screen-space #ulg-cherenkov-aura overlay must be deleted');
  assert.ok(!studioSrc.includes('radial-gradient(ellipse'), 'Screen-space radial-gradient Cherenkov fake must be deleted');
  assert.ok(!studioSrc.includes('activeNuclearController'), 'Detached main-thread UI nuclear controller loop must be deleted');

  const bridgeSrc = fs.readFileSync(path.join(ROOT, 'src/runtime/sph/sphNuclearCherenkovBridge.js'), 'utf8');
  assert.ok(!/['"]h2o['"]/.test(bridgeSrc), 'sphNuclearCherenkovBridge.js must not hardcode h2o');
  assert.ok(!/273\.15|373\.15/.test(bridgeSrc), 'sphNuclearCherenkovBridge.js must not hardcode water phase temperatures');
  assert.ok(!/NATURAL_RADIOISOTOPE_BY_MATERIAL|SUPPORTED_ISOTOPES_BY_ELEMENT/.test(bridgeSrc),
    'Isotope availability must derive from NUCLEAR_DECAY_CHANNELS, not hardcoded bridge tables');

  const gpuSrc = fs.readFileSync(path.join(ROOT, 'src/runtime/sph/sphNuclearCherenkovGpu.js'), 'utf8');
  assert.ok(!/['"]h2o['"]/.test(gpuSrc), 'sphNuclearCherenkovGpu.js must not hardcode material names');
});

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

test('Phase 8 general dielectric closure: arbitrary non-water dielectrics (ethanol, fused silica, ice, water) derive exact Frank-Tamm threshold; opaque Co metal never glows blue', () => {
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

  // Star Spec: opaque solid Cobalt metal must NOT be painted Cherenkov blue in surfaceEmissive!
  const emissive = surfaceEmissive(driver.demo);
  assert.equal(emissive.Co, undefined, 'Solid Co metal must not have fake blue surfaceEmissive; Cherenkov belongs in surrounding transparent dielectric');

  // Arbitrary non-water dielectric 1: liquid ethanol (explicit IOR = 1.361)
  const ethanolCtrl = createSphNuclearCherenkovController({
    bodies: [
      { id: 'eth', material: 'ethanol', temperatureK: 295, shape: 'block', sizeM: [1, 0.8, 1], centerM: [0, 0.4, 0] },
      { ...chCfg.bodies[1], centerM: [0.35, 0.3, -0.2] }
    ],
    materialProperties: {
      ethanol: {
        formula: 'C2H5OH',
        molarMassKgPerMol: 0.04607,
        meltingPointK: 159,
        boilingPointK: 351.4,
        electronicGapEv: 7.4,
        ior: 1.361,
        phases: [{ name: 'liquid', densityKgPerM3: 789 }]
      }
    },
    environmentMode: 'vacuum'
  });
  const ethSnap = ethanolCtrl.getSnapshot();
  assert.equal(ethSnap.cherenkovActive, true);
  assert.ok(Math.abs(ethSnap.refractiveIndex - 1.361) < 1e-3, `Expected ethanol n=1.361, got ${ethSnap.refractiveIndex}`);
  const expectedEthAngle = Math.acos(1 / (ethSnap.cherenkovBeta * 1.361)) * (180 / Math.PI);
  assert.ok(Math.abs(ethSnap.cherenkovAngleDeg - expectedEthAngle) < 0.25);

  // Arbitrary non-water dielectric 2: fused silica glass derived purely from electronicGapEv = 9.0 eV via Herve-Vandamme
  const silicaCtrl = createSphNuclearCherenkovController({
    bodies: [
      { id: 'glass', material: 'sio2', temperatureK: 300, shape: 'block', sizeM: [1, 0.8, 1], centerM: [0, 0.4, 0] },
      { ...chCfg.bodies[1] }
    ],
    materialProperties: {
      sio2: {
        formula: 'SiO2',
        molarMassKgPerMol: 0.06008,
        meltingPointK: 1986,
        boilingPointK: 3220,
        electronicGapEv: 9.0,
        phases: [{ name: 'solid', densityKgPerM3: 2200 }]
      }
    },
    environmentMode: 'vacuum'
  });
  const silSnap = silicaCtrl.getSnapshot();
  assert.equal(silSnap.cherenkovActive, true);
  assert.ok(silSnap.refractiveIndex > 1.4 && silSnap.refractiveIndex < 1.6,
    `Expected Herve-Vandamme SiO2 n in (1.4, 1.6), got ${silSnap.refractiveIndex}`);
  assert.ok(silSnap.cherenkovAngleDeg > ethSnap.cherenkovAngleDeg,
    'Higher refractive index dielectric must produce wider Cherenkov cone angle');

  // Fail-closed controls: vacuum (n = 1.0), opaque metal-only surroundings, H-3 (beta < 1/n), U-238 alpha
  const vacuumCtrl = createSphNuclearCherenkovController({
    bodies: [chCfg.bodies[1]],
    environmentMode: 'vacuum'
  });
  assert.equal(vacuumCtrl.getSnapshot().cherenkovActive, false);
  assert.deepEqual([...vacuumCtrl.getSnapshot().cherenkovSrgb], [0, 0, 0]);

  const metalOnlyCtrl = createSphNuclearCherenkovController({
    bodies: [
      { id: 'fe', material: 'Fe', temperatureK: 300, shape: 'block', sizeM: [1, 0.8, 1], centerM: [0, 0.4, 0] },
      chCfg.bodies[1]
    ],
    materialProperties: {
      Fe: {
        formula: 'Fe',
        molarMassKgPerMol: 0.05585,
        meltingPointK: 1811,
        boilingPointK: 3134,
        electronicGapEv: 0,
        drudeConductivitySPerM: 1e7,
        phases: [{ name: 'solid', densityKgPerM3: 7874 }]
      }
    },
    environmentMode: 'vacuum'
  });
  assert.equal(metalOnlyCtrl.getSnapshot().cherenkovActive, false, 'Opaque metal must fail closed for Cherenkov emission');

  const tritiumCtrl = createSphNuclearCherenkovController({
    bodies: [
      chCfg.bodies[0],
      { ...chCfg.bodies[1], material: 'H', isotope: 'H-3' }
    ],
    materialProperties: {
      h2o: {
        formula: 'H2O',
        molarMassKgPerMol: 0.018015,
        meltingPointK: 273.15,
        boilingPointK: 373.15,
        electronicGapEv: 6.9,
        ior: 1.333,
        phases: [{ name: 'liquid', densityKgPerM3: 997 }]
      }
    },
    environmentMode: 'vacuum'
  });
  assert.equal(tritiumCtrl.getSnapshot().cherenkovActive, false, 'H-3 beta (0.14) < 1/n must fail closed');
  assert.deepEqual([...tritiumCtrl.getSnapshot().cherenkovSrgb], [0, 0, 0]);
});
