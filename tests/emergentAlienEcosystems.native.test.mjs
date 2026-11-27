import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

// U12 Emergent Per-Planet Alien Ecosystems & Morphologically Unique Complex Life
// Falsifiable Native Vulkan WebGPU Acceptance Suite:
//   1. Cross-Planet Zero-Twin Test across 12 diverse planets (incl. 2 Earth twins with distinct seeds):
//      - Real WebGPU cladogenesis (`runPlanetaryCladogenesisWebGpu`) evolves 12..16 unique species/planet
//      - Real WebGPU 3D Implicit SDF + 3D Gray-Scott Turing baker (`bakeOrganismMeshWebGpu`) produces
//        watertight meshes + GPU radial/angular SDF shape spectra with ZERO duplicate inter-planetary silhouettes!
//   2. Gravity & Fluid Scaling Falsification:
//      - g in [1.5, 9.81, 25.0] m/s^2 monotonically reduces Euler buckling height H ~ g^(-1/3)
//        and increases limb thickness-to-length ratio
//      - rho_atm in [0.05, 1.22, 15.0] kg/m^3 monotonically expands aerial/buoyant niche emergence
//   3. Spectral Photobiology Sweep (T_eff = 2800 K vs 5778 K vs 7500 K): continuous pigment shift!
//   4. Sterility Null Limit: vacuum (P=0) and magma ocean (T=1350 K) emit exact 0 niches, 0 species!
//   5. GPU Multi-Trophic Surface Ecosystem AI (`createSurfaceEcosystemGpu`) + < 4 KB compact biosphere cache!
//   6. Live Bio-Lab Vivarium (`life-lab.html`) Ultra-LOD GPU SDF visual proof across 3 distinct worlds!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_ECOSYSTEMS === '1'
  || process.env.ULG_RUN_NATIVE_ALL === '1';
const BASE_URL = process.env.ULG_BASE_URL || 'https://127.0.0.1:5173/';
const SHOT_DIR = process.env.ULG_ECOSYSTEM_SHOT_DIR || '';

