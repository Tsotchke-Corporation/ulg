import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SPH_ENVIRONMENT_DRY_AIR,
  SPH_ENVIRONMENT_HUMIDITY_CONVENTION,
  createSphRoomAirInitialization,
  normalizeSphEnvironmentInitialization,
  buildSphEnvironmentGasInputs
} from '../src/runtime/sphEnvironmentInitialization.js';
import {
  CONDENSABLE_THERMODYNAMICS_SCHEMA,
  createCondensableThermodynamics
} from '../src/runtime/material/condensableThermodynamics.js';

const R = 8.314462618;
// Manufactured material with an independently calculable reference state.
// These are test coefficients, not a water or room-air calibration.
const water = createCondensableThermodynamics({
  schema: CONDENSABLE_THERMODYNAMICS_SCHEMA,
  energyBasis: 'specific-enthalpy-at-reference-pressure',
  referenceTemperatureK: 300, referencePressurePa: 2000,
  liquidReferenceEnthalpyJPerKg: 10000, vaporizationReferenceEnthalpyJPerKg: 2000000,
  liquidCpJPerKgK: 4180, vaporCpJPerKgK: 2000, liquidDensityKgPerM3: 1000,
  molarMassKgPerMol: R / 400, minTemperatureK: 200, maxTemperatureK: 500,
  maxPressurePa: 2000000, provenance: 'Manufactured environment initialization fixture'
});
const masses = { n2: 0.028, o2: 0.032, ar: 0.040, co2: 0.044 };
const dryGasCaloricModels = Object.fromEntries(Object.entries(masses).map(([material, molarMassKgPerMol], i) => [material, {
  molarMassKgPerMol, cvJPerKgK: 700 + i * 100,
  referenceTemperatureK: 280, referenceSpecificInternalEnergyJPerKg: -10000 + i * 10000,
  minTemperatureK: 200, maxTemperatureK: 500, maxPressurePa: 2000000,
  provenance: `Manufactured ${material} caloric input`
}]));
const environment = (overrides = {}) => createSphRoomAirInitialization({
  temperatureK: 300, totalPressurePa: 100000, ...overrides
});
const compile = (init = environment(), extra = {}) => buildSphEnvironmentGasInputs({
  environment: init, freeVolumeM3: 0.125, waterThermodynamics: water, dryGasCaloricModels, ...extra
});
function near(actual, expected, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(Math.abs(expected) * 3e-15, 1e-300),
    `${label}: ${actual} != ${expected}`);
}
const seed = () => ({
  material: 'synthetic-solute', densityKgPerM3: 2000,
  sizeDistribution: [{ dryRadiusM: 40e-9, numberFraction: 0.25 }, { dryRadiusM: 80e-9, numberFraction: 0.75 }],
  initialHydration: 'dry', provenance: 'Manufactured dry seed inputs; not a calibrated population',
  activationModel: { id: 'synthetic-test-domain', provenance: 'Declared test domain only',
    minTemperatureK: 250, maxTemperatureK: 320, minRelativeHumidity: 0, maxRelativeHumidity: 0.9 }
});

test('room-air reference has explicit physical units, zero-nuclei control and clone-safe immutable inputs', () => {
  const value = createSphRoomAirInitialization();
  assert.equal(value.temperatureK, 293.15);
  assert.equal(value.totalPressurePa, 101325);
  assert.equal(value.relativeHumidity, 0.5);
  assert.deepEqual(value.meanVelocityMPerS, [0, 0, 0]);
  assert.equal(value.nuclei.numberConcentrationPerM3, 0);
  assert.equal(value.humidityConvention, SPH_ENVIRONMENT_HUMIDITY_CONVENTION);
  assert.deepEqual(normalizeSphEnvironmentInitialization(structuredClone(value)), value);
  assert.deepEqual(normalizeSphEnvironmentInitialization(JSON.parse(JSON.stringify(value))), value);
  assert.throws(() => { value.meanVelocityMPerS[0] = 1; }, TypeError);
  assert.throws(() => { value.nuclei.numberConcentrationPerM3 = 1; }, TypeError);
});

