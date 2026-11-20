import { runSchroederSpatialChainStepWebGpu } from '../../src/runtime/sph/schroederSpatialChainStepGpu.js';
import { acquireSphParticleExactMassRead,releaseSphParticleExactMassRead } from '../../src/runtime/sph/sphGpuBuffers.js';
import { buildMlsMpmMechanicsMaterialTable } from '../../src/runtime/sph/sphMechanicsMaterialTable.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as H } from '../../src/runtime/sph/sphReactionResidualHistoryGpu.js';
import { publishSchroederSpatialChainBatchWebGpu } from '../../src/runtime/sph/schroederSpatialChainPublicationGpu.js';

export async function checkResidualPhaseContinuation({device,source,binding,levels,kind,receipt,check,data}){
  const successors=[],reads=[],publications=[],references=[],pressureReceipts=[];let current={...binding,nextParticleUploads:binding};
  const publish=kind.includes('-publish-');
  const eos=kind.includes('-eos-'),pressureEnabled=eos&&!kind.includes('-eos-off-'),dt=eos?0.000001:0.001;
  const pressureImpulse=eos?device.createBuffer({label:'retained pressure impulse proof',size:16,usage:128|8}):null;
  const n=source.particleCount,L=source.phaseLayout.lineageCount,C=source.phaseLayout.carrierLineageCount;
  const fault=kind.endsWith('fault'),sourceFault=kind==='repeat-phase-source-fault',thermoFault=kind==='repeat-phase-thermo-fault';
  const writeFault=(buffer,word,value)=>{
    const encoder=device.createCommandEncoder();check(encoder,`
@group(0) @binding(0) var<storage,read_write> out:array<u32>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x==0u){out[${word}u]=${value};}}`,[buffer],1);device.queue.submit([encoder.finish()]);
  };
  try{
    reads.push(acquireSphParticleExactMassRead(binding.sphParticleUpload,device,binding));
    for(let step=0;step<3;step++){
      const rejected=fault && step===1;
      let phaseThermo=null;
      if(sourceFault)writeFault(source.controlBuffer,2,rejected?'4194304u':'0u');
      const options={device,retainForPublication:publish && step>=1,
        gasPressureMechanicsBoundaryEnabled:eos,ambientPressurePa:0,gasPressureMechanicsScale:pressureEnabled?1:0,
        sphParticleState:current.sphParticleState,mlsMpmParticleState:current.mlsMpmParticleState,
        ...current.nextParticleUploads,mechanicsLevels:levels,
        classificationPolicy:{baseGridSpacingM:0.5,targetSupportCells:1,supportRadiusScale:1,hysteresisBand:0},
        forceInputs:{dt,gravityMPerS2:[0.25,-9.81,0.125],boxDimsM:[32,32,32],wallsEnabled:false,contactEnabled:false,
          cflFactor:0.4,wallBarrierElasticStiffnessNPerM:0,wallBarrierContactScale:1,wallBarrierMinGapM:0.0001},
        internalPressureScale:0,mechanicsMaterialTable:buildMlsMpmMechanicsMaterialTable({h2o:data.properties}),
        thermalMaterialTable:data.table,thermalResponseGraphUpload:data.upload,
        mechanicsOptions:{relaxation:0,normalVelocityDamping:0,cleanupPassBudget:1024},
        closureOptions:{thermalStepOptions:{wallRate:0,wallModel:'adiabatic',smoothingLengthM:0.5},
          timedStage:async(name,run)=>{
            const stage=await run();
            if(name==='phaseCarrierTransfer')phaseThermo=stage.thermoBuffer;
            if(rejected && !sourceFault){
              if(thermoFault && name==='mechanicsRefresh')writeFault(phaseThermo,2,'0x7fc00000u');
              else if(!thermoFault && name==='thermalStep')writeFault(stage.exactEnergy.energyBuffer,0,'out[0]^1u');
            }
            return stage;
          }}};
      // First transfer creates genuine gas lanes from the original retained
      // products. Compare the next interval against pressure disabled while
      // preserving that exact particle/history/energy predecessor.
      const reference=eos&&step===1&&!rejected?await runSchroederSpatialChainStepWebGpu({...options,
        gasPressureMechanicsBoundaryEnabled:pressureEnabled,gasPressureMechanicsScale:0}):null;
      if(reference)references.push(reference);
      const next=await runSchroederSpatialChainStepWebGpu(options);
      if(eos)pressureReceipts.push(next.gasPressure);
      successors.push(next);
      const after=acquireSphParticleExactMassRead(next.nextParticleUploads.sphParticleUpload,device,next.nextParticleUploads);
      reads.push(after);
      if(after.particleCount!==n || after.residualMechanicsSource!==source || next.residentContinuationReady
        || next.sphParticleState.time!==(current.sphParticleState.time??0)
        || next.assignment.sourceStateBuffer!==current.nextParticleUploads.sphParticleUpload.stateBuffer){
        throw new Error('Repeated phase chain lost fixed-capacity private GPU state');
      }
      const before=reads[step],a=current.nextParticleUploads,b=next.nextParticleUploads;
      const encoder=device.createCommandEncoder();
      if(eos){
        encoder.clearBuffer(pressureImpulse);
        // The original EOS boundary law books traction as an external source.
        // Compare P_after - P_before with gravity plus that actual GPU ledger;
        // this does not claim a closed-atmosphere reciprocal pressure proof.
        if(!rejected)for(const native of next.correction.nativeStates)check(encoder,`
@group(0) @binding(0) var<storage,read> field:array<u32>;
@group(0) @binding(1) var<storage,read_write> impulse:array<f32>;
@compute @workgroup_size(1) fn check(){
 for(var row=0u;row<field[34];row++){
   let at=field[28]+row*8u;
   for(var axis=0u;axis<3u;axis++){impulse[axis]+=bitcast<f32>(field[at+4u+axis]);}
 }
}`, [native.fieldView.fieldViewBuffer,pressureImpulse],1);
      }
      check(encoder,`
${createSphExactMassWgsl(H.format)}
${createSphExactLedgerWgsl(H.format)}
@group(0) @binding(0) var<storage,read> old_mass:array<u32>;
@group(0) @binding(1) var<storage,read> mass:array<u32>;
@group(0) @binding(2) var<storage,read> old_energy:array<u32>;
@group(0) @binding(3) var<storage,read> energy:array<u32>;
@group(0) @binding(4) var<storage,read> control:array<u32>;
@group(0) @binding(5) var<storage,read> clock:array<u32>;
@group(0) @binding(6) var<storage,read> state:array<u32>;
@group(0) @binding(7) var<storage,read_write> receipt:array<atomic<u32>>;
fn fail(bit:u32){atomicOr(&receipt[0],bit);}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
 let lineage=id.x;if(lineage>=${L}u){return;}
 if(lineage==0u){
   atomicStore(&receipt[8u+${step}u],control[2]);atomicStore(&receipt[11],clock[2]);
   if(control[0]!=0x53434331u || control[1]!=${rejected?5:3}u || (control[2]!=0u)!=${rejected}
     || clock[0]!=0x53434c31u || clock[2]!=${step+1-(fault&&step>=1?1:0)}u || clock[3]!=${fault&&step>=1?1:0}u
     || clock[10]!=${rejected?0:1}u){fail(4096u);}
   atomicAdd(&receipt[12],1u);
 }
 var m0=ExactMass();var m1=ExactMass();var e0=ExactMass();var e1=ExactMass();var occupancy=0u;
 for(var lane=0u;lane<4u;lane++){
   let row=lane*${L}u+lineage;
   var a=ExactMass();var b=ExactMass();var u0=ExactMass();var u1=ExactMass();var s0=ExactMass();var s1=ExactMass();
   for(var w=0u;w<EM_WORDS;w++){
     a.words[w]=old_mass[(${before.read.rowOffset}u+row)*EM_WORDS+w];b.words[w]=mass[(${after.read.rowOffset}u+row)*EM_WORDS+w];
     u0.words[w]=old_energy[row*EM_WORDS+w];u1.words[w]=energy[row*EM_WORDS+w];
     s0.words[w]=old_energy[(row+${n}u)*EM_WORDS+w];s1.words[w]=energy[(row+${n}u)*EM_WORDS+w];
     if(${rejected} && (a.words[w]!=b.words[w] || u0.words[w]!=u1.words[w] || s0.words[w]!=s1.words[w])){fail(8192u);}
   }
   let ma=em_add(m0,a);let mb=em_add(m1,b);m0=ma.value;m1=mb.value;
   let ea=el_subtract(u0,s0);let eb=el_subtract(u1,s1);let sa=el_add(e0,ea.value);let sb=el_add(e1,eb.value);
   e0=sa.value;e1=sb.value;if((ma.error|mb.error|ea.error|eb.error|sa.error|sb.error)!=0u){fail(16384u);}
   if(!em_zero(b)){
     occupancy|=1u<<lane;
     let v=vec3<f32>(bitcast<f32>(state[row*8u+4u]),bitcast<f32>(state[row*8u+5u]),bitcast<f32>(state[row*8u+6u]));
     let expected=vec3<f32>(0.25,-9.81,0.125)*${dt}*f32(${step+1-(fault&&step>=1?1:0)}u);
     if(!${pressureEnabled} && any(abs(v-expected)>vec3<f32>(0.00002))){fail(32768u);}
     if(any(abs(v)>vec3<f32>(3.402823e38)) || any(v!=v)){fail(32768u);}
   }
 }
 if(em_compare(m0,m1)!=0 || el_compare(e0,e1)!=0){fail(65536u);}else{atomicAdd(&receipt[13],1u);}
 let expected=select(2u,${kind.includes('fusion')?3:6}u,lineage>=${C}u);
 if(occupancy!=select(0u,expected,lineage<${C+4}u)){fail(131072u);}
}`, [before.read.buffer,after.read.buffer,before.energy.energyBuffer,after.energy.energyBuffer,
        next.admissionControlBuffer,next.clock.buffer,b.sphParticleUpload.stateBuffer,receipt],L);
      if(eos)check(encoder,`
@group(0) @binding(0) var<storage,read> state:array<f32>;
@group(0) @binding(1) var<storage,read> reference:array<u32>;
@group(0) @binding(2) var<storage,read_write> receipt:array<atomic<u32>>;
@group(0) @binding(3) var<storage,read> before:array<f32>;
@group(0) @binding(4) var<storage,read> impulse:array<f32>;
@compute @workgroup_size(1) fn check(){
 var momentum=vec3<f32>(0.0);var old_momentum=vec3<f32>(0.0);var mass=0.0;var magnitude=0.0;var changed=0u;
 for(var row=0u;row<${n}u;row++){
   old_momentum+=before[row*8u+3u]*vec3<f32>(before[row*8u+4u],before[row*8u+5u],before[row*8u+6u]);
 }
 for(var row=0u;row<${n}u;row++){
   let m=state[row*8u+3u];if(m<=0.0){continue;}
   let v=vec3<f32>(state[row*8u+4u],state[row*8u+5u],state[row*8u+6u]);
   mass+=m;momentum+=m*v;magnitude+=m*length(v);
   if(${Boolean(reference)}){for(var w=4u;w<7u;w++){
     if(bitcast<u32>(state[row*8u+w])!=reference[row*8u+w]){changed++;}}}
 }
 let expected=old_momentum+vec3<f32>(impulse[0],impulse[1],impulse[2])
   +mass*vec3<f32>(0.25,-9.81,0.125)*${rejected?0:dt};
 let residual=length(momentum-expected);let tolerance=max(1e-10,3e-5*magnitude);
 atomicStore(&receipt[26u+${step}u],bitcast<u32>(residual));
 atomicStore(&receipt[29u+${step}u],bitcast<u32>(tolerance));
 if(any(abs(momentum-expected)>vec3<f32>(tolerance))){atomicOr(&receipt[0],1048576u);}
 if(${Boolean(reference)}){
   atomicStore(&receipt[24],changed);atomicAdd(&receipt[25],1u);
   if((changed>0u)!=${pressureEnabled}){atomicOr(&receipt[0],2097152u);}
 }
 atomicAdd(&receipt[23],1u);
}`, [b.sphParticleUpload.stateBuffer,(reference??next).nextParticleUploads.sphParticleUpload.stateBuffer,receipt,
      a.sphParticleUpload.stateBuffer,pressureImpulse],1);
      if(rejected)for(const [oldBuffer,newBuffer]of [[a.sphParticleUpload.stateBuffer,b.sphParticleUpload.stateBuffer],
        [a.sphParticleUpload.thermoBuffer,b.sphParticleUpload.thermoBuffer],
        [a.mlsMpmParticleUpload.mechanicsBuffer,b.mlsMpmParticleUpload.mechanicsBuffer]])check(encoder,`
@group(0) @binding(0) var<storage,read> before:array<u32>;
@group(0) @binding(1) var<storage,read> after:array<u32>;
@group(0) @binding(2) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x<arrayLength(&before) && before[id.x]!=after[id.x]){atomicOr(&receipt[0],262144u);}}
`,[oldBuffer,newBuffer,receipt],oldBuffer.size/4);
      device.queue.submit([encoder.finish()]);current=next;
      if(publish && step>=1){
        if(kind.endsWith('clock-corrupt')){
          writeFault(next.clock.buffer,0,'0u');
          let rejected=false;
          try{await publishSchroederSpatialChainBatchWebGpu({device,finalStep:next});}
          catch(error){rejected=/terminal state\/clock receipt/.test(error.message);}
          if(!rejected || next.sphParticleState.time!==0)throw new Error('Corrupt batch clock was admitted');
          const proof=device.createCommandEncoder();check(proof,`
@group(0) @binding(0) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(1) fn check(){atomicAdd(&receipt[21],1u);}`, [receipt],1);
          device.queue.submit([proof.finish()]);break;
        }
        let cloneRejected=false,replayRejected=false;
        try{await publishSchroederSpatialChainBatchWebGpu({device,finalStep:{...next}});}catch{cloneRejected=true;}
        const result=await publishSchroederSpatialChainBatchWebGpu({device,finalStep:next});publications.push(result);
        try{await publishSchroederSpatialChainBatchWebGpu({device,finalStep:next});}catch{replayRejected=true;}
        const accepted=step+1-(fault?1:0);
        if(!cloneRejected || !replayRejected || !result.publication.published || result.stateManagerCommitted
          || result.sphParticleState.step!==accepted || result.sphParticleState.time!==accepted*dt
          || result.clockReceipt.readbackBytes!==128 || result.clockReceipt.mapAsyncCount!==1
          || result.clockReceipt.acceptedStepCount!==(step===1?accepted:1)
          || result.nextParticleUploads.sphParticleUpload.stateBuffer!==next.nextParticleUploads.sphParticleUpload.stateBuffer
          || result.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer!==next.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer){
          throw new Error('Chain batch publication lost accepted time, original buffers or one-use authority');
        }
        const proof=device.createCommandEncoder();check(proof,`
@group(0) @binding(0) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(1) fn check(){atomicAdd(&receipt[20],1u);}`, [receipt],1);
        device.queue.submit([proof.finish()]);current=result;
        if(step===1){
          // The next batch must survive retirement of all private producers
          // from the preceding one, using the published owner's retained refs.
          const batchDone=device.queue.onSubmittedWorkDone().then(()=>true);
          await batchDone;
          await releaseSphParticleExactMassRead(reads[1]);
          // The A/B branch deliberately borrowed the same predecessor. Its
          // comparison has now completed, so retire that test-owned consumer
          // before proving the production publication released intermediates.
          for(const reference of references.splice(0).reverse())await reference.retire(batchDone);
          for(const previous of [...successors].reverse())await previous.retire(batchDone);
          if(successors[0].nextParticleUploads.sphParticleUpload.destroyed!==true){
            throw new Error('Published successor retained an intermediate physical predecessor');
          }
          const retired=device.createCommandEncoder();check(retired,`
@group(0) @binding(0) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(1) fn check(){atomicAdd(&receipt[22],1u);}`, [receipt],1);
          device.queue.submit([retired.finish()]);
        }
      }
    }
  }finally{
    const done=device.queue.onSubmittedWorkDone().then(()=>true);await done;
    for(const read of reads.reverse())await releaseSphParticleExactMassRead(read);
    for(const published of publications.reverse())await published.retire(done);
    for(const next of successors.reverse())await next.retire(done);
    for(const reference of references.reverse())await reference.retire(done);
    pressureImpulse?.destroy();
    if(eos && pressureReceipts.some(p=>!p?.submitted || !p.retired || p.nativeConsumerCount!==levels.length
      || p.mapAsyncCount!==0 || p.hostQueueFenceCount!==0 || p.fullParticleReadbackPerformed)){
      throw new Error('Retained-product pressure lost original consumers or retirement');
    }
  }
}
