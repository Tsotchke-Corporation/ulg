import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveGalaxyEnvironmentFromCosmicContext,
  deriveStarSystemFromGalacticLocation,
  synthesizeNebularPlanetarySystem
} from '../src/runtime/astrophysics/causalNebularSystemGenerator.js';
import {
  NEBULAR_RADIAL_BINS,
  extractCoalescedBodiesFromAnnuli
} from '../src/runtime/astrophysics/nebularSystemCoalescenceGpu.js';
import {
  buildInitialPlanetarySphParcels,
  derivePlanetaryGenesisParams,
  evaluatePlanetaryGenesisSphActivation
} from '../src/runtime/astrophysics/planetaryGenesisSphGpu.js';
import {
  deriveSurfaceEnvironmentState,
  evaluatePlanetaryCrustElevation,
  evaluatePlanetaryTerrainHeight
} from '../src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js';
import {
  XENOBIOLOGY_PLANET_PRESETS,
  deriveOrganismTissueLabParameters,
  deriveXenobiologyProfile
} from '../src/runtime/biology/xenobiologySynthesizer.js';
import {
  ULG_COSMIC_LINEAGE_CACHE_SCHEMA,
  buildCosmicLineageKey,
  createCosmicLineageRootCache,
  decodeFloat32Quantized,
  encodeFloat32Quantized
} from '../src/runtime/astrophysics/cosmicLineageRootCache.js';
import {
  sampleOrbitalBodySurfaceAtNormal
} from '../src/runtime/astrophysics/surfaceCelestialSkyAndSeasons.js';
import {
  buildPeerComputeSimulationProfile
} from '../src/runtime/astrophysics/peercomputeSimulationScaler.js';
import {
  STELLAR_MLS_MPM_PROFILES,
  buildStellarMlsMpmInitialParcels
} from '../src/runtime/astrophysics/stellarMlsMpmFusionGpu.js';
import {
  resolveStellarRegimeForStarSpec
} from '../src/runtime/astrophysics/starlightAndExoticOptics.js';

test('Root L0 -> L1 causal galaxy morphology honors GPU halo overdensity & tidal-torque spin lambda', () => {
  const highSpinSpiral = deriveGalaxyEnvironmentFromCosmicContext({
    regionPosMpc: [120, -40, 80],
    localOverdensity: 1.55,
    tidalSpinLambda: 0.095,
    gpuCoalescedHalo: true,
    seed: 20261126
  });
  const lowSpinCluster = deriveGalaxyEnvironmentFromCosmicContext({
    regionPosMpc: [120, -40, 80],
    localOverdensity: 3.8,
    tidalSpinLambda: 0.022,
    gpuCoalescedHalo: true,
    seed: 20261126
  });
  const voidHalo = deriveGalaxyEnvironmentFromCosmicContext({
    regionPosMpc: [-450, 210, 330],
    localOverdensity: 0.45,
    tidalSpinLambda: 0.04,
    gpuCoalescedHalo: true,
    seed: 20261126
  });
  assert.ok(['disk', 'barred'].includes(highSpinSpiral.morphology), `High-spin filament halo should yield spiral (got ${highSpinSpiral.morphology})`);
  assert.ok(['sphere', 'binary'].includes(lowSpinCluster.morphology), `High-overdensity low-spin cluster core should yield elliptical/merger (got ${lowSpinCluster.morphology})`);
  assert.ok(['globular', 'dwarf-stream'].includes(voidHalo.morphology), `Underdense void halo should yield globular/dwarf (got ${voidHalo.morphology})`);
});

