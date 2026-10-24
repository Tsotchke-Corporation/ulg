import assert from 'node:assert/strict';
import test from 'node:test';
import { createCondensableThermodynamics } from '../src/runtime/material/condensableThermodynamics.js';
import {
  CONDENSABLE_INTERFACE_KINETICS_SCHEMA,
  createCondensableInterfaceKinetics,
  evaluateCondensableInterfaceRates,
  isCondensableInterfaceKinetics
} from '../src/runtime/material/condensableInterfaceKinetics.js';

// Manufactured constant-capacity species, NOT water/air data, an atmospheric
// transport closure, a timestep integrator, nuclei selection or preset proof.
// Independent half-Maxwellian moments below test the zero-drift molecular limit
// of Hric & Halama (2023), equations 9 and 13–16 (not their Grad/wet-bulb model):
// https://tpfm.it.cas.cz/fm2015/im/admin/showfile/data/my/Papers/2023/08-TPFM2023.pdf
const R = 8.314462618;
const MAX_COUNT = (1n << 64n) - 1n;
const thermoRecord = (overrides = {}) => ({
  schema: 'peercompute.ulg.condensable-thermodynamics.v1',
  energyBasis: 'specific-enthalpy-at-reference-pressure',
  referenceTemperatureK: 300,
  referencePressurePa: 4000,
  liquidReferenceEnthalpyJPerKg: -32_000,
  vaporizationReferenceEnthalpyJPerKg: 300_000,
  liquidCpJPerKgK: 1200,
  vaporCpJPerKgK: 600,
  liquidDensityKgPerM3: 800,
  molarMassKgPerMol: R / 100,
  minTemperatureK: 220,
  maxTemperatureK: 420,
  maxPressurePa: 2_000_000,
  provenance: 'manufactured constant-Cp substance; not measured thermochemistry',
  ...overrides
});
const inertRecord = (overrides = {}) => ({
  id: 'synthetic-inert',
  molarMassKgPerMol: R / 200,
  cvJPerKgK: 700,
  minTemperatureK: 200,
  maxTemperatureK: 450,
  energyAccommodationCoefficient: 0.4,
  provenance: 'manufactured ideal gas with equilibrated classical internal modes',
  ...overrides
});
const interfaceRecord = (input = thermoRecord(), overrides = {}) => ({
  schema: 'peercompute.ulg.condensable-interface-kinetics.v1',
  thermodynamics: createCondensableThermodynamics(input),
  surface: {
    schema: 'peercompute.ulg.linear-pure-interface.v1',
    provenance: 'manufactured positive linear surface tension, not a fit',
    interceptNPerM: 0.12,
    slopeNPerMK: -0.00015,
    minTemperatureK: input.minTemperatureK,
    maxTemperatureK: input.maxTemperatureK
  },
  massAccommodationCoefficient: 0.35,
  vaporEnergyAccommodationCoefficient: 0.6,
  maxIncidentPressurePa: 2_000_000,
  noncondensables: [],
  provenance: 'manufactured stationary half-Maxwellian interface',
  ...overrides
});
const stateRecord = (overrides = {}) => ({
  liquidMassKg: 0.016,
  physicalDropletCount: 64n,
  liquidTemperatureK: 300,
  gasNormalStressPa: 20_000,
  vaporPopulations: [{ id: 'vapor-one', temperatureK: 320, partialPressurePa: 6000 }],
  noncondensables: [],
  ...overrides
});
function near(actual, expected, label, relative = 3e-12, absolute = 1e-12) {
  assert.ok(Number.isFinite(actual), `${label}: nonfinite actual ${actual}`);
  assert.ok(Number.isFinite(expected), `${label}: nonfinite expectation ${expected}`);
  assert.ok(Math.abs(actual - expected) <= absolute + relative * Math.abs(expected),
    `${label}: ${actual} versus independent ${expected}`);
}
const zero = (actual, label) => assert.ok(actual === 0, `${label}: ${actual}`);

// This oracle integrates each phase's Gibbs potential using the input Cp/H
// references. It never calls the runtime equilibrium or caloric evaluator.
// The common H zero cancels before arithmetic, including in +/-1e12 tests.
function chemicalEquilibriumPressure(input, t, liquidPressure) {
  const dt = t - input.referenceTemperatureK;
  const rs = R / input.molarMassKgPerMol;
  const entropyLog = Math.log(t / input.referenceTemperatureK);
  const liquidG = input.liquidCpJPerKgK * dt
    + (liquidPressure - input.referencePressurePa) / input.liquidDensityKgPerM3
    - t * input.liquidCpJPerKgK * entropyLog;
  const vaporGAtReferencePressure = input.vaporizationReferenceEnthalpyJPerKg
    + input.vaporCpJPerKgK * dt - t * (
      input.vaporizationReferenceEnthalpyJPerKg / input.referenceTemperatureK
      + input.vaporCpJPerKgK * entropyLog);
  return input.referencePressurePa * Math.exp((liquidG - vaporGAtReferencePressure) / (rs * t));
}
function geometry(input, record, state) {
  const radius = Math.cbrt(3 * state.liquidMassKg
    / (4 * Math.PI * input.liquidDensityKgPerM3 * Number(state.physicalDropletCount)));
  const area = 4 * Math.PI * Number(state.physicalDropletCount) * radius ** 2;
  const sigma = record.surface.interceptNPerM + record.surface.slopeNPerMK * state.liquidTemperatureK;
  const pressure = state.gasNormalStressPa + 2 * sigma / radius;
  return { radius, area, sigma, pressure,
    equilibriumPressure: chemicalEquilibriumPressure(input, state.liquidTemperatureK, pressure) };
}
function centeredVaporU(input, t) {
  const rs = R / input.molarMassKgPerMol;
  return input.vaporizationReferenceEnthalpyJPerKg - rs * input.referenceTemperatureK
    + input.referencePressurePa / input.liquidDensityKgPerM3
    + (input.vaporCpJPerKgK - rs) * (t - input.referenceTemperatureK);
}
const gross = (area, p, rs, t) => area * p / Math.sqrt(2 * Math.PI * rs * t);

