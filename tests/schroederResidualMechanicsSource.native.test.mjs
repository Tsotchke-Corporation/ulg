import assert from 'node:assert/strict';
import test from 'node:test';

test('native chain batches enter real ComputeManager and StateManager with accepted time',{
  skip:process.env.ULG_RUN_NATIVE_CHAIN_RESIDENT!=='1',timeout:300000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__resident_chain_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Resident chain admission</title>'}));
    await page.goto(url);
    for(let cycle=0;cycle<2;cycle++){
      const result=await page.evaluate(async()=>{
        const {runResidualMechanicsSourceNative}=await import('/tests/fixtures/schroederResidualMechanicsSourceNative.js');
        return runResidualMechanicsSourceNative({phase:true,kinds:['repeat-phase-resident-fusion','repeat-phase-resident-ledger-fault','repeat-phase-resident-commit-rejected']});
      });
      console.log(JSON.stringify({resident:true,cycle,...result}));assert.deepEqual(result.errors,[]);
      assert.equal(result.results.length,3);
      for(const {kind,words}of result.results){
        assert.equal(words[0],0,`${kind}: ${words}`);
        if(kind.endsWith('commit-rejected')){
          assert.equal(words[25],1,'real admission rejection exposes completed original-owner cleanup');continue;
        }
        assert.equal(words[11],kind.endsWith('fault')?3:4,'only accepted GPU intervals advance time');
        assert.equal(words[12],4,'two real resident batches of two intervals');
        assert.equal(words[13],20,'all ten lineages conserve exact mass and U-S after both batches');
        assert.equal(words[23],2,'two real StateManager entries contain matching retained state and accepted time');
        assert.equal(words[24],1,'normal cleanup preserves held reads and releases their final physical storage');
      }
    }
  }finally{await browser.close();}
});

test('chain batches publish retained state and accepted time through the existing spatial owner',{
  skip:process.env.ULG_RUN_NATIVE_CHAIN_PUBLICATION!=='1',timeout:300000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__residual_phase_continuation_test__';
    page.on('requestfailed',request=>console.error('Residual phase continuation request failed:',request.url(),request.failure()?.errorText));
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Repeated retained phases</title>'}));
    await page.goto(url);
    for(let cycle=0;cycle<2;cycle++){
      const result=await page.evaluate(async()=>{
        const {runResidualMechanicsSourceNative}=await import('/tests/fixtures/schroederResidualMechanicsSourceNative.js');
        return runResidualMechanicsSourceNative({phase:true,kinds:['repeat-phase-publish-fusion','repeat-phase-publish-vapor','repeat-phase-publish-ledger-fault','repeat-phase-publish-clock-corrupt']});
      });
      console.log(JSON.stringify({phaseContinuation:true,cycle,...result}));assert.deepEqual(result.errors,[]);
      assert.equal(result.results.length,4);
      for(const {kind,words}of result.results){
        assert.equal(words[0],0,`${kind}: ${words}`);
        const corrupt=kind.endsWith('clock-corrupt');
        assert.equal(words[11],corrupt || kind.endsWith('fault')?2:3,'clock advances only accepted steps');
        assert.equal(words[12],corrupt?2:3,'three genuine complete intervals');
        assert.equal(words[21],corrupt?1:0,'corrupt clock refuses publication');
        assert.equal(words[22],corrupt?0:1,'intermediate physical predecessor retires before the next batch');
        assert.equal(words[20],corrupt?0:2,'two genuine spatial publications around subsequent GPU evolution');
        assert.equal(words[13],corrupt?20:30,'all ten fixed lineages conserve mass and U-S across all three steps');
      }
    }
  }finally{await browser.close();}
});

