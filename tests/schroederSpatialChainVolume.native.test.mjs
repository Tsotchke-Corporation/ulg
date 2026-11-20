import assert from 'node:assert/strict';
import test from 'node:test';

test('native adjacent volume restriction and pressure transpose preserve volume and virtual work',{
  skip:process.env.ULG_RUN_NATIVE_CHAIN_VOLUME!=='1',timeout:360000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__chain_volume_test__';
    await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<title>Chain volume</title>'}));await page.goto(url);
    const scenarios=[{levelCount:2},{levelCount:3},{levelCount:4},{levelCount:6},
      {levelCount:6,populated:true},{levelCount:3,populated:true,constant:true},
      {levelCount:6,populated:true,gas:true},{levelCount:6,populated:true,nonlinear:true},
      {levelCount:4,coarseOnly:true},{levelCount:3,fault:'moment'},
      {levelCount:4,fault:'edge'},{levelCount:6,fault:'coefficient'}];
    const selected=scenarios.filter(s=>(!process.env.ULG_CHAIN_VOLUME_LEVELS
      || process.env.ULG_CHAIN_VOLUME_LEVELS.split(',').map(Number).includes(s.levelCount))
      && (!process.env.ULG_CHAIN_VOLUME_COARSE_ONLY || s.coarseOnly)
      && (!process.env.ULG_CHAIN_VOLUME_FAULTS_ONLY || s.fault));
    assert.ok(selected.length>0,'the requested native matrix must execute at least one scenario');
    for(const scenario of selected){
      const result=await page.evaluate(async scenario=>{
        const {runChainVolumeNative}=await import('/tests/fixtures/schroederSpatialChainVolumeNative.js');
        return runChainVolumeNative(scenario);
      },scenario);
      console.log(JSON.stringify({scenario,...result}));assert.deepEqual(result.errors,[]);
      assert.equal(result.mappedBytesPerCycle,128);assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles){assert.equal(cycle.words[0],0);assert.equal(cycle.words[1],scenario.fault?5:3);
        assert.equal(cycle.cloneRejected,true);assert.equal(cycle.cloneExecutionRejected,true);
        assert.equal(cycle.changedOrdinalRejected,true);assert.equal(cycle.backpressureRejected,true);assert.equal(cycle.retiredRejected,true);}
    }
  }finally{await browser.close();}
});
