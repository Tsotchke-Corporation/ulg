import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';

// Fixed two-carrier manufactured oracle. All arithmetic and comparisons stay
// on the GPU; only the existing 128-byte receipt is read by the harness.
export function chainLedgerReceiptShader({ rejected, contact, thermalPair }) {
  return /* wgsl */ `
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${createSphExactLedgerWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
@group(0) @binding(0) var<storage,read> energy:array<u32>;
@group(0) @binding(1) var<storage,read> old:array<u32>;
@group(0) @binding(2) var<storage,read_write> receipt:array<u32>;
fn load(at:u32, original:bool)->ExactMass {
  var v:ExactMass;
  for(var i=0u;i<EM_WORDS;i++) {v.words[i]=select(energy[at+i],old[at+i],original);}
  return v;
}
@compute @workgroup_size(1) fn check() {
  let control=4u*EM_WORDS;
  receipt[1]=energy[control];receipt[2]=energy[control+1u];
  if (${rejected}) {
    for(var i=0u;i<arrayLength(&energy);i++) {if(energy[i]!=old[i]) {receipt[0]|=1u;}}
    return;
  }
  if(energy[control]!=0u || energy[control+2u]!=old[control+2u]
    || energy[control+3u]!=old[control+3u]+2u) {receipt[0]|=2u;}
  var budget:ExactMass; var before:ExactMass;
  for(var row=0u;row<2u;row++) {
    let at=row*EM_WORDS;let source_at=2u*EM_WORDS+at;
    let value=el_subtract(load(at,false),load(source_at,false));
    let previous=el_subtract(load(at,true),load(source_at,true));
    let sum=el_add(budget,value.value);let initial=el_add(before,previous.value);
    if((value.error|previous.error|sum.error|initial.error)!=0u) {receipt[0]|=4u;}
    budget=sum.value;before=initial.value;
    if(${contact} && (el_compare(load(source_at,false),load(source_at,true))<=0
      || (energy[control+1u]&2u)==0u)) {receipt[0]|=8u;}
    // Removing recorded sources isolates the exact antisymmetric pair packet.
    if(${thermalPair}) {
      let direction=el_compare(value.value,previous.value);
      if((row==0u && direction<=0) || (row==1u && direction>=0)) {receipt[0]|=16u;}
    }
  }
  if(el_compare(budget,before)!=0) {receipt[0]|=32u;}
}`;
}
