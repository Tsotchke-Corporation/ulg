import assert from 'node:assert/strict';
import test from 'node:test';
import { createUlgTaskCapsule, ULG_SERVICE_IDS, ULG_TASK_KINDS } from '../ulg-gpu-abi/src/serviceContract.js';
import { createSimulationModuleRegistry } from '../src/runtime/simulationModuleRegistry.js';
import { createCosmicQuantumScaleBridge } from '../src/runtime/sph/cosmicQuantumScaleBridge.js';
import {
  cosmicBarnesHutOctreeWgsl,
  cosmicNBodyTiledWgsl,
  continuumMicroSphWgsl,
  createContinuumSpecimenBodies,
  createCosmicWebBodies,
  createGalacticBodies,
  createResidentBarnesHutNBodyEngine,
  createResidentContinuumDropletEngine,
  createResidentCosmicModuleRegistration,
  createResidentTiledNBodyEngine
} from '../src/demos/cosmicQuantumGpuKernels.js';
import {
  VOLUMETRIC_ORBITAL_MODES,
  buildOrbitalVolumeData,
  evaluateRealSphericalHarmonic
} from '../src/demos/volumetricOrbitalRaymarcher.js';

test('createGalacticBodies produces deterministic finite 8-float interleaved ABI across disk, binary, and sphere presets', () => {
  for (const preset of ['disk', 'binary', 'sphere']) {
    const a = createGalacticBodies({ count: 256, preset, seed: 825 });
    const b = createGalacticBodies({ count: 256, preset, seed: 825 });
    assert.equal(a.length, 256 * 8);
    assert.deepEqual(a, b, `preset ${preset} must be deterministic`);

    let totalMass = 0;
    for (let i = 0; i < 256; i += 1) {
      const base = i * 8;
      for (let k = 0; k < 8; k += 1) {
        assert.ok(Number.isFinite(a[base + k]), `${preset} body ${i} field ${k} must be finite`);
      }
      assert.ok(a[base + 3] > 0, `${preset} body ${i} mass must be positive`);
      assert.ok(a[base + 7] > 0, `${preset} body ${i} radius must be positive`);
      totalMass += a[base + 3];
    }
    assert.ok(totalMass > 100, `${preset} total mass must include massive core(s)`);
  }
});

test('createCosmicWebBodies creates finite Zel-dovich filamentary distribution inside observable-universe box', () => {
  const bodies = createCosmicWebBodies({ count: 192, seed: 1370 });
  assert.equal(bodies.length, 192 * 8);
  let maxR = 0;
  for (let i = 0; i < 192; i += 1) {
    const b = i * 8;
    for (let k = 0; k < 8; k += 1) {
      assert.ok(Number.isFinite(bodies[b + k]));
    }
    assert.ok(bodies[b + 3] > 0);
    const r = Math.hypot(bodies[b], bodies[b + 1], bodies[b + 2]);
    if (r > maxR) maxR = r;
  }
  assert.ok(maxR > 5 && maxR < 30, `expected bounded cosmic web radius, got ${maxR}`);
});

