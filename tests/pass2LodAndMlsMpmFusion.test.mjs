// Host Unit & Structural Verification for Pass 2 Full-Stack Deep Visual LOD,
// L0 Physical FLRW Big Bang Expansion, L3 3D GPU MLS-MPM Stellar Fusion & Control Hardening.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildStellarMlsMpmInitialParcels,
  stellarMlsMpmFusionWgsl,
  ULG_STELLAR_MLS_MPM_FUSION_SCHEMA
} from '../src/runtime/astrophysics/stellarMlsMpmFusionGpu.js';
import { formatPhysicalSpan, LOG10_SPAN_MAX } from '../src/demos/ulgUniversesDocs.js';
import {
  deriveGalaxyEnvironmentFromCosmicContext,
  deriveStarSystemFromGalacticLocation
} from '../src/runtime/astrophysics/causalNebularSystemGenerator.js';
import {
  buildLiveSurfaceCelestialSky,
  sampleOrbitalBodySurfaceAtNormal
} from '../src/runtime/astrophysics/surfaceCelestialSkyAndSeasons.js';
import {
  buildLifeLabXenobiologyUrl,
  parseXenobiologyFromSearch,
  synthesizeAbductedSpecimenRecord
} from '../src/runtime/biology/xenobiologySynthesizer.js';
import { traceEmergent3dBFieldStreamlines } from '../src/runtime/astrophysics/emergentMhdDynamoGpu.js';
import { REAL_SOLAR_SYSTEM_CATALOG } from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';

test('Stellar 3D GPU MLS-MPM Fusion initial parcels obey radial hydrostatic thermal gradient & exact X_H+X_He+X_Z=1', () => {
  const count = 4096;
  const rStar = 5.2;
  const data = buildStellarMlsMpmInitialParcels({
    count,
    starMassSolar: 1.0,
    rStar,
    coreTempK: 1.56e7,
    surfaceTempK: 5778,
    seed: 1337
  });
  assert.equal(data.length, count * 16, 'Must emit exact 64-byte (16 float) HydroParticle stride');
  let coreSumT = 0; let coreN = 0;
  let surfSumT = 0; let surfN = 0;
  let totalMass = 0;
  for (let i = 0; i < count; i += 1) {
    const o = i * 16;
    for (let k = 0; k < 16; k += 1) {
      assert.ok(Number.isFinite(data[o + k]), `Particle ${i} field ${k} must be finite`);
    }
    const r = Math.hypot(data[o + 0], data[o + 1], data[o + 2]);
    assert.ok(r <= rStar + 1e-4, `Particle radius ${r} must be <= rStar`);
    totalMass += data[o + 3];
    const T = Math.pow(10, data[o + 8]);
    const xH = data[o + 10];
    const xHe = data[o + 14];
    const xCno = data[o + 15];
    const xAlphaFe = data[o + 12];
    const xZ = xCno + xAlphaFe;
    assert.ok(Math.abs((xH + xHe + xZ) - 1.0) < 1e-5, `Mass fractions must sum to 1 (got ${xH + xHe + xZ})`);
    if (r < rStar * 0.25) { coreSumT += T; coreN += 1; }
    if (r > rStar * 0.85) { surfSumT += T; surfN += 1; }
  }
  assert.ok(Math.abs(totalMass - 100.0) < 1e-3, `Total sim mass should conserve 100.0 (got ${totalMass})`);
  assert.ok(coreN > 100 && surfN > 100);
  const coreMeanT = coreSumT / coreN;
  const surfMeanT = surfSumT / surfN;
  assert.ok(coreMeanT > 8.0e6, `Core temperature must exceed 8 MK for fusion ignition (got ${coreMeanT})`);
  assert.ok(surfMeanT < 5.0e5, `Outer photospheric shell must be cool relative to core (got ${surfMeanT})`);
  assert.ok(coreMeanT > surfMeanT * 20, 'Strong radial temperature gradient required for Rayleigh-Benard convection');
});

