import assert from 'node:assert/strict';
import test from 'node:test';

test('reaction producer retains exact residual mass and signed U-S without admitting incomplete history transport',{
  skip:process.env.ULG_RUN_NATIVE_REACTION_RESIDUAL!=='1',timeout:180000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__reaction_residual_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Reaction residual ledger</title>'}));
    await page.goto(url);
    await page.waitForFunction(async()=>Boolean(await navigator.gpu.requestAdapter({powerPreference:'high-performance'})),null,{timeout:10000,polling:250});
    for(let cycle=0;cycle<2;cycle++) {
      const result=await page.evaluate(async()=>{
        const {runReactionResidualLedgerNative}=await import('/tests/fixtures/sphReactionResidualLedgerNative.js');
        return runReactionResidualLedgerNative();
      });
      console.log(JSON.stringify({cycle,...result}));assert.deepEqual(result.errors,[]);assert.equal(result.results.length,8);
      for(const {kind,words} of result.results)assert.equal(words[0],0,`${kind}: ${words}`);
    }
  }finally{await browser.close();}
});