test('Whole-star-system GPU nebular annular extraction produces star-luminosity-governed compositions & feeds system catalog', () => {
  const makeSyntheticAnnuli = (starLum) => {
    const f32 = new Float32Array(NEBULAR_RADIAL_BINS * 8);
    const rMin = 0.12;
    const rMax = 28.0;
    const t1Au = 278 * Math.pow(starLum, 0.25);
    for (let b = 0; b < NEBULAR_RADIAL_BINS; b += 1) {
      const u = (b + 0.5) / NEBULAR_RADIAL_BINS;
      const rAu = rMin * Math.pow(rMax / rMin, u);
      const tK = t1Au / Math.sqrt(rAu);
      const isPeak = [8, 19, 31, 44, 56].includes(b);
      const solidM = isPeak ? (tK < 170 ? 85.0 : 42.0) : 10.0;
      const fe = tK > 1100 ? 0.55 : (tK > 170 ? 0.32 : 0.08);
      const sil = tK > 170 ? 0.58 : 0.18;
      const h2o = tK < 170 ? 0.52 : 0.02;
      const svol = tK < 65 ? 0.22 : 0.0;
      const gasEnv = (isPeak && tK < 170) ? 0.62 : 0.0;
      const o = b * 8;
      f32[o + 0] = rAu;
      f32[o + 1] = solidM;
      f32[o + 2] = fe;
      f32[o + 3] = sil;
      f32[o + 4] = 0.08;
      f32[o + 5] = h2o;
      f32[o + 6] = svol;
      f32[o + 7] = gasEnv;
    }
    return f32;
  };

  const hotDisk = extractCoalescedBodiesFromAnnuli(makeSyntheticAnnuli(8.0), { starLuminositySolar: 8.0 });
  const coolDisk = extractCoalescedBodiesFromAnnuli(makeSyntheticAnnuli(0.05), { starLuminositySolar: 0.05 });
  assert.ok(hotDisk.snowLineAu > coolDisk.snowLineAu * 5, `Luminous star snow line (${hotDisk.snowLineAu}) must sit far outside M-dwarf snow line (${coolDisk.snowLineAu})`);
  assert.ok(hotDisk.bodies.length >= 3, 'Expected >= 3 coalesced bodies');
  assert.ok(hotDisk.asteroidZone && hotDisk.cometZone, 'Expected coalesced asteroid and comet zones');

  const starSys = deriveStarSystemFromGalacticLocation({ seed: 123456 });
  const sys = synthesizeNebularPlanetarySystem(starSys, { gpuCoalescedDisk: hotDisk });
  assert.equal(sys.gpuCoalesced, true);
  const planets = sys.catalog.filter((b) => !b.isStar && !b.isMinorBody && b.parent <= 0);
  assert.ok(planets.length >= 3, 'Expected coalesced planets in catalog');
  assert.ok(planets.every((p) => p.coalescedComposition?.gpuCoalesced === true), 'Every coalesced planet must carry GPU coalescedComposition');
  const comet = sys.catalog.find((b) => b.isComet);
  const asteroid = sys.catalog.find((b) => b.isMetallicAsteroid);
  assert.ok(comet?.coalescedComposition?.gpuCoalesced === true && asteroid?.coalescedComposition?.gpuCoalesced === true);
});

test('3D SPH planetary genesis params honor GPU coalesced composition & surface SPH patch overrides r=0m elevation cleanly', () => {
  assert.equal(evaluatePlanetaryGenesisSphActivation({ radiusKm: 6371, isStar: false }).active, true);
  assert.equal(evaluatePlanetaryGenesisSphActivation({ radiusKm: 12, isComet: true, isStar: false }).active, true);
  assert.equal(evaluatePlanetaryGenesisSphActivation({ radiusKm: 69911, isStar: false }).active, false);

  const ironBody = derivePlanetaryGenesisParams({
    radiusKm: 2800, massSolar: 3e-7, tempK: 520, surfacePressurePa: 0,
    coalescedComposition: { feFrac: 0.62, silicateFrac: 0.34, carbonFrac: 0.04, volatileFrac: 0.0 }
  });
  const oceanBody = derivePlanetaryGenesisParams({
    radiusKm: 6400, massSolar: 3.1e-6, tempK: 288, surfacePressurePa: 101325, volatileMassFrac: 0.05,
    coalescedComposition: { feFrac: 0.28, silicateFrac: 0.60, carbonFrac: 0.05, volatileFrac: 0.07 }
  });
  assert.ok(ironBody.feCoreFrac > oceanBody.feCoreFrac, 'GPU-coalesced Fe-rich body must produce larger Fe core parcel fraction');
  assert.ok(oceanBody.hasOcean && oceanBody.hydraulicErosion > ironBody.hydraulicErosion);
  const initParcels = buildInitialPlanetarySphParcels(oceanBody, { parcelCount: 2048 });
  assert.equal(initParcels.parcelCount, 2048);

  // Full-authority SPH coarse height patch right near origin (r = 50 m — previously killed by smoothstep(240, 560)!)
  const baseEnv = deriveSurfaceEnvironmentState({ radiusKm: 6371, tempK: 288, surfacePressurePa: 101325, volatileMassFrac: 0.0 });
  const flatPatch = new Float32Array(4096).fill(0.0);
  const mountainPatch = new Float32Array(4096).fill(0.0);
  for (let j = 0; j < 64; j += 1) {
    for (let i = 0; i < 64; i += 1) {
      // Steep SPH ridge right inside the old 240 m kill-zone!
      mountainPatch[j * 64 + i] = i >= 32 ? 0.95 : 0.0;
    }
  }
  const envFlat = { ...baseEnv, hasSphGeology: true, sphCoarseHeight64: flatPatch, sphSeaLevelNorm: 0, sphPatchSpanM: 14000 };
  const envMtn = { ...baseEnv, hasSphGeology: true, sphCoarseHeight64: mountainPatch, sphSeaLevelNorm: 0, sphPatchSpanM: 14000 };
  const hFlat = evaluatePlanetaryCrustElevation(180, 0, envFlat);
  const hMtn = evaluatePlanetaryTerrainHeight(180, 0, envMtn);
  assert.ok(hMtn > hFlat + 5.0, `SPH geology must drive surface elevation right near origin (r=180m): mtn=${hMtn} vs flat=${hFlat}`);
});

