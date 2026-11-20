import { createPeerComputeResidentAuthorityHost } from '../../src/runtime/peercomputeBrowserResidentHost.js';
import { createMlsMpmResidentStepsComputeTask, createMlsMpmResidentStepsCommitDelta,
  destroyMlsMpmResidentStepsBuffers } from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import { acquireSphParticleExactMassRead, releaseSphParticleExactMassRead } from '../../src/runtime/sph/sphGpuBuffers.js';
import { buildMlsMpmMechanicsMaterialTable } from '../../src/runtime/sph/sphMechanicsMaterialTable.js';
import { SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as H } from '../../src/runtime/sph/sphReactionResidualHistoryGpu.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';

export async function checkResidualResidentBatch({device,source,binding,levels,kind,receipt,check,data}) {
  const host = await createPeerComputeResidentAuthorityHost({enableWorkers:false,
    enablePersistence:false,disableNetworkProvider:true,disableBroadcast:true});
  const executions = [], reads = [];
  const fault = kind.endsWith('fault'), n = source.particleCount, L = source.phaseLayout.lineageCount;
  const rejectAdmission = kind.endsWith('commit-rejected');
  const scope = 'ulg-sph-resident-pass-dag', stateKey = `chain-${kind}`;
  let current = {...binding,nextParticleUploads:binding}, interval = 0;
  try {
    const original = acquireSphParticleExactMassRead(binding.sphParticleUpload,device,binding);
    reads.push(original);
    for (let batch = 0; batch < 2; batch++) {
      const taskId = `${stateKey}:${batch}`;
      const task = createMlsMpmResidentStepsComputeTask({
        modulePath:new URL('../../src/runtime/sph/sphMlsMpmGpuStep.js',import.meta.url).href,
        taskId, stateKey, commitDeltaScope:rejectAdmission ? `${scope}-unaccepted` : scope, commitDeltaStateKey:stateKey,
        laneId:`native:${stateKey}`, localExecution:'inline', stepCount:2,
        preferWebGpu:true, device, readbackMode:'no-full-readback', compactSummaryMode:'none',
        sphParticleState:current.sphParticleState, mlsMpmParticleState:current.mlsMpmParticleState,
        ...current.nextParticleUploads,
        schroederSpatialChain:{mechanicsLevels:levels,
          classificationPolicy:{baseGridSpacingM:0.5,targetSupportCells:1,supportRadiusScale:1,hysteresisBand:0}},
        forceInputs:{dt:0.001,gravityMPerS2:[0.25,-9.81,0.125],boxDimsM:[32,32,32],wallsEnabled:false,
          contactEnabled:false,cflFactor:0.4,wallBarrierElasticStiffnessNPerM:0,wallBarrierContactScale:1,wallBarrierMinGapM:0.0001},
        internalPressureScale:0, mechanicsMaterialTable:buildMlsMpmMechanicsMaterialTable({h2o:data.properties}),
        thermalMaterialTable:data.table, thermalResponseGraphUpload:data.upload,
        mechanicsOptions:{relaxation:0,normalVelocityDamping:0,cleanupPassBudget:1024},
        closureOptions:{thermalStepOptions:{wallRate:0,wallModel:'adiabatic',smoothingLengthM:0.5},
          timedStage:async(name,run) => {
            const stage = await run();
            if (name === 'thermalStep' && ++interval === 2 && fault) {
              const encoder = device.createCommandEncoder();
              check(encoder,`@group(0) @binding(0) var<storage,read_write> out:array<u32>;
@compute @workgroup_size(1) fn check(){out[0]=out[0]^1u;}`, [stage.exactEnergy.energyBuffer],1);
              device.queue.submit([encoder.finish()]);
            }
            return stage;
          }}
      });
      let result;
      try { result = await host.computeManager.submitTask(task); }
      catch(error) {
        if(!rejectAdmission || error.admission?.reason!=='scope-not-accepted'
          || !error.residentSequenceCleanupCompletion)throw error;
        if((await error.residentSequenceCleanupCompletion).status!=='resident-cleanup-complete')throw error;
        if(host.stateManager.getWarmDeltas(`${scope}-unaccepted`)[taskId])throw new Error('Rejected batch reached StateManager');
        const proof=device.createCommandEncoder();check(proof,`
@group(0) @binding(0) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(1) fn check(){atomicAdd(&receipt[25],1u);}`, [receipt],1);
        device.queue.submit([proof.finish()]);return;
      }
      executions.push(result);
      if(rejectAdmission)throw new Error('StateManager accepted a forbidden scope');
      const accepted = (batch+1)*2 - (fault?1:0), acceptedBatch = batch === 0 && fault ? 1 : 2;
      const warm = host.stateManager.getWarmDeltas(scope)[taskId];
      if (!warm || !result.computeExecution || result.gpuFence?.fenceSatisfied !== true
          || result.finalStep.computeTaskQueueFence?.hostQueueFencePerformed !== false
          || result.completedStepCount !== acceptedBatch || result.nextSphParticleState.step !== accepted
          || result.nextSphParticleState.time !== accepted*0.001
          || warm.version !== accepted || warm.payload.completedStepCount !== acceptedBatch
          || warm.payload.chainClock?.step !== accepted || warm.payload.chainClock?.time !== accepted*0.001
          || warm.payload.chainClock?.attemptedBatchStepCount !== 2
          || warm.payload.chainClock?.acceptedBatchStepCount !== acceptedBatch
          || warm.payload.retainedBufferRefs?.includes('sph-state-buffer') !== true) {
        throw new Error(`Real resident admission lost state/time: ${JSON.stringify({warm,
          keys:Object.keys(result),fence:result.gpuFence,completed:result.completedStepCount})}`);
      }
      let missingFenceRejected = false;
      try { destroyMlsMpmResidentStepsBuffers(result); }
      catch(error) { missingFenceRejected = /existing owner batch completion/.test(error.message); }
      if (!missingFenceRejected) throw new Error('Resident cleanup manufactured an unobserved fence');
      const previousStep = result.finalStep.step;
      result.finalStep.step++;
      let changedClockRejected = false;
      try { createMlsMpmResidentStepsCommitDelta(result); }
      catch(error) { changedClockRejected = /original state and accepted clock/.test(error.message); }
      result.finalStep.step = previousStep;
      if (!changedClockRejected) throw new Error('Changed resident clock reached a new commit delta');
      for (const [object,key,value] of [
        [result,'completedStepCount',result.completedStepCount+1],
        [result,'finalStep',{...result.finalStep}],
        [result.nextMlsMpmParticleState,'time',1],
        [result.nextParticleUploads.mlsMpmParticleUpload,'time',1],
        [result.nextParticleUploads.sphParticleUpload,'stateBuffer',binding.sphParticleUpload.stateBuffer]
      ]) {
        const previous=object[key];let rejected=false;
        try {object[key]=value;createMlsMpmResidentStepsCommitDelta(result);}
        catch {rejected=true;}
        finally {object[key]=previous;}
        if(!rejected)throw new Error(`Changed resident ${key} reached a new commit delta`);
      }
      destroyMlsMpmResidentStepsBuffers(result,{after:Promise.resolve(false)});
      let falseFenceRejected=false;
      try {await result.finalStep.residentCleanupCompletion;}
      catch(error){falseFenceRejected=/completion was not confirmed/.test(error.message);}
      if(!falseFenceRejected)throw new Error('Resident cleanup accepted a failed owner fence');
      // Refused cleanup must leave the original admitted tuple usable.
      createMlsMpmResidentStepsCommitDelta(result);
      const after = acquireSphParticleExactMassRead(result.nextParticleUploads.sphParticleUpload,device,result.nextParticleUploads);
      reads.push(after);
      const encoder = device.createCommandEncoder();
      check(encoder,`
${createSphExactMassWgsl(H.format)}
${createSphExactLedgerWgsl(H.format)}
@group(0) @binding(0) var<storage,read> old_mass:array<u32>;
@group(0) @binding(1) var<storage,read> mass:array<u32>;
@group(0) @binding(2) var<storage,read> old_energy:array<u32>;
@group(0) @binding(3) var<storage,read> energy:array<u32>;
@group(0) @binding(4) var<storage,read> state:array<f32>;
@group(0) @binding(5) var<storage,read> clock:array<u32>;
@group(0) @binding(6) var<storage,read_write> receipt:array<atomic<u32>>;
fn fail(bit:u32){atomicOr(&receipt[0],bit);}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
 let lineage=id.x;if(lineage>=${L}u){return;}
 if(lineage==0u){
   if(clock[2]!=${accepted}u || clock[3]!=${fault?1:0}u || clock[12]!=${(batch+1)*2}u){fail(4096u);}
   atomicStore(&receipt[11],clock[2]);atomicAdd(&receipt[12],2u);atomicAdd(&receipt[23],1u);
 }
 var m0=ExactMass();var m1=ExactMass();var e0=ExactMass();var e1=ExactMass();
 for(var lane=0u;lane<4u;lane++){
   let row=lane*${L}u+lineage;
   var a=ExactMass();var b=ExactMass();var u0=ExactMass();var u1=ExactMass();var s0=ExactMass();var s1=ExactMass();
   for(var w=0u;w<EM_WORDS;w++){
     a.words[w]=old_mass[(${original.read.rowOffset}u+row)*EM_WORDS+w];b.words[w]=mass[(${after.read.rowOffset}u+row)*EM_WORDS+w];
     u0.words[w]=old_energy[row*EM_WORDS+w];u1.words[w]=energy[row*EM_WORDS+w];
     s0.words[w]=old_energy[(row+${n}u)*EM_WORDS+w];s1.words[w]=energy[(row+${n}u)*EM_WORDS+w];
   }
   let ma=em_add(m0,a);let mb=em_add(m1,b);m0=ma.value;m1=mb.value;
   let ea=el_subtract(u0,s0);let eb=el_subtract(u1,s1);let sa=el_add(e0,ea.value);let sb=el_add(e1,eb.value);
   e0=sa.value;e1=sb.value;if((ma.error|mb.error|ea.error|eb.error|sa.error|sb.error)!=0u){fail(8192u);}
   if(!em_zero(b)){
     let v=vec3<f32>(state[row*8u+4u],state[row*8u+5u],state[row*8u+6u]);
     if(any(abs(v-vec3<f32>(0.25,-9.81,0.125)*0.001*f32(${accepted}u))>vec3<f32>(0.00002))){fail(16384u);}
   }
 }
 if(em_compare(m0,m1)!=0 || el_compare(e0,e1)!=0){fail(32768u);}else{atomicAdd(&receipt[13],1u);}
}`, [original.read.buffer,after.read.buffer,original.energy.energyBuffer,after.energy.energyBuffer,
        result.nextParticleUploads.sphParticleUpload.stateBuffer,after.residentClock.buffer,receipt],L);
      device.queue.submit([encoder.finish()]);
      current = {sphParticleState:result.nextSphParticleState,mlsMpmParticleState:result.nextMlsMpmParticleState,
        nextParticleUploads:result.nextParticleUploads};
    }
    const done = device.queue.onSubmittedWorkDone().then(() => true);
    for (const result of [...executions].reverse()) {
      destroyMlsMpmResidentStepsBuffers(result,{after:done});
      if ((await result.finalStep.residentCleanupCompletion).status !== 'resident-cleanup-complete') {
        throw new Error('Normal resident cleanup did not settle');
      }
      if(result.finalStep.residentCleanupError)throw new Error('Successful cleanup retained a stale failure');
    }
    for (const result of executions) if (result.nextParticleUploads.sphParticleUpload.destroyed === true) {
      throw new Error('Resident cleanup destroyed an externally retained physical read');
    }
    for (const read of reads.splice(0).reverse()) await releaseSphParticleExactMassRead(read);
    for (const result of executions) if (result.nextParticleUploads.sphParticleUpload.destroyed !== true) {
      throw new Error('Resident physical storage survived its last read');
    }
    const proof = device.createCommandEncoder();check(proof,`
@group(0) @binding(0) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(1) fn check(){atomicAdd(&receipt[24],1u);}`, [receipt],1);
    device.queue.submit([proof.finish()]);
  } finally {
    const done = device.queue.onSubmittedWorkDone().then(() => true);await done;
    for (const read of reads.reverse()) await releaseSphParticleExactMassRead(read);
    for (const result of executions.reverse()) {
      destroyMlsMpmResidentStepsBuffers(result,{after:done});
      await result.finalStep.residentCleanupCompletion;
    }
    await host.destroy();
  }
}