test('Stellar MLS-MPM Fusion WGSL obeys Star Spec zero @workgroup_size(1), zero reserved meta, & uses canonical SS multipole gravity', () => {
  assert.equal(ULG_STELLAR_MLS_MPM_FUSION_SCHEMA, 'ulg.astrophysics.stellar-mls-mpm-fusion-webgpu.v1');
  assert.ok(!/@workgroup_size\s*\(\s*1\s*\)/.test(stellarMlsMpmFusionWgsl), 'Zero @workgroup_size(1) serial bottlenecks');
  assert.ok(!/\bmeta\b/.test(stellarMlsMpmFusionWgsl), 'Must never use WGSL reserved keyword meta');
  for (const ep of ['clear_mpm_grid', 'p2g_stellar_mpm', 'grid_eos_burn', 'grid_momentum_step', 'g2p_advect_burn']) {
    assert.ok(stellarMlsMpmFusionWgsl.includes(`fn ${ep}(`), `Missing MLS-MPM kernel entryPoint ${ep}`);
  }
  assert.ok(stellarMlsMpmFusionWgsl.includes('ss_grav_acc'), 'Stellar MLS-MPM must consume canonical Schroeder Scale-Atlas multipole gravity');
});

test('Pass 2 Deep Visual LOD & P0 Control Contracts across Nuclear, Elements, Universes, Organic & Life Labs', async () => {
  const [nucSrc, elRenSrc, elDemoSrc, cbRenSrc, lifeHtml, lifeDemoSrc, orgDemoSrc, uvRenSrc, uvDemoSrc] = await Promise.all([
    readFile(new URL('../src/runtime/nuclear/nuclearStructureGpu.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/demos/elementsLabWebGpuRenderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/demos/elementsLabDemo.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/demos/chemBioWebGpuRenderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../life-lab.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/demos/lifeLabDemo.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/demos/organicLabDemo.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/demos/ulgUniversesRenderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/demos/ulgUniversesDemo.js', import.meta.url), 'utf8')
  ]);

  // Continuous C^infinity Cassini-oval fission (no abrupt beta <= 0.98 jump!)
  assert.ok(!nucSrc.includes('u.beta <= 0.98'), 'Abrupt beta <= 0.98 fission jump must remain retired');
  assert.ok(nucSrc.includes('prompt_n') && nucSrc.includes('neck_glow'), 'Prompt scission neutron burst & neck glow must be present in FISSION_VOLUME_WGSL');

  // Elements Lab: cam_dist zoom uniform + 3D polytope ray-plane intersection + non-destructive #ctrl-lambda
  assert.ok(elRenSrc.includes('cam_dist: f32'), 'VOLUME_RAYMARCH_WGSL must accept cam_dist uniform for working 3D zoom');
  assert.ok(elRenSrc.includes('n_iso'), 'VOLUME_RAYMARCH_WGSL must compute finite-difference gradient normals');
  assert.ok(elDemoSrc.includes("polytopeViewMode === '3d-surface'"), '3D Polytope click probe must use 3D inverse projection');

  // ChemBio Renderer: 2-pass Kawase HDR Bloom + alpha-blended bonds + analytical frag_depth impostors + vesicle cutaway
  assert.ok(cbRenSrc.includes('BLOOM_WGSL'), 'ChemBio renderer must include 2-pass Kawase HDR bloom');
  assert.ok(cbRenSrc.includes('hdrAlphaTarget'), 'orgBondPipe must use alpha blending for translucent H-bonds & vdW contacts');
  assert.ok(cbRenSrc.includes('@builtin(frag_depth)'), 'ORG_ATOM_WGSL / BIO_BEAD_WGSL must write analytical ray-sphere frag_depth');
  assert.ok(lifeHtml.includes('id="sl-mem-clip"'), 'life-lab.html must expose interactive vesicle cutaway slider #sl-mem-clip');

  // Async mode-switch race guard in both labs
  assert.ok(lifeDemoSrc.includes('modeSwitchToken'), 'lifeLabDemo.js must guard async selectMode with monotonic token');
  assert.ok(orgDemoSrc.includes('modeSwitchToken'), 'organicLabDemo.js must guard async selectMode with monotonic token');

  // Universes: physical Big Bang metric expansion + L0/L1/L3/L5/L7 LOD + stereo IPD + input hardening
  assert.ok(uvRenSrc.includes('a_expand'), 'PARTICLE_CLOUD_WGSL Mode 0 must apply physical FLRW metric expansion a_expand');
  assert.ok(uvRenSrc.includes('LOG_DEPTH_INV_FAR'), 'ulgUniversesRenderer.js must implement unified reversed logarithmic depth buffer');
  assert.ok(uvRenSrc.includes('gal_star_hash'), 'PARTICLE_CLOUD_WGSL Mode 1 must render deterministic EM-bright blinking pulsars & X-ray binaries');
  assert.ok(uvDemoSrc.includes('cosmoBigBangMode'), 'ulgUniversesDemo.js must expose cosmoBigBangMode & wire Big Bang expansion');
  assert.ok(uvDemoSrc.includes('stellarConvectiveRmsVel'), 'ulgUniversesDemo.js must expose L3 MLS-MPM stellar fusion telemetry');
  assert.ok(uvDemoSrc.includes('getSolarReferenceOriginAu'), 'ulgUniversesDemo.js must use barycentric solar reference frame on L2');
  assert.ok(uvDemoSrc.includes('pointercancel'), 'ulgUniversesDemo.js must clean up pointer state on pointercancel');
});