test('Bio Lab derives distinct physical GPU parameters across ALL 5 layers directly from active organism & clicked organ', () => {
  const earthProf = deriveXenobiologyProfile(XENOBIOLOGY_PLANET_PRESETS.find((p) => p.id === 'earth-h2o'));
  const titanProf = deriveXenobiologyProfile(XENOBIOLOGY_PLANET_PRESETS.find((p) => p.id === 'titan-ch4'));
  const acidProf = deriveXenobiologyProfile(XENOBIOLOGY_PLANET_PRESETS.find((p) => p.id === 'venus-h2so4'));

  const earthFauna = earthProf.species.find((s) => s.kingdom === 'fauna');
  const earthFlora = earthProf.species.find((s) => s.kingdom === 'flora');
  const titanFauna = titanProf.species.find((s) => s.kingdom === 'fauna');
  const acidFauna = acidProf.species.find((s) => s.kingdom === 'fauna');

  const pEarthHead = deriveOrganismTissueLabParameters(earthFauna, earthProf, { partId: 'head' });
  const pEarthTorso = deriveOrganismTissueLabParameters(earthFauna, earthProf, { partId: 'torso' });
  const pEarthFlora = deriveOrganismTissueLabParameters(earthFlora, earthProf, { partId: 'canopy' });
  const pTitan = deriveOrganismTissueLabParameters(titanFauna, titanProf, { partId: 'torso' });
  const pAcid = deriveOrganismTissueLabParameters(acidFauna, acidProf, { partId: 'torso' });

  // Different organisms & worlds produce genuinely distinct physics across ALL 5 layers
  assert.ok(pTitan.memTempK < 130 && pAcid.memTempK > 300, `Membrane T must follow organism (${pTitan.memTempK} K vs ${pAcid.memTempK} K)`);
  assert.notEqual(pEarthHead.foldSeq, pEarthTorso.foldSeq, 'Different organs of the same organism must yield distinct tissue protein sequences');
  assert.notEqual(pEarthHead.proteinName, pEarthFlora.proteinName);
  assert.ok(pEarthHead.hhGNa > pEarthFlora.hhGNa, `Motile fauna neural g_Na (${pEarthHead.hhGNa}) must exceed sessile flora (${pEarthFlora.hhGNa})`);
  assert.ok(pEarthHead.morphV0 > pEarthFlora.morphV0, `Motile fauna v0 (${pEarthHead.morphV0}) must exceed sessile flora (${pEarthFlora.morphV0})`);
  assert.ok(pAcid.evoStrongFrac !== pTitan.evoStrongFrac, 'XNA duplex stability fraction must respond to organism temperature & alphabet');

  // True bottom-up environmental molecular biochemistry (ZERO tinted Earth clones!)
  assert.equal(pEarthTorso.solventPolarity, 1.0, 'Earth H2O must have polar solventPolarity = +1');
  assert.equal(pTitan.solventPolarity, -1.0, 'Titan CH4 must invert to nonpolar solventPolarity = -1');
  assert.ok(pTitan.bjerrumLengthA > pEarthTorso.bjerrumLengthA * 50, `Titan low-eps Bjerrum length (${pTitan.bjerrumLengthA} A) must dwarf Earth (${pEarthTorso.bjerrumLengthA} A)`);
  assert.ok(pTitan.tDenatureK < 180 && pAcid.tDenatureK > 420, `Denaturation T must scale to organism chemistry (Titan ${pTitan.tDenatureK}K vs Acid ${pAcid.tDenatureK}K)`);
  assert.ok(pTitan.xnaTargetTmK < 145 && pEarthTorso.xnaTargetTmK > 315 && pAcid.xnaTargetTmK > 365, 'XNA duplex melting T_m must sit above each world habitat T');
  assert.ok(pTitan.energyCurrencyKjMol < 25 && pEarthTorso.energyCurrencyKjMol > 42, 'Energy currency DeltaG must scale to thermal budget kBT');
  assert.notEqual(pEarthTorso.molecules['bio-mol-membrane'].formula, pTitan.molecules['bio-mol-membrane'].formula, 'Earth vs Titan membrane monomers must have genuinely distinct atomic formulas');
  assert.notEqual(pEarthTorso.molecules['bio-mol-membrane'].formula, pAcid.molecules['bio-mol-membrane'].formula, 'Earth vs Venus acid membrane monomers must have distinct atomic formulas');
  assert.notEqual(pEarthTorso.molecules['bio-mol-energy'].formula, pTitan.molecules['bio-mol-energy'].formula, 'Earth vs Titan metabolic energy cofactors must have distinct atomic formulas');
  assert.ok(pEarthTorso.molecules['bio-mol-membrane'].formula.includes('P'), 'Earth phospholipid must contain Phosphorus (P)');
  assert.ok(pTitan.molecules['bio-mol-membrane'].formula.includes('N') && !pTitan.molecules['bio-mol-membrane'].formula.includes('P'), 'Titan azotosome must use Nitrile/Amine (N) with zero Phosphorus');
  assert.ok(pAcid.molecules['bio-mol-membrane'].formula.includes('S'), 'Venus H2SO4 acidophile amphiphile must contain Sulfur (S)');
  const europaProf = deriveXenobiologyProfile(XENOBIOLOGY_PLANET_PRESETS.find((p) => p.id === 'europa-vent'));
  const pEuropa = deriveOrganismTissueLabParameters(europaProf.species[0], europaProf);
  assert.equal(pEuropa.isMonolayer, true, 'High-pressure subsurface brine must select bipolar tetraether monolayer');
  assert.ok(pEuropa.molecules['bio-mol-energy'].formula.includes('Fe') && pEuropa.molecules['bio-mol-energy'].formula.includes('S'), 'Hydrothermal Europa cofactor must synthesize [Fe2S2] ferredoxin');
});

