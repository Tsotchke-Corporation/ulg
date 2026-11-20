import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONDENSABLE_THERMODYNAMICS_SCHEMA,
  createCondensableThermodynamics
} from '../src/runtime/material/condensableThermodynamics.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import {
  buildMlsMpmGpuParticleBuffers,
  buildSphGpuParticleBuffers,
  SPH_GPU_PARTICLE_STATUS
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  prepareSphCondensableParticleInitialization
} from '../src/runtime/sph/sphCondensableParticleInitialization.js';
import { cloneSphState, createSphState } from '../src/runtime/sph/sphState.js';
import {
  buildSphThermalMaterialTable,
  createSphThermalStepWebGpuEncoderStage,
  resolveThermalConductivityFromTable,
  runSphThermalStepCpu
} from '../src/runtime/sph/sphThermalGpuKernel.js';
import { buildMlsMpmMechanicsMaterialTable } from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import { refreshMlsMpmMechanicsCpu } from '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';

// Independent synthetic inputs, not a water fit or an inferred conversion of
// a legacy state. h_l(T0)=-50000 and p0/rho_l=3 give u_l(T0)=-50003.
// h_v(T0)=150000 and R_s*T0=30000 give u_v(T0)=120000; Cv_v=3900.
const MATERIAL = 'synthetic-condensable';
const R = 8.314462618;
const MODEL_INPUT = Object.freeze({
  schema: CONDENSABLE_THERMODYNAMICS_SCHEMA,
  energyBasis: 'specific-enthalpy-at-reference-pressure',
  referenceTemperatureK: 300,
  referencePressurePa: 3000,
  liquidReferenceEnthalpyJPerKg: -50_000,
  vaporizationReferenceEnthalpyJPerKg: 200_000,
  liquidCpJPerKgK: 4000,
  vaporCpJPerKgK: 4000,
  liquidDensityKgPerM3: 1000,
  molarMassKgPerMol: R / 100,
  minTemperatureK: 200,
  maxTemperatureK: 450,
  maxPressurePa: 2_000_000,
  provenance: 'independent synthetic explicit particle initialization fixture'
});
const model = createCondensableThermodynamics(MODEL_INPUT);
const models = Object.freeze({ [MATERIAL]: model });
const fractions = (phaseId) => [0, phaseId === 2 ? 1 : 0, phaseId === 3 ? 1 : 0, 0];
const energyAt = (phaseId, temperatureK) => phaseId === 2
  ? -50_003 + 4000 * (temperatureK - 300)
  : 120_000 + 3900 * (temperatureK - 300);
const temperatureAt = (phaseId, u) => phaseId === 2
  ? 300 + (u + 50_003) / 4000
  : 300 + (u - 120_000) / 3900;
const PACKERS = [buildSphGpuParticleBuffers, buildMlsMpmGpuParticleBuffers];
// Gas rest density is on the standard-atmosphere basis the mechanics EOS
// assumes (101325 Pa), not on the caloric reference pressure: R_s = 100,
// T0 = 300 K.
const VAPOR_REST_DENSITY = 101325 / (100 * 300);

function propertyRecord() {
  return {
    molarMassKgPerMol: R / 100,
    phases: [
      { name: 'liquid', cpJPerKgK: 4000, densityKgPerM3: 1000,
        temperatureRange: [0, 373], bulkModulusPa: 2e9, shearModulusPa: 0,
        thermalConductivityWPerMK: 0.6,
        thermalConductivityProvenance: { source: 'synthetic declared liquid conductivity' } },
      { name: 'gas', cpJPerKgK: 4000, densityKgPerM3: VAPOR_REST_DENSITY,
        temperatureRange: [373, 1e6], bulkModulusPa: null, shearModulusPa: 0,
        thermalConductivityWPerMK: 0.025,
        thermalConductivityProvenance: { source: 'synthetic declared vapor conductivity' } }
    ],
    transitions: [{ from: 'liquid', to: 'gas', temperatureK: 373,
      latentHeatJPerKg: 200_000 }]
  };
}

function properties() {
  return { [MATERIAL]: propertyRecord() };
}

function particle(phaseId = 3, u = energyAt(phaseId, 278), overrides = {}) {
  return {
    id: `fresh-phase-${phaseId}`,
    material: MATERIAL,
    x: [0.25, 2, 2],
    v: [0.5, -0.25, 0.125],
    massKg: 1,
    specificInternalEnergyJPerKg: u,
    phaseCaloric: { phaseId, phaseFractions: fractions(phaseId) },
    ...overrides
  };
}

function state(particles = [particle()]) {
  return createSphState({ particles, smoothingLengthM: 0.2, time: 0, step: 0 });
}

function options(materialProperties = properties(), declaredModels = models) {
  return { materialProperties, condensableThermodynamicsByMaterial: declaredModels,
    soundSpeedScale: 1, minGasSoundSpeedMPerS: 0 };
}

