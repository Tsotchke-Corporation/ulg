import assert from 'node:assert/strict';
import test from 'node:test';
import * as thermo from '../src/runtime/material/condensableThermodynamics.js';
import { createExtendedPhaseCaloricFixture } from './fixtures/sphExtendedPhaseCaloric.js';
import { createSphState } from '../src/runtime/sph/sphState.js';
import { buildSphGpuParticleBuffers, buildMlsMpmGpuParticleBuffers } from '../src/runtime/sph/sphGpuBuffers.js';
import { resolveSphPhaseCaloricModels, assertSphCondensableInitializationMatches }
  from '../src/runtime/sph/sphCondensableParticleInitialization.js';
import { buildSphThermalMaterialTable } from '../src/runtime/sph/sphThermalGpuKernel.js';
import { buildSphThermalMaterialTableFromViewState, thermalMaterialTablesExactlyEqual }
  from '../src/runtime/sph/sphStaticTableInputs.js';
import { buildSphEnvironmentGasInputs, createSphRoomAirInitialization, SPH_ENVIRONMENT_DRY_AIR }
  from '../src/runtime/sphEnvironmentInitialization.js';
import { createSphPhaseViewState } from '../src/runtime/sphPhaseViewState.js';
import { particleThermalState } from '../src/runtime/sphPhaseDemo.js';

function input() {
  const f = createExtendedPhaseCaloricFixture(thermo);
  return { f, state: createSphState({ smoothingLengthM: 1, particles: f.particles }),
    materialProperties: {
      'three-phase': { ...f.materialProperties['three-phase'], phaseCaloricModel: f.waterInput },
      'gas-only': { ...f.materialProperties['gas-only'], phaseCaloricModel: f.gasInput }
    } };
}

test('authored model inputs survive structured clone and JSON without serializing private models', () => {
  const { f, state, materialProperties } = input();
  const referenceSph = buildSphGpuParticleBuffers(state, f);
  const referenceMls = buildMlsMpmGpuParticleBuffers(state, f);
  const referenceTable = buildSphThermalMaterialTable(f.materialProperties, f);
  for (const clone of [structuredClone, (x) => JSON.parse(JSON.stringify(x))]) {
    const payload = clone({ state, materialProperties });
    const packed = buildSphGpuParticleBuffers(payload.state, payload);
    const mls = buildMlsMpmGpuParticleBuffers(payload.state, payload);
    const table = buildSphThermalMaterialTableFromViewState(payload);
    assert.deepEqual(packed.state, referenceSph.state);
    assert.deepEqual(packed.thermo, referenceSph.thermo);
    assert.deepEqual(mls.mechanics, referenceMls.mechanics);
    assert.equal(thermalMaterialTablesExactlyEqual(table, referenceTable), true);
    assert.doesNotThrow(() => assertSphCondensableInitializationMatches(packed, mls, table));
    assert.equal(packed.phaseCaloricInitializationSignature, referenceSph.phaseCaloricInitializationSignature);
    const models = resolveSphPhaseCaloricModels(payload.materialProperties);
    assert.ok(thermo.isPhaseCaloricThermodynamics(models['three-phase']));
    assert.ok(thermo.isIdealGasCaloricThermodynamics(models['gas-only']));
    assert.notEqual(models['gas-only'], f.condensableThermodynamicsByMaterial['gas-only']);
  }
});

test('explicit models cannot replace conflicting material calorics or silently disable enrollment', () => {
  const { f, state, materialProperties } = input();
  const table = buildSphThermalMaterialTable(materialProperties, f);
  const packed = buildSphGpuParticleBuffers(state, { materialProperties, condensableThermodynamicsByMaterial: {} });
  assert.doesNotThrow(() => assertSphCondensableInitializationMatches(packed, null, table));
  const conflicting = { ...f.condensableThermodynamicsByMaterial,
    'gas-only': thermo.createIdealGasCaloricThermodynamics({ ...f.gasInput, referenceSpecificInternalEnergyJPerKg: 110000 }) };
  const options = { materialProperties, condensableThermodynamicsByMaterial: conflicting };
  for (const build of [buildSphGpuParticleBuffers, buildMlsMpmGpuParticleBuffers]) {
    assert.throws(() => build(state, options), /differs from material/);
  }
  assert.throws(() => buildSphThermalMaterialTable(materialProperties, options), /differs from material/);
});

