import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_ELEMENTS_LAB_BASE_URL || 'https://127.0.0.1:5173/';

test('Gate 6 Phase B: native Vulkan verifies all parallelized shaders + 100,000 live continuum H2O carriers meeting Section 3 GPU budgets', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 to run on native Vulkan WebGPU',
  timeout: 180_000
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
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    const url = new URL('/__gate6_phase_b_100k__', BASE_URL).href;
    await page.route(url, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Gate 6 Phase B 100K</title>' }));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    result = await page.evaluate(async () => {
      const mod = await import('/tests/fixtures/gate6Continuum100kScaleNative.js');
      return mod.runGate6Continuum100kScaleNative({ particleCount: 100000, warmupSteps: 8, measuredSteps: 16 });
    });
  } finally {
    await browser.close();
  }

  if (result.status === 'unsupported') return;
  console.log('[gate6-phase-b-100k]', JSON.stringify(result));
  assert.deepEqual(result.compileErrors, []);
  assert.equal(result.validationError, null, result.validationError);
  assert.deepEqual(result.uncapturedErrors, []);
  assert.equal(result.particleCount, 100000);
  assert.ok(result.maxParticleBufBytes <= result.maxBindingBytes);

  // Hard Section 3 GPU budgets at N = 100,000 live continuum carriers!
  assert.ok(result.submitsPerStep <= 2.0, `submitsPerStep ${result.submitsPerStep} > 2.0`);
  assert.ok(result.passesPerStep <= 25.0, `passesPerStep ${result.passesPerStep} > 25.0`);
  // Only final compact summary may read back once at burst end (<= 1 total across 16 steps!)
  assert.ok(result.mapAsyncCalls <= 1, `expected <= 1 boundary mapAsync across 16 steps, got ${result.mapAsyncCalls}`);

  // Physics invariants at 100K carriers (bounded by grid CFL speed cap 0.6 * dx / dt = 120 m/s)
  assert.ok(result.sourceMassKg > 0 && result.nextMassKg > 0);
  assert.ok(result.massRelErr < 1e-4, `mass conservation drifted: relErr=${result.massRelErr}`);
  assert.ok(
    Number.isFinite(result.maxSpeedMPerS) && result.maxSpeedMPerS >= 0 && result.maxSpeedMPerS <= 120.5,
    `maxSpeedMPerS ${result.maxSpeedMPerS} exceeded grid CFL cap 120 m/s`
  );
  assert.ok(result.minVolumeRatioJ >= 0.9 && result.maxVolumeRatioJ <= 1.1, `J out of physical range: [${result.minVolumeRatioJ}, ${result.maxVolumeRatioJ}]`);
  assert.ok(result.activeGridNodeCount > 10000);
  assert.ok(result.msPerStep <= 10.0, `100K continuum step time ${result.msPerStep.toFixed(2)} ms/step exceeded 10 ms budget`);
});
