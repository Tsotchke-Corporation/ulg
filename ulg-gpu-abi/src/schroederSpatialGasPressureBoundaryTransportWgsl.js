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
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_FINE_TO_COARSE_PARENT_ADJOINT,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_SAME_LEVEL,
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
  SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD,
  SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_READY,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_VERSION,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_WORKGROUP_SIZE
} from './schroederSpatialParentFieldView.js';
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
  cross_level_mapping_mode: u32,
  gas_selected_level: i32,
  gas_grid_node_count: u32,
  gas_grid_nx: u32,
  gas_grid_ny: u32,
  gas_grid_nz: u32,
  gas_grid_cell_origin_x: i32,
  gas_grid_cell_origin_y: i32,
  gas_grid_cell_origin_z: i32,
  gas_grid_spacing_m: f32,
  parent_generation_id: u32,
  parent_completion_ordinal: u32,
  parent_field_capacity: u32,
  parent_field_word_capacity: u32,
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
@group(0) @binding(8) var<storage, read> parent_field_view: array<u32>;

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
// A rejected source transaction never initializes its first row. Preserve a
// compact rejection discriminator in that otherwise-unused row status so a
// caller-owned diagnostic copy can identify the failed authority without
// changing the admitted scratch ABI or exposing private source buffers.
const SCRATCH_SOURCE_REJECT_FIELD: u32 = 1u;
const SCRATCH_SOURCE_REJECT_PHASE_VOLUME: u32 = 2u;
const SCRATCH_SOURCE_REJECT_GAS_AUTHORITY: u32 = 3u;
const SCRATCH_SOURCE_REJECT_GAS_DIRECTORY: u32 = 4u;
const SCRATCH_SOURCE_REJECT_PARENT_FIELD: u32 = 5u;
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
const CROSS_LEVEL_SAME_LEVEL: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_SAME_LEVEL
)};
const CROSS_LEVEL_FINE_TO_COARSE_PARENT_ADJOINT: u32 = ${u32(
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_FINE_TO_COARSE_PARENT_ADJOINT
)};
const PARENT_FIELD_MAGIC: u32 = ${u32(
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_MAGIC
)};
const PARENT_FIELD_VERSION: u32 = ${u32(
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_VERSION
)};
const PARENT_FIELD_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_READY
    | SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_ADMITTED
)};
const PARENT_FIELD_HEADER_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS
)};
const PARENT_FIELD_KEY_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS
)};
const PARENT_FIELD_MAX_FINE_EDGES: u32 = ${u32(
  SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD
)};
const PARENT_FIELD_WORKGROUP_SIZE: u32 = ${u32(
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_WORKGROUP_SIZE
)};
const PARENT_FIELD_WEIGHT_TOLERANCE: f32 = 9.5367431640625e-7;

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