// Numerical integration is deliberately independent of the runtime's algebra.
// Maxwell normal velocity z = v_n/sqrt(R_s T), integrated over z>0. The omitted
// tail beyond z=12 is <1e-29; Simpson h=12/32768 gives <1e-13 relative error.
function halfMaxwellMoment(power) {
  const intervals = 32768, h = 12 / intervals;
  const integrand = (z) => z ** power * Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  let sum = integrand(0) + integrand(12);
  for (let i = 1; i < intervals; i += 1) sum += (i % 2 ? 4 : 2) * integrand(i * h);
  return sum * h / 3;
}

test('factory keeps an original frozen authority and explicitly declines finite/live admission', () => {
  const record = interfaceRecord(thermoRecord(), { noncondensables: [inertRecord()] });
  const model = createCondensableInterfaceKinetics(record);
  assert.equal(CONDENSABLE_INTERFACE_KINETICS_SCHEMA, record.schema);
  assert.equal(isCondensableInterfaceKinetics(model), true);
  assert.equal(isCondensableInterfaceKinetics({ ...model }), false);
  assert.equal(isCondensableInterfaceKinetics(null), false);
  for (const value of [model, model.surface, model.noncondensables, model.noncondensables[0]]) {
    assert.equal(Object.isFrozen(value), true);
  }
  record.surface.interceptNPerM = 900;
  record.noncondensables[0].energyAccommodationCoefficient = 0;
  record.noncondensables.push(inertRecord({ id: 'late' }));
  assert.equal(model.surface.interceptNPerM, 0.12);
  assert.equal(model.noncondensables.length, 1);
  assert.equal(model.noncondensables[0].energyAccommodationCoefficient, 0.4);
  assert.equal(model.thermodynamics, record.thermodynamics);
  const state = stateRecord({ noncondensables: [{
    id: 'synthetic-inert', temperatureK: 310, partialPressurePa: 1000
  }] });
  const before = structuredClone(state);
  const out = evaluateCondensableInterfaceRates(model, state);
  assert.deepEqual(state, before, 'evaluation never mutates caller populations or mass');
  assert.equal(out.frame, 'stationary-interface');
  assert.equal(out.energyBasis, 'centered-on-liquid-reference-internal-energy');
  for (const flag of ['finiteIntervalAdmitted', 'farFieldTransportAdmitted',
    'liveStateEnrollment', 'scientificValidation']) assert.equal(out[flag], false);
  assert.equal('liquidTemperatureRateKPerS' in out, false, 'no invented moving-interface temperature ODE');
  assert.equal('dtSeconds' in out, false);
  for (const value of [out, out.vapor, out.vapor.incidentPopulations,
    out.vapor.incidentPopulations[0], out.noncondensables, out.noncondensables[0]]) {
    assert.equal(Object.isFrozen(value), true);
  }
});

test('gross incident flux and u+Rs*T/2 molecular energy match independent half-Maxwell integrals', () => {
  const i1 = halfMaxwellMoment(1), i3 = halfMaxwellMoment(3);
  near(i1, 1 / Math.sqrt(2 * Math.PI), 'Maxwell first moment', 2e-13, 0);
  near(i3 / i1, 2, 'flux-weighted normal squared speed', 2e-13, 0);
  for (const [vaporCp, molarMass] of [[250, R / 100], [600, R / 100],
    [1250, R / 100], [1200, 0.044]]) {
    const input = thermoRecord({ vaporCpJPerKgK: vaporCp, molarMassKgPerMol: molarMass });
    const record = interfaceRecord(input, { massAccommodationCoefficient: 1 });
    const state = stateRecord({ vaporPopulations: [{ id: 'incident', temperatureK: 350, partialPressurePa: 7300 }] });
    const out = evaluateCondensableInterfaceRates(createCondensableInterfaceKinetics(record), state);
    const { area } = geometry(input, record, state), t = 350, rs = R / input.molarMassKgPerMol;
    const gasDensity = 7300 / (rs * t);
    const massFlux = area * gasDensity * Math.sqrt(rs * t) * i1;
    const fluxTranslationalEnergy = rs * t * (0.5 * i3 / i1 + 1);
    const cv = vaporCp - rs;
    const molecularEnergy = centeredVaporU(input, t) - 1.5 * rs * t + fluxTranslationalEnergy;
    const row = out.vapor.incidentPopulations[0];
    near(row.incidentMassRateKgPerS, massFlux, 'gross mass from density and Maxwell integral');
    near(row.condensationRateKgPerS, massFlux, 'full accommodation');
    near(row.centeredMolecularEnergyRateIntoLiquidW, massFlux * molecularEnergy, 'molecular kinetic/internal flux');
    near(molecularEnergy, centeredVaporU(input, t) + 0.5 * rs * t, 'effusion excess over bulk U');
    assert.ok(cv >= 1.5 * rs);
    const wrongEnthalpy = massFlux * (centeredVaporU(input, t) + rs * t);
    assert.ok(Math.abs(row.centeredMolecularEnergyRateIntoLiquidW - wrongEnthalpy) > massFlux * rs * t * 0.49,
      'enthalpy transport would be a measurable wrong answer');
  }
});

