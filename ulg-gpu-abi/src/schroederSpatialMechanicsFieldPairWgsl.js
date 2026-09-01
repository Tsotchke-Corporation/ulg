import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION
} from './schroederSpatialMechanicsFieldView.js';

/**
 * Directory-v2 paired mechanics-field construction.
 *
 * The two child dictionaries keep the public field-v5 ABI. Their private
 * construction keys share one stable u32x3 radix by assigning the fine and
 * coarse node domains adjacent, non-overlapping ranges. A retained packed
 * dual-predicate exclusive scan splits the shared stable order back into the
 * two legacy candidate-index domains expected by existing P2G consumers
 * without serial candidate traversal or a host count read.
 */
export const schroederSpatialMechanicsFieldPairWgsl = /* wgsl */ `
struct MechanicsFieldPairParams {
  source_count: u32,
  source_capacity: u32,
  source_stride_floats: u32,
  source_row_layout_id: u32,
  identity_stride_words: u32,
  completion_ordinal: u32,
  generation_id: u32,
  device_ordinal: u32,
  lane_ordinal: u32,
  lease_token: u32,
  source_family_id: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
  workgroup_size: u32,
  stencil_size: u32,
  dispatch_x_limit: u32,
  fine_selected_level: i32,
  coarse_selected_level: i32,

  fine_grid_node_count: u32,
  fine_grid_nx: u32,
  fine_grid_ny: u32,
  fine_grid_nz: u32,
  fine_grid_shift: u32,
  fine_grid_spacing_m: f32,
  fine_inv_grid_spacing_m: f32,
  fine_field_capacity: u32,
  fine_descriptor_offset_words: u32,
  fine_descriptor_words: u32,
  fine_key_offset_words: u32,
  fine_key_words: u32,
  fine_accumulator_offset_words: u32,
  fine_accumulator_words: u32,
  fine_state_offset_words: u32,
  fine_state_words: u32,
  fine_capacity_words: u32,
  fine_parent_capacity_words: u32,
  fine_parent_node_capacity: u32,

  coarse_grid_node_count: u32,
  coarse_grid_nx: u32,
  coarse_grid_ny: u32,
  coarse_grid_nz: u32,
  coarse_grid_shift: u32,
  coarse_grid_spacing_m: f32,
  coarse_inv_grid_spacing_m: f32,
  coarse_field_capacity: u32,
  coarse_descriptor_offset_words: u32,
  coarse_descriptor_words: u32,
  coarse_key_offset_words: u32,
  coarse_key_words: u32,
  coarse_accumulator_offset_words: u32,
  coarse_accumulator_words: u32,
  coarse_state_offset_words: u32,
  coarse_state_words: u32,
  coarse_capacity_words: u32,
  coarse_parent_capacity_words: u32,
  coarse_parent_node_capacity: u32,

  pair_candidate_capacity: u32,
  combined_node_span: u32,
};

@group(0) @binding(0) var<storage, read> source_rows: array<f32>;
@group(0) @binding(1) var<storage, read> particle_identity: array<u32>;
@group(0) @binding(2) var<storage, read_write> candidate_keys: array<u32>;
@group(0) @binding(3) var<storage, read_write> fine_field: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> coarse_field: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read> unique_keys: array<u32>;
@group(0) @binding(6) var<storage, read> unique_evidence: array<u32>;
@group(0) @binding(7) var<storage, read> fine_parent: array<u32>;
@group(0) @binding(8) var<storage, read> coarse_parent: array<u32>;
@group(0) @binding(9) var<uniform> params: MechanicsFieldPairParams;
@group(0) @binding(10) var<storage, read> sorted_candidate_indices: array<u32>;
@group(0) @binding(11) var<storage, read> unique_group_by_sorted_position: array<u32>;
@group(0) @binding(12) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(13) var<storage, read> active_source_view: array<u32>;
@group(0) @binding(14) var<storage, read_write> pair_control: array<atomic<u32>>;
@group(0) @binding(15) var<storage, read_write> fine_stable_order: array<u32>;
@group(0) @binding(16) var<storage, read_write> coarse_stable_order: array<u32>;
@group(0) @binding(17) var<storage, read_write> pair_tail_scan: array<vec2<u32>>;
@group(0) @binding(18) var<storage, read_write> pair_projection_dispatch: array<u32>;
@group(0) @binding(19) var<storage, read> predecessor_fine_field: array<u32>;
@group(0) @binding(20) var<storage, read> predecessor_coarse_field: array<u32>;
@group(0) @binding(21) var<storage, read> predecessor_active_source_view: array<u32>;

const FIELD_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC}u;
const FIELD_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION}u;
const FIELD_STATUS_READY: u32 = 1u;
const FIELD_STATUS_ADMITTED: u32 = 2u;
const FIELD_STATUS_FAIL_CLOSED: u32 = 4u;
const FIELD_STATUS_INVALID_SOURCE: u32 = 8u;
const FIELD_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const FIELD_DESCRIPTOR_WORDS: u32 = 32u;
const FIELD_KEY_WORDS: u32 = 4u;
const FIELD_RADIX_KEY_WORDS: u32 = 3u;
const FIELD_RADIX_MATERIAL_MASK: u32 = 0x00ffffffu;
const FIELD_ACCUMULATOR_WORDS: u32 = 8u;
const FIELD_RECEIPT_WORDS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS}u;
const FIELD_STATE_WORDS: u32 = 8u;
const FIELD_PRESSURE_WORDS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS}u;
const FIELD_DISPATCH_OFFSET_WORDS: u32 = 60u;
const FIELD_INVALID_KEY: u32 = 0xffffffffu;
const FIELD_UNIQUE_STATUS_READY: u32 = 1u;
const SOURCE_LAYOUT_LEVEL_ASSIGNMENT: u32 = 1u;
const PARENT_MAGIC: u32 = 0x534d5631u;
const PARENT_VERSION: u32 = 1u;
const PARENT_READY_ADMITTED: u32 = 3u;

const ACTIVE_SOURCE_MAGIC: u32 = 0x53535631u;
const ACTIVE_SOURCE_VERSION: u32 = 1u;
const ACTIVE_SOURCE_READY_ADMITTED: u32 = 3u;
const ACTIVE_SOURCE_REJECTED_MASK: u32 = 252u;
const ACTIVE_SOURCE_HEADER_WORDS: u32 = 64u;
const ACTIVE_SOURCE_MISSING: u32 = 0xffffffffu;
const ACTIVE_SOURCE_COUNT_WORD: u32 = 18u;
const ACTIVE_SOURCE_CANDIDATE_COUNT_WORD: u32 = 43u;
const ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD: u32 = 48u;
const ACTIVE_SOURCE_PHYSICAL_DISPATCH_WORD: u32 = 54u;
const ACTIVE_SOURCE_COMPLETION_WORD: u32 = 30u;
const ACTIVE_SOURCE_SEAL_WORD: u32 = 47u;

const SPATIAL_MAGIC: u32 = 0x53534531u;
const SPATIAL_VERSION_V2: u32 = 2u;
const SPATIAL_READY_ADMITTED: u32 = 3u;
const SPATIAL_REJECTED_MASK: u32 = 28u;
const SPATIAL_PRIMITIVE_READY: u32 = 1u;
const SPATIAL_PRIMITIVE_FAIL_CLOSED: u32 = 4u;
const SPATIAL_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;

const PAIR_STATUS_READY: u32 = 1u;
const PAIR_STATUS_ADMITTED: u32 = 2u;
const PAIR_STATUS_FAIL_CLOSED: u32 = 4u;
const PAIR_CONTROL_COUNT: u32 = 0u;
const PAIR_CONTROL_SEAL: u32 = 1u;
const PAIR_CONTROL_FINE_COUNT: u32 = 2u;
const PAIR_CONTROL_COARSE_COUNT: u32 = 3u;
const PAIR_CONTROL_STATUS: u32 = 4u;
const PAIR_CONTROL_ACTIVE_COUNT: u32 = 5u;
const PAIR_CONTROL_VALID_UNIQUE_COUNT: u32 = 6u;
const PAIR_CONTROL_SENTINEL_PRESENT: u32 = 7u;
const PAIR_CONTROL_DISPATCH_X: u32 = 8u;
const PAIR_CONTROL_DISPATCH_Y: u32 = 9u;
const PAIR_CONTROL_DISPATCH_Z: u32 = 10u;
const PAIR_CONTROL_BUILD_SEAL: u32 = 11u;
const PAIR_CONTROL_INVALID_KEY_COUNT: u32 = 12u;
const PAIR_CONTROL_FINE_SENTINEL_PRESENT: u32 = 13u;
const PAIR_CONTROL_COARSE_SENTINEL_PRESENT: u32 = 14u;
const PAIR_CONTROL_SCAN_LEVEL_COUNT: u32 = 15u;
const PAIR_CONTROL_FINE_VALID_CANDIDATE_COUNT: u32 = 16u;
const PAIR_CONTROL_COARSE_VALID_CANDIDATE_COUNT: u32 = 17u;
const PAIR_CONTROL_VALID_CANDIDATE_COUNT: u32 = 18u;
const PAIR_SCAN_DISPATCH_STRIDE: u32 = 6u;
const PAIR_SCAN_ELEMENTS_PER_WORKGROUP: u32 = 512u;
const PAIR_SCAN_MAX_LEVELS: u32 = 4u;

var<workgroup> pair_scan_values: array<vec2<u32>, 512>;
var<workgroup> pair_scan_live_level_count: u32;

fn pair_load(word: u32) -> u32 {
  return atomicLoad(&pair_control[word]);
}

fn pair_store(word: u32, value: u32) {
  atomicStore(&pair_control[word], value);
}

fn fine_load(word: u32) -> u32 {
  return atomicLoad(&fine_field[word]);
}

fn fine_store(word: u32, value: u32) {
  atomicStore(&fine_field[word], value);
}

fn coarse_load(word: u32) -> u32 {
  return atomicLoad(&coarse_field[word]);
}

fn coarse_store(word: u32, value: u32) {
  atomicStore(&coarse_field[word], value);
}

fn pair_finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn pair_integral_f32(value: f32) -> bool {
  return pair_finite_f32(value) && value == trunc(value);
}

fn pair_range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn pair_group_count(invocation_count: u32) -> u32 {
  return invocation_count / 64u
    + select(0u, 1u, invocation_count % 64u != 0u);
}

fn pair_ceil_groups(invocation_count: u32, width: u32) -> u32 {
  return invocation_count / width
    + select(0u, 1u, invocation_count % width != 0u);
}

fn pair_dispatch_x(group_count: u32) -> u32 {
  return min(group_count, max(params.dispatch_x_limit, 1u));
}

fn pair_dispatch_y(group_count: u32, dispatch_x: u32) -> u32 {
  let width = max(dispatch_x, 1u);
  return group_count / width
    + select(0u, 1u, group_count % width != 0u);
}

fn pair_linear_invocation(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>,
  dispatch_x: u32
) -> u32 {
  let linear_group = workgroup_id.x + workgroup_id.y * dispatch_x;
  return linear_group * 64u + local_id.x;
}

fn pair_scan_level_count(level: u32, live: bool) -> u32 {
  var count = select(params.pair_candidate_capacity, pair_load(PAIR_CONTROL_COUNT), live);
  for (var current = 0u; current < level; current = current + 1u) {
    count = pair_ceil_groups(count, PAIR_SCAN_ELEMENTS_PER_WORKGROUP);
  }
  return count;
}

fn pair_scan_level_offset(level: u32) -> u32 {
  var offset = 0u;
  var count = params.pair_candidate_capacity;
  for (var current = 0u; current < level; current = current + 1u) {
    offset = offset + count;
    count = pair_ceil_groups(count, PAIR_SCAN_ELEMENTS_PER_WORKGROUP);
  }
  return offset;
}

fn pair_scan_dispatch_word(level: u32, add_offsets: bool) -> u32 {
  return level * PAIR_SCAN_DISPATCH_STRIDE
    + select(0u, 3u, add_offsets);
}

fn pair_scan_linear_group(workgroup_id: vec3<u32>, dispatch_x: u32) -> u32 {
  return workgroup_id.x + workgroup_id.y * dispatch_x;
}

fn pair_signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn pair_active_source_view_admitted() -> bool {
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < ACTIVE_SOURCE_HEADER_WORDS) {
    return false;
  }
  let status = active_source_view[2u];
  let physical_count = active_source_view[16u];
  let physical_capacity = active_source_view[17u];
  let active_count = active_source_view[ACTIVE_SOURCE_COUNT_WORD];
  let active_capacity = active_source_view[19u];
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let capacity_words = active_source_view[27u];
  return active_source_view[0u] == ACTIVE_SOURCE_MAGIC
    && active_source_view[1u] == ACTIVE_SOURCE_VERSION
    && (status & ACTIVE_SOURCE_READY_ADMITTED) == ACTIVE_SOURCE_READY_ADMITTED
    && (status & ACTIVE_SOURCE_REJECTED_MASK) == 0u
    && active_source_view[3u] == params.generation_id
    && active_source_view[4u] == params.device_ordinal
    && active_source_view[5u] == params.lane_ordinal
    && active_source_view[6u] == params.lease_token
    && active_source_view[7u] == params.source_family_id
    && active_source_view[8u] == params.storage_generation
    && active_source_view[9u] == params.physics_tick
    && active_source_view[10u] == params.physics_substep
    && active_source_view[11u] == params.position_epoch
    && active_source_view[12u] == params.topology_epoch
    && active_source_view[13u] == params.chart_epoch
    && active_source_view[14u] == params.level_epoch
    && active_source_view[15u] == params.support_epoch
    && physical_count == params.source_count
    && physical_capacity == params.source_capacity
    && active_count <= active_capacity
    && active_capacity <= physical_capacity
    && active_capacity <= 0xffffffffu / 27u
    && active_source_view[20u] == physical_count - active_count
    && active_source_view[21u] == 0u
    && active_source_view[22u] == 0u
    && active_source_view[23u] == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && active_source_view[24u] == params.source_stride_floats
    && active_to_physical == ACTIVE_SOURCE_HEADER_WORDS
    && physical_to_active == active_to_physical + active_capacity
    && capacity_words == physical_to_active + physical_capacity
    && capacity_words <= bound_words
    && active_source_view[29u] == params.completion_ordinal
    && active_source_view[ACTIVE_SOURCE_COMPLETION_WORD]
      == params.completion_ordinal
    && active_source_view[32u] == physical_count
    && active_source_view[33u] == active_count
    && active_source_view[34u] == active_count
    && active_source_view[35u] == active_count
    && active_source_view[36u] <= physical_count
    && active_source_view[37u] == params.workgroup_size
    && active_source_view[38u] == params.dispatch_x_limit
    && active_source_view[40u] == ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD
    && active_source_view[41u] == 51u
    && active_source_view[ACTIVE_SOURCE_CANDIDATE_COUNT_WORD]
      == active_count * 27u
    && active_source_view[44u] == active_capacity * 27u
    && params.pair_candidate_capacity == active_capacity * 27u
    && active_source_view[ACTIVE_SOURCE_SEAL_WORD] != 0u;
}

fn pair_active_source_count() -> u32 {
  return select(
    0u,
    active_source_view[ACTIVE_SOURCE_COUNT_WORD],
    pair_active_source_view_admitted()
  );
}

fn pair_physical_source_for_active(active_ordinal: u32) -> u32 {
  let active_count = pair_active_source_count();
  if (active_ordinal >= active_count) {
    return ACTIVE_SOURCE_MISSING;
  }
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let physical_source = active_source_view[active_to_physical + active_ordinal];
  if (
    physical_source >= params.source_count
    || active_source_view[physical_to_active + physical_source]
      != active_ordinal
  ) {
    return ACTIVE_SOURCE_MISSING;
  }
  return physical_source;
}

fn pair_spatial_directory_admitted() -> bool {
  let bound_words = arrayLength(&spatial_directory);
  if (bound_words < 48u || !pair_active_source_view_admitted()) {
    return false;
  }
  let status = spatial_directory[2u];
  let physical_count = spatial_directory[16u];
  let physical_capacity = spatial_directory[17u];
  let cell_count = spatial_directory[18u];
  let cell_capacity = spatial_directory[19u];
  let directory_capacity = spatial_directory[22u];
  let active_count = spatial_directory[37u];
  let cell_keys = spatial_directory[29u];
  let cell_offsets = spatial_directory[30u];
  let cell_members = spatial_directory[31u];
  let physical_reverse = spatial_directory[32u];
  let physical_upper = spatial_directory[47u];
  let build_ordinal = spatial_directory[33u];
  let primitive_status = spatial_directory[41u];
  let consumer_group_count = pair_group_count(cell_count);
  let consumer_x = spatial_directory[42u];
  let consumer_y = spatial_directory[43u];
  let consumer_z = spatial_directory[44u];
  let consumer_admitted = select(
    consumer_x > 0u
      && consumer_x <= consumer_group_count
      && consumer_y == pair_dispatch_y(consumer_group_count, consumer_x)
      && consumer_z == 1u,
    consumer_x == 0u && consumer_y == 0u && consumer_z == 0u,
    cell_count == 0u
  );
  return spatial_directory[0u] == SPATIAL_MAGIC
    && spatial_directory[1u] == SPATIAL_VERSION_V2
    && (status & SPATIAL_READY_ADMITTED) == SPATIAL_READY_ADMITTED
    && (status & SPATIAL_REJECTED_MASK) == 0u
    && spatial_directory[3u] == params.generation_id
    && spatial_directory[4u] == params.device_ordinal
    && spatial_directory[5u] == params.lane_ordinal
    && spatial_directory[6u] == params.lease_token
    && spatial_directory[7u] == params.source_family_id
    && spatial_directory[8u] == params.storage_generation
    && spatial_directory[9u] == params.physics_tick
    && spatial_directory[10u] == params.physics_substep
    && spatial_directory[11u] == params.position_epoch
    && spatial_directory[12u] == params.topology_epoch
    && spatial_directory[13u] == params.chart_epoch
    && spatial_directory[14u] == params.level_epoch
    && spatial_directory[15u] == params.support_epoch
    && physical_count == params.source_count
    && physical_capacity == params.source_capacity
    && active_count == pair_active_source_count()
    && active_count <= physical_count
    && cell_count <= active_count
    && (active_count == 0u || cell_count > 0u)
    && cell_count <= cell_capacity
    && cell_capacity <= active_source_view[19u]
    && spatial_directory[20u] == spatial_directory[21u]
    && directory_capacity <= bound_words
    && physical_upper <= directory_capacity
    && spatial_directory[23u] == 0u
    && spatial_directory[24u] == 0u
    && spatial_directory[25u] == 5u
    && spatial_directory[26u] == 5u
    && spatial_directory[27u] == SPATIAL_SORT_LEXICOGRAPHIC_U32X5
    && spatial_directory[28u] == 48u
    && cell_keys == 48u
    && cell_offsets == cell_keys + cell_capacity * 5u
    && cell_members == cell_offsets + cell_capacity + 1u
    && physical_reverse == cell_members + physical_capacity
    && build_ordinal == params.completion_ordinal
    && spatial_directory[34u] == build_ordinal
    && spatial_directory[35u] == build_ordinal
    && spatial_directory[36u] == params.generation_id
    && spatial_directory[38u] == cell_count
    && spatial_directory[39u] != 0u
    && spatial_directory[40u] == 0u
    && (primitive_status & SPATIAL_PRIMITIVE_READY) != 0u
    && (primitive_status & SPATIAL_PRIMITIVE_FAIL_CLOSED) == 0u
    && consumer_admitted
    && spatial_directory[46u] == 2u
    && pair_range_within(cell_keys, cell_count * 5u, physical_upper)
    && pair_range_within(cell_offsets, cell_count + 1u, physical_upper)
    && pair_range_within(cell_members, active_count, physical_upper)
    && pair_range_within(physical_reverse, physical_capacity, physical_upper)
    && spatial_directory[cell_offsets] == 0u
    && spatial_directory[cell_offsets + cell_count] == active_count;
}

fn pair_spatial_membership_admitted(physical_source: u32) -> bool {
  if (
    physical_source >= params.source_count
    || !pair_spatial_directory_admitted()
  ) {
    return false;
  }
  let cell_count = spatial_directory[18u];
  let cell_offsets = spatial_directory[30u];
  let reverse = spatial_directory[32u];
  let active_count = spatial_directory[37u];
  let cell_plus_one = spatial_directory[reverse + physical_source];
  if (cell_plus_one == 0u) {
    return false;
  }
  let cell_index = cell_plus_one - 1u;
  if (cell_index >= cell_count) {
    return false;
  }
  let begin = spatial_directory[cell_offsets + cell_index];
  let end = spatial_directory[cell_offsets + cell_index + 1u];
  if (begin >= end || end > active_count) {
    return false;
  }
  let row = physical_source * params.source_stride_floats;
  let spacing = source_rows[row + 1u];
  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let cell_f = floor(position / spacing);
  if (
    !pair_integral_f32(source_rows[row])
    || !pair_integral_f32(source_rows[row + 15u])
    || !pair_finite_f32(spacing)
    || !(spacing > 0.0)
    || !all(vec3<bool>(
      pair_finite_f32(cell_f.x),
      pair_finite_f32(cell_f.y),
      pair_finite_f32(cell_f.z)
    ))
    || !all(vec3<bool>(
      cell_f.x >= -2147483520.0 && cell_f.x <= 2147483520.0,
      cell_f.y >= -2147483520.0 && cell_f.y <= 2147483520.0,
      cell_f.z >= -2147483520.0 && cell_f.z <= 2147483520.0
    ))
  ) {
    return false;
  }
  let key = spatial_directory[29u] + cell_index * 5u;
  return spatial_directory[key] == u32(round(source_rows[row + 15u]))
    && spatial_directory[key + 1u]
      == pair_signed_order_key(i32(round(source_rows[row])))
    && spatial_directory[key + 2u]
      == pair_signed_order_key(i32(cell_f.x))
    && spatial_directory[key + 3u]
      == pair_signed_order_key(i32(cell_f.y))
    && spatial_directory[key + 4u]
      == pair_signed_order_key(i32(cell_f.z));
}

fn pair_parent_admitted(level_ordinal: u32) -> bool {
  let fine = level_ordinal == 0u;
  let words = select(arrayLength(&coarse_parent), arrayLength(&fine_parent), fine);
  let expected_words = select(
    params.coarse_parent_capacity_words,
    params.fine_parent_capacity_words,
    fine
  );
  let expected_level = select(
    params.coarse_selected_level,
    params.fine_selected_level,
    fine
  );
  let expected_nodes = select(
    params.coarse_grid_node_count,
    params.fine_grid_node_count,
    fine
  );
  let expected_nx = select(params.coarse_grid_nx, params.fine_grid_nx, fine);
  let expected_ny = select(params.coarse_grid_ny, params.fine_grid_ny, fine);
  let expected_nz = select(params.coarse_grid_nz, params.fine_grid_nz, fine);
  let expected_shift = select(
    params.coarse_grid_shift,
    params.fine_grid_shift,
    fine
  );
  let expected_spacing = select(
    bitcast<u32>(params.coarse_grid_spacing_m),
    bitcast<u32>(params.fine_grid_spacing_m),
    fine
  );
  let expected_node_capacity = select(
    params.coarse_parent_node_capacity,
    params.fine_parent_node_capacity,
    fine
  );
  if (words < 64u || words != expected_words) {
    return false;
  }
  if (fine) {
    return fine_parent[20u] == PARENT_MAGIC
      && fine_parent[21u] == PARENT_VERSION
      && fine_parent[22u] == PARENT_READY_ADMITTED
      && fine_parent[23u] == params.generation_id
      && fine_parent[24u] == params.device_ordinal
      && fine_parent[25u] == params.lane_ordinal
      && fine_parent[26u] == params.lease_token
      && fine_parent[27u] == params.source_family_id
      && fine_parent[28u] == params.storage_generation
      && fine_parent[29u] == params.physics_tick
      && fine_parent[30u] == params.physics_substep
      && fine_parent[31u] == params.position_epoch
      && fine_parent[32u] == params.topology_epoch
      && fine_parent[33u] == params.chart_epoch
      && fine_parent[34u] == params.level_epoch
      && fine_parent[35u] == params.support_epoch
      && fine_parent[36u] == params.source_count
      && bitcast<i32>(fine_parent[37u]) == expected_level
      && fine_parent[38u] == expected_nodes
      && fine_parent[39u] == expected_nx
      && fine_parent[40u] == expected_ny
      && fine_parent[41u] == expected_nz
      && fine_parent[42u] == expected_shift
      && fine_parent[43u] == expected_spacing
      && fine_parent[45u] == expected_node_capacity
      && fine_parent[47u] == 0u
      && fine_parent[48u] == 0u
      && fine_parent[52u] == params.completion_ordinal
      && fine_parent[53u] == 64u
      && fine_parent[54u] == 64u + fine_parent[46u]
      && fine_parent[55u] == expected_words
      && fine_parent[56u] == params.source_row_layout_id
      && fine_parent[59u] == params.generation_id;
  }
  return coarse_parent[20u] == PARENT_MAGIC
    && coarse_parent[21u] == PARENT_VERSION
    && coarse_parent[22u] == PARENT_READY_ADMITTED
    && coarse_parent[23u] == params.generation_id
    && coarse_parent[24u] == params.device_ordinal
    && coarse_parent[25u] == params.lane_ordinal
    && coarse_parent[26u] == params.lease_token
    && coarse_parent[27u] == params.source_family_id
    && coarse_parent[28u] == params.storage_generation
    && coarse_parent[29u] == params.physics_tick
    && coarse_parent[30u] == params.physics_substep
    && coarse_parent[31u] == params.position_epoch
    && coarse_parent[32u] == params.topology_epoch
    && coarse_parent[33u] == params.chart_epoch
    && coarse_parent[34u] == params.level_epoch
    && coarse_parent[35u] == params.support_epoch
    && coarse_parent[36u] == params.source_count
    && bitcast<i32>(coarse_parent[37u]) == expected_level
    && coarse_parent[38u] == expected_nodes
    && coarse_parent[39u] == expected_nx
    && coarse_parent[40u] == expected_ny
    && coarse_parent[41u] == expected_nz
    && coarse_parent[42u] == expected_shift
    && coarse_parent[43u] == expected_spacing
    && coarse_parent[45u] == expected_node_capacity
    && coarse_parent[47u] == 0u
    && coarse_parent[48u] == 0u
    && coarse_parent[52u] == params.completion_ordinal
    && coarse_parent[53u] == 64u
    && coarse_parent[54u] == 64u + coarse_parent[46u]
    && coarse_parent[55u] == expected_words
    && coarse_parent[56u] == params.source_row_layout_id
    && coarse_parent[59u] == params.generation_id;
}

fn pair_source_admitted(source_index: u32) -> bool {
  if (
    params.source_row_layout_id != SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    || params.source_stride_floats != 16u
    || params.identity_stride_words == 0u
  ) {
    return false;
  }
  let row = source_index * params.source_stride_floats;
  let identity_row = source_index * params.identity_stride_words;
  if (
    row > arrayLength(&source_rows)
    || params.source_stride_floats > arrayLength(&source_rows) - row
    || identity_row >= arrayLength(&particle_identity)
  ) {
    return false;
  }
  let level = source_rows[row];
  let spacing = source_rows[row + 1u];
  let mass = source_rows[row + 6u];
  let phase = source_rows[row + 8u];
  let material = source_rows[row + 9u];
  let status = source_rows[row + 10u];
  let chart = source_rows[row + 15u];
  return pair_integral_f32(level)
    && pair_finite_f32(spacing) && spacing > 0.0
    && pair_finite_f32(mass) && mass >= 0.0
    && pair_integral_f32(phase) && phase >= 1.0 && phase <= 4.0
    && pair_integral_f32(material)
    && material >= 1.0 && material <= 16777215.0
    && pair_integral_f32(status) && status >= 0.0 && status <= 255.0
    && (
      (mass == 0.0 && (u32(round(status)) & 31u) != 0u)
      || (
        mass > 0.0
        && (u32(round(status)) & 31u) != 0u
        && (u32(round(status)) & 64u) == 0u
        && (u32(round(status)) & 128u) == 0u
      )
    )
    && pair_finite_f32(source_rows[row + 12u])
    && pair_finite_f32(source_rows[row + 13u])
    && pair_finite_f32(source_rows[row + 14u])
    && pair_integral_f32(chart) && chart >= 0.0;
}

fn pair_grid_index(
  level_ordinal: u32,
  i: i32,
  j: i32,
  k: i32
) -> u32 {
  let fine = level_ordinal == 0u;
  let shift = select(params.coarse_grid_shift, params.fine_grid_shift, fine);
  let nx = select(params.coarse_grid_nx, params.fine_grid_nx, fine);
  let ny = select(params.coarse_grid_ny, params.fine_grid_ny, fine);
  let nz = select(params.coarse_grid_nz, params.fine_grid_nz, fine);
  let node_count = select(
    params.coarse_grid_node_count,
    params.fine_grid_node_count,
    fine
  );
  let si = i + i32(shift);
  let sj = j + i32(shift);
  let sk = k + i32(shift);
  if (
    si < 0 || sj < 0 || sk < 0
    || si >= i32(nx) || sj >= i32(ny) || sk >= i32(nz)
  ) {
    return node_count;
  }
  return (u32(si) * ny + u32(sj)) * nz + u32(sk);
}

fn pair_quadratic_weight_at(fraction: f32, offset: i32) -> f32 {
  if (offset == 0) {
    let value = 1.5 - fraction;
    return 0.5 * value * value;
  }
  if (offset == 1) {
    let value = fraction - 1.0;
    return 0.75 - value * value;
  }
  let value = fraction - 0.5;
  return 0.5 * value * value;
}

fn pair_successor_field_load(level_ordinal: u32, word: u32) -> u32 {
  return select(coarse_load(word), fine_load(word), level_ordinal == 0u);
}

fn pair_predecessor_field_load(level_ordinal: u32, word: u32) -> u32 {
  return select(
    predecessor_coarse_field[word],
    predecessor_fine_field[word],
    level_ordinal == 0u
  );
}

fn pair_successor_descriptor_zero(level_ordinal: u32, source_index: u32) -> bool {
  let descriptor_offset = select(
    params.coarse_descriptor_offset_words,
    params.fine_descriptor_offset_words,
    level_ordinal == 0u
  ) + source_index * FIELD_DESCRIPTOR_WORDS;
  for (var word = 0u; word < FIELD_DESCRIPTOR_WORDS; word = word + 1u) {
    if (pair_successor_field_load(level_ordinal, descriptor_offset + word) != 0u) {
      return false;
    }
  }
  return true;
}

fn pair_successor_descriptor_inactive(
  level_ordinal: u32,
  source_index: u32
) -> bool {
  let descriptor_offset = select(
    params.coarse_descriptor_offset_words,
    params.fine_descriptor_offset_words,
    level_ordinal == 0u
  ) + source_index * FIELD_DESCRIPTOR_WORDS;
  for (var word = 0u; word < 4u; word = word + 1u) {
    if (pair_successor_field_load(level_ordinal, descriptor_offset + word) != 0u) {
      return false;
    }
  }
  for (var word = 4u; word < 31u; word = word + 1u) {
    if (
      pair_successor_field_load(level_ordinal, descriptor_offset + word)
        != FIELD_INVALID_KEY
    ) {
      return false;
    }
  }
  return pair_successor_field_load(level_ordinal, descriptor_offset + 31u)
    == 0u;
}

fn pair_successor_active_mapping_matches(source_index: u32) -> bool {
  if (
    source_index >= params.source_count
    || arrayLength(&predecessor_active_source_view)
      != arrayLength(&active_source_view)
    || arrayLength(&active_source_view) < ACTIVE_SOURCE_HEADER_WORDS
  ) {
    return false;
  }
  let current_reverse = active_source_view[26u] + source_index;
  let predecessor_reverse = predecessor_active_source_view[26u] + source_index;
  if (
    current_reverse >= arrayLength(&active_source_view)
    || predecessor_reverse >= arrayLength(&predecessor_active_source_view)
  ) {
    return false;
  }
  let current_active = active_source_view[current_reverse];
  let predecessor_active = predecessor_active_source_view[predecessor_reverse];
  if (current_active != predecessor_active) {
    return false;
  }
  if (current_active == ACTIVE_SOURCE_MISSING) {
    return true;
  }
  let active_count = active_source_view[ACTIVE_SOURCE_COUNT_WORD];
  let current_forward = active_source_view[25u] + current_active;
  let predecessor_forward = predecessor_active_source_view[25u] + current_active;
  return current_active < active_count
    && current_forward < arrayLength(&active_source_view)
    && predecessor_forward < arrayLength(&predecessor_active_source_view)
    && active_source_view[current_forward] == source_index
    && predecessor_active_source_view[predecessor_forward] == source_index;
}

fn pair_successor_level_stencil_matches(
  level_ordinal: u32,
  source_index: u32
) -> bool {
  let reverse = active_source_view[26u] + source_index;
  let active_ordinal = active_source_view[reverse];
  if (active_ordinal == ACTIVE_SOURCE_MISSING) {
    return pair_successor_descriptor_zero(level_ordinal, source_index);
  }
  if (
    !pair_source_admitted(source_index)
    || !pair_spatial_membership_admitted(source_index)
  ) {
    return false;
  }
  let row = source_index * params.source_stride_floats;
  let selected_level = select(
    params.coarse_selected_level,
    params.fine_selected_level,
    level_ordinal == 0u
  );
  let classified_level = i32(round(source_rows[row]));
  if (classified_level != selected_level) {
    return pair_successor_descriptor_inactive(
      level_ordinal,
      source_index
    );
  }
  let spacing = select(
    params.coarse_grid_spacing_m,
    params.fine_grid_spacing_m,
    level_ordinal == 0u
  );
  let inv_spacing = select(
    params.coarse_inv_grid_spacing_m,
    params.fine_inv_grid_spacing_m,
    level_ordinal == 0u
  );
  if (bitcast<u32>(source_rows[row + 1u]) != bitcast<u32>(spacing)) {
    return false;
  }
  let descriptor_offset = select(
    params.coarse_descriptor_offset_words,
    params.fine_descriptor_offset_words,
    level_ordinal == 0u
  ) + source_index * FIELD_DESCRIPTOR_WORDS;
  let family = u32(round(source_rows[row + 8u]));
  let material = u32(round(source_rows[row + 9u]));
  let identity = particle_identity[source_index * params.identity_stride_words];
  let continuity = select(0u, identity, family == 1u);
  if (
    pair_successor_field_load(level_ordinal, descriptor_offset) != family
    || pair_successor_field_load(level_ordinal, descriptor_offset + 1u) != material
    || pair_successor_field_load(level_ordinal, descriptor_offset + 2u) != continuity
    || pair_successor_field_load(level_ordinal, descriptor_offset + 3u) != 1u
    || pair_successor_field_load(level_ordinal, descriptor_offset + 31u) != 0u
  ) {
    return false;
  }
  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let grid_position = position * inv_spacing;
  let base = vec3<i32>(floor(grid_position - vec3<f32>(0.5)));
  let fraction = grid_position - vec3<f32>(base);
  let field_count = pair_successor_field_load(level_ordinal, 34u);
  let key_offset = select(
    params.coarse_key_offset_words,
    params.fine_key_offset_words,
    level_ordinal == 0u
  );
  let node_count = select(
    params.coarse_grid_node_count,
    params.fine_grid_node_count,
    level_ordinal == 0u
  );
  var ordinal = 0u;
  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let descriptor_word = descriptor_offset + 4u + ordinal;
        ordinal = ordinal + 1u;
        let support_weight =
          pair_quadratic_weight_at(fraction.x, ox)
          * pair_quadratic_weight_at(fraction.y, oy)
          * pair_quadratic_weight_at(fraction.z, oz);
        let node = pair_grid_index(
          level_ordinal,
          base.x + ox,
          base.y + oy,
          base.z + oz
        );
        let field_index = pair_successor_field_load(
          level_ordinal,
          descriptor_word
        );
        if (support_weight == 0.0 || node >= node_count) {
          if (field_index != FIELD_INVALID_KEY) {
            return false;
          }
          continue;
        }
        if (field_index >= field_count) {
          return false;
        }
        let key = key_offset + field_index * FIELD_KEY_WORDS;
        if (
          pair_successor_field_load(level_ordinal, key) != node
          || pair_successor_field_load(level_ordinal, key + 1u) != family
          || pair_successor_field_load(level_ordinal, key + 2u) != material
          || pair_successor_field_load(level_ordinal, key + 3u) != continuity
        ) {
          return false;
        }
      }
    }
  }
  return true;
}

fn pair_write_invalid_candidate(candidate_index: u32) {
  let base = candidate_index * FIELD_RADIX_KEY_WORDS;
  candidate_keys[base] = FIELD_INVALID_KEY;
  candidate_keys[base + 1u] = FIELD_INVALID_KEY;
  candidate_keys[base + 2u] = FIELD_INVALID_KEY;
}

fn pair_write_descriptor_zero(level_ordinal: u32, source_index: u32) {
  if (level_ordinal == 0u) {
    let descriptor = params.fine_descriptor_offset_words
      + source_index * FIELD_DESCRIPTOR_WORDS;
    for (var word = 0u; word < 4u; word = word + 1u) {
      fine_store(descriptor + word, 0u);
    }
  } else {
    let descriptor = params.coarse_descriptor_offset_words
      + source_index * FIELD_DESCRIPTOR_WORDS;
    for (var word = 0u; word < 4u; word = word + 1u) {
      coarse_store(descriptor + word, 0u);
    }
  }
}

fn pair_emit_level(
  level_ordinal: u32,
  active_ordinal: u32,
  source_index: u32
) {
  let candidate_begin = active_ordinal * 27u;
  let row = source_index * params.source_stride_floats;
  let selected_level = select(
    params.coarse_selected_level,
    params.fine_selected_level,
    level_ordinal == 0u
  );
  let spacing = select(
    params.coarse_grid_spacing_m,
    params.fine_grid_spacing_m,
    level_ordinal == 0u
  );
  let inv_spacing = select(
    params.coarse_inv_grid_spacing_m,
    params.fine_inv_grid_spacing_m,
    level_ordinal == 0u
  );
  let level = i32(round(source_rows[row]));
  if (!(source_rows[row + 6u] > 0.0) || level != selected_level) {
    pair_write_descriptor_zero(level_ordinal, source_index);
    for (var ordinal = 0u; ordinal < 27u; ordinal = ordinal + 1u) {
      pair_write_invalid_candidate(candidate_begin + ordinal);
    }
    return;
  }
  if (bitcast<u32>(source_rows[row + 1u]) != bitcast<u32>(spacing)) {
    pair_write_descriptor_zero(level_ordinal, source_index);
    if (level_ordinal == 0u) {
      atomicAdd(&fine_field[35u], 1u);
    } else {
      atomicAdd(&coarse_field[35u], 1u);
    }
    for (var ordinal = 0u; ordinal < 27u; ordinal = ordinal + 1u) {
      pair_write_invalid_candidate(candidate_begin + ordinal);
    }
    return;
  }
  let family = u32(round(source_rows[row + 8u]));
  let material = u32(round(source_rows[row + 9u]));
  let identity = particle_identity[source_index * params.identity_stride_words];
  let continuity = select(0u, identity, family == 1u);
  if (level_ordinal == 0u) {
    let descriptor = params.fine_descriptor_offset_words
      + source_index * FIELD_DESCRIPTOR_WORDS;
    fine_store(descriptor, family);
    fine_store(descriptor + 1u, material);
    fine_store(descriptor + 2u, continuity);
    fine_store(descriptor + 3u, 1u);
  } else {
    let descriptor = params.coarse_descriptor_offset_words
      + source_index * FIELD_DESCRIPTOR_WORDS;
    coarse_store(descriptor, family);
    coarse_store(descriptor + 1u, material);
    coarse_store(descriptor + 2u, continuity);
    coarse_store(descriptor + 3u, 1u);
  }
  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let grid_position = position * inv_spacing;
  let base = vec3<i32>(floor(grid_position - vec3<f32>(0.5)));
  let fraction = grid_position - vec3<f32>(base);
  var ordinal = 0u;
  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let candidate_index = candidate_begin + ordinal;
        ordinal = ordinal + 1u;
        // Match canonical P2G's exact-zero support omission. Keeping such a
        // key creates a field with no published mass/volume contribution,
        // which cannot own a pressure or phase-volume receipt. Cull before
        // grid clipping because a zero-support node is not physical support.
        let support_weight =
          pair_quadratic_weight_at(fraction.x, ox)
          * pair_quadratic_weight_at(fraction.y, oy)
          * pair_quadratic_weight_at(fraction.z, oz);
        if (support_weight == 0.0) {
          pair_write_invalid_candidate(candidate_index);
          continue;
        }
        let node = pair_grid_index(
          level_ordinal,
          base.x + ox,
          base.y + oy,
          base.z + oz
        );
        let node_count = select(
          params.coarse_grid_node_count,
          params.fine_grid_node_count,
          level_ordinal == 0u
        );
        if (node >= node_count) {
          pair_write_invalid_candidate(candidate_index);
          if (level_ordinal == 0u) {
            atomicAdd(&fine_field[36u], 1u);
          } else {
            atomicAdd(&coarse_field[36u], 1u);
          }
          continue;
        }
        let combined_node = node
          + select(params.fine_grid_node_count, 0u, level_ordinal == 0u);
        let key = candidate_index * FIELD_RADIX_KEY_WORDS;
        candidate_keys[key] = combined_node;
        candidate_keys[key + 1u] = (family << 24u) | material;
        candidate_keys[key + 2u] = continuity;
      }
    }
  }
}

@compute @workgroup_size(64)
fn emit_pair_candidates(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let active_ordinal = pair_linear_invocation(
    local_id,
    workgroup_id,
    active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD]
  );
  let active_count = pair_active_source_count();
  if (active_ordinal >= active_count) {
    return;
  }
  let source_index = pair_physical_source_for_active(active_ordinal);
  if (
    source_index == ACTIVE_SOURCE_MISSING
    || !pair_source_admitted(source_index)
    || !pair_spatial_membership_admitted(source_index)
  ) {
    if (source_index != ACTIVE_SOURCE_MISSING) {
      pair_write_descriptor_zero(0u, source_index);
      pair_write_descriptor_zero(1u, source_index);
    }
    atomicAdd(&fine_field[35u], 1u);
    atomicAdd(&coarse_field[35u], 1u);
    for (var ordinal = 0u; ordinal < 27u; ordinal = ordinal + 1u) {
      pair_write_invalid_candidate(active_ordinal * 27u + ordinal);
    }
    return;
  }
  let row = source_index * params.source_stride_floats;
  let classified_level = i32(round(source_rows[row]));
  if (classified_level == params.fine_selected_level) {
    pair_write_descriptor_zero(1u, source_index);
    pair_emit_level(0u, active_ordinal, source_index);
  } else if (classified_level == params.coarse_selected_level) {
    pair_write_descriptor_zero(0u, source_index);
    pair_emit_level(1u, active_ordinal, source_index);
  } else {
    pair_write_descriptor_zero(0u, source_index);
    pair_write_descriptor_zero(1u, source_index);
    for (var ordinal = 0u; ordinal < 27u; ordinal = ordinal + 1u) {
      pair_write_invalid_candidate(active_ordinal * 27u + ordinal);
    }
  }
}

fn pair_unique_count_without_sentinel() -> vec2<u32> {
  if (arrayLength(&unique_evidence) < 8u) {
    return vec2<u32>(0u, 0u);
  }
  let unique_count = unique_evidence[2u];
  if (unique_count == 0u) {
    return vec2<u32>(0u, 0u);
  }
  let last = (unique_count - 1u) * FIELD_RADIX_KEY_WORDS;
  let sentinel = last <= arrayLength(&unique_keys)
    && FIELD_RADIX_KEY_WORDS <= arrayLength(&unique_keys) - last
    && unique_keys[last] == FIELD_INVALID_KEY
    && unique_keys[last + 1u] == FIELD_INVALID_KEY
    && unique_keys[last + 2u] == FIELD_INVALID_KEY;
  return vec2<u32>(unique_count - select(0u, 1u, sentinel), select(0u, 1u, sentinel));
}

fn pair_write_scan_dispatch(
  level: u32,
  element_count: u32,
  enabled: bool
) -> bool {
  let group_count = select(
    0u,
    pair_ceil_groups(element_count, PAIR_SCAN_ELEMENTS_PER_WORKGROUP),
    enabled && element_count > 0u
  );
  let dispatch_x = min(group_count, max(params.dispatch_x_limit, 1u));
  let dispatch_y = select(
    0u,
    pair_ceil_groups(group_count, max(dispatch_x, 1u)),
    group_count > 0u
  );
  let shape_admitted = group_count == 0u
    || (
      dispatch_x > 0u
      && dispatch_y > 0u
      && dispatch_y <= params.dispatch_x_limit
  );
  let block_word = pair_scan_dispatch_word(level, false);
  pair_projection_dispatch[block_word] =
    select(0u, dispatch_x, shape_admitted);
  pair_projection_dispatch[block_word + 1u] =
    select(0u, dispatch_y, shape_admitted);
  pair_projection_dispatch[block_word + 2u] =
    select(0u, 1u, shape_admitted && group_count > 0u);
  let add_enabled = shape_admitted && group_count > 1u;
  let add_word = pair_scan_dispatch_word(level, true);
  pair_projection_dispatch[add_word] =
    select(0u, dispatch_x, add_enabled);
  pair_projection_dispatch[add_word + 1u] =
    select(0u, dispatch_y, add_enabled);
  pair_projection_dispatch[add_word + 2u] =
    select(0u, 1u, add_enabled);
  return shape_admitted;
}

@compute @workgroup_size(1)
fn prepare_pair_unique_partition() {
  let candidate_count = select(
    0u,
    active_source_view[ACTIVE_SOURCE_CANDIDATE_COUNT_WORD],
    pair_active_source_view_admitted()
  );
  pair_store(PAIR_CONTROL_COUNT, candidate_count);
  pair_store(PAIR_CONTROL_SEAL, params.completion_ordinal);
  pair_store(PAIR_CONTROL_ACTIVE_COUNT, pair_active_source_count());
  let counts = pair_unique_count_without_sentinel();
  let valid_count = counts.x;
  let unique_ready = pair_active_source_view_admitted()
    && arrayLength(&unique_evidence) >= 8u
    && pair_load(PAIR_CONTROL_SEAL) == params.completion_ordinal
    && unique_evidence[0u] == params.generation_id
    && unique_evidence[1u] == candidate_count
    && unique_evidence[3u] == FIELD_UNIQUE_STATUS_READY
    && unique_evidence[4u] == 0u
    && unique_evidence[5u] == FIELD_RADIX_KEY_WORDS
    && unique_evidence[6u] == FIELD_RADIX_KEY_WORDS
    && unique_evidence[7u] == 3u
    && valid_count <= candidate_count
    && valid_count <= arrayLength(&unique_keys) / FIELD_RADIX_KEY_WORDS
    && arrayLength(&pair_projection_dispatch)
      >= PAIR_SCAN_MAX_LEVELS * PAIR_SCAN_DISPATCH_STRIDE
    && candidate_count <= arrayLength(&sorted_candidate_indices);
  if (!unique_ready) {
    pair_store(PAIR_CONTROL_FINE_COUNT, 0u);
    pair_store(PAIR_CONTROL_COARSE_COUNT, 0u);
    pair_store(PAIR_CONTROL_VALID_UNIQUE_COUNT, 0u);
    pair_store(PAIR_CONTROL_STATUS, PAIR_STATUS_READY | PAIR_STATUS_FAIL_CLOSED);
    pair_store(PAIR_CONTROL_BUILD_SEAL, 0u);
    return;
  }
  var lower = 0u;
  var upper = valid_count;
  loop {
    if (lower >= upper) { break; }
    let middle = lower + (upper - lower) / 2u;
    let key = unique_keys[middle * FIELD_RADIX_KEY_WORDS];
    if (key < params.fine_grid_node_count) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  let fine_count = lower;
  let coarse_count = valid_count - fine_count;
  // Unique-key counts are not sorted-candidate positions: many particles can
  // contribute the same field key. Locate both candidate-domain boundaries
  // directly in the stable sorted index stream.
  lower = 0u;
  upper = candidate_count;
  loop {
    if (lower >= upper) { break; }
    let middle = lower + (upper - lower) / 2u;
    let candidate = sorted_candidate_indices[middle];
    var combined_node = FIELD_INVALID_KEY;
    if (candidate < candidate_count) {
      combined_node = candidate_keys[candidate * FIELD_RADIX_KEY_WORDS];
    }
    if (combined_node < params.fine_grid_node_count) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  let fine_valid_candidate_count = lower;
  lower = fine_valid_candidate_count;
  upper = candidate_count;
  loop {
    if (lower >= upper) { break; }
    let middle = lower + (upper - lower) / 2u;
    let candidate = sorted_candidate_indices[middle];
    var combined_node = FIELD_INVALID_KEY;
    if (candidate < candidate_count) {
      combined_node = candidate_keys[candidate * FIELD_RADIX_KEY_WORDS];
    }
    if (combined_node < FIELD_INVALID_KEY) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  let valid_candidate_count = lower;
  let coarse_valid_candidate_count =
    valid_candidate_count - fine_valid_candidate_count;
  pair_store(
    PAIR_CONTROL_FINE_SENTINEL_PRESENT,
    select(0u, 1u, fine_valid_candidate_count < candidate_count)
  );
  pair_store(
    PAIR_CONTROL_COARSE_SENTINEL_PRESENT,
    select(0u, 1u, coarse_valid_candidate_count < candidate_count)
  );
  pair_store(
    PAIR_CONTROL_FINE_VALID_CANDIDATE_COUNT,
    fine_valid_candidate_count
  );
  pair_store(
    PAIR_CONTROL_COARSE_VALID_CANDIDATE_COUNT,
    coarse_valid_candidate_count
  );
  pair_store(PAIR_CONTROL_VALID_CANDIDATE_COUNT, valid_candidate_count);

  let partition_counts_admitted =
    fine_count <= params.fine_field_capacity
    && coarse_count <= params.coarse_field_capacity
    && candidate_count <= params.pair_candidate_capacity;
  var live_level_count = candidate_count;
  var scan_level_count = 0u;
  var scan_topology_admitted =
    partition_counts_admitted && candidate_count == 0u;
  for (var level = 0u; level < PAIR_SCAN_MAX_LEVELS; level = level + 1u) {
    if (!partition_counts_admitted || live_level_count == 0u) {
      break;
    }
    let level_end =
      pair_scan_level_offset(level) + live_level_count;
    let storage_admitted = level_end <= arrayLength(&pair_tail_scan);
    let dispatch_admitted = pair_write_scan_dispatch(
      level,
      live_level_count,
      storage_admitted
    );
    if (!storage_admitted || !dispatch_admitted) {
      break;
    }
    scan_level_count = scan_level_count + 1u;
    let group_count =
      pair_ceil_groups(live_level_count, PAIR_SCAN_ELEMENTS_PER_WORKGROUP);
    if (group_count <= 1u) {
      scan_topology_admitted = true;
      break;
    }
    live_level_count = group_count;
  }
  pair_store(PAIR_CONTROL_SCAN_LEVEL_COUNT, scan_level_count);
  let partition_prepared =
    partition_counts_admitted && scan_topology_admitted;
  pair_store(PAIR_CONTROL_FINE_COUNT, select(0u, fine_count, partition_prepared));
  pair_store(PAIR_CONTROL_COARSE_COUNT, select(0u, coarse_count, partition_prepared));
  pair_store(
    PAIR_CONTROL_VALID_UNIQUE_COUNT,
    select(0u, valid_count, partition_prepared)
  );
  pair_store(PAIR_CONTROL_SENTINEL_PRESENT, counts.y);
  pair_store(
    PAIR_CONTROL_STATUS,
    select(
      PAIR_STATUS_READY | PAIR_STATUS_FAIL_CLOSED,
      PAIR_STATUS_READY,
      partition_prepared
    )
  );
  pair_store(PAIR_CONTROL_BUILD_SEAL, 0u);
}

fn pair_candidate_tail_flags(candidate: u32) -> vec2<u32> {
  let combined_node =
    candidate_keys[candidate * FIELD_RADIX_KEY_WORDS];
  let key_valid = combined_node != FIELD_INVALID_KEY
    && combined_node < params.combined_node_span;
  let fine_valid = key_valid
    && combined_node < params.fine_grid_node_count;
  let coarse_valid = key_valid
    && combined_node >= params.fine_grid_node_count;
  return vec2<u32>(
    select(1u, 0u, fine_valid),
    select(1u, 0u, coarse_valid)
  );
}

fn pair_scan_input(level: u32, index: u32) -> vec2<u32> {
  if (level == 0u) {
    return pair_candidate_tail_flags(index);
  }
  return pair_tail_scan[pair_scan_level_offset(level) + index];
}

fn pair_scan_store(level: u32, index: u32, value: vec2<u32>) {
  pair_tail_scan[pair_scan_level_offset(level) + index] = value;
}

fn scan_pair_tail_level(
  level: u32,
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>
) {
  if (local_id.x == 0u) {
    pair_scan_live_level_count = pair_load(PAIR_CONTROL_SCAN_LEVEL_COUNT);
  }
  let live_level_count = workgroupUniformLoad(
    &pair_scan_live_level_count
  );
  if (level >= live_level_count) {
    return;
  }
  let level_count = pair_scan_level_count(level, true);
  let group_count =
    pair_ceil_groups(level_count, PAIR_SCAN_ELEMENTS_PER_WORKGROUP);
  let dispatch_x = min(group_count, max(params.dispatch_x_limit, 1u));
  let linear_group = pair_scan_linear_group(workgroup_id, dispatch_x);
  let group_valid = linear_group < group_count;
  let block_base = linear_group * PAIR_SCAN_ELEMENTS_PER_WORKGROUP;
  let first = block_base + local_id.x * 2u;
  let second = first + 1u;
  var first_value = vec2<u32>(0u);
  var second_value = vec2<u32>(0u);
  if (group_valid && first < level_count) {
    first_value = pair_scan_input(level, first);
  }
  if (group_valid && second < level_count) {
    second_value = pair_scan_input(level, second);
  }
  pair_scan_values[local_id.x * 2u] = first_value;
  pair_scan_values[local_id.x * 2u + 1u] = second_value;

  var offset = 1u;
  for (var width = 256u; width > 0u; width = width >> 1u) {
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      pair_scan_values[right] =
        pair_scan_values[right] + pair_scan_values[left];
    }
    offset = offset << 1u;
  }

  workgroupBarrier();
  if (group_valid && local_id.x == 0u) {
    if (group_count > 1u) {
      pair_scan_store(level + 1u, linear_group, pair_scan_values[511u]);
    }
    pair_scan_values[511u] = vec2<u32>(0u);
  }

  for (var width = 1u; width < 512u; width = width << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      let prior = pair_scan_values[left];
      pair_scan_values[left] = pair_scan_values[right];
      pair_scan_values[right] = pair_scan_values[right] + prior;
    }
  }

  workgroupBarrier();
  if (group_valid && first < level_count) {
    pair_scan_store(level, first, pair_scan_values[local_id.x * 2u]);
  }
  if (group_valid && second < level_count) {
    pair_scan_store(level, second, pair_scan_values[local_id.x * 2u + 1u]);
  }
}

@compute @workgroup_size(256)
fn scan_pair_tail_level_0(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  scan_pair_tail_level(0u, local_id, workgroup_id);
}

@compute @workgroup_size(256)
fn scan_pair_tail_level_1(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  scan_pair_tail_level(1u, local_id, workgroup_id);
}

@compute @workgroup_size(256)
fn scan_pair_tail_level_2(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  scan_pair_tail_level(2u, local_id, workgroup_id);
}

@compute @workgroup_size(256)
fn scan_pair_tail_level_3(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  scan_pair_tail_level(3u, local_id, workgroup_id);
}

fn add_pair_tail_level_offsets(
  level: u32,
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>
) {
  let level_count = pair_scan_level_count(level, true);
  let group_count =
    pair_ceil_groups(level_count, PAIR_SCAN_ELEMENTS_PER_WORKGROUP);
  let dispatch_x = min(group_count, max(params.dispatch_x_limit, 1u));
  let linear_group = pair_scan_linear_group(workgroup_id, dispatch_x);
  let first =
    linear_group * PAIR_SCAN_ELEMENTS_PER_WORKGROUP + local_id.x * 2u;
  let second = first + 1u;
  if (first >= level_count) {
    return;
  }
  let parent_offset =
    pair_tail_scan[pair_scan_level_offset(level + 1u) + linear_group];
  let level_offset = pair_scan_level_offset(level);
  pair_tail_scan[level_offset + first] =
    pair_tail_scan[level_offset + first] + parent_offset;
  if (second < level_count) {
    pair_tail_scan[level_offset + second] =
      pair_tail_scan[level_offset + second] + parent_offset;
  }
}

@compute @workgroup_size(256)
fn add_pair_tail_level_2(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  add_pair_tail_level_offsets(2u, local_id, workgroup_id);
}

@compute @workgroup_size(256)
fn add_pair_tail_level_1(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  add_pair_tail_level_offsets(1u, local_id, workgroup_id);
}

@compute @workgroup_size(256)
fn add_pair_tail_level_0(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  add_pair_tail_level_offsets(0u, local_id, workgroup_id);
}

fn pair_scatter_candidate(position: u32) {
  let candidate_count = pair_load(PAIR_CONTROL_COUNT);
  if (position >= candidate_count) {
    return;
  }
  let fine_valid_count =
    pair_load(PAIR_CONTROL_FINE_VALID_CANDIDATE_COUNT);
  let coarse_valid_count =
    pair_load(PAIR_CONTROL_COARSE_VALID_CANDIDATE_COUNT);
  if (position < fine_valid_count) {
    let candidate = sorted_candidate_indices[position];
    if (
      candidate >= candidate_count
      || pair_candidate_tail_flags(candidate).x != 0u
    ) {
      atomicAdd(&pair_control[PAIR_CONTROL_INVALID_KEY_COUNT], 1u);
    } else {
      fine_stable_order[position] = candidate;
    }
  }
  if (position < coarse_valid_count) {
    let sorted_position = fine_valid_count + position;
    let candidate = sorted_candidate_indices[sorted_position];
    if (
      candidate >= candidate_count
      || pair_candidate_tail_flags(candidate).y != 0u
    ) {
      atomicAdd(&pair_control[PAIR_CONTROL_INVALID_KEY_COUNT], 1u);
    } else {
      coarse_stable_order[position] = candidate;
    }
  }

  let flags = pair_candidate_tail_flags(position);
  let ranks = pair_tail_scan[position];
  if (flags.x != 0u) {
    let destination = fine_valid_count + ranks.x;
    if (destination >= candidate_count) {
      atomicAdd(&pair_control[PAIR_CONTROL_INVALID_KEY_COUNT], 1u);
    } else {
      fine_stable_order[destination] = position;
    }
  }
  if (flags.y != 0u) {
    let destination = coarse_valid_count + ranks.y;
    if (destination >= candidate_count) {
      atomicAdd(&pair_control[PAIR_CONTROL_INVALID_KEY_COUNT], 1u);
    } else {
      coarse_stable_order[destination] = position;
    }
  }
}

@compute @workgroup_size(256)
fn scatter_pair_stable_order(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let group_count = pair_ceil_groups(
    pair_load(PAIR_CONTROL_COUNT),
    PAIR_SCAN_ELEMENTS_PER_WORKGROUP
  );
  let dispatch_x = min(group_count, max(params.dispatch_x_limit, 1u));
  let linear_group = pair_scan_linear_group(workgroup_id, dispatch_x);
  let first =
    linear_group * PAIR_SCAN_ELEMENTS_PER_WORKGROUP + local_id.x * 2u;
  pair_scatter_candidate(first);
  pair_scatter_candidate(first + 1u);
}

@compute @workgroup_size(1)
fn complete_pair_unique_partition() {
  let candidate_count = pair_load(PAIR_CONTROL_COUNT);
  let prepared =
    (pair_load(PAIR_CONTROL_STATUS) & PAIR_STATUS_READY) != 0u
    && (pair_load(PAIR_CONTROL_STATUS) & (
      PAIR_STATUS_ADMITTED | PAIR_STATUS_FAIL_CLOSED
    )) == 0u
    && pair_load(PAIR_CONTROL_SEAL) == params.completion_ordinal;
  let fine_valid_count =
    pair_load(PAIR_CONTROL_FINE_VALID_CANDIDATE_COUNT);
  let coarse_valid_count =
    pair_load(PAIR_CONTROL_COARSE_VALID_CANDIDATE_COUNT);
  var fine_tail_count = 0u;
  var coarse_tail_count = 0u;
  if (candidate_count > 0u && candidate_count <= arrayLength(&pair_tail_scan)) {
    let last = candidate_count - 1u;
    let flags = pair_candidate_tail_flags(last);
    let ranks = pair_tail_scan[last];
    fine_tail_count = ranks.x + flags.x;
    coarse_tail_count = ranks.y + flags.y;
  }
  let projection_admitted = prepared
    && select(
      pair_load(PAIR_CONTROL_SCAN_LEVEL_COUNT) == 0u,
      pair_load(PAIR_CONTROL_SCAN_LEVEL_COUNT) > 0u
        && pair_load(PAIR_CONTROL_SCAN_LEVEL_COUNT) <= PAIR_SCAN_MAX_LEVELS,
      candidate_count > 0u
    )
    && fine_valid_count <= candidate_count
    && coarse_valid_count <= candidate_count
    && fine_tail_count == candidate_count - fine_valid_count
    && coarse_tail_count == candidate_count - coarse_valid_count
    && pair_load(PAIR_CONTROL_VALID_CANDIDATE_COUNT)
      == fine_valid_count + coarse_valid_count
    && pair_load(PAIR_CONTROL_INVALID_KEY_COUNT) == 0u;
  if (!projection_admitted) {
    pair_store(PAIR_CONTROL_FINE_COUNT, 0u);
    pair_store(PAIR_CONTROL_COARSE_COUNT, 0u);
    pair_store(PAIR_CONTROL_VALID_UNIQUE_COUNT, 0u);
  }
  pair_store(
    PAIR_CONTROL_STATUS,
    select(
      PAIR_STATUS_READY | PAIR_STATUS_FAIL_CLOSED,
      PAIR_STATUS_READY | PAIR_STATUS_ADMITTED,
      projection_admitted
    )
  );
  pair_store(
    PAIR_CONTROL_BUILD_SEAL,
    select(0u, params.completion_ordinal, projection_admitted)
  );
}

fn pair_partition_admitted() -> bool {
  return
    (pair_load(PAIR_CONTROL_STATUS) & (
      PAIR_STATUS_READY | PAIR_STATUS_ADMITTED
    )) == (PAIR_STATUS_READY | PAIR_STATUS_ADMITTED)
    && (pair_load(PAIR_CONTROL_STATUS) & PAIR_STATUS_FAIL_CLOSED) == 0u
    && pair_load(PAIR_CONTROL_BUILD_SEAL) == params.completion_ordinal
    && pair_load(PAIR_CONTROL_INVALID_KEY_COUNT) == 0u;
}

@compute @workgroup_size(64)
fn materialize_pair_stencil_indices(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (!pair_partition_admitted()) {
    return;
  }
  let sorted_position = pair_linear_invocation(
    local_id,
    workgroup_id,
    active_source_view[51u]
  );
  let candidate_count = pair_load(PAIR_CONTROL_COUNT);
  if (
    sorted_position >= candidate_count
    || sorted_position >= arrayLength(&sorted_candidate_indices)
    || sorted_position >= arrayLength(&unique_group_by_sorted_position)
  ) {
    return;
  }
  let candidate_index = sorted_candidate_indices[sorted_position];
  if (candidate_index >= candidate_count) {
    atomicAdd(&pair_control[PAIR_CONTROL_INVALID_KEY_COUNT], 1u);
    return;
  }
  let active_ordinal = candidate_index / 27u;
  let stencil_ordinal = candidate_index - active_ordinal * 27u;
  let source_index = pair_physical_source_for_active(active_ordinal);
  if (source_index == ACTIVE_SOURCE_MISSING || stencil_ordinal >= 27u) {
    atomicAdd(&pair_control[PAIR_CONTROL_INVALID_KEY_COUNT], 1u);
    return;
  }
  let candidate_key = candidate_index * FIELD_RADIX_KEY_WORDS;
  let invalid = candidate_keys[candidate_key] == FIELD_INVALID_KEY;
  let fine_destination = params.fine_descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS + 4u + stencil_ordinal;
  let coarse_destination = params.coarse_descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS + 4u + stencil_ordinal;
  if (invalid) {
    fine_store(fine_destination, FIELD_INVALID_KEY);
    coarse_store(coarse_destination, FIELD_INVALID_KEY);
    return;
  }
  let level_ordinal = select(
    1u,
    0u,
    candidate_keys[candidate_key] < params.fine_grid_node_count
  );
  var inclusive_head_count = unique_evidence[2u];
  if (sorted_position + 1u < candidate_count) {
    inclusive_head_count = unique_group_by_sorted_position[sorted_position + 1u];
  }
  if (level_ordinal == 0u) {
    coarse_store(coarse_destination, FIELD_INVALID_KEY);
    if (
      inclusive_head_count == 0u
      || inclusive_head_count - 1u >= pair_load(PAIR_CONTROL_FINE_COUNT)
    ) {
      fine_store(fine_destination, FIELD_INVALID_KEY);
      atomicAdd(&fine_field[58u], 1u);
      return;
    }
    fine_store(fine_destination, inclusive_head_count - 1u);
    return;
  }
  fine_store(fine_destination, FIELD_INVALID_KEY);
  let global_index = select(0u, inclusive_head_count - 1u, inclusive_head_count > 0u);
  let fine_count = pair_load(PAIR_CONTROL_FINE_COUNT);
  let coarse_count = pair_load(PAIR_CONTROL_COARSE_COUNT);
  if (
    inclusive_head_count == 0u
    || global_index < fine_count
    || global_index - fine_count >= coarse_count
  ) {
    coarse_store(coarse_destination, FIELD_INVALID_KEY);
    atomicAdd(&coarse_field[58u], 1u);
    return;
  }
  coarse_store(coarse_destination, global_index - fine_count);
}

fn pair_parent_contains_node(level_ordinal: u32, node_index: u32) -> bool {
  let fine = level_ordinal == 0u;
  let node_count = select(coarse_parent[46u], fine_parent[46u], fine);
  let node_offset = select(coarse_parent[53u], fine_parent[53u], fine);
  var lower = 0u;
  var upper = node_count;
  loop {
    if (lower >= upper) { break; }
    let middle = lower + (upper - lower) / 2u;
    let candidate = select(
      coarse_parent[node_offset + middle],
      fine_parent[node_offset + middle],
      fine
    );
    if (candidate < node_index) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  return lower < node_count
    && select(
      coarse_parent[node_offset + lower],
      fine_parent[node_offset + lower],
      fine
    ) == node_index;
}

@compute @workgroup_size(64)
fn assemble_pair_field_keys(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (!pair_partition_admitted()) {
    return;
  }
  let global_field_index = pair_linear_invocation(
    local_id,
    workgroup_id,
    active_source_view[51u]
  );
  let valid_count = pair_load(PAIR_CONTROL_VALID_UNIQUE_COUNT);
  if (global_field_index >= valid_count) {
    return;
  }
  let key_base = global_field_index * FIELD_RADIX_KEY_WORDS;
  let combined_node = unique_keys[key_base];
  let fine = combined_node < params.fine_grid_node_count;
  let level_ordinal = select(1u, 0u, fine);
  let child_node = select(
    combined_node - params.fine_grid_node_count,
    combined_node,
    fine
  );
  let field_index = select(
    global_field_index - pair_load(PAIR_CONTROL_FINE_COUNT),
    global_field_index,
    fine
  );
  let field_capacity = select(
    params.coarse_field_capacity,
    params.fine_field_capacity,
    fine
  );
  let node_count = select(
    params.coarse_grid_node_count,
    params.fine_grid_node_count,
    fine
  );
  let packed_identity = unique_keys[key_base + 1u];
  let family = packed_identity >> 24u;
  let material = packed_identity & FIELD_RADIX_MATERIAL_MASK;
  let continuity = unique_keys[key_base + 2u];
  let identity_admitted = family >= 1u && family <= 4u
    && material >= 1u && material <= FIELD_RADIX_MATERIAL_MASK
    && ((family << 24u) | material) == packed_identity
    && select(continuity == 0u, continuity != 0u, family == 1u);
  if (
    child_node >= node_count
    || field_index >= field_capacity
    || !identity_admitted
    || !pair_parent_contains_node(level_ordinal, child_node)
  ) {
    if (fine) {
      atomicAdd(&fine_field[58u], 1u);
    } else {
      atomicAdd(&coarse_field[58u], 1u);
    }
    return;
  }
  if (fine) {
    let destination = params.fine_key_offset_words + field_index * FIELD_KEY_WORDS;
    fine_store(destination, child_node);
    fine_store(destination + 1u, family);
    fine_store(destination + 2u, material);
    fine_store(destination + 3u, continuity);
  } else {
    let destination = params.coarse_key_offset_words + field_index * FIELD_KEY_WORDS;
    coarse_store(destination, child_node);
    coarse_store(destination + 1u, family);
    coarse_store(destination + 2u, material);
    coarse_store(destination + 3u, continuity);
  }
}

fn pair_field_layout_admitted(level_ordinal: u32) -> bool {
  let fine = level_ordinal == 0u;
  let descriptor_words = select(
    params.coarse_descriptor_words,
    params.fine_descriptor_words,
    fine
  );
  let key_words = select(params.coarse_key_words, params.fine_key_words, fine);
  let accumulator_words = select(
    params.coarse_accumulator_words,
    params.fine_accumulator_words,
    fine
  );
  let state_words = select(
    params.coarse_state_words,
    params.fine_state_words,
    fine
  );
  let state_offset = select(
    params.coarse_state_offset_words,
    params.fine_state_offset_words,
    fine
  );
  let field_capacity = select(
    params.coarse_field_capacity,
    params.fine_field_capacity,
    fine
  );
  let capacity_words = select(
    params.coarse_capacity_words,
    params.fine_capacity_words,
    fine
  );
  let bound_words = select(
    arrayLength(&coarse_field),
    arrayLength(&fine_field),
    fine
  );
  return descriptor_words == FIELD_DESCRIPTOR_WORDS
    && key_words == FIELD_KEY_WORDS
    && accumulator_words == FIELD_ACCUMULATOR_WORDS
    && state_words == FIELD_STATE_WORDS
    && capacity_words == state_offset
      + field_capacity * (FIELD_STATE_WORDS + FIELD_PRESSURE_WORDS)
    && capacity_words <= bound_words;
}

fn pair_reject_field(level_ordinal: u32, flags: u32) {
  let fine = level_ordinal == 0u;
  if (fine) {
    fine_store(0u, FIELD_MAGIC);
    fine_store(1u, FIELD_VERSION);
    fine_store(2u, FIELD_STATUS_FAIL_CLOSED | flags);
    fine_store(34u, 0u);
    fine_store(37u, select(0u, 1u, (flags & FIELD_STATUS_CAPACITY_OVERFLOW) != 0u));
    for (var word = 44u; word < 64u; word = word + 1u) {
      fine_store(word, 0u);
    }
  } else {
    coarse_store(0u, FIELD_MAGIC);
    coarse_store(1u, FIELD_VERSION);
    coarse_store(2u, FIELD_STATUS_FAIL_CLOSED | flags);
    coarse_store(34u, 0u);
    coarse_store(37u, select(0u, 1u, (flags & FIELD_STATUS_CAPACITY_OVERFLOW) != 0u));
    for (var word = 44u; word < 64u; word = word + 1u) {
      coarse_store(word, 0u);
    }
  }
}

fn pair_publish_field(level_ordinal: u32, field_count: u32) {
  let fine = level_ordinal == 0u;
  let selected_level = select(
    params.coarse_selected_level,
    params.fine_selected_level,
    fine
  );
  let grid_node_count = select(
    params.coarse_grid_node_count,
    params.fine_grid_node_count,
    fine
  );
  let nx = select(params.coarse_grid_nx, params.fine_grid_nx, fine);
  let ny = select(params.coarse_grid_ny, params.fine_grid_ny, fine);
  let nz = select(params.coarse_grid_nz, params.fine_grid_nz, fine);
  let shift = select(params.coarse_grid_shift, params.fine_grid_shift, fine);
  let spacing = select(
    params.coarse_grid_spacing_m,
    params.fine_grid_spacing_m,
    fine
  );
  let descriptor_offset = select(
    params.coarse_descriptor_offset_words,
    params.fine_descriptor_offset_words,
    fine
  );
  let key_offset = select(
    params.coarse_key_offset_words,
    params.fine_key_offset_words,
    fine
  );
  let accumulator_offset = select(
    params.coarse_accumulator_offset_words,
    params.fine_accumulator_offset_words,
    fine
  );
  let state_offset = select(
    params.coarse_state_offset_words,
    params.fine_state_offset_words,
    fine
  );
  let field_capacity = select(
    params.coarse_field_capacity,
    params.fine_field_capacity,
    fine
  );
  let capacity_words = select(
    params.coarse_capacity_words,
    params.fine_capacity_words,
    fine
  );
  let parent_node_capacity = select(
    params.coarse_parent_node_capacity,
    params.fine_parent_node_capacity,
    fine
  );
  let consumer_groups = pair_group_count(field_count);
  let dispatch_x = pair_dispatch_x(consumer_groups);
  let dispatch_y = pair_dispatch_y(consumer_groups, dispatch_x);
  let dispatch_z = select(0u, 1u, field_count > 0u);
  let child_candidate_count = pair_load(PAIR_CONTROL_COUNT);
  let child_sentinel_present = select(
    pair_load(PAIR_CONTROL_COARSE_SENTINEL_PRESENT),
    pair_load(PAIR_CONTROL_FINE_SENTINEL_PRESENT),
    fine
  );
  let child_unique_count = field_count + child_sentinel_present;
  if (fine) {
    fine_store(0u, FIELD_MAGIC);
    fine_store(1u, FIELD_VERSION);
    fine_store(2u, FIELD_STATUS_READY | FIELD_STATUS_ADMITTED);
    fine_store(3u, params.generation_id);
    fine_store(4u, params.device_ordinal);
    fine_store(5u, params.lane_ordinal);
    fine_store(6u, params.lease_token);
    fine_store(7u, params.source_family_id);
    fine_store(8u, params.storage_generation);
    fine_store(9u, params.physics_tick);
    fine_store(10u, params.physics_substep);
    fine_store(11u, params.position_epoch);
    fine_store(12u, params.topology_epoch);
    fine_store(13u, params.chart_epoch);
    fine_store(14u, params.level_epoch);
    fine_store(15u, params.support_epoch);
    fine_store(16u, params.source_count);
    fine_store(17u, bitcast<u32>(selected_level));
    fine_store(18u, grid_node_count);
    fine_store(19u, nx);
    fine_store(20u, ny);
    fine_store(21u, nz);
    fine_store(22u, shift);
    fine_store(23u, bitcast<u32>(spacing));
    fine_store(24u, descriptor_offset);
    fine_store(25u, FIELD_DESCRIPTOR_WORDS);
    fine_store(26u, key_offset);
    fine_store(27u, FIELD_KEY_WORDS);
    fine_store(28u, accumulator_offset);
    fine_store(29u, FIELD_ACCUMULATOR_WORDS);
    fine_store(30u, state_offset);
    fine_store(31u, FIELD_STATE_WORDS);
    fine_store(32u, field_capacity);
    fine_store(33u, child_candidate_count);
    fine_store(34u, field_count);
    fine_store(37u, 0u);
    fine_store(38u, params.completion_ordinal);
    fine_store(39u, params.source_row_layout_id);
    fine_store(40u, params.identity_stride_words);
    fine_store(41u, state_offset + field_capacity * FIELD_STATE_WORDS
      + field_count * FIELD_PRESSURE_WORDS);
    fine_store(42u, capacity_words);
    fine_store(43u, 0u);
    for (var word = 0u; word < FIELD_RECEIPT_WORDS; word = word + 1u) {
      fine_store(state_offset - FIELD_RECEIPT_WORDS + word, 0u);
    }
    fine_store(44u, dispatch_x);
    fine_store(45u, dispatch_y);
    fine_store(46u, dispatch_z);
    fine_store(47u, PARENT_MAGIC);
    fine_store(48u, PARENT_VERSION);
    fine_store(49u, parent_node_capacity);
    fine_store(50u, params.generation_id);
    fine_store(51u, child_candidate_count);
    fine_store(52u, child_unique_count);
    fine_store(53u, unique_evidence[3u]);
    fine_store(54u, params.source_count);
    fine_store(55u, 1u);
    fine_store(56u, 1u);
    fine_store(57u, 1u);
    fine_store(58u, 0u);
    fine_store(59u, 0u);
    fine_store(FIELD_DISPATCH_OFFSET_WORDS, dispatch_x);
    fine_store(FIELD_DISPATCH_OFFSET_WORDS + 1u, dispatch_y);
    fine_store(FIELD_DISPATCH_OFFSET_WORDS + 2u, dispatch_z);
    fine_store(63u, 0u);
  } else {
    coarse_store(0u, FIELD_MAGIC);
    coarse_store(1u, FIELD_VERSION);
    coarse_store(2u, FIELD_STATUS_READY | FIELD_STATUS_ADMITTED);
    coarse_store(3u, params.generation_id);
    coarse_store(4u, params.device_ordinal);
    coarse_store(5u, params.lane_ordinal);
    coarse_store(6u, params.lease_token);
    coarse_store(7u, params.source_family_id);
    coarse_store(8u, params.storage_generation);
    coarse_store(9u, params.physics_tick);
    coarse_store(10u, params.physics_substep);
    coarse_store(11u, params.position_epoch);
    coarse_store(12u, params.topology_epoch);
    coarse_store(13u, params.chart_epoch);
    coarse_store(14u, params.level_epoch);
    coarse_store(15u, params.support_epoch);
    coarse_store(16u, params.source_count);
    coarse_store(17u, bitcast<u32>(selected_level));
    coarse_store(18u, grid_node_count);
    coarse_store(19u, nx);
    coarse_store(20u, ny);
    coarse_store(21u, nz);
    coarse_store(22u, shift);
    coarse_store(23u, bitcast<u32>(spacing));
    coarse_store(24u, descriptor_offset);
    coarse_store(25u, FIELD_DESCRIPTOR_WORDS);
    coarse_store(26u, key_offset);
    coarse_store(27u, FIELD_KEY_WORDS);
    coarse_store(28u, accumulator_offset);
    coarse_store(29u, FIELD_ACCUMULATOR_WORDS);
    coarse_store(30u, state_offset);
    coarse_store(31u, FIELD_STATE_WORDS);
    coarse_store(32u, field_capacity);
    coarse_store(33u, child_candidate_count);
    coarse_store(34u, field_count);
    coarse_store(37u, 0u);
    coarse_store(38u, params.completion_ordinal);
    coarse_store(39u, params.source_row_layout_id);
    coarse_store(40u, params.identity_stride_words);
    coarse_store(41u, state_offset + field_capacity * FIELD_STATE_WORDS
      + field_count * FIELD_PRESSURE_WORDS);
    coarse_store(42u, capacity_words);
    coarse_store(43u, 0u);
    for (var word = 0u; word < FIELD_RECEIPT_WORDS; word = word + 1u) {
      coarse_store(state_offset - FIELD_RECEIPT_WORDS + word, 0u);
    }
    coarse_store(44u, dispatch_x);
    coarse_store(45u, dispatch_y);
    coarse_store(46u, dispatch_z);
    coarse_store(47u, PARENT_MAGIC);
    coarse_store(48u, PARENT_VERSION);
    coarse_store(49u, parent_node_capacity);
    coarse_store(50u, params.generation_id);
    coarse_store(51u, child_candidate_count);
    coarse_store(52u, child_unique_count);
    coarse_store(53u, unique_evidence[3u]);
    coarse_store(54u, params.source_count);
    coarse_store(55u, 1u);
    coarse_store(56u, 1u);
    coarse_store(57u, 1u);
    coarse_store(58u, 0u);
    coarse_store(59u, 0u);
    coarse_store(FIELD_DISPATCH_OFFSET_WORDS, dispatch_x);
    coarse_store(FIELD_DISPATCH_OFFSET_WORDS + 1u, dispatch_y);
    coarse_store(FIELD_DISPATCH_OFFSET_WORDS + 2u, dispatch_z);
    coarse_store(63u, 0u);
  }
}

fn pair_predecessor_active_source_admitted() -> bool {
  let words = arrayLength(&predecessor_active_source_view);
  if (
    words != arrayLength(&active_source_view)
    || words < ACTIVE_SOURCE_HEADER_WORDS
  ) {
    return false;
  }
  let status = predecessor_active_source_view[2u];
  return predecessor_active_source_view[0u] == ACTIVE_SOURCE_MAGIC
    && predecessor_active_source_view[1u] == ACTIVE_SOURCE_VERSION
    && (status & ACTIVE_SOURCE_READY_ADMITTED) == ACTIVE_SOURCE_READY_ADMITTED
    && (status & ACTIVE_SOURCE_REJECTED_MASK) == 0u
    && predecessor_active_source_view[3u] + 1u == params.generation_id
    && predecessor_active_source_view[4u] == params.device_ordinal
    && predecessor_active_source_view[5u] == params.lane_ordinal
    && predecessor_active_source_view[6u] + 1u == params.lease_token
    && predecessor_active_source_view[7u] == params.source_family_id
    && predecessor_active_source_view[8u] + 1u == params.storage_generation
    && predecessor_active_source_view[9u] == params.physics_tick
    && predecessor_active_source_view[10u] + 1u == params.physics_substep
    && predecessor_active_source_view[11u] + 1u == params.position_epoch
    && predecessor_active_source_view[12u] == params.topology_epoch
    && predecessor_active_source_view[13u] == params.chart_epoch
    && predecessor_active_source_view[14u] == params.level_epoch
    && predecessor_active_source_view[15u] == params.support_epoch
    && predecessor_active_source_view[16u] == params.source_count
    && predecessor_active_source_view[17u] == params.source_capacity
    && predecessor_active_source_view[18u]
      == active_source_view[ACTIVE_SOURCE_COUNT_WORD]
    && predecessor_active_source_view[19u] == active_source_view[19u]
    && predecessor_active_source_view[20u] == active_source_view[20u]
    && predecessor_active_source_view[23u] == params.source_row_layout_id
    && predecessor_active_source_view[24u] == params.source_stride_floats
    && predecessor_active_source_view[25u] == active_source_view[25u]
    && predecessor_active_source_view[26u] == active_source_view[26u]
    && predecessor_active_source_view[27u] == active_source_view[27u]
    && predecessor_active_source_view[29u] + 1u == params.completion_ordinal
    && predecessor_active_source_view[30u] + 1u == params.completion_ordinal
    && predecessor_active_source_view[43u]
      == active_source_view[ACTIVE_SOURCE_CANDIDATE_COUNT_WORD]
    && predecessor_active_source_view[44u] == active_source_view[44u]
    && predecessor_active_source_view[47u] != 0u;
}

fn pair_topology_predecessor_admitted(level_ordinal: u32) -> bool {
  let fine = level_ordinal == 0u;
  let words = select(
    arrayLength(&predecessor_coarse_field),
    arrayLength(&predecessor_fine_field),
    fine
  );
  let successor_words = select(
    arrayLength(&coarse_field),
    arrayLength(&fine_field),
    fine
  );
  let capacity_words = select(
    params.coarse_capacity_words,
    params.fine_capacity_words,
    fine
  );
  let selected_level = select(
    params.coarse_selected_level,
    params.fine_selected_level,
    fine
  );
  let grid_node_count = select(
    params.coarse_grid_node_count,
    params.fine_grid_node_count,
    fine
  );
  let nx = select(params.coarse_grid_nx, params.fine_grid_nx, fine);
  let ny = select(params.coarse_grid_ny, params.fine_grid_ny, fine);
  let nz = select(params.coarse_grid_nz, params.fine_grid_nz, fine);
  let shift = select(params.coarse_grid_shift, params.fine_grid_shift, fine);
  let spacing = select(
    bitcast<u32>(params.coarse_grid_spacing_m),
    bitcast<u32>(params.fine_grid_spacing_m),
    fine
  );
  let descriptor_offset = select(
    params.coarse_descriptor_offset_words,
    params.fine_descriptor_offset_words,
    fine
  );
  let key_offset = select(
    params.coarse_key_offset_words,
    params.fine_key_offset_words,
    fine
  );
  let accumulator_offset = select(
    params.coarse_accumulator_offset_words,
    params.fine_accumulator_offset_words,
    fine
  );
  let state_offset = select(
    params.coarse_state_offset_words,
    params.fine_state_offset_words,
    fine
  );
  let field_capacity = select(
    params.coarse_field_capacity,
    params.fine_field_capacity,
    fine
  );
  let parent_capacity = select(
    params.coarse_parent_node_capacity,
    params.fine_parent_node_capacity,
    fine
  );
  let status = pair_predecessor_field_load(level_ordinal, 2u);
  let field_count = pair_predecessor_field_load(level_ordinal, 34u);
  let consumer_groups = pair_group_count(field_count);
  let dispatch_x = pair_dispatch_x(consumer_groups);
  let dispatch_y = pair_dispatch_y(consumer_groups, dispatch_x);
  let dispatch_z = select(0u, 1u, field_count > 0u);
  return words == capacity_words
    && successor_words == capacity_words
    && pair_predecessor_field_load(level_ordinal, 0u) == FIELD_MAGIC
    && pair_predecessor_field_load(level_ordinal, 1u) == FIELD_VERSION
    && (status & (FIELD_STATUS_READY | FIELD_STATUS_ADMITTED))
      == (FIELD_STATUS_READY | FIELD_STATUS_ADMITTED)
    && (status & (FIELD_STATUS_FAIL_CLOSED
      | FIELD_STATUS_INVALID_SOURCE
      | FIELD_STATUS_CAPACITY_OVERFLOW)) == 0u
    && pair_predecessor_field_load(level_ordinal, 3u) + 1u
      == params.generation_id
    && pair_predecessor_field_load(level_ordinal, 4u) == params.device_ordinal
    && pair_predecessor_field_load(level_ordinal, 5u) == params.lane_ordinal
    && pair_predecessor_field_load(level_ordinal, 6u) + 1u
      == params.lease_token
    && pair_predecessor_field_load(level_ordinal, 7u)
      == params.source_family_id
    && pair_predecessor_field_load(level_ordinal, 8u) + 1u
      == params.storage_generation
    && pair_predecessor_field_load(level_ordinal, 9u) == params.physics_tick
    && pair_predecessor_field_load(level_ordinal, 10u) + 1u
      == params.physics_substep
    && pair_predecessor_field_load(level_ordinal, 11u) + 1u
      == params.position_epoch
    && pair_predecessor_field_load(level_ordinal, 12u) == params.topology_epoch
    && pair_predecessor_field_load(level_ordinal, 13u) == params.chart_epoch
    && pair_predecessor_field_load(level_ordinal, 14u) == params.level_epoch
    && pair_predecessor_field_load(level_ordinal, 15u) == params.support_epoch
    && pair_predecessor_field_load(level_ordinal, 16u) == params.source_count
    && bitcast<i32>(pair_predecessor_field_load(level_ordinal, 17u))
      == selected_level
    && pair_predecessor_field_load(level_ordinal, 18u) == grid_node_count
    && pair_predecessor_field_load(level_ordinal, 19u) == nx
    && pair_predecessor_field_load(level_ordinal, 20u) == ny
    && pair_predecessor_field_load(level_ordinal, 21u) == nz
    && pair_predecessor_field_load(level_ordinal, 22u) == shift
    && pair_predecessor_field_load(level_ordinal, 23u) == spacing
    && pair_predecessor_field_load(level_ordinal, 24u) == descriptor_offset
    && pair_predecessor_field_load(level_ordinal, 25u) == FIELD_DESCRIPTOR_WORDS
    && pair_predecessor_field_load(level_ordinal, 26u) == key_offset
    && pair_predecessor_field_load(level_ordinal, 27u) == FIELD_KEY_WORDS
    && pair_predecessor_field_load(level_ordinal, 28u) == accumulator_offset
    && pair_predecessor_field_load(level_ordinal, 29u) == FIELD_ACCUMULATOR_WORDS
    && pair_predecessor_field_load(level_ordinal, 30u) == state_offset
    && pair_predecessor_field_load(level_ordinal, 31u) == FIELD_STATE_WORDS
    && pair_predecessor_field_load(level_ordinal, 32u) == field_capacity
    && pair_predecessor_field_load(level_ordinal, 33u)
      == active_source_view[ACTIVE_SOURCE_CANDIDATE_COUNT_WORD]
    && field_count <= field_capacity
    && pair_predecessor_field_load(level_ordinal, 35u) == 0u
    && pair_predecessor_field_load(level_ordinal, 37u) == 0u
    && pair_predecessor_field_load(level_ordinal, 39u)
      == params.source_row_layout_id
    && pair_predecessor_field_load(level_ordinal, 40u)
      == params.identity_stride_words
    && pair_predecessor_field_load(level_ordinal, 42u) == capacity_words
    && pair_predecessor_field_load(level_ordinal, 44u) == dispatch_x
    && pair_predecessor_field_load(level_ordinal, 45u) == dispatch_y
    && pair_predecessor_field_load(level_ordinal, 46u) == dispatch_z
    && pair_predecessor_field_load(level_ordinal, 47u) == PARENT_MAGIC
    && pair_predecessor_field_load(level_ordinal, 48u) == PARENT_VERSION
    && pair_predecessor_field_load(level_ordinal, 49u) == parent_capacity
    && pair_predecessor_field_load(level_ordinal, 50u) + 1u
      == params.generation_id
    && pair_predecessor_field_load(level_ordinal, 54u) == params.source_count
    && pair_predecessor_field_load(level_ordinal, 55u) == 1u
    && pair_predecessor_field_load(level_ordinal, 56u) == 1u
    && pair_predecessor_field_load(level_ordinal, 57u) == 1u
    && pair_predecessor_field_load(level_ordinal, 58u) == 0u
    && pair_predecessor_field_load(level_ordinal, 60u) == dispatch_x
    && pair_predecessor_field_load(level_ordinal, 61u) == dispatch_y
    && pair_predecessor_field_load(level_ordinal, 62u) == dispatch_z
    && capacity_words == state_offset
      + field_capacity * (FIELD_STATE_WORDS + FIELD_PRESSURE_WORDS);
}

fn pair_publish_topology_successor(level_ordinal: u32) {
  let fine = level_ordinal == 0u;
  let parent_capacity = select(
    params.coarse_parent_node_capacity,
    params.fine_parent_node_capacity,
    fine
  );
  if (fine) {
    fine_store(2u, FIELD_STATUS_READY | FIELD_STATUS_ADMITTED);
    fine_store(3u, params.generation_id);
    fine_store(4u, params.device_ordinal);
    fine_store(5u, params.lane_ordinal);
    fine_store(6u, params.lease_token);
    fine_store(7u, params.source_family_id);
    fine_store(8u, params.storage_generation);
    fine_store(9u, params.physics_tick);
    fine_store(10u, params.physics_substep);
    fine_store(11u, params.position_epoch);
    fine_store(12u, params.topology_epoch);
    fine_store(13u, params.chart_epoch);
    fine_store(14u, params.level_epoch);
    fine_store(15u, params.support_epoch);
    fine_store(38u, params.completion_ordinal);
    fine_store(43u, 0u);
    fine_store(47u, PARENT_MAGIC);
    fine_store(48u, PARENT_VERSION);
    fine_store(49u, parent_capacity);
    fine_store(50u, params.generation_id);
    fine_store(59u, 0u);
    fine_store(63u, 0u);
  } else {
    coarse_store(2u, FIELD_STATUS_READY | FIELD_STATUS_ADMITTED);
    coarse_store(3u, params.generation_id);
    coarse_store(4u, params.device_ordinal);
    coarse_store(5u, params.lane_ordinal);
    coarse_store(6u, params.lease_token);
    coarse_store(7u, params.source_family_id);
    coarse_store(8u, params.storage_generation);
    coarse_store(9u, params.physics_tick);
    coarse_store(10u, params.physics_substep);
    coarse_store(11u, params.position_epoch);
    coarse_store(12u, params.topology_epoch);
    coarse_store(13u, params.chart_epoch);
    coarse_store(14u, params.level_epoch);
    coarse_store(15u, params.support_epoch);
    coarse_store(38u, params.completion_ordinal);
    coarse_store(43u, 0u);
    coarse_store(47u, PARENT_MAGIC);
    coarse_store(48u, PARENT_VERSION);
    coarse_store(49u, parent_capacity);
    coarse_store(50u, params.generation_id);
    coarse_store(59u, 0u);
    coarse_store(63u, 0u);
  }
}

@compute @workgroup_size(64)
fn validate_pair_topology_successor(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let source_index = pair_linear_invocation(
    local_id,
    workgroup_id,
    active_source_view[ACTIVE_SOURCE_PHYSICAL_DISPATCH_WORD]
  );
  if (source_index >= params.source_count) {
    return;
  }
  if (source_index == 0u) {
    let common_admitted = pair_active_source_view_admitted()
      && pair_predecessor_active_source_admitted()
      && pair_spatial_directory_admitted();
    pair_store(
      PAIR_CONTROL_BUILD_SEAL,
      select(0u, params.completion_ordinal, common_admitted)
    );
  }
  if (
    !pair_successor_active_mapping_matches(source_index)
    || !pair_successor_level_stencil_matches(0u, source_index)
    || !pair_successor_level_stencil_matches(1u, source_index)
  ) {
    atomicAdd(&pair_control[PAIR_CONTROL_INVALID_KEY_COUNT], 1u);
  }
}

@compute @workgroup_size(1)
fn finalize_pair_topology_successor() {
  let admitted = pair_load(PAIR_CONTROL_BUILD_SEAL)
      == params.completion_ordinal
    && pair_load(PAIR_CONTROL_INVALID_KEY_COUNT) == 0u
    && pair_parent_admitted(0u)
    && pair_parent_admitted(1u)
    && pair_topology_predecessor_admitted(0u)
    && pair_topology_predecessor_admitted(1u)
    && pair_field_layout_admitted(0u)
    && pair_field_layout_admitted(1u);
  if (!admitted) {
    let topology_invalid_count = pair_load(
      PAIR_CONTROL_INVALID_KEY_COUNT
    );
    fine_store(35u, topology_invalid_count);
    coarse_store(35u, topology_invalid_count);
    pair_reject_field(0u, FIELD_STATUS_INVALID_SOURCE);
    pair_reject_field(1u, FIELD_STATUS_INVALID_SOURCE);
    return;
  }
  pair_publish_topology_successor(0u);
  pair_publish_topology_successor(1u);
}

@compute @workgroup_size(1)
fn finalize_pair_fields() {
  let pair_admitted =
    (pair_load(PAIR_CONTROL_STATUS) & (PAIR_STATUS_READY | PAIR_STATUS_ADMITTED))
      == (PAIR_STATUS_READY | PAIR_STATUS_ADMITTED)
    && (pair_load(PAIR_CONTROL_STATUS) & PAIR_STATUS_FAIL_CLOSED) == 0u
    && pair_load(PAIR_CONTROL_BUILD_SEAL) == params.completion_ordinal
    && pair_load(PAIR_CONTROL_INVALID_KEY_COUNT) == 0u
    && pair_active_source_view_admitted()
    && pair_spatial_directory_admitted()
    && pair_parent_admitted(0u)
    && pair_parent_admitted(1u)
    && pair_field_layout_admitted(0u)
    && pair_field_layout_admitted(1u);
  if (!pair_admitted) {
    pair_reject_field(0u, 0u);
    pair_reject_field(1u, 0u);
    return;
  }
  let fine_count = pair_load(PAIR_CONTROL_FINE_COUNT);
  let coarse_count = pair_load(PAIR_CONTROL_COARSE_COUNT);
  if (
    fine_count > params.fine_field_capacity
    || coarse_count > params.coarse_field_capacity
  ) {
    pair_reject_field(0u, FIELD_STATUS_CAPACITY_OVERFLOW);
    pair_reject_field(1u, FIELD_STATUS_CAPACITY_OVERFLOW);
    return;
  }
  if (
    fine_load(35u) != 0u || fine_load(58u) != 0u
    || coarse_load(35u) != 0u || coarse_load(58u) != 0u
  ) {
    pair_reject_field(0u, FIELD_STATUS_INVALID_SOURCE);
    pair_reject_field(1u, FIELD_STATUS_INVALID_SOURCE);
    return;
  }
  pair_publish_field(0u, fine_count);
  pair_publish_field(1u, coarse_count);
}
`;
