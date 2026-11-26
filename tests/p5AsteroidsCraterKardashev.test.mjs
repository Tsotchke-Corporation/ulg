// Host Unit & Physics Invariant Tests for P5:
//   - Sparse Crater Tile Persistence Store (`surfaceCraterTileStore.js`)
//   - Visitable Asteroids & Comets in Sol & Procedural Systems (`solarSystemNBodyGpu.js`, `causalNebularSystemGenerator.js`, `planetarySurfaceVehiclesGpu.js`)
//   - Physical Gravitational+Cohesive Binding Energy & High-Power Antimatter (`ufoWeaponsAndPhysicsGpu.js`)
//   - Closed-Form Logistic Kardashev II-III Von Neumann Fleet, Dyson Optical Depth & Colony Wavefront (`ufoMultiplayerMesh.js`)

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_PERSISTED_CRATER_STAMPS,
  buildCraterTileKey,
  createSurfaceCraterTileStore,
  normalizeCraterStamp
} from '../src/runtime/astrophysics/surfaceCraterTileStore.js';
import { REAL_SOLAR_SYSTEM_CATALOG } from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';
import {
  deriveStarSystemFromGalacticLocation,
  synthesizeNebularPlanetarySystem
} from '../src/runtime/astrophysics/causalNebularSystemGenerator.js';
import { evaluateCosmicEpochState } from '../src/runtime/astrophysics/cosmicEpochState.js';
import {
  computeAntimatterMassRateKgS,
  computeBodyBindingEnergyJ,
  evaluateAntimatterAnnihilation
} from '../src/runtime/astrophysics/ufoWeaponsAndPhysicsGpu.js';
import {
  advanceLogisticPopulation,
  computeDysonOpticalDepth,
  createKardashevProgressionState
} from '../src/runtime/astrophysics/ufoMultiplayerMesh.js';
import { deriveSurfaceEnvironmentState } from '../src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js';

test('P5 Sparse Crater Tile Store: key formatting, normalization, round-trip persistence & 512-stamp cap', async () => {
  const store = createSurfaceCraterTileStore({ backend: 'memory' });
  const key = buildCraterTileKey({ universeSeed: 20261125, systemId: 'sol', bodyId: 'mars' });
  assert.ok(key.includes('20261125') && key.includes('mars'));

  const norm = normalizeCraterStamp({ kind: 3, x: 42.5, z: -18.2, radiusM: 18, depthM: 6.4, tempK: 4200, melt: 0.9, char: 1.0 });
  assert.equal(norm.kind, 3);
  assert.equal(norm.x, 42.5);

  const many = Array.from({ length: 620 }, (_, i) => ({ kind: 1, x: i - 300, z: i * 0.5, radiusM: 12, depthM: 4 }));
  await store.saveTile(key, many);
  const loaded = await store.loadTile(key);
  assert.ok(Array.isArray(loaded));
  assert.equal(loaded.length, MAX_PERSISTED_CRATER_STAMPS, 'Persisted stamps must cap cleanly at 512');
  assert.equal(loaded[loaded.length - 1].x, 319, 'Most recent stamps must be retained');

  await store.deleteTile(key);
  const afterDel = await store.loadTile(key);
  assert.deepEqual(afterDel, []);
});

test('P5 Visitable Asteroids & Comets: Sol catalog + procedural systems + micro-gravity / comet physics', () => {
  const ids = new Set(REAL_SOLAR_SYSTEM_CATALOG.map((b) => b.id));
  for (const required of ['ceres', 'vesta', 'psyche', 'bennu', 'halley']) {
    assert.ok(ids.has(required), `Sol catalog must contain visitable minor body "${required}"`);
  }
  const halley = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'halley');
  const psyche = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'psyche');
  const bennu = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'bennu');
  assert.equal(halley.isComet, true);
  assert.equal(psyche.isMetallicAsteroid, true);
  assert.equal(bennu.isMinorBody, true);

  const envHalley = deriveSurfaceEnvironmentState(halley, { planetaryMode: 'standard' });
  assert.equal(envHalley.isComet, true);
  assert.equal(envHalley.isMinorBody, true);
  assert.equal(envHalley.pressurePa, 0);
  assert.ok(envHalley.gravityMS2 > 0 && envHalley.gravityMS2 < 0.15, `Comet gravity must be micro-g (got ${envHalley.gravityMS2})`);

  const envPsyche = deriveSurfaceEnvironmentState(psyche, { planetaryMode: 'standard' });
  assert.equal(envPsyche.isMetallicAsteroid, true);
  assert.equal(envPsyche.pressurePa, 0);

  // Procedural star system must also synthesize a visitable belt asteroid and periodic comet!
  const epoch = evaluateCosmicEpochState({ redshiftZ: 0, localSystemAgeGyr: 4.6, localStarMassSolar: 1.0 });
  const starSys = deriveStarSystemFromGalacticLocation({
    cosmicEpoch: epoch,
    galaxyEnv: { metallicityFeH: 0.0, gasFraction: 0.14, tidalShear: 1.0 },
    starPosGal: [5.2, 0.02, 1.8],
    popTag: 1,
    starIndex: 77,
    seed: 123456
  });
  const proc = synthesizeNebularPlanetarySystem(starSys, { seedOverride: 123456 });
  assert.ok(proc.catalog.some((b) => b.isMinorBody && !b.isComet), 'Procedural star system must include a visitable asteroid');
  assert.ok(proc.catalog.some((b) => b.isComet), 'Procedural star system must include a visitable comet');
});