test('Root Cosmic Lineage Cache stores, quantizes, hits, bypasses on replay, and ingests PeerCompute P2P artifacts', async () => {
  const published = [];
  const cache = createCosmicLineageRootCache({
    backend: 'memory',
    onPublishToPeers: (entry) => published.push(entry)
  });

  const key = buildCosmicLineageKey('l2-nebular', {
    seed: 20261126,
    epochId: 'present-day',
    galaxyKey: 42,
    starKey: 'star_7'
  });
  assert.equal(await cache.get(key), null);
  assert.equal(cache.getStats().misses, 1);

  const okWrite = await cache.set(key, { snowLineAu: 2.74, bodies: [{ aAu: 1.0, feFrac: 0.32 }] });
  assert.equal(okWrite, true);
  assert.equal(published.length, 1);
  assert.equal(cache.getStats().peerBroadcasts, 1);

  const hit = await cache.get(key);
  assert.equal(hit?.snowLineAu, 2.74);
  assert.equal(cache.getStats().hits, 1);
  assert.equal(cache.getStats().lastSource, 'root-cache-hit');

  // Explicit user replay bypasses cache cleanly
  assert.equal(await cache.get(key, { bypassCache: true }), null);
  assert.equal(cache.getStats().lastSource, 'bypassed');

  // Compact Int16 quantization round-trip accuracy for spherical RGBA32F SPH geology maps
  const srcGeo = new Float32Array([-1.0, -0.425, 0.0, 0.3125, 0.875, 1.0, 2.5, -2.5]);
  const packed = encodeFloat32Quantized(srcGeo, 8000.0);
  const decoded = decodeFloat32Quantized(packed);
  assert.equal(decoded.length, srcGeo.length);
  for (let i = 0; i < srcGeo.length; i += 1) {
    assert.ok(Math.abs(decoded[i] - srcGeo[i]) < 2e-4, `Quantization error too high at ${i}: ${decoded[i]} vs ${srcGeo[i]}`);
  }

  // PeerCompute P2P peer ingestion into a second peer's root cache avoids redundant GPU simulation
  const peerCache = createCosmicLineageRootCache({ backend: 'memory' });
  const ingested = await peerCache.ingestPeerEntry({
    schema: ULG_COSMIC_LINEAGE_CACHE_SCHEMA,
    key,
    payload: published[0].payload,
    storedAtMs: Date.now()
  });
  assert.equal(ingested, true);
  const peerHit = await peerCache.get(key);
  assert.equal(peerHit?.snowLineAu, 2.74);
  assert.equal(peerCache.getStats().peerIngests, 1);
  assert.equal(peerCache.getStats().lastSource, 'peer-cache-hit');

  // Fail-closed rejection of mismatched schema
  const rejected = await peerCache.ingestPeerEntry({ schema: 'bad-schema', key: 'k2', payload: { x: 1 } });
  assert.equal(rejected, false);
  assert.equal(cache.peek(key)?.hit, true, 'peek() must synchronously detect cached root artifacts');
  assert.equal(cache.peek('unsimulated-key'), null, 'peek() must return null for unsimulated entities');
});

