import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { ClosureRegistry } from '../src/runtime/ClosureRegistry.js';
import { createSimulationModuleRegistry } from '../src/runtime/simulationModuleRegistry.js';
import {
  HYDRO_PARTICLE_STRIDE_FLOATS,
  createSelfGravitatingHydroEngine,
  createSelfGravitatingHydroModuleRegistration,
  selfGravitatingHydroWgsl
} from '../src/runtime/sph/selfGravitatingHydroGpu.js';
import {
  nuclearSaturationPressurePa,
  registerPlasmaFusionClosureArtifact
} from '../src/runtime/astrophysics/hydrogenStellarClosure.js';
import {
  NEBULA_INITIAL_CONDITIONS,
  createHydrogenNebulaInitialBodies
} from '../src/runtime/astrophysics/nebulaInitialConditions.js';
import { createUlgTaskCapsule, ULG_SERVICE_IDS, ULG_TASK_KINDS } from '../ulg-gpu-abi/src/serviceContract.js';

test('General self-gravitating-hydro WGSL kernel contains ZERO preset names or bespoke supernova trigger flags', () => {
  for (const forbidden of ['supernova', 'bounce_pulse', 'post_ms_contract', 'solar-nebula', 'massive-supernova', 'binary-nursery']) {
    assert.equal(selfGravitatingHydroWgsl.includes(forbidden), false,
      `General runtime WGSL kernel must not contain bespoke preset/trigger token "${forbidden}"`);
  }
  // Nuclear-saturation EOS wall must vanish at solar AND white-dwarf density (1e9 kg/m^3),
  // and stiffen sharply above core-collapse threshold (1e10 kg/m^3)
  assert.equal(nuclearSaturationPressurePa(1.5e5), 0);
  assert.equal(nuclearSaturationPressurePa(1e9), 0);
  assert.ok(nuclearSaturationPressurePa(1e10) > 1e24);
});

test('Plasma EOS closure registers cleanly in ULG ClosureRegistry with validity domain checks', async () => {
  const cache = new ArtifactCache();
  const registry = new ClosureRegistry({ artifactCache: cache });
  const { ref, artifact } = await registerPlasmaFusionClosureArtifact({ closureRegistry: registry });
  assert.ok(ref?.uri);
  const resolved = await registry.resolve({
    closureKind: artifact.closureKind,
    inputHash: artifact.inputHash,
    methodHash: artifact.methodHash,
    point: { log10Rho: 5.0, log10T: 7.2 }
  });
  assert.equal(resolved.validity, 'in-range');
  assert.equal(resolved.closure.provenance.validation.scientificValidation, false);
});

