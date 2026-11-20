import assert from 'node:assert/strict';
import test from 'node:test';

test('native multilevel occupancy reaches the original gas EOS with auxiliary volume and rejection',{
  skip:process.env.ULG_RUN_NATIVE_CHAIN_GAS_VOLUME!=='1',timeout:360000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__chain_gas_volume_test__';
    await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<title>Chain gas volume</title>'}));await page.goto(url);
    const scenarios=[{levelCount:4,coarseOnly:true},{levelCount:6,aerosols:true},{levelCount:2},{levelCount:3},{levelCount:4},{levelCount:6},
      {levelCount:6,populated:true},
      {levelCount:2,aerosols:true},{levelCount:3,aerosols:true},{levelCount:6,populated:true,aerosols:true},
      {levelCount:3,fault:'moment'},{levelCount:4,fault:'edge'}];
    const selected=scenarios.filter(s=>(!process.env.ULG_CHAIN_GAS_LEVELS
      || process.env.ULG_CHAIN_GAS_LEVELS.split(',').map(Number).includes(s.levelCount))
      && (!process.env.ULG_CHAIN_GAS_FAULTS_ONLY || s.fault));
    assert.ok(selected.length>0);
    for(const scenario of selected) {
      const result=await page.evaluate(async options=>{
        const {runChainGasVolumeNative}=await import('/tests/fixtures/schroederChainGasVolumeNative.js');
        return runChainGasVolumeNative(options);
      },scenario);
      console.log(JSON.stringify({scenario,...result}));assert.deepEqual(result.errors,[]);
      assert.equal(result.mappedBytesPerCycle,128);assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles)assert.equal(cycle.words[0],0);
    }
  } finally {await browser.close();}
});
