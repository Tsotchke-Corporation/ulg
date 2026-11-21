import assert from 'node:assert/strict';
import test from 'node:test';

test('native adjacent level chains retain inherited fields through empty levels', {
  skip: process.env.ULG_RUN_NATIVE_LEVEL_CHAIN !== '1', timeout: 180000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const wayland = Boolean(process.env.WAYLAND_DISPLAY);
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: !wayland,
    args: ['--ignore-certificate-errors', '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist', '--enable-webgpu-developer-features',
      ...(wayland ? ['--ozone-platform=wayland'] : [])] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const url = 'https://127.0.0.1:5173/__level_chain_test__';
    await page.route(url, route => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><title>Level chain GPU invariants</title>' }));
    await page.goto(url);
    for (const levelCount of [2, 3, 4, 6, 8]) {
      const result = await page.evaluate(async levelCount => {
        const { runLevelChainNative } = await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(levelCount);
      }, levelCount);
      console.log(JSON.stringify(result));
      assert.equal(result.fatal, undefined, `${levelCount} levels`);
      assert.deepEqual(result.errors, []);
      assert.equal(result.cycles.length, 2);
      for (const cycle of result.cycles) {
        assert.equal(cycle.words[0], 0, 'GPU topology/partition/first-moment invariants');
        assert.equal(cycle.words[1], levelCount - 1, 'all pairs checked');
        assert.ok(cycle.words[2] > 0, 'nonempty inherited fine fields');
        assert.ok(cycle.words[4] > 0 && cycle.words[5] > 0, 'both solid domains retained');
        assert.equal(cycle.allOwned, true);
        assert.equal(cycle.allReleased, true);
        assert.equal(cycle.inheritedIdentity, true);
        assert.equal(cycle.capacityBound, true);
        assert.equal(cycle.words[28], levelCount, 'every phase-volume sidecar checked on GPU');
        assert.equal(cycle.words[31], 2, 'native source selection partitions the two particles');
        assert.equal(cycle.chainAuthenticated, true);
        assert.equal(cycle.beforeP2gRejected, true);
        assert.equal(cycle.retiredChainRejected, true);
      }
      if (levelCount === 3) {
        assert.equal(result.clonedPredecessorRejected, true);
        for (const negative of result.negatives) {
          assert.equal(negative.words[0], 0, `${negative.kind}: fails closed`);
          assert.equal(negative.words[1], 1, 'negative receipt executed');
        }
        assert.deepEqual(result.negatives.map(x => x.kind), ['capacity', 'stale-source']);
      }
    }
  } finally { await browser.close(); }
});
