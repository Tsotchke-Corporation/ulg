import { sphPhaseCarrierThermodynamicsWgsl } from './sphPhaseCarrierThermodynamicsWgsl.js';
import { sphGasConstitutiveWgsl } from '../../../ulg-gpu-abi/src/sphGasConstitutiveWgsl.js';

// The mass/quantity programs own conservation. This program obtains the
// component caloric endpoints and constitutive template_row from the actual input
// tables, then projects the committed extensive quantities into physical lanes.
export function createSphExactPhaseCarrierPhysicalWgsl(format) {
  return /* wgsl */ `
${sphPhaseCarrierThermodynamicsWgsl}
${sphGasConstitutiveWgsl}
struct Params {
  particle_count: u32, lineage_capacity: u32, phase_lane_count: u32, phase_lane_stride: u32,
  thermal_segment_count: u32, mechanics_record_count: u32, thermal_offset_vec4: u32, mechanics_offset_vec4: u32,
  reserved_status: u32, fraction_validation_epsilon: f32, relative_tolerance: f32, mass_epsilon: f32,
  material_record_count: u32, material_record_offset_vec4: u32, absolute_pressure_authority: u32, fraction_activation_epsilon: f32,
  response_count: u32, graph_node_offset: u32, graph_sample_offset: u32, graph_count: u32,
  skin_front_enabled: u32, pad0: u32, pad1: u32, pad2: u32,
};
@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> closure_rows: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> packets: array<u32>;
@group(0) @binding(5) var<storage, read_write> geometry: array<u32>;
@group(0) @binding(6) var<storage, read> projected: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read> caloric: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> out_state: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> out_thermo: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> out_mechanics: array<vec4<f32>>;
@group(0) @binding(11) var<storage, read_write> validation: array<atomic<u32>>;
@group(0) @binding(12) var<uniform> params: Params;
fn finite(value: f32) -> bool { return (bitcast<u32>(value) & 0x7fffffffu) < 0x7f800000u; }
fn packet_nonzero(row: u32, phase: u32) -> bool {
  var bits = 0u; for (var i = 0u; i < ${format.wordCount}u; i++) { bits |= packets[(row * 4u + phase) * ${format.wordCount}u + i]; }
  return bits != 0u;
}
fn packet_greater(a: u32, b: u32, phase: u32) -> bool {
  for (var j = ${format.wordCount}u; j > 0u; j--) {
    let x = packets[(a * 4u + phase) * ${format.wordCount}u + j - 1u];
    let y = packets[(b * 4u + phase) * ${format.wordCount}u + j - 1u];
    if (x != y) { return x > y; }
  } return false;
}
fn packet_position_weight(row: u32, phase: u32, high: u32) -> f32 {
  let at = (row * 4u + phase) * ${format.wordCount}u;
  var weight = f32(packets[at + high]);
  if (high > 0u) { weight += f32(packets[at + high - 1u]) * 2.3283064365386963e-10; }
  return weight;
}
fn phase_record(material: f32, phase: u32) -> u32 {
  for (var i = 0u; i < params.mechanics_record_count; i++) {
    let row = closure_rows[params.mechanics_offset_vec4 + i * 3u];
    if (row.x == material && row.y == f32(phase)) { return i; }
  } return 0xffffffffu;
}
fn component_energy(row: u32, phase: u32) -> vec2<f32> {
  if (params.skin_front_enabled == 1u) {
    let skin0 = out_mechanics[row * 8u];
    if (skin0.x == 1.0) {
      let target_phase = u32(round(skin0.y));
      let own_phase = u32(round(out_mechanics[row * 8u + 1u].w));
      if (phase == target_phase) { return vec2<f32>(skin0.w, 1.0); }
      if (phase == own_phase) { return vec2<f32>(skin0.z, 1.0); }
    }
  }
  let fractions = source_thermo[row * 3u + 1u];
  var count = 0u; var first = 0u; var second = 0u;
  for (var i = 0u; i < 4u; i++) {
    if ((bitcast<u32>(fractions[i]) & 0x7fffffffu) != 0u) {
      if (count == 0u) { first = i + 1u; } else { second = i + 1u; } count++;
    }
  }
  if (count == 1u && first == phase) { return vec2<f32>(source_state[row * 2u + 1u].w, 1.0); }
  if (count != 2u) { return vec2<f32>(0.0); }
  return plateau_endpoint(source_thermo[row * 3u].x, first, second,
    source_state[row * 2u + 1u].w, phase, source_mechanics[row * 8u + 7u].x);
}
@compute @workgroup_size(64)
fn prepare_phase_geometry(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= params.particle_count || atomicLoad(&validation[0]) != 0u) { return; }
  for (var phase = 0u; phase < 4u; phase++) {
    if (!packet_nonzero(row, phase)) { continue; }
    let endpoint = component_energy(row, phase + 1u);
    if (endpoint.y != 1.0 || !finite(endpoint.x)) { atomicOr(&validation[0], 0x10000u); return; }
    geometry[row * 8u + phase] = bitcast<u32>(endpoint.x);
  }
  let lineage = row % params.lineage_capacity; let phase = row / params.lineage_capacity;
  var template_row = lineage; var found = false;
  for (var lane = 0u; lane < 4u; lane++) {
    let source_row = lane * params.lineage_capacity + lineage;
    if (!packet_nonzero(source_row, phase)) { continue; }
    if (!found || packet_greater(source_row, template_row, phase)) { template_row = source_row; }
    found = true;
  }
  geometry[row * 8u + 4u] = template_row;
  if (!found) {
    var lineage_live = false;
    for (var lane = 0u; lane < 4u && !lineage_live; lane++) {
      let source_row = lane * params.lineage_capacity + lineage;
      for (var p = 0u; p < 4u; p++) {
        if (packet_nonzero(source_row, p)) { lineage_live = true; break; }
      }
    }
    geometry[row * 8u + 5u] = select(0u, 1u, lineage_live);
    geometry[row * 8u + 7u] = 0xffffffffu;
    return;
  }
  let material = source_thermo[template_row * 3u].x;
  let record = phase_record(material, phase + 1u);
  if (record == 0xffffffffu) { atomicOr(&validation[0], 0x20000u); return; }
  let base = params.mechanics_offset_vec4 + record * 3u;
  let r0 = closure_rows[base]; let r1 = closure_rows[base + 1u]; let r2 = closure_rows[base + 2u];
  let m5 = source_mechanics[template_row * 8u + 5u]; let m6 = source_mechanics[template_row * 8u + 6u];
  if (!(r0.z > 0.0) || !finite(r0.z) || r2.y != 1.0) { atomicOr(&validation[0], 0x20000u); return; }
  geometry[row * 8u + 5u] = select(0u, 1u, m5.x == r2.x && m6.z == r1.w && m5.y == 1.0 && m6.w == 1.0);
  geometry[row * 8u + 6u] = bitcast<u32>(r0.z);
  geometry[row * 8u + 7u] = record;
  // When Stefan skin-first conversion is active, precompute destination row's
  // exact mass-weighted first-moment birth offset from read-only skin scratch
  // (stored in out_mechanics[source_row * 8 + 0..2]) into out_state[row * 2]
  // so apply_phase_physical reads only its own row with zero cross-thread race.
  if (params.skin_front_enabled == 1u) {
    var high = 0u;
    for (var i = 0u; i < ${format.wordCount}u; i++) {
      if (packets[(template_row * 4u + phase) * ${format.wordCount}u + i] != 0u) { high = i; }
    }
    var off_sum = vec3<f32>(0.0);
    var w_total = 0.0;
    for (var lane = 0u; lane < 4u; lane++) {
      let source_row = lane * params.lineage_capacity + lineage;
      let weight = packet_position_weight(source_row, phase, high);
      if (weight <= 0.0) { continue; }
      w_total += weight;
      let s_meta = out_mechanics[source_row * 8u];
      if (s_meta.x == 1.0) {
        let target_p = u32(round(s_meta.y));
        let own_p = u32(round(out_mechanics[source_row * 8u + 1u].w));
        if (phase + 1u == target_p) {
          off_sum += out_mechanics[source_row * 8u + 2u].xyz * weight;
        } else if (phase + 1u == own_p) {
          off_sum += out_mechanics[source_row * 8u + 1u].xyz * weight;
        }
      }
    }
    if (w_total > 0.0) {
      out_state[row * 2u] = vec4<f32>(off_sum / w_total, 1.0);
    } else {
      out_state[row * 2u] = vec4<f32>(0.0);
    }
  }
}
fn phase_temperature(material: f32, phase: u32, energy: f32) -> f32 {
  for (var response = 0u; response < params.response_count; response++) {
    let r0 = caloric[response * 4u]; let r1 = caloric[response * 4u + 1u];
    if (r0.x != material || r0.y == 2.0 || r0.w != 1.0 || r1.z != f32(phase) || r1.w != f32(phase)
        || energy < r1.x || energy > r1.y) { continue; }
    let graph = u32(r0.z); if (graph >= params.graph_count) { continue; }
    let node = caloric[params.graph_node_offset + graph * 4u + 1u];
    if (energy < node.z || energy > node.w || node.y < 2.0) { continue; }
    let start = params.graph_sample_offset + u32(node.x); let count = u32(node.y);
    if (start + count > arrayLength(&caloric)) { continue; }
    for (var i = start; i + 1u < start + count; i++) {
      let a = caloric[i]; let b = caloric[i + 1u];
      if (energy >= a.x && energy <= b.x && b.x > a.x) { return a.y + (energy - a.x) / (b.x - a.x) * (b.y - a.y); }
    }
  } return -1.0;
}
@compute @workgroup_size(64)
fn apply_phase_physical(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= params.particle_count || atomicLoad(&validation[0]) != 0u) { return; }
  let phase = row / params.lineage_capacity + 1u; let record = geometry[row * 8u + 7u];
  if (record == 0xffffffffu) {
    if (geometry[row * 8u + 5u] == 0u) {
      // Dormant/empty lineage: preserve exact source status (253 reaction
      // product reserve, 252 split-spare reserve, 254 phase companion) rather
      // than clobbering primary reserve slots into companion status 254.
      out_state[row * 2u] = vec4<f32>(source_state[row * 2u].xyz, 0.0);
      out_state[row * 2u + 1u] = source_state[row * 2u + 1u];
      out_thermo[row * 3u] = source_thermo[row * 3u];
      out_thermo[row * 3u + 1u] = vec4<f32>(0.0);
      out_thermo[row * 3u + 2u] = source_thermo[row * 3u + 2u];
      for (var i = 0u; i < 8u; i++) { out_mechanics[row * 8u + i] = source_mechanics[row * 8u + i]; }
      out_mechanics[row * 8u + 4u].w = 0.0; out_mechanics[row * 8u + 7u].w = 0.0; return;
    }
    out_state[row * 2u] = vec4<f32>(source_state[row * 2u].xyz, 0.0);
    out_state[row * 2u + 1u] = source_state[row * 2u + 1u];
    out_thermo[row * 3u] = vec4<f32>(source_thermo[row * 3u].x, f32(phase), source_thermo[row * 3u].zw);
    out_thermo[row * 3u + 1u] = vec4<f32>(0.0);
    out_thermo[row * 3u + 2u] = vec4<f32>(source_thermo[row * 3u + 2u].x, 0.0, f32(params.reserved_status), 0.0);
    for (var i = 0u; i < 8u; i++) { out_mechanics[row * 8u + i] = source_mechanics[row * 8u + i]; }
    out_mechanics[row * 8u + 4u].w = 0.0; out_mechanics[row * 8u + 5u].y = f32(params.reserved_status);
    out_mechanics[row * 8u + 6u].w = f32(params.reserved_status); out_mechanics[row * 8u + 7u].w = 0.0; return;
  }
  let template_row = geometry[row * 8u + 4u]; let material = source_thermo[template_row * 3u].x;
  let p0 = projected[row * 2u]; let p1 = projected[row * 2u + 1u];
  let temperature = phase_temperature(material, phase, p1.x);
  let base = params.mechanics_offset_vec4 + record * 3u;
  let r0 = closure_rows[base]; let r1 = closure_rows[base + 1u]; let r2 = closure_rows[base + 2u];
  let gas_offset = params.material_record_offset_vec4 + params.material_record_count * 2u;
  var sound = r1.z;
  if (r1.w == 2.0 && arrayLength(&closure_rows) > gas_offset) {
    sound = gas_constitutive_sound_speed(closure_rows[gas_offset + record], temperature);
  }
  if (!(temperature > 0.0) || !finite(temperature) || !(sound >= 0.0) || !finite(sound)) { atomicOr(&validation[0], 0x40000u); return; }
  var high = 0u;
  for (var i = 0u; i < ${format.wordCount}u; i++) { if (packets[(template_row * 4u + phase - 1u) * ${format.wordCount}u + i] != 0u) { high = i; } }
  var position = vec3<f32>(0.0); var total = 0.0; var smoothing = 0.0;
  for (var lane = 0u; lane < 4u; lane++) {
    let source_row = lane * params.lineage_capacity + row % params.lineage_capacity;
    let weight = packet_position_weight(source_row, phase - 1u, high);
    position += source_state[source_row * 2u].xyz * weight; total += weight;
    if (packet_nonzero(source_row, phase - 1u)) { smoothing = max(smoothing, source_thermo[source_row * 3u + 2u].x); }
  }
  position /= total;
  if (params.skin_front_enabled == 1u && out_state[row * 2u].w == 1.0) {
    position += out_state[row * 2u].xyz;
  }
  var entities = 0.0;
  for (var lane = 0u; lane < 4u; lane++) {
    let source_row = lane * params.lineage_capacity + row % params.lineage_capacity;
    if (!packet_nonzero(source_row, phase - 1u)) { continue; }
    let share = packet_position_weight(source_row, phase - 1u, high) / total;
    entities += source_thermo[source_row * 3u + 2u].y * ((p0.x * share) / source_state[source_row * 2u].w);
  }
  if (!finite(entities) || entities < 0.0 || !finite(smoothing)) { atomicOr(&validation[0], 0x80000u); return; }
  if (!all(position == position) || any(abs(position) > vec3<f32>(3.402823e38))) { atomicOr(&validation[0], 0x80000u); return; }
  out_state[row * 2u] = vec4<f32>(position, p0.x); out_state[row * 2u + 1u] = vec4<f32>(p0.yzw, p1.x);
  out_thermo[row * 3u] = vec4<f32>(material, f32(phase), temperature, r0.z);
  var fractions = vec4<f32>(0.0); fractions[phase - 1u] = 1.0; out_thermo[row * 3u + 1u] = fractions;
  // Radius follows the represented current volume; this is a bulk carrier,
  // never an aerosol parcel count or optical radius. The f32 entity count is
  // diagnostic; exact mass and the retained molecular identity remain owners.
  out_thermo[row * 3u + 2u] = vec4<f32>(smoothing, entities, 1.0, pow(p1.z * 0.238732414637843, 1.0 / 3.0));
  for (var i = 0u; i < 8u; i++) { out_mechanics[row * 8u + i] = source_mechanics[template_row * 8u + i]; }
  if (geometry[row * 8u + 5u] == 0u) {
    for (var i = 0u; i < 3u; i++) { out_mechanics[row * 8u + i] = vec4<f32>(1.0, 0.0, 0.0, 0.0); }
    out_mechanics[row * 8u + 3u] = vec4<f32>(0.0); out_mechanics[row * 8u + 4u] = vec4<f32>(0.0);
  }
  out_mechanics[row * 8u + 4u].z = p1.w; out_mechanics[row * 8u + 4u].w = p1.y;
  out_mechanics[row * 8u + 5u] = vec4<f32>(r2.x, r2.y, r0.w, r1.x);
  out_mechanics[row * 8u + 6u] = vec4<f32>(r1.y, sound, r1.w, r2.y);
  out_mechanics[row * 8u + 7u] = vec4<f32>(out_mechanics[row * 8u + 7u].x, r2.z, r2.w, p0.x);
}
@compute @workgroup_size(64)
fn restore_rejected_phase_physical(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= params.particle_count || atomicLoad(&validation[0]) == 0u) { return; }
  for (var i = 0u; i < 2u; i++) { out_state[row * 2u + i] = source_state[row * 2u + i]; }
  for (var i = 0u; i < 3u; i++) { out_thermo[row * 3u + i] = source_thermo[row * 3u + i]; }
  for (var i = 0u; i < 8u; i++) { out_mechanics[row * 8u + i] = source_mechanics[row * 8u + i]; }
}
`;
}
