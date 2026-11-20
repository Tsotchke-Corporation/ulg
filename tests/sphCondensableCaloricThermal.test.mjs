import assert from 'node:assert/strict';
import test from 'node:test';
import { ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA }
  from '../ulg-gpu-abi/src/index.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import { CONDENSABLE_THERMODYNAMICS_SCHEMA, createCondensableThermodynamics }
  from '../src/runtime/material/condensableThermodynamics.js';
import {
  buildSphThermalMaterialTable, buildSphThermalClosureGraphBuffers,
  buildSphThermalPhaseResponseTable, resolveThermalStateFromTable,
  resolveThermalStateFromGraphPhaseResponseCpu, resolveThermalPhaseResponseFromTable,
  resolveThermalConductivityFromTable, resolveThermalCarrierTemperatureSlopeFromTable,
  resolveThermalCarrierEnergyDomainFromTable, resolveThermalCarrierReachableEnergyDomainFromTable,
  resolveThermalCarrierEnergyDomainForTemperatureRangeFromTable, runSphThermalStepCpu,
  uploadSphThermalResponseGraphBuffers
} from '../src/runtime/sph/sphThermalGpuKernel.js';
import { buildSphReactionTable, runSphReactionStepCpu }
  from '../src/runtime/sph/sphReactionGpuKernel.js';

// Independent synthetic caloric basis, NOT a water fit, saturation admission,
// or preset initializer. Overlapping U intervals deliberately make an energy-
// only phase lookup wrong. Cp_v=4000 but Cv_v=3900 tests the ideal-gas PV term.
const input = Object.freeze({
  schema: CONDENSABLE_THERMODYNAMICS_SCHEMA,
  energyBasis: 'specific-enthalpy-at-reference-pressure',
  referenceTemperatureK: 300, referencePressurePa: 3000,
  liquidReferenceEnthalpyJPerKg: -50_000,
  vaporizationReferenceEnthalpyJPerKg: 200_000,
  liquidCpJPerKgK: 4000, vaporCpJPerKgK: 4000,
  liquidDensityKgPerM3: 1000, molarMassKgPerMol: 8.314462618 / 100,
  minTemperatureK: 200, maxTemperatureK: 450, maxPressurePa: 2_000_000,
  provenance: 'independent synthetic explicit-phase thermal integration fixture'
});
const phase = Object.freeze({ liquid: 2, gas: 3 });
const fractions = (id) => [0, id === 2 ? 1 : 0, id === 3 ? 1 : 0, 0];
const cv = (id) => id === 2 ? 4000 : 3900;
const u = (id, temperature) => (id === 2 ? -50_003 : 120_000)
  + cv(id) * (temperature - 300);
const near = (actual, expected, tolerance = 1e-7) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
  `${actual} must be within ${tolerance} of independent expectation ${expected}`
);
const closures = createReferenceMaterialClosures();
const properties = { h2o: { ...closures.h2o.properties,
  phases: closures.h2o.properties.phases.map((entry) => ({ ...entry,
    thermalConductivityWPerMK: entry.name === 'gas' ? 0.025 : 0.6,
    thermalConductivityProvenance: { source: 'synthetic integration fixture', phase: entry.name }
  }))
} };
const id = stableOpticalMaterialId('h2o');
const model = createCondensableThermodynamics(input);
const table = buildSphThermalMaterialTable(properties, {
  condensableThermodynamicsByMaterial: { h2o: model }
});
const graphs = buildSphThermalClosureGraphBuffers(table);
const responses = buildSphThermalPhaseResponseTable(table, graphs);
const withoutRadiation = (source) => {
  const records = source.records.slice();
  for (let i = 4; i < records.length; i += 8) records[i] = 0;
  return { ...source, records };
};
const graphState = (energy, phaseId, phaseFractions, graphSet = graphs, responseTable = responses) =>
  resolveThermalStateFromGraphPhaseResponseCpu({ graphSet, responseTable,
    materialId: id, specificInternalEnergyJPerKg: energy, phaseId, phaseFractions });

