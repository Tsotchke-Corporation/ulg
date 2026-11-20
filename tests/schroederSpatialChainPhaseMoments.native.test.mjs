import assert from 'node:assert/strict';
import test from 'node:test';

test('native inherited phase volumes and gradients preserve affine moments and their adjoint', {
  skip: process.env.ULG_RUN_NATIVE_CHAIN_PHASE_MOMENTS !== '1', timeout: 600000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--ignore-certificate-errors', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-webgpu-developer-features'] });
  try {
    const page = await browser.newPage(), url = 'https://127.0.0.1:5173/__chain_phase_moments_test__';
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<title>Chain phase moments</title>' }));
    await page.goto(url);
    const scenarios = [
      { levelCount: 3, gas: true }, { levelCount: 6, gas: true },
      { levelCount: 6, populated: true, gas: true }, { levelCount: 2, gas: true },
      { levelCount: 4, coarseOnly: true, gas: true },
      { levelCount: 3, populated: true, constant: true, gas: true },
      { levelCount: 6, populated: true, nonlinear: true, gas: true },
      { levelCount: 3, fault: 'moment' }, { levelCount: 4, fault: 'edge' },
      { levelCount: 6, fault: 'coefficient' }, { levelCount: 3, fault: 'gradient' },
      { levelCount: 3, fault: 'zero-volume-gradient' },
      { levelCount: 3, gas: true, cohortTagged: true },
      { levelCount: 6, populated: true, gas: true, cohortTagged: true }
    ];
    let executed = 0;
    for (const [index, scenario] of scenarios.entries()) {
      if (process.env.ULG_CHAIN_PHASE_MOMENTS_CASE
        && !process.env.ULG_CHAIN_PHASE_MOMENTS_CASE.split(',').includes(String(index))) continue;
      const result = await page.evaluate(async scenario => {
        const { runChainVolumeNative } = await import('/tests/fixtures/schroederSpatialChainVolumeNative.js');
        return runChainVolumeNative({ ...scenario, phaseMoments: true });
      }, scenario);
      executed++;
      console.log(JSON.stringify({ scenario, ...result }));
      assert.deepEqual(result.errors, []);
      assert.equal(result.mappedBytesPerCycle, 128);
      assert.equal(result.cycles.length, 2);
      for (const cycle of result.cycles) {
        assert.equal(cycle.words[0], 0, JSON.stringify(cycle.words));
        assert.equal(cycle.words[1], scenario.fault ? 5 : 3);
        for (const guard of ['cloneRejected', 'cloneExecutionRejected', 'changedOrdinalRejected',
          'backpressureRejected', 'retiredRejected']) assert.equal(cycle[guard], true, guard);
      }
    }
    assert.ok(executed > 0, 'must execute at least one native scenario');
  } finally { await browser.close(); }
});
