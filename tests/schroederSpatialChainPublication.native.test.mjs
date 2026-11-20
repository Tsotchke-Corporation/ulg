import assert from 'node:assert/strict';
import test from 'node:test';

test('native chain corrections publish velocity and heat through canonical receipts', {
  skip:process.env.ULG_RUN_NATIVE_CHAIN_PUBLICATION!=='1',timeout:360000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage();
    const url='https://127.0.0.1:5173/__chain_publication_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Native chain publication</title>'}));
    await page.goto(url);
    const scenarios=[{levelCount:2,forceCase:'off'},{levelCount:3,forceCase:'gravity'},
      {levelCount:6,forceCase:'off',fluid:true},{levelCount:6,forceCase:'gravity',fluid:true},
      {levelCount:6,forceCase:'walls'},{levelCount:6,forceCase:'contact'},
      {levelCount:6,forceCase:'cfl'},{levelCount:3,forceCase:'missing-pressure'}];
    for(const scenario of scenarios) {
      const result=await page.evaluate(async scenario=>{
        const {runLevelChainNative}=await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,{composite:true,publish:true,...scenario});
      },scenario);
      console.log(JSON.stringify({scenario,...result}));
      assert.equal(result.fatal,undefined);assert.deepEqual(result.errors,[]);
      assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles) {
        const rejected=['cfl','missing-pressure'].includes(scenario.forceCase);
        assert.equal(cycle.correctionWords[0],0);assert.equal(cycle.publicationWords[0],0,'native state and receipt invariants');
        assert.equal(cycle.publicationWords[1],scenario.levelCount);
        assert.equal(cycle.publicationWords[2],rejected?5:3);
        if(!rejected) assert.equal(cycle.publicationWords[3],scenario.levelCount);
        const f=new Float32Array(new Uint32Array(cycle.publicationWords).buffer);
        if(scenario.forceCase==='walls'||scenario.forceCase==='contact') assert.ok(f[9]>1e-5,'heat actually deposited into native sidecars');
        if(!rejected) assert.ok(Math.abs(f[8]-2)<1e-5);
      }
    }
  }finally{await browser.close();}
});
