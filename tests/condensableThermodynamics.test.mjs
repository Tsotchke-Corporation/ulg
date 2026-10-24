import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONDENSABLE_THERMODYNAMICS_SCHEMA,
  createCondensableThermodynamics,
  evaluateCondensableThermodynamics,
  isCondensableThermodynamics,
  resolveCondensableCaloricState
} from '../src/runtime/material/condensableThermodynamics.js';

// Explicit synthetic caloric records, not reference data or scientific fits.
// Expectations below integrate independent phase Gibbs potentials and use the
// ideal-gas/incompressible identities; they do not call a second runtime oracle.
const R = 8.314462618;
const record = (overrides = {}) => ({
  schema: CONDENSABLE_THERMODYNAMICS_SCHEMA,
  energyBasis: 'specific-enthalpy-at-reference-pressure',
  referenceTemperatureK: 300,
  referencePressurePa: 3000,
  liquidReferenceEnthalpyJPerKg: -50_000,
  vaporizationReferenceEnthalpyJPerKg: 2_000_000,
  liquidCpJPerKgK: 4000,
  vaporCpJPerKgK: 1500,
  liquidDensityKgPerM3: 1000,
  molarMassKgPerMol: R / 100,
  minTemperatureK: 200,
  maxTemperatureK: 450,
  maxPressurePa: 2_000_000,
  provenance: 'synthetic constant-Cp algebra fixture; not a measured material',
  ...overrides
});
const near = (actual, expected, label, relative = 2e-11, absolute = 1e-8) => {
  assert.ok(Number.isFinite(actual), `${label}: finite ${actual}`);
  assert.ok(Math.abs(actual - expected) <= absolute + relative * Math.abs(expected),
    `${label}: ${actual} versus ${expected}`);
};

function independentPhases(input, temperatureK, totalPressurePa, vaporPressurePa) {
  const dT = temperatureK - input.referenceTemperatureK;
  const logT = Math.log(temperatureK / input.referenceTemperatureK);
  const rs = R / input.molarMassKgPerMol;
  const hLiquid = input.liquidReferenceEnthalpyJPerKg + input.liquidCpJPerKgK * dT
    + (totalPressurePa - input.referencePressurePa) / input.liquidDensityKgPerM3;
  const hVapor = input.liquidReferenceEnthalpyJPerKg
    + input.vaporizationReferenceEnthalpyJPerKg + input.vaporCpJPerKgK * dT;
  const sLiquid = input.liquidCpJPerKgK * logT;
  const sVapor = input.vaporizationReferenceEnthalpyJPerKg / input.referenceTemperatureK
    + input.vaporCpJPerKgK * logT - rs * Math.log(vaporPressurePa / input.referencePressurePa);
  return { hLiquid, hVapor,
    uLiquid: hLiquid - totalPressurePa / input.liquidDensityKgPerM3,
    uVapor: hVapor - rs * temperatureK,
    gLiquid: hLiquid - temperatureK * sLiquid,
    gVapor: hVapor - temperatureK * sVapor };
}

test('explicit enthalpy references produce frozen phase-specific U/Cv without live enrollment', () => {
  const input = record();
  const model = createCondensableThermodynamics(input);
  assert.equal(Object.isFrozen(model), true);
  assert.equal(isCondensableThermodynamics(model), true);
  assert.equal(isCondensableThermodynamics({ ...model }), false);
  assert.equal(model.scientificValidation, false);
  assert.equal(model.liveStateEnrollment, false);
  near(model.specificGasConstantJPerKgK, 100, 'specific R');
  near(model.vaporCvJPerKgK, 1400, 'vapor Cv=Cp-R');
  near(model.liquidCvJPerKgK, 4000, 'incompressible liquid Cv=Cp');
  near(model.liquidReferenceInternalEnergyJPerKg, -50_003, 'liquid u0=h0-P0/rho');
  near(model.vaporReferenceInternalEnergyJPerKg, 1_920_000, 'vapor u0=h0+Lh-R T0');
  near(model.vaporizationReferenceInternalEnergyJPerKg, 1_970_003, 'latent U gap');
  const before = { ...model };
  input.liquidReferenceEnthalpyJPerKg = 99;
  input.provenance = 'mutated caller input';
  assert.deepEqual(model, before, 'factory snapshots the supplied scalar record');
});

