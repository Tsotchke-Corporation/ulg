import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createSimulationModuleRegistry } from '../src/runtime/simulationModuleRegistry.js';
import { createCosmicQuantumScaleBridge } from '../src/runtime/sph/cosmicQuantumScaleBridge.js';
import {
  PLANETARY_SYSTEM_SPECS,
  cosmicScaleAtlasIntegrateWgsl,
  cosmicNBodyTiledWgsl,
  continuumMicroSphWgsl,
  createContinuumSpecimenBodies,
  createCosmicWebBodies,
  createGalacticBodies,
  createPlanetarySystemBodies,
  createResidentScaleAtlasMultipoleNBodyEngine,
  createResidentBarnesHutNBodyEngine,
  createResidentContinuumDropletEngine,
  createResidentTiledNBodyEngine,
  deriveContinuumConstitutiveParams
} from '../src/demos/cosmicQuantumGpuKernels.js';
import {
  schroederScaleAtlasMultipoleWgsl,
  schroederScaleAtlasResidentGravityWgsl
} from '../src/runtime/sph/schroederScaleAtlasMultipoleGpu.js';
import {
  VOLUMETRIC_ORBITAL_MODES,
  buildOrbitalVolumeData,
  evaluateRealSphericalHarmonic
} from '../src/demos/volumetricOrbitalRaymarcher.js';
import { buildAtomicRadialDensityArtifact } from '../src/runtime/electronicStructure/quantumDerivationArtifacts.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('Star Spec anti-hack static gate: zero phase_mode, zero origin bowl, zero CPU mirror solvers, zero scripted orbital or specimen animation loops', () => {
  const kernelSrc = fs.readFileSync(path.join(ROOT, 'src/demos/cosmicQuantumGpuKernels.js'), 'utf8');
  for (const forbidden of [
    'phase_mode',
    'stepCpuFallbackBodies',
    'r_xz > 1.45',
    'cpu-fallback',
    'cosmicBarnesHutOctreeWgsl',
    'fn bh_deposit_leaves'
  ]) {
    assert.equal(kernelSrc.includes(forbidden), false,
      `cosmicQuantumGpuKernels.js must not contain forbidden hack/fallback/private-octree token "${forbidden}"`);
  }
  assert.ok(cosmicNBodyTiledWgsl.includes('fn step_nbody'));
  assert.ok(cosmicNBodyTiledWgsl.includes('workgroupBarrier()'));
  assert.ok(schroederScaleAtlasResidentGravityWgsl.includes('fn ss_atlas_grav_com_reduce'));
  assert.ok(schroederScaleAtlasResidentGravityWgsl.includes('fn ss_atlas_grav_bin_charts'));
  assert.ok(schroederScaleAtlasResidentGravityWgsl.includes('fn ss_atlas_grav_eval_particles'));
  assert.ok(cosmicScaleAtlasIntegrateWgsl.includes('fn ss_atlas_nbody_integrate'));
  assert.equal(schroederScaleAtlasMultipoleWgsl.includes('@workgroup_size(1)'), false,
    'Canonical SchroederScaleAtlas multipole WGSL must have ZERO @workgroup_size(1) serial bottlenecks');
  assert.ok(continuumMicroSphWgsl.includes('fn step_continuum_micro_sph'));

  // Fail-closed constitutive params: missing meltingPointK/boilingPointK must throw rather than branch on discrete phase
  assert.throws(() => deriveContinuumConstitutiveParams({ phase: 'liquid' }), /fails closed/i);
  assert.equal(createResidentBarnesHutNBodyEngine, createResidentScaleAtlasMultipoleNBodyEngine);

  const demoSrc = fs.readFileSync(path.join(ROOT, 'src/demos/cosmicQuantumZoomDemo.js'), 'utf8');
  for (const forbiddenDemo of [
    'galacticCoreGlow',
    'continuumSpecimenMesh',
    'continuumGasCloud',
    'Math.cos(ang) * pl.a',
    'Math.sin(simClock * 3.1)',
    "galaxyPreset !== 'binary'"
  ]) {
    assert.equal(demoSrc.includes(forbiddenDemo), false,
      `cosmicQuantumZoomDemo.js must not contain scripted/origin-hack token "${forbiddenDemo}"`);
  }

  // Strictly GPU-native: all three engines fail closed without a WebGPU GPUDevice
  const galInit = createGalacticBodies({ count: 64, preset: 'disk', seed: 42 });
  assert.throws(() => createResidentTiledNBodyEngine({ device: null, initialBodies: galInit, mode: 0 }), /WebGPU GPUDevice/);
  assert.throws(() => createResidentBarnesHutNBodyEngine({ device: null, initialBodies: galInit, mode: 0 }), /WebGPU GPUDevice/);
  const contInit = createContinuumSpecimenBodies({ count: 64, meltingPointK: 234.3, boilingPointK: 629.9 });
  assert.throws(() => createResidentContinuumDropletEngine({ device: null, initialBodies: contInit }), /WebGPU GPUDevice/);
});

