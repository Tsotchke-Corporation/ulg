import assert from 'node:assert/strict';
import test from 'node:test';

test('cross-level transport reaches native particles with conserved momentum, energy and angular momentum',{
  skip:process.env.ULG_RUN_NATIVE_CHAIN_CROSS_TRANSPORT!=='1',timeout:900000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__chain_cross_transport_test__';
    page.on('requestfailed',request=>console.log(JSON.stringify({failedRequest:request.url(),failure:request.failure()})));
    await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<title>Cross transport</title>'}));await page.goto(url);
    const scenarios=[{levelCount:2},{levelCount:3},{levelCount:6,emptyMiddle:true},
      {levelCount:3,drag:false},{levelCount:6,emptyMiddle:true,drag:false},
      {levelCount:2,enabled:false},{levelCount:3,enabled:false},
      {levelCount:3,fault:true},{levelCount:6,fault:true},
      {levelCount:3,reverse:true},{levelCount:3,asymmetric:true},
      {levelCount:2,drag:false},{levelCount:2,reverse:true},{levelCount:2,asymmetric:true},
      {levelCount:2,fault:true},{levelCount:3,torqueRefusal:true},
      {levelCount:6,emptyMiddle:true,torqueRefusal:true},
      {levelCount:3,geometryFault:true},{levelCount:6},{levelCount:6,asymmetric:true},
      {levelCount:6,drag:false}];
    for(const [index,scenario]of scenarios.entries()){
      if(process.env.ULG_CHAIN_CROSS_TRANSPORT_CASE&&!process.env.ULG_CHAIN_CROSS_TRANSPORT_CASE.split(',').includes(String(index)))continue;
      for(let cycle=0;cycle<2;cycle++){
        const result=await page.evaluate(async scenario=>{
          const {runChainCrossTransport}=await import('/tests/fixtures/schroederChainCrossTransport.js');
          return runChainCrossTransport(scenario);
        },scenario);
        console.log(JSON.stringify({scenario,cycle,...result}));assert.deepEqual(result.errors,[]);
        assert.equal(result.words[0],0,JSON.stringify(result));assert.equal(result.words[3],scenario.levelCount);
        assert.equal(result.words[1],scenario.fault||scenario.torqueRefusal||scenario.geometryFault?5:3);assert.equal(result.corrupted,Boolean(scenario.fault));
        assert.equal(result.torqueCorrupted,Boolean(scenario.torqueRefusal));
        assert.equal(result.geometryCorrupted,Boolean(scenario.geometryFault));
        if(scenario.torqueRefusal)assert.ok(result.words.slice(26).some(mask=>(mask&4096)!==0),'original angular admission must reject');
      }
    }
  }finally{await browser.close();}
});
