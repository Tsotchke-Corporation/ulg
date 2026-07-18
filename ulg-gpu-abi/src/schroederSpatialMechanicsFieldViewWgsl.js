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
  route_control_words: u32,
  route_dispatch_offset_words: u32,
  route_dispatch_count: u32,
  radix_gate_offset_words: u32,
  radix_gate_count: u32,
  route_capacity_words: u32,
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

const FIELD_MAGIC: u32 = 0x53464632u;
const FIELD_VERSION: u32 = 2u;
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
const FIELD_RECEIPT_WORDS: u32 = 16u;
const FIELD_STATE_WORDS: u32 = 8u;
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
fn emit_field_candidates(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let source_index = global_id.x;
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
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let sorted_position = global_id.x;
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
fn assemble_field_keys(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let field_index = global_id.x;
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
  return field_parent_admitted()
    && params.stencil_size == 27u
    && params.key_words == FIELD_KEY_WORDS
    && params.descriptor_words == FIELD_DESCRIPTOR_WORDS
    && params.accumulator_words == FIELD_ACCUMULATOR_WORDS
    && params.state_words == FIELD_STATE_WORDS
    && params.capacity_words <= arrayLength(&field_view);
}

fn field_publish(
  field_count: u32,
  unique_generation: u32,
  unique_input_count: u32,
  unique_count: u32,
  unique_status: u32
) {
  let dispatch_x = field_count / params.workgroup_size
    + select(0u, 1u, field_count % params.workgroup_size != 0u);
  let dispatch_yz = select(0u, 1u, field_count > 0u);
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
  field_store(41u, params.state_offset_words + field_count * FIELD_STATE_WORDS);
  field_store(42u, params.capacity_words);
  // Generation construction does not clear mechanics-owned accumulators.
  // The consumer clear pass publishes/observes that boundary separately.
  field_store(43u, 0u);
  let receipt_offset = params.state_offset_words - FIELD_RECEIPT_WORDS;
  for (var word = 0u; word < FIELD_RECEIPT_WORDS; word = word + 1u) {
    field_store(receipt_offset + word, 0u);
  }
  field_store(44u, dispatch_x);
  field_store(45u, dispatch_yz);
  field_store(46u, dispatch_yz);
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
  field_store(FIELD_DISPATCH_OFFSET_WORDS + 1u, dispatch_yz);
  field_store(FIELD_DISPATCH_OFFSET_WORDS + 2u, dispatch_yz);
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
