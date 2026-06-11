import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createGruneisenEosClosure,
  densityAtTemperature,
  linearThermalExpansionPerK
} from '../src/runtime/material/gruneisenEos.js';
import {
  clausiusClapeyronBoilingPointK,
  latentHeatOfFusionJPerKg,
  latentHeatOfVaporizationJPerKg
} from '../src/runtime/material/phaseTransitions.js';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { ClosureRegistry } from '../src/runtime/ClosureRegistry.js';
import { MaterialRegistry } from '../src/runtime/material/MaterialRegistry.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { createMaterialClosureArtifact, SPH_PHASE_CLOSURE_SCHEMAS } from '../ulg-gpu-abi/src/index.js';

const IRON = { gruneisen: 1.7, densityKgPerM3: 7874, heatCapacityJPerKgK: 449, bulkModulusPa: 170e9 };

test('Grüneisen thermal expansion of iron matches the measured ~1.18e-5/K', () => {
  const linear = linearThermalExpansionPerK(IRON);
  assert.ok(Math.abs(linear - 1.18e-5) / 1.18e-5 < 0.1, `linear α ${linear}`);
});

test('Grüneisen density(T): iron expands (density drops) toward melting', () => {
  const rho1800 = densityAtTemperature({
    referenceDensityKgPerM3: 7874, referenceTemperatureK: 293, temperatureK: 1800,
    gruneisen: 1.7, heatCapacityJPerKgK: 445, bulkModulusPa: 170e9
  });
  // Iron near melting is ~7400 kg/m^3 (down from 7874 at room T).
  assert.ok(rho1800 > 7350 && rho1800 < 7550, `ρ(1800) ${rho1800}`);
  assert.ok(rho1800 < 7874);
});

test('latent heat of fusion from Richards rule is within ~10% for a metal (iron)', () => {
  const lf = latentHeatOfFusionJPerKg({ meltingPointK: 1811, molarMassKgPerMol: 0.055845 });
  assert.ok(Math.abs(lf - 247000) / 247000 < 0.12, `L_fus ${lf}`);
});

test('Trouton rule underestimates water L_vap (hydrogen bonding) — flagged, not faked', () => {
  const lvUniversal = latentHeatOfVaporizationJPerKg({ boilingPointK: 373.15, molarMassKgPerMol: 0.018015 });
  // Universal Trouton (~88) gives ~1820 kJ/kg vs the measured 2257 — water associates.
  assert.ok(lvUniversal < 2000e3, 'universal Trouton underestimates associated water');
  // With water's actual entropy of vaporization it is recovered (this entropy needs cohesive
  // microphysics, so the closure does not pretend the universal rule is first-principles for water).
  const lvWater = latentHeatOfVaporizationJPerKg({ boilingPointK: 373.15, molarMassKgPerMol: 0.018015, entropyOfVaporizationJPerMolK: 109 });
  assert.ok(Math.abs(lvWater - 2257e3) / 2257e3 < 0.05);
});

test('Clausius–Clapeyron lowers the boiling point at reduced pressure', () => {
  const tb = clausiusClapeyronBoilingPointK({
    referenceBoilingPointK: 373.15, referencePressurePa: 101325, targetPressurePa: 50000,
    latentHeatJPerKg: 2256000, molarMassKgPerMol: 0.018015
  });
  assert.ok(tb < 373.15 && tb > 330, `T_b(0.5 atm) ${tb}`);
});

test('iron solid closure now reports a temperature-dependent (thermal-expansion) density', async () => {
  const registry = new MaterialRegistry({
    closureRegistry: new ClosureRegistry({ artifactCache: new ArtifactCache() }),
    requireFirstPrinciples: false
  });
  await registry.registerAll(createReferenceMaterialClosures());
  const cold = await registry.sampleProperty({ material: 'fe', property: 'density', temperatureK: 300 });
  const hot = await registry.sampleProperty({ material: 'fe', property: 'density', temperatureK: 1500 });
  assert.ok(cold.value > hot.value, `ρ(300)=${cold.value} should exceed ρ(1500)=${hot.value}`);
  assert.ok(Math.abs(cold.value - 7874) < 60);
});

test('Grüneisen EOS closure artifact is derived but not EOS-validated', () => {
  const closure = createGruneisenEosClosure({ material: 'fe', gruneisen: 1.7, bulkModulusPa: 170e9, referenceDensityKgPerM3: 7874, createMaterialClosureArtifact });
  assert.equal(closure.schema, SPH_PHASE_CLOSURE_SCHEMAS.eos);
  assert.equal(closure.closureBacked, true);
  assert.equal(closure.validation.eosValidation, false);
});