const materialCases = [
  { name: 'synthetic-high-latent', input: record(), temperatures: [230, 300, 410] },
  { name: 'synthetic-other-molar-mass', input: record({
    referenceTemperatureK: 250, referencePressurePa: 50_000,
    molarMassKgPerMol: 0.044, liquidDensityKgPerM3: 700,
    liquidCpJPerKgK: 2200, vaporCpJPerKgK: 1100,
    vaporizationReferenceEnthalpyJPerKg: 300_000,
    minTemperatureK: 200, maxTemperatureK: 300
  }), temperatures: [210, 250, 285] }
];
for (const { name, input, temperatures } of materialCases) {
  test(`${name}: phase energies and saturation satisfy independently integrated Gibbs equality`, () => {
    const model = createCondensableThermodynamics(input);
    for (const temperatureK of temperatures) {
      for (const totalPressurePa of [0, input.referencePressurePa, 800_000]) {
        const out = evaluateCondensableThermodynamics(model, { temperatureK, totalPressurePa });
        const phases = independentPhases(input, temperatureK, totalPressurePa, out.equilibriumPressurePa);
        assert.equal(Object.isFrozen(out), true);
        near(out.liquidSpecificInternalEnergyJPerKg, phases.uLiquid, 'liquid U');
        near(out.vaporSpecificInternalEnergyJPerKg, phases.uVapor, 'vapor U');
        near(out.liquidSpecificEnthalpyJPerKg, phases.hLiquid, 'liquid H');
        near(out.vaporSpecificEnthalpyJPerKg, phases.hVapor, 'vapor H');
        near(phases.gVapor - phases.gLiquid, 0, 'equal chemical potentials', 0, 2e-8);
        near(out.logEquilibriumPressurePa, Math.log(out.equilibriumPressurePa), 'log pressure');
        near(out.vaporizationEnthalpyJPerKg - out.vaporizationInternalEnergyJPerKg,
          (R / input.molarMassKgPerMol) * temperatureK - totalPressurePa / input.liquidDensityKgPerM3,
          'latent H-U is gas PV minus liquid PV');
      }
    }
  });
}

test('reference coexistence is exact and Poynting correction uses total pressure separately', () => {
  const input = record();
  const model = createCondensableThermodynamics(input);
  const temperatureK = input.referenceTemperatureK;
  const atReference = evaluateCondensableThermodynamics(model, {
    temperatureK, totalPressurePa: input.referencePressurePa
  });
  near(atReference.equilibriumPressurePa, input.referencePressurePa, 'reference coexistence');
  const highPressure = 1_000_000;
  const high = evaluateCondensableThermodynamics(model, { temperatureK, totalPressurePa: highPressure });
  near(high.logEquilibriumPressurePa - atReference.logEquilibriumPressurePa,
    (highPressure - input.referencePressurePa) / (input.liquidDensityKgPerM3 * 100 * temperatureK),
    'Poynting logarithmic shift');
  assert.ok(high.equilibriumPressurePa > atReference.equilibriumPressurePa);
  assert.ok(high.equilibriumPressurePa < highPressure / 100,
    'equilibrium vapor partial pressure is not overwritten with total pressure');
});

