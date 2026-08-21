import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION
} from './schroederSpatialMechanicsFieldView.js';
import {
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_RADIX_KEY_WORDS
} from './schroederSpatialParentFieldView.js';

export const schroederSpatialParentFieldViewWgsl = /* wgsl */ `
struct SchroederSpatialParentFieldViewParams {
  fine_grid_node_count: u32,
  coarse_grid_node_count: u32,
  fine_nx: u32,
  fine_ny: u32,
  fine_nz: u32,
  coarse_nx: u32,
  coarse_ny: u32,
  coarse_nz: u32,
  fine_shift: i32,
  coarse_shift: i32,
  fine_level: i32,
  coarse_level: i32,
  fine_spacing_m: f32,
  coarse_spacing_m: f32,
  weight_tolerance: f32,
  first_moment_tolerance_m: f32,
  fine_field_capacity: u32,
  coarse_field_capacity: u32,
  fine_candidate_capacity: u32,
  candidate_capacity: u32,
  parent_field_capacity: u32,
  edge_capacity: u32,
  parent_key_offset_words: u32,
  key_words: u32,
  fine_edge_count_offset_words: u32,
  fine_edge_offset_offset_words: u32,
  fine_edge_parent_offset_words: u32,
  fine_edge_weight_offset_words: u32,
  coarse_native_map_offset_words: u32,
  required_words: u32,
  capacity_words: u32,
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
  hierarchy_completion_ordinal: u32,
  fine_field_completion_ordinal: u32,
  coarse_field_completion_ordinal: u32,
  workgroup_size: u32,
  exact_level_count: u32,
  cleared_words: u32,
  max_compute_workgroups_per_dimension: u32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
  pad4: u32,
  pad5: u32,
  pad6: u32,
  pad7: u32,
  pad8: u32,
  pad9: u32,
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
};

@group(0) @binding(0) var<storage, read> fine_field_view: array<u32>;
@group(0) @binding(1) var<storage, read> coarse_field_view: array<u32>;
@group(0) @binding(2) var<storage, read> hierarchy_view: array<u32>;
@group(0) @binding(3) var<storage, read_write> candidate_keys: array<u32>;
@group(0) @binding(4) var<storage, read_write> candidate_union_indices: array<u32>;
@group(0) @binding(5) var<storage, read_write> fine_edge_counts: array<u32>;
@group(0) @binding(6) var<storage, read> fine_edge_offsets: array<u32>;
@group(0) @binding(7) var<storage, read_write> parent_field_view: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read> unique_keys: array<u32>;
@group(0) @binding(9) var<storage, read> unique_evidence: array<u32>;
@group(0) @binding(10) var<storage, read> sorted_candidate_indices: array<u32>;
@group(0) @binding(11) var<storage, read> unique_group_by_sorted_position: array<u32>;
@group(0) @binding(12) var<uniform> params: SchroederSpatialParentFieldViewParams;

const FIELD_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC}u;
const FIELD_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION}u;
const FIELD_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u;
const FIELD_DESCRIPTOR_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS}u;
const FIELD_KEY_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS}u;
const FIELD_ACCUMULATOR_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS}u;
const FIELD_RECEIPT_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS}u;
const FIELD_STATE_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS}u;
const FIELD_PRESSURE_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS}u;
const HIERARCHY_MAGIC: u32 = 0x53485631u;
const HIERARCHY_VERSION: u32 = 1u;
const PARENT_FIELD_MAGIC: u32 = 0x53504631u;
const PARENT_FIELD_VERSION: u32 = 1u;
const READY_ADMITTED: u32 = 3u;
const STATUS_READY: u32 = 1u;
const STATUS_ADMITTED: u32 = 2u;
const STATUS_FAIL_CLOSED: u32 = 4u;
const STATUS_INVALID_SOURCE: u32 = 8u;
const STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const STATUS_LEVEL_CONTRACT: u32 = 32u;
const STATUS_CLIPPED_SUPPORT: u32 = 64u;
const STATUS_TRANSFER_RESIDUAL: u32 = 128u;
const INVALID_INDEX: u32 = 0xffffffffu;
const KEY_WORDS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS}u;
const RADIX_KEY_WORDS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_RADIX_KEY_WORDS}u;
const RADIX_MATERIAL_MASK: u32 = 0x00ffffffu;
const MAX_FINE_EDGES: u32 = 8u;

fn output_store(word: u32, value: u32) {
  atomicStore(&parent_field_view[word], value);
}

fn output_load(word: u32) -> u32 {
  return atomicLoad(&parent_field_view[word]);
}

fn flattened_invocation_index(
  global_id: vec3<u32>,
  workgroup_count: vec3<u32>
) -> u32 {
  return global_id.x
    + global_id.y * workgroup_count.x * params.workgroup_size;
}

fn bounded_dispatch_shape(invocation_count: u32) -> vec3<u32> {
  if (invocation_count == 0u) { return vec3<u32>(0u); }
  let workgroup_size = max(params.workgroup_size, 1u);
  let group_count = (invocation_count + workgroup_size - 1u)
    / workgroup_size;
  let dispatch_limit = max(
    params.max_compute_workgroups_per_dimension,
    1u
  );
  let dispatch_x = min(group_count, dispatch_limit);
  let dispatch_y = (group_count + dispatch_x - 1u) / dispatch_x;
  return vec3<u32>(dispatch_x, dispatch_y, 1u);
}

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= bitcast<f32>(0x7f7fffffu);
}

fn atomic_max_nonnegative_f32(
  destination: ptr<storage, atomic<u32>, read_write>,
  value: f32
) {
  if (finite_f32(value) && value >= 0.0) {
    atomicMax(destination, bitcast<u32>(value));
  }
}

fn same_identity(view: ptr<storage, array<u32>, read>) -> bool {
  return (*view)[3u] == params.generation_id
    && (*view)[4u] == params.device_ordinal
    && (*view)[5u] == params.lane_ordinal
    && (*view)[6u] == params.lease_token
    && (*view)[7u] == params.source_family_id
    && (*view)[8u] == params.storage_generation
    && (*view)[9u] == params.physics_tick
    && (*view)[10u] == params.physics_substep
    && (*view)[11u] == params.position_epoch
    && (*view)[12u] == params.topology_epoch
    && (*view)[13u] == params.chart_epoch
    && (*view)[14u] == params.level_epoch
    && (*view)[15u] == params.support_epoch;
}

// One bit identifies each independent mechanics-field v2 admission clause.
// Words 78/79 of the parent view retain the fine/coarse masks for native
// diagnosis even when construction fails closed.
fn field_view_admission_mask(
  view: ptr<storage, array<u32>, read>,
  level: i32,
  grid_node_count: u32,
  nx: u32,
  ny: u32,
  nz: u32,
  shift: i32,
  spacing_m: f32,
  field_capacity: u32,
  completion_ordinal: u32
) -> u32 {
  if (arrayLength(view) < FIELD_HEADER_WORDS) { return 0xffffffffu; }
  var mask = 0u;
  let source_count = (*view)[16u];
  let descriptor_offset = (*view)[24u];
  let key_offset = (*view)[26u];
  let accumulator_offset = (*view)[28u];
  let state_offset = (*view)[30u];
  let active_count = (*view)[34u];
  let active_required = (*view)[41u];
  let capacity_words = (*view)[42u];
  if ((*view)[0u] != FIELD_MAGIC) { mask = mask | (1u << 0u); }
  if ((*view)[1u] != FIELD_VERSION) { mask = mask | (1u << 1u); }
  if ((*view)[2u] != READY_ADMITTED) { mask = mask | (1u << 2u); }
  if (!same_identity(view)) { mask = mask | (1u << 3u); }
  if (bitcast<i32>((*view)[17u]) != level
      || (*view)[18u] != grid_node_count
      || (*view)[19u] != nx || (*view)[20u] != ny || (*view)[21u] != nz
      || (*view)[22u] != u32(shift)
      || (*view)[23u] != bitcast<u32>(spacing_m)) {
    mask = mask | (1u << 4u);
  }
  if ((*view)[32u] != field_capacity || active_count > field_capacity) {
    mask = mask | (1u << 5u);
  }
  if ((*view)[38u] != completion_ordinal) { mask = mask | (1u << 6u); }
  if ((*view)[25u] != FIELD_DESCRIPTOR_WORDS
      || (*view)[27u] != FIELD_KEY_WORDS
      || (*view)[29u] != FIELD_ACCUMULATOR_WORDS
      || (*view)[31u] != FIELD_STATE_WORDS) {
    mask = mask | (1u << 7u);
  }
  if (descriptor_offset != FIELD_HEADER_WORDS) {
    mask = mask | (1u << 8u);
  }
  if (key_offset < descriptor_offset) {
    mask = mask | (1u << 9u);
  } else {
    let descriptor_gap = key_offset - descriptor_offset;
    if (descriptor_gap % FIELD_DESCRIPTOR_WORDS != 0u
        || source_count > descriptor_gap / FIELD_DESCRIPTOR_WORDS) {
      mask = mask | (1u << 9u);
    }
  }
  if (accumulator_offset < key_offset) {
    mask = mask | (1u << 10u);
  } else {
    let key_gap = accumulator_offset - key_offset;
    if (key_gap % FIELD_KEY_WORDS != 0u
        || key_gap / FIELD_KEY_WORDS != field_capacity) {
      mask = mask | (1u << 10u);
    }
  }
  if (state_offset < FIELD_RECEIPT_WORDS) {
    mask = mask | (1u << 11u);
  } else {
    let receipt_offset = state_offset - FIELD_RECEIPT_WORDS;
    if (receipt_offset < accumulator_offset) {
      mask = mask | (1u << 11u);
    } else {
      let accumulator_gap = receipt_offset - accumulator_offset;
      if (accumulator_gap % FIELD_ACCUMULATOR_WORDS != 0u
          || accumulator_gap / FIELD_ACCUMULATOR_WORDS != field_capacity) {
        mask = mask | (1u << 11u);
      }
    }
  }
  // Mechanics-field view v4 appends immutable pressure rows after the
  // state-capacity bank, so required/capacity words bound the pressure tail.
  // The pressure offset is derived from the state bank exactly as the
  // producer derives it; it is never uploaded as a separate word.
  var pressure_offset = 0u;
  var pressure_offset_ok = false;
  if (field_capacity <= (0xffffffffu - state_offset) / FIELD_STATE_WORDS) {
    pressure_offset = state_offset + field_capacity * FIELD_STATE_WORDS;
    pressure_offset_ok = true;
  }
  if (!pressure_offset_ok || active_required < pressure_offset) {
    mask = mask | (1u << 12u);
  } else {
    let active_gap = active_required - pressure_offset;
    if (active_gap % FIELD_PRESSURE_WORDS != 0u
        || active_gap / FIELD_PRESSURE_WORDS != active_count) {
      mask = mask | (1u << 12u);
    }
  }
  if (!pressure_offset_ok || capacity_words < pressure_offset) {
    mask = mask | (1u << 13u);
  } else {
    let pressure_gap = capacity_words - pressure_offset;
    if (pressure_gap % FIELD_PRESSURE_WORDS != 0u
        || pressure_gap / FIELD_PRESSURE_WORDS != field_capacity) {
      mask = mask | (1u << 13u);
    }
  }
  if (active_required > capacity_words || capacity_words > arrayLength(view)) {
    mask = mask | (1u << 14u);
  }
  if ((*view)[54u] != source_count) { mask = mask | (1u << 15u); }
  return mask;
}

fn field_view_admitted(
  view: ptr<storage, array<u32>, read>,
  level: i32,
  grid_node_count: u32,
  nx: u32,
  ny: u32,
  nz: u32,
  shift: i32,
  spacing_m: f32,
  field_capacity: u32,
  completion_ordinal: u32
) -> bool {
  return field_view_admission_mask(
    view, level, grid_node_count, nx, ny, nz, shift, spacing_m,
    field_capacity, completion_ordinal
  ) == 0u;
}

fn fine_field_admission_mask() -> u32 {
  return field_view_admission_mask(
    &fine_field_view,
    params.fine_level,
    params.fine_grid_node_count,
    params.fine_nx,
    params.fine_ny,
    params.fine_nz,
    params.fine_shift,
    params.fine_spacing_m,
    params.fine_field_capacity,
    params.fine_field_completion_ordinal
  );
}

fn fine_field_admitted() -> bool {
  return fine_field_admission_mask() == 0u;
}

fn coarse_field_admission_mask() -> u32 {
  return field_view_admission_mask(
    &coarse_field_view,
    params.coarse_level,
    params.coarse_grid_node_count,
    params.coarse_nx,
    params.coarse_ny,
    params.coarse_nz,
    params.coarse_shift,
    params.coarse_spacing_m,
    params.coarse_field_capacity,
    params.coarse_field_completion_ordinal
  );
}

fn coarse_field_admitted() -> bool {
  return coarse_field_admission_mask() == 0u;
}

fn hierarchy_admitted() -> bool {
  if (arrayLength(&hierarchy_view) < 68u) { return false; }
  let capacity_words = hierarchy_view[59u];
  return hierarchy_view[0u] == HIERARCHY_MAGIC
    && hierarchy_view[1u] == HIERARCHY_VERSION
    && (hierarchy_view[2u] & READY_ADMITTED) == READY_ADMITTED
    && same_identity(&hierarchy_view)
    && bitcast<i32>(hierarchy_view[16u]) == params.fine_level
    && bitcast<i32>(hierarchy_view[17u]) == params.coarse_level
    && hierarchy_view[18u] == params.fine_grid_node_count
    && hierarchy_view[19u] == params.coarse_grid_node_count
    && hierarchy_view[20u] == params.fine_nx
    && hierarchy_view[21u] == params.fine_ny
    && hierarchy_view[22u] == params.fine_nz
    && hierarchy_view[23u] == params.coarse_nx
    && hierarchy_view[24u] == params.coarse_ny
    && hierarchy_view[25u] == params.coarse_nz
    && hierarchy_view[26u] == u32(params.fine_shift)
    && hierarchy_view[27u] == u32(params.coarse_shift)
    && hierarchy_view[28u] == bitcast<u32>(params.fine_spacing_m)
    && hierarchy_view[29u] == bitcast<u32>(params.coarse_spacing_m)
    && hierarchy_view[34u] <= hierarchy_view[30u]
    && hierarchy_view[35u] <= hierarchy_view[31u]
    && hierarchy_view[36u] <= hierarchy_view[32u]
    && hierarchy_view[44u] == params.hierarchy_completion_ordinal
    && hierarchy_view[45u] == params.generation_id
    && hierarchy_view[58u] <= capacity_words
    && capacity_words <= arrayLength(&hierarchy_view);
}

fn field_key_valid(
  view: ptr<storage, array<u32>, read>,
  field_index: u32,
  grid_node_count: u32
) -> bool {
  let field_count = (*view)[34u];
  let key_offset = (*view)[26u];
  if (field_index >= field_count) { return false; }
  let base = key_offset + field_index * KEY_WORDS;
  if (base > arrayLength(view) || KEY_WORDS > arrayLength(view) - base) {
    return false;
  }
  let family = (*view)[base + 1u];
  let material = (*view)[base + 2u];
  let domain = (*view)[base + 3u];
  return (*view)[base] < grid_node_count
    && family >= 1u
    && family <= 4u
    && material >= 1u
    && material <= 0x00ffffffu
    && select(domain == 0u, domain != 0u, family == 1u);
}

fn field_key_word(
  view: ptr<storage, array<u32>, read>,
  field_index: u32,
  word: u32
) -> u32 {
  return (*view)[(*view)[26u] + field_index * KEY_WORDS + word];
}

fn candidate_store_invalid(candidate_index: u32) {
  let base = candidate_index * RADIX_KEY_WORDS;
  candidate_keys[base] = INVALID_INDEX;
  candidate_keys[base + 1u] = INVALID_INDEX;
  candidate_keys[base + 2u] = INVALID_INDEX;
}

fn candidate_store_key(
  candidate_index: u32,
  parent_dense_node: u32,
  family: u32,
  material: u32,
  domain: u32
) {
  let base = candidate_index * RADIX_KEY_WORDS;
  candidate_keys[base] = parent_dense_node;
  candidate_keys[base + 1u] = (family << 24u) | material;
  candidate_keys[base + 2u] = domain;
}

fn hierarchy_fine_compact_index(dense_node: u32) -> u32 {
  let node_count = hierarchy_view[34u];
  let node_offset = hierarchy_view[48u];
  if (node_offset > arrayLength(&hierarchy_view)
    || node_count > arrayLength(&hierarchy_view) - node_offset) {
    return INVALID_INDEX;
  }
  var lower = 0u;
  var upper = node_count;
  loop {
    if (lower >= upper) { break; }
    let middle = lower + (upper - lower) / 2u;
    let candidate = hierarchy_view[node_offset + middle];
    if (candidate < dense_node) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  return select(
    INVALID_INDEX,
    lower,
    lower < node_count && hierarchy_view[node_offset + lower] == dense_node
  );
}

fn hierarchy_edge_range(compact_fine: u32) -> vec2<u32> {
  let count_offset = hierarchy_view[50u];
  let offset_offset = hierarchy_view[51u];
  let count = hierarchy_view[count_offset + compact_fine];
  let begin = hierarchy_view[offset_offset + compact_fine];
  return vec2<u32>(begin, count);
}

fn hierarchy_parent_dense(edge_index: u32) -> u32 {
  let parent_offset = hierarchy_view[52u];
  let coarse_node_offset = hierarchy_view[49u];
  let compact_parent = hierarchy_view[parent_offset + edge_index];
  if (compact_parent >= hierarchy_view[35u]) { return INVALID_INDEX; }
  return hierarchy_view[coarse_node_offset + compact_parent];
}

fn hierarchy_edge_weight(edge_index: u32) -> f32 {
  return bitcast<f32>(hierarchy_view[hierarchy_view[53u] + edge_index]);
}

fn dense_coords(index: u32, ny: u32, nz: u32) -> vec3<i32> {
  let plane = ny * nz;
  let x = index / plane;
  let remainder = index - x * plane;
  return vec3<i32>(i32(x), i32(remainder / nz), i32(remainder % nz));
}

// Publish an authenticated live prefix for the radix runtime. Fine candidate
// rows retain their fixed eight-wide per-field layout, while coarse rows begin
// immediately after the live fine prefix. This preserves every downstream
// candidate index without sorting the unused capacity tail.
@compute @workgroup_size(1)
fn prepare_candidate_count() {
  let fine_admitted = fine_field_admission_mask() == 0u;
  let coarse_admitted = coarse_field_admission_mask() == 0u;
  let hierarchy_is_admitted = hierarchy_admitted();
  let fine_count = select(0u, fine_field_view[34u], fine_admitted);
  let coarse_count = select(0u, coarse_field_view[34u], coarse_admitted);
  var candidate_count = 0u;
  if (
    fine_admitted
    && coarse_admitted
    && hierarchy_is_admitted
    && fine_count <= params.fine_field_capacity
    && coarse_count <= params.coarse_field_capacity
  ) {
    candidate_count = fine_count * MAX_FINE_EDGES + coarse_count;
    if (candidate_count > params.candidate_capacity) {
      candidate_count = 0u;
      atomicAdd(&parent_field_view[40u], 1u);
    }
  }
  output_store(72u, candidate_count);
  let candidate_dispatch = bounded_dispatch_shape(candidate_count);
  output_store(60u, candidate_dispatch.x);
  output_store(61u, candidate_dispatch.y);
  output_store(62u, candidate_dispatch.z);
  output_store(63u, params.completion_ordinal);
}

@compute @workgroup_size(64)
fn emit_fine_parent_candidates(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let field_index = flattened_invocation_index(global_id, workgroup_count);
  if (field_index >= params.fine_field_capacity) { return; }
  let candidate_base = field_index * MAX_FINE_EDGES;
  for (var edge = 0u; edge < MAX_FINE_EDGES; edge = edge + 1u) {
    candidate_store_invalid(candidate_base + edge);
  }
  fine_edge_counts[field_index] = 0u;
  output_store(params.fine_edge_count_offset_words + field_index, 0u);
  if (!fine_field_admitted() || !hierarchy_admitted()) {
    if (field_index == 0u) { atomicAdd(&parent_field_view[39u], 1u); }
    return;
  }
  let field_count = fine_field_view[34u];
  if (field_index >= field_count) { return; }
  if (!field_key_valid(&fine_field_view, field_index, params.fine_grid_node_count)) {
    atomicAdd(&parent_field_view[71u], 1u);
    return;
  }
  let dense_node = field_key_word(&fine_field_view, field_index, 0u);
  let compact_fine = hierarchy_fine_compact_index(dense_node);
  if (compact_fine == INVALID_INDEX) {
    atomicAdd(&parent_field_view[39u], 1u);
    return;
  }
  let edge_range = hierarchy_edge_range(compact_fine);
  if (
    edge_range.y == 0u
    || edge_range.y > MAX_FINE_EDGES
    || edge_range.x > hierarchy_view[36u]
    || edge_range.y > hierarchy_view[36u] - edge_range.x
  ) {
    atomicAdd(&parent_field_view[39u], 1u);
    return;
  }
  let family = field_key_word(&fine_field_view, field_index, 1u);
  let material = field_key_word(&fine_field_view, field_index, 2u);
  let domain = field_key_word(&fine_field_view, field_index, 3u);
  for (var local_edge = 0u; local_edge < edge_range.y; local_edge = local_edge + 1u) {
    let hierarchy_edge = edge_range.x + local_edge;
    let parent_dense = hierarchy_parent_dense(hierarchy_edge);
    let weight = hierarchy_edge_weight(hierarchy_edge);
    if (
      parent_dense >= params.coarse_grid_node_count
      || !finite_f32(weight)
      || !(weight > 0.0)
    ) {
      atomicAdd(&parent_field_view[41u], 1u);
      return;
    }
    candidate_store_key(
      candidate_base + local_edge,
      parent_dense,
      family,
      material,
      domain
    );
  }
  fine_edge_counts[field_index] = edge_range.y;
  output_store(params.fine_edge_count_offset_words + field_index, edge_range.y);
}

@compute @workgroup_size(64)
fn emit_coarse_native_candidates(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let field_index = flattened_invocation_index(global_id, workgroup_count);
  if (field_index >= params.coarse_field_capacity) { return; }
  let fine_count = min(fine_field_view[34u], params.fine_field_capacity);
  let candidate_index = fine_count * MAX_FINE_EDGES + field_index;
  candidate_store_invalid(candidate_index);
  output_store(params.coarse_native_map_offset_words + field_index, INVALID_INDEX);
  if (!coarse_field_admitted() || !hierarchy_admitted()) {
    if (field_index == 0u) { atomicAdd(&parent_field_view[39u], 1u); }
    return;
  }
  if (field_index >= coarse_field_view[34u]) { return; }
  if (!field_key_valid(&coarse_field_view, field_index, params.coarse_grid_node_count)) {
    atomicAdd(&parent_field_view[71u], 1u);
    return;
  }
  candidate_store_key(
    candidate_index,
    field_key_word(&coarse_field_view, field_index, 0u),
    field_key_word(&coarse_field_view, field_index, 1u),
    field_key_word(&coarse_field_view, field_index, 2u),
    field_key_word(&coarse_field_view, field_index, 3u)
  );
}

fn candidate_is_invalid(candidate_index: u32) -> bool {
  let base = candidate_index * RADIX_KEY_WORDS;
  return candidate_keys[base] == INVALID_INDEX
    && candidate_keys[base + 1u] == INVALID_INDEX
    && candidate_keys[base + 2u] == INVALID_INDEX;
}

fn unique_count_without_sentinel() -> u32 {
  if (arrayLength(&unique_evidence) < 8u) { return 0u; }
  let unique_count = unique_evidence[2u];
  if (unique_count == 0u || unique_count > params.parent_field_capacity + 1u) {
    return unique_count;
  }
  let last = (unique_count - 1u) * RADIX_KEY_WORDS;
  if (
    last <= arrayLength(&unique_keys)
    && RADIX_KEY_WORDS <= arrayLength(&unique_keys) - last
    && unique_keys[last] == INVALID_INDEX
    && unique_keys[last + 1u] == INVALID_INDEX
    && unique_keys[last + 2u] == INVALID_INDEX
  ) {
    return unique_count - 1u;
  }
  return unique_count;
}

@compute @workgroup_size(64)
fn materialize_candidate_union_indices(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let sorted_position = flattened_invocation_index(
    global_id,
    workgroup_count
  );
  let live_candidate_count = output_load(72u);
  if (
    sorted_position >= live_candidate_count
    || sorted_position >= params.candidate_capacity
    || sorted_position >= arrayLength(&sorted_candidate_indices)
    || sorted_position >= arrayLength(&unique_group_by_sorted_position)
  ) {
    return;
  }
  let candidate_index = sorted_candidate_indices[sorted_position];
  if (candidate_index >= params.candidate_capacity) {
    atomicAdd(&parent_field_view[71u], 1u);
    return;
  }
  var union_index = INVALID_INDEX;
  if (!candidate_is_invalid(candidate_index)) {
    var inclusive_head_count = unique_evidence[2u];
    if (sorted_position + 1u < params.candidate_capacity) {
      inclusive_head_count = unique_group_by_sorted_position[sorted_position + 1u];
    }
    if (inclusive_head_count > 0u) {
      union_index = inclusive_head_count - 1u;
    }
    if (union_index >= params.parent_field_capacity) {
      union_index = INVALID_INDEX;
      atomicAdd(&parent_field_view[40u], 1u);
    }
  }
  candidate_union_indices[candidate_index] = union_index;
  let live_fine_candidate_count = min(
    fine_field_view[34u],
    params.fine_field_capacity
  ) * MAX_FINE_EDGES;
  if (candidate_index >= live_fine_candidate_count) {
    let coarse_index = candidate_index - live_fine_candidate_count;
    output_store(params.coarse_native_map_offset_words + coarse_index, union_index);
  }
}

fn unique_key_strictly_less(left: u32, right: u32) -> bool {
  let left_base = left * RADIX_KEY_WORDS;
  let right_base = right * RADIX_KEY_WORDS;
  for (var word = 0u; word < RADIX_KEY_WORDS; word = word + 1u) {
    let a = unique_keys[left_base + word];
    let b = unique_keys[right_base + word];
    if (a < b) { return true; }
    if (a > b) { return false; }
  }
  return false;
}

@compute @workgroup_size(64)
fn assemble_parent_field_keys(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let parent_index = flattened_invocation_index(
    global_id,
    workgroup_count
  );
  let parent_count = unique_count_without_sentinel();
  if (parent_index >= parent_count || parent_index >= params.parent_field_capacity) {
    return;
  }
  let source = parent_index * RADIX_KEY_WORDS;
  let destination = params.parent_key_offset_words + parent_index * KEY_WORDS;
  let ordered = parent_index == 0u
    || unique_key_strictly_less(parent_index - 1u, parent_index);
  let packed_identity = unique_keys[source + 1u];
  let family = packed_identity >> 24u;
  let material = packed_identity & RADIX_MATERIAL_MASK;
  let domain = unique_keys[source + 2u];
  let key_valid = unique_keys[source] < params.coarse_grid_node_count
    && family >= 1u
    && family <= 4u
    && material >= 1u
    && material <= RADIX_MATERIAL_MASK
    && ((family << 24u) | material) == packed_identity
    && select(domain == 0u, domain != 0u, family == 1u);
  if (!ordered || !key_valid) {
    atomicAdd(&parent_field_view[71u], 1u);
    return;
  }
  output_store(destination, unique_keys[source]);
  output_store(destination + 1u, family);
  output_store(destination + 2u, material);
  output_store(destination + 3u, domain);
}

fn output_parent_key_matches(
  parent_index: u32,
  dense_node: u32,
  family: u32,
  material: u32,
  domain: u32
) -> bool {
  if (parent_index >= params.parent_field_capacity) { return false; }
  let base = params.parent_key_offset_words + parent_index * KEY_WORDS;
  return output_load(base) == dense_node
    && output_load(base + 1u) == family
    && output_load(base + 2u) == material
    && output_load(base + 3u) == domain;
}

@compute @workgroup_size(64)
fn scatter_fine_field_edges(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let field_index = flattened_invocation_index(global_id, workgroup_count);
  if (field_index >= params.fine_field_capacity) { return; }
  let edge_base = fine_edge_offsets[field_index];
  output_store(params.fine_edge_offset_offset_words + field_index, edge_base);
  if (!fine_field_admitted() || !hierarchy_admitted()) { return; }
  if (field_index >= fine_field_view[34u]) { return; }
  let dense_node = field_key_word(&fine_field_view, field_index, 0u);
  let compact_fine = hierarchy_fine_compact_index(dense_node);
  if (compact_fine == INVALID_INDEX) {
    atomicAdd(&parent_field_view[39u], 1u);
    return;
  }
  let edge_range = hierarchy_edge_range(compact_fine);
  if (
    edge_range.y != fine_edge_counts[field_index]
    || edge_range.y == 0u
    || edge_range.y > MAX_FINE_EDGES
    || edge_base > params.edge_capacity
    || edge_range.y > params.edge_capacity - edge_base
  ) {
    atomicAdd(&parent_field_view[40u], 1u);
    return;
  }
  let family = field_key_word(&fine_field_view, field_index, 1u);
  let material = field_key_word(&fine_field_view, field_index, 2u);
  let domain = field_key_word(&fine_field_view, field_index, 3u);
  var weight_sum = 0.0;
  var reproduced = vec3<f32>(0.0);
  for (var local_edge = 0u; local_edge < edge_range.y; local_edge = local_edge + 1u) {
    let hierarchy_edge = edge_range.x + local_edge;
    let parent_dense = hierarchy_parent_dense(hierarchy_edge);
    let weight = hierarchy_edge_weight(hierarchy_edge);
    let candidate_index = field_index * MAX_FINE_EDGES + local_edge;
    let parent_index = candidate_union_indices[candidate_index];
    if (
      parent_dense >= params.coarse_grid_node_count
      || !finite_f32(weight)
      || !(weight > 0.0)
      || !output_parent_key_matches(
        parent_index,
        parent_dense,
        family,
        material,
        domain
      )
    ) {
      atomicAdd(&parent_field_view[71u], 1u);
      return;
    }
    let destination = edge_base + local_edge;
    output_store(params.fine_edge_parent_offset_words + destination, parent_index);
    output_store(
      params.fine_edge_weight_offset_words + destination,
      bitcast<u32>(weight)
    );
    weight_sum = weight_sum + weight;
    let coarse_coords = dense_coords(
      parent_dense,
      params.coarse_ny,
      params.coarse_nz
    );
    reproduced = reproduced
      + weight
        * vec3<f32>(coarse_coords - vec3<i32>(params.coarse_shift))
        * params.coarse_spacing_m;
  }
  let fine_coords = dense_coords(dense_node, params.fine_ny, params.fine_nz);
  let fine_position = vec3<f32>(fine_coords - vec3<i32>(params.fine_shift))
    * params.fine_spacing_m;
  if (
    !finite_f32(weight_sum)
    || !finite_f32(reproduced.x)
    || !finite_f32(reproduced.y)
    || !finite_f32(reproduced.z)
  ) {
    atomicAdd(&parent_field_view[71u], 1u);
    return;
  }
  atomic_max_nonnegative_f32(&parent_field_view[42u], abs(weight_sum - 1.0));
  atomic_max_nonnegative_f32(
    &parent_field_view[43u],
    length(reproduced - fine_position)
  );
}

@compute @workgroup_size(1)
fn finalize_parent_field_view() {
  let fine_admission_mask = fine_field_admission_mask();
  let coarse_admission_mask = coarse_field_admission_mask();
  let fine_admitted = fine_admission_mask == 0u;
  let coarse_admitted = coarse_admission_mask == 0u;
  let hierarchy_is_admitted = hierarchy_admitted();
  let candidate_count = output_load(72u);
  let unique_ready = arrayLength(&unique_evidence) >= 8u
    && unique_evidence[0u] == params.generation_id
    && unique_evidence[1u] == candidate_count
    && unique_evidence[3u] == 1u
    && unique_evidence[4u] == 0u
    && unique_evidence[5u] == RADIX_KEY_WORDS
    && unique_evidence[6u] == RADIX_KEY_WORDS
    && unique_evidence[7u] == 3u;
  let fine_count = select(0u, fine_field_view[34u], fine_admitted);
  let coarse_count = select(0u, coarse_field_view[34u], coarse_admitted);
  let parent_count = unique_count_without_sentinel();
  let last_fine = params.fine_field_capacity - 1u;
  let edge_count = fine_edge_offsets[last_fine] + fine_edge_counts[last_fine];
  let invalid_source = output_load(39u);
  var overflow = output_load(40u);
  let clipped = output_load(41u);
  let invalid_key = output_load(71u);
  let weight_residual = bitcast<f32>(output_load(42u));
  let first_moment_residual = bitcast<f32>(output_load(43u));
  if (
    fine_count > params.fine_field_capacity
    || coarse_count > params.coarse_field_capacity
    || parent_count > params.parent_field_capacity
    || edge_count > params.edge_capacity
    || params.fine_candidate_capacity
      != params.fine_field_capacity * MAX_FINE_EDGES
    || params.candidate_capacity
      != params.fine_candidate_capacity + params.coarse_field_capacity
    || params.required_words > params.capacity_words
    || params.capacity_words > arrayLength(&parent_field_view)
  ) {
    overflow = overflow + 1u;
  }
  let level_contract = params.exact_level_count == 2u
    && params.coarse_level == params.fine_level + 1
    && bitcast<u32>(params.coarse_spacing_m)
      == bitcast<u32>(params.fine_spacing_m * 2.0);
  let residuals_admitted = finite_f32(weight_residual)
    && finite_f32(first_moment_residual)
    && weight_residual <= params.weight_tolerance
    && first_moment_residual <= params.first_moment_tolerance_m;
  let admitted = fine_admitted
    && coarse_admitted
    && hierarchy_is_admitted
    && unique_ready
    && level_contract
    && invalid_source == 0u
    && invalid_key == 0u
    && overflow == 0u
    && clipped == 0u
    && residuals_admitted;
  var status = STATUS_READY | STATUS_ADMITTED;
  if (!admitted) {
    status = STATUS_FAIL_CLOSED;
    if (!fine_admitted || !coarse_admitted || !hierarchy_is_admitted
      || !unique_ready || invalid_source != 0u || invalid_key != 0u) {
      status = status | STATUS_INVALID_SOURCE;
    }
    if (overflow != 0u) { status = status | STATUS_CAPACITY_OVERFLOW; }
    if (!level_contract) { status = status | STATUS_LEVEL_CONTRACT; }
    if (clipped != 0u) { status = status | STATUS_CLIPPED_SUPPORT; }
    if (!residuals_admitted) { status = status | STATUS_TRANSFER_RESIDUAL; }
  }
  let dispatch = bounded_dispatch_shape(select(0u, parent_count, admitted));
  let fine_dispatch = bounded_dispatch_shape(
    select(0u, fine_count, admitted)
  );
  let coarse_dispatch = bounded_dispatch_shape(
    select(0u, coarse_count, admitted)
  );
  output_store(0u, PARENT_FIELD_MAGIC);
  output_store(1u, PARENT_FIELD_VERSION);
  output_store(2u, status);
  output_store(3u, params.generation_id);
  output_store(4u, params.device_ordinal);
  output_store(5u, params.lane_ordinal);
  output_store(6u, params.lease_token);
  output_store(7u, params.source_family_id);
  output_store(8u, params.storage_generation);
  output_store(9u, params.physics_tick);
  output_store(10u, params.physics_substep);
  output_store(11u, params.position_epoch);
  output_store(12u, params.topology_epoch);
  output_store(13u, params.chart_epoch);
  output_store(14u, params.level_epoch);
  output_store(15u, params.support_epoch);
  output_store(16u, bitcast<u32>(params.fine_level));
  output_store(17u, bitcast<u32>(params.coarse_level));
  output_store(18u, params.fine_grid_node_count);
  output_store(19u, params.coarse_grid_node_count);
  output_store(20u, params.fine_nx);
  output_store(21u, params.fine_ny);
  output_store(22u, params.fine_nz);
  output_store(23u, params.coarse_nx);
  output_store(24u, params.coarse_ny);
  output_store(25u, params.coarse_nz);
  output_store(26u, u32(params.fine_shift));
  output_store(27u, u32(params.coarse_shift));
  output_store(28u, bitcast<u32>(params.fine_spacing_m));
  output_store(29u, bitcast<u32>(params.coarse_spacing_m));
  output_store(30u, params.fine_field_capacity);
  output_store(31u, params.coarse_field_capacity);
  output_store(32u, params.candidate_capacity);
  output_store(33u, params.parent_field_capacity);
  output_store(34u, params.edge_capacity);
  output_store(35u, select(0u, fine_count, admitted));
  output_store(36u, select(0u, coarse_count, admitted));
  output_store(37u, select(0u, parent_count, admitted));
  output_store(38u, select(0u, edge_count, admitted));
  output_store(39u, invalid_source);
  output_store(40u, overflow);
  output_store(41u, clipped);
  output_store(42u, bitcast<u32>(weight_residual));
  output_store(43u, bitcast<u32>(first_moment_residual));
  output_store(44u, params.completion_ordinal);
  output_store(45u, params.hierarchy_completion_ordinal);
  output_store(46u, params.fine_field_completion_ordinal);
  output_store(47u, params.coarse_field_completion_ordinal);
  output_store(48u, params.parent_key_offset_words);
  output_store(49u, params.key_words);
  output_store(50u, params.fine_edge_count_offset_words);
  output_store(51u, params.fine_edge_offset_offset_words);
  output_store(52u, params.fine_edge_parent_offset_words);
  output_store(53u, params.fine_edge_weight_offset_words);
  output_store(54u, params.coarse_native_map_offset_words);
  output_store(55u, params.required_words);
  output_store(56u, params.capacity_words);
  output_store(57u, select(0u, unique_evidence[0u], unique_ready));
  output_store(58u, select(0u, unique_evidence[1u], unique_ready));
  output_store(59u, select(0u, unique_evidence[2u], unique_ready));
  output_store(60u, dispatch.x);
  output_store(61u, dispatch.y);
  output_store(62u, dispatch.z);
  output_store(63u, params.completion_ordinal);
  output_store(64u, fine_dispatch.x);
  output_store(65u, fine_dispatch.y);
  output_store(66u, fine_dispatch.z);
  output_store(67u, params.exact_level_count);
  output_store(68u, coarse_dispatch.x);
  output_store(69u, coarse_dispatch.y);
  output_store(70u, coarse_dispatch.z);
  output_store(71u, invalid_key);
  output_store(72u, select(0u, edge_count + coarse_count, admitted));
  output_store(73u, select(0u, coarse_count, admitted));
  output_store(74u, select(0u, edge_count, admitted));
  output_store(75u, 1u);
  output_store(76u, MAX_FINE_EDGES);
  output_store(77u, params.cleared_words);
  output_store(78u, fine_admission_mask);
  output_store(79u, coarse_admission_mask);
  output_store(params.fine_edge_offset_offset_words + fine_count, edge_count);
}
`;
