// Phase D Core ULG Scientific Audit + Full 32-Node Universal Law Graph & 40-OOM Schroeder Simulation (SS) Integration Suite

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { defaultSimulationModuleRegistry } from '../src/runtime/simulationModuleRegistry.js';
import {
  UNIVERSAL_LAW_GRAPH_NODES,
  registerAllTopDownLawModules,
  resolveActiveUniversalLaws,
  validateUniversalLawGraphContracts
} from '../src/runtime/universalLawGraph.js';
import {
  createDynamicSchroederScaleAtlasRuntime
} from '../src/runtime/sph/schroederSpatialScaleAtlasRuntime.js';
import {
  deriveElectromagneticClosureWebGpu
} from '../src/runtime/material/electromagneticClosureWebGpu.js';
import {
  deriveCompoundBundleWebGpu
} from '../src/runtime/material/recursiveCompoundPipeline.js';
import {
  runCrossScaleScientificValidation
} from '../src/tools/scientificValidationFramework.js';

function makeSyntheticRadialGrid({ Z, rCoreBohr = 0.45, rValBohr = 3.2, nVal = 1 }) {
  const n = 220;
  const rMin = 0.01;
  const rMax = 14.0;
  const dx = Math.log(rMax / rMin) / (n - 1);
  const r = new Float64Array(n);
  const rho = new Float64Array(n);
  const nCore = Math.max(0, Z - nVal);
  for (let i = 0; i < n; i += 1) {
    const ri = rMin * Math.exp(i * dx);
    r[i] = ri;
    const coreTerm = nCore > 0 ? nCore * Math.exp(-2 * ri / rCoreBohr) / (Math.PI * (rCoreBohr ** 3)) : 0;
    const valTerm = nVal > 0 ? nVal * Math.exp(-2 * ri / rValBohr) / (Math.PI * (rValBohr ** 3)) : 0;
    rho[i] = coreTerm + valTerm;
  }
  return { r, rho, dx };
}

