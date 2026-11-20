import assert from 'node:assert/strict';
import test from 'node:test';

test('native multilevel closure carries heat and rejects the entire candidate', {
  skip: process.env.ULG_RUN_NATIVE_CHAIN_CLOSURE !== '1', timeout: 420000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--ignore-certificate-errors', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-webgpu-developer-features'] });
  try {
    const page = await browser.newPage();
    const url = 'https://127.0.0.1:5173/__chain_closure_test__';
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<title>Chain closure</title>' }));
    await page.goto(url);
    const scenarios = [{ levelCount: 2, forceCase: 'gravity' },
      { levelCount: 3, forceCase: 'contact', exact: true },
      { levelCount: 3, forceCase: 'gravity', exact: true, particleFault: true },
      { levelCount: 3, forceCase: 'gravity', exact: true, closureFault: true },
      { levelCount: 2, forceCase: 'gravity', closureFault: 'missing-output' }];
    for (const scenario of scenarios) {
      const result = await page.evaluate(async scenario => {
        const { runLevelChainNative } = await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,
          { composite: true, publish: true, particles: true, closure: true, ...scenario });
      }, scenario);
      console.log(JSON.stringify({ scenario, ...result }));
      assert.equal(result.fatal, undefined); assert.deepEqual(result.errors, []);
      assert.equal(result.cycles.length, 2);
      for (const cycle of result.cycles) {
        assert.equal(cycle.closureWords[0], 0, 'thermal result or complete physical rollback');
        assert.equal(cycle.closureWords[1], scenario.particleFault || scenario.closureFault ? 5 : 3);
        assert.equal(cycle.closureWords[3], scenario.levelCount);
        if (scenario.exact) assert.equal(cycle.closureWords[12], 0, 'exact mass and quantity rollback');
      }
    }
  } finally { await browser.close(); }
});
