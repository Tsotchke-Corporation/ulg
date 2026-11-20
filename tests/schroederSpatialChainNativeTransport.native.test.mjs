import assert from 'node:assert/strict';
import test from 'node:test';

test('native chain gas mixture conserves momentum and books kinetic loss as heat',{
  skip:process.env.ULG_RUN_NATIVE_CHAIN_TRANSPORT!=='1',timeout:600000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__chain_native_transport_test__';
    await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<title>Native mixture</title>'}));await page.goto(url);
    const scenarios=[{levelCount:3},{levelCount:6},{levelCount:3,enabled:false},
      {levelCount:6,emptyMiddle:true},{levelCount:3,fault:true},{levelCount:2},{levelCount:3,drag:true},{levelCount:6,drag:true},
      {levelCount:3,drag:true,enabled:false}];
    for(const [index,scenario]of scenarios.entries()){
      if(process.env.ULG_CHAIN_TRANSPORT_CASE&&!process.env.ULG_CHAIN_TRANSPORT_CASE.split(',').includes(String(index)))continue;
      for(let cycle=0;cycle<2;cycle++){
        const result=await page.evaluate(async scenario=>{
          const {runChainNativeTransport}=await import('/tests/fixtures/schroederChainNativeTransport.js');
          return runChainNativeTransport(scenario);
        },scenario);
        console.log(JSON.stringify({scenario,cycle,...result}));assert.deepEqual(result.errors,[]);
        assert.equal(result.words[0],0,JSON.stringify(result.words));assert.equal(result.words[10],scenario.levelCount);
        assert.equal(result.words[1],scenario.fault?5:3);assert.equal(result.corrupted,Boolean(scenario.fault));
      }
    }
  }finally{await browser.close();}
});
