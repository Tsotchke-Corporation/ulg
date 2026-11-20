import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';

export function chainPhaseReceiptShader({ rejected, sourceMassOffset, candidateMassOffset, firstPhase = 1 }) {
  return /* wgsl */ `
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${createSphExactLedgerWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
@group(0) @binding(0) var<storage,read> mass:array<u32>;
@group(0) @binding(1) var<storage,read> old_mass:array<u32>;
@group(0) @binding(2) var<storage,read> energy:array<u32>;
@group(0) @binding(3) var<storage,read> old_energy:array<u32>;
@group(0) @binding(4) var<storage,read> state:array<f32>;
@group(0) @binding(5) var<storage,read> thermo:array<f32>;
@group(0) @binding(6) var<storage,read_write> receipt:array<u32>;
fn m(row:u32,old:bool)->ExactMass {
  var v:ExactMass;for(var w=0u;w<EM_WORDS;w++) {
    v.words[w]=select(mass[${candidateMassOffset}u+row*EM_WORDS+w],old_mass[${sourceMassOffset}u+row*EM_WORDS+w],old);
  } return v;
}
fn e(row:u32,source:bool,old:bool)->ExactMass {
  let at=(row+select(0u,8u,source))*EM_WORDS;
  var v:ExactMass;for(var w=0u;w<EM_WORDS;w++) {v.words[w]=select(energy[at+w],old_energy[at+w],old);}return v;
}
@compute @workgroup_size(1) fn check() {
  receipt[1]=energy[16u*EM_WORDS];receipt[2]=energy[16u*EM_WORDS+1u];
  if(${rejected}) {
    for(var row=0u;row<8u;row++) {if(el_compare(m(row,false),m(row,true))!=0) {receipt[0]|=1u;}}
    for(var w=0u;w<arrayLength(&energy);w++) {if(energy[w]!=old_energy[w]) {receipt[0]|=2u;}}
    return;
  }
  if(receipt[1]!=0u) {receipt[0]|=4u;}
  for(var lineage=0u;lineage<2u;lineage++) {
    var before_m:ExactMass;var after_m:ExactMass;var before_e:ExactMass;var after_e:ExactMass;
    for(var lane=0u;lane<4u;lane++) {
      let row=lineage+lane*2u;
      let a=em_add(before_m,m(row,true));let b=em_add(after_m,m(row,false));
      let u=el_subtract(e(row,false,true),e(row,true,true));let v=el_subtract(e(row,false,false),e(row,true,false));
      let c=el_add(before_e,u.value);let d=el_add(after_e,v.value);
      if((a.error|b.error|u.error|v.error|c.error|d.error)!=0u) {receipt[0]|=8u;}
      before_m=a.value;after_m=b.value;before_e=c.value;after_e=d.value;
      let projected=em_project_f32_bits(m(row,false));
      if(projected.error!=0u || projected.bits!=bitcast<u32>(state[row*8u+3u])) {receipt[0]|=16u;}
      if(lane+1u>=${firstPhase}u && lane+1u<=${firstPhase+1}u) {
        if(!(state[row*8u+3u]>0.0 && state[row*8u+3u]<1.0)
          || thermo[row*12u+1u]!=f32(lane+1u) || thermo[row*12u+10u]!=1.0) {receipt[0]|=32u;}
      } else if(state[row*8u+3u]!=0.0) {receipt[0]|=64u;}
    }
    if(el_compare(before_m,after_m)!=0 || el_compare(before_e,after_e)!=0) {receipt[0]|=128u;}
  }
}`;
}
