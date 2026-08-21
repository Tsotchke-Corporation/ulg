import {
  SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
  SCHROEDER_SPATIAL_EPOCH_MAGIC,
  SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_EPOCH_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_EPOCH_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_EPOCH_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_EPOCH_STATUS_READY,
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS
} from './schroederSpatialEpoch.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_BUILDING,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION
} from './schroederSpatialMechanicsFieldView.js';
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
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_FAIL_CLOSED,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_NO_LOAD,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_FIELD_ADMISSION_SEAL,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_MAGIC,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_INITIALIZED,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_READY,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_VERSION,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SOURCE_ADMISSION_SEAL,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE
} from './schroederSpatialGasPressureBoundaryTransport.js';
import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR
} from './schroederSpatialPhaseVolumeTransport.js';

const u32 = (value) => `${Number(value) >>> 0}u`;

/**
 * Canonical exact-v4 residual-gas pressure boundary transport.
 *
 * Bindings 3, 4, and 6 are deliberately installed only by the exact v4 EOS
 * owner. The public adapter supplies the exact S9/mechanics buffers, scratch,
 * and uniform. No entry point scans gas cells: each condensed node head makes
 * one O(log C) lookup in the authenticated sorted directory.
 */
export const schroederSpatialGasPressureBoundaryTransportWgsl = /* wgsl */ `
struct GasPressureBoundaryParams {
  transport_enabled: u32,
  missing_cell_policy: u32,
  field_capacity: u32,
  generation_id: u32,
  field_completion_ordinal: u32,
  field_mutation_ordinal: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
  selected_level: i32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  grid_cell_origin_x: i32,
  grid_cell_origin_y: i32,
  grid_cell_origin_z: i32,
  chart_id: u32,
  dt: f32,
  ambient_pressure_pa: f32,
  pressure_scale: f32,
  grid_spacing_m: f32,
  gas_execution_generation: u32,
  gas_storage_generation: u32,
  gas_pressure_cell_capacity: u32,
  gas_pressure_cell_stride_floats: u32,
  gas_directory_generation: u32,
  gas_directory_word_length: u32,
  gas_directory_cell_capacity: u32,
  gas_directory_cell_keys_offset_words: u32,
  gas_directory_cell_offsets_offset_words: u32,
  gas_directory_cell_members_offset_words: u32,
  gas_directory_particle_to_cell_offset_words: u32,
  dispatch_x: u32,
  dispatch_y: u32,
  dispatch_z: u32,
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
  reserved16: u32,
  reserved17: u32,
  reserved18: u32,
  reserved19: u32,
  reserved20: u32,
  reserved21: u32,
  reserved22: u32,
};

@group(0) @binding(0) var<storage, read_write> field_view: array<atomic<u32>>;
@group(0) @binding(1) var<storage, read> receipt_control: array<u32>;
@group(0) @binding(2) var<storage, read> moment_rows: array<u32>;
@group(0) @binding(3) var<storage, read> gas_pressure_rows: array<f32>;
@group(0) @binding(4) var<storage, read> gas_directory: array<u32>;
@group(0) @binding(5) var<storage, read_write> scratch: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read> gas_authority_control: array<u32>;
@group(0) @binding(7) var<uniform> params: GasPressureBoundaryParams;

const FIELD_HEADER_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS
)};
const FIELD_MAGIC: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC
)};
const FIELD_VERSION: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION
)};
const FIELD_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED
)};
const FIELD_FAIL_CLOSED: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
)};
const FIELD_KEY_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS
)};
const FIELD_ACCUMULATOR_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS
)};
const FIELD_STATE_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS
)};
const FIELD_STATE_EMPTY: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY
)};
const FIELD_RECEIPT_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS
)};
const FIELD_RECEIPT_MAGIC: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC
)};
const FIELD_RECEIPT_VERSION: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION
)};
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
const FIELD_PRESSURE_CONSUMER_LOCAL: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL
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
const DIRECTORY_HEADER_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS
)};
const DIRECTORY_KEY_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_EPOCH_KEY_WORDS
)};
const DIRECTORY_MAGIC: u32 = ${u32(SCHROEDER_SPATIAL_EPOCH_MAGIC)};
const DIRECTORY_VERSION: u32 = ${u32(SCHROEDER_SPATIAL_EPOCH_VERSION)};
const DIRECTORY_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_EPOCH_STATUS_READY
    | SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED
)};
const DIRECTORY_REJECT_MASK: u32 = ${u32(
  SCHROEDER_SPATIAL_EPOCH_STATUS_FAIL_CLOSED
    | SCHROEDER_SPATIAL_EPOCH_STATUS_INVALID_SOURCE
    | SCHROEDER_SPATIAL_EPOCH_STATUS_CAPACITY_OVERFLOW
)};
const DIRECTORY_SORT_LEXICOGRAPHIC: u32 = ${u32(
  SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5
)};
const DIRECTORY_ACTIVE_NODE_ADAPTER: u32 = ${u32(
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS
)};
const GAS_AUTHORITY_MAGIC: u32 = 0x53474133u;
const GAS_AUTHORITY_VERSION: u32 = 3u;
const GAS_AUTHORITY_REQUIRED_READY: u32 = 31u;
const GAS_AUTHORITY_EMPTY: u32 = 32u;
const GAS_AUTHORITY_FAILED: u32 = 0x80000000u;
const GAS_AUTHORITY_UNKNOWN_STATUS_MASK: u32 = 0x7fffffc0u;
const GAS_PRESSURE_ROW_FLOATS: u32 = 12u;
const SCRATCH_MAGIC: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_MAGIC
)};
const SCRATCH_VERSION: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_VERSION
)};
const SCRATCH_HEADER_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_HEADER_WORDS
)};
const SCRATCH_ROW_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS
)};
const SCRATCH_ROW_INITIALIZED: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_INITIALIZED
)};
const SCRATCH_ROW_READY: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_READY
)};
const SCRATCH_FIELD_ADMISSION_SEAL: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_FIELD_ADMISSION_SEAL
)};
const SCRATCH_SOURCE_ADMISSION_SEAL: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SOURCE_ADMISSION_SEAL
)};
const SCRATCH_VELOCITY_X: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW.velocityX
)};
const SCRATCH_VELOCITY_Y: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW.velocityY
)};
const SCRATCH_VELOCITY_Z: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW.velocityZ
)};
const SCRATCH_EXTERNAL_X: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW.externalImpulseX
)};
const SCRATCH_EXTERNAL_Y: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW.externalImpulseY
)};
const SCRATCH_EXTERNAL_Z: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW.externalImpulseZ
)};
const SCRATCH_EXTERNAL_WORK: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW.externalWorkJ
)};
const SCRATCH_MASS: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW.fieldMassKg
)};
const SCRATCH_VOLUME: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW.fieldVolumeM3
)};
const SCRATCH_GAUGE: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW.gaugePressurePa
)};
const SCRATCH_STATUS: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW.status
)};
const SCRATCH_SEAL: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW.seal
)};
const MISSING_NO_LOAD: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_NO_LOAD
)};
const MISSING_FAIL_CLOSED: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_FAIL_CLOSED
)};
const ACC_EXTERNAL_X: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR.ambientImpulseXNs
)};
const ACC_EXTERNAL_Y: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR.ambientImpulseYNs
)};
const ACC_EXTERNAL_Z: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR.ambientImpulseZNs
)};
const ACC_EXTERNAL_WORK: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR.ambientWorkJ
)};
const INVALID_CELL: u32 = 0xffffffffu;
const PHASE_SOLID: u32 = 1u;
const PHASE_LIQUID: u32 = 2u;

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

fn scratch_load(word: u32) -> u32 {
  return atomicLoad(&scratch[word]);
}

fn scratch_store(word: u32, value: u32) {
  atomicStore(&scratch[word], value);
}

fn reject_scratch() {
  if (arrayLength(&scratch) > 2u) { atomicStore(&scratch[2u], 1u); }
}

fn scratch_header_seal() -> u32 {
  return SCRATCH_MAGIC
    ^ SCRATCH_VERSION
    ^ params.field_capacity
    ^ params.generation_id
    ^ params.field_completion_ordinal
    ^ params.gas_execution_generation
    ^ SCRATCH_ROW_WORDS;
}

fn scratch_header_admitted() -> bool {
  let max_capacity = (0xffffffffu - SCRATCH_HEADER_WORDS) / SCRATCH_ROW_WORDS;
  if (params.field_capacity == 0u || params.field_capacity > max_capacity) {
    return false;
  }
  let required_words =
    SCRATCH_HEADER_WORDS + params.field_capacity * SCRATCH_ROW_WORDS;
  return required_words <= arrayLength(&scratch)
    && scratch_load(0u) == SCRATCH_MAGIC
    && scratch_load(1u) == SCRATCH_VERSION
    && scratch_load(3u) == params.field_capacity
    && scratch_load(4u) == params.generation_id
    && scratch_load(5u) == params.field_completion_ordinal
    && scratch_load(6u) == params.gas_execution_generation
    && scratch_load(7u) == SCRATCH_ROW_WORDS
    && scratch_load(8u) <= params.field_capacity
    && scratch_load(11u) == scratch_header_seal();
}

fn scratch_unvalidated_admitted() -> bool {
  return scratch_header_admitted()
    && scratch_load(2u) == 0u
    && scratch_load(8u) == 0u
    && scratch_load(9u) == 0u
    && scratch_load(10u) == 0u;
}

fn scratch_field_prevalidated_admitted() -> bool {
  return scratch_header_admitted()
    && scratch_load(2u) == 0u
    && scratch_load(8u) == 0u
    && scratch_load(9u) == SCRATCH_FIELD_ADMISSION_SEAL
    && scratch_load(10u) == 0u;
}

fn scratch_admitted() -> bool {
  return scratch_header_admitted()
    && scratch_load(9u) == SCRATCH_FIELD_ADMISSION_SEAL
    && scratch_load(10u) == SCRATCH_SOURCE_ADMISSION_SEAL;
}

fn scratch_prevalidation_admitted() -> bool {
  return scratch_admitted()
    && scratch_load(2u) == 0u
    && scratch_load(8u) == 0u;
}

fn capacity_dispatch_admitted() -> bool {
  let groups = params.field_capacity / ${u32(
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE
  )} + select(
    0u,
    1u,
    params.field_capacity % ${u32(
      SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE
    )} != 0u
  );
  if (groups == 0u || params.dispatch_x == 0u || params.dispatch_y == 0u
      || params.dispatch_z != 1u || params.dispatch_x > groups) {
    return false;
  }
  return params.dispatch_y == groups / params.dispatch_x
    + select(0u, 1u, groups % params.dispatch_x != 0u);
}

fn capacity_linear_invocation(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>
) -> u32 {
  let linear_group = workgroup_id.x + workgroup_id.y * params.dispatch_x;
  return linear_group * ${u32(
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE
  )} + local_id.x;
}

fn field_key(field_index: u32) -> u32 {
  return field_load(26u) + field_index * FIELD_KEY_WORDS;
}

fn field_accumulator(field_index: u32) -> u32 {
  return field_load(28u) + field_index * FIELD_ACCUMULATOR_WORDS;
}

fn field_state(field_index: u32) -> u32 {
  return field_load(30u) + field_index * FIELD_STATE_WORDS;
}

fn field_receipt_offset() -> u32 {
  return field_load(30u) - FIELD_RECEIPT_WORDS;
}

fn exact_grid_shape() -> bool {
  if (params.grid_nx == 0u || params.grid_ny == 0u || params.grid_nz == 0u) {
    return false;
  }
  // Chained exact division proves nx * ny * nz == node_count without ever
  // constructing an overflow-prone intermediate product.
  if (params.grid_node_count % params.grid_nx != 0u) { return false; }
  let after_x = params.grid_node_count / params.grid_nx;
  if (after_x % params.grid_ny != 0u) { return false; }
  return after_x / params.grid_ny == params.grid_nz
    && params.grid_nx <= 0x7fffffffu
    && params.grid_ny <= 0x7fffffffu
    && params.grid_nz <= 0x7fffffffu;
}

fn cell_origins_admitted() -> bool {
  return params.grid_cell_origin_x
      <= 2147483647 - i32(params.grid_nx - 1u)
    && params.grid_cell_origin_y
      <= 2147483647 - i32(params.grid_ny - 1u)
    && params.grid_cell_origin_z
      <= 2147483647 - i32(params.grid_nz - 1u);
}

fn field_receipt_admitted() -> bool {
  let state_offset = field_load(30u);
  if (state_offset < FIELD_RECEIPT_WORDS) { return false; }
  let receipt = field_receipt_offset();
  return receipt + FIELD_RECEIPT_WORDS <= arrayLength(&field_view)
    && field_load(receipt) == FIELD_RECEIPT_MAGIC
    && field_load(receipt + 1u) == FIELD_RECEIPT_VERSION
    && field_load(receipt + 2u) == FIELD_RECEIPT_READY_ADMITTED
    && field_load(receipt + 3u) == FIELD_RECEIPT_HEAT_BUILDING
    && field_load(receipt + 5u) == params.field_mutation_ordinal
    && field_load(receipt + 6u) == field_load(34u);
}

fn local_pressure_claim_pending() -> bool {
  let receipt = field_receipt_offset();
  let required = field_load(receipt + 32u);
  let claimed = field_load(receipt + 33u);
  let consumed = field_load(receipt + 34u);
  return (required & FIELD_PRESSURE_CONSUMER_LOCAL) != 0u
    && (claimed & FIELD_PRESSURE_CONSUMER_LOCAL) != 0u
    && (consumed & FIELD_PRESSURE_CONSUMER_LOCAL) == 0u
    && (claimed & ~required) == 0u
    && (consumed & ~claimed) == 0u;
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

fn phase_volume_receipt_admitted() -> bool {
  if (arrayLength(&receipt_control) < RECEIPT_HEADER_WORDS
      || receipt_control[0u] != RECEIPT_MAGIC
      || receipt_control[1u] != RECEIPT_VERSION
      || receipt_control[2u] != RECEIPT_READY_ADMITTED
      || receipt_control[3u] != params.generation_id
      || !receipt_identity_matches()
      || receipt_control[18u] != field_load(34u)
      || receipt_control[19u] != params.field_capacity
      || receipt_control[21u] != bitcast<u32>(params.selected_level)
      || receipt_control[22u] != params.grid_node_count
      || receipt_control[23u] != bitcast<u32>(params.grid_spacing_m)
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

fn field_params_admitted() -> bool {
  if (params.transport_enabled != 1u) { return false; }
  if (params.missing_cell_policy != MISSING_NO_LOAD
      && params.missing_cell_policy != MISSING_FAIL_CLOSED) {
    return false;
  }
  if (params.chart_id > 0x00ffffffu) { return false; }
  if (!(params.dt > 0.0) || !finite_f32(params.dt)) { return false; }
  if (params.ambient_pressure_pa < 0.0
      || !finite_f32(params.ambient_pressure_pa)) { return false; }
  if (params.pressure_scale < 0.0
      || !finite_f32(params.pressure_scale)) { return false; }
  return params.grid_spacing_m > 0.0
    && finite_f32(params.grid_spacing_m);
}

fn field_shape_admitted() -> bool {
  if (!exact_grid_shape()) { return false; }
  if (!cell_origins_admitted()) { return false; }
  if (!capacity_dispatch_admitted()) { return false; }
  return arrayLength(&field_view) >= FIELD_HEADER_WORDS;
}

fn field_identity_a_admitted() -> bool {
  if (field_load(0u) != FIELD_MAGIC) { return false; }
  if (field_load(1u) != FIELD_VERSION) { return false; }
  if (field_load(2u) != FIELD_READY_ADMITTED) { return false; }
  if (field_load(3u) != params.generation_id) { return false; }
  if (field_load(8u) != params.storage_generation) { return false; }
  if (field_load(9u) != params.physics_tick) { return false; }
  if (field_load(10u) != params.physics_substep) { return false; }
  if (field_load(11u) != params.position_epoch) { return false; }
  if (field_load(12u) != params.topology_epoch) { return false; }
  if (field_load(13u) != params.chart_epoch) { return false; }
  if (field_load(14u) != params.level_epoch) { return false; }
  if (field_load(15u) != params.support_epoch) { return false; }
  if (field_load(17u) != bitcast<u32>(params.selected_level)) {
    return false;
  }
  return field_load(18u) == params.grid_node_count;
}

fn field_identity_b_admitted() -> bool {
  if (field_load(19u) != params.grid_nx) { return false; }
  if (field_load(20u) != params.grid_ny) { return false; }
  if (field_load(21u) != params.grid_nz) { return false; }
  if (field_load(23u) != bitcast<u32>(params.grid_spacing_m)) {
    return false;
  }
  if (field_load(27u) != FIELD_KEY_WORDS) { return false; }
  if (field_load(29u) != FIELD_ACCUMULATOR_WORDS) { return false; }
  if (field_load(31u) != FIELD_STATE_WORDS) { return false; }
  if (field_load(32u) != params.field_capacity) { return false; }
  if (field_load(34u) > params.field_capacity) { return false; }
  if (field_load(38u) != params.field_completion_ordinal) { return false; }
  if (field_load(42u) > arrayLength(&field_view)) { return false; }
  // claim_velocity_state publishes the grid-update output mutation ordinal
  // and marks the field EMPTY before main converts momentum rows to
  // velocities. The boundary transaction runs after main, but before the
  // existing S9 transports, contact, and final velocity seal, so EMPTY is the
  // only admissible encoding at this exact pipeline seam.
  if (field_load(59u) != FIELD_STATE_EMPTY) { return false; }
  return field_load(63u) == params.field_mutation_ordinal;
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
  }
  field_store(2u, FIELD_FAIL_CLOSED);
  field_store(44u, 0u);
  field_store(45u, 0u);
  field_store(46u, 0u);
  field_store(59u, FIELD_STATE_EMPTY);
  field_store(60u, 0u);
  field_store(61u, 0u);
  field_store(62u, 0u);
}

fn moment_valid(field_index: u32) -> bool {
  if (field_index >= field_load(34u)) { return false; }
  let row = field_index * MOMENT_ROW_WORDS;
  let key = field_key(field_index);
  if (row + MOMENT_ROW_WORDS < row
      || row + MOMENT_ROW_WORDS > arrayLength(&moment_rows)
      || key + FIELD_KEY_WORDS < key
      || key + FIELD_KEY_WORDS > arrayLength(&field_view)) {
    return false;
  }
  let volume = bitcast<f32>(moment_rows[row + 4u]);
  let gradient = vec3<f32>(
    bitcast<f32>(moment_rows[row + 5u]),
    bitcast<f32>(moment_rows[row + 6u]),
    bitcast<f32>(moment_rows[row + 7u])
  );
  return moment_rows[row] == field_load(key)
    && moment_rows[row + 1u] == field_load(key + 1u)
    && moment_rows[row + 2u] == field_load(key + 2u)
    && moment_rows[row + 3u] == field_load(key + 3u)
    && volume > 0.0
    && finite_f32(volume)
    && finite_vec3(gradient)
    && moment_rows[row + 8u] > 0u
    && moment_rows[row + 9u] == MOMENT_READY_ADMITTED;
}

fn field_mass(field_index: u32) -> f32 {
  return bitcast<f32>(field_load(field_state(field_index)));
}

fn field_velocity(field_index: u32) -> vec3<f32> {
  let state = field_state(field_index);
  return vec3<f32>(
    bitcast<f32>(field_load(state + 1u)),
    bitcast<f32>(field_load(state + 2u)),
    bitcast<f32>(field_load(state + 3u))
  );
}

fn field_volume(field_index: u32) -> f32 {
  return bitcast<f32>(
    moment_rows[field_index * MOMENT_ROW_WORDS + 4u]
  );
}

fn field_gradient(field_index: u32) -> vec3<f32> {
  let row = field_index * MOMENT_ROW_WORDS;
  return vec3<f32>(
    bitcast<f32>(moment_rows[row + 5u]),
    bitcast<f32>(moment_rows[row + 6u]),
    bitcast<f32>(moment_rows[row + 7u])
  );
}

fn field_row_valid(field_index: u32) -> bool {
  if (!moment_valid(field_index)) { return false; }
  let state = field_state(field_index);
  let accumulator = field_accumulator(field_index);
  if (state + FIELD_STATE_WORDS < state
      || state + FIELD_STATE_WORDS > arrayLength(&field_view)
      || accumulator + FIELD_ACCUMULATOR_WORDS < accumulator
      || accumulator + FIELD_ACCUMULATOR_WORDS > arrayLength(&field_view)) {
    return false;
  }
  let mass = field_mass(field_index);
  let velocity = field_velocity(field_index);
  let phase = field_load(field_key(field_index) + 1u);
  return phase >= PHASE_SOLID
    && phase <= 4u
    && mass > 0.0
    && finite_f32(mass)
    && finite_vec3(velocity)
    && field_load(state + 7u) > 0u;
}

fn gas_authority_admitted() -> bool {
  if (arrayLength(&gas_authority_control) < 32u
      || params.gas_pressure_cell_capacity > 0x15555555u
      || params.gas_pressure_cell_stride_floats != GAS_PRESSURE_ROW_FLOATS
      || arrayLength(&gas_pressure_rows)
        < params.gas_pressure_cell_capacity * GAS_PRESSURE_ROW_FLOATS) {
    return false;
  }
  let status = gas_authority_control[2u];
  let live_count = gas_authority_control[8u];
  let cell_count = gas_authority_control[10u];
  let ready_count = gas_authority_control[11u];
  let empty = (status & GAS_AUTHORITY_EMPTY) != 0u;
  return gas_authority_control[0u] == GAS_AUTHORITY_MAGIC
    && gas_authority_control[1u] == GAS_AUTHORITY_VERSION
    && (status & GAS_AUTHORITY_REQUIRED_READY) == GAS_AUTHORITY_REQUIRED_READY
    && (status & GAS_AUTHORITY_FAILED) == 0u
    && (status & GAS_AUTHORITY_UNKNOWN_STATUS_MASK) == 0u
    && gas_authority_control[3u] == 0u
    && gas_authority_control[4u] == params.gas_execution_generation
    && gas_authority_control[5u] == params.gas_execution_generation
    && gas_authority_control[6u] == params.gas_storage_generation
    && gas_authority_control[7u] == params.gas_pressure_cell_capacity
    && live_count <= params.gas_pressure_cell_capacity
    && gas_authority_control[9u] == params.gas_directory_generation
    && cell_count <= live_count
    && ready_count == cell_count
    && gas_authority_control[30u] == GAS_PRESSURE_ROW_FLOATS
    && gas_authority_control[31u] == cell_count
    && ((empty && live_count == 0u && cell_count == 0u)
      || (!empty && live_count > 0u && cell_count > 0u));
}

fn gas_directory_admitted() -> bool {
  if (arrayLength(&gas_directory) < DIRECTORY_HEADER_WORDS
      || params.gas_directory_word_length < DIRECTORY_HEADER_WORDS
      || params.gas_directory_word_length > arrayLength(&gas_directory)
      || params.gas_directory_cell_capacity
      > params.gas_pressure_cell_capacity) {
    return false;
  }
  let expected_offsets_offset =
    DIRECTORY_HEADER_WORDS
      + params.gas_directory_cell_capacity * DIRECTORY_KEY_WORDS;
  let expected_members_offset =
    expected_offsets_offset + params.gas_directory_cell_capacity + 1u;
  let expected_reverse_offset =
    expected_members_offset + params.gas_pressure_cell_capacity;
  let expected_word_length =
    expected_reverse_offset + params.gas_pressure_cell_capacity + 6u;
  let status = gas_directory[2u];
  let live_count = gas_authority_control[8u];
  let cell_count = gas_authority_control[10u];
  return gas_directory[0u] == DIRECTORY_MAGIC
    && gas_directory[1u] == DIRECTORY_VERSION
    && (status & DIRECTORY_READY_ADMITTED) == DIRECTORY_READY_ADMITTED
    && (status & DIRECTORY_REJECT_MASK) == 0u
    && gas_directory[3u] == params.gas_directory_generation
    && gas_directory[8u] == params.gas_storage_generation
    && gas_directory[16u] == live_count
    && gas_directory[17u] == params.gas_pressure_cell_capacity
    && gas_directory[18u] == cell_count
    && gas_directory[19u] == params.gas_directory_cell_capacity
    && gas_directory[22u] == params.gas_directory_word_length
    && gas_directory[23u] == 0u
    && gas_directory[24u] == 0u
    && gas_directory[25u] == DIRECTORY_KEY_WORDS
    && gas_directory[26u] == DIRECTORY_KEY_WORDS
    && gas_directory[27u] == DIRECTORY_SORT_LEXICOGRAPHIC
    && gas_directory[28u] == DIRECTORY_HEADER_WORDS
    && params.gas_directory_cell_keys_offset_words == DIRECTORY_HEADER_WORDS
    && params.gas_directory_cell_offsets_offset_words == expected_offsets_offset
    && params.gas_directory_cell_members_offset_words == expected_members_offset
    && params.gas_directory_particle_to_cell_offset_words
      == expected_reverse_offset
    && params.gas_directory_word_length == expected_word_length
    && gas_directory[29u] == params.gas_directory_cell_keys_offset_words
    && gas_directory[30u] == params.gas_directory_cell_offsets_offset_words
    && gas_directory[31u] == params.gas_directory_cell_members_offset_words
    && gas_directory[32u]
      == params.gas_directory_particle_to_cell_offset_words
    && gas_directory[33u] == gas_directory[35u]
    && gas_directory[35u] != 0u
    && gas_directory[36u] == params.gas_directory_generation
    && gas_directory[37u] == live_count
    && gas_directory[38u] == cell_count
    && gas_directory[39u] == 1u
    && gas_directory[40u] == 0u
    && gas_directory[41u] == 1u
    && gas_directory[42u] == gas_authority_control[22u]
    && gas_directory[43u] == gas_authority_control[23u]
    && gas_directory[44u] == gas_authority_control[24u]
    && gas_directory[42u] == gas_authority_control[25u]
    && gas_directory[43u] == gas_authority_control[26u]
    && gas_directory[44u] == gas_authority_control[27u]
    && gas_directory[46u] == DIRECTORY_ACTIVE_NODE_ADAPTER
    && expected_word_length >= expected_reverse_offset;
}

fn gas_inputs_admitted() -> bool {
  return gas_authority_admitted() && gas_directory_admitted();
}

fn signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn directory_key_word(cell_index: u32, word: u32) -> u32 {
  return gas_directory[
    params.gas_directory_cell_keys_offset_words
      + cell_index * DIRECTORY_KEY_WORDS + word
  ];
}

fn compare_directory_key(cell_index: u32, sought: array<u32, 5>) -> i32 {
  for (var word = 0u; word < DIRECTORY_KEY_WORDS; word = word + 1u) {
    let actual = directory_key_word(cell_index, word);
    if (actual < sought[word]) { return -1; }
    if (actual > sought[word]) { return 1; }
  }
  return 0;
}

fn find_gas_cell(sought: array<u32, 5>) -> u32 {
  var low = 0u;
  var high = gas_authority_control[10u];
  loop {
    if (low >= high) { break; }
    let middle = low + (high - low) / 2u;
    if (compare_directory_key(middle, sought) < 0) {
      low = middle + 1u;
    } else {
      high = middle;
    }
  }
  if (low < gas_authority_control[10u]
      && compare_directory_key(low, sought) == 0) {
    return low;
  }
  return INVALID_CELL;
}

fn node_cell_key(dense_node: u32) -> array<u32, 5> {
  let yz = params.grid_ny * params.grid_nz;
  let x = dense_node / yz;
  let remainder = dense_node - x * yz;
  let y = remainder / params.grid_nz;
  let z = remainder - y * params.grid_nz;
  var key: array<u32, 5>;
  key[0u] = params.chart_id;
  key[1u] = signed_order_key(params.selected_level);
  key[2u] = signed_order_key(params.grid_cell_origin_x + i32(x));
  key[3u] = signed_order_key(params.grid_cell_origin_y + i32(y));
  key[4u] = signed_order_key(params.grid_cell_origin_z + i32(z));
  return key;
}

fn gas_cell_pressure(cell_index: u32, sought: array<u32, 5>) -> vec3<f32> {
  if (cell_index == INVALID_CELL
      || cell_index >= gas_authority_control[10u]) {
    return vec3<f32>(0.0, 0.0, 1.0);
  }
  let row = cell_index * GAS_PRESSURE_ROW_FLOATS;
  let expected_x = bitcast<i32>(sought[2u] ^ 0x80000000u);
  let expected_y = bitcast<i32>(sought[3u] ^ 0x80000000u);
  let expected_z = bitcast<i32>(sought[4u] ^ 0x80000000u);
  let pressure = gas_pressure_rows[row + 7u];
  let gradient = vec3<f32>(
    gas_pressure_rows[row + 8u],
    gas_pressure_rows[row + 9u],
    gas_pressure_rows[row + 10u]
  );
  let valid = gas_pressure_rows[row + 0u] == f32(expected_x)
    && gas_pressure_rows[row + 1u] == f32(expected_y)
    && gas_pressure_rows[row + 2u] == f32(expected_z)
    && gas_pressure_rows[row + 3u] > 0.5
    && finite_f32(gas_pressure_rows[row + 4u])
    && finite_f32(gas_pressure_rows[row + 5u])
    && finite_f32(gas_pressure_rows[row + 6u])
    && pressure >= 0.0
    && finite_f32(pressure)
    && finite_vec3(gradient)
    && gas_pressure_rows[row + 11u] > 0.0
    && finite_f32(gas_pressure_rows[row + 11u]);
  return vec3<f32>(pressure, 1.0, select(0.0, 1.0, valid));
}

fn scratch_row(field_index: u32) -> u32 {
  return SCRATCH_HEADER_WORDS + field_index * SCRATCH_ROW_WORDS;
}

fn scratch_row_seal(field_index: u32) -> u32 {
  let row = scratch_row(field_index);
  var seal = field_index ^ scratch_load(row + SCRATCH_STATUS);
  for (var word = 0u; word < SCRATCH_STATUS; word = word + 1u) {
    seal = seal ^ scratch_load(row + word);
  }
  return seal;
}

fn scratch_row_has_status(field_index: u32, status: u32) -> bool {
  let row = scratch_row(field_index);
  return row + SCRATCH_ROW_WORDS <= arrayLength(&scratch)
    && scratch_load(row + SCRATCH_STATUS) == status
    && scratch_load(row + SCRATCH_SEAL) == scratch_row_seal(field_index);
}

fn scratch_row_numeric_valid(field_index: u32) -> bool {
  let row = scratch_row(field_index);
  return finite_vec3(vec3<f32>(
      bitcast<f32>(scratch_load(row + SCRATCH_VELOCITY_X)),
      bitcast<f32>(scratch_load(row + SCRATCH_VELOCITY_Y)),
      bitcast<f32>(scratch_load(row + SCRATCH_VELOCITY_Z))
    ))
    && finite_vec3(vec3<f32>(
      bitcast<f32>(scratch_load(row + SCRATCH_EXTERNAL_X)),
      bitcast<f32>(scratch_load(row + SCRATCH_EXTERNAL_Y)),
      bitcast<f32>(scratch_load(row + SCRATCH_EXTERNAL_Z))
    ))
    && finite_f32(bitcast<f32>(scratch_load(row + SCRATCH_EXTERNAL_WORK)))
    && bitcast<f32>(scratch_load(row + SCRATCH_MASS)) > 0.0
    && finite_f32(bitcast<f32>(scratch_load(row + SCRATCH_MASS)))
    && bitcast<f32>(scratch_load(row + SCRATCH_VOLUME)) > 0.0
    && finite_f32(bitcast<f32>(scratch_load(row + SCRATCH_VOLUME)))
    && finite_f32(bitcast<f32>(scratch_load(row + SCRATCH_GAUGE)));
}

fn initialize_scratch_row(field_index: u32) -> bool {
  if (!field_row_valid(field_index)) { return false; }
  let row = scratch_row(field_index);
  let accumulator = field_accumulator(field_index);
  let velocity = field_velocity(field_index);
  let external_impulse = vec3<f32>(
    bitcast<f32>(field_load(accumulator + ACC_EXTERNAL_X)),
    bitcast<f32>(field_load(accumulator + ACC_EXTERNAL_Y)),
    bitcast<f32>(field_load(accumulator + ACC_EXTERNAL_Z))
  );
  let work_j = bitcast<f32>(field_load(accumulator + ACC_EXTERNAL_WORK));
  if (row + SCRATCH_ROW_WORDS > arrayLength(&scratch)
      || !finite_vec3(external_impulse) || !finite_f32(work_j)) {
    return false;
  }
  scratch_store(row + SCRATCH_VELOCITY_X, bitcast<u32>(velocity.x));
  scratch_store(row + SCRATCH_VELOCITY_Y, bitcast<u32>(velocity.y));
  scratch_store(row + SCRATCH_VELOCITY_Z, bitcast<u32>(velocity.z));
  scratch_store(row + SCRATCH_EXTERNAL_X, bitcast<u32>(external_impulse.x));
  scratch_store(row + SCRATCH_EXTERNAL_Y, bitcast<u32>(external_impulse.y));
  scratch_store(row + SCRATCH_EXTERNAL_Z, bitcast<u32>(external_impulse.z));
  scratch_store(row + SCRATCH_EXTERNAL_WORK, bitcast<u32>(work_j));
  scratch_store(row + SCRATCH_MASS, bitcast<u32>(field_mass(field_index)));
  scratch_store(row + SCRATCH_VOLUME, bitcast<u32>(field_volume(field_index)));
  scratch_store(row + SCRATCH_GAUGE, bitcast<u32>(0.0));
  scratch_store(row + SCRATCH_STATUS, SCRATCH_ROW_INITIALIZED);
  scratch_store(row + SCRATCH_SEAL, scratch_row_seal(field_index));
  return scratch_row_numeric_valid(field_index);
}

fn finalize_scratch_row(field_index: u32) {
  let row = scratch_row(field_index);
  scratch_store(row + SCRATCH_STATUS, SCRATCH_ROW_READY);
  scratch_store(row + SCRATCH_SEAL, scratch_row_seal(field_index));
}

fn stage_node(begin: u32, end: u32) -> bool {
  let node = field_load(field_key(begin));
  var condensed_volume = 0.0;
  var condensed_gradient = vec3<f32>(0.0);
  for (var field_index = begin; field_index < end; field_index = field_index + 1u) {
    if (!field_row_valid(field_index)
        || !scratch_row_has_status(field_index, SCRATCH_ROW_INITIALIZED)
        || !scratch_row_numeric_valid(field_index)
        || field_load(field_key(field_index)) != node) {
      return false;
    }
    let phase = field_load(field_key(field_index) + 1u);
    if (phase == PHASE_SOLID || phase == PHASE_LIQUID) {
      condensed_volume = condensed_volume + field_volume(field_index);
      condensed_gradient = condensed_gradient + field_gradient(field_index);
    }
  }
  if (!finite_f32(condensed_volume) || !finite_vec3(condensed_gradient)) {
    return false;
  }
  if (!(condensed_volume > 0.0)) {
    for (var field_index = begin; field_index < end; field_index = field_index + 1u) {
      finalize_scratch_row(field_index);
    }
    return true;
  }
  let sought = node_cell_key(node);
  let gas_cell = find_gas_cell(sought);
  let pressure_sample = gas_cell_pressure(gas_cell, sought);
  if (pressure_sample.y == 0.0) {
    if (params.missing_cell_policy == MISSING_FAIL_CLOSED) { return false; }
    for (var field_index = begin; field_index < end; field_index = field_index + 1u) {
      finalize_scratch_row(field_index);
    }
    return params.missing_cell_policy == MISSING_NO_LOAD;
  }
  if (pressure_sample.z == 0.0) { return false; }
  let gauge_pa = pressure_sample.x - params.ambient_pressure_pa;
  let total_impulse_ns = params.pressure_scale
    * gauge_pa * condensed_gradient * params.dt;
  if (!finite_f32(gauge_pa) || !finite_vec3(total_impulse_ns)) {
    return false;
  }
  for (var field_index = begin; field_index < end; field_index = field_index + 1u) {
    let phase = field_load(field_key(field_index) + 1u);
    if (phase == PHASE_SOLID || phase == PHASE_LIQUID) {
      let row = scratch_row(field_index);
      let mass = bitcast<f32>(scratch_load(row + SCRATCH_MASS));
      let volume = bitcast<f32>(scratch_load(row + SCRATCH_VOLUME));
      let share = volume / condensed_volume;
      let impulse_ns = total_impulse_ns * share;
      let initial_velocity = vec3<f32>(
        bitcast<f32>(scratch_load(row + SCRATCH_VELOCITY_X)),
        bitcast<f32>(scratch_load(row + SCRATCH_VELOCITY_Y)),
        bitcast<f32>(scratch_load(row + SCRATCH_VELOCITY_Z))
      );
      let next_velocity = initial_velocity + impulse_ns / mass;
      let external_impulse = vec3<f32>(
        bitcast<f32>(scratch_load(row + SCRATCH_EXTERNAL_X)),
        bitcast<f32>(scratch_load(row + SCRATCH_EXTERNAL_Y)),
        bitcast<f32>(scratch_load(row + SCRATCH_EXTERNAL_Z))
      ) + impulse_ns;
      let initial_work = bitcast<f32>(
        scratch_load(row + SCRATCH_EXTERNAL_WORK)
      );
      let kinetic_before = 0.5 * mass * dot(initial_velocity, initial_velocity);
      let kinetic_after = 0.5 * mass * dot(next_velocity, next_velocity);
      let external_work = initial_work + kinetic_after - kinetic_before;
      if (!(share > 0.0) || !finite_f32(share)
          || !finite_vec3(impulse_ns)
          || !finite_vec3(next_velocity)
          || !finite_vec3(external_impulse)
          || !finite_f32(external_work)) {
        return false;
      }
      scratch_store(row + SCRATCH_VELOCITY_X, bitcast<u32>(next_velocity.x));
      scratch_store(row + SCRATCH_VELOCITY_Y, bitcast<u32>(next_velocity.y));
      scratch_store(row + SCRATCH_VELOCITY_Z, bitcast<u32>(next_velocity.z));
      scratch_store(row + SCRATCH_EXTERNAL_X, bitcast<u32>(external_impulse.x));
      scratch_store(row + SCRATCH_EXTERNAL_Y, bitcast<u32>(external_impulse.y));
      scratch_store(row + SCRATCH_EXTERNAL_Z, bitcast<u32>(external_impulse.z));
      scratch_store(row + SCRATCH_EXTERNAL_WORK, bitcast<u32>(external_work));
      scratch_store(row + SCRATCH_GAUGE, bitcast<u32>(gauge_pa));
    }
    if (!scratch_row_numeric_valid(field_index)) { return false; }
    finalize_scratch_row(field_index);
  }
  return true;
}

// Static authorities are authenticated once on the GPU before the row
// transaction. The sealed scratch flags are queue-ordered proof for all later
// passes, avoiding both host readback and O(N) repetition of static checks.
@compute @workgroup_size(${SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE})
fn prevalidate_field_boundary_transport(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let field_index = capacity_linear_invocation(local_id, workgroup_id);
  if (field_index != 0u) { return; }
  // A failed field check deliberately leaves word 9 unsealed. The immediately
  // following source prevalidation observes that absence and records the
  // single fail-closed scratch bit, keeping this compiler-sensitive entry
  // branch-light without weakening the transaction.
  if (!scratch_unvalidated_admitted()) { return; }
  if (!field_params_admitted()) { return; }
  if (!field_shape_admitted()) { return; }
  if (!field_identity_a_admitted()) { return; }
  if (!field_identity_b_admitted()) { return; }
  if (!field_receipt_admitted()) { return; }
  if (!local_pressure_claim_pending()) { return; }
  scratch_store(9u, SCRATCH_FIELD_ADMISSION_SEAL);
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE})
fn prevalidate_source_boundary_transport(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let field_index = capacity_linear_invocation(local_id, workgroup_id);
  if (field_index != 0u) { return; }
  if (!scratch_field_prevalidated_admitted()
      || !phase_volume_receipt_admitted()
      || !gas_inputs_admitted()) {
    reject_scratch();
    return;
  }
  scratch_store(10u, SCRATCH_SOURCE_ADMISSION_SEAL);
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE})
fn initialize_boundary_transport(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let field_index = capacity_linear_invocation(local_id, workgroup_id);
  if (!scratch_prevalidation_admitted()) {
    reject_scratch();
    return;
  }
  if (field_index >= params.field_capacity || field_index >= field_load(34u)) {
    return;
  }
  if (!initialize_scratch_row(field_index)) { reject_scratch(); }
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE})
fn stage_boundary_transport(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let first = capacity_linear_invocation(local_id, workgroup_id);
  if (!scratch_prevalidation_admitted()) {
    reject_scratch();
    return;
  }
  let field_count = field_load(34u);
  if (first >= params.field_capacity || first >= field_count
      || scratch_load(2u) != 0u) {
    return;
  }
  let node = field_load(field_key(first));
  if (first > 0u && field_load(field_key(first - 1u)) == node) { return; }
  var end = first + 1u;
  loop {
    if (end >= field_count || field_load(field_key(end)) != node) { break; }
    end = end + 1u;
  }
  if (!stage_node(first, end)) { reject_scratch(); }
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE})
fn validate_boundary_transport(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let field_index = capacity_linear_invocation(local_id, workgroup_id);
  if (!scratch_admitted()) {
    reject_scratch();
    return;
  }
  if (field_index >= params.field_capacity || field_index >= field_load(34u)
      || scratch_load(2u) != 0u) {
    return;
  }
  if (!scratch_row_has_status(field_index, SCRATCH_ROW_READY)
      || !scratch_row_numeric_valid(field_index)) {
    reject_scratch();
    return;
  }
  atomicAdd(&scratch[8u], 1u);
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE})
fn commit_boundary_transport(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let field_index = capacity_linear_invocation(local_id, workgroup_id);
  if (!scratch_admitted()
      || scratch_load(2u) != 0u
      || scratch_load(8u) != field_load(34u)) {
    if (field_index == 0u) { reject_transport(); }
    return;
  }
  if (field_index >= params.field_capacity || field_index >= field_load(34u)) {
    return;
  }
  // Validation completed in a prior dispatch. This is deliberately a
  // store-only pass with no late rejection path and therefore cannot expose a
  // partially validated mechanics-field update.
  let row = scratch_row(field_index);
  let state = field_state(field_index);
  let accumulator = field_accumulator(field_index);
  field_store(state + 1u, scratch_load(row + SCRATCH_VELOCITY_X));
  field_store(state + 2u, scratch_load(row + SCRATCH_VELOCITY_Y));
  field_store(state + 3u, scratch_load(row + SCRATCH_VELOCITY_Z));
  field_store(accumulator + ACC_EXTERNAL_X, scratch_load(row + SCRATCH_EXTERNAL_X));
  field_store(accumulator + ACC_EXTERNAL_Y, scratch_load(row + SCRATCH_EXTERNAL_Y));
  field_store(accumulator + ACC_EXTERNAL_Z, scratch_load(row + SCRATCH_EXTERNAL_Z));
  field_store(
    accumulator + ACC_EXTERNAL_WORK,
    scratch_load(row + SCRATCH_EXTERNAL_WORK)
  );
}
`;