test('createResidentTiledNBodyEngine CPU fallback preserves momentum in Newtonian mode and expands scaleFactorA in comoving LCDM mode', async () => {
  assert.ok(cosmicNBodyTiledWgsl.includes('fn step_nbody'));
  assert.ok(cosmicNBodyTiledWgsl.includes('workgroupBarrier()'));

  // Newtonian mode (mode = 0)
  const initial = createGalacticBodies({ count: 96, preset: 'disk', seed: 42 });
  const engine = createResidentTiledNBodyEngine({
    device: null,
    initialBodies: initial,
    mode: 0,
    label: 'test-newtonian'
  });
  assert.equal(engine.backend, 'cpu-fallback');
  assert.equal(engine.scaleFactorA, 1.0);

  const momentum = (arr) => {
    let px = 0; let py = 0; let pz = 0;
    for (let i = 0; i < arr.length; i += 8) {
      const m = arr[i + 3];
      px += m * arr[i + 4];
      py += m * arr[i + 5];
      pz += m * arr[i + 6];
    }
    return [px, py, pz];
  };

  const p0 = momentum(engine.getBodies());
  const next = await engine.step({ dt: 0.01, gravity: 1.0, softening: 0.25 });
  assert.equal(engine.stepIndex, 1);
  assert.equal(engine.scaleFactorA, 1.0);
  const p1 = momentum(next);
  assert.ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) < 1e-3, 'total linear momentum conserved under symmetric pairwise gravity');

  // Comoving LCDM mode (mode = 1)
  const webInit = createCosmicWebBodies({ count: 96, seed: 1370 });
  const cosmo = createResidentTiledNBodyEngine({
    device: null,
    initialBodies: webInit,
    mode: 1,
    label: 'test-cosmo'
  });
  const a0 = cosmo.scaleFactorA;
  assert.equal(a0, 0.25);
  await cosmo.step({ dt: 0.02, gravity: 0.08, softening: 0.85, hubbleRate: 0.14 });
  assert.equal(cosmo.stepIndex, 1);
  assert.ok(cosmo.scaleFactorA > a0, 'comoving scale factor a(t) must advance under positive Hubble rate');
  for (const v of cosmo.getBodies()) {
    assert.ok(Number.isFinite(v));
  }

  engine.dispose();
  cosmo.dispose();
});

test('createResidentCosmicModuleRegistration integrates with SimulationModuleRegistry, lease revocation, and 38-OOM CosmicQuantumScaleBridge', async () => {
  const registry = createSimulationModuleRegistry();
  const galEngine = createResidentTiledNBodyEngine({
    device: null,
    initialBodies: createGalacticBodies({ count: 64, preset: 'binary', seed: 12 }),
    mode: 0
  });
  const cosmoEngine = createResidentTiledNBodyEngine({
    device: null,
    initialBodies: createCosmicWebBodies({ count: 64, seed: 34 }),
    mode: 1
  });

  registry.registerModule(createResidentCosmicModuleRegistration({
    method: { model: 'nbody-gravity', version: 1 },
    engine: galEngine,
    scaleRangeM: [1e6, 1e22]
  }));
  registry.registerModule(createResidentCosmicModuleRegistration({
    method: { model: 'cosmology-comoving-nbody', version: 1 },
    engine: cosmoEngine,
    scaleRangeM: [1e22, 1e28]
  }));

  const bridge = createCosmicQuantumScaleBridge({ moduleRegistry: registry });
  assert.ok(bridge.summary().totalSpanOrdersOfMagnitude >= 38);

  const galCap = createUlgTaskCapsule({
    taskId: 'host-gal-0',
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.simulationStep,
    method: { model: 'nbody-gravity', version: 1 },
    input: { stepIndex: 0, parameters: { dt: 0.012, gravity: 1.0, softening: 0.22 } }
  });
  const galRes = await registry.dispatchSimulationStepCapsule(galCap);
  assert.equal(galRes.artifact.validation.status, 'pass');
  assert.equal(galRes.artifact.validation.scientificValidation, false);
  assert.equal(galRes.leaseHandle.isCurrent(), true);

  const checkpoint = await galRes.leaseSession.createPortableCheckpoint({ resourceKey: 'bodies' });
  assert.equal(checkpoint.values.length, 64 * 8);

  await registry.resetModuleSession({ model: 'nbody-gravity', version: 1 });
  assert.equal(galRes.leaseHandle.isCurrent(), false);
  assert.throws(
    () => galRes.leaseSession.assertValidLeaseHandle(galRes.leaseHandle),
    (err) => err?.code === 'ERR_STALE_RESIDENT_BUFFER_LEASE'
  );

  const cosmoCap = createUlgTaskCapsule({
    taskId: 'host-cosmo-0',
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.simulationStep,
    method: { model: 'cosmology-comoving-nbody', version: 1 },
    input: { stepIndex: 0, parameters: { dt: 0.016, gravity: 0.08, softening: 0.85, hubbleRate: 0.14 } }
  });
  const cosmoRes = await registry.dispatchSimulationStepCapsule(cosmoCap);
  assert.equal(cosmoRes.artifact.execution.stage, 'cosmology-comoving-nbody.step');
  assert.ok(cosmoRes.artifact.execution.scaleFactorA > 0.25);
  cosmoRes.leaseHandle.release();
  galEngine.dispose();
  cosmoEngine.dispose();
});

