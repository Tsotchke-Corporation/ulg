import assert from 'node:assert/strict';
import test from 'node:test';

test('native worker schedule retains phase-slot refinement across two real mechanics steps', {
  skip: process.env.ULG_RUN_NATIVE_PHASE_SLOT_WORKER !== '1', timeout: 120000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer','--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist','--enable-webgpu-developer-features'] });
  try {
    const page = await browser.newPage();
    const url = 'https://127.0.0.1:5173/__phase_slot_worker_test__';
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Worker phase gate</title>' }));
    await page.goto(url);
    for (const scenario of (process.env.ULG_PHASE_SLOT_SCENARIO ? [process.env.ULG_PHASE_SLOT_SCENARIO] : ['interface', 'volume-interface', 'bulk', 'far', 'resolved', 'capacity', 'cycle', 'coarsen', 'oversize', 'overfull', 'material'])) {
      const result = await page.evaluate(scenario => new Promise((resolve, reject) => {
        const worker = new Worker('/tests/fixtures/schroederPhaseSlotWorkerNative.js', { type: 'module' });
        const timer = setTimeout(() => { worker.terminate(); reject(new Error('Worker native probe timed out')); }, 90000);
        worker.onerror = event => { clearTimeout(timer); worker.terminate(); reject(new Error(event.message)); };
        worker.onmessage = ({ data }) => { clearTimeout(timer); worker.terminate(); resolve(data); };
        worker.postMessage({ type: 'phase-slot-native', scenario });
      }), scenario);
      // The fixed-size GPU receipt is the numerical evidence. Never read back
      // particle arrays or replace the production split proposal in this test.
      const { summary, ...receipt } = result;
      console.log(JSON.stringify(receipt));
      assert.equal(result.fatal, undefined, scenario);
      assert.deepEqual(result.errors, [], scenario);
      assert.equal(result.status, 'worker-resident-schedule-completed');
      assert.equal(result.sourceStage, 'phase-slot-refinement');
      assert.equal(result.completedStepCount, 2);
      assert.equal(result.retainedWithinWorker, true);
      assert.equal(result.sameWorkerPrivateReferences, true);
      assert.equal(result.identityPreserved, true);
      if (scenario === 'cycle') {
        assert.deepEqual(result.stages.map(s => s.words[4]), [8,1,1,8], 'split, merge, stable bulk, spare reuse');
        assert.deepEqual(result.stages.map(s => s.words[1]), [9,2,2,9]);
        for (const stage of result.stages) {
          assert.equal(stage.words[0], 0, `${stage.stageName}: conservation and immutable identities`);
          assert.equal(stage.identityPreserved, true);
          assert.equal(stage.completedStepCount, 2);
        }
        continue;
      }
      if (scenario === 'coarsen') assert.deepEqual(result.dictionaryCoarsenDecisions, [1,0,0], 'invalid dictionary or source cannot coarsen');
      assert.equal(result.words[0], 0, `${scenario}: GPU conservation receipt`);
      assert.equal(result.words[5], 1);
      assert.equal(result.words[4], ({interface: 8, 'volume-interface': 8, oversize: 8, overfull: 9})[scenario] ?? 1,
        `${scenario}: compatible bounded gas population`);
      assert.equal(result.words[1], ({interface: 9, 'volume-interface': 9, bulk: 1, coarsen: 1, oversize: 8, overfull: 9})[scenario] ?? 2);
    }
  } finally { await browser.close(); }
});
