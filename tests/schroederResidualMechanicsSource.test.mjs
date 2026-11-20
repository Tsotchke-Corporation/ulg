import assert from 'node:assert/strict';
import test from 'node:test';
import { createSchroederResidualMechanicsSource, createSchroederResidualPhaseMechanicsSource, runSchroederResidualMechanicsLevelAssignment }
  from '../src/runtime/sph/schroederResidualMechanicsSourceGpu.js';
import { uploadSphGpuParticleBuffers, uploadMlsMpmGpuParticleBuffers, destroySphGpuParticleBuffers,
  destroyMlsMpmGpuParticleBuffers, acquireSphParticleExactMassRead, releaseSphParticleExactMassRead,
  bindSphExactMassResidualMechanicsSource, validateSphParticleExactMassRead,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA }
  from '../src/runtime/sph/sphGpuBuffers.js';
import { prepareSphExactParticleMassSeed, bindSphExactParticleMassSeed } from '../src/runtime/sph/sphExactMassParticleSeed.js';
import { createSphReactionResidualLedger, SPH_REACTION_LEDGER_PACKET_WORDS as PACKET,
  SPH_REACTION_RESIDUAL_LEDGER_LAYOUT as E } from '../src/runtime/sph/sphReactionResidualLedgerGpu.js';
import { prepareSphReactionResidualHistory } from '../src/runtime/sph/sphReactionResidualHistoryGpu.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

// Resource/ownership recorder only; all spatial/numerical evidence is native.
function fixture({phaseLanes=null}={}) {
  const buffers=[],writes=[];
  const device={lost:new Promise(()=>{}),limits:{maxBufferSize:2**24,maxStorageBufferBindingSize:2**24,
    maxComputeWorkgroupsPerDimension:65535},queue:{writeBuffer(b,offset,data){writes.push({b,offset,data});},
    submit(){},onSubmittedWorkDone(){return Promise.resolve();}},
    createBuffer(spec){const b={...spec,destroyed:0,failDestroy:false,destroy(){
      if(this.failDestroy)throw new Error('destroy failed');this.destroyed++;
    }};buffers.push(b);return b;},createShaderModule(){return{};},createBindGroupLayout(){return{};},
    createPipelineLayout(){return{};},createComputePipeline(){return{getBindGroupLayout(){return{};}};},createBindGroup(){return{};},
    createCommandEncoder(){return{copyBufferToBuffer(){},clearBuffer(){},finish(){return{};},
      beginComputePass(){return{setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}};}};}};
  const epoch={storageGeneration:1,physicsTick:0,physicsSubstep:0,positionEpoch:0,topologyEpoch:0,chartEpoch:0,levelEpoch:0,supportEpoch:0};
  const n=phaseLanes??1,phaseCarrierPlan=phaseLanes?{
    schema:'peercompute.ulg.sph-phase-carrier-plan.v2',status:'phase-lane-capacity-ready',
    lineageCapacity:1,primaryCapacity:1,phaseLaneCount:phaseLanes,phaseLaneStride:1,
    companionStart:1,companionCapacity:phaseLanes-1,particleCapacity:n,
    phaseCompanionLanesRequired:phaseLanes===4,stableLaneAddress:'phaseLane*phaseLaneStride+lineageIndex'}:null;
  const packed={...epoch,schema:ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,particleCount:n,phaseCarrierPlan,
    state:Float32Array.from(Array.from({length:n},()=>[1,1,1,1,0,0,0,40]).flat()),thermo:new Float32Array(n*12),identity:Uint32Array.from({length:n},()=>101),
    identityRevision:'cold-ownership',stateStrideBytes:32,thermoStrideBytes:48,identityStrideBytes:4,metadata:Array.from({length:n},()=>({}))};
  bindSphExactParticleMassSeed(packed,prepareSphExactParticleMassSeed({particles:Array.from({length:n},()=>({massKg:1}))},
    {format:E.format,reference:'cold owner test',initialQuantities:false,energyLedger:true}));
  const sph=uploadSphGpuParticleBuffers(device,packed);
  const mls=uploadMlsMpmGpuParticleBuffers(device,{...epoch,schema:ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
    particleCount:n,mechanics:new Float32Array(n*32),mechanicsStrideBytes:128,phaseCarrierPlan});
  const b=size=>tagWebGpuBufferDevice(device.createBuffer({size,usage:128|4|8}),device);
  const emission=createSphReactionResidualLedger({device,capacity:1,generation:1}),encoder=device.createCommandEncoder();
  emission.encode(encoder,{particleCount:1,scratch:b((9+PACKET)*4),events:b(128),eventPlan:b(32),energyOutput:b((2*E.format.wordCount+4)*4)});
  const history=prepareSphReactionResidualHistory({device,emitted:emission.commit(),capacity:4,controlBuffer:b(128)});
  history.encode(encoder);history.check(encoder);history.restore(encoder);const holder=history.transfer();
  const make=options=>createSchroederResidualMechanicsSource({device,sphParticleUpload:sph,
    mlsMpmParticleUpload:mls,history:holder.history,...options});
  const close=()=>{history.destroy();holder.destroy();emission.destroy();destroySphGpuParticleBuffers(sph);destroyMlsMpmGpuParticleBuffers(mls);};
  const makePhase=options=>createSchroederResidualPhaseMechanicsSource({device,sphParticleUpload:sph,
    mlsMpmParticleUpload:mls,history:holder.history,...options});
  return{device,buffers,writes,sph,mls,history,holder,make,makePhase,close};
}