test('temperature derivatives give separate Cp and Cv and the Clapeyron slope', () => {
  const input = record();
  const model = createCondensableThermodynamics(input);
  const temperatureK = 320, totalPressurePa = 150_000, dt = 0.001;
  const lower = evaluateCondensableThermodynamics(model, { temperatureK: temperatureK - dt, totalPressurePa });
  const upper = evaluateCondensableThermodynamics(model, { temperatureK: temperatureK + dt, totalPressurePa });
  for (const [field, capacity] of [
    ['liquidSpecificInternalEnergyJPerKg', 4000],
    ['vaporSpecificInternalEnergyJPerKg', 1400],
    ['liquidSpecificEnthalpyJPerKg', 4000],
    ['vaporSpecificEnthalpyJPerKg', 1500]
  ]) near((upper[field] - lower[field]) / (2 * dt), capacity, `${field} derivative`, 2e-8, 1e-6);
  const expectedHGap = input.vaporizationReferenceEnthalpyJPerKg
    + (input.vaporCpJPerKgK - input.liquidCpJPerKgK) * (temperatureK - input.referenceTemperatureK)
    - (totalPressurePa - input.referencePressurePa) / input.liquidDensityKgPerM3;
  near((upper.logEquilibriumPressurePa - lower.logEquilibriumPressurePa) / (2 * dt),
    expectedHGap / (100 * temperatureK ** 2), 'fixed-total-P log saturation slope', 1e-8, 1e-10);

  const t0 = input.referenceTemperatureK, p0 = input.referencePressurePa;
  const dLogDT = (evaluateCondensableThermodynamics(model, { temperatureK: t0 + dt, totalPressurePa: p0 })
    .logEquilibriumPressurePa - evaluateCondensableThermodynamics(model,
    { temperatureK: t0 - dt, totalPressurePa: p0 }).logEquilibriumPressurePa) / (2 * dt);
  const dp = 1;
  const dLogDP = (evaluateCondensableThermodynamics(model, { temperatureK: t0, totalPressurePa: p0 + dp })
    .logEquilibriumPressurePa - evaluateCondensableThermodynamics(model,
    { temperatureK: t0, totalPressurePa: p0 - dp }).logEquilibriumPressurePa) / (2 * dp);
  const coexistenceSlope = p0 * dLogDT / (1 - p0 * dLogDP);
  near(coexistenceSlope, input.vaporizationReferenceEnthalpyJPerKg
    / (t0 * (100 * t0 / p0 - 1 / input.liquidDensityKgPerM3)),
  'pure coexistence dP/dT=latent H/[T(vv-vl)]', 1e-8, 1e-7);
});

test('large positive and negative energy-zero shifts preserve latent gaps and saturation', () => {
  const input = record();
  const conditions = { temperatureK: 327, totalPressurePa: 200_000 };
  const base = evaluateCondensableThermodynamics(createCondensableThermodynamics(input), conditions);
  for (const offset of [-1e12, 1e12]) {
    const shifted = evaluateCondensableThermodynamics(createCondensableThermodynamics({
      ...input, liquidReferenceEnthalpyJPerKg: input.liquidReferenceEnthalpyJPerKg + offset
    }), conditions);
    for (const field of ['vaporizationEnthalpyJPerKg', 'vaporizationInternalEnergyJPerKg',
      'logEquilibriumPressurePa', 'equilibriumPressurePa']) {
      assert.equal(shifted[field], base[field], `${field} must not depend on common energy zero`);
    }
    for (const field of ['liquidSpecificInternalEnergyJPerKg', 'vaporSpecificInternalEnergyJPerKg',
      'liquidSpecificEnthalpyJPerKg', 'vaporSpecificEnthalpyJPerKg']) {
      near(shifted[field] - offset, base[field], `${field} offset`, 0, 0.001);
    }
  }
});

test('missing schema, legacy caloric conventions and absent provenance are not silently admitted', () => {
  for (const patch of [{ schema: undefined }, { schema: 'legacy' }, { energyBasis: undefined },
    { energyBasis: 'specific-internal-energy' }, { provenance: '' }, { provenance: '  ' },
    { provenance: 7 }]) {
    assert.throws(() => createCondensableThermodynamics(record(patch)), TypeError);
  }
  assert.throws(() => createCondensableThermodynamics({ cpJPerKgK: 4200, latentHeatJPerKg: 2e6 }), TypeError);
  assert.throws(() => createCondensableThermodynamics(null), TypeError);
});

