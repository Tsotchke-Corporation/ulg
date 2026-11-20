// The same adjacent CSR defines restriction R and its transpose R^T.
// Rows retain each material/family/domain key in the original topology.
// Coarse native volume is injected once, after restricting inherited volume.
// The phase-moment variant transports (V, grad V), including gas, with the
// same linear operator. It has a distinct magic and four-word row layout;
// condensed EOS occupancy remains the original scalar specialization.
export function createSchroederSpatialChainVolumeWgsl({ phaseMoments = false } = {}) {
  if (typeof phaseMoments !== 'boolean') throw new TypeError('phaseMoments must be explicit boolean');
  const width = phaseMoments ? 4 : 1;
  const load = (buffer, start) => phaseMoments
    ? `vec4<f32>(bitcast<f32>(${buffer}[${start}]),bitcast<f32>(${buffer}[${start}+1u]),bitcast<f32>(${buffer}[${start}+2u]),bitcast<f32>(${buffer}[${start}+3u]))`
    : `bitcast<f32>(${buffer}[${start}])`;
  return /* wgsl */ `
struct Params { words: array<vec4<u32>, 8> };
@group(0) @binding(0) var<storage,read> topology:array<u32>;
@group(0) @binding(1) var<storage,read> source_keys:array<u32>;
@group(0) @binding(2) var<storage,read> source_control:array<u32>;
@group(0) @binding(3) var<storage,read> source_rows:array<u32>;
@group(0) @binding(4) var<storage,read> native_control:array<u32>;
@group(0) @binding(5) var<storage,read> native_rows:array<u32>;
@group(0) @binding(6) var<storage,read_write> output:array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params:Params;
const MAGIC:u32=${phaseMoments ? '0x53435031' : '0x53435631'}u;
const ROW_WORDS:u32=${width}u;
alias Value = ${phaseMoments ? 'vec4<f32>' : 'f32'};
fn p(i:u32)->u32 { return params.words[i/4u][i%4u]; }
fn finite(v:f32)->bool { return (bitcast<u32>(v)&0x7f800000u)!=0x7f800000u; }
fn valid_value(v:Value)->bool { return ${phaseMoments
  ? 'finite(v.x) && finite(v.y) && finite(v.z) && finite(v.w) && v.x>=0.0 && (v.x>0.0 || all(v.yzw==vec3<f32>(0.0)))'
  : 'finite(v) && v>=0.0'}; }
fn fits(offset:u32,count:u32,stride:u32,size:u32)->bool {
  return offset<=size && count<=(size-offset)/stride;
}
fn fail(mask:u32) { atomicOr(&output[3],mask); }
fn inherited()->bool { return p(0)>0u; }
fn condensed(family:u32)->bool { return family==1u || family==2u; }
fn count()->u32 { if(inherited()){return source_control[5];} return source_control[18]; }
fn key(i:u32)->vec4<u32> {
  var offset=i*12u;
  if(inherited()){offset=source_keys[48]+i*4u;}
  return vec4<u32>(source_keys[offset],source_keys[offset+1u],source_keys[offset+2u],source_keys[offset+3u]);
}
fn native_key(i:u32)->vec4<u32> {
  let offset=i*12u;
  return vec4<u32>(native_rows[offset],native_rows[offset+1u],native_rows[offset+2u],native_rows[offset+3u]);
}
fn less(a:vec4<u32>,b:vec4<u32>)->bool {
  for(var i=0u;i<4u;i++){if(a[i]!=b[i]){return a[i]<b[i];}}return false;
}
fn find_source(k:vec4<u32>)->u32 {
  var lo=0u;var hi=count();
  while(lo<hi){let mid=lo+(hi-lo)/2u;if(less(key(mid),k)){lo=mid+1u;}else{hi=mid;}}
  if(lo<count() && all(key(lo)==k)){return lo;}return 0xffffffffu;
}
fn find_native(k:vec4<u32>)->u32 {
  var lo=0u;var hi=native_control[18];
  while(lo<hi){let mid=lo+(hi-lo)/2u;if(less(native_key(mid),k)){lo=mid+1u;}else{hi=mid;}}
  if(lo<native_control[18] && all(native_key(lo)==k)){return lo;}return 0xffffffffu;
}
fn moment_ready(c:ptr<storage,array<u32>,read>,capacity:u32,ordinal:u32,level:u32)->bool {
  if(arrayLength(c)<64u){return false;}
  if((*c)[0]!=0x53505631u || (*c)[1]!=1u || (*c)[2]!=3u || (*c)[18]>capacity
    || (*c)[19]!=capacity || (*c)[20]!=level || (*c)[23]!=ordinal
    || (*c)[28]!=0u || (*c)[29]!=12u || (*c)[37]!=0u || (*c)[38]!=0u){return false;}
  for(var w=3u;w<=15u;w++){if((*c)[w]!=p(w+5u)){return false;}}
  return true;
}
@compute @workgroup_size(1)
fn initialize_volume(){
  atomicStore(&output[0],MAGIC);atomicStore(&output[1],1u);atomicStore(&output[2],1u);
  atomicStore(&output[4],p(1));atomicStore(&output[6],p(2));
  atomicStore(&output[21],p(21));atomicStore(&output[22],p(3));
  for(var w=8u;w<=20u;w++){atomicStore(&output[w],p(w));}
  ${phaseMoments ? 'atomicStore(&output[23],ROW_WORDS);' : ''}
  if(arrayLength(&topology)<80u || arrayLength(&output)<64u+p(1)*ROW_WORDS
    || !moment_ready(&native_control,p(7),p(5),p(21))
    || !fits(0u,native_control[18],12u,arrayLength(&native_rows))){fail(1u);return;}
  if(inherited()){
    if(arrayLength(&source_keys)<80u || arrayLength(&source_control)<64u
      || source_keys[0]!=0x53504631u || source_keys[2]!=3u || source_keys[44]!=p(4)
      || source_control[0]!=MAGIC || source_control[1]!=1u || source_control[2]!=3u
      || source_control[3]!=0u || source_control[4]!=p(6) || source_control[5]!=source_keys[37]
      || source_control[6]!=p(2) || source_control[21]!=p(22) || source_control[22]!=p(4)
      ${phaseMoments ? '|| source_control[23]!=ROW_WORDS' : ''}
      || !fits(64u,source_control[5],ROW_WORDS,arrayLength(&source_rows))
      || !fits(source_keys[48],source_control[5],4u,arrayLength(&source_keys))){fail(2u);return;}
    for(var w=8u;w<=20u;w++){if(source_control[w]!=p(w) || source_keys[w-5u]!=p(w)){fail(2u);}}
  }else{
    if(!moment_ready(&source_control,p(6),p(4),p(22))
      || !fits(0u,source_control[18],12u,arrayLength(&source_rows))){fail(2u);return;}
  }
  let n=arrayLength(&topology);
  if(topology[0]!=0x53504631u || topology[1]!=1u || topology[2]!=3u
    || topology[16]!=p(22) || topology[17]!=p(21) || p(21)!=p(22)+1u
    || bitcast<f32>(topology[29])!=2.0*bitcast<f32>(topology[28])
    || topology[33]!=p(1) || topology[37]>p(1) || topology[35]!=count()
    || topology[36]!=native_control[18] || topology[44]!=p(3) || topology[67]!=2u
    || !fits(topology[48],topology[37],4u,n) || !fits(topology[50],count(),1u,n)
    || !fits(topology[51],count()+1u,1u,n) || !fits(topology[52],topology[38],1u,n)
    || !fits(topology[53],topology[38],1u,n) || !fits(topology[54],native_control[18],1u,n)){
    fail(4u);return;
  }
  for(var w=3u;w<=15u;w++){if(topology[w]!=p(w+5u)){fail(4u);}}
  atomicStore(&output[5],topology[37]);
}
fn source_volume(i:u32)->Value {
  if(inherited()){return ${load('source_rows', '64u+i*ROW_WORDS')};}
  if(source_rows[i*12u+9u]!=3u){fail(8u);return Value(-1.0);}
  ${phaseMoments ? '' : 'if(!condensed(source_rows[i*12u+1u])){return 0.0;}'}
  return ${load('source_rows', 'i*12u+4u')};
}
@compute @workgroup_size(64)
fn restrict_volume(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){
  let destination=id.x+id.y*groups.x*64u;
  if(atomicLoad(&output[3])!=0u || destination>=atomicLoad(&output[5])){return;}
  let offset=topology[48]+destination*4u;
  let k=vec4<u32>(topology[offset],topology[offset+1u],topology[offset+2u],topology[offset+3u]);
  let dims=vec3<u32>(topology[23],topology[24],topology[25]);
  let fine_dims=vec3<i32>(i32(topology[20]),i32(topology[21]),i32(topology[22]));
  if(any(dims==vec3<u32>(0u)) || any(fine_dims<=vec3<i32>(0))){fail(4u);return;}
  let coarse=vec3<i32>(i32(k.x/(dims.y*dims.z)),i32((k.x/dims.z)%dims.y),i32(k.x%dims.z));
  let center=2*(coarse-vec3<i32>(i32(topology[27])))+vec3<i32>(i32(topology[26]));
  var volume=Value(0.0);
  for(var x=-1;x<=1;x++){for(var y=-1;y<=1;y++){for(var z=-1;z<=1;z++){
    let coord=center+vec3<i32>(x,y,z);
    if(any(coord<vec3<i32>(0)) || any(coord>=fine_dims)){continue;}
    let dense=u32((coord.x*fine_dims.y+coord.y)*fine_dims.z+coord.z);
    let source=find_source(vec4<u32>(dense,k.yzw));if(source==0xffffffffu){continue;}
    let begin=topology[topology[51]+source];let end=topology[topology[51]+source+1u];
    if(end<=begin || end>topology[38] || end-begin>8u || end-begin!=topology[topology[50]+source]){fail(16u);return;}
    var weight=0.0;var sum=0.0;
    for(var e=begin;e<end;e++){
      let parent=topology[topology[52]+e];let w=bitcast<f32>(topology[topology[53]+e]);
      if(parent>=topology[37] || !finite(w) || !(w>0.0) || w>1.0){fail(16u);return;}
      sum+=w;if(parent==destination){weight+=w;}
    }
    if(abs(sum-1.0)>4e-6){fail(16u);return;}
    let v=source_volume(source);if(!valid_value(v)){fail(8u);return;}
    volume+=weight*v;
  }}}
  let native=find_native(k);
  if(native!=0xffffffffu){
    if(topology[topology[54]+native]!=destination || native_rows[native*12u+9u]!=3u){fail(32u);return;}
    if(${phaseMoments ? 'true' : 'condensed(k.y)'}){
      let v=${load('native_rows', 'native*12u+4u')};if(!valid_value(v)){fail(8u);return;}volume+=v;
    }
  }
  if(!valid_value(volume)){fail(8u);return;}
  ${phaseMoments
    ? 'for(var axis=0u;axis<ROW_WORDS;axis++){atomicStore(&output[64u+destination*ROW_WORDS+axis],bitcast<u32>(volume[axis]));}'
    : 'atomicStore(&output[64u+destination],bitcast<u32>(volume));'}
}
@compute @workgroup_size(1)
fn seal_volume(){atomicStore(&output[2],select(3u,5u,atomicLoad(&output[3])!=0u));}
`;
}

