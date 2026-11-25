import assert from 'node:assert/strict';
import test from 'node:test';

// Native Vulkan WebGPU proof for `solarSystemNBodyGpu.js`:
//   1. Exact astronomical relative radii (R_earth / R_sun = 0.00916, R_jup / R_sun = 0.1005)
//   2. Pure mutual symplectic Velocity-Verlet N-body conservation over 240 substeps
//      (|ΔE / E₀| < 1e-4, |ΔP| / Σ|m v| < 1e-4, zero NaN/GPU validation errors)
//   3. Hierarchical moon stability inside full Solar System (Earth-Moon & Jupiter-Io remain bound!)
//   4. Strict translation invariance: shifting entire system by [+1234.5, -678.25, +412.75] AU
//      produces identical relative Earth-Sun and Earth-Moon separation after 120 GPU substeps!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Real-scale f32x2 double-float Solar System WebGPU N-body: conservation, moon binding, & translation invariance', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Solar System N-body proof',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const res = await page.evaluate(async () => {
      const mod = await import('/src/runtime/astrophysics/solarSystemNBodyGpu.js');
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 300));
      }
      if (!adapter) throw new Error('WebGPU adapter unavailable');
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message || e.error)));

      const simA = mod.createSolarSystemNBodyEngineWebGpu(device, { asteroidCount: 512, seed: 20261125 });
      const simB = mod.createSolarSystemNBodyEngineWebGpu(device, {
        asteroidCount: 512,
        seed: 20261125,
        centerOffsetAu: [1234.5, -678.25, 412.75]
      });

      const d0 = simA.computeConservationDiagnostics();
      const dist = (s, i, j) => {
        const a = s.getMassiveBodyState64(i).posAu;
        const b = s.getMassiveBodyState64(j).posAu;
        return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      };
      const em0 = dist(simA, 3, 4);
      const ji0 = dist(simA, 6, 7);

      // Step 240 substeps (20 batches x 12 substeps, dtSubYr = 0.000045 -> ~4 days elapsed!)
      for (let b = 0; b < 20; b += 1) {
        await simA.step({ dtSubYr: 0.000045, substeps: 12, readMassive: b === 19 });
      }
      for (let b = 0; b < 20; b += 1) {
        await simB.step({ dtSubYr: 0.000045, substeps: 12, readMassive: b === 19 });
      }

      const d1 = simA.computeConservationDiagnostics();
      const em1A = dist(simA, 3, 4);
      const em1B = dist(simB, 3, 4);
      const es1A = dist(simA, 0, 3);
      const es1B = dist(simB, 0, 3);
      const ji1A = dist(simA, 6, 7);

      const earthR = simA.getMassiveBodyState64(3).radiusAu;
      const sunR = simA.getMassiveBodyState64(0).radiusAu;
      const jupR = simA.getMassiveBodyState64(6).radiusAu;

      simA.dispose();
      simB.dispose();
      return {
        gpuErrors,
        simTimeYr: d1.simTimeYr,
        stepIndex: d1.stepIndex,
        relEnergyDrift: Math.abs(d1.totalEnergy - d0.totalEnergy) / Math.max(1e-12, Math.abs(d0.totalEnergy)),
        relMomentumError: d1.relMomentumError,
        earthToSunRadiusRatio: earthR / sunR,
        jupiterToSunRadiusRatio: jupR / sunR,
        earthMoonDist0: em0,
        earthMoonDist1A: em1A,
        earthMoonDist1B: em1B,
        earthMoonShiftDiff: Math.abs(em1A - em1B),
        earthSunShiftDiff: Math.abs(es1A - es1B),
        jupiterIoDist0: ji0,
        jupiterIoDist1A: ji1A
      };
    });

    assert.deepEqual(res.gpuErrors, []);
    assert.equal(res.stepIndex, 240);
    assert.ok(res.relEnergyDrift < 1e-4, `Symplectic energy drift must stay < 1e-4 (got ${res.relEnergyDrift})`);
    assert.ok(res.relMomentumError < 1e-4, `Linear momentum error must stay < 1e-4 (got ${res.relMomentumError})`);
    assert.ok(Math.abs(res.earthToSunRadiusRatio - 6371 / 695700) < 1e-4);
    assert.ok(Math.abs(res.jupiterToSunRadiusRatio - 69911 / 695700) < 1e-4);
    assert.ok(res.earthMoonDist1A > 0.0020 && res.earthMoonDist1A < 0.0031, `Moon must stay bound to Earth (got ${res.earthMoonDist1A} AU)`);
    assert.ok(res.jupiterIoDist1A > 0.0022 && res.jupiterIoDist1A < 0.0034, `Io must stay bound to Jupiter (got ${res.jupiterIoDist1A} AU)`);
    assert.ok(res.earthMoonShiftDiff < 1e-5, `Earth-Moon separation must be translation-invariant at +1234 AU (diff=${res.earthMoonShiftDiff})`);
    assert.ok(res.earthSunShiftDiff < 1e-4, `Earth-Sun separation must be translation-invariant at +1234 AU (diff=${res.earthSunShiftDiff})`);

    console.log('Solar System f32x2 WebGPU N-Body Proof PASS:', JSON.stringify(res));
    await ctx.close();
  } finally {
    await browser.close();
  }
});
