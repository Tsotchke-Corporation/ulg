import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { ClosureRegistry } from '../src/runtime/ClosureRegistry.js';
import { MaterialRegistry } from '../src/runtime/material/MaterialRegistry.js';
import { createFirstPrinciplesMaterialClosures, createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { heatCapacityJPerKgK, specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import { equilibriumFromSpecificEnergy, stablePhaseAt } from '../src/runtime/material/phaseEquilibrium.js';
import { computeClosureBackedPreflight } from '../src/runtime/material/thermodynamicPreflight.js';
import { createSphPhaseScenario } from '../src/runtime/thermoPreflight.js';
import { specificEnergyJPerKg } from '../src/runtime/materials/referenceMaterials.js';

const STD_ATM = 101325;

async function freshRegistry() {
  const registry = new MaterialRegistry({
    closureRegistry: new ClosureRegistry({ artifactCache: new ArtifactCache() }),
    requireFirstPrinciples: false
  });
  await registry.registerAll(createReferenceMaterialClosures());
  return registry;
}

async function derivedRegistry() {
  const registry = new MaterialRegistry({
    closureRegistry: new ClosureRegistry({ artifactCache: new ArtifactCache() })
  });
  await registry.registerAll(createFirstPrinciplesMaterialClosures());
  return registry;
}

test('reference material closures are non-overclaiming and cite pending microphysics inputs', () => {
  const closures = createReferenceMaterialClosures();
  assert.equal(closures.fe.schema, 'eshkol.ulg.material-closure.v0');
  assert.equal(closures.fe.validation.materialValidation, false);
  assert.equal(closures.fe.validation.scientificValidation, false);
  // Fe microphysics is not yet produced; H2O now cites a produced (model-quality) reference,
  // covered in microphysics.test.mjs.
  assert.equal(closures.fe.inputRefs[0].schema, 'moonlab.ulg.fe-microphysics-reference.v0');
  assert.equal(closures.fe.inputRefs[0].status, 'pending-not-yet-produced');
});

test('thermo core: H2O matches the constant-cp reference; iron solid uses first-principles Debye', () => {
  const { fe, h2o } = createReferenceMaterialClosures();
  // Water still uses constant per-phase heat capacities, so it matches the reference exactly.
  for (const t of [233.15, 300, 350, 500]) {
    assert.ok(Math.abs(specificInternalEnergyJPerKg(h2o.properties, t) - specificEnergyJPerKg('h2o', t)) < 1e-6);
  }
  // Iron solid heat capacity is now the Debye model: below Dulong–Petit at low T, approaching it
  // at high T. So its internal energy is genuinely lower than the constant-449 reference.
  const cv233 = heatCapacityJPerKgK(fe.properties, 233.15);
  const cv1500 = heatCapacityJPerKgK(fe.properties, 1500);
  assert.ok(cv233 > 340 && cv233 < 390, `Fe cv(233) ${cv233}`);
  assert.ok(cv1500 > cv233 && cv1500 < 449, `Fe cv(1500) ${cv1500}`);
  assert.ok(specificInternalEnergyJPerKg(fe.properties, 1000) < specificEnergyJPerKg('fe', 1000), 'Debye energy below constant-cp');
});

test('phase equilibrium: stable phase by temperature and lever rule by energy', () => {
  const { h2o } = createReferenceMaterialClosures();
  assert.equal(stablePhaseAt(h2o.properties, 250), 'solid');
  assert.equal(stablePhaseAt(h2o.properties, 300), 'liquid');
  assert.equal(stablePhaseAt(h2o.properties, 400), 'gas');
  // Mid-fusion energy -> stuck at the melting plateau with half-and-half phase fractions.
  const eSolidTop = specificInternalEnergyJPerKg(h2o.properties, 273.15);
  const eMidFusion = eSolidTop + h2o.properties.transitions[0].latentHeatJPerKg / 2;
  const state = equilibriumFromSpecificEnergy(h2o.properties, eMidFusion);
  assert.ok(Math.abs(state.temperatureK - 273.15) < 1e-9);
  assert.ok(Math.abs(state.phaseFractions.solid - 0.5) < 1e-6);
  assert.ok(Math.abs(state.phaseFractions.liquid - 0.5) < 1e-6);
});

test('MaterialRegistry samples closure-backed properties with phase and density', async () => {
  const registry = await freshRegistry();
  const ironDensity = await registry.sampleProperty({ material: 'fe', property: 'density', temperatureK: 1850, pressurePa: STD_ATM });
  assert.equal(ironDensity.status, 'sampled');
  assert.equal(ironDensity.value, 7000);
  assert.equal(ironDensity.phase, 'liquid');
  const iceDensity = await registry.sampleProperty({ material: 'h2o', property: 'density', temperatureK: 233.15 });
  assert.equal(iceDensity.value, 917);
  assert.equal(iceDensity.phase, 'solid');
  const airDensity = await registry.sampleProperty({ material: 'air', property: 'density', temperatureK: 233.15, pressurePa: STD_ATM });
  assert.ok(airDensity.value > 1.5 && airDensity.value < 1.53);
  // Energy sampling uses the first-principles Debye iron solid, so it is below (and within a few
  // percent of) the constant-cp reference, and stays non-overclaiming.
  const ironEnergy = await registry.sampleProperty({ material: 'fe', property: 'specificInternalEnergy', temperatureK: 1850 });
  assert.ok(ironEnergy.value > 0 && ironEnergy.value < specificEnergyJPerKg('fe', 1850));
  assert.ok(ironEnergy.value > 0.9 * specificEnergyJPerKg('fe', 1850));
  assert.equal(ironEnergy.materialValidation, false);
});

test('MaterialRegistry sampling outside the closure domain emits a refresh request', async () => {
  const registry = await freshRegistry();
  const sample = await registry.sampleProperty({ material: 'fe', property: 'specificInternalEnergy', temperatureK: 5000 });
  assert.equal(sample.status, 'out-of-domain');
  assert.equal(sample.value, null);
  assert.equal(sample.refreshRequest.status, 'refresh-recommended');
  assert.equal(sample.refreshRequest.registryAction, 'invalidate-and-rerun-closure-derive');
  assert.equal(sample.refreshRequest.reason, 'material-state-outside-closure-domain');
  assert.deepEqual(sample.refreshRequest.minOutOfRangeInput, 5000);
});

test('closure-backed preflight reproduces the reference-constant preflight', async () => {
  const registry = await freshRegistry();
  const scenario = createSphPhaseScenario();
  const preflight = await computeClosureBackedPreflight(scenario, { materialRegistry: registry, allowFixtureBaseline: true });
  assert.equal(preflight.closureBacked, true);
  // Masses + feasibility are invariant to the heat-capacity model, so they still match.
  assert.equal(preflight.closureSampling.consistentWithReference, true);
  // The first-principles energy budget is within a few percent of the constant-cp baseline
  // (~864 MJ): the Debye heat capacity lowers it and the Richards latent heat raises it, and the
  // two corrections nearly cancel here.
  assert.ok(preflight.closureSampling.heatExportedToWallsJ > 820e6 && preflight.closureSampling.heatExportedToWallsJ < 910e6);
  assert.ok(Math.abs(preflight.closureSampling.firstPrinciplesEnergyDeltaJ) < 40e6);
  assert.equal(preflight.closureSampling.feasible, true);
  assert.equal(preflight.feasibility.feasible, true);
  assert.equal(preflight.scientificValidation, false);
  assert.ok(preflight.blockers.includes('closure-backed-by-reference-fixtures-not-validated'));

  const adiabatic = await computeClosureBackedPreflight(createSphPhaseScenario({ wallModel: 'adiabatic' }), { materialRegistry: registry, allowFixtureBaseline: true });
  assert.equal(adiabatic.closureSampling.feasible, false);
  assert.equal(adiabatic.closureSampling.consistentWithReference, true);
});

test('closure-backed preflight runs strict derived closures without fixture baseline', async () => {
  const registry = await derivedRegistry();
  const preflight = await computeClosureBackedPreflight(createSphPhaseScenario(), { materialRegistry: registry });
  assert.equal(preflight.closureBacked, true);
  assert.equal(preflight.status, 'preflight-feasible');
  assert.equal(preflight.closureSampling.feasible, true);
  assert.deepEqual(preflight.blockers, ['derived-material-models-unvalidated']);
});

test('closure-backed preflight blocks (with a refresh request) when a material starts out of domain', async () => {
  const registry = await freshRegistry();
  // Iron initial temperature above the Fe closure validity domain (200..4000 K).
  const scenario = createSphPhaseScenario({ ironInitialTemperatureK: 5000 });
  const preflight = await computeClosureBackedPreflight(scenario, { materialRegistry: registry, allowFixtureBaseline: true });
  assert.equal(preflight.status, 'preflight-blocked-closure-domain');
  const blockedFe = preflight.blockedMaterials.find((m) => m.material === 'fe');
  assert.ok(blockedFe);
  assert.equal(blockedFe.refreshRequest.status, 'refresh-recommended');
});