test('phase materialization retains original single-lane or four-lane grouping and exact owners',async()=>{
  for(const phaseLanes of [1,4]){
    const f=fixture({phaseLanes}),source=await f.makePhase();
    assert.equal(source.phaseLayout.carrierLineageCount,1);
    assert.equal(source.phaseLayout.carrierLaneCount,phaseLanes);
    assert.equal(source.particleCount,20);assert.equal(source.sphParticleState.phaseCarrierPlan.lineageCapacity,5);
    assert.equal(source.phaseLayout.sourcePlan,f.sph.phaseCarrierPlan);
    const binding=await bindSphExactMassResidualMechanicsSource({device:f.device,source,includeEnergy:true});
    const read=acquireSphParticleExactMassRead(binding.sphParticleUpload,f.device,binding);
    assert.equal(read.read.rowCount,20);assert.equal(read.energy.rowCount,20);
    assert.ok(Object.isFrozen(f.sph.phaseCarrierPlan));assert.ok(Object.isFrozen(source.phaseLayout.plan));
    binding.destroy();f.close();await assert.rejects(source.retire(Promise.resolve(true)),/retained consumers/);
    assert.equal(read.energy.energyBuffer.destroyed,0);
    await releaseSphParticleExactMassRead(read);await source.retire(Promise.resolve(true));
    assert.equal(read.energy.energyBuffer.destroyed,1);
  }
});

test('a replacement carrier phase plan cannot forge a different grouping',async()=>{
  const f=fixture({phaseLanes:4});
  const original=f.sph.phaseCarrierPlan;
  f.sph.phaseCarrierPlan=Object.freeze({...original,lineageCapacity:4,primaryCapacity:4,phaseLaneCount:1,
    phaseLaneStride:4,companionStart:4,companionCapacity:0,phaseCompanionLanesRequired:false});
  await assert.rejects(f.makePhase(),/original/);
  f.sph.phaseCarrierPlan=original;
  const source=await f.makePhase();f.close();await source.retire(Promise.resolve(true));
  const g=fixture();await assert.rejects(g.makePhase(),/original fixed carrier plan/);g.close();
});

test('mechanics view pins both original owners until its existing batch fence',async()=>{
  const f=fixture(),source=f.make();f.close();
  assert.equal(f.sph.stateBuffer.destroyed,0);assert.equal(f.mls.mechanicsBuffer.destroyed,0);
  assert.equal(f.holder.history.buffer.destroyed,0);
  assert.throws(()=>source.sphParticleUpload.stateBuffer.destroy(),/retained/);
  assert.throws(()=>acquireSphParticleExactMassRead(source.sphParticleUpload,f.device),/original/);
  assert.equal(source.physicalPublicationAdmitted,false);
  const viewBuffers=[source.sphParticleUpload.stateBuffer,source.sphParticleUpload.thermoBuffer,
    source.sphParticleUpload.identityBuffer,source.mlsMpmParticleUpload.mechanicsBuffer,source.controlBuffer];
  assert.ok(!f.writes.some(w=>viewBuffers.includes(w.b)),'no physical payload upload');
  let complete;const after=new Promise(resolve=>{complete=resolve;}),retiring=source.retire(after);
  await Promise.resolve();assert.ok(viewBuffers.every(b=>b.destroyed===0));
  await assert.rejects(runSchroederResidualMechanicsLevelAssignment({device:f.device,source}),/original live/);
  complete(true);assert.equal(await retiring,true);
  assert.ok(viewBuffers.every(b=>b.destroyed===1));assert.equal(f.holder.history.buffer.destroyed,1);
  assert.equal(f.sph.stateBuffer.destroyed,1);assert.equal(f.mls.mechanicsBuffer.destroyed,1);
});

