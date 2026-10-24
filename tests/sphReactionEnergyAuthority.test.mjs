import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONDENSABLE_THERMODYNAMICS_SCHEMA,
  createCondensableThermodynamics
} from '../src/runtime/material/condensableThermodynamics.js';
import { stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import { buildMlsMpmGpuParticleBuffers, buildSphGpuParticleBuffers } from '../src/runtime/sph/sphGpuBuffers.js';
import { createSphState } from '../src/runtime/sph/sphState.js';
import { buildSphThermalClosureGraphBuffers, buildSphThermalMaterialTable,
  buildSphThermalPhaseResponseTable, runSphThermalStepCpu } from '../src/runtime/sph/sphThermalGpuKernel.js';
import { buildSphReactionTable, runSphReactionStepCpu, runSphReactionStepWebGpu } from '../src/runtime/sph/sphReactionGpuKernel.js';

// Manufactured atom/mass-balanced chemistry, NOT reference measurements or a
// water/peroxide fit. The oracle below independently evaluates constant-Cv
// phase graphs and the closed, reference-corrected reaction energy equation.
// It never calls the new reaction-energy solver to compute its expectations.
const R = 8.314462618;
const T_REF = 300;
const P_REF = 3000;
const T_MIN = 200;
const T_MAX = 500;
const REFERENCE_SCHEMA = 'peercompute.ulg.reaction-energy-reference.v1';
const DATA = Object.freeze({
  h2: { formula: 'H2', molarMass: 0.002, liquidCv: 6000, vaporCv: 5000, liquidU: -50_000, density: 1000 },
  o2: { formula: 'O2', molarMass: 0.032, liquidCv: 1500, vaporCv: 1000, liquidU: -100_000, density: 1200 },
  h2o: { formula: 'H2O', molarMass: 0.018, liquidCv: 4000, vaporCv: 2000, liquidU: -200_000, density: 900 },
  h2o2: { formula: 'H2O2', molarMass: 0.034, liquidCv: 3000, vaporCv: 3000, liquidU: -60_000, density: 1100 }
});
const DEFAULT_DELTA_U = -2460;
// At these manufactured magnitudes, final U is f32 (<=0.125 J/kg per ULP)
// and T is f32 (<=3.06e-5 K per ULP). The declared ceilings include packing
// and graph inversion; they are not scientific comparison tolerances.
const U_TOL = 0.3;
const T_TOL = 0.001;
const ENERGY_TOL = 0.035;
const near = (actual, expected, tolerance, label) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
  `${label}: actual ${actual}, expected ${expected}, tolerance ${tolerance}`
);
const fractions = (phaseId) => [1, 2, 3, 4].map((id) => Number(id === phaseId));
const halfF32Ulp = (value) => Math.max(2 ** -150,
  value === 0 ? 0 : 2 ** (Math.floor(Math.log2(Math.abs(value))) - 24));

function parameters(material, shift = 0) {
  const d = DATA[material];
  return {
    schema: CONDENSABLE_THERMODYNAMICS_SCHEMA,
    energyBasis: 'specific-enthalpy-at-reference-pressure',
    referenceTemperatureK: T_REF,
    referencePressurePa: P_REF,
    liquidReferenceEnthalpyJPerKg: d.liquidU + shift + P_REF / d.density,
    vaporizationReferenceEnthalpyJPerKg: 2_000_000,
    liquidCpJPerKgK: d.liquidCv,
    vaporCpJPerKgK: d.vaporCv + R / d.molarMass,
    liquidDensityKgPerM3: d.density,
    molarMassKgPerMol: d.molarMass,
    minTemperatureK: T_MIN,
    maxTemperatureK: T_MAX,
    maxPressurePa: 2_000_000,
    provenance: `independent manufactured caloric graph for ${material}`
  };
}

function analyticPhase(material, phaseId, shifts = {}) {
  const p = parameters(material, shifts[material] ?? 0);
  const cv = phaseId === 2 ? p.liquidCpJPerKgK : p.vaporCpJPerKgK - R / p.molarMassKgPerMol;
  const u0 = phaseId === 2
    ? p.liquidReferenceEnthalpyJPerKg - P_REF / p.liquidDensityKgPerM3
    : p.liquidReferenceEnthalpyJPerKg + p.vaporizationReferenceEnthalpyJPerKg - R * T_REF / p.molarMassKgPerMol;
  // The existing table's explicit phase graph is defined by f32 endpoints.
  // Reconstruct that declared linear graph independently, not from outputs.
  const lo = Math.fround(u0 + cv * (T_MIN - T_REF));
  const hi = Math.fround(u0 + cv * (T_MAX - T_REF));
  const packedCv = (hi - lo) / (T_MAX - T_MIN);
  return {
    cv: packedCv,
    uAt: (temperatureK) => lo + packedCv * (temperatureK - T_MIN),
    tAt: (u) => T_MIN + (u - lo) / packedCv,
    rho: Math.fround(phaseId === 2 ? p.liquidDensityKgPerM3 : P_REF * p.molarMassKgPerMol / (R * T_REF)),
    lo,
    hi
  };
}

function makeReference(reactants, products, overrides = {}) {
  return {
    schema: REFERENCE_SCHEMA,
    referenceTemperatureK: T_REF,
    referencePressurePa: P_REF,
    reactionInternalEnergyChangeJPerMolExtent: DEFAULT_DELTA_U,
    reactantPhases: reactants.map(({ material, coefficient, phaseId }) => ({ material, coefficient, phaseId })),
    productPhases: products.map(({ material, coefficient, phaseId }) => ({ material, coefficient, phaseId })),
    source: {
      kind: 'manufactured-analytic',
      provenance: 'independent closed-system constant-Cv test, no empirical calibration',
      fingerprint: 'reaction-energy-independent-fixture-v1',
      provisional: false,
      phaseApplicable: true
    },
    ...overrides
  };
}

