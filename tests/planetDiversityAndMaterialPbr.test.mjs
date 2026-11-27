import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  deriveGalaxyEnvironmentFromCosmicContext,
  deriveStarSystemFromGalacticLocation,
  synthesizeNebularPlanetarySystem
} from '../src/runtime/astrophysics/causalNebularSystemGenerator.js';
import { extractCoalescedBodiesFromAnnuli } from '../src/runtime/astrophysics/nebularSystemCoalescenceGpu.js';
import {
  buildElementPbrLutFloats,
  derivePbrOpticsFromMaterialBundle,
  resolveCompoundPbrOptics,
  resolveElementPbrOptics,
  resolvePlanetarySurfacePbrOptics,
  resolveSolventIor
} from '../src/runtime/material/materialPbrOpticsBridge.js';
import { getOrganicElementPhysics } from '../src/runtime/organic/organicMolecularGraphGpu.js';
import { REAL_SOLAR_SYSTEM_CATALOG } from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';
import { ATOMIC_MASS_U } from '../src/runtime/electronicStructure/periodicTable.js';

test('Star-system planet diversity: retires cryo-dwarf/ice-giant monotony across 60 random stars', () => {
  const gEnv = deriveGalaxyEnvironmentFromCosmicContext({ seed: 20261125 });
  const counts = {};
  let totalMainSeq = 0;
  let onlyCryoIceMainSeq = 0;
  for (let i = 1; i <= 60; i += 1) {
    const r = 1.5 + (i % 7) * 1.1;
    const sys = deriveStarSystemFromGalacticLocation({
      galaxyEnv: gEnv,
      starPosGal: [r, 0.05, 0.2],
      starIndex: i,
      seed: 20261125
    });
    const cat = synthesizeNebularPlanetarySystem(sys);
    const planets = cat.catalog.filter((b) => !b.isStar && !b.isMinorBody && b.parent <= 0);
    if (planets.length === 0) continue;
    const classes = planets.map((p) => p.planetClass);
    for (const c of classes) counts[c] = (counts[c] || 0) + 1;
    for (const p of planets) {
      assert.ok(p.pbrOptics && Array.isArray(p.pbrOptics.f0Rgb) && p.pbrOptics.f0Rgb.length === 3, `${p.name} missing pbrOptics`);
    }
    if (!sys.stars[0].isRemnant) {
      totalMainSeq += 1;
      if (classes.every((c) => c === 'icy-dwarf' || c === 'ice-giant')) {
        onlyCryoIceMainSeq += 1;
      }
    }
  }
  const distinctClasses = Object.keys(counts);
  assert.ok(distinctClasses.length >= 10, `Expected >= 10 distinct planet classes across 60 stars, got ${distinctClasses.length}: ${distinctClasses.join(', ')}`);
  assert.ok(onlyCryoIceMainSeq / Math.max(1, totalMainSeq) <= 0.06, `Too many cryo-dwarf/ice-giant-only main-sequence systems: ${onlyCryoIceMainSeq}/${totalMainSeq}`);
  assert.ok((counts['sub-neptune'] || 0) >= 3, `Expected Sub-Neptunes across ensemble, got ${counts['sub-neptune'] || 0}`);
  assert.ok((counts['titan-world'] || 0) + (counts['cryo-ocean-world'] || 0) >= 4, 'Expected outer Titan & Cryo-Ocean worlds beyond snow line');
});

test('GPU nebular peak extraction preserves inner terrestrial/HZ clumps alongside massive snow-line ice jump', () => {
  const nBins = 64;
  const rMin = 0.05;
  const rMax = 20.0;
  const snowAu = 1.4;
  const summary = new Float32Array(nBins * 8);
  for (let b = 0; b < nBins; b += 1) {
    const u = (b + 0.5) / nBins;
    const rAu = rMin * Math.pow(rMax / rMin, u);
    const beyond = rAu >= snowAu;
    // Inner rocky disk has ~8x less solid mass than snow-line icy pileups, with 2 distinct inner peaks + 2 outer peaks!
    let mSol = beyond ? 48.0 : 5.5;
    if (b === 10 || b === 20) mSol = 12.5; // Warm rocky & temperate HZ embryos!
    if (b === 38 || b === 50) mSol = 96.0; // Outer giant / ice-giant cores!
    const o = b * 8;
    summary[o + 0] = rAu;
    summary[o + 1] = mSol;
    summary[o + 2] = beyond ? 0.08 : 0.30;
    summary[o + 3] = beyond ? 0.18 : 0.56;
    summary[o + 4] = 0.08;
    summary[o + 5] = beyond ? 0.50 : 0.04;
    summary[o + 6] = beyond ? 0.16 : 0.02;
    summary[o + 7] = b === 38 ? 0.55 : (b === 50 ? 0.18 : 0.0);
  }
  const res = extractCoalescedBodiesFromAnnuli(summary, {
    starMassSolar: 0.72,
    starLuminositySolar: 0.27,
    metallicitySolar: 1.0,
    rMinStableAu: rMin,
    rMaxStableAu: rMax
  });
  const innerBodies = res.bodies.filter((b) => b.aAu < snowAu);
  const outerBodies = res.bodies.filter((b) => b.aAu >= snowAu);
  assert.ok(innerBodies.length >= 2, `Expected >= 2 inner terrestrial/HZ clumps preserved despite 8x outer snow-line jump, got ${innerBodies.length}`);
  assert.ok(outerBodies.length >= 2, `Expected >= 2 outer snow-line clumps, got ${outerBodies.length}`);
});

