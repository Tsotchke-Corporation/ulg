import assert from 'node:assert/strict';
import test from 'node:test';

test('original retained products survive repeated EOS pressure and exact phase intervals',{
  skip:process.env.ULG_RUN_NATIVE_RESIDUAL_PRESSURE!=='1',timeout:600000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage({ignoreHTTPSErrors:true}),url='https://127.0.0.1:5173/__retained_pressure_test__';
    page.on('requestfailed',r=>console.log(JSON.stringify({requestFailed:r.url(),failure:r.failure()})));
    page.on('response',r=>{if(r.status()>=400)console.log(JSON.stringify({responseFailed:r.url(),status:r.status()}));});
    await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<title>Retained product pressure</title>'}));
    await page.goto(url);
    const scenarios=[{levelCount:3,kind:'repeat-phase-eos-vapor'},
      {levelCount:6,kind:'repeat-phase-eos-vapor'},
      {levelCount:3,kind:'repeat-phase-eos-off-vapor'},
      {levelCount:3,kind:'repeat-phase-eos-ledger-fault'},
      {levelCount:6,kind:'repeat-phase-eos-ledger-fault'},
      {levelCount:3,kind:'repeat-phase-publish-eos-vapor'},
      {levelCount:6,kind:'repeat-phase-eos-off-vapor'}];
    for(const [index,scenario]of scenarios.entries()){
      if(process.env.ULG_RESIDUAL_PRESSURE_CASE&&!process.env.ULG_RESIDUAL_PRESSURE_CASE.split(',').includes(String(index)))continue;
      for(let cycle=0;cycle<2;cycle++){
        const result=await page.evaluate(async({levelCount,kind})=>{
          const {runResidualMechanicsSourceNative}=await import('/tests/fixtures/schroederResidualMechanicsSourceNative.js');
          return runResidualMechanicsSourceNative({phase:true,kinds:[kind],levelCount});
        },scenario);
        console.log(JSON.stringify({scenario,cycle,...result}));
        assert.deepEqual(result.errors,[]);assert.equal(result.results.length,1);
        const {words}=result.results[0],fault=scenario.kind.endsWith('fault');
        assert.equal(words[0],0,JSON.stringify(words));
        assert.equal(words[11],fault?2:3);assert.equal(words[12],3);
        assert.equal(words[13],30,'every original lineage conserves exact mass and U-S');
        assert.equal(words[23],3,'all three intervals consume original-source pressure');
        if(!fault){assert.equal(words[25],1);assert.equal(words[24]>0,!scenario.kind.includes('-off-'));}
        if(scenario.kind.includes('-publish-')){assert.equal(words[20],2);assert.equal(words[22],1);}
      }
    }
  }finally{await browser.close();}
});
