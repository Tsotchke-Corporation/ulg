// Extracted from wgsl.js (Gate 6 Phase D mechanical decomposition).

import { SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC, SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION } from './schroederSpatialMechanicsFieldView.js';


export const schroederLevelAssignmentWgsl = `
struct SchroederLevelParams {
  particle_count: u32,
  min_level: i32,
  max_level: i32,
  flags: u32,
  base_grid_spacing_m: f32,
  target_support_cells: f32,
  support_radius_scale: f32,
  chart_id: f32,
  min_support_radius_m: f32,
  max_support_radius_m: f32,
  fallback_support_radius_m: f32,
  hysteresis_band: f32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<f32>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<f32>;
@group(0) @binding(2) var<storage, read> mls_mpm_mechanics: array<f32>;
@group(0) @binding(3) var<storage, read_write> level_assignments: array<f32>;
@group(0) @binding(4) var<uniform> params: SchroederLevelParams;

const SCHROEDER_STATE_STRIDE: u32 = 8u;
const SCHROEDER_THERMO_STRIDE: u32 = 12u;
const SCHROEDER_MECHANICS_STRIDE: u32 = 32u;
const SCHROEDER_ASSIGNMENT_STRIDE: u32 = 16u;
const SCHROEDER_PI: f32 = 3.141592653589793;

fn ss_positive(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38 && value > 0.0;
}

fn ss_volume_radius(volume_m3: f32) -> f32 {
  if (!ss_positive(volume_m3)) {
    return 0.0;
  }
  return pow((3.0 * volume_m3) / (4.0 * SCHROEDER_PI), 0.3333333333333333);
}

fn ss_clamp_i32(value: i32, lo: i32, hi: i32) -> i32 {
  return min(max(value, lo), hi);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let state_offset = particle_index * SCHROEDER_STATE_STRIDE;
  let thermo_offset = particle_index * SCHROEDER_THERMO_STRIDE;
  let mechanics_offset = particle_index * SCHROEDER_MECHANICS_STRIDE;
  let assignment_offset = particle_index * SCHROEDER_ASSIGNMENT_STRIDE;

  let px = sph_state[state_offset + 0u];
  let py = sph_state[state_offset + 1u];
  let pz = sph_state[state_offset + 2u];
  let mass_kg = sph_state[state_offset + 3u];
  let material_id = sph_thermo[thermo_offset + 0u];
  let phase_id = sph_thermo[thermo_offset + 1u];
  let rest_density_kg_per_m3 = sph_thermo[thermo_offset + 3u];
  let smoothing_length_m = max(sph_thermo[thermo_offset + 8u], 0.0);
  let visual_radius_m = max(sph_thermo[thermo_offset + 11u], 0.0);
  let volume_ratio_j = mls_mpm_mechanics[mechanics_offset + 18u];
  let rest_volume_m3 = mls_mpm_mechanics[mechanics_offset + 19u];
  let mechanics_volume_m3 = rest_volume_m3 * volume_ratio_j;
  let constitutive_status = mls_mpm_mechanics[mechanics_offset + 21u];
  let eos_status = mls_mpm_mechanics[mechanics_offset + 27u];
  if (mass_kg == 0.0) {
    let inactive_level = params.min_level;
    let inactive_dx = max(params.base_grid_spacing_m * exp2(f32(inactive_level)), 0.000001);
    level_assignments[assignment_offset + 0u] = f32(inactive_level);
    level_assignments[assignment_offset + 1u] = inactive_dx;
    level_assignments[assignment_offset + 2u] = 0.0;
    level_assignments[assignment_offset + 3u] = 0.0;
    level_assignments[assignment_offset + 4u] = 0.0;
    level_assignments[assignment_offset + 5u] = 0.0;
    level_assignments[assignment_offset + 6u] = 0.0;
    level_assignments[assignment_offset + 7u] = rest_density_kg_per_m3;
    level_assignments[assignment_offset + 8u] = phase_id;
    level_assignments[assignment_offset + 9u] = material_id;
    // The base SS epoch currently requires every fixed-capacity source row
    // to carry a structurally ready status. Mechanics consumers separately
    // exclude zero-mass rows from their compact/field views.
    level_assignments[assignment_offset + 10u] = 1.0;
    level_assignments[assignment_offset + 11u] = max(params.hysteresis_band, 0.0);
    level_assignments[assignment_offset + 12u] = px;
    level_assignments[assignment_offset + 13u] = py;
    level_assignments[assignment_offset + 14u] = pz;
    level_assignments[assignment_offset + 15u] = params.chart_id;
    return;
  }
  let current_volume_authority_valid =
    ss_positive(mass_kg)
    && ss_positive(rest_density_kg_per_m3)
    && ss_positive(volume_ratio_j)
    && ss_positive(rest_volume_m3)
    && ss_positive(mechanics_volume_m3)
    && constitutive_status == 1.0
    && eos_status == 1.0;
  if (!current_volume_authority_valid) {
    let rejected_level = params.min_level;
    let rejected_dx = max(
      params.base_grid_spacing_m * exp2(f32(rejected_level)),
      0.000001
    );
    level_assignments[assignment_offset + 0u] = f32(rejected_level);
    level_assignments[assignment_offset + 1u] = rejected_dx;
    level_assignments[assignment_offset + 2u] = 0.0;
    level_assignments[assignment_offset + 3u] = 0.0;
    level_assignments[assignment_offset + 4u] = 0.0;
    level_assignments[assignment_offset + 5u] = 0.0;
    level_assignments[assignment_offset + 6u] = mass_kg;
    level_assignments[assignment_offset + 7u] = rest_density_kg_per_m3;
    level_assignments[assignment_offset + 8u] = phase_id;
    level_assignments[assignment_offset + 9u] = material_id;
    level_assignments[assignment_offset + 10u] = 0.0;
    level_assignments[assignment_offset + 11u] = max(params.hysteresis_band, 0.0);
    level_assignments[assignment_offset + 12u] = px;
    level_assignments[assignment_offset + 13u] = py;
    level_assignments[assignment_offset + 14u] = pz;
    level_assignments[assignment_offset + 15u] = params.chart_id;
    return;
  }
  let source_volume_m3 = mechanics_volume_m3;
  let represented_volume_m3 = mechanics_volume_m3;

  let physical_radius_m = ss_volume_radius(source_volume_m3);
  var support_radius_m = physical_radius_m * max(params.support_radius_scale, 0.0);
  var status = 1.0;
  if (!ss_positive(support_radius_m)) {
    // Render radius, smoothing metadata, and density-derived geometry are not
    // permitted to manufacture support for an invalid current-volume row.
    support_radius_m = 0.0;
    status = 0.0;
  }
  if (
    status > 0.0
    && ss_positive(params.min_support_radius_m)
    && support_radius_m < params.min_support_radius_m
  ) {
    support_radius_m = params.min_support_radius_m;
    status = status + 4.0;
  }
  if (
    status > 0.0
    && ss_positive(params.max_support_radius_m)
    && support_radius_m > params.max_support_radius_m
  ) {
    support_radius_m = params.max_support_radius_m;
    status = status + 8.0;
  }

  let base_dx = max(params.base_grid_spacing_m, 0.000001);
  let target_cells = max(params.target_support_cells, 1.0);
  let native_dx_unclamped = max(support_radius_m / target_cells, 0.000001);
  let raw_level = i32(round(log2(native_dx_unclamped / base_dx)));
  let level = ss_clamp_i32(raw_level, params.min_level, params.max_level);
  let native_dx = base_dx * exp2(f32(level));
  if (level != raw_level) {
    status = status + 16.0;
  }

  level_assignments[assignment_offset + 0u] = f32(level);
  level_assignments[assignment_offset + 1u] = native_dx;
  level_assignments[assignment_offset + 2u] = support_radius_m;
  level_assignments[assignment_offset + 3u] = represented_volume_m3;
  level_assignments[assignment_offset + 4u] = rest_volume_m3;
  level_assignments[assignment_offset + 5u] = source_volume_m3;
  level_assignments[assignment_offset + 6u] = mass_kg;
  level_assignments[assignment_offset + 7u] = rest_density_kg_per_m3;
  level_assignments[assignment_offset + 8u] = phase_id;
  level_assignments[assignment_offset + 9u] = material_id;
  level_assignments[assignment_offset + 10u] = status;
  level_assignments[assignment_offset + 11u] = max(params.hysteresis_band, 0.0);
  level_assignments[assignment_offset + 12u] = px;
  level_assignments[assignment_offset + 13u] = py;
  level_assignments[assignment_offset + 14u] = pz;
  level_assignments[assignment_offset + 15u] = params.chart_id;
}
`;

export const schroederActiveNodeListWgsl = `
struct SchroederActiveNodeParams {
  particle_count: u32,
  tile_cell_count: u32,
  flags: u32,
  pad0: u32,
  support_inflate_cells: f32,
  min_tile_spacing_m: f32,
  max_tile_spacing_m: f32,
  pad1: f32,
  phase_volume_level_update_row_count: u32,
  phase_volume_level_update_stride: u32,
  phase_volume_level_update_enabled: u32,
  phase_volume_level_update_index_enabled: u32,
  pad3: vec4<u32>,
};

@group(0) @binding(0) var<storage, read> level_assignments: array<f32>;
@group(0) @binding(1) var<storage, read_write> active_nodes: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederActiveNodeParams;
@group(0) @binding(3) var<storage, read> phase_volume_level_updates: array<f32>;
@group(0) @binding(4) var<storage, read_write> phase_volume_level_update_index: array<atomic<u32>>;

const SCHROEDER_ASSIGNMENT_STRIDE: u32 = 16u;
const SCHROEDER_ACTIVE_NODE_STRIDE: u32 = 16u;
const SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_STRIDE: u32 = 32u;

fn ss_active_positive(value: f32) -> bool {
  return value == value && value > 0.0;
}

fn ss_active_tile_spacing(native_dx: f32) -> f32 {
  var tile_spacing = max(native_dx, 0.000001) * f32(max(params.tile_cell_count, 1u));
  if (ss_active_positive(params.min_tile_spacing_m)) {
    tile_spacing = max(tile_spacing, params.min_tile_spacing_m);
  }
  if (ss_active_positive(params.max_tile_spacing_m)) {
    tile_spacing = min(tile_spacing, params.max_tile_spacing_m);
  }
  return max(tile_spacing, 0.000001);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let assignment_offset = particle_index * SCHROEDER_ASSIGNMENT_STRIDE;
  let node_offset = particle_index * SCHROEDER_ACTIVE_NODE_STRIDE;
  var level = level_assignments[assignment_offset + 0u];
  var native_dx = max(level_assignments[assignment_offset + 1u], 0.000001);
  var support_radius = max(level_assignments[assignment_offset + 2u], 0.0);
  var assignment_status = level_assignments[assignment_offset + 10u];
  let position = vec3<f32>(
    level_assignments[assignment_offset + 12u],
    level_assignments[assignment_offset + 13u],
    level_assignments[assignment_offset + 14u]
  );
  let chart_id = level_assignments[assignment_offset + 15u];
  var overlay_applied = false;
  var overlay_rejected = false;
  if (
    params.phase_volume_level_update_enabled != 0u
    && params.phase_volume_level_update_row_count > 0u
  ) {
    var update_row = particle_index;
    var update_row_available = particle_index < params.phase_volume_level_update_row_count;
    if (params.phase_volume_level_update_index_enabled != 0u) {
      let indexed_row = atomicLoad(&phase_volume_level_update_index[particle_index]);
      update_row = indexed_row;
      update_row_available = indexed_row < params.phase_volume_level_update_row_count;
    }
    if (!update_row_available) {
      overlay_rejected = true;
    } else {
    let update_stride = max(
      params.phase_volume_level_update_stride,
      SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_STRIDE
    );
    let update_offset = update_row * update_stride;
    let source_particle_index = u32(max(round(phase_volume_level_updates[update_offset + 0u]), 0.0));
    let target_level = phase_volume_level_updates[update_offset + 2u];
    let update_status = phase_volume_level_updates[update_offset + 3u];
    let target_support_radius = phase_volume_level_updates[update_offset + 5u];
    let admission_approved = phase_volume_level_updates[update_offset + 17u];
    let target_grid_spacing_m = phase_volume_level_updates[update_offset + 21u];
    if (
      source_particle_index == particle_index
      && update_status > 0.0
      && admission_approved > 0.0
    ) {
      let assignment_level = level;
      level = target_level;
      if (ss_active_positive(target_grid_spacing_m)) {
        native_dx = target_grid_spacing_m;
      } else {
        native_dx = max(native_dx * exp2(target_level - assignment_level), 0.000001);
      }
      if (ss_active_positive(target_support_radius)) {
        support_radius = target_support_radius;
      }
      assignment_status = max(assignment_status, 1.0);
      overlay_applied = true;
    } else {
      overlay_rejected = true;
    }
    }
  }
  let tile_spacing = ss_active_tile_spacing(native_dx);
  let support_inflation = max(params.support_inflate_cells, 0.0) * native_dx;
  let expanded_support = support_radius + support_inflation;
  let min_tile = floor((position - vec3<f32>(expanded_support)) / tile_spacing);
  let max_tile = floor((position + vec3<f32>(expanded_support)) / tile_spacing);
  var status = select(32.0, 1.0, assignment_status > 0.0 && support_radius >= 0.0);
  if (overlay_applied) {
    status = status + 64.0;
  }
  if (overlay_rejected) {
    status = status + 128.0;
  }

  active_nodes[node_offset + 0u] = level;
  active_nodes[node_offset + 1u] = min_tile.x;
  active_nodes[node_offset + 2u] = min_tile.y;
  active_nodes[node_offset + 3u] = min_tile.z;
  active_nodes[node_offset + 4u] = max_tile.x;
  active_nodes[node_offset + 5u] = max_tile.y;
  active_nodes[node_offset + 6u] = max_tile.z;
  active_nodes[node_offset + 7u] = tile_spacing;
  active_nodes[node_offset + 8u] = native_dx;
  active_nodes[node_offset + 9u] = support_radius;
  active_nodes[node_offset + 10u] = f32(particle_index);
  active_nodes[node_offset + 11u] = status;
  active_nodes[node_offset + 12u] = position.x;
  active_nodes[node_offset + 13u] = position.y;
  active_nodes[node_offset + 14u] = position.z;
  active_nodes[node_offset + 15u] = chart_id;
}
`;

export const schroederPhaseVolumeAssignmentOverlayIndexWgsl = `
struct SchroederPhaseVolumeAssignmentOverlayIndexParams {
  particle_count: u32,
  level_update_row_count: u32,
  level_update_stride: u32,
  missing_row: u32,
};

@group(0) @binding(0) var<storage, read> level_update_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> source_particle_index_rows: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: SchroederPhaseVolumeAssignmentOverlayIndexParams;

const SCHROEDER_PVAI_LEVEL_UPDATE_STRIDE: u32 = 32u;

@compute @workgroup_size(64)
fn clear_index(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  atomicStore(&source_particle_index_rows[particle_index], params.missing_row);
}

@compute @workgroup_size(64)
fn build_index(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.level_update_row_count) {
    return;
  }
  let stride = max(params.level_update_stride, SCHROEDER_PVAI_LEVEL_UPDATE_STRIDE);
  let offset = row_index * stride;
  let source_particle_index = u32(max(round(level_update_rows[offset + 0u]), 0.0));
  let status = level_update_rows[offset + 3u];
  let admission_approved = level_update_rows[offset + 17u];
  if (
    source_particle_index >= params.particle_count
    || status <= 0.0
    || admission_approved <= 0.0
  ) {
    return;
  }
  atomicMin(&source_particle_index_rows[source_particle_index], row_index);
}
`;

export const schroederActiveNodeIndexWgsl = `
struct SchroederActiveNodeIndexParams {
  active_node_count: u32,
  active_node_stride: u32,
  bucket_count: u32,
  bucket_slot_capacity: u32,
  bucket_slot_count: u32,
  node_slot_count: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
  pad4: u32,
  pad5: u32,
  pad6: u32,
  pad7: u32,
  pad8: u32,
};

@group(0) @binding(0) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(1) var<storage, read_write> bucket_counts: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> bucket_slots: array<u32>;
@group(0) @binding(3) var<storage, read_write> node_bucket_slots: array<u32>;
@group(0) @binding(4) var<storage, read_write> overflow_counters: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: SchroederActiveNodeIndexParams;

const SCHROEDER_ACTIVE_NODE_INDEX_SENTINEL: u32 = 0xffffffffu;
const SCHROEDER_ACTIVE_NODE_INDEX_STRIDE: u32 = 16u;

fn ss_active_index_hash_mix(value: u32, seed: u32) -> u32 {
  var hash = seed ^ (value + 0x9e3779b9u + (seed << 6u) + (seed >> 2u));
  hash = hash ^ (hash >> 16u);
  hash = hash * 0x7feb352du;
  hash = hash ^ (hash >> 15u);
  hash = hash * 0x846ca68bu;
  return hash ^ (hash >> 16u);
}

fn ss_active_index_i32_bits(value: f32) -> u32 {
  return bitcast<u32>(i32(round(value)));
}

fn ss_active_index_bucket(active_offset: u32) -> u32 {
  var hash = 0x811c9dc5u;
  hash = ss_active_index_hash_mix(ss_active_index_i32_bits(active_nodes[active_offset + 0u]), hash);
  hash = ss_active_index_hash_mix(ss_active_index_i32_bits(active_nodes[active_offset + 1u]), hash);
  hash = ss_active_index_hash_mix(ss_active_index_i32_bits(active_nodes[active_offset + 2u]), hash);
  hash = ss_active_index_hash_mix(ss_active_index_i32_bits(active_nodes[active_offset + 3u]), hash);
  hash = ss_active_index_hash_mix(ss_active_index_i32_bits(active_nodes[active_offset + 15u]), hash);
  return hash % max(params.bucket_count, 1u);
}

fn ss_active_index_ready(active_offset: u32) -> bool {
  let status = active_nodes[active_offset + 11u];
  return status > 0.0 && status < 32.0;
}

@compute @workgroup_size(64)
fn clearIndex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < params.bucket_count) {
    atomicStore(&bucket_counts[index], 0u);
  }
  if (index < params.bucket_slot_count) {
    bucket_slots[index] = SCHROEDER_ACTIVE_NODE_INDEX_SENTINEL;
  }
  if (index < params.node_slot_count) {
    node_bucket_slots[index] = SCHROEDER_ACTIVE_NODE_INDEX_SENTINEL;
  }
  if (index < 4u) {
    atomicStore(&overflow_counters[index], 0u);
  }
}

@compute @workgroup_size(64)
fn assignIndex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let active_index = global_id.x;
  if (active_index >= params.active_node_count) {
    return;
  }
  let active_stride = max(params.active_node_stride, SCHROEDER_ACTIVE_NODE_INDEX_STRIDE);
  let active_offset = active_index * active_stride;
  if (!ss_active_index_ready(active_offset)) {
    node_bucket_slots[active_index] = SCHROEDER_ACTIVE_NODE_INDEX_SENTINEL;
    return;
  }
  atomicAdd(&overflow_counters[1], 1u);
  let bucket_index = ss_active_index_bucket(active_offset);
  let slot_index = atomicAdd(&bucket_counts[bucket_index], 1u);
  if (slot_index >= params.bucket_slot_capacity) {
    atomicAdd(&overflow_counters[0], 1u);
    node_bucket_slots[active_index] = SCHROEDER_ACTIVE_NODE_INDEX_SENTINEL;
    return;
  }
  let absolute_slot = bucket_index * params.bucket_slot_capacity + slot_index;
  if (absolute_slot >= params.bucket_slot_count) {
    atomicAdd(&overflow_counters[0], 1u);
    node_bucket_slots[active_index] = SCHROEDER_ACTIVE_NODE_INDEX_SENTINEL;
    return;
  }
  bucket_slots[absolute_slot] = active_index;
  node_bucket_slots[active_index] = absolute_slot;
  atomicAdd(&overflow_counters[2], 1u);
}
`;

export const schroederActiveNodeSortedIndexWgsl = `
struct SchroederActiveNodeSortedIndexParams {
  active_node_count: u32,
  active_node_stride: u32,
  bucket_count: u32,
  bucket_range_offset_count: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
  pad4: u32,
  pad5: u32,
  pad6: u32,
  pad7: u32,
  pad8: u32,
  pad9: u32,
  pad10: u32,
};

@group(0) @binding(0) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(1) var<storage, read_write> bucket_counts: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> bucket_range_offsets: array<u32>;
@group(0) @binding(3) var<storage, read_write> bucket_cursors: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> sorted_active_indices: array<u32>;
@group(0) @binding(5) var<storage, read_write> diagnostic_counters: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> params: SchroederActiveNodeSortedIndexParams;

const SCHROEDER_ACTIVE_NODE_SORTED_INDEX_SENTINEL: u32 = 0xffffffffu;
const SCHROEDER_ACTIVE_NODE_SORTED_INDEX_STRIDE: u32 = 16u;
const SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_READY_COUNT: u32 = 0u;
const SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_SCATTER_COUNT: u32 = 1u;
const SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_INACTIVE_COUNT: u32 = 2u;
const SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_TOTAL_COUNT: u32 = 3u;

fn ss_sorted_index_hash_mix(value: u32, seed: u32) -> u32 {
  var hash = seed ^ (value + 0x9e3779b9u + (seed << 6u) + (seed >> 2u));
  hash = hash ^ (hash >> 16u);
  hash = hash * 0x7feb352du;
  hash = hash ^ (hash >> 15u);
  hash = hash * 0x846ca68bu;
  return hash ^ (hash >> 16u);
}

fn ss_sorted_index_i32_bits(value: f32) -> u32 {
  return bitcast<u32>(i32(round(value)));
}

fn ss_sorted_index_bucket(active_offset: u32) -> u32 {
  var hash = 0x811c9dc5u;
  hash = ss_sorted_index_hash_mix(ss_sorted_index_i32_bits(active_nodes[active_offset + 0u]), hash);
  hash = ss_sorted_index_hash_mix(ss_sorted_index_i32_bits(active_nodes[active_offset + 1u]), hash);
  hash = ss_sorted_index_hash_mix(ss_sorted_index_i32_bits(active_nodes[active_offset + 2u]), hash);
  hash = ss_sorted_index_hash_mix(ss_sorted_index_i32_bits(active_nodes[active_offset + 3u]), hash);
  hash = ss_sorted_index_hash_mix(ss_sorted_index_i32_bits(active_nodes[active_offset + 15u]), hash);
  return hash % max(params.bucket_count, 1u);
}

fn ss_sorted_index_ready(active_offset: u32) -> bool {
  let status = active_nodes[active_offset + 11u];
  return status > 0.0 && status < 32.0;
}

@compute @workgroup_size(64)
fn clearSortedIndex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < params.bucket_count) {
    atomicStore(&bucket_counts[index], 0u);
    atomicStore(&bucket_cursors[index], 0u);
  }
  if (index < params.bucket_range_offset_count) {
    bucket_range_offsets[index] = 0u;
  }
  if (index < params.active_node_count) {
    sorted_active_indices[index] = SCHROEDER_ACTIVE_NODE_SORTED_INDEX_SENTINEL;
  }
  if (index < 4u) {
    atomicStore(&diagnostic_counters[index], 0u);
  }
}

@compute @workgroup_size(64)
fn countSortedIndex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let active_index = global_id.x;
  if (active_index >= params.active_node_count) {
    return;
  }
  let active_stride = max(params.active_node_stride, SCHROEDER_ACTIVE_NODE_SORTED_INDEX_STRIDE);
  let active_offset = active_index * active_stride;
  if (!ss_sorted_index_ready(active_offset)) {
    atomicAdd(&diagnostic_counters[SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_INACTIVE_COUNT], 1u);
    return;
  }
  let bucket_index = ss_sorted_index_bucket(active_offset);
  atomicAdd(&bucket_counts[bucket_index], 1u);
  atomicAdd(&diagnostic_counters[SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_READY_COUNT], 1u);
}

@compute @workgroup_size(1)
fn prefixSortedIndex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) {
    return;
  }
  var running_total = 0u;
  var bucket_index = 0u;
  loop {
    if (bucket_index >= params.bucket_count) {
      break;
    }
    bucket_range_offsets[bucket_index] = running_total;
    atomicStore(&bucket_cursors[bucket_index], 0u);
    running_total = running_total + atomicLoad(&bucket_counts[bucket_index]);
    bucket_index = bucket_index + 1u;
  }
  if (params.bucket_range_offset_count > params.bucket_count) {
    bucket_range_offsets[params.bucket_count] = running_total;
  }
  atomicStore(&diagnostic_counters[SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_TOTAL_COUNT], running_total);
}

@compute @workgroup_size(64)
fn scatterSortedIndex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let active_index = global_id.x;
  if (active_index >= params.active_node_count) {
    return;
  }
  let active_stride = max(params.active_node_stride, SCHROEDER_ACTIVE_NODE_SORTED_INDEX_STRIDE);
  let active_offset = active_index * active_stride;
  if (!ss_sorted_index_ready(active_offset)) {
    return;
  }
  let bucket_index = ss_sorted_index_bucket(active_offset);
  let slot = atomicAdd(&bucket_cursors[bucket_index], 1u);
  let destination = bucket_range_offsets[bucket_index] + slot;
  if (destination < params.active_node_count) {
    sorted_active_indices[destination] = active_index;
    atomicAdd(&diagnostic_counters[SCHROEDER_ACTIVE_NODE_SORTED_DIAGNOSTIC_SCATTER_COUNT], 1u);
  }
}
`;

export const schroederLawQueueWgsl = `
struct SchroederLawQueueParams {
  active_node_count: u32,
  active_node_stride: u32,
  law_queue_stride: u32,
  flags: u32,
  enabled_law_mask: f32,
  candidate_budget: f32,
  queue_epoch: f32,
  state_family_id: f32,
};

@group(0) @binding(0) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(1) var<storage, read_write> law_queue_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederLawQueueParams;

const SCHROEDER_ACTIVE_NODE_STRIDE_FOR_LAW_QUEUE: u32 = 16u;
const SCHROEDER_LAW_QUEUE_STRIDE: u32 = 32u;
const SCHROEDER_LAW_REACTION_MASK: u32 = 1u;
const SCHROEDER_LAW_CONTACT_MASK: u32 = 2u;
const SCHROEDER_LAW_INTERFACE_MASK: u32 = 4u;

fn ss_law_queue_mask_enabled(mask: u32, bit: u32) -> bool {
  return (mask & bit) != 0u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.active_node_count) {
    return;
  }
  let active_stride = max(params.active_node_stride, SCHROEDER_ACTIVE_NODE_STRIDE_FOR_LAW_QUEUE);
  let queue_stride = max(params.law_queue_stride, SCHROEDER_LAW_QUEUE_STRIDE);
  let active_offset = row_index * active_stride;
  let queue_offset = row_index * queue_stride;
  let active_status = active_nodes[active_offset + 11u];
  let active_node_enabled = active_status > 0.0 && active_status < 32.0;
  let law_mask = u32(max(round(params.enabled_law_mask), 0.0));
  let reaction_enabled = active_node_enabled && ss_law_queue_mask_enabled(law_mask, SCHROEDER_LAW_REACTION_MASK);
  let contact_enabled = active_node_enabled && ss_law_queue_mask_enabled(law_mask, SCHROEDER_LAW_CONTACT_MASK);
  let interface_enabled = active_node_enabled && ss_law_queue_mask_enabled(law_mask, SCHROEDER_LAW_INTERFACE_MASK);
  let status = select(32.0, 1.0, active_node_enabled && law_mask != 0u);
  let tile_min = vec3<f32>(
    active_nodes[active_offset + 1u],
    active_nodes[active_offset + 2u],
    active_nodes[active_offset + 3u]
  );
  let tile_max = vec3<f32>(
    active_nodes[active_offset + 4u],
    active_nodes[active_offset + 5u],
    active_nodes[active_offset + 6u]
  );
  let tile_span = max(tile_max - tile_min + vec3<f32>(1.0), vec3<f32>(0.0));
  let tile_cell_estimate = tile_span.x * tile_span.y * tile_span.z;
  let candidate_budget = max(params.candidate_budget, 0.0);
  let local_law_enabled = reaction_enabled || contact_enabled || interface_enabled;
  let estimated_candidate_count = select(
    0.0,
    min(max(tile_cell_estimate, 1.0), candidate_budget),
    local_law_enabled && candidate_budget > 0.0
  );

  law_queue_rows[queue_offset + 0u] = active_nodes[active_offset + 10u];
  law_queue_rows[queue_offset + 1u] = active_nodes[active_offset + 0u];
  law_queue_rows[queue_offset + 2u] = active_nodes[active_offset + 15u];
  law_queue_rows[queue_offset + 3u] = status;
  law_queue_rows[queue_offset + 4u] = tile_min.x;
  law_queue_rows[queue_offset + 5u] = tile_min.y;
  law_queue_rows[queue_offset + 6u] = tile_min.z;
  law_queue_rows[queue_offset + 7u] = tile_max.x;
  law_queue_rows[queue_offset + 8u] = tile_max.y;
  law_queue_rows[queue_offset + 9u] = tile_max.z;
  law_queue_rows[queue_offset + 10u] = active_nodes[active_offset + 7u];
  law_queue_rows[queue_offset + 11u] = active_nodes[active_offset + 9u];
  law_queue_rows[queue_offset + 12u] = f32(law_mask);
  law_queue_rows[queue_offset + 13u] = select(0.0, 1.0, reaction_enabled);
  law_queue_rows[queue_offset + 14u] = select(0.0, 1.0, contact_enabled);
  law_queue_rows[queue_offset + 15u] = select(0.0, 1.0, interface_enabled);
  law_queue_rows[queue_offset + 16u] = 0.0;
  law_queue_rows[queue_offset + 17u] = select(0.0, 1.0, local_law_enabled);
  law_queue_rows[queue_offset + 18u] = 0.0;
  law_queue_rows[queue_offset + 19u] = select(0.0, 1.0, reaction_enabled);
  law_queue_rows[queue_offset + 20u] = candidate_budget;
  law_queue_rows[queue_offset + 21u] = estimated_candidate_count;
  law_queue_rows[queue_offset + 22u] = 1.0;
  law_queue_rows[queue_offset + 23u] = 1.0;
  law_queue_rows[queue_offset + 24u] = params.state_family_id;
  law_queue_rows[queue_offset + 25u] = select(0.0, 1.0, local_law_enabled);
  law_queue_rows[queue_offset + 26u] = active_status;
  law_queue_rows[queue_offset + 27u] = f32(row_index);
  law_queue_rows[queue_offset + 28u] = params.queue_epoch;
  law_queue_rows[queue_offset + 29u] = 0.0;
  law_queue_rows[queue_offset + 30u] = 0.0;
  law_queue_rows[queue_offset + 31u] = 0.0;
}
`;

export const schroederLawNeighborCandidateWgsl = `
struct SchroederLawNeighborParams {
  law_queue_count: u32,
  active_node_count: u32,
  particle_count: u32,
  law_queue_stride: u32,
  active_node_stride: u32,
  neighbor_stride: u32,
  state_stride: u32,
  candidate_budget: u32,
  enabled_law_mask: u32,
  flags: u32,
  source_span_stride: u32,
  active_node_index_enabled: u32,
  active_node_index_bucket_count: u32,
  active_node_index_bucket_slot_capacity: u32,
  active_node_index_bucket_slot_count: u32,
  active_node_sorted_index_enabled: u32,
  active_node_sorted_bucket_count: u32,
  active_node_sorted_bucket_range_offset_count: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> law_queue_rows: array<f32>;
@group(0) @binding(1) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(2) var<storage, read> sph_state_rows: array<f32>;
@group(0) @binding(3) var<storage, read_write> neighbor_candidate_rows: array<f32>;
@group(0) @binding(4) var<storage, read_write> source_candidate_span_rows: array<f32>;
@group(0) @binding(5) var<uniform> params: SchroederLawNeighborParams;
@group(0) @binding(6) var<storage, read> active_node_index_bucket_slots: array<u32>;
@group(0) @binding(7) var<storage, read_write> traversal_diagnostic_counters: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read> active_node_sorted_bucket_range_offsets: array<u32>;
@group(0) @binding(9) var<storage, read> active_node_sorted_active_indices: array<u32>;

const SCHROEDER_LAW_NEIGHBOR_QUEUE_STRIDE: u32 = 32u;
const SCHROEDER_LAW_NEIGHBOR_ACTIVE_NODE_STRIDE: u32 = 16u;
const SCHROEDER_LAW_NEIGHBOR_ROW_STRIDE: u32 = 16u;
const SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_STRIDE: u32 = 4u;
const SCHROEDER_LAW_NEIGHBOR_STATE_STRIDE: u32 = 8u;
const SCHROEDER_LAW_NEIGHBOR_STATUS_READY: f32 = 1.0;
const SCHROEDER_LAW_NEIGHBOR_STATUS_INACTIVE: f32 = 32.0;
const SCHROEDER_LAW_NEIGHBOR_REACTION_MASK: u32 = 1u;
const SCHROEDER_LAW_NEIGHBOR_CONTACT_MASK: u32 = 2u;
const SCHROEDER_LAW_NEIGHBOR_INTERFACE_MASK: u32 = 4u;
const SCHROEDER_LAW_NEIGHBOR_ACTIVE_INDEX_SENTINEL: u32 = 0xffffffffu;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT: u32 = 8u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_CANDIDATE_INVOCATIONS: u32 = 0u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_ATTEMPTS: u32 = 1u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_SELECTED: u32 = 2u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_EXACT_FALLBACK_SCANS: u32 = 3u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_EXACT_FALLBACK_SELECTED: u32 = 4u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_INACTIVE_CANDIDATES: u32 = 5u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_PRESSURE: u32 = 6u;
const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_SOURCE_SPANS: u32 = 7u;

fn ss_neighbor_diagnostic_add(counter_index: u32, value: u32) {
  if (counter_index < SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT && value > 0u) {
    atomicAdd(&traversal_diagnostic_counters[counter_index], value);
  }
}

fn ss_neighbor_state_pos_mass(particle_index: u32, state_stride: u32) -> vec4<f32> {
  let offset = particle_index * state_stride;
  return vec4<f32>(
    sph_state_rows[offset + 0u],
    sph_state_rows[offset + 1u],
    sph_state_rows[offset + 2u],
    sph_state_rows[offset + 3u]
  );
}

fn ss_neighbor_active_node_ready(active_offset: u32) -> bool {
  let active_status = active_nodes[active_offset + 11u];
  let source_particle = active_nodes[active_offset + 10u];
  return active_status > 0.0 && active_status < 32.0 && source_particle >= 0.0;
}

fn ss_neighbor_tiles_overlap(queue_offset: u32, active_offset: u32) -> bool {
  let same_level = abs(active_nodes[active_offset + 0u] - law_queue_rows[queue_offset + 1u]) < 0.5;
  let same_chart = abs(active_nodes[active_offset + 15u] - law_queue_rows[queue_offset + 2u]) < 0.5;
  let queue_min = vec3<f32>(
    law_queue_rows[queue_offset + 4u],
    law_queue_rows[queue_offset + 5u],
    law_queue_rows[queue_offset + 6u]
  );
  let queue_max = vec3<f32>(
    law_queue_rows[queue_offset + 7u],
    law_queue_rows[queue_offset + 8u],
    law_queue_rows[queue_offset + 9u]
  );
  let active_min = vec3<f32>(
    active_nodes[active_offset + 1u],
    active_nodes[active_offset + 2u],
    active_nodes[active_offset + 3u]
  );
  let active_max = vec3<f32>(
    active_nodes[active_offset + 4u],
    active_nodes[active_offset + 5u],
    active_nodes[active_offset + 6u]
  );
  let overlap = queue_min.x <= active_max.x && queue_max.x >= active_min.x
    && queue_min.y <= active_max.y && queue_max.y >= active_min.y
    && queue_min.z <= active_max.z && queue_max.z >= active_min.z;
  return same_level && same_chart && overlap;
}

fn ss_neighbor_active_index_enabled() -> bool {
  return params.active_node_index_enabled != 0u
    && params.active_node_index_bucket_count > 0u
    && params.active_node_index_bucket_slot_capacity > 0u
    && params.active_node_index_bucket_slot_count > 0u;
}

fn ss_neighbor_active_index_hash_mix(value: u32, seed: u32) -> u32 {
  var hash = seed ^ (value + 0x9e3779b9u + (seed << 6u) + (seed >> 2u));
  hash = hash ^ (hash >> 16u);
  hash = hash * 0x7feb352du;
  hash = hash ^ (hash >> 15u);
  hash = hash * 0x846ca68bu;
  return hash ^ (hash >> 16u);
}

fn ss_neighbor_active_index_i32_bits(value: f32) -> u32 {
  return bitcast<u32>(i32(round(value)));
}

fn ss_neighbor_active_index_bucket(queue_offset: u32) -> u32 {
  var hash = 0x811c9dc5u;
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 1u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 4u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 5u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 6u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 2u]), hash);
  return hash % max(params.active_node_index_bucket_count, 1u);
}

fn ss_neighbor_sorted_index_enabled() -> bool {
  return params.active_node_sorted_index_enabled != 0u
    && params.active_node_sorted_bucket_count > 0u
    && params.active_node_sorted_bucket_range_offset_count > params.active_node_sorted_bucket_count;
}

fn ss_neighbor_sorted_index_bucket(queue_offset: u32) -> u32 {
  var hash = 0x811c9dc5u;
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 1u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 4u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 5u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 6u]), hash);
  hash = ss_neighbor_active_index_hash_mix(ss_neighbor_active_index_i32_bits(law_queue_rows[queue_offset + 2u]), hash);
  return hash % max(params.active_node_sorted_bucket_count, 1u);
}

fn ss_neighbor_sorted_range_start(queue_offset: u32) -> u32 {
  if (!ss_neighbor_sorted_index_enabled()) {
    return 0u;
  }
  let bucket_index = ss_neighbor_sorted_index_bucket(queue_offset);
  return active_node_sorted_bucket_range_offsets[bucket_index];
}

fn ss_neighbor_sorted_range_end(queue_offset: u32) -> u32 {
  if (!ss_neighbor_sorted_index_enabled()) {
    return 0u;
  }
  let bucket_index = ss_neighbor_sorted_index_bucket(queue_offset);
  return active_node_sorted_bucket_range_offsets[min(bucket_index + 1u, params.active_node_sorted_bucket_range_offset_count - 1u)];
}

fn ss_neighbor_sorted_index_contains(queue_offset: u32, active_index: u32) -> bool {
  if (!ss_neighbor_sorted_index_enabled()) {
    return false;
  }
  var cursor = ss_neighbor_sorted_range_start(queue_offset);
  let end = min(ss_neighbor_sorted_range_end(queue_offset), params.active_node_count);
  loop {
    if (cursor >= end) {
      break;
    }
    if (active_node_sorted_active_indices[cursor] == active_index) {
      return true;
    }
    cursor = cursor + 1u;
  }
  return false;
}

fn ss_neighbor_active_index_slot(queue_offset: u32, bucket_slot_index: u32) -> u32 {
  if (!ss_neighbor_active_index_enabled() || bucket_slot_index >= params.active_node_index_bucket_slot_capacity) {
    return SCHROEDER_LAW_NEIGHBOR_ACTIVE_INDEX_SENTINEL;
  }
  let bucket_index = ss_neighbor_active_index_bucket(queue_offset);
  let absolute_slot = bucket_index * params.active_node_index_bucket_slot_capacity + bucket_slot_index;
  if (absolute_slot >= params.active_node_index_bucket_slot_count) {
    return SCHROEDER_LAW_NEIGHBOR_ACTIVE_INDEX_SENTINEL;
  }
  return active_node_index_bucket_slots[absolute_slot];
}

fn ss_neighbor_active_index_contains(queue_offset: u32, active_index: u32) -> bool {
  if (!ss_neighbor_active_index_enabled()) {
    return false;
  }
  var bucket_slot_index = 0u;
  loop {
    if (bucket_slot_index >= params.active_node_index_bucket_slot_capacity) {
      break;
    }
    if (ss_neighbor_active_index_slot(queue_offset, bucket_slot_index) == active_index) {
      return true;
    }
    bucket_slot_index = bucket_slot_index + 1u;
  }
  return false;
}

fn ss_neighbor_active_index_bucket_full(queue_offset: u32) -> bool {
  if (!ss_neighbor_active_index_enabled()) {
    return false;
  }
  var occupied_count = 0u;
  var bucket_slot_index = 0u;
  loop {
    if (bucket_slot_index >= params.active_node_index_bucket_slot_capacity) {
      break;
    }
    let active_index = ss_neighbor_active_index_slot(queue_offset, bucket_slot_index);
    if (active_index == SCHROEDER_LAW_NEIGHBOR_ACTIVE_INDEX_SENTINEL) {
      return false;
    }
    occupied_count = occupied_count + 1u;
    bucket_slot_index = bucket_slot_index + 1u;
  }
  return occupied_count >= params.active_node_index_bucket_slot_capacity;
}

fn ss_neighbor_active_index_match_count(queue_offset: u32, source_active_index: u32, active_stride: u32) -> u32 {
  if (!ss_neighbor_active_index_enabled()) {
    return 0u;
  }
  var matched_count = 0u;
  var bucket_slot_index = 0u;
  loop {
    if (bucket_slot_index >= params.active_node_index_bucket_slot_capacity) {
      break;
    }
    let active_index = ss_neighbor_active_index_slot(queue_offset, bucket_slot_index);
    if (active_index < params.active_node_count && active_index != source_active_index) {
      let active_offset = active_index * active_stride;
      if (ss_neighbor_active_node_ready(active_offset) && ss_neighbor_tiles_overlap(queue_offset, active_offset)) {
        matched_count = matched_count + 1u;
      }
    }
    bucket_slot_index = bucket_slot_index + 1u;
  }
  return matched_count;
}

fn ss_neighbor_select_active_index_match(
  queue_offset: u32,
  source_active_index: u32,
  active_stride: u32,
  candidate_slot: u32
) -> u32 {
  if (!ss_neighbor_active_index_enabled()) {
    return params.active_node_count;
  }
  var matched_count = 0u;
  var bucket_slot_index = 0u;
  loop {
    if (bucket_slot_index >= params.active_node_index_bucket_slot_capacity) {
      break;
    }
    let active_index = ss_neighbor_active_index_slot(queue_offset, bucket_slot_index);
    if (active_index < params.active_node_count && active_index != source_active_index) {
      let active_offset = active_index * active_stride;
      if (ss_neighbor_active_node_ready(active_offset) && ss_neighbor_tiles_overlap(queue_offset, active_offset)) {
        if (matched_count == candidate_slot) {
          return active_index;
        }
        matched_count = matched_count + 1u;
      }
    }
    bucket_slot_index = bucket_slot_index + 1u;
  }
  return params.active_node_count;
}

fn ss_neighbor_sorted_index_match_count(queue_offset: u32, source_active_index: u32, active_stride: u32) -> u32 {
  if (!ss_neighbor_sorted_index_enabled()) {
    return 0u;
  }
  var matched_count = 0u;
  var cursor = ss_neighbor_sorted_range_start(queue_offset);
  let end = min(ss_neighbor_sorted_range_end(queue_offset), params.active_node_count);
  loop {
    if (cursor >= end) {
      break;
    }
    let active_index = active_node_sorted_active_indices[cursor];
    if (active_index < params.active_node_count && active_index != source_active_index) {
      let active_offset = active_index * active_stride;
      if (ss_neighbor_active_node_ready(active_offset) && ss_neighbor_tiles_overlap(queue_offset, active_offset)) {
        matched_count = matched_count + 1u;
      }
    }
    cursor = cursor + 1u;
  }
  return matched_count;
}

fn ss_neighbor_select_sorted_index_match(
  queue_offset: u32,
  source_active_index: u32,
  active_stride: u32,
  candidate_slot: u32
) -> u32 {
  if (!ss_neighbor_sorted_index_enabled()) {
    return params.active_node_count;
  }
  var matched_count = 0u;
  var cursor = ss_neighbor_sorted_range_start(queue_offset);
  let end = min(ss_neighbor_sorted_range_end(queue_offset), params.active_node_count);
  loop {
    if (cursor >= end) {
      break;
    }
    let active_index = active_node_sorted_active_indices[cursor];
    if (active_index < params.active_node_count && active_index != source_active_index) {
      let active_offset = active_index * active_stride;
      if (ss_neighbor_active_node_ready(active_offset) && ss_neighbor_tiles_overlap(queue_offset, active_offset)) {
        if (matched_count == candidate_slot) {
          return active_index;
        }
        matched_count = matched_count + 1u;
      }
    }
    cursor = cursor + 1u;
  }
  return params.active_node_count;
}

fn ss_neighbor_write_inactive(row_offset: u32, source_index: f32, queue_row_index: u32, queue_epoch: f32) {
  ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_INACTIVE_CANDIDATES, 1u);
  neighbor_candidate_rows[row_offset + 0u] = source_index;
  neighbor_candidate_rows[row_offset + 1u] = -1.0;
  neighbor_candidate_rows[row_offset + 2u] = 0.0;
  neighbor_candidate_rows[row_offset + 3u] = SCHROEDER_LAW_NEIGHBOR_STATUS_INACTIVE;
  neighbor_candidate_rows[row_offset + 4u] = 0.0;
  neighbor_candidate_rows[row_offset + 5u] = 0.0;
  neighbor_candidate_rows[row_offset + 6u] = 0.0;
  neighbor_candidate_rows[row_offset + 7u] = 0.0;
  neighbor_candidate_rows[row_offset + 8u] = 0.0;
  neighbor_candidate_rows[row_offset + 9u] = 0.0;
  neighbor_candidate_rows[row_offset + 10u] = 0.0;
  neighbor_candidate_rows[row_offset + 11u] = f32(queue_row_index);
  neighbor_candidate_rows[row_offset + 12u] = 0.0;
  neighbor_candidate_rows[row_offset + 13u] = 0.0;
  neighbor_candidate_rows[row_offset + 14u] = 0.0;
  neighbor_candidate_rows[row_offset + 15u] = queue_epoch;
}

fn ss_neighbor_write_source_span(source_index: u32, candidate_start: u32, candidate_count: u32, status: f32) {
  if (source_index >= params.particle_count) {
    return;
  }
  let source_span_stride = max(params.source_span_stride, SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_STRIDE);
  let span_offset = source_index * source_span_stride;
  source_candidate_span_rows[span_offset + 0u] = f32(source_index);
  source_candidate_span_rows[span_offset + 1u] = f32(candidate_start);
  source_candidate_span_rows[span_offset + 2u] = f32(candidate_count);
  source_candidate_span_rows[span_offset + 3u] = status;
  ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_SOURCE_SPANS, 1u);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate_index = global_id.x;
  let candidate_budget = max(params.candidate_budget, 1u);
  let candidate_count = params.law_queue_count * candidate_budget;
  if (candidate_index >= candidate_count) {
    return;
  }
  ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_CANDIDATE_INVOCATIONS, 1u);
  let queue_row_index = candidate_index / candidate_budget;
  let candidate_slot = candidate_index - queue_row_index * candidate_budget;
  let queue_stride = max(params.law_queue_stride, SCHROEDER_LAW_NEIGHBOR_QUEUE_STRIDE);
  let active_stride = max(params.active_node_stride, SCHROEDER_LAW_NEIGHBOR_ACTIVE_NODE_STRIDE);
  let neighbor_stride = max(params.neighbor_stride, SCHROEDER_LAW_NEIGHBOR_ROW_STRIDE);
  let state_stride = max(params.state_stride, SCHROEDER_LAW_NEIGHBOR_STATE_STRIDE);
  let candidate_start = queue_row_index * candidate_budget;
  let queue_offset = queue_row_index * queue_stride;
  let row_offset = candidate_index * neighbor_stride;
  let source_index_f = law_queue_rows[queue_offset + 0u];
  let queue_epoch = law_queue_rows[queue_offset + 28u];

  if (params.particle_count == 0u || params.active_node_count == 0u || queue_row_index >= params.law_queue_count) {
    ss_neighbor_write_inactive(row_offset, source_index_f, queue_row_index, queue_epoch);
    return;
  }

  let source_index = u32(max(round(source_index_f), 0.0));
  if (source_index >= params.particle_count) {
    ss_neighbor_write_inactive(row_offset, source_index_f, queue_row_index, queue_epoch);
    return;
  }

  let queue_status = law_queue_rows[queue_offset + 3u];
  let queue_enabled = queue_status > 0.0 && queue_status < 32.0;
  let row_law_mask = u32(max(round(law_queue_rows[queue_offset + 12u]), 0.0));
  let enabled_law_mask = row_law_mask & params.enabled_law_mask;
  let reaction_enabled = (enabled_law_mask & SCHROEDER_LAW_NEIGHBOR_REACTION_MASK) != 0u
    && law_queue_rows[queue_offset + 13u] > 0.5;
  let contact_enabled = (enabled_law_mask & SCHROEDER_LAW_NEIGHBOR_CONTACT_MASK) != 0u
    && law_queue_rows[queue_offset + 14u] > 0.5;
  let interface_enabled = (enabled_law_mask & SCHROEDER_LAW_NEIGHBOR_INTERFACE_MASK) != 0u
    && law_queue_rows[queue_offset + 15u] > 0.5;
  let local_law_enabled = reaction_enabled || contact_enabled || interface_enabled;
  if (candidate_slot == 0u) {
    let span_status = select(
      SCHROEDER_LAW_NEIGHBOR_STATUS_INACTIVE,
      SCHROEDER_LAW_NEIGHBOR_STATUS_READY,
      queue_enabled && local_law_enabled
    );
    ss_neighbor_write_source_span(source_index, candidate_start, candidate_budget, span_status);
  }
  if (!queue_enabled || !local_law_enabled) {
    ss_neighbor_write_inactive(row_offset, source_index_f, queue_row_index, queue_epoch);
    return;
  }

  var source_active_index = u32(max(round(law_queue_rows[queue_offset + 27u]), 0.0));
  if (source_active_index >= params.active_node_count) {
    source_active_index = min(queue_row_index, params.active_node_count - 1u);
  }
  var selected_active_index = params.active_node_count;
  var indexed_match_count = 0u;
  if (ss_neighbor_sorted_index_enabled()) {
    ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_ATTEMPTS, 1u);
    selected_active_index = ss_neighbor_select_sorted_index_match(
      queue_offset,
      source_active_index,
      active_stride,
      candidate_slot
    );
    if (selected_active_index < params.active_node_count) {
      ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_SELECTED, 1u);
    }
    if (selected_active_index >= params.active_node_count) {
      indexed_match_count = ss_neighbor_sorted_index_match_count(queue_offset, source_active_index, active_stride);
    }
  } else if (ss_neighbor_active_index_enabled()) {
    ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_ATTEMPTS, 1u);
    if (candidate_slot == 0u && ss_neighbor_active_index_bucket_full(queue_offset)) {
      ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_PRESSURE, 1u);
    }
    selected_active_index = ss_neighbor_select_active_index_match(
      queue_offset,
      source_active_index,
      active_stride,
      candidate_slot
    );
    if (selected_active_index < params.active_node_count) {
      ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_BUCKET_SELECTED, 1u);
    }
    if (selected_active_index >= params.active_node_count) {
      indexed_match_count = ss_neighbor_active_index_match_count(queue_offset, source_active_index, active_stride);
    }
  }
  var fallback_target_slot = candidate_slot;
  if (candidate_slot >= indexed_match_count) {
    fallback_target_slot = candidate_slot - indexed_match_count;
  }
  var matched_count = 0u;
  var scan_step = 0u;
  if (selected_active_index >= params.active_node_count) {
    ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_EXACT_FALLBACK_SCANS, 1u);
    loop {
      if (scan_step >= params.active_node_count) {
        break;
      }
      let active_index = (source_active_index + 1u + scan_step) % params.active_node_count;
      if (
        active_index != source_active_index
        && !ss_neighbor_sorted_index_contains(queue_offset, active_index)
        && !ss_neighbor_active_index_contains(queue_offset, active_index)
      ) {
        let active_offset = active_index * active_stride;
        if (ss_neighbor_active_node_ready(active_offset) && ss_neighbor_tiles_overlap(queue_offset, active_offset)) {
          if (matched_count == fallback_target_slot) {
            selected_active_index = active_index;
            ss_neighbor_diagnostic_add(SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_EXACT_FALLBACK_SELECTED, 1u);
            break;
          }
          matched_count = matched_count + 1u;
        }
      }
      scan_step = scan_step + 1u;
    }
  }
  if (selected_active_index >= params.active_node_count) {
    ss_neighbor_write_inactive(row_offset, source_index_f, queue_row_index, queue_epoch);
    return;
  }
  let selected_active_offset = selected_active_index * active_stride;
  let neighbor_index = u32(max(round(active_nodes[selected_active_offset + 10u]), 0.0));
  if (neighbor_index >= params.particle_count || neighbor_index == source_index) {
    ss_neighbor_write_inactive(row_offset, source_index_f, queue_row_index, queue_epoch);
    return;
  }
  let source_state = ss_neighbor_state_pos_mass(source_index, state_stride);
  let neighbor_state = ss_neighbor_state_pos_mass(neighbor_index, state_stride);
  let support_radius = max(max(law_queue_rows[queue_offset + 11u], active_nodes[selected_active_offset + 9u]), 0.000001);
  let delta = neighbor_state.xyz - source_state.xyz;
  let distance_m = length(delta);
  let within_support = distance_m <= support_radius;
  let masses_ready = source_state.w > 0.0 && neighbor_state.w > 0.0;
  if (!within_support || !masses_ready) {
    ss_neighbor_write_inactive(row_offset, source_index_f, queue_row_index, queue_epoch);
    return;
  }

  neighbor_candidate_rows[row_offset + 0u] = f32(source_index);
  neighbor_candidate_rows[row_offset + 1u] = f32(neighbor_index);
  neighbor_candidate_rows[row_offset + 2u] = f32(enabled_law_mask);
  neighbor_candidate_rows[row_offset + 3u] = SCHROEDER_LAW_NEIGHBOR_STATUS_READY;
  neighbor_candidate_rows[row_offset + 4u] = law_queue_rows[queue_offset + 1u];
  neighbor_candidate_rows[row_offset + 5u] = active_nodes[selected_active_offset + 0u];
  neighbor_candidate_rows[row_offset + 6u] = law_queue_rows[queue_offset + 2u];
  neighbor_candidate_rows[row_offset + 7u] = active_nodes[selected_active_offset + 15u];
  neighbor_candidate_rows[row_offset + 8u] = distance_m;
  neighbor_candidate_rows[row_offset + 9u] = support_radius;
  neighbor_candidate_rows[row_offset + 10u] = max(0.0, 1.0 - distance_m / support_radius);
  neighbor_candidate_rows[row_offset + 11u] = f32(queue_row_index);
  neighbor_candidate_rows[row_offset + 12u] = law_queue_rows[queue_offset + 16u];
  neighbor_candidate_rows[row_offset + 13u] = 0.0;
  neighbor_candidate_rows[row_offset + 14u] = select(0.0, 1.0, reaction_enabled)
    + select(0.0, 2.0, contact_enabled)
    + select(0.0, 4.0, interface_enabled)
    + 8.0;
  neighbor_candidate_rows[row_offset + 15u] = queue_epoch;
}
`;

export const schroederCrossLevelCouplingWgsl = `
struct SchroederCrossLevelParams {
  particle_count: u32,
  max_level: i32,
  parent_level_delta: i32,
  flags: u32,
  base_grid_spacing_m: f32,
  coupling_halo_cells: f32,
  min_coupling_radius_m: f32,
  max_coupling_radius_m: f32,
  tile_cell_count: u32,
  pad0: u32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> level_assignments: array<f32>;
@group(0) @binding(1) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(2) var<storage, read_write> cross_level_couplings: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederCrossLevelParams;

const SCHROEDER_ASSIGNMENT_STRIDE: u32 = 16u;
const SCHROEDER_ACTIVE_NODE_STRIDE: u32 = 16u;
const SCHROEDER_CROSS_LEVEL_STRIDE: u32 = 16u;

fn ss_cross_positive(value: f32) -> bool {
  return value == value && value > 0.0;
}

fn ss_cross_clamp_radius(radius: f32) -> f32 {
  var clamped = max(radius, 0.0);
  if (ss_cross_positive(params.min_coupling_radius_m)) {
    clamped = max(clamped, params.min_coupling_radius_m);
  }
  if (ss_cross_positive(params.max_coupling_radius_m)) {
    clamped = min(clamped, params.max_coupling_radius_m);
  }
  return clamped;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let assignment_offset = particle_index * SCHROEDER_ASSIGNMENT_STRIDE;
  let node_offset = particle_index * SCHROEDER_ACTIVE_NODE_STRIDE;
  let coupling_offset = particle_index * SCHROEDER_CROSS_LEVEL_STRIDE;

  let child_level = i32(round(level_assignments[assignment_offset + 0u]));
  let child_dx = max(level_assignments[assignment_offset + 1u], 0.000001);
  let support_radius = max(level_assignments[assignment_offset + 2u], 0.0);
  let represented_volume_m3 = max(level_assignments[assignment_offset + 3u], 0.0);
  let mass_kg = max(level_assignments[assignment_offset + 6u], 0.0);
  let assignment_status = level_assignments[assignment_offset + 10u];
  let position = vec3<f32>(
    level_assignments[assignment_offset + 12u],
    level_assignments[assignment_offset + 13u],
    level_assignments[assignment_offset + 14u]
  );
  let chart_id = level_assignments[assignment_offset + 15u];
  let active_status = active_nodes[node_offset + 11u];

  let requested_delta = max(params.parent_level_delta, 1);
  let unclamped_parent_level = child_level + requested_delta;
  let parent_level = min(unclamped_parent_level, params.max_level);
  let level_delta = parent_level - child_level;
  let base_dx = max(params.base_grid_spacing_m, 0.000001);
  let parent_dx = base_dx * exp2(f32(parent_level));
  let parent_tile_spacing = max(parent_dx, 0.000001) * f32(max(params.tile_cell_count, 1u));
  let halo_radius = max(params.coupling_halo_cells, 0.0) * max(child_dx, parent_dx);
  let coupling_radius = ss_cross_clamp_radius(support_radius + halo_radius);
  let parent_cell = floor(position / max(parent_dx, 0.000001));
  var status = select(32.0, 1.0, assignment_status > 0.0 && active_status > 0.0 && child_dx > 0.0 && parent_dx > 0.0);
  if (parent_level == child_level) {
    status = status + 64.0;
  }

  cross_level_couplings[coupling_offset + 0u] = f32(particle_index);
  cross_level_couplings[coupling_offset + 1u] = f32(child_level);
  cross_level_couplings[coupling_offset + 2u] = f32(parent_level);
  cross_level_couplings[coupling_offset + 3u] = f32(level_delta);
  cross_level_couplings[coupling_offset + 4u] = child_dx;
  cross_level_couplings[coupling_offset + 5u] = parent_dx;
  cross_level_couplings[coupling_offset + 6u] = support_radius;
  cross_level_couplings[coupling_offset + 7u] = coupling_radius;
  cross_level_couplings[coupling_offset + 8u] = parent_cell.x;
  cross_level_couplings[coupling_offset + 9u] = parent_cell.y;
  cross_level_couplings[coupling_offset + 10u] = parent_cell.z;
  cross_level_couplings[coupling_offset + 11u] = parent_tile_spacing;
  cross_level_couplings[coupling_offset + 12u] = mass_kg;
  cross_level_couplings[coupling_offset + 13u] = represented_volume_m3;
  cross_level_couplings[coupling_offset + 14u] = status;
  cross_level_couplings[coupling_offset + 15u] = chart_id;
}
`;

export const schroederConservationSummaryWgsl = `
struct SchroederConservationSummaryParams {
  candidate_count: u32,
  cross_level_stride: u32,
  summary_stride: u32,
  flags: u32,
};

@group(0) @binding(0) var<storage, read> cross_level_couplings: array<f32>;
@group(0) @binding(1) var<storage, read_write> summary_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederConservationSummaryParams;

const SCHROEDER_SUMMARY_WORKGROUP_SIZE: u32 = 64u;
const SCHROEDER_DEFAULT_CROSS_LEVEL_STRIDE: u32 = 16u;
const SCHROEDER_DEFAULT_SUMMARY_STRIDE: u32 = 16u;

var<workgroup> wg_candidate_count: array<f32, 64>;
var<workgroup> wg_active_count: array<f32, 64>;
var<workgroup> wg_blocked_count: array<f32, 64>;
var<workgroup> wg_same_level_count: array<f32, 64>;
var<workgroup> wg_source_mass: array<f32, 64>;
var<workgroup> wg_restricted_mass: array<f32, 64>;
var<workgroup> wg_source_volume: array<f32, 64>;
var<workgroup> wg_restricted_volume: array<f32, 64>;
var<workgroup> wg_max_mass_residual: array<f32, 64>;
var<workgroup> wg_max_volume_residual: array<f32, 64>;
var<workgroup> wg_bad_weight_count: array<f32, 64>;
var<workgroup> wg_missing_parent_child_count: array<f32, 64>;

@compute @workgroup_size(64)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let particle_index = global_id.x;
  let local_index = local_id.x;
  let cross_stride = max(params.cross_level_stride, SCHROEDER_DEFAULT_CROSS_LEVEL_STRIDE);

  var candidate_count = 0.0;
  var active_count = 0.0;
  var blocked_count = 0.0;
  var same_level_count = 0.0;
  var source_mass = 0.0;
  var restricted_mass = 0.0;
  var source_volume = 0.0;
  var restricted_volume = 0.0;
  var max_mass_residual = 0.0;
  var max_volume_residual = 0.0;
  var bad_weight_count = 0.0;
  var missing_parent_child_count = 0.0;

  if (particle_index < params.candidate_count) {
    let offset = particle_index * cross_stride;
    let level_delta = cross_level_couplings[offset + 3u];
    let mass_kg = max(cross_level_couplings[offset + 12u], 0.0);
    let represented_volume_m3 = max(cross_level_couplings[offset + 13u], 0.0);
    let status = cross_level_couplings[offset + 14u];
    let active_candidate = select(0.0, 1.0, status > 0.0 && status < 32.0 && level_delta > 0.0);
    let blocked = select(0.0, 1.0, status >= 32.0 && status < 64.0);
    let same_level = select(0.0, 1.0, status >= 64.0 || level_delta <= 0.0);

    candidate_count = 1.0;
    active_count = active_candidate;
    blocked_count = blocked;
    same_level_count = same_level;
    source_mass = mass_kg;
    restricted_mass = mass_kg * active_candidate;
    source_volume = represented_volume_m3;
    restricted_volume = represented_volume_m3 * active_candidate;
    max_mass_residual = abs(source_mass - restricted_mass);
    max_volume_residual = abs(source_volume - restricted_volume);
    missing_parent_child_count = blocked;
  }

  wg_candidate_count[local_index] = candidate_count;
  wg_active_count[local_index] = active_count;
  wg_blocked_count[local_index] = blocked_count;
  wg_same_level_count[local_index] = same_level_count;
  wg_source_mass[local_index] = source_mass;
  wg_restricted_mass[local_index] = restricted_mass;
  wg_source_volume[local_index] = source_volume;
  wg_restricted_volume[local_index] = restricted_volume;
  wg_max_mass_residual[local_index] = max_mass_residual;
  wg_max_volume_residual[local_index] = max_volume_residual;
  wg_bad_weight_count[local_index] = bad_weight_count;
  wg_missing_parent_child_count[local_index] = missing_parent_child_count;
  workgroupBarrier();

  if (local_index == 0u) {
    var sum_candidate_count = 0.0;
    var sum_active_count = 0.0;
    var sum_blocked_count = 0.0;
    var sum_same_level_count = 0.0;
    var sum_source_mass = 0.0;
    var sum_restricted_mass = 0.0;
    var sum_source_volume = 0.0;
    var sum_restricted_volume = 0.0;
    var max_abs_mass_residual = 0.0;
    var max_abs_volume_residual = 0.0;
    var sum_bad_weight_count = 0.0;
    var sum_missing_parent_child_count = 0.0;
    for (var index = 0u; index < SCHROEDER_SUMMARY_WORKGROUP_SIZE; index = index + 1u) {
      sum_candidate_count = sum_candidate_count + wg_candidate_count[index];
      sum_active_count = sum_active_count + wg_active_count[index];
      sum_blocked_count = sum_blocked_count + wg_blocked_count[index];
      sum_same_level_count = sum_same_level_count + wg_same_level_count[index];
      sum_source_mass = sum_source_mass + wg_source_mass[index];
      sum_restricted_mass = sum_restricted_mass + wg_restricted_mass[index];
      sum_source_volume = sum_source_volume + wg_source_volume[index];
      sum_restricted_volume = sum_restricted_volume + wg_restricted_volume[index];
      max_abs_mass_residual = max(max_abs_mass_residual, wg_max_mass_residual[index]);
      max_abs_volume_residual = max(max_abs_volume_residual, wg_max_volume_residual[index]);
      sum_bad_weight_count = sum_bad_weight_count + wg_bad_weight_count[index];
      sum_missing_parent_child_count = sum_missing_parent_child_count + wg_missing_parent_child_count[index];
    }
    let summary_stride = max(params.summary_stride, SCHROEDER_DEFAULT_SUMMARY_STRIDE);
    let summary_offset = workgroup_id.x * summary_stride;
    let mass_residual = sum_source_mass - sum_restricted_mass;
    let volume_residual = sum_source_volume - sum_restricted_volume;
    summary_rows[summary_offset + 0u] = sum_candidate_count;
    summary_rows[summary_offset + 1u] = sum_active_count;
    summary_rows[summary_offset + 2u] = sum_blocked_count;
    summary_rows[summary_offset + 3u] = sum_same_level_count;
    summary_rows[summary_offset + 4u] = sum_source_mass;
    summary_rows[summary_offset + 5u] = sum_restricted_mass;
    summary_rows[summary_offset + 6u] = mass_residual;
    summary_rows[summary_offset + 7u] = sum_source_volume;
    summary_rows[summary_offset + 8u] = sum_restricted_volume;
    summary_rows[summary_offset + 9u] = volume_residual;
    summary_rows[summary_offset + 10u] = max_abs_mass_residual;
    summary_rows[summary_offset + 11u] = max_abs_volume_residual;
    summary_rows[summary_offset + 12u] = sum_bad_weight_count;
    summary_rows[summary_offset + 13u] = sum_missing_parent_child_count;
    summary_rows[summary_offset + 14u] = select(0.0, 1.0, sum_candidate_count > 0.0);
    summary_rows[summary_offset + 15u] = 0.0;
  }
}
`;

export const schroederCrossLevelTransferWgsl = `
struct SchroederCrossLevelTransferParams {
  candidate_count: u32,
  cross_level_stride: u32,
  state_stride: u32,
  transfer_stride: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> cross_level_couplings: array<f32>;
@group(0) @binding(1) var<storage, read> sph_state: array<f32>;
@group(0) @binding(2) var<storage, read_write> transfer_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederCrossLevelTransferParams;

const SCHROEDER_DEFAULT_CROSS_LEVEL_TRANSFER_STRIDE: u32 = 24u;
const SCHROEDER_DEFAULT_CROSS_LEVEL_STRIDE_FOR_TRANSFER: u32 = 16u;
const SCHROEDER_DEFAULT_SPH_STATE_STRIDE_FOR_TRANSFER: u32 = 8u;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate_index = global_id.x;
  if (candidate_index >= params.candidate_count) {
    return;
  }

  let cross_stride = max(params.cross_level_stride, SCHROEDER_DEFAULT_CROSS_LEVEL_STRIDE_FOR_TRANSFER);
  let state_stride = max(params.state_stride, SCHROEDER_DEFAULT_SPH_STATE_STRIDE_FOR_TRANSFER);
  let transfer_stride = max(params.transfer_stride, SCHROEDER_DEFAULT_CROSS_LEVEL_TRANSFER_STRIDE);
  let cross_offset = candidate_index * cross_stride;
  let transfer_offset = candidate_index * transfer_stride;

  let source_particle_index = u32(max(cross_level_couplings[cross_offset + 0u], 0.0));
  let state_offset = source_particle_index * state_stride;
  let child_level = cross_level_couplings[cross_offset + 1u];
  let parent_level = cross_level_couplings[cross_offset + 2u];
  let level_delta = cross_level_couplings[cross_offset + 3u];
  let parent_cell = vec3<f32>(
    cross_level_couplings[cross_offset + 8u],
    cross_level_couplings[cross_offset + 9u],
    cross_level_couplings[cross_offset + 10u]
  );
  let source_mass_kg = max(cross_level_couplings[cross_offset + 12u], 0.0);
  let source_volume_m3 = max(cross_level_couplings[cross_offset + 13u], 0.0);
  let candidate_status = cross_level_couplings[cross_offset + 14u];
  let chart_id = cross_level_couplings[cross_offset + 15u];
  let velocity = vec3<f32>(
    sph_state[state_offset + 4u],
    sph_state[state_offset + 5u],
    sph_state[state_offset + 6u]
  );
  let specific_internal_energy = sph_state[state_offset + 7u];
  let transfer_weight = select(0.0, 1.0, candidate_status > 0.0 && candidate_status < 32.0 && level_delta > 0.0);
  let transfer_mass_kg = source_mass_kg * transfer_weight;
  let transfer_volume_m3 = source_volume_m3 * transfer_weight;
  let momentum = velocity * transfer_mass_kg;
  let internal_energy_j = specific_internal_energy * transfer_mass_kg;
  let transfer_status = select(32.0, 1.0, transfer_weight > 0.0);

  transfer_rows[transfer_offset + 0u] = f32(source_particle_index);
  transfer_rows[transfer_offset + 1u] = child_level;
  transfer_rows[transfer_offset + 2u] = parent_level;
  transfer_rows[transfer_offset + 3u] = level_delta;
  transfer_rows[transfer_offset + 4u] = parent_cell.x;
  transfer_rows[transfer_offset + 5u] = parent_cell.y;
  transfer_rows[transfer_offset + 6u] = parent_cell.z;
  transfer_rows[transfer_offset + 7u] = chart_id;
  transfer_rows[transfer_offset + 8u] = source_mass_kg;
  transfer_rows[transfer_offset + 9u] = transfer_mass_kg;
  transfer_rows[transfer_offset + 10u] = source_mass_kg - transfer_mass_kg;
  transfer_rows[transfer_offset + 11u] = source_volume_m3;
  transfer_rows[transfer_offset + 12u] = transfer_volume_m3;
  transfer_rows[transfer_offset + 13u] = source_volume_m3 - transfer_volume_m3;
  transfer_rows[transfer_offset + 14u] = momentum.x;
  transfer_rows[transfer_offset + 15u] = momentum.y;
  transfer_rows[transfer_offset + 16u] = momentum.z;
  transfer_rows[transfer_offset + 17u] = internal_energy_j;
  transfer_rows[transfer_offset + 18u] = velocity.x;
  transfer_rows[transfer_offset + 19u] = velocity.y;
  transfer_rows[transfer_offset + 20u] = velocity.z;
  transfer_rows[transfer_offset + 21u] = specific_internal_energy;
  transfer_rows[transfer_offset + 22u] = transfer_weight;
  transfer_rows[transfer_offset + 23u] = transfer_status;
}
`;

export const schroederCrossLevelStateDeltaWgsl = `
struct SchroederCrossLevelStateDeltaParams {
  candidate_count: u32,
  transfer_stride: u32,
  state_delta_stride: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
};

@group(0) @binding(0) var<storage, read> transfer_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> state_delta_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederCrossLevelStateDeltaParams;

const SCHROEDER_DEFAULT_TRANSFER_STRIDE_FOR_DELTA: u32 = 24u;
const SCHROEDER_DEFAULT_STATE_DELTA_STRIDE: u32 = 32u;

fn ss_delta_target_key(parent_cell: vec3<f32>, chart_id: f32, parent_level: f32) -> f32 {
  return chart_id * 268435456.0
    + parent_level * 16777216.0
    + parent_cell.z * 65536.0
    + parent_cell.y * 256.0
    + parent_cell.x;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate_index = global_id.x;
  if (candidate_index >= params.candidate_count) {
    return;
  }

  let transfer_stride = max(params.transfer_stride, SCHROEDER_DEFAULT_TRANSFER_STRIDE_FOR_DELTA);
  let state_delta_stride = max(params.state_delta_stride, SCHROEDER_DEFAULT_STATE_DELTA_STRIDE);
  let transfer_offset = candidate_index * transfer_stride;
  let state_delta_offset = candidate_index * state_delta_stride;

  let source_particle_index = transfer_rows[transfer_offset + 0u];
  let child_level = transfer_rows[transfer_offset + 1u];
  let parent_level = transfer_rows[transfer_offset + 2u];
  let level_delta = transfer_rows[transfer_offset + 3u];
  let parent_cell = vec3<f32>(
    transfer_rows[transfer_offset + 4u],
    transfer_rows[transfer_offset + 5u],
    transfer_rows[transfer_offset + 6u]
  );
  let chart_id = transfer_rows[transfer_offset + 7u];
  let transfer_mass_kg = transfer_rows[transfer_offset + 9u];
  let transfer_volume_m3 = transfer_rows[transfer_offset + 12u];
  let momentum = vec3<f32>(
    transfer_rows[transfer_offset + 14u],
    transfer_rows[transfer_offset + 15u],
    transfer_rows[transfer_offset + 16u]
  );
  let internal_energy_j = transfer_rows[transfer_offset + 17u];
  let transfer_weight = transfer_rows[transfer_offset + 22u];
  let transfer_status = transfer_rows[transfer_offset + 23u];
  let active_transfer = select(0.0, 1.0, transfer_status > 0.0 && transfer_status < 32.0 && transfer_weight > 0.0);
  let applied_mass_kg = transfer_mass_kg * active_transfer;
  let applied_volume_m3 = transfer_volume_m3 * active_transfer;
  let applied_momentum = momentum * active_transfer;
  let applied_internal_energy_j = internal_energy_j * active_transfer;
  let source_mass_delta_kg = -applied_mass_kg;
  let target_mass_delta_kg = applied_mass_kg;
  let source_volume_delta_m3 = -applied_volume_m3;
  let target_volume_delta_m3 = applied_volume_m3;
  let source_momentum_delta = -applied_momentum;
  let target_momentum_delta = applied_momentum;
  let source_internal_energy_delta_j = -applied_internal_energy_j;
  let target_internal_energy_delta_j = applied_internal_energy_j;
  let state_delta_status = select(32.0, 1.0, active_transfer > 0.0);

  state_delta_rows[state_delta_offset + 0u] = source_particle_index;
  state_delta_rows[state_delta_offset + 1u] = child_level;
  state_delta_rows[state_delta_offset + 2u] = parent_level;
  state_delta_rows[state_delta_offset + 3u] = level_delta;
  state_delta_rows[state_delta_offset + 4u] = parent_cell.x;
  state_delta_rows[state_delta_offset + 5u] = parent_cell.y;
  state_delta_rows[state_delta_offset + 6u] = parent_cell.z;
  state_delta_rows[state_delta_offset + 7u] = chart_id;
  state_delta_rows[state_delta_offset + 8u] = source_mass_delta_kg;
  state_delta_rows[state_delta_offset + 9u] = target_mass_delta_kg;
  state_delta_rows[state_delta_offset + 10u] = source_mass_delta_kg + target_mass_delta_kg;
  state_delta_rows[state_delta_offset + 11u] = source_volume_delta_m3;
  state_delta_rows[state_delta_offset + 12u] = target_volume_delta_m3;
  state_delta_rows[state_delta_offset + 13u] = source_volume_delta_m3 + target_volume_delta_m3;
  state_delta_rows[state_delta_offset + 14u] = source_momentum_delta.x;
  state_delta_rows[state_delta_offset + 15u] = source_momentum_delta.y;
  state_delta_rows[state_delta_offset + 16u] = source_momentum_delta.z;
  state_delta_rows[state_delta_offset + 17u] = target_momentum_delta.x;
  state_delta_rows[state_delta_offset + 18u] = target_momentum_delta.y;
  state_delta_rows[state_delta_offset + 19u] = target_momentum_delta.z;
  state_delta_rows[state_delta_offset + 20u] = source_momentum_delta.x + target_momentum_delta.x;
  state_delta_rows[state_delta_offset + 21u] = source_momentum_delta.y + target_momentum_delta.y;
  state_delta_rows[state_delta_offset + 22u] = source_momentum_delta.z + target_momentum_delta.z;
  state_delta_rows[state_delta_offset + 23u] = source_internal_energy_delta_j;
  state_delta_rows[state_delta_offset + 24u] = target_internal_energy_delta_j;
  state_delta_rows[state_delta_offset + 25u] = source_internal_energy_delta_j + target_internal_energy_delta_j;
  state_delta_rows[state_delta_offset + 26u] = transfer_weight * active_transfer;
  state_delta_rows[state_delta_offset + 27u] = ss_delta_target_key(parent_cell, chart_id, parent_level);
  state_delta_rows[state_delta_offset + 28u] = state_delta_status;
  state_delta_rows[state_delta_offset + 29u] = 1.0;
  state_delta_rows[state_delta_offset + 30u] = 1.0;
  state_delta_rows[state_delta_offset + 31u] = 0.0;
}
`;

export const schroederCrossLevelStateDeltaMergeWgsl = `
struct SchroederCrossLevelStateDeltaMergeParams {
  candidate_count: u32,
  state_delta_stride: u32,
  merge_stride: u32,
  flags: u32,
  merge_epoch: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> state_delta_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> merge_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederCrossLevelStateDeltaMergeParams;

const SCHROEDER_DEFAULT_STATE_DELTA_STRIDE_FOR_MERGE: u32 = 32u;
const SCHROEDER_DEFAULT_STATE_DELTA_MERGE_STRIDE: u32 = 32u;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate_index = global_id.x;
  if (candidate_index >= params.candidate_count) {
    return;
  }

  let state_delta_stride = max(params.state_delta_stride, SCHROEDER_DEFAULT_STATE_DELTA_STRIDE_FOR_MERGE);
  let merge_stride = max(params.merge_stride, SCHROEDER_DEFAULT_STATE_DELTA_MERGE_STRIDE);
  let state_delta_offset = candidate_index * state_delta_stride;
  let merge_offset = candidate_index * merge_stride;

  for (var column = 0u; column < 30u; column = column + 1u) {
    merge_rows[merge_offset + column] = state_delta_rows[state_delta_offset + column];
  }
  merge_rows[merge_offset + 30u] = 1.0;
  merge_rows[merge_offset + 31u] = params.merge_epoch;
}
`;

export const schroederHierarchyAggregateWgsl = `
struct SchroederHierarchyAggregateParams {
  row_count: u32,
  merge_stride: u32,
  aggregate_stride: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
};

@group(0) @binding(0) var<storage, read> merge_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> aggregate_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederHierarchyAggregateParams;

const SCHROEDER_DEFAULT_STATE_DELTA_MERGE_STRIDE_FOR_AGGREGATE: u32 = 32u;
const SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE: u32 = 32u;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.row_count) {
    return;
  }

  let merge_stride = max(params.merge_stride, SCHROEDER_DEFAULT_STATE_DELTA_MERGE_STRIDE_FOR_AGGREGATE);
  let aggregate_stride = max(params.aggregate_stride, SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE);
  let merge_offset = row_index * merge_stride;
  let aggregate_offset = row_index * aggregate_stride;

  let source_particle_index = merge_rows[merge_offset + 0u];
  let child_level = merge_rows[merge_offset + 1u];
  let parent_level = merge_rows[merge_offset + 2u];
  let level_delta = merge_rows[merge_offset + 3u];
  let parent_cell = vec3<f32>(
    merge_rows[merge_offset + 4u],
    merge_rows[merge_offset + 5u],
    merge_rows[merge_offset + 6u]
  );
  let chart_id = merge_rows[merge_offset + 7u];
  let source_mass_delta_kg = merge_rows[merge_offset + 8u];
  let target_mass_delta_kg = merge_rows[merge_offset + 9u];
  let mass_residual_kg = merge_rows[merge_offset + 10u];
  let source_volume_delta_m3 = merge_rows[merge_offset + 11u];
  let target_volume_delta_m3 = merge_rows[merge_offset + 12u];
  let volume_residual_m3 = merge_rows[merge_offset + 13u];
  let target_momentum = vec3<f32>(
    merge_rows[merge_offset + 17u],
    merge_rows[merge_offset + 18u],
    merge_rows[merge_offset + 19u]
  );
  let momentum_residual = vec3<f32>(
    merge_rows[merge_offset + 20u],
    merge_rows[merge_offset + 21u],
    merge_rows[merge_offset + 22u]
  );
  let target_internal_energy_j = merge_rows[merge_offset + 24u];
  let internal_energy_residual_j = merge_rows[merge_offset + 25u];
  let transfer_weight = merge_rows[merge_offset + 26u];
  let target_aggregate_key = merge_rows[merge_offset + 27u];
  let merge_status = merge_rows[merge_offset + 28u];
  let state_family_id = merge_rows[merge_offset + 29u];
  let admission_approved = merge_rows[merge_offset + 30u];
  let merge_epoch = merge_rows[merge_offset + 31u];
  let active_row = select(0.0, 1.0, merge_status > 0.0 && merge_status < 32.0 && admission_approved > 0.0);
  let aggregate_status = select(32.0, 1.0, active_row > 0.0);

  aggregate_rows[aggregate_offset + 0u] = target_aggregate_key;
  aggregate_rows[aggregate_offset + 1u] = parent_level;
  aggregate_rows[aggregate_offset + 2u] = chart_id;
  aggregate_rows[aggregate_offset + 3u] = aggregate_status;
  aggregate_rows[aggregate_offset + 4u] = parent_cell.x;
  aggregate_rows[aggregate_offset + 5u] = parent_cell.y;
  aggregate_rows[aggregate_offset + 6u] = parent_cell.z;
  aggregate_rows[aggregate_offset + 7u] = state_family_id;
  aggregate_rows[aggregate_offset + 8u] = target_mass_delta_kg * active_row;
  aggregate_rows[aggregate_offset + 9u] = target_volume_delta_m3 * active_row;
  aggregate_rows[aggregate_offset + 10u] = target_momentum.x * active_row;
  aggregate_rows[aggregate_offset + 11u] = target_momentum.y * active_row;
  aggregate_rows[aggregate_offset + 12u] = target_momentum.z * active_row;
  aggregate_rows[aggregate_offset + 13u] = target_internal_energy_j * active_row;
  aggregate_rows[aggregate_offset + 14u] = source_particle_index;
  aggregate_rows[aggregate_offset + 15u] = transfer_weight * active_row;
  aggregate_rows[aggregate_offset + 16u] = source_mass_delta_kg * active_row;
  aggregate_rows[aggregate_offset + 17u] = target_mass_delta_kg * active_row;
  aggregate_rows[aggregate_offset + 18u] = mass_residual_kg;
  aggregate_rows[aggregate_offset + 19u] = source_volume_delta_m3 * active_row;
  aggregate_rows[aggregate_offset + 20u] = target_volume_delta_m3 * active_row;
  aggregate_rows[aggregate_offset + 21u] = volume_residual_m3;
  aggregate_rows[aggregate_offset + 22u] = momentum_residual.x;
  aggregate_rows[aggregate_offset + 23u] = momentum_residual.y;
  aggregate_rows[aggregate_offset + 24u] = momentum_residual.z;
  aggregate_rows[aggregate_offset + 25u] = internal_energy_residual_j;
  aggregate_rows[aggregate_offset + 26u] = merge_epoch;
  aggregate_rows[aggregate_offset + 27u] = child_level;
  aggregate_rows[aggregate_offset + 28u] = level_delta;
  aggregate_rows[aggregate_offset + 29u] = 1.0;
  aggregate_rows[aggregate_offset + 30u] = admission_approved;
  aggregate_rows[aggregate_offset + 31u] = 0.0;
}
`;

export const schroederPhaseVolumeTargetAggregateWgsl = `
struct SchroederPhaseVolumeTargetAggregateParams {
  particle_count: u32,
  assignment_stride: u32,
  aggregate_stride: u32,
  flags: u32,
  min_level: i32,
  max_level: i32,
  pad0: u32,
  pad1: u32,
  base_grid_spacing_m: f32,
  target_support_cells: f32,
  support_radius_scale: f32,
  volume_expand_threshold: f32,
  gas_phase_id: f32,
  aggregate_epoch: f32,
  state_family_id: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> level_assignments: array<f32>;
@group(0) @binding(1) var<storage, read_write> aggregate_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederPhaseVolumeTargetAggregateParams;
@group(0) @binding(3) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> particle_identity: array<u32>;

const SCHROEDER_PVTA_ASSIGNMENT_STRIDE: u32 = 16u;
const SCHROEDER_PVTA_AGGREGATE_STRIDE: u32 = 32u;
const SCHROEDER_PVTA_STATE_VEC4_STRIDE: u32 = 2u;
const SCHROEDER_PVTA_THERMO_VEC4_STRIDE: u32 = 3u;
const SCHROEDER_PVTA_PI: f32 = 3.141592653589793;

// Mass-weighted temperature contribution (mass * T). Under the uniform
// heat capacity of a coherent same-material cell this is the thermal
// energy proxy the reducer sums, so a merged child's temperature becomes
// the mass-weighted cell average. pad2 carries the thermo vec4 stride;
// zero disables the binding.
fn ss_pvta_mass_temperature(particle_index: u32, mass_kg: f32) -> f32 {
  if (params.pad2 <= 0.0) {
    return 0.0;
  }
  let thermo_stride = max(u32(params.pad2), SCHROEDER_PVTA_THERMO_VEC4_STRIDE);
  let temperature_k = sph_thermo[particle_index * thermo_stride].z;
  return mass_kg * max(temperature_k, 0.0);
}

// Per-particle momentum for the contribution row so the reduced aggregate
// node carries true cell momentum for momentum-conserving merges. pad0
// carries the sph-state vec4 stride; zero disables the state binding
// (legacy callers keep zero-momentum contributions).
fn ss_pvta_particle_momentum(particle_index: u32, mass_kg: f32) -> vec3<f32> {
  if (params.pad0 == 0u) {
    return vec3<f32>(0.0, 0.0, 0.0);
  }
  let state_stride = max(params.pad0, SCHROEDER_PVTA_STATE_VEC4_STRIDE);
  let velocity = sph_state[particle_index * state_stride + 1u].xyz;
  return mass_kg * velocity;
}

fn ss_pvta_positive(value: f32) -> bool {
  return value == value && value > 0.0;
}

fn ss_pvta_clamp_i32(value: i32, lo: i32, hi: i32) -> i32 {
  return min(max(value, lo), hi);
}

fn ss_pvta_volume_radius(volume_m3: f32) -> f32 {
  if (!ss_pvta_positive(volume_m3)) {
    return 0.0;
  }
  return pow((3.0 * volume_m3) / (4.0 * SCHROEDER_PVTA_PI), 0.3333333333333333);
}

fn ss_pvta_level_from_support(support_radius_m: f32) -> i32 {
  let base_dx = max(params.base_grid_spacing_m, 0.000001);
  let target_cells = max(params.target_support_cells, 1.0);
  let native_dx_unclamped = max(support_radius_m / target_cells, 0.000001);
  let raw_level = i32(round(log2(native_dx_unclamped / base_dx)));
  return ss_pvta_clamp_i32(raw_level, params.min_level, params.max_level);
}

fn ss_pvta_write_empty(aggregate_offset: u32, assignment_offset: u32, particle_index: u32, status: f32) {
  aggregate_rows[aggregate_offset + 0u] = f32(particle_identity[particle_index]);
  aggregate_rows[aggregate_offset + 1u] = level_assignments[assignment_offset + 0u];
  aggregate_rows[aggregate_offset + 2u] = level_assignments[assignment_offset + 15u];
  aggregate_rows[aggregate_offset + 3u] = status;
  aggregate_rows[aggregate_offset + 4u] = 0.0;
  aggregate_rows[aggregate_offset + 5u] = 0.0;
  aggregate_rows[aggregate_offset + 6u] = 0.0;
  aggregate_rows[aggregate_offset + 7u] = params.state_family_id;
  for (var column = 8u; column < SCHROEDER_PVTA_AGGREGATE_STRIDE; column = column + 1u) {
    aggregate_rows[aggregate_offset + column] = 0.0;
  }
  aggregate_rows[aggregate_offset + 14u] = f32(particle_index);
  aggregate_rows[aggregate_offset + 26u] = params.aggregate_epoch;
  aggregate_rows[aggregate_offset + 27u] = level_assignments[assignment_offset + 0u];
  aggregate_rows[aggregate_offset + 29u] = 2.0;
  aggregate_rows[aggregate_offset + 30u] = 1.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let assignment_stride = max(params.assignment_stride, SCHROEDER_PVTA_ASSIGNMENT_STRIDE);
  let aggregate_stride = max(params.aggregate_stride, SCHROEDER_PVTA_AGGREGATE_STRIDE);
  let assignment_offset = particle_index * assignment_stride;
  let aggregate_offset = particle_index * aggregate_stride;

  let source_level = level_assignments[assignment_offset + 0u];
  let source_support = level_assignments[assignment_offset + 2u];
  let represented_volume = level_assignments[assignment_offset + 3u];
  let rest_volume = level_assignments[assignment_offset + 4u];
  let source_volume = level_assignments[assignment_offset + 5u];
  let mass_kg = level_assignments[assignment_offset + 6u];
  let phase_id = level_assignments[assignment_offset + 8u];
  let position = vec3<f32>(
    level_assignments[assignment_offset + 12u],
    level_assignments[assignment_offset + 13u],
    level_assignments[assignment_offset + 14u]
  );
  let chart_id = level_assignments[assignment_offset + 15u];

  if (!ss_pvta_positive(represented_volume) || !ss_pvta_positive(rest_volume) || !ss_pvta_positive(mass_kg)) {
    ss_pvta_write_empty(aggregate_offset, assignment_offset, particle_index, 32.0);
    return;
  }

  let volume_ratio = represented_volume / max(rest_volume, 0.000001);
  let gas_phase = abs(phase_id - params.gas_phase_id) < 0.5;
  let liquid_phase = abs(phase_id - 2.0) < 0.5;
  let phase_expanded = gas_phase && volume_ratio >= max(params.volume_expand_threshold, 1.0);
  // Fixed phase-slot children have distinct immutable identities and J=1.
  // Their opt-in coarsening domain is material + phase sign + source level/chart/cell:
  // gas uses +material_id and liquid uses -material_id (exact 24-bit f32 integers,
  // strictly disjoint so liquid and gas carriers never alias in the same cell).
  let physical_gas_grouping = (params.flags & 1u) != 0u;
  let physical_liquid_grouping = (params.flags & 2u) != 0u;
  let physical_fluid_grouping = physical_gas_grouping || physical_liquid_grouping;
  let physical_fluid_eligible = (physical_gas_grouping && gas_phase) || (physical_liquid_grouping && liquid_phase);
  if (select(!phase_expanded, !physical_fluid_eligible, physical_fluid_grouping)) {
    ss_pvta_write_empty(aggregate_offset, assignment_offset, particle_index, 32.0);
    return;
  }

  let physical_support = ss_pvta_volume_radius(represented_volume) * max(params.support_radius_scale, 0.0);
  let target_support = max(physical_support, source_support);
  let target_level_i32 = select(ss_pvta_level_from_support(target_support), i32(source_level), physical_fluid_grouping);
  let target_level = f32(target_level_i32);
  let target_grid_spacing = max(params.base_grid_spacing_m, 0.000001) * exp2(target_level);
  let target_cell = floor(position / target_grid_spacing);
  let level_delta = target_level - source_level;

  let material_domain = select(
    level_assignments[assignment_offset + 9u],
    -level_assignments[assignment_offset + 9u],
    liquid_phase
  );
  aggregate_rows[aggregate_offset + 0u] = select(f32(particle_identity[particle_index]),
    material_domain, physical_fluid_grouping);
  aggregate_rows[aggregate_offset + 1u] = target_level;
  aggregate_rows[aggregate_offset + 2u] = chart_id;
  aggregate_rows[aggregate_offset + 3u] = 1.0;
  aggregate_rows[aggregate_offset + 4u] = target_cell.x;
  aggregate_rows[aggregate_offset + 5u] = target_cell.y;
  aggregate_rows[aggregate_offset + 6u] = target_cell.z;
  aggregate_rows[aggregate_offset + 7u] = params.state_family_id;
  aggregate_rows[aggregate_offset + 8u] = mass_kg;
  aggregate_rows[aggregate_offset + 9u] = represented_volume;
  let particle_momentum = ss_pvta_particle_momentum(particle_index, mass_kg);
  aggregate_rows[aggregate_offset + 10u] = particle_momentum.x;
  aggregate_rows[aggregate_offset + 11u] = particle_momentum.y;
  aggregate_rows[aggregate_offset + 12u] = particle_momentum.z;
  aggregate_rows[aggregate_offset + 13u] = ss_pvta_mass_temperature(particle_index, mass_kg);
  aggregate_rows[aggregate_offset + 14u] = f32(particle_index);
  aggregate_rows[aggregate_offset + 15u] = 1.0;
  aggregate_rows[aggregate_offset + 16u] = mass_kg;
  aggregate_rows[aggregate_offset + 17u] = mass_kg;
  aggregate_rows[aggregate_offset + 18u] = 0.0;
  aggregate_rows[aggregate_offset + 19u] = max(source_volume, rest_volume);
  aggregate_rows[aggregate_offset + 20u] = represented_volume;
  aggregate_rows[aggregate_offset + 21u] = 0.0;
  aggregate_rows[aggregate_offset + 22u] = 0.0;
  aggregate_rows[aggregate_offset + 23u] = 0.0;
  aggregate_rows[aggregate_offset + 24u] = 0.0;
  aggregate_rows[aggregate_offset + 25u] = 0.0;
  aggregate_rows[aggregate_offset + 26u] = params.aggregate_epoch;
  aggregate_rows[aggregate_offset + 27u] = source_level;
  aggregate_rows[aggregate_offset + 28u] = level_delta;
  aggregate_rows[aggregate_offset + 29u] = 2.0;
  aggregate_rows[aggregate_offset + 30u] = 1.0;
  aggregate_rows[aggregate_offset + 31u] = 0.0;
}
`;

export const schroederHierarchyAggregateNodeReduceWgsl = `
struct SchroederHierarchyAggregateNodeReduceParams {
  row_count: u32,
  aggregate_stride: u32,
  node_stride: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
};

@group(0) @binding(0) var<storage, read> aggregate_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> aggregate_node_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederHierarchyAggregateNodeReduceParams;

const SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE_FOR_NODE: u32 = 32u;
const SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_NODE_STRIDE: u32 = 32u;

fn ss_node_same_key(lhs_offset: u32, rhs_offset: u32, aggregate_stride: u32) -> bool {
  let lhs_key = aggregate_rows[lhs_offset + 0u];
  let rhs_key = aggregate_rows[rhs_offset + 0u];
  let lhs_level = aggregate_rows[lhs_offset + 1u];
  let rhs_level = aggregate_rows[rhs_offset + 1u];
  let lhs_chart = aggregate_rows[lhs_offset + 2u];
  let rhs_chart = aggregate_rows[rhs_offset + 2u];
  let lhs_cell = vec3<f32>(
    aggregate_rows[lhs_offset + 4u],
    aggregate_rows[lhs_offset + 5u],
    aggregate_rows[lhs_offset + 6u]
  );
  let rhs_cell = vec3<f32>(
    aggregate_rows[rhs_offset + 4u],
    aggregate_rows[rhs_offset + 5u],
    aggregate_rows[rhs_offset + 6u]
  );
  return abs(lhs_key - rhs_key) < 0.5
    && abs(lhs_level - rhs_level) < 0.5
    && abs(lhs_chart - rhs_chart) < 0.5
    && all(abs(lhs_cell - rhs_cell) < vec3<f32>(0.5));
}

fn ss_node_active(offset: u32) -> bool {
  let status = aggregate_rows[offset + 3u];
  let admission = aggregate_rows[offset + 30u];
  return status > 0.0 && status < 32.0 && admission > 0.0;
}

fn ss_node_write_empty(node_offset: u32, source_offset: u32, status: f32) {
  aggregate_node_rows[node_offset + 0u] = aggregate_rows[source_offset + 0u];
  aggregate_node_rows[node_offset + 1u] = aggregate_rows[source_offset + 1u];
  aggregate_node_rows[node_offset + 2u] = aggregate_rows[source_offset + 2u];
  aggregate_node_rows[node_offset + 3u] = status;
  aggregate_node_rows[node_offset + 4u] = aggregate_rows[source_offset + 4u];
  aggregate_node_rows[node_offset + 5u] = aggregate_rows[source_offset + 5u];
  aggregate_node_rows[node_offset + 6u] = aggregate_rows[source_offset + 6u];
  aggregate_node_rows[node_offset + 7u] = aggregate_rows[source_offset + 7u];
  for (var column = 8u; column < SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_NODE_STRIDE; column = column + 1u) {
    aggregate_node_rows[node_offset + column] = 0.0;
  }
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.row_count) {
    return;
  }

  let aggregate_stride = max(params.aggregate_stride, SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE_FOR_NODE);
  let node_stride = max(params.node_stride, SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_NODE_STRIDE);
  let source_offset = row_index * aggregate_stride;
  let node_offset = row_index * node_stride;

  if (!ss_node_active(source_offset)) {
    ss_node_write_empty(node_offset, source_offset, 32.0);
    return;
  }

  var duplicate_before = false;
  for (var prior_index = 0u; prior_index < row_index; prior_index = prior_index + 1u) {
    let prior_offset = prior_index * aggregate_stride;
    if (ss_node_active(prior_offset) && ss_node_same_key(source_offset, prior_offset, aggregate_stride)) {
      duplicate_before = true;
    }
  }

  if (duplicate_before) {
    ss_node_write_empty(node_offset, source_offset, 64.0);
    aggregate_node_rows[node_offset + 14u] = f32(row_index);
    aggregate_node_rows[node_offset + 16u] = 1.0;
    aggregate_node_rows[node_offset + 28u] = 1.0;
    aggregate_node_rows[node_offset + 29u] = 1.0;
    aggregate_node_rows[node_offset + 30u] = aggregate_rows[source_offset + 30u];
    return;
  }

  var total_mass = 0.0;
  var total_volume = 0.0;
  var total_momentum = vec3<f32>(0.0);
  var total_internal_energy = 0.0;
  var matching_count = 0.0;
  var suppressed_duplicate_count = 0.0;
  var mass_residual = 0.0;
  var volume_residual = 0.0;
  var momentum_residual = vec3<f32>(0.0);
  var internal_energy_residual = 0.0;
  var child_level_min = aggregate_rows[source_offset + 27u];
  var child_level_max = aggregate_rows[source_offset + 27u];
  var level_delta_max = aggregate_rows[source_offset + 28u];

  for (var scan_index = 0u; scan_index < params.row_count; scan_index = scan_index + 1u) {
    let scan_offset = scan_index * aggregate_stride;
    if (ss_node_active(scan_offset) && ss_node_same_key(source_offset, scan_offset, aggregate_stride)) {
      matching_count = matching_count + 1.0;
      total_mass = total_mass + aggregate_rows[scan_offset + 8u];
      total_volume = total_volume + aggregate_rows[scan_offset + 9u];
      total_momentum = total_momentum + vec3<f32>(
        aggregate_rows[scan_offset + 10u],
        aggregate_rows[scan_offset + 11u],
        aggregate_rows[scan_offset + 12u]
      );
      total_internal_energy = total_internal_energy + aggregate_rows[scan_offset + 13u];
      mass_residual = mass_residual + aggregate_rows[scan_offset + 18u];
      volume_residual = volume_residual + aggregate_rows[scan_offset + 21u];
      momentum_residual = momentum_residual + vec3<f32>(
        aggregate_rows[scan_offset + 22u],
        aggregate_rows[scan_offset + 23u],
        aggregate_rows[scan_offset + 24u]
      );
      internal_energy_residual = internal_energy_residual + aggregate_rows[scan_offset + 25u];
      child_level_min = min(child_level_min, aggregate_rows[scan_offset + 27u]);
      child_level_max = max(child_level_max, aggregate_rows[scan_offset + 27u]);
      level_delta_max = max(level_delta_max, aggregate_rows[scan_offset + 28u]);
    }
  }
  suppressed_duplicate_count = max(matching_count - 1.0, 0.0);

  aggregate_node_rows[node_offset + 0u] = aggregate_rows[source_offset + 0u];
  aggregate_node_rows[node_offset + 1u] = aggregate_rows[source_offset + 1u];
  aggregate_node_rows[node_offset + 2u] = aggregate_rows[source_offset + 2u];
  aggregate_node_rows[node_offset + 3u] = 1.0;
  aggregate_node_rows[node_offset + 4u] = aggregate_rows[source_offset + 4u];
  aggregate_node_rows[node_offset + 5u] = aggregate_rows[source_offset + 5u];
  aggregate_node_rows[node_offset + 6u] = aggregate_rows[source_offset + 6u];
  aggregate_node_rows[node_offset + 7u] = aggregate_rows[source_offset + 7u];
  aggregate_node_rows[node_offset + 8u] = total_mass;
  aggregate_node_rows[node_offset + 9u] = total_volume;
  aggregate_node_rows[node_offset + 10u] = total_momentum.x;
  aggregate_node_rows[node_offset + 11u] = total_momentum.y;
  aggregate_node_rows[node_offset + 12u] = total_momentum.z;
  aggregate_node_rows[node_offset + 13u] = total_internal_energy;
  aggregate_node_rows[node_offset + 14u] = f32(row_index);
  aggregate_node_rows[node_offset + 15u] = matching_count;
  aggregate_node_rows[node_offset + 16u] = suppressed_duplicate_count;
  aggregate_node_rows[node_offset + 17u] = mass_residual;
  aggregate_node_rows[node_offset + 18u] = volume_residual;
  aggregate_node_rows[node_offset + 19u] = momentum_residual.x;
  aggregate_node_rows[node_offset + 20u] = momentum_residual.y;
  aggregate_node_rows[node_offset + 21u] = momentum_residual.z;
  aggregate_node_rows[node_offset + 22u] = internal_energy_residual;
  aggregate_node_rows[node_offset + 23u] = aggregate_rows[source_offset + 26u];
  aggregate_node_rows[node_offset + 24u] = child_level_min;
  aggregate_node_rows[node_offset + 25u] = child_level_max;
  aggregate_node_rows[node_offset + 26u] = level_delta_max;
  aggregate_node_rows[node_offset + 27u] = 1.0;
  aggregate_node_rows[node_offset + 28u] = 1.0;
  aggregate_node_rows[node_offset + 29u] = 1.0;
  aggregate_node_rows[node_offset + 30u] = aggregate_rows[source_offset + 30u];
  aggregate_node_rows[node_offset + 31u] = 0.0;
}
`;

export const schroederHierarchyAggregateNodeBucketReduceWgsl = `
struct SchroederHierarchyAggregateNodeBucketReduceParams {
  row_count: u32,
  aggregate_stride: u32,
  node_stride: u32,
  flags: u32,
  bucket_count: u32,
  bucket_slot_capacity: u32,
  bucket_slot_count: u32,
  reduction_mode_id: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
  pad4: u32,
  pad5: u32,
  pad6: u32,
  pad7: u32,
};

@group(0) @binding(0) var<storage, read> aggregate_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> aggregate_node_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> bucket_counts: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> bucket_slots: array<u32>;
@group(0) @binding(4) var<storage, read_write> row_bucket_slots: array<u32>;
@group(0) @binding(5) var<uniform> params: SchroederHierarchyAggregateNodeBucketReduceParams;

const SCHROEDER_BUCKET_SENTINEL: u32 = 0xffffffffu;
const SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE_FOR_BUCKET_NODE: u32 = 32u;
const SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_BUCKET_NODE_STRIDE: u32 = 32u;

fn ss_bucket_hash_mix(value: u32, seed: u32) -> u32 {
  var hash = seed ^ (value + 0x9e3779b9u + (seed << 6u) + (seed >> 2u));
  hash = hash ^ (hash >> 16u);
  hash = hash * 0x7feb352du;
  hash = hash ^ (hash >> 15u);
  hash = hash * 0x846ca68bu;
  return hash ^ (hash >> 16u);
}

fn ss_bucket_i32_bits(value: f32) -> u32 {
  return bitcast<u32>(i32(round(value)));
}

fn ss_bucket_hash(source_offset: u32) -> u32 {
  var hash = 0x811c9dc5u;
  hash = ss_bucket_hash_mix(ss_bucket_i32_bits(aggregate_rows[source_offset + 0u]), hash);
  hash = ss_bucket_hash_mix(ss_bucket_i32_bits(aggregate_rows[source_offset + 1u]), hash);
  hash = ss_bucket_hash_mix(ss_bucket_i32_bits(aggregate_rows[source_offset + 2u]), hash);
  hash = ss_bucket_hash_mix(ss_bucket_i32_bits(aggregate_rows[source_offset + 4u]), hash);
  hash = ss_bucket_hash_mix(ss_bucket_i32_bits(aggregate_rows[source_offset + 5u]), hash);
  hash = ss_bucket_hash_mix(ss_bucket_i32_bits(aggregate_rows[source_offset + 6u]), hash);
  return hash % max(params.bucket_count, 1u);
}

fn ss_bucket_node_same_key(lhs_offset: u32, rhs_offset: u32) -> bool {
  let lhs_key = aggregate_rows[lhs_offset + 0u];
  let rhs_key = aggregate_rows[rhs_offset + 0u];
  let lhs_level = aggregate_rows[lhs_offset + 1u];
  let rhs_level = aggregate_rows[rhs_offset + 1u];
  let lhs_chart = aggregate_rows[lhs_offset + 2u];
  let rhs_chart = aggregate_rows[rhs_offset + 2u];
  let lhs_cell = vec3<f32>(
    aggregate_rows[lhs_offset + 4u],
    aggregate_rows[lhs_offset + 5u],
    aggregate_rows[lhs_offset + 6u]
  );
  let rhs_cell = vec3<f32>(
    aggregate_rows[rhs_offset + 4u],
    aggregate_rows[rhs_offset + 5u],
    aggregate_rows[rhs_offset + 6u]
  );
  return abs(lhs_key - rhs_key) < 0.5
    && abs(lhs_level - rhs_level) < 0.5
    && abs(lhs_chart - rhs_chart) < 0.5
    && all(abs(lhs_cell - rhs_cell) < vec3<f32>(0.5));
}

fn ss_bucket_node_active(offset: u32) -> bool {
  let status = aggregate_rows[offset + 3u];
  let admission = aggregate_rows[offset + 30u];
  return status > 0.0 && status < 32.0 && admission > 0.0;
}

fn ss_bucket_write_empty(node_offset: u32, source_offset: u32, status: f32, capacity_status: f32) {
  aggregate_node_rows[node_offset + 0u] = aggregate_rows[source_offset + 0u];
  aggregate_node_rows[node_offset + 1u] = aggregate_rows[source_offset + 1u];
  aggregate_node_rows[node_offset + 2u] = aggregate_rows[source_offset + 2u];
  aggregate_node_rows[node_offset + 3u] = status;
  aggregate_node_rows[node_offset + 4u] = aggregate_rows[source_offset + 4u];
  aggregate_node_rows[node_offset + 5u] = aggregate_rows[source_offset + 5u];
  aggregate_node_rows[node_offset + 6u] = aggregate_rows[source_offset + 6u];
  aggregate_node_rows[node_offset + 7u] = aggregate_rows[source_offset + 7u];
  for (var column = 8u; column < SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_BUCKET_NODE_STRIDE; column = column + 1u) {
    aggregate_node_rows[node_offset + column] = 0.0;
  }
  aggregate_node_rows[node_offset + 28u] = f32(params.reduction_mode_id);
  aggregate_node_rows[node_offset + 29u] = capacity_status;
  aggregate_node_rows[node_offset + 30u] = aggregate_rows[source_offset + 30u];
}

@compute @workgroup_size(64)
fn clearBuckets(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < params.bucket_count) {
    atomicStore(&bucket_counts[index], 0u);
  }
  if (index < params.bucket_slot_count) {
    bucket_slots[index] = SCHROEDER_BUCKET_SENTINEL;
  }
  if (index < params.row_count) {
    row_bucket_slots[index] = SCHROEDER_BUCKET_SENTINEL;
  }
}

@compute @workgroup_size(64)
fn assignBuckets(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.row_count) {
    return;
  }
  let aggregate_stride = max(params.aggregate_stride, SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE_FOR_BUCKET_NODE);
  let source_offset = row_index * aggregate_stride;
  if (!ss_bucket_node_active(source_offset)) {
    row_bucket_slots[row_index] = SCHROEDER_BUCKET_SENTINEL;
    return;
  }
  let bucket_index = ss_bucket_hash(source_offset);
  let slot_index = atomicAdd(&bucket_counts[bucket_index], 1u);
  if (slot_index >= params.bucket_slot_capacity) {
    row_bucket_slots[row_index] = SCHROEDER_BUCKET_SENTINEL;
    return;
  }
  let absolute_slot = bucket_index * params.bucket_slot_capacity + slot_index;
  if (absolute_slot >= params.bucket_slot_count) {
    row_bucket_slots[row_index] = SCHROEDER_BUCKET_SENTINEL;
    return;
  }
  bucket_slots[absolute_slot] = row_index;
  row_bucket_slots[row_index] = absolute_slot;
}

@compute @workgroup_size(64)
fn reduceBuckets(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.row_count) {
    return;
  }

  let aggregate_stride = max(params.aggregate_stride, SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_STRIDE_FOR_BUCKET_NODE);
  let node_stride = max(params.node_stride, SCHROEDER_DEFAULT_HIERARCHY_AGGREGATE_BUCKET_NODE_STRIDE);
  let source_offset = row_index * aggregate_stride;
  let node_offset = row_index * node_stride;

  if (!ss_bucket_node_active(source_offset)) {
    ss_bucket_write_empty(node_offset, source_offset, 32.0, 1.0);
    return;
  }

  let assigned_slot = row_bucket_slots[row_index];
  let bucket_index = ss_bucket_hash(source_offset);
  let raw_bucket_count = atomicLoad(&bucket_counts[bucket_index]);
  let bucket_overflow = raw_bucket_count > params.bucket_slot_capacity;
  if (assigned_slot == SCHROEDER_BUCKET_SENTINEL || bucket_overflow) {
    ss_bucket_write_empty(node_offset, source_offset, 96.0, 96.0);
    aggregate_node_rows[node_offset + 14u] = f32(row_index);
    return;
  }

  let scan_count = min(raw_bucket_count, params.bucket_slot_capacity);
  let bucket_base = bucket_index * params.bucket_slot_capacity;
  var duplicate_before = false;
  for (var slot = 0u; slot < scan_count; slot = slot + 1u) {
    let other_index = bucket_slots[bucket_base + slot];
    if (other_index != SCHROEDER_BUCKET_SENTINEL && other_index < row_index) {
      let other_offset = other_index * aggregate_stride;
      if (ss_bucket_node_active(other_offset) && ss_bucket_node_same_key(source_offset, other_offset)) {
        duplicate_before = true;
      }
    }
  }

  if (duplicate_before) {
    ss_bucket_write_empty(node_offset, source_offset, 64.0, 1.0);
    aggregate_node_rows[node_offset + 14u] = f32(row_index);
    aggregate_node_rows[node_offset + 16u] = 1.0;
    return;
  }

  var total_mass = 0.0;
  var total_volume = 0.0;
  var total_momentum = vec3<f32>(0.0);
  var total_internal_energy = 0.0;
  var matching_count = 0.0;
  var mass_residual = 0.0;
  var volume_residual = 0.0;
  var momentum_residual = vec3<f32>(0.0);
  var internal_energy_residual = 0.0;
  var child_level_min = aggregate_rows[source_offset + 27u];
  var child_level_max = aggregate_rows[source_offset + 27u];
  var level_delta_max = aggregate_rows[source_offset + 28u];

  for (var slot = 0u; slot < scan_count; slot = slot + 1u) {
    let other_index = bucket_slots[bucket_base + slot];
    if (other_index != SCHROEDER_BUCKET_SENTINEL) {
      let scan_offset = other_index * aggregate_stride;
      if (ss_bucket_node_active(scan_offset) && ss_bucket_node_same_key(source_offset, scan_offset)) {
        matching_count = matching_count + 1.0;
        total_mass = total_mass + aggregate_rows[scan_offset + 8u];
        total_volume = total_volume + aggregate_rows[scan_offset + 9u];
        total_momentum = total_momentum + vec3<f32>(
          aggregate_rows[scan_offset + 10u],
          aggregate_rows[scan_offset + 11u],
          aggregate_rows[scan_offset + 12u]
        );
        total_internal_energy = total_internal_energy + aggregate_rows[scan_offset + 13u];
        mass_residual = mass_residual + aggregate_rows[scan_offset + 18u];
        volume_residual = volume_residual + aggregate_rows[scan_offset + 21u];
        momentum_residual = momentum_residual + vec3<f32>(
          aggregate_rows[scan_offset + 22u],
          aggregate_rows[scan_offset + 23u],
          aggregate_rows[scan_offset + 24u]
        );
        internal_energy_residual = internal_energy_residual + aggregate_rows[scan_offset + 25u];
        child_level_min = min(child_level_min, aggregate_rows[scan_offset + 27u]);
        child_level_max = max(child_level_max, aggregate_rows[scan_offset + 27u]);
        level_delta_max = max(level_delta_max, aggregate_rows[scan_offset + 28u]);
      }
    }
  }
  let suppressed_duplicate_count = max(matching_count - 1.0, 0.0);

  aggregate_node_rows[node_offset + 0u] = aggregate_rows[source_offset + 0u];
  aggregate_node_rows[node_offset + 1u] = aggregate_rows[source_offset + 1u];
  aggregate_node_rows[node_offset + 2u] = aggregate_rows[source_offset + 2u];
  aggregate_node_rows[node_offset + 3u] = 1.0;
  aggregate_node_rows[node_offset + 4u] = aggregate_rows[source_offset + 4u];
  aggregate_node_rows[node_offset + 5u] = aggregate_rows[source_offset + 5u];
  aggregate_node_rows[node_offset + 6u] = aggregate_rows[source_offset + 6u];
  aggregate_node_rows[node_offset + 7u] = aggregate_rows[source_offset + 7u];
  aggregate_node_rows[node_offset + 8u] = total_mass;
  aggregate_node_rows[node_offset + 9u] = total_volume;
  aggregate_node_rows[node_offset + 10u] = total_momentum.x;
  aggregate_node_rows[node_offset + 11u] = total_momentum.y;
  aggregate_node_rows[node_offset + 12u] = total_momentum.z;
  aggregate_node_rows[node_offset + 13u] = total_internal_energy;
  aggregate_node_rows[node_offset + 14u] = f32(row_index);
  aggregate_node_rows[node_offset + 15u] = matching_count;
  aggregate_node_rows[node_offset + 16u] = suppressed_duplicate_count;
  aggregate_node_rows[node_offset + 17u] = mass_residual;
  aggregate_node_rows[node_offset + 18u] = volume_residual;
  aggregate_node_rows[node_offset + 19u] = momentum_residual.x;
  aggregate_node_rows[node_offset + 20u] = momentum_residual.y;
  aggregate_node_rows[node_offset + 21u] = momentum_residual.z;
  aggregate_node_rows[node_offset + 22u] = internal_energy_residual;
  aggregate_node_rows[node_offset + 23u] = aggregate_rows[source_offset + 26u];
  aggregate_node_rows[node_offset + 24u] = child_level_min;
  aggregate_node_rows[node_offset + 25u] = child_level_max;
  aggregate_node_rows[node_offset + 26u] = level_delta_max;
  aggregate_node_rows[node_offset + 27u] = 1.0;
  aggregate_node_rows[node_offset + 28u] = f32(params.reduction_mode_id);
  aggregate_node_rows[node_offset + 29u] = 1.0;
  aggregate_node_rows[node_offset + 30u] = aggregate_rows[source_offset + 30u];
  aggregate_node_rows[node_offset + 31u] = 0.0;
}
`;

export const schroederFarAggregateCandidateWgsl = `
struct SchroederFarAggregateCandidateParams {
  active_node_count: u32,
  aggregate_node_count: u32,
  active_node_stride: u32,
  aggregate_node_stride: u32,
  candidate_stride: u32,
  candidate_budget: u32,
  enabled_far_law_mask: u32,
  flags: u32,
  base_grid_spacing_m: f32,
  opening_theta: f32,
  near_field_support_scale: f32,
  far_field_error_bound: f32,
  queue_epoch: f32,
  state_family_id: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(1) var<storage, read> aggregate_node_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> far_candidate_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederFarAggregateCandidateParams;

const SCHROEDER_DEFAULT_ACTIVE_NODE_STRIDE_FOR_FAR_AGGREGATE: u32 = 16u;
const SCHROEDER_DEFAULT_AGGREGATE_NODE_STRIDE_FOR_FAR_AGGREGATE: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_CANDIDATE_STRIDE: u32 = 32u;

fn ss_far_active_node(offset: u32) -> bool {
  let status = active_nodes[offset + 11u];
  return status > 0.0 && status < 32.0;
}

fn ss_far_aggregate_node_active(offset: u32) -> bool {
  let status = aggregate_node_rows[offset + 3u];
  let admission = aggregate_node_rows[offset + 30u];
  let mass = aggregate_node_rows[offset + 8u];
  return status > 0.0 && status < 32.0 && admission > 0.0 && mass > 0.0;
}

fn ss_far_grid_spacing(level_id: f32) -> f32 {
  return max(params.base_grid_spacing_m, 0.000001) * exp2(level_id);
}

fn ss_far_aggregate_center(node_offset: u32, node_size_m: f32) -> vec3<f32> {
  return vec3<f32>(
    (aggregate_node_rows[node_offset + 4u] + 0.5) * node_size_m,
    (aggregate_node_rows[node_offset + 5u] + 0.5) * node_size_m,
    (aggregate_node_rows[node_offset + 6u] + 0.5) * node_size_m
  );
}

fn ss_far_write_empty(candidate_offset: u32, active_offset: u32, slot_index: u32, status: f32, accepted_count: f32, overflow: f32) {
  far_candidate_rows[candidate_offset + 0u] = active_nodes[active_offset + 10u];
  far_candidate_rows[candidate_offset + 1u] = active_nodes[active_offset + 0u];
  far_candidate_rows[candidate_offset + 2u] = -1.0;
  far_candidate_rows[candidate_offset + 3u] = 0.0;
  far_candidate_rows[candidate_offset + 4u] = active_nodes[active_offset + 15u];
  far_candidate_rows[candidate_offset + 5u] = 0.0;
  far_candidate_rows[candidate_offset + 6u] = f32(params.enabled_far_law_mask);
  far_candidate_rows[candidate_offset + 7u] = status;
  far_candidate_rows[candidate_offset + 8u] = 0.0;
  far_candidate_rows[candidate_offset + 9u] = 0.0;
  far_candidate_rows[candidate_offset + 10u] = params.opening_theta;
  far_candidate_rows[candidate_offset + 11u] = 0.0;
  far_candidate_rows[candidate_offset + 12u] = 0.0;
  far_candidate_rows[candidate_offset + 13u] = 0.0;
  far_candidate_rows[candidate_offset + 14u] = 0.0;
  far_candidate_rows[candidate_offset + 15u] = 0.0;
  far_candidate_rows[candidate_offset + 16u] = 0.0;
  far_candidate_rows[candidate_offset + 17u] = 0.0;
  far_candidate_rows[candidate_offset + 18u] = 0.0;
  far_candidate_rows[candidate_offset + 19u] = 0.0;
  far_candidate_rows[candidate_offset + 20u] = 0.0;
  far_candidate_rows[candidate_offset + 21u] = active_nodes[active_offset + 12u];
  far_candidate_rows[candidate_offset + 22u] = active_nodes[active_offset + 13u];
  far_candidate_rows[candidate_offset + 23u] = active_nodes[active_offset + 14u];
  far_candidate_rows[candidate_offset + 24u] = active_nodes[active_offset + 9u] * params.near_field_support_scale;
  far_candidate_rows[candidate_offset + 25u] = params.far_field_error_bound;
  far_candidate_rows[candidate_offset + 26u] = 0.0;
  far_candidate_rows[candidate_offset + 27u] = params.queue_epoch;
  far_candidate_rows[candidate_offset + 28u] = params.state_family_id;
  far_candidate_rows[candidate_offset + 29u] = f32(slot_index);
  far_candidate_rows[candidate_offset + 30u] = accepted_count;
  far_candidate_rows[candidate_offset + 31u] = overflow;
}

fn ss_far_write_candidate(
  candidate_offset: u32,
  active_offset: u32,
  node_offset: u32,
  node_index: u32,
  slot_index: u32,
  accepted_count: f32,
  distance_m: f32,
  node_size_m: f32,
  opening_ratio: f32,
  center_m: vec3<f32>
) {
  far_candidate_rows[candidate_offset + 0u] = active_nodes[active_offset + 10u];
  far_candidate_rows[candidate_offset + 1u] = active_nodes[active_offset + 0u];
  far_candidate_rows[candidate_offset + 2u] = f32(node_index);
  far_candidate_rows[candidate_offset + 3u] = aggregate_node_rows[node_offset + 1u];
  far_candidate_rows[candidate_offset + 4u] = active_nodes[active_offset + 15u];
  far_candidate_rows[candidate_offset + 5u] = aggregate_node_rows[node_offset + 2u];
  far_candidate_rows[candidate_offset + 6u] = f32(params.enabled_far_law_mask);
  far_candidate_rows[candidate_offset + 7u] = 1.0;
  far_candidate_rows[candidate_offset + 8u] = distance_m;
  far_candidate_rows[candidate_offset + 9u] = node_size_m;
  far_candidate_rows[candidate_offset + 10u] = params.opening_theta;
  far_candidate_rows[candidate_offset + 11u] = opening_ratio;
  far_candidate_rows[candidate_offset + 12u] = aggregate_node_rows[node_offset + 8u];
  far_candidate_rows[candidate_offset + 13u] = aggregate_node_rows[node_offset + 9u];
  far_candidate_rows[candidate_offset + 14u] = aggregate_node_rows[node_offset + 10u];
  far_candidate_rows[candidate_offset + 15u] = aggregate_node_rows[node_offset + 11u];
  far_candidate_rows[candidate_offset + 16u] = aggregate_node_rows[node_offset + 12u];
  far_candidate_rows[candidate_offset + 17u] = aggregate_node_rows[node_offset + 13u];
  far_candidate_rows[candidate_offset + 18u] = center_m.x;
  far_candidate_rows[candidate_offset + 19u] = center_m.y;
  far_candidate_rows[candidate_offset + 20u] = center_m.z;
  far_candidate_rows[candidate_offset + 21u] = active_nodes[active_offset + 12u];
  far_candidate_rows[candidate_offset + 22u] = active_nodes[active_offset + 13u];
  far_candidate_rows[candidate_offset + 23u] = active_nodes[active_offset + 14u];
  far_candidate_rows[candidate_offset + 24u] = active_nodes[active_offset + 9u] * params.near_field_support_scale;
  far_candidate_rows[candidate_offset + 25u] = params.far_field_error_bound;
  far_candidate_rows[candidate_offset + 26u] = 7.0;
  far_candidate_rows[candidate_offset + 27u] = params.queue_epoch;
  far_candidate_rows[candidate_offset + 28u] = params.state_family_id;
  far_candidate_rows[candidate_offset + 29u] = f32(slot_index);
  far_candidate_rows[candidate_offset + 30u] = accepted_count;
  far_candidate_rows[candidate_offset + 31u] = 0.0;
}

fn ss_far_candidate_admissible(active_offset: u32, node_offset: u32, source_m: vec3<f32>) -> vec4<f32> {
  let aggregate_level = aggregate_node_rows[node_offset + 1u];
  let node_size_m = ss_far_grid_spacing(aggregate_level);
  let center_m = ss_far_aggregate_center(node_offset, node_size_m);
  let distance_m = max(length(center_m - source_m), 0.000001);
  let near_field_radius_m = max(active_nodes[active_offset + 9u] * params.near_field_support_scale, 0.0);
  let opening_ratio = node_size_m / distance_m;
  let source_chart = active_nodes[active_offset + 15u];
  let aggregate_chart = aggregate_node_rows[node_offset + 2u];
  let same_chart = abs(source_chart - aggregate_chart) < 0.5;
  let far_enough = distance_m > near_field_radius_m;
  let opened = opening_ratio <= params.opening_theta;
  let is_live_node = ss_far_aggregate_node_active(node_offset);
  let accepted = select(0.0, 1.0, same_chart && far_enough && opened && is_live_node);
  return vec4<f32>(accepted, distance_m, node_size_m, opening_ratio);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  let candidate_budget = max(params.candidate_budget, 1u);
  let candidate_count = params.active_node_count * candidate_budget;
  if (row_index >= candidate_count) {
    return;
  }

  let source_index = row_index / candidate_budget;
  let slot_index = row_index - source_index * candidate_budget;
  let active_stride = max(params.active_node_stride, SCHROEDER_DEFAULT_ACTIVE_NODE_STRIDE_FOR_FAR_AGGREGATE);
  let aggregate_stride = max(params.aggregate_node_stride, SCHROEDER_DEFAULT_AGGREGATE_NODE_STRIDE_FOR_FAR_AGGREGATE);
  let candidate_stride = max(params.candidate_stride, SCHROEDER_DEFAULT_FAR_AGGREGATE_CANDIDATE_STRIDE);
  let active_offset = source_index * active_stride;
  let candidate_offset = row_index * candidate_stride;

  if (!ss_far_active_node(active_offset) || params.enabled_far_law_mask == 0u) {
    ss_far_write_empty(candidate_offset, active_offset, slot_index, 32.0, 0.0, 0.0);
    return;
  }

  let source_m = vec3<f32>(
    active_nodes[active_offset + 12u],
    active_nodes[active_offset + 13u],
    active_nodes[active_offset + 14u]
  );
  var accepted_count = 0u;
  var emitted = false;
  var overflow = false;

  for (var node_index = 0u; node_index < params.aggregate_node_count; node_index = node_index + 1u) {
    let node_offset = node_index * aggregate_stride;
    let admissible = ss_far_candidate_admissible(active_offset, node_offset, source_m);
    if (admissible.x > 0.0) {
      if (accepted_count == slot_index) {
        let node_size_m = admissible.z;
        let center_m = ss_far_aggregate_center(node_offset, node_size_m);
        ss_far_write_candidate(
          candidate_offset,
          active_offset,
          node_offset,
          node_index,
          slot_index,
          f32(accepted_count + 1u),
          admissible.y,
          node_size_m,
          admissible.w,
          center_m
        );
        emitted = true;
      }
      accepted_count = accepted_count + 1u;
      if (accepted_count > candidate_budget) {
        overflow = true;
      }
    }
  }

  if (!emitted) {
    let status = select(96.0, 128.0, overflow && slot_index + 1u == candidate_budget);
    ss_far_write_empty(candidate_offset, active_offset, slot_index, status, f32(accepted_count), select(0.0, 1.0, overflow));
  } else if (overflow && slot_index + 1u == candidate_budget) {
    far_candidate_rows[candidate_offset + 31u] = 1.0;
    far_candidate_rows[candidate_offset + 30u] = f32(accepted_count);
  }
}
`;

export const schroederFarAggregateForceSummaryWgsl = `
struct SchroederFarAggregateForceSummaryParams {
  active_node_count: u32,
  far_candidate_count: u32,
  candidate_stride: u32,
  summary_stride: u32,
  candidate_budget: u32,
  enabled_far_law_mask: u32,
  flags: u32,
  pad0: u32,
  gravitational_constant: f32,
  softening_length_m: f32,
  force_scale: f32,
  far_field_error_bound: f32,
  queue_epoch: f32,
  state_family_id: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> far_candidate_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> force_summary_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederFarAggregateForceSummaryParams;

const SCHROEDER_DEFAULT_FAR_AGGREGATE_CANDIDATE_STRIDE_FOR_FORCE: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_FORCE_SUMMARY_STRIDE: u32 = 32u;

fn ss_far_force_write_empty(summary_offset: u32, source_index: u32, candidate_offset: u32, status: f32) {
  var source_particle = f32(source_index);
  var source_level = 0.0;
  var source_chart = 0.0;
  var source_position = vec3<f32>(0.0);
  if (candidate_offset < params.far_candidate_count * max(params.candidate_stride, SCHROEDER_DEFAULT_FAR_AGGREGATE_CANDIDATE_STRIDE_FOR_FORCE)) {
    source_particle = far_candidate_rows[candidate_offset + 0u];
    source_level = far_candidate_rows[candidate_offset + 1u];
    source_chart = far_candidate_rows[candidate_offset + 4u];
    source_position = vec3<f32>(
      far_candidate_rows[candidate_offset + 21u],
      far_candidate_rows[candidate_offset + 22u],
      far_candidate_rows[candidate_offset + 23u]
    );
  }
  force_summary_rows[summary_offset + 0u] = source_particle;
  force_summary_rows[summary_offset + 1u] = source_level;
  force_summary_rows[summary_offset + 2u] = source_chart;
  force_summary_rows[summary_offset + 3u] = f32(params.enabled_far_law_mask);
  force_summary_rows[summary_offset + 4u] = f32(source_index * max(params.candidate_budget, 1u));
  force_summary_rows[summary_offset + 5u] = f32(max(params.candidate_budget, 1u));
  force_summary_rows[summary_offset + 6u] = 0.0;
  force_summary_rows[summary_offset + 7u] = 0.0;
  force_summary_rows[summary_offset + 8u] = 0.0;
  force_summary_rows[summary_offset + 9u] = 0.0;
  force_summary_rows[summary_offset + 10u] = 0.0;
  force_summary_rows[summary_offset + 11u] = 0.0;
  force_summary_rows[summary_offset + 12u] = 0.0;
  force_summary_rows[summary_offset + 13u] = 0.0;
  force_summary_rows[summary_offset + 14u] = 0.0;
  force_summary_rows[summary_offset + 15u] = params.far_field_error_bound;
  force_summary_rows[summary_offset + 16u] = 0.0;
  force_summary_rows[summary_offset + 17u] = 0.0;
  force_summary_rows[summary_offset + 18u] = status;
  force_summary_rows[summary_offset + 19u] = params.queue_epoch;
  force_summary_rows[summary_offset + 20u] = params.state_family_id;
  force_summary_rows[summary_offset + 21u] = params.gravitational_constant;
  force_summary_rows[summary_offset + 22u] = params.softening_length_m;
  force_summary_rows[summary_offset + 23u] = 1.0;
  force_summary_rows[summary_offset + 24u] = source_position.x;
  force_summary_rows[summary_offset + 25u] = source_position.y;
  force_summary_rows[summary_offset + 26u] = source_position.z;
  force_summary_rows[summary_offset + 27u] = 0.0;
  force_summary_rows[summary_offset + 28u] = 0.0;
  force_summary_rows[summary_offset + 29u] = 0.0;
  force_summary_rows[summary_offset + 30u] = 0.0;
  force_summary_rows[summary_offset + 31u] = 0.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let source_index = global_id.x;
  if (source_index >= params.active_node_count) {
    return;
  }

  let candidate_stride = max(params.candidate_stride, SCHROEDER_DEFAULT_FAR_AGGREGATE_CANDIDATE_STRIDE_FOR_FORCE);
  let summary_stride = max(params.summary_stride, SCHROEDER_DEFAULT_FAR_AGGREGATE_FORCE_SUMMARY_STRIDE);
  let candidate_budget = max(params.candidate_budget, 1u);
  let candidate_offset_base = source_index * candidate_budget * candidate_stride;
  let summary_offset = source_index * summary_stride;

  if (params.enabled_far_law_mask == 0u) {
    ss_far_force_write_empty(summary_offset, source_index, candidate_offset_base, 32.0);
    return;
  }

  var source_particle = f32(source_index);
  var source_level = 0.0;
  var source_chart = 0.0;
  var source_position = vec3<f32>(0.0);
  var acceleration = vec3<f32>(0.0);
  var potential = 0.0;
  var total_mass = 0.0;
  var active_count = 0.0;
  var accepted_count = 0.0;
  var blocked_count = 0.0;
  var overflow_count = 0.0;
  var min_distance = 3.402823e38;
  var max_opening_ratio = 0.0;
  var max_error_bound = params.far_field_error_bound;
  var admissibility_flags = 0.0;

  for (var slot = 0u; slot < candidate_budget; slot = slot + 1u) {
    let candidate_index = source_index * candidate_budget + slot;
    if (candidate_index >= params.far_candidate_count) {
      continue;
    }
    let candidate_offset = candidate_index * candidate_stride;
    let status = far_candidate_rows[candidate_offset + 7u];
    if (slot == 0u) {
      source_particle = far_candidate_rows[candidate_offset + 0u];
      source_level = far_candidate_rows[candidate_offset + 1u];
      source_chart = far_candidate_rows[candidate_offset + 4u];
      source_position = vec3<f32>(
        far_candidate_rows[candidate_offset + 21u],
        far_candidate_rows[candidate_offset + 22u],
        far_candidate_rows[candidate_offset + 23u]
      );
      accepted_count = far_candidate_rows[candidate_offset + 30u];
    }
    if (far_candidate_rows[candidate_offset + 31u] > 0.0) {
      overflow_count = overflow_count + 1.0;
      accepted_count = max(accepted_count, far_candidate_rows[candidate_offset + 30u]);
    }
    if (status > 0.0 && status < 32.0) {
      let aggregate_mass = far_candidate_rows[candidate_offset + 12u];
      let distance_m = max(far_candidate_rows[candidate_offset + 8u], 0.000001);
      let center_m = vec3<f32>(
        far_candidate_rows[candidate_offset + 18u],
        far_candidate_rows[candidate_offset + 19u],
        far_candidate_rows[candidate_offset + 20u]
      );
      let direction_vector = center_m - source_position;
      let softened_distance = sqrt(distance_m * distance_m + params.softening_length_m * params.softening_length_m);
      let inv_distance = 1.0 / max(softened_distance, 0.000001);
      let direction = direction_vector * inv_distance;
      let acceleration_magnitude = params.gravitational_constant * aggregate_mass * inv_distance * inv_distance * params.force_scale;
      acceleration = acceleration + direction * acceleration_magnitude;
      potential = potential - params.gravitational_constant * aggregate_mass * inv_distance * params.force_scale;
      total_mass = total_mass + aggregate_mass;
      active_count = active_count + 1.0;
      min_distance = min(min_distance, distance_m);
      max_opening_ratio = max(max_opening_ratio, far_candidate_rows[candidate_offset + 11u]);
      max_error_bound = max(max_error_bound, far_candidate_rows[candidate_offset + 25u]);
      admissibility_flags = max(admissibility_flags, far_candidate_rows[candidate_offset + 26u]);
    } else if (status >= 32.0) {
      blocked_count = blocked_count + 1.0;
    }
  }

  let final_min_distance = select(0.0, min_distance, active_count > 0.0);
  var summary_status = select(32.0, 1.0, active_count > 0.0);
  if (overflow_count > 0.0) {
    summary_status = 128.0;
  }

  force_summary_rows[summary_offset + 0u] = source_particle;
  force_summary_rows[summary_offset + 1u] = source_level;
  force_summary_rows[summary_offset + 2u] = source_chart;
  force_summary_rows[summary_offset + 3u] = f32(params.enabled_far_law_mask);
  force_summary_rows[summary_offset + 4u] = f32(source_index * candidate_budget);
  force_summary_rows[summary_offset + 5u] = f32(candidate_budget);
  force_summary_rows[summary_offset + 6u] = accepted_count;
  force_summary_rows[summary_offset + 7u] = active_count;
  force_summary_rows[summary_offset + 8u] = acceleration.x;
  force_summary_rows[summary_offset + 9u] = acceleration.y;
  force_summary_rows[summary_offset + 10u] = acceleration.z;
  force_summary_rows[summary_offset + 11u] = potential;
  force_summary_rows[summary_offset + 12u] = total_mass;
  force_summary_rows[summary_offset + 13u] = final_min_distance;
  force_summary_rows[summary_offset + 14u] = max_opening_ratio;
  force_summary_rows[summary_offset + 15u] = max_error_bound;
  force_summary_rows[summary_offset + 16u] = overflow_count;
  force_summary_rows[summary_offset + 17u] = blocked_count;
  force_summary_rows[summary_offset + 18u] = summary_status;
  force_summary_rows[summary_offset + 19u] = params.queue_epoch;
  force_summary_rows[summary_offset + 20u] = params.state_family_id;
  force_summary_rows[summary_offset + 21u] = params.gravitational_constant;
  force_summary_rows[summary_offset + 22u] = params.softening_length_m;
  force_summary_rows[summary_offset + 23u] = 1.0;
  force_summary_rows[summary_offset + 24u] = source_position.x;
  force_summary_rows[summary_offset + 25u] = source_position.y;
  force_summary_rows[summary_offset + 26u] = source_position.z;
  force_summary_rows[summary_offset + 27u] = admissibility_flags;
  force_summary_rows[summary_offset + 28u] = 0.0;
  force_summary_rows[summary_offset + 29u] = 0.0;
  force_summary_rows[summary_offset + 30u] = 0.0;
  force_summary_rows[summary_offset + 31u] = 0.0;
}
`;

export const schroederFarAggregateDiagnosticSummaryWgsl = `
struct SchroederFarAggregateDiagnosticSummaryParams {
  force_summary_row_count: u32,
  force_summary_stride: u32,
  diagnostic_stride: u32,
  flags: u32,
  opening_theta: f32,
  far_field_error_bound: f32,
  acceleration_pressure_threshold: f32,
  queue_epoch: f32,
  state_family_id: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> force_summary_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> diagnostic_summary_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederFarAggregateDiagnosticSummaryParams;

const SCHROEDER_DEFAULT_FAR_AGGREGATE_FORCE_SUMMARY_STRIDE_FOR_DIAGNOSTICS: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_STRIDE: u32 = 32u;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }

  let force_summary_stride = max(
    params.force_summary_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_FORCE_SUMMARY_STRIDE_FOR_DIAGNOSTICS
  );
  let diagnostic_stride = max(
    params.diagnostic_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_STRIDE
  );
  let diagnostic_offset = 0u * diagnostic_stride;

  var active_source_count = 0.0;
  var empty_source_count = 0.0;
  var overflow_source_count = 0.0;
  var blocked_source_count = 0.0;
  var total_accepted_candidate_count = 0.0;
  var total_active_candidate_count = 0.0;
  var total_overflow_candidate_count = 0.0;
  var total_blocked_candidate_count = 0.0;
  var total_candidate_budget = 0.0;
  var max_opening_ratio = 0.0;
  var max_far_field_error_bound = 0.0;
  var max_acceleration_magnitude = 0.0;
  var max_potential_magnitude = 0.0;
  var total_aggregate_mass = 0.0;
  var min_distance = 3.402823e38;
  var max_candidate_budget = 0.0;
  var enabled_far_law_mask = 0.0;
  var queue_epoch = params.queue_epoch;
  var state_family_id = params.state_family_id;
  var max_acceleration_source_particle = -1.0;
  var acceleration_pressure_source_count = 0.0;
  var error_bound_pressure_source_count = 0.0;
  var opening_ratio_pressure_source_count = 0.0;

  for (var row_index = 0u; row_index < params.force_summary_row_count; row_index = row_index + 1u) {
    let row_offset = row_index * force_summary_stride;
    let candidate_budget = max(force_summary_rows[row_offset + 5u], 0.0);
    let accepted_candidate_count = max(force_summary_rows[row_offset + 6u], 0.0);
    let active_candidate_count = max(force_summary_rows[row_offset + 7u], 0.0);
    let acceleration = vec3<f32>(
      force_summary_rows[row_offset + 8u],
      force_summary_rows[row_offset + 9u],
      force_summary_rows[row_offset + 10u]
    );
    let potential_magnitude = abs(force_summary_rows[row_offset + 11u]);
    let aggregate_mass = max(force_summary_rows[row_offset + 12u], 0.0);
    let distance_m = force_summary_rows[row_offset + 13u];
    let opening_ratio = max(force_summary_rows[row_offset + 14u], 0.0);
    let far_error_bound = max(force_summary_rows[row_offset + 15u], 0.0);
    let overflow_count = max(force_summary_rows[row_offset + 16u], 0.0);
    let blocked_count = max(force_summary_rows[row_offset + 17u], 0.0);
    let row_status = force_summary_rows[row_offset + 18u];
    let acceleration_magnitude = length(acceleration);
    let active_source = row_status > 0.0 && row_status < 32.0 && active_candidate_count > 0.0;
    let empty_source = row_status >= 32.0 || active_candidate_count <= 0.0;
    let overflow_source = overflow_count > 0.0 || row_status >= 128.0;
    let blocked_source = blocked_count > 0.0;

    active_source_count = active_source_count + select(0.0, 1.0, active_source);
    empty_source_count = empty_source_count + select(0.0, 1.0, empty_source);
    overflow_source_count = overflow_source_count + select(0.0, 1.0, overflow_source);
    blocked_source_count = blocked_source_count + select(0.0, 1.0, blocked_source);
    total_accepted_candidate_count = total_accepted_candidate_count + accepted_candidate_count;
    total_active_candidate_count = total_active_candidate_count + active_candidate_count;
    total_overflow_candidate_count = total_overflow_candidate_count + overflow_count;
    total_blocked_candidate_count = total_blocked_candidate_count + blocked_count;
    total_candidate_budget = total_candidate_budget + candidate_budget;
    max_opening_ratio = max(max_opening_ratio, opening_ratio);
    max_far_field_error_bound = max(max_far_field_error_bound, far_error_bound);
    max_potential_magnitude = max(max_potential_magnitude, potential_magnitude);
    total_aggregate_mass = total_aggregate_mass + aggregate_mass;
    max_candidate_budget = max(max_candidate_budget, candidate_budget);
    enabled_far_law_mask = max(enabled_far_law_mask, force_summary_rows[row_offset + 3u]);
    queue_epoch = max(queue_epoch, force_summary_rows[row_offset + 19u]);
    state_family_id = max(state_family_id, force_summary_rows[row_offset + 20u]);
    if (active_source && distance_m > 0.0) {
      min_distance = min(min_distance, distance_m);
    }
    if (acceleration_magnitude > max_acceleration_magnitude) {
      max_acceleration_magnitude = acceleration_magnitude;
      max_acceleration_source_particle = force_summary_rows[row_offset + 0u];
    }
    acceleration_pressure_source_count = acceleration_pressure_source_count + select(
      0.0,
      1.0,
      params.acceleration_pressure_threshold > 0.0
        && acceleration_magnitude > params.acceleration_pressure_threshold
    );
    error_bound_pressure_source_count = error_bound_pressure_source_count + select(
      0.0,
      1.0,
      far_error_bound > params.far_field_error_bound
    );
    opening_ratio_pressure_source_count = opening_ratio_pressure_source_count + select(
      0.0,
      1.0,
      opening_ratio > params.opening_theta
    );
  }

  let final_min_distance = select(0.0, min_distance, min_distance < 3.402823e38);
  let source_denominator = max(f32(params.force_summary_row_count), 1.0);
  let active_source_denominator = max(active_source_count, 1.0);
  let overflow_pressure_ratio = overflow_source_count / source_denominator;
  let active_candidate_pressure_ratio = total_active_candidate_count / max(total_candidate_budget, 1.0);
  let error_bound_pressure_ratio = error_bound_pressure_source_count / active_source_denominator;
  let opening_ratio_pressure_ratio = opening_ratio_pressure_source_count / active_source_denominator;
  var summary_status = select(32.0, 1.0, active_source_count > 0.0);
  if (overflow_source_count > 0.0 || total_overflow_candidate_count > 0.0) {
    summary_status = 128.0;
  } else if (error_bound_pressure_source_count > 0.0 || opening_ratio_pressure_source_count > 0.0) {
    summary_status = 64.0;
  }

  diagnostic_summary_rows[diagnostic_offset + 0u] = f32(params.force_summary_row_count);
  diagnostic_summary_rows[diagnostic_offset + 1u] = active_source_count;
  diagnostic_summary_rows[diagnostic_offset + 2u] = empty_source_count;
  diagnostic_summary_rows[diagnostic_offset + 3u] = overflow_source_count;
  diagnostic_summary_rows[diagnostic_offset + 4u] = blocked_source_count;
  diagnostic_summary_rows[diagnostic_offset + 5u] = total_accepted_candidate_count;
  diagnostic_summary_rows[diagnostic_offset + 6u] = total_active_candidate_count;
  diagnostic_summary_rows[diagnostic_offset + 7u] = total_overflow_candidate_count;
  diagnostic_summary_rows[diagnostic_offset + 8u] = total_blocked_candidate_count;
  diagnostic_summary_rows[diagnostic_offset + 9u] = max_opening_ratio;
  diagnostic_summary_rows[diagnostic_offset + 10u] = max_far_field_error_bound;
  diagnostic_summary_rows[diagnostic_offset + 11u] = max_acceleration_magnitude;
  diagnostic_summary_rows[diagnostic_offset + 12u] = max_potential_magnitude;
  diagnostic_summary_rows[diagnostic_offset + 13u] = total_aggregate_mass;
  diagnostic_summary_rows[diagnostic_offset + 14u] = final_min_distance;
  diagnostic_summary_rows[diagnostic_offset + 15u] = max_candidate_budget;
  diagnostic_summary_rows[diagnostic_offset + 16u] = enabled_far_law_mask;
  diagnostic_summary_rows[diagnostic_offset + 17u] = queue_epoch;
  diagnostic_summary_rows[diagnostic_offset + 18u] = state_family_id;
  diagnostic_summary_rows[diagnostic_offset + 19u] = max_acceleration_source_particle;
  diagnostic_summary_rows[diagnostic_offset + 20u] = acceleration_pressure_source_count;
  diagnostic_summary_rows[diagnostic_offset + 21u] = error_bound_pressure_source_count;
  diagnostic_summary_rows[diagnostic_offset + 22u] = opening_ratio_pressure_source_count;
  diagnostic_summary_rows[diagnostic_offset + 23u] = overflow_pressure_ratio;
  diagnostic_summary_rows[diagnostic_offset + 24u] = active_candidate_pressure_ratio;
  diagnostic_summary_rows[diagnostic_offset + 25u] = error_bound_pressure_ratio;
  diagnostic_summary_rows[diagnostic_offset + 26u] = opening_ratio_pressure_ratio;
  diagnostic_summary_rows[diagnostic_offset + 27u] = 1.0;
  diagnostic_summary_rows[diagnostic_offset + 28u] = summary_status;
  diagnostic_summary_rows[diagnostic_offset + 29u] = 0.0;
  diagnostic_summary_rows[diagnostic_offset + 30u] = 0.0;
  diagnostic_summary_rows[diagnostic_offset + 31u] = 0.0;
}
`;

export const schroederFarAggregateLawConsumerWgsl = `
struct SchroederFarAggregateLawConsumerParams {
  force_summary_row_count: u32,
  force_summary_stride: u32,
  diagnostic_stride: u32,
  consumer_stride: u32,
  enabled_consumer_law_mask: u32,
  admission_approved: u32,
  flags: u32,
  pad0: u32,
  radiation_scale: f32,
  plasma_scale: f32,
  gas_summary_scale: f32,
  gas_temperature_k: f32,
  max_far_field_error_bound: f32,
  max_opening_ratio: f32,
  queue_epoch: f32,
  state_family_id: f32,
  gas_constant_proxy: f32,
  pad1: f32,
  pad2: f32,
  pad3: f32,
};

@group(0) @binding(0) var<storage, read> force_summary_rows: array<f32>;
@group(0) @binding(1) var<storage, read> diagnostic_summary_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> law_consumer_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederFarAggregateLawConsumerParams;

const SCHROEDER_DEFAULT_FAR_AGGREGATE_FORCE_SUMMARY_STRIDE_FOR_CONSUMERS: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_DIAGNOSTIC_STRIDE_FOR_CONSUMERS: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_LAW_CONSUMER_STRIDE: u32 = 32u;
const SCHROEDER_FAR_LAW_RADIATION_MASK_WGSL: u32 = 16u;
const SCHROEDER_FAR_LAW_PLASMA_MASK_WGSL: u32 = 32u;
const SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK_WGSL: u32 = 64u;
const SCHROEDER_FAR_LAW_CONSUMER_MASK_WGSL: u32 =
  SCHROEDER_FAR_LAW_RADIATION_MASK_WGSL
  | SCHROEDER_FAR_LAW_PLASMA_MASK_WGSL
  | SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK_WGSL;

fn ss_consumer_mask_enabled(mask: u32, bit: u32) -> bool {
  return (mask & bit) != 0u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.force_summary_row_count) {
    return;
  }

  let force_stride = max(
    params.force_summary_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_FORCE_SUMMARY_STRIDE_FOR_CONSUMERS
  );
  let diagnostic_stride = max(
    params.diagnostic_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_DIAGNOSTIC_STRIDE_FOR_CONSUMERS
  );
  let consumer_stride = max(
    params.consumer_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_LAW_CONSUMER_STRIDE
  );
  let force_offset = row_index * force_stride;
  let diagnostic_offset = 0u * diagnostic_stride;
  let consumer_offset = row_index * consumer_stride;

  let source_law_mask = u32(max(force_summary_rows[force_offset + 3u], 0.0));
  let enabled_consumer_mask = params.enabled_consumer_law_mask & SCHROEDER_FAR_LAW_CONSUMER_MASK_WGSL;
  let emitted_consumer_mask = source_law_mask & enabled_consumer_mask;
  let force_status = force_summary_rows[force_offset + 18u];
  let active_candidate_count = max(force_summary_rows[force_offset + 7u], 0.0);
  let accepted_candidate_count = max(force_summary_rows[force_offset + 6u], 0.0);
  let total_aggregate_mass = max(force_summary_rows[force_offset + 12u], 0.0);
  let min_distance_m = max(force_summary_rows[force_offset + 13u], 0.000001);
  let max_opening_ratio = max(force_summary_rows[force_offset + 14u], 0.0);
  let max_far_field_error_bound = max(force_summary_rows[force_offset + 15u], 0.0);
  let acceleration = vec3<f32>(
    force_summary_rows[force_offset + 8u],
    force_summary_rows[force_offset + 9u],
    force_summary_rows[force_offset + 10u]
  );
  let acceleration_magnitude = length(acceleration);
  let potential_magnitude = abs(force_summary_rows[force_offset + 11u]);
  let overflow_count = max(force_summary_rows[force_offset + 16u], 0.0);

  let error_pressure = max_far_field_error_bound > params.max_far_field_error_bound
    && params.max_far_field_error_bound > 0.0;
  let opening_pressure = max_opening_ratio > params.max_opening_ratio
    && params.max_opening_ratio > 0.0;
  let overflow_pressure = overflow_count > 0.0 || diagnostic_summary_rows[diagnostic_offset + 3u] > 0.0;
  let diagnostic_status = diagnostic_summary_rows[diagnostic_offset + 28u];

  let inv_distance2 = 1.0 / max(min_distance_m * min_distance_m, 0.000001);
  let volume_proxy = max(4.1887902047863905 * min_distance_m * min_distance_m * min_distance_m, 0.000001);
  let radiation_exposure = select(
    0.0,
    (potential_magnitude + total_aggregate_mass * inv_distance2) * params.radiation_scale,
    ss_consumer_mask_enabled(emitted_consumer_mask, SCHROEDER_FAR_LAW_RADIATION_MASK_WGSL)
  );
  let plasma_collective_acceleration = select(
    0.0,
    acceleration_magnitude * params.plasma_scale,
    ss_consumer_mask_enabled(emitted_consumer_mask, SCHROEDER_FAR_LAW_PLASMA_MASK_WGSL)
  );
  let gas_density_proxy = select(
    0.0,
    total_aggregate_mass / volume_proxy * params.gas_summary_scale,
    ss_consumer_mask_enabled(emitted_consumer_mask, SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK_WGSL)
  );
  let gas_pressure_proxy = gas_density_proxy * max(params.gas_temperature_k, 0.0) * max(params.gas_constant_proxy, 0.0);

  var status = select(32.0, 1.0, active_candidate_count > 0.0 && force_status > 0.0 && force_status < 32.0);
  if (params.admission_approved == 0u) {
    status = 128.0;
  } else if (emitted_consumer_mask == 0u) {
    status = 96.0;
  } else if (error_pressure || opening_pressure || overflow_pressure) {
    status = 64.0;
  }

  law_consumer_rows[consumer_offset + 0u] = force_summary_rows[force_offset + 0u];
  law_consumer_rows[consumer_offset + 1u] = force_summary_rows[force_offset + 1u];
  law_consumer_rows[consumer_offset + 2u] = force_summary_rows[force_offset + 2u];
  law_consumer_rows[consumer_offset + 3u] = force_summary_rows[force_offset + 3u];
  law_consumer_rows[consumer_offset + 4u] = f32(enabled_consumer_mask);
  law_consumer_rows[consumer_offset + 5u] = f32(emitted_consumer_mask);
  law_consumer_rows[consumer_offset + 6u] = status;
  law_consumer_rows[consumer_offset + 7u] = force_status;
  law_consumer_rows[consumer_offset + 8u] = active_candidate_count;
  law_consumer_rows[consumer_offset + 9u] = accepted_candidate_count;
  law_consumer_rows[consumer_offset + 10u] = total_aggregate_mass;
  law_consumer_rows[consumer_offset + 11u] = min_distance_m;
  law_consumer_rows[consumer_offset + 12u] = max_opening_ratio;
  law_consumer_rows[consumer_offset + 13u] = max_far_field_error_bound;
  law_consumer_rows[consumer_offset + 14u] = acceleration_magnitude;
  law_consumer_rows[consumer_offset + 15u] = potential_magnitude;
  law_consumer_rows[consumer_offset + 16u] = radiation_exposure;
  law_consumer_rows[consumer_offset + 17u] = plasma_collective_acceleration;
  law_consumer_rows[consumer_offset + 18u] = gas_density_proxy;
  law_consumer_rows[consumer_offset + 19u] = gas_pressure_proxy;
  law_consumer_rows[consumer_offset + 20u] = select(0.0, 1.0, error_pressure);
  law_consumer_rows[consumer_offset + 21u] = select(0.0, 1.0, opening_pressure);
  law_consumer_rows[consumer_offset + 22u] = select(0.0, 1.0, overflow_pressure);
  law_consumer_rows[consumer_offset + 23u] = diagnostic_status;
  law_consumer_rows[consumer_offset + 24u] = f32(params.admission_approved);
  law_consumer_rows[consumer_offset + 25u] = 0.0;
  law_consumer_rows[consumer_offset + 26u] = 0.0;
  law_consumer_rows[consumer_offset + 27u] = params.queue_epoch;
  law_consumer_rows[consumer_offset + 28u] = params.state_family_id;
  law_consumer_rows[consumer_offset + 29u] = 1.0;
  law_consumer_rows[consumer_offset + 30u] = f32(row_index);
  law_consumer_rows[consumer_offset + 31u] = 0.0;
}
`;

export const schroederFarAggregateLawConsumerDiagnosticSummaryWgsl = `
struct SchroederFarAggregateLawConsumerDiagnosticSummaryParams {
  law_consumer_row_count: u32,
  law_consumer_stride: u32,
  diagnostic_stride: u32,
  flags: u32,
  radiation_pressure_threshold: f32,
  plasma_pressure_threshold: f32,
  gas_pressure_threshold: f32,
  queue_epoch: f32,
  state_family_id: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> law_consumer_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> diagnostic_summary_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederFarAggregateLawConsumerDiagnosticSummaryParams;

const SCHROEDER_DEFAULT_FAR_AGGREGATE_LAW_CONSUMER_STRIDE_FOR_DIAGNOSTICS: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_STRIDE: u32 = 32u;
const SCHROEDER_FAR_LAW_RADIATION_DIAGNOSTIC_MASK_WGSL: u32 = 16u;
const SCHROEDER_FAR_LAW_PLASMA_DIAGNOSTIC_MASK_WGSL: u32 = 32u;
const SCHROEDER_FAR_LAW_GAS_DIAGNOSTIC_MASK_WGSL: u32 = 64u;

fn ss_consumer_diagnostic_mask_enabled(mask: u32, bit: u32) -> bool {
  return (mask & bit) != 0u;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }

  let consumer_stride = max(
    params.law_consumer_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_LAW_CONSUMER_STRIDE_FOR_DIAGNOSTICS
  );
  let diagnostic_stride = max(
    params.diagnostic_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_STRIDE
  );
  let diagnostic_offset = 0u * diagnostic_stride;

  var active_consumer_count = 0.0;
  var blocked_consumer_count = 0.0;
  var pressure_consumer_count = 0.0;
  var radiation_consumer_count = 0.0;
  var plasma_consumer_count = 0.0;
  var gas_summary_consumer_count = 0.0;
  var total_radiation_exposure = 0.0;
  var max_radiation_exposure = 0.0;
  var max_plasma_acceleration = 0.0;
  var total_gas_density = 0.0;
  var max_gas_pressure = 0.0;
  var total_aggregate_mass = 0.0;
  var max_acceleration = 0.0;
  var max_potential = 0.0;
  var max_opening_ratio = 0.0;
  var max_far_field_error = 0.0;
  var error_pressure_count = 0.0;
  var opening_pressure_count = 0.0;
  var overflow_pressure_count = 0.0;
  var enabled_consumer_mask_union = 0u;
  var emitted_consumer_mask_union = 0u;
  var max_radiation_source_particle = 0.0;
  var max_gas_pressure_source_particle = 0.0;

  for (var row_index = 0u; row_index < params.law_consumer_row_count; row_index = row_index + 1u) {
    let row_offset = row_index * consumer_stride;
    let source_particle_index = law_consumer_rows[row_offset + 0u];
    let enabled_consumer_mask = u32(max(law_consumer_rows[row_offset + 4u], 0.0));
    let emitted_consumer_mask = u32(max(law_consumer_rows[row_offset + 5u], 0.0));
    let status = law_consumer_rows[row_offset + 6u];
    let aggregate_mass = max(law_consumer_rows[row_offset + 10u], 0.0);
    let opening_ratio = max(law_consumer_rows[row_offset + 12u], 0.0);
    let far_field_error = max(law_consumer_rows[row_offset + 13u], 0.0);
    let acceleration_magnitude = max(law_consumer_rows[row_offset + 14u], 0.0);
    let potential_magnitude = max(law_consumer_rows[row_offset + 15u], 0.0);
    let radiation_exposure = max(law_consumer_rows[row_offset + 16u], 0.0);
    let plasma_acceleration = max(law_consumer_rows[row_offset + 17u], 0.0);
    let gas_density = max(law_consumer_rows[row_offset + 18u], 0.0);
    let gas_pressure = max(law_consumer_rows[row_offset + 19u], 0.0);
    let error_pressure = law_consumer_rows[row_offset + 20u] > 0.0;
    let opening_pressure = law_consumer_rows[row_offset + 21u] > 0.0;
    let overflow_pressure = law_consumer_rows[row_offset + 22u] > 0.0;

    enabled_consumer_mask_union = enabled_consumer_mask_union | enabled_consumer_mask;
    emitted_consumer_mask_union = emitted_consumer_mask_union | emitted_consumer_mask;

    if (status > 0.0 && status < 32.0) {
      active_consumer_count = active_consumer_count + 1.0;
    } else if (status >= 96.0 || status <= 0.0) {
      blocked_consumer_count = blocked_consumer_count + 1.0;
    }

    let radiation_pressure = params.radiation_pressure_threshold > 0.0
      && radiation_exposure > params.radiation_pressure_threshold;
    let plasma_pressure = params.plasma_pressure_threshold > 0.0
      && plasma_acceleration > params.plasma_pressure_threshold;
    let gas_pressure_limit = params.gas_pressure_threshold > 0.0
      && gas_pressure > params.gas_pressure_threshold;
    if (status >= 64.0 && status < 96.0
      || error_pressure
      || opening_pressure
      || overflow_pressure
      || radiation_pressure
      || plasma_pressure
      || gas_pressure_limit
    ) {
      pressure_consumer_count = pressure_consumer_count + 1.0;
    }
    if (error_pressure) {
      error_pressure_count = error_pressure_count + 1.0;
    }
    if (opening_pressure) {
      opening_pressure_count = opening_pressure_count + 1.0;
    }
    if (overflow_pressure) {
      overflow_pressure_count = overflow_pressure_count + 1.0;
    }

    if (ss_consumer_diagnostic_mask_enabled(emitted_consumer_mask, SCHROEDER_FAR_LAW_RADIATION_DIAGNOSTIC_MASK_WGSL)
      && radiation_exposure > 0.0
    ) {
      radiation_consumer_count = radiation_consumer_count + 1.0;
      total_radiation_exposure = total_radiation_exposure + radiation_exposure;
      if (radiation_exposure > max_radiation_exposure) {
        max_radiation_exposure = radiation_exposure;
        max_radiation_source_particle = source_particle_index;
      }
    }
    if (ss_consumer_diagnostic_mask_enabled(emitted_consumer_mask, SCHROEDER_FAR_LAW_PLASMA_DIAGNOSTIC_MASK_WGSL)
      && plasma_acceleration > 0.0
    ) {
      plasma_consumer_count = plasma_consumer_count + 1.0;
      max_plasma_acceleration = max(max_plasma_acceleration, plasma_acceleration);
    }
    if (ss_consumer_diagnostic_mask_enabled(emitted_consumer_mask, SCHROEDER_FAR_LAW_GAS_DIAGNOSTIC_MASK_WGSL)
      && gas_density > 0.0
    ) {
      gas_summary_consumer_count = gas_summary_consumer_count + 1.0;
      total_gas_density = total_gas_density + gas_density;
      if (gas_pressure > max_gas_pressure) {
        max_gas_pressure = gas_pressure;
        max_gas_pressure_source_particle = source_particle_index;
      }
    }

    total_aggregate_mass = total_aggregate_mass + aggregate_mass;
    max_acceleration = max(max_acceleration, acceleration_magnitude);
    max_potential = max(max_potential, potential_magnitude);
    max_opening_ratio = max(max_opening_ratio, opening_ratio);
    max_far_field_error = max(max_far_field_error, far_field_error);
  }

  var summary_status = 32.0;
  if (active_consumer_count > 0.0) {
    summary_status = 1.0;
  }
  if (pressure_consumer_count > 0.0) {
    summary_status = 64.0;
  }
  if (overflow_pressure_count > 0.0) {
    summary_status = 128.0;
  }

  diagnostic_summary_rows[diagnostic_offset + 0u] = f32(params.law_consumer_row_count);
  diagnostic_summary_rows[diagnostic_offset + 1u] = active_consumer_count;
  diagnostic_summary_rows[diagnostic_offset + 2u] = blocked_consumer_count;
  diagnostic_summary_rows[diagnostic_offset + 3u] = pressure_consumer_count;
  diagnostic_summary_rows[diagnostic_offset + 4u] = radiation_consumer_count;
  diagnostic_summary_rows[diagnostic_offset + 5u] = plasma_consumer_count;
  diagnostic_summary_rows[diagnostic_offset + 6u] = gas_summary_consumer_count;
  diagnostic_summary_rows[diagnostic_offset + 7u] = total_radiation_exposure;
  diagnostic_summary_rows[diagnostic_offset + 8u] = max_radiation_exposure;
  diagnostic_summary_rows[diagnostic_offset + 9u] = max_plasma_acceleration;
  diagnostic_summary_rows[diagnostic_offset + 10u] = total_gas_density;
  diagnostic_summary_rows[diagnostic_offset + 11u] = max_gas_pressure;
  diagnostic_summary_rows[diagnostic_offset + 12u] = total_aggregate_mass;
  diagnostic_summary_rows[diagnostic_offset + 13u] = max_acceleration;
  diagnostic_summary_rows[diagnostic_offset + 14u] = max_potential;
  diagnostic_summary_rows[diagnostic_offset + 15u] = max_opening_ratio;
  diagnostic_summary_rows[diagnostic_offset + 16u] = max_far_field_error;
  diagnostic_summary_rows[diagnostic_offset + 17u] = error_pressure_count;
  diagnostic_summary_rows[diagnostic_offset + 18u] = opening_pressure_count;
  diagnostic_summary_rows[diagnostic_offset + 19u] = overflow_pressure_count;
  diagnostic_summary_rows[diagnostic_offset + 20u] = f32(enabled_consumer_mask_union);
  diagnostic_summary_rows[diagnostic_offset + 21u] = f32(emitted_consumer_mask_union);
  diagnostic_summary_rows[diagnostic_offset + 22u] = params.queue_epoch;
  diagnostic_summary_rows[diagnostic_offset + 23u] = params.state_family_id;
  diagnostic_summary_rows[diagnostic_offset + 24u] = max_radiation_source_particle;
  diagnostic_summary_rows[diagnostic_offset + 25u] = max_gas_pressure_source_particle;
  diagnostic_summary_rows[diagnostic_offset + 26u] = 1.0;
  diagnostic_summary_rows[diagnostic_offset + 27u] = summary_status;
  diagnostic_summary_rows[diagnostic_offset + 28u] = 0.0;
  diagnostic_summary_rows[diagnostic_offset + 29u] = 0.0;
  diagnostic_summary_rows[diagnostic_offset + 30u] = 0.0;
  diagnostic_summary_rows[diagnostic_offset + 31u] = 0.0;
}
`;

export const schroederFarAggregateGasStateDeltaWgsl = `
struct SchroederFarAggregateGasStateDeltaParams {
  law_consumer_row_count: u32,
  law_consumer_stride: u32,
  gas_state_delta_stride: u32,
  admission_approved: u32,
  enabled_consumer_law_mask: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  reference_pressure_pa: f32,
  pressure_delta_scale: f32,
  density_delta_scale: f32,
  gas_gamma: f32,
  queue_epoch: f32,
  state_family_id: f32,
  target_family_id: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> law_consumer_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> gas_state_delta_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederFarAggregateGasStateDeltaParams;

const SCHROEDER_DEFAULT_GAS_STATE_DELTA_LAW_CONSUMER_STRIDE: u32 = 32u;
const SCHROEDER_DEFAULT_FAR_AGGREGATE_GAS_STATE_DELTA_STRIDE: u32 = 32u;
const SCHROEDER_FAR_LAW_GAS_STATE_DELTA_MASK_WGSL: u32 = 64u;

fn ss_gas_delta_mask_enabled(mask: u32, bit: u32) -> bool {
  return (mask & bit) != 0u;
}

fn ss_gas_state_delta_write_blocked(row_offset: u32, consumer_offset: u32, row_index: u32, status: f32) {
  gas_state_delta_rows[row_offset + 0u] = law_consumer_rows[consumer_offset + 0u];
  gas_state_delta_rows[row_offset + 1u] = law_consumer_rows[consumer_offset + 1u];
  gas_state_delta_rows[row_offset + 2u] = law_consumer_rows[consumer_offset + 2u];
  gas_state_delta_rows[row_offset + 3u] = law_consumer_rows[consumer_offset + 5u];
  gas_state_delta_rows[row_offset + 4u] = 0.0;
  gas_state_delta_rows[row_offset + 5u] = 0.0;
  gas_state_delta_rows[row_offset + 6u] = 0.0;
  gas_state_delta_rows[row_offset + 7u] = max(params.reference_pressure_pa, 0.0);
  gas_state_delta_rows[row_offset + 8u] = 0.0;
  gas_state_delta_rows[row_offset + 9u] = 0.0;
  gas_state_delta_rows[row_offset + 10u] = 0.0;
  gas_state_delta_rows[row_offset + 11u] = 0.0;
  gas_state_delta_rows[row_offset + 12u] = law_consumer_rows[consumer_offset + 8u];
  gas_state_delta_rows[row_offset + 13u] = law_consumer_rows[consumer_offset + 9u];
  gas_state_delta_rows[row_offset + 14u] = law_consumer_rows[consumer_offset + 12u];
  gas_state_delta_rows[row_offset + 15u] = law_consumer_rows[consumer_offset + 13u];
  gas_state_delta_rows[row_offset + 16u] = law_consumer_rows[consumer_offset + 6u];
  gas_state_delta_rows[row_offset + 17u] = law_consumer_rows[consumer_offset + 23u];
  gas_state_delta_rows[row_offset + 18u] = f32(params.admission_approved);
  gas_state_delta_rows[row_offset + 19u] = 0.0;
  gas_state_delta_rows[row_offset + 20u] = 0.0;
  gas_state_delta_rows[row_offset + 21u] = params.queue_epoch;
  gas_state_delta_rows[row_offset + 22u] = params.state_family_id;
  gas_state_delta_rows[row_offset + 23u] = params.target_family_id;
  gas_state_delta_rows[row_offset + 24u] = law_consumer_rows[consumer_offset + 30u];
  gas_state_delta_rows[row_offset + 25u] = f32(row_index);
  gas_state_delta_rows[row_offset + 26u] = 1.0;
  gas_state_delta_rows[row_offset + 27u] = status;
  gas_state_delta_rows[row_offset + 28u] = 1.0;
  gas_state_delta_rows[row_offset + 29u] = 1.0;
  gas_state_delta_rows[row_offset + 30u] = 0.0;
  gas_state_delta_rows[row_offset + 31u] = 0.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.law_consumer_row_count) {
    return;
  }

  let consumer_stride = max(
    params.law_consumer_stride,
    SCHROEDER_DEFAULT_GAS_STATE_DELTA_LAW_CONSUMER_STRIDE
  );
  let delta_stride = max(
    params.gas_state_delta_stride,
    SCHROEDER_DEFAULT_FAR_AGGREGATE_GAS_STATE_DELTA_STRIDE
  );
  let consumer_offset = row_index * consumer_stride;
  let delta_offset = row_index * delta_stride;

  let emitted_consumer_mask = u32(max(law_consumer_rows[consumer_offset + 5u], 0.0));
  let enabled_mask = params.enabled_consumer_law_mask & SCHROEDER_FAR_LAW_GAS_STATE_DELTA_MASK_WGSL;
  let gas_enabled = ss_gas_delta_mask_enabled(emitted_consumer_mask & enabled_mask, SCHROEDER_FAR_LAW_GAS_STATE_DELTA_MASK_WGSL);
  let source_status = law_consumer_rows[consumer_offset + 6u];
  let gas_density = max(law_consumer_rows[consumer_offset + 18u], 0.0);
  let gas_pressure = max(law_consumer_rows[consumer_offset + 19u], 0.0);
  let aggregate_mass = max(law_consumer_rows[consumer_offset + 10u], 0.0);
  let active_candidate_count = max(law_consumer_rows[consumer_offset + 8u], 0.0);

  if (params.admission_approved == 0u) {
    ss_gas_state_delta_write_blocked(delta_offset, consumer_offset, row_index, 128.0);
    return;
  }
  if (!gas_enabled || source_status >= 96.0 || source_status <= 0.0 || gas_pressure <= 0.0 || gas_density <= 0.0) {
    ss_gas_state_delta_write_blocked(delta_offset, consumer_offset, row_index, 96.0);
    return;
  }

  let reference_pressure = max(params.reference_pressure_pa, 0.0);
  let pressure_delta = max(gas_pressure - reference_pressure, 0.0) * max(params.pressure_delta_scale, 0.0);
  let density_delta = gas_density * max(params.density_delta_scale, 0.0);
  let represented_volume = select(0.0, aggregate_mass / max(gas_density, 0.000001), aggregate_mass > 0.0);
  let gamma_minus_one = max(params.gas_gamma - 1.0, 0.1);
  let pressure_work_proxy = pressure_delta * represented_volume / gamma_minus_one;
  var status = select(32.0, 1.0, active_candidate_count > 0.0 && pressure_delta > 0.0);
  if (source_status >= 64.0 && source_status < 96.0) {
    status = 64.0;
  }

  gas_state_delta_rows[delta_offset + 0u] = law_consumer_rows[consumer_offset + 0u];
  gas_state_delta_rows[delta_offset + 1u] = law_consumer_rows[consumer_offset + 1u];
  gas_state_delta_rows[delta_offset + 2u] = law_consumer_rows[consumer_offset + 2u];
  gas_state_delta_rows[delta_offset + 3u] = f32(emitted_consumer_mask);
  gas_state_delta_rows[delta_offset + 4u] = aggregate_mass;
  gas_state_delta_rows[delta_offset + 5u] = gas_density;
  gas_state_delta_rows[delta_offset + 6u] = gas_pressure;
  gas_state_delta_rows[delta_offset + 7u] = reference_pressure;
  gas_state_delta_rows[delta_offset + 8u] = density_delta;
  gas_state_delta_rows[delta_offset + 9u] = pressure_delta;
  gas_state_delta_rows[delta_offset + 10u] = represented_volume;
  gas_state_delta_rows[delta_offset + 11u] = pressure_work_proxy;
  gas_state_delta_rows[delta_offset + 12u] = active_candidate_count;
  gas_state_delta_rows[delta_offset + 13u] = law_consumer_rows[consumer_offset + 9u];
  gas_state_delta_rows[delta_offset + 14u] = law_consumer_rows[consumer_offset + 12u];
  gas_state_delta_rows[delta_offset + 15u] = law_consumer_rows[consumer_offset + 13u];
  gas_state_delta_rows[delta_offset + 16u] = source_status;
  gas_state_delta_rows[delta_offset + 17u] = law_consumer_rows[consumer_offset + 23u];
  gas_state_delta_rows[delta_offset + 18u] = f32(params.admission_approved);
  gas_state_delta_rows[delta_offset + 19u] = 1.0;
  gas_state_delta_rows[delta_offset + 20u] = 0.0;
  gas_state_delta_rows[delta_offset + 21u] = params.queue_epoch;
  gas_state_delta_rows[delta_offset + 22u] = params.state_family_id;
  gas_state_delta_rows[delta_offset + 23u] = params.target_family_id;
  gas_state_delta_rows[delta_offset + 24u] = law_consumer_rows[consumer_offset + 30u];
  gas_state_delta_rows[delta_offset + 25u] = f32(row_index);
  gas_state_delta_rows[delta_offset + 26u] = 1.0;
  gas_state_delta_rows[delta_offset + 27u] = status;
  gas_state_delta_rows[delta_offset + 28u] = 1.0;
  gas_state_delta_rows[delta_offset + 29u] = 1.0;
  gas_state_delta_rows[delta_offset + 30u] = 0.0;
  gas_state_delta_rows[delta_offset + 31u] = 0.0;
}
`;

export const schroederFarAggregateGasCellImportWgsl = `
struct SchroederFarAggregateGasCellImportParams {
  gas_state_delta_row_count: u32,
  gas_state_delta_stride: u32,
  force_summary_row_count: u32,
  force_summary_stride: u32,
  gas_cell_stride: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  default_cell_volume_m3: f32,
  queue_epoch: f32,
  state_family_id: f32,
  target_family_id: f32,
};

@group(0) @binding(0) var<storage, read> gas_state_delta_rows: array<f32>;
@group(0) @binding(1) var<storage, read> force_summary_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> gas_cell_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederFarAggregateGasCellImportParams;

const SCHROEDER_DEFAULT_GAS_CELL_IMPORT_DELTA_STRIDE: u32 = 32u;
const SCHROEDER_DEFAULT_GAS_CELL_IMPORT_FORCE_SUMMARY_STRIDE: u32 = 32u;
const SCHROEDER_DEFAULT_GAS_CELL_IMPORT_PRESSURE_CELL_STRIDE: u32 = 12u;

fn ss_gas_cell_write_empty(cell_offset: u32) {
  gas_cell_rows[cell_offset + 0u] = 0.0;
  gas_cell_rows[cell_offset + 1u] = 0.0;
  gas_cell_rows[cell_offset + 2u] = 0.0;
  gas_cell_rows[cell_offset + 3u] = 0.0;
  gas_cell_rows[cell_offset + 4u] = 0.0;
  gas_cell_rows[cell_offset + 5u] = 0.0;
  gas_cell_rows[cell_offset + 6u] = 0.0;
  gas_cell_rows[cell_offset + 7u] = 0.0;
  gas_cell_rows[cell_offset + 8u] = 0.0;
  gas_cell_rows[cell_offset + 9u] = 0.0;
  gas_cell_rows[cell_offset + 10u] = 0.0;
  gas_cell_rows[cell_offset + 11u] = 0.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.gas_state_delta_row_count) {
    return;
  }

  let delta_stride = max(
    params.gas_state_delta_stride,
    SCHROEDER_DEFAULT_GAS_CELL_IMPORT_DELTA_STRIDE
  );
  let force_stride = max(
    params.force_summary_stride,
    SCHROEDER_DEFAULT_GAS_CELL_IMPORT_FORCE_SUMMARY_STRIDE
  );
  let cell_stride = max(
    params.gas_cell_stride,
    SCHROEDER_DEFAULT_GAS_CELL_IMPORT_PRESSURE_CELL_STRIDE
  );
  let delta_offset = row_index * delta_stride;
  let cell_offset = row_index * cell_stride;

  let status = gas_state_delta_rows[delta_offset + 27u];
  let pressure_import_required = gas_state_delta_rows[delta_offset + 28u] > 0.0;
  let admission_approved = gas_state_delta_rows[delta_offset + 18u] > 0.0;
  let mutation_required = gas_state_delta_rows[delta_offset + 19u] > 0.0;
  let full_readback_required = gas_state_delta_rows[delta_offset + 20u] > 0.0;
  let gas_pressure = max(gas_state_delta_rows[delta_offset + 6u], 0.0);
  let represented_volume = max(
    gas_state_delta_rows[delta_offset + 10u],
    max(params.default_cell_volume_m3, 0.0)
  );

  if (
    status <= 0.0
    || status >= 96.0
    || !pressure_import_required
    || !admission_approved
    || !mutation_required
    || full_readback_required
    || gas_pressure <= 0.0
    || represented_volume <= 0.0
  ) {
    ss_gas_cell_write_empty(cell_offset);
    return;
  }

  let consumer_row_index = u32(max(gas_state_delta_rows[delta_offset + 24u], 0.0));
  var force_row_index = row_index;
  if (consumer_row_index < params.force_summary_row_count) {
    force_row_index = consumer_row_index;
  }
  if (force_row_index >= params.force_summary_row_count) {
    ss_gas_cell_write_empty(cell_offset);
    return;
  }
  let force_offset = force_row_index * force_stride;
  let source_position = vec3<f32>(
    force_summary_rows[force_offset + 24u],
    force_summary_rows[force_offset + 25u],
    force_summary_rows[force_offset + 26u]
  );
  let source_level = max(gas_state_delta_rows[delta_offset + 1u], 0.0);
  let source_chart = max(gas_state_delta_rows[delta_offset + 2u], 0.0);

  gas_cell_rows[cell_offset + 0u] = gas_state_delta_rows[delta_offset + 0u];
  gas_cell_rows[cell_offset + 1u] = source_level;
  gas_cell_rows[cell_offset + 2u] = source_chart;
  gas_cell_rows[cell_offset + 3u] = 1.0;
  gas_cell_rows[cell_offset + 4u] = source_position.x;
  gas_cell_rows[cell_offset + 5u] = source_position.y;
  gas_cell_rows[cell_offset + 6u] = source_position.z;
  gas_cell_rows[cell_offset + 7u] = gas_pressure;
  gas_cell_rows[cell_offset + 8u] = 0.0;
  gas_cell_rows[cell_offset + 9u] = 0.0;
  gas_cell_rows[cell_offset + 10u] = 0.0;
  gas_cell_rows[cell_offset + 11u] = represented_volume;
}
`;

export const schroederFarAggregateForceApplicationWgsl = `
struct SchroederFarAggregateForceApplicationParams {
  particle_count: u32,
  force_summary_row_count: u32,
  force_summary_stride: u32,
  particle_state_stride: u32,
  application_stride: u32,
  admission_approved: u32,
  flags: u32,
  pad0: u32,
  dt_s: f32,
  acceleration_scale: f32,
  max_acceleration_m_per_s2: f32,
  max_far_field_error_bound: f32,
  max_opening_ratio: f32,
  queue_epoch: f32,
  state_family_id: f32,
  pad1: f32,
};

@group(0) @binding(0) var<storage, read> force_summary_rows: array<f32>;
@group(0) @binding(1) var<storage, read> particle_state_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> force_application_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederFarAggregateForceApplicationParams;

const SCHROEDER_DEFAULT_FORCE_APPLICATION_FORCE_SUMMARY_STRIDE: u32 = 32u;
const SCHROEDER_DEFAULT_FORCE_APPLICATION_PARTICLE_STATE_STRIDE: u32 = 8u;
const SCHROEDER_DEFAULT_FORCE_APPLICATION_STRIDE: u32 = 32u;

fn ss_force_application_write_empty(row_offset: u32, force_offset: u32, status: f32) {
  force_application_rows[row_offset + 0u] = force_summary_rows[force_offset + 0u];
  force_application_rows[row_offset + 1u] = force_summary_rows[force_offset + 1u];
  force_application_rows[row_offset + 2u] = force_summary_rows[force_offset + 2u];
  force_application_rows[row_offset + 3u] = force_summary_rows[force_offset + 3u];
  force_application_rows[row_offset + 4u] = 0.0;
  force_application_rows[row_offset + 5u] = 0.0;
  force_application_rows[row_offset + 6u] = 0.0;
  force_application_rows[row_offset + 7u] = 0.0;
  force_application_rows[row_offset + 8u] = 0.0;
  force_application_rows[row_offset + 9u] = 0.0;
  force_application_rows[row_offset + 10u] = 0.0;
  force_application_rows[row_offset + 11u] = max(params.dt_s, 0.0);
  force_application_rows[row_offset + 12u] = 0.0;
  force_application_rows[row_offset + 13u] = 0.0;
  force_application_rows[row_offset + 14u] = 0.0;
  force_application_rows[row_offset + 15u] = 0.0;
  force_application_rows[row_offset + 16u] = 0.0;
  force_application_rows[row_offset + 17u] = force_summary_rows[force_offset + 11u];
  force_application_rows[row_offset + 18u] = force_summary_rows[force_offset + 7u];
  force_application_rows[row_offset + 19u] = force_summary_rows[force_offset + 6u];
  force_application_rows[row_offset + 20u] = force_summary_rows[force_offset + 14u];
  force_application_rows[row_offset + 21u] = force_summary_rows[force_offset + 15u];
  force_application_rows[row_offset + 22u] = 0.0;
  force_application_rows[row_offset + 23u] = force_summary_rows[force_offset + 18u];
  force_application_rows[row_offset + 24u] = f32(params.admission_approved);
  force_application_rows[row_offset + 25u] = 0.0;
  force_application_rows[row_offset + 26u] = 0.0;
  force_application_rows[row_offset + 27u] = params.queue_epoch;
  force_application_rows[row_offset + 28u] = params.state_family_id;
  force_application_rows[row_offset + 29u] = status;
  force_application_rows[row_offset + 30u] = 1.0;
  force_application_rows[row_offset + 31u] = 0.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.force_summary_row_count) {
    return;
  }

  let force_summary_stride = max(
    params.force_summary_stride,
    SCHROEDER_DEFAULT_FORCE_APPLICATION_FORCE_SUMMARY_STRIDE
  );
  let particle_state_stride = max(
    params.particle_state_stride,
    SCHROEDER_DEFAULT_FORCE_APPLICATION_PARTICLE_STATE_STRIDE
  );
  let application_stride = max(params.application_stride, SCHROEDER_DEFAULT_FORCE_APPLICATION_STRIDE);
  let force_offset = row_index * force_summary_stride;
  let application_offset = row_index * application_stride;

  if (params.admission_approved == 0u) {
    ss_force_application_write_empty(application_offset, force_offset, 128.0);
    return;
  }

  let source_particle_f = force_summary_rows[force_offset + 0u];
  let source_particle = u32(max(source_particle_f, 0.0));
  let source_in_range = source_particle < params.particle_count;
  if (!source_in_range) {
    ss_force_application_write_empty(application_offset, force_offset, 96.0);
    return;
  }

  let particle_offset = source_particle * particle_state_stride;
  let source_mass = max(particle_state_rows[particle_offset + 3u], 0.0);
  let raw_acceleration = vec3<f32>(
    force_summary_rows[force_offset + 8u],
    force_summary_rows[force_offset + 9u],
    force_summary_rows[force_offset + 10u]
  ) * params.acceleration_scale;
  let raw_acceleration_magnitude = length(raw_acceleration);
  var acceleration = raw_acceleration;
  if (params.max_acceleration_m_per_s2 > 0.0 && raw_acceleration_magnitude > params.max_acceleration_m_per_s2) {
    acceleration = raw_acceleration * (params.max_acceleration_m_per_s2 / max(raw_acceleration_magnitude, 0.000001));
  }

  let dt_s = max(params.dt_s, 0.0);
  let delta_velocity = acceleration * dt_s;
  let momentum_delta = delta_velocity * source_mass;
  let impulse_magnitude = length(momentum_delta);
  let kinetic_energy_delta = 0.5 * source_mass * dot(delta_velocity, delta_velocity);
  let active_candidate_count = max(force_summary_rows[force_offset + 7u], 0.0);
  let force_status = force_summary_rows[force_offset + 18u];
  let opening_ratio = max(force_summary_rows[force_offset + 14u], 0.0);
  let far_error_bound = max(force_summary_rows[force_offset + 15u], 0.0);
  let active_force = force_status > 0.0 && force_status < 32.0 && active_candidate_count > 0.0;
  let pressure_blocked = (
    (params.max_opening_ratio > 0.0 && opening_ratio > params.max_opening_ratio)
    || (params.max_far_field_error_bound > 0.0 && far_error_bound > params.max_far_field_error_bound)
  );
  var status = select(32.0, 1.0, active_force && source_mass > 0.0);
  if (pressure_blocked) {
    status = 64.0;
  }

  force_application_rows[application_offset + 0u] = source_particle_f;
  force_application_rows[application_offset + 1u] = force_summary_rows[force_offset + 1u];
  force_application_rows[application_offset + 2u] = force_summary_rows[force_offset + 2u];
  force_application_rows[application_offset + 3u] = force_summary_rows[force_offset + 3u];
  force_application_rows[application_offset + 4u] = source_mass;
  force_application_rows[application_offset + 5u] = acceleration.x;
  force_application_rows[application_offset + 6u] = acceleration.y;
  force_application_rows[application_offset + 7u] = acceleration.z;
  force_application_rows[application_offset + 8u] = delta_velocity.x;
  force_application_rows[application_offset + 9u] = delta_velocity.y;
  force_application_rows[application_offset + 10u] = delta_velocity.z;
  force_application_rows[application_offset + 11u] = dt_s;
  force_application_rows[application_offset + 12u] = momentum_delta.x;
  force_application_rows[application_offset + 13u] = momentum_delta.y;
  force_application_rows[application_offset + 14u] = momentum_delta.z;
  force_application_rows[application_offset + 15u] = impulse_magnitude;
  force_application_rows[application_offset + 16u] = kinetic_energy_delta;
  force_application_rows[application_offset + 17u] = force_summary_rows[force_offset + 11u];
  force_application_rows[application_offset + 18u] = active_candidate_count;
  force_application_rows[application_offset + 19u] = force_summary_rows[force_offset + 6u];
  force_application_rows[application_offset + 20u] = opening_ratio;
  force_application_rows[application_offset + 21u] = far_error_bound;
  force_application_rows[application_offset + 22u] = select(1.0, 64.0, pressure_blocked);
  force_application_rows[application_offset + 23u] = force_status;
  force_application_rows[application_offset + 24u] = 1.0;
  force_application_rows[application_offset + 25u] = 1.0;
  force_application_rows[application_offset + 26u] = 0.0;
  force_application_rows[application_offset + 27u] = params.queue_epoch;
  force_application_rows[application_offset + 28u] = params.state_family_id;
  force_application_rows[application_offset + 29u] = status;
  force_application_rows[application_offset + 30u] = 1.0;
  force_application_rows[application_offset + 31u] = 0.0;
}
`;

export const schroederPhaseVolumeMigrationWgsl = `
struct SchroederPhaseVolumeMigrationParams {
  particle_count: u32,
  aggregate_node_count: u32,
  assignment_stride: u32,
  aggregate_node_stride: u32,
  migration_stride: u32,
  min_level: i32,
  max_level: i32,
  flags: u32,
  base_grid_spacing_m: f32,
  target_support_cells: f32,
  support_radius_scale: f32,
  volume_expand_threshold: f32,
  coarsen_level_delta_threshold: f32,
  gas_phase_id: f32,
  migration_epoch: f32,
  aggregate_residual_tolerance: f32,
};

@group(0) @binding(0) var<storage, read> level_assignments: array<f32>;
@group(0) @binding(1) var<storage, read> aggregate_node_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> migration_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederPhaseVolumeMigrationParams;
@group(0) @binding(4) var<storage, read> particle_identity: array<u32>;
@group(0) @binding(5) var<storage, read> interface_fields: array<u32>;

// Query the admitted mechanics dictionary, not all particles. A center's
// 27-node interpolation stencil does not cover a coarse carrier's physical
// volume. Keep that cheap local query, then search occupied dictionary ranges
// across the physical support bounds for larger carriers.
fn ss_pvm_interface_source_ready(particle: u32) -> bool {
  let physical_gas = (params.flags & 1u) != 0u;
  let physical_liquid = (params.flags & 2u) != 0u;
  if (!physical_gas && !physical_liquid) { return false; }
  if (interface_fields[0u] != ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC}u
      || interface_fields[1u] != ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION}u
      || interface_fields[2u] != 3u || particle >= interface_fields[16u]) { return false; }
  let descriptor = interface_fields[24u] + particle * interface_fields[25u];
  if (interface_fields[descriptor + 3u] != 1u) { return false; }
  let family = interface_fields[descriptor];
  return (physical_gas && family == 3u) || (physical_liquid && family == 2u);
}
fn ss_pvm_field_is_interface(my_family: u32, my_material: u32, other_family: u32, other_material: u32) -> bool {
  if (my_family == 3u) {
    return other_family == 1u || other_family == 2u;
  }
  if (my_family == 2u) {
    // Liquid boundary-layer refinement triggers on solid-fluid contact (sinking
    // dense bodies, melting walls), multi-material boundaries, or gas/free surface.
    return other_family == 1u || other_family == 3u || other_material != my_material;
  }
  return false;
}
fn ss_pvm_condensed_interface(particle: u32) -> bool {
  if (!ss_pvm_interface_source_ready(particle)) { return false; }
  let descriptor = interface_fields[24u] + particle * interface_fields[25u];
  let my_family = interface_fields[descriptor];
  let my_material = interface_fields[descriptor + 1u];
  let count = interface_fields[34u];
  let keys = interface_fields[26u]; let stride = interface_fields[27u];
  for (var stencil = 0u; stencil < 27u; stencil++) {
    let field = interface_fields[descriptor + 4u + stencil];
    if (field >= count) { continue; }
    let node = interface_fields[keys + field * stride];
    var lo = 0u; var hi = count;
    while (lo < hi) {
      let middle = lo + (hi - lo) / 2u;
      if (interface_fields[keys + middle * stride] < node) { lo = middle + 1u; }
      else { hi = middle; }
    }
    for (var k = lo; k < count && interface_fields[keys + k * stride] == node; k++) {
      let key = keys + k * stride;
      if (ss_pvm_field_is_interface(my_family, my_material, interface_fields[key + 1u], interface_fields[key + 2u])) {
        return true;
      }
    }
  }
  let assignment = particle * max(params.assignment_stride, 16u);
  let support = ss_pvm_volume_radius(level_assignments[assignment + 3u])
    * max(params.support_radius_scale, 0.0);
  let dx = bitcast<f32>(interface_fields[23u]);
  if (!(dx > 0.0) || !(support > 1.5 * dx)) { return false; }
  let dims = vec3<u32>(interface_fields[19u], interface_fields[20u], interface_fields[21u]);
  if (any(dims == vec3<u32>(0u))) { return false; }
  let position = vec3<f32>(level_assignments[assignment + 12u],
    level_assignments[assignment + 13u], level_assignments[assignment + 14u]);
  let center = position / dx + vec3<f32>(f32(interface_fields[22u]));
  let extent = vec3<f32>(support / dx);
  let lower = max(vec3<i32>(ceil(center - extent)), vec3<i32>(0));
  let upper = min(vec3<i32>(floor(center + extent)), vec3<i32>(dims) - vec3<i32>(1));
  if (any(lower > upper)) { return false; }
  // Dense node IDs are x-major, then y, then z. One lower-bound per x/y
  // stripe skips empty space; the inner scan visits only occupied fields.
  // This conservative support box decides refinement, never heat or force.
  for (var x = lower.x; x <= upper.x; x++) {
    for (var y = lower.y; y <= upper.y; y++) {
      let stripe = (u32(x) * dims.y + u32(y)) * dims.z;
      let first = stripe + u32(lower.z); let last = stripe + u32(upper.z);
      var lo = 0u; var hi = count;
      while (lo < hi) {
        let middle = lo + (hi - lo) / 2u;
        if (interface_fields[keys + middle * stride] < first) { lo = middle + 1u; }
        else { hi = middle; }
      }
      for (var field = lo; field < count; field++) {
        let key = keys + field * stride;
        if (interface_fields[key] > last) { break; }
        if (ss_pvm_field_is_interface(my_family, my_material, interface_fields[key + 1u], interface_fields[key + 2u])) {
          return true;
        }
      }
    }
  }
  return false;
}

const SCHROEDER_PVM_ASSIGNMENT_STRIDE: u32 = 16u;
const SCHROEDER_PVM_AGGREGATE_NODE_STRIDE: u32 = 32u;
const SCHROEDER_PVM_MIGRATION_STRIDE: u32 = 32u;
const SCHROEDER_PVM_PI: f32 = 3.141592653589793;

fn ss_pvm_positive(value: f32) -> bool {
  return value == value && value > 0.0;
}

fn ss_pvm_clamp_i32(value: i32, lo: i32, hi: i32) -> i32 {
  return min(max(value, lo), hi);
}

fn ss_pvm_volume_radius(volume_m3: f32) -> f32 {
  if (!ss_pvm_positive(volume_m3)) {
    return 0.0;
  }
  return pow((3.0 * volume_m3) / (4.0 * SCHROEDER_PVM_PI), 0.3333333333333333);
}

fn ss_pvm_level_from_support(support_radius_m: f32) -> i32 {
  let base_dx = max(params.base_grid_spacing_m, 0.000001);
  let target_cells = max(params.target_support_cells, 1.0);
  let native_dx_unclamped = max(support_radius_m / target_cells, 0.000001);
  let raw_level = i32(round(log2(native_dx_unclamped / base_dx)));
  return ss_pvm_clamp_i32(raw_level, params.min_level, params.max_level);
}

fn ss_pvm_grid_spacing_for_level(level: i32) -> f32 {
  return max(params.base_grid_spacing_m, 0.000001) * exp2(f32(level));
}

fn ss_pvm_active_aggregate_node(node_offset: u32) -> bool {
  let status = aggregate_node_rows[node_offset + 3u];
  let admission = aggregate_node_rows[node_offset + 30u];
  return status > 0.0 && status < 32.0 && admission > 0.0;
}

fn ss_pvm_same_cell(
  node_offset: u32,
  particle_domain: f32,
  target_level: i32,
  chart_id: f32,
  target_cell: vec3<f32>
) -> bool {
  let node_domain = aggregate_node_rows[node_offset + 0u];
  let node_level = aggregate_node_rows[node_offset + 1u];
  let node_chart = aggregate_node_rows[node_offset + 2u];
  let node_cell = vec3<f32>(
    aggregate_node_rows[node_offset + 4u],
    aggregate_node_rows[node_offset + 5u],
    aggregate_node_rows[node_offset + 6u]
  );
  return abs(node_domain - particle_domain) < 0.5
    && abs(node_level - f32(target_level)) < 0.5
    && abs(node_chart - chart_id) < 0.5
    && all(abs(node_cell - target_cell) < vec3<f32>(0.5));
}

fn ss_pvm_write_row(
  migration_offset: u32,
  particle_index: u32,
  source_level: f32,
  target_level: f32,
  status: f32,
  source_support: f32,
  target_support: f32,
  rest_volume: f32,
  represented_volume: f32,
  volume_ratio: f32,
  level_delta: f32,
  phase_id: f32,
  material_id: f32,
  aggregate_node_index: f32,
  aggregate_match_count: f32,
  aggregate_suppressed_duplicate_count: f32,
  aggregate_mass: f32,
  aggregate_volume: f32,
  aggregate_mass_residual: f32,
  aggregate_volume_residual: f32,
  source_grid_spacing: f32,
  target_grid_spacing: f32,
  aggregate_volume_ratio: f32,
  coarsen_eligible: f32,
  refine_required: f32,
  phase_volume_mode_id: f32,
  aggregate_coherence_status: f32,
  conservation_residual_status: f32,
  chart_id: f32,
  migration_mode_id: f32,
  state_admission_required: f32,
  refine_pressure_reason_mask: f32
) {
  migration_rows[migration_offset + 0u] = f32(particle_index);
  migration_rows[migration_offset + 1u] = source_level;
  migration_rows[migration_offset + 2u] = target_level;
  migration_rows[migration_offset + 3u] = status;
  migration_rows[migration_offset + 4u] = source_support;
  migration_rows[migration_offset + 5u] = target_support;
  migration_rows[migration_offset + 6u] = rest_volume;
  migration_rows[migration_offset + 7u] = represented_volume;
  migration_rows[migration_offset + 8u] = volume_ratio;
  migration_rows[migration_offset + 9u] = level_delta;
  migration_rows[migration_offset + 10u] = phase_id;
  migration_rows[migration_offset + 11u] = material_id;
  migration_rows[migration_offset + 12u] = aggregate_node_index;
  migration_rows[migration_offset + 13u] = aggregate_match_count;
  migration_rows[migration_offset + 14u] = aggregate_suppressed_duplicate_count;
  migration_rows[migration_offset + 15u] = aggregate_mass;
  migration_rows[migration_offset + 16u] = aggregate_volume;
  migration_rows[migration_offset + 17u] = aggregate_mass_residual;
  migration_rows[migration_offset + 18u] = aggregate_volume_residual;
  migration_rows[migration_offset + 19u] = source_grid_spacing;
  migration_rows[migration_offset + 20u] = target_grid_spacing;
  migration_rows[migration_offset + 21u] = aggregate_volume_ratio;
  migration_rows[migration_offset + 22u] = coarsen_eligible;
  migration_rows[migration_offset + 23u] = refine_required;
  migration_rows[migration_offset + 24u] = phase_volume_mode_id;
  migration_rows[migration_offset + 25u] = aggregate_coherence_status;
  migration_rows[migration_offset + 26u] = conservation_residual_status;
  migration_rows[migration_offset + 27u] = params.migration_epoch;
  migration_rows[migration_offset + 28u] = chart_id;
  migration_rows[migration_offset + 29u] = migration_mode_id;
  migration_rows[migration_offset + 30u] = state_admission_required;
  migration_rows[migration_offset + 31u] = refine_pressure_reason_mask;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let assignment_stride = max(params.assignment_stride, SCHROEDER_PVM_ASSIGNMENT_STRIDE);
  let aggregate_node_stride = max(params.aggregate_node_stride, SCHROEDER_PVM_AGGREGATE_NODE_STRIDE);
  let migration_stride = max(params.migration_stride, SCHROEDER_PVM_MIGRATION_STRIDE);
  let assignment_offset = particle_index * assignment_stride;
  let migration_offset = particle_index * migration_stride;

  let source_level = level_assignments[assignment_offset + 0u];
  let source_grid_spacing = level_assignments[assignment_offset + 1u];
  let source_support = level_assignments[assignment_offset + 2u];
  let represented_volume = level_assignments[assignment_offset + 3u];
  let rest_volume = level_assignments[assignment_offset + 4u];
  let phase_id = level_assignments[assignment_offset + 8u];
  let material_id = level_assignments[assignment_offset + 9u];
  let position = vec3<f32>(
    level_assignments[assignment_offset + 12u],
    level_assignments[assignment_offset + 13u],
    level_assignments[assignment_offset + 14u]
  );
  let chart_id = level_assignments[assignment_offset + 15u];
  let physical_gas_grouping = (params.flags & 1u) != 0u;
  let physical_liquid_grouping = (params.flags & 2u) != 0u;
  let physical_fluid_grouping = physical_gas_grouping || physical_liquid_grouping;
  let liquid_phase = abs(phase_id - 2.0) < 0.5;
  let physical_domain = select(material_id, -material_id, liquid_phase);
  let particle_domain = select(f32(particle_identity[particle_index]), physical_domain, physical_fluid_grouping);

  if (!ss_pvm_positive(represented_volume) || !ss_pvm_positive(rest_volume)) {
    ss_pvm_write_row(
      migration_offset,
      particle_index,
      source_level,
      source_level,
      32.0,
      source_support,
      source_support,
      rest_volume,
      represented_volume,
      0.0,
      0.0,
      phase_id,
      material_id,
      -1.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      source_grid_spacing,
      source_grid_spacing,
      0.0,
      0.0,
      1.0,
      0.0,
      0.0,
      0.0,
      chart_id,
      1.0,
      1.0,
      0.0
    );
    return;
  }

  let volume_ratio = max(represented_volume / max(rest_volume, 0.000001), 0.0);
  let physical_support = ss_pvm_volume_radius(represented_volume) * max(params.support_radius_scale, 0.0);
  let at_interface = ss_pvm_condensed_interface(particle_index);
  let interface_support = max(params.target_support_cells, 1.0) * source_grid_spacing;
  let interface_refine = at_interface && physical_support
    > interface_support * (1.0 + max(level_assignments[assignment_offset + 11u], 0.0));
  // One octet per accepted step halves each child's support radius. The
  // hysteresis band avoids threshold flicker; interface rows never coarsen.
  let target_support = select(max(physical_support, source_support), physical_support * 0.5, interface_refine);
  let target_level_i32 = select(ss_pvm_level_from_support(target_support), i32(source_level), physical_fluid_grouping);
  let target_level = f32(target_level_i32);
  let target_grid_spacing = ss_pvm_grid_spacing_for_level(target_level_i32);
  let level_delta = target_level - source_level;
  let target_cell = floor(position / max(target_grid_spacing, 0.000001));

  var aggregate_node_index = -1.0;
  var aggregate_match_count = 0.0;
  var aggregate_suppressed_duplicate_count = 0.0;
  var aggregate_mass = 0.0;
  var aggregate_volume = 0.0;
  var aggregate_mass_residual = 0.0;
  var aggregate_volume_residual = 0.0;
  for (var node_index = 0u; node_index < params.aggregate_node_count; node_index = node_index + 1u) {
    let node_offset = node_index * aggregate_node_stride;
    if (ss_pvm_active_aggregate_node(node_offset)
      && ss_pvm_same_cell(node_offset, particle_domain, target_level_i32, chart_id, target_cell)
      && aggregate_node_index < 0.0) {
      aggregate_node_index = f32(node_index);
      aggregate_match_count = aggregate_node_rows[node_offset + 15u];
      aggregate_suppressed_duplicate_count = aggregate_node_rows[node_offset + 16u];
      aggregate_mass = aggregate_node_rows[node_offset + 8u];
      aggregate_volume = aggregate_node_rows[node_offset + 9u];
      aggregate_mass_residual = aggregate_node_rows[node_offset + 17u];
      aggregate_volume_residual = aggregate_node_rows[node_offset + 18u];
    }
  }

  let gas_phase = abs(phase_id - params.gas_phase_id) < 0.5;
  let phase_expanded = gas_phase && volume_ratio >= max(params.volume_expand_threshold, 1.0);
  let aggregate_matched = aggregate_node_index >= 0.0;
  let aggregate_volume_ratio = select(0.0, aggregate_volume / max(rest_volume, 0.000001), aggregate_volume > 0.0);
  let residual_tolerance = max(params.aggregate_residual_tolerance, 0.0);
  let mass_residual_ok = abs(aggregate_mass_residual) <= residual_tolerance * max(abs(aggregate_mass), 1.0);
  let volume_residual_ok = abs(aggregate_volume_residual) <= residual_tolerance * max(abs(aggregate_volume), 1.0);
  let residual_ok = !aggregate_matched || (mass_residual_ok && volume_residual_ok);
  let aggregate_coherence_status = select(0.0, 1.0, aggregate_matched);
  let conservation_residual_status = select(2.0, 1.0, residual_ok);
  let delta_threshold = max(params.coarsen_level_delta_threshold, 0.0);
  let missing_aggregate_refine_pressure = phase_expanded && !aggregate_matched;
  let residual_refine_pressure = phase_expanded && aggregate_matched && !residual_ok;
  let sparse_surface_refine_pressure = phase_expanded
    && aggregate_matched
    && residual_ok
    && aggregate_match_count <= 1.0
    && level_delta >= delta_threshold;
  var refine_pressure_reason_mask_u32 = 0u;
  if (missing_aggregate_refine_pressure) {
    refine_pressure_reason_mask_u32 = refine_pressure_reason_mask_u32 | 1u;
  }
  if (residual_refine_pressure) {
    refine_pressure_reason_mask_u32 = refine_pressure_reason_mask_u32 | 2u;
  }
  if (sparse_surface_refine_pressure) {
    refine_pressure_reason_mask_u32 = refine_pressure_reason_mask_u32 | 4u;
  }
  if (interface_refine) { refine_pressure_reason_mask_u32 |= 64u; }
  let refine_pressure_reason_mask = f32(refine_pressure_reason_mask_u32);
  // Legacy expansion hysteresis: only INTEGRITY reasons (missing aggregate, residual
  // violation - bits 1|2) force a refine. The sparse-surface bit stays in
  // the telemetry mask but must not convert a coarsen-worthy lone particle
  // into a split: a just-merged particle is always alone in its cell, so
  // sparse-surface-as-refine manufactures a merge/split oscillation
  // (+N/-N admitted deltas alternating every step, freezing the physics at
  // a fixed point). Lone coarsen-eligible particles simply keep their
  // coarsen eligibility (the allocator ignores partnerless coarsen rows)
  // and in-place level migration handles them via the phase-volume level
  // update overlay.
  let integrity_refine_mask_u32 = refine_pressure_reason_mask_u32 & 3u;
  let legacy_coarsen = phase_expanded && !at_interface
    && level_delta >= delta_threshold
    && aggregate_matched
    && residual_ok
    && integrity_refine_mask_u32 == 0u;
  // Away from interfaces one bounded octet may coarsen inside a source cell.
  // Use the lower hysteresis envelope of a 2:1 bulk support radius; a merged
  // singleton cannot merge again. The writer independently validates actual
  // members' material, caloric branch and constitutive keys before any write.
  let bulk_support_limit = 2.0 * interface_support
    * max(1.0 - max(level_assignments[assignment_offset + 11u], 0.0), 0.0);
  let aggregate_support = ss_pvm_volume_radius(aggregate_volume) * max(params.support_radius_scale, 0.0);
  let physical_coarsen_phase = (physical_gas_grouping && gas_phase) || (physical_liquid_grouping && liquid_phase);
  let physical_coarsen = physical_coarsen_phase && ss_pvm_interface_source_ready(particle_index)
    && !at_interface && aggregate_matched && residual_ok
    && aggregate_match_count >= 2.0 && aggregate_match_count <= 8.0
    && ss_pvm_positive(aggregate_volume) && aggregate_support <= bulk_support_limit;
  let coarsen = select(legacy_coarsen, physical_coarsen, physical_fluid_grouping);
  let refine = interface_refine || (phase_expanded && integrity_refine_mask_u32 != 0u);

  var status = 1.0;
  if (phase_expanded) {
    status = status + 2.0;
  }
  if (coarsen) {
    status = status + 4.0;
  }
  if (aggregate_matched) {
    status = status + 8.0;
  }
  if (!residual_ok) {
    status = status + 16.0;
  }

  ss_pvm_write_row(
    migration_offset,
    particle_index,
    source_level,
    target_level,
    status,
    source_support,
    target_support,
    rest_volume,
    represented_volume,
    volume_ratio,
    level_delta,
    phase_id,
    material_id,
    aggregate_node_index,
    aggregate_match_count,
    aggregate_suppressed_duplicate_count,
    aggregate_mass,
    aggregate_volume,
    aggregate_mass_residual,
    aggregate_volume_residual,
    source_grid_spacing,
    target_grid_spacing,
    aggregate_volume_ratio,
    select(0.0, 1.0, coarsen),
    select(0.0, 1.0, refine),
    1.0,
    aggregate_coherence_status,
    conservation_residual_status,
    chart_id,
    1.0,
    1.0,
    refine_pressure_reason_mask
  );
}
`;

export const schroederPhaseVolumeSplitMergeProposalWgsl = `
struct SchroederPhaseVolumeSplitMergeProposalParams {
  migration_row_count: u32,
  migration_stride: u32,
  proposal_stride: u32,
  flags: u32,
  proposal_epoch: f32,
  state_family_id: f32,
  coarsen_mode_id: f32,
  refine_mode_id: f32,
  aggregate_node_count: u32,
  aggregate_node_stride: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> migration_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> proposal_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederPhaseVolumeSplitMergeProposalParams;
@group(0) @binding(3) var<storage, read> aggregate_node_rows: array<f32>;

const SCHROEDER_PVSMP_MIGRATION_STRIDE: u32 = 32u;
const SCHROEDER_PVSMP_PROPOSAL_STRIDE: u32 = 32u;
const SCHROEDER_PVSMP_AGGREGATE_NODE_STRIDE: u32 = 32u;

// Cell momentum for the merged child: the hierarchy aggregate node rows
// already reduce member momentum (columns 10-12); forward it so the
// materialized child can carry the mass-weighted cell velocity instead of
// the merge leader's. Returns zero when no aggregate node rows are bound.
fn ss_pvsmp_cell_momentum_energy(aggregate_node_index: f32) -> vec4<f32> {
  if (params.aggregate_node_count == 0u || aggregate_node_index < 0.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  let node_index = u32(aggregate_node_index);
  if (node_index >= params.aggregate_node_count) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  let node_stride = max(params.aggregate_node_stride, SCHROEDER_PVSMP_AGGREGATE_NODE_STRIDE);
  let node_offset = node_index * node_stride;
  if (aggregate_node_rows[node_offset + 3u] <= 0.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  return vec4<f32>(
    aggregate_node_rows[node_offset + 10u],
    aggregate_node_rows[node_offset + 11u],
    aggregate_node_rows[node_offset + 12u],
    aggregate_node_rows[node_offset + 13u]
  );
}

fn ss_pvsmp_active_migration(migration_offset: u32) -> bool {
  let status = migration_rows[migration_offset + 3u];
  return status > 0.0 && status < 32.0;
}

fn ss_pvsmp_write_empty(proposal_offset: u32, migration_offset: u32, status: f32) {
  proposal_rows[proposal_offset + 0u] = migration_rows[migration_offset + 0u];
  proposal_rows[proposal_offset + 1u] = migration_rows[migration_offset + 1u];
  proposal_rows[proposal_offset + 2u] = migration_rows[migration_offset + 2u];
  proposal_rows[proposal_offset + 3u] = status;
  for (var column = 4u; column < SCHROEDER_PVSMP_PROPOSAL_STRIDE; column = column + 1u) {
    proposal_rows[proposal_offset + column] = 0.0;
  }
  proposal_rows[proposal_offset + 27u] = params.proposal_epoch;
  proposal_rows[proposal_offset + 28u] = params.state_family_id;
  proposal_rows[proposal_offset + 29u] = 1.0;
  proposal_rows[proposal_offset + 30u] = 1.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.migration_row_count) {
    return;
  }

  let migration_stride = max(params.migration_stride, SCHROEDER_PVSMP_MIGRATION_STRIDE);
  let proposal_stride = max(params.proposal_stride, SCHROEDER_PVSMP_PROPOSAL_STRIDE);
  let migration_offset = row_index * migration_stride;
  let proposal_offset = row_index * proposal_stride;

  if (!ss_pvsmp_active_migration(migration_offset)) {
    ss_pvsmp_write_empty(proposal_offset, migration_offset, 32.0);
    return;
  }

  let coarsen_eligible = migration_rows[migration_offset + 22u];
  let refine_required = migration_rows[migration_offset + 23u];
  if (coarsen_eligible <= 0.0 && refine_required <= 0.0) {
    ss_pvsmp_write_empty(proposal_offset, migration_offset, 32.0);
    return;
  }

  let refine_pressure_reason_mask = migration_rows[migration_offset + 31u];
  let conservation_residual_status = migration_rows[migration_offset + 26u];
  let proposal_mode_id = select(
    0.0,
    select(params.coarsen_mode_id, params.refine_mode_id, refine_required > 0.0),
    coarsen_eligible > 0.0 || refine_required > 0.0
  );
  var status = 1.0;
  if (coarsen_eligible > 0.0) {
    status = status + 2.0;
  }
  if (refine_required > 0.0) {
    status = status + 4.0;
  }
  if (refine_pressure_reason_mask > 0.0) {
    status = status + 8.0;
  }
  if (conservation_residual_status > 1.0) {
    status = status + 16.0;
  }

  proposal_rows[proposal_offset + 0u] = migration_rows[migration_offset + 0u];
  proposal_rows[proposal_offset + 1u] = migration_rows[migration_offset + 1u];
  proposal_rows[proposal_offset + 2u] = migration_rows[migration_offset + 2u];
  proposal_rows[proposal_offset + 3u] = status;
  proposal_rows[proposal_offset + 4u] = proposal_mode_id;
  proposal_rows[proposal_offset + 5u] = coarsen_eligible;
  proposal_rows[proposal_offset + 6u] = refine_required;
  proposal_rows[proposal_offset + 7u] = refine_pressure_reason_mask;
  proposal_rows[proposal_offset + 8u] = migration_rows[migration_offset + 6u];
  proposal_rows[proposal_offset + 9u] = migration_rows[migration_offset + 7u];
  proposal_rows[proposal_offset + 10u] = migration_rows[migration_offset + 8u];
  proposal_rows[proposal_offset + 11u] = migration_rows[migration_offset + 9u];
  proposal_rows[proposal_offset + 12u] = migration_rows[migration_offset + 12u];
  proposal_rows[proposal_offset + 13u] = migration_rows[migration_offset + 13u];
  proposal_rows[proposal_offset + 14u] = migration_rows[migration_offset + 15u];
  proposal_rows[proposal_offset + 15u] = migration_rows[migration_offset + 16u];
  proposal_rows[proposal_offset + 16u] = migration_rows[migration_offset + 17u];
  proposal_rows[proposal_offset + 17u] = migration_rows[migration_offset + 18u];
  let cell_momentum_energy = select(
    vec4<f32>(0.0, 0.0, 0.0, 0.0),
    ss_pvsmp_cell_momentum_energy(migration_rows[migration_offset + 12u]),
    coarsen_eligible > 0.0
  );
  proposal_rows[proposal_offset + 18u] = cell_momentum_energy.x;
  proposal_rows[proposal_offset + 19u] = cell_momentum_energy.y;
  proposal_rows[proposal_offset + 20u] = cell_momentum_energy.z;
  proposal_rows[proposal_offset + 21u] = cell_momentum_energy.w;
  proposal_rows[proposal_offset + 22u] = migration_rows[migration_offset + 4u];
  proposal_rows[proposal_offset + 23u] = migration_rows[migration_offset + 5u];
  proposal_rows[proposal_offset + 24u] = migration_rows[migration_offset + 19u];
  proposal_rows[proposal_offset + 25u] = migration_rows[migration_offset + 20u];
  proposal_rows[proposal_offset + 26u] = migration_rows[migration_offset + 28u];
  proposal_rows[proposal_offset + 27u] = params.proposal_epoch;
  proposal_rows[proposal_offset + 28u] = params.state_family_id;
  proposal_rows[proposal_offset + 29u] = 1.0;
  proposal_rows[proposal_offset + 30u] = 1.0;
  proposal_rows[proposal_offset + 31u] = 1.0;
}
`;

export const schroederPhaseVolumeSplitMergeApplyWgsl = `
struct SchroederPhaseVolumeSplitMergeApplyParams {
  proposal_row_count: u32,
  proposal_stride: u32,
  apply_stride: u32,
  admission_approved: u32,
  apply_epoch: f32,
  state_family_id: f32,
  residual_tolerance: f32,
  flags: f32,
};

@group(0) @binding(0) var<storage, read> proposal_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> apply_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederPhaseVolumeSplitMergeApplyParams;

const SCHROEDER_PVSMA_PROPOSAL_STRIDE: u32 = 32u;
const SCHROEDER_PVSMA_APPLY_STRIDE: u32 = 32u;

fn ss_pvsma_active_proposal(proposal_offset: u32) -> bool {
  let status = proposal_rows[proposal_offset + 3u];
  return status > 0.0 && status < 32.0 && params.admission_approved > 0u;
}

fn ss_pvsma_write_empty(apply_offset: u32, proposal_offset: u32, status: f32) {
  apply_rows[apply_offset + 0u] = proposal_rows[proposal_offset + 0u];
  apply_rows[apply_offset + 1u] = proposal_rows[proposal_offset + 1u];
  apply_rows[apply_offset + 2u] = proposal_rows[proposal_offset + 2u];
  apply_rows[apply_offset + 3u] = status;
  for (var column = 4u; column < SCHROEDER_PVSMA_APPLY_STRIDE; column = column + 1u) {
    apply_rows[apply_offset + column] = 0.0;
  }
  apply_rows[apply_offset + 6u] = f32(params.admission_approved);
  apply_rows[apply_offset + 30u] = params.apply_epoch;
  apply_rows[apply_offset + 31u] = params.state_family_id;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.proposal_row_count) {
    return;
  }

  let proposal_stride = max(params.proposal_stride, SCHROEDER_PVSMA_PROPOSAL_STRIDE);
  let apply_stride = max(params.apply_stride, SCHROEDER_PVSMA_APPLY_STRIDE);
  let proposal_offset = row_index * proposal_stride;
  let apply_offset = row_index * apply_stride;

  if (!ss_pvsma_active_proposal(proposal_offset)) {
    ss_pvsma_write_empty(apply_offset, proposal_offset, 32.0);
    return;
  }

  let proposal_mode_id = proposal_rows[proposal_offset + 4u];
  let coarsen_eligible = proposal_rows[proposal_offset + 5u] > 0.0;
  let refine_required = proposal_rows[proposal_offset + 6u] > 0.0;
  let rest_volume_m3 = proposal_rows[proposal_offset + 8u];
  let represented_volume_m3 = proposal_rows[proposal_offset + 9u];
  let phase_volume_ratio = proposal_rows[proposal_offset + 10u];
  let level_delta = proposal_rows[proposal_offset + 11u];
  let aggregate_matching_count = max(proposal_rows[proposal_offset + 13u], 1.0);
  let aggregate_mass_kg = proposal_rows[proposal_offset + 14u];
  let aggregate_volume_m3 = proposal_rows[proposal_offset + 15u];
  let aggregate_mass_residual_kg = proposal_rows[proposal_offset + 16u];
  let aggregate_volume_residual_m3 = proposal_rows[proposal_offset + 17u];
  let residual_issue =
    abs(aggregate_mass_residual_kg) > params.residual_tolerance
    || abs(aggregate_volume_residual_m3) > params.residual_tolerance;

  var status = 1.0 + 8.0;
  if (coarsen_eligible) {
    status = status + 2.0;
  }
  if (refine_required) {
    status = status + 4.0;
  }
  if (residual_issue) {
    status = status + 16.0;
  }

  let coarsen_delta = 1.0 - aggregate_matching_count;
  // Geometric refinement is three-dimensional: a single 2:1 refinement
  // creates eight children, retaining the source plus seven spare lineages.
  // Preserve the existing integrity-repair policy for other reason masks.
  let interface_refine = (u32(proposal_rows[proposal_offset + 7u]) & 64u) != 0u;
  let refine_delta = select(max(1.0, ceil(abs(level_delta))) - 1.0, 7.0, interface_refine);
  let particle_count_delta = select(
    select(0.0, coarsen_delta, coarsen_eligible),
    refine_delta,
    refine_required
  );
  // Coarsen children carry the aggregated cell mass; refine children get
  // their mass divided from the source at materialization (zero here so the
  // divide-mass split path is unambiguous).
  let target_mass_kg = select(0.0, aggregate_mass_kg, coarsen_eligible && !refine_required);
  let target_volume_m3 = select(represented_volume_m3, aggregate_volume_m3, coarsen_eligible && !refine_required);

  apply_rows[apply_offset + 0u] = proposal_rows[proposal_offset + 0u];
  apply_rows[apply_offset + 1u] = proposal_rows[proposal_offset + 1u];
  apply_rows[apply_offset + 2u] = proposal_rows[proposal_offset + 2u];
  apply_rows[apply_offset + 3u] = status;
  apply_rows[apply_offset + 4u] = proposal_mode_id;
  apply_rows[apply_offset + 5u] = proposal_mode_id;
  apply_rows[apply_offset + 6u] = f32(params.admission_approved);
  apply_rows[apply_offset + 7u] = particle_count_delta;
  apply_rows[apply_offset + 8u] = 0.0;
  apply_rows[apply_offset + 9u] = target_mass_kg;
  apply_rows[apply_offset + 10u] = aggregate_mass_residual_kg;
  apply_rows[apply_offset + 11u] = 0.0;
  apply_rows[apply_offset + 12u] = target_volume_m3;
  apply_rows[apply_offset + 13u] = aggregate_volume_residual_m3;
  apply_rows[apply_offset + 14u] = proposal_rows[proposal_offset + 18u];
  apply_rows[apply_offset + 15u] = proposal_rows[proposal_offset + 19u];
  apply_rows[apply_offset + 16u] = proposal_rows[proposal_offset + 20u];
  apply_rows[apply_offset + 17u] = proposal_rows[proposal_offset + 21u];
  apply_rows[apply_offset + 18u] = rest_volume_m3;
  apply_rows[apply_offset + 19u] = represented_volume_m3;
  apply_rows[apply_offset + 20u] = phase_volume_ratio;
  apply_rows[apply_offset + 21u] = proposal_rows[proposal_offset + 12u];
  apply_rows[apply_offset + 22u] = aggregate_matching_count;
  apply_rows[apply_offset + 23u] = aggregate_mass_kg;
  apply_rows[apply_offset + 24u] = aggregate_volume_m3;
  apply_rows[apply_offset + 25u] = aggregate_mass_residual_kg;
  apply_rows[apply_offset + 26u] = aggregate_volume_residual_m3;
  apply_rows[apply_offset + 27u] = proposal_rows[proposal_offset + 22u];
  apply_rows[apply_offset + 28u] = proposal_rows[proposal_offset + 23u];
  apply_rows[apply_offset + 29u] = proposal_rows[proposal_offset + 26u];
  apply_rows[apply_offset + 30u] = params.apply_epoch;
  apply_rows[apply_offset + 31u] = params.state_family_id;
}
`;

export const schroederParticleStorageAllocationWgsl = `
struct SchroederParticleStorageAllocationParams {
  apply_row_count: u32,
  apply_stride: u32,
  allocation_stride: u32,
  admission_approved: u32,
  allocator_epoch: f32,
  state_family_id: f32,
  current_particle_capacity: f32,
  required_particle_capacity: f32,
  target_state_family_mask: f32,
  flags: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<storage, read> apply_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> allocation_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederParticleStorageAllocationParams;

const SCHROEDER_PSAL_APPLY_STRIDE: u32 = 32u;
const SCHROEDER_PSAL_ALLOCATION_STRIDE: u32 = 32u;

// Fixed phase slots use spare-lineage ranks instead of an append window.
// Distinct actions keep these intents separate from the legacy materializer:
// 5 = split retaining the source, 6 = merge into the leader, 7 = merge member.
fn ss_psal_preserve_phase_slots() -> bool {
  return (u32(params.flags) & 1u) != 0u;
}

fn ss_psal_active_apply(apply_offset: u32) -> bool {
  let status = apply_rows[apply_offset + 3u];
  let apply_admission = apply_rows[apply_offset + 6u];
  return status > 0.0 && status < 32.0 && apply_admission > 0.0 && params.admission_approved > 0u;
}

fn ss_psal_coarsen_row(apply_offset: u32) -> bool {
  let status_bits = u32(max(apply_rows[apply_offset + 3u], 0.0));
  return (status_bits & 2u) != 0u && (status_bits & 4u) == 0u;
}

// Merge-group stamp eligibility: any merge-family row (status bit 2) whose
// apply row carries a valid aggregate node index. Broader than
// ss_psal_coarsen_row on purpose - rows that also carry bit 4 still belong
// to their merge group, and unstamped groups made the materializer fall
// back to leader-only mass (observed live as exact non-leader mass loss).
fn ss_psal_merge_group_stamp_row(apply_offset: u32) -> bool {
  let status_bits = u32(max(apply_rows[apply_offset + 3u], 0.0));
  return (status_bits & 2u) != 0u && apply_rows[apply_offset + 21u] >= 0.0;
}

struct SsPsalMergeGroup {
  member_count: u32,
  leader_source_index: f32,
};

// Exact same-cell merge-group scan over apply rows (aggregateNodeIndex at
// column 21). The lowest source particle index in the cell is the merge
// leader. O(rows^2) across the dispatch: the exact small-scene route, like
// the law-neighbor exact fallback; a sorted/keyed reduction is the
// escalation path for large row counts.
fn ss_psal_merge_group(apply_offset: u32, apply_stride: u32) -> SsPsalMergeGroup {
  let my_cell = apply_rows[apply_offset + 21u];
  var group = SsPsalMergeGroup(0u, apply_rows[apply_offset + 0u]);
  if (my_cell < 0.0) {
    return group;
  }
  for (var row = 0u; row < params.apply_row_count; row = row + 1u) {
    let other_offset = row * apply_stride;
    if (!ss_psal_active_apply(other_offset) || !ss_psal_coarsen_row(other_offset)) {
      continue;
    }
    if (apply_rows[other_offset + 21u] != my_cell) {
      continue;
    }
    group.member_count = group.member_count + 1u;
    group.leader_source_index = min(group.leader_source_index, apply_rows[other_offset + 0u]);
  }
  return group;
}

fn ss_psal_write_empty(allocation_offset: u32, apply_offset: u32, status: f32) {
  allocation_rows[allocation_offset + 0u] = apply_rows[apply_offset + 0u];
  allocation_rows[allocation_offset + 1u] = apply_rows[apply_offset + 1u];
  allocation_rows[allocation_offset + 2u] = apply_rows[apply_offset + 2u];
  allocation_rows[allocation_offset + 3u] = status;
  for (var column = 4u; column < SCHROEDER_PSAL_ALLOCATION_STRIDE; column = column + 1u) {
    allocation_rows[allocation_offset + column] = 0.0;
  }
  allocation_rows[allocation_offset + 6u] = f32(params.admission_approved);
  allocation_rows[allocation_offset + 9u] = -1.0;
  allocation_rows[allocation_offset + 11u] = -1.0;
  allocation_rows[allocation_offset + 13u] = params.required_particle_capacity;
  allocation_rows[allocation_offset + 14u] = params.current_particle_capacity;
  allocation_rows[allocation_offset + 29u] = params.allocator_epoch;
  allocation_rows[allocation_offset + 30u] = params.target_state_family_mask;
  allocation_rows[allocation_offset + 31u] = params.state_family_id;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.apply_row_count) {
    return;
  }

  let apply_stride = max(params.apply_stride, SCHROEDER_PSAL_APPLY_STRIDE);
  let allocation_stride = max(params.allocation_stride, SCHROEDER_PSAL_ALLOCATION_STRIDE);
  let apply_offset = row_index * apply_stride;
  let allocation_offset = row_index * allocation_stride;

  if (!ss_psal_active_apply(apply_offset)) {
    ss_psal_write_empty(allocation_offset, apply_offset, 32.0);
    return;
  }

  let particle_delta = apply_rows[apply_offset + 7u];
  var allocation_count = select(max(particle_delta, 0.0), 0.0, ss_psal_preserve_phase_slots());
  var free_count = select(max(-particle_delta, 0.0), 0.0, ss_psal_preserve_phase_slots());
  var divide_mass_split = false;
  var phase_slot_action = 1.0;
  let status_bits_self = u32(max(apply_rows[apply_offset + 3u], 0.0));
  if ((status_bits_self & 4u) != 0u) {
    // Mass-correct split: the source is replaced by (delta + 1) children,
    // each receiving source mass / child count at materialization, and the
    // source slot is freed. A zero-delta refine row keeps its particle.
    if (particle_delta >= 1.0) {
      allocation_count = particle_delta + 1.0;
      free_count = 1.0;
      divide_mass_split = true;
      if (ss_psal_preserve_phase_slots()) {
        allocation_count = particle_delta;
        free_count = 0.0;
        phase_slot_action = 5.0;
      }
    } else {
      allocation_count = 0.0;
      free_count = 0.0;
    }
  } else if (ss_psal_coarsen_row(apply_offset)) {
    // Merge group semantics: exactly one leader per aggregate cell writes
    // the aggregated child (target mass/volume already carry the cell
    // aggregates), and every member, leader included, frees its own source
    // slot. Lone coarsen rows have nothing to merge with.
    let group = ss_psal_merge_group(apply_offset, apply_stride);
    if (group.member_count >= 2u) {
      let is_leader = apply_rows[apply_offset + 0u] == group.leader_source_index;
      allocation_count = select(0.0, 1.0, is_leader);
      free_count = 1.0;
      if (ss_psal_preserve_phase_slots()) {
        allocation_count = 0.0;
        free_count = select(1.0, 0.0, is_leader);
        phase_slot_action = select(7.0, 6.0, is_leader);
      }
    } else {
      allocation_count = 0.0;
      free_count = 0.0;
    }
  }
  let capacity_required_by_row = params.current_particle_capacity + allocation_count;
  // In the fixed layout the GPU free-list grant, not append capacity, bounds
  // the split. Merges need no spare and never change the phase-lane stride.
  let capacity_residual = select(
    max(capacity_required_by_row - params.required_particle_capacity, 0.0),
    0.0,
    ss_psal_preserve_phase_slots()
  );
  let allocation_required = allocation_count > 0.0;
  let free_required = free_count > 0.0;

  var status = 1.0 + 8.0;
  if (allocation_required) {
    status = status + 2.0;
  }
  if (free_required) {
    status = status + 4.0;
  }
  if (capacity_residual > 0.0) {
    status = status + 16.0;
  }

  var slot_action_id = select(
    select(1.0, 3.0, allocation_required),
    2.0,
    free_required
  );
  if (divide_mass_split) {
    slot_action_id = 4.0;
  }
  if (ss_psal_preserve_phase_slots()) {
    slot_action_id = phase_slot_action;
  }

  allocation_rows[allocation_offset + 0u] = apply_rows[apply_offset + 0u];
  allocation_rows[allocation_offset + 1u] = apply_rows[apply_offset + 1u];
  allocation_rows[allocation_offset + 2u] = apply_rows[apply_offset + 2u];
  allocation_rows[allocation_offset + 3u] = status;
  allocation_rows[allocation_offset + 4u] = 1.0;
  allocation_rows[allocation_offset + 5u] = apply_rows[apply_offset + 4u];
  allocation_rows[allocation_offset + 6u] = f32(params.admission_approved);
  allocation_rows[allocation_offset + 7u] = particle_delta;
  allocation_rows[allocation_offset + 8u] = slot_action_id;
  allocation_rows[allocation_offset + 9u] = -1.0;
  allocation_rows[allocation_offset + 10u] = allocation_count;
  allocation_rows[allocation_offset + 11u] = -1.0;
  allocation_rows[allocation_offset + 12u] = free_count;
  allocation_rows[allocation_offset + 13u] = params.required_particle_capacity;
  allocation_rows[allocation_offset + 14u] = params.current_particle_capacity;
  allocation_rows[allocation_offset + 15u] = capacity_residual;
  allocation_rows[allocation_offset + 16u] = apply_rows[apply_offset + 8u];
  allocation_rows[allocation_offset + 17u] = apply_rows[apply_offset + 9u];
  // Coarsen rows repurpose the massResidual diagnostic column to carry the
  // merge-group cell id so the materializer can place merged children at
  // the group's mass-weighted centroid (first-moment conservation).
  allocation_rows[allocation_offset + 18u] = select(
    apply_rows[apply_offset + 10u],
    apply_rows[apply_offset + 21u],
    ss_psal_merge_group_stamp_row(apply_offset)
  );
  allocation_rows[allocation_offset + 19u] = apply_rows[apply_offset + 11u];
  allocation_rows[allocation_offset + 20u] = apply_rows[apply_offset + 12u];
  allocation_rows[allocation_offset + 21u] = apply_rows[apply_offset + 13u];
  allocation_rows[allocation_offset + 22u] = apply_rows[apply_offset + 14u];
  allocation_rows[allocation_offset + 23u] = apply_rows[apply_offset + 15u];
  allocation_rows[allocation_offset + 24u] = apply_rows[apply_offset + 16u];
  allocation_rows[allocation_offset + 25u] = apply_rows[apply_offset + 17u];
  allocation_rows[allocation_offset + 26u] = apply_rows[apply_offset + 21u];
  allocation_rows[allocation_offset + 27u] = apply_rows[apply_offset + 22u];
  allocation_rows[allocation_offset + 28u] = apply_rows[apply_offset + 29u];
  allocation_rows[allocation_offset + 29u] = params.allocator_epoch;
  allocation_rows[allocation_offset + 30u] = params.target_state_family_mask;
  allocation_rows[allocation_offset + 31u] = params.state_family_id;
}
`;

export const schroederParticleStorageSlotAssignmentWgsl = `
struct SchroederParticleStorageSlotAssignmentParams {
  allocation_row_count: u32,
  allocation_stride: u32,
  free_list_stride: u32,
  assignment_stride: u32,
  admission_approved: u32,
  flags: u32,
  assignment_epoch: f32,
  state_family_id: f32,
  target_state_family_mask: f32,
  max_slots_per_row: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<storage, read> allocation_rows: array<f32>;
@group(0) @binding(1) var<storage, read> free_list_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> assignment_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederParticleStorageSlotAssignmentParams;

const SCHROEDER_PSSA_ALLOCATION_STRIDE: u32 = 32u;
const SCHROEDER_PSSA_FREE_LIST_STRIDE: u32 = 8u;
const SCHROEDER_PSSA_ASSIGNMENT_STRIDE: u32 = 32u;

fn ss_pssa_active_allocation(allocation_offset: u32) -> bool {
  let status = allocation_rows[allocation_offset + 3u];
  let allocation_admission = allocation_rows[allocation_offset + 6u];
  return status > 0.0 && status < 32.0 && allocation_admission > 0.0 && params.admission_approved > 0u;
}

// Per-WRITER slot compaction: the appended-slot window is consumed by rows
// that actually allocate targets, not by every row. The old row-indexed
// addressing (base + row_index * max_slots_per_row) silently refused writes
// for any writer whose ROW INDEX exceeded the free-list capacity while frees
// still executed - the torn-epoch mass-deletion source. O(rows) prefix per
// call; rows are bounded by the storage row budget (exact small-scene route).
fn ss_pssa_writer_slot_offset(row_index: u32, allocation_stride: u32) -> f32 {
  var offset = 0.0;
  for (var row = 0u; row < row_index; row = row + 1u) {
    let other = row * allocation_stride;
    if (!ss_pssa_active_allocation(other)) {
      continue;
    }
    offset = offset + max(allocation_rows[other + 10u], 0.0);
  }
  return offset;
}

fn ss_pssa_target_granted(row_index: u32, allocation_offset: u32, allocation_stride: u32) -> bool {
  let target_count = allocation_rows[allocation_offset + 10u];
  if (!(target_count > 0.0)) {
    return false;
  }
  let free_list_offset = 0u;
  let slot_capacity = free_list_rows[free_list_offset + 1u];
  let available_slot_count = free_list_rows[free_list_offset + 2u];
  let writer_offset = ss_pssa_writer_slot_offset(row_index, allocation_stride);
  return writer_offset + target_count <= slot_capacity
    && writer_offset + target_count <= available_slot_count;
}

// A merge participant may free its slot ONLY when its group's leader (the
// same-cell row that allocates the merged child) has a granted target.
// Frees without a written child delete mass; ungrouped free_required rows
// never free.
fn ss_pssa_free_allowed(
  row_index: u32,
  allocation_offset: u32,
  allocation_stride: u32,
  target_granted: bool
) -> bool {
  let free_count = allocation_rows[allocation_offset + 12u];
  if (!(free_count > 0.0)) {
    return false;
  }
  let slot_action = allocation_rows[allocation_offset + 8u];
  if (slot_action == 7.0) {
    // Fixed-slot merge members can retire only beside an admitted in-place
    // leader in the same group. An empty spare pool must not deny a merge.
    if ((params.flags & 1u) == 0u) { return false; }
    let my_cell = allocation_rows[allocation_offset + 18u];
    if (my_cell < 0.0) { return false; }
    for (var row = 0u; row < params.allocation_row_count; row = row + 1u) {
      let other = row * allocation_stride;
      if (ss_pssa_active_allocation(other)
          && allocation_rows[other + 8u] == 6.0
          && allocation_rows[other + 18u] == my_cell) {
        return true;
      }
    }
    return false;
  }
  if (abs(slot_action - 2.0) >= 0.5) {
    // Non-merge frees (mass-correct splits free their own source alongside
    // their granted children) gate on this row's own grant when it writes.
    if (allocation_rows[allocation_offset + 10u] > 0.0) {
      return target_granted;
    }
    return true;
  }
  if (allocation_rows[allocation_offset + 10u] > 0.0) {
    // Merge leader: frees only alongside its granted child write.
    return target_granted;
  }
  let my_cell = allocation_rows[allocation_offset + 18u];
  if (my_cell < 0.0) {
    return false;
  }
  for (var row = 0u; row < params.allocation_row_count; row = row + 1u) {
    let other = row * allocation_stride;
    if (!ss_pssa_active_allocation(other)) {
      continue;
    }
    if (abs(allocation_rows[other + 8u] - 2.0) >= 0.5) {
      continue;
    }
    if (allocation_rows[other + 18u] != my_cell) {
      continue;
    }
    if (!(allocation_rows[other + 10u] > 0.0)) {
      continue;
    }
    if (ss_pssa_target_granted(row, other, allocation_stride)) {
      return true;
    }
  }
  return false;
}

fn ss_pssa_write_empty(assignment_offset: u32, allocation_offset: u32, free_list_offset: u32, status: f32) {
  assignment_rows[assignment_offset + 0u] = allocation_rows[allocation_offset + 0u];
  assignment_rows[assignment_offset + 1u] = allocation_rows[allocation_offset + 1u];
  assignment_rows[assignment_offset + 2u] = allocation_rows[allocation_offset + 2u];
  assignment_rows[assignment_offset + 3u] = status;
  for (var column = 4u; column < SCHROEDER_PSSA_ASSIGNMENT_STRIDE; column = column + 1u) {
    assignment_rows[assignment_offset + column] = 0.0;
  }
  assignment_rows[assignment_offset + 6u] = f32(params.admission_approved);
  assignment_rows[assignment_offset + 9u] = -1.0;
  assignment_rows[assignment_offset + 11u] = -1.0;
  assignment_rows[assignment_offset + 13u] = free_list_rows[free_list_offset + 0u];
  assignment_rows[assignment_offset + 14u] = free_list_rows[free_list_offset + 1u];
  assignment_rows[assignment_offset + 15u] = free_list_rows[free_list_offset + 2u];
  assignment_rows[assignment_offset + 29u] = params.assignment_epoch;
  assignment_rows[assignment_offset + 30u] = params.target_state_family_mask;
  assignment_rows[assignment_offset + 31u] = params.state_family_id;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.allocation_row_count) {
    return;
  }

  let allocation_stride = max(params.allocation_stride, SCHROEDER_PSSA_ALLOCATION_STRIDE);
  let free_list_stride = max(params.free_list_stride, SCHROEDER_PSSA_FREE_LIST_STRIDE);
  let assignment_stride = max(params.assignment_stride, SCHROEDER_PSSA_ASSIGNMENT_STRIDE);
  let allocation_offset = row_index * allocation_stride;
  let free_list_offset = 0u * free_list_stride;
  let assignment_offset = row_index * assignment_stride;

  if (!ss_pssa_active_allocation(allocation_offset)) {
    ss_pssa_write_empty(assignment_offset, allocation_offset, free_list_offset, 32.0);
    return;
  }

  let fixed_action = allocation_rows[allocation_offset + 8u];
  let preserve_phase_slots = (params.flags & 1u) != 0u;
  // A fixed-slot intent must never be interpreted as a legacy append/free.
  if (!preserve_phase_slots && fixed_action >= 5.0) {
    ss_pssa_write_empty(assignment_offset, allocation_offset, free_list_offset, 32.0);
    return;
  }
  if (preserve_phase_slots && fixed_action != 1.0
      && fixed_action != 5.0 && fixed_action != 6.0 && fixed_action != 7.0) {
    ss_pssa_write_empty(assignment_offset, allocation_offset, free_list_offset, 32.0);
    return;
  }

  let base_slot = free_list_rows[free_list_offset + 0u];
  let slot_capacity = free_list_rows[free_list_offset + 1u];
  let available_slot_count = free_list_rows[free_list_offset + 2u];
  let target_count = allocation_rows[allocation_offset + 10u];
  let free_count = allocation_rows[allocation_offset + 12u];
  let allocation_capacity_residual = allocation_rows[allocation_offset + 15u];
  let writer_slot_offset = ss_pssa_writer_slot_offset(row_index, allocation_stride);
  let row_slot_start = base_slot + writer_slot_offset;
  let target_slot_residual = select(
    max((writer_slot_offset + target_count) - slot_capacity, 0.0),
    0.0, preserve_phase_slots && target_count == 0.0
  );
  let available_slot_residual = select(
    max((writer_slot_offset + target_count) - available_slot_count, 0.0),
    0.0, preserve_phase_slots && target_count == 0.0
  );
  let target_granted = target_count > 0.0
    && target_slot_residual <= 0.0
    && available_slot_residual <= 0.0;
  var target_start = select(-1.0, row_slot_start, target_granted);
  if (preserve_phase_slots && fixed_action == 6.0) {
    target_start = allocation_rows[allocation_offset + 0u];
  }
  let free_allowed = ss_pssa_free_allowed(row_index, allocation_offset, allocation_stride, target_granted);
  let free_start = select(-1.0, allocation_rows[allocation_offset + 0u], free_allowed);

  var status = 1.0 + 8.0;
  if ((target_count > 0.0 || (preserve_phase_slots && fixed_action == 6.0)) && target_start >= 0.0) {
    status = status + 2.0;
  }
  let effective_free_count = select(0.0, free_count, free_allowed);
  if (effective_free_count > 0.0 && free_start >= 0.0) {
    status = status + 4.0;
  }
  if (target_slot_residual > 0.0 || available_slot_residual > 0.0 || allocation_capacity_residual > 0.0) {
    status = status + 16.0;
  }

  assignment_rows[assignment_offset + 0u] = allocation_rows[allocation_offset + 0u];
  assignment_rows[assignment_offset + 1u] = allocation_rows[allocation_offset + 1u];
  assignment_rows[assignment_offset + 2u] = allocation_rows[allocation_offset + 2u];
  assignment_rows[assignment_offset + 3u] = status;
  assignment_rows[assignment_offset + 4u] = 1.0;
  assignment_rows[assignment_offset + 5u] = allocation_rows[allocation_offset + 4u];
  assignment_rows[assignment_offset + 6u] = f32(params.admission_approved);
  assignment_rows[assignment_offset + 7u] = allocation_rows[allocation_offset + 7u];
  assignment_rows[assignment_offset + 8u] = allocation_rows[allocation_offset + 8u];
  assignment_rows[assignment_offset + 9u] = target_start;
  assignment_rows[assignment_offset + 10u] = select(
    target_count, 1.0, preserve_phase_slots && fixed_action == 6.0
  );
  assignment_rows[assignment_offset + 11u] = free_start;
  assignment_rows[assignment_offset + 12u] = effective_free_count;
  assignment_rows[assignment_offset + 13u] = base_slot;
  assignment_rows[assignment_offset + 14u] = slot_capacity;
  assignment_rows[assignment_offset + 15u] = available_slot_count;
  assignment_rows[assignment_offset + 16u] = allocation_capacity_residual;
  assignment_rows[assignment_offset + 17u] = max(target_slot_residual, available_slot_residual);
  assignment_rows[assignment_offset + 18u] = allocation_rows[allocation_offset + 16u];
  assignment_rows[assignment_offset + 19u] = allocation_rows[allocation_offset + 17u];
  assignment_rows[assignment_offset + 20u] = allocation_rows[allocation_offset + 18u];
  assignment_rows[assignment_offset + 21u] = allocation_rows[allocation_offset + 19u];
  assignment_rows[assignment_offset + 22u] = allocation_rows[allocation_offset + 20u];
  assignment_rows[assignment_offset + 23u] = allocation_rows[allocation_offset + 21u];
  assignment_rows[assignment_offset + 24u] = allocation_rows[allocation_offset + 22u];
  assignment_rows[assignment_offset + 25u] = allocation_rows[allocation_offset + 23u];
  assignment_rows[assignment_offset + 26u] = allocation_rows[allocation_offset + 24u];
  assignment_rows[assignment_offset + 27u] = allocation_rows[allocation_offset + 25u];
  assignment_rows[assignment_offset + 28u] = allocation_rows[allocation_offset + 28u];
  assignment_rows[assignment_offset + 29u] = params.assignment_epoch;
  assignment_rows[assignment_offset + 30u] = params.target_state_family_mask;
  assignment_rows[assignment_offset + 31u] = params.state_family_id;
}
`;

export const schroederParticleStorageMaterializationWgsl = `
struct SchroederParticleStorageMaterializationParams {
  assignment_row_count: u32,
  assignment_stride: u32,
  source_particle_count: u32,
  output_particle_capacity: u32,
  state_vec4_stride: u32,
  thermo_vec4_stride: u32,
  mechanics_vec4_stride: u32,
  materialization_stride: u32,
  admission_approved: u32,
  flags: u32,
  materialization_epoch: f32,
  state_family_id: f32,
  target_state_family_mask: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> assignment_rows: array<f32>;
@group(0) @binding(1) var<storage, read> source_sph_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_sph_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> source_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out_sph_thermo: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> materialization_rows: array<f32>;
@group(0) @binding(8) var<uniform> params: SchroederParticleStorageMaterializationParams;
@group(0) @binding(9) var<storage, read> source_particle_identity: array<u32>;
@group(0) @binding(10) var<storage, read_write> out_particle_identity: array<u32>;

const SCHROEDER_PSM_ASSIGNMENT_STRIDE: u32 = 32u;
const SCHROEDER_PSM_MATERIALIZATION_STRIDE: u32 = 32u;
const SCHROEDER_PSM_STATE_VEC4_STRIDE: u32 = 2u;
const SCHROEDER_PSM_THERMO_VEC4_STRIDE: u32 = 3u;
const SCHROEDER_PSM_MECHANICS_VEC4_STRIDE: u32 = 8u;

fn ss_psm_stride(value: u32, fallback: u32) -> u32 {
  return max(value, fallback);
}

fn ss_psm_index(value: f32) -> u32 {
  return u32(max(floor(value), 0.0));
}

// A merged particle can carry only one structural render-domain id. Never
// collapse particles from different initial bodies into a child whose domain
// would depend on which assignment row happened to lead the group.
fn ss_psm_merge_identity_compatible(
  assignment_offset: u32,
  source_index: u32,
  target_count: u32,
  free_start_value: f32,
  free_start: u32,
  free_count: u32
) -> bool {
  let assignment_action = assignment_rows[assignment_offset + 8u];
  let assignment_stride = ss_psm_stride(
    params.assignment_stride,
    SCHROEDER_PSM_ASSIGNMENT_STRIDE
  );
  var has_identity = false;
  var expected_identity = 0u;
  if (source_index < params.source_particle_count) {
    expected_identity = source_particle_identity[source_index];
    has_identity = true;
  }

  if (assignment_action == 2.0 && assignment_rows[assignment_offset + 20u] >= 0.0) {
    let merge_cell = assignment_rows[assignment_offset + 20u];
    for (var row = 0u; row < params.assignment_row_count; row = row + 1u) {
      let other_offset = row * assignment_stride;
      if (assignment_rows[other_offset + 8u] != 2.0
          || assignment_rows[other_offset + 20u] != merge_cell
          || assignment_rows[other_offset + 11u] < 0.0
          || !(assignment_rows[other_offset + 12u] > 0.0)) {
        continue;
      }
      let member_index = ss_psm_index(assignment_rows[other_offset + 0u]);
      if (member_index >= params.source_particle_count) {
        continue;
      }
      let member_identity = source_particle_identity[member_index];
      if (has_identity && member_identity != expected_identity) {
        return false;
      }
      expected_identity = member_identity;
      has_identity = true;
    }
  }

  // The alternate leader-plus-freed-range merge encoding has no per-member
  // action-2 rows. A one-child write that frees a range is compatible only
  // when every consumed source slot belongs to the leader's domain.
  if (target_count == 1u && free_start_value >= 0.0 && free_count > 0u) {
    for (var slot = 0u; slot < free_count; slot = slot + 1u) {
      let member_index = free_start + slot;
      if (member_index >= params.source_particle_count) {
        continue;
      }
      let member_identity = source_particle_identity[member_index];
      if (has_identity && member_identity != expected_identity) {
        return false;
      }
      expected_identity = member_identity;
      has_identity = true;
    }
  }
  return true;
}

fn ss_psm_target_mass(assignment_offset: u32, source_mass: f32) -> f32 {
  let target_mass = assignment_rows[assignment_offset + 19u];
  return select(source_mass, max(target_mass, 0.0), target_mass > 0.0);
}

fn ss_psm_source_represented_volume(source_index: u32, mechanics_stride: u32) -> f32 {
  if (source_index >= params.source_particle_count) {
    return 0.0;
  }
  let mechanics_base = source_index * mechanics_stride;
  let row4 = source_mls_mechanics[mechanics_base + 4u];
  return max(row4.z, 0.0) * max(row4.w, 0.0);
}

// Mass-weighted centroid of a merge group: merged children must conserve
// the FIRST MOMENT of the mass distribution (like momentum and thermal
// energy), not inherit the leader's position - leader placement relocates
// the whole group's mass to one member and visibly teleports matter when
// merge cells are large. Merge participants (slot action 2) carry their
// aggregate cell id in assignment column 20 (stamped by the allocation
// kernel over the massResidual diagnostic for coarsen rows only), so the
// group is recovered with the same exact same-cell scan the allocator
// used. Returns sum(m*x) in xyz and sum(m) in w; w <= 0 means no valid
// multi-member group and the caller keeps the leader position.
// F occupies vec4[0].xyzw, vec4[1].xyzw and vec4[2].x. Any producer that
// changes J must move F with it or det(F) == J stops holding.
fn ss_psm_deformation_determinant(
  row0: vec4<f32>, row1: vec4<f32>, row2: vec4<f32>
) -> f32 {
  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z; let f10 = row0.w;
  let f11 = row1.x; let f12 = row1.y; let f20 = row1.z; let f21 = row1.w;
  let f22 = row2.x;
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

// Isotropic rescale to a target determinant. Preserves the source's shape and
// anisotropy while restoring det(F) == J exactly enough for the admission
// checks that follow.
fn ss_psm_deformation_scale_for(current_det: f32, target_det: f32) -> f32 {
  if (!(current_det > 0.0) || !(target_det > 0.0)) { return 1.0; }
  let ratio = target_det / current_det;
  if (!(ratio > 0.0) || ratio != ratio) { return 1.0; }
  return pow(ratio, 1.0 / 3.0);
}

struct SsPsmMergeGroup {
  moment: vec3<f32>,
  mass: f32,
  momentum: vec3<f32>,
  mass_temperature: f32,
  // Latent heat lives in the phase fractions, not in temperature. Merging on
  // mass-weighted temperature alone conserves energy only when every member
  // shares one heat capacity and no member straddles a plateau, which is
  // exactly the case Slice 9 exists to handle. Carry the mass-weighted
  // fractions so a liquid+gas merge cannot create or destroy latent heat.
  mass_phase_fractions: vec4<f32>,
  // Represented current volume is the geometry authority: V_current = V0 * J.
  // Merges must conserve its sum rather than re-derive a child size from
  // mass / restDensity, which mints geometry the deformation state never had.
  current_volume: f32,
  rest_volume: f32,
  member_count: u32,
};

fn ss_psm_merge_group(assignment_offset: u32, state_stride: u32, thermo_stride: u32, mechanics_stride: u32) -> SsPsmMergeGroup {
  var group = SsPsmMergeGroup(vec3<f32>(0.0), 0.0, vec3<f32>(0.0), 0.0, vec4<f32>(0.0), 0.0, 0.0, 0u);
  if (assignment_rows[assignment_offset + 8u] != 2.0) {
    return group;
  }
  let my_cell = assignment_rows[assignment_offset + 20u];
  if (my_cell < 0.0) {
    return group;
  }
  let stride = ss_psm_stride(params.assignment_stride, SCHROEDER_PSM_ASSIGNMENT_STRIDE);
  for (var row = 0u; row < params.assignment_row_count; row = row + 1u) {
    let other_offset = row * stride;
    if (assignment_rows[other_offset + 8u] != 2.0) {
      continue;
    }
    if (assignment_rows[other_offset + 20u] != my_cell) {
      continue;
    }
    // Conservation join: only members whose FREE was actually granted count
    // toward the merged child. A member whose free was denied keeps its
    // slot and its mass; including it would create mass out of nothing
    // (observed live: children carrying full aggregate-stamp mass while
    // only some members freed, +88 kg on the boiling proof scene).
    if (assignment_rows[other_offset + 11u] < 0.0 || !(assignment_rows[other_offset + 12u] > 0.0)) {
      continue;
    }
    let member_index = u32(max(assignment_rows[other_offset + 0u], 0.0));
    if (member_index >= params.source_particle_count) {
      continue;
    }
    let member_state = source_sph_state[member_index * state_stride];
    let member_velocity = source_sph_state[member_index * state_stride + 1u];
    let member_temperature = source_sph_thermo[member_index * thermo_stride].z;
    let member_fractions = source_sph_thermo[member_index * thermo_stride + 1u];
    let member_mass = max(member_state.w, 0.0);
    group.moment = group.moment + member_state.xyz * member_mass;
    group.momentum = group.momentum + member_velocity.xyz * member_mass;
    group.mass_temperature = group.mass_temperature + max(member_temperature, 0.0) * member_mass;
    group.mass_phase_fractions =
      group.mass_phase_fractions + member_fractions * member_mass;
    let member_row4 = source_mls_mechanics[member_index * mechanics_stride + 4u];
    let member_rest_volume = max(member_row4.w, 0.0);
    let member_volume_ratio = max(member_row4.z, 0.0);
    group.rest_volume = group.rest_volume + member_rest_volume;
    group.current_volume =
      group.current_volume + member_rest_volume * member_volume_ratio;
    group.mass = group.mass + member_mass;
    group.member_count = group.member_count + 1u;
  }
  if (group.member_count < 2u || group.mass <= 0.0) {
    return SsPsmMergeGroup(vec3<f32>(0.0), 0.0, vec3<f32>(0.0), 0.0, vec4<f32>(0.0), 0.0, 0.0, 0u);
  }
  return group;
}

fn ss_psm_copy_particle(
  source_index: u32,
  target_index: u32,
  assignment_offset: u32,
  child_ordinal: u32,
  child_count: u32,
  freed_group: SsPsmMergeGroup,
  freed_includes_source: bool
) -> f32 {
  if (source_index >= params.source_particle_count || target_index >= params.output_particle_capacity) {
    return 0.0;
  }
  let state_stride = ss_psm_stride(params.state_vec4_stride, SCHROEDER_PSM_STATE_VEC4_STRIDE);
  let thermo_stride = ss_psm_stride(params.thermo_vec4_stride, SCHROEDER_PSM_THERMO_VEC4_STRIDE);
  let mechanics_stride = ss_psm_stride(params.mechanics_vec4_stride, SCHROEDER_PSM_MECHANICS_VEC4_STRIDE);
  let source_state_base = source_index * state_stride;
  let target_state_base = target_index * state_stride;
  let source_thermo_base = source_index * thermo_stride;
  let target_thermo_base = target_index * thermo_stride;
  let source_mechanics_base = source_index * mechanics_stride;
  let target_mechanics_base = target_index * mechanics_stride;

  let state0 = source_sph_state[source_state_base];
  let state1 = source_sph_state[source_state_base + 1u];
  // Slot action 4 is the mass-correct split: children divide the source
  // mass and represented volume evenly and are jittered deterministically
  // inside the child length scale so they do not stack.
  let divide_mass_split = assignment_rows[assignment_offset + 8u] == 4.0
    && child_count > 0u;
  let divisor = f32(max(child_count, 1u));
  // Merge (action 2) writes derive mass from the granted-free group scan or
  // degrade to a pure move of the leader; the aggregate target-mass stamp is
  // never authoritative for merges (it describes the whole aggregate cell,
  // not the members actually freed this epoch).
  let is_merge_write = assignment_rows[assignment_offset + 8u] == 2.0;
  var child_mass = state0.w;
  if (!is_merge_write) {
    child_mass = ss_psm_target_mass(assignment_offset, state0.w);
  }
  var child_position = state0.xyz;
  // Live merge-group scan: mass, first moment, momentum, and thermal energy
  // summed over the group members from the SOURCE buffers the materializer
  // itself copies from. This conserves all four invariants even when the
  // aggregate stamps (assignment cols 19/22/24-27) read zero because the
  // aggregate stage bound a superseded buffer (observed live: merges lost
  // exactly the non-leader members' mass).
  var merge_group = SsPsmMergeGroup(vec3<f32>(0.0), 0.0, vec3<f32>(0.0), 0.0, vec4<f32>(0.0), 0.0, 0.0, 0u);
  if (!divide_mass_split) {
    merge_group = ss_psm_merge_group(
      assignment_offset, state_stride, thermo_stride, mechanics_stride
    );
  }
  var merge_group_valid = merge_group.member_count >= 2u && merge_group.mass > 0.0;
  // Leader-with-freed-range merge encoding: one assignment row writes the
  // child and frees the merged-away members' source slots. When no action-2
  // participant rows exist, the freed range IS the merge group; combine it
  // with the leader (unless the leader's own slot is inside the range) so
  // mass, first moment, momentum, and thermal energy are conserved.
  if (!merge_group_valid && !divide_mass_split && child_count == 1u && freed_group.mass > 0.0) {
    var combined = freed_group;
    if (!freed_includes_source) {
      let leader_mass = max(state0.w, 0.0);
      let leader_velocity = source_sph_state[source_state_base + 1u];
      let leader_temperature = source_sph_thermo[source_thermo_base].z;
      combined.moment = combined.moment + state0.xyz * leader_mass;
      combined.momentum = combined.momentum + leader_velocity.xyz * leader_mass;
      combined.mass_temperature = combined.mass_temperature + max(leader_temperature, 0.0) * leader_mass;
      combined.mass = combined.mass + leader_mass;
      combined.member_count = combined.member_count + 1u;
    }
    if (combined.member_count >= 2u && combined.mass > 0.0) {
      merge_group = combined;
      merge_group_valid = true;
    }
  }
  if (divide_mass_split) {
    child_mass = max(state0.w, 0.0) / divisor;
    let child_volume = max(assignment_rows[assignment_offset + 22u], 0.0) / divisor;
    let child_scale = pow(max(child_volume, 1.0e-18), 0.3333333333333333);
    let corner = vec3<f32>(
      f32(child_ordinal & 1u) * 2.0 - 1.0,
      f32((child_ordinal >> 1u) & 1u) * 2.0 - 1.0,
      f32((child_ordinal >> 2u) & 1u) * 2.0 - 1.0
    );
    child_position = state0.xyz + 0.25 * child_scale * corner;
  }
  if (merge_group_valid) {
    child_mass = merge_group.mass;
    child_position = merge_group.moment / merge_group.mass;
  }
  out_sph_state[target_state_base] = vec4<f32>(
    child_position.x,
    child_position.y,
    child_position.z,
    child_mass
  );
  // Momentum-conserving merge: when the assignment row carries the cell
  // momentum (columns 24-26), the child velocity is momentum / child mass
  // instead of the merge leader's velocity. Cells with exactly zero total
  // momentum keep the leader velocity; that residual is bounded by the
  // leader speed and only occurs at measure-zero symmetric states.
  let target_momentum = vec3<f32>(
    assignment_rows[assignment_offset + 24u],
    assignment_rows[assignment_offset + 25u],
    assignment_rows[assignment_offset + 26u]
  );
  let momentum_provided = child_mass > 0.0
    && !divide_mass_split
    && !is_merge_write
    && (target_momentum.x != 0.0 || target_momentum.y != 0.0 || target_momentum.z != 0.0);
  if (merge_group_valid) {
    out_sph_state[target_state_base + 1u] = vec4<f32>(merge_group.momentum / merge_group.mass, state1.w);
  } else if (momentum_provided) {
    out_sph_state[target_state_base + 1u] = vec4<f32>(target_momentum / child_mass, state1.w);
  } else {
    out_sph_state[target_state_base + 1u] = state1;
  }

  let thermo0 = source_sph_thermo[source_thermo_base];
  let thermo1 = source_sph_thermo[source_thermo_base + 1u];
  let thermo2 = source_sph_thermo[source_thermo_base + 2u];
  // Merged child temperature: the assignment row's internal-energy column
  // carries the cell's summed mass*T, so T_child = sum(m*T) / child mass is
  // the mass-weighted average (exact thermal-energy conservation under the
  // cell's uniform heat capacity). Splits and rows without the sum keep the
  // source temperature, which conserves energy by construction.
  let cell_mass_temperature = assignment_rows[assignment_offset + 27u];
  var child_temperature = thermo0.z;
  if (merge_group_valid) {
    child_temperature = merge_group.mass_temperature / merge_group.mass;
  } else if (!divide_mass_split && !is_merge_write && cell_mass_temperature > 0.0 && child_mass > 0.0) {
    child_temperature = cell_mass_temperature / child_mass;
  }
  // Represented entity count scales with the mass ratio: uniform
  // composition means entities are proportional to mass for merges and
  // splits alike.
  let source_mass = max(state0.w, 1.0e-18);
  let entity_scale = child_mass / source_mass;
  out_sph_thermo[target_thermo_base] = vec4<f32>(
    thermo0.x,
    thermo0.y,
    child_temperature,
    thermo0.w
  );
  // A merged child carries the group's mass-weighted phase fractions. Copying
  // the leader's row instead would hand the child one member's latent-heat
  // state and silently rebalance the group's internal energy.
  var child_fractions = thermo1;
  if (merge_group_valid && merge_group.mass > 0.0) {
    child_fractions = merge_group.mass_phase_fractions / merge_group.mass;
  }
  out_sph_thermo[target_thermo_base + 1u] = child_fractions;
  out_sph_thermo[target_thermo_base + 2u] = vec4<f32>(
    thermo2.x,
    thermo2.y * entity_scale,
    max(thermo2.z, 1.0),
    thermo2.w
  );

  // Deformation rows are published after row4 below, once the child's J is
  // known, so det(F) == J holds for whatever this write publishes.
  let source_f0 = source_mls_mechanics[source_mechanics_base];
  let source_f1 = source_mls_mechanics[source_mechanics_base + 1u];
  let source_f2 = source_mls_mechanics[source_mechanics_base + 2u];
  out_mls_mechanics[target_mechanics_base + 3u] = source_mls_mechanics[source_mechanics_base + 3u];
  var row4 = source_mls_mechanics[source_mechanics_base + 4u];
  var target_rest_volume = row4.w;
  var target_volume_ratio = row4.z;
  if (divide_mass_split) {
    // A split divides the represented body, not its deformation state. Divide
    // the rest volume and keep J, so sum(V0 * J) is conserved exactly and F
    // still satisfies det(F) == J with no rescale at all.
    target_rest_volume = row4.w / divisor;
  } else if (merge_group_valid
      && merge_group.rest_volume > 0.0
      && merge_group.current_volume > 0.0) {
    // A merge conserves the group's represented current volume. Deriving the
    // child from mass / restDensity instead would mint geometry that no
    // member's deformation state ever had.
    target_rest_volume = merge_group.rest_volume;
    target_volume_ratio = merge_group.current_volume / merge_group.rest_volume;
  }
  if (target_rest_volume > 0.0 && target_volume_ratio > 0.0) {
    row4 = vec4<f32>(
      row4.x,
      row4.y,
      max(target_volume_ratio, 1.0e-9),
      target_rest_volume
    );
  }
  out_mls_mechanics[target_mechanics_base + 4u] = row4;
  let source_determinant =
    ss_psm_deformation_determinant(source_f0, source_f1, source_f2);
  let deformation_scale =
    ss_psm_deformation_scale_for(source_determinant, row4.z);
  out_mls_mechanics[target_mechanics_base] = source_f0 * deformation_scale;
  out_mls_mechanics[target_mechanics_base + 1u] = vec4<f32>(
    source_f1.xyz * deformation_scale,
    source_f1.w * deformation_scale
  );
  out_mls_mechanics[target_mechanics_base + 2u] = vec4<f32>(
    source_f2.x * deformation_scale,
    source_f2.y,
    source_f2.z,
    source_f2.w
  );
  out_mls_mechanics[target_mechanics_base + 5u] = source_mls_mechanics[source_mechanics_base + 5u];
  out_mls_mechanics[target_mechanics_base + 6u] = source_mls_mechanics[source_mechanics_base + 6u];
  out_mls_mechanics[target_mechanics_base + 7u] = source_mls_mechanics[source_mechanics_base + 7u];
  out_particle_identity[target_index] = source_particle_identity[source_index];
  return 1.0;
}

fn ss_psm_free_particle(source_index: u32) -> f32 {
  if (source_index >= params.source_particle_count) {
    return 0.0;
  }
  let state_stride = ss_psm_stride(params.state_vec4_stride, SCHROEDER_PSM_STATE_VEC4_STRIDE);
  let thermo_stride = ss_psm_stride(params.thermo_vec4_stride, SCHROEDER_PSM_THERMO_VEC4_STRIDE);
  let mechanics_stride = ss_psm_stride(params.mechanics_vec4_stride, SCHROEDER_PSM_MECHANICS_VEC4_STRIDE);
  let state_base = source_index * state_stride;
  let thermo_base = source_index * thermo_stride;
  let mechanics_base = source_index * mechanics_stride;
  let state0 = out_sph_state[state_base];
  out_sph_state[state_base] = vec4<f32>(state0.x, state0.y, state0.z, 0.0);
  out_sph_state[state_base + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  let thermo2 = out_sph_thermo[thermo_base + 2u];
  // A freed lane represents no material. Retaining its entity count would
  // double-count the merged members beside the newly materialized child.
  out_sph_thermo[thermo_base + 2u] = vec4<f32>(thermo2.x, 0.0, 0.0, thermo2.w);
  let row4 = out_mls_mechanics[mechanics_base + 4u];
  out_mls_mechanics[mechanics_base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
  let row5 = out_mls_mechanics[mechanics_base + 5u];
  out_mls_mechanics[mechanics_base + 5u] = vec4<f32>(row5.x, 0.0, row5.z, row5.w);
  out_particle_identity[source_index] = 0u;
  return 1.0;
}

fn ss_psm_write_empty(materialization_offset: u32, assignment_offset: u32, status: f32) {
  materialization_rows[materialization_offset + 0u] = assignment_rows[assignment_offset + 0u];
  materialization_rows[materialization_offset + 1u] = assignment_rows[assignment_offset + 1u];
  materialization_rows[materialization_offset + 2u] = assignment_rows[assignment_offset + 2u];
  materialization_rows[materialization_offset + 3u] = status;
  for (var column = 4u; column < SCHROEDER_PSM_MATERIALIZATION_STRIDE; column = column + 1u) {
    materialization_rows[materialization_offset + column] = 0.0;
  }
  materialization_rows[materialization_offset + 6u] = f32(params.admission_approved);
  materialization_rows[materialization_offset + 8u] = assignment_rows[assignment_offset + 9u];
  materialization_rows[materialization_offset + 10u] = assignment_rows[assignment_offset + 11u];
  materialization_rows[materialization_offset + 25u] = params.target_state_family_mask;
  materialization_rows[materialization_offset + 26u] = assignment_rows[assignment_offset + 28u];
  materialization_rows[materialization_offset + 27u] = params.materialization_epoch;
  materialization_rows[materialization_offset + 28u] = params.state_family_id;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.assignment_row_count) {
    return;
  }

  let assignment_stride = ss_psm_stride(params.assignment_stride, SCHROEDER_PSM_ASSIGNMENT_STRIDE);
  let materialization_stride = ss_psm_stride(
    params.materialization_stride,
    SCHROEDER_PSM_MATERIALIZATION_STRIDE
  );
  let assignment_offset = row_index * assignment_stride;
  let materialization_offset = row_index * materialization_stride;
  let assignment_status = assignment_rows[assignment_offset + 3u];
  let assignment_admission = assignment_rows[assignment_offset + 6u];

  // Actions 5-7 address stable phase slots and spare-lineage ranks. This
  // append/compact materializer cannot consume them, even if an admission
  // was passed accidentally. A phase-aware materializer must own the write.
  if (assignment_rows[assignment_offset + 8u] >= 5.0) {
    ss_psm_write_empty(materialization_offset, assignment_offset, 32.0);
    return;
  }

  if (assignment_status <= 0.0 || assignment_status >= 32.0 || assignment_admission <= 0.0 || params.admission_approved == 0u) {
    ss_psm_write_empty(materialization_offset, assignment_offset, 32.0);
    return;
  }

  let source_index = ss_psm_index(assignment_rows[assignment_offset + 0u]);
  let target_start_value = assignment_rows[assignment_offset + 9u];
  let target_count = ss_psm_index(assignment_rows[assignment_offset + 10u]);
  let free_start_value = assignment_rows[assignment_offset + 11u];
  let free_count = ss_psm_index(assignment_rows[assignment_offset + 12u]);
  let target_start = ss_psm_index(target_start_value);
  let free_start = ss_psm_index(free_start_value);

  if (!ss_psm_merge_identity_compatible(
      assignment_offset,
      source_index,
      target_count,
      free_start_value,
      free_start,
      free_count
  )) {
    ss_psm_write_empty(materialization_offset, assignment_offset, 64.0);
    return;
  }

  // Freed-range conservation sums: the slots this row will free are the
  // merged-away members; their SOURCE state is still intact here (frees
  // zero the OUT buffers), so the child copy can conserve their mass,
  // first moment, momentum, and thermal energy.
  let freed_state_stride = ss_psm_stride(params.state_vec4_stride, SCHROEDER_PSM_STATE_VEC4_STRIDE);
  let freed_thermo_stride = ss_psm_stride(params.thermo_vec4_stride, SCHROEDER_PSM_THERMO_VEC4_STRIDE);
  var freed_group = SsPsmMergeGroup(vec3<f32>(0.0), 0.0, vec3<f32>(0.0), 0.0, vec4<f32>(0.0), 0.0, 0.0, 0u);
  var freed_includes_source = false;
  if (free_start_value >= 0.0 && free_count > 0u) {
    for (var slot = 0u; slot < free_count; slot = slot + 1u) {
      let member_index = free_start + slot;
      if (member_index >= params.source_particle_count) {
        continue;
      }
      if (member_index == source_index) {
        freed_includes_source = true;
      }
      let member_state = source_sph_state[member_index * freed_state_stride];
      let member_velocity = source_sph_state[member_index * freed_state_stride + 1u];
      let member_temperature = source_sph_thermo[member_index * freed_thermo_stride].z;
      let member_mass = max(member_state.w, 0.0);
      freed_group.moment = freed_group.moment + member_state.xyz * member_mass;
      freed_group.momentum = freed_group.momentum + member_velocity.xyz * member_mass;
      freed_group.mass_temperature = freed_group.mass_temperature + max(member_temperature, 0.0) * member_mass;
      freed_group.mass = freed_group.mass + member_mass;
      freed_group.member_count = freed_group.member_count + 1u;
    }
  }

  var written_target_count = 0.0;
  if (target_start_value >= 0.0 && target_count > 0u) {
    for (var slot = 0u; slot < target_count; slot = slot + 1u) {
      written_target_count = written_target_count + ss_psm_copy_particle(
        source_index,
        target_start + slot,
        assignment_offset,
        slot,
        target_count,
        freed_group,
        freed_includes_source
      );
    }
  }

  var freed_source_count = 0.0;
  if (free_start_value >= 0.0 && free_count > 0u) {
    for (var slot = 0u; slot < free_count; slot = slot + 1u) {
      freed_source_count = freed_source_count + ss_psm_free_particle(free_start + slot);
    }
  }

  var status = 1.0 + 8.0;
  if (written_target_count > 0.0) {
    status = status + 2.0;
  }
  if (freed_source_count > 0.0) {
    status = status + 4.0;
  }
  if (assignment_rows[assignment_offset + 16u] > 0.0 || assignment_rows[assignment_offset + 17u] > 0.0) {
    status = status + 16.0;
  }

  let state_stride = ss_psm_stride(params.state_vec4_stride, SCHROEDER_PSM_STATE_VEC4_STRIDE);
  let thermo_stride = ss_psm_stride(params.thermo_vec4_stride, SCHROEDER_PSM_THERMO_VEC4_STRIDE);
  let mechanics_stride = ss_psm_stride(params.mechanics_vec4_stride, SCHROEDER_PSM_MECHANICS_VEC4_STRIDE);
  var source_mass = 0.0;
  var source_status = 0.0;
  if (source_index < params.source_particle_count) {
    source_mass = source_sph_state[source_index * state_stride].w;
    source_status = source_sph_thermo[source_index * thermo_stride + 2u].z;
  }
  let source_volume = ss_psm_source_represented_volume(source_index, mechanics_stride);
  let target_volume = assignment_rows[assignment_offset + 22u];
  var target_volume_ratio = 0.0;
  if (source_index < params.source_particle_count) {
    let row4 = source_mls_mechanics[source_index * mechanics_stride + 4u];
    if (target_volume > 0.0 && row4.w > 0.0) {
      target_volume_ratio = target_volume / row4.w;
    } else {
      target_volume_ratio = row4.z;
    }
  }

  materialization_rows[materialization_offset + 0u] = assignment_rows[assignment_offset + 0u];
  materialization_rows[materialization_offset + 1u] = assignment_rows[assignment_offset + 1u];
  materialization_rows[materialization_offset + 2u] = assignment_rows[assignment_offset + 2u];
  materialization_rows[materialization_offset + 3u] = status;
  materialization_rows[materialization_offset + 4u] = 1.0;
  materialization_rows[materialization_offset + 5u] = assignment_rows[assignment_offset + 4u];
  materialization_rows[materialization_offset + 6u] = f32(params.admission_approved);
  materialization_rows[materialization_offset + 7u] = assignment_rows[assignment_offset + 7u];
  materialization_rows[materialization_offset + 8u] = assignment_rows[assignment_offset + 9u];
  materialization_rows[materialization_offset + 9u] = assignment_rows[assignment_offset + 10u];
  materialization_rows[materialization_offset + 10u] = assignment_rows[assignment_offset + 11u];
  materialization_rows[materialization_offset + 11u] = assignment_rows[assignment_offset + 12u];
  materialization_rows[materialization_offset + 12u] = select(-1.0, f32(target_start), written_target_count > 0.0);
  materialization_rows[materialization_offset + 13u] = written_target_count;
  materialization_rows[materialization_offset + 14u] = select(-1.0, f32(free_start), freed_source_count > 0.0);
  materialization_rows[materialization_offset + 15u] = freed_source_count;
  materialization_rows[materialization_offset + 16u] = source_mass;
  materialization_rows[materialization_offset + 17u] = assignment_rows[assignment_offset + 19u];
  materialization_rows[materialization_offset + 18u] = assignment_rows[assignment_offset + 20u];
  materialization_rows[materialization_offset + 19u] = source_volume;
  materialization_rows[materialization_offset + 20u] = target_volume;
  materialization_rows[materialization_offset + 21u] = assignment_rows[assignment_offset + 23u];
  materialization_rows[materialization_offset + 22u] = target_volume_ratio;
  materialization_rows[materialization_offset + 23u] = assignment_rows[assignment_offset + 16u];
  materialization_rows[materialization_offset + 24u] = assignment_rows[assignment_offset + 17u];
  materialization_rows[materialization_offset + 25u] = params.target_state_family_mask;
  materialization_rows[materialization_offset + 26u] = assignment_rows[assignment_offset + 28u];
  materialization_rows[materialization_offset + 27u] = params.materialization_epoch;
  materialization_rows[materialization_offset + 28u] = params.state_family_id;
  materialization_rows[materialization_offset + 29u] = source_status;
  materialization_rows[materialization_offset + 30u] = select(0.0, 1.0, written_target_count > 0.0);
  materialization_rows[materialization_offset + 31u] = select(0.0, 1.0, freed_source_count > 0.0);
}
`;

export const schroederPhaseVolumeLevelUpdateWgsl = `
struct SchroederPhaseVolumeLevelUpdateParams {
  migration_row_count: u32,
  migration_stride: u32,
  level_update_stride: u32,
  admission_approved: u32,
  state_family_id: f32,
  migration_epoch: f32,
  flags: u32,
  pad0: u32,
};

@group(0) @binding(0) var<storage, read> migration_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> level_update_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederPhaseVolumeLevelUpdateParams;

const SCHROEDER_PVLU_MIGRATION_STRIDE: u32 = 32u;
const SCHROEDER_PVLU_LEVEL_UPDATE_STRIDE: u32 = 32u;

fn ss_pvlu_active_migration(migration_offset: u32) -> bool {
  let status = migration_rows[migration_offset + 3u];
  return status > 0.0 && status < 32.0 && params.admission_approved > 0u;
}

fn ss_pvlu_write_empty(update_offset: u32, migration_offset: u32, status: f32) {
  level_update_rows[update_offset + 0u] = migration_rows[migration_offset + 0u];
  level_update_rows[update_offset + 1u] = migration_rows[migration_offset + 1u];
  level_update_rows[update_offset + 2u] = migration_rows[migration_offset + 2u];
  level_update_rows[update_offset + 3u] = status;
  for (var column = 4u; column < SCHROEDER_PVLU_LEVEL_UPDATE_STRIDE; column = column + 1u) {
    level_update_rows[update_offset + column] = 0.0;
  }
  level_update_rows[update_offset + 17u] = f32(params.admission_approved);
  level_update_rows[update_offset + 18u] = params.migration_epoch;
  level_update_rows[update_offset + 19u] = params.state_family_id;
  level_update_rows[update_offset + 30u] = 1.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.migration_row_count) {
    return;
  }

  let migration_stride = max(params.migration_stride, SCHROEDER_PVLU_MIGRATION_STRIDE);
  let level_update_stride = max(params.level_update_stride, SCHROEDER_PVLU_LEVEL_UPDATE_STRIDE);
  let migration_offset = row_index * migration_stride;
  let update_offset = row_index * level_update_stride;

  if (!ss_pvlu_active_migration(migration_offset)) {
    ss_pvlu_write_empty(update_offset, migration_offset, 32.0);
    return;
  }

  let coarsen_eligible = migration_rows[migration_offset + 22u];
  let refine_required = migration_rows[migration_offset + 23u];
  let aggregate_coherence_status = migration_rows[migration_offset + 25u];
  let conservation_residual_status = migration_rows[migration_offset + 26u];
  let refine_pressure_reason_mask = migration_rows[migration_offset + 31u];
  var status = 1.0;
  if (coarsen_eligible > 0.0) {
    status = status + 2.0;
  }
  if (refine_required > 0.0) {
    status = status + 4.0;
  }
  if (aggregate_coherence_status > 0.0) {
    status = status + 8.0;
  }
  if (conservation_residual_status > 1.0) {
    status = status + 16.0;
  }

  level_update_rows[update_offset + 0u] = migration_rows[migration_offset + 0u];
  level_update_rows[update_offset + 1u] = migration_rows[migration_offset + 1u];
  level_update_rows[update_offset + 2u] = migration_rows[migration_offset + 2u];
  level_update_rows[update_offset + 3u] = status;
  level_update_rows[update_offset + 4u] = migration_rows[migration_offset + 4u];
  level_update_rows[update_offset + 5u] = migration_rows[migration_offset + 5u];
  level_update_rows[update_offset + 6u] = migration_rows[migration_offset + 6u];
  level_update_rows[update_offset + 7u] = migration_rows[migration_offset + 7u];
  level_update_rows[update_offset + 8u] = migration_rows[migration_offset + 8u];
  level_update_rows[update_offset + 9u] = migration_rows[migration_offset + 9u];
  level_update_rows[update_offset + 10u] = migration_rows[migration_offset + 10u];
  level_update_rows[update_offset + 11u] = migration_rows[migration_offset + 11u];
  level_update_rows[update_offset + 12u] = migration_rows[migration_offset + 12u];
  level_update_rows[update_offset + 13u] = coarsen_eligible;
  level_update_rows[update_offset + 14u] = refine_required;
  level_update_rows[update_offset + 15u] = aggregate_coherence_status;
  level_update_rows[update_offset + 16u] = conservation_residual_status;
  level_update_rows[update_offset + 17u] = f32(params.admission_approved);
  level_update_rows[update_offset + 18u] = params.migration_epoch;
  level_update_rows[update_offset + 19u] = params.state_family_id;
  level_update_rows[update_offset + 20u] = migration_rows[migration_offset + 19u];
  level_update_rows[update_offset + 21u] = migration_rows[migration_offset + 20u];
  level_update_rows[update_offset + 22u] = migration_rows[migration_offset + 15u];
  level_update_rows[update_offset + 23u] = migration_rows[migration_offset + 16u];
  level_update_rows[update_offset + 24u] = migration_rows[migration_offset + 17u];
  level_update_rows[update_offset + 25u] = migration_rows[migration_offset + 18u];
  level_update_rows[update_offset + 26u] = 1.0;
  level_update_rows[update_offset + 27u] = migration_rows[migration_offset + 24u];
  level_update_rows[update_offset + 28u] = migration_rows[migration_offset + 28u];
  level_update_rows[update_offset + 29u] = 1.0;
  level_update_rows[update_offset + 30u] = 0.0;
  level_update_rows[update_offset + 31u] = refine_pressure_reason_mask;
}
`;

export const schroederPhaseVolumeDiagnosticSummaryWgsl = `
struct SchroederPhaseVolumeDiagnosticSummaryParams {
  level_update_row_count: u32,
  level_update_stride: u32,
  summary_stride: u32,
  flags: u32,
  phase_volume_expand_threshold: f32,
  migration_epoch: f32,
  state_family_id: f32,
  pad0: f32,
};

@group(0) @binding(0) var<storage, read> level_update_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> summary_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederPhaseVolumeDiagnosticSummaryParams;

const SCHROEDER_PVDS_LEVEL_UPDATE_STRIDE: u32 = 32u;
const SCHROEDER_PVDS_SUMMARY_STRIDE: u32 = 32u;

fn ss_pvds_active_update(offset: u32) -> bool {
  let status = level_update_rows[offset + 3u];
  let admission = level_update_rows[offset + 17u];
  return status > 0.0 && status < 32.0 && admission > 0.0;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }

  let level_update_stride = max(params.level_update_stride, SCHROEDER_PVDS_LEVEL_UPDATE_STRIDE);
  let summary_stride = max(params.summary_stride, SCHROEDER_PVDS_SUMMARY_STRIDE);
  let summary_offset = 0u * summary_stride;

  var active_count = 0.0;
  var coarsen_count = 0.0;
  var refine_count = 0.0;
  var coherent_count = 0.0;
  var residual_issue_count = 0.0;
  var min_source_level = 1000000.0;
  var max_source_level = -1000000.0;
  var min_target_level = 1000000.0;
  var max_target_level = -1000000.0;
  var max_positive_delta = 0.0;
  var max_negative_delta = 0.0;
  var total_rest_volume = 0.0;
  var total_represented_volume = 0.0;
  var total_aggregate_mass = 0.0;
  var total_aggregate_volume = 0.0;
  var total_abs_mass_residual = 0.0;
  var total_abs_volume_residual = 0.0;
  var steam_expansion_count = 0.0;
  var admitted_update_count = 0.0;
  var state_admission_required_count = 0.0;
  var visible_migration_count = 0.0;
  var aggregate_missing_count = 0.0;
  var level_changed_count = 0.0;
  var refine_pressure_count = 0.0;
  var refine_pressure_reason_mask = 0u;

  for (var row_index = 0u; row_index < params.level_update_row_count; row_index = row_index + 1u) {
    let offset = row_index * level_update_stride;
    if (ss_pvds_active_update(offset)) {
      let source_level = level_update_rows[offset + 1u];
      let target_level = level_update_rows[offset + 2u];
      let level_delta = level_update_rows[offset + 9u];
      let coarsen = level_update_rows[offset + 13u] > 0.0;
      let refine = level_update_rows[offset + 14u] > 0.0;
      let coherent_update = level_update_rows[offset + 15u] > 0.0;
      let residual_issue = level_update_rows[offset + 16u] > 1.0;
      let phase_volume_ratio = level_update_rows[offset + 8u];
      let row_refine_pressure_mask = u32(max(round(level_update_rows[offset + 31u]), 0.0));
      active_count = active_count + 1.0;
      coarsen_count = coarsen_count + select(0.0, 1.0, coarsen);
      refine_count = refine_count + select(0.0, 1.0, refine);
      coherent_count = coherent_count + select(0.0, 1.0, coherent_update);
      residual_issue_count = residual_issue_count + select(0.0, 1.0, residual_issue);
      min_source_level = min(min_source_level, source_level);
      max_source_level = max(max_source_level, source_level);
      min_target_level = min(min_target_level, target_level);
      max_target_level = max(max_target_level, target_level);
      max_positive_delta = max(max_positive_delta, max(level_delta, 0.0));
      max_negative_delta = min(max_negative_delta, min(level_delta, 0.0));
      total_rest_volume = total_rest_volume + level_update_rows[offset + 6u];
      total_represented_volume = total_represented_volume + level_update_rows[offset + 7u];
      total_aggregate_mass = total_aggregate_mass + level_update_rows[offset + 22u];
      total_aggregate_volume = total_aggregate_volume + level_update_rows[offset + 23u];
      total_abs_mass_residual = total_abs_mass_residual + abs(level_update_rows[offset + 24u]);
      total_abs_volume_residual = total_abs_volume_residual + abs(level_update_rows[offset + 25u]);
      steam_expansion_count = steam_expansion_count + select(
        0.0,
        1.0,
        phase_volume_ratio >= max(params.phase_volume_expand_threshold, 1.0)
      );
      admitted_update_count = admitted_update_count + select(0.0, 1.0, level_update_rows[offset + 17u] > 0.0);
      state_admission_required_count = state_admission_required_count + select(
        0.0,
        1.0,
        level_update_rows[offset + 30u] > 0.0
      );
      visible_migration_count = visible_migration_count + select(0.0, 1.0, coarsen || refine);
      aggregate_missing_count = aggregate_missing_count + select(0.0, 1.0, !coherent_update);
      level_changed_count = level_changed_count + select(0.0, 1.0, abs(target_level - source_level) > 0.5);
      refine_pressure_count = refine_pressure_count + select(0.0, 1.0, row_refine_pressure_mask != 0u);
      refine_pressure_reason_mask = refine_pressure_reason_mask | row_refine_pressure_mask;
    }
  }

  if (active_count == 0.0) {
    min_source_level = 0.0;
    max_source_level = 0.0;
    min_target_level = 0.0;
    max_target_level = 0.0;
  }

  summary_rows[summary_offset + 0u] = f32(params.level_update_row_count);
  summary_rows[summary_offset + 1u] = active_count;
  summary_rows[summary_offset + 2u] = coarsen_count;
  summary_rows[summary_offset + 3u] = refine_count;
  summary_rows[summary_offset + 4u] = coherent_count;
  summary_rows[summary_offset + 5u] = residual_issue_count;
  summary_rows[summary_offset + 6u] = min_source_level;
  summary_rows[summary_offset + 7u] = max_source_level;
  summary_rows[summary_offset + 8u] = min_target_level;
  summary_rows[summary_offset + 9u] = max_target_level;
  summary_rows[summary_offset + 10u] = max_positive_delta;
  summary_rows[summary_offset + 11u] = max_negative_delta;
  summary_rows[summary_offset + 12u] = total_rest_volume;
  summary_rows[summary_offset + 13u] = total_represented_volume;
  summary_rows[summary_offset + 14u] = total_aggregate_mass;
  summary_rows[summary_offset + 15u] = total_aggregate_volume;
  summary_rows[summary_offset + 16u] = total_abs_mass_residual;
  summary_rows[summary_offset + 17u] = total_abs_volume_residual;
  summary_rows[summary_offset + 18u] = steam_expansion_count;
  summary_rows[summary_offset + 19u] = admitted_update_count;
  summary_rows[summary_offset + 20u] = state_admission_required_count;
  summary_rows[summary_offset + 21u] = visible_migration_count;
  summary_rows[summary_offset + 22u] = aggregate_missing_count;
  summary_rows[summary_offset + 23u] = level_changed_count;
  summary_rows[summary_offset + 24u] = 1.0;
  summary_rows[summary_offset + 25u] = params.migration_epoch;
  summary_rows[summary_offset + 26u] = select(32.0, 1.0, active_count > 0.0);
  summary_rows[summary_offset + 27u] = max(params.phase_volume_expand_threshold, 1.0);
  summary_rows[summary_offset + 28u] = params.state_family_id;
  summary_rows[summary_offset + 29u] = 1.0;
  summary_rows[summary_offset + 30u] = refine_pressure_count;
  summary_rows[summary_offset + 31u] = f32(refine_pressure_reason_mask);
}
`;

export const schroederCrossLevelGridCouplingSharedWgsl = `
struct SchroederCrossLevelGridCouplingParams {
  fine_nx: u32,
  fine_ny: u32,
  fine_nz: u32,
  coarse_nx: u32,
  coarse_ny: u32,
  coarse_nz: u32,
  grid_stride: u32,
  flags: u32,
  fine_grid_spacing_m: f32,
  grid_origin_x_m: f32,
  grid_origin_y_m: f32,
  grid_origin_z_m: f32,
  grid_shift: i32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
  delta_scale: f32,
  shared_accel_dt_x: f32,
  shared_accel_dt_y: f32,
  shared_accel_dt_z: f32,
  // CFL velocity ceiling of the coarse grid update (cfl * coarse_dx /
  // coarse_dt). The delta prolongation clamps its raw momentum/mass parent
  // read to this bound so it lives in the same representable velocity space
  // as the (already clamped) post-update grid. Zero disables the clamp.
  max_coarse_velocity_m_per_s: f32,
  coupling_pad0: f32,
  coupling_pad1: f32,
  coupling_pad2: f32,
};

const SCHROEDER_GRID_COUPLING_WORKGROUP_SIZE: u32 = 64u;
const SCHROEDER_GRID_COUPLING_FLAG_ACCUMULATE: u32 = 1u;
const SCHROEDER_GRID_COUPLING_FLAG_Z_FASTEST: u32 = 2u;
const SCHROEDER_GRID_COUPLING_FLAG_VELOCITY_GRIDS: u32 = 4u;
const SCHROEDER_GRID_COUPLING_FLAG_PRE_VELOCITY_GRID: u32 = 8u;

fn schroeder_grid_axis_coords(index: u32, dims: vec3<u32>, flags: u32) -> vec3<u32> {
  if ((flags & SCHROEDER_GRID_COUPLING_FLAG_Z_FASTEST) != 0u) {
    let plane = dims.y * dims.z;
    let x = index / plane;
    let rem = index - x * plane;
    return vec3<u32>(x, rem / dims.z, rem % dims.z);
  }
  return vec3<u32>(
    index % dims.x,
    (index / dims.x) % dims.y,
    index / (dims.x * dims.y)
  );
}

fn schroeder_grid_axis_index(coords: vec3<u32>, dims: vec3<u32>, flags: u32) -> u32 {
  if ((flags & SCHROEDER_GRID_COUPLING_FLAG_Z_FASTEST) != 0u) {
    return coords.x * dims.y * dims.z + coords.y * dims.z + coords.z;
  }
  return coords.x + dims.x * (coords.y + dims.y * coords.z);
}

fn schroeder_fine_support_axis(coarse_axis: u32, offset: i32, shift: i32) -> i32 {
  return 2 * (i32(coarse_axis) - shift) + shift + offset;
}

fn schroeder_coarse_interpolation_axis(fine_axis: u32, shift: i32) -> vec2<f32> {
  let coordinate = f32(i32(fine_axis) - shift) * 0.5 + f32(shift);
  let lower = floor(coordinate);
  return vec2<f32>(lower, coordinate - lower);
}

fn schroeder_linear_axis_weight(offset: i32) -> f32 {
  return select(0.5, 1.0, offset == 0);
}
`;

export const schroederCrossLevelGridRestrictionWgsl = `${schroederCrossLevelGridCouplingSharedWgsl}
@group(0) @binding(0) var<storage, read> fine_grid: array<f32>;
@group(0) @binding(1) var<storage, read_write> coarse_grid: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederCrossLevelGridCouplingParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let coarse_index = global_id.x;
  let coarse_dims = vec3<u32>(params.coarse_nx, params.coarse_ny, params.coarse_nz);
  let fine_dims = vec3<u32>(params.fine_nx, params.fine_ny, params.fine_nz);
  let coarse_count = coarse_dims.x * coarse_dims.y * coarse_dims.z;
  if (coarse_index >= coarse_count) {
    return;
  }
  let stride = max(params.grid_stride, 8u);
  let accumulate = (params.flags & SCHROEDER_GRID_COUPLING_FLAG_ACCUMULATE) != 0u;
  let coarse_coords = schroeder_grid_axis_coords(coarse_index, coarse_dims, params.flags);

  var mass_kg = 0.0;
  var momentum = vec3<f32>(0.0, 0.0, 0.0);
  for (var dz = -1i; dz <= 1i; dz = dz + 1i) {
    let fz = schroeder_fine_support_axis(coarse_coords.z, dz, params.grid_shift);
    if (fz < 0 || fz >= i32(fine_dims.z)) {
      continue;
    }
    let wz = schroeder_linear_axis_weight(dz);
    for (var dy = -1i; dy <= 1i; dy = dy + 1i) {
      let fy = schroeder_fine_support_axis(coarse_coords.y, dy, params.grid_shift);
      if (fy < 0 || fy >= i32(fine_dims.y)) {
        continue;
      }
      let wy = schroeder_linear_axis_weight(dy);
      for (var dx = -1i; dx <= 1i; dx = dx + 1i) {
        let fx = schroeder_fine_support_axis(coarse_coords.x, dx, params.grid_shift);
        if (fx < 0 || fx >= i32(fine_dims.x)) {
          continue;
        }
        let weight = schroeder_linear_axis_weight(dx) * wy * wz;
        let fine_index = schroeder_grid_axis_index(
          vec3<u32>(u32(fx), u32(fy), u32(fz)),
          fine_dims,
          params.flags
        );
        let fine_offset = fine_index * stride;
        let node_mass = max(fine_grid[fine_offset], 0.0);
        mass_kg = mass_kg + weight * node_mass;
        momentum = momentum + weight * vec3<f32>(
          fine_grid[fine_offset + 1u],
          fine_grid[fine_offset + 2u],
          fine_grid[fine_offset + 3u]
        );
      }
    }
  }

  let coarse_spacing_m = params.fine_grid_spacing_m * 2.0;
  let coarse_offset = coarse_index * stride;
  if (accumulate) {
    let total_mass = coarse_grid[coarse_offset] + mass_kg;
    coarse_grid[coarse_offset] = total_mass;
    coarse_grid[coarse_offset + 1u] = coarse_grid[coarse_offset + 1u] + momentum.x;
    coarse_grid[coarse_offset + 2u] = coarse_grid[coarse_offset + 2u] + momentum.y;
    coarse_grid[coarse_offset + 3u] = coarse_grid[coarse_offset + 3u] + momentum.z;
    coarse_grid[coarse_offset + 7u] = select(
      coarse_grid[coarse_offset + 7u],
      1.0,
      total_mass > 0.0
    );
  } else {
    coarse_grid[coarse_offset] = mass_kg;
    coarse_grid[coarse_offset + 1u] = momentum.x;
    coarse_grid[coarse_offset + 2u] = momentum.y;
    coarse_grid[coarse_offset + 3u] = momentum.z;
    coarse_grid[coarse_offset + 4u] = params.grid_origin_x_m
      + f32(i32(coarse_coords.x) - params.grid_shift) * coarse_spacing_m;
    coarse_grid[coarse_offset + 5u] = params.grid_origin_y_m
      + f32(i32(coarse_coords.y) - params.grid_shift) * coarse_spacing_m;
    coarse_grid[coarse_offset + 6u] = params.grid_origin_z_m
      + f32(i32(coarse_coords.z) - params.grid_shift) * coarse_spacing_m;
    coarse_grid[coarse_offset + 7u] = select(0.0, 1.0, mass_kg > 0.0);
  }
}
`;

export const schroederSameGridMomentumAccumulationWgsl = `
struct SchroederSameGridMomentumAccumulationParams {
  node_count: u32,
  grid_stride: u32,
  flags: u32,
  pad0: u32,
};

@group(0) @binding(0) var<storage, read> source_grid: array<f32>;
@group(0) @binding(1) var<storage, read_write> target_grid: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederSameGridMomentumAccumulationParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = global_id.x;
  if (node_index >= params.node_count) { return; }
  let stride = max(params.grid_stride, 8u);
  let offset = node_index * stride;
  let source_mass = max(source_grid[offset], 0.0);
  if (!(source_mass > 0.0)) { return; }
  let target_mass = max(target_grid[offset], 0.0);
  target_grid[offset] = target_mass + source_mass;
  target_grid[offset + 1u] = target_grid[offset + 1u] + source_grid[offset + 1u];
  target_grid[offset + 2u] = target_grid[offset + 2u] + source_grid[offset + 2u];
  target_grid[offset + 3u] = target_grid[offset + 3u] + source_grid[offset + 3u];
  if (!(target_mass > 0.0)) {
    target_grid[offset + 4u] = source_grid[offset + 4u];
    target_grid[offset + 5u] = source_grid[offset + 5u];
    target_grid[offset + 6u] = source_grid[offset + 6u];
  }
  target_grid[offset + 7u] = 1.0;
}
`;

export const schroederCrossLevelGridProlongationWgsl = `${schroederCrossLevelGridCouplingSharedWgsl}
@group(0) @binding(0) var<storage, read> coarse_grid: array<f32>;
@group(0) @binding(1) var<storage, read_write> fine_grid: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederCrossLevelGridCouplingParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let fine_index = global_id.x;
  let fine_dims = vec3<u32>(params.fine_nx, params.fine_ny, params.fine_nz);
  let coarse_dims = vec3<u32>(params.coarse_nx, params.coarse_ny, params.coarse_nz);
  let fine_count = fine_dims.x * fine_dims.y * fine_dims.z;
  if (fine_index >= fine_count) {
    return;
  }
  let stride = max(params.grid_stride, 8u);
  let fine_coords = schroeder_grid_axis_coords(fine_index, fine_dims, params.flags);
  let coarse_x = schroeder_coarse_interpolation_axis(fine_coords.x, params.grid_shift);
  let coarse_y = schroeder_coarse_interpolation_axis(fine_coords.y, params.grid_shift);
  let coarse_z = schroeder_coarse_interpolation_axis(fine_coords.z, params.grid_shift);
  let velocity_grids = (params.flags & SCHROEDER_GRID_COUPLING_FLAG_VELOCITY_GRIDS) != 0u;
  var interpolated_velocity = vec3<f32>(0.0);
  var weight_sum = 0.0;
  var complete = true;
  for (var oz = 0u; oz < 2u; oz = oz + 1u) {
    let cz = i32(coarse_z.x) + i32(oz);
    let wz = select(1.0 - coarse_z.y, coarse_z.y, oz == 1u);
    if (!(wz > 0.0)) { continue; }
    for (var oy = 0u; oy < 2u; oy = oy + 1u) {
      let cy = i32(coarse_y.x) + i32(oy);
      let wy = select(1.0 - coarse_y.y, coarse_y.y, oy == 1u);
      if (!(wy > 0.0)) { continue; }
      for (var ox = 0u; ox < 2u; ox = ox + 1u) {
        let cx = i32(coarse_x.x) + i32(ox);
        let wx = select(1.0 - coarse_x.y, coarse_x.y, ox == 1u);
        let weight = wx * wy * wz;
        if (!(weight > 0.0)) { continue; }
        if (
          cx < 0 || cy < 0 || cz < 0
          || cx >= i32(coarse_dims.x)
          || cy >= i32(coarse_dims.y)
          || cz >= i32(coarse_dims.z)
        ) {
          complete = false;
          continue;
        }
        let coarse_index = schroeder_grid_axis_index(
          vec3<u32>(u32(cx), u32(cy), u32(cz)),
          coarse_dims,
          params.flags
        );
        let coarse_offset = coarse_index * stride;
        let coarse_mass = coarse_grid[coarse_offset];
        if (!(coarse_mass > 0.0)) {
          complete = false;
          continue;
        }
        var parent_velocity = vec3<f32>(
          coarse_grid[coarse_offset + 1u],
          coarse_grid[coarse_offset + 2u],
          coarse_grid[coarse_offset + 3u]
        );
        if (!velocity_grids) { parent_velocity = parent_velocity / coarse_mass; }
        interpolated_velocity = interpolated_velocity + weight * parent_velocity;
        weight_sum = weight_sum + weight;
      }
    }
  }
  if (!complete || abs(weight_sum - 1.0) > 0.000001) {
    return;
  }
  let fine_offset = fine_index * stride;
  let fine_mass = max(fine_grid[fine_offset], 0.0);
  if (!(fine_mass > 0.0)) { return; }
  if (velocity_grids) {
    fine_grid[fine_offset + 1u] = interpolated_velocity.x;
    fine_grid[fine_offset + 2u] = interpolated_velocity.y;
    fine_grid[fine_offset + 3u] = interpolated_velocity.z;
  } else {
    fine_grid[fine_offset + 1u] = fine_mass * interpolated_velocity.x;
    fine_grid[fine_offset + 2u] = fine_mass * interpolated_velocity.y;
    fine_grid[fine_offset + 3u] = fine_mass * interpolated_velocity.z;
  }
}
`;

export const schroederCrossLevelGridConservationSummaryWgsl = `${schroederCrossLevelGridCouplingSharedWgsl}
@group(0) @binding(0) var<storage, read> fine_grid: array<f32>;
@group(0) @binding(1) var<storage, read> coarse_grid: array<f32>;
@group(0) @binding(2) var<storage, read_write> summary_row: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederCrossLevelGridCouplingParams;

const SCHROEDER_GRID_SUMMARY_WORKGROUP_SIZE: u32 = 64u;

var<workgroup> wg_fine_mass: array<f32, 64>;
var<workgroup> wg_fine_momentum_x: array<f32, 64>;
var<workgroup> wg_fine_momentum_y: array<f32, 64>;
var<workgroup> wg_fine_momentum_z: array<f32, 64>;
var<workgroup> wg_fine_active: array<f32, 64>;
var<workgroup> wg_coarse_mass: array<f32, 64>;
var<workgroup> wg_coarse_momentum_x: array<f32, 64>;
var<workgroup> wg_coarse_momentum_y: array<f32, 64>;
var<workgroup> wg_coarse_momentum_z: array<f32, 64>;
var<workgroup> wg_coarse_active: array<f32, 64>;

@compute @workgroup_size(64)
fn main(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let local_index = local_id.x;
  let stride = max(params.grid_stride, 8u);
  let fine_count = params.fine_nx * params.fine_ny * params.fine_nz;
  let coarse_count = params.coarse_nx * params.coarse_ny * params.coarse_nz;

  var fine_mass = 0.0;
  var fine_momentum = vec3<f32>(0.0, 0.0, 0.0);
  var fine_active = 0.0;
  for (var index = local_index; index < fine_count; index = index + SCHROEDER_GRID_SUMMARY_WORKGROUP_SIZE) {
    let offset = index * stride;
    let node_mass = max(fine_grid[offset], 0.0);
    fine_mass = fine_mass + node_mass;
    fine_momentum = fine_momentum + vec3<f32>(
      fine_grid[offset + 1u],
      fine_grid[offset + 2u],
      fine_grid[offset + 3u]
    );
    fine_active = fine_active + select(0.0, 1.0, node_mass > 0.0);
  }

  var coarse_mass = 0.0;
  var coarse_momentum = vec3<f32>(0.0, 0.0, 0.0);
  var coarse_active = 0.0;
  for (var index = local_index; index < coarse_count; index = index + SCHROEDER_GRID_SUMMARY_WORKGROUP_SIZE) {
    let offset = index * stride;
    let node_mass = max(coarse_grid[offset], 0.0);
    coarse_mass = coarse_mass + node_mass;
    coarse_momentum = coarse_momentum + vec3<f32>(
      coarse_grid[offset + 1u],
      coarse_grid[offset + 2u],
      coarse_grid[offset + 3u]
    );
    coarse_active = coarse_active + select(0.0, 1.0, node_mass > 0.0);
  }

  wg_fine_mass[local_index] = fine_mass;
  wg_fine_momentum_x[local_index] = fine_momentum.x;
  wg_fine_momentum_y[local_index] = fine_momentum.y;
  wg_fine_momentum_z[local_index] = fine_momentum.z;
  wg_fine_active[local_index] = fine_active;
  wg_coarse_mass[local_index] = coarse_mass;
  wg_coarse_momentum_x[local_index] = coarse_momentum.x;
  wg_coarse_momentum_y[local_index] = coarse_momentum.y;
  wg_coarse_momentum_z[local_index] = coarse_momentum.z;
  wg_coarse_active[local_index] = coarse_active;
  workgroupBarrier();

  if (local_index == 0u) {
    var sum_fine_mass = 0.0;
    var sum_fine_momentum = vec3<f32>(0.0, 0.0, 0.0);
    var sum_fine_active = 0.0;
    var sum_coarse_mass = 0.0;
    var sum_coarse_momentum = vec3<f32>(0.0, 0.0, 0.0);
    var sum_coarse_active = 0.0;
    for (var index = 0u; index < SCHROEDER_GRID_SUMMARY_WORKGROUP_SIZE; index = index + 1u) {
      sum_fine_mass = sum_fine_mass + wg_fine_mass[index];
      sum_fine_momentum = sum_fine_momentum + vec3<f32>(
        wg_fine_momentum_x[index],
        wg_fine_momentum_y[index],
        wg_fine_momentum_z[index]
      );
      sum_fine_active = sum_fine_active + wg_fine_active[index];
      sum_coarse_mass = sum_coarse_mass + wg_coarse_mass[index];
      sum_coarse_momentum = sum_coarse_momentum + vec3<f32>(
        wg_coarse_momentum_x[index],
        wg_coarse_momentum_y[index],
        wg_coarse_momentum_z[index]
      );
      sum_coarse_active = sum_coarse_active + wg_coarse_active[index];
    }
    summary_row[0] = sum_fine_mass;
    summary_row[1] = sum_fine_momentum.x;
    summary_row[2] = sum_fine_momentum.y;
    summary_row[3] = sum_fine_momentum.z;
    summary_row[4] = sum_coarse_mass;
    summary_row[5] = sum_coarse_momentum.x;
    summary_row[6] = sum_coarse_momentum.y;
    summary_row[7] = sum_coarse_momentum.z;
    summary_row[8] = abs(sum_fine_mass - sum_coarse_mass);
    summary_row[9] = abs(sum_fine_momentum.x - sum_coarse_momentum.x);
    summary_row[10] = abs(sum_fine_momentum.y - sum_coarse_momentum.y);
    summary_row[11] = abs(sum_fine_momentum.z - sum_coarse_momentum.z);
    summary_row[12] = sum_fine_active;
    summary_row[13] = sum_coarse_active;
    summary_row[14] = 1.0;
    summary_row[15] = f32(params.flags);
  }
}
`;

export const schroederCrossLevelGridVelocityDeltaProlongationWgsl = `${schroederCrossLevelGridCouplingSharedWgsl}
@group(0) @binding(0) var<storage, read> coarse_pre_grid: array<f32>;
@group(0) @binding(1) var<storage, read> coarse_post_grid: array<f32>;
@group(0) @binding(2) var<storage, read_write> fine_grid: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederCrossLevelGridCouplingParams;

// Delta-form prolongation (AMR velocity correction): each massive fine node
// receives a trilinear interpolation of the coarse velocity change. The same
// dyadic basis is used by restriction, so complete supports preserve POU and
// reproduce affine coarse corrections. Wall response is part of the coarse
// target; no boundary-band early return is allowed to break the basis.
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let fine_index = global_id.x;
  let fine_dims = vec3<u32>(params.fine_nx, params.fine_ny, params.fine_nz);
  let coarse_dims = vec3<u32>(params.coarse_nx, params.coarse_ny, params.coarse_nz);
  let fine_count = fine_dims.x * fine_dims.y * fine_dims.z;
  if (fine_index >= fine_count) {
    return;
  }
  let stride = max(params.grid_stride, 8u);
  let fine_offset = fine_index * stride;
  let fine_mass = fine_grid[fine_offset];
  if (fine_mass <= 0.0) {
    return;
  }
  let fine_coords = schroeder_grid_axis_coords(fine_index, fine_dims, params.flags);
  let coarse_x = schroeder_coarse_interpolation_axis(fine_coords.x, params.grid_shift);
  let coarse_y = schroeder_coarse_interpolation_axis(fine_coords.y, params.grid_shift);
  let coarse_z = schroeder_coarse_interpolation_axis(fine_coords.z, params.grid_shift);
  let vmax = params.max_coarse_velocity_m_per_s;
  var pre_velocity = vec3<f32>(0.0);
  var post_velocity = vec3<f32>(0.0);
  var weight_sum = 0.0;
  var complete = true;
  for (var oz = 0u; oz < 2u; oz = oz + 1u) {
    let cz = i32(coarse_z.x) + i32(oz);
    let wz = select(1.0 - coarse_z.y, coarse_z.y, oz == 1u);
    if (!(wz > 0.0)) { continue; }
    for (var oy = 0u; oy < 2u; oy = oy + 1u) {
      let cy = i32(coarse_y.x) + i32(oy);
      let wy = select(1.0 - coarse_y.y, coarse_y.y, oy == 1u);
      if (!(wy > 0.0)) { continue; }
      for (var ox = 0u; ox < 2u; ox = ox + 1u) {
        let cx = i32(coarse_x.x) + i32(ox);
        let wx = select(1.0 - coarse_x.y, coarse_x.y, ox == 1u);
        let weight = wx * wy * wz;
        if (!(weight > 0.0)) { continue; }
        if (
          cx < 0 || cy < 0 || cz < 0
          || cx >= i32(coarse_dims.x)
          || cy >= i32(coarse_dims.y)
          || cz >= i32(coarse_dims.z)
        ) {
          complete = false;
          continue;
        }
        let coarse_offset = schroeder_grid_axis_index(
          vec3<u32>(u32(cx), u32(cy), u32(cz)),
          coarse_dims,
          params.flags
        ) * stride;
        let pre_mass = coarse_pre_grid[coarse_offset];
        let post_mass = coarse_post_grid[coarse_offset];
        if (
          !(pre_mass > 0.0) || !(post_mass > 0.0)
          || min(pre_mass, post_mass) < 0.5 * max(pre_mass, post_mass)
        ) {
          complete = false;
          continue;
        }
        var parent_pre_velocity = vec3<f32>(
          coarse_pre_grid[coarse_offset + 1u],
          coarse_pre_grid[coarse_offset + 2u],
          coarse_pre_grid[coarse_offset + 3u]
        );
        if ((params.flags & SCHROEDER_GRID_COUPLING_FLAG_PRE_VELOCITY_GRID) == 0u) {
          parent_pre_velocity = parent_pre_velocity / pre_mass;
        }
        if (vmax > 0.0) {
          let largest_pre_component = max(
            max(abs(parent_pre_velocity.x), abs(parent_pre_velocity.y)),
            abs(parent_pre_velocity.z)
          );
          if (largest_pre_component > 0.0) {
            let scaled_pre_velocity =
              parent_pre_velocity / largest_pre_component;
            let scaled_pre_length = max(
              length(scaled_pre_velocity),
              1.0e-30
            );
            if (largest_pre_component > vmax / scaled_pre_length) {
              parent_pre_velocity = scaled_pre_velocity
                * (vmax / scaled_pre_length);
            }
          }
        }
        let parent_post_velocity = vec3<f32>(
          coarse_post_grid[coarse_offset + 1u],
          coarse_post_grid[coarse_offset + 2u],
          coarse_post_grid[coarse_offset + 3u]
        );
        pre_velocity = pre_velocity + weight * parent_pre_velocity;
        post_velocity = post_velocity + weight * parent_post_velocity;
        weight_sum = weight_sum + weight;
      }
    }
  }
  if (!complete || abs(weight_sum - 1.0) > 0.000001) { return; }
  // delta_scale supports subcycled fine substeps: each substep applies its
  // time-interpolated share of the coarse correction (scale 1/substeps),
  // summing to the full delta across the coarse step. Zero means 1.
  // shared_accel_dt removes velocity change the fine level integrates
  // itself (gravity and other uniform shared accelerations times the
  // coarse dt), so the transferred delta carries only coarse-grid-specific
  // information and shared forces are not double counted.
  let scale = select(params.delta_scale, 1.0, params.delta_scale == 0.0);
  let shared_accel_dt = vec3<f32>(
    params.shared_accel_dt_x,
    params.shared_accel_dt_y,
    params.shared_accel_dt_z
  );
  var delta = (post_velocity - pre_velocity - shared_accel_dt) * scale;
  // Defense in depth: one substep's correction may not exceed its share of
  // the coarse solver's own velocity range (vmax * scale). With both
  // operands clamped above this is nearly redundant, but it bounds the
  // applied delta even if a future layout change reintroduces raw reads.
  if (vmax > 0.0) {
    let delta_budget = vmax * scale;
    let delta_speed2 = dot(delta, delta);
    if (delta_speed2 > delta_budget * delta_budget) {
      delta = delta * (delta_budget / sqrt(delta_speed2));
    }
  }
  fine_grid[fine_offset + 1u] = fine_grid[fine_offset + 1u] + delta.x;
  fine_grid[fine_offset + 2u] = fine_grid[fine_offset + 2u] + delta.y;
  fine_grid[fine_offset + 3u] = fine_grid[fine_offset + 3u] + delta.z;
}
`;

function schroederCompactHierarchyDispatchVariant(source, {
  invocationKind,
  hierarchyBinding,
  paramsBinding
}) {
  const paramsDeclaration = `@group(0) @binding(${hierarchyBinding}) var<uniform> params: SchroederCrossLevelGridCouplingParams;`;
  const replacementDeclaration = `@group(0) @binding(${hierarchyBinding}) var<storage, read> hierarchy_view: array<u32>;
@group(0) @binding(${paramsBinding}) var<uniform> params: SchroederCrossLevelGridCouplingParams;`;
  const compactIndexColumn = invocationKind == 'fine' ? '34u' : '35u';
  const nodeOffsetColumn = invocationKind == 'fine' ? '48u' : '49u';
  const denseName = invocationKind == 'fine' ? 'fine_index' : 'coarse_index';
  const invocationMapping = `let compact_${invocationKind}_index = global_id.x;
  let hierarchy_admitted = arrayLength(&hierarchy_view) >= 68u
    && hierarchy_view[0u] == 0x53485631u
    && hierarchy_view[1u] == 1u
    && (hierarchy_view[2u] & 3u) == 3u
    && hierarchy_view[18u] == params.fine_nx * params.fine_ny * params.fine_nz
    && hierarchy_view[19u] == params.coarse_nx * params.coarse_ny * params.coarse_nz
    && hierarchy_view[28u] == bitcast<u32>(params.fine_grid_spacing_m)
    && hierarchy_view[29u] == bitcast<u32>(params.fine_grid_spacing_m * 2.0);
  if (!hierarchy_admitted || compact_${invocationKind}_index >= hierarchy_view[${compactIndexColumn}]) {
    return;
  }
  let compact_node_offset = hierarchy_view[${nodeOffsetColumn}];
  if (compact_node_offset + compact_${invocationKind}_index >= arrayLength(&hierarchy_view)) {
    return;
  }
  let ${denseName} = hierarchy_view[compact_node_offset + compact_${invocationKind}_index];`;
  return source
    .replace(paramsDeclaration, replacementDeclaration)
    .replace(`let ${denseName} = global_id.x;`, invocationMapping);
}

export const schroederCrossLevelGridRestrictionCompactWgsl =
  schroederCompactHierarchyDispatchVariant(
    schroederCrossLevelGridRestrictionWgsl,
    { invocationKind: 'coarse', hierarchyBinding: 2, paramsBinding: 3 }
  );

export const schroederCrossLevelGridProlongationCompactWgsl =
  schroederCompactHierarchyDispatchVariant(
    schroederCrossLevelGridProlongationWgsl,
    { invocationKind: 'fine', hierarchyBinding: 2, paramsBinding: 3 }
  );

export const schroederCrossLevelGridVelocityDeltaProlongationCompactWgsl =
  schroederCompactHierarchyDispatchVariant(
    schroederCrossLevelGridVelocityDeltaProlongationWgsl,
    { invocationKind: 'fine', hierarchyBinding: 3, paramsBinding: 4 }
  );

export const schroederParticleStorageCountSummaryWgsl = `
struct SchroederParticleStorageCountSummaryParams {
  materialization_row_count: u32,
  materialization_stride: u32,
  source_particle_count: u32,
  flags: u32,
};

@group(0) @binding(0) var<storage, read> materialization_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> summary_row: array<f32>;
@group(0) @binding(2) var<uniform> params: SchroederParticleStorageCountSummaryParams;

const SCHROEDER_PSC_WORKGROUP_SIZE: u32 = 64u;

var<workgroup> wg_admitted_rows: array<f32, 64>;
var<workgroup> wg_written_target: array<f32, 64>;
var<workgroup> wg_appended_target: array<f32, 64>;
var<workgroup> wg_freed_source: array<f32, 64>;
var<workgroup> wg_source_mass: array<f32, 64>;
var<workgroup> wg_target_mass: array<f32, 64>;
var<workgroup> wg_mass_residual_max: array<f32, 64>;
var<workgroup> wg_blocked_rows: array<f32, 64>;

// Reduces admitted particle-storage materialization rows into one compact
// count summary. The authoritative count delta is append-only: written
// target slots at or beyond the source particle count extend the live
// range, while freed source slots become zero-mass holes until a future
// compaction pass exists, so they never shrink the count here.
@compute @workgroup_size(64)
fn main(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let local_index = local_id.x;
  let stride = max(params.materialization_stride, 32u);

  var admitted_rows = 0.0;
  var written_target = 0.0;
  var appended_target = 0.0;
  var freed_source = 0.0;
  var source_mass = 0.0;
  var target_mass = 0.0;
  var mass_residual_max = 0.0;
  var blocked_rows = 0.0;
  for (var row = local_index; row < params.materialization_row_count; row = row + SCHROEDER_PSC_WORKGROUP_SIZE) {
    let offset = row * stride;
    let status = materialization_rows[offset + 3u];
    let admitted = materialization_rows[offset + 6u];
    if (status <= 0.0 || status >= 32.0 || admitted <= 0.0) {
      blocked_rows = blocked_rows + 1.0;
      continue;
    }
    admitted_rows = admitted_rows + 1.0;
    let written_start = materialization_rows[offset + 12u];
    let written_count = max(materialization_rows[offset + 13u], 0.0);
    let freed_count = max(materialization_rows[offset + 15u], 0.0);
    written_target = written_target + written_count;
    if (written_count > 0.0 && written_start >= f32(params.source_particle_count)) {
      appended_target = appended_target + written_count;
    }
    freed_source = freed_source + freed_count;
    source_mass = source_mass + max(materialization_rows[offset + 16u], 0.0);
    target_mass = target_mass + max(materialization_rows[offset + 17u], 0.0);
    mass_residual_max = max(mass_residual_max, abs(materialization_rows[offset + 18u]));
  }

  wg_admitted_rows[local_index] = admitted_rows;
  wg_written_target[local_index] = written_target;
  wg_appended_target[local_index] = appended_target;
  wg_freed_source[local_index] = freed_source;
  wg_source_mass[local_index] = source_mass;
  wg_target_mass[local_index] = target_mass;
  wg_mass_residual_max[local_index] = mass_residual_max;
  wg_blocked_rows[local_index] = blocked_rows;
  workgroupBarrier();

  if (local_index == 0u) {
    var sum_admitted = 0.0;
    var sum_written = 0.0;
    var sum_appended = 0.0;
    var sum_freed = 0.0;
    var sum_source_mass = 0.0;
    var sum_target_mass = 0.0;
    var max_mass_residual = 0.0;
    var sum_blocked = 0.0;
    for (var index = 0u; index < SCHROEDER_PSC_WORKGROUP_SIZE; index = index + 1u) {
      sum_admitted = sum_admitted + wg_admitted_rows[index];
      sum_written = sum_written + wg_written_target[index];
      sum_appended = sum_appended + wg_appended_target[index];
      sum_freed = sum_freed + wg_freed_source[index];
      sum_source_mass = sum_source_mass + wg_source_mass[index];
      sum_target_mass = sum_target_mass + wg_target_mass[index];
      max_mass_residual = max(max_mass_residual, wg_mass_residual_max[index]);
      sum_blocked = sum_blocked + wg_blocked_rows[index];
    }
    summary_row[0] = f32(params.materialization_row_count);
    summary_row[1] = sum_admitted;
    summary_row[2] = sum_written;
    summary_row[3] = sum_appended;
    summary_row[4] = sum_freed;
    summary_row[5] = sum_appended;
    summary_row[6] = sum_source_mass;
    summary_row[7] = sum_target_mass;
    summary_row[8] = max_mass_residual;
    summary_row[9] = sum_blocked;
    summary_row[10] = f32(params.source_particle_count);
    summary_row[11] = f32(params.source_particle_count) + sum_appended;
    summary_row[12] = 0.0;
    summary_row[13] = 0.0;
    summary_row[14] = 1.0;
    summary_row[15] = f32(params.flags);
  }
}
`;

export const schroederParticleStorageCompactionWgsl = `
struct SchroederParticleStorageCompactionParams {
  scan_slot_count: u32,
  state_vec4_stride: u32,
  thermo_vec4_stride: u32,
  mechanics_vec4_stride: u32,
  source_particle_count: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> in_sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> in_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_sph_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> summary_row: array<f32>;
@group(0) @binding(7) var<uniform> params: SchroederParticleStorageCompactionParams;
@group(0) @binding(8) var<storage, read> in_particle_identity: array<u32>;
@group(0) @binding(9) var<storage, read_write> out_particle_identity: array<u32>;

const SCHROEDER_PSCOMP_WORKGROUP_SIZE: u32 = 64u;

var<workgroup> wg_live_counts: array<u32, 64>;
var<workgroup> wg_chunk_bases: array<u32, 64>;
var<workgroup> wg_live_mass: array<f32, 64>;
var<workgroup> wg_hole_count: array<f32, 64>;

fn ss_pscomp_slot_live(slot: u32) -> bool {
  let state_stride = max(params.state_vec4_stride, 2u);
  return in_sph_state[slot * state_stride].w > 0.0;
}

fn ss_pscomp_copy_slot(source_slot: u32, target_slot: u32) {
  let state_stride = max(params.state_vec4_stride, 2u);
  let thermo_stride = max(params.thermo_vec4_stride, 3u);
  let mechanics_stride = max(params.mechanics_vec4_stride, 8u);
  for (var part = 0u; part < state_stride; part = part + 1u) {
    out_sph_state[target_slot * state_stride + part] = in_sph_state[source_slot * state_stride + part];
  }
  for (var part = 0u; part < thermo_stride; part = part + 1u) {
    out_sph_thermo[target_slot * thermo_stride + part] = in_sph_thermo[source_slot * thermo_stride + part];
  }
  for (var part = 0u; part < mechanics_stride; part = part + 1u) {
    out_mls_mechanics[target_slot * mechanics_stride + part] =
      in_mls_mechanics[source_slot * mechanics_stride + part];
  }
  out_particle_identity[target_slot] = in_particle_identity[source_slot];
}

// Order-preserving stream compaction over the particle live range: freed
// (zero-mass) slots left by admitted split/merge materialization are removed
// so live particles occupy a dense [0, liveCount) range. One workgroup owns
// the pass: each thread counts live slots in its contiguous chunk, thread 0
// computes the exclusive prefix, then each thread scatters its chunk in
// order. Deterministic, no atomics; output buffers must be freshly created
// (WebGPU zero-initializes) so trailing slots stay empty.
@compute @workgroup_size(64)
fn main(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let local_index = local_id.x;
  let chunk = (params.scan_slot_count + SCHROEDER_PSCOMP_WORKGROUP_SIZE - 1u)
    / SCHROEDER_PSCOMP_WORKGROUP_SIZE;
  let chunk_start = local_index * chunk;
  let chunk_end = min(chunk_start + chunk, params.scan_slot_count);

  var live_count = 0u;
  var live_mass = 0.0;
  var hole_count = 0.0;
  for (var slot = chunk_start; slot < chunk_end; slot = slot + 1u) {
    if (ss_pscomp_slot_live(slot)) {
      live_count = live_count + 1u;
      live_mass = live_mass + in_sph_state[slot * max(params.state_vec4_stride, 2u)].w;
    } else {
      hole_count = hole_count + 1.0;
    }
  }
  wg_live_counts[local_index] = live_count;
  wg_live_mass[local_index] = live_mass;
  wg_hole_count[local_index] = hole_count;
  workgroupBarrier();

  if (local_index == 0u) {
    var base = 0u;
    for (var index = 0u; index < SCHROEDER_PSCOMP_WORKGROUP_SIZE; index = index + 1u) {
      wg_chunk_bases[index] = base;
      base = base + wg_live_counts[index];
    }
  }
  workgroupBarrier();

  var target_slot = wg_chunk_bases[local_index];
  for (var slot = chunk_start; slot < chunk_end; slot = slot + 1u) {
    if (ss_pscomp_slot_live(slot)) {
      ss_pscomp_copy_slot(slot, target_slot);
      target_slot = target_slot + 1u;
    }
  }
  workgroupBarrier();

  if (local_index == 0u) {
    var total_live = 0.0;
    var total_mass = 0.0;
    var total_holes = 0.0;
    for (var index = 0u; index < SCHROEDER_PSCOMP_WORKGROUP_SIZE; index = index + 1u) {
      total_live = total_live + f32(wg_live_counts[index]);
      total_mass = total_mass + wg_live_mass[index];
      total_holes = total_holes + wg_hole_count[index];
    }
    summary_row[0] = f32(params.scan_slot_count);
    summary_row[1] = total_live;
    summary_row[2] = total_holes;
    summary_row[3] = total_mass;
    summary_row[4] = f32(params.source_particle_count);
    summary_row[5] = total_live - f32(params.source_particle_count);
    summary_row[6] = 0.0;
    summary_row[7] = 0.0;
    summary_row[8] = 0.0;
    summary_row[9] = 0.0;
    summary_row[10] = 0.0;
    summary_row[11] = total_live;
    summary_row[12] = 0.0;
    summary_row[13] = 0.0;
    summary_row[14] = 1.0;
    summary_row[15] = f32(params.flags);
  }
}
`;
