import './fixtures/exactPlacementCompositionRegister.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
const {withActualExactFamily} = await import('./fixtures/exactPlacementCompositionFamily.mjs');
const {createSchroederSpatialReactionProductPlacementAuthorityWebGpu: authorityFor,
 acquireSphReactionProductPlacementSegmentedArenaWebGpu: acquire,encodeSphReactionProductPlacementExactCompactionWebGpu: compact,
 discardSphReactionProductPlacementSegmentedArenaLease: discard,destroySphReactionProductPlacementSegmentedArenaWebGpu: destroyArena,
 sealSchroederSpatialReactionProductPlacementEncoding: seal,__capture: capture,__events: events,__commitEvents: commit,__history: history,
 __physical: physical,__physicalConsume: consume,__chemistry: chemistry,__chemistryConsume: consumeChem,
 __terminalPrepare: prepareTerminal,__terminal: terminal,__terminalStorageProgress: progress} = await import('../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js');
const {tagWebGpuBufferDevice: tag} = await import('../src/runtime/sph/sphGpuDeviceIdentity.js');
const {releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue: releaseFamily} = await import('../src/runtime/sph/schroederSpatialReactionPlacementEpochGpu.js');
async function fixture(callback,sourceOptions={}){return withActualExactFamily(async data=>{
 const device=data.args.device,authority=authorityFor(data.inputs),lease=acquire({device,authority,productTermCapacity:data.args.reactionTable.productTermCount});
 const eventBuffer=tag(device.createBuffer({label:'storage-test-events',size:authority.productEventCapacity*128,usage:128|8|4}),device);
 const summary=tag(device.createBuffer({label:'storage-test-summary',size:lease.arena.productTermCapacity*128,usage:128|8|4}),device);
 const encoder=device.createCommandEncoder(),args={device,authority,arenaLease:lease,encoder,productEventBuffer:eventBuffer,placementSummaryBuffer:summary};
 let retired=false;const releaseArena=()=>{if(retired)return;retired=true;discard(lease,{device,authority});destroyArena(lease.arena);};
 try{return await callback({...data,device,authority,lease,eventBuffer,summary,encoder,args,releaseArena});}
 finally{releaseArena();eventBuffer.destroy();summary.destroy();}
},sourceOptions);}
function prepare(args){compact(args);const plan=prepareTerminal(args);capture(args);const p=events(args);physical(args);commit(args);history(args);chemistry(args);consumeChem(args);consume(args);return{plan,eventPreparation:p};}
for(const wordCount of[1,9,66])test(`N${wordCount} original terminal copies both recovered planes after all nine dispatches`,async()=>fixture(async({args,device,authority,family,eventBuffer,encoder,releaseArena})=>{
 const{plan,eventPreparation}=prepare(args),before=device.submissions.length;
 const result=terminal({...args,plan});assert.equal(result.steps.length,9);assert.equal(result.encodedCopyCount,2);assert.equal(result.historyTransferAdmitted,false);
 assert.equal(result.massSelectionStage,plan.steps[5]);
 assert.equal(plan.steps[8].entries[5].resource.buffer,family.placedDestinationResidualPhysicalBuffer);
 assert.equal(plan.steps[8].entries[0].resource.buffer,plan.ranges.productTemplates.buffer);
 assert.equal(plan.steps[8].entries[1].resource.buffer,eventPreparation.privateHistoryCompanionBuffer);
 assert.equal(result.massSelectionStage.entries[0].resource.buffer,family.placedDestinationQuantityBuffer);
 assert.equal(result.massSelectionStage.entries[1].resource.buffer,family.placedDestinationMassBuffer);
 assert.equal(result.residualStorageLayout,family.placedDestinationResidualLayout);assert.equal(result.eventPreparation,eventPreparation);
 assert.deepEqual(progress(authority),{attempted:true,completed:true,dispatches:9,copies:2});
 const commands=encoder.finish().events,last=commands.slice(-3);
 assert.equal(last[0].kind,'dispatch');assert.equal(last[0].pipeline.compute.entryPoint,'materialize_terminal_residual_physical');
 assert.equal(last[1].kind,'copy');assert.equal(last[1].source,eventBuffer);assert.equal(last[1].destination,family.placedDestinationResidualEventBuffer);
 assert.equal(last[2].kind,'copy');assert.equal(last[2].source,eventPreparation.privateHistoryCompanionBuffer);assert.equal(last[2].destination,family.placedDestinationResidualCompanionBuffer);
 assert.equal(last[1].size,family.placedDestinationResidualLayout.eventByteLength);assert.equal(last[2].size,family.placedDestinationResidualLayout.companionByteLength);
 assert.equal(device.submissions.length,before);assert.throws(()=>terminal({...args,plan}),/unused original/);assert.throws(()=>seal(authority),/runtime-recorded segmented chain/);
 // Raw-copy command recorder only: deliberately arbitrary bit patterns are
 // not interpreted as successful WGSL physical/quantity values.
 const eventWords=new Uint32Array(eventBuffer.bytes.buffer),companionWords=new Uint32Array(eventPreparation.privateHistoryCompanionBuffer.bytes.buffer);
 for(let i=0;i<eventWords.length;i++)eventWords[i]=[1,0x80000000,0x7f7fffff,0x80000001][i%4];
 for(let i=0;i<companionWords.length;i++)companionWords[i]=(0x12345678+i*31)>>>0;
 const expectedEvents=eventBuffer.bytes.slice(),expectedCompanions=eventPreparation.privateHistoryCompanionBuffer.bytes.slice();
 // Execute the two original recorded copy commands only. The preceding
 // WGSL is not executed by this recorder, and its initial clears would erase
 // the deliberately injected post-recovery byte patterns.
 device.queue.submit([{events:commands.slice(-2)}]);assert.deepEqual(family.placedDestinationResidualEventBuffer.bytes,expectedEvents);assert.deepEqual(family.placedDestinationResidualCompanionBuffer.bytes,expectedCompanions);
 releaseArena();assert.equal(eventPreparation.privateHistoryCompanionBuffer.destroyed,true);
 assert.equal(family.placedDestinationResidualEventBuffer.destroyed,false);assert.equal(family.placedDestinationResidualCompanionBuffer.destroyed,false);
 assert.deepEqual(family.placedDestinationResidualCompanionBuffer.bytes,expectedCompanions);
 },wordCount===1?{wordCount,quantumExponent:-16,massesKg:[1/256,1/128]}:{wordCount}));