test('P5 Antimatter Annihilation & Gravitational+Cohesive Binding Energy Scaling', () => {
  const bennu = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'bennu');
  const earth = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'earth');
  const uBennu = computeBodyBindingEnergyJ(bennu);
  const uEarth = computeBodyBindingEnergyJ(earth);
  assert.ok(uBennu > 1e10 && uBennu < 1e20, `Bennu binding energy should be asteroid-scale (got ${uBennu})`);
  assert.ok(uEarth > 1e31 && uEarth < 1e33, `Earth gravitational binding energy should be ~2.2e32 J (got ${uEarth})`);
  assert.ok(uEarth > uBennu * 1e12);

  // Exact m_dot = P / (2 c^2)
  const pTest = 1e22;
  const mDot = computeAntimatterMassRateKgS(pTest);
  const c2 = 299792458 * 299792458;
  assert.ok(Math.abs(mDot * 2 * c2 - pTest) / pTest < 1e-10, 'Antimatter mass rate must satisfy P = 2 m_dot c^2');

  const am = evaluateAntimatterAnnihilation({ powerW: 1e24, dt: 0.5 });
  assert.ok(am.coupledEnergyJ > 1e23, `Coupled energy at 1 YW over 0.5s should exceed 1e23 J (got ${am.coupledEnergyJ})`);
  assert.ok(am.reactionOutcome.includes('YW'), `Expected YW label for 1e24 W (got ${am.reactionOutcome})`);
});

test('P5 Kardashev II-III Closed-Form Logistic Growth, Dyson Optical Depth & Colony Wavefront', () => {
  // Analytic logistic check: advanceLogisticPopulation(N, K, ratePerSec, dtSec)
  const n1 = advanceLogisticPopulation(10, 1e12, 0.05, 200);
  assert.ok(n1 > 1e4 && n1 < 1e12, `Expected 10 -> ~2.2e5 (got ${n1})`);
  const nSat = advanceLogisticPopulation(1e11, 1e12, 0.2, 1000);
  assert.ok(nSat <= 1e12 && nSat > 9.9e11);

  const { tauDyson: tauMid } = computeDysonOpticalDepth(1e10);
  const { tauDyson: tauHi } = computeDysonOpticalDepth(1.5e11);
  assert.ok(tauMid > 0 && tauHi > tauMid && tauHi < 5.0, `Expected 0 < tauMid < tauHi (got ${tauMid}, ${tauHi})`);

  const k = createKardashevProgressionState();
  k.addHarvest({ silicates: 1e6, metals: 1e6, volatiles: 5e5, exotics: 1e5 });
  const pr = k.deployVonNeumannProbe({ bodyId: 'psyche' });
  assert.ok(pr);

  // Advance logistic replication across many doubling intervals
  for (let i = 0; i < 40; i += 1) {
    k.step(0.5, { growthTimeMul: 40 });
  }
  assert.ok(k.state.totalProbeCount > 1e6, `Logistic fleet must exceed 10^6 collectors (got ${k.state.totalProbeCount})`);
  assert.ok(k.state.probes.length <= 48, `Visual 3D probes must stay capped <= 48 (got ${k.state.probes.length})`);
  assert.ok(k.state.dysonTau > 0.05, `Dyson optical depth tau must grow > 0.05 (got ${k.state.dysonTau})`);
  assert.ok(k.state.kardashevIndex > 1.8, `Kardashev index must advance into Type II+ (got ${k.state.kardashevIndex})`);
  assert.ok(k.state.colonyLinks.length >= 1, `Interstellar colony wavefront links must spawn (got ${k.state.colonyLinks.length})`);
  assert.ok(k.state.maxPowerW >= 1e18, `Max reactor power must unlock >= 1e18 W as Kardashev advances (got ${k.state.maxPowerW})`);
});