test('Material-physics PBR optical bridge derives distinct conductor vs dielectric GGX Fresnel parameters', () => {
  const au = resolveElementPbrOptics(79, { surfaceFinish: 'crystal' });
  const cu = resolveElementPbrOptics(29, { surfaceFinish: 'crystal' });
  const ag = resolveElementPbrOptics(47, { surfaceFinish: 'crystal' });
  const fe = resolveElementPbrOptics(26, { surfaceFinish: 'crystal' });
  const ne = resolveElementPbrOptics(10, { surfaceFinish: 'crystal' });
  const liveWater = derivePbrOpticsFromMaterialBundle({
    electromagnetic: {
      refractiveIndex550Nm: 1.333,
      extinctionCoeff550Nm: 0.0,
      bandGapEv: 7.0,
      dcConductivitySPerM: 1e-4,
      opticalSrgb: [0.18, 0.52, 0.78]
    }
  }, { phase: 'liquid', surfaceFinish: 'liquid' });

  assert.ok(au.metallic >= 0.9 && au.f0Rgb[0] > au.f0Rgb[2] + 0.25, `Gold must show warm relativistic metallic F0: ${JSON.stringify(au)}`);
  assert.ok(cu.metallic >= 0.9 && cu.f0Rgb[0] > cu.f0Rgb[1] + 0.15, `Copper must show rose-copper F0: ${JSON.stringify(cu)}`);
  assert.ok(ag.metallic >= 0.9 && ag.f0Rgb[1] > 0.85, `Silver must show high broadband conductor F0: ${JSON.stringify(ag)}`);
  assert.ok(fe.metallic >= 0.9, `Iron must be metallic: ${JSON.stringify(fe)}`);
  assert.equal(ne.metallic, 0, 'Neon must be dielectric');
  assert.equal(liveWater.metallic, 0, 'Water must be dielectric');
  assert.ok(Math.abs(liveWater.f0Rgb[1] - 0.0204) < 0.005, `Water dielectric F0 should match ((1.333-1)/(1.333+1))^2 ~ 0.0204, got ${liveWater.f0Rgb[1]}`);

  const metalAst = resolvePlanetarySurfacePbrOptics({ surfZ: 26, feFrac: 0.75, silicateFrac: 0.25, isMetallicAsteroid: true });
  const icyWorld = resolvePlanetarySurfacePbrOptics({ surfZ: 8, feFrac: 0.05, silicateFrac: 0.25, volatileFrac: 0.70, isIcy: true });
  assert.ok(metalAst.metallic > icyWorld.metallic + 0.5, 'Metallic Fe-Ni asteroid must have far higher metallicity than icy world');
});

test('All four ULG WebGPU renderer engines use Cook-Torrance GGX + Fresnel PBR', () => {
  const studioWgsl = fs.readFileSync('src/visualization/nativeSurfaceMaterialWgsl.js', 'utf8');
  assert.match(studioWgsl, /complex_normal_fresnel_rgb/);
  assert.match(studioWgsl, /GGX/);

  for (const file of [
    'src/demos/ulgUniversesRenderer.js',
    'src/demos/elementsLabWebGpuRenderer.js',
    'src/demos/chemBioWebGpuRenderer.js'
  ]) {
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, /ULG_MATERIAL_PBR_WGSL/, `${file} must import and embed ULG_MATERIAL_PBR_WGSL`);
    assert.match(src, /ulg_pbr_direct|ulg_d_ggx/, `${file} must evaluate Cook-Torrance GGX PBR`);
  }
});

