// Extracted from wgsl.js (Gate 6 Phase D mechanical decomposition).

import { sphGasConstitutiveWgsl } from './sphGasConstitutiveWgsl.js';


export const mlsMpmMechanicsPredictWgsl = `
struct MechanicsParams {
  particle_count: u32,
  dt: f32,
  gravity_x: f32,
  gravity_y: f32,
  gravity_z: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: MechanicsParams;

fn det3(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32
) -> f32 {
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

fn cubic_root_positive(value: f32) -> f32 {
  return exp(log(max(value, 1.0e-12)) / 3.0);
}

const MECHANICS_MIN_VOLUME_RATIO_J: f32 = 0.1;
const MECHANICS_MAX_RADIUS_GROWTH_RATIO: f32 = 4.0;
const MECHANICS_MAX_VOLUME_RATIO_J: f32 = 64.0;
// Same gas-aware expansion bound as the G2P integrator (see
// G2P_MAX_VOLUME_RATIO_J_GAS): the prediction must not clamp J tighter than
// the authoritative state writer or expanded gas would be priced at a frozen
// 64x-volume density in the stress path.
const MECHANICS_MAX_VOLUME_RATIO_J_GAS: f32 = 1000.0;

fn mechanics_max_volume_ratio_j(eos_model_id: f32) -> f32 {
  let is_gas = eos_model_id > 1.5 && eos_model_id < 2.5;
  return select(MECHANICS_MAX_VOLUME_RATIO_J, MECHANICS_MAX_VOLUME_RATIO_J_GAS, is_gas);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let state_base = particle_index * 2u;
  let mechanics_base = particle_index * 8u;
  let pos_mass = sph_state[state_base];
  let vel_u = sph_state[state_base + 1u];
  let _thermo_status = sph_thermo[particle_index * 3u + 2u].z;

  var velocity = vec3<f32>(vel_u.x, vel_u.y, vel_u.z)
    + vec3<f32>(params.gravity_x, params.gravity_y, params.gravity_z) * params.dt;
  var position = vec3<f32>(pos_mass.x, pos_mass.y, pos_mass.z) + velocity * params.dt;
  let box_dims = vec3<f32>(params.box_x, params.box_y, params.box_z);

  if (position.x < 0.0) {
    position.x = 0.0;
    if (velocity.x < 0.0) { velocity.x = 0.0; }
  }
  if (position.x > box_dims.x) {
    position.x = box_dims.x;
    if (velocity.x > 0.0) { velocity.x = 0.0; }
  }
  if (position.y < 0.0) {
    position.y = 0.0;
    if (velocity.y < 0.0) { velocity.y = 0.0; }
  }
  if (position.y > box_dims.y) {
    position.y = box_dims.y;
    if (velocity.y > 0.0) { velocity.y = 0.0; }
  }
  if (position.z < 0.0) {
    position.z = 0.0;
    if (velocity.z < 0.0) { velocity.z = 0.0; }
  }
  if (position.z > box_dims.z) {
    position.z = box_dims.z;
    if (velocity.z > 0.0) { velocity.z = 0.0; }
  }

  let row0 = mls_mechanics[mechanics_base];
  let row1 = mls_mechanics[mechanics_base + 1u];
  let row2 = mls_mechanics[mechanics_base + 2u];
  let row3 = mls_mechanics[mechanics_base + 3u];
  let row4 = mls_mechanics[mechanics_base + 4u];
  let row5 = mls_mechanics[mechanics_base + 5u];
  let row6 = mls_mechanics[mechanics_base + 6u];
  let row7 = mls_mechanics[mechanics_base + 7u];

  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
  let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
  let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
  let c00 = row2.y; let c01 = row2.z; let c02 = row2.w;
  let c10 = row3.x; let c11 = row3.y; let c12 = row3.z;
  let c20 = row3.w; let c21 = row4.x; let c22 = row4.y;

  let g00 = 1.0 + params.dt * c00; let g01 = params.dt * c01; let g02 = params.dt * c02;
  let g10 = params.dt * c10; let g11 = 1.0 + params.dt * c11; let g12 = params.dt * c12;
  let g20 = params.dt * c20; let g21 = params.dt * c21; let g22 = 1.0 + params.dt * c22;

  var nf00 = g00 * f00 + g01 * f10 + g02 * f20;
  var nf01 = g00 * f01 + g01 * f11 + g02 * f21;
  var nf02 = g00 * f02 + g01 * f12 + g02 * f22;
  var nf10 = g10 * f00 + g11 * f10 + g12 * f20;
  var nf11 = g10 * f01 + g11 * f11 + g12 * f21;
  var nf12 = g10 * f02 + g11 * f12 + g12 * f22;
  var nf20 = g20 * f00 + g21 * f10 + g22 * f20;
  var nf21 = g20 * f01 + g21 * f11 + g22 * f21;
  var nf22 = g20 * f02 + g21 * f12 + g22 * f22;
  var next_j = det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);

  if (row5.x < 0.5) {
    next_j = max(next_j, 0.05);
    let s = cubic_root_positive(next_j);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
  }

  next_j = det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);
  if (next_j < MECHANICS_MIN_VOLUME_RATIO_J) {
    let s = cubic_root_positive(MECHANICS_MIN_VOLUME_RATIO_J);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
    next_j = MECHANICS_MIN_VOLUME_RATIO_J;
  } else if (next_j > mechanics_max_volume_ratio_j(row6.z)) {
    let max_volume_ratio_j = mechanics_max_volume_ratio_j(row6.z);
    let scale = cubic_root_positive(max_volume_ratio_j / max(next_j, 1.0e-12));
    nf00 = nf00 * scale; nf01 = nf01 * scale; nf02 = nf02 * scale;
    nf10 = nf10 * scale; nf11 = nf11 * scale; nf12 = nf12 * scale;
    nf20 = nf20 * scale; nf21 = nf21 * scale; nf22 = nf22 * scale;
    next_j = max_volume_ratio_j;
  }

  out_sph_state[state_base] = vec4<f32>(position.x, position.y, position.z, pos_mass.w);
  out_sph_state[state_base + 1u] = vec4<f32>(velocity.x, velocity.y, velocity.z, vel_u.w);
  out_mls_mechanics[mechanics_base] = vec4<f32>(nf00, nf01, nf02, nf10);
  out_mls_mechanics[mechanics_base + 1u] = vec4<f32>(nf11, nf12, nf20, nf21);
  out_mls_mechanics[mechanics_base + 2u] = vec4<f32>(nf22, c00, c01, c02);
  out_mls_mechanics[mechanics_base + 3u] = vec4<f32>(c10, c11, c12, c20);
  out_mls_mechanics[mechanics_base + 4u] = vec4<f32>(c21, c22, next_j, row4.w);
  out_mls_mechanics[mechanics_base + 5u] = row5;
  out_mls_mechanics[mechanics_base + 6u] = row6;
  out_mls_mechanics[mechanics_base + 7u] = row7;
}
`;

export const mlsMpmP2gGridProjectionWgsl = `
struct P2gProjectionParams {
  particle_count: u32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  dt: f32,
  resident_product_event_count: u32,
  internal_pressure_scale: f32,
  schroeder_filter_enabled: u32,
  schroeder_selected_level: i32,
  schroeder_assignment_stride_floats: u32,
  schroeder_spatial_directory_enabled: u32,
  schroeder_spatial_storage_generation: u32,
  grid_density_pressure_enabled: u32,
  ambient_pressure_pa: f32,
  external_gauge_pressure_pa: f32,
  external_gauge_pressure_enabled: u32,
  schroeder_spatial_position_epoch: u32,
  schroeder_spatial_topology_epoch: u32,
  schroeder_spatial_required: u32,
  schroeder_spatial_generation_id: u32,
  schroeder_spatial_device_ordinal: u32,
  schroeder_spatial_lane_ordinal: u32,
  schroeder_spatial_lease_token: u32,
  schroeder_spatial_source_family_id: u32,
  schroeder_spatial_physics_tick: u32,
  schroeder_spatial_physics_substep: u32,
  schroeder_spatial_chart_epoch: u32,
  schroeder_spatial_level_epoch: u32,
  schroeder_spatial_support_epoch: u32,
  schroeder_spatial_pad0: u32,
  schroeder_spatial_pad1: u32,
  schroeder_spatial_pad2: u32,
};

// Monaghan artificial-viscosity coefficient, applied as a BULK term under
// compression at its use site below -- never as shear viscosity.
//
// Baked as a constant rather than carried in P2gProjectionParams on purpose.
// The three params pads are aliased to different meanings in different derived
// variants -- pad0 is the spatial-evidence flag, pad1 is sourceRowLayoutId in
// the mechanics-field variant, pad2 is completionOrdinal there and an epoch
// cross-check in the base -- so no pad is free in every variant, and growing
// the struct shifts the fields that createActiveGridP2gProjectionWgsl and
// createMechanicsFieldP2gProjectionWgsl append after it. Making this
// host-configurable again means extending the struct and updating all three
// writers together.
const ARTIFICIAL_BULK_VISCOSITY_ALPHA: f32 = 0.04;

struct StressRows {
  x: vec3<f32>,
  y: vec3<f32>,
  z: vec3<f32>,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> grid_accumulators: array<atomic<i32>>;
@group(0) @binding(4) var<uniform> params: P2gProjectionParams;
@group(0) @binding(5) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> grid_nodes: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read> schroeder_level_assignments: array<f32>;
@group(0) @binding(8) var<storage, read> schroeder_spatial_directory: array<u32>;
// NOTE: P2G must stay at <= 8 storage buffers so it runs on DEFAULT WebGPU
// device limits (maxStorageBuffersPerShaderStage = 8). A binding 9 for the
// (disabled, superseded-by-separation-pass) spatial-density EOS previously
// invalidated every P2G pipeline on default-limit devices, silently zeroing
// grids for standalone/test consumers.

const P2G_ATOMIC_SCALE: f32 = 65536.0;
const P2G_ATOMIC_INV_SCALE: f32 = 1.0 / P2G_ATOMIC_SCALE;

fn p2g_quantize(value: f32) -> i32 {
  return i32(round(clamp(value * P2G_ATOMIC_SCALE, -2147483000.0, 2147483000.0)));
}

fn quadratic_weights(fx: f32) -> vec3<f32> {
  let a = 1.5 - fx;
  let b = fx - 1.0;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}

fn weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  if (offset == 0) { return weights.x; }
  if (offset == 1) { return weights.y; }
  if (offset == 2) { return weights.z; }
  return 0.0;
}

fn p2g_weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  return weight_at(weights, offset);
}

fn p2g_storage_index(i: u32, j: u32, k: u32) -> u32 {
  return (i * params.grid_ny + j) * params.grid_nz + k;
}

fn p2g_node_enabled(i: u32, j: u32, k: u32) -> bool {
  return true;
}

const SCHROEDER_SPATIAL_MAGIC: u32 = 0x53534531u;
const SCHROEDER_SPATIAL_VERSION: u32 = 1u;
const SCHROEDER_SPATIAL_STATUS_READY: u32 = 1u;
const SCHROEDER_SPATIAL_STATUS_ADMITTED: u32 = 2u;
const SCHROEDER_SPATIAL_STATUS_FAIL_CLOSED: u32 = 4u;
const SCHROEDER_SPATIAL_STATUS_INVALID_SOURCE: u32 = 8u;
const SCHROEDER_SPATIAL_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const SCHROEDER_SPATIAL_PRIMITIVE_STATUS_READY: u32 = 1u;
const SCHROEDER_SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED: u32 = 4u;
const SCHROEDER_SPATIAL_HEADER_WORDS: u32 = 48u;
const SCHROEDER_SPATIAL_KEY_WORDS: u32 = 5u;
const SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32: u32 = 1u;
const SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;
const SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS: u32 = 1u;
const SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY: u32 = 2u;

fn p2g_spatial_range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn p2g_spatial_directory_admitted() -> bool {
  if (params.schroeder_spatial_directory_enabled == 0u) {
    return false;
  }
  let bound_words = arrayLength(&schroeder_spatial_directory);
  if (bound_words < SCHROEDER_SPATIAL_HEADER_WORDS) {
    return false;
  }
  let flags = schroeder_spatial_directory[2u];
  let source_count = schroeder_spatial_directory[16u];
  let source_capacity = schroeder_spatial_directory[17u];
  let cell_count = schroeder_spatial_directory[18u];
  let cell_capacity = schroeder_spatial_directory[19u];
  let logical_required_words = schroeder_spatial_directory[20u];
  let logical_admitted_words = schroeder_spatial_directory[21u];
  let directory_capacity_words = schroeder_spatial_directory[22u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let cell_offsets_offset_words = schroeder_spatial_directory[30u];
  let cell_members_offset_words = schroeder_spatial_directory[31u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  let physical_upper_bound_words = schroeder_spatial_directory[47u];
  let rejected_flags = SCHROEDER_SPATIAL_STATUS_FAIL_CLOSED
    | SCHROEDER_SPATIAL_STATUS_INVALID_SOURCE
    | SCHROEDER_SPATIAL_STATUS_CAPACITY_OVERFLOW;
  let sort_key_words = schroeder_spatial_directory[26u];
  let sort_mode = schroeder_spatial_directory[27u];
  let sort_mode_admitted = (
    sort_mode == SCHROEDER_SPATIAL_SORT_BOUNDED_ATLAS_U32
      && sort_key_words == 1u
  ) || (
    sort_mode == SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5
      && sort_key_words == SCHROEDER_SPATIAL_KEY_WORDS
  );
  let build_ordinal = schroeder_spatial_directory[33u];
  let primitive_status = schroeder_spatial_directory[41u];
  if (
    directory_capacity_words > bound_words
    || directory_capacity_words < SCHROEDER_SPATIAL_HEADER_WORDS
    || cell_keys_offset_words > directory_capacity_words
    || cell_offsets_offset_words > directory_capacity_words
    || cell_members_offset_words > directory_capacity_words
    || particle_to_cell_offset_words > directory_capacity_words
    || cell_capacity > (directory_capacity_words - cell_keys_offset_words)
      / SCHROEDER_SPATIAL_KEY_WORDS
    || cell_offsets_offset_words < cell_keys_offset_words
      + cell_capacity * SCHROEDER_SPATIAL_KEY_WORDS
    || cell_capacity + 1u > directory_capacity_words - cell_offsets_offset_words
    || cell_members_offset_words < cell_offsets_offset_words + cell_capacity + 1u
    || source_capacity > directory_capacity_words - cell_members_offset_words
    || particle_to_cell_offset_words < cell_members_offset_words + source_capacity
    || source_capacity > directory_capacity_words - particle_to_cell_offset_words
  ) {
    return false;
  }
  return schroeder_spatial_directory[0u] == SCHROEDER_SPATIAL_MAGIC
    // v1 and v2 directory ABIs share this gate's header invariants; see the
    // authority-module version note. Pinning v1 froze all v2 mechanics.
    && (
      schroeder_spatial_directory[1u] == SCHROEDER_SPATIAL_VERSION
      || schroeder_spatial_directory[1u] == SCHROEDER_SPATIAL_VERSION + 1u
    )
    && (flags & (SCHROEDER_SPATIAL_STATUS_READY | SCHROEDER_SPATIAL_STATUS_ADMITTED))
      == (SCHROEDER_SPATIAL_STATUS_READY | SCHROEDER_SPATIAL_STATUS_ADMITTED)
    && (flags & rejected_flags) == 0u
    && schroeder_spatial_directory[3u] == params.schroeder_spatial_generation_id
    && params.schroeder_spatial_generation_id > 0u
    && schroeder_spatial_directory[4u] == params.schroeder_spatial_device_ordinal
    && schroeder_spatial_directory[5u] == params.schroeder_spatial_lane_ordinal
    && schroeder_spatial_directory[6u] == params.schroeder_spatial_lease_token
    && schroeder_spatial_directory[7u] == params.schroeder_spatial_source_family_id
    && schroeder_spatial_directory[8u] == params.schroeder_spatial_storage_generation
    && schroeder_spatial_directory[9u] == params.schroeder_spatial_physics_tick
    && schroeder_spatial_directory[10u] == params.schroeder_spatial_physics_substep
    && schroeder_spatial_directory[11u] == params.schroeder_spatial_position_epoch
    && schroeder_spatial_directory[12u] == params.schroeder_spatial_topology_epoch
    && schroeder_spatial_directory[13u] == params.schroeder_spatial_chart_epoch
    && schroeder_spatial_directory[14u] == params.schroeder_spatial_level_epoch
    && schroeder_spatial_directory[15u] == params.schroeder_spatial_support_epoch
    && source_count == params.particle_count
    && source_count > 0u
    && source_count <= source_capacity
    && cell_count > 0u
    && cell_count <= source_count
    && cell_count <= cell_capacity
    && logical_required_words == logical_admitted_words
    && logical_admitted_words >= SCHROEDER_SPATIAL_HEADER_WORDS
    && logical_admitted_words <= physical_upper_bound_words
    && schroeder_spatial_directory[23u] == 0u
    && schroeder_spatial_directory[24u] == 0u
    && schroeder_spatial_directory[25u] == SCHROEDER_SPATIAL_KEY_WORDS
    && sort_mode_admitted
    && schroeder_spatial_directory[28u] == SCHROEDER_SPATIAL_HEADER_WORDS
    && cell_keys_offset_words == SCHROEDER_SPATIAL_HEADER_WORDS
    && build_ordinal != 0u
    && schroeder_spatial_directory[34u] == build_ordinal
    && schroeder_spatial_directory[35u] == build_ordinal
    && schroeder_spatial_directory[36u] == params.schroeder_spatial_generation_id
    && schroeder_spatial_directory[37u] == source_count
    && schroeder_spatial_directory[38u] == cell_count
    && schroeder_spatial_directory[39u] != 0u
    && schroeder_spatial_directory[40u] == 0u
    && (primitive_status & SCHROEDER_SPATIAL_PRIMITIVE_STATUS_READY) != 0u
    && (primitive_status & SCHROEDER_SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && schroeder_spatial_directory[45u] >= SCHROEDER_SPATIAL_HEADER_WORDS
    && (
      schroeder_spatial_directory[46u]
        == SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS
      || schroeder_spatial_directory[46u]
        == SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    )
    && physical_upper_bound_words <= directory_capacity_words
    && p2g_spatial_range_within(
      cell_keys_offset_words,
      cell_count * SCHROEDER_SPATIAL_KEY_WORDS,
      physical_upper_bound_words
    )
    && p2g_spatial_range_within(
      cell_offsets_offset_words,
      cell_count + 1u,
      physical_upper_bound_words
    )
    && p2g_spatial_range_within(
      cell_members_offset_words,
      source_count,
      physical_upper_bound_words
    )
    && p2g_spatial_range_within(
      particle_to_cell_offset_words,
      source_count,
      physical_upper_bound_words
    );
}

fn p2g_spatial_particle_level(particle_index: u32) -> i32 {
  let cell_count = schroeder_spatial_directory[18u];
  let cell_keys_offset_words = schroeder_spatial_directory[29u];
  let particle_to_cell_offset_words = schroeder_spatial_directory[32u];
  // Reverse map is cell-index-plus-one ('cell-index-plus-one-zero-dormant');
  // zero = dormant/missing sentinel. A raw decode silently rejected the
  // final cell's occupants and shifted every other lookup by one cell.
  let reverse_entry = schroeder_spatial_directory[particle_to_cell_offset_words + particle_index];
  if (reverse_entry == 0u) {
    return bitcast<i32>(0x80000000u);
  }
  let cell_index = reverse_entry - 1u;
  if (cell_index >= cell_count) {
    return bitcast<i32>(0x80000000u);
  }
  let level_order_key = schroeder_spatial_directory[
    cell_keys_offset_words + cell_index * SCHROEDER_SPATIAL_KEY_WORDS + 1u
  ];
  return bitcast<i32>(level_order_key ^ 0x80000000u);
}

// Canonical SS mechanics admits particles through the directory reverse map.
// The assignment-row lookup remains the safe fallback for explicitly
// noncanonical callers and for any malformed/stale GPU generation. Never turn
// a provenance failure into a zero-physics frame.
fn p2g_particle_enabled(particle_index: u32) -> bool {
  let spatial_admitted = p2g_spatial_directory_admitted();
  if (spatial_admitted) {
    let spatial_level = p2g_spatial_particle_level(particle_index);
    // A malformed reverse-map entry is a provenance failure for this
    // particle, not authority to remove it from mechanics.
    if (spatial_level != bitcast<i32>(0x80000000u)) {
      return spatial_level == params.schroeder_selected_level;
    }
  }
  if (params.schroeder_filter_enabled == 0u) {
    return true;
  }
  let stride = max(params.schroeder_assignment_stride_floats, 1u);
  let assignment_offset = particle_index * stride;
  let level = i32(round(schroeder_level_assignments[assignment_offset]));
  return level == params.schroeder_selected_level;
}

fn p2g_finalize_node_index(global_index: u32) -> u32 {
  if (global_index >= params.grid_node_count) {
    return params.grid_node_count;
  }
  return global_index;
}

fn p2g_try_storage_index(node_i: i32, node_j: i32, node_k: i32) -> u32 {
  let i = node_i + i32(params.shift);
  let j = node_j + i32(params.shift);
  let k = node_k + i32(params.shift);
  if (
    i < 0 || j < 0 || k < 0
    || i >= i32(params.grid_nx)
    || j >= i32(params.grid_ny)
    || k >= i32(params.grid_nz)
  ) {
    return params.grid_node_count;
  }
  let storage_i = u32(i);
  let storage_j = u32(j);
  let storage_k = u32(k);
  if (!p2g_node_enabled(storage_i, storage_j, storage_k)) {
    return params.grid_node_count;
  }
  return p2g_storage_index(storage_i, storage_j, storage_k);
}

fn p2g_atomic_add(node_index: u32, mass: f32, momentum: vec3<f32>) {
  let base = node_index * 4u;
  atomicAdd(&grid_accumulators[base], p2g_quantize(mass));
  atomicAdd(&grid_accumulators[base + 1u], p2g_quantize(momentum.x));
  atomicAdd(&grid_accumulators[base + 2u], p2g_quantize(momentum.y));
  atomicAdd(&grid_accumulators[base + 3u], p2g_quantize(momentum.z));
}

fn product_event_row0(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u];
}

fn product_event_row1(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 1u];
}

fn product_event_row2(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 2u];
}

fn product_event_row3(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 3u];
}

fn product_event_row4(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 4u];
}

fn product_event_row5(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 5u];
}

fn product_event_row6(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 6u];
}

fn product_event_row7(event_index: u32) -> vec4<f32> {
  return product_events[event_index * 8u + 7u];
}

fn det3(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32
) -> f32 {
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

fn packed_pressure(density_kg_per_m3: f32, rest_density_kg_per_m3: f32, sound_speed_m_per_s: f32, eos_model_id: f32) -> f32 {
  if (density_kg_per_m3 <= 0.0 || rest_density_kg_per_m3 <= 0.0 || sound_speed_m_per_s <= 0.0) {
    return 0.0;
  }
  if (eos_model_id > 1.5 && eos_model_id < 2.5) {
    // Gas pressure push is capped near a few times the rest density so a
    // just-vaporized particle at condensed packing exerts a bounded,
    // saturation-scale expansion pressure instead of c^2*(1000 - 0.6).
    let effective_density = min(density_kg_per_m3, rest_density_kg_per_m3 * 3.0);
    return max(0.0, sound_speed_m_per_s * sound_speed_m_per_s * (effective_density - rest_density_kg_per_m3));
  }
  if (eos_model_id > 0.5 && eos_model_id < 1.5) {
    let ratio = density_kg_per_m3 / max(rest_density_kg_per_m3, 1.0e-9);
    let stiffness = rest_density_kg_per_m3 * sound_speed_m_per_s * sound_speed_m_per_s / 7.0;
    let pressure = stiffness * (pow(ratio, 7.0) - 1.0);
    // Physical cavitation floor (P_gauge >= 0): a free liquid cannot sustain
    // bulk negative gauge tension. Artificial tensile cohesion (-0.05 * B)
    // drove MLS-MPM tensile pairing ("gnocchi" clumping) on coarse free
    // surfaces; compressive stiffness and implicit divergence-free pressure
    // maintain liquid volume without bulk tensile glue.
    return max(pressure, 0.0);
  }
  return 0.0;
}

fn corotated_stress(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32,
  mu: f32,
  lambda: f32
) -> StressRows {
  var r0 = f00; var r1 = f01; var r2 = f02;
  var r3 = f10; var r4 = f11; var r5 = f12;
  var r6 = f20; var r7 = f21; var r8 = f22;
  for (var it = 0u; it < 12u; it = it + 1u) {
    let rd = det3(r0, r1, r2, r3, r4, r5, r6, r7, r8);
    if (abs(rd) < 1.0e-12) {
      break;
    }
    let id = 1.0 / rd;
    let t0 = (r4 * r8 - r5 * r7) * id; let t3 = (r2 * r7 - r1 * r8) * id; let t6 = (r1 * r5 - r2 * r4) * id;
    let t1 = (r5 * r6 - r3 * r8) * id; let t4 = (r0 * r8 - r2 * r6) * id; let t7 = (r2 * r3 - r0 * r5) * id;
    let t2 = (r3 * r7 - r4 * r6) * id; let t5 = (r1 * r6 - r0 * r7) * id; let t8 = (r0 * r4 - r1 * r3) * id;
    let n0 = 0.5 * (r0 + t0); let n1 = 0.5 * (r1 + t1); let n2 = 0.5 * (r2 + t2);
    let n3 = 0.5 * (r3 + t3); let n4 = 0.5 * (r4 + t4); let n5 = 0.5 * (r5 + t5);
    let n6 = 0.5 * (r6 + t6); let n7 = 0.5 * (r7 + t7); let n8 = 0.5 * (r8 + t8);
    let diff = abs(n0 - r0) + abs(n4 - r4) + abs(n8 - r8);
    r0 = n0; r1 = n1; r2 = n2;
    r3 = n3; r4 = n4; r5 = n5;
    r6 = n6; r7 = n7; r8 = n8;
    if (diff < 1.0e-10) {
      break;
    }
  }

  let j = det3(f00, f01, f02, f10, f11, f12, f20, f21, f22);
  if (abs(j) < 1.0e-12) {
    return StressRows(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));
  }
  let jid = 1.0 / j;
  let ft0 = (f11 * f22 - f12 * f21) * jid; let ft3 = (f02 * f21 - f01 * f22) * jid; let ft6 = (f01 * f12 - f02 * f11) * jid;
  let ft1 = (f12 * f20 - f10 * f22) * jid; let ft4 = (f00 * f22 - f02 * f20) * jid; let ft7 = (f02 * f10 - f00 * f12) * jid;
  let ft2 = (f10 * f21 - f11 * f20) * jid; let ft5 = (f01 * f20 - f00 * f21) * jid; let ft8 = (f00 * f11 - f01 * f10) * jid;
  let c = lambda * (j - 1.0) * j;
  let p0 = 2.0 * mu * (f00 - r0) + c * ft0; let p1 = 2.0 * mu * (f01 - r1) + c * ft1; let p2 = 2.0 * mu * (f02 - r2) + c * ft2;
  let p3 = 2.0 * mu * (f10 - r3) + c * ft3; let p4 = 2.0 * mu * (f11 - r4) + c * ft4; let p5 = 2.0 * mu * (f12 - r5) + c * ft5;
  let p6 = 2.0 * mu * (f20 - r6) + c * ft6; let p7 = 2.0 * mu * (f21 - r7) + c * ft7; let p8 = 2.0 * mu * (f22 - r8) + c * ft8;
  return StressRows(
    vec3<f32>((p0 * f00 + p1 * f01 + p2 * f02) * jid, (p0 * f10 + p1 * f11 + p2 * f12) * jid, (p0 * f20 + p1 * f21 + p2 * f22) * jid),
    vec3<f32>((p3 * f00 + p4 * f01 + p5 * f02) * jid, (p3 * f10 + p4 * f11 + p5 * f12) * jid, (p3 * f20 + p4 * f21 + p5 * f22) * jid),
    vec3<f32>((p6 * f00 + p7 * f01 + p8 * f02) * jid, (p6 * f10 + p7 * f11 + p8 * f12) * jid, (p6 * f20 + p7 * f21 + p8 * f22) * jid)
  );
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  if (!p2g_particle_enabled(particle_index)) {
    return;
  }

  let state_base = particle_index * 2u;
  let thermo_base = particle_index * 3u;
  let mechanics_base = particle_index * 8u;
  let pos_mass = sph_state[state_base];
  let vel_u = sph_state[state_base + 1u];
  let thermo0 = sph_thermo[thermo_base];
  let _thermo_status = sph_thermo[thermo_base + 2u].z;
  if (!(pos_mass.w > 0.0)) {
    return;
  }

  let p_grid = pos_mass.xyz * params.inv_grid_spacing_m;
  let base_x = i32(floor(p_grid.x - 0.5));
  let base_y = i32(floor(p_grid.y - 0.5));
  let base_z = i32(floor(p_grid.z - 0.5));
  let wx = quadratic_weights(p_grid.x - f32(base_x));
  let wy = quadratic_weights(p_grid.y - f32(base_y));
  let wz = quadratic_weights(p_grid.z - f32(base_z));

  let row0 = mls_mechanics[mechanics_base];
  let row1 = mls_mechanics[mechanics_base + 1u];
  let row2 = mls_mechanics[mechanics_base + 2u];
  let row3 = mls_mechanics[mechanics_base + 3u];
  let row4 = mls_mechanics[mechanics_base + 4u];
  let row5 = mls_mechanics[mechanics_base + 5u];
  let row6 = mls_mechanics[mechanics_base + 6u];
  let row7 = mls_mechanics[mechanics_base + 7u];
  let thermo1 = sph_thermo[thermo_base + 1u];
  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
  let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
  let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
  let c00 = row2.y; let c01 = row2.z; let c02 = row2.w;
  let c10 = row3.x; let c11 = row3.y; let c12 = row3.z;
  let c20 = row3.w; let c21 = row4.x; let c22 = row4.y;
  // Current volume is authoritative only when both stored V0 and J are
  // finite-positive. Do not manufacture a pressure volume by clamping an
  // invalid determinant.
  let volume = select(
    0.0,
    row4.w * row4.z,
    row4.w > 0.0 && row4.z > 0.0
  );
  var resolved_absolute_pressure_pa = max(params.ambient_pressure_pa, 0.0);
  var sigma = StressRows(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));
  if (volume > 0.0) {
    if (row5.x > 0.5 && row5.w > 0.0) {
      sigma = corotated_stress(
        f00, f01, f02,
        f10, f11, f12,
        f20, f21, f22,
        row5.w,
        row6.x
      );
      // Positive Cauchy trace is tensile in the corotated convention, so the
      // scalar mechanical pressure is -tr(sigma)/3.
      resolved_absolute_pressure_pa = max(
        0.0,
        params.ambient_pressure_pa
          - (sigma.x.x + sigma.y.y + sigma.z.z) / 3.0
      );
    } else {
      let density = pos_mass.w / max(volume, 1.0e-30);
      // Pressure comes from the EOS via the tracked volume ratio J only. The
      // per-particle static hydrostatic prestress (row7.x) is intentionally
      // NOT added: a depth-frozen pressure field becomes unbalanced as soon
      // as particles circulate and pumps energy into the liquid.
      // On a vaporization plateau the growing gas fraction exerts a reduced-
      // speed isothermal gas pressure. row6.y is the material sound speed
      // after the host's acoustic-CFL reduction, so admitted gas must use it
      // just like every other packed EOS. Bypassing it with P_atm/rho_rest
      // silently restored the physical sound speed and made the explicit
      // mechanics step unstable.
      //
      // rho_reference scales the standard-atmosphere rest density to the
      // configured ambient pressure. This preserves zero gauge pressure at
      // rho_rest under one atmosphere while making the stiffness c^2 and
      // therefore convergent toward the physical EOS as dt is refined.
      let gas_fraction = clamp(thermo1.z, 0.0, 1.0);
      let gas_reference_density = thermo0.w * params.ambient_pressure_pa / 101325.0;
      let gas_partial_pressure = row6.y * row6.y * (density - gas_reference_density);
      let packed_material_pressure = packed_pressure(density, thermo0.w, row6.y, row6.z);
      let gas_eos = row6.z > 1.5 && row6.z < 2.5;
      // Admitted gas uses the ambient-referenced branch; the packed bounded
      // branch remains available for positionless product-event sidecars that
      // do not carry the ambient-pressure inputs yet.
      let pressure = params.internal_pressure_scale * select(
        packed_material_pressure,
        gas_fraction * gas_partial_pressure,
        gas_eos
      );
      resolved_absolute_pressure_pa = max(
        0.0,
        params.ambient_pressure_pa + pressure
      );
      // row7.y is the material's PHYSICAL shear viscosity. Artificial
      // viscosity is deliberately not folded into it: the deviatoric terms
      // below are traceless, so anything added to row7.y resists shear and
      // does nothing in compression -- the exact opposite of what a
      // shock-stabilizing artificial viscosity is for. Folding alpha*rho*c*h
      // into it gave water ~2000 Pa.s of shear viscosity against a physical
      // 0.001, roughly two million times too much: thicker than molasses,
      // which is why liquids crept instead of flowing.
      let dynamic_viscosity = max(row7.y, 0.0);
      let div_third = (c00 + c11 + c22) / 3.0;
      // The artificial term therefore appears here, as a bulk pressure gated
      // on compression: zeta = alpha * rho * c * h, p = -zeta * div(v) when
      // div(v) < 0. It damps acoustic oscillation without opposing shear.
      //
      // It is deliberately NOT folded into resolved_absolute_pressure_pa
      // above: that lane carries thermodynamic pressure authority, and a
      // numerical stabilizer is not a physical pressure.
      let velocity_divergence = 3.0 * div_third;
      let artificial_bulk_viscosity = ARTIFICIAL_BULK_VISCOSITY_ALPHA
        * density
        * max(row6.y, 0.0)
        * params.grid_spacing_m;
      let artificial_bulk_pressure = select(
        0.0,
        -artificial_bulk_viscosity * velocity_divergence,
        velocity_divergence < 0.0
      );
      let total_pressure = pressure + artificial_bulk_pressure;
      let visc00 = 2.0 * dynamic_viscosity * (c00 - div_third);
      let visc11 = 2.0 * dynamic_viscosity * (c11 - div_third);
      let visc22 = 2.0 * dynamic_viscosity * (c22 - div_third);
      let visc01 = dynamic_viscosity * (c01 + c10);
      let visc02 = dynamic_viscosity * (c02 + c20);
      let visc12 = dynamic_viscosity * (c12 + c21);
      sigma = StressRows(
        vec3<f32>(-total_pressure + visc00, visc01, visc02),
        vec3<f32>(visc01, -total_pressure + visc11, visc12),
        vec3<f32>(visc02, visc12, -total_pressure + visc22)
      );
    }
    if (params.external_gauge_pressure_enabled != 0u) {
      // The interface gas load is an external boundary traction. Internal EOS
      // pressure is represented by -pI and expands a free body in this P2G
      // weak form; the equivalent inward gas traction therefore adds +pI.
      // solid+liquid excludes gas and plasma while remaining continuous
      // through a phase transition.
      let condensed_fraction = clamp(thermo1.x + thermo1.y, 0.0, 1.0);
      let external_pressure = params.external_gauge_pressure_pa * condensed_fraction;
      sigma = StressRows(
        sigma.x + vec3<f32>(external_pressure, 0.0, 0.0),
        sigma.y + vec3<f32>(0.0, external_pressure, 0.0),
        sigma.z + vec3<f32>(0.0, 0.0, external_pressure)
      );
    }
  }
  let stress_scale = -params.dt * volume * 4.0 * params.inv_grid_spacing_m * params.inv_grid_spacing_m;
  let aff_x = vec3<f32>(
    pos_mass.w * c00 + stress_scale * sigma.x.x,
    pos_mass.w * c01 + stress_scale * sigma.x.y,
    pos_mass.w * c02 + stress_scale * sigma.x.z
  );
  let aff_y = vec3<f32>(
    pos_mass.w * c10 + stress_scale * sigma.y.x,
    pos_mass.w * c11 + stress_scale * sigma.y.y,
    pos_mass.w * c12 + stress_scale * sigma.y.z
  );
  let aff_z = vec3<f32>(
    pos_mass.w * c20 + stress_scale * sigma.z.x,
    pos_mass.w * c21 + stress_scale * sigma.z.y,
    pos_mass.w * c22 + stress_scale * sigma.z.z
  );

  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let node_i = base_x + ox;
        let node_j = base_y + oy;
        let node_k = base_z + oz;
        let node_index = p2g_try_storage_index(node_i, node_j, node_k);
        if (node_index >= params.grid_node_count) {
          continue;
        }
        let weight = p2g_weight_at(wx, ox) * p2g_weight_at(wy, oy) * p2g_weight_at(wz, oz);
        // Stencil support floor 2^-60, shared with the mechanics field view.
        if (!(weight >= bitcast<f32>(0x21800000u))) {
          continue;
        }
        let node_pos = vec3<f32>(
          f32(node_i) * params.grid_spacing_m,
          f32(node_j) * params.grid_spacing_m,
          f32(node_k) * params.grid_spacing_m
        );
        let dpos = node_pos - pos_mass.xyz;
        let affine_momentum = vec3<f32>(
          dot(aff_x, dpos),
          dot(aff_y, dpos),
          dot(aff_z, dpos)
        );
        let particle_momentum = pos_mass.w * vel_u.xyz + affine_momentum;
        p2g_atomic_add(node_index, weight * pos_mass.w, weight * particle_momentum);
      }
    }
  }
}

@compute @workgroup_size(64)
fn scatter_product_events(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event_index = global_id.x;
  if (event_index >= params.resident_product_event_count) {
    return;
  }

  let event0 = product_event_row0(event_index);
  let event3 = product_event_row3(event_index);
  let event4 = product_event_row4(event_index);
  let event5 = product_event_row5(event_index);
  let event6 = product_event_row6(event_index);
  let event7 = product_event_row7(event_index);
  let event_unplaced_mass_kg = event3.y;
  let event_status = event4.z;
  if (event_status != 1.0 || event_unplaced_mass_kg <= 0.0) {
    return;
  }

  let event_grid = event0.xyz * params.inv_grid_spacing_m;
  let base_x = i32(floor(event_grid.x - 0.5));
  let base_y = i32(floor(event_grid.y - 0.5));
  let base_z = i32(floor(event_grid.z - 0.5));
  let wx = quadratic_weights(event_grid.x - f32(base_x));
  let wy = quadratic_weights(event_grid.y - f32(base_y));
  let wz = quadratic_weights(event_grid.z - f32(base_z));
  let support_volume_m3 = max(event5.w, 0.0);
  let rest_density_kg_per_m3 = event4.y;
  let sound_speed_m_per_s = event6.w;
  let eos_model_id = event7.x;

  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let node_i = base_x + ox;
        let node_j = base_y + oy;
        let node_k = base_z + oz;
        let node_index = p2g_try_storage_index(node_i, node_j, node_k);
        if (node_index >= params.grid_node_count) {
          continue;
        }
        let weight = p2g_weight_at(wx, ox) * p2g_weight_at(wy, oy) * p2g_weight_at(wz, oz);
        // Stencil support floor 2^-60, shared with the mechanics field view.
        if (!(weight >= bitcast<f32>(0x21800000u))) {
          continue;
        }
        var pressure_affine = vec3<f32>(0.0);
        if (params.dt != 0.0 && support_volume_m3 > 0.0) {
          let event_density = event_unplaced_mass_kg / max(support_volume_m3, 1.0e-30);
          let event_pressure = params.internal_pressure_scale * packed_pressure(
            event_density,
            rest_density_kg_per_m3,
            sound_speed_m_per_s,
            eos_model_id
          );
          let event_stress_scale = -params.dt * support_volume_m3 * 4.0 * params.inv_grid_spacing_m * params.inv_grid_spacing_m;
          let diagonal_affine = event_stress_scale * -event_pressure;
          let node_pos = vec3<f32>(
            f32(node_i) * params.grid_spacing_m,
            f32(node_j) * params.grid_spacing_m,
            f32(node_k) * params.grid_spacing_m
          );
          let event_dpos = node_pos - event0.xyz;
          pressure_affine = vec3<f32>(
            diagonal_affine * event_dpos.x,
            diagonal_affine * event_dpos.y,
            diagonal_affine * event_dpos.z
          );
        }
        p2g_atomic_add(
          node_index,
          weight * event_unplaced_mass_kg,
          weight * (event_unplaced_mass_kg * event5.xyz + pressure_affine)
        );
      }
    }
  }
}

@compute @workgroup_size(64)
fn finalize_grid(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = p2g_finalize_node_index(global_id.x);
  if (node_index >= params.grid_node_count) {
    return;
  }

  let accumulator_base = node_index * 4u;
  let mass = f32(atomicLoad(&grid_accumulators[accumulator_base])) * P2G_ATOMIC_INV_SCALE;
  let momentum = vec3<f32>(
    f32(atomicLoad(&grid_accumulators[accumulator_base + 1u])) * P2G_ATOMIC_INV_SCALE,
    f32(atomicLoad(&grid_accumulators[accumulator_base + 2u])) * P2G_ATOMIC_INV_SCALE,
    f32(atomicLoad(&grid_accumulators[accumulator_base + 3u])) * P2G_ATOMIC_INV_SCALE
  );

  let plane = params.grid_ny * params.grid_nz;
  let i = node_index / plane;
  let rem = node_index - i * plane;
  let j = rem / params.grid_nz;
  let k = rem - j * params.grid_nz;
  let node_i = i32(i) - i32(params.shift);
  let node_j = i32(j) - i32(params.shift);
  let node_k = i32(k) - i32(params.shift);
  let node_pos = vec3<f32>(
    f32(node_i) * params.grid_spacing_m,
    f32(node_j) * params.grid_spacing_m,
    f32(node_k) * params.grid_spacing_m
  );

  let status = select(0.0, 1.0, mass > 0.0);
  grid_nodes[node_index * 2u] = vec4<f32>(mass, momentum.x, momentum.y, momentum.z);
  grid_nodes[node_index * 2u + 1u] = vec4<f32>(node_pos.x, node_pos.y, node_pos.z, status);
}
`;