test('retained phase lineages persist through complete private intervals and recover after rejection',{
  skip:process.env.ULG_RUN_NATIVE_RESIDUAL_PHASE_CONTINUATION!=='1',timeout:300000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__residual_phase_continuation_test__';
    page.on('requestfailed',request=>console.error('Residual phase continuation request failed:',request.url(),request.failure()?.errorText));
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Repeated retained phases</title>'}));
    await page.goto(url);
    for(let cycle=0;cycle<2;cycle++){
      const result=await page.evaluate(async()=>{
        const {runResidualMechanicsSourceNative}=await import('/tests/fixtures/schroederResidualMechanicsSourceNative.js');
        return runResidualMechanicsSourceNative({phase:true,kinds:['repeat-phase-fusion','repeat-phase-vapor',
          'repeat-phase-ledger-fault','repeat-phase-thermo-fault','repeat-phase-source-fault']});
      });
      console.log(JSON.stringify({phaseContinuation:true,cycle,...result}));assert.deepEqual(result.errors,[]);
      assert.equal(result.results.length,5);
      for(const {kind,words}of result.results){
        assert.equal(words[0],0,`${kind}: ${words}`);
        assert.equal(words[11],kind.endsWith('fault')?2:3,'clock advances only accepted steps');
        assert.equal(words[12],3,'three genuine complete intervals');
        assert.equal(words[13],30,'all ten fixed lineages conserve mass and U-S across all three steps');
      }
    }
  }finally{await browser.close();}
});

test('retained products preserve exact quantities through real phase lineages and transfer',{
  skip:process.env.ULG_RUN_NATIVE_RESIDUAL_PHASE!=='1',timeout:300000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__residual_phase_test__';
    page.on('requestfailed',request=>console.error('Residual phase request failed:',request.url(),request.failure()?.errorText));
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Residual phase lineages</title>'}));
    await page.goto(url);
    for(let cycle=0;cycle<2;cycle++){
      const result=await page.evaluate(async()=>{
        const {runResidualMechanicsSourceNative}=await import('/tests/fixtures/schroederResidualMechanicsSourceNative.js');
        return runResidualMechanicsSourceNative({phase:true,kinds:['phase-liquid','phase-four-lane','phase-fusion','phase-vapor','phase-empty']});
      });
      console.log(JSON.stringify({phase:true,cycle,...result}));assert.deepEqual(result.errors,[]);
      assert.equal(result.results.length,5);
      for(const {kind,count,words}of result.results){
        assert.equal(words[0],0,`${kind}: ${words}`);
        assert.equal(words[15],10,'every expanded lineage conserves exact mass and U-S');
        assert.equal(words[16],count,'every retained product reaches its expected phase occupancy');
      }
    }
  }finally{await browser.close();}
});

test('canonical residual physical rows participate in original multilevel spatial fields',{
  skip:process.env.ULG_RUN_NATIVE_RESIDUAL_SPATIAL!=='1',timeout:240000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__residual_spatial_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Residual spatial coverage</title>'}));
    await page.goto(url);
    for(let cycle=0;cycle<2;cycle++) {
      const result=await page.evaluate(async()=>{
        const {runResidualMechanicsSourceNative}=await import('/tests/fixtures/schroederResidualMechanicsSourceNative.js');
        return runResidualMechanicsSourceNative();
      });
      console.log(JSON.stringify({cycle,...result}));assert.deepEqual(result.errors,[]);assert.equal(result.results.length,13);
      for(const {kind,count,carrierCount,rejected,words}of result.results) {
        assert.equal(words[0],0,`${kind}: ${words}`);
        if(!rejected){assert.equal(words[1],count+carrierCount,kind);assert.equal(words[2],count,kind);}
        else assert.equal(words[7]&4194304,4194304,kind);
      }
    }
  }finally{await browser.close();}
});

