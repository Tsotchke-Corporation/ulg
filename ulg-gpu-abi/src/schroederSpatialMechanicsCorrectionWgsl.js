import { SCHROEDER_SPATIAL_MECHANICS_CORRECTION_MAGIC } from './schroederSpatialMechanicsCorrection.js';
import { SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS } from './schroederSpatialScaleAtlas.js';

// Squaring nodal mass underflows for small reaction residuals even when both
// momentum and velocity are representable. Compare dimensionless speed, with
// the same spherical CFL limit and no mass-dependent tolerance.
export const schroederSpatialMechanicsSpeedBoundWgsl = /* wgsl */ `
fn mechanics_within_speed(momentum:vec3<f32>,mass:f32,vmax:f32)->bool {
  if(!(mass>=0.0) || !(vmax>0.0)) {return false;}
  if(mass==0.0) {return all(momentum==vec3<f32>(0.0));}
  let relative=(momentum/mass)/vmax;
  if(!all(abs(relative)<=vec3<f32>(1.0))) {return false;}
  return dot(relative,relative)<=1.0;
}
`;

const common = /* wgsl */ `
${schroederSpatialMechanicsSpeedBoundWgsl}
struct Params { words: array<vec4<u32>,12> };
alias Row = array<f32,8>;
const MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_CORRECTION_MAGIC}u;
fn p(i:u32)->u32 { return params.words[i/4u][i%4u]; }
fn f(i:u32)->f32 { return bitcast<f32>(p(i)); }
fn finite(v:f32)->bool { return (bitcast<u32>(v)&0x7f800000u)!=0x7f800000u; }
fn momentum(row:Row)->vec3<f32> { return vec3<f32>(row[1],row[2],row[3]); }
fn kinetic(row:Row)->f32 {
  // Divide before squaring so small nodal masses (e.g. air stencil tails or
  // sub-microscopic parcels) do not underflow |p|^2 to zero in f32.
  if (row[0]>0.0) { let v=momentum(row)/row[0]; return 0.5*row[0]*dot(v,v); } return 0.0;
}
fn valid(row:Row)->bool {
  for(var w=0u;w<8u;w++) { if(!finite(row[w]) || (row[0]==0.0 && row[w]!=0.0)) { return false; } }
  return row[0]>=0.0 && row[7]>=0.0 && finite(kinetic(row))
    && kinetic(row)<=row[7]+max(1e-12,abs(row[7])*3e-5);
}
fn linear(id:vec3<u32>,groups:vec3<u32>)->u32 { return id.x+id.y*groups.x*64u; }
`;

function header(buffer, name) {
  return /* wgsl */ `
fn ${name}(level:u32,count:u32,capacity:u32,dictionary:u32,kind:u32,mutation:u32) {
  atomicStore(&${buffer}[0],MAGIC); atomicStore(&${buffer}[1],1u); atomicStore(&${buffer}[2],1u);
  for(var w=3u;w<=15u;w++) { atomicStore(&${buffer}[w],p(w+17u)); }
  atomicStore(&${buffer}[16],level); atomicStore(&${buffer}[17],count); atomicStore(&${buffer}[18],capacity);
  atomicStore(&${buffer}[19],64u); atomicStore(&${buffer}[20],8u); atomicStore(&${buffer}[21],p(1u));
  atomicStore(&${buffer}[22],dictionary); atomicStore(&${buffer}[23],p(0u));
  atomicStore(&${buffer}[24],kind); atomicStore(&${buffer}[25],mutation); atomicStore(&${buffer}[28],1u);
}
`;
}

