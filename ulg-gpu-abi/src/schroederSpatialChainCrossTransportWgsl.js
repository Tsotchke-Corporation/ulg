import { schroederSpatialPhaseVolumePressureDragOperatorWgsl } from './schroederSpatialPhaseVolumePressureDragOperatorWgsl.js';
import { schroederSpatialMechanicsSpeedBoundWgsl } from './schroederSpatialMechanicsCorrectionWgsl.js';

// An adjacent pair exchanges impulses between its corrected fine composite
// and native coarse fields. A fine node owns all its cohorts. The 6^3 colors
// have disjoint trilinear coarse supports, so each pass observes prior reflux
// without float atomics or a host solver. Complete affine support is mandatory.
export const schroederSpatialChainCrossTransportWgsl = /* wgsl */ `
struct Params { words:array<vec4<u32>,16> };
@group(0) @binding(0) var<storage,read> topology:array<u32>;
@group(0) @binding(1) var<storage,read> fine_keys:array<u32>;
@group(0) @binding(2) var<storage,read> fine_moments:array<u32>;
@group(0) @binding(3) var<storage,read> coarse_moments:array<u32>;
@group(0) @binding(4) var<storage,read> moment_proof:array<u32>;
@group(0) @binding(5) var<storage,read> materials:array<vec4<f32>>;
@group(0) @binding(6) var<storage,read_write> fine:array<atomic<u32>>;
@group(0) @binding(7) var<storage,read_write> coarse:array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params:Params;
@group(0) @binding(9) var<storage,read_write> impulse_ledger:array<atomic<u32>>;
@group(0) @binding(10) var<storage,read> fine_geometry:array<u32>;
${schroederSpatialPhaseVolumePressureDragOperatorWgsl}
${schroederSpatialMechanicsSpeedBoundWgsl}
fn p(i:u32)->u32{return params.words[i/4u][i%4u];}
fn f(i:u32)->f32{return bitcast<f32>(p(i));}
fn finite(v:f32)->bool{return schroeder_phase_volume_finite_f32(v);}
fn fail(mask:u32){atomicOr(&fine[27],mask);atomicOr(&coarse[27],mask);}
fn book_impulse(offset:u32,i:u32,j:vec3<f32>){
  for(var a=0u;a<3u;a++){
    let at=offset+i*3u+a;
    atomicStore(&impulse_ledger[at],bitcast<u32>(bitcast<f32>(atomicLoad(&impulse_ledger[at]))+j[a]));
  }
}
fn key(i:u32)->vec4<u32>{
  var at=i*12u;if(p(0)>0u){at=fine_keys[48]+i*4u;}
  return vec4<u32>(fine_keys[at],fine_keys[at+1u],fine_keys[at+2u],fine_keys[at+3u]);
}
// The return map distributes an inherited impulse by contributor mass. Its
// application point is therefore the restricted mass centroid, not the parent
// grid node. Interpolating the opposite impulse at this same point preserves
// torque after every adjacent return transfer, including empty middle levels.
fn fine_position(i:u32)->vec3<f32>{
  let dense=key(i).x;
  let coord=vec3<f32>(f32(dense/(topology[21]*topology[22])),f32((dense/topology[22])%topology[21]),f32(dense%topology[22]));
  let spacing=bitcast<f32>(topology[28]);let node=(coord-vec3<f32>(f32(topology[26])))*spacing;
  if(p(0)==0u){return node;}
  let mass=bitcast<f32>(fine_geometry[fine_geometry[32]+i*8u]);if(mass==0.0){return node;}
  let at=fine_geometry[33]+i*3u;
  let center=vec3<f32>(bitcast<f32>(fine_geometry[at]),bitcast<f32>(fine_geometry[at+1u]),bitcast<f32>(fine_geometry[at+2u]))/mass;
  // Positive dyadic restriction keeps the centroid within one grid spacing
  // of its key. This also proves disjoint support within each 6^3 color.
  if(!schroeder_phase_volume_finite_vec3(center)||any(abs(center-node)>vec3<f32>(spacing*1.00003))){fail(512u);}
  return center;
}
fn coarse_key(i:u32)->vec4<u32>{
  let at=i*12u;return vec4<u32>(coarse_moments[at],coarse_moments[at+1u],coarse_moments[at+2u],coarse_moments[at+3u]);
}
fn less(a:vec4<u32>,b:vec4<u32>)->bool{
  for(var w=0u;w<4u;w++){if(a[w]!=b[w]){return a[w]<b[w];}}return false;
}
fn coarse_lower(k:vec4<u32>)->u32{
  var lo=0u;var hi=atomicLoad(&coarse[17]);
  while(lo<hi){let mid=lo+(hi-lo)/2u;if(less(coarse_key(mid),k)){lo=mid+1u;}else{hi=mid;}}return lo;
}
fn moment(i:u32)->vec4<f32>{
  var at=i*12u+4u;if(p(0)>0u){at=64u+i*4u;}
  return vec4<f32>(bitcast<f32>(fine_moments[at]),bitcast<f32>(fine_moments[at+1u]),bitcast<f32>(fine_moments[at+2u]),bitcast<f32>(fine_moments[at+3u]));
}
fn coarse_moment(i:u32)->vec4<f32>{
  let at=i*12u+4u;return vec4<f32>(bitcast<f32>(coarse_moments[at]),bitcast<f32>(coarse_moments[at+1u]),bitcast<f32>(coarse_moments[at+2u]),bitcast<f32>(coarse_moments[at+3u]));
}
fn material(k:vec4<u32>)->vec3<f32>{
  for(var i=0u;i<p(6);i++){
    let a=materials[i*3u];let b=materials[i*3u+1u];let c=materials[i*3u+2u];
    if(a.x==f32(k.z)&&a.y==f32(k.y)&&c.y==1.0&&a.z>0.0&&b.z>=0.0&&c.z>=0.0
      &&finite(a.z)&&finite(b.z)&&finite(c.z)){
      return vec3<f32>(b.z,c.z,1.0);
    }
  }return vec3<f32>(0.0);
}
fn load_row(buffer:ptr<storage,array<atomic<u32>>,read_write>,i:u32)->vec4<f32>{
  let at=64u+i*8u;return vec4<f32>(bitcast<f32>(atomicLoad(&(*buffer)[at])),
    bitcast<f32>(atomicLoad(&(*buffer)[at+1u])),bitcast<f32>(atomicLoad(&(*buffer)[at+2u])),bitcast<f32>(atomicLoad(&(*buffer)[at+3u])));
}
fn apply(buffer:ptr<storage,array<atomic<u32>>,read_write>,i:u32,impulse:vec3<f32>,heat:f32)->bool{
  let row=load_row(buffer,i);let at=64u+i*8u;let velocity=row.yzw/row.x;
  let work=dot(impulse,velocity)+0.5*dot(impulse/row.x,impulse);
  let budget=bitcast<f32>(atomicLoad(&(*buffer)[at+7u]))+work+heat;
  let momentum=row.yzw+impulse;
  if(!finite(budget)||budget<0.0||!schroeder_phase_volume_finite_vec3(momentum)){return false;}
  for(var a=0u;a<3u;a++){atomicStore(&(*buffer)[at+1u+a],bitcast<u32>(momentum[a]));}
  atomicStore(&(*buffer)[at+7u],bitcast<u32>(budget));
  return true;
}
@compute @workgroup_size(1) fn initialize_cross(){
  if(topology[0]!=0x53504631u||topology[2]!=3u||topology[44]!=p(3)||topology[67]!=2u
    ||topology[16]+1u!=topology[17]||bitcast<f32>(topology[29])!=2.0*bitcast<f32>(topology[28])
    ||moment_proof[0]!=0x53435031u||moment_proof[1]!=1u||moment_proof[2]!=3u||moment_proof[3]!=0u
    ||moment_proof[6]!=p(4)||moment_proof[21]!=topology[17]||moment_proof[22]!=p(3)||moment_proof[23]!=4u
    ||atomicLoad(&fine[0])!=0x534d4331u||atomicLoad(&coarse[0])!=0x534d4331u
    ||atomicLoad(&fine[2])!=3u||atomicLoad(&coarse[2])!=3u
    ||atomicLoad(&fine[23])!=p(5)||atomicLoad(&coarse[23])!=p(5)
    ||atomicLoad(&fine[17])!=topology[35]||atomicLoad(&coarse[17])!=topology[36]
    ||atomicLoad(&fine[17])>(arrayLength(&fine)-64u)/8u
    ||atomicLoad(&coarse[17])>(arrayLength(&coarse)-64u)/8u
    ||p(6)>arrayLength(&materials)/3u||!(f(8)>0.0)||!(f(9)>0.0)) {fail(256u);return;}
  for(var w=3u;w<=15u;w++){
    if(topology[w]!=p(w+13u)||atomicLoad(&fine[w])!=p(w+13u)||atomicLoad(&coarse[w])!=p(w+13u)
      ||moment_proof[w+5u]!=p(w+13u)){fail(256u);}
  }
  if(p(0)>0u&&(fine_geometry[0]!=0x53434d31u||fine_geometry[2]!=3u||fine_geometry[27]!=0u
    ||fine_geometry[25]!=p(5)||fine_geometry[26]!=fine_keys[44]||fine_geometry[17]!=topology[35]
    ||fine_geometry[33]!=64u+fine_geometry[18]*16u||fine_geometry[34]!=3u||fine_geometry[35]!=1u
    ||fine_geometry[33]>arrayLength(&fine_geometry)||fine_geometry[17]>(arrayLength(&fine_geometry)-fine_geometry[33])/3u)){fail(256u);}
  if(p(0)>0u&&(fine_moments[0]!=0x53435031u||fine_moments[2]!=3u||fine_moments[3]!=0u
    ||fine_moments[6]!=p(4)||fine_moments[23]!=4u||fine_moments[22]!=fine_keys[44])){fail(256u);}
}
fn exchange(i:u32,candidate:vec4<u32>){
  let k=key(i);
  // Same material/phase/domain is already one composite mechanics cohort.
  if(all(k.yzw==candidate.yzw)||(k.y<3u&&candidate.y<3u)){return;}
  let a=load_row(&fine,i);if(a.x==0.0){return;}
  let am=moment(i);let av=a.yzw/a.x;
  let point=fine_position(i)/bitcast<f32>(topology[29])+vec3<f32>(f32(topology[27]));
  let base=vec3<i32>(floor(point));let fraction=point-floor(point);
  let dims=vec3<i32>(i32(topology[23]),i32(topology[24]),i32(topology[25]));
  var indices:array<u32,8>;var weights:array<f32,8>;var count=0u;
  var mass=0.0;var inverse=0.0;var bm=vec4<f32>(0.0);var bv=vec3<f32>(0.0);var sum=0.0;
  for(var x=0;x<2;x++){for(var y=0;y<2;y++){for(var z=0;z<2;z++){
    let side=vec3<i32>(x,y,z);let node=base+side;
    let factors=select(vec3<f32>(1.0)-fraction,fraction,side==vec3<i32>(1));let w=factors.x*factors.y*factors.z;
    if(w==0.0){continue;}
    if(!finite(w)||w<=0.0||w>1.0){fail(512u);return;}
    if(any(node<vec3<i32>(0))||any(node>=dims)){return;}
    let dense=u32((node.x*dims.y+node.y)*dims.z+node.z);
    let recipient=vec4<u32>(dense,candidate.yzw);let j=coarse_lower(recipient);
    // Sparse absence is not corrupt topology. Every nonzero centroid weight
    // must have its native coarse cohort before any impulse may be written.
    if(j>=atomicLoad(&coarse[17])||any(coarse_key(j)!=recipient)){return;}
    let b=load_row(&coarse,j);let m=coarse_moment(j);
    if(b.x==0.0&&m.x==0.0){return;}
    if(!(b.x>0.0)||!(m.x>0.0)||coarse_moments[j*12u+9u]!=3u){fail(512u);return;}
    indices[count]=j;weights[count]=w;count++;sum+=w;
    mass+=w*b.x;inverse+=w*w/b.x;bm+=w*m;bv+=w*(b.yzw/b.x);
  }}}
  if(abs(sum-1.0)>4e-6||!(am.x>0.0)||!(a.x>0.0)||!finite(inverse)||!(inverse>0.0)){fail(512u);return;}
  let response=1.0/a.x+inverse;
  var impulse=vec3<f32>(0.0);var heat=0.0;
  if(k.y>=3u&&candidate.y>=3u){
    // Stiff binary mixture projection with the actual stencil response mass.
    // Multiple routes are applied in order; no global mixture convergence is
    // inferred from one sweep of these conservative local projections.
    impulse=(bv-av)/response;heat=0.5*dot(impulse,bv-av);
  }else{
    let ac=material(k);let bc=material(candidate);
    if(ac.z!=1.0||bc.z!=1.0){fail(512u);return;}
    var result:SchroederPhaseVolumePressureDragResult;
    if(k.y<3u){
      result=schroeder_phase_volume_pressure_drag_pair(a.x,mass,1.0/a.x,inverse,am.x,bm.x,am.yzw,bm.yzw,
        av,bv,ac.x,bc.x,ac.y,bc.y,0.0,0.0,0.0,f(10),f(11),bitcast<f32>(topology[29]),f(8),f(9));
      impulse=result.drag_impulse;
    }else{
      result=schroeder_phase_volume_pressure_drag_pair(mass,a.x,inverse,1.0/a.x,bm.x,am.x,bm.yzw,am.yzw,
        bv,av,bc.x,ac.x,bc.y,ac.y,0.0,0.0,0.0,f(10),f(11),bitcast<f32>(topology[29]),f(8),f(9));
      impulse=-result.drag_impulse;
    }
    if(result.valid!=1u){fail(1024u);return;}heat=result.drag_heat_j;
  }
  if(!finite(heat)||heat<0.0||!schroeder_phase_volume_finite_vec3(impulse)){fail(1024u);return;}
  if(!apply(&fine,i,impulse,0.5*heat)){fail(1024u);return;}
  book_impulse(p(30),i,impulse);
  for(var e=0u;e<count;e++){
    if(!apply(&coarse,indices[e],-weights[e]*impulse,0.5*weights[e]*heat)){fail(1024u);return;}
    book_impulse(p(31),indices[e],-weights[e]*impulse);
  }
}
@compute @workgroup_size(64) fn exchange_color(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){
  let i=id.x+id.y*groups.x*64u;
  if(atomicLoad(&fine[27])!=0u||atomicLoad(&coarse[27])!=0u||i>=topology[35]){return;}
  let k=key(i);if(i>0u&&key(i-1u).x==k.x){return;}
  let coord=vec3<u32>(k.x/(topology[21]*topology[22]),(k.x/topology[22])%topology[21],k.x%topology[22]);
  if((coord.x%6u)*36u+(coord.y%6u)*6u+coord.z%6u!=p(1)){return;}
  var stop=i+1u;while(stop<topology[35]&&key(stop).x==k.x){stop++;}
  for(var field=i;field<stop;field++){
    let point=fine_position(field)/bitcast<f32>(topology[29])+vec3<f32>(f32(topology[27]));
    let node=vec3<i32>(floor(point));let dims=vec3<i32>(i32(topology[23]),i32(topology[24]),i32(topology[25]));
    if(any(node<vec3<i32>(0))||any(node>=dims)){continue;}
    let dense=u32((node.x*dims.y+node.y)*dims.z+node.z);
    var candidate=coarse_lower(vec4<u32>(dense,0u,0u,0u));
    while(candidate<atomicLoad(&coarse[17])&&coarse_key(candidate).x==dense){exchange(field,coarse_key(candidate));candidate++;}
  }
}
fn validate_row(buffer:ptr<storage,array<atomic<u32>>,read_write>,i:u32,spacing:f32)->bool{
  if(i>=atomicLoad(&(*buffer)[17])){return true;}
  let row=load_row(buffer,i);let budget=bitcast<f32>(atomicLoad(&(*buffer)[64u+i*8u+7u]));
  var kinetic=0.0;if(row.x>0.0){kinetic=0.5*dot(row.yzw/row.x,row.yzw);}
  if(!finite(budget)||!finite(kinetic)||budget<0.0||kinetic>budget+max(1e-12,abs(budget)*3e-5)
    ||!mechanics_within_speed(row.yzw,row.x,f(9)*spacing/f(8))){return false;}
  return true;
}
@compute @workgroup_size(64) fn validate_cross(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){
  let i=id.x+id.y*groups.x*64u;
  if(!validate_row(&fine,i,bitcast<f32>(topology[28]))||!validate_row(&coarse,i,bitcast<f32>(topology[29]))){fail(2048u);}
}
@compute @workgroup_size(1) fn seal_cross(){
  if(atomicLoad(&fine[27])!=0u||atomicLoad(&coarse[27])!=0u){atomicStore(&fine[2],5u);atomicStore(&coarse[2],5u);}
}
@compute @workgroup_size(1) fn admit_cross_angular(){
  let delta=vec3<f32>(bitcast<f32>(atomicLoad(&impulse_ledger[0])),bitcast<f32>(atomicLoad(&impulse_ledger[1])),bitcast<f32>(atomicLoad(&impulse_ledger[2])));
  let scale=bitcast<f32>(atomicLoad(&impulse_ledger[3]));
  if(atomicLoad(&impulse_ledger[4])!=0u||!finite(scale)||!schroeder_phase_volume_finite_vec3(delta)
    ||length(delta)>max(1e-12,3e-5*scale)){
    fail(4096u);atomicStore(&fine[2],5u);atomicStore(&coarse[2],5u);
  }
}
`;

