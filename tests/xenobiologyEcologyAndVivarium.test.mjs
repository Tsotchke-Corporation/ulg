// Host-side Verification Suite for Phase B:
//   - 2024-2025 Peer-Reviewed Xenobiology & Ecosystem Engine (xenobiologyEcologyEngine.js)
//   - 7 Bains-Petkowski-Seager (2024) Solvents (incl. scCO2, NH3, CH4 cryomineral caution, H2SO4, H2O-subsurface, H2-He-cloud)
//   - Kiang/Lehmer/Schwieterman/Takizawa 2/3/4-Photon Photobiology & Spectral Absorption
//   - NutMEG Thermodynamic Redox Bioenergetics, 4-12-base XNA, Kleiber/Euler/Bergmann/Allen Allometry
//   - Multi-World Phylogenetic Diversity (Flora + Fungi + Fauna, zero mushroom-cap trees)
//   - 17 Procedural 3D Articulated Body Plans & Interactive Bio-Lab Specimen Aquarium / Vivarium (6 Tools!)

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  XENOBIOLOGY_ECOLOGY_LAW_ADAPTER,
  classifySolventBains2024,
  deriveRedoxAndBiosignatures,
  evaluateXenobiologyEcologyActivation,
  solvePhotobiologySpectrum,
  synthesizeWorldEcosystem
} from '../src/runtime/biology/xenobiologyEcologyEngine.js';
import {
  BODY_PLAN_IDS,
  appendProceduralOrganismGeometry,
  createVivariumOrganismController
} from '../src/runtime/biology/xenobiologyAnatomyMesh.js';
import {
  XENOBIOLOGY_PLANET_PRESETS,
  buildLifeLabXenobiologyUrl,
  deriveXenobiologyProfile,
  parseXenobiologyFromSearch,
  synthesizeAbductedSpecimenRecord
} from '../src/runtime/biology/xenobiologySynthesizer.js';
import {
  SURFACE_FLORA_LAW_ADAPTER,
  buildFloraTemplateMeshFloats
} from '../src/runtime/astrophysics/surfaceFloraPlacementGpu.js';
import { LAW_SPATIAL_AUTHORITIES } from '../src/runtime/sph/lawAdapterContract.js';

test('Phase B1: Bains-Petkowski-Seager (2024) 7-solvent classifier handles every astrobiological solvent regime', () => {
  const h2o = classifySolventBains2024({ tempK: 288, pressurePa: 101325, volatileFrac: 0.05 });
  const scCo2 = classifySolventBains2024({ tempK: 318, pressurePa: 9_000_000, volatileFrac: 0.004 });
  const nh3 = classifySolventBains2024({ tempK: 215, pressurePa: 220_000, volatileFrac: 0.05 });
  const ch4 = classifySolventBains2024({ tempK: 94, pressurePa: 146_700, volatileFrac: 0.06 });
  const h2so4 = classifySolventBains2024({ tempK: 332, pressurePa: 9_200_000, volatileFrac: 0.02 });
  const subH2o = classifySolventBains2024({ tempK: 102, pressurePa: 0, volatileFrac: 0.08, isCryoMoon: true });
  const jupCloud = classifySolventBains2024({ tempK: 268, pressurePa: 420_000, hasSolidCrust: false });

  assert.equal(h2o.solvent, 'H2O');
  assert.equal(scCo2.solvent, 'CO2-liq');
  assert.equal(nh3.solvent, 'NH3');
  assert.equal(ch4.solvent, 'CH4');
  assert.equal(h2so4.solvent, 'H2SO4');
  assert.equal(subH2o.solvent, 'H2O-subsurface');
  assert.equal(jupCloud.solvent, 'H2-He-cloud');

  // 2024 acrylonitrile / cryomineral caution must be captured honestly on CH4 worlds
  assert.match(ch4.compartmentModel, /cryomineral|cocrystal|azotosome/i);
  for (const s of [h2o, scCo2, nh3, ch4, h2so4, subH2o, jupCloud]) {
    assert.ok(s.bainsScore > 0 && s.bainsScore <= 1.0, `Invalid Bains score for ${s.solvent}`);
    assert.ok(s.xnaAlphabetSize >= 4 && s.xnaAlphabetSize <= 12, `Invalid XNA alphabet size for ${s.solvent}`);
    assert.ok(s.tDenatureK > s.tMeltK, `tDenatureK must exceed tMeltK for ${s.solvent}`);
  }
});