test('Observable Universe (93 Gly), Dressler Morphology Diversity & Astrophysics-Grounded Star/Nebula Coupling', () => {
  assert.ok(LOG10_SPAN_MAX >= 26.9, `Observable Universe LOG10_SPAN_MAX must cover 93 Gly (got ${LOG10_SPAN_MAX})`);
  const span93 = formatPhysicalSpan(26.944);
  assert.ok(span93.includes('Gly') && Number.parseFloat(span93) >= 90, `Expected ~93 Gly span label (got ${span93})`);

  // Dressler (1980) Morphology-Density Sequence must span Ellipticals, Globulars, Mergers, Spirals, Barred & Dwarfs
  const morphs = new Set();
  const epochNow = { eraId: 'present-day', redshiftZ: 0.0, cosmicAgeGyr: 13.8 };
  for (let i = 0; i < 60; i += 1) {
    const delta = [0.3, 0.55, 1.0, 1.45, 2.6, 3.8][i % 6];
    const env = deriveGalaxyEnvironmentFromCosmicContext({
      cosmicEpoch: epochNow,
      regionPosMpc: [i * 117.3 - 3000, (i % 7) * 210, i * 83.1 - 2400],
      localOverdensity: delta,
      seed: 1337 + i * 17
    });
    morphs.add(env.morphology);
  }
  for (const m of ['sphere', 'globular', 'disk', 'barred', 'binary', 'dwarf-stream']) {
    assert.ok(morphs.has(m), `Dressler sequence must produce galaxy morphology '${m}' (got ${[...morphs].join(', ')})`);
  }

  // Quenched Giant Elliptical / Globular Cluster MUST NOT spawn young gas-rich H II Pillars / MHD protostellar nurseries,
  // whereas young Spiral-Arm sites in gas-rich spirals DO produce H II Pillars & MHD Nebulae!
  const ellipEnv = deriveGalaxyEnvironmentFromCosmicContext({
    cosmicEpoch: epochNow,
    regionPosMpc: [120, 40, -90],
    localOverdensity: 4.1,
    seed: 901
  });
  const quenchedEnv = { ...ellipEnv, morphology: 'sphere', gasFraction: 0.04 };
  let quenchedH2 = 0;
  for (let i = 0; i < 40; i += 1) {
    const sys = deriveStarSystemFromGalacticLocation({
      cosmicEpoch: epochNow,
      galaxyEnv: quenchedEnv,
      starPosGal: [1.5 + (i % 5), 0.1, -1.2 + (i % 4)],
      popTag: 0.85,
      starIndex: i + 1,
      seed: 2026 + i * 31
    });
    if (sys.recommendedL3Regime === 'h2-pillars' || sys.recommendedL3Regime === 'nebular-mhd') quenchedH2 += 1;
  }
  assert.equal(quenchedH2, 0, 'Gas-poor Ellipticals must never spawn H II Pillars or MHD protostellar nebulae');

  const spiralEnv = { ...ellipEnv, morphology: 'disk', gasFraction: 0.32 };
  const spiralRegimes = new Set();
  for (let i = 0; i < 120; i += 1) {
    const sys = deriveStarSystemFromGalacticLocation({
      cosmicEpoch: epochNow,
      galaxyEnv: spiralEnv,
      starPosGal: [2.8 + (i % 6) * 0.4, 0.05, -2.1 + (i % 5) * 0.3],
      popTag: 0.90,
      starIndex: i + 1,
      seed: 5555 + i * 29
    });
    spiralRegimes.add(sys.recommendedL3Regime);
  }
  assert.ok(
    spiralRegimes.has('h2-pillars') || spiralRegimes.has('nebular-mhd'),
    `Gas-rich spiral arms must naturally produce H II Pillars or MHD protostellar nebulae (got ${[...spiralRegimes].join(', ')})`
  );
});

