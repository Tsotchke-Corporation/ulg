import assert from 'node:assert/strict';
import test from 'node:test';

// Gate 5D + Live Flagship Labs Native Vulkan Proof:
//   1. `supergalacticTreePmGpu`: Full-Nyquist GPU Zel'dovich ICs (`buildZeldovichCosmologyICsWebGpu`)
//      + 1-submit/step Expanding FLRW Comoving Symplectic KDK 3D-FFT TreePM (`fft3dWebGpu`):
//      proves `submitsPerStep === 1`, live 16-bin GPU `P(k)` power-spectrum growth, monotonic
//      `sigmaDensity` & `maxOverdensity` growth, tight linear momentum conservation, 0 GPU errors.
//   2. Live headless Vulkan load of `elements-lab.html`, `supergalactic.html` (`cameraAutoSpin: false`,
//      live GPU `P(k)`), AND `cosmic-quantum.html` stepping `supergalactic-cosmic` (`B7` regression proof!).

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1'
  || process.env.ULG_RUN_NATIVE_GATE5 === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Gate 5D & Flagship Labs native Vulkan proof: 1-submit GPU Zel\'dovich FLRW 3D-FFT TreePM + GPU P(k) + cosmic-quantum supergalactic-cosmic', {
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
    // 1. Direct GPU Zel'dovich + 1-submit FLRW TreePM + GPU P(k) invariant proof
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

      const {
        buildZeldovichCosmologyICsWebGpu,
        createSupergalacticTreePmSessionWebGpu
      } = await import('/src/runtime/astrophysics/supergalacticTreePmGpu.js');

      const gpuIc = await buildZeldovichCosmologyICsWebGpu(device, {
        gridPerSide: 20,
        fftGridN: 32,
        boxLengthMpc: 200,
        aInit: 0.05,
        amplitude: 0.40,
        seed: 20261123
      });
      const sim = createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 20,
        pmGridN: 32,
        boxLengthMpc: 200,
        aInit: 0.05,
        da: 0.03,
        initialConditions: gpuIc
      });
      const first = await sim.step({ readTelemetry: true });
      let last = first;
      for (let s = 0; s < 14; s += 1) {
        last = await sim.step({ readTelemetry: s === 13 });
      }
      sim.destroy();
      device.destroy();
      return { status: 'ok', gpuErrors, icBackend: gpuIc.icBackend, first, last };
    });
    await ctx.close();

    assert.deepEqual(pageErrors, []);
    assert.equal(cosmoOut.status, 'ok');
    assert.deepEqual(cosmoOut.gpuErrors, []);
    assert.equal(cosmoOut.icBackend, 'webgpu-fft3d-zeldovich-full-nyquist');
    assert.equal(cosmoOut.last.submitsPerStep, 1, `TreePM must fuse into 1 submit/step (got ${cosmoOut.last.submitsPerStep})`);
    assert.equal(cosmoOut.last.integrator, 'symplectic-comoving-kdk');
    assert.ok(cosmoOut.last.scaleFactorA > cosmoOut.first.scaleFactorA + 0.35);
    assert.ok(cosmoOut.last.redshiftZ < cosmoOut.first.redshiftZ);
    assert.ok(cosmoOut.last.sigmaDensity > cosmoOut.first.sigmaDensity,
      `Structure growth: sigma ${cosmoOut.first.sigmaDensity} -> ${cosmoOut.last.sigmaDensity}`);
    assert.ok(cosmoOut.last.maxOverdensity > cosmoOut.first.maxOverdensity,
      `Halo collapse: delta_max ${cosmoOut.first.maxOverdensity} -> ${cosmoOut.last.maxOverdensity}`);
    // Live GPU P(k) power-spectrum assertions
    assert.ok(cosmoOut.first.powerSpectrumPk.kBins.length >= 6, 'GPU P(k) must populate >= 6 radial k-shells');
    assert.ok(cosmoOut.last.powerSpectrumPk.lowKPower > cosmoOut.first.powerSpectrumPk.lowKPower,
      `GPU P(k) low-k power must grow with a(t): ${cosmoOut.first.powerSpectrumPk.lowKPower} -> ${cosmoOut.last.powerSpectrumPk.lowKPower}`);
    assert.ok(cosmoOut.last.powerSpectrumPk.linearGrowthRatio > 1.05,
      `Linear growth ratio D(a)/D0 must exceed 1.05 (got ${cosmoOut.last.powerSpectrumPk.linearGrowthRatio})`);
    // Tight float32 comoving momentum conservation
    const momMag = Math.hypot(...cosmoOut.last.momentum);
    const meanSpeed = Math.sqrt((2 * Math.max(1e-6, cosmoOut.last.kineticEnergy)) / cosmoOut.last.particleCount);
    const relMom = momMag / Math.max(1e-3, cosmoOut.last.particleCount * meanSpeed);
    assert.ok(relMom < 2e-2, `Comoving linear momentum conservation failed: |P|=${momMag}, rel=${relMom}`);

    // 2. Live headless Vulkan load of elements-lab.html
    const labCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
    const labPage = await labCtx.newPage();
    const labErrors = [];
    labPage.on('pageerror', (e) => labErrors.push(String(e).slice(0, 300)));
    await labPage.goto(`${BASE_URL}elements-lab.html?z=26`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await labPage.waitForFunction(
      () => Boolean(window.__ulgElementsLabState?.bundle) && (window.__ulgElementsLabState?.atlasPolytopeCount ?? 0) >= 4,
      null,
      { timeout: 60_000 }
    );
    const labState = await labPage.evaluate(() => window.__ulgElementsLabState);
    assert.deepEqual(labErrors, []);
    assert.equal(labState.bundle.symbol, 'Fe');
    assert.equal(labState.bundle.electromagnetic.magneticPhase, 'ferromagnetic');
    assert.ok(labState.atlasPolytopeCount >= 4);
    await labCtx.close();

    // 3. Live headless Vulkan load of universes.html L0 Cosmic Web (locked camera default + live GPU P(k))
    const sgCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
    const sgPage = await sgCtx.newPage();
    const sgErrors = [];
    sgPage.on('pageerror', (e) => sgErrors.push(String(e).slice(0, 300)));
    await sgPage.goto(`${BASE_URL}universes.html?level=0`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await sgPage.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.cosmicWebSteps ?? 0) >= 5, null, { timeout: 60_000 });
    const sgState = await sgPage.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.deepEqual(sgErrors, []);
    assert.equal(sgState.cameraAutoSpin, false, 'universes.html must default to locked camera (cameraAutoSpin: false)');
    assert.equal(sgState.submitsPerStep, 1);
    assert.equal(sgState.gpuErrorCount, 0);
    assert.ok(sgState.cosmicWebSteps >= 5);
    assert.ok(sgState.sigmaDensity > 0);
    assert.ok(sgState.powerSpectrumPk.kBins.length >= 6);

    // 4. Dive into L1 Galaxy & verify canonical SchroederScaleAtlas multipole gravity with 0 GPU/page errors
    await sgPage.evaluate(() => window.__ulgUniversesDemo.setLevel(1, { instant: true }));
    await sgPage.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.galacticSteps ?? 0) >= 3, null, { timeout: 60_000 });
    const galState = await sgPage.evaluate(() => ({
      ...window.__ulgUniversesDemo.getState(),
      uncaptured: (globalThis.__ulgWebGpuUncapturedErrors || []).filter((e) => e.label === 'ulg-universes-demo')
    }));
    assert.deepEqual(sgErrors, [], `universes.html crashed with page errors: ${sgErrors.join('; ')}`);
    assert.deepEqual(galState.uncaptured, [], `universes.html emitted WebGPU uncaptured errors: ${JSON.stringify(galState.uncaptured)}`);
    assert.equal(galState.level, 1);
    assert.equal(galState.scaleId, 'galaxy');
    assert.equal(galState.cameraAutoSpin, false);
    assert.ok(galState.galacticSteps >= 3);
    assert.equal(galState.galacticGravityMode, 'webgpu-schroeder-scale-atlas-multipole');
    await sgCtx.close();
  } finally {
    await browser.close();
  }
});
