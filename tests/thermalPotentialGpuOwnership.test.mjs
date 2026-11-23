import assert from 'node:assert/strict';
import test from 'node:test';
import * as potential from '../src/runtime/material/thermalPotentialGpu.js';
import * as workerLane from '../src/runtime/material/thermalPotentialWorkerLane.js';
import { THERMAL_POTENTIAL_WORKER_ACK, thermalPotentialLineageKey, validateThermalPotentialWorkerResult } from '../src/runtime/material/thermalPotentialWorkerProtocol.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import { ReservationLedger } from '../../peercompute/peercompute/src/peercompute/stateManager/ReservationLedger.js';
import { createResidentStateManagerCommitHandler } from '../src/runtime/peercomputeResidentCommitBridge.js';
import { ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA as deltaSchema,
  ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA as stateSchema } from '../src/runtime/sph/sphMlsMpmGpuStep.js';

// Control/lifetime tests only. The fake device supplies a chosen validation
// verdict; actual shader arithmetic and consumers have separate native tests.
function fixture({ audit, failureLabel, valid=true }={}) {
  const buffers=[];
  const device={
    createBuffer({label='',size,usage}) {
      if(label===failureLabel || device.failRead && usage===(1|8))throw new Error('allocation fault');
      const buffer={label,size,usage,data:new ArrayBuffer(size),destroyed:false,
        destroy(){this.destroyed=true;},async mapAsync(){},getMappedRange(){return this.data;}};
      buffers.push(buffer);return buffer;
    },
    createShaderModule(options){return options;},createBindGroupLayout(options){return options;},
    createPipelineLayout(options){return options;},createComputePipeline(options){return options;},
    createBindGroup(options){return options;},
    createCommandEncoder(){
      const operations=[];
      return {copyBufferToBuffer(a,ao,b,bo,size){operations.push(()=>new Uint8Array(b.data,bo,size).set(new Uint8Array(a.data,ao,size)));},
        beginComputePass(){let pipeline,group;return {setPipeline(p){pipeline=p;},setBindGroup(_,g){group=g;},dispatchWorkgroups(){
          if(pipeline.compute.entryPoint==='fit')operations.push(()=>new Uint32Array(group.entries[5].resource.buffer.data).set([0x47365031,1,valid?1:0]));
        },end(){}};},finish(){return operations;}};
    },
    queue:{writeBuffer(buffer,offset,data){new Uint8Array(buffer.data,offset,data.byteLength).set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));},
      submit(commands){for(const command of commands)for(const op of command)op();},async onSubmittedWorkDone(){}}
  };
  const upload={status:'webgpu-uploaded',contentFingerprint:'source-v1',graphCount:1};
  for(const field of ['graphNodeBuffer','graphSampleBuffer','responseBuffer','responseRecordBuffer','responseThermalConductivityBuffer']){
    upload[field]=tagWebGpuBufferDevice(device.createBuffer({size:64,label:'source',usage:0x80}),device);
  }
  const ledger=new ReservationLedger({maxKeys:3,audit:event=>audit?.(event,{device,upload,ledger})});
  return {device,upload,ledger,buffers,create(){return potential.createThermalPotentialGpu(device,{thermalResponseGraphUpload:upload,reservationLedger:ledger});}};
}
function delta() {return {schema:deltaSchema,taskId:'g6-unit',scope:'ulg-sph-resident-pass-dag',
  payload:{schema:stateSchema,stateKey:'g6-unit',completedStepCount:1,
    gpuFence:{fenceSatisfied:true,status:'queue-work-completed',method:'queue.onSubmittedWorkDone'}}};}
async function candidate(f,cache) {
  const result=potential.encodeThermalPotentialCandidateGpu(cache,f.device.createCommandEncoder());
  potential.submitThermalPotentialCandidateGpu(result);await potential.completeThermalPotentialCandidateGpu(result);return result;
}
function commit(candidate, options={}) {
  const d=delta();potential.attachThermalPotentialCandidateToDelta(candidate,d);
  return createResidentStateManagerCommitHandler({commitDelta(){}},options)(d);
}

const workerEpoch = {storageGeneration:1,physicsTick:1,physicsSubstep:0,positionEpoch:1,
  topologyEpoch:0,chartEpoch:0,levelEpoch:0,supportEpoch:0,particleCount:2};
