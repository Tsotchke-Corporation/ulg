import './fixtures/exactPlacementCompositionRegister.mjs';
import test from'node:test';import assert from'node:assert/strict';
const {withActualExactFamily} = await import('./fixtures/exactPlacementCompositionTiledFamily.mjs');
const {createSchroederSpatialReactionProductPlacementAuthorityWebGpu: authorityFor,
 acquireSphReactionProductPlacementSegmentedArenaWebGpu: acquire,encodeSphReactionProductPlacementExactCompactionWebGpu: compact,
 discardSphReactionProductPlacementSegmentedArenaLease: discard,destroySphReactionProductPlacementSegmentedArenaWebGpu: destroyArena,
 encodeSphReactionProductPlacementSegmentedWebGpu: blocked,sealSchroederSpatialReactionProductPlacementEncoding: seal,
 __capture: capture,__events: eventsPrepare,__commitEvents: eventsCommit,__history: history,__physical: physical,
 __physicalConsume: physicalConsume,__chemistry: chemistry,__chemistryConsume: chemistryConsume,
 __terminalPrepare: terminalPrepare,__terminal: terminal,__validateTerminal: validateTerminal,__chemistryConfig: configFor} = await import('../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js');
const {tagWebGpuBufferDevice: tag} = await import('../src/runtime/sph/sphGpuDeviceIdentity.js');
async function fixture(callback){return withActualExactFamily(async data=>{
 const device=data.args.device,authority=authorityFor(data.inputs);assert.equal(device.limits.maxStorageBufferBindingSize,100000);assert(Object.isFrozen(device.limits));
 const config=configFor(authority,device),l=config.layout;assert.equal(l.pairCapacity,2);assert.equal(l.channelCount,238);
 assert.equal(l.channelTileCapacity,178);assert.equal(l.tileCount,2);assert.equal(l.outputWordLength*4,66704);assert.equal(l.scratchWordLength*4,99680);
 assert.equal(238*l.pairCapacity*l.recordWords*4,133280);assert.deepEqual(config.dispatch.tiles.map(t=>[t.base,t.count,t.ordinal]),[[0,178,0],[178,60,1]]);
 const lease=acquire({device,authority,productTermCapacity:data.args.reactionTable.productTermCount});
 const events=tag(device.createBuffer({label:'composed-tiles-events',size:authority.productEventCapacity*128,usage:128|8|4}),device),summary=tag(device.createBuffer({label:'composed-tiles-summary',size:lease.arena.productTermCapacity*128,usage:128|8|4}),device);
 const encoder=device.createCommandEncoder(),args={device,authority,arenaLease:lease,encoder,productEventBuffer:events,placementSummaryBuffer:summary};
 try{return await callback({...data,device,authority,config,lease,events,summary,encoder,args});}
 finally{discard(lease,{device,authority});destroyArena(lease.arena);events.destroy();summary.destroy();}
 },{wordCount:1,quantumExponent:-16,massesKg:[1/256,1/128]});}
function prefix(args){compact(args);const plan=terminalPrepare(args),capturePreparation=capture(args),eventPreparation=eventsPrepare(args),physicalPreparation=physical(args);eventsCommit(args);history(args);return{plan,capturePreparation,eventPreparation,physicalPreparation};}
function genuine(plan,result,p,pc){return{exactTerminalEncoding:result,exactPhysicalPreparation:p,exactPhysicalConsumption:pc,
 encoder:plan.encoder,arenaLease:plan.arenaLease,transactionRollbackStateBuffer:plan.ranges.rollbackState.buffer,
 transactionRollbackThermoBuffer:plan.ranges.rollbackThermo.buffer,transactionRollbackMechanicsBuffer:plan.ranges.rollbackMechanics.buffer,
 productEventBuffer:plan.ranges.events.buffer,candidateProductEventBuffer:plan.ranges.candidateEvents.buffer,
 placementSummaryBuffer:plan.ranges.summary.buffer,candidatePlacementSummaryBuffer:plan.ranges.candidateSummary.buffer,completionReceiptBuffer:plan.ranges.receipt.buffer};}
