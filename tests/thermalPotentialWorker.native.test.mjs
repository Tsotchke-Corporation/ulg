import assert from 'node:assert/strict';
import test from 'node:test';

test('G6 real worker fits cross StateManager acknowledgement and continue exact thermal intervals',{
  skip:process.env.ULG_RUN_NATIVE_THERMAL_WORKER!=='1',timeout:240000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer','--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
  try{
    const page=await browser.newPage({ignoreHTTPSErrors:true});const base='https://127.0.0.1:5173/';
    page.on('console',message=>{if(message.type()==='error'||message.text().startsWith('G6 worker terminal'))console.error(message.text());});
    page.on('requestfailed',request=>console.error(request.url(),request.failure()?.errorText));
    page.on('response',response=>{if(response.status()>=400)console.error(response.status(),response.url());});
    await page.route(url=>url.href===base,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>G6 Worker proof</title>'}));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    for(const dropAcknowledgement of [false,true]){
    const result=await page.evaluate(async dropAcknowledgement=>{
      const {runThermalPotentialWorkerNative}=await import('/tests/fixtures/thermalPotentialWorkerPageNative.js');
      return runThermalPotentialWorkerNative({dropAcknowledgement});
    },dropAcknowledgement);
    console.log(JSON.stringify({dropAcknowledgement,...result}));assert.deepEqual(result.errors,[]);assert.equal(result.validation,null);
    const fitted=result.runs.filter(r=>r.enabled);
    assert.deepEqual(fitted.map(r=>r.thermalPotential.ordinal),dropAcknowledgement?[0,0,1]:[0,1,1]);
    assert.deepEqual(fitted.map(r=>r.thermalPotential.adopted),dropAcknowledgement?[false,false,true]:[false,true,false]);
    assert.equal(fitted[0].thermalPotential.cumulativeConsumerHits,0);
    if(dropAcknowledgement)assert.equal(fitted[1].thermalPotential.cumulativeConsumerHits,0);
    else assert.ok(fitted[1].thermalPotential.cumulativeConsumerHits>0);
    assert.ok(fitted[2].thermalPotential.cumulativeConsumerHits>fitted[1].thermalPotential.cumulativeConsumerHits);
    for(const run of result.runs){assert.equal(run.proof[0],0);assert.equal(run.proof[4],1);
      assert.equal(run.commitStatus,'state-manager-committed-worker-schedule');assert.equal(run.fence,true);}
    assert.equal(result.sourceChange.rejected,true);assert.equal(result.sourceChange.physicsTick,3);
    }
  }finally{await browser.close();}
});