test('Phase B2: Kiang/Lehmer/Takizawa multi-photon photobiology & NutMEG redox scaling respond to stellar Teff and solvent', () => {
  const ultraCool = solvePhotobiologySpectrum({ stellarTeffK: 2700, solvent: 'H2O' });
  const mDwarf = solvePhotobiologySpectrum({ stellarTeffK: 3300, solvent: 'H2O', uvFluxNorm: 3.2 });
  const gStar = solvePhotobiologySpectrum({ stellarTeffK: 5778, solvent: 'H2O', uvFluxNorm: 1.0 });
  const fStar = solvePhotobiologySpectrum({ stellarTeffK: 7200, solvent: 'H2O', uvFluxNorm: 3.5 });

  assert.equal(ultraCool.zSchemePhotons, 4, 'Ultra-cool M-dwarf must require 4-photon Z-scheme');
  assert.equal(mDwarf.zSchemePhotons, 3, 'Mid M-dwarf must require 3-photon NIR Z-scheme');
  assert.equal(gStar.zSchemePhotons, 2, 'G2V star must use 2-photon oxygenic Z-scheme');
  assert.ok(mDwarf.redEdgeNm >= 1000 && gStar.redEdgeNm < 760,
    `M-dwarf red edge (${mDwarf.redEdgeNm} nm) must shift deep into NIR vs G-star (${gStar.redEdgeNm} nm)`);
  assert.equal(fStar.uvRadiotrophyActive, true, 'High-UV F-star must activate UV radiotrophy/photoprotection');
  assert.ok(gStar.spectralCurve.length >= 20, 'Spectral absorption curve must sample 300-1400 nm');

  const redoxEarth = deriveRedoxAndBiosignatures({ solvent: 'H2O', tempK: 288, pressurePa: 101325 });
  const redoxTitan = deriveRedoxAndBiosignatures({ solvent: 'CH4', tempK: 94, pressurePa: 146700 });
  assert.ok(redoxEarth.deltaGKjMol < -300 && redoxTitan.deltaGKjMol < -200);
  assert.ok(redoxEarth.maintPowerWPerKg > redoxTitan.maintPowerWPerKg,
    'Arrhenius maintenance power must be lower at cryogenic Titan 94 K than warm Earth 288 K');
  assert.ok(redoxEarth.biosignatures.length >= 2 && redoxTitan.biosignatures.length >= 2);
});