test('genuine composed owner uses all channels across two device-derived ragged tiles and retains original terminal witnesses',async()=>fixture(async({args,device,authority,config,lease})=>{
 const beforeSubmit=device.submissions.length,{plan,capturePreparation,eventPreparation,physicalPreparation}=prefix(args),prep=chemistry(args);
 const l=prep.layout;assert.equal(prep.explicitDispatchCount,23);assert.equal(l.levels,1);
 assert.equal(prep.steps.length,config.dispatch.uniformRecordCount);
 const entries=prep.steps.map(s=>s.descriptor.entryPoint);
 assert.deepEqual(entries.slice(0,2),['reset_exact_chemistry_evidence','validate_exact_chemistry_pairs']);
 assert.equal(entries.at(-1),'finish_exact_chemistry_evidence');
 const uniforms=prep.steps.map(s=>s.entries[8].resource),offsets=new Set(uniforms.map(r=>r.offset));
 assert.equal(offsets.size,prep.steps.length);
 assert.equal(new Set(uniforms.map(r=>r.buffer)).size,1);assert.equal(device.writes.filter(w=>w.buffer===uniforms[0].buffer).length,1);
 const paramWords=uniforms.map(r=>{assert.equal(r.size,32);assert.equal(r.offset%256,0);assert.equal(r.buffer,lease.arena.buffers.exactChemistryParams);return[...new Uint32Array(r.buffer.bytes.buffer,r.offset,8)];});
 for(const index of[0,1,prep.steps.length-1])assert.deepEqual(paramWords[index],Array(8).fill(0));
 // Independently enumerate GPU lanes: both ragged tiles must cover every row
 // exactly once, while padding lanes are excluded before they touch a row.
 let cursor=2;
 for(const tile of config.dispatch.tiles){
  const init=prep.steps[cursor++];assert.equal(init.descriptor.entryPoint,'initialize_exact_chemistry_residuals');
  let input=init.entries[6].resource.buffer;
  for(const [entryPoint,rowCount,first]of[
    ['normalize_exact_chemistry_residuals',tile.count*2,[0,0,0,0]],
    ['reduce_exact_chemistry_residuals',tile.count,[2,1,1,1]],
    ['compare_exact_chemistry_budgets',tile.count,[0,0,0,0]]]){
   const visits=new Uint8Array(rowCount);let output;
   while(prep.steps[cursor]?.descriptor.entryPoint===entryPoint){
    const stage=prep.steps[cursor],words=paramWords[cursor++];
    assert.deepEqual(words.slice(0,4),first);assert.deepEqual(words.slice(4,7),[tile.base,tile.count,tile.ordinal]);
    assert.equal(stage.entries[5].resource.buffer,input);output??=stage.entries[6].resource.buffer;
    assert.equal(stage.entries[6].resource.buffer,output);assert.equal(stage.descriptor.workgroupSize,32);
    const {x,y,z}=stage.dispatch;assert.equal(z,1);assert.ok(x*y<=2);
    for(let gy=0;gy<y;gy++)for(let gx=0;gx<x;gx++)for(let lane=0;lane<32;lane++){
     const row=words[7]+gx*32+lane+gy*x*32;
     if(row<rowCount)visits[row]++;
    }
   }
   assert.ok(visits.every(count=>count===1),`${entryPoint} tile${tile.ordinal} exact coverage`);
   if(entryPoint!=='compare_exact_chemistry_budgets')input=output;
  }
  assert.equal(prep.steps[cursor++].descriptor.entryPoint,'commit_exact_chemistry_channel_tile');
 }
 assert.equal(cursor,prep.steps.length-1);
 const control=prep.controlBuffer;assert.equal(control,lease.arena.buffers.exactChemistryControl);assert.notEqual(control,eventPreparation.controlBuffer);
 assert.equal(eventPreparation.controlBuffer,lease.arena.buffers.exactEventControl);
 for(const stage of prep.steps){assert.equal(stage.entries[4].resource.buffer,control);assert.equal(stage.entries[7].resource.buffer,prep.evidenceBuffer);assert.notEqual(stage.entries[5].resource.buffer,stage.entries[6].resource.buffer);}
 const sourceCode=prep.steps[0].descriptor.code;assert.match(sourceCode,/atomicStore\(&xcb_control\[10u\],end\)/);assert.match(sourceCode,/atomicStore\(&xcb_control\[11u\],xcb_params.tile_ordinal\+1u\)/);assert.doesNotMatch(sourceCode,/atomic(?:Store|Add)\(&xcb_control\[9u\]/);
 const consumed=chemistryConsume(args);assert.equal(consumed.preparation,prep);assert.equal(consumed.step.entries[2].resource.buffer,control);
 assert.equal(consumed.step.entries[0].resource.buffer,prep.evidenceBuffer);assert.equal(consumed.step.entries[3].resource.buffer,authority.completionReceiptBuffer);
 assert.match(consumed.step.descriptor.code,/atomicAdd\(&chemistry_control\[9u\],1u\)/);assert.match(consumed.step.descriptor.code,/chemistry_control\[10u\]\)!=238u/);assert.match(consumed.step.descriptor.code,/chemistry_control\[11u\]\)!=2u/);
 const pc=physicalConsume(args),result=terminal({...args,plan});assert.equal(result.steps.length,9);assert.equal(result.chemistryPreparation,prep);assert.equal(result.physicalPreparation,physicalPreparation);
 assert.equal(result.massSelectionStage,plan.steps[5]);assert.equal(result.massSelectionStage.descriptor.entryPoint,'materialize_terminal_exact_placement_mass');
 assert.equal(result.physicalEvidenceConsumption,pc);assert.equal(result.eventPreparation,eventPreparation);assert.equal(result.eventPreparation.capturePreparation,capturePreparation);
 assert.equal(validateTerminal(authority,genuine(plan,result,physicalPreparation,pc)),result);
 assert.throws(()=>seal(authority),/runtime-recorded segmented chain/);assert.throws(()=>blocked(args),/placed destination state/);assert.equal(device.submissions.length,beforeSubmit);
 const all=device.createdBuffers.filter(b=>b.usage&128);assert.ok(all.every(b=>b.size<=100000));assert.equal(lease.arena.buffers.exactChemistryA.size,99680);assert.equal(lease.arena.buffers.exactChemistryEvidence.size,66704);
}));
test('completed multiple tiles cannot substitute omitted original chemistry consumption',async()=>fixture(async({args,device})=>{
 const{plan}=prefix(args);const p=chemistry(args);assert.equal(p.layout.tileCount,2);physicalConsume(args);const n=device.dispatches.length;
 assert.throws(()=>terminal({...args,plan}),/chemistry preparation and consumption/);assert.equal(device.dispatches.length,n);
 chemistryConsume(args);assert.equal(terminal({...args,plan}).chemistryPreparation,p);
}));
test('ragged tile recording interruption cannot consume chemistry or reach original terminal',async()=>fixture(async({args,device,encoder})=>{
 const{plan}=prefix(args);physicalConsume(args);const old=encoder.beginComputePass;
 encoder.beginComputePass=function(...a){const p=old.apply(this,a),dispatch=p.dispatchWorkgroups;p.dispatchWorkgroups=function(...v){
  const resource=this.bindGroup?.bindGroup.entries[8]?.resource;
  if(this.pipeline.compute.entryPoint==='commit_exact_chemistry_channel_tile'&&new Uint32Array(resource.buffer.bytes.buffer,resource.offset,8)[6]===1)throw Error('ragged tile interrupted');
  return dispatch.apply(this,v);};return p;};
 assert.throws(()=>chemistry(args),/ragged tile interrupted/);const n=device.dispatches.length;assert.throws(()=>chemistryConsume(args),/unused original/);assert.throws(()=>terminal({...args,plan}),/chemistry preparation and consumption/);assert.equal(device.dispatches.length,n);
}));
test('copied/omitted completed multi-tile terminal witness remains rejected',async()=>fixture(async({args,authority})=>{
 const{plan,physicalPreparation}=prefix(args);chemistry(args);chemistryConsume(args);const pc=physicalConsume(args),result=terminal({...args,plan}),original=genuine(plan,result,physicalPreparation,pc);
 assert.equal(validateTerminal(authority,original),result);
 for(const changed of[{...original,exactTerminalEncoding:{...result}},{...original,exactPhysicalPreparation:{...physicalPreparation}},{...original,exactPhysicalConsumption:null}])assert.throws(()=>validateTerminal(authority,changed),/witness|terminal stage/);
 assert.throws(()=>terminal({...args,plan}),/unused original/);assert.throws(()=>seal(authority),/runtime-recorded segmented chain/);
}));
test('interrupted arithmetic batch cannot consume partial evidence or reach the terminal',async()=>fixture(async({args,device,encoder})=>{
 const {plan}=prefix(args);physicalConsume(args);const begin=encoder.beginComputePass;
 encoder.beginComputePass=function(...options){const pass=begin.apply(this,options),dispatch=pass.dispatchWorkgroups;
  pass.dispatchWorkgroups=function(...grid){const resource=this.bindGroup?.bindGroup.entries[8]?.resource;
   if(this.pipeline.compute.entryPoint==='normalize_exact_chemistry_residuals'
      &&new Uint32Array(resource.buffer.bytes.buffer,resource.offset,8)[7]===64)throw Error('arithmetic batch interrupted');
   return dispatch.apply(this,grid);};return pass;};
 assert.throws(()=>chemistry(args),/arithmetic batch interrupted/);const count=device.dispatches.length;
 assert.throws(()=>chemistryConsume(args),/unused original/);
 assert.throws(()=>terminal({...args,plan}),/chemistry preparation and consumption/);
 assert.equal(device.dispatches.length,count);
}));
