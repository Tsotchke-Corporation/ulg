import { SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as H } from '../../src/runtime/sph/sphReactionResidualHistoryGpu.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';

// Independent, bounded manufactured-state reduction. No physical payload is
// mapped; the existing 128-byte receipt carries the verdict and row counts.
export function checkResidualThermalReceipt({encoder,check,source,original,transported,history,thermal,receipt,rejected}){
  const n=source.carrierCount;
  if(source.particleCount>64)throw new RangeError('Manufactured thermal receipt covers one 64-lane workgroup');
  check(encoder,`
${createSphExactMassWgsl(H.format)}
${createSphExactLedgerWgsl(H.format)}
@group(0) @binding(0) var<storage,read> old_e:array<u32>;
@group(0) @binding(1) var<storage,read> new_e:array<u32>;
@group(0) @binding(2) var<storage,read> old_h:array<u32>;
@group(0) @binding(3) var<storage,read> new_h:array<u32>;
@group(0) @binding(4) var<storage,read> old_s:array<u32>;
@group(0) @binding(5) var<storage,read> new_s:array<u32>;
@group(0) @binding(6) var<storage,read> old_t:array<u32>;
@group(0) @binding(7) var<storage,read> new_t:array<u32>;
@group(0) @binding(8) var<storage,read> thermal_t:array<u32>;
@group(0) @binding(9) var<storage,read> old_m:array<u32>;
@group(0) @binding(10) var<storage,read> new_m:array<u32>;
@group(0) @binding(11) var<storage,read_write> receipt:array<atomic<u32>>;
var<workgroup> deltas:array<ExactMass,64>;
fn fail(){atomicOr(&receipt[0],4194304u);}
@compute @workgroup_size(64) fn check(@builtin(local_invocation_index) row:u32){
 var u0=ExactMass();var u1=ExactMass();var s0=ExactMass();var s1=ExactMass();
 if(row<${n}u+old_h[3]){
   for(var w=0u;w<EM_WORDS;w++){
     if(row<${n}u){u0.words[w]=old_e[row*EM_WORDS+w];u1.words[w]=new_e[row*EM_WORDS+w];
       s0.words[w]=old_e[(row+${n}u)*EM_WORDS+w];s1.words[w]=new_e[(row+${n}u)*EM_WORDS+w];}
     else{let h=${H.headerWords}u+(row-${n}u)*${H.rowWords}u;
       u0.words[w]=old_h[h+${H.energyOffset}u+w];u1.words[w]=new_h[h+${H.energyOffset}u+w];
       s0.words[w]=old_h[h+${H.sourceOffset}u+w];s1.words[w]=new_h[h+${H.sourceOffset}u+w];}
   }
   // A subsequent apply can book a rounded caloric view as a source. The
   // invariant is exact U-S, including that already-established accounting.
   if(${rejected} && (el_compare(s0,s1)!=0 || el_compare(u0,u1)!=0)){fail();atomicOr(&receipt[31],1u);}
   if(row<${n}u){
     let before=el_subtract(u0,s0);let after=el_subtract(u1,s1);
     if((before.error|after.error)!=0u){fail();}
     if(el_compare(after.value,before.value)<0){atomicAdd(&receipt[28],1u);}
     for(var w=0u;w<12u;w++){
       if(new_t[row*12u+w]!=select(thermal_t[row*12u+w],old_t[row*12u+w],${rejected})){fail();}
     }
     if(${rejected}){
       for(var w=0u;w<8u;w++){if(new_s[row*8u+w]!=old_s[row*8u+w]){fail();}}
       for(var w=0u;w<32u;w++){if(new_m[row*32u+w]!=old_m[row*32u+w]){fail();}}
     }
   }else{
     let h=${H.headerWords}u+(row-${n}u)*${H.rowWords}u+${H.thermoOffset}u;
     for(var w=0u;w<12u;w++){
       if(new_h[h+w]!=select(thermal_t[row*12u+w],old_h[h+w],${rejected})){fail();}
     }
     if(new_h[h+2u]!=old_h[h+2u]){atomicAdd(&receipt[30],1u);}
   }
 }
 let before=el_subtract(u0,s0);let after=el_subtract(u1,s1);
 let delta=el_subtract(after.value,before.value);
 if((before.error|after.error|delta.error)!=0u){fail();}deltas[row]=delta.value;
 workgroupBarrier();
 for(var stride=32u;stride>0u;stride/=2u){
   if(row<stride){let sum=el_add(deltas[row],deltas[row+stride]);if(sum.error!=0u){fail();}deltas[row]=sum.value;}
   workgroupBarrier();
 }
 if(row==0u){if(!em_zero(deltas[0])){fail();atomicOr(&receipt[31],2u);}else{atomicAdd(&receipt[29],1u);}}
}`, [original.carrierEnergy.energyBuffer,transported.carrierEnergy.energyBuffer,source.history.buffer,history.buffer,
    source.sphParticleUpload.stateBuffer,transported.carrierStateBuffer,source.sphParticleUpload.thermoBuffer,
    transported.carrierThermoBuffer,thermal.result.thermoBuffer,source.mlsMpmParticleUpload.mechanicsBuffer,
    transported.carrierMechanicsBuffer,receipt],64);
}
