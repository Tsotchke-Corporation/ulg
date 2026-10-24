import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONDENSABLE_THERMODYNAMICS_SCHEMA,
  createCondensableThermodynamics
} from '../src/runtime/material/condensableThermodynamics.js';
import {
  CONDENSABLE_CELL_EQUILIBRIUM_SCHEMA,
  solveClosedCondensableCellEquilibrium
} from '../src/runtime/sph/sphCondensableCellEquilibrium.js';

// Manufactured closed-cell thermodynamics only: these constants are not an
// empirical fluid fit, a nucleation law, a kinetic timescale or live SS proof.
const R = 8.314462618;
const caloricRecord = (overrides = {}) => ({
  schema: CONDENSABLE_THERMODYNAMICS_SCHEMA,
  energyBasis: 'specific-enthalpy-at-reference-pressure',
  referenceTemperatureK: 300, referencePressurePa: 3000,
  liquidReferenceEnthalpyJPerKg: -50_000,
  vaporizationReferenceEnthalpyJPerKg: 2_000_000,
  liquidCpJPerKgK: 4000, vaporCpJPerKgK: 1500,
  liquidDensityKgPerM3: 1000, molarMassKgPerMol: R / 100,
  minTemperatureK: 200, maxTemperatureK: 450, maxPressurePa: 2_000_000,
  provenance: 'synthetic rigid-cell algebra test; no live population admission',
  ...overrides
});
const near = (actual, expected, label, relative = 2e-9, absolute = 1e-12) => {
  assert.ok(Number.isFinite(actual), `${label}: finite ${actual}`);
  assert.ok(Math.abs(actual - expected) <= absolute + relative * Math.abs(expected),
    `${label}: ${actual} versus ${expected}`);
};
const properties = (record, temperatureK) => {
  const rs = R / record.molarMassKgPerMol;
  const dt = temperatureK - record.referenceTemperatureK;
  return {
    liquidU: record.liquidReferenceEnthalpyJPerKg - record.referencePressurePa / record.liquidDensityKgPerM3
      + record.liquidCpJPerKgK * dt,
    vaporU: record.liquidReferenceEnthalpyJPerKg + record.vaporizationReferenceEnthalpyJPerKg
      + record.vaporCpJPerKgK * dt - rs * temperatureK,
    liquidCv: record.liquidCpJPerKgK,
    vaporCv: record.vaporCpJPerKgK - rs,
    rs
  };
};
function independentEquilibriumPressure(record, temperatureK, totalPressurePa) {
  const dt = temperatureK - record.referenceTemperatureK;
  const logT = Math.log(temperatureK / record.referenceTemperatureK);
  const liquidG = record.liquidReferenceEnthalpyJPerKg + record.liquidCpJPerKgK * dt
    + (totalPressurePa - record.referencePressurePa) / record.liquidDensityKgPerM3
    - temperatureK * record.liquidCpJPerKgK * logT;
  const vaporGAtReferencePressure = record.liquidReferenceEnthalpyJPerKg
    + record.vaporizationReferenceEnthalpyJPerKg + record.vaporCpJPerKgK * dt
    - temperatureK * (record.vaporizationReferenceEnthalpyJPerKg / record.referenceTemperatureK
      + record.vaporCpJPerKgK * logT);
  return record.referencePressurePa * Math.exp((liquidG - vaporGAtReferencePressure)
    / ((R / record.molarMassKgPerMol) * temperatureK));
}

function makeInput(record = caloricRecord(), overrides = {}) {
  return { model: createCondensableThermodynamics(record), temperatureK: 300,
    vaporMassKg: 0.0012, liquidMassKg: 0.1, freeGasVolumeM3: 0.01,
    noncondensables: [], interfaceModel: 'planar-existing-liquid', ...overrides };
}