export const mlsMpmGridUpdateWgsl = `
struct GridUpdateParams {
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  pressure_force_row_count: u32,
  pad_u1: u32,
  pad_u2: u32,
  grid_spacing_m: f32,
  dt: f32,
  gravity_x: f32,
  gravity_y: f32,
  gravity_z: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  cfl_factor: f32,
  wall_barrier_elastic_stiffness_n_per_m: f32,
  wall_barrier_contact_scale: f32,
  wall_barrier_min_gap_m: f32,
};

@group(0) @binding(0) var<storage, read> p2g_grid_nodes: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: GridUpdateParams;
@group(0) @binding(3) var<storage, read> pressure_force_rows: array<vec4<f32>>;

fn grid_update_quadratic_weights(fx: f32) -> vec3<f32> {
  let a = 1.5 - fx;
  let b = fx - 1.0;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}

fn grid_update_weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  if (offset == 0) { return weights.x; }
  if (offset == 1) { return weights.y; }
  if (offset == 2) { return weights.z; }
  return 0.0;
}

fn grid_update_clamp01(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn wall_barrier_response_alpha(node_mass_kg: f32, gap_m: f32) -> f32 {
  let min_gap_m = max(1.0e-12, abs(params.wall_barrier_min_gap_m));
  let effective_gap_m = max(max(gap_m, 0.0), min_gap_m);
  let barrier_normal_stiffness = select(0.0, node_mass_kg / (effective_gap_m * effective_gap_m), node_mass_kg > 0.0);
  let normal_stiffness = max(0.0, barrier_normal_stiffness + max(params.wall_barrier_elastic_stiffness_n_per_m, 0.0));
  let stiffness_ratio = select(0.0, normal_stiffness * params.dt * params.dt / node_mass_kg, node_mass_kg > 0.0 && params.dt > 0.0);
  return grid_update_clamp01((stiffness_ratio / (1.0 + stiffness_ratio)) * grid_update_clamp01(params.wall_barrier_contact_scale));
}

fn wall_barrier_corrected_normal_velocity(normal_velocity_m_per_s: f32, node_mass_kg: f32, gap_m: f32) -> f32 {
  let response_alpha = wall_barrier_response_alpha(node_mass_kg, gap_m);
  let inward_velocity_m_per_s = max(0.0, -normal_velocity_m_per_s);
  var corrected_normal_velocity_m_per_s = normal_velocity_m_per_s + inward_velocity_m_per_s * response_alpha;
  if (response_alpha >= 1.0 - 1.0e-6 && corrected_normal_velocity_m_per_s < 1.0e-6 && normal_velocity_m_per_s < 0.0) {
    corrected_normal_velocity_m_per_s = 0.0;
  }
  return corrected_normal_velocity_m_per_s;
}

fn grid_update_clamp_velocity_to_speed(
  velocity: vec3<f32>,
  max_speed_m_per_s: f32
) -> vec3<f32> {
  // Squaring an otherwise finite f32 velocity can overflow. Comparing
  // dot(v,v) with vmax*vmax then degenerates to inf > inf == false and
  // silently bypasses the CFL bound. Normalize by the largest component
  // first so the only squared norm is in [0, 3].
  let finite_velocity = all(vec3<bool>(
    (bitcast<u32>(velocity.x) & 0x7fffffffu) < 0x7f800000u,
    (bitcast<u32>(velocity.y) & 0x7fffffffu) < 0x7f800000u,
    (bitcast<u32>(velocity.z) & 0x7fffffffu) < 0x7f800000u
  ));
  let finite_cap =
    (bitcast<u32>(max_speed_m_per_s) & 0x7fffffffu) < 0x7f800000u;
  if (!finite_velocity || !finite_cap || !(max_speed_m_per_s > 0.0)) {
    return vec3<f32>(0.0);
  }
  // Leave a 2^-16 relative debit for division, normalization, and the final
  // multiply. The reaction motion envelope uses the unguarded CFL distance,
  // so this makes the published velocity strictly conservative.
  let guarded_max_speed = max_speed_m_per_s * 0.9999847412109375;
  if (!(guarded_max_speed > 0.0)) {
    return vec3<f32>(0.0);
  }
  let largest_component = max(
    max(abs(velocity.x), abs(velocity.y)),
    abs(velocity.z)
  );
  if (largest_component > 0.0) {
    let largest_bits = bitcast<u32>(largest_component);
    if (largest_bits < 0x00800000u || largest_bits > 0x7e800000u) {
      return vec3<f32>(0.0);
    }
    let scaled_velocity = velocity / largest_component;
    let scaled_length = length(scaled_velocity);
    if (
      !((bitcast<u32>(scaled_length) & 0x7fffffffu) < 0x7f800000u)
      || !(scaled_length > 0.0)
    ) {
      return vec3<f32>(0.0);
    }
    if (largest_component > guarded_max_speed / scaled_length) {
      return scaled_velocity * (guarded_max_speed / scaled_length);
    }
  }
  return velocity;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = global_id.x;
  if (node_index >= params.grid_node_count) {
    return;
  }

  let row0 = p2g_grid_nodes[node_index * 2u];
  let row1 = p2g_grid_nodes[node_index * 2u + 1u];
  let mass = row0.x;
  var momentum = row0.yzw;
  let node_i = i32(round(row1.x / max(params.grid_spacing_m, 1.0e-12)));
  let node_j = i32(round(row1.y / max(params.grid_spacing_m, 1.0e-12)));
  let node_k = i32(round(row1.z / max(params.grid_spacing_m, 1.0e-12)));

  if (mass > 0.0) {
    for (var force_index = 0u; force_index < params.pressure_force_row_count; force_index = force_index + 1u) {
      let force_row1 = pressure_force_rows[force_index * 4u + 1u];
      let force_row2 = pressure_force_rows[force_index * 4u + 2u];
      let force_row3 = pressure_force_rows[force_index * 4u + 3u];
      if (force_row3.w <= 0.0) {
        continue;
      }
      let force_grid = force_row1.xyz / max(params.grid_spacing_m, 1.0e-12);
      let base_x = i32(floor(force_grid.x - 0.5));
      let base_y = i32(floor(force_grid.y - 0.5));
      let base_z = i32(floor(force_grid.z - 0.5));
      let ox = node_i - base_x;
      let oy = node_j - base_y;
      let oz = node_k - base_z;
      if (ox < 0 || ox > 2 || oy < 0 || oy > 2 || oz < 0 || oz > 2) {
        continue;
      }
      let wx = grid_update_quadratic_weights(force_grid.x - f32(base_x));
      let wy = grid_update_quadratic_weights(force_grid.y - f32(base_y));
      let wz = grid_update_quadratic_weights(force_grid.z - f32(base_z));
      let weight = grid_update_weight_at(wx, ox) * grid_update_weight_at(wy, oy) * grid_update_weight_at(wz, oz);
      momentum = momentum + params.dt * weight * force_row2.xyz;
    }
  }

  var velocity = vec3<f32>(0.0, 0.0, 0.0);
  var status = 0.0;

  if (mass > 0.0) {
    velocity = momentum / mass + vec3<f32>(params.gravity_x, params.gravity_y, params.gravity_z) * params.dt;
    let vmax = params.cfl_factor * params.grid_spacing_m / max(params.dt, 1.0e-12);
    velocity = grid_update_clamp_velocity_to_speed(velocity, vmax);
    let node_pos = row1.xyz;
    let boundary_epsilon_m = max(1.0e-7, abs(params.grid_spacing_m) * 1.0e-6);
    let floor_no_slip_limit_m = params.grid_spacing_m - boundary_epsilon_m;
    if (node_pos.y < floor_no_slip_limit_m) {
      let floor_gap_m = max(0.0, node_pos.y);
      // Free-slip floor: only the normal component is corrected, matching the
      // x/z walls. Grid-level tangential kill created a one-cell-thick
      // artificial boundary layer that froze liquid spreading (dam-break
      // fronts crept at ~0.1 m/s); near-wall dissipation is handled by the
      // tunable liquid wall damping in G2P instead.
      velocity.y = wall_barrier_corrected_normal_velocity(velocity.y, mass, floor_gap_m);
    }
    if (node_pos.x <= params.grid_spacing_m + boundary_epsilon_m && velocity.x < 0.0) {
      velocity.x = wall_barrier_corrected_normal_velocity(
        velocity.x,
        mass,
        max(0.0, node_pos.x - params.grid_spacing_m + boundary_epsilon_m)
      );
    }
    if (node_pos.x >= params.box_x - params.grid_spacing_m - boundary_epsilon_m && velocity.x > 0.0) {
      velocity.x = -wall_barrier_corrected_normal_velocity(
        -velocity.x,
        mass,
        max(0.0, params.box_x - params.grid_spacing_m - node_pos.x + boundary_epsilon_m)
      );
    }
    if (node_pos.y >= params.box_y - params.grid_spacing_m - boundary_epsilon_m && velocity.y > 0.0) {
      velocity.y = -wall_barrier_corrected_normal_velocity(
        -velocity.y,
        mass,
        max(0.0, params.box_y - params.grid_spacing_m - node_pos.y + boundary_epsilon_m)
      );
    }
    if (node_pos.z <= params.grid_spacing_m + boundary_epsilon_m && velocity.z < 0.0) {
      velocity.z = wall_barrier_corrected_normal_velocity(
        velocity.z,
        mass,
        max(0.0, node_pos.z - params.grid_spacing_m + boundary_epsilon_m)
      );
    }
    if (node_pos.z >= params.box_z - params.grid_spacing_m - boundary_epsilon_m && velocity.z > 0.0) {
      velocity.z = -wall_barrier_corrected_normal_velocity(
        -velocity.z,
        mass,
        max(0.0, params.box_z - params.grid_spacing_m - node_pos.z + boundary_epsilon_m)
      );
    }
    velocity = grid_update_clamp_velocity_to_speed(velocity, vmax);
    status = 1.0;
  }

  updated_grid_nodes[node_index * 2u] = vec4<f32>(mass, velocity.x, velocity.y, velocity.z);
  updated_grid_nodes[node_index * 2u + 1u] = vec4<f32>(row1.x, row1.y, row1.z, status);
}
`;