test('Phase B3: Contrasting worlds synthesize genuinely unique multi-kingdom ecosystems (Flora + Fungi + Fauna) & distinct flora architectures', () => {
  const worlds = [
    { name: 'Earth', opts: { worldName: 'Earth', tempK: 288, pressurePa: 101325, gravityMS2: 9.81, rhoAtmKgM3: 1.22, stellarTeffK: 5778, seed: 101 } },
    { name: 'Titan', opts: { worldName: 'Titan', tempK: 94, pressurePa: 146700, gravityMS2: 1.35, rhoAtmKgM3: 5.3, stellarTeffK: 5778, seed: 202 } },
    { name: 'SuperEarthM', opts: { worldName: 'Proxima-b', tempK: 298, pressurePa: 220000, gravityMS2: 18.5, rhoAtmKgM3: 2.6, stellarTeffK: 3050, uvFluxNorm: 3.4, seed: 303 } },
    { name: 'VenusCloud', opts: { worldName: 'Venus', tempK: 332, pressurePa: 9200000, gravityMS2: 8.87, rhoAtmKgM3: 1.15, volatileFrac: 0.02, seed: 404 } },
    { name: 'JupiterCloud', opts: { worldName: 'Jupiter', tempK: 268, pressurePa: 420000, gravityMS2: 24.8, rhoAtmKgM3: 0.82, hasSolidCrust: false, seed: 505 } }
  ];

  const allSpeciesNames = new Set();
  const ecoList = worlds.map((w) => synthesizeWorldEcosystem(w.opts));
  for (let i = 0; i < ecoList.length; i += 1) {
    const eco = ecoList[i];
    assert.ok(eco.species.length >= 5, `${worlds[i].name} must spawn a multi-species clade web (got ${eco.species.length})`);
    const kingdoms = new Set(eco.species.map((s) => s.kingdom));
    assert.ok(kingdoms.has('fauna'), `${worlds[i].name} must include motile fauna`);
    if (worlds[i].opts.hasSolidCrust !== false) {
      assert.ok(kingdoms.has('flora') && kingdoms.has('fungi'), `${worlds[i].name} must include flora and fungi/chemotroph clades`);
    }
    for (const sp of eco.species) {
      assert.match(sp.speciesName, /^[A-Z][a-z]+ [a-z]+$/, `Species "${sp.speciesName}" must be a procedural binomial`);
      assert.ok(sp.anatomicalParts.length >= 3, `${sp.speciesName} must expose >= 3 interactive anatomical zones`);
      assert.ok(Number.isFinite(sp.traits.kleiberWatts) && sp.traits.kleiberWatts > 0);
      allSpeciesNames.add(sp.speciesName);
    }
    const sumW = eco.floraArchWeights.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sumW - 1.0) < 0.02, `${worlds[i].name} floraArchWeights must sum to 1 (got ${sumW})`);
  }

  const totalGenerated = ecoList.reduce((acc, e) => acc + e.species.length, 0);
  assert.ok(allSpeciesNames.size >= Math.floor(totalGenerated * 0.85),
    `Expected rich procedural species uniqueness across 5 worlds (${allSpeciesNames.size}/${totalGenerated} unique)`);

  const earthW = ecoList[0].floraArchWeights;
  const titanW = ecoList[1].floraArchWeights;
  const superW = ecoList[2].floraArchWeights;
  assert.ok(superW[5] > titanW[5], `High-g super-Earth buttressed monolith weight (${superW[5]}) must exceed low-g Titan (${titanW[5]})`);
  assert.ok(ecoList[1].bucklingHeightScale > ecoList[2].bucklingHeightScale,
    'Euler buckling height must scale inversely with gravity');
  assert.ok(Math.abs(earthW[0] - titanW[0]) + Math.abs(earthW[4] - titanW[4]) > 0.15,
    'Earth and Titan must emit distinct flora architecture distributions');

  const floraVerts = buildFloraTemplateMeshFloats();
  const kinds = new Set();
  for (let i = 0; i < floraVerts.length; i += 8) kinds.add(Math.round(floraVerts[i + 7]));
  for (let k = 0; k <= 6; k += 1) {
    assert.ok(kinds.has(k), `GPU flora template must include sculpted architecture kind=${k}`);
  }
  assert.equal(XENOBIOLOGY_PLANET_PRESETS.length >= 6, true, 'Life Lab must expose >= 6 alien world presets incl. Gas Giant');
});

