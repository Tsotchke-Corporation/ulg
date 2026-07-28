import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION
} from './schroederSpatialMechanicsFieldView.js';

export const schroederSpatialMechanicsFieldViewWgsl = /* wgsl */ `
struct MechanicsFieldViewParams {
  source_count: u32,
  source_capacity: u32,
  source_stride_floats: u32,
  source_row_layout_id: u32,
  identity_stride_words: u32,
  selected_level: i32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  grid_shift: u32,
  candidate_count: u32,
  field_capacity: u32,
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
  descriptor_offset_words: u32,
  descriptor_words: u32,
  key_offset_words: u32,
  key_words: u32,
  accumulator_offset_words: u32,
  accumulator_words: u32,
  state_offset_words: u32,
  state_words: u32,
  capacity_words: u32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  parent_capacity_words: u32,
  parent_node_capacity: u32,
  workgroup_size: u32,
  stencil_size: u32,
  source_dispatch_x: u32,
  candidate_dispatch_x: u32,
  dispatch_x_limit: u32,
  source_dispatch_y: u32,
  candidate_dispatch_y: u32,
  reserved_dispatch0: u32,
};

@group(0) @binding(0) var<storage, read> source_rows: array<f32>;
@group(0) @binding(1) var<storage, read> particle_identity: array<u32>;
@group(0) @binding(2) var<storage, read_write> candidate_keys: array<u32>;
@group(0) @binding(3) var<storage, read_write> field_view: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> unique_keys: array<u32>;
@group(0) @binding(5) var<storage, read> unique_evidence: array<u32>;
@group(0) @binding(6) var<storage, read> parent_mechanics_view: array<u32>;
@group(0) @binding(7) var<uniform> params: MechanicsFieldViewParams;
@group(0) @binding(8) var<storage, read> sorted_candidate_indices: array<u32>;
@group(0) @binding(9) var<storage, read> unique_group_by_sorted_position: array<u32>;

const FIELD_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC}u;
const FIELD_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION}u;
const FIELD_STATUS_READY: u32 = 1u;
const FIELD_STATUS_ADMITTED: u32 = 2u;
const FIELD_STATUS_FAIL_CLOSED: u32 = 4u;
const FIELD_STATUS_INVALID_SOURCE: u32 = 8u;
const FIELD_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const FIELD_HEADER_WORDS: u32 = 64u;
const FIELD_DESCRIPTOR_WORDS: u32 = 32u;
const FIELD_KEY_WORDS: u32 = 4u;
const FIELD_RADIX_KEY_WORDS: u32 = 3u;
const FIELD_RADIX_MATERIAL_MASK: u32 = 0x00ffffffu;
const FIELD_ACCUMULATOR_WORDS: u32 = 8u;
const FIELD_RECEIPT_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS}u;
const FIELD_STATE_WORDS: u32 = 8u;
const FIELD_PRESSURE_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS}u;
const FIELD_DISPATCH_OFFSET_WORDS: u32 = 60u;
const FIELD_INVALID_KEY: u32 = 0xffffffffu;
const FIELD_UNIQUE_STATUS_READY: u32 = 1u;
const FIELD_UNIQUE_STATUS_UNIFORM_PARENT: u32 = 2u;
const SOURCE_LAYOUT_LEVEL_ASSIGNMENT: u32 = 1u;
const PARENT_MAGIC: u32 = 0x534d5631u;
const PARENT_VERSION: u32 = 1u;
const PARENT_READY_ADMITTED: u32 = 3u;

fn field_finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn field_integral_f32(value: f32) -> bool {
  return field_finite_f32(value) && value == trunc(value);
}

fn field_group_count(invocation_count: u32) -> u32 {
  let width = max(params.workgroup_size, 1u);
  return invocation_count / width
    + select(0u, 1u, invocation_count % width != 0u);
}

fn field_dispatch_x(group_count: u32) -> u32 {
  return min(group_count, max(params.dispatch_x_limit, 1u));
}

fn field_dispatch_y(group_count: u32, dispatch_x: u32) -> u32 {
  let width = max(dispatch_x, 1u);
  return group_count / width
    + select(0u, 1u, group_count % width != 0u);
}

fn field_linear_invocation(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>,
  dispatch_x: u32
) -> u32 {
  let linear_group = workgroup_id.x + workgroup_id.y * dispatch_x;
  return linear_group * params.workgroup_size + local_id.x;
}

fn field_store(word: u32, value: u32) {
  atomicStore(&field_view[word], value);
}

fn field_load(word: u32) -> u32 {
  return atomicLoad(&field_view[word]);
}

fn field_record_invalid_source() {
  atomicAdd(&field_view[35u], 1u);
}

fn field_record_clipped_candidate() {
  atomicAdd(&field_view[36u], 1u);
}

fn field_write_invalid_candidate(candidate_index: u32) {
  let base = candidate_index * FIELD_RADIX_KEY_WORDS;
  candidate_keys[base] = FIELD_INVALID_KEY;
  candidate_keys[base + 1u] = FIELD_INVALID_KEY;
  candidate_keys[base + 2u] = FIELD_INVALID_KEY;
}

fn field_parent_admitted() -> bool {
  let words = arrayLength(&parent_mechanics_view);
  if (words < 64u || words != params.parent_capacity_words) {
    return false;
  }
  return parent_mechanics_view[20u] == PARENT_MAGIC
    && parent_mechanics_view[21u] == PARENT_VERSION
    && parent_mechanics_view[22u] == PARENT_READY_ADMITTED
    && parent_mechanics_view[23u] == params.generation_id
    && parent_mechanics_view[24u] == params.device_ordinal
    && parent_mechanics_view[25u] == params.lane_ordinal
    && parent_mechanics_view[26u] == params.lease_token
    && parent_mechanics_view[27u] == params.source_family_id
    && parent_mechanics_view[28u] == params.storage_generation
    && parent_mechanics_view[29u] == params.physics_tick
    && parent_mechanics_view[30u] == params.physics_substep
    && parent_mechanics_view[31u] == params.position_epoch
    && parent_mechanics_view[32u] == params.topology_epoch
    && parent_mechanics_view[33u] == params.chart_epoch
    && parent_mechanics_view[34u] == params.level_epoch
    && parent_mechanics_view[35u] == params.support_epoch
    && parent_mechanics_view[36u] == params.source_count
    && bitcast<i32>(parent_mechanics_view[37u]) == params.selected_level
    && parent_mechanics_view[38u] == params.grid_node_count
    && parent_mechanics_view[39u] == params.grid_nx
    && parent_mechanics_view[40u] == params.grid_ny
    && parent_mechanics_view[41u] == params.grid_nz
    && parent_mechanics_view[42u] == params.grid_shift
    && parent_mechanics_view[43u] == bitcast<u32>(params.grid_spacing_m)
    && parent_mechanics_view[45u] == params.parent_node_capacity
    && parent_mechanics_view[47u] == 0u
    && parent_mechanics_view[48u] == 0u
    && parent_mechanics_view[52u] == params.completion_ordinal
    && parent_mechanics_view[53u] == 64u
    && parent_mechanics_view[54u] == 64u + parent_mechanics_view[46u]
    && parent_mechanics_view[55u] == params.parent_capacity_words
    && parent_mechanics_view[56u] == params.source_row_layout_id
    && parent_mechanics_view[57u]
      == (parent_mechanics_view[46u] / 64u
        + select(0u, 1u, parent_mechanics_view[46u] % 64u != 0u))
    && parent_mechanics_view[59u] == params.generation_id
    && parent_mechanics_view[60u] == parent_mechanics_view[57u]
    && parent_mechanics_view[61u]
      == select(0u, 1u, parent_mechanics_view[46u] > 0u)
    && parent_mechanics_view[62u] == parent_mechanics_view[61u];
}

fn field_grid_index(i: i32, j: i32, k: i32) -> u32 {
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

fn field_source_admitted(source_index: u32) -> bool {
  if (
    params.source_row_layout_id != SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    || params.source_stride_floats != 16u
    || params.identity_stride_words == 0u
  ) {
    return false;
  }
  let row = source_index * params.source_stride_floats;
  let identity_row = source_index * params.identity_stride_words;
  if (
    row > arrayLength(&source_rows)
    || params.source_stride_floats > arrayLength(&source_rows) - row
    || identity_row >= arrayLength(&particle_identity)
  ) {
    return false;
  }
  let level = source_rows[row];
  let spacing = source_rows[row + 1u];
  let mass = source_rows[row + 6u];
  let phase = source_rows[row + 8u];
  let material = source_rows[row + 9u];
  let status = source_rows[row + 10u];
  let x = source_rows[row + 12u];
  let y = source_rows[row + 13u];
  let z = source_rows[row + 14u];
  let chart = source_rows[row + 15u];
  return field_integral_f32(level)
    && field_finite_f32(spacing)
    && spacing > 0.0
    && field_finite_f32(mass)
    && mass >= 0.0
    && field_integral_f32(phase)
    && phase >= 1.0
    && phase <= 4.0
    && field_integral_f32(material)
    && material >= 1.0
    && material <= 16777215.0
    && field_integral_f32(status)
    && status >= 0.0
    && status <= 255.0
    && (
      (mass == 0.0 && (u32(round(status)) & 31u) != 0u)
      || (
        mass > 0.0
        && (u32(round(status)) & 31u) != 0u
        && (u32(round(status)) & 64u) == 0u
        && (u32(round(status)) & 128u) == 0u
      )
    )
    && field_finite_f32(x)
    && field_finite_f32(y)
    && field_finite_f32(z)
    && field_integral_f32(chart)
    && chart >= 0.0;
}

@compute @workgroup_size(64)
fn emit_field_candidates(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let source_index = field_linear_invocation(
    local_id,
    workgroup_id,
    params.source_dispatch_x
  );
  if (source_index >= params.source_count) {
    return;
  }
  let descriptor = params.descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS;
  if (!field_parent_admitted() || !field_source_admitted(source_index)) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  let row = source_index * params.source_stride_floats;
  // Fixed-capacity product and phase-companion rows remain present while
  // empty. They are valid storage, but not mechanical sources.
  if (!(source_rows[row + 6u] > 0.0)) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  let level = i32(round(source_rows[row]));
  if (level != params.selected_level) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  if (bitcast<u32>(source_rows[row + 1u]) != bitcast<u32>(params.grid_spacing_m)) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  let mechanical_family_id = u32(round(source_rows[row + 8u]));
  let material_id = u32(round(source_rows[row + 9u]));
  let identity_id = particle_identity[source_index * params.identity_stride_words];
  let continuity_domain_id = select(0u, identity_id, mechanical_family_id == 1u);
  field_store(descriptor, mechanical_family_id);
  field_store(descriptor + 1u, material_id);
  field_store(descriptor + 2u, continuity_domain_id);
  field_store(descriptor + 3u, 1u);

  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let grid_position = position * params.inv_grid_spacing_m;
  let base = vec3<i32>(floor(grid_position - vec3<f32>(0.5)));
  var candidate_ordinal = 0u;
  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let candidate_index = source_index * 27u + candidate_ordinal;
        candidate_ordinal = candidate_ordinal + 1u;
        let node_index = field_grid_index(base.x + ox, base.y + oy, base.z + oz);
        if (node_index >= params.grid_node_count) {
          field_write_invalid_candidate(candidate_index);
          field_record_clipped_candidate();
          continue;
        }
        let key = candidate_index * FIELD_RADIX_KEY_WORDS;
        candidate_keys[key] = node_index;
        candidate_keys[key + 1u] = (mechanical_family_id << 24u) | material_id;
        candidate_keys[key + 2u] = continuity_domain_id;
      }
    }
  }
}

fn field_unique_count_without_sentinel() -> u32 {
  if (arrayLength(&unique_evidence) < 8u) {
    return 0u;
  }
  let unique_count = unique_evidence[2u];
  if (unique_count == 0u || unique_count > params.field_capacity) {
    return unique_count;
  }
  let last = (unique_count - 1u) * FIELD_RADIX_KEY_WORDS;
  if (
    last <= arrayLength(&unique_keys)
    && FIELD_RADIX_KEY_WORDS <= arrayLength(&unique_keys) - last
    && unique_keys[last] == FIELD_INVALID_KEY
    && unique_keys[last + 1u] == FIELD_INVALID_KEY
    && unique_keys[last + 2u] == FIELD_INVALID_KEY
  ) {
    return unique_count - 1u;
  }
  return unique_count;
}

fn field_key_strictly_less(left: u32, right: u32) -> bool {
  let left_base = left * FIELD_RADIX_KEY_WORDS;
  let right_base = right * FIELD_RADIX_KEY_WORDS;
  for (var word = 0u; word < FIELD_RADIX_KEY_WORDS; word = word + 1u) {
    let a = unique_keys[left_base + word];
    let b = unique_keys[right_base + word];
    if (a < b) { return true; }
    if (a > b) { return false; }
  }
  return false;
}

fn field_parent_find_node(node_index: u32) -> u32 {
  let node_count = parent_mechanics_view[46u];
  let node_offset = parent_mechanics_view[53u];
  if (
    node_index >= params.grid_node_count
    || node_offset > arrayLength(&parent_mechanics_view)
    || node_count > arrayLength(&parent_mechanics_view) - node_offset
  ) {
    return FIELD_INVALID_KEY;
  }
  var lower = 0u;
  var upper = node_count;
  loop {
    if (lower >= upper) { break; }
    let middle = lower + (upper - lower) / 2u;
    let candidate = parent_mechanics_view[node_offset + middle];
    if (candidate < node_index) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  if (
    lower < node_count
    && parent_mechanics_view[node_offset + lower] == node_index
  ) {
    return lower;
  }
  return FIELD_INVALID_KEY;
}

fn field_parent_contains_node(node_index: u32) -> bool {
  return field_parent_find_node(node_index) != FIELD_INVALID_KEY;
}

@compute @workgroup_size(64)
fn materialize_stencil_field_indices(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let sorted_position = field_linear_invocation(
    local_id,
    workgroup_id,
    params.candidate_dispatch_x
  );
  if (
    sorted_position >= params.candidate_count
    || sorted_position >= arrayLength(&sorted_candidate_indices)
    || sorted_position >= arrayLength(&unique_group_by_sorted_position)
  ) {
    return;
  }
  let candidate_index = sorted_candidate_indices[sorted_position];
  if (candidate_index >= params.candidate_count) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let source_index = candidate_index / 27u;
  let stencil_ordinal = candidate_index - source_index * 27u;
  if (source_index >= params.source_count || stencil_ordinal >= 27u) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let candidate_key = candidate_index * FIELD_RADIX_KEY_WORDS;
  let destination = params.descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS + 4u + stencil_ordinal;
  if (candidate_keys[candidate_key] == FIELD_INVALID_KEY) {
    field_store(destination, FIELD_INVALID_KEY);
    return;
  }
  // The scan output is an exclusive prefix of unique-head flags, not the
  // group index at this sorted position.  Read the following prefix (or the
  // final unique count) to obtain the inclusive head count for every member
  // of the current group, then convert that count to a zero-based index.
  var inclusive_head_count = unique_evidence[2u];
  if (sorted_position + 1u < params.candidate_count) {
    inclusive_head_count = unique_group_by_sorted_position[sorted_position + 1u];
  }
  if (inclusive_head_count == 0u) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let field_index = inclusive_head_count - 1u;
  if (field_index >= params.field_capacity) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  field_store(destination, field_index);
}

@compute @workgroup_size(64)
fn assemble_field_keys(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let field_index = field_linear_invocation(
    local_id,
    workgroup_id,
    params.candidate_dispatch_x
  );
  let field_count = field_unique_count_without_sentinel();
  if (field_index >= field_count || field_index >= params.field_capacity) {
    return;
  }
  let source_key = field_index * FIELD_RADIX_KEY_WORDS;
  let node_index = unique_keys[source_key];
  let ordered = field_index == 0u
    || field_key_strictly_less(field_index - 1u, field_index);
  if (!ordered || !field_parent_contains_node(node_index)) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let packed_identity = unique_keys[source_key + 1u];
  let mechanical_family_id = packed_identity >> 24u;
  let material_id = packed_identity & FIELD_RADIX_MATERIAL_MASK;
  let continuity_domain_id = unique_keys[source_key + 2u];
  let identity_admitted = mechanical_family_id >= 1u
    && mechanical_family_id <= 4u
    && material_id >= 1u
    && material_id <= FIELD_RADIX_MATERIAL_MASK
    && ((mechanical_family_id << 24u) | material_id) == packed_identity
    && select(
      continuity_domain_id == 0u,
      continuity_domain_id != 0u,
      mechanical_family_id == 1u
    );
  if (!identity_admitted) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let destination_key = params.key_offset_words + field_index * FIELD_KEY_WORDS;
  field_store(destination_key, node_index);
  field_store(destination_key + 1u, mechanical_family_id);
  field_store(destination_key + 2u, material_id);
  field_store(destination_key + 3u, continuity_domain_id);
}

fn field_reject(flags: u32) {
  field_store(0u, FIELD_MAGIC);
  field_store(1u, FIELD_VERSION);
  field_store(2u, FIELD_STATUS_FAIL_CLOSED | flags);
  field_store(34u, 0u);
  field_store(
    37u,
    select(0u, 1u, (flags & FIELD_STATUS_CAPACITY_OVERFLOW) != 0u)
  );
  field_store(44u, 0u);
  field_store(45u, 0u);
  field_store(46u, 0u);
  for (var word = 50u; word < 60u; word = word + 1u) {
    field_store(word, 0u);
  }
  field_store(FIELD_DISPATCH_OFFSET_WORDS, 0u);
  field_store(FIELD_DISPATCH_OFFSET_WORDS + 1u, 0u);
  field_store(FIELD_DISPATCH_OFFSET_WORDS + 2u, 0u);
  field_store(63u, 0u);
}

fn field_layout_admitted() -> bool {
  let source_group_count = field_group_count(params.source_count);
  let candidate_group_count = field_group_count(params.candidate_count);
  let expected_source_dispatch_x = field_dispatch_x(source_group_count);
  let expected_candidate_dispatch_x = field_dispatch_x(candidate_group_count);
  return field_parent_admitted()
    && params.workgroup_size == 64u
    && params.stencil_size == 27u
    && params.dispatch_x_limit > 0u
    && params.source_dispatch_x == expected_source_dispatch_x
    && params.source_dispatch_y
      == field_dispatch_y(source_group_count, expected_source_dispatch_x)
    && params.source_dispatch_y <= params.dispatch_x_limit
    && params.candidate_dispatch_x == expected_candidate_dispatch_x
    && params.candidate_dispatch_y
      == field_dispatch_y(candidate_group_count, expected_candidate_dispatch_x)
    && params.candidate_dispatch_y <= params.dispatch_x_limit
    && params.key_words == FIELD_KEY_WORDS
    && params.descriptor_words == FIELD_DESCRIPTOR_WORDS
    && params.accumulator_words == FIELD_ACCUMULATOR_WORDS
    && params.state_words == FIELD_STATE_WORDS
    && params.capacity_words == params.state_offset_words
      + params.field_capacity * (
        FIELD_STATE_WORDS + FIELD_PRESSURE_WORDS
      )
    && params.capacity_words <= arrayLength(&field_view);
}

fn field_publish(
  field_count: u32,
  unique_generation: u32,
  unique_input_count: u32,
  unique_count: u32,
  unique_status: u32
) {
  let consumer_group_count = field_group_count(field_count);
  let dispatch_x = field_dispatch_x(consumer_group_count);
  let dispatch_y = field_dispatch_y(consumer_group_count, dispatch_x);
  let dispatch_z = select(0u, 1u, field_count > 0u);
  field_store(0u, FIELD_MAGIC);
  field_store(1u, FIELD_VERSION);
  field_store(2u, FIELD_STATUS_READY | FIELD_STATUS_ADMITTED);
  field_store(3u, params.generation_id);
  field_store(4u, params.device_ordinal);
  field_store(5u, params.lane_ordinal);
  field_store(6u, params.lease_token);
  field_store(7u, params.source_family_id);
  field_store(8u, params.storage_generation);
  field_store(9u, params.physics_tick);
  field_store(10u, params.physics_substep);
  field_store(11u, params.position_epoch);
  field_store(12u, params.topology_epoch);
  field_store(13u, params.chart_epoch);
  field_store(14u, params.level_epoch);
  field_store(15u, params.support_epoch);
  field_store(16u, params.source_count);
  field_store(17u, bitcast<u32>(params.selected_level));
  field_store(18u, params.grid_node_count);
  field_store(19u, params.grid_nx);
  field_store(20u, params.grid_ny);
  field_store(21u, params.grid_nz);
  field_store(22u, params.grid_shift);
  field_store(23u, bitcast<u32>(params.grid_spacing_m));
  field_store(24u, params.descriptor_offset_words);
  field_store(25u, params.descriptor_words);
  field_store(26u, params.key_offset_words);
  field_store(27u, params.key_words);
  field_store(28u, params.accumulator_offset_words);
  field_store(29u, params.accumulator_words);
  field_store(30u, params.state_offset_words);
  field_store(31u, params.state_words);
  field_store(32u, params.field_capacity);
  field_store(33u, params.candidate_count);
  field_store(34u, field_count);
  field_store(37u, 0u);
  field_store(38u, params.completion_ordinal);
  field_store(39u, params.source_row_layout_id);
  field_store(40u, params.identity_stride_words);
  let pressure_offset = params.state_offset_words
    + params.field_capacity * FIELD_STATE_WORDS;
  field_store(
    41u,
    pressure_offset + field_count * FIELD_PRESSURE_WORDS
  );
  field_store(42u, params.capacity_words);
  // Generation construction does not clear mechanics-owned accumulators.
  // The consumer clear pass publishes/observes that boundary separately.
  field_store(43u, 0u);
  let receipt_offset = params.state_offset_words - FIELD_RECEIPT_WORDS;
  for (var word = 0u; word < FIELD_RECEIPT_WORDS; word = word + 1u) {
    field_store(receipt_offset + word, 0u);
  }
  field_store(44u, dispatch_x);
  field_store(45u, dispatch_y);
  field_store(46u, dispatch_z);
  field_store(47u, PARENT_MAGIC);
  field_store(48u, PARENT_VERSION);
  field_store(49u, params.parent_node_capacity);
  field_store(50u, unique_generation);
  field_store(51u, unique_input_count);
  field_store(52u, unique_count);
  field_store(53u, unique_status);
  field_store(54u, params.source_count);
  field_store(55u, 1u);
  field_store(56u, 1u);
  field_store(57u, 1u);
  field_store(58u, 0u);
  field_store(59u, 0u);
  field_store(FIELD_DISPATCH_OFFSET_WORDS, dispatch_x);
  field_store(FIELD_DISPATCH_OFFSET_WORDS + 1u, dispatch_y);
  field_store(FIELD_DISPATCH_OFFSET_WORDS + 2u, dispatch_z);
  // Mutable mechanics operations authenticate every in-place transition with
  // this monotonically increasing generation-local ordinal. Word 38 retains
  // the immutable topology build completion ordinal.
  field_store(63u, 0u);
}

@compute @workgroup_size(1)
fn finalize_field_view() {
  if (
    !field_layout_admitted()
    || !field_parent_admitted()
  ) {
    field_reject(0u);
    return;
  }
  let unique_ready = arrayLength(&unique_evidence) >= 8u
    && unique_evidence[0u] == params.generation_id
    && unique_evidence[1u] == params.candidate_count
    && unique_evidence[3u] == FIELD_UNIQUE_STATUS_READY
    && unique_evidence[4u] == 0u
    && unique_evidence[5u] == FIELD_RADIX_KEY_WORDS
    && unique_evidence[6u] == FIELD_RADIX_KEY_WORDS
    && unique_evidence[7u] == 1u;
  let field_count = field_unique_count_without_sentinel();
  if (field_count > params.field_capacity) {
    field_reject(FIELD_STATUS_CAPACITY_OVERFLOW);
    return;
  }
  if (!unique_ready) {
    field_reject(0u);
    return;
  }
  if (field_load(35u) != 0u || field_load(58u) != 0u) {
    field_reject(FIELD_STATUS_INVALID_SOURCE);
    return;
  }
  field_publish(
    field_count,
    unique_evidence[0u],
    unique_evidence[1u],
    unique_evidence[2u],
    unique_evidence[3u]
  );
}
`;

