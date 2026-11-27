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

    // 2. L1 Galactic Halo GPU Collapse & Coalescence
    const l1Gal = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.setLog10Span(20.6);
      await api.triggerGalaxyCoalescence();
      await api.stepOnce();
      await api.stepOnce();
      return api.getState();
    });
    assert.equal(l1Gal.gpuErrorCount, 0, `GPU errors on L1 galactic collapse: ${l1Gal.gpuErrors?.join(' | ')}`);
    await snap(page, '02-l1-galaxy-gpu-coalesce');

    // 3. L2 Whole-Star-System GPU Nebular Coalescence + Crystallization
    const l2Res = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.setLog10Span(13.2);
      await api.setSolarMode('formation');
      await api.stepOnce();
      await api.stepOnce();
      const formationState = api.getState();
      return { formationState };
    });
    assert.equal(l2Res.formationState.gpuErrorCount, 0, `GPU errors on L2 nebular formation: ${l2Res.formationState.gpuErrors?.join(' | ')}`);
    await snap(page, '03-l2-whole-system-nebular-coalescence');

    const crystallized = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      const sys = await api.crystallizeCoalescedSystem();
      await api.stepOnce();
      return {
        gpuCoalesced: Boolean(sys?.gpuCoalesced),
        planetCount: sys?.planetCount || 0,
        hasAsteroid: Boolean(sys?.catalog?.some((b) => b.isMetallicAsteroid && b.coalescedComposition?.gpuCoalesced)),
        hasComet: Boolean(sys?.catalog?.some((b) => b.isComet && b.coalescedComposition?.gpuCoalesced)),
        gpuErrorCount: api.getState().gpuErrorCount
      };
    });
    assert.equal(crystallized.gpuCoalesced, true, 'Crystallized star system must report gpuCoalesced=true');
    assert.ok(crystallized.planetCount >= 2, `Expected >= 2 coalesced planets (got ${crystallized.planetCount})`);
    assert.ok(crystallized.hasAsteroid && crystallized.hasComet, 'System must include GPU-coalesced asteroid and comet');
    assert.equal(crystallized.gpuErrorCount, 0);

    // 4. L4 3D Multi-Material WebGPU SPH Planetary Genesis (Earth Globe + Live Geologic Time + Seamless Surface!)
    const l4Earth = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.setUseSolReference(true);
      await api.setLevel(4, { instant: true });
      await api.focusSolarBody('earth');
      await api.stepOnce();
      const tel = api.getSphGenesisTelemetry();
      return { tel, st: api.getState() };
    });
    assert.ok(l4Earth.tel, 'Earth L4 must initialize 3D GPU SPH planetary genesis session');
    assert.ok(
      l4Earth.tel.felsicMeanR > l4Earth.tel.coreMeanR,
      `SPH buoyancy must differentiate buoyant felsic crust (${l4Earth.tel.felsicMeanR}) outside sinking Fe core (${l4Earth.tel.coreMeanR})`
    );
    assert.equal(l4Earth.st.gpuErrorCount, 0, `GPU errors on L4 SPH Earth: ${l4Earth.st.gpuErrors?.join(' | ')}`);
    await snap(page, '04-l4-earth-sph-globe');

    // Live 3D SPH Planetary Formation Replay (Mode 13 live parcels: Fe core, mantle plumes, felsic crust, impactors!)
    await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.triggerPlanetSphGenesisReplay();
      await api.stepOnce();
      await api.stepOnce();
    });
    await snap(page, '05-l4-live-3d-sph-formation');

    // Turn off live form and inspect Mars cratered SPH globe (full sunlit dayside!)
    await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      api.setPlanetaryGenesisLiveForm(false);
      await api.focusSolarBody('mars');
      await api.stepOnce();
    });
    await snap(page, '06-l4-mars-sph-craters');

    // Seamless Orbit -> Surface Touchdown on Earth with FULL-AUTHORITY SPH Patch starting at r = 0 m!
    // Re-focusing Earth after Mars ALSO verifies Root-Node Cosmic Lineage Cache HIT (zero redundant SPH re-sim!).
    const surfRes = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      const cacheBefore = api.getRootLineageCacheStats();
      await api.focusSolarBody('earth');
      const cacheAfter = api.getRootLineageCacheStats();
      await api.enterSurfaceView({ bodyIndex: 'earth', landingSite: { latDeg: 28, lonDeg: 18 } });
      await api.stepOnce();
      await api.stepOnce();
      const st = api.getState();
      return {
        cacheBefore,
        cacheAfter,
        surfaceActive: st.surfaceActive,
        sphGeologyActive: st.surfaceTelemetry?.sphGeologyActive,
        gpuErrorCount: st.gpuErrorCount,
        gpuErrors: st.gpuErrors
      };
    });
    assert.ok(
      surfRes.cacheAfter.hits > surfRes.cacheBefore.hits && surfRes.cacheAfter.localWrites >= 2,
      `Re-focusing cached Earth must hit Root Lineage Cache without re-simulating (before=${JSON.stringify(surfRes.cacheBefore)}, after=${JSON.stringify(surfRes.cacheAfter)})`
    );
    assert.equal(surfRes.surfaceActive, true, 'Must enter Earth surface cleanly');
    assert.equal(surfRes.sphGeologyActive, true, 'Landed surface must bind zero-copy GPU SPH geology patch at r=0m');
    assert.equal(surfRes.gpuErrorCount, 0, `GPU errors on SPH surface: ${surfRes.gpuErrors?.join(' | ')}`);
    await snap(page, '07-surface-earth-sph-terrain');

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
    assert.equal(accHeights.length, 6, 'Expected 6 Bio Lab accordion groups');
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
        acidParams: st.params,
        gpuErrorCount: st.gpuErrorCount
      };
    });
    assert.equal(foldCheck.bannerVisible, true, 'Organism provenance source banner must be visible on zoomed cellular/molecular layers');
    assert.ok(foldCheck.bannerTxt.includes('Caelibulla caerulea'), `Banner must display active organism name (got "${foldCheck.bannerTxt}")`);
    assert.equal(foldCheck.gpuErrorCount, 0);
    await snap(bioPage, '09-biolab-organism-derived-layer');

    // Switch organism to Titan CH4 cryo-world -> verify ALL 5 layers update directly from the Titan organism!
    const titanCheck = await bioPage.evaluate(async () => {
      const api = window.__ulgLifeLab;
      await api.applyXenobiologyPreset('titan-ch4');
      return api.getState();
    });
    assert.ok(titanCheck.params.memTempK < 130 && foldCheck.acidParams.memTempK > 300, 'Switching organisms must change Layer 1 membrane temperature');
    assert.notEqual(titanCheck.params.foldSeq, foldCheck.acidParams.foldSeq, 'Switching organisms must change Layer 2 protein sequence');
    assert.notEqual(titanCheck.params.evoStrongFrac, foldCheck.acidParams.evoStrongFrac, 'Switching organisms must change Layer 3 XNA stability');
    assert.notEqual(titanCheck.params.hhDeltaPsi, foldCheck.acidParams.hhDeltaPsi, 'Switching organisms must change Layer 4 bioenergetic deltaPsi');
    assert.notEqual(titanCheck.params.morphV0, foldCheck.acidParams.morphV0, 'Switching organisms must change Layer 5 motility v0');
    assert.equal(titanCheck.gpuErrorCount, 0);

    assert.equal(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `Unexpected console errors: ${consoleErrors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});