export const schroederSpatialChainForceWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage,read> topology:array<u32>;
@group(0) @binding(1) var<storage,read> original:array<u32>;
@group(0) @binding(2) var<storage,read_write> updated:array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params:Params;
${common}
${header('updated','initialize_header')}
fn fail(mask:u32) { atomicOr(&updated[27],mask); }
fn load_original(i:u32)->Row {
  var row:Row; for(var w=0u;w<8u;w++) { row[w]=bitcast<f32>(original[original[32]+i*8u+w]); } return row;
}
fn load_updated(i:u32)->Row {
  var row:Row; for(var w=0u;w<8u;w++) { row[w]=bitcast<f32>(atomicLoad(&updated[64u+i*8u+w])); } return row;
}
fn store_row(i:u32,row:Row) { for(var w=0u;w<8u;w++) { atomicStore(&updated[64u+i*8u+w],bitcast<u32>(row[w])); } }
@compute @workgroup_size(1) fn initialize_force() {
  initialize_header(topology[17],original[17],p(2u),p(3u),0u,0u);
  if(original[0]!=0x53434d31u || original[1]!=1u || original[2]!=3u || original[25]!=p(1u)
    || original[26]!=p(3u) || original[18]!=p(2u) || original[17]>p(2u) || original[20]!=8u
    || original[32]!=64u+p(2u)*8u || original[27]!=0u || original[28]!=1u
    || topology[0]!=0x53504631u || topology[2]!=3u || topology[44]!=p(3u) || topology[37]!=original[17]) { fail(1u); }
  for(var w=3u;w<=15u;w++) { if(original[w]!=p(w+17u) || topology[w]!=p(w+17u)) { fail(2u); } }
}
fn wall_component(value:f32,mass:f32,gap:f32)->f32 {
  let effective_gap=max(max(gap,0.0),f(16u));
  let stiffness=mass/(effective_gap*effective_gap)+f(14u);
  let ratio=stiffness*f(4u)*f(4u)/mass;
  let alpha=clamp(ratio/(1.0+ratio)*f(15u),0.0,1.0);
  return value+max(0.0,-value)*alpha;
}
@compute @workgroup_size(64) fn force_rows(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>) {
  let i=linear(id,groups); if(atomicLoad(&updated[27])!=0u || i>=original[17]) { return; }
  var row=load_original(i); if(!valid(row)) { fail(4u); return; }
  if(row[0]>0.0) {
    let dv=vec3<f32>(f(5u),f(6u),f(7u))*f(4u);
    row[7]+=dot(momentum(row),dv)+0.5*row[0]*dot(dv,dv);
    var velocity=momentum(row)/row[0]+dv;
    if(p(11u)==1u) {
      let key=topology[topology[48]+i*4u]; let ny=topology[24]; let nz=topology[25];
      let spacing=bitcast<f32>(topology[29]); let shift=f32(topology[27]);
      let node=(vec3<f32>(f32(key/(ny*nz)),f32((key/nz)%ny),f32(key%nz))-vec3<f32>(shift))*spacing;
      let dims=vec3<f32>(f(8u),f(9u),f(10u)); let epsilon=max(1e-7,spacing*1e-6);
      for(var axis=0u;axis<3u;axis++) {
        if(node[axis]<=spacing+epsilon) { velocity[axis]=wall_component(velocity[axis],row[0],node[axis]-spacing+epsilon); }
        if(node[axis]>=dims[axis]-spacing-epsilon) { velocity[axis]=-wall_component(-velocity[axis],row[0],dims[axis]-spacing-node[axis]+epsilon); }
      }
    }
    for(var axis=0u;axis<3u;axis++) { row[axis+1u]=row[0]*velocity[axis]; }
  }
  if(!valid(row)) { fail(4u); return; } store_row(i,row);
}
@compute @workgroup_size(64) fn contact_rows(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>) {
  let first=linear(id,groups);
  if(p(12u)==0u || atomicLoad(&updated[27])!=0u || first>=original[17]) { return; }
  let keyOffset=topology[48]; let node=topology[keyOffset+first*4u];
  if(first>0u && topology[keyOffset+(first-1u)*4u]==node) { return; }
  var end=first+1u; while(end<original[17] && topology[keyOffset+end*4u]==node) { end++; }
  for(var left=first;left<end;left++) { for(var right=left+1u;right<end;right++) {
    var a=load_updated(left); var b=load_updated(right); if(a[0]<=0.0 || b[0]<=0.0) { continue; }
    let raw=vec3<f32>(a[4],a[5],a[6])/a[0]-vec3<f32>(b[4],b[5],b[6])/b[0];
    let length2=dot(raw,raw); if(length2<=1e-12) { continue; }
    let normal=raw/sqrt(length2); let closing=dot(momentum(b)/b[0]-momentum(a)/a[0],normal);
    if(closing>=0.0) { continue; }
    let invA=1.0/a[0]; let invB=1.0/b[0]; let impulse=-closing/(invA+invB);
    let oldA=kinetic(a); let oldB=kinetic(b);
    for(var axis=0u;axis<3u;axis++) { a[axis+1u]-=impulse*normal[axis]; b[axis+1u]+=impulse*normal[axis]; }
    let deltaA=kinetic(a)-oldA; let deltaB=kinetic(b)-oldB; let heat=max(0.0,-deltaA-deltaB);
    // Work at the common final normal velocity transfers energy between
    // sides. Dissipation on each side is J²/(2m), hence inverse-mass shares.
    a[7]+=deltaA+heat*invA/(invA+invB); b[7]+=deltaB+heat*invB/(invA+invB);
    if(!valid(a) || !valid(b)) { fail(4u); return; }
    store_row(left,a); store_row(right,b);
  } }
}
@compute @workgroup_size(64) fn validate_force_rows(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>) {
  let i=linear(id,groups); if(atomicLoad(&updated[27])!=0u || i>=original[17]) { return; }
  let row=load_updated(i); let vmax=f(13u)*bitcast<f32>(topology[29])/f(4u);
  if(!valid(row)) {atomicOr(&updated[29],1u);fail(8u);}
  if(!mechanics_within_speed(momentum(row),row[0],vmax)) {
    atomicOr(&updated[29],2u);fail(8u);
    if(atomicAdd(&updated[30],1u)==0u) {
      for(var w=0u;w<4u;w++) {atomicStore(&updated[40u+w],bitcast<u32>(row[w]));}
      atomicStore(&updated[44],bitcast<u32>(vmax));
      let relative=(momentum(row)/row[0])/vmax;
      atomicStore(&updated[45],bitcast<u32>(dot(relative,relative)));
      atomicStore(&updated[46],bitcast<u32>(kinetic(row)));
      atomicStore(&updated[47],bitcast<u32>(row[7]));
    }
  }
}
@compute @workgroup_size(1) fn seal_force() {
  if(atomicLoad(&updated[27])!=0u) { atomicStore(&updated[2],5u); return; }
  atomicStore(&updated[2],3u); for(var w=60u;w<=62u;w++) { atomicStore(&updated[w],topology[w]); }
}
`;

export const schroederSpatialChainProlongWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage,read> topology:array<u32>;
@group(0) @binding(1) var<storage,read> original:array<u32>;
@group(0) @binding(2) var<storage,read> updated:array<u32>;
@group(0) @binding(3) var<storage,read> fine:array<u32>;
@group(0) @binding(4) var<storage,read_write> fine_out:array<atomic<u32>>;
@group(0) @binding(5) var<storage,read> native:array<u32>;
@group(0) @binding(6) var<storage,read_write> native_out:array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params:Params;
${common}
${header('fine_out','fine_header')}
${header('native_out','native_header')}
fn fail(mask:u32) { atomicOr(&fine_out[27],mask); atomicOr(&native_out[27],mask); }
// Compact numerical refusal reasons accompany the existing fail-closed bit.
fn numeric_fail(reason:u32) {
  atomicOr(&fine_out[29],reason);atomicOr(&native_out[29],reason);fail(8u);
}
fn fine_count()->u32 { return select(fine[34],fine[17],p(4u)==1u); }
@compute @workgroup_size(1) fn initialize_prolong() {
  fine_header(p(11u),fine_count(),p(5u),p(9u),1u,p(7u));
  native_header(p(12u),native[34],p(6u),p(10u),2u,p(8u));
  if(original[0]!=0x53434d31u || original[2]!=3u || original[25]!=p(1u) || original[26]!=p(3u)
    || original[17]>p(2u) || original[18]!=p(2u) || original[32]!=64u+p(2u)*8u
    || updated[0]!=MAGIC || updated[1]!=1u || updated[2]!=3u || updated[16]!=p(12u)
    || updated[17]!=original[17] || updated[18]!=p(2u) || updated[19]!=64u || updated[20]!=8u
    || updated[21]!=p(1u) || updated[22]!=p(3u) || updated[23]!=p(0u) || updated[27]!=0u
    || topology[0]!=0x53504631u || topology[2]!=3u || topology[44]!=p(3u)
    || topology[37]!=original[17] || topology[35]!=fine_count() || topology[36]!=native[34]
    || topology[16]!=p(11u) || topology[17]!=p(12u) || fine_count()>p(5u) || native[34]>p(6u)) { fail(1u); }
  if(native[0]!=0x53464635u || native[2]!=3u || native[59]!=1u || native[63]!=p(8u)
    || native[38]!=p(10u) || native[17]!=p(12u) || native[31]!=8u || native[32]!=p(6u)) { fail(2u); }
  if(p(4u)==1u) {
    if(fine[0]!=0x53434d31u || fine[2]!=3u || fine[25]!=p(1u) || fine[26]!=p(9u)
      || fine[16]!=p(11u) || fine[18]!=p(5u) || fine[32]!=64u+p(5u)*8u) { fail(2u); }
  } else {
    if(fine[0]!=0x53464635u || fine[2]!=3u || fine[59]!=1u || fine[63]!=p(7u)
      || fine[38]!=p(9u) || fine[17]!=p(11u) || fine[31]!=8u || fine[32]!=p(5u)) { fail(2u); }
  }
  for(var w=3u;w<=15u;w++) {
    if(original[w]!=p(w+17u) || updated[w]!=p(w+17u) || topology[w]!=p(w+17u)
      || fine[w]!=p(w+17u) || native[w]!=p(w+17u)) { fail(2u); }
  }
}
fn correction(row:Row,parent:u32,weight:f32)->vec4<f32> {
  if(parent>=original[17] || !finite(weight) || weight<=0.0 || weight>1.0) { fail(4u); return vec4<f32>(0.0); }
  let a=original[32]+parent*8u; let b=64u+parent*8u; let mass=bitcast<f32>(original[a]);
  if(mass<=0.0) { if(row[0]>0.0) { fail(4u); } return vec4<f32>(0.0); }
  let oldP=vec3<f32>(bitcast<f32>(original[a+1u]),bitcast<f32>(original[a+2u]),bitcast<f32>(original[a+3u]));
  let newP=vec3<f32>(bitcast<f32>(updated[b+1u]),bitcast<f32>(updated[b+2u]),bitcast<f32>(updated[b+3u]));
  let dv=(newP-oldP)/mass;
  let deltaK=dot(oldP,dv)+0.5*mass*dot(dv,dv);
  let deltaBudget=bitcast<f32>(updated[b+7u])-bitcast<f32>(original[a+7u]);
  let heat=deltaBudget-deltaK;
  if(!finite(heat) || heat < -max(1e-12,abs(deltaBudget)*3e-5+abs(bitcast<f32>(original[a+7u]))*3e-5)
    || updated[b]!=original[a]) { numeric_fail(1u); }
  // Keep the signed roundoff residual instead of clamping it into invented
  // energy. Across all contributors the work terms sum to deltaK exactly;
  // the remaining mass-weighted term carries the parent's heat increment.
  let energy=dot(momentum(row),dv)+0.5*row[0]*dot(dv,dv)+(row[0]/mass)*heat;
  return weight*vec4<f32>(row[0]*dv,energy);
}
fn store_fine(i:u32,row:Row) { for(var w=0u;w<8u;w++) { atomicStore(&fine_out[64u+i*8u+w],bitcast<u32>(row[w])); } }
fn store_native(i:u32,row:Row) { for(var w=0u;w<8u;w++) { atomicStore(&native_out[64u+i*8u+w],bitcast<u32>(row[w])); } }
fn within_cfl(row:Row,spacing:f32)->bool {
  let vmax=f(15u)*spacing/f(14u);
  return mechanics_within_speed(momentum(row),row[0],vmax);
}
fn record_cfl(row:Row,spacing:f32) {
  if(atomicAdd(&fine_out[30],1u)!=0u) {return;}
  let vmax=f(15u)*spacing/f(14u);
  for(var w=0u;w<4u;w++) {atomicStore(&fine_out[40u+w],bitcast<u32>(row[w]));}
  atomicStore(&fine_out[44],bitcast<u32>(vmax));
  let relative=(momentum(row)/row[0])/vmax;
  atomicStore(&fine_out[45],bitcast<u32>(dot(relative,relative)));
  atomicStore(&fine_out[46],bitcast<u32>(kinetic(row)));
  atomicStore(&fine_out[47],bitcast<u32>(row[7]));
}
@compute @workgroup_size(64) fn prolong_fine(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>) {
  let i=linear(id,groups); if(atomicLoad(&fine_out[27])!=0u || i>=fine_count()) { return; }
  let source=select(fine[30],fine[32],p(4u)==1u)+i*8u;
  var row:Row; for(var w=0u;w<7u;w++) { row[w]=bitcast<f32>(fine[source+w]); }
  if(p(4u)==1u) { row[7]=bitcast<f32>(fine[source+7u]); } else { row[7]=kinetic(row); }
  if(!valid(row)) { numeric_fail(2u); return; }
  let begin=topology[topology[51]+i]; let end=topology[topology[51]+i+1u];
  if(end<=begin || end>topology[38] || end-begin>8u || end-begin!=topology[topology[50]+i]) { fail(4u); return; }
  var delta=vec4<f32>(0.0); var weights=0.0;
  for(var e=begin;e<end;e++) {
    let weight=bitcast<f32>(topology[topology[53]+e]);
    delta+=correction(row,topology[topology[52]+e],weight); weights+=weight;
  }
  if(abs(weights-1.0)>0.000004) { fail(4u); return; }
  let before7=row[7];
  for(var axis=0u;axis<3u;axis++) { row[axis+1u]+=delta[axis]; } row[7]+=delta.w;
  let cancel_tol=max(1e-12,(abs(before7)+abs(delta.w))*3e-5);
  if(row[7]<0.0 && row[7]>=-cancel_tol && kinetic(row)<=row[7]+cancel_tol) { row[7]=0.0; }
  if(!valid(row)) { numeric_fail(4u); return; }
  if(!within_cfl(row,bitcast<f32>(topology[28]))) { record_cfl(row,bitcast<f32>(topology[28]));numeric_fail(8u); return; } store_fine(i,row);
}
@compute @workgroup_size(64) fn prolong_native(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>) {
  let i=linear(id,groups); if(atomicLoad(&native_out[27])!=0u || i>=native[34]) { return; }
  let source=native[30]+i*8u; var row:Row;
  for(var w=0u;w<7u;w++) { row[w]=bitcast<f32>(native[source+w]); } row[7]=kinetic(row);
  if(!valid(row)) { numeric_fail(16u); return; }
  let delta=correction(row,topology[topology[54]+i],1.0);
  let before7=row[7];
  for(var axis=0u;axis<3u;axis++) { row[axis+1u]+=delta[axis]; } row[7]+=delta.w;
  let cancel_tol=max(1e-12,(abs(before7)+abs(delta.w))*3e-5);
  if(row[7]<0.0 && row[7]>=-cancel_tol && kinetic(row)<=row[7]+cancel_tol) { row[7]=0.0; }
  if(!valid(row)) { numeric_fail(32u); return; }
  if(!within_cfl(row,bitcast<f32>(topology[29]))) { numeric_fail(64u); return; } store_native(i,row);
}
@compute @workgroup_size(1) fn seal_prolong() {
  if(atomicLoad(&fine_out[27])!=0u || atomicLoad(&native_out[27])!=0u) {
    atomicStore(&fine_out[2],5u); atomicStore(&native_out[2],5u); return;
  }
  atomicStore(&fine_out[2],3u); atomicStore(&native_out[2],3u);
  for(var axis=0u;axis<3u;axis++) {
    atomicStore(&fine_out[60u+axis],topology[64u+axis]);
    atomicStore(&native_out[60u+axis],topology[68u+axis]);
  }
}
`;

