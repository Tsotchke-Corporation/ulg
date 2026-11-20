import assert from 'node:assert/strict';
import test from 'node:test';

test('resident clock follows GPU acceptance, including physical rollback', {
  skip:process.env.ULG_RUN_NATIVE_RESIDENT_CLOCK!=='1',timeout:420000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage();const url='https://127.0.0.1:5173/__resident_clock_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Resident clock</title>'}));
    await page.goto(url);
    await page.waitForFunction(async()=>Boolean(await navigator.gpu?.requestAdapter({powerPreference:'high-performance'})),
      null,{timeout:10000,polling:250});
    const result=await page.evaluate(async()=>{
      const {runResidentClockNative}=await import('/tests/fixtures/sphResidentClockNative.js');
      return runResidentClockNative();
    });
    console.log(JSON.stringify(result));assert.deepEqual(result.errors,[]);
    for(const report of result.reports) {
      const w=report.words;
      if(report.name==='step-exhausted') {
        assert.equal(w[2],0);assert.equal(w[3],0);assert.equal(w[12],0);assert.equal(w[18],131072);
      } else if(report.name==='damaged-origin') {
        assert.equal(w[0],0);assert.equal(w[2],1);assert.equal(w[12],1);assert.equal(w[18],131072);
      } else {
        assert.equal(w[0],0x53434c31);assert.equal(w[1],1);
        assert.equal(w[2],report.expectedAccepted);assert.equal(w[3],report.expectedRejected);
        assert.equal(w[12],report.expectedAccepted+report.expectedRejected);
        assert.equal(w[4]+w[5]*0x100000000,report.sourceStep);
        const data=new DataView(new Uint32Array(w).buffer);
        assert.equal(data.getFloat64(24,true),report.sourceTime);
        assert.equal(data.getFloat64(32,true),0.001);
      }
    }
    for(const scenario of [
      {levelCount:2,forceCase:'gravity'},
      {levelCount:3,forceCase:'gravity',exact:true,ledger:true,closureFault:true},
      {levelCount:3,forceCase:'gravity',exact:true,ledger:true,clockExhausted:true},
      {levelCount:3,forceCase:'off',exact:true,ledger:true,fluid:true,phaseTransfer:'boiling',
        parcels:'airborne',finiteWalls:'hot'},
      {levelCount:3,forceCase:'off',exact:true,ledger:true,fluid:true,phaseTransfer:'boiling',
        parcels:'airborne',finiteWalls:'hot',clockExhausted:true},
      {levelCount:3,forceCase:'off',exact:true,ledger:true,fluid:true,phaseTransfer:true,
        reaction:true,refinement:'split',clockExhausted:true}
    ].filter((_,index)=>!process.env.ULG_CLOCK_EXTENDED_ONLY || index>=3)) {
      const result=await page.evaluate(async scenario=>{
        const {runLevelChainNative}=await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,{composite:true,publish:true,particles:true,closure:true,...scenario});
      },scenario);
      console.log(JSON.stringify({scenario,...result}));
      assert.equal(result.fatal,undefined);assert.deepEqual(result.errors,[]);assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles) {
        assert.equal(cycle.closureWords[0],0,'clock and full physical rollback');
        if(scenario.exact) assert.equal(cycle.closureWords[12],0,'exact energy or reaction conservation');
        if(scenario.parcels || scenario.refinement) assert.equal(cycle.closureWords[26],0,'parcel/refinement conservation and rollback');
        if(scenario.finiteWalls) assert.equal(cycle.closureWords[28],0,'finite wall conservation and rollback');
      }
    }
  } finally {await browser.close();}
});
