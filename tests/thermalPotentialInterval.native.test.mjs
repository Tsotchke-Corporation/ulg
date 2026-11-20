import assert from 'node:assert/strict';
import test from 'node:test';

test('G6 physical thermal intervals conserve exact energy across fit adoption and agree with the original GPU route', {
  skip: process.env.ULG_RUN_NATIVE_THERMAL_INTERVAL !== '1', timeout: 300000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    const base = 'https://127.0.0.1:5173/';
    await page.route(url => url.href === base, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>G6 interval proof</title>' }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    for (const scenario of [{}, { wall: true }, { reverse: true }]) {
      const result = await page.evaluate(async scenario => {
        const { runThermalPotentialIntervalNative } = await import('/tests/fixtures/thermalPotentialIntervalNative.js');
        return runThermalPotentialIntervalNative(scenario);
      }, scenario);
      console.log(JSON.stringify({ scenario, ...result }));
      assert.deepEqual(result.errors, []);assert.equal(result.validation, null);
      assert.deepEqual(result.fitted.ordinals, [0, 1, 1]);
      for (const route of [result.direct, result.fitted]) {
        assert.equal(route.rows.length, 3);
        for (const row of route.rows) {
          assert.equal(row[0], 0);assert.equal(row[1], 2);assert.equal(row[4], 1);assert.equal(row[5], 2);
          assert.ok(row[2] > 0 && row[3] > 0 && row[6] > 0);
          assert.equal(row[16], 2, 'Cold gains energy and hot loses energy');
        }
      }
      assert.equal(result.fitted.rows[0][11], 0);
      assert.ok(result.fitted.rows[0][12] > 0);
      assert.ok(result.fitted.rows[1][11] > 0 && result.fitted.rows[2][11] > 0);
      assert.equal(result.fitted.adoption.length, 1);assert.equal(result.fitted.adoption[0][0], 0);
      assert.equal(result.fitted.negativeControls.length, 1);
    }
  } finally { await browser.close(); }
});
