import assert from 'node:assert/strict';
import test from 'node:test';

test('original-source gas pressure survives repeated exact-energy phase intervals',{
  skip:process.env.ULG_RUN_NATIVE_CHAIN_PRESSURE_INTERVAL!=='1',timeout:600000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const wayland=Boolean(process.env.WAYLAND_DISPLAY);
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:!wayland,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features',
      ...(wayland?['--ozone-platform=wayland']:[])]});
  try{
    const context=await browser.newContext({ignoreHTTPSErrors:true});
    const page=await context.newPage(),url='https://127.0.0.1:5173/__chain_pressure_interval_test__';
    page.on('requestfailed',request=>console.log(JSON.stringify({requestFailed:request.url(),failure:request.failure()})));
    await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<title>Pressure interval</title>'}));
    await page.goto(url);
    const scenarios=[{levelCount:3,privatePressure:1},{levelCount:6,privatePressure:1},
      {levelCount:3,privatePressure:0},{levelCount:3,privatePressure:1,privateInventoryFault:true},
      {levelCount:3,privatePressure:1e12,privatePressureRejected:true},{levelCount:2,privatePressure:1},
      {levelCount:3,privatePressure:1,privateNativeTransport:true},
      {levelCount:6,privatePressure:1,privateNativeTransport:true},
      {levelCount:3,privatePressure:1,privateNativeTransport:true,privateInventoryFault:true},
      {levelCount:2,privatePressure:1,privateSurface:true},
      {levelCount:3,privatePressure:1,privateSurface:true,privateNativeTransport:true},
      {levelCount:6,privatePressure:1,privateSurface:true,privateNativeTransport:true},
      {levelCount:3,privatePressure:1,privateSurface:'off',privateNativeTransport:true},
      {levelCount:3,privatePressure:1,privateSurface:true,privateNativeTransport:true,privateInventoryFault:true}];
    for(const [index,scenario]of scenarios.entries()){
      if(process.env.ULG_CHAIN_PRESSURE_INTERVAL_CASE && !process.env.ULG_CHAIN_PRESSURE_INTERVAL_CASE.split(',').includes(String(index)))continue;
      const result=await page.evaluate(async scenario=>{
        const {runLevelChainNative}=await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,{composite:true,publish:true,particles:true,closure:true,
          exact:true,ledger:true,phaseTransfer:'boiling',fluid:true,forceCase:'off',
          dtSeconds:scenario.privateSurface?0.00001:0.000001,
          privateContinuation:true,privateSteps:3,...scenario});
      },scenario);
      console.log(JSON.stringify({scenario,...result}));
      assert.equal(result.fatal,undefined);assert.deepEqual(result.errors,[]);assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles){
        assert.equal(cycle.closureWords[0],0);assert.equal(cycle.privateWords[0],0);
        assert.equal(cycle.continuationWords[0],0,JSON.stringify(cycle.continuationWords));
        assert.equal(cycle.continuationWords[1],scenario.privatePressureRejected?1:scenario.privateInventoryFault?3:4);
        assert.equal(cycle.continuationWords[2],scenario.privatePressureRejected?3:scenario.privateInventoryFault?1:0);
        assert.equal(cycle.continuationWords[3],4);
        if(scenario.privatePressureRejected)for(const verdict of cycle.continuationWords.slice(4,7))assert.ok(verdict&1,'excessive pressure rejects the whole mechanical interval');
        if(scenario.privateInventoryFault)assert.ok(cycle.continuationWords[5]&2048,'one lost energy quantum rejects the interval');
        assert.equal(cycle.pressureContinuation.words[0],0,JSON.stringify(cycle.pressureContinuation.words));
        assert.equal(cycle.pressureContinuation.words[7],3);
        if(scenario.privateSurface){
          assert.equal(cycle.pressureContinuation.words[9],scenario.privateSurface==='off'?0:1);
          assert.equal(cycle.pressureContinuation.words[8]>0,scenario.privateSurface!=='off',
            'surface stress changes particle velocity or affine deformation against the same-pressure reference');
        }
        assert.equal(cycle.pressureContinuation.consumers.length,3);
        for(const pressure of cycle.pressureContinuation.consumers){
          assert.equal(pressure.submitted,true);assert.equal(pressure.retired,true);
          assert.equal(pressure.nativeConsumerCount,scenario.levelCount>2?scenario.levelCount:1);
          assert.equal(pressure.mapAsyncCount,0);assert.equal(pressure.hostQueueFenceCount,0);
          assert.equal(pressure.fullParticleReadbackPerformed,false);
        }
      }
    }
  }finally{await browser.close();}
});
