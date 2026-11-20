import assert from 'node:assert/strict';
import test from 'node:test';

test('native multilevel phase transfer conserves mass and restores the complete batch', {
  skip: process.env.ULG_RUN_NATIVE_CHAIN_PHASE !== '1', timeout: 420000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--ignore-certificate-errors', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-webgpu-developer-features'] });
  try {
    const page = await browser.newPage();
    const url = 'https://127.0.0.1:5173/__chain_phase_test__';
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<title>Chain phase transfer</title>' }));
    await page.goto(url);
    for (const scenario of [{levelCount:3}, {levelCount:2}, {levelCount:3,particleFault:true},
      {levelCount:3,closureFault:true}, {levelCount:3,closureFault:'phase-error'},
      {levelCount:3,closureFault:'phase-projection'}, {levelCount:3,phaseTransfer:'water-fusion'},
      {levelCount:3,phaseTransfer:'boiling'}, {levelCount:3,phaseTransfer:'boiling',closureFault:true}]) {
      const result=await page.evaluate(async scenario => {
        const {runLevelChainNative}=await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,{composite:true,publish:true,particles:true,closure:true,
          exact:true,ledger:true,phaseTransfer:true,forceCase:'off',...scenario});
      },scenario);
      console.log(JSON.stringify({scenario,...result}));
      assert.equal(result.fatal,undefined);assert.deepEqual(result.errors,[]);assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles) {
        assert.equal(cycle.words[0],0,'level-chain invariants');
        assert.equal(cycle.closureWords[0],0,'whole physical family and acceptance');
        assert.equal(cycle.closureWords[1],scenario.particleFault || scenario.closureFault ? 5 : 3);
        assert.equal(cycle.closureWords[12],0,'phase population, exact mass and U-S, complete rollback');
      }
    }
  } finally {await browser.close();}
});
