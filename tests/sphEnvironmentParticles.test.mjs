import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSphEnvironmentParticles } from '../src/runtime/sphEnvironmentParticles.js';
import { createSphRoomAirInitialization } from '../src/runtime/sphEnvironmentInitialization.js';
import { withRoomAirCaloricReference } from '../src/runtime/material/roomAirCaloricReference.js';
import { createReferenceAnchoredMaterialClosure } from '../src/runtime/material/materialDerivation.js';
import { dyadicFromNumber } from '../src/runtime/material/exactDyadicInventory.js';
import { buildSphPhaseDemoState, gasPressureSummary } from '../src/runtime/sphPhaseDemo.js';
import { buildSphGpuParticleBuffers, buildMlsMpmGpuParticleBuffers } from '../src/runtime/sph/sphGpuBuffers.js';
import { resolveSphExactParticleMassSeed } from '../src/runtime/sph/sphExactMassParticleSeed.js';
import { packSphPhaseViewStateForTransport, unpackSphPhaseViewStateFromTransport } from '../src/runtime/sphPhaseViewStateTransport.js';
import { createSphPhaseViewState } from '../src/runtime/sphPhaseViewState.js';
import { createPhaseCaloricThermodynamics, evaluateCondensableThermodynamics } from '../src/runtime/material/condensableThermodynamics.js';
import { buildSphThermalMaterialTable, buildSphThermalClosureGraphBuffers, buildSphThermalPhaseResponseTable,
  resolveThermalResponseGraphArtifacts } from '../src/runtime/sph/sphThermalGpuKernel.js';
import { createSphStaticTableCacheUpdate, rehydrateSphStaticTableBundle } from '../src/runtime/sph/sphColdStartCache.js';
import { thermalMaterialTablesExactlyEqual } from '../src/runtime/sph/sphStaticTableInputs.js';
import { sphEnvironmentOptionsFromControls, SPH_ENVIRONMENT_CONTROL_DEFAULTS } from '../src/runtime/sphEnvironmentControls.js';

const properties = Object.fromEntries(['h2o', 'n2', 'o2', 'ar', 'co2'].map(key => [key,
  withRoomAirCaloricReference(createReferenceAnchoredMaterialClosure(key), key).properties]));
const environment = createSphRoomAirInitialization();
const units = mass => {
  const { coefficient, exponent } = dyadicFromNumber(mass);
  return coefficient << BigInt(exponent + 1074);
};
const occupiedBoxes = [{ min: [0.25, 0, 0.25], max: [0.75, 0.5, 0.75] },
  { min: [0.5, 0.25, 0.25], max: [0.75, 0.75, 0.75] }];
const build = (extra = {}) => buildSphEnvironmentParticles({ environment, materialProperties: properties,
  boxDimensionsM: [1, 1, 1], occupiedBoxes, ...extra });

test('gas carriers partition physical free space and conserve each species exactly under grid refinement', () => {
  let previous;
  for (const cellsPerAxis of [1, 2, 3, 5]) {
    const result = build({ cellsPerAxis });
    assert.equal(result.inventory.freeVolumeM3, 1 - 0.125 - 0.0625 + 0.03125);
    const totals = result.inventory.gasSpecies.map(row => {
      const carriers = result.particles.filter(p => p.material === row.material);
      assert.equal(carriers.length, result.cells.length);
      const total = carriers.reduce((sum, p) => sum + (p.coldExactMassWords.reduceRight((n, w) => (n << 32n) | BigInt(w), 0n) << 925n), 0n);
      assert.equal(total, units(row.massKg));
      for (const p of carriers) {
        assert.equal(p.phaseCaloric.phaseId, 3);
        assert.equal(p.specificInternalEnergyJPerKg, row.specificInternalEnergyJPerKg);
        assert.deepEqual(p.v, [0, 0, 0]);
        assert.ok(!occupiedBoxes.some(box => p.x.every((v, i) => v > box.min[i] && v < box.max[i])));
      }
      return total;
    });
    if (previous) assert.deepEqual(totals, previous);
    previous = totals;
  }
});

