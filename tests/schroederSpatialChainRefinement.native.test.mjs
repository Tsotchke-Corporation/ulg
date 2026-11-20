import assert from 'node:assert/strict';
import test from 'node:test';

test('native multilevel refinement preserves final inventory and rejects complete batches', {
  skip:process.env.ULG_RUN_NATIVE_CHAIN_REFINEMENT!=='1',timeout:600000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__chain_refinement_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Chain refinement</title>'}));
    await page.goto(url);
    await page.waitForFunction(async()=>Boolean(await navigator.gpu.requestAdapter({powerPreference:'high-performance'})),null,{timeout:10000,polling:250});
    const scenarios=[{levelCount:3},{levelCount:2},{levelCount:3,refinement:'merge'},
      {levelCount:3,reaction:true,phaseTransfer:true},
      {levelCount:3,particleFault:true},{levelCount:3,closureFault:true},
      {levelCount:3,closureFault:'refinement-error'},{levelCount:3,closureFault:'refinement-ledger-error'},
      {levelCount:3,closureFault:'refinement-projection'},
      {levelCount:3,refinementLegacy:true},{levelCount:3,refinement:'duplicate-spare'}];
    for(const scenario of scenarios) {
      const result=await page.evaluate(async scenario=>{
        const {runLevelChainNative}=await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,{composite:true,publish:true,particles:true,closure:true,
          exact:true,ledger:true,fluid:true,forceCase:'off',phaseTransfer:'boiling',refinement:'split',...scenario});
      },scenario);
      console.log(JSON.stringify({scenario,...result}));
      assert.equal(result.fatal,undefined);assert.deepEqual(result.errors,[]);assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles) {
        assert.equal(cycle.words[0],0,'mechanics invariants');
        assert.equal(cycle.closureWords[0],0,'physical acceptance/rollback');
        assert.equal(cycle.closureWords[1],scenario.particleFault||scenario.closureFault||scenario.refinementLegacy||scenario.refinement==='duplicate-spare'?5:3);
        assert.equal(cycle.closureWords[26],0,'refinement conservation, actual split/merge and complete ledger rollback');
        if(scenario.reaction) assert.equal(cycle.closureWords[12],0,'reaction product conservation');
        if(['refinement-error','refinement-ledger-error'].includes(scenario.closureFault)) assert.ok(cycle.closureWords[2]&8192);
      }
    }
  } finally {await browser.close();}
});