const workerIdentity = {scheduleId:'producer',laneId:'lane',stateKey:'state',lineageKey:thermalPotentialLineageKey(workerEpoch)};
const workerAck = receipt => ({schema:THERMAL_POTENTIAL_WORKER_ACK,status:'state-manager-committed',
  targetScheduleId:'consumer',candidate:structuredClone(receipt)});

test('worker candidate adopts once with its exact acknowledged descriptor, preserving same-realm delta identity',async()=>{
  const f=fixture(),cache=f.create(),c=await candidate(f,cache);
  const receipt=potential.bindThermalPotentialCandidateToWorkerSchedule(c,workerIdentity);
  assert.throws(()=>potential.attachThermalPotentialCandidateToDelta(c,delta()),/refused/);
  assert.equal(potential.settleThermalPotentialDelta(structuredClone(delta()),true),false);
  assert.equal(potential.acceptThermalPotentialWorkerCandidate(c,workerAck(receipt),'consumer'),true);
  assert.equal(potential.acceptThermalPotentialWorkerCandidate(c,workerAck(receipt),'consumer'),false);
  assert.equal(potential.thermalPotentialGpuBindings(cache,f.device,f.upload).ordinal,1);
  potential.destroyThermalPotentialGpu(cache);
});

test('worker rejects missing, foreign, altered and same-schedule acknowledgements without adoption',async()=>{
  for(const edit of [a=>null,a=>({...a,targetScheduleId:'foreign'}),a=>({...a,status:'pending'}),
    ...['candidateId','scheduleId','laneId','stateKey','lineageKey','sourceFingerprint','parentOrdinal'].map(
      key=>a=>{a.candidate[key]=key==='parentOrdinal'?99:'foreign';return a;})]) {
    const f=fixture(),cache=f.create(),c=await candidate(f,cache);
    const receipt=potential.bindThermalPotentialCandidateToWorkerSchedule(c,workerIdentity);
    assert.equal(potential.acceptThermalPotentialWorkerCandidate(c,edit(workerAck(receipt)),'consumer'),false);
    assert.equal(potential.acceptThermalPotentialWorkerCandidate(c,{...workerAck(receipt),targetScheduleId:'producer'},'producer'),false);
    assert.equal(potential.thermalPotentialGpuBindings(cache,f.device,f.upload).ordinal,0);
    potential.cancelThermalPotentialCandidateGpu(c);potential.destroyThermalPotentialGpu(cache);
  }
});

test('worker lane cancels unacknowledged or physically stale fits and releases all owned buffers',async()=>{
  for(const mode of ['accepted','missing','epoch','lane','source','revoked']) {
    const f=fixture();const owner=workerLane.createThermalPotentialWorkerLane(f.device,f.upload);
    const first=workerLane.beginThermalPotentialWorkerSchedule(owner,{...workerIdentity,upload:workerEpoch});
    assert.equal(first.ordinal,0);
    const finished=await workerLane.finishThermalPotentialWorkerSchedule(owner,{...workerIdentity,upload:workerEpoch});
    const next={...workerIdentity,scheduleId:'consumer',upload:{...workerEpoch},acknowledgement:workerAck(finished.candidate)};
    if(mode==='missing')next.acknowledgement=null;
    if(mode==='epoch')next.upload.physicsTick++;
    if(mode==='lane')next.laneId='foreign';
    if(mode==='source')f.upload.contentFingerprint='changed';
    if(mode==='revoked')workerLane.destroyThermalPotentialWorkerLane(owner);
    if(mode==='source'||mode==='revoked')assert.throws(()=>workerLane.beginThermalPotentialWorkerSchedule(owner,next));
    else assert.deepEqual(workerLane.beginThermalPotentialWorkerSchedule(owner,next),{adopted:mode==='accepted',ordinal:mode==='accepted'?1:0});
    workerLane.destroyThermalPotentialWorkerLane(owner);
    assert.ok(f.buffers.filter(b=>b.label!=='source').every(b=>b.destroyed));
  }
});