test('graded seeding refines air only next to bodies and keeps every species total exact', () => {
  const coarse = build({ cellsPerAxis: 2 });
  const graded = build({ cellsPerAxis: 2, refineEdgeM: 0.0625 });
  assert.equal(graded.inventory.freeVolumeM3, coarse.inventory.freeVolumeM3);
  assert.ok(graded.cells.length > coarse.cells.length);
  const edge = (cell) => Math.max(...cell.max.map((v, i) => v - cell.min[i]));
  const distance = (cell, solid) => Math.hypot(...[0, 1, 2].map((i) => Math.max(0,
    cell.min[i] - solid.max[i], solid.min[i] - cell.max[i])));
  for (const cell of graded.cells) {
    const touching = occupiedBoxes.some((solid) => distance(cell, solid) <= 1e-12);
    // A cell that touches a body is at the refine edge (its subtractBox
    // pieces may be thinner on the cut axis, never coarser).
    if (touching) assert.ok(edge(cell) <= 0.0625 + 1e-12);
  }
  // Air farther than its own edge from every body stays coarser.
  assert.ok(graded.cells.some((cell) => edge(cell) > 0.0625 * 1.5));
  for (const row of graded.inventory.gasSpecies) {
    const total = graded.particles.filter(p => p.material === row.material).reduce((sum, p) => sum
      + (p.coldExactMassWords.reduceRight((n, w) => (n << 32n) | BigInt(w), 0n) << 925n), 0n);
    assert.equal(total, units(row.massKg));
  }
  assert.throws(() => build({ refineEdgeM: -1 }), /refineEdgeM/);
});

test('vacuum creates no gas; dry air retains its four actual chemical species', () => {
  assert.equal(build({ environment: createSphRoomAirInitialization({ mode: 'vacuum',
    totalPressurePa: 0, relativeHumidity: 0 }) }).particles.length, 0);
  assert.deepEqual([...new Set(build({ environment: createSphRoomAirInitialization({ relativeHumidity: 0 }) })
    .particles.map(p => p.material))], ['n2', 'o2', 'ar', 'co2']);
});

test('almost touching authored boundaries drop sub-f32 slivers without changing exact species totals', () => {
  // 0.028 vs 0.028000000000000004 leaves a one-ulp (4e-18 m) gap: faces the
  // GPU's f32 positions cannot separate. It is a rounding sliver, not gas.
  const result = build({ boxDimensionsM: [0.14, 0.14, 0.14], occupiedBoxes: [
    { min: [0.056, 0, 0.056], max: [0.084, 0.028, 0.084] },
    { min: [0.0616, 0.028000000000000004, 0.0616], max: [0.0784, 0.0448, 0.0784] }
  ] });
  const resolutionM = 0.14 * 2 ** -23;
  assert.ok(result.cells.every(cell => cell.max.every((v, i) => v - cell.min[i] > resolutionM)));
  assert.ok(result.particles.every(p => p.massKg > 1e-12));
  for (const row of result.inventory.gasSpecies) {
    const total = result.particles.filter(p => p.material === row.material).reduce((sum, p) => sum
      + (p.coldExactMassWords.reduceRight((n, w) => (n << 32n) | BigInt(w), 0n) << 925n), 0n);
    assert.equal(total, units(row.massKg));
  }
});

test('water reference reproduces its NIST 20 C anchor and is an explicitly reduced model', () => {
  const model = createPhaseCaloricThermodynamics(properties.h2o.phaseCaloricModel);
  const state = evaluateCondensableThermodynamics(model, { temperatureK: 293.15, totalPressurePa: 2339 });
  assert.ok(Math.abs(state.equilibriumPressurePa - 2339) < 1e-10);
  assert.equal(state.liquidSpecificEnthalpyJPerKg, 83910);
  assert.equal(state.vaporizationEnthalpyJPerKg, 2453500);
  assert.equal(model.scientificValidation, false);
  assert.equal(properties.ar.phases[0].cpJPerKgK, 2.5 * 8.314462618 / properties.ar.molarMassKgPerMol);
});

test('cached mixed air calorics and iron Debye graphs retain their complete source segments', () => {
  const thermalMaterialTable = buildSphThermalMaterialTable({ ...properties,
    fe: createReferenceAnchoredMaterialClosure('fe').properties });
  const thermalClosureGraphSet = buildSphThermalClosureGraphBuffers(thermalMaterialTable);
  const thermalPhaseResponseTable = buildSphThermalPhaseResponseTable(thermalMaterialTable, thermalClosureGraphSet);
  const options = { generatorFingerprint: 'environment-test' };
  const update = createSphStaticTableCacheUpdate({ ...options,
    tableInputs: { thermalMaterialTable, thermalClosureGraphSet, thermalPhaseResponseTable } });
  const restored = rehydrateSphStaticTableBundle(update.cacheSnapshot, options);
  assert.equal(thermalMaterialTablesExactlyEqual(restored.thermalMaterialTable, thermalMaterialTable), true);
  assert.doesNotThrow(() => resolveThermalResponseGraphArtifacts(restored));
  delete restored.thermalMaterialTable.segmentMetadata;
  assert.equal(thermalMaterialTablesExactlyEqual(restored.thermalMaterialTable, thermalMaterialTable), false);
  assert.throws(() => resolveThermalResponseGraphArtifacts(restored), /Inconsistent phase-specific/);
});