function near(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} != ${expected} +/- ${tolerance}`);
}

function rejectsBoth(source, packOptions, expectation = undefined) {
  const snapshot = structuredClone(source);
  for (const pack of PACKERS) {
    assert.throws(() => pack(source, packOptions), expectation, pack.name);
    assert.deepEqual(source, snapshot, `${pack.name} must not mutate rejected input`);
  }
}

function assertPackedParticle(packed, mechanics, index, phaseId, u, massKg = 1) {
  const s = index * 8;
  const t = index * 12;
  const m = index * 32;
  const rho = Math.fround(phaseId === 2 ? 1000 : VAPOR_REST_DENSITY);
  const expectedTemperature = temperatureAt(phaseId, Math.fround(u));
  assert.equal(packed.state[s + 3], Math.fround(massKg));
  assert.equal(packed.state[s + 7], Math.fround(u), 'the original U is not rebased');
  assert.equal(packed.thermo[t], stableOpticalMaterialId(MATERIAL));
  assert.equal(packed.thermo[t + 1], phaseId);
  // One f32 temperature rounding at 200..450 K is at most 1.53e-5 K.
  near(packed.thermo[t + 2], expectedTemperature, 2e-5, 'phase-specific temperature');
  assert.equal(packed.thermo[t + 3], rho);
  assert.deepEqual(Array.from(packed.thermo.slice(t + 4, t + 8)), fractions(phaseId));
  assert.equal(packed.thermo[t + 10], SPH_GPU_PARTICLE_STATUS.ready);
  assert.equal(mechanics.mechanics[m + 18], 1, 'initial J');
  assert.equal(mechanics.mechanics[m + 19], Math.fround(Math.fround(massKg) / rho));
  assert.equal(mechanics.mechanics[m + 20], 0, 'liquid/gas is not a solid');
  assert.equal(mechanics.mechanics[m + 21], SPH_GPU_PARTICLE_STATUS.ready);
  assert.equal(mechanics.mechanics[m + 23], 0, 'no shear modulus');
  assert.equal(mechanics.mechanics[m + 24], 0, 'no solid Lame coefficient');
  assert.equal(mechanics.mechanics[m + 26], phaseId === 3 ? 2 : 1);
  assert.equal(mechanics.mechanics[m + 27], SPH_GPU_PARTICLE_STATUS.ready);
  assert.equal(mechanics.mechanics[m + 31], Math.fround(massKg));
  assert.equal(packed.metadata[index].phase, phaseId === 2 ? 'liquid' : 'gas');
  assert.equal(mechanics.metadata[index].phase, packed.metadata[index].phase);
  if (phaseId === 3) {
    // Independent f32 contract: packed coefficient, packed live temperature,
    // f32 multiply, then sqrt. No shared evaluator used as the test oracle.
    const coefficient = Math.fround((4000 / (4000 - 100)) * 100);
    const c = Math.sqrt(Math.fround(coefficient * Math.fround(expectedTemperature)));
    assert.equal(mechanics.mechanics[m + 25], Math.fround(c), 'gas c uses gamma=Cp/(Cp-Rs)');
    near(mechanics.mechanics[m + 25] ** 2 / (100 * expectedTemperature),
      4000 / 3900, 2e-7, 'gas gamma');
  }
}


// Honest conduction-limited walls: choose dt so a wall pulse delivers exactly
// `joules` to particle 0, computing its conductance k*a*a/L exactly as
// runSphThermalStepCpu does (a = cube edge of the rest volume, L = max(d, a/2)).
function honestWallPulseDtS(packedState, thermalTable, { joules = 3900, deltaK = 20 } = {}) {
  const mass = packedState.state[3];
  const restDensity = packedState.thermo[3];
  const edge = Math.cbrt(mass / restDensity);
  const phaseId = packedState.thermo[1];
  const k = resolveThermalConductivityFromTable(thermalTable, packedState.thermo[0],
    packedState.state[7], phaseId, packedState.thermo.subarray(4, 8)).thermalConductivityWPerMK;
  const path = Math.max(packedState.state[0], 0.5 * edge);
  const conductance = k * edge * edge / path;
  return joules / (conductance * deltaK);
}

test('fresh constructor and clone preserve the explicit declaration with independent arrays', () => {
  const input = particle(3, 34_200);
  input.phaseCaloric.provenance = 'already in declared caloric basis';
  const before = structuredClone(input);
  const fresh = state([input]);
  const copied = cloneSphState(fresh);
  assert.deepEqual(input, before);
  assert.deepEqual(fresh.particles[0].phaseCaloric, input.phaseCaloric);
  assert.deepEqual(copied, fresh);
  assert.notEqual(fresh.particles[0].phaseCaloric, input.phaseCaloric);
  assert.notEqual(copied.particles[0].phaseCaloric, fresh.particles[0].phaseCaloric);
  assert.notEqual(fresh.particles[0].phaseCaloric.phaseFractions, input.phaseCaloric.phaseFractions);
  assert.notEqual(copied.particles[0].phaseCaloric.phaseFractions,
    fresh.particles[0].phaseCaloric.phaseFractions);
  input.phaseCaloric.phaseFractions[2] = 0;
  input.x[0] = 99;
  copied.particles[0].phaseCaloric.phaseFractions[1] = 1;
  copied.particles[0].v[0] = 99;
  assert.deepEqual(fresh.particles[0].phaseCaloric.phaseFractions, fractions(3));
  assert.deepEqual(fresh.particles[0].x, before.x);
  assert.deepEqual(fresh.particles[0].v, before.v);
  assert.equal(fresh.particles[0].specificInternalEnergyJPerKg, 34_200);
});

test('typed one-hot declarations are copied by construction and cloning, not aliased', () => {
  const input = particle(2, -50_003, {
    phaseCaloric: { phaseId: 2, phaseFractions: new Float32Array(fractions(2)) }
  });
  const fresh = state([input]);
  const cloned = cloneSphState(fresh);
  assert.deepEqual(fresh.particles[0].phaseCaloric.phaseFractions, fractions(2));
  input.phaseCaloric.phaseFractions[1] = 0;
  fresh.particles[0].phaseCaloric.phaseFractions[1] = 0;
  assert.deepEqual(cloned.particles[0].phaseCaloric.phaseFractions, fractions(2));
  assert.equal(buildSphGpuParticleBuffers(cloned, options()).thermo[1], 2);
});

for (const phaseId of [2, 3]) {
  test(`phase ${phaseId}: actual packers preserve signed U, phase, reference volume and mechanics`, () => {
    const temperatures = [200, 278, 300, 450];
    const input = state(temperatures.map((temperature, index) => particle(
      phaseId, energyAt(phaseId, temperature), { id: `p${index}`, massKg: 1.25 }
    )));
    const before = structuredClone(input);
    const packOptions = options();
    const beforeProperties = structuredClone(packOptions.materialProperties);
    const packed = buildSphGpuParticleBuffers(input, packOptions);
    const mechanics = buildMlsMpmGpuParticleBuffers(input, packOptions);
    assert.equal(typeof packed.phaseCaloricInitializationSignature, 'string');
    assert.ok(packed.phaseCaloricInitializationSignature.length > 0);
    assert.equal(mechanics.phaseCaloricInitializationSignature, packed.phaseCaloricInitializationSignature);
    for (const [index, temperature] of temperatures.entries()) {
      assertPackedParticle(packed, mechanics, index, phaseId, energyAt(phaseId, temperature), 1.25);
      assert.deepEqual(Array.from(packed.state.slice(index * 8, index * 8 + 3)), input.particles[index].x);
      assert.deepEqual(Array.from(packed.state.slice(index * 8 + 4, index * 8 + 7)), input.particles[index].v);
      assert.deepEqual(Array.from(mechanics.mechanics.slice(index * 32, index * 32 + 9)),
        [1, 0, 0, 0, 1, 0, 0, 0, 1]);
      assert.deepEqual(Array.from(mechanics.mechanics.slice(index * 32 + 9, index * 32 + 18)), Array(9).fill(0));
    }
    assert.deepEqual(input, before);
    assert.deepEqual(packOptions.materialProperties, beforeProperties);
    assert.equal(packed.scientificValidation, false);
    assert.equal(packed.fullPhysicsValidation, false);
  });
}

test('overlapping U=34200 is not a phase selector: liquid and vapor remain distinct', () => {
  const input = state([particle(2, 34_200), particle(3, 34_200)]);
  const packed = buildSphGpuParticleBuffers(input, options());
  const mechanics = buildMlsMpmGpuParticleBuffers(input, options());
  assertPackedParticle(packed, mechanics, 0, 2, 34_200);
  assertPackedParticle(packed, mechanics, 1, 3, 34_200);
  near(packed.thermo[2], 321.05075, 2e-5, 'liquid U inverse');
  assert.equal(packed.thermo[14], 278, 'same U is cool vapor on its own branch');
  assert.equal(packed.state[7], packed.state[15]);
});

test('the shared cold selector uses model phase and volume without mutating the declaration', () => {
  const select = prepareSphCondensableParticleInitialization(properties(), models);
  for (const phaseId of [2, 3]) {
    const input = particle(phaseId, 34_200, { massKg: 0.5 });
    const before = structuredClone(input);
    const selected = select(input);
    assert.equal(selected.phaseCaloric, true);
    assert.equal(selected.stablePhase, phaseId === 2 ? 'liquid' : 'gas');
    near(selected.temperatureK, temperatureAt(phaseId, 34_200), 1e-10, 'cold selector temperature');
    assert.equal(selected.restDensityKgPerM3, Math.fround(phaseId === 2 ? 1000 : VAPOR_REST_DENSITY));
    assert.equal(selected.referenceVolumeM3, 0.5 / selected.restDensityKgPerM3);
    assert.deepEqual(Object.values(selected.phaseFractions), fractions(phaseId));
    assert.equal(selected.clamped, null);
    assert.deepEqual(input, before);
  }
  assert.equal(select({ material: 'unrelated-legacy-material' }), null);
});

test('explicit packing is material-name agnostic, with unchanged numerical S/T/M lanes', () => {
  const source = state([particle(3, 34_200)]);
  const standardSph = buildSphGpuParticleBuffers(source, options());
  const standardMls = buildMlsMpmGpuParticleBuffers(source, options());
  for (const material of ['h2o', 'another-explicit-condensable']) {
    const renamed = state([particle(3, 34_200, { material })]);
    const renamedOptions = options({ [material]: propertyRecord() }, { [material]: model });
    const packed = buildSphGpuParticleBuffers(renamed, renamedOptions);
    const mechanics = buildMlsMpmGpuParticleBuffers(renamed, renamedOptions);
    assert.equal(packed.thermo[0], stableOpticalMaterialId(material));
    assert.deepEqual(packed.state, standardSph.state);
    assert.deepEqual(packed.thermo.slice(1), standardSph.thermo.slice(1));
    assert.deepEqual(mechanics.mechanics, standardMls.mechanics);
  }
});

test('explicit property and particle overrides may agree at exact packed f32 precision', () => {
  const props = properties();
  props[MATERIAL].molarMassKgPerMol += 1e-12;
  props[MATERIAL].phases[0].cpJPerKgK += 1e-8;
  props[MATERIAL].phases[1].cpJPerKgK += 1e-8;
  props[MATERIAL].phases[1].densityKgPerM3 += 1e-12;
  const input = state([particle()]);
  input.particles[0].restDensityKgPerM3 = VAPOR_REST_DENSITY;
  input.particles[0].mpmVolume0 = 1 / VAPOR_REST_DENSITY;
  const packed = buildSphGpuParticleBuffers(input, options(props));
  const mechanics = buildMlsMpmGpuParticleBuffers(input, options(props));
  assertPackedParticle(packed, mechanics, 0, 3, 34_200);
});

test('real packer output continues twice through the actual CPU thermal step on the same model', () => {
  const props = properties();
  const source = state([particle(2, 34_200, { x: [1, 1, 1] }),
    particle(3, 34_200, { x: [100, 100, 100] })]);
  const before = structuredClone(source);
  const packOptions = options(props);
  let packed = buildSphGpuParticleBuffers(source, packOptions);
  const mechanics = buildMlsMpmGpuParticleBuffers(source, packOptions);
  const table = buildSphThermalMaterialTable(props, { condensableThermodynamicsByMaterial: models });
  const originalState = packed.state.slice();
  const originalThermo = packed.thermo.slice();
  for (let cycle = 0; cycle < 2; cycle += 1) {
    const next = runSphThermalStepCpu({ sphParticleState: packed, thermalMaterialTable: table,
      wallModel: 'adiabatic', conductionRate: 0, dtS: 0.001 });
    assert.deepEqual(next.state, originalState, 'no heat must not rebase original U');
    assert.deepEqual(packed.state, originalState, 'thermal step keeps its packed input immutable');
    packed = { ...packed, state: next.state, thermo: next.thermo };
    assertPackedParticle(packed, mechanics, 0, 2, 34_200);
    assertPackedParticle(packed, mechanics, 1, 3, 34_200);
  }
  assert.deepEqual(packed.thermo, originalThermo);
  assert.deepEqual(source, before);
});

test('fresh packed vapor takes an independent 3900 J/kg wall pulse as exactly one kelvin', () => {
  const props = properties();
  const packed = buildSphGpuParticleBuffers(
    state([particle(3, undefined, { x: [0.25, 20, 20] })]), options(props));
  const beforeS = packed.state.slice();
  const beforeT = packed.thermo.slice();
  const table = buildSphThermalMaterialTable(props, { condensableThermodynamicsByMaterial: models });
  // Isolate conductive heat from gray radiation; no caloric row or Cp changes.
  const records = table.records.slice();
  for (let offset = 4; offset < records.length; offset += 8) records[offset] = 0;
  const out = runSphThermalStepCpu({ sphParticleState: packed,
    thermalMaterialTable: { ...table, records }, // The 1 kg vapor parcel is a cube about 2.15 m on a side: a 40 m box in y
    // and z keeps it touching x-min only.
    wallTemperaturesK: { xMin: 298 },
    wallLayerM: 1, wallRate: 1,
    dtS: honestWallPulseDtS(packed, { ...table, records }),
    conductionRate: 0, boxDimsM: [4, 40, 40] });
  // Honest wall: Q/m = (k a^2 / L) * (Twall-T) * dt / m = 3900 by construction.
  assert.equal(out.state[7], 34_200 + 3900);
  assert.equal(out.thermo[2], 279);
  assert.equal(out.thermo[1], 3);
  assert.deepEqual(Array.from(out.thermo.slice(4, 8)), fractions(3));
  near(out.wallHeatJ.xMin, 3900, 1e-8, 'independent wall heat');
  assert.deepEqual(packed.state, beforeS);
  assert.deepEqual(packed.thermo, beforeT);
});

test('default and explicit-empty enrollment keep actual legacy packing and constructor behavior', () => {
  const closures = createReferenceMaterialClosures();
  const legacyProperties = { h2o: closures.h2o.properties };
  const source = state([{ material: 'h2o', x: [1, 2, 3], v: [0, 0, 0], massKg: 1,
    specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(legacyProperties.h2o, 298) }]);
  const before = structuredClone(source);
  for (const pack of PACKERS) {
    assert.deepEqual(pack(source, { materialProperties: legacyProperties }),
      pack(source, { materialProperties: legacyProperties, condensableThermodynamicsByMaterial: {} }));
  }
  const packed = buildSphGpuParticleBuffers(source, { materialProperties: legacyProperties });
  assert.equal(Object.hasOwn(packed, 'phaseCaloricInitializationSignature'), false);
  assert.equal(Object.hasOwn(buildMlsMpmGpuParticleBuffers(source, {
    materialProperties: legacyProperties
  }), 'phaseCaloricInitializationSignature'), false);
  assert.equal(packed.thermo[1], 2);
  near(packed.thermo[2], 298, 2e-5, 'legacy liquid temperature');
  assert.deepEqual(source, before);
  assert.equal(state([{ material: 'h2o', x: [0, 0, 0], massKg: 1 }])
    .particles[0].specificInternalEnergyJPerKg, 0);
  assert.equal(state([{ material: 'h2o', x: [0, 0, 0], massKg: 1,
    specificInternalEnergyJPerKg: '123' }]).particles[0].specificInternalEnergyJPerKg, 123);
});

test('one enrolled material does not enroll or rewrite an unrelated legacy material', () => {
  const h2o = createReferenceMaterialClosures().h2o.properties;
  const legacyParticle = { material: 'h2o', x: [2, 2, 2], v: [0, 0, 0], massKg: 1,
    specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(h2o, 298) };
  const source = state([particle(), legacyParticle]);
  const props = { ...properties(), h2o };
  const packed = buildSphGpuParticleBuffers(source, options(props));
  const mechanics = buildMlsMpmGpuParticleBuffers(source, options(props));
  const legacySph = buildSphGpuParticleBuffers(state([legacyParticle]), { materialProperties: { h2o } });
  const legacyMls = buildMlsMpmGpuParticleBuffers(state([legacyParticle]), { materialProperties: { h2o } });
  assert.deepEqual(packed.state.slice(8), legacySph.state);
  assert.deepEqual(packed.thermo.slice(12), legacySph.thermo);
  assert.deepEqual(mechanics.mechanics.slice(32), legacyMls.mechanics);
  assert.equal(packed.thermo[1], 3);
});

for (const [name, descriptor] of [
  ['missing', undefined], ['null', null], ['empty', {}],
  ['solid', { phaseId: 1, phaseFractions: [1, 0, 0, 0] }],
  ['plasma', { phaseId: 4, phaseFractions: [0, 0, 0, 1] }],
  ['fractional ID', { phaseId: 2.9, phaseFractions: fractions(3) }],
  ['string ID', { phaseId: '3', phaseFractions: fractions(3) }],
  ['missing fractions', { phaseId: 3 }],
  ['wrong branch', { phaseId: 3, phaseFractions: fractions(2) }],
  ['mixed', { phaseId: 3, phaseFractions: [0, 0.5, 0.5, 0] }],
  ['approximately pure', { phaseId: 3, phaseFractions: [0, 1e-8, 1 - 1e-8, 0] }],
  ['string fractions', { phaseId: 3, phaseFractions: ['0', '0', '1', '0'] }],
  ['negative fraction', { phaseId: 3, phaseFractions: [0, -0.1, 1.1, 0] }],
  ['nonfinite fraction', { phaseId: 3, phaseFractions: [0, 0, NaN, 0] }],
  ['short fractions', { phaseId: 3, phaseFractions: [0, 0, 1] }],
  ['extra fraction', { phaseId: 3, phaseFractions: [0, 0, 1, 0, 0] }]
]) {
  test(`both packers reject ${name} explicit phase declaration rather than use legacy equilibrium`, () => {
    const source = state();
    if (descriptor === undefined) delete source.particles[0].phaseCaloric;
    else source.particles[0].phaseCaloric = structuredClone(descriptor);
    rejectsBoth(source, options(), /exact pure liquid\/gas phase and fractions/);
  });
}

for (const [name, value] of [
  ['missing', undefined], ['null', null], ['string', '34200'], ['NaN', NaN],
  ['positive infinity', Infinity], ['negative infinity', -Infinity], ['f32 overflow', 1e40]
]) {
  test(`constructor preserves ${name} raw explicit U so both packers reject it`, () => {
    const input = particle();
    if (value === undefined) delete input.specificInternalEnergyJPerKg;
    else input.specificInternalEnergyJPerKg = value;
    const source = state([input]);
    assert.ok(Object.is(source.particles[0].specificInternalEnergyJPerKg, value));
    const cloned = cloneSphState(source);
    assert.ok(Object.is(cloned.particles[0].specificInternalEnergyJPerKg, value));
    rejectsBoth(source, options(), /Initial U outside/);
    rejectsBoth(cloned, options(), /Initial U outside/);
  });
}

for (const [name, phaseId, u] of [
  ['gas U lies only in liquid domain', 3, -300_000],
  ['liquid U lies only in vapor domain', 2, 600_000],
  ['liquid below minimum', 2, energyAt(2, 200) - 1],
  ['liquid above maximum', 2, energyAt(2, 450) + 1],
  ['vapor below minimum', 3, energyAt(3, 200) - 1],
  ['vapor above maximum', 3, energyAt(3, 450) + 1]
]) {
  test(`both packers reject ${name} without phase switching or clipping`, () => {
    rejectsBoth(state([particle(phaseId, u)]), options(), /Initial U outside/);
  });
}

test('declaring phaseCaloric without its enrolled model throws in both packers and the helper', () => {
  rejectsBoth(state(), { materialProperties: properties() }, /requires its declared material model/);
  rejectsBoth(state(), options(properties(), {}), /requires its declared material model/);
  assert.throws(() => prepareSphCondensableParticleInitialization(properties(), {})(particle()),
    /requires its declared material model/);
});

for (const [name, declaredModels] of [
  ['null model map', null], ['array model map', []], ['missing material model', { [MATERIAL]: undefined }],
  ['null material model', { [MATERIAL]: null }], ['unbranded model copy', { [MATERIAL]: { ...model } }],
  ['raw model definition', { [MATERIAL]: MODEL_INPUT }], ['unknown material', { missing: model }]
]) {
  test(`both packers reject ${name} at cold model admission`, () => {
    rejectsBoth(state(), options(properties(), declaredModels), TypeError);
    assert.throws(() => prepareSphCondensableParticleInitialization(properties(), declaredModels), TypeError);
  });
}

for (const [name, mutate] of [
  ['different molar mass', (p) => { p.molarMassKgPerMol *= 2; }],
  ['missing molar mass', (p) => { delete p.molarMassKgPerMol; }],
  ['string molar mass', (p) => { p.molarMassKgPerMol = String(p.molarMassKgPerMol); }],
  ['liquid Cp mismatch', (p) => { p.phases[0].cpJPerKgK = 3900; }],
  ['vapor Cp mistaken for Cv', (p) => { p.phases[1].cpJPerKgK = 3900; }],
  ['string Cp', (p) => { p.phases[1].cpJPerKgK = '4000'; }],
  ['missing Cp', (p) => { delete p.phases[1].cpJPerKgK; }],
  ['liquid density mismatch', (p) => { p.phases[0].densityKgPerM3 = 999; }],
  ['vapor density mismatch', (p) => { p.phases[1].densityKgPerM3 = 1; }],
  ['nonfinite density', (p) => { p.phases[1].densityKgPerM3 = Infinity; }],
  ['string density', (p) => { p.phases[1].densityKgPerM3 = '0.1'; }],
  ['missing liquid phase', (p) => { p.phases.shift(); }],
  ['missing gas phase', (p) => { p.phases.pop(); }],
  ['duplicate liquid phase', (p) => { p.phases.push({ ...p.phases[0] }); }],
  ['duplicate gas phase', (p) => { p.phases.push({ ...p.phases[1] }); }]
]) {
  test(`both packers reject ${name}, keeping initialization and mechanics on one physical basis`, () => {
    const props = properties();
    mutate(props[MATERIAL]);
    rejectsBoth(state(), options(props), TypeError);
  });
}

test('material IDs must be unambiguous even when only one alias is enrolled', () => {
  const props = properties();
  const alias = MATERIAL.toUpperCase();
  props[alias] = propertyRecord();
  assert.equal(stableOpticalMaterialId(MATERIAL), stableOpticalMaterialId(alias));
  rejectsBoth(state(), options(props), /Ambiguous explicit caloric material IDs/);
});

for (const [name, overrides] of [
  ['huge energy origin', { liquidReferenceEnthalpyJPerKg: 1e20 }],
  ['inaccurate f32 energy origin', { liquidReferenceEnthalpyJPerKg: 1e12 }],
  ['unrepresentable density', { liquidDensityKgPerM3: 1e40 }],
  ['collapsed f32 temperature domain', { minTemperatureK: 300, maxTemperatureK: 300 + 1e-6 }]
]) {
  test(`both packers reject ${name} instead of rebasing or degrading the model`, () => {
    const preciseModel = createCondensableThermodynamics({ ...MODEL_INPUT, ...overrides });
    rejectsBoth(state(), options(properties(), { [MATERIAL]: preciseModel }),
      /Unrepresentable f32 phase caloric domain or heat capacity/);
  });
}

for (const [name, value] of [
  ['negative mass', -1], ['nonfinite mass', NaN], ['infinite mass', Infinity],
  ['string mass', '1'], ['f32 mass overflow', 1e40], ['f32 mass underflow', 1e-50]
]) {
  test(`both packers reject ${name} rather than replace inventory with a numeric default`, () => {
    const source = state();
    source.particles[0].massKg = value;
    rejectsBoth(source, options(), /Unrepresentable explicit caloric particle mass/);
  });
}

for (const [name, overrides] of [
  ['particle density mismatch', { restDensityKgPerM3: 1 }],
  ['particle density nonfinite', { restDensityKgPerM3: NaN }],
  ['particle density string', { restDensityKgPerM3: '0.1' }],
  ['particle volume mismatch', { mpmVolume0: 1 }],
  ['particle volume nonfinite', { mpmVolume0: Infinity }],
  ['particle volume string', { mpmVolume0: '10' }]
]) {
  test(`both packers reject ${name} instead of publishing inconsistent rest volume`, () => {
    const source = state();
    Object.assign(source.particles[0], overrides);
    rejectsBoth(source, options(), /requires matching particle reference/);
  });
}

test('finite representable mass can still overflow or underflow its physical reference volume', () => {
  // On the standard-atmosphere density basis (3.38 kg/m^3 here) no f32 mass
  // overflows the vapor volume; the smallest subnormal mass underflows it.
  const vapor = state([particle(3, 34_200, { massKg: 2 ** -149 })]);
  rejectsBoth(vapor, options(), /Unrepresentable explicit caloric reference volume/);
  const liquid = state([particle(2, 34_200, { massKg: 2 ** -149 })]);
  rejectsBoth(liquid, options(), /Unrepresentable explicit caloric reference volume/);
});

test('zero-mass explicit companion slots retain phase metadata but have exactly zero inventory and volume', () => {
  const source = state([particle(2, 34_200, { massKg: 0 }), particle(3, 34_200, { massKg: 0 })]);
  for (const input of source.particles) {
    input.phaseCompanionSlot = true;
    input.mpmVolume0 = 0;
  }
  const packed = buildSphGpuParticleBuffers(source, options());
  const mechanics = buildMlsMpmGpuParticleBuffers(source, options());
  for (const [index, phaseId] of [2, 3].entries()) {
    assert.equal(packed.state[index * 8 + 3], 0);
    assert.equal(packed.thermo[index * 12 + 1], phaseId);
    assert.equal(packed.thermo[index * 12 + 9], 0, 'no represented molecules in an empty slot');
    assert.equal(packed.thermo[index * 12 + 10], SPH_GPU_PARTICLE_STATUS.phaseCompanionReserved);
    assert.equal(mechanics.mechanics[index * 32 + 19], 0);
    assert.equal(mechanics.mechanics[index * 32 + 31], 0);
    assert.equal(mechanics.mechanics[index * 32 + 21], SPH_GPU_PARTICLE_STATUS.phaseCompanionReserved);
    assert.equal(mechanics.mechanics[index * 32 + 27], SPH_GPU_PARTICLE_STATUS.phaseCompanionReserved);
  }
  source.particles[0].mpmVolume0 = 1;
  rejectsBoth(source, options(), /Empty explicit caloric slot must have zero reference volume/);
  source.particles[0].mpmVolume0 = 0;
  delete source.particles[0].specificInternalEnergyJPerKg;
  rejectsBoth(source, options(), /Initial U outside/);
});

function rejectsThermalConsumers(packed, table) {
  const beforeState = packed.state.slice();
  const beforeThermo = packed.thermo.slice();
  const args = { sphParticleState: packed, thermalMaterialTable: table,
    wallModel: 'adiabatic', conductionRate: 0, dtS: 0.001 };
  assert.throws(() => runSphThermalStepCpu(args), /caloric initialization|initialization caloric/i);
  let allocations = 0;
  let writes = 0;
  const device = {
    createBuffer() { allocations += 1; throw new Error('unexpected allocation before cold mismatch rejection'); },
    queue: { writeBuffer() { writes += 1; throw new Error('unexpected upload before cold mismatch rejection'); } }
  };
  assert.throws(() => createSphThermalStepWebGpuEncoderStage({ ...args, device }),
    /caloric initialization|initialization caloric/i);
  assert.equal(allocations, 0);
  assert.equal(writes, 0);
  assert.deepEqual(packed.state, beforeState);
  assert.deepEqual(packed.thermo, beforeThermo);
}

test('actual thermal consumers reject another U zero even when phase Cp, molar mass and densities agree', () => {
  const props = properties();
  const packed = buildSphGpuParticleBuffers(state(), options(props));
  const shiftedModel = createCondensableThermodynamics({ ...MODEL_INPUT,
    liquidReferenceEnthalpyJPerKg: -40_000 });
  const tableA = buildSphThermalMaterialTable(props, { condensableThermodynamicsByMaterial: models });
  const tableB = buildSphThermalMaterialTable(props, {
    condensableThermodynamicsByMaterial: { [MATERIAL]: shiftedModel }
  });
  assert.deepEqual(tableB.metadata[0].caloricInitializationProperties,
    tableA.metadata[0].caloricInitializationProperties);
  assert.equal(tableB.segments[8], tableA.segments[8]);
  assert.equal(tableB.segments[20], tableA.segments[20]);
  assert.equal(tableB.segments[4] - tableA.segments[4], 10_000);
  assert.equal(tableB.segments[16] - tableA.segments[16], 10_000);
  // U=34200 remains inside both gas intervals; domain checks alone cannot
  // distinguish these two bases. No output is allowed at the wrong T.
  assert.ok(34_200 > tableB.segments[16] && 34_200 < tableB.segments[17]);
  rejectsThermalConsumers(packed, tableB);
});

for (const [name, mutate] of [
  ['live lower U endpoint', (table) => { table.segments[16] += 1; }],
  ['live upper U endpoint', (table) => { table.segments[17] += 1; }],
  ['live temperature endpoint', (table) => { table.segments[18] += 1; }],
  ['live density', (table) => { table.segments[20] *= 2; }],
  ['live phase', (table) => { table.segments[14] = 2; }],
  ['live segment kind', (table) => { table.segments[13] = 1; }],
  ['live segment status', (table) => { table.segments[22] = 255; }],
  ['live material status', (table) => { table.records[3] = 255; }],
  ['live row bounds', (table) => { table.records[1] = 0.5; }],
  ['missing physical-property declaration', (table) => { delete table.metadata[0].caloricInitializationProperties; }],
  ['different declared molar mass', (table) => { table.metadata[0].caloricInitializationProperties[0] *= 2; }],
  ['different declared liquid Cp', (table) => { table.metadata[0].caloricInitializationProperties[1] += 1; }],
  ['different declared vapor Cp', (table) => { table.metadata[0].caloricInitializationProperties[2] += 1; }]
]) {
  test(`actual thermal consumers reject changed ${name} rather than trust old table metadata`, () => {
    const props = properties();
    const packed = buildSphGpuParticleBuffers(state(), options(props));
    const table = buildSphThermalMaterialTable(props, { condensableThermodynamicsByMaterial: models });
    mutate(table);
    rejectsThermalConsumers(packed, table);
  });
}

test('cold caloric consistency is independent of liquid/gas row ordering', () => {
  const props = properties();
  const packed = buildSphGpuParticleBuffers(state([
    particle(2, 34_200, { x: [1, 1, 1] }), particle(3, 34_200, { x: [100, 100, 100] })
  ]), options(props));
  const table = buildSphThermalMaterialTable(props, { condensableThermodynamicsByMaterial: models });
  const reversed = { ...table,
    segments: new Float32Array([...table.segments.slice(12), ...table.segments.slice(0, 12)]),
    segmentMetadata: [...table.segmentMetadata].reverse()
  };
  const args = { sphParticleState: packed, wallModel: 'adiabatic', conductionRate: 0, dtS: 0.001 };
  const normal = runSphThermalStepCpu({ ...args, thermalMaterialTable: table });
  const swapped = runSphThermalStepCpu({ ...args, thermalMaterialTable: reversed });
  assert.deepEqual(swapped.state, normal.state);
  assert.deepEqual(swapped.thermo, normal.thermo);
  assert.equal(swapped.thermo[1], 2);
  assert.equal(swapped.thermo[13], 3);
  near(swapped.thermo[2], 321.05075, 2e-5, 'row-reversed liquid temperature');
  assert.equal(swapped.thermo[14], 278);
});

test('mechanics refresh rejects SPH and MLS initialized on distinct U bases, even with identical M rows', () => {
  const props = properties();
  const input = state();
  const sphA = buildSphGpuParticleBuffers(input, options(props));
  const mlsA = buildMlsMpmGpuParticleBuffers(input, options(props));
  const shiftedModel = createCondensableThermodynamics({ ...MODEL_INPUT,
    liquidReferenceEnthalpyJPerKg: -40_000 });
  const mlsB = buildMlsMpmGpuParticleBuffers(state([particle(3, 44_200)]),
    options(props, { [MATERIAL]: shiftedModel }));
  assert.deepEqual(mlsA.mechanics, mlsB.mechanics,
    'equal temperature/mass/material produce equal M despite different energy bases');
  assert.notEqual(mlsA.phaseCaloricInitializationSignature, mlsB.phaseCaloricInitializationSignature);
  const mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable(props, {
    soundSpeedScale: 1, minGasSoundSpeedMPerS: 0
  });
  const beforeS = sphA.state.slice();
  const beforeT = sphA.thermo.slice();
  const beforeM = mlsB.mechanics.slice();
  assert.throws(() => refreshMlsMpmMechanicsCpu({ sphParticleState: sphA,
    mlsMpmParticleState: mlsB, mechanicsMaterialTable }), /SPH and MLS initialization caloric models differ/);
  assert.deepEqual(sphA.state, beforeS);
  assert.deepEqual(sphA.thermo, beforeT);
  assert.deepEqual(mlsB.mechanics, beforeM);
  const accepted = refreshMlsMpmMechanicsCpu({ sphParticleState: sphA,
    mlsMpmParticleState: mlsA, mechanicsMaterialTable });
  assert.equal(accepted.authorityValidationStatus, 'mechanics-refresh-authority-accepted');
  assert.equal(accepted.mechanics[19], mlsA.mechanics[19]);
  assert.deepEqual(sphA.state, beforeS);
  assert.deepEqual(sphA.thermo, beforeT);
});

test('one-sided missing cold declarations do not silently waive SPH/MLS consistency', () => {
  const props = properties();
  const input = state();
  const sph = buildSphGpuParticleBuffers(input, options(props));
  const mls = buildMlsMpmGpuParticleBuffers(input, options(props));
  const mechanicsMaterialTable = buildMlsMpmMechanicsMaterialTable(props);
  const unmarkedSph = { ...sph };
  const unmarkedMls = { ...mls };
  delete unmarkedSph.phaseCaloricInitializationSignature;
  delete unmarkedMls.phaseCaloricInitializationSignature;
  for (const [sphParticleState, mlsMpmParticleState] of [[unmarkedSph, mls], [sph, unmarkedMls]]) {
    assert.throws(() => refreshMlsMpmMechanicsCpu({ sphParticleState, mlsMpmParticleState,
      mechanicsMaterialTable }), /SPH and MLS initialization caloric models differ/);
  }
});

const CONDITIONED_CP = 100.000001;
const CONDITIONED_CV = CONDITIONED_CP - 100;
const conditionedModel = createCondensableThermodynamics({ ...MODEL_INPUT,
  liquidReferenceEnthalpyJPerKg: -1_970_000,
  vaporizationReferenceEnthalpyJPerKg: 2_000_000,
  vaporCpJPerKgK: CONDITIONED_CP
});
const conditionedModels = Object.freeze({ [MATERIAL]: conditionedModel });

function conditionedProperties(vaporCp = CONDITIONED_CP) {
  const props = properties();
  props[MATERIAL].phases[1].cpJPerKgK = vaporCp;
  return props;
}

for (const [name, propertyCp] of [
  ['negative property Cv', 99.999999],
  ['positive property Cv at half the declared value', 100.0000005]
]) {
  test(`both packers reject ${name} even though Cp and molar mass match after f32 packing`, () => {
    assert.equal(Math.fround(propertyCp), Math.fround(CONDITIONED_CP));
    const propertyCv = propertyCp - 100;
    if (propertyCp < 100) assert.ok(propertyCv < 0);
    else {
      assert.ok(propertyCv > 0);
      near(propertyCv / CONDITIONED_CV, 0.5, 1e-8, 'independent mismatched Cv ratio');
    }
    const source = state([particle(3, CONDITIONED_CV * -22)]);
    const props = conditionedProperties(propertyCp);
    // Caloric compilation is valid: rejection must concern the actual
    // mechanics Cp-R inputs, not arbitrarily forbid this small-Cv model.
    const table = buildSphThermalMaterialTable(conditionedProperties(), {
      condensableThermodynamicsByMaterial: conditionedModels
    });
    assert.equal(table.segmentCount, 2);
    assert.equal(table.segments[1], 3);
    assert.equal(table.segments[13], 3);
    rejectsBoth(source, options(props, conditionedModels), /matching positive vapor Cv/);
  });
}

test('exact matching ill-conditioned Cp-R inputs remain valid with the declared gas temperature and gamma', () => {
  const props = conditionedProperties();
  const sourceU = CONDITIONED_CV * -22;
  const source = state([particle(3, sourceU)]);
  const before = structuredClone(source);
  const packOptions = options(props, conditionedModels);
  const packed = buildSphGpuParticleBuffers(source, packOptions);
  const mechanics = buildMlsMpmGpuParticleBuffers(source, packOptions);
  const table = buildSphThermalMaterialTable(props, {
    condensableThermodynamicsByMaterial: conditionedModels
  });
  assert.equal(table.segmentCount, 2);
  assert.equal(table.segments[1], 3);
  assert.equal(table.segments[13], 3);
  // u_v(T0) = -1970000 + 2000000 - 100*300 = 0.
  assert.equal(conditionedModel.vaporReferenceInternalEnergyJPerKg, 0);
  assert.equal(packed.state[7], Math.fround(sourceU));
  const expectedTemperature = 300 + Math.fround(sourceU) / CONDITIONED_CV;
  near(packed.thermo[2], expectedTemperature, 2e-5, 'small-Cv gas temperature');
  assert.equal(packed.thermo[1], 3);
  assert.deepEqual(Array.from(packed.thermo.slice(4, 8)), fractions(3));
  assert.equal(packed.thermo[3], Math.fround(VAPOR_REST_DENSITY));
  assert.equal(mechanics.mechanics[19], Math.fround(1 / Math.fround(VAPOR_REST_DENSITY)));
  assert.equal(mechanics.mechanics[26], 2);
  const expectedGamma = CONDITIONED_CP / CONDITIONED_CV;
  const expectedSoundSpeed = Math.sqrt(expectedGamma * 100 * expectedTemperature);
  // The existing 2e-7 relative f32 gamma budget is unchanged; compare the
  // ratio so this large but representable physical value is not clipped.
  near(mechanics.mechanics[25] / expectedSoundSpeed, 1, 2e-7, 'small-Cv gas sound speed ratio');
  near((mechanics.mechanics[25] ** 2 / (100 * expectedTemperature)) / expectedGamma,
    1, 2e-7, 'small-Cv gamma ratio');
  assert.ok(mechanics.mechanics[25] > 1e6, 'must not use the legacy gamma=1.33 fallback');
  assert.equal(mechanics.phaseCaloricInitializationSignature, packed.phaseCaloricInitializationSignature);
  const continued = runSphThermalStepCpu({ sphParticleState: packed, thermalMaterialTable: table,
    wallModel: 'adiabatic', conductionRate: 0, dtS: 0.001 });
  assert.deepEqual(continued.state, packed.state);
  assert.equal(continued.thermo[1], 3);
  near(continued.thermo[2], expectedTemperature, 2e-5, 'small-Cv thermal continuation');
  assert.deepEqual(source, before);
});