function assertConserved(record, input, result) {
  assert.equal(result.schema, CONDENSABLE_CELL_EQUILIBRIUM_SCHEMA);
  assert.equal(result.ready, true, result.status);
  assert.equal(result.authoritativeStateMutation, false);
  assert.equal(result.referenceOnly, true);
  assert.equal(result.runtimeAdmissible, false);
  assert.equal(Object.isFrozen(result), true);
  const p = result.proposal;
  assert.equal(Object.isFrozen(p), true);
  assert.equal(Object.isFrozen(p.noncondensableEnergyDeltasJ), true);
  const before = properties(record, input.temperatureK), after = properties(record, p.temperatureK);
  const dm = input.vaporMassKg - p.vaporMassKg;
  near(p.condensedMassKg, dm, 'signed vapor debit', 1e-8);
  near(p.liquidMassKg - input.liquidMassKg, dm, 'equal liquid credit', 1e-8);
  near(p.vaporMassKg + p.liquidMassKg, input.vaporMassKg + input.liquidMassKg, 'total condensable mass');
  near(p.massResidualKg, 0, 'reported mass residual', 0, 2e-15);
  near(p.freeGasVolumeM3 + p.liquidMassKg / record.liquidDensityKgPerM3,
    input.freeGasVolumeM3 + input.liquidMassKg / record.liquidDensityKgPerM3, 'rigid total volume');
  near(p.freeGasVolumeM3, input.freeGasVolumeM3 - dm / record.liquidDensityKgPerM3,
    'actual signed liquid-volume displacement', 2e-11);
  const partial = p.vaporMassKg * after.rs * p.temperatureK / p.freeGasVolumeM3;
  const inertPressure = input.noncondensables.reduce((sum, gas) => sum
    + gas.massKg / gas.molarMassKgPerMol * R * p.temperatureK / p.freeGasVolumeM3, 0);
  near(p.vaporPartialPressurePa, partial, 'species ideal-gas pressure');
  near(p.totalPressurePa, partial + inertPressure, 'mixture total pressure');
  const vaporDelta = p.vaporMassKg * after.vaporU - input.vaporMassKg * before.vaporU;
  const liquidDelta = p.liquidMassKg * after.liquidU - input.liquidMassKg * before.liquidU;
  const gasDeltas = input.noncondensables.map((gas) => gas.massKg * gas.cvJPerKgK
    * (p.temperatureK - input.temperatureK));
  near(p.vaporEnergyDeltaJ, vaporDelta, 'independent vapor endpoint energy', 2e-9, 1e-8);
  near(p.liquidEnergyDeltaJ, liquidDelta, 'independent liquid endpoint energy', 2e-9, 1e-8);
  assert.equal(p.noncondensableEnergyDeltasJ.length, gasDeltas.length);
  gasDeltas.forEach((energy, index) => near(p.noncondensableEnergyDeltasJ[index], energy,
    `inert energy participant ${index}`, 2e-9, 1e-9));
  near(vaporDelta + liquidDelta + gasDeltas.reduce((sum, energy) => sum + energy, 0),
    0, 'independent closed-cell energy residual', 0, 1e-7);
  near(p.energyResidualJ, 0, 'reported energy residual', 0, 1e-7);
  near(p.componentEnergyResidualJ, 0, 'reported signed-component residual', 0, 1e-7);
  const cv = p.liquidMassKg * after.liquidCv + p.vaporMassKg * after.vaporCv
    + input.noncondensables.reduce((sum, gas) => sum + gas.massKg * gas.cvJPerKgK, 0);
  near(cv * (p.temperatureK - input.temperatureK), dm * (before.vaporU - before.liquidU),
    'one latent-U conversion, not a second additive heat credit', 2e-9, 1e-7);
  const eq = independentEquilibriumPressure(record, p.temperatureK, p.totalPressurePa);
  near(p.logSupersaturationRatio, Math.log(partial / eq), 'independent Gibbs supersaturation', 0, 2e-11);
  if (result.status === 'two-phase-equilibrium') {
    assert.ok(p.liquidMassKg > 0 && p.vaporMassKg > 0);
    near(partial, eq, 'equilibrium chemical potentials', 3e-9, 1e-8);
  }
}

