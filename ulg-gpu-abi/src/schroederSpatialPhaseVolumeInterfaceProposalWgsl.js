import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_INVALID_INDEX,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_POLICY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_MAGIC,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_PARAMS_BYTES,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_VERSION,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_WORKGROUP_SIZE,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_POLICY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_READY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_IDENTITY_MISMATCH,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_INVALID_FIELD,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_INVALID_ROUTE,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_READY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_RECEIPT_REJECTED
} from './schroederSpatialPhaseVolumeInterfaceProposal.js';
import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_MAGIC,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_VERSION
} from './schroederSpatialPhaseVolumeReceipt.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE
} from './schroederSpatialMechanicsFieldView.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_VERSION
} from './schroederSpatialMechanicsView.js';
import {
  SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_READY,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_VERSION
} from './schroederSpatialParentFieldView.js';

function u32(value) {
  return `${Number(value) >>> 0}u`;
}

/**
 * S9-C deliberately emits topology only.  It never binds mechanics state,
 * P2G/G2P storage, a reflux ledger, or the S9-A moment rows themselves.  The
 * JavaScript descriptor preserves the exact receipt -> moment lineage; this
 * shader authenticates the resident receipt, immutable field dictionary, and
 * parent CSR before publishing sparse local-range / route rows.
 *
 * A same-node span is an exact compressed representation, not a neighbour
 * approximation.  A later antisymmetric law must iterate every admissible
 * virtual pair within that range and must bind the exact S9-A moment rows in
 * its own contract.
 */