test('dry-air input names individual chemical species and documents omitted traces and normalization', () => {
  assert.deepEqual(SPH_ENVIRONMENT_DRY_AIR.species.map((s) => s.material), ['n2', 'o2', 'ar', 'co2']);
  near(SPH_ENVIRONMENT_DRY_AIR.referenceMoleFractionSum, 0.999970, 'un-normalized major fraction');
  near(SPH_ENVIRONMENT_DRY_AIR.species.reduce((sum, row) => sum + row.moleFraction, 0), 1, 'normalized dry fraction');
  near(SPH_ENVIRONMENT_DRY_AIR.species[1].moleFraction, 0.209390 / 0.999970, 'oxygen fraction');
  assert.ok(SPH_ENVIRONMENT_DRY_AIR.omittedSpecies.includes('ch4'));
});

test('physical free volume and shared saturation/caloric reference determine humidity inventory', () => {
  const value = compile();
  const vaporP = 1000 * Math.exp(98000 / (1000 * 400 * 300));
  const vapor = value.gasSpecies.find((row) => row.material === 'h2o');
  near(vapor.partialPressurePa, vaporP, 'planar-liquid RH including pressure correction');
  near(vapor.moles, vaporP * 0.125 / (R * 300), 'vapor moles');
  near(vapor.massKg, vaporP * 0.125 / (400 * 300), 'vapor mass');
  near(vapor.specificInternalEnergyJPerKg, 1890000, 'vapor U at reference T');
  near(vapor.internalEnergyJ, vapor.massKg * 1890000, 'vapor extensive U');
  near(value.gasSpecies.reduce((sum, row) => sum + row.partialPressurePa, 0), 100000, 'partial pressures');
  near(value.gasSpecies.reduce((sum, row) => sum + row.moles, 0), 100000 * 0.125 / (R * 300), 'total pV/RT');
  value.gasSpecies.slice(0, 4).forEach((row, i) => {
    near(row.partialPressurePa, (100000 - vaporP) * SPH_ENVIRONMENT_DRY_AIR.species[i].moleFraction, 'dry partial pressure');
    near(row.massKg, row.moles * masses[row.material], 'species mass');
    near(row.specificInternalEnergyJPerKg, (-10000 + i * 10000) + (700 + i * 100) * 20, 'declared dry U');
    assert.equal(row.phase, 'gas');
  });
  near(value.totalGasMassKg, value.gasSpecies.reduce((sum, row) => sum + row.massKg, 0), 'total mass');
  near(value.totalGasInternalEnergyJ, value.gasSpecies.reduce((sum, row) => sum + row.internalEnergyJ, 0), 'total internal energy');
  assert.deepEqual(JSON.parse(JSON.stringify(value)), value);
});

test('gas mass, internal energy and moles scale with actual free volume without changing intensive state', () => {
  const small = compile(), large = compile(environment(), { freeVolumeM3: 0.5 });
  small.gasSpecies.forEach((row, i) => {
    for (const key of ['massKg', 'internalEnergyJ', 'moles']) assert.equal(large.gasSpecies[i][key], 4 * row[key]);
    for (const key of ['temperatureK', 'partialPressurePa', 'specificInternalEnergyJPerKg']) assert.equal(large.gasSpecies[i][key], row[key]);
  });
});

test('a zero-nuclei comparison retains identical air, humidity, energy and mean velocity', () => {
  const input = { numberConcentrationPerM3: 1e8, seed: seed() };
  const withNuclei = environment({ nuclei: input, meanVelocityMPerS: [0.5, -0.25, 0.125] });
  const withoutNuclei = normalizeSphEnvironmentInitialization({ ...withNuclei,
    nuclei: { ...withNuclei.nuclei, numberConcentrationPerM3: 0 } });
  const a = compile(withNuclei), b = compile(withoutNuclei);
  assert.deepEqual(a.gasSpecies, b.gasSpecies);
  assert.equal(a.totalGasMassKg, b.totalGasMassKg);
  assert.equal(a.totalGasInternalEnergyJ, b.totalGasInternalEnergyJ);
  assert.equal(a.gasSpecies.at(-1).material, 'h2o');
  input.seed.sizeDistribution[0].dryRadiusM = 1;
  assert.equal(withNuclei.nuclei.seed.sizeDistribution[0].dryRadiusM, 40e-9);
  assert.equal(withNuclei.nuclei.seed.initialHydration, 'dry');
});

