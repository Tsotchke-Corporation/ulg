import assert from 'node:assert/strict';
import test from 'node:test';

test('native multilevel reaction and phase transfer conserve mass and restore the complete batch', {
  skip: process.env.ULG_RUN_NATIVE_CHAIN_REACTION !== '1', timeout: 600000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--ignore-certificate-errors', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-webgpu-developer-features'] });
  try {
    const page = await browser.newPage();
    const url = 'https://127.0.0.1:5173/__chain_reaction_test__';
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<title>Chain reaction and phase</title>' }));
    await page.goto(url);
    // Headless Chrome can replace its initial GPU process while initializing
    // the Vulkan surface. Wait for an adapter on this same owned session;
    // never fall back to a CPU implementation or restart a running GPU test.
    await page.waitForFunction(async()=>Boolean(await navigator.gpu.requestAdapter({powerPreference:'high-performance'})),
      null,{timeout:10000,polling:250});
    const inventory=await page.evaluate(async()=>{
      const {runChainInventoryNative}=await import('/tests/fixtures/schroederSpatialChainInventoryNative.js');
      return runChainInventoryNative();
    });
    console.log(JSON.stringify({inventory}));assert.deepEqual(inventory.errors,[]);
    const masks={none:0,mass:1024,energy:2048,placement:4096,'mass-overflow':1024,'energy-overflow':2048};
    for(const check of inventory.results) assert.equal(check.words[2],masks[check.fault],check.fault);
    for (const scenario of [{levelCount:3}, {levelCount:3,phaseTransfer:true}, {levelCount:2,phaseTransfer:true},
      {levelCount:3,particleFault:true}, {levelCount:3,phaseTransfer:true,particleFault:true},
      {levelCount:3,closureFault:true}, {levelCount:3,phaseTransfer:true,closureFault:true},
      {levelCount:3,closureFault:'reaction-projection'}, {levelCount:3,phaseTransfer:true,closureFault:'phase-projection'},
      {levelCount:3,reaction:'no-spares'}, {levelCount:3,phaseTransfer:true,reaction:'no-lineages'}]) {
      const result=await page.evaluate(async scenario => {
        const {runLevelChainNative}=await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,{composite:true,publish:true,particles:true,closure:true,
          exact:true,ledger:true,reaction:true,fluid:true,forceCase:'off',...scenario});
      },scenario);
      console.log(JSON.stringify({scenario,...result}));
      assert.equal(result.fatal,undefined);assert.deepEqual(result.errors,[]);assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles) {
        assert.equal(cycle.words[0],0,'level-chain invariants');
        assert.equal(cycle.closureWords[0],0,'whole physical family and acceptance');
        assert.equal(cycle.closureWords[1],scenario.particleFault || scenario.closureFault || typeof scenario.reaction==='string' ? 5 : 3);
        if(typeof scenario.reaction==='string') assert.ok(cycle.closureWords[2]&4096,'rejected placement rejects whole batch');
        assert.equal(cycle.closureWords[12],0,'reaction products, exact mass and U-S, complete rollback');
      }
    }
  } finally {await browser.close();}
});