test('mechanics consumer authenticates exact rows and holds the projection through borrowed retirement',async()=>{
  const f=fixture(),source=f.make();
  await assert.rejects(bindSphExactMassResidualMechanicsSource({device:f.device,source:{...source}}),/original live/);
  const binding=await bindSphExactMassResidualMechanicsSource({device:f.device,source});
  await assert.rejects(bindSphExactMassResidualMechanicsSource({device:f.device,source}),/already/);
  const read=acquireSphParticleExactMassRead(binding.sphParticleUpload,f.device,binding);
  assert.equal(read.particleCount,source.particleCount);
  assert.equal(read.read.family.provenance.kind,'residual-mechanics-projection');
  assert.equal(read.energy,null);assert.equal(read.residualHistory,null);
  assert.throws(()=>acquireSphParticleExactMassRead({...binding.sphParticleUpload},f.device),/original live/);
  binding.destroy();f.close();
  await assert.rejects(source.retire(Promise.resolve(true)),/retained consumers/);
  assert.ok(validateSphParticleExactMassRead(read,{device:f.device,sourceSphUpload:binding.sphParticleUpload}));
  assert.equal(source.sphParticleUpload.stateBuffer.destroyed,0);
  await releaseSphParticleExactMassRead(read);await source.retire(Promise.resolve(true));
  assert.equal(source.sphParticleUpload.stateBuffer.destroyed,1);
  assert.equal(f.holder.history.buffer.destroyed,1);
  assert.equal(f.sph.stateBuffer.destroyed,1);
});

test('failed exact mechanics allocation releases its claim so the original source can retry',async()=>{
  const f=fixture(),source=f.make(),allocate=f.device.createBuffer;
  f.device.createBuffer=spec=>{
    if(spec.label==='ulg-exact-mass-residual-mechanics')throw new Error('mass allocation failed');
    return allocate(spec);
  };
  await assert.rejects(bindSphExactMassResidualMechanicsSource({device:f.device,source}),/mass allocation failed/);
  f.device.createBuffer=allocate;
  const binding=await bindSphExactMassResidualMechanicsSource({device:f.device,source});
  binding.destroy();f.close();await source.retire(Promise.resolve(true));
  assert.equal(source.sphParticleUpload.stateBuffer.destroyed,1);
  assert.equal(f.holder.history.buffer.destroyed,1);
});

test('mechanics view rejects forged source and failed fences, then retries retirement',async()=>{
  const f=fixture(),source=f.make();
  await assert.rejects(runSchroederResidualMechanicsLevelAssignment({device:f.device,source:{...source}}),/original live/);
  await assert.rejects(runSchroederResidualMechanicsLevelAssignment({device:{},source}),/original live/);
  assert.throws(()=>source.retire(),/batch fence/);
  await assert.rejects(source.retire(Promise.resolve(false)),/confirmed batch/);
  assert.equal(source.sphParticleUpload.stateBuffer.destroyed,0);
  await source.retire(Promise.resolve(true));f.close();
});

test('partial retirement retains inputs and retries only failed view storage',async()=>{
  const f=fixture(),source=f.make();f.close();
  const failed=source.sphParticleUpload.stateBuffer,other=source.sphParticleUpload.thermoBuffer;failed.failDestroy=true;
  await assert.rejects(source.retire(Promise.resolve(true)),/retirement failed/);
  assert.equal(f.holder.history.buffer.destroyed,0);assert.equal(f.sph.stateBuffer.destroyed,0);assert.equal(other.destroyed,1);
  failed.failDestroy=false;await source.retire(Promise.resolve(true));
  assert.equal(failed.destroyed,1);assert.equal(other.destroyed,1);assert.equal(f.holder.history.buffer.destroyed,1);
});