test('Phase B4: All 17 procedural 3D body plans emit finite 48-byte triangles & anatomical hit-spheres', () => {
  assert.equal(BODY_PLAN_IDS.length, 17, `Expected 17 canonical procedural body plans (got ${BODY_PLAN_IDS.length})`);
  for (let i = 0; i < BODY_PLAN_IDS.length; i += 1) {
    const plan = BODY_PLAN_IDS[i];
    const solidVerts = [];
    const glassVerts = [];
    const hitSpheres = [];
    const kingdom = plan.startsWith('mycelial') || plan.startsWith('sporing') || plan.startsWith('chemo')
      ? 'fungi'
      : (['conifer-spire', 'branching-arbor', 'frond-rosette', 'buoyant-kelp', 'biolum-coral', 'buttressed-monolith'].includes(plan)
        ? 'flora'
        : 'fauna');
    appendProceduralOrganismGeometry(solidVerts, glassVerts, {
      seed: 1000 + i * 73,
      kingdom,
      bodyPlan: plan,
      speciesName: `Testus plan${i}`,
      primaryRgb: [0.35, 0.62, 0.45],
      secondaryRgb: [0.58, 0.44, 0.30],
      accentRgb: [0.95, 0.78, 0.25],
      biolumRgb: [0.22, 0.96, 0.78],
      biolumIntensity: 0.45,
      traits: { limbCount: 4 + (i % 3) * 2, bodyMassKg: 45, kleiberWatts: 62 },
      pos: [0, 0, 0],
      yaw: 0.4,
      pitch: 0.0,
      scale: 1.0,
      phase: 1.25,
      arousal: 0.4,
      crouch: 0.1,
      sailFlare: 0.3,
      frondClose: 0.2,
      heatGlow: 0.2,
      coolGlow: 0.0,
      neuroWave: 0.3
    }, null, hitSpheres);

    const vertCount = Math.floor(solidVerts.length / 12);
    assert.ok(vertCount >= 36 && vertCount % 3 === 0, `Body plan "${plan}" emitted invalid solid vertex count ${vertCount}`);
    assert.ok(hitSpheres.length >= 3, `Body plan "${plan}" must emit >= 3 clickable anatomical hit spheres (got ${hitSpheres.length})`);
    for (let j = 0; j < solidVerts.length; j += 1) {
      assert.ok(Number.isFinite(solidVerts[j]), `Non-finite solid vertex float at index ${j} for body plan "${plan}"`);
    }
    for (let j = 0; j < glassVerts.length; j += 1) {
      assert.ok(Number.isFinite(glassVerts[j]), `Non-finite glass vertex float at index ${j} for body plan "${plan}"`);
    }
  }
});

