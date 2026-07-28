export const schroederSpatialAggregateViewWgsl = /* wgsl */ `
struct AggregateParams {
  source_count: u32,
  source_capacity: u32,
  cell_capacity: u32,
  source_row_layout_id: u32,
  state_stride_floats: u32,
  thermo_stride_floats: u32,
  identity_stride_words: u32,
  view_capacity_words: u32,
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
  completion_ordinal: u32,
  directory_capacity_words: u32,
  directory_cell_capacity: u32,
  source_adapter_id: u32,
  header_words: u32,
  record_words: u32,
  tree_arity: u32,
  workgroup_size: u32,
  prefix_bit_count: u32,
  dispatch_words: u32,
  topology_mode: u32,
  cleared_words: u32,
  active_member_offset_words: u32,
  active_member_capacity: u32,
  physical_capacity_words: u32,
  directory_abi_version: u32,
  reverse_encoding: u32,
  active_count_authority_word: u32,
  active_source_capacity: u32,
  pad07: u32,
  pad08: u32,
  pad09: u32,
  pad10: u32,
  pad11: u32,
  pad12: u32,
  pad13: u32,
  pad14: u32,
  pad15: u32,
  pad16: u32,
  pad17: u32,
  pad18: u32,
  pad19: u32,
  pad20: u32,
  pad21: u32,
  pad22: u32,
  pad23: u32,
  pad24: u32,
  pad25: u32,
  pad26: u32,
  pad27: u32,
  pad28: u32,
  pad29: u32,
  pad30: u32,
};

struct AggregateRecord {
  mass: f32,
  first_moment: vec3<f32>,
  momentum: vec3<f32>,
  angular_momentum: vec3<f32>,
  internal_energy: f32,
  kinetic_energy: f32,
  aabb_min: vec3<f32>,
  aabb_max: vec3<f32>,
  radius: f32,
  particle_count: u32,
  material_mask: vec4<u32>,
  phase_mask: u32,
  homogeneous_material: u32,
  homogeneous_phase: u32,
  homogeneous_domain: u32,
  status: u32,
  begin: u32,
  end: u32,
  source_member_count: u32,
};

@group(0) @binding(0) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(1) var<storage, read> spatial_source_rows: array<f32>;
@group(0) @binding(2) var<storage, read> particle_state: array<f32>;
@group(0) @binding(3) var<storage, read> particle_thermo: array<f32>;
@group(0) @binding(4) var<storage, read> particle_identity: array<u32>;
@group(0) @binding(5) var<storage, read_write> aggregate_view: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> params: AggregateParams;
@group(0) @binding(7) var<storage, read_write> aggregate_dispatch: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read_write> aggregate_keys: array<u32>;
@group(0) @binding(9) var<storage, read> sorted_indices: array<u32>;

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
const SPATIAL_REVERSE_CELL_PLUS_ONE: u32 = 1u;
const SOURCE_LAYOUT_LEVEL_ASSIGNMENT: u32 = 1u;
const SOURCE_LAYOUT_ACTIVE_NODE: u32 = 2u;

const AGGREGATE_MAGIC: u32 = 0x53414731u;
const AGGREGATE_VERSION: u32 = 2u;
const AGGREGATE_STATUS_READY: u32 = 1u;
const AGGREGATE_STATUS_ADMITTED: u32 = 2u;
const AGGREGATE_STATUS_FAIL_CLOSED: u32 = 4u;
const AGGREGATE_STATUS_INVALID_SOURCE: u32 = 8u;
const AGGREGATE_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const AGGREGATE_STATUS_NONFINITE: u32 = 32u;
const AGGREGATE_STATUS_IDENTITY_MISMATCH: u32 = 64u;
const AGGREGATE_STATUS_MALFORMED_TOPOLOGY: u32 = 128u;
const AGGREGATE_STATUS_TRAVERSAL_READY: u32 = 256u;
const ACTIVE_MEMBER_MAGIC: u32 = 0x53414d31u;
const ACTIVE_MEMBER_VERSION: u32 = 1u;
const ACTIVE_MEMBER_STATUS_READY: u32 = 1u;
const ACTIVE_MEMBER_STATUS_ADMITTED: u32 = 2u;
const ACTIVE_MEMBER_STATUS_FAIL_CLOSED: u32 = 4u;
const ACTIVE_MEMBER_CONSTRUCTION_CELL_PREFIX: u32 = 1u;
const RECORD_STATUS_VALID: u32 = 1u;
const RECORD_STATUS_LEAF: u32 = 2u;
const RECORD_STATUS_INTERNAL: u32 = 4u;
const RECORD_STATUS_ROOT: u32 = 8u;
const RECORD_STATUS_MIXED_MATERIAL: u32 = 16u;
const RECORD_STATUS_MIXED_PHASE: u32 = 32u;
const RECORD_STATUS_TOPOLOGY_AUTHENTICATED: u32 = 64u;
const RECORD_STATUS_HOMOGENEOUS_DOMAIN_SUMMARY_EXACT: u32 = 128u;
const INVALID_U32: u32 = 0xffffffffu;
const MAX_EXACT_F32_INTEGER: f32 = 16777215.0;
const MAX_F32: f32 = 3.402823e38;
const TREE_ARITY: u32 = 2u;
const KEY_WORDS: u32 = 5u;
const PREFIX_BIT_COUNT: u32 = 160u;
const TOPOLOGY_MODE: u32 = 2u;
const TOPOLOGY_FINGERPRINT_DOMAIN: u32 = 0x544f504fu;
const DISPATCH_SLOT_CELLS: u32 = 0u;
const DISPATCH_SLOT_INTERNALS: u32 = 1u;
const DISPATCH_SLOT_RECORDS: u32 = 2u;

const H_STATUS: u32 = 2u;
const H_SOURCE_COUNT: u32 = 16u;
const H_SOURCE_CAPACITY: u32 = 17u;
const H_CELL_COUNT: u32 = 18u;
const H_CELL_CAPACITY: u32 = 19u;
const H_RECORD_WORDS: u32 = 20u;
const H_RECORD_OFFSET: u32 = 21u;
const H_RECORD_CAPACITY: u32 = 22u;
const H_LEAF_COUNT: u32 = 23u;
const H_TREE_ARITY: u32 = 24u;
const H_INTERNAL_OFFSET: u32 = 25u;
const H_INTERNAL_CAPACITY: u32 = 26u;
const H_INTERNAL_COUNT: u32 = 27u;
const H_ROOT_OFFSET: u32 = 28u;
const H_NODE_COUNT: u32 = 29u;
const H_REQUIRED_WORDS: u32 = 30u;
const H_CAPACITY_WORDS: u32 = 31u;
const H_INVALID_SOURCE_COUNT: u32 = 32u;
const H_NONFINITE_SOURCE_COUNT: u32 = 33u;
const H_IDENTITY_MISMATCH_COUNT: u32 = 34u;
const H_OVERFLOW_COUNT: u32 = 35u;
const H_ATTEMPTED_SOURCE_COUNT: u32 = 36u;
const H_REDUCED_SOURCE_COUNT: u32 = 37u;
const H_REDUCED_LEAF_COUNT: u32 = 38u;
const H_REDUCED_INTERNAL_COUNT: u32 = 39u;
const H_COMPLETION_ORDINAL: u32 = 40u;
const H_TOPOLOGY_MODE: u32 = 51u;
const H_PREFIX_BIT_CAPACITY: u32 = 52u;
const H_ROOT_RECORD_INDEX: u32 = 53u;
const H_TOTAL_RECORD_COUNT: u32 = 54u;
const H_INTERNAL_RECORD_COUNT: u32 = 55u;
const H_TOPOLOGY_FINGERPRINT: u32 = 56u;
const H_TRAVERSAL_STATUS: u32 = 57u;
const H_TRAVERSAL_LEAF_COVERAGE: u32 = 58u;
const H_MALFORMED_TOPOLOGY_COUNT: u32 = 59u;
const H_DISPATCH_WORDS: u32 = 60u;
const H_LIVE_HIGH_WATER: u32 = 61u;
const H_REPLAY_GUARD_TOKEN: u32 = 62u;
const H_HEADER_FINGERPRINT: u32 = 63u;
const H_EMITTED_KEY_COUNT: u32 = 72u;
const H_INITIALIZED_RECORD_COUNT: u32 = 73u;
const H_BUILT_INTERNAL_COUNT: u32 = 74u;
const H_PARENT_ASSIGNMENT_COUNT: u32 = 75u;
const H_ROPE_COUNT: u32 = 76u;
const H_AUTHENTICATED_RECORD_COUNT: u32 = 77u;
const H_AUTHENTICATED_ROOT_COUNT: u32 = 78u;
const H_DUPLICATE_KEY_COUNT: u32 = 79u;
const H_ACTIVE_MEMBER_MAGIC: u32 = 91u;
const H_ACTIVE_MEMBER_VERSION: u32 = 92u;
const H_ACTIVE_MEMBER_STATUS: u32 = 93u;
const H_ACTIVE_MEMBER_OFFSET: u32 = 94u;
const H_ACTIVE_MEMBER_CAPACITY: u32 = 95u;
const H_ACTIVE_MEMBER_COUNT: u32 = 96u;
const H_ACTIVE_MEMBER_SOURCE_COUNT: u32 = 97u;
const H_ACTIVE_MEMBER_CELL_COUNT: u32 = 98u;
const H_ACTIVE_MEMBER_GENERATION_ID: u32 = 99u;
const H_ACTIVE_MEMBER_COMPLETION_ORDINAL: u32 = 100u;
const H_ACTIVE_MEMBER_REPLAY_TOKEN: u32 = 101u;
const H_ACTIVE_MEMBER_SOURCE_ADAPTER_ID: u32 = 102u;
const H_ACTIVE_MEMBER_DIRECTORY_OFFSET: u32 = 103u;
const H_ACTIVE_MEMBER_REDUCED_CELL_COUNT: u32 = 104u;
const H_ACTIVE_MEMBER_INVALID_COUNT: u32 = 105u;
const H_ACTIVE_MEMBER_CONSTRUCTION_MODE: u32 = 106u;
const H_ACTIVE_MEMBER_PHYSICAL_CAPACITY: u32 = 107u;
const H_ACTIVE_MEMBER_SOURCE_LAYOUT: u32 = 108u;
const H_ACTIVE_MEMBER_STORAGE_GENERATION: u32 = 109u;
const H_ACTIVE_MEMBER_FINGERPRINT: u32 = 110u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= MAX_F32;
}

fn finite_vec3(value: vec3<f32>) -> bool {
  return finite_f32(value.x) && finite_f32(value.y) && finite_f32(value.z);
}

fn integral_f32(value: f32) -> bool {
  return finite_f32(value) && value == trunc(value);
}

fn range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn mix_u32(input_value: u32) -> u32 {
  var value = input_value;
  value = (value ^ (value >> 16u)) * 0x7feb352du;
  value = (value ^ (value >> 15u)) * 0x846ca68bu;
  return value ^ (value >> 16u);
}

fn fold_fingerprint(seed: u32, value: u32) -> u32 {
  return mix_u32(seed ^ mix_u32(value));
}

fn load_word(index: u32) -> u32 {
  return atomicLoad(&aggregate_view[index]);
}

fn store_word(index: u32, value: u32) {
  atomicStore(&aggregate_view[index], value);
}

fn store_f32(index: u32, value: f32) {
  store_word(index, bitcast<u32>(value));
}

fn record_base(record_index: u32) -> u32 {
  return params.header_words + record_index * params.record_words;
}

fn key_base(cell_index: u32) -> u32 {
  return cell_index * KEY_WORDS;
}

fn dispatch_store(slot: u32, x: u32) {
  let base = slot * 3u;
  atomicStore(&aggregate_dispatch[base], x);
  atomicStore(&aggregate_dispatch[base + 1u], select(0u, 1u, x > 0u));
  atomicStore(&aggregate_dispatch[base + 2u], select(0u, 1u, x > 0u));
}

fn zero_dispatches() {
  dispatch_store(DISPATCH_SLOT_CELLS, 0u);
  dispatch_store(DISPATCH_SLOT_INTERNALS, 0u);
  dispatch_store(DISPATCH_SLOT_RECORDS, 0u);
}

fn directory_v1_admitted() -> bool {
  let bound_words = arrayLength(&spatial_directory);
  if (
    bound_words < SPATIAL_HEADER_WORDS
    || params.directory_abi_version != SPATIAL_VERSION_V1
    || params.reverse_encoding != 0u
    || arrayLength(&aggregate_view) < 112u
    || params.header_words != 112u
    || params.record_words != 44u
    || params.tree_arity != TREE_ARITY
    || params.workgroup_size != 64u
    || params.prefix_bit_count != PREFIX_BIT_COUNT
    || params.dispatch_words != 9u
    || params.topology_mode != TOPOLOGY_MODE
    || params.state_stride_floats != 8u
    || params.thermo_stride_floats != 12u
    || params.identity_stride_words != 1u
    || params.active_member_offset_words != params.view_capacity_words
    || params.active_member_capacity != params.source_capacity
    || params.physical_capacity_words
      != params.active_member_offset_words + params.active_member_capacity
    || params.physical_capacity_words > arrayLength(&aggregate_view)
    || (
      params.source_row_layout_id != SOURCE_LAYOUT_LEVEL_ASSIGNMENT
      && params.source_row_layout_id != SOURCE_LAYOUT_ACTIVE_NODE
    )
    || arrayLength(&aggregate_dispatch) < params.dispatch_words
  ) {
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
  let sort_key_words = spatial_directory[26u];
  let sort_mode = spatial_directory[27u];
  let sort_mode_admitted = (
    sort_mode == SPATIAL_SORT_BOUNDED_ATLAS_U32 && sort_key_words == 1u
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
    || source_capacity != params.source_capacity
    || cell_capacity != params.directory_cell_capacity
    || cell_capacity != params.cell_capacity
    || cell_keys_offset_words != SPATIAL_HEADER_WORDS
    || cell_capacity > (directory_capacity_words - cell_keys_offset_words) / SPATIAL_KEY_WORDS
    || cell_offsets_offset_words != cell_keys_offset_words + cell_capacity * SPATIAL_KEY_WORDS
    || !range_within(cell_offsets_offset_words, cell_capacity + 1u, directory_capacity_words)
    || cell_members_offset_words != cell_offsets_offset_words + cell_capacity + 1u
    || !range_within(cell_members_offset_words, source_capacity, directory_capacity_words)
    || particle_to_cell_offset_words != cell_members_offset_words + source_capacity
    || !range_within(particle_to_cell_offset_words, source_capacity, directory_capacity_words)
    || !range_within(cell_keys_offset_words, cell_count * SPATIAL_KEY_WORDS, physical_upper_bound_words)
    || !range_within(cell_offsets_offset_words, cell_count + 1u, physical_upper_bound_words)
    || !range_within(cell_members_offset_words, source_count, physical_upper_bound_words)
    || !range_within(particle_to_cell_offset_words, source_count, physical_upper_bound_words)
  ) {
    return false;
  }
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
    && cell_count <= 0x3fffffffu
    && spatial_directory[20u] == spatial_directory[21u]
    && spatial_directory[23u] == 0u
    && spatial_directory[24u] == 0u
    && spatial_directory[25u] == SPATIAL_KEY_WORDS
    && sort_mode_admitted
    && spatial_directory[28u] == SPATIAL_HEADER_WORDS
    && spatial_directory[34u] == build_ordinal
    && spatial_directory[35u] == params.completion_ordinal
    && spatial_directory[36u] == params.generation_id
    && spatial_directory[37u] == source_count
    && spatial_directory[38u] == cell_count
    && spatial_directory[39u] != 0u
    && spatial_directory[40u] == 0u
    && (spatial_directory[41u] & SPATIAL_PRIMITIVE_STATUS_READY) != 0u
    && (spatial_directory[41u] & SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && spatial_directory[45u] == 67u
    && spatial_directory[46u] == params.source_adapter_id
    && arrayLength(&spatial_source_rows) >= source_count * 16u
    && arrayLength(&particle_state) >= source_count * params.state_stride_floats
    && arrayLength(&particle_thermo) >= source_count * params.thermo_stride_floats
    && arrayLength(&particle_identity) >= source_count * params.identity_stride_words;
}

fn directory_v2_admitted() -> bool {
  let bound_words = arrayLength(&spatial_directory);
  if (
    bound_words < SPATIAL_HEADER_WORDS
    || params.directory_abi_version != SPATIAL_VERSION_V2
    || params.reverse_encoding != SPATIAL_REVERSE_CELL_PLUS_ONE
    || params.active_count_authority_word != 18u
    || params.source_row_layout_id != SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    || arrayLength(&aggregate_view) < 112u
    || params.header_words != 112u
    || params.record_words != 44u
    || params.tree_arity != TREE_ARITY
    || params.workgroup_size != 64u
    || params.prefix_bit_count != PREFIX_BIT_COUNT
    || params.dispatch_words != 9u
    || params.topology_mode != TOPOLOGY_MODE
    || params.state_stride_floats != 8u
    || params.thermo_stride_floats != 12u
    || params.identity_stride_words != 1u
    || params.active_member_offset_words != params.view_capacity_words
    || params.active_member_capacity != params.source_capacity
    || params.physical_capacity_words
      != params.active_member_offset_words + params.active_member_capacity
    || params.physical_capacity_words > arrayLength(&aggregate_view)
    || arrayLength(&aggregate_dispatch) < params.dispatch_words
  ) {
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
  let build_ordinal = spatial_directory[33u];
  let active_count = spatial_directory[37u];
  let physical_upper_bound_words = spatial_directory[47u];
  let consumer_group_count = (cell_count + 63u) / 64u;
  let consumer_dispatch_x = spatial_directory[42u];
  let consumer_dispatch_y = spatial_directory[43u];
  let consumer_dispatch_z = spatial_directory[44u];
  let empty_dispatch = cell_count == 0u
    && consumer_dispatch_x == 0u
    && consumer_dispatch_y == 0u
    && consumer_dispatch_z == 0u;
  let live_dispatch = cell_count > 0u
    && consumer_dispatch_x > 0u
    && consumer_dispatch_y > 0u
    && consumer_dispatch_z == 1u
    && consumer_dispatch_x * consumer_dispatch_y >= consumer_group_count
    && (consumer_dispatch_y - 1u) * consumer_dispatch_x
      < consumer_group_count;
  if (
    directory_capacity_words > bound_words
    || directory_capacity_words != params.directory_capacity_words
    || physical_upper_bound_words < SPATIAL_HEADER_WORDS
    || physical_upper_bound_words > directory_capacity_words
    || logical_required_words < SPATIAL_HEADER_WORDS
    || logical_admitted_words != logical_required_words
    || logical_required_words > physical_upper_bound_words
    || physical_capacity != params.source_capacity
    || cell_capacity != params.directory_cell_capacity
    || cell_capacity != params.cell_capacity
    || params.active_source_capacity > physical_capacity
    || cell_keys_offset_words != SPATIAL_HEADER_WORDS
    || cell_capacity
      > (directory_capacity_words - cell_keys_offset_words)
        / SPATIAL_KEY_WORDS
    || cell_offsets_offset_words
      != cell_keys_offset_words + cell_capacity * SPATIAL_KEY_WORDS
    || !range_within(
      cell_offsets_offset_words,
      cell_capacity + 1u,
      directory_capacity_words
    )
    || cell_members_offset_words
      != cell_offsets_offset_words + cell_capacity + 1u
    || !range_within(
      cell_members_offset_words,
      physical_capacity,
      directory_capacity_words
    )
    || physical_to_cell_plus_one_offset_words
      != cell_members_offset_words + physical_capacity
    || !range_within(
      physical_to_cell_plus_one_offset_words,
      physical_capacity,
      directory_capacity_words
    )
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
    && active_count <= physical_count
    && active_count <= params.active_source_capacity
    && cell_count <= active_count
    && (active_count == 0u) == (cell_count == 0u)
    && cell_count <= cell_capacity
    && cell_count <= 0x3fffffffu
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
    && (spatial_directory[41u] & SPATIAL_PRIMITIVE_STATUS_READY) != 0u
    && (spatial_directory[41u] & SPATIAL_PRIMITIVE_STATUS_FAIL_CLOSED) == 0u
    && spatial_directory[45u] == 67u
    && spatial_directory[46u] == params.source_adapter_id
    && spatial_directory[cell_offsets_offset_words + cell_count] == active_count
    && (empty_dispatch || live_dispatch)
    && arrayLength(&spatial_source_rows) >= physical_count * 16u
    && arrayLength(&particle_state)
      >= physical_count * params.state_stride_floats
    && arrayLength(&particle_thermo)
      >= physical_count * params.thermo_stride_floats
    && arrayLength(&particle_identity)
      >= physical_count * params.identity_stride_words;
}

fn directory_admitted() -> bool {
  if (params.directory_abi_version == SPATIAL_VERSION_V1) {
    return directory_v1_admitted();
  }
  if (params.directory_abi_version == SPATIAL_VERSION_V2) {
    return directory_v2_admitted();
  }
  return false;
}

fn directory_member_count() -> u32 {
  return select(
    params.source_count,
    spatial_directory[37u],
    params.directory_abi_version == SPATIAL_VERSION_V2
  );
}

fn replay_guard_token(cell_count: u32) -> u32 {
  var token = fold_fingerprint(AGGREGATE_MAGIC, params.source_count);
  token = fold_fingerprint(token, cell_count);
  token = fold_fingerprint(token, params.generation_id);
  token = fold_fingerprint(token, params.storage_generation);
  token = fold_fingerprint(token, params.position_epoch);
  token = fold_fingerprint(token, params.topology_epoch);
  token = fold_fingerprint(token, params.chart_epoch);
  token = fold_fingerprint(token, params.level_epoch);
  token = fold_fingerprint(token, params.support_epoch);
  return fold_fingerprint(token, params.completion_ordinal);
}

fn active_member_projection_fingerprint(active_member_count: u32) -> u32 {
  var value = fold_fingerprint(
    load_word(H_ACTIVE_MEMBER_REPLAY_TOKEN),
    ACTIVE_MEMBER_MAGIC
  );
  value = fold_fingerprint(value, params.active_member_offset_words);
  value = fold_fingerprint(value, params.active_member_capacity);
  value = fold_fingerprint(value, params.source_count);
  value = fold_fingerprint(value, load_word(H_CELL_COUNT));
  value = fold_fingerprint(value, active_member_count);
  value = fold_fingerprint(value, params.generation_id);
  value = fold_fingerprint(value, params.storage_generation);
  return fold_fingerprint(value, params.completion_ordinal);
}

fn fail_initialization(status: u32) {
  if (arrayLength(&aggregate_view) >= 3u) {
    store_word(0u, AGGREGATE_MAGIC);
    store_word(1u, AGGREGATE_VERSION);
    store_word(H_STATUS, AGGREGATE_STATUS_FAIL_CLOSED | status);
  }
  if (arrayLength(&aggregate_view) > H_ACTIVE_MEMBER_FINGERPRINT) {
    store_word(H_ACTIVE_MEMBER_MAGIC, ACTIVE_MEMBER_MAGIC);
    store_word(H_ACTIVE_MEMBER_VERSION, ACTIVE_MEMBER_VERSION);
    store_word(H_ACTIVE_MEMBER_STATUS, ACTIVE_MEMBER_STATUS_FAIL_CLOSED);
    store_word(H_ACTIVE_MEMBER_FINGERPRINT, 0u);
  }
  zero_dispatches();
}

@compute @workgroup_size(1)
fn initialize_aggregate_view() {
  if (!directory_admitted()) {
    fail_initialization(AGGREGATE_STATUS_IDENTITY_MISMATCH);
    if (arrayLength(&aggregate_view) > H_IDENTITY_MISMATCH_COUNT) {
      atomicAdd(&aggregate_view[H_IDENTITY_MISMATCH_COUNT], 1u);
    }
    return;
  }
  let cell_count = spatial_directory[18u];
  let internal_count = select(cell_count - 1u, 0u, cell_count == 0u);
  let record_count = cell_count + internal_count;
  var root_record_index = INVALID_U32;
  if (cell_count == 1u) {
    root_record_index = 0u;
  } else if (cell_count > 1u) {
    root_record_index = cell_count;
  }
  let record_capacity = (params.view_capacity_words - params.header_words)
    / params.record_words;
  let required_words = params.header_words + record_count * params.record_words;
  if (
    record_count > record_capacity
    || required_words > params.view_capacity_words
    || params.view_capacity_words > arrayLength(&aggregate_view)
  ) {
    fail_initialization(AGGREGATE_STATUS_CAPACITY_OVERFLOW);
    atomicAdd(&aggregate_view[H_OVERFLOW_COUNT], 1u);
    return;
  }
  let replay_token = replay_guard_token(cell_count);
  var topology_fingerprint_seed = fold_fingerprint(
    replay_token,
    TOPOLOGY_FINGERPRINT_DOMAIN
  );
  topology_fingerprint_seed = fold_fingerprint(
    topology_fingerprint_seed,
    record_count
  );
  if (topology_fingerprint_seed == 0u) {
    topology_fingerprint_seed = TOPOLOGY_FINGERPRINT_DOMAIN;
  }
  store_word(0u, AGGREGATE_MAGIC);
  store_word(1u, AGGREGATE_VERSION);
  store_word(H_STATUS, 0u);
  store_word(3u, params.generation_id);
  store_word(4u, params.device_ordinal);
  store_word(5u, params.lane_ordinal);
  store_word(6u, params.lease_token);
  store_word(7u, params.source_family_id);
  store_word(8u, params.storage_generation);
  store_word(9u, params.physics_tick);
  store_word(10u, params.physics_substep);
  store_word(11u, params.position_epoch);
  store_word(12u, params.topology_epoch);
  store_word(13u, params.chart_epoch);
  store_word(14u, params.level_epoch);
  store_word(15u, params.support_epoch);
  store_word(H_SOURCE_COUNT, params.source_count);
  store_word(H_SOURCE_CAPACITY, params.source_capacity);
  store_word(H_CELL_COUNT, cell_count);
  store_word(H_CELL_CAPACITY, params.cell_capacity);
  store_word(H_RECORD_WORDS, params.record_words);
  store_word(H_RECORD_OFFSET, params.header_words);
  store_word(H_RECORD_CAPACITY, record_capacity);
  store_word(H_LEAF_COUNT, cell_count);
  store_word(H_TREE_ARITY, TREE_ARITY);
  store_word(H_INTERNAL_OFFSET, record_base(cell_count));
  store_word(H_INTERNAL_CAPACITY, record_capacity - params.cell_capacity);
  store_word(H_INTERNAL_COUNT, internal_count);
  store_word(
    H_ROOT_OFFSET,
    select(0u, record_base(root_record_index), cell_count > 0u)
  );
  store_word(H_NODE_COUNT, record_count);
  store_word(H_REQUIRED_WORDS, required_words);
  store_word(H_CAPACITY_WORDS, params.view_capacity_words);
  store_word(H_COMPLETION_ORDINAL, 0u);
  store_word(41u, params.generation_id);
  store_word(42u, params.completion_ordinal);
  store_word(43u, params.source_row_layout_id);
  store_word(44u, params.state_stride_floats);
  store_word(45u, params.thermo_stride_floats);
  store_word(46u, params.identity_stride_words);
  store_word(47u, 1u);
  store_word(48u, 1u);
  store_word(49u, TOPOLOGY_MODE);
  store_word(50u, params.cleared_words);
  store_word(H_TOPOLOGY_MODE, TOPOLOGY_MODE);
  store_word(H_PREFIX_BIT_CAPACITY, PREFIX_BIT_COUNT);
  store_word(H_ROOT_RECORD_INDEX, root_record_index);
  store_word(H_TOTAL_RECORD_COUNT, record_count);
  store_word(H_INTERNAL_RECORD_COUNT, internal_count);
  store_word(H_TOPOLOGY_FINGERPRINT, topology_fingerprint_seed);
  store_word(H_DISPATCH_WORDS, params.dispatch_words);
  store_word(H_LIVE_HIGH_WATER, required_words);
  store_word(H_REPLAY_GUARD_TOKEN, replay_token);
  var header_fingerprint = fold_fingerprint(replay_token, record_count);
  header_fingerprint = fold_fingerprint(header_fingerprint, root_record_index);
  header_fingerprint = fold_fingerprint(header_fingerprint, PREFIX_BIT_COUNT);
  store_word(H_HEADER_FINGERPRINT, header_fingerprint);
  store_word(80u, root_record_index);
  store_word(81u, INVALID_U32);
  store_word(82u, 1u);
  store_word(83u, 1u);
  store_word(84u, TREE_ARITY);
  store_word(85u, record_count);
  store_word(86u, params.source_adapter_id);
  store_word(87u, spatial_directory[29u]);
  store_word(88u, spatial_directory[30u]);
  store_word(89u, spatial_directory[31u]);
  store_word(90u, spatial_directory[32u]);
  store_word(H_ACTIVE_MEMBER_MAGIC, ACTIVE_MEMBER_MAGIC);
  store_word(H_ACTIVE_MEMBER_VERSION, ACTIVE_MEMBER_VERSION);
  store_word(H_ACTIVE_MEMBER_STATUS, 0u);
  store_word(H_ACTIVE_MEMBER_OFFSET, params.active_member_offset_words);
  store_word(H_ACTIVE_MEMBER_CAPACITY, params.active_member_capacity);
  store_word(H_ACTIVE_MEMBER_COUNT, 0u);
  store_word(H_ACTIVE_MEMBER_SOURCE_COUNT, params.source_count);
  store_word(H_ACTIVE_MEMBER_CELL_COUNT, cell_count);
  store_word(H_ACTIVE_MEMBER_GENERATION_ID, params.generation_id);
  store_word(H_ACTIVE_MEMBER_COMPLETION_ORDINAL, 0u);
  store_word(H_ACTIVE_MEMBER_REPLAY_TOKEN, replay_token);
  store_word(H_ACTIVE_MEMBER_SOURCE_ADAPTER_ID, params.source_adapter_id);
  store_word(H_ACTIVE_MEMBER_DIRECTORY_OFFSET, spatial_directory[31u]);
  store_word(H_ACTIVE_MEMBER_REDUCED_CELL_COUNT, 0u);
  store_word(H_ACTIVE_MEMBER_INVALID_COUNT, 0u);
  store_word(
    H_ACTIVE_MEMBER_CONSTRUCTION_MODE,
    ACTIVE_MEMBER_CONSTRUCTION_CELL_PREFIX
  );
  store_word(H_ACTIVE_MEMBER_PHYSICAL_CAPACITY, params.physical_capacity_words);
  store_word(H_ACTIVE_MEMBER_SOURCE_LAYOUT, params.source_row_layout_id);
  store_word(H_ACTIVE_MEMBER_STORAGE_GENERATION, params.storage_generation);
  store_word(H_ACTIVE_MEMBER_FINGERPRINT, 0u);
  store_word(111u, 0u);
  dispatch_store(
    DISPATCH_SLOT_CELLS,
    (cell_count + params.workgroup_size - 1u) / params.workgroup_size
  );
  dispatch_store(
    DISPATCH_SLOT_INTERNALS,
    (internal_count + params.workgroup_size - 1u) / params.workgroup_size
  );
  dispatch_store(
    DISPATCH_SLOT_RECORDS,
    (record_count + params.workgroup_size - 1u) / params.workgroup_size
  );
}

@compute @workgroup_size(64)
fn initialize_aggregate_records(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let record_index = global_id.x;
  if (
    load_word(H_STATUS) != 0u
    || record_index >= load_word(H_TOTAL_RECORD_COUNT)
  ) {
    return;
  }
  let base = record_base(record_index);
  store_word(base + 25u, INVALID_U32);
  store_word(base + 26u, INVALID_U32);
  for (var word = 28u; word <= 37u; word = word + 1u) {
    store_word(base + word, INVALID_U32);
  }
  for (var word = 38u; word < 44u; word = word + 1u) {
    store_word(base + word, 0u);
  }
  atomicAdd(&aggregate_view[H_INITIALIZED_RECORD_COUNT], 1u);
}

fn morton96(cell_order: vec3<u32>) -> vec3<u32> {
  var result = vec3<u32>(0u);
  var output_bit = 0u;
  for (var remaining = 32u; remaining > 0u; remaining = remaining - 1u) {
    let source_bit = remaining - 1u;
    for (var axis = 0u; axis < 3u; axis = axis + 1u) {
      let destination_word = output_bit / 32u;
      let destination_bit = 31u - output_bit % 32u;
      result[destination_word] = result[destination_word]
        | (((cell_order[axis] >> source_bit) & 1u) << destination_bit);
      output_bit = output_bit + 1u;
    }
  }
  return result;
}

@compute @workgroup_size(64)
fn emit_aggregate_morton_keys(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let v2_group_index = workgroup_id.x
    + workgroup_id.y * spatial_directory[42u];
  let element_index = select(
    global_id.x,
    v2_group_index * params.workgroup_size + local_id.x,
    params.directory_abi_version == SPATIAL_VERSION_V2
  );
  if (
    load_word(H_STATUS) != 0u
    || element_index >= params.source_count
    || key_base(element_index) + KEY_WORDS > arrayLength(&aggregate_keys)
  ) {
    return;
  }
  let key_target = key_base(element_index);
  for (var word = 0u; word < KEY_WORDS; word = word + 1u) {
    aggregate_keys[key_target + word] = INVALID_U32;
  }
  let cell_count = load_word(H_CELL_COUNT);
  if (element_index >= cell_count) {
    return;
  }
  let source = spatial_directory[29u] + element_index * SPATIAL_KEY_WORDS;
  let morton = morton96(vec3<u32>(
    spatial_directory[source + 2u],
    spatial_directory[source + 3u],
    spatial_directory[source + 4u]
  ));
  aggregate_keys[key_target] = spatial_directory[source];
  aggregate_keys[key_target + 1u] = spatial_directory[source + 1u];
  aggregate_keys[key_target + 2u] = morton.x;
  aggregate_keys[key_target + 3u] = morton.y;
  aggregate_keys[key_target + 4u] = morton.z;
  atomicAdd(&aggregate_view[H_EMITTED_KEY_COUNT], 1u);
}

fn source_row_particle_index(source_index: u32) -> u32 {
  if (params.source_row_layout_id == SOURCE_LAYOUT_LEVEL_ASSIGNMENT) {
    return source_index;
  }
  if (params.source_row_layout_id != SOURCE_LAYOUT_ACTIVE_NODE) {
    return INVALID_U32;
  }
  let source_f = spatial_source_rows[source_index * 16u + 10u];
  if (!integral_f32(source_f) || source_f < 0.0 || source_f > MAX_EXACT_F32_INTEGER) {
    return INVALID_U32;
  }
  return u32(round(source_f));
}

fn material_mask(material_id: u32) -> vec4<u32> {
  let hash = mix_u32(material_id);
  let lane = (hash >> 5u) & 3u;
  let bit = 1u << (hash & 31u);
  return vec4<u32>(
    select(0u, bit, lane == 0u),
    select(0u, bit, lane == 1u),
    select(0u, bit, lane == 2u),
    select(0u, bit, lane == 3u)
  );
}

fn empty_record(kind: u32, begin: u32, end: u32) -> AggregateRecord {
  return AggregateRecord(
    0.0,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    vec3<f32>(MAX_F32),
    vec3<f32>(-MAX_F32),
    0.0,
    0u,
    vec4<u32>(0u),
    0u,
    INVALID_U32,
    INVALID_U32,
    INVALID_U32,
    kind,
    begin,
    end,
    0u
  );
}

fn record_finite(record: AggregateRecord) -> bool {
  let mixed_material = (
    record.status & RECORD_STATUS_MIXED_MATERIAL
  ) != 0u;
  let mixed_phase = (record.status & RECORD_STATUS_MIXED_PHASE) != 0u;
  let active_summary = record.particle_count > 0u
    && record.mass > 0.0
    && any(record.material_mask != vec4<u32>(0u))
    && record.phase_mask != 0u
    && mixed_material == (record.homogeneous_material == INVALID_U32)
    && mixed_phase == (record.homogeneous_phase == INVALID_U32);
  let dormant_summary = record.particle_count == 0u
    && record.mass == 0.0
    && all(record.first_moment == vec3<f32>(0.0))
    && all(record.momentum == vec3<f32>(0.0))
    && all(record.angular_momentum == vec3<f32>(0.0))
    && record.internal_energy == 0.0
    && record.kinetic_energy == 0.0
    && all(record.aabb_min == vec3<f32>(0.0))
    && all(record.aabb_max == vec3<f32>(0.0))
    && record.radius == 0.0
    && all(record.material_mask == vec4<u32>(0u))
    && record.phase_mask == 0u
    && record.homogeneous_material == INVALID_U32
    && record.homogeneous_phase == INVALID_U32
    && record.homogeneous_domain == INVALID_U32
    && !mixed_material
    && !mixed_phase;
  return finite_f32(record.mass)
    && record.mass >= 0.0
    && finite_vec3(record.first_moment)
    && finite_vec3(record.momentum)
    && finite_vec3(record.angular_momentum)
    && finite_f32(record.internal_energy)
    && record.internal_energy >= 0.0
    && finite_f32(record.kinetic_energy)
    && record.kinetic_energy >= 0.0
    && finite_vec3(record.aabb_min)
    && finite_vec3(record.aabb_max)
    && all(record.aabb_min <= record.aabb_max)
    && finite_f32(record.radius)
    && record.radius >= 0.0
    && record.source_member_count > 0u
    && record.source_member_count >= record.particle_count
    && (active_summary || dormant_summary);
}

fn canonicalize_empty_record(record: ptr<function, AggregateRecord>) {
  (*record).mass = 0.0;
  (*record).first_moment = vec3<f32>(0.0);
  (*record).momentum = vec3<f32>(0.0);
  (*record).angular_momentum = vec3<f32>(0.0);
  (*record).internal_energy = 0.0;
  (*record).kinetic_energy = 0.0;
  (*record).aabb_min = vec3<f32>(0.0);
  (*record).aabb_max = vec3<f32>(0.0);
  (*record).radius = 0.0;
  (*record).particle_count = 0u;
  (*record).material_mask = vec4<u32>(0u);
  (*record).phase_mask = 0u;
  (*record).homogeneous_material = INVALID_U32;
  (*record).homogeneous_phase = INVALID_U32;
  (*record).homogeneous_domain = INVALID_U32;
  (*record).status = (*record).status & ~(
    RECORD_STATUS_MIXED_MATERIAL | RECORD_STATUS_MIXED_PHASE
  );
}

fn merge_child(parent: ptr<function, AggregateRecord>, child: AggregateRecord) {
  (*parent).source_member_count =
    (*parent).source_member_count + child.source_member_count;
  if (child.particle_count == 0u) { return; }
  let was_empty = (*parent).particle_count == 0u;
  (*parent).mass = (*parent).mass + child.mass;
  (*parent).first_moment = (*parent).first_moment + child.first_moment;
  (*parent).momentum = (*parent).momentum + child.momentum;
  (*parent).angular_momentum = (*parent).angular_momentum + child.angular_momentum;
  (*parent).internal_energy = (*parent).internal_energy + child.internal_energy;
  (*parent).kinetic_energy = (*parent).kinetic_energy + child.kinetic_energy;
  (*parent).aabb_min = min((*parent).aabb_min, child.aabb_min);
  (*parent).aabb_max = max((*parent).aabb_max, child.aabb_max);
  (*parent).particle_count = (*parent).particle_count + child.particle_count;
  (*parent).material_mask = (*parent).material_mask | child.material_mask;
  (*parent).phase_mask = (*parent).phase_mask | child.phase_mask;
  if (was_empty) {
    (*parent).homogeneous_material = child.homogeneous_material;
    (*parent).homogeneous_phase = child.homogeneous_phase;
    (*parent).homogeneous_domain = child.homogeneous_domain;
  } else {
    if ((*parent).homogeneous_material != child.homogeneous_material) {
      (*parent).homogeneous_material = INVALID_U32;
    }
    if ((*parent).homogeneous_phase != child.homogeneous_phase) {
      (*parent).homogeneous_phase = INVALID_U32;
    }
    if ((*parent).homogeneous_domain != child.homogeneous_domain) {
      (*parent).homogeneous_domain = INVALID_U32;
    }
  }
}

fn write_payload(base: u32, record: AggregateRecord) {
  store_f32(base + 0u, record.mass);
  store_f32(base + 1u, record.first_moment.x);
  store_f32(base + 2u, record.first_moment.y);
  store_f32(base + 3u, record.first_moment.z);
  store_f32(base + 4u, record.momentum.x);
  store_f32(base + 5u, record.momentum.y);
  store_f32(base + 6u, record.momentum.z);
  store_f32(base + 7u, record.angular_momentum.x);
  store_f32(base + 8u, record.angular_momentum.y);
  store_f32(base + 9u, record.angular_momentum.z);
  store_f32(base + 10u, record.internal_energy);
  store_f32(base + 11u, record.kinetic_energy);
  store_f32(base + 12u, record.aabb_min.x);
  store_f32(base + 13u, record.aabb_min.y);
  store_f32(base + 14u, record.aabb_min.z);
  store_f32(base + 15u, record.aabb_max.x);
  store_f32(base + 16u, record.aabb_max.y);
  store_f32(base + 17u, record.aabb_max.z);
  store_f32(base + 18u, record.radius);
  store_word(base + 19u, record.particle_count);
  store_word(base + 20u, record.material_mask.x);
  store_word(base + 21u, record.material_mask.y);
  store_word(base + 22u, record.material_mask.z);
  store_word(base + 23u, record.material_mask.w);
  store_word(base + 24u, record.phase_mask);
  store_word(base + 25u, record.homogeneous_material);
  store_word(base + 26u, record.homogeneous_phase);
  store_word(base + 27u, record.status);
  store_word(base + 42u, record.homogeneous_domain);
  store_word(base + 43u, record.source_member_count);
}

fn write_topology(
  base: u32,
  key_cell_index: u32,
  begin: u32,
  end: u32,
  source_cell_or_node: u32,
  rank_begin: u32,
  rank_end: u32,
  prefix_bits: u32
) {
  let source_key = key_base(key_cell_index);
  store_word(base + 28u, aggregate_keys[source_key]);
  store_word(base + 29u, aggregate_keys[source_key + 1u]);
  store_word(base + 30u, aggregate_keys[source_key + 2u]);
  store_word(base + 31u, aggregate_keys[source_key + 3u]);
  store_word(base + 32u, aggregate_keys[source_key + 4u]);
  store_word(base + 33u, begin);
  store_word(base + 34u, end);
  store_word(base + 35u, source_cell_or_node);
  store_word(base + 38u, rank_begin);
  store_word(base + 39u, rank_end);
  store_word(base + 40u, prefix_bits);
}

fn read_record(base: u32) -> AggregateRecord {
  return AggregateRecord(
    bitcast<f32>(load_word(base + 0u)),
    vec3<f32>(
      bitcast<f32>(load_word(base + 1u)),
      bitcast<f32>(load_word(base + 2u)),
      bitcast<f32>(load_word(base + 3u))
    ),
    vec3<f32>(
      bitcast<f32>(load_word(base + 4u)),
      bitcast<f32>(load_word(base + 5u)),
      bitcast<f32>(load_word(base + 6u))
    ),
    vec3<f32>(
      bitcast<f32>(load_word(base + 7u)),
      bitcast<f32>(load_word(base + 8u)),
      bitcast<f32>(load_word(base + 9u))
    ),
    bitcast<f32>(load_word(base + 10u)),
    bitcast<f32>(load_word(base + 11u)),
    vec3<f32>(
      bitcast<f32>(load_word(base + 12u)),
      bitcast<f32>(load_word(base + 13u)),
      bitcast<f32>(load_word(base + 14u))
    ),
    vec3<f32>(
      bitcast<f32>(load_word(base + 15u)),
      bitcast<f32>(load_word(base + 16u)),
      bitcast<f32>(load_word(base + 17u))
    ),
    bitcast<f32>(load_word(base + 18u)),
    load_word(base + 19u),
    vec4<u32>(
      load_word(base + 20u),
      load_word(base + 21u),
      load_word(base + 22u),
      load_word(base + 23u)
    ),
    load_word(base + 24u),
    load_word(base + 25u),
    load_word(base + 26u),
    load_word(base + 42u),
    load_word(base + 27u),
    load_word(base + 33u),
    load_word(base + 34u),
    load_word(base + 43u)
  );
}

@compute @workgroup_size(64)
fn reduce_cell_leaves(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let rank = global_id.x;
  let cell_count = load_word(H_CELL_COUNT);
  if (
    load_word(H_STATUS) != 0u
    || rank >= cell_count
    || rank >= arrayLength(&sorted_indices)
  ) {
    return;
  }
  let cell_index = sorted_indices[rank];
  if (cell_index >= cell_count || key_base(cell_index) + KEY_WORDS > arrayLength(&aggregate_keys)) {
    atomicAdd(&aggregate_view[H_IDENTITY_MISMATCH_COUNT], 1u);
    return;
  }
  let cell_offsets = spatial_directory[30u];
  let cell_members = spatial_directory[31u];
  let particle_to_cell = spatial_directory[32u];
  let begin = spatial_directory[cell_offsets + cell_index];
  let end = spatial_directory[cell_offsets + cell_index + 1u];
  if (begin >= end || end > directory_member_count()) {
    atomicAdd(&aggregate_view[H_INVALID_SOURCE_COUNT], 1u);
    return;
  }
  atomicAdd(&aggregate_view[H_ATTEMPTED_SOURCE_COUNT], end - begin);
  var record = empty_record(
    RECORD_STATUS_LEAF | select(0u, RECORD_STATUS_ROOT, cell_count == 1u),
    begin,
    end
  );
  var invalid = false;
  var nonfinite = false;
  var identity_mismatch = false;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let particle_index = spatial_directory[cell_members + cursor];
    var reverse_matches = false;
    if (particle_index < params.source_count) {
      let reverse_value = spatial_directory[particle_to_cell + particle_index];
      reverse_matches = select(
        reverse_value == cell_index,
        reverse_value == cell_index + 1u,
        params.directory_abi_version == SPATIAL_VERSION_V2
      );
    }
    if (
      particle_index >= params.source_count
      || !reverse_matches
      || source_row_particle_index(particle_index) != particle_index
    ) {
      identity_mismatch = true;
      continue;
    }
    let source_base = particle_index * 16u;
    let state_base = particle_index * params.state_stride_floats;
    let thermo_base = particle_index * params.thermo_stride_floats;
    let identity_base = particle_index * params.identity_stride_words;
    let position = vec3<f32>(
      particle_state[state_base],
      particle_state[state_base + 1u],
      particle_state[state_base + 2u]
    );
    let source_position = vec3<f32>(
      spatial_source_rows[source_base + 12u],
      spatial_source_rows[source_base + 13u],
      spatial_source_rows[source_base + 14u]
    );
    let mass = particle_state[state_base + 3u];
    if (
      !finite_vec3(position)
      || !finite_vec3(source_position)
      || !finite_f32(mass)
    ) {
      nonfinite = true;
      continue;
    }
    if (any(bitcast<vec3<u32>>(position) != bitcast<vec3<u32>>(source_position))) {
      identity_mismatch = true;
      continue;
    }
    if (mass < 0.0) {
      invalid = true;
      continue;
    }
    var mechanically_active = false;
    var mechanically_dormant = false;
    if (params.source_row_layout_id == SOURCE_LAYOUT_LEVEL_ASSIGNMENT) {
      let support_radius = spatial_source_rows[source_base + 2u];
      let represented_volume = spatial_source_rows[source_base + 3u];
      let rest_volume = spatial_source_rows[source_base + 4u];
      let current_volume = spatial_source_rows[source_base + 5u];
      let source_mass = spatial_source_rows[source_base + 6u];
      let source_mechanics_finite = finite_f32(support_radius)
        && finite_f32(represented_volume)
        && finite_f32(rest_volume)
        && finite_f32(current_volume)
        && finite_f32(source_mass);
      if (!source_mechanics_finite) {
        nonfinite = true;
        continue;
      }
      mechanically_dormant = bitcast<u32>(mass) == 0u
        && bitcast<u32>(support_radius) == 0u
        && bitcast<u32>(represented_volume) == 0u
        && bitcast<u32>(rest_volume) == 0u
        && bitcast<u32>(current_volume) == 0u
        && bitcast<u32>(source_mass) == 0u;
      mechanically_active = mass > 0.0
        && support_radius >= 0.0
        && represented_volume >= 0.0
        && rest_volume > 0.0
        && current_volume >= 0.0
        && bitcast<u32>(source_mass) == bitcast<u32>(mass);
    } else if (params.source_row_layout_id == SOURCE_LAYOUT_ACTIVE_NODE) {
      let support_radius = spatial_source_rows[source_base + 9u];
      if (!finite_f32(support_radius)) {
        nonfinite = true;
        continue;
      }
      // Active-node rows do not carry mass or volume authority. A canonical
      // zero-mass particle row is therefore the complete dormant contract;
      // its retained support metadata may remain populated until the next
      // topology transition compacts the source family.
      mechanically_dormant = bitcast<u32>(mass) == 0u
        && support_radius >= 0.0;
      mechanically_active = mass > 0.0 && support_radius >= 0.0;
    } else {
      identity_mismatch = true;
      continue;
    }
    if (!mechanically_active && !mechanically_dormant) {
      identity_mismatch = true;
      continue;
    }
    record.source_member_count = record.source_member_count + 1u;
    if (mechanically_dormant) { continue; }
    let velocity = vec3<f32>(
      particle_state[state_base + 4u],
      particle_state[state_base + 5u],
      particle_state[state_base + 6u]
    );
    let specific_internal_energy = particle_state[state_base + 7u];
    let material_f = particle_thermo[thermo_base];
    let phase_f = particle_thermo[thermo_base + 1u];
    let visual_radius = particle_thermo[thermo_base + 11u];
    var phases_finite = true;
    var phases_bounded = true;
    for (var lane = 4u; lane < 8u; lane = lane + 1u) {
      let fraction = particle_thermo[thermo_base + lane];
      phases_finite = phases_finite && finite_f32(fraction);
      phases_bounded = phases_bounded && fraction >= 0.0 && fraction <= 1.0;
    }
    if (
      !finite_vec3(velocity)
      || !finite_f32(specific_internal_energy)
      || !finite_f32(material_f)
      || !finite_f32(phase_f)
      || !finite_f32(visual_radius)
      || !phases_finite
    ) {
      nonfinite = true;
      continue;
    }
    if (
      !integral_f32(material_f)
      || material_f < 0.0
      || material_f > MAX_EXACT_F32_INTEGER
      || !integral_f32(phase_f)
      || phase_f < 0.0
      || phase_f > 31.0
      || !phases_bounded
    ) {
      identity_mismatch = true;
      continue;
    }
    if (visual_radius < 0.0) {
      invalid = true;
      continue;
    }
    let render_domain_id = particle_identity[identity_base];
    let material_id = u32(round(material_f));
    let phase_id = u32(round(phase_f));
    record.aabb_min = min(record.aabb_min, position - vec3<f32>(visual_radius));
    record.aabb_max = max(record.aabb_max, position + vec3<f32>(visual_radius));
    let momentum = mass * velocity;
    let first_moment = mass * position;
    let angular = cross(position, momentum);
    let internal_energy = mass * specific_internal_energy;
    let kinetic_energy = 0.5 * mass * dot(velocity, velocity);
    if (
      !finite_vec3(momentum)
      || !finite_vec3(first_moment)
      || !finite_vec3(angular)
      || !finite_f32(internal_energy)
      || !finite_f32(kinetic_energy)
    ) {
      nonfinite = true;
      continue;
    }
    let active_ordinal = record.particle_count;
    let active_member_word = params.active_member_offset_words
      + begin + active_ordinal;
    if (
      active_ordinal >= end - begin
      || active_member_word >= params.physical_capacity_words
      || active_member_word >= arrayLength(&aggregate_view)
    ) {
      invalid = true;
      atomicAdd(&aggregate_view[H_ACTIVE_MEMBER_INVALID_COUNT], 1u);
      continue;
    }
    // Each leaf invocation owns one disjoint canonical directory range. The
    // active prefix therefore needs no atomics and preserves member order.
    store_word(active_member_word, particle_index);
    atomicAdd(&aggregate_view[H_ACTIVE_MEMBER_COUNT], 1u);
    let was_empty = record.particle_count == 0u;
    record.mass = record.mass + mass;
    record.first_moment = record.first_moment + first_moment;
    record.momentum = record.momentum + momentum;
    record.angular_momentum = record.angular_momentum + angular;
    record.internal_energy = record.internal_energy + internal_energy;
    record.kinetic_energy = record.kinetic_energy + kinetic_energy;
    record.particle_count = record.particle_count + 1u;
    record.material_mask = record.material_mask | material_mask(material_id);
    record.phase_mask = record.phase_mask | (1u << phase_id);
    if (was_empty) {
      record.homogeneous_material = material_id;
      record.homogeneous_phase = phase_id;
      record.homogeneous_domain = render_domain_id;
    } else {
      if (record.homogeneous_material != material_id) {
        record.homogeneous_material = INVALID_U32;
      }
      if (record.homogeneous_phase != phase_id) {
        record.homogeneous_phase = INVALID_U32;
      }
      if (record.homogeneous_domain != render_domain_id) {
        record.homogeneous_domain = INVALID_U32;
      }
    }
    if (render_domain_id == INVALID_U32 && params.identity_stride_words == 0u) {
      identity_mismatch = true;
    }
  }
  if (nonfinite) { atomicAdd(&aggregate_view[H_NONFINITE_SOURCE_COUNT], 1u); }
  if (identity_mismatch) { atomicAdd(&aggregate_view[H_IDENTITY_MISMATCH_COUNT], 1u); }
  if (invalid) { atomicAdd(&aggregate_view[H_INVALID_SOURCE_COUNT], 1u); }
  if (
    nonfinite
    || identity_mismatch
    || invalid
    || record.source_member_count != end - begin
  ) {
    return;
  }
  if (record.particle_count == 0u) {
    canonicalize_empty_record(&record);
  } else {
    if (record.homogeneous_material == INVALID_U32) {
      record.status = record.status | RECORD_STATUS_MIXED_MATERIAL;
    }
    if (record.homogeneous_phase == INVALID_U32) {
      record.status = record.status | RECORD_STATUS_MIXED_PHASE;
    }
  }
  var center = vec3<f32>(0.0);
  if (record.particle_count > 0u) {
    center = record.first_moment / record.mass;
  }
  var radius = 0.0;
  for (
    var active_ordinal = 0u;
    active_ordinal < record.particle_count;
    active_ordinal = active_ordinal + 1u
  ) {
    let particle_index = load_word(
      params.active_member_offset_words + begin + active_ordinal
    );
    let state_base = particle_index * params.state_stride_floats;
    let thermo_base = particle_index * params.thermo_stride_floats;
    let position = vec3<f32>(
      particle_state[state_base],
      particle_state[state_base + 1u],
      particle_state[state_base + 2u]
    );
    radius = max(
      radius,
      distance(position, center) + particle_thermo[thermo_base + 11u]
    );
  }
  record.radius = radius;
  if (!record_finite(record)) {
    atomicAdd(&aggregate_view[H_NONFINITE_SOURCE_COUNT], 1u);
    return;
  }
  record.status = record.status
    | RECORD_STATUS_VALID
    | RECORD_STATUS_HOMOGENEOUS_DOMAIN_SUMMARY_EXACT;
  let base = record_base(cell_index);
  write_payload(base, record);
  write_topology(
    base,
    cell_index,
    begin,
    end,
    cell_index,
    rank,
    rank + 1u,
    PREFIX_BIT_COUNT
  );
  atomicAdd(
    &aggregate_view[H_REDUCED_SOURCE_COUNT],
    record.source_member_count
  );
  atomicAdd(&aggregate_view[H_REDUCED_LEAF_COUNT], 1u);
  atomicAdd(&aggregate_view[H_ACTIVE_MEMBER_REDUCED_CELL_COUNT], 1u);
}

fn sorted_cell(rank: i32) -> u32 {
  return sorted_indices[u32(rank)];
}

fn common_prefix(left: i32, right: i32) -> i32 {
  let cell_count = i32(load_word(H_CELL_COUNT));
  if (left < 0 || right < 0 || left >= cell_count || right >= cell_count) {
    return -1;
  }
  let left_cell = sorted_cell(left);
  let right_cell = sorted_cell(right);
  if (left_cell >= u32(cell_count) || right_cell >= u32(cell_count)) {
    return -1;
  }
  let left_base = key_base(left_cell);
  let right_base = key_base(right_cell);
  for (var word = 0u; word < KEY_WORDS; word = word + 1u) {
    let difference = aggregate_keys[left_base + word]
      ^ aggregate_keys[right_base + word];
    if (difference != 0u) {
      return i32(word * 32u + countLeadingZeros(difference));
    }
  }
  return i32(PREFIX_BIT_COUNT);
}

fn assign_parent(child_index: u32, parent_index: u32) -> bool {
  let address = record_base(child_index) + 36u;
  loop {
    let result = atomicCompareExchangeWeak(
      &aggregate_view[address],
      INVALID_U32,
      parent_index
    );
    if (result.exchanged) {
      return true;
    }
    if (result.old_value != INVALID_U32) {
      return result.old_value == parent_index;
    }
  }
}

@compute @workgroup_size(64)
fn build_aggregate_prefix_topology(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let internal_index = global_id.x;
  let cell_count = load_word(H_CELL_COUNT);
  if (
    load_word(H_STATUS) != 0u
    || internal_index >= load_word(H_INTERNAL_COUNT)
    || internal_index + 1u >= cell_count
  ) {
    return;
  }
  let index = i32(internal_index);
  let next_prefix = common_prefix(index, index + 1);
  let previous_prefix = common_prefix(index, index - 1);
  if (next_prefix == i32(PREFIX_BIT_COUNT)) {
    atomicAdd(&aggregate_view[H_DUPLICATE_KEY_COUNT], 1u);
    atomicAdd(&aggregate_view[H_MALFORMED_TOPOLOGY_COUNT], 1u);
    return;
  }
  let direction = select(-1, 1, next_prefix >= previous_prefix);
  let minimum_prefix = common_prefix(index, index - direction);
  var maximum_length = 2;
  for (var iteration = 0u; iteration < 31u; iteration = iteration + 1u) {
    if (common_prefix(index, index + maximum_length * direction) <= minimum_prefix) {
      break;
    }
    maximum_length = maximum_length * 2;
  }
  var length = 0;
  var length_step = maximum_length / 2;
  loop {
    if (
      common_prefix(index, index + (length + length_step) * direction)
        > minimum_prefix
    ) {
      length = length + length_step;
    }
    if (length_step <= 1) {
      break;
    }
    length_step = length_step / 2;
  }
  if (length < 1) {
    atomicAdd(&aggregate_view[H_MALFORMED_TOPOLOGY_COUNT], 1u);
    return;
  }
  let other_end = index + length * direction;
  let node_prefix = common_prefix(index, other_end);
  var split_offset = 0;
  var split_step = length;
  loop {
    split_step = (split_step + 1) / 2;
    if (
      common_prefix(index, index + (split_offset + split_step) * direction)
        > node_prefix
    ) {
      split_offset = split_offset + split_step;
    }
    if (split_step <= 1) {
      break;
    }
  }
  let split = index + split_offset * direction + min(direction, 0);
  let first = min(index, other_end);
  let last = max(index, other_end);
  if (
    node_prefix < 0
    || node_prefix >= i32(PREFIX_BIT_COUNT)
    || split < first
    || split >= last
  ) {
    atomicAdd(&aggregate_view[H_MALFORMED_TOPOLOGY_COUNT], 1u);
    return;
  }
  let left_record_index = select(
    cell_count + u32(split),
    sorted_cell(split),
    split == first
  );
  let right_record_index = select(
    cell_count + u32(split + 1),
    sorted_cell(split + 1),
    split + 1 == last
  );
  let record_index = cell_count + internal_index;
  let total_record_count = load_word(H_TOTAL_RECORD_COUNT);
  if (
    record_index >= total_record_count
    || left_record_index >= total_record_count
    || right_record_index >= total_record_count
    || left_record_index == right_record_index
    || left_record_index == record_index
    || right_record_index == record_index
  ) {
    atomicAdd(&aggregate_view[H_MALFORMED_TOPOLOGY_COUNT], 1u);
    return;
  }
  let first_cell = sorted_cell(first);
  if (first_cell >= cell_count) {
    atomicAdd(&aggregate_view[H_MALFORMED_TOPOLOGY_COUNT], 1u);
    return;
  }
  let base = record_base(record_index);
  store_word(
    base + 27u,
    RECORD_STATUS_INTERNAL
      | select(0u, RECORD_STATUS_ROOT, internal_index == 0u)
  );
  write_topology(
    base,
    first_cell,
    left_record_index,
    right_record_index,
    record_index,
    u32(first),
    u32(last + 1),
    u32(node_prefix)
  );
  let left_assigned = assign_parent(left_record_index, record_index);
  let right_assigned = assign_parent(right_record_index, record_index);
  if (!left_assigned || !right_assigned) {
    atomicAdd(&aggregate_view[H_MALFORMED_TOPOLOGY_COUNT], 1u);
    return;
  }
  atomicAdd(&aggregate_view[H_PARENT_ASSIGNMENT_COUNT], 2u);
  atomicAdd(&aggregate_view[H_BUILT_INTERNAL_COUNT], 1u);
}

fn topology_fingerprint(record_index: u32) -> u32 {
  let base = record_base(record_index);
  var value = fold_fingerprint(load_word(H_REPLAY_GUARD_TOKEN), record_index);
  value = fold_fingerprint(
    value,
    load_word(base + 27u) & (
      RECORD_STATUS_LEAF | RECORD_STATUS_INTERNAL | RECORD_STATUS_ROOT
    )
  );
  value = fold_fingerprint(value, load_word(base + 28u));
  value = fold_fingerprint(value, load_word(base + 29u));
  value = fold_fingerprint(value, load_word(base + 30u));
  value = fold_fingerprint(value, load_word(base + 31u));
  value = fold_fingerprint(value, load_word(base + 32u));
  value = fold_fingerprint(value, load_word(base + 36u));
  value = fold_fingerprint(value, load_word(base + 37u));
  value = fold_fingerprint(value, load_word(base + 38u));
  value = fold_fingerprint(value, load_word(base + 39u));
  value = fold_fingerprint(value, load_word(base + 40u));
  value = fold_fingerprint(value, load_word(base + 33u));
  return fold_fingerprint(value, load_word(base + 34u));
}

@compute @workgroup_size(64)
fn build_aggregate_escape_ropes(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let record_index = global_id.x;
  let total_record_count = load_word(H_TOTAL_RECORD_COUNT);
  if (load_word(H_STATUS) != 0u || record_index >= total_record_count) {
    return;
  }
  let root_index = load_word(H_ROOT_RECORD_INDEX);
  let base = record_base(record_index);
  var valid = true;
  var escape_index = INVALID_U32;
  if (record_index != root_index) {
    var current_index = record_index;
    var parent_index = load_word(base + 36u);
    var resolved = false;
    for (var step = 0u; step <= PREFIX_BIT_COUNT; step = step + 1u) {
      if (parent_index == INVALID_U32 || parent_index >= total_record_count) {
        valid = false;
        break;
      }
      let parent_base = record_base(parent_index);
      let left_child = load_word(parent_base + 33u);
      let right_child = load_word(parent_base + 34u);
      if (current_index == left_child) {
        escape_index = right_child;
        resolved = right_child < total_record_count;
        valid = resolved;
        break;
      }
      if (current_index != right_child) {
        valid = false;
        break;
      }
      current_index = parent_index;
      parent_index = load_word(parent_base + 36u);
      if (parent_index == INVALID_U32) {
        escape_index = INVALID_U32;
        resolved = true;
        break;
      }
    }
    if (!resolved) {
      valid = false;
    }
  } else {
    valid = load_word(base + 36u) == INVALID_U32;
  }
  if (!valid) {
    atomicAdd(&aggregate_view[H_MALFORMED_TOPOLOGY_COUNT], 1u);
  }
  store_word(base + 37u, escape_index);
  store_word(base + 41u, topology_fingerprint(record_index));
  atomicAdd(&aggregate_view[H_ROPE_COUNT], 1u);
}

@compute @workgroup_size(64)
fn reduce_aggregate_internals(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let internal_index = global_id.x;
  let cell_count = load_word(H_CELL_COUNT);
  if (
    load_word(H_STATUS) != 0u
    || internal_index >= load_word(H_INTERNAL_COUNT)
  ) {
    return;
  }
  let record_index = cell_count + internal_index;
  let base = record_base(record_index);
  let rank_begin = load_word(base + 38u);
  let rank_end = load_word(base + 39u);
  let left_child = load_word(base + 33u);
  let right_child = load_word(base + 34u);
  if (
    rank_begin >= rank_end
    || rank_end > cell_count
    || left_child >= load_word(H_TOTAL_RECORD_COUNT)
    || right_child >= load_word(H_TOTAL_RECORD_COUNT)
  ) {
    atomicAdd(&aggregate_view[H_MALFORMED_TOPOLOGY_COUNT], 1u);
    return;
  }
  let topology_status = load_word(base + 27u);
  var record = empty_record(topology_status, left_child, right_child);
  var malformed = false;
  for (var rank = rank_begin; rank < rank_end; rank = rank + 1u) {
    let leaf_index = sorted_indices[rank];
    if (leaf_index >= cell_count) {
      malformed = true;
      continue;
    }
    let leaf = read_record(record_base(leaf_index));
    if (
      (leaf.status & (RECORD_STATUS_VALID | RECORD_STATUS_LEAF))
        != (RECORD_STATUS_VALID | RECORD_STATUS_LEAF)
      || !record_finite(leaf)
    ) {
      malformed = true;
      continue;
    }
    merge_child(&record, leaf);
  }
  if (record.particle_count == 0u) {
    canonicalize_empty_record(&record);
  } else {
    if (record.homogeneous_material == INVALID_U32) {
      record.status = record.status | RECORD_STATUS_MIXED_MATERIAL;
    }
    if (record.homogeneous_phase == INVALID_U32) {
      record.status = record.status | RECORD_STATUS_MIXED_PHASE;
    }
  }
  if (malformed) {
    atomicAdd(&aggregate_view[H_MALFORMED_TOPOLOGY_COUNT], 1u);
    return;
  }
  var center = vec3<f32>(0.0);
  if (record.particle_count > 0u) {
    center = record.first_moment / record.mass;
  }
  var radius = 0.0;
  for (var rank = rank_begin; rank < rank_end; rank = rank + 1u) {
    let leaf = read_record(record_base(sorted_indices[rank]));
    if (leaf.particle_count == 0u) { continue; }
    let leaf_center = leaf.first_moment / leaf.mass;
    radius = max(
      radius,
      distance(leaf_center, center) + leaf.radius
    );
  }
  record.radius = radius;
  if (!record_finite(record)) {
    atomicAdd(&aggregate_view[H_MALFORMED_TOPOLOGY_COUNT], 1u);
    return;
  }
  record.status = record.status
    | RECORD_STATUS_VALID
    | RECORD_STATUS_HOMOGENEOUS_DOMAIN_SUMMARY_EXACT;
  write_payload(base, record);
  atomicAdd(&aggregate_view[H_REDUCED_INTERNAL_COUNT], 1u);
}

fn record_key_matches(record_base_words: u32, cell_index: u32) -> bool {
  let source = key_base(cell_index);
  for (var word = 0u; word < KEY_WORDS; word = word + 1u) {
    if (load_word(record_base_words + 28u + word) != aggregate_keys[source + word]) {
      return false;
    }
  }
  return true;
}

fn parent_contains(record_index: u32, parent_index: u32) -> bool {
  if (parent_index >= load_word(H_TOTAL_RECORD_COUNT)) {
    return false;
  }
  let parent_base = record_base(parent_index);
  return load_word(parent_base + 33u) == record_index
    || load_word(parent_base + 34u) == record_index;
}

@compute @workgroup_size(64)
fn authenticate_aggregate_topology(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let record_index = global_id.x;
  let total_record_count = load_word(H_TOTAL_RECORD_COUNT);
  let cell_count = load_word(H_CELL_COUNT);
  if (load_word(H_STATUS) != 0u || record_index >= total_record_count) {
    return;
  }
  let base = record_base(record_index);
  let status = load_word(base + 27u);
  let is_leaf = (status & RECORD_STATUS_LEAF) != 0u;
  let is_internal = (status & RECORD_STATUS_INTERNAL) != 0u;
  let parent_index = load_word(base + 36u);
  let escape_index = load_word(base + 37u);
  let rank_begin = load_word(base + 38u);
  let rank_end = load_word(base + 39u);
  let prefix_bits = load_word(base + 40u);
  let root_index = load_word(H_ROOT_RECORD_INDEX);
  var valid = (status & (
    RECORD_STATUS_VALID
      | RECORD_STATUS_HOMOGENEOUS_DOMAIN_SUMMARY_EXACT
  )) == (
    RECORD_STATUS_VALID
      | RECORD_STATUS_HOMOGENEOUS_DOMAIN_SUMMARY_EXACT
  )
    && is_leaf != is_internal
    && record_finite(read_record(base))
    && rank_begin < rank_end
    && rank_end <= cell_count
    && prefix_bits <= PREFIX_BIT_COUNT
    && load_word(base + 41u) == topology_fingerprint(record_index)
    && (escape_index == INVALID_U32 || escape_index < total_record_count);
  if (valid && record_index == root_index) {
    valid = (status & RECORD_STATUS_ROOT) != 0u
      && parent_index == INVALID_U32
      && escape_index == INVALID_U32
      && rank_begin == 0u
      && rank_end == cell_count;
  } else if (valid) {
    valid = (status & RECORD_STATUS_ROOT) == 0u
      && parent_index != INVALID_U32
      && parent_contains(record_index, parent_index);
  }
  if (valid && is_leaf) {
    let source_begin = load_word(base + 33u);
    let source_end = load_word(base + 34u);
    let source_cell = load_word(base + 35u);
    let offsets = spatial_directory[30u];
    valid = record_index < cell_count
      && source_cell == record_index
      && rank_end == rank_begin + 1u
      && sorted_indices[rank_begin] == record_index
      && prefix_bits == PREFIX_BIT_COUNT
      && source_begin == spatial_directory[offsets + record_index]
      && source_end == spatial_directory[offsets + record_index + 1u]
      && source_begin < source_end
      && load_word(base + 43u) == source_end - source_begin
      && record_key_matches(base, record_index);
  } else if (valid) {
    let left_child = load_word(base + 33u);
    let right_child = load_word(base + 34u);
    let source_node = load_word(base + 35u);
    valid = record_index >= cell_count
      && source_node == record_index
      && left_child < total_record_count
      && right_child < total_record_count
      && left_child != right_child;
    if (valid) {
      let left_base = record_base(left_child);
      let right_base = record_base(right_child);
      let first_cell = sorted_indices[rank_begin];
      let expected_prefix = common_prefix(i32(rank_begin), i32(rank_end - 1u));
      valid = load_word(left_base + 36u) == record_index
        && load_word(right_base + 36u) == record_index
        && load_word(left_base + 38u) == rank_begin
        && load_word(left_base + 39u) == load_word(right_base + 38u)
        && load_word(right_base + 39u) == rank_end
        && expected_prefix >= 0
        && prefix_bits == u32(expected_prefix)
        && prefix_bits < load_word(left_base + 40u)
        && prefix_bits < load_word(right_base + 40u)
        && load_word(left_base + 37u) == right_child
        && load_word(right_base + 37u) == escape_index
        && first_cell < cell_count
        && record_key_matches(base, first_cell);
      if (valid) {
        let expected_particle_count = load_word(left_base + 19u)
          + load_word(right_base + 19u);
        let expected_source_member_count = load_word(left_base + 43u)
          + load_word(right_base + 43u);
        valid = load_word(base + 19u) == expected_particle_count
          && load_word(base + 43u) == expected_source_member_count;
      }
    }
  }
  if (!valid) {
    atomicAdd(&aggregate_view[H_MALFORMED_TOPOLOGY_COUNT], 1u);
    return;
  }
  atomicOr(
    &aggregate_view[base + 27u],
    RECORD_STATUS_TOPOLOGY_AUTHENTICATED
  );
  atomicXor(
    &aggregate_view[H_TOPOLOGY_FINGERPRINT],
    load_word(base + 41u)
  );
  atomicAdd(&aggregate_view[H_AUTHENTICATED_RECORD_COUNT], 1u);
  if (is_leaf) {
    atomicAdd(&aggregate_view[H_TRAVERSAL_LEAF_COVERAGE], 1u);
  }
  if (record_index == root_index) {
    atomicAdd(&aggregate_view[H_AUTHENTICATED_ROOT_COUNT], 1u);
  }
}

fn active_projection_header_complete(
  cell_count: u32,
  active_member_count: u32
) -> bool {
  return load_word(H_ACTIVE_MEMBER_MAGIC) == ACTIVE_MEMBER_MAGIC
    && load_word(H_ACTIVE_MEMBER_VERSION) == ACTIVE_MEMBER_VERSION
    && load_word(H_ACTIVE_MEMBER_STATUS) == 0u
    && load_word(H_ACTIVE_MEMBER_OFFSET) == params.active_member_offset_words
    && load_word(H_ACTIVE_MEMBER_CAPACITY) == params.active_member_capacity
    && load_word(H_ACTIVE_MEMBER_SOURCE_COUNT) == params.source_count
    && load_word(H_ACTIVE_MEMBER_CELL_COUNT) == cell_count
    && load_word(H_ACTIVE_MEMBER_GENERATION_ID) == params.generation_id
    && load_word(H_ACTIVE_MEMBER_COMPLETION_ORDINAL) == 0u
    && load_word(H_ACTIVE_MEMBER_REPLAY_TOKEN)
      == load_word(H_REPLAY_GUARD_TOKEN)
    && load_word(H_ACTIVE_MEMBER_SOURCE_ADAPTER_ID) == params.source_adapter_id
    && load_word(H_ACTIVE_MEMBER_DIRECTORY_OFFSET) == spatial_directory[31u]
    && load_word(H_ACTIVE_MEMBER_REDUCED_CELL_COUNT) == cell_count
    && load_word(H_ACTIVE_MEMBER_INVALID_COUNT) == 0u
    && load_word(H_ACTIVE_MEMBER_CONSTRUCTION_MODE)
      == ACTIVE_MEMBER_CONSTRUCTION_CELL_PREFIX
    && load_word(H_ACTIVE_MEMBER_PHYSICAL_CAPACITY)
      == params.physical_capacity_words
    && load_word(H_ACTIVE_MEMBER_SOURCE_LAYOUT) == params.source_row_layout_id
    && load_word(H_ACTIVE_MEMBER_STORAGE_GENERATION)
      == params.storage_generation
    && load_word(H_ACTIVE_MEMBER_FINGERPRINT) == 0u
    && active_member_count <= params.source_count;
}

fn publish_aggregate_success(active_member_count: u32) {
  var sealed_topology_fingerprint = fold_fingerprint(
    load_word(H_TOPOLOGY_FINGERPRINT),
    TOPOLOGY_FINGERPRINT_DOMAIN
  );
  if (sealed_topology_fingerprint == 0u) {
    sealed_topology_fingerprint = TOPOLOGY_FINGERPRINT_DOMAIN;
  }
  store_word(H_TOPOLOGY_FINGERPRINT, sealed_topology_fingerprint);
  store_word(H_COMPLETION_ORDINAL, params.completion_ordinal);
  store_word(H_ACTIVE_MEMBER_COMPLETION_ORDINAL, params.completion_ordinal);
  store_word(
    H_ACTIVE_MEMBER_FINGERPRINT,
    active_member_projection_fingerprint(active_member_count)
  );
  store_word(
    H_ACTIVE_MEMBER_STATUS,
    ACTIVE_MEMBER_STATUS_READY | ACTIVE_MEMBER_STATUS_ADMITTED
  );
  store_word(
    H_TRAVERSAL_STATUS,
    AGGREGATE_STATUS_READY
      | AGGREGATE_STATUS_ADMITTED
      | AGGREGATE_STATUS_TRAVERSAL_READY
  );
  store_word(
    H_STATUS,
    AGGREGATE_STATUS_READY
      | AGGREGATE_STATUS_ADMITTED
      | AGGREGATE_STATUS_TRAVERSAL_READY
  );
}

@compute @workgroup_size(1)
fn finalize_aggregate_view() {
  if (load_word(0u) != AGGREGATE_MAGIC || load_word(1u) != AGGREGATE_VERSION) {
    fail_initialization(AGGREGATE_STATUS_IDENTITY_MISMATCH);
    return;
  }
  var failure = load_word(H_STATUS);
  if (load_word(H_INVALID_SOURCE_COUNT) != 0u) {
    failure = failure | AGGREGATE_STATUS_INVALID_SOURCE;
  }
  if (load_word(H_NONFINITE_SOURCE_COUNT) != 0u) {
    failure = failure | AGGREGATE_STATUS_NONFINITE;
  }
  if (load_word(H_IDENTITY_MISMATCH_COUNT) != 0u) {
    failure = failure | AGGREGATE_STATUS_IDENTITY_MISMATCH;
  }
  if (load_word(H_REPLAY_GUARD_TOKEN) == 0u) {
    failure = failure | AGGREGATE_STATUS_IDENTITY_MISMATCH;
  }
  if (load_word(H_OVERFLOW_COUNT) != 0u) {
    failure = failure | AGGREGATE_STATUS_CAPACITY_OVERFLOW;
  }
  if (
    load_word(H_MALFORMED_TOPOLOGY_COUNT) != 0u
    || load_word(H_DUPLICATE_KEY_COUNT) != 0u
  ) {
    failure = failure | AGGREGATE_STATUS_MALFORMED_TOPOLOGY;
  }
  let cell_count = load_word(H_CELL_COUNT);
  let internal_count = load_word(H_INTERNAL_COUNT);
  let total_record_count = load_word(H_TOTAL_RECORD_COUNT);
  let expected_member_count = directory_member_count();
  let active_member_count = load_word(H_ACTIVE_MEMBER_COUNT);
  let active_projection_header_admitted = active_projection_header_complete(
    cell_count,
    active_member_count
  );
  if (cell_count == 0u) {
    if (
      params.directory_abi_version != SPATIAL_VERSION_V2
      || expected_member_count != 0u
      || load_word(H_LEAF_COUNT) != 0u
      || internal_count != 0u
      || total_record_count != 0u
      || load_word(H_ROOT_RECORD_INDEX) != INVALID_U32
      || load_word(H_EMITTED_KEY_COUNT) != 0u
      || load_word(H_INITIALIZED_RECORD_COUNT) != 0u
      || load_word(H_ATTEMPTED_SOURCE_COUNT) != 0u
      || load_word(H_REDUCED_SOURCE_COUNT) != 0u
      || load_word(H_REDUCED_LEAF_COUNT) != 0u
      || load_word(H_BUILT_INTERNAL_COUNT) != 0u
      || load_word(H_PARENT_ASSIGNMENT_COUNT) != 0u
      || load_word(H_ROPE_COUNT) != 0u
      || load_word(H_REDUCED_INTERNAL_COUNT) != 0u
      || load_word(H_AUTHENTICATED_RECORD_COUNT) != 0u
      || load_word(H_AUTHENTICATED_ROOT_COUNT) != 0u
      || load_word(H_TRAVERSAL_LEAF_COVERAGE) != 0u
      || active_member_count != 0u
      || !active_projection_header_admitted
    ) {
      failure = failure | AGGREGATE_STATUS_INVALID_SOURCE;
    }
    if (failure != 0u) {
      store_word(H_ACTIVE_MEMBER_STATUS, ACTIVE_MEMBER_STATUS_FAIL_CLOSED);
      store_word(H_ACTIVE_MEMBER_FINGERPRINT, 0u);
      store_word(H_STATUS, failure | AGGREGATE_STATUS_FAIL_CLOSED);
      store_word(H_TRAVERSAL_STATUS, AGGREGATE_STATUS_FAIL_CLOSED);
      zero_dispatches();
      return;
    }
    publish_aggregate_success(0u);
    return;
  }
  let root_index = load_word(H_ROOT_RECORD_INDEX);
  let root_status = load_word(record_base(root_index) + 27u);
  let root_source_member_count = load_word(record_base(root_index) + 43u);
  let root_active_member_count = load_word(record_base(root_index) + 19u);
  let active_projection_complete = active_projection_header_admitted
    && active_member_count == root_active_member_count
    && (
      params.directory_abi_version == SPATIAL_VERSION_V1
      || active_member_count == expected_member_count
    );
  if (
    load_word(H_EMITTED_KEY_COUNT) != cell_count
    || load_word(H_INITIALIZED_RECORD_COUNT) != total_record_count
    || load_word(H_ATTEMPTED_SOURCE_COUNT) != expected_member_count
    || load_word(H_REDUCED_SOURCE_COUNT) != expected_member_count
    || load_word(H_REDUCED_LEAF_COUNT) != cell_count
    || load_word(H_BUILT_INTERNAL_COUNT) != internal_count
    || load_word(H_PARENT_ASSIGNMENT_COUNT) != internal_count * 2u
    || load_word(H_ROPE_COUNT) != total_record_count
    || load_word(H_REDUCED_INTERNAL_COUNT) != internal_count
    || load_word(H_AUTHENTICATED_RECORD_COUNT) != total_record_count
    || load_word(H_AUTHENTICATED_ROOT_COUNT) != 1u
    || load_word(H_TRAVERSAL_LEAF_COVERAGE) != cell_count
    || root_source_member_count != expected_member_count
    || !active_projection_complete
    || (root_status & (
      RECORD_STATUS_VALID
      | RECORD_STATUS_ROOT
      | RECORD_STATUS_TOPOLOGY_AUTHENTICATED
      | RECORD_STATUS_HOMOGENEOUS_DOMAIN_SUMMARY_EXACT
    )) != (
      RECORD_STATUS_VALID
      | RECORD_STATUS_ROOT
      | RECORD_STATUS_TOPOLOGY_AUTHENTICATED
      | RECORD_STATUS_HOMOGENEOUS_DOMAIN_SUMMARY_EXACT
    )
  ) {
    failure = failure | AGGREGATE_STATUS_INVALID_SOURCE;
  }
  if (failure != 0u) {
    store_word(H_ACTIVE_MEMBER_STATUS, ACTIVE_MEMBER_STATUS_FAIL_CLOSED);
    store_word(H_ACTIVE_MEMBER_FINGERPRINT, 0u);
    store_word(H_STATUS, failure | AGGREGATE_STATUS_FAIL_CLOSED);
    store_word(H_TRAVERSAL_STATUS, AGGREGATE_STATUS_FAIL_CLOSED);
    zero_dispatches();
    return;
  }
  publish_aggregate_success(active_member_count);
}
`;

