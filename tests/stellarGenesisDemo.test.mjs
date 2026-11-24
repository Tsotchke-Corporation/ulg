import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { ClosureRegistry } from '../src/runtime/ClosureRegistry.js';
import {
  HYDRO_PARTICLE_STRIDE_FLOATS,
  createSelfGravitatingHydroEngine,
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

const ROOT = path.resolve(import.meta.dirname, '..');

test('Star Spec anti-hack static gate: zero origin hacks, zero logT_virial target, zero CPU mirror solver, zero canned visual props or scripted animations in Stellar Genesis', () => {
  for (const forbidden of [
    'supernova', 'bounce_pulse', 'post_ms_contract',
    'solar-nebula', 'massive-supernova', 'binary-nursery',
    'inner_accum', 'inner_grid', 'inner_half',
    'acc_core_eos', 'logT_virial', 'v_rad_now',
    'length(self_pm.xyz)', 'length(pm.xyz)', 'length(pos)',
    'stepCpuFallbackSelfGravitatingHydro'
  ]) {
    assert.equal(selfGravitatingHydroWgsl.includes(forbidden), false,
      `General runtime WGSL kernel must not contain origin/preset/virial hack token "${forbidden}"`);
  }

  const engineSrc = fs.readFileSync(path.join(ROOT, 'src/runtime/sph/selfGravitatingHydroGpu.js'), 'utf8');
  assert.equal(engineSrc.includes('stepCpuFallbackSelfGravitatingHydro'), false,
    'Production CPU mirror solver must be deleted (GPU-native only)');
  assert.equal(engineSrc.includes('outer_tree'), false,
    'Private Barnes-Hut octree must be deleted in favor of canonical SchroederScaleAtlas multipole');
  assert.ok(engineSrc.includes('createSchroederScaleAtlasGravitySolverWebGpu'),
    'selfGravitatingHydroGpu.js must wire canonical SchroederScaleAtlas multipole gravity');

  const demoSrc = fs.readFileSync(path.join(ROOT, 'src/demos/stellarGenesisDemo.js'), 'utf8');
  for (const forbiddenProp of [
    'isBinary', 'binaryGlowLeft', 'binaryGlowRight',
    'primaryStarGlow', 'outerCoronaGlow',
    'bhHorizonMesh', 'bhPhotonRing', 'bhAccretionDisk',
    'snShockShell', 'snShockRing', 'jetTop', 'jetBot',
    'protonA', 'protonB', 'h2BondCyl', 'coulombBarrierMesh', 'fusionFlashGlow'
  ]) {
    assert.equal(demoSrc.includes(forbiddenProp), false,
      `stellarGenesisDemo.js must not contain bespoke/canned/scripted prop "${forbiddenProp}"`);
  }

  const presenterSrc = fs.readFileSync(path.join(ROOT, 'src/runtime/residentGpuPresenter.js'), 'utf8');
  assert.equal(presenterSrc.includes('radiusDist.lessThan(float(2.4))'), false,
    'residentGpuPresenter.js must not anchor galactic bulge color to world origin (0,0,0)');

  // Strictly GPU-native: fails closed when WebGPU device is absent
  const bodies = createHydrogenNebulaInitialBodies({ count: 256, preset: 'solar-nebula', seed: 7 });
  assert.throws(() => createSelfGravitatingHydroEngine({ device: null, initialBodies: bodies }),
    /WebGPU GPUDevice/);
});

test('Nuclear-saturation EOS wall vanishes at solar and white-dwarf densities and stiffens above core-collapse density', () => {
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

test('Nebula initial conditions support arbitrary centerOffset translation and symmetric twin-lobe core boost', () => {
  assert.equal(Object.keys(NEBULA_INITIAL_CONDITIONS).length, 3);
  const originBodies = createHydrogenNebulaInitialBodies({ count: 512, preset: 'solar-nebula', seed: 1939 });
  const shiftedBodies = createHydrogenNebulaInitialBodies({
    count: 512,
    preset: 'solar-nebula',
    seed: 1939,
    centerOffset: [3.5, -1.5, 2.0]
  });
  assert.equal(originBodies.length, 512 * HYDRO_PARTICLE_STRIDE_FLOATS);
  for (let i = 0; i < 512; i += 1) {
    const o = i * HYDRO_PARTICLE_STRIDE_FLOATS;
    assert.ok(Math.abs((shiftedBodies[o + 0] - originBodies[o + 0]) - 3.5) < 1e-5);
    assert.ok(Math.abs((shiftedBodies[o + 1] - originBodies[o + 1]) - (-1.5)) < 1e-5);
    assert.ok(Math.abs((shiftedBodies[o + 2] - originBodies[o + 2]) - 2.0) < 1e-5);
    assert.equal(shiftedBodies[o + 8], originBodies[o + 8]);
    assert.equal(shiftedBodies[o + 9], originBodies[o + 9]);
  }

  // Twin-lobe binary: both lobes must have symmetric elevated local core density around x = +-4.5, NOT (0,0,0)
  const binBodies = createHydrogenNebulaInitialBodies({ count: 1024, preset: 'binary-nursery', seed: 1939 });
  let leftPeakRho = -99;
  let rightPeakRho = -99;
  for (let i = 0; i < 1024; i += 1) {
    const o = i * HYDRO_PARTICLE_STRIDE_FLOATS;
    if (binBodies[o + 0] < -2.0 && binBodies[o + 9] > leftPeakRho) leftPeakRho = binBodies[o + 9];
    if (binBodies[o + 0] > 2.0 && binBodies[o + 9] > rightPeakRho) rightPeakRho = binBodies[o + 9];
  }
  assert.ok(leftPeakRho > -15.0 && rightPeakRho > -15.0,
    `Both binary lobes must have elevated local core density (left=${leftPeakRho}, right=${rightPeakRho})`);
  assert.ok(Math.abs(leftPeakRho - rightPeakRho) < 0.2);
});