test('factory rejects malformed scalars, nonpositive Cv and invalid reference domains', () => {
  for (const key of ['referenceTemperatureK', 'referencePressurePa',
    'vaporizationReferenceEnthalpyJPerKg', 'liquidCpJPerKgK', 'vaporCpJPerKgK',
    'liquidDensityKgPerM3', 'molarMassKgPerMol', 'minTemperatureK', 'maxTemperatureK', 'maxPressurePa']) {
    for (const bad of [undefined, NaN, Infinity, '1', 0, -1]) {
      assert.throws(() => createCondensableThermodynamics(record({ [key]: bad })),
        { name: typeof bad === 'number' && Number.isFinite(bad) ? 'RangeError' : 'TypeError' }, `${key}: ${bad}`);
    }
  }
  for (const patch of [{ vaporCpJPerKgK: 100 }, { vaporCpJPerKgK: 99 },
    { minTemperatureK: 301 }, { maxTemperatureK: 299 }, { maxPressurePa: 2999 },
    { minTemperatureK: 300, maxTemperatureK: 300 },
    { vaporizationReferenceEnthalpyJPerKg: 30_000 },
    { liquidDensityKgPerM3: 0.05 }, { maxPressurePa: 2_000_000_000 }]) {
    assert.throws(() => createCondensableThermodynamics(record(patch)), RangeError);
  }
  for (const bad of [NaN, Infinity, undefined, 'zero']) {
    assert.throws(() => createCondensableThermodynamics(record({ liquidReferenceEnthalpyJPerKg: bad })), TypeError);
  }
});

test('evaluator accepts exact declared boundaries, rejects extrapolation and copied models', () => {
  const input = record(), model = createCondensableThermodynamics(input);
  for (const temperatureK of [input.minTemperatureK, input.maxTemperatureK]) {
    for (const totalPressurePa of [0, input.maxPressurePa]) {
      assert.equal(evaluateCondensableThermodynamics(model, { temperatureK, totalPressurePa }).temperatureK,
        temperatureK);
    }
  }
  for (const conditions of [{ temperatureK: 199, totalPressurePa: 0 },
    { temperatureK: 451, totalPressurePa: 0 }, { temperatureK: 300, totalPressurePa: -1 },
    { temperatureK: 300, totalPressurePa: 2_000_001 }]) {
    assert.throws(() => evaluateCondensableThermodynamics(model, conditions), RangeError);
  }
  for (const conditions of [{ temperatureK: NaN, totalPressurePa: 0 },
    { temperatureK: 300, totalPressurePa: Infinity }, { temperatureK: '300', totalPressurePa: 0 }, {}]) {
    assert.throws(() => evaluateCondensableThermodynamics(model, conditions), TypeError);
  }
  assert.throws(() => evaluateCondensableThermodynamics({ ...model }, { temperatureK: 300, totalPressurePa: 3000 }), TypeError);
});

