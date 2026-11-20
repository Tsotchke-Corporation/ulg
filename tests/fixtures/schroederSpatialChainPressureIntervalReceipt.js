import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT as format } from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';

export function pressureIntervalReceipt({count,beforeOffset,afterOffset,step,rejected,compare,enabled}){
  return `
${createSphExactMassWgsl(format)}
${createSphExactLedgerWgsl(format)}
@group(0) @binding(0) var<storage,read> bm:array<u32>;
@group(0) @binding(1) var<storage,read> am:array<u32>;
@group(0) @binding(2) var<storage,read> be:array<u32>;
@group(0) @binding(3) var<storage,read> ae:array<u32>;
@group(0) @binding(4) var<storage,read> state:array<u32>;
@group(0) @binding(5) var<storage,read> original:array<u32>;
@group(0) @binding(6) var<storage,read> reference:array<u32>;
@group(0) @binding(7) var<storage,read_write> receipt:array<u32>;
@compute @workgroup_size(1) fn check(){
 var mass0=ExactMass();var mass1=ExactMass();var energy0=ExactMass();var energy1=ExactMass();
 var changed=0u;var occupied=0u;
 for(var row=0u;row<${count}u;row++){
   var m0=ExactMass();var m1=ExactMass();var u0=ExactMass();var u1=ExactMass();var s0=ExactMass();var s1=ExactMass();
   for(var w=0u;w<EM_WORDS;w++){
     m0.words[w]=bm[(${beforeOffset}u+row)*EM_WORDS+w];m1.words[w]=am[(${afterOffset}u+row)*EM_WORDS+w];
     u0.words[w]=be[row*EM_WORDS+w];u1.words[w]=ae[row*EM_WORDS+w];
     s0.words[w]=be[(row+${count}u)*EM_WORDS+w];s1.words[w]=ae[(row+${count}u)*EM_WORDS+w];
     if(${rejected} && (m0.words[w]!=m1.words[w] || u0.words[w]!=u1.words[w] || s0.words[w]!=s1.words[w])){receipt[0]|=1u;}
   }
   let m0sum=em_add(mass0,m0);let m1sum=em_add(mass1,m1);mass0=m0sum.value;mass1=m1sum.value;
   let e0=el_subtract(u0,s0);let e1=el_subtract(u1,s1);
   let e0sum=el_add(energy0,e0.value);let e1sum=el_add(energy1,e1.value);energy0=e0sum.value;energy1=e1sum.value;
   if((m0sum.error|m1sum.error|e0.error|e1.error|e0sum.error|e1sum.error)!=0u){receipt[0]|=2u;}
   if(!em_zero(m1)){
     occupied++;
     for(var w=4u;w<7u;w++){if(state[row*8u+w]!=reference[row*8u+w]){changed++;}}
   }
   if(${rejected}){for(var w=0u;w<8u;w++){if(state[row*8u+w]!=original[row*8u+w]){receipt[0]|=4u;}}}
 }
 if(em_compare(mass0,mass1)!=0 || el_compare(energy0,energy1)!=0){receipt[0]|=8u;}
 receipt[1u+${step}u]=changed;receipt[4u+${step}u]=occupied;
 if(${compare} && (changed>0u)!=${enabled}){receipt[0]|=16u;}
 receipt[7]++;
}`;
}
