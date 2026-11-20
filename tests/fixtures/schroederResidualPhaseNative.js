import { createSchroederResidualPhaseMechanicsSource, borrowSchroederResidualMechanicsSource,
  runSchroederResidualMechanicsLevelAssignment } from '../../src/runtime/sph/schroederResidualMechanicsSourceGpu.js';
import { bindSphExactMassResidualMechanicsSource, acquireSphParticleExactMassRead,
  releaseSphParticleExactMassRead } from '../../src/runtime/sph/sphGpuBuffers.js';
import { runSchroederSpatialEpochGenerationWebGpu, releaseSchroederSpatialEpochGenerationAfterQueue }
  from '../../src/runtime/sph/schroederSpatialEpochGpu.js';
import { runSchroederSpatialChainMechanicsWebGpu } from '../../src/runtime/sph/schroederSpatialChainMechanicsGpu.js';
import { abortSchroederSpatialEpochTransaction } from '../../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as H } from '../../src/runtime/sph/sphReactionResidualHistoryGpu.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { buildMlsMpmMechanicsMaterialTable } from '../../src/runtime/sph/sphMechanicsMaterialTable.js';
import { runSphPhaseCarrierTransferWebGpu, resolveSphPhaseCarrierTransferSourceCapture }
  from '../../src/runtime/sph/sphPhaseCarrierTransferGpu.js';
import { runResidualThermalFixture } from './schroederResidualThermalNative.js';
import { checkResidualPhaseContinuation } from './schroederResidualPhaseContinuationNative.js';

