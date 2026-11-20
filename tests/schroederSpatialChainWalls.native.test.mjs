import assert from 'node:assert/strict';
import test from 'node:test';

test('native multilevel finite walls use paired exact heat and complete rejection', {
  skip:process.env.ULG_RUN_NATIVE_CHAIN_WALLS!=='1',timeout:600000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__chain_walls_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Chain walls</title>'}));
    await page.goto(url);
    await page.waitForFunction(async()=>Boolean(await navigator.gpu.requestAdapter({powerPreference:'high-performance'})),null,{timeout:10000,polling:250});
    if(!process.env.ULG_CHAIN_WALL_CASE || process.env.ULG_CHAIN_WALL_CASE==='reduction') {
      const reduction=await page.evaluate(async()=>{
        const {runExactFiniteWallReductionNative}=await import('/tests/fixtures/sphExactFiniteWallReductionNative.js');
        return runExactFiniteWallReductionNative();
      });
      console.log(JSON.stringify({reduction}));assert.deepEqual(reduction.errors,[]);
      assert.equal(reduction.results.length,3);
      for(const row of reduction.results) {assert.equal(row.words[0],0,row.kind);assert.equal(row.dispatches,4);}
    }
    const scenarios=[{levelCount:3,finiteWalls:'hot'},{levelCount:2,finiteWalls:'cold'},
      {levelCount:3,finiteWalls:'mixed',thermalPair:true},
      {levelCount:3,finiteWalls:'hot',phaseTransfer:'boiling',fluid:true,parcels:'airborne'},
      {levelCount:3,finiteWalls:'hot',particleFault:true},{levelCount:3,finiteWalls:'hot',closureFault:true},
      {levelCount:3,finiteWalls:'hot',closureFault:'wall-energy'},
      {levelCount:3,finiteWalls:'hot',closureFault:'wall-temperature'},
      {levelCount:3,finiteWalls:'hot',closureFault:'wall-error'},
      {levelCount:3,finiteWalls:'legacy'},{levelCount:3,finiteWalls:'underflow'}];
    for(const scenario of scenarios.filter((s,i)=>!process.env.ULG_CHAIN_WALL_CASE || String(i)===process.env.ULG_CHAIN_WALL_CASE)) {
      const result=await page.evaluate(async scenario=>{
        const {runLevelChainNative}=await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,{composite:true,publish:true,particles:true,closure:true,
          exact:true,ledger:true,forceCase:'off',...scenario});
      },scenario);
      console.log(JSON.stringify({scenario,...result}));
      assert.equal(result.fatal,undefined);assert.deepEqual(result.errors,[]);assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles) {
        assert.equal(cycle.words[0],0,'mechanics invariants');
        assert.equal(cycle.closureWords[0],0,'physical acceptance/rollback');
        assert.equal(cycle.closureWords[1],scenario.particleFault||scenario.closureFault||['legacy','underflow'].includes(scenario.finiteWalls)?5:3);
        assert.equal(cycle.closureWords[28],0,'exact wall pairing, temperature, source immutability and rollback');
        if(String(scenario.closureFault).startsWith('wall-')) assert.ok(cycle.closureWords[2]&32768);
        if(scenario.parcels) assert.equal(cycle.closureWords[26],0,'parcel and carrier conservation');
        else if(!scenario.phaseTransfer) assert.equal(cycle.closureWords[12],0,'carrier U-S');
      }
    }
  } finally {await browser.close();}
});