test('Phase B5: Interactive Bio-Lab Vivarium Aquarium responds physically & physiologically across all 6 tools on Fauna, Flora, and Fungi', () => {
  const earthProf = deriveXenobiologyProfile({
    worldName: 'Earth', tempK: 288, pressurePa: 101325, gravityMS2: 9.81, rhoAtmKgM3: 1.22, seed: 777
  });
  const faunaSp = earthProf.species.find((s) => s.kingdom === 'fauna');
  const floraSp = earthProf.species.find((s) => s.kingdom === 'flora');
  const fungiSp = earthProf.species.find((s) => s.kingdom === 'fungi');
  assert.ok(faunaSp && floraSp && fungiSp, 'Earth ecosystem must provide Fauna, Flora, and Fungi species');

  // 1. Fauna interactions: Inspect, Probe (recoil/arousal), Heat (Q10 metabolic spike), Cool, Stim (neuro/biolum burst), Biopsy (drill-down!)
  const ctrlFauna = createVivariumOrganismController(faunaSp, earthProf);
  ctrlFauna.step(0.05);
  const frame0 = ctrlFauna.buildFrameBuffers();
  assert.ok(frame0.solidVertCount > 120, 'Vivarium must build solid organism + substrate geometry');
  assert.ok(frame0.glassVertCount >= 24, 'Vivarium must build translucent glass aquarium + solvent meniscus geometry');
  assert.ok(frame0.beadCount >= 24, 'Vivarium must emit ambient solvent motes/particles');

  const baseTel = ctrlFauna.getTelemetry();
  const part0 = { id: faunaSp.anatomicalParts[0].id, center: [0, 0, 0] };
  const probeRes = ctrlFauna.applyInteraction('probe', part0);
  assert.ok(probeRes.arousal > baseTel.arousal, 'Probing fauna must increase arousal');
  assert.ok(probeRes.reactionText.length > 15, 'Probe must report physiological/behavioral reaction');

  const heatRes = ctrlFauna.applyInteraction('heat', part0);
  assert.ok(heatRes.localTempK > baseTel.localTissueTempK + 20, 'Heat tool must raise local tissue temperature');
  ctrlFauna.step(0.05);
  const hotTel = ctrlFauna.getTelemetry();
  assert.ok(hotTel.kleiberWatts > baseTel.kleiberWatts, 'Q10 thermodynamics must raise metabolic power when heated');

  const coolRes = ctrlFauna.applyInteraction('cool', part0);
  assert.ok(coolRes.localTempK < heatRes.localTempK, 'Cool tool must lower local tissue temperature');

  ctrlFauna.applyInteraction('stim', part0);
  assert.ok(ctrlFauna.state.neuroWave > 0.8, 'Electrical/optical stimulation must drive propagating neural/bioluminescent wave');

  const biopsyRes = ctrlFauna.applyInteraction('sample', part0);
  assert.ok(biopsyRes.biopsyAction && biopsyRes.biopsyAction.targetMode, 'Biopsy tool must provide molecular/cellular drill-down action');

  // 2. Flora interaction: seismonastic folding & elastic sway
  const ctrlFlora = createVivariumOrganismController(floraSp, earthProf);
  ctrlFlora.step(0.05);
  ctrlFlora.buildFrameBuffers();
  const floraProbe = ctrlFlora.applyInteraction('probe', { id: 'canopy', center: [0, 1.0, 0] });
  assert.ok(ctrlFlora.state.frondClose > 0.5, 'Probing alien flora must trigger seismonastic leaf/frond folding');
  assert.match(floraProbe.reactionText, /seismonastic|frond|fold|sway|reflex|retract|leaf|canopy/i);

  // 3. Fungi interaction: explosive spore-cloud burst!
  const ctrlFungi = createVivariumOrganismController(fungiSp, earthProf);
  ctrlFungi.step(0.05);
  const preFrame = ctrlFungi.buildFrameBuffers();
  let preActiveSpores = 0;
  for (let i = 0; i < preFrame.beadCount; i += 1) if (preFrame.beadsF32[i * 12 + 7] > 0.5 && preFrame.beadsF32[i * 12 + 11] > 0.01) preActiveSpores += 1;
  const fungiProbe = ctrlFungi.applyInteraction('probe', { id: 'cap', center: [0, 1.0, 0] });
  assert.match(fungiProbe.reactionText, /spore|hypha|cloud|fungi|mycel/i, 'Probing alien fungus must report spore eruption');
  ctrlFungi.step(0.05);
  const postFrame = ctrlFungi.buildFrameBuffers();
  let postActiveSpores = 0;
  for (let i = 0; i < postFrame.beadCount; i += 1) if (postFrame.beadsF32[i * 12 + 7] > 0.5 && postFrame.beadsF32[i * 12 + 11] > 0.01) postActiveSpores += 1;
  assert.ok(postActiveSpores > preActiveSpores,
    `Fungal spore burst must spawn live 3D glowing spore particles (${preActiveSpores} -> ${postActiveSpores})`);

  // 4. Abducted specimen URL round-trip preserves bodyPlan, kingdom, speciesName & defaults to organism-overview!
  const spec = synthesizeAbductedSpecimenRecord({
    kind: 'fungi',
    speciesRecord: fungiSp,
    worldName: 'Earth',
    xeno: earthProf,
    seed: fungiSp.seed
  });
  const url = buildLifeLabXenobiologyUrl(earthProf, 'organism-overview', spec);
  const parsed = parseXenobiologyFromSearch(url.slice(url.indexOf('?')));
  assert.equal(parsed.mode, 'organism-overview');
  assert.equal(parsed.abductedSpecimen.speciesName, fungiSp.speciesName);
  assert.equal(parsed.abductedSpecimen.bodyPlan, fungiSp.bodyPlan);
  assert.equal(parsed.abductedSpecimen.kingdom, 'fungi');
});