test('Phase D1: Core ULG EM Closure fixes metal core-only Larmor diamagnetism (Li/Na paramagnetic, Cu/Au diamagnetic) & diamond sp3 pairing (C/Si diamagnetic)', async () => {
  // Alkali metal Li (Z=3, 1s2 2s1): localized 1s2 core (~0.45 Bohr) + delocalized 2s1 conduction band!
  const li = await deriveElectromagneticClosureWebGpu(null, {
    Z: 3,
    atomResult: { radialGrid: makeSyntheticRadialGrid({ Z: 3, rCoreBohr: 0.42, rValBohr: 3.1, nVal: 1 }), orbitals: [] },
    bulkResult: { isMetal: true, crystalStructure: 'bcc', wignerSeitzRadiusBohr: 3.26, dosAtFermiStatesPerEvAtom: 0.48, bandGapEv: 0, debyeTemperatureK: 344 }
  });
  assert.equal(li.magneticPhase, 'paramagnetic', `Li metal must be Pauli paramagnetic (got ${li.magneticPhase}, chi=${li.magneticSusceptibilitySi})`);

  // Alkali metal Na (Z=11, [Ne] 3s1)
  const na = await deriveElectromagneticClosureWebGpu(null, {
    Z: 11,
    atomResult: { radialGrid: makeSyntheticRadialGrid({ Z: 11, rCoreBohr: 0.62, rValBohr: 3.6, nVal: 1 }), orbitals: [] },
    bulkResult: { isMetal: true, crystalStructure: 'bcc', wignerSeitzRadiusBohr: 3.93, dosAtFermiStatesPerEvAtom: 0.46, bandGapEv: 0, debyeTemperatureK: 158 }
  });
  assert.equal(na.magneticPhase, 'paramagnetic', `Na metal must be Pauli paramagnetic (got ${na.magneticPhase}, chi=${na.magneticSusceptibilitySi})`);

  // Noble metal Cu (Z=29, [Ar] 3d10 4s1): large filled 3d10 core dominates over small s-band DOS -> diamagnetic!
  const cu = await deriveElectromagneticClosureWebGpu(null, {
    Z: 29,
    atomResult: { radialGrid: makeSyntheticRadialGrid({ Z: 29, rCoreBohr: 1.05, rValBohr: 2.8, nVal: 1 }), orbitals: [] },
    bulkResult: { isMetal: true, crystalStructure: 'fcc', wignerSeitzRadiusBohr: 2.67, dosAtFermiStatesPerEvAtom: 0.28, bandGapEv: 0, debyeTemperatureK: 343 }
  });
  assert.equal(cu.magneticPhase, 'diamagnetic', `Cu filled 3d10 metal must stay diamagnetic (got ${cu.magneticPhase}, chi=${cu.magneticSusceptibilitySi})`);

  // Tetrahedral sp3 diamond Carbon (Z=6): atomic 2p2 pairs into closed-shell sigma covalent bonds -> diamagnetic!
  const cDia = await deriveElectromagneticClosureWebGpu(null, {
    Z: 6,
    atomResult: { radialGrid: makeSyntheticRadialGrid({ Z: 6, rCoreBohr: 0.35, rValBohr: 1.4, nVal: 4 }), orbitals: [] },
    bulkResult: { isMetal: false, crystalStructure: 'diamond', wignerSeitzRadiusBohr: 2.06, dosAtFermiStatesPerEvAtom: 0, bandGapEv: 5.47, debyeTemperatureK: 2230 }
  });
  assert.equal(cDia.magneticPhase, 'diamagnetic', `Diamond sp3 Carbon must be diamagnetic (got ${cDia.magneticPhase})`);

  // Molecular O2 (Z=8, vdw-fcc open-shell triplet) stays paramagnetic!
  const o2 = await deriveElectromagneticClosureWebGpu(null, {
    Z: 8,
    atomResult: { radialGrid: makeSyntheticRadialGrid({ Z: 8, rCoreBohr: 0.30, rValBohr: 1.1, nVal: 6 }), orbitals: [] },
    bulkResult: { isMetal: false, crystalStructure: 'vdw-fcc', wignerSeitzRadiusBohr: 3.1, dosAtFermiStatesPerEvAtom: 0, bandGapEv: 8.5, debyeTemperatureK: 90 }
  });
  assert.equal(o2.magneticPhase, 'paramagnetic', `Open-shell molecular O2 must remain paramagnetic (got ${o2.magneticPhase})`);
});

test('Phase D2: Core ULG Quantum Statistical Mechanics Compound C_p replaces classical 3NR Dulong-Petit (Debye solid freeze-out + Einstein molecular fluid)', async () => {
  const co2 = await deriveCompoundBundleWebGpu(null, 'CO2', { temperatureK: 300, runLiveMd: false });
  const cpCo2 = co2.bundle.thermodynamic.heatCapacityCpJPerKgK;
  assert.ok(cpCo2 > 650 && cpCo2 < 1150,
    `Quantum CO2 gas C_p must lie near NIST 846 J/(kg*K), not classical 1700 (got ${cpCo2})`);

  const h2o = await deriveCompoundBundleWebGpu(null, 'H2O', { temperatureK: 300, runLiveMd: false });
  const cpH2o = h2o.bundle.thermodynamic.heatCapacityCpJPerKgK;
  assert.ok(cpH2o > 3400 && cpH2o < 4900,
    `H-bonded liquid H2O C_p must lie near NIST 4184 J/(kg*K) (got ${cpH2o})`);

  const ch4 = await deriveCompoundBundleWebGpu(null, 'CH4', { temperatureK: 300, runLiveMd: false });
  const cpCh4 = ch4.bundle.thermodynamic.heatCapacityCpJPerKgK;
  assert.ok(cpCh4 > 1900 && cpCh4 < 2600,
    `Quantum CH4 gas C_p at 300 K must lie near NIST 2226 J/(kg*K), not classical 7780 (got ${cpCh4})`);

  const al2o3 = await deriveCompoundBundleWebGpu(null, 'Al2O3', { temperatureK: 300, runLiveMd: false });
  const cpAl2o3 = al2o3.bundle.thermodynamic.heatCapacityCpJPerKgK;
  assert.ok(cpAl2o3 > 450 && cpAl2o3 < 950,
    `Debye quantum-frozen Al2O3 C_p must drop well below classical 1223 toward NIST 775 J/(kg*K) (got ${cpAl2o3})`);
});