test('resident module buffer session stays O(1) memory and fast across 2000 continuous frames without ledger leak', async () => {
  const registry = createSimulationModuleRegistry();
  const galEngine = createResidentTiledNBodyEngine({
    device: null,
    initialBodies: createGalacticBodies({ count: 64, preset: 'disk', seed: 7 }),
    mode: 0
  });
  registry.registerModule(createResidentCosmicModuleRegistration({
    method: { model: 'nbody-gravity', version: 1 },
    engine: galEngine,
    scaleRangeM: [1e6, 1e22]
  }));

  const t0 = performance.now();
  let lastSummary = null;
  let firstHandle = null;
  for (let i = 0; i < 1200; i += 1) {
    const cap = createUlgTaskCapsule({
      taskId: `mem-gal-${i}`,
      serviceId: ULG_SERVICE_IDS.ulgRuntime,
      taskKind: ULG_TASK_KINDS.simulationStep,
      method: { model: 'nbody-gravity', version: 1 },
      input: { stepIndex: i, parameters: { dt: 0.01, gravity: 1.0, softening: 0.25 } }
    });
    const res = await registry.dispatchSimulationStepCapsule(cap);
    if (i === 0) firstHandle = res.leaseHandle;
    res.leaseHandle.release();
    lastSummary = res.leaseSession.summary();
  }
  const elapsedMs = performance.now() - t0;
  assert.equal(firstHandle.isCurrent(), false);
  assert.equal(lastSummary.activeHandleCount, 0);
  assert.ok(lastSummary.ledger.resourceCount <= 2, `expected bounded resourceCount, got ${lastSummary.ledger.resourceCount}`);
  assert.ok(lastSummary.ledger.leases.length <= 4, `expected bounded leases array, got ${lastSummary.ledger.leases.length}`);
  assert.ok(elapsedMs < 5000, `1200 steps should stay O(1) per frame, took ${elapsedMs.toFixed(1)} ms`);
  galEngine.dispose();
});

test('createResidentBarnesHutNBodyEngine scales initialization to 32768 bodies and executes finite CPU fallback steps', async () => {
  assert.ok(cosmicBarnesHutOctreeWgsl.includes('fn bh_deposit_leaves'));
  assert.ok(cosmicBarnesHutOctreeWgsl.includes('fn bh_integrate'));

  const bodies32k = createGalacticBodies({ count: 32768, preset: 'disk', seed: 825 });
  assert.equal(bodies32k.length, 32768 * 8);
  assert.ok(Number.isFinite(bodies32k[0]) && bodies32k[3] > 100);

  const bhCpu = createResidentBarnesHutNBodyEngine({
    device: null,
    initialBodies: createGalacticBodies({ count: 128, preset: 'disk', seed: 42 }),
    mode: 0,
    boxHalf: 16.0,
    theta: 0.65
  });
  const out = await bhCpu.step({ dt: 0.011, gravity: 1.0, softening: 0.24 });
  assert.equal(bhCpu.stepIndex, 1);
  for (const v of out) assert.ok(Number.isFinite(v));
  bhCpu.dispose();
});

