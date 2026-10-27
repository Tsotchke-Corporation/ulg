import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { compileSphExactReactionAllocation, resolveSphExactReactionAllocation } from '../src/runtime/sph/sphExactReactionAllocation.js';
import { createExactReactionAllocationFixture } from './fixtures/sphExactReactionAllocationNative.js';
import { runSphExactPlacementQuantityPrimitivesCandidateWebGpu as run } from '../src/runtime/sph/sphExactPlacementQuantityPrimitivesGpu.js';
import { SPH_EXACT_PLACEMENT_PRIMITIVE_STAGES as stages, sphExactPlacementQuantityPrimitivesScratchLayout,
  sphExactPlacementQuantityPrimitivesStageParams, sphExactPlacementQuantityPrimitivesPipelineDescriptors }
  from '../src/runtime/sph/sphExactPlacementQuantityPrimitivesWgsl.js';
import { sphExactPlacementQuantityLayout } from '../src/runtime/sph/sphExactPlacementQuantityWgsl.js';
import { sphExactPlacementQuantityStagedPipelineDescriptors } from '../src/runtime/sph/sphExactPlacementQuantityStagedWgsl.js';

// Independent schedule expectation. These command-recorder tests make no WGSL
// arithmetic claim; the original native corpus remains the numerical oracle.
const momentum = 'begin normalize normalize scale divide from_f32 multiply normalize multiply multiply finish';
const energy = 'begin normalize normalize scale divide from_f32 from_f32 multiply scale add from_f32 multiply scale add from_f32 multiply scale add multiply normalize normalize add multiply add multiply finish';
const expectedFields = [momentum, momentum, momentum, energy,
  'begin normalize normalize scale divide from_f32 divide multiply finish',
  'begin normalize normalize scale divide from_f32 from_f32 multiply divide multiply finish',
  'begin normalize normalize scale divide from_f32 multiply finish'].map(value => value.split(' '));
const expectedStages = expectedFields.flatMap((operations, field) => operations.map((operation, step) =>
  ({ operation, step, field, stageCount: operations.length })));

test('all seven fixed schedules are immutable and share kernels without changing original endpoints', () => {
  assert.deepEqual(stages, expectedStages);
  assert.deepEqual(expectedFields.map(field => field.length), [11, 11, 11, 26, 9, 11, 8]);
  assert.throws(() => stages.push(stages[0]), TypeError);
  assert.throws(() => { stages[0].field = 6; }, TypeError);
  const cacheKeysByFormat = [];
  for (const wordCount of [1, 9, 66]) {
    const format = createSphExactMassFormat({ wordCount, quantumExponent: wordCount === 66 ? -1074 : -149 });
    const layout = sphExactPlacementQuantityLayout(format, { particleCount: 2, eventCapacity: 4 });
    const descriptors = sphExactPlacementQuantityPrimitivesPipelineDescriptors(format, layout);
    const original = sphExactPlacementQuantityStagedPipelineDescriptors(format, layout);
    for (const index of [0, descriptors.length - 1]) {
      const endpoint = index === 0 ? original[0] : original.at(-1);
      assert.deepEqual(descriptors[index], { ...endpoint, workgroupSize: 32,
        cacheKey: endpoint.cacheKey + '-wg32',
        code: endpoint.code.replaceAll('@workgroup_size(1)', '@workgroup_size(32)') });
    }
    assert.equal(descriptors.length, 89);
    const cached = new Map();
    for (const [index, descriptor] of descriptors.slice(1, -1).entries()) {
      const expected = expectedStages[index];
      assert.equal(descriptor.index, index);
      assert.equal(descriptor.entryPoint, `materialize_exact_placement_primitive_${expected.operation}`);
      const previous = cached.get(expected.operation);
      if (previous) {
        assert.equal(descriptor.cacheKey, previous.cacheKey);
        assert.equal(descriptor.code, previous.code);
      } else cached.set(expected.operation, descriptor);
    }
    assert.equal(cached.size, 8);
    cacheKeysByFormat.push(new Set([...cached.values()].map(value => value.cacheKey)));
  }
  for (let i = 0; i < cacheKeysByFormat.length; i++) {
    for (let j = i + 1; j < cacheKeysByFormat.length; j++) {
      assert.ok([...cacheKeysByFormat[i]].every(key => !cacheKeysByFormat[j].has(key)));
    }
  }
});

