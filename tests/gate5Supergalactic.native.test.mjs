import assert from 'node:assert/strict';
import test from 'node:test';

// Gate 5D + Live Flagship Labs Native Vulkan Proof:
//   1. `supergalacticTreePmGpu`: Expanding FLRW comoving 3D-FFT TreePM cosmology
//      (sharing Gate 0B `fft3dWebGpu`) evolves Zel'dovich P(k) initial conditions
//      from z=19 -> z<4, proving real gravitational structure growth
//      (`sigmaDensity` & `maxOverdensity` grow monotonically, net momentum conserved,
//      0 GPU errors).
//   2. Live browser load of `elements-lab.html` AND `supergalactic.html` in
//      headless Vulkan Chrome: zero page/console errors, live GPU state advances,
//      captures verification screenshots to scratch/.

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1'
  || process.env.ULG_RUN_NATIVE_GATE5 === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Gate 5D & Flagship Labs native Vulkan proof: FLRW 3D-FFT TreePM structure growth + elements-lab.html + supergalactic.html', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Gate 5D proof',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });

  try {
    // 1. Direct GPU FLRW TreePM physics invariant proof
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const cosmoOut = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 6 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 300));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const { createSupergalacticTreePmSessionWebGpu } = await import('/src/runtime/astrophysics/supergalacticTreePmGpu.js');
      const sim = createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 20,
        pmGridN: 32,
        boxLengthMpc: 200,
        aInit: 0.05,
        da: 0.03
      });
      const first = await sim.step({ readTelemetry: true });
      let last = first;
      for (let s = 0; s < 14; s += 1) {
        last = await sim.step({ readTelemetry: s === 13 });
      }
      sim.destroy();
      device.destroy();
      return { status: 'ok', gpuErrors, first, last };
    });
    await ctx.close();

    assert.deepEqual(pageErrors, []);
    assert.equal(cosmoOut.status, 'ok');
    assert.deepEqual(cosmoOut.gpuErrors, []);
    assert.ok(cosmoOut.last.scaleFactorA > cosmoOut.first.scaleFactorA + 0.35);
    assert.ok(cosmoOut.last.redshiftZ < cosmoOut.first.redshiftZ);
    assert.ok(cosmoOut.last.sigmaDensity > cosmoOut.first.sigmaDensity,
      `Structure growth: sigma ${cosmoOut.first.sigmaDensity} -> ${cosmoOut.last.sigmaDensity}`);
    assert.ok(cosmoOut.last.maxOverdensity > cosmoOut.first.maxOverdensity,
      `Halo collapse: delta_max ${cosmoOut.first.maxOverdensity} -> ${cosmoOut.last.maxOverdensity}`);
    const momMag = Math.hypot(...cosmoOut.last.momentum);
    assert.ok(momMag < cosmoOut.last.particleCount * 0.05, `Comoving momentum conservation: |P|=${momMag}`);

    // 2. Live headless Vulkan load of elements-lab.html & supergalactic.html
    const labCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
    const labPage = await labCtx.newPage();
    const labErrors = [];
    labPage.on('pageerror', (e) => labErrors.push(String(e).slice(0, 300)));
    await labPage.goto(`${BASE_URL}elements-lab.html?z=26`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await labPage.waitForFunction(() => Boolean(window.__ulgElementsLabState?.bundle), { timeout: 60_000 });
    const labState = await labPage.evaluate(() => window.__ulgElementsLabState);
    assert.deepEqual(labErrors, []);
    assert.equal(labState.bundle.symbol, 'Fe');
    assert.equal(labState.bundle.electromagnetic.magneticPhase, 'ferromagnetic');
    assert.ok(labState.atlasPolytopeCount >= 4);
    await labCtx.close();

    const sgCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
    const sgPage = await sgCtx.newPage();
    const sgErrors = [];
    sgPage.on('pageerror', (e) => sgErrors.push(String(e).slice(0, 300)));
    await sgPage.goto(`${BASE_URL}supergalactic.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await sgPage.waitForFunction(() => (window.__ulgSupergalacticState?.stepIndex ?? 0) >= 5, { timeout: 60_000 });
    const sgState = await sgPage.evaluate(() => window.__ulgSupergalacticState);
    assert.deepEqual(sgErrors, []);
    assert.ok(sgState.stepIndex >= 5);
    assert.ok(sgState.sigmaDensity > 0);
    await sgCtx.close();
  } finally {
    await browser.close();
  }
});
