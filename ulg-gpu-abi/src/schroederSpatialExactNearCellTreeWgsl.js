import {
  createSchroederSpatialExactNearTraversalV1Wgsl
} from './schroederSpatialExactNearTraversalWgsl.js';

const exactNearTraversalWgsl = createSchroederSpatialExactNearTraversalV1Wgsl({
  directoryBindingName: 'spatial_directory'
});

export function createSchroederSpatialExactNearCellTreeTraversalV1Wgsl({
  treeBindingName = 'exact_near_cell_tree',
  directoryBindingName = 'spatial_directory'
} = {}) {
  return /* wgsl */ `
const SS_EXACT_CELL_TREE_MAGIC: u32 = 0x53435431u;
const SS_EXACT_CELL_TREE_VERSION: u32 = 1u;
const SS_EXACT_CELL_TREE_HEADER_WORDS: u32 = 40u;
const SS_EXACT_CELL_TREE_NODE_WORDS: u32 = 8u;
const SS_EXACT_CELL_TREE_READY: u32 = 1u;
const SS_EXACT_CELL_TREE_ADMITTED: u32 = 2u;
const SS_EXACT_CELL_TREE_FAIL_CLOSED: u32 = 4u;
const SS_EXACT_CELL_TREE_NODE_VALID: u32 = 1u;
const SS_EXACT_CELL_TREE_NODE_LEAF: u32 = 2u;
const SS_EXACT_CELL_TREE_NODE_INTERNAL: u32 = 4u;
const SS_EXACT_CELL_TREE_INVALID_U32: u32 = 0xffffffffu;

fn ss_exact_cell_tree_node_base(node_index: u32) -> u32 {
  return ${treeBindingName}[22u] + node_index * SS_EXACT_CELL_TREE_NODE_WORDS;
}

fn ss_exact_cell_tree_admitted(
  expected: SchroederSpatialExactNearExpectationV1
) -> bool {
  let tree_word_length = arrayLength(&${treeBindingName});
  if (tree_word_length < SS_EXACT_CELL_TREE_HEADER_WORDS) {
    return false;
  }
  let required_status = SS_EXACT_CELL_TREE_READY | SS_EXACT_CELL_TREE_ADMITTED;
  let cell_count = ${directoryBindingName}[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  let leaf_capacity = ${treeBindingName}[20u];
  let node_capacity = ${treeBindingName}[21u];
  let node_offset = ${treeBindingName}[22u];
  let tree_depth = ${treeBindingName}[23u];
  if (tree_depth > 30u) {
    return false;
  }
  let topology_leaf_capacity = 1u << tree_depth;
  // Divide before multiplying so an untrusted header cannot wrap an address
  // calculation and make a truncated tree look admitted.
  let whole_tree_in_bounds = node_offset <= tree_word_length
    && node_capacity <= (tree_word_length - node_offset) / SS_EXACT_CELL_TREE_NODE_WORDS;
  if (!whole_tree_in_bounds || node_capacity == 0u) {
    return false;
  }
  let root_base = node_offset;
  let root_status = ${treeBindingName}[root_base + 6u];
  let expected_root_kind = select(
    SS_EXACT_CELL_TREE_NODE_VALID | SS_EXACT_CELL_TREE_NODE_INTERNAL,
    SS_EXACT_CELL_TREE_NODE_VALID | SS_EXACT_CELL_TREE_NODE_LEAF,
    leaf_capacity == 1u
  );
  return ${treeBindingName}[0u] == SS_EXACT_CELL_TREE_MAGIC
    && ${treeBindingName}[1u] == SS_EXACT_CELL_TREE_VERSION
    && (${treeBindingName}[2u] & required_status) == required_status
    && (${treeBindingName}[2u] & SS_EXACT_CELL_TREE_FAIL_CLOSED) == 0u
    && ${treeBindingName}[3u] == expected.expected_generation_id
    && ${treeBindingName}[4u] == expected.expected_device_ordinal
    && ${treeBindingName}[5u] == expected.expected_lane_ordinal
    && ${treeBindingName}[6u] == expected.expected_lease_token
    && ${treeBindingName}[7u] == expected.expected_source_family_id
    && ${treeBindingName}[8u] == expected.expected_storage_generation
    && ${treeBindingName}[9u] == expected.expected_physics_tick
    && ${treeBindingName}[10u] == expected.expected_physics_substep
    && ${treeBindingName}[11u] == expected.expected_position_epoch
    && ${treeBindingName}[12u] == expected.expected_topology_epoch
    && ${treeBindingName}[13u] == expected.expected_chart_epoch
    && ${treeBindingName}[14u] == expected.expected_level_epoch
    && ${treeBindingName}[15u] == expected.expected_support_epoch
    && ${treeBindingName}[16u] == expected.source_count
    && ${treeBindingName}[17u] == expected.expected_source_capacity
    && ${treeBindingName}[18u] == cell_count
    && ${treeBindingName}[19u] == expected.expected_cell_capacity
    && cell_count > 0u
    && expected.expected_cell_capacity > 0u
    && expected.expected_cell_capacity <= leaf_capacity
    && cell_count <= leaf_capacity
    && leaf_capacity > 0u
    && leaf_capacity == topology_leaf_capacity
    && node_capacity == leaf_capacity * 2u - 1u
    && node_offset == SS_EXACT_CELL_TREE_HEADER_WORDS
    && whole_tree_in_bounds
    && ${treeBindingName}[24u] == expected.expected_directory_capacity_words
    && ${treeBindingName}[25u] == expected.expected_cell_keys_offset_words
    && ${treeBindingName}[26u] == expected.expected_cell_offsets_offset_words
    && ${treeBindingName}[27u] == expected.expected_cell_members_offset_words
    && ${treeBindingName}[28u] == expected.expected_particle_to_cell_offset_words
    && ${treeBindingName}[29u]
      == ${directoryBindingName}[SS_EXACT_NEAR_HEADER_COMPLETION_ORDINAL]
    && ${treeBindingName}[30u] == cell_count
    && ${treeBindingName}[31u] == 0u
    && ${treeBindingName}[32u] == 0u
    && ${treeBindingName}[33u] == SS_EXACT_CELL_TREE_NODE_WORDS
    && root_base + SS_EXACT_CELL_TREE_NODE_WORDS <= tree_word_length
    && ((root_status & (
      SS_EXACT_CELL_TREE_NODE_VALID | SS_EXACT_CELL_TREE_NODE_INTERNAL | SS_EXACT_CELL_TREE_NODE_LEAF
    )) == expected_root_kind);
}

fn ss_exact_cell_tree_node_status(node_index: u32) -> u32 {
  return ${treeBindingName}[ss_exact_cell_tree_node_base(node_index) + 6u];
}

fn ss_exact_cell_tree_node_is_leaf(node_index: u32) -> bool {
  let status = ss_exact_cell_tree_node_status(node_index);
  return (status & (
    SS_EXACT_CELL_TREE_NODE_VALID
      | SS_EXACT_CELL_TREE_NODE_LEAF
      | SS_EXACT_CELL_TREE_NODE_INTERNAL
  ))
    == (SS_EXACT_CELL_TREE_NODE_VALID | SS_EXACT_CELL_TREE_NODE_LEAF);
}

fn ss_exact_cell_tree_node_is_internal(node_index: u32) -> bool {
  let status = ss_exact_cell_tree_node_status(node_index);
  return (status & (
    SS_EXACT_CELL_TREE_NODE_VALID
      | SS_EXACT_CELL_TREE_NODE_LEAF
      | SS_EXACT_CELL_TREE_NODE_INTERNAL
  ))
    == (SS_EXACT_CELL_TREE_NODE_VALID | SS_EXACT_CELL_TREE_NODE_INTERNAL);
}

fn ss_exact_cell_tree_node_intersects(
  node_index: u32,
  query_minimum: vec3<f32>,
  query_maximum: vec3<f32>
) -> bool {
  let base = ss_exact_cell_tree_node_base(node_index);
  let status = ${treeBindingName}[base + 6u];
  if ((status & SS_EXACT_CELL_TREE_NODE_VALID) == 0u) { return false; }
  let minimum = vec3<f32>(
    bitcast<f32>(${treeBindingName}[base]),
    bitcast<f32>(${treeBindingName}[base + 1u]),
    bitcast<f32>(${treeBindingName}[base + 2u])
  );
  let maximum = vec3<f32>(
    bitcast<f32>(${treeBindingName}[base + 3u]),
    bitcast<f32>(${treeBindingName}[base + 4u]),
    bitcast<f32>(${treeBindingName}[base + 5u])
  );
  return ss_exact_near_finite(minimum.x)
    && ss_exact_near_finite(minimum.y)
    && ss_exact_near_finite(minimum.z)
    && ss_exact_near_finite(maximum.x)
    && ss_exact_near_finite(maximum.y)
    && ss_exact_near_finite(maximum.z)
    && all(minimum <= maximum)
    && all(minimum <= query_maximum)
    && all(maximum >= query_minimum);
}

fn ss_exact_cell_tree_leaf_cell_index(node_index: u32) -> u32 {
  return ${treeBindingName}[ss_exact_cell_tree_node_base(node_index) + 7u];
}
`;
}