test('Phase D3: Complete 32-node Universal Law Graph passes SS contracts with 0 errors/debt & registers all 27 modules on SimulationModuleRegistry', () => {
  const check = validateUniversalLawGraphContracts();
  assert.equal(check.valid, true, `Law Graph contract violations: ${[...check.errors, ...check.debt].join(', ')}`);
  assert.equal(check.nodeCount, 32);
  assert.equal(check.errors.length, 0);
  assert.equal(check.debt.length, 0);

  const newIds = [
    'emergent-3d-mhd-dynamo',
    'stellar-mls-mpm-fusion',
    'surface-tectonics-erosion',
    'surface-ocean-waves',
    'surface-deformation-mpm',
    'planetary-xenobiology-ecology',
    'surface-flora-placement'
  ];
  for (const id of newIds) {
    assert.ok(UNIVERSAL_LAW_GRAPH_NODES.some((n) => n.id === id), `Missing Universal Law Graph node: ${id}`);
  }

  const registered = registerAllTopDownLawModules(defaultSimulationModuleRegistry);
  assert.ok(registered.length >= 27, `Expected >= 27 registered simulation modules (got ${registered.length})`);
  for (const id of newIds) {
    assert.ok(defaultSimulationModuleRegistry.hasModule(`${id}@1`), `Module ${id}@1 must be registered on defaultSimulationModuleRegistry`);
  }

  // Dormant-zero vs Active-state verification:
  const sterileMoon = resolveActiveUniversalLaws({
    surfaceViewActive: true,
    hasSolidCrust: true,
    surfacePressurePa: 0,
    pressurePa: 0,
    tempK: 250,
    hasLiquidOcean: false,
    biosphereViability: 0,
    dynamoSeedB0: 0
  });
  assert.ok(sterileMoon.active.some((a) => a.id === 'surface-tectonics-erosion'));
  assert.ok(!sterileMoon.active.some((a) => a.id === 'surface-ocean-waves'));
  assert.ok(!sterileMoon.active.some((a) => a.id === 'surface-flora-placement'));
  assert.ok(!sterileMoon.active.some((a) => a.id === 'planetary-xenobiology-ecology'));
  assert.ok(!sterileMoon.active.some((a) => a.id === 'emergent-3d-mhd-dynamo'));

  const livingEarth = resolveActiveUniversalLaws({
    surfaceViewActive: true,
    hasSolidCrust: true,
    surfacePressurePa: 101325,
    pressurePa: 101325,
    tempK: 288,
    hasLiquidOcean: true,
    biosphereViability: 0.92,
    boulderCount: 64
  });
  for (const req of ['surface-tectonics-erosion', 'surface-ocean-waves', 'surface-deformation-mpm', 'planetary-xenobiology-ecology', 'surface-flora-placement']) {
    assert.ok(livingEarth.active.some((a) => a.id === req), `Living Earth surface must activate ${req}`);
  }
});