fn reject_source_scratch(reason: u32) {
  let status_word = SCRATCH_HEADER_WORDS + SCRATCH_STATUS;
  if (status_word < arrayLength(&scratch)) {
    scratch_store(status_word, reason);
  }
  reject_scratch();
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

fn exact_grid_shape_for(
  node_count: u32,
  nx: u32,
  ny: u32,
  nz: u32
) -> bool {
  if (nx == 0u || ny == 0u || nz == 0u) {
    return false;
  }
  // Chained exact division proves nx * ny * nz == node_count without ever
  // constructing an overflow-prone intermediate product.
  if (node_count % nx != 0u) { return false; }
  let after_x = node_count / nx;
  if (after_x % ny != 0u) { return false; }
  return after_x / ny == nz
    && nx <= 0x7fffffffu
    && ny <= 0x7fffffffu
    && nz <= 0x7fffffffu;
}

fn exact_grid_shape() -> bool {
  return exact_grid_shape_for(
    params.grid_node_count,
    params.grid_nx,
    params.grid_ny,
    params.grid_nz
  );
}

fn cell_origins_admitted_for(
  origin_x: i32,
  origin_y: i32,
  origin_z: i32,
  nx: u32,
  ny: u32,
  nz: u32
) -> bool {
  return origin_x <= 2147483647 - i32(nx - 1u)
    && origin_y <= 2147483647 - i32(ny - 1u)
    && origin_z <= 2147483647 - i32(nz - 1u);
}

fn cell_origins_admitted() -> bool {
  return cell_origins_admitted_for(
    params.grid_cell_origin_x,
    params.grid_cell_origin_y,
    params.grid_cell_origin_z,
    params.grid_nx,
    params.grid_ny,
    params.grid_nz
  );
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

fn cross_level_params_admitted() -> bool {
  if (!exact_grid_shape_for(
      params.gas_grid_node_count,
      params.gas_grid_nx,
      params.gas_grid_ny,
      params.gas_grid_nz
    )
    || !cell_origins_admitted_for(
      params.gas_grid_cell_origin_x,
      params.gas_grid_cell_origin_y,
      params.gas_grid_cell_origin_z,
      params.gas_grid_nx,
      params.gas_grid_ny,
      params.gas_grid_nz
    )
    || !(params.gas_grid_spacing_m > 0.0)
    || !finite_f32(params.gas_grid_spacing_m)) {
    return false;
  }
  if (params.cross_level_mapping_mode == CROSS_LEVEL_SAME_LEVEL) {
    return params.gas_selected_level == params.selected_level
      && params.gas_grid_node_count == params.grid_node_count
      && params.gas_grid_nx == params.grid_nx
      && params.gas_grid_ny == params.grid_ny
      && params.gas_grid_nz == params.grid_nz
      && params.gas_grid_cell_origin_x == params.grid_cell_origin_x
      && params.gas_grid_cell_origin_y == params.grid_cell_origin_y
      && params.gas_grid_cell_origin_z == params.grid_cell_origin_z
      && bitcast<u32>(params.gas_grid_spacing_m)
        == bitcast<u32>(params.grid_spacing_m)
      && params.parent_generation_id == 0u
      && params.parent_completion_ordinal == 0u
      && params.parent_field_capacity == 0u
      && params.parent_field_word_capacity == 0u;
  }
  if (
    params.cross_level_mapping_mode
      != CROSS_LEVEL_FINE_TO_COARSE_PARENT_ADJOINT
    || params.selected_level == 2147483647
    || params.gas_selected_level != params.selected_level + 1
    || bitcast<u32>(params.gas_grid_spacing_m)
      != bitcast<u32>(params.grid_spacing_m * 2.0)
    || params.grid_cell_origin_x == bitcast<i32>(0x80000000u)
    || params.gas_grid_cell_origin_x == bitcast<i32>(0x80000000u)
    || params.grid_cell_origin_x > 0
    || params.gas_grid_cell_origin_x > 0
    || params.grid_cell_origin_x != params.grid_cell_origin_y
    || params.grid_cell_origin_y != params.grid_cell_origin_z
    || params.gas_grid_cell_origin_x != params.gas_grid_cell_origin_y
    || params.gas_grid_cell_origin_y != params.gas_grid_cell_origin_z
    || params.parent_generation_id == 0u
    || params.parent_generation_id != params.generation_id
    || params.parent_completion_ordinal == 0u
    || params.parent_field_capacity == 0u
    || params.parent_field_word_capacity < PARENT_FIELD_HEADER_WORDS
  ) {
    return false;
  }
  return params.field_capacity <= 0xffffffffu / PARENT_FIELD_MAX_FINE_EDGES
    && params.parent_field_capacity
      > params.field_capacity * PARENT_FIELD_MAX_FINE_EDGES;
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
    && finite_f32(params.grid_spacing_m)
    && cross_level_params_admitted();
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

fn gas_authority_reject_reason() -> u32 {
  if (arrayLength(&gas_authority_control) < 32u) { return 1u; }
  if (params.gas_pressure_cell_capacity > 0x15555555u) { return 2u; }
  if (params.gas_pressure_cell_stride_floats != GAS_PRESSURE_ROW_FLOATS) {
    return 3u;
  }
  if (arrayLength(&gas_pressure_rows)
      < params.gas_pressure_cell_capacity * GAS_PRESSURE_ROW_FLOATS) {
    return 4u;
  }
  let status = gas_authority_control[2u];
  let live_count = gas_authority_control[8u];
  let cell_count = gas_authority_control[10u];
  let ready_count = gas_authority_control[11u];
  let empty = (status & GAS_AUTHORITY_EMPTY) != 0u;
  if (gas_authority_control[0u] != GAS_AUTHORITY_MAGIC) { return 5u; }
  if (gas_authority_control[1u] != GAS_AUTHORITY_VERSION) { return 6u; }
  if ((status & GAS_AUTHORITY_REQUIRED_READY) != GAS_AUTHORITY_REQUIRED_READY) {
    return 7u;
  }
  if ((status & GAS_AUTHORITY_FAILED) != 0u) { return 8u; }
  if ((status & GAS_AUTHORITY_UNKNOWN_STATUS_MASK) != 0u) { return 9u; }
  if (gas_authority_control[3u] != 0u) { return 10u; }
  if (gas_authority_control[4u] != params.gas_execution_generation) {
    return 11u;
  }
  if (gas_authority_control[5u] != params.gas_execution_generation) {
    return 12u;
  }
  if (gas_authority_control[6u] != params.gas_storage_generation) {
    return 13u;
  }
  if (gas_authority_control[7u] != params.gas_pressure_cell_capacity) {
    return 14u;
  }
  if (live_count > params.gas_pressure_cell_capacity) { return 15u; }
  if (gas_authority_control[9u] != params.gas_directory_generation) {
    return 16u;
  }
  if (cell_count > live_count) { return 17u; }
  if (ready_count != cell_count) { return 18u; }
  if (gas_authority_control[30u] != GAS_PRESSURE_ROW_FLOATS) { return 19u; }
  if (gas_authority_control[31u] != cell_count) { return 20u; }
  if (!((empty && live_count == 0u && cell_count == 0u)
      || (!empty && live_count > 0u && cell_count > 0u))) {
    return 21u;
  }
  return 0u;
}

fn gas_authority_admitted() -> bool {
  return gas_authority_reject_reason() == 0u;
}

fn reject_gas_authority_scratch(reason: u32) {
  let row = SCRATCH_HEADER_WORDS;
  if (row + SCRATCH_ROW_WORDS <= arrayLength(&scratch)
      && arrayLength(&gas_authority_control) >= 12u) {
    // Rejected source rows are never initialized. Mirror only the compact
    // public control prefix needed to explain the rejection; pressure rows and
    // directory contents remain private to the producer.
    for (var word = 0u; word < 10u; word = word + 1u) {
      scratch_store(row + word, gas_authority_control[word + 2u]);
    }
  }
  reject_source_scratch(0x300u + reason);
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

fn parent_dispatch_admitted(offset: u32, invocation_count: u32) -> bool {
  let x = parent_field_view[offset];
  let y = parent_field_view[offset + 1u];
  let z = parent_field_view[offset + 2u];
  if (invocation_count == 0u) {
    return x == 0u && y == 0u && z == 0u;
  }
  let group_count = invocation_count / PARENT_FIELD_WORKGROUP_SIZE + select(
    0u,
    1u,
    invocation_count % PARENT_FIELD_WORKGROUP_SIZE != 0u
  );
  if (x == 0u || y == 0u || z != 1u || x > group_count) { return false; }
  return y == group_count / x + select(0u, 1u, group_count % x != 0u);
}

fn parent_field_view_admitted() -> bool {
  if (params.cross_level_mapping_mode == CROSS_LEVEL_SAME_LEVEL) {
    return true;
  }
  if (
    params.cross_level_mapping_mode
      != CROSS_LEVEL_FINE_TO_COARSE_PARENT_ADJOINT
    || params.parent_field_word_capacity > arrayLength(&parent_field_view)
    || arrayLength(&parent_field_view) < PARENT_FIELD_HEADER_WORDS
  ) {
    return false;
  }
  let fine_capacity = params.field_capacity;
  if (fine_capacity > 0xffffffffu / PARENT_FIELD_MAX_FINE_EDGES) {
    return false;
  }
  let edge_capacity = fine_capacity * PARENT_FIELD_MAX_FINE_EDGES;
  if (params.parent_field_capacity <= edge_capacity) { return false; }
  let coarse_capacity = params.parent_field_capacity - edge_capacity;
  if (
    params.parent_field_capacity
      > (0xffffffffu - PARENT_FIELD_HEADER_WORDS) / PARENT_FIELD_KEY_WORDS
  ) {
    return false;
  }
  let parent_key_offset = PARENT_FIELD_HEADER_WORDS;
  let fine_edge_count_offset = parent_key_offset
    + params.parent_field_capacity * PARENT_FIELD_KEY_WORDS;
  if (fine_capacity > 0xffffffffu - fine_edge_count_offset) { return false; }
  let fine_edge_offset_offset = fine_edge_count_offset + fine_capacity;
  if (fine_capacity + 1u > 0xffffffffu - fine_edge_offset_offset) {
    return false;
  }
  let fine_edge_parent_offset = fine_edge_offset_offset + fine_capacity + 1u;
  if (edge_capacity > 0xffffffffu - fine_edge_parent_offset) { return false; }
  let fine_edge_weight_offset = fine_edge_parent_offset + edge_capacity;
  if (edge_capacity > 0xffffffffu - fine_edge_weight_offset) { return false; }
  let coarse_native_map_offset = fine_edge_weight_offset + edge_capacity;
  if (coarse_capacity > 0xffffffffu - coarse_native_map_offset) { return false; }
  let exact_word_capacity = coarse_native_map_offset + coarse_capacity;
  let fine_count = parent_field_view[35u];
  let coarse_count = parent_field_view[36u];
  let parent_count = parent_field_view[37u];
  let edge_count = parent_field_view[38u];
  let expected_candidate_count =
    fine_count * PARENT_FIELD_MAX_FINE_EDGES + coarse_count;
  let emitted_candidate_count = edge_count + coarse_count;
  let expected_unique_count = parent_count + select(
    0u,
    1u,
    expected_candidate_count > emitted_candidate_count
  );
  let weight_residual = bitcast<f32>(parent_field_view[42u]);
  let first_moment_residual = bitcast<f32>(parent_field_view[43u]);
  if (
    parent_field_view[0u] != PARENT_FIELD_MAGIC
    || parent_field_view[1u] != PARENT_FIELD_VERSION
    || parent_field_view[2u] != PARENT_FIELD_READY_ADMITTED
    || parent_field_view[3u] != params.parent_generation_id
    || parent_field_view[3u] != params.generation_id
  ) {
    return false;
  }
  for (var word = 4u; word <= 15u; word = word + 1u) {
    if (parent_field_view[word] != field_load(word)) { return false; }
  }
  if (
    parent_field_view[16u] != bitcast<u32>(params.selected_level)
    || parent_field_view[17u] != bitcast<u32>(params.gas_selected_level)
    || parent_field_view[18u] != params.grid_node_count
    || parent_field_view[19u] != params.gas_grid_node_count
    || parent_field_view[20u] != params.grid_nx
    || parent_field_view[21u] != params.grid_ny
    || parent_field_view[22u] != params.grid_nz
    || parent_field_view[23u] != params.gas_grid_nx
    || parent_field_view[24u] != params.gas_grid_ny
    || parent_field_view[25u] != params.gas_grid_nz
    || parent_field_view[26u] != u32(-params.grid_cell_origin_x)
    || parent_field_view[27u] != u32(-params.gas_grid_cell_origin_x)
    || parent_field_view[28u] != bitcast<u32>(params.grid_spacing_m)
    || parent_field_view[29u] != bitcast<u32>(params.gas_grid_spacing_m)
    || parent_field_view[30u] != fine_capacity
    || parent_field_view[31u] != coarse_capacity
    || parent_field_view[32u] != params.parent_field_capacity
    || parent_field_view[33u] != params.parent_field_capacity
    || parent_field_view[34u] != edge_capacity
    || fine_count != field_load(34u)
    || fine_count > fine_capacity
    || coarse_count > coarse_capacity
    || parent_count > params.parent_field_capacity
    || edge_count > edge_capacity
    || parent_count > emitted_candidate_count
    || parent_field_view[39u] != 0u
    || parent_field_view[40u] != 0u
    || parent_field_view[41u] != 0u
    || weight_residual < 0.0
    || !finite_f32(weight_residual)
    || weight_residual > PARENT_FIELD_WEIGHT_TOLERANCE
    || first_moment_residual < 0.0
    || !finite_f32(first_moment_residual)
    || parent_field_view[44u] != params.parent_completion_ordinal
    || parent_field_view[45u] == 0u
    || parent_field_view[46u] != params.field_completion_ordinal
    || parent_field_view[47u] == 0u
    || parent_field_view[48u] != parent_key_offset
    || parent_field_view[49u] != PARENT_FIELD_KEY_WORDS
    || parent_field_view[50u] != fine_edge_count_offset
    || parent_field_view[51u] != fine_edge_offset_offset
    || parent_field_view[52u] != fine_edge_parent_offset
    || parent_field_view[53u] != fine_edge_weight_offset
    || parent_field_view[54u] != coarse_native_map_offset
    || parent_field_view[55u] != exact_word_capacity
    || parent_field_view[56u] != params.parent_field_word_capacity
    || params.parent_field_word_capacity != exact_word_capacity
    || parent_field_view[57u] != params.parent_generation_id
    || parent_field_view[58u] != expected_candidate_count
    || parent_field_view[59u] != expected_unique_count
    || !parent_dispatch_admitted(60u, parent_count)
    || parent_field_view[63u] != params.parent_completion_ordinal
    || !parent_dispatch_admitted(64u, fine_count)
    || parent_field_view[67u] != 2u
    || !parent_dispatch_admitted(68u, coarse_count)
    || parent_field_view[71u] != 0u
    || parent_field_view[72u] != emitted_candidate_count
    || parent_field_view[73u] != coarse_count
    || parent_field_view[74u] != edge_count
    || parent_field_view[75u] != 1u
    || parent_field_view[76u] != PARENT_FIELD_MAX_FINE_EDGES
    || parent_field_view[77u] != exact_word_capacity
    || parent_field_view[78u] != 0u
    || parent_field_view[79u] != 0u
    || parent_field_view[fine_edge_offset_offset] != 0u
    || parent_field_view[fine_edge_offset_offset + fine_count] != edge_count
  ) {
    return false;
  }
  return fine_count == 0u
    || (parent_count > 0u && edge_count >= fine_count);
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

fn grid_node_cell_key(
  dense_node: u32,
  level: i32,
  grid_ny: u32,
  grid_nz: u32,
  origin_x: i32,
  origin_y: i32,
  origin_z: i32
) -> array<u32, 5> {
  let yz = grid_ny * grid_nz;
  let x = dense_node / yz;
  let remainder = dense_node - x * yz;
  let y = remainder / grid_nz;
  let z = remainder - y * grid_nz;
  var key: array<u32, 5>;
  key[0u] = params.chart_id;
  key[1u] = signed_order_key(level);
  key[2u] = signed_order_key(origin_x + i32(x));
  key[3u] = signed_order_key(origin_y + i32(y));
  key[4u] = signed_order_key(origin_z + i32(z));
  return key;
}

fn node_cell_key(dense_node: u32) -> array<u32, 5> {
  return grid_node_cell_key(
    dense_node,
    params.selected_level,
    params.grid_ny,
    params.grid_nz,
    params.grid_cell_origin_x,
    params.grid_cell_origin_y,
    params.grid_cell_origin_z
  );
}

fn parent_node_cell_key(dense_node: u32) -> array<u32, 5> {
  return grid_node_cell_key(
    dense_node,
    params.gas_selected_level,
    params.gas_grid_ny,
    params.gas_grid_nz,
    params.gas_grid_cell_origin_x,
    params.gas_grid_cell_origin_y,
    params.gas_grid_cell_origin_z
  );
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

fn stage_same_level_node(begin: u32, end: u32) -> bool {
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

fn stage_fine_parent_field(field_index: u32) -> bool {
  let fine_edge_count_offset = parent_field_view[50u];
  let fine_edge_offset_offset = parent_field_view[51u];
  let fine_edge_parent_offset = parent_field_view[52u];
  let fine_edge_weight_offset = parent_field_view[53u];
  let parent_key_offset = parent_field_view[48u];
  let declared_count = parent_field_view[fine_edge_count_offset + field_index];
  let edge_begin = parent_field_view[fine_edge_offset_offset + field_index];
  let edge_end = parent_field_view[fine_edge_offset_offset + field_index + 1u];
  if (
    declared_count == 0u
    || declared_count > PARENT_FIELD_MAX_FINE_EDGES
    || edge_end < edge_begin
    || edge_end - edge_begin != declared_count
    || edge_end > parent_field_view[38u]
  ) {
    return false;
  }
  let fine_key = field_key(field_index);
  var weight_sum = 0.0;
  var effective_gauge_pa = 0.0;
  for (var edge = edge_begin; edge < edge_end; edge = edge + 1u) {
    let parent_index = parent_field_view[fine_edge_parent_offset + edge];
    if (parent_index >= parent_field_view[37u]) { return false; }
    for (var previous = edge_begin; previous < edge; previous = previous + 1u) {
      if (parent_field_view[fine_edge_parent_offset + previous] == parent_index) {
        return false;
      }
    }
    let parent_key = parent_key_offset + parent_index * PARENT_FIELD_KEY_WORDS;
    let parent_dense_node = parent_field_view[parent_key];
    if (
      parent_dense_node >= params.gas_grid_node_count
      || parent_field_view[parent_key + 1u] != field_load(fine_key + 1u)
      || parent_field_view[parent_key + 2u] != field_load(fine_key + 2u)
      || parent_field_view[parent_key + 3u] != field_load(fine_key + 3u)
    ) {
      return false;
    }
    let weight = bitcast<f32>(
      parent_field_view[fine_edge_weight_offset + edge]
    );
    if (!(weight > 0.0) || !finite_f32(weight)) { return false; }
    weight_sum = weight_sum + weight;
    let sought = parent_node_cell_key(parent_dense_node);
    let gas_cell = find_gas_cell(sought);
    let pressure_sample = gas_cell_pressure(gas_cell, sought);
    if (pressure_sample.y == 0.0) {
      if (params.missing_cell_policy == MISSING_FAIL_CLOSED) { return false; }
      if (params.missing_cell_policy != MISSING_NO_LOAD) { return false; }
      continue;
    }
    if (pressure_sample.z == 0.0) { return false; }
    let parent_gauge_pa = pressure_sample.x - params.ambient_pressure_pa;
    if (!finite_f32(parent_gauge_pa)) { return false; }
    effective_gauge_pa = effective_gauge_pa + weight * parent_gauge_pa;
  }
  if (
    !finite_f32(weight_sum)
    || abs(weight_sum - 1.0) > PARENT_FIELD_WEIGHT_TOLERANCE
    || !finite_f32(effective_gauge_pa)
  ) {
    return false;
  }
  let row = scratch_row(field_index);
  let mass = bitcast<f32>(scratch_load(row + SCRATCH_MASS));
  let impulse_ns = params.pressure_scale
    * effective_gauge_pa * field_gradient(field_index) * params.dt;
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
  let initial_work = bitcast<f32>(scratch_load(row + SCRATCH_EXTERNAL_WORK));
  let kinetic_before = 0.5 * mass * dot(initial_velocity, initial_velocity);
  let kinetic_after = 0.5 * mass * dot(next_velocity, next_velocity);
  let external_work = initial_work + kinetic_after - kinetic_before;
  if (
    !finite_vec3(impulse_ns)
    || !finite_vec3(next_velocity)
    || !finite_vec3(external_impulse)
    || !finite_f32(external_work)
  ) {
    return false;
  }
  scratch_store(row + SCRATCH_VELOCITY_X, bitcast<u32>(next_velocity.x));
  scratch_store(row + SCRATCH_VELOCITY_Y, bitcast<u32>(next_velocity.y));
  scratch_store(row + SCRATCH_VELOCITY_Z, bitcast<u32>(next_velocity.z));
  scratch_store(row + SCRATCH_EXTERNAL_X, bitcast<u32>(external_impulse.x));
  scratch_store(row + SCRATCH_EXTERNAL_Y, bitcast<u32>(external_impulse.y));
  scratch_store(row + SCRATCH_EXTERNAL_Z, bitcast<u32>(external_impulse.z));
  scratch_store(row + SCRATCH_EXTERNAL_WORK, bitcast<u32>(external_work));
  scratch_store(row + SCRATCH_GAUGE, bitcast<u32>(effective_gauge_pa));
  if (!scratch_row_numeric_valid(field_index)) { return false; }
  finalize_scratch_row(field_index);
  return true;
}

fn stage_fine_parent_node(begin: u32, end: u32) -> bool {
  let node = field_load(field_key(begin));
  for (var field_index = begin; field_index < end; field_index = field_index + 1u) {
    if (!field_row_valid(field_index)
        || !scratch_row_has_status(field_index, SCRATCH_ROW_INITIALIZED)
        || !scratch_row_numeric_valid(field_index)
        || field_load(field_key(field_index)) != node) {
      return false;
    }
  }
  for (var field_index = begin; field_index < end; field_index = field_index + 1u) {
    let phase = field_load(field_key(field_index) + 1u);
    if (phase == PHASE_SOLID || phase == PHASE_LIQUID) {
      if (!stage_fine_parent_field(field_index)) { return false; }
    } else {
      finalize_scratch_row(field_index);
    }
  }
  return true;
}

fn stage_node(begin: u32, end: u32) -> bool {
  if (params.cross_level_mapping_mode == CROSS_LEVEL_SAME_LEVEL) {
    return stage_same_level_node(begin, end);
  }
  if (
    params.cross_level_mapping_mode
      == CROSS_LEVEL_FINE_TO_COARSE_PARENT_ADJOINT
  ) {
    return stage_fine_parent_node(begin, end);
  }
  return false;
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
  if (!scratch_field_prevalidated_admitted()) {
    reject_source_scratch(SCRATCH_SOURCE_REJECT_FIELD);
    return;
  }
  if (!phase_volume_receipt_admitted()) {
    reject_source_scratch(SCRATCH_SOURCE_REJECT_PHASE_VOLUME);
    return;
  }
  let gas_authority_reason = gas_authority_reject_reason();
  if (gas_authority_reason != 0u) {
    reject_gas_authority_scratch(gas_authority_reason);
    return;
  }
  if (!gas_directory_admitted()) {
    reject_source_scratch(SCRATCH_SOURCE_REJECT_GAS_DIRECTORY);
    return;
  }
  if (!parent_field_view_admitted()) {
    reject_source_scratch(SCRATCH_SOURCE_REJECT_PARENT_FIELD);
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
