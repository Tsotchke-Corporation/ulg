import assert from 'node:assert/strict';
import test from 'node:test';
import {createSphExactMassFormat} from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import {compileSphExactReactionAllocation,resolveSphExactReactionAllocation} from '../src/runtime/sph/sphExactReactionAllocation.js';
import {createExactReactionAllocationFixture} from './fixtures/sphExactReactionAllocationNative.js';
import {runSphExactPlacementQuantityStagedCandidateWebGpu as run} from '../src/runtime/sph/sphExactPlacementQuantityStagedGpu.js';
function setup({onCompile,submitError}={}){
 const format=createSphExactMassFormat(),fixture=createExactReactionAllocationFixture(),token=compileSphExactReactionAllocation({...fixture,format,reactionIndex:0});
 const events=[],allocated=[],compiled=[],groups=[];let validated=0,marked=0;
 const device={limits:{maxComputeWorkgroupsPerDimension:65535},
  createShaderModule(d){events.push(['module',d.label]);return{...d}},
  createBindGroupLayout(d){return{...d}},createPipelineLayout(d){return{...d}},
  async createComputePipelineAsync(d){const index=compiled.length;compiled.push(d);events.push(['compile',index]);await onCompile?.({index,fixture,events});return{stage:d.compute.entryPoint}},
  createBindGroup(d){groups.push(d);assert.equal(d.entries.length,9);return{...d}},
  createCommandEncoder(){events.push(['encoder']);return{
   clearBuffer(buffer){events.push(['clear',buffer.label])},
   beginComputePass(){return{setPipeline(p){events.push(['pipeline',p.stage])},setBindGroup(i,g){assert.equal(i,0);assert.equal(g.entries.length,9)},dispatchWorkgroups(count){events.push(['dispatch',count])},end(){events.push(['end'])}}},
   finish(){events.push(['finish']);return{command:true}}
  }},
  queue:{writeBuffer(buffer,offset,words){events.push(['write',buffer.label,offset,words.slice()])},submit(commands){events.push(['submit',commands]);if(submitError)throw submitError}}
 };
 const inputBuffer=label=>({label});
 const selected={format,recordWords:1000,outputBuffer:inputBuffer('packet'),extensiveOffsetWords:12,caloricOffsetWords:24,caloricProductOffsetWords:36,caloricProductCapacity:2,productEnergyOffsetWords:48,speciesOffsetWords:60,speciesLayout:{termOffsetWords:16,termStrideWords:8}};
 const sourceRecord={device,inventory:{rowOffset:1,buffer:inputBuffer('inventory')},particleCount:2};
 const derived=[];
 const parent={view:{result:selected,source:sourceRecord,compiled:[token],reactionTable:fixture.reactionTable,thermalMaterialTable:fixture.thermalMaterialTable},markDerivedBuffers(buffers){derived.push(...buffers);events.push(['derived',buffers[0].label])}};
 const physicalOutput={denseEventCount:4,layout:{carrierOffsetWords:32,carrierStrideWords:17},eventCompanionStrideWords:35,sourcePackedBuffer:inputBuffer('physical'),auxiliaryBuffer:inputBuffer('aux'),compactCompanionBuffer:inputBuffer('companions'),compactCountBuffer:inputBuffer('counts')};
 const allocate=(label,size,usage)=>{const b={label,size,usage,destroyed:0,destroy(){this.destroyed++}};allocated.push(b);events.push(['allocate',label]);return b};
 const validate=()=>{validated++;resolveSphExactReactionAllocation(token,fixture);events.push(['validate'])};
 const markSubmitted=()=>{marked++;events.push(['marked'])};
 return{args:{parent,physicalOutput,allocate,validate,markSubmitted},events,allocated,compiled,groups,derived,get validated(){return validated},get marked(){return marked}};
}
test('same original allocator/derived tracking, nine stages, one original submission and distinct cached stage identities',async()=>{
 const f=setup(),result=await run(f.args);
 assert.equal(f.allocated.length,3);assert.deepEqual(f.derived,[result.outputBuffer]);assert.equal(result.physicalPublicationAdmitted,false);assert.equal(result.schema,'peercompute.ulg.exact-placement-quantity-candidate.v1');
 assert.equal(f.compiled.length,9);assert.equal(new Set(f.compiled.map(d=>d.compute.entryPoint)).size,9);assert.equal(f.groups.length,9);
 assert.deepEqual(f.events.filter(e=>e[0]==='pipeline').map(e=>e[1]),['initialize_exact_placement_quantities',...Array.from({length:7},(_,i)=>`materialize_exact_placement_quantity_field_${i}`),'finalize_exact_placement_quantities']);
 assert.ok(f.events.filter(e=>e[0]==='dispatch').every(e=>e[1]===result.layout.rowCount));assert.equal(f.events.filter(e=>e[0]==='dispatch').length,9);
 assert.equal(f.events.filter(e=>e[0]==='clear').length,1);assert.ok(f.events.findIndex(e=>e[0]==='clear')<f.events.findIndex(e=>e[0]==='pipeline'));
 assert.equal(f.events.filter(e=>e[0]==='submit').length,1);assert.equal(f.events.filter(e=>e[0]==='write').length,2);assert.equal(f.marked,1);
 assert.ok(f.events.findIndex(e=>e[0]==='write')>f.events.findLastIndex(e=>e[0]==='compile'));
 const submit=f.events.findIndex(e=>e[0]==='submit');assert.equal(f.events[submit-1][0],'marked');assert.equal(f.events[submit-2][0],'validate');
 assert.ok(f.validated>=21);assert.ok(f.allocated.every(b=>b.destroyed===0));
 const again=await run(f.args);assert.equal(f.compiled.length,9);assert.notEqual(again.outputBuffer,result.outputBuffer);assert.equal(f.marked,2);
});
test('compile failure leaves all allocation ownership with original parent and submits no work',async()=>{
 const sentinel=new Error('stage4 compilation rejected'),f=setup({onCompile({index}){if(index===4)throw sentinel}});
 await assert.rejects(run(f.args),e=>e===sentinel);assert.equal(f.compiled.length,5);assert.equal(f.marked,0);assert.ok(!f.events.some(e=>['write','encoder','submit'].includes(e[0])));assert.ok(f.allocated.every(b=>b.destroyed===0));assert.equal(f.derived.length,1);
});
test('original authentic compiler/table mutation after an await rejects before any upload/dispatch',async()=>{
 const f=setup({onCompile({index,fixture}){if(index===3)fixture.reactionTable.productTermRecords[3]*=2}});
 await assert.rejects(run(f.args),/changed|Changed|original|Original/);assert.equal(f.compiled.length,4);assert.equal(f.marked,0);assert.ok(!f.events.some(e=>['write','encoder','submit'].includes(e[0])));assert.ok(f.allocated.every(b=>b.destroyed===0));
});
test('throwing queue submit is marked before attempting submission and does not free original-owner allocations',async()=>{
 const sentinel=new Error('submit rejected'),f=setup({submitError:sentinel});await assert.rejects(run(f.args),e=>e===sentinel);assert.equal(f.marked,1);assert.equal(f.events.filter(e=>e[0]==='submit').length,1);assert.ok(f.allocated.every(b=>b.destroyed===0));
});