test('field/step records have disjoint aligned storage and reject malformed layout or alignment', () => {
  const format = createSphExactMassFormat();
  const layout = sphExactPlacementQuantityLayout(format, { particleCount: 2, eventCapacity: 4 });
  const scratch = sphExactPlacementQuantityPrimitivesScratchLayout(format, layout);
  assert.equal(scratch.slotCount, 6);
  assert.equal(scratch.recordWords, 16 + 6 * layout.scalar.recordWords);
  assert.equal(scratch.wordLength, layout.rowCount * scratch.recordWords);
  for (const alignment of [16, 32, 256, 512]) {
    const params = sphExactPlacementQuantityPrimitivesStageParams(scratch, alignment);
    const wordsPerSlice = alignment / 4;
    assert.equal(params.strideBytes, alignment);
    assert.equal(params.byteLength, 87 * alignment);
    for (let index = 0; index < expectedStages.length; index++) {
      const { step, field, stageCount } = expectedStages[index];
      assert.deepEqual([...params.words.slice(index * wordsPerSlice, index * wordsPerSlice + 4)],
        [step, field, stageCount, 0]);
      assert.ok(params.words.slice(index * wordsPerSlice + 4, (index + 1) * wordsPerSlice).every(word => word === 0));
    }
    const original = params.words[wordsPerSlice];
    params.words[0] = 0xffffffff;
    assert.equal(params.words[wordsPerSlice], original);
    assert.equal(sphExactPlacementQuantityPrimitivesStageParams(scratch, alignment).words[0], 0);
  }
  for (const alignment of [0, 8, 24, 255, NaN, Infinity]) {
    assert.throws(() => sphExactPlacementQuantityPrimitivesStageParams(scratch, alignment), RangeError);
  }
  assert.throws(() => sphExactPlacementQuantityPrimitivesStageParams({ ...scratch, stageCount: 86 }, 256), TypeError);
  assert.throws(() => sphExactPlacementQuantityPrimitivesScratchLayout(format,
    { ...layout, massWordCount: format.wordCount + 1 }), TypeError);
});