test('multiple actual vapor temperatures and independent inert temperatures give species-resolved heat', () => {
  const input = thermoRecord();
  const inerts = [inertRecord(), inertRecord({ id: 'cold-monatomic', cvJPerKgK: 300,
    energyAccommodationCoefficient: 0.8 })];
  const record = interfaceRecord(input, { noncondensables: inerts });
  const state = stateRecord({
    liquidTemperatureK: 310,
    vaporPopulations: [{ id: 'hot', temperatureK: 380, partialPressurePa: 10_000 },
      { id: 'cold', temperatureK: 250, partialPressurePa: 2500 }],
    noncondensables: [{ id: 'cold-monatomic', temperatureK: 260, partialPressurePa: 3000 },
      { id: 'synthetic-inert', temperatureK: 400, partialPressurePa: 5000 }]
  });
  const out = evaluateCondensableInterfaceRates(createCondensableInterfaceKinetics(record), state);
  const g = geometry(input, record, state), tl = state.liquidTemperatureK;
  const rs = R / input.molarMassKgPerMol, cv = input.vaporCpJPerKgK - rs;
  let condensation = 0, vaporIncomingEnergy = 0, reflection = 0;
  for (const population of state.vaporPopulations) {
    const row = out.vapor.incidentPopulations.find(({ id }) => id === population.id);
    const incoming = gross(g.area, population.partialPressurePa, rs, population.temperatureK);
    const capture = record.massAccommodationCoefficient * incoming;
    const reflected = (1 - record.massAccommodationCoefficient) * incoming
      * record.vaporEnergyAccommodationCoefficient * (cv + 0.5 * rs) * (population.temperatureK - tl);
    const energy = capture * (centeredVaporU(input, population.temperatureK) + 0.5 * rs * population.temperatureK)
      + reflected;
    near(row.incidentMassRateKgPerS, incoming, `${population.id} independent gross flux`);
    near(row.condensationRateKgPerS, capture, `${population.id} capture`);
    near(row.reflectedHeatRateIntoLiquidW, reflected, `${population.id} reflected heat`);
    near(row.centeredMolecularEnergyRateIntoLiquidW, energy, `${population.id} incoming-only energy`);
    condensation += capture; vaporIncomingEnergy += energy; reflection += reflected;
  }
  const evaporation = record.massAccommodationCoefficient * gross(g.area, g.equilibriumPressure, rs, tl);
  const outgoingEnergy = evaporation * (centeredVaporU(input, tl) + 0.5 * rs * tl);
  const netMass = condensation - evaporation, vaporEnergy = vaporIncomingEnergy - outgoingEnergy;
  let inertHeat = 0;
  for (const gas of inerts) {
    const population = state.noncondensables.find(({ id }) => id === gas.id);
    const row = out.noncondensables.find(({ id }) => id === gas.id);
    const gasR = R / gas.molarMassKgPerMol;
    const heat = gross(g.area, population.partialPressurePa, gasR, population.temperatureK)
      * gas.energyAccommodationCoefficient * (gas.cvJPerKgK + 0.5 * gasR) * (population.temperatureK - tl);
    near(row.heatRateIntoLiquidW, heat, `${gas.id} actual-temperature heat`);
    zero(row.gasMassRateKgPerS, `${gas.id} has no mass sink`);
    near(row.gasEnergyRateW, -heat, `${gas.id} balanced gas energy`);
    inertHeat += heat;
  }
  near(out.vapor.condensationRateKgPerS, condensation, 'total condensation');
  near(out.vapor.evaporationRateKgPerS, evaporation, 'one surface evaporation');
  near(out.massRateIntoLiquidKgPerS, netMass, 'net physical mass');
  near(out.vapor.emittedCenteredEnergyRateW, outgoingEnergy, 'outgoing centered molecular energy');
  near(out.vapor.reflectedHeatRateIntoLiquidW, reflection, 'reflection aggregate');
  near(out.vapor.centeredMolecularEnergyRateIntoLiquidW, vaporEnergy, 'vapor energy balance');
  near(out.centeredMolecularEnergyRateIntoLiquidW, vaporEnergy + inertHeat, 'all populations energy balance');
  near(out.vapor.gasMassRateKgPerS, -netMass, 'gas mass opposite liquid');
  near(out.vapor.gasCenteredEnergyRateW, -vaporEnergy, 'vapor energy opposite liquid');
  near(out.centeredMolecularEnergyRateIntoLiquidW + out.vapor.gasCenteredEnergyRateW
    + out.noncondensables.reduce((s, row) => s + row.gasEnergyRateW, 0), 0, 'closed molecular budget', 0, 1e-9);
});

