// Pressure/contact is the first staged exact-near consumer of
// ss-spatial-epoch.v1. It is intentionally separate from legacy particle bins
// and fixed candidate rows: the canonical view needs one directory binding and
// remains within WebGPU's portable eight-storage-buffer limit.
export const sphPressureInterfaceSpatialExactNearContactKinematicsWgsl = /* wgsl */ `
struct SpatialExactNearContactParams {
  element_count: u32,
  particle_count: u32,
  contact_policy_row_count: u32,
  derivation_enabled: u32,
  chart_id: u32,
  level_count: u32,
  expected_generation_id: u32,
  expected_device_ordinal: u32,
  expected_lane_ordinal: u32,
  expected_lease_token: u32,
  expected_source_family_id: u32,
  expected_storage_generation: u32,
  expected_physics_tick: u32,
  expected_physics_substep: u32,
  expected_position_epoch: u32,
  expected_topology_epoch: u32,
  expected_chart_epoch: u32,
  expected_level_epoch: u32,
  expected_support_epoch: u32,
  min_level: i32,
  base_grid_spacing_m: f32,
  max_search_radius_m: f32,
  gap_floor_m: f32,
  _reserved0: f32,
  expected_cell_keys_offset_words: u32,
  expected_cell_offsets_offset_words: u32,
  expected_cell_members_offset_words: u32,
  expected_particle_to_cell_offset_words: u32,
  expected_directory_capacity_words: u32,
  expected_source_capacity: u32,
  expected_cell_capacity: u32,
  _reserved1: u32,
};

@group(0) @binding(0) var<storage, read> interface_elements: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> particle_state_rows: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> particle_thermo_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> contact_policy_rows: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> contact_kinematics_rows: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: SpatialExactNearContactParams;
@group(0) @binding(6) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(7) var<storage, read> particle_identity: array<u32>;

const SPATIAL_MAGIC: u32 = 0x53534531u;
const SPATIAL_ABI_VERSION: u32 = 1u;
const SPATIAL_STATUS_READY: u32 = 1u;
const SPATIAL_STATUS_ADMITTED: u32 = 2u;
const SPATIAL_STATUS_FAIL_CLOSED: u32 = 4u;
const SPATIAL_STATUS_INVALID_SOURCE: u32 = 8u;
const SPATIAL_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const SPATIAL_PRIMITIVE_STATUS_READY: u32 = 1u;
const SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED: u32 = 4u;
const SPATIAL_EXACT_KEY_WORDS: u32 = 5u;
const SPATIAL_HEADER_WORDS: u32 = 48u;
const SPATIAL_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;
const SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY: u32 = 2u;
const SPATIAL_QUERY_EVIDENCE_WORDS: u32 = 4u;
const SPATIAL_HEADER_MAGIC: u32 = 0u;
const SPATIAL_HEADER_VERSION: u32 = 1u;
const SPATIAL_HEADER_STATUS: u32 = 2u;
const SPATIAL_HEADER_GENERATION: u32 = 3u;
const SPATIAL_HEADER_DEVICE_ORDINAL: u32 = 4u;
const SPATIAL_HEADER_LANE_ORDINAL: u32 = 5u;
const SPATIAL_HEADER_LEASE_TOKEN: u32 = 6u;
const SPATIAL_HEADER_SOURCE_FAMILY: u32 = 7u;
const SPATIAL_HEADER_STORAGE_GENERATION: u32 = 8u;
const SPATIAL_HEADER_PHYSICS_TICK: u32 = 9u;
const SPATIAL_HEADER_PHYSICS_SUBSTEP: u32 = 10u;
const SPATIAL_HEADER_POSITION_EPOCH: u32 = 11u;
const SPATIAL_HEADER_TOPOLOGY_EPOCH: u32 = 12u;
const SPATIAL_HEADER_CHART_EPOCH: u32 = 13u;
const SPATIAL_HEADER_LEVEL_EPOCH: u32 = 14u;
const SPATIAL_HEADER_SUPPORT_EPOCH: u32 = 15u;
const SPATIAL_HEADER_SOURCE_COUNT: u32 = 16u;
const SPATIAL_HEADER_SOURCE_CAPACITY: u32 = 17u;
const SPATIAL_HEADER_CELL_COUNT: u32 = 18u;
const SPATIAL_HEADER_CELL_CAPACITY: u32 = 19u;
const SPATIAL_HEADER_LOGICAL_REQUIRED_WORDS: u32 = 20u;
const SPATIAL_HEADER_LOGICAL_ADMITTED_WORDS: u32 = 21u;
const SPATIAL_HEADER_DIRECTORY_CAPACITY: u32 = 22u;
const SPATIAL_HEADER_INVALID_SOURCE_COUNT: u32 = 23u;
const SPATIAL_HEADER_OVERFLOW_COUNT: u32 = 24u;
const SPATIAL_HEADER_EXACT_KEY_WORDS: u32 = 25u;
const SPATIAL_HEADER_SORT_KEY_WORDS: u32 = 26u;
const SPATIAL_HEADER_SORT_MODE: u32 = 27u;
const SPATIAL_HEADER_WORD_COUNT: u32 = 28u;
const SPATIAL_HEADER_CELL_KEYS_OFFSET: u32 = 29u;
const SPATIAL_HEADER_CELL_OFFSETS_OFFSET: u32 = 30u;
const SPATIAL_HEADER_CELL_MEMBERS_OFFSET: u32 = 31u;
const SPATIAL_HEADER_PARTICLE_TO_CELL_OFFSET: u32 = 32u;
const SPATIAL_HEADER_BUILD_ORDINAL: u32 = 33u;
const SPATIAL_HEADER_SORT_UNIQUE_ORDINAL: u32 = 34u;
const SPATIAL_HEADER_COMPLETION_ORDINAL: u32 = 35u;
const SPATIAL_HEADER_UNIQUE_GENERATION: u32 = 36u;
const SPATIAL_HEADER_UNIQUE_INPUT_COUNT: u32 = 37u;
const SPATIAL_HEADER_UNIQUE_COUNT: u32 = 38u;
const SPATIAL_HEADER_UNIQUE_ADMITTED: u32 = 39u;
const SPATIAL_HEADER_UNIQUE_OVERFLOW: u32 = 40u;
const SPATIAL_HEADER_UNIQUE_STATUS: u32 = 41u;
const SPATIAL_HEADER_CLEARED_WORDS: u32 = 45u;
const SPATIAL_HEADER_SOURCE_ADAPTER: u32 = 46u;
const SPATIAL_HEADER_PHYSICAL_UPPER_WORDS: u32 = 47u;
struct SpatialContactCandidate {
  valid: u32,
  particle_index: u32,
  domain_id: u32,
  material_id: f32,
  phase_id: f32,
  signed_m: f32,
  lateral2: f32,
  velocity: vec3<f32>,
  mass_kg: f32,
  score: f32,
};

struct SpatialContactPair {
  directory_valid: u32,
  ready: u32,
  policy_index: u32,
  source_index: u32,
  target_index: u32,
  score: f32,
  source_signed_m: f32,
  target_signed_m: f32,
  source_velocity: vec3<f32>,
  target_velocity: vec3<f32>,
  source_mass_kg: f32,
  target_mass_kg: f32,
  source_domain_id: u32,
  target_domain_id: u32,
};

fn ss_state_row0(particle_index: u32) -> vec4<f32> {
  return particle_state_rows[particle_index * 2u];
}

fn ss_state_row1(particle_index: u32) -> vec4<f32> {
  return particle_state_rows[particle_index * 2u + 1u];
}

fn ss_thermo_row0(particle_index: u32) -> vec4<f32> {
  return particle_thermo_rows[particle_index * 3u];
}

fn ss_thermo_row2(particle_index: u32) -> vec4<f32> {
  return particle_thermo_rows[particle_index * 3u + 2u];
}

fn ss_phase_matches(particle_phase_id: f32, required_phase_id: f32) -> bool {
  return required_phase_id <= 0.5 || abs(particle_phase_id - required_phase_id) < 0.5;
}

fn ss_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn ss_finite3(value: vec3<f32>) -> bool {
  return ss_finite(value.x) && ss_finite(value.y) && ss_finite(value.z);
}

fn ss_endpoint_matches(
  material_id: f32,
  phase_id: f32,
  required_material_id: f32,
  required_phase_id: f32
) -> bool {
  return abs(material_id - required_material_id) < 0.5
    && ss_phase_matches(phase_id, required_phase_id);
}

fn ss_policy_element_side(
  row0: vec4<f32>,
  row2: vec4<f32>,
  material_id: f32,
  phase_id: f32
) -> u32 {
  if (
    !ss_finite(row2.y)
    || row2.y <= 0.0
    || !ss_finite(material_id)
    || !ss_finite(phase_id)
    || !ss_finite(row0.x)
    || !ss_finite(row0.y)
    || !ss_finite(row0.z)
    || !ss_finite(row0.w)
  ) {
    return 0u;
  }
  let matches_a = ss_endpoint_matches(material_id, phase_id, row0.x, row0.z);
  let matches_b = ss_endpoint_matches(material_id, phase_id, row0.y, row0.w);
  if (matches_a && matches_b) {
    let exact_phase_a = row0.z > 0.5 && abs(phase_id - row0.z) < 0.5;
    let exact_phase_b = row0.w > 0.5 && abs(phase_id - row0.w) < 0.5;
    if (exact_phase_b && !exact_phase_a) {
      return 2u;
    }
    return 1u;
  }
  if (matches_a) {
    return 1u;
  }
  if (matches_b) {
    return 2u;
  }
  return 0u;
}

fn ss_exact_domain_id(value: f32) -> u32 {
  if (
    !ss_finite(value)
    || value < 0.5
    || value > 16777215.0
    || abs(value - round(value)) > 0.25
  ) {
    return 0u;
  }
  return u32(round(value));
}

fn ss_normal_from_element(row2: vec4<f32>, row3: vec4<f32>) -> vec3<f32> {
  var normal = row2.xyz;
  if (dot(normal, normal) <= 1.0e-24) {
    normal = vec3<f32>(row2.w, row3.x, row3.y);
  }
  if (dot(normal, normal) <= 1.0e-24) {
    return vec3<f32>(0.0, 1.0, 0.0);
  }
  return normalize(normal);
}

fn ss_range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn ss_directory_ready() -> bool {
  let bound_words = arrayLength(&spatial_directory);
  if (bound_words < SPATIAL_HEADER_WORDS) {
    return false;
  }
  let status = spatial_directory[SPATIAL_HEADER_STATUS];
  let required_status = SPATIAL_STATUS_READY | SPATIAL_STATUS_ADMITTED;
  let rejected_status = SPATIAL_STATUS_FAIL_CLOSED
    | SPATIAL_STATUS_INVALID_SOURCE
    | SPATIAL_STATUS_CAPACITY_OVERFLOW;
  let source_count = spatial_directory[SPATIAL_HEADER_SOURCE_COUNT];
  let source_capacity = spatial_directory[SPATIAL_HEADER_SOURCE_CAPACITY];
  let cell_count = spatial_directory[SPATIAL_HEADER_CELL_COUNT];
  let cell_capacity = spatial_directory[SPATIAL_HEADER_CELL_CAPACITY];
  let directory_capacity = spatial_directory[SPATIAL_HEADER_DIRECTORY_CAPACITY];
  let logical_required = spatial_directory[SPATIAL_HEADER_LOGICAL_REQUIRED_WORDS];
  let logical_admitted = spatial_directory[SPATIAL_HEADER_LOGICAL_ADMITTED_WORDS];
  let physical_upper = spatial_directory[SPATIAL_HEADER_PHYSICAL_UPPER_WORDS];
  let cell_key_words = cell_count * SPATIAL_EXACT_KEY_WORDS;
  let unique_status = spatial_directory[SPATIAL_HEADER_UNIQUE_STATUS];
  let build_ordinal = spatial_directory[SPATIAL_HEADER_BUILD_ORDINAL];
  if (
    source_count == 0u
    || source_count > source_capacity
    || directory_capacity > bound_words
    || physical_upper > directory_capacity
    || params.level_count == 0u
    || params.level_count > 64u
    || params.chart_id > 0x00ffffffu
    || !ss_finite(params.base_grid_spacing_m)
    || params.base_grid_spacing_m <= 0.0
  ) {
    return false;
  }
  let min_level_order = bitcast<u32>(params.min_level) ^ 0x80000000u;
  let max_level_delta = params.level_count - 1u;
  if (max_level_delta > 0xffffffffu - min_level_order) {
    return false;
  }
  let expected_max_level_order = min_level_order + max_level_delta;
  let expected_max_level = bitcast<i32>(expected_max_level_order ^ 0x80000000u);
  let min_spacing = params.base_grid_spacing_m * exp2(f32(params.min_level));
  let max_spacing = params.base_grid_spacing_m * exp2(f32(expected_max_level));
  if (
    !ss_finite(min_spacing)
    || min_spacing < 0.000001
    || !ss_finite(max_spacing)
    || max_spacing <= 0.0
  ) {
    return false;
  }
  if (source_count > 0xffffffffu - params.expected_particle_to_cell_offset_words) {
    return false;
  }
  let query_evidence_offset = params.expected_particle_to_cell_offset_words
    + source_count;
  if (!ss_range_within(
    query_evidence_offset,
    SPATIAL_QUERY_EVIDENCE_WORDS,
    physical_upper
  )) {
    return false;
  }
  let evidence_chart_id = spatial_directory[query_evidence_offset + 0u];
  let evidence_min_level_bits = spatial_directory[query_evidence_offset + 1u];
  let evidence_max_level_bits = spatial_directory[query_evidence_offset + 2u];
  let evidence_base_spacing_bits = spatial_directory[query_evidence_offset + 3u];
  return params.derivation_enabled != 0u
    && params.element_count <= arrayLength(&interface_elements) / 4u
    && params.element_count <= arrayLength(&contact_kinematics_rows) / 2u
    && params.particle_count <= arrayLength(&particle_state_rows) / 2u
    && params.particle_count <= arrayLength(&particle_thermo_rows) / 3u
    && params.particle_count <= arrayLength(&particle_identity)
    && params.contact_policy_row_count <= arrayLength(&contact_policy_rows) / 4u
    && spatial_directory[SPATIAL_HEADER_MAGIC] == SPATIAL_MAGIC
    && spatial_directory[SPATIAL_HEADER_VERSION] == SPATIAL_ABI_VERSION
    && (status & required_status) == required_status
    && (status & rejected_status) == 0u
    && spatial_directory[SPATIAL_HEADER_GENERATION] == params.expected_generation_id
    && spatial_directory[SPATIAL_HEADER_DEVICE_ORDINAL] == params.expected_device_ordinal
    && spatial_directory[SPATIAL_HEADER_LANE_ORDINAL] == params.expected_lane_ordinal
    && spatial_directory[SPATIAL_HEADER_LEASE_TOKEN] == params.expected_lease_token
    && spatial_directory[SPATIAL_HEADER_SOURCE_FAMILY] == params.expected_source_family_id
    && spatial_directory[SPATIAL_HEADER_STORAGE_GENERATION] == params.expected_storage_generation
    && spatial_directory[SPATIAL_HEADER_PHYSICS_TICK] == params.expected_physics_tick
    && spatial_directory[SPATIAL_HEADER_PHYSICS_SUBSTEP] == params.expected_physics_substep
    && spatial_directory[SPATIAL_HEADER_POSITION_EPOCH] == params.expected_position_epoch
    && spatial_directory[SPATIAL_HEADER_TOPOLOGY_EPOCH] == params.expected_topology_epoch
    && spatial_directory[SPATIAL_HEADER_CHART_EPOCH] == params.expected_chart_epoch
    && spatial_directory[SPATIAL_HEADER_LEVEL_EPOCH] == params.expected_level_epoch
    && spatial_directory[SPATIAL_HEADER_SUPPORT_EPOCH] == params.expected_support_epoch
    && source_count == params.particle_count
    && source_capacity == params.expected_source_capacity
    && cell_count > 0u
    && cell_count <= source_count
    && cell_count <= cell_capacity
    && cell_capacity == params.expected_cell_capacity
    && directory_capacity == params.expected_directory_capacity_words
    && logical_required == logical_admitted
    && logical_admitted >= SPATIAL_HEADER_WORDS
    && logical_admitted <= physical_upper
    && spatial_directory[SPATIAL_HEADER_INVALID_SOURCE_COUNT] == 0u
    && spatial_directory[SPATIAL_HEADER_OVERFLOW_COUNT] == 0u
    && spatial_directory[SPATIAL_HEADER_EXACT_KEY_WORDS] == SPATIAL_EXACT_KEY_WORDS
    && spatial_directory[SPATIAL_HEADER_SORT_KEY_WORDS] == SPATIAL_EXACT_KEY_WORDS
    && spatial_directory[SPATIAL_HEADER_SORT_MODE]
      == SPATIAL_SORT_LEXICOGRAPHIC_U32X5
    && spatial_directory[SPATIAL_HEADER_WORD_COUNT] == SPATIAL_HEADER_WORDS
    && spatial_directory[SPATIAL_HEADER_CELL_KEYS_OFFSET]
      == params.expected_cell_keys_offset_words
    && spatial_directory[SPATIAL_HEADER_CELL_OFFSETS_OFFSET]
      == params.expected_cell_offsets_offset_words
    && spatial_directory[SPATIAL_HEADER_CELL_MEMBERS_OFFSET]
      == params.expected_cell_members_offset_words
    && spatial_directory[SPATIAL_HEADER_PARTICLE_TO_CELL_OFFSET]
      == params.expected_particle_to_cell_offset_words
    && build_ordinal != 0u
    && spatial_directory[SPATIAL_HEADER_SORT_UNIQUE_ORDINAL] == build_ordinal
    && spatial_directory[SPATIAL_HEADER_COMPLETION_ORDINAL] == build_ordinal
    && spatial_directory[SPATIAL_HEADER_UNIQUE_GENERATION]
      == params.expected_generation_id
    && spatial_directory[SPATIAL_HEADER_UNIQUE_INPUT_COUNT] == source_count
    && spatial_directory[SPATIAL_HEADER_UNIQUE_COUNT] == cell_count
    && spatial_directory[SPATIAL_HEADER_UNIQUE_ADMITTED] != 0u
    && spatial_directory[SPATIAL_HEADER_UNIQUE_OVERFLOW] == 0u
    && (unique_status & SPATIAL_PRIMITIVE_STATUS_READY) != 0u
    && (unique_status & SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && spatial_directory[SPATIAL_HEADER_CLEARED_WORDS] >= SPATIAL_HEADER_WORDS
    && spatial_directory[SPATIAL_HEADER_SOURCE_ADAPTER]
      == SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    && evidence_chart_id == params.chart_id
    && evidence_min_level_bits == bitcast<u32>(params.min_level)
    && (evidence_max_level_bits ^ 0x80000000u) == expected_max_level_order
    && evidence_base_spacing_bits == bitcast<u32>(params.base_grid_spacing_m)
    && ss_range_within(
      params.expected_cell_keys_offset_words,
      cell_key_words,
      physical_upper
    )
    && ss_range_within(
      params.expected_cell_offsets_offset_words,
      cell_count + 1u,
      physical_upper
    )
    && ss_range_within(
      params.expected_cell_members_offset_words,
      source_count,
      physical_upper
    )
    && ss_range_within(
      params.expected_particle_to_cell_offset_words,
      source_count,
      physical_upper
    )
    && spatial_directory[params.expected_cell_offsets_offset_words] == 0u
    && spatial_directory[
      params.expected_cell_offsets_offset_words + cell_count
    ] == source_count;
}

fn ss_signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn ss_compare_word(left: u32, right: u32) -> i32 {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

fn ss_compare_cell_key(
  cell_index: u32,
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> i32 {
  let key_offset = params.expected_cell_keys_offset_words
    + cell_index * SPATIAL_EXACT_KEY_WORDS;
  var comparison = ss_compare_word(spatial_directory[key_offset], chart);
  if (comparison != 0) {
    return comparison;
  }
  comparison = ss_compare_word(spatial_directory[key_offset + 1u], level_order);
  if (comparison != 0) {
    return comparison;
  }
  comparison = ss_compare_word(spatial_directory[key_offset + 2u], cell_order.x);
  if (comparison != 0) {
    return comparison;
  }
  comparison = ss_compare_word(spatial_directory[key_offset + 3u], cell_order.y);
  if (comparison != 0) {
    return comparison;
  }
  return ss_compare_word(spatial_directory[key_offset + 4u], cell_order.z);
}

fn ss_lower_bound_cell_key(
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> u32 {
  let cell_count = spatial_directory[SPATIAL_HEADER_CELL_COUNT];
  var lower = 0u;
  var upper = cell_count;
  for (
    var iteration = 0u;
    iteration < 32u && lower < upper;
    iteration = iteration + 1u
  ) {
    let middle = lower + (upper - lower) / 2u;
    let comparison = ss_compare_cell_key(middle, chart, level_order, cell_order);
    if (comparison < 0) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  if (lower < upper) {
    return cell_count;
  }
  return lower;
}

fn ss_upper_bound_cell_key(
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> u32 {
  let cell_count = spatial_directory[SPATIAL_HEADER_CELL_COUNT];
  var lower = 0u;
  var upper = cell_count;
  for (
    var iteration = 0u;
    iteration < 32u && lower < upper;
    iteration = iteration + 1u
  ) {
    let middle = lower + (upper - lower) / 2u;
    let comparison = ss_compare_cell_key(middle, chart, level_order, cell_order);
    if (comparison <= 0) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  if (lower < upper) {
    return cell_count;
  }
  return lower;
}

fn ss_cell_key_word(cell_index: u32, word_index: u32) -> u32 {
  return spatial_directory[
    params.expected_cell_keys_offset_words
      + cell_index * SPATIAL_EXACT_KEY_WORDS
      + word_index
  ];
}

fn ss_saturating_sub_radius(value: i32, radius: i32) -> i32 {
  let minimum = -2147483647 - 1;
  if (radius > 0 && value < minimum + radius) {
    return minimum;
  }
  return value - radius;
}

fn ss_saturating_add_radius(value: i32, radius: i32) -> i32 {
  let maximum = 2147483647;
  if (radius > 0 && value > maximum - radius) {
    return maximum;
  }
  return value + radius;
}

fn ss_empty_candidate() -> SpatialContactCandidate {
  return SpatialContactCandidate(
    0u,
    0u,
    0u,
    0.0,
    0.0,
    0.0,
    0.0,
    vec3<f32>(0.0),
    0.0,
    0.0
  );
}

fn ss_candidate_for_particle(
  particle_index: u32,
  centroid: vec3<f32>,
  normal: vec3<f32>,
  search_radius_m: f32,
  search_radius2: f32
) -> SpatialContactCandidate {
  var candidate = ss_empty_candidate();
  if (particle_index >= params.particle_count) {
    return candidate;
  }
  let thermo0 = ss_thermo_row0(particle_index);
  let thermo2 = ss_thermo_row2(particle_index);
  if (
    !ss_finite(thermo0.x)
    || !ss_finite(thermo0.y)
    || !ss_finite(thermo2.z)
    || thermo2.z <= 0.0
  ) {
    return candidate;
  }
  let state0 = ss_state_row0(particle_index);
  let state1 = ss_state_row1(particle_index);
  if (
    !ss_finite3(state0.xyz)
    || !ss_finite(state0.w)
    || state0.w <= 0.0
    || !ss_finite3(state1.xyz)
  ) {
    return candidate;
  }
  let delta = state0.xyz - centroid;
  let signed_m = dot(delta, normal);
  let distance2 = dot(delta, delta);
  let lateral2 = max(distance2 - signed_m * signed_m, 0.0);
  if (
    !ss_finite(signed_m)
    || !ss_finite(lateral2)
    || lateral2 > search_radius2
    || abs(signed_m) > search_radius_m
  ) {
    return candidate;
  }
  let domain_id = particle_identity[particle_index];
  if (domain_id > 16777215u) {
    return candidate;
  }
  candidate.valid = 1u;
  candidate.particle_index = particle_index;
  candidate.domain_id = domain_id;
  candidate.material_id = thermo0.x;
  candidate.phase_id = thermo0.y;
  candidate.signed_m = signed_m;
  candidate.lateral2 = lateral2;
  candidate.velocity = state1.xyz;
  candidate.mass_kg = state0.w;
  return candidate;
}

fn ss_candidate_matches_endpoint(
  candidate: SpatialContactCandidate,
  required_material_id: f32,
  required_phase_id: f32,
  required_domain_id: u32
) -> bool {
  return candidate.valid != 0u
    && ss_endpoint_matches(
      candidate.material_id,
      candidate.phase_id,
      required_material_id,
      required_phase_id
    )
    && (required_domain_id == 0u || candidate.domain_id == required_domain_id);
}

fn ss_score_candidate(
  candidate: SpatialContactCandidate,
  endpoint_ordinal: u32,
  support_radius_m: f32,
  search_radius2: f32
) -> SpatialContactCandidate {
  var result = candidate;
  let wrong_side = select(
    candidate.signed_m > support_radius_m * 0.25,
    candidate.signed_m < -support_radius_m * 0.25,
    endpoint_ordinal != 0u
  );
  let side_penalty = select(0.0, search_radius2, wrong_side);
  result.score = candidate.lateral2
    + candidate.signed_m * candidate.signed_m
    + side_penalty;
  return result;
}

fn ss_candidate_better(
  candidate: SpatialContactCandidate,
  incumbent: SpatialContactCandidate
) -> bool {
  if (candidate.valid == 0u) {
    return false;
  }
  if (incumbent.valid == 0u) {
    return true;
  }
  if (candidate.score < incumbent.score) {
    return true;
  }
  if (candidate.score > incumbent.score) {
    return false;
  }
  if (candidate.domain_id < incumbent.domain_id) {
    return true;
  }
  if (candidate.domain_id > incumbent.domain_id) {
    return false;
  }
  return candidate.particle_index < incumbent.particle_index;
}

fn ss_empty_pair() -> SpatialContactPair {
  return SpatialContactPair(
    1u,
    0u,
    0u,
    0u,
    0u,
    0.0,
    0.0,
    0.0,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    0u,
    0u
  );
}

fn ss_invalid_directory_pair() -> SpatialContactPair {
  var pair = ss_empty_pair();
  pair.directory_valid = 0u;
  return pair;
}

fn ss_pair_from_candidates(
  source_candidate: SpatialContactCandidate,
  target_candidate: SpatialContactCandidate,
  policy_index: u32
) -> SpatialContactPair {
  var pair = ss_empty_pair();
  if (
    source_candidate.valid == 0u
    || target_candidate.valid == 0u
    || source_candidate.particle_index == target_candidate.particle_index
  ) {
    return pair;
  }
  pair.ready = 1u;
  pair.policy_index = policy_index;
  pair.source_index = source_candidate.particle_index;
  pair.target_index = target_candidate.particle_index;
  pair.score = source_candidate.score + target_candidate.score;
  pair.source_signed_m = source_candidate.signed_m;
  pair.target_signed_m = target_candidate.signed_m;
  pair.source_velocity = source_candidate.velocity;
  pair.target_velocity = target_candidate.velocity;
  pair.source_mass_kg = source_candidate.mass_kg;
  pair.target_mass_kg = target_candidate.mass_kg;
  pair.source_domain_id = source_candidate.domain_id;
  pair.target_domain_id = target_candidate.domain_id;
  return pair;
}

fn ss_pair_better(candidate: SpatialContactPair, incumbent: SpatialContactPair) -> bool {
  if (candidate.ready == 0u) {
    return false;
  }
  if (incumbent.ready == 0u) {
    return true;
  }
  if (candidate.score < incumbent.score) {
    return true;
  }
  if (candidate.score > incumbent.score) {
    return false;
  }
  if (candidate.source_domain_id < incumbent.source_domain_id) {
    return true;
  }
  if (candidate.source_domain_id > incumbent.source_domain_id) {
    return false;
  }
  if (candidate.target_domain_id < incumbent.target_domain_id) {
    return true;
  }
  if (candidate.target_domain_id > incumbent.target_domain_id) {
    return false;
  }
  if (candidate.source_index < incumbent.source_index) {
    return true;
  }
  if (candidate.source_index > incumbent.source_index) {
    return false;
  }
  if (candidate.target_index < incumbent.target_index) {
    return true;
  }
  if (candidate.target_index > incumbent.target_index) {
    return false;
  }
  return candidate.policy_index < incumbent.policy_index;
}

fn ss_pair_for_policy(
  policy_index: u32,
  element_material_id: f32,
  element_phase_id: f32,
  centroid: vec3<f32>,
  normal: vec3<f32>
) -> SpatialContactPair {
  var result = ss_empty_pair();
  let row0 = contact_policy_rows[policy_index * 4u];
  let row1 = contact_policy_rows[policy_index * 4u + 1u];
  let row2 = contact_policy_rows[policy_index * 4u + 2u];
  let row3 = contact_policy_rows[policy_index * 4u + 3u];
  let element_side = ss_policy_element_side(
    row0,
    row2,
    element_material_id,
    element_phase_id
  );
  if (
    element_side == 0u
    || !ss_finite(row1.z)
    || row1.z < 0.0
    || !ss_finite(row3.x)
    || !ss_finite(row3.y)
    || !ss_finite(row3.z)
    || !ss_finite(row3.w)
  ) {
    return result;
  }

  let body_specific = row3.z > 0.5;
  let domain_pair_ready = row3.w > 0.5;
  if (body_specific && !domain_pair_ready) {
    return result;
  }
  let domain_a = select(0u, ss_exact_domain_id(row3.x), domain_pair_ready);
  let domain_b = select(0u, ss_exact_domain_id(row3.y), domain_pair_ready);
  if (domain_pair_ready && (domain_a == 0u || domain_b == 0u)) {
    return result;
  }

  let element_is_a = element_side == 1u;
  let source_material_id = select(row0.y, row0.x, element_is_a);
  let source_phase_id = select(row0.w, row0.z, element_is_a);
  let target_material_id = select(row0.x, row0.y, element_is_a);
  let target_phase_id = select(row0.z, row0.w, element_is_a);
  let source_domain_id = select(domain_b, domain_a, element_is_a);
  let target_domain_id = select(domain_a, domain_b, element_is_a);
  let support_radius_m = max(row1.z, 1.0e-6);
  let search_radius_m = max(
    max(support_radius_m * 2.0, params.max_search_radius_m),
    1.0e-6
  );
  if (!ss_finite(search_radius_m)) {
    return result;
  }
  let search_radius2 = search_radius_m * search_radius_m;
  if (!ss_finite(search_radius2)) {
    return result;
  }
  // The accepted region is a cylinder (independent normal and lateral
  // bounds), so its axis-aligned enclosing radius is sqrt(2) * R.
  let directory_query_radius_m = search_radius_m * 1.4142135623730951;

  var source_first = ss_empty_candidate();
  var source_second = source_first;
  var target_first = source_first;
  var target_second = source_first;

  for (
    var level_ordinal = 0u;
    level_ordinal < params.level_count;
    level_ordinal = level_ordinal + 1u
  ) {
    let level = params.min_level + i32(level_ordinal);
    let spacing_m = params.base_grid_spacing_m * exp2(f32(level));
    if (!ss_finite(spacing_m) || !(spacing_m > 0.0)) {
      continue;
    }
    let center_cell = vec3<i32>(floor(centroid / spacing_m));
    let radius_cells = max(
      0,
      i32(min(ceil(directory_query_radius_m / spacing_m), 2147483520.0))
    );
    let minimum_cell = vec3<i32>(
      ss_saturating_sub_radius(center_cell.x, radius_cells),
      ss_saturating_sub_radius(center_cell.y, radius_cells),
      ss_saturating_sub_radius(center_cell.z, radius_cells)
    );
    let maximum_cell = vec3<i32>(
      ss_saturating_add_radius(center_cell.x, radius_cells),
      ss_saturating_add_radius(center_cell.y, radius_cells),
      ss_saturating_add_radius(center_cell.z, radius_cells)
    );
    let level_order = ss_signed_order_key(level);
    let minimum_order = vec3<u32>(
      ss_signed_order_key(minimum_cell.x),
      ss_signed_order_key(minimum_cell.y),
      ss_signed_order_key(minimum_cell.z)
    );
    let maximum_order = vec3<u32>(
      ss_signed_order_key(maximum_cell.x),
      ss_signed_order_key(maximum_cell.y),
      ss_signed_order_key(maximum_cell.z)
    );

    // Traverse only occupied lexicographic x/y groups. A dense integer-cell
    // cube is catastrophically large at fine levels even when almost every
    // cell is empty. Binary searches skip directly between occupied prefixes.
    let level_begin = ss_lower_bound_cell_key(
      params.chart_id,
      level_order,
      vec3<u32>(0u)
    );
    let level_end = ss_upper_bound_cell_key(
      params.chart_id,
      level_order,
      vec3<u32>(0xffffffffu)
    );
    if (level_begin >= level_end) {
      continue;
    }
    var x_cursor = max(
      level_begin,
      ss_lower_bound_cell_key(
        params.chart_id,
        level_order,
        vec3<u32>(minimum_order.x, 0u, 0u)
      )
    );
    for (
      var x_iteration = 0u;
      x_iteration < params.particle_count && x_cursor < level_end;
      x_iteration = x_iteration + 1u
    ) {
      let x_order = ss_cell_key_word(x_cursor, 2u);
      if (x_order > maximum_order.x) {
        x_cursor = level_end;
        continue;
      }
      let x_end = min(
        level_end,
        ss_upper_bound_cell_key(
          params.chart_id,
          level_order,
          vec3<u32>(x_order, 0xffffffffu, 0xffffffffu)
        )
      );
      // The directory header is authenticated on-device, but a sparse-prefix
      // consumer must still own its termination proof. Fail closed if a torn
      // or backend-miscompiled binary search ever violates strict progress.
      if (x_end <= x_cursor) {
        return ss_invalid_directory_pair();
      }
      var y_cursor = max(
        x_cursor,
        ss_lower_bound_cell_key(
          params.chart_id,
          level_order,
          vec3<u32>(x_order, minimum_order.y, 0u)
        )
      );
      for (
        var y_iteration = 0u;
        y_iteration < params.particle_count && y_cursor < x_end;
        y_iteration = y_iteration + 1u
      ) {
        let y_order = ss_cell_key_word(y_cursor, 3u);
        if (y_order > maximum_order.y) {
          y_cursor = x_end;
          continue;
        }
        let y_end = min(
          x_end,
          ss_upper_bound_cell_key(
            params.chart_id,
            level_order,
            vec3<u32>(x_order, y_order, 0xffffffffu)
          )
        );
        if (y_end <= y_cursor) {
          return ss_invalid_directory_pair();
        }
        let z_begin = max(
          y_cursor,
          ss_lower_bound_cell_key(
            params.chart_id,
            level_order,
            vec3<u32>(x_order, y_order, minimum_order.z)
          )
        );
        let z_end = min(
          y_end,
          ss_upper_bound_cell_key(
            params.chart_id,
            level_order,
            vec3<u32>(x_order, y_order, maximum_order.z)
          )
        );
        for (
          var cell_index = z_begin;
          cell_index < z_end;
          cell_index = cell_index + 1u
        ) {
          let member_begin = spatial_directory[
            params.expected_cell_offsets_offset_words + cell_index
          ];
          let member_end = spatial_directory[
            params.expected_cell_offsets_offset_words + cell_index + 1u
          ];
          if (member_begin > member_end || member_end > params.particle_count) {
            return ss_invalid_directory_pair();
          }
          for (
            var member_offset = member_begin;
            member_offset < member_end;
            member_offset = member_offset + 1u
          ) {
            let particle_index = spatial_directory[
              params.expected_cell_members_offset_words + member_offset
            ];
            if (particle_index >= params.particle_count) {
              return ss_invalid_directory_pair();
            }
            let candidate = ss_candidate_for_particle(
              particle_index,
              centroid,
              normal,
              search_radius_m,
              search_radius2
            );
            if (ss_candidate_matches_endpoint(
              candidate,
              source_material_id,
              source_phase_id,
              source_domain_id
            )) {
              let scored = ss_score_candidate(
                candidate,
                0u,
                support_radius_m,
                search_radius2
              );
              if (ss_candidate_better(scored, source_first)) {
                if (source_first.particle_index != scored.particle_index) {
                  source_second = source_first;
                }
                source_first = scored;
              } else if (
                scored.particle_index != source_first.particle_index
                && ss_candidate_better(scored, source_second)
              ) {
                source_second = scored;
              }
            }
            if (ss_candidate_matches_endpoint(
              candidate,
              target_material_id,
              target_phase_id,
              target_domain_id
            )) {
              let scored = ss_score_candidate(
                candidate,
                1u,
                support_radius_m,
                search_radius2
              );
              if (ss_candidate_better(scored, target_first)) {
                if (target_first.particle_index != scored.particle_index) {
                  target_second = target_first;
                }
                target_first = scored;
              } else if (
                scored.particle_index != target_first.particle_index
                && ss_candidate_better(scored, target_second)
              ) {
                target_second = scored;
              }
            }
          }
        }
        y_cursor = y_end;
      }
      if (y_cursor < x_end) {
        return ss_invalid_directory_pair();
      }
      x_cursor = x_end;
    }
    if (x_cursor < level_end) {
      return ss_invalid_directory_pair();
    }
  }

  var candidate_pair = ss_pair_from_candidates(
    source_first,
    target_first,
    policy_index
  );
  if (ss_pair_better(candidate_pair, result)) {
    result = candidate_pair;
  }
  candidate_pair = ss_pair_from_candidates(
    source_first,
    target_second,
    policy_index
  );
  if (ss_pair_better(candidate_pair, result)) {
    result = candidate_pair;
  }
  candidate_pair = ss_pair_from_candidates(
    source_second,
    target_first,
    policy_index
  );
  if (ss_pair_better(candidate_pair, result)) {
    result = candidate_pair;
  }
  candidate_pair = ss_pair_from_candidates(
    source_second,
    target_second,
    policy_index
  );
  if (ss_pair_better(candidate_pair, result)) {
    result = candidate_pair;
  }
  return result;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let element_index = global_id.x;
  if (element_index >= params.element_count) {
    return;
  }
  contact_kinematics_rows[element_index * 2u] = vec4<f32>(0.0);
  contact_kinematics_rows[element_index * 2u + 1u] = vec4<f32>(0.0);
  if (
    params.particle_count == 0u
    || params.contact_policy_row_count == 0u
    || params.level_count == 0u
    || !ss_finite(params.base_grid_spacing_m)
    || params.base_grid_spacing_m <= 0.0
    || !ss_finite(params.max_search_radius_m)
    || params.max_search_radius_m < 0.0
    || !ss_finite(params.gap_floor_m)
    || params.gap_floor_m < 0.0
    || !ss_directory_ready()
  ) {
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
  if (
    !ss_finite(element_material_id)
    || !ss_finite(element_phase_id)
    || !ss_finite3(centroid)
    || !ss_finite(area_m2)
    || area_m2 <= 0.0
    || !ss_finite3(element_row2.xyz)
    || !ss_finite(element_row2.w)
    || !ss_finite(element_row3.x)
    || !ss_finite(element_row3.y)
    || !ss_finite(element_row3.w)
    || element_row3.w <= 0.0
  ) {
    return;
  }

  let normal = ss_normal_from_element(element_row2, element_row3);
  if (!ss_finite3(normal)) {
    return;
  }
  var best_pair = ss_empty_pair();
  for (
    var policy_index = 0u;
    policy_index < params.contact_policy_row_count;
    policy_index = policy_index + 1u
  ) {
    let pair = ss_pair_for_policy(
      policy_index,
      element_material_id,
      element_phase_id,
      centroid,
      normal
    );
    if (pair.directory_valid == 0u) {
      return;
    }
    if (ss_pair_better(pair, best_pair)) {
      best_pair = pair;
    }
  }
  if (best_pair.ready == 0u) {
    return;
  }

  let signed_span_m = best_pair.target_signed_m - best_pair.source_signed_m;
  let direction_sign = select(-1.0, 1.0, signed_span_m >= 0.0);
  let gap_m = max(abs(signed_span_m), params.gap_floor_m);
  let relative_normal_velocity_m_per_s = dot(
    best_pair.target_velocity - best_pair.source_velocity,
    normal * direction_sign
  );
  var representative_mass_kg = 0.0;
  if (best_pair.source_mass_kg > 0.0 && best_pair.target_mass_kg > 0.0) {
    representative_mass_kg = (best_pair.source_mass_kg * best_pair.target_mass_kg)
      / max(best_pair.source_mass_kg + best_pair.target_mass_kg, 1.0e-12);
  }
  let source_domain_id = best_pair.source_domain_id;
  let target_domain_id = best_pair.target_domain_id;
  let domain_pair_ready = source_domain_id > 0u && target_domain_id > 0u;
  contact_kinematics_rows[element_index * 2u] = vec4<f32>(
    gap_m,
    relative_normal_velocity_m_per_s,
    representative_mass_kg,
    2.0
  );
  contact_kinematics_rows[element_index * 2u + 1u] = vec4<f32>(
    f32(source_domain_id),
    f32(target_domain_id),
    select(0.0, 1.0, domain_pair_ready),
    f32(best_pair.policy_index + 1u)
  );
}
`;