export const sphPressureInterfaceForceRowsWgsl = `
struct PressureInterfaceParams {
  element_count: u32,
  pressure_pa: f32,
  gas_pressure_cell_count: u32,
  pressure_model_id: u32,
  contact_policy_row_count: u32,
  contact_response_scale: f32,
  contact_max_pressure_pa: f32,
  contact_pair_response_enabled: f32,
  gas_authority_execution_generation: u32,
  gas_authority_storage_generation: u32,
  gas_pressure_cell_capacity: u32,
  gas_pressure_cell_stride_floats: u32,
};

@group(0) @binding(0) var<storage, read> interface_elements: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> pressure_force_rows: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: PressureInterfaceParams;
@group(0) @binding(3) var<storage, read> gas_pressure_cells: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> contact_policy_rows: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> contact_kinematics_rows: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> gas_authority_control: array<u32>;

const GAS_AUTHORITY_MAGIC: u32 = 0x53474133u;
const GAS_AUTHORITY_VERSION: u32 = 4u;
const GAS_AUTHORITY_REQUIRED_READY: u32 = 31u;
const GAS_AUTHORITY_EMPTY: u32 = 32u;
const GAS_AUTHORITY_FAILED: u32 = 0x80000000u;
const GAS_AUTHORITY_UNKNOWN_STATUS_MASK: u32 = 0x7fffffc0u;
const GAS_AUTHORITY_INVALID_COUNT: u32 = 0xffffffffu;
const GAS_AUTHORITY_F32_MAX: f32 = 3.402823466e38;

fn authenticated_gas_pressure_cell_count() -> u32 {
  if (
    params.pressure_model_id != 2u
    || arrayLength(&gas_authority_control) < 36u
    || gas_authority_control[0u] != GAS_AUTHORITY_MAGIC
    || gas_authority_control[1u] != GAS_AUTHORITY_VERSION
    || (gas_authority_control[2u] & GAS_AUTHORITY_REQUIRED_READY)
      != GAS_AUTHORITY_REQUIRED_READY
    || (gas_authority_control[2u] & GAS_AUTHORITY_FAILED) != 0u
    || (gas_authority_control[2u] & GAS_AUTHORITY_UNKNOWN_STATUS_MASK) != 0u
    || gas_authority_control[3u] != 0u
    || gas_authority_control[4u] != params.gas_authority_execution_generation
    || gas_authority_control[5u] != params.gas_authority_execution_generation
    || gas_authority_control[6u] != params.gas_authority_storage_generation
    || gas_authority_control[7u] != params.gas_pressure_cell_capacity
    || gas_authority_control[30u] != params.gas_pressure_cell_stride_floats
    || gas_authority_control[31u] != gas_authority_control[10u]
    || params.gas_pressure_cell_stride_floats != 12u
    || params.gas_pressure_cell_capacity > 0x55555555u
    || arrayLength(&gas_pressure_cells) < params.gas_pressure_cell_capacity * 3u
  ) {
    return GAS_AUTHORITY_INVALID_COUNT;
  }
  let live_count = gas_authority_control[8u];
  let directory_generation = gas_authority_control[9u];
  let directory_cell_count = gas_authority_control[10u];
  let ready_pressure_count = gas_authority_control[11u];
  let empty = (gas_authority_control[2u] & GAS_AUTHORITY_EMPTY) != 0u;
  if (
    live_count > params.gas_pressure_cell_capacity
    || directory_generation == 0u
    || directory_cell_count > live_count
    || ready_pressure_count != directory_cell_count
    || (empty && (live_count != 0u || directory_cell_count != 0u))
    || (!empty && (live_count == 0u || directory_cell_count == 0u))
  ) {
    return GAS_AUTHORITY_INVALID_COUNT;
  }
  return ready_pressure_count;
}

fn pressure_for_centroid(centroid: vec3<f32>) -> vec2<f32> {
  if (params.pressure_model_id == 0u) {
    return vec2<f32>(params.pressure_pa, 1.0);
  }
  var pressure_cell_count = params.gas_pressure_cell_count;
  if (params.pressure_model_id == 2u) {
    pressure_cell_count = authenticated_gas_pressure_cell_count();
    if (pressure_cell_count == GAS_AUTHORITY_INVALID_COUNT) {
      return vec2<f32>(0.0, 0.0);
    }
  } else if (params.pressure_model_id != 1u) {
    return vec2<f32>(params.pressure_pa, 1.0);
  }
  if (pressure_cell_count == 0u) {
    return vec2<f32>(
      select(params.pressure_pa, 0.0, params.pressure_model_id == 2u),
      1.0
    );
  }
  var best_pressure = select(
    params.pressure_pa,
    0.0,
    params.pressure_model_id == 2u
  );
  var best_distance2 = 1.0e30;
  var usable_pressure_cell_count = 0u;
  for (var cell_index = 0u; cell_index < pressure_cell_count; cell_index = cell_index + 1u) {
    let row0 = gas_pressure_cells[cell_index * 3u];
    let row1 = gas_pressure_cells[cell_index * 3u + 1u];
    let row2 = gas_pressure_cells[cell_index * 3u + 2u];
    let finite_row = all(abs(row1) <= vec4<f32>(GAS_AUTHORITY_F32_MAX))
      && all(abs(row2.xyz) <= vec3<f32>(GAS_AUTHORITY_F32_MAX));
    if (row0.w > 0.0 && row1.w >= 0.0 && finite_row) {
      let delta = centroid - row1.xyz;
      let distance2 = dot(delta, delta);
      let local_pressure = row1.w + dot(row2.xyz, delta);
      let finite_sample = abs(distance2) <= GAS_AUTHORITY_F32_MAX
        && abs(local_pressure) <= GAS_AUTHORITY_F32_MAX;
      if (finite_sample) {
        usable_pressure_cell_count = usable_pressure_cell_count + 1u;
      }
      if (finite_sample && distance2 < best_distance2) {
        best_distance2 = distance2;
        best_pressure = max(0.0, local_pressure);
      }
    }
  }
  let pressure_sample_valid = params.pressure_model_id != 2u
    || usable_pressure_cell_count > 0u;
  return vec2<f32>(best_pressure, select(0.0, 1.0, pressure_sample_valid));
}

fn contact_policy_element_side(row_index: u32, material_id: f32, phase_id: f32) -> u32 {
  let row0 = contact_policy_rows[row_index * 4u];
  let row2 = contact_policy_rows[row_index * 4u + 2u];
  if (row2.y <= 0.0) {
    return 0u;
  }
  let endpoint_a_match = abs(material_id - row0.x) < 0.5
    && (row0.z <= 0.5 || abs(phase_id - row0.z) < 0.5);
  let endpoint_b_match = abs(material_id - row0.y) < 0.5
    && (row0.w <= 0.5 || abs(phase_id - row0.w) < 0.5);
  let exact_phase_a = row0.z > 0.5 && abs(phase_id - row0.z) < 0.5;
  let exact_phase_b = row0.w > 0.5 && abs(phase_id - row0.w) < 0.5;
  if (endpoint_a_match && endpoint_b_match && exact_phase_b && !exact_phase_a) {
    return 2u;
  }
  if (endpoint_a_match) {
    return 1u;
  }
  return select(0u, 2u, endpoint_b_match);
}

fn contact_policy_matches_element(row_index: u32, material_id: f32, phase_id: f32) -> bool {
  return contact_policy_element_side(row_index, material_id, phase_id) != 0u;
}

fn contact_domain_pair_matches(policy_identity: vec4<f32>, element_identity: vec4<f32>) -> bool {
  if (policy_identity.w <= 0.5 || element_identity.z <= 0.5) {
    return false;
  }
  return (abs(policy_identity.x - element_identity.x) < 0.5
      && abs(policy_identity.y - element_identity.y) < 0.5)
    || (abs(policy_identity.x - element_identity.y) < 0.5
      && abs(policy_identity.y - element_identity.x) < 0.5);
}

fn contact_selected_domain_pair_matches(
  policy_identity: vec4<f32>,
  element_identity: vec4<f32>,
  element_side: u32
) -> bool {
  if (policy_identity.z <= 0.5) {
    return true;
  }
  if (policy_identity.w <= 0.5 || element_identity.z <= 0.5) {
    return false;
  }
  let expected_source_domain = select(policy_identity.y, policy_identity.x, element_side == 1u);
  let expected_target_domain = select(policy_identity.x, policy_identity.y, element_side == 1u);
  return abs(expected_source_domain - element_identity.x) < 0.5
    && abs(expected_target_domain - element_identity.y) < 0.5;
}

fn contact_pressure_for_policy_row(row_index: u32, area_m2: f32, kinematics: vec4<f32>) -> f32 {
  let row1 = contact_policy_rows[row_index * 4u + 1u];
  let row2 = contact_policy_rows[row_index * 4u + 2u];
  let support_radius_m = max(row1.z, 1.0e-6);
  let gap_m = max(kinematics.x, 0.0);
  let normal_velocity_m_per_s = kinematics.y;
  let closing_speed_m_per_s = max(-normal_velocity_m_per_s, 0.0);
  if (gap_m > support_radius_m && (closing_speed_m_per_s <= 0.0 || gap_m > support_radius_m * 2.0)) {
    return 0.0;
  }
  let effective_gap_m = max(gap_m, max(support_radius_m * 0.001, 1.0e-9));
  let proximity = clamp((support_radius_m - gap_m) / support_radius_m, 0.0, 1.0);
  let barrier_gain = proximity * min((support_radius_m / effective_gap_m) * (support_radius_m / effective_gap_m), 1000000.0);
  let elastic_pressure_pa = max(row1.x, 0.0) * max(row1.w, 0.0) * barrier_gain;
  let damping_pressure_pa = max(row1.y, 0.0) * closing_speed_m_per_s / support_radius_m;
  var inertial_pressure_pa = 0.0;
  if (kinematics.z > 0.0 && area_m2 > 0.0 && closing_speed_m_per_s > 0.0) {
    inertial_pressure_pa = kinematics.z * closing_speed_m_per_s * closing_speed_m_per_s / max(area_m2 * effective_gap_m, 1.0e-12);
  }
  var row_cap_pa = params.contact_max_pressure_pa;
  if (row2.x > 0.0) {
    row_cap_pa = min(row2.x, params.contact_max_pressure_pa);
  }
  return min(
    max(elastic_pressure_pa + damping_pressure_pa + inertial_pressure_pa, 0.0),
    row_cap_pa
  );
}

fn contact_pressure_for_element(
  material_id: f32,
  phase_id: f32,
  area_m2: f32,
  kinematics: vec4<f32>,
  element_identity: vec4<f32>
) -> f32 {
  if (params.contact_pair_response_enabled <= 0.0 || params.contact_policy_row_count == 0u) {
    return 0.0;
  }
  if (kinematics.w != kinematics.w) {
    return 0.0;
  }
  // Exact-near and resident GPU derivations carry the selected policy as a
  // one-based token in element_identity.w.  Once present it is authoritative:
  // never reselect a different row or fall back after a malformed token.
  let selected_policy_token = element_identity.w;
  if (kinematics.w == 2.0) {
    if (
      selected_policy_token != selected_policy_token
      || abs(selected_policy_token) > 16777216.0
    ) {
      return 0.0;
    }
    if (
      selected_policy_token != trunc(selected_policy_token)
      || selected_policy_token < 1.0
      || selected_policy_token > f32(params.contact_policy_row_count)
    ) {
      return 0.0;
    }
    let selected_policy_row = u32(selected_policy_token) - 1u;
    let selected_element_side = contact_policy_element_side(
      selected_policy_row,
      material_id,
      phase_id
    );
    if (selected_element_side == 0u) {
      return 0.0;
    }
    let selected_policy_identity = contact_policy_rows[selected_policy_row * 4u + 3u];
    if (!contact_selected_domain_pair_matches(
      selected_policy_identity,
      element_identity,
      selected_element_side
    )) {
      return 0.0;
    }
    return contact_pressure_for_policy_row(selected_policy_row, area_m2, kinematics);
  }
  if (
    kinematics.w != 1.0
    || selected_policy_token != selected_policy_token
    || selected_policy_token != 0.0
  ) {
    return 0.0;
  }
  var generic_row = 4294967295u;
  var generic_count = 0u;
  var exact_domain_row = 4294967295u;
  var exact_domain_count = 0u;
  for (var row_index = 0u; row_index < params.contact_policy_row_count; row_index = row_index + 1u) {
    if (!contact_policy_matches_element(row_index, material_id, phase_id)) {
      continue;
    }
    let policy_identity = contact_policy_rows[row_index * 4u + 3u];
    let body_specific = policy_identity.z > 0.5;
    if (!body_specific) {
      if (generic_count == 0u) {
        generic_row = row_index;
      }
      generic_count = generic_count + 1u;
    } else if (contact_domain_pair_matches(policy_identity, element_identity)) {
      if (exact_domain_count == 0u) {
        exact_domain_row = row_index;
      }
      exact_domain_count = exact_domain_count + 1u;
    }
  }

  var selected_row = 4294967295u;
  if (element_identity.z > 0.5 && exact_domain_count == 1u) {
    selected_row = exact_domain_row;
  } else if (generic_count > 0u) {
    // A missing pair, no exact pair, or an ambiguous exact pair may use only
    // an explicit generic material/phase fallback. Never silently select one
    // of several body-specific rows.
    selected_row = generic_row;
  }
  if (selected_row == 4294967295u) {
    return 0.0;
  }
  return contact_pressure_for_policy_row(selected_row, area_m2, kinematics);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let element_index = global_id.x;
  if (element_index >= params.element_count) {
    return;
  }

  let row0 = interface_elements[element_index * 4u];
  let row1 = interface_elements[element_index * 4u + 1u];
  let row2 = interface_elements[element_index * 4u + 2u];
  let row3 = interface_elements[element_index * 4u + 3u];
  let centroid = row1.xyz;
  let area = row1.w;
  let status = row3.w;
  // Gas/plasma carriers already receive this pressure through their EOS
  // stress. Feeding it back as traction on their own extracted surface would
  // double-count the same pressure, with a catastrophic area/mass ratio for
  // newly produced gas particles.
  let gas_pressure_sample = pressure_for_centroid(centroid);
  let gas_pressure_pa = select(
    gas_pressure_sample.x,
    0.0,
    row0.z == 3.0 || row0.z == 4.0
  );
  let contact_kinematics = contact_kinematics_rows[element_index * 2u];
  let contact_identity = contact_kinematics_rows[element_index * 2u + 1u];
  let contact_pressure_pa = contact_pressure_for_element(
    row0.y,
    row0.z,
    area,
    contact_kinematics,
    contact_identity
  );
  let pressure_pa = gas_pressure_pa + contact_pressure_pa;
  var normal_area = vec3<f32>(row2.w, row3.x, row3.y);
  if (dot(normal_area, normal_area) <= 1.0e-24) {
    normal_area = row2.xyz * area;
  }
  let gas_authority_or_contact_ready = params.pressure_model_id != 2u
    || gas_pressure_sample.y > 0.0
    || contact_pressure_pa > 0.0;
  let ready = select(
    0.0,
    1.0,
    status > 0.0
      && area > 0.0
      && pressure_pa >= 0.0
      && gas_authority_or_contact_ready
  );
  let material_force = -pressure_pa * normal_area * ready;
  let gas_reaction_force = -material_force;

  pressure_force_rows[element_index * 4u] = row0;
  pressure_force_rows[element_index * 4u + 1u] = vec4<f32>(row1.xyz, area);
  pressure_force_rows[element_index * 4u + 2u] = vec4<f32>(material_force, gas_reaction_force.x);
  pressure_force_rows[element_index * 4u + 3u] = vec4<f32>(gas_reaction_force.y, gas_reaction_force.z, pressure_pa, ready);
}
`;

export const sphPressureInterfaceParticleBinsWgsl = `
struct ParticleBinParams {
  particle_count: u32,
  cell_count: u32,
  bin_capacity: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  bins_enabled: u32,
  _pad0: u32,
  origin_x_m: f32,
  origin_y_m: f32,
  origin_z_m: f32,
  cell_size_m: f32,
  inv_cell_size_m: f32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
};

@group(0) @binding(0) var<storage, read> particle_state_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> particle_bin_counts: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> particle_bin_indices: array<u32>;
@group(0) @binding(3) var<storage, read_write> particle_bin_metadata: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: ParticleBinParams;

fn particle_bin_state_row0(particle_index: u32) -> vec4<f32> {
  return particle_state_rows[particle_index * 2u];
}

fn particle_bin_clamp_coord(value: f32, axis_count: u32) -> u32 {
  if (axis_count <= 1u) {
    return 0u;
  }
  let raw = floor(value * params.inv_cell_size_m);
  let clamped = clamp(raw, 0.0, f32(axis_count - 1u));
  return u32(clamped);
}

fn particle_bin_cell_index(coords: vec3<u32>) -> u32 {
  return coords.x + coords.y * params.grid_nx + coords.z * params.grid_nx * params.grid_ny;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (
    params.bins_enabled == 0u
    || particle_index >= params.particle_count
    || params.cell_count == 0u
    || params.bin_capacity == 0u
    || params.cell_size_m <= 0.0
  ) {
    return;
  }
  let state0 = particle_bin_state_row0(particle_index);
  if (state0.w <= 0.0) {
    return;
  }
  let relative = state0.xyz - vec3<f32>(params.origin_x_m, params.origin_y_m, params.origin_z_m);
  let coords = vec3<u32>(
    particle_bin_clamp_coord(relative.x, params.grid_nx),
    particle_bin_clamp_coord(relative.y, params.grid_ny),
    particle_bin_clamp_coord(relative.z, params.grid_nz)
  );
  let cell_index = particle_bin_cell_index(coords);
  if (cell_index >= params.cell_count) {
    return;
  }
  let slot = atomicAdd(&particle_bin_counts[cell_index], 1u);
  if (slot < params.bin_capacity) {
    particle_bin_indices[cell_index * params.bin_capacity + slot] = particle_index;
  } else {
    atomicAdd(&particle_bin_metadata[0u], 1u);
  }
}
`;

