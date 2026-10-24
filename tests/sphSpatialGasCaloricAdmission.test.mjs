import assert from 'node:assert/strict';
import test from 'node:test';
import { createCondensableThermodynamics, CONDENSABLE_THERMODYNAMICS_SCHEMA }
  from '../src/runtime/material/condensableThermodynamics.js';
import { stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import { buildSphThermalMaterialTable } from '../src/runtime/sph/sphThermalGpuKernel.js';
import {
  createSphSpatialGasCaloricAuthority, resolveSphSpatialGasCaloricAuthority,
  validateSphSpatialGasCaloricAuthority, decodeSphSpatialGasCaloricAdmissionRows,
  sphSpatialGasCaloricAdmissionWgsl, SPH_SPATIAL_GAS_CALORIC_MATERIAL_LAYOUT,
  SPH_SPATIAL_GAS_CALORIC_MOLAR_MASS_RELATIVE_BUDGET,
  resolveSphSpatialGasExchangeMaterials
} from '../src/runtime/sph/sphSpatialGasCaloricAdmission.js';

const R = 8.314462618;
const near = (actual, expected, tolerance, name) => assert.ok(Number.isFinite(actual)
  && Math.abs(actual - expected) <= tolerance, `${name}: ${actual} vs ${expected}`);
// Explicitly manufactured, NOT physical H2O/H2 constants or preset enrollment.
function modelRecord(material, shift = 0) {
  return { schema: CONDENSABLE_THERMODYNAMICS_SCHEMA,
    energyBasis: 'specific-enthalpy-at-reference-pressure',
    referenceTemperatureK: 300, referencePressurePa: 3000,
    liquidReferenceEnthalpyJPerKg: (material === 'h2o' ? -50_000 : 300_000) + shift,
    vaporizationReferenceEnthalpyJPerKg: material === 'h2o' ? 2_000_000 : 4_000_000,
    liquidCpJPerKgK: 4000, vaporCpJPerKgK: material === 'h2o' ? 2500 : 6000,
    liquidDensityKgPerM3: 1000, molarMassKgPerMol: material === 'h2o' ? 0.02 : 0.004,
    minTemperatureK: material === 'h2o' ? 200 : 220,
    maxTemperatureK: material === 'h2o' ? 450 : 500, maxPressurePa: 2_000_000,
    provenance: `manufactured independent gas caloric input ${material}` };
}
function fixture(shifts = {}) {
  const records = Object.fromEntries(['h2o', 'h2'].map((material) => [material, modelRecord(material, shifts[material] ?? 0)]));
  const models = Object.fromEntries(Object.entries(records).map(([material, record]) => [material, createCondensableThermodynamics(record)]));
  const properties = Object.fromEntries(Object.entries(records).map(([material, record]) => [material, {
    molarMassKgPerMol: record.molarMassKgPerMol,
    phases: [{ name: 'liquid', cpJPerKgK: record.liquidCpJPerKgK, densityKgPerM3: record.liquidDensityKgPerM3,
      temperatureRange: [0, 400], bulkModulusPa: 1e8, shearModulusPa: 0 },
    { name: 'gas', cpJPerKgK: record.vaporCpJPerKgK,
      densityKgPerM3: record.referencePressurePa * record.molarMassKgPerMol / (R * record.referenceTemperatureK),
      temperatureRange: [400, 1000], bulkModulusPa: null, shearModulusPa: 0 }],
    transitions: [{ from: 'liquid', to: 'gas', temperatureK: 400, latentHeatJPerKg: record.vaporizationReferenceEnthalpyJPerKg }]
  }]));
  // An ordinary unmatched legacy material must not prevent explicit admission.
  properties.fe = { molarMassKgPerMol: 0.056,
    phases: [{ name: 'solid', cpJPerKgK: 700, densityKgPerM3: 7800, temperatureRange: [0, 2000] }], transitions: [] };
  const table = buildSphThermalMaterialTable(properties, { condensableThermodynamicsByMaterial: models });
  return { models, records, properties, table };
}
const create = (f) => createSphSpatialGasCaloricAuthority({ thermalMaterialTable: f.table, condensableThermodynamicsByMaterial: f.models });
const resolve = (f, authority) => resolveSphSpatialGasCaloricAuthority(authority, { thermalMaterialTable: f.table });
const gasRow = (packed, material) => {
  for (let i = 0; i < packed.records.length; i += 8) {
    if (packed.records[i] === stableOpticalMaterialId(material)) return packed.records.slice(i, i + 8);
  }
  return null;
};

const surface = () => ({ schema: 'peercompute.ulg.linear-pure-interface.v1',
  provenance: 'manufactured nonzero surface energy, not a preset model',
  interceptNPerM: 0.2, slopeNPerMK: -0.0002, minTemperatureK: 200, maxTemperatureK: 500 });
const exchange = (f, authority, surfaceModels = { h2o: surface() }) =>
  resolveSphSpatialGasExchangeMaterials(authority, { thermalMaterialTable: f.table, surfaceModels });

test('exchange material rows preserve both phase gauges and explicit surface internal energy', () => {
  const f = fixture(), authority = create(f), result = exchange(f, authority);
  assert.equal(result.recordStrideFloats, 16);
  assert.equal(result.kineticAuthorization, false);
  assert.equal(result.exchangeIntervalAdmitted, false);
  const index = result.materials.indexOf('h2o'), row = result.records.slice(index * 16, index * 16 + 16);
  assert.equal(row[0], stableOpticalMaterialId('h2o'));
  assert.deepEqual(Array.from(row.slice(2, 4)), Array.from(gasRow(resolve(f, authority), 'h2o').slice(3, 5)));
  assert.equal(row[4], Math.fround(f.models.h2o.liquidEnergyMinJPerKg));
  assert.equal(row[5], Math.fround(f.models.h2o.liquidEnergyMaxJPerKg));
  assert.equal(row[9], Math.fround(0.2));
  assert.equal(row[10], Math.fround(-0.0002));
  assert.equal(row[11], 1);
  assert.ok(Math.abs(row[9] - (row[9] + 300 * row[10])) > 0.05, 'U_sigma/A is not sigma');
  const inert = result.materials.indexOf('h2');
  assert.equal(result.records[inert * 16 + 11], 0, 'no invented surface enrollment for another gas');
  const expected = result.records.slice(); result.records.fill(-1);
  assert.deepEqual(exchange(f, authority).records, expected, 'detached cold copy');
});

for (const [name, alter] of [
  ['missing input', () => undefined], ['array', () => []], ['unknown material', () => ({ fe: surface() })],
  ['wrong model', () => ({ h2o: { ...surface(), schema: 'constant-sigma' } })],
  ['missing provenance', () => ({ h2o: { ...surface(), provenance: '' } })],
  ['non-covering domain', () => ({ h2o: { ...surface(), minTemperatureK: 250 } })],
  ['zero surface energy', () => ({ h2o: { ...surface(), interceptNPerM: 0 } })],
  ['negative endpoint tension', () => ({ h2o: { ...surface(), slopeNPerMK: -0.002 } })],
  ['unrepresentable tension', () => ({ h2o: { ...surface(), interceptNPerM: 1e40 } })],
  ['string coefficient', () => ({ h2o: { ...surface(), interceptNPerM: '0.2' } })],
  ['extra rate/activation knob', () => ({ h2o: { ...surface(), activationRate: 1 } })],
  ['accessor', () => ({ get h2o() { throw new Error('must not run accessor'); } })]
]) test(`exchange material compilation rejects ${name}`, () => {
  const f = fixture(), authority = create(f);
  assert.throws(() => resolveSphSpatialGasExchangeMaterials(authority,
    { thermalMaterialTable: f.table, surfaceModels: alter() }), /Gas caloric authority/);
});

test('exchange compilation cannot substitute the issued caloric model/table', () => {
  const f = fixture(), authority = create(f);
  assert.throws(() => exchange(f, { ...authority }), /unissued/);
  f.table.segments[4] += 0.5;
  assert.throws(() => exchange(f, authority), /stale/);
});

test('created authority compiles actual explicit gas curves, not Cp or the unmatched legacy material', () => {
  const f = fixture(), before = structuredClone(f.table);
  const authority = create(f), packed = resolve(f, authority);
  assert.equal(Object.isFrozen(authority), true);
  assert.equal(authority.exchangeIntervalAdmitted, false);
  assert.equal(packed.exchangeIntervalAdmitted, false);
  assert.equal(packed.scientificValidation, false);
  assert.equal(packed.materialCount, 2);
  assert.equal(packed.recordStrideFloats, 8);
  assert.equal(packed.records.length, 16);
  assert.equal(SPH_SPATIAL_GAS_CALORIC_MATERIAL_LAYOUT.length, 8);
  assert.equal(gasRow(packed, 'fe'), null);
  for (const material of ['h2o', 'h2']) {
    const row = gasRow(packed, material), p = f.records[material];
    const cv = p.vaporCpJPerKgK - R / p.molarMassKgPerMol;
    const referenceU = p.liquidReferenceEnthalpyJPerKg + p.vaporizationReferenceEnthalpyJPerKg
      - R / p.molarMassKgPerMol * p.referenceTemperatureK;
    const lo = Math.fround(referenceU + cv * (p.minTemperatureK - p.referenceTemperatureK));
    const hi = Math.fround(referenceU + cv * (p.maxTemperatureK - p.referenceTemperatureK));
    assert.deepEqual(Array.from(row), [stableOpticalMaterialId(material), Math.fround(p.molarMassKgPerMol),
      Math.fround((hi - lo) / (p.maxTemperatureK - p.minTemperatureK)), lo, hi,
      p.minTemperatureK, p.maxTemperatureK, 1]);
    assert.ok(Math.abs(row[2] - p.vaporCpJPerKgK) > 400, 'physical Cv is not the legacy Cp field');
  }
  assert.deepEqual(f.table, before, 'compilation preserves the entire input table');
  assert.equal(validateSphSpatialGasCaloricAuthority(authority, { thermalMaterialTable: f.table }), true);
});

test('resolver returns a detached upload copy without exposing private authoritative data', () => {
  const f = fixture(), authority = create(f);
  const first = resolve(f, authority), expected = first.records.slice();
  first.records.fill(-1);
  assert.deepEqual(resolve(f, authority).records, expected);
});

for (const [name, mutate] of [
  ['copied token', (f, authority) => structuredClone(authority)],
  ['copied thermal table', (f, authority) => { f.table = structuredClone(f.table); return authority; }],
  ['changed material header', (f, authority) => { f.table.records[4] += 0.125; return authority; }],
  ['changed phase energy', (f, authority) => { f.table.segments[4] += 1000; return authority; }],
  ['changed segment metadata', (f, authority) => { f.table.segmentMetadata[0].tHi += 1; return authority; }],
  ['changed M metadata', (f, authority) => { f.table.metadata.find((m) => m.phaseCaloric).caloricInitializationProperties[0] *= 2; return authority; }],
  ['changed unrelated legacy metadata', (f, authority) => { f.table.metadata.find((m) => m.material === 'fe').material = 'c'; return authority; }],
  ['new undefined metadata', (f, authority) => { f.table.added = undefined; return authority; }],
  ['new NaN metadata', (f, authority) => { f.table.added = NaN; return authority; }],
  ['changed layout', (f, authority) => { f.table.segmentStrideFloats = 8; return authority; }]
]) {
  test(`private admission rejects ${name}`, () => {
    const f = fixture(), authority = create(f);
    const candidate = mutate(f, authority);
    assert.throws(() => resolve(f, candidate), /Gas caloric authority/);
    assert.throws(() => validateSphSpatialGasCaloricAuthority(candidate, { thermalMaterialTable: f.table }), /Gas caloric authority/);
  });
}

for (const [name, mutate] of [
  ['missing models', (f) => { f.models = undefined; }],
  ['empty models', (f) => { f.models = {}; }],
  ['copied model', (f) => { f.models.h2o = structuredClone(f.models.h2o); }],
  ['unknown material', (f) => { f.models.missing = f.models.h2o; }],
  ['duplicate material ID', (f) => { f.table.records[8] = f.table.records[0]; }],
  ['duplicate model alias', (f) => { f.models.H2O = f.models.h2o; }],
  ['legacy model enrollment', (f) => { f.table = buildSphThermalMaterialTable(f.properties); }],
  ['wrong thermal schema', (f) => { f.table.schema = 'legacy-like'; }],
  ['truncated segments', (f) => { f.table.segments = f.table.segments.slice(0, -1); }],
  ['wrong explicit M', (f) => { f.models.h2o = createCondensableThermodynamics({ ...f.records.h2o, molarMassKgPerMol: 0.03 }); }],
  ['wrong explicit Cp', (f) => { f.models.h2o = createCondensableThermodynamics({ ...f.records.h2o, vaporCpJPerKgK: 3000 }); }],
  ['wrong U zero', (f) => { f.models.h2o = createCondensableThermodynamics({ ...f.records.h2o, liquidReferenceEnthalpyJPerKg: 0 }); }],
  ['wrong provenance', (f) => { f.models.h2o = createCondensableThermodynamics({ ...f.records.h2o, provenance: 'unrelated source' }); }],
  ['wrong branch', (f) => { const i = f.table.metadata.find((m) => m.material === 'h2o').segmentOffset; f.table.segments[i * 12 + 2] = 3; }],
  ['wrong graph source metadata', (f) => { const i = f.table.metadata.find((m) => m.material === 'h2o').segmentOffset;
    f.table.segmentMetadata[i].debyeTemperatureK = 500; f.table.segmentMetadata[i].molarMassKgPerMol = 0.02; }],
  ['missing model metadata', (f) => { delete f.table.metadata.find((m) => m.material === 'h2o').caloricInitializationProperties; }],
  ['cold accessor', (f) => { Object.defineProperty(f.table, 'accessor', { get() { throw new Error('must not execute accessor'); } }); }],
  ['model accessor', (f) => { Object.defineProperty(f.models, 'h2o', { get() { throw new Error('must not execute model accessor'); } }); }],
  ['shared array storage', (f) => { const rows = new Float32Array(new SharedArrayBuffer(f.table.records.byteLength)); rows.set(f.table.records); f.table.records = rows; }]
]) {
  test(`cold compiler rejects ${name}`, () => {
    const f = fixture(); mutate(f);
    assert.throws(() => create(f));
  });
}

test('a selected subset admits only its rows even when another explicit model exists in the thermal table', () => {
  const f = fixture(); delete f.models.h2;
  const packed = resolve(f, create(f));
  assert.equal(packed.materialCount, 1);
  assert.equal(gasRow(packed, 'h2'), null);
});

test('packed centered-U coefficients independently recover energy T, not mole-weighted T, across gauges', () => {
  const specimens = [{ material: 'h2o', mass: 0.2, temperature: 280 }, { material: 'h2', mass: 0.03, temperature: 340 }];
  const physical = specimens.map((s) => ({ ...s, p: modelRecord(s.material) }));
  const capacity = physical.reduce((sum, s) => sum + s.mass * (s.p.vaporCpJPerKgK - R / s.p.molarMassKgPerMol), 0);
  const expected = physical.reduce((sum, s) => sum + s.mass
    * (s.p.vaporCpJPerKgK - R / s.p.molarMassKgPerMol) * s.temperature, 0) / capacity;
  const moleT = physical.reduce((sum, s) => sum + s.mass / s.p.molarMassKgPerMol * s.temperature, 0)
    / physical.reduce((sum, s) => sum + s.mass / s.p.molarMassKgPerMol, 0);
  assert.ok(Math.abs(expected - moleT) > 10);
  for (const shifts of [{}, { h2o: -1_000_000, h2: 500_000 }]) {
    const f = fixture(shifts), packed = resolve(f, create(f));
    let centered = 0, packedCapacity = 0;
    const anchor = 280;
    for (const s of specimens) {
      const row = gasRow(packed, s.material);
      // Independent affine endpoint arithmetic on the real compiled data;
      // not a CPU implementation/oracle for the WGSL member validator.
      const u = Math.fround(row[3] + (s.temperature - row[5]) * (row[4] - row[3]) / (row[6] - row[5]));
      centered += s.mass * ((u - row[3]) - row[2] * (anchor - row[5]));
      packedCapacity += s.mass * row[2];
    }
    near(packedCapacity, capacity, 0.001, 'compiled heat capacity');
    near(anchor + centered / packedCapacity, expected, 0.0005, 'gauge-independent caloric T');
  }
});

test('decoder distinguishes admitted calorics from exchange authority and clears unavailable quantities', () => {
  const decoded = decodeSphSpatialGasCaloricAdmissionRows(new Float32Array([
    100, 1000, 300, 310, 200, 450, 2, 1,
    0, 0, 0, 0, 0, 0, 0, 8
  ]));
  assert.equal(Object.isFrozen(decoded), true);
  assert.equal(Object.isFrozen(decoded[0]), true);
  assert.equal(decoded[0].heatCapacityJPerK, 100);
  assert.equal(decoded[0].equilibriumTemperatureK, 310);
  assert.equal(decoded[0].caloricClosureAdmitted, true);
  assert.equal(decoded[0].exchangeIntervalAdmitted, false);
  assert.equal(decoded[1].ready, false);
  for (const key of ['heatCapacityJPerK', 'centeredEnergyJ', 'anchorTemperatureK', 'equilibriumTemperatureK',
    'minDomainTemperatureK', 'maxDomainTemperatureK', 'memberCount']) assert.equal(decoded[1][key], null);
});

for (const [name, index, value] of [
  ['nonfinite capacity', 0, NaN], ['zero capacity', 0, 0], ['nonfinite centered energy', 1, Infinity],
  ['nonfinite anchor', 2, NaN], ['out-of-domain T', 3, 500], ['inverted domain', 4, 460],
  ['zero members', 6, 0], ['fractional members', 6, 1.5], ['nonfinite status', 7, NaN],
  ['ready mixed with error', 7, 3]
]) {
  test(`decoder refuses ${name} instead of exposing an admitted state`, () => {
    const rows = new Float32Array([100, 1000, 300, 310, 200, 450, 2, 1]); rows[index] = value;
    assert.throws(() => decodeSphSpatialGasCaloricAdmissionRows(rows));
  });
}
test('decoder refuses incomplete rows', () => assert.throws(() => decodeSphSpatialGasCaloricAdmissionRows(new Float32Array(7))));

test('optional WGSL uses raw compact16 U/T and separate data/output bindings with fixed budgets', () => {
  assert.match(sphSpatialGasCaloricAdmissionWgsl, /@binding\(12\).*read> gas_caloric_materials/);
  assert.match(sphSpatialGasCaloricAdmissionWgsl, /@binding\(13\).*read_write> gas_caloric_cells/);
  for (const helper of ['gas_caloric_empty', 'gas_caloric_add', 'gas_caloric_write']) {
    assert.ok(sphSpatialGasCaloricAdmissionWgsl.includes(`fn ${helper}(`));
  }
  assert.match(sphSpatialGasCaloricAdmissionWgsl, /compact_rows\[row \+ 12u\]/);
  assert.match(sphSpatialGasCaloricAdmissionWgsl, /compact_rows\[row \+ 13u\]/);
  assert.doesNotMatch(sphSpatialGasCaloricAdmissionWgsl, /compact_rows\[row \+ 6u\]/);
  assert.match(sphSpatialGasCaloricAdmissionWgsl, /max\(1\.0e-4, t_hi \* 1\.0e-6\)/);
  assert.equal(SPH_SPATIAL_GAS_CALORIC_MOLAR_MASS_RELATIVE_BUDGET, 1e-5);
  assert.match(sphSpatialGasCaloricAdmissionWgsl, /1\.0e-5 \* max\(mass, expected_mass\)/);
  assert.match(sphSpatialGasCaloricAdmissionWgsl, /centered_u = above_lo - anchor_above_lo/);
});