test('common-temperature coexistence has detailed balance with nonzero gross traffic', () => {
  const input = thermoRecord(), record = interfaceRecord(input), state = stateRecord();
  const g = geometry(input, record, state);
  state.vaporPopulations = [{ id: 'coexisting', temperatureK: state.liquidTemperatureK,
    partialPressurePa: g.equilibriumPressure }];
  const out = evaluateCondensableInterfaceRates(createCondensableInterfaceKinetics(record), state);
  near(out.massRateIntoLiquidKgPerS, 0, 'coexistence mass', 0, 2e-15);
  near(out.centeredMolecularEnergyRateIntoLiquidW, 0, 'coexistence energy', 0, 5e-10);
  near(out.vapor.condensationRateKgPerS, out.vapor.evaporationRateKgPerS, 'gross detailed balance');
  assert.ok(out.vapor.condensationRateKgPerS > 0);
  zero(out.vapor.reflectedHeatRateIntoLiquidW, 'equal-temperature reflection');
});

test('zero net mass with hotter vapor still carries captured and reflected heat', () => {
  const input = thermoRecord(), record = interfaceRecord(input), state = stateRecord();
  const g = geometry(input, record, state), tl = state.liquidTemperatureK, tv = 400;
  state.vaporPopulations = [{ id: 'balanced-hot', temperatureK: tv,
    partialPressurePa: g.equilibriumPressure * Math.sqrt(tv / tl) }];
  const out = evaluateCondensableInterfaceRates(createCondensableInterfaceKinetics(record), state);
  const incoming = gross(g.area, g.equilibriumPressure, 100, tl);
  const expectedHeat = incoming * (record.massAccommodationCoefficient
    + (1 - record.massAccommodationCoefficient) * record.vaporEnergyAccommodationCoefficient)
    * (input.vaporCpJPerKgK - 50) * (tv - tl);
  near(out.massRateIntoLiquidKgPerS, 0, 'balanced incoming and outgoing mass', 0, 2e-15);
  near(out.centeredMolecularEnergyRateIntoLiquidW, expectedHeat, 'nonzero thermal accommodation without net condensation');
  assert.ok(out.centeredMolecularEnergyRateIntoLiquidW > 0);
});

test('partitioning or reordering incoming vapor never multiplies evaporation', () => {
  const input = thermoRecord(), record = interfaceRecord(input);
  const model = createCondensableInterfaceKinetics(record);
  const state = stateRecord({ vaporPopulations: [{ id: 'whole', temperatureK: 350, partialPressurePa: 8192 }] });
  const whole = evaluateCondensableInterfaceRates(model, state);
  const partition = [0.125, 0.375, 0.5].map((fraction, index) => ({
    id: `part-${index}`, temperatureK: 350, partialPressurePa: 8192 * fraction
  }));
  for (const populations of [partition, [...partition].reverse()]) {
    const split = evaluateCondensableInterfaceRates(model, { ...state, vaporPopulations: populations });
    for (const field of ['condensationRateKgPerS', 'evaporationRateKgPerS', 'netMassRateIntoLiquidKgPerS',
      'emittedCenteredEnergyRateW', 'centeredMolecularEnergyRateIntoLiquidW', 'reflectedHeatRateIntoLiquidW']) {
      near(split.vapor[field], whole.vapor[field], `population partition preserves ${field}`);
    }
  }
});

test('incident-pressure admission caps the whole declared mixture and is invariant under source partition', () => {
  const input = thermoRecord();
  const record = interfaceRecord(input, { maxIncidentPressurePa: 10_000, noncondensables: [inertRecord()] });
  const model = createCondensableInterfaceKinetics(record);
  const state = stateRecord({
    vaporPopulations: [{ id: 'single', temperatureK: 320, partialPressurePa: 6000 }],
    noncondensables: [{ id: 'synthetic-inert', temperatureK: 310, partialPressurePa: 4000 }]
  });
  const single = evaluateCondensableInterfaceRates(model, state);
  const split = evaluateCondensableInterfaceRates(model, { ...state,
    vaporPopulations: [{ id: 'first', temperatureK: 320, partialPressurePa: 2000 },
      { id: 'second', temperatureK: 320, partialPressurePa: 4000 }] });
  near(single.massRateIntoLiquidKgPerS, split.massRateIntoLiquidKgPerS, 'same admitted mixture under partition');
  for (const populations of [[{ id: 'single', temperatureK: 320, partialPressurePa: 6001 }],
    [{ id: 'first', temperatureK: 320, partialPressurePa: 2000 },
      { id: 'second', temperatureK: 320, partialPressurePa: 4001 }]]) {
    assert.throws(() => evaluateCondensableInterfaceRates(model, { ...state, vaporPopulations: populations }),
      'splitting vapor rows cannot hide an over-limit vapor+inert mixture');
  }
  assert.ok(single.liquidPressurePa > record.maxIncidentPressurePa,
    'incident pressure cap does not replace the separate liquid mechanical-pressure domain');
});

test('outgoing equilibrium pressure is not confused with the incoming mixture pressure cap', () => {
  const record = interfaceRecord(thermoRecord(), { maxIncidentPressurePa: 1 });
  const out = evaluateCondensableInterfaceRates(createCondensableInterfaceKinetics(record),
    stateRecord({ liquidTemperatureK: 420, gasNormalStressPa: 0, vaporPopulations: [] }));
  assert.ok(out.equilibriumVaporPressurePa > record.maxIncidentPressurePa);
  assert.ok(out.vapor.evaporationRateKgPerS > 0);
});