test('initial view, pressure summary and material descriptors retain overlapping explicit phases', () => {
  const { state, materialProperties } = input();
  for (const properties of Object.values(materialProperties)) properties.intrinsicColorSrgb = [.5, .5, .5];
  const demo = { state, materialProperties, counts: { base: 3, drop: 1 },
    box: { edgeM: 4, dimensionsM: [4, 4, 4] },
    scenario: { ambientTemperatureK: 293.15, walls: { model: 'adiabatic' },
      iron: { volumeM3: 0 }, ice: { volumeM3: 0 } } };
  const thermal = particleThermalState(demo);
  assert.deepEqual(thermal.map((row) => row.phase), ['solid', 'liquid', 'gas', 'gas']);
  assert.ok(Math.abs(thermal[0].temperatureK - 310.0012) < .0001);
  assert.ok(Math.abs(thermal[3].temperatureK - 237.5) < .0001);
  const view = createSphPhaseViewState({ demo });
  assert.deepEqual(view.materials.map((row) => row.phase), ['solid', 'liquid', 'gas', 'gas']);
  assert.deepEqual(view.phaseMassSummary.byMaterialPhase['three-phase'], { solid: 1, liquid: 1, gas: 1 });
  const table = buildSphThermalMaterialTableFromViewState(structuredClone(view));
  assert.doesNotThrow(() => assertSphCondensableInitializationMatches(view.sphGpuParticleState,
    view.mlsMpmGpuParticleState, table));
  assert.equal(view.gasPressureSummary.bySpecies['three-phase'].massKg, 1);
  assert.equal(view.gasPressureSummary.bySpecies['gas-only'].massKg, 1);
  assert.ok(Math.abs(view.gasPressureSummary.bySpecies['gas-only'].temperatureK - 237.5) < .0001);
});

test('changed serialized reference energy invalidates cached table and original seed signature', () => {
  const { state, materialProperties } = input();
  const packed = buildSphGpuParticleBuffers(state, { materialProperties });
  const table = buildSphThermalMaterialTableFromViewState({ materialProperties });
  materialProperties['gas-only'].phaseCaloricModel.referenceSpecificInternalEnergyJPerKg += 1000;
  const changed = buildSphThermalMaterialTableFromViewState({ materialProperties });
  assert.equal(thermalMaterialTablesExactlyEqual(table, changed), false);
  assert.throws(() => assertSphCondensableInitializationMatches(packed, null, changed), /differs/);
});

test('malformed inputs and copied derived models reject before falling back to legacy energy', () => {
  const { f, state, materialProperties } = input();
  for (const record of [null, { ...f.gasInput, schema: 'unknown' },
    { ...f.gasInput, extra: 1 }, structuredClone(f.condensableThermodynamicsByMaterial['gas-only'])]) {
    materialProperties['gas-only'].phaseCaloricModel = record;
    assert.throws(() => buildSphGpuParticleBuffers(state, { materialProperties }));
    assert.throws(() => buildSphThermalMaterialTableFromViewState({ materialProperties }));
  }
  let called = false;
  const accessor = { ...f.gasInput };
  Object.defineProperty(accessor, 'schema', { get() { called = true; return f.gasInput.schema; } });
  assert.throws(() => thermo.createPhaseCaloricThermodynamics(accessor), /Unsupported/);
  assert.equal(called, false);
});

test('environment mass and energy use the same material models as cold worker packing', () => {
  const { f } = input();
  const materialProperties = { h2o: { ...f.materialProperties['three-phase'], phaseCaloricModel: f.waterInput } };
  for (const { material } of SPH_ENVIRONMENT_DRY_AIR.species) {
    materialProperties[material] = { ...f.materialProperties['gas-only'], phaseCaloricModel: f.gasInput };
  }
  const environment = createSphRoomAirInitialization({ temperatureK: 300 });
  const compiled = buildSphEnvironmentGasInputs({ environment, freeVolumeM3: .125,
    materialProperties: structuredClone(materialProperties) });
  const state = createSphState({ smoothingLengthM: 1, particles: compiled.gasSpecies.map((row) => ({
    material: row.material, massKg: row.massKg, specificInternalEnergyJPerKg: row.specificInternalEnergyJPerKg,
    x: [1, 1, 1], v: row.meanVelocityMPerS, phaseCaloric: { phaseId: 3, phaseFractions: [0, 0, 1, 0] }
  })) });
  const packed = buildSphGpuParticleBuffers(state, { materialProperties });
  const mls = buildMlsMpmGpuParticleBuffers(state, { materialProperties });
  const table = buildSphThermalMaterialTableFromViewState({ materialProperties });
  assert.doesNotThrow(() => assertSphCondensableInitializationMatches(packed, mls, table));
  for (const [i, row] of compiled.gasSpecies.entries()) {
    assert.equal(row.specificInternalEnergyJPerKg, row.material === 'h2o' ? 120000 : 100000);
    assert.equal(packed.state[i * 8 + 7], row.specificInternalEnergyJPerKg);
    assert.equal(packed.thermo[i * 12 + 1], 3);
    assert.ok(Math.abs(packed.thermo[i * 12 + 2] - 300) < .0001);
  }
  assert.throws(() => buildSphEnvironmentGasInputs({ environment, freeVolumeM3: .125,
    materialProperties, waterThermodynamics: f.condensableThermodynamicsByMaterial['three-phase'] }), /one source/);
  delete materialProperties.o2.phaseCaloricModel;
  assert.throws(() => buildSphEnvironmentGasInputs({ environment, freeVolumeM3: .125, materialProperties }), /o2 requires/);
});