/**
 * Builds a law-neutral complete binary hierarchy over canonical SS directory
 * cells. The leaf AABBs are logical cell bounds plus one local-cell halo, not
 * material/render/mechanics bounds. A consumer still applies its exact pair
 * predicate after streaming an intersecting leaf's canonical CSR span.
 */
export const schroederSpatialExactNearCellTreeWgsl = /* wgsl */ `
struct ExactNearCellTreeBuildParams {
  leaf_capacity: u32,
  node_capacity: u32,
  node_offset_words: u32,
  tree_depth: u32,
  tree_word_capacity: u32,
  cell_capacity: u32,
  node_words: u32,
  reserved: u32,
};

struct ExactNearCellTreeLevelParams {
  level_start: u32,
  level_count: u32,
};

@group(0) @binding(0) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(1) var<storage, read_write> exact_near_cell_tree: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(3) var<uniform> tree_params: ExactNearCellTreeBuildParams;
@group(0) @binding(4) var<uniform> tree_level: ExactNearCellTreeLevelParams;

${exactNearTraversalWgsl}

const TREE_MAGIC: u32 = 0x53435431u;
const TREE_VERSION: u32 = 1u;
const TREE_HEADER_WORDS: u32 = 40u;
const TREE_NODE_WORDS: u32 = 8u;
const TREE_READY: u32 = 1u;
const TREE_ADMITTED: u32 = 2u;
const TREE_FAIL_CLOSED: u32 = 4u;
const TREE_INVALID_SOURCE: u32 = 8u;
const TREE_CAPACITY_OVERFLOW: u32 = 16u;
const TREE_NODE_VALID: u32 = 1u;
const TREE_NODE_LEAF: u32 = 2u;
const TREE_NODE_INTERNAL: u32 = 4u;
const TREE_INVALID_U32: u32 = 0xffffffffu;

const H_MAGIC: u32 = 0u;
const H_VERSION: u32 = 1u;
const H_STATUS: u32 = 2u;
const H_GENERATION: u32 = 3u;
const H_DEVICE: u32 = 4u;
const H_LANE: u32 = 5u;
const H_LEASE: u32 = 6u;
const H_SOURCE_FAMILY: u32 = 7u;
const H_STORAGE: u32 = 8u;
const H_TICK: u32 = 9u;
const H_SUBSTEP: u32 = 10u;
const H_POSITION: u32 = 11u;
const H_TOPOLOGY: u32 = 12u;
const H_CHART: u32 = 13u;
const H_LEVEL: u32 = 14u;
const H_SUPPORT: u32 = 15u;
const H_SOURCE_COUNT: u32 = 16u;
const H_SOURCE_CAPACITY: u32 = 17u;
const H_CELL_COUNT: u32 = 18u;
const H_CELL_CAPACITY: u32 = 19u;
const H_LEAF_CAPACITY: u32 = 20u;
const H_NODE_CAPACITY: u32 = 21u;
const H_NODE_OFFSET: u32 = 22u;
const H_TREE_DEPTH: u32 = 23u;
const H_DIRECTORY_CAPACITY: u32 = 24u;
const H_CELL_KEYS_OFFSET: u32 = 25u;
const H_CELL_OFFSETS_OFFSET: u32 = 26u;
const H_CELL_MEMBERS_OFFSET: u32 = 27u;
const H_PARTICLE_TO_CELL_OFFSET: u32 = 28u;
const H_DIRECTORY_COMPLETION: u32 = 29u;
const H_LEAF_BUILD_COUNT: u32 = 30u;
const H_INVALID_NODE_COUNT: u32 = 31u;
const H_ROOT_INDEX: u32 = 32u;
const H_NODE_WORD_COUNT: u32 = 33u;

fn tree_load(word: u32) -> u32 {
  return atomicLoad(&exact_near_cell_tree[word]);
}

fn tree_store(word: u32, value: u32) {
  atomicStore(&exact_near_cell_tree[word], value);
}

fn tree_node_base(node_index: u32) -> u32 {
  return tree_params.node_offset_words + node_index * TREE_NODE_WORDS;
}

fn tree_fail(status: u32) {
  tree_store(H_STATUS, TREE_FAIL_CLOSED | status);
}

fn tree_finite_vec3(value: vec3<f32>) -> bool {
  return ss_exact_near_finite(value.x)
    && ss_exact_near_finite(value.y)
    && ss_exact_near_finite(value.z);
}

@compute @workgroup_size(1)
fn initialize_exact_near_cell_tree() {
  if (tree_params.tree_depth > 30u) {
    tree_fail(TREE_CAPACITY_OVERFLOW | TREE_INVALID_SOURCE);
    return;
  }
  if (
    arrayLength(&exact_near_cell_tree) < tree_params.tree_word_capacity
    || tree_params.node_offset_words != TREE_HEADER_WORDS
    || tree_params.node_words != TREE_NODE_WORDS
    || tree_params.leaf_capacity == 0u
    || tree_params.node_capacity != tree_params.leaf_capacity * 2u - 1u
    || tree_params.leaf_capacity != (1u << tree_params.tree_depth)
    || tree_params.cell_capacity > tree_params.leaf_capacity
    || !ss_exact_near_directory_admitted(spatial_expectation)
  ) {
    tree_fail(TREE_CAPACITY_OVERFLOW | TREE_INVALID_SOURCE);
    return;
  }
  let directory_cell_count = spatial_directory[SS_EXACT_NEAR_HEADER_CELL_COUNT];
  if (directory_cell_count == 0u || directory_cell_count > tree_params.cell_capacity) {
    tree_fail(TREE_CAPACITY_OVERFLOW | TREE_INVALID_SOURCE);
    return;
  }
  tree_store(H_MAGIC, TREE_MAGIC);
  tree_store(H_VERSION, TREE_VERSION);
  tree_store(H_STATUS, 0u);
  tree_store(H_GENERATION, spatial_expectation.expected_generation_id);
  tree_store(H_DEVICE, spatial_expectation.expected_device_ordinal);
  tree_store(H_LANE, spatial_expectation.expected_lane_ordinal);
  tree_store(H_LEASE, spatial_expectation.expected_lease_token);
  tree_store(H_SOURCE_FAMILY, spatial_expectation.expected_source_family_id);
  tree_store(H_STORAGE, spatial_expectation.expected_storage_generation);
  tree_store(H_TICK, spatial_expectation.expected_physics_tick);
  tree_store(H_SUBSTEP, spatial_expectation.expected_physics_substep);
  tree_store(H_POSITION, spatial_expectation.expected_position_epoch);
  tree_store(H_TOPOLOGY, spatial_expectation.expected_topology_epoch);
  tree_store(H_CHART, spatial_expectation.expected_chart_epoch);
  tree_store(H_LEVEL, spatial_expectation.expected_level_epoch);
  tree_store(H_SUPPORT, spatial_expectation.expected_support_epoch);
  tree_store(H_SOURCE_COUNT, spatial_expectation.source_count);
  tree_store(H_SOURCE_CAPACITY, spatial_expectation.expected_source_capacity);
  tree_store(H_CELL_COUNT, directory_cell_count);
  tree_store(H_CELL_CAPACITY, tree_params.cell_capacity);
  tree_store(H_LEAF_CAPACITY, tree_params.leaf_capacity);
  tree_store(H_NODE_CAPACITY, tree_params.node_capacity);
  tree_store(H_NODE_OFFSET, tree_params.node_offset_words);
  tree_store(H_TREE_DEPTH, tree_params.tree_depth);
  tree_store(H_DIRECTORY_CAPACITY, spatial_expectation.expected_directory_capacity_words);
  tree_store(H_CELL_KEYS_OFFSET, spatial_expectation.expected_cell_keys_offset_words);
  tree_store(H_CELL_OFFSETS_OFFSET, spatial_expectation.expected_cell_offsets_offset_words);
  tree_store(H_CELL_MEMBERS_OFFSET, spatial_expectation.expected_cell_members_offset_words);
  tree_store(H_PARTICLE_TO_CELL_OFFSET, spatial_expectation.expected_particle_to_cell_offset_words);
  tree_store(H_DIRECTORY_COMPLETION, spatial_directory[SS_EXACT_NEAR_HEADER_COMPLETION_ORDINAL]);
  tree_store(H_ROOT_INDEX, 0u);
  tree_store(H_NODE_WORD_COUNT, TREE_NODE_WORDS);
}

@compute @workgroup_size(64)
fn build_exact_near_cell_tree_leaves(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let cell_index = global_id.x;
  if (tree_load(H_STATUS) != 0u || cell_index >= tree_load(H_CELL_COUNT)) {
    return;
  }
  let key_offset = spatial_expectation.expected_cell_keys_offset_words
    + cell_index * SS_EXACT_NEAR_KEY_WORDS;
  let offsets_offset = spatial_expectation.expected_cell_offsets_offset_words;
  let begin = spatial_directory[offsets_offset + cell_index];
  let end = spatial_directory[offsets_offset + cell_index + 1u];
  let level = i32(spatial_directory[key_offset + 1u] ^ 0x80000000u);
  let cell_coord = vec3<i32>(
    i32(spatial_directory[key_offset + 2u] ^ 0x80000000u),
    i32(spatial_directory[key_offset + 3u] ^ 0x80000000u),
    i32(spatial_directory[key_offset + 4u] ^ 0x80000000u)
  );
  let spacing_m = spatial_expectation.base_grid_spacing_m * exp2(f32(level));
  let raw_cell_minimum = vec3<f32>(
    f32(cell_coord.x), f32(cell_coord.y), f32(cell_coord.z)
  );
  let raw_cell_maximum = raw_cell_minimum + vec3<f32>(1.0);
  let raw_minimum = raw_cell_minimum * spacing_m;
  let raw_maximum = raw_cell_maximum * spacing_m;
  // This is a spatial-index rounding envelope, not a law/material radius.
  // One cell covers ordinary rounding; the relative term keeps the leaf
  // conservative when an admitted i32 coordinate is too large for f32 to
  // represent adjacent cells exactly.
  let coordinate_magnitude = max(
    max(abs(raw_cell_minimum), abs(raw_cell_maximum)),
    vec3<f32>(1.0)
  );
  let halo_cells = vec3<f32>(2.0) + coordinate_magnitude * 0.000000476837158203125;
  let halo_m = halo_cells * spacing_m;
  let minimum = raw_minimum - halo_m;
  let maximum = raw_maximum + halo_m;
  if (
    begin >= end
    || end > spatial_expectation.source_count
    || !ss_exact_near_finite(spacing_m)
    || spacing_m <= 0.0
    || !tree_finite_vec3(minimum)
    || !tree_finite_vec3(maximum)
    || !all(minimum <= maximum)
  ) {
    atomicAdd(&exact_near_cell_tree[H_INVALID_NODE_COUNT], 1u);
    return;
  }
  let node_index = tree_params.leaf_capacity - 1u + cell_index;
  if (node_index >= tree_params.node_capacity) {
    atomicAdd(&exact_near_cell_tree[H_INVALID_NODE_COUNT], 1u);
    return;
  }
  let base = tree_node_base(node_index);
  tree_store(base, bitcast<u32>(minimum.x));
  tree_store(base + 1u, bitcast<u32>(minimum.y));
  tree_store(base + 2u, bitcast<u32>(minimum.z));
  tree_store(base + 3u, bitcast<u32>(maximum.x));
  tree_store(base + 4u, bitcast<u32>(maximum.y));
  tree_store(base + 5u, bitcast<u32>(maximum.z));
  tree_store(base + 6u, TREE_NODE_VALID | TREE_NODE_LEAF);
  tree_store(base + 7u, cell_index);
  atomicAdd(&exact_near_cell_tree[H_LEAF_BUILD_COUNT], 1u);
}

@compute @workgroup_size(64)
fn reduce_exact_near_cell_tree_level(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let node_index = global_id.x;
  // The runtime binds this entry point once per complete-tree level.
  let level_start = tree_level.level_start;
  let level_count = tree_level.level_count;
  if (
    tree_load(H_STATUS) != 0u
    || node_index >= level_count
  ) {
    return;
  }
  let parent_index = level_start + node_index;
  let left_index = parent_index * 2u + 1u;
  let right_index = left_index + 1u;
  if (
    parent_index >= tree_params.node_capacity
    || right_index >= tree_params.node_capacity
  ) {
    atomicAdd(&exact_near_cell_tree[H_INVALID_NODE_COUNT], 1u);
    return;
  }
  let left_base = tree_node_base(left_index);
  let right_base = tree_node_base(right_index);
  let left_status = tree_load(left_base + 6u);
  let right_status = tree_load(right_base + 6u);
  let left_valid = (left_status & TREE_NODE_VALID) != 0u;
  let right_valid = (right_status & TREE_NODE_VALID) != 0u;
  let parent_base = tree_node_base(parent_index);
  if (!left_valid && !right_valid) {
    tree_store(parent_base + 6u, 0u);
    tree_store(parent_base + 7u, TREE_INVALID_U32);
    return;
  }
  let left_minimum = vec3<f32>(
    bitcast<f32>(tree_load(left_base)),
    bitcast<f32>(tree_load(left_base + 1u)),
    bitcast<f32>(tree_load(left_base + 2u))
  );
  let left_maximum = vec3<f32>(
    bitcast<f32>(tree_load(left_base + 3u)),
    bitcast<f32>(tree_load(left_base + 4u)),
    bitcast<f32>(tree_load(left_base + 5u))
  );
  let right_minimum = vec3<f32>(
    bitcast<f32>(tree_load(right_base)),
    bitcast<f32>(tree_load(right_base + 1u)),
    bitcast<f32>(tree_load(right_base + 2u))
  );
  let right_maximum = vec3<f32>(
    bitcast<f32>(tree_load(right_base + 3u)),
    bitcast<f32>(tree_load(right_base + 4u)),
    bitcast<f32>(tree_load(right_base + 5u))
  );
  let minimum = select(
    right_minimum,
    select(left_minimum, min(left_minimum, right_minimum), right_valid),
    left_valid
  );
  let maximum = select(
    right_maximum,
    select(left_maximum, max(left_maximum, right_maximum), right_valid),
    left_valid
  );
  if (
    !tree_finite_vec3(minimum)
    || !tree_finite_vec3(maximum)
    || !all(minimum <= maximum)
  ) {
    atomicAdd(&exact_near_cell_tree[H_INVALID_NODE_COUNT], 1u);
    return;
  }
  tree_store(parent_base, bitcast<u32>(minimum.x));
  tree_store(parent_base + 1u, bitcast<u32>(minimum.y));
  tree_store(parent_base + 2u, bitcast<u32>(minimum.z));
  tree_store(parent_base + 3u, bitcast<u32>(maximum.x));
  tree_store(parent_base + 4u, bitcast<u32>(maximum.y));
  tree_store(parent_base + 5u, bitcast<u32>(maximum.z));
  tree_store(parent_base + 6u, TREE_NODE_VALID | TREE_NODE_INTERNAL);
  tree_store(parent_base + 7u, TREE_INVALID_U32);
}

@compute @workgroup_size(1)
fn finalize_exact_near_cell_tree() {
  let root_base = tree_node_base(0u);
  let root_status = tree_load(root_base + 6u);
  let expected_root_kind = select(
    TREE_NODE_VALID | TREE_NODE_INTERNAL,
    TREE_NODE_VALID | TREE_NODE_LEAF,
    tree_params.leaf_capacity == 1u
  );
  let valid_root = (root_status & (
    TREE_NODE_VALID | TREE_NODE_INTERNAL | TREE_NODE_LEAF
  )) == expected_root_kind;
  if (
    tree_load(H_STATUS) != 0u
    || tree_load(H_MAGIC) != TREE_MAGIC
    || tree_load(H_VERSION) != TREE_VERSION
    || tree_load(H_LEAF_BUILD_COUNT) != tree_load(H_CELL_COUNT)
    || tree_load(H_INVALID_NODE_COUNT) != 0u
    || !valid_root
  ) {
    tree_fail(TREE_INVALID_SOURCE);
    return;
  }
  tree_store(H_STATUS, TREE_READY | TREE_ADMITTED);
}
`;