test('worker fit defers bounded capacity pressure while preserving its active generation',async()=>{
  const f=fixture(),owner=workerLane.createThermalPotentialWorkerLane(f.device,f.upload);
  const cache=workerLane.thermalPotentialWorkerCache(owner),pins=[];
  for(let i=0;i<2;i++){
    pins.push(potential.retainThermalPotentialGpu(cache,f.device,f.upload));
    const result=await workerLane.finishThermalPotentialWorkerSchedule(owner,{...workerIdentity,scheduleId:`producer:${i}`,upload:workerEpoch});
    const nextId=`consumer:${i}`;
    assert.equal(workerLane.beginThermalPotentialWorkerSchedule(owner,{...workerIdentity,scheduleId:nextId,upload:workerEpoch,
      acknowledgement:{...workerAck(result.candidate),targetScheduleId:nextId}}).ordinal,i+1);
  }
  const deferred=await workerLane.finishThermalPotentialWorkerSchedule(owner,{...workerIdentity,upload:workerEpoch});
  assert.deepEqual(deferred,{candidate:null,readbackBytes:0,mapAsyncCount:0,status:'deferred-capacity',cumulativeConsumerHits:null});
  const cadenceChecked=validateThermalPotentialWorkerResult(
    {adopted:false,ordinal:2,candidate:null,readbackBytes:0,mapAsyncCount:0,status:'cadence-deferred',cumulativeConsumerHits:null},
    {enabled:true,...workerIdentity,route:{lineage:{target:workerEpoch},particleCardinality:{targetParticleCount:workerEpoch.particleCount}}}
  );
  assert.equal(cadenceChecked.status,'cadence-deferred');
  assert.equal(cadenceChecked.mapAsyncCount,0);
  assert.equal(workerLane.thermalPotentialWorkerOrdinal(owner),2);
  for(const pin of pins)pin.release();
  const recovered=await workerLane.finishThermalPotentialWorkerSchedule(owner,{...workerIdentity,upload:workerEpoch});
  assert.equal(recovered.status,'pending-state-manager');
  workerLane.cancelThermalPotentialWorkerPending(owner);workerLane.destroyThermalPotentialWorkerLane(owner);
  assert.ok(f.buffers.filter(b=>b.label!=='source').every(b=>b.destroyed));
});

test('device loss fences a pending worker fit before its acknowledgement',async()=>{
  const f=fixture();let lose;f.device.lost=new Promise(resolve=>{lose=resolve;});
  const owner=workerLane.createThermalPotentialWorkerLane(f.device,f.upload);
  const result=await workerLane.finishThermalPotentialWorkerSchedule(owner,{...workerIdentity,upload:workerEpoch});
  lose({reason:'destroyed'});await Promise.resolve();
  assert.throws(()=>workerLane.beginThermalPotentialWorkerSchedule(owner,{...workerIdentity,scheduleId:'consumer',
    upload:workerEpoch,acknowledgement:workerAck(result.candidate)}),/closed|retired|invalid|source/i);
  workerLane.destroyThermalPotentialWorkerLane(owner);
  assert.ok(f.buffers.filter(b=>b.label!=='source').every(b=>b.destroyed));
});

