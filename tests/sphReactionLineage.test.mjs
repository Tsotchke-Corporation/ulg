import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareSphReactionLineageCandidate, borrowSphReactionLineage,
  validateSphReactionLineageCandidate } from '../src/runtime/sph/sphReactionLineageGpu.js';

function device() {
  const buffers=[];
  return {buffers,limits:{maxBufferSize:2**24,maxStorageBufferBindingSize:2**24},
    createBuffer(options) {const buffer={...options,destroyed:0,destroy(){this.destroyed++;}};
      buffers.push(buffer);return buffer;}};
}

test('private lineage retains predecessors and held readers through producer and owner retirement',()=>{
  const gpu=device(),a=prepareSphReactionLineageCandidate({device:gpu});
  const owner=a.transfer(),read=borrowSphReactionLineage(gpu,owner.lineage);
  const b=prepareSphReactionLineageCandidate({device:gpu,source:owner.lineage});
  assert.equal(b.record.beforeBuffer,owner.lineage.buffer);
  assert.throws(()=>a.record.buffer.destroy(),/retained/);
  assert.throws(()=>a.transfer(),/already adopted/);
  a.destroy();owner.destroy();
  assert.throws(()=>borrowSphReactionLineage(gpu,owner.lineage),/original live/);
  assert.equal(read.validate(),true);
  assert.equal(validateSphReactionLineageCandidate(b.record,gpu),true);
  read.release();assert.equal(a.record.buffer.destroyed,0);
  b.destroy();assert.equal(a.record.buffer.destroyed,1);
  assert.equal(a.record.beforeBuffer.destroyed,1);
  assert.equal(b.record.buffer.destroyed,1);
  assert.equal(b.destroy(),false);assert.equal(read.release(),false);
  assert.throws(()=>read.validate(),/retired/);
});

test('private lineage rejects copied owners, foreign devices and closed producer records',()=>{
  const gpu=device(),candidate=prepareSphReactionLineageCandidate({device:gpu});
  const owner=candidate.transfer();
  assert.throws(()=>borrowSphReactionLineage(gpu,{...owner.lineage}),/original live/);
  assert.throws(()=>borrowSphReactionLineage(device(),owner.lineage),/original live/);
  assert.throws(()=>validateSphReactionLineageCandidate({...candidate.record},gpu),/genuine/);
  candidate.destroy();assert.throws(()=>candidate.encodeBefore({}),/genuine/);
  owner.destroy();assert.ok(gpu.buffers.every(buffer=>buffer.destroyed===1));
});

test('failed lineage allocation releases its predecessor borrow without closing the predecessor',()=>{
  const gpu=device(),candidate=prepareSphReactionLineageCandidate({device:gpu});
  const owner=candidate.transfer();
  const create=gpu.createBuffer;gpu.createBuffer=()=>{throw new Error('allocation failed');};
  assert.throws(()=>prepareSphReactionLineageCandidate({device:gpu,source:owner.lineage}),/allocation failed/);
  gpu.createBuffer=create;
  const read=borrowSphReactionLineage(gpu,owner.lineage);read.release();
  candidate.destroy();owner.destroy();assert.ok(gpu.buffers.every(buffer=>buffer.destroyed===1));
});
