const schroederSpatialMechanicsViewDualWgsl = /* wgsl */ `
struct MechanicsViewParams {
  source_count: u32,
  source_stride_floats: u32,
  source_row_layout_id: u32,
  selected_level: i32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  grid_shift: u32,
  occupancy_word_count: u32,
  node_capacity: u32,
  generation_id: u32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
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
  completion_ordinal: u32,
  directory_capacity_words: u32,
  directory_cell_capacity: u32,
  view_capacity_words: u32,
  view_node_offset_words: u32,
  view_header_offset_words: u32,
  view_header_words: u32,
  source_adapter_id: u32,
  query_chart_id: u32,
  query_min_level: i32,
  query_max_level: i32,
  query_base_grid_spacing_m: f32,
  query_evidence_words: u32,
  workgroup_size: u32,
  cleared_words: u32,
  directory_abi_version: u32,
  active_source_capacity: u32,
  active_source_view_capacity_words: u32,
  active_to_physical_offset_words: u32,
  physical_to_active_offset_words: u32,
  direct_dispatch_x: u32,
  active_source_fingerprint: u32,
};

@group(0) @binding(0) var<storage, read> source_rows: array<f32>;
@group(0) @binding(1) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(2) var<storage, read_write> occupancy_words: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> occupancy_counts: array<u32>;
@group(0) @binding(4) var<storage, read> occupancy_offsets: array<u32>;
@group(0) @binding(5) var<storage, read_write> mechanics_view: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read> active_source_view: array<u32>;
@group(0) @binding(7) var<uniform> params: MechanicsViewParams;

override MECHANICS_DIRECTORY_ABI_VERSION: u32 = 1u;

const SPATIAL_MAGIC: u32 = 0x53534531u;
const SPATIAL_VERSION_V1: u32 = 1u;
const SPATIAL_VERSION_V2: u32 = 2u;
const SPATIAL_STATUS_READY: u32 = 1u;
const SPATIAL_STATUS_ADMITTED: u32 = 2u;
const SPATIAL_STATUS_FAIL_CLOSED: u32 = 4u;
const SPATIAL_STATUS_INVALID_SOURCE: u32 = 8u;
const SPATIAL_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const SPATIAL_PRIMITIVE_STATUS_READY: u32 = 1u;
const SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED: u32 = 4u;
const SPATIAL_HEADER_WORDS: u32 = 48u;
const SPATIAL_KEY_WORDS: u32 = 5u;
const SPATIAL_SORT_BOUNDED_ATLAS_U32: u32 = 1u;
const SPATIAL_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;
const SPATIAL_CLEARED_WORDS: u32 = 67u;
const SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY: u32 = 2u;
const SPATIAL_REVERSE_CELL_PLUS_ONE: u32 = 1u;
const ACTIVE_SOURCE_MAGIC: u32 = 0x53535631u;
const ACTIVE_SOURCE_VERSION: u32 = 1u;
const ACTIVE_SOURCE_HEADER_WORDS: u32 = 64u;
const ACTIVE_SOURCE_STATUS_READY: u32 = 1u;
const ACTIVE_SOURCE_STATUS_ADMITTED: u32 = 2u;
const ACTIVE_SOURCE_STATUS_REJECTED: u32 = 0xfcu;
const ACTIVE_SOURCE_MISSING: u32 = 0xffffffffu;
const ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET: u32 = 48u;
const ACTIVE_SOURCE_CANDIDATE_DISPATCH_OFFSET: u32 = 51u;
const ACTIVE_SOURCE_PHYSICAL_DISPATCH_OFFSET: u32 = 54u;
const SOURCE_LAYOUT_LEVEL_ASSIGNMENT: u32 = 1u;
const SOURCE_LAYOUT_ACTIVE_NODE: u32 = 2u;
const MECHANICS_MAGIC: u32 = 0x534d5631u;
const MECHANICS_VERSION: u32 = 1u;
const MECHANICS_STATUS_READY: u32 = 1u;
const MECHANICS_STATUS_ADMITTED: u32 = 2u;
const MECHANICS_STATUS_FAIL_CLOSED: u32 = 4u;
const MECHANICS_STATUS_INVALID_SOURCE: u32 = 8u;
const MECHANICS_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const H_INVALID_SOURCE_COUNT: u32 = 27u;
const H_ATTEMPTED_SOURCE_COUNT: u32 = 29u;
const H_SELECTED_SOURCE_COUNT: u32 = 30u;
const H_STENCIL_VISIT_COUNT: u32 = 31u;
const DISPATCH_OFFSET_WORDS: u32 = 60u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn integral_f32(value: f32) -> bool {
  return finite_f32(value) && value == trunc(value);
}

fn signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn header_word(relative: u32) -> u32 {
  return params.view_header_offset_words + relative;
}

fn record_invalid_source() {
  atomicAdd(&mechanics_view[header_word(H_INVALID_SOURCE_COUNT)], 1u);
}

fn spatial_directory_v1_admitted() -> bool {
  let bound_words = arrayLength(&spatial_directory);
  if (bound_words < SPATIAL_HEADER_WORDS) {
    return false;
  }
  let flags = spatial_directory[2u];
  let rejected_flags = SPATIAL_STATUS_FAIL_CLOSED
    | SPATIAL_STATUS_INVALID_SOURCE
    | SPATIAL_STATUS_CAPACITY_OVERFLOW;
  let source_count = spatial_directory[16u];
  let source_capacity = spatial_directory[17u];
  let cell_count = spatial_directory[18u];
  let cell_capacity = spatial_directory[19u];
  let logical_admitted_words = spatial_directory[21u];
  let directory_capacity_words = spatial_directory[22u];
  let cell_keys_offset_words = spatial_directory[29u];
  let cell_offsets_offset_words = spatial_directory[30u];
  let cell_members_offset_words = spatial_directory[31u];
  let particle_to_cell_offset_words = spatial_directory[32u];
  let physical_upper_bound_words = spatial_directory[47u];
  let build_ordinal = spatial_directory[33u];
  let primitive_status = spatial_directory[41u];
  let sort_key_words = spatial_directory[26u];
  let sort_mode = spatial_directory[27u];
  let sort_mode_admitted = (
    sort_mode == SPATIAL_SORT_BOUNDED_ATLAS_U32
      && sort_key_words == 1u
  ) || (
    sort_mode == SPATIAL_SORT_LEXICOGRAPHIC_U32X5
      && sort_key_words == SPATIAL_KEY_WORDS
  );
  if (
    directory_capacity_words > bound_words
    || directory_capacity_words != params.directory_capacity_words
    || physical_upper_bound_words < SPATIAL_HEADER_WORDS
    || physical_upper_bound_words > directory_capacity_words
    || logical_admitted_words < SPATIAL_HEADER_WORDS
    || logical_admitted_words > physical_upper_bound_words
    || cell_capacity != params.directory_cell_capacity
    || cell_keys_offset_words != SPATIAL_HEADER_WORDS
    || cell_keys_offset_words > directory_capacity_words
    || cell_capacity > (directory_capacity_words - cell_keys_offset_words) / SPATIAL_KEY_WORDS
    || cell_offsets_offset_words
      != cell_keys_offset_words + cell_capacity * SPATIAL_KEY_WORDS
    || cell_offsets_offset_words > directory_capacity_words
    || cell_capacity + 1u > directory_capacity_words - cell_offsets_offset_words
    || cell_members_offset_words != cell_offsets_offset_words + cell_capacity + 1u
    || cell_members_offset_words > directory_capacity_words
    || source_capacity > directory_capacity_words - cell_members_offset_words
    || particle_to_cell_offset_words != cell_members_offset_words + source_capacity
    || particle_to_cell_offset_words > directory_capacity_words
    || source_capacity > directory_capacity_words - particle_to_cell_offset_words
    || !range_within(cell_keys_offset_words, cell_count * SPATIAL_KEY_WORDS, physical_upper_bound_words)
    || !range_within(cell_offsets_offset_words, cell_count + 1u, physical_upper_bound_words)
    || !range_within(cell_members_offset_words, source_count, physical_upper_bound_words)
    || !range_within(particle_to_cell_offset_words, source_count, physical_upper_bound_words)
  ) {
    return false;
  }
  let query_offset_words = particle_to_cell_offset_words + source_count;
  return spatial_directory[0u] == SPATIAL_MAGIC
    && spatial_directory[1u] == SPATIAL_VERSION_V1
    && (flags & (SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED))
      == (SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED)
    && (flags & rejected_flags) == 0u
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
    && source_count == params.source_count
    && source_count > 0u
    && source_count <= source_capacity
    && cell_count > 0u
    && cell_count <= source_count
    && cell_count <= cell_capacity
    && spatial_directory[20u] == spatial_directory[21u]
    && spatial_directory[23u] == 0u
    && spatial_directory[24u] == 0u
    && spatial_directory[25u] == SPATIAL_KEY_WORDS
    && sort_mode_admitted
    && spatial_directory[28u] == SPATIAL_HEADER_WORDS
    && build_ordinal == params.completion_ordinal
    && spatial_directory[34u] == build_ordinal
    && spatial_directory[35u] == params.completion_ordinal
    && spatial_directory[36u] == params.generation_id
    && spatial_directory[37u] == source_count
    && spatial_directory[38u] == cell_count
    && spatial_directory[39u] != 0u
    && spatial_directory[40u] == 0u
    && (primitive_status & SPATIAL_PRIMITIVE_STATUS_READY) != 0u
    && (primitive_status & SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && spatial_directory[45u] == SPATIAL_CLEARED_WORDS
    && spatial_directory[46u] == SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    && params.source_adapter_id == SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    && params.query_evidence_words == 6u
    && range_within(query_offset_words, params.query_evidence_words, physical_upper_bound_words)
    && spatial_directory[query_offset_words] == params.query_chart_id
    && bitcast<i32>(spatial_directory[query_offset_words + 1u]) == params.query_min_level
    && bitcast<i32>(spatial_directory[query_offset_words + 2u]) == params.query_max_level
    && spatial_directory[query_offset_words + 3u]
      == bitcast<u32>(params.query_base_grid_spacing_m)
    && params.selected_level >= params.query_min_level
    && params.selected_level <= params.query_max_level
    && bitcast<u32>(params.grid_spacing_m)
      == bitcast<u32>(params.query_base_grid_spacing_m * exp2(f32(params.selected_level)));
}

fn active_source_view_admitted() -> bool {
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < ACTIVE_SOURCE_HEADER_WORDS) {
    return false;
  }
  let status = active_source_view[2u];
  let physical_count = active_source_view[16u];
  let physical_capacity = active_source_view[17u];
  let active_count = active_source_view[18u];
  let active_capacity = active_source_view[19u];
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let capacity_words = active_source_view[27u];
  let dispatch_x = active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET];
  let dispatch_y = active_source_view[
    ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET + 1u
  ];
  let dispatch_z = active_source_view[
    ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET + 2u
  ];
  let required_groups = active_count / max(params.workgroup_size, 1u)
    + select(
      0u,
      1u,
      active_count % max(params.workgroup_size, 1u) != 0u
    );
  var dispatch_admitted =
    dispatch_x == 0u && dispatch_y == 1u && dispatch_z == 1u;
  if (active_count > 0u) {
    dispatch_admitted = dispatch_x > 0u
      && dispatch_y > 0u
      && dispatch_z == 1u
      && dispatch_x * dispatch_y >= required_groups;
  }
  return params.directory_abi_version == MECHANICS_DIRECTORY_ABI_VERSION
    && MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
    && params.source_row_layout_id == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && active_source_view[0u] == ACTIVE_SOURCE_MAGIC
    && active_source_view[1u] == ACTIVE_SOURCE_VERSION
    && (status & (ACTIVE_SOURCE_STATUS_READY | ACTIVE_SOURCE_STATUS_ADMITTED))
      == (ACTIVE_SOURCE_STATUS_READY | ACTIVE_SOURCE_STATUS_ADMITTED)
    && (status & ACTIVE_SOURCE_STATUS_REJECTED) == 0u
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
    && physical_count > 0u
    && physical_count <= physical_capacity
    && active_count <= physical_count
    && active_count <= active_capacity
    && active_capacity == params.active_source_capacity
    && active_capacity <= physical_capacity
    && active_source_view[20u] == physical_count - active_count
    && active_source_view[21u] == 0u
    && active_source_view[22u] == 0u
    && active_source_view[23u] == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && active_source_view[24u] == params.source_stride_floats
    && active_to_physical == params.active_to_physical_offset_words
    && active_to_physical == ACTIVE_SOURCE_HEADER_WORDS
    && physical_to_active == params.physical_to_active_offset_words
    && physical_to_active == active_to_physical + active_capacity
    && capacity_words == params.active_source_view_capacity_words
    && capacity_words == physical_to_active + physical_capacity
    && capacity_words <= bound_words
    && active_source_view[29u] == params.completion_ordinal
    && active_source_view[30u] == params.completion_ordinal
    && active_source_view[31u] == params.active_source_fingerprint
    && active_source_view[32u] == physical_count
    && active_source_view[33u] == active_count
    && active_source_view[34u] == active_count
    && active_source_view[35u] == active_count
    && active_source_view[36u] <= physical_count
    && active_source_view[37u] == params.workgroup_size
    && active_source_view[38u] > 0u
    && active_source_view[40u] == ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET
    && active_source_view[41u] == ACTIVE_SOURCE_CANDIDATE_DISPATCH_OFFSET
    && active_source_view[42u] == ACTIVE_SOURCE_PHYSICAL_DISPATCH_OFFSET
    && active_source_view[43u] == active_count * 27u
    && active_source_view[47u] != 0u
    && dispatch_admitted;
}

fn spatial_directory_v2_admitted() -> bool {
  let bound_words = arrayLength(&spatial_directory);
  if (bound_words < SPATIAL_HEADER_WORDS || !active_source_view_admitted()) {
    return false;
  }
  let flags = spatial_directory[2u];
  let rejected_flags = SPATIAL_STATUS_FAIL_CLOSED
    | SPATIAL_STATUS_INVALID_SOURCE
    | SPATIAL_STATUS_CAPACITY_OVERFLOW;
  let physical_count = spatial_directory[16u];
  let physical_capacity = spatial_directory[17u];
  let cell_count = spatial_directory[18u];
  let cell_capacity = spatial_directory[19u];
  let logical_required_words = spatial_directory[20u];
  let logical_admitted_words = spatial_directory[21u];
  let directory_capacity_words = spatial_directory[22u];
  let cell_keys_offset_words = spatial_directory[29u];
  let cell_offsets_offset_words = spatial_directory[30u];
  let cell_members_offset_words = spatial_directory[31u];
  let physical_to_cell_plus_one_offset_words = spatial_directory[32u];
  let active_count = spatial_directory[37u];
  let physical_upper_bound_words = spatial_directory[47u];
  let build_ordinal = spatial_directory[33u];
  let primitive_status = spatial_directory[41u];
  let query_offset_words =
    physical_to_cell_plus_one_offset_words + physical_capacity;
  let expected_logical_words = SPATIAL_HEADER_WORDS
    + cell_count * SPATIAL_KEY_WORDS
    + cell_count + 1u
    + active_count
    + physical_count
    + params.query_evidence_words;
  if (
    directory_capacity_words > bound_words
    || directory_capacity_words != params.directory_capacity_words
    || physical_upper_bound_words < SPATIAL_HEADER_WORDS
    || physical_upper_bound_words > directory_capacity_words
    || logical_required_words != expected_logical_words
    || logical_admitted_words != logical_required_words
    || cell_capacity != params.directory_cell_capacity
    || cell_keys_offset_words != SPATIAL_HEADER_WORDS
    || cell_capacity
      > (directory_capacity_words - cell_keys_offset_words) / SPATIAL_KEY_WORDS
    || cell_offsets_offset_words
      != cell_keys_offset_words + cell_capacity * SPATIAL_KEY_WORDS
    || cell_capacity + 1u
      > directory_capacity_words - cell_offsets_offset_words
    || cell_members_offset_words
      != cell_offsets_offset_words + cell_capacity + 1u
    || physical_capacity
      > directory_capacity_words - cell_members_offset_words
    || physical_to_cell_plus_one_offset_words
      != cell_members_offset_words + physical_capacity
    || physical_capacity
      > directory_capacity_words - physical_to_cell_plus_one_offset_words
    || query_offset_words > directory_capacity_words
    || !range_within(
      cell_keys_offset_words,
      cell_count * SPATIAL_KEY_WORDS,
      physical_upper_bound_words
    )
    || !range_within(
      cell_offsets_offset_words,
      cell_count + 1u,
      physical_upper_bound_words
    )
    || !range_within(
      cell_members_offset_words,
      active_count,
      physical_upper_bound_words
    )
    || !range_within(
      physical_to_cell_plus_one_offset_words,
      physical_count,
      physical_upper_bound_words
    )
    || !range_within(
      query_offset_words,
      params.query_evidence_words,
      physical_upper_bound_words
    )
  ) {
    return false;
  }
  return spatial_directory[0u] == SPATIAL_MAGIC
    && spatial_directory[1u] == SPATIAL_VERSION_V2
    && (flags & (SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED))
      == (SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED)
    && (flags & rejected_flags) == 0u
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
    && physical_count > 0u
    && physical_count <= physical_capacity
    && active_count == active_source_view[18u]
    && active_count <= physical_count
    && cell_count <= active_count
    && (active_count == 0u || cell_count > 0u)
    && cell_count <= cell_capacity
    && spatial_directory[23u] == 0u
    && spatial_directory[24u] == 0u
    && spatial_directory[25u] == SPATIAL_KEY_WORDS
    && spatial_directory[26u] == SPATIAL_KEY_WORDS
    && spatial_directory[27u] == SPATIAL_SORT_LEXICOGRAPHIC_U32X5
    && spatial_directory[28u] == SPATIAL_HEADER_WORDS
    && build_ordinal == params.completion_ordinal
    && spatial_directory[34u] == build_ordinal
    && spatial_directory[35u] == params.completion_ordinal
    && spatial_directory[36u] == params.generation_id
    && spatial_directory[38u] == cell_count
    && spatial_directory[39u] != 0u
    && spatial_directory[40u] == 0u
    && (primitive_status & SPATIAL_PRIMITIVE_STATUS_READY) != 0u
    && (primitive_status & SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && spatial_directory[45u] == SPATIAL_CLEARED_WORDS
    && spatial_directory[46u] == SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    && params.source_adapter_id == SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    && params.query_evidence_words == 6u
    && spatial_directory[cell_offsets_offset_words + cell_count]
      == active_count
    && spatial_directory[query_offset_words] == params.query_chart_id
    && bitcast<i32>(spatial_directory[query_offset_words + 1u])
      == params.query_min_level
    && bitcast<i32>(spatial_directory[query_offset_words + 2u])
      == params.query_max_level
    && spatial_directory[query_offset_words + 3u]
      == bitcast<u32>(params.query_base_grid_spacing_m)
    && params.selected_level >= params.query_min_level
    && params.selected_level <= params.query_max_level
    && bitcast<u32>(params.grid_spacing_m)
      == bitcast<u32>(
        params.query_base_grid_spacing_m * exp2(f32(params.selected_level))
      );
}

fn spatial_directory_admitted() -> bool {
  if (params.directory_abi_version != MECHANICS_DIRECTORY_ABI_VERSION) {
    return false;
  }
  if (MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V1) {
    return spatial_directory_v1_admitted();
  }
  if (MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2) {
    return spatial_directory_v2_admitted();
  }
  return false;
}

fn source_work_count() -> u32 {
  if (MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2) {
    return select(0u, active_source_view[18u], active_source_view_admitted());
  }
  return params.source_count;
}

fn physical_source_for_work(source_work_index: u32) -> u32 {
  if (MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V1) {
    return select(
      ACTIVE_SOURCE_MISSING,
      source_work_index,
      source_work_index < params.source_count
    );
  }
  if (!active_source_view_admitted()) {
    return ACTIVE_SOURCE_MISSING;
  }
  let active_count = active_source_view[18u];
  if (source_work_index >= active_count) {
    return ACTIVE_SOURCE_MISSING;
  }
  let physical_source = active_source_view[
    params.active_to_physical_offset_words + source_work_index
  ];
  if (
    physical_source >= params.source_count
    || active_source_view[
      params.physical_to_active_offset_words + physical_source
    ] != source_work_index
  ) {
    return ACTIVE_SOURCE_MISSING;
  }
  return physical_source;
}

fn source_row_values(source_index: u32) -> vec4<f32> {
  let row = source_index * params.source_stride_floats;
  if (params.source_row_layout_id == SOURCE_LAYOUT_LEVEL_ASSIGNMENT) {
    return vec4<f32>(
      source_rows[row],
      source_rows[row + 1u],
      source_rows[row + 10u],
      f32(source_index)
    );
  }
  return vec4<f32>(
    source_rows[row],
    source_rows[row + 8u],
    source_rows[row + 11u],
    source_rows[row + 10u]
  );
}

fn source_row_position(source_index: u32) -> vec4<f32> {
  let row = source_index * params.source_stride_floats;
  return vec4<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u],
    source_rows[row + 15u]
  );
}

fn source_row_admitted(source_index: u32) -> bool {
  let row = source_index * params.source_stride_floats;
  if (
    params.source_stride_floats != 16u
    || row > arrayLength(&source_rows)
    || params.source_stride_floats > arrayLength(&source_rows) - row
    || (params.source_row_layout_id != SOURCE_LAYOUT_LEVEL_ASSIGNMENT
      && params.source_row_layout_id != SOURCE_LAYOUT_ACTIVE_NODE)
  ) {
    return false;
  }
  let values = source_row_values(source_index);
  let position_chart = source_row_position(source_index);
  let level_f = values.x;
  let native_spacing = values.y;
  let status_f = values.z;
  let source_f = values.w;
  if (
    !integral_f32(level_f)
    || !finite_f32(native_spacing)
    || !(native_spacing > 0.0)
    || !integral_f32(status_f)
    || status_f < 0.0
    || status_f > 255.0
    || !integral_f32(source_f)
    || source_f != f32(source_index)
    || !finite_f32(position_chart.x)
    || !finite_f32(position_chart.y)
    || !finite_f32(position_chart.z)
    || !integral_f32(position_chart.w)
    || position_chart.w < 0.0
  ) {
    return false;
  }
  let status = u32(round(status_f));
  if (
    (status & 31u) == 0u
    || (status & 64u) != 0u
    || (status & 128u) != 0u
  ) {
    return false;
  }
  let cell_count = spatial_directory[18u];
  let cell_keys_offset_words = spatial_directory[29u];
  let particle_to_cell_offset_words = spatial_directory[32u];
  let encoded_cell =
    spatial_directory[particle_to_cell_offset_words + source_index];
  let cell_index = select(
    encoded_cell,
    encoded_cell - 1u,
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
      && encoded_cell > 0u
  );
  if (
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
    && encoded_cell == 0u
  ) {
    return false;
  }
  if (cell_index >= cell_count) {
    return false;
  }
  let key = cell_keys_offset_words + cell_index * SPATIAL_KEY_WORDS;
  let cell = vec3<i32>(floor(position_chart.xyz / native_spacing));
  return spatial_directory[key] == u32(round(position_chart.w))
    && spatial_directory[key + 1u] == signed_order_key(i32(round(level_f)))
    && spatial_directory[key + 2u] == signed_order_key(cell.x)
    && spatial_directory[key + 3u] == signed_order_key(cell.y)
    && spatial_directory[key + 4u] == signed_order_key(cell.z);
}

fn grid_index(i: i32, j: i32, k: i32) -> u32 {
  let si = i + i32(params.grid_shift);
  let sj = j + i32(params.grid_shift);
  let sk = k + i32(params.grid_shift);
  if (
    si < 0 || sj < 0 || sk < 0
    || si >= i32(params.grid_nx)
    || sj >= i32(params.grid_ny)
    || sk >= i32(params.grid_nz)
  ) {
    return params.grid_node_count;
  }
  return (u32(si) * params.grid_ny + u32(sj)) * params.grid_nz + u32(sk);
}

@compute @workgroup_size(64)
fn mark_mechanics_nodes(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let dispatch_x = select(
    max(params.direct_dispatch_x, 1u),
    max(active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET], 1u),
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
  );
  let linear_group = workgroup_id.x + workgroup_id.y * dispatch_x;
  let source_work_index =
    linear_group * max(params.workgroup_size, 1u) + local_id.x;
  if (source_work_index >= source_work_count()) {
    return;
  }
  if (!spatial_directory_admitted()) {
    record_invalid_source();
    return;
  }
  let source_index = physical_source_for_work(source_work_index);
  if (
    source_index == ACTIVE_SOURCE_MISSING
    || !source_row_admitted(source_index)
  ) {
    record_invalid_source();
    return;
  }
  // Count an attempted source only after active-ordinal, physical-row, and
  // directory reverse/key parity are all authenticated.
  atomicAdd(&mechanics_view[header_word(H_ATTEMPTED_SOURCE_COUNT)], 1u);
  if (
    params.source_row_layout_id == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && !(source_rows[source_index * params.source_stride_floats + 6u] > 0.0)
  ) {
    return;
  }
  let values = source_row_values(source_index);
  let level = i32(round(values.x));
  if (level != params.selected_level) {
    return;
  }
  if (bitcast<u32>(values.y) != bitcast<u32>(params.grid_spacing_m)) {
    record_invalid_source();
    return;
  }
  atomicAdd(&mechanics_view[header_word(H_SELECTED_SOURCE_COUNT)], 1u);
  let position = source_row_position(source_index).xyz;
  let grid_position = position * params.inv_grid_spacing_m;
  let base = vec3<i32>(floor(grid_position - vec3<f32>(0.5)));
  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let node_index = grid_index(base.x + ox, base.y + oy, base.z + oz);
        if (node_index >= params.grid_node_count) {
          continue;
        }
        let word = node_index >> 5u;
        let bit = node_index & 31u;
        if (word >= params.occupancy_word_count || word >= arrayLength(&occupancy_words)) {
          record_invalid_source();
          continue;
        }
        atomicOr(&occupancy_words[word], 1u << bit);
        atomicAdd(&mechanics_view[header_word(H_STENCIL_VISIT_COUNT)], 1u);
      }
    }
  }
}

@compute @workgroup_size(64)
fn count_occupied_words(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let word = global_id.x;
  if (word >= params.occupancy_word_count) {
    return;
  }
  occupancy_counts[word] = countOneBits(atomicLoad(&occupancy_words[word]));
}

@compute @workgroup_size(64)
fn scatter_mechanics_nodes(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let word = global_id.x;
  if (word >= params.occupancy_word_count) {
    return;
  }
  let bits = atomicLoad(&occupancy_words[word]);
  let destination_base = occupancy_offsets[word];
  var local_rank = 0u;
  for (var bit = 0u; bit < 32u; bit = bit + 1u) {
    if ((bits & (1u << bit)) == 0u) {
      continue;
    }
    let node_index = word * 32u + bit;
    let destination = destination_base + local_rank;
    if (
      node_index < params.grid_node_count
      && destination < params.node_capacity
      && params.view_node_offset_words + destination < arrayLength(&mechanics_view)
    ) {
      atomicStore(
        &mechanics_view[params.view_node_offset_words + destination],
        node_index
      );
    }
    local_rank = local_rank + 1u;
  }
}

@compute @workgroup_size(1)
fn finalize_mechanics_view() {
  let last_word = params.occupancy_word_count - 1u;
  let node_count = occupancy_offsets[last_word] + occupancy_counts[last_word];
  let invalid_source_count = atomicLoad(
    &mechanics_view[header_word(H_INVALID_SOURCE_COUNT)]
  );
  let attempted_source_count = atomicLoad(
    &mechanics_view[header_word(H_ATTEMPTED_SOURCE_COUNT)]
  );
  let selected_source_count = atomicLoad(
    &mechanics_view[header_word(H_SELECTED_SOURCE_COUNT)]
  );
  let stencil_visit_count = atomicLoad(
    &mechanics_view[header_word(H_STENCIL_VISIT_COUNT)]
  );
  let expected_source_work_count = source_work_count();
  let view_capacity_ready = params.view_capacity_words <= arrayLength(&mechanics_view)
    && params.view_node_offset_words <= params.view_capacity_words
    && params.node_capacity <= params.view_capacity_words - params.view_node_offset_words;
  let overflow_count = select(0u, node_count - params.node_capacity, node_count > params.node_capacity);
  let admitted = spatial_directory_admitted()
    && attempted_source_count == expected_source_work_count
    && invalid_source_count == 0u
    && overflow_count == 0u
    && view_capacity_ready;
  var flags = MECHANICS_STATUS_READY | MECHANICS_STATUS_ADMITTED;
  if (!admitted) {
    flags = MECHANICS_STATUS_FAIL_CLOSED;
    if (
      invalid_source_count != 0u
      || attempted_source_count != expected_source_work_count
    ) {
      flags = flags | MECHANICS_STATUS_INVALID_SOURCE;
    }
    if (overflow_count != 0u || !view_capacity_ready) {
      flags = flags | MECHANICS_STATUS_CAPACITY_OVERFLOW;
    }
  }
  let dispatch_x = select(
    0u,
    (node_count + max(params.workgroup_size, 1u) - 1u)
      / max(params.workgroup_size, 1u),
    admitted && node_count > 0u
  );
  atomicStore(&mechanics_view[header_word(0u)], MECHANICS_MAGIC);
  atomicStore(&mechanics_view[header_word(1u)], MECHANICS_VERSION);
  atomicStore(&mechanics_view[header_word(2u)], flags);
  atomicStore(&mechanics_view[header_word(3u)], params.generation_id);
  atomicStore(&mechanics_view[header_word(4u)], params.device_ordinal);
  atomicStore(&mechanics_view[header_word(5u)], params.lane_ordinal);
  atomicStore(&mechanics_view[header_word(6u)], params.lease_token);
  atomicStore(&mechanics_view[header_word(7u)], params.source_family_id);
  atomicStore(&mechanics_view[header_word(8u)], params.storage_generation);
  atomicStore(&mechanics_view[header_word(9u)], params.physics_tick);
  atomicStore(&mechanics_view[header_word(10u)], params.physics_substep);
  atomicStore(&mechanics_view[header_word(11u)], params.position_epoch);
  atomicStore(&mechanics_view[header_word(12u)], params.topology_epoch);
  atomicStore(&mechanics_view[header_word(13u)], params.chart_epoch);
  atomicStore(&mechanics_view[header_word(14u)], params.level_epoch);
  atomicStore(&mechanics_view[header_word(15u)], params.support_epoch);
  atomicStore(&mechanics_view[header_word(16u)], params.source_count);
  atomicStore(&mechanics_view[header_word(17u)], bitcast<u32>(params.selected_level));
  atomicStore(&mechanics_view[header_word(18u)], params.grid_node_count);
  atomicStore(&mechanics_view[header_word(19u)], params.grid_nx);
  atomicStore(&mechanics_view[header_word(20u)], params.grid_ny);
  atomicStore(&mechanics_view[header_word(21u)], params.grid_nz);
  atomicStore(&mechanics_view[header_word(22u)], params.grid_shift);
  atomicStore(&mechanics_view[header_word(23u)], bitcast<u32>(params.grid_spacing_m));
  atomicStore(&mechanics_view[header_word(24u)], params.occupancy_word_count);
  atomicStore(&mechanics_view[header_word(25u)], params.node_capacity);
  atomicStore(&mechanics_view[header_word(26u)], select(0u, node_count, admitted));
  atomicStore(&mechanics_view[header_word(27u)], invalid_source_count);
  atomicStore(&mechanics_view[header_word(28u)], overflow_count);
  atomicStore(&mechanics_view[header_word(29u)], attempted_source_count);
  atomicStore(&mechanics_view[header_word(30u)], selected_source_count);
  atomicStore(&mechanics_view[header_word(31u)], stencil_visit_count);
  atomicStore(&mechanics_view[header_word(32u)], params.completion_ordinal);
  atomicStore(&mechanics_view[header_word(33u)], params.view_node_offset_words);
  atomicStore(&mechanics_view[header_word(34u)], params.view_node_offset_words + node_count);
  atomicStore(&mechanics_view[header_word(35u)], params.view_capacity_words);
  atomicStore(&mechanics_view[header_word(36u)], params.source_row_layout_id);
  atomicStore(&mechanics_view[header_word(37u)], dispatch_x);
  atomicStore(&mechanics_view[header_word(38u)], params.cleared_words);
  atomicStore(&mechanics_view[header_word(39u)], params.generation_id);
  atomicStore(&mechanics_view[DISPATCH_OFFSET_WORDS], dispatch_x);
  atomicStore(
    &mechanics_view[DISPATCH_OFFSET_WORDS + 1u],
    select(0u, 1u, admitted && node_count > 0u)
  );
  atomicStore(
    &mechanics_view[DISPATCH_OFFSET_WORDS + 2u],
    select(0u, 1u, admitted && node_count > 0u)
  );
}
`;