function fixture({ shifts = {}, sourcePhases = [3, 3], temperatures = [300, 300],
  // Exact binary masses preserve a genuinely complete 3:32 source ratio after
  // f32 packing. Decimal near-stoichiometric remainders are tested separately.
  masses = [3 / 512, 32 / 512], velocities = [[0, 0, 0], [0, 0, 0]],
  singleProduct = false, reverseRows = false, reverseParticles = false,
  energyReference = null, beforeBuild = null } = {}) {
  const materialProperties = {};
  const models = {};
  for (const material of Object.keys(DATA)) {
    const p = parameters(material, shifts[material] ?? 0);
    models[material] = createCondensableThermodynamics(p);
    materialProperties[material] = {
      formula: DATA[material].formula,
      molarMassKgPerMol: p.molarMassKgPerMol,
      phases: [
        { name: 'liquid', temperatureRange: [0, 400], cpJPerKgK: p.liquidCpJPerKgK,
          densityKgPerM3: p.liquidDensityKgPerM3, bulkModulusPa: 1e8, shearModulusPa: 0 },
        { name: 'gas', temperatureRange: [400, 1000], cpJPerKgK: p.vaporCpJPerKgK,
          densityKgPerM3: P_REF * p.molarMassKgPerMol / (R * T_REF), bulkModulusPa: null, shearModulusPa: 0 }
      ],
      transitions: [{ from: 'liquid', to: 'gas', temperatureK: 400, latentHeatJPerKg: p.vaporizationReferenceEnthalpyJPerKg }]
    };
  }
  const reactants = [
    { material: 'h2', coefficient: singleProduct ? 2 : 3, phaseId: sourcePhases[0] },
    { material: 'o2', coefficient: singleProduct ? 1 : 2, phaseId: sourcePhases[1] }
  ];
  const products = singleProduct
    ? [{ material: 'h2o', coefficient: 2, phaseId: 2 }]
    : [{ material: 'h2o', coefficient: 2, phaseId: 2 }, { material: 'h2o2', coefficient: 1, phaseId: 3 }];
  if (reverseRows) { reactants.reverse(); products.reverse(); }
  const term = ({ material, coefficient, phaseId }) => ({ material, coefficient,
    formula: DATA[material].formula, phase: phaseId === 3 ? 'gas' : 'liquid' });
  const reaction = {
    a: 'h2', b: 'o2', product: 'h2o', activationTemperatureK: 0, contactRadiusM: 0.1,
    phaseRequirements: { h2: [sourcePhases[0] === 3 ? 'gas' : 'liquid'], o2: [sourcePhases[1] === 3 ? 'gas' : 'liquid'] },
    stoichiometry: { reactants: reactants.map(term), products: products.map(term),
      atomBalance: { balanced: true }, chargeBalance: { balanced: true } },
    energyReference: energyReference ?? makeReference(reactants, products)
  };
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties,
    { condensableThermodynamicsByMaterial: models });
  const particles = ['h2', 'o2'].map((material, index) => ({
    id: `source-${material}`, material, x: [index * 0.02, 0, 0], v: velocities[index],
    massKg: masses[index], specificInternalEnergyJPerKg: analyticPhase(material, sourcePhases[index], shifts).uAt(temperatures[index]),
    phaseCaloric: { phaseId: sourcePhases[index], phaseFractions: fractions(sourcePhases[index]) }
  }));
  if (reverseParticles) particles.reverse();
  const input = createSphState({ particles, smoothingLengthM: 0.1 });
  const packing = { materialProperties, condensableThermodynamicsByMaterial: models, soundSpeedScale: 1, minGasSoundSpeedMPerS: 0 };
  const sphParticleState = buildSphGpuParticleBuffers(input, packing);
  const mlsMpmParticleState = buildMlsMpmGpuParticleBuffers(input, packing);
  const draft = { reaction, materialProperties, thermalMaterialTable, sphParticleState, mlsMpmParticleState };
  beforeBuild?.(draft);
  const reactionTable = buildSphReactionTable([reaction], { materialProperties, thermalMaterialTable,
    contactRadiusM: 0.1, soundSpeedScale: 1, minGasSoundSpeedMPerS: 0 });
  return { ...draft, reactionTable, reactants, products, shifts, input };
}

function run(f, extra = {}) {
  return runSphReactionStepCpu({ sphParticleState: f.sphParticleState,
    mlsMpmParticleState: f.mlsMpmParticleState, reactionTable: f.reactionTable,
    thermalMaterialTable: f.thermalMaterialTable, ...extra });
}

function physicalDeltaU(f) {
  const r = f.reaction.energyReference;
  if (r.reactionInternalEnergyChangeJPerMolExtent !== undefined) return r.reactionInternalEnergyChangeJPerMolExtent;
  const phasePV = ({ material, coefficient, phaseId }) => coefficient * (phaseId === 3
    ? R * r.referenceTemperatureK
    : r.referencePressurePa * DATA[material].molarMass / DATA[material].density);
  return r.reactionEnthalpyChangeJPerMolExtent
    - r.productPhases.reduce((sum, term) => sum + phasePV(term), 0)
    + r.reactantPhases.reduce((sum, term) => sum + phasePV(term), 0);
}

function expectedEvent(f, extentOverride = Infinity) {
  const inputs = [0, 1].map((index) => {
    const s = index * 8;
    const t = index * 12;
    const term = f.reactants.find(({ material }) => stableOpticalMaterialId(material) === f.sphParticleState.thermo[t]);
    const mass = f.sphParticleState.state[s + 3];
    const molarMass = Math.fround(DATA[term.material].molarMass);
    return { ...term, index, mass, molarMass, u: f.sphParticleState.state[s + 7],
      v: Array.from(f.sphParticleState.state.slice(s + 4, s + 7)),
      graph: analyticPhase(term.material, term.phaseId, f.shifts),
      referenceU: analyticPhase(term.material,
        f.reaction.energyReference.reactantPhases.find((p) => p.material === term.material).phaseId, f.shifts).uAt(T_REF) };
  });
  const extent = Math.min(extentOverride, ...inputs.map((s) => s.mass / (s.coefficient * s.molarMass)));
  for (const s of inputs) s.consumed = Math.min(s.mass, extent * s.coefficient * s.molarMass);
  const mass = inputs.reduce((sum, s) => sum + s.consumed, 0);
  const v = [0, 1, 2].map((axis) => inputs.reduce((sum, s) => sum + s.consumed * s.v[axis], 0) / mass);
  const position = [0, 1, 2].map((axis) => inputs.reduce((sum, s) => sum
    + s.consumed * f.sphParticleState.state[s.index * 8 + axis], 0) / mass);
  const volume = inputs.reduce((sum, s) => sum + f.mlsMpmParticleState.mechanics[s.index * 32 + 18]
    * f.mlsMpmParticleState.mechanics[s.index * 32 + 19] * s.consumed / s.mass, 0);
  const relativeKE = inputs.reduce((sum, s) => sum + 0.5 * s.consumed
    * s.v.reduce((speed, value, axis) => speed + (value - v[axis]) ** 2, 0), 0);
  const rawMass = f.products.reduce((sum, p) => sum + p.coefficient * Math.fround(DATA[p.material].molarMass), 0);
  const products = f.products.map((p) => ({ ...p,
    mass: mass * p.coefficient * Math.fround(DATA[p.material].molarMass) / rawMass,
    graph: analyticPhase(p.material, p.phaseId, f.shifts),
    referenceU: analyticPhase(p.material,
      f.reaction.energyReference.productPhases.find((term) => term.material === p.material).phaseId, f.shifts).uAt(T_REF) }));
  const sensible = inputs.reduce((sum, s) => sum + s.consumed * (s.u - s.referenceU), 0);
  const capacity = products.reduce((sum, p) => sum + p.mass * p.graph.cv, 0);
  const birthPhaseOffset = products.reduce((sum, p) => sum + p.mass * (p.graph.uAt(T_REF) - p.referenceU), 0);
  const temperature = T_REF + (sensible + relativeKE - extent * physicalDeltaU(f) - birthPhaseOffset) / capacity;
  return { inputs, products, extent, mass, v, position, volume, relativeKE, temperature };
}

