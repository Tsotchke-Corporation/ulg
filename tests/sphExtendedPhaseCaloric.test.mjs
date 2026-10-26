import assert from 'node:assert/strict';
import test from 'node:test';
import * as thermodynamics from '../src/runtime/material/condensableThermodynamics.js';
import { createExtendedPhaseCaloricFixture } from './fixtures/sphExtendedPhaseCaloric.js';
import { stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import { createSphState } from '../src/runtime/sph/sphState.js';
import { buildSphGpuParticleBuffers, buildMlsMpmGpuParticleBuffers } from '../src/runtime/sph/sphGpuBuffers.js';
import { assertSphCondensableInitializationMatches } from '../src/runtime/sph/sphCondensableParticleInitialization.js';
import { condensableCaloricSegments, selectCondensableCaloricRow, assertNoCondensableCaloricReactionTable }
  from '../src/runtime/sph/sphCondensableCaloricTable.js';
import { buildSphThermalMaterialTable, resolveThermalResponseGraphArtifacts,
  resolveThermalStateFromGraphPhaseResponseCpu, resolveThermalCarrierTemperatureSlopeFromTable }
  from '../src/runtime/sph/sphThermalGpuKernel.js';
import { createSphSpatialGasCaloricAuthority, resolveSphSpatialGasCaloricAuthority,
  resolveSphSpatialGasExchangeMaterials } from '../src/runtime/sph/sphSpatialGasCaloricAdmission.js';

const fixture = () => createExtendedPhaseCaloricFixture(thermodynamics);
const fractions = (phase) => [1, 2, 3, 4].map((id) => Number(id === phase));
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Number.isFinite(actual)
  && Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} +/- ${tolerance}`);

test('solid shares the liquid energy zero through fusion enthalpy including the pressure-volume term', () => {
  const model = fixture().condensableThermodynamicsByMaterial['three-phase'];
  near(model.solidCaloric.referenceInternalEnergyJPerKg, -70002.4);
  const solid = thermodynamics.resolveCondensableCaloricState(model, {
    phase: 'solid', specificInternalEnergyJPerKg: -70002.4, totalPressurePa: 3000 });
  const liquid = thermodynamics.resolveCondensableCaloricState(model, {
    phase: 'liquid', specificInternalEnergyJPerKg: -50003, totalPressurePa: 3000 });
  near(solid.temperatureK, 300);
  near(liquid.specificEnthalpyJPerKg - solid.specificEnthalpyJPerKg, 20000);
  near(liquid.specificInternalEnergyJPerKg - solid.specificInternalEnergyJPerKg, 19999.4);
  near(thermodynamics.resolveCondensableCaloricState(model, {
    phase: 'solid', specificInternalEnergyJPerKg: -68002.4, totalPressurePa: 3000 }).temperatureK, 301);
});

test('gas-only model has positive Cv and Cp=Cv+R/M, with no fictitious liquid or saturation', () => {
  const model = fixture().condensableThermodynamicsByMaterial['gas-only'];
  assert.equal(thermodynamics.isCondensableThermodynamics(model), false);
  assert.equal(thermodynamics.isIdealGasCaloricThermodynamics(model), true);
  assert.equal(model.vaporCvJPerKgK, 800);
  assert.equal(model.vaporCpJPerKgK, 1000);
  assert.equal(model.liquidCpJPerKgK, undefined);
  const gas = thermodynamics.resolveCondensableCaloricState(model, {
    phase: 'gas', specificInternalEnergyJPerKg: 50000, totalPressurePa: 100000 });
  near(gas.temperatureK, 237.5);
  near(gas.specificEnthalpyJPerKg - gas.specificInternalEnergyJPerKg, 47500);
  assert.throws(() => thermodynamics.evaluateCondensableThermodynamics(model, { temperatureK: 300, totalPressurePa: 3000 }));
  assert.throws(() => thermodynamics.resolveCondensableCaloricState(model, {
    phase: 'liquid', specificInternalEnergyJPerKg: 50000, totalPressurePa: 3000 }));
});

test('shared SPH/MLS packing and thermal graphs retain solid, liquid, vapor and gas-only identity', () => {
  const f = fixture();
  const state = createSphState({ particles: f.particles, smoothingLengthM: 1 });
  const sph = buildSphGpuParticleBuffers(state, f), mls = buildMlsMpmGpuParticleBuffers(state, f);
  const table = buildSphThermalMaterialTable(f.materialProperties, f);
  assertSphCondensableInitializationMatches(sph, mls, table);
  const artifacts = resolveThermalResponseGraphArtifacts({ thermalMaterialTable: table });
  const expectedT = [300 + 20002.4 / 2000, 300 + 3 / 4000, 300 - 170000 / 3900, 237.5];
  const expectedCv = [2000, 4000, 3900, 800];
  for (let i = 0; i < 4; i++) {
    const phaseId = f.particles[i].phaseCaloric.phaseId;
    assert.equal(sph.state[i * 8 + 7], f.particles[i].specificInternalEnergyJPerKg);
    assert.equal(sph.thermo[i * 12 + 1], phaseId);
    near(sph.thermo[i * 12 + 2], expectedT[i], 4e-5);
    assert.equal(mls.mechanics[i * 32 + 20], i === 0 ? 1 : 0);
    assert.equal(mls.mechanics[i * 32 + 21], 1);
    assert.equal(mls.mechanics[i * 32 + 27], 1);
    const materialId = stableOpticalMaterialId(f.particles[i].material);
    const result = resolveThermalStateFromGraphPhaseResponseCpu({
      graphSet: artifacts.thermalClosureGraphSet, responseTable: artifacts.thermalPhaseResponseTable,
      materialId, specificInternalEnergyJPerKg: sph.state[i * 8 + 7], phaseId, phaseFractions: fractions(phaseId) });
    near(result.temperatureK, expectedT[i], 4e-5);
    near(resolveThermalCarrierTemperatureSlopeFromTable(table, materialId,
      sph.state[i * 8 + 7], phaseId, fractions(phaseId)), 1 / expectedCv[i], 1e-9);
  }
});

test('model tags require the complete phase roster; truncation does not become a valid smaller model', () => {
  const f = fixture(), model = f.condensableThermodynamicsByMaterial['three-phase'];
  const props = { 'three-phase': f.materialProperties['three-phase'] };
  const table = buildSphThermalMaterialTable(props, { condensableThermodynamicsByMaterial: { 'three-phase': model } });
  const id = stableOpticalMaterialId('three-phase');
  assert.equal(table.records[2], 3);
  assert.equal(table.segments[1], 4);
  assert.equal(selectCondensableCaloricRow(table, id, -50000, 1, fractions(1)), 0);
  for (const corrupt of [
    (t) => { t.records[2] = 2; }, (t) => { t.records[2] = 1; },
    (t) => { t.segments[13] = 3; },
    (t) => { t.segments[14] = t.segments[15] = 1; },
    (t) => { t.segments[1] = t.segments[13] = t.segments[25] = 5; }
  ]) {
    const t = { ...table, records: table.records.slice(), segments: table.segments.slice() }; corrupt(t);
    assert.equal(selectCondensableCaloricRow(t, id, -50000, 1, fractions(1)), -1);
  }
  const oldInput = { ...f.waterInput }; delete oldInput.solidCaloric;
  const old = buildSphThermalMaterialTable(props, { condensableThermodynamicsByMaterial: {
    'three-phase': thermodynamics.createCondensableThermodynamics(oldInput) } });
  old.records[2] = 1;
  assert.equal(selectCondensableCaloricRow(old, id, -50000, 2, fractions(2)), -1);
  const gas = buildSphThermalMaterialTable({ 'gas-only': f.materialProperties['gas-only'] }, {
    condensableThermodynamicsByMaterial: { 'gas-only': f.condensableThermodynamicsByMaterial['gas-only'] } });
  assert.equal(gas.records[2], 1);
  assert.equal(gas.segments[1], 5);
  assert.equal(selectCondensableCaloricRow(gas, stableOpticalMaterialId('gas-only'), 50000, 2, fractions(2)), -1);
  assert.throws(() => assertNoCondensableCaloricReactionTable(gas), /not yet admitted/);
  assert.throws(() => assertNoCondensableCaloricReactionTable(table), /not yet admitted/);
});

test('original gas EOS authority admits both models and exports gas-only heat rows without a liquid law', () => {
  const f = fixture(), table = buildSphThermalMaterialTable(f.materialProperties, f);
  const authority = createSphSpatialGasCaloricAuthority({ thermalMaterialTable: table,
    condensableThermodynamicsByMaterial: f.condensableThermodynamicsByMaterial });
  const admitted = resolveSphSpatialGasCaloricAuthority(authority, { thermalMaterialTable: table });
  assert.equal(admitted.materialCount, 2);
  const rows = resolveSphSpatialGasExchangeMaterials(authority, { thermalMaterialTable: table, surfaceModels: {} });
  const offset = rows.materials.indexOf('gas-only') * 16;
  for (const lane of [4, 5, 8, 9, 10, 11]) assert.equal(rows.records[offset + lane], 0);
  assert.equal(rows.records[offset + 12], 800);
  assert.equal(rows.records[offset + 13], 1.25);
  assert.equal(rows.records[offset + 15], 1);
  assert.throws(() => resolveSphSpatialGasExchangeMaterials(authority, { thermalMaterialTable: table,
    surfaceModels: { 'gas-only': {} } }), /gas-only material/);
});

test('invalid solid reference, gas domain and copied models fail before packing', () => {
  const f = fixture();
  for (const patch of [{ cpJPerKgK: 0 }, { fusionEnthalpyJPerKg: -1 }, { densityKgPerM3: NaN },
    { referenceTemperatureK: 190 }, { maxTemperatureK: 200 }, { referencePressurePa: 3000000 }, { provenance: '' }]) {
    assert.throws(() => thermodynamics.createCondensableThermodynamics({ ...f.waterInput,
      solidCaloric: { ...f.waterInput.solidCaloric, ...patch } }));
  }
  for (const patch of [{ cvJPerKgK: 0 }, { maxTemperatureK: 200 }, { molarMassKgPerMol: 0 },
    { referenceTemperatureK: 900 }, { referenceSpecificInternalEnergyJPerKg: Infinity }, { schema: 'other' }]) {
    assert.throws(() => thermodynamics.createIdealGasCaloricThermodynamics({ ...f.gasInput, ...patch }));
  }
  assert.throws(() => condensableCaloricSegments({ ...f.condensableThermodynamicsByMaterial['gas-only'] }));
  f.materialProperties['gas-only'].phases[0].cpJPerKgK = 800;
  assert.throws(() => buildSphGpuParticleBuffers(createSphState({ particles: f.particles, smoothingLengthM: 1 }), f), /Cp/);
});