export const sphPressureInterfaceContactKinematicsWgsl = `
struct ContactKinematicsParams {
  element_count: u32,
  particle_count: u32,
  contact_policy_row_count: u32,
  derivation_enabled: u32,
  particle_bin_grid_enabled: u32,
  particle_bin_cell_count: u32,
  particle_bin_capacity: u32,
  particle_bin_grid_nx: u32,
  particle_bin_grid_ny: u32,
  particle_bin_grid_nz: u32,
  max_search_radius_m: f32,
  gap_floor_m: f32,
  particle_bin_origin_x_m: f32,
  particle_bin_origin_y_m: f32,
  particle_bin_origin_z_m: f32,
  particle_bin_cell_size_m: f32,
};

struct SchroederContactLawQueueParams {
  enabled: u32,
  active_node_count: u32,
  law_queue_stride: u32,
  law_mask: u32,
};

struct SchroederContactLawNeighborParams {
  enabled: u32,
  candidate_count: u32,
  candidate_stride: u32,
  law_mask: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
  _pad3: u32,
};

struct SchroederContactSourceSpanParams {
  enabled: u32,
  source_span_count: u32,
  source_span_stride: u32,
  broad_candidate_fallback_enabled: u32,
};

struct InterfaceSourceKeyParams {
  enabled: u32,
  row_count: u32,
  row_stride: u32,
  surface_index_fallback_enabled: u32,
};

@group(0) @binding(0) var<storage, read> interface_elements: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> particle_state_rows: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> particle_thermo_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> contact_policy_rows: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> contact_kinematics_rows: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: ContactKinematicsParams;
@group(0) @binding(6) var<storage, read> particle_bin_counts: array<u32>;
@group(0) @binding(7) var<storage, read> particle_bin_indices: array<u32>;
@group(0) @binding(8) var<storage, read> schroeder_contact_law_queue_rows: array<f32>;
@group(0) @binding(9) var<uniform> schroeder_contact_law_queue_params: SchroederContactLawQueueParams;
@group(0) @binding(10) var<storage, read> schroeder_contact_neighbor_candidate_rows: array<f32>;
@group(0) @binding(11) var<uniform> schroeder_contact_neighbor_candidate_params: SchroederContactLawNeighborParams;
@group(0) @binding(12) var<storage, read> schroeder_contact_source_span_rows: array<f32>;
@group(0) @binding(13) var<uniform> schroeder_contact_source_span_params: SchroederContactSourceSpanParams;
@group(0) @binding(14) var<storage, read> interface_source_key_rows: array<f32>;
@group(0) @binding(15) var<uniform> interface_source_key_params: InterfaceSourceKeyParams;
@group(0) @binding(16) var<storage, read> particle_identity: array<u32>;

const SCHROEDER_CONTACT_LAW_QUEUE_STRIDE: u32 = 32u;
const SCHROEDER_CONTACT_LAW_QUEUE_STATUS_OFFSET: u32 = 3u;
const SCHROEDER_CONTACT_LAW_QUEUE_LAW_MASK_OFFSET: u32 = 12u;
const SCHROEDER_CONTACT_LAW_QUEUE_CONTACT_ELIGIBLE_OFFSET: u32 = 14u;
const SCHROEDER_CONTACT_LAW_QUEUE_INTERFACE_ELIGIBLE_OFFSET: u32 = 15u;
const SCHROEDER_CONTACT_LAW_NEIGHBOR_STRIDE: u32 = 16u;
const SCHROEDER_CONTACT_LAW_NEIGHBOR_SOURCE_OFFSET: u32 = 0u;
const SCHROEDER_CONTACT_LAW_NEIGHBOR_NEIGHBOR_OFFSET: u32 = 1u;
const SCHROEDER_CONTACT_LAW_NEIGHBOR_LAW_MASK_OFFSET: u32 = 2u;
const SCHROEDER_CONTACT_LAW_NEIGHBOR_STATUS_OFFSET: u32 = 3u;
const SCHROEDER_CONTACT_LAW_NEIGHBOR_STATUS_READY: f32 = 1.0;
const SCHROEDER_CONTACT_SOURCE_SPAN_STRIDE: u32 = 4u;
const SCHROEDER_CONTACT_SOURCE_SPAN_SOURCE_OFFSET: u32 = 0u;
const SCHROEDER_CONTACT_SOURCE_SPAN_START_OFFSET: u32 = 1u;
const SCHROEDER_CONTACT_SOURCE_SPAN_COUNT_OFFSET: u32 = 2u;
const SCHROEDER_CONTACT_SOURCE_SPAN_STATUS_OFFSET: u32 = 3u;
const INTERFACE_SOURCE_KEY_STRIDE: u32 = 4u;
const INTERFACE_SOURCE_KEY_ELEMENT_OFFSET: u32 = 0u;
const INTERFACE_SOURCE_KEY_SOURCE_OFFSET: u32 = 1u;
const INTERFACE_SOURCE_KEY_STATUS_OFFSET: u32 = 2u;

struct CkParticleCandidate {
  source_match: u32,
  target_match: u32,
  signed_m: f32,
  lateral2: f32,
  velocity: vec3<f32>,
  mass_kg: f32,
};

fn ck_state_row0(particle_index: u32) -> vec4<f32> {
  return particle_state_rows[particle_index * 2u];
}

fn ck_state_row1(particle_index: u32) -> vec4<f32> {
  return particle_state_rows[particle_index * 2u + 1u];
}

fn ck_thermo_row0(particle_index: u32) -> vec4<f32> {
  return particle_thermo_rows[particle_index * 3u];
}

fn ck_thermo_row2(particle_index: u32) -> vec4<f32> {
  return particle_thermo_rows[particle_index * 3u + 2u];
}

fn ck_phase_matches(particle_phase_id: f32, required_phase_id: f32) -> bool {
  return required_phase_id <= 0.5 || abs(particle_phase_id - required_phase_id) < 0.5;
}

fn ck_schroeder_law_queue_enabled() -> bool {
  return schroeder_contact_law_queue_params.enabled != 0u
    && schroeder_contact_law_queue_params.active_node_count > 0u
    && schroeder_contact_law_queue_params.law_queue_stride > 0u
    && schroeder_contact_law_queue_params.law_mask != 0u;
}

fn ck_schroeder_law_queue_allows_particle(particle_index: u32) -> bool {
  if (!ck_schroeder_law_queue_enabled()) {
    return true;
  }
  if (particle_index >= schroeder_contact_law_queue_params.active_node_count) {
    return false;
  }
  let queue_stride = max(
    schroeder_contact_law_queue_params.law_queue_stride,
    SCHROEDER_CONTACT_LAW_QUEUE_STRIDE
  );
  let queue_offset = particle_index * queue_stride;
  let queue_status = schroeder_contact_law_queue_rows[
    queue_offset + SCHROEDER_CONTACT_LAW_QUEUE_STATUS_OFFSET
  ];
  let row_enabled = queue_status > 0.0 && queue_status < 32.0;
  let law_mask = u32(max(round(schroeder_contact_law_queue_rows[
    queue_offset + SCHROEDER_CONTACT_LAW_QUEUE_LAW_MASK_OFFSET
  ]), 0.0));
  let contact_eligible = schroeder_contact_law_queue_rows[
    queue_offset + SCHROEDER_CONTACT_LAW_QUEUE_CONTACT_ELIGIBLE_OFFSET
  ] > 0.5;
  let interface_eligible = schroeder_contact_law_queue_rows[
    queue_offset + SCHROEDER_CONTACT_LAW_QUEUE_INTERFACE_ELIGIBLE_OFFSET
  ] > 0.5;
  return row_enabled
    && (contact_eligible || interface_eligible)
    && ((law_mask & schroeder_contact_law_queue_params.law_mask) != 0u);
}

fn ck_schroeder_neighbor_candidates_enabled() -> bool {
  return schroeder_contact_neighbor_candidate_params.enabled != 0u
    && schroeder_contact_neighbor_candidate_params.candidate_count > 0u
    && schroeder_contact_neighbor_candidate_params.candidate_stride > 0u
    && schroeder_contact_neighbor_candidate_params.law_mask != 0u;
}

fn ck_schroeder_source_spans_enabled() -> bool {
  return ck_schroeder_neighbor_candidates_enabled()
    && schroeder_contact_source_span_params.enabled != 0u
    && schroeder_contact_source_span_params.source_span_count > 0u
    && schroeder_contact_source_span_params.source_span_stride > 0u;
}

fn ck_schroeder_candidate_span(source_particle_index: u32) -> vec4<u32> {
  if (!ck_schroeder_source_spans_enabled()
      || source_particle_index >= schroeder_contact_source_span_params.source_span_count) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }
  let span_stride = max(
    schroeder_contact_source_span_params.source_span_stride,
    SCHROEDER_CONTACT_SOURCE_SPAN_STRIDE
  );
  let span_offset = source_particle_index * span_stride;
  let status = schroeder_contact_source_span_rows[
    span_offset + SCHROEDER_CONTACT_SOURCE_SPAN_STATUS_OFFSET
  ];
  if (abs(status - SCHROEDER_CONTACT_LAW_NEIGHBOR_STATUS_READY) > 0.5) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }
  let row_source = u32(max(round(schroeder_contact_source_span_rows[
    span_offset + SCHROEDER_CONTACT_SOURCE_SPAN_SOURCE_OFFSET
  ]), 0.0));
  if (row_source != source_particle_index) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }
  let span_start = min(
    u32(max(round(schroeder_contact_source_span_rows[
      span_offset + SCHROEDER_CONTACT_SOURCE_SPAN_START_OFFSET
    ]), 0.0)),
    schroeder_contact_neighbor_candidate_params.candidate_count
  );
  let span_count = u32(max(round(schroeder_contact_source_span_rows[
    span_offset + SCHROEDER_CONTACT_SOURCE_SPAN_COUNT_OFFSET
  ]), 0.0));
  return vec4<u32>(span_start, span_count, 1u, 0u);
}

fn ck_schroeder_candidate_particle(candidate_index: u32, endpoint: u32) -> u32 {
  if (!ck_schroeder_neighbor_candidates_enabled() || candidate_index >= schroeder_contact_neighbor_candidate_params.candidate_count) {
    return 4294967295u;
  }
  let candidate_stride = max(
    schroeder_contact_neighbor_candidate_params.candidate_stride,
    SCHROEDER_CONTACT_LAW_NEIGHBOR_STRIDE
  );
  let candidate_offset = candidate_index * candidate_stride;
  let status = schroeder_contact_neighbor_candidate_rows[
    candidate_offset + SCHROEDER_CONTACT_LAW_NEIGHBOR_STATUS_OFFSET
  ];
  if (abs(status - SCHROEDER_CONTACT_LAW_NEIGHBOR_STATUS_READY) > 0.5) {
    return 4294967295u;
  }
  let law_mask = u32(max(round(schroeder_contact_neighbor_candidate_rows[
    candidate_offset + SCHROEDER_CONTACT_LAW_NEIGHBOR_LAW_MASK_OFFSET
  ]), 0.0));
  if ((law_mask & schroeder_contact_neighbor_candidate_params.law_mask) == 0u) {
    return 4294967295u;
  }
  let offset = select(
    SCHROEDER_CONTACT_LAW_NEIGHBOR_SOURCE_OFFSET,
    SCHROEDER_CONTACT_LAW_NEIGHBOR_NEIGHBOR_OFFSET,
    endpoint != 0u
  );
  return u32(max(round(schroeder_contact_neighbor_candidate_rows[candidate_offset + offset]), 0.0));
}

fn ck_interface_source_particle_index(element_index: u32, fallback_surface_index: f32) -> u32 {
  if (
    interface_source_key_params.enabled != 0u
    && element_index < interface_source_key_params.row_count
    && interface_source_key_params.row_stride > 0u
  ) {
    let stride = max(interface_source_key_params.row_stride, INTERFACE_SOURCE_KEY_STRIDE);
    let source_key_offset = element_index * stride;
    let status = interface_source_key_rows[
      source_key_offset + INTERFACE_SOURCE_KEY_STATUS_OFFSET
    ];
    let row_element = u32(max(round(interface_source_key_rows[
      source_key_offset + INTERFACE_SOURCE_KEY_ELEMENT_OFFSET
    ]), 0.0));
    if (status > 0.5 && row_element == element_index) {
      return u32(max(round(interface_source_key_rows[
        source_key_offset + INTERFACE_SOURCE_KEY_SOURCE_OFFSET
      ]), 0.0));
    }
  }
  if (interface_source_key_params.surface_index_fallback_enabled != 0u) {
    return u32(max(round(fallback_surface_index), 0.0));
  }
  return 4294967295u;
}

fn ck_policy_matches_element(row0: vec4<f32>, row2: vec4<f32>, material_id: f32, phase_id: f32) -> bool {
  if (row2.y <= 0.0) {
    return false;
  }
  let material_match = abs(material_id - row0.x) < 0.5 || abs(material_id - row0.y) < 0.5;
  let phase_match = (row0.z <= 0.5 && row0.w <= 0.5)
    || abs(phase_id - row0.z) < 0.5
    || abs(phase_id - row0.w) < 0.5;
  return material_match && phase_match;
}

fn ck_normal_from_element(row2: vec4<f32>, row3: vec4<f32>) -> vec3<f32> {
  var normal = row2.xyz;
  if (dot(normal, normal) <= 1.0e-24) {
    normal = vec3<f32>(row2.w, row3.x, row3.y);
  }
  if (dot(normal, normal) <= 1.0e-24) {
    return vec3<f32>(0.0, 1.0, 0.0);
  }
  return normalize(normal);
}

fn ck_candidate_for_particle(
  particle_index: u32,
  centroid: vec3<f32>,
  normal: vec3<f32>,
  search_radius_m: f32,
  search_radius2: f32,
  element_material_id: f32,
  element_phase_id: f32,
  target_material_id: f32,
  target_phase_id: f32,
  law_queue_gate_required: bool
) -> CkParticleCandidate {
  var candidate = CkParticleCandidate(
    0u,
    0u,
    0.0,
    0.0,
    vec3<f32>(0.0),
    0.0
  );
  if (law_queue_gate_required && !ck_schroeder_law_queue_allows_particle(particle_index)) {
    return candidate;
  }
  let thermo0 = ck_thermo_row0(particle_index);
  let thermo2 = ck_thermo_row2(particle_index);
  if (thermo2.z <= 0.0) {
    return candidate;
  }
  let state0 = ck_state_row0(particle_index);
  let state1 = ck_state_row1(particle_index);
  if (state0.w <= 0.0) {
    return candidate;
  }
  let delta = state0.xyz - centroid;
  let signed_m = dot(delta, normal);
  let distance2 = dot(delta, delta);
  let lateral2 = max(distance2 - signed_m * signed_m, 0.0);
  if (lateral2 > search_radius2 || abs(signed_m) > search_radius_m) {
    return candidate;
  }
  let same_source_material = abs(thermo0.x - element_material_id) < 0.5 && ck_phase_matches(thermo0.y, element_phase_id);
  let same_target_material = abs(thermo0.x - target_material_id) < 0.5 && ck_phase_matches(thermo0.y, target_phase_id);
  candidate.source_match = select(0u, 1u, same_source_material);
  candidate.target_match = select(0u, 1u, same_target_material);
  candidate.signed_m = signed_m;
  candidate.lateral2 = lateral2;
  candidate.velocity = state1.xyz;
  candidate.mass_kg = state0.w;
  return candidate;
}

fn ck_particle_bin_ready() -> bool {
  return params.particle_bin_grid_enabled != 0u
    && params.particle_bin_cell_count > 0u
    && params.particle_bin_capacity > 0u
    && params.particle_bin_grid_nx > 0u
    && params.particle_bin_grid_ny > 0u
    && params.particle_bin_grid_nz > 0u
    && params.particle_bin_cell_size_m > 0.0;
}

fn ck_bin_cell_index(coords: vec3<u32>) -> u32 {
  return coords.x + coords.y * params.particle_bin_grid_nx + coords.z * params.particle_bin_grid_nx * params.particle_bin_grid_ny;
}

fn ck_bin_coord(value: f32, axis_count: u32) -> u32 {
  if (axis_count <= 1u) {
    return 0u;
  }
  let raw = floor(value / params.particle_bin_cell_size_m);
  return u32(clamp(raw, 0.0, f32(axis_count - 1u)));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let element_index = global_id.x;
  if (element_index >= params.element_count) {
    return;
  }
  contact_kinematics_rows[element_index * 2u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  contact_kinematics_rows[element_index * 2u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  if (params.derivation_enabled == 0u || params.particle_count == 0u || params.contact_policy_row_count == 0u) {
    return;
  }

  let element_row0 = interface_elements[element_index * 4u];
  let element_row1 = interface_elements[element_index * 4u + 1u];
  let element_row2 = interface_elements[element_index * 4u + 2u];
  let element_row3 = interface_elements[element_index * 4u + 3u];
  let element_material_id = element_row0.y;
  let element_phase_id = element_row0.z;
  let centroid = element_row1.xyz;
  let area_m2 = element_row1.w;
  let element_status = element_row3.w;
  if (element_status <= 0.0 || area_m2 <= 0.0) {
    return;
  }

  var selected = false;
  var target_material_id = 0.0;
  var target_phase_id = 0.0;
  var support_radius_m = params.max_search_radius_m;
  for (var policy_index = 0u; policy_index < params.contact_policy_row_count; policy_index = policy_index + 1u) {
    let policy_row0 = contact_policy_rows[policy_index * 4u];
    let policy_row1 = contact_policy_rows[policy_index * 4u + 1u];
    let policy_row2 = contact_policy_rows[policy_index * 4u + 2u];
    if (!selected && ck_policy_matches_element(policy_row0, policy_row2, element_material_id, element_phase_id)) {
      let match_a = abs(element_material_id - policy_row0.x) < 0.5;
      target_material_id = select(policy_row0.x, policy_row0.y, match_a);
      target_phase_id = select(policy_row0.z, policy_row0.w, match_a);
      support_radius_m = max(policy_row1.z, support_radius_m);
      selected = true;
    }
  }
  if (!selected) {
    return;
  }

  let normal = ck_normal_from_element(element_row2, element_row3);
  let search_radius_m = max(max(support_radius_m * 2.0, params.max_search_radius_m), 1.0e-6);
  let search_radius2 = search_radius_m * search_radius_m;
  var source_score = 1.0e30;
  var target_score = 1.0e30;
  var source_index = 4294967295u;
  var target_index = 4294967295u;
  var source_signed_m = 0.0;
  var target_signed_m = 0.0;
  var source_velocity = vec3<f32>(0.0);
  var target_velocity = vec3<f32>(0.0);
  var source_mass_kg = 0.0;
  var target_mass_kg = 0.0;

  let element_source_particle_index = ck_interface_source_particle_index(element_index, element_row0.x);
  let schroeder_span = ck_schroeder_candidate_span(element_source_particle_index);
  let schroeder_span_ready = schroeder_span.z != 0u;
  let schroeder_broad_candidate_fallback =
    schroeder_contact_source_span_params.broad_candidate_fallback_enabled != 0u;
  if (ck_schroeder_neighbor_candidates_enabled() && (schroeder_span_ready || schroeder_broad_candidate_fallback)) {
    let candidate_start = select(0u, schroeder_span.x, schroeder_span_ready);
    let candidate_count = select(
      schroeder_contact_neighbor_candidate_params.candidate_count,
      min(schroeder_span.y, schroeder_contact_neighbor_candidate_params.candidate_count - candidate_start),
      schroeder_span_ready
    );
    let candidate_end = min(
      candidate_start + candidate_count,
      schroeder_contact_neighbor_candidate_params.candidate_count
    );
    for (var candidate_index = candidate_start; candidate_index < candidate_end; candidate_index = candidate_index + 1u) {
      for (var endpoint = 0u; endpoint < 2u; endpoint = endpoint + 1u) {
        let candidate_particle_index = ck_schroeder_candidate_particle(candidate_index, endpoint);
        if (candidate_particle_index >= params.particle_count) {
          continue;
        }
        let candidate = ck_candidate_for_particle(
          candidate_particle_index,
          centroid,
          normal,
          search_radius_m,
          search_radius2,
          element_material_id,
          element_phase_id,
          target_material_id,
          target_phase_id,
          false
        );
        let signed2 = candidate.signed_m * candidate.signed_m;
        if (candidate.source_match != 0u) {
          let source_side_penalty = select(0.0, search_radius2, candidate.signed_m > support_radius_m * 0.25);
          let score = candidate.lateral2 + signed2 + source_side_penalty;
          if (score < source_score) {
            source_score = score;
            source_index = candidate_particle_index;
            source_signed_m = candidate.signed_m;
            source_velocity = candidate.velocity;
            source_mass_kg = candidate.mass_kg;
          }
        }
        if (candidate.target_match != 0u) {
          let target_side_penalty = select(0.0, search_radius2, candidate.signed_m < -support_radius_m * 0.25);
          let score = candidate.lateral2 + signed2 + target_side_penalty;
          if (score < target_score) {
            target_score = score;
            target_index = candidate_particle_index;
            target_signed_m = candidate.signed_m;
            target_velocity = candidate.velocity;
            target_mass_kg = candidate.mass_kg;
          }
        }
      }
    }
  } else if (ck_particle_bin_ready()) {
    let relative_centroid = centroid - vec3<f32>(
      params.particle_bin_origin_x_m,
      params.particle_bin_origin_y_m,
      params.particle_bin_origin_z_m
    );
    let center_coords = vec3<i32>(
      i32(ck_bin_coord(relative_centroid.x, params.particle_bin_grid_nx)),
      i32(ck_bin_coord(relative_centroid.y, params.particle_bin_grid_ny)),
      i32(ck_bin_coord(relative_centroid.z, params.particle_bin_grid_nz))
    );
    let radius_cells = min(
      i32(8),
      max(1, i32(ceil(search_radius_m / params.particle_bin_cell_size_m)))
    );
    for (var dz = -radius_cells; dz <= radius_cells; dz = dz + 1) {
      let cz = center_coords.z + dz;
      if (cz < 0 || cz >= i32(params.particle_bin_grid_nz)) {
        continue;
      }
      for (var dy = -radius_cells; dy <= radius_cells; dy = dy + 1) {
        let cy = center_coords.y + dy;
        if (cy < 0 || cy >= i32(params.particle_bin_grid_ny)) {
          continue;
        }
        for (var dx = -radius_cells; dx <= radius_cells; dx = dx + 1) {
          let cx = center_coords.x + dx;
          if (cx < 0 || cx >= i32(params.particle_bin_grid_nx)) {
            continue;
          }
          let cell_index = ck_bin_cell_index(vec3<u32>(u32(cx), u32(cy), u32(cz)));
          if (cell_index >= params.particle_bin_cell_count) {
            continue;
          }
          let count = min(particle_bin_counts[cell_index], params.particle_bin_capacity);
          for (var slot = 0u; slot < count; slot = slot + 1u) {
            let particle_index = particle_bin_indices[cell_index * params.particle_bin_capacity + slot];
            if (particle_index >= params.particle_count) {
              continue;
            }
            let candidate = ck_candidate_for_particle(
              particle_index,
              centroid,
              normal,
              search_radius_m,
              search_radius2,
              element_material_id,
              element_phase_id,
              target_material_id,
              target_phase_id,
              true
            );
            let signed2 = candidate.signed_m * candidate.signed_m;
            if (candidate.source_match != 0u) {
              let source_side_penalty = select(0.0, search_radius2, candidate.signed_m > support_radius_m * 0.25);
              let score = candidate.lateral2 + signed2 + source_side_penalty;
              if (score < source_score) {
                source_score = score;
                source_index = particle_index;
                source_signed_m = candidate.signed_m;
                source_velocity = candidate.velocity;
                source_mass_kg = candidate.mass_kg;
              }
            }
            if (candidate.target_match != 0u) {
              let target_side_penalty = select(0.0, search_radius2, candidate.signed_m < -support_radius_m * 0.25);
              let score = candidate.lateral2 + signed2 + target_side_penalty;
              if (score < target_score) {
                target_score = score;
                target_index = particle_index;
                target_signed_m = candidate.signed_m;
                target_velocity = candidate.velocity;
                target_mass_kg = candidate.mass_kg;
              }
            }
          }
        }
      }
    }
  } else {
    for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
      let candidate = ck_candidate_for_particle(
        particle_index,
        centroid,
        normal,
        search_radius_m,
        search_radius2,
        element_material_id,
        element_phase_id,
        target_material_id,
        target_phase_id,
        true
      );
      let signed2 = candidate.signed_m * candidate.signed_m;
      if (candidate.source_match != 0u) {
        let source_side_penalty = select(0.0, search_radius2, candidate.signed_m > support_radius_m * 0.25);
        let score = candidate.lateral2 + signed2 + source_side_penalty;
        if (score < source_score) {
          source_score = score;
          source_index = particle_index;
          source_signed_m = candidate.signed_m;
          source_velocity = candidate.velocity;
          source_mass_kg = candidate.mass_kg;
        }
      }
      if (candidate.target_match != 0u) {
        let target_side_penalty = select(0.0, search_radius2, candidate.signed_m < -support_radius_m * 0.25);
        let score = candidate.lateral2 + signed2 + target_side_penalty;
        if (score < target_score) {
          target_score = score;
          target_index = particle_index;
          target_signed_m = candidate.signed_m;
          target_velocity = candidate.velocity;
          target_mass_kg = candidate.mass_kg;
        }
      }
    }
  }

  if (source_index == 4294967295u || target_index == 4294967295u || source_index == target_index) {
    return;
  }
  let signed_span_m = target_signed_m - source_signed_m;
  let direction_sign = select(-1.0, 1.0, signed_span_m >= 0.0);
  let gap_m = max(abs(signed_span_m), params.gap_floor_m);
  let relative_normal_velocity_m_per_s = dot(target_velocity - source_velocity, normal * direction_sign);
  var representative_mass_kg = 0.0;
  if (source_mass_kg > 0.0 && target_mass_kg > 0.0) {
    representative_mass_kg = (source_mass_kg * target_mass_kg) / max(source_mass_kg + target_mass_kg, 1.0e-12);
  }
  let source_domain_id = particle_identity[source_index];
  let target_domain_id = particle_identity[target_index];
  let domain_pair_ready = source_domain_id > 0u && target_domain_id > 0u;
  contact_kinematics_rows[element_index * 2u] = vec4<f32>(
    gap_m,
    relative_normal_velocity_m_per_s,
    representative_mass_kg,
    1.0
  );
  contact_kinematics_rows[element_index * 2u + 1u] = vec4<f32>(
    f32(source_domain_id),
    f32(target_domain_id),
    select(0.0, 1.0, domain_pair_ready),
    0.0
  );
}
`;

// Shared by the live G2P update and compact GPU diagnostics. This is the raw
// (I + dt C) F trial, before any constitutive projection or volume bounds.
export const mlsMpmTrialDeformationWgsl = `
fn g2p_trial_deformation(
  f0: vec3<f32>, f1: vec3<f32>, f2: vec3<f32>,
  c0: vec3<f32>, c1: vec3<f32>, c2: vec3<f32>, dt: f32
) -> array<vec3<f32>, 3> {
  let g00 = 1.0 + dt * c0.x; let g01 = dt * c0.y; let g02 = dt * c0.z;
  let g10 = dt * c1.x; let g11 = 1.0 + dt * c1.y; let g12 = dt * c1.z;
  let g20 = dt * c2.x; let g21 = dt * c2.y; let g22 = 1.0 + dt * c2.z;
  return array<vec3<f32>, 3>(
    g00 * f0 + g01 * f1 + g02 * f2,
    g10 * f0 + g11 * f1 + g12 * f2,
    g20 * f0 + g21 * f1 + g22 * f2
  );
}
`;