function eventFrom(result) {
  assert.equal(result.reactionLedger?.eventCount, 1, 'one actual reaction event');
  assert.equal(result.reactionLedger.events.length, 1);
  return result.reactionLedger.events[0];
}

function assertResult(f, result, expected = expectedEvent(f)) {
  const event = eventFrom(result);
  near(event.extentMol, expected.extent, Math.max(1e-8, expected.extent * 5e-6), 'stoichiometric extent');
  near(event.consumedMassKg, expected.mass, 2e-8, 'consumed mass');
  assert.equal(event.energy.externalHeatJ, 0, 'chemical reference energy is not external heat');
  near(event.energy.physicalReferenceEnergyChangeJ, expected.extent * physicalDeltaU(f), ENERGY_TOL, 'physical reference event energy');
  const gaugeReference = expected.products.reduce((sum, p) => sum + p.mass * p.referenceU, 0)
    - expected.inputs.reduce((sum, s) => sum + s.consumed * s.referenceU, 0);
  near(event.energy.runtimeGaugeCorrectionJ, gaugeReference, ENERGY_TOL, 'actual-mass runtime gauge correction');
  near(event.energy.runtimeEnergyChangeJ, gaugeReference - expected.extent * physicalDeltaU(f), ENERGY_TOL, 'closed runtime reference adjustment');
  let releasedSensible = 0;
  for (const product of expected.products) {
    const observed = event.products.find(({ material }) => material === product.material);
    assert.ok(observed, `product ledger ${product.material}`);
    near(observed.massKg, product.mass, 2e-8, 'product mass');
    near(observed.specificInternalEnergyJPerKg, product.graph.uAt(expected.temperature), U_TOL, 'phase-specific product U');
    near(observed.temperatureK, expected.temperature, T_TOL, 'common product T');
    assert.equal(observed.phaseId, product.phaseId);
    for (let axis = 0; axis < 3; axis += 1) near(observed.velocity[axis], expected.v[axis],
      64 * Number.EPSILON * Math.max(1, Math.abs(expected.v[axis])), 'product ledger COM velocity');
    for (let axis = 0; axis < 3; axis += 1) near(observed.position[axis], expected.position[axis],
      64 * Number.EPSILON * Math.max(1, Math.abs(expected.position[axis])), 'product ledger consumed center of mass');
    assert.ok(Number.isFinite(observed.currentVolumeM3) && observed.currentVolumeM3 > 0,
      'full product volume is finite and positive');
    near(observed.currentVolumeM3, expected.volume * product.mass / expected.mass,
      Math.max(1e-12, expected.volume * 2e-7), 'consumed support volume is partitioned among complete products');
    assert.ok(Number.isFinite(observed.supportVolumeM3) && observed.supportVolumeM3 >= 0,
      'unplaced support volume is finite and nonnegative');
    near(observed.supportVolumeM3, observed.currentVolumeM3 * observed.unplacedMassKg / observed.massKg,
      1e-12, 'unplaced product support is its proportional full-volume share');
    if (observed.unplacedMassKg > 0) assert.ok(observed.supportVolumeM3 > 0,
      'an unplaced parcel always retains positive support volume');
    releasedSensible += observed.massKg * (observed.specificInternalEnergyJPerKg - product.referenceU);
    const slots = [0, 1].filter((index) => result.thermo[index * 12] === stableOpticalMaterialId(product.material)
      && result.state[index * 8 + 3] > 0);
    let visibleMass = 0;
    for (const index of slots) {
      const s = index * 8;
      const t = index * 12;
      visibleMass += result.state[s + 3];
      near(result.state[s + 7], product.graph.uAt(expected.temperature), U_TOL, 'visible product U');
      near(result.thermo[t + 2], expected.temperature, T_TOL, 'visible product T');
      assert.equal(result.thermo[t + 1], product.phaseId);
      assert.deepEqual(Array.from(result.thermo.slice(t + 4, t + 8)), fractions(product.phaseId));
      for (let axis = 0; axis < 3; axis += 1) assert.equal(result.state[s + 4 + axis],
        Math.fround(expected.v[axis]), 'visible COM velocity is exactly its declared f32 representation');
      assert.deepEqual(Array.from(result.mechanics.slice(index * 32, index * 32 + 9)), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
      assert.deepEqual(Array.from(result.mechanics.slice(index * 32 + 9, index * 32 + 18)), Array(9).fill(0));
      near(result.mechanics[index * 32 + 31], result.state[s + 3], 2e-8, 'reference mass follows product');
    }
    near(visibleMass, observed.visibleMassKg, 2e-8, 'visible ledger mass');
    near(observed.visibleMassKg + observed.unplacedMassKg, observed.massKg, 2e-8, 'placed plus unplaced mass');
  }
  const inputSensible = expected.inputs.reduce((sum, s) => sum + s.consumed * (s.u - s.referenceU), 0);
  near(releasedSensible, inputSensible + expected.relativeKE - expected.extent * physicalDeltaU(f),
    ENERGY_TOL, 'gauge-independent closed reaction energy balance');
  const oldMass = expected.inputs.reduce((sum, s) => sum + s.mass, 0);
  const newMass = [0, 1].reduce((sum, i) => sum + result.state[i * 8 + 3], 0) + event.unplacedProductMassKg;
  near(newMass, oldMass, 2e-8, 'joint visible plus unplaced total mass');
  for (let axis = 0; axis < 3; axis += 1) {
    const oldMomentum = expected.inputs.reduce((sum, s) => sum + s.mass * s.v[axis], 0);
    const newMomentum = [0, 1].reduce((sum, i) => sum + result.state[i * 8 + 3] * result.state[i * 8 + 4 + axis], 0)
      + event.products.reduce((sum, p) => sum + p.unplacedMassKg * p.velocity[axis], 0);
    // One final round of each output mass and velocity is unavoidable. Derive
    // its bound from the IEEE-754 format; a common boost must not require an
    // arbitrary enlarged physics tolerance or a smaller-velocity fixture.
    const packingBound = [0, 1].reduce((sum, i) => {
      const mass = result.state[i * 8 + 3], velocity = result.state[i * 8 + 4 + axis];
      return sum + Math.abs(mass) * halfF32Ulp(velocity)
        + Math.abs(velocity) * halfF32Ulp(mass) + halfF32Ulp(mass) * halfF32Ulp(velocity);
    }, 64 * Number.EPSILON * Math.max(1, Math.abs(oldMomentum)));
    near(newMomentum, oldMomentum, packingBound, 'joint visible plus unplaced momentum within one output packing');
  }
  return event;
}

test('actual reaction table exposes reference Delta U and runtime gauge correction, not scalar heat', () => {
  const f = fixture();
  const metadata = f.reactionTable.energyMetadata;
  assert.equal(metadata.length, 1);
  const runtimeDelta = [...f.products.map((p) => ({ ...p, sign: 1 })),
    ...f.reactants.map((p) => ({ ...p, sign: -1 }))].reduce((sum, p) => sum + p.sign
      * p.coefficient * Math.fround(DATA[p.material].molarMass)
      * analyticPhase(p.material, p.phaseId).uAt(T_REF), 0);
  near(metadata[0].physicalDeltaUReferenceJPerMolExtent, DEFAULT_DELTA_U, 1e-6, 'physical Delta U');
  near(metadata[0].runtimeDeltaUReferenceJPerMolExtent, runtimeDelta, 0.02, 'runtime reference Delta U');
  near(metadata[0].runtimeGaugeCorrectionJPerMolExtent, runtimeDelta - DEFAULT_DELTA_U, 0.02, 'runtime gauge correction');
  assert.equal(f.reactionTable.records[4], 0, 'no legacy scalar heat fallback');
  const oldFloats = ['records', 'productPhaseRecords', 'reactionHeaders', 'reactantTermRecords',
    'productTermRecords', 'gasProductRecords', 'atomTermRecords'].reduce((sum, key) => sum + f.reactionTable[key].length, 0);
  assert.ok(f.reactionTable.combinedRecords.length > oldFloats, 'physical authority is included in actual GPU upload');
});

test('two products receive distinct U at one independently solved T through real CPU placement', () => {
  const f = fixture();
  const before = { state: f.sphParticleState.state.slice(), thermo: f.sphParticleState.thermo.slice(), mechanics: f.mlsMpmParticleState.mechanics.slice() };
  const result = run(f);
  const event = assertResult(f, result);
  assert.equal(result.conversionCount, 2, 'gas occupies the second freed slot after condensed product');
  assert.equal(event.unplacedProductMassKg, 0);
  assert.notEqual(event.products[0].specificInternalEnergyJPerKg, event.products[1].specificInternalEnergyJPerKg);
  assert.deepEqual(f.sphParticleState.state, before.state);
  assert.deepEqual(f.sphParticleState.thermo, before.thermo);
  assert.deepEqual(f.mlsMpmParticleState.mechanics, before.mechanics);
});

test('new reaction-product U and pure phases continue unchanged through the real adiabatic thermal path', () => {
  const f = fixture();
  const reaction = run(f);
  assertResult(f, reaction);
  const next = runSphThermalStepCpu({ sphParticleState: { ...f.sphParticleState,
    state: reaction.state, thermo: reaction.thermo }, thermalMaterialTable: f.thermalMaterialTable,
  wallModel: 'adiabatic', conductionRate: 0, dtS: 0.001 });
  assert.deepEqual(next.state, reaction.state, 'reaction-product U is not rebased or reheated');
  for (const index of [0, 1]) {
    assert.equal(next.thermo[index * 12 + 1], reaction.thermo[index * 12 + 1]);
    near(next.thermo[index * 12 + 2], reaction.thermo[index * 12 + 2], T_TOL, 'reaction product thermal continuation');
    assert.deepEqual(next.thermo.slice(index * 12 + 4, index * 12 + 8),
      reaction.thermo.slice(index * 12 + 4, index * 12 + 8));
  }
});

test('relative approach kinetic energy heats products while COM momentum is preserved', () => {
  const f = fixture({ temperatures: [330, 275], velocities: [[70, -12, 3], [-20, 8, 9]] });
  const expected = expectedEvent(f);
  assert.ok(expected.relativeKE > 10, 'nontrivial independent relative kinetic input');
  assertResult(f, run(f), expected);
});

test('common translation does not add fictitious reaction heat', () => {
  const stationary = fixture({ velocities: [[5, -3, 2], [-9, 4, 1]] });
  const translated = fixture({ velocities: [[105, -43, 27], [91, -36, 26]] });
  const a = assertResult(stationary, run(stationary));
  const b = assertResult(translated, run(translated));
  for (const p of a.products) near(b.products.find((q) => q.material === p.material).temperatureK,
    p.temperatureK, T_TOL, 'Galilean-invariant product T');
});

test('all per-material energy-zero shifts leave T and physical energy invariant despite f32 mass normalization', () => {
  const shifts = { h2: 55_000, o2: -123_000, h2o: 250_000, h2o2: -333_000 };
  const base = fixture({ masses: [0.00731, 0.0817], temperatures: [315, 285] });
  const shifted = fixture({ shifts, masses: [0.00731, 0.0817], temperatures: [315, 285] });
  const a = assertResult(base, run(base));
  const b = assertResult(shifted, run(shifted));
  for (const p of a.products) {
    const q = b.products.find((item) => item.material === p.material);
    near(q.temperatureK, p.temperatureK, T_TOL, 'independent gauge-shift T');
    near(q.specificInternalEnergyJPerKg - p.specificInternalEnergyJPerKg, shifts[p.material], U_TOL, 'product gauge-shift U');
    near(q.massKg, p.massKg, 1e-12, 'gauge-invariant mass');
  }
});

test('embedded formation offsets are not charged a second time as scalar reaction heat', () => {
  const shifts = { h2o: 900_000, h2o2: 900_000 };
  const f = fixture({ shifts, beforeBuild: ({ reaction }) => {
    const terms = [...reaction.energyReference.productPhases.map((p) => ({ ...p, sign: 1 })),
      ...reaction.energyReference.reactantPhases.map((p) => ({ ...p, sign: -1 }))];
    const delta = terms.reduce((sum, p) => sum + p.sign * p.coefficient
      * Math.fround(DATA[p.material].molarMass) * analyticPhase(p.material, p.phaseId, shifts).uAt(T_REF), 0);
    reaction.energyReference.reactionInternalEnergyChangeJPerMolExtent = delta;
  } });
  near(f.reactionTable.energyMetadata[0].runtimeGaugeCorrectionJPerMolExtent, 0, 0.02, 'embedded offset correction is zero');
  const expected = expectedEvent(f);
  assert.ok(expected.temperature > 300 && expected.temperature < 330, 'admissible exothermic formation-offset fixture');
  const event = assertResult(f, run(f), expected);
  const beforeU = expected.inputs.reduce((sum, s) => sum + s.consumed * s.u, 0);
  const afterU = event.products.reduce((sum, p) => sum + p.massKg * p.specificInternalEnergyJPerKg, 0);
  near(afterU, beforeU, ENERGY_TOL, 'embedded chemical energy alone supplies the product heating');
});

test('liquid versus vapor source reference accounts for its latent U exactly once', () => {
  const phaseGap = analyticPhase('h2', 3).uAt(T_REF) - analyticPhase('h2', 2).uAt(T_REF);
  const extentLatentU = 3 * DATA.h2.molarMass * phaseGap;
  const gas = fixture();
  const liquid = fixture({ sourcePhases: [2, 3], beforeBuild: ({ reaction }) => {
    // Physical Delta U refers to different source phases in the two reactions.
    // Replacing high-U gas with low-U liquid increases the chemical demand by
    // exactly the consumed reference vaporization U, not its enthalpy L.
    reaction.energyReference.reactionInternalEnergyChangeJPerMolExtent = DEFAULT_DELTA_U + extentLatentU;
  } });
  const gasEvent = assertResult(gas, run(gas));
  const liquidEvent = assertResult(liquid, run(liquid));
  const expected = expectedEvent(gas);
  const capacity = expected.products.reduce((sum, p) => sum + p.mass * p.graph.cv, 0);
  near(gasEvent.products[0].temperatureK - liquidEvent.products[0].temperatureK,
    expected.extent * extentLatentU / capacity, T_TOL, 'single reference phase-gap contribution');
});

test('standard-reference product phase may differ from birth phase, paying its latent offset once', () => {
  const referencePhaseGap = analyticPhase('h2o', 3).uAt(T_REF) - analyticPhase('h2o', 2).uAt(T_REF);
  const base = fixture();
  const otherReference = fixture({ beforeBuild: ({ reaction }) => {
    reaction.energyReference.productPhases.find((p) => p.material === 'h2o').phaseId = 3;
    reaction.energyReference.reactionInternalEnergyChangeJPerMolExtent = DEFAULT_DELTA_U
      + 2 * DATA.h2o.molarMass * referencePhaseGap;
  } });
  const a = assertResult(base, run(base));
  const b = assertResult(otherReference, run(otherReference));
  for (const p of a.products) {
    const q = b.products.find((item) => item.material === p.material);
    near(q.temperatureK, p.temperatureK, T_TOL, 'reference-phase-corrected common T');
    assert.equal(q.phaseId, p.phaseId, 'reference phase does not override birth phase');
  }
});

for (const enthalpy of [-12_000, -9000]) {
  test(`Delta H=${enthalpy} converts to Delta U with gas moles AND finite condensed PV`, () => {
    const f = fixture({ beforeBuild: ({ reaction }) => {
      delete reaction.energyReference.reactionInternalEnergyChangeJPerMolExtent;
      reaction.energyReference.reactionEnthalpyChangeJPerMolExtent = enthalpy;
    } });
    // 3 H2(g)+2 O2(g)->2 H2O(l)+H2O2(g): Delta(PV)=
    // -4*R*T + P*2*M_water/rho_water, not just -4*R*T.
    const expected = enthalpy + 4 * R * T_REF - P_REF * 2 * DATA.h2o.molarMass / DATA.h2o.density;
    near(f.reactionTable.energyMetadata[0].physicalDeltaUReferenceJPerMolExtent, expected, 0.01, 'Delta H minus Delta PV');
    assert.ok(Math.abs(expected - (enthalpy + 4 * R * T_REF)) > 0.1, 'finite condensed PV is resolved by this fixture');
    assertResult(f, run(f));
  });
}

test('finite condensed PV keeps the opposite sign for a condensed reactant', () => {
  const f = fixture({ sourcePhases: [2, 3], beforeBuild: ({ reaction }) => {
    delete reaction.energyReference.reactionInternalEnergyChangeJPerMolExtent;
    reaction.energyReference.reactionEnthalpyChangeJPerMolExtent = -4000;
  } });
  const expected = -4000 + R * T_REF + P_REF * 3 * DATA.h2.molarMass / DATA.h2.density
    - P_REF * 2 * DATA.h2o.molarMass / DATA.h2o.density;
  near(f.reactionTable.energyMetadata[0].physicalDeltaUReferenceJPerMolExtent, expected, 0.01, 'reactant condensed PV sign');
  assertResult(f, run(f));
});

test('row and particle reversal preserves chemistry, energy and condensed-first placement', () => {
  const base = fixture();
  const reversed = fixture({ reverseRows: true, reverseParticles: true });
  const a = assertResult(base, run(base));
  const result = run(reversed);
  const b = assertResult(reversed, result);
  for (const p of a.products) {
    const q = b.products.find((item) => item.material === p.material);
    near(q.temperatureK, p.temperatureK, T_TOL, 'row reversal T');
    near(q.massKg, p.massKg, 2e-8, 'row reversal mass');
  }
  assert.equal(result.thermo[0], stableOpticalMaterialId('h2o'), 'condensed-first independent of term order');
  assert.equal(result.thermo[12], stableOpticalMaterialId('h2o2'));
});

test('one limiting source leaves its partner unchanged in U/v and retains full unplaced gas state', () => {
  const f = fixture({ masses: [0.003, 0.064], velocities: [[2, 1, -3], [-4, 2, 8]], temperatures: [315, 290] });
  const result = run(f);
  const event = assertResult(f, result);
  assert.equal(result.conversionCount, 1);
  const gas = event.products.find((p) => p.material === 'h2o2');
  near(gas.unplacedMassKg, gas.massKg, 1e-12, 'unplaced gas is not dropped');
  assert.equal(gas.visibleMassKg, 0);
  assert.equal(result.thermo[12], stableOpticalMaterialId('o2'));
  assert.deepEqual(result.state.slice(12, 16), f.sphParticleState.state.slice(12, 16), 'remaining partner v/U');
});

test('a representable small reactant remainder is preserved rather than erased to free a product slot', () => {
  const f = fixture({ masses: [0.006, 0.06400005] });
  const expected = expectedEvent(f);
  const remainingOxygen = expected.inputs.find((s) => s.material === 'o2');
  const remainder = remainingOxygen.mass - remainingOxygen.consumed;
  assert.ok(remainder > 3e-8 && remainder < 1e-7, 'remainder is many f32 ULPs, not a rounding zero');
  const result = run(f);
  const event = assertResult(f, result, expected);
  assert.equal(result.thermo[12], stableOpticalMaterialId('o2'));
  near(result.state[11], remainder, halfF32Ulp(remainder), 'exact representable reactant remainder');
  assert.ok(event.products.find((p) => p.material === 'h2o2').unplacedMassKg > 0,
    'second product stays fully owned by the unplaced ledger instead of deleting reactant inventory');
});

function independentFluxCap(f, dtSeconds) {
  const rows = [0, 1].map((index) => {
    const t = index * 12;
    const s = index * 8;
    const material = ['h2', 'o2'].find((name) => stableOpticalMaterialId(name) === f.sphParticleState.thermo[t]);
    const d = DATA[material];
    const coefficient = f.reactants.find((term) => term.material === material).coefficient;
    const rho = f.sphParticleState.thermo[t + 3];
    const referenceFlux = Math.fround((P_REF * d.molarMass / (R * T_REF))
      * Math.sqrt(8 * R * 293.15 / (Math.PI * d.molarMass)) / 4);
    return {
      rate: referenceFlux * Math.sqrt(f.sphParticleState.thermo[t + 2] / 293.15) / (coefficient * Math.fround(d.molarMass)),
      radius: Math.cbrt(3 * f.sphParticleState.state[s + 3] / (4 * Math.PI * rho))
    };
  });
  return Math.max(...rows.map((r) => r.rate)) * Math.PI * Math.min(...rows.map((r) => r.radius)) ** 2 * dtSeconds;
}

test('positive dt uses maximum mobile flux and minimum contact area, with all unplaced energy retained', () => {
  const f = fixture({ temperatures: [325, 275], velocities: [[4, 2, -1], [1, -3, 9]] });
  const dtSeconds = 1e-4;
  const expected = expectedEvent(f, independentFluxCap(f, dtSeconds));
  assert.ok(expected.extent > 0 && expected.extent < 0.5, 'both sources partially consumed under independent flux cap');
  const result = run(f, { dtSeconds });
  const event = assertResult(f, result, expected);
  assert.equal(result.conversionCount, 0, 'no freed source slot');
  near(event.unplacedProductMassKg, event.productMassKg, 2e-8, 'both complete product parcels retained outside particle buffer');
  for (const index of [0, 1]) {
    assert.deepEqual(result.state.slice(index * 8 + 4, index * 8 + 8),
      f.sphParticleState.state.slice(index * 8 + 4, index * 8 + 8), 'partial sources keep v/U');
    near(result.mechanics[index * 32 + 31], result.state[index * 8 + 3], 2e-8,
      'survivor reference mass scales with remaining current mass');
  }
});

test('a positive flux extent with an unrepresentable f32 source debit is a complete no-op', () => {
  const f = fixture();
  const dtSeconds = 1e-12;
  const expected = expectedEvent(f, independentFluxCap(f, dtSeconds));
  assert.ok(expected.extent > 0, 'the independent physical flux bound is positive');
  for (const source of expected.inputs) {
    assert.ok(source.consumed > 0, 'each source would contribute a positive analytical mass');
    assert.equal(Math.fround(source.mass - source.consumed), source.mass,
      'that debit cannot be represented in the actual f32 particle mass');
  }
  assertNoMutation(f, run(f, { dtSeconds }));
});

test('dt=0 preserves the documented availability-only bound for the opted mode', () => {
  const f = fixture();
  assertResult(f, run(f, { dtSeconds: 0 }));
});

test('single-product chemistry remains atom/mass/energy closed with material-specific calorics', () => {
  const f = fixture({ singleProduct: true, masses: [0.004, 0.032], temperatures: [325, 275] });
  assertResult(f, run(f));
});

test('pure solid legacy caloric graphs participate in the same physical reference authority', () => {
  const materialProperties = Object.fromEntries([
    ['h2', 0.002, 1000, 1000, 'solid'], ['o2', 0.032, 2000, 1200, 'solid'], ['h2o', 0.018, 3000, 900, 'liquid']
  ].map(([material, molarMassKgPerMol, cpJPerKgK, densityKgPerM3, name]) => [material, {
    formula: DATA[material].formula, molarMassKgPerMol,
    phases: [{ name, temperatureRange: [0, 1000], cpJPerKgK, densityKgPerM3,
      bulkModulusPa: 1e8, shearModulusPa: name === 'solid' ? 1e7 : 0 }], transitions: []
  }]));
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties);
  const reactants = [{ material: 'h2', coefficient: 2, phaseId: 1 }, { material: 'o2', coefficient: 1, phaseId: 1 }];
  const products = [{ material: 'h2o', coefficient: 2, phaseId: 2 }];
  const reaction = {
    a: 'h2', b: 'o2', product: 'h2o', activationTemperatureK: 0, contactRadiusM: 0.1,
    stoichiometry: { reactants, products: [{ material: 'h2o', coefficient: 2, phase: 'liquid', formula: 'H2O' }] },
    energyReference: makeReference(reactants, products, { reactionInternalEnergyChangeJPerMolExtent: -3600 })
  };
  const reactionTable = buildSphReactionTable([reaction], { materialProperties, thermalMaterialTable });
  const input = createSphState({ smoothingLengthM: 0.1, particles: [
    { id: 'solid-h2', material: 'h2', x: [0, 0, 0], v: [0, 0, 0], massKg: 0.004, specificInternalEnergyJPerKg: 300_000 },
    { id: 'solid-o2', material: 'o2', x: [0.02, 0, 0], v: [0, 0, 0], massKg: 0.032, specificInternalEnergyJPerKg: 600_000 }
  ] });
  const sphParticleState = buildSphGpuParticleBuffers(input, { materialProperties });
  const mlsMpmParticleState = buildMlsMpmGpuParticleBuffers(input, { materialProperties });
  assert.equal(sphParticleState.thermo[1], 1);
  assert.equal(sphParticleState.thermo[13], 1);
  const f = { sphParticleState, mlsMpmParticleState, reactionTable, thermalMaterialTable };
  const event = eventFrom(run(f));
  const consumedMass = event.reactants.reduce((sum, p) => sum + p.consumedMassKg, 0);
  const extent = Math.min(sphParticleState.state[3] / (2 * Math.fround(0.002)),
    sphParticleState.state[11] / Math.fround(0.032));
  const temperature = 300 + extent * 3600 / (consumedMass * 3000);
  assert.equal(event.products.length, 1);
  near(event.products[0].temperatureK, temperature, T_TOL, 'solid-to-liquid common T');
  near(event.products[0].specificInternalEnergyJPerKg, 3000 * temperature, U_TOL, 'legacy monotone product graph');
  assert.equal(event.products[0].phaseId, 2);
});

function assertNoMutation(f, result) {
  assert.deepEqual(result.state, f.sphParticleState.state, 'rejected pair S is byte-equivalent');
  assert.deepEqual(result.thermo, f.sphParticleState.thermo, 'rejected pair T is byte-equivalent');
  assert.deepEqual(result.mechanics, f.mlsMpmParticleState.mechanics, 'rejected pair M is byte-equivalent');
  assert.equal(result.conversionCount, 0);
  assert.equal(result.eventCount, 0);
  assert.equal(result.reactionLedger?.eventCount ?? 0, 0, 'rejected pairs never manufacture a ledger event');
}

const invalidLiveRows = [
  ['non-finite U', (f) => { f.sphParticleState.state[7] = NaN; }],
  ['non-finite velocity', (f) => { f.sphParticleState.state[4] = Infinity; }],
  ['negative source mass', (f) => { f.sphParticleState.state[3] = -1; }],
  ['out-of-domain U', (f) => { f.sphParticleState.state[7] = analyticPhase('h2', 3).lo - 1e5; }],
  ['mixed phase fractions', (f) => { f.sphParticleState.thermo[5] = 0.5; f.sphParticleState.thermo[6] = 0.5; }],
  ['wrong pure phase', (f) => { f.sphParticleState.thermo[1] = 2; f.sphParticleState.thermo[5] = 1; f.sphParticleState.thermo[6] = 0; }],
  ['inconsistent temperature', (f) => { f.sphParticleState.thermo[2] += 20; }],
  ['NaN temperature', (f) => { f.sphParticleState.thermo[2] = NaN; }],
  ['non-finite temperature', (f) => { f.sphParticleState.thermo[2] = Infinity; }],
  ['source1 NaN represented entity count', (f) => { f.sphParticleState.thermo[12 + 9] = NaN; }],
  ['deformation strain', (f) => { f.mlsMpmParticleState.mechanics[0] = 1.02; }],
  ['affine velocity', (f) => { f.mlsMpmParticleState.mechanics[9] = 0.2; }],
  ['non-unit J', (f) => { f.mlsMpmParticleState.mechanics[18] = 1.01; }],
  ['zero support volume', (f) => { f.mlsMpmParticleState.mechanics[19] = 0; }]
];
for (const [name, mutate] of invalidLiveRows) {
  test(`live ${name} is a pair-local no-op, never legacy energy fallback`, () => {
    const f = fixture();
    mutate(f);
    assertNoMutation(f, run(f));
  });
}