test('Wave D1 dogfooding invariants: non-noble metals F0, solvent IOR, 118-element organic graph, and real SphereInstance PBR upload', () => {
  // 1. Non-noble transition/alkali/post-transition metals get true Gate-1 metallic F0 > 0.50 (not crushed to 0.35!)
  for (const z of [26, 22, 13, 28, 74, 78, 11, 55]) {
    const opt = resolveElementPbrOptics(z, { surfaceFinish: 'crystal' });
    assert.ok(opt.metallic >= 0.85, `Z=${z} must be metallic: ${JSON.stringify(opt)}`);
    const peakF0 = Math.max(opt.f0Rgb[0], opt.f0Rgb[1], opt.f0Rgb[2]);
    assert.ok(peakF0 > 0.50, `Z=${z} must have true Gate-1 metallic peak F0 > 0.50, got ${JSON.stringify(opt.f0Rgb)} (${opt.source})`);
  }
  // Specifically verify Iron (26) green reflectance & golden Cesium (55) red>blue plasmonic dispersion
  const feOpt = resolveElementPbrOptics(26, { surfaceFinish: 'crystal' });
  const csOpt = resolveElementPbrOptics(55, { surfaceFinish: 'crystal' });
  assert.ok(feOpt.f0Rgb[1] > 0.75, `Fe(26) green F0 should exceed 0.75, got ${feOpt.f0Rgb[1]}`);
  assert.ok(csOpt.f0Rgb[0] > csOpt.f0Rgb[2], `Cs(55) should show warm red>blue plasmonic F0, got ${JSON.stringify(csOpt.f0Rgb)}`);

  // 2. Compound PBR & solvent IOR derivation
  const h2o = resolveCompoundPbrOptics('H2O', { phase: 'liquid', surfaceFinish: 'liquid' });
  const sio2 = resolveCompoundPbrOptics('SiO2', { phase: 'solid', surfaceFinish: 'crystal' });
  assert.equal(h2o.metallic, 0, 'H2O compound must be dielectric');
  assert.equal(sio2.metallic, 0, 'SiO2 compound must be dielectric');
  assert.equal(resolveSolventIor('H2O'), 1.333);
  assert.equal(resolveSolventIor('CH4'), 1.29);
  assert.equal(resolveSolventIor('NH3'), 1.325);
  assert.equal(resolveSolventIor('H2SO4'), 1.43);

  // 3. Shared 120-element GPU PBR LUT
  const lut = buildElementPbrLutFloats();
  assert.equal(lut.length, 120 * 8);
  assert.ok(lut[26 * 8 + 3] >= 0.85 && lut[26 * 8 + 1] > 0.50, 'LUT Fe(26) must carry metallic F0 > 0.50');
  assert.equal(lut[8 * 8 + 3], 0, 'LUT O(8) must be dielectric');

  // 4. All 118 elements in getOrganicElementPhysics (zero 105-element collapse!)
  const distinctRadii = new Set();
  for (let z = 1; z <= 118; z += 1) {
    const p = getOrganicElementPhysics(z);
    assert.ok(Number.isFinite(p.massU) && Math.abs(p.massU - ATOMIC_MASS_U[z - 1]) < 0.2, `Z=${z} massU ${p.massU} vs canonical ${ATOMIC_MASS_U[z - 1]}`);
    distinctRadii.add(p.rCovA);
  }
  assert.ok(distinctRadii.size >= 25, `Expected >= 25 distinct covalent radii across Z=1..118, got ${distinctRadii.size}`);
  assert.equal(getOrganicElementPhysics(54).valence, 0, 'Xe (Z=54) must be noble valence 0');
  assert.ok(getOrganicElementPhysics(22).valence >= 2, 'Ti (Z=22) must derive transition valence >= 2');
  assert.ok(getOrganicElementPhysics(79).rCovA > getOrganicElementPhysics(6).rCovA + 0.5, 'Au (Z=79) must be larger than C (Z=6)');

  // 5. Real Solar System catalog pbrOptics & SphereInstance shader consumption (zero c_sat hack!)
  const psyche = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'psyche');
  const titan = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'titan');
  assert.ok(psyche?.pbrOptics && psyche.pbrOptics.metallic > 0.65, '16 Psyche must carry metallic pbrOptics');
  assert.ok(titan?.pbrOptics && Math.abs(titan.pbrOptics.oceanIor - 1.29) < 1e-3, 'Titan must carry methane oceanIor=1.29');

  const uvRendererSrc = fs.readFileSync('src/demos/ulgUniversesRenderer.js', 'utf8');
  assert.ok(!uvRendererSrc.includes('let c_sat ='), 'LIT_SPHERE_WGSL must not guess metallicity from RGB saturation');
  assert.match(uvRendererSrc, /pbr0:\s*vec4<f32>/, 'SphereInstance must include pbr0');
  assert.match(uvRendererSrc, /surf_pbr:\s*vec4<f32>/, 'CameraUniforms must include surf_pbr');
  assert.match(uvRendererSrc, /pow\(max\(col,\s*vec3<f32>\(0\.0\)\),\s*vec3<f32>\(1\.0 \/ 2\.2\)\)/, 'POST_WGSL must apply sRGB gamma encode after ACES');

  const studioWgsl = fs.readFileSync('src/visualization/nativeSurfaceMaterialWgsl.js', 'utf8');
  assert.match(studioWgsl, /let spec_nk = spectral_complex_index_rgb/, 'Studio nativeSurfaceMaterialWgsl must invoke spectral_complex_index_rgb');
  assert.match(studioWgsl, /complex_normal_fresnel_rgb\(spec_nk\.n_rgb/, 'Studio nativeSurfaceMaterialWgsl must wire complex_normal_fresnel_rgb into conductor F0');
});
