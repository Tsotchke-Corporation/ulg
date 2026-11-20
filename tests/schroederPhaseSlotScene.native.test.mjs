import assert from 'node:assert/strict';
import test from 'node:test';

test('native scene admits phase-slot refinement through real StateManager', {
  skip:process.env.ULG_RUN_NATIVE_PHASE_SLOT_SCENE !== '1', timeout:180000
}, async () => {
  const {chromium} = await import('@playwright/test');
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--use-angle=vulkan','--enable-features=Vulkan,UseSkiaRenderer','--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist','--enable-webgpu-developer-features']});
  try {
    const page = await browser.newPage({ignoreHTTPSErrors:true});
    const url='https://127.0.0.1:5173/__phase_slot_scene_test__';
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Scene phase gate</title>'}));
    await page.goto(url);
    for(const mode of process.env.ULG_PHASE_SLOT_SCENE_MODE ? process.env.ULG_PHASE_SLOT_SCENE_MODE.split(',') : ['direct','worker','integer-direct','integer-worker','parcel-direct','parcel-worker','parcel-pressure-direct','parcel-pressure-worker','parcel-pressure-off-direct','parcel-pressure-off-worker']) {
      const worker=mode.endsWith('worker'),parcels=mode.startsWith('parcel-'),integer=mode.startsWith('integer-')||parcels;
      const result=await page.evaluate(async(mode)=>{
        const fixture=await import('/tests/fixtures/schroederPhaseSlotSceneNative.js');
        return fixture.runPhaseSlotSceneNative(mode);
      },mode);
      console.log(JSON.stringify({mode,...result}));
      assert.equal(result.fatal,undefined,mode);
      assert.deepEqual(result.errors,[],mode);
      assert.equal(result.stages.length,integer ? 4 : 2);
      assert.deepEqual(result.stages.map(s=>s.nextStep),integer ? [2,4,6,8] : [2,4],'schedules continue resident state');
      assert.deepEqual(result.stages.map(s=>s.receipt.topologyEpoch),integer ? [9,11,13,15] : [9,11]);
      for(const [index,stage] of result.stages.entries()){
        assert.equal(stage.status,'resident-steps-executed');
        assert.equal(stage.publication,'resident-publication-current');
        assert.equal(stage.staleReason,undefined);
        assert.equal(stage.completedStepCount,2);
        assert.equal(stage.receipt.fatal,undefined);
        assert.deepEqual(stage.receipt.errors??[],[]);
        assert.equal(stage.receipt.sourceStage,'phase-slot-refinement');
        assert.equal(stage.receipt.words[0],0,'GPU mass, energy and finite-state invariants');
        assert.equal(stage.receipt.words[3],0,'every immutable identity word');
        const gasCount=integer ? [8,1,1,8][index] : 8;
        assert.equal(stage.receipt.words[1],gasCount,`physical gas carriers: ${stage.stage}`);
        assert.equal(stage.receipt.words[2],gasCount+1,'gas carriers plus the condensed neighbor');
        assert.equal(stage.receipt.words[7],1,'GPU receipt executed');
        if(integer){
          assert.equal(stage.receipt.integer,true,'current exact owner retained');
          assert.equal(stage.receipt.words[4],0,'all integer mass words');
          assert.equal(stage.receipt.words[5],0,'all accounted energy words and error control');
        }
        if(parcels){
          assert.equal(stage.receipt.parcelWords[0],0,'parcel and optics invariants');
          assert.equal(stage.receipt.parcelWords[1],1,'condensed water exists in the retained parcel');
          assert.equal(stage.receipt.parcelWords[2],1,'parcel optics produced positive extinction');
          assert.equal(stage.receipt.parcelWords[7],1,'GPU parcel receipt executed');
          assert.equal(stage.receipt.words[6],0,'current caloric temperature');
        }
        if(worker){
          assert.equal(stage.mode,'worker-owned-resident-lane');
          assert.equal(stage.committed,true,'actual StateManager commit');
          assert.equal(stage.warmEntryFound,true,'actual warm delta');
        }
      }
      if(mode.includes('-pressure-')){
        for(const stage of result.stages){
          assert.equal(stage.pressureEnabled,!mode.includes('-off-'));
          assert.equal(stage.receipt.pressureWords[0],0,'current gas constitutive and deformation invariants');
          assert.equal(stage.receipt.pressureWords[1],stage.receipt.words[1],'every gas carrier checked');
          assert.equal(stage.receipt.pressureWords[7],1,'pressure receipt executed');
        }
        // The initial uniform gas is at mechanical rest. Condensation then
        // changes density and creates an EOS response; the matched EOS-off
        // path must retain rest despite the same condensation/topology changes.
        const motion=result.stages.some(stage=>stage.receipt.pressureWords[4]>0);
        assert.equal(motion,!mode.includes('-off-'),'only enabled EOS produces gas motion');
      }
      if(integer){
        for(let i=1;i<result.stages.length;i++){
          assert.ok(result.stages[i].receipt.generation>result.stages[i-1].receipt.generation);
          assert.equal(result.stages[i].receipt.identityRevision,result.stages[0].receipt.identityRevision);
        }
      }
      if(parcels){
        const scalar=word=>new Float32Array(Uint32Array.of(word).buffer)[0];
        for(let i=1;i<result.stages.length;i++){
          const before=result.stages[i-1].receipt.parcelWords,after=result.stages[i].receipt.parcelWords;
          assert.ok(scalar(after[3])>scalar(before[3]),'condensation continues through topology changes');
          assert.ok(scalar(after[4])>scalar(before[4]),'optics follows the growing retained droplets');
        }
      }
      if(worker){
        assert.equal(new Set(result.stages.map(s=>s.laneId)).size,1,'retain the same admitted lane');
        assert.equal(new Set(result.stages.map(s=>s.taskId)).size,result.stages.length,'separately committed schedules');
      }
      assert.equal(result.admissions.length,4);
      for(const admission of result.admissions){
        assert.ok(admission.entries.length>0,admission.scope);
        for(const entry of admission.entries){
          assert.ok(entry.version>0,admission.scope);
          assert.match(entry.status,/-admission-admitted$/,admission.scope);
        }
      }
    }
  } finally {await browser.close();}
});
