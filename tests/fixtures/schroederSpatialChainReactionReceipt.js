import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';

export function chainReactionReceiptShader({ particleCount, rejected, sourceMassOffset, candidateMassOffset, waterId, phaseTransfer, continuation = false }) {
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
@group(0) @binding(7) var<storage,read> history:array<u32>;
fn m(row:u32,old:bool)->ExactMass {
  var v=ExactMass();for(var w=0u;w<EM_WORDS;w++) {
    if(old) {v.words[w]=old_mass[${sourceMassOffset}u+row*EM_WORDS+w];}
    else {v.words[w]=mass[${candidateMassOffset}u+row*EM_WORDS+w];}
  }return v;
}
fn e(row:u32,source:bool,old:bool)->ExactMass {
  let at=(row+select(0u,${particleCount}u,source))*EM_WORDS;
  var v=ExactMass();for(var w=0u;w<EM_WORDS;w++) {
    if(old) {v.words[w]=old_energy[at+w];}else {v.words[w]=energy[at+w];}
  }return v;
}
@compute @workgroup_size(1) fn check() {
  receipt[1]=energy[${particleCount*2}u*EM_WORDS];receipt[2]=energy[${particleCount*2}u*EM_WORDS+1u];
  if(${rejected}) {
    for(var row=0u;row<${particleCount}u;row++) {if(em_compare(m(row,false),m(row,true))!=0) {receipt[0]|=1u;}}
    for(var w=0u;w<arrayLength(&energy);w++) {if(energy[w]!=old_energy[w]) {receipt[0]|=2u;}}
    if(!${continuation}) {for(var w=0u;w<arrayLength(&history);w++) {if(history[w]!=0u) {receipt[0]|=256u;}}}
    return;
  }
  if(receipt[1]!=0u || (receipt[2]&4u)==0u) {receipt[0]|=4u;}
  var bm=ExactMass();var am=ExactMass();var be=ExactMass();var ae=ExactMass();
  var water=false;var changed=false;
  for(var row=0u;row<${particleCount}u;row++) {
    let a=em_add(bm,m(row,true));let b=em_add(am,m(row,false));
    let u=el_subtract(e(row,false,true),e(row,true,true));let v=el_subtract(e(row,false,false),e(row,true,false));
    let c=el_add(be,u.value);let d=el_add(ae,v.value);
    if((a.error|b.error|u.error|v.error|c.error|d.error)!=0u) {receipt[0]|=8u;}
    bm=a.value;am=b.value;be=c.value;ae=d.value;
    changed=changed || em_compare(m(row,true),m(row,false))!=0;
    let projected=em_project_f32_bits(m(row,false));
    if(projected.error!=0u || projected.bits!=bitcast<u32>(state[row*8u+3u])) {receipt[0]|=16u;}
    if(state[row*8u+3u]>0.0) {
      water=water || thermo[row*12u]==${waterId}.0;
      if(thermo[row*12u+10u]!=1.0) {receipt[0]|=32u;}
      if(${phaseTransfer} && thermo[row*12u+1u]!=f32(row/${Math.max(1,Math.floor(particleCount/4))}u+1u)) {receipt[0]|=64u;}
    }
  }
  if(em_compare(bm,am)!=0 || el_compare(be,ae)!=0) {receipt[0]|=128u;}
  if(!${continuation} && (!water || !changed)) {receipt[0]|=512u;}
}`;
}