test('retained products repeat canonical thermal exchange and recover after an energy fault',{
  skip:process.env.ULG_RUN_NATIVE_RESIDUAL_THERMAL_REPEAT!=='1',timeout:300000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__residual_thermal_repeat_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Residual thermal succession</title>'}));
    await page.goto(url);
    for(let cycle=0;cycle<2;cycle++){
      const result=await page.evaluate(async()=>{
        const {runResidualMechanicsSourceNative}=await import('/tests/fixtures/schroederResidualMechanicsSourceNative.js');
        return runResidualMechanicsSourceNative({motion:true,transport:true,thermal:true,
          kinds:['repeat-thermal','repeat-thermal-fault']});
      });
      console.log(JSON.stringify({thermalRepeat:true,cycle,...result}));assert.deepEqual(result.errors,[]);
      assert.equal(result.results.length,2);
      for(const {kind,count,carrierCount,words}of result.results){
        const fault=kind.endsWith('fault');
        assert.equal(words[0],0,`${kind}: ${words}`);assert.equal(words[22],3,kind);
        assert.equal(words[23],fault?2:3,kind);assert.equal(words[24],fault?1:0,kind);
        assert.equal(words[25],carrierCount,kind);assert.equal(words[26],count,kind);
        assert.equal(words[29],3,'every attempt passes independent exact conservation');
      }
    }
  }finally{await browser.close();}
});

test('canonical residual rows use native P2G, composite forces and G2P with exact mass',{
  skip:process.env.ULG_RUN_NATIVE_RESIDUAL_MOTION!=='1',timeout:300000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__residual_motion_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Residual native mechanics</title>'}));
    await page.goto(url);
    for(let cycle=0;cycle<2;cycle++) {
      const result=await page.evaluate(async()=>{
        const {runResidualMechanicsSourceNative}=await import('/tests/fixtures/schroederResidualMechanicsSourceNative.js');
        return runResidualMechanicsSourceNative({motion:true,kinds:['mixed','solid','liquid','gas','plasma',
          'empty','large','moved','closed-producers','pressure','cfl','bad-seal','bad-mass']});
      });
      console.log(JSON.stringify({motion:true,cycle,...result}));assert.deepEqual(result.errors,[]);assert.equal(result.results.length,13);
      for(const {kind,count,words}of result.results) {
        assert.equal(words[0],0,`${kind}: ${words}`);
        if(!['cfl','bad-seal','bad-mass'].includes(kind)){
          assert.equal(words[13],count,kind);
          if(kind==='pressure')assert.equal(words[14],count,'elastic stress must change every sheared residual affine state');
          else if(count)assert.equal(words[12],count,`${kind}: every residual must accelerate`);
        }
      }
    }
  }finally{await browser.close();}
});

test('canonical residual motion persists with exact U/S and original history rollback',{
  skip:process.env.ULG_RUN_NATIVE_RESIDUAL_TRANSPORT!=='1',timeout:300000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__residual_motion_test__';
    page.on('requestfailed',request=>console.error('Residual transport request failed:',request.url(),request.failure()?.errorText));
    page.on('pageerror',error=>console.error('Residual transport page error:',error.message));
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Residual native mechanics</title>'}));
    await page.goto(url);
    for(let cycle=0;cycle<2;cycle++) {
      const result=await page.evaluate(async()=>{
        const {runResidualMechanicsSourceNative}=await import('/tests/fixtures/schroederResidualMechanicsSourceNative.js');
        return runResidualMechanicsSourceNative({motion:true,transport:true,kinds:['mixed','solid','liquid','gas','plasma',
          'empty','large','moved','closed-producers','pressure','cfl','transport-quantum','bad-seal','positive-heat','negative-heat','heat-overflow']});
      });
      console.log(JSON.stringify({transport:true,cycle,...result}));assert.deepEqual(result.errors,[]);assert.equal(result.results.length,16);
      for(const {kind,count,words}of result.results) {
        assert.equal(words[0],0,`${kind}: ${words}`);
        assert.equal(words[21],count,kind);
        const rejected=['cfl','bad-seal','transport-quantum','heat-overflow'].includes(kind);
        assert.equal(words[20]!==0,rejected,kind);
        if(['positive-heat','negative-heat'].includes(kind))assert.equal(words[19],count,kind);
        if(!rejected && kind!=='pressure')assert.equal(words[18],count,kind);
        if(!['cfl','bad-seal','bad-mass'].includes(kind)){
          assert.equal(words[13],count,kind);
          if(kind==='pressure')assert.equal(words[14],count,'elastic stress must change every sheared residual affine state');
          else if(count)assert.equal(words[12],count,`${kind}: every residual must accelerate`);
        }
      }
    }
  }finally{await browser.close();}
});