export function createSchroederSpatialPhaseVolumeInterfaceProposalWgsl(layout) {
  if (
    !layout
    || layout.controlWords !== SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS
    || layout.paramsByteLength !== SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_PARAMS_BYTES
    || layout.localHeadCapacity < 1
    || layout.localHeadWords
      !== layout.localHeadCapacity * SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_WORDS
    || layout.refluxRouteWords
      !== layout.refluxRouteCapacity * SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_WORDS
    || layout.fineLocalHeadOffsetWords !== 0
    || layout.coarseLocalHeadOffsetWords
      !== layout.fineFieldCapacity * SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_WORDS
  ) {
    throw new TypeError('phase-volume interface proposal layout is not canonical');
  }

  return /* wgsl */ `
struct PhaseVolumeInterfaceParams {
  fine_field_capacity: u32,
  coarse_field_capacity: u32,
  fine_level: i32,
  coarse_level: i32,
  two_level: u32,
  parent_routes_enabled: u32,
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
  fine_receipt_completion_ordinal: u32,
  coarse_receipt_completion_ordinal: u32,
  parent_field_completion_ordinal: u32,
  fine_local_head_offset_words: u32,
  coarse_local_head_offset_words: u32,
  local_head_capacity: u32,
  reflux_route_capacity: u32,
  local_policy_id: u32,
  reflux_policy_id: u32,
  moment_header_words: u32,
  moment_row_words: u32,
  parent_field_header_words: u32,
  local_head_words: u32,
  reflux_route_words: u32,
  control_words: u32,
  reserved0: u32,
  reserved1: u32,
  reserved2: u32,
  reserved3: u32,
  reserved4: u32,
  reserved5: u32,
  reserved6: u32,
  reserved7: u32,
  reserved8: u32,
  reserved9: u32,
  reserved10: u32,
  reserved11: u32,
};

@group(0) @binding(0) var<storage, read> fine_receipt: array<u32>;
@group(0) @binding(1) var<storage, read> fine_field_view: array<u32>;
@group(0) @binding(2) var<storage, read> coarse_receipt: array<u32>;
@group(0) @binding(3) var<storage, read> coarse_field_view: array<u32>;
@group(0) @binding(4) var<storage, read> parent_field_view: array<u32>;
@group(0) @binding(5) var<storage, read_write> local_head_rows: array<u32>;
@group(0) @binding(6) var<storage, read_write> reflux_route_rows: array<u32>;
@group(0) @binding(7) var<storage, read_write> proposal_control: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: PhaseVolumeInterfaceParams;

const INTERFACE_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_MAGIC)};
const INTERFACE_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_VERSION)};
const INTERFACE_HEADER_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS)};
const INTERFACE_WORKGROUP_SIZE: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_WORKGROUP_SIZE)};
const INTERFACE_READY: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_READY)};
const INTERFACE_ADMITTED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_ADMITTED)};
const INTERFACE_FAIL_CLOSED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_FAIL_CLOSED)};
const INTERFACE_RECEIPT_REJECTED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_RECEIPT_REJECTED)};
const INTERFACE_IDENTITY_MISMATCH: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_IDENTITY_MISMATCH)};
const INTERFACE_INVALID_FIELD: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_INVALID_FIELD)};
const INTERFACE_INVALID_ROUTE: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_INVALID_ROUTE)};
const INTERFACE_CAPACITY_OVERFLOW: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_CAPACITY_OVERFLOW)};
const LOCAL_HEAD_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_WORDS)};
const REFLUX_ROUTE_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_WORDS)};
const LOCAL_POLICY: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_POLICY)};
const REFLUX_POLICY: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_POLICY)};
const ROW_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_READY
    | SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_ADMITTED
)};
const INVALID_INDEX: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_INVALID_INDEX)};

const RECEIPT_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_MAGIC)};
const RECEIPT_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_VERSION)};
const RECEIPT_HEADER_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS)};
const RECEIPT_READY: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY)};
const RECEIPT_ADMITTED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED)};
const RECEIPT_FAIL_CLOSED: u32 = ${u32(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_FAIL_CLOSED)};
const RECEIPT_READY_ADMITTED: u32 = RECEIPT_READY | RECEIPT_ADMITTED;
const STENCIL_SIZE: u32 = 27u;
const MECHANICS_STRIDE: u32 = 32u;
const RAW_VOLUME_RATIO_J_WORD: u32 = 18u;
const RAW_REST_VOLUME_WORD: u32 = 19u;

const FIELD_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC)};
const FIELD_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION)};
const FIELD_WORKGROUP_SIZE: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE
)};
const FIELD_HEADER_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS)};
const FIELD_KEY_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS)};
const FIELD_DESCRIPTOR_WORDS: u32 = 32u;
const FIELD_ACCUMULATOR_WORDS: u32 = 8u;
const FIELD_RECEIPT_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS
)};
const FIELD_STATE_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS
)};
const FIELD_PRESSURE_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS
)};
const FIELD_READY: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY)};
const FIELD_ADMITTED: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED)};
const FIELD_FAIL_CLOSED: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED)};
const FIELD_INVALID_SOURCE: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE)};
const FIELD_CAPACITY_OVERFLOW: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_CAPACITY_OVERFLOW)};
const FIELD_READY_ADMITTED: u32 = FIELD_READY | FIELD_ADMITTED;
const FIELD_PARENT_MECHANICS_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_VIEW_MAGIC)};
const FIELD_PARENT_MECHANICS_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_VIEW_VERSION)};

const PARENT_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_MAGIC)};
const PARENT_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_VERSION)};
const PARENT_HEADER_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS)};
const PARENT_READY: u32 = ${u32(SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_READY)};
const PARENT_ADMITTED: u32 = ${u32(SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_ADMITTED)};
const PARENT_FAIL_CLOSED: u32 = ${u32(SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_FAIL_CLOSED)};
const PARENT_MAX_EDGES: u32 = ${u32(SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD)};
const PARENT_READY_ADMITTED: u32 = PARENT_READY | PARENT_ADMITTED;
const PARENT_KEY_WORDS: u32 = 4u;
const PARENT_EXACT_LEVEL_COUNT: u32 = 2u;

const CONTROL_FINE_LOCAL_HEAD_COUNT: u32 = 20u;
const CONTROL_COARSE_LOCAL_HEAD_COUNT: u32 = 21u;
const CONTROL_REFLUX_ROUTE_COUNT: u32 = 22u;
const CONTROL_RECEIPT_REJECTED_COUNT: u32 = 40u;
const CONTROL_IDENTITY_MISMATCH_COUNT: u32 = 41u;
const CONTROL_INVALID_FIELD_COUNT: u32 = 42u;
const CONTROL_INVALID_ROUTE_COUNT: u32 = 43u;
const CONTROL_OVERFLOW_COUNT: u32 = 44u;

fn group_count(count: u32) -> u32 {
  return count / INTERFACE_WORKGROUP_SIZE
    + select(0u, 1u, count % INTERFACE_WORKGROUP_SIZE != 0u);
}

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

// Do not form an untrusted offset + span until the span is proven to fit.
// The field and parent headers are GPU-resident inputs to a later force-law
// contract, so arithmetic wrap must fail closed instead of truncating a row.
fn range_fits(offset: u32, words: u32, capacity: u32) -> bool {
  return offset <= capacity && words <= capacity - offset;
}

fn product_fits(left: u32, right: u32, limit: u32) -> bool {
  return left == 0u || right <= limit / left;
}

fn lexicographically_less_u32x4(
  left0: u32,
  left1: u32,
  left2: u32,
  left3: u32,
  right0: u32,
  right1: u32,
  right2: u32,
  right3: u32
) -> bool {
  return left0 < right0
    || (left0 == right0 && (
      left1 < right1
      || (left1 == right1 && (
        left2 < right2
        || (left2 == right2 && left3 < right3)
      ))
    ));
}

fn control_add(word: u32, value: u32) {
  if (word < arrayLength(&proposal_control)) {
    atomicAdd(&proposal_control[word], value);
  }
}

fn control_load(word: u32) -> u32 {
  if (word >= arrayLength(&proposal_control)) { return 0u; }
  return atomicLoad(&proposal_control[word]);
}

fn control_store(word: u32, value: u32) {
  if (word < arrayLength(&proposal_control)) {
    atomicStore(&proposal_control[word], value);
  }
}

fn identity_matches(words: ptr<storage, array<u32>, read>) -> bool {
  if (arrayLength(words) < 16u) { return false; }
  return (*words)[3u] == params.generation_id
    && (*words)[4u] == params.device_ordinal
    && (*words)[5u] == params.lane_ordinal
    && (*words)[6u] == params.lease_token
    && (*words)[7u] == params.source_family_id
    && (*words)[8u] == params.storage_generation
    && (*words)[9u] == params.physics_tick
    && (*words)[10u] == params.physics_substep
    && (*words)[11u] == params.position_epoch
    && (*words)[12u] == params.topology_epoch
    && (*words)[13u] == params.chart_epoch
    && (*words)[14u] == params.level_epoch
    && (*words)[15u] == params.support_epoch;
}

fn receipt_admitted(
  receipt: ptr<storage, array<u32>, read>,
  field_capacity: u32,
  level: i32,
  completion_ordinal: u32
) -> bool {
  if (arrayLength(receipt) < RECEIPT_HEADER_WORDS) { return false; }
  let status = (*receipt)[2u];
  let global_source_count = (*receipt)[16u];
  let global_source_capacity = (*receipt)[17u];
  let field_count = (*receipt)[18u];
  let global_candidate_count = (*receipt)[20u];
  let selected_source_count = (*receipt)[47u];
  let selected_candidate_count = (*receipt)[48u];
  let source_groups = group_count(global_source_count);
  let field_groups = group_count(field_count);
  let source_capacity_groups = group_count(global_source_capacity);
  let field_capacity_groups = group_count(field_capacity);
  if (
    global_source_count == 0u
    || global_source_capacity == 0u
    || global_source_count > global_source_capacity
    || global_source_count > 0xffffffffu / STENCIL_SIZE
    || selected_source_count == 0u
    || selected_source_count > global_source_count
    || selected_source_count > 0xffffffffu / STENCIL_SIZE
    || selected_candidate_count != selected_source_count * STENCIL_SIZE
    || selected_candidate_count > global_candidate_count
    || field_count == 0u
    || field_count > field_capacity
    || field_groups > (0xffffffffu - source_groups) / 2u
    || field_capacity_groups > (0xffffffffu - source_capacity_groups) / 2u
  ) { return false; }
  let source_total = bitcast<f32>((*receipt)[30u]);
  let field_total = bitcast<f32>((*receipt)[31u]);
  let volume_residual = bitcast<f32>((*receipt)[32u]);
  let gradient_x = bitcast<f32>((*receipt)[33u]);
  let gradient_y = bitcast<f32>((*receipt)[34u]);
  let gradient_z = bitcast<f32>((*receipt)[35u]);
  let gradient_norm = bitcast<f32>((*receipt)[36u]);
  let volume_tolerance = bitcast<f32>((*receipt)[37u]);
  let gradient_tolerance = bitcast<f32>((*receipt)[38u]);
  let volume_conditioning = bitcast<f32>((*receipt)[39u]);
  let gradient_conditioning = bitcast<f32>((*receipt)[40u]);
  let seal = RECEIPT_MAGIC ^ params.generation_id ^ completion_ordinal ^ status;
  return (*receipt)[0u] == RECEIPT_MAGIC
    && (*receipt)[1u] == RECEIPT_VERSION
    && status == RECEIPT_READY_ADMITTED
    && identity_matches(receipt)
    && (*receipt)[19u] == field_capacity
    && global_candidate_count == global_source_count * STENCIL_SIZE
    && (*receipt)[21u] == bitcast<u32>(level)
    && (*receipt)[22u] > 0u
    && finite_f32(bitcast<f32>((*receipt)[23u]))
    && bitcast<f32>((*receipt)[23u]) > 0.0
    && (*receipt)[24u] == params.moment_header_words
    && (*receipt)[25u] == params.moment_row_words
    && (*receipt)[26u] == completion_ordinal
    && (*receipt)[27u] == source_groups
    && (*receipt)[28u] == field_groups
    && (*receipt)[29u] == source_capacity_groups + 2u * field_capacity_groups
    && finite_f32(source_total)
    && finite_f32(field_total)
    && finite_f32(volume_residual)
    && finite_f32(gradient_x)
    && finite_f32(gradient_y)
    && finite_f32(gradient_z)
    && finite_f32(gradient_norm)
    && finite_f32(volume_tolerance)
    && finite_f32(gradient_tolerance)
    && finite_f32(volume_conditioning)
    && finite_f32(gradient_conditioning)
    && source_total > 0.0
    && field_total > 0.0
    && gradient_norm >= 0.0
    && volume_tolerance > 0.0
    && gradient_tolerance > 0.0
    && volume_conditioning >= 0.0
    && gradient_conditioning >= 0.0
    && abs(volume_residual) <= volume_tolerance
    && gradient_norm <= gradient_tolerance
    && (*receipt)[41u] == 0u
    && (*receipt)[42u] == 0u
    && (*receipt)[43u] == 0u
    && (*receipt)[44u] == 0u
    && (*receipt)[45u] == 0u
    && (*receipt)[46u] == 0u
    && (*receipt)[47u] == selected_source_count
    && (*receipt)[48u] == selected_candidate_count
    && (*receipt)[49u] == MECHANICS_STRIDE
    && (*receipt)[50u] == RAW_VOLUME_RATIO_J_WORD
    && (*receipt)[51u] == RAW_REST_VOLUME_WORD
    && (*receipt)[52u] == 0u
    && (*receipt)[53u] == 0u
    && (*receipt)[54u] == 1u
    && (*receipt)[55u] == 0u
    && (*receipt)[56u] == source_groups
    && (*receipt)[57u] == field_groups
    && (*receipt)[58u] == RECEIPT_HEADER_WORDS
    && (*receipt)[59u] == seal;
}

fn field_dispatch_shape_admitted(
  field_view: ptr<storage, array<u32>, read>,
  field_count: u32
) -> bool {
  let group_count = field_count / FIELD_WORKGROUP_SIZE
    + select(0u, 1u, field_count % FIELD_WORKGROUP_SIZE != 0u);
  let dispatch_x = (*field_view)[60u];
  let dispatch_y = (*field_view)[61u];
  let dispatch_z = (*field_view)[62u];
  if (field_count == 0u) {
    return dispatch_x == 0u
      && dispatch_y == 0u
      && dispatch_z == 0u
      && (*field_view)[44u] == 0u
      && (*field_view)[45u] == 0u
      && (*field_view)[46u] == 0u;
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
    && (*field_view)[44u] == dispatch_x
    && (*field_view)[45u] == dispatch_y
    && (*field_view)[46u] == dispatch_z;
}

fn field_admitted(
  field_view: ptr<storage, array<u32>, read>,
  field_capacity: u32,
  level: i32,
  completion_ordinal: u32
) -> bool {
  if (arrayLength(field_view) < FIELD_HEADER_WORDS) { return false; }
  let status = (*field_view)[2u];
  let field_count = (*field_view)[34u];
  let key_offset = (*field_view)[26u];
  let key_words = (*field_view)[27u];
  let key_end = key_offset + field_count * FIELD_KEY_WORDS;
  let source_count = (*field_view)[16u];
  let candidate_count = (*field_view)[33u];
  let grid_node_count = (*field_view)[18u];
  let grid_dim_x = (*field_view)[19u];
  let grid_dim_y = (*field_view)[20u];
  let grid_dim_z = (*field_view)[21u];
  let grid_xy = grid_dim_x * grid_dim_y;
  let accumulator_offset = (*field_view)[28u];
  let state_offset = (*field_view)[30u];
  let required_words = (*field_view)[41u];
  let capacity_words = (*field_view)[42u];
  // Mechanics-field view v5 appends immutable pressure rows after the
  // state-capacity bank. The pressure offset is always derived from the
  // state bank, never uploaded as a separate word, so required/capacity
  // words now bound the pressure tail rather than the state tail.
  if (field_capacity > (0xffffffffu - state_offset) / FIELD_STATE_WORDS) {
    return false;
  }
  let pressure_offset = state_offset + field_capacity * FIELD_STATE_WORDS;
  if (
    key_offset < FIELD_HEADER_WORDS
    || accumulator_offset < key_offset
    || state_offset < accumulator_offset
    || state_offset - accumulator_offset < FIELD_RECEIPT_WORDS
    || required_words < pressure_offset
    || capacity_words < required_words
    || capacity_words > arrayLength(field_view)
  ) { return false; }
  let descriptor_span = key_offset - FIELD_HEADER_WORDS;
  let key_span = accumulator_offset - key_offset;
  let accumulator_span = state_offset - accumulator_offset - FIELD_RECEIPT_WORDS;
  let pressure_required_span = required_words - pressure_offset;
  let pressure_capacity_span = capacity_words - pressure_offset;
  if (
    descriptor_span % FIELD_DESCRIPTOR_WORDS != 0u
    || descriptor_span / FIELD_DESCRIPTOR_WORDS < source_count
    || key_span % FIELD_KEY_WORDS != 0u
    || key_span / FIELD_KEY_WORDS != field_capacity
    || accumulator_span % FIELD_ACCUMULATOR_WORDS != 0u
    || accumulator_span / FIELD_ACCUMULATOR_WORDS != field_capacity
    || pressure_required_span % FIELD_PRESSURE_WORDS != 0u
    || pressure_required_span / FIELD_PRESSURE_WORDS != field_count
    || pressure_capacity_span % FIELD_PRESSURE_WORDS != 0u
    || pressure_capacity_span / FIELD_PRESSURE_WORDS != field_capacity
    || grid_xy * grid_dim_z != grid_node_count
  ) { return false; }
  return (*field_view)[0u] == FIELD_MAGIC
    && (*field_view)[1u] == FIELD_VERSION
    && status == FIELD_READY_ADMITTED
    && identity_matches(field_view)
    && source_count > 0u
    && source_count <= 0xffffffffu / STENCIL_SIZE
    && (*field_view)[17u] == bitcast<u32>(level)
    && grid_node_count > 0u
    && grid_dim_x > 0u
    && grid_dim_y > 0u
    && grid_dim_z > 0u
    && finite_f32(bitcast<f32>((*field_view)[23u]))
    && bitcast<f32>((*field_view)[23u]) > 0.0
    && (*field_view)[24u] == FIELD_HEADER_WORDS
    && (*field_view)[25u] == FIELD_DESCRIPTOR_WORDS
    && (*field_view)[32u] == field_capacity
    // ActiveSource-v2 fields retain the physical source count at word 16,
    // while word 33 seals only the compact active candidate domain.  Keep
    // dense-v1 admissible, but do not reinterpret a compact candidate count
    // as though every physical source were active.
    && candidate_count > 0u
    && candidate_count % STENCIL_SIZE == 0u
    && candidate_count <= source_count * STENCIL_SIZE
    && field_count > 0u
    && field_count <= field_capacity
    && (*field_view)[35u] == 0u
    && (*field_view)[37u] == 0u
    && (*field_view)[38u] == completion_ordinal
    && (*field_view)[39u] == 1u
    && (*field_view)[40u] == 1u
    && key_offset >= FIELD_HEADER_WORDS
    && key_words == FIELD_KEY_WORDS
    && key_end >= key_offset
    && key_end <= arrayLength(field_view)
    && (*field_view)[28u] >= key_offset
    && (*field_view)[29u] == FIELD_ACCUMULATOR_WORDS
    && (*field_view)[30u] >= (*field_view)[28u]
    && (*field_view)[31u] == FIELD_STATE_WORDS
    && (*field_view)[41u] >= (*field_view)[30u]
    && (*field_view)[42u] >= (*field_view)[41u]
    && (*field_view)[42u] <= arrayLength(field_view)
    && (*field_view)[43u] == 0u
    && (*field_view)[47u] == FIELD_PARENT_MECHANICS_MAGIC
    && (*field_view)[48u] == FIELD_PARENT_MECHANICS_VERSION
    && (*field_view)[50u] == params.generation_id
    && (*field_view)[51u] == (*field_view)[33u]
    && (*field_view)[53u] == 1u
    && (*field_view)[54u] == source_count
    && (*field_view)[55u] == 1u
    && (*field_view)[56u] == 1u
    && (*field_view)[57u] == 1u
    && (*field_view)[58u] == 0u
    && (*field_view)[59u] == 0u
    && field_dispatch_shape_admitted(field_view, field_count)
    && (*field_view)[63u] == 0u;
}

fn receipt_matches_field(
  receipt: ptr<storage, array<u32>, read>,
  field_view: ptr<storage, array<u32>, read>
) -> bool {
  if (
    arrayLength(receipt) < RECEIPT_HEADER_WORDS
    || arrayLength(field_view) < FIELD_HEADER_WORDS
  ) { return false; }
  let descriptor_offset = (*field_view)[24u];
  let key_offset = (*field_view)[26u];
  if (key_offset < descriptor_offset) { return false; }
  let descriptor_span = key_offset - descriptor_offset;
  return descriptor_span % FIELD_DESCRIPTOR_WORDS == 0u
    && descriptor_span / FIELD_DESCRIPTOR_WORDS == (*receipt)[17u]
    // The receipt scans the compact active-source domain, whereas the field
    // header retains the physical source domain.  Candidate equality below,
    // together with receipt_admitted()'s exact count seal, binds the two.
    && (*receipt)[16u] > 0u
    && (*receipt)[16u] <= (*field_view)[16u]
    && (*field_view)[17u] == (*receipt)[21u]
    && (*field_view)[18u] == (*receipt)[22u]
    && (*field_view)[23u] == (*receipt)[23u]
    && (*field_view)[32u] == (*receipt)[19u]
    && (*field_view)[33u] == (*receipt)[20u]
    && (*field_view)[34u] == (*receipt)[18u]
    && (*field_view)[38u] == (*receipt)[26u];
}

fn field_count(field_view: ptr<storage, array<u32>, read>) -> u32 {
  if (arrayLength(field_view) < FIELD_HEADER_WORDS) { return 0u; }
  return (*field_view)[34u];
}

fn field_dense_node(field_view: ptr<storage, array<u32>, read>, index: u32) -> u32 {
  let key_offset = (*field_view)[26u];
  return (*field_view)[key_offset + index * FIELD_KEY_WORDS];
}

fn field_key_valid(field_view: ptr<storage, array<u32>, read>, index: u32) -> bool {
  let declared_field_count = field_count(field_view);
  let key_offset = (*field_view)[26u];
  if (
    index >= declared_field_count
    || key_offset > arrayLength(field_view)
    || !product_fits(index, FIELD_KEY_WORDS, arrayLength(field_view) - key_offset)
  ) { return false; }
  let relative = index * FIELD_KEY_WORDS;
  if (
    relative > arrayLength(field_view) - key_offset
    || FIELD_KEY_WORDS > arrayLength(field_view) - key_offset - relative
  ) {
    return false;
  }
  let key = key_offset + relative;
  let node = (*field_view)[key];
  let family = (*field_view)[key + 1u];
  let material = (*field_view)[key + 2u];
  let domain = (*field_view)[key + 3u];
  return node < (*field_view)[18u]
    && family >= 1u
    && family <= 4u
    && material >= 1u
    && material <= 0x00ffffffu
    && select(domain == 0u, domain != 0u, family == 1u);
}

fn field_key_ordered(field_view: ptr<storage, array<u32>, read>, index: u32) -> bool {
  if (index == 0u) { return field_key_valid(field_view, index); }
  if (!field_key_valid(field_view, index - 1u) || !field_key_valid(field_view, index)) {
    return false;
  }
  let key_offset = (*field_view)[26u];
  let previous = key_offset + (index - 1u) * FIELD_KEY_WORDS;
  let current = key_offset + index * FIELD_KEY_WORDS;
  return lexicographically_less_u32x4(
    (*field_view)[previous],
    (*field_view)[previous + 1u],
    (*field_view)[previous + 2u],
    (*field_view)[previous + 3u],
    (*field_view)[current],
    (*field_view)[current + 1u],
    (*field_view)[current + 2u],
    (*field_view)[current + 3u]
  );
}

fn parent_admitted() -> bool {
  if (arrayLength(&parent_field_view) < PARENT_HEADER_WORDS) { return false; }
  let status = parent_field_view[2u];
  let fine_capacity = params.fine_field_capacity;
  let coarse_capacity = params.coarse_field_capacity;
  let fine_count = field_count(&fine_field_view);
  let coarse_count = field_count(&coarse_field_view);
  if (
    status != PARENT_READY_ADMITTED
    || !identity_matches(&parent_field_view)
    || parent_field_view[0u] != PARENT_MAGIC
    || parent_field_view[1u] != PARENT_VERSION
    || parent_field_view[16u] != bitcast<u32>(params.fine_level)
    || parent_field_view[17u] != bitcast<u32>(params.coarse_level)
    || params.coarse_level != params.fine_level + 1
    || parent_field_view[18u] != fine_field_view[18u]
    || parent_field_view[19u] != coarse_field_view[18u]
    || parent_field_view[20u] != fine_field_view[19u]
    || parent_field_view[21u] != fine_field_view[20u]
    || parent_field_view[22u] != fine_field_view[21u]
    || parent_field_view[23u] != coarse_field_view[19u]
    || parent_field_view[24u] != coarse_field_view[20u]
    || parent_field_view[25u] != coarse_field_view[21u]
    || parent_field_view[26u] != fine_field_view[22u]
    || parent_field_view[27u] != coarse_field_view[22u]
    || parent_field_view[28u] != fine_field_view[23u]
    || parent_field_view[29u] != coarse_field_view[23u]
    || !finite_f32(bitcast<f32>(parent_field_view[28u]))
    || !finite_f32(bitcast<f32>(parent_field_view[29u]))
    || bitcast<f32>(parent_field_view[28u]) <= 0.0
    || bitcast<f32>(parent_field_view[29u]) <= 0.0
    || bitcast<u32>(bitcast<f32>(parent_field_view[28u]) * 2.0) != parent_field_view[29u]
    || fine_capacity > (0xffffffffu - coarse_capacity) / PARENT_MAX_EDGES
  ) { return false; }
  let fine_candidate_capacity = fine_capacity * PARENT_MAX_EDGES;
  let candidate_capacity = fine_candidate_capacity + coarse_capacity;
  let parent_capacity = parent_field_view[33u];
  let edge_capacity = parent_field_view[34u];
  let parent_count = parent_field_view[37u];
  let edge_count = parent_field_view[38u];
  if (
    parent_field_view[30u] != fine_capacity
    || parent_field_view[31u] != coarse_capacity
    || parent_field_view[32u] != candidate_capacity
    || parent_capacity != candidate_capacity
    || edge_capacity != fine_candidate_capacity
    || parent_field_view[35u] != fine_count
    || parent_field_view[36u] != coarse_count
    || parent_count == 0u
    || parent_count > parent_capacity
    || edge_count < fine_count
    || edge_count > edge_capacity
    || parent_field_view[39u] != 0u
    || parent_field_view[40u] != 0u
    || parent_field_view[41u] != 0u
    || parent_field_view[71u] != 0u
    || !finite_f32(bitcast<f32>(parent_field_view[42u]))
    || !finite_f32(bitcast<f32>(parent_field_view[43u]))
    || bitcast<f32>(parent_field_view[42u]) < 0.0
    || bitcast<f32>(parent_field_view[43u]) < 0.0
    || parent_field_view[44u] != params.parent_field_completion_ordinal
    || parent_field_view[45u] == 0u
    || parent_field_view[46u] != fine_field_view[38u]
    || parent_field_view[47u] != coarse_field_view[38u]
    || parent_field_view[48u] != PARENT_HEADER_WORDS
    || parent_field_view[49u] != PARENT_KEY_WORDS
  ) { return false; }
  let parent_key_offset = parent_field_view[48u];
  let fine_edge_count_offset = parent_field_view[50u];
  let fine_edge_offset = parent_field_view[51u];
  let fine_edge_parent = parent_field_view[52u];
  let fine_edge_weight = parent_field_view[53u];
  let coarse_native_map = parent_field_view[54u];
  let required_words = parent_field_view[55u];
  let capacity_words = parent_field_view[56u];
  if (!product_fits(parent_capacity, PARENT_KEY_WORDS, arrayLength(&parent_field_view))) {
    return false;
  }
  let parent_key_words = parent_capacity * PARENT_KEY_WORDS;
  if (
    !range_fits(parent_key_offset, parent_key_words, arrayLength(&parent_field_view))
    || !range_fits(fine_edge_count_offset, fine_capacity, arrayLength(&parent_field_view))
    || !range_fits(fine_edge_offset, fine_capacity + 1u, arrayLength(&parent_field_view))
    || !range_fits(fine_edge_parent, edge_capacity, arrayLength(&parent_field_view))
    || !range_fits(fine_edge_weight, edge_capacity, arrayLength(&parent_field_view))
    || !range_fits(coarse_native_map, coarse_capacity, arrayLength(&parent_field_view))
    || capacity_words > arrayLength(&parent_field_view)
  ) { return false; }
  let expected_fine_edge_count_offset = parent_key_offset + parent_key_words;
  let expected_fine_edge_offset = fine_edge_count_offset + fine_capacity;
  let expected_fine_edge_parent = fine_edge_offset + fine_capacity + 1u;
  let expected_fine_edge_weight = fine_edge_parent + edge_capacity;
  let expected_coarse_native_map = fine_edge_weight + edge_capacity;
  let expected_required_words = coarse_native_map + coarse_capacity;
  if (
    fine_edge_count_offset != expected_fine_edge_count_offset
    || fine_edge_offset != expected_fine_edge_offset
    || fine_edge_parent != expected_fine_edge_parent
    || fine_edge_weight != expected_fine_edge_weight
    || coarse_native_map != expected_coarse_native_map
    || required_words != expected_required_words
    || capacity_words != required_words
  ) { return false; }
  return parent_field_view[57u] == params.generation_id
    // The parent view radix-sorts only the authenticated live candidate
    // prefix (fine_count * PARENT_MAX_EDGES fine rows plus coarse_count
    // native rows), so word 58 seals that live domain rather than the full
    // candidate capacity tail.
    && fine_count <= fine_capacity
    && coarse_count <= coarse_capacity
    && parent_field_view[58u] == fine_count * PARENT_MAX_EDGES + coarse_count
    && (
      parent_field_view[59u] == parent_count
      || (parent_count < 0xffffffffu && parent_field_view[59u] == parent_count + 1u)
    )
    && parent_field_view[60u] == group_count(parent_count)
    && parent_field_view[61u] == 1u
    && parent_field_view[62u] == 1u
    && parent_field_view[63u] == parent_field_view[44u]
    && parent_field_view[64u] == group_count(fine_count)
    && parent_field_view[65u] == 1u
    && parent_field_view[66u] == 1u
    && parent_field_view[67u] == PARENT_EXACT_LEVEL_COUNT
    && parent_field_view[68u] == group_count(coarse_count)
    && parent_field_view[69u] == 1u
    && parent_field_view[70u] == 1u
    && parent_field_view[72u] == edge_count + coarse_count
    && parent_field_view[73u] == coarse_count
    && parent_field_view[74u] == edge_count
    && parent_field_view[75u] == 1u
    && parent_field_view[76u] == PARENT_MAX_EDGES
    && parent_field_view[77u] == required_words
    && parent_field_view[78u] == 0u
    && parent_field_view[79u] == 0u;
}

fn parent_key_valid(parent_index: u32) -> bool {
  let parent_count = parent_field_view[37u];
  let key_offset = parent_field_view[48u];
  if (
    parent_index >= parent_count
    || key_offset > arrayLength(&parent_field_view)
    || !product_fits(parent_index, PARENT_KEY_WORDS, arrayLength(&parent_field_view) - key_offset)
  ) { return false; }
  let relative = parent_index * PARENT_KEY_WORDS;
  if (
    relative > arrayLength(&parent_field_view) - key_offset
    || PARENT_KEY_WORDS > arrayLength(&parent_field_view) - key_offset - relative
  ) { return false; }
  let key = key_offset + relative;
  let node = parent_field_view[key];
  let family = parent_field_view[key + 1u];
  let material = parent_field_view[key + 2u];
  let domain = parent_field_view[key + 3u];
  return node < parent_field_view[19u]
    && family >= 1u
    && family <= 4u
    && material >= 1u
    && material <= 0x00ffffffu
    && select(domain == 0u, domain != 0u, family == 1u);
}

fn emit_local_head(
  field_view: ptr<storage, array<u32>, read>,
  index: u32,
  field_count: u32,
  field_capacity: u32,
  level: i32,
  offset_words: u32,
  is_fine: bool,
  receipt_ok: bool,
  field_ok: bool,
  lineage_ok: bool
) {
  if (index >= field_count) { return; }
  if (!receipt_ok) {
    control_add(CONTROL_RECEIPT_REJECTED_COUNT, 1u);
    return;
  }
  if (!field_ok) {
    control_add(CONTROL_INVALID_FIELD_COUNT, 1u);
    return;
  }
  if (!lineage_ok) {
    control_add(CONTROL_IDENTITY_MISMATCH_COUNT, 1u);
    return;
  }
  if (field_count > field_capacity) {
    control_add(CONTROL_OVERFLOW_COUNT, 1u);
    return;
  }
  if (!field_key_ordered(field_view, index)) {
    control_add(CONTROL_INVALID_FIELD_COUNT, 1u);
    return;
  }
  let node = field_dense_node(field_view, index);
  if (index > 0u && field_dense_node(field_view, index - 1u) == node) {
    return;
  }
  var end = index + 1u;
  loop {
    if (end >= field_count || field_dense_node(field_view, end) != node) { break; }
    end = end + 1u;
  }
  if (end - index < 2u) { return; }
  let row_offset = offset_words + index * LOCAL_HEAD_WORDS;
  if (
    row_offset < offset_words
    || row_offset + LOCAL_HEAD_WORDS < row_offset
    || row_offset + LOCAL_HEAD_WORDS > arrayLength(&local_head_rows)
  ) {
    control_add(CONTROL_OVERFLOW_COUNT, 1u);
    return;
  }
  local_head_rows[row_offset + 0u] = index;
  local_head_rows[row_offset + 1u] = node;
  local_head_rows[row_offset + 2u] = end;
  local_head_rows[row_offset + 3u] = bitcast<u32>(level);
  local_head_rows[row_offset + 4u] = params.local_policy_id;
  local_head_rows[row_offset + 5u] = ROW_READY_ADMITTED;
  local_head_rows[row_offset + 6u] = 0u;
  local_head_rows[row_offset + 7u] = 0u;
  if (is_fine) {
    control_add(CONTROL_FINE_LOCAL_HEAD_COUNT, 1u);
  } else {
    control_add(CONTROL_COARSE_LOCAL_HEAD_COUNT, 1u);
  }
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_WORKGROUP_SIZE})
fn emit_phase_volume_interface_local_heads(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let fine_count = field_count(&fine_field_view);
  let fine_receipt_ok = receipt_admitted(
    &fine_receipt,
    params.fine_field_capacity,
    params.fine_level,
    params.fine_receipt_completion_ordinal
  );
  let fine_field_ok = field_admitted(
    &fine_field_view,
    params.fine_field_capacity,
    params.fine_level,
    params.fine_receipt_completion_ordinal
  );
  let fine_lineage_ok = receipt_matches_field(&fine_receipt, &fine_field_view);
  emit_local_head(
    &fine_field_view,
    index,
    fine_count,
    params.fine_field_capacity,
    params.fine_level,
    params.fine_local_head_offset_words,
    true,
    fine_receipt_ok,
    fine_field_ok,
    fine_lineage_ok
  );
  if (params.two_level == 0u) { return; }
  let coarse_count = field_count(&coarse_field_view);
  let coarse_receipt_ok = receipt_admitted(
    &coarse_receipt,
    params.coarse_field_capacity,
    params.coarse_level,
    params.coarse_receipt_completion_ordinal
  );
  let coarse_field_ok = field_admitted(
    &coarse_field_view,
    params.coarse_field_capacity,
    params.coarse_level,
    params.coarse_receipt_completion_ordinal
  );
  let coarse_lineage_ok = receipt_matches_field(&coarse_receipt, &coarse_field_view);
  emit_local_head(
    &coarse_field_view,
    index,
    coarse_count,
    params.coarse_field_capacity,
    params.coarse_level,
    params.coarse_local_head_offset_words,
    false,
    coarse_receipt_ok,
    coarse_field_ok,
    coarse_lineage_ok
  );
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_WORKGROUP_SIZE})
fn emit_phase_volume_interface_reflux_routes(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= field_count(&fine_field_view) || params.parent_routes_enabled == 0u) { return; }
  let fine_field_ok = field_admitted(
    &fine_field_view,
    params.fine_field_capacity,
    params.fine_level,
    params.fine_receipt_completion_ordinal
  );
  let coarse_field_ok = field_admitted(
    &coarse_field_view,
    params.coarse_field_capacity,
    params.coarse_level,
    params.coarse_receipt_completion_ordinal
  );
  if (!fine_field_ok || !coarse_field_ok || !field_key_ordered(&fine_field_view, index)) {
    control_add(CONTROL_INVALID_FIELD_COUNT, 1u);
    return;
  }
  if (!parent_admitted()) {
    control_add(CONTROL_INVALID_ROUTE_COUNT, 1u);
    return;
  }
  let fine_count = field_count(&fine_field_view);
  let edge_count_offset = parent_field_view[50u];
  let offset_base = parent_field_view[51u];
  let edge_begin = parent_field_view[offset_base + index];
  let edge_end = parent_field_view[offset_base + index + 1u];
  let declared_edge_count = parent_field_view[edge_count_offset + index];
  let edge_count = parent_field_view[38u];
  if (
    edge_end < edge_begin
    || edge_begin >= edge_count
    || edge_end > edge_count
    || edge_end == edge_begin
    || edge_end - edge_begin > PARENT_MAX_EDGES
    || edge_end - edge_begin != declared_edge_count
    || (index == 0u && edge_begin != 0u)
    || (index + 1u == fine_count && edge_end != edge_count)
    || index >= params.reflux_route_capacity
  ) {
    control_add(CONTROL_INVALID_ROUTE_COUNT, 1u);
    return;
  }
  var edge = edge_begin;
  loop {
    if (edge >= edge_end) { break; }
    let parent_index = parent_field_view[parent_field_view[52u] + edge];
    let weight = bitcast<f32>(parent_field_view[parent_field_view[53u] + edge]);
    if (
      parent_index == INVALID_INDEX
      || !parent_key_valid(parent_index)
      || !finite_f32(weight)
      || !(weight > 0.0)
    ) {
      control_add(CONTROL_INVALID_ROUTE_COUNT, 1u);
      return;
    }
    edge = edge + 1u;
  }
  let row_offset = index * REFLUX_ROUTE_WORDS;
  if (row_offset + REFLUX_ROUTE_WORDS < row_offset || row_offset + REFLUX_ROUTE_WORDS > arrayLength(&reflux_route_rows)) {
    control_add(CONTROL_OVERFLOW_COUNT, 1u);
    return;
  }
  reflux_route_rows[row_offset + 0u] = index;
  reflux_route_rows[row_offset + 1u] = edge_begin;
  reflux_route_rows[row_offset + 2u] = edge_end;
  reflux_route_rows[row_offset + 3u] = bitcast<u32>(params.fine_level);
  reflux_route_rows[row_offset + 4u] = bitcast<u32>(params.coarse_level);
  reflux_route_rows[row_offset + 5u] = params.parent_field_completion_ordinal;
  reflux_route_rows[row_offset + 6u] = ROW_READY_ADMITTED;
  reflux_route_rows[row_offset + 7u] = params.reflux_policy_id;
  control_add(CONTROL_REFLUX_ROUTE_COUNT, 1u);
}

@compute @workgroup_size(1)
fn finalize_phase_volume_interface_proposal() {
  let fine_count = field_count(&fine_field_view);
  let coarse_count = select(0u, field_count(&coarse_field_view), params.two_level == 1u);
  let fine_receipt_ok = receipt_admitted(
    &fine_receipt,
    params.fine_field_capacity,
    params.fine_level,
    params.fine_receipt_completion_ordinal
  );
  let fine_field_ok = field_admitted(
    &fine_field_view,
    params.fine_field_capacity,
    params.fine_level,
    params.fine_receipt_completion_ordinal
  );
  let fine_lineage_ok = receipt_matches_field(&fine_receipt, &fine_field_view);
  let one_level_ok = params.two_level == 0u
    && params.parent_routes_enabled == 0u
    && bitcast<u32>(params.coarse_level) == 0x80000000u
    && params.coarse_field_capacity == 0u;
  let two_level_ok = params.two_level == 1u
    && params.parent_routes_enabled == 1u
    && params.coarse_field_capacity > 0u
    && params.coarse_level == params.fine_level + 1
    && receipt_admitted(
      &coarse_receipt,
      params.coarse_field_capacity,
      params.coarse_level,
      params.coarse_receipt_completion_ordinal
    )
    && field_admitted(
      &coarse_field_view,
      params.coarse_field_capacity,
      params.coarse_level,
      params.coarse_receipt_completion_ordinal
    )
    && receipt_matches_field(&coarse_receipt, &coarse_field_view);
  let parent_ok = one_level_ok || (two_level_ok && parent_admitted());
  let fine_heads = control_load(CONTROL_FINE_LOCAL_HEAD_COUNT);
  let coarse_heads = control_load(CONTROL_COARSE_LOCAL_HEAD_COUNT);
  let routes = control_load(CONTROL_REFLUX_ROUTE_COUNT);
  let receipt_rejected = control_load(CONTROL_RECEIPT_REJECTED_COUNT);
  let identity_mismatch = control_load(CONTROL_IDENTITY_MISMATCH_COUNT);
  let invalid_field = control_load(CONTROL_INVALID_FIELD_COUNT);
  let invalid_route = control_load(CONTROL_INVALID_ROUTE_COUNT);
  let overflow = control_load(CONTROL_OVERFLOW_COUNT);
  let route_coverage_ok = select(
    routes == fine_count,
    routes == 0u,
    params.two_level == 0u
  );
  let counts_ok = fine_count > 0u
    && fine_heads <= fine_count
    && coarse_heads <= coarse_count
    && routes <= params.reflux_route_capacity
    && route_coverage_ok
    && params.local_head_capacity == params.fine_field_capacity + params.coarse_field_capacity
    && params.local_head_words == params.local_head_capacity * LOCAL_HEAD_WORDS
    && params.reflux_route_words == params.reflux_route_capacity * REFLUX_ROUTE_WORDS
    && params.control_words == INTERFACE_HEADER_WORDS
    && params.local_policy_id == LOCAL_POLICY
    && params.reflux_policy_id == REFLUX_POLICY
    && params.moment_header_words > 0u
    && params.moment_row_words > 0u
    && params.parent_field_header_words == PARENT_HEADER_WORDS
    && group_count(params.fine_field_capacity) > 0u
    && (one_level_ok || two_level_ok);
  let admitted = fine_receipt_ok
    && fine_field_ok
    && fine_lineage_ok
    && (one_level_ok || two_level_ok)
    && parent_ok
    && receipt_rejected == 0u
    && identity_mismatch == 0u
    && invalid_field == 0u
    && invalid_route == 0u
    && overflow == 0u
    && counts_ok;
  var flags = INTERFACE_READY | INTERFACE_ADMITTED;
  var public_fine_heads = fine_heads;
  var public_coarse_heads = coarse_heads;
  var public_routes = routes;
  if (!admitted) {
    flags = INTERFACE_FAIL_CLOSED;
    if (!fine_receipt_ok || (!two_level_ok && !one_level_ok) || receipt_rejected != 0u) {
      flags = flags | INTERFACE_RECEIPT_REJECTED;
    }
    if (identity_mismatch != 0u || !fine_field_ok || !fine_lineage_ok || (!two_level_ok && !one_level_ok)) {
      flags = flags | INTERFACE_IDENTITY_MISMATCH;
    }
    if (!fine_field_ok || !fine_lineage_ok || invalid_field != 0u) { flags = flags | INTERFACE_INVALID_FIELD; }
    if (!parent_ok || invalid_route != 0u) { flags = flags | INTERFACE_INVALID_ROUTE; }
    if (!counts_ok || overflow != 0u) { flags = flags | INTERFACE_CAPACITY_OVERFLOW; }
    public_fine_heads = 0u;
    public_coarse_heads = 0u;
    public_routes = 0u;
  }

  control_store(0u, INTERFACE_MAGIC);
  control_store(1u, INTERFACE_VERSION);
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
  control_store(16u, select(0u, fine_count, admitted));
  control_store(17u, params.fine_field_capacity);
  control_store(18u, select(0u, coarse_count, admitted));
  control_store(19u, params.coarse_field_capacity);
  control_store(20u, public_fine_heads);
  control_store(21u, public_coarse_heads);
  control_store(22u, public_routes);
  control_store(23u, bitcast<u32>(params.fine_level));
  control_store(24u, bitcast<u32>(params.coarse_level));
  control_store(25u, params.two_level);
  control_store(26u, params.parent_routes_enabled);
  control_store(27u, params.fine_receipt_completion_ordinal);
  control_store(28u, params.coarse_receipt_completion_ordinal);
  control_store(29u, params.parent_field_completion_ordinal);
  control_store(30u, params.fine_local_head_offset_words);
  control_store(31u, params.coarse_local_head_offset_words);
  control_store(32u, params.local_head_capacity);
  control_store(33u, params.reflux_route_capacity);
  control_store(34u, LOCAL_HEAD_WORDS);
  control_store(35u, REFLUX_ROUTE_WORDS);
  control_store(36u, params.moment_header_words);
  control_store(37u, params.moment_row_words);
  control_store(38u, params.parent_field_header_words);
  control_store(39u, select(0u, fine_count + coarse_count, admitted));
  control_store(40u, receipt_rejected);
  control_store(41u, identity_mismatch);
  control_store(42u, invalid_field);
  control_store(43u, invalid_route);
  control_store(44u, overflow);
  control_store(45u, 0u);
  control_store(46u, 0u);
  control_store(47u, 1u);
  control_store(48u, 0u);
  // The terminal seal is intentionally the final write.  It binds the full
  // route lineage rather than merely the fine receipt completion fence.
  control_store(
    49u,
    INTERFACE_MAGIC
      ^ params.generation_id
      ^ params.fine_receipt_completion_ordinal
      ^ params.coarse_receipt_completion_ordinal
      ^ params.parent_field_completion_ordinal
      ^ bitcast<u32>(params.fine_level)
      ^ bitcast<u32>(params.coarse_level)
      ^ params.fine_field_capacity
      ^ params.coarse_field_capacity
      ^ params.two_level
      ^ params.parent_routes_enabled
      ^ flags
  );
  control_store(50u, params.local_policy_id);
  control_store(51u, params.reflux_policy_id);
  control_store(52u, group_count(params.fine_field_capacity));
  control_store(53u, select(0u, group_count(params.coarse_field_capacity), params.two_level != 0u));
  control_store(54u, select(0u, group_count(params.fine_field_capacity), params.parent_routes_enabled != 0u));
  control_store(55u, INTERFACE_HEADER_WORDS);
  control_store(56u, 0u);
  control_store(57u, 0u);
  control_store(58u, 0u);
  control_store(59u, 0u);
  control_store(60u, 0u);
  control_store(61u, 0u);
  control_store(62u, 0u);
  control_store(63u, 0u);
}
`;
}
