import assert from 'node:assert/strict';
import test from 'node:test';

test('native multilevel G2P gathers every level and rolls back a rejected batch', {
  skip:process.env.ULG_RUN_NATIVE_CHAIN_G2P!=='1',timeout:420000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage();
    const url='https://127.0.0.1:5173/__chain_g2p_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Native chain G2P</title>'}));
    await page.goto(url);
    const scenarios=[{levelCount:2,forceCase:'off'},{levelCount:3,forceCase:'gravity'},
      {levelCount:6,forceCase:'contact'},{levelCount:3,forceCase:'missing-pressure'},
      {levelCount:3,forceCase:'gravity',particleFault:true},
      {levelCount:3,forceCase:'gravity',exact:true},
      {levelCount:3,forceCase:'gravity',exact:true,particleFault:true}]
      .filter(s=>!process.env.ULG_CHAIN_G2P_EXACT_ONLY || s.exact);
    for(const scenario of scenarios) {
      const result=await page.evaluate(async scenario=>{
        const {runLevelChainNative}=await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,{composite:true,publish:true,particles:true,...scenario});
      },scenario);
      console.log(JSON.stringify({scenario,...result}));
      assert.equal(result.fatal,undefined);assert.deepEqual(result.errors,[]);
      assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles) {
        assert.equal(cycle.publicationWords[0],0,'native publication checked before particle faults');
        assert.equal(cycle.particleWords[0],0,'all particle rows gathered or restored atomically');
        assert.equal(cycle.particleWords[1],scenario.forceCase==='missing-pressure'||scenario.particleFault?5:3);
        assert.equal(cycle.particleWords[3],scenario.levelCount);
        if(scenario.exact) {
          assert.equal(cycle.particleWords[12],0,'exact quantity and mass invariant');
          assert.equal(cycle.particleWords[13]!==0,Boolean(scenario.particleFault),'exact quantity validation');
          assert.equal(cycle.particleWords[14],1,'genuine retained exact capture');
        }
      }
    }
  }finally{await browser.close();}
});