// Constant-binding (O(1) storage bindings regardless of active level count)
// chain admission accumulator. Runs inside a single compute pass:
//   1. init_chain_admission(level0, level0, control, params)
//   2. accumulate_chain_admission(level0, level_i, control, params) for i=1..N-1
//   3. seal_chain_admission(level0, level0, control, params)
// Control layout is bit-identical to schroederSpatialChainCorrectionAdmissionWgsl
// on words 0..20, and uses word 22 to count verified accumulated levels.
export const schroederSpatialChainCorrectionAccumulateAdmissionWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage,read> level0:array<u32>;
@group(0) @binding(1) var<storage,read> current_level:array<u32>;
@group(0) @binding(2) var<storage,read_write> control:array<u32>;
@group(0) @binding(3) var<uniform> admission_params:vec4<u32>;
const CORRECTION_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_CORRECTION_MAGIC}u;
const CHAIN_CONTROL_MAGIC: u32 = 0x53435331u;

@compute @workgroup_size(1) fn init_chain_admission() {
  var err = 0u;
  if (level0[0] != CORRECTION_MAGIC || level0[1] != 1u || level0[2] != 3u || level0[27] != 0u) {
    err |= 1u;
  }
  control[0] = CHAIN_CONTROL_MAGIC;
  control[1] = 1u;
  control[2] = 1u;
  for (var w = 3u; w <= 15u; w++) { control[w] = level0[w]; }
  control[16] = admission_params.y;
  control[17] = level0[23];
  control[18] = err;
  control[22] = 1u;
}

