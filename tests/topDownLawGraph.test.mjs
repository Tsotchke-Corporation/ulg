import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createSimulationModuleRegistry } from '../src/runtime/simulationModuleRegistry.js';
import {
  FUNDAMENTAL_LAW_FAMILIES,
  UNIVERSAL_LAW_GRAPH_NODES,
  registerAllTopDownLawModules,
  resolveActiveUniversalLaws,
  validateUniversalLawGraphContracts
} from '../src/runtime/universalLawGraph.js';
import { buildNebularMhdInitialConditions } from '../src/runtime/astrophysics/nebularMhdCollapseGpu.js';
import {
  deriveFluidElectrodynamicsState,
  evaluateFluidElectrodynamicsActivation,
  evaluatePaschenBreakdownFieldVPerM,
  evaluatePlanetaryGeodynamo
} from '../src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js';
import {
  evaluateProtoplanetaryDiskActivation,
  evaluateProtoplanetaryTemperatureAndSnowLine
} from '../src/runtime/astrophysics/protoplanetaryDiskFormationGpu.js';
import {
  RIGID_BODY_STRIDE_FLOATS,
  buildParticleRigidBodiesSpec,
  createCompositeClusterParticles
} from '../src/runtime/sph/particleRigidDynamicsGpu.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('Universal Law Graph contracts validate cleanly with 0 errors, 0 private-grid debt, and 0 serial WG(1) kernels', () => {
  const check = validateUniversalLawGraphContracts();
  assert.equal(check.valid, true, `Law Graph contract errors: ${check.errors.join(', ')} debt: ${check.debt.join(', ')}`);
  assert.equal(check.debt.length, 0);
  assert.ok(check.nodeCount >= 9);

  // Register all top-down & particle-rigid modules on a fresh SimulationModuleRegistry
  const reg = createSimulationModuleRegistry();
  const registered = registerAllTopDownLawModules(reg);
  assert.ok(registered.length >= 10, `Expected >= 10 registered law modules, got ${registered.length}`);
  for (const key of [
    'nebular-mhd-collapse@1',
    'planetary-atmosphere-em@1',
    'protoplanetary-accretion@1',
    'particle-rigid-dynamics@1',
    'cosmological-baryon-radiation@1',
    'relativistic-compact-kerr-jet@1',
    'compact-magnetosphere-spindown@1',
    'relativistic-binary-gw-rprocess@1',
    'radiative-photoionization-winds@1',
    'tidal-roche-rheology-cryovolcanism@1',
    'planetary-surface-vehicles@1'
  ]) {
    assert.equal(reg.hasModule(key), true, `Module ${key} must be registered`);
  }

  // Star Spec static anti-shortcut & zero @workgroup_size(1) audit across all new law modules
  for (const rel of [
    'src/runtime/astrophysics/nebularMhdCollapseGpu.js',
    'src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js',
    'src/runtime/astrophysics/protoplanetaryDiskFormationGpu.js',
    'src/runtime/sph/particleRigidDynamicsGpu.js',
    'src/runtime/universalLawGraph.js'
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.equal(src.includes('@workgroup_size(1)'), false, `${rel} must add 0 @workgroup_size(1) kernels`);
    assert.equal(src.includes('phase_mode'), false, `${rel} must not contain discrete phase_mode hacks`);
    assert.equal(src.includes("id === 'earth'"), false, `${rel} must not branch on planet names`);
    assert.equal(src.includes("id === 'mars'"), false, `${rel} must not branch on planet names`);
    assert.equal(src.includes("id === 'jupiter'"), false, `${rel} must not branch on planet names`);
  }
});

