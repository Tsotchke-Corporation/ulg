import assert from 'node:assert/strict';
import test from 'node:test';

test('native composite mechanics preserves P2G mass momentum gradients and kinetic budget through empty levels', {
  skip: process.env.ULG_RUN_NATIVE_COMPOSITE_MECHANICS !== '1', timeout: 240000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--ignore-certificate-errors', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-webgpu-developer-features'] });
  try {
    const page = await browser.newPage();
    page.on('requestfailed', request => console.error('request failed',request.url(),request.failure()));
    page.on('pageerror', error => console.error('page error',error.message));
    const url = 'https://127.0.0.1:5173/__composite_mechanics_test__';
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<title>Composite GPU conservation</title>' }));
    await page.goto(url);
    for (const scenario of [{levelCount:2},{levelCount:3},{levelCount:4},{levelCount:6},{levelCount:6,fluid:true}]) {
      const {levelCount}=scenario;
      const result = await page.evaluate(async ({levelCount,fluid}) => {
        const { runLevelChainNative } = await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(levelCount,{composite:true,fluid});
      }, scenario);
      console.log(JSON.stringify({scenario,...result}));
      assert.equal(result.fatal, undefined);
      assert.deepEqual(result.errors, []);
      assert.equal(result.cycles.length, 2);
      for (const cycle of result.cycles) {
        assert.equal(cycle.words[0],0,'GPU topology and phase prerequisites');
        assert.equal(cycle.compositeWords[0],0,'GPU conservation and energy bound');
        assert.equal(cycle.compositeWords[1],levelCount-1,'every combined level checked');
        assert.equal(cycle.compositeWords[2],0,'GPU admission errors');
        assert.equal(cycle.compositeWords[3],3,'GPU admitted');
        const values=new Float32Array(new Uint32Array(cycle.compositeWords).buffer);
        assert.ok(Math.abs(values[8]-2)<0.00002,'both particle masses reach coarsest union');
        assert.ok(values[15] > values[16]+0.00001,'averaging retains a nonzero unresolved kinetic budget');
        assert.equal(cycle.unprojectedRejected,true);
        assert.equal(cycle.cloneRejected,true);
        assert.equal(cycle.backpressureRejected,true);
        assert.equal(cycle.allReleased,true);
        if (cycle.compositeNegativeWords) {
          assert.equal(cycle.compositeNegativeWords[0],0,'stale GPU mutation fails closed through all successors');
          assert.equal(cycle.compositeNegativeWords[1],levelCount-1);
        }
      }
    }
  } finally { await browser.close(); }
});
