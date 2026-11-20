import assert from 'node:assert/strict';
import test from 'node:test';

test('native multilevel parcels conserve complete inventories and roll back every owner', {
  skip:process.env.ULG_RUN_NATIVE_CHAIN_PARCELS!=='1',timeout:600000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__chain_parcels_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Chain parcels</title>'}));
    await page.goto(url);
    await page.waitForFunction(async()=>Boolean(await navigator.gpu.requestAdapter({powerPreference:'high-performance'})),null,{timeout:10000,polling:250});
    const selectedCase=process.env.ULG_CHAIN_PARCEL_CASE;
    for(const parcels of selectedCase?[]:[false,true]) {
      const inventory=await page.evaluate(async parcels=>{
        const {runChainInventoryNative}=await import('/tests/fixtures/schroederSpatialChainInventoryNative.js');
        return runChainInventoryNative({parcels});
      },parcels);
      console.log(JSON.stringify({parcels,inventory}));assert.deepEqual(inventory.errors,[]);
      const masks={none:0,mass:1024,energy:2048,placement:4096,'mass-overflow':1024,'energy-overflow':2048,
        'parcel-mass':1024,'parcel-energy':2048,'sink-mass':1024,'sink-energy':2048,
        'parcel-sum-overflow':1024,'sink-sum-overflow':1024};
      for(const check of inventory.results) assert.equal(check.words[2],masks[check.fault],check.fault);
    }
    const scenarios=[{levelCount:3},{levelCount:2},{levelCount:3,refinement:'split'},
      {levelCount:3,parcels:'wall'},{levelCount:3,parcels:'wall',closureFault:true},{levelCount:3,parcels:'carrier'},
      {levelCount:3,particleFault:true},{levelCount:3,closureFault:true},
      {levelCount:3,closureFault:'parcel-error'},{levelCount:3,closureFault:'parcel-inventory'},
      {levelCount:3,parcels:'stokes'}];
    for(const scenario of scenarios.filter(s=>!selectedCase || s.parcels===selectedCase)) {
      const result=await page.evaluate(async scenario=>{
        const {runLevelChainNative}=await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,{composite:true,publish:true,particles:true,closure:true,
          exact:true,ledger:true,fluid:true,forceCase:'off',phaseTransfer:'boiling',parcels:'airborne',...scenario});
      },scenario);
      console.log(JSON.stringify({scenario,...result}));
      assert.equal(result.fatal,undefined);assert.deepEqual(result.errors,[]);assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles) {
        assert.equal(cycle.words[0],0,'mechanics invariants');
        assert.equal(cycle.closureWords[0],0,'physical acceptance/rollback');
        assert.equal(cycle.closureWords[1],scenario.particleFault||scenario.closureFault||scenario.parcels==='stokes'?5:3);
        assert.equal(cycle.closureWords[26],0,'global inventory, source immutability, actual transport and full rollback');
        if(scenario.closureFault==='parcel-error') assert.ok(cycle.closureWords[2]&16384);
        if(scenario.closureFault==='parcel-inventory') assert.ok(cycle.closureWords[2]&1024);
        if(scenario.parcels==='stokes') assert.ok(cycle.closureWords[27]&65536);
      }
    }
  } finally {await browser.close();}
});