test('Orbital Landing-Site Correspondence, Gas-Giant Horizon/Cloud Occlusion, Tractor Abduction Bio-Lab Roundtrip & Smooth MHD Streamlines', () => {
  // 1. Orbital-to-surface biome & day/night correspondence on Earth
  const earth = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'earth');
  const polarSite = sampleOrbitalBodySurfaceAtNormal([0.05, 0.99, 0.05], earth, 7.81, [1, 0, 0]);
  assert.equal(polarSite.isPolarIce, true, 'Clicking Earth north pole must classify as Polar Ice Cap');
  assert.ok(polarSite.latDeg > 75, `Polar latitude expected > 75 deg (got ${polarSite.latDeg})`);
  const nightSite = sampleOrbitalBodySurfaceAtNormal([-0.98, 0.1, 0.1], earth, 7.81, [1, 0, 0]);
  assert.equal(nightSite.isNightSide, true, 'Clicking anti-solar hemisphere must classify as Night Side');
  // Scan equatorial longitudes to verify both Open Ocean and Continental Land emerge directly from LIT_SPHERE_WGSL fbm5!
  let sawOcean = false; let sawLand = false;
  for (let k = 0; k < 24; k += 1) {
    const a = (k / 24) * Math.PI * 2;
    const s = sampleOrbitalBodySurfaceAtNormal([Math.cos(a), 0.12, Math.sin(a)], earth, 7.81, [1, 0, 0]);
    if (s.isOcean) sawOcean = true;
    if (s.isLush || s.isDesert || s.isMountain || s.isCoast) sawLand = true;
  }
  assert.ok(sawOcean && sawLand, 'Earth orbital fbm5 mirror must resolve both oceans and continents');

  // 2. Gas Giant horizon & dense-cloud optical-depth occlusion (never see planets straight through Jupiter!)
  const jupIdx = REAL_SOLAR_SYSTEM_CATALOG.findIndex((b) => b.id === 'jupiter');
  const mockEngine = {
    massiveCount: REAL_SOLAR_SYSTEM_CATALOG.length,
    getMassiveBodyState64(i) {
      const sp = REAL_SOLAR_SYSTEM_CATALOG[i];
      const a = sp.aAu || 0;
      const th = i * 1.1;
      return { posAu: [Math.cos(th) * a, 0, Math.sin(th) * a], radiusAu: (sp.radiusKm || 1000) / 149597870.7 };
    }
  };
  const deepJupSky = buildLiveSurfaceCelestialSky({
    solarEngine: mockEngine,
    catalog: REAL_SOLAR_SYSTEM_CATALOG,
    focusIdx: jupIdx,
    cameraPos: [0, 14, 0],
    craftPosM: [0, 14, 0],
    env: { hasSolidCrust: false, radiusM: 6.99e7, skyOpticalDepth: 0.96, tempK: 165, pressurePa: 4e5 },
    altitudeKm: 12
  });
  assert.ok(deepJupSky.gasGiantSkyTransmittance < 0.2, `Deep Jupiter cloud deck must attenuate sky (got ${deepJupSky.gasGiantSkyTransmittance})`);
  assert.ok(deepJupSky.spheres.length <= 1, `Deep inside Jupiter clouds, distant planets/below-horizon bodies must be occluded (got ${deepJupSky.spheres.length})`);

  // 3. Abducted Specimen -> Biology Lab URL roundtrip
  const spec = synthesizeAbductedSpecimenRecord({
    kind: 'fauna',
    worldName: 'Titan',
    env: { tempK: 94, pressurePa: 146700, gravityMS2: 1.35, rhoAtmKgM3: 5.3 },
    latDeg: -14.2,
    lonDeg: 48.6,
    seed: 4242
  });
  assert.equal(spec.kind, 'fauna');
  assert.equal(spec.solvent, 'CH4');
  assert.ok(['aero-gasbag', 'wing-glider', 'radial-tentacular'].includes(spec.bodyPlan),
    `Low-g dense-air Titan fauna should emerge with buoyant/gliding morphology (got ${spec.bodyPlan} / ${spec.speciesName})`);
  assert.match(spec.speciesName, /^[A-Z][a-z]+ [a-z]+$/, `Specimen must receive a procedural Latinate binomial (got ${spec.speciesName})`);
  assert.equal(spec.recommendedBioMode, 'organism-overview', 'Abducted specimen must default to interactive 3D Bio Aquarium overview');
  const url = buildLifeLabXenobiologyUrl(spec.profile, spec.recommendedBioMode, spec);
  const parsed = parseXenobiologyFromSearch(url.split('?')[1]);
  assert.equal(parsed?.abductedSpecimen?.speciesName, spec.speciesName);
  assert.equal(parsed?.abductedSpecimen?.fasta, spec.fasta);

  // 4. MHD Dynamo streamline reversal guard prevents crazy odd-even checkerboard zig-zag coils!
  const n = 12;
  const checkerB = new Float32Array(n * n * n * 4);
  for (let z = 0; z < n; z += 1) {
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        const sign = ((x + y + z) & 1) === 0 ? 1 : -1;
        const o = ((z * n + y) * n + x) * 4;
        checkerB[o] = sign * 0.6;
        checkerB[o + 1] = -sign * 0.4;
      }
    }
  }
  const traced = traceEmergent3dBFieldStreamlines({
    bHost: checkerB,
    gridN: n,
    boxSize: 12.0,
    seedPoints: [[0, 0, 0], [2, 0, 2]],
    stepsPerDir: 30,
    stepLen: 0.35,
    refB: 0.25
  });
  assert.ok(traced.length <= 42, `Pure checkerboard noise must be damped/terminated instead of zig-zagging wildly (got ${traced.length} floats)`);

  // 5. Orbiting GPU galaxy star (`starIndex > 0`) MUST keep its exact immutable name & spectral identity as it orbits!
  const epochNow = { eraId: 'present-day', redshiftZ: 0.0, cosmicAgeGyr: 13.8 };
  const galEnv = deriveGalaxyEnvironmentFromCosmicContext({ cosmicEpoch: epochNow, localOverdensity: 1.0, seed: 42 });
  const orbT0 = deriveStarSystemFromGalacticLocation({ cosmicEpoch: epochNow, galaxyEnv: galEnv, starPosGal: [4.2, 0.05, 1.9], popTag: 0.65, starIndex: 19607, seed: 1337 });
  const orbT1 = deriveStarSystemFromGalacticLocation({ cosmicEpoch: epochNow, galaxyEnv: galEnv, starPosGal: [3.9, 0.06, 2.45], popTag: 0.65, starIndex: 19607, seed: 1337 });
  assert.equal(orbT1.systemName, orbT0.systemName, `Orbiting star #19607 must NOT change name while orbiting (${orbT0.systemName} vs ${orbT1.systemName})`);
  assert.equal(orbT1.multiplicity, orbT0.multiplicity, 'Orbiting star multiplicity must remain immutable');

  // 6. Asynchronous 32-bit Murmur3 Pulsar Hashes -> distinct frequencies & uncorrelated phases (zero lockstep blinking!)
  const galHashU32 = (vIn) => {
    let x = vIn >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    return (x & 0x00ffffff) / 16777216.0;
  };
  const pulsarFreqs = [];
  const pulsarPhases = [];
  for (let i = 0; i < 4000 && pulsarFreqs.length < 25; i += 1) {
    if (galHashU32((i >>> 0) ^ 0x13579bdf) > 0.986) {
      pulsarFreqs.push(0.22 * Math.pow(22.0, galHashU32((i >>> 0) ^ 0x9e3779b9)));
      pulsarPhases.push(galHashU32((i >>> 0) ^ 0x517cc1b7) * Math.PI * 2);
    }
  }
  assert.ok(pulsarFreqs.length >= 20, `Expected >= 20 pulsars in 4000 stars (got ${pulsarFreqs.length})`);
  const minF = Math.min(...pulsarFreqs);
  const maxF = Math.max(...pulsarFreqs);
  assert.ok(maxF / minF > 6.0, `Pulsars must span a wide range of spin frequencies (got ${minF.toFixed(2)}..${maxF.toFixed(2)} Hz)`);
  assert.equal(new Set(pulsarPhases.map((p) => p.toFixed(3))).size, pulsarPhases.length, 'Every pulsar must have a unique independent phase');
});
