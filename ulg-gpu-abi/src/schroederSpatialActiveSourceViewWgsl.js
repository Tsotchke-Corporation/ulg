import {
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATES_PER_SOURCE,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CONSUMER_WORKGROUP_SIZE,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_DISPATCH_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_IDENTITY_MISMATCH,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_NONFINITE,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_UNSUPPORTED_SOURCE,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_WORKGROUP_SIZE
} from './schroederSpatialActiveSourceView.js';
import {
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
} from './schroederSpatialMechanicsView.js';

function u32(value) {
  return `${value >>> 0}u`;
}

export function createSchroederSpatialActiveSourceViewWgsl(layout) {
  if (
    !layout
    || layout.headerWords !== SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS
    || layout.physicalSourceCapacity < 1
    || layout.activeSourceCapacity < 1
    || layout.activeSourceCapacity > layout.physicalSourceCapacity
    || layout.activeToPhysicalOffsetWords
      !== SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS
    || layout.physicalToActiveOffsetWords
      !== layout.activeToPhysicalOffsetWords + layout.activeSourceCapacity
    || layout.wordLength
      !== layout.physicalToActiveOffsetWords + layout.physicalSourceCapacity
    || layout.activeDispatchOffsetWords
      !== SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS
    || layout.candidateDispatchOffsetWords
      !== SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS
    || layout.physicalDispatchOffsetWords
      !== SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS
  ) {
    throw new TypeError('active-source view layout is not canonical v1');
  }

  return /* wgsl */ `
struct ActiveSourceParams {
  physical_source_count: u32,
  physical_source_capacity: u32,
  active_source_capacity: u32,
  source_stride_floats: u32,
  source_row_layout_id: u32,
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
  build_ordinal: u32,
  source_fingerprint: u32,
  classify_dispatch_x: u32,
  scatter_dispatch_x: u32,
  dispatch_x_limit: u32,
  header_words: u32,
  active_to_physical_offset_words: u32,
  physical_to_active_offset_words: u32,
  capacity_words: u32,
  query_geometry_mode: u32,
  query_chart_id: u32,
  query_min_level: i32,
  query_max_level: i32,
  query_base_grid_spacing_m: f32,
  producer_workgroup_size: u32,
  consumer_workgroup_size: u32,
  candidates_per_source: u32,
  capacity_tier_ordinal: u32,
  flags_capacity: u32,
  prefix_capacity: u32,
  evidence_words: u32,
  cleared_words: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
  _pad3: u32,
  _pad4: u32,
  _pad5: u32,
  _pad6: u32,
  _pad7: u32,
};

@group(0) @binding(0) var<storage, read> source_rows: array<f32>;
@group(0) @binding(1) var<storage, read_write> active_flags: array<u32>;
@group(0) @binding(2) var<storage, read> active_prefix: array<u32>;
@group(0) @binding(3) var<storage, read_write> active_source_view: array<u32>;
@group(0) @binding(4) var<storage, read_write> active_source_evidence: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: ActiveSourceParams;

const VIEW_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC)};
const VIEW_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION)};
const VIEW_HEADER_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS)};
const VIEW_PHYSICAL_CAPACITY: u32 = ${u32(layout.physicalSourceCapacity)};
const VIEW_ACTIVE_CAPACITY: u32 = ${u32(layout.activeSourceCapacity)};
const VIEW_ACTIVE_TO_PHYSICAL_OFFSET: u32 = ${u32(layout.activeToPhysicalOffsetWords)};
const VIEW_PHYSICAL_TO_ACTIVE_OFFSET: u32 = ${u32(layout.physicalToActiveOffsetWords)};
const VIEW_CAPACITY_WORDS: u32 = ${u32(layout.wordLength)};
const VIEW_ACTIVE_DISPATCH_OFFSET: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS)};
const VIEW_CANDIDATE_DISPATCH_OFFSET: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS)};
const VIEW_PHYSICAL_DISPATCH_OFFSET: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS)};
const VIEW_DISPATCH_WORDS: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_DISPATCH_WORDS)};
const PRODUCER_WORKGROUP_SIZE: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_WORKGROUP_SIZE)};
const CONSUMER_WORKGROUP_SIZE: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CONSUMER_WORKGROUP_SIZE)};
const CANDIDATES_PER_SOURCE: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATES_PER_SOURCE)};
const SOURCE_ROW_WORDS: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS)};
const SOURCE_LAYOUT_LEVEL_ASSIGNMENT: u32 =
  ${u32(SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0)};
const MISSING_ORDINAL: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL)};
const STATUS_READY: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_READY)};
const STATUS_ADMITTED: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_ADMITTED)};
const STATUS_FAIL_CLOSED: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_FAIL_CLOSED)};
const STATUS_INVALID_SOURCE: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_INVALID_SOURCE)};
const STATUS_CAPACITY_OVERFLOW: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_CAPACITY_OVERFLOW)};
const STATUS_UNSUPPORTED_SOURCE: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_UNSUPPORTED_SOURCE)};
const STATUS_IDENTITY_MISMATCH: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_IDENTITY_MISMATCH)};
const STATUS_NONFINITE: u32 =
  ${u32(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_NONFINITE)};
const QUERY_GEOMETRY_GENERIC: u32 = 0u;
const QUERY_GEOMETRY_SINGLE_CHART_POW2: u32 = 1u;
const MAX_EXACT_F32_INTEGER: f32 = 16777215.0;
const MIN_SAFE_I32_F32: f32 = -2147483520.0;
const MAX_SAFE_I32_F32: f32 = 2147483520.0;
const FINGERPRINT_PRIME: u32 = 16777619u;

const EVIDENCE_INVALID: u32 = 0u;
const EVIDENCE_NONFINITE: u32 = 1u;
const EVIDENCE_DORMANT: u32 = 2u;
const EVIDENCE_CLASSIFIED: u32 = 3u;
const EVIDENCE_ACTIVE: u32 = 4u;
const EVIDENCE_SCATTER: u32 = 5u;
const EVIDENCE_REVERSE: u32 = 6u;
const EVIDENCE_ACTIVE_HIGH_WATER: u32 = 7u;
const EVIDENCE_STRUCTURAL_INVALID: u32 = 8u;
const EVIDENCE_GEOMETRY_INVALID: u32 = 9u;
const EVIDENCE_UNSUPPORTED: u32 = 10u;

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

fn linear_invocation(
  workgroup_id: vec3<u32>,
  local_id: vec3<u32>,
  dispatch_x: u32
) -> u32 {
  return (workgroup_id.x + workgroup_id.y * dispatch_x)
    * PRODUCER_WORKGROUP_SIZE + local_id.x;
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

fn fixed_contract_ready() -> bool {
  return params.physical_source_count <= VIEW_PHYSICAL_CAPACITY
    && params.physical_source_capacity == VIEW_PHYSICAL_CAPACITY
    && params.active_source_capacity == VIEW_ACTIVE_CAPACITY
    && params.source_stride_floats == SOURCE_ROW_WORDS
    && params.source_row_layout_id == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && params.header_words == VIEW_HEADER_WORDS
    && params.active_to_physical_offset_words == VIEW_ACTIVE_TO_PHYSICAL_OFFSET
    && params.physical_to_active_offset_words == VIEW_PHYSICAL_TO_ACTIVE_OFFSET
    && params.capacity_words == VIEW_CAPACITY_WORDS
    && params.producer_workgroup_size == PRODUCER_WORKGROUP_SIZE
    && params.consumer_workgroup_size == CONSUMER_WORKGROUP_SIZE
    && params.candidates_per_source == CANDIDATES_PER_SOURCE
    && params.flags_capacity == VIEW_PHYSICAL_CAPACITY
    && params.prefix_capacity == VIEW_PHYSICAL_CAPACITY
    && params.evidence_words >= 11u
    && params.dispatch_x_limit > 0u
    && arrayLength(&source_rows) / SOURCE_ROW_WORDS
      >= params.physical_source_count
    && arrayLength(&active_flags) >= VIEW_PHYSICAL_CAPACITY
    && arrayLength(&active_prefix) >= params.physical_source_count
    && arrayLength(&active_source_view) >= VIEW_CAPACITY_WORDS
    && arrayLength(&active_source_evidence) >= params.evidence_words
    && exact_near_query_profile_ready();
}

fn record_invalid(nonfinite: bool, structural: bool) {
  atomicAdd(&active_source_evidence[EVIDENCE_INVALID], 1u);
  if (nonfinite) {
    atomicAdd(&active_source_evidence[EVIDENCE_NONFINITE], 1u);
  }
  if (structural) {
    atomicAdd(&active_source_evidence[EVIDENCE_STRUCTURAL_INVALID], 1u);
  } else {
    atomicAdd(&active_source_evidence[EVIDENCE_GEOMETRY_INVALID], 1u);
  }
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_WORKGROUP_SIZE})
fn classify_active_sources(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let source_index = linear_invocation(
    workgroup_id,
    local_id,
    params.classify_dispatch_x
  );
  if (source_index >= VIEW_PHYSICAL_CAPACITY) {
    return;
  }
  active_flags[source_index] = 0u;
  active_source_view[VIEW_PHYSICAL_TO_ACTIVE_OFFSET + source_index] =
    MISSING_ORDINAL;
  if (source_index < VIEW_ACTIVE_CAPACITY) {
    active_source_view[VIEW_ACTIVE_TO_PHYSICAL_OFFSET + source_index] =
      MISSING_ORDINAL;
  }
  if (source_index >= params.physical_source_count) {
    return;
  }
  if (!fixed_contract_ready()) {
    if (source_index == 0u) {
      atomicStore(&active_source_evidence[EVIDENCE_UNSUPPORTED], 1u);
    }
    return;
  }

  let row = source_index * SOURCE_ROW_WORDS;
  let level_f = source_rows[row + 0u];
  let native_spacing = source_rows[row + 1u];
  let support_radius = source_rows[row + 2u];
  let represented_volume = source_rows[row + 3u];
  let rest_volume = source_rows[row + 4u];
  let current_volume = source_rows[row + 5u];
  let mass = source_rows[row + 6u];
  let rest_density = source_rows[row + 7u];
  let phase_f = source_rows[row + 8u];
  let material_f = source_rows[row + 9u];
  let status_f = source_rows[row + 10u];
  let hysteresis = source_rows[row + 11u];
  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let chart_f = source_rows[row + 15u];

  let structural_finite = finite_f32(level_f)
    && finite_f32(native_spacing)
    && finite_f32(rest_density)
    && finite_f32(phase_f)
    && finite_f32(material_f)
    && finite_f32(status_f)
    && finite_f32(hysteresis)
    && finite_f32(position.x)
    && finite_f32(position.y)
    && finite_f32(position.z)
    && finite_f32(chart_f);
  if (!structural_finite) {
    atomicAdd(&active_source_evidence[EVIDENCE_CLASSIFIED], 1u);
    record_invalid(true, true);
    return;
  }
  let status = u32(round(status_f));
  var structural_valid = integral_f32(level_f)
    && level_f >= MIN_SAFE_I32_F32
    && level_f <= MAX_SAFE_I32_F32
    && native_spacing > 0.0
    && integral_f32(phase_f)
    && phase_f >= 0.0
    && phase_f <= MAX_EXACT_F32_INTEGER
    && integral_f32(material_f)
    && material_f >= 0.0
    && material_f <= MAX_EXACT_F32_INTEGER
    && integral_f32(status_f)
    && status_f >= 0.0
    && status_f <= 255.0
    && (status & 31u) > 0u
    && (status & 128u) == 0u
    && hysteresis >= 0.0
    && integral_f32(chart_f)
    && chart_f >= 0.0
    && chart_f <= MAX_EXACT_F32_INTEGER;
  if (
    structural_valid
    && params.query_geometry_mode == QUERY_GEOMETRY_SINGLE_CHART_POW2
  ) {
    let level = i32(round(level_f));
    let level_order = signed_order_key(level);
    let min_order = signed_order_key(params.query_min_level);
    let max_order = signed_order_key(params.query_max_level);
    let expected_spacing = params.query_base_grid_spacing_m * exp2(f32(level));
    structural_valid = u32(round(chart_f)) == params.query_chart_id
      && level_order >= min_order
      && level_order <= max_order
      && bitcast<u32>(native_spacing) == bitcast<u32>(expected_spacing)
      && (status & 64u) == 0u;
  } else if (
    structural_valid
    && params.query_geometry_mode != QUERY_GEOMETRY_GENERIC
  ) {
    structural_valid = false;
  }
  let cell_f = floor(position / native_spacing);
  structural_valid = structural_valid
    && safe_i32_f32(cell_f.x)
    && safe_i32_f32(cell_f.y)
    && safe_i32_f32(cell_f.z);
  if (!structural_valid) {
    atomicAdd(&active_source_evidence[EVIDENCE_CLASSIFIED], 1u);
    record_invalid(false, true);
    return;
  }

  let geometry_finite = finite_f32(support_radius)
    && finite_f32(represented_volume)
    && finite_f32(rest_volume)
    && finite_f32(current_volume)
    && finite_f32(mass);
  if (!geometry_finite) {
    atomicAdd(&active_source_evidence[EVIDENCE_CLASSIFIED], 1u);
    record_invalid(true, false);
    return;
  }
  let dormant = bitcast<u32>(support_radius) == 0u
    && bitcast<u32>(represented_volume) == 0u
    && bitcast<u32>(rest_volume) == 0u
    && bitcast<u32>(current_volume) == 0u
    && bitcast<u32>(mass) == 0u;
  let row_active = mass > 0.0
    && support_radius >= 0.0
    && represented_volume >= 0.0
    && rest_volume > 0.0
    && current_volume > 0.0
    && rest_density > 0.0;
  atomicAdd(&active_source_evidence[EVIDENCE_CLASSIFIED], 1u);
  if (row_active) {
    active_flags[source_index] = 1u;
    atomicAdd(&active_source_evidence[EVIDENCE_ACTIVE], 1u);
    atomicMax(
      &active_source_evidence[EVIDENCE_ACTIVE_HIGH_WATER],
      source_index + 1u
    );
  } else if (dormant) {
    atomicAdd(&active_source_evidence[EVIDENCE_DORMANT], 1u);
  } else {
    record_invalid(false, false);
  }
}

fn required_active_count() -> u32 {
  if (params.physical_source_count == 0u) {
    return 0u;
  }
  let last = params.physical_source_count - 1u;
  return active_prefix[last] + active_flags[last];
}

fn classified_rows_admitted(required_count: u32) -> bool {
  let invalid_count = atomicLoad(
    &active_source_evidence[EVIDENCE_INVALID]
  );
  let dormant_count = atomicLoad(
    &active_source_evidence[EVIDENCE_DORMANT]
  );
  let classified_count = atomicLoad(
    &active_source_evidence[EVIDENCE_CLASSIFIED]
  );
  let active_count = atomicLoad(
    &active_source_evidence[EVIDENCE_ACTIVE]
  );
  return fixed_contract_ready()
    && atomicLoad(&active_source_evidence[EVIDENCE_UNSUPPORTED]) == 0u
    && invalid_count == 0u
    && classified_count == params.physical_source_count
    && active_count == required_count
    && active_count + dormant_count == params.physical_source_count;
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_WORKGROUP_SIZE})
fn scatter_active_sources(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let source_index = linear_invocation(
    workgroup_id,
    local_id,
    params.scatter_dispatch_x
  );
  if (source_index >= params.physical_source_count) {
    return;
  }
  let required_count = required_active_count();
  if (
    !classified_rows_admitted(required_count)
    || required_count > VIEW_ACTIVE_CAPACITY
    || active_flags[source_index] == 0u
  ) {
    return;
  }
  let active_ordinal = active_prefix[source_index];
  if (active_ordinal >= required_count || active_ordinal >= VIEW_ACTIVE_CAPACITY) {
    return;
  }
  active_source_view[VIEW_ACTIVE_TO_PHYSICAL_OFFSET + active_ordinal] =
    source_index;
  active_source_view[VIEW_PHYSICAL_TO_ACTIVE_OFFSET + source_index] =
    active_ordinal;
  atomicAdd(&active_source_evidence[EVIDENCE_SCATTER], 1u);
  atomicAdd(&active_source_evidence[EVIDENCE_REVERSE], 1u);
}

fn fingerprint_fold(value: u32, word: u32) -> u32 {
  return (value ^ word) * FINGERPRINT_PRIME;
}

fn projection_seal(
  source_fingerprint: u32,
  active_count: u32,
  dormant_count: u32,
  completion_ordinal: u32
) -> u32 {
  var value = fingerprint_fold(
    source_fingerprint,
    VIEW_ACTIVE_TO_PHYSICAL_OFFSET
  );
  value = fingerprint_fold(value, VIEW_PHYSICAL_TO_ACTIVE_OFFSET);
  value = fingerprint_fold(value, VIEW_CAPACITY_WORDS);
  value = fingerprint_fold(value, active_count);
  value = fingerprint_fold(value, dormant_count);
  return fingerprint_fold(value, completion_ordinal);
}

fn write_dispatch(offset: u32, invocation_count: u32, admitted: bool) {
  if (!admitted) {
    active_source_view[offset + 0u] = 0u;
    active_source_view[offset + 1u] = 0u;
    active_source_view[offset + 2u] = 0u;
    return;
  }
  if (invocation_count == 0u) {
    active_source_view[offset + 0u] = 0u;
    active_source_view[offset + 1u] = 1u;
    active_source_view[offset + 2u] = 1u;
    return;
  }
  let group_count = invocation_count / CONSUMER_WORKGROUP_SIZE
    + select(
      0u,
      1u,
      invocation_count % CONSUMER_WORKGROUP_SIZE != 0u
    );
  let dispatch_x = min(group_count, params.dispatch_x_limit);
  let dispatch_y = group_count / dispatch_x
    + select(0u, 1u, group_count % dispatch_x != 0u);
  let shape_admitted = dispatch_y <= params.dispatch_x_limit;
  active_source_view[offset + 0u] = select(0u, dispatch_x, shape_admitted);
  active_source_view[offset + 1u] = select(0u, dispatch_y, shape_admitted);
  active_source_view[offset + 2u] = select(0u, 1u, shape_admitted);
}

@compute @workgroup_size(1)
fn finalize_active_source_view() {
  let required_count = required_active_count();
  let invalid_count = atomicLoad(
    &active_source_evidence[EVIDENCE_INVALID]
  );
  let nonfinite_count = atomicLoad(
    &active_source_evidence[EVIDENCE_NONFINITE]
  );
  let dormant_count = atomicLoad(
    &active_source_evidence[EVIDENCE_DORMANT]
  );
  let classify_count = atomicLoad(
    &active_source_evidence[EVIDENCE_CLASSIFIED]
  );
  let scatter_count = atomicLoad(
    &active_source_evidence[EVIDENCE_SCATTER]
  );
  let reverse_count = atomicLoad(
    &active_source_evidence[EVIDENCE_REVERSE]
  );
  let unsupported = atomicLoad(
    &active_source_evidence[EVIDENCE_UNSUPPORTED]
  ) != 0u;
  let rows_admitted = classified_rows_admitted(required_count);
  let overflowed = rows_admitted && required_count > VIEW_ACTIVE_CAPACITY;
  let admitted = rows_admitted
    && !overflowed
    && scatter_count == required_count
    && reverse_count == required_count;
  var status = STATUS_READY;
  if (unsupported) {
    status = status | STATUS_FAIL_CLOSED | STATUS_UNSUPPORTED_SOURCE;
  } else if (invalid_count != 0u) {
    status = status | STATUS_FAIL_CLOSED | STATUS_INVALID_SOURCE;
    if (nonfinite_count != 0u) {
      status = status | STATUS_NONFINITE;
    }
  } else if (overflowed) {
    status = status | STATUS_FAIL_CLOSED | STATUS_CAPACITY_OVERFLOW;
  } else if (admitted) {
    status = status | STATUS_ADMITTED;
  } else {
    status = status | STATUS_FAIL_CLOSED | STATUS_IDENTITY_MISMATCH;
  }

  let sealed_active_count = select(0u, required_count, admitted);
  let sealed_dormant_count = select(0u, dormant_count, admitted);
  let completion_ordinal = select(0u, params.build_ordinal, admitted);
  let candidate_count = sealed_active_count * CANDIDATES_PER_SOURCE;
  let overflow_count = select(
    0u,
    required_count - VIEW_ACTIVE_CAPACITY,
    overflowed
  );
  let logical_required_words = VIEW_HEADER_WORDS
    + required_count + VIEW_PHYSICAL_CAPACITY;

  active_source_view[0u] = VIEW_MAGIC;
  active_source_view[1u] = VIEW_VERSION;
  active_source_view[2u] = status;
  active_source_view[3u] = params.generation_id;
  active_source_view[4u] = params.device_ordinal;
  active_source_view[5u] = params.lane_ordinal;
  active_source_view[6u] = params.lease_token;
  active_source_view[7u] = params.source_family_id;
  active_source_view[8u] = params.storage_generation;
  active_source_view[9u] = params.physics_tick;
  active_source_view[10u] = params.physics_substep;
  active_source_view[11u] = params.position_epoch;
  active_source_view[12u] = params.topology_epoch;
  active_source_view[13u] = params.chart_epoch;
  active_source_view[14u] = params.level_epoch;
  active_source_view[15u] = params.support_epoch;
  active_source_view[16u] = params.physical_source_count;
  active_source_view[17u] = VIEW_PHYSICAL_CAPACITY;
  active_source_view[18u] = sealed_active_count;
  active_source_view[19u] = VIEW_ACTIVE_CAPACITY;
  active_source_view[20u] = sealed_dormant_count;
  active_source_view[21u] = invalid_count;
  active_source_view[22u] = overflow_count;
  active_source_view[23u] = params.source_row_layout_id;
  active_source_view[24u] = SOURCE_ROW_WORDS;
  active_source_view[25u] = VIEW_ACTIVE_TO_PHYSICAL_OFFSET;
  active_source_view[26u] = VIEW_PHYSICAL_TO_ACTIVE_OFFSET;
  active_source_view[27u] = VIEW_CAPACITY_WORDS;
  active_source_view[28u] = logical_required_words;
  active_source_view[29u] = params.build_ordinal;
  active_source_view[30u] = completion_ordinal;
  active_source_view[31u] = params.source_fingerprint;
  active_source_view[32u] = classify_count;
  active_source_view[33u] = select(0u, scatter_count, admitted);
  active_source_view[34u] = select(0u, reverse_count, admitted);
  active_source_view[35u] = required_count;
  active_source_view[36u] = select(
    0u,
    atomicLoad(&active_source_evidence[EVIDENCE_ACTIVE_HIGH_WATER]),
    admitted
  );
  active_source_view[37u] = PRODUCER_WORKGROUP_SIZE;
  active_source_view[38u] = params.dispatch_x_limit;
  active_source_view[39u] = params.cleared_words;
  active_source_view[40u] = VIEW_ACTIVE_DISPATCH_OFFSET;
  active_source_view[41u] = VIEW_CANDIDATE_DISPATCH_OFFSET;
  active_source_view[42u] = VIEW_PHYSICAL_DISPATCH_OFFSET;
  active_source_view[43u] = candidate_count;
  active_source_view[44u] =
    VIEW_ACTIVE_CAPACITY * CANDIDATES_PER_SOURCE;
  active_source_view[45u] = params.capacity_tier_ordinal;
  active_source_view[46u] = select(0u, required_count, overflowed);
  active_source_view[47u] = select(
    0u,
    projection_seal(
      params.source_fingerprint,
      sealed_active_count,
      sealed_dormant_count,
      completion_ordinal
    ),
    admitted
  );
  write_dispatch(
    VIEW_ACTIVE_DISPATCH_OFFSET,
    sealed_active_count,
    admitted
  );
  write_dispatch(
    VIEW_CANDIDATE_DISPATCH_OFFSET,
    candidate_count,
    admitted
  );
  write_dispatch(
    VIEW_PHYSICAL_DISPATCH_OFFSET,
    params.physical_source_count,
    admitted
  );
}
`;
}
