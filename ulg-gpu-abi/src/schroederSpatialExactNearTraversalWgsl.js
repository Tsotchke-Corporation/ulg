import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1
} from './schroederSpatialExactNear.js';

export const ULG_SCHROEDER_SPATIAL_EXACT_NEAR_TRAVERSAL_WGSL_SCHEMA =
  'peercompute.ulg.schroeder-spatial-exact-near-traversal-wgsl.v1';

export const SCHROEDER_SPATIAL_EXACT_NEAR_TRAVERSAL_WGSL_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_TRAVERSAL_WGSL_SCHEMA,
  version: 1,
  directoryBindingDeclaration:
    'var<storage, read> spatial_directory: array<u32>',
  generationAdmission:
    'complete-v1-header-query-evidence-and-live-csr-validation-before-lookup',
  keyOrder: 'chart-level-signed-x-y-z-u32x5-lexicographic',
  lookup: 'binary-search-occupied-key-range-and-validated-csr-source-lookup',
  malformedRangePolicy: 'fail-closed-admitted-zero',
  candidateBudget: null
});

const WGSL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function exactNearTraversalSource(directoryBindingName) {
  return /* wgsl */ `
// Requires the consumer shader to declare:
//   var<storage, read> ${directoryBindingName}: array<u32>;
// The module owns no law buffers, candidate policy, or dispatch entry point.
struct SchroederSpatialExactNearExpectationV1 {
  source_count: u32,
  derivation_enabled: u32,
  support_profile_id: u32,
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
  expected_cell_keys_offset_words: u32,
  expected_cell_offsets_offset_words: u32,
  expected_cell_members_offset_words: u32,
  expected_particle_to_cell_offset_words: u32,
  expected_directory_capacity_words: u32,
  expected_source_capacity: u32,
  expected_cell_capacity: u32,
};

struct SchroederSpatialExactNearRangeV1 {
  admitted: u32,
  begin: u32,
  end: u32,
};

struct SchroederSpatialExactNearSourceLookupV1 {
  admitted: u32,
  source_index: u32,
};

const SS_EXACT_NEAR_MAGIC_V1: u32 = 0x53534531u;
const SS_EXACT_NEAR_ABI_VERSION_V1: u32 = 1u;
const SS_EXACT_NEAR_STATUS_READY: u32 = 1u;
const SS_EXACT_NEAR_STATUS_ADMITTED: u32 = 2u;
const SS_EXACT_NEAR_STATUS_FAIL_CLOSED: u32 = 4u;
const SS_EXACT_NEAR_STATUS_INVALID_SOURCE: u32 = 8u;
const SS_EXACT_NEAR_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const SS_EXACT_NEAR_PRIMITIVE_STATUS_READY: u32 = 1u;
const SS_EXACT_NEAR_PRIMITIVE_STATUS_FAIL_CLOSED: u32 = 4u;
const SS_EXACT_NEAR_KEY_WORDS: u32 = 5u;
const SS_EXACT_NEAR_HEADER_WORDS: u32 = 48u;
const SS_EXACT_NEAR_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;
const SS_EXACT_NEAR_SOURCE_ADAPTER_QUERY_V1: u32 = 2u;
const SS_EXACT_NEAR_QUERY_EVIDENCE_WORDS: u32 = 6u;
const SS_EXACT_NEAR_SUPPORT_PRESSURE_CONTACT_V1: u32 = ${SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1}u;
const SS_EXACT_NEAR_SUPPORT_REACTION_DISCOVERY_V1: u32 = ${SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1}u;
const SS_EXACT_NEAR_SUPPORT_REACTION_PRODUCT_PLACEMENT_V1: u32 = ${SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1}u;
const SS_EXACT_NEAR_SUPPORT_SEPARATION_V1: u32 = ${SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1}u;
const SS_EXACT_NEAR_SUPPORT_THERMAL_CONDUCTION_V1: u32 = ${SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1}u;
const SS_EXACT_NEAR_SUPPORT_RADIATION_WIDE_V1: u32 = ${SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1}u;
const SS_EXACT_NEAR_SUPPORT_MATERIAL_INTERFACE_LOCAL_V1: u32 = ${SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1}u;
const SS_EXACT_NEAR_HEADER_MAGIC: u32 = 0u;
const SS_EXACT_NEAR_HEADER_VERSION: u32 = 1u;
const SS_EXACT_NEAR_HEADER_STATUS: u32 = 2u;
const SS_EXACT_NEAR_HEADER_GENERATION: u32 = 3u;
const SS_EXACT_NEAR_HEADER_DEVICE_ORDINAL: u32 = 4u;
const SS_EXACT_NEAR_HEADER_LANE_ORDINAL: u32 = 5u;
const SS_EXACT_NEAR_HEADER_LEASE_TOKEN: u32 = 6u;
const SS_EXACT_NEAR_HEADER_SOURCE_FAMILY: u32 = 7u;
const SS_EXACT_NEAR_HEADER_STORAGE_GENERATION: u32 = 8u;
const SS_EXACT_NEAR_HEADER_PHYSICS_TICK: u32 = 9u;
const SS_EXACT_NEAR_HEADER_PHYSICS_SUBSTEP: u32 = 10u;
const SS_EXACT_NEAR_HEADER_POSITION_EPOCH: u32 = 11u;
const SS_EXACT_NEAR_HEADER_TOPOLOGY_EPOCH: u32 = 12u;
const SS_EXACT_NEAR_HEADER_CHART_EPOCH: u32 = 13u;
const SS_EXACT_NEAR_HEADER_LEVEL_EPOCH: u32 = 14u;
const SS_EXACT_NEAR_HEADER_SUPPORT_EPOCH: u32 = 15u;
const SS_EXACT_NEAR_HEADER_SOURCE_COUNT: u32 = 16u;
const SS_EXACT_NEAR_HEADER_SOURCE_CAPACITY: u32 = 17u;
const SS_EXACT_NEAR_HEADER_CELL_COUNT: u32 = 18u;
const SS_EXACT_NEAR_HEADER_CELL_CAPACITY: u32 = 19u;
const SS_EXACT_NEAR_HEADER_LOGICAL_REQUIRED_WORDS: u32 = 20u;
const SS_EXACT_NEAR_HEADER_LOGICAL_ADMITTED_WORDS: u32 = 21u;
const SS_EXACT_NEAR_HEADER_DIRECTORY_CAPACITY: u32 = 22u;
const SS_EXACT_NEAR_HEADER_INVALID_SOURCE_COUNT: u32 = 23u;
const SS_EXACT_NEAR_HEADER_OVERFLOW_COUNT: u32 = 24u;
const SS_EXACT_NEAR_HEADER_EXACT_KEY_WORDS: u32 = 25u;
const SS_EXACT_NEAR_HEADER_SORT_KEY_WORDS: u32 = 26u;
const SS_EXACT_NEAR_HEADER_SORT_MODE: u32 = 27u;
const SS_EXACT_NEAR_HEADER_WORD_COUNT: u32 = 28u;
const SS_EXACT_NEAR_HEADER_CELL_KEYS_OFFSET: u32 = 29u;
const SS_EXACT_NEAR_HEADER_CELL_OFFSETS_OFFSET: u32 = 30u;
const SS_EXACT_NEAR_HEADER_CELL_MEMBERS_OFFSET: u32 = 31u;
const SS_EXACT_NEAR_HEADER_PARTICLE_TO_CELL_OFFSET: u32 = 32u;
const SS_EXACT_NEAR_HEADER_BUILD_ORDINAL: u32 = 33u;
const SS_EXACT_NEAR_HEADER_SORT_UNIQUE_ORDINAL: u32 = 34u;
const SS_EXACT_NEAR_HEADER_COMPLETION_ORDINAL: u32 = 35u;
const SS_EXACT_NEAR_HEADER_UNIQUE_GENERATION: u32 = 36u;
const SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT: u32 = 37u;
const SS_EXACT_NEAR_HEADER_UNIQUE_COUNT: u32 = 38u;
const SS_EXACT_NEAR_HEADER_UNIQUE_ADMITTED: u32 = 39u;
const SS_EXACT_NEAR_HEADER_UNIQUE_OVERFLOW: u32 = 40u;
const SS_EXACT_NEAR_HEADER_UNIQUE_STATUS: u32 = 41u;
const SS_EXACT_NEAR_HEADER_CLEARED_WORDS: u32 = 45u;
const SS_EXACT_NEAR_HEADER_SOURCE_ADAPTER: u32 = 46u;
const SS_EXACT_NEAR_HEADER_PHYSICAL_UPPER_WORDS: u32 = 47u;

fn ss_exact_near_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn ss_exact_near_range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn ss_exact_near_low_bits_mask(bit_count: u32) -> u32 {
  if (bit_count == 0u) { return 0u; }
  if (bit_count >= 32u) { return 0xffffffffu; }
  return (1u << bit_count) - 1u;
}

fn ss_exact_near_support_profile_admitted(support_profile_id: u32) -> bool {
  return support_profile_id == SS_EXACT_NEAR_SUPPORT_PRESSURE_CONTACT_V1
    || support_profile_id == SS_EXACT_NEAR_SUPPORT_REACTION_DISCOVERY_V1
    || support_profile_id == SS_EXACT_NEAR_SUPPORT_REACTION_PRODUCT_PLACEMENT_V1
    || support_profile_id == SS_EXACT_NEAR_SUPPORT_SEPARATION_V1
    || support_profile_id == SS_EXACT_NEAR_SUPPORT_THERMAL_CONDUCTION_V1
    || support_profile_id == SS_EXACT_NEAR_SUPPORT_RADIATION_WIDE_V1
    || support_profile_id == SS_EXACT_NEAR_SUPPORT_MATERIAL_INTERFACE_LOCAL_V1;
}

fn ss_exact_near_directory_admitted(
  expected: SchroederSpatialExactNearExpectationV1
) -> bool {
  let bound_words = arrayLength(&${directoryBindingName});
  if (bound_words < SS_EXACT_NEAR_HEADER_WORDS) {
    return false;
  }
  let status = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_STATUS];
  let required_status = SS_EXACT_NEAR_STATUS_READY | SS_EXACT_NEAR_STATUS_ADMITTED;
  let rejected_status = SS_EXACT_NEAR_STATUS_FAIL_CLOSED
    | SS_EXACT_NEAR_STATUS_INVALID_SOURCE
    | SS_EXACT_NEAR_STATUS_CAPACITY_OVERFLOW;
  let source_count = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_SOURCE_COUNT];
  let source_capacity = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_SOURCE_CAPACITY];
  let cell_count = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  let cell_capacity = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_CAPACITY];
  let directory_capacity = ${directoryBindingName}[
    SS_EXACT_NEAR_HEADER_DIRECTORY_CAPACITY
  ];
  let logical_required = ${directoryBindingName}[
    SS_EXACT_NEAR_HEADER_LOGICAL_REQUIRED_WORDS
  ];
  let logical_admitted = ${directoryBindingName}[
    SS_EXACT_NEAR_HEADER_LOGICAL_ADMITTED_WORDS
  ];
  let physical_upper = ${directoryBindingName}[
    SS_EXACT_NEAR_HEADER_PHYSICAL_UPPER_WORDS
  ];
  let unique_status = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_UNIQUE_STATUS];
  let build_ordinal = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_BUILD_ORDINAL];
  if (
    expected.derivation_enabled == 0u
    || !ss_exact_near_support_profile_admitted(expected.support_profile_id)
    || source_count == 0u
    || source_count > source_capacity
    || directory_capacity > bound_words
    || physical_upper > directory_capacity
    || expected.level_count == 0u
    || expected.level_count > 64u
    || expected.chart_id > 0x00ffffffu
    || !ss_exact_near_finite(expected.base_grid_spacing_m)
    || expected.base_grid_spacing_m <= 0.0
  ) {
    return false;
  }
  let min_level_order = bitcast<u32>(expected.min_level) ^ 0x80000000u;
  let max_level_delta = expected.level_count - 1u;
  if (max_level_delta > 0xffffffffu - min_level_order) {
    return false;
  }
  let expected_max_level_order = min_level_order + max_level_delta;
  let expected_max_level = bitcast<i32>(expected_max_level_order ^ 0x80000000u);
  let min_spacing = expected.base_grid_spacing_m * exp2(f32(expected.min_level));
  let max_spacing = expected.base_grid_spacing_m * exp2(f32(expected_max_level));
  if (
    !ss_exact_near_finite(min_spacing)
    || min_spacing < 0.000001
    || !ss_exact_near_finite(max_spacing)
    || max_spacing <= 0.0
  ) {
    return false;
  }
  if (
    source_count > 0xffffffffu - expected.expected_particle_to_cell_offset_words
  ) {
    return false;
  }
  let query_evidence_offset = expected.expected_particle_to_cell_offset_words
    + source_count;
  if (!ss_exact_near_range_within(
    query_evidence_offset,
    SS_EXACT_NEAR_QUERY_EVIDENCE_WORDS,
    physical_upper
  )) {
    return false;
  }
  let evidence_chart_id = ${directoryBindingName}[query_evidence_offset];
  let evidence_min_level_bits = ${directoryBindingName}[query_evidence_offset + 1u];
  let evidence_max_level_bits = ${directoryBindingName}[query_evidence_offset + 2u];
  let evidence_base_spacing_bits = ${directoryBindingName}[
    query_evidence_offset + 3u
  ];
  let occupied_level_mask_low = ${directoryBindingName}[
    query_evidence_offset + 4u
  ];
  let occupied_level_mask_high = ${directoryBindingName}[
    query_evidence_offset + 5u
  ];
  let allowed_level_mask_low = ss_exact_near_low_bits_mask(
    min(expected.level_count, 32u)
  );
  let allowed_level_mask_high = ss_exact_near_low_bits_mask(
    select(0u, expected.level_count - 32u, expected.level_count > 32u)
  );
  return ${directoryBindingName}[SS_EXACT_NEAR_HEADER_MAGIC]
      == SS_EXACT_NEAR_MAGIC_V1
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_VERSION]
      == SS_EXACT_NEAR_ABI_VERSION_V1
    && (status & required_status) == required_status
    && (status & rejected_status) == 0u
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_GENERATION]
      == expected.expected_generation_id
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_DEVICE_ORDINAL]
      == expected.expected_device_ordinal
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_LANE_ORDINAL]
      == expected.expected_lane_ordinal
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_LEASE_TOKEN]
      == expected.expected_lease_token
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_SOURCE_FAMILY]
      == expected.expected_source_family_id
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_STORAGE_GENERATION]
      == expected.expected_storage_generation
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_PHYSICS_TICK]
      == expected.expected_physics_tick
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_PHYSICS_SUBSTEP]
      == expected.expected_physics_substep
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_POSITION_EPOCH]
      == expected.expected_position_epoch
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_TOPOLOGY_EPOCH]
      == expected.expected_topology_epoch
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CHART_EPOCH]
      == expected.expected_chart_epoch
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_LEVEL_EPOCH]
      == expected.expected_level_epoch
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_SUPPORT_EPOCH]
      == expected.expected_support_epoch
    && source_count == expected.source_count
    && source_capacity == expected.expected_source_capacity
    && cell_count > 0u
    && cell_count <= source_count
    && cell_count <= cell_capacity
    && cell_capacity == expected.expected_cell_capacity
    && directory_capacity == expected.expected_directory_capacity_words
    && logical_required == logical_admitted
    && logical_admitted >= SS_EXACT_NEAR_HEADER_WORDS
    && logical_admitted <= physical_upper
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_INVALID_SOURCE_COUNT] == 0u
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_OVERFLOW_COUNT] == 0u
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_EXACT_KEY_WORDS]
      == SS_EXACT_NEAR_KEY_WORDS
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_SORT_KEY_WORDS]
      == SS_EXACT_NEAR_KEY_WORDS
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_SORT_MODE]
      == SS_EXACT_NEAR_SORT_LEXICOGRAPHIC_U32X5
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_WORD_COUNT]
      == SS_EXACT_NEAR_HEADER_WORDS
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_KEYS_OFFSET]
      == expected.expected_cell_keys_offset_words
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_OFFSETS_OFFSET]
      == expected.expected_cell_offsets_offset_words
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_MEMBERS_OFFSET]
      == expected.expected_cell_members_offset_words
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_PARTICLE_TO_CELL_OFFSET]
      == expected.expected_particle_to_cell_offset_words
    && build_ordinal != 0u
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_SORT_UNIQUE_ORDINAL]
      == build_ordinal
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_COMPLETION_ORDINAL]
      == build_ordinal
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_UNIQUE_GENERATION]
      == expected.expected_generation_id
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_UNIQUE_INPUT_COUNT]
      == source_count
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_UNIQUE_COUNT] == cell_count
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_UNIQUE_ADMITTED] != 0u
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_UNIQUE_OVERFLOW] == 0u
    && (unique_status & SS_EXACT_NEAR_PRIMITIVE_STATUS_READY) != 0u
    && (unique_status & SS_EXACT_NEAR_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CLEARED_WORDS]
      >= SS_EXACT_NEAR_HEADER_WORDS
    && ${directoryBindingName}[SS_EXACT_NEAR_HEADER_SOURCE_ADAPTER]
      == SS_EXACT_NEAR_SOURCE_ADAPTER_QUERY_V1
    && evidence_chart_id == expected.chart_id
    && evidence_min_level_bits == bitcast<u32>(expected.min_level)
    && (evidence_max_level_bits ^ 0x80000000u) == expected_max_level_order
    && evidence_base_spacing_bits == bitcast<u32>(expected.base_grid_spacing_m)
    && (occupied_level_mask_low | occupied_level_mask_high) != 0u
    && (occupied_level_mask_low & ~allowed_level_mask_low) == 0u
    && (occupied_level_mask_high & ~allowed_level_mask_high) == 0u
    && ss_exact_near_range_within(
      expected.expected_cell_keys_offset_words,
      cell_count * SS_EXACT_NEAR_KEY_WORDS,
      physical_upper
    )
    && ss_exact_near_range_within(
      expected.expected_cell_offsets_offset_words,
      cell_count + 1u,
      physical_upper
    )
    && ss_exact_near_range_within(
      expected.expected_cell_members_offset_words,
      source_count,
      physical_upper
    )
    && ss_exact_near_range_within(
      expected.expected_particle_to_cell_offset_words,
      source_count,
      physical_upper
    )
    && ${directoryBindingName}[expected.expected_cell_offsets_offset_words] == 0u
    && ${directoryBindingName}[
      expected.expected_cell_offsets_offset_words + cell_count
    ] == source_count;
}

fn ss_exact_near_signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn ss_exact_near_compare_word(left: u32, right: u32) -> i32 {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

fn ss_exact_near_compare_cell_key(
  expected: SchroederSpatialExactNearExpectationV1,
  cell_index: u32,
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> i32 {
  let key_offset = expected.expected_cell_keys_offset_words
    + cell_index * SS_EXACT_NEAR_KEY_WORDS;
  var comparison = ss_exact_near_compare_word(
    ${directoryBindingName}[key_offset],
    chart
  );
  if (comparison != 0) {
    return comparison;
  }
  comparison = ss_exact_near_compare_word(
    ${directoryBindingName}[key_offset + 1u],
    level_order
  );
  if (comparison != 0) {
    return comparison;
  }
  comparison = ss_exact_near_compare_word(
    ${directoryBindingName}[key_offset + 2u],
    cell_order.x
  );
  if (comparison != 0) {
    return comparison;
  }
  comparison = ss_exact_near_compare_word(
    ${directoryBindingName}[key_offset + 3u],
    cell_order.y
  );
  if (comparison != 0) {
    return comparison;
  }
  return ss_exact_near_compare_word(
    ${directoryBindingName}[key_offset + 4u],
    cell_order.z
  );
}

fn ss_exact_near_lower_bound_cell_key_range(
  expected: SchroederSpatialExactNearExpectationV1,
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>,
  range_begin: u32,
  range_end: u32
) -> u32 {
  let cell_count = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  if (range_begin > range_end || range_end > cell_count) { return cell_count; }
  var lower = range_begin;
  var upper = range_end;
  for (
    var iteration = 0u;
    iteration < 32u && lower < upper;
    iteration = iteration + 1u
  ) {
    let middle = lower + (upper - lower) / 2u;
    let comparison = ss_exact_near_compare_cell_key(
      expected,
      middle,
      chart,
      level_order,
      cell_order
    );
    if (comparison < 0) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  if (lower < upper) {
    return range_end;
  }
  return lower;
}

fn ss_exact_near_upper_bound_cell_key_range(
  expected: SchroederSpatialExactNearExpectationV1,
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>,
  range_begin: u32,
  range_end: u32
) -> u32 {
  let cell_count = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  if (range_begin > range_end || range_end > cell_count) { return cell_count; }
  var lower = range_begin;
  var upper = range_end;
  for (
    var iteration = 0u;
    iteration < 32u && lower < upper;
    iteration = iteration + 1u
  ) {
    let middle = lower + (upper - lower) / 2u;
    let comparison = ss_exact_near_compare_cell_key(
      expected,
      middle,
      chart,
      level_order,
      cell_order
    );
    if (comparison <= 0) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  if (lower < upper) {
    return range_end;
  }
  return lower;
}

fn ss_exact_near_lower_bound_cell_key(
  expected: SchroederSpatialExactNearExpectationV1,
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> u32 {
  return ss_exact_near_lower_bound_cell_key_range(
    expected,
    chart,
    level_order,
    cell_order,
    0u,
    ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_COUNT]
  );
}

fn ss_exact_near_upper_bound_cell_key(
  expected: SchroederSpatialExactNearExpectationV1,
  chart: u32,
  level_order: u32,
  cell_order: vec3<u32>
) -> u32 {
  return ss_exact_near_upper_bound_cell_key_range(
    expected,
    chart,
    level_order,
    cell_order,
    0u,
    ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_COUNT]
  );
}

fn ss_exact_near_cell_key_word(
  expected: SchroederSpatialExactNearExpectationV1,
  cell_index: u32,
  word_index: u32
) -> u32 {
  return ${directoryBindingName}[
    expected.expected_cell_keys_offset_words
      + cell_index * SS_EXACT_NEAR_KEY_WORDS
      + word_index
  ];
}

fn ss_exact_near_saturating_sub_radius(value: i32, radius: i32) -> i32 {
  let minimum = -2147483647 - 1;
  if (radius > 0 && value < minimum + radius) {
    return minimum;
  }
  return value - radius;
}

fn ss_exact_near_saturating_add_radius(value: i32, radius: i32) -> i32 {
  let maximum = 2147483647;
  if (radius > 0 && value > maximum - radius) {
    return maximum;
  }
  return value + radius;
}

fn ss_exact_near_invalid_range() -> SchroederSpatialExactNearRangeV1 {
  return SchroederSpatialExactNearRangeV1(0u, 0u, 0u);
}

fn ss_exact_near_cell_range(
  expected: SchroederSpatialExactNearExpectationV1,
  chart: u32,
  level_order: u32,
  minimum_order: vec3<u32>,
  maximum_order: vec3<u32>
) -> SchroederSpatialExactNearRangeV1 {
  let cell_count = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  let begin = ss_exact_near_lower_bound_cell_key(
    expected,
    chart,
    level_order,
    minimum_order
  );
  let end = ss_exact_near_upper_bound_cell_key(
    expected,
    chart,
    level_order,
    maximum_order
  );
  if (begin > end || end > cell_count) {
    return ss_exact_near_invalid_range();
  }
  return SchroederSpatialExactNearRangeV1(1u, begin, end);
}

fn ss_exact_near_cell_member_range(
  expected: SchroederSpatialExactNearExpectationV1,
  cell_index: u32
) -> SchroederSpatialExactNearRangeV1 {
  let cell_count = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  if (cell_index >= cell_count) {
    return ss_exact_near_invalid_range();
  }
  let member_begin = ${directoryBindingName}[
    expected.expected_cell_offsets_offset_words + cell_index
  ];
  let member_end = ${directoryBindingName}[
    expected.expected_cell_offsets_offset_words + cell_index + 1u
  ];
  if (member_begin > member_end || member_end > expected.source_count) {
    return ss_exact_near_invalid_range();
  }
  return SchroederSpatialExactNearRangeV1(1u, member_begin, member_end);
}

fn ss_exact_near_source_at_member(
  expected: SchroederSpatialExactNearExpectationV1,
  member_offset: u32
) -> SchroederSpatialExactNearSourceLookupV1 {
  if (member_offset >= expected.source_count) {
    return SchroederSpatialExactNearSourceLookupV1(0u, 0u);
  }
  let source_index = ${directoryBindingName}[
    expected.expected_cell_members_offset_words + member_offset
  ];
  if (source_index >= expected.source_count) {
    return SchroederSpatialExactNearSourceLookupV1(0u, 0u);
  }
  return SchroederSpatialExactNearSourceLookupV1(1u, source_index);
}

fn ss_exact_near_cell_for_source(
  expected: SchroederSpatialExactNearExpectationV1,
  source_index: u32
) -> SchroederSpatialExactNearSourceLookupV1 {
  if (source_index >= expected.source_count) {
    return SchroederSpatialExactNearSourceLookupV1(0u, 0u);
  }
  let cell_index = ${directoryBindingName}[
    expected.expected_particle_to_cell_offset_words + source_index
  ];
  let cell_count = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  if (cell_index >= cell_count) {
    return SchroederSpatialExactNearSourceLookupV1(0u, 0u);
  }
  return SchroederSpatialExactNearSourceLookupV1(1u, cell_index);
}

fn ss_exact_near_level_occupied(
  expected: SchroederSpatialExactNearExpectationV1,
  level_ordinal: u32
) -> bool {
  if (level_ordinal >= expected.level_count || level_ordinal >= 64u) {
    return false;
  }
  let query_evidence_offset = expected.expected_particle_to_cell_offset_words
    + expected.source_count;
  let mask_word = ${directoryBindingName}[
    query_evidence_offset + 4u + level_ordinal / 32u
  ];
  return (mask_word & (1u << (level_ordinal % 32u))) != 0u;
}
`;
}

export function createSchroederSpatialExactNearTraversalV1Wgsl({
  directoryBindingName = 'spatial_directory'
} = {}) {
  if (!WGSL_IDENTIFIER.test(directoryBindingName)) {
    throw new TypeError('directoryBindingName must be a WGSL identifier');
  }
  return exactNearTraversalSource(directoryBindingName);
}

export const schroederSpatialExactNearTraversalV1Wgsl =
  createSchroederSpatialExactNearTraversalV1Wgsl();
