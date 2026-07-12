export const ULG_RESIDENT_NEIGHBORHOOD_GPU_BUILDER_SCHEMA =
  'peercompute.ulg.resident-neighborhood-gpu-builder.v0';
export const ULG_RESIDENT_NEIGHBORHOOD_DENSE_UNIFORM_CHART_SCHEMA =
  'peercompute.ulg.resident-neighborhood-dense-uniform-chart.v0';

export const RESIDENT_NEIGHBORHOOD_CHART_LEVEL_U32_LAYOUT = Object.freeze([
  'chartId:u32',
  'levelOrderKey:u32',
  'cellSizeBits:u32',
  'originXBits:u32',
  'originYBits:u32',
  'originZBits:u32',
  'generation:u32',
  'chartFlags:u32'
]);

export const RESIDENT_NEIGHBORHOOD_CHART_FLAG = Object.freeze({
  VALID: 1 << 0,
  DYADIC_LEVELS: 1 << 1
});

export const RESIDENT_NEIGHBORHOOD_CELL_CSR_HEADER_U32_LAYOUT = Object.freeze([
  'headerVersion:u32',
  'generation:u32',
  'leaseTokenLow:u32',
  'leaseTokenHigh:u32',
  'positionEpoch:u32',
  'sourceCount:u32',
  'requiredUniqueCellCount:u32',
  'admittedUniqueCellCount:u32',
  'logicalUniqueCellCapacity:u32',
  'physicalUniqueCellCapacity:u32',
  'cellKeyBaseU32:u32',
  'cellOffsetBaseU32:u32',
  'cellMemberBaseU32:u32',
  'statusFlags:u32',
  'failClosed:u32',
  'consumerDispatchAllowed:u32'
]);

export const RESIDENT_NEIGHBORHOOD_BUILDER_STATUS_FLAG = Object.freeze({
  INVALID_OCCUPANCY_INPUT: 1 << 0,
  INVALID_SUPPORT_CLASS: 1 << 1,
  CANDIDATE_STAGING_OVERFLOW: 1 << 2,
  UNIQUE_PRIMITIVE_INVALID: 1 << 3,
  SEARCH_BOUND_EXCEEDED: 1 << 4,
  SUPPORT_CLASS_LIMIT_EXCEEDED: 1 << 5
});

export const RESIDENT_NEIGHBORHOOD_BUILDER_PARAM_U32_LAYOUT = Object.freeze([
  'sourceCount:u32',
  'generation:u32',
  'leaseTokenLow:u32',
  'leaseTokenHigh:u32',
  'positionEpoch:u32',
  'positionStrideU32:u32',
  'positionOffsetU32:u32',
  'chartBaseU32:u32',
  'supportClassBaseU32:u32',
  'supportClassCount:u32',
  'candidateScratchStrideU32:u32',
  'metadataCapacityU32:u32',
  'occupancyKeyStrideU32:u32',
  'cellKeyBaseU32:u32',
  'cellOffsetBaseU32:u32',
  'cellMemberBaseU32:u32',
  'cellUniquePhysicalCapacity:u32',
  'packedSourceOffsetBaseU32:u32',
  'packedAssignmentBaseU32:u32',
  'packedCandidateBaseU32:u32',
  'packedAssignmentStrideU32:u32',
  'packedCandidateStrideU32:u32',
  'candidateScratchCapacity:u32',
  'logicalUniqueCellCapacity:u32',
  'logicalCellOffsetCapacity:u32',
  'logicalCellMemberCapacity:u32',
  'logicalSourceOffsetCapacity:u32',
  'logicalSourceAssignmentCapacity:u32',
  'logicalCandidateCapacity:u32',
  'logicalByteCapacityLow:u32',
  'logicalByteCapacityHigh:u32',
  'capacityEvidenceStrideU32:u32',
  'skinDistanceBits:u32',
  'selfIncludeConsumerMask:u32',
  'selfExcludeConsumerMask:u32',
  'consumerMask:u32',
  'successStatusFlags:u32',
  'failureStatusFlags:u32',
  'maxCellRadius:u32',
  'maxLevelSpan:u32',
  'cellCsrBackingCapacityU32:u32',
  'packedCsrBackingCapacityU32:u32',
  'cellCsrHeaderStrideU32:u32',
  'packedCsrHeaderStrideU32:u32',
  'supportClassStrideU32:u32',
  'chartLevelStrideU32:u32',
  'builderVersion:u32',
  'dispatchX:u32',
  'hostAdmission:u32',
  'maxComputeWorkgroupsPerDimension:u32',
  'denseGridCellCount:u32',
  'denseGridDimensionX:u32',
  'denseGridDimensionY:u32',
  'denseGridDimensionZ:u32',
  'denseGridMinCellXOrderKey:u32',
  'denseGridMinCellYOrderKey:u32',
  'denseGridMinCellZOrderKey:u32',
  'denseGridChartId:u32',
  'denseGridLevelOrderKey:u32',
  'denseGridCellSizeBits:u32',
  'denseGridOriginXBits:u32',
  'denseGridOriginYBits:u32',
  'denseGridOriginZBits:u32',
  'denseGridAdmission:u32'
]);