test('Orbital globe click reads live SPH geology snapshot 1-to-1 with zero Perlin seaLevelOffsetM', () => {
  const w = 16;
  const h = 8;
  const data = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const o = (y * w + x) * 4;
      // Western hemisphere = deep SPH ocean (-0.55), Eastern hemisphere = elevated SPH mountain continent (+0.65)
      const isEast = x >= w / 2;
      data[o + 0] = isEast ? 0.65 : -0.55;
      data[o + 1] = isEast ? 0.80 : 0.05;
      data[o + 2] = 0.15;
      data[o + 3] = isEast ? 0.60 : 1.0;
    }
  }
  const snap = { data, width: w, height: h, seaLevelNorm: 0.05, hasOcean: true, isMagmaOcean: false };
  const earthSpec = { radiusKm: 6371, color1: [0.06, 0.26, 0.58], atm: 0.72 };
  const oceanClick = sampleOrbitalBodySurfaceAtNormal([0, 0, -1], earthSpec, 7.81, [1, 0, 0], snap);
  const mtnClick = sampleOrbitalBodySurfaceAtNormal([0, 0, 1], earthSpec, 7.81, [1, 0, 0], snap);
  assert.equal(oceanClick.sphSampled, true);
  assert.equal(oceanClick.isOcean, true, `Expected SPH ocean click (got ${oceanClick.biomeLabel})`);
  assert.equal(oceanClick.seaLevelOffsetM, 0);
  assert.equal(mtnClick.sphSampled, true);
  assert.equal(mtnClick.isMountain, true, `Expected SPH mountain click (got ${mtnClick.biomeLabel})`);
  assert.equal(mtnClick.seaLevelOffsetM, 0);
});

