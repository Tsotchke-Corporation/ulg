import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { REAL_SOLAR_SYSTEM_CATALOG } from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';
import {
  PLANETARY_SURFACE_LAW_ADAPTER,
  deriveSurfaceEnvironmentState,
  evaluatePlanetarySurfaceActivation,
  evaluatePlanetaryTerrainHeight,
  evaluatePlanetaryTerrainNormal
} from '../src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js';
import {
  UNIVERSAL_LAW_GRAPH_NODES,
  resolveActiveUniversalLaws,
  validateUniversalLawGraphContracts
} from '../src/runtime/universalLawGraph.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('planetary-surface-vehicles@1 obeys ULG Law Adapter Contract, Star Spec zero-hack rules, and zero @workgroup_size(1)', () => {
  const check = validateUniversalLawGraphContracts();
  assert.equal(check.valid, true, `Contract errors: ${check.errors.join(', ')} debt: ${check.debt.join(', ')}`);
  assert.equal(check.debt.length, 0);
  assert.equal(UNIVERSAL_LAW_GRAPH_NODES.length, 32);
  assert.equal(PLANETARY_SURFACE_LAW_ADAPTER.id, 'planetary-surface-vehicles');

  const src = fs.readFileSync(path.join(ROOT, 'src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js'), 'utf8');
  assert.equal(src.includes('@workgroup_size(1)'), false, 'Must add 0 serial @workgroup_size(1) compute kernels');
  assert.equal(src.includes('phase_mode'), false, 'Must contain 0 discrete phase_mode hacks');
  assert.equal(src.includes("id === 'mars'"), false, 'Must not branch on planet names');
  assert.equal(src.includes("id === 'earth'"), false, 'Must not branch on planet names');
  assert.equal(src.includes("id === 'moon'"), false, 'Must not branch on planet names');
});

test('General-law surface environments derive exact gravity, atmosphere density, vacuum null-lift, and sky optics', () => {
  const byId = (id) => REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === id);

  // 1. Airless Moon: low g (~1.62 m/s^2), strict 0 vacuum density -> EXACTLY 0 N drone aerodynamic lift!
  const moon = deriveSurfaceEnvironmentState(byId('moon'));
  assert.ok(moon.gravityMS2 > 1.4 && moon.gravityMS2 < 1.9, `Moon g expected ~1.62 (got ${moon.gravityMS2})`);
  assert.equal(moon.rhoAtmKgM3, 0, 'Airless body must have exact 0 atmospheric density');
  assert.equal(moon.maxAeroLiftN, 0, 'Vacuum must produce EXACTLY 0 N aerodynamic rotor lift');
  assert.equal(moon.droneFlightCapable, false, 'Atmospheric drone MUST NOT fly in vacuum');
  assert.equal(moon.baseWindMS, 0, 'Airless body must have 0 atmospheric wind');
  assert.ok(moon.craterStrength > 0.85, 'Airless body must preserve crisp craters');
  assert.ok(moon.skyOpticalDepth < 0.03, 'Airless sky must reveal deep vacuum stars');

  // 2. Mars: g ≈ 3.72 m/s^2, thin 650 Pa CO2 atmosphere -> Ingenuity-class drone lifts cleanly!
  const mars = deriveSurfaceEnvironmentState(byId('mars'));
  assert.ok(mars.gravityMS2 > 3.4 && mars.gravityMS2 < 4.1, `Mars g expected ~3.72 (got ${mars.gravityMS2})`);
  assert.ok(mars.rhoAtmKgM3 > 0.01 && mars.rhoAtmKgM3 < 0.03, `Mars rho expected ~0.016 kg/m^3 (got ${mars.rhoAtmKgM3})`);
  assert.equal(mars.droneFlightCapable, true, 'Thin Martian CO2 must support coaxial rotorcraft flight');
  assert.ok(mars.maxAeroLiftN > mars.droneWeightN * 1.1, 'Mars drone max lift must exceed Martian weight');
  assert.equal(mars.hasLiquidOcean, false);
  assert.ok(mars.skyHorizonRgb[0] > mars.skyHorizonRgb[2], 'Suspended Martian dust must scatter butterscotch-warm sky');

  // 3. Earth: g ≈ 9.81 m/s^2, 1-bar atmosphere, Rayleigh blue sky, liquid ocean, abundant drone lift margin!
  const earth = deriveSurfaceEnvironmentState(byId('earth'));
  assert.ok(earth.gravityMS2 > 9.5 && earth.gravityMS2 < 10.1, `Earth g expected ~9.81 (got ${earth.gravityMS2})`);
  assert.ok(earth.rhoAtmKgM3 > 1.0 && earth.rhoAtmKgM3 < 1.5, `Earth rho expected ~1.22 kg/m^3 (got ${earth.rhoAtmKgM3})`);
  assert.equal(earth.hasLiquidOcean, true, 'Temperate volatile-rich 1-bar world must support liquid ocean');
  assert.equal(earth.droneFlightCapable, true);
  assert.ok(earth.skyHorizonRgb[2] > earth.skyHorizonRgb[0], 'Clean Earth atmosphere must scatter Rayleigh blue sky');

  // 4. Titan: low g (~1.35 m/s^2) + dense cryogenic N2 atmosphere (> 4 kg/m^3) -> massive Dragonfly T/W!
  const titan = deriveSurfaceEnvironmentState(byId('titan'));
  assert.ok(titan.gravityMS2 > 1.1 && titan.gravityMS2 < 1.6);
  assert.ok(titan.rhoAtmKgM3 > 4.0, `Titan cryogenic N2 density expected > 4 kg/m^3 (got ${titan.rhoAtmKgM3})`);
  assert.equal(titan.droneFlightCapable, true);
  assert.ok(titan.droneThrustToWeight > 100, `Titan Dragonfly thrust-to-weight must be huge (got ${titan.droneThrustToWeight})`);

  // 5. Jupiter (Gas Giant envelope, kind === 2): no solid crust, auto-drone cloud deck!
  const jup = deriveSurfaceEnvironmentState(byId('jupiter'));
  assert.equal(jup.hasSolidCrust, false);
  assert.equal(jup.droneFlightCapable, true);

  // 6. Hadean Magma Ocean mode
  const magma = deriveSurfaceEnvironmentState(byId('earth'), { planetaryMode: 'magma-ocean' });
  assert.equal(magma.isMagmaOcean, true);
  assert.equal(magma.hasLiquidOcean, false);
  assert.ok(magma.skyHorizonRgb[0] > 0.6);
});

