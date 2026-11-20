import assert from 'node:assert/strict';
import test from 'node:test';

test('phase-slot refinement conserves every integer mass and energy word', {
  skip: process.env.ULG_RUN_NATIVE_PHASE_SLOT_LEDGER !== '1', timeout:120_000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer','--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage({ignoreHTTPSErrors:true});
    const url='https://127.0.0.1:5173/__phase_slot_ledger_test__';
    await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Integer refinement gate</title>'}));
    await page.goto(url);
    const result=await page.evaluate(async()=>{
      let adapter;
      for(let i=0;i<5&&!adapter;i++){
        adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
        if(!adapter)await new Promise(resolve=>setTimeout(resolve,500));
      }
      if(!adapter) throw new Error('Native WebGPU adapter unavailable');
      const device=await adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:12}});
      const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
      device.pushErrorScope('validation');
      try{
        const {runPhaseSlotLedgerNative}=await import('/tests/fixtures/schroederPhaseSlotLedgerNative.js');
        const receipts=await runPhaseSlotLedgerNative(device);
        const {runPhaseSlotLedgerContinuationNative}=await import('/tests/fixtures/schroederPhaseSlotLedgerContinuationNative.js');
        const continuation=await runPhaseSlotLedgerContinuationNative(device);
        const validation=await device.popErrorScope();if(validation)errors.push(validation.message);
        return {receipts,continuation,errors};
      }finally{device.destroy();}
    });
    console.log(JSON.stringify(result));
    assert.deepEqual(result.errors,[]);assert.equal(result.receipts.length,9);
    for(const r of result.receipts){assert.equal(r.words[7],1,r.mode);assert.equal(r.words[0],0,JSON.stringify(r));}
    assert.equal(result.continuation.length,3);
    for(const [i,r] of result.continuation.entries()){
      assert.deepEqual(r.words,i===0?[0,2,1,0,0,0,0,1]:[0,9,8,0,0,0,0,1]);assert.equal(r.sourceStage,'phase-slot-refinement');
    }
    assert.ok(result.continuation[2].generation>result.continuation[1].generation);
    assert.ok(result.continuation[1].generation>result.continuation[0].generation);
    assert.ok(result.continuation[1].topologyEpoch>result.continuation[0].topologyEpoch);
  }finally{await browser.close();}
});