for (const deltaU of [1e8, -1e8]) {
  test(`out-of-domain common product energy (${deltaU}) is rejected without mutation or ledger`, () => {
    const f = fixture({ beforeBuild: ({ reaction }) => { reaction.energyReference.reactionInternalEnergyChangeJPerMolExtent = deltaU; } });
    assertNoMutation(f, run(f));
  });
}

const invalidReferences = [
  ['missing schema', (r) => { delete r.schema; }],
  ['wrong schema', (r) => { r.schema = 'unbranded'; }],
  ['string reference T', (r) => { r.referenceTemperatureK = '300'; }],
  ['zero reference T', (r) => { r.referenceTemperatureK = 0; }],
  ['reference T outside graph', (r) => { r.referenceTemperatureK = 1000; }],
  ['NaN reference P', (r) => { r.referencePressurePa = NaN; }],
  ['negative reference P', (r) => { r.referencePressurePa = -1; }],
  ['string reaction energy', (r) => { r.reactionInternalEnergyChangeJPerMolExtent = '-2460'; }],
  ['non-finite reaction energy', (r) => { r.reactionInternalEnergyChangeJPerMolExtent = Infinity; }],
  ['both Delta H and Delta U', (r) => { r.reactionEnthalpyChangeJPerMolExtent = -2460; }],
  ['neither Delta H nor Delta U', (r) => { delete r.reactionInternalEnergyChangeJPerMolExtent; }],
  ['wrong source kind', (r) => { r.source.kind = 'electronic-estimate'; }],
  ['provisional source', (r) => { r.source.provisional = true; }],
  ['missing provisional assertion', (r) => { delete r.source.provisional; }],
  ['inapplicable phases', (r) => { r.source.phaseApplicable = false; }],
  ['missing phase applicability', (r) => { delete r.source.phaseApplicable; }],
  ['empty provenance', (r) => { r.source.provenance = ' '; }],
  ['empty fingerprint', (r) => { r.source.fingerprint = ''; }],
  ['string coefficient', (r) => { r.reactantPhases[0].coefficient = '3'; }],
  ['mismatched coefficient', (r) => { r.reactantPhases[0].coefficient = 4; }],
  ['string phase ID', (r) => { r.productPhases[0].phaseId = '2'; }],
  ['fractional phase ID', (r) => { r.productPhases[0].phaseId = 2.1; }],
  ['unknown phase ID', (r) => { r.productPhases[0].phaseId = 0; }],
  ['wrong phase material', (r) => { r.reactantPhases[0].material = 'o2'; }],
  ['wrong ordered product declaration', (r) => { r.productPhases.reverse(); }],
  ['missing product declaration', (r) => { r.productPhases.pop(); }]
];
for (const [name, mutate] of invalidReferences) {
  test(`builder rejects ${name} in the physical energy reference`, () => {
    assert.throws(() => fixture({ beforeBuild: ({ reaction }) => mutate(reaction.energyReference) }));
  });
}