test('PeerCompute capability scaler scales SPH/nebular/stellar workloads across device tiers and clamps strictly to GPU limits', () => {
  const mobile = buildPeerComputeSimulationProfile({
    tier: 'mobile',
    cpu: { cores: 4 },
    memory: { deviceMemoryGiB: 4 },
    environment: { os: 'android' },
    webgpu: { available: true, isFallbackAdapter: false, limits: { maxStorageBufferBindingSize: 128 * 1024 * 1024 } }
  });
  const laptop = buildPeerComputeSimulationProfile({
    tier: 'laptop',
    cpu: { cores: 8 },
    memory: { deviceMemoryGiB: 8 },
    environment: { os: 'linux' },
    webgpu: { available: true, isFallbackAdapter: false, limits: { maxStorageBufferBindingSize: 256 * 1024 * 1024 } }
  });
  const workstation = buildPeerComputeSimulationProfile({
    tier: 'workstation',
    cpu: { cores: 16 },
    memory: { deviceMemoryGiB: 32 },
    environment: { os: 'linux' },
    webgpu: { available: true, isFallbackAdapter: false, limits: { maxStorageBufferBindingSize: 1024 * 1024 * 1024 } }
  });
  const cluster = buildPeerComputeSimulationProfile({
    tier: 'cluster',
    cpu: { cores: 32 },
    memory: { deviceMemoryGiB: 64 },
    environment: { os: 'linux' },
    webgpu: { available: true, isFallbackAdapter: false, limits: { maxStorageBufferBindingSize: 2048 * 1024 * 1024 } }
  });

  assert.equal(mobile.tier, 'mobile');
  assert.equal(workstation.tier, 'workstation');
  assert.ok(mobile.workloads.sphParcels < laptop.workloads.sphParcels, 'Laptop SPH parcels must scale above mobile');
  assert.ok(laptop.workloads.sphParcels < workstation.workloads.sphParcels, 'Workstation SPH parcels must scale above laptop');
  assert.ok(workstation.workloads.sphParcels <= cluster.workloads.sphParcels, 'Cluster SPH parcels must be >= workstation');
  assert.ok(workstation.workloads.sphGridN > mobile.workloads.sphGridN, 'Workstation 3D SPH grid must scale above mobile');
  assert.ok(workstation.workloads.sphMapWidth >= 768 && workstation.workloads.sphMapWidth > mobile.workloads.sphMapWidth);
  assert.ok(workstation.workloads.l4TargetSteps > mobile.workloads.l4TargetSteps, 'Desktop coalescence must allow richer longer live formation');
  assert.ok(workstation.workloads.stellarParcels > mobile.workloads.stellarParcels);

  // Strict hardware limit clamping: even on manual ULTRA, tiny maxStorageBufferBindingSize must clamp buffers safely!
  const tinyLimit = buildPeerComputeSimulationProfile(
    { tier: 'workstation', cpu: { cores: 16 }, webgpu: { available: true, limits: { maxStorageBufferBindingSize: 8 * 1024 * 1024 } } },
    { qualityMode: 'ultra' }
  );
  assert.ok(tinyLimit.workloads.sphGridN * tinyLimit.workloads.sphGridN * tinyLimit.workloads.sphGridN * 64 <= 8 * 1024 * 1024);
});

test('First-Gen Pop III (Z=0) and Second-Gen Pop II (alpha-rich) stellar mechanics profiles & causal routing are distinct', () => {
  const pop3 = STELLAR_MLS_MPM_PROFILES['pop3-first-gen'];
  const pop2 = STELLAR_MLS_MPM_PROFILES['pop2-second-gen'];
  const pop1 = STELLAR_MLS_MPM_PROFILES['main-sequence-star'];

  assert.equal(pop3.generation, 1);
  assert.equal(pop3.xCno0, 0, '1st-Gen Pop III must start with strictly zero primordial CNO metals');
  assert.equal(pop3.xAlphaFe0, 0, '1st-Gen Pop III must start with strictly zero primordial alpha/Fe metals');
  assert.ok(pop3.coreTempK > 1.0e8, '1st-Gen Pop III core must contract above 100 MK to ignite triple-alpha');

  assert.equal(pop2.generation, 2);
  assert.ok(pop2.xCno0 > 0 && pop2.xCno0 < pop1.xCno0 * 0.2, '2nd-Gen Pop II must carry trace Pop III CNO metals');
  assert.ok(pop2.xAlphaFe0 > 0 && pop2.xAlphaFe0 < pop1.xAlphaFe0 * 0.2);

  // Verify initial parcel seeding carries exact zero CNO on Pop III
  const init3 = buildStellarMlsMpmInitialParcels({ count: 512, stellarClass: 'pop3-first-gen', seed: 42 });
  let maxCno3 = 0;
  for (let i = 0; i < 512; i += 1) maxCno3 = Math.max(maxCno3, init3[i * 16 + 15]);
  assert.equal(maxCno3, 0, 'Every Pop III initial parcel must start with xCNO === 0');

  // Verify causal star spec routing maps stellarGeneration 1 -> pop3-first-gen and 2 -> pop2-second-gen
  const r1 = resolveStellarRegimeForStarSpec({ isStar: true, stellarGeneration: 1, spectralType: 'PopIII-O', tempK: 75000, massSolar: 55 });
  const r2 = resolveStellarRegimeForStarSpec({ isStar: true, stellarGeneration: 2, spectralType: 'A4V', tempK: 9200, massSolar: 3.8 });
  assert.equal(r1.stellarMode, 'fusion');
  assert.equal(r1.stellarPreset, 'pop3-first-gen');
  assert.equal(r2.stellarMode, 'fusion');
  assert.equal(r2.stellarPreset, 'pop2-second-gen');
});