test('serialized atmosphere controls change actual inventory and invalid controls remain rejected', () => {
  const controls = { ...SPH_ENVIRONMENT_CONTROL_DEFAULTS, environmentMode: 'air' };
  const compile = input => {
    const options = sphEnvironmentOptionsFromControls(Object.fromEntries(new URLSearchParams(input)));
    return build({ environment: options.environment, cellsPerAxis: options.environmentCellsPerAxis });
  };
  const base = compile(controls);
  const dry = compile({ ...controls, environmentHumidityPercent: '0' });
  assert.equal(dry.inventory.gasSpecies.some(row => row.material === 'h2o'), false);
  const pressurized = compile({ ...controls, environmentPressurePa: '150000' });
  assert.ok(pressurized.inventory.totalGasMassKg > base.inventory.totalGasMassKg);
  const warm = compile({ ...controls, environmentTemperatureK: '310' });
  assert.ok(warm.inventory.gasSpecies.every(row => row.temperatureK === 310));
  for (const bad of [{ environmentTemperatureK: '' }, { environmentHumidityPercent: '101' },
    { environmentPressurePa: '-1' }, { environmentCellsPerAxis: '1.5' }, { environmentMode: 'invalid' }]) {
    assert.throws(() => compile({ ...controls, ...bad }));
  }
});

// Exact-rational quantities are disabled (user, 2026-10-27). Room air declares
// no exact mass, so no stage can route into them.
for (const authoredBodies of [false, true]) test(`room air reaches original scene packers and the worker without exact-rational quantities (${authoredBodies ? 'bodies' : 'legacy'})`, () => {
  const demo = buildSphPhaseDemoState({ environment, dropParticleEdge: 2, baseParticleEdge: 2,
    ...(authoredBodies ? { initialBodies: [{ id: 'water', domainId: 1, material: 'h2o',
      sizeM: [1, 1, 1], centerM: [2.5, 0.5, 2.5], temperatureK: 293.15,
      particlesPerEdge: [2, 2, 2], velocityMPerS: [0, 0, 0] }] } : {}) });
  assert.ok(demo.counts.environmentGas > 0);
  const initialGas = demo.state.particles.filter(p => p.role === 'environment-gas' && p.massKg > 0);
  assert.equal(initialGas.length, demo.counts.environmentGas);
  assert.equal(Object.hasOwn(demo.state, 'exactMassInitialization'), false);
  for (const state of [demo.state, structuredClone(demo.state), JSON.parse(JSON.stringify(demo.state))]) {
    const opts = { materialProperties: demo.materialProperties, initialParticleSpacing: demo.initialParticleSpacing };
    const sph = buildSphGpuParticleBuffers(state, opts), mls = buildMlsMpmGpuParticleBuffers(state, opts);
    assert.equal(sph.phaseCaloricInitializationSignature, mls.phaseCaloricInitializationSignature);
    assert.equal(resolveSphExactParticleMassSeed(sph), null);
  }
  const summary = gasPressureSummary(demo);
  // Mixture parcels are the default (Owner Decision #11): dry air travels as
  // conserved mixture parcels carrying exact species composition alongside H2O.
  assert.equal(Object.hasOwn(summary.bySpecies, 'air'), true);
  assert.deepEqual(Object.keys(summary.bySpecies).sort(), ['air', 'h2o']);
  const speciesDemo = buildSphPhaseDemoState({ environment, environmentAirParcels: 'species',
    dropParticleEdge: 2, baseParticleEdge: 2,
    ...(authoredBodies ? { initialBodies: [{ id: 'water', domainId: 1, material: 'h2o',
      sizeM: [1, 1, 1], centerM: [2.5, 0.5, 2.5], temperatureK: 293.15,
      particlesPerEdge: [2, 2, 2], velocityMPerS: [0, 0, 0] }] } : {}) });
  const speciesSummary = gasPressureSummary(speciesDemo);
  assert.equal(Object.hasOwn(speciesSummary.bySpecies, 'air'), false);
  assert.deepEqual(Object.keys(speciesSummary.bySpecies).sort(), ['ar', 'co2', 'h2o', 'n2', 'o2']);
  const view = createSphPhaseViewState({ demo });
  const transfer = packSphPhaseViewStateForTransport(view);
  const restored = unpackSphPhaseViewStateFromTransport(structuredClone(transfer));
  assert.equal(resolveSphExactParticleMassSeed(restored.sphGpuParticleState), null);
  assert.equal(restored.sphGpuParticleState.particleCount, demo.state.particles.length);
});