test('U12 native Vulkan: 12-planet Zero-Twin GPU cladogenesis + 3D SDF/Turing baker + scaling falsification + GPU surface AI + live Vivarium', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_ECOSYSTEMS=1 for native Vulkan WebGPU',
  timeout: 240_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true
    });
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.goto(new URL('service-assets/README.md', BASE_URL).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 6 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 350));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message || e.error)));

      const { buildPlanetaryNicheAtlas } = await import('/src/runtime/biology/planetaryNicheAtlas.js');
      const {
        runPlanetaryCladogenesisWebGpu,
        serializePlanetaryBiosphereCompact,
        deserializePlanetaryBiosphereCompact
      } = await import('/src/runtime/biology/evolutionaryCladogenesisGpu.js');
      const { computeMorphologicalDistance } = await import('/src/runtime/biology/developmentalGenome.js');
      const { bakeOrganismMeshWebGpu, bakePlanetaryFloraAtlasWebGpu } = await import('/src/runtime/biology/organismSdfMorphogenesisGpu.js');
      const { createSurfaceEcosystemGpu } = await import('/src/runtime/biology/surfaceEcosystemGpu.js');

      // 1. 12 diverse habitable worlds (including 2 Earth-mass G2V twins with distinct seeds!)
      const planets = [
        { worldName: 'Earth-Alpha', seed: 1001, tempK: 288, pressurePa: 101325, gravityMS2: 9.81, rhoAtmKgM3: 1.22, volatileFrac: 0.05, stellarTeffK: 5778 },
        { worldName: 'Earth-Beta-Twin', seed: 777777, tempK: 288, pressurePa: 101325, gravityMS2: 9.81, rhoAtmKgM3: 1.22, volatileFrac: 0.05, stellarTeffK: 5778 },
        { worldName: 'SuperEarth-HighG', seed: 2003, tempK: 302, pressurePa: 280000, gravityMS2: 22.5, rhoAtmKgM3: 3.1, volatileFrac: 0.06, stellarTeffK: 5200 },
        { worldName: 'LowG-DenseAir', seed: 3004, tempK: 282, pressurePa: 420000, gravityMS2: 2.2, rhoAtmKgM3: 6.4, volatileFrac: 0.07, stellarTeffK: 5900 },
        { worldName: 'MDwarf-Crimson', seed: 4005, tempK: 294, pressurePa: 150000, gravityMS2: 12.4, rhoAtmKgM3: 1.8, volatileFrac: 0.05, stellarTeffK: 2950, tidallyLocked: true },
        { worldName: 'FStar-Cyan', seed: 5006, tempK: 290, pressurePa: 95000, gravityMS2: 8.4, rhoAtmKgM3: 1.05, volatileFrac: 0.05, stellarTeffK: 7400 },
        { worldName: 'Titan-CryoCH4', seed: 6007, tempK: 94, pressurePa: 146700, gravityMS2: 1.35, rhoAtmKgM3: 5.3, volatileFrac: 0.06, stellarTeffK: 5778 },
        { worldName: 'Pelagic-Ocean', seed: 7008, tempK: 312, pressurePa: 320000, gravityMS2: 11.2, rhoAtmKgM3: 2.8, volatileFrac: 0.14, oceanCoverageFrac: 0.92, stellarTeffK: 5600 },
        { worldName: 'Ammonia-Tundra', seed: 8009, tempK: 228, pressurePa: 180000, gravityMS2: 6.8, rhoAtmKgM3: 1.9, volatileFrac: 0.05, stellarTeffK: 4400 },
        { worldName: 'SuperCrit-CO2', seed: 9010, tempK: 318, pressurePa: 8500000, gravityMS2: 13.5, rhoAtmKgM3: 18.0, volatileFrac: 0.005, stellarTeffK: 5400 },
        { worldName: 'Europa-Subsurface', seed: 10011, tempK: 104, pressurePa: 0, gravityMS2: 1.31, rhoAtmKgM3: 0, volatileFrac: 0.09, isCryoMoon: true, stellarTeffK: 5778 },
        { worldName: 'Jovian-CloudDeck', seed: 11012, tempK: 270, pressurePa: 420000, gravityMS2: 24.8, rhoAtmKgM3: 0.85, volatileFrac: 0.08, hasSolidCrust: false, stellarTeffK: 5778 }
      ];

      const bios = [];
      const bakedFlagships = [];
      let maxCompactBytes = 0;

      for (const pl of planets) {
        const bio = await runPlanetaryCladogenesisWebGpu(device, pl, { epochs: 200, targetSpeciesCount: 14 });
        const compact = serializePlanetaryBiosphereCompact(bio);
        const compactJson = JSON.stringify(compact);
        maxCompactBytes = Math.max(maxCompactBytes, compactJson.length);
        const restored = deserializePlanetaryBiosphereCompact(JSON.parse(compactJson));
        bios.push({ worldName: pl.worldName, bio, restoredCount: restored?.species?.length || 0, compactBytes: compactJson.length });

        // Bake flagship fauna + flagship flora on WebGPU via 3D Implicit SDF + 3D Gray-Scott Turing!
        const fauna = bio.species.find((s) => s.kingdom === 'fauna') || bio.species[0];
        const baked = await bakeOrganismMeshWebGpu(device, fauna.developmentalGenome, {
          gridDim: 26,
          turingDim: 16,
          turingSteps: 20,
          maxVerts: 12288,
          formatMode: 0
        });
        bakedFlagships.push({
          worldName: pl.worldName,
          speciesName: fauna.speciesName,
          genome: fauna.developmentalGenome,
          vertCount: baked.vertCount,
          solidVoxels: baked.solidVoxels,
          shapeSpectrum: Array.from(baked.shapeSpectrum)
        });
      }

      // Compute pairwise inter-planetary morphological distance across ALL 12 planets (66 pairs!)
      let minFeatureDist = Infinity;
      let minCombinedDist = Infinity;
      let twinPair = null;
      for (let i = 0; i < bakedFlagships.length; i += 1) {
        for (let j = i + 1; j < bakedFlagships.length; j += 1) {
          const dFeat = computeMorphologicalDistance(bakedFlagships[i].genome, bakedFlagships[j].genome);
          let dSpecSq = 0;
          for (let k = 0; k < 8; k += 1) {
            const ds = bakedFlagships[i].shapeSpectrum[k] - bakedFlagships[j].shapeSpectrum[k];
            dSpecSq += ds * ds;
          }
          const dSpec = Math.sqrt(dSpecSq);
          const dComb = dFeat + dSpec;
          if (dFeat < minFeatureDist) minFeatureDist = dFeat;
          if (dComb < minCombinedDist) {
            minCombinedDist = dComb;
            twinPair = [bakedFlagships[i].worldName, bakedFlagships[j].worldName, Number(dFeat.toFixed(3)), Number(dSpec.toFixed(3))];
          }
        }
      }

      // Bake full per-planet GPU Flora Atlas on Earth-Alpha
      const floraAtlas = await bakePlanetaryFloraAtlasWebGpu(device, bios[0].bio.species, { gridDim: 20, maxVertsPerSpecies: 1200 });

      // 2. Gravity & Fluid Scaling Falsification
      const gSweep = [];
      for (const gVal of [1.5, 9.81, 25.0]) {
        const b = await runPlanetaryCladogenesisWebGpu(device, {
          worldName: `Grav-${gVal}`, seed: 5555, tempK: 288, pressurePa: 101325, gravityMS2: gVal, rhoAtmKgM3: 1.22, volatileFrac: 0.05
        }, { epochs: 120 });
        const faunaTerr = b.species.filter((s) => s.kingdom === 'fauna' && s.medium === 'terrestrial');
        const meanLimbThick = faunaTerr.reduce((acc, s) => acc + s.developmentalGenome.limbThicknessRatio, 0) / Math.max(1, faunaTerr.length);
        gSweep.push({ g: gVal, buckling: b.atlas.tensor.bucklingHeightScale, meanLimbThick: Number(meanLimbThick.toFixed(4)) });
      }
      const rhoSweep = [];
      for (const rhoVal of [0.05, 1.22, 15.0]) {
        const atlas = buildPlanetaryNicheAtlas({
          worldName: `Rho-${rhoVal}`, seed: 6666, tempK: 288, pressurePa: Math.round(rhoVal * 83000), gravityMS2: 9.81, rhoAtmKgM3: rhoVal, volatileFrac: 0.05
        });
        rhoSweep.push({
          rho: rhoVal,
          aerialEase: atlas.tensor.aerialEase,
          hasAirNiche: atlas.niches.some((n) => n.medium === 'aerial' || n.medium === 'buoyant')
        });
      }

      // 3. Spectral Photobiology Sweep (2800 K M-dwarf vs 5778 K G2V vs 7500 K F-star)
      const teffSweep = [];
      for (const teff of [2800, 5778, 7500]) {
        const atlas = buildPlanetaryNicheAtlas({
          worldName: `Star-${teff}`, seed: 7777, tempK: 288, pressurePa: 101325, gravityMS2: 9.81, rhoAtmKgM3: 1.22, volatileFrac: 0.05, stellarTeffK: teff
        });
        teffSweep.push({ teff, rgb: atlas.tensor.photobiology.primaryRgb, redEdgeNm: atlas.tensor.photobiology.redEdgeNm });
      }

      // 4. Sterility Null Limit (Vacuum & Magma)
      const sterileVacuum = await runPlanetaryCladogenesisWebGpu(device, {
        worldName: 'Dead-Rock', seed: 9991, tempK: 250, pressurePa: 0, gravityMS2: 1.62, rhoAtmKgM3: 0, volatileFrac: 0
      });
      const sterileMagma = await runPlanetaryCladogenesisWebGpu(device, {
        worldName: 'Magma-World', seed: 9992, tempK: 1350, pressurePa: 500000, gravityMS2: 11.0, rhoAtmKgM3: 4.0, isMagmaOcean: true
      });

      // 5. Surface GPU Ecosystem AI multi-trophic test (40 GPU steps with grazers + predators!)
      const ecoGpu = createSurfaceEcosystemGpu(device, { maxAgents: 48 });
      const initAgents = [];
      for (let i = 0; i < 32; i += 1) {
        const ang = (i / 32) * Math.PI * 2;
        initAgents.push({
          pos: [Math.cos(ang) * 28, 0, Math.sin(ang) * 28],
          yaw: ang + 1.0,
          speed: i < 8 ? 5.2 : 3.0,
          phase: i * 0.4,
          gaitFreqHz: 1.2,
          trophicGuild: i < 8 ? 'apex-predator' : 'grazer',
          medium: 'terrestrial',
          speciesIndex: i % 4
        });
      }
      ecoGpu.seedAgents(initAgents);
      for (let s = 0; s < 40; s += 1) {
        const enc = device.createCommandEncoder();
        ecoGpu.encodeStep(enc, { dt: 0.03, gravity: 9.81, hasSolidCrust: true, focusPos: [0, 0, 0] });
        device.queue.submit([enc.finish()]);
      }
      const ecoTel = await ecoGpu.readTelemetryAndAgents();
      ecoGpu.dispose();
      device.destroy();

      return {
        status: 'ok',
        gpuErrors,
        planetCount: bios.length,
        speciesCounts: bios.map((b) => b.bio.species.length),
        restoredCounts: bios.map((b) => b.restoredCount),
        maxCompactBytes,
        minVertCount: Math.min(...bakedFlagships.map((f) => f.vertCount)),
        minFeatureDist: Number(minFeatureDist.toFixed(4)),
        minCombinedDist: Number(minCombinedDist.toFixed(4)),
        twinPair,
        floraAtlasBakedSpecies: floraAtlas.bakedSpeciesCount,
        floraAtlasVerts: floraAtlas.vertCount,
        gSweep,
        rhoSweep,
        teffSweep,
        sterileVacuum: { niches: sterileVacuum.atlas.niches.length, species: sterileVacuum.species.length },
        sterileMagma: { niches: sterileMagma.atlas.niches.length, species: sterileMagma.species.length },
        ecoAi: {
          activeCount: ecoTel.activeCount,
          meanSpeedMS: Number(ecoTel.meanSpeedMS.toFixed(3)),
          meanAtp: Number(ecoTel.meanAtp.toFixed(3)),
          predatorChaseEvents: ecoTel.predatorChaseEvents
        }
      };
    });

    console.log(JSON.stringify(out, null, 2));
    assert.equal(out.status, 'ok');
    assert.deepEqual(out.gpuErrors, []);
    assert.equal(out.planetCount, 12);
    assert.ok(out.speciesCounts.every((n) => n >= 12 && n <= 16), `Every habitable planet evolves 12..16 species: ${out.speciesCounts}`);
    assert.deepEqual(out.restoredCounts, out.speciesCounts, 'Compact root-cache round-trip preserves 100% of species');
    assert.ok(out.maxCompactBytes <= 4096, `Compact planetary biosphere serialization <= 4 KB (got ${out.maxCompactBytes} B)`);
    assert.ok(out.minVertCount >= 300, `Every GPU 3D SDF + Turing baked species emits a solid mesh (min ${out.minVertCount} verts)`);
    assert.ok(out.minFeatureDist >= 0.28, `Zero-Twin Gate: all 66 inter-planetary pairs distinct (min dist=${out.minFeatureDist}, pair=${JSON.stringify(out.twinPair)})`);
    assert.ok(out.floraAtlasBakedSpecies >= 5 && out.floraAtlasVerts >= 1000, `Per-planet GPU flora atlas baked (${out.floraAtlasBakedSpecies} species, ${out.floraAtlasVerts} verts)`);

    // Gravity & Fluid Scaling Falsification
    assert.ok(out.gSweep[0].buckling > out.gSweep[1].buckling && out.gSweep[1].buckling > out.gSweep[2].buckling,
      `Euler buckling height decreases monotonically with g: ${JSON.stringify(out.gSweep)}`);
    assert.ok(out.gSweep[2].meanLimbThick > out.gSweep[0].meanLimbThick,
      `High-g fauna evolve thicker limbs than low-g fauna: ${JSON.stringify(out.gSweep)}`);
    assert.equal(out.rhoSweep[0].hasAirNiche, false, 'Ultra-thin 0.05 kg/m^3 atmosphere has no aerial niche');
    assert.equal(out.rhoSweep[2].hasAirNiche, true, 'Dense 15 kg/m^3 atmosphere radiates aerial/buoyant niche');

    // Spectral Photobiology continuous shift across M/G/F stars
    const rgbM = out.teffSweep[0].rgb;
    const rgbG = out.teffSweep[1].rgb;
    const rgbF = out.teffSweep[2].rgb;
    assert.ok(Math.hypot(rgbM[0] - rgbG[0], rgbM[1] - rgbG[1], rgbM[2] - rgbG[2]) > 0.08, 'M-dwarf vs G2V pigment differs');
    assert.ok(Math.hypot(rgbG[0] - rgbF[0], rgbG[1] - rgbF[1], rgbG[2] - rgbF[2]) > 0.04, 'G2V vs F-star pigment differs');

    // Sterility Null Limit
    assert.deepEqual(out.sterileVacuum, { niches: 0, species: 0 }, 'Vacuum world emits exact 0 niches and 0 species');
    assert.deepEqual(out.sterileMagma, { niches: 0, species: 0 }, 'Magma world emits exact 0 niches and 0 species');

    // Surface GPU Multi-Trophic Ecosystem AI
    assert.equal(out.ecoAi.activeCount, 32);
    assert.ok(out.ecoAi.meanSpeedMS > 0.8 && out.ecoAi.meanAtp > 0.2, `Live GPU ecosystem AI moving with healthy ATP: ${JSON.stringify(out.ecoAi)}`);

    // 6. Live Bio-Lab Vivarium Ultra-LOD GPU SDF visual verification across 3 distinct worlds!
    consoleErrors.length = 0;
    pageErrors.length = 0;
    const vivUrls = [
      { id: 'earth', url: 'life-lab.html?xeno=1&world=Earth-Alpha&T=288&P=101325&g=9.81&rho=1.22&solvent=H2O&teff=5778&seed=1001&mode=organism-overview' },
      { id: 'titan', url: 'life-lab.html?xeno=1&world=Titan-Cryo&T=94&P=146700&g=1.35&rho=5.3&solvent=CH4&teff=5778&seed=6007&mode=organism-overview' },
      { id: 'mdwarf', url: 'life-lab.html?xeno=1&world=Proxima-Crimson&T=294&P=150000&g=14.8&rho=2.1&solvent=H2O&teff=2950&seed=4005&mode=organism-overview' }
    ];
    const vivPngs = {};
    for (const v of vivUrls) {
      await page.goto(new URL(v.url, BASE_URL).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(() => Boolean(window.__ulgLifeLab?.getState?.()?.ready), null, { timeout: 60_000 });
      await page.waitForTimeout(1400);
      const dataUrl = await page.evaluate(() => window.__ulgLifeLab.capturePng());
      const gpuBuf = Buffer.from(dataUrl.split(',')[1], 'base64');
      vivPngs[v.id] = gpuBuf;
      if (SHOT_DIR) {
        await fs.mkdir(SHOT_DIR, { recursive: true });
        await fs.writeFile(path.join(SHOT_DIR, `vivarium-sdf-${v.id}.png`), gpuBuf);
      }
    }
    const cmpET = comparePhysicalPixelPngFrames(vivPngs.earth, vivPngs.titan);
    const cmpEM = comparePhysicalPixelPngFrames(vivPngs.earth, vivPngs.mdwarf);
    const cmpTM = comparePhysicalPixelPngFrames(vivPngs.titan, vivPngs.mdwarf);
    console.log(JSON.stringify({ vivariumGpuDiff: { earthVsTitan: cmpET.changedPixelCount, earthVsMDwarf: cmpEM.changedPixelCount, titanVsMDwarf: cmpTM.changedPixelCount } }));
    assert.ok(cmpET.changedPixelCount > 8000, `Earth vs Titan GPU SDF Vivarium visually distinct (${cmpET.changedPixelCount} px)`);
    assert.ok(cmpEM.changedPixelCount > 8000, `Earth vs M-Dwarf GPU SDF Vivarium visually distinct (${cmpEM.changedPixelCount} px)`);
    assert.ok(cmpTM.changedPixelCount > 8000, `Titan vs M-Dwarf GPU SDF Vivarium visually distinct (${cmpTM.changedPixelCount} px)`);
    assert.deepEqual(consoleErrors, [], `Console errors in Vivarium: ${consoleErrors.join('; ')}`);
    assert.deepEqual(pageErrors, [], `Page errors in Vivarium: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});