test('nonzero mathematical net flux cannot silently underflow to an accepted zero rate', () => {
  const input = thermoRecord(), record = interfaceRecord(input, { massAccommodationCoefficient: 1e-310 });
  const state = stateRecord(), g = geometry(input, record, state);
  state.vaporPopulations = [{ id: 'slightly-supersaturated', temperatureK: 300,
    partialPressurePa: g.equilibriumPressure * (1 + 1e-14) }];
  assert.ok(record.massAccommodationCoefficient * gross(g.area, g.equilibriumPressure, 100, 300) > 0,
    'gross captured/emitted flux remains representable; only the net flux underflows');
  assert.throws(() => evaluateCondensableInterfaceRates(createCondensableInterfaceKinetics(record), state));
});

test('an explicitly empty vapor list evaporates once; an extra zero-pressure row changes nothing', () => {
  const input = thermoRecord(), record = interfaceRecord(input), model = createCondensableInterfaceKinetics(record);
  const state = stateRecord({ vaporPopulations: [] }), g = geometry(input, record, state);
  const out = evaluateCondensableInterfaceRates(model, state);
  const evaporation = record.massAccommodationCoefficient * gross(g.area, g.equilibriumPressure, 100, 300);
  near(out.massRateIntoLiquidKgPerS, -evaporation, 'vacuum evaporation');
  zero(out.vapor.condensationRateKgPerS, 'vacuum has no incoming gas');
  assert.equal(out.vapor.incidentPopulations.length, 0);
  near(out.centeredMolecularEnergyRateIntoLiquidW, -evaporation * (270_005 + 15_000), 'vacuum outgoing energy');
  const emptyRow = evaluateCondensableInterfaceRates(model, { ...state,
    vaporPopulations: [{ id: 'zero-pressure', temperatureK: 420, partialPressurePa: 0 }] });
  near(emptyRow.massRateIntoLiquidKgPerS, out.massRateIntoLiquidKgPerS, 'zero-pressure mass');
  near(emptyRow.centeredMolecularEnergyRateIntoLiquidW, out.centeredMolecularEnergyRateIntoLiquidW, 'zero-pressure energy');
});

test('zero accommodation disables only its corresponding capture or heat mechanism', () => {
  const input = thermoRecord();
  for (const alpha of [0, 1]) for (const beta of [0, 1]) {
    const record = interfaceRecord(input, { massAccommodationCoefficient: alpha,
      vaporEnergyAccommodationCoefficient: beta,
      noncondensables: [inertRecord({ energyAccommodationCoefficient: 0 })] });
    const state = stateRecord({ noncondensables: [{
      id: 'synthetic-inert', temperatureK: 450, partialPressurePa: 100_000
    }] });
    const out = evaluateCondensableInterfaceRates(createCondensableInterfaceKinetics(record), state);
    zero(out.noncondensables[0].heatRateIntoLiquidW, 'unaccommodated inert');
    if (alpha === 0) {
      zero(out.massRateIntoLiquidKgPerS, 'no capture or evaporation');
      zero(out.vapor.evaporationRateKgPerS, 'same zero evaporation coefficient');
      zero(out.vapor.condensationRateKgPerS, 'zero condensation coefficient');
      near(out.centeredMolecularEnergyRateIntoLiquidW, out.vapor.reflectedHeatRateIntoLiquidW, 'reflection can exchange heat without mass');
      if (beta === 0) zero(out.centeredMolecularEnergyRateIntoLiquidW, 'fully elastic vapor');
      else assert.ok(out.centeredMolecularEnergyRateIntoLiquidW > 0);
    }
    if (alpha === 1 || beta === 0) zero(out.vapor.reflectedHeatRateIntoLiquidW, 'no retained-molecule double reflection');
  }
});

for (const species of ['vapor', 'inert']) {
  test(`representable ${species} accommodation heat survives an underflow-prone intermediate product`, () => {
    const input = thermoRecord();
    const record = interfaceRecord(input, { massAccommodationCoefficient: 0,
      vaporEnergyAccommodationCoefficient: species === 'vapor' ? Number.MIN_VALUE : 0,
      noncondensables: species === 'inert'
        ? [inertRecord({ energyAccommodationCoefficient: Number.MIN_VALUE })] : [] });
    const state = stateRecord({ vaporPopulations: species === 'vapor'
      ? [{ id: 'very-weak-reflection', temperatureK: 400, partialPressurePa: 6000 }] : [],
    noncondensables: species === 'inert'
      ? [{ id: 'synthetic-inert', temperatureK: 450, partialPressurePa: 5000 }] : [] });
    const out = evaluateCondensableInterfaceRates(createCondensableInterfaceKinetics(record), state);
    const { area } = geometry(input, record, state);
    const unscaledHeat = species === 'vapor'
      ? gross(area, 6000, 100, 400) * 550 * 100
      : gross(area, 5000, 200, 450) * 800 * 150;
    const expected = unscaledHeat * Number.MIN_VALUE;
    assert.ok(expected > 0, 'final heat is a genuinely representable nonzero subnormal');
    assert.ok(out.centeredMolecularEnergyRateIntoLiquidW > 0, 'weak accommodation is not silently removed');
    // Two binary64 subnormal ULPs, not a relative budget that rounds to zero.
    near(out.centeredMolecularEnergyRateIntoLiquidW, expected, 'scaled nonzero heat', 0, 2 * Number.MIN_VALUE);
    zero(out.massRateIntoLiquidKgPerS, 'no mass transfer in this independent heat case');
  });
}