// Choose the final coexistence endpoint BEFORE invoking the runtime solver,
// then manufacture a mass/energy-equivalent initial state algebraically.
function knownEndpoint({ dm = 0.0002, withInert = false, record = caloricRecord() } = {}) {
  const temperatureK = withInert ? 295 : record.referenceTemperatureK;
  const pressurePa = record.referencePressurePa;
  const freeGasVolumeM3 = 0.01;
  const partialPa = independentEquilibriumPressure(record, temperatureK, pressurePa);
  const caloric = properties(record, temperatureK);
  const vaporMassKg = partialPa * freeGasVolumeM3 / (caloric.rs * temperatureK);
  const liquidMassKg = 0.1;
  const noncondensables = withInert ? [{
    massKg: (pressurePa - partialPa) * freeGasVolumeM3 * 0.04 / (R * temperatureK),
    molarMassKgPerMol: 0.04, cvJPerKgK: 700
  }] : [];
  const initialCv = (vaporMassKg + dm) * caloric.vaporCv
    + (liquidMassKg - dm) * caloric.liquidCv
    + noncondensables.reduce((sum, gas) => sum + gas.massKg * gas.cvJPerKgK, 0);
  const input = makeInput(record, {
    temperatureK: temperatureK - dm * (caloric.vaporU - caloric.liquidU) / initialCv,
    vaporMassKg: vaporMassKg + dm,
    liquidMassKg: liquidMassKg - dm,
    freeGasVolumeM3: freeGasVolumeM3 + dm / record.liquidDensityKgPerM3,
    noncondensables
  });
  return { record, input, expected: { temperatureK, vaporMassKg, liquidMassKg, freeGasVolumeM3, dm, partialPa, pressurePa } };
}

for (const [name, dm, withInert] of [
  ['condensation', 0.0002, false], ['evaporation', -0.0002, false],
  ['condensation-with-inert-heat-capacity', 0.0002, true],
  ['evaporation-with-inert-heat-capacity', -0.0001, true]
]) {
  test(`${name}: reaches an independently preselected closed-energy endpoint`, () => {
    const { record, input, expected } = knownEndpoint({ dm, withInert });
    const original = structuredClone(input);
    Object.freeze(input.noncondensables);
    input.noncondensables.forEach(Object.freeze);
    Object.freeze(input);
    const result = solveClosedCondensableCellEquilibrium(input);
    assert.equal(result.status, 'two-phase-equilibrium');
    assertConserved(record, input, result);
    for (const field of ['temperatureK', 'vaporMassKg', 'liquidMassKg', 'freeGasVolumeM3']) {
      near(result.proposal[field], expected[field], `manufactured endpoint ${field}`, 2e-9);
    }
    near(result.proposal.condensedMassKg, expected.dm, 'independent exchanged mass', 2e-8);
    near(result.proposal.vaporPartialPressurePa, expected.partialPa, 'independent partial pressure');
    near(result.proposal.totalPressurePa, expected.pressurePa, 'independent total pressure');
    assert.equal(Math.sign(result.proposal.temperatureK - input.temperatureK), Math.sign(dm));
    assert.deepEqual(input, original, 'reference solve must not mutate any participant');
  });
}

test('inert row partition and ordering do not change equilibrium', () => {
  const record = caloricRecord();
  const inert = { massKg: 0.001, molarMassKgPerMol: 0.028, cvJPerKgK: 740 };
  const single = makeInput(record, { noncondensables: [inert] });
  const split = makeInput(record, { noncondensables: [
    { ...inert, massKg: 0.00075 }, { ...inert, massKg: 0 }, { ...inert, massKg: 0.00025 }
  ] });
  const a = solveClosedCondensableCellEquilibrium(single);
  const b = solveClosedCondensableCellEquilibrium(split);
  assertConserved(record, single, a);
  assertConserved(record, split, b);
  for (const field of ['temperatureK', 'vaporMassKg', 'liquidMassKg', 'freeGasVolumeM3',
    'vaporPartialPressurePa', 'totalPressurePa', 'condensedMassKg']) {
    near(a.proposal[field], b.proposal[field], `partition invariant ${field}`, 2e-10);
  }
  near(a.proposal.noncondensableEnergyDeltasJ[0],
    b.proposal.noncondensableEnergyDeltasJ.reduce((sum, energy) => sum + energy, 0), 'partition energy');
  assert.equal(b.proposal.noncondensableEnergyDeltasJ[1], 0);
});