test('dry air and vacuum require no water model and create no phantom vapor rows', () => {
  const dry = compile(environment({ relativeHumidity: 0 }), { waterThermodynamics: null });
  assert.equal(dry.gasSpecies.length, 4);
  near(dry.gasSpecies.reduce((sum, row) => sum + row.partialPressurePa, 0), 100000, 'dry pressure');
  const vacuum = environment({ mode: 'vacuum', totalPressurePa: 0, relativeHumidity: 0 });
  const value = buildSphEnvironmentGasInputs({ environment: vacuum, freeVolumeM3: 0 });
  assert.deepEqual(value.gasSpecies, []);
  assert.equal(value.totalGasMassKg, 0);
  assert.equal(value.totalGasInternalEnergyJ, 0);
});

test('invalid physical inputs never silently become defaults, zero, or vacuum', () => {
  for (const overrides of [
    { temperatureK: '293.15' }, { temperatureK: null }, { temperatureK: 0 },
    { totalPressurePa: -1 }, { totalPressurePa: 0 }, { totalPressurePa: NaN },
    { relativeHumidity: -0.1 }, { relativeHumidity: 50 }, { relativeHumidity: Infinity },
    { meanVelocityMPerS: [0, 0] }, { meanVelocityMPerS: [0, NaN, 0] },
    { meanVelocityMPerS: Array(3) }, { provenance: '' }, { mode: 'infinite-reservoir' },
    { temperature: 300 }, { humidityConvention: 'optical-fit' }, { dryAirComposition: 'air-lumped-inert' },
    { mode: 'vacuum', totalPressurePa: 0 },
    { mode: 'vacuum', totalPressurePa: 0, relativeHumidity: 0, meanVelocityMPerS: [1, 0, 0] }
  ]) assert.throws(() => environment(overrides), undefined, JSON.stringify(overrides));
});

test('nuclei require physical dry sizes, material, normalized population, hydration and a declared model domain', () => {
  assert.throws(() => environment({ nuclei: { numberConcentrationPerM3: 1 } }), /dry seed inputs/);
  for (const edit of [
    (s) => { s.material = ''; }, (s) => { s.densityKgPerM3 = 0; },
    (s) => { s.sizeDistribution[0].numberFraction = 0.5; },
    (s) => { s.sizeDistribution[1].dryRadiusM = -1; },
    (s) => { s.sizeDistribution = Array(2); },
    (s) => { s.initialHydration = 'visible-water-droplets'; },
    (s) => { s.activationModel.provenance = ''; },
    (s) => { s.activationModel.minTemperatureK = 301; },
    (s) => { s.activationModel.maxRelativeHumidity = 0.4; }
  ]) {
    const input = seed(); edit(input);
    assert.throws(() => environment({ nuclei: { numberConcentrationPerM3: 1, seed: input } }));
  }
});

test('humidity rejects an absent or copied model and impossible vapor/dry-pressure allocation', () => {
  assert.throws(() => compile(environment(), { waterThermodynamics: null }), /water thermodynamics/);
  assert.throws(() => compile(environment(), { waterThermodynamics: { ...water } }), /water thermodynamics/);
  assert.throws(() => compile(environment({ temperatureK: 501 })), /domain/);
  assert.throws(() => compile(environment({ totalPressurePa: 500 })), /dry-air pressure/);
});

test('missing or invalid species models, volume and unrepresentable extensive inputs are rejected', () => {
  for (const value of [-1, NaN, Infinity, '1', 0]) assert.throws(() => compile(environment(), { freeVolumeM3: value }));
  const missingOxygen = { ...dryGasCaloricModels }; delete missingOxygen.o2;
  assert.throws(() => compile(environment(), { dryGasCaloricModels: missingOxygen }), /o2/);
  for (const [key, value] of [['cvJPerKgK', 0], ['molarMassKgPerMol', 0], ['maxPressurePa', 90000],
    ['minTemperatureK', 301], ['referenceSpecificInternalEnergyJPerKg', NaN]]) {
    assert.throws(() => compile(environment(), { dryGasCaloricModels: { ...dryGasCaloricModels,
      o2: { ...dryGasCaloricModels.o2, [key]: value } } }));
  }
  assert.throws(() => compile(environment(), { freeVolumeM3: Number.MAX_VALUE }), /finite/);
  assert.throws(() => compile(environment({ totalPressurePa: Number.MIN_VALUE, relativeHumidity: 0 })), /positive/);
  assert.throws(() => compile(environment(), { dryGasCaloricModels: { ...dryGasCaloricModels,
    o2: { ...dryGasCaloricModels.o2, referenceTemperatureK: 300,
      referenceSpecificInternalEnergyJPerKg: Number.MIN_VALUE } } }), /underflows/);
});