test('createPlanetarySystemBodies constructs exact barycentric zero-momentum Keplerian initial conditions with translation invariance', () => {
  assert.equal(PLANETARY_SYSTEM_SPECS.length, 5);
  const origin = createPlanetarySystemBodies({ gravity: 1.0, softening: 0.02 });
  const shift = [4.5, -2.0, 3.25];
  const shifted = createPlanetarySystemBodies({ gravity: 1.0, softening: 0.02, centerOffset: shift });
  assert.equal(origin.length, 5 * 8);

  let mTot = 0;
  let cx = 0; let cy = 0; let cz = 0;
  let px = 0; let py = 0; let pz = 0;
  for (let i = 0; i < 5; i += 1) {
    const o = i * 8;
    const m = origin[o + 3];
    mTot += m;
    cx += m * origin[o + 0]; cy += m * origin[o + 1]; cz += m * origin[o + 2];
    px += m * origin[o + 4]; py += m * origin[o + 5]; pz += m * origin[o + 6];
    assert.ok(Math.abs((shifted[o + 0] - origin[o + 0]) - shift[0]) < 1e-5);
    assert.ok(Math.abs((shifted[o + 1] - origin[o + 1]) - shift[1]) < 1e-5);
    assert.ok(Math.abs((shifted[o + 2] - origin[o + 2]) - shift[2]) < 1e-5);
  }
  assert.ok(Math.hypot(cx / mTot, cy / mTot, cz / mTot) < 1e-5, 'barycenter must sit at origin');
  assert.ok(Math.hypot(px, py, pz) < 1e-4, 'total linear momentum must vanish');
});

test('createGalacticBodies and createCosmicWebBodies support deterministic finite initialization and arbitrary centerOffset', () => {
  for (const preset of ['disk', 'binary', 'sphere']) {
    const a = createGalacticBodies({ count: 256, preset, seed: 825 });
    const b = createGalacticBodies({ count: 256, preset, seed: 825 });
    const shifted = createGalacticBodies({ count: 256, preset, seed: 825, centerOffset: [5.0, -3.0, 2.0] });
    assert.equal(a.length, 256 * 8);
    assert.deepEqual(a, b, `preset ${preset} must be deterministic`);

    let totalMass = 0;
    for (let i = 0; i < 256; i += 1) {
      const base = i * 8;
      for (let k = 0; k < 8; k += 1) {
        assert.ok(Number.isFinite(a[base + k]), `${preset} body ${i} field ${k} must be finite`);
      }
      assert.ok(a[base + 3] > 0 && a[base + 7] > 0);
      assert.ok(Math.abs((shifted[base + 0] - a[base + 0]) - 5.0) < 1e-4);
      assert.ok(Math.abs((shifted[base + 1] - a[base + 1]) - (-3.0)) < 1e-4);
      assert.ok(Math.abs((shifted[base + 2] - a[base + 2]) - 2.0) < 1e-4);
      totalMass += a[base + 3];
    }
    assert.ok(totalMass > 100, `${preset} total mass must include massive core(s)`);
  }

  const bodies32k = createGalacticBodies({ count: 32768, preset: 'disk', seed: 825 });
  assert.equal(bodies32k.length, 32768 * 8);

  const web = createCosmicWebBodies({ count: 192, seed: 1370 });
  const webShift = createCosmicWebBodies({ count: 192, seed: 1370, centerOffset: [-4.0, 2.5, 1.5] });
  assert.equal(web.length, 192 * 8);
  let maxR = 0;
  for (let i = 0; i < 192; i += 1) {
    const b = i * 8;
    for (let k = 0; k < 8; k += 1) assert.ok(Number.isFinite(web[b + k]));
    assert.ok(Math.abs((webShift[b + 0] - web[b + 0]) - (-4.0)) < 1e-4);
    const r = Math.hypot(web[b], web[b + 1], web[b + 2]);
    if (r > maxR) maxR = r;
  }
  assert.ok(maxR > 5 && maxR < 30, `expected bounded cosmic web radius, got ${maxR}`);
});

