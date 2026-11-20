import assert from 'node:assert/strict';
import test from 'node:test';

test('G6 retained caloric graph fits on GPU and adopts only through the resident StateManager bridge', {
  skip: process.env.ULG_RUN_NATIVE_THERMAL_POTENTIAL !== '1', timeout: 180000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer','--enable-unsafe-webgpu','--ignore-gpu-blocklist'] });
  let result;
  try {
    const page=await browser.newPage({ignoreHTTPSErrors:true});
    const base='https://127.0.0.1:5173/';
    await page.route(url=>url.href===base,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>G6 potential proof</title>'}));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    result=await page.evaluate(async()=>{
      const {runThermalPotentialNativeProof}=await import('/tests/fixtures/thermalPotentialNative.js');
      return runThermalPotentialNativeProof();
    });
  } finally {await browser.close();}
  console.log(JSON.stringify(result));
  assert.deepEqual(result.compilation,[]);assert.deepEqual(result.errors,[]);assert.equal(result.validation,null);
  assert.equal(result.accepted[0],0);assert.equal(result.accepted[1],65);assert.equal(result.accepted[2],0);
  assert.equal(result.retained[1],0);assert.equal(result.retained[2],65);
  assert.equal(result.rejectedFit,true);
  assert.deepEqual(result.spatialMiss.slice(0,3),[0,2,0]);
  assert.deepEqual(result.spatialBaseline.slice(0,3),[0,2,0]);
  assert.deepEqual(result.spatial.slice(0,3),[0,2,2]);
});
