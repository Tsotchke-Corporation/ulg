import './fixtures/exactPlacementCompositionRegister.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
const {withActualExactFamily} = await import('./fixtures/exactPlacementCompositionFamily.mjs');
const {createSchroederSpatialReactionProductPlacementAuthorityWebGpu: authorityFor,
 acquireSphReactionProductPlacementSegmentedArenaWebGpu: acquire,encodeSphReactionProductPlacementExactCompactionWebGpu: compact,
 discardSphReactionProductPlacementSegmentedArenaLease: discard,destroySphReactionProductPlacementSegmentedArenaWebGpu: destroyArena,
 encodeSphReactionProductPlacementSegmentedWebGpu: blocked,sealSchroederSpatialReactionProductPlacementEncoding: seal,
 __capture: capture,__events: prepare,__commitEvents: commit,__history: history,__physical: physical,
 __physicalConsume: consume,__chemistry: chemistry,__chemistryConsume: consumeChem,
 __terminalPrepare: prepareTerminal,__terminal: terminal,__eventProgress: progress} = await import('../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js');
const {tagWebGpuBufferDevice: tag} = await import('../src/runtime/sph/sphGpuDeviceIdentity.js');
const {releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue: releaseFamily} = await import('../src/runtime/sph/schroederSpatialReactionPlacementEpochGpu.js');
async function fixture(callback,{sourceOptions={},beforeAcquire=null}={}){return withActualExactFamily(async data=>{
 const device=data.args.device,authority=authorityFor(data.inputs);beforeAcquire?.({...data,device,authority});
 const lease=acquire({device,authority,productTermCapacity:data.args.reactionTable.productTermCount});
 const events=tag(device.createBuffer({label:'event-test-events',size:authority.productEventCapacity*128,usage:128|8|4}),device);
 const summary=tag(device.createBuffer({label:'event-test-summary',size:lease.arena.productTermCapacity*128,usage:128|8|4}),device);
 const encoder=device.createCommandEncoder(),args={device,authority,arenaLease:lease,encoder,productEventBuffer:events,placementSummaryBuffer:summary};
 try{return await callback({...data,device,authority,lease,events,summary,encoder,args});}
 finally{discard(lease,{device,authority});destroyArena(lease.arena);events.destroy();summary.destroy();}
},sourceOptions);}
for(const wordCount of[1,9,66])test(`N${wordCount}: genuine original family records original event preparation, commits, aligned history and terminal`,async()=>{
 await fixture(async({args,device,authority,lease,family})=>{
 const initial=device.submissions.length;compact(args);const plan=prepareTerminal(args),c=capture(args);const start=device.dispatches.length,p=prepare(args);
 assert.deepEqual(device.dispatches.slice(start).map(d=>d.pipeline.compute.entryPoint),['initialize_exact_event_disposition','index_original_exact_event_sort','prepare_exact_event_dispositions','apply_unique_events_and_emit_summaries']);
 assert.equal(p.capturePreparation,c);assert.equal(p.sourcePhysicalOutput.layout.eventParticleStrideWords,64);assert.equal(p.historyTransferAdmitted,false);
 const prep=device.dispatches.findLast(d=>d.pipeline.compute.entryPoint==='prepare_exact_event_dispositions');
 assert.equal(prep.bindGroup.entries.find(e=>e.binding===4).resource.buffer,p.sourcePhysicalOutput.auxiliaryBuffer);
 assert.equal(prep.bindGroup.entries.find(e=>e.binding===3).resource.buffer,lease.arena.buffers.exactCompactCompanion);
 assert.throws(()=>commit(args),/actual physical/);assert.throws(()=>history(args),/committed event/);
 physical(args);const committed=commit(args);assert.equal(committed.explicitDispatchCount,3);assert.throws(()=>commit(args),/actual physical/);
 const h=history(args);assert.equal(h.residualCountBuffer,family.placedDestinationResidualCountBuffer);assert.equal(h.privateHistoryCompanionBuffer,lease.arena.buffers.exactEventHistoryCompanions);
 assert.equal(h.historyTransferAdmitted,false);assert.throws(()=>history(args),/committed event/);
 const scans=device.dispatches.filter(d=>d.pipeline.compute.entryPoint==='scan_exact_residual_history_prefix');
 assert.equal(scans.length,p.layout.levels);assert.equal(new Set(scans.map(d=>d.bindGroup.entries.find(e=>e.binding===4).resource.offset)).size,scans.length);
 for(const d of scans){const u=d.bindGroup.entries.find(e=>e.binding===4).resource;assert.equal(u.buffer,lease.arena.buffers.exactEventScanParams);assert.equal(u.size,16);assert.equal(u.offset%256,0);}
 chemistry(args);consumeChem(args);consume(args);const result=terminal({...args,plan});assert.equal(result.steps.length,9);assert.equal(result.steps.at(-1).descriptor.entryPoint,'materialize_terminal_residual_physical');
 assert.equal(result.massSelectionStage,plan.steps[5]);assert.equal(result.massSelectionStage.descriptor.entryPoint,'materialize_terminal_exact_placement_mass');
 assert.equal(result.eventPreparation,p);assert.deepEqual(progress(authority),{prepared:true,committed:true,historyFinalized:true});
 assert.throws(()=>seal(authority),/runtime-recorded segmented chain/);assert.throws(()=>blocked(args),/placed destination state/);
 assert.equal(device.submissions.length,initial);assert.equal(device.writes.filter(w=>w.buffer===lease.arena.buffers.exactEventScanParams).length,1);
 const written=device.dispatches.filter(d=>d.pipeline.compute.entryPoint.includes('exact_')).flatMap(d=>d.bindGroup?.entries??[]);
 assert.ok(written.some(x=>x.resource.buffer===family.placedDestinationQuantityBuffer));
 },{sourceOptions:wordCount===1?{wordCount,quantumExponent:-16,massesKg:[1/256,1/128]}:{wordCount}});
});
test('copied authority and wrong encoder fail before event commands',async()=>fixture(async({args,device,authority})=>{compact(args);capture(args);const n=device.dispatches.length;
 assert.throws(()=>prepare({...args,authority:{...authority}}),/runtime-issued/);assert.throws(()=>prepare({...args,encoder:device.createCommandEncoder()}),/unused original/);assert.equal(device.dispatches.length,n);}));
