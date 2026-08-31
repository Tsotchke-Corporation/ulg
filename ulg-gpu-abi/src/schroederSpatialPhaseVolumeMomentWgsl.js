import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_MAGIC,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_CLIPPED_STENCIL,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_IDENTITY_MISMATCH,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_VERSION,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_WORKGROUP_SIZE
} from './schroederSpatialPhaseVolumeMoment.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION
} from './schroederSpatialMechanicsFieldView.js';

function u32(value) {
  return `${Number(value) >>> 0}u`;
}

/**
 * Emit the additive S9-A diagnostic sidecar.  It deliberately consumes the
 * completed mechanics-field topology as read-only input: no mechanics-field
 * accumulator, P2G, grid, closure, particle, phase, or renderer binding is
 * writable from this module.
 */
export function createSchroederSpatialPhaseVolumeMomentWgsl(layout, {
  sourceAuthorityVersion =
    SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1
} = {}) {
  if (
    !layout
    || layout.controlWords !== SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS
    || layout.momentRowWords !== SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS
    || layout.sourceCapacity < 1
    || layout.fieldCapacity < 1
    || layout.candidateCapacity !== layout.sourceCapacity * 27
    || layout.momentWords !== layout.fieldCapacity * layout.momentRowWords
    || layout.fieldRangeWords !== layout.fieldCapacity * 2
    || layout.candidateFieldOffsetWords !== 0
    || layout.fieldRangeOffsetWords !== layout.candidateCapacity
    || layout.scratchWords !== layout.candidateCapacity + layout.fieldRangeWords
    || layout.candidateContributionStrideFloats !== 4
    || layout.candidateContributionFloats !== layout.candidateCapacity * 4
  ) {
    throw new TypeError('phase-volume moment sidecar layout is not canonical');
  }
  const directoryV2 =
    sourceAuthorityVersion
      === SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2;
  if (
    !directoryV2
    && sourceAuthorityVersion
      !== SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1
  ) {
    throw new RangeError(
      'phase-volume moment WGSL requires the exact v1 or v2 source authority'
    );
  }
  return /* wgsl */ `
struct PhaseVolumeMomentParams {
  source_count: u32,
  source_capacity: u32,
  field_capacity: u32,
  candidate_count: u32,
  selected_level: i32,
  grid_node_count: u32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
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
  assignment_stride_floats: u32,
  mechanics_stride_floats: u32,
  raw_volume_ratio_j_word: u32,
  raw_rest_volume_word: u32,
  source_row_layout_id: u32,
  reserved0: u32,
  reserved1: u32,
  reserved2: u32,
  reserved3: u32,
  reserved4: u32,
};

@group(0) @binding(0) var<storage, read> assignment_rows: array<f32>;
@group(0) @binding(1) var<storage, read> mechanics_rows: array<f32>;
@group(0) @binding(2) var<storage, read> mechanics_field: array<u32>;
@group(0) @binding(3) var<storage, read> sorted_candidate_indices: array<u32>;
@group(0) @binding(4) var<storage, read_write> candidate_contributions: array<vec4<f32>>;
// The first candidate-capacity words contain field indices by stable sorted
// position.  The fixed tail contains two u32 range endpoints per field.
// One scratch binding preserves the portable eight-storage-binding floor.
@group(0) @binding(5) var<storage, read_write> scratch_words: array<u32>;
@group(0) @binding(6) var<storage, read_write> control: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> moment_rows: array<u32>;
@group(0) @binding(8) var<uniform> params: PhaseVolumeMomentParams;
${directoryV2
    ? '@group(0) @binding(9) var<storage, read> active_source_view: array<u32>;'
    : ''}

const MOMENT_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_MAGIC)};
const MOMENT_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_VERSION)};
const MOMENT_HEADER_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS)};
const MOMENT_ROW_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS)};
const MOMENT_SOURCE_CAPACITY: u32 = ${u32(layout.sourceCapacity)};
const MOMENT_FIELD_CAPACITY: u32 = ${u32(layout.fieldCapacity)};
const MOMENT_CANDIDATE_CAPACITY: u32 = ${u32(layout.candidateCapacity)};
const MOMENT_WORD_CAPACITY: u32 = ${u32(layout.momentWords)};
const MOMENT_STATUS_READY: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY)};
const MOMENT_STATUS_ADMITTED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED)};
const MOMENT_STATUS_FAIL_CLOSED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_FAIL_CLOSED)};
const MOMENT_STATUS_INVALID_SOURCE: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_INVALID_SOURCE)};
const MOMENT_STATUS_IDENTITY_MISMATCH: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_IDENTITY_MISMATCH)};
const MOMENT_STATUS_CLIPPED_STENCIL: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_CLIPPED_STENCIL)};
const MOMENT_STATUS_CAPACITY_OVERFLOW: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_CAPACITY_OVERFLOW)};
const MOMENT_WORKGROUP_SIZE: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_WORKGROUP_SIZE)};
const INVALID_FIELD: u32 = 0xffffffffu;
const FIELD_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC)};
const FIELD_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION)};
const FIELD_READY_ADMITTED: u32 = 3u;
const FIELD_HEADER_WORDS: u32 = 64u;
const FIELD_DESCRIPTOR_WORDS: u32 = 32u;
const FIELD_KEY_WORDS: u32 = 4u;
const FIELD_STENCIL_SIZE: u32 = 27u;
const FIELD_STATUS_INVALID_SOURCE: u32 = 8u;
const FIELD_STATUS_CAPACITY_OVERFLOW: u32 = 16u;
const SOURCE_LAYOUT_LEVEL_ASSIGNMENT: u32 = 1u;
const ASSIGNMENT_STRIDE: u32 = 16u;
const MECHANICS_STRIDE: u32 = 32u;
const RAW_VOLUME_RATIO_J_WORD: u32 = 18u;
const RAW_REST_VOLUME_WORD: u32 = 19u;
const FIELD_DESCRIPTOR_ACTIVE_WORD: u32 = 3u;
const F32_I32_MIN: f32 = -2147483648.0;
const F32_I32_EXCLUSIVE_MAX: f32 = 2147483648.0;
const CONTROL_INVALID_RAW_VOLUME: u32 = 37u;
const CONTROL_INVALID_LINEAGE: u32 = 38u;
const CONTROL_CLIPPED_CANDIDATES: u32 = 39u;
const CONTROL_CONTRIBUTION_COUNT: u32 = 40u;
const CONTROL_ZEROED_FIELD_COUNT: u32 = 41u;
${directoryV2
    ? `
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
const ACTIVE_SOURCE_SEAL_WORD: u32 = 47u;

fn group_count(count: u32) -> u32 {
  return count / MOMENT_WORKGROUP_SIZE
    + select(0u, 1u, count % MOMENT_WORKGROUP_SIZE != 0u);
}

fn dispatch_shape_admitted(count: u32, offset: u32) -> bool {
  let groups = group_count(count);
  let dispatch_x = active_source_view[offset];
  let dispatch_y = active_source_view[offset + 1u];
  let dispatch_z = active_source_view[offset + 2u];
  if (count == 0u) {
    return dispatch_x == 0u && dispatch_y == 1u && dispatch_z == 1u;
  }
  if (
    dispatch_x == 0u
    || dispatch_x > groups
    || dispatch_y == 0u
    || dispatch_z != 1u
  ) {
    return false;
  }
  return dispatch_y == groups / dispatch_x
    + select(0u, 1u, groups % dispatch_x != 0u);
}

fn active_source_view_admitted() -> bool {
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < ACTIVE_SOURCE_HEADER_WORDS) { return false; }
  let status = active_source_view[2u];
  let physical_count = active_source_view[16u];
  let physical_capacity = active_source_view[17u];
  let active_count = active_source_view[ACTIVE_SOURCE_COUNT_WORD];
  let active_capacity = active_source_view[19u];
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let capacity_words = active_source_view[27u];
  return active_source_view[0u] == ACTIVE_SOURCE_MAGIC
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
    && active_source_view[24u] == ASSIGNMENT_STRIDE
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
    && active_source_view[37u] == MOMENT_WORKGROUP_SIZE
    && active_source_view[38u] > 0u
    && active_source_view[40u] == ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD
    && active_source_view[41u] == ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD
    && active_source_view[ACTIVE_SOURCE_CANDIDATE_COUNT_WORD]
      == active_count * FIELD_STENCIL_SIZE
    && active_source_view[44u] == active_capacity * FIELD_STENCIL_SIZE
    && active_source_view[ACTIVE_SOURCE_SEAL_WORD] != 0u
    && dispatch_shape_admitted(
      active_count,
      ACTIVE_SOURCE_ACTIVE_DISPATCH_WORD
    )
    && dispatch_shape_admitted(
      active_source_view[ACTIVE_SOURCE_CANDIDATE_COUNT_WORD],
      ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD
    );
}

