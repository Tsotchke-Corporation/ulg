export const schroederSpatialEpochKeyWgsl = /* wgsl */ `
struct SpatialEpochParams {
  source_count: u32,
  source_capacity: u32,
  cell_capacity: u32,
  sort_key_word_count: u32,
  sort_mode: u32,
  generation_id: u32,
  device_ordinal: u32,
  lane_ordinal: u32,
  source_family_id: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
  lease_token: u32,
  build_ordinal: u32,
  sort_unique_ordinal: u32,
  chart_min: u32,
  chart_count: u32,
  level_min: i32,
  level_count: u32,
  cell_min_x: i32,
  cell_count_x: u32,
  cell_min_y: i32,
  cell_count_y: u32,
  cell_min_z: i32,
  cell_count_z: u32,
  header_words: u32,
  cell_keys_offset_words: u32,
  cell_offsets_offset_words: u32,
  cell_members_offset_words: u32,
  particle_to_cell_offset_words: u32,
  directory_capacity_words: u32,
  required_capacity_words: u32,
  key_dispatch_x: u32,
  assemble_dispatch_x: u32,
  consumer_dispatch_x_limit: u32,
  query_geometry_mode: u32,
  query_chart_id: u32,
  query_min_level: i32,
  query_max_level: i32,
  query_base_grid_spacing_m: f32,
  query_pad_0: u32,
  query_pad_1: u32,
  query_pad_2: u32,
};

@group(0) @binding(0) var<storage, read> active_node_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> exact_keys: array<u32>;
@group(0) @binding(2) var<storage, read_write> sort_keys: array<u32>;
@group(0) @binding(3) var<storage, read_write> epoch_evidence: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: SpatialEpochParams;

const ACTIVE_NODE_STRIDE: u32 = 16u;
const EXACT_KEY_WORDS: u32 = 5u;
const SORT_MODE_BOUNDED_ATLAS: u32 = 1u;
const SORT_MODE_LEXICOGRAPHIC: u32 = 2u;
const QUERY_GEOMETRY_GENERIC: u32 = 0u;
const QUERY_GEOMETRY_SINGLE_CHART_POW2: u32 = 1u;
const MAX_EXACT_F32_INTEGER: f32 = 16777215.0;
const MIN_SAFE_I32_F32: f32 = -2147483520.0;
const MAX_SAFE_I32_F32: f32 = 2147483520.0;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn integral_f32(value: f32) -> bool {
  return finite_f32(value) && value == trunc(value);
}

fn safe_i32_f32(value: f32) -> bool {
  return finite_f32(value)
    && value >= MIN_SAFE_I32_F32
    && value <= MAX_SAFE_I32_F32;
}

fn signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn exact_near_query_profile_ready() -> bool {
  if (params.query_geometry_mode == QUERY_GEOMETRY_GENERIC) {
    return true;
  }
  if (params.query_geometry_mode != QUERY_GEOMETRY_SINGLE_CHART_POW2) {
    return false;
  }
  let min_order = signed_order_key(params.query_min_level);
  let max_order = signed_order_key(params.query_max_level);
  if (max_order < min_order || max_order - min_order >= 64u) {
    return false;
  }
  let min_spacing = params.query_base_grid_spacing_m
    * exp2(f32(params.query_min_level));
  let max_spacing = params.query_base_grid_spacing_m
    * exp2(f32(params.query_max_level));
  return params.query_chart_id <= 0x00ffffffu
    && finite_f32(params.query_base_grid_spacing_m)
    && params.query_base_grid_spacing_m > 0.0
    && finite_f32(min_spacing)
    && min_spacing >= 0.000001
    && finite_f32(max_spacing)
    && max_spacing > 0.0;
}

fn write_invalid_keys(source_index: u32) {
  let exact_base = source_index * EXACT_KEY_WORDS;
  exact_keys[exact_base + 0u] = 0xffffffffu;
  exact_keys[exact_base + 1u] = 0xffffffffu;
  exact_keys[exact_base + 2u] = 0xffffffffu;
  exact_keys[exact_base + 3u] = 0xffffffffu;
  exact_keys[exact_base + 4u] = 0xffffffffu;
  let sort_base = source_index * params.sort_key_word_count;
  for (var word = 0u; word < params.sort_key_word_count; word = word + 1u) {
    sort_keys[sort_base + word] = 0xffffffffu;
  }
}

@compute @workgroup_size(64)
fn emit_spatial_keys(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * params.key_dispatch_x;
  let source_index = linear_group * 64u + local_id.x;
  if (source_index >= params.source_count) {
    return;
  }
  let row = source_index * ACTIVE_NODE_STRIDE;
  let level_f = active_node_rows[row + 0u];
  let native_spacing = active_node_rows[row + 8u];
  let source_particle_f = active_node_rows[row + 10u];
  let status_f = active_node_rows[row + 11u];
  let position = vec3<f32>(
    active_node_rows[row + 12u],
    active_node_rows[row + 13u],
    active_node_rows[row + 14u]
  );
  let chart_f = active_node_rows[row + 15u];

  let fields_valid = integral_f32(level_f)
    && integral_f32(source_particle_f)
    && integral_f32(chart_f)
    && integral_f32(status_f)
    && status_f >= 0.0
    && status_f <= 255.0
    && finite_f32(native_spacing)
    && native_spacing > 0.0
    && all(vec3<bool>(
      finite_f32(position.x),
      finite_f32(position.y),
      finite_f32(position.z)
    ));
  if (!fields_valid) {
    write_invalid_keys(source_index);
    atomicAdd(&epoch_evidence[0], 1u);
    return;
  }
  var row_admitted = source_particle_f == f32(source_index)
    && source_index <= 16777215u
    // Low five bits carry the base assignment status. Bit 6 records an
    // admitted phase-volume overlay; bit 7 records a rejected/torn overlay.
    // The generic directory can consume admitted per-row native spacing, but
    // must fail closed on a rejected overlay.
    && (u32(round(status_f)) & 31u) > 0u
    && (u32(round(status_f)) & 128u) == 0u
    && chart_f >= 0.0
    && chart_f <= MAX_EXACT_F32_INTEGER
    && level_f >= MIN_SAFE_I32_F32
    && level_f <= MAX_SAFE_I32_F32;
  if (row_admitted && params.query_geometry_mode == QUERY_GEOMETRY_SINGLE_CHART_POW2) {
    let row_chart = u32(round(chart_f));
    let row_level = i32(round(level_f));
    let row_level_order = signed_order_key(row_level);
    let query_min_order = signed_order_key(params.query_min_level);
    let query_max_order = signed_order_key(params.query_max_level);
    let expected_spacing = params.query_base_grid_spacing_m * exp2(f32(row_level));
    row_admitted = exact_near_query_profile_ready()
      && row_chart == params.query_chart_id
      && row_level_order >= query_min_order
      && row_level_order <= query_max_order
      && bitcast<u32>(native_spacing) == bitcast<u32>(expected_spacing)
      && (u32(round(status_f)) & 64u) == 0u;
  } else if (row_admitted && params.query_geometry_mode != QUERY_GEOMETRY_GENERIC) {
    row_admitted = false;
  }
  if (!row_admitted) {
    write_invalid_keys(source_index);
    atomicAdd(&epoch_evidence[0], 1u);
    return;
  }

  let cell_f = floor(position / native_spacing);
  let cell_valid = safe_i32_f32(cell_f.x)
    && safe_i32_f32(cell_f.y)
    && safe_i32_f32(cell_f.z);
  if (!cell_valid) {
    write_invalid_keys(source_index);
    atomicAdd(&epoch_evidence[0], 1u);
    return;
  }

  let chart = u32(round(chart_f));
  let level = i32(round(level_f));
  let cell = vec3<i32>(cell_f);
  let level_order = signed_order_key(level);
  let cell_order = vec3<u32>(
    signed_order_key(cell.x),
    signed_order_key(cell.y),
    signed_order_key(cell.z)
  );
  let exact_base = source_index * EXACT_KEY_WORDS;
  exact_keys[exact_base + 0u] = chart;
  exact_keys[exact_base + 1u] = level_order;
  exact_keys[exact_base + 2u] = cell_order.x;
  exact_keys[exact_base + 3u] = cell_order.y;
  exact_keys[exact_base + 4u] = cell_order.z;

  if (params.sort_mode == SORT_MODE_BOUNDED_ATLAS) {
    let chart_offset = chart - params.chart_min;
    let chart_in = chart >= params.chart_min
      && chart_offset < params.chart_count;
    let level_min_order = signed_order_key(params.level_min);
    let cell_min_order = vec3<u32>(
      signed_order_key(params.cell_min_x),
      signed_order_key(params.cell_min_y),
      signed_order_key(params.cell_min_z)
    );
    let level_offset = level_order - level_min_order;
    let cell_offset = cell_order - cell_min_order;
    let level_in = level_order >= level_min_order
      && level_offset < params.level_count;
    let x_in = cell_order.x >= cell_min_order.x
      && cell_offset.x < params.cell_count_x;
    let y_in = cell_order.y >= cell_min_order.y
      && cell_offset.y < params.cell_count_y;
    let z_in = cell_order.z >= cell_min_order.z
      && cell_offset.z < params.cell_count_z;
    if (!(chart_in && level_in && x_in && y_in && z_in)) {
      write_invalid_keys(source_index);
      atomicAdd(&epoch_evidence[1], 1u);
      return;
    }
    var ordinal = chart_offset;
    ordinal = ordinal * params.level_count + level_offset;
    ordinal = ordinal * params.cell_count_x + cell_offset.x;
    ordinal = ordinal * params.cell_count_y + cell_offset.y;
    ordinal = ordinal * params.cell_count_z + cell_offset.z;
    sort_keys[source_index] = ordinal;
  } else if (params.sort_mode == SORT_MODE_LEXICOGRAPHIC) {
    let sort_base = source_index * EXACT_KEY_WORDS;
    for (var word = 0u; word < EXACT_KEY_WORDS; word = word + 1u) {
      sort_keys[sort_base + word] = exact_keys[exact_base + word];
    }
  } else {
    write_invalid_keys(source_index);
    atomicAdd(&epoch_evidence[0], 1u);
    return;
  }
  atomicAdd(&epoch_evidence[2], 1u);
}
`;