// Track only the additional cross-interface impulse through the exact same
// mass-weighted downward map. This is a GPU accounting sidecar, not another
// mechanics solver. Its final native torque must vanish before publication.
export const schroederSpatialChainCrossImpulseProlongWgsl = /* wgsl */ `
struct Params {words:array<vec4<u32>,16>};
@group(0) @binding(0) var<storage,read> topology:array<u32>;
@group(0) @binding(1) var<storage,read> original:array<u32>;
@group(0) @binding(2) var<storage,read> fine:array<u32>;
@group(0) @binding(3) var<storage,read> coarse:array<u32>;
@group(0) @binding(4) var<storage,read_write> ledger:array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params:Params;
fn p(i:u32)->u32{return params.words[i/4u][i%4u];}
fn parent_delta(i:u32,mass:f32)->vec3<f32>{
  let m=bitcast<f32>(original[original[32]+i*8u]);if(mass==0.0||m==0.0){return vec3<f32>(0.0);}
  let at=p(29)+i*3u;
  return (mass/m)*vec3<f32>(bitcast<f32>(atomicLoad(&ledger[at])),bitcast<f32>(atomicLoad(&ledger[at+1u])),bitcast<f32>(atomicLoad(&ledger[at+2u])));
}
@compute @workgroup_size(64) fn prolong_impulse(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){
  let i=id.x+id.y*groups.x*64u;if(fine[2]!=3u||coarse[2]!=3u){return;}
  if(i<fine[17]){
    let mass=bitcast<f32>(fine[64u+i*8u]);var delta=vec3<f32>(0.0);
    let begin=topology[topology[51]+i];let end=topology[topology[51]+i+1u];
    for(var e=begin;e<end;e++){delta+=bitcast<f32>(topology[topology[53]+e])*parent_delta(topology[topology[52]+e],mass);}
    for(var a=0u;a<3u;a++){atomicStore(&ledger[p(30)+i*3u+a],bitcast<u32>(delta[a]));}
  }
  if(i<coarse[17]){
    let delta=parent_delta(topology[topology[54]+i],bitcast<f32>(coarse[64u+i*8u]));
    for(var a=0u;a<3u;a++){atomicStore(&ledger[p(31)+i*3u+a],bitcast<u32>(delta[a]));}
  }
}
`;

