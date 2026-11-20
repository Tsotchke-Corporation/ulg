import assert from 'node:assert/strict';
import test from 'node:test';

test('resident chain advances retained state, clock and parcels across accepted and rejected intervals',{
  skip:process.env.ULG_RUN_NATIVE_CHAIN_PRIVATE!=='1',timeout:420000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__chain_private_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Private chain owner</title>'}));
    await page.goto(url);
    await page.waitForFunction(async()=>Boolean(await navigator.gpu.requestAdapter({powerPreference:'high-performance'})),null,{timeout:10000,polling:250});
    const privateSteps=Number(process.env.ULG_CHAIN_PRIVATE_STEPS??3);
    assert.ok(Number.isInteger(privateSteps) && privateSteps>=0 && privateSteps<=3);
    // Keep full solid constitutive stiffness. The manufactured iron transient
    // is stable at 1 us; its 1 ms counterpart must retain state and reject time.
    for(const scenario of [
      {levelCount:2,dtSeconds:0.000001},
      {levelCount:3,closureFault:true,dtSeconds:0.000001},
      {levelCount:3,phaseTransfer:'boiling',fluid:true,parcels:'airborne'},
      {levelCount:3,phaseTransfer:'boiling',fluid:true,parcels:'airborne',closureFault:true},
      {levelCount:3,phaseTransfer:'boiling',fluid:true,refinement:'split'},
      {levelCount:2,dtSeconds:0.001,continuationRejected:true},
      {levelCount:3,finiteWalls:'hot',dtSeconds:0.000001},
      {levelCount:3,finiteWalls:'cold',dtSeconds:0.000001,closureFault:true},
      {levelCount:3,finiteWalls:'hot',dtSeconds:0.000001,privateWallFault:true},
      {levelCount:3,reaction:true,fluid:true,dtSeconds:0.000001},
      {levelCount:3,reaction:true,fluid:true,dtSeconds:0.000001,closureFault:true},
      {levelCount:3,reaction:true,fluid:true,dtSeconds:0.000001,phaseTransfer:true,phaseLineageCapacity:6},
      {levelCount:3,reaction:true,fluid:true,dtSeconds:0.000001,privateReactionFault:'prefix'},
      {levelCount:3,reaction:true,fluid:true,dtSeconds:0.000001,privateReactionFault:'count'},
      {levelCount:3,reaction:true,fluid:true,dtSeconds:0.000001,privateReactionCarry:true},
      {levelCount:3,reaction:true,fluid:true,dtSeconds:0.001,continuationRejectedAfter:1},
      {levelCount:3,reaction:true,fluid:true,dtSeconds:0.000001,phaseTransfer:true,continuationRejectedAfter:1,continuationRejectionMask:4096},
      {levelCount:3,reaction:true,fluid:true,dtSeconds:0.000001,privateReactionCarry:true,privateInventoryFault:true}
    ].filter((_,index)=>!process.env.ULG_CHAIN_PRIVATE_CASE || process.env.ULG_CHAIN_PRIVATE_CASE.split(',').includes(String(index)))) {
      const result=await page.evaluate(async ({scenario,privateSteps,privatePublish})=>{
        const {runLevelChainNative}=await import('/tests/fixtures/schroederSpatialLevelChainNative.js');
        return runLevelChainNative(scenario.levelCount,{composite:true,publish:true,particles:true,closure:true,
          exact:true,ledger:true,forceCase:'off',privateContinuation:true,privateSteps,privatePublish,...scenario});
      },{scenario,privateSteps,privatePublish:process.env.ULG_CHAIN_PRIVATE_PUBLISH==='1'});
      console.log(JSON.stringify({scenario,...result}));
      assert.equal(result.fatal,undefined);assert.deepEqual(result.errors,[]);assert.equal(result.cycles.length,2);
      for(const cycle of result.cycles) {
        assert.equal(cycle.closureWords[0],0);assert.equal(cycle.privateWords[0],0);
        assert.equal(cycle.privateWords[1],scenario.closureFault?0:1);
        assert.equal(cycle.privateWords[2],scenario.closureFault?1:0);assert.equal(cycle.privateWords[3],1);
        if(privateSteps) {
          assert.equal(cycle.continuationWords[0],0,JSON.stringify(cycle.continuationWords));
          const lateRejection=(scenario.privateWallFault || scenario.privateReactionFault || scenario.privateInventoryFault) && privateSteps>=2?1:0;
          const physicalRejections=scenario.continuationRejected?privateSteps:scenario.continuationRejectedAfter!=null?Math.max(0,privateSteps-scenario.continuationRejectedAfter):0;
          assert.equal(cycle.continuationWords[1],privateSteps-physicalRejections+(scenario.closureFault?0:1)-lateRejection);
          assert.equal(cycle.continuationWords[2],(scenario.closureFault?1:0)+physicalRejections+lateRejection);
          assert.equal(cycle.continuationWords[3],privateSteps+1);
          if(scenario.finiteWalls) {
            for(let i=0;i<privateSteps;i++) {
              assert.equal(cycle.wallContinuationWords[i*8],0,JSON.stringify(cycle.wallContinuationWords));
              if(!(scenario.privateWallFault && i===1)) assert.ok(cycle.wallContinuationWords[i*8+6]>0,'accepted wall temperature must change');
            }
            if(lateRejection) assert.ok(cycle.continuationWords[5]&32768,'late wall corruption must reject');
          }
          if(scenario.reaction) {
            for(let i=0;i<privateSteps;i++) assert.equal(cycle.reactionContinuationWords[i*8],0,JSON.stringify(cycle.reactionContinuationWords));
            assert.ok(cycle.reactionContinuationWords[4]>0,'real reaction records must survive continuation');
            if(scenario.privateReactionFault && lateRejection) assert.ok(cycle.continuationWords[5]&262144,'corrupt lineage must reject');
            if(scenario.privateInventoryFault && lateRejection) assert.ok(cycle.continuationWords[5]&2048,'reaction-disabled carry must reject a lost energy quantum');
            if(scenario.continuationRejectedAfter!=null) for(let i=scenario.continuationRejectedAfter;i<privateSteps;i++) {
              if(scenario.continuationRejectionMask===4096) assert.ok(cycle.continuationWords[4+i]&4096,'placement capacity must reject');
              else assert.ok(cycle.reactionContinuationWords[i*8+6]&2,'the physical speed limit must reject');
            }
          }
        }
        if(scenario.parcels || scenario.refinement) assert.equal(cycle.closureWords[26],0);
      }
    }
  } finally {await browser.close();}
});