// All numerical inspection stays on the GPU. This fixture contributes only
// verdicts and counts to its caller's existing fixed 128-byte receipt.
export async function checkResidualPhaseMaterialization({device,sph,mls,history,levels,kind,receipt,check,make,data}){
  let source,original,binding,read,assignment,generation,mechanics,thermal,phase,seal,failure;
  try{
    source=await createSchroederResidualPhaseMechanicsSource({device,sphParticleUpload:sph,
      mlsMpmParticleUpload:mls,history,smoothingLengthM:0.5});
    original=borrowSchroederResidualMechanicsSource(source,{device});
    binding=await bindSphExactMassResidualMechanicsSource({device,source,includeEnergy:true});
    read=acquireSphParticleExactMassRead(binding.sphParticleUpload,device,binding);
    const {carrierLineageCount:C,carrierLaneCount:lanes,lineageCount:L}=source.phaseLayout;
    const n=source.particleCount,W=H.format.wordCount;
    let encoder=device.createCommandEncoder();
    check(encoder,`
@group(0) @binding(0) var<storage,read> state:array<u32>;
@group(0) @binding(1) var<storage,read> thermo:array<u32>;
@group(0) @binding(2) var<storage,read> mechanics:array<u32>;
@group(0) @binding(3) var<storage,read> identity:array<u32>;
@group(0) @binding(4) var<storage,read> old_s:array<u32>;
@group(0) @binding(5) var<storage,read> old_t:array<u32>;
@group(0) @binding(6) var<storage,read> old_m:array<u32>;
@group(0) @binding(7) var<storage,read> old_i:array<u32>;
@group(0) @binding(8) var<storage,read> history:array<u32>;
@group(0) @binding(9) var<storage,read> control:array<u32>;
@group(0) @binding(10) var<storage,read_write> receipt:array<atomic<u32>>;
fn fail(){atomicOr(&receipt[0],1024u);}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
 let row=id.x;if(row>=${n}u){return;}
 let lane=row/${L}u;let lineage=row%${L}u;
 if(row==0u && control[2]!=0u){fail();}
 if(lineage<${C}u && lane<${lanes}u){
   let old=lane*${C}u+lineage;
   for(var w=0u;w<8u;w++){if(state[row*8u+w]!=old_s[old*8u+w]){fail();}}
   for(var w=0u;w<12u;w++){if(thermo[row*12u+w]!=old_t[old*12u+w]){fail();}}
   for(var w=0u;w<32u;w++){if(mechanics[row*32u+w]!=old_m[old*32u+w]){fail();}}
   if(identity[row]!=old_i[old]){fail();}
 }else if(lineage>=${C}u && lineage<${C}u+history[3] && lane==0u){
   let h=${H.headerWords}u+(lineage-${C}u)*${H.rowWords}u;
   for(var w=0u;w<8u;w++){if(state[row*8u+w]!=history[h+${H.stateOffset}u+w]){fail();}}
   for(var w=0u;w<12u;w++){if(thermo[row*12u+w]!=history[h+${H.thermoOffset}u+w]){fail();}}
   for(var w=0u;w<32u;w++){if(mechanics[row*32u+w]!=history[h+${H.mechanicsOffset}u+w]){fail();}}
   if(identity[row]!=203u+lineage-${C}u){fail();}
 }else if(lineage<${C}u+history[3]){
   if(identity[row]!=identity[lineage]){fail();}
   for(var w=0u;w<8u;w++){
     let zero=w>=3u && w<=6u;if(state[row*8u+w]!=select(state[lineage*8u+w],0u,zero)){fail();}}
   for(var w=0u;w<12u;w++){
     if(thermo[row*12u+w]!=select(thermo[lineage*12u+w],0u,w>=9u)){fail();}}
   for(var w=0u;w<32u;w++){
     let zero=w==19u || w==21u || w==27u || w==31u;
     if(mechanics[row*32u+w]!=select(mechanics[lineage*32u+w],0u,zero)){fail();}}
 }else{
   for(var w=0u;w<8u;w++){if(state[row*8u+w]!=0u){fail();}}
   if(identity[row]!=0u){fail();}
 }
}`, [source.sphParticleUpload.stateBuffer,source.sphParticleUpload.thermoBuffer,source.mlsMpmParticleUpload.mechanicsBuffer,
      source.sphParticleUpload.identityBuffer,sph.stateBuffer,sph.thermoBuffer,mls.mechanicsBuffer,sph.identityBuffer,
      history.buffer,source.controlBuffer,receipt],n);
    check(encoder,`
@group(0) @binding(0) var<storage,read> mass:array<u32>;
@group(0) @binding(1) var<storage,read> energy:array<u32>;
@group(0) @binding(2) var<storage,read> old_mass:array<u32>;
@group(0) @binding(3) var<storage,read> old_energy:array<u32>;
@group(0) @binding(4) var<storage,read> history:array<u32>;
@group(0) @binding(5) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
 let row=id.x;if(row>=${n}u){return;}let lane=row/${L}u;let lineage=row%${L}u;
 for(var w=0u;w<${W}u;w++){
   var m=0u;var u=0u;var s=0u;
   if(lineage<${C}u && lane<${lanes}u){let old=lane*${C}u+lineage;
     m=old_mass[(${original.carrier.read.rowOffset}u+old)*${W}u+w];
     u=old_energy[old*${W}u+w];s=old_energy[(old+${source.carrierCount}u)*${W}u+w];
   }else if(lineage>=${C}u && lineage<${C}u+history[3] && lane==0u){
     let h=${H.headerWords}u+(lineage-${C}u)*${H.rowWords}u;
     m=history[h+${H.massOffset}u+w];u=history[h+${H.energyOffset}u+w];s=history[h+${H.sourceOffset}u+w];}
   if(mass[row*${W}u+w]!=m || energy[row*${W}u+w]!=u || energy[(row+${n}u)*${W}u+w]!=s){
     atomicOr(&receipt[0],2048u);}
 }
}`, [read.read.buffer,read.energy.energyBuffer,original.carrier.read.buffer,original.carrierEnergy.energyBuffer,history.buffer,receipt],n);
    const beforeMass=make('phase original exact mass',read.read.buffer.size);
    const beforeEnergy=make('phase original exact energy',read.energy.energyBuffer.size);
    encoder.copyBufferToBuffer(read.read.buffer,0,beforeMass,0,beforeMass.size);
    encoder.copyBufferToBuffer(read.energy.energyBuffer,0,beforeEnergy,0,beforeEnergy.size);
    device.queue.submit([encoder.finish()]);
    if(kind.startsWith('repeat-phase')){
      if(kind.includes('-resident-')){
        const {checkResidualResidentBatch}=await import('./schroederResidualResidentBatchNative.js');
        await checkResidualResidentBatch({device,source,binding,levels,kind,receipt,check,data});
      }else await checkResidualPhaseContinuation({device,source,binding,levels,kind,receipt,check,data});
      return;
    }
    assignment=await runSchroederResidualMechanicsLevelAssignment({device,source,baseGridSpacingM:0.5,
      minLevel:0,maxLevel:2,targetSupportCells:1,supportRadiusScale:1});
    generation=runSchroederSpatialEpochGenerationWebGpu({device,levelAssignment:assignment,particleCount:n,
      particleIdentityBuffer:source.sphParticleUpload.identityBuffer,particleIdentityStrideWords:1,mechanicsLevels:levels});
    if(!generation.ready)throw new Error(generation.reason);
    mechanics=await runSchroederSpatialChainMechanicsWebGpu({device,source:binding,generation,mechanicsLevels:levels,
      forceInputs:{dt:0.001,gravityMPerS2:[0,0,0],boxDimsM:[32,32,32],wallsEnabled:false,contactEnabled:false,
        cflFactor:0.4,wallBarrierElasticStiffnessNPerM:0,wallBarrierContactScale:1,wallBarrierMinGapM:0.0001},
      internalPressureScale:0,mechanicsOptions:{relaxation:0,normalVelocityDamping:0,cleanupPassBudget:1024}});
    thermal=await runResidualThermalFixture({device,binding,mechanics,generation,data,kind});
    const token={};
    phase=await runSphPhaseCarrierTransferWebGpu({device,sphParticleState:binding.sphParticleState,
      mlsMpmParticleState:binding.mlsMpmParticleState,thermalMaterialTable:data.table,
      mechanicsMaterialTable:buildMlsMpmMechanicsMaterialTable({h2o:data.properties}),
      phaseCarrierPlan:source.phaseLayout.plan,sourceStateBuffer:thermal.result.stateBuffer,
      sourceThermoBuffer:thermal.result.thermoBuffer,sourceMechanicsBuffer:mechanics.g2p.mechanicsBuffer,
      retainOutputParticleBuffers:true,readbackMode:'no-full-readback',postMechanicsSourceCapture:token,
      exactLedger:{thermalSeal:thermal.seal,sourceRead:read},queueOrderedProducerClaims:[thermal.result.queueOrderedCleanupClaim]});
    seal=resolveSphPhaseCarrierTransferSourceCapture(phase,token);seal.validate();
    const ledger=seal.exactLedgerPhase;
    encoder=device.createCommandEncoder();
    check(encoder,`
${createSphExactMassWgsl(H.format)}
${createSphExactLedgerWgsl(H.format)}
@group(0) @binding(0) var<storage,read> old_mass:array<u32>;
@group(0) @binding(1) var<storage,read> old_energy:array<u32>;
@group(0) @binding(2) var<storage,read> mass:array<u32>;
@group(0) @binding(3) var<storage,read> energy:array<u32>;
@group(0) @binding(4) var<storage,read> state:array<u32>;
@group(0) @binding(5) var<storage,read> thermo:array<u32>;
@group(0) @binding(6) var<storage,read> mechanics:array<u32>;
@group(0) @binding(7) var<storage,read> history:array<u32>;
@group(0) @binding(8) var<storage,read> g2p:array<u32>;
@group(0) @binding(9) var<storage,read> phase:array<u32>;
@group(0) @binding(10) var<storage,read_write> receipt:array<atomic<u32>>;
fn fail(bit:u32){atomicOr(&receipt[0],bit);}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
 let lineage=id.x;if(lineage>=${L}u){return;}
 if(lineage==0u){
   atomicStore(&receipt[10],g2p[1]);atomicStore(&receipt[11],g2p[2]);
   if(g2p[1]!=3u || g2p[2]!=0u){fail(4096u);}
   atomicStore(&receipt[12],energy[${2*n*W}u]);
   if(energy[${2*n*W}u]!=0u){fail(8192u);}
   atomicStore(&receipt[13],phase[0]);atomicStore(&receipt[14],phase[1]);
   if(phase[0]!=0x50544631u || phase[1]!=1u || phase[2]!=0u || phase[3]!=${L}u || phase[6]!=0u){fail(1048576u);}
 }
 var m0=ExactMass();var m1=ExactMass();var e0=ExactMass();var e1=ExactMass();var occupied=0u;
 for(var lane=0u;lane<4u;lane++){
   let row=lane*${L}u+lineage;
   var a=ExactMass();var b=ExactMass();var u0=ExactMass();var u1=ExactMass();var s0=ExactMass();var s1=ExactMass();
   for(var w=0u;w<EM_WORDS;w++){
     a.words[w]=old_mass[row*EM_WORDS+w];b.words[w]=mass[(${ledger.carrierMassRead.rowOffset}u+row)*EM_WORDS+w];
     u0.words[w]=old_energy[row*EM_WORDS+w];s0.words[w]=old_energy[(row+${n}u)*EM_WORDS+w];
     u1.words[w]=energy[row*EM_WORDS+w];s1.words[w]=energy[(row+${n}u)*EM_WORDS+w];}
   let ma=em_add(m0,a);let mb=em_add(m1,b);m0=ma.value;m1=mb.value;
   let ea=el_subtract(u0,s0);let eb=el_subtract(u1,s1);let sa=el_add(e0,ea.value);let sb=el_add(e1,eb.value);
   e0=sa.value;e1=sb.value;if((ma.error|mb.error|ea.error|eb.error|sa.error|sb.error)!=0u){fail(16384u);}
   let projected=em_project_f32_bits(b);
   if(projected.error!=0u || state[row*8u+3u]!=projected.bits){fail(32768u);}
   if(!em_zero(b)){
     occupied|=1u<<lane;
     if(u32(bitcast<f32>(thermo[row*12u+1u]))!=lane+1u){fail(65536u);}
     for(var w=0u;w<32u;w++){if((mechanics[row*32u+w]&0x7f800000u)==0x7f800000u){fail(131072u);}}
   }
 }
 if(em_compare(m0,m1)!=0 || el_compare(e0,e1)!=0){fail(262144u);}
 else{atomicAdd(&receipt[15],1u);}
 let live=lineage<${C}u+history[3];
 let expected=select(2u,${kind==='phase-fusion'?3:kind==='phase-vapor'?6:2}u,lineage>=${C}u);
 if(occupied!=select(0u,expected,live)){fail(524288u);}
 if(lineage>=${C}u && live && occupied==expected){atomicAdd(&receipt[16],1u);}
}`, [beforeMass,beforeEnergy,ledger.carrierMassRead.buffer,ledger.exactEnergy.energyBuffer,
      phase.stateBuffer,phase.thermoBuffer,phase.mechanicsBuffer,history.buffer,mechanics.g2p.controlBuffer,
      seal.phaseValidationBuffer,receipt],L);
    device.queue.submit([encoder.finish()]);
  }catch(error){
    failure=error;
    throw error;
  }finally{
    // Fixture teardown only, after the complete GPU sequence. No intermediate
    // observation selects work or changes the production timestep.
    await device.queue.onSubmittedWorkDone();
    seal?.release();phase?.destroyOutputParticleBuffers();thermal?.destroy();
    mechanics?.g2p.destroyOutputParticleBuffers();
    if(mechanics){
      for(const p of mechanics.proposals)if(!p.released)await p.releaseAfterSubmittedWork();
      await mechanics.composite.releaseExecutionAfter(mechanics.execution);mechanics.composite.destroy();
      abortSchroederSpatialEpochTransaction(mechanics.transaction);
    }
    if(generation && releaseSchroederSpatialEpochGenerationAfterQueue(generation,device))await generation.releasePromise;
    assignment?.destroyAssignmentBuffer();
    if(read)await releaseSphParticleExactMassRead(read);
    binding?.destroy();original?.release();
    if(source)try{await source.retire(Promise.resolve(true));}catch(cleanupError){
      if(failure)throw new AggregateError([failure,cleanupError],
        `Residual phase failed: ${failure.stack}; teardown also failed: ${cleanupError.message}`);
      throw cleanupError;
    }
  }
}