test('Identical general self-gravitating-hydro@1 laws produce a stable 1 M_sun Main-Sequence star AND an emergent 18 M_sun supernova purely from initial particle mass', async () => {
  const cache = new ArtifactCache();
  const closureRegistry = new ClosureRegistry({ artifactCache: cache });
  const { table } = await registerPlasmaFusionClosureArtifact({ closureRegistry });

  // 1. 1.0 M_sun cloud -> collapses through H2 dissociation & Saha ionization -> stable pp-chain fusion star!
  const solarBodies = createHydrogenNebulaInitialBodies({ count: 512, preset: 'solar-nebula', seed: 1939 });
  const engine = createSelfGravitatingHydroEngine({
    device: null,
    initialBodies: solarBodies,
    eosClosureTable: table
  });
  assert.equal(engine.getTelemetry().stage.id, 'molecular-nebula');

  let solarMaxT = 0;
  let solarMaxEps = 0;
  let solarMinFH2 = 1;
  let solarMaxXIon = 0;
  for (let s = 0; s < 160; s += 1) {
    const tel = await engine.step({ dt: 0.022, timeAccel: 4.5 });
    if (tel.coreTempK > solarMaxT) solarMaxT = tel.coreTempK;
    if (tel.peakEpsNucWPerKg > solarMaxEps) solarMaxEps = tel.peakEpsNucWPerKg;
    if (tel.coreFH2 < solarMinFH2) solarMinFH2 = tel.coreFH2;
    if (tel.coreXIonized > solarMaxXIon) solarMaxXIon = tel.coreXIonized;
    assert.ok(Math.abs(tel.nucleonSum - 1.0) < 1e-2, `nucleon conservation drift: ${tel.nucleonSum}`);
  }
  const solarEnd = engine.getTelemetry();
  assert.ok(solarMaxT > 5e6, `1 M_sun must ignite pp-chain (>5e6 K), reached ${solarMaxT.toExponential(2)} K`);
  assert.ok(solarMinFH2 < 0.05, `core H2 must dissociate, got ${solarMinFH2}`);
  assert.ok(solarMaxXIon > 0.9, `core H must ionize, got ${solarMaxXIon}`);
  assert.ok(solarMaxEps > 1e-5, `pp-chain fusion must ignite, got ${solarMaxEps}`);
  assert.equal(solarEnd.supernovaTriggered, false,
    `1 M_sun star must stabilize without core-collapse supernova (coreT=${solarEnd.coreTempK.toExponential(2)}, coreRho=${solarEnd.coreRhoKgM3.toExponential(2)})`);

  // 2. EXACT SAME ENGINE INSTANCE — literally ONLY reset particle masses to 18 M_sun!
  const massiveBodies = createHydrogenNebulaInitialBodies({ count: 512, preset: 'massive-supernova', seed: 1939 });
  engine.resetBodies(massiveBodies);
  let massiveMaxT = 0;
  let massiveMaxRho = 0;
  let snStep = -1;
  for (let s = 0; s < 220; s += 1) {
    const tel = await engine.step({ dt: 0.020, timeAccel: 6.5 });
    if (tel.coreTempK > massiveMaxT) massiveMaxT = tel.coreTempK;
    if (tel.coreRhoKgM3 > massiveMaxRho) massiveMaxRho = tel.coreRhoKgM3;
    if (tel.supernovaTriggered && snStep < 0) snStep = s;
  }
  const massiveEnd = engine.getTelemetry();
  assert.ok(massiveMaxT > 5e8, `18 M_sun core must climb past 5e8 K from self-gravity alone, reached ${massiveMaxT.toExponential(2)} K (maxRho=${massiveMaxRho.toExponential(2)})`);
  assert.ok(snStep >= 0, `18 M_sun cloud must reach emergent nuclear-saturation core bounce / collapse without preset flags (final T=${massiveEnd.coreTempK.toExponential(2)}, rho=${massiveEnd.coreRhoKgM3.toExponential(2)}, bouncePts=${massiveEnd.nuclearBounceCount}, Z=${massiveEnd.coreXZ.toFixed(3)})`);
  assert.equal(massiveEnd.remnantClass, 'black-hole');
  engine.dispose();
});

test('SimulationModuleRegistry dispatches general self-gravitating-hydro@1 capsule cleanly', async () => {
  const bodies = createHydrogenNebulaInitialBodies({ count: 256, preset: 'binary-nursery', seed: 7 });
  assert.equal(bodies.length, 256 * HYDRO_PARTICLE_STRIDE_FLOATS);
  const engine = createSelfGravitatingHydroEngine({ device: null, initialBodies: bodies });
  const registry = createSimulationModuleRegistry();
  registry.registerModule(createSelfGravitatingHydroModuleRegistration({ engine, zeroCopy: false }));

  const cap = createUlgTaskCapsule({
    taskId: 'test-sgh-binary-0',
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.simulationStep,
    method: { model: 'self-gravitating-hydro', version: 1 },
    input: { stepIndex: 0, parameters: { dt: 0.018, timeAccel: 2.0 } }
  });
  const res = await registry.dispatchSimulationStepCapsule(cap, { device: null });
  assert.equal(res.artifact.validation.status, 'pass');
  assert.equal(res.artifact.validation.scientificValidation, false);
  assert.equal(res.artifact.validity.finite, true);
  assert.equal(Object.keys(NEBULA_INITIAL_CONDITIONS).length, 3);
  res.leaseHandle?.release?.();
  engine.dispose();
});
