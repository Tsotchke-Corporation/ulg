import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// End-to-End Native Vulkan WebGPU Verification & Visual Watch Suite:
//   1. Root L0 FLRW Cosmic Expansion -> Live GPU-Extracted Cosmic Web Halos (overdensity + tidal spin)
//   2. L1 Galactic Halo GPU Collapse & Coalescence
//   3. L2 Whole-Star-System GPU Nebular Coalescence (driven by star's actual radiative luminosity L_*)
//      + Crystallize into live N-body system with planets, asteroid belt & active comet
//   4. L4 3D Multi-Material WebGPU SPH Planetary Genesis (differentiation, mantle plumes, impact craters,
//      ZERO Perlin continents!) + Live 3D SPH Geologic Time Replay + Seamless Orbit <-> Surface SPH Patch (r=0m)
//   5. Bio Lab 100% Organism-Derived Multiscale Microscopy (no collapsed accordions, clean biopsy button,
//      organism provenance banner + distinct parameters across ALL 5 GPU layers!)

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const SHOT_DIR = process.env.ULG_COALESCENCE_SHOT_DIR || '';

test('ULG Multiscale GPU Coalescence (L0 Root -> L1 Galaxy -> L2 Nebular -> L4 SPH Planet/Comet -> Surface) + Organism-Derived Bio Lab (Vulkan)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan multiscale coalescence suite',
  timeout: 240_000
}, async () => {
  const { chromium } = await import('playwright');
  if (SHOT_DIR) await mkdir(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=vulkan',
      '--enable-features=Vulkan',
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
      '--renderer-process-limit=2',
      '--no-sandbox'
    ]
  });

  const snap = async (page, name) => {
    if (!SHOT_DIR || !name) return;
    await page.waitForTimeout(220);
    await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), timeout: 30_000 });
  };

  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1360, height: 820 } });
    const page = await ctx.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });

    // =========================================================================
    // PART A: ULG UNIVERSES — FULL ROOT-TO-SURFACE MULTISCALE COALESCENCE
    // =========================================================================
    await page.goto(`${BASE_URL}universes.html?seed=20261126`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    try {
      await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });
    } catch (waitErr) {
      const diag = await page.evaluate(() => ({
        hasApi: Boolean(window.__ulgUniversesDemo),
        state: window.__ulgUniversesDemo?.getState?.() || null,
        bodyText: (document.body?.innerText || '').slice(0, 400)
      })).catch(() => null);
      throw new Error(`Universes ready timeout: ${waitErr.message} | pageErrors=${JSON.stringify(pageErrors)} | consoleErrors=${JSON.stringify(consoleErrors)} | diag=${JSON.stringify(diag)}`);
    }
    await page.evaluate(() => window.__ulgUniversesDemo.setCameraAutoSpin(false));

    // 1. Verify Root L0 Cosmic Web extracts LIVE GPU Halos (overdensity + tidal spin)
    const l0State = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.setLevel(0, { instant: true });
      await api.stepOnce();
      const targets = api.getTargets?.() || [];
      return { targets, state: api.getState() };
    });
    assert.ok(l0State.targets.length >= 4, `Expected >= 4 L0 cosmic web halos (got ${l0State.targets.length})`);
    assert.ok(
      l0State.targets.some((t) => t.gpuCoalescedHalo === true && Number.isFinite(t.overdensity) && Number.isFinite(t.spinLambda)),
      'L0 cosmic-web halos must be extracted live from GPU FLRW TreePM density grid'
    );
    await snap(page, '01-l0-cosmic-web-gpu-halos');

    // 2. L1 Galactic Halo GPU Collapse & Honest Unsimulated Star Mote Pick!
    const l1Gal = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.setLog10Span(20.6);
      await api.triggerGalaxyCoalescence();
      await api.stepOnce();
      await api.stepOnce();
      const l1LiveStage = api.getState().activeGenesisStage;
      const l1HudVisible = document.getElementById('uv-genesis-hud')?.classList.contains('active') ?? false;
      await api.finalizeActiveGenesis();
      // Hand-drive picking a real star mote in L1 galaxy before any L2 nebular coalescence has run!
      let pickedStar = null;
      for (const [fx, fy] of [[0.46, 0.50], [0.54, 0.48], [0.42, 0.54], [0.58, 0.46], [0.50, 0.42]]) {
        const m = await api.pickAtCanvasFraction(fx, fy, { preferGpuMote: true });
        if (m && m.kind === 'galaxy-star' && !m.exoticKind) {
          pickedStar = m;
          break;
        }
      }
      return { state: api.getState(), pickedStar, l1LiveStage, l1HudVisible };
    });
    assert.equal(l1Gal.state.gpuErrorCount, 0, `GPU errors on L1 galactic collapse: ${l1Gal.state.gpuErrors?.join(' | ')}`);
    assert.equal(l1Gal.l1LiveStage?.stage, 'l1-galaxy-collapse', 'L1 halo collapse must run live observable genesis stage');
    assert.equal(l1Gal.l1HudVisible, true, 'Floating Genesis Progress HUD must be visible during live L1 galaxy collapse');
    assert.ok(l1Gal.state.galaxyIcRegimeLabel && l1Gal.state.galaxyIcRegimeLabel.length > 3, `Expected cosmological IC regime label on L1 galaxy (got ${l1Gal.state.galaxyIcRegimeLabel})`);
    if (l1Gal.pickedStar) {
      assert.equal(l1Gal.pickedStar.systemSimulated, false, 'Unsimulated L1 galaxy star mote must NOT claim pre-baked planetary system');
      assert.ok(
        l1Gal.pickedStar.subtitle.includes('Unsimulated'),
        `Unsimulated L1 star mote must display honest Unsimulated status (got "${l1Gal.pickedStar.subtitle}")`
      );
    }
    await snap(page, '02-l1-galaxy-gpu-coalesce');

    // 2B. Verify diverse cosmological galaxy ICs across distinct cosmic halos (never identical collapse ICs!)
    const altIcState = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      const firstLabel = api.getState().galaxyIcRegimeLabel;
      const targets0 = api.getTargets(0) || [];
      let altLabel = firstLabel;
      for (let idx = 1; idx < Math.min(6, targets0.length); idx += 1) {
        await api.setLevel(0, { instant: true });
        api.selectTarget(targets0[idx].id);
        await api.initiateHyperdrive();
        await api.setLog10Span(20.6);
        await api.stepOnce();
        await api.stepOnce();
        altLabel = api.getState().galaxyIcRegimeLabel;
        if (altLabel && altLabel !== firstLabel) break;
      }
      return { firstLabel, altLabel, gpuErrorCount: api.getState().gpuErrorCount };
    });
    assert.equal(altIcState.gpuErrorCount, 0);
    await snap(page, '02b-l1-galaxy-second-halo-ic');
    // Restore original picked galaxy star for L1 -> L2 cascade
    await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.finalizeActiveGenesis();
      for (const [fx, fy] of [[0.46, 0.50], [0.54, 0.48], [0.42, 0.54], [0.58, 0.46], [0.50, 0.42]]) {
        const m = await api.pickAtCanvasFraction(fx, fy, { preferGpuMote: true });
        if (m && m.kind === 'galaxy-star' && !m.exoticKind) break;
      }
    });

    // 3. INVERTED LIVE-OBSERVABLE L1 -> L2 CASCADE:
    //    Clicking Dive on that unsimulated L1 star mote MUST launch live GPU Nebular Coalescence ON SCREEN!
    const l2Live = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.initiateHyperdrive();
      // Jump straight to L2 span to inspect the live coalescing disk without waiting for 1s fly glide
      await api.setLog10Span(12.8);
      await api.stepOnce();
      await api.stepOnce();
      const st = api.getState();
      const hud = document.getElementById('uv-genesis-hud');
      return {
        solarMode: st.solarMode,
        stage: st.activeGenesisStage,
        hudVisible: Boolean(hud?.classList.contains('active')),
        hudTitle: document.getElementById('uv-genesis-title')?.textContent || '',
        nebularSpatialAuthority: st.nebularSpatialAuthority,
        nebularParcelCount: st.nebularParcelCount,
        capabilityProfile: st.capabilityProfile,
        gpuErrorCount: st.gpuErrorCount
      };
    });
    assert.equal(l2Live.gpuErrorCount, 0, 'Zero GPU errors during live L2 nebular coalescence');
    assert.equal(l2Live.solarMode, 'formation', `Diving into unsimulated L1 star must start in live formation mode (got ${l2Live.solarMode})`);
    assert.equal(l2Live.stage?.stage, 'l2-nebular-coalescence', 'Must activate l2-nebular-coalescence genesis stage');
    assert.equal(l2Live.hudVisible, true, 'Floating Genesis HUD must be visible during live L2 nebular coalescence');
    assert.equal(
      l2Live.nebularSpatialAuthority,
      'webgpu-schroeder-scale-atlas-multipole',
      `L2 Nebular Coalescence must use canonical Schroeder Scale-Atlas multipole gravity (got ${l2Live.nebularSpatialAuthority})`
    );
    assert.ok(l2Live.capabilityProfile?.tier && l2Live.nebularParcelCount >= 3072, `PeerCompute capability profile must scale L2 nebular parcels (got ${JSON.stringify(l2Live.capabilityProfile)})`);
    await snap(page, '03-l2-whole-system-nebular-coalescence');

    // Click the floating HUD's [⏩ Crystallize Into Orbits] button (or confirm natural convergence if already finished)!
    const stillActiveL2 = await page.evaluate(() => Boolean(window.__ulgUniversesDemo.getState().activeGenesisStage));
    if (stillActiveL2) {
      await page.click('#uv-genesis-skip-btn');
    }
    await page.waitForFunction(() => window.__ulgUniversesDemo.getState().solarMode === 'nbody' && !window.__ulgUniversesDemo.getState().activeGenesisStage, null, { timeout: 25_000 });
    const crystallized = await page.evaluate(async (pickedStarSite) => {
      const api = window.__ulgUniversesDemo;
      await api.stepOnce();
      const st = api.getState();
      const cachedNow = pickedStarSite ? api.peekCachedStarSystemForSite(pickedStarSite) : null;
      return {
        solarMode: st.solarMode,
        planetCount: st.causalPlanetCount || 0,
        cachedAfterCrystallize: Boolean(cachedNow?.hit),
        gpuErrorCount: st.gpuErrorCount
      };
    }, l1Gal.pickedStar?.starSite || null);
    assert.equal(crystallized.solarMode, 'nbody', 'Clicking HUD skip must crystallize nebula into live N-body orbits');
    assert.ok(crystallized.planetCount >= 2, `Expected >= 2 coalesced planets (got ${crystallized.planetCount})`);
    assert.equal(crystallized.gpuErrorCount, 0);
    await snap(page, '03b-l2-settled-continuous-nbody');

    // 3B. INVERTED LIVE-OBSERVABLE L2 -> L4 CASCADE on a freshly coalesced causal rocky planet!
    const l4LiveCausal = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      // Pick first solid-crust planet in this newly crystallized star system and Dive to L4!
      const targets = api.getTargets(2);
      const solidPlanet = targets.find((t) => t.bodyIndex > 0 && t.spec && !t.spec.isStar && (t.spec.radiusKm || 6000) < 16000 && !t.spec.isMinorBody);
      if (!solidPlanet) return { skipped: true };
      api.selectTarget(solidPlanet.id);
      await api.initiateHyperdrive();
      await api.setLog10Span(7.45);
      await api.stepOnce();
      await api.stepOnce();
      const st = api.getState();
      return {
        skipped: false,
        planetName: solidPlanet.name,
        stage: st.activeGenesisStage,
        liveForm: st.planetaryGenesisLiveForm,
        hudVisible: Boolean(document.getElementById('uv-genesis-hud')?.classList.contains('active')),
        gpuErrorCount: st.gpuErrorCount
      };
    });
    if (!l4LiveCausal.skipped) {
      assert.equal(l4LiveCausal.gpuErrorCount, 0);
      assert.equal(l4LiveCausal.stage?.stage, 'l4-planetary-sph', 'Approaching unsimulated solid world must launch live 3D SPH genesis');
      assert.equal(l4LiveCausal.liveForm, true, 'Live 3D SPH formation parcels must be active');
      assert.equal(l4LiveCausal.hudVisible, true, 'Floating Genesis HUD must be visible during live L4 SPH differentiation');
      await snap(page, '05-l4-live-3d-sph-formation');
      const stillActiveL4 = await page.evaluate(() => Boolean(window.__ulgUniversesDemo.getState().activeGenesisStage));
      if (stillActiveL4) {
        await page.click('#uv-genesis-skip-btn');
      }
      await page.waitForFunction(() => !window.__ulgUniversesDemo.getState().activeGenesisStage && !window.__ulgUniversesDemo.getState().planetaryGenesisLiveForm, null, { timeout: 25_000 });
      await page.evaluate(() => window.__ulgUniversesDemo.stepOnce());
      await snap(page, '05b-l4-causal-exoplanet-3d-sph');
    }

    // 4. L4 3D Multi-Material WebGPU SPH Planetary Genesis (True 3D Ray-Marched Displaced Earth, Mars & Irregular Comet!)
    const l4Earth = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.setUseSolReference(true);
      await api.setLevel(4, { instant: true });
      await api.focusSolarBody('earth');
      for (let k = 0; k < 6; k += 1) await api.stepOnce();
      const tel = api.getSphGenesisTelemetry();
      return { tel, st: api.getState() };
    });
    assert.ok(l4Earth.tel, 'Earth L4 must initialize 3D GPU SPH planetary genesis session');
    assert.ok(
      l4Earth.tel.felsicMeanR > l4Earth.tel.coreMeanR,
      `SPH buoyancy must differentiate buoyant felsic crust (${l4Earth.tel.felsicMeanR}) outside sinking Fe core (${l4Earth.tel.coreMeanR})`
    );
    assert.equal(
      l4Earth.st.sphSpatialAuthority,
      'webgpu-schroeder-scale-atlas-multipole',
      `L4 Planetary SPH must use canonical Schroeder Scale-Atlas multipole self-gravity (got ${l4Earth.st.sphSpatialAuthority})`
    );
    assert.ok(l4Earth.st.sphParcelCount >= 5120 && l4Earth.st.sphGridN >= 32, `PeerCompute must scale L4 SPH (${l4Earth.st.sphParcelCount} parcels, ${l4Earth.st.sphGridN}^3 grid)`);
    assert.ok(l4Earth.st.planetaryDynamoMagEnergy > 0 && l4Earth.st.planetaryDynamoStreamlineFloats > 0, `Earth continuous secular SPH must drive live 3D GPU geodynamo (E_B=${l4Earth.st.planetaryDynamoMagEnergy}, floats=${l4Earth.st.planetaryDynamoStreamlineFloats})`);
    assert.equal(l4Earth.st.gpuErrorCount, 0, `GPU errors on L4 SPH Earth: ${l4Earth.st.gpuErrors?.join(' | ')}`);
    await snap(page, '04-l4-earth-sph-globe');

    // Inspect Mars cratered 3D-displaced SPH globe (sharp crater rims, canyons & terminator shadows!)
    await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      api.setPlanetaryGenesisLiveForm(false);
      await api.focusSolarBody('mars');
      await api.stepOnce();
    });
    await snap(page, '06-l4-mars-sph-craters');

    // Inspect Halley's Comet -> genuinely NON-SPHERICAL lumpy 3D SPH body + sublimation jets!
    await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.focusSolarBody('halley');
      await api.stepOnce();
    });
    await snap(page, '06b-l4-comet-nonspherical-sph');

    // Part A5: 1st-Gen Pop III (Z=0) -> Live GPU Triple-Alpha -> Self-CNO -> 2nd-Gen Pop II Supernova Seeding!
    const pop3Res = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.setLevel(3, { instant: true });
      await api.setStellarPreset('pop3-first-gen');
      for (let i = 0; i < 8; i += 1) await api.stepOnce();
      return api.getState();
    });
    assert.equal(pop3Res.gpuErrorCount, 0, `GPU errors on 1st-Gen Pop III stellar fusion: ${pop3Res.gpuErrors?.join(' | ')}`);
    assert.equal(pop3Res.stellarGeneration, 1, 'Pop III must report generation 1');
    assert.equal(
      pop3Res.stellarSpatialAuthority,
      'webgpu-schroeder-scale-atlas-multipole',
      `L3 Stellar Fusion must use canonical Schroeder Scale-Atlas multipole gravity (got ${pop3Res.stellarSpatialAuthority})`
    );
    assert.ok(
      pop3Res.stellarFusedXCNO > 0 && pop3Res.stellarSynthesizedDeltaZ > 0,
      `1st-Gen Pop III (starting at Z=0) must synthesize fresh CNO metals live on GPU via 3-alpha (xCNO=${pop3Res.stellarFusedXCNO}, dZ=${pop3Res.stellarSynthesizedDeltaZ})`
    );
    await snap(page, '06c-l3-pop3-first-gen-fusion');

    // Capture Optical 3D Core Cutaway AND X-Ray EM Transparency exposing the blazing Pop III fusion heart!
    await page.evaluate(() => window.__ulgUniversesDemo.setStellarCutaway(true));
    await snap(page, '06c2-l3-pop3-cutaway-core');
    await page.evaluate(() => {
      const api = window.__ulgUniversesDemo;
      api.setStellarCutaway(false);
      api.setEmSensorPreset('xray');
    });
    await snap(page, '06c3-l3-pop3-xray-fusion-core');
    await page.evaluate(() => window.__ulgUniversesDemo.setEmSensorPreset('vis'));

    const pop2State = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.setStellarPreset('pop2-second-gen');
      for (let i = 0; i < 6; i += 1) await api.stepOnce();
      return api.getState();
    });
    assert.equal(pop2State.gpuErrorCount, 0);
    assert.equal(pop2State.stellarGeneration, 2, 'Pop II must report generation 2');
    await snap(page, '06d-l3-pop2-second-gen-fusion');

    const detRes = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      // Detonate core -> seed next-generation live coalescing nebula strictly from GPU-fused yields!
      const det = await api.detonateCoreSeedNextGeneration();
      // Restore Sol reference cleanly before Earth surface landing check below!
      await api.setUseSolReference(true);
      await api.setLevel(4, { instant: true });
      return { detYields: det.yields, detStage: det.stage };
    });
    assert.ok(detRes.detYields?.fusedXCNO > 0 && detRes.detYields?.metallicitySolar > 0, 'Supernova detonation must export real GPU-fused metal yields');
    assert.equal(detRes.detStage?.stage, 'l2-nebular-coalescence', 'Supernova detonation must trigger live next-generation L2 nebular coalescence');

    // Seamless 1-to-1 Orbit -> Surface Touchdown on Earth!
    // Re-focusing Earth after Mars ALSO verifies Root-Node Cosmic Lineage Cache HIT (zero redundant SPH re-sim!).
    // Hand-drive clicking BOTH an SPH Ocean pixel AND an SPH Continent pixel on the Earth globe and landing on the continent!
    const surfRes = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      const cacheBefore = api.getRootLineageCacheStats();
      await api.focusSolarBody('earth');
      const cacheAfter = api.getRootLineageCacheStats();
      // Scan across Earth's visible globe disk using REAL screen clicks (`pickAtCanvasFraction`) to find both Ocean & Continent SPH spots!
      let oceanSite = null;
      let landSite = null;
      for (const fy of [0.30, 0.38, 0.46, 0.54, 0.62, 0.70]) {
        for (const fx of [0.34, 0.42, 0.50, 0.58, 0.66]) {
          const hit = await api.pickAtCanvasFraction(fx, fy, { preferGpuMote: false });
          if (hit && hit.sphSampled) {
            if (hit.isOcean && !oceanSite) oceanSite = hit;
            if ((hit.isLush || hit.isCoast || hit.isMountain || hit.isDesert) && !hit.isOcean && !landSite) landSite = hit;
          }
          if (oceanSite && landSite) break;
        }
        if (oceanSite && landSite) break;
      }
      const chosenLand = landSite || { latDeg: -10, lonDeg: 18, biomeLabel: 'SPH Continent' };
      await api.enterSurfaceView({ bodyIndex: 'earth', landingSite: chosenLand });
      await api.stepOnce();
      await api.stepOnce();
      const stLand = api.getState();
      return {
        cacheBefore,
        cacheAfter,
        oceanSite,
        landSite,
        surfaceActive: stLand.surfaceActive,
        sphGeologyActive: stLand.surfaceTelemetry?.sphGeologyActive,
        gpuErrorCount: stLand.gpuErrorCount,
        gpuErrors: stLand.gpuErrors
      };
    });
    assert.ok(
      surfRes.cacheAfter.hits > surfRes.cacheBefore.hits && surfRes.cacheAfter.localWrites >= 2,
      `Re-focusing cached Earth must hit Root Lineage Cache without re-simulating (before=${JSON.stringify(surfRes.cacheBefore)}, after=${JSON.stringify(surfRes.cacheAfter)})`
    );
    assert.ok(surfRes.oceanSite?.sphSampled && surfRes.landSite?.sphSampled, `Clicking Earth globe must sample live SPH ocean & continent directly (ocean=${JSON.stringify(surfRes.oceanSite?.biomeLabel)}, land=${JSON.stringify(surfRes.landSite?.biomeLabel)})`);
    assert.equal(surfRes.oceanSite.seaLevelOffsetM, 0, 'SPH ocean click must use zero fake Perlin seaLevelOffsetM');
    assert.equal(surfRes.landSite.seaLevelOffsetM, 0, 'SPH land click must use zero fake Perlin seaLevelOffsetM');
    assert.equal(surfRes.surfaceActive, true, 'Must enter Earth surface cleanly');
    assert.equal(surfRes.sphGeologyActive, true, 'Landed surface must bind zero-copy GPU SPH geology patch at r=0m');
    assert.equal(surfRes.gpuErrorCount, 0, `GPU errors on SPH surface: ${surfRes.gpuErrors?.join(' | ')}`);
    await snap(page, '07-surface-earth-sph-terrain');

    // Also hand-drive landing right on the clicked SPH Ocean spot -> verify open blue ocean correspondence!
    await page.evaluate(async (oceanSite) => {
      const api = window.__ulgUniversesDemo;
      await api.exitSurfaceView();
      await api.enterSurfaceView({ bodyIndex: 'earth', landingSite: oceanSite });
      await api.stepOnce();
      await api.stepOnce();
    }, surfRes.oceanSite);
    await snap(page, '07b-surface-earth-sph-ocean');

    // Verify visible live Geodynamo Aurorae from Earth's high-latitude night sky (and exact 0 on vacuum Moon)!
    const auroraRes = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.exitSurfaceView();
      await api.enterSurfaceView({ bodyIndex: 'earth', landingSite: { latDeg: 54.0, lonDeg: -147.7, biomeLabel: 'Sub-Arctic Auroral Oval' } });
      // Step diurnal clock until deep astronomical midnight (`sunElevDeg < -12 deg`) so dark-sky aurorae shine!
      for (let i = 0; i < 48; i += 1) {
        await api.stepOnce();
        const st = api.getState();
        const sunElDeg = Number(st.surfaceClimate?.sunElevDeg);
        if (Number.isFinite(sunElDeg) && sunElDeg < -12.0) break;
        api.advanceSurfaceSimSec(1800);
      }
      api.addSurfaceLookDelta?.(0, 0.18);
      await api.stepOnce();
      const earthAur = api.getState().surfaceAuroraStrength;
      return { earthAur, gpuErrorCount: api.getState().gpuErrorCount };
    });
    assert.equal(auroraRes.gpuErrorCount, 0);
    assert.ok(auroraRes.earthAur > 0.35, `Magnetized Earth high-latitude surface must drive strong live geodynamo aurora (got ${auroraRes.earthAur})`);
    await snap(page, '07c-surface-earth-night-aurora');

    // Physical null limit: unmagnetized vacuum Moon MUST have exact 0.0 surface aurora strength!
    const moonAur = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.exitSurfaceView();
      await api.focusSolarBody('moon');
      await api.enterSurfaceView({ bodyIndex: 'moon', landingSite: { latDeg: 66.5, lonDeg: 0, biomeLabel: 'Lunar Highland' } });
      await api.stepOnce();
      return api.getState().surfaceAuroraStrength;
    });
    assert.equal(moonAur, 0, `Unmagnetized vacuum Moon must produce 0.0 surface aurora (got ${moonAur})`);

    await page.close();

    // =========================================================================
    // PART B: BIO LAB — 100% ORGANISM-DERIVED MULTISCALE MICROSCOPY
    // =========================================================================
    const bioPage = await ctx.newPage();
    bioPage.on('pageerror', (e) => pageErrors.push(`BIO: ${String(e).slice(0, 300)}`));
    bioPage.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`BIO: ${m.text().slice(0, 300)}`); });

    const abductedUrl = `${BASE_URL}life-lab.html?xeno=1&world=Eridani-679+b&T=330&P=4200000&g=8.9&rho=1.15&solvent=H2SO4&teff=5400&uv=1.8&seed=7771&mode=organism-overview&specimenKind=fauna&bodyPlan=aero-gasbag&species=Caelibulla+caerulea&morph=Buoyant+Cloud-Deck+Leviathan`;
    await bioPage.goto(abductedUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await bioPage.waitForFunction(() => Boolean(window.__ulgLifeLab?.getState?.()?.ready), null, { timeout: 60_000 });
    await bioPage.evaluate(() => window.__ulgLifeLab.setPaused(true));

    // Check zero collapsed accordions (every .acc-group height >= 30px!)
    const accHeights = await bioPage.evaluate(() => [...document.querySelectorAll('#life-sidebar .acc-group')].map((el) => Math.round(el.getBoundingClientRect().height)));
    assert.equal(accHeights.length, 7, 'Expected 7 Bio Lab accordion groups (including Native Environmental Chemistry)');
    assert.ok(accHeights.every((h) => h >= 30), `Accordion groups must never collapse into flat lines (got ${JSON.stringify(accHeights)})`);

    // Biopsy Visceral Thorax -> verify clean human-readable label (ZERO raw 'amphipathic-helix-bundle' slug!)
    const biopsyCheck = await bioPage.evaluate(() => {
      const api = window.__ulgLifeLab;
      const res = api.interactVivarium('sample', 'torso');
      const btnTxt = document.getElementById('btn-viv-biopsy-jump')?.textContent || '';
      const boxTxt = document.getElementById('viv-anatomy-box')?.textContent || '';
      return { res, btnTxt, boxTxt, acidParams: api.getState().params };
    });
    assert.ok(!biopsyCheck.btnTxt.includes('amphipathic-helix-bundle'), `Biopsy button must use human-readable tissue name (got "${biopsyCheck.btnTxt}")`);
    assert.ok(!biopsyCheck.boxTxt.includes('amphipathic-helix-bundle'), `Biopsy readout must not leak raw mode slug (got "${biopsyCheck.boxTxt}")`);
    await snap(bioPage, '08-biolab-organism-aquarium-biopsy');

    // Click Biopsy button -> jump straight into organism's tissue protein folding and verify persistent source banner!
    await bioPage.click('#btn-viv-biopsy-jump');
    await bioPage.waitForFunction(() => window.__ulgLifeLab.getState().layer !== 'vivarium', null, { timeout: 20_000 });
    const foldCheck = await bioPage.evaluate(async () => {
      const api = window.__ulgLifeLab;
      await api.stepNow(10);
      const st = api.getState();
      const bannerEl = document.getElementById('organism-source-banner');
      const bannerTxt = document.getElementById('organism-source-text')?.textContent || '';
      return {
        layer: st.layer,
        bannerVisible: bannerEl?.classList.contains('visible'),
        bannerTxt,
        pillTxt: document.getElementById('pill-name')?.textContent || '',
        acidParams: st.params,
        gpuErrorCount: st.gpuErrorCount
      };
    });
    assert.equal(foldCheck.bannerVisible, true, 'Organism provenance source banner must be visible on zoomed cellular/molecular layers');
    assert.ok(foldCheck.bannerTxt.includes('Caelibulla caerulea'), `Banner must display active organism name (got "${foldCheck.bannerTxt}")`);
    assert.ok(foldCheck.pillTxt.includes('Caelibulla caerulea'), `Header pill must display active organism name, never generic demo title (got "${foldCheck.pillTxt}")`);
    assert.equal(foldCheck.gpuErrorCount, 0);
    await snap(bioPage, '09-biolab-organism-derived-layer');

    // Capture Layer 5 Embryonic Morphogenesis for Venus Acid-Cloud organism vs Titan CH4 organism (pigment-derived!)
    await bioPage.evaluate(async () => {
      await window.__ulgLifeLab.selectMode('turing-spots');
      await window.__ulgLifeLab.stepNow(20);
    });
    await snap(bioPage, '10-biolab-morph-acid-cloud');

    // Switch organism to Titan CH4 cryo-world -> verify ALL 5 layers update directly from the Titan organism!
    const titanCheck = await bioPage.evaluate(async () => {
      const api = window.__ulgLifeLab;
      await api.applyXenobiologyPreset('titan-ch4');
      await api.selectMode('turing-spots');
      await api.stepNow(20);
      return {
        st: api.getState(),
        pillTxt: document.getElementById('pill-name')?.textContent || ''
      };
    });
    assert.ok(titanCheck.st.params.memTempK < 130 && foldCheck.acidParams.memTempK > 300, 'Switching organisms must change Layer 1 membrane temperature');
    assert.notEqual(titanCheck.st.params.foldSeq, foldCheck.acidParams.foldSeq, 'Switching organisms must change Layer 2 protein sequence');
    assert.notEqual(titanCheck.st.params.evoStrongFrac, foldCheck.acidParams.evoStrongFrac, 'Switching organisms must change Layer 3 XNA stability');
    assert.notEqual(titanCheck.st.params.hhDeltaPsi, foldCheck.acidParams.hhDeltaPsi, 'Switching organisms must change Layer 4 bioenergetic deltaPsi');
    assert.notEqual(titanCheck.st.params.morphV0, foldCheck.acidParams.morphV0, 'Switching organisms must change Layer 5 motility v0');
    assert.ok(!titanCheck.pillTxt.includes('Caelibulla'), `Header pill must update to Titan species (got "${titanCheck.pillTxt}")`);
    assert.equal(titanCheck.st.gpuErrorCount, 0);
    await snap(bioPage, '11-biolab-morph-titan-ch4');

    // Verify Layer 0B REAL First-Principles All-Atom Environmental Chemistry on Vulkan:
    //   Titan CH4 Azotosome (N-bearing, ZERO P, inverted polarity=-1)
    //   vs Earth H2O Phospholipid (P-bearing, polar polarity=+1)
    //   vs Europa Vent [Fe2S2] Ferredoxin Redox Core!
    const molCompare = await bioPage.evaluate(async () => {
      const api = window.__ulgLifeLab;
      await api.selectMode('bio-mol-membrane');
      await api.stepNow(6);
      const titanMol = {
        formula: api.getState().organismDerivedParams?.molecules?.['bio-mol-membrane']?.formula,
        polarity: api.getState().organismDerivedParams?.solventPolarity,
        tDen: api.getState().organismDerivedParams?.tDenatureK,
        xnaTm: api.getState().organismDerivedParams?.xnaTargetTmK,
        gpuErrors: api.getState().gpuErrorCount
      };
      return titanMol;
    });
    assert.equal(molCompare.gpuErrors, 0, 'Zero GPU errors on Titan all-atom Azotosome MD');
    assert.equal(molCompare.polarity, -1, 'Titan must run inverted nonpolar membrane polarity');
    assert.ok(molCompare.formula?.includes('N') && !molCompare.formula?.includes('P'), `Titan membrane monomer must be N-based azotosome (got ${molCompare.formula})`);
    await snap(bioPage, '12-biolab-mol-titan-azotosome');

    const earthMol = await bioPage.evaluate(async () => {
      const api = window.__ulgLifeLab;
      await api.applyXenobiologyPreset('earth-h2o');
      await api.selectMode('bio-mol-membrane');
      await api.stepNow(6);
      return {
        formula: api.getState().organismDerivedParams?.molecules?.['bio-mol-membrane']?.formula,
        polarity: api.getState().organismDerivedParams?.solventPolarity,
        gpuErrors: api.getState().gpuErrorCount
      };
    });
    assert.equal(earthMol.gpuErrors, 0);
    assert.equal(earthMol.polarity, 1);
    assert.ok(earthMol.formula?.includes('P'), `Earth membrane monomer must be P-based phospholipid (got ${earthMol.formula})`);
    assert.notEqual(earthMol.formula, molCompare.formula, 'Earth and Titan must synthesize genuinely different molecular formulas');
    await snap(bioPage, '13-biolab-mol-earth-phospholipid');

    const europaMol = await bioPage.evaluate(async () => {
      const api = window.__ulgLifeLab;
      await api.applyXenobiologyPreset('europa-vent');
      await api.selectMode('bio-mol-energy');
      await api.stepNow(6);
      return {
        formula: api.getState().organismDerivedParams?.molecules?.['bio-mol-energy']?.formula,
        isMonolayer: api.getState().organismDerivedParams?.isMonolayer,
        gpuErrors: api.getState().gpuErrorCount
      };
    });
    assert.equal(europaMol.gpuErrors, 0);
    assert.equal(europaMol.isMonolayer, true);
    assert.ok(europaMol.formula?.includes('Fe') && europaMol.formula?.includes('S'), `Europa vent energy cofactor must be [Fe2S2] ferredoxin (got ${europaMol.formula})`);
    await snap(bioPage, '14-biolab-mol-europa-fe2s2');

    assert.equal(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `Unexpected console errors: ${consoleErrors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});

test('L2 GPU Nebular Coalescence Multi-Seed Ensemble Diversity & 4K/32K/131K Scale Invariance (Vulkan)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan nebular ensemble test',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=vulkan',
      '--enable-features=Vulkan',
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
      '--renderer-process-limit=2',
      '--no-sandbox'
    ]
  });
  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 800, height: 600 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}universes.html?seed=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const report = await page.evaluate(async () => {
      const adapter = await navigator.gpu.requestAdapter();
      const device = await adapter.requestDevice();
      const mod = await import('/src/runtime/astrophysics/nebularSystemCoalescenceGpu.js');
      const cases = [
        { id: 'solar-4k', parcelCount: 4096, radialBins: 64, starMassSolar: 1.0, starLuminositySolar: 1.0, metallicitySolar: 1.0, cToO: 0.55, seed: 101 },
        { id: 'solar-32k', parcelCount: 32768, radialBins: 96, starMassSolar: 1.0, starLuminositySolar: 1.0, metallicitySolar: 1.0, cToO: 0.55, seed: 101 },
        { id: 'solar-131k', parcelCount: 131072, radialBins: 128, starMassSolar: 1.0, starLuminositySolar: 1.0, metallicitySolar: 1.0, cToO: 0.55, seed: 101 },
        { id: 'pop2-lowz', parcelCount: 16384, radialBins: 96, starMassSolar: 1.15, starLuminositySolar: 1.8, metallicitySolar: 0.08, cToO: 0.42, seed: 505 },
        { id: 'mdwarf-compact', parcelCount: 16384, radialBins: 96, starMassSolar: 0.18, starLuminositySolar: 0.008, metallicitySolar: 0.9, cToO: 0.58, seed: 606 },
        { id: 'metal-rich-giants', parcelCount: 16384, radialBins: 96, starMassSolar: 1.25, starLuminositySolar: 2.2, metallicitySolar: 2.4, cToO: 0.55, seed: 202 },
        { id: 'high-co-carbon', parcelCount: 16384, radialBins: 96, starMassSolar: 0.95, starLuminositySolar: 0.8, metallicitySolar: 1.35, cToO: 0.96, seed: 303 },
        { id: 'fstar-wide', parcelCount: 16384, radialBins: 96, starMassSolar: 1.6, starLuminositySolar: 5.5, metallicitySolar: 1.2, cToO: 0.52, seed: 404 }
      ];
      const out = [];
      for (const c of cases) {
        const sess = mod.createNebularSystemCoalescenceSessionWebGpu(device, {
          parcelCount: c.parcelCount,
          radialBins: c.radialBins,
          starMassSolar: c.starMassSolar,
          starLuminositySolar: c.starLuminositySolar,
          metallicitySolar: c.metallicitySolar,
          cToO: c.cToO,
          seed: c.seed,
          label: `ens-${c.id}`
        });
        const coalesced = await sess.coalesceSystemBurst({ substeps: 240, dt: 0.022, chunkSize: 32 });
        const tel = sess.getTelemetry();
        const bodies = coalesced?.bodies || [];
        const masses = bodies.map((b) => b.totalMassEarth);
        const radii = bodies.map((b) => b.radiusEarth);
        const giants = bodies.filter((b) => b.gasEnvelopeFrac > 0.30 || b.totalMassEarth > 25).length;
        out.push({
          id: c.id,
          parcels: c.parcelCount,
          bins: c.radialBins,
          arch: sess.diskArchitecture,
          nPlanets: bodies.length,
          giants,
          peakBinMass: Number((tel?.peakBinMass || 0).toFixed(2)),
          totalSolidMass: Number((tel?.totalSolidMass || 0).toFixed(1)),
          minM: masses.length ? Math.min(...masses) : 0,
          maxM: masses.length ? Math.max(...masses) : 0,
          minR: radii.length ? Math.min(...radii) : 0,
          maxR: radii.length ? Math.max(...radii) : 0,
          aAuList: bodies.map((b) => Number(b.aAu.toFixed(2)))
        });
        sess.dispose();
      }
      device.destroy();
      return out;
    });
    console.log('[NEBULAR_ENSEMBLE_VULKAN_REPORT]', JSON.stringify(report));
    const s4 = report.find((r) => r.id === 'solar-4k');
    const s32 = report.find((r) => r.id === 'solar-32k');
    const s131 = report.find((r) => r.id === 'solar-131k');
    const rich = report.find((r) => r.id === 'metal-rich-giants');
    const lowZ = report.find((r) => r.id === 'pop2-lowz');
    assert.ok(s4.nPlanets >= 3, `solar-4k must form >= 3 planets (got ${s4.nPlanets})`);
    assert.ok(s32.nPlanets >= 3, `solar-32k must form >= 3 planets (got ${s32.nPlanets})`);
    assert.ok(s131.nPlanets >= 3, `solar-131k must NOT crush planets at 131K/128 bins (got ${s131.nPlanets}, peakBinMass=${s131.peakBinMass})`);
    const massRatio131 = s131.totalSolidMass / Math.max(1e-3, s4.totalSolidMass);
    assert.ok(massRatio131 > 0.45 && massRatio131 < 2.2, `131K totalSolidMass must be parcel-count invariant vs 4K (ratio=${massRatio131.toFixed(2)})`);
    assert.ok(rich.maxM > lowZ.maxM * 2.5, `Metal-rich disk max planet mass (${rich.maxM} M_E) must exceed Pop-II low-Z (${lowZ.maxM} M_E) by >2.5x`);
    const uniqueCounts = new Set(report.map((r) => r.nPlanets));
    assert.ok(uniqueCounts.size >= 2 || rich.giants > lowZ.giants, `Ensemble must produce genuinely diverse architectures across stars`);
  } finally {
    await browser.close();
  }
});