test('different inert molar masses and heat capacities each enter the same closed endpoint', () => {
  const fixture = knownEndpoint({ dm: 0.0002, withInert: true });
  const { record, expected } = fixture;
  const totalInertMoles = (expected.pressurePa - expected.partialPa)
    * expected.freeGasVolumeM3 / (R * expected.temperatureK);
  const noncondensables = [
    { massKg: totalInertMoles * 0.4 * 0.004, molarMassKgPerMol: 0.004, cvJPerKgK: 3100 },
    { massKg: totalInertMoles * 0.6 * 0.04, molarMassKgPerMol: 0.04, cvJPerKgK: 600 }
  ];
  const caloric = properties(record, expected.temperatureK);
  const initialCv = fixture.input.vaporMassKg * caloric.vaporCv
    + fixture.input.liquidMassKg * caloric.liquidCv
    + noncondensables.reduce((sum, gas) => sum + gas.massKg * gas.cvJPerKgK, 0);
  const input = { ...fixture.input, noncondensables,
    temperatureK: expected.temperatureK
      - expected.dm * (caloric.vaporU - caloric.liquidU) / initialCv };
  const result = solveClosedCondensableCellEquilibrium(input);
  assertConserved(record, input, result);
  near(result.proposal.temperatureK, expected.temperatureK, 'mixed-inert preselected temperature');
  near(result.proposal.condensedMassKg, expected.dm, 'mixed-inert preselected exchange');
  near(result.proposal.totalPressurePa, expected.pressurePa, 'mixed-inert pressure from actual species moles');
  assert.ok(result.proposal.noncondensableEnergyDeltasJ.every((energy) => energy > 0));
  assert.notEqual(result.proposal.noncondensableEnergyDeltasJ[0], result.proposal.noncondensableEnergyDeltasJ[1]);
  const reversed = solveClosedCondensableCellEquilibrium({ ...input, noncondensables: [...noncondensables].reverse() });
  near(reversed.proposal.temperatureK, result.proposal.temperatureK, 'species order independent');
  near(reversed.proposal.condensedMassKg, result.proposal.condensedMassKg, 'species order exchange');
  for (const index of [0, 1]) near(reversed.proposal.noncondensableEnergyDeltasJ[index],
    result.proposal.noncondensableEnergyDeltasJ[1 - index], 'individual species ledger follows order');
});

test('finite noncondensable heat capacity changes both warming and equilibrium exchange', () => {
  const record = caloricRecord();
  const low = makeInput(record, { temperatureK: 298, noncondensables: [
    { massKg: 0.001, molarMassKgPerMol: 0.028, cvJPerKgK: 700 }
  ] });
  const high = { ...low, noncondensables: [{ ...low.noncondensables[0], cvJPerKgK: 1_000_000 }] };
  const a = solveClosedCondensableCellEquilibrium(low), b = solveClosedCondensableCellEquilibrium(high);
  assertConserved(record, low, a);
  assertConserved(record, high, b);
  assert.ok(a.proposal.condensedMassKg > 0);
  assert.ok(b.proposal.temperatureK > high.temperatureK);
  assert.ok(b.proposal.temperatureK < a.proposal.temperatureK, 'larger bath Cv limits warming');
  assert.ok(b.proposal.condensedMassKg > a.proposal.condensedMassKg,
    'colder equilibrium retains less vapor instead of pretending inert energy is free');
  assert.ok(a.proposal.noncondensableEnergyDeltasJ[0] > 0);
  assert.ok(b.proposal.noncondensableEnergyDeltasJ[0] > 0);
});

test('all-vapor boundary conserves endpoint energy and never evaporates unavailable liquid', () => {
  const record = caloricRecord();
  const input = makeInput(record, { temperatureK: 310, vaporMassKg: 0.001,
    liquidMassKg: 0.000001, freeGasVolumeM3: 0.1 });
  const result = solveClosedCondensableCellEquilibrium(input);
  assert.equal(result.status, 'all-vapor-equilibrium');
  assertConserved(record, input, result);
  assert.equal(result.proposal.liquidMassKg, 0);
  near(result.proposal.condensedMassKg, -input.liquidMassKg, 'available liquid only');
  assert.ok(result.proposal.logSupersaturationRatio < 0);
  assert.ok(result.proposal.temperatureK < input.temperatureK);
});