test('phase reference energy is carried once, with no extra latent heat or surface bonus', () => {
  const input = thermoRecord(), record = interfaceRecord(input), state = stateRecord({
    vaporPopulations: [{ id: 'isothermal', temperatureK: 300, partialPressurePa: 9000 }]
  });
  const out = evaluateCondensableInterfaceRates(createCondensableInterfaceKinetics(record), state);
  const eps = 300_000 - 100 * 300 + 4000 / 800 + 0.5 * 100 * 300;
  near(out.centeredMolecularEnergyRateIntoLiquidW, out.massRateIntoLiquidKgPerS * eps, 'one transported molecular energy');
  assert.ok(out.massRateIntoLiquidKgPerS > 0);
  assert.ok(out.surfaceEnergyRateW > 0);
  const latentDoubleCount = out.massRateIntoLiquidKgPerS * (eps + input.vaporizationReferenceEnthalpyJPerKg);
  assert.ok(Math.abs(out.centeredMolecularEnergyRateIntoLiquidW - latentDoubleCount) > 0.9 * out.massRateIntoLiquidKgPerS * 300_000);
});

test('explicit normal stress and one Laplace/Poynting correction determine equilibrium pressure', () => {
  const input = thermoRecord(), record = interfaceRecord(input), radius = 1e-6;
  const state = stateRecord({ liquidMassKg: 4 * Math.PI / 3 * input.liquidDensityKgPerM3 * 64 * radius ** 3,
    gasNormalStressPa: 100_000 });
  const model = createCondensableInterfaceKinetics(record);
  const out = evaluateCondensableInterfaceRates(model, state);
  const sigma = 0.12 - 0.00015 * 300, laplace = 2 * sigma / radius;
  const expectedPressure = 4000 * Math.exp((100_000 + laplace - 4000) / (800 * 100 * 300));
  near(out.radiusM, radius, 'physical radius', 3e-12, 0);
  near(out.liquidPressurePa, 100_000 + laplace, 'explicit normal stress plus one Laplace jump');
  near(out.equilibriumVaporPressurePa, expectedPressure, 'one pressure chemical-potential correction');
  const wrongTwice = expectedPressure * Math.exp(laplace / (800 * 100 * 300));
  assert.ok(Math.abs(out.equilibriumVaporPressurePa - wrongTwice) > 20, 'test distinguishes duplicated Kelvin factor');
  const differentIncident = evaluateCondensableInterfaceRates(model, { ...state,
    vaporPopulations: [{ id: 'other-pressure', temperatureK: 300, partialPressurePa: 170_000 }] });
  near(differentIncident.equilibriumVaporPressurePa, out.equilibriumVaporPressurePa, 'incident vapor partial is not mechanical stress');
  const differentStress = evaluateCondensableInterfaceRates(model, { ...state, gasNormalStressPa: 300_000 });
  near(Math.log(differentStress.equilibriumVaporPressurePa / out.equilibriumVaporPressurePa),
    200_000 / (800 * 100 * 300), 'explicit stress changes liquid chemical potential');
  const noVapor = evaluateCondensableInterfaceRates(model, { ...state, vaporPopulations: [] });
  near(noVapor.liquidPressurePa, out.liquidPressurePa, 'vacuum incoming distribution does not invent normal stress');
});

test('common +/-1e12 energy gauge shifts change only the reported reference zero', () => {
  const input = thermoRecord(), record = interfaceRecord(input, { noncondensables: [inertRecord()] });
  const state = stateRecord({ liquidTemperatureK: 340,
    vaporPopulations: [{ id: 'warm', temperatureK: 390, partialPressurePa: 35_000 },
      { id: 'cold', temperatureK: 270, partialPressurePa: 2000 }],
    noncondensables: [{ id: 'synthetic-inert', temperatureK: 280, partialPressurePa: 7000 }] });
  const base = evaluateCondensableInterfaceRates(createCondensableInterfaceKinetics(record), state);
  for (const shift of [-1e12, 1e12]) {
    const shifted = interfaceRecord(thermoRecord({ liquidReferenceEnthalpyJPerKg: input.liquidReferenceEnthalpyJPerKg + shift }),
      { noncondensables: [inertRecord()] });
    const out = evaluateCondensableInterfaceRates(createCondensableInterfaceKinetics(shifted), state);
    assert.equal(out.energyGaugeJPerKg, base.energyGaugeJPerKg + shift);
    const { energyGaugeJPerKg: ignoredBase, ...basePhysical } = base;
    const { energyGaugeJPerKg: ignoredShift, ...shiftedPhysical } = out;
    assert.deepEqual(shiftedPhysical, basePhysical, 'direct phase gap makes all centered physical outputs gauge-invariant');
  }
  const rawVaporU = input.liquidReferenceEnthalpyJPerKg + input.vaporizationReferenceEnthalpyJPerKg
    + input.vaporCpJPerKgK * (390 - input.referenceTemperatureK) - 100 * 390;
  const row = base.vapor.incidentPopulations[0];
  near(row.centeredMolecularEnergyRateIntoLiquidW + row.condensationRateKgPerS * base.energyGaugeJPerKg,
    row.condensationRateKgPerS * (rawVaporU + 50 * 390) + row.reflectedHeatRateIntoLiquidW,
    'reported gauge reconstructs absolute incoming energy');
});