test('reference-thermochemistry provenance is also admitted when explicitly non-provisional and phase-applicable', () => {
  const f = fixture({ beforeBuild: ({ reaction }) => { reaction.energyReference.source.kind = 'reference-thermochemistry'; } });
  assertResult(f, run(f));
});

for (const scalar of [-1000, 1000, '0', NaN]) {
  test(`opted reaction rejects a conflicting/coerced legacy scalar (${String(scalar)})`, () => {
    assert.throws(() => fixture({ beforeBuild: ({ reaction }) => { reaction.specificEnthalpyJPerKg = scalar; } }));
  });
}

test('exact zero legacy scalar is harmless but does not become the physical authority', () => {
  const f = fixture({ beforeBuild: ({ reaction }) => { reaction.specificEnthalpyJPerKg = 0; } });
  assertResult(f, run(f));
});

for (const [name, mutate] of [
  ['atom imbalance despite claimed balance', ({ reaction }) => {
    reaction.stoichiometry.products[0].coefficient = 3;
    reaction.energyReference.productPhases[0].coefficient = 3;
  }],
  ['charge imbalance despite claimed balance', ({ reaction }) => { reaction.stoichiometry.reactants[0].charge = 1; }],
  ['molar mass imbalance despite atom balance', ({ materialProperties }) => { materialProperties.h2o.molarMassKgPerMol = 0.019; }]
]) {
  test(`builder independently rejects ${name}`, () => { assert.throws(() => fixture({ beforeBuild: mutate })); });
}