export const schroederSpatialEpochAssembleWgsl = /* wgsl */ `
struct SpatialEpochParams {
  source_count: u32,
  source_capacity: u32,
  cell_capacity: u32,
  sort_key_word_count: u32,
  sort_mode: u32,
  generation_id: u32,
  device_ordinal: u32,
  lane_ordinal: u32,
  source_family_id: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
  lease_token: u32,
  build_ordinal: u32,
  sort_unique_ordinal: u32,
  chart_min: u32,
  chart_count: u32,
  level_min: i32,
  level_count: u32,
  cell_min_x: i32,
  cell_count_x: u32,
  cell_min_y: i32,
  cell_count_y: u32,
  cell_min_z: i32,
  cell_count_z: u32,
  header_words: u32,
  cell_keys_offset_words: u32,
  cell_offsets_offset_words: u32,
  cell_members_offset_words: u32,
  particle_to_cell_offset_words: u32,
  directory_capacity_words: u32,
  required_capacity_words: u32,
  key_dispatch_x: u32,
  assemble_dispatch_x: u32,
  consumer_dispatch_x_limit: u32,
  query_geometry_mode: u32,
  query_chart_id: u32,
  query_min_level: i32,
  query_max_level: i32,
  query_base_grid_spacing_m: f32,
  query_pad_0: u32,
  query_pad_1: u32,
  query_pad_2: u32,
};

@group(0) @binding(0) var<storage, read> exact_keys: array<u32>;
@group(0) @binding(1) var<storage, read> sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read> sorted_group_indices: array<u32>;
@group(0) @binding(3) var<storage, read> unique_offsets: array<u32>;
@group(0) @binding(4) var<storage, read> unique_evidence: array<u32>;
@group(0) @binding(5) var<storage, read_write> epoch_evidence: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> directory: array<u32>;
@group(0) @binding(7) var<storage, read_write> consumer_dispatch: array<u32>;
@group(0) @binding(8) var<uniform> params: SpatialEpochParams;

const MAGIC: u32 = 0x53534531u;
const ABI_VERSION: u32 = 1u;
const EXACT_KEY_WORDS: u32 = 5u;
const STATUS_READY: u32 = 1u;
const STATUS_ADMITTED: u32 = 2u;
const STATUS_FAIL_CLOSED: u32 = 4u;
const STATUS_INVALID_SOURCE: u32 = 8u;
const STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const PRIMITIVE_STATUS_READY: u32 = 1u;
const PRIMITIVE_STATUS_FAIL_CLOSED: u32 = 4u;
const SOURCE_ADAPTER_ACTIVE_NODE_ROWS: u32 = 1u;
const SOURCE_ADAPTER_EXACT_NEAR_QUERY: u32 = 2u;
const QUERY_GEOMETRY_GENERIC: u32 = 0u;
const QUERY_GEOMETRY_SINGLE_CHART_POW2: u32 = 1u;
const QUERY_EVIDENCE_WORDS: u32 = 6u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn exact_near_query_profile_ready() -> bool {
  if (params.query_geometry_mode == QUERY_GEOMETRY_GENERIC) {
    return true;
  }
  if (params.query_geometry_mode != QUERY_GEOMETRY_SINGLE_CHART_POW2) {
    return false;
  }
  let min_order = signed_order_key(params.query_min_level);
  let max_order = signed_order_key(params.query_max_level);
  if (max_order < min_order || max_order - min_order >= 64u) {
    return false;
  }
  let min_spacing = params.query_base_grid_spacing_m
    * exp2(f32(params.query_min_level));
  let max_spacing = params.query_base_grid_spacing_m
    * exp2(f32(params.query_max_level));
  return params.query_chart_id <= 0x00ffffffu
    && finite_f32(params.query_base_grid_spacing_m)
    && params.query_base_grid_spacing_m > 0.0
    && finite_f32(min_spacing)
    && min_spacing >= 0.000001
    && finite_f32(max_spacing)
    && max_spacing > 0.0;
}

fn saturating_add_u32(left: u32, right: u32) -> u32 {
  if (right > 0xffffffffu - left) {
    return 0xffffffffu;
  }
  return left + right;
}

fn low_bits_mask(bit_count: u32) -> u32 {
  if (bit_count == 0u) { return 0u; }
  if (bit_count >= 32u) { return 0xffffffffu; }
  return (1u << bit_count) - 1u;
}

@compute @workgroup_size(64)
fn assemble_directory(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * params.assemble_dispatch_x;
  let sorted_position = linear_group * 64u + local_id.x;
  let unique_count = unique_evidence[2];
  if (sorted_position <= unique_count && sorted_position <= params.cell_capacity) {
    directory[params.cell_offsets_offset_words + sorted_position] =
      unique_offsets[sorted_position];
  }
  if (sorted_position >= params.source_count) {
    return;
  }
  let source_index = sorted_indices[sorted_position];
  var inclusive_head_count = unique_count;
  if (sorted_position + 1u < params.source_count) {
    inclusive_head_count = sorted_group_indices[sorted_position + 1u];
  }
  if (inclusive_head_count == 0u) {
    atomicAdd(&epoch_evidence[3], 1u);
    return;
  }
  let group_index = inclusive_head_count - 1u;
  if (
    source_index >= params.source_count
    || group_index >= unique_count
    || group_index >= params.cell_capacity
  ) {
    atomicAdd(&epoch_evidence[3], 1u);
    return;
  }
  directory[params.cell_members_offset_words + sorted_position] = source_index;
  directory[params.particle_to_cell_offset_words + source_index] = group_index;
  let is_head = sorted_position == unique_offsets[group_index];
  if (is_head) {
    let source_key = source_index * EXACT_KEY_WORDS;
    let target_key = params.cell_keys_offset_words + group_index * EXACT_KEY_WORDS;
    for (var word = 0u; word < EXACT_KEY_WORDS; word = word + 1u) {
      directory[target_key + word] = exact_keys[source_key + word];
    }
    if (params.query_geometry_mode == QUERY_GEOMETRY_SINGLE_CHART_POW2) {
      let level_order = exact_keys[source_key + 1u];
      let query_min_order = signed_order_key(params.query_min_level);
      let query_max_order = signed_order_key(params.query_max_level);
      let query_level_count = query_max_order - query_min_order + 1u;
      let level_ordinal = level_order - query_min_order;
      if (
        level_order < query_min_order
        || level_order > query_max_order
        || level_ordinal >= query_level_count
        || level_ordinal >= 64u
      ) {
        atomicAdd(&epoch_evidence[3], 1u);
      } else if (level_ordinal < 32u) {
        atomicOr(&epoch_evidence[4], 1u << level_ordinal);
      } else {
        atomicOr(&epoch_evidence[5], 1u << (level_ordinal - 32u));
      }
    }
  }
}

@compute @workgroup_size(1)
fn finalize_directory() {
  let primitive_generation = unique_evidence[0];
  let primitive_input_count = unique_evidence[1];
  let primitive_unique_count = unique_evidence[2];
  let primitive_admitted = unique_evidence[3];
  let primitive_overflow = unique_evidence[4];
  let primitive_status = unique_evidence[7];
  let invalid_source_count = atomicLoad(&epoch_evidence[0])
    + atomicLoad(&epoch_evidence[1]);
  let assembly_overflow = atomicLoad(&epoch_evidence[3]);
  var cell_overflow = 0u;
  if (primitive_unique_count > params.cell_capacity) {
    cell_overflow = primitive_unique_count - params.cell_capacity;
  }
  let directory_capacity_ready = params.directory_capacity_words
    >= params.required_capacity_words;
  let primitive_overflow_count = select(0u, 1u, primitive_overflow != 0u);
  let directory_overflow_count = select(0u, 1u, !directory_capacity_ready);
  let overflow_count = saturating_add_u32(
    saturating_add_u32(
      saturating_add_u32(primitive_overflow_count, assembly_overflow),
      cell_overflow
    ),
    directory_overflow_count
  );
  let emitted_count = atomicLoad(&epoch_evidence[2]);
  let sort_mode_ready = (
    params.sort_mode == 1u
    && params.sort_key_word_count == 1u
  ) || (
    params.sort_mode == 2u
    && params.sort_key_word_count == EXACT_KEY_WORDS
  );
  let primitive_ready = primitive_admitted != 0u
    && (primitive_status & PRIMITIVE_STATUS_READY) != 0u
    && (primitive_status & PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && primitive_overflow == 0u
    && primitive_generation == params.generation_id
    && primitive_input_count == params.source_count
    && primitive_unique_count <= params.source_count
    && sort_mode_ready
    && unique_evidence[5] == params.sort_key_word_count
    && unique_evidence[6] == params.sort_key_word_count;
  let overflow_free = primitive_overflow == 0u
    && assembly_overflow == 0u
    && primitive_unique_count <= params.cell_capacity
    && directory_capacity_ready;
  let has_query_evidence =
    params.query_geometry_mode == QUERY_GEOMETRY_SINGLE_CHART_POW2;
  let query_level_count = select(
    0u,
    signed_order_key(params.query_max_level)
      - signed_order_key(params.query_min_level) + 1u,
    has_query_evidence
  );
  let occupied_level_mask_low = atomicLoad(&epoch_evidence[4]);
  let occupied_level_mask_high = atomicLoad(&epoch_evidence[5]);
  let allowed_level_mask_low = low_bits_mask(min(query_level_count, 32u));
  let allowed_level_mask_high = low_bits_mask(
    select(0u, query_level_count - 32u, query_level_count > 32u)
  );
  let occupied_level_mask_ready = !has_query_evidence || (
    (occupied_level_mask_low | occupied_level_mask_high) != 0u
    && (occupied_level_mask_low & ~allowed_level_mask_low) == 0u
    && (occupied_level_mask_high & ~allowed_level_mask_high) == 0u
  );
  let admitted = primitive_ready
    && invalid_source_count == 0u
    && overflow_free
    && emitted_count == params.source_count
    && exact_near_query_profile_ready()
    && occupied_level_mask_ready;
  let live_required_words = params.header_words
    + primitive_unique_count * EXACT_KEY_WORDS
    + primitive_unique_count + 1u
    + params.source_count * 2u
    + select(0u, QUERY_EVIDENCE_WORDS, has_query_evidence);
  let query_evidence_offset_words = params.particle_to_cell_offset_words
    + params.source_count;
  let live_physical_high_water_words = max(
    max(
      select(
        params.header_words,
        params.cell_keys_offset_words + primitive_unique_count * EXACT_KEY_WORDS,
        primitive_unique_count > 0u
      ),
      params.cell_offsets_offset_words + primitive_unique_count + 1u
    ),
    max(
      select(
        params.header_words,
        params.cell_members_offset_words + params.source_count,
        params.source_count > 0u
      ),
      max(
        select(
          params.header_words,
          params.particle_to_cell_offset_words + params.source_count,
          params.source_count > 0u
        ),
        select(
          params.header_words,
          query_evidence_offset_words + QUERY_EVIDENCE_WORDS,
          has_query_evidence
        )
      )
    )
  );

  var status = STATUS_READY;
  if (admitted) {
    status = status | STATUS_ADMITTED;
  } else {
    status = status | STATUS_FAIL_CLOSED;
  }
  if (invalid_source_count != 0u) {
    status = status | STATUS_INVALID_SOURCE;
  }
  if (!overflow_free) {
    status = status | STATUS_CAPACITY_OVERFLOW;
  }

  let admitted_cell_count = select(0u, primitive_unique_count, admitted);
  let dispatch_group_count = (admitted_cell_count + 63u) / 64u;
  let dispatch_x_limit = max(params.consumer_dispatch_x_limit, 1u);
  let has_consumer_work = admitted && admitted_cell_count > 0u;
  let dispatch_x = select(
    0u,
    min(dispatch_group_count, dispatch_x_limit),
    has_consumer_work
  );
  let dispatch_y = select(
    0u,
    (dispatch_group_count + dispatch_x_limit - 1u) / dispatch_x_limit,
    has_consumer_work
  );
  consumer_dispatch[0] = dispatch_x;
  consumer_dispatch[1] = dispatch_y;
  consumer_dispatch[2] = select(0u, 1u, has_consumer_work);

  if (has_query_evidence) {
    directory[query_evidence_offset_words + 0u] = params.query_chart_id;
    directory[query_evidence_offset_words + 1u] = bitcast<u32>(params.query_min_level);
    directory[query_evidence_offset_words + 2u] = bitcast<u32>(params.query_max_level);
    directory[query_evidence_offset_words + 3u] =
      bitcast<u32>(params.query_base_grid_spacing_m);
    directory[query_evidence_offset_words + 4u] = occupied_level_mask_low;
    directory[query_evidence_offset_words + 5u] = occupied_level_mask_high;
  }
  // Words 4-5 are temporally borrowed while the directory is assembled, then
  // returned to the mechanics evidence ABI before any consumer dispatch.
  atomicStore(&epoch_evidence[4], 0u);
  atomicStore(&epoch_evidence[5], 0u);

  directory[0] = MAGIC;
  directory[1] = ABI_VERSION;
  directory[2] = status;
  directory[3] = params.generation_id;
  directory[4] = params.device_ordinal;
  directory[5] = params.lane_ordinal;
  directory[6] = params.lease_token;
  directory[7] = params.source_family_id;
  directory[8] = params.storage_generation;
  directory[9] = params.physics_tick;
  directory[10] = params.physics_substep;
  directory[11] = params.position_epoch;
  directory[12] = params.topology_epoch;
  directory[13] = params.chart_epoch;
  directory[14] = params.level_epoch;
  directory[15] = params.support_epoch;
  directory[16] = params.source_count;
  directory[17] = params.source_capacity;
  directory[18] = admitted_cell_count;
  directory[19] = params.cell_capacity;
  directory[20] = live_required_words;
  directory[21] = select(0u, live_required_words, admitted);
  directory[22] = params.directory_capacity_words;
  directory[23] = invalid_source_count;
  directory[24] = overflow_count;
  directory[25] = EXACT_KEY_WORDS;
  directory[26] = params.sort_key_word_count;
  directory[27] = params.sort_mode;
  directory[28] = params.header_words;
  directory[29] = params.cell_keys_offset_words;
  directory[30] = params.cell_offsets_offset_words;
  directory[31] = params.cell_members_offset_words;
  directory[32] = params.particle_to_cell_offset_words;
  directory[33] = params.build_ordinal;
  directory[34] = params.sort_unique_ordinal;
  directory[35] = select(0u, params.build_ordinal, admitted);
  directory[36] = primitive_generation;
  directory[37] = primitive_input_count;
  directory[38] = primitive_unique_count;
  directory[39] = primitive_admitted;
  directory[40] = primitive_overflow;
  directory[41] = primitive_status;
  directory[42] = consumer_dispatch[0];
  directory[43] = consumer_dispatch[1];
  directory[44] = consumer_dispatch[2];
  // Spatial evidence/header/dispatch clears 55 words. The retained radix/
  // unique primitive additionally clears 8 evidence, 3 dispatch, and the
  // first unique-offset word, for 67 total cleared words per encoded epoch.
  directory[45] = params.header_words + 4u + 3u + 8u + 3u + 1u;
  directory[46] = select(
    SOURCE_ADAPTER_ACTIVE_NODE_ROWS,
    SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    has_query_evidence
  );
  directory[47] = select(
    params.directory_capacity_words,
    live_physical_high_water_words,
    admitted
  );
}
`;