test('retired original family during pipeline creation rejects before event commands',async()=>fixture(async({args,device,family})=>{compact(args);capture(args);const old=device.createComputePipeline;
 device.createComputePipeline=function(d){const r=old.call(this,d);if(d.compute.entryPoint==='prepare_exact_event_dispositions')releaseFamily(family,{abandon:true});return r;};
 const n=device.dispatches.length;assert.throws(()=>prepare(args),/retired|retiring|live/i);assert.equal(device.dispatches.length,n);}));
test('genuine undersized event scratch allocation rejects before event commands',async()=>fixture(async({args,device})=>{compact(args);capture(args);const n=device.dispatches.length;
 assert.throws(()=>prepare(args),/bound range/);assert.equal(device.dispatches.length,n);},{beforeAcquire:({device})=>{const old=device.createBuffer;device.createBuffer=function(d){return old.call(this,d.label.endsWith('-exactEventControl')?{...d,size:d.size-4}:d);};}}));
test('interrupted prefix cannot replay or commit',async()=>fixture(async({args,device,encoder,authority})=>{compact(args);capture(args);const old=encoder.beginComputePass;
 encoder.beginComputePass=function(...a){const p=old.apply(this,a),dispatch=p.dispatchWorkgroups;p.dispatchWorkgroups=function(...v){if(this.pipeline.compute.entryPoint==='prepare_exact_event_dispositions')throw Error('event interruption');return dispatch.apply(this,v);};return p;};
 assert.throws(()=>prepare(args),/event interruption/);assert.equal(progress(authority).prepared,false);assert.throws(()=>prepare(args),/unused original/);assert.throws(()=>commit(args),/actual physical/);}));
test('missing event history prevents terminal commands despite genuine physical and chemical evidence',async()=>fixture(async({args,device})=>{compact(args);const plan=prepareTerminal(args);capture(args);prepare(args);physical(args);commit(args);chemistry(args);consumeChem(args);consume(args);
 const n=device.dispatches.length;assert.throws(()=>terminal({...args,plan}),/complete original event/);assert.equal(device.dispatches.length,n);}));
test('spare commit interruption poisons original event witness without completing history',async()=>fixture(async({args,encoder,authority})=>{compact(args);capture(args);prepare(args);physical(args);const old=encoder.beginComputePass;
 encoder.beginComputePass=function(...a){const p=old.apply(this,a),dispatch=p.dispatchWorkgroups;p.dispatchWorkgroups=function(...v){if(this.pipeline.compute.entryPoint==='commit_exact_event_spare_particles')throw Error('commit interruption');return dispatch.apply(this,v);};return p;};
 assert.throws(()=>commit(args),/commit interruption/);assert.equal(progress(authority).committed,false);assert.throws(()=>commit(args),/actual physical/);assert.throws(()=>history(args),/committed event/);}));
test('history interruption stays one-shot and cannot reach terminal',async()=>fixture(async({args,encoder,authority})=>{compact(args);capture(args);prepare(args);physical(args);commit(args);const old=encoder.beginComputePass;
 encoder.beginComputePass=function(...a){const p=old.apply(this,a),dispatch=p.dispatchWorkgroups;p.dispatchWorkgroups=function(...v){if(this.pipeline.compute.entryPoint==='scatter_exact_residual_history')throw Error('history interruption');return dispatch.apply(this,v);};return p;};
 assert.throws(()=>history(args),/history interruption/);assert.equal(progress(authority).historyFinalized,false);assert.throws(()=>history(args),/committed event/);}));
