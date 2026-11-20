import assert from 'node:assert/strict';
import test from 'node:test';

test('native multilevel pressure uses the canonical EOS, work receipts and whole-chain rollback',{
  skip:process.env.ULG_RUN_NATIVE_CHAIN_PRESSURE!=='1',timeout:600000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage();
    page.on('requestfailed',request=>console.log(JSON.stringify({requestFailed:request.url(),failure:request.failure()})));
    page.on('response',response=>{if(response.status()>=400)console.log(JSON.stringify({httpStatus:response.status(),url:response.url()}));});
    const url='https://127.0.0.1:5173/__chain_pressure_test__';
    await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<title>Chain pressure</title>'}));await page.goto(url);
    const scenarios=[{levelCount:2,gradient:0},{levelCount:2,gradient:10000},{levelCount:2,gradient:-5000},{levelCount:2,gradient:10000,scale:0},{levelCount:2,gradient:1e9},{levelCount:3,gradient:10000},
      {levelCount:6,gradient:10000},{levelCount:3,gradient:10000,scale:0},{levelCount:3,gradient:1e9},
      {levelCount:3,gradient:0},{levelCount:3,gradient:-5000},{levelCount:4,gradient:10000},
      {levelCount:3,gradient:10000,populated:true},{levelCount:6,gradient:10000,populated:true},
      {levelCount:4,gradient:10000,coarseOnly:true},{levelCount:3,gradient:10000,fault:'pressure'},
      {levelCount:4,gradient:10000,fault:'edge'}];
    for(const scenario of scenarios.filter(s=>(!process.env.ULG_CHAIN_PRESSURE_LEVELS || process.env.ULG_CHAIN_PRESSURE_LEVELS.split(",").map(Number).includes(s.levelCount))
      && (!process.env.ULG_CHAIN_PRESSURE_GRADIENTS || process.env.ULG_CHAIN_PRESSURE_GRADIENTS.split(",").map(Number).includes(s.gradient)))) {
      for(let cycle=0;cycle<2;cycle++){
        const result=await page.evaluate(async scenario=>{
          const {runChainPressureNative}=await import('/tests/fixtures/schroederChainPressureNative.js');
          return runChainPressureNative(scenario);
        },scenario);
        console.log(JSON.stringify({scenario,cycle,...result}));
        assert.deepEqual(result.errors,[]);assert.equal(result.words[0],0);
        assert.equal(result.mappedBytes,128);assert.equal(result.eosReadbackBytes,0);assert.equal(result.eosHostQueueFenceCount,0);
        assert.equal(result.boundarySubmitted,true);
        assert.equal(result.nativeBoundariesSubmitted,scenario.levelCount>2 ? scenario.levelCount : 1);
        assert.equal(result.eosRetired,true);
        const rejected=scenario.gradient===1e9 || Boolean(scenario.fault);
        assert.equal(result.words[1],rejected?5:3);
        if(!rejected){
          const f=new Float32Array(new Uint32Array(result.words).buffer);
          if(!scenario.gradient||scenario.scale===0)assert.ok(Math.abs(f[4])<1e-7,'uniform equilibrium and disabled-law rest');
          else assert.ok(f[4]*scenario.gradient<0 && Math.abs(f[4])>1e-4,'motion down the real pressure gradient');
        }
      }
    }
  }finally{await browser.close();}
});
