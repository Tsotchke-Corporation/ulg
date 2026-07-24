import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_MAGIC,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_PARAMS_BYTES,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_CLIPPED_STENCIL,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_IDENTITY_MISMATCH,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_INVALID_FIELD,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_MOMENT_REJECTED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_RESIDUAL_EXCEEDED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_VERSION,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE
} from './schroederSpatialPhaseVolumeReceipt.js';
import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_MAGIC,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_CLIPPED_STENCIL,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_IDENTITY_MISMATCH,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_VERSION
} from './schroederSpatialPhaseVolumeMoment.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION
} from './schroederSpatialMechanicsFieldView.js';

function u32(value) {
  return `${Number(value) >>> 0}u`;
}

/**
 * S9-B's receipt never writes a borrowed S9-A buffer or a mechanics field.
 * Its only writable storage is the receipt-owned deterministic reduction
 * scratch and fixed control header.  This is intentionally one local receipt
 * per S9-A sidecar; parent/reflux aggregation waits for the later force slice.
 */
export function createSchroederSpatialPhaseVolumeReceiptWgsl(layout) {
  if (
    !layout
    || layout.controlWords !== SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS
    || layout.paramsByteLength !== SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_PARAMS_BYTES
    || layout.sourceCapacity < 1
    || layout.fieldCapacity < 1
    || layout.candidateCapacity !== layout.sourceCapacity * 27
    || layout.sourceGroupCapacity
      !== Math.ceil(layout.sourceCapacity / SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE)
    || layout.fieldGroupCapacity
      !== Math.ceil(layout.fieldCapacity / SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE)
    || layout.sourcePartialOffsetVec4 !== 0
    || layout.fieldPartialOffsetVec4 !== layout.sourceGroupCapacity
    || layout.fieldConditioningOffsetVec4
      !== layout.sourceGroupCapacity + layout.fieldGroupCapacity
    || layout.partialVec4Capacity
      !== layout.sourceGroupCapacity + layout.fieldGroupCapacity * 2
    || layout.partialFloats !== layout.partialVec4Capacity * 4
  ) {
    throw new TypeError('phase-volume receipt layout is not canonical');
  }
  return /* wgsl */ `
struct PhaseVolumeReceiptParams {
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
  source_group_capacity: u32,
  field_group_capacity: u32,
  source_partial_offset_vec4: u32,
  field_partial_offset_vec4: u32,
  field_conditioning_offset_vec4: u32,
  partial_vec4_capacity: u32,
  source_mechanics_stride_floats: u32,
  raw_volume_ratio_j_word: u32,
  raw_rest_volume_word: u32,
  reserved0: u32,
};

@group(0) @binding(0) var<storage, read> source_mechanics: array<f32>;
@group(0) @binding(1) var<storage, read> moment_control: array<u32>;
@group(0) @binding(2) var<storage, read> moment_rows: array<u32>;
@group(0) @binding(3) var<storage, read> mechanics_field: array<u32>;
@group(0) @binding(4) var<storage, read_write> partials: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> receipt_control: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> params: PhaseVolumeReceiptParams;
// This is the exact S9-A level-assignment parent.  S9-B scans the complete
// source family but only sums rows which this immutable assignment and the
// mechanics-field descriptor jointly select for the current level.
@group(0) @binding(7) var<storage, read> source_assignments: array<f32>;

const RECEIPT_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_MAGIC)};
const RECEIPT_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_VERSION)};
const RECEIPT_HEADER_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS)};
const RECEIPT_WORKGROUP_SIZE: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE)};
const RECEIPT_READY: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY)};
const RECEIPT_ADMITTED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED)};
const RECEIPT_FAIL_CLOSED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_FAIL_CLOSED)};
const RECEIPT_INVALID_SOURCE: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_INVALID_SOURCE)};
const RECEIPT_MOMENT_REJECTED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_MOMENT_REJECTED)};
const RECEIPT_IDENTITY_MISMATCH: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_IDENTITY_MISMATCH)};
const RECEIPT_CLIPPED_STENCIL: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_CLIPPED_STENCIL)};
const RECEIPT_CAPACITY_OVERFLOW: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_CAPACITY_OVERFLOW)};
const RECEIPT_INVALID_FIELD: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_INVALID_FIELD)};
const RECEIPT_RESIDUAL_EXCEEDED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_RESIDUAL_EXCEEDED)};

const MOMENT_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_MAGIC)};
const MOMENT_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_VERSION)};
const MOMENT_READY: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY)};
const MOMENT_ADMITTED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED)};
const MOMENT_FAIL_CLOSED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_FAIL_CLOSED)};
const MOMENT_INVALID_SOURCE: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_INVALID_SOURCE)};
const MOMENT_IDENTITY_MISMATCH: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_IDENTITY_MISMATCH)};
const MOMENT_CLIPPED_STENCIL: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_CLIPPED_STENCIL)};
const MOMENT_CAPACITY_OVERFLOW: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_CAPACITY_OVERFLOW)};

const FIELD_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC)};
const FIELD_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION)};
const FIELD_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED
)};
const MOMENT_HEADER_WORDS: u32 = 64u;
const MOMENT_ROW_WORDS: u32 = 12u;
const FIELD_HEADER_WORDS: u32 = 64u;
const FIELD_KEY_WORDS: u32 = 4u;
const FIELD_DESCRIPTOR_WORDS: u32 = 32u;
const FIELD_DESCRIPTOR_ACTIVE_WORD: u32 = 3u;
const FIELD_STENCIL_SIZE: u32 = 27u;
const MECHANICS_STRIDE: u32 = 32u;
const ASSIGNMENT_STRIDE: u32 = 16u;
const RAW_VOLUME_RATIO_J_WORD: u32 = 18u;
const RAW_REST_VOLUME_WORD: u32 = 19u;
const F32_EPSILON: f32 = 0.00000011920928955078125;
const F32_MIN_NORMAL: f32 = 0.0000000000000000000000000000000000000117549435;
// Keep every f32-to-integer conversion inside its defined destination range.
// The upper i32 limit is exclusive because 2147483647 cannot be represented
// exactly as f32; its next representable value is 2147483648.
const F32_I32_MIN: f32 = -2147483648.0;
const F32_I32_EXCLUSIVE_MAX: f32 = 2147483648.0;
const F32_EXACT_U24_MAX: f32 = 16777215.0;
const F32_U8_MAX: f32 = 255.0;

const CONTROL_INVALID_SOURCE: u32 = 41u;
const CONTROL_INVALID_FIELD: u32 = 42u;
const CONTROL_SELECTED_SOURCE_COUNT: u32 = 47u;
const CONTROL_FIELD_CONTRIBUTIONS: u32 = 48u;

var<workgroup> source_sums: array<vec4<f32>, ${SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE}>;
var<workgroup> field_sums: array<vec4<f32>, ${SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE}>;
var<workgroup> condition_sums: array<vec4<f32>, ${SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE}>;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn integral_f32(value: f32) -> bool {
  return finite_f32(value) && value == round(value);
}

fn group_count(count: u32) -> u32 {
  return count / RECEIPT_WORKGROUP_SIZE
    + select(0u, 1u, count % RECEIPT_WORKGROUP_SIZE != 0u);
}

fn control_store(word: u32, value: u32) {
  atomicStore(&receipt_control[word], value);
}

fn control_load(word: u32) -> u32 {
  return atomicLoad(&receipt_control[word]);
}

fn control_store_f32(word: u32, value: f32) {
  control_store(word, bitcast<u32>(value));
}

fn moment_control_word(word: u32) -> u32 {
  if (word >= arrayLength(&moment_control)) { return 0u; }
  return moment_control[word];
}

fn moment_field_count() -> u32 {
  return moment_control_word(18u);
}

fn moment_header_admitted() -> bool {
  if (arrayLength(&moment_control) < MOMENT_HEADER_WORDS) { return false; }
  let status = moment_control[2u];
  return moment_control[0u] == MOMENT_MAGIC
    && moment_control[1u] == MOMENT_VERSION
    && (status & (MOMENT_READY | MOMENT_ADMITTED)) == (MOMENT_READY | MOMENT_ADMITTED)
    && (status & (MOMENT_FAIL_CLOSED | MOMENT_INVALID_SOURCE | MOMENT_IDENTITY_MISMATCH | MOMENT_CLIPPED_STENCIL | MOMENT_CAPACITY_OVERFLOW)) == 0u
    && moment_control[3u] == params.generation_id
    && moment_control[4u] == params.device_ordinal
    && moment_control[5u] == params.lane_ordinal
    && moment_control[6u] == params.lease_token
    && moment_control[7u] == params.source_family_id
    && moment_control[8u] == params.storage_generation
    && moment_control[9u] == params.physics_tick
    && moment_control[10u] == params.physics_substep
    && moment_control[11u] == params.position_epoch
    && moment_control[12u] == params.topology_epoch
    && moment_control[13u] == params.chart_epoch
    && moment_control[14u] == params.level_epoch
    && moment_control[15u] == params.support_epoch
    && moment_control[16u] == params.source_count
    && moment_control[17u] == params.source_capacity
    && moment_control[19u] == params.field_capacity
    && moment_control[20u] == bitcast<u32>(params.selected_level)
    && moment_control[21u] == params.grid_node_count
    && moment_control[22u] == bitcast<u32>(params.grid_spacing_m)
    && moment_control[23u] == params.completion_ordinal
    // The moment sidecar is not a self-describing loose row array.  Its
    // offsets and ranges must remain the canonical projection of the exact
    // mechanics-field topology that it borrowed from S9-A.
    && moment_control[24u] >= FIELD_HEADER_WORDS
    && moment_control[25u] == FIELD_KEY_WORDS
    && moment_control[26u] == FIELD_HEADER_WORDS
    && moment_control[27u] == 32u
    && moment_control[28u] == 0u
    && moment_control[29u] == MOMENT_ROW_WORDS
    && moment_control[30u] % MOMENT_ROW_WORDS == 0u
    && moment_control[30u] / MOMENT_ROW_WORDS == moment_control[18u]
    && moment_control[31u] % MOMENT_ROW_WORDS == 0u
    && moment_control[31u] / MOMENT_ROW_WORDS == params.field_capacity
    && moment_control[31u] <= arrayLength(&moment_rows)
    && moment_control[32u] == params.candidate_count
    && moment_control[33u] == RAW_VOLUME_RATIO_J_WORD
    && moment_control[34u] == RAW_REST_VOLUME_WORD
    && moment_control[35u] == MECHANICS_STRIDE
    && moment_control[36u] == 16u
    && moment_control[37u] == 0u
    && moment_control[38u] == 0u
    && moment_control[39u] == 0u
    // S9-A scans the full source family, but it records only the exact
    // selected-level candidates here.  A mixed-level family therefore has a
    // smaller valid contribution count than its global scan capacity.
    && moment_control[40u] > 0u
    && moment_control[40u] <= params.candidate_count
    && moment_control[40u] % FIELD_STENCIL_SIZE == 0u
    // The S9-A reducer dispatches its retained capacity.  Every unused
    // field-capacity row is deliberately zeroed, so this is an expected
    // capacity tail rather than evidence of a rejected active field.
    && moment_control[41u] == params.field_capacity - moment_control[18u]
    && moment_control[42u] == 0u
    && moment_control[43u] == 0u
    && moment_control[44u] == 1u
    && moment_control[45u] == 0u
    && moment_control[46u] == group_count(moment_control[18u])
    && moment_control[47u] == 1u
    && moment_control[48u] == 1u
    && moment_control[49u] == MOMENT_HEADER_WORDS
    && moment_control[50u] == 4u
    && moment_control[51u] == 2u
    && moment_control[52u] == FIELD_MAGIC
    && moment_control[53u] == FIELD_VERSION
    && moment_control[54u] == 1u
    && moment_control[18u] > 0u
    && moment_control[18u] <= params.field_capacity;
}

fn mechanics_field_header_admitted() -> bool {
  if (arrayLength(&mechanics_field) < FIELD_HEADER_WORDS) { return false; }
  let status = mechanics_field[2u];
  let field_count = mechanics_field[34u];
  let dispatch_x = group_count(field_count);
  if (
    mechanics_field[0u] != FIELD_MAGIC
    || mechanics_field[1u] != FIELD_VERSION
    || status != FIELD_READY_ADMITTED
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
    || mechanics_field[17u] != bitcast<u32>(params.selected_level)
    || mechanics_field[18u] != params.grid_node_count
    || mechanics_field[23u] != bitcast<u32>(params.grid_spacing_m)
    || mechanics_field[24u] != FIELD_HEADER_WORDS
    || mechanics_field[25u] != 32u
    || mechanics_field[27u] != FIELD_KEY_WORDS
    || mechanics_field[29u] != 8u
    || mechanics_field[31u] != 8u
    || mechanics_field[32u] != params.field_capacity
    || mechanics_field[33u] != params.candidate_count
    || field_count == 0u
    || field_count > params.field_capacity
    || mechanics_field[38u] != params.completion_ordinal
    || mechanics_field[39u] != 1u
    || mechanics_field[42u] > arrayLength(&mechanics_field)
    || mechanics_field[43u] != 0u
    || mechanics_field[44u] != dispatch_x
    || mechanics_field[45u] != 1u
    || mechanics_field[46u] != 1u
    || mechanics_field[54u] != params.source_count
    || mechanics_field[55u] != 1u
    || mechanics_field[56u] != 1u
    || mechanics_field[57u] != 1u
    || mechanics_field[58u] != 0u
    || mechanics_field[59u] != 0u
    || mechanics_field[60u] != dispatch_x
    || mechanics_field[61u] != 1u
    || mechanics_field[62u] != 1u
    || mechanics_field[63u] != 0u
  ) { return false; }

  let descriptor_offset = mechanics_field[24u];
  let key_offset = mechanics_field[26u];
  if (key_offset < descriptor_offset) { return false; }
  let descriptor_span = key_offset - descriptor_offset;
  if (descriptor_span % 32u != 0u || descriptor_span / 32u != params.source_capacity) {
    return false;
  }

  let accumulator_offset = mechanics_field[28u];
  if (accumulator_offset < key_offset) { return false; }
  let key_span = accumulator_offset - key_offset;
  if (key_span % FIELD_KEY_WORDS != 0u || key_span / FIELD_KEY_WORDS != params.field_capacity) {
    return false;
  }

  let state_offset = mechanics_field[30u];
  if (state_offset < accumulator_offset || state_offset - accumulator_offset < 16u) {
    return false;
  }
  let accumulator_span = state_offset - accumulator_offset - 16u;
  if (accumulator_span % 8u != 0u || accumulator_span / 8u != params.field_capacity) {
    return false;
  }

  let required_words = mechanics_field[41u];
  if (required_words < state_offset) { return false; }
  let state_required_span = required_words - state_offset;
  if (state_required_span % 8u != 0u || state_required_span / 8u != field_count) {
    return false;
  }

  let capacity_words = mechanics_field[42u];
  if (capacity_words < state_offset) { return false; }
  let state_capacity_span = capacity_words - state_offset;
  return state_capacity_span % 8u == 0u
    && state_capacity_span / 8u == params.field_capacity;
}

// S9-A's rows are valid only when both headers prove one *same* mechanics
// field set.  Do this before either source or field reduction so a corrupt
// header cannot leave a numerically plausible prefix receipt behind.
fn phase_volume_headers_admitted() -> bool {
  if (!moment_header_admitted() || !mechanics_field_header_admitted()) {
    return false;
  }
  return moment_control[18u] == mechanics_field[34u]
    && moment_control[19u] == mechanics_field[32u]
    && moment_control[24u] == mechanics_field[26u]
    && moment_control[25u] == mechanics_field[27u]
    && moment_control[26u] == mechanics_field[24u]
    && moment_control[27u] == mechanics_field[25u]
    && moment_control[28u] == 0u
    && moment_control[29u] == MOMENT_ROW_WORDS
    && moment_control[30u] / MOMENT_ROW_WORDS == mechanics_field[34u]
    && moment_control[31u] / MOMENT_ROW_WORDS == mechanics_field[32u]
    && moment_control[32u] == mechanics_field[33u]
    && moment_control[23u] == mechanics_field[38u]
    && moment_control[52u] == mechanics_field[0u]
    && moment_control[53u] == mechanics_field[1u]
    && moment_control[54u] == mechanics_field[39u];
}

fn admitted_field_count() -> u32 {
  return select(0u, moment_field_count(), phase_volume_headers_admitted());
}

fn field_key_matches(field_index: u32, row_offset: u32) -> bool {
  if (!phase_volume_headers_admitted()) { return false; }
  let field_count = mechanics_field[34u];
  let key_offset = mechanics_field[26u];
  if (
    field_index >= field_count
    || key_offset > arrayLength(&mechanics_field)
    || FIELD_KEY_WORDS > arrayLength(&mechanics_field) - key_offset
    || field_index >= (arrayLength(&mechanics_field) - key_offset) / FIELD_KEY_WORDS
  ) { return false; }
  let key = key_offset + field_index * FIELD_KEY_WORDS;
  return moment_rows[row_offset] == mechanics_field[key]
    && moment_rows[row_offset + 1u] == mechanics_field[key + 1u]
    && moment_rows[row_offset + 2u] == mechanics_field[key + 2u]
    && moment_rows[row_offset + 3u] == mechanics_field[key + 3u];
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE})
fn reduce_phase_volume_receipt_sources(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let source_index = global_id.x;
  var local_sum = vec4<f32>(0.0);
  if (source_index < params.source_count && phase_volume_headers_admitted()) {
    let mechanics_row = source_index * MECHANICS_STRIDE;
    let assignment_row = source_index * ASSIGNMENT_STRIDE;
    let descriptor_base = mechanics_field[24u];
    if (
      mechanics_row > arrayLength(&source_mechanics)
      || MECHANICS_STRIDE > arrayLength(&source_mechanics) - mechanics_row
      || assignment_row > arrayLength(&source_assignments)
      || ASSIGNMENT_STRIDE > arrayLength(&source_assignments) - assignment_row
      || descriptor_base > arrayLength(&mechanics_field)
      || FIELD_DESCRIPTOR_WORDS > arrayLength(&mechanics_field) - descriptor_base
      || source_index >= (arrayLength(&mechanics_field) - descriptor_base) / FIELD_DESCRIPTOR_WORDS
    ) {
      atomicAdd(&receipt_control[CONTROL_INVALID_SOURCE], 1u);
    } else {
      let descriptor = descriptor_base + source_index * FIELD_DESCRIPTOR_WORDS;
      let level = source_assignments[assignment_row + 0u];
      let spacing = source_assignments[assignment_row + 1u];
      let mass = source_assignments[assignment_row + 6u];
      let family = source_assignments[assignment_row + 8u];
      let material = source_assignments[assignment_row + 9u];
      let source_status = source_assignments[assignment_row + 10u];
      let descriptor_status = mechanics_field[descriptor + FIELD_DESCRIPTOR_ACTIVE_WORD];
      let level_admitted = integral_f32(level)
        && level >= F32_I32_MIN
        && level < F32_I32_EXCLUSIVE_MAX;
      if (
        !level_admitted
        || !finite_f32(mass)
        || mass < 0.0
        || (descriptor_status != 0u && descriptor_status != 1u)
      ) {
        atomicAdd(&receipt_control[CONTROL_INVALID_SOURCE], 1u);
      } else if (i32(round(level)) != params.selected_level) {
        // An off-level source must not have been selected by this exact
        // mechanics field.  Its V0*J is intentionally excluded.
        if (descriptor_status != 0u) {
          atomicAdd(&receipt_control[44u], 1u);
        }
      } else if (mass == 0.0) {
        // Fixed-capacity dormant rows are permitted only when their field
        // descriptor agrees that they contribute no selected stencil.
        if (descriptor_status != 0u) {
          atomicAdd(&receipt_control[44u], 1u);
        }
      } else {
        let family_admitted = integral_f32(family)
          && family >= 1.0
          && family <= F32_EXACT_U24_MAX;
        let material_admitted = integral_f32(material)
          && material >= 1.0
          && material <= F32_EXACT_U24_MAX;
        let source_status_admitted = integral_f32(source_status)
          && source_status >= 0.0
          && source_status <= F32_U8_MAX;
        if (
          !family_admitted
          || !material_admitted
          || !source_status_admitted
        ) {
          // Do not convert malformed f32 metadata to u32: WGSL does not
          // define that conversion outside the destination range.
          atomicAdd(&receipt_control[CONTROL_INVALID_SOURCE], 1u);
        } else {
          let admitted_status = u32(round(source_status));
          let status_admitted = (admitted_status & 31u) != 0u
            && (admitted_status & 64u) == 0u
            && (admitted_status & 128u) == 0u;
          if (
            !status_admitted
            || !finite_f32(spacing)
            || !(spacing > 0.0)
            || bitcast<u32>(spacing) != bitcast<u32>(params.grid_spacing_m)
            || descriptor_status != 1u
            || mechanics_field[descriptor + 0u] != u32(round(family))
            || mechanics_field[descriptor + 1u] != u32(round(material))
          ) {
            atomicAdd(&receipt_control[44u], 1u);
          } else {
            let volume_ratio_j = source_mechanics[mechanics_row + RAW_VOLUME_RATIO_J_WORD];
            let rest_volume = source_mechanics[mechanics_row + RAW_REST_VOLUME_WORD];
            let current_volume = rest_volume * volume_ratio_j;
            if (
              !finite_f32(volume_ratio_j)
              || !finite_f32(rest_volume)
              || !finite_f32(current_volume)
              || !(volume_ratio_j > 0.0)
              || !(rest_volume > 0.0)
              || !(current_volume > 0.0)
            ) {
              atomicAdd(&receipt_control[CONTROL_INVALID_SOURCE], 1u);
            } else {
              atomicAdd(&receipt_control[CONTROL_SELECTED_SOURCE_COUNT], 1u);
              local_sum.x = current_volume;
            }
          }
        }
      }
    }
  } else if (source_index < params.source_count) {
    atomicAdd(&receipt_control[44u], 1u);
  }
  source_sums[local_id.x] = local_sum;
  workgroupBarrier();
  var stride = RECEIPT_WORKGROUP_SIZE / 2u;
  loop {
    if (local_id.x < stride) {
      source_sums[local_id.x] = source_sums[local_id.x]
        + source_sums[local_id.x + stride];
    }
    workgroupBarrier();
    if (stride == 1u) { break; }
    stride = stride / 2u;
  }
  if (local_id.x == 0u) {
    partials[params.source_partial_offset_vec4 + workgroup_id.x] = source_sums[0u];
  }
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE})
fn reduce_phase_volume_receipt_fields(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let field_index = global_id.x;
  let field_count = admitted_field_count();
  var local_sum = vec4<f32>(0.0);
  var local_condition = vec4<f32>(0.0);
  if (field_index < field_count) {
    let row = field_index * MOMENT_ROW_WORDS;
    if (
      row > arrayLength(&moment_rows)
      || MOMENT_ROW_WORDS > arrayLength(&moment_rows) - row
    ) {
      atomicAdd(&receipt_control[CONTROL_INVALID_FIELD], 1u);
    } else {
      let volume = bitcast<f32>(moment_rows[row + 4u]);
      let gradient_x = bitcast<f32>(moment_rows[row + 5u]);
      let gradient_y = bitcast<f32>(moment_rows[row + 6u]);
      let gradient_z = bitcast<f32>(moment_rows[row + 7u]);
      let contribution_count = moment_rows[row + 8u];
      let row_status = moment_rows[row + 9u];
      let row_admitted = row_status == (MOMENT_READY | MOMENT_ADMITTED)
        && contribution_count > 0u
        && finite_f32(volume)
        && finite_f32(gradient_x)
        && finite_f32(gradient_y)
        && finite_f32(gradient_z)
        && volume > 0.0;
      let key_matches = field_key_matches(field_index, row);
      if (!row_admitted || !key_matches) {
        atomicAdd(&receipt_control[CONTROL_INVALID_FIELD], 1u);
        if (!key_matches) { atomicAdd(&receipt_control[44u], 1u); }
      } else {
        local_sum = vec4<f32>(volume, gradient_x, gradient_y, gradient_z);
        local_condition = vec4<f32>(abs(volume), abs(gradient_x), abs(gradient_y), abs(gradient_z));
        atomicAdd(&receipt_control[CONTROL_FIELD_CONTRIBUTIONS], contribution_count);
      }
    }
  }
  field_sums[local_id.x] = local_sum;
  condition_sums[local_id.x] = local_condition;
  workgroupBarrier();
  var stride = RECEIPT_WORKGROUP_SIZE / 2u;
  loop {
    if (local_id.x < stride) {
      field_sums[local_id.x] = field_sums[local_id.x]
        + field_sums[local_id.x + stride];
      condition_sums[local_id.x] = condition_sums[local_id.x]
        + condition_sums[local_id.x + stride];
    }
    workgroupBarrier();
    if (stride == 1u) { break; }
    stride = stride / 2u;
  }
  if (local_id.x == 0u) {
    partials[params.field_partial_offset_vec4 + workgroup_id.x] = field_sums[0u];
    partials[params.field_conditioning_offset_vec4 + workgroup_id.x] = condition_sums[0u];
  }
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE})
fn finalize_phase_volume_receipt(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let field_count = admitted_field_count();
  let source_group_count = group_count(params.source_count);
  let field_group_count = select(0u, group_count(field_count), field_count <= params.field_capacity);
  var source_local = vec4<f32>(0.0);
  var field_local = vec4<f32>(0.0);
  var condition_local = vec4<f32>(0.0);
  for (var index = local_id.x; index < source_group_count; index = index + RECEIPT_WORKGROUP_SIZE) {
    source_local = source_local + partials[params.source_partial_offset_vec4 + index];
  }
  for (var index = local_id.x; index < field_group_count; index = index + RECEIPT_WORKGROUP_SIZE) {
    field_local = field_local + partials[params.field_partial_offset_vec4 + index];
    condition_local = condition_local + partials[params.field_conditioning_offset_vec4 + index];
  }
  source_sums[local_id.x] = source_local;
  field_sums[local_id.x] = field_local;
  condition_sums[local_id.x] = condition_local;
  workgroupBarrier();
  var stride = RECEIPT_WORKGROUP_SIZE / 2u;
  loop {
    if (local_id.x < stride) {
      source_sums[local_id.x] = source_sums[local_id.x]
        + source_sums[local_id.x + stride];
      field_sums[local_id.x] = field_sums[local_id.x]
        + field_sums[local_id.x + stride];
      condition_sums[local_id.x] = condition_sums[local_id.x]
        + condition_sums[local_id.x + stride];
    }
    workgroupBarrier();
    if (stride == 1u) { break; }
    stride = stride / 2u;
  }
  if (local_id.x != 0u) { return; }

  let source_total = source_sums[0u].x;
  let field_total = field_sums[0u].x;
  let field_gradient = vec3<f32>(field_sums[0u].y, field_sums[0u].z, field_sums[0u].w);
  let volume_conditioning = abs(source_total) + abs(field_total);
  let gradient_conditioning = condition_sums[0u].y + condition_sums[0u].z + condition_sums[0u].w;
  let volume_tolerance = max(8.0 * F32_MIN_NORMAL, 1024.0 * F32_EPSILON * volume_conditioning);
  let default_gradient_conditioning = volume_conditioning * params.inv_grid_spacing_m;
  let gradient_tolerance = max(
    8.0 * F32_MIN_NORMAL,
    2048.0 * F32_EPSILON * max(gradient_conditioning, default_gradient_conditioning)
  );
  let volume_residual = field_total - source_total;
  let gradient_norm = length(field_gradient);
  let invalid_source_count = control_load(CONTROL_INVALID_SOURCE);
  let invalid_field_count = control_load(CONTROL_INVALID_FIELD);
  let selected_source_count = control_load(CONTROL_SELECTED_SOURCE_COUNT);
  let field_contribution_count = control_load(CONTROL_FIELD_CONTRIBUTIONS);
  let identity_mismatch_count = control_load(44u);
  let moment_ok = moment_header_admitted();
  let field_ok = mechanics_field_header_admitted();
  let headers_ok = phase_volume_headers_admitted();
  let moment_status = moment_control_word(2u);
  let moment_clipped = moment_control_word(39u);
  let moment_overflow = select(
    0u,
    1u,
    (moment_status & MOMENT_CAPACITY_OVERFLOW) != 0u
  );
  let selected_candidate_count = selected_source_count * FIELD_STENCIL_SIZE;
  let moment_selected_candidate_count = moment_control_word(40u);
  let count_ok = source_group_count <= params.source_group_capacity
    && field_group_count <= params.field_group_capacity
    && params.field_conditioning_offset_vec4 + field_group_count <= params.partial_vec4_capacity
    && selected_source_count > 0u
    && selected_source_count <= params.source_count
    && selected_source_count <= 0xffffffffu / FIELD_STENCIL_SIZE
    && selected_candidate_count <= params.candidate_count
    && selected_candidate_count == moment_selected_candidate_count
    && field_contribution_count == selected_candidate_count;
  let finite_totals = finite_f32(source_total)
    && finite_f32(field_total)
    && finite_f32(volume_residual)
    && finite_f32(field_gradient.x)
    && finite_f32(field_gradient.y)
    && finite_f32(field_gradient.z)
    && finite_f32(gradient_norm)
    && finite_f32(volume_tolerance)
    && finite_f32(gradient_tolerance);
  let residual_ok = abs(volume_residual) <= volume_tolerance
    && gradient_norm <= gradient_tolerance;
  let admitted = headers_ok
    && invalid_source_count == 0u
    && invalid_field_count == 0u
    && identity_mismatch_count == 0u
    && moment_clipped == 0u
    && moment_overflow == 0u
    && count_ok
    && finite_totals
    && residual_ok;

  var flags = RECEIPT_READY | RECEIPT_ADMITTED;
  var public_source_total = source_total;
  var public_field_total = field_total;
  var public_volume_residual = volume_residual;
  var public_gradient = field_gradient;
  var public_gradient_norm = gradient_norm;
  var public_volume_tolerance = volume_tolerance;
  var public_gradient_tolerance = gradient_tolerance;
  var public_volume_conditioning = volume_conditioning;
  var public_gradient_conditioning = gradient_conditioning;
  if (!admitted) {
    flags = RECEIPT_FAIL_CLOSED;
    if (invalid_source_count != 0u) { flags = flags | RECEIPT_INVALID_SOURCE; }
    if (invalid_field_count != 0u) { flags = flags | RECEIPT_INVALID_FIELD; }
    if (!moment_ok || !field_ok || !headers_ok) { flags = flags | RECEIPT_MOMENT_REJECTED; }
    if (identity_mismatch_count != 0u || !field_ok || !headers_ok) {
      flags = flags | RECEIPT_IDENTITY_MISMATCH;
    }
    if (moment_clipped != 0u) { flags = flags | RECEIPT_CLIPPED_STENCIL; }
    if (moment_overflow != 0u || !count_ok) { flags = flags | RECEIPT_CAPACITY_OVERFLOW; }
    if (!residual_ok || !finite_totals) { flags = flags | RECEIPT_RESIDUAL_EXCEEDED; }
    public_source_total = 0.0;
    public_field_total = 0.0;
    public_volume_residual = 0.0;
    public_gradient = vec3<f32>(0.0);
    public_gradient_norm = 0.0;
    public_volume_tolerance = 0.0;
    public_gradient_tolerance = 0.0;
    public_volume_conditioning = 0.0;
    public_gradient_conditioning = 0.0;
  }

  control_store(0u, RECEIPT_MAGIC);
  control_store(1u, RECEIPT_VERSION);
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
  control_store(18u, select(0u, field_count, admitted));
  control_store(19u, params.field_capacity);
  control_store(20u, params.candidate_count);
  control_store(21u, bitcast<u32>(params.selected_level));
  control_store(22u, params.grid_node_count);
  control_store_f32(23u, params.grid_spacing_m);
  control_store(24u, MOMENT_HEADER_WORDS);
  control_store(25u, MOMENT_ROW_WORDS);
  control_store(26u, params.completion_ordinal);
  control_store(27u, source_group_count);
  control_store(28u, field_group_count);
  control_store(29u, params.partial_vec4_capacity);
  control_store_f32(30u, public_source_total);
  control_store_f32(31u, public_field_total);
  control_store_f32(32u, public_volume_residual);
  control_store_f32(33u, public_gradient.x);
  control_store_f32(34u, public_gradient.y);
  control_store_f32(35u, public_gradient.z);
  control_store_f32(36u, public_gradient_norm);
  control_store_f32(37u, public_volume_tolerance);
  control_store_f32(38u, public_gradient_tolerance);
  control_store_f32(39u, public_volume_conditioning);
  control_store_f32(40u, public_gradient_conditioning);
  control_store(41u, invalid_source_count);
  control_store(42u, invalid_field_count);
  control_store(43u, select(0u, 1u, !moment_ok || !field_ok));
  control_store(44u, identity_mismatch_count);
  control_store(45u, moment_clipped);
  control_store(46u, moment_overflow);
  // v2 keeps global scan totals at words 16/20 and seals the exact selected
  // subset here.  This avoids reinterpreting a two-level field as though all
  // members of its global source family had contributed to it.
  control_store(47u, selected_source_count);
  control_store(48u, selected_candidate_count);
  control_store(49u, MECHANICS_STRIDE);
  control_store(50u, RAW_VOLUME_RATIO_J_WORD);
  control_store(51u, RAW_REST_VOLUME_WORD);
  control_store(52u, 0u);
  control_store(53u, 0u);
  control_store(54u, 1u);
  control_store(55u, 0u);
  control_store(56u, source_group_count);
  control_store(57u, field_group_count);
  control_store(58u, RECEIPT_HEADER_WORDS);
  // The seal is intentionally the final header write. Future operators must
  // require both this exact seal and READY|ADMITTED before consuming it.
  control_store(59u, RECEIPT_MAGIC ^ params.generation_id ^ params.completion_ordinal ^ flags);
}
`;
}