test('unsubmitted candidate cannot become ready after an unrelated queue fence',async()=>{
  const f=fixture(),cache=f.create();
  const c=potential.encodeThermalPotentialCandidateGpu(cache,f.device.createCommandEncoder());
  await assert.rejects(potential.completeThermalPotentialCandidateGpu(c),/not submitted/);
  assert.throws(()=>potential.attachThermalPotentialCandidateToDelta(c,delta()),/refused/);
  potential.cancelThermalPotentialCandidateGpu(c);potential.destroyThermalPotentialGpu(cache);
  assert.ok(f.buffers.filter(b=>b.label!=='source').every(b=>b.destroyed));
});
test('GPU rejection cancels reservation and preserves the active generation',async()=>{
  const f=fixture({valid:false}),cache=f.create();
  await assert.rejects(candidate(f,cache),/GPU candidate validation refused/);
  assert.equal(potential.thermalPotentialGpuBindings(cache,f.device,f.upload).ordinal,0);
  assert.ok([...f.ledger.keys.values()].every(r=>r.state==='free'));
  potential.destroyThermalPotentialGpu(cache);
});
test('partial generation allocation and cache construction release already-created buffers',()=>{
  const f=fixture({failureLabel:'g6-potential-metadata'});
  assert.throws(()=>f.create(),/allocation fault/);
  assert.ok(f.buffers.filter(b=>b.label!=='source').every(b=>b.destroyed));
});
test('admission callback exception releases candidate and permits a new derivation',async()=>{
  const f=fixture(),cache=f.create(),c=await candidate(f,cache);
  assert.throws(()=>commit(c,{onAdmission(){throw new Error('observer failed');}}),/observer failed/);
  assert.equal(potential.thermalPotentialGpuBindings(cache,f.device,f.upload).ordinal,0);
  const replacement=await candidate(f,cache);commit(replacement);
  assert.equal(potential.thermalPotentialGpuBindings(cache,f.device,f.upload).ordinal,1);
  potential.destroyThermalPotentialGpu(cache);
});
test('source invalidation inside reservation commit cannot publish a candidate',async()=>{
  const f=fixture({audit(event,{upload}){if(event.event==='commit')upload.contentFingerprint='changed';}}),cache=f.create();
  commit(await candidate(f,cache));f.upload.contentFingerprint='source-v1';
  assert.equal(potential.thermalPotentialGpuBindings(cache,f.device,f.upload).ordinal,0);
  assert.ok([...f.ledger.keys.values()].every(r=>r.state==='free'));
  potential.destroyThermalPotentialGpu(cache);
});
test('retirement callback sees the already-published live generation',async()=>{
  let cache,observed=[];
  const f=fixture({audit(event){if(event.event==='retire'){
    const binding=potential.thermalPotentialGpuBindings(cache,f.device,f.upload);
    observed.push([binding.ordinal,binding.table.destroyed]);
  }}});cache=f.create();
  commit(await candidate(f,cache));commit(await candidate(f,cache));
  assert.deepEqual(observed,[[2,false]]);
  potential.destroyThermalPotentialGpu(cache);
});
test('repeated replacement reuses bounded ledger keys and respects pinned consumers',async()=>{
  const f=fixture(),cache=f.create();
  const old=potential.retainThermalPotentialGpu(cache,f.device,f.upload);
  for(let i=0;i<12;i++)commit(await candidate(f,cache));
  old.assertLive();assert.equal(old.table.destroyed,false);assert.ok(f.ledger.keys.size<=3);
  assert.equal(potential.thermalPotentialGpuBindings(cache,f.device,f.upload).ordinal,12);
  old.release();assert.equal(old.table.destroyed,true);
  potential.destroyThermalPotentialGpu(cache);
  assert.ok(f.buffers.filter(b=>b.label!=='source').every(b=>b.destroyed));
});
test('revoked accepted reservations refuse an existing consumer lease',async()=>{
  const f=fixture(),cache=f.create();commit(await candidate(f,cache));
  const lease=potential.retainThermalPotentialGpu(cache,f.device,f.upload);
  f.ledger.destroy();assert.throws(()=>lease.assertLive(),/revoked/);
  lease.release();potential.destroyThermalPotentialGpu(cache);
});
test('completion is single-flight and proof allocation failure cancels ownership',async()=>{
  const f=fixture(),cache=f.create();
  let c=potential.encodeThermalPotentialCandidateGpu(cache,f.device.createCommandEncoder());
  potential.submitThermalPotentialCandidateGpu(c);
  const before=f.buffers.length;
  await Promise.all(Array.from({length:20},()=>potential.completeThermalPotentialCandidateGpu(c)));
  assert.equal(f.buffers.length-before,1);
  commit(c);
  c=potential.encodeThermalPotentialCandidateGpu(cache,f.device.createCommandEncoder());
  potential.submitThermalPotentialCandidateGpu(c);f.device.failRead=true;
  await assert.rejects(potential.completeThermalPotentialCandidateGpu(c),/allocation fault/);
  f.device.failRead=false;
  commit(await candidate(f,cache));
  assert.equal(potential.thermalPotentialGpuBindings(cache,f.device,f.upload).ordinal,2);
  potential.destroyThermalPotentialGpu(cache);
  assert.ok(f.buffers.filter(b=>b.label!=='source').every(b=>b.destroyed));
});
test('a revoked parent cannot be copied or laundered through pending adoption',async()=>{
  for(const revokeBeforeEncode of [true,false]){
    const f=fixture(),cache=f.create();commit(await candidate(f,cache));
    const pending=revokeBeforeEncode?null:await candidate(f,cache);
    const key=[...f.ledger.keys.values()].find(r=>r.state==='consumed').key;
    f.ledger.retire(key);
    assert.throws(()=>potential.thermalPotentialGpuBindings(cache,f.device,f.upload),/revoked/);
    if(revokeBeforeEncode)assert.throws(()=>potential.encodeThermalPotentialCandidateGpu(cache,f.device.createCommandEncoder()),/revoked/);
    else {commit(pending);assert.throws(()=>potential.thermalPotentialGpuBindings(cache,f.device,f.upload),/revoked/);}
    potential.destroyThermalPotentialGpu(cache);
    assert.ok(f.buffers.filter(b=>b.label!=='source').every(b=>b.destroyed));
  }
});