export const schroederSpatialChainCrossAngularReductionWgsl = /* wgsl */ `
struct Params {words:array<vec4<u32>,16>};
@group(0) @binding(0) var<storage,read> field:array<u32>;
@group(0) @binding(1) var<storage,read_write> ledger:array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params:Params;
var<workgroup> partial:array<vec4<f32>,64>;
fn p(i:u32)->u32{return params.words[i/4u][i%4u];}
fn add(at:u32,increment:f32){
  if(increment==0.0){return;}var old=atomicLoad(&ledger[at]);
  loop{
    let next=bitcast<f32>(old)+increment;
    if((bitcast<u32>(next)&0x7f800000u)==0x7f800000u){atomicOr(&ledger[4],1u);return;}
    let result=atomicCompareExchangeWeak(&ledger[at],old,bitcast<u32>(next));if(result.exchanged){return;}old=result.old_value;
  }
}
@compute @workgroup_size(64) fn reduce_angular(@builtin(global_invocation_id) id:vec3<u32>,@builtin(local_invocation_id) local:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){
  let i=id.x+id.y*groups.x*64u;var value=vec4<f32>(0.0);
  if(i<field[34]){
    let dense=field[field[26]+i*4u];let coords=vec3<f32>(f32(dense/(field[20]*field[21])),f32((dense/field[21])%field[20]),f32(dense%field[21]));
    let pos=(coords-vec3<f32>(f32(field[22])))*bitcast<f32>(field[23]);
    let at=p(33)+i*3u;let j=vec3<f32>(bitcast<f32>(atomicLoad(&ledger[at])),bitcast<f32>(atomicLoad(&ledger[at+1u])),bitcast<f32>(atomicLoad(&ledger[at+2u])));
    value=vec4<f32>(cross(pos,j),length(pos)*length(j));
  }
  partial[local.x]=value;workgroupBarrier();
  for(var stride=32u;stride>0u;stride/=2u){if(local.x<stride){partial[local.x]+=partial[local.x+stride];}workgroupBarrier();}
  if(local.x==0u){for(var a=0u;a<4u;a++){add(a,partial[0][a]);}}
}
`;