@compute @workgroup_size(1) fn accumulate_chain_admission() {
  let level_index = admission_params.x;
  let level_count = admission_params.y;
  var err = control[18];
  if (control[0] != CHAIN_CONTROL_MAGIC || control[1] != 1u || control[2] != 1u
    || control[16] != level_count || control[22] != level_index
    || level_index == 0u || level_index >= level_count) {
    err |= 4u;
  }
  if (current_level[0] != CORRECTION_MAGIC || current_level[1] != 1u
    || current_level[2] != 3u || current_level[27] != 0u
    || current_level[16] != level0[16] + level_index
    || current_level[23] != level0[23]) {
    err |= 1u;
  }
  for (var w = 3u; w <= 15u; w++) {
    if (current_level[w] != level0[w]) { err |= 2u; }
  }
  control[18] = err;
  control[22] = control[22] + 1u;
}

@compute @workgroup_size(1) fn seal_chain_admission() {
  let level_count = admission_params.y;
  var err = control[18];
  if (control[0] != CHAIN_CONTROL_MAGIC || control[1] != 1u || control[2] != 1u
    || control[16] != level_count || control[22] != level_count) {
    err |= 4u;
  }
  control[18] = err;
  control[2] = select(3u, 5u, err != 0u);
}
`;

export function schroederSpatialChainCorrectionAdmissionWgsl(levelCount) {
  if (!Number.isInteger(levelCount) || levelCount < 2 || levelCount > SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS) {
    throw new RangeError(`Chain correction admission requires two through ${SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS} levels`);
  }
  return /* wgsl */ `
  ${Array.from({length:levelCount},(_,i)=>`@group(0) @binding(${i}) var<storage,read> level${i}:array<u32>;`).join('\n')}
  @group(0) @binding(${levelCount}) var<storage,read_write> control:array<u32>;
  @compute @workgroup_size(1) fn admit_chain() {
    var error=0u;
    ${Array.from({length:levelCount},(_,i)=>`
    if(level${i}[0]!=${SCHROEDER_SPATIAL_MECHANICS_CORRECTION_MAGIC}u || level${i}[1]!=1u || level${i}[2]!=3u
      || level${i}[27]!=0u || level${i}[16]!=level0[16]+${i}u || level${i}[23]!=level0[23]) { error|=1u; }
    for(var w=3u;w<=15u;w++) { if(level${i}[w]!=level0[w]) { error|=2u; } }
    `).join('\n')}
    control[0]=0x53435331u; control[1]=1u; control[2]=select(3u,5u,error!=0u);
    for(var w=3u;w<=15u;w++) { control[w]=level0[w]; }
    control[16]=${levelCount}u; control[17]=level0[23]; control[18]=error;
  }`;
}
