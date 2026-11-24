import assert from 'node:assert/strict';
import test from 'node:test';

// Priority 1 Native Vulkan WebGPU Proof:
// End-to-end (Z, A) isotope & isotopologue propagation through:
//   1. Atomic reduced-mass shift & Fermi-contact hyperfine splitting (H-1 vs H-2, He-3 vs He-4)
//   2. Bulk crystal density, Debye temperature, and WebGPU MD (U-235 vs U-238, He-3 vs He-4)
//   3. Recursive isotopologue compounds (H2O vs D2O vs T2O; 235UF6 vs 238UF6)
//   4. Distinct isotope-keyed GPU Polytope Atlases
//   5. Live elements-lab.html?z=27&a=60 isotope UI + Chart of Nuclides + D2O compound flow

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Priority 1 native Vulkan proof: end-to-end (Z, A) isotopes, isotopologues, and elements-lab.html isotope UI', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Priority 1 proof',
  timeout: 240_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });

  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 250));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const { deriveElementBundleWebGpu } = await import('/src/runtime/material/periodicTableEngineWebGpu.js');
      const { deriveCompoundBundleWebGpu } = await import('/src/runtime/material/recursiveCompoundPipeline.js');
      const { buildMaterialPolytopeAtlasWebGpu } = await import('/src/runtime/material/polytopeAtlasBuilder.js');
      const { createMaterialPolytopeRegistry } = await import('/src/runtime/material/materialPolytopeRegistry.js');

      const opts = { runNuclearGpuVolume: false, runLiveMd: true, mdSteps: 10, atomicMaxScf: 45, blochGridN: 8 };
      const h1 = (await deriveElementBundleWebGpu(device, 1, { ...opts, massNumberA: 1 })).bundle;
      const h2 = (await deriveElementBundleWebGpu(device, 1, { ...opts, massNumberA: 2 })).bundle;
      const he3 = (await deriveElementBundleWebGpu(device, 2, { ...opts, massNumberA: 3 })).bundle;
      const he4 = (await deriveElementBundleWebGpu(device, 2, { ...opts, massNumberA: 4 })).bundle;
      const u235 = (await deriveElementBundleWebGpu(device, 92, { ...opts, massNumberA: 235 })).bundle;
      const u238 = (await deriveElementBundleWebGpu(device, 92, { ...opts, massNumberA: 238 })).bundle;

      const h2o = (await deriveCompoundBundleWebGpu(device, 'H2O', { runLiveMd: true, mdSteps: 8 })).bundle;
      const d2o = (await deriveCompoundBundleWebGpu(device, 'D2O', { runLiveMd: true, mdSteps: 8 })).bundle;
      const t2o = (await deriveCompoundBundleWebGpu(device, 'T2O', { runLiveMd: true, mdSteps: 8 })).bundle;
      const uf235 = (await deriveCompoundBundleWebGpu(device, '235UF6', { runLiveMd: false })).bundle;
      const uf238 = (await deriveCompoundBundleWebGpu(device, '238UF6', { runLiveMd: false })).bundle;

      const atlasU235 = await buildMaterialPolytopeAtlasWebGpu(device, u235, { degrees: [4, 3], maxBisectDepth: 1 });
      const atlasU238 = await buildMaterialPolytopeAtlasWebGpu(device, u238, { degrees: [4, 3], maxBisectDepth: 1 });
      const reg = createMaterialPolytopeRegistry();
      reg.registerMaterialPolytopes('U', atlasU235.polytopes, { massNumberA: 235 });
      reg.registerMaterialPolytopes('U', atlasU238.polytopes, { massNumberA: 238 });
      const regHit235 = reg.resolveState('U', { massNumberA: 235, temperatureK: 300, pressurePa: 101325 });
      const regHit238 = reg.resolveState('U', { massNumberA: 238, temperatureK: 300, pressurePa: 101325 });

      return {
        status: 'ok',
        gpuErrors,
        h1: {
          key: h1.materialKey,
          massU: h1.nuclear.atomicMassU,
          eHa: h1.atomic.totalEnergyHa,
          nmsHa: h1.atomic.isotopeMassShiftHa,
          hfsHz: h1.atomic.hyperfineSplittingHz,
          rho: h1.mechanical.densityKgPerM3,
          debyeK: h1.mechanical.debyeTemperatureK
        },
        h2: {
          key: h2.materialKey,
          massU: h2.nuclear.atomicMassU,
          eHa: h2.atomic.totalEnergyHa,
          nmsHa: h2.atomic.isotopeMassShiftHa,
          hfsHz: h2.atomic.hyperfineSplittingHz,
          rho: h2.mechanical.densityKgPerM3,
          debyeK: h2.mechanical.debyeTemperatureK
        },
        he3: { key: he3.materialKey, rho: he3.mechanical.densityKgPerM3, debyeK: he3.mechanical.debyeTemperatureK },
        he4: { key: he4.materialKey, rho: he4.mechanical.densityKgPerM3, debyeK: he4.mechanical.debyeTemperatureK },
        u235: { key: u235.materialKey, rho: u235.mechanical.densityKgPerM3, debyeK: u235.mechanical.debyeTemperatureK, atlasKey: atlasU235.materialKey },
        u238: { key: u238.materialKey, rho: u238.mechanical.densityKgPerM3, debyeK: u238.mechanical.debyeTemperatureK, atlasKey: atlasU238.materialKey },
        h2o: { key: h2o.materialKey, rho: h2o.mechanical.densityKgPerM3, tm: h2o.thermodynamic.meltingPointK, debyeK: h2o.mechanical.debyeTemperatureK },
        d2o: { key: d2o.materialKey, rho: d2o.mechanical.densityKgPerM3, tm: d2o.thermodynamic.meltingPointK, debyeK: d2o.mechanical.debyeTemperatureK },
        t2o: { key: t2o.materialKey, rho: t2o.mechanical.densityKgPerM3, tm: t2o.thermodynamic.meltingPointK, debyeK: t2o.mechanical.debyeTemperatureK },
        uf235: { key: uf235.materialKey, rho: uf235.mechanical.densityKgPerM3, m: uf235.nuclear.molarMassU },
        uf238: { key: uf238.materialKey, rho: uf238.mechanical.densityKgPerM3, m: uf238.nuclear.molarMassU },
        regHit235: { found: regHit235.found, id: regHit235.polytope?.polytopeId },
        regHit238: { found: regHit238.found, id: regHit238.polytope?.polytopeId }
      };
    });

    assert.equal(out.status, 'ok', 'Vulkan WebGPU adapter must be available');
    assert.deepEqual(out.gpuErrors, []);

    // H-1 vs H-2: reduced-mass shift (H-2 more tightly bound than H-1), hyperfine > 0, density & Debye mass scaling
    assert.equal(out.h1.key, 'H-1');
    assert.equal(out.h2.key, 'H-2');
    assert.ok(out.h2.eHa < out.h1.eHa, `D (H-2) atomic energy (${out.h2.eHa}) must be more bound than H-1 (${out.h1.eHa}) via reduced mass`);
    assert.ok(out.h1.hfsHz > 0, `H-1 must have non-zero Fermi-contact hyperfine splitting (got ${out.h1.hfsHz})`);
    assert.ok(out.h2.rho > out.h1.rho * 1.8, `H-2 density (${out.h2.rho}) must be ~2x H-1 (${out.h1.rho})`);
    assert.ok(out.h1.debyeK > out.h2.debyeK * 1.2, `H-1 Debye temp (${out.h1.debyeK}) must exceed H-2 (${out.h2.debyeK})`);

    // He-3 vs He-4
    assert.ok(out.he4.rho > out.he3.rho * 1.25);
    assert.ok(out.he3.debyeK > out.he4.debyeK * 1.1);

    // U-235 vs U-238 + distinct Polytope Atlas entries
    assert.equal(out.u235.key, 'U-235');
    assert.equal(out.u238.key, 'U-238');
    assert.ok(out.u238.rho > out.u235.rho * 1.008);
    assert.ok(out.u235.debyeK > out.u238.debyeK);
    assert.equal(out.regHit235.found, true);
    assert.equal(out.regHit238.found, true);
    assert.notEqual(out.regHit235.id, out.regHit238.id);

    // H2O vs D2O vs T2O isotopologues
    assert.ok(out.d2o.rho > out.h2o.rho * 1.09, `D2O density (${out.d2o.rho}) must exceed H2O (${out.h2o.rho}) by ~10-11%`);
    assert.ok(out.t2o.rho > out.d2o.rho * 1.08, `T2O density (${out.t2o.rho}) must exceed D2O (${out.d2o.rho})`);
    assert.ok(out.d2o.tm > out.h2o.tm + 1.0, `D2O melting point (${out.d2o.tm} K) must exceed H2O (${out.h2o.tm} K) via quantum ZPE shift`);
    assert.ok(out.h2o.debyeK > out.d2o.debyeK);

    // 235UF6 vs 238UF6
    assert.notEqual(out.uf235.key, out.uf238.key);
    assert.ok(out.uf238.m > out.uf235.m + 2.9);
    assert.ok(out.uf238.rho > out.uf235.rho * 1.005);

    // Interactive elements-lab.html?z=27&a=60 check (Co-60 + D2O)
    await page.goto(`${BASE_URL}elements-lab.html?z=27&a=60`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => window.__ulgElementsLabState?.isotope === 'Co-60', { timeout: 60_000 });
    const uiCo60 = await page.evaluate(() => ({
      isotope: window.__ulgElementsLabState.isotope,
      A: window.__ulgElementsLabState.A,
      chainLen: window.__ulgElementsLabState.decayChain?.steps?.length ?? 0,
      aInputVal: document.getElementById('a-input')?.value
    }));
    assert.equal(uiCo60.isotope, 'Co-60');
    assert.equal(uiCo60.A, 60);
    assert.equal(uiCo60.aInputVal, '60');
    assert.ok(uiCo60.chainLen >= 1, 'Co-60 UI must report decay chain');

    // Derive D2O in the compound input
    await page.fill('#compound-input', 'D2O');
    await page.click('#solve-compound-btn');
    await page.waitForFunction(() => window.__ulgElementsLabState?.mode === 'compound' && window.__ulgElementsLabState?.formula === 'D2O', { timeout: 60_000 });
    const uiD2o = await page.evaluate(() => ({
      key: window.__ulgElementsLabState.bundle.materialKey,
      rho: window.__ulgElementsLabState.bundle.mechanical.densityKgPerM3
    }));
    assert.ok(uiD2o.rho > 1000, `D2O UI density (${uiD2o.rho}) should reflect heavy water`);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
});