function replaceWgslFunction(source, name, replacement) {
  const marker = `fn ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`missing mechanics-view WGSL function: ${name}`);
  }
  const bodyStart = source.indexOf('{', start + marker.length);
  if (bodyStart < 0) {
    throw new Error(`missing mechanics-view WGSL function body: ${name}`);
  }
  let depth = 0;
  let end = -1;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) {
    throw new Error(`unterminated mechanics-view WGSL function: ${name}`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

function replaceWgslRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`missing mechanics-view WGSL specialization: ${label}`);
  }
  return source.replace(search, replacement);
}

function createSchroederSpatialMechanicsViewV1Wgsl() {
  let source = schroederSpatialMechanicsViewDualWgsl;
  source = source.replace(
    '@group(0) @binding(6) var<storage, read> active_source_view: array<u32>;\n',
    ''
  );
  source = replaceWgslFunction(
    source,
    'active_source_view_admitted',
    `fn active_source_view_admitted() -> bool {
  return false;
}`
  );
  source = replaceWgslFunction(
    source,
    'spatial_directory_v2_admitted',
    `fn spatial_directory_v2_admitted() -> bool {
  return false;
}`
  );
  source = replaceWgslFunction(
    source,
    'spatial_directory_admitted',
    `fn spatial_directory_admitted() -> bool {
  return params.directory_abi_version == SPATIAL_VERSION_V1
    && spatial_directory_v1_admitted();
}`
  );
  source = replaceWgslFunction(
    source,
    'source_work_count',
    `fn source_work_count() -> u32 {
  return params.source_count;
}`
  );
  source = replaceWgslFunction(
    source,
    'physical_source_for_work',
    `fn physical_source_for_work(source_work_index: u32) -> u32 {
  return select(
    ACTIVE_SOURCE_MISSING,
    source_work_index,
    source_work_index < params.source_count
  );
}`
  );
  source = replaceWgslRequired(
    source,
    `  let encoded_cell =
    spatial_directory[particle_to_cell_offset_words + source_index];
  let cell_index = select(
    encoded_cell,
    encoded_cell - 1u,
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
      && encoded_cell > 0u
  );
  if (
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
    && encoded_cell == 0u
  ) {
    return false;
  }`,
    `  let cell_index =
    spatial_directory[particle_to_cell_offset_words + source_index];`,
    'v1 direct reverse lookup'
  );
  source = replaceWgslRequired(
    source,
    `  let dispatch_x = select(
    max(params.direct_dispatch_x, 1u),
    max(active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET], 1u),
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
  );`,
    '  let dispatch_x = max(params.direct_dispatch_x, 1u);',
    'v1 direct dispatch'
  );
  return source;
}

function createSchroederSpatialMechanicsViewV2Wgsl() {
  let source = schroederSpatialMechanicsViewDualWgsl;
  source = replaceWgslFunction(
    source,
    'spatial_directory_v1_admitted',
    `fn spatial_directory_v1_admitted() -> bool {
  return false;
}`
  );
  source = replaceWgslFunction(
    source,
    'spatial_directory_admitted',
    `fn spatial_directory_admitted() -> bool {
  return params.directory_abi_version == SPATIAL_VERSION_V2
    && spatial_directory_v2_admitted();
}`
  );
  source = replaceWgslFunction(
    source,
    'source_work_count',
    `fn source_work_count() -> u32 {
  return select(
    0u,
    active_source_view[18u],
    arrayLength(&active_source_view) >= ACTIVE_SOURCE_HEADER_WORDS
  );
}`
  );
  source = replaceWgslFunction(
    source,
    'physical_source_for_work',
    `fn physical_source_for_work(source_work_index: u32) -> u32 {
  let active_count = source_work_count();
  if (source_work_index >= active_count) {
    return ACTIVE_SOURCE_MISSING;
  }
  let physical_source = active_source_view[
    params.active_to_physical_offset_words + source_work_index
  ];
  if (
    physical_source >= params.source_count
    || active_source_view[
      params.physical_to_active_offset_words + physical_source
    ] != source_work_index
  ) {
    return ACTIVE_SOURCE_MISSING;
  }
  return physical_source;
}`
  );
  source = replaceWgslRequired(
    source,
    `  let encoded_cell =
    spatial_directory[particle_to_cell_offset_words + source_index];
  let cell_index = select(
    encoded_cell,
    encoded_cell - 1u,
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
      && encoded_cell > 0u
  );
  if (
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
    && encoded_cell == 0u
  ) {
    return false;
  }`,
    `  let encoded_cell =
    spatial_directory[particle_to_cell_offset_words + source_index];
  if (encoded_cell == 0u) {
    return false;
  }
  let cell_index = encoded_cell - 1u;`,
    'v2 plus-one reverse lookup'
  );
  source = replaceWgslRequired(
    source,
    `  let dispatch_x = select(
    max(params.direct_dispatch_x, 1u),
    max(active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET], 1u),
    MECHANICS_DIRECTORY_ABI_VERSION == SPATIAL_VERSION_V2
  );`,
    `  let dispatch_x = max(
    active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET],
    1u
  );`,
    'v2 GPU indirect dispatch'
  );
  return source;
}

export const schroederSpatialMechanicsViewWgsl =
  createSchroederSpatialMechanicsViewV1Wgsl();
export const schroederSpatialMechanicsViewV1Wgsl =
  schroederSpatialMechanicsViewWgsl;
export const schroederSpatialMechanicsViewV2Wgsl =
  createSchroederSpatialMechanicsViewV2Wgsl();
