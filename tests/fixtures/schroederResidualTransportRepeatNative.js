import { createSchroederResidualMechanicsSource, runSchroederResidualMechanicsLevelAssignment,
  borrowSchroederResidualMechanicsSource } from '../../src/runtime/sph/schroederResidualMechanicsSourceGpu.js';
import { runSchroederSpatialEpochGenerationWebGpu, releaseSchroederSpatialEpochGenerationAfterQueue }
  from '../../src/runtime/sph/schroederSpatialEpochGpu.js';
import { SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as H } from '../../src/runtime/sph/sphReactionResidualHistoryGpu.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { checkResidualMechanicsMotion } from './schroederResidualMechanicsMotionNative.js';

// Three fixed attempts, one final 128-byte receipt, no per-step observation.
// This is a private mechanics/transport proof, not complete interval admission.
export async function checkResidualTransportRepeat({device,source,generation,levels,kind,receipt,check,make,sph,mls,thermalData=null}) {
  const stages=[],cleanup=[];let current=source,currentGeneration=generation;
  const original=borrowSchroederResidualMechanicsSource(source,{device});
  try {
    for(let step=0;step<3;step++){
      const fault=kind.endsWith('fault') && step===1;
      const verdict=make('fixed repeated transport verdict',128);
      const stage=await checkResidualMechanicsMotion({device,source:current,generation:currentGeneration,levels,
        kind:thermalData?(fault?'thermal-ledger-fault':'thermal-pair'):(fault?'transport-quantum':'positive-heat'),
        receipt:verdict,check,rejected:false,transport:true,make,retain:true,thermalData});
      stages.push(stage);
      cleanup.push(()=>stage.releaseAfter(Promise.resolve(true)));
      const enc=device.createCommandEncoder();
      check(enc,`
@group(0) @binding(0) var<storage,read> step:array<u32>;
@group(0) @binding(1) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x!=0u){return;}atomicOr(&receipt[0],step[0]);atomicAdd(&receipt[22],1u);
 if((step[20]!=0u)!=${fault}){atomicOr(&receipt[0],1048576u);}
 if(step[20]==0u){atomicAdd(&receipt[23],1u);}else{atomicAdd(&receipt[24],1u);}
 if(${Boolean(thermalData)}){
   atomicStore(&receipt[${8+step}],step[0]);atomicStore(&receipt[${11+step}],step[27]);
   atomicStore(&receipt[${14+step}],step[28]);atomicStore(&receipt[${17+step}],step[31]);
   if(step[29]!=1u || (!${fault} && (step[27]!=step[21] || step[28]!=${source.carrierCount}u))){atomicOr(&receipt[0],1048576u);}
   atomicAdd(&receipt[29],step[29]);
 }
}`, [verdict,receipt],1);
      // Recycle the caller's temporary verdict before the next projection.
      // The genuine history must retain the finalized accept/reject decision.
      enc.clearBuffer(stage.historyControl);device.queue.submit([enc.finish()]);
      if(step===2)break;
      current=createSchroederResidualMechanicsSource({device,sphParticleUpload:sph,mlsMpmParticleUpload:mls,
        history:stage.history,transported:stage.transported,smoothingLengthM:0.5});
      const entry={source:current};
      cleanup.push(async()=>{
        if(entry.generation && releaseSchroederSpatialEpochGenerationAfterQueue(entry.generation,device))await entry.generation.releasePromise;
        entry.assignment?.destroyAssignmentBuffer();await entry.source.retire(Promise.resolve(true));
      });
      entry.assignment=await runSchroederResidualMechanicsLevelAssignment({device,source:current,baseGridSpacingM:0.5,
        minLevel:0,maxLevel:2,targetSupportCells:1,supportRadiusScale:1});
      currentGeneration=runSchroederSpatialEpochGenerationWebGpu({device,levelAssignment:entry.assignment,
        particleCount:current.particleCount,particleIdentityBuffer:current.sphParticleUpload.identityBuffer,
        particleIdentityStrideWords:1,mechanicsLevels:levels});entry.generation=currentGeneration;
      if(!currentGeneration.ready)throw new Error(currentGeneration.reason);
    }
    const final=stages.at(-1),n=source.carrierCount,accepted=kind.endsWith('fault')?2:3;
    const enc=device.createCommandEncoder();
    check(enc,`
${createSphExactMassWgsl(H.format)}
${createSphExactLedgerWgsl(H.format)}
@group(0) @binding(0) var<storage,read> original_s:array<u32>;
@group(0) @binding(1) var<storage,read> final_s:array<u32>;
@group(0) @binding(2) var<storage,read> original_e:array<u32>;
@group(0) @binding(3) var<storage,read> final_e:array<u32>;
@group(0) @binding(4) var<storage,read> original_h:array<u32>;
@group(0) @binding(5) var<storage,read> final_h:array<u32>;
@group(0) @binding(6) var<storage,read_write> receipt:array<atomic<u32>>;
fn old_word(row:u32,w:u32)->u32{
 if(row<${n}u){return original_s[row*8u+w];}
 return original_h[${H.headerWords}u+(row-${n}u)*${H.rowWords}u+${H.stateOffset}u+w];
}
fn new_word(row:u32,w:u32)->u32{
 if(row<${n}u){return final_s[row*8u+w];}
 return final_h[${H.headerWords}u+(row-${n}u)*${H.rowWords}u+${H.stateOffset}u+w];
}
fn fail(){atomicOr(&receipt[0],2097152u);}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
 let row=id.x;if(row>=${n}u+original_h[3]){return;}
 if(row==0u && (final_h[3]!=original_h[3] || final_h[6]!=original_h[6]+3u)){fail();}
 let g=vec3<f32>(0.25,-9.81,0.125);let steps=${accepted}.0;var moved=false;
 for(var axis=0u;axis<3u;axis++){
   let v0=bitcast<f32>(old_word(row,4u+axis));let x0=bitcast<f32>(old_word(row,axis));
   let v=bitcast<f32>(new_word(row,4u+axis));let x=bitcast<f32>(new_word(row,axis));
   if(abs(v-v0-g[axis]*0.001*steps)>0.00006
     || abs(x-x0-v0*0.001*steps-g[axis]*0.000001*steps*(steps+1.0)*0.5)>0.000008){fail();}
   moved=moved || new_word(row,axis)!=old_word(row,axis);
 }
 if(!moved){fail();}else{atomicAdd(&receipt[select(26u,25u,row<${n}u)],1u);}
 var original_u=ExactMass();var final_u=ExactMass();
 for(var source=0u;source<2u;source++){
   var before=ExactMass();var after=ExactMass();
   for(var w=0u;w<EM_WORDS;w++){
     if(row<${n}u){let o=(row+source*${n}u)*EM_WORDS+w;before.words[w]=original_e[o];after.words[w]=final_e[o];}
     else{let o=${H.headerWords}u+(row-${n}u)*${H.rowWords}u+select(${H.energyOffset}u,${H.sourceOffset}u,source!=0u)+w;
       before.words[w]=original_h[o];after.words[w]=final_h[o];}
   }
   if(${Boolean(thermalData)}){
     if(source==0u){original_u=before;final_u=after;}
     else{
       let old_conserved=el_subtract(original_u,before);let new_conserved=el_subtract(final_u,after);
       let direction=el_compare(new_conserved.value,old_conserved.value);
       if((old_conserved.error|new_conserved.error)!=0u
         || select(direction<=0,direction>=0,row<${n}u)){fail();}
     }
   }else{
     let packet=el_from_f32_bits(bitcast<u32>(bitcast<f32>(old_word(row,3u))*2.0*steps));
     let expected=el_add(before,packet.value);
     if((packet.error|expected.error)!=0u || el_compare(after,expected.value)!=0){fail();}
   }
 }
}`, [source.sphParticleUpload.stateBuffer,final.transported.carrierStateBuffer,original.carrierEnergy.energyBuffer,
      final.transported.carrierEnergy.energyBuffer,source.history.buffer,final.history.buffer,receipt],source.particleCount);
    device.queue.submit([enc.finish()]);
    let refused=false;
    try{createSchroederResidualMechanicsSource({device,sphParticleUpload:sph,mlsMpmParticleUpload:mls,
      history:source.history,transported:final.transported,smoothingLengthM:0.5});}
    catch(error){refused=true;await error.residualSourceCleanup;}
    if(!refused)throw new Error('Transport accepted a different history owner');
  }finally{
    await device.queue.onSubmittedWorkDone();
    for(const release of cleanup.reverse())await release();
    original.release();
  }
}