function replaceV2Required(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`unable to derive mechanics-field v2 WGSL: ${label}`);
  }
  return source.replace(search, replacement);
}

function createSchroederSpatialMechanicsFieldViewV2Wgsl() {
  let source = schroederSpatialMechanicsFieldViewWgsl;
  source = replaceV2Required(
    source,
    '  reserved_dispatch0: u32,',
    '  source_authority_version: u32,',
    'source authority parameter'
  );
  source = replaceV2Required(
    source,
    '@group(0) @binding(9) var<storage, read> unique_group_by_sorted_position: array<u32>;',
    `@group(0) @binding(9) var<storage, read> unique_group_by_sorted_position: array<u32>;
@group(0) @binding(10) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(11) var<storage, read> active_source_view: array<u32>;`,
    'directory and active-source bindings'
  );
  source = replaceV2Required(
    source,
    'const PARENT_VERSION: u32 = 1u;',
    `const PARENT_VERSION: u32 = 1u;
const SOURCE_AUTHORITY_V2: u32 = 2u;
const SPATIAL_MAGIC: u32 = 0x53534531u;
const SPATIAL_VERSION_V2: u32 = 2u;
const SPATIAL_READY_ADMITTED: u32 = 3u;
const SPATIAL_REJECTED_MASK: u32 = 28u;
const SPATIAL_PRIMITIVE_READY: u32 = 1u;
const SPATIAL_PRIMITIVE_FAIL_CLOSED: u32 = 4u;
const SPATIAL_SORT_LEXICOGRAPHIC_U32X5: u32 = 2u;
const SPATIAL_REVERSE_CELL_PLUS_ONE: u32 = 1u;
const ACTIVE_SOURCE_MAGIC: u32 = 0x53535631u;
const ACTIVE_SOURCE_VERSION: u32 = 1u;
const ACTIVE_SOURCE_READY_ADMITTED: u32 = 3u;
const ACTIVE_SOURCE_REJECTED_MASK: u32 = 252u;
const ACTIVE_SOURCE_HEADER_WORDS: u32 = 64u;
const ACTIVE_SOURCE_MISSING: u32 = 0xffffffffu;
const ACTIVE_SOURCE_COUNT_WORD: u32 = 18u;
const ACTIVE_SOURCE_CANDIDATE_COUNT_WORD: u32 = 43u;
const ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD: u32 = 48u;
const ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD: u32 = 51u;
const ACTIVE_SOURCE_COMPLETION_WORD: u32 = 30u;
const ACTIVE_SOURCE_SEAL_WORD: u32 = 47u;`,
    'v2 authority constants'
  );
  source = replaceV2Required(
    source,
    `fn field_record_invalid_source() {
  atomicAdd(&field_view[35u], 1u);
}`,
    `fn field_record_invalid_source() {
  atomicAdd(&field_view[35u], 1u);
}

fn field_range_within(start: u32, count: u32, limit: u32) -> bool {
  return start <= limit && count <= limit - start;
}

fn field_signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn field_active_source_view_admitted() -> bool {
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < ACTIVE_SOURCE_HEADER_WORDS) {
    return false;
  }
  let status = active_source_view[2u];
  let physical_count = active_source_view[16u];
  let physical_capacity = active_source_view[17u];
  let active_count = active_source_view[ACTIVE_SOURCE_COUNT_WORD];
  let active_capacity = active_source_view[19u];
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let capacity_words = active_source_view[27u];
  return params.source_authority_version == SOURCE_AUTHORITY_V2
    && active_source_view[0u] == ACTIVE_SOURCE_MAGIC
    && active_source_view[1u] == ACTIVE_SOURCE_VERSION
    && (status & ACTIVE_SOURCE_READY_ADMITTED) == ACTIVE_SOURCE_READY_ADMITTED
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
    && physical_count == params.source_count
    && physical_capacity == params.source_capacity
    && active_count <= active_capacity
    && active_capacity <= physical_capacity
    && active_source_view[20u] == physical_count - active_count
    && active_source_view[21u] == 0u
    && active_source_view[22u] == 0u
    && active_source_view[23u] == SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    && active_source_view[24u] == params.source_stride_floats
    && active_to_physical == ACTIVE_SOURCE_HEADER_WORDS
    && physical_to_active == active_to_physical + active_capacity
    && capacity_words == physical_to_active + physical_capacity
    && capacity_words <= bound_words
    && active_source_view[29u] == params.completion_ordinal
    && active_source_view[ACTIVE_SOURCE_COMPLETION_WORD]
      == params.completion_ordinal
    && active_source_view[32u] == physical_count
    && active_source_view[33u] == active_count
    && active_source_view[34u] == active_count
    && active_source_view[35u] == active_count
    && active_source_view[36u] <= physical_count
    && active_source_view[37u] == params.workgroup_size
    && active_source_view[38u] == params.dispatch_x_limit
    && active_source_view[40u] == ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD
    && active_source_view[41u] == ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD
    && active_source_view[ACTIVE_SOURCE_CANDIDATE_COUNT_WORD]
      == active_count * 27u
    && active_source_view[44u] == active_capacity * 27u
    && active_source_view[ACTIVE_SOURCE_SEAL_WORD] != 0u;
}

fn field_active_source_count() -> u32 {
  return select(
    0u,
    active_source_view[ACTIVE_SOURCE_COUNT_WORD],
    field_active_source_view_admitted()
  );
}

fn field_active_candidate_count() -> u32 {
  return select(
    0u,
    active_source_view[ACTIVE_SOURCE_CANDIDATE_COUNT_WORD],
    field_active_source_view_admitted()
  );
}

fn field_physical_source_for_active(active_ordinal: u32) -> u32 {
  let active_count = field_active_source_count();
  if (active_ordinal >= active_count) {
    return ACTIVE_SOURCE_MISSING;
  }
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let physical_source = active_source_view[active_to_physical + active_ordinal];
  if (
    physical_source >= params.source_count
    || active_source_view[physical_to_active + physical_source]
      != active_ordinal
  ) {
    return ACTIVE_SOURCE_MISSING;
  }
  return physical_source;
}

fn field_spatial_directory_admitted() -> bool {
  let bound_words = arrayLength(&spatial_directory);
  if (bound_words < 48u || !field_active_source_view_admitted()) {
    return false;
  }
  let status = spatial_directory[2u];
  let physical_count = spatial_directory[16u];
  let physical_capacity = spatial_directory[17u];
  let cell_count = spatial_directory[18u];
  let cell_capacity = spatial_directory[19u];
  let directory_capacity = spatial_directory[22u];
  let active_count = spatial_directory[37u];
  let cell_keys = spatial_directory[29u];
  let cell_offsets = spatial_directory[30u];
  let cell_members = spatial_directory[31u];
  let physical_reverse = spatial_directory[32u];
  let physical_upper = spatial_directory[47u];
  let build_ordinal = spatial_directory[33u];
  let primitive_status = spatial_directory[41u];
  let consumer_group_count = (cell_count + 63u) / 64u;
  let consumer_dispatch_x = spatial_directory[42u];
  let consumer_dispatch_y = spatial_directory[43u];
  let consumer_dispatch_z = spatial_directory[44u];
  let consumer_dispatch_admitted = select(
    consumer_dispatch_x > 0u
      && consumer_dispatch_x <= consumer_group_count
      && consumer_dispatch_y
        == field_dispatch_y(consumer_group_count, consumer_dispatch_x)
      && consumer_dispatch_z == 1u,
    consumer_dispatch_x == 0u
      && consumer_dispatch_y == 0u
      && consumer_dispatch_z == 0u,
    cell_count == 0u
  );
  return spatial_directory[0u] == SPATIAL_MAGIC
    && spatial_directory[1u] == SPATIAL_VERSION_V2
    && (status & SPATIAL_READY_ADMITTED) == SPATIAL_READY_ADMITTED
    && (status & SPATIAL_REJECTED_MASK) == 0u
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
    && physical_capacity == params.source_capacity
    && active_count == field_active_source_count()
    && active_count <= physical_count
    && cell_count <= active_count
    && (active_count == 0u || cell_count > 0u)
    && cell_count <= cell_capacity
    && cell_capacity <= active_source_view[19u]
    && spatial_directory[20u] == spatial_directory[21u]
    && directory_capacity <= bound_words
    && physical_upper <= directory_capacity
    && spatial_directory[23u] == 0u
    && spatial_directory[24u] == 0u
    && spatial_directory[25u] == 5u
    && spatial_directory[26u] == 5u
    && spatial_directory[27u] == SPATIAL_SORT_LEXICOGRAPHIC_U32X5
    && spatial_directory[28u] == 48u
    && cell_keys == 48u
    && cell_offsets == cell_keys + cell_capacity * 5u
    && cell_members == cell_offsets + cell_capacity + 1u
    && physical_reverse == cell_members + physical_capacity
    && build_ordinal == params.completion_ordinal
    && spatial_directory[34u] == build_ordinal
    && spatial_directory[35u] == build_ordinal
    && spatial_directory[36u] == params.generation_id
    && spatial_directory[38u] == cell_count
    && spatial_directory[39u] != 0u
    && spatial_directory[40u] == 0u
    && (primitive_status & SPATIAL_PRIMITIVE_READY) != 0u
    && (primitive_status & SPATIAL_PRIMITIVE_FAIL_CLOSED) == 0u
    && consumer_dispatch_admitted
    && spatial_directory[46u] == 2u
    && field_range_within(cell_keys, cell_count * 5u, physical_upper)
    && field_range_within(cell_offsets, cell_count + 1u, physical_upper)
    && field_range_within(cell_members, active_count, physical_upper)
    && field_range_within(
      physical_reverse,
      physical_capacity,
      physical_upper
    )
    && spatial_directory[cell_offsets] == 0u
    && spatial_directory[cell_offsets + cell_count] == active_count;
}

fn field_spatial_membership_admitted(physical_source: u32) -> bool {
  if (
    physical_source >= params.source_count
    || !field_spatial_directory_admitted()
  ) {
    return false;
  }
  let cell_count = spatial_directory[18u];
  let cell_offsets = spatial_directory[30u];
  let reverse = spatial_directory[32u];
  let active_count = spatial_directory[37u];
  let cell_plus_one = spatial_directory[reverse + physical_source];
  if (cell_plus_one == 0u) {
    return false;
  }
  let cell_index = cell_plus_one - 1u;
  if (cell_index >= cell_count) {
    return false;
  }
  let begin = spatial_directory[cell_offsets + cell_index];
  let end = spatial_directory[cell_offsets + cell_index + 1u];
  if (begin >= end || end > active_count) {
    return false;
  }
  let row = physical_source * params.source_stride_floats;
  let spacing = source_rows[row + 1u];
  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let cell_f = floor(position / spacing);
  let cell_i32_min = -2147483520.0;
  let cell_i32_max = 2147483520.0;
  if (
    !field_integral_f32(source_rows[row])
    || !field_integral_f32(source_rows[row + 15u])
    || !field_finite_f32(spacing)
    || !(spacing > 0.0)
    || !all(vec3<bool>(
      field_finite_f32(cell_f.x),
      field_finite_f32(cell_f.y),
      field_finite_f32(cell_f.z)
    ))
    || !all(vec3<bool>(
      cell_f.x >= cell_i32_min && cell_f.x <= cell_i32_max,
      cell_f.y >= cell_i32_min && cell_f.y <= cell_i32_max,
      cell_f.z >= cell_i32_min && cell_f.z <= cell_i32_max
    ))
  ) {
    return false;
  }
  let key = spatial_directory[29u] + cell_index * 5u;
  return spatial_directory[key] == u32(round(source_rows[row + 15u]))
    && spatial_directory[key + 1u]
      == field_signed_order_key(i32(round(source_rows[row])))
    && spatial_directory[key + 2u]
      == field_signed_order_key(i32(cell_f.x))
    && spatial_directory[key + 3u]
      == field_signed_order_key(i32(cell_f.y))
    && spatial_directory[key + 4u]
      == field_signed_order_key(i32(cell_f.z));
}`,
    'v2 authority helpers'
  );
  source = replaceV2Required(
    source,
    `@compute @workgroup_size(64)
fn emit_field_candidates(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let source_index = field_linear_invocation(
    local_id,
    workgroup_id,
    params.source_dispatch_x
  );
  if (source_index >= params.source_count) {
    return;
  }
  let descriptor = params.descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS;
  if (!field_parent_admitted() || !field_source_admitted(source_index)) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  let row = source_index * params.source_stride_floats;
  // Fixed-capacity product and phase-companion rows remain present while
  // empty. They are valid storage, but not mechanical sources.
  if (!(source_rows[row + 6u] > 0.0)) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  let level = i32(round(source_rows[row]));
  if (level != params.selected_level) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  if (bitcast<u32>(source_rows[row + 1u]) != bitcast<u32>(params.grid_spacing_m)) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(source_index * 27u + candidate_ordinal);
    }
    return;
  }
  let mechanical_family_id = u32(round(source_rows[row + 8u]));
  let material_id = u32(round(source_rows[row + 9u]));
  let identity_id = particle_identity[source_index * params.identity_stride_words];
  let continuity_domain_id = select(0u, identity_id, mechanical_family_id == 1u);
  field_store(descriptor, mechanical_family_id);
  field_store(descriptor + 1u, material_id);
  field_store(descriptor + 2u, continuity_domain_id);
  field_store(descriptor + 3u, 1u);

  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let grid_position = position * params.inv_grid_spacing_m;
  let base = vec3<i32>(floor(grid_position - vec3<f32>(0.5)));
  var candidate_ordinal = 0u;
  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let candidate_index = source_index * 27u + candidate_ordinal;
        candidate_ordinal = candidate_ordinal + 1u;
        let node_index = field_grid_index(base.x + ox, base.y + oy, base.z + oz);
        if (node_index >= params.grid_node_count) {
          field_write_invalid_candidate(candidate_index);
          field_record_clipped_candidate();
          continue;
        }
        let key = candidate_index * FIELD_RADIX_KEY_WORDS;
        candidate_keys[key] = node_index;
        candidate_keys[key + 1u] = (mechanical_family_id << 24u) | material_id;
        candidate_keys[key + 2u] = continuity_domain_id;
      }
    }
  }
}`,
    `@compute @workgroup_size(64)
fn emit_field_candidates_v2(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let active_ordinal = field_linear_invocation(
    local_id,
    workgroup_id,
    active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD]
  );
  let active_count = field_active_source_count();
  if (active_ordinal >= active_count) {
    return;
  }
  let source_index = field_physical_source_for_active(active_ordinal);
  if (source_index == ACTIVE_SOURCE_MISSING) {
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(active_ordinal * 27u + candidate_ordinal);
    }
    return;
  }
  let descriptor = params.descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS;
  if (
    !field_parent_admitted()
    || !field_source_admitted(source_index)
    || !field_spatial_membership_admitted(source_index)
  ) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(active_ordinal * 27u + candidate_ordinal);
    }
    return;
  }
  let row = source_index * params.source_stride_floats;
  let level = i32(round(source_rows[row]));
  // ActiveSource is generation-global while one mechanics field is
  // level-local. Valid empty rows and valid rows from another level are
  // therefore non-selected work, not malformed field input.
  if (!(source_rows[row + 6u] > 0.0) || level != params.selected_level) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(active_ordinal * 27u + candidate_ordinal);
    }
    return;
  }
  if (
    bitcast<u32>(source_rows[row + 1u])
      != bitcast<u32>(params.grid_spacing_m)
  ) {
    field_store(descriptor, 0u);
    field_store(descriptor + 1u, 0u);
    field_store(descriptor + 2u, 0u);
    field_store(descriptor + 3u, 0u);
    field_record_invalid_source();
    for (var candidate_ordinal = 0u; candidate_ordinal < 27u; candidate_ordinal = candidate_ordinal + 1u) {
      field_write_invalid_candidate(active_ordinal * 27u + candidate_ordinal);
    }
    return;
  }
  let mechanical_family_id = u32(round(source_rows[row + 8u]));
  let material_id = u32(round(source_rows[row + 9u]));
  let identity_id = particle_identity[source_index * params.identity_stride_words];
  let continuity_domain_id = select(0u, identity_id, mechanical_family_id == 1u);
  field_store(descriptor, mechanical_family_id);
  field_store(descriptor + 1u, material_id);
  field_store(descriptor + 2u, continuity_domain_id);
  field_store(descriptor + 3u, 1u);

  let position = vec3<f32>(
    source_rows[row + 12u],
    source_rows[row + 13u],
    source_rows[row + 14u]
  );
  let grid_position = position * params.inv_grid_spacing_m;
  let base = vec3<i32>(floor(grid_position - vec3<f32>(0.5)));
  var candidate_ordinal = 0u;
  for (var ox = 0i; ox < 3i; ox = ox + 1i) {
    for (var oy = 0i; oy < 3i; oy = oy + 1i) {
      for (var oz = 0i; oz < 3i; oz = oz + 1i) {
        let candidate_index = active_ordinal * 27u + candidate_ordinal;
        candidate_ordinal = candidate_ordinal + 1u;
        let node_index = field_grid_index(base.x + ox, base.y + oy, base.z + oz);
        if (node_index >= params.grid_node_count) {
          field_write_invalid_candidate(candidate_index);
          field_record_clipped_candidate();
          continue;
        }
        let key = candidate_index * FIELD_RADIX_KEY_WORDS;
        candidate_keys[key] = node_index;
        candidate_keys[key + 1u] = (mechanical_family_id << 24u) | material_id;
        candidate_keys[key + 2u] = continuity_domain_id;
      }
    }
  }
}`,
    'v2 active candidate emission'
  );
  source = replaceV2Required(
    source,
    `@compute @workgroup_size(64)
fn materialize_stencil_field_indices(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let sorted_position = field_linear_invocation(
    local_id,
    workgroup_id,
    params.candidate_dispatch_x
  );
  if (
    sorted_position >= params.candidate_count
    || sorted_position >= arrayLength(&sorted_candidate_indices)
    || sorted_position >= arrayLength(&unique_group_by_sorted_position)
  ) {
    return;
  }
  let candidate_index = sorted_candidate_indices[sorted_position];
  if (candidate_index >= params.candidate_count) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let source_index = candidate_index / 27u;
  let stencil_ordinal = candidate_index - source_index * 27u;
  if (source_index >= params.source_count || stencil_ordinal >= 27u) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let candidate_key = candidate_index * FIELD_RADIX_KEY_WORDS;
  let destination = params.descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS + 4u + stencil_ordinal;
  if (candidate_keys[candidate_key] == FIELD_INVALID_KEY) {
    field_store(destination, FIELD_INVALID_KEY);
    return;
  }
  // The scan output is an exclusive prefix of unique-head flags, not the
  // group index at this sorted position.  Read the following prefix (or the
  // final unique count) to obtain the inclusive head count for every member
  // of the current group, then convert that count to a zero-based index.
  var inclusive_head_count = unique_evidence[2u];
  if (sorted_position + 1u < params.candidate_count) {
    inclusive_head_count = unique_group_by_sorted_position[sorted_position + 1u];
  }
  if (inclusive_head_count == 0u) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let field_index = inclusive_head_count - 1u;
  if (field_index >= params.field_capacity) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  field_store(destination, field_index);
}`,
    `@compute @workgroup_size(64)
fn materialize_stencil_field_indices_v2(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let candidate_count = field_active_candidate_count();
  let sorted_position = field_linear_invocation(
    local_id,
    workgroup_id,
    active_source_view[ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD]
  );
  if (
    sorted_position >= candidate_count
    || sorted_position >= arrayLength(&sorted_candidate_indices)
    || sorted_position >= arrayLength(&unique_group_by_sorted_position)
  ) {
    return;
  }
  let candidate_index = sorted_candidate_indices[sorted_position];
  if (candidate_index >= candidate_count) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let active_ordinal = candidate_index / 27u;
  let stencil_ordinal = candidate_index - active_ordinal * 27u;
  let source_index = field_physical_source_for_active(active_ordinal);
  if (source_index == ACTIVE_SOURCE_MISSING || stencil_ordinal >= 27u) {
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let candidate_key = candidate_index * FIELD_RADIX_KEY_WORDS;
  let destination = params.descriptor_offset_words
    + source_index * FIELD_DESCRIPTOR_WORDS + 4u + stencil_ordinal;
  if (candidate_keys[candidate_key] == FIELD_INVALID_KEY) {
    field_store(destination, FIELD_INVALID_KEY);
    return;
  }
  var inclusive_head_count = unique_evidence[2u];
  if (sorted_position + 1u < candidate_count) {
    inclusive_head_count = unique_group_by_sorted_position[sorted_position + 1u];
  }
  if (inclusive_head_count == 0u) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  let field_index = inclusive_head_count - 1u;
  if (field_index >= params.field_capacity) {
    field_store(destination, FIELD_INVALID_KEY);
    atomicAdd(&field_view[58u], 1u);
    return;
  }
  field_store(destination, field_index);
}`,
    'v2 physical stencil destinations'
  );
  source = replaceV2Required(
    source,
    'fn assemble_field_keys(',
    'fn assemble_field_keys_v2(',
    'v2 assemble entry point'
  );
  source = replaceV2Required(
    source,
    `    params.candidate_dispatch_x
  );
  let field_count = field_unique_count_without_sentinel();`,
    `    active_source_view[ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD]
  );
  let field_count = field_unique_count_without_sentinel();`,
    'v2 assemble indirect linearization'
  );
  source = replaceV2Required(
    source,
    `fn field_layout_admitted() -> bool {
  let source_group_count = field_group_count(params.source_count);
  let candidate_group_count = field_group_count(params.candidate_count);
  let expected_source_dispatch_x = field_dispatch_x(source_group_count);
  let expected_candidate_dispatch_x = field_dispatch_x(candidate_group_count);
  return field_parent_admitted()
    && params.workgroup_size == 64u
    && params.stencil_size == 27u
    && params.dispatch_x_limit > 0u
    && params.source_dispatch_x == expected_source_dispatch_x
    && params.source_dispatch_y
      == field_dispatch_y(source_group_count, expected_source_dispatch_x)
    && params.source_dispatch_y <= params.dispatch_x_limit
    && params.candidate_dispatch_x == expected_candidate_dispatch_x
    && params.candidate_dispatch_y
      == field_dispatch_y(candidate_group_count, expected_candidate_dispatch_x)
    && params.candidate_dispatch_y <= params.dispatch_x_limit
    && params.key_words == FIELD_KEY_WORDS
    && params.descriptor_words == FIELD_DESCRIPTOR_WORDS
    && params.accumulator_words == FIELD_ACCUMULATOR_WORDS
    && params.state_words == FIELD_STATE_WORDS
    && params.capacity_words == params.state_offset_words
      + params.field_capacity * (
        FIELD_STATE_WORDS + FIELD_PRESSURE_WORDS
      )
    && params.capacity_words <= arrayLength(&field_view);
}`,
    `fn field_layout_admitted() -> bool {
  let source_group_count = field_group_count(field_active_source_count());
  let candidate_group_count = field_group_count(field_active_candidate_count());
  let source_dispatch_x = active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD];
  let source_dispatch_y = active_source_view[
    ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD + 1u
  ];
  let source_dispatch_z = active_source_view[
    ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD + 2u
  ];
  let candidate_dispatch_x = active_source_view[
    ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD
  ];
  let candidate_dispatch_y = active_source_view[
    ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD + 1u
  ];
  let candidate_dispatch_z = active_source_view[
    ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD + 2u
  ];
  return field_parent_admitted()
    && field_active_source_view_admitted()
    && field_spatial_directory_admitted()
    && params.workgroup_size == 64u
    && params.stencil_size == 27u
    && params.dispatch_x_limit > 0u
    && source_dispatch_x == field_dispatch_x(source_group_count)
    && source_dispatch_y
      == select(
        1u,
        field_dispatch_y(source_group_count, max(source_dispatch_x, 1u)),
        field_active_source_count() > 0u
      )
    && source_dispatch_z == 1u
    && candidate_dispatch_x == field_dispatch_x(candidate_group_count)
    && candidate_dispatch_y
      == select(
        1u,
        field_dispatch_y(candidate_group_count, max(candidate_dispatch_x, 1u)),
        field_active_candidate_count() > 0u
      )
    && candidate_dispatch_z == 1u
    && params.key_words == FIELD_KEY_WORDS
    && params.descriptor_words == FIELD_DESCRIPTOR_WORDS
    && params.accumulator_words == FIELD_ACCUMULATOR_WORDS
    && params.state_words == FIELD_STATE_WORDS
    && params.candidate_count == params.source_count * 27u
    && params.capacity_words == params.state_offset_words
      + params.field_capacity * (
        FIELD_STATE_WORDS + FIELD_PRESSURE_WORDS
      )
    && params.capacity_words <= arrayLength(&field_view);
}`,
    'v2 layout admission'
  );
  source = source.replaceAll(
    'field_store(33u, params.candidate_count);',
    'field_store(33u, field_active_candidate_count());'
  );
  source = replaceV2Required(
    source,
    `    && unique_evidence[1u] == params.candidate_count`,
    `    && unique_evidence[1u] == field_active_candidate_count()`,
    'v2 GPU-count evidence'
  );
  source = replaceV2Required(
    source,
    `    && unique_evidence[7u] == 1u;`,
    `    && unique_evidence[7u] == 3u;`,
    'v2 GPU-count ready-admitted status'
  );
  return source;
}

export const schroederSpatialMechanicsFieldViewV2Wgsl =
  createSchroederSpatialMechanicsFieldViewV2Wgsl();