test('deriveContinuumConstitutiveParams varies smoothly across solid Au, liquid Hg, and gas Cl without discrete phase switches', () => {
  const au = deriveContinuumConstitutiveParams({ bulkModulusPa: 180e9, meltingPointK: 1337, boilingPointK: 3129, cohesiveEnergyEv: 3.81, temperatureK: 298.15 });
  const hg = deriveContinuumConstitutiveParams({ bulkModulusPa: 25e9, meltingPointK: 234.3, boilingPointK: 629.9, cohesiveEnergyEv: 0.67, temperatureK: 298.15 });
  const cl = deriveContinuumConstitutiveParams({ bulkModulusPa: 1e8, meltingPointK: 171.6, boilingPointK: 239.1, cohesiveEnergyEv: 0.12, temperatureK: 298.15 });

  assert.ok(au.solidOrder > 0.99 && hg.solidOrder < 0.15 && cl.solidOrder < 0.01);
  assert.ok(au.condensedOrder > 0.99 && hg.condensedOrder > 0.95 && cl.condensedOrder < 0.25);
  assert.ok(au.bondElasticity > hg.bondElasticity * 5, 'solid Au must have much higher elastic bond restoring strength than liquid Hg');
  assert.ok(hg.cohesion > cl.cohesion * 2, 'liquid Hg must have stronger surface cohesion than gas Cl');
  assert.ok(cl.thermalSpeed > hg.thermalSpeed * 4, 'gas Cl must have much higher thermal kinetic speed than liquid Hg');

  for (const opts of [
    { meltingPointK: 1337, boilingPointK: 3129, bulkModulusPa: 180e9 },
    { meltingPointK: 234.3, boilingPointK: 629.9, bulkModulusPa: 25e9 },
    { meltingPointK: 171.6, boilingPointK: 239.1, bulkModulusPa: 1e8 }
  ]) {
    const bodies = createContinuumSpecimenBodies({ count: 256, ...opts, seed: 4201 });
    assert.equal(bodies.length, 256 * 8);
    for (const v of bodies) assert.ok(Number.isFinite(v));
  }
});

test('CosmicQuantumScaleBridge covers >= 38 orders of magnitude cleanly', () => {
  const registry = createSimulationModuleRegistry();
  const bridge = createCosmicQuantumScaleBridge({ moduleRegistry: registry });
  assert.ok(bridge.summary().totalSpanOrdersOfMagnitude >= 38);
});

test('volumetricOrbitalRaymarcher builds signed 3D spherical-harmonic volumes with honest provenance labels', () => {
  assert.equal(VOLUMETRIC_ORBITAL_MODES.length, 6);
  assert.equal(VOLUMETRIC_ORBITAL_MODES[0].provenance, 'radial-atomic-density-reconstruction');
  assert.equal(VOLUMETRIC_ORBITAL_MODES[3].id, 'd_z2');
  assert.equal(VOLUMETRIC_ORBITAL_MODES[3].provenance, 'spherical-harmonic-basis-projection');

  assert.ok(evaluateRealSphericalHarmonic('d_z2', 0, 1, 0) > 0.99);
  assert.ok(evaluateRealSphericalHarmonic('d_z2', 1, 0, 0) < -0.49);
  assert.ok(evaluateRealSphericalHarmonic('p_z', 0, 1, 0) > 0.99);
  assert.ok(evaluateRealSphericalHarmonic('p_z', 0, -1, 0) < -0.99);

  const radialSamples = Array.from({ length: 32 }, (_, i) => {
    const r = (i / 31) * 5.0;
    return { rBohr: r, rhoPerBohr3: Math.exp(-1.5 * r), radialProbabilityPerBohr: r * r * Math.exp(-1.2 * r) };
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

  // Verify live Kohn-Sham radial wavefunction (with real radial nodes!) and non-hollow 3D total density on Sodium (Z=11, 3s)
  const na = buildAtomicRadialDensityArtifact(11, { gridPointsN: 300, includeCloudGrid: false }).artifact;
  assert.ok(na.radialProfile.orbitalWavefunctions['0']?.radialAmplitude?.length > 0, '3s radial wavefunction must be exported');
  const naTot = buildOrbitalVolumeData({
    radialSamples: na.radialProfile.samples,
    orbitalWavefunctions: na.radialProfile.orbitalWavefunctions,
    rMaxBohr: na.radialProfile.rMaxBohr,
    r95Bohr: na.summary.containmentRadii.r95Bohr,
    modeId: 'total-density',
    dim: 24
  });
  const centerIdx = ((12 * 24 + 12) * 24 + 12) * 4;
  const edgeIdx = ((12 * 24 + 12) * 24 + 22) * 4;
  assert.ok(naTot.data[centerIdx + 3] > naTot.data[edgeIdx + 3], '3D total density must peak at core (not hollow 4pi r^2 rho!)');

  // 3s orbital of Sodium has real radial nodes -> BOTH positive and negative radial phases must appear in modeId="s"!
  const na3s = buildOrbitalVolumeData({
    radialSamples: na.radialProfile.samples,
    orbitalWavefunctions: na.radialProfile.orbitalWavefunctions,
    rMaxBohr: na.radialProfile.rMaxBohr,
    r95Bohr: na.summary.containmentRadii.r95Bohr,
    modeId: 's',
    dim: 24
  });
  let sPos = 0;
  let sNeg = 0;
  for (let i = 0; i < na3s.data.length; i += 4) {
    sPos += na3s.data[i + 0];
    sNeg += na3s.data[i + 1];
  }
  assert.ok(sPos > 0 && sNeg > 0, `3s Kohn-Sham orbital must preserve its real radial nodes (pos=${sPos}, neg=${sNeg})`);
});