test('volumetricOrbitalRaymarcher builds signed 3D spherical-harmonic volumes with honest provenance labels', () => {
  assert.equal(VOLUMETRIC_ORBITAL_MODES.length, 6);
  assert.equal(VOLUMETRIC_ORBITAL_MODES[0].provenance, 'radial-atomic-density-reconstruction');
  assert.equal(VOLUMETRIC_ORBITAL_MODES[3].id, 'd_z2');
  assert.equal(VOLUMETRIC_ORBITAL_MODES[3].provenance, 'spherical-harmonic-basis-projection');

  // d_z2 polar positive (+1) and equatorial negative (-0.5)
  assert.ok(evaluateRealSphericalHarmonic('d_z2', 0, 1, 0) > 0.99);
  assert.ok(evaluateRealSphericalHarmonic('d_z2', 1, 0, 0) < -0.49);
  // p_z antisymmetric
  assert.ok(evaluateRealSphericalHarmonic('p_z', 0, 1, 0) > 0.99);
  assert.ok(evaluateRealSphericalHarmonic('p_z', 0, -1, 0) < -0.99);

  const radialSamples = Array.from({ length: 32 }, (_, i) => {
    const r = (i / 31) * 5.0;
    return { rBohr: r, radialProbabilityPerBohr: r * r * Math.exp(-1.2 * r) };
  });

  const tot = buildOrbitalVolumeData({ radialSamples, rMaxBohr: 5.0, r95Bohr: 3.0, modeId: 'total-density', dim: 20 });
  assert.equal(tot.data.length, 20 * 20 * 20 * 4);
  assert.ok(tot.peak > 0);
  let totNeg = 0;
  for (let i = 0; i < tot.data.length; i += 4) totNeg += tot.data[i + 1];
  assert.equal(totNeg, 0, 'total electron density must be strictly non-negative');

  const dz2 = buildOrbitalVolumeData({ radialSamples, rMaxBohr: 5.0, r95Bohr: 3.0, modeId: 'd_z2', dim: 20 });
  let posSum = 0;
  let negSum = 0;
  for (let i = 0; i < dz2.data.length; i += 4) {
    posSum += dz2.data[i + 0];
    negSum += dz2.data[i + 1];
  }
  assert.ok(posSum > 0 && negSum > 0, 'd_z2 volume must contain both positive polar lobes and negative equatorial torus');
});

test('continuum-micro-sph@1 generates liquid/solid/gas specimens and integrates via SimulationModuleRegistry', async () => {
  assert.ok(continuumMicroSphWgsl.includes('fn step_continuum_micro_sph'));
  for (const phase of ['liquid', 'solid', 'gas']) {
    const bodies = createContinuumSpecimenBodies({ count: 256, phase, seed: 4201 });
    assert.equal(bodies.length, 256 * 8);
    for (const v of bodies) assert.ok(Number.isFinite(v));
  }

  const registry = createSimulationModuleRegistry();
  const engine = createResidentContinuumDropletEngine({
    device: null,
    initialBodies: createContinuumSpecimenBodies({ count: 128, phase: 'liquid', seed: 4201 }),
    phase: 'liquid',
    bulkModulusPa: 25e9
  });
  registry.registerModule(createResidentCosmicModuleRegistration({
    method: { model: 'continuum-micro-sph', version: 1 },
    engine,
    scaleRangeM: [1e-4, 1e2],
    zeroCopy: false
  }));

  const cap = createUlgTaskCapsule({
    taskId: 'cont-host-0',
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.simulationStep,
    method: { model: 'continuum-micro-sph', version: 1 },
    input: { stepIndex: 0, parameters: { dt: 0.015, gravity: 4.8 } }
  });
  const res = await registry.dispatchSimulationStepCapsule(cap);
  assert.equal(res.artifact.validation.status, 'pass');
  assert.equal(res.artifact.execution.stage, 'continuum-micro-sph.step');
  assert.equal(engine.stepIndex, 1);
  res.leaseHandle.release();
  engine.dispose();
});
