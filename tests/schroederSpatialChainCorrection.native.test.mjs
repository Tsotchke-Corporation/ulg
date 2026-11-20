import assert from 'node:assert/strict';
import test from 'node:test';

test('native chain force and downward correction conserve impulse and energy budget', {
  skip:process.env.ULG_RUN_NATIVE_CHAIN_CORRECTION!=='1',timeout:360000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage();
    page.on('requestfailed',request=>console.error('request failed',request.url(),request.failure()));
    const url='https://127.0.0.1:5173/__chain_correction_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Chain force and correction invariants</title>'}));
    await page.goto(url);
    const scenarios=[{levelCount:2,forceCase:'off'},{levelCount:3,forceCase:'gravity'},
      {levelCount:6,forceCase:'off',fluid:true},{levelCount:6,forceCase:'gravity',fluid:true},
      {levelCount:6,forceCase:'walls'},{levelCount:6,forceCase:'contact'},{levelCount:6,forceCase:'cfl'}];
    for (const scenario of scenarios) {
      const result=await page.evaluate(async scenario=>{
        const {runLevelChainNative}=await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,{composite:true,...scenario});
      },scenario);
      console.log(JSON.stringify({scenario,...result}));
      assert.equal(result.fatal,undefined);
      assert.deepEqual(result.errors,[]);
      assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles) {
        assert.equal(Object.keys(cycle.producerChecks).length,12);
        for (const [name, passed] of Object.entries(cycle.producerChecks)) {
          assert.equal(passed,true,`exact native producer authority: ${name}`);
        }
        assert.equal(cycle.compositeWords[0],0,'restriction invariants');
        assert.equal(cycle.correctionWords[0],0,'law-isolation and native-field momentum/energy budgets');
        assert.equal(cycle.correctionWords[1],scenario.levelCount,'all native levels checked');
        if(scenario.forceCase==='cfl') {
          assert.equal(cycle.correctionWords[2],5,'fine-level CFL failure rejects the whole chain');
          assert.ok(cycle.correctionWords[4]>0 && cycle.correctionWords[5]>0,'both locally valid and invalid levels exist');
          continue;
        }
        assert.equal(cycle.correctionWords[2],3,'whole chain admitted');
        assert.equal(cycle.correctionWords[3],0,'whole chain has no error');
        const floats=new Float32Array(new Uint32Array(cycle.correctionWords).buffer);
        assert.ok(Math.abs(floats[8]-2)<0.0001);
        if(scenario.forceCase==='walls' || scenario.forceCase==='contact') {
          assert.ok(floats[15]-floats[24]>0.00001,'dissipated energy retained for heat publication');
        }
        if(cycle.compositeNegativeWords) {
          assert.equal(cycle.compositeNegativeWords[0],0,'stale level fails whole-chain admission');
          assert.equal(cycle.compositeNegativeWords[2],5);
        }
      }
    }
  } finally { await browser.close(); }
});
