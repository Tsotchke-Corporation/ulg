import assert from 'node:assert/strict';
import test from 'node:test';

test('complete carrier, parcel, sink and canonical history inventories conserve exact mass and U-S',{
  skip:process.env.ULG_RUN_NATIVE_RESIDUAL_INVENTORY!=='1',timeout:180000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__residual_inventory_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Complete residual inventory</title>'}));
    await page.goto(url);
    await page.waitForFunction(async()=>Boolean(await navigator.gpu.requestAdapter({powerPreference:'high-performance'})),null,{timeout:10000,polling:250});
    for(let cycle=0;cycle<2;cycle++) {
      const result=await page.evaluate(async()=>{
        const {runReactionResidualInventoryNative}=await import('/tests/fixtures/sphReactionResidualInventoryNative.js');
        return runReactionResidualInventoryNative();
      });
      console.log(JSON.stringify({cycle,...result}));assert.deepEqual(result.errors,[]);assert.equal(result.results.length,19);
      const masks={mass:1024,energy:2048,source:2048,'parcel-mass':1024,'sink-energy':2048,
        count:1048576,seal:1048576,stride:1048576,'mass-overflow':1024,'energy-overflow':2048,
        'join-mass-overflow':1024,'join-energy-overflow':2048};
      for(const {kind,words}of result.results) {
        assert.equal(words[24],0,`${kind}: failed history rollback ${words}`);
        if(masks[kind])assert.equal(words[2]&masks[kind],masks[kind],`${kind}: missing rejection ${words}`);
        else assert.equal(words[2],0,`${kind}: ${words}`);
      }
    }
    // The history join must preserve the existing carrier/parcel-only route.
    for(const parcels of [false,true]) {
      const result=await page.evaluate(async parcels=>{
        const {runChainInventoryNative}=await import('/tests/fixtures/schroederSpatialChainInventoryNative.js');
        return runChainInventoryNative({parcels});
      },parcels);
      console.log(JSON.stringify({legacyInventory:true,parcels,...result}));assert.deepEqual(result.errors,[]);
      assert.equal(result.results.length,parcels?12:6);
      const masks={none:0,mass:1024,energy:2048,placement:4096,'mass-overflow':1024,'energy-overflow':2048,
        'parcel-mass':1024,'parcel-energy':2048,'sink-mass':1024,'sink-energy':2048,
        'parcel-sum-overflow':1024,'sink-sum-overflow':1024};
      for(const {fault,words}of result.results)assert.equal(words[2],masks[fault],fault);
    }
  }finally{await browser.close();}
});
