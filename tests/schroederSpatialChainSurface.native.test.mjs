import assert from 'node:assert/strict';
import test from 'node:test';

test('native surface stress reaches multilevel particles with reciprocal momentum and signed work compensation',{
  skip:process.env.ULG_RUN_NATIVE_CHAIN_SURFACE!=='1',timeout:600000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__chain_surface_test__';
    page.on('requestfailed',request=>console.log(JSON.stringify({failedRequest:request.url(),failure:request.failure()})));
    await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<title>Multilevel surface stress</title>'}));await page.goto(url);
    const scenarios=[{levelCount:2,surface:'on',enabled:false},{levelCount:3,surface:'on'},
      {levelCount:6,emptyMiddle:true,surface:'on'},{levelCount:6,surface:'on'},
      {levelCount:3,surface:'off'},{levelCount:3,surface:'fault'},
      {levelCount:6,emptyMiddle:true,surface:'fault'},{levelCount:3,asymmetric:true,surface:'on'}];
    for(const [index,scenario]of scenarios.entries()){
      if(process.env.ULG_CHAIN_SURFACE_CASE&&!process.env.ULG_CHAIN_SURFACE_CASE.split(',').includes(String(index)))continue;
      for(let cycle=0;cycle<2;cycle++){
        const result=await page.evaluate(async scenario=>{
          const {runChainCrossTransport}=await import('/tests/fixtures/schroederChainCrossTransport.js');
          return runChainCrossTransport(scenario);
        },scenario);
        console.log(JSON.stringify({scenario,cycle,...result}));assert.deepEqual(result.errors,[]);
        assert.equal(result.words[0],0,JSON.stringify(result));assert.equal(result.words[3],scenario.levelCount);
        assert.equal(result.words[1],scenario.surface==='fault'?5:3);
        assert.equal(result.surfaceCorrupted,scenario.surface==='fault');assert.equal(result.mappedBytes,128);
      }
    }
  }finally{await browser.close();}
});
