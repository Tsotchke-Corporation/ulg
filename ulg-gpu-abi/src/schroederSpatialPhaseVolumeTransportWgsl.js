import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_BUILDING,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_LAW_EXACT_P2G,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION
} from './schroederSpatialMechanicsFieldView.js';
import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_POLICY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_MAGIC,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_VERSION,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_READY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_READY
} from './schroederSpatialPhaseVolumeInterfaceProposal.js';
import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY
} from './schroederSpatialPhaseVolumeMoment.js';
import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_MAGIC,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_VERSION
} from './schroederSpatialPhaseVolumeReceipt.js';
import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_MAGIC,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_READY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_VERSION,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE
} from './schroederSpatialPhaseVolumeTransport.js';
import {
  schroederSpatialPhaseVolumePressureDragOperatorWgsl
} from './schroederSpatialPhaseVolumePressureDragOperatorWgsl.js';

const u32 = (value) => `${Number(value) >>> 0}u`;

/**
 * The first twenty words match the mechanics-field GridUpdateParams ABI.
 * Existing grid-update entry points ignore the authenticated transport tail.
 */
export const schroederSpatialPhaseVolumeTransportWgsl = /* wgsl */ `
struct PhaseVolumeTransportParams {
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  receipt_mode_flags: u32,
  field_mutation_input_ordinal: u32,
  field_mutation_output_ordinal: u32,
  grid_spacing_m: f32,
  dt: f32,
  gravity_x: f32,
  gravity_y: f32,
  gravity_z: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  cfl_factor: f32,
  wall_stiffness: f32,
  wall_contact_scale: f32,
  wall_min_gap_m: f32,
  transport_enabled: u32,
  phase_record_count: u32,
  selected_level: i32,
  field_capacity: u32,
  local_head_offset_words: u32,
  generation_id: u32,
  field_completion_ordinal: u32,
  other_receipt_completion_ordinal: u32,
  parent_field_completion_ordinal: u32,
  fine_level: i32,
  coarse_level: i32,
  level_index: u32,
  ambient_pressure_pa: f32,
  ambient_density_kg_per_m3: f32,
  pressure_scale: f32,
  drag_scale: f32,
  max_impulse_fraction: f32,
  reserved_f0: f32,
  reserved_f1: f32,
  reserved_f2: f32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
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
  reserved12: u32,
  reserved13: u32,
  reserved14: u32,
  reserved15: u32,
};

struct PhaseMechanics {
  rest_density: f32,
  sound_speed: f32,
  dynamic_viscosity: f32,
  status: f32,
};

@group(0) @binding(0) var<storage, read_write> field_view: array<atomic<u32>>;
@group(0) @binding(1) var<storage, read> proposal_control: array<u32>;
@group(0) @binding(2) var<storage, read> local_heads: array<u32>;
@group(0) @binding(3) var<storage, read> receipt_control: array<u32>;
@group(0) @binding(4) var<storage, read> moment_rows: array<u32>;
@group(0) @binding(5) var<storage, read> material_phase_records: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: PhaseVolumeTransportParams;
@group(0) @binding(7) var<storage, read_write> transport_scratch: array<atomic<u32>>;

${schroederSpatialPhaseVolumePressureDragOperatorWgsl}

const FIELD_HEADER_WORDS: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS)};
const FIELD_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC)};
const FIELD_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION)};
const FIELD_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED
)};
const FIELD_FAIL_CLOSED: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
)};
const FIELD_STATE_EMPTY: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY
)};
const FIELD_KEY_WORDS: u32 = 4u;
const FIELD_WORKGROUP_SIZE: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE
)};
const FIELD_ACCUMULATOR_WORDS: u32 = 8u;
const FIELD_STATE_WORDS: u32 = 8u;
const FIELD_PRESSURE_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS
)};
const FIELD_RECEIPT_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS
)};
const FIELD_RECEIPT_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC)};
const FIELD_RECEIPT_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION)};
const FIELD_RECEIPT_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED
)};
const FIELD_RECEIPT_FAIL_CLOSED: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_FAIL_CLOSED
)};
const FIELD_RECEIPT_HEAT_BUILDING: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_BUILDING
)};
const FIELD_PRESSURE_MAGIC: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC
)};
const FIELD_PRESSURE_VERSION: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION
)};
const FIELD_PRESSURE_LAW_EXACT: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_LAW_EXACT_P2G
)};
const FIELD_PRESSURE_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_ADMITTED
)};
const FIELD_PRESSURE_FAIL_CLOSED: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_FAIL_CLOSED
)};
const FIELD_PRESSURE_CONSUMER_LOCAL: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL
)};
const PROPOSAL_HEADER_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS
)};
const PROPOSAL_MAGIC: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_MAGIC
)};
const PROPOSAL_VERSION: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_VERSION
)};
const PROPOSAL_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_READY
    | SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_ADMITTED
)};
const LOCAL_HEAD_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_HEAD_WORDS
)};
const LOCAL_POLICY: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_LOCAL_POLICY
)};
const LOCAL_ROW_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_READY
    | SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_ADMITTED
)};
const RECEIPT_HEADER_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS
)};
const RECEIPT_MAGIC: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_MAGIC
)};
const RECEIPT_VERSION: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_VERSION
)};
const RECEIPT_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY
    | SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED
)};
const MOMENT_ROW_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS
)};
const MOMENT_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY
    | SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED
)};
const PHASE_SOLID: u32 = 1u;
const PHASE_GAS: u32 = 3u;
const PHASE_PLASMA: u32 = 4u;
const ACC_LOCAL_HEAT: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR.localHeatJ
)};
const ACC_LOCAL_HEAT_COUNT: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR.localHeatContributionCount
)};
const ACC_PRESSURE_COMPENSATION: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR.localPressureInternalCompensationJ
)};
const ACC_AMBIENT_IMPULSE_X: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR.ambientImpulseXNs
)};
const ACC_AMBIENT_IMPULSE_Y: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR.ambientImpulseYNs
)};
const ACC_AMBIENT_IMPULSE_Z: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR.ambientImpulseZNs
)};
const ACC_AMBIENT_WORK: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR.ambientWorkJ
)};
const SCRATCH_MAGIC: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_MAGIC
)};
const SCRATCH_VERSION: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_VERSION
)};
const SCRATCH_HEADER_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_HEADER_WORDS
)};
const SCRATCH_ROW_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS
)};
const SCRATCH_ROW_READY: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_READY
)};
const SCRATCH_FAILURE_WORD: u32 = 2u;
const SCRATCH_VELOCITY_X: u32 = 0u;
const SCRATCH_VELOCITY_Y: u32 = 1u;
const SCRATCH_VELOCITY_Z: u32 = 2u;
const SCRATCH_HEAT_J: u32 = 3u;
const SCRATCH_HEAT_COUNT: u32 = 4u;
const SCRATCH_PRESSURE_J: u32 = 5u;
const SCRATCH_AMBIENT_X: u32 = 6u;
const SCRATCH_AMBIENT_Y: u32 = 7u;
const SCRATCH_AMBIENT_Z: u32 = 8u;
const SCRATCH_AMBIENT_WORK_J: u32 = 9u;
const SCRATCH_STATUS: u32 = 10u;
const SCRATCH_SEAL: u32 = 11u;
const SCRATCH_MAX_FIELD_CAPACITY: u32 = 357913940u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn finite_vec3(value: vec3<f32>) -> bool {
  return finite_f32(value.x) && finite_f32(value.y) && finite_f32(value.z);
}

fn field_load(word: u32) -> u32 {
  return atomicLoad(&field_view[word]);
}

fn field_store(word: u32, value: u32) {
  atomicStore(&field_view[word], value);
}

fn field_dispatch_shape_admitted() -> bool {
  let field_count = field_load(34u);
  let group_count = field_count / FIELD_WORKGROUP_SIZE
    + select(0u, 1u, field_count % FIELD_WORKGROUP_SIZE != 0u);
  let dispatch_x = field_load(60u);
  let dispatch_y = field_load(61u);
  let dispatch_z = field_load(62u);
  if (field_count == 0u) {
    return dispatch_x == 0u
      && dispatch_y == 0u
      && dispatch_z == 0u
      && field_load(44u) == 0u
      && field_load(45u) == 0u
      && field_load(46u) == 0u;
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
    && field_load(44u) == dispatch_x
    && field_load(45u) == dispatch_y
    && field_load(46u) == dispatch_z;
}

fn field_linear_invocation(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>
) -> u32 {
  let linear_group =
    workgroup_id.x + workgroup_id.y * field_load(60u);
  return linear_group * FIELD_WORKGROUP_SIZE + local_id.x;
}

fn field_receipt_offset() -> u32 {
  return field_load(30u) - FIELD_RECEIPT_WORDS;
}

fn field_pressure_offset() -> u32 {
  return field_load(30u) + field_load(32u) * FIELD_STATE_WORDS;
}

fn field_pressure_receipt_seal() -> u32 {
  let receipt = field_receipt_offset();
  return FIELD_PRESSURE_MAGIC
    ^ FIELD_PRESSURE_VERSION
    ^ FIELD_PRESSURE_READY_ADMITTED
    ^ FIELD_PRESSURE_LAW_EXACT
    ^ field_load(receipt + 28u)
    ^ field_load(receipt + 29u)
    ^ field_load(receipt + 30u)
    ^ field_load(receipt + 31u)
    ^ field_load(receipt + 32u)
    ^ field_load(3u)
    ^ field_load(8u)
    ^ field_load(9u)
    ^ field_load(10u)
    ^ field_load(38u);
}

fn field_pressure_receipt_admitted() -> bool {
  let receipt = field_receipt_offset();
  let required = field_load(receipt + 32u);
  let claimed = field_load(receipt + 33u);
  let consumed = field_load(receipt + 34u);
  return receipt + FIELD_RECEIPT_WORDS <= arrayLength(&field_view)
    && field_load(receipt + 24u) == FIELD_PRESSURE_MAGIC
    && field_load(receipt + 25u) == FIELD_PRESSURE_VERSION
    && field_load(receipt + 26u) == FIELD_PRESSURE_READY_ADMITTED
    && field_load(receipt + 27u) == FIELD_PRESSURE_LAW_EXACT
    && field_load(receipt + 28u) == bitcast<u32>(params.ambient_pressure_pa)
    && field_load(receipt + 30u) == field_load(34u)
    && field_load(receipt + 31u) == params.field_mutation_input_ordinal
    && (required & FIELD_PRESSURE_CONSUMER_LOCAL) != 0u
    && (claimed & FIELD_PRESSURE_CONSUMER_LOCAL) != 0u
    && (consumed & FIELD_PRESSURE_CONSUMER_LOCAL) == 0u
    && (claimed & ~required) == 0u
    && (consumed & ~claimed) == 0u
    && field_load(receipt + 35u) == field_pressure_receipt_seal();
}

fn reject_transport() {
  if (arrayLength(&field_view) < FIELD_HEADER_WORDS) { return; }
  let state_offset = field_load(30u);
  if (state_offset >= FIELD_RECEIPT_WORDS
      && state_offset <= arrayLength(&field_view)) {
    field_store(
      state_offset - FIELD_RECEIPT_WORDS + 2u,
      FIELD_RECEIPT_FAIL_CLOSED
    );
    field_store(
      state_offset - FIELD_RECEIPT_WORDS + 26u,
      FIELD_PRESSURE_FAIL_CLOSED
    );
  }
  field_store(2u, FIELD_FAIL_CLOSED);
  field_store(44u, 0u);
  field_store(45u, 0u);
  field_store(46u, 0u);
  field_store(60u, 0u);
  field_store(61u, 0u);
  field_store(62u, 0u);
}

fn proposal_identity_matches() -> bool {
  return proposal_control[8u] == params.storage_generation
    && proposal_control[9u] == params.physics_tick
    && proposal_control[10u] == params.physics_substep
    && proposal_control[11u] == params.position_epoch
    && proposal_control[12u] == params.topology_epoch
    && proposal_control[13u] == params.chart_epoch
    && proposal_control[14u] == params.level_epoch
    && proposal_control[15u] == params.support_epoch;
}

fn receipt_identity_matches() -> bool {
  return receipt_control[8u] == params.storage_generation
    && receipt_control[9u] == params.physics_tick
    && receipt_control[10u] == params.physics_substep
    && receipt_control[11u] == params.position_epoch
    && receipt_control[12u] == params.topology_epoch
    && receipt_control[13u] == params.chart_epoch
    && receipt_control[14u] == params.level_epoch
    && receipt_control[15u] == params.support_epoch;
}

fn field_receipt_admitted() -> bool {
  let receipt = field_receipt_offset();
  return receipt + FIELD_RECEIPT_WORDS <= arrayLength(&field_view)
    && field_load(receipt) == FIELD_RECEIPT_MAGIC
    && field_load(receipt + 1u) == FIELD_RECEIPT_VERSION
    && field_load(receipt + 2u) == FIELD_RECEIPT_READY_ADMITTED
    && field_load(receipt + 3u) == FIELD_RECEIPT_HEAT_BUILDING
    && field_load(receipt + 5u) == params.field_mutation_output_ordinal
    && field_load(receipt + 6u) == field_load(34u);
}

fn proposal_seal() -> u32 {
  return PROPOSAL_MAGIC
    ^ proposal_control[3u]
    ^ proposal_control[27u]
    ^ proposal_control[28u]
    ^ proposal_control[29u]
    ^ proposal_control[23u]
    ^ proposal_control[24u]
    ^ proposal_control[17u]
    ^ proposal_control[19u]
    ^ proposal_control[25u]
    ^ proposal_control[26u]
    ^ proposal_control[2u];
}

fn proposal_admitted() -> bool {
  if (arrayLength(&proposal_control) < PROPOSAL_HEADER_WORDS
      || proposal_control[0u] != PROPOSAL_MAGIC
      || proposal_control[1u] != PROPOSAL_VERSION
      || proposal_control[2u] != PROPOSAL_READY_ADMITTED
      || proposal_control[3u] != params.generation_id
      || !proposal_identity_matches()
      || proposal_control[23u] != bitcast<u32>(params.fine_level)
      || proposal_control[24u] != bitcast<u32>(params.coarse_level)
      || proposal_control[25u] != 1u
      || proposal_control[26u] != 1u
      || proposal_control[29u] != params.parent_field_completion_ordinal
      || proposal_control[34u] != LOCAL_HEAD_WORDS
      || proposal_control[37u] != MOMENT_ROW_WORDS
      || proposal_control[49u] != proposal_seal()
      || proposal_control[50u] != LOCAL_POLICY) {
    return false;
  }
  if (params.level_index == 0u) {
    return proposal_control[16u] == field_load(34u)
      && proposal_control[17u] == params.field_capacity
      && proposal_control[23u] == bitcast<u32>(params.selected_level)
      && proposal_control[30u] == params.local_head_offset_words
      && proposal_control[27u] == params.field_completion_ordinal
      && proposal_control[28u] == params.other_receipt_completion_ordinal;
  }
  return proposal_control[18u] == field_load(34u)
    && proposal_control[19u] == params.field_capacity
    && proposal_control[24u] == bitcast<u32>(params.selected_level)
    && proposal_control[31u] == params.local_head_offset_words
    && proposal_control[28u] == params.field_completion_ordinal
    && proposal_control[27u] == params.other_receipt_completion_ordinal;
}

fn receipt_admitted() -> bool {
  if (arrayLength(&receipt_control) < RECEIPT_HEADER_WORDS
      || receipt_control[0u] != RECEIPT_MAGIC
      || receipt_control[1u] != RECEIPT_VERSION
      || receipt_control[2u] != RECEIPT_READY_ADMITTED
      || receipt_control[3u] != params.generation_id
      || !receipt_identity_matches()
      || receipt_control[18u] != field_load(34u)
      || receipt_control[19u] != params.field_capacity
      || receipt_control[21u] != bitcast<u32>(params.selected_level)
      || receipt_control[25u] != MOMENT_ROW_WORDS
      || receipt_control[26u] != params.field_completion_ordinal
      || receipt_control[58u] != RECEIPT_HEADER_WORDS) {
    return false;
  }
  let expected_seal = RECEIPT_MAGIC
    ^ params.generation_id
    ^ params.field_completion_ordinal
    ^ receipt_control[2u];
  return receipt_control[59u] == expected_seal;
}

fn field_admitted() -> bool {
  let selected_matches = (
    params.level_index == 0u && params.selected_level == params.fine_level
  ) || (
    params.level_index == 1u && params.selected_level == params.coarse_level
  );
  return params.transport_enabled == 1u
    && selected_matches
    && params.field_capacity > 0u
    && params.phase_record_count > 0u
    && params.dt > 0.0
    && finite_f32(params.dt)
    && params.grid_spacing_m > 0.0
    && finite_f32(params.grid_spacing_m)
    && arrayLength(&field_view) >= FIELD_HEADER_WORDS
    && field_load(0u) == FIELD_MAGIC
    && field_load(1u) == FIELD_VERSION
    && field_load(2u) == FIELD_READY_ADMITTED
    && field_load(3u) == params.generation_id
    && field_load(8u) == params.storage_generation
    && field_load(9u) == params.physics_tick
    && field_load(10u) == params.physics_substep
    && field_load(11u) == params.position_epoch
    && field_load(12u) == params.topology_epoch
    && field_load(13u) == params.chart_epoch
    && field_load(14u) == params.level_epoch
    && field_load(15u) == params.support_epoch
    && field_load(17u) == bitcast<u32>(params.selected_level)
    && field_load(18u) == params.grid_node_count
    && field_load(23u) == bitcast<u32>(params.grid_spacing_m)
    && field_load(32u) == params.field_capacity
    && field_load(34u) <= params.field_capacity
    && field_load(38u) == params.field_completion_ordinal
    && field_load(59u) == FIELD_STATE_EMPTY
    && field_load(63u) == params.field_mutation_output_ordinal
    && field_pressure_offset() >= field_load(30u)
    && field_pressure_offset()
      + params.field_capacity * FIELD_PRESSURE_WORDS
      == arrayLength(&field_view)
    && field_dispatch_shape_admitted()
    && field_receipt_admitted()
    && field_pressure_receipt_admitted()
    && proposal_admitted()
    && receipt_admitted();
}

fn field_key(field_index: u32) -> u32 {
  return field_load(26u) + field_index * FIELD_KEY_WORDS;
}

fn field_state(field_index: u32) -> u32 {
  return field_load(30u) + field_index * FIELD_STATE_WORDS;
}

fn field_accumulator(field_index: u32) -> u32 {
  return field_load(28u) + field_index * FIELD_ACCUMULATOR_WORDS;
}

fn moment_valid(field_index: u32) -> bool {
  let row = field_index * MOMENT_ROW_WORDS;
  let key = field_key(field_index);
  if (row + MOMENT_ROW_WORDS > arrayLength(&moment_rows)) { return false; }
  let volume = bitcast<f32>(moment_rows[row + 4u]);
  return moment_rows[row] == field_load(key)
    && moment_rows[row + 1u] == field_load(key + 1u)
    && moment_rows[row + 2u] == field_load(key + 2u)
    && moment_rows[row + 3u] == field_load(key + 3u)
    && volume > 0.0
    && finite_f32(volume)
    && finite_f32(bitcast<f32>(moment_rows[row + 5u]))
    && finite_f32(bitcast<f32>(moment_rows[row + 6u]))
    && finite_f32(bitcast<f32>(moment_rows[row + 7u]))
    && moment_rows[row + 8u] > 0u
    && moment_rows[row + 9u] == MOMENT_READY_ADMITTED;
}

fn phase_mechanics(material_id: u32, phase_id: u32) -> PhaseMechanics {
  for (var record = 0u; record < params.phase_record_count; record = record + 1u) {
    let row0 = material_phase_records[record * 3u];
    if (row0.x == f32(material_id) && row0.y == f32(phase_id)) {
      let row1 = material_phase_records[record * 3u + 1u];
      let row2 = material_phase_records[record * 3u + 2u];
      return PhaseMechanics(row0.z, row1.z, row2.z, row2.y);
    }
  }
  return PhaseMechanics(0.0, 0.0, 0.0, 255.0);
}

fn field_material_valid(field_index: u32) -> bool {
  let key = field_key(field_index);
  let phase_id = field_load(key + 1u);
  let material_id = field_load(key + 2u);
  let mechanics = phase_mechanics(material_id, phase_id);
  return phase_id >= PHASE_SOLID
    && phase_id <= PHASE_PLASMA
    && material_id != 0u
    && mechanics.status == 1.0
    && mechanics.rest_density > 0.0
    && mechanics.sound_speed >= 0.0
    && mechanics.dynamic_viscosity >= 0.0
    && finite_f32(mechanics.rest_density)
    && finite_f32(mechanics.sound_speed)
    && finite_f32(mechanics.dynamic_viscosity);
}

fn field_velocity(field_index: u32) -> vec3<f32> {
  let state = field_state(field_index);
  return vec3<f32>(
    bitcast<f32>(field_load(state + 1u)),
    bitcast<f32>(field_load(state + 2u)),
    bitcast<f32>(field_load(state + 3u))
  );
}

fn field_mass(field_index: u32) -> f32 {
  return bitcast<f32>(field_load(field_state(field_index)));
}

fn field_volume(field_index: u32) -> f32 {
  return bitcast<f32>(moment_rows[field_index * MOMENT_ROW_WORDS + 4u]);
}

fn field_absolute_pressure(field_index: u32) -> f32 {
  return bitcast<f32>(
    field_load(field_pressure_offset() + field_index * FIELD_PRESSURE_WORDS + 2u)
  );
}

fn field_pressure_row_valid(field_index: u32) -> bool {
  if (field_index >= field_load(34u) || !moment_valid(field_index)) {
    return false;
  }
  let pressure_row =
    field_pressure_offset() + field_index * FIELD_PRESSURE_WORDS;
  if (pressure_row < field_pressure_offset()
      || pressure_row + FIELD_PRESSURE_WORDS > arrayLength(&field_view)) {
    return false;
  }
  let pressure_volume_moment = bitcast<f32>(field_load(pressure_row));
  let represented_volume = bitcast<f32>(field_load(pressure_row + 1u));
  let absolute_pressure = bitcast<f32>(field_load(pressure_row + 2u));
  let contribution_count = field_load(pressure_row + 3u);
  let moment_volume = field_volume(field_index);
  let volume_tolerance = transport_balance_tolerance(
    abs(represented_volume) + abs(moment_volume),
    max(2u, contribution_count)
  );
  let pressure_tolerance = transport_balance_tolerance(
    abs(pressure_volume_moment) + abs(represented_volume * absolute_pressure),
    max(2u, contribution_count)
  );
  return represented_volume > 0.0
    && absolute_pressure >= 0.0
    && contribution_count > 0u
    && contribution_count
      == moment_rows[field_index * MOMENT_ROW_WORDS + 8u]
    && finite_f32(pressure_volume_moment)
    && finite_f32(represented_volume)
    && finite_f32(absolute_pressure)
    && abs(represented_volume - moment_volume) <= volume_tolerance
    && abs(
      pressure_volume_moment - represented_volume * absolute_pressure
    ) <= pressure_tolerance;
}

fn field_gradient(field_index: u32) -> vec3<f32> {
  let row = field_index * MOMENT_ROW_WORDS;
  return vec3<f32>(
    bitcast<f32>(moment_rows[row + 5u]),
    bitcast<f32>(moment_rows[row + 6u]),
    bitcast<f32>(moment_rows[row + 7u])
  );
}

fn scratch_load(word: u32) -> u32 {
  return atomicLoad(&transport_scratch[word]);
}

fn scratch_store(word: u32, value: u32) {
  atomicStore(&transport_scratch[word], value);
}

fn scratch_row(field_index: u32) -> u32 {
  return SCRATCH_HEADER_WORDS + field_index * SCRATCH_ROW_WORDS;
}

fn scratch_header_seal() -> u32 {
  return SCRATCH_MAGIC
    ^ SCRATCH_VERSION
    ^ params.field_capacity
    ^ params.generation_id
    ^ params.field_completion_ordinal
    ^ SCRATCH_ROW_WORDS;
}

fn scratch_admitted() -> bool {
  let row_words = params.field_capacity * SCRATCH_ROW_WORDS;
  let required_words = SCRATCH_HEADER_WORDS + row_words;
  return params.field_capacity <= SCRATCH_MAX_FIELD_CAPACITY
    && required_words >= SCRATCH_HEADER_WORDS
    && required_words <= arrayLength(&transport_scratch)
    && scratch_load(0u) == SCRATCH_MAGIC
    && scratch_load(1u) == SCRATCH_VERSION
    && scratch_load(3u) == params.field_capacity
    && scratch_load(4u) == params.generation_id
    && scratch_load(5u) == params.field_completion_ordinal
    && scratch_load(6u) == SCRATCH_ROW_WORDS
    && scratch_load(7u) == scratch_header_seal();
}

fn reject_scratch() {
  if (arrayLength(&transport_scratch) > SCRATCH_FAILURE_WORD) {
    atomicStore(&transport_scratch[SCRATCH_FAILURE_WORD], 1u);
  }
}

fn local_head_row_zero(row: u32) -> bool {
  for (var word = 0u; word < LOCAL_HEAD_WORDS; word = word + 1u) {
    if (local_heads[row + word] != 0u) { return false; }
  }
  return true;
}

// Authenticate S9-C against the canonical mechanics-field key run. Singleton
// heads and all non-head rows must be zero. Multi-field heads must match the
// exact derived [begin,end) range, making admitted spans disjoint by proof.
fn canonical_local_head_range(first: u32) -> vec2<u32> {
  let field_count = field_load(34u);
  if (first >= field_count) { return vec2<u32>(0u, 0u); }
  let row = params.local_head_offset_words + first * LOCAL_HEAD_WORDS;
  if (row < params.local_head_offset_words
      || row + LOCAL_HEAD_WORDS < row
      || row + LOCAL_HEAD_WORDS > arrayLength(&local_heads)) {
    return vec2<u32>(0xffffffffu, 0u);
  }
  let node = field_load(field_key(first));
  let is_head = first == 0u
    || field_load(field_key(first - 1u)) != node;
  if (!is_head) {
    return select(
      vec2<u32>(0xffffffffu, 0u),
      vec2<u32>(0u, 0u),
      local_head_row_zero(row)
    );
  }
  var end = first + 1u;
  loop {
    if (end >= field_count || field_load(field_key(end)) != node) { break; }
    end = end + 1u;
  }
  if (end - first < 2u) {
    return select(
      vec2<u32>(0xffffffffu, 0u),
      vec2<u32>(first, end),
      local_head_row_zero(row)
    );
  }
  if (local_heads[row] != first
      || local_heads[row + 1u] != node
      || local_heads[row + 2u] != end
      || local_heads[row + 3u] != bitcast<u32>(params.selected_level)
      || local_heads[row + 4u] != LOCAL_POLICY
      || local_heads[row + 5u] != LOCAL_ROW_READY_ADMITTED
      || local_heads[row + 6u] != 0u
      || local_heads[row + 7u] != 0u) {
    return vec2<u32>(0xffffffffu, 0u);
  }
  return vec2<u32>(first, end);
}

fn head_valid(first: u32, range: vec2<u32>) -> bool {
  if (range.x == 0u && range.y == 0u) { return true; }
  if (range.x == 0xffffffffu) { return false; }
  let node = field_load(field_key(first));
  for (
    var field_index = range.x;
    field_index < range.y;
    field_index = field_index + 1u
  ) {
    let state = field_state(field_index);
    let mass = bitcast<f32>(field_load(state));
    let velocity = field_velocity(field_index);
    if (field_load(field_key(field_index)) != node
        || !(mass > 0.0)
        || !finite_f32(mass)
        || !finite_vec3(velocity)
        || field_load(state + 7u) == 0u
        || !moment_valid(field_index)
        || !field_pressure_row_valid(field_index)
        || !field_material_valid(field_index)) {
      return false;
    }
  }
  return true;
}

fn initialize_scratch_field(field_index: u32) -> bool {
  let row = scratch_row(field_index);
  let accumulator = field_accumulator(field_index);
  let velocity = field_velocity(field_index);
  let heat = bitcast<f32>(field_load(accumulator + ACC_LOCAL_HEAT));
  let pressure =
    bitcast<f32>(field_load(accumulator + ACC_PRESSURE_COMPENSATION));
  let ambient_x =
    bitcast<f32>(field_load(accumulator + ACC_AMBIENT_IMPULSE_X));
  let ambient_y =
    bitcast<f32>(field_load(accumulator + ACC_AMBIENT_IMPULSE_Y));
  let ambient_z =
    bitcast<f32>(field_load(accumulator + ACC_AMBIENT_IMPULSE_Z));
  let ambient_work =
    bitcast<f32>(field_load(accumulator + ACC_AMBIENT_WORK));
  if (row + SCRATCH_ROW_WORDS > arrayLength(&transport_scratch)
      || !finite_vec3(velocity)
      || !(heat >= 0.0)
      || !finite_f32(heat)
      || !finite_f32(pressure)
      || !finite_f32(ambient_x)
      || !finite_f32(ambient_y)
      || !finite_f32(ambient_z)
      || !finite_f32(ambient_work)) {
    return false;
  }
  scratch_store(row + SCRATCH_VELOCITY_X, bitcast<u32>(velocity.x));
  scratch_store(row + SCRATCH_VELOCITY_Y, bitcast<u32>(velocity.y));
  scratch_store(row + SCRATCH_VELOCITY_Z, bitcast<u32>(velocity.z));
  scratch_store(row + SCRATCH_HEAT_J, bitcast<u32>(heat));
  scratch_store(
    row + SCRATCH_HEAT_COUNT,
    field_load(accumulator + ACC_LOCAL_HEAT_COUNT)
  );
  scratch_store(row + SCRATCH_PRESSURE_J, bitcast<u32>(pressure));
  scratch_store(row + SCRATCH_AMBIENT_X, bitcast<u32>(ambient_x));
  scratch_store(row + SCRATCH_AMBIENT_Y, bitcast<u32>(ambient_y));
  scratch_store(row + SCRATCH_AMBIENT_Z, bitcast<u32>(ambient_z));
  scratch_store(row + SCRATCH_AMBIENT_WORK_J, bitcast<u32>(ambient_work));
  scratch_store(row + SCRATCH_STATUS, 0u);
  scratch_store(row + SCRATCH_SEAL, 0u);
  return true;
}

fn scratch_velocity(field_index: u32) -> vec3<f32> {
  let row = scratch_row(field_index);
  return vec3<f32>(
    bitcast<f32>(scratch_load(row + SCRATCH_VELOCITY_X)),
    bitcast<f32>(scratch_load(row + SCRATCH_VELOCITY_Y)),
    bitcast<f32>(scratch_load(row + SCRATCH_VELOCITY_Z))
  );
}

fn scratch_set_velocity(field_index: u32, velocity: vec3<f32>) -> bool {
  if (!finite_vec3(velocity)) { return false; }
  let row = scratch_row(field_index);
  scratch_store(row + SCRATCH_VELOCITY_X, bitcast<u32>(velocity.x));
  scratch_store(row + SCRATCH_VELOCITY_Y, bitcast<u32>(velocity.y));
  scratch_store(row + SCRATCH_VELOCITY_Z, bitcast<u32>(velocity.z));
  return true;
}

fn scratch_add_f32(field_index: u32, offset: u32, value: f32) -> bool {
  if (!finite_f32(value)) { return false; }
  let word = scratch_row(field_index) + offset;
  let prior = bitcast<f32>(scratch_load(word));
  let next = prior + value;
  if (!finite_f32(prior) || !finite_f32(next)) { return false; }
  scratch_store(word, bitcast<u32>(next));
  return true;
}

fn scratch_add_heat(field_index: u32, heat_j: f32) -> bool {
  if (!(heat_j >= 0.0) || !finite_f32(heat_j)) { return false; }
  if (heat_j == 0.0) { return true; }
  let row = scratch_row(field_index);
  let prior_count = scratch_load(row + SCRATCH_HEAT_COUNT);
  if (prior_count == 0xffffffffu
      || !scratch_add_f32(field_index, SCRATCH_HEAT_J, heat_j)) {
    return false;
  }
  scratch_store(row + SCRATCH_HEAT_COUNT, prior_count + 1u);
  return true;
}

fn stage_ambient_buoyancy(field_index: u32) -> bool {
  let phase_id = field_load(field_key(field_index) + 1u);
  if (phase_id < PHASE_GAS || params.ambient_density_kg_per_m3 <= 0.0) {
    return true;
  }
  let mass = field_mass(field_index);
  let volume = field_volume(field_index);
  var velocity = scratch_velocity(field_index);
  let initial_velocity = velocity;
  var impulse = -params.ambient_density_kg_per_m3
    * volume
    * vec3<f32>(params.gravity_x, params.gravity_y, params.gravity_z)
    * params.dt;
  let max_speed = max(
    1.0e-6,
    params.cfl_factor * params.grid_spacing_m / max(params.dt, 1.0e-12)
  );
  let max_impulse = max(0.0, params.max_impulse_fraction) * mass * max_speed;
  let impulse_length = length(impulse);
  if (impulse_length > max_impulse && impulse_length > 0.0) {
    impulse = impulse * (max_impulse / impulse_length);
  }
  let kinetic_before = 0.5 * mass * dot(velocity, velocity);
  velocity = velocity + impulse / mass;
  let kinetic_after = 0.5 * mass * dot(velocity, velocity);
  let work_j = kinetic_after - kinetic_before;
  let momentum_residual = mass * (velocity - initial_velocity) - impulse;
  let momentum_sum_abs =
    abs(mass * (velocity - initial_velocity)) + abs(impulse);
  let momentum_tolerance = vec3<f32>(
    transport_balance_tolerance(momentum_sum_abs.x, 2u),
    transport_balance_tolerance(momentum_sum_abs.y, 2u),
    transport_balance_tolerance(momentum_sum_abs.z, 2u)
  );
  let energy_residual =
    kinetic_after - kinetic_before - work_j;
  let energy_tolerance = transport_balance_tolerance(
    abs(kinetic_after) + abs(kinetic_before) + abs(work_j),
    3u
  );
  if (!finite_vec3(velocity)
      || !finite_vec3(momentum_residual)
      || !finite_f32(energy_residual)
      || any(abs(momentum_residual) > momentum_tolerance)
      || abs(energy_residual) > energy_tolerance
      || !scratch_add_f32(field_index, SCRATCH_AMBIENT_X, impulse.x)
      || !scratch_add_f32(field_index, SCRATCH_AMBIENT_Y, impulse.y)
      || !scratch_add_f32(field_index, SCRATCH_AMBIENT_Z, impulse.z)
      || !scratch_add_f32(
        field_index,
        SCRATCH_AMBIENT_WORK_J,
        work_j
      )
      || !scratch_set_velocity(field_index, velocity)) {
    return false;
  }
  return true;
}

fn stage_gas_condensed_pair(condensed: u32, gas: u32) -> bool {
  let condensed_key = field_key(condensed);
  let gas_key = field_key(gas);
  let condensed_mechanics = phase_mechanics(
    field_load(condensed_key + 2u),
    field_load(condensed_key + 1u)
  );
  let gas_mechanics = phase_mechanics(
    field_load(gas_key + 2u),
    field_load(gas_key + 1u)
  );
  let condensed_mass = field_mass(condensed);
  let gas_mass = field_mass(gas);
  let pair_mass = condensed_mass + gas_mass;
  let condensed_absolute_pressure = field_absolute_pressure(condensed);
  let gas_absolute_pressure = field_absolute_pressure(gas);
  let initial_condensed_velocity = scratch_velocity(condensed);
  let initial_gas_velocity = scratch_velocity(gas);
  let result = schroeder_phase_volume_pressure_drag_pair(
    condensed_mass,
    gas_mass,
    1.0 / condensed_mass,
    1.0 / gas_mass,
    field_volume(condensed),
    field_volume(gas),
    field_gradient(condensed),
    field_gradient(gas),
    initial_condensed_velocity,
    initial_gas_velocity,
    condensed_mechanics.sound_speed,
    gas_mechanics.sound_speed,
    condensed_mechanics.dynamic_viscosity,
    gas_mechanics.dynamic_viscosity,
    condensed_absolute_pressure,
    gas_absolute_pressure,
    params.pressure_scale,
    params.drag_scale,
    params.max_impulse_fraction,
    params.grid_spacing_m,
    params.dt,
    params.cfl_factor
  );
  if (result.valid != 1u || !(pair_mass > 0.0)) { return false; }
  let condensed_pressure_compensation =
    result.pressure_internal_compensation_j * condensed_mass / pair_mass;
  let gas_pressure_compensation =
    result.pressure_internal_compensation_j
      - condensed_pressure_compensation;
  let condensed_heat = result.drag_heat_j * condensed_mass / pair_mass;
  let gas_heat = max(0.0, result.drag_heat_j - condensed_heat);
  let deposited_pressure_compensation =
    condensed_pressure_compensation + gas_pressure_compensation;
  let deposited_heat = condensed_heat + gas_heat;
  let momentum_residual =
    condensed_mass
      * (result.condensed_velocity - initial_condensed_velocity)
      + gas_mass * (result.gas_velocity - initial_gas_velocity);
  let momentum_sum_abs =
    abs(
      condensed_mass
        * (result.condensed_velocity - initial_condensed_velocity)
    ) + abs(
      gas_mass * (result.gas_velocity - initial_gas_velocity)
    );
  let kinetic_delta = 0.5 * (
    condensed_mass * (
      dot(result.condensed_velocity, result.condensed_velocity)
        - dot(initial_condensed_velocity, initial_condensed_velocity)
    ) + gas_mass * (
      dot(result.gas_velocity, result.gas_velocity)
        - dot(initial_gas_velocity, initial_gas_velocity)
    )
  );
  let energy_residual =
    kinetic_delta + deposited_pressure_compensation + deposited_heat;
  // Both residuals difference stored f32 velocity state, so admit the exact
  // representation floor of that state in addition to the change conditioning.
  let momentum_state_abs =
    condensed_mass * abs(initial_condensed_velocity)
      + gas_mass * abs(initial_gas_velocity)
      + condensed_mass * abs(result.condensed_velocity)
      + gas_mass * abs(result.gas_velocity);
  let kinetic_state_abs = 0.5 * (
    condensed_mass * dot(
      initial_condensed_velocity,
      initial_condensed_velocity
    )
      + gas_mass * dot(initial_gas_velocity, initial_gas_velocity)
      + condensed_mass * dot(
        result.condensed_velocity,
        result.condensed_velocity
      )
      + gas_mass * dot(result.gas_velocity, result.gas_velocity)
  );
  let momentum_tolerance = vec3<f32>(
    transport_balance_tolerance(momentum_sum_abs.x, 4u)
      + transport_state_floor(momentum_state_abs.x, 4u),
    transport_balance_tolerance(momentum_sum_abs.y, 4u)
      + transport_state_floor(momentum_state_abs.y, 4u),
    transport_balance_tolerance(momentum_sum_abs.z, 4u)
      + transport_state_floor(momentum_state_abs.z, 4u)
  );
  let energy_tolerance = transport_balance_tolerance(
    abs(kinetic_delta)
      + abs(deposited_pressure_compensation)
      + abs(deposited_heat),
    6u
  ) + transport_state_floor(kinetic_state_abs, 6u);
  if (!finite_f32(condensed_pressure_compensation)
      || !finite_f32(gas_pressure_compensation)
      || !finite_f32(condensed_heat)
      || !finite_f32(gas_heat)
      || !finite_vec3(momentum_residual)
      || any(abs(momentum_residual) > momentum_tolerance)
      || !finite_f32(kinetic_delta)
      || !finite_f32(energy_residual)
      || abs(energy_residual) > energy_tolerance) {
    return false;
  }

  return scratch_set_velocity(condensed, result.condensed_velocity)
    && scratch_set_velocity(gas, result.gas_velocity)
    && scratch_add_f32(
        condensed,
        SCRATCH_PRESSURE_J,
        condensed_pressure_compensation
      )
    && scratch_add_f32(gas, SCRATCH_PRESSURE_J, gas_pressure_compensation)
    && scratch_add_heat(condensed, condensed_heat)
    && scratch_add_heat(gas, gas_heat);
}

fn scratch_row_seal(field_index: u32) -> u32 {
  let row = scratch_row(field_index);
  var seal = SCRATCH_ROW_READY ^ field_index;
  for (var word = 0u; word <= SCRATCH_STATUS; word = word + 1u) {
    seal = seal ^ scratch_load(row + word);
  }
  return seal;
}

fn finalize_scratch_field(field_index: u32) {
  let row = scratch_row(field_index);
  scratch_store(row + SCRATCH_STATUS, SCRATCH_ROW_READY);
  scratch_store(row + SCRATCH_SEAL, scratch_row_seal(field_index));
}

fn scratch_row_valid(field_index: u32) -> bool {
  let row = scratch_row(field_index);
  if (row + SCRATCH_ROW_WORDS > arrayLength(&transport_scratch)
      || scratch_load(row + SCRATCH_STATUS) != SCRATCH_ROW_READY
      || scratch_load(row + SCRATCH_SEAL) != scratch_row_seal(field_index)) {
    return false;
  }
  let velocity = scratch_velocity(field_index);
  let heat = bitcast<f32>(scratch_load(row + SCRATCH_HEAT_J));
  return finite_vec3(velocity)
    && heat >= 0.0
    && finite_f32(heat)
    && finite_f32(bitcast<f32>(scratch_load(row + SCRATCH_PRESSURE_J)))
    && finite_f32(bitcast<f32>(scratch_load(row + SCRATCH_AMBIENT_X)))
    && finite_f32(bitcast<f32>(scratch_load(row + SCRATCH_AMBIENT_Y)))
    && finite_f32(bitcast<f32>(scratch_load(row + SCRATCH_AMBIENT_Z)))
    && finite_f32(
      bitcast<f32>(scratch_load(row + SCRATCH_AMBIENT_WORK_J))
    );
}

// Momentum and energy residuals are formed by differencing f32 *state*, not by
// accumulating the applied change. Storing v' = v + delta rounds delta to the
// ulp of v, so the residual carries the representation error of the state even
// when the operator is exactly antisymmetric. A tolerance conditioned only on
// the change is therefore unreachable whenever an admitted impulse is smaller
// than one ulp of the velocity it acts on, and an exact pair would fail closed.
// This floor is the standard gamma_n bound applied to the state conditioning.
fn transport_state_floor(state_abs: f32, operation_count: u32) -> f32 {
  let n_epsilon = min(
    0.25,
    f32(max(1u, operation_count)) * 5.960464477539063e-8
  );
  let gamma = n_epsilon / max(1.0e-20, 1.0 - n_epsilon);
  return gamma * max(state_abs, 1.175494351e-38);
}

fn transport_balance_tolerance(sum_abs: f32, operation_count: u32) -> f32 {
  let n_epsilon = min(
    0.25,
    f32(max(1u, operation_count)) * 5.960464477539063e-8
  );
  let gamma = n_epsilon / max(1.0e-20, 1.0 - n_epsilon);
  return max(
    8.0 * 1.175494351e-38,
    1024.0 * gamma * max(sum_abs, 1.175494351e-38)
  );
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_transport(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let first = field_linear_invocation(local_id, workgroup_id);
  if (!field_admitted() || !scratch_admitted()) {
    reject_scratch();
    return;
  }
  if (first >= field_load(34u)) { return; }
  let range = canonical_local_head_range(first);
  if (!head_valid(first, range)) {
    reject_scratch();
    return;
  }
  if (range.x == 0u && range.y == 0u) { return; }
  for (
    var field_index = range.x;
    field_index < range.y;
    field_index = field_index + 1u
  ) {
    if (!initialize_scratch_field(field_index)) {
      reject_scratch();
      return;
    }
  }
  for (
    var field_index = range.x;
    field_index < range.y;
    field_index = field_index + 1u
  ) {
    if (!stage_ambient_buoyancy(field_index)) {
      reject_scratch();
      return;
    }
  }
  for (var left = range.x; left < range.y; left = left + 1u) {
    let left_phase = field_load(field_key(left) + 1u);
    for (var right = left + 1u; right < range.y; right = right + 1u) {
      let right_phase = field_load(field_key(right) + 1u);
      let left_noncondensed = left_phase >= PHASE_GAS;
      let right_noncondensed = right_phase >= PHASE_GAS;
      if (left_noncondensed == right_noncondensed) { continue; }
      let condensed = select(left, right, left_noncondensed);
      let gas = select(right, left, left_noncondensed);
      if (!stage_gas_condensed_pair(condensed, gas)) {
        reject_scratch();
        return;
      }
    }
  }
  for (
    var field_index = range.x;
    field_index < range.y;
    field_index = field_index + 1u
  ) {
    finalize_scratch_field(field_index);
  }
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn validate_staged_transport(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let field_index = field_linear_invocation(local_id, workgroup_id);
  if (!field_admitted() || !scratch_admitted()) {
    reject_scratch();
    return;
  }
  if (field_index >= field_load(34u)
      || scratch_load(SCRATCH_FAILURE_WORD) != 0u) {
    return;
  }
  if (!scratch_row_valid(field_index)) { reject_scratch(); }
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn commit_transport(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let field_index = field_linear_invocation(local_id, workgroup_id);
  if (!scratch_admitted()
      || scratch_load(SCRATCH_FAILURE_WORD) != 0u) {
    if (field_index == 0u) { reject_transport(); }
    return;
  }
  if (field_index >= field_load(34u)) { return; }
  // Validation ran in a prior dispatch. This pass is deliberately store-only:
  // it has no late rejection path that could expose a partially committed
  // mechanics field.
  let row = scratch_row(field_index);
  let state = field_state(field_index);
  let accumulator = field_accumulator(field_index);
  field_store(state + 1u, scratch_load(row + SCRATCH_VELOCITY_X));
  field_store(state + 2u, scratch_load(row + SCRATCH_VELOCITY_Y));
  field_store(state + 3u, scratch_load(row + SCRATCH_VELOCITY_Z));
  field_store(accumulator + ACC_LOCAL_HEAT, scratch_load(row + SCRATCH_HEAT_J));
  field_store(
    accumulator + ACC_LOCAL_HEAT_COUNT,
    scratch_load(row + SCRATCH_HEAT_COUNT)
  );
  field_store(
    accumulator + ACC_PRESSURE_COMPENSATION,
    scratch_load(row + SCRATCH_PRESSURE_J)
  );
  field_store(
    accumulator + ACC_AMBIENT_IMPULSE_X,
    scratch_load(row + SCRATCH_AMBIENT_X)
  );
  field_store(
    accumulator + ACC_AMBIENT_IMPULSE_Y,
    scratch_load(row + SCRATCH_AMBIENT_Y)
  );
  field_store(
    accumulator + ACC_AMBIENT_IMPULSE_Z,
    scratch_load(row + SCRATCH_AMBIENT_Z)
  );
  field_store(
    accumulator + ACC_AMBIENT_WORK,
    scratch_load(row + SCRATCH_AMBIENT_WORK_J)
  );
}
`;