test('Universal Law Graph dynamically activates ONLY laws whose physical state is present (zero planet-type hacks)', () => {
  // 1. Airless, non-magnetized rocky body -> atmosphere, triboelectricity, & magnetosphere MUST stay dormant!
  const airless = deriveFluidElectrodynamicsState({
    massKg: 7.34e22,
    radiusM: 1.737e6,
    surfacePressurePa: 0.0,
    eqTempK: 220,
    coreRadiusNorm: 0.15,
    coreConductivitySm: 0.0
  });
  assert.equal(airless.activation.fluidActive, false);
  assert.equal(airless.activation.triboelectricActive, false);
  assert.equal(airless.activation.magnetosphereActive, false);
  const airlessGraph = resolveActiveUniversalLaws({
    bodyMassKg: 7.34e22,
    bodyRadiusM: 1.737e6,
    surfacePressurePa: 0.0,
    volatileMassFrac: 0.0,
    particulateMassFrac: 0.0,
    dynamo: airless.dynamo
  });
  assert.equal(airlessGraph.active.some((l) => l.id === 'planetary-atmosphere-em'), false);
  assert.equal(airlessGraph.active.some((l) => l.id === 'planetary-interior-polytope'), true);

  // 2. Low-pressure dusty CO2 atmosphere (Mars-like physical inputs, zero planet name!) ->
  //    Paschen breakdown field is ~10x LOWER than 1-bar atmosphere, and aeolian dust triboelectricity activates!
  const eCrit1Bar = evaluatePaschenBreakdownFieldVPerM(101325);
  const eCritLowP = evaluatePaschenBreakdownFieldVPerM(650);
  assert.ok(eCritLowP < eCrit1Bar * 0.15, `Low-pressure Paschen threshold (${eCritLowP}) must be far below 1-bar (${eCrit1Bar})`);

  const dustyState = deriveFluidElectrodynamicsState({
    massKg: 6.42e23,
    radiusM: 3.39e6,
    surfacePressurePa: 650,
    eqTempK: 215,
    volatileMassFrac: 0.01,
    particulateMassFrac: 0.85
  });
  assert.equal(dustyState.activation.fluidActive, true);
  assert.equal(dustyState.activation.aeolianParticulateActive, true);
  assert.equal(dustyState.activation.triboelectricActive, true);

  // 3. Magnetized rotating nebula activates MHD + Gravity + EM + Hydro dynamically!
  const nebGraph = resolveActiveUniversalLaws({
    nebulaCloudMass: 20.0,
    magneticFieldStrength: 0.5,
    magneticReynolds: 500
  });
  assert.equal(nebGraph.active.some((l) => l.id === 'nebular-mhd-collapse'), true);
  assert.equal(nebGraph.activeFamilies.includes(FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM), true);
  assert.equal(nebGraph.active.some((l) => l.id === 'flrw-treepm-cosmology'), false);

  // 4. Protoplanetary snow line emerges purely from radiative equilibrium T(r) < T_sub!
  const inner = evaluateProtoplanetaryTemperatureAndSnowLine({ rAu: 0.9, starLuminositySolar: 1.0, snowLineTempK: 170 });
  const outer = evaluateProtoplanetaryTemperatureAndSnowLine({ rAu: 4.5, starLuminositySolar: 1.0, snowLineTempK: 170 });
  assert.equal(inner.isVolatileIcePhase, false);
  assert.equal(outer.isVolatileIcePhase, true);
  assert.ok(inner.snowLineAu > 2.4 && inner.snowLineAu < 3.1, `1 L_sun H2O snow line must sit near ~2.7 AU (got ${inner.snowLineAu})`);
  assert.equal(evaluateProtoplanetaryDiskActivation({ starMassSolar: 1.0, diskSolidMassEarth: 30 }).active, true);
  assert.equal(evaluateProtoplanetaryDiskActivation({ starMassSolar: 1.0, diskSolidMassEarth: 0 }).active, false);

  // 5. Geodynamo scales smoothly with rotation, core radius, & conductivity
  const strongDyn = evaluatePlanetaryGeodynamo({ radiusM: 6.371e6, rotationOmegaRadS: 7.29e-5, coreRadiusNorm: 0.55, coreConductivitySm: 1e6 });
  const weakDyn = evaluatePlanetaryGeodynamo({ radiusM: 3.39e6, rotationOmegaRadS: 7.09e-5, coreRadiusNorm: 0.15, coreConductivitySm: 1e4 });
  assert.ok(strongDyn.bEquatorialT > weakDyn.bEquatorialT * 50);
  assert.ok(UNIVERSAL_LAW_GRAPH_NODES.some((n) => n.id === 'particle-rigid-dynamics'));
});

test('buildNebularMhdInitialConditions and buildParticleRigidBodiesSpec satisfy exact mass, COM, principal inertia & determinism', () => {
  const nebA = buildNebularMhdInitialConditions({ gridN: 16, tracerCount: 256, seed: 99, initialB0: 0.5 });
  const nebB = buildNebularMhdInitialConditions({ gridN: 16, tracerCount: 256, seed: 99, initialB0: 0.5 });
  assert.deepEqual(nebA.fluid, nebB.fluid);
  assert.deepEqual(nebA.bfield, nebB.bfield);
  assert.equal(nebA.bfield[1], 0.5);

  // Composite particle-rigid body: check exact diagonalized principal inertia & COM alignment
  const cluster = createCompositeClusterParticles({ count: 10, bodyRadius: 0.6, particleRadius: 0.18, mass: 5.0, seed: 7 });
  const built = buildParticleRigidBodiesSpec([{
    position: [2.0, -1.0, 3.0],
    velocity: [1.5, -0.5, 0.25],
    angularVelocity: [0.4, 0.8, -0.2],
    mass: 5.0,
    particles: cluster
  }]);
  assert.equal(built.bodyCount, 1);
  assert.equal(built.particleCount, 10);
  const m = built.bodiesBufData[3];
  const I1 = built.bodiesBufData[16];
  const I2 = built.bodiesBufData[17];
  const I3 = built.bodiesBufData[18];
  assert.ok(Math.abs(m - 5.0) < 1e-5);
  assert.ok(I1 > 0 && I2 > 0 && I3 > 0, 'Principal moments must be strictly positive');
  // Quaternion must be unit length
  const qLen = Math.hypot(
    built.bodiesBufData[4], built.bodiesBufData[5], built.bodiesBufData[6], built.bodiesBufData[7]
  );
  assert.ok(Math.abs(qLen - 1.0) < 1e-6);
  // Check local particle COM in principal frame vanishes!
  let lx = 0; let ly = 0; let lz = 0;
  for (let i = 0; i < 10; i += 1) {
    lx += built.localPosBufData[i * 4 + 0];
    ly += built.localPosBufData[i * 4 + 1];
    lz += built.localPosBufData[i * 4 + 2];
  }
  assert.ok(Math.hypot(lx, ly, lz) < 1e-4, 'Principal-frame local particle COM must vanish');
  assert.equal(built.bodiesBufData.length, RIGID_BODY_STRIDE_FLOATS);
});