test('Phase D4: 40-OOM Schroeder Scale Atlas runtime integrates universes.html L0..L7 with double-float origin rebasing & exact conservation', async () => {
  const ss = createDynamicSchroederScaleAtlasRuntime({
    referenceSpacingM: 1.0,
    rootGlobalBaseLevel: 82,
    rootLocalMinLevel: 0,
    rootLocalMaxLevel: 2,
    rootLabel: 'L0-cosmic-web'
  });
  const c1 = ss.ensureChartForScaleLevel({ targetGlobalLevel: 69, parentChartId: 0, originInParentUnits: [0.5, -0.2, 0.3], label: 'L1-galactic-halo' });
  const c2 = ss.ensureChartForScaleLevel({ targetGlobalLevel: 42, parentChartId: c1.chartId, originInParentUnits: [4.8, 0.04, 2.1], label: 'L2-star-system' });
  const c4 = ss.ensureChartForScaleLevel({ targetGlobalLevel: 23, parentChartId: c2.chartId, originInParentUnits: [1.0, 0.0, 0.0], label: 'L4-planetary-world' });
  const cS = ss.ensureChartForScaleLevel({ targetGlobalLevel: 4, parentChartId: c4.chartId, originInParentUnits: [0.7, 0.5, 0.5], label: 'L4-planetary-surface' });
  const c7 = ss.ensureChartForScaleLevel({ targetGlobalLevel: -49, parentChartId: cS.chartId, originInParentUnits: [0.0, 0.0, 0.0], label: 'L7-atomic-nucleus' });
  const snap = ss.snapshotAtlas();
  assert.ok(snap.ordersOfMagnitude >= 39.4, `Expected >= 39.4 OOM span across L0..L7 (got ${snap.ordersOfMagnitude})`);
  assert.equal(snap.chartCount, 6);

  const up = ss.migrateParticleBetweenCharts({
    sourceChartId: c7.chartId,
    targetChartId: 0,
    posLocal: [0.25, 0.5, -0.75],
    massKg: 1.6726219e-27,
    linearMomentumKgMPerS: [2e-20, -1e-20, 3e-20],
    energyJ: 1.4e-12
  });
  const back = ss.migrateParticleBetweenCharts({
    sourceChartId: 0,
    targetChartId: c4.chartId,
    posLocal: up.posLocalHi,
    posLocalLo: up.posLocalLo,
    massKg: up.massKg,
    linearMomentumKgMPerS: up.linearMomentumKgMPerS,
    angularMomentumKgM2PerS: up.angularMomentumKgM2PerS,
    energyJ: up.energyJ
  });
  assert.equal(up.hops, 5);
  assert.equal(back.hops, 3);
  assert.equal(back.massKg, 1.6726219e-27);
  assert.equal(back.energyJ, 1.4e-12);

  // Verify live wiring inside ulgUniversesPhysics.js and ulgUniversesDemo.js
  const [physSrc, demoSrc] = await Promise.all([
    readFile(new URL('../src/demos/ulgUniversesPhysics.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/demos/ulgUniversesDemo.js', import.meta.url), 'utf8')
  ]);
  assert.ok(physSrc.includes('createDynamicSchroederScaleAtlasRuntime'), 'ulgUniversesPhysics.js must instantiate live 40-OOM Schroeder Scale Atlas runtime');
  assert.ok(physSrc.includes('syncSchroederScaleChart'), 'ulgUniversesPhysics.js must expose syncSchroederScaleChart');
  assert.ok(demoSrc.includes('schroederAtlas:') && demoSrc.includes('activeUniversalLaws:'), 'ulgUniversesDemo.js must expose schroederAtlas & activeUniversalLaws telemetry');

  // Verify 10-domain offline Scientific Validation Framework runs cleanly with 100% pass on Domains 8, 9, 10!
  const report = await runCrossScaleScientificValidation({ repoRoot: process.cwd() });
  assert.equal(report.domains.length, 10);
  for (const id of ['relativisticRadiativeTidal', 'xenobiologyAstrobiology', 'lawGraphAndSchroederSs']) {
    const d = report.domains.find((x) => x.domainId === id);
    assert.ok(d && d.evaluated >= 6 && d.agrees === d.evaluated, `Domain ${id} failed: ${d?.agrees}/${d?.evaluated}`);
  }
});