for(const which of[0,1])test(`interrupted durable copy ${which} leaves no complete original witness or replay`,async()=>fixture(async({args,encoder,authority})=>{
 const{plan}=prepare(args),copy=encoder.copyBufferToBuffer;let n=0;
 encoder.copyBufferToBuffer=(...values)=>{if(n++===which)throw Error('copy interrupted');return copy(...values);};
 assert.throws(()=>terminal({...args,plan}),/copy interrupted/);assert.deepEqual(progress(authority),{attempted:true,completed:false,dispatches:9,copies:which});
 assert.throws(()=>terminal({...args,plan}),/unused original/);assert.throws(()=>seal(authority),/runtime-recorded segmented chain/);
}));
test('interrupted terminal mass selection cannot complete or replay the original encoding',async()=>fixture(async({args,encoder,authority})=>{
 const{plan}=prepare(args),begin=encoder.beginComputePass;let current;
 encoder.beginComputePass=(...values)=>{const pass=begin(...values),set=pass.setPipeline,dispatch=pass.dispatchWorkgroups;
  pass.setPipeline=pipeline=>{current=pipeline.compute.entryPoint;return set.call(pass,pipeline);};
  pass.dispatchWorkgroups=(...groups)=>{if(current==='materialize_terminal_exact_placement_mass')throw Error('mass selection interrupted');return dispatch.call(pass,...groups);};return pass;};
 assert.throws(()=>terminal({...args,plan}),/mass selection interrupted/);
 assert.deepEqual(progress(authority),{attempted:true,completed:false,dispatches:5,copies:0});
 assert.throws(()=>terminal({...args,plan}),/unused original/);
 assert.throws(()=>seal(authority),/runtime-recorded segmented chain/);
}));
test('copied terminal plan cannot substitute a durable tuple',async()=>fixture(async({args,authority})=>{const{plan}=prepare(args);
 assert.throws(()=>terminal({...args,plan:{...plan}}),/unused original/);assert.deepEqual(progress(authority),{attempted:false,completed:false,dispatches:0,copies:0});}));
test('missing raw-copy encoder method rejects before terminal plan or commands',async()=>fixture(async({args,encoder,device})=>{compact(args);const before=device.dispatches.length;encoder.copyBufferToBuffer=undefined;
 assert.throws(()=>prepareTerminal(args),/raw copies/);assert.equal(device.dispatches.length,before);}));
test('original family retirement during first copy cannot complete a durable witness',async()=>fixture(async({args,encoder,authority,family})=>{const{plan}=prepare(args),copy=encoder.copyBufferToBuffer;let called=false;
 encoder.copyBufferToBuffer=(...values)=>{const result=copy(...values);if(!called){called=true;releaseFamily(family,{abandon:true});}return result;};
 assert.throws(()=>terminal({...args,plan}),/retir|live|quantity/i);
 assert.equal(called,true);assert.throws(()=>seal(authority),/retir|live|quantity|durable/i);
}));