export const mlsMpmG2pReconstructWgsl = `
${mlsMpmTrialDeformationWgsl}
struct G2pParams {
  particle_count: u32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  schroeder_active_node_filter_enabled: u32,
  schroeder_selected_level: i32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  dt: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  internal_pressure_scale: f32,
  liquid_wall_damping_alpha: f32,
  liquid_wall_damping_distance_m: f32,
  schroeder_active_node_stride_floats: u32,
  schroeder_level_filter_enabled: u32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: G2pParams;
@group(0) @binding(7) var<storage, read> schroeder_level_assignments: array<f32>;

fn g2p_quadratic_weights(fx: f32) -> vec3<f32> {
  let a = 1.5 - fx;
  let b = fx - 1.0;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}

fn g2p_weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  if (offset == 0) { return weights.x; }
  if (offset == 1) { return weights.y; }
  if (offset == 2) { return weights.z; }
  return 0.0;
}

fn g2p_det3(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32
) -> f32 {
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

fn g2p_cubic_root_positive(value: f32) -> f32 {
  return exp(log(max(value, 1.0e-12)) / 3.0);
}

const G2P_MIN_VOLUME_RATIO_J: f32 = 0.1;
const G2P_MAX_RADIUS_GROWTH_RATIO: f32 = 4.0;
const G2P_MAX_VOLUME_RATIO_J: f32 = 64.0;
// Gas particles expand until their density reaches the vacuum-expansion
// floor of 0.1% rest density (J_max = rho_rest/rho_floor = 1000) instead of
// the condensed-phase 64x volume cap. The fixed cap froze expanding gas at
// 64x rest volume, giving it a false liquid-like free surface (a discrete
// "gas top" a solid could rest in) while the pressure law kept pushing.
// With the gauge ideal-gas pressure (P proportional to rho ~ 1/J) the pair
// (pressure, volume) stays integrable as J grows: P at the floor is 1e-3 atm,
// so gas fills the domain and settles instead of pooling.
const G2P_MAX_VOLUME_RATIO_J_GAS: f32 = 1000.0;

fn g2p_max_volume_ratio_j(eos_model_id: f32) -> f32 {
  let is_gas = eos_model_id > 1.5 && eos_model_id < 2.5;
  return select(G2P_MAX_VOLUME_RATIO_J, G2P_MAX_VOLUME_RATIO_J_GAS, is_gas);
}

fn g2p_particle_wall_clearance(rest_volume_m3: f32) -> f32 {
  if (rest_volume_m3 <= 0.0) {
    return 0.0;
  }
  var clearance = 0.5 * g2p_cubic_root_positive(rest_volume_m3);
  // The wall boundary condition operates at grid resolution: a clearance
  // larger than half a cell builds a phantom forbidden shell inside the box.
  // Low-density phases made that shell meters thick (steam rest volume is
  // ~1.7 m^3/kg, so 0.5*v0^(1/3) pinned steam mid-air, "800 K water" to the
  // floor, and quench splash to a ceiling shelf at box_y - clearance).
  // Compressible parcels overlap walls physically; sub-cell wall response
  // belongs to the pressure law, not a rigid-ball radius.
  clearance = min(clearance, 0.5 * params.grid_spacing_m);
  let min_dim = min(params.box_x, min(params.box_y, params.box_z));
  if (min_dim > 0.0) {
    clearance = min(clearance, 0.49 * min_dim);
  }
  return clearance;
}

fn g2p_clamp(value: f32, lower: f32, upper: f32) -> f32 {
  return min(max(value, lower), upper);
}

fn g2p_condensed_target_j(raw_next_j: f32, previous_j: f32) -> f32 {
  let previous_bounded = g2p_clamp(previous_j, 0.95, 1.05);
  let lower = max(0.95, previous_bounded / 1.5);
  let upper = min(1.05, previous_bounded * 1.5);
  return g2p_clamp(raw_next_j, lower, upper);
}

fn g2p_grid_index(i: i32, j: i32, k: i32) -> u32 {
  return (u32(i + i32(params.shift)) * params.grid_ny + u32(j + i32(params.shift))) * params.grid_nz + u32(k + i32(params.shift));
}

fn g2p_in_range(i: i32, j: i32, k: i32) -> bool {
  let ii = i + i32(params.shift);
  let jj = j + i32(params.shift);
  let kk = k + i32(params.shift);
  return ii >= 0 && jj >= 0 && kk >= 0
    && ii < i32(params.grid_nx)
    && jj < i32(params.grid_ny)
    && kk < i32(params.grid_nz);
}

// Level-filtered G2P with copy-through: only particles assigned to the
// selected level reconstruct from this grid; other particles copy their
// input state through unchanged so a coarser/finer pass (or the caller)
// keeps authority over them. Assignment rows are particle-parallel; the
// compacted active-node list is NOT and must never gate particles here.
fn g2p_particle_enabled(particle_index: u32) -> bool {
  if (params.schroeder_active_node_filter_enabled == 0u) {
    return true;
  }
  let stride = max(params.schroeder_active_node_stride_floats, 1u);
  let assignment_offset = particle_index * stride;
  let level = i32(round(schroeder_level_assignments[assignment_offset]));
  return level == params.schroeder_selected_level;
}

fn g2p_copy_input_particle(state_base: u32, mechanics_base: u32) {
  out_sph_state[state_base] = sph_state[state_base];
  out_sph_state[state_base + 1u] = sph_state[state_base + 1u];
  out_mls_mechanics[mechanics_base] = mls_mechanics[mechanics_base];
  out_mls_mechanics[mechanics_base + 1u] = mls_mechanics[mechanics_base + 1u];
  out_mls_mechanics[mechanics_base + 2u] = mls_mechanics[mechanics_base + 2u];
  out_mls_mechanics[mechanics_base + 3u] = mls_mechanics[mechanics_base + 3u];
  out_mls_mechanics[mechanics_base + 4u] = mls_mechanics[mechanics_base + 4u];
  out_mls_mechanics[mechanics_base + 5u] = mls_mechanics[mechanics_base + 5u];
  out_mls_mechanics[mechanics_base + 6u] = mls_mechanics[mechanics_base + 6u];
  out_mls_mechanics[mechanics_base + 7u] = mls_mechanics[mechanics_base + 7u];
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let state_base = particle_index * 2u;
  let mechanics_base = particle_index * 8u;
  if (!g2p_particle_enabled(particle_index)) {
    g2p_copy_input_particle(state_base, mechanics_base);
    return;
  }
  let pos_mass = sph_state[state_base];
  let vel_u = sph_state[state_base + 1u];
  let _thermo_status = sph_thermo[particle_index * 3u + 2u].z;
  let row0 = mls_mechanics[mechanics_base];
  let row1 = mls_mechanics[mechanics_base + 1u];
  let row2 = mls_mechanics[mechanics_base + 2u];
  let row3 = mls_mechanics[mechanics_base + 3u];
  let row4 = mls_mechanics[mechanics_base + 4u];
  let row5 = mls_mechanics[mechanics_base + 5u];
  let row6 = mls_mechanics[mechanics_base + 6u];
  let row7 = mls_mechanics[mechanics_base + 7u];

  let p_grid = pos_mass.xyz * params.inv_grid_spacing_m;
  let base_x = i32(floor(p_grid.x - 0.5));
  let base_y = i32(floor(p_grid.y - 0.5));
  let base_z = i32(floor(p_grid.z - 0.5));
  let wx = g2p_quadratic_weights(p_grid.x - f32(base_x));
  let wy = g2p_quadratic_weights(p_grid.y - f32(base_y));
  let wz = g2p_quadratic_weights(p_grid.z - f32(base_z));

  var velocity = vec3<f32>(0.0, 0.0, 0.0);
  var c00 = 0.0; var c01 = 0.0; var c02 = 0.0;
  var c10 = 0.0; var c11 = 0.0; var c12 = 0.0;
  var c20 = 0.0; var c21 = 0.0; var c22 = 0.0;
  var sampled_weight = 0.0;
  var sampled_grid_mass = 0.0;

  for (var a = 0i; a < 3i; a = a + 1i) {
    for (var b = 0i; b < 3i; b = b + 1i) {
      for (var c = 0i; c < 3i; c = c + 1i) {
        let node_i = base_x + a;
        let node_j = base_y + b;
        let node_k = base_z + c;
        if (!g2p_in_range(node_i, node_j, node_k)) {
          continue;
        }
        let weight = g2p_weight_at(wx, a) * g2p_weight_at(wy, b) * g2p_weight_at(wz, c);
        // Stencil support floor 2^-60, shared with the mechanics field view.
        if (!(weight >= bitcast<f32>(0x21800000u))) {
          continue;
        }
        let idx = g2p_grid_index(node_i, node_j, node_k);
        let grid_row = updated_grid_nodes[idx * 2u];
        let grid_meta = updated_grid_nodes[idx * 2u + 1u];
        if (!(grid_row.x > 0.0) && !(grid_meta.w > 0.0)) {
          continue;
        }
        sampled_weight = sampled_weight + weight;
        sampled_grid_mass = sampled_grid_mass + weight * grid_row.x;
        let grid_velocity = grid_row.yzw;
        velocity = velocity + weight * grid_velocity;
        let dpos = (vec3<f32>(f32(node_i), f32(node_j), f32(node_k)) - p_grid) * params.grid_spacing_m;
        let s = 4.0 * params.inv_grid_spacing_m * params.inv_grid_spacing_m * weight;
        c00 = c00 + s * grid_velocity.x * dpos.x;
        c01 = c01 + s * grid_velocity.x * dpos.y;
        c02 = c02 + s * grid_velocity.x * dpos.z;
        c10 = c10 + s * grid_velocity.y * dpos.x;
        c11 = c11 + s * grid_velocity.y * dpos.y;
        c12 = c12 + s * grid_velocity.y * dpos.z;
        c20 = c20 + s * grid_velocity.z * dpos.x;
        c21 = c21 + s * grid_velocity.z * dpos.y;
        c22 = c22 + s * grid_velocity.z * dpos.z;
      }
    }
  }
  if (sampled_weight > 1.0e-8 && sampled_weight < 0.999999) {
    let normalization = 1.0 / sampled_weight;
    velocity = velocity * normalization;
    c00 = c00 * normalization; c01 = c01 * normalization; c02 = c02 * normalization;
    c10 = c10 * normalization; c11 = c11 * normalization; c12 = c12 * normalization;
    c20 = c20 * normalization; c21 = c21 * normalization; c22 = c22 * normalization;
  }

  var position = pos_mass.xyz + params.dt * velocity;
  let wall_clearance = g2p_particle_wall_clearance(row4.w);
  let upper_x = max(wall_clearance, params.box_x - wall_clearance);
  let upper_y = max(wall_clearance, params.box_y - wall_clearance);
  let upper_z = max(wall_clearance, params.box_z - wall_clearance);
  if (position.x < wall_clearance) { position.x = wall_clearance; if (velocity.x < 0.0) { velocity.x = 0.0; } }
  if (position.x > upper_x) { position.x = upper_x; if (velocity.x > 0.0) { velocity.x = 0.0; } }
  if (position.y < wall_clearance) { position.y = wall_clearance; if (velocity.y < 0.0) { velocity.y = 0.0; } }
  if (position.y > upper_y) { position.y = upper_y; if (velocity.y > 0.0) { velocity.y = 0.0; } }
  if (position.z < wall_clearance) { position.z = wall_clearance; if (velocity.z < 0.0) { velocity.z = 0.0; } }
  if (position.z > upper_z) { position.z = upper_z; if (velocity.z > 0.0) { velocity.z = 0.0; } }

  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
  let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
  let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
  let solid = row5.x > 0.5;
  let condensed = solid || (row6.z > 0.5 && row6.z < 1.5);
  if (!solid && condensed && params.liquid_wall_damping_alpha > 0.0 && params.liquid_wall_damping_distance_m > 0.0) {
    let floor_distance = max(position.y - wall_clearance, 0.0);
    if (floor_distance < params.liquid_wall_damping_distance_m) {
      let q = 1.0 - floor_distance / params.liquid_wall_damping_distance_m;
      let keep = g2p_clamp(1.0 - params.liquid_wall_damping_alpha * q * q, 0.0, 1.0);
      velocity = velocity * keep;
    }
  }
  let deformation_disabled = !solid && (row6.z < 0.5 || params.internal_pressure_scale == 0.0);
  if (deformation_disabled) {
    c00 = 0.0; c01 = 0.0; c02 = 0.0;
    c10 = 0.0; c11 = 0.0; c12 = 0.0;
    c20 = 0.0; c21 = 0.0; c22 = 0.0;
  }
  let trial = g2p_trial_deformation(
    vec3<f32>(f00, f01, f02), vec3<f32>(f10, f11, f12), vec3<f32>(f20, f21, f22),
    vec3<f32>(c00, c01, c02), vec3<f32>(c10, c11, c12), vec3<f32>(c20, c21, c22), params.dt
  );
  var nf00 = trial[0].x; var nf01 = trial[0].y; var nf02 = trial[0].z;
  var nf10 = trial[1].x; var nf11 = trial[1].y; var nf12 = trial[1].z;
  var nf20 = trial[2].x; var nf21 = trial[2].y; var nf22 = trial[2].z;
  var next_j = g2p_det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);
  if (deformation_disabled) {
    nf00 = f00; nf01 = f01; nf02 = f02;
    nf10 = f10; nf11 = f11; nf12 = f12;
    nf20 = f20; nf21 = f21; nf22 = f22;
    next_j = row4.z;
  } else if (condensed) {
    var target_j = g2p_condensed_target_j(next_j, row4.z);
    if (!solid) {
      // Gentle Eulerian grid-density reconciliation in well-supported liquid interior:
      // prevents multiplicative J drift from leaving splashed parcels permanently stuck
      // as pressureless dust (J > 1 -> P_gauge = 0) while preserving exact cavitation cutoff!
      let cell_vol = params.grid_spacing_m * params.grid_spacing_m * params.grid_spacing_m;
      let rho_grid = sampled_grid_mass / max(cell_vol, 1.0e-12);
      let rho0 = pos_mass.w / max(row4.y, 1.0e-12);
      if (rho_grid >= 0.85 * rho0 && rho0 > 1.0e-6) {
        let j_grid = g2p_clamp(rho0 / max(rho_grid, 1.0e-6), 0.95, 1.05);
        target_j = mix(target_j, j_grid, 0.06);
      }
      let s = g2p_cubic_root_positive(target_j);
      nf00 = s; nf01 = 0.0; nf02 = 0.0;
      nf10 = 0.0; nf11 = s; nf12 = 0.0;
      nf20 = 0.0; nf21 = 0.0; nf22 = s;
    } else if (next_j > 1.0e-12) {
      let scale = g2p_cubic_root_positive(target_j / next_j);
      nf00 = nf00 * scale; nf01 = nf01 * scale; nf02 = nf02 * scale;
      nf10 = nf10 * scale; nf11 = nf11 * scale; nf12 = nf12 * scale;
      nf20 = nf20 * scale; nf21 = nf21 * scale; nf22 = nf22 * scale;
    } else {
      let s = g2p_cubic_root_positive(target_j);
      nf00 = s; nf01 = 0.0; nf02 = 0.0;
      nf10 = 0.0; nf11 = s; nf12 = 0.0;
      nf20 = 0.0; nf21 = 0.0; nf22 = s;
    }
    next_j = target_j;
  } else if (row5.x < 0.5) {
    next_j = max(next_j, 0.05);
    let s = g2p_cubic_root_positive(next_j);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
  }
  next_j = g2p_det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);
  if (next_j < G2P_MIN_VOLUME_RATIO_J) {
    let s = g2p_cubic_root_positive(G2P_MIN_VOLUME_RATIO_J);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
    next_j = G2P_MIN_VOLUME_RATIO_J;
  } else if (next_j > g2p_max_volume_ratio_j(row6.z)) {
    let max_volume_ratio_j = g2p_max_volume_ratio_j(row6.z);
    let scale = g2p_cubic_root_positive(max_volume_ratio_j / max(next_j, 1.0e-12));
    nf00 = nf00 * scale; nf01 = nf01 * scale; nf02 = nf02 * scale;
    nf10 = nf10 * scale; nf11 = nf11 * scale; nf12 = nf12 * scale;
    nf20 = nf20 * scale; nf21 = nf21 * scale; nf22 = nf22 * scale;
    next_j = max_volume_ratio_j;
  }

  out_sph_state[state_base] = vec4<f32>(position.x, position.y, position.z, pos_mass.w);
  out_sph_state[state_base + 1u] = vec4<f32>(velocity.x, velocity.y, velocity.z, vel_u.w);
  out_mls_mechanics[mechanics_base] = vec4<f32>(nf00, nf01, nf02, nf10);
  out_mls_mechanics[mechanics_base + 1u] = vec4<f32>(nf11, nf12, nf20, nf21);
  out_mls_mechanics[mechanics_base + 2u] = vec4<f32>(nf22, c00, c01, c02);
  out_mls_mechanics[mechanics_base + 3u] = vec4<f32>(c10, c11, c12, c20);
  out_mls_mechanics[mechanics_base + 4u] = vec4<f32>(c21, c22, next_j, row4.w);
  out_mls_mechanics[mechanics_base + 5u] = row5;
  out_mls_mechanics[mechanics_base + 6u] = row6;
  out_mls_mechanics[mechanics_base + 7u] = row7;
}
`;

// Excluded-volume particle separation. MLS-MPM volume tracking (J from the
// grid velocity gradient) is blind to sub-grid-cell interpenetration: two
// particles inside one cell sample the same velocity field, so their relative
// divergence is zero and J never registers the overlap. The pair rest
// distance is derived from each particle's own rest volume (d = cbrt(V0)),
// making the law material-agnostic. Solid-solid pairs are skipped because the
// elastic constitutive law already models interatomic repulsion for a
// connected lattice; gas is skipped because gas compressibility is owned by
// the gas EOS. The projection is symmetric and inverse-mass weighted, so it
// conserves pair momentum and center of mass exactly.
export const SEPARATION_BIN_CAPACITY = 64;

export const mlsMpmParticleSeparationBinFillWgsl = `
struct SeparationParams {
  particle_count: u32,
  relaxation: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  normal_velocity_damping: f32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_capacity: u32,
  bin_cell_size_m: f32,
  grid_spacing_m: f32,
};

@group(0) @binding(0) var<storage, read> in_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_mechanics: array<vec4<f32>>;
// Combined bins: [0, cell_count) = per-cell counts, then cell_count +
// cell * capacity + slot = entry indices. One buffer keeps consumers within
// the default 10-storage-buffer per-stage limit.
@group(0) @binding(2) var<storage, read_write> bins: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: SeparationParams;

fn bin_fill_cell_index(position: vec3<f32>) -> u32 {
  let inv = 1.0 / max(params.bin_cell_size_m, 1.0e-9);
  let cx = clamp(u32(max(position.x, 0.0) * inv), 0u, params.bin_nx - 1u);
  let cy = clamp(u32(max(position.y, 0.0) * inv), 0u, params.bin_ny - 1u);
  let cz = clamp(u32(max(position.z, 0.0) * inv), 0u, params.bin_nz - 1u);
  return (cz * params.bin_ny + cy) * params.bin_nx + cx;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  if (params.relaxation <= 0.0 && params.normal_velocity_damping <= 0.0) {
    return;
  }
  let pos_mass = in_state[particle_index * 2u];
  if (pos_mass.w <= 0.0) {
    return;
  }
  // Every massive particle is binned (gas included): the bins are shared
  // with thermal pair conduction, and the separation consumer already
  // filters phases per pair.
  let cell = bin_fill_cell_index(pos_mass.xyz);
  let cell_count = params.bin_nx * params.bin_ny * params.bin_nz;
  let slot = atomicAdd(&bins[cell], 1u);
  if (slot < params.bin_capacity) {
    atomicStore(&bins[cell_count + cell * params.bin_capacity + slot], particle_index);
  }
}
`;

export const mlsMpmParticleSeparationComputeWgsl = `
struct SeparationParams {
  particle_count: u32,
  relaxation: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  normal_velocity_damping: f32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_capacity: u32,
  bin_cell_size_m: f32,
  grid_spacing_m: f32,
};

@group(0) @binding(0) var<storage, read> in_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_mechanics: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> corrections: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SeparationParams;
// Combined bins layout: counts prefix then entry slots (see bin-fill).
@group(0) @binding(4) var<storage, read> bins: array<u32>;

fn separation_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

// 0 = excluded (gas/plasma/unknown), 1 = liquid, 2 = solid.
fn separation_phase_class(index: u32) -> u32 {
  let row5 = in_mechanics[index * 8u + 5u];
  let row6 = in_mechanics[index * 8u + 6u];
  if (row5.x > 0.5) {
    return 2u;
  }
  if (row6.z > 0.5 && row6.z < 1.5) {
    return 1u;
  }
  return 0u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  corrections[particle_index * 2u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  corrections[particle_index * 2u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  if (params.relaxation <= 0.0 && params.normal_velocity_damping <= 0.0) {
    return;
  }
  let phase_class = separation_phase_class(particle_index);
  if (phase_class == 0u) {
    return;
  }
  let pos_mass = in_state[particle_index * 2u];
  if (pos_mass.w <= 0.0) {
    return;
  }
  let rest_volume = max(in_mechanics[particle_index * 8u + 4u].w, 0.0);
  if (rest_volume <= 0.0) {
    return;
  }
  let velocity = in_state[particle_index * 2u + 1u].xyz;
  let d_self = separation_cbrt(rest_volume);
  let w_self = 1.0 / max(pos_mass.w, 1.0e-30);
  var dx = vec3<f32>(0.0, 0.0, 0.0);
  var dv = vec3<f32>(0.0, 0.0, 0.0);
  // The bin cell size is >= every pair rest distance, so scanning the
  // 3x3x3 cell neighborhood covers all interacting pairs.
  let inv_cell = 1.0 / max(params.bin_cell_size_m, 1.0e-9);
  let cx = i32(clamp(u32(max(pos_mass.x, 0.0) * inv_cell), 0u, params.bin_nx - 1u));
  let cy = i32(clamp(u32(max(pos_mass.y, 0.0) * inv_cell), 0u, params.bin_ny - 1u));
  let cz = i32(clamp(u32(max(pos_mass.z, 0.0) * inv_cell), 0u, params.bin_nz - 1u));
  for (var oz = -1; oz <= 1; oz = oz + 1) {
    let nz = cz + oz;
    if (nz < 0 || nz >= i32(params.bin_nz)) {
      continue;
    }
    for (var oy = -1; oy <= 1; oy = oy + 1) {
      let ny = cy + oy;
      if (ny < 0 || ny >= i32(params.bin_ny)) {
        continue;
      }
      for (var ox = -1; ox <= 1; ox = ox + 1) {
        let nx = cx + ox;
        if (nx < 0 || nx >= i32(params.bin_nx)) {
          continue;
        }
        let cell = (u32(nz) * params.bin_ny + u32(ny)) * params.bin_nx + u32(nx);
        let total_cells = params.bin_nx * params.bin_ny * params.bin_nz;
        let cell_count = min(bins[cell], params.bin_capacity);
        for (var entry = 0u; entry < cell_count; entry = entry + 1u) {
          let other = bins[total_cells + cell * params.bin_capacity + entry];
          if (other == particle_index) {
            continue;
          }
          let other_pos_mass = in_state[other * 2u];
          if (other_pos_mass.w <= 0.0) {
            continue;
          }
          let other_class = separation_phase_class(other);
          if (other_class == 0u) {
            continue;
          }
          if (phase_class == 2u && other_class == 2u) {
            continue;
          }
          let other_rest_volume = max(in_mechanics[other * 8u + 4u].w, 0.0);
          if (other_rest_volume <= 0.0) {
            continue;
          }
          let pair_rest_distance = 0.5 * (d_self + separation_cbrt(other_rest_volume));
          let delta = pos_mass.xyz - other_pos_mass.xyz;
          var dist = length(delta);
          if (dist >= pair_rest_distance) {
            continue;
          }
          var normal = vec3<f32>(0.0, 1.0, 0.0);
          if (dist > 1.0e-9) {
            normal = delta / dist;
          } else {
            // Deterministic antisymmetric fallback for coincident particles:
            // hash the LOWER pair index into a unit direction so distinct
            // coincident pairs scatter isotropically instead of every twin
            // pair stacking along +/-y (reaction products spawn co-located at
            // the reacting pair's position, so y-only pushes built columns).
            // Both members hash the same index, so the pushes stay exactly
            // antisymmetric and conserve pair momentum.
            let low_index = min(particle_index, other);
            var h = low_index * 2654435761u + 0x9e3779b9u;
            h = (h ^ (h >> 16u)) * 2246822519u;
            h = h ^ (h >> 13u);
            let ux = f32(h & 1023u) / 511.5 - 1.0;
            let uy = f32((h >> 10u) & 1023u) / 511.5 - 1.0;
            let uz = f32((h >> 20u) & 1023u) / 511.5 - 1.0;
            let raw = vec3<f32>(ux, uy, uz);
            let raw_len = length(raw);
            let hashed = select(vec3<f32>(0.0, 1.0, 0.0), raw / max(raw_len, 1.0e-6), raw_len > 1.0e-4);
            normal = hashed * select(-1.0, 1.0, particle_index > other);
            dist = 0.0;
          }
          let w_other = 1.0 / max(other_pos_mass.w, 1.0e-30);
          let share = w_self / (w_self + w_other);
          dx = dx + params.relaxation * share * (pair_rest_distance - dist) * normal;
          let approach = dot(velocity - in_state[other * 2u + 1u].xyz, normal);
          if (approach < 0.0) {
            dv = dv - params.normal_velocity_damping * share * approach * normal;
          }
        }
      }
    }
  }
  // Bound the aggregate correction so deeply overlapped states relax over
  // several substeps instead of teleporting.
  let max_step = 0.5 * d_self;
  let dx_len = length(dx);
  if (dx_len > max_step) {
    dx = dx * (max_step / dx_len);
  }
  corrections[particle_index * 2u] = vec4<f32>(dx, 0.0);
  corrections[particle_index * 2u + 1u] = vec4<f32>(dv, 0.0);
}
`;