export const schroederSpatialChainVolumeWgsl = createSchroederSpatialChainVolumeWgsl();

export function createSchroederSpatialChainVolumeAdjointWgsl({ phaseMoments = false } = {}) {
  if (typeof phaseMoments !== 'boolean') throw new TypeError('phaseMoments must be explicit boolean');
  const width = phaseMoments ? 4 : 1;
  return /* wgsl */ `
struct Params { words:array<vec4<u32>,8> };
@group(0) @binding(0) var<storage,read> topology:array<u32>;
@group(0) @binding(1) var<storage,read> volume:array<u32>;
@group(0) @binding(2) var<storage,read> coarse:array<u32>;
@group(0) @binding(3) var<storage,read_write> fine:array<atomic<u32>>;
@group(0) @binding(4) var<storage,read_write> native:array<atomic<u32>>;
@group(0) @binding(5) var<storage,read_write> admission:array<atomic<u32>>;
@group(0) @binding(6) var<uniform> params:Params;
const MAGIC:u32=${phaseMoments ? '0x53435031' : '0x53435631'}u;
const ROW_WORDS:u32=${width}u;
fn p(i:u32)->u32{return params.words[i/4u][i%4u];}
fn finite(v:f32)->bool{return (bitcast<u32>(v)&0x7f800000u)!=0x7f800000u;}
fn fail(mask:u32){atomicOr(&admission[3],mask);}
@compute @workgroup_size(1)
fn initialize_adjoint(){
  if(volume[0]!=MAGIC || volume[2]!=3u || volume[3]!=0u || volume[6]!=p(2)
    || volume[22]!=p(3) || topology[2]!=3u || topology[44]!=p(3)
    || topology[37]!=volume[5] || arrayLength(&coarse)<p(24)+topology[37]*ROW_WORDS
    ${phaseMoments ? '|| volume[23]!=ROW_WORDS' : ''}){fail(1u);return;}
  if(p(25)==0u && (coarse[0]!=MAGIC || coarse[2]!=3u || coarse[3]!=0u
    || coarse[5]!=topology[37] || coarse[6]!=p(2)
    ${phaseMoments ? '|| coarse[23]!=ROW_WORDS' : ''})){fail(2u);return;}
  atomicStore(&fine[0],MAGIC);atomicStore(&fine[1],1u);atomicStore(&fine[2],1u);
  atomicStore(&fine[5],topology[35]);atomicStore(&fine[6],p(2));atomicStore(&fine[7],1u);
  atomicStore(&native[0],MAGIC);atomicStore(&native[1],1u);atomicStore(&native[2],1u);
  atomicStore(&native[5],topology[36]);atomicStore(&native[6],p(2));atomicStore(&native[7],1u);
  ${phaseMoments ? 'atomicStore(&fine[23],ROW_WORDS);atomicStore(&native[23],ROW_WORDS);' : ''}
}
@compute @workgroup_size(64)
fn pullback(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){
  if(atomicLoad(&admission[3])!=0u){return;}
  let i=id.x+id.y*groups.x*64u;
  if(i<topology[35]){
    let begin=topology[topology[51]+i];let end=topology[topology[51]+i+1u];
    if(end<=begin || end>topology[38] || end-begin>8u){fail(4u);return;}
    for(var component=0u;component<ROW_WORDS;component++){
      var value=0.0;
      for(var e=begin;e<end;e++){
        let parent=topology[topology[52]+e];let w=bitcast<f32>(topology[topology[53]+e]);
        if(parent>=topology[37] || !finite(w) || !(w>0.0) || w>1.0){fail(4u);return;}
        let v=bitcast<f32>(coarse[p(24)+parent*ROW_WORDS+component]);if(!finite(v)){fail(8u);return;}value+=w*v;
      }
      if(!finite(value)){fail(8u);return;}atomicStore(&fine[64u+i*ROW_WORDS+component],bitcast<u32>(value));
    }
  }
  if(i<topology[36]){
    let parent=topology[topology[54]+i];if(parent>=topology[37]){fail(4u);return;}
    for(var component=0u;component<ROW_WORDS;component++){
      let value=bitcast<f32>(coarse[p(24)+parent*ROW_WORDS+component]);if(!finite(value)){fail(8u);return;}
      atomicStore(&native[64u+i*ROW_WORDS+component],bitcast<u32>(value));
    }
  }
}
@compute @workgroup_size(1)
fn seal_adjoint(){
  let error=atomicLoad(&admission[3]);
  atomicStore(&fine[3],error);atomicStore(&native[3],error);
  atomicStore(&fine[2],select(3u,5u,error!=0u));atomicStore(&native[2],select(3u,5u,error!=0u));
  if(p(0)==0u){atomicStore(&admission[0],MAGIC);atomicStore(&admission[2],select(3u,5u,error!=0u));}
}
`;
}

export const schroederSpatialChainVolumeAdjointWgsl = createSchroederSpatialChainVolumeAdjointWgsl();