/**
 * Complete generic stackless traversal over the authenticated v2 binary
 * Morton/Patricia topology. It emits one fixed summary per query and never
 * materializes candidate rows.
 */
export const schroederSpatialAggregateStacklessTraversalWgsl = /* wgsl */ `
struct AggregateTraversalParams {
  query_count: u32,
  query_capacity: u32,
  query_stride_floats: u32,
  summary_stride_words: u32,
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
  completion_ordinal: u32,
  aggregate_capacity_words: u32,
  expected_replay_guard_token: u32,
  expected_topology_fingerprint: u32,
  workgroup_size: u32,
  gravitational_constant: f32,
  softening_length_m: f32,
  force_scale: f32,
  query_source_layout_id: u32,
  near_field_support_scale: f32,
  opening_theta: f32,
  expected_source_count: u32,
  query_work_identity: u32,
  active_member_offset_words: u32,
  active_member_capacity: u32,
};

@group(0) @binding(0) var<storage, read> aggregate_view: array<u32>;
@group(0) @binding(1) var<storage, read> traversal_queries: array<f32>;
@group(0) @binding(2) var<storage, read_write> traversal_summaries: array<u32>;
@group(0) @binding(3) var<uniform> params: AggregateTraversalParams;
@group(0) @binding(4) var<storage, read> active_source_view: array<u32>;

const AGGREGATE_MAGIC: u32 = 0x53414731u;
const AGGREGATE_VERSION: u32 = 2u;
const AGGREGATE_READY_ADMITTED_TRAVERSAL: u32 = 259u;
const RECORD_STATUS_VALID: u32 = 1u;
const RECORD_STATUS_LEAF: u32 = 2u;
const RECORD_STATUS_INTERNAL: u32 = 4u;
const RECORD_STATUS_ROOT: u32 = 8u;
const RECORD_STATUS_TOPOLOGY_AUTHENTICATED: u32 = 64u;
const TRAVERSAL_READY: u32 = 1u;
const TRAVERSAL_ADMITTED: u32 = 2u;
const TRAVERSAL_FAIL_CLOSED: u32 = 4u;
const TRAVERSAL_IDENTITY_MISMATCH: u32 = 8u;
const TRAVERSAL_TOPOLOGY_MISMATCH: u32 = 16u;
const TRAVERSAL_INCOMPLETE_PARTITION: u32 = 32u;
const QUERY_SOURCE_PACKED_V0: u32 = 0u;
const QUERY_SOURCE_LEVEL_ASSIGNMENT_V0: u32 = 1u;
const QUERY_WORK_PHYSICAL_INDEX: u32 = 0u;
const QUERY_WORK_ACTIVE_ORDINAL: u32 = 1u;
const PACKED_QUERY_FLOATS: u32 = 8u;
const LEVEL_ASSIGNMENT_QUERY_FLOATS: u32 = 16u;
const HEADER_WORDS: u32 = 112u;
const RECORD_WORDS: u32 = 44u;
const TREE_ARITY: u32 = 2u;
const PREFIX_BIT_COUNT: u32 = 160u;
const TOPOLOGY_MODE: u32 = 2u;
const INVALID_U32: u32 = 0xffffffffu;
const MAX_F32: f32 = 3.402823e38;
const ACTIVE_SOURCE_MAGIC: u32 = 0x53535631u;
const ACTIVE_SOURCE_VERSION: u32 = 1u;
const ACTIVE_SOURCE_READY_ADMITTED: u32 = 3u;
const ACTIVE_SOURCE_REJECTED_MASK: u32 = 252u;
const ACTIVE_SOURCE_HEADER_WORDS: u32 = 64u;
const ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD: u32 = 48u;
const ACTIVE_MEMBER_MAGIC: u32 = 0x53414d31u;
const ACTIVE_MEMBER_VERSION: u32 = 1u;
const ACTIVE_MEMBER_READY_ADMITTED: u32 = 3u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= MAX_F32;
}

fn finite_vec3(value: vec3<f32>) -> bool {
  return finite_f32(value.x) && finite_f32(value.y) && finite_f32(value.z);
}

fn mix_u32(input_value: u32) -> u32 {
  var value = input_value;
  value = (value ^ (value >> 16u)) * 0x7feb352du;
  value = (value ^ (value >> 15u)) * 0x846ca68bu;
  return value ^ (value >> 16u);
}

fn fold_fingerprint(seed: u32, value: u32) -> u32 {
  return mix_u32(seed ^ mix_u32(value));
}

fn record_base(record_index: u32) -> u32 {
  return HEADER_WORDS + record_index * RECORD_WORDS;
}

fn topology_fingerprint(record_index: u32) -> u32 {
  let base = record_base(record_index);
  var value = fold_fingerprint(aggregate_view[62u], record_index);
  value = fold_fingerprint(
    value,
    aggregate_view[base + 27u] & (
      RECORD_STATUS_LEAF | RECORD_STATUS_INTERNAL | RECORD_STATUS_ROOT
    )
  );
  value = fold_fingerprint(value, aggregate_view[base + 28u]);
  value = fold_fingerprint(value, aggregate_view[base + 29u]);
  value = fold_fingerprint(value, aggregate_view[base + 30u]);
  value = fold_fingerprint(value, aggregate_view[base + 31u]);
  value = fold_fingerprint(value, aggregate_view[base + 32u]);
  value = fold_fingerprint(value, aggregate_view[base + 36u]);
  value = fold_fingerprint(value, aggregate_view[base + 37u]);
  value = fold_fingerprint(value, aggregate_view[base + 38u]);
  value = fold_fingerprint(value, aggregate_view[base + 39u]);
  value = fold_fingerprint(value, aggregate_view[base + 40u]);
  value = fold_fingerprint(value, aggregate_view[base + 33u]);
  return fold_fingerprint(value, aggregate_view[base + 34u]);
}

fn replay_guard_token(cell_count: u32) -> u32 {
  var token = fold_fingerprint(AGGREGATE_MAGIC, params.expected_source_count);
  token = fold_fingerprint(token, cell_count);
  token = fold_fingerprint(token, params.generation_id);
  token = fold_fingerprint(token, params.storage_generation);
  token = fold_fingerprint(token, params.position_epoch);
  token = fold_fingerprint(token, params.topology_epoch);
  token = fold_fingerprint(token, params.chart_epoch);
  token = fold_fingerprint(token, params.level_epoch);
  token = fold_fingerprint(token, params.support_epoch);
  return fold_fingerprint(token, params.completion_ordinal);
}

fn header_fingerprint(
  replay_token: u32,
  total_record_count: u32,
  root_record_index: u32
) -> u32 {
  var value = fold_fingerprint(replay_token, total_record_count);
  value = fold_fingerprint(value, root_record_index);
  return fold_fingerprint(value, PREFIX_BIT_COUNT);
}

fn store_summary_word(base: u32, column: u32, value: u32) {
  traversal_summaries[base + column] = value;
}

fn store_summary_f32(base: u32, column: u32, value: f32) {
  store_summary_word(base, column, bitcast<u32>(value));
}

fn fail_summary(base: u32, query_index: u32, status: u32) {
  for (var column = 0u; column < 32u; column = column + 1u) {
    store_summary_word(base, column, 0u);
  }
  store_summary_word(base, 0u, status | TRAVERSAL_FAIL_CLOSED);
  store_summary_word(base, 1u, query_index);
}

fn aggregate_admitted() -> bool {
  if (
    arrayLength(&aggregate_view) < HEADER_WORDS
    || params.aggregate_capacity_words > arrayLength(&aggregate_view)
  ) {
    return false;
  }
  let total_record_count = aggregate_view[54u];
  let root_record_index = aggregate_view[53u];
  let leaf_count = aggregate_view[23u];
  let replay_token = replay_guard_token(aggregate_view[18u]);
  let common_admitted = aggregate_view[0u] == AGGREGATE_MAGIC
    && aggregate_view[1u] == AGGREGATE_VERSION
    && (aggregate_view[2u] & AGGREGATE_READY_ADMITTED_TRAVERSAL)
      == AGGREGATE_READY_ADMITTED_TRAVERSAL
    && aggregate_view[3u] == params.generation_id
    && aggregate_view[4u] == params.device_ordinal
    && aggregate_view[5u] == params.lane_ordinal
    && aggregate_view[6u] == params.lease_token
    && aggregate_view[7u] == params.source_family_id
    && aggregate_view[8u] == params.storage_generation
    && aggregate_view[9u] == params.physics_tick
    && aggregate_view[10u] == params.physics_substep
    && aggregate_view[11u] == params.position_epoch
    && aggregate_view[12u] == params.topology_epoch
    && aggregate_view[13u] == params.chart_epoch
    && aggregate_view[14u] == params.level_epoch
    && aggregate_view[15u] == params.support_epoch
    && params.expected_source_count > 0u
    && aggregate_view[16u] == params.expected_source_count
    && aggregate_view[20u] == RECORD_WORDS
    && aggregate_view[21u] == HEADER_WORDS
    && aggregate_view[24u] == TREE_ARITY
    && aggregate_view[31u] == params.aggregate_capacity_words
    && aggregate_view[40u] == params.completion_ordinal
    && aggregate_view[51u] == TOPOLOGY_MODE
    && aggregate_view[52u] == PREFIX_BIT_COUNT
    && aggregate_view[55u] + leaf_count == total_record_count
    && (
      params.expected_topology_fingerprint == 0u
      || aggregate_view[56u] == params.expected_topology_fingerprint
    )
    && aggregate_view[56u] != 0u
    && aggregate_view[57u] == AGGREGATE_READY_ADMITTED_TRAVERSAL
    && aggregate_view[58u] == aggregate_view[23u]
    && aggregate_view[59u] == 0u
    && aggregate_view[60u] == 9u
    && aggregate_view[80u] == root_record_index
    && aggregate_view[81u] == INVALID_U32
    && aggregate_view[84u] == TREE_ARITY
    && aggregate_view[85u] == total_record_count
    && aggregate_view[62u] != 0u
    && aggregate_view[62u] == replay_token
    && aggregate_view[63u] == header_fingerprint(
      replay_token,
      total_record_count,
      root_record_index
    )
    && (
      params.expected_replay_guard_token == 0u
      || aggregate_view[62u] == params.expected_replay_guard_token
    );
  if (!common_admitted) {
    return false;
  }
  if (leaf_count == 0u) {
    return params.query_work_identity == QUERY_WORK_ACTIVE_ORDINAL
      && aggregate_view[18u] == 0u
      && aggregate_view[27u] == 0u
      && total_record_count == 0u
      && root_record_index == INVALID_U32
      && aggregate_view[28u] == 0u
      && aggregate_view[29u] == 0u
      && aggregate_view[36u] == 0u
      && aggregate_view[37u] == 0u
      && aggregate_view[38u] == 0u
      && aggregate_view[39u] == 0u
      && aggregate_view[58u] == 0u
      && aggregate_view[96u] == 0u
      && aggregate_view[97u] == params.expected_source_count;
  }
  if (
    root_record_index >= total_record_count
    || record_base(root_record_index) + 43u
      >= params.aggregate_capacity_words
  ) {
    return false;
  }
  let root_record_base = record_base(root_record_index);
  let expected_member_count = select(
    params.expected_source_count,
    aggregate_view[96u],
    params.query_work_identity == QUERY_WORK_ACTIVE_ORDINAL
  );
  return expected_member_count > 0u
    && aggregate_view[root_record_base + 43u] == expected_member_count
    && aggregate_view[root_record_base + 19u] <= expected_member_count;
}

fn active_source_view_admitted() -> bool {
  if (
    params.query_work_identity != QUERY_WORK_ACTIVE_ORDINAL
    || arrayLength(&active_source_view) < ACTIVE_SOURCE_HEADER_WORDS
  ) {
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
  let dispatch_x = active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD];
  let dispatch_y =
    active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD + 1u];
  let dispatch_z =
    active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD + 2u];
  let group_count = (active_count + 63u) / 64u;
  var dispatch_admitted = active_count == 0u
    && dispatch_x == 0u
    && dispatch_y == 1u
    && dispatch_z == 1u;
  if (active_count > 0u) {
    dispatch_admitted = dispatch_x > 0u
      && dispatch_y > 0u
      && dispatch_z == 1u
      && dispatch_x * dispatch_y >= group_count
      && (dispatch_y - 1u) * dispatch_x < group_count;
  }
  return active_source_view[0u] == ACTIVE_SOURCE_MAGIC
    && active_source_view[1u] == ACTIVE_SOURCE_VERSION
    && (status & ACTIVE_SOURCE_READY_ADMITTED)
      == ACTIVE_SOURCE_READY_ADMITTED
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
    && physical_count == params.expected_source_count
    && physical_count > 0u
    && physical_capacity == aggregate_view[17u]
    && active_count <= physical_count
    && active_count <= active_capacity
    && active_capacity <= physical_capacity
    && active_source_view[20u] == physical_count - active_count
    && active_source_view[21u] == 0u
    && active_source_view[22u] == 0u
    && active_source_view[23u] == QUERY_SOURCE_LEVEL_ASSIGNMENT_V0
    && active_source_view[24u] == LEVEL_ASSIGNMENT_QUERY_FLOATS
    && active_to_physical == ACTIVE_SOURCE_HEADER_WORDS
    && physical_to_active == active_to_physical + active_capacity
    && capacity_words == physical_to_active + physical_capacity
    && capacity_words <= arrayLength(&active_source_view)
    && active_source_view[29u] == params.completion_ordinal
    && active_source_view[30u] == params.completion_ordinal
    && active_source_view[32u] == physical_count
    && active_source_view[33u] == active_count
    && active_source_view[34u] == active_count
    && active_source_view[35u] == active_count
    && active_source_view[37u] == 64u
    && active_source_view[40u] == ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD
    && active_source_view[47u] != 0u
    && dispatch_admitted
    && aggregate_view[91u] == ACTIVE_MEMBER_MAGIC
    && aggregate_view[92u] == ACTIVE_MEMBER_VERSION
    && aggregate_view[93u] == ACTIVE_MEMBER_READY_ADMITTED
    && aggregate_view[94u] == params.active_member_offset_words
    && aggregate_view[95u] == params.active_member_capacity
    && aggregate_view[96u] == active_count
    && aggregate_view[97u] == physical_count
    && aggregate_view[99u] == params.generation_id
    && aggregate_view[100u] == params.completion_ordinal
    && aggregate_view[107u] == params.aggregate_capacity_words
      + params.active_member_capacity
    && aggregate_view[109u] == params.storage_generation
    && aggregate_view[110u] != 0u
    && params.active_member_offset_words == params.aggregate_capacity_words
    && params.active_member_capacity == physical_capacity
    && params.active_member_offset_words + params.active_member_capacity
      <= arrayLength(&aggregate_view);
}

fn active_source_contains_physical(physical_source: u32) -> bool {
  if (physical_source >= params.expected_source_count) {
    return false;
  }
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let authority_active_ordinal =
    active_source_view[physical_to_active + physical_source];
  return authority_active_ordinal < active_source_view[18u]
    && active_source_view[active_to_physical + authority_active_ordinal]
      == physical_source;
}

fn squared_distance_to_aabb(
  point: vec3<f32>,
  minimum: vec3<f32>,
  maximum: vec3<f32>
) -> f32 {
  let delta = max(max(minimum - point, point - maximum), vec3<f32>(0.0));
  return dot(delta, delta);
}

@compute @workgroup_size(64)
fn traverse_aggregate_view(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  var query_index = global_id.x;
  if (params.query_work_identity == QUERY_WORK_ACTIVE_ORDINAL) {
    if (!active_source_view_admitted()) {
      return;
    }
    let linear_group = workgroup_id.x
      + workgroup_id.y
        * active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD];
    let active_ordinal = linear_group * 64u + local_id.x;
    if (active_ordinal >= active_source_view[18u]) {
      return;
    }
    let projected_physical_source =
      aggregate_view[params.active_member_offset_words + active_ordinal];
    if (!active_source_contains_physical(projected_physical_source)) {
      let authority_physical_source = active_source_view[
        active_source_view[25u] + active_ordinal
      ];
      if (authority_physical_source < params.query_count) {
        fail_summary(
          authority_physical_source * params.summary_stride_words,
          authority_physical_source,
          TRAVERSAL_IDENTITY_MISMATCH
        );
      }
      return;
    }
    query_index = projected_physical_source;
  } else if (params.query_work_identity != QUERY_WORK_PHYSICAL_INDEX) {
    return;
  }
  if (query_index >= params.query_count) {
    return;
  }
  let summary_base = query_index * params.summary_stride_words;
  let source_layout_valid = params.query_source_layout_id
    == QUERY_SOURCE_PACKED_V0
    || params.query_source_layout_id == QUERY_SOURCE_LEVEL_ASSIGNMENT_V0;
  let minimum_query_stride = select(
    PACKED_QUERY_FLOATS,
    LEVEL_ASSIGNMENT_QUERY_FLOATS,
    params.query_source_layout_id == QUERY_SOURCE_LEVEL_ASSIGNMENT_V0
  );
  if (
    params.summary_stride_words < 32u
    || !source_layout_valid
    || params.query_stride_floats < minimum_query_stride
    || query_index >= params.query_capacity
    || !aggregate_admitted()
  ) {
    fail_summary(summary_base, query_index, TRAVERSAL_IDENTITY_MISMATCH);
    return;
  }
  let query_base = query_index * params.query_stride_floats;
  var query_position = vec3<f32>(0.0);
  var near_radius = 0.0;
  var theta = 0.0;
  var query_mass = 0.0;
  if (params.query_source_layout_id == QUERY_SOURCE_LEVEL_ASSIGNMENT_V0) {
    query_position = vec3<f32>(
      traversal_queries[query_base + 12u],
      traversal_queries[query_base + 13u],
      traversal_queries[query_base + 14u]
    );
    near_radius = traversal_queries[query_base + 2u]
      * params.near_field_support_scale;
    theta = params.opening_theta;
    query_mass = traversal_queries[query_base + 6u];
  } else {
    query_position = vec3<f32>(
      traversal_queries[query_base],
      traversal_queries[query_base + 1u],
      traversal_queries[query_base + 2u]
    );
    near_radius = traversal_queries[query_base + 3u];
    theta = traversal_queries[query_base + 4u];
    query_mass = traversal_queries[query_base + 5u];
  }
  if (
    !finite_vec3(query_position)
    || !finite_f32(near_radius)
    || near_radius < 0.0
    || !finite_f32(theta)
    || theta < 0.0
    || !finite_f32(query_mass)
    || query_mass < 0.0
  ) {
    fail_summary(summary_base, query_index, TRAVERSAL_IDENTITY_MISMATCH);
    return;
  }
  let total_record_count = aggregate_view[54u];
  let leaf_count = aggregate_view[23u];
  let aggregate_member_count = select(
    params.expected_source_count,
    aggregate_view[96u],
    params.query_work_identity == QUERY_WORK_ACTIVE_ORDINAL
  );
  var record_index = aggregate_view[53u];
  var visited_count = 0u;
  var accepted_far_count = 0u;
  var accepted_internal_count = 0u;
  var near_leaf_count = 0u;
  var opened_count = 0u;
  var covered_leaf_count = 0u;
  var far_mass = 0.0;
  var near_mass = 0.0;
  var far_first_moment = vec3<f32>(0.0);
  var far_momentum = vec3<f32>(0.0);
  var far_angular = vec3<f32>(0.0);
  var far_internal = 0.0;
  var far_kinetic = 0.0;
  var acceleration = vec3<f32>(0.0);
  var malformed = false;
  loop {
    if (record_index == INVALID_U32) {
      break;
    }
    if (visited_count >= total_record_count || record_index >= total_record_count) {
      malformed = true;
      break;
    }
    visited_count = visited_count + 1u;
    let base = record_base(record_index);
    let status = aggregate_view[base + 27u];
    let escape_index = aggregate_view[base + 37u];
    let rank_begin = aggregate_view[base + 38u];
    let rank_end = aggregate_view[base + 39u];
    let particle_count = aggregate_view[base + 19u];
    let source_member_count = aggregate_view[base + 43u];
    let is_leaf = (status & RECORD_STATUS_LEAF) != 0u;
    let is_internal = (status & RECORD_STATUS_INTERNAL) != 0u;
    let is_root = (status & RECORD_STATUS_ROOT) != 0u;
    if (
      (status & (RECORD_STATUS_VALID | RECORD_STATUS_TOPOLOGY_AUTHENTICATED))
        != (RECORD_STATUS_VALID | RECORD_STATUS_TOPOLOGY_AUTHENTICATED)
      || is_leaf == is_internal
      || is_leaf != (record_index < leaf_count)
      || is_root != (record_index == aggregate_view[53u])
      || rank_begin >= rank_end
      || rank_end > leaf_count
      || source_member_count == 0u
      || source_member_count > aggregate_member_count
      || particle_count > source_member_count
      || aggregate_view[base + 41u] != topology_fingerprint(record_index)
      || (escape_index != INVALID_U32 && escape_index >= total_record_count)
    ) {
      malformed = true;
      break;
    }
    if (is_leaf) {
      let source_begin = aggregate_view[base + 33u];
      let source_end = aggregate_view[base + 34u];
      if (
        source_begin >= source_end
        || source_end > aggregate_member_count
        || source_member_count != source_end - source_begin
      ) {
        malformed = true;
        break;
      }
    } else {
      let left_index = aggregate_view[base + 33u];
      let right_index = aggregate_view[base + 34u];
      if (
        left_index >= total_record_count
        || right_index >= total_record_count
        || left_index == right_index
      ) {
        malformed = true;
        break;
      }
      let left_base = record_base(left_index);
      let right_base = record_base(right_index);
      let left_source_count = aggregate_view[left_base + 43u];
      let right_source_count = aggregate_view[right_base + 43u];
      let left_particle_count = aggregate_view[left_base + 19u];
      let right_particle_count = aggregate_view[right_base + 19u];
      if (
        left_source_count > source_member_count
        || right_source_count != source_member_count - left_source_count
        || left_particle_count > particle_count
        || right_particle_count != particle_count - left_particle_count
      ) {
        malformed = true;
        break;
      }
    }
    let mass = bitcast<f32>(aggregate_view[base]);
    let first_moment = vec3<f32>(
      bitcast<f32>(aggregate_view[base + 1u]),
      bitcast<f32>(aggregate_view[base + 2u]),
      bitcast<f32>(aggregate_view[base + 3u])
    );
    let minimum = vec3<f32>(
      bitcast<f32>(aggregate_view[base + 12u]),
      bitcast<f32>(aggregate_view[base + 13u]),
      bitcast<f32>(aggregate_view[base + 14u])
    );
    let maximum = vec3<f32>(
      bitcast<f32>(aggregate_view[base + 15u]),
      bitcast<f32>(aggregate_view[base + 16u]),
      bitcast<f32>(aggregate_view[base + 17u])
    );
    let radius = bitcast<f32>(aggregate_view[base + 18u]);
    let momentum = vec3<f32>(
      bitcast<f32>(aggregate_view[base + 4u]),
      bitcast<f32>(aggregate_view[base + 5u]),
      bitcast<f32>(aggregate_view[base + 6u])
    );
    let angular_momentum = vec3<f32>(
      bitcast<f32>(aggregate_view[base + 7u]),
      bitcast<f32>(aggregate_view[base + 8u]),
      bitcast<f32>(aggregate_view[base + 9u])
    );
    let internal_energy = bitcast<f32>(aggregate_view[base + 10u]);
    let kinetic_energy = bitcast<f32>(aggregate_view[base + 11u]);
    if (particle_count == 0u) {
      let canonical_empty = aggregate_view[base] == 0u
        && aggregate_view[base + 1u] == 0u
        && aggregate_view[base + 2u] == 0u
        && aggregate_view[base + 3u] == 0u
        && aggregate_view[base + 4u] == 0u
        && aggregate_view[base + 5u] == 0u
        && aggregate_view[base + 6u] == 0u
        && aggregate_view[base + 7u] == 0u
        && aggregate_view[base + 8u] == 0u
        && aggregate_view[base + 9u] == 0u
        && aggregate_view[base + 10u] == 0u
        && aggregate_view[base + 11u] == 0u
        && all(minimum == vec3<f32>(0.0))
        && all(maximum == vec3<f32>(0.0))
        && aggregate_view[base + 18u] == 0u
        && aggregate_view[base + 20u] == 0u
        && aggregate_view[base + 21u] == 0u
        && aggregate_view[base + 22u] == 0u
        && aggregate_view[base + 23u] == 0u
        && aggregate_view[base + 24u] == 0u
        && aggregate_view[base + 25u] == INVALID_U32
        && aggregate_view[base + 26u] == INVALID_U32
        && aggregate_view[base + 42u] == INVALID_U32;
      if (!canonical_empty) {
        malformed = true;
        break;
      }
      covered_leaf_count = covered_leaf_count + rank_end - rank_begin;
      record_index = escape_index;
      continue;
    }
    if (
      !finite_f32(mass)
      || mass <= 0.0
      || !finite_vec3(first_moment)
      || !finite_vec3(momentum)
      || !finite_vec3(angular_momentum)
      || !finite_f32(internal_energy)
      || internal_energy < 0.0
      || !finite_f32(kinetic_energy)
      || kinetic_energy < 0.0
      || !finite_vec3(minimum)
      || !finite_vec3(maximum)
      || any(minimum > maximum)
      || !finite_f32(radius)
      || radius < 0.0
    ) {
      malformed = true;
      break;
    }
    let center = first_moment / mass;
    let separation = center - query_position;
    let distance = max(length(separation), 0.000001);
    let node_size = max(
      max(maximum.x - minimum.x, maximum.y - minimum.y),
      max(maximum.z - minimum.z, radius * 2.0)
    );
    let opening_ratio = node_size / distance;
    let near_intersects = squared_distance_to_aabb(
      query_position,
      minimum,
      maximum
    ) <= near_radius * near_radius;
    if (is_leaf && near_intersects) {
      near_leaf_count = near_leaf_count + 1u;
      covered_leaf_count = covered_leaf_count + 1u;
      near_mass = near_mass + mass;
      record_index = escape_index;
      continue;
    }
    let accept_far = is_leaf || (!near_intersects && opening_ratio <= theta);
    if (accept_far) {
      accepted_far_count = accepted_far_count + 1u;
      accepted_internal_count = accepted_internal_count
        + select(0u, 1u, is_internal);
      covered_leaf_count = covered_leaf_count + rank_end - rank_begin;
      far_mass = far_mass + mass;
      far_first_moment = far_first_moment + first_moment;
      far_momentum = far_momentum + momentum;
      far_angular = far_angular + angular_momentum;
      far_internal = far_internal + internal_energy;
      far_kinetic = far_kinetic + kinetic_energy;
      let softened_r2 = dot(separation, separation)
        + params.softening_length_m * params.softening_length_m;
      let inverse_r3 = inverseSqrt(softened_r2 * softened_r2 * softened_r2);
      acceleration = acceleration
        + params.force_scale * params.gravitational_constant * mass
          * separation * inverse_r3;
      record_index = escape_index;
    } else {
      opened_count = opened_count + 1u;
      let left_child = aggregate_view[base + 33u];
      let right_child = aggregate_view[base + 34u];
      if (
        !is_internal
        || left_child >= total_record_count
        || right_child >= total_record_count
        || left_child == right_child
        || aggregate_view[record_base(left_child) + 36u] != record_index
        || aggregate_view[record_base(right_child) + 36u] != record_index
      ) {
        malformed = true;
        break;
      }
      record_index = left_child;
    }
  }
  if (malformed || covered_leaf_count != leaf_count) {
    fail_summary(
      summary_base,
      query_index,
      select(
        TRAVERSAL_INCOMPLETE_PARTITION,
        TRAVERSAL_TOPOLOGY_MISMATCH,
        malformed
      )
    );
    return;
  }
  for (var column = 0u; column < 32u; column = column + 1u) {
    store_summary_word(summary_base, column, 0u);
  }
  store_summary_word(summary_base, 0u, TRAVERSAL_READY | TRAVERSAL_ADMITTED);
  store_summary_word(summary_base, 1u, query_index);
  store_summary_word(summary_base, 2u, visited_count);
  store_summary_word(summary_base, 3u, accepted_far_count);
  store_summary_word(summary_base, 4u, near_leaf_count);
  store_summary_word(summary_base, 5u, opened_count);
  store_summary_word(summary_base, 6u, covered_leaf_count);
  store_summary_word(summary_base, 7u, leaf_count);
  store_summary_f32(summary_base, 8u, far_mass);
  store_summary_f32(summary_base, 9u, near_mass);
  store_summary_f32(summary_base, 10u, far_first_moment.x);
  store_summary_f32(summary_base, 11u, far_first_moment.y);
  store_summary_f32(summary_base, 12u, far_first_moment.z);
  store_summary_f32(summary_base, 13u, far_momentum.x);
  store_summary_f32(summary_base, 14u, far_momentum.y);
  store_summary_f32(summary_base, 15u, far_momentum.z);
  store_summary_f32(summary_base, 16u, far_angular.x);
  store_summary_f32(summary_base, 17u, far_angular.y);
  store_summary_f32(summary_base, 18u, far_angular.z);
  store_summary_f32(summary_base, 19u, far_internal);
  store_summary_f32(summary_base, 20u, far_kinetic);
  store_summary_f32(summary_base, 21u, acceleration.x);
  store_summary_f32(summary_base, 22u, acceleration.y);
  store_summary_f32(summary_base, 23u, acceleration.z);
  store_summary_f32(summary_base, 24u, query_mass);
  store_summary_word(summary_base, 25u, params.generation_id);
  store_summary_word(summary_base, 26u, params.storage_generation);
  store_summary_word(summary_base, 27u, params.position_epoch);
  store_summary_word(summary_base, 28u, params.topology_epoch);
  store_summary_word(summary_base, 29u, aggregate_view[62u]);
  store_summary_word(summary_base, 30u, aggregate_view[56u]);
  store_summary_word(summary_base, 31u, params.completion_ordinal);
  if (accepted_internal_count > accepted_far_count) {
    fail_summary(summary_base, query_index, TRAVERSAL_TOPOLOGY_MISMATCH);
  }
}
`;