export const mlsMpmParticleSeparationApplyWgsl = `
struct SeparationParams {
  particle_count: u32,
  relaxation: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  normal_velocity_damping: f32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_capacity: u32,
  bin_cell_size_m: f32,
  grid_spacing_m: f32,
};

@group(0) @binding(0) var<storage, read> corrections: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_mechanics: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> out_state: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SeparationParams;

fn separation_apply_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  if (params.relaxation <= 0.0 && params.normal_velocity_damping <= 0.0) {
    return;
  }
  let dx = corrections[particle_index * 2u].xyz;
  let dv = corrections[particle_index * 2u + 1u].xyz;
  if (dot(dx, dx) == 0.0 && dot(dv, dv) == 0.0) {
    return;
  }
  let pos_mass = out_state[particle_index * 2u];
  let vel_u = out_state[particle_index * 2u + 1u];
  var position = pos_mass.xyz + dx;
  var velocity = vel_u.xyz + dv;
  // Same finite-volume wall clearance contract as G2P, including the
  // half-cell cap (see g2p_particle_wall_clearance for the rationale).
  let rest_volume = max(in_mechanics[particle_index * 8u + 4u].w, 0.0);
  var wall_clearance = 0.0;
  if (rest_volume > 0.0) {
    wall_clearance = 0.5 * separation_apply_cbrt(rest_volume);
    if (params.grid_spacing_m > 0.0) {
      wall_clearance = min(wall_clearance, 0.5 * params.grid_spacing_m);
    }
    let min_dim = min(params.box_x, min(params.box_y, params.box_z));
    if (min_dim > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dim);
    }
  }
  let upper_x = max(wall_clearance, params.box_x - wall_clearance);
  let upper_y = max(wall_clearance, params.box_y - wall_clearance);
  let upper_z = max(wall_clearance, params.box_z - wall_clearance);
  if (position.x < wall_clearance) { position.x = wall_clearance; if (velocity.x < 0.0) { velocity.x = 0.0; } }
  if (position.x > upper_x) { position.x = upper_x; if (velocity.x > 0.0) { velocity.x = 0.0; } }
  if (position.y < wall_clearance) { position.y = wall_clearance; if (velocity.y < 0.0) { velocity.y = 0.0; } }
  if (position.y > upper_y) { position.y = upper_y; if (velocity.y > 0.0) { velocity.y = 0.0; } }
  if (position.z < wall_clearance) { position.z = wall_clearance; if (velocity.z < 0.0) { velocity.z = 0.0; } }
  if (position.z > upper_z) { position.z = upper_z; if (velocity.z > 0.0) { velocity.z = 0.0; } }
  out_state[particle_index * 2u] = vec4<f32>(position, pos_mass.w);
  out_state[particle_index * 2u + 1u] = vec4<f32>(velocity, vel_u.w);
}
`;

export const mlsMpmMechanicsRefreshWgsl = `
${sphGasConstitutiveWgsl}
struct MechanicsRefreshParams {
  particle_count: u32,
  phase_record_count: u32,
  material_bank_warm_input_row_count: u32,
  gas_constitutive_offset: u32,
};

struct PhaseMechanics {
  rest_density: f32,
  bulk: f32,
  shear: f32,
  lambda: f32,
  sound_speed: f32,
  eos_model: f32,
  solid: f32,
  status: f32,
  dynamic_viscosity: f32,
  surface_tension: f32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> material_phase_records: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_mechanics: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: MechanicsRefreshParams;
@group(0) @binding(6) var<storage, read> material_bank_warm_input_rows: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> authority_validation: array<atomic<u32>>;

fn material_bank_warm_input_anchor() -> f32 {
  if (params.material_bank_warm_input_row_count == 0u) {
    return 0.0;
  }
  let value = material_bank_warm_input_rows[0u].x;
  if (value != value || abs(value) > 3.402823e38) {
    return 0.0;
  }
  return value * 0.0;
}

fn mechanics_refresh_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn mechanics_refresh_finite_vec4(value: vec4<f32>) -> bool {
  return all(value == value)
    && all(abs(value) <= vec4<f32>(3.402823e38));
}

fn mechanics_refresh_fail() {
  atomicOr(&authority_validation[0u], 1u);
}

fn mechanics_refresh_determinant(
  row0: vec4<f32>,
  row1: vec4<f32>,
  row2: vec4<f32>
) -> f32 {
  return row0.x * (row1.x * row2.x - row1.y * row1.w)
    - row0.y * (row0.w * row2.x - row1.y * row1.z)
    + row0.z * (row0.w * row1.w - row1.x * row1.z);
}

fn mechanics_refresh_determinant_matches(
  row0: vec4<f32>,
  row1: vec4<f32>,
  row2: vec4<f32>,
  volume_ratio_j: f32
) -> bool {
  let determinant = mechanics_refresh_determinant(row0, row1, row2);
  return mechanics_refresh_finite(determinant)
    && abs(determinant - volume_ratio_j)
      <= max(1.0e-5, abs(volume_ratio_j) * 1.0e-2);
}

fn phase_record_row0(record_index: u32) -> vec4<f32> {
  return material_phase_records[record_index * 3u];
}

fn phase_record_row1(record_index: u32) -> vec4<f32> {
  return material_phase_records[record_index * 3u + 1u];
}

fn phase_record_row2(record_index: u32) -> vec4<f32> {
  return material_phase_records[record_index * 3u + 2u];
}

fn find_phase_mechanics(material_id: f32, phase_id: f32, temperature_k: f32) -> PhaseMechanics {
  for (var record_index = 0u; record_index < params.phase_record_count; record_index = record_index + 1u) {
    let row0 = phase_record_row0(record_index);
    if (row0.x == material_id && row0.y == phase_id) {
      let row1 = phase_record_row1(record_index);
      let row2 = phase_record_row2(record_index);
      var c = row1.z;
      if (row1.w == 2.0 && params.gas_constitutive_offset > 0u) {
        c = gas_constitutive_sound_speed(material_phase_records[params.gas_constitutive_offset + record_index], temperature_k);
      }
      return PhaseMechanics(row0.z, row0.w, row1.x, row1.y, c, row1.w, row2.x, row2.y, row2.z, row2.w);
    }
  }
  return PhaseMechanics(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 255.0, 0.0, 0.0);
}

fn mechanics_refresh_should_reset(row4: vec4<f32>, row5: vec4<f32>, row6: vec4<f32>, phase_mechanics: PhaseMechanics, rest_volume: f32) -> bool {
  let previous_rest_volume = row4.w;
  if (!(rest_volume > 0.0)) {
    return false;
  }
  let previous_reference_valid = previous_rest_volume > 0.0
    && row4.z > 0.0
    && row5.y == 1.0
    && row6.w == 1.0;
  if (!previous_reference_valid) {
    return true;
  }
  let mechanics_model_changed = abs(row5.x - phase_mechanics.solid) > 0.5 || abs(row6.z - phase_mechanics.eos_model) > 0.5;
  if (!mechanics_model_changed) {
    return false;
  }
  let rest_ratio = max(previous_rest_volume / rest_volume, rest_volume / previous_rest_volume);
  return rest_ratio >= 2.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let mechanics_base = particle_index * 8u;
  for (var row = 0u; row < 8u; row = row + 1u) {
    out_mechanics[mechanics_base + row] = source_mechanics[mechanics_base + row];
  }

  let thermo0 = sph_thermo[particle_index * 3u];
  let state0 = sph_state[particle_index * 2u];
  if (state0.w == 0.0) {
    return;
  }
  if (
    !mechanics_refresh_finite_vec4(state0)
    || !mechanics_refresh_finite_vec4(thermo0)
    || !(state0.w > 0.0)
    || !(thermo0.w > 0.0)
  ) {
    mechanics_refresh_fail();
    return;
  }
  let phase_mechanics = find_phase_mechanics(thermo0.x, thermo0.y, thermo0.z);
  let phase_mechanics_finite =
    mechanics_refresh_finite(phase_mechanics.rest_density)
    && mechanics_refresh_finite(phase_mechanics.bulk)
    && mechanics_refresh_finite(phase_mechanics.shear)
    && mechanics_refresh_finite(phase_mechanics.lambda)
    && mechanics_refresh_finite(phase_mechanics.sound_speed)
    && mechanics_refresh_finite(phase_mechanics.eos_model)
    && mechanics_refresh_finite(phase_mechanics.solid)
    && mechanics_refresh_finite(phase_mechanics.status)
    && mechanics_refresh_finite(phase_mechanics.dynamic_viscosity)
    && mechanics_refresh_finite(phase_mechanics.surface_tension);
  if (
    phase_mechanics.status != 1.0
    || phase_mechanics.sound_speed < 0.0
    || !phase_mechanics_finite
    || !(phase_mechanics.rest_density > 0.0)
  ) {
    mechanics_refresh_fail();
    return;
  }

  let rest_density = thermo0.w;
  var rest_volume = state0.w / rest_density;
  rest_volume = rest_volume + material_bank_warm_input_anchor();
  if (!(rest_volume > 0.0) || !mechanics_refresh_finite(rest_volume)) {
    mechanics_refresh_fail();
    return;
  }

  var row0 = out_mechanics[mechanics_base];
  var row1 = out_mechanics[mechanics_base + 1u];
  var row2 = out_mechanics[mechanics_base + 2u];
  var row3 = out_mechanics[mechanics_base + 3u];
  var row4 = out_mechanics[mechanics_base + 4u];
  let row5 = out_mechanics[mechanics_base + 5u];
  let row6 = out_mechanics[mechanics_base + 6u];
  let row7 = out_mechanics[mechanics_base + 7u];
  let previous_current_volume = row4.z * row4.w;
  let previous_volume_authority_valid = row4.z > 0.0
    && row4.w > 0.0
    && previous_current_volume > 0.0
    && previous_current_volume == previous_current_volume
    && abs(previous_current_volume) <= 3.402823e38
    && row5.y == 1.0
    && row6.w == 1.0
    && mechanics_refresh_finite_vec4(row0)
    && mechanics_refresh_finite_vec4(row1)
    && mechanics_refresh_finite_vec4(row2)
    && mechanics_refresh_finite_vec4(row3)
    && mechanics_refresh_finite_vec4(row4)
    && mechanics_refresh_finite_vec4(row5)
    && mechanics_refresh_finite_vec4(row6)
    && mechanics_refresh_finite_vec4(row7)
    && mechanics_refresh_determinant_matches(row0, row1, row2, row4.z);
  if (!previous_volume_authority_valid) {
    mechanics_refresh_fail();
    return;
  }
  let current_volume = previous_current_volume;
  let next_volume_ratio_j = current_volume / rest_volume;
  if (
    !(next_volume_ratio_j > 0.0)
    || !mechanics_refresh_finite(next_volume_ratio_j)
  ) {
    mechanics_refresh_fail();
    return;
  }
  var next_row4_xy = row4.xy;
  if (mechanics_refresh_should_reset(row4, row5, row6, phase_mechanics, rest_volume)) {
    let isotropic_scale = pow(next_volume_ratio_j, 1.0 / 3.0);
    row0 = vec4<f32>(isotropic_scale, 0.0, 0.0, 0.0);
    row1 = vec4<f32>(isotropic_scale, 0.0, 0.0, 0.0);
    row2 = vec4<f32>(isotropic_scale, 0.0, 0.0, 0.0);
    row3 = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    next_row4_xy = vec2<f32>(0.0);
  } else {
    let deformation_scale = pow(
      next_volume_ratio_j / row4.z,
      1.0 / 3.0
    );
    if (!mechanics_refresh_finite(deformation_scale) || !(deformation_scale > 0.0)) {
      mechanics_refresh_fail();
      return;
    }
    row0 = row0 * deformation_scale;
    row1 = row1 * deformation_scale;
    row2 = vec4<f32>(
      row2.x * deformation_scale,
      row2.yzw
    );
  }
  if (
    !mechanics_refresh_finite_vec4(row0)
    || !mechanics_refresh_finite_vec4(row1)
    || !mechanics_refresh_finite_vec4(row2)
    || !mechanics_refresh_finite_vec4(row3)
    || !mechanics_refresh_determinant_matches(
      row0,
      row1,
      row2,
      next_volume_ratio_j
    )
  ) {
    mechanics_refresh_fail();
    return;
  }
  out_mechanics[mechanics_base] = row0;
  out_mechanics[mechanics_base + 1u] = row1;
  out_mechanics[mechanics_base + 2u] = row2;
  out_mechanics[mechanics_base + 3u] = row3;
  out_mechanics[mechanics_base + 4u] = vec4<f32>(
    next_row4_xy,
    next_volume_ratio_j,
    rest_volume
  );
  out_mechanics[mechanics_base + 5u] = vec4<f32>(
    phase_mechanics.solid,
    phase_mechanics.status,
    phase_mechanics.bulk,
    phase_mechanics.shear
  );
  out_mechanics[mechanics_base + 6u] = vec4<f32>(
    phase_mechanics.lambda,
    phase_mechanics.sound_speed,
    phase_mechanics.eos_model,
    phase_mechanics.status
  );
  out_mechanics[mechanics_base + 7u] = vec4<f32>(
    row7.x,
    phase_mechanics.dynamic_viscosity,
    phase_mechanics.surface_tension,
    row7.w
  );
}

@compute @workgroup_size(64)
fn commit_or_restore(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (
    particle_index >= params.particle_count
    || atomicLoad(&authority_validation[0u]) == 0u
  ) {
    return;
  }
  let mechanics_base = particle_index * 8u;
  for (var row = 0u; row < 8u; row = row + 1u) {
    out_mechanics[mechanics_base + row] =
      source_mechanics[mechanics_base + row];
  }
}
`;

