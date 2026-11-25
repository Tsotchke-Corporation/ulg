import{Pf as e,Wf as t}from"./molecularDynamicsWebGpu-D3Vza8Ty.js";import{computeBufferBinding as n,createCachedExplicitComputePipeline as r}from"../runtime/webgpuComputeLayout.js";var i=128;function a(t=e){let n=(e,n)=>{let r=t.indexOf(e),i=t.indexOf(n,r+e.length);if(r<0||i<0||t.indexOf(e,r+1)>=0||t.indexOf(n,i+1)>=0)throw Error(`rejected-particle diagnostic lost unique production G2P anchor: ${e}`);return t.slice(r,i)};return Object.freeze({functions:n(`fn g2p_quadratic_weights(`,`fn g2p_cubic_root_positive(`),grid:n(`fn g2p_grid_index(`,`fn g2p_particle_enabled(`),setup:n(`  let p_grid = pos_mass.xyz * params.inv_grid_spacing_m;`,`  for (var a = 0i;`),accumulate:n(`        velocity = velocity + weight * grid_velocity;`,`
      }
    }
  }
  if (sampled_weight`),normalize:n(`  if (sampled_weight > 1.0e-8 && sampled_weight < 0.999999)`,`
  var position = pos_mass.xyz + params.dt * velocity;`)})}var o=a(),s=`
${t}
const FIELD_HEADER_WORDS: u32 = 64u;
const FIELD_DESCRIPTOR_WORDS: u32 = 32u;
const FIELD_KEY_WORDS: u32 = 4u;
const FIELD_ACCUMULATOR_WORDS: u32 = 8u;
const FIELD_RECEIPT_WORDS: u32 = 36u;
const FIELD_STATE_WORDS: u32 = 8u;
const FIELD_PRESSURE_WORDS: u32 = 4u;
const FIELD_TAIL_WORDS: u32 = FIELD_STATE_WORDS + FIELD_PRESSURE_WORDS;
@group(0) @binding(0) var<storage, read> field: array<u32>;
@group(0) @binding(1) var<storage, read> rejection: array<u32>;
@group(0) @binding(2) var<storage, read> active_source: array<u32>;
@group(0) @binding(3) var<storage, read> state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> mechanics: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> output: array<u32>;
var<private> evidence: array<u32, 128>;
var<workgroup> lane_packets: array<u32, 4096>;
struct Inputs {
  particle_count: u32, grid_spacing_m: f32, inv_grid_spacing_m: f32, pad2: u32,
  dt: f32, pressure_scale: f32, internal_pressure_scale: f32, pad3: f32
};
@group(0) @binding(6) var<uniform> inputs: Inputs;
struct GatherParams {
  grid_nx: u32, grid_ny: u32, grid_nz: u32, shift: u32,
  grid_spacing_m: f32, inv_grid_spacing_m: f32, dt: f32
};
var<private> params: GatherParams;
${o.functions}
${o.grid}
fn finite(x: f32) -> bool { return (bitcast<u32>(x) & 0x7f800000u) != 0x7f800000u; }
fn finite3(v: vec3<f32>) -> bool { return finite(v.x) && finite(v.y) && finite(v.z); }
fn fits(base: u32, count: u32, stride: u32, size: u32) -> bool {
  return stride > 0u && base <= size && count <= (size - base) / stride;
}
fn product_fits_u32(left: u32, right: u32) -> bool {
  // Division-free exact overflow check: variable unsigned division crashes
  // this desktop Vulkan pipeline compiler (also documented in live G2P).
  let high_left = left >> 16u; let high_right = right >> 16u;
  if (high_left != 0u && high_right != 0u) { return false; }
  let low_left = left & 0xffffu; let low_right = right & 0xffffu;
  // At most one term is nonzero, so this addition itself cannot overflow.
  let middle = high_left * low_right + low_left * high_right;
  if (middle > 0xffffu) { return false; }
  return low_left * low_right <= 0xffffffffu - (middle << 16u);
}
fn put(index: u32, value: f32) { evidence[index] = bitcast<u32>(value); }
fn value(index: u32) -> f32 { return bitcast<f32>(evidence[index]); }
fn determinant(rows: array<vec3<f32>, 3>) -> f32 {
  return g2p_det3(rows[0].x, rows[0].y, rows[0].z,
    rows[1].x, rows[1].y, rows[1].z, rows[2].x, rows[2].y, rows[2].z);
}
// This field-only eligibility is injected by createMechanicsFieldG2pWgsl,
// rather than present in the base shader. Source-equivalence tests pin its
// operation-conditioned check to production; it never claims an energy receipt.
fn pressure_admitted(field_index: u32) -> bool {
  if (field[32] > (0xffffffffu - field[30]) / FIELD_STATE_WORDS) { return false; }
  let base = field[30] + field[32] * FIELD_STATE_WORDS;
  if (!fits(base, field_index + 1u, FIELD_PRESSURE_WORDS, arrayLength(&field))) { return false; }
  let row = base + field_index * FIELD_PRESSURE_WORDS;
  let pressure_volume_moment = bitcast<f32>(field[row]);
  let represented_volume = bitcast<f32>(field[row + 1u]);
  let absolute_pressure = bitcast<f32>(field[row + 2u]);
  let contribution_count = field[row + 3u];
  if (!(represented_volume > 0.0) || !(absolute_pressure >= 0.0) || contribution_count == 0u
      || !finite(pressure_volume_moment) || !finite(represented_volume) || !finite(absolute_pressure)) { return false; }
  return g2p_scale_close(pressure_volume_moment, represented_volume * absolute_pressure, max(2u, contribution_count));
}
fn g2p_scale_close(left: f32, right: f32, count: u32) -> bool {
  if (left != left || right != right
      || abs(left) > 3.402823466e+38
      || abs(right) > 3.402823466e+38) { return false; }
  let n_epsilon = min(0.25, f32(max(1u, count)) * 5.960464477539063e-8);
  let gamma_n = n_epsilon / max(1.0e-20, 1.0 - n_epsilon);
  let tolerance = max(
    8.0 * 1.175494351e-38,
    gamma_n * (abs(left) + abs(right))
  );
  return abs(left - right) <= tolerance;
}
fn source_admitted() -> bool {
  if (arrayLength(&active_source) < 64u || arrayLength(&field) < FIELD_HEADER_WORDS) { return false; }
  if (active_source[0] != 0x53535631u || active_source[1] != 1u || active_source[2] != 3u
      || active_source[16] != inputs.particle_count || active_source[16] > active_source[17]
      || active_source[18] > active_source[16] || active_source[18] > active_source[19]
      || active_source[20] != active_source[16] - active_source[18] || active_source[21] != 0u || active_source[22] != 0u
      || active_source[23] != 1u || active_source[24] != 16u || active_source[25] != 64u
      || !fits(64u, active_source[19], 1u, arrayLength(&active_source))
      || active_source[26] != 64u + active_source[19]
      || !fits(active_source[26], active_source[17], 1u, arrayLength(&active_source))
      || active_source[27] != active_source[26] + active_source[17] || active_source[27] > arrayLength(&active_source)
      || active_source[29] != active_source[30] || active_source[30] == 0u
      || active_source[32] != active_source[16] || active_source[33] != active_source[18]
      || active_source[34] != active_source[18] || active_source[35] != active_source[18]) { return false; }
  var seal = (active_source[31] ^ active_source[25]) * 0x01000193u;
  seal = (seal ^ active_source[26]) * 0x01000193u;
  seal = (seal ^ active_source[27]) * 0x01000193u;
  seal = (seal ^ active_source[18]) * 0x01000193u;
  seal = (seal ^ active_source[20]) * 0x01000193u;
  seal = (seal ^ active_source[30]) * 0x01000193u;
  if (active_source[47] != seal) { return false; }
  for (var i = 3u; i < 16u; i++) { if (active_source[i] != field[i]) { return false; } }
  // Workspace rejection can mark the exact retained field fail-closed before
  // this diagnostic. Read that failed state, never promote it to admission.
  return field[0] == 0x53464635u && field[1] == 5u && (field[2] == 3u || field[2] == 7u)
    && field[16] == inputs.particle_count && field[24] == FIELD_HEADER_WORDS && field[25] == FIELD_DESCRIPTOR_WORDS
    && fits(field[24], inputs.particle_count, FIELD_DESCRIPTOR_WORDS, arrayLength(&field))
    && field[26] >= field[24] + inputs.particle_count * FIELD_DESCRIPTOR_WORDS
    && (field[26] - field[24]) % FIELD_DESCRIPTOR_WORDS == 0u
    && fits(field[26], field[32], FIELD_KEY_WORDS, arrayLength(&field))
    && field[28] == field[26] + field[32] * FIELD_KEY_WORDS && field[29] == FIELD_ACCUMULATOR_WORDS
    && fits(field[28], field[32], FIELD_ACCUMULATOR_WORDS, arrayLength(&field))
    && field[28] + field[32] * FIELD_ACCUMULATOR_WORDS <= arrayLength(&field) - FIELD_RECEIPT_WORDS
    && field[30] == field[28] + field[32] * FIELD_ACCUMULATOR_WORDS + FIELD_RECEIPT_WORDS
    && field[42] == arrayLength(&field)
    && fits(field[30], field[32], FIELD_TAIL_WORDS, arrayLength(&field))
    && arrayLength(&field) - field[30] == field[32] * FIELD_TAIL_WORDS
    && field[27] == FIELD_KEY_WORDS && field[31] == FIELD_STATE_WORDS && field[34] <= field[32]
    && fits(field[26], field[34], FIELD_KEY_WORDS, arrayLength(&field))
    && fits(field[30], field[34], FIELD_STATE_WORDS, arrayLength(&field))
    && field[59] == 2u;
}
fn write_witness(offset: u32, particle: u32, flags: u32, count: u32, weight: f32,
    pos: vec4<f32>, velocity: vec3<f32>, c: array<vec3<f32>, 3>,
    f: array<vec3<f32>, 3>, trial: array<vec3<f32>, 3>, raw_j: f32, effective_j: f32) {
  evidence[offset] = particle; evidence[offset + 1u] = flags; evidence[offset + 2u] = count;
  put(offset + 3u, weight);
  for (var i = 0u; i < 3u; i++) {
    put(offset + 4u + i, pos[i]); put(offset + 8u + i, velocity[i]);
    for (var j = 0u; j < 3u; j++) {
      put(offset + 12u + 3u*i + j, c[i][j]);
      put(offset + 21u + 3u*i + j, trial[i][j]);
      put(offset + 30u + 3u*i + j, f[i][j]);
    }
  }
  put(offset + 7u, pos.w); put(offset + 11u, raw_j); put(offset + 39u, effective_j);
}
fn gather(lane: u32) {
  for (var i = 0u; i < 128u; i++) { evidence[i] = 0u; }
  evidence[0] = 0x53504431u; evidence[1] = 1u;
  if (arrayLength(&rejection) != 64u || rejection[0] != 0x53444631u
      || rejection[1] != 1u) { evidence[2] = 2u; return; }
  if (rejection[2] == 0u) { return; }
  if (rejection[2] != 1u || rejection[11] != 7u
      || (rejection[3] & 0xffc10000u) != 0xc7000000u) { evidence[2] = 2u; return; }
  evidence[3] = rejection[4]; evidence[31] = rejection[3];
  if (!source_admitted()) { evidence[2] = 3u; return; }
  if (rejection[6] != field[3] || rejection[7] != field[38]
      || rejection[8] != field[63] || rejection[5] != field[17]
      || rejection[4] >= field[34] || rejection[60] != field[23]) { evidence[2] = 2u; return; }
  let selected_key = field[26] + rejection[4] * FIELD_KEY_WORDS;
  for (var i = 0u; i < 4u; i++) {
    if (field[selected_key + i] != rejection[12u + i]) { evidence[2] = 2u; return; }
    evidence[40u + i] = rejection[12u + i];
  }
  if (inputs.particle_count == 0u || inputs.particle_count > arrayLength(&state) / 2u
      || inputs.particle_count > arrayLength(&mechanics) / 8u
      || !finite(inputs.dt) || !(inputs.dt > 0.0)
      || bitcast<u32>(inputs.dt) != rejection[61]
      || bitcast<u32>(inputs.grid_spacing_m) != field[23]
      || !finite(inputs.inv_grid_spacing_m) || !(inputs.inv_grid_spacing_m > 0.0)
      || !finite(inputs.pressure_scale) || bitcast<u32>(inputs.pressure_scale) != rejection[62]
      || !finite(inputs.internal_pressure_scale)) { evidence[2] = 4u; return; }
  params = GatherParams(field[19], field[20], field[21], field[22],
    inputs.grid_spacing_m, inputs.inv_grid_spacing_m, inputs.dt);
  if (!finite(params.grid_spacing_m) || !(params.grid_spacing_m > 0.0)
      || !finite(params.inv_grid_spacing_m) || params.grid_nx == 0u
      || params.grid_ny == 0u || params.grid_nz == 0u
      || params.grid_nx > 2147483647u || params.grid_ny > 2147483647u
      || params.grid_nz > 2147483647u || params.shift > 2147483647u
      || !product_fits_u32(params.grid_nx, params.grid_ny)
      || !product_fits_u32(params.grid_nx * params.grid_ny, params.grid_nz)
      || params.grid_nx * params.grid_ny * params.grid_nz != field[18]) {
    evidence[2] = 4u; return;
  }
  evidence[12] = field[3]; evidence[13] = field[38]; evidence[14] = field[63];
  evidence[15] = field[17]; evidence[16] = inputs.particle_count; evidence[17] = active_source[18];
  evidence[45] = field[2];
  for (var i = 0u; i < 8u; i++) { evidence[32u + i] = field[8u + i]; }
  put(20u, 3.402823466e38); put(24u, 3.402823466e38); put(44u, 3.402823466e38);
  put(28u, inputs.dt); put(29u, inputs.internal_pressure_scale); put(30u, inputs.pressure_scale);
  // Strided workgroup lanes cover every source; witnesses never truncate the
  // population. No diagnostics enter production state or admission receipts.
  for (var ordinal = lane; ordinal < active_source[18]; ordinal = ordinal + 32u) {
    let particle = active_source[active_source[25] + ordinal];
    evidence[18]++;
    if (particle >= inputs.particle_count || active_source[active_source[26] + particle] != ordinal) {
      evidence[2] = 3u; return;
    }
    let descriptor = field[24] + particle * FIELD_DESCRIPTOR_WORDS;
    if (field[descriptor + 3u] == 0u) { continue; }
    if (field[descriptor + 3u] != 1u) { evidence[2] = 3u; return; }
    evidence[4]++;
    var contributes = false;
    for (var s = 0u; s < 27u; s++) {
      contributes = contributes || field[descriptor + 4u + s] == rejection[4];
    }
    if (!contributes) { continue; }
    evidence[5]++;
    let pos_mass = state[particle * 2u];
    let mechanics_base = particle * 8u;
    let row0 = mechanics[mechanics_base]; let row1 = mechanics[mechanics_base + 1u];
    let row2 = mechanics[mechanics_base + 2u];
    let row5 = mechanics[mechanics_base + 5u]; let row6 = mechanics[mechanics_base + 6u];
    let f = array<vec3<f32>, 3>(row0.xyz, vec3<f32>(row0.w, row1.x, row1.y),
      vec3<f32>(row1.z, row1.w, row2.x));
    if (!finite3(pos_mass.xyz) || !finite(pos_mass.w) || !(pos_mass.w > 0.0)
        || !finite3(f[0]) || !finite3(f[1]) || !finite3(f[2])
        || !finite(row5.x) || !finite(row6.z)) { evidence[8]++; continue; }
    let grid_pos = pos_mass.xyz * params.inv_grid_spacing_m;
    if (!finite3(grid_pos) || any(abs(grid_pos) >= vec3<f32>(2147483000.0))) {
      evidence[8]++; continue;
    }
${o.setup}
    var sample_count = 0u; var clipped = 0u; var missing = 0u; var bad = false;
    var selected_positive_samples = 0u; var nodal_speed = 0.0;
    for (var a = 0i; a < 3i; a++) {
      for (var b = 0i; b < 3i; b++) {
        for (var c = 0i; c < 3i; c++) {
          let node_i = base_x + a; let node_j = base_y + b; let node_k = base_z + c;
          let weight = g2p_weight_at(wx, a) * g2p_weight_at(wy, b) * g2p_weight_at(wz, c);
          if (!finite(weight) || weight < 0.0) { bad = true; continue; }
          if (!(weight >= bitcast<f32>(0x21800000u))) { continue; }
          if (!g2p_in_range(node_i, node_j, node_k)) { clipped++; continue; }
          let idx = g2p_grid_index(node_i, node_j, node_k);
          let field_index = field[descriptor + 4u + u32(a * 9i + b * 3i + c)];
          if (field_index >= field[34]) { missing++; continue; }
          let key = field[26] + field_index * FIELD_KEY_WORDS;
          if (field[key] != idx || field[key + 1u] != field[descriptor]
              || field[key + 2u] != field[descriptor + 1u]
              || field[key + 3u] != field[descriptor + 2u]) { missing++; continue; }
          let row = field[30] + field_index * FIELD_STATE_WORDS;
          let mass = bitcast<f32>(field[row]);
          let grid_velocity = vec3<f32>(bitcast<f32>(field[row + 1u]),
            bitcast<f32>(field[row + 2u]), bitcast<f32>(field[row + 3u]));
          if (!finite(mass) || !finite3(grid_velocity)) { bad = true; continue; }
          if (!(mass > 0.0) || field[row + 7u] == 0u || !pressure_admitted(field_index)) { missing++; continue; }
          if (field_index == rejection[4]) { selected_positive_samples++; }
          sample_count++; sampled_weight = sampled_weight + weight;
          nodal_speed = max(nodal_speed, length(grid_velocity));
${o.accumulate}
        }
      }
    }
    if (selected_positive_samples != 1u) { missing++; }
${o.normalize}
    let gathered_c = array<vec3<f32>, 3>(vec3<f32>(c00,c01,c02),
      vec3<f32>(c10,c11,c12), vec3<f32>(c20,c21,c22));
    let trial = g2p_trial_deformation(f[0],f[1],f[2],gathered_c[0],gathered_c[1],gathered_c[2],params.dt);
    let raw_j = determinant(trial);
    let solid = row5.x > 0.5;
    let disabled = !solid && (row6.z < 0.5 || inputs.internal_pressure_scale == 0.0);
    let effective_j = select(raw_j, determinant(f), disabled);
    let displacement = length(params.dt * velocity) / params.grid_spacing_m;
    let c_norm = sqrt(dot(gathered_c[0],gathered_c[0]) + dot(gathered_c[1],gathered_c[1]) + dot(gathered_c[2],gathered_c[2]));
    if (clipped > 0u) { evidence[9]++; }
    if (missing > 0u || clipped > 0u || sample_count == 0u) { evidence[7]++; }
    if (bad || !finite3(velocity) || !finite3(gathered_c[0]) || !finite3(gathered_c[1])
        || !finite3(gathered_c[2]) || !finite(raw_j) || !finite(effective_j)
        || !finite(displacement) || !finite(c_norm) || !finite(nodal_speed)
        || !finite(sampled_weight)) { evidence[8]++; continue; }
    if (disabled) { evidence[10]++; }
    if (raw_j <= 0.0) { evidence[11]++; }
    if (missing == 0u && clipped == 0u && sample_count > 0u) { evidence[6]++; }
    let flags = select(0u, 1u, disabled) | select(0u, 2u, missing > 0u)
      | select(0u, 4u, clipped > 0u);
    if ((evidence[19] & 1u) == 0u || raw_j < value(20u)
        || (raw_j == value(20u) && particle < evidence[48u])) {
      write_witness(48u,particle,flags,sample_count,sampled_weight,pos_mass,velocity,gathered_c,f,trial,raw_j,effective_j);
      evidence[19] = evidence[19] | 1u;
    }
    if ((evidence[19] & 2u) == 0u || displacement > value(21u)
        || (displacement == value(21u) && particle < evidence[88u])) {
      write_witness(88u,particle,flags,sample_count,sampled_weight,pos_mass,velocity,gathered_c,f,trial,raw_j,effective_j);
      evidence[19] = evidence[19] | 2u;
    }
    put(20u,min(value(20u),raw_j)); put(21u,max(value(21u),displacement));
    put(22u,max(value(22u),nodal_speed)); put(23u,max(value(23u),c_norm));
    put(24u,min(value(24u),sampled_weight)); put(25u,max(value(25u),sampled_weight));
    put(26u,value(26u) + pos_mass.w); put(27u,max(value(27u),select(c_norm,0.0,disabled)));
    put(44u,min(value(44u),effective_j));
  }
  evidence[2] = 1u;
  if (evidence[5] == 0u) { evidence[2] = 7u; }
  if (evidence[7] > 0u) { evidence[2] = 5u; }
  if (evidence[8] > 0u || !finite(value(26u))) { evidence[2] = 6u; }
}
@compute @workgroup_size(32)
fn main(@builtin(local_invocation_index) lane: u32) {
  gather(lane);
  for (var i = 0u; i < 128u; i++) { lane_packets[lane * 128u + i] = evidence[i]; }
  // All early exits are confined to gather(). Every lane reaches this barrier.
  workgroupBarrier();
  if (lane != 0u) { return; }
  var fatal = select(0u, evidence[2], evidence[2] >= 2u && evidence[2] <= 4u);
  for (var other = 1u; other < 32u; other++) {
    let offset = other * 128u;
    let status = lane_packets[offset + 2u];
    if (status >= 2u && status <= 4u) { fatal = max(fatal, status); }
    for (var i = 4u; i < 12u; i++) { evidence[i] += lane_packets[offset + i]; }
    evidence[18] += lane_packets[offset + 18u];
    let witnesses = lane_packets[offset + 19u];
    let raw_j = bitcast<f32>(lane_packets[offset + 20u]);
    let displacement = bitcast<f32>(lane_packets[offset + 21u]);
    if ((witnesses & 1u) != 0u && ((evidence[19] & 1u) == 0u || raw_j < value(20u)
        || (raw_j == value(20u) && lane_packets[offset + 48u] < evidence[48u]))) {
      for (var i = 48u; i < 88u; i++) { evidence[i] = lane_packets[offset + i]; }
    }
    if ((witnesses & 2u) != 0u && ((evidence[19] & 2u) == 0u || displacement > value(21u)
        || (displacement == value(21u) && lane_packets[offset + 88u] < evidence[88u]))) {
      for (var i = 88u; i < 128u; i++) { evidence[i] = lane_packets[offset + i]; }
    }
    if ((witnesses & 1u) != 0u) {
      put(20u, min(value(20u), raw_j));
      put(24u, min(value(24u), bitcast<f32>(lane_packets[offset + 24u])));
      put(44u, min(value(44u), bitcast<f32>(lane_packets[offset + 44u])));
    }
    for (var i = 21u; i < 24u; i++) { put(i, max(value(i), bitcast<f32>(lane_packets[offset + i]))); }
    put(25u, max(value(25u), bitcast<f32>(lane_packets[offset + 25u])));
    put(26u, value(26u) + bitcast<f32>(lane_packets[offset + 26u]));
    put(27u, max(value(27u), bitcast<f32>(lane_packets[offset + 27u])));
    evidence[19] |= witnesses;
  }
  evidence[2] = 1u;
  if (evidence[5] == 0u) { evidence[2] = select(7u, 0u, lane_packets[2] == 0u); }
  if (evidence[7] > 0u) { evidence[2] = 5u; }
  if (evidence[8] > 0u || !finite(value(26u))) { evidence[2] = 6u; }
  if (fatal != 0u) { evidence[2] = fatal; }
  for (var i = 0u; i < 128u; i++) { output[i] = evidence[i]; }
}
`;function c(e){if(!(e instanceof Uint32Array)||e.length!==128||e[0]!==1397769265||e[1]!==1)return Object.freeze({status:`rejected-particle-diagnostic-invalid-packet`});let t=new Float32Array(e.buffer,e.byteOffset,e.length),n=(e,n=3)=>Array.from(t.subarray(e,e+n)),r=(r,i)=>e[19]&i?Object.freeze({particleIndex:e[r],deformationDisabled:!!(e[r+1]&1),missingSupport:!!(e[r+1]&2),clippedSupport:!!(e[r+1]&4),sampledNodeCount:e[r+2],sampledWeight:t[r+3],positionM:n(r+4),massKg:t[r+7],gatheredVelocityMPerS:n(r+8),rawGatherDeterminant:t[r+11],gatheredAffineCPerS:n(r+12,9),effectiveAffineCPerS:e[r+1]&1?Array(9).fill(0):n(r+12,9),rawGatherTrialF:n(r+21,9),inputF:n(r+30,9),effectiveRawDeterminant:t[r+39]}):null;return Object.freeze({status:[`no-cfl-rejection`,`rejected-particle-gather-ready`,`rejection-packet-mismatch`,`particle-source-identity-mismatch`,`particle-input-invalid`,`particle-gather-incomplete`,`particle-gather-nonfinite`,`rejected-field-has-no-particle-contributors`][e[2]]??`unknown-diagnostic-status`,fieldIndex:e[3],eligibleParticleCount:e[4],contributorCount:e[5],completeContributorCount:e[6],incompleteContributorCount:e[7],nonfiniteContributorCount:e[8],clippedContributorCount:e[9],deformationDisabledCount:e[10],rawFoldCount:e[11],fieldGeneration:e[12],fieldCompletionOrdinal:e[13],fieldMutationOrdinal:e[14],selectedLevel:e[15]|0,physicalParticleCount:e[16],activeParticleCount:e[17],scannedActiveParticleCount:e[18],minRawGatherDeterminant:e[19]&1?t[20]:null,maxDisplacementOverGridSpacing:t[21],maxNodalSpeedMPerS:t[22],maxGatherAffineNormPerS:t[23],minSampledWeight:e[19]&1?t[24]:null,maxSampledWeight:t[25],contributorMassKg:t[26],maxEffectiveAffineNormPerS:t[27],dtS:t[28],internalPressureScale:t[29],pressureScale:t[30],rejectionTag:e[31],sourceEpochWords:Array.from(e.subarray(32,40)),key:Array.from(e.subarray(40,44)),minEffectiveRawDeterminant:e[19]&1?t[44]:null,sourceFieldStatusFlags:e[45],minimumRawJ:r(48,1),maximumDisplacement:r(88,2),readbackBytes:512,diagnosticOnly:!0,authoritativeStateMutation:!1,scope:`rejected fine-field contributors; pre-wall/pre-volume-cap gather; not cross-level endpoint or energy admission`})}function l({device:e,encoder:t,fieldBuffer:i,fieldDiagnosticBuffer:a,activeSourceBuffer:o,stateBuffer:c,mechanicsBuffer:l,particleCount:u,dtS:d,pressureScale:f,internalPressureScale:p,gridSpacingM:m,stateStrideBytes:h=32,mechanicsStrideBytes:g=128}){if(!Number.isSafeInteger(u)||u<=0||u>16777216||h!==32||g!==128||!Number.isFinite(d)||!(Math.fround(d)>0)||!Number.isFinite(Math.fround(d))||!Number.isFinite(f)||!Number.isFinite(Math.fround(f))||!Number.isFinite(m)||!(Math.fround(m)>0)||!Number.isFinite(Math.fround(m))||!Number.isFinite(Math.fround(1/m))||!Number.isFinite(p)||!Number.isFinite(Math.fround(p)))throw TypeError(`rejected-particle diagnostic requires exact finite retained G2P inputs and strides`);let _=[i,a,o,c,l],v=[256,256,256,u*32,u*128];if(_.some((e,t)=>!e||!Number.isSafeInteger(e.size)||e.size<v[t])||a.size!==256)throw TypeError(`rejected-particle diagnostic input buffer range unavailable`);let y=[],b=(t,n,r)=>{let i=e.createBuffer({label:t,size:n,usage:r});return y.push(i),i},x=()=>{for(let e of y.splice(0))e.destroy()};try{let i=b(`ulg-rejected-particle-diagnostic-packet`,512,132),a=b(`ulg-rejected-particle-diagnostic-params`,32,72),o=new Uint32Array(8);o[0]=u,new Float32Array(o.buffer).set([m,1/m],1),new Float32Array(o.buffer).set([d,f,p],4),e.queue.writeBuffer(a,0,o);let c=r(e,{cacheKey:`schroeder-rejected-particle-diagnostic-v1`,label:`ulg-rejected-particle-diagnostic`,code:s,bindings:[0,1,2,3,4].map(e=>n(e)).concat(n(5,`storage`),n(6,`uniform`))}),l=[..._,i,a],h=e.createBindGroup({layout:c.bindGroupLayout,entries:l.map((e,t)=>({binding:t,resource:{buffer:e}}))}),g=t.beginComputePass({label:`ulg-rejected-particle-diagnostic-gather`});try{g.setPipeline(c.pipeline),g.setBindGroup(0,h),g.dispatchWorkgroups(1)}finally{g.end()}return{buffer:i,destroy:x}}catch(e){throw x(),e}}export{i as SCHROEDER_REJECTED_PARTICLE_DIAGNOSTIC_WORDS,c as decodeSchroederRejectedParticleDiagnostic,l as encodeSchroederRejectedParticleDiagnostic};