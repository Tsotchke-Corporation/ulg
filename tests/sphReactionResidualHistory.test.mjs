import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphReactionResidualLedger, SPH_REACTION_LEDGER_PACKET_WORDS as PACKET,
  SPH_REACTION_RESIDUAL_LEDGER_LAYOUT as E } from '../src/runtime/sph/sphReactionResidualLedgerGpu.js';
import { prepareSphReactionResidualHistory, borrowSphReactionResidualHistory,
  validateSphReactionResidualHistoryCandidate, forkSphReactionResidualHistoryRead } from '../src/runtime/sph/sphReactionResidualHistoryGpu.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

// Host checks cover resource ownership only; quantities and compaction are
// verified by the native GPU suite, never by a simulated host solver.
function fixture() {
  const buffers=[];
  const device={limits:{maxBufferSize:2**24,maxStorageBufferBindingSize:2**24,maxComputeWorkgroupsPerDimension:65535},
    queue:{writeBuffer(){}},createBuffer(options){
      const b={...options,destroyed:0,failDestroy:false,destroy(){
        if(this.failDestroy)throw new Error('destroy failed');this.destroyed++;
      }};buffers.push(b);return b;
    },createShaderModule(){return{};},createBindGroupLayout(){return{};},createPipelineLayout(){return{};},
    createComputePipeline(){return{getBindGroupLayout(){return{};}};},createBindGroup(){return{};}};
  const encoder={beginComputePass(){return{setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}};}};
  const buffer=size=>tagWebGpuBufferDevice(device.createBuffer({size,usage:128|4|8}),device);
  const controlBuffer=buffer(128),inputs={particleCount:2,scratch:buffer((8+2+PACKET)*4),
    events:buffer(128),eventPlan:buffer(32),energyOutput:buffer((4*E.format.wordCount+4)*4)};
  const emission=createSphReactionResidualLedger({device,capacity:1,generation:1});
  emission.encode(encoder,inputs);const emitted=emission.commit();
  const make=options=>prepareSphReactionResidualHistory({device,emitted,capacity:4,controlBuffer,...options});
  const finish=producer=>{producer.encode(encoder);producer.check(encoder);producer.restore(encoder);return producer.transfer();};
  return{device,buffers,encoder,controlBuffer,emission,emitted,make,finish};
}

test('canonical history successor retains original storage through predecessor retirement',()=>{
  const f=fixture(),first=f.make(),before=f.finish(first);
  const next=f.make({source:before.history,emitted:null});
  first.destroy();before.destroy();f.emission.destroy();
  assert.equal(before.history.buffer.destroyed,0);
  const after=f.finish(next),a=borrowSphReactionResidualHistory(after.history,{device:f.device}),
    b=borrowSphReactionResidualHistory(after.history,{device:f.device});
  assert.equal(after.history.generation,before.history.generation+1);
  assert.notEqual(after.history.buffer,before.history.buffer);
  assert.throws(()=>after.history.buffer.destroy(),/retained/);
  next.destroy();after.destroy();a.validate();b.validate();
  assert.throws(()=>borrowSphReactionResidualHistory(after.history,{device:f.device}),/original/);
  a.release();assert.equal(after.history.buffer.destroyed,0);
  b.release();assert.equal(after.history.buffer.destroyed,1);
  assert.equal(before.history.buffer.destroyed,1);assert.equal(f.emitted.buffer.destroyed,1);
  assert.equal(b.release(),false);assert.throws(()=>a.validate(),/retired/);
});

test('canonical history requires genuine same-device owners and bounded capacity',()=>{
  const f=fixture(),first=f.make(),before=f.finish(first);
  assert.throws(()=>borrowSphReactionResidualHistory({...before.history},{device:f.device}),/original/);
  assert.throws(()=>borrowSphReactionResidualHistory(before.history,{device:{}}),/original/);
  assert.throws(()=>f.make({source:{...before.history}}),/original/);
  assert.throws(()=>f.make({emitted:{...f.emitted}}),/original/);
  assert.throws(()=>validateSphReactionResidualHistoryCandidate({...first.record},f.device),/genuine/);
  for(const capacity of [0,-1,1.5,2**32])assert.throws(()=>f.make({capacity}),/bounded/);
  assert.throws(()=>f.make({source:before.history,capacity:3}),/bounded/);
  assert.throws(()=>f.make({controlBuffer:{...f.controlBuffer}}),/bounded/);
  assert.equal(f.make({source:null,emitted:null}),null);
  first.destroy();before.destroy();f.emission.destroy();
  assert.equal(first.record.buffer.destroyed,1);assert.equal(f.emitted.buffer.destroyed,1);
});

test('canonical history requires exactly one encoded, finalized handover',()=>{
  const f=fixture(),producer=f.make();
  assert.throws(()=>producer.check(f.encoder),/not encoded/);
  assert.throws(()=>producer.transfer(),/not encoded/);
  producer.encode(f.encoder);assert.throws(()=>producer.encode(f.encoder),/once/);
  assert.throws(()=>producer.transfer(),/finalized/);
  producer.check(f.encoder);producer.restore(f.encoder);
  assert.throws(()=>producer.restore(f.encoder),/already finalized/);
  const holder=producer.transfer();assert.throws(()=>producer.transfer(),/one finalized/);
  producer.destroy();holder.destroy();f.emission.destroy();
  assert.throws(()=>validateSphReactionResidualHistoryCandidate(producer.record,f.device),/genuine/);
});

test('canonical retirement retries failed storage without double-destroying siblings or releasing inputs early',()=>{
  const f=fixture(),start=f.buffers.length,producer=f.make(),owned=f.buffers.slice(start);
  producer.record.buffer.failDestroy=true;f.emission.destroy();
  assert.throws(()=>producer.destroy(),/retirement failed/);
  assert.equal(f.emitted.buffer.destroyed,0);
  assert.ok(owned.filter(b=>b!==producer.record.buffer).every(b=>b.destroyed===1));
  producer.record.buffer.failDestroy=false;producer.destroy();
  assert.ok(owned.every(b=>b.destroyed===1));assert.equal(f.emitted.buffer.destroyed,1);
});

test('canonical construction failure retires partial scan storage and returns the emission borrow',()=>{
  const f=fixture(),start=f.buffers.length,create=f.device.createBuffer.bind(f.device);
  f.device.createBuffer=options=>{
    if(options.label.endsWith('block-sums'))throw new Error('allocation failed');return create(options);
  };
  assert.throws(()=>f.make(),/allocation failed/);
  assert.ok(f.buffers.slice(start).every(b=>b.destroyed===1));
  f.emission.destroy();assert.equal(f.emitted.buffer.destroyed,1);
});

test('history forks retain a closed producer and reject copied, foreign and released reads',()=>{
  const f=fixture(),producer=f.make(),holder=f.finish(producer);
  const read=borrowSphReactionResidualHistory(holder.history,{device:f.device});
  producer.destroy();holder.destroy();f.emission.destroy();
  assert.throws(()=>forkSphReactionResidualHistoryRead({...read},{device:f.device}),/original/);
  assert.throws(()=>forkSphReactionResidualHistoryRead(read,{device:{}}),/original/);
  const fork=forkSphReactionResidualHistoryRead(read,{device:f.device});
  read.release();assert.throws(()=>forkSphReactionResidualHistoryRead(read,{device:f.device}),/retired/);
  assert.equal(holder.history.buffer.destroyed,0);fork.validate();
  fork.release();assert.equal(holder.history.buffer.destroyed,1);assert.equal(f.emitted.buffer.destroyed,1);
  assert.equal(fork.release(),false);
});