test('allocation and identity failures release partial view resources and original pins',async()=>{
  for(const mode of ['allocation','forged-history','forged-carrier']) {
    const f=fixture(),start=f.buffers.length,create=f.device.createBuffer.bind(f.device);
    if(mode==='allocation')f.device.createBuffer=spec=>{if(spec.label==='ulg-residual-mechanics-thermo')throw new Error('allocation failed');return create(spec);};
    let error;try{f.make(mode==='forged-history'?{history:{...f.holder.history}}:
      mode==='forged-carrier'?{sphParticleUpload:{...f.sph}}:{});}catch(e){error=e;}
    assert.ok(error);await error.residualSourceCleanup;f.close();
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(f.buffers.slice(start).every(b=>b.destroyed===1),mode);
    assert.equal(f.sph.stateBuffer.destroyed,1,mode);assert.equal(f.holder.history.buffer.destroyed,1,mode);
  }
});

test('source addressing is captured as data and cannot change across awaited classification',async()=>{
  const f=fixture(),buffer=f.sph.stateBuffer;
  Object.defineProperty(f.sph,'stateBuffer',{get(){return buffer;},configurable:true});
  assert.throws(()=>f.make(),/original data/);
  Object.defineProperty(f.sph,'stateBuffer',{value:buffer,writable:true,configurable:true});
  const source=f.make();
  Object.defineProperty(f.sph,'stateBuffer',{get(){return buffer;},configurable:true});
  await assert.rejects(runSchroederResidualMechanicsLevelAssignment({device:f.device,source}),/changed or retired/);
  Object.defineProperty(f.sph,'stateBuffer',{value:buffer,writable:true,configurable:true});
  await source.retire(Promise.resolve(true));f.close();
});

test('a failed final history release is retried before the mechanics view releases its carrier',async()=>{
  const f=fixture(),source=f.make();f.close();
  const failed=f.holder.history.buffer;failed.failDestroy=true;
  await assert.rejects(source.retire(Promise.resolve(true)),/retirement failed/);
  assert.equal(f.sph.stateBuffer.destroyed,0);
  failed.failDestroy=false;await source.retire(Promise.resolve(true));
  assert.equal(failed.destroyed,1);assert.equal(f.sph.stateBuffer.destroyed,1);
});

test('canonical residual thermal enrollment retains its combined energy through the last reader',async()=>{
  const f=fixture(),source=f.make();
  const binding=await bindSphExactMassResidualMechanicsSource({device:f.device,source,includeEnergy:true});
  const read=acquireSphParticleExactMassRead(binding.sphParticleUpload,f.device,binding);
  const energy=read.energy.energyBuffer;
  assert.equal(read.energy.rowCount,source.particleCount);
  assert.equal(read.energy.format,read.read.format);
  assert.equal(binding.physicalPublicationAdmitted,false);
  assert.ok(!f.writes.some(w=>w.b===energy),'energy comes from GPU owners, not a host seed');
  binding.destroy();f.close();assert.equal(energy.destroyed,0);
  await releaseSphParticleExactMassRead(read);await source.retire(Promise.resolve(true));
  assert.equal(energy.destroyed,1);assert.equal(f.holder.history.buffer.destroyed,1);
});

test('failed residual energy allocation releases admission so the original owner can retry',async()=>{
  const f=fixture(),source=f.make(),allocate=f.device.createBuffer;
  f.device.createBuffer=spec=>{if(spec.label==='ulg-residual-mechanics-energy')throw new Error('energy allocation failed');return allocate(spec);};
  await assert.rejects(bindSphExactMassResidualMechanicsSource({device:f.device,source,includeEnergy:true}),/energy allocation failed/);
  f.device.createBuffer=allocate;
  const binding=await bindSphExactMassResidualMechanicsSource({device:f.device,source,includeEnergy:true});
  binding.destroy();f.close();await source.retire(Promise.resolve(true));
  assert.equal(f.holder.history.buffer.destroyed,1);assert.equal(f.sph.stateBuffer.destroyed,1);
});