test('Phase B6: Canonical Law Adapter descriptors exported cleanly by xenobiology & flora engines', () => {
  assert.equal(XENOBIOLOGY_ECOLOGY_LAW_ADAPTER.id, 'planetary-xenobiology-ecology');
  assert.equal(XENOBIOLOGY_ECOLOGY_LAW_ADAPTER.spatialAuthority, LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH);
  assert.equal(SURFACE_FLORA_LAW_ADAPTER.id, 'surface-flora-placement');
  assert.equal(SURFACE_FLORA_LAW_ADAPTER.spatialAuthority, LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH);
  const act = evaluateXenobiologyEcologyActivation({ tempK: 288, pressurePa: 101325, hasSolidCrust: true });
  assert.equal(act.active, true);
  const actSterile = evaluateXenobiologyEcologyActivation({ tempK: 1500, pressurePa: 0, isMagmaOcean: true });
  assert.equal(actSterile.active, false);
});

test('Wave D2 dogfooding invariants: live Stage 1-2 cladogenesis, 0% flora culling, live GPU Stage 5 consumer & GPU SDF skinning', async () => {
  const fs = await import('node:fs/promises');
  // 1. Live Stage 1-2 cladogenesis wired directly into deriveXenobiologyProfile (zero legacy 17-menu fallback!)
  const earth = deriveXenobiologyProfile({
    worldName: 'Earth', tempK: 288, pressurePa: 101325, gravityMS2: 9.81, rhoAtmKgM3: 1.22, seed: 20261127
  });
  assert.ok(earth.atlas && earth.atlas.niches.length >= 4, 'deriveXenobiologyProfile must expose Stage 1 planetaryNicheAtlas');
  assert.ok(earth.species.length >= 12, `Expected >= 12 Stage 2 evolved clades (got ${earth.species.length})`);
  for (const sp of earth.species) {
    assert.ok(sp.parentCladeId, `Clade ${sp.speciesName} must carry phylogenetic parentCladeId`);
    assert.ok(sp.nicheId, `Clade ${sp.speciesName} must carry Stage 1 nicheId`);
    assert.ok(sp.developmentalGenome, `Clade ${sp.speciesName} must carry Stage 3 continuous developmentalGenome`);
    assert.ok(Array.isArray(sp.anatomicalParts) && sp.anatomicalParts.length >= 3, `Clade ${sp.speciesName} must carry >= 3 anatomicalParts`);
  }

  // 2. Zero flora culling modulo wrap + live GPU Stage 5 agent consumer + GPU SDF hero fauna + GPU Vivarium skinning
  const floraSrc = await fs.readFile(new URL('../src/runtime/astrophysics/surfaceFloraPlacementGpu.js', import.meta.url), 'utf8');
  const surfSrc = await fs.readFile(new URL('../src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js', import.meta.url), 'utf8');
  const bioRenSrc = await fs.readFile(new URL('../src/demos/chemBioWebGpuRenderer.js', import.meta.url), 'utf8');

  assert.match(floraSrc, /baked_flora_count:\s*u32/, 'FloraParams must upload baked_flora_count');
  assert.match(floraSrc, /kind\s*=\s*f32\(u32\(round\(kind\)\)\s*%\s*max_k\)/, 'FLORA_PLACEMENT_WGSL must wrap kind modulo baked_flora_count');
  assert.match(surfSrc, /surfaceEcoGpu\.getLatestAgentsF32\(\)/, 'Planetary surface session must consume live Stage 5 GPU agent state');
  assert.match(surfSrc, /surfaceEcoGpu\.pollReadback\(\)/, 'Planetary surface session must run non-blocking GPU agent readback');
  assert.match(surfSrc, /appendBakedOrganismMesh\(/, 'Landed hero fauna must render GPU-baked SDF Surface-Nets meshes');
  assert.match(bioRenSrc, /zone\s*>=\s*1\.5\s*&&\s*zone\s*<\s*5\.5/, 'Bio-Lab vs_spec_mesh must apply GPU biomechanical vertex skinning to living SDF organisms');
});
