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
  source_row_layout_id: u32,
  logical_count_gpu_authored: u32,
  physical_radix_count: u32,
};

@group(0) @binding(0) var<storage, read> source_rows: array<f32>;
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
const SOURCE_LAYOUT_LEVEL_ASSIGNMENT: u32 = 1u;
const SOURCE_LAYOUT_ACTIVE_NODE: u32 = 2u;
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
  if (params.logical_count_gpu_authored != 0u) {
    return false;
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

fn count_contract_ready() -> bool {
  return params.logical_count_gpu_authored <= 1u
    && params.physical_radix_count <= params.source_capacity
    && params.source_count <= params.physical_radix_count
    && (
      params.logical_count_gpu_authored != 0u
      || params.source_count == params.physical_radix_count
    );
}

fn effective_source_count() -> u32 {
  return select(0u, params.source_count, count_contract_ready());
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
  if (source_index >= params.physical_radix_count) {
    return;
  }
  // A caller may copy a GPU-authored logical count into params.source_count
  // after the host packs the capacity plan. The retained radix primitive still
  // sorts the fixed capacity, so the inactive suffix must receive one maximal
  // sentinel key without being counted as an invalid source.
  if (!count_contract_ready() || source_index >= effective_source_count()) {
    write_invalid_keys(source_index);
    return;
  }
  let row = source_index * ACTIVE_NODE_STRIDE;
  let source_layout = params.source_row_layout_id;
  let level_f = source_rows[row + 0u];
  var native_spacing = 0.0;
  var source_particle_f = f32(source_index);
  var status_f = 0.0;
  if (source_layout == SOURCE_LAYOUT_LEVEL_ASSIGNMENT) {
    native_spacing = source_rows[row + 1u];
    status_f = source_rows[row + 10u];
  } else if (source_layout == SOURCE_LAYOUT_ACTIVE_NODE) {
    native_spacing = source_rows[row + 8u];
    source_particle_f = source_rows[row + 10u];
    status_f = source_rows[row + 11u];
  } else {
    write_invalid_keys(source_index);
    atomicAdd(&epoch_evidence[0], 1u);
    return;
  }
  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let chart_f = source_rows[row + 15u];

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
  source_row_layout_id: u32,
  logical_count_gpu_authored: u32,
  physical_radix_count: u32,
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
  if (params.logical_count_gpu_authored != 0u) {
    return false;
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

fn count_contract_ready() -> bool {
  return params.logical_count_gpu_authored <= 1u
    && params.physical_radix_count <= params.source_capacity
    && params.source_count <= params.physical_radix_count
    && (
      params.logical_count_gpu_authored != 0u
      || params.source_count == params.physical_radix_count
    );
}

fn effective_source_count() -> u32 {
  return select(0u, params.source_count, count_contract_ready());
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

fn admitted_unique_count(primitive_unique_count: u32) -> u32 {
  if (!count_contract_ready() || params.source_count == 0u) {
    return 0u;
  }
  if (
    params.logical_count_gpu_authored == 0u
    || params.source_count == params.physical_radix_count
  ) {
    return primitive_unique_count;
  }
  // Stable radix ordering places the all-ones inactive suffix after every
  // admitted spatial key. The exclusive head prefix at the first suffix row
  // is therefore the exact number of live unique cells.
  return sorted_group_indices[params.source_count];
}

@compute @workgroup_size(64)
fn assemble_directory(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * params.assemble_dispatch_x;
  let sorted_position = linear_group * 64u + local_id.x;
  let live_source_count = effective_source_count();
  let unique_count = admitted_unique_count(unique_evidence[2]);
  if (sorted_position < unique_count && sorted_position < params.cell_capacity) {
    directory[params.cell_offsets_offset_words + sorted_position] =
      unique_offsets[sorted_position];
  } else if (
    sorted_position == unique_count
    && sorted_position <= params.cell_capacity
  ) {
    // The primitive's terminal offset includes the inactive sentinel suffix.
    // Seal the logical CSR boundary explicitly, including the legitimate
    // maximal-key case where the suffix shares the final live key group.
    directory[params.cell_offsets_offset_words + sorted_position] =
      live_source_count;
  }
  if (sorted_position >= live_source_count) {
    return;
  }
  let source_index = sorted_indices[sorted_position];
  var inclusive_head_count = unique_count;
  if (sorted_position + 1u < live_source_count) {
    inclusive_head_count = sorted_group_indices[sorted_position + 1u];
  }
  if (inclusive_head_count == 0u) {
    atomicAdd(&epoch_evidence[3], 1u);
    return;
  }
  let group_index = inclusive_head_count - 1u;
  if (
    source_index >= live_source_count
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
  let counts_ready = count_contract_ready();
  let live_source_count = effective_source_count();
  let primitive_generation = unique_evidence[0];
  let primitive_input_count = unique_evidence[1];
  let primitive_unique_count = unique_evidence[2];
  let logical_unique_count = admitted_unique_count(primitive_unique_count);
  let primitive_admitted = unique_evidence[3];
  let primitive_overflow = unique_evidence[4];
  let primitive_status = unique_evidence[7];
  let invalid_source_count = atomicLoad(&epoch_evidence[0])
    + atomicLoad(&epoch_evidence[1]);
  let assembly_overflow = atomicLoad(&epoch_evidence[3]);
  var cell_overflow = 0u;
  if (logical_unique_count > params.cell_capacity) {
    cell_overflow = logical_unique_count - params.cell_capacity;
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
    && counts_ready
    && primitive_input_count == params.physical_radix_count
    && logical_unique_count <= live_source_count
    && primitive_unique_count <= params.physical_radix_count
    && sort_mode_ready
    && unique_evidence[5] == params.sort_key_word_count
    && unique_evidence[6] == params.sort_key_word_count;
  let overflow_free = primitive_overflow == 0u
    && assembly_overflow == 0u
    && logical_unique_count <= params.cell_capacity
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
    (live_source_count == 0u
      || (occupied_level_mask_low | occupied_level_mask_high) != 0u)
    && (occupied_level_mask_low & ~allowed_level_mask_low) == 0u
    && (occupied_level_mask_high & ~allowed_level_mask_high) == 0u
  );
  let admitted = primitive_ready
    && invalid_source_count == 0u
    && overflow_free
    && emitted_count == live_source_count
    && exact_near_query_profile_ready()
    && occupied_level_mask_ready;
  let live_required_words = params.header_words
    + logical_unique_count * EXACT_KEY_WORDS
    + logical_unique_count + 1u
    + live_source_count * 2u
    + select(0u, QUERY_EVIDENCE_WORDS, has_query_evidence);
  let query_evidence_offset_words = params.particle_to_cell_offset_words
    + params.physical_radix_count;
  let live_physical_high_water_words = max(
    max(
      select(
        params.header_words,
        params.cell_keys_offset_words + logical_unique_count * EXACT_KEY_WORDS,
        logical_unique_count > 0u
      ),
      params.cell_offsets_offset_words + logical_unique_count + 1u
    ),
    max(
      select(
        params.header_words,
        params.cell_members_offset_words + live_source_count,
        live_source_count > 0u
      ),
      max(
        select(
          params.header_words,
          params.particle_to_cell_offset_words + live_source_count,
          live_source_count > 0u
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

  let admitted_cell_count = select(0u, logical_unique_count, admitted);
  if (logical_unique_count <= params.cell_capacity) {
    directory[params.cell_offsets_offset_words + logical_unique_count] =
      live_source_count;
  }
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
  directory[16] = live_source_count;
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
  // Preserve the established v1 consumer invariants. Raw physical primitive
  // evidence remains in unique_evidence; the authoritative directory exposes
  // the admitted logical source and cell counts.
  directory[37] = live_source_count;
  directory[38] = admitted_cell_count;
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

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`unable to derive Schroeder spatial v2 WGSL: ${label}`);
  }
  return source.replace(search, replacement);
}

function createSchroederSpatialEpochV2KeyWgsl() {
  let source = schroederSpatialEpochKeyWgsl;
  source = replaceRequired(
    source,
    '@group(0) @binding(4) var<uniform> params: SpatialEpochParams;',
    `@group(0) @binding(4) var<uniform> params: SpatialEpochParams;
@group(0) @binding(5) var<storage, read> active_source_view: array<u32>;`,
    'active-source binding'
  );
  source = replaceRequired(
    source,
    'const EXACT_KEY_WORDS: u32 = 5u;',
    `const EXACT_KEY_WORDS: u32 = 5u;
const SOURCE_KEY_WORDS: u32 = 6u;
const SOURCE_KEY_PHYSICAL_WORD: u32 = 5u;
const ACTIVE_SOURCE_MAGIC: u32 = 0x53535631u;
const ACTIVE_SOURCE_VERSION: u32 = 1u;
const ACTIVE_SOURCE_STATUS_EXACT: u32 = 3u;
const ACTIVE_SOURCE_STATUS_REJECTED: u32 = 0xfcu;
const ACTIVE_SOURCE_HEADER_WORDS: u32 = 64u;
const ACTIVE_SOURCE_MISSING: u32 = 0xffffffffu;`,
    'v2 source-key and active-source constants'
  );
  source = replaceRequired(
    source,
    `  if (params.logical_count_gpu_authored != 0u) {
    return false;
  }
`,
    '',
    'v2 GPU count query-profile admission'
  );
  source = replaceRequired(
    source,
    `fn count_contract_ready() -> bool {
  return params.logical_count_gpu_authored <= 1u
    && params.physical_radix_count <= params.source_capacity
    && params.source_count <= params.physical_radix_count
    && (
      params.logical_count_gpu_authored != 0u
      || params.source_count == params.physical_radix_count
    );
}

fn effective_source_count() -> u32 {
  return select(0u, params.source_count, count_contract_ready());
}`,
    `fn active_source_view_admitted() -> bool {
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
  return params.logical_count_gpu_authored == 1u
    && params.physical_radix_count <= params.source_capacity
    && active_source_view[0u] == ACTIVE_SOURCE_MAGIC
    && active_source_view[1u] == ACTIVE_SOURCE_VERSION
    && (status & ACTIVE_SOURCE_STATUS_EXACT) == ACTIVE_SOURCE_STATUS_EXACT
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
    && physical_count <= physical_capacity
    && physical_capacity == params.source_capacity
    && active_count <= active_capacity
    && active_count <= params.physical_radix_count
    && active_capacity == params.physical_radix_count
    && active_capacity <= physical_capacity
    && active_source_view[20u] == physical_count - active_count
    && active_source_view[21u] == 0u
    && active_source_view[22u] == 0u
    && active_source_view[23u] == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && active_source_view[24u] == ACTIVE_NODE_STRIDE
    && active_to_physical == ACTIVE_SOURCE_HEADER_WORDS
    && physical_to_active == active_to_physical + active_capacity
    && capacity_words == physical_to_active + physical_capacity
    && capacity_words <= bound_words
    && active_source_view[29u] == params.build_ordinal
    && active_source_view[30u] == params.build_ordinal
    && active_source_view[33u] == active_count
    && active_source_view[34u] == active_count
    && active_source_view[35u] == active_count
    && active_source_view[36u] <= physical_count
    && active_source_view[43u] == active_count * 27u
    && active_source_view[47u] != 0u;
}

fn effective_source_count() -> u32 {
  return select(0u, active_source_view[18u], active_source_view_admitted());
}

fn physical_source_for_active(active_ordinal: u32) -> u32 {
  let active_count = effective_source_count();
  if (active_ordinal >= active_count) {
    return ACTIVE_SOURCE_MISSING;
  }
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let physical_source = active_source_view[active_to_physical + active_ordinal];
  if (
    physical_source >= params.source_count
    || active_source_view[physical_to_active + physical_source] != active_ordinal
  ) {
    return ACTIVE_SOURCE_MISSING;
  }
  return physical_source;
}`,
    'v2 active-source admission and projection'
  );
  source = replaceRequired(
    source,
    '  let exact_base = source_index * EXACT_KEY_WORDS;',
    '  let exact_base = source_index * SOURCE_KEY_WORDS;',
    'v2 invalid source-key stride'
  );
  source = replaceRequired(
    source,
    `  exact_keys[exact_base + 4u] = 0xffffffffu;
  let sort_base = source_index * params.sort_key_word_count;`,
    `  exact_keys[exact_base + 4u] = 0xffffffffu;
  exact_keys[exact_base + SOURCE_KEY_PHYSICAL_WORD] = ACTIVE_SOURCE_MISSING;
  let sort_base = source_index * params.sort_key_word_count;`,
    'v2 invalid physical identity word'
  );
  source = replaceRequired(
    source,
    `  let linear_group = workgroup_id.x + workgroup_id.y * params.key_dispatch_x;
  let source_index = linear_group * 64u + local_id.x;
  if (source_index >= params.physical_radix_count) {
    return;
  }
  // A caller may copy a GPU-authored logical count into params.source_count
  // after the host packs the capacity plan. The retained radix primitive still
  // sorts the fixed capacity, so the inactive suffix must receive one maximal
  // sentinel key without being counted as an invalid source.
  if (!count_contract_ready() || source_index >= effective_source_count()) {
    write_invalid_keys(source_index);
    return;
  }
  let row = source_index * ACTIVE_NODE_STRIDE;`,
    `  let linear_group = workgroup_id.x + workgroup_id.y * params.key_dispatch_x;
  let active_ordinal = linear_group * 64u + local_id.x;
  let active_count = effective_source_count();
  if (active_ordinal >= active_count) {
    return;
  }
  let source_index = physical_source_for_active(active_ordinal);
  if (source_index == ACTIVE_SOURCE_MISSING) {
    write_invalid_keys(active_ordinal);
    atomicAdd(&epoch_evidence[0], 1u);
    return;
  }
  let row = source_index * ACTIVE_NODE_STRIDE;`,
    'v2 active-ordinal key invocation'
  );
  source = source.replaceAll(
    'write_invalid_keys(source_index);',
    'write_invalid_keys(active_ordinal);'
  );
  source = replaceRequired(
    source,
    '  let exact_base = source_index * EXACT_KEY_WORDS;',
    '  let exact_base = active_ordinal * SOURCE_KEY_WORDS;',
    'v2 admitted source-key stride'
  );
  source = replaceRequired(
    source,
    `  exact_keys[exact_base + 4u] = cell_order.z;

  if (params.sort_mode == SORT_MODE_BOUNDED_ATLAS) {`,
    `  exact_keys[exact_base + 4u] = cell_order.z;
  exact_keys[exact_base + SOURCE_KEY_PHYSICAL_WORD] = source_index;

  if (params.sort_mode == SORT_MODE_BOUNDED_ATLAS) {`,
    'v2 admitted physical identity word'
  );
  source = replaceRequired(
    source,
    '    sort_keys[source_index] = ordinal;',
    '    sort_keys[active_ordinal] = ordinal;',
    'v2 bounded sort index'
  );
  source = replaceRequired(
    source,
    '    let sort_base = source_index * EXACT_KEY_WORDS;',
    '    let sort_base = active_ordinal * EXACT_KEY_WORDS;',
    'v2 lexicographic sort index'
  );
  return source;
}

function createSchroederSpatialEpochV2AssembleWgsl() {
  let source = schroederSpatialEpochAssembleWgsl;
  source = replaceRequired(
    source,
    'const ABI_VERSION: u32 = 1u;',
    `const ABI_VERSION: u32 = 2u;
const SOURCE_KEY_WORDS: u32 = 6u;
const SOURCE_KEY_PHYSICAL_WORD: u32 = 5u;`,
    'v2 directory version and source-key constants'
  );
  source = replaceRequired(
    source,
    `  if (params.logical_count_gpu_authored != 0u) {
    return false;
  }
`,
    '',
    'v2 GPU count query-profile admission'
  );
  source = replaceRequired(
    source,
    `fn count_contract_ready() -> bool {
  return params.logical_count_gpu_authored <= 1u
    && params.physical_radix_count <= params.source_capacity
    && params.source_count <= params.physical_radix_count
    && (
      params.logical_count_gpu_authored != 0u
      || params.source_count == params.physical_radix_count
    );
}

fn effective_source_count() -> u32 {
  return select(0u, params.source_count, count_contract_ready());
}`,
    `fn count_contract_ready() -> bool {
  return params.logical_count_gpu_authored == 1u
    && params.source_row_layout_id == 1u
    && params.source_count <= params.source_capacity
    && params.physical_radix_count <= params.source_capacity;
}

fn effective_source_count() -> u32 {
  let active_count = unique_evidence[1u];
  return select(
    0u,
    active_count,
    count_contract_ready()
      && active_count <= params.physical_radix_count
      && active_count <= params.source_count
  );
}`,
    'v2 active unique-input count contract'
  );
  source = replaceRequired(
    source,
    `fn admitted_unique_count(primitive_unique_count: u32) -> u32 {
  if (!count_contract_ready() || params.source_count == 0u) {
    return 0u;
  }
  if (
    params.logical_count_gpu_authored == 0u
    || params.source_count == params.physical_radix_count
  ) {
    return primitive_unique_count;
  }
  // Stable radix ordering places the all-ones inactive suffix after every
  // admitted spatial key. The exclusive head prefix at the first suffix row
  // is therefore the exact number of live unique cells.
  return sorted_group_indices[params.source_count];
}`,
    `fn admitted_unique_count(primitive_unique_count: u32) -> u32 {
  let active_count = effective_source_count();
  return select(
    0u,
    primitive_unique_count,
    primitive_unique_count <= active_count
      && arrayLength(&sorted_group_indices) >= params.physical_radix_count
  );
}`,
    'v2 unique count admission'
  );
  source = replaceRequired(
    source,
    `  let source_index = sorted_indices[sorted_position];
  var inclusive_head_count = unique_count;`,
    `  let active_ordinal = sorted_indices[sorted_position];
  if (active_ordinal >= live_source_count) {
    atomicAdd(&epoch_evidence[3], 1u);
    return;
  }
  let source_key = active_ordinal * SOURCE_KEY_WORDS;
  let source_index = exact_keys[source_key + SOURCE_KEY_PHYSICAL_WORD];
  var inclusive_head_count = unique_count;`,
    'v2 physical member projection'
  );
  source = replaceRequired(
    source,
    `    source_index >= live_source_count
    || group_index >= unique_count`,
    `    source_index >= params.source_count
    || group_index >= unique_count`,
    'v2 physical member bound'
  );
  source = replaceRequired(
    source,
    '  directory[params.particle_to_cell_offset_words + source_index] = group_index;',
    `  // Zero is the exact dormant/missing sentinel after the runtime clears
  // the retained physical reverse arena.
  directory[params.particle_to_cell_offset_words + source_index] =
    group_index + 1u;`,
    'v2 plus-one physical reverse'
  );
  source = replaceRequired(
    source,
    '    let source_key = source_index * EXACT_KEY_WORDS;\n',
    '',
    'v2 source-key scratch index'
  );
  source = replaceRequired(
    source,
    '      params.cell_keys_offset_words + logical_unique_count * EXACT_KEY_WORDS,\n        logical_unique_count > 0u',
    '      params.cell_keys_offset_words + logical_unique_count * EXACT_KEY_WORDS,\n        logical_unique_count > 0u',
    'v2 cell key high-water anchor'
  );
  source = replaceRequired(
    source,
    `          params.header_words,
          params.particle_to_cell_offset_words + live_source_count,
          live_source_count > 0u`,
    `          params.header_words,
          params.particle_to_cell_offset_words + params.source_count,
          params.source_count > 0u`,
    'v2 physical reverse high-water'
  );
  source = replaceRequired(
    source,
    `    && primitive_input_count == params.physical_radix_count
    && logical_unique_count <= live_source_count
    && primitive_unique_count <= params.physical_radix_count`,
    `    && primitive_input_count == live_source_count
    && logical_unique_count <= live_source_count
    && primitive_unique_count <= live_source_count`,
    'v2 primitive live-count evidence'
  );
  source = replaceRequired(
    source,
    `    + logical_unique_count + 1u
    + live_source_count * 2u`,
    `    + logical_unique_count + 1u
    + live_source_count
    + params.source_count`,
    'v2 logical payload count'
  );
  source = replaceRequired(
    source,
    `  let query_evidence_offset_words = params.particle_to_cell_offset_words
    + params.physical_radix_count;`,
    `  let query_evidence_offset_words = params.particle_to_cell_offset_words
    + params.source_capacity;`,
    'v2 capacity-stable query evidence'
  );
  source = replaceRequired(
    source,
    '  directory[16] = live_source_count;',
    '  directory[16] = params.source_count;',
    'v2 physical source header'
  );
  source = replaceRequired(
    source,
    `  // Preserve the established v1 consumer invariants. Raw physical primitive
  // evidence remains in unique_evidence; the authoritative directory exposes
  // the admitted logical source and cell counts.
  directory[37] = live_source_count;`,
    `  // V2 word 37 is the exact GPU-authored active CSR member count. Word 16
  // remains the stable physical particle identity bound.
  directory[37] = live_source_count;`,
    'v2 active count telemetry'
  );
  return source;
}

export const schroederSpatialEpochV2KeyWgsl =
  createSchroederSpatialEpochV2KeyWgsl();
export const schroederSpatialEpochV2AssembleWgsl =
  createSchroederSpatialEpochV2AssembleWgsl();