function setup({onCompile,submitError,limits={},wordCount=9}={}){
 const format=createSphExactMassFormat({wordCount,quantumExponent:wordCount===1?-16:wordCount===66?-1074:-149}),fixture=createExactReactionAllocationFixture(),token=compileSphExactReactionAllocation({...fixture,format,reactionIndex:0});
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
for(const wordCount of [1,9,66])test(`N${wordCount} uses one original owner,89 fixed dispatches,10 pipelines and one submission`,async()=>{
 const f=setup({wordCount}),result=await run(f.args);
 assert.equal(f.allocated.length,5);assert.deepEqual(f.derived,[result.outputBuffer,f.allocated.find(b=>b.label==='ulg-exact-placement-primitives-scratch')]);assert.equal(result.physicalPublicationAdmitted,false);assert.equal(result.schema,'peercompute.ulg.exact-placement-quantity-candidate.v1');
 assert.equal(f.compiled.length,10);assert.equal(new Set(f.compiled.map(d=>d.compute.entryPoint)).size,10);assert.equal(f.groups.length,89);
 const sequence=f.events.filter(e=>e[0]==='pipeline').map(e=>e[1]);
 assert.equal(sequence[0],'initialize_exact_placement_quantities');assert.equal(sequence.at(-1),'finalize_exact_placement_quantities');
 assert.deepEqual(sequence.slice(1,-1),expectedStages.map(s=>`materialize_exact_placement_primitive_${s.operation}`));
 const primitiveGroups=f.groups.filter(g=>g.entries.length===11);assert.equal(primitiveGroups.length,87);
 for(let index=0;index<87;index++){assert.equal(primitiveGroups[index].entries[10].resource.offset,index*256);assert.equal(primitiveGroups[index].entries[10].resource.size,16);assert.equal(primitiveGroups[index].entries[9].resource.buffer.label,'ulg-exact-placement-primitives-scratch');}
 const uniform=f.events.find(e=>e[0]==='write'&&e[1]==='ulg-exact-placement-primitives-steps')[3];
 assert.equal(uniform.length,87*64);for(let index=0;index<87;index++){const d=expectedStages[index];assert.deepEqual([...uniform.slice(index*64,index*64+4)],[d.step,d.field,d.stageCount,0]);assert.ok(uniform.slice(index*64+4,(index+1)*64).every(x=>x===0));}
 assert.ok(f.events.filter(e=>e[0]==='dispatch').every(e=>e[1]===Math.ceil(result.layout.rowCount/32)));assert.equal(f.events.filter(e=>e[0]==='dispatch').length,89);
 assert.ok(f.compiled.every(d=>d.compute.module.code.includes('@workgroup_size(32)')));
 assert.equal(f.events.filter(e=>e[0]==='clear').length,2);assert.ok(f.events.findIndex(e=>e[0]==='clear')<f.events.findIndex(e=>e[0]==='pipeline'));
 assert.equal(f.events.filter(e=>e[0]==='submit').length,1);assert.equal(f.events.filter(e=>e[0]==='write').length,3);assert.equal(f.marked,1);
 assert.ok(f.events.findIndex(e=>e[0]==='write')>f.events.findLastIndex(e=>e[0]==='compile'));
 const submit=f.events.findIndex(e=>e[0]==='submit');assert.equal(f.events[submit-1][0],'marked');assert.equal(f.events[submit-2][0],'validate');
 assert.ok(f.validated>=179);assert.ok(f.allocated.every(b=>b.destroyed===0));
 const again=await run(f.args);assert.equal(f.compiled.length,10);assert.notEqual(again.outputBuffer,result.outputBuffer);assert.equal(f.marked,2);
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
test('a shared primitive add pipeline compilation failure submits no stage',async()=>{
 const sentinel=new Error('primitive add compile rejected'),f=setup({onCompile({index}){if(index===8)throw sentinel}});
 await assert.rejects(run(f.args),e=>e===sentinel);assert.equal(f.marked,0);assert.equal(f.compiled.length,9);
 assert.ok(!f.events.some(e=>['write','encoder','submit'].includes(e[0])));assert.ok(f.allocated.every(b=>b.destroyed===0));
});

test('each allocation failure keeps prior allocations with the same parent and submits nothing',async()=>{
 for(let failAt=0;failAt<5;failAt++){
  const f=setup(),allocate=f.args.allocate,sentinel=new Error('allocation '+failAt);let calls=0;
  f.args.allocate=(...a)=>{if(calls++===failAt)throw sentinel;return allocate(...a)};
  await assert.rejects(run(f.args),e=>e===sentinel);assert.equal(f.allocated.length,failAt);
  assert.equal(f.marked,0);assert.equal(f.compiled.length,0);assert.ok(f.allocated.every(b=>b.destroyed===0));
  assert.ok(!f.events.some(e=>['write','encoder','submit'].includes(e[0])));
 }
});
test('original source validation failure after each distinct pipeline await prevents submission',async()=>{
 for(let failAt=0;failAt<10;failAt++){
  let retired=false;const sentinel=new Error('owner retired '+failAt),f=setup({onCompile({index}){if(index===failAt)retired=true}});
  const validate=f.args.validate;f.args.validate=()=>{validate();if(retired)throw sentinel};
  await assert.rejects(run(f.args),e=>e===sentinel);assert.equal(f.compiled.length,failAt+1);assert.equal(f.marked,0);
  assert.ok(!f.events.some(e=>['write','encoder','submit'].includes(e[0])));assert.ok(f.allocated.every(b=>b.destroyed===0));
 }
});