// Bindings are intentionally stage-local under automatic pipeline layouts.
// No entry point consumes more than the WebGPU minimum of eight storage buffers.
export const residentNeighborhoodBuilderWgsl = /* wgsl */ `
struct BuilderParams {
  rows: array<vec4<u32>, 16>,
};

struct U64Parts {
  low: u32,
  high: u32,
};

@group(0) @binding(0) var<storage, read> position_words: array<u32>;
@group(0) @binding(1) var<storage, read> builder_metadata: array<u32>;
@group(0) @binding(2) var<storage, read_write> occupancy_keys: array<u32>;
@group(0) @binding(3) var<storage, read_write> cell_csr: array<u32>;
@group(0) @binding(4) var<storage, read_write> packed_candidate_csr: array<u32>;
@group(0) @binding(5) var<storage, read_write> candidate_scratch: array<u32>;
@group(0) @binding(6) var<storage, read_write> candidate_counts: array<u32>;
@group(0) @binding(7) var<storage, read> scanned_source_offsets: array<u32>;
@group(0) @binding(8) var<storage, read_write> build_status: array<atomic<u32>>;
@group(0) @binding(9) var<storage, read> unique_evidence: array<u32>;
@group(0) @binding(10) var<storage, read_write> capacity_evidence: array<u32>;
@group(0) @binding(11) var<uniform> builder_params: BuilderParams;
@group(0) @binding(12) var<storage, read> compact_unique_keys: array<u32>;
@group(0) @binding(13) var<storage, read_write> candidate_dispatch: array<u32>;

const UINT_MAX: u32 = 0xffffffffu;
const SIGN_ORDER_BIAS: u32 = 0x80000000u;
const CHART_VALID: u32 = 1u;
const CHART_DYADIC_LEVELS: u32 = 2u;
const SUPPORT_INCLUDE_SOURCE_CELL: u32 = 2u;
const SUPPORT_EXCLUDE_SELF: u32 = 4u;
const SUPPORT_CROSS_LEVEL: u32 = 8u;
const SUPPORT_CROSS_CHART: u32 = 16u;
const STATUS_INVALID_OCCUPANCY: u32 = 1u;
const STATUS_INVALID_SUPPORT: u32 = 2u;
const STATUS_STAGING_OVERFLOW: u32 = 4u;
const STATUS_UNIQUE_INVALID: u32 = 8u;
const STATUS_SEARCH_BOUND: u32 = 16u;
const STATUS_CLASS_LIMIT: u32 = 32u;
const CONTRACT_STATUS_OVERFLOW: u32 = 2u;
const CELL_KEY_STRIDE: u32 = 8u;
const CELL_HEADER_REQUIRED_UNIQUE: u32 = 6u;
const CELL_HEADER_ADMITTED_UNIQUE: u32 = 7u;
const CELL_HEADER_STATUS: u32 = 13u;
const CELL_HEADER_FAIL_CLOSED: u32 = 14u;
const CELL_HEADER_DISPATCH_ALLOWED: u32 = 15u;

fn p(index: u32) -> u32 {
  return builder_params.rows[index >> 2u][index & 3u];
}

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn finite_vec3(value: vec3<f32>) -> bool {
  return finite_f32(value.x) && finite_f32(value.y) && finite_f32(value.z);
}

fn signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ SIGN_ORDER_BIAS;
}

fn decode_signed_order_key(value: u32) -> i32 {
  return bitcast<i32>(value ^ SIGN_ORDER_BIAS);
}

fn linear_invocation(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>
) -> u32 {
  let linear_group = workgroup_id.x + workgroup_id.y * p(47u);
  return linear_group * 64u + local_id.x;
}

fn candidate_invocation(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>
) -> u32 {
  let linear_group = workgroup_id.x + workgroup_id.y * atomicLoad(&build_status[2]);
  return linear_group * 64u + local_id.x;
}

fn position_for(source_index: u32) -> vec3<f32> {
  let base = source_index * p(5u) + p(6u);
  return vec3<f32>(
    bitcast<f32>(position_words[base]),
    bitcast<f32>(position_words[base + 1u]),
    bitcast<f32>(position_words[base + 2u])
  );
}

fn chart_word(source_index: u32, word: u32) -> u32 {
  return builder_metadata[p(7u) + source_index * p(45u) + word];
}

fn support_word(row: u32, word: u32) -> u32 {
  return builder_metadata[p(8u) + row * p(44u) + word];
}

fn find_support_class(support_class_id: u32) -> u32 {
  var low = 0u;
  var high = p(9u);
  loop {
    if (low >= high) {
      break;
    }
    let middle = low + (high - low) / 2u;
    let observed = support_word(middle, 0u);
    if (observed < support_class_id) {
      low = middle + 1u;
    } else {
      high = middle;
    }
  }
  if (low < p(9u) && support_word(low, 0u) == support_class_id) {
    return low;
  }
  return UINT_MAX;
}

fn assignment_for(source_index: u32, slot: u32) -> u32 {
  return packed_candidate_csr[p(18u) + source_index * p(20u) + slot];
}

fn source_cell_component(position: f32, origin: f32, cell_size: f32) -> f32 {
  return floor((position - origin) / cell_size);
}

fn dense_grid_metadata_matches(source_index: u32) -> bool {
  return chart_word(source_index, 0u) == p(57u)
    && chart_word(source_index, 1u) == p(58u)
    && chart_word(source_index, 2u) == p(59u)
    && chart_word(source_index, 3u) == p(60u)
    && chart_word(source_index, 4u) == p(61u)
    && chart_word(source_index, 5u) == p(62u)
    && chart_word(source_index, 6u) == p(1u)
    && (chart_word(source_index, 7u) & CHART_VALID) != 0u;
}

// Conditional resident rebuilds preserve the previously admitted CSR until
// the GPU skin proof opens their indirect dispatch gates. This initializer is
// therefore a compute stage rather than an unconditional copy command.
@compute @workgroup_size(1)
fn initialize_conditional_generation() {
  cell_csr[0u] = p(46u);
  cell_csr[1u] = p(1u);
  cell_csr[2u] = p(2u);
  cell_csr[3u] = p(3u);
  cell_csr[4u] = p(4u);
  cell_csr[5u] = p(0u);
  cell_csr[6u] = 0u;
  cell_csr[7u] = 0u;
  cell_csr[8u] = p(23u);
  cell_csr[9u] = p(16u);
  cell_csr[10u] = p(13u);
  cell_csr[11u] = p(14u);
  cell_csr[12u] = p(15u);
  cell_csr[13u] = p(37u);
  cell_csr[14u] = 1u;
  cell_csr[15u] = 0u;

  packed_candidate_csr[0u] = p(46u);
  packed_candidate_csr[1u] = p(1u);
  packed_candidate_csr[2u] = p(2u);
  packed_candidate_csr[3u] = p(3u);
  packed_candidate_csr[4u] = p(4u);
  packed_candidate_csr[5u] = p(0u);
  packed_candidate_csr[9u] = p(0u) + 1u;
  packed_candidate_csr[10u] = 0u;
  packed_candidate_csr[13u] = p(0u);
  packed_candidate_csr[14u] = 0u;
  packed_candidate_csr[18u] = p(28u);
  packed_candidate_csr[19u] = 0u;
  packed_candidate_csr[22u] = p(35u);
  packed_candidate_csr[26u] = p(32u);
  packed_candidate_csr[27u] = bitcast<u32>(0.0);
  packed_candidate_csr[28u] = bitcast<u32>(0.5 * bitcast<f32>(p(32u)));
  packed_candidate_csr[29u] = 13u;
  packed_candidate_csr[30u] = p(37u);
  packed_candidate_csr[31u] = 0u;
  packed_candidate_csr[32u] = 0u;
  packed_candidate_csr[33u] = 1u;

  capacity_evidence[0u] = p(46u);
  capacity_evidence[1u] = p(1u);
  capacity_evidence[2u] = p(2u);
  capacity_evidence[3u] = p(3u);
  capacity_evidence[4u] = p(0u);
  for (var index = 0u; index < 44u; index = index + 1u) {
    if (index == 0u || (index >= 1u && index <= 4u)) {
      continue;
    }
    if (index == 7u || index == 11u || index == 15u || index == 19u
      || index == 23u || index == 27u || index == 33u || index == 34u
      || index == 37u || index == 38u) {
      continue;
    }
    capacity_evidence[index] = 0u;
  }
  capacity_evidence[39u] = p(37u);
  capacity_evidence[40u] = 1u;
  capacity_evidence[41u] = 0u;
  candidate_dispatch[0u] = 0u;
  candidate_dispatch[1u] = 1u;
  candidate_dispatch[2u] = 1u;
}

@compute @workgroup_size(64)
fn copy_cell_offsets_conditional(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let index = linear_invocation(local_id, workgroup_id);
  if (index < p(0u)) {
    cell_csr[p(14u) + index] = scanned_source_offsets[index];
  }
  if (index == 0u) {
    cell_csr[p(14u) + p(0u)] = scanned_source_offsets[p(0u)];
  }
}

@compute @workgroup_size(64)
fn copy_cell_members_conditional(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let index = linear_invocation(local_id, workgroup_id);
  if (index < p(0u)) {
    cell_csr[p(15u) + index] = scanned_source_offsets[index];
  }
}

@compute @workgroup_size(64)
fn copy_source_offsets_conditional(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let index = linear_invocation(local_id, workgroup_id);
  if (index < p(0u)) {
    packed_candidate_csr[p(17u) + index] = scanned_source_offsets[index];
  }
}

@compute @workgroup_size(64)
fn emit_occupancy_keys(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (p(48u) == 0u) {
    return;
  }
  let source_index = linear_invocation(local_id, workgroup_id);
  if (source_index >= p(0u)) {
    return;
  }
  let chart_id = chart_word(source_index, 0u);
  let level_order_key = chart_word(source_index, 1u);
  let cell_size = bitcast<f32>(chart_word(source_index, 2u));
  let origin = vec3<f32>(
    bitcast<f32>(chart_word(source_index, 3u)),
    bitcast<f32>(chart_word(source_index, 4u)),
    bitcast<f32>(chart_word(source_index, 5u))
  );
  let chart_generation = chart_word(source_index, 6u);
  let chart_flags = chart_word(source_index, 7u);
  let position = position_for(source_index);
  let max_radius = f32(p(38u));
  var valid = chart_generation == p(1u)
    && (chart_flags & CHART_VALID) != 0u
    && finite_f32(cell_size) && cell_size > 0.0
    && finite_vec3(origin) && finite_vec3(position);
  let cell_f = vec3<f32>(
    source_cell_component(position.x, origin.x, cell_size),
    source_cell_component(position.y, origin.y, cell_size),
    source_cell_component(position.z, origin.z, cell_size)
  );
  let lower_bound = -2147483520.0 + max_radius;
  let upper_bound = 2147483520.0 - max_radius;
  valid = valid && all(cell_f >= vec3<f32>(lower_bound))
    && all(cell_f <= vec3<f32>(upper_bound));
  let key_base = source_index * p(12u);
  if (!valid) {
    atomicOr(&build_status[0], STATUS_INVALID_OCCUPANCY);
    for (var word = 0u; word < p(12u); word = word + 1u) {
      occupancy_keys[key_base + word] = 0u;
    }
    return;
  }
  let cell = vec3<i32>(cell_f);
  // These five words, and only these words, are the structural radix key.
  occupancy_keys[key_base + 0u] = chart_id;
  occupancy_keys[key_base + 1u] = level_order_key;
  occupancy_keys[key_base + 2u] = signed_order_key(cell.x);
  occupancy_keys[key_base + 3u] = signed_order_key(cell.y);
  occupancy_keys[key_base + 4u] = signed_order_key(cell.z);
  occupancy_keys[key_base + 5u] = p(1u);
  occupancy_keys[key_base + 6u] = chart_flags;
  occupancy_keys[key_base + 7u] = 0u;
}

// A bounded, single-level uniform chart needs only one structural sort word.
// The x-major linear key preserves the canonical chart/x/y/z lexicographic
// order. The stable primitive therefore also preserves ascending source index
// inside every cell without an unordered atomic insertion stage.
@compute @workgroup_size(64)
fn emit_dense_uniform_chart_keys(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (p(48u) == 0u || p(63u) == 0u) {
    return;
  }
  let source_index = linear_invocation(local_id, workgroup_id);
  if (source_index >= p(0u)) {
    return;
  }
  let position = position_for(source_index);
  let cell_size = bitcast<f32>(p(59u));
  let origin = vec3<f32>(
    bitcast<f32>(p(60u)),
    bitcast<f32>(p(61u)),
    bitcast<f32>(p(62u))
  );
  let cell_f = floor((position - origin) / cell_size);
  let min_cell = vec3<i32>(
    decode_signed_order_key(p(54u)),
    decode_signed_order_key(p(55u)),
    decode_signed_order_key(p(56u))
  );
  var valid = dense_grid_metadata_matches(source_index)
    && p(50u) > 0u && p(51u) > 0u && p(52u) > 0u && p(53u) > 0u
    && finite_vec3(position) && finite_f32(cell_size) && cell_size > 0.0
    && finite_vec3(origin) && finite_vec3(cell_f)
    && all(cell_f >= vec3<f32>(-2147483520.0))
    && all(cell_f <= vec3<f32>(2147483520.0));
  let cell = vec3<i32>(cell_f);
  let relative = cell - min_cell;
  valid = valid
    && all(relative >= vec3<i32>(0))
    && relative.x < i32(p(51u))
    && relative.y < i32(p(52u))
    && relative.z < i32(p(53u));
  let key_base = source_index * p(12u);
  if (!valid) {
    atomicOr(&build_status[0], STATUS_INVALID_OCCUPANCY);
    for (var word = 0u; word < p(12u); word = word + 1u) {
      occupancy_keys[key_base + word] = 0u;
    }
    return;
  }
  let linear_cell = (u32(relative.x) * p(52u) + u32(relative.y)) * p(53u)
    + u32(relative.z);
  if (linear_cell >= p(50u)) {
    atomicOr(&build_status[0], STATUS_INVALID_OCCUPANCY);
    for (var word = 0u; word < p(12u); word = word + 1u) {
      occupancy_keys[key_base + word] = 0u;
    }
    return;
  }
  occupancy_keys[key_base] = linear_cell;
  for (var word = 1u; word < p(12u); word = word + 1u) {
    occupancy_keys[key_base + word] = 0u;
  }
}

@compute @workgroup_size(64)
fn assemble_cell_csr(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (p(48u) == 0u) {
    return;
  }
  let index = linear_invocation(local_id, workgroup_id);
  let primitive_valid = unique_evidence[0] == p(1u)
    && unique_evidence[1] == p(0u)
    && unique_evidence[3] == 1u
    && unique_evidence[4] == 0u
    && unique_evidence[5] == 5u
    && unique_evidence[6] == p(12u)
    && unique_evidence[7] == 1u;
  if (!primitive_valid) {
    atomicOr(&build_status[0], STATUS_UNIQUE_INVALID);
  }
  let unique_count = select(0u, unique_evidence[2], primitive_valid);
  if (index == 0u) {
    cell_csr[CELL_HEADER_REQUIRED_UNIQUE] = unique_count;
    cell_csr[CELL_HEADER_ADMITTED_UNIQUE] = 0u;
  }
  if (index >= unique_count || index >= p(16u)) {
    return;
  }
  let input_base = index * 5u;
  let output_base = p(13u) + index * CELL_KEY_STRIDE;
  for (var word = 0u; word < 5u; word = word + 1u) {
    cell_csr[output_base + word] = compact_unique_keys[input_base + word];
  }
  cell_csr[output_base + 5u] = p(1u);
  cell_csr[output_base + 6u] = 0u;
  cell_csr[output_base + 7u] = 0u;
}

@compute @workgroup_size(64)
fn assemble_dense_uniform_chart_cell_csr(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (p(48u) == 0u || p(63u) == 0u) {
    return;
  }
  let index = linear_invocation(local_id, workgroup_id);
  let primitive_valid = unique_evidence[0] == p(1u)
    && unique_evidence[1] == p(0u)
    && unique_evidence[3] == 1u
    && unique_evidence[4] == 0u
    && unique_evidence[5] == 1u
    && unique_evidence[6] == p(12u)
    && unique_evidence[7] == 1u;
  if (!primitive_valid) {
    atomicOr(&build_status[0], STATUS_UNIQUE_INVALID);
  }
  let unique_count = select(0u, unique_evidence[2], primitive_valid);
  if (unique_count > p(50u)) {
    atomicOr(&build_status[0], STATUS_UNIQUE_INVALID);
  }
  if (index == 0u) {
    cell_csr[CELL_HEADER_REQUIRED_UNIQUE] = select(0u, unique_count, unique_count <= p(50u));
    cell_csr[CELL_HEADER_ADMITTED_UNIQUE] = 0u;
  }
  if (index >= unique_count || index >= p(16u) || unique_count > p(50u)) {
    return;
  }
  let linear_cell = compact_unique_keys[index];
  let yz = p(52u) * p(53u);
  let relative_x = linear_cell / yz;
  let remainder = linear_cell - relative_x * yz;
  let relative_y = remainder / p(53u);
  let relative_z = remainder - relative_y * p(53u);
  if (linear_cell >= p(50u) || relative_x >= p(51u)
    || relative_y >= p(52u) || relative_z >= p(53u)) {
    atomicOr(&build_status[0], STATUS_UNIQUE_INVALID);
    return;
  }
  let min_cell = vec3<i32>(
    decode_signed_order_key(p(54u)),
    decode_signed_order_key(p(55u)),
    decode_signed_order_key(p(56u))
  );
  let cell = min_cell + vec3<i32>(
    i32(relative_x), i32(relative_y), i32(relative_z)
  );
  let output_base = p(13u) + index * CELL_KEY_STRIDE;
  cell_csr[output_base] = p(57u);
  cell_csr[output_base + 1u] = p(58u);
  cell_csr[output_base + 2u] = signed_order_key(cell.x);
  cell_csr[output_base + 3u] = signed_order_key(cell.y);
  cell_csr[output_base + 4u] = signed_order_key(cell.z);
  cell_csr[output_base + 5u] = p(1u);
  cell_csr[output_base + 6u] = 0u;
  cell_csr[output_base + 7u] = 0u;
}

fn compare_key_to_cell(
  chart_id: u32,
  level_key: u32,
  cell_x_key: u32,
  cell_y_key: u32,
  cell_z_key: u32,
  cell_index: u32
) -> i32 {
  let base = p(13u) + cell_index * CELL_KEY_STRIDE;
  let desired = array<u32, 5>(chart_id, level_key, cell_x_key, cell_y_key, cell_z_key);
  for (var word = 0u; word < 5u; word = word + 1u) {
    let observed = cell_csr[base + word];
    if (desired[word] < observed) {
      return -1;
    }
    if (desired[word] > observed) {
      return 1;
    }
  }
  return 0;
}

fn find_cell(
  chart_id: u32,
  level_key: u32,
  cell_x_key: u32,
  cell_y_key: u32,
  cell_z_key: u32
) -> u32 {
  let unique_count = cell_csr[CELL_HEADER_REQUIRED_UNIQUE];
  var low = 0u;
  var high = unique_count;
  loop {
    if (low >= high) {
      break;
    }
    let middle = low + (high - low) / 2u;
    let comparison = compare_key_to_cell(
      chart_id, level_key, cell_x_key, cell_y_key, cell_z_key, middle
    );
    if (comparison > 0) {
      low = middle + 1u;
    } else {
      high = middle;
    }
  }
  if (low < unique_count && compare_key_to_cell(
    chart_id, level_key, cell_x_key, cell_y_key, cell_z_key, low
  ) == 0) {
    return low;
  }
  return UINT_MAX;
}

fn matched_consumer_mask(
  source_index: u32,
  target_index: u32,
  source_chart: u32,
  source_level: i32,
  source_cell_size: f32,
  same_source_cell: bool,
  source_position: vec3<f32>
) -> u32 {
  let target_position = position_for(target_index);
  let target_chart = chart_word(target_index, 0u);
  let target_level = decode_signed_order_key(chart_word(target_index, 1u));
  let target_cell_size = bitcast<f32>(chart_word(target_index, 2u));
  let target_generation = chart_word(target_index, 6u);
  let target_flags = chart_word(target_index, 7u);
  if (!finite_vec3(target_position) || !finite_f32(target_cell_size)
    || target_cell_size <= 0.0 || target_generation != p(1u)
    || (target_flags & CHART_VALID) == 0u) {
    atomicOr(&build_status[0], STATUS_INVALID_OCCUPANCY);
    return 0u;
  }
  let displacement = target_position - source_position;
  let distance_squared = dot(displacement, displacement);
  if (!finite_f32(distance_squared)) {
    atomicOr(&build_status[0], STATUS_INVALID_OCCUPANCY);
    return 0u;
  }
  let level_delta = target_level - source_level;
  let skin_distance = bitcast<f32>(p(32u));
  var matched_mask = 0u;
  for (var slot = 0u; slot < 8u; slot = slot + 1u) {
    let consumer_bit = 1u << slot;
    let class_id = assignment_for(source_index, slot);
    if (class_id == UINT_MAX) {
      continue;
    }
    let row = find_support_class(class_id);
    if (row == UINT_MAX || support_word(row, 6u) != p(1u)
      || (support_word(row, 1u) & consumer_bit) == 0u) {
      atomicOr(&build_status[0], STATUS_INVALID_SUPPORT);
      continue;
    }
    let flags = support_word(row, 7u);
    if (target_chart != source_chart && (flags & SUPPORT_CROSS_CHART) == 0u) {
      continue;
    }
    if ((flags & SUPPORT_CROSS_LEVEL) == 0u) {
      if (level_delta != 0) {
        continue;
      }
    } else {
      let min_delta = decode_signed_order_key(support_word(row, 2u));
      let max_delta = decode_signed_order_key(support_word(row, 3u));
      if (level_delta < min_delta || level_delta > max_delta) {
        continue;
      }
    }
    if (same_source_cell && (flags & SUPPORT_INCLUDE_SOURCE_CELL) == 0u) {
      continue;
    }
    if (source_index == target_index && (flags & SUPPORT_EXCLUDE_SELF) != 0u) {
      continue;
    }
    let support_distance = f32(support_word(row, 4u))
      * max(source_cell_size, target_cell_size) + skin_distance;
    if (distance_squared <= support_distance * support_distance) {
      matched_mask = matched_mask | consumer_bit;
    }
  }
  matched_mask = matched_mask & p(35u);
  if (source_index == target_index) {
    matched_mask = matched_mask & p(33u) & ~p(34u);
  }
  return matched_mask;
}

fn direct_same_source_cell(
  target_index: u32,
  source_chart: u32,
  source_level_key: u32,
  source_cell: vec3<i32>
) -> bool {
  if (chart_word(target_index, 0u) != source_chart
    || chart_word(target_index, 1u) != source_level_key) {
    return false;
  }
  let target_cell_size = bitcast<f32>(chart_word(target_index, 2u));
  let target_origin = vec3<f32>(
    bitcast<f32>(chart_word(target_index, 3u)),
    bitcast<f32>(chart_word(target_index, 4u)),
    bitcast<f32>(chart_word(target_index, 5u))
  );
  let target_position = position_for(target_index);
  if (!finite_f32(target_cell_size) || target_cell_size <= 0.0
    || !finite_vec3(target_origin) || !finite_vec3(target_position)) {
    atomicOr(&build_status[0], STATUS_INVALID_OCCUPANCY);
    return false;
  }
  let target_cell_f = floor((target_position - target_origin) / target_cell_size);
  if (!finite_vec3(target_cell_f)
    || any(target_cell_f < vec3<f32>(-2147483520.0))
    || any(target_cell_f > vec3<f32>(2147483520.0))) {
    atomicOr(&build_status[0], STATUS_INVALID_OCCUPANCY);
    return false;
  }
  let target_cell = vec3<i32>(target_cell_f);
  return all(target_cell == source_cell);
}

fn direct_count_classes(
  source_index: u32,
  matched_mask: u32,
  class_counts: ptr<function, array<u32, 8>>
) {
  for (var slot = 0u; slot < 8u; slot = slot + 1u) {
    let consumer_bit = 1u << slot;
    if ((matched_mask & consumer_bit) == 0u) {
      continue;
    }
    let class_id = assignment_for(source_index, slot);
    var first_slot_for_class = true;
    for (var prior = 0u; prior < slot; prior = prior + 1u) {
      if ((matched_mask & (1u << prior)) != 0u
        && assignment_for(source_index, prior) == class_id) {
        first_slot_for_class = false;
      }
    }
    if (!first_slot_for_class) {
      continue;
    }
    let next_count = (*class_counts)[slot] + 1u;
    (*class_counts)[slot] = next_count;
    let row = find_support_class(class_id);
    if (row == UINT_MAX || next_count > support_word(row, 5u)) {
      atomicOr(&build_status[0], STATUS_CLASS_LIMIT);
    }
  }
}

@compute @workgroup_size(64)
fn count_candidates_direct(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (p(48u) == 0u) {
    return;
  }
  let source_index = linear_invocation(local_id, workgroup_id);
  if (source_index >= p(0u)) {
    return;
  }
  let source_position = position_for(source_index);
  let source_chart = chart_word(source_index, 0u);
  let source_level_key = chart_word(source_index, 1u);
  let source_level = decode_signed_order_key(source_level_key);
  let source_cell_size = bitcast<f32>(chart_word(source_index, 2u));
  let source_origin = vec3<f32>(
    bitcast<f32>(chart_word(source_index, 3u)),
    bitcast<f32>(chart_word(source_index, 4u)),
    bitcast<f32>(chart_word(source_index, 5u))
  );
  let source_flags = chart_word(source_index, 7u);
  let source_cell_f = floor((source_position - source_origin) / source_cell_size);
  if (!finite_vec3(source_position) || !finite_f32(source_cell_size)
    || source_cell_size <= 0.0 || !finite_vec3(source_origin)
    || !finite_vec3(source_cell_f)
    || any(source_cell_f < vec3<f32>(-2147483520.0))
    || any(source_cell_f > vec3<f32>(2147483520.0))
    || chart_word(source_index, 6u) != p(1u)
    || (source_flags & CHART_VALID) == 0u) {
    atomicOr(&build_status[0], STATUS_INVALID_OCCUPANCY);
    candidate_counts[source_index] = 0u;
    return;
  }
  let source_cell = vec3<i32>(source_cell_f);
  var local_count = 0u;
  var class_counts: array<u32, 8>;
  for (var slot = 0u; slot < 8u; slot = slot + 1u) {
    class_counts[slot] = 0u;
  }
  for (var target_index = 0u; target_index < p(0u); target_index = target_index + 1u) {
    let matched_mask = matched_consumer_mask(
      source_index,
      target_index,
      source_chart,
      source_level,
      source_cell_size,
      direct_same_source_cell(
        target_index,
        source_chart,
        source_level_key,
        source_cell
      ),
      source_position
    );
    if (matched_mask == 0u) {
      continue;
    }
    local_count = local_count + 1u;
    direct_count_classes(source_index, matched_mask, &class_counts);
  }
  candidate_counts[source_index] = local_count;
  atomicAdd(&build_status[1], local_count);
}

@compute @workgroup_size(64)
fn fill_candidates_direct(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (p(48u) == 0u || packed_candidate_csr[31u] == 0u
    || packed_candidate_csr[33u] != 0u || capacity_evidence[41u] == 0u) {
    return;
  }
  let source_index = linear_invocation(local_id, workgroup_id);
  if (source_index >= p(0u)) {
    return;
  }
  let source_position = position_for(source_index);
  let source_chart = chart_word(source_index, 0u);
  let source_level_key = chart_word(source_index, 1u);
  let source_level = decode_signed_order_key(source_level_key);
  let source_cell_size = bitcast<f32>(chart_word(source_index, 2u));
  let source_origin = vec3<f32>(
    bitcast<f32>(chart_word(source_index, 3u)),
    bitcast<f32>(chart_word(source_index, 4u)),
    bitcast<f32>(chart_word(source_index, 5u))
  );
  let source_cell = vec3<i32>(floor((source_position - source_origin) / source_cell_size));
  let destination_begin = packed_candidate_csr[p(17u) + source_index];
  let admitted_candidate_count = packed_candidate_csr[19u];
  var local_rank = 0u;
  for (var target_index = 0u; target_index < p(0u); target_index = target_index + 1u) {
    let matched_mask = matched_consumer_mask(
      source_index,
      target_index,
      source_chart,
      source_level,
      source_cell_size,
      direct_same_source_cell(
        target_index,
        source_chart,
        source_level_key,
        source_cell
      ),
      source_position
    );
    if (matched_mask == 0u) {
      continue;
    }
    let destination = destination_begin + local_rank;
    if (destination < admitted_candidate_count) {
      let row = p(19u) + destination * p(21u);
      packed_candidate_csr[row] = target_index;
      packed_candidate_csr[row + 1u] = matched_mask;
    }
    local_rank = local_rank + 1u;
  }
}

// Exact-capacity small-N lanes can keep one fixed source segment per particle.
// Inactive rows carry a zero consumer mask, so every consumer retains its
// normal physical distance/contact test without a count/scan/compact chain.
@compute @workgroup_size(64)
fn build_candidates_direct_segmented_masked(
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  if (p(48u) == 0u) {
    return;
  }
  let source_count = p(0u);
  if (source_count == 0u || source_count > 65535u) {
    if (local_id.x == 0u) {
      atomicOr(&build_status[0], STATUS_STAGING_OVERFLOW);
    }
    return;
  }
  let candidate_count = source_count * source_count;
  if (candidate_count > p(28u)) {
    if (local_id.x == 0u) {
      atomicOr(&build_status[0], STATUS_STAGING_OVERFLOW);
    }
    return;
  }

  // The fixed segment contains at most source_count active rows for any
  // support class. Validate that bound on-device so external metadata cannot
  // bypass the same class-limit contract as the compact direct path.
  for (var class_index = local_id.x;
    class_index < p(9u);
    class_index = class_index + 64u) {
    if (support_word(class_index, 5u) < source_count) {
      atomicOr(&build_status[0], STATUS_CLASS_LIMIT);
    }
  }

  for (var pair_index = local_id.x;
    pair_index < candidate_count;
    pair_index = pair_index + 64u) {
    let source_index = pair_index / source_count;
    let target_index = pair_index - source_index * source_count;
    let source_position = position_for(source_index);
    let source_chart = chart_word(source_index, 0u);
    let source_level_key = chart_word(source_index, 1u);
    let source_level = decode_signed_order_key(source_level_key);
    let source_cell_size = bitcast<f32>(chart_word(source_index, 2u));
    let source_origin = vec3<f32>(
      bitcast<f32>(chart_word(source_index, 3u)),
      bitcast<f32>(chart_word(source_index, 4u)),
      bitcast<f32>(chart_word(source_index, 5u))
    );
    let source_flags = chart_word(source_index, 7u);
    let source_cell_f = floor((source_position - source_origin) / source_cell_size);
    var matched_mask = 0u;
    if (!finite_vec3(source_position) || !finite_f32(source_cell_size)
      || source_cell_size <= 0.0 || !finite_vec3(source_origin)
      || !finite_vec3(source_cell_f)
      || any(source_cell_f < vec3<f32>(-2147483520.0))
      || any(source_cell_f > vec3<f32>(2147483520.0))
      || chart_word(source_index, 6u) != p(1u)
      || (source_flags & CHART_VALID) == 0u) {
      atomicOr(&build_status[0], STATUS_INVALID_OCCUPANCY);
    } else {
      let source_cell = vec3<i32>(source_cell_f);
      matched_mask = matched_consumer_mask(
        source_index,
        target_index,
        source_chart,
        source_level,
        source_cell_size,
        direct_same_source_cell(
          target_index,
          source_chart,
          source_level_key,
          source_cell
        ),
        source_position
      );
    }
    let candidate_row = p(19u) + pair_index * p(21u);
    packed_candidate_csr[candidate_row] = target_index;
    packed_candidate_csr[candidate_row + 1u] = matched_mask;
  }

  for (var source_index = local_id.x;
    source_index <= source_count;
    source_index = source_index + 64u) {
    packed_candidate_csr[p(17u) + source_index] = source_index * source_count;
    if (source_index < source_count) {
      candidate_counts[source_index] = source_count;
    }
  }

  storageBarrier();
  workgroupBarrier();
  if (local_id.x != 0u) {
    return;
  }

  let required_unique = cell_csr[6u];
  let required_cell_offsets = required_unique + 1u;
  let required_source_offsets = source_count + 1u;
  var packed_required_u32 = p(43u) + required_source_offsets;
  packed_required_u32 = align4(packed_required_u32);
  packed_required_u32 = packed_required_u32 + source_count * p(20u);
  packed_required_u32 = align4(packed_required_u32);
  packed_required_u32 = align4(packed_required_u32 + candidate_count * p(21u));
  var required_bytes = U64Parts(0u, 0u);
  required_bytes = add_u64(
    required_bytes,
    multiply_u32_small(required_unique, p(12u) * 4u)
  );
  required_bytes = add_u64(
    required_bytes,
    multiply_u32_small(required_cell_offsets, 4u)
  );
  required_bytes = add_u64(
    required_bytes,
    multiply_u32_small(source_count, 4u)
  );
  required_bytes = add_u64(
    required_bytes,
    multiply_u32_small(packed_required_u32, 4u)
  );
  required_bytes = add_u64(
    required_bytes,
    multiply_u32_small(p(9u), p(44u) * 4u)
  );
  required_bytes = add_u64(
    required_bytes,
    multiply_u32_small(p(31u), 4u)
  );
  let unique_overflow = required_unique > p(23u);
  let cell_offset_overflow = required_cell_offsets > p(24u);
  let cell_member_overflow = source_count > p(25u);
  let source_offset_overflow = required_source_offsets > p(26u);
  let assignment_overflow = source_count > p(27u);
  let candidate_overflow = candidate_count > p(28u);
  let capacity_bytes = U64Parts(p(29u), p(30u));
  let byte_overflow = greater_u64(required_bytes, capacity_bytes);
  let overflow = unique_overflow || cell_offset_overflow || cell_member_overflow
    || source_offset_overflow || assignment_overflow || candidate_overflow || byte_overflow;
  let build_flags = atomicLoad(&build_status[0]);
  let admitted = build_flags == 0u && !overflow;
  let admitted_u32 = select(0u, 1u, admitted);
  let status_flags = select(
    p(37u) | select(0u, CONTRACT_STATUS_OVERFLOW, overflow),
    p(36u),
    admitted
  );

  cell_csr[0u] = p(46u);
  cell_csr[1u] = p(1u);
  cell_csr[2u] = p(2u);
  cell_csr[3u] = p(3u);
  cell_csr[4u] = p(4u);
  cell_csr[5u] = source_count;
  cell_csr[6u] = required_unique;
  cell_csr[7u] = select(0u, required_unique, admitted);
  cell_csr[13u] = status_flags;
  cell_csr[14u] = select(1u, 0u, admitted);
  cell_csr[15u] = admitted_u32;

  packed_candidate_csr[0u] = p(46u);
  packed_candidate_csr[1u] = p(1u);
  packed_candidate_csr[2u] = p(2u);
  packed_candidate_csr[3u] = p(3u);
  packed_candidate_csr[4u] = p(4u);
  packed_candidate_csr[5u] = source_count;
  packed_candidate_csr[9u] = required_source_offsets;
  packed_candidate_csr[10u] = select(0u, required_source_offsets, admitted);
  packed_candidate_csr[13u] = source_count;
  packed_candidate_csr[14u] = select(0u, source_count, admitted);
  packed_candidate_csr[18u] = candidate_count;
  packed_candidate_csr[19u] = select(0u, candidate_count, admitted);
  packed_candidate_csr[22u] = p(35u);
  packed_candidate_csr[26u] = p(32u);
  packed_candidate_csr[27u] = bitcast<u32>(0.0);
  packed_candidate_csr[28u] = bitcast<u32>(0.5 * bitcast<f32>(p(32u)));
  packed_candidate_csr[29u] = select(13u, 7u, admitted);
  packed_candidate_csr[30u] = status_flags;
  packed_candidate_csr[31u] = admitted_u32;
  packed_candidate_csr[32u] = 0u;
  packed_candidate_csr[33u] = select(1u, 0u, admitted);
  packed_candidate_csr[34u] = packed_required_u32;
  packed_candidate_csr[35u] = 0u;
  packed_candidate_csr[38u] = 3u;

  capacity_evidence[0u] = p(46u);
  capacity_evidence[1u] = p(1u);
  capacity_evidence[2u] = p(2u);
  capacity_evidence[3u] = p(3u);
  capacity_evidence[4u] = source_count;
  capacity_evidence[5u] = required_unique;
  capacity_evidence[6u] = select(0u, required_unique, admitted);
  capacity_evidence[7u] = p(23u);
  capacity_evidence[8u] = count_overflow(required_unique, p(23u));
  capacity_evidence[9u] = required_cell_offsets;
  capacity_evidence[10u] = select(0u, required_cell_offsets, admitted);
  capacity_evidence[11u] = p(24u);
  capacity_evidence[12u] = count_overflow(required_cell_offsets, p(24u));
  capacity_evidence[13u] = source_count;
  capacity_evidence[14u] = select(0u, source_count, admitted);
  capacity_evidence[15u] = p(25u);
  capacity_evidence[16u] = count_overflow(source_count, p(25u));
  capacity_evidence[17u] = required_source_offsets;
  capacity_evidence[18u] = select(0u, required_source_offsets, admitted);
  capacity_evidence[19u] = p(26u);
  capacity_evidence[20u] = count_overflow(required_source_offsets, p(26u));
  capacity_evidence[21u] = source_count;
  capacity_evidence[22u] = select(0u, source_count, admitted);
  capacity_evidence[23u] = p(27u);
  capacity_evidence[24u] = count_overflow(source_count, p(27u));
  capacity_evidence[25u] = candidate_count;
  capacity_evidence[26u] = select(0u, candidate_count, admitted);
  capacity_evidence[27u] = p(28u);
  capacity_evidence[28u] = count_overflow(candidate_count, p(28u));
  capacity_evidence[29u] = required_bytes.low;
  capacity_evidence[30u] = required_bytes.high;
  capacity_evidence[31u] = select(0u, required_bytes.low, admitted);
  capacity_evidence[32u] = select(0u, required_bytes.high, admitted);
  capacity_evidence[33u] = p(29u);
  capacity_evidence[34u] = p(30u);
  var overflow_bytes = U64Parts(0u, 0u);
  if (byte_overflow) {
    overflow_bytes = subtract_u64(required_bytes, capacity_bytes);
  }
  capacity_evidence[35u] = overflow_bytes.low;
  capacity_evidence[36u] = overflow_bytes.high;
  capacity_evidence[37u] = p(35u);
  capacity_evidence[38u] = p(9u);
  capacity_evidence[39u] = status_flags;
  capacity_evidence[40u] = select(1u, 0u, admitted);
  capacity_evidence[41u] = admitted_u32;
  capacity_evidence[42u] = 3u;
  capacity_evidence[43u] = 0u;

  atomicStore(&build_status[1], candidate_count);
  var dispatch_x = 0u;
  var dispatch_y = 1u;
  if (admitted && candidate_count > 0u) {
    let group_count = (candidate_count + 63u) / 64u;
    dispatch_x = min(group_count, p(49u));
    dispatch_y = (group_count + dispatch_x - 1u) / dispatch_x;
  }
  atomicStore(&build_status[2], dispatch_x);
  candidate_dispatch[0u] = dispatch_x;
  candidate_dispatch[1u] = dispatch_y;
  candidate_dispatch[2u] = 1u;
}

fn record_candidate(
  source_index: u32,
  target_index: u32,
  source_chart: u32,
  source_level: i32,
  source_cell_size: f32,
  same_source_cell: bool,
  source_position: vec3<f32>,
  local_count: ptr<function, u32>,
  class_counts: ptr<function, array<u32, 8>>
) {
  let matched_mask = matched_consumer_mask(
    source_index,
    target_index,
    source_chart,
    source_level,
    source_cell_size,
    same_source_cell,
    source_position
  );
  if (matched_mask == 0u) {
    return;
  }
  let rank = *local_count;
  *local_count = rank + 1u;
  let staging_index = atomicAdd(&build_status[1], 1u);
  if (staging_index < p(22u)) {
    let scratch_row = staging_index * p(10u);
    candidate_scratch[scratch_row] = source_index;
    candidate_scratch[scratch_row + 1u] = rank;
    candidate_scratch[scratch_row + 2u] = target_index;
    candidate_scratch[scratch_row + 3u] = matched_mask;
  } else {
    atomicOr(&build_status[0], STATUS_STAGING_OVERFLOW);
  }
  for (var slot = 0u; slot < 8u; slot = slot + 1u) {
    let consumer_bit = 1u << slot;
    if ((matched_mask & consumer_bit) == 0u) {
      continue;
    }
    let class_id = assignment_for(source_index, slot);
    var first_slot_for_class = true;
    for (var prior = 0u; prior < slot; prior = prior + 1u) {
      if ((matched_mask & (1u << prior)) != 0u
        && assignment_for(source_index, prior) == class_id) {
        first_slot_for_class = false;
      }
    }
    if (!first_slot_for_class) {
      continue;
    }
    let next_count = (*class_counts)[slot] + 1u;
    (*class_counts)[slot] = next_count;
    let row = find_support_class(class_id);
    if (row == UINT_MAX || next_count > support_word(row, 5u)) {
      atomicOr(&build_status[0], STATUS_CLASS_LIMIT);
    }
  }
}

fn visit_cell(
  source_index: u32,
  cell_index: u32,
  source_chart: u32,
  source_level: i32,
  source_cell_size: f32,
  same_source_cell: bool,
  source_position: vec3<f32>,
  local_count: ptr<function, u32>,
  class_counts: ptr<function, array<u32, 8>>
) {
  let offset_base = p(14u);
  let member_base = p(15u);
  let begin = cell_csr[offset_base + cell_index];
  let end = cell_csr[offset_base + cell_index + 1u];
  for (var member = begin; member < end; member = member + 1u) {
    let target_index = cell_csr[member_base + member];
    record_candidate(
      source_index,
      target_index,
      source_chart,
      source_level,
      source_cell_size,
      same_source_cell,
      source_position,
      local_count,
      class_counts
    );
  }
}

@compute @workgroup_size(64)
fn count_candidates(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (p(48u) == 0u) {
    return;
  }
  let source_index = linear_invocation(local_id, workgroup_id);
  if (source_index >= p(0u)) {
    return;
  }
  if (atomicLoad(&build_status[0]) != 0u) {
    candidate_counts[source_index] = 0u;
    return;
  }
  let source_position = position_for(source_index);
  let source_chart = chart_word(source_index, 0u);
  let source_level_key = chart_word(source_index, 1u);
  let source_level = decode_signed_order_key(source_level_key);
  let source_cell_size = bitcast<f32>(chart_word(source_index, 2u));
  let source_origin = vec3<f32>(
    bitcast<f32>(chart_word(source_index, 3u)),
    bitcast<f32>(chart_word(source_index, 4u)),
    bitcast<f32>(chart_word(source_index, 5u))
  );
  let source_chart_flags = chart_word(source_index, 7u);
  var local_count = 0u;
  var class_counts: array<u32, 8>;
  var min_delta = 0;
  var max_delta = 0;
  var assigned_count = 0u;
  var scan_all_charts = false;
  for (var slot = 0u; slot < 8u; slot = slot + 1u) {
    class_counts[slot] = 0u;
    let class_id = assignment_for(source_index, slot);
    if (class_id == UINT_MAX) {
      continue;
    }
    let row = find_support_class(class_id);
    if (row == UINT_MAX || support_word(row, 6u) != p(1u)
      || (support_word(row, 1u) & (1u << slot)) == 0u) {
      atomicOr(&build_status[0], STATUS_INVALID_SUPPORT);
      candidate_counts[source_index] = 0u;
      return;
    }
    assigned_count = assigned_count + 1u;
    let flags = support_word(row, 7u);
    if ((flags & SUPPORT_CROSS_CHART) != 0u) {
      scan_all_charts = true;
    }
    if ((flags & SUPPORT_CROSS_LEVEL) != 0u) {
      min_delta = min(min_delta, decode_signed_order_key(support_word(row, 2u)));
      max_delta = max(max_delta, decode_signed_order_key(support_word(row, 3u)));
    }
  }
  if (assigned_count == 0u) {
    candidate_counts[source_index] = 0u;
    return;
  }
  if (u32(max_delta - min_delta + 1) > p(39u)) {
    atomicOr(&build_status[0], STATUS_SEARCH_BOUND);
    candidate_counts[source_index] = 0u;
    return;
  }
  let source_cell_f = floor((source_position - source_origin) / source_cell_size);
  let source_cell = vec3<i32>(source_cell_f);
  let source_cell_keys = vec3<u32>(
    signed_order_key(source_cell.x),
    signed_order_key(source_cell.y),
    signed_order_key(source_cell.z)
  );
  if (scan_all_charts) {
    let unique_count = cell_csr[CELL_HEADER_REQUIRED_UNIQUE];
    for (var cell_index = 0u; cell_index < unique_count; cell_index = cell_index + 1u) {
      let key_base = p(13u) + cell_index * CELL_KEY_STRIDE;
      let same_source_cell = cell_csr[key_base] == source_chart
        && cell_csr[key_base + 1u] == source_level_key
        && cell_csr[key_base + 2u] == source_cell_keys.x
        && cell_csr[key_base + 3u] == source_cell_keys.y
        && cell_csr[key_base + 4u] == source_cell_keys.z;
      visit_cell(
        source_index,
        cell_index,
        source_chart,
        source_level,
        source_cell_size,
        same_source_cell,
        source_position,
        &local_count,
        &class_counts
      );
    }
  } else {
    for (var level_delta = min_delta; level_delta <= max_delta; level_delta = level_delta + 1) {
      if (level_delta != 0 && (source_chart_flags & CHART_DYADIC_LEVELS) == 0u) {
        atomicOr(&build_status[0], STATUS_INVALID_OCCUPANCY);
        candidate_counts[source_index] = 0u;
        return;
      }
      let target_cell_size = source_cell_size * exp2(f32(level_delta));
      var cell_radius = 0u;
      for (var slot = 0u; slot < 8u; slot = slot + 1u) {
        let class_id = assignment_for(source_index, slot);
        if (class_id == UINT_MAX) {
          continue;
        }
        let row = find_support_class(class_id);
        let flags = support_word(row, 7u);
        var level_admitted = level_delta == 0;
        if ((flags & SUPPORT_CROSS_LEVEL) != 0u) {
          let class_min = decode_signed_order_key(support_word(row, 2u));
          let class_max = decode_signed_order_key(support_word(row, 3u));
          level_admitted = level_delta >= class_min && level_delta <= class_max;
        }
        if (!level_admitted) {
          continue;
        }
        let support_distance = f32(support_word(row, 4u))
          * max(source_cell_size, target_cell_size) + bitcast<f32>(p(32u));
        let required_cells = u32(ceil(support_distance / target_cell_size));
        cell_radius = max(cell_radius, required_cells);
      }
      if (cell_radius > p(38u) || !finite_f32(target_cell_size) || target_cell_size <= 0.0) {
        atomicOr(&build_status[0], STATUS_SEARCH_BOUND);
        candidate_counts[source_index] = 0u;
        return;
      }
      let center_f = floor((source_position - source_origin) / target_cell_size);
      let bound = 2147483520.0 - f32(cell_radius);
      if (!finite_vec3(center_f) || any(center_f < vec3<f32>(-bound))
        || any(center_f > vec3<f32>(bound))) {
        atomicOr(&build_status[0], STATUS_SEARCH_BOUND);
        candidate_counts[source_index] = 0u;
        return;
      }
      let center = vec3<i32>(center_f);
      let radius_i = i32(cell_radius);
      let target_level_key = signed_order_key(source_level + level_delta);
      for (var z = -radius_i; z <= radius_i; z = z + 1) {
        for (var y = -radius_i; y <= radius_i; y = y + 1) {
          for (var x = -radius_i; x <= radius_i; x = x + 1) {
            let cell_index = find_cell(
              source_chart,
              target_level_key,
              signed_order_key(center.x + x),
              signed_order_key(center.y + y),
              signed_order_key(center.z + z)
            );
            if (cell_index == UINT_MAX) {
              continue;
            }
            let same_source_cell = level_delta == 0 && x == 0 && y == 0 && z == 0;
            visit_cell(
              source_index,
              cell_index,
              source_chart,
              source_level,
              source_cell_size,
              same_source_cell,
              source_position,
              &local_count,
              &class_counts
            );
          }
        }
      }
    }
  }
  candidate_counts[source_index] = local_count;
}

fn align4(value: u32) -> u32 {
  return (value + 3u) & ~3u;
}

fn count_overflow(required: u32, capacity: u32) -> u32 {
  return select(0u, required - capacity, required > capacity);
}

fn add_u64(left: U64Parts, right: U64Parts) -> U64Parts {
  let low = left.low + right.low;
  let carry = select(0u, 1u, low < left.low);
  return U64Parts(low, left.high + right.high + carry);
}

fn multiply_u32_small(value: u32, factor: u32) -> U64Parts {
  let low_product = (value & 0xffffu) * factor;
  let high_product = (value >> 16u) * factor;
  let shifted_high = high_product << 16u;
  let low = low_product + shifted_high;
  let carry = select(0u, 1u, low < low_product);
  return U64Parts(low, (high_product >> 16u) + carry);
}

fn greater_u64(left: U64Parts, right: U64Parts) -> bool {
  return left.high > right.high || (left.high == right.high && left.low > right.low);
}

fn subtract_u64(left: U64Parts, right: U64Parts) -> U64Parts {
  let borrow = select(0u, 1u, left.low < right.low);
  return U64Parts(left.low - right.low, left.high - right.high - borrow);
}

@compute @workgroup_size(1)
fn finalize_admission() {
  if (p(48u) == 0u) {
    return;
  }
  let source_count = p(0u);
  var stored_candidate_count = 0u;
  if (source_count > 0u) {
    let last = source_count - 1u;
    stored_candidate_count = scanned_source_offsets[last] + candidate_counts[last];
  }
  let build_flags = atomicLoad(&build_status[0]);
  let staged_candidate_count = atomicLoad(&build_status[1]);
  let candidate_count_unknown = (build_flags
    & (STATUS_STAGING_OVERFLOW | STATUS_CLASS_LIMIT)) != 0u;
  let required_candidate_count = select(
    stored_candidate_count,
    UINT_MAX,
    candidate_count_unknown
  );
  let required_unique = cell_csr[CELL_HEADER_REQUIRED_UNIQUE];
  let required_cell_offsets = required_unique + 1u;
  let required_source_offsets = source_count + 1u;
  var packed_required_u32 = p(43u) + required_source_offsets;
  packed_required_u32 = align4(packed_required_u32);
  packed_required_u32 = packed_required_u32 + source_count * p(20u);
  packed_required_u32 = align4(packed_required_u32);
  if (!candidate_count_unknown) {
    packed_required_u32 = align4(
      packed_required_u32 + required_candidate_count * p(21u)
    );
  } else {
    packed_required_u32 = UINT_MAX;
  }
  var required_bytes = U64Parts(UINT_MAX, UINT_MAX);
  if (!candidate_count_unknown) {
    required_bytes = U64Parts(0u, 0u);
    required_bytes = add_u64(
      required_bytes,
      multiply_u32_small(required_unique, p(12u) * 4u)
    );
    required_bytes = add_u64(
      required_bytes,
      multiply_u32_small(required_cell_offsets, 4u)
    );
    required_bytes = add_u64(
      required_bytes,
      multiply_u32_small(source_count, 4u)
    );
    required_bytes = add_u64(
      required_bytes,
      multiply_u32_small(packed_required_u32, 4u)
    );
    required_bytes = add_u64(
      required_bytes,
      multiply_u32_small(p(9u), p(44u) * 4u)
    );
    required_bytes = add_u64(
      required_bytes,
      multiply_u32_small(p(31u), 4u)
    );
  }
  let unique_overflow = required_unique > p(23u);
  let cell_offset_overflow = required_cell_offsets > p(24u);
  let cell_member_overflow = source_count > p(25u);
  let source_offset_overflow = required_source_offsets > p(26u);
  let assignment_overflow = source_count > p(27u);
  let candidate_overflow = required_candidate_count > p(28u);
  let capacity_bytes = U64Parts(p(29u), p(30u));
  let byte_overflow = greater_u64(required_bytes, capacity_bytes);
  let overflow = unique_overflow || cell_offset_overflow || cell_member_overflow
    || source_offset_overflow || assignment_overflow || candidate_overflow || byte_overflow;
  let staging_count_valid = staged_candidate_count == stored_candidate_count;
  let admitted = build_flags == 0u && staging_count_valid && !overflow;
  let admitted_u32 = select(0u, 1u, admitted);
  let status_flags = select(
    p(37u) | select(0u, CONTRACT_STATUS_OVERFLOW, overflow),
    p(36u),
    admitted
  );

  cell_csr[CELL_HEADER_ADMITTED_UNIQUE] = select(0u, required_unique, admitted);
  cell_csr[CELL_HEADER_STATUS] = status_flags;
  cell_csr[CELL_HEADER_FAIL_CLOSED] = select(1u, 0u, admitted);
  cell_csr[CELL_HEADER_DISPATCH_ALLOWED] = admitted_u32;

  packed_candidate_csr[9u] = required_source_offsets;
  packed_candidate_csr[10u] = select(0u, required_source_offsets, admitted);
  packed_candidate_csr[13u] = source_count;
  packed_candidate_csr[14u] = select(0u, source_count, admitted);
  packed_candidate_csr[18u] = required_candidate_count;
  packed_candidate_csr[19u] = select(0u, required_candidate_count, admitted);
  packed_candidate_csr[29u] = select(13u, 7u, admitted);
  packed_candidate_csr[30u] = status_flags;
  packed_candidate_csr[31u] = admitted_u32;
  packed_candidate_csr[32u] = 0u;
  packed_candidate_csr[33u] = select(1u, 0u, admitted);
  packed_candidate_csr[34u] = packed_required_u32;
  packed_candidate_csr[35u] = 0u;
  packed_candidate_csr[p(17u) + source_count] = select(0u, stored_candidate_count, admitted);

  var dispatch_x = 0u;
  var dispatch_y = 1u;
  if (admitted && stored_candidate_count > 0u) {
    let group_count = (stored_candidate_count + 63u) / 64u;
    dispatch_x = min(group_count, p(49u));
    dispatch_y = (group_count + dispatch_x - 1u) / dispatch_x;
  }
  atomicStore(&build_status[2], dispatch_x);
  candidate_dispatch[0u] = dispatch_x;
  candidate_dispatch[1u] = dispatch_y;
  candidate_dispatch[2u] = 1u;

  capacity_evidence[0u] = p(46u);
  capacity_evidence[1u] = p(1u);
  capacity_evidence[2u] = p(2u);
  capacity_evidence[3u] = p(3u);
  capacity_evidence[4u] = source_count;
  capacity_evidence[5u] = required_unique;
  capacity_evidence[6u] = select(0u, required_unique, admitted);
  capacity_evidence[7u] = p(23u);
  capacity_evidence[8u] = count_overflow(required_unique, p(23u));
  capacity_evidence[9u] = required_cell_offsets;
  capacity_evidence[10u] = select(0u, required_cell_offsets, admitted);
  capacity_evidence[11u] = p(24u);
  capacity_evidence[12u] = count_overflow(required_cell_offsets, p(24u));
  capacity_evidence[13u] = source_count;
  capacity_evidence[14u] = select(0u, source_count, admitted);
  capacity_evidence[15u] = p(25u);
  capacity_evidence[16u] = count_overflow(source_count, p(25u));
  capacity_evidence[17u] = required_source_offsets;
  capacity_evidence[18u] = select(0u, required_source_offsets, admitted);
  capacity_evidence[19u] = p(26u);
  capacity_evidence[20u] = count_overflow(required_source_offsets, p(26u));
  capacity_evidence[21u] = source_count;
  capacity_evidence[22u] = select(0u, source_count, admitted);
  capacity_evidence[23u] = p(27u);
  capacity_evidence[24u] = count_overflow(source_count, p(27u));
  capacity_evidence[25u] = required_candidate_count;
  capacity_evidence[26u] = select(0u, required_candidate_count, admitted);
  capacity_evidence[27u] = p(28u);
  capacity_evidence[28u] = count_overflow(required_candidate_count, p(28u));
  capacity_evidence[29u] = required_bytes.low;
  capacity_evidence[30u] = required_bytes.high;
  capacity_evidence[31u] = select(0u, required_bytes.low, admitted);
  capacity_evidence[32u] = select(0u, required_bytes.high, admitted);
  capacity_evidence[33u] = p(29u);
  capacity_evidence[34u] = p(30u);
  var overflow_bytes = U64Parts(0u, 0u);
  if (byte_overflow) {
    overflow_bytes = subtract_u64(required_bytes, capacity_bytes);
  }
  capacity_evidence[35u] = overflow_bytes.low;
  capacity_evidence[36u] = overflow_bytes.high;
  capacity_evidence[37u] = p(35u);
  capacity_evidence[38u] = p(9u);
  capacity_evidence[39u] = status_flags;
  capacity_evidence[40u] = select(1u, 0u, admitted);
  capacity_evidence[41u] = admitted_u32;
  capacity_evidence[42u] = 0u;
  capacity_evidence[43u] = 0u;
}

@compute @workgroup_size(64)
fn fill_candidates(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (p(48u) == 0u || packed_candidate_csr[31u] == 0u
    || packed_candidate_csr[33u] != 0u || capacity_evidence[41u] == 0u) {
    return;
  }
  let staging_index = candidate_invocation(local_id, workgroup_id);
  if (staging_index >= p(22u) || staging_index >= atomicLoad(&build_status[1])) {
    return;
  }
  let scratch_row = staging_index * p(10u);
  let source_index = candidate_scratch[scratch_row];
  let local_rank = candidate_scratch[scratch_row + 1u];
  let destination_begin = packed_candidate_csr[p(17u) + source_index];
  let destination_row = p(19u) + (destination_begin + local_rank) * p(21u);
  packed_candidate_csr[destination_row] = candidate_scratch[scratch_row + 2u];
  packed_candidate_csr[destination_row + 1u] = candidate_scratch[scratch_row + 3u];
}
`;