fn active_source_count() -> u32 {
  return select(
    0u,
    active_source_view[ACTIVE_SOURCE_COUNT_WORD],
    active_source_view_admitted()
  );
}

fn active_candidate_count() -> u32 {
  return select(
    0u,
    active_source_view[ACTIVE_SOURCE_CANDIDATE_COUNT_WORD],
    active_source_view_admitted()
  );
}

fn physical_source_for_active(active_ordinal: u32) -> u32 {
  if (active_ordinal >= active_source_count()) {
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

fn active_linear_invocation(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>,
  dispatch_offset: u32
) -> u32 {
  let linear_group = workgroup_id.x
    + workgroup_id.y * active_source_view[dispatch_offset];
  return linear_group * MOMENT_WORKGROUP_SIZE + local_id.x;
}
`
    : ''}

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn integral_f32(value: f32) -> bool {
  return finite_f32(value) && value == trunc(value);
}

fn control_store(word: u32, value: u32) {
  atomicStore(&control[word], value);
}

fn control_load(word: u32) -> u32 {
  return atomicLoad(&control[word]);
}

fn record_invalid_raw_volume() {
  atomicAdd(&control[CONTROL_INVALID_RAW_VOLUME], 1u);
}

fn record_invalid_lineage() {
  atomicAdd(&control[CONTROL_INVALID_LINEAGE], 1u);
}

fn mechanics_field_dispatch_shape_admitted(field_count: u32) -> bool {
  let group_count = field_count / MOMENT_WORKGROUP_SIZE
    + select(0u, 1u, field_count % MOMENT_WORKGROUP_SIZE != 0u);
  let dispatch_x = mechanics_field[60u];
  let dispatch_y = mechanics_field[61u];
  let dispatch_z = mechanics_field[62u];
  if (field_count == 0u) {
    return dispatch_x == 0u
      && dispatch_y == 0u
      && dispatch_z == 0u
      && mechanics_field[44u] == 0u
      && mechanics_field[45u] == 0u
      && mechanics_field[46u] == 0u;
  }
  if (
    dispatch_x == 0u
    || dispatch_x > group_count
    || dispatch_y == 0u
    || dispatch_z != 1u
  ) {
    return false;
  }
  let expected_y = group_count / dispatch_x
    + select(0u, 1u, group_count % dispatch_x != 0u);
  return dispatch_y == expected_y
    && mechanics_field[44u] == dispatch_x
    && mechanics_field[45u] == dispatch_y
    && mechanics_field[46u] == dispatch_z;
}

fn field_identity_admitted() -> bool {
  if (arrayLength(&mechanics_field) < FIELD_HEADER_WORDS) { return false; }
  if (
    mechanics_field[0u] != FIELD_MAGIC
    || mechanics_field[1u] != FIELD_VERSION
    || mechanics_field[2u] != FIELD_READY_ADMITTED
    || mechanics_field[3u] != params.generation_id
    || mechanics_field[4u] != params.device_ordinal
    || mechanics_field[5u] != params.lane_ordinal
    || mechanics_field[6u] != params.lease_token
    || mechanics_field[7u] != params.source_family_id
    || mechanics_field[8u] != params.storage_generation
    || mechanics_field[9u] != params.physics_tick
    || mechanics_field[10u] != params.physics_substep
    || mechanics_field[11u] != params.position_epoch
    || mechanics_field[12u] != params.topology_epoch
    || mechanics_field[13u] != params.chart_epoch
    || mechanics_field[14u] != params.level_epoch
    || mechanics_field[15u] != params.support_epoch
    || mechanics_field[16u] != params.source_count
    || bitcast<i32>(mechanics_field[17u]) != params.selected_level
    || mechanics_field[18u] != params.grid_node_count
    || mechanics_field[23u] != bitcast<u32>(params.grid_spacing_m)
    || mechanics_field[25u] != FIELD_DESCRIPTOR_WORDS
    || mechanics_field[27u] != FIELD_KEY_WORDS
    || mechanics_field[29u] != 8u
    || mechanics_field[31u] != 8u
    || mechanics_field[32u] != params.field_capacity
    || mechanics_field[33u] != ${directoryV2
      ? 'active_candidate_count()'
      : 'params.candidate_count'}
    || mechanics_field[38u] != params.completion_ordinal
    || mechanics_field[39u] != params.source_row_layout_id
    || mechanics_field[40u] == 0u
    || mechanics_field[42u] > arrayLength(&mechanics_field)
  ) { return false; }
  let field_count = mechanics_field[34u];
  let descriptor_offset = mechanics_field[24u];
  let key_offset = mechanics_field[26u];
  if (
    field_count > params.field_capacity
    || descriptor_offset > mechanics_field[42u]
    || params.source_count > (mechanics_field[42u] - descriptor_offset) / FIELD_DESCRIPTOR_WORDS
    || key_offset > mechanics_field[42u]
    || field_count > (mechanics_field[42u] - key_offset) / FIELD_KEY_WORDS
    || !mechanics_field_dispatch_shape_admitted(field_count)
  ) { return false; }
  return ${directoryV2 ? 'active_source_view_admitted()' : 'true'};
}

fn source_row_admitted(source_index: u32) -> bool {
  if (
    params.source_row_layout_id != SOURCE_LAYOUT_LEVEL_ASSIGNMENT
    || params.assignment_stride_floats != ASSIGNMENT_STRIDE
    || params.mechanics_stride_floats != MECHANICS_STRIDE
    || params.raw_volume_ratio_j_word != RAW_VOLUME_RATIO_J_WORD
    || params.raw_rest_volume_word != RAW_REST_VOLUME_WORD
    || source_index >= params.source_count
  ) { return false; }
  let assignment_offset = source_index * params.assignment_stride_floats;
  let mechanics_offset = source_index * params.mechanics_stride_floats;
  return assignment_offset <= arrayLength(&assignment_rows)
    && params.assignment_stride_floats <= arrayLength(&assignment_rows) - assignment_offset
    && mechanics_offset <= arrayLength(&mechanics_rows)
    && params.mechanics_stride_floats <= arrayLength(&mechanics_rows) - mechanics_offset;
}

fn field_range_offset(field_index: u32) -> u32 {
  return MOMENT_CANDIDATE_CAPACITY + field_index * 2u;
}

fn write_empty_candidate(sorted_position: u32) {
  candidate_contributions[sorted_position] = vec4<f32>(0.0);
  scratch_words[sorted_position] = INVALID_FIELD;
}

fn quadratic_weight(fraction: f32, ordinal: u32) -> f32 {
  if (ordinal == 0u) {
    let value = 1.5 - fraction;
    return 0.5 * value * value;
  }
  if (ordinal == 1u) {
    let value = fraction - 1.0;
    return 0.75 - value * value;
  }
  let value = fraction - 0.5;
  return 0.5 * value * value;
}

fn quadratic_gradient(fraction: f32, ordinal: u32, inv_spacing: f32) -> f32 {
  if (ordinal == 0u) { return (fraction - 1.5) * inv_spacing; }
  if (ordinal == 1u) { return -2.0 * (fraction - 1.0) * inv_spacing; }
  return (fraction - 0.5) * inv_spacing;
}

fn candidate_field_index(candidate_index: u32) -> u32 {
  let work_source = candidate_index / FIELD_STENCIL_SIZE;
  let stencil_ordinal = candidate_index - work_source * FIELD_STENCIL_SIZE;
  let source_index = ${directoryV2
    ? 'physical_source_for_active(work_source)'
    : 'work_source'};
  if (source_index >= params.source_count || stencil_ordinal >= FIELD_STENCIL_SIZE) {
    return INVALID_FIELD;
  }
  let descriptor_offset = mechanics_field[24u]
    + source_index * FIELD_DESCRIPTOR_WORDS;
  if (descriptor_offset > arrayLength(&mechanics_field)
    || FIELD_DESCRIPTOR_WORDS > arrayLength(&mechanics_field) - descriptor_offset) {
    return INVALID_FIELD;
  }
  return mechanics_field[descriptor_offset + 4u + stencil_ordinal];
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_WORKGROUP_SIZE})
fn emit_phase_volume_moment_contributions(
  @builtin(global_invocation_id) global_id: vec3<u32>${directoryV2
    ? `,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>`
    : ''}
) {
  let sorted_position = ${directoryV2
    ? 'active_linear_invocation(local_id, workgroup_id, ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD)'
    : 'global_id.x'};
  let candidate_count = ${directoryV2
    ? 'active_candidate_count()'
    : 'params.candidate_count'};
  if (sorted_position >= candidate_count) { return; }
  write_empty_candidate(sorted_position);
  if (
    !field_identity_admitted()
    || sorted_position >= arrayLength(&sorted_candidate_indices)
    || sorted_position >= arrayLength(&candidate_contributions)
    || sorted_position >= arrayLength(&scratch_words)
  ) {
    record_invalid_lineage();
    return;
  }
  let candidate_index = sorted_candidate_indices[sorted_position];
  if (candidate_index >= candidate_count) {
    record_invalid_lineage();
    return;
  }
  let work_source = candidate_index / FIELD_STENCIL_SIZE;
  let stencil_ordinal = candidate_index - work_source * FIELD_STENCIL_SIZE;
  let source_index = ${directoryV2
    ? 'physical_source_for_active(work_source)'
    : 'work_source'};
  ${directoryV2
    ? `if (source_index == ACTIVE_SOURCE_MISSING) {
    record_invalid_lineage();
    return;
  }
  if (!source_row_admitted(source_index)) {
    record_invalid_lineage();
    return;
  }
  let v2_assignment_offset = source_index * ASSIGNMENT_STRIDE;
  let v2_level = assignment_rows[v2_assignment_offset + 0u];
  let v2_descriptor_offset = mechanics_field[24u]
    + source_index * FIELD_DESCRIPTOR_WORDS;
  if (
    v2_descriptor_offset > arrayLength(&mechanics_field)
    || FIELD_DESCRIPTOR_WORDS
      > arrayLength(&mechanics_field) - v2_descriptor_offset
    || !integral_f32(v2_level)
    || v2_level < F32_I32_MIN
    || v2_level >= F32_I32_EXCLUSIVE_MAX
  ) {
    record_invalid_lineage();
    return;
  }
  let v2_descriptor_status =
    mechanics_field[v2_descriptor_offset + FIELD_DESCRIPTOR_ACTIVE_WORD];
  if (i32(round(v2_level)) != params.selected_level) {
    if (v2_descriptor_status != 0u) {
      record_invalid_lineage();
    }
    return;
  }
  if (v2_descriptor_status != 1u) {
    record_invalid_lineage();
    return;
  }`
    : ''}
  let field_index = candidate_field_index(candidate_index);
  if (!source_row_admitted(source_index)) {
    record_invalid_lineage();
    return;
  }
  let assignment_offset = source_index * ASSIGNMENT_STRIDE;
  let mechanics_offset = source_index * MECHANICS_STRIDE;
  let level = assignment_rows[assignment_offset + 0u];
  let spacing = assignment_rows[assignment_offset + 1u];
  let phase = assignment_rows[assignment_offset + 8u];
  let material = assignment_rows[assignment_offset + 9u];
  let position = vec3<f32>(
    assignment_rows[assignment_offset + 12u],
    assignment_rows[assignment_offset + 13u],
    assignment_rows[assignment_offset + 14u]
  );
  if (
    !integral_f32(level)
    || i32(round(level)) != params.selected_level
    || bitcast<u32>(spacing) != bitcast<u32>(params.grid_spacing_m)
    || !integral_f32(phase)
    || !integral_f32(material)
    || !finite_f32(position.x)
    || !finite_f32(position.y)
    || !finite_f32(position.z)
  ) {
    record_invalid_lineage();
    return;
  }
  let ox = stencil_ordinal / 9u;
  let oy = (stencil_ordinal - ox * 9u) / 3u;
  let oz = stencil_ordinal - ox * 9u - oy * 3u;
  let grid_position = position * params.inv_grid_spacing_m;
  let base = floor(grid_position - vec3<f32>(0.5));
  let fraction = grid_position - base;
  let wx = quadratic_weight(fraction.x, ox);
  let wy = quadratic_weight(fraction.y, oy);
  let wz = quadratic_weight(fraction.z, oz);
  let gx = quadratic_gradient(fraction.x, ox, params.inv_grid_spacing_m);
  let gy = quadratic_gradient(fraction.y, oy, params.inv_grid_spacing_m);
  let gz = quadratic_gradient(fraction.z, oz, params.inv_grid_spacing_m);
  let weight = wx * wy * wz;
  let gradient = vec3<f32>(gx * wy * wz, wx * gy * wz, wx * wy * gz);
  if (!finite_f32(weight) || !(weight >= 0.0)
    || !finite_f32(gradient.x) || !finite_f32(gradient.y) || !finite_f32(gradient.z)) {
    record_invalid_lineage();
    return;
  }
  if (field_index == INVALID_FIELD) {
    ${directoryV2
      ? `// Directory-v2 mechanics-field builders cull only canonical
    // f32-zero support. Recompute that predicate here so a missing
    // positive-support descriptor remains fail-closed lineage evidence.
    if (weight != 0.0) {
      record_invalid_lineage();
    }
    return;`
      : `// Legacy builders use the sentinel for clipped/dormant rows and
    // authenticate clipping through the mechanics-field header.
    return;`}
  }
  if (field_index >= mechanics_field[34u]
      || field_index >= params.field_capacity) {
    record_invalid_lineage();
    return;
  }
  let key_offset = mechanics_field[26u] + field_index * FIELD_KEY_WORDS;
  if (
    key_offset > arrayLength(&mechanics_field)
    || FIELD_KEY_WORDS > arrayLength(&mechanics_field) - key_offset
    || u32(round(phase)) != mechanics_field[key_offset + 1u]
    || u32(round(material)) != mechanics_field[key_offset + 2u]
    ${directoryV2 ? '|| !(weight > 0.0)' : ''}
  ) {
    record_invalid_lineage();
    return;
  }
  let volume_ratio_j = mechanics_rows[mechanics_offset + RAW_VOLUME_RATIO_J_WORD];
  let rest_volume_m3 = mechanics_rows[mechanics_offset + RAW_REST_VOLUME_WORD];
  let raw_current_volume_m3 = rest_volume_m3 * volume_ratio_j;
  if (
    !finite_f32(volume_ratio_j)
    || !finite_f32(rest_volume_m3)
    || !finite_f32(raw_current_volume_m3)
    || !(volume_ratio_j > 0.0)
    || !(rest_volume_m3 > 0.0)
    || !(raw_current_volume_m3 > 0.0)
  ) {
    record_invalid_raw_volume();
    return;
  }
  candidate_contributions[sorted_position] = vec4<f32>(
    raw_current_volume_m3 * weight,
    raw_current_volume_m3 * gradient.x,
    raw_current_volume_m3 * gradient.y,
    raw_current_volume_m3 * gradient.z
  );
  scratch_words[sorted_position] = field_index;
  atomicAdd(&control[CONTROL_CONTRIBUTION_COUNT], 1u);
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_WORKGROUP_SIZE})
fn materialize_phase_volume_moment_ranges(
  @builtin(global_invocation_id) global_id: vec3<u32>${directoryV2
    ? `,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>`
    : ''}
) {
  let sorted_position = ${directoryV2
    ? 'active_linear_invocation(local_id, workgroup_id, ACTIVE_SOURCE_CANDIDATE_DISPATCH_WORD)'
    : 'global_id.x'};
  let candidate_count = ${directoryV2
    ? 'active_candidate_count()'
    : 'params.candidate_count'};
  if (sorted_position >= candidate_count
    || sorted_position >= arrayLength(&scratch_words)) { return; }
  if (!field_identity_admitted()) {
    record_invalid_lineage();
    return;
  }
  let field_index = scratch_words[sorted_position];
  if (field_index == INVALID_FIELD) { return; }
  if (field_index >= mechanics_field[34u] || field_index >= params.field_capacity
    || field_range_offset(field_index) > arrayLength(&scratch_words)
    || 2u > arrayLength(&scratch_words) - field_range_offset(field_index)) {
    record_invalid_lineage();
    return;
  }
  var previous = INVALID_FIELD;
  if (sorted_position > 0u) {
    previous = scratch_words[sorted_position - 1u];
  }
  var next = INVALID_FIELD;
  if (sorted_position + 1u < candidate_count) {
    next = scratch_words[sorted_position + 1u];
  }
  if ((previous != INVALID_FIELD && previous > field_index)
    || (next != INVALID_FIELD && next < field_index)) {
    record_invalid_lineage();
    return;
  }
  let range_offset = field_range_offset(field_index);
  if (previous != field_index) { scratch_words[range_offset] = sorted_position; }
  if (next != field_index) { scratch_words[range_offset + 1u] = sorted_position + 1u; }
}

fn zero_moment_row(field_index: u32) {
  let output = field_index * MOMENT_ROW_WORDS;
  if (output > arrayLength(&moment_rows)
    || MOMENT_ROW_WORDS > arrayLength(&moment_rows) - output) { return; }
  for (var word = 0u; word < MOMENT_ROW_WORDS; word = word + 1u) {
    moment_rows[output + word] = 0u;
  }
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_WORKGROUP_SIZE})
fn reduce_phase_volume_moments(
  @builtin(global_invocation_id) global_id: vec3<u32>${directoryV2
    ? `,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>`
    : ''}
) {
  let field_index = ${directoryV2
    ? '(workgroup_id.x + workgroup_id.y * mechanics_field[60u]) * MOMENT_WORKGROUP_SIZE + local_id.x'
    : 'global_id.x'};
  if (field_index >= params.field_capacity) { return; }
  if (!field_identity_admitted()) {
    zero_moment_row(field_index);
    atomicAdd(&control[CONTROL_ZEROED_FIELD_COUNT], 1u);
    return;
  }
  if (field_index >= mechanics_field[34u]) {
    ${directoryV2
      ? `// Directory-v2 dispatches the exact GPU-authenticated field shape.
    // The retained moment arena was cleared before this pass, so padded
    // workgroup lanes need no write and are not rejected field rows.
    return;`
      : `zero_moment_row(field_index);
    atomicAdd(&control[CONTROL_ZEROED_FIELD_COUNT], 1u);
    return;`}
  }
  if (
    control_load(CONTROL_INVALID_RAW_VOLUME) != 0u
    || control_load(CONTROL_INVALID_LINEAGE) != 0u
    || mechanics_field[36u] != 0u
    || mechanics_field[37u] != 0u
  ) {
    zero_moment_row(field_index);
    atomicAdd(&control[CONTROL_ZEROED_FIELD_COUNT], 1u);
    return;
  }
  let range_offset = field_range_offset(field_index);
  if (
    range_offset > arrayLength(&scratch_words)
    || 2u > arrayLength(&scratch_words) - range_offset
  ) {
    record_invalid_lineage();
    zero_moment_row(field_index);
    return;
  }
  let range_start = scratch_words[range_offset];
  let range_end = scratch_words[range_offset + 1u];
  if (!(range_end > range_start) || range_end > ${directoryV2
    ? 'active_candidate_count()'
    : 'params.candidate_count'}) {
    record_invalid_lineage();
    zero_moment_row(field_index);
    return;
  }
  var sum = vec4<f32>(0.0);
  var contribution_count = 0u;
  for (var sorted_position = range_start; sorted_position < range_end; sorted_position = sorted_position + 1u) {
    if (
      sorted_position >= arrayLength(&scratch_words)
      || sorted_position >= arrayLength(&candidate_contributions)
      || scratch_words[sorted_position] != field_index
    ) {
      record_invalid_lineage();
      zero_moment_row(field_index);
      return;
    }
    let contribution = candidate_contributions[sorted_position];
    if (!finite_f32(contribution.x) || !finite_f32(contribution.y)
      || !finite_f32(contribution.z) || !finite_f32(contribution.w)) {
      record_invalid_lineage();
      zero_moment_row(field_index);
      return;
    }
    sum = sum + contribution;
    contribution_count = contribution_count + 1u;
  }
  let key_offset = mechanics_field[26u] + field_index * FIELD_KEY_WORDS;
  let output = field_index * MOMENT_ROW_WORDS;
  if (
    key_offset > arrayLength(&mechanics_field)
    || FIELD_KEY_WORDS > arrayLength(&mechanics_field) - key_offset
    || output > arrayLength(&moment_rows)
    || MOMENT_ROW_WORDS > arrayLength(&moment_rows) - output
    || !(sum.x ${directoryV2 ? '>=' : '>'} 0.0)
    || !finite_f32(sum.x)
    || !finite_f32(sum.y)
    || !finite_f32(sum.z)
    || !finite_f32(sum.w)
  ) {
    record_invalid_lineage();
    zero_moment_row(field_index);
    return;
  }
  moment_rows[output + 0u] = mechanics_field[key_offset + 0u];
  moment_rows[output + 1u] = mechanics_field[key_offset + 1u];
  moment_rows[output + 2u] = mechanics_field[key_offset + 2u];
  moment_rows[output + 3u] = mechanics_field[key_offset + 3u];
  moment_rows[output + 4u] = bitcast<u32>(sum.x);
  moment_rows[output + 5u] = bitcast<u32>(sum.y);
  moment_rows[output + 6u] = bitcast<u32>(sum.z);
  moment_rows[output + 7u] = bitcast<u32>(sum.w);
  moment_rows[output + 8u] = contribution_count;
  moment_rows[output + 9u] = MOMENT_STATUS_READY | MOMENT_STATUS_ADMITTED;
  moment_rows[output + 10u] = 0u;
  moment_rows[output + 11u] = 0u;
}

@compute @workgroup_size(1)
fn finalize_phase_volume_moments() {
  let field_identity_ok = field_identity_admitted();
  let invalid_raw = control_load(CONTROL_INVALID_RAW_VOLUME);
  let invalid_lineage = control_load(CONTROL_INVALID_LINEAGE);
  var clipped = 0u;
  var overflow = 0u;
  var field_count = 0u;
  var field_key_offset = 0u;
  var field_descriptor_offset = 0u;
  if (field_identity_ok) {
    clipped = mechanics_field[36u];
    overflow = mechanics_field[37u];
    field_count = mechanics_field[34u];
    field_key_offset = mechanics_field[26u];
    field_descriptor_offset = mechanics_field[24u];
  }
  let admitted = field_identity_ok
    && invalid_raw == 0u
    && invalid_lineage == 0u
    && clipped == 0u
    && overflow == 0u
    && field_count <= params.field_capacity;
  var flags = MOMENT_STATUS_READY | MOMENT_STATUS_ADMITTED;
  if (!admitted) {
    flags = MOMENT_STATUS_FAIL_CLOSED;
    if (!field_identity_ok || invalid_lineage != 0u) {
      flags = flags | MOMENT_STATUS_IDENTITY_MISMATCH;
    }
    if (invalid_raw != 0u) { flags = flags | MOMENT_STATUS_INVALID_SOURCE; }
    if (clipped != 0u) { flags = flags | MOMENT_STATUS_CLIPPED_STENCIL; }
    if (overflow != 0u || field_count > params.field_capacity) {
      flags = flags | MOMENT_STATUS_CAPACITY_OVERFLOW;
    }
    field_count = 0u;
  }
  let dispatch_x = select(0u, ${directoryV2
    ? 'mechanics_field[60u]'
    : '(field_count + MOMENT_WORKGROUP_SIZE - 1u) / MOMENT_WORKGROUP_SIZE'}, admitted);
  let dispatch_y = select(0u, ${directoryV2 ? 'mechanics_field[61u]' : '1u'}, admitted);
  let dispatch_z = select(0u, ${directoryV2 ? 'mechanics_field[62u]' : '1u'}, admitted);
  control_store(0u, MOMENT_MAGIC);
  control_store(1u, MOMENT_VERSION);
  control_store(2u, flags);
  control_store(3u, params.generation_id);
  control_store(4u, params.device_ordinal);
  control_store(5u, params.lane_ordinal);
  control_store(6u, params.lease_token);
  control_store(7u, params.source_family_id);
  control_store(8u, params.storage_generation);
  control_store(9u, params.physics_tick);
  control_store(10u, params.physics_substep);
  control_store(11u, params.position_epoch);
  control_store(12u, params.topology_epoch);
  control_store(13u, params.chart_epoch);
  control_store(14u, params.level_epoch);
  control_store(15u, params.support_epoch);
  control_store(16u, params.source_count);
  control_store(17u, params.source_capacity);
  control_store(18u, field_count);
  control_store(19u, params.field_capacity);
  control_store(20u, bitcast<u32>(params.selected_level));
  control_store(21u, params.grid_node_count);
  control_store(22u, bitcast<u32>(params.grid_spacing_m));
  control_store(23u, params.completion_ordinal);
  control_store(24u, select(0u, field_key_offset, admitted));
  control_store(25u, FIELD_KEY_WORDS);
  control_store(26u, select(0u, field_descriptor_offset, admitted));
  control_store(27u, FIELD_DESCRIPTOR_WORDS);
  control_store(28u, 0u);
  control_store(29u, MOMENT_ROW_WORDS);
  control_store(30u, field_count * MOMENT_ROW_WORDS);
  control_store(31u, MOMENT_WORD_CAPACITY);
  control_store(32u, ${directoryV2
    ? 'active_candidate_count()'
    : 'params.candidate_count'});
  control_store(33u, RAW_VOLUME_RATIO_J_WORD);
  control_store(34u, RAW_REST_VOLUME_WORD);
  control_store(35u, MECHANICS_STRIDE);
  control_store(36u, ASSIGNMENT_STRIDE);
  control_store(37u, invalid_raw);
  control_store(38u, invalid_lineage);
  control_store(39u, clipped);
  control_store(40u, control_load(CONTROL_CONTRIBUTION_COUNT));
  control_store(41u, control_load(CONTROL_ZEROED_FIELD_COUNT));
  control_store(42u, 0u);
  control_store(43u, 0u);
  control_store(44u, 1u);
  control_store(45u, 0u);
  control_store(46u, dispatch_x);
  control_store(47u, dispatch_y);
  control_store(48u, dispatch_z);
  control_store(49u, MOMENT_HEADER_WORDS);
  control_store(50u, 4u);
  control_store(51u, 2u);
  control_store(52u, FIELD_MAGIC);
  control_store(53u, FIELD_VERSION);
  control_store(54u, SOURCE_LAYOUT_LEVEL_ASSIGNMENT);
  ${directoryV2
    ? `control_store(55u, ${u32(
      SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
    )});
  control_store(56u, active_source_count());
  control_store(57u, ACTIVE_SOURCE_COUNT_WORD);
  control_store(58u, ACTIVE_SOURCE_CANDIDATE_COUNT_WORD);
  control_store(59u, ACTIVE_SOURCE_COMPLETION_WORD);
  control_store(60u, params.completion_ordinal);
  for (var word = 61u; word < MOMENT_HEADER_WORDS; word = word + 1u) {`
    : 'for (var word = 55u; word < MOMENT_HEADER_WORDS; word = word + 1u) {'}
    control_store(word, 0u);
  }
}
`;
}
