import {
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_DISPATCH,
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_HASH_PROBE,
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_NODE_ARENA,
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_PRIMITIVE,
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_SOURCE_IDENTITY,
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_UNSUPPORTED_SOURCE,
  SCHROEDER_SPARSE_GRID_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPARSE_GRID_VIEW_STATUS_FAIL_CLOSED,
  SCHROEDER_SPARSE_GRID_VIEW_STATUS_READY
} from './schroederSparseGridView.js';

export const schroederSparseGridViewWgsl = /* wgsl */ `
struct SparseGridViewParams {
  full_grid_node_count: u32,
  grid_node_capacity: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  grid_shift: u32,
  selected_level: i32,
  chart_id: i32,
  particle_capacity: u32,
  assignment_stride_floats: u32,
  state_stride_vec4: u32,
  hash_key_word_offset: u32,
  hash_value_word_offset: u32,
  reverse_mapping_word_offset: u32,
  generation_id: u32,
  max_dispatch_dimension: u32,
  physical_hash_capacity: u32,
  hash_max_probes: u32,
  unsupported_source_mask: u32,
  grid_spacing_m: f32,
  resident_particle_count: u32,
  hierarchy_generation_id: u32,
  source_identity_mismatch: u32,
  stencil_width: u32,
  product_event_enabled: u32,
  product_event_capacity: u32,
  product_event_stride_vec4: u32,
  product_event_generation_id: u32,
  product_event_identity_generation: u32,
  product_event_position_epoch: u32,
  product_event_lease_token_low: u32,
  product_event_lease_token_high: u32,
  product_event_source_count: u32,
  product_event_consumer_bit: u32,
  pressure_force_enabled: u32,
  pressure_force_capacity: u32,
  pressure_force_stride_vec4: u32,
  pressure_force_generation_id: u32,
  pressure_force_identity_generation: u32,
  pressure_force_position_epoch: u32,
  pressure_force_lease_token_low: u32,
  pressure_force_lease_token_high: u32,
  pressure_force_source_count: u32,
  pressure_force_consumer_bit: u32,
};

@group(0) @binding(0) var<storage, read> particle_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> level_assignments: array<f32>;
@group(0) @binding(2) var<storage, read> hierarchy_evidence: array<u32>;
@group(0) @binding(3) var<storage, read_write> sparse_view: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> candidate_keys: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read> particle_count_metadata: array<u32>;
@group(0) @binding(6) var<storage, read_write> grid_dispatch: array<u32>;
@group(0) @binding(7) var<storage, read> primitive_evidence: array<u32>;
@group(0) @binding(8) var<storage, read> primitive_unique_keys: array<u32>;
@group(0) @binding(9) var<uniform> params: SparseGridViewParams;
@group(0) @binding(10) var<storage, read> source_identity_evidence: array<u32>;

const INVALID_INDEX: u32 = 0xffffffffu;
const STATUS_READY: u32 = ${SCHROEDER_SPARSE_GRID_VIEW_STATUS_READY}u;
const STATUS_ADMITTED: u32 = ${SCHROEDER_SPARSE_GRID_VIEW_STATUS_ADMITTED}u;
const STATUS_FAIL_CLOSED: u32 = ${SCHROEDER_SPARSE_GRID_VIEW_STATUS_FAIL_CLOSED}u;
const OVERFLOW_GRID_ARENA: u32 = ${SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_NODE_ARENA}u;
const OVERFLOW_HASH_PROBE: u32 = ${SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_HASH_PROBE}u;
const OVERFLOW_BUILD_DISPATCH: u32 = ${SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_DISPATCH}u;
const OVERFLOW_SOURCE_IDENTITY: u32 = ${SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_SOURCE_IDENTITY}u;
const OVERFLOW_PRIMITIVE: u32 = ${SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_PRIMITIVE}u;
const OVERFLOW_UNSUPPORTED_SOURCE: u32 = ${SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_UNSUPPORTED_SOURCE}u;

fn linear_group(group_id: vec3<u32>, dispatch_x: u32) -> u32 {
  return group_id.x + group_id.y * dispatch_x;
}

fn hash_grid_index(value: u32) -> u32 {
  var hash = value;
  hash = hash ^ (hash >> 16u);
  hash = hash * 0x7feb352du;
  hash = hash ^ (hash >> 15u);
  hash = hash * 0x846ca68bu;
  return hash ^ (hash >> 16u);
}

fn hierarchy_admitted() -> bool {
  return arrayLength(&hierarchy_evidence) >= 16u
    && hierarchy_evidence[0] == params.hierarchy_generation_id
    && hierarchy_evidence[6] == 1u
    && hierarchy_evidence[7] == 0u;
}

fn resident_count_metadata_valid() -> bool {
  if (params.resident_particle_count == 0u) {
    return true;
  }
  return arrayLength(&particle_count_metadata) >= 16u
    && particle_count_metadata[0] == 0x53535052u
    && particle_count_metadata[1] == 1u
    && particle_count_metadata[2] == 1u
    && particle_count_metadata[3] == 2u
    && particle_count_metadata[6] == params.particle_capacity
    && particle_count_metadata[9] == 0u
    && particle_count_metadata[4] <= params.particle_capacity;
}

fn current_particle_count() -> u32 {
  if (params.resident_particle_count != 0u) {
    if (!resident_count_metadata_valid()) {
      return 0u;
    }
    return particle_count_metadata[4];
  }
  return params.particle_capacity;
}

fn source_identity_valid(
  generation: u32,
  position_epoch: u32,
  lease_token_low: u32,
  lease_token_high: u32,
  source_count: u32,
  consumer_bit: u32
) -> bool {
  return arrayLength(&source_identity_evidence) >= 40u
    && source_identity_evidence[0] == 0u
    && source_identity_evidence[1] == generation
    && source_identity_evidence[2] == lease_token_low
    && source_identity_evidence[3] == lease_token_high
    && source_identity_evidence[4] == position_epoch
    && source_identity_evidence[5] == source_count
    && source_identity_evidence[21] >= 2u
    && consumer_bit != 0u
    && (source_identity_evidence[22] & consumer_bit) == consumer_bit
    && source_identity_evidence[31] == 1u
    && source_identity_evidence[33] == 0u;
}

fn product_event_metadata_valid() -> bool {
  if (params.product_event_enabled == 0u) {
    return true;
  }
  if (arrayLength(&particle_count_metadata) < 16u) {
    return false;
  }
  let occupied_count = particle_count_metadata[2];
  let active_count = particle_count_metadata[3];
  let append_admitted = particle_count_metadata[15];
  let empty_uninitialized = occupied_count == 0u
    && active_count == 0u
    && append_admitted == 0u;
  return particle_count_metadata[0] == 0x554c4750u
    && particle_count_metadata[1] == 1u
    && occupied_count == active_count
    && active_count <= params.product_event_capacity
    && particle_count_metadata[4] == params.product_event_capacity
    && particle_count_metadata[6] == 0u
    && particle_count_metadata[7] == params.product_event_generation_id
    && particle_count_metadata[8] == params.product_event_stride_vec4 * 4u
    && (append_admitted == 1u || empty_uninitialized)
    && source_identity_valid(
      params.product_event_identity_generation,
      params.product_event_position_epoch,
      params.product_event_lease_token_low,
      params.product_event_lease_token_high,
      params.product_event_source_count,
      params.product_event_consumer_bit
    );
}

fn pressure_force_metadata_valid() -> bool {
  if (params.pressure_force_enabled == 0u) {
    return true;
  }
  return arrayLength(&particle_count_metadata) >= 4u
    && particle_count_metadata[0] <= params.pressure_force_capacity
    && particle_count_metadata[1] == 0u
    && particle_count_metadata[2] == params.pressure_force_capacity
    && source_identity_valid(
      params.pressure_force_identity_generation,
      params.pressure_force_position_epoch,
      params.pressure_force_lease_token_low,
      params.pressure_force_lease_token_high,
      params.pressure_force_source_count,
      params.pressure_force_consumer_bit
    );
}

fn quadratic_weights(value: f32) -> vec3<f32> {
  let a = 1.5 - value;
  let b = value - 1.0;
  let c = value - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}

fn weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  if (offset == 0) { return weights.x; }
  if (offset == 1) { return weights.y; }
  return weights.z;
}

fn insert_actual_node(full_index: u32) {
  let hash_capacity = params.physical_hash_capacity;
  if (hash_capacity == 0u) {
    atomicOr(&sparse_view[4], OVERFLOW_GRID_ARENA);
    return;
  }
  let slot_mask = hash_capacity - 1u;
  let start_slot = hash_grid_index(full_index) & slot_mask;
  for (var probe = 0u; probe < params.hash_max_probes; probe = probe + 1u) {
    let slot = (start_slot + probe) & slot_mask;
    let key_word = params.hash_key_word_offset + slot;
    for (var retry = 0u; retry < 8u; retry = retry + 1u) {
      let claim = atomicCompareExchangeWeak(
        &sparse_view[key_word],
        INVALID_INDEX,
        full_index
      );
      if (claim.exchanged) {
        let candidate_index = atomicAdd(&sparse_view[2], 1u);
        if (candidate_index >= params.grid_node_capacity) {
          atomicOr(&sparse_view[4], OVERFLOW_GRID_ARENA);
          return;
        }
        atomicStore(&candidate_keys[candidate_index], full_index);
        return;
      }
      if (claim.old_value == full_index) {
        return;
      }
      if (claim.old_value != INVALID_INDEX) {
        break;
      }
    }
  }
  atomicOr(&sparse_view[4], OVERFLOW_HASH_PROBE);
}

fn emit_position_stencil(position_m: vec3<f32>, grid_spacing: f32) {
  let source_grid = position_m / max(grid_spacing, 1.0e-12);
  let base_x = i32(floor(source_grid.x - 0.5));
  let base_y = i32(floor(source_grid.y - 0.5));
  let base_z = i32(floor(source_grid.z - 0.5));
  let wx = quadratic_weights(source_grid.x - f32(base_x));
  let wy = quadratic_weights(source_grid.y - f32(base_y));
  let wz = quadratic_weights(source_grid.z - f32(base_z));
  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let weight = weight_at(wx, ox) * weight_at(wy, oy) * weight_at(wz, oz);
        if (weight == 0.0) {
          continue;
        }
        let storage_x = base_x + ox + i32(params.grid_shift);
        let storage_y = base_y + oy + i32(params.grid_shift);
        let storage_z = base_z + oz + i32(params.grid_shift);
        if (storage_x < 0 || storage_y < 0 || storage_z < 0
          || storage_x >= i32(params.grid_nx)
          || storage_y >= i32(params.grid_ny)
          || storage_z >= i32(params.grid_nz)) {
          continue;
        }
        let full_index = (u32(storage_x) * params.grid_ny + u32(storage_y))
          * params.grid_nz + u32(storage_z);
        insert_actual_node(full_index);
      }
    }
  }
}

@compute @workgroup_size(1)
fn initialize_view() {
  atomicStore(&sparse_view[0], params.generation_id);
  atomicStore(&sparse_view[1], 0u);
  atomicStore(&sparse_view[2], 0u);
  atomicStore(&sparse_view[3], 0u);
  atomicStore(&sparse_view[4], 0u);
  atomicStore(&sparse_view[5], params.full_grid_node_count);
  atomicStore(&sparse_view[6], params.grid_node_capacity);
  atomicStore(&sparse_view[7], bitcast<u32>(params.selected_level));
  atomicStore(&sparse_view[8], bitcast<u32>(params.chart_id));
  atomicStore(&sparse_view[9], params.stencil_width);
  atomicStore(&sparse_view[10], params.hash_key_word_offset);
  atomicStore(&sparse_view[11], params.hash_value_word_offset);
  atomicStore(&sparse_view[12], params.reverse_mapping_word_offset);
  atomicStore(&sparse_view[13], params.physical_hash_capacity);
  atomicStore(&sparse_view[14], STATUS_READY);
  atomicStore(&sparse_view[15], 0u);
  grid_dispatch[0] = 0u;
  grid_dispatch[1] = 1u;
  grid_dispatch[2] = 1u;
  grid_dispatch[3] = 0u;
  grid_dispatch[4] = 1u;
  grid_dispatch[5] = 1u;
  grid_dispatch[6] = 0u;
  grid_dispatch[7] = 1u;
  grid_dispatch[8] = 1u;
}

@compute @workgroup_size(64)
fn initialize_hash_slots(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let init_count = max(params.physical_hash_capacity, params.grid_node_capacity);
  let group_count = (init_count + 63u) / 64u;
  let dispatch_x = min(group_count, params.max_dispatch_dimension);
  let index = linear_group(group_id, dispatch_x) * 64u + local_id.x;
  if (index < params.physical_hash_capacity) {
    atomicStore(&sparse_view[params.hash_key_word_offset + index], INVALID_INDEX);
    atomicStore(&sparse_view[params.hash_value_word_offset + index], INVALID_INDEX);
  }
  if (index < params.grid_node_capacity) {
    atomicStore(&candidate_keys[index], INVALID_INDEX);
    atomicStore(&sparse_view[params.reverse_mapping_word_offset + index], INVALID_INDEX);
  }
}

@compute @workgroup_size(1)
fn validate_source() {
  if (!hierarchy_admitted() || params.source_identity_mismatch != 0u) {
    atomicOr(&sparse_view[4], OVERFLOW_SOURCE_IDENTITY);
  }
  if (!resident_count_metadata_valid()) {
    atomicOr(&sparse_view[4], OVERFLOW_SOURCE_IDENTITY);
  }
  if (params.unsupported_source_mask != 0u) {
    atomicOr(&sparse_view[4], OVERFLOW_UNSUPPORTED_SOURCE);
  }
  if (arrayLength(&hierarchy_evidence) >= 6u) {
    atomicStore(&sparse_view[15], hierarchy_evidence[5]);
  }
}

@compute @workgroup_size(1)
fn validate_product_event_source() {
  if (!product_event_metadata_valid()) {
    atomicOr(&sparse_view[4], OVERFLOW_SOURCE_IDENTITY);
  }
}

@compute @workgroup_size(1)
fn validate_pressure_force_source() {
  if (!pressure_force_metadata_valid()) {
    atomicOr(&sparse_view[4], OVERFLOW_SOURCE_IDENTITY);
  }
}

// One invocation reads the current authoritative particle position and emits
// only nodes actually touched by the production quadratic P2G stencil.
@compute @workgroup_size(64)
fn build_view(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (atomicLoad(&sparse_view[4]) != 0u || particle_index >= current_particle_count()) {
    return;
  }
  let state_base = particle_index * params.state_stride_vec4;
  let position_mass = particle_state[state_base];
  if (!(position_mass.w > 0.0)) {
    return;
  }
  let assignment_base = particle_index * params.assignment_stride_floats;
  if (i32(round(level_assignments[assignment_base])) != params.selected_level) {
    return;
  }
  let assignment_grid_spacing = max(level_assignments[assignment_base + 1u], 1.0e-12);
  let grid_spacing = select(
    assignment_grid_spacing,
    params.grid_spacing_m,
    params.grid_spacing_m > 0.0
  );
  emit_position_stencil(position_mass.xyz, grid_spacing);
}

@compute @workgroup_size(64)
fn build_product_event_view(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event_index = global_id.x;
  if (atomicLoad(&sparse_view[4]) != 0u
    || event_index >= particle_count_metadata[3]) {
    return;
  }
  let base = event_index * params.product_event_stride_vec4;
  let event0 = particle_state[base];
  let event3 = particle_state[base + 3u];
  let event4 = particle_state[base + 4u];
  if (event4.z != 1.0 || !(event3.y > 0.0)) {
    return;
  }
  emit_position_stencil(event0.xyz, params.grid_spacing_m);
}

@compute @workgroup_size(64)
fn build_pressure_force_view(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let force_row_index = global_id.x;
  if (atomicLoad(&sparse_view[4]) != 0u
    || force_row_index >= particle_count_metadata[0]) {
    return;
  }
  let base = force_row_index * params.pressure_force_stride_vec4;
  let force_row1 = particle_state[base + 1u];
  let force_row3 = particle_state[base + 3u];
  if (!(force_row3.w > 0.0)) {
    return;
  }
  emit_position_stencil(force_row1.xyz, params.grid_spacing_m);
}

@compute @workgroup_size(1)
fn prepare_build_dispatch() {
  let requested = atomicLoad(&sparse_view[2]);
  let expected_primitive_count = requested
    + select(1u, 0u, requested == params.grid_node_capacity);
  var primitive_valid = primitive_evidence[1] == params.grid_node_capacity
    && primitive_evidence[3] == 1u
    && primitive_evidence[4] == 0u
    && primitive_evidence[5] == 1u
    && primitive_evidence[6] == 1u
    && primitive_evidence[2] == expected_primitive_count;
  if (requested < params.grid_node_capacity) {
    primitive_valid = primitive_valid && primitive_unique_keys[requested] == INVALID_INDEX;
  }
  if (!primitive_valid) {
    atomicOr(&sparse_view[4], OVERFLOW_PRIMITIVE);
    return;
  }
  if (requested == 0u || requested > params.grid_node_capacity
    || atomicLoad(&sparse_view[4]) != 0u) {
    return;
  }
  let group_count = (requested + 63u) / 64u;
  let dispatch_x = min(group_count, params.max_dispatch_dimension);
  let dispatch_y = (group_count + dispatch_x - 1u) / dispatch_x;
  if (dispatch_y > params.max_dispatch_dimension) {
    atomicOr(&sparse_view[4], OVERFLOW_BUILD_DISPATCH);
    return;
  }
  grid_dispatch[6] = dispatch_x;
  grid_dispatch[7] = dispatch_y;
  grid_dispatch[8] = 1u;
}

@compute @workgroup_size(64)
fn materialize_sorted_nodes(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let requested = atomicLoad(&sparse_view[2]);
  let group_count = (requested + 63u) / 64u;
  let dispatch_x = max(min(group_count, params.max_dispatch_dimension), 1u);
  let node_index = linear_group(group_id, dispatch_x) * 64u + local_id.x;
  if (atomicLoad(&sparse_view[4]) != 0u || node_index >= requested) {
    return;
  }
  let full_index = primitive_unique_keys[node_index];
  if (full_index == INVALID_INDEX || full_index >= params.full_grid_node_count) {
    atomicOr(&sparse_view[4], OVERFLOW_PRIMITIVE);
    return;
  }
  atomicStore(&sparse_view[params.reverse_mapping_word_offset + node_index], full_index);
  let slot_mask = params.physical_hash_capacity - 1u;
  let start_slot = hash_grid_index(full_index) & slot_mask;
  for (var probe = 0u; probe < params.hash_max_probes; probe = probe + 1u) {
    let slot = (start_slot + probe) & slot_mask;
    let key = atomicLoad(&sparse_view[params.hash_key_word_offset + slot]);
    if (key == full_index) {
      atomicStore(&sparse_view[params.hash_value_word_offset + slot], node_index);
      return;
    }
    if (key == INVALID_INDEX) {
      break;
    }
  }
  atomicOr(&sparse_view[4], OVERFLOW_HASH_PROBE);
}

@compute @workgroup_size(1)
fn finalize_view() {
  let requested = atomicLoad(&sparse_view[2]);
  let overflow = atomicLoad(&sparse_view[4]);
  let admitted = hierarchy_admitted() && overflow == 0u
    && requested > 0u && requested <= params.grid_node_capacity;
  let count = select(0u, requested, admitted);
  atomicStore(&sparse_view[1], count);
  atomicStore(&sparse_view[3], select(0u, 1u, admitted));
  atomicStore(&sparse_view[14], STATUS_READY
    | select(STATUS_FAIL_CLOSED, STATUS_ADMITTED, admitted));
  if (!admitted) {
    grid_dispatch[0] = 0u;
    grid_dispatch[1] = 1u;
    grid_dispatch[2] = 1u;
    return;
  }
  let group_count = (count + 63u) / 64u;
  let dispatch_x = min(group_count, params.max_dispatch_dimension);
  let dispatch_y = (group_count + dispatch_x - 1u) / dispatch_x;
  if (dispatch_y > params.max_dispatch_dimension) {
    atomicOr(&sparse_view[4], OVERFLOW_BUILD_DISPATCH);
    atomicStore(&sparse_view[1], 0u);
    atomicStore(&sparse_view[3], 0u);
    atomicStore(&sparse_view[14], STATUS_READY | STATUS_FAIL_CLOSED);
    grid_dispatch[0] = 0u;
    grid_dispatch[1] = 1u;
    grid_dispatch[2] = 1u;
    return;
  }
  grid_dispatch[0] = dispatch_x;
  grid_dispatch[1] = dispatch_y;
  grid_dispatch[2] = 1u;
}
`;
