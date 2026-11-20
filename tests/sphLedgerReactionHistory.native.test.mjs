import assert from 'node:assert/strict';
import test from 'node:test';

test('canonical reaction history preserves counted predecessors through shared and separate rollback',{
  skip:process.env.ULG_RUN_NATIVE_LEDGER_HISTORY!=='1',timeout:120000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__ledger_history_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>History rollback</title>'}));
    await page.goto(url);
    await page.waitForFunction(async()=>Boolean(await navigator.gpu.requestAdapter({powerPreference:'high-performance'})),null,{timeout:10000,polling:250});
    const result=await page.evaluate(async()=>{
      const {runLedgerReactionHistoryNative}=await import('/tests/fixtures/sphLedgerReactionHistoryNative.js');
      return runLedgerReactionHistoryNative();
    });
    console.log(JSON.stringify(result));assert.deepEqual(result.errors,[]);assert.equal(result.results.length,8);
    for(const {kind,words} of result.results) assert.equal(words[0],0,`${kind}: ${words}`);
    const speed=await page.evaluate(async()=>{
      const {runChainSpeedBoundNative}=await import('/tests/fixtures/schroederSpatialChainSpeedBoundNative.js');
      return runChainSpeedBoundNative();
    });
    console.log(JSON.stringify({speed}));assert.deepEqual(speed.errors,[]);
    assert.deepEqual(speed.words.slice(0,speed.expected.length),speed.expected);
  } finally {await browser.close();}
});