test('phase-explicit cool vapor survives repeated zero-energy CPU continuation and a finite sensible pulse', () => {
  const input = record(), model = createCondensableThermodynamics(input);
  const temperatureK = 278;
  const totalPressurePa = 100_000;
  let energy = independentPhases(input, temperatureK, totalPressurePa, 1000).uVapor;
  for (let evaluation = 0; evaluation < 3; evaluation += 1) {
    const state = resolveCondensableCaloricState(model, {
      phase: 'gas', specificInternalEnergyJPerKg: energy, totalPressurePa
    });
    assert.equal(state.phase, 'gas', 'sub-reference-temperature vapor is not relabeled liquid');
    assert.equal(Object.isFrozen(state), true);
    near(state.temperatureK, temperatureK, 'unchanged sensible-energy continuation');
    near(state.cvJPerKgK, 1400, 'vapor branch Cv');
    near(state.specificEnthalpyJPerKg - state.specificInternalEnergyJPerKg,
      100 * temperatureK, 'vapor H-U');
    energy = state.specificInternalEnergyJPerKg;
  }
  const pulseJPerKg = 4200;
  const warmed = resolveCondensableCaloricState(model, {
    phase: 'gas', specificInternalEnergyJPerKg: energy + pulseJPerKg, totalPressurePa
  });
  assert.equal(warmed.phase, 'gas');
  near(warmed.temperatureK, 281, 'finite heat pulse uses dU/Cv, not dU/Cp');
  assert.notEqual(warmed.temperatureK, temperatureK + pulseJPerKg / input.vaporCpJPerKgK);
});

test('phase-specific inverse admits exact energy endpoints and rejects inferred or out-of-domain phases', () => {
  const input = record({ minTemperatureK: 200.123, maxTemperatureK: 449.876 });
  const model = createCondensableThermodynamics(input);
  const totalPressurePa = 12_345;
  for (const phase of ['liquid', 'gas']) {
    const liquid = phase === 'liquid';
    const u0 = liquid ? -50_003 : 1_920_000;
    const cv = liquid ? 4000 : 1400;
    const minEnergy = u0 + cv * (input.minTemperatureK - 300);
    const maxEnergy = u0 + cv * (input.maxTemperatureK - 300);
    for (const [energy, temperatureK] of [[minEnergy, input.minTemperatureK], [maxEnergy, input.maxTemperatureK]]) {
      const state = resolveCondensableCaloricState(model, {
        phase, specificInternalEnergyJPerKg: energy, totalPressurePa
      });
      assert.equal(state.temperatureK, temperatureK, 'literal declared endpoint is not lost to inverse roundoff');
      assert.equal(state.phase, phase);
      near(state.energyMinJPerKg, minEnergy, 'phase energy minimum');
      near(state.energyMaxJPerKg, maxEnergy, 'phase energy maximum');
      near(state.specificEnthalpyJPerKg - energy,
        liquid ? totalPressurePa / input.liquidDensityKgPerM3 : 100 * temperatureK,
        'selected phase H-U');
    }
    for (const energy of [minEnergy - 1, maxEnergy + 1]) {
      assert.throws(() => resolveCondensableCaloricState(model, {
        phase, specificInternalEnergyJPerKg: energy, totalPressurePa
      }), RangeError);
    }
  }
  for (const phase of [undefined, 'mixed', 'plasma', 'vapor', 3]) {
    assert.throws(() => resolveCondensableCaloricState(model, {
      phase, specificInternalEnergyJPerKg: 1_920_000, totalPressurePa
    }), TypeError);
  }
  assert.throws(() => resolveCondensableCaloricState({ ...model }, {
    phase: 'gas', specificInternalEnergyJPerKg: 1_920_000, totalPressurePa
  }), TypeError);
});

test('factory rejects collapsed energy ranges and unrepresentable saturation before model publication', () => {
  for (const liquidReferenceEnthalpyJPerKg of [-1e30, 1e30]) {
    assert.throws(() => createCondensableThermodynamics(record({ liquidReferenceEnthalpyJPerKg })),
      RangeError, 'the declared thermal range must remain representable under a common energy zero');
  }
  // At the lower reference-temperature endpoint the other corner overflows
  // exp(log p); at the upper endpoint the opposite corner underflows to zero.
  // Both inputs have finite scalar parameters and positive latent gaps.
  for (const referenceTemperatureK of [200, 450]) {
    assert.throws(() => createCondensableThermodynamics(record({
      referenceTemperatureK, vaporizationReferenceEnthalpyJPerKg: 1e9
    })), RangeError, 'nonrepresentable saturation is not a usable declared model');
  }
});