function packed({ phaseId = 3, energy = u(3, 278), phaseFractions = fractions(phaseId),
  position = [2, 2, 2], cachedTemperatureK = 999 } = {}) {
  return { schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: 1, smoothingLengthM: 0.2,
    state: new Float32Array([...position, 1, 0, 0, 0, energy]),
    thermo: new Float32Array([id, phaseId, cachedTemperatureK, phaseId === 2 ? 1000 : 0.1,
      ...phaseFractions, 0.2, 10, 1, 0.1]) };
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

test('explicit enrollment emits exactly two independent caloric rows and preserves default legacy tables', () => {
  assert.equal(table.segmentCount, 2);
  assert.equal(responses.responseCount, 2);
  assert.deepEqual(Array.from(table.segments).filter((_, i) => i % 12 === 1), [3, 3]);
  assert.deepEqual(Array.from(responses.responses).filter((_, i) => i % 16 === 1), [3, 3]);
  for (const [row, phaseId] of [2, 3].entries()) {
    assert.equal(table.segments[row * 12 + 2], phaseId);
    assert.equal(table.segments[row * 12 + 3], phaseId);
    assert.equal(table.segments[row * 12 + 4], u(phaseId, 200));
    assert.equal(table.segments[row * 12 + 5], u(phaseId, 450));
  }
  const legacy = buildSphThermalMaterialTable(properties);
  assert.deepEqual(buildSphThermalMaterialTable(properties, {
    condensableThermodynamicsByMaterial: {}
  }), legacy);
  const energy = specificInternalEnergyJPerKg(properties.h2o, 298);
  const out = resolveThermalStateFromTable(legacy, id, energy);
  assert.equal(out.phaseId, phase.liquid);
  near(out.temperatureK, 298, 1e-4);
  const next = runSphThermalStepCpu({ sphParticleState: packed({ phaseId: 2, energy }),
    thermalMaterialTable: legacy, wallModel: 'adiabatic', conductionRate: 0, dtS: 0.001 });
  assert.equal(next.state[7], Math.fround(energy));
  assert.equal(next.thermo[1], phase.liquid);
  near(next.thermo[2], 298, 1e-4);
});

for (const phaseId of [2, 3]) {
  test(`phase ${phaseId}: overlapping U selects phase/Cv in table, graph, conductivity, and domains`, () => {
    const energy = 34_200;
    const expectedT = 300 + (energy - u(phaseId, 300)) / cv(phaseId);
    const onehot = fractions(phaseId);
    for (const state of [resolveThermalStateFromTable(table, id, energy, phaseId, onehot),
      graphState(energy, phaseId, onehot)]) {
      assert.equal(state.status, 1);
      assert.equal(state.phaseId, phaseId);
      near(state.temperatureK, expectedT, 4e-5);
      assert.deepEqual(Object.values(state.phaseFractions), onehot);
    }
    const response = resolveThermalPhaseResponseFromTable(responses, id, energy, phaseId, onehot);
    assert.equal(response.segmentType, 3);
    assert.equal(response.domainStatus, 'in-domain');
    assert.equal(response.phaseId, phaseId);
    near(resolveThermalCarrierTemperatureSlopeFromTable(table, id, energy, phaseId, onehot), 1 / cv(phaseId));
    const conductivity = resolveThermalConductivityFromTable(table, id, energy, phaseId, onehot);
    assert.equal(conductivity.ready, true);
    assert.equal(conductivity.phaseFromId, phaseId);
    near(conductivity.thermalConductivityWPerMK, phaseId === 3 ? 0.025 : 0.6);
    for (const resolver of [resolveThermalCarrierEnergyDomainFromTable,
      resolveThermalCarrierReachableEnergyDomainFromTable]) {
      const domain = resolver(table, id, energy, phaseId, onehot);
      assert.equal(domain.ready, true);
      assert.equal(domain.containingSegmentCount, 1);
      near(domain.energyMinJPerKg, u(phaseId, 200));
      near(domain.energyMaxJPerKg, u(phaseId, 450));
    }
    const temperatureDomain = resolveThermalCarrierEnergyDomainForTemperatureRangeFromTable(
      table, id, energy, 270, 330, phaseId, onehot);
    assert.equal(temperatureDomain.ready, true);
    near(temperatureDomain.energyMinJPerKg, u(phaseId, 270));
    near(temperatureDomain.energyMaxJPerKg, u(phaseId, 330));
    for (const temperature of [200, 450]) {
      const endpoint = resolveThermalStateFromTable(table, id, u(phaseId, temperature), phaseId, onehot);
      assert.equal(endpoint.status, 1);
      assert.equal(endpoint.temperatureK, temperature);
    }
  });
}

test('reversing the two rows cannot change explicit selection or the graph inverse', () => {
  const reordered = { ...table, segments: new Float32Array([
    ...table.segments.slice(12), ...table.segments.slice(0, 12)
  ]), segmentMetadata: [...table.segmentMetadata].reverse() };
  const reorderedGraphs = buildSphThermalClosureGraphBuffers(reordered);
  const reorderedResponses = buildSphThermalPhaseResponseTable(reordered, reorderedGraphs);
  for (const phaseId of [2, 3]) {
    const expected = resolveThermalStateFromTable(table, id, 34_200, phaseId, fractions(phaseId));
    assert.deepEqual(resolveThermalStateFromTable(reordered, id, 34_200, phaseId, fractions(phaseId)), expected);
    near(graphState(34_200, phaseId, fractions(phaseId), reorderedGraphs, reorderedResponses).temperatureK,
      expected.temperatureK, 4e-5);
  }
});

const invalid = [
  { name: 'missing explicit phase', phaseId: undefined, onehot: undefined, energy: 34_200 },
  { name: 'wrong solid branch', phaseId: 1, onehot: [1, 0, 0, 0], energy: 34_200 },
  { name: 'fractional phase id', phaseId: 2.9, onehot: fractions(3), energy: 34_200 },
  { name: 'mixed carrier', phaseId: 3, onehot: [0, 0.5, 0.5, 0], energy: 34_200 },
  { name: 'near-onehot is not exact', phaseId: 3, onehot: [0, 1e-8, 1 - 1e-8, 0], energy: 34_200 },
  { name: 'opposite onehot', phaseId: 3, onehot: fractions(2), energy: 34_200 },
  { name: 'missing fractions', phaseId: 3, onehot: undefined, energy: 34_200 },
  { name: 'gas below its domain but inside liquid domain', phaseId: 3, onehot: fractions(3), energy: -300_000 },
  { name: 'liquid above its domain but inside gas domain', phaseId: 2, onehot: fractions(2), energy: 600_000 },
  { name: 'nonfinite U', phaseId: 3, onehot: fractions(3), energy: NaN }
];
for (const entry of invalid) {
  test(`${entry.name}: every explicit selector fails closed, without legacy fallback`, () => {
    const { phaseId, onehot, energy } = entry;
    assert.equal(resolveThermalStateFromTable(table, id, energy, phaseId, onehot).status, 255);
    assert.equal(resolveThermalPhaseResponseFromTable(responses, id, energy, phaseId, onehot).status, 255);
    const graph = graphState(energy, phaseId, onehot);
    assert.equal(graph.status, 255);
    assert.equal(graph.graphExecution, null);
    assert.equal(resolveThermalConductivityFromTable(table, id, energy, phaseId, onehot).ready, false);
    assert.equal(resolveThermalCarrierTemperatureSlopeFromTable(table, id, energy, phaseId, onehot), 0);
    assert.equal(resolveThermalCarrierEnergyDomainFromTable(table, id, energy, phaseId, onehot).ready, false);
    assert.equal(resolveThermalCarrierReachableEnergyDomainFromTable(table, id, energy, phaseId, onehot).ready, false);
    assert.equal(resolveThermalCarrierEnergyDomainForTemperatureRangeFromTable(
      table, id, energy, 270, 330, phaseId, onehot).ready, false);
  });
}

test('malformed or duplicate explicit rows cannot manufacture a ready phase response', () => {
  for (const mutate of [
    (rows) => { rows[14] = 2; rows[15] = 2; },
    (rows) => { rows[13] = 1; },
    (rows) => { rows[16] = rows[17]; },
    (rows) => { rows[22] = 255; }
  ]) {
    const segments = table.segments.slice();
    mutate(segments);
    assert.equal(resolveThermalStateFromTable({ ...table, segments }, id, 34_200, 3, fractions(3)).status, 255);
  }
});

test('actual CPU thermal preserves fresh cool vapor across two zero-heat steps and ignores stale cached T', () => {
  let state = packed();
  const source = state.state.slice();
  for (let cycle = 0; cycle < 2; cycle += 1) {
    const next = runSphThermalStepCpu({ sphParticleState: state, thermalMaterialTable: table,
      wallModel: 'adiabatic', conductionRate: 0, dtS: 0.001 });
    assert.deepEqual(next.state, source);
    assert.equal(next.thermo[1], 3);
    assert.equal(next.thermo[10], 1);
    assert.deepEqual(Array.from(next.thermo.slice(4, 8)), fractions(3));
    near(next.thermo[2], 278, 4e-5);
    state = { ...state, state: next.state, thermo: next.thermo };
  }
});

test('real wall pulse uses phase Cv: 3900 J/kg gives cool vapor one kelvin without rebasing phase', () => {
  const source = packed({ position: [0.25, 20, 20] });
  const before = source.state.slice();
  const out = runSphThermalStepCpu({ sphParticleState: source,
    thermalMaterialTable: withoutRadiation(table), // The 1 kg vapor parcel is a cube about 2.15 m on a side: a 40 m box in y
    // and z keeps it touching x-min only.
    wallTemperaturesK: { xMin: 298 },
    wallLayerM: 1, wallRate: 1, dtS: honestWallPulseDtS(source, withoutRadiation(table)),
    conductionRate: 0, boxDimsM: [4, 40, 40] });
  // Honest wall: Q = (k a^2 / L) * (298-278) K * dt = 3900 J by construction.
  near(out.wallHeatJ.xMin, 3900);
  near(out.state[7] - before[7], 3900);
  near(out.thermo[2], 279, 4e-5);
  assert.equal(out.thermo[1], 3);
  assert.equal(out.thermo[10], 1);
  assert.deepEqual(Array.from(out.thermo.slice(4, 8)), fractions(3));
  assert.deepEqual(source.state, before, 'thermal creates output, not in-place source mutation');
});

test('actual CPU thermal rejects a mixed branch and wrong-domain U even under finite wall heat', () => {
  for (const entry of [invalid[1], invalid[2], invalid[3], invalid[7], invalid[8]]) {
    const source = packed({ phaseId: entry.phaseId, phaseFractions: entry.onehot,
      energy: entry.energy, position: [0.25, 2, 2] });
    const out = runSphThermalStepCpu({ sphParticleState: source,
      thermalMaterialTable: withoutRadiation(table), wallTemperaturesK: { xMin: 350 },
      wallLayerM: 1, wallRate: 2600, dtS: 0.1, conductionRate: 0 });
    assert.deepEqual(out.state, source.state, entry.name);
    assert.equal(out.thermo[10], 255, entry.name);
    assert.equal(out.wallHeatJ.xMin, 0, entry.name);
  }
});

test('explicit enrollment refuses missing/copy models, unknown materials, and unrepresentable f32 bases', () => {
  for (const models of [null, { h2o: null }, { h2o: { ...model } }, { unknownMaterial: model }]) {
    assert.throws(() => buildSphThermalMaterialTable(properties, {
      condensableThermodynamicsByMaterial: models
    }), TypeError);
  }
  for (const overrides of [
    { liquidReferenceEnthalpyJPerKg: 1e20 },
    { liquidReferenceEnthalpyJPerKg: 1e12 },
    { liquidDensityKgPerM3: 1e40 },
    { minTemperatureK: 300, maxTemperatureK: 300 + 1e-6 }
  ]) {
    const preciseModel = createCondensableThermodynamics({ ...input, ...overrides });
    assert.throws(() => buildSphThermalMaterialTable(properties, {
      condensableThermodynamicsByMaterial: { h2o: preciseModel }
    }), /Unrepresentable f32 phase caloric domain or heat capacity/);
  }
});

test('small representable caloric domains use their actual positive span, not a legacy energy floor', () => {
  // Dyadic energies/Cv make the entire tiny interval exactly representable in
  // f32. This isolates the span-floor regression from endpoint quantization.
  const tinyCv = 2 ** -50;
  const tinyR = 2 ** -52;
  const tinyModel = createCondensableThermodynamics({ ...input,
    liquidReferenceEnthalpyJPerKg: 0, vaporizationReferenceEnthalpyJPerKg: 2 ** -40,
    liquidCpJPerKgK: tinyCv, vaporCpJPerKgK: tinyCv + tinyR,
    molarMassKgPerMol: 8.314462618 / tinyR, liquidDensityKgPerM3: 3000 / tinyR
  });
  const tinyTable = buildSphThermalMaterialTable(properties, {
    condensableThermodynamicsByMaterial: { h2o: tinyModel }
  });
  const tinyGraphs = buildSphThermalClosureGraphBuffers(tinyTable);
  const tinyResponses = buildSphThermalPhaseResponseTable(tinyTable, tinyGraphs);
  for (const phaseId of [2, 3]) {
    const energy = phaseId === 2 ? -tinyR : 2 ** -40 - 300 * tinyR;
    const state = resolveThermalStateFromTable(tinyTable, id, energy, phaseId, fractions(phaseId));
    assert.equal(state.status, 1);
    near(state.temperatureK, 300, 4e-5);
    near(graphState(energy, phaseId, fractions(phaseId), tinyGraphs, tinyResponses).temperatureK, 300, 4e-5);
    const slope = resolveThermalCarrierTemperatureSlopeFromTable(tinyTable, id, energy,
      phaseId, fractions(phaseId));
    near(slope * tinyCv, 1, 2e-7);
  }
});

test('reaction energy integration is explicitly cold-rejected for enrolled tables and responses', () => {
  const source = packed();
  const args = { sphParticleState: source,
    mlsMpmParticleState: { schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1, mechanics: new Float32Array(32) },
    reactionTable: buildSphReactionTable([]), thermalMaterialTable: table };
  assert.throws(() => runSphReactionStepCpu(args), /Phase-specific caloric reaction energy is not yet admitted/);
  assert.throws(() => runSphReactionStepCpu({ ...args,
    thermalMaterialTable: buildSphThermalMaterialTable(properties), thermalPhaseResponseTable: responses
  }), /Phase-specific caloric reaction energy is not yet admitted/);
});

test('explicit material graphs/responses must match the declared table before any GPU allocation', () => {
  let allocations = 0;
  const device = {
    createBuffer() { allocations += 1; throw new Error('must reject before allocation'); },
    queue: { writeBuffer() { throw new Error('must reject before upload'); } }
  };
  const legacyTable = buildSphThermalMaterialTable(properties);
  const legacyGraphs = buildSphThermalClosureGraphBuffers(legacyTable);
  const legacyResponses = buildSphThermalPhaseResponseTable(legacyTable, legacyGraphs);
  for (const wrongArtifacts of [
    { thermalClosureGraphSet: legacyGraphs },
    { thermalClosureGraphBank: legacyGraphs.graphBank },
    { thermalPhaseResponseTable: legacyResponses }
  ]) {
    assert.throws(() => uploadSphThermalResponseGraphBuffers(device, {
      thermalMaterialTable: table, ...wrongArtifacts
    }), TypeError);
    assert.equal(allocations, 0);
  }
  assert.throws(() => buildSphThermalMaterialTable({
    h2o: { ...properties.h2o, phases: [] }
  }, { condensableThermodynamicsByMaterial: { h2o: model } }), TypeError);
});