export const mlsMpmResidentSummaryPartialsWgsl = `
struct ResidentSummaryParams {
  particle_count: u32,
  grid_node_count: u32,
  partial_count: u32,
  base_start_index: u32,
  base_end_index: u32,
  drop_start_index: u32,
  drop_end_index: u32,
  h2o_material_id: u32,
  phase_lineage_capacity: u32,
  phase_lane_count: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> source_sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> next_sph_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> partial_summaries: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: ResidentSummaryParams;
@group(0) @binding(7) var<storage, read> next_sph_thermo: array<vec4<f32>>;

var<workgroup> wg_active_grid_nodes: array<f32, 32>;
var<workgroup> wg_source_mass: array<f32, 32>;
var<workgroup> wg_next_mass: array<f32, 32>;
var<workgroup> wg_source_momentum_x: array<f32, 32>;
var<workgroup> wg_source_momentum_y: array<f32, 32>;
var<workgroup> wg_source_momentum_z: array<f32, 32>;
var<workgroup> wg_next_momentum_x: array<f32, 32>;
var<workgroup> wg_next_momentum_y: array<f32, 32>;
var<workgroup> wg_next_momentum_z: array<f32, 32>;
var<workgroup> wg_max_speed: array<f32, 32>;
var<workgroup> wg_max_displacement: array<f32, 32>;
var<workgroup> wg_min_volume_ratio_j: array<f32, 32>;
var<workgroup> wg_max_volume_ratio_j: array<f32, 32>;
var<workgroup> wg_phase_mass_solid: array<f32, 32>;
var<workgroup> wg_phase_mass_liquid: array<f32, 32>;
var<workgroup> wg_phase_mass_gas: array<f32, 32>;
var<workgroup> wg_phase_mass_plasma: array<f32, 32>;
var<workgroup> wg_temperature_mass_sum: array<f32, 32>;
var<workgroup> wg_min_temperature_k: array<f32, 32>;
var<workgroup> wg_max_temperature_k: array<f32, 32>;
var<workgroup> wg_thermal_ready_count: array<f32, 32>;
var<workgroup> wg_thermal_problem_count: array<f32, 32>;
var<workgroup> wg_finite_temperature_count: array<f32, 32>;
var<workgroup> wg_phase_mass_total: array<f32, 32>;
var<workgroup> wg_source_position_mass_x: array<f32, 32>;
var<workgroup> wg_source_position_mass_y: array<f32, 32>;
var<workgroup> wg_source_position_mass_z: array<f32, 32>;
var<workgroup> wg_next_position_mass_x: array<f32, 32>;
var<workgroup> wg_next_position_mass_y: array<f32, 32>;
var<workgroup> wg_next_position_mass_z: array<f32, 32>;
var<workgroup> wg_source_min_x: array<f32, 32>;
var<workgroup> wg_source_min_y: array<f32, 32>;
var<workgroup> wg_source_min_z: array<f32, 32>;
var<workgroup> wg_source_max_x: array<f32, 32>;
var<workgroup> wg_source_max_y: array<f32, 32>;
var<workgroup> wg_source_max_z: array<f32, 32>;
var<workgroup> wg_next_min_x: array<f32, 32>;
var<workgroup> wg_next_min_y: array<f32, 32>;
var<workgroup> wg_next_min_z: array<f32, 32>;
var<workgroup> wg_next_max_x: array<f32, 32>;
var<workgroup> wg_next_max_y: array<f32, 32>;
var<workgroup> wg_next_max_z: array<f32, 32>;
var<workgroup> wg_source_bounds_status: array<f32, 32>;
var<workgroup> wg_next_bounds_status: array<f32, 32>;
var<workgroup> wg_base_cohort_mass: array<f32, 32>;
var<workgroup> wg_base_cohort_position_mass_x: array<f32, 32>;
var<workgroup> wg_base_cohort_position_mass_y: array<f32, 32>;
var<workgroup> wg_base_cohort_position_mass_z: array<f32, 32>;
var<workgroup> wg_base_cohort_min_x: array<f32, 32>;
var<workgroup> wg_base_cohort_min_y: array<f32, 32>;
var<workgroup> wg_base_cohort_min_z: array<f32, 32>;
var<workgroup> wg_base_cohort_max_x: array<f32, 32>;
var<workgroup> wg_base_cohort_max_y: array<f32, 32>;
var<workgroup> wg_base_cohort_max_z: array<f32, 32>;
var<workgroup> wg_base_cohort_max_speed: array<f32, 32>;
var<workgroup> wg_base_cohort_status: array<f32, 32>;
var<workgroup> wg_drop_cohort_mass: array<f32, 32>;
var<workgroup> wg_drop_cohort_position_mass_x: array<f32, 32>;
var<workgroup> wg_drop_cohort_position_mass_y: array<f32, 32>;
var<workgroup> wg_drop_cohort_position_mass_z: array<f32, 32>;
var<workgroup> wg_drop_cohort_min_x: array<f32, 32>;
var<workgroup> wg_drop_cohort_min_y: array<f32, 32>;
var<workgroup> wg_drop_cohort_min_z: array<f32, 32>;
var<workgroup> wg_drop_cohort_max_x: array<f32, 32>;
var<workgroup> wg_drop_cohort_max_y: array<f32, 32>;
var<workgroup> wg_drop_cohort_max_z: array<f32, 32>;
var<workgroup> wg_drop_cohort_max_speed: array<f32, 32>;
var<workgroup> wg_drop_cohort_status: array<f32, 32>;
var<workgroup> wg_h2o_gas_mass: array<f32, 32>;
var<workgroup> wg_h2o_gas_temperature_mass_sum: array<f32, 32>;
var<workgroup> wg_h2o_gas_phase_weight: array<f32, 32>;

@compute @workgroup_size(32)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let index = global_id.x;
  let lane = local_id.x;

  var active_grid_nodes = 0.0;
  if (index < params.grid_node_count) {
    let row0 = updated_grid_nodes[index * 2u];
    if (row0.x > 0.0) {
      active_grid_nodes = 1.0;
    }
  }

  var source_mass = 0.0;
  var next_mass = 0.0;
  var source_momentum = vec3<f32>(0.0);
  var next_momentum = vec3<f32>(0.0);
  var max_speed2 = 0.0;
  var max_displacement2 = 0.0;
  var min_volume_ratio_j = 3.4028234663852886e38;
  var max_volume_ratio_j = 0.0;
  var phase_mass_solid = 0.0;
  var phase_mass_liquid = 0.0;
  var phase_mass_gas = 0.0;
  var phase_mass_plasma = 0.0;
  var temperature_mass_sum = 0.0;
  var min_temperature_k = 3.4028234663852886e38;
  var max_temperature_k = 0.0;
  var thermal_ready_count = 0.0;
  var thermal_problem_count = 0.0;
  var finite_temperature_count = 0.0;
  var phase_mass_total = 0.0;
  var source_position_mass = vec3<f32>(0.0);
  var next_position_mass = vec3<f32>(0.0);
  var source_min = vec3<f32>(3.4028234663852886e38);
  var source_max = vec3<f32>(-3.4028234663852886e38);
  var next_min = vec3<f32>(3.4028234663852886e38);
  var next_max = vec3<f32>(-3.4028234663852886e38);
  var source_bounds_status = 0.0;
  var next_bounds_status = 0.0;
  var base_cohort_mass = 0.0;
  var base_cohort_position_mass = vec3<f32>(0.0);
  var base_cohort_min = vec3<f32>(3.4028234663852886e38);
  var base_cohort_max = vec3<f32>(-3.4028234663852886e38);
  var base_cohort_max_speed2 = 0.0;
  var base_cohort_status = 0.0;
  var drop_cohort_mass = 0.0;
  var drop_cohort_position_mass = vec3<f32>(0.0);
  var drop_cohort_min = vec3<f32>(3.4028234663852886e38);
  var drop_cohort_max = vec3<f32>(-3.4028234663852886e38);
  var drop_cohort_max_speed2 = 0.0;
  var drop_cohort_status = 0.0;
  var h2o_gas_mass = 0.0;
  var h2o_gas_temperature_mass_sum = 0.0;
  var h2o_gas_phase_weight = 0.0;

  if (index < params.particle_count) {
    let state_base = index * 2u;
    let thermo_base = index * 3u;
    let mechanics_base = index * 8u;
    let source_pos_mass = source_sph_state[state_base];
    let source_vel_u = source_sph_state[state_base + 1u];
    let next_pos_mass = next_sph_state[state_base];
    let next_vel_u = next_sph_state[state_base + 1u];
    let thermo_row0 = next_sph_thermo[thermo_base];
    let thermo_row1 = next_sph_thermo[thermo_base + 1u];
    let thermo_row2 = next_sph_thermo[thermo_base + 2u];
    // Phase-lane storage deliberately preserves state while its mass is zero.
    // Every next-state diagnostic must therefore use live mass as its
    // admission predicate instead of interpreting dormant payload values.
    let next_particle_live = next_pos_mass.w > 0.0;

    source_mass = source_mass + source_pos_mass.w;
    next_mass = next_mass + next_pos_mass.w;
    if (source_pos_mass.w > 0.0) {
      source_momentum = source_momentum + source_pos_mass.w * source_vel_u.xyz;
      source_position_mass = source_position_mass + source_pos_mass.w * source_pos_mass.xyz;
      source_min = min(source_min, source_pos_mass.xyz);
      source_max = max(source_max, source_pos_mass.xyz);
      source_bounds_status = 1.0;
    }
    if (next_particle_live) {
      next_momentum = next_momentum + next_pos_mass.w * next_vel_u.xyz;
      next_position_mass = next_position_mass + next_pos_mass.w * next_pos_mass.xyz;
      next_min = min(next_min, next_pos_mass.xyz);
      next_max = max(next_max, next_pos_mass.xyz);
      next_bounds_status = 1.0;
      max_speed2 = max(max_speed2, dot(next_vel_u.xyz, next_vel_u.xyz));
      let displacement = next_pos_mass.xyz - source_pos_mass.xyz;
      max_displacement2 = max(max_displacement2, dot(displacement, displacement));
    }
    let particle_speed2 = dot(next_vel_u.xyz, next_vel_u.xyz);
    let phase_lineage_v2 = params.phase_lineage_capacity > 0u
      && params.phase_lane_count == 4u
      && params.phase_lineage_capacity * params.phase_lane_count == params.particle_count;
    let cohort_index = select(
      index,
      index % max(params.phase_lineage_capacity, 1u),
      phase_lineage_v2
    );
    let in_base_cohort = cohort_index >= params.base_start_index
      && cohort_index < params.base_end_index;
    let in_drop_cohort = cohort_index >= params.drop_start_index
      && cohort_index < params.drop_end_index;
    if (in_base_cohort && next_particle_live) {
      base_cohort_mass = base_cohort_mass + next_pos_mass.w;
      base_cohort_position_mass = base_cohort_position_mass + next_pos_mass.w * next_pos_mass.xyz;
      base_cohort_min = min(base_cohort_min, next_pos_mass.xyz);
      base_cohort_max = max(base_cohort_max, next_pos_mass.xyz);
      base_cohort_max_speed2 = max(base_cohort_max_speed2, particle_speed2);
      base_cohort_status = 1.0;
    }
    if (in_drop_cohort && next_particle_live) {
      drop_cohort_mass = drop_cohort_mass + next_pos_mass.w;
      drop_cohort_position_mass = drop_cohort_position_mass + next_pos_mass.w * next_pos_mass.xyz;
      drop_cohort_min = min(drop_cohort_min, next_pos_mass.xyz);
      drop_cohort_max = max(drop_cohort_max, next_pos_mass.xyz);
      drop_cohort_max_speed2 = max(drop_cohort_max_speed2, particle_speed2);
      drop_cohort_status = 1.0;
    }

    let next_j = next_mls_mechanics[mechanics_base + 4u].z;
    if (next_particle_live) {
      min_volume_ratio_j = min(min_volume_ratio_j, next_j);
      max_volume_ratio_j = max(max_volume_ratio_j, next_j);

      let particle_mass = next_pos_mass.w;
      let phase_fractions = max(thermo_row1, vec4<f32>(0.0));
      phase_mass_solid = phase_mass_solid + particle_mass * phase_fractions.x;
      phase_mass_liquid = phase_mass_liquid + particle_mass * phase_fractions.y;
      phase_mass_gas = phase_mass_gas + particle_mass * phase_fractions.z;
      phase_mass_plasma = phase_mass_plasma + particle_mass * phase_fractions.w;
      phase_mass_total = phase_mass_total + particle_mass * (
        phase_fractions.x + phase_fractions.y + phase_fractions.z + phase_fractions.w
      );

      let temperature_k = thermo_row0.z;
      let particle_h2o_gas_mass = particle_mass * phase_fractions.z;
      if (u32(round(thermo_row0.x)) == params.h2o_material_id && particle_h2o_gas_mass > 0.0) {
        h2o_gas_mass = h2o_gas_mass + particle_h2o_gas_mass;
        h2o_gas_phase_weight = h2o_gas_phase_weight + phase_fractions.z;
        if (temperature_k >= 0.0 && temperature_k <= 3.4028234663852886e38) {
          h2o_gas_temperature_mass_sum = h2o_gas_temperature_mass_sum
            + particle_h2o_gas_mass * temperature_k;
        }
      }
      let finite_nonnegative_temperature = temperature_k >= 0.0
        && temperature_k <= 3.4028234663852886e38;
      if (finite_nonnegative_temperature) {
        temperature_mass_sum = temperature_mass_sum + particle_mass * temperature_k;
        min_temperature_k = min(min_temperature_k, temperature_k);
        max_temperature_k = max(max_temperature_k, temperature_k);
        finite_temperature_count = finite_temperature_count + 1.0;
      }
      if (thermo_row2.z == 1.0) {
        thermal_ready_count = thermal_ready_count + 1.0;
      } else {
        thermal_problem_count = thermal_problem_count + 1.0;
      }
    }
  }

  wg_active_grid_nodes[lane] = active_grid_nodes;
  wg_source_mass[lane] = source_mass;
  wg_next_mass[lane] = next_mass;
  wg_source_momentum_x[lane] = source_momentum.x;
  wg_source_momentum_y[lane] = source_momentum.y;
  wg_source_momentum_z[lane] = source_momentum.z;
  wg_next_momentum_x[lane] = next_momentum.x;
  wg_next_momentum_y[lane] = next_momentum.y;
  wg_next_momentum_z[lane] = next_momentum.z;
  wg_max_speed[lane] = sqrt(max_speed2);
  wg_max_displacement[lane] = sqrt(max_displacement2);
  wg_min_volume_ratio_j[lane] = min_volume_ratio_j;
  wg_max_volume_ratio_j[lane] = max_volume_ratio_j;
  wg_phase_mass_solid[lane] = phase_mass_solid;
  wg_phase_mass_liquid[lane] = phase_mass_liquid;
  wg_phase_mass_gas[lane] = phase_mass_gas;
  wg_phase_mass_plasma[lane] = phase_mass_plasma;
  wg_temperature_mass_sum[lane] = temperature_mass_sum;
  wg_min_temperature_k[lane] = min_temperature_k;
  wg_max_temperature_k[lane] = max_temperature_k;
  wg_thermal_ready_count[lane] = thermal_ready_count;
  wg_thermal_problem_count[lane] = thermal_problem_count;
  wg_finite_temperature_count[lane] = finite_temperature_count;
  wg_phase_mass_total[lane] = phase_mass_total;
  wg_source_position_mass_x[lane] = source_position_mass.x;
  wg_source_position_mass_y[lane] = source_position_mass.y;
  wg_source_position_mass_z[lane] = source_position_mass.z;
  wg_next_position_mass_x[lane] = next_position_mass.x;
  wg_next_position_mass_y[lane] = next_position_mass.y;
  wg_next_position_mass_z[lane] = next_position_mass.z;
  wg_source_min_x[lane] = source_min.x;
  wg_source_min_y[lane] = source_min.y;
  wg_source_min_z[lane] = source_min.z;
  wg_source_max_x[lane] = source_max.x;
  wg_source_max_y[lane] = source_max.y;
  wg_source_max_z[lane] = source_max.z;
  wg_next_min_x[lane] = next_min.x;
  wg_next_min_y[lane] = next_min.y;
  wg_next_min_z[lane] = next_min.z;
  wg_next_max_x[lane] = next_max.x;
  wg_next_max_y[lane] = next_max.y;
  wg_next_max_z[lane] = next_max.z;
  wg_source_bounds_status[lane] = source_bounds_status;
  wg_next_bounds_status[lane] = next_bounds_status;
  wg_base_cohort_mass[lane] = base_cohort_mass;
  wg_base_cohort_position_mass_x[lane] = base_cohort_position_mass.x;
  wg_base_cohort_position_mass_y[lane] = base_cohort_position_mass.y;
  wg_base_cohort_position_mass_z[lane] = base_cohort_position_mass.z;
  wg_base_cohort_min_x[lane] = base_cohort_min.x;
  wg_base_cohort_min_y[lane] = base_cohort_min.y;
  wg_base_cohort_min_z[lane] = base_cohort_min.z;
  wg_base_cohort_max_x[lane] = base_cohort_max.x;
  wg_base_cohort_max_y[lane] = base_cohort_max.y;
  wg_base_cohort_max_z[lane] = base_cohort_max.z;
  wg_base_cohort_max_speed[lane] = sqrt(base_cohort_max_speed2);
  wg_base_cohort_status[lane] = base_cohort_status;
  wg_drop_cohort_mass[lane] = drop_cohort_mass;
  wg_drop_cohort_position_mass_x[lane] = drop_cohort_position_mass.x;
  wg_drop_cohort_position_mass_y[lane] = drop_cohort_position_mass.y;
  wg_drop_cohort_position_mass_z[lane] = drop_cohort_position_mass.z;
  wg_drop_cohort_min_x[lane] = drop_cohort_min.x;
  wg_drop_cohort_min_y[lane] = drop_cohort_min.y;
  wg_drop_cohort_min_z[lane] = drop_cohort_min.z;
  wg_drop_cohort_max_x[lane] = drop_cohort_max.x;
  wg_drop_cohort_max_y[lane] = drop_cohort_max.y;
  wg_drop_cohort_max_z[lane] = drop_cohort_max.z;
  wg_drop_cohort_max_speed[lane] = sqrt(drop_cohort_max_speed2);
  wg_drop_cohort_status[lane] = drop_cohort_status;
  wg_h2o_gas_mass[lane] = h2o_gas_mass;
  wg_h2o_gas_temperature_mass_sum[lane] = h2o_gas_temperature_mass_sum;
  wg_h2o_gas_phase_weight[lane] = h2o_gas_phase_weight;
  workgroupBarrier();

  var stride = 16u;
  loop {
    if (lane < stride) {
      let other = lane + stride;
      wg_active_grid_nodes[lane] = wg_active_grid_nodes[lane] + wg_active_grid_nodes[other];
      wg_source_mass[lane] = wg_source_mass[lane] + wg_source_mass[other];
      wg_next_mass[lane] = wg_next_mass[lane] + wg_next_mass[other];
      wg_source_momentum_x[lane] = wg_source_momentum_x[lane] + wg_source_momentum_x[other];
      wg_source_momentum_y[lane] = wg_source_momentum_y[lane] + wg_source_momentum_y[other];
      wg_source_momentum_z[lane] = wg_source_momentum_z[lane] + wg_source_momentum_z[other];
      wg_next_momentum_x[lane] = wg_next_momentum_x[lane] + wg_next_momentum_x[other];
      wg_next_momentum_y[lane] = wg_next_momentum_y[lane] + wg_next_momentum_y[other];
      wg_next_momentum_z[lane] = wg_next_momentum_z[lane] + wg_next_momentum_z[other];
      wg_max_speed[lane] = max(wg_max_speed[lane], wg_max_speed[other]);
      wg_max_displacement[lane] = max(wg_max_displacement[lane], wg_max_displacement[other]);
      wg_min_volume_ratio_j[lane] = min(wg_min_volume_ratio_j[lane], wg_min_volume_ratio_j[other]);
      wg_max_volume_ratio_j[lane] = max(wg_max_volume_ratio_j[lane], wg_max_volume_ratio_j[other]);
      wg_phase_mass_solid[lane] = wg_phase_mass_solid[lane] + wg_phase_mass_solid[other];
      wg_phase_mass_liquid[lane] = wg_phase_mass_liquid[lane] + wg_phase_mass_liquid[other];
      wg_phase_mass_gas[lane] = wg_phase_mass_gas[lane] + wg_phase_mass_gas[other];
      wg_phase_mass_plasma[lane] = wg_phase_mass_plasma[lane] + wg_phase_mass_plasma[other];
      wg_temperature_mass_sum[lane] = wg_temperature_mass_sum[lane] + wg_temperature_mass_sum[other];
      wg_min_temperature_k[lane] = min(wg_min_temperature_k[lane], wg_min_temperature_k[other]);
      wg_max_temperature_k[lane] = max(wg_max_temperature_k[lane], wg_max_temperature_k[other]);
      wg_thermal_ready_count[lane] = wg_thermal_ready_count[lane] + wg_thermal_ready_count[other];
      wg_thermal_problem_count[lane] = wg_thermal_problem_count[lane] + wg_thermal_problem_count[other];
      wg_finite_temperature_count[lane] = wg_finite_temperature_count[lane] + wg_finite_temperature_count[other];
      wg_phase_mass_total[lane] = wg_phase_mass_total[lane] + wg_phase_mass_total[other];
      wg_source_position_mass_x[lane] = wg_source_position_mass_x[lane] + wg_source_position_mass_x[other];
      wg_source_position_mass_y[lane] = wg_source_position_mass_y[lane] + wg_source_position_mass_y[other];
      wg_source_position_mass_z[lane] = wg_source_position_mass_z[lane] + wg_source_position_mass_z[other];
      wg_next_position_mass_x[lane] = wg_next_position_mass_x[lane] + wg_next_position_mass_x[other];
      wg_next_position_mass_y[lane] = wg_next_position_mass_y[lane] + wg_next_position_mass_y[other];
      wg_next_position_mass_z[lane] = wg_next_position_mass_z[lane] + wg_next_position_mass_z[other];
      wg_source_min_x[lane] = min(wg_source_min_x[lane], wg_source_min_x[other]);
      wg_source_min_y[lane] = min(wg_source_min_y[lane], wg_source_min_y[other]);
      wg_source_min_z[lane] = min(wg_source_min_z[lane], wg_source_min_z[other]);
      wg_source_max_x[lane] = max(wg_source_max_x[lane], wg_source_max_x[other]);
      wg_source_max_y[lane] = max(wg_source_max_y[lane], wg_source_max_y[other]);
      wg_source_max_z[lane] = max(wg_source_max_z[lane], wg_source_max_z[other]);
      wg_next_min_x[lane] = min(wg_next_min_x[lane], wg_next_min_x[other]);
      wg_next_min_y[lane] = min(wg_next_min_y[lane], wg_next_min_y[other]);
      wg_next_min_z[lane] = min(wg_next_min_z[lane], wg_next_min_z[other]);
      wg_next_max_x[lane] = max(wg_next_max_x[lane], wg_next_max_x[other]);
      wg_next_max_y[lane] = max(wg_next_max_y[lane], wg_next_max_y[other]);
      wg_next_max_z[lane] = max(wg_next_max_z[lane], wg_next_max_z[other]);
      wg_source_bounds_status[lane] = max(wg_source_bounds_status[lane], wg_source_bounds_status[other]);
      wg_next_bounds_status[lane] = max(wg_next_bounds_status[lane], wg_next_bounds_status[other]);
      wg_base_cohort_mass[lane] = wg_base_cohort_mass[lane] + wg_base_cohort_mass[other];
      wg_base_cohort_position_mass_x[lane] = wg_base_cohort_position_mass_x[lane] + wg_base_cohort_position_mass_x[other];
      wg_base_cohort_position_mass_y[lane] = wg_base_cohort_position_mass_y[lane] + wg_base_cohort_position_mass_y[other];
      wg_base_cohort_position_mass_z[lane] = wg_base_cohort_position_mass_z[lane] + wg_base_cohort_position_mass_z[other];
      wg_base_cohort_min_x[lane] = min(wg_base_cohort_min_x[lane], wg_base_cohort_min_x[other]);
      wg_base_cohort_min_y[lane] = min(wg_base_cohort_min_y[lane], wg_base_cohort_min_y[other]);
      wg_base_cohort_min_z[lane] = min(wg_base_cohort_min_z[lane], wg_base_cohort_min_z[other]);
      wg_base_cohort_max_x[lane] = max(wg_base_cohort_max_x[lane], wg_base_cohort_max_x[other]);
      wg_base_cohort_max_y[lane] = max(wg_base_cohort_max_y[lane], wg_base_cohort_max_y[other]);
      wg_base_cohort_max_z[lane] = max(wg_base_cohort_max_z[lane], wg_base_cohort_max_z[other]);
      wg_base_cohort_max_speed[lane] = max(wg_base_cohort_max_speed[lane], wg_base_cohort_max_speed[other]);
      wg_base_cohort_status[lane] = max(wg_base_cohort_status[lane], wg_base_cohort_status[other]);
      wg_drop_cohort_mass[lane] = wg_drop_cohort_mass[lane] + wg_drop_cohort_mass[other];
      wg_drop_cohort_position_mass_x[lane] = wg_drop_cohort_position_mass_x[lane] + wg_drop_cohort_position_mass_x[other];
      wg_drop_cohort_position_mass_y[lane] = wg_drop_cohort_position_mass_y[lane] + wg_drop_cohort_position_mass_y[other];
      wg_drop_cohort_position_mass_z[lane] = wg_drop_cohort_position_mass_z[lane] + wg_drop_cohort_position_mass_z[other];
      wg_drop_cohort_min_x[lane] = min(wg_drop_cohort_min_x[lane], wg_drop_cohort_min_x[other]);
      wg_drop_cohort_min_y[lane] = min(wg_drop_cohort_min_y[lane], wg_drop_cohort_min_y[other]);
      wg_drop_cohort_min_z[lane] = min(wg_drop_cohort_min_z[lane], wg_drop_cohort_min_z[other]);
      wg_drop_cohort_max_x[lane] = max(wg_drop_cohort_max_x[lane], wg_drop_cohort_max_x[other]);
      wg_drop_cohort_max_y[lane] = max(wg_drop_cohort_max_y[lane], wg_drop_cohort_max_y[other]);
      wg_drop_cohort_max_z[lane] = max(wg_drop_cohort_max_z[lane], wg_drop_cohort_max_z[other]);
      wg_drop_cohort_max_speed[lane] = max(wg_drop_cohort_max_speed[lane], wg_drop_cohort_max_speed[other]);
      wg_drop_cohort_status[lane] = max(wg_drop_cohort_status[lane], wg_drop_cohort_status[other]);
      wg_h2o_gas_mass[lane] = wg_h2o_gas_mass[lane] + wg_h2o_gas_mass[other];
      wg_h2o_gas_temperature_mass_sum[lane] = wg_h2o_gas_temperature_mass_sum[lane]
        + wg_h2o_gas_temperature_mass_sum[other];
      wg_h2o_gas_phase_weight[lane] = wg_h2o_gas_phase_weight[lane] + wg_h2o_gas_phase_weight[other];
    }
    workgroupBarrier();
    if (stride == 1u) {
      break;
    }
    stride = stride / 2u;
  }

  if (lane == 0u) {
    let partial_base = workgroup_id.x * 22u;
    let momentum_delta = vec3<f32>(
      wg_next_momentum_x[0u] - wg_source_momentum_x[0u],
      wg_next_momentum_y[0u] - wg_source_momentum_y[0u],
      wg_next_momentum_z[0u] - wg_source_momentum_z[0u]
    );
    partial_summaries[partial_base] = vec4<f32>(
      0.0,
      0.0,
      wg_active_grid_nodes[0u],
      wg_source_mass[0u]
    );
    partial_summaries[partial_base + 1u] = vec4<f32>(
      wg_next_mass[0u],
      wg_next_mass[0u] - wg_source_mass[0u],
      wg_source_momentum_x[0u],
      wg_source_momentum_y[0u]
    );
    partial_summaries[partial_base + 2u] = vec4<f32>(
      wg_source_momentum_z[0u],
      wg_next_momentum_x[0u],
      wg_next_momentum_y[0u],
      wg_next_momentum_z[0u]
    );
    partial_summaries[partial_base + 3u] = vec4<f32>(
      momentum_delta.x,
      momentum_delta.y,
      momentum_delta.z,
      wg_max_speed[0u]
    );
    partial_summaries[partial_base + 4u] = vec4<f32>(
      wg_max_displacement[0u],
      wg_min_volume_ratio_j[0u],
      wg_max_volume_ratio_j[0u],
      1.0
    );
    partial_summaries[partial_base + 5u] = vec4<f32>(
      wg_phase_mass_solid[0u],
      wg_phase_mass_liquid[0u],
      wg_phase_mass_gas[0u],
      wg_phase_mass_plasma[0u]
    );
    partial_summaries[partial_base + 6u] = vec4<f32>(
      wg_temperature_mass_sum[0u],
      wg_min_temperature_k[0u],
      wg_max_temperature_k[0u],
      wg_thermal_ready_count[0u]
    );
    partial_summaries[partial_base + 7u] = vec4<f32>(
      wg_thermal_problem_count[0u],
      wg_finite_temperature_count[0u],
      wg_phase_mass_total[0u],
      1.0
    );
    partial_summaries[partial_base + 8u] = vec4<f32>(
      wg_source_position_mass_x[0u],
      wg_source_position_mass_y[0u],
      wg_source_position_mass_z[0u],
      wg_next_position_mass_x[0u]
    );
    partial_summaries[partial_base + 9u] = vec4<f32>(
      wg_next_position_mass_y[0u],
      wg_next_position_mass_z[0u],
      wg_source_min_x[0u],
      wg_source_min_y[0u]
    );
    partial_summaries[partial_base + 10u] = vec4<f32>(
      wg_source_min_z[0u],
      wg_source_max_x[0u],
      wg_source_max_y[0u],
      wg_source_max_z[0u]
    );
    partial_summaries[partial_base + 11u] = vec4<f32>(
      wg_next_min_x[0u],
      wg_next_min_y[0u],
      wg_next_min_z[0u],
      wg_next_max_x[0u]
    );
    partial_summaries[partial_base + 12u] = vec4<f32>(
      wg_next_max_y[0u],
      wg_next_max_z[0u],
      wg_source_bounds_status[0u],
      wg_next_bounds_status[0u]
    );
    partial_summaries[partial_base + 13u] = vec4<f32>(
      wg_source_mass[0u],
      wg_next_mass[0u],
      0.0,
      0.0
    );
    partial_summaries[partial_base + 14u] = vec4<f32>(
      max(wg_base_cohort_status[0u], wg_drop_cohort_status[0u]),
      f32(params.base_start_index),
      f32(params.base_end_index),
      f32(params.drop_start_index)
    );
    partial_summaries[partial_base + 15u] = vec4<f32>(
      f32(params.drop_end_index),
      wg_base_cohort_mass[0u],
      wg_base_cohort_position_mass_x[0u],
      wg_base_cohort_position_mass_y[0u]
    );
    partial_summaries[partial_base + 16u] = vec4<f32>(
      wg_base_cohort_position_mass_z[0u],
      wg_base_cohort_min_x[0u],
      wg_base_cohort_min_y[0u],
      wg_base_cohort_min_z[0u]
    );
    partial_summaries[partial_base + 17u] = vec4<f32>(
      wg_base_cohort_max_x[0u],
      wg_base_cohort_max_y[0u],
      wg_base_cohort_max_z[0u],
      wg_base_cohort_max_speed[0u]
    );
    partial_summaries[partial_base + 18u] = vec4<f32>(
      wg_drop_cohort_mass[0u],
      wg_drop_cohort_position_mass_x[0u],
      wg_drop_cohort_position_mass_y[0u],
      wg_drop_cohort_position_mass_z[0u]
    );
    partial_summaries[partial_base + 19u] = vec4<f32>(
      wg_drop_cohort_min_x[0u],
      wg_drop_cohort_min_y[0u],
      wg_drop_cohort_min_z[0u],
      wg_drop_cohort_max_x[0u]
    );
    partial_summaries[partial_base + 20u] = vec4<f32>(
      wg_drop_cohort_max_y[0u],
      wg_drop_cohort_max_z[0u],
      wg_drop_cohort_max_speed[0u],
      0.0
    );
    partial_summaries[partial_base + 21u] = vec4<f32>(
      wg_h2o_gas_mass[0u],
      wg_h2o_gas_temperature_mass_sum[0u],
      wg_h2o_gas_phase_weight[0u],
      select(0.0, 1.0, params.h2o_material_id > 0u)
    );
  }
}
`;