test('Deterministic planetary terrain heightfield & normals + dynamic Universal Law Graph activation', () => {
  const marsEnv = deriveSurfaceEnvironmentState(REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'mars'), { seed: 4242 });
  const hA = evaluatePlanetaryTerrainHeight(24.5, -18.2, marsEnv);
  const hB = evaluatePlanetaryTerrainHeight(24.5, -18.2, marsEnv);
  assert.equal(hA, hB);
  assert.ok(Number.isFinite(hA));

  const n = evaluatePlanetaryTerrainNormal(24.5, -18.2, marsEnv);
  const nLen = Math.hypot(n[0], n[1], n[2]);
  assert.ok(Math.abs(nLen - 1.0) < 1e-5, `Terrain normal must be unit length (got ${nLen})`);
  assert.ok(n[1] > 0.2, 'Terrain normal must point upward');

  // Dynamic activation: dormant in orbital view, active in surface view
  assert.equal(evaluatePlanetarySurfaceActivation({ surfaceViewActive: false, bodyRadiusM: 3.39e6, viewSpanM: 1e7 }).active, false);
  assert.equal(evaluatePlanetarySurfaceActivation({ surfaceViewActive: true, bodyRadiusM: 3.39e6, surfacePressurePa: 650 }).active, true);
  assert.equal(evaluatePlanetarySurfaceActivation({ surfaceViewActive: true, bodyRadiusM: 1.74e6, surfacePressurePa: 0 }).aerodynamicFlightPossible, false);

  const surfGraph = resolveActiveUniversalLaws({ surfaceViewActive: true, bodyRadiusM: 3.39e6, surfacePressurePa: 650 });
  assert.equal(surfGraph.active.some((l) => l.id === 'planetary-surface-vehicles'), true);
  const spaceGraph = resolveActiveUniversalLaws({ surfaceViewActive: false, comovingBoxMpc: 200, omegaM: 0.315, viewSpanM: 1e25 });
  assert.equal(spaceGraph.active.some((l) => l.id === 'planetary-surface-vehicles'), false);
});