test('carriers and populated history repeat native transport and recover after a rejected attempt',{
  skip:process.env.ULG_RUN_NATIVE_RESIDUAL_REPEAT!=='1',timeout:300000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__residual_repeat_test__';
    page.on('requestfailed',request=>console.error('Residual repeat request failed:',request.url(),request.failure()?.errorText));
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Repeated residual transport</title>'}));
    await page.goto(url);
    for(let cycle=0;cycle<2;cycle++){
      const result=await page.evaluate(async()=>{
        const {runResidualMechanicsSourceNative}=await import('/tests/fixtures/schroederResidualMechanicsSourceNative.js');
        return runResidualMechanicsSourceNative({motion:true,transport:true,kinds:['repeat','repeat-fault']});
      });
      console.log(JSON.stringify({repeat:true,cycle,...result}));assert.deepEqual(result.errors,[]);
      assert.equal(result.results.length,2);
      for(const {kind,count,carrierCount,words}of result.results){
        assert.equal(words[0],0,`${kind}: ${words}`);assert.equal(words[22],3,kind);
        assert.equal(words[23],kind==='repeat-fault'?2:3,kind);assert.equal(words[24],kind==='repeat-fault'?1:0,kind);
        assert.equal(words[25],carrierCount,kind);assert.equal(words[26],count,kind);
      }
    }
  }finally{await browser.close();}
});

test('canonical thermal exchange updates carriers and retained products with exact rollback',{
  skip:process.env.ULG_RUN_NATIVE_RESIDUAL_THERMAL!=='1',timeout:300000
},async()=>{
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--ignore-certificate-errors','--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try{
    const page=await browser.newPage(),url='https://127.0.0.1:5173/__residual_thermal_test__';
    page.on('requestfailed',request=>console.error('Residual thermal request failed:',request.url(),request.failure()?.errorText));
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Residual canonical thermal</title>'}));
    await page.goto(url);
    for(let cycle=0;cycle<2;cycle++){
      const result=await page.evaluate(async()=>{
        const {runResidualMechanicsSourceNative}=await import('/tests/fixtures/schroederResidualMechanicsSourceNative.js');
        const conduction=await runResidualMechanicsSourceNative({motion:true,transport:true,thermal:true,
          kinds:['thermal-pair','thermal-off','thermal-ledger-fault','thermal-thermo-fault','thermal-empty']});
        const radiation=await runResidualMechanicsSourceNative({motion:true,transport:true,thermal:true,radiation:true,
          kinds:['thermal-radiation']});
        return {results:[...conduction.results,...radiation.results],errors:[...conduction.errors,...radiation.errors]};
      });
      console.log(JSON.stringify({thermal:true,cycle,...result}));assert.deepEqual(result.errors,[]);
      assert.equal(result.results.length,6);
      for(const {kind,count,words}of result.results){
        assert.equal(words[0],0,`${kind}: ${words}`);assert.equal(words[21],count,kind);
        assert.equal(words[20]!==0,['thermal-ledger-fault','thermal-thermo-fault'].includes(kind),kind);
        assert.equal(words[29],1,'independent exact reduction conserves combined U-S');
        if(['thermal-pair','thermal-radiation'].includes(kind)){
          assert.equal(words[27],count,'every colder residual gains heat');
          assert.equal(words[28],2,'both warmer carriers lose heat');
        }
        if(kind==='thermal-pair')assert.equal(words[30],count,'all retained temperatures advance');
        if(kind==='thermal-off')assert.equal(words[19],0,'disabled pair exchange preserves exact energy');
        if(kind==='thermal-ledger-fault')assert.equal(words[20]&2048,2048,'independent conservation rejects one quantum');
      }
    }
  }finally{await browser.close();}
});
