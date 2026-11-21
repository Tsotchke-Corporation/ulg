import { SCHROEDER_SPATIAL_COMPOSITE_MECHANICS_MAGIC } from './schroederSpatialCompositeMechanics.js';

// Deterministic gather: a dyadic trilinear parent receives at most 27 fine
// nodes with the same family/material/domain. Each destination runs in
// parallel, finds those keys in the sorted source dictionary, and consumes
// the admitted CSR weights. No floating atomics, quantization, dense grid,
// CPU adjacency, or scan of all source fields is required.
export const schroederSpatialCompositeMechanicsWgsl = /* wgsl */ `
struct Params { words: array<vec4<u32>, 8> };
@group(0) @binding(0) var<storage, read> topology: array<u32>;
@group(0) @binding(1) var<storage, read> source_topology: array<u32>;
@group(0) @binding(2) var<storage, read> source_state: array<u32>;
@group(0) @binding(3) var<storage, read> native: array<u32>;
@group(0) @binding(4) var<storage, read_write> result: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: Params;
const MAGIC: u32 = ${SCHROEDER_SPATIAL_COMPOSITE_MECHANICS_MAGIC}u;
fn param(i: u32) -> u32 { return params.words[i / 4u][i % 4u]; }
fn inherited() -> bool { return param(0u) == 1u; }
fn fail(mask: u32) { atomicOr(&result[27u], mask); }
fn finite(v: f32) -> bool { return (bitcast<u32>(v) & 0x7f800000u) != 0x7f800000u; }
fn range_ok(offset: u32, count: u32, stride: u32, size: u32) -> bool {
  return offset <= size && count <= (size - offset) / stride;
}
fn source_count() -> u32 { return select(source_topology[34u], source_topology[37u], inherited()); }
fn source_keys() -> u32 { return select(source_topology[26u], source_topology[48u], inherited()); }
fn source_key(i: u32) -> vec4<u32> {
  let k = source_keys() + i * 4u;
  return vec4<u32>(source_topology[k], source_topology[k+1u], source_topology[k+2u], source_topology[k+3u]);
}
fn native_key(i: u32) -> vec4<u32> {
  let k = native[26u] + i * 4u;
  return vec4<u32>(native[k], native[k+1u], native[k+2u], native[k+3u]);
}
fn less(a: vec4<u32>, b: vec4<u32>) -> bool {
  for (var j=0u; j<4u; j++) { if (a[j] != b[j]) { return a[j] < b[j]; } }
  return false;
}
fn find_source(key: vec4<u32>) -> u32 {
  var lo = 0u; var hi = source_count();
  while (lo < hi) { let mid = lo + (hi-lo)/2u;
    if (less(source_key(mid), key)) { lo = mid+1u; } else { hi = mid; }
  }
  if (lo < source_count() && all(source_key(lo) == key)) { return lo; }
  return 0xffffffffu;
}
fn find_native(key: vec4<u32>) -> u32 {
  var lo = 0u; var hi = native[34u];
  while (lo < hi) { let mid = lo + (hi-lo)/2u;
    if (less(native_key(mid), key)) { lo = mid+1u; } else { hi = mid; }
  }
  if (lo < native[34u] && all(native_key(lo) == key)) { return lo; }
  return 0xffffffffu;
}
fn native_header_ok() -> bool {
  let n = arrayLength(&native);
  return n >= 64u && native[0u] == 0x53464635u && native[1u] == 5u
    && native[2u] == 3u && native[17u] == param(24u)
    && native[38u] == param(7u) && native[59u] == 1u && native[63u] == param(3u)
    && native[32u] == param(26u) && native[34u] <= native[32u]
    && native[27u] == 4u && native[31u] == 8u
    && range_ok(native[26u], native[34u], 4u, n)
    && range_ok(native[30u], native[34u], 8u, n);
}
fn source_header_ok() -> bool {
  let t = arrayLength(&source_topology); let n = arrayLength(&source_state);
  if (inherited()) {
    return t >= 80u && n >= 64u
      && source_topology[0u] == 0x53504631u && source_topology[1u] == 1u
      && source_topology[2u] == 3u && source_topology[17u] == param(23u)
      && source_topology[44u] == param(6u) && source_topology[49u] == 4u
      && source_topology[33u] == param(22u) && source_topology[37u] <= param(22u)
      && range_ok(source_topology[48u], source_topology[37u], 4u, t)
      && source_state[0u] == MAGIC && source_state[1u] == 1u && source_state[2u] == 3u
      && source_state[16u] == param(23u) && source_state[17u] == source_topology[37u]
      && source_state[18u] == param(22u) && source_state[19u] == 64u
      && source_state[20u] == 8u && source_state[25u] == param(21u)
      && source_state[26u] == param(6u) && source_state[27u] == 0u && source_state[28u] == 1u
      && source_state[32u] == 64u + param(22u)*8u
      && (param(27u)==0u || (source_state[33u]==64u+param(22u)*16u && source_state[34u]==3u
        && source_state[35u]==1u && range_ok(source_state[33u],source_state[17u],3u,n)))
      && range_ok(source_state[32u], source_state[17u], 8u, n);
  }
  return t >= 64u && n >= 64u && source_topology[0u] == 0x53464635u
    && source_topology[1u] == 5u && source_topology[2u] == 3u
    && source_topology[17u] == param(23u) && source_topology[38u] == param(6u)
    && source_topology[32u] == param(25u) && source_topology[34u] <= param(25u)
    && source_topology[27u] == 4u && source_state[31u] == 8u
    && source_state[59u] == 1u && source_state[63u] == param(2u)
    && range_ok(source_topology[26u], source_topology[34u], 4u, t)
    && range_ok(source_state[30u], source_topology[34u], 8u, n);
}
@compute @workgroup_size(1)
fn initialize() {
  atomicStore(&result[0u], MAGIC); atomicStore(&result[1u], 1u);
  atomicStore(&result[2u], 1u);
  for (var w=3u; w<=15u; w++) { atomicStore(&result[w], param(w+5u)); }
  atomicStore(&result[16u], param(24u)); atomicStore(&result[18u], param(1u));
  atomicStore(&result[19u], 64u); atomicStore(&result[20u], 8u);
  atomicStore(&result[23u], param(2u)); atomicStore(&result[24u], param(3u));
  atomicStore(&result[25u], param(4u)); atomicStore(&result[26u], param(5u));
  atomicStore(&result[28u], 1u); atomicStore(&result[29u], param(0u));
  atomicStore(&result[30u], param(6u)); atomicStore(&result[31u], param(7u));
  atomicStore(&result[32u], 64u+param(1u)*8u);
  if(param(27u)==1u){
    atomicStore(&result[33u],64u+param(1u)*16u);atomicStore(&result[34u],3u);atomicStore(&result[35u],1u);
    if(!range_ok(64u+param(1u)*16u,param(1u),3u,arrayLength(&result))){fail(64u);return;}
  }
  if (arrayLength(&topology) < 80u || !source_header_ok() || !native_header_ok()) { fail(1u); return; }
  let n = arrayLength(&topology);
  if (topology[0u] != 0x53504631u || topology[1u] != 1u || topology[2u] != 3u
    || topology[16u] != param(23u) || topology[17u] != param(24u)
    || topology[17u] != topology[16u]+1u || topology[67u] != 2u
    || bitcast<f32>(topology[29u]) != 2.0*bitcast<f32>(topology[28u])
    || topology[44u] != param(5u) || topology[46u] != param(6u) || topology[47u] != param(7u)
    || topology[33u] != param(1u) || topology[37u] > param(1u)
    || topology[35u] != source_count() || topology[36u] != native[34u]
    || topology[49u] != 4u || topology[38u] > topology[34u]
    || !range_ok(topology[48u], topology[37u], 4u, n)
    || !range_ok(topology[50u], topology[35u], 1u, n)
    || !range_ok(topology[51u], topology[35u]+1u, 1u, n)
    || !range_ok(topology[52u], topology[38u], 1u, n)
    || !range_ok(topology[53u], topology[38u], 1u, n)
    || !range_ok(topology[54u], topology[36u], 1u, n)) { fail(2u); return; }
  for (var w=3u; w<=15u; w++) {
    if (topology[w] != param(w+5u) || source_topology[w] != param(w+5u)
      || source_state[w] != param(w+5u) || native[w] != param(w+5u)) { fail(4u); }
  }
  let source_dims = select(19u,23u,inherited());
  let source_shift = select(22u,27u,inherited());
  let source_spacing = select(23u,29u,inherited());
  for (var axis=0u; axis<3u; axis++) {
    if (source_topology[source_dims+axis] != topology[20u+axis]
      || native[19u+axis] != topology[23u+axis]) { fail(2u); }
  }
  if (source_topology[source_shift] != topology[26u] || source_topology[source_spacing] != topology[28u]
    || native[22u] != topology[27u] || native[23u] != topology[29u]) { fail(2u); }
  atomicStore(&result[17u], topology[37u]);
  atomicStore(&result[21u], source_count()); atomicStore(&result[22u], native[34u]);
}
fn source_row(i: u32) -> array<f32, 8> {
  let start = select(source_state[30u], source_state[32u], inherited()) + i*8u;
  var row: array<f32, 8>;
  for (var w=0u; w<7u; w++) { row[w] = bitcast<f32>(source_state[start+w]); }
  if (inherited()) { row[7u] = bitcast<f32>(source_state[start+7u]); }
  else {
    if ((source_state[start+7u] > 0u) != (row[0u] > 0.0)
      || source_state[start+7u] == 0xffffffffu) { fail(8u); }
    if (row[0u] > 0.0) { let v = vec3<f32>(row[1u],row[2u],row[3u]) / row[0u]; row[7u] = 0.5 * row[0u] * dot(v,v); }
  }
  return row;
}
fn native_row(i: u32) -> array<f32, 8> {
  let start = native[30u] + i*8u; var row: array<f32, 8>;
  for (var w=0u; w<7u; w++) { row[w] = bitcast<f32>(native[start+w]); }
  if ((native[start+7u] > 0u) != (row[0u] > 0.0) || native[start+7u] == 0xffffffffu) { fail(8u); }
  if (row[0u] > 0.0) { let v = vec3<f32>(row[1u],row[2u],row[3u]) / row[0u]; row[7u] = 0.5 * row[0u] * dot(v,v); }
  return row;
}
fn valid_row(row: array<f32, 8>) -> bool {
  for (var w=0u; w<8u; w++) { if (!finite(row[w]) || (row[0u] == 0.0 && row[w] != 0.0)) { return false; } }
  if (row[0u] < 0.0 || row[7u] < 0.0) { return false; }
  if (row[0u] > 0.0) {
    let v = vec3<f32>(row[1u],row[2u],row[3u]) / row[0u]; let kinetic = 0.5 * row[0u] * dot(v,v);
    if (!finite(kinetic) || kinetic > row[7u] + max(1e-12, abs(row[7u])*2e-5)) { return false; }
  }
  return true;
}
@compute @workgroup_size(64)
fn restrict_and_combine(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) groups: vec3<u32>) {
  let destination = id.x + id.y*groups.x*64u;
  if (atomicLoad(&result[27u]) != 0u || destination >= atomicLoad(&result[17u])) { return; }
  let key_start = topology[48u]+destination*4u;
  let key = vec4<u32>(topology[key_start],topology[key_start+1u],topology[key_start+2u],topology[key_start+3u]);
  let dims = vec3<u32>(topology[23u],topology[24u],topology[25u]);
  let fine_dims = vec3<i32>(i32(topology[20u]),i32(topology[21u]),i32(topology[22u]));
  if (any(dims == vec3<u32>(0u)) || any(fine_dims <= vec3<i32>(0))) { fail(2u); return; }
  let coarse_coord = vec3<i32>(i32(key.x/(dims.y*dims.z)),i32((key.x/dims.z)%dims.y),i32(key.x%dims.z));
  let center = 2*(coarse_coord-vec3<i32>(i32(topology[27u])))+vec3<i32>(i32(topology[26u]));
  var baseline: array<f32, 8>;
  var first_moment=vec3<f32>(0.0);
  for (var x=-1; x<=1; x++) { for (var y=-1; y<=1; y++) { for (var z=-1; z<=1; z++) {
    let coord = center+vec3<i32>(x,y,z);
    if (any(coord < vec3<i32>(0)) || any(coord >= fine_dims)) { continue; }
    let node = u32((coord.x*fine_dims.y+coord.y)*fine_dims.z+coord.z);
    let source = find_source(vec4<u32>(node,key.yzw));
    if (source == 0xffffffffu) { continue; }
    let begin = topology[topology[51u]+source]; let end = topology[topology[51u]+source+1u];
    if (end <= begin || end > topology[38u] || end-begin > 8u
      || end-begin != topology[topology[50u]+source]) { fail(16u); return; }
    var weight = 0.0; var weight_sum = 0.0;
    for (var e=begin; e<end; e++) {
      let parent = topology[topology[52u]+e]; let w = bitcast<f32>(topology[topology[53u]+e]);
      if (parent >= topology[37u] || !finite(w) || w <= 0.0 || w > 1.0) { fail(16u); return; }
      weight_sum += w;
      if (parent == destination) { weight += w; }
    }
    if (abs(weight_sum-1.0) > 0.000004) { fail(16u); return; }
    if (weight > 0.0) {
      let row = source_row(source); if (!valid_row(row)) { fail(8u); return; }
      for (var w=0u; w<8u; w++) { baseline[w] += weight*row[w]; }
      if(param(27u)==1u){
        var source_moment=row[0]*(vec3<f32>(coord)-vec3<f32>(f32(topology[26u])))*bitcast<f32>(topology[28u]);
        if(inherited()){
          let at=source_state[33u]+source*3u;
          source_moment=vec3<f32>(bitcast<f32>(source_state[at]),bitcast<f32>(source_state[at+1u]),bitcast<f32>(source_state[at+2u]));
        }
        if(!finite(source_moment.x)||!finite(source_moment.y)||!finite(source_moment.z)
          ||(row[0]==0.0&&any(source_moment!=vec3<f32>(0.0)))){fail(64u);return;}
        first_moment+=weight*source_moment;
      }
    }
  } } }
  var combined = baseline;
  let coarse = find_native(key);
  if (coarse != 0xffffffffu) {
    if (topology[topology[54u]+coarse] != destination) { fail(32u); return; }
    let row = native_row(coarse); if (!valid_row(row)) { fail(8u); return; }
    for (var w=0u; w<8u; w++) { combined[w] += row[w]; }
    if(param(27u)==1u){first_moment+=row[0]*(vec3<f32>(coarse_coord)-vec3<f32>(f32(topology[27u])))*bitcast<f32>(topology[29u]);}
  }
  if (!valid_row(baseline) || !valid_row(combined)) { fail(8u); return; }
  for (var w=0u; w<8u; w++) {
    atomicStore(&result[64u+destination*8u+w],bitcast<u32>(baseline[w]));
    atomicStore(&result[64u+param(1u)*8u+destination*8u+w],bitcast<u32>(combined[w]));
  }
  if(param(27u)==1u){
    for(var axis=0u;axis<3u;axis++){
      if(!finite(first_moment[axis])){fail(64u);return;}
      atomicStore(&result[64u+param(1u)*16u+destination*3u+axis],bitcast<u32>(first_moment[axis]));
    }
  }
}
@compute @workgroup_size(1)
fn seal() {
  if (atomicLoad(&result[27u]) != 0u) { atomicStore(&result[2u],5u); return; }
  atomicStore(&result[2u],3u);
  for (var w=60u; w<=62u; w++) { atomicStore(&result[w],topology[w]); }
}
`;
