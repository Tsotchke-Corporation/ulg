import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';

// Independent bounded test reduction; production uses parallel tree reduction.
export function chainRefinementReceiptShader({particleCount, rejected, merge, sourceMassOffset, candidateMassOffset}) {
  return `
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${createSphExactLedgerWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
@group(0) @binding(0) var<storage,read> mass:array<u32>;
@group(0) @binding(1) var<storage,read> old_mass:array<u32>;
@group(0) @binding(2) var<storage,read> energy:array<u32>;
@group(0) @binding(3) var<storage,read> old_energy:array<u32>;
@group(0) @binding(4) var<storage,read> state:array<f32>;
@group(0) @binding(5) var<storage,read> thermo:array<f32>;
@group(0) @binding(6) var<storage,read_write> receipt:array<u32>;
@group(0) @binding(7) var<storage,read> evidence:array<u32>;
@compute @workgroup_size(1) fn check() {
  var bm:ExactMass;var am:ExactMass;var be:ExactMass;var ae:ExactMass;
  for(var row=0u;row<${particleCount}u;row++) {
    var m0:ExactMass;var m1:ExactMass;var u0:ExactMass;var u1:ExactMass;var s0:ExactMass;var s1:ExactMass;
    for(var w=0u;w<EM_WORDS;w++) {
      m0.words[w]=old_mass[${sourceMassOffset}u+row*EM_WORDS+w];
      m1.words[w]=mass[${candidateMassOffset}u+row*EM_WORDS+w];
      u0.words[w]=old_energy[row*EM_WORDS+w];u1.words[w]=energy[row*EM_WORDS+w];
      s0.words[w]=old_energy[(row+${particleCount}u)*EM_WORDS+w];s1.words[w]=energy[(row+${particleCount}u)*EM_WORDS+w];
    }
    if(${rejected} && em_compare(m0,m1)!=0) {receipt[0]|=1u;}
    let a=em_add(bm,m0);let b=em_add(am,m1);let c=el_subtract(u0,s0);let d=el_subtract(u1,s1);
    let e=el_add(be,c.value);let f=el_add(ae,d.value);
    if((a.error|b.error|c.error|d.error|e.error|f.error)!=0u) {receipt[0]|=2u;}
    bm=a.value;am=b.value;be=e.value;ae=f.value;
    let projected=em_project_f32_bits(m1);
    if(projected.error!=0u || projected.bits!=bitcast<u32>(state[row*8u+3u])) {receipt[0]|=4u;}
    if(!${rejected} && state[row*8u+3u]>0.0) {
      if(thermo[row*12u+10u]!=1.0 || thermo[row*12u+1u]!=f32(row/${particleCount/4}u+1u)) {receipt[0]|=8u;}
    }
    if(!${rejected} && !${merge} && row>=${3*particleCount/4-2}u && row<${3*particleCount/4}u
      && state[row*8u+3u]<=0.0) {receipt[0]|=16u;}
  }
  if(em_compare(bm,am)!=0 || el_compare(be,ae)!=0) {receipt[0]|=32u;}
  if(${rejected}) {
    for(var w=0u;w<arrayLength(&energy);w++) {if(energy[w]!=old_energy[w]) {receipt[0]|=64u;}}
  } else {
    if(evidence[0]!=0u || evidence[5]!=0u || evidence[${merge?2:1}]!=1u
      || evidence[${merge?3:4}]!=${merge?1:2}u) {receipt[0]|=128u;}
  }
  for(var w=0u;w<5u;w++) {receipt[w+1u]=evidence[w];}
}`;
}
