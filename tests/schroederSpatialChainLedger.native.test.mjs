import assert from 'node:assert/strict';
import test from 'node:test';

test('native multilevel canonical ledger preserves energy and rejects whole batches', {
  skip: process.env.ULG_RUN_NATIVE_CHAIN_LEDGER !== '1', timeout: 420000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--ignore-certificate-errors', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-webgpu-developer-features'] });
  try {
    const page = await browser.newPage();
    const url = 'https://127.0.0.1:5173/__chain_ledger_test__';
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<title>Chain ledger</title>' }));
    await page.goto(url);
    const scenarios = [{ levelCount: 2, forceCase: 'gravity' },
      { levelCount: 3, forceCase: 'contact' },
      { levelCount: 3, forceCase: 'off', thermalPair: true },
      { levelCount: 3, forceCase: 'gravity', particleFault: true },
      { levelCount: 3, forceCase: 'gravity', closureFault: true },
      { levelCount: 2, forceCase: 'gravity', closureFault: 'ledger-error' },
      { levelCount: 2, forceCase: 'gravity', closureFault: 'skipped-pair' }];
    for (const scenario of scenarios) {
      const result = await page.evaluate(async scenario => {
        const { runLevelChainNative } = await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,
          { composite: true, publish: true, particles: true, closure: true, exact: true, ledger: true, ...scenario });
      }, scenario);
      console.log(JSON.stringify({ scenario, ...result }));
      assert.equal(result.fatal, undefined); assert.deepEqual(result.errors, []);
      assert.equal(result.cycles.length, 2);
      for (const cycle of result.cycles) {
        assert.equal(cycle.words[0], 0, 'level-chain invariants');
        assert.equal(cycle.closureWords[0], 0, 'thermal result or complete physical rollback');
        assert.equal(cycle.closureWords[1], scenario.particleFault || scenario.closureFault ? 5 : 3);
        assert.equal(cycle.closureWords[3], scenario.levelCount);
        assert.equal(cycle.closureWords[12], 0, 'exact integer budget, pair exchange, source heat and rollback');
      }
    }
  } finally { await browser.close(); }
});
