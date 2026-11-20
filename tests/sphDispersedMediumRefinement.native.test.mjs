import assert from 'node:assert/strict';
import test from 'node:test';

test('GPU optics follows reused gas lineages without inventing condensed mass',{
  skip:process.env.ULG_RUN_NATIVE_REFINEMENT_OPTICS!=='1',timeout:60000
},async()=>{
  const {chromium}=await import('@playwright/test');
  // Configure local-test TLS at process start: toggling the verifier through
  // the context during the first module fan-out can cancel requests.
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer','--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist','--enable-webgpu-developer-features','--ignore-certificate-errors']});
  try{
    const page=await browser.newPage();
    page.on('requestfailed',request=>console.log('requestfailed',request.url(),request.failure()));
    page.on('console',message=>{if(message.type()==='error')console.log('browsererror',message.text());});
    const url='https://127.0.0.1:5173/__refinement_optics_test__';
    await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Refinement optics</title>'}));
    await page.goto(url);
    const result=await page.evaluate(async()=>{
      const {runDispersedMediumRefinementNative}=await import('/tests/fixtures/sphDispersedMediumRefinementNative.js');
      return runDispersedMediumRefinementNative();
    });
    console.log(JSON.stringify(result));
    assert.deepEqual(result.errors,[]);
    assert.deepEqual(result.words,[0,3,13,0,2,0,3,1],
      'GPU checks both replacement species, dormant route removal, preserved prior mass and zero fabricated births');
    assert.equal(result.declarationMode,'gpu-dynamic-route-catalog-v0');
    assert.equal(result.reactionCaptureEnabled,false);
    assert.equal(result.routeRefreshEnabled,true);
  }finally{await browser.close();}
});
