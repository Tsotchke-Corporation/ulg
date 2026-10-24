import assert from 'node:assert/strict';
import test from 'node:test';
import { createCondensableThermodynamics } from '../src/runtime/material/condensableThermodynamics.js';
import {
  createCondensableFiniteCellModel,
  initializeCondensableFiniteCell,
  inspectCondensableFiniteCell,
  evaluateCondensableFiniteCellRates,
  advanceCondensableFiniteCell
} from '../src/runtime/material/condensableFiniteCell.js';

// Manufactured closed, rigid-cell Onsager reference. These tests are not a
// calibrated atmospheric/Knudsen transport model, a nucleus choice, a live SS
// enrollment, or permission to substitute CPU state for resident GPU physics.
const R = 8.314462618;
const thermoRecord = (overrides = {}) => ({
  schema: 'peercompute.ulg.condensable-thermodynamics.v1',
  energyBasis: 'specific-enthalpy-at-reference-pressure',
  referenceTemperatureK: 256,
  referencePressurePa: 4096,
  liquidReferenceEnthalpyJPerKg: -10_000,
  vaporizationReferenceEnthalpyJPerKg: 262_144,
  liquidCpJPerKgK: 1024,
  vaporCpJPerKgK: 512,
  liquidDensityKgPerM3: 1024,
  molarMassKgPerMol: R / 128,
  minTemperatureK: 200,
  maxTemperatureK: 400,
  maxPressurePa: 2_000_000,
  provenance: 'manufactured constant-capacity two-phase substance; not water',
  ...overrides
});
const inertRecord = (overrides = {}) => ({
  id: 'inert-a', molarMassKgPerMol: R / 256, cvJPerKgK: 512,
  heatTransferCoefficientWPerM2K: 2,
  minTemperatureK: 200, maxTemperatureK: 400,
  provenance: 'manufactured inert ideal gas; not assumed air', ...overrides
});
const modelRecord = (thermo = thermoRecord(), overrides = {}) => ({
  schema: 'peercompute.ulg.condensable-finite-cell-reference.v1',
  thermodynamics: createCondensableThermodynamics(thermo),
  surface: { interceptNPerM: 0.125, slopeNPerMK: -1 / 4096,
    provenance: 'manufactured linear positive sigma, with separate U=a*A' },
  massMobilityPerAreaKg2KPerJsM2: 1e-5,
  vaporHeatTransferCoefficientWPerM2K: 1,
  noncondensables: [], maxAbsAffinityJPerKgK: 100,
  maxTemperatureDifferenceK: 50,
  provenance: 'manufactured positive Onsager matrix; not fitted kinetics', ...overrides
});
const inputRecord = (overrides = {}) => ({
  freeGasVolumeM3: 1 / 1024,
  vapor: { massKg: 1 / 8192, temperatureK: 264 },
  droplets: [{ id: 'drop-a', massKg: 1 / 64, temperatureK: 256, physicalDropletCount: 8n }],
  noncondensables: [], ...overrides
});
function near(actual, expected, label, relative = 3e-11, absolute = 1e-12) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${label}: nonfinite value`);
  assert.ok(Math.abs(actual - expected) <= absolute + relative * Math.abs(expected),
    `${label}: ${actual} versus independent ${expected}`);
}

// Independent integer comparison/summation of the exposed authoritative
// coefficient/exponent fields. Conservation assertions do not compare rounded
// totals or merely trust the runtime's own dyadicEqual/conservation flag.
function exactSum(values) {
  const exponent = Math.min(...values.map((v) => v.exponent));
  return { coefficient: values.reduce((s, v) => s + (v.coefficient << BigInt(v.exponent - exponent)), 0n), exponent };
}
const negate = (value) => ({ coefficient: -value.coefficient, exponent: value.exponent });
const difference = (a, b) => exactSum([a, negate(b)]);
function sameExact(actual, expected, label) {
  assert.equal(difference(actual, expected).coefficient, 0n, label);
}
function differentExact(actual, expected, label) {
  assert.notEqual(difference(actual, expected).coefficient, 0n, label);
}
const inventoryRows = (s) => [s.vapor, ...s.noncondensables, ...s.droplets];
function assertConserved(before, after) {
  sameExact(exactSum(inventoryRows(before).map((r) => r.massInventory)),
    exactSum(inventoryRows(after).map((r) => r.massInventory)), 'independent exact mass across every owner');
  sameExact(exactSum(inventoryRows(before).map((r) => r.energyInventory)),
    exactSum(inventoryRows(after).map((r) => r.energyInventory)), 'independent exact energy including liquid surfaces');
  sameExact(after.totalMassInventory, exactSum(inventoryRows(after).map((r) => r.massInventory)), 'reported total mass matches owners');
  sameExact(after.totalEnergyInventory, exactSum(inventoryRows(after).map((r) => r.energyInventory)), 'reported total energy matches owners');
  for (const original of before.noncondensables) {
    const next = after.noncondensables.find(({ id }) => id === original.id);
    sameExact(original.massInventory, next.massInventory, 'inert mass is not a source of condensate');
  }
}

function independentGeometry(thermo, surface, row) {
  const radius = Math.cbrt(3 * row.massKg / (4 * Math.PI * thermo.liquidDensityKgPerM3 * Number(row.physicalDropletCount)));
  const area = 4 * Math.PI * Number(row.physicalDropletCount) * radius ** 2;
  return { radius, area, sigma: surface.interceptNPerM + surface.slopeNPerMK * row.temperatureK };
}
function phasePotentials(thermo, vaporT, vaporP, liquidT, liquidP) {
  const t0 = thermo.referenceTemperatureK, p0 = thermo.referencePressurePa;
  const rs = R / thermo.molarMassKgPerMol;
  const deltaU0 = thermo.vaporizationReferenceEnthalpyJPerKg - rs * t0 + p0 / thermo.liquidDensityKgPerM3;
  const hv = (t) => deltaU0 + (thermo.vaporCpJPerKgK - rs) * (t - t0) + rs * t;
  const sv = thermo.vaporizationReferenceEnthalpyJPerKg / t0 + thermo.vaporCpJPerKgK * Math.log(vaporT / t0)
    - rs * Math.log(vaporP / p0);
  const sl = thermo.liquidCpJPerKgK * Math.log(liquidT / t0);
  const hl = thermo.liquidCpJPerKgK * (liquidT - t0) + liquidP / thermo.liquidDensityKgPerM3;
  return { muV: hv(vaporT) - vaporT * sv, muL: hl - liquidT * sl,
    transferredEnthalpy: hv((vaporT + liquidT) / 2) };
}
function independentInitialRates(thermo, record, input) {
  const gases = [{ ...input.vapor, id: 'vapor', rs: R / thermo.molarMassKgPerMol,
    heat: record.vaporHeatTransferCoefficientWPerM2K },
  ...record.noncondensables.map((gas) => ({ ...input.noncondensables.find(({ id }) => id === gas.id),
    rs: R / gas.molarMassKgPerMol, heat: gas.heatTransferCoefficientWPerM2K }))];
  for (const gas of gases) gas.pressure = gas.massKg * gas.rs * gas.temperatureK / input.freeGasVolumeM3;
  const totalPressure = gases.reduce((s, g) => s + g.pressure, 0);
  let entropy = 0;
  const droplets = input.droplets.map((row) => {
    const geo = independentGeometry(thermo, record.surface, row);
    const liquidPressure = totalPressure + 2 * geo.sigma / geo.radius;
    const { muV, muL, transferredEnthalpy: e } = phasePotentials(thermo, input.vapor.temperatureK,
      gases[0].pressure, row.temperatureK, liquidPressure);
    const force = muV / input.vapor.temperatureK - muL / row.temperatureK
      + e * (1 / row.temperatureK - 1 / input.vapor.temperatureK);
    const mobility = geo.area * record.massMobilityPerAreaKg2KPerJsM2;
    const massRate = mobility * force;
    entropy += mobility * force ** 2;
    const energyRates = gases.map((gas, index) => {
      const deltaT = gas.temperatureK - row.temperatureK;
      const heat = geo.area * gas.heat * deltaT;
      entropy += heat * (1 / row.temperatureK - 1 / gas.temperatureK);
      return (index === 0 ? e * massRate : 0) + heat - gas.pressure * massRate / thermo.liquidDensityKgPerM3;
    });
    return { id: row.id, force, massRate, energyRates, geo, liquidPressure };
  });
  return { droplets, entropy, totalPressure, gases };
}
function totalEntropy(thermo, record, snapshot) {
  const t0 = thermo.referenceTemperatureK, p0 = thermo.referencePressurePa;
  let entropy = snapshot.vapor.massKg * (thermo.vaporizationReferenceEnthalpyJPerKg / t0
    + thermo.vaporCpJPerKgK * Math.log(snapshot.vapor.temperatureK / t0)
    - (R / thermo.molarMassKgPerMol) * Math.log(snapshot.vapor.partialPressurePa / p0));
  for (const row of snapshot.droplets) {
    const { area } = independentGeometry(thermo, record.surface, row);
    entropy += row.massKg * thermo.liquidCpJPerKgK * Math.log(row.temperatureK / t0)
      - record.surface.slopeNPerMK * area;
  }
  for (const row of snapshot.noncondensables) {
    const model = record.noncondensables.find(({ id }) => id === row.id), rs = R / model.molarMassKgPerMol;
    entropy += row.massKg * ((model.cvJPerKgK + rs) * Math.log(row.temperatureK / t0)
      - rs * Math.log(row.partialPressurePa / p0));
  }
  return entropy;
}

test('created finite-cell state snapshots explicit inventories and declines live/runtime authority', () => {
  const thermo = thermoRecord(), record = modelRecord(thermo), model = createCondensableFiniteCellModel(record);
  const input = inputRecord(), sourceInput = structuredClone(input);
  const state = initializeCondensableFiniteCell(model, input), snapshot = inspectCondensableFiniteCell(state);
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(state.runtimeAdmissible, false);
  assert.equal(state.referenceOnly, true);
  assert.equal(model.liveStateEnrollment, false);
  assert.equal(model.scientificValidation, false);
  for (const value of [snapshot, snapshot.vapor, snapshot.droplets, snapshot.droplets[0],
    snapshot.vapor.massInventory, snapshot.vapor.energyInventory]) assert.equal(Object.isFrozen(value), true);
  assert.equal(snapshot.timeS, 0);
  near(snapshot.volumeM3, input.freeGasVolumeM3, 'input volume means free gas, not total vessel volume');
  near(snapshot.vapor.massKg, input.vapor.massKg, 'explicit vapor mass');
  near(snapshot.vapor.temperatureK, input.vapor.temperatureK, 'actual vapor temperature');
  near(snapshot.droplets[0].temperatureK, input.droplets[0].temperatureK, 'no instant gas/liquid equilibration');
  const geometry = independentGeometry(thermo, record.surface, input.droplets[0]);
  near(snapshot.droplets[0].surfaceEnergyJ, record.surface.interceptNPerM * geometry.area, 'separate surface U=a*A');
  input.vapor.massKg = 9; input.droplets[0].physicalDropletCount = 99n;
  record.surface.interceptNPerM = 999;
  assert.deepEqual(inspectCondensableFiniteCell(state), snapshot, 'caller mutation cannot rebase an existing exact state');
  assert.notDeepEqual(input, sourceInput);
});

test('instantaneous Onsager mass, all-species heat and pressure work match independent chemical potentials', () => {
  const thermo = thermoRecord(), inerts = [inertRecord(), inertRecord({ id: 'inert-b',
    molarMassKgPerMol: R / 64, cvJPerKgK: 256, heatTransferCoefficientWPerM2K: 3 })];
  const record = modelRecord(thermo, { noncondensables: inerts });
  const input = inputRecord({
    droplets: [{ id: 'drop-a', massKg: 1 / 64, temperatureK: 256, physicalDropletCount: 8n },
      { id: 'drop-b', massKg: 1 / 128, temperatureK: 258, physicalDropletCount: 4n }],
    noncondensables: [{ id: 'inert-b', massKg: 1 / 32768, temperatureK: 272 },
      { id: 'inert-a', massKg: 1 / 16384, temperatureK: 248 }]
  });
  const state = initializeCondensableFiniteCell(createCondensableFiniteCellModel(record), input);
  const snapshot = inspectCondensableFiniteCell(state), rates = evaluateCondensableFiniteCellRates(state);
  const expected = independentInitialRates(thermo, record, input);
  near(snapshot.pressurePa, expected.totalPressure, 'actual mixture pressure at each actual T');
  for (const row of expected.droplets) {
    const actual = rates.droplets.find(({ id }) => id === row.id);
    near(actual.affinityJPerKgK, row.force, `${row.id} chemical-potential conjugate force`, 1e-10, 1e-10);
    near(actual.massRateKgPerS, row.massRate, `${row.id} finite nonnegative mobility law`, 1e-10, 1e-18);
    assert.equal(actual.energyRatesIntoDropletW.length, expected.gases.length);
    row.energyRates.forEach((energy, index) => near(actual.energyRatesIntoDropletW[index], energy,
      `${row.id}/${expected.gases[index].id}: own heat and partial-pressure work`, 1e-10, 1e-12));
  }
  near(rates.entropyProductionWPerK, expected.entropy, 'conjugate-force entropy production', 1e-10, 1e-13);
  assert.ok(rates.entropyProductionWPerK > 0);
});

test('heat-insulating inerts still receive their own reversible compression work during growth', () => {
  const thermo = thermoRecord(), record = modelRecord(thermo, {
    vaporHeatTransferCoefficientWPerM2K: 0,
    noncondensables: [inertRecord({ heatTransferCoefficientWPerM2K: 0 })]
  });
  const input = inputRecord({ vapor: { massKg: 1 / 8192, temperatureK: 264 },
    noncondensables: [{ id: 'inert-a', massKg: 1 / 16384, temperatureK: 256 }] });
  const source = initializeCondensableFiniteCell(createCondensableFiniteCellModel(record), input);
  const before = inspectCondensableFiniteCell(source), rates = evaluateCondensableFiniteCellRates(source);
  assert.ok(rates.droplets[0].massRateKgPerS > 0, 'manufactured state condenses');
  near(rates.droplets[0].energyRatesIntoDropletW[1],
    -before.noncondensables[0].partialPressurePa * rates.droplets[0].massRateKgPerS / thermo.liquidDensityKgPerM3,
    'inert compression energy is not debited to vapor alone', 2e-12, 1e-15);
  const result = advanceCondensableFiniteCell(source, { durationS: 0.1 });
  assert.equal(result.status, 'completed');
  const after = inspectCondensableFiniteCell(result.state);
  assertConserved(before, after);
  assert.ok(after.noncondensables[0].temperatureK > before.noncondensables[0].temperatureK,
    'inert heats from compression even with zero heat-transfer coefficient');
  assert.ok(after.volumeM3 < before.volumeM3);
});

test('two droplets consume one shared vapor inventory, conserve complete energy, and leave their source immutable', () => {
  const thermo = thermoRecord(), record = modelRecord(thermo, { noncondensables: [inertRecord()] });
  const input = inputRecord({ droplets: [
    { id: 'drop-a', massKg: 1 / 64, temperatureK: 256, physicalDropletCount: 8n },
    { id: 'drop-b', massKg: 1 / 128, temperatureK: 256, physicalDropletCount: 4n }],
  noncondensables: [{ id: 'inert-a', massKg: 1 / 16384, temperatureK: 248 }] });
  const model = createCondensableFiniteCellModel(record), source = initializeCondensableFiniteCell(model, input);
  const before = inspectCondensableFiniteCell(source);
  const result = advanceCondensableFiniteCell(source, { durationS: 0.25 });
  assert.equal(result.status, 'completed');
  assert.equal(result.remainingS, 0);
  assert.equal(result.elapsedS, 0.25);
  assert.equal(result.runtimeAdmissible, false);
  const after = inspectCondensableFiniteCell(result.state);
  assertConserved(before, after);
  const credits = after.droplets.map((row, i) => difference(row.massInventory, before.droplets[i].massInventory));
  assert.ok(credits.every(({ coefficient }) => coefficient > 0n), 'both actual parcels receive condensable mass');
  sameExact(difference(before.vapor.massInventory, after.vapor.massInventory), exactSum(credits), 'one vapor debit equals the combined credits');
  near(after.volumeM3, before.volumeM3 - after.droplets.reduce((s, row, i) => s + row.massKg - before.droplets[i].massKg, 0)
    / thermo.liquidDensityKgPerM3, 'rigid vessel free-volume accounting', 3e-12, 1e-18);
  assert.ok(totalEntropy(thermo, record, after) > totalEntropy(thermo, record, before), 'finite physical trajectory increases complete entropy');
  assert.deepEqual(inspectCondensableFiniteCell(source), before, 'source remains a reusable immutable exact state');
  const reordered = initializeCondensableFiniteCell(model, { ...input, droplets: [...input.droplets].reverse() });
  const reversed = advanceCondensableFiniteCell(reordered, { durationS: 0.25 });
  assert.equal(reversed.status, 'completed');
  const other = inspectCondensableFiniteCell(reversed.state);
  sameExact(other.vapor.massInventory, after.vapor.massInventory, 'source-row order cannot change combined demand');
  sameExact(other.vapor.energyInventory, after.vapor.energyInventory, 'source-row order cannot change gas energy');
  for (const row of after.droplets) {
    const match = other.droplets.find(({ id }) => id === row.id);
    sameExact(row.massInventory, match.massInventory, 'per-parcel mass permutation invariance');
    sameExact(row.energyInventory, match.energyInventory, 'per-parcel energy permutation invariance');
  }
});

test('genuine sub-ULP finite transfer survives even when every visible mass and temperature is unchanged', () => {
  const model = createCondensableFiniteCellModel(modelRecord()), source = initializeCondensableFiniteCell(model, inputRecord());
  const before = inspectCondensableFiniteCell(source);
  assert.ok(evaluateCondensableFiniteCellRates(source).droplets[0].massRateKgPerS > 0);
  const result = advanceCondensableFiniteCell(source, { durationS: 1e-25, minimumStepS: 1e-40 });
  assert.equal(result.status, 'completed');
  const after = inspectCondensableFiniteCell(result.state);
  assertConserved(before, after);
  for (let index = 0; index < inventoryRows(before).length; index += 1) {
    const initial = inventoryRows(before)[index], next = inventoryRows(after)[index];
    assert.equal(next.massKg, initial.massKg, 'display projection can be bitwise unchanged');
    assert.equal(next.temperatureK, initial.temperatureK, 'temperature projection can be bitwise unchanged');
    differentExact(next.energyInventory, initial.energyInventory, 'real energy packet survives display rounding');
  }
  differentExact(after.vapor.massInventory, before.vapor.massInventory, 'nonzero authoritative vapor debit');
  differentExact(after.droplets[0].massInventory, before.droplets[0].massInventory, 'nonzero authoritative liquid credit');
  sameExact(difference(before.vapor.massInventory, after.vapor.massInventory),
    difference(after.droplets[0].massInventory, before.droplets[0].massInventory), 'actual microscopic debit and credit agree exactly');
  const continued = advanceCondensableFiniteCell(result.state, { durationS: 1e-25, minimumStepS: 1e-40 });
  const twice = inspectCondensableFiniteCell(continued.state);
  const firstCredit = difference(after.droplets[0].massInventory, before.droplets[0].massInventory);
  sameExact(difference(twice.droplets[0].massInventory, before.droplets[0].massInventory),
    exactSum([firstCredit, firstCredit]), 'continuation uses original exact inventory, not the rounded snapshot');
});

test('pure heat relaxation agrees with its independent exponential solution and second-order refinement', () => {
  const thermo = thermoRecord(), record = modelRecord(thermo, {
    massMobilityPerAreaKg2KPerJsM2: 0, vaporHeatTransferCoefficientWPerM2K: 8
  });
  const model = createCondensableFiniteCellModel(record), input = inputRecord();
  const initial = initializeCondensableFiniteCell(model, input), initialView = inspectCondensableFiniteCell(initial);
  const area = independentGeometry(thermo, record.surface, input.droplets[0]).area;
  const gasCapacity = input.vapor.massKg * (thermo.vaporCpJPerKgK - R / thermo.molarMassKgPerMol);
  const liquidCapacity = input.droplets[0].massKg * thermo.liquidCpJPerKgK;
  const conductance = 8 * area;
  const equilibrium = (gasCapacity * input.vapor.temperatureK + liquidCapacity * input.droplets[0].temperatureK)
    / (gasCapacity + liquidCapacity);
  const delta = (input.vapor.temperatureK - input.droplets[0].temperatureK)
    * Math.exp(-conductance * (1 / gasCapacity + 1 / liquidCapacity));
  const expectedVapor = equilibrium + liquidCapacity / (gasCapacity + liquidCapacity) * delta;
  const expectedLiquid = equilibrium - gasCapacity / (gasCapacity + liquidCapacity) * delta;
  const errors = [];
  for (const steps of [8, 16, 32]) {
    let state = initial;
    for (let step = 0; step < steps; step += 1) {
      const out = advanceCondensableFiniteCell(state, { durationS: 1 / steps, initialStepS: 1 / steps,
        relativeTolerance: 0.1, absoluteTemperatureToleranceK: 100, maxSteps: 1 });
      assert.equal(out.status, 'completed', 'one prescribed interval passes the explicit loose error gate');
      assert.equal(out.acceptedSteps, 1);
      state = out.state;
    }
    const snapshot = inspectCondensableFiniteCell(state);
    assertConserved(initialView, snapshot);
    sameExact(snapshot.vapor.massInventory, initialView.vapor.massInventory, 'pure heat cannot condense mass');
    sameExact(snapshot.droplets[0].surfaceInventory, initialView.droplets[0].surfaceInventory, 'fixed geometry cannot change surface U');
    near(snapshot.droplets[0].temperatureK, expectedLiquid, 'liquid analytic heat relaxation', 0, 3e-5);
    errors.push(Math.abs(snapshot.vapor.temperatureK - expectedVapor));
  }
  assert.ok(errors[0] > 1e-7, 'coarse manufactured case has measurable integration error');
  assert.ok(errors[0] / errors[1] > 3.5 && errors[0] / errors[1] < 4.6, `first refinement is second-order: ${errors}`);
  assert.ok(errors[1] / errors[2] > 3.5 && errors[1] / errors[2] < 4.6, `second refinement is second-order: ${errors}`);
  const adaptive = advanceCondensableFiniteCell(initial, { durationS: 1, relativeTolerance: 1e-7,
    absoluteTemperatureToleranceK: 1e-8 });
  assert.equal(adaptive.status, 'completed');
  near(inspectCondensableFiniteCell(adaptive.state).vapor.temperatureK, expectedVapor, 'adaptive analytic heat solution', 0, 2e-6);
});

test('same-temperature curved coexistence remains stable with nonzero exchange coefficients', () => {
  const thermo = thermoRecord(), record = modelRecord(thermo), input = inputRecord({
    vapor: { massKg: 1 / 8192, temperatureK: 256 }
  });
  const geo = independentGeometry(thermo, record.surface, input.droplets[0]);
  let vaporPressure = thermo.referencePressurePa;
  for (let i = 0; i < 16; i += 1) vaporPressure = thermo.referencePressurePa * Math.exp(
    (vaporPressure + 2 * geo.sigma / geo.radius - thermo.referencePressurePa)
    / (thermo.liquidDensityKgPerM3 * 128 * 256));
  input.vapor.massKg = vaporPressure * input.freeGasVolumeM3 / (128 * 256);
  const source = initializeCondensableFiniteCell(createCondensableFiniteCellModel(record), input);
  const before = inspectCondensableFiniteCell(source), initialRates = evaluateCondensableFiniteCellRates(source);
  near(initialRates.droplets[0].affinityJPerKgK, 0, 'independently solved curved chemical equilibrium', 0, 1e-10);
  const result = advanceCondensableFiniteCell(source, { durationS: 5 });
  assert.equal(result.status, 'completed');
  const after = inspectCondensableFiniteCell(result.state);
  assertConserved(before, after);
  near(after.vapor.massKg, before.vapor.massKg, 'equilibrium mass remains stable', 1e-10, 1e-18);
  near(after.vapor.temperatureK, 256, 'equilibrium vapor temperature', 0, 1e-9);
  near(after.droplets[0].temperatureK, 256, 'equilibrium liquid temperature', 0, 1e-9);
});

test('nonbinary lower temperature endpoint survives exact initialization and recovery', () => {
  const thermo = thermoRecord({ referenceTemperatureK: 300, minTemperatureK: 50.1 });
  const record = modelRecord(thermo, { massMobilityPerAreaKg2KPerJsM2: 0,
    vaporHeatTransferCoefficientWPerM2K: 0 });
  const input = inputRecord({ vapor: { massKg: 1 / 8192, temperatureK: 50.1 },
    droplets: [{ id: 'cold', massKg: 1 / 64, temperatureK: 50.1, physicalDropletCount: 8n }] });
  const geo = independentGeometry(thermo, record.surface, input.droplets[0]);
  let pressure = thermo.referencePressurePa;
  // Independent Gibbs-potential equality locates an in-domain cold vapor;
  // the test isolates caloric serialization, not a far-from-equilibrium fit.
  for (let i = 0; i < 16; i++) {
    const potentials = phasePotentials(thermo, 50.1, pressure, 50.1, pressure + 2 * geo.sigma / geo.radius);
    pressure *= Math.exp((potentials.muL - potentials.muV) / (128 * 50.1));
  }
  input.vapor.massKg = pressure * input.freeGasVolumeM3 / (128 * 50.1);
  assert.notEqual(300 + (50.1 - 300), 50.1, 'original two-rounded-operations witness');
  const source = initializeCondensableFiniteCell(createCondensableFiniteCellModel(record), input);
  const before = inspectCondensableFiniteCell(source);
  assert.equal(before.vapor.temperatureK, 50.1);
  assert.equal(before.droplets[0].temperatureK, 50.1);
  const result = advanceCondensableFiniteCell(source, { durationS: 1 });
  assert.equal(result.status, 'completed');
  const after = inspectCondensableFiniteCell(result.state);
  assert.equal(after.vapor.temperatureK, 50.1);
  assert.equal(after.droplets[0].temperatureK, 50.1);
  assertConserved(before, after);
});

test('finite evaporation returns mass to vapor and pays its surface and cooling energy', () => {
  const input = inputRecord({ vapor: { massKg: 1 / 16384, temperatureK: 264 } });
  const source = initializeCondensableFiniteCell(createCondensableFiniteCellModel(modelRecord()), input);
  const before = inspectCondensableFiniteCell(source);
  assert.ok(evaluateCondensableFiniteCellRates(source).droplets[0].massRateKgPerS < 0);
  const result = advanceCondensableFiniteCell(source, { durationS: 0.1 });
  assert.equal(result.status, 'completed');
  const after = inspectCondensableFiniteCell(result.state);
  assertConserved(before, after);
  assert.ok(after.vapor.massKg > before.vapor.massKg);
  assert.ok(after.droplets[0].massKg < before.droplets[0].massKg);
  assert.ok(after.droplets[0].temperatureK < before.droplets[0].temperatureK);
  assert.ok(after.droplets[0].surfaceEnergyJ < before.droplets[0].surfaceEnergyJ);
  assert.equal(after.droplets[0].physicalDropletCount, before.droplets[0].physicalDropletCount);
  assert.deepEqual(inspectCondensableFiniteCell(source), before);
});

test('common +/-1e12 formation-energy gauge shifts cannot affect the finite trajectory or centered inventory', () => {
  const input = inputRecord({ noncondensables: [{ id: 'inert-a', massKg: 1 / 16384, temperatureK: 248 }] });
  const runs = [-1e12, 0, 1e12].map((shift) => {
    const record = modelRecord(thermoRecord({ liquidReferenceEnthalpyJPerKg: -10_000 + shift }), { noncondensables: [inertRecord()] });
    const state = initializeCondensableFiniteCell(createCondensableFiniteCellModel(record), input);
    const result = advanceCondensableFiniteCell(state, { durationS: 0.25 });
    assert.equal(result.status, 'completed');
    return { rates: evaluateCondensableFiniteCellRates(state), result, snapshot: inspectCondensableFiniteCell(result.state) };
  });
  for (const run of [runs[0], runs[2]]) {
    assert.deepEqual(run.rates, runs[1].rates, 'no direct huge-zero subtraction in force or carried energy');
    assert.deepEqual(run.snapshot, runs[1].snapshot, 'exact centered state is gauge-independent');
    assert.equal(run.result.acceptedSteps, runs[1].result.acceptedSteps);
    assert.equal(run.result.rejectedSteps, runs[1].result.rejectedSteps);
  }
});

test('whole coupled proposals reject shared-donor depletion instead of clipping or partly mutating a source', () => {
  const record = modelRecord(thermoRecord(), { massMobilityPerAreaKg2KPerJsM2: 100 });
  const input = inputRecord({ droplets: [
    { id: 'drop-a', massKg: 1 / 64, temperatureK: 256, physicalDropletCount: 8n },
    { id: 'drop-b', massKg: 1 / 64, temperatureK: 256, physicalDropletCount: 8n }] });
  const source = initializeCondensableFiniteCell(createCondensableFiniteCellModel(record), input);
  const before = inspectCondensableFiniteCell(source);
  const out = advanceCondensableFiniteCell(source, { durationS: 1, initialStepS: 1, maxSteps: 1 });
  assert.equal(out.status, 'step-limit');
  assert.equal(out.acceptedSteps, 0);
  assert.equal(out.rejectedSteps, 1);
  assert.equal(out.elapsedS, 0);
  assert.equal(out.remainingS, 1);
  assert.equal(out.state, source);
  assert.ok(out.lastRejection);
  assert.deepEqual(inspectCondensableFiniteCell(source), before);
  const underflow = advanceCondensableFiniteCell(source, { durationS: 1, initialStepS: 1, minimumStepS: 1, maxSteps: 4 });
  assert.equal(underflow.status, 'step-underflow');
  assert.equal(underflow.state, source);
  assert.equal(underflow.elapsedS, 0);
  assert.equal(underflow.remainingS, 1);
});

test('a bounded partial result reports the unprocessed duration and can resume without discarding inventory', () => {
  const source = initializeCondensableFiniteCell(createCondensableFiniteCellModel(modelRecord()), inputRecord());
  const before = inspectCondensableFiniteCell(source);
  const partial = advanceCondensableFiniteCell(source, { durationS: 0.25, initialStepS: 1 / 1024, maxSteps: 1 });
  assert.equal(partial.status, 'step-limit');
  assert.equal(partial.acceptedSteps, 1);
  assert.ok(partial.elapsedS > 0 && partial.remainingS > 0);
  assert.equal(partial.elapsedS + partial.remainingS, 0.25);
  assertConserved(before, inspectCondensableFiniteCell(partial.state));
  const resumed = advanceCondensableFiniteCell(partial.state, { durationS: partial.remainingS });
  assert.equal(resumed.status, 'completed');
  const after = inspectCondensableFiniteCell(resumed.state);
  assert.equal(after.timeS, 0.25);
  assertConserved(before, after);
  assert.deepEqual(inspectCondensableFiniteCell(source), before);
});

test('original model/state identity is required; rounded snapshots and copies are not continuation authority', () => {
  const model = createCondensableFiniteCellModel(modelRecord()), source = initializeCondensableFiniteCell(model, inputRecord());
  assert.throws(() => initializeCondensableFiniteCell({ ...model }, inputRecord()));
  for (const copied of [{ ...source }, inspectCondensableFiniteCell(source), {}, null]) {
    assert.throws(() => inspectCondensableFiniteCell(copied));
    assert.throws(() => evaluateCondensableFiniteCellRates(copied));
    assert.throws(() => advanceCondensableFiniteCell(copied, { durationS: 0.1 }));
  }
});

for (const [label, mutate] of [
  ['foreign schema', (r) => { r.schema = 'foreign'; }],
  ['copied thermo model', (r) => { r.thermodynamics = { ...r.thermodynamics }; }],
  ['missing provenance', (r) => { r.provenance = ''; }],
  ['negative mass mobility', (r) => { r.massMobilityPerAreaKg2KPerJsM2 = -1; }],
  ['infinite vapor heat coefficient', (r) => { r.vaporHeatTransferCoefficientWPerM2K = Infinity; }],
  ['missing explicit inert array', (r) => { delete r.noncondensables; }],
  ['duplicate inert IDs', (r) => { r.noncondensables = [inertRecord(), inertRecord()]; }],
  ['zero inert molar mass', (r) => { r.noncondensables = [inertRecord({ molarMassKgPerMol: 0 })]; }],
  ['inert does not cover liquid domain', (r) => { r.noncondensables = [inertRecord({ minTemperatureK: 201 })]; }],
  ['negative inert heat coefficient', (r) => { r.noncondensables = [inertRecord({ heatTransferCoefficientWPerM2K: -1 })]; }],
  ['nonpositive exact endpoint sigma', (r) => { r.surface = { ...r.surface, interceptNPerM: 400 / 512, slopeNPerMK: -1 / 512 }; }],
  ['zero affinity domain', (r) => { r.maxAbsAffinityJPerKgK = 0; }],
  ['string temperature-jump domain', (r) => { r.maxTemperatureDifferenceK = '50'; }]
]) test(`finite-cell model rejects ${label}`, () => {
  const record = modelRecord(); mutate(record);
  assert.throws(() => createCondensableFiniteCellModel(record));
});

for (const [label, mutate] of [
  ['absent vapor', (i) => { delete i.vapor; }],
  ['zero vapor without an invented seed', (i) => { i.vapor.massKg = 0; }],
  ['nonfinite vapor mass', (i) => { i.vapor.massKg = Infinity; }],
  ['out-of-domain vapor T', (i) => { i.vapor.temperatureK = 401; }],
  ['string vapor T', (i) => { i.vapor.temperatureK = '264'; }],
  ['negative free gas volume', (i) => { i.freeGasVolumeM3 = -1; }],
  ['no existing nuclei', (i) => { i.droplets = []; }],
  ['duplicate parcel ID', (i) => { i.droplets.push({ ...i.droplets[0] }); }],
  ['zero parcel mass', (i) => { i.droplets[0].massKg = 0; }],
  ['inferred numeric physical N', (i) => { i.droplets[0].physicalDropletCount = 8; }],
  ['zero physical N', (i) => { i.droplets[0].physicalDropletCount = 0n; }],
  ['overflowed physical N', (i) => { i.droplets[0].physicalDropletCount = 1n << 64n; }],
  ['out-of-domain liquid T', (i) => { i.droplets[0].temperatureK = 199; }],
  ['missing explicit inert states', (i) => { delete i.noncondensables; }],
  ['assumed undeclared air', (i) => { i.noncondensables = [{ id: 'air', massKg: 0.01, temperatureK: 256 }]; }]
]) test(`finite-cell initialization rejects ${label} without changing input`, () => {
  const model = createCondensableFiniteCellModel(modelRecord()), input = inputRecord(); mutate(input);
  const before = structuredClone(input);
  assert.throws(() => initializeCondensableFiniteCell(model, input));
  assert.deepEqual(input, before);
});

test('source affinity and all-species temperature-jump gates remain active even with small or zero coefficients', () => {
  for (const override of [{ maxAbsAffinityJPerKgK: 0.001, massMobilityPerAreaKg2KPerJsM2: 0 },
    { maxTemperatureDifferenceK: 1, vaporHeatTransferCoefficientWPerM2K: 0 }]) {
    assert.throws(() => initializeCondensableFiniteCell(createCondensableFiniteCellModel(modelRecord(thermoRecord(), override)), inputRecord()));
  }
  const record = modelRecord(thermoRecord(), { noncondensables: [inertRecord({ heatTransferCoefficientWPerM2K: 0 })] });
  const input = inputRecord({ noncondensables: [{ id: 'inert-a', massKg: 1 / 16384, temperatureK: 320 }] });
  assert.throws(() => initializeCondensableFiniteCell(createCondensableFiniteCellModel(record), input),
    'an insulating inert still has an actual out-of-domain temperature difference');
});

for (const options of [
  {}, { durationS: 0 }, { durationS: -1 }, { durationS: Infinity }, { durationS: '1' },
  { durationS: 1, relativeTolerance: 0 }, { durationS: 1, absoluteTemperatureToleranceK: -1 },
  { durationS: 1, maxSteps: 0 }, { durationS: 1, maxSteps: 1.5 },
  { durationS: 1, minimumStepS: 0 }, { durationS: 1, initialStepS: NaN }
]) test(`invalid finite-interval options reject: ${JSON.stringify(options)}`, () => {
  const source = initializeCondensableFiniteCell(createCondensableFiniteCellModel(modelRecord()), inputRecord());
  const before = inspectCondensableFiniteCell(source);
  assert.throws(() => advanceCondensableFiniteCell(source, options));
  assert.deepEqual(inspectCondensableFiniteCell(source), before);
});