test('type-3 caloric reactions without an opted private authority remain rejected', () => {
  assert.throws(() => {
    const f = fixture({ beforeBuild: ({ reaction }) => { delete reaction.energyReference; reaction.specificEnthalpyJPerKg = -1000; } });
    run(f);
  });
});

for (const [name, mutate] of [
  ['cloned reaction object', (f) => { f.reactionTable = structuredClone(f.reactionTable); }],
  ['reaction scalar record', (f) => { f.reactionTable.records[4] = -1000; }],
  ['stoichiometric coefficient', (f) => { f.reactionTable.reactantTermRecords[2] += 1; }],
  ['product target phase', (f) => { f.reactionTable.productTermRecords[6] = 3; }],
  ['combined upload record', (f) => { f.reactionTable.combinedRecords[0] += 1; }],
  ['thermal graph endpoint', (f) => { f.thermalMaterialTable.segments[4] += 1000; }],
  ['thermal graph material identity', (f) => { f.thermalMaterialTable.records[0] += 1; }]
]) {
  test(`stale/unbound ${name} is rejected before pair work`, () => {
    const f = fixture();
    mutate(f);
    const before = { state: f.sphParticleState.state.slice(), thermo: f.sphParticleState.thermo.slice(), mechanics: f.mlsMpmParticleState.mechanics.slice() };
    assert.throws(() => run(f));
    assert.deepEqual(f.sphParticleState.state, before.state);
    assert.deepEqual(f.sphParticleState.thermo, before.thermo);
    assert.deepEqual(f.mlsMpmParticleState.mechanics, before.mechanics);
  });
}