test('splitting physical N and liquid mass proportionally preserves radius and scales extensive rates', () => {
  const input = thermoRecord(), record = interfaceRecord(input), model = createCondensableInterfaceKinetics(record);
  const state = stateRecord(), whole = evaluateCondensableInterfaceRates(model, state);
  const part = evaluateCondensableInterfaceRates(model, { ...state,
    liquidMassKg: state.liquidMassKg / 8, physicalDropletCount: state.physicalDropletCount / 8n });
  for (const field of ['radiusM', 'liquidPressurePa', 'equilibriumVaporPressurePa', 'radiusRateMPerS']) {
    near(part[field], whole[field], `same physical drops retain ${field}`);
  }
  for (const field of ['surfaceAreaM2', 'surfaceEnergyJ', 'massRateIntoLiquidKgPerS',
    'centeredMolecularEnergyRateIntoLiquidW', 'areaRateM2PerS', 'surfaceEnergyRateW']) {
    near(part[field] * 8, whole[field], `extensive partition preserves ${field}`);
  }
  const moreDrops = evaluateCondensableInterfaceRates(model, { ...state, physicalDropletCount: 512n });
  near(moreDrops.radiusM, whole.radiusM / 2, 'eightfold physical N halves radius');
  near(moreDrops.surfaceAreaM2, whole.surfaceAreaM2 * 2, 'fixed mass, more real drops means more area');
});

test('surface energy and fixed-N geometric derivatives use sigma-T*dSigma/dT, not sigma', () => {
  const input = thermoRecord(), record = interfaceRecord(input), model = createCondensableInterfaceKinetics(record);
  for (const populations of [[], [{ id: 'condensing', temperatureK: 300, partialPressurePa: 12_000 }]]) {
    const state = stateRecord({ vaporPopulations: populations });
    const out = evaluateCondensableInterfaceRates(model, state), g = geometry(input, record, state);
    const a = record.surface.interceptNPerM, dm = out.massRateIntoLiquidKgPerS;
    const dr = dm / (input.liquidDensityKgPerM3 * g.area);
    const dA = 8 * Math.PI * Number(state.physicalDropletCount) * g.radius * dr;
    near(out.surfaceEnergyJ, a * g.area, 'surface internal energy a*A');
    near(out.radiusRateMPerS, dr, 'fixed-N sphere mass derivative');
    near(out.areaRateM2PerS, dA, 'sphere area derivative');
    near(out.surfaceEnergyRateW, a * dA, 'surface internal energy rate');
    assert.ok(Math.abs(out.surfaceEnergyJ - g.sigma * g.area) > 0.3 * out.surfaceEnergyJ,
      'surface Helmholtz free energy is not internal energy');
    assert.ok(Math.abs(out.surfaceEnergyRateW - g.sigma * dA) > 0.3 * Math.abs(out.surfaceEnergyRateW));
  }
});

for (const [label, change] of [
  ['foreign schema', (r) => { r.schema = 'wrong'; }],
  ['copied thermodynamic model', (r) => { r.thermodynamics = { ...r.thermodynamics }; }],
  ['missing model provenance', (r) => { r.provenance = ' '; }],
  ['missing explicit noncondensables', (r) => { delete r.noncondensables; }],
  ['missing explicit incident pressure cap', (r) => { delete r.maxIncidentPressurePa; }],
  ['unknown surface schema', (r) => { r.surface.schema = 'unknown'; }],
  ['missing surface provenance', (r) => { delete r.surface.provenance; }],
  ['zero surface intercept', (r) => { r.surface.interceptNPerM = 0; }],
  ['nonpositive endpoint surface tension', (r) => {
    // Both coefficients and the endpoint product are exact binary fractions;
    // decimal -0.12/420 instead leaves a tiny *positive* binary64 residual.
    r.surface.interceptNPerM = 420 / 256; r.surface.slopeNPerMK = -1 / 256;
  }],
  ['surface domain omits cold liquid', (r) => { r.surface.minTemperatureK = 221; }],
  ['surface domain omits warm liquid', (r) => { r.surface.maxTemperatureK = 419; }],
  ['duplicate inert species', (r) => { r.noncondensables = [inertRecord(), inertRecord()]; }],
  ['blank inert ID', (r) => { r.noncondensables = [inertRecord({ id: ' ' })]; }],
  ['inert omits translational Cv', (r) => { r.noncondensables = [inertRecord({ cvJPerKgK: 299 })]; }],
  ['inert omits hot liquid domain', (r) => { r.noncondensables = [inertRecord({ maxTemperatureK: 419 })]; }],
  ['inert has no provenance', (r) => { r.noncondensables = [inertRecord({ provenance: '' })]; }],
  ['zero inert molar mass', (r) => { r.noncondensables = [inertRecord({ molarMassKgPerMol: 0 })]; }]
]) test(`factory rejects ${label}`, () => {
  const record = interfaceRecord(); change(record);
  assert.throws(() => createCondensableInterfaceKinetics(record));
});

for (const limit of [0, -1, NaN, Infinity, '2000000']) {
  test(`factory rejects incident pressure cap ${String(limit)}`, () => {
    assert.throws(() => createCondensableInterfaceKinetics(interfaceRecord(thermoRecord(), { maxIncidentPressurePa: limit })));
  });
}

for (const field of ['massAccommodationCoefficient', 'vaporEnergyAccommodationCoefficient']) {
  for (const value of [-0.001, 1.001, NaN, Infinity, '0.5', undefined]) {
    test(`factory rejects ${field}=${String(value)}`, () => {
      assert.throws(() => createCondensableInterfaceKinetics(interfaceRecord(thermoRecord(), { [field]: value })));
    });
  }
}