test('dry supersaturation, including tiny positive excess, requires activation rather than inventing nuclei', () => {
  const record = caloricRecord();
  for (const factor of [10, 1 + 2e-13]) {
    const input = makeInput(record, { vaporMassKg: 0.001 * factor, liquidMassKg: 0 });
    const before = structuredClone(input);
    const result = solveClosedCondensableCellEquilibrium(input);
    assert.equal(result.status, 'activation-required');
    assert.equal(result.ready, false);
    assert.equal(result.authoritativeStateMutation, false);
    assert.equal(Object.hasOwn(result, 'proposal'), false);
    assert.deepEqual(input, before);
  }
});

test('dry undersaturated vapor remains dry without a hidden condensate population', () => {
  const record = caloricRecord();
  const input = makeInput(record, { vaporMassKg: 0.0001, liquidMassKg: 0 });
  const result = solveClosedCondensableCellEquilibrium(input);
  assert.equal(result.status, 'all-vapor-equilibrium');
  assertConserved(record, input, result);
  assert.equal(result.proposal.liquidMassKg, 0);
  assert.equal(result.proposal.condensedMassKg, 0);
  assert.equal(result.proposal.temperatureK, input.temperatureK);
});

test('an existing liquid interface may evaporate into initially empty vapor volume', () => {
  const record = caloricRecord();
  const input = makeInput(record, { vaporMassKg: 0 });
  const result = solveClosedCondensableCellEquilibrium(input);
  assert.equal(result.status, 'two-phase-equilibrium');
  assertConserved(record, input, result);
  assert.ok(result.proposal.vaporMassKg > 0);
  assert.ok(result.proposal.condensedMassKg < 0);
});

test('near-equilibrium repeated CPU evaluation does not add mass or latent energy', () => {
  const record = caloricRecord();
  let input = makeInput(record, { vaporMassKg: 0.001, liquidMassKg: 0.1 });
  const original = { ...input };
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const result = solveClosedCondensableCellEquilibrium(input);
    assert.equal(result.status, 'two-phase-equilibrium');
    assertConserved(record, input, result);
    near(result.proposal.condensedMassKg, 0, 'zero net equilibrium exchange', 0, 2e-15);
    input = { ...input, ...result.proposal };
  }
  near(input.temperatureK, original.temperatureK, 'temperature after repeated reference evaluations', 0, 1e-10);
  near(input.vaporMassKg, original.vaporMassKg, 'vapor after repeated reference evaluations', 0, 2e-15);
  near(input.liquidMassKg, original.liquidMassKg, 'liquid after repeated reference evaluations', 0, 2e-15);
});

test('signed common energy-zero changes leave equilibrium and signed exchange invariant', () => {
  const base = caloricRecord();
  const input = makeInput(base);
  const reference = solveClosedCondensableCellEquilibrium(input);
  assertConserved(base, input, reference);
  for (const offset of [-1e9, 1e9]) {
    const shiftedInput = { ...input, model: createCondensableThermodynamics(caloricRecord({
      liquidReferenceEnthalpyJPerKg: base.liquidReferenceEnthalpyJPerKg + offset
    })) };
    const shifted = solveClosedCondensableCellEquilibrium(shiftedInput);
    assert.equal(shifted.status, reference.status);
    for (const field of ['temperatureK', 'vaporMassKg', 'liquidMassKg', 'freeGasVolumeM3',
      'vaporPartialPressurePa', 'totalPressurePa', 'condensedMassKg']) {
      near(shifted.proposal[field], reference.proposal[field], `energy-zero invariant ${field}`, 2e-10);
    }
    near(shifted.proposal.vaporEnergyDeltaJ - reference.proposal.vaporEnergyDeltaJ,
      -reference.proposal.condensedMassKg * offset, 'vapor exchange energy-zero accounting');
    near(shifted.proposal.liquidEnergyDeltaJ - reference.proposal.liquidEnergyDeltaJ,
      reference.proposal.condensedMassKg * offset, 'liquid exchange energy-zero accounting');
  }
});

