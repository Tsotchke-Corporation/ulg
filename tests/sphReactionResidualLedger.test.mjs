import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphReactionResidualLedger, borrowSphReactionResidualLedger,
  SPH_REACTION_LEDGER_PACKET_WORDS, SPH_REACTION_RESIDUAL_LEDGER_LAYOUT as L }
  from '../src/runtime/sph/sphReactionResidualLedgerGpu.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function fixture() {
  const buffers=[];
  const device={buffers,limits:{maxBufferSize:2**24,maxStorageBufferBindingSize:2**24,maxComputeWorkgroupsPerDimension:65535},
    queue:{writeBuffer(){}},createBuffer(options){
      const b={...options,destroyed:0,failDestroy:false,destroy(){if(this.failDestroy)throw new Error('destroy failed');this.destroyed++;}};
      buffers.push(b);return b;
    },createShaderModule(){return{};},createBindGroupLayout(){return{};},createPipelineLayout(){return{};},
    createComputePipeline(){return{};},createBindGroup(){return{};}};
  const encoder={beginComputePass(){return{setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}};}};
  const buffer=size=>tagWebGpuBufferDevice(device.createBuffer({size}),device);
  const inputs={particleCount:2,scratch:buffer((8+2+SPH_REACTION_LEDGER_PACKET_WORDS)*4),events:buffer(128),
    eventPlan:buffer(32),energyOutput:buffer((4*L.format.wordCount+4)*4)};
  return{device,encoder,inputs};
}

test('residual quantity ownership survives producer close until its last genuine reader',()=>{
  const {device,encoder,inputs}=fixture(),producer=createSphReactionResidualLedger({device,capacity:1,generation:3});
  assert.throws(()=>producer.commit(),/encoded/);producer.encode(encoder,inputs);
  const record=producer.commit(),first=borrowSphReactionResidualLedger(record,{device}),second=borrowSphReactionResidualLedger(record,{device});
  assert.equal(record.physicalPublicationAdmitted,false);
  assert.throws(()=>borrowSphReactionResidualLedger({...record},{device}),/original/);
  assert.throws(()=>borrowSphReactionResidualLedger(record,{device:fixture().device}),/original/);
  assert.throws(()=>record.buffer.destroy(),/retained/);
  assert.throws(()=>producer.encode(encoder,inputs),/once/);assert.throws(()=>producer.commit(),/one encoded/);
  producer.destroy();assert.throws(()=>borrowSphReactionResidualLedger(record,{device}),/original/);
  first.validate();second.validate();first.release();assert.equal(record.buffer.destroyed,0);
  second.release();assert.equal(record.buffer.destroyed,1);assert.equal(second.release(),false);
  assert.throws(()=>first.validate(),/retired/);assert.equal(producer.destroy(),false);
});

test('residual cleanup retries only failed storage and releases siblings',()=>{
  const {device,encoder,inputs}=fixture(),producer=createSphReactionResidualLedger({device,capacity:1,generation:3});
  producer.encode(encoder,inputs);const record=producer.commit();record.buffer.failDestroy=true;
  assert.throws(()=>producer.destroy(),/retirement failed/);
  const params=device.buffers.find(b=>b.label==='ulg-reaction-residual-params');assert.equal(params.destroyed,1);
  record.buffer.failDestroy=false;producer.destroy();assert.equal(record.buffer.destroyed,1);assert.equal(params.destroyed,1);
});

test('residual allocation failure and invalid bounds do not leak an owner',()=>{
  const {device}=fixture();
  for(const capacity of [-1,-0,0.1,2**32])assert.throws(()=>createSphReactionResidualLedger({device,capacity,generation:1}),/capacity/);
  const create=device.createBuffer.bind(device);device.createBuffer=opts=>{
    if(opts.label==='ulg-reaction-residual-params')throw new Error('allocation failed');return create(opts);
  };
  assert.throws(()=>createSphReactionResidualLedger({device,capacity:1,generation:1}),/allocation failed/);
  assert.equal(device.buffers.find(b=>b.label==='ulg-reaction-residual-ledger').destroyed,1);
});

test('residual encoder rejects foreign and undersized packet storage before encoding',()=>{
  const {device,encoder,inputs}=fixture(),producer=createSphReactionResidualLedger({device,capacity:1,generation:1});
  assert.throws(()=>producer.encode(encoder,{...inputs,events:fixture().inputs.events}),/original reaction/);
  inputs.scratch.size=4;assert.throws(()=>producer.encode(encoder,inputs),/original reaction/);
  producer.destroy();
});
