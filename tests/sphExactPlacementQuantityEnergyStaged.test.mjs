import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { compileSphExactReactionAllocation, resolveSphExactReactionAllocation } from '../src/runtime/sph/sphExactReactionAllocation.js';
import { createExactReactionAllocationFixture } from './fixtures/sphExactReactionAllocationNative.js';
import { runSphExactPlacementQuantityEnergyStagedCandidateWebGpu as run } from '../src/runtime/sph/sphExactPlacementQuantityEnergyStagedGpu.js';

// Host scheduling and ownership checks; numerical WGSL execution is separate.
function setup({onCompile,submitError,limits={}}={}){
 const format=createSphExactMassFormat(),fixture=createExactReactionAllocationFixture(),token=compileSphExactReactionAllocation({...fixture,format,reactionIndex:0});
 const events=[],allocated=[],compiled=[],groups=[];let validated=0,marked=0;
 const device={limits:{maxComputeWorkgroupsPerDimension:65535,minUniformBufferOffsetAlignment:256,maxStorageBuffersPerShaderStage:12,maxUniformBuffersPerShaderStage:12,maxBindingsPerBindGroup:1000,maxUniformBufferBindingSize:65536,maxStorageBufferBindingSize:1<<28,maxBufferSize:1<<29,...limits},
  createShaderModule(d){events.push(['module',d.label]);return{...d}},
  createBindGroupLayout(d){return{...d}},createPipelineLayout(d){return{...d}},
  async createComputePipelineAsync(d){const index=compiled.length;compiled.push(d);events.push(['compile',index]);await onCompile?.({index,fixture,events});return{stage:d.compute.entryPoint}},
  createBindGroup(d){groups.push(d);assert.ok([9,11].includes(d.entries.length));return{...d}},
  createCommandEncoder(){events.push(['encoder']);return{
   clearBuffer(buffer){events.push(['clear',buffer.label])},
   beginComputePass(){return{setPipeline(p){events.push(['pipeline',p.stage])},setBindGroup(i,g){assert.equal(i,0);assert.ok([9,11].includes(g.entries.length))},dispatchWorkgroups(count){events.push(['dispatch',count])},end(){events.push(['end'])}}},
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
test('same original owner,34 fixed dispatches,16 actual pipelines and one submission',async()=>{
 const f=setup(),result=await run(f.args);
 assert.equal(f.allocated.length,5);assert.deepEqual(f.derived,[result.outputBuffer,f.allocated.find(b=>b.label==='ulg-exact-placement-energy-scratch')]);assert.equal(result.physicalPublicationAdmitted,false);assert.equal(result.schema,'peercompute.ulg.exact-placement-quantity-candidate.v1');
 assert.equal(f.compiled.length,16);assert.equal(new Set(f.compiled.map(d=>d.compute.entryPoint)).size,16);assert.equal(f.groups.length,34);
 const sequence=f.events.filter(e=>e[0]==='pipeline').map(e=>e[1]);
 assert.deepEqual(sequence.slice(0,4),['initialize_exact_placement_quantities',...Array.from({length:3},(_,i)=>`materialize_exact_placement_quantity_field_${i}`)]);
 assert.deepEqual(sequence.slice(-4),['materialize_exact_placement_quantity_field_4','materialize_exact_placement_quantity_field_5','materialize_exact_placement_quantity_field_6','finalize_exact_placement_quantities']);
 assert.equal(sequence[4],'materialize_exact_placement_energy_begin');assert.equal(sequence[29],'materialize_exact_placement_energy_finish');
 const energyGroups=f.groups.filter(g=>g.entries.length===11);assert.equal(energyGroups.length,26);
 for(let step=0;step<26;step++){assert.equal(energyGroups[step].entries[10].resource.offset,step*256);assert.equal(energyGroups[step].entries[10].resource.size,16);assert.equal(energyGroups[step].entries[9].resource.buffer.label,'ulg-exact-placement-energy-scratch');}
 const uniform=f.events.find(e=>e[0]==='write'&&e[1]==='ulg-exact-placement-energy-steps')[3];
 assert.equal(uniform.length,26*64);for(let step=0;step<26;step++){assert.equal(uniform[step*64],step);assert.ok(uniform.slice(step*64+1,(step+1)*64).every(x=>x===0));}
 assert.ok(f.events.filter(e=>e[0]==='dispatch').every(e=>e[1]===result.layout.rowCount));assert.equal(f.events.filter(e=>e[0]==='dispatch').length,34);
 assert.equal(f.events.filter(e=>e[0]==='clear').length,2);assert.ok(f.events.findIndex(e=>e[0]==='clear')<f.events.findIndex(e=>e[0]==='pipeline'));
 assert.equal(f.events.filter(e=>e[0]==='submit').length,1);assert.equal(f.events.filter(e=>e[0]==='write').length,3);assert.equal(f.marked,1);
 assert.ok(f.events.findIndex(e=>e[0]==='write')>f.events.findLastIndex(e=>e[0]==='compile'));
 const submit=f.events.findIndex(e=>e[0]==='submit');assert.equal(f.events[submit-1][0],'marked');assert.equal(f.events[submit-2][0],'validate');
 assert.ok(f.validated>=71);assert.ok(f.allocated.every(b=>b.destroyed===0));
 const again=await run(f.args);assert.equal(f.compiled.length,16);assert.notEqual(again.outputBuffer,result.outputBuffer);assert.equal(f.marked,2);
});
test('compile failure leaves all allocation ownership with original parent and submits no work',async()=>{
 const sentinel=new Error('stage4 compilation rejected'),f=setup({onCompile({index}){if(index===4)throw sentinel}});
 await assert.rejects(run(f.args),e=>e===sentinel);assert.equal(f.compiled.length,5);assert.equal(f.marked,0);assert.ok(!f.events.some(e=>['write','encoder','submit'].includes(e[0])));assert.ok(f.allocated.every(b=>b.destroyed===0));assert.equal(f.derived.length,2);
});
test('original authentic compiler/table mutation after an await rejects before any upload/dispatch',async()=>{
 const f=setup({onCompile({index,fixture}){if(index===3)fixture.reactionTable.productTermRecords[3]*=2}});
 await assert.rejects(run(f.args),/changed|Changed|original|Original/);assert.equal(f.compiled.length,4);assert.equal(f.marked,0);assert.ok(!f.events.some(e=>['write','encoder','submit'].includes(e[0])));assert.ok(f.allocated.every(b=>b.destroyed===0));
});
test('throwing queue submit is marked before attempting submission and does not free original-owner allocations',async()=>{
 const sentinel=new Error('submit rejected'),f=setup({submitError:sentinel});await assert.rejects(run(f.args),e=>e===sentinel);assert.equal(f.marked,1);assert.equal(f.events.filter(e=>e[0]==='submit').length,1);assert.ok(f.allocated.every(b=>b.destroyed===0));
});

test('scratch capacity and binding limits reject before allocations or compilation',async()=>{
 for(const limits of [{maxStorageBuffersPerShaderStage:8},{maxUniformBuffersPerShaderStage:1},{maxStorageBufferBindingSize:64},
 {maxBufferSize:64},{maxBindingsPerBindGroup:10},{minUniformBufferOffsetAlignment:0},{minUniformBufferOffsetAlignment:65536},{maxStorageBuffersPerShaderStage:undefined}]){
  const f=setup({limits});await assert.rejects(run(f.args),RangeError);assert.equal(f.allocated.length,0);assert.equal(f.compiled.length,0);assert.equal(f.marked,0);
 }
});
test('an energy arithmetic pipeline compilation failure submits no stage',async()=>{
 const sentinel=new Error('energy multiply compile rejected'),f=setup({onCompile({index}){if(index===9)throw sentinel}});
 await assert.rejects(run(f.args),e=>e===sentinel);assert.equal(f.marked,0);assert.equal(f.compiled.length,10);
 assert.ok(!f.events.some(e=>['write','encoder','submit'].includes(e[0])));assert.ok(f.allocated.every(b=>b.destroyed===0));
});