test('a different synthetic material follows the same closed-cell equations', () => {
  const record = caloricRecord({ molarMassKgPerMol: 0.044, liquidDensityKgPerM3: 700,
    liquidCpJPerKgK: 2200, vaporCpJPerKgK: 1100,
    referenceTemperatureK: 250, referencePressurePa: 50_000,
    vaporizationReferenceEnthalpyJPerKg: 300_000, minTemperatureK: 200, maxTemperatureK: 300 });
  const fixture = knownEndpoint({ record, dm: 0.0002 });
  const result = solveClosedCondensableCellEquilibrium(fixture.input);
  assert.equal(result.status, 'two-phase-equilibrium');
  assertConserved(record, fixture.input, result);
  near(result.proposal.temperatureK, fixture.expected.temperatureK, 'generalized material endpoint');
  near(result.proposal.condensedMassKg, fixture.expected.dm, 'generalized material exchange');
});

test('unsupported interface and physical domains return no mutation proposal, never clamped states', () => {
  const record = caloricRecord();
  const cases = [
    [makeInput(record, { interfaceModel: 'curved-solute-droplet' }), 'unsupported-interface-model'],
    [makeInput(record, { temperatureK: 199 }), 'outside-temperature-domain'],
    [makeInput(record, { vaporMassKg: 10, freeGasVolumeM3: 0.01 }), 'outside-volume-or-caloric-domain'],
    [makeInput(record, { vaporMassKg: 0.8 }), 'outside-pressure-domain'],
    [makeInput(caloricRecord({ minTemperatureK: 299.9, maxTemperatureK: 300.1 }),
      { vaporMassKg: 0.003 }), 'equilibrium-outside-temperature-domain'],
    [makeInput(caloricRecord({ maxPressurePa: 5000 }),
      { temperatureK: 340, vaporMassKg: 0, liquidMassKg: 2 }), 'pressure-bracket-outside-model-domain'],
    [makeInput(record, { noncondensables: [{ massKg: 1e308, molarMassKgPerMol: 0.028,
      cvJPerKgK: 1e308 }] }), 'outside-volume-or-caloric-domain']
  ];
  for (const [input, status] of cases) {
    const before = structuredClone(input);
    const result = solveClosedCondensableCellEquilibrium(input);
    assert.equal(result.status, status);
    assert.equal(result.ready, false);
    assert.equal(result.authoritativeStateMutation, false);
    assert.equal(result.referenceOnly, true);
    assert.equal(result.runtimeAdmissible, false);
    assert.equal(Object.hasOwn(result, 'proposal'), false);
    assert.deepEqual(input, before);
  }
});

test('malformed state, legacy model and incomplete inert caloric inputs throw', () => {
  const input = makeInput();
  for (const patch of [{ model: { ...input.model } }, { model: { cpJPerKgK: 4200 } },
    { vaporMassKg: 0, liquidMassKg: 0 }, { vaporMassKg: -1 }, { liquidMassKg: NaN },
    { vaporMassKg: '0.001' }, { temperatureK: 0 }, { temperatureK: Infinity },
    { freeGasVolumeM3: 0 }, { freeGasVolumeM3: -1 }, { noncondensables: undefined },
    { noncondensables: {} }, { noncondensables: [null] },
    { noncondensables: [{ massKg: 0.1, molarMassKgPerMol: 0.028 }] },
    { noncondensables: [{ massKg: 0.1, molarMassKgPerMol: 0.028, cvJPerKgK: 0 }] },
    { noncondensables: [{ massKg: 0.1, molarMassKgPerMol: -1, cvJPerKgK: 700 }] },
    { noncondensables: [{ massKg: Infinity, molarMassKgPerMol: 0.028, cvJPerKgK: 700 }] }]) {
    assert.throws(() => solveClosedCondensableCellEquilibrium({ ...input, ...patch }));
  }
});