for (const [name, mutate] of [
  ['reactant', (table) => { table.reactantTermMetadata[0].material = 'cs'; }],
  ['product', (table) => { table.productTermMetadata[1].material = 'f2'; }]
]) {
  test(`mutable ${name} ledger species metadata cannot bypass the content-bound energy authority`, () => {
    // This partial reaction would retain a full unplaced gas product, so a
    // forged species label must be rejected before any ledger can be emitted.
    const f = fixture({ masses: [0.003, 0.064] });
    const before = { state: f.sphParticleState.state.slice(), thermo: f.sphParticleState.thermo.slice(),
      mechanics: f.mlsMpmParticleState.mechanics.slice() };
    mutate(f.reactionTable);
    assert.throws(() => run(f), /Reaction energy authority/);
    assert.deepEqual(f.sphParticleState.state, before.state);
    assert.deepEqual(f.sphParticleState.thermo, before.thermo);
    assert.deepEqual(f.mlsMpmParticleState.mechanics, before.mechanics);
  });
}

test('an optional stale thermal graph cannot replace the authenticated reaction caloric samples', () => {
  const f = fixture();
  const graphs = buildSphThermalClosureGraphBuffers(f.thermalMaterialTable);
  graphs.graphs[0].sampleRows[1] += 10;
  assert.throws(() => run(f, { thermalClosureGraphSet: graphs }));
});

test('an optional stale phase-response table cannot replace the authenticated target phase', () => {
  const f = fixture();
  const graphs = buildSphThermalClosureGraphBuffers(f.thermalMaterialTable);
  const response = buildSphThermalPhaseResponseTable(f.thermalMaterialTable, graphs);
  response.responses[6] = 3;
  assert.throws(() => run(f, { thermalClosureGraphSet: graphs, thermalPhaseResponseTable: response }));
});

for (const [name, prepare, expectedError] of [
  ['copied authority', (f) => { f.reactionTable = structuredClone(f.reactionTable); return {}; }, /Reaction energy authority/],
  ['changed reference upload data', (f) => { f.reactionTable.combinedRecords[f.reactionTable.combinedRecords.length - 1] += 1; return {}; }, /Reaction energy authority/],
  ['changed thermal graph', (f) => {
    const thermalClosureGraphSet = buildSphThermalClosureGraphBuffers(f.thermalMaterialTable);
    thermalClosureGraphSet.graphs[0].sampleRows[1] += 10;
    return { thermalClosureGraphSet };
  }, /Inconsistent phase-specific caloric thermal artifacts/],
  ['changed phase response', (f) => {
    const thermalClosureGraphSet = buildSphThermalClosureGraphBuffers(f.thermalMaterialTable);
    const thermalPhaseResponseTable = buildSphThermalPhaseResponseTable(f.thermalMaterialTable, thermalClosureGraphSet);
    thermalPhaseResponseTable.responses[6] = 3;
    return { thermalClosureGraphSet, thermalPhaseResponseTable };
  }, /Inconsistent phase-specific caloric thermal artifacts/],
  ['disabled product mechanics initialization', () => ({ resetMechanics: false }), /Physical reaction energy requires product mechanics initialization/]
]) {
  test(`standalone GPU entry rejects ${name} before mocked allocation or submission`, async () => {
    const f = fixture();
    const extra = prepare(f);
    const calls = [];
    const touched = (name) => () => { calls.push(name); throw new Error(`unexpected mocked GPU ${name}`); };
    const device = { createBuffer: touched('allocation'), createShaderModule: touched('module'),
      createCommandEncoder: touched('encoder'), queue: { writeBuffer: touched('upload'), submit: touched('submission') } };
    await assert.rejects(runSphReactionStepWebGpu({ device,
      sphParticleState: f.sphParticleState, mlsMpmParticleState: f.mlsMpmParticleState,
      reactionTable: f.reactionTable, thermalMaterialTable: f.thermalMaterialTable, ...extra }), expectedError);
    assert.deepEqual(calls, [], 'untrusted cold artifacts never touch any GPU operation');
  });
}
