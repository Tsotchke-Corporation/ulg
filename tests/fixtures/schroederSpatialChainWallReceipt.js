import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';

// Independent full wall/energy comparison, only a fixed 128-byte receipt leaves
// the GPU. For the isolated thermal case, carrier heat plus wall heat is zero.
export function chainWallReceiptShader({ particleCount, rejected, isolated, kind, receiptOffset = 0, mechanics = false }) {
  return /* wgsl */ `
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${createSphExactLedgerWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
@group(0) @binding(0) var<storage,read> wall:array<u32>;
@group(0) @binding(1) var<storage,read> original:array<u32>;
@group(0) @binding(2) var<storage,read> cold:array<u32>;
@group(0) @binding(3) var<storage,read> energy:array<u32>;
@group(0) @binding(4) var<storage,read> old_energy:array<u32>;
@group(0) @binding(5) var<storage,read> validation:array<u32>;
@group(0) @binding(6) var<storage,read_write> receipt:array<u32>;
${mechanics ? '@group(0) @binding(7) var<storage,read> mechanical:array<f32>;' : ''}
@compute @workgroup_size(1) fn check() {
  receipt[${receiptOffset + 1}u]=validation[2];var heat=ExactMass();var source=ExactMass();var mechanicalHeat=ExactMass();
  var unrecorded=ExactMass();
  for(var w=0u;w<arrayLength(&original);w++) {
    if(original[w]!=cold[w]) {receipt[${receiptOffset + 0}u]|=1u;}
    if(${rejected} && wall[w]!=original[w]) {receipt[${receiptOffset + 0}u]|=2u;}
  }
  if(${rejected}) {
    for(var w=0u;w<arrayLength(&energy);w++) {if(energy[w]!=old_energy[w]) {receipt[${receiptOffset + 0}u]|=4u;}}
    return;
  }
  for(var face=0u;face<6u;face++) {
    var e=ExactMass();var before=ExactMass();
    for(var w=0u;w<EM_WORDS;w++) {e.words[w]=wall[64u+face*EM_WORDS+w];before.words[w]=original[64u+face*EM_WORDS+w];}
    let change=el_subtract(e,before);let sum=el_add(heat,change.value);heat=sum.value;
    let view=el_project_f32_bits(e);
    if((change.error|sum.error|view.error)!=0u) {receipt[${receiptOffset + 0}u]|=8u;}
    let expected=bitcast<f32>(original[32u+face])+bitcast<f32>(view.bits)/bitcast<f32>(original[6u+face]);
    if(wall[face]!=bitcast<u32>(expected)) {receipt[${receiptOffset + 0}u]|=16u;}
    if(wall[face]!=original[face]) {receipt[${receiptOffset + 6}u]++;}
    let sign=el_compare(change.value,ExactMass());
    if(sign<0) {receipt[${receiptOffset + 2}u]++;}if(sign>0) {receipt[${receiptOffset + 3}u]++;}
  }
  for(var row=0u;row<${particleCount}u;row++) {
    var s=ExactMass();var before=ExactMass();
    for(var w=0u;w<EM_WORDS;w++) {let at=(row+${particleCount}u)*EM_WORDS+w;
      s.words[w]=energy[at];before.words[w]=old_energy[at];}
    let change=el_subtract(s,before);let sum=el_add(source,change.value);source=sum.value;
    if((change.error|sum.error)!=0u) {receipt[${receiptOffset + 0}u]|=32u;}
    var u=ExactMass();var oldU=ExactMass();
    for(var w=0u;w<EM_WORDS;w++) {u.words[w]=energy[row*EM_WORDS+w];oldU.words[w]=old_energy[row*EM_WORDS+w];}
    let deltaU=el_subtract(u,oldU);
    let pair=el_subtract(deltaU.value,change.value);let pairSum=el_add(unrecorded,pair.value);unrecorded=pairSum.value;
    if(${isolated} && (deltaU.error|pair.error|pairSum.error)!=0u) {receipt[${receiptOffset + 0}u]|=2048u;}
    ${mechanics ? `
    // Mechanical work is a separate recorded source. Compare the retained
    // pre-thermal physical energy against the old ledger's f32 view, then
    // require wall heat to close the remaining exact source budget.
    let mass=mechanical[row*8u+3u];let specific=mechanical[row*8u+7u];
    let projected=el_project_f32_bits(oldU);let factored=el_from_f32_bits(bitcast<u32>(mass*specific));
    if(mass>0.0 && bitcast<f32>(projected.bits)/mass!=specific && el_compare(factored.value,oldU)!=0) {
      let work=el_from_f32_bits(bitcast<u32>(mass*specific-bitcast<f32>(projected.bits)));
      let total=el_add(mechanicalHeat,work.value);mechanicalHeat=total.value;
      if((projected.error|factored.error|work.error|total.error)!=0u){receipt[${receiptOffset}u]|=1024u;}
    }` : ''}
  }
  let paired=el_add(source,heat);
  if(${isolated} && el_compare(unrecorded,ExactMass())!=0) {receipt[${receiptOffset}u]|=2048u;}
  if(${isolated} && (paired.error!=0u || el_compare(paired.value,mechanicalHeat)!=0)) {receipt[${receiptOffset + 0}u]|=64u;}
  receipt[${receiptOffset + 4}u]=el_project_f32_bits(paired.value).bits;
  receipt[${receiptOffset + 5}u]=el_project_f32_bits(mechanicalHeat).bits;
  if(wall[26]!=original[26]+1u) {receipt[${receiptOffset}u]|=4096u;}
  if(receipt[${receiptOffset + 2}u]+receipt[${receiptOffset + 3}u]==0u) {receipt[${receiptOffset + 0}u]|=128u;}
  if(${kind === 'hot'} && receipt[${receiptOffset + 2}u]==0u) {receipt[${receiptOffset + 0}u]|=256u;}
  if(${kind === 'cold'} && receipt[${receiptOffset + 3}u]==0u) {receipt[${receiptOffset + 0}u]|=512u;}
}`;
}
