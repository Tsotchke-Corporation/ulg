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
});