export const mlsMpmResidentSummaryFinalizeWgsl = `
struct ResidentSummaryParams {
  particle_count: u32,
  grid_node_count: u32,
  partial_count: u32,
  base_start_index: u32,
  base_end_index: u32,
  drop_start_index: u32,
  drop_end_index: u32,
  h2o_material_id: u32,
  phase_lineage_capacity: u32,
  phase_lane_count: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> partial_summaries: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> resident_summary: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: ResidentSummaryParams;

// Compact 64-lane workgroup memory (22 * 64 * 16 B = 22.5 KiB -> stay <= 16 KiB
// baseline limit by using @workgroup_size(32): 22 * 32 * 16 B = 11,264 B!).
var<workgroup> res_wg_rows: array<array<vec4<f32>, 22>, 32>;

@compute @workgroup_size(32)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (workgroup_id.x > 0u) {
    return;
  }
  let lane = local_id.x;

  var active_grid_nodes = 0.0;
  var source_mass = 0.0;
  var next_mass = 0.0;
  var source_momentum = vec3<f32>(0.0);
  var next_momentum = vec3<f32>(0.0);
  var max_speed = 0.0;
  var max_displacement = 0.0;
  var min_volume_ratio_j = 3.4028234663852886e38;
  var max_volume_ratio_j = 0.0;
  var phase_mass_solid = 0.0;
  var phase_mass_liquid = 0.0;
  var phase_mass_gas = 0.0;
  var phase_mass_plasma = 0.0;
  var temperature_mass_sum = 0.0;
  var min_temperature_k = 3.4028234663852886e38;
  var max_temperature_k = 0.0;
  var thermal_ready_count = 0.0;
  var thermal_problem_count = 0.0;
  var finite_temperature_count = 0.0;
  var phase_mass_total = 0.0;
  var source_position_mass = vec3<f32>(0.0);
  var next_position_mass = vec3<f32>(0.0);
  var source_min = vec3<f32>(3.4028234663852886e38);
  var source_max = vec3<f32>(-3.4028234663852886e38);
  var next_min = vec3<f32>(3.4028234663852886e38);
  var next_max = vec3<f32>(-3.4028234663852886e38);
  var source_bounds_status = 0.0;
  var next_bounds_status = 0.0;
  var source_position_mass_total = 0.0;
  var next_position_mass_total = 0.0;
  var cohort_summary_status = 0.0;
  var base_cohort_mass = 0.0;
  var base_cohort_position_mass = vec3<f32>(0.0);
  var base_cohort_min = vec3<f32>(3.4028234663852886e38);
  var base_cohort_max = vec3<f32>(-3.4028234663852886e38);
  var base_cohort_max_speed = 0.0;
  var drop_cohort_mass = 0.0;
  var drop_cohort_position_mass = vec3<f32>(0.0);
  var drop_cohort_min = vec3<f32>(3.4028234663852886e38);
  var drop_cohort_max = vec3<f32>(-3.4028234663852886e38);
  var drop_cohort_max_speed = 0.0;
  var h2o_gas_mass = 0.0;
  var h2o_gas_temperature_mass_sum = 0.0;
  var h2o_gas_phase_weight = 0.0;
  var h2o_gas_summary_status = 0.0;

  for (var partial_index = lane; partial_index < params.partial_count; partial_index = partial_index + 32u) {
    let base = partial_index * 22u;
    let row0 = partial_summaries[base];
    let row1 = partial_summaries[base + 1u];
    let row2 = partial_summaries[base + 2u];
    let row3 = partial_summaries[base + 3u];
    let row4 = partial_summaries[base + 4u];
    let row5 = partial_summaries[base + 5u];
    let row6 = partial_summaries[base + 6u];
    let row7 = partial_summaries[base + 7u];
    let row8 = partial_summaries[base + 8u];
    let row9 = partial_summaries[base + 9u];
    let row10 = partial_summaries[base + 10u];
    let row11 = partial_summaries[base + 11u];
    let row12 = partial_summaries[base + 12u];
    let row13 = partial_summaries[base + 13u];
    let row14 = partial_summaries[base + 14u];
    let row15 = partial_summaries[base + 15u];
    let row16 = partial_summaries[base + 16u];
    let row17 = partial_summaries[base + 17u];
    let row18 = partial_summaries[base + 18u];
    let row19 = partial_summaries[base + 19u];
    let row20 = partial_summaries[base + 20u];
    let row21 = partial_summaries[base + 21u];
    active_grid_nodes = active_grid_nodes + row0.z;
    source_mass = source_mass + row0.w;
    next_mass = next_mass + row1.x;
    source_momentum = source_momentum + vec3<f32>(row1.z, row1.w, row2.x);
    next_momentum = next_momentum + vec3<f32>(row2.y, row2.z, row2.w);
    max_speed = max(max_speed, row3.w);
    max_displacement = max(max_displacement, row4.x);
    min_volume_ratio_j = min(min_volume_ratio_j, row4.y);
    max_volume_ratio_j = max(max_volume_ratio_j, row4.z);
    phase_mass_solid = phase_mass_solid + row5.x;
    phase_mass_liquid = phase_mass_liquid + row5.y;
    phase_mass_gas = phase_mass_gas + row5.z;
    phase_mass_plasma = phase_mass_plasma + row5.w;
    temperature_mass_sum = temperature_mass_sum + row6.x;
    min_temperature_k = min(min_temperature_k, row6.y);
    max_temperature_k = max(max_temperature_k, row6.z);
    thermal_ready_count = thermal_ready_count + row6.w;
    thermal_problem_count = thermal_problem_count + row7.x;
    finite_temperature_count = finite_temperature_count + row7.y;
    phase_mass_total = phase_mass_total + row7.z;
    source_position_mass = source_position_mass + vec3<f32>(row8.x, row8.y, row8.z);
    next_position_mass = next_position_mass + vec3<f32>(row8.w, row9.x, row9.y);
    source_min = min(source_min, vec3<f32>(row9.z, row9.w, row10.x));
    source_max = max(source_max, vec3<f32>(row10.y, row10.z, row10.w));
    next_min = min(next_min, vec3<f32>(row11.x, row11.y, row11.z));
    next_max = max(next_max, vec3<f32>(row11.w, row12.x, row12.y));
    source_bounds_status = max(source_bounds_status, row12.z);
    next_bounds_status = max(next_bounds_status, row12.w);
    source_position_mass_total = source_position_mass_total + row13.x;
    next_position_mass_total = next_position_mass_total + row13.y;
    cohort_summary_status = max(cohort_summary_status, row14.x);
    base_cohort_mass = base_cohort_mass + row15.y;
    base_cohort_position_mass = base_cohort_position_mass + vec3<f32>(row15.z, row15.w, row16.x);
    base_cohort_min = min(base_cohort_min, vec3<f32>(row16.y, row16.z, row16.w));
    base_cohort_max = max(base_cohort_max, vec3<f32>(row17.x, row17.y, row17.z));
    base_cohort_max_speed = max(base_cohort_max_speed, row17.w);
    drop_cohort_mass = drop_cohort_mass + row18.x;
    drop_cohort_position_mass = drop_cohort_position_mass + vec3<f32>(row18.y, row18.z, row18.w);
    drop_cohort_min = min(drop_cohort_min, vec3<f32>(row19.x, row19.y, row19.z));
    drop_cohort_max = max(drop_cohort_max, vec3<f32>(row19.w, row20.x, row20.y));
    drop_cohort_max_speed = max(drop_cohort_max_speed, row20.z);
    h2o_gas_mass = h2o_gas_mass + row21.x;
    h2o_gas_temperature_mass_sum = h2o_gas_temperature_mass_sum + row21.y;
    h2o_gas_phase_weight = h2o_gas_phase_weight + row21.z;
    h2o_gas_summary_status = max(h2o_gas_summary_status, row21.w);
  }

  res_wg_rows[lane][0] = vec4<f32>(0.0, 0.0, active_grid_nodes, source_mass);
  res_wg_rows[lane][1] = vec4<f32>(next_mass, 0.0, source_momentum.x, source_momentum.y);
  res_wg_rows[lane][2] = vec4<f32>(source_momentum.z, next_momentum.x, next_momentum.y, next_momentum.z);
  res_wg_rows[lane][3] = vec4<f32>(0.0, 0.0, 0.0, max_speed);
  res_wg_rows[lane][4] = vec4<f32>(max_displacement, min_volume_ratio_j, max_volume_ratio_j, 0.0);
  res_wg_rows[lane][5] = vec4<f32>(phase_mass_solid, phase_mass_liquid, phase_mass_gas, phase_mass_plasma);
  res_wg_rows[lane][6] = vec4<f32>(temperature_mass_sum, min_temperature_k, max_temperature_k, thermal_ready_count);
  res_wg_rows[lane][7] = vec4<f32>(thermal_problem_count, finite_temperature_count, phase_mass_total, 0.0);
  res_wg_rows[lane][8] = vec4<f32>(source_position_mass.x, source_position_mass.y, source_position_mass.z, next_position_mass.x);
  res_wg_rows[lane][9] = vec4<f32>(next_position_mass.y, next_position_mass.z, source_min.x, source_min.y);
  res_wg_rows[lane][10] = vec4<f32>(source_min.z, source_max.x, source_max.y, source_max.z);
  res_wg_rows[lane][11] = vec4<f32>(next_min.x, next_min.y, next_min.z, next_max.x);
  res_wg_rows[lane][12] = vec4<f32>(next_max.y, next_max.z, source_bounds_status, next_bounds_status);
  res_wg_rows[lane][13] = vec4<f32>(source_position_mass_total, next_position_mass_total, 0.0, 0.0);
  res_wg_rows[lane][14] = vec4<f32>(cohort_summary_status, 0.0, 0.0, 0.0);
  res_wg_rows[lane][15] = vec4<f32>(0.0, base_cohort_mass, base_cohort_position_mass.x, base_cohort_position_mass.y);
  res_wg_rows[lane][16] = vec4<f32>(base_cohort_position_mass.z, base_cohort_min.x, base_cohort_min.y, base_cohort_min.z);
  res_wg_rows[lane][17] = vec4<f32>(base_cohort_max.x, base_cohort_max.y, base_cohort_max.z, base_cohort_max_speed);
  res_wg_rows[lane][18] = vec4<f32>(drop_cohort_mass, drop_cohort_position_mass.x, drop_cohort_position_mass.y, drop_cohort_position_mass.z);
  res_wg_rows[lane][19] = vec4<f32>(drop_cohort_min.x, drop_cohort_min.y, drop_cohort_min.z, drop_cohort_max.x);
  res_wg_rows[lane][20] = vec4<f32>(drop_cohort_max.y, drop_cohort_max.z, drop_cohort_max_speed, 0.0);
  res_wg_rows[lane][21] = vec4<f32>(h2o_gas_mass, h2o_gas_temperature_mass_sum, h2o_gas_phase_weight, h2o_gas_summary_status);
  workgroupBarrier();
  var stride = 16u;
  loop {
    if (stride == 0u) { break; }
    if (lane < stride) {
      let o = lane + stride;
      res_wg_rows[lane][0] += res_wg_rows[o][0];
      res_wg_rows[lane][1] += res_wg_rows[o][1];
      res_wg_rows[lane][2] += res_wg_rows[o][2];
      res_wg_rows[lane][3] = vec4<f32>(0.0, 0.0, 0.0, max(res_wg_rows[lane][3].w, res_wg_rows[o][3].w));
      res_wg_rows[lane][4] = vec4<f32>(max(res_wg_rows[lane][4].x, res_wg_rows[o][4].x), min(res_wg_rows[lane][4].y, res_wg_rows[o][4].y), max(res_wg_rows[lane][4].z, res_wg_rows[o][4].z), 0.0);
      res_wg_rows[lane][5] += res_wg_rows[o][5];
      res_wg_rows[lane][6] = vec4<f32>(res_wg_rows[lane][6].x + res_wg_rows[o][6].x, min(res_wg_rows[lane][6].y, res_wg_rows[o][6].y), max(res_wg_rows[lane][6].z, res_wg_rows[o][6].z), res_wg_rows[lane][6].w + res_wg_rows[o][6].w);
      res_wg_rows[lane][7] += res_wg_rows[o][7];
      res_wg_rows[lane][8] += res_wg_rows[o][8];
      res_wg_rows[lane][9] = vec4<f32>(res_wg_rows[lane][9].xy + res_wg_rows[o][9].xy, min(res_wg_rows[lane][9].zw, res_wg_rows[o][9].zw));
      res_wg_rows[lane][10] = vec4<f32>(min(res_wg_rows[lane][10].x, res_wg_rows[o][10].x), max(res_wg_rows[lane][10].yzw, res_wg_rows[o][10].yzw));
      res_wg_rows[lane][11] = vec4<f32>(min(res_wg_rows[lane][11].xyz, res_wg_rows[o][11].xyz), max(res_wg_rows[lane][11].w, res_wg_rows[o][11].w));
      res_wg_rows[lane][12] = max(res_wg_rows[lane][12], res_wg_rows[o][12]);
      res_wg_rows[lane][13] += res_wg_rows[o][13];
      res_wg_rows[lane][14] = max(res_wg_rows[lane][14], res_wg_rows[o][14]);
      res_wg_rows[lane][15] += res_wg_rows[o][15];
      res_wg_rows[lane][16] = vec4<f32>(res_wg_rows[lane][16].x + res_wg_rows[o][16].x, min(res_wg_rows[lane][16].yzw, res_wg_rows[o][16].yzw));
      res_wg_rows[lane][17] = max(res_wg_rows[lane][17], res_wg_rows[o][17]);
      res_wg_rows[lane][18] += res_wg_rows[o][18];
      res_wg_rows[lane][19] = vec4<f32>(min(res_wg_rows[lane][19].xyz, res_wg_rows[o][19].xyz), max(res_wg_rows[lane][19].w, res_wg_rows[o][19].w));
      res_wg_rows[lane][20] = max(res_wg_rows[lane][20], res_wg_rows[o][20]);
      res_wg_rows[lane][21] = vec4<f32>(res_wg_rows[lane][21].xyz + res_wg_rows[o][21].xyz, max(res_wg_rows[lane][21].w, res_wg_rows[o][21].w));
    }
    workgroupBarrier();
    stride = stride / 2u;
  }
  if (lane != 0u) { return; }

  active_grid_nodes = res_wg_rows[0][0].z;
  source_mass = res_wg_rows[0][0].w;
  next_mass = res_wg_rows[0][1].x;
  source_momentum = vec3<f32>(res_wg_rows[0][1].z, res_wg_rows[0][1].w, res_wg_rows[0][2].x);
  next_momentum = vec3<f32>(res_wg_rows[0][2].y, res_wg_rows[0][2].z, res_wg_rows[0][2].w);
  max_speed = res_wg_rows[0][3].w;
  max_displacement = res_wg_rows[0][4].x;
  min_volume_ratio_j = res_wg_rows[0][4].y;
  max_volume_ratio_j = res_wg_rows[0][4].z;
  phase_mass_solid = res_wg_rows[0][5].x;
  phase_mass_liquid = res_wg_rows[0][5].y;
  phase_mass_gas = res_wg_rows[0][5].z;
  phase_mass_plasma = res_wg_rows[0][5].w;
  temperature_mass_sum = res_wg_rows[0][6].x;
  min_temperature_k = res_wg_rows[0][6].y;
  max_temperature_k = res_wg_rows[0][6].z;
  thermal_ready_count = res_wg_rows[0][6].w;
  thermal_problem_count = res_wg_rows[0][7].x;
  finite_temperature_count = res_wg_rows[0][7].y;
  phase_mass_total = res_wg_rows[0][7].z;
  source_position_mass = vec3<f32>(res_wg_rows[0][8].x, res_wg_rows[0][8].y, res_wg_rows[0][8].z);
  next_position_mass = vec3<f32>(res_wg_rows[0][8].w, res_wg_rows[0][9].x, res_wg_rows[0][9].y);
  source_min = vec3<f32>(res_wg_rows[0][9].z, res_wg_rows[0][9].w, res_wg_rows[0][10].x);
  source_max = vec3<f32>(res_wg_rows[0][10].y, res_wg_rows[0][10].z, res_wg_rows[0][10].w);
  next_min = vec3<f32>(res_wg_rows[0][11].x, res_wg_rows[0][11].y, res_wg_rows[0][11].z);
  next_max = vec3<f32>(res_wg_rows[0][11].w, res_wg_rows[0][12].x, res_wg_rows[0][12].y);
  source_bounds_status = res_wg_rows[0][12].z;
  next_bounds_status = res_wg_rows[0][12].w;
  source_position_mass_total = res_wg_rows[0][13].x;
  next_position_mass_total = res_wg_rows[0][13].y;
  cohort_summary_status = res_wg_rows[0][14].x;
  base_cohort_mass = res_wg_rows[0][15].y;
  base_cohort_position_mass = vec3<f32>(res_wg_rows[0][15].z, res_wg_rows[0][15].w, res_wg_rows[0][16].x);
  base_cohort_min = vec3<f32>(res_wg_rows[0][16].y, res_wg_rows[0][16].z, res_wg_rows[0][16].w);
  base_cohort_max = vec3<f32>(res_wg_rows[0][17].x, res_wg_rows[0][17].y, res_wg_rows[0][17].z);
  base_cohort_max_speed = res_wg_rows[0][17].w;
  drop_cohort_mass = res_wg_rows[0][18].x;
  drop_cohort_position_mass = vec3<f32>(res_wg_rows[0][18].y, res_wg_rows[0][18].z, res_wg_rows[0][18].w);
  drop_cohort_min = vec3<f32>(res_wg_rows[0][19].x, res_wg_rows[0][19].y, res_wg_rows[0][19].z);
  drop_cohort_max = vec3<f32>(res_wg_rows[0][19].w, res_wg_rows[0][20].x, res_wg_rows[0][20].y);
  drop_cohort_max_speed = res_wg_rows[0][20].z;
  h2o_gas_mass = res_wg_rows[0][21].x;
  h2o_gas_temperature_mass_sum = res_wg_rows[0][21].y;
  h2o_gas_phase_weight = res_wg_rows[0][21].z;
  h2o_gas_summary_status = res_wg_rows[0][21].w;

  if (next_bounds_status == 0.0) {
    min_volume_ratio_j = 0.0;
    max_volume_ratio_j = 0.0;
  }
  if (finite_temperature_count == 0.0) {
    min_temperature_k = 0.0;
    max_temperature_k = 0.0;
  }

  var temperature_mass_weighted_mean_k = 0.0;
  if (phase_mass_total > 0.0) {
    temperature_mass_weighted_mean_k = temperature_mass_sum / phase_mass_total;
  }
  var h2o_gas_temperature_mass_weighted_mean_k = 0.0;
  if (h2o_gas_mass > 0.0) {
    h2o_gas_temperature_mass_weighted_mean_k = h2o_gas_temperature_mass_sum / h2o_gas_mass;
  }
  var source_center_of_mass = vec3<f32>(0.0);
  if (source_position_mass_total > 0.0) {
    source_center_of_mass = source_position_mass / source_position_mass_total;
  }
  var next_center_of_mass = vec3<f32>(0.0);
  if (next_position_mass_total > 0.0) {
    next_center_of_mass = next_position_mass / next_position_mass_total;
  }
  if (source_bounds_status == 0.0) {
    source_min = vec3<f32>(0.0);
    source_max = vec3<f32>(0.0);
  }
  if (next_bounds_status == 0.0) {
    next_min = vec3<f32>(0.0);
    next_max = vec3<f32>(0.0);
  }
  var base_cohort_center = vec3<f32>(0.0);
  if (base_cohort_mass > 0.0) {
    base_cohort_center = base_cohort_position_mass / base_cohort_mass;
  } else {
    base_cohort_min = vec3<f32>(0.0);
    base_cohort_max = vec3<f32>(0.0);
  }
  var drop_cohort_center = vec3<f32>(0.0);
  if (drop_cohort_mass > 0.0) {
    drop_cohort_center = drop_cohort_position_mass / drop_cohort_mass;
  } else {
    drop_cohort_min = vec3<f32>(0.0);
    drop_cohort_max = vec3<f32>(0.0);
  }

  let momentum_delta = next_momentum - source_momentum;
  resident_summary[0u] = vec4<f32>(
    f32(params.particle_count),
    f32(params.grid_node_count),
    active_grid_nodes,
    source_mass
  );
  resident_summary[1u] = vec4<f32>(
    next_mass,
    next_mass - source_mass,
    source_momentum.x,
    source_momentum.y
  );
  resident_summary[2u] = vec4<f32>(
    source_momentum.z,
    next_momentum.x,
    next_momentum.y,
    next_momentum.z
  );
  resident_summary[3u] = vec4<f32>(
    momentum_delta.x,
    momentum_delta.y,
    momentum_delta.z,
    max_speed
  );
  resident_summary[4u] = vec4<f32>(
    max_displacement,
    min_volume_ratio_j,
    max_volume_ratio_j,
    1.0
  );
  resident_summary[5u] = vec4<f32>(
    phase_mass_solid,
    phase_mass_liquid,
    phase_mass_gas,
    phase_mass_plasma
  );
  resident_summary[6u] = vec4<f32>(
    temperature_mass_weighted_mean_k,
    min_temperature_k,
    max_temperature_k,
    thermal_ready_count
  );
  resident_summary[7u] = vec4<f32>(
    thermal_problem_count,
    finite_temperature_count,
    phase_mass_total,
    1.0
  );
  resident_summary[8u] = vec4<f32>(
    source_center_of_mass.x,
    source_center_of_mass.y,
    source_center_of_mass.z,
    next_center_of_mass.x
  );
  resident_summary[9u] = vec4<f32>(
    next_center_of_mass.y,
    next_center_of_mass.z,
    source_min.x,
    source_min.y
  );
  resident_summary[10u] = vec4<f32>(
    source_min.z,
    source_max.x,
    source_max.y,
    source_max.z
  );
  resident_summary[11u] = vec4<f32>(
    next_min.x,
    next_min.y,
    next_min.z,
    next_max.x
  );
  resident_summary[12u] = vec4<f32>(
    next_max.y,
    next_max.z,
    source_bounds_status,
    next_bounds_status
  );
  resident_summary[13u] = vec4<f32>(
    source_position_mass_total,
    next_position_mass_total,
    0.0,
    0.0
  );
  resident_summary[14u] = vec4<f32>(
    cohort_summary_status,
    f32(params.base_start_index),
    f32(params.base_end_index),
    f32(params.drop_start_index)
  );
  resident_summary[15u] = vec4<f32>(
    f32(params.drop_end_index),
    base_cohort_mass,
    base_cohort_center.x,
    base_cohort_center.y
  );
  resident_summary[16u] = vec4<f32>(
    base_cohort_center.z,
    base_cohort_min.x,
    base_cohort_min.y,
    base_cohort_min.z
  );
  resident_summary[17u] = vec4<f32>(
    base_cohort_max.x,
    base_cohort_max.y,
    base_cohort_max.z,
    base_cohort_max_speed
  );
  resident_summary[18u] = vec4<f32>(
    drop_cohort_mass,
    drop_cohort_center.x,
    drop_cohort_center.y,
    drop_cohort_center.z
  );
  resident_summary[19u] = vec4<f32>(
    drop_cohort_min.x,
    drop_cohort_min.y,
    drop_cohort_min.z,
    drop_cohort_max.x
  );
  resident_summary[20u] = vec4<f32>(
    drop_cohort_max.y,
    drop_cohort_max.z,
    drop_cohort_max_speed,
    0.0
  );
  resident_summary[21u] = vec4<f32>(
    h2o_gas_mass,
    h2o_gas_temperature_mass_weighted_mean_k,
    h2o_gas_phase_weight,
    h2o_gas_summary_status
  );
}
`;

export const mlsMpmResidentSummaryWgsl = mlsMpmResidentSummaryPartialsWgsl;

export const mlsMpmActiveGridDispatchFromSummaryWgsl = `
struct ActiveGridDispatchFromSummaryParams {
  grid_dim_x: u32,
  grid_dim_y: u32,
  grid_dim_z: u32,
  grid_shift: i32,
  grid_node_count: u32,
  workgroup_size: u32,
  safety_cells: u32,
  summary_stride_floats: u32,
  grid_spacing_m: f32,
  dt_s: f32,
  substep_count: u32,
  pad0: u32,
  gravity_m_per_s2: vec3<f32>,
  pad1: f32,
};

@group(0) @binding(0) var<storage, read> resident_summary: array<f32>;
@group(0) @binding(1) var<storage, read_write> dispatch_args: array<u32>;
@group(0) @binding(2) var<storage, read_write> dispatch_metadata: array<u32>;
@group(0) @binding(3) var<uniform> params: ActiveGridDispatchFromSummaryParams;

fn ag_clamp_i32(value: i32, lo: i32, hi: i32) -> i32 {
  return min(max(value, lo), hi);
}

fn ag_start_axis(bounds_min: f32, expansion_m: f32, dim: u32, dx: f32) -> u32 {
  let raw_node_min = i32(floor((bounds_min - expansion_m) / dx - 0.5)) - 1;
  return u32(ag_clamp_i32(raw_node_min + params.grid_shift, 0, i32(dim) - 1));
}

fn ag_end_axis(bounds_max: f32, expansion_m: f32, dim: u32, dx: f32, start: u32) -> u32 {
  let raw_node_max = i32(floor((bounds_max + expansion_m) / dx - 0.5)) + 3;
  return u32(ag_clamp_i32(raw_node_max + params.grid_shift, i32(start), i32(dim) - 1));
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }

  let dx = max(params.grid_spacing_m, 0.000001);
  let workgroup_size = max(params.workgroup_size, 1u);
  let full_grid_node_count = max(params.grid_node_count, 1u);
  let next_bounds_status = resident_summary[51u];
  let max_speed_m_per_s = max(resident_summary[15u], 0.0);
  let horizon_s = abs(params.dt_s) * f32(max(params.substep_count, 1u));
  let motion_m = vec3<f32>(
    max_speed_m_per_s * horizon_s + 0.5 * abs(params.gravity_m_per_s2.x) * horizon_s * horizon_s,
    max_speed_m_per_s * horizon_s + 0.5 * abs(params.gravity_m_per_s2.y) * horizon_s * horizon_s,
    max_speed_m_per_s * horizon_s + 0.5 * abs(params.gravity_m_per_s2.z) * horizon_s * horizon_s
  );
  let safety_margin_m = f32(max(params.safety_cells, 1u)) * dx;
  let expansion_m = motion_m + vec3<f32>(safety_margin_m);

  let next_min = vec3<f32>(resident_summary[44u], resident_summary[45u], resident_summary[46u]);
  let next_max = vec3<f32>(resident_summary[47u], resident_summary[48u], resident_summary[49u]);
  let start_x = ag_start_axis(next_min.x, expansion_m.x, params.grid_dim_x, dx);
  let start_y = ag_start_axis(next_min.y, expansion_m.y, params.grid_dim_y, dx);
  let start_z = ag_start_axis(next_min.z, expansion_m.z, params.grid_dim_z, dx);
  let end_x = ag_end_axis(next_max.x, expansion_m.x, params.grid_dim_x, dx, start_x);
  let end_y = ag_end_axis(next_max.y, expansion_m.y, params.grid_dim_y, dx, start_y);
  let end_z = ag_end_axis(next_max.z, expansion_m.z, params.grid_dim_z, dx, start_z);
  let count_x = max(1u, end_x - start_x + 1u);
  let count_y = max(1u, end_y - start_y + 1u);
  let count_z = max(1u, end_z - start_z + 1u);
  let active_node_count = count_x * count_y * count_z;
  let bounds_ready = next_bounds_status > 0.0;
  let use_active_grid = bounds_ready && active_node_count > 0u && active_node_count < full_grid_node_count;
  let dispatch_node_count = select(full_grid_node_count, active_node_count, use_active_grid);
  let workgroup_count_x = max(1u, (dispatch_node_count + workgroup_size - 1u) / workgroup_size);

  dispatch_args[0u] = workgroup_count_x;
  dispatch_args[1u] = 1u;
  dispatch_args[2u] = 1u;

  let status = select(select(2u, 3u, bounds_ready), 1u, use_active_grid);
  dispatch_metadata[0u] = status;
  dispatch_metadata[1u] = select(0u, 1u, use_active_grid);
  dispatch_metadata[2u] = full_grid_node_count;
  dispatch_metadata[3u] = dispatch_node_count;
  dispatch_metadata[4u] = start_x;
  dispatch_metadata[5u] = start_y;
  dispatch_metadata[6u] = start_z;
  dispatch_metadata[7u] = count_x;
  dispatch_metadata[8u] = count_y;
  dispatch_metadata[9u] = count_z;
  dispatch_metadata[10u] = end_x;
  dispatch_metadata[11u] = end_y;
  dispatch_metadata[12u] = end_z;
  dispatch_metadata[13u] = workgroup_count_x;
  dispatch_metadata[14u] = params.safety_cells;
  dispatch_metadata[15u] = select(0u, 1u, bounds_ready);
}
`;