test('factory rejects a thermodynamically valid vapor below classical translational Cv', () => {
  const input = thermoRecord({ vaporCpJPerKgK: 249 });
  const original = createCondensableThermodynamics(input);
  assert.equal(original.vaporCvJPerKgK, 149);
  assert.throws(() => createCondensableInterfaceKinetics(interfaceRecord(input, { thermodynamics: original })));
});

test('copied or serialized interface authorities cannot evaluate', () => {
  const model = createCondensableInterfaceKinetics(interfaceRecord());
  for (const impostor of [{ ...model }, JSON.parse(JSON.stringify(model)), null, {}]) {
    assert.throws(() => evaluateCondensableInterfaceRates(impostor, stateRecord()));
  }
});

for (const count of [0n, -1n, MAX_COUNT + 1n, 64, 1.5, '64', undefined]) {
  test(`physical droplet count ${String(count)} must not be invented, rounded or coerced`, () => {
    const model = createCondensableInterfaceKinetics(interfaceRecord());
    assert.throws(() => evaluateCondensableInterfaceRates(model, stateRecord({ physicalDropletCount: count })));
  });
}

test('explicit maximum u64 count is accepted with representable geometry, not clamped to u32', () => {
  const input = thermoRecord(), record = interfaceRecord(input), radius = 0.001;
  const state = stateRecord({ physicalDropletCount: MAX_COUNT,
    liquidMassKg: Number(MAX_COUNT) * (4 * Math.PI / 3) * input.liquidDensityKgPerM3 * radius ** 3 });
  const out = evaluateCondensableInterfaceRates(createCondensableInterfaceKinetics(record), state);
  near(out.radiusM, radius, 'u64 physical radius', 3e-12, 0);
  near(out.surfaceAreaM2, 4 * Math.PI * Number(MAX_COUNT) * radius ** 2, 'u64 total surface');
});

for (const [label, change] of [
  ['zero liquid mass', (s) => { s.liquidMassKg = 0; }],
  ['negative liquid mass', (s) => { s.liquidMassKg = -1; }],
  ['string liquid mass', (s) => { s.liquidMassKg = '0.016'; }],
  ['NaN liquid mass', (s) => { s.liquidMassKg = NaN; }],
  ['infinite liquid mass', (s) => { s.liquidMassKg = Infinity; }],
  ['cold liquid outside domain', (s) => { s.liquidTemperatureK = 219; }],
  ['hot liquid outside domain', (s) => { s.liquidTemperatureK = 421; }],
  ['missing normal stress', (s) => { delete s.gasNormalStressPa; }],
  ['negative normal stress', (s) => { s.gasNormalStressPa = -1; }],
  ['string normal stress', (s) => { s.gasNormalStressPa = '1000'; }],
  ['liquid pressure including Laplace exceeds domain', (s) => { s.gasNormalStressPa = 2_000_000; }],
  ['missing vapor array', (s) => { delete s.vaporPopulations; }],
  ['duplicate vapor population', (s) => { s.vaporPopulations.push({ ...s.vaporPopulations[0] }); }],
  ['blank vapor ID', (s) => { s.vaporPopulations[0].id = ''; }],
  ['negative vapor pressure', (s) => { s.vaporPopulations[0].partialPressurePa = -1; }],
  ['infinite vapor pressure', (s) => { s.vaporPopulations[0].partialPressurePa = Infinity; }],
  ['string vapor pressure', (s) => { s.vaporPopulations[0].partialPressurePa = '1000'; }],
  ['NaN vapor temperature', (s) => { s.vaporPopulations[0].temperatureK = NaN; }],
  ['out-of-domain vapor temperature', (s) => { s.vaporPopulations[0].temperatureK = 421; }],
  ['missing explicit inert states', (s) => { delete s.noncondensables; }],
  ['undeclared air assumption', (s) => { s.noncondensables = [{ id: 'air', temperatureK: 300, partialPressurePa: 101325 }]; }],
  ['positive unrepresentable gross incident flux', (s) => { s.vaporPopulations[0].partialPressurePa = Number.MIN_VALUE; }]
]) test(`rate evaluation rejects ${label} without mutating input`, () => {
  const model = createCondensableInterfaceKinetics(interfaceRecord()), state = stateRecord();
  change(state); const before = structuredClone(state);
  assert.throws(() => evaluateCondensableInterfaceRates(model, state));
  assert.deepEqual(state, before);
});

for (const [label, states] of [
  ['missing declared inert', []],
  ['wrong inert identity', [{ id: 'different', temperatureK: 300, partialPressurePa: 0 }]],
  ['duplicate inert', [{ id: 'synthetic-inert', temperatureK: 300, partialPressurePa: 1 },
    { id: 'synthetic-inert', temperatureK: 300, partialPressurePa: 2 }]],
  ['inert below its own domain', [{ id: 'synthetic-inert', temperatureK: 199, partialPressurePa: 1 }]],
  ['inert above its own domain', [{ id: 'synthetic-inert', temperatureK: 451, partialPressurePa: 1 }]],
  ['inert negative pressure', [{ id: 'synthetic-inert', temperatureK: 300, partialPressurePa: -1 }]],
  ['inert nonfinite temperature', [{ id: 'synthetic-inert', temperatureK: Infinity, partialPressurePa: 1 }]]
]) test(`declared noncondensables require exact valid states: ${label}`, () => {
  const model = createCondensableInterfaceKinetics(interfaceRecord(thermoRecord(), { noncondensables: [inertRecord()] }));
  assert.throws(() => evaluateCondensableInterfaceRates(model, stateRecord({ noncondensables: states })));
});
