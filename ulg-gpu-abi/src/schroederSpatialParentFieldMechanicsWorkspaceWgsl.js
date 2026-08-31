import {
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ATOMIC_SCALE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_CFL_INTERVAL_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_MAGIC,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_INTERNAL_ENERGY_PARTICLE_OWNED_UNTOUCHED,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_INTERNAL_ENERGY_REFLUX_DEPOSIT,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_BUILDING_MOMENTUM,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_COARSE_PUBLISH_COMPLETE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_FINE_CORRECTION_COMPLETE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_PREDICTOR_VELOCITY_READY,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_FINE_IMPULSE_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROW_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROUTE_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_REFLUX_STRUCTURAL_UNMEASURED,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_REFLUX_MEASURED_CONSERVATIVE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_CSR,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_KEY,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_REGISTRY,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_ROUTE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_ENERGY_REJECTED,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_CFL_REJECTED,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_NONFINITE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_OVERFLOW,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_READY,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_VERSION
} from './schroederSpatialParentFieldMechanicsWorkspace.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_P2G_FINALIZED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_ENERGY_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_BUILDING,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_TEMPORAL_COARSE_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_CROSS_LEVEL,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_LAW_EXACT_P2G,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION,
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
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_VERSION
} from './schroederSpatialParentFieldView.js';
import {
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS,
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_MAGIC,
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS,
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_VERSION,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ACCUMULATING,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ALLOCATED,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_COARSE_APPLIED,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ENERGY_READY,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_SEALED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_CFL_REJECTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ENERGY_REJECTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_FAIL_CLOSED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_KEY_REJECTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_NONFINITE,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_OVERFLOW,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_PHASE_REJECTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ROUTE_REJECTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
} from './schroederCrossLevelRefluxLedger.js';
import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_MAGIC,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_VERSION,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_POLICY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_WORDS,
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
  schroederSpatialPhaseVolumePressureDragOperatorWgsl
} from './schroederSpatialPhaseVolumePressureDragOperatorWgsl.js';

export const schroederSpatialParentFieldMechanicsWorkspaceWgsl = /* wgsl */ `
struct ParentFieldMechanicsParams {
  parent_capacity: u32,
  fine_capacity: u32,
  coarse_capacity: u32,
  accumulator_offset: u32,
  baseline_offset: u32,
  combined_offset: u32,
  required_words: u32,
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
  fine_level: i32,
  coarse_level: i32,
  completion_ordinal: u32,
  parent_completion_ordinal: u32,
  fine_completion_ordinal: u32,
  coarse_completion_ordinal: u32,
  coarse_node_count: u32,
  coarse_nx: u32,
  coarse_ny: u32,
  coarse_nz: u32,
  coarse_shift: i32,
  coarse_spacing_m: f32,
  dt: f32,
  gravity_x: f32,
  gravity_y: f32,
  gravity_z: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  cfl_factor: f32,
  fine_dt: f32,
  max_correction_m_per_s: f32,
  workgroup_size: u32,
  atomic_scale: f32,
  wall_barrier_elastic_stiffness_n_per_m: f32,
  wall_barrier_contact_scale: f32,
  wall_barrier_min_gap_m: f32,
  fine_predictor_mutation_ordinal: u32,
  coarse_predictor_mutation_ordinal: u32,
  fine_correction_expected_mutation_ordinal: u32,
  fine_correction_output_mutation_ordinal: u32,
  coarse_publish_expected_mutation_ordinal: u32,
  coarse_publish_output_mutation_ordinal: u32,
  coarse_state_offset: u32,
  reflux_capacity: u32,
  reflux_reset: u32,
  route_proposal_offset: u32,
  parent_to_coarse_offset: u32,
  fine_impulse_offset: u32,
  fine_substep_ordinal: u32,
  fine_substep_count: u32,
  macro_dt: f32,
  macro_owner_id: u32,
  macro_owner_generation: u32,
  transport_enabled: u32,
  phase_record_count: u32,
  phase_route_capacity: u32,
  phase_route_words: u32,
  ambient_pressure_pa: f32,
  pressure_scale: f32,
  drag_scale: f32,
  max_impulse_fraction: f32,
  temporal_coarse_enabled: u32,
  temporal_coarse_successor_dt: f32,
  temporal_coarse_pad0: u32,
  temporal_coarse_pad1: u32,
};

@group(0) @binding(0) var<storage, read> parent_view: array<u32>;
@group(0) @binding(1) var<storage, read_write> fine_view: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> coarse_view: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> workspace: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> reflux_ledger: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: ParentFieldMechanicsParams;
@group(0) @binding(6) var<storage, read> phase_proposal_control: array<u32>;
@group(0) @binding(7) var<storage, read> phase_reflux_routes: array<u32>;
@group(0) @binding(8) var<storage, read> fine_phase_moments: array<u32>;
@group(0) @binding(9) var<storage, read> coarse_phase_moments: array<u32>;
@group(0) @binding(10) var<storage, read> material_phase_records: array<vec4<f32>>;
@group(0) @binding(11) var<storage, read_write> parent_to_coarse_ordinals: array<atomic<u32>>;

${schroederSpatialPhaseVolumePressureDragOperatorWgsl}

const WORKSPACE_MAGIC: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_MAGIC}u;
const WORKSPACE_VERSION: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_VERSION}u;
const WORKSPACE_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_WORDS}u;
const ROW_WORDS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROW_WORDS}u;
const ROUTE_WORDS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROUTE_WORDS}u;
const FINE_IMPULSE_WORDS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_FINE_IMPULSE_WORDS}u;
const CFL_INTERVAL_WORDS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_CFL_INTERVAL_WORDS}u;
const ATOMIC_SCALE: f32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ATOMIC_SCALE}.0;
const READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_READY
  | SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_ADMITTED
}u;
const STATUS_FAIL_CLOSED: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_FAIL_CLOSED}u;
const STATUS_INVALID_SOURCE: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_SOURCE}u;
const STATUS_OVERFLOW: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_OVERFLOW}u;
const STATUS_NONFINITE: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_NONFINITE}u;
const STATUS_INVALID_KEY: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_KEY}u;
const STATUS_INVALID_CSR: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_CSR}u;
const STATUS_INVALID_REGISTRY: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_REGISTRY}u;
const STATUS_INVALID_ROUTE: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_ROUTE}u;
const STATUS_ENERGY_REJECTED: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_ENERGY_REJECTED}u;
const STATUS_CFL_REJECTED: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_CFL_REJECTED}u;
const PHASE_BUILDING: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_BUILDING_MOMENTUM}u;
const PHASE_PREDICTORS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_PREDICTOR_VELOCITY_READY}u;
const PHASE_FINE_COMPLETE: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_FINE_CORRECTION_COMPLETE}u;
const PHASE_COARSE_COMPLETE: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_COARSE_PUBLISH_COMPLETE}u;
const FIELD_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC}u;
const FIELD_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION}u;
const FIELD_EMPTY: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY}u;
const FIELD_MOMENTUM: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT}u;
const FIELD_VELOCITY: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT}u;
const FIELD_DESCRIPTOR_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS}u;
const FIELD_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u;
const FIELD_KEY_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS}u;
const FIELD_ACCUMULATOR_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS}u;
const FIELD_RECEIPT_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS}u;
const FIELD_STATE_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS}u;
const FIELD_PRESSURE_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS}u;
const FIELD_RECEIPT_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC}u;
const FIELD_RECEIPT_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION}u;
const FIELD_RECEIPT_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED
}u;
const FIELD_RECEIPT_P2G_FINALIZED: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_P2G_FINALIZED}u;
const FIELD_RECEIPT_HEAT_BUILDING: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_BUILDING}u;
const FIELD_RECEIPT_ENERGY_READY: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_ENERGY_READY}u;
const FIELD_TEMPORAL_COARSE_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_TEMPORAL_COARSE_MAGIC}u;
const FIELD_PRESSURE_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC}u;
const FIELD_PRESSURE_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION}u;
const FIELD_PRESSURE_LAW_EXACT: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_LAW_EXACT_P2G}u;
const FIELD_PRESSURE_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_ADMITTED
}u;
const FIELD_PRESSURE_FAIL_CLOSED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_FAIL_CLOSED
}u;
const FIELD_PRESSURE_CONSUMER_LOCAL: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL}u;
const FIELD_PRESSURE_CONSUMER_CROSS_LEVEL: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_CROSS_LEVEL}u;
const PARENT_MAGIC: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_MAGIC}u;
const PARENT_VERSION: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_VERSION}u;
const INVALID_INDEX: u32 = 0xffffffffu;
const INTERNAL_ENERGY_PARTICLE_OWNED_UNTOUCHED: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_INTERNAL_ENERGY_PARTICLE_OWNED_UNTOUCHED}u;
const REFLUX_STRUCTURAL_UNMEASURED: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_REFLUX_STRUCTURAL_UNMEASURED}u;
const INTERNAL_ENERGY_REFLUX_DEPOSIT: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_INTERNAL_ENERGY_REFLUX_DEPOSIT}u;
const REFLUX_MEASURED_CONSERVATIVE: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_REFLUX_MEASURED_CONSERVATIVE}u;
const REFLUX_MAGIC: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_MAGIC}u;
const REFLUX_VERSION: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_VERSION}u;
const REFLUX_HEADER_WORDS: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS}u;
const REFLUX_ROW_WORDS: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS}u;
const REFLUX_READY_ADMITTED: u32 = ${
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
  | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED
}u;
const REFLUX_FAIL_CLOSED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_FAIL_CLOSED}u;
const REFLUX_OVERFLOW: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_OVERFLOW}u;
const REFLUX_NONFINITE: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_NONFINITE}u;
const REFLUX_CFL_REJECTED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_CFL_REJECTED}u;
const REFLUX_ENERGY_REJECTED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ENERGY_REJECTED}u;
const REFLUX_KEY_REJECTED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_KEY_REJECTED}u;
const REFLUX_ROUTE_REJECTED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ROUTE_REJECTED}u;
const REFLUX_PHASE_REJECTED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_PHASE_REJECTED}u;
const REFLUX_PHASE_ALLOCATED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ALLOCATED}u;
const REFLUX_PHASE_ACCUMULATING: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ACCUMULATING}u;
const REFLUX_PHASE_SEALED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_SEALED}u;
const REFLUX_PHASE_COARSE_APPLIED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_COARSE_APPLIED}u;
const REFLUX_PHASE_ENERGY_READY: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ENERGY_READY}u;
const PHASE_PROPOSAL_MAGIC: u32 = ${SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_MAGIC}u;
const PHASE_PROPOSAL_VERSION: u32 = ${SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_VERSION}u;
const PHASE_PROPOSAL_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS}u;
const PHASE_PROPOSAL_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_READY
  | SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_STATUS_ADMITTED
}u;
const PHASE_ROUTE_WORDS: u32 = ${SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_ROUTE_WORDS}u;
const PHASE_ROUTE_POLICY: u32 = ${SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_REFLUX_POLICY}u;
const PHASE_ROUTE_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_READY
  | SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_ROW_STATUS_ADMITTED
}u;
const PHASE_MOMENT_ROW_WORDS: u32 = ${SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS}u;
const PHASE_MOMENT_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY
  | SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED
}u;
const PHASE_SOLID: u32 = 1u;
const PHASE_GAS: u32 = 3u;
const PHASE_PLASMA: u32 = 4u;
const ROUTE_CFL_NUMERIC_GUARD_FACTOR: f32 = 0.9999847412109375;
const ROUTE_CFL_PHYSICAL_AUDIT_FACTOR: f32 = 1.000003814697265625;

fn ws_load(word: u32) -> u32 { return atomicLoad(&workspace[word]); }
fn ws_store(word: u32, value: u32) { atomicStore(&workspace[word], value); }
fn fine_load(word: u32) -> u32 { return atomicLoad(&fine_view[word]); }
fn fine_store(word: u32, value: u32) { atomicStore(&fine_view[word], value); }
fn coarse_load(word: u32) -> u32 { return atomicLoad(&coarse_view[word]); }
fn coarse_store(word: u32, value: u32) { atomicStore(&coarse_view[word], value); }
fn reflux_load(word: u32) -> u32 { return atomicLoad(&reflux_ledger[word]); }
fn reflux_store(word: u32, value: u32) { atomicStore(&reflux_ledger[word], value); }
fn parent_to_coarse_load(parent: u32) -> u32 {
  return atomicLoad(&parent_to_coarse_ordinals[parent]);
}
fn parent_to_coarse_store(parent: u32, value: u32) {
  atomicStore(&parent_to_coarse_ordinals[parent], value);
}

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= bitcast<f32>(0x7f7fffffu);
}

fn indirect_row_index(
  id: vec3<u32>,
  workgroup_count: vec3<u32>
) -> u32 {
  return id.x + id.y * workgroup_count.x * 64u;
}

fn measured_tolerance(left: f32, right: f32, count: u32) -> f32 {
  let n_epsilon = min(
    0.25,
    f32(max(1u, count)) * 5.960464477539063e-8
  );
  let gamma_n = n_epsilon / max(1.0e-20, 1.0 - n_epsilon);
  return max(
    8.0 * 1.175494351e-38,
    gamma_n * (abs(left) + abs(right))
  );
}

fn measured_scale_tolerance(scale: f32, count: u32) -> f32 {
  let n_epsilon = min(
    0.25,
    f32(max(1u, count)) * 5.960464477539063e-8
  );
  let gamma_n = n_epsilon / max(1.0e-20, 1.0 - n_epsilon);
  return max(8.0 * 1.175494351e-38, gamma_n * abs(scale));
}

fn measured_close(left: f32, right: f32, count: u32) -> bool {
  return finite_f32(left) && finite_f32(right)
    && abs(left - right) <= measured_tolerance(left, right, count);
}

fn measured_conditioned_close(
  left: f32, right: f32, operation_conditioning: f32, count: u32
) -> bool {
  let conditioning = max(
    abs(left) + abs(right),
    operation_conditioning
  );
  return finite_f32(left)
    && finite_f32(right)
    && finite_f32(operation_conditioning)
    && operation_conditioning >= 0.0
    && finite_f32(conditioning)
    && abs(left - right)
      <= measured_scale_tolerance(conditioning, count);
}

fn independent_reduction_operation_count(count: u32) -> u32 {
  // Two independently ordered reductions can each spend gamma_n, and the
  // serial absolute-conditioning reduction can spend it once more.
  return min(count, 0x55555555u) * 3u;
}

fn dot_product_conditioning(left: vec3<f32>, right: vec3<f32>) -> f32 {
  return abs(left.x * right.x)
    + abs(left.y * right.y)
    + abs(left.z * right.z);
}

fn measured_channel_energy_close(
  total: f32,
  pressure: f32,
  drag: f32,
  causal: f32,
  operation_conditioning: f32
) -> bool {
  let recomposed = pressure + drag + causal;
  let result_conditioning =
    abs(total) + abs(pressure) + abs(drag) + abs(causal);
  // Each channel expands sequential f32 kinetic work, including vector
  // divisions, dot products, and the preceding channel's updated velocity.
  // The rounded channel results can each be much smaller than their cancelling
  // linear/quadratic terms, so the caller also supplies the absolute operand
  // products for the direct and sequential expansions.
  let conditioning = max(result_conditioning, operation_conditioning);
  return finite_f32(total)
    && finite_f32(pressure)
    && finite_f32(drag)
    && finite_f32(causal)
    && finite_f32(recomposed)
    && finite_f32(operation_conditioning)
    && operation_conditioning >= 0.0
    && finite_f32(conditioning)
    && abs(total - recomposed)
      <= measured_scale_tolerance(conditioning, 64u);
}

fn range_fits(offset: u32, count: u32, total: u32) -> bool {
  return offset <= total && count <= total - offset;
}

fn scaled_range_fits(
  offset: u32, count: u32, stride: u32, total: u32
) -> bool {
  return stride > 0u && offset <= total
    && count <= (total - offset) / stride;
}

fn reflux_reject(flags: u32) {
  atomicOr(&reflux_ledger[2u], REFLUX_FAIL_CLOSED | flags);
  atomicAdd(&reflux_ledger[12u], 1u);
  atomicOr(&workspace[2u], STATUS_FAIL_CLOSED | STATUS_INVALID_SOURCE);
  atomicAdd(&workspace[37u], 1u);
}

fn prepare_reject(flags: u32, reason: u32) {
  // A failed preparation never publishes this macro ledger. Preserve the first
  // serial arithmetic branch in the terminal receipt's existing status-capture
  // sentinel so a fail-closed replay is diagnosable without perturbing any
  // parallel validator or adding a GPU dispatch/readback.
  if (reflux_load(124u) == 0xffffffffu) {
    reflux_store(124u, 0x50520000u | (reason & 0xffffu));
  }
  reflux_reject(flags);
}

fn reflux_structural() -> bool {
  return arrayLength(&reflux_ledger) >= REFLUX_HEADER_WORDS
    && reflux_load(0u) == REFLUX_MAGIC
    && reflux_load(1u) == REFLUX_VERSION
    && reflux_load(3u) == params.reflux_capacity
    && reflux_load(5u) == REFLUX_ROW_WORDS
    && reflux_load(6u) == REFLUX_HEADER_WORDS
    && params.reflux_capacity > 0u
    && scaled_range_fits(
      REFLUX_HEADER_WORDS, params.reflux_capacity,
      REFLUX_ROW_WORDS, arrayLength(&reflux_ledger)
    );
}

fn reflux_accumulating() -> bool {
  return reflux_structural()
    && reflux_load(2u) == REFLUX_READY_ADMITTED
    && reflux_load(59u) == REFLUX_PHASE_ACCUMULATING;
}

fn reflux_row(coarse_ordinal: u32) -> u32 {
  return REFLUX_HEADER_WORDS + coarse_ordinal * REFLUX_ROW_WORDS;
}

fn atomic_retry_limit() -> u32 {
  // These CAS reductions can have one contributor per live fine field.  A
  // fixed 256-attempt ceiling spuriously rejected otherwise finite high-N
  // scenes when more than 256 invocations contended on the same evidence
  // word.  Two attempts per possible contributor plus a small weak-CAS margin
  // bounds the loop while covering the admitted field capacities.
  let participants = max(ws_load(21u), ws_load(22u));
  return max(256u, min(65535u, participants * 2u + 64u));
}

fn atomic_add_f32(address: u32, value: f32) -> bool {
  if (!finite_f32(value)) { return false; }
  var attempts = 0u;
  loop {
    let prior_bits = reflux_load(address);
    let prior = bitcast<f32>(prior_bits);
    let next = prior + value;
    if (!finite_f32(prior) || !finite_f32(next)) { return false; }
    let claimed = atomicCompareExchangeWeak(
      &reflux_ledger[address], prior_bits, bitcast<u32>(next)
    );
    if (claimed.exchanged) { return true; }
    attempts = attempts + 1u;
    if (attempts >= atomic_retry_limit()) { return false; }
  }
}

fn atomic_max_nonnegative_f32(address: u32, value: f32) -> bool {
  if (!finite_f32(value) || value < 0.0) { return false; }
  var attempts = 0u;
  loop {
    let prior_bits = reflux_load(address);
    let prior = bitcast<f32>(prior_bits);
    if (!finite_f32(prior) || prior >= value) { return finite_f32(prior); }
    let claimed = atomicCompareExchangeWeak(
      &reflux_ledger[address], prior_bits, bitcast<u32>(value)
    );
    if (claimed.exchanged) { return true; }
    attempts = attempts + 1u;
    if (attempts >= atomic_retry_limit()) { return false; }
  }
}

fn atomic_min_nonnegative_f32(address: u32, value: f32) -> bool {
  if (!finite_f32(value) || value < 0.0) { return false; }
  var attempts = 0u;
  loop {
    let prior_bits = reflux_load(address);
    let prior = bitcast<f32>(prior_bits);
    if (prior <= value) { return prior >= 0.0; }
    let claimed = atomicCompareExchangeWeak(
      &reflux_ledger[address], prior_bits, bitcast<u32>(value)
    );
    if (claimed.exchanged) { return true; }
    attempts = attempts + 1u;
    if (attempts >= atomic_retry_limit()) { return false; }
  }
}

fn ws_atomic_add_f32(address: u32, value: f32) -> bool {
  if (!finite_f32(value)) { return false; }
  var attempts = 0u;
  loop {
    let prior_bits = ws_load(address);
    let prior = bitcast<f32>(prior_bits);
    let next = prior + value;
    if (!finite_f32(prior) || !finite_f32(next)) { return false; }
    let claimed = atomicCompareExchangeWeak(
      &workspace[address], prior_bits, bitcast<u32>(next)
    );
    if (claimed.exchanged) { return true; }
    attempts = attempts + 1u;
    if (attempts >= atomic_retry_limit()) { return false; }
  }
}

fn ws_atomic_min_nonnegative_f32(address: u32, value: f32) -> bool {
  if (!finite_f32(value) || value < 0.0) { return false; }
  var attempts = 0u;
  loop {
    let prior_bits = ws_load(address);
    let prior = bitcast<f32>(prior_bits);
    if (!finite_f32(prior) || prior <= value) { return finite_f32(prior); }
    let claimed = atomicCompareExchangeWeak(
      &workspace[address], prior_bits, bitcast<u32>(value)
    );
    if (claimed.exchanged) { return true; }
    attempts = attempts + 1u;
    if (attempts >= atomic_retry_limit()) { return false; }
  }
}

fn ws_atomic_max_nonnegative_f32(address: u32, value: f32) -> bool {
  if (!finite_f32(value) || value < 0.0) { return false; }
  var attempts = 0u;
  loop {
    let prior_bits = ws_load(address);
    let prior = bitcast<f32>(prior_bits);
    if (!finite_f32(prior) || prior >= value) { return finite_f32(prior); }
    let claimed = atomicCompareExchangeWeak(
      &workspace[address], prior_bits, bitcast<u32>(value)
    );
    if (claimed.exchanged) { return true; }
    attempts = attempts + 1u;
    if (attempts >= atomic_retry_limit()) { return false; }
  }
}

// Fine transaction projection uses the otherwise-dead post-predictor header
// words without changing any header fields admitted by workspace_admitted().
// Indices 0..31 are a compact, private seal; they are never persistent state.
fn fine_stage_address(index: u32) -> u32 {
  if (index < 8u) { return 69u + index; }
  return 80u + (index - 8u);
}

fn fine_stage_load(index: u32) -> u32 {
  return ws_load(fine_stage_address(index));
}

fn fine_stage_store(index: u32, value: u32) {
  ws_store(fine_stage_address(index), value);
}

fn ws_reject(flags: u32, counter_word: u32) {
  atomicOr(&workspace[2u], STATUS_FAIL_CLOSED | flags);
  if (counter_word < WORKSPACE_HEADER_WORDS) {
    atomicAdd(&workspace[counter_word], 1u);
  }
}

fn identity_parent() -> bool {
  return parent_view[3u] == params.generation_id
    && parent_view[4u] == params.device_ordinal
    && parent_view[5u] == params.lane_ordinal
    && parent_view[6u] == params.lease_token
    && parent_view[7u] == params.source_family_id
    && parent_view[8u] == params.storage_generation
    && parent_view[9u] == params.physics_tick
    && parent_view[10u] == params.physics_substep
    && parent_view[11u] == params.position_epoch
    && parent_view[12u] == params.topology_epoch
    && parent_view[13u] == params.chart_epoch
    && parent_view[14u] == params.level_epoch
    && parent_view[15u] == params.support_epoch;
}

fn identity_fine() -> bool {
  return fine_load(3u) == params.generation_id
    && fine_load(4u) == params.device_ordinal
    && fine_load(5u) == params.lane_ordinal
    && fine_load(6u) == params.lease_token
    && fine_load(7u) == params.source_family_id
    && fine_load(8u) == params.storage_generation
    && fine_load(9u) == params.physics_tick
    && fine_load(10u) == params.physics_substep
    && fine_load(11u) == params.position_epoch
    && fine_load(12u) == params.topology_epoch
    && fine_load(13u) == params.chart_epoch
    && fine_load(14u) == params.level_epoch
    && fine_load(15u) == params.support_epoch;
}

fn identity_coarse() -> bool {
  return coarse_load(3u) == params.generation_id
    && coarse_load(4u) == params.device_ordinal
    && coarse_load(5u) == params.lane_ordinal
    && coarse_load(6u) == params.lease_token
    && coarse_load(7u) == params.source_family_id
    && coarse_load(8u) == params.storage_generation
    && coarse_load(9u) == params.physics_tick
    && coarse_load(10u) == params.physics_substep
    && coarse_load(11u) == params.position_epoch
    && coarse_load(12u) == params.topology_epoch
    && coarse_load(13u) == params.chart_epoch
    && coarse_load(14u) == params.level_epoch
    && coarse_load(15u) == params.support_epoch;
}

fn parent_admitted() -> bool {
  if (arrayLength(&parent_view) < 80u) { return false; }
  return parent_view[0u] == PARENT_MAGIC
    && parent_view[1u] == PARENT_VERSION
    && parent_view[2u] == READY_ADMITTED
    && identity_parent()
    && bitcast<i32>(parent_view[16u]) == params.fine_level
    && bitcast<i32>(parent_view[17u]) == params.coarse_level
    && parent_view[30u] == params.fine_capacity
    && parent_view[31u] == params.coarse_capacity
    && parent_view[33u] == params.parent_capacity
    && parent_view[49u] == 4u
    && parent_view[35u] <= params.fine_capacity
    && parent_view[36u] <= params.coarse_capacity
    && parent_view[37u] <= params.parent_capacity
    && parent_view[38u] <= parent_view[34u]
    && parent_view[44u] == params.parent_completion_ordinal
    && parent_view[46u] == params.fine_completion_ordinal
    && parent_view[47u] == params.coarse_completion_ordinal
    && parent_view[55u] <= parent_view[56u]
    && parent_view[56u] <= arrayLength(&parent_view)
    && parent_view[67u] == 2u
    && parent_view[76u] == 8u
    && range_fits(parent_view[48u], params.parent_capacity * 4u, parent_view[55u])
    && range_fits(parent_view[50u], params.fine_capacity, parent_view[55u])
    && range_fits(parent_view[51u], params.fine_capacity + 1u, parent_view[55u])
    && range_fits(parent_view[52u], parent_view[34u], parent_view[55u])
    && range_fits(parent_view[53u], parent_view[34u], parent_view[55u])
    && range_fits(parent_view[54u], params.coarse_capacity, parent_view[55u]);
}

fn field_layout_admission_mask(
  words: u32,
  source_count: u32,
  descriptor_offset: u32,
  descriptor_words: u32,
  key_offset: u32,
  key_words: u32,
  accumulator_offset: u32,
  accumulator_words: u32,
  state_offset: u32,
  state_words: u32,
  capacity: u32,
  active_count: u32,
  active_required: u32,
  capacity_words: u32,
  descriptor_count: u32
) -> u32 {
  var mask = 0u;
  if (descriptor_words != FIELD_DESCRIPTOR_WORDS
      || key_words != FIELD_KEY_WORDS
      || accumulator_words != FIELD_ACCUMULATOR_WORDS
      || state_words != FIELD_STATE_WORDS) {
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
        || key_gap / FIELD_KEY_WORDS != capacity) {
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
          || accumulator_gap / FIELD_ACCUMULATOR_WORDS != capacity) {
        mask = mask | (1u << 11u);
      }
    }
  }
  // v4 required words bound the immutable pressure tail that follows the
  // full state-capacity bank, not the active state rows.
  var pressure_offset = 0u;
  var pressure_offset_ok = false;
  if (capacity <= (0xffffffffu - state_offset) / FIELD_STATE_WORDS) {
    pressure_offset = state_offset + capacity * FIELD_STATE_WORDS;
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
  // Guard the state+pressure capacity product with a constant-divisor bound.
  // Do not verify it by dividing the product back by the runtime capacity:
  // that variable division makes the NVIDIA shader compiler abort while
  // building this pipeline, which surfaces as a lost device rather than a
  // compile error.
  if (capacity_words < state_offset
      || capacity
        > 0xffffffffu / (FIELD_STATE_WORDS + FIELD_PRESSURE_WORDS)) {
    mask = mask | (1u << 13u);
  } else {
    let field_capacity_words =
      capacity * (FIELD_STATE_WORDS + FIELD_PRESSURE_WORDS);
    if (capacity_words - state_offset != field_capacity_words) {
      mask = mask | (1u << 13u);
    }
  }
  if (active_count > capacity || active_required > capacity_words
      || capacity_words != words) {
    mask = mask | (1u << 14u);
  }
  if (descriptor_count != source_count) { mask = mask | (1u << 15u); }
  return mask;
}

fn fine_admission_mask(encoding: u32, mutation_ordinal: u32) -> u32 {
  if (arrayLength(&fine_view) < FIELD_HEADER_WORDS) { return 0xffffffffu; }
  let capacity = fine_load(32u);
  var mask = field_layout_admission_mask(
    arrayLength(&fine_view), fine_load(16u), fine_load(24u), fine_load(25u),
    fine_load(26u), fine_load(27u), fine_load(28u), fine_load(29u),
    fine_load(30u), fine_load(31u), capacity, fine_load(34u),
    fine_load(41u), fine_load(42u), fine_load(54u)
  );
  if (fine_load(0u) != FIELD_MAGIC) { mask = mask | (1u << 0u); }
  if (fine_load(1u) != FIELD_VERSION) { mask = mask | (1u << 1u); }
  if (fine_load(2u) != READY_ADMITTED) { mask = mask | (1u << 2u); }
  if (!identity_fine()) { mask = mask | (1u << 3u); }
  if (bitcast<i32>(fine_load(17u)) != params.fine_level
      || fine_load(18u) != parent_view[18u]
      || fine_load(19u) != parent_view[20u]
      || fine_load(20u) != parent_view[21u]
      || fine_load(21u) != parent_view[22u]
      || fine_load(22u) != parent_view[26u]
      || fine_load(23u) != parent_view[28u]) {
    mask = mask | (1u << 4u);
  }
  if (capacity != params.fine_capacity) { mask = mask | (1u << 5u); }
  if (fine_load(38u) != params.fine_completion_ordinal) {
    mask = mask | (1u << 6u);
  }
  if (fine_load(59u) != encoding) { mask = mask | (1u << 16u); }
  if (fine_load(63u) != mutation_ordinal) { mask = mask | (1u << 17u); }
  return mask;
}

fn fine_admitted(encoding: u32, mutation_ordinal: u32) -> bool {
  return fine_admission_mask(encoding, mutation_ordinal) == 0u;
}

fn coarse_admission_mask(encoding: u32, mutation_ordinal: u32) -> u32 {
  if (arrayLength(&coarse_view) < FIELD_HEADER_WORDS) { return 0xffffffffu; }
  let capacity = coarse_load(32u);
  var mask = field_layout_admission_mask(
    arrayLength(&coarse_view), coarse_load(16u), coarse_load(24u),
    coarse_load(25u), coarse_load(26u), coarse_load(27u), coarse_load(28u),
    coarse_load(29u), coarse_load(30u), coarse_load(31u), capacity,
    coarse_load(34u), coarse_load(41u), coarse_load(42u), coarse_load(54u)
  );
  if (coarse_load(0u) != FIELD_MAGIC) { mask = mask | (1u << 0u); }
  if (coarse_load(1u) != FIELD_VERSION) { mask = mask | (1u << 1u); }
  if (coarse_load(2u) != READY_ADMITTED) { mask = mask | (1u << 2u); }
  if (!identity_coarse()) { mask = mask | (1u << 3u); }
  if (bitcast<i32>(coarse_load(17u)) != params.coarse_level
      || coarse_load(18u) != parent_view[19u]
      || coarse_load(19u) != parent_view[23u]
      || coarse_load(20u) != parent_view[24u]
      || coarse_load(21u) != parent_view[25u]
      || coarse_load(22u) != parent_view[27u]
      || coarse_load(23u) != parent_view[29u]) {
    mask = mask | (1u << 4u);
  }
  if (capacity != params.coarse_capacity) { mask = mask | (1u << 5u); }
  if (coarse_load(38u) != params.coarse_completion_ordinal) {
    mask = mask | (1u << 6u);
  }
  if (coarse_load(59u) != encoding) { mask = mask | (1u << 16u); }
  if (coarse_load(63u) != mutation_ordinal) { mask = mask | (1u << 17u); }
  return mask;
}

fn coarse_admitted(encoding: u32, mutation_ordinal: u32) -> bool {
  return coarse_admission_mask(encoding, mutation_ordinal) == 0u;
}

fn fine_receipt_offset() -> u32 {
  return fine_load(30u) - FIELD_RECEIPT_WORDS;
}

fn coarse_receipt_offset() -> u32 {
  return coarse_load(30u) - FIELD_RECEIPT_WORDS;
}

fn fine_pressure_offset() -> u32 {
  return fine_load(30u) + fine_load(32u) * FIELD_STATE_WORDS;
}

fn coarse_pressure_offset() -> u32 {
  return coarse_load(30u) + coarse_load(32u) * FIELD_STATE_WORDS;
}

fn fine_pressure_receipt_seal() -> u32 {
  let receipt = fine_receipt_offset();
  return FIELD_PRESSURE_MAGIC
    ^ FIELD_PRESSURE_VERSION
    ^ FIELD_PRESSURE_READY_ADMITTED
    ^ FIELD_PRESSURE_LAW_EXACT
    ^ fine_load(receipt + 28u)
    ^ fine_load(receipt + 29u)
    ^ fine_load(receipt + 30u)
    ^ fine_load(receipt + 31u)
    ^ fine_load(receipt + 32u)
    ^ fine_load(3u)
    ^ fine_load(8u)
    ^ fine_load(9u)
    ^ fine_load(10u)
    ^ fine_load(38u);
}

fn coarse_pressure_receipt_seal() -> u32 {
  let receipt = coarse_receipt_offset();
  return FIELD_PRESSURE_MAGIC
    ^ FIELD_PRESSURE_VERSION
    ^ FIELD_PRESSURE_READY_ADMITTED
    ^ FIELD_PRESSURE_LAW_EXACT
    ^ coarse_load(receipt + 28u)
    ^ coarse_load(receipt + 29u)
    ^ coarse_load(receipt + 30u)
    ^ coarse_load(receipt + 31u)
    ^ coarse_load(receipt + 32u)
    ^ coarse_load(3u)
    ^ coarse_load(8u)
    ^ coarse_load(9u)
    ^ coarse_load(10u)
    ^ coarse_load(38u);
}

fn fine_pressure_receipt_admitted(
  cross_required: bool,
  cross_claimed: bool
) -> bool {
  if (fine_load(30u) < FIELD_RECEIPT_WORDS) { return false; }
  let receipt = fine_receipt_offset();
  let required = fine_load(receipt + 32u);
  let claimed = fine_load(receipt + 33u);
  let consumed = fine_load(receipt + 34u);
  let expected_cross = select(
    0u,
    FIELD_PRESSURE_CONSUMER_CROSS_LEVEL,
    cross_claimed
  );
  return fine_load(receipt + 24u) == FIELD_PRESSURE_MAGIC
    && fine_load(receipt + 25u) == FIELD_PRESSURE_VERSION
    && fine_load(receipt + 26u) == FIELD_PRESSURE_READY_ADMITTED
    && fine_load(receipt + 27u) == FIELD_PRESSURE_LAW_EXACT
    && fine_load(receipt + 28u) == bitcast<u32>(params.ambient_pressure_pa)
    && fine_load(receipt + 30u) == fine_load(34u)
    && fine_load(receipt + 31u) == params.fine_predictor_mutation_ordinal
    && (required & (
      FIELD_PRESSURE_CONSUMER_LOCAL
        | FIELD_PRESSURE_CONSUMER_CROSS_LEVEL
    )) == select(
      FIELD_PRESSURE_CONSUMER_LOCAL,
      FIELD_PRESSURE_CONSUMER_LOCAL
        | FIELD_PRESSURE_CONSUMER_CROSS_LEVEL,
      cross_required
    )
    && (claimed & FIELD_PRESSURE_CONSUMER_LOCAL) != 0u
    && (consumed & FIELD_PRESSURE_CONSUMER_LOCAL) != 0u
    && (claimed & FIELD_PRESSURE_CONSUMER_CROSS_LEVEL) == expected_cross
    && (consumed & FIELD_PRESSURE_CONSUMER_CROSS_LEVEL) == 0u
    && (claimed & ~required) == 0u
    && (consumed & ~claimed) == 0u
    && fine_load(receipt + 35u) == fine_pressure_receipt_seal();
}

// cross_required distinguishes the two coarse fields this shader sees. The
// coarse predictor field is read by the cross-level operator and therefore
// declares LOCAL|CROSS_LEVEL. The coarse *terminal* field is produced by the
// final coarse P2G and consumed only by the coarse G2P, so it declares LOCAL
// alone; requiring CROSS_LEVEL of it is unsatisfiable because nothing in the
// terminal chain claims that consumer.
fn coarse_pressure_receipt_admitted(cross_required: bool) -> bool {
  if (coarse_load(30u) < FIELD_RECEIPT_WORDS) { return false; }
  let receipt = coarse_receipt_offset();
  let required = coarse_load(receipt + 32u);
  let claimed = coarse_load(receipt + 33u);
  let consumed = coarse_load(receipt + 34u);
  return coarse_load(receipt + 24u) == FIELD_PRESSURE_MAGIC
    && coarse_load(receipt + 25u) == FIELD_PRESSURE_VERSION
    && coarse_load(receipt + 26u) == FIELD_PRESSURE_READY_ADMITTED
    && coarse_load(receipt + 27u) == FIELD_PRESSURE_LAW_EXACT
    && coarse_load(receipt + 28u) == bitcast<u32>(params.ambient_pressure_pa)
    && coarse_load(receipt + 30u) == coarse_load(34u)
    && coarse_load(receipt + 31u) == params.coarse_predictor_mutation_ordinal
    && (required & (
      FIELD_PRESSURE_CONSUMER_LOCAL
        | FIELD_PRESSURE_CONSUMER_CROSS_LEVEL
    )) == select(
      FIELD_PRESSURE_CONSUMER_LOCAL,
      FIELD_PRESSURE_CONSUMER_LOCAL
        | FIELD_PRESSURE_CONSUMER_CROSS_LEVEL,
      cross_required
    )
    // The coarse local grid update runs after every fine correction, so the
    // coarse LOCAL consumer is still unclaimed here by construction. Pressure
    // rows are immutable once P2G seals them, so the cross-level consumer has
    // no ordering dependency on the local one; demanding LOCAL be consumed
    // first would make this contract unsatisfiable. G2P still gates on
    // required == claimed == consumed before any energy is used.
    && (claimed & ~required) == 0u
    && (consumed & ~claimed) == 0u
    && (consumed & FIELD_PRESSURE_CONSUMER_CROSS_LEVEL) == 0u
    && coarse_load(receipt + 35u) == coarse_pressure_receipt_seal();
}

fn reject_pressure_authority() {
  if (fine_load(30u) >= FIELD_RECEIPT_WORDS) {
    fine_store(fine_receipt_offset() + 26u, FIELD_PRESSURE_FAIL_CLOSED);
    fine_store(2u, READY_ADMITTED | STATUS_FAIL_CLOSED);
    fine_store(60u, 0u);
    fine_store(61u, 0u);
    fine_store(62u, 0u);
  }
  if (coarse_load(30u) >= FIELD_RECEIPT_WORDS) {
    coarse_store(
      coarse_receipt_offset() + 26u,
      FIELD_PRESSURE_FAIL_CLOSED
    );
    coarse_store(2u, READY_ADMITTED | STATUS_FAIL_CLOSED);
    coarse_store(60u, 0u);
    coarse_store(61u, 0u);
    coarse_store(62u, 0u);
  }
}

fn fine_receipt_admitted(phase: u32, mutation_ordinal: u32) -> bool {
  if (fine_load(30u) < FIELD_RECEIPT_WORDS) { return false; }
  let receipt = fine_receipt_offset();
  return fine_load(receipt) == FIELD_RECEIPT_MAGIC
    && fine_load(receipt + 1u) == FIELD_RECEIPT_VERSION
    && fine_load(receipt + 2u) == FIELD_RECEIPT_READY_ADMITTED
    && fine_load(receipt + 3u) == phase
    && fine_load(receipt + 5u) == mutation_ordinal
    && fine_load(receipt + 6u) == fine_load(34u);
}

fn coarse_receipt_admitted(phase: u32, mutation_ordinal: u32) -> bool {
  if (coarse_load(30u) < FIELD_RECEIPT_WORDS) { return false; }
  let receipt = coarse_receipt_offset();
  return coarse_load(receipt) == FIELD_RECEIPT_MAGIC
    && coarse_load(receipt + 1u) == FIELD_RECEIPT_VERSION
    && coarse_load(receipt + 2u) == FIELD_RECEIPT_READY_ADMITTED
    && coarse_load(receipt + 3u) == phase
    && coarse_load(receipt + 5u) == mutation_ordinal
    && coarse_load(receipt + 6u) == coarse_load(34u);
}

fn temporal_coarse_params_admitted() -> bool {
  let required = params.fine_substep_ordinal + 1u
    < params.fine_substep_count;
  if (params.temporal_coarse_pad0 != 0u
      || params.temporal_coarse_pad1 != 0u
      || params.temporal_coarse_enabled > 1u
      || (params.temporal_coarse_enabled != 0u) != required) {
    return false;
  }
  if (!required) {
    return bitcast<u32>(params.temporal_coarse_successor_dt) == 0u;
  }
  return finite_f32(params.temporal_coarse_successor_dt)
    && params.temporal_coarse_successor_dt > params.dt
    && params.temporal_coarse_successor_dt <= params.macro_dt;
}

fn coarse_temporal_receipt_seal() -> u32 {
  let receipt = coarse_receipt_offset();
  return FIELD_TEMPORAL_COARSE_MAGIC
    ^ coarse_load(receipt + 14u)
    ^ bitcast<u32>(params.coarse_level)
    ^ coarse_load(34u)
    ^ params.coarse_predictor_mutation_ordinal
    ^ coarse_load(3u)
    ^ coarse_load(8u)
    ^ coarse_load(9u)
    ^ coarse_load(10u)
    ^ coarse_load(38u);
}

fn temporal_coarse_receipts_admitted() -> bool {
  if (!temporal_coarse_params_admitted()
      || !fine_receipt_admitted(
        FIELD_RECEIPT_P2G_FINALIZED,
        params.fine_predictor_mutation_ordinal
      )
      || !coarse_receipt_admitted(
        FIELD_RECEIPT_P2G_FINALIZED,
        params.coarse_predictor_mutation_ordinal
      )) {
    return false;
  }
  let fine_receipt = fine_receipt_offset();
  let coarse_receipt = coarse_receipt_offset();
  if (fine_load(fine_receipt + 13u) != 0u
      || fine_load(fine_receipt + 14u) != 0u
      || fine_load(fine_receipt + 15u) != 0u) {
    return false;
  }
  if (params.temporal_coarse_enabled == 0u) {
    return coarse_load(coarse_receipt + 13u) == 0u
      && coarse_load(coarse_receipt + 14u) == 0u
      && coarse_load(coarse_receipt + 15u) == 0u;
  }
  return coarse_load(coarse_receipt + 13u) == FIELD_TEMPORAL_COARSE_MAGIC
    && coarse_load(coarse_receipt + 14u)
      == bitcast<u32>(params.temporal_coarse_successor_dt)
    && coarse_load(coarse_receipt + 15u)
      == coarse_temporal_receipt_seal();
}

fn workspace_admitted(phase: u32) -> bool {
  return arrayLength(&workspace) >= params.required_words
    && ws_load(0u) == WORKSPACE_MAGIC
    && ws_load(1u) == WORKSPACE_VERSION
    && ws_load(2u) == READY_ADMITTED
    && ws_load(3u) == params.generation_id
    && ws_load(4u) == params.device_ordinal
    && ws_load(5u) == params.lane_ordinal
    && ws_load(6u) == params.lease_token
    && ws_load(7u) == params.source_family_id
    && ws_load(8u) == params.storage_generation
    && ws_load(9u) == params.physics_tick
    && ws_load(10u) == params.physics_substep
    && ws_load(11u) == params.position_epoch
    && ws_load(12u) == params.topology_epoch
    && ws_load(13u) == params.chart_epoch
    && ws_load(14u) == params.level_epoch
    && ws_load(15u) == params.support_epoch
    && bitcast<i32>(ws_load(16u)) == params.fine_level
    && bitcast<i32>(ws_load(17u)) == params.coarse_level
    && ws_load(18u) == params.fine_capacity
    && ws_load(19u) == params.coarse_capacity
    && ws_load(20u) == params.parent_capacity
    && ws_load(25u) == params.accumulator_offset
    && ws_load(26u) == params.baseline_offset
    && ws_load(27u) == params.combined_offset
    && ws_load(77u) == params.coarse_state_offset
    && ws_load(78u) == params.route_proposal_offset
    && ws_load(79u) == params.parent_to_coarse_offset
    && ws_load(28u) == ROW_WORDS
    && ws_load(29u) == params.required_words
    && ws_load(30u) == arrayLength(&workspace)
    && ws_load(52u) == params.completion_ordinal
    && ws_load(53u) == params.parent_completion_ordinal
    && ws_load(54u) == params.fine_completion_ordinal
    && ws_load(55u) == params.coarse_completion_ordinal
    && scaled_range_fits(params.accumulator_offset, params.parent_capacity, ROW_WORDS, params.required_words)
    && scaled_range_fits(params.baseline_offset, params.parent_capacity, ROW_WORDS, params.required_words)
    && scaled_range_fits(params.combined_offset, params.parent_capacity, ROW_WORDS, params.required_words)
    && scaled_range_fits(params.coarse_state_offset, params.parent_capacity, ROW_WORDS, params.required_words)
    && scaled_range_fits(
      params.route_proposal_offset, params.parent_capacity,
      ROUTE_WORDS, params.required_words
    )
    && scaled_range_fits(
      params.fine_impulse_offset, params.fine_capacity,
      FINE_IMPULSE_WORDS, params.required_words
    )
    && arrayLength(&parent_to_coarse_ordinals) >= params.parent_capacity
    && reflux_structural()
    && ws_load(36u) == phase;
}

fn fine_key(field: u32, word: u32) -> u32 {
  return fine_load(fine_load(26u) + field * 4u + word);
}
fn coarse_key(field: u32, word: u32) -> u32 {
  return coarse_load(coarse_load(26u) + field * 4u + word);
}
fn parent_key(field: u32, word: u32) -> u32 {
  return parent_view[parent_view[48u] + field * 4u + word];
}

fn fine_parent_key_matches(fine_field: u32, parent_field: u32) -> bool {
  return fine_key(fine_field, 1u) == parent_key(parent_field, 1u)
    && fine_key(fine_field, 2u) == parent_key(parent_field, 2u)
    && fine_key(fine_field, 3u) == parent_key(parent_field, 3u);
}

fn coarse_parent_key_matches(coarse_field: u32, parent_field: u32) -> bool {
  return coarse_key(coarse_field, 0u) == parent_key(parent_field, 0u)
    && coarse_key(coarse_field, 1u) == parent_key(parent_field, 1u)
    && coarse_key(coarse_field, 2u) == parent_key(parent_field, 2u)
    && coarse_key(coarse_field, 3u) == parent_key(parent_field, 3u);
}

fn quantize(value: f32) -> vec2<i32> {
  let scaled = value * ATOMIC_SCALE;
  if (!finite_f32(value) || !finite_f32(scaled) || abs(scaled) > 2147483000.0) {
    return vec2<i32>(0, 1);
  }
  return vec2<i32>(i32(round(scaled)), 0);
}

fn add_fixed(address: u32, value: f32) -> bool {
  let q = quantize(value);
  if (q.y != 0) { return false; }
  let old = bitcast<i32>(atomicAdd(&workspace[address], bitcast<u32>(q.x)));
  let sum = f32(old) + f32(q.x);
  return abs(sum) <= 2147483000.0;
}

fn fixed_value(address: u32) -> f32 {
  return f32(bitcast<i32>(ws_load(address))) / ATOMIC_SCALE;
}

fn state_load(base: u32, word: u32) -> f32 {
  return bitcast<f32>(ws_load(base + word));
}
fn state_store(base: u32, word: u32, value: f32) {
  ws_store(base + word, bitcast<u32>(value));
}

@compute @workgroup_size(1)
fn initialize_parent_field_workspace() {
  if (params.reflux_reset != 0u) {
    for (var word = 0u; word < REFLUX_HEADER_WORDS; word = word + 1u) {
      reflux_store(word, 0u);
    }
    reflux_store(0u, REFLUX_MAGIC);
    reflux_store(1u, REFLUX_VERSION);
    reflux_store(2u, 0u);
    reflux_store(3u, params.reflux_capacity);
    reflux_store(5u, REFLUX_ROW_WORDS);
    reflux_store(6u, REFLUX_HEADER_WORDS);
    reflux_store(7u, params.macro_owner_id);
    reflux_store(54u, params.fine_substep_count);
    reflux_store(44u, 0x7f800000u);
    reflux_store(55u, 2u);
    reflux_store(56u, 1u);
    reflux_store(59u, REFLUX_PHASE_ALLOCATED);
    reflux_store(77u, bitcast<u32>(params.fine_level));
    reflux_store(78u, bitcast<u32>(params.coarse_level));
    reflux_store(79u, bitcast<u32>(params.coarse_spacing_m));
    reflux_store(80u, 0u);
    reflux_store(82u, params.macro_owner_id);
    reflux_store(83u, params.macro_owner_generation);
    reflux_store(97u, 0u);
    reflux_store(98u, params.fine_substep_count + 1u);
    reflux_store(111u, 1u);
    reflux_store(123u, params.macro_owner_generation);
    reflux_store(124u, 0xffffffffu);
  }
  ws_store(0u, WORKSPACE_MAGIC);
  ws_store(1u, WORKSPACE_VERSION);
  ws_store(2u, 0u);
  ws_store(3u, params.generation_id);
  ws_store(4u, params.device_ordinal);
  ws_store(5u, params.lane_ordinal);
  ws_store(6u, params.lease_token);
  ws_store(7u, params.source_family_id);
  ws_store(8u, params.storage_generation);
  ws_store(9u, params.physics_tick);
  ws_store(10u, params.physics_substep);
  ws_store(11u, params.position_epoch);
  ws_store(12u, params.topology_epoch);
  ws_store(13u, params.chart_epoch);
  ws_store(14u, params.level_epoch);
  ws_store(15u, params.support_epoch);
  ws_store(16u, bitcast<u32>(params.fine_level));
  ws_store(17u, bitcast<u32>(params.coarse_level));
  ws_store(18u, params.fine_capacity);
  ws_store(19u, params.coarse_capacity);
  ws_store(20u, params.parent_capacity);
  ws_store(25u, params.accumulator_offset);
  ws_store(26u, params.baseline_offset);
  ws_store(27u, params.combined_offset);
  ws_store(77u, params.coarse_state_offset);
  ws_store(78u, params.route_proposal_offset);
  ws_store(79u, params.parent_to_coarse_offset);
  ws_store(73u, params.fine_impulse_offset);
  ws_store(74u, FINE_IMPULSE_WORDS);
  ws_store(75u, ROUTE_WORDS);
  ws_store(76u, params.fine_substep_ordinal);
  ws_store(
    params.fine_impulse_offset
      + params.fine_capacity * FINE_IMPULSE_WORDS,
    bitcast<u32>(0.0)
  );
  ws_store(85u, bitcast<u32>(1.0));
  ws_store(28u, ROW_WORDS);
  ws_store(29u, params.required_words);
  ws_store(30u, arrayLength(&workspace));
  ws_store(31u, bitcast<u32>(params.atomic_scale));
  ws_store(32u, bitcast<u32>(params.dt));
  ws_store(33u, bitcast<u32>(params.fine_dt));
  ws_store(34u, bitcast<u32>(params.cfl_factor));
  ws_store(35u, bitcast<u32>(params.max_correction_m_per_s));
  ws_store(36u, PHASE_BUILDING);
  ws_store(52u, params.completion_ordinal);
  ws_store(53u, params.parent_completion_ordinal);
  ws_store(54u, params.fine_completion_ordinal);
  ws_store(55u, params.coarse_completion_ordinal);
  ws_store(56u, FIELD_MOMENTUM);
  ws_store(57u, FIELD_MOMENTUM);
  ws_store(58u, 0u);
  ws_store(59u, 0u);
  ws_store(69u, 1u);
  ws_store(48u, 0u);
  ws_store(49u, 0u);
  ws_store(50u, 0u);
  ws_store(51u, 0u);
  ws_store(71u, INTERNAL_ENERGY_REFLUX_DEPOSIT);
  ws_store(72u, REFLUX_MEASURED_CONSERVATIVE);
  let parent_admission_mask = select(1u, 0u, parent_admitted());
  let fine_field_admission_mask = fine_admission_mask(
    FIELD_MOMENTUM,
    params.fine_predictor_mutation_ordinal
  );
  let coarse_field_admission_mask = coarse_admission_mask(
    FIELD_MOMENTUM,
    params.coarse_predictor_mutation_ordinal
  );
  // On initializer failure these dispatch-header words are exact predicate
  // telemetry: parent, fine-field v2, coarse-field v2. A successful build
  // replaces them with authenticated indirect dispatch dimensions below.
  ws_store(60u, parent_admission_mask);
  ws_store(61u, fine_field_admission_mask);
  ws_store(62u, coarse_field_admission_mask);
  if (
    params.atomic_scale != ATOMIC_SCALE
    || params.workgroup_size != 64u
    || params.coarse_level != params.fine_level + 1
    || params.fine_substep_count == 0u
    || params.fine_substep_count > 4u
    || params.fine_substep_ordinal > params.fine_substep_count
    || params.required_words > arrayLength(&workspace)
    || !reflux_structural()
    || reflux_load(77u) != bitcast<u32>(params.fine_level)
    || reflux_load(78u) != bitcast<u32>(params.coarse_level)
    || reflux_load(79u) != bitcast<u32>(params.coarse_spacing_m)
    || reflux_load(7u) != params.macro_owner_id
    || reflux_load(54u) != params.fine_substep_count
    || reflux_load(82u) != params.macro_owner_id
    || reflux_load(83u) != params.macro_owner_generation
    || reflux_load(8u) != params.fine_substep_ordinal
    || reflux_load(15u) != params.fine_substep_ordinal
    || reflux_load(126u) != 0u
    || reflux_load(127u) != 0u
    || parent_admission_mask != 0u
    || fine_field_admission_mask != 0u
    || coarse_field_admission_mask != 0u
    || !temporal_coarse_receipts_admitted()
  ) {
    ws_store(2u, STATUS_FAIL_CLOSED | STATUS_INVALID_SOURCE);
    ws_store(37u, 1u);
    return;
  }
  ws_store(21u, parent_view[35u]);
  ws_store(22u, parent_view[36u]);
  ws_store(23u, parent_view[37u]);
  ws_store(24u, parent_view[38u]);
  ws_store(60u, parent_view[60u]);
  ws_store(61u, parent_view[61u]);
  ws_store(62u, parent_view[62u]);
  ws_store(63u, parent_view[64u]);
  ws_store(64u, parent_view[65u]);
  ws_store(65u, parent_view[66u]);
  ws_store(66u, parent_view[68u]);
  ws_store(67u, parent_view[69u]);
  ws_store(68u, parent_view[70u]);
  ws_store(2u, READY_ADMITTED);
}

// The macro terminal cannot rebuild a fine momentum field after fine G2P has
// consumed it. Initialize only the immutable parent topology, the actual
// deferred coarse velocity field, and the already-admitted macro ledger.
@compute @workgroup_size(1)
fn initialize_coarse_terminal_workspace() {
  ws_store(0u, WORKSPACE_MAGIC);
  ws_store(1u, WORKSPACE_VERSION);
  ws_store(2u, 0u);
  ws_store(3u, params.generation_id);
  ws_store(4u, params.device_ordinal);
  ws_store(5u, params.lane_ordinal);
  ws_store(6u, params.lease_token);
  ws_store(7u, params.source_family_id);
  ws_store(8u, params.storage_generation);
  ws_store(9u, params.physics_tick);
  ws_store(10u, params.physics_substep);
  ws_store(11u, params.position_epoch);
  ws_store(12u, params.topology_epoch);
  ws_store(13u, params.chart_epoch);
  ws_store(14u, params.level_epoch);
  ws_store(15u, params.support_epoch);
  ws_store(16u, bitcast<u32>(params.fine_level));
  ws_store(17u, bitcast<u32>(params.coarse_level));
  ws_store(18u, params.fine_capacity);
  ws_store(19u, params.coarse_capacity);
  ws_store(20u, params.parent_capacity);
  ws_store(25u, params.accumulator_offset);
  ws_store(26u, params.baseline_offset);
  ws_store(27u, params.combined_offset);
  ws_store(28u, ROW_WORDS);
  ws_store(29u, params.required_words);
  ws_store(30u, arrayLength(&workspace));
  ws_store(31u, bitcast<u32>(params.atomic_scale));
  ws_store(32u, bitcast<u32>(params.dt));
  ws_store(33u, bitcast<u32>(params.fine_dt));
  ws_store(34u, bitcast<u32>(params.cfl_factor));
  ws_store(35u, bitcast<u32>(params.max_correction_m_per_s));
  ws_store(36u, PHASE_BUILDING);
  ws_store(52u, params.completion_ordinal);
  ws_store(53u, params.parent_completion_ordinal);
  ws_store(54u, params.fine_completion_ordinal);
  ws_store(55u, params.coarse_completion_ordinal);
  ws_store(56u, 0u);
  ws_store(57u, FIELD_VELOCITY);
  ws_store(58u, 0u);
  ws_store(59u, 0u);
  ws_store(71u, INTERNAL_ENERGY_REFLUX_DEPOSIT);
  ws_store(72u, REFLUX_MEASURED_CONSERVATIVE);
  ws_store(73u, params.fine_impulse_offset);
  ws_store(74u, FINE_IMPULSE_WORDS);
  ws_store(75u, ROUTE_WORDS);
  ws_store(76u, params.fine_substep_ordinal);
  ws_store(77u, params.coarse_state_offset);
  ws_store(78u, params.route_proposal_offset);
  ws_store(79u, params.parent_to_coarse_offset);
  let parent_admission_mask = select(1u, 0u, parent_admitted());
  let coarse_field_admission_mask = coarse_admission_mask(
    FIELD_VELOCITY,
    params.coarse_predictor_mutation_ordinal
  );
  ws_store(60u, parent_admission_mask);
  ws_store(61u, 0u);
  ws_store(62u, coarse_field_admission_mask);
  if (
    params.reflux_reset != 0u
    || params.atomic_scale != ATOMIC_SCALE
    || params.workgroup_size != 64u
    || params.coarse_level != params.fine_level + 1
    || params.fine_substep_count == 0u
    || params.fine_substep_count > 4u
    || params.fine_substep_ordinal != params.fine_substep_count
    || params.required_words > arrayLength(&workspace)
    || !reflux_accumulating()
    || reflux_load(7u) != params.macro_owner_id
    || reflux_load(8u) != params.fine_substep_count
    || reflux_load(15u) != params.fine_substep_count
    || reflux_load(54u) != params.fine_substep_count
    || reflux_load(77u) != bitcast<u32>(params.fine_level)
    || reflux_load(78u) != bitcast<u32>(params.coarse_level)
    || reflux_load(79u) != bitcast<u32>(params.coarse_spacing_m)
    || reflux_load(82u) != params.macro_owner_id
    || reflux_load(83u) != params.macro_owner_generation
    || reflux_load(97u) != params.fine_substep_count
    || reflux_load(98u) != params.fine_substep_count + 1u
    || reflux_load(120u) != params.fine_substep_count
    || reflux_load(80u) != 0u
    || reflux_load(81u) != 0u
    || reflux_load(95u) != 0u
    || reflux_load(96u) != 0u
    || reflux_load(99u) != 0u
    || reflux_load(121u) != 0u
    || reflux_load(124u) != 0xffffffffu
    || reflux_load(125u) != 0u
    || reflux_load(126u) != 0u
    || reflux_load(127u) != 0u
    || parent_admission_mask != 0u
    || coarse_field_admission_mask != 0u
    || !coarse_receipt_admitted(
      FIELD_RECEIPT_HEAT_BUILDING,
      params.coarse_predictor_mutation_ordinal
    )
  ) {
    ws_store(2u, STATUS_FAIL_CLOSED | STATUS_INVALID_SOURCE);
    ws_store(37u, 1u);
    return;
  }
  ws_store(21u, parent_view[35u]);
  ws_store(22u, parent_view[36u]);
  ws_store(23u, parent_view[37u]);
  ws_store(24u, parent_view[38u]);
  if (ws_load(22u) == 0u
      || ws_load(22u) != coarse_load(34u)
      || ws_load(22u) != reflux_load(4u)) {
    ws_store(2u, STATUS_FAIL_CLOSED | STATUS_INVALID_REGISTRY);
    ws_store(87u, 1u);
    return;
  }
  ws_store(60u, parent_view[60u]);
  ws_store(61u, parent_view[61u]);
  ws_store(62u, parent_view[62u]);
  ws_store(63u, parent_view[64u]);
  ws_store(64u, parent_view[65u]);
  ws_store(65u, parent_view[66u]);
  ws_store(66u, parent_view[68u]);
  ws_store(67u, parent_view[69u]);
  ws_store(68u, parent_view[70u]);
  ws_store(2u, READY_ADMITTED);
}

@compute @workgroup_size(1)
fn register_reflux_coarse_registry() {
  if (!workspace_admitted(PHASE_BUILDING)) { return; }
  let coarse_count = ws_load(22u);
  let ledger_phase = reflux_load(59u);
  if (coarse_count == 0u || coarse_count > params.reflux_capacity
      || (ledger_phase != REFLUX_PHASE_ALLOCATED
          && ledger_phase != REFLUX_PHASE_ACCUMULATING)) {
    ws_reject(STATUS_INVALID_REGISTRY, 87u);
    reflux_reject(REFLUX_KEY_REJECTED | REFLUX_PHASE_REJECTED);
    return;
  }
  for (var parent = 0u; parent < ws_load(23u); parent = parent + 1u) {
    parent_to_coarse_store(parent, INVALID_INDEX);
  }
  let initialize = ledger_phase == REFLUX_PHASE_ALLOCATED;
  if (!initialize && reflux_load(4u) != coarse_count) {
    ws_reject(STATUS_INVALID_REGISTRY, 87u);
    reflux_reject(REFLUX_KEY_REJECTED);
    return;
  }
  for (var coarse_field = 0u; coarse_field < coarse_count; coarse_field = coarse_field + 1u) {
    let parent = parent_view[parent_view[54u] + coarse_field];
    if (parent >= ws_load(23u) || !coarse_parent_key_matches(coarse_field, parent)
        || parent_to_coarse_load(parent) != INVALID_INDEX) {
      ws_reject(STATUS_INVALID_REGISTRY, 87u);
      reflux_reject(REFLUX_KEY_REJECTED);
      return;
    }
    let row = reflux_row(coarse_field);
    for (var word = 0u; word < 4u; word = word + 1u) {
      let key_word = coarse_key(coarse_field, word);
      if (initialize) {
        reflux_store(row + word, key_word);
      } else if (reflux_load(row + word) != key_word) {
        atomicAdd(&reflux_ledger[13u], 1u);
        ws_reject(STATUS_INVALID_REGISTRY, 87u);
        reflux_reject(REFLUX_KEY_REJECTED);
        return;
      }
    }
    if (initialize) {
      for (var word = 4u; word < REFLUX_ROW_WORDS; word = word + 1u) {
        reflux_store(row + word, 0u);
      }
    }
    parent_to_coarse_store(parent, coarse_field);
  }
  if (initialize) {
    reflux_store(4u, coarse_count);
    reflux_store(59u, REFLUX_PHASE_ACCUMULATING);
    reflux_store(2u, REFLUX_READY_ADMITTED);
  }
  // A macro reuses the frozen keyed registry across private E_j generations.
  // Rotate only its generation provenance after every key has been verified;
  // a new generation id is not itself a registry mismatch.
  reflux_store(60u, params.generation_id);
}

@compute @workgroup_size(1)
fn register_coarse_terminal_registry() {
  if (!workspace_admitted(PHASE_BUILDING) || !reflux_accumulating()) {
    return;
  }
  let coarse_count = ws_load(22u);
  if (coarse_count == 0u || coarse_count > params.reflux_capacity
      || reflux_load(4u) != coarse_count) {
    ws_reject(STATUS_INVALID_REGISTRY, 87u);
    reflux_reject(REFLUX_KEY_REJECTED | REFLUX_PHASE_REJECTED);
    return;
  }
  for (var parent = 0u; parent < ws_load(23u); parent = parent + 1u) {
    parent_to_coarse_store(parent, INVALID_INDEX);
  }
  for (var coarse_field = 0u; coarse_field < coarse_count; coarse_field = coarse_field + 1u) {
    let parent = parent_view[parent_view[54u] + coarse_field];
    let row = reflux_row(coarse_field);
    if (parent >= ws_load(23u)
        || !coarse_parent_key_matches(coarse_field, parent)
        || parent_to_coarse_load(parent) != INVALID_INDEX
        || reflux_load(row + 14u) != 1u) {
      ws_reject(STATUS_INVALID_REGISTRY, 87u);
      reflux_reject(REFLUX_KEY_REJECTED);
      return;
    }
    for (var word = 0u; word < 4u; word = word + 1u) {
      if (reflux_load(row + word) != coarse_key(coarse_field, word)) {
        ws_reject(STATUS_INVALID_REGISTRY, 87u);
        reflux_reject(REFLUX_KEY_REJECTED);
        return;
      }
    }
    parent_to_coarse_store(parent, coarse_field);
  }
  reflux_store(60u, params.generation_id);
}

@compute @workgroup_size(1)
fn validate_reflux_coarse_registry_mass() {
  if (!workspace_admitted(PHASE_BUILDING) || !reflux_accumulating()) { return; }
  for (var coarse_field = 0u; coarse_field < ws_load(22u); coarse_field = coarse_field + 1u) {
    let parent = parent_view[parent_view[54u] + coarse_field];
    let state = params.coarse_state_offset + parent * ROW_WORDS;
    let mass = state_load(state, 0u);
    let row = reflux_row(coarse_field);
    if (!(mass > 0.0) || !finite_f32(mass)) {
      ws_reject(STATUS_INVALID_REGISTRY, 87u);
      reflux_reject(REFLUX_KEY_REJECTED);
      return;
    }
    if ((reflux_load(row + 14u) & 1u) == 0u) {
      reflux_store(row + 4u, bitcast<u32>(mass));
      reflux_store(row + 14u, 1u);
    } else {
      let frozen_mass = bitcast<f32>(reflux_load(row + 4u));
      let tolerance = 3.8146973e-6 * max(1.0, abs(frozen_mass));
      if (!finite_f32(frozen_mass) || abs(mass - frozen_mass) > tolerance) {
        ws_reject(STATUS_INVALID_REGISTRY, 87u);
        reflux_reject(REFLUX_KEY_REJECTED);
        return;
      }
    }
  }
}

@compute @workgroup_size(64)
fn restrict_fine_field_state(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let fine_field = indirect_row_index(id, workgroup_count);
  if (!workspace_admitted(PHASE_BUILDING) || fine_field >= ws_load(21u)) { return; }
  let edge_count = parent_view[parent_view[50u] + fine_field];
  let edge_begin = parent_view[parent_view[51u] + fine_field];
  if (edge_count == 0u || edge_count > 8u || edge_begin > ws_load(24u)
      || edge_count > ws_load(24u) - edge_begin) {
    ws_reject(STATUS_INVALID_CSR, 41u);
    return;
  }
  var weight_sum = 0.0;
  for (var local = 0u; local < edge_count; local = local + 1u) {
    let edge = edge_begin + local;
    let parent = parent_view[parent_view[52u] + edge];
    let weight = bitcast<f32>(parent_view[parent_view[53u] + edge]);
    if (parent >= ws_load(23u) || !finite_f32(weight) || !(weight > 0.0)
        || !fine_parent_key_matches(fine_field, parent)) {
      ws_reject(STATUS_INVALID_KEY | STATUS_INVALID_CSR, 40u);
      return;
    }
    weight_sum = weight_sum + weight;
  }
  if (!finite_f32(weight_sum) || abs(weight_sum - 1.0) > 3.8146973e-6) {
    ws_reject(STATUS_INVALID_CSR, 41u);
    return;
  }
  let source = fine_load(30u) + fine_field * ROW_WORDS;
  var source_values: array<f32, 7>;
  for (var word = 0u; word < 7u; word = word + 1u) {
    source_values[word] = bitcast<f32>(fine_load(source + word));
    if (!finite_f32(source_values[word])) {
      ws_reject(STATUS_NONFINITE, 39u);
      return;
    }
  }
  // Canonical mechanics-field state word 7 is the exact P2G contribution
  // count, not a boolean active flag.  Multi-particle fields therefore carry
  // values greater than one and are still valid massive sources.
  let source_contribution_count = fine_load(source + 7u);
  let source_massive = source_values[0] > 0.0;
  var inactive_nonzero = false;
  if (!source_massive) {
    for (var word = 0u; word < 7u; word = word + 1u) {
      inactive_nonzero = inactive_nonzero || source_values[word] != 0.0;
    }
  }
  if (source_values[0] < 0.0
      || source_contribution_count == 0xffffffffu
      || (source_contribution_count > 0u) != source_massive
      || inactive_nonzero) {
    ws_reject(STATUS_INVALID_SOURCE, 37u);
    return;
  }
  for (var local = 0u; local < edge_count; local = local + 1u) {
    let edge = edge_begin + local;
    let parent = parent_view[parent_view[52u] + edge];
    let weight = bitcast<f32>(parent_view[parent_view[53u] + edge]);
    let destination = params.accumulator_offset + parent * ROW_WORDS;
    var valid = true;
    for (var word = 0u; word < 7u; word = word + 1u) {
      valid = add_fixed(destination + word, weight * source_values[word]) && valid;
    }
    atomicAdd(&workspace[destination + 7u], 1u);
    if (!valid) { ws_reject(STATUS_OVERFLOW, 38u); }
    atomicAdd(&workspace[42u], 1u);
  }
}

@compute @workgroup_size(64)
fn finalize_fine_parent_baseline(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let parent = indirect_row_index(id, workgroup_count);
  if (!workspace_admitted(PHASE_BUILDING) || parent >= ws_load(23u)) { return; }
  let accumulator = params.accumulator_offset + parent * ROW_WORDS;
  let baseline = params.baseline_offset + parent * ROW_WORDS;
  let combined = params.combined_offset + parent * ROW_WORDS;
  let coarse_state = params.coarse_state_offset + parent * ROW_WORDS;
  for (var word = 0u; word < 7u; word = word + 1u) {
    let value = fixed_value(accumulator + word);
    state_store(baseline, word, value);
    state_store(combined, word, value);
    state_store(coarse_state, word, 0.0);
  }
  let active_flag = select(0u, 1u, state_load(baseline, 0u) > 0.0);
  ws_store(baseline + 7u, active_flag);
  ws_store(combined + 7u, active_flag);
  ws_store(coarse_state + 7u, 0u);
  // Restriction has fully materialized the floating baseline. Recycle the
  // fixed-point bank in the next ordered pass for the authenticated immediate
  // successor coarse predictor; no additional workspace storage is needed.
  for (var word = 0u; word < ROW_WORDS; word = word + 1u) {
    ws_store(accumulator + word, 0u);
  }
  if (active_flag != 0u) {
    atomicAdd(&workspace[44u], 1u);
    atomicAdd(&workspace[45u], 1u);
  }
}

@compute @workgroup_size(64)
fn inject_coarse_native_state(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let coarse_field = indirect_row_index(id, workgroup_count);
  if (!workspace_admitted(PHASE_BUILDING) || coarse_field >= ws_load(22u)) { return; }
  let parent = parent_view[parent_view[54u] + coarse_field];
  if (parent >= ws_load(23u) || !coarse_parent_key_matches(coarse_field, parent)) {
    ws_reject(STATUS_INVALID_KEY, 40u);
    return;
  }
  let source = coarse_load(30u) + coarse_field * ROW_WORDS;
  let combined = params.combined_offset + parent * ROW_WORDS;
  let coarse_state = params.coarse_state_offset + parent * ROW_WORDS;
  let temporal_state = params.accumulator_offset + parent * ROW_WORDS;
  let temporal_source = coarse_load(28u)
    + coarse_field * FIELD_ACCUMULATOR_WORDS;
  let combined_was_active = ws_load(combined + 7u) != 0u;
  var source_values: array<f32, 7>;
  for (var word = 0u; word < 7u; word = word + 1u) {
    source_values[word] = bitcast<f32>(coarse_load(source + word));
    if (!finite_f32(source_values[word])) {
      ws_reject(STATUS_NONFINITE, 39u);
      return;
    }
  }
  let source_contribution_count = coarse_load(source + 7u);
  let source_massive = source_values[0] > 0.0;
  var inactive_nonzero = false;
  if (!source_massive) {
    for (var word = 0u; word < 7u; word = word + 1u) {
      inactive_nonzero = inactive_nonzero || source_values[word] != 0.0;
    }
  }
  if (source_values[0] < 0.0
      || source_contribution_count == 0xffffffffu
      || (source_contribution_count > 0u) != source_massive
      || inactive_nonzero) {
    ws_reject(STATUS_INVALID_SOURCE, 37u);
    return;
  }
  var temporal_momentum = vec3<f32>(0.0);
  for (var word = 0u; word < ROW_WORDS; word = word + 1u) {
    if (ws_load(temporal_state + word) != 0u) {
      ws_reject(STATUS_INVALID_SOURCE, 37u);
      return;
    }
  }
  if (params.temporal_coarse_enabled != 0u) {
    temporal_momentum = vec3<f32>(
      bitcast<f32>(coarse_load(temporal_source)),
      bitcast<f32>(coarse_load(temporal_source + 1u)),
      bitcast<f32>(coarse_load(temporal_source + 2u))
    );
    if (!all(vec3<bool>(
        finite_f32(temporal_momentum.x),
        finite_f32(temporal_momentum.y),
        finite_f32(temporal_momentum.z)
      ))) {
      ws_reject(STATUS_NONFINITE | STATUS_INVALID_SOURCE, 39u);
      return;
    }
    for (var word = 3u; word < FIELD_ACCUMULATOR_WORDS; word = word + 1u) {
      if (coarse_load(temporal_source + word) != 0u) {
        ws_reject(STATUS_INVALID_SOURCE, 37u);
        return;
      }
    }
  } else {
    for (var word = 0u; word < FIELD_ACCUMULATOR_WORDS; word = word + 1u) {
      if (coarse_load(temporal_source + word) != 0u) {
        ws_reject(STATUS_INVALID_SOURCE, 37u);
        return;
      }
    }
  }
  for (var word = 0u; word < 7u; word = word + 1u) {
    let prior = state_load(combined, word);
    if (!finite_f32(prior + source_values[word])) {
      ws_reject(STATUS_NONFINITE, 39u);
      return;
    }
  }
  for (var word = 0u; word < 7u; word = word + 1u) {
    let prior = state_load(combined, word);
    state_store(combined, word, prior + source_values[word]);
    state_store(coarse_state, word, source_values[word]);
  }
  ws_store(combined + 7u, select(0u, 1u, state_load(combined, 0u) > 0.0));
  ws_store(
    coarse_state + 7u,
    select(0u, 1u, source_contribution_count > 0u)
  );
  if (params.temporal_coarse_enabled != 0u) {
    state_store(temporal_state, 0u, source_values[0]);
    state_store(temporal_state, 1u, temporal_momentum.x);
    state_store(temporal_state, 2u, temporal_momentum.y);
    state_store(temporal_state, 3u, temporal_momentum.z);
    state_store(temporal_state, 4u, source_values[4]);
    state_store(temporal_state, 5u, source_values[5]);
    state_store(temporal_state, 6u, source_values[6]);
    ws_store(
      temporal_state + 7u,
      select(0u, 1u, source_contribution_count > 0u)
    );
  }
  if (!combined_was_active && ws_load(combined + 7u) != 0u) {
    atomicAdd(&workspace[45u], 1u);
  }
  atomicAdd(&workspace[43u], 1u);
}

fn parent_node_position(parent: u32) -> vec3<f32> {
  let dense = parent_key(parent, 0u);
  let plane = params.coarse_ny * params.coarse_nz;
  let x = dense / plane;
  let remainder = dense - x * plane;
  let y = remainder / params.coarse_nz;
  let z = remainder - y * params.coarse_nz;
  return vec3<f32>(
    f32(i32(x) - params.coarse_shift),
    f32(i32(y) - params.coarse_shift),
    f32(i32(z) - params.coarse_shift)
  ) * params.coarse_spacing_m;
}

fn fine_node_position(fine_field: u32) -> vec3<f32> {
  let dense = fine_key(fine_field, 0u);
  let ny = fine_load(20u);
  let nz = fine_load(21u);
  let plane = ny * nz;
  let x = dense / plane;
  let remainder = dense - x * plane;
  let y = remainder / nz;
  let z = remainder - y * nz;
  let shift = bitcast<i32>(fine_load(22u));
  let spacing = bitcast<f32>(fine_load(23u));
  return vec3<f32>(
    f32(i32(x) - shift), f32(i32(y) - shift), f32(i32(z) - shift)
  ) * spacing;
}

fn wall_alpha(mass: f32, gap: f32, predictor_dt: f32) -> f32 {
  let min_gap = max(1.0e-12, abs(params.wall_barrier_min_gap_m));
  let effective_gap = max(max(gap, 0.0), min_gap);
  let barrier_stiffness = select(
    0.0,
    mass / (effective_gap * effective_gap),
    mass > 0.0
  );
  let normal_stiffness = max(
    0.0,
    barrier_stiffness + max(params.wall_barrier_elastic_stiffness_n_per_m, 0.0)
  );
  let ratio = select(
    0.0,
    normal_stiffness * predictor_dt * predictor_dt / mass,
    mass > 0.0 && predictor_dt > 0.0
  );
  return clamp(
    (ratio / (1.0 + ratio)) * clamp(params.wall_barrier_contact_scale, 0.0, 1.0),
    0.0,
    1.0
  );
}

fn wall_correct(
  value: f32,
  mass: f32,
  gap: f32,
  predictor_dt: f32
) -> f32 {
  let alpha = wall_alpha(mass, gap, predictor_dt);
  var corrected = value + max(0.0, -value) * alpha;
  if (alpha >= 1.0 - 1.0e-6 && corrected < 1.0e-6 && value < 0.0) {
    corrected = 0.0;
  }
  return corrected;
}

fn update_predictor_state(base: u32, node: vec3<f32>, predictor_dt: f32) {
  let mass = state_load(base, 0u);
  if (!(mass > 0.0)) {
    state_store(base, 1u, 0.0);
    state_store(base, 2u, 0.0);
    state_store(base, 3u, 0.0);
    ws_store(base + 7u, 0u);
    return;
  }
  var velocity = vec3<f32>(
    state_load(base, 1u), state_load(base, 2u), state_load(base, 3u)
  ) / mass + vec3<f32>(params.gravity_x, params.gravity_y, params.gravity_z)
    * predictor_dt;
  // This is the macro-endpoint predictor consumed by routed coarse
  // validation.  Gravity still advances over this predictor's local dt,
  // but its admissible velocity has to use the macro horizon.  Clamping with
  // a fine substep dt admits speeds up to r times the endpoint CFL limit; a
  // later zero-route validator then truthfully rejects the untouched prior
  // and rolls the whole canonical transaction back.
  let vmax = params.cfl_factor * params.coarse_spacing_m
    / max(params.macro_dt, 1.0e-12);
  let speed2 = dot(velocity, velocity);
  if (speed2 > vmax * vmax) { velocity = velocity * (vmax / sqrt(speed2)); }
  let epsilon = max(1.0e-7, abs(params.coarse_spacing_m) * 1.0e-6);
  if (node.x <= params.coarse_spacing_m + epsilon) {
    velocity.x = wall_correct(
      velocity.x,
      mass,
      node.x - params.coarse_spacing_m + epsilon,
      predictor_dt
    );
  }
  if (node.x >= params.box_x - params.coarse_spacing_m - epsilon) {
    velocity.x = -wall_correct(
      -velocity.x,
      mass,
      params.box_x - params.coarse_spacing_m - node.x + epsilon,
      predictor_dt
    );
  }
  if (node.y < params.coarse_spacing_m - epsilon) {
    velocity.y = wall_correct(velocity.y, mass, node.y, predictor_dt);
  }
  if (node.y >= params.box_y - params.coarse_spacing_m - epsilon) {
    velocity.y = -wall_correct(
      -velocity.y,
      mass,
      params.box_y - params.coarse_spacing_m - node.y + epsilon,
      predictor_dt
    );
  }
  if (node.z <= params.coarse_spacing_m + epsilon) {
    velocity.z = wall_correct(
      velocity.z,
      mass,
      node.z - params.coarse_spacing_m + epsilon,
      predictor_dt
    );
  }
  if (node.z >= params.box_z - params.coarse_spacing_m - epsilon) {
    velocity.z = -wall_correct(
      -velocity.z,
      mass,
      params.box_z - params.coarse_spacing_m - node.z + epsilon,
      predictor_dt
    );
  }
  state_store(base, 1u, velocity.x);
  state_store(base, 2u, velocity.y);
  state_store(base, 3u, velocity.z);
  ws_store(base + 7u, 1u);
}

@compute @workgroup_size(64)
fn update_parent_field_predictors(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let parent = indirect_row_index(id, workgroup_count);
  if (!workspace_admitted(PHASE_BUILDING) || parent >= ws_load(23u)) { return; }
  let node = parent_node_position(parent);
  update_predictor_state(
    params.baseline_offset + parent * ROW_WORDS,
    node,
    params.dt
  );
  update_predictor_state(
    params.combined_offset + parent * ROW_WORDS,
    node,
    params.dt
  );
  update_predictor_state(
    params.coarse_state_offset + parent * ROW_WORDS,
    node,
    params.dt
  );
  if (params.temporal_coarse_enabled != 0u) {
    update_predictor_state(
      params.accumulator_offset + parent * ROW_WORDS,
      node,
      params.temporal_coarse_successor_dt
    );
  }
}

fn velocity(base: u32) -> vec3<f32> {
  return vec3<f32>(state_load(base, 1u), state_load(base, 2u), state_load(base, 3u));
}
fn set_velocity(base: u32, value: vec3<f32>) {
  state_store(base, 1u, value.x);
  state_store(base, 2u, value.y);
  state_store(base, 3u, value.z);
}

fn contact_pair(bank: u32, left: u32, right: u32, publish_energy: bool) {
  let left_state = bank + left * ROW_WORDS;
  let right_state = bank + right * ROW_WORDS;
  let left_mass = state_load(left_state, 0u);
  let right_mass = state_load(right_state, 0u);
  if (!(left_mass > 0.0) || !(right_mass > 0.0)
      || ws_load(left_state + 7u) == 0u || ws_load(right_state + 7u) == 0u) { return; }
  let left_gradient = vec3<f32>(
    state_load(left_state, 4u), state_load(left_state, 5u), state_load(left_state, 6u)
  ) / left_mass;
  let right_gradient = vec3<f32>(
    state_load(right_state, 4u), state_load(right_state, 5u), state_load(right_state, 6u)
  ) / right_mass;
  let normal_raw = left_gradient - right_gradient;
  let length2 = dot(normal_raw, normal_raw);
  if (length2 <= 1.0e-12) { return; }
  let normal = normal_raw / sqrt(length2);
  var left_velocity = velocity(left_state);
  var right_velocity = velocity(right_state);
  let closing = dot(right_velocity - left_velocity, normal);
  if (closing >= 0.0) { return; }
  let inv_left = 1.0 / left_mass;
  let inv_right = 1.0 / right_mass;
  let impulse = -closing / (inv_left + inv_right);
  let before_energy = 0.5 * left_mass * dot(left_velocity, left_velocity)
    + 0.5 * right_mass * dot(right_velocity, right_velocity);
  left_velocity = left_velocity - impulse * inv_left * normal;
  right_velocity = right_velocity + impulse * inv_right * normal;
  let after_energy = 0.5 * left_mass * dot(left_velocity, left_velocity)
    + 0.5 * right_mass * dot(right_velocity, right_velocity);
  set_velocity(left_state, left_velocity);
  set_velocity(right_state, right_velocity);
  if (publish_energy) {
    let energy_delta = min(0.0, after_energy - before_energy);
    // Predictor workspaces are disposable proposals. Contact loss remains
    // workspace-local and is transferred to the macro ledger only by the
    // one final coarse terminal, never by fine-substep predictors.
    if (!ws_atomic_add_f32(84u, energy_delta)) {
      reflux_reject(REFLUX_NONFINITE);
    }
  }
}

@compute @workgroup_size(64)
fn contact_parent_field_predictors(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let first = indirect_row_index(id, workgroup_count);
  if (!workspace_admitted(PHASE_BUILDING) || first >= ws_load(23u)) { return; }
  let dense = parent_key(first, 0u);
  if (first > 0u && parent_key(first - 1u, 0u) == dense) { return; }
  var end = first + 1u;
  loop {
    if (end >= ws_load(23u) || parent_key(end, 0u) != dense) { break; }
    end = end + 1u;
  }
  for (var left = first; left < end; left = left + 1u) {
    for (var right = left + 1u; right < end; right = right + 1u) {
      contact_pair(params.baseline_offset, left, right, false);
      contact_pair(params.combined_offset, left, right, false);
      contact_pair(params.coarse_state_offset, left, right, true);
      if (params.temporal_coarse_enabled != 0u) {
        contact_pair(params.accumulator_offset, left, right, false);
      }
    }
  }
}

@compute @workgroup_size(1)
fn seal_parent_field_predictors() {
  if (!workspace_admitted(PHASE_BUILDING)) { return; }
  if (!temporal_coarse_receipts_admitted()) {
    ws_reject(STATUS_INVALID_SOURCE, 37u);
    return;
  }
  // Fine-substep predictor contact loss is disposable. Reuse this slot below
  // for the phase/causal cross coefficient after every predictor contact
  // invocation has completed.
  ws_store(84u, bitcast<u32>(0.0));
  ws_store(36u, PHASE_PREDICTORS);
  ws_store(70u, params.completion_ordinal);
}

// Terminal execution has no live fine field binding. This phase transition is
// deliberately coarse-only so a terminal bind-group layout can omit binding 1.
@compute @workgroup_size(1)
fn seal_coarse_terminal_workspace() {
  if (!workspace_admitted(PHASE_BUILDING) || !reflux_accumulating()
      || !coarse_admitted(
        FIELD_VELOCITY, params.coarse_publish_expected_mutation_ordinal
      ) || !coarse_receipt_admitted(
        FIELD_RECEIPT_HEAT_BUILDING,
        params.coarse_publish_expected_mutation_ordinal
      )) { return; }
  ws_store(36u, PHASE_PREDICTORS);
  ws_store(70u, params.completion_ordinal);
}

struct CrossLevelPhaseMechanics {
  rest_density: f32,
  sound_speed: f32,
  dynamic_viscosity: f32,
  valid: u32,
};

struct CrossLevelPhaseRouteEvaluation {
  status: u32,
  fine_pressure_impulse: vec3<f32>,
  fine_drag_impulse: vec3<f32>,
  pressure_compensation_j: f32,
  drag_heat_j: f32,
};

fn invalid_cross_level_phase_route() -> CrossLevelPhaseRouteEvaluation {
  return CrossLevelPhaseRouteEvaluation(
    2u,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0
  );
}

fn phase_transport_reject(flags: u32) {
  reject_pressure_authority();
  ws_reject(STATUS_INVALID_ROUTE | STATUS_INVALID_SOURCE, 86u);
  reflux_reject(REFLUX_ROUTE_REJECTED | flags);
}

fn phase_proposal_seal() -> u32 {
  return PHASE_PROPOSAL_MAGIC
    ^ phase_proposal_control[3u]
    ^ phase_proposal_control[27u]
    ^ phase_proposal_control[28u]
    ^ phase_proposal_control[29u]
    ^ phase_proposal_control[23u]
    ^ phase_proposal_control[24u]
    ^ phase_proposal_control[17u]
    ^ phase_proposal_control[19u]
    ^ phase_proposal_control[25u]
    ^ phase_proposal_control[26u]
    ^ phase_proposal_control[2u];
}

fn phase_proposal_admitted() -> bool {
  if (arrayLength(&phase_proposal_control) < PHASE_PROPOSAL_HEADER_WORDS) {
    return false;
  }
  return phase_proposal_control[0u] == PHASE_PROPOSAL_MAGIC
    && phase_proposal_control[1u] == PHASE_PROPOSAL_VERSION
    && phase_proposal_control[2u] == PHASE_PROPOSAL_READY_ADMITTED
    && phase_proposal_control[3u] == params.generation_id
    && phase_proposal_control[4u] == params.device_ordinal
    && phase_proposal_control[5u] == params.lane_ordinal
    && phase_proposal_control[6u] == params.lease_token
    && phase_proposal_control[7u] == params.source_family_id
    && phase_proposal_control[8u] == params.storage_generation
    && phase_proposal_control[9u] == params.physics_tick
    && phase_proposal_control[10u] == params.physics_substep
    && phase_proposal_control[11u] == params.position_epoch
    && phase_proposal_control[12u] == params.topology_epoch
    && phase_proposal_control[13u] == params.chart_epoch
    && phase_proposal_control[14u] == params.level_epoch
    && phase_proposal_control[15u] == params.support_epoch
    && phase_proposal_control[16u] == parent_view[35u]
    && phase_proposal_control[17u] == params.fine_capacity
    && phase_proposal_control[18u] == parent_view[36u]
    && phase_proposal_control[19u] == params.coarse_capacity
    && phase_proposal_control[22u] == parent_view[35u]
    && phase_proposal_control[23u] == bitcast<u32>(params.fine_level)
    && phase_proposal_control[24u] == bitcast<u32>(params.coarse_level)
    && phase_proposal_control[25u] == 1u
    && phase_proposal_control[26u] == 1u
    && phase_proposal_control[29u] == params.parent_completion_ordinal
    && phase_proposal_control[33u] == params.phase_route_capacity
    && phase_proposal_control[35u] == PHASE_ROUTE_WORDS
    && phase_proposal_control[37u] == PHASE_MOMENT_ROW_WORDS
    && phase_proposal_control[39u]
      == parent_view[35u] + parent_view[36u]
    && phase_proposal_control[40u] == 0u
    && phase_proposal_control[41u] == 0u
    && phase_proposal_control[42u] == 0u
    && phase_proposal_control[43u] == 0u
    && phase_proposal_control[44u] == 0u
    && phase_proposal_control[45u] == 0u
    && phase_proposal_control[46u] == 0u
    && phase_proposal_control[47u] == 1u
    && phase_proposal_control[48u] == 0u
    && phase_proposal_control[49u] == phase_proposal_seal()
    && phase_proposal_control[51u] == PHASE_ROUTE_POLICY
    && params.phase_route_words == PHASE_ROUTE_WORDS
    && params.phase_route_capacity >= parent_view[35u]
    && params.phase_record_count > 0u
    && params.fine_dt > 0.0
    && finite_f32(params.fine_dt)
    && params.coarse_spacing_m > 0.0
    && finite_f32(params.coarse_spacing_m)
    && finite_f32(params.ambient_pressure_pa)
    && params.ambient_pressure_pa >= 0.0
    && finite_f32(params.pressure_scale)
    && params.pressure_scale >= 0.0
    && finite_f32(params.drag_scale)
    && params.drag_scale >= 0.0
    && finite_f32(params.max_impulse_fraction)
    && params.max_impulse_fraction >= 0.0;
}

fn fine_phase_moment_valid(fine_field: u32) -> bool {
  let row = fine_field * PHASE_MOMENT_ROW_WORDS;
  let key = fine_load(26u) + fine_field * FIELD_KEY_WORDS;
  if (row + PHASE_MOMENT_ROW_WORDS > arrayLength(&fine_phase_moments)) {
    return false;
  }
  let volume = bitcast<f32>(fine_phase_moments[row + 4u]);
  return fine_phase_moments[row] == fine_load(key)
    && fine_phase_moments[row + 1u] == fine_load(key + 1u)
    && fine_phase_moments[row + 2u] == fine_load(key + 2u)
    && fine_phase_moments[row + 3u] == fine_load(key + 3u)
    && volume > 0.0
    && finite_f32(volume)
    && finite_f32(bitcast<f32>(fine_phase_moments[row + 5u]))
    && finite_f32(bitcast<f32>(fine_phase_moments[row + 6u]))
    && finite_f32(bitcast<f32>(fine_phase_moments[row + 7u]))
    && fine_phase_moments[row + 8u] > 0u
    && fine_phase_moments[row + 9u] == PHASE_MOMENT_READY_ADMITTED;
}

fn coarse_phase_moment_valid(
  coarse_field: u32,
  parent: u32
) -> bool {
  let row = coarse_field * PHASE_MOMENT_ROW_WORDS;
  if (row + PHASE_MOMENT_ROW_WORDS > arrayLength(&coarse_phase_moments)
      || parent >= ws_load(23u)) {
    return false;
  }
  let volume = bitcast<f32>(coarse_phase_moments[row + 4u]);
  return coarse_phase_moments[row] == parent_key(parent, 0u)
    && coarse_phase_moments[row + 1u] == parent_key(parent, 1u)
    && coarse_phase_moments[row + 2u] == parent_key(parent, 2u)
    && coarse_phase_moments[row + 3u] == parent_key(parent, 3u)
    && volume > 0.0
    && finite_f32(volume)
    && finite_f32(bitcast<f32>(coarse_phase_moments[row + 5u]))
    && finite_f32(bitcast<f32>(coarse_phase_moments[row + 6u]))
    && finite_f32(bitcast<f32>(coarse_phase_moments[row + 7u]))
    && coarse_phase_moments[row + 8u] > 0u
    && coarse_phase_moments[row + 9u] == PHASE_MOMENT_READY_ADMITTED;
}

fn fine_pressure_row_valid(fine_field: u32) -> bool {
  let pressure_row =
    fine_pressure_offset() + fine_field * FIELD_PRESSURE_WORDS;
  let moment_row = fine_field * PHASE_MOMENT_ROW_WORDS;
  if (fine_field >= fine_load(34u)
      || pressure_row < fine_pressure_offset()
      || pressure_row + FIELD_PRESSURE_WORDS > arrayLength(&fine_view)
      || !fine_phase_moment_valid(fine_field)) {
    return false;
  }
  let pressure_volume_moment = bitcast<f32>(fine_load(pressure_row));
  let represented_volume = bitcast<f32>(fine_load(pressure_row + 1u));
  let absolute_pressure = bitcast<f32>(fine_load(pressure_row + 2u));
  let contribution_count = fine_load(pressure_row + 3u);
  let moment_volume = bitcast<f32>(fine_phase_moments[moment_row + 4u]);
  return represented_volume > 0.0
    && absolute_pressure >= 0.0
    && contribution_count > 0u
    && contribution_count == fine_phase_moments[moment_row + 8u]
    && finite_f32(pressure_volume_moment)
    && finite_f32(represented_volume)
    && finite_f32(absolute_pressure)
    && measured_close(
      represented_volume,
      moment_volume,
      max(2u, contribution_count)
    )
    && measured_close(
      pressure_volume_moment,
      represented_volume * absolute_pressure,
      max(2u, contribution_count)
    );
}

fn coarse_pressure_row_valid(
  coarse_field: u32,
  parent: u32
) -> bool {
  let pressure_row =
    coarse_pressure_offset() + coarse_field * FIELD_PRESSURE_WORDS;
  let moment_row = coarse_field * PHASE_MOMENT_ROW_WORDS;
  if (coarse_field >= coarse_load(34u)
      || pressure_row < coarse_pressure_offset()
      || pressure_row + FIELD_PRESSURE_WORDS > arrayLength(&coarse_view)
      || !coarse_phase_moment_valid(coarse_field, parent)) {
    return false;
  }
  let pressure_volume_moment = bitcast<f32>(coarse_load(pressure_row));
  let represented_volume = bitcast<f32>(coarse_load(pressure_row + 1u));
  let absolute_pressure = bitcast<f32>(coarse_load(pressure_row + 2u));
  let contribution_count = coarse_load(pressure_row + 3u);
  let moment_volume =
    bitcast<f32>(coarse_phase_moments[moment_row + 4u]);
  return represented_volume > 0.0
    && absolute_pressure >= 0.0
    && contribution_count > 0u
    && contribution_count == coarse_phase_moments[moment_row + 8u]
    && finite_f32(pressure_volume_moment)
    && finite_f32(represented_volume)
    && finite_f32(absolute_pressure)
    && measured_close(
      represented_volume,
      moment_volume,
      max(2u, contribution_count)
    )
    && measured_close(
      pressure_volume_moment,
      represented_volume * absolute_pressure,
      max(2u, contribution_count)
    );
}

fn fine_absolute_pressure(fine_field: u32) -> f32 {
  return bitcast<f32>(
    fine_load(
      fine_pressure_offset() + fine_field * FIELD_PRESSURE_WORDS + 2u
    )
  );
}

fn coarse_absolute_pressure(coarse_field: u32) -> f32 {
  return bitcast<f32>(
    coarse_load(
      coarse_pressure_offset() + coarse_field * FIELD_PRESSURE_WORDS + 2u
    )
  );
}

fn phase_route_admitted(fine_field: u32) -> bool {
  let row = fine_field * PHASE_ROUTE_WORDS;
  if (row + PHASE_ROUTE_WORDS > arrayLength(&phase_reflux_routes)
      || fine_field >= parent_view[35u]) {
    return false;
  }
  let edge_begin = parent_view[parent_view[51u] + fine_field];
  let edge_end = parent_view[parent_view[51u] + fine_field + 1u];
  return phase_reflux_routes[row] == fine_field
    && phase_reflux_routes[row + 1u] == edge_begin
    && phase_reflux_routes[row + 2u] == edge_end
    && phase_reflux_routes[row + 3u] == bitcast<u32>(params.fine_level)
    && phase_reflux_routes[row + 4u] == bitcast<u32>(params.coarse_level)
    && phase_reflux_routes[row + 5u] == params.parent_completion_ordinal
    && phase_reflux_routes[row + 6u] == PHASE_ROUTE_READY_ADMITTED
    && phase_reflux_routes[row + 7u] == PHASE_ROUTE_POLICY
    && edge_end > edge_begin
    && edge_end <= ws_load(24u)
    && edge_end - edge_begin
      == parent_view[parent_view[50u] + fine_field];
}

fn phase_mechanics(
  material_id: u32,
  phase_id: u32
) -> CrossLevelPhaseMechanics {
  for (
    var record = 0u;
    record < params.phase_record_count;
    record = record + 1u
  ) {
    let row0 = material_phase_records[record * 3u];
    if (row0.x == f32(material_id) && row0.y == f32(phase_id)) {
      let row1 = material_phase_records[record * 3u + 1u];
      let row2 = material_phase_records[record * 3u + 2u];
      let valid = select(
        0u,
        1u,
        row2.y == 1.0
          && row0.z > 0.0
          && row1.z >= 0.0
          && row2.z >= 0.0
          && finite_f32(row0.z)
          && finite_f32(row1.z)
          && finite_f32(row2.z)
      );
      return CrossLevelPhaseMechanics(row0.z, row1.z, row2.z, valid);
    }
  }
  return CrossLevelPhaseMechanics(0.0, 0.0, 0.0, 0u);
}

fn fine_phase_volume(fine_field: u32) -> f32 {
  return bitcast<f32>(
    fine_phase_moments[
      fine_field * PHASE_MOMENT_ROW_WORDS + 4u
    ]
  );
}

fn fine_phase_gradient(fine_field: u32) -> vec3<f32> {
  let row = fine_field * PHASE_MOMENT_ROW_WORDS;
  return vec3<f32>(
    bitcast<f32>(fine_phase_moments[row + 5u]),
    bitcast<f32>(fine_phase_moments[row + 6u]),
    bitcast<f32>(fine_phase_moments[row + 7u])
  );
}

fn evaluate_cross_level_phase_route(
  fine_field: u32,
  candidate_cohort: vec3<u32>
) -> CrossLevelPhaseRouteEvaluation {
  let none = CrossLevelPhaseRouteEvaluation(
    0u,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0
  );
  if (!fine_pressure_receipt_admitted(true, true)
      || !coarse_pressure_receipt_admitted(true)
      || !fine_pressure_row_valid(fine_field)) {
    return invalid_cross_level_phase_route();
  }
  let fine_state = fine_load(30u) + fine_field * FIELD_STATE_WORDS;
  let fine_mass = bitcast<f32>(fine_load(fine_state));
  let fine_velocity = vec3<f32>(
    bitcast<f32>(fine_load(fine_state + 1u)),
    bitcast<f32>(fine_load(fine_state + 2u)),
    bitcast<f32>(fine_load(fine_state + 3u))
  );
  let fine_phase = fine_key(fine_field, 1u);
  let fine_material = fine_key(fine_field, 2u);
  let coarse_phase = candidate_cohort.x;
  let coarse_material = candidate_cohort.y;
  let fine_noncondensed = fine_phase >= PHASE_GAS;
  let coarse_noncondensed = coarse_phase >= PHASE_GAS;
  if (fine_noncondensed == coarse_noncondensed) { return none; }
  let fine_mechanics = phase_mechanics(fine_material, fine_phase);
  let coarse_mechanics = phase_mechanics(coarse_material, coarse_phase);
  if (!(fine_mass > 0.0)
      || !finite_f32(fine_mass)
      || !all(vec3<bool>(
        finite_f32(fine_velocity.x),
        finite_f32(fine_velocity.y),
        finite_f32(fine_velocity.z)
      ))
      || fine_mechanics.valid != 1u
      || coarse_mechanics.valid != 1u) {
    return invalid_cross_level_phase_route();
  }

  let route_row = fine_field * PHASE_ROUTE_WORDS;
  let edge_begin = phase_reflux_routes[route_row + 1u];
  let edge_end = phase_reflux_routes[route_row + 2u];
  var coarse_mass = 0.0;
  var coarse_inverse_mass = 0.0;
  var coarse_volume = 0.0;
  var coarse_pressure_volume_moment = 0.0;
  var coarse_gradient = vec3<f32>(0.0);
  var coarse_velocity = vec3<f32>(0.0);
  for (var edge = edge_begin; edge < edge_end; edge = edge + 1u) {
    let fine_parent = parent_view[parent_view[52u] + edge];
    let weight = bitcast<f32>(parent_view[parent_view[53u] + edge]);
    let recipient = find_parent_key(vec4<u32>(
      parent_key(fine_parent, 0u),
      candidate_cohort
    ));
    if (!(weight > 0.0) || !finite_f32(weight)) {
      return invalid_cross_level_phase_route();
    }
    // A cohort observed at one parent node is only a cross-level route when
    // it has complete affine support at every parent of this fine field.
    // Sparse absence is not corrupt topology: applying a partially supported
    // impulse would break the first-moment/angular invariant, so conservatively
    // omit that interaction while allowing the rest of the macro transaction.
    if (recipient == INVALID_INDEX) { return none; }
    let coarse_ordinal = parent_to_coarse_load(recipient);
    if (coarse_ordinal == INVALID_INDEX) { return none; }
    if (coarse_ordinal >= ws_load(22u)
        || !coarse_phase_moment_valid(coarse_ordinal, recipient)
        || !coarse_pressure_row_valid(coarse_ordinal, recipient)) {
      return invalid_cross_level_phase_route();
    }
    let coarse_state = params.coarse_state_offset + recipient * ROW_WORDS;
    let mass = state_load(coarse_state, 0u);
    let moment = coarse_ordinal * PHASE_MOMENT_ROW_WORDS;
    let volume = bitcast<f32>(coarse_phase_moments[moment + 4u]);
    let gradient = vec3<f32>(
      bitcast<f32>(coarse_phase_moments[moment + 5u]),
      bitcast<f32>(coarse_phase_moments[moment + 6u]),
      bitcast<f32>(coarse_phase_moments[moment + 7u])
    );
    let ledger_row = reflux_row(coarse_ordinal);
    let prior_reflux = vec3<f32>(
      bitcast<f32>(reflux_load(ledger_row + 5u)),
      bitcast<f32>(reflux_load(ledger_row + 6u)),
      bitcast<f32>(reflux_load(ledger_row + 7u))
    );
    if (!(mass > 0.0)
        || !finite_f32(mass)
        || !(volume > 0.0)
        || !finite_f32(volume)
        || !all(vec3<bool>(
          finite_f32(gradient.x),
          finite_f32(gradient.y),
          finite_f32(gradient.z)
        ))) {
      return invalid_cross_level_phase_route();
    }
    coarse_mass = coarse_mass + weight * mass;
    coarse_inverse_mass =
      coarse_inverse_mass + weight * weight / mass;
    coarse_volume = coarse_volume + weight * volume;
    coarse_pressure_volume_moment =
      coarse_pressure_volume_moment
        + weight * volume * coarse_absolute_pressure(coarse_ordinal);
    coarse_gradient = coarse_gradient + weight * gradient;
    coarse_velocity = coarse_velocity + weight * (
      velocity(coarse_state) + prior_reflux / mass
    );
  }
  if (!(coarse_mass > 0.0)
      || !(coarse_inverse_mass > 0.0)
      || !(coarse_volume > 0.0)
      || !(coarse_pressure_volume_moment >= 0.0)
      || !finite_f32(coarse_mass)
      || !finite_f32(coarse_inverse_mass)
      || !finite_f32(coarse_volume)
      || !finite_f32(coarse_pressure_volume_moment)
      || !all(vec3<bool>(
        finite_f32(coarse_gradient.x),
        finite_f32(coarse_gradient.y),
        finite_f32(coarse_gradient.z)
      ))
      || !all(vec3<bool>(
        finite_f32(coarse_velocity.x),
        finite_f32(coarse_velocity.y),
        finite_f32(coarse_velocity.z)
      ))) {
    return invalid_cross_level_phase_route();
  }
  let fine_pressure = fine_absolute_pressure(fine_field);
  let coarse_pressure = coarse_pressure_volume_moment / coarse_volume;
  if (!(fine_pressure >= 0.0)
      || !(coarse_pressure >= 0.0)
      || !finite_f32(fine_pressure)
      || !finite_f32(coarse_pressure)) {
    return invalid_cross_level_phase_route();
  }

  var result: SchroederPhaseVolumePressureDragResult;
  var sign = 1.0;
  if (fine_noncondensed) {
    result = schroeder_phase_volume_pressure_drag_pair(
      coarse_mass,
      fine_mass,
      coarse_inverse_mass,
      1.0 / fine_mass,
      coarse_volume,
      fine_phase_volume(fine_field),
      coarse_gradient,
      fine_phase_gradient(fine_field),
      coarse_velocity,
      fine_velocity,
      coarse_mechanics.sound_speed,
      fine_mechanics.sound_speed,
      coarse_mechanics.dynamic_viscosity,
      fine_mechanics.dynamic_viscosity,
      coarse_pressure,
      fine_pressure,
      params.pressure_scale,
      params.drag_scale,
      params.max_impulse_fraction,
      params.coarse_spacing_m,
      params.fine_dt,
      params.cfl_factor
    );
    sign = -1.0;
  } else {
    result = schroeder_phase_volume_pressure_drag_pair(
      fine_mass,
      coarse_mass,
      1.0 / fine_mass,
      coarse_inverse_mass,
      fine_phase_volume(fine_field),
      coarse_volume,
      fine_phase_gradient(fine_field),
      coarse_gradient,
      fine_velocity,
      coarse_velocity,
      fine_mechanics.sound_speed,
      coarse_mechanics.sound_speed,
      fine_mechanics.dynamic_viscosity,
      coarse_mechanics.dynamic_viscosity,
      fine_pressure,
      coarse_pressure,
      params.pressure_scale,
      params.drag_scale,
      params.max_impulse_fraction,
      params.coarse_spacing_m,
      params.fine_dt,
      params.cfl_factor
    );
  }
  if (result.valid != 1u) {
    return invalid_cross_level_phase_route();
  }
  return CrossLevelPhaseRouteEvaluation(
    1u,
    sign * result.pressure_impulse,
    sign * result.drag_impulse,
    result.pressure_internal_compensation_j,
    result.drag_heat_j
  );
}

fn scatter_cross_level_phase_route(
  fine_field: u32,
  candidate_cohort: vec3<u32>,
  route: CrossLevelPhaseRouteEvaluation
) -> bool {
  let route_row = fine_field * PHASE_ROUTE_WORDS;
  let edge_begin = phase_reflux_routes[route_row + 1u];
  let edge_end = phase_reflux_routes[route_row + 2u];
  for (var edge = edge_begin; edge < edge_end; edge = edge + 1u) {
    let fine_parent = parent_view[parent_view[52u] + edge];
    let weight = bitcast<f32>(parent_view[parent_view[53u] + edge]);
    let recipient = find_parent_key(vec4<u32>(
      parent_key(fine_parent, 0u),
      candidate_cohort
    ));
    if (recipient == INVALID_INDEX) { return false; }
    let coarse_ordinal = parent_to_coarse_load(recipient);
    if (coarse_ordinal == INVALID_INDEX || coarse_ordinal >= ws_load(22u)) {
      return false;
    }
    let proposal = params.route_proposal_offset
      + coarse_ordinal * ROUTE_WORDS;
    let coarse_pressure = -weight * route.fine_pressure_impulse;
    let coarse_drag = -weight * route.fine_drag_impulse;
    if (!ws_atomic_add_f32(proposal, coarse_pressure.x + coarse_drag.x)
        || !ws_atomic_add_f32(
          proposal + 1u,
          coarse_pressure.y + coarse_drag.y
        )
        || !ws_atomic_add_f32(
          proposal + 2u,
          coarse_pressure.z + coarse_drag.z
        )
        || !ws_atomic_add_f32(proposal + 8u, coarse_pressure.x)
        || !ws_atomic_add_f32(proposal + 9u, coarse_pressure.y)
        || !ws_atomic_add_f32(proposal + 10u, coarse_pressure.z)
        || !ws_atomic_add_f32(proposal + 11u, coarse_drag.x)
        || !ws_atomic_add_f32(proposal + 12u, coarse_drag.y)
        || !ws_atomic_add_f32(proposal + 13u, coarse_drag.z)
        || !ws_atomic_add_f32(
          proposal + 14u,
          0.5 * weight * route.pressure_compensation_j
        )
        || !ws_atomic_add_f32(
          proposal + 15u,
          0.5 * weight * route.drag_heat_j
        )) {
      return false;
    }
    atomicAdd(&workspace[proposal + 3u], 1u);
  }
  return true;
}

@compute @workgroup_size(1)
fn admit_cross_level_phase_volume() {
  if (params.transport_enabled == 0u) { return; }
  if (arrayLength(&workspace) < params.required_words
      || ws_load(0u) != WORKSPACE_MAGIC
      || ws_load(1u) != WORKSPACE_VERSION
      || ws_load(2u) != READY_ADMITTED
      || ws_load(36u) != PHASE_PREDICTORS
      || !parent_admitted()
      || !fine_admitted(
        FIELD_VELOCITY,
        params.fine_correction_expected_mutation_ordinal
      )
      || !fine_receipt_admitted(
        FIELD_RECEIPT_HEAT_BUILDING,
        params.fine_correction_expected_mutation_ordinal
      )) {
    ws_reject(STATUS_INVALID_SOURCE, 37u);
    return;
  }
  if (!phase_proposal_admitted()) {
    ws_reject(STATUS_INVALID_REGISTRY, 87u);
    return;
  }
  if (!fine_pressure_receipt_admitted(true, false)
      || !coarse_pressure_receipt_admitted(true)) {
    reject_pressure_authority();
    ws_reject(STATUS_INVALID_SOURCE, 87u);
    return;
  }
  if (params.fine_capacity
      > arrayLength(&fine_phase_moments) / PHASE_MOMENT_ROW_WORDS
      || params.coarse_capacity
        > arrayLength(&coarse_phase_moments) / PHASE_MOMENT_ROW_WORDS) {
    ws_reject(STATUS_OVERFLOW, 38u);
    return;
  }
  for (var fine_field = 0u; fine_field < ws_load(21u); fine_field = fine_field + 1u) {
    if (!phase_route_admitted(fine_field)) {
      ws_reject(STATUS_INVALID_ROUTE, 86u);
      return;
    }
    if (!fine_phase_moment_valid(fine_field)) {
      ws_reject(STATUS_INVALID_SOURCE, 86u);
      return;
    }
    if (!fine_pressure_row_valid(fine_field)) {
      reject_pressure_authority();
      ws_reject(STATUS_INVALID_SOURCE, 86u);
      return;
    }
  }
  for (
    var coarse_field = 0u;
    coarse_field < ws_load(22u);
    coarse_field = coarse_field + 1u
  ) {
    let parent = parent_view[parent_view[54u] + coarse_field];
    if (parent >= ws_load(23u)
        || parent_to_coarse_load(parent) != coarse_field) {
      ws_reject(STATUS_INVALID_REGISTRY, 87u);
      return;
    }
    if (!coarse_phase_moment_valid(coarse_field, parent)) {
      ws_reject(STATUS_INVALID_SOURCE, 87u);
      return;
    }
    if (!coarse_pressure_row_valid(coarse_field, parent)) {
      reject_pressure_authority();
      ws_reject(STATUS_INVALID_SOURCE, 87u);
      return;
    }
  }
  let fine_receipt = fine_receipt_offset();
  let fine_prior_claimed = atomicOr(
    &fine_view[fine_receipt + 33u],
    FIELD_PRESSURE_CONSUMER_CROSS_LEVEL
  );
  if ((fine_prior_claimed & FIELD_PRESSURE_CONSUMER_CROSS_LEVEL) != 0u) {
    reject_pressure_authority();
    ws_reject(STATUS_INVALID_SOURCE, 87u);
    return;
  }
  let coarse_receipt = coarse_receipt_offset();
  atomicOr(
    &coarse_view[coarse_receipt + 33u],
    FIELD_PRESSURE_CONSUMER_CROSS_LEVEL
  );
  if (!fine_pressure_receipt_admitted(true, true)
      || !coarse_pressure_receipt_admitted(true)
      || (
        coarse_load(coarse_receipt + 33u)
          & FIELD_PRESSURE_CONSUMER_CROSS_LEVEL
      ) == 0u) {
    reject_pressure_authority();
    ws_reject(STATUS_INVALID_SOURCE, 87u);
    return;
  }
}

@compute @workgroup_size(64)
fn propose_cross_level_phase_volume(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let fine_field = indirect_row_index(id, workgroup_count);
  if (params.transport_enabled == 0u
      || !workspace_admitted(PHASE_PREDICTORS)
      || fine_field >= ws_load(21u)) {
    return;
  }
  if (params.phase_record_count == 0u
      || params.phase_record_count
        > arrayLength(&material_phase_records) / 3u) {
    phase_transport_reject(REFLUX_PHASE_REJECTED);
    return;
  }
  if (!phase_route_admitted(fine_field)
      || !fine_phase_moment_valid(fine_field)) {
    phase_transport_reject(REFLUX_ROUTE_REJECTED);
    return;
  }
  let route_row = fine_field * PHASE_ROUTE_WORDS;
  let edge_begin = phase_reflux_routes[route_row + 1u];
  let first_parent = parent_view[parent_view[52u] + edge_begin];
  let first_dense = parent_key(first_parent, 0u);
  var group_begin = first_parent;
  loop {
    if (group_begin == 0u
        || parent_key(group_begin - 1u, 0u) != first_dense) {
      break;
    }
    group_begin = group_begin - 1u;
  }
  var group_end = first_parent + 1u;
  loop {
    if (group_end >= ws_load(23u)
        || parent_key(group_end, 0u) != first_dense) {
      break;
    }
    group_end = group_end + 1u;
  }
  let fine_impulse_row = params.fine_impulse_offset
    + fine_field * FINE_IMPULSE_WORDS;
  for (
    var candidate = group_begin;
    candidate < group_end;
    candidate = candidate + 1u
  ) {
    let coarse_ordinal = parent_to_coarse_load(candidate);
    if (coarse_ordinal == INVALID_INDEX) { continue; }
    let route = evaluate_cross_level_phase_route(
      fine_field,
      parent_cohort(candidate)
    );
    if (route.status == 2u) {
      phase_transport_reject(REFLUX_ROUTE_REJECTED | REFLUX_NONFINITE);
      return;
    }
    if (route.status == 0u) { continue; }
    let total = route.fine_pressure_impulse + route.fine_drag_impulse;
    if (!ws_atomic_add_f32(fine_impulse_row, total.x)
        || !ws_atomic_add_f32(fine_impulse_row + 1u, total.y)
        || !ws_atomic_add_f32(fine_impulse_row + 2u, total.z)
        || !ws_atomic_add_f32(
          fine_impulse_row + 8u,
          route.fine_pressure_impulse.x
        )
        || !ws_atomic_add_f32(
          fine_impulse_row + 9u,
          route.fine_pressure_impulse.y
        )
        || !ws_atomic_add_f32(
          fine_impulse_row + 10u,
          route.fine_pressure_impulse.z
        )
        || !ws_atomic_add_f32(
          fine_impulse_row + 11u,
          route.fine_drag_impulse.x
        )
        || !ws_atomic_add_f32(
          fine_impulse_row + 12u,
          route.fine_drag_impulse.y
        )
        || !ws_atomic_add_f32(
          fine_impulse_row + 13u,
          route.fine_drag_impulse.z
        )
        || !ws_atomic_add_f32(
          fine_impulse_row + 14u,
          0.5 * route.pressure_compensation_j
        )
        || !ws_atomic_add_f32(
          fine_impulse_row + 15u,
          0.5 * route.drag_heat_j
        )
        || !scatter_cross_level_phase_route(
          fine_field,
          parent_cohort(candidate),
          route
        )) {
      phase_transport_reject(REFLUX_NONFINITE | REFLUX_OVERFLOW);
      return;
    }
    atomicAdd(&workspace[88u], 1u);
  }
}

struct CausalRouteEvaluation {
  // 0: no complete affine causal route, 1: coherent causal impulse, 2:
  // complete route with malformed/nonfinite authoritative state.
  status: u32,
  impulse: vec3<f32>,
};

fn cohort_equal(left: vec3<u32>, right: vec3<u32>) -> bool {
  return all(left == right);
}

fn fine_cohort(fine_field: u32) -> vec3<u32> {
  return vec3<u32>(
    fine_key(fine_field, 1u), fine_key(fine_field, 2u),
    fine_key(fine_field, 3u)
  );
}

fn parent_cohort(parent: u32) -> vec3<u32> {
  return vec3<u32>(
    parent_key(parent, 1u), parent_key(parent, 2u), parent_key(parent, 3u)
  );
}

fn parent_full_key_less(parent: u32, key: vec4<u32>) -> bool {
  let a0 = parent_key(parent, 0u);
  if (a0 != key.x) { return a0 < key.x; }
  let a1 = parent_key(parent, 1u);
  if (a1 != key.y) { return a1 < key.y; }
  let a2 = parent_key(parent, 2u);
  if (a2 != key.z) { return a2 < key.z; }
  return parent_key(parent, 3u) < key.w;
}

fn find_parent_key(key: vec4<u32>) -> u32 {
  var low = 0u;
  var high = ws_load(23u);
  loop {
    if (low >= high) { break; }
    let middle = low + (high - low) / 2u;
    if (parent_full_key_less(middle, key)) {
      low = middle + 1u;
    } else {
      high = middle;
    }
  }
  if (low < ws_load(23u)
      && parent_key(low, 0u) == key.x
      && parent_key(low, 1u) == key.y
      && parent_key(low, 2u) == key.z
      && parent_key(low, 3u) == key.w) {
    return low;
  }
  return INVALID_INDEX;
}

fn local_route_is_causal(
  fine_velocity: vec3<f32>,
  fine_specific_gradient: vec3<f32>,
  candidate_cohort: vec3<u32>,
  fine_key_cohort: vec3<u32>,
  coarse_velocity: vec3<f32>,
  coarse_specific_gradient: vec3<f32>
) -> bool {
  let relative = coarse_velocity - fine_velocity;
  if (cohort_equal(candidate_cohort, fine_key_cohort)) {
    return dot(relative, relative) > 1.0e-18;
  }
  let normal_raw = fine_specific_gradient - coarse_specific_gradient;
  let normal_length2 = dot(normal_raw, normal_raw);
  if (normal_length2 <= 1.0e-12) { return false; }
  return dot(relative, normal_raw / sqrt(normal_length2)) < 0.0;
}

fn evaluate_causal_route(
  fine_field: u32,
  candidate_cohort: vec3<u32>
) -> CausalRouteEvaluation {
  let none = CausalRouteEvaluation(0u, vec3<f32>(0.0));
  let invalid = CausalRouteEvaluation(2u, vec3<f32>(0.0));
  let fine_state = fine_load(30u) + fine_field * ROW_WORDS;
  let fine_mass = bitcast<f32>(fine_load(fine_state));
  if (!(fine_mass > 0.0)) {
    return none;
  }
  let fine_velocity = vec3<f32>(
    bitcast<f32>(fine_load(fine_state + 1u)),
    bitcast<f32>(fine_load(fine_state + 2u)),
    bitcast<f32>(fine_load(fine_state + 3u))
  ) + (
    vec3<f32>(
      bitcast<f32>(ws_load(
        params.fine_impulse_offset
          + fine_field * FINE_IMPULSE_WORDS + 8u
      )),
      bitcast<f32>(ws_load(
        params.fine_impulse_offset
          + fine_field * FINE_IMPULSE_WORDS + 9u
      )),
      bitcast<f32>(ws_load(
        params.fine_impulse_offset
          + fine_field * FINE_IMPULSE_WORDS + 10u
      ))
    ) + vec3<f32>(
      bitcast<f32>(ws_load(
        params.fine_impulse_offset
          + fine_field * FINE_IMPULSE_WORDS + 11u
      )),
      bitcast<f32>(ws_load(
        params.fine_impulse_offset
          + fine_field * FINE_IMPULSE_WORDS + 12u
      )),
      bitcast<f32>(ws_load(
        params.fine_impulse_offset
          + fine_field * FINE_IMPULSE_WORDS + 13u
      ))
    )
  ) / fine_mass;
  let fine_specific_gradient = vec3<f32>(
    bitcast<f32>(fine_load(fine_state + 4u)),
    bitcast<f32>(fine_load(fine_state + 5u)),
    bitcast<f32>(fine_load(fine_state + 6u))
  ) / fine_mass;
  let source_cohort = fine_cohort(fine_field);
  let edge_count = parent_view[parent_view[50u] + fine_field];
  let edge_begin = parent_view[parent_view[51u] + fine_field];
  var coarse_velocity = vec3<f32>(0.0);
  var coarse_specific_gradient = vec3<f32>(0.0);
  var inverse_effective_mass = 1.0 / fine_mass;
  var locally_causal = false;
  for (var local = 0u; local < edge_count; local = local + 1u) {
    let edge = edge_begin + local;
    let fine_parent = parent_view[parent_view[52u] + edge];
    let weight = bitcast<f32>(parent_view[parent_view[53u] + edge]);
    let recipient = find_parent_key(vec4<u32>(
      parent_key(fine_parent, 0u), candidate_cohort
    ));
    if (recipient == INVALID_INDEX) { return none; }
    let coarse_ordinal = parent_to_coarse_load(recipient);
    if (coarse_ordinal == INVALID_INDEX) { return none; }
    if (coarse_ordinal >= ws_load(22u)) { return invalid; }
    let coarse_state = params.coarse_state_offset + recipient * ROW_WORDS;
    let coarse_mass = state_load(coarse_state, 0u);
    if (!(coarse_mass > 0.0) || !finite_f32(coarse_mass)) {
      return invalid;
    }
    let ledger_row = reflux_row(coarse_ordinal);
    let prior_reflux_impulse = vec3<f32>(
      bitcast<f32>(reflux_load(ledger_row + 5u)),
      bitcast<f32>(reflux_load(ledger_row + 6u)),
      bitcast<f32>(reflux_load(ledger_row + 7u))
    );
    let phase_proposal =
      params.route_proposal_offset + coarse_ordinal * ROUTE_WORDS;
    let phase_impulse = vec3<f32>(
      bitcast<f32>(ws_load(phase_proposal + 8u))
        + bitcast<f32>(ws_load(phase_proposal + 11u)),
      bitcast<f32>(ws_load(phase_proposal + 9u))
        + bitcast<f32>(ws_load(phase_proposal + 12u)),
      bitcast<f32>(ws_load(phase_proposal + 10u))
        + bitcast<f32>(ws_load(phase_proposal + 13u))
    );
    let recipient_velocity = velocity(coarse_state)
      + (prior_reflux_impulse + phase_impulse) / coarse_mass;
    let recipient_specific_gradient = vec3<f32>(
      state_load(coarse_state, 4u), state_load(coarse_state, 5u),
      state_load(coarse_state, 6u)
    ) / coarse_mass;
    locally_causal = locally_causal || local_route_is_causal(
      fine_velocity,
      fine_specific_gradient,
      candidate_cohort,
      source_cohort,
      recipient_velocity,
      recipient_specific_gradient
    );
    coarse_velocity = coarse_velocity + weight * recipient_velocity;
    coarse_specific_gradient =
      coarse_specific_gradient + weight * recipient_specific_gradient;
    inverse_effective_mass = inverse_effective_mass
      + weight * weight / coarse_mass;
  }
  if (!(inverse_effective_mass > 0.0) || !finite_f32(inverse_effective_mass)) {
    return invalid;
  }
  let relative = coarse_velocity - fine_velocity;
  var impulse = vec3<f32>(0.0);
  if (cohort_equal(candidate_cohort, source_cohort)) {
    impulse = relative / inverse_effective_mass;
  } else {
    let normal_raw = fine_specific_gradient - coarse_specific_gradient;
    let normal_length2 = dot(normal_raw, normal_raw);
    if (normal_length2 > 1.0e-12) {
      let normal = normal_raw / sqrt(normal_length2);
      let closing = dot(relative, normal);
      if (closing < 0.0) {
        impulse = (closing / inverse_effective_mass) * normal;
      }
    }
  }
  if (!all(vec3<bool>(
    finite_f32(impulse.x), finite_f32(impulse.y), finite_f32(impulse.z)
  ))) {
    return invalid;
  }
  return CausalRouteEvaluation(
    select(0u, 1u, dot(impulse, impulse) > 1.0e-24), impulse
  );
}

fn scatter_causal_route_proposal(
  fine_field: u32,
  candidate_cohort: vec3<u32>,
  impulse: vec3<f32>
) -> bool {
  let edge_count = parent_view[parent_view[50u] + fine_field];
  let edge_begin = parent_view[parent_view[51u] + fine_field];
  for (var local = 0u; local < edge_count; local = local + 1u) {
    let edge = edge_begin + local;
    let fine_parent = parent_view[parent_view[52u] + edge];
    let weight = bitcast<f32>(parent_view[parent_view[53u] + edge]);
    let recipient = find_parent_key(vec4<u32>(
      parent_key(fine_parent, 0u), candidate_cohort
    ));
    if (recipient == INVALID_INDEX) { return false; }
    let coarse_ordinal = parent_to_coarse_load(recipient);
    if (coarse_ordinal == INVALID_INDEX || coarse_ordinal >= ws_load(22u)) {
      return false;
    }
    let proposal = params.route_proposal_offset + coarse_ordinal * ROUTE_WORDS;
    if (!ws_atomic_add_f32(proposal, -weight * impulse.x)
        || !ws_atomic_add_f32(proposal + 1u, -weight * impulse.y)
        || !ws_atomic_add_f32(proposal + 2u, -weight * impulse.z)) {
      return false;
    }
    atomicAdd(&workspace[proposal + 3u], 1u);
  }
  return true;
}

fn causal_impulse_sum(fine_field: u32, scatter: bool) -> vec3<f32> {
  let edge_begin = parent_view[parent_view[51u] + fine_field];
  let first_parent = parent_view[parent_view[52u] + edge_begin];
  let first_dense = parent_key(first_parent, 0u);
  var group_begin = first_parent;
  loop {
    if (group_begin == 0u || parent_key(group_begin - 1u, 0u) != first_dense) {
      break;
    }
    group_begin = group_begin - 1u;
  }
  var group_end = first_parent + 1u;
  loop {
    if (group_end >= ws_load(23u) || parent_key(group_end, 0u) != first_dense) {
      break;
    }
    group_end = group_end + 1u;
  }
  var total = vec3<f32>(0.0);
  for (var candidate = group_begin; candidate < group_end; candidate = candidate + 1u) {
    let coarse_ordinal = parent_to_coarse_load(candidate);
    if (coarse_ordinal == INVALID_INDEX) { continue; }
    let cohort = parent_cohort(candidate);
    let route = evaluate_causal_route(fine_field, cohort);
    if (route.status == 2u) {
      ws_reject(STATUS_INVALID_ROUTE, 86u);
      reflux_reject(REFLUX_ROUTE_REJECTED);
      return vec3<f32>(0.0);
    }
    if (route.status == 0u) { continue; }
    if (scatter && !scatter_causal_route_proposal(
      fine_field, cohort, route.impulse
    )) {
      ws_reject(STATUS_INVALID_ROUTE | STATUS_NONFINITE, 86u);
      reflux_reject(REFLUX_ROUTE_REJECTED | REFLUX_NONFINITE);
      return vec3<f32>(0.0);
    }
    total = total + route.impulse;
    if (scatter) { atomicAdd(&workspace[88u], 1u); }
  }
  return total;
}

fn cfl_interval_offset() -> u32 {
  return params.fine_impulse_offset
    + params.fine_capacity * FINE_IMPULSE_WORDS;
}

// Return (lower, upper, valid) for the complete feasible alpha interval in
// [0, 1]. A refreshed coarse predictor plus already committed private reflux
// can begin outside the guarded CFL sphere, so alpha=0 is not assumed
// feasible: an inward equal-and-opposite route may be the conservative repair.
fn velocity_alpha_interval(
  prior: vec3<f32>, delta: vec3<f32>, vmax: f32, ceiling: f32
) -> vec3<f32> {
  if (!(vmax > 0.0) || !finite_f32(vmax)
      || !finite_f32(ceiling) || ceiling < 0.0
      || !all(vec3<bool>(
        finite_f32(prior.x), finite_f32(prior.y), finite_f32(prior.z)
      ))
      || !all(vec3<bool>(
        finite_f32(delta.x), finite_f32(delta.y), finite_f32(delta.z)
      ))) {
    return vec3<f32>(0.0, -1.0, 0.0);
  }

  let prior_largest = max(
    abs(prior.x), max(abs(prior.y), abs(prior.z))
  );
  let delta_largest = max(
    abs(delta.x), max(abs(delta.y), abs(delta.z))
  );
  let numeric_scale = max(vmax, max(prior_largest, delta_largest));
  if (!(numeric_scale > 0.0) || !finite_f32(numeric_scale)) {
    return vec3<f32>(0.0, -1.0, 0.0);
  }

  var ceiling_upper = 1.0;
  if (ceiling > 0.0 && delta_largest > 0.0) {
    let normalized_delta_length = length(delta / delta_largest);
    let ceiling_to_largest = ceiling / delta_largest;
    if (!finite_f32(normalized_delta_length)
        || !(normalized_delta_length > 0.0)) {
      return vec3<f32>(0.0, -1.0, 0.0);
    }
    if (ceiling_to_largest < normalized_delta_length) {
      ceiling_upper = max(
        0.0, ceiling_to_largest / normalized_delta_length
      );
    }
  }

  // Normalize all quadratic operands by one shared finite component scale.
  // This keeps a, b, c, and the discriminant O(1), even when an input vector's
  // ordinary length or squared length would overflow f32.
  let scaled_prior = prior / numeric_scale;
  let scaled_delta = delta / numeric_scale;
  let scaled_vmax = vmax / numeric_scale;
  let scaled_guarded_vmax =
    scaled_vmax * ROUTE_CFL_NUMERIC_GUARD_FACTOR;
  let scaled_audit_vmax =
    scaled_vmax * ROUTE_CFL_PHYSICAL_AUDIT_FACTOR;
  let a = dot(scaled_delta, scaled_delta);
  let b = dot(scaled_prior, scaled_delta);
  let prior2 = dot(scaled_prior, scaled_prior);
  let guarded_vmax2 = scaled_guarded_vmax * scaled_guarded_vmax;
  let audit_vmax2 = scaled_audit_vmax * scaled_audit_vmax;
  // Deep-inside predictors retain a numeric reserve. A predictor already in
  // the physical audit band may accept only a do-no-worse route, while a
  // predictor outside that band must be repaired inward. This makes alpha=0
  // feasible exactly when the frozen predictor is already admissible without
  // surrendering the guarded target for ordinary routes.
  let target_vmax2 = max(
    guarded_vmax2, min(prior2, audit_vmax2)
  );
  let c = prior2 - target_vmax2;
  if (!finite_f32(a) || !finite_f32(b) || !finite_f32(c)) {
    return vec3<f32>(0.0, -1.0, 0.0);
  }
  if (!(a > 0.0)) {
    return select(
      vec3<f32>(0.0, -1.0, 0.0),
      vec3<f32>(0.0, ceiling_upper, 1.0),
      c <= 0.0
    );
  }

  let raw_discriminant = b * b - a * c;
  let discriminant_tolerance = max(
    8.0 * 1.175494351e-38,
    32.0 * 5.960464477539063e-8
      * (abs(b * b) + abs(a * c))
  );
  if (!finite_f32(raw_discriminant)
      || raw_discriminant < -discriminant_tolerance) {
    return vec3<f32>(0.0, -1.0, 0.0);
  }
  let root_term = sqrt(max(raw_discriminant, 0.0));
  let q = -b - select(-root_term, root_term, b >= 0.0);
  var root_a = 0.0;
  var root_b = 0.0;
  if (q == 0.0) {
    root_a = -b / a;
    root_b = root_a;
  } else {
    root_a = q / a;
    root_b = c / q;
  }
  if (!finite_f32(root_a) || !finite_f32(root_b)) {
    return vec3<f32>(0.0, -1.0, 0.0);
  }
  let lower = max(0.0, min(root_a, root_b));
  let upper = min(ceiling_upper, min(1.0, max(root_a, root_b)));
  if (lower > upper) {
    return vec3<f32>(0.0, -1.0, 0.0);
  }
  // Preserve the feasibility decision above, then canonicalize any valid
  // signed-zero root before its bits enter the atomic interval reduction.
  let canonical_lower = select(lower, 0.0, lower == 0.0);
  let canonical_upper = select(upper, 0.0, upper == 0.0);
  return vec3<f32>(canonical_lower, canonical_upper, 1.0);
}

fn velocity_endpoint_within_physical_audit(
  endpoint: vec3<f32>, vmax: f32
) -> bool {
  if (!(vmax > 0.0) || !finite_f32(vmax)
      || !all(vec3<bool>(
        finite_f32(endpoint.x), finite_f32(endpoint.y),
        finite_f32(endpoint.z)
      ))) {
    return false;
  }
  let endpoint_largest = max(
    abs(endpoint.x), max(abs(endpoint.y), abs(endpoint.z))
  );
  let numeric_scale = max(vmax, endpoint_largest);
  if (!(numeric_scale > 0.0) || !finite_f32(numeric_scale)) {
    return false;
  }
  let scaled_endpoint = endpoint / numeric_scale;
  let scaled_vmax = vmax / numeric_scale;
  let scaled_audit_vmax =
    scaled_vmax * ROUTE_CFL_PHYSICAL_AUDIT_FACTOR;
  let endpoint2 = dot(scaled_endpoint, scaled_endpoint);
  let audit_vmax2 = scaled_audit_vmax * scaled_audit_vmax;
  return finite_f32(endpoint2) && finite_f32(audit_vmax2)
    && endpoint2 <= audit_vmax2;
}

fn velocity_delta_within_ceiling(
  delta: vec3<f32>, ceiling: f32
) -> bool {
  if (!finite_f32(ceiling) || ceiling < 0.0
      || !all(vec3<bool>(
        finite_f32(delta.x), finite_f32(delta.y), finite_f32(delta.z)
      ))) {
    return false;
  }
  if (ceiling == 0.0) { return true; }
  let delta_largest = max(
    abs(delta.x), max(abs(delta.y), abs(delta.z))
  );
  let tolerance = 3.8146973e-6 * max(1.0, ceiling);
  let numeric_scale = max(tolerance, max(ceiling, delta_largest));
  if (!(numeric_scale > 0.0) || !finite_f32(numeric_scale)) {
    return false;
  }
  let scaled_delta = delta / numeric_scale;
  let scaled_audit_ceiling =
    ceiling / numeric_scale + tolerance / numeric_scale;
  let delta2 = dot(scaled_delta, scaled_delta);
  let audit_ceiling2 = scaled_audit_ceiling * scaled_audit_ceiling;
  return finite_f32(delta2) && finite_f32(audit_ceiling2)
    && delta2 <= audit_ceiling2;
}

fn velocity_magnitude_ratio(value: vec3<f32>, vmax: f32) -> f32 {
  if (!(vmax > 0.0) || !finite_f32(vmax)
      || !all(vec3<bool>(
        finite_f32(value.x), finite_f32(value.y), finite_f32(value.z)
      ))) {
    return -1.0;
  }
  let value_largest = max(
    abs(value.x), max(abs(value.y), abs(value.z))
  );
  let numeric_scale = max(vmax, value_largest);
  if (!(numeric_scale > 0.0) || !finite_f32(numeric_scale)) {
    return -1.0;
  }
  let scaled_vmax = vmax / numeric_scale;
  let ratio = length(value / numeric_scale) / scaled_vmax;
  return select(-1.0, ratio, finite_f32(ratio) && ratio >= 0.0);
}

fn cfl_prior_regime(prior: vec3<f32>, vmax: f32) -> u32 {
  if (!(vmax > 0.0) || !finite_f32(vmax)
      || !all(vec3<bool>(
        finite_f32(prior.x), finite_f32(prior.y), finite_f32(prior.z)
      ))) {
    return 3u;
  }
  let prior_largest = max(
    abs(prior.x), max(abs(prior.y), abs(prior.z))
  );
  let numeric_scale = max(vmax, prior_largest);
  if (!(numeric_scale > 0.0) || !finite_f32(numeric_scale)) {
    return 3u;
  }
  let scaled_prior = prior / numeric_scale;
  let scaled_vmax = vmax / numeric_scale;
  let prior2 = dot(scaled_prior, scaled_prior);
  let guarded_vmax =
    scaled_vmax * ROUTE_CFL_NUMERIC_GUARD_FACTOR;
  let audit_vmax =
    scaled_vmax * ROUTE_CFL_PHYSICAL_AUDIT_FACTOR;
  if (!finite_f32(prior2)) { return 3u; }
  if (prior2 <= guarded_vmax * guarded_vmax) { return 0u; }
  if (prior2 <= audit_vmax * audit_vmax) { return 1u; }
  return 2u;
}

fn publish_cfl_interval_reject_trace(
  stage: u32,
  field: u32,
  prior: vec3<f32>,
  phase_delta: vec3<f32>,
  full_delta: vec3<f32>,
  vmax: f32,
  ceiling: f32,
  phase_interval: vec3<f32>,
  full_interval: vec3<f32>
) {
  // This helper is called only after both canonical rejects have made the
  // macro permanently unpublishable. Claim the existing failed-only status
  // sentinel as a short lock, publish the operand payload into terminal-only
  // evidence words, then publish the final tag last. The later dispatch/copy
  // boundary provides device-wide visibility without a divergent barrier.
  var attempts = 0u;
  loop {
    let claimed = atomicCompareExchangeWeak(
      &reflux_ledger[124u], 0xffffffffu, 0xfffffffeu
    );
    if (claimed.exchanged) { break; }
    if (claimed.old_value != 0xffffffffu) { return; }
    attempts = attempts + 1u;
    if (attempts >= atomic_retry_limit()) { return; }
  }
  reflux_store(125u, bitcast<u32>(prior.x));
  reflux_store(126u, bitcast<u32>(prior.y));
  reflux_store(127u, bitcast<u32>(prior.z));
  reflux_store(128u, bitcast<u32>(phase_delta.x));
  reflux_store(129u, bitcast<u32>(phase_delta.y));
  reflux_store(130u, bitcast<u32>(phase_delta.z));
  reflux_store(131u, bitcast<u32>(full_delta.x));
  reflux_store(132u, bitcast<u32>(full_delta.y));
  reflux_store(133u, bitcast<u32>(full_delta.z));
  reflux_store(134u, bitcast<u32>(vmax));
  reflux_store(135u, bitcast<u32>(ceiling));
  let phase_valid = phase_interval.z == 1.0;
  let full_valid = full_interval.z == 1.0;
  let local_overlap = phase_valid && full_valid
    && max(phase_interval.x, full_interval.x)
      <= min(phase_interval.y, full_interval.y);
  let field_overflow = field > 0xffffu;
  let tag = 0xc7000000u
    | ((stage & 3u) << 22u)
    | select(0u, 1u << 21u, phase_valid)
    | select(0u, 1u << 20u, full_valid)
    | select(0u, 1u << 19u, local_overlap)
    | ((cfl_prior_regime(prior, vmax) & 3u) << 17u)
    | select(0u, 1u << 16u, field_overflow)
    | min(field, 0xffffu);
  reflux_store(124u, tag);
}

fn publish_cfl_interval_seal_reject_trace(
  alpha_lower: f32, alpha_upper: f32
) {
  var attempts = 0u;
  loop {
    let claimed = atomicCompareExchangeWeak(
      &reflux_ledger[124u], 0xffffffffu, 0xfffffffeu
    );
    if (claimed.exchanged) { break; }
    if (claimed.old_value != 0xffffffffu) { return; }
    attempts = attempts + 1u;
    if (attempts >= atomic_retry_limit()) { return; }
  }
  reflux_store(125u, bitcast<u32>(alpha_lower));
  reflux_store(126u, bitcast<u32>(alpha_upper));
  for (var word = 127u; word <= 135u; word = word + 1u) {
    reflux_store(word, 0u);
  }
  let tag = 0xc7000000u
    | (2u << 22u)
    | (1u << 21u)
    | (1u << 20u)
    | (3u << 17u)
    | 0xffffu;
  reflux_store(124u, tag);
}

@compute @workgroup_size(1)
fn begin_fine_velocity_correction() {
  if (!workspace_admitted(PHASE_PREDICTORS)
      || !reflux_accumulating()
      || !fine_admitted(
        FIELD_VELOCITY,
        params.fine_correction_expected_mutation_ordinal
      )
      || !fine_receipt_admitted(
        FIELD_RECEIPT_HEAT_BUILDING,
        params.fine_correction_expected_mutation_ordinal
      )
      || ws_load(67u) != params.fine_substep_ordinal + 1u
      || params.fine_correction_expected_mutation_ordinal == 0xffffffffu
      || params.fine_correction_output_mutation_ordinal
        != params.fine_correction_expected_mutation_ordinal + 1u) {
    ws_reject(STATUS_INVALID_SOURCE, 37u);
    return;
  }
  loop {
    let claimed = atomicCompareExchangeWeak(
      &fine_view[63u],
      params.fine_correction_expected_mutation_ordinal,
      params.fine_correction_output_mutation_ordinal
    );
    if (claimed.exchanged) { break; }
    if (claimed.old_value
        != params.fine_correction_expected_mutation_ordinal) {
      ws_reject(STATUS_INVALID_SOURCE, 37u);
      return;
    }
  }
  fine_store(
    fine_receipt_offset() + 5u,
    params.fine_correction_output_mutation_ordinal
  );
  fine_store(59u, FIELD_EMPTY);
  ws_store(33u, bitcast<u32>(params.fine_dt));
  ws_store(35u, bitcast<u32>(params.max_correction_m_per_s));
  ws_store(64u, 2u);
  ws_store(65u, params.fine_correction_expected_mutation_ordinal);
  ws_store(66u, params.fine_correction_output_mutation_ordinal);
}

@compute @workgroup_size(64)
fn validate_fine_velocity_correction(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let fine_field = indirect_row_index(id, workgroup_count);
  if (!workspace_admitted(PHASE_PREDICTORS) || fine_field >= ws_load(21u)) { return; }
  if (!fine_admitted(
      FIELD_VELOCITY,
      params.fine_correction_expected_mutation_ordinal
    )) {
    ws_reject(STATUS_INVALID_SOURCE, 37u);
    return;
  }
  let edge_count = parent_view[parent_view[50u] + fine_field];
  let edge_begin = parent_view[parent_view[51u] + fine_field];
  if (edge_count == 0u || edge_count > 8u || edge_begin > ws_load(24u)
      || edge_count > ws_load(24u) - edge_begin) {
    ws_reject(STATUS_INVALID_CSR, 41u);
    return;
  }
  var weight_sum = 0.0;
  var weight_sum_abs = 0.0;
  var first_moment = vec3<f32>(0.0);
  var first_moment_sum_abs = 0.0;
  for (var local = 0u; local < edge_count; local = local + 1u) {
    let edge = edge_begin + local;
    let parent = parent_view[parent_view[52u] + edge];
    let weight = bitcast<f32>(parent_view[parent_view[53u] + edge]);
    if (parent >= ws_load(23u) || !finite_f32(weight) || !(weight > 0.0)
        || !fine_parent_key_matches(fine_field, parent)) {
      ws_reject(STATUS_INVALID_KEY | STATUS_INVALID_CSR, 40u);
      return;
    }
    let parent_position = parent_node_position(parent);
    let weighted_position = weight * parent_position;
    weight_sum = weight_sum + weight;
    weight_sum_abs = weight_sum_abs + abs(weight);
    first_moment = first_moment + weighted_position;
    first_moment_sum_abs = first_moment_sum_abs
      + abs(weighted_position.x) + abs(weighted_position.y)
      + abs(weighted_position.z);
  }
  let fine_position = fine_node_position(fine_field);
  first_moment_sum_abs = first_moment_sum_abs
    + abs(fine_position.x) + abs(fine_position.y) + abs(fine_position.z);
  let pou_residual = abs(weight_sum - 1.0);
  let moment_residual_vector = first_moment - fine_position;
  let moment_residual = length(moment_residual_vector);
  let edge_epsilon = min(
    0.25,
    f32(edge_count) * 5.960464477539063e-8
  );
  let edge_gamma = edge_epsilon / max(1.0e-20, 1.0 - edge_epsilon);
  let pou_tolerance = max(
    8.0 * 1.175494351e-38,
    edge_gamma * weight_sum_abs
  );
  let moment_tolerance = max(
    8.0 * 1.175494351e-38,
    edge_gamma * first_moment_sum_abs
  );
  let fine_impulse_row = params.fine_impulse_offset
    + fine_field * FINE_IMPULSE_WORDS;
  ws_store(fine_impulse_row + 4u, 0u);
  ws_store(fine_impulse_row + 5u, params.fine_substep_ordinal);
  ws_store(fine_impulse_row + 6u, bitcast<u32>(pou_residual));
  ws_store(
    fine_impulse_row + 7u,
    bitcast<u32>(moment_residual)
  );
  if (!finite_f32(weight_sum) || !finite_f32(weight_sum_abs)
      || !finite_f32(first_moment_sum_abs)
      || pou_residual > pou_tolerance
      || moment_residual > moment_tolerance) {
    ws_reject(STATUS_INVALID_CSR | STATUS_INVALID_ROUTE, 41u);
    reflux_reject(REFLUX_ROUTE_REJECTED);
    return;
  }
  if (!ws_atomic_max_nonnegative_f32(50u, pou_residual)
      || !ws_atomic_add_f32(51u, weight_sum_abs)
      || !ws_atomic_max_nonnegative_f32(48u, moment_residual)
      || !ws_atomic_add_f32(49u, first_moment_sum_abs)) {
    ws_reject(STATUS_NONFINITE, 39u);
    reflux_reject(REFLUX_NONFINITE);
    return;
  }
  let state = fine_load(30u) + fine_field * ROW_WORDS;
  let mass = bitcast<f32>(fine_load(state));
  if (fine_load(state + 7u) == 0u) { return; }
  if (!(mass > 0.0) || !finite_f32(mass)) {
    ws_reject(STATUS_INVALID_SOURCE, 37u);
    return;
  }
  let mass_residual = mass * (weight_sum - 1.0);
  let first_mass_moment_residual = mass * moment_residual_vector;
  let mass_sum_abs = mass * (weight_sum_abs + 1.0);
  let first_mass_moment_sum_abs = mass * first_moment_sum_abs;
  let evidence_row = params.route_proposal_offset;
  var evidence_valid = true;
  evidence_valid = ws_atomic_add_f32(102u, mass_residual) && evidence_valid;
  evidence_valid = ws_atomic_add_f32(103u, mass_sum_abs) && evidence_valid;
  evidence_valid = ws_atomic_add_f32(
    evidence_row + 4u, first_mass_moment_residual.x
  ) && evidence_valid;
  evidence_valid = ws_atomic_add_f32(
    evidence_row + 5u, first_mass_moment_residual.y
  ) && evidence_valid;
  evidence_valid = ws_atomic_add_f32(
    evidence_row + 6u, first_mass_moment_residual.z
  ) && evidence_valid;
  evidence_valid = ws_atomic_add_f32(
    evidence_row + 7u, first_mass_moment_sum_abs
  ) && evidence_valid;
  if (!evidence_valid) {
    ws_reject(STATUS_NONFINITE, 39u);
    reflux_reject(REFLUX_NONFINITE);
    return;
  }
  // The parent CSR was already admitted in u32 range; active edge counts are
  // therefore a safe measured contribution count without a wrapping add.
  atomicAdd(&workspace[47u], edge_count);
  let prior = vec3<f32>(
    bitcast<f32>(fine_load(state + 1u)),
    bitcast<f32>(fine_load(state + 2u)),
    bitcast<f32>(fine_load(state + 3u))
  );
  let causal_impulse = causal_impulse_sum(fine_field, true);
  if (!workspace_admitted(PHASE_PREDICTORS)) { return; }
  let phase_impulse = vec3<f32>(
    bitcast<f32>(ws_load(fine_impulse_row + 8u))
      + bitcast<f32>(ws_load(fine_impulse_row + 11u)),
    bitcast<f32>(ws_load(fine_impulse_row + 9u))
      + bitcast<f32>(ws_load(fine_impulse_row + 12u)),
    bitcast<f32>(ws_load(fine_impulse_row + 10u))
      + bitcast<f32>(ws_load(fine_impulse_row + 13u))
  );
  let impulse = phase_impulse + causal_impulse;
  ws_store(fine_impulse_row, bitcast<u32>(impulse.x));
  ws_store(fine_impulse_row + 1u, bitcast<u32>(impulse.y));
  ws_store(fine_impulse_row + 2u, bitcast<u32>(impulse.z));
  ws_store(fine_impulse_row + 3u, 0u);
  ws_store(fine_impulse_row + 4u, 1u);
  let phase_delta = phase_impulse / mass;
  let full_delta = impulse / mass;
  let fine_spacing = bitcast<f32>(fine_load(23u));
  let vmax = params.cfl_factor * fine_spacing / max(params.fine_dt, 1.0e-12);
  let correction_ceiling = max(params.max_correction_m_per_s, 0.0);
  let phase_alpha_interval = velocity_alpha_interval(
    prior, phase_delta, vmax, correction_ceiling
  );
  let full_alpha_interval = velocity_alpha_interval(
    prior, full_delta, vmax, correction_ceiling
  );
  // Preparation applies alpha * (phase + causal_alpha * causal). Its endpoint
  // is a convex combination of the phase-only and full-route endpoints, so
  // admitting both rays protects every causal_alpha in [0, 1].
  let alpha_lower = max(
    phase_alpha_interval.x, full_alpha_interval.x
  );
  let alpha_upper = min(
    phase_alpha_interval.y, full_alpha_interval.y
  );
  if (phase_alpha_interval.z != 1.0
      || full_alpha_interval.z != 1.0
      || alpha_lower > alpha_upper
      || !ws_atomic_max_nonnegative_f32(
        cfl_interval_offset(), alpha_lower
      )
      || !ws_atomic_min_nonnegative_f32(85u, alpha_upper)) {
    ws_reject(STATUS_CFL_REJECTED, 86u);
    reflux_reject(REFLUX_CFL_REJECTED);
    publish_cfl_interval_reject_trace(
      0u, fine_field, prior, phase_delta, full_delta, vmax,
      correction_ceiling, phase_alpha_interval, full_alpha_interval
    );
    return;
  }
  // Reduce the causal-only Jacobi direction while this field is already
  // resident in a parallel validator. The route CFL scalar is sealed before
  // the independent causal-energy scalar and is applied to every route
  // component, preserving the equal-and-opposite route transaction even when
  // one endpoint has no remaining CFL headroom.
  let sealed_causal_impulse = impulse - phase_impulse;
  let after_phase = prior + phase_impulse / mass;
  if (!all(vec3<bool>(
      finite_f32(after_phase.x),
      finite_f32(after_phase.y),
      finite_f32(after_phase.z)
    )) || !all(vec3<bool>(
      finite_f32(sealed_causal_impulse.x),
      finite_f32(sealed_causal_impulse.y),
      finite_f32(sealed_causal_impulse.z)
    ))) {
    ws_reject(STATUS_NONFINITE | STATUS_ENERGY_REJECTED, 39u);
    reflux_reject(REFLUX_NONFINITE | REFLUX_ENERGY_REJECTED);
    return;
  }
  var valid = true;
  valid = ws_atomic_add_f32(
    80u, dot(prior, sealed_causal_impulse)
  ) && valid;
  valid = ws_atomic_add_f32(
    81u,
    0.5 * dot(sealed_causal_impulse, sealed_causal_impulse) / mass
  ) && valid;
  valid = ws_atomic_add_f32(
    84u, dot(phase_impulse / mass, sealed_causal_impulse)
  ) && valid;
  valid = ws_atomic_add_f32(90u, sealed_causal_impulse.x) && valid;
  valid = ws_atomic_add_f32(91u, sealed_causal_impulse.y) && valid;
  valid = ws_atomic_add_f32(92u, sealed_causal_impulse.z) && valid;
  let angular = cross(fine_position, sealed_causal_impulse);
  valid = ws_atomic_add_f32(96u, angular.x) && valid;
  valid = ws_atomic_add_f32(97u, angular.y) && valid;
  valid = ws_atomic_add_f32(98u, angular.z) && valid;
  if (!valid) {
    ws_reject(STATUS_NONFINITE, 39u);
    reflux_reject(REFLUX_NONFINITE);
    return;
  }
  atomicAdd(&workspace[89u], 1u);
}

@compute @workgroup_size(64)
fn validate_routed_coarse_cfl(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let coarse_field = indirect_row_index(id, workgroup_count);
  if (!workspace_admitted(PHASE_PREDICTORS) || !reflux_accumulating()
      || coarse_field >= ws_load(22u)) { return; }
  let parent = parent_view[parent_view[54u] + coarse_field];
  if (parent >= ws_load(23u)
      || parent_to_coarse_load(parent) != coarse_field) {
    ws_reject(STATUS_INVALID_REGISTRY, 87u);
    reflux_reject(REFLUX_KEY_REJECTED);
    return;
  }
  let coarse_state = params.coarse_state_offset + parent * ROW_WORDS;
  let mass = state_load(coarse_state, 0u);
  let row = reflux_row(coarse_field);
  let frozen_mass = bitcast<f32>(reflux_load(row + 4u));
  if (!(mass > 0.0) || !finite_f32(mass)
      || abs(mass - frozen_mass) > 3.8146973e-6 * max(1.0, abs(frozen_mass))) {
    ws_reject(STATUS_INVALID_REGISTRY, 87u);
    reflux_reject(REFLUX_KEY_REJECTED);
    return;
  }
  let proposal_base = params.route_proposal_offset + coarse_field * ROUTE_WORDS;
  let proposal = vec3<f32>(
    bitcast<f32>(ws_load(proposal_base)),
    bitcast<f32>(ws_load(proposal_base + 1u)),
    bitcast<f32>(ws_load(proposal_base + 2u))
  );
  let phase_impulse = vec3<f32>(
    bitcast<f32>(ws_load(proposal_base + 8u))
      + bitcast<f32>(ws_load(proposal_base + 11u)),
    bitcast<f32>(ws_load(proposal_base + 9u))
      + bitcast<f32>(ws_load(proposal_base + 12u)),
    bitcast<f32>(ws_load(proposal_base + 10u))
      + bitcast<f32>(ws_load(proposal_base + 13u))
  );
  let existing = vec3<f32>(
    bitcast<f32>(reflux_load(row + 5u)),
    bitcast<f32>(reflux_load(row + 6u)),
    bitcast<f32>(reflux_load(row + 7u))
  );
  let prior = velocity(coarse_state) + existing / mass;
  let phase_delta = phase_impulse / mass;
  let full_delta = proposal / mass;
  let vmax = params.cfl_factor * params.coarse_spacing_m
    / max(params.macro_dt, 1.0e-12);
  let phase_alpha_interval = velocity_alpha_interval(
    prior, phase_delta, vmax, 0.0
  );
  let full_alpha_interval = velocity_alpha_interval(
    prior, full_delta, vmax, 0.0
  );
  var successor_prior = prior;
  var successor_phase_alpha_interval = vec3<f32>(0.0, 1.0, 1.0);
  var successor_full_alpha_interval = vec3<f32>(0.0, 1.0, 1.0);
  if (params.temporal_coarse_enabled != 0u) {
    let successor_state = params.accumulator_offset + parent * ROW_WORDS;
    let successor_mass = state_load(successor_state, 0u);
    if (!(successor_mass > 0.0) || !finite_f32(successor_mass)
        || ws_load(successor_state + 7u) == 0u
        || abs(successor_mass - mass)
          > 3.8146973e-6 * max(1.0, abs(mass))) {
      ws_reject(STATUS_INVALID_SOURCE, 37u);
      reflux_reject(REFLUX_KEY_REJECTED);
      return;
    }
    successor_prior = velocity(successor_state) + existing / mass;
    successor_phase_alpha_interval = velocity_alpha_interval(
      successor_prior, phase_delta, vmax, 0.0
    );
    successor_full_alpha_interval = velocity_alpha_interval(
      successor_prior, full_delta, vmax, 0.0
    );
  }
  let alpha_lower = max(
    max(phase_alpha_interval.x, full_alpha_interval.x),
    max(
      successor_phase_alpha_interval.x,
      successor_full_alpha_interval.x
    )
  );
  let alpha_upper = min(
    min(phase_alpha_interval.y, full_alpha_interval.y),
    min(
      successor_phase_alpha_interval.y,
      successor_full_alpha_interval.y
    )
  );
  let current_alpha_lower = max(
    phase_alpha_interval.x, full_alpha_interval.x
  );
  let current_alpha_upper = min(
    phase_alpha_interval.y, full_alpha_interval.y
  );
  let successor_alpha_lower = max(
    successor_phase_alpha_interval.x,
    successor_full_alpha_interval.x
  );
  let successor_alpha_upper = min(
    successor_phase_alpha_interval.y,
    successor_full_alpha_interval.y
  );
  if (phase_alpha_interval.z != 1.0
      || full_alpha_interval.z != 1.0
      || successor_phase_alpha_interval.z != 1.0
      || successor_full_alpha_interval.z != 1.0
      || alpha_lower > alpha_upper
      || !ws_atomic_max_nonnegative_f32(
        cfl_interval_offset(), alpha_lower
      )
      || !ws_atomic_min_nonnegative_f32(85u, alpha_upper)) {
    ws_reject(STATUS_CFL_REJECTED, 86u);
    reflux_reject(REFLUX_CFL_REJECTED);
    let current_interval_rejected = phase_alpha_interval.z != 1.0
      || full_alpha_interval.z != 1.0
      || current_alpha_lower > current_alpha_upper;
    let successor_interval_rejected =
      successor_phase_alpha_interval.z != 1.0
      || successor_full_alpha_interval.z != 1.0
      || successor_alpha_lower > successor_alpha_upper;
    let temporal_joint_interval_rejected =
      !current_interval_rejected
      && !successor_interval_rejected
      && max(current_alpha_lower, successor_alpha_lower)
        > min(current_alpha_upper, successor_alpha_upper);
    if (params.temporal_coarse_enabled != 0u
        && (successor_interval_rejected
          || temporal_joint_interval_rejected
          || successor_alpha_upper < current_alpha_upper)) {
      publish_cfl_interval_reject_trace(
        3u, coarse_field, successor_prior, phase_delta, full_delta, vmax, 0.0,
        successor_phase_alpha_interval, successor_full_alpha_interval
      );
    } else {
      publish_cfl_interval_reject_trace(
        1u, coarse_field, prior, phase_delta, full_delta, vmax, 0.0,
        phase_alpha_interval, full_alpha_interval
      );
    }
    return;
  }
  let causal_impulse = proposal - phase_impulse;
  let after_phase = prior + phase_impulse / mass;
  if (!all(vec3<bool>(
      finite_f32(after_phase.x),
      finite_f32(after_phase.y),
      finite_f32(after_phase.z)
    )) || !all(vec3<bool>(
      finite_f32(causal_impulse.x),
      finite_f32(causal_impulse.y),
      finite_f32(causal_impulse.z)
    ))) {
    ws_reject(STATUS_NONFINITE | STATUS_ENERGY_REJECTED, 39u);
    reflux_reject(REFLUX_NONFINITE | REFLUX_ENERGY_REJECTED);
    return;
  }
  let position = parent_node_position(parent);
  let angular = cross(position, causal_impulse);
  var valid = true;
  valid = ws_atomic_add_f32(
    82u, dot(prior, causal_impulse)
  ) && valid;
  valid = ws_atomic_add_f32(
    83u, 0.5 * dot(causal_impulse, causal_impulse) / mass
  ) && valid;
  valid = ws_atomic_add_f32(
    84u, dot(phase_impulse / mass, causal_impulse)
  ) && valid;
  valid = ws_atomic_add_f32(93u, causal_impulse.x) && valid;
  valid = ws_atomic_add_f32(94u, causal_impulse.y) && valid;
  valid = ws_atomic_add_f32(95u, causal_impulse.z) && valid;
  valid = ws_atomic_add_f32(99u, angular.x) && valid;
  valid = ws_atomic_add_f32(100u, angular.y) && valid;
  valid = ws_atomic_add_f32(101u, angular.z) && valid;
  if (!valid) {
    ws_reject(STATUS_NONFINITE, 39u);
    reflux_reject(REFLUX_NONFINITE);
  }
}

@compute @workgroup_size(1)
fn seal_fine_correction_alpha() {
  if (!workspace_admitted(PHASE_PREDICTORS) || !reflux_accumulating()) { return; }
  let fine_causal_impulse = vec3<f32>(
    bitcast<f32>(ws_load(90u)), bitcast<f32>(ws_load(91u)),
    bitcast<f32>(ws_load(92u))
  );
  let coarse_causal_impulse = vec3<f32>(
    bitcast<f32>(ws_load(93u)), bitcast<f32>(ws_load(94u)),
    bitcast<f32>(ws_load(95u))
  );
  let fine_causal_angular = vec3<f32>(
    bitcast<f32>(ws_load(96u)), bitcast<f32>(ws_load(97u)),
    bitcast<f32>(ws_load(98u))
  );
  let coarse_causal_angular = vec3<f32>(
    bitcast<f32>(ws_load(99u)), bitcast<f32>(ws_load(100u)),
    bitcast<f32>(ws_load(101u))
  );
  let cfl_alpha_lower = bitcast<f32>(ws_load(cfl_interval_offset()));
  let cfl_alpha_limit = bitcast<f32>(ws_load(85u));
  if (!finite_f32(cfl_alpha_lower)
      || cfl_alpha_lower < 0.0
      || cfl_alpha_lower > 1.0
      || !finite_f32(cfl_alpha_limit)
      || cfl_alpha_limit < 0.0
      || cfl_alpha_limit > 1.0) {
    ws_reject(STATUS_NONFINITE | STATUS_ENERGY_REJECTED, 39u);
    reflux_reject(REFLUX_NONFINITE | REFLUX_ENERGY_REJECTED);
    return;
  }
  if (cfl_alpha_lower > cfl_alpha_limit) {
    ws_reject(STATUS_CFL_REJECTED, 86u);
    reflux_reject(REFLUX_CFL_REJECTED);
    publish_cfl_interval_seal_reject_trace(
      cfl_alpha_lower, cfl_alpha_limit
    );
    return;
  }
  // Every route solves against the same frozen predictor. Routes that share
  // coarse recipients therefore form one Jacobi direction: their individual
  // effective-mass solves omit the positive cross terms in
  // |sum(coarse impulse)|^2. The parallel validators have already reduced the
  // causal direction into words 80..84 and 90..101. Word 84 carries the
  // phase/causal cross coefficient so the energy polynomial can be evaluated
  // at the already sealed route-CFL alpha. Seal the largest remaining causal
  // step that cannot create kinetic energy. Pressure and drag retain their own
  // signed compensation/heat channels; transaction preparation applies the
  // shared CFL scalar to all three components before recomputing those channels.
  let raw_causal_linear =
    bitcast<f32>(ws_load(80u)) + bitcast<f32>(ws_load(82u));
  let phase_causal_cross = bitcast<f32>(ws_load(84u));
  let raw_causal_quadratic =
    bitcast<f32>(ws_load(81u)) + bitcast<f32>(ws_load(83u));
  let route_alpha_squared = cfl_alpha_limit * cfl_alpha_limit;
  let causal_linear = cfl_alpha_limit * (
    raw_causal_linear + cfl_alpha_limit * phase_causal_cross
  );
  let causal_quadratic = route_alpha_squared * raw_causal_quadratic;
  let causal_momentum_residual =
    fine_causal_impulse + coarse_causal_impulse;
  let causal_angular_residual =
    fine_causal_angular + coarse_causal_angular;
  let causal_scale = abs(cfl_alpha_limit * raw_causal_linear)
    + abs(route_alpha_squared * phase_causal_cross)
    + abs(causal_quadratic);
  let causal_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * causal_scale
  );
  let causal_momentum_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * (
      length(fine_causal_impulse) + length(coarse_causal_impulse)
    )
  );
  let causal_angular_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * (
      length(fine_causal_angular) + length(coarse_causal_angular)
    )
  );
  if (!finite_f32(raw_causal_linear)
      || !finite_f32(phase_causal_cross)
      || !finite_f32(raw_causal_quadratic)
      || raw_causal_quadratic < 0.0
      || !finite_f32(route_alpha_squared)
      || !finite_f32(causal_linear)
      || !finite_f32(causal_quadratic)
      || causal_quadratic < 0.0
      || max(abs(causal_momentum_residual.x), max(
        abs(causal_momentum_residual.y),
        abs(causal_momentum_residual.z)
      )) > causal_momentum_tolerance
      || max(abs(causal_angular_residual.x), max(
        abs(causal_angular_residual.y),
        abs(causal_angular_residual.z)
      )) > causal_angular_tolerance) {
    ws_reject(STATUS_INVALID_ROUTE | STATUS_ENERGY_REJECTED, 86u);
    reflux_reject(REFLUX_ROUTE_REJECTED | REFLUX_ENERGY_REJECTED);
    return;
  }
  var causal_alpha = 1.0;
  if (causal_linear + causal_quadratic > causal_tolerance) {
    if (!(causal_linear < 0.0) || !(causal_quadratic > 0.0)) {
      ws_reject(STATUS_ENERGY_REJECTED, 86u);
      reflux_reject(REFLUX_ENERGY_REJECTED);
      return;
    }
    causal_alpha = clamp(
      -causal_linear / causal_quadratic,
      0.0,
      1.0
    );
  }
  let sealed_causal_delta =
    causal_alpha * causal_linear
      + causal_alpha * causal_alpha * causal_quadratic;
  if (!finite_f32(causal_alpha)
      || !finite_f32(sealed_causal_delta)
      || sealed_causal_delta > causal_tolerance) {
    ws_reject(STATUS_NONFINITE | STATUS_ENERGY_REJECTED, 39u);
    reflux_reject(REFLUX_NONFINITE | REFLUX_ENERGY_REJECTED);
    return;
  }
  // Predictor contact loss is dead before validation, so word 84 progresses
  // from the reduced phase/causal cross coefficient to the sealed route-CFL
  // scalar. Word 85 is the causal-energy scalar consumed by preparation.
  ws_store(84u, bitcast<u32>(cfl_alpha_limit));
  ws_store(85u, bitcast<u32>(causal_alpha));
}

@compute @workgroup_size(64)
fn apply_fine_route_heat(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let fine_field = indirect_row_index(id, workgroup_count);
  if (!workspace_admitted(PHASE_PREDICTORS) || !reflux_accumulating()
      || reflux_load(8u) != params.fine_substep_ordinal + 1u
      || reflux_load(15u) != params.fine_substep_ordinal
      || !fine_admitted(FIELD_EMPTY, params.fine_correction_output_mutation_ordinal)
      || !fine_receipt_admitted(
        FIELD_RECEIPT_HEAT_BUILDING,
        params.fine_correction_output_mutation_ordinal
      )
      || fine_field >= ws_load(21u)) { return; }
  let impulse_row = params.fine_impulse_offset
    + fine_field * FINE_IMPULSE_WORDS;
  let accumulator = fine_load(28u)
    + fine_field * FIELD_ACCUMULATOR_WORDS;
  // word0 is total heat and word2 is the route-only audit subset. G2P adds
  // word0 to particle U exactly once and samples word2 only for evidence.
  fine_store(accumulator, ws_load(impulse_row + 5u));
  fine_store(accumulator + 1u, ws_load(impulse_row + 7u));
  fine_store(accumulator + 2u, ws_load(impulse_row + 6u));
  fine_store(accumulator + 3u, ws_load(impulse_row + 14u));
}

@compute @workgroup_size(64)
fn apply_fine_velocity_correction(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let fine_field = indirect_row_index(id, workgroup_count);
  if (!workspace_admitted(PHASE_PREDICTORS) || !reflux_accumulating()
      || reflux_load(8u) != params.fine_substep_ordinal + 1u
      || reflux_load(15u) != params.fine_substep_ordinal
      || !fine_admitted(FIELD_EMPTY, params.fine_correction_output_mutation_ordinal)
      || fine_field >= ws_load(21u)) { return; }
  let state = fine_load(30u) + fine_field * ROW_WORDS;
  if (fine_load(state + 7u) == 0u) { return; }
  let impulse_row = params.fine_impulse_offset
    + fine_field * FINE_IMPULSE_WORDS;
  if (ws_load(impulse_row + 4u) == 0u) { return; }
  fine_store(state + 1u, ws_load(impulse_row));
  fine_store(state + 2u, ws_load(impulse_row + 1u));
  fine_store(state + 3u, ws_load(impulse_row + 2u));
  atomicAdd(&workspace[46u], 1u);
}

@compute @workgroup_size(1)
fn prepare_fine_transaction() {
  if (!workspace_admitted(PHASE_PREDICTORS) || !reflux_accumulating()
      || !fine_admitted(
        FIELD_VELOCITY,
        params.fine_correction_expected_mutation_ordinal
      )
      || !fine_receipt_admitted(
        FIELD_RECEIPT_HEAT_BUILDING,
        params.fine_correction_expected_mutation_ordinal
      )) {
    return;
  }
  let route_cfl_alpha = bitcast<f32>(ws_load(84u));
  let causal_alpha = bitcast<f32>(ws_load(85u));
  let ordinal = params.fine_substep_ordinal;
  let expected = params.fine_substep_count;
  if (!finite_f32(route_cfl_alpha)
      || route_cfl_alpha < 0.0
      || route_cfl_alpha > 1.0
      || !finite_f32(causal_alpha)
      || causal_alpha < 0.0
      || causal_alpha > 1.0
      || ordinal >= expected
      || reflux_load(8u) != ordinal
      || reflux_load(15u) != ordinal
      || reflux_load(54u) != expected
      || reflux_load(97u) != ordinal
      || reflux_load(111u) != ordinal + 1u) {
    reflux_reject(REFLUX_PHASE_REJECTED);
    return;
  }
  if ((route_cfl_alpha < 1.0 - 3.8146973e-6
        || causal_alpha < 1.0 - 3.8146973e-6)
      && reflux_load(10u) == 0xffffffffu) {
    reflux_reject(REFLUX_OVERFLOW);
    return;
  }

  let receipt = fine_receipt_offset();
  let local_heat = bitcast<f32>(fine_load(receipt + 8u));
  let published_local_heat = bitcast<f32>(fine_load(receipt + 9u));
  let local_pressure_internal_compensation =
    bitcast<f32>(fine_load(receipt + 16u));
  let published_pressure_internal_compensation =
    bitcast<f32>(fine_load(receipt + 17u));
  if (!(local_heat >= 0.0) || !finite_f32(local_heat)
      || bitcast<u32>(local_heat) != bitcast<u32>(published_local_heat)
      || !finite_f32(local_pressure_internal_compensation)
      || bitcast<u32>(local_pressure_internal_compensation)
        != bitcast<u32>(published_pressure_internal_compensation)) {
    reflux_reject(REFLUX_NONFINITE | REFLUX_ENERGY_REJECTED);
    return;
  }

  var fine_energy_delta = 0.0;
  var coarse_virtual_energy_delta = 0.0;
  var fine_pressure_energy_delta = 0.0;
  var coarse_pressure_energy_delta = 0.0;
  var fine_drag_energy_delta = 0.0;
  var coarse_drag_energy_delta = 0.0;
  var fine_causal_energy_delta = 0.0;
  var coarse_causal_energy_delta = 0.0;
  var fine_pressure_weight = 0.0;
  var coarse_pressure_weight = 0.0;
  var fine_drag_weight = 0.0;
  var coarse_drag_weight = 0.0;
  var fine_causal_weight = 0.0;
  var coarse_causal_weight = 0.0;
  var last_fine_causal = INVALID_INDEX;
  var last_fine_pressure = INVALID_INDEX;
  var last_fine_drag = INVALID_INDEX;
  var last_coarse_pressure = INVALID_INDEX;
  var last_coarse_drag = INVALID_INDEX;
  var max_pou_residual = 0.0;
  var max_first_moment_residual = 0.0;
  var pou_sum_abs = 0.0;
  var first_moment_sum_abs = 0.0;
  var max_fine_cfl_ratio = 0.0;
  var route_recipient_count = 0u;
  var local_contribution_sum = 0u;
  var local_heat_sum = 0.0;
  var local_pressure_internal_compensation_sum = 0.0;
  var local_pressure_internal_compensation_sum_abs = 0.0;
  var local_ambient_impulse_sum = vec3<f32>(0.0);
  var local_ambient_impulse_sum_abs = vec3<f32>(0.0);
  var local_ambient_external_work_sum = 0.0;
  var local_ambient_external_work_sum_abs = 0.0;
  var applied_fine_impulse = vec3<f32>(0.0);
  var applied_coarse_impulse = vec3<f32>(0.0);
  var applied_fine_angular = vec3<f32>(0.0);
  var applied_coarse_angular = vec3<f32>(0.0);
  let fine_spacing = bitcast<f32>(fine_load(23u));
  let fine_vmax = params.cfl_factor * fine_spacing
    / max(params.fine_dt, 1.0e-12);
  let coarse_vmax = params.cfl_factor * params.coarse_spacing_m
    / max(params.macro_dt, 1.0e-12);
  if (!(fine_vmax > 0.0) || !finite_f32(fine_vmax)
      || !(coarse_vmax > 0.0) || !finite_f32(coarse_vmax)) {
    reflux_reject(REFLUX_NONFINITE | REFLUX_CFL_REJECTED);
    return;
  }

  // Validate every sealed fine impulse and every future field-sidecar update
  // before touching persistent ledger state.
  for (var fine_field = 0u; fine_field < ws_load(21u); fine_field = fine_field + 1u) {
    let impulse_row = params.fine_impulse_offset
      + fine_field * FINE_IMPULSE_WORDS;
    let pou_residual = bitcast<f32>(ws_load(impulse_row + 6u));
    let moment_residual = bitcast<f32>(ws_load(impulse_row + 7u));
    let accumulator = fine_load(28u)
      + fine_field * FIELD_ACCUMULATOR_WORDS;
    let prior_total = bitcast<f32>(fine_load(accumulator));
    let prior_route = bitcast<f32>(fine_load(accumulator + 2u));
    let local_count = fine_load(accumulator + 1u);
    let pressure_compensation = bitcast<f32>(fine_load(accumulator + 3u));
    let ambient_impulse_x = bitcast<f32>(fine_load(accumulator + 4u));
    let ambient_impulse_y = bitcast<f32>(fine_load(accumulator + 5u));
    let ambient_impulse_z = bitcast<f32>(fine_load(accumulator + 6u));
    let ambient_work = bitcast<f32>(fine_load(accumulator + 7u));
    let ambient_impulse = vec3<f32>(
      ambient_impulse_x,
      ambient_impulse_y,
      ambient_impulse_z
    );
    let next_local_pressure_internal_compensation_sum =
      local_pressure_internal_compensation_sum + pressure_compensation;
    let next_local_pressure_internal_compensation_sum_abs =
      local_pressure_internal_compensation_sum_abs
        + abs(pressure_compensation);
    let next_local_ambient_impulse_sum =
      local_ambient_impulse_sum + ambient_impulse;
    let next_local_ambient_impulse_sum_abs =
      local_ambient_impulse_sum_abs + abs(ambient_impulse);
    let next_local_ambient_external_work_sum =
      local_ambient_external_work_sum + ambient_work;
    let next_local_ambient_external_work_sum_abs =
      local_ambient_external_work_sum_abs + abs(ambient_work);
    if (!finite_f32(pou_residual) || pou_residual < 0.0
        || !finite_f32(moment_residual) || moment_residual < 0.0
        || ws_load(impulse_row + 5u) != ordinal
        || !finite_f32(prior_total) || prior_total < 0.0
        || prior_route != 0.0
        || !finite_f32(pressure_compensation)
        || !finite_f32(ambient_impulse_x)
        || !finite_f32(ambient_impulse_y)
        || !finite_f32(ambient_impulse_z)
        || !finite_f32(ambient_work)
        || local_count > 0xffffffffu - local_contribution_sum
        || !finite_f32(local_heat_sum + prior_total)
        || !finite_f32(next_local_pressure_internal_compensation_sum)
        || !finite_f32(next_local_pressure_internal_compensation_sum_abs)
        || next_local_pressure_internal_compensation_sum_abs < 0.0
        || !all(vec3<bool>(
          finite_f32(next_local_ambient_impulse_sum.x),
          finite_f32(next_local_ambient_impulse_sum.y),
          finite_f32(next_local_ambient_impulse_sum.z)
        ))
        || !all(vec3<bool>(
          finite_f32(next_local_ambient_impulse_sum_abs.x),
          finite_f32(next_local_ambient_impulse_sum_abs.y),
          finite_f32(next_local_ambient_impulse_sum_abs.z)
        ))
        || !finite_f32(next_local_ambient_external_work_sum)
        || !finite_f32(next_local_ambient_external_work_sum_abs)
        || next_local_ambient_external_work_sum_abs < 0.0) {
      reflux_reject(REFLUX_ROUTE_REJECTED | REFLUX_NONFINITE);
      return;
    }
    local_contribution_sum = local_contribution_sum + local_count;
    local_heat_sum = local_heat_sum + prior_total;
    local_pressure_internal_compensation_sum =
      next_local_pressure_internal_compensation_sum;
    local_pressure_internal_compensation_sum_abs =
      next_local_pressure_internal_compensation_sum_abs;
    local_ambient_impulse_sum = next_local_ambient_impulse_sum;
    local_ambient_impulse_sum_abs = next_local_ambient_impulse_sum_abs;
    local_ambient_external_work_sum = next_local_ambient_external_work_sum;
    local_ambient_external_work_sum_abs =
      next_local_ambient_external_work_sum_abs;
    max_pou_residual = max(max_pou_residual, pou_residual);
    max_first_moment_residual = max(
      max_first_moment_residual, moment_residual
    );
    let state = fine_load(30u) + fine_field * ROW_WORDS;
    let state_active = fine_load(state + 7u) != 0u;
    let impulse_active = ws_load(impulse_row + 4u) != 0u;
    if (!state_active) {
      if (impulse_active
          || prior_total != 0.0
          || local_count != 0u
          || pressure_compensation != 0.0
          || ambient_impulse_x != 0.0
          || ambient_impulse_y != 0.0
          || ambient_impulse_z != 0.0
          || ambient_work != 0.0) {
        reflux_reject(REFLUX_ROUTE_REJECTED | REFLUX_PHASE_REJECTED);
        return;
      }
      continue;
    }
    if (!impulse_active) {
      reflux_reject(REFLUX_ROUTE_REJECTED | REFLUX_PHASE_REJECTED);
      return;
    }
    let mass = bitcast<f32>(fine_load(state));
    let prior = vec3<f32>(
      bitcast<f32>(fine_load(state + 1u)),
      bitcast<f32>(fine_load(state + 2u)),
      bitcast<f32>(fine_load(state + 3u))
    );
    let impulse = vec3<f32>(
      bitcast<f32>(ws_load(impulse_row)),
      bitcast<f32>(ws_load(impulse_row + 1u)),
      bitcast<f32>(ws_load(impulse_row + 2u))
    );
    let raw_pressure_impulse = vec3<f32>(
      bitcast<f32>(ws_load(impulse_row + 8u)),
      bitcast<f32>(ws_load(impulse_row + 9u)),
      bitcast<f32>(ws_load(impulse_row + 10u))
    );
    let raw_drag_impulse = vec3<f32>(
      bitcast<f32>(ws_load(impulse_row + 11u)),
      bitcast<f32>(ws_load(impulse_row + 12u)),
      bitcast<f32>(ws_load(impulse_row + 13u))
    );
    let pressure_impulse = route_cfl_alpha * raw_pressure_impulse;
    let drag_impulse = route_cfl_alpha * raw_drag_impulse;
    let causal_impulse = route_cfl_alpha * causal_alpha * (
      impulse - raw_pressure_impulse - raw_drag_impulse
    );
    let applied = pressure_impulse + drag_impulse + causal_impulse;
    if (!(mass > 0.0) || !finite_f32(mass)
        || !all(vec3<bool>(
          finite_f32(prior.x), finite_f32(prior.y), finite_f32(prior.z)
        ))
        || !all(vec3<bool>(
          finite_f32(applied.x), finite_f32(applied.y), finite_f32(applied.z)
        ))) {
      prepare_reject(REFLUX_NONFINITE, 1u);
      return;
    }
    let applied_velocity_delta = applied / mass;
    let next_velocity = prior + applied_velocity_delta;
    if (!all(vec3<bool>(
        finite_f32(applied_velocity_delta.x),
        finite_f32(applied_velocity_delta.y),
        finite_f32(applied_velocity_delta.z)
      )) || !all(vec3<bool>(
        finite_f32(next_velocity.x), finite_f32(next_velocity.y),
        finite_f32(next_velocity.z)
      ))) {
      prepare_reject(REFLUX_NONFINITE, 2u);
      return;
    }
    if (!velocity_endpoint_within_physical_audit(
        next_velocity, fine_vmax
      )) {
      ws_reject(STATUS_CFL_REJECTED, 86u);
      prepare_reject(REFLUX_CFL_REJECTED, 101u);
      return;
    }
    if (!velocity_delta_within_ceiling(
        applied_velocity_delta,
        max(params.max_correction_m_per_s, 0.0)
      )) {
      ws_reject(STATUS_CFL_REJECTED, 86u);
      prepare_reject(REFLUX_CFL_REJECTED, 102u);
      return;
    }
    let pressure_velocity_delta = pressure_impulse / mass;
    let drag_velocity_delta = drag_impulse / mass;
    let total_linear = dot(prior, applied);
    let total_quadratic = 0.5 * dot(applied, applied) / mass;
    let delta = total_linear + total_quadratic;
    let pressure_linear = dot(prior, pressure_impulse);
    let pressure_quadratic =
      0.5 * dot(pressure_impulse, pressure_impulse) / mass;
    let pressure_delta = pressure_linear + pressure_quadratic;
    let after_pressure = prior + pressure_velocity_delta;
    let drag_linear = dot(after_pressure, drag_impulse);
    let drag_quadratic = 0.5 * dot(drag_impulse, drag_impulse) / mass;
    let drag_delta = drag_linear + drag_quadratic;
    let after_drag = after_pressure + drag_velocity_delta;
    let causal_linear = dot(after_drag, causal_impulse);
    let causal_quadratic = 0.5 * dot(causal_impulse, causal_impulse) / mass;
    let causal_delta = causal_linear + causal_quadratic;
    let channel_operation_conditioning =
      dot_product_conditioning(prior, applied) + abs(total_quadratic)
      + dot_product_conditioning(prior, pressure_impulse)
      + abs(pressure_quadratic)
      + dot_product_conditioning(prior, drag_impulse)
      + dot_product_conditioning(pressure_velocity_delta, drag_impulse)
      + abs(drag_quadratic)
      + dot_product_conditioning(prior, causal_impulse)
      + dot_product_conditioning(pressure_velocity_delta, causal_impulse)
      + dot_product_conditioning(drag_velocity_delta, causal_impulse)
      + abs(causal_quadratic);
    let cfl_ratio = velocity_magnitude_ratio(next_velocity, fine_vmax);
    if (!finite_f32(delta)
        || !finite_f32(pressure_delta)
        || !finite_f32(drag_delta)
        || !finite_f32(causal_delta)
        || !finite_f32(channel_operation_conditioning)
        || !all(vec3<bool>(
          finite_f32(next_velocity.x), finite_f32(next_velocity.y),
          finite_f32(next_velocity.z)
        )) || !(cfl_ratio >= 0.0) || !finite_f32(cfl_ratio)) {
      prepare_reject(REFLUX_NONFINITE, 3u);
      return;
    }
    if (!measured_channel_energy_close(
        delta,
        pressure_delta,
        drag_delta,
        causal_delta,
        channel_operation_conditioning
      )) {
      reflux_reject(REFLUX_ENERGY_REJECTED);
      return;
    }
    max_fine_cfl_ratio = max(max_fine_cfl_ratio, cfl_ratio);
    applied_fine_impulse = applied_fine_impulse + applied;
    applied_fine_angular = applied_fine_angular
      + cross(fine_node_position(fine_field), applied);
    fine_energy_delta = fine_energy_delta + delta;
    fine_pressure_energy_delta =
      fine_pressure_energy_delta + pressure_delta;
    fine_drag_energy_delta = fine_drag_energy_delta + drag_delta;
    fine_causal_energy_delta = fine_causal_energy_delta + causal_delta;
    let pressure_weight = abs(pressure_delta);
    let drag_weight = abs(drag_delta);
    let causal_weight = abs(causal_delta);
    fine_pressure_weight = fine_pressure_weight + pressure_weight;
    fine_drag_weight = fine_drag_weight + drag_weight;
    fine_causal_weight = fine_causal_weight + causal_weight;
    if (pressure_weight > 0.0) {
      last_fine_pressure = fine_field;
    }
    if (drag_weight > 0.0) {
      last_fine_drag = fine_field;
    }
    if (causal_weight > 0.0) {
      last_fine_causal = fine_field;
    }
    if (drag_weight > 0.0 || causal_weight > 0.0) {
      if (fine_load(accumulator + 1u) == 0xffffffffu) {
        reflux_reject(REFLUX_NONFINITE | REFLUX_OVERFLOW);
        return;
      }
    }
  }
  let fine_signed_reduction_count = independent_reduction_operation_count(
    ws_load(21u)
  );
  if (!measured_conditioned_close(
      local_pressure_internal_compensation_sum,
      local_pressure_internal_compensation,
      local_pressure_internal_compensation_sum_abs,
      fine_signed_reduction_count
    )) {
    reflux_reject(REFLUX_ENERGY_REJECTED);
    return;
  }
  let receipt_ambient_impulse = vec3<f32>(
    bitcast<f32>(fine_load(receipt + 20u)),
    bitcast<f32>(fine_load(receipt + 21u)),
    bitcast<f32>(fine_load(receipt + 22u))
  );
  let receipt_ambient_external_work =
    bitcast<f32>(fine_load(receipt + 23u));
  if (!all(vec3<bool>(
      finite_f32(receipt_ambient_impulse.x),
      finite_f32(receipt_ambient_impulse.y),
      finite_f32(receipt_ambient_impulse.z)
    )) || !finite_f32(receipt_ambient_external_work)
      || !measured_conditioned_close(
        local_ambient_impulse_sum.x,
        receipt_ambient_impulse.x,
        local_ambient_impulse_sum_abs.x,
        fine_signed_reduction_count
      ) || !measured_conditioned_close(
        local_ambient_impulse_sum.y,
        receipt_ambient_impulse.y,
        local_ambient_impulse_sum_abs.y,
        fine_signed_reduction_count
      ) || !measured_conditioned_close(
        local_ambient_impulse_sum.z,
        receipt_ambient_impulse.z,
        local_ambient_impulse_sum_abs.z,
        fine_signed_reduction_count
      ) || !measured_conditioned_close(
        local_ambient_external_work_sum,
        receipt_ambient_external_work,
        local_ambient_external_work_sum_abs,
        fine_signed_reduction_count
      )) {
    reflux_reject(REFLUX_ENERGY_REJECTED | REFLUX_NONFINITE);
    return;
  }
  let next_reflux_ambient_impulse = vec3<f32>(
    bitcast<f32>(reflux_load(132u)),
    bitcast<f32>(reflux_load(133u)),
    bitcast<f32>(reflux_load(134u))
  ) + receipt_ambient_impulse;
  let next_reflux_ambient_external_work =
    bitcast<f32>(reflux_load(135u)) + receipt_ambient_external_work;
  if (!all(vec3<bool>(
      finite_f32(next_reflux_ambient_impulse.x),
      finite_f32(next_reflux_ambient_impulse.y),
      finite_f32(next_reflux_ambient_impulse.z)
    )) || !finite_f32(next_reflux_ambient_external_work)) {
    reflux_reject(REFLUX_ENERGY_REJECTED | REFLUX_NONFINITE);
    return;
  }
  max_pou_residual = bitcast<f32>(ws_load(50u));
  pou_sum_abs = bitcast<f32>(ws_load(51u));
  max_first_moment_residual = bitcast<f32>(ws_load(48u));
  first_moment_sum_abs = bitcast<f32>(ws_load(49u));
  if (!finite_f32(max_pou_residual) || max_pou_residual < 0.0
      || !finite_f32(pou_sum_abs) || pou_sum_abs < 0.0
      || !finite_f32(max_first_moment_residual)
      || max_first_moment_residual < 0.0
      || !finite_f32(first_moment_sum_abs)
      || first_moment_sum_abs < 0.0) {
    prepare_reject(REFLUX_NONFINITE, 4u);
    return;
  }
  let evidence_row = params.route_proposal_offset;
  let measured_mass_residual = bitcast<f32>(ws_load(102u));
  let measured_mass_sum_abs = bitcast<f32>(ws_load(103u));
  let measured_first_mass_moment_residual = vec3<f32>(
    bitcast<f32>(ws_load(evidence_row + 4u)),
    bitcast<f32>(ws_load(evidence_row + 5u)),
    bitcast<f32>(ws_load(evidence_row + 6u))
  );
  let measured_first_mass_moment_sum_abs = bitcast<f32>(
    ws_load(evidence_row + 7u)
  );
  let measured_contribution_count = ws_load(47u);
  if (!finite_f32(measured_mass_residual)
      || !finite_f32(measured_mass_sum_abs) || measured_mass_sum_abs < 0.0
      || !all(vec3<bool>(
        finite_f32(measured_first_mass_moment_residual.x),
        finite_f32(measured_first_mass_moment_residual.y),
        finite_f32(measured_first_mass_moment_residual.z)
      ))
      || !finite_f32(measured_first_mass_moment_sum_abs)
      || measured_first_mass_moment_sum_abs < 0.0
      || measured_contribution_count > ws_load(24u)) {
    reflux_reject(REFLUX_NONFINITE | REFLUX_OVERFLOW);
    return;
  }
  let local_n_epsilon = min(
    0.25,
    f32(max(1u, local_contribution_sum)) * 5.960464477539063e-8
  );
  let local_gamma = local_n_epsilon / max(
    1.0e-20, 1.0 - local_n_epsilon
  );
  let local_tolerance = max(
    8.0 * 1.175494351e-38,
    local_gamma * (abs(local_heat_sum) + abs(local_heat))
  );
  if (local_contribution_sum != fine_load(receipt + 7u)
      || abs(local_heat_sum - local_heat) > local_tolerance) {
    reflux_reject(REFLUX_ENERGY_REJECTED | REFLUX_PHASE_REJECTED);
    return;
  }

  // Validate cumulative coarse impulse, virtual cross-work, contribution
  // counts, and the persistent per-recipient heat-weight slot.
  for (var coarse_field = 0u; coarse_field < ws_load(22u); coarse_field = coarse_field + 1u) {
    let proposal_base = params.route_proposal_offset
      + coarse_field * ROUTE_WORDS;
    let proposal = vec3<f32>(
      bitcast<f32>(ws_load(proposal_base)),
      bitcast<f32>(ws_load(proposal_base + 1u)),
      bitcast<f32>(ws_load(proposal_base + 2u))
    );
    let raw_pressure_impulse = vec3<f32>(
      bitcast<f32>(ws_load(proposal_base + 8u)),
      bitcast<f32>(ws_load(proposal_base + 9u)),
      bitcast<f32>(ws_load(proposal_base + 10u))
    );
    let raw_drag_impulse = vec3<f32>(
      bitcast<f32>(ws_load(proposal_base + 11u)),
      bitcast<f32>(ws_load(proposal_base + 12u)),
      bitcast<f32>(ws_load(proposal_base + 13u))
    );
    let row = reflux_row(coarse_field);
    let existing = vec3<f32>(
      bitcast<f32>(reflux_load(row + 5u)),
      bitcast<f32>(reflux_load(row + 6u)),
      bitcast<f32>(reflux_load(row + 7u))
    );
    let pressure_impulse = route_cfl_alpha * raw_pressure_impulse;
    let drag_impulse = route_cfl_alpha * raw_drag_impulse;
    let causal_impulse = route_cfl_alpha * causal_alpha * (
      proposal - raw_pressure_impulse - raw_drag_impulse
    );
    let applied = pressure_impulse + drag_impulse + causal_impulse;
    let next = existing + applied;
    let parent = parent_view[parent_view[54u] + coarse_field];
    let coarse_state = params.coarse_state_offset + parent * ROW_WORDS;
    let mass = state_load(coarse_state, 0u);
    let prior_velocity = velocity(coarse_state) + existing / mass;
    let applied_velocity_delta = applied / mass;
    let next_velocity = prior_velocity + applied_velocity_delta;
    let cfl_ratio = velocity_magnitude_ratio(next_velocity, coarse_vmax);
    let prior_virtual_delta = bitcast<f32>(reflux_load(row + 9u));
    let prior_weight = bitcast<f32>(reflux_load(row + 15u));
    let proposal_count = ws_load(proposal_base + 3u);
    let contribution_count = reflux_load(row + 13u);
    if (!(mass > 0.0) || !finite_f32(mass)
        || !all(vec3<bool>(
          finite_f32(next.x), finite_f32(next.y), finite_f32(next.z)
        ))
        || !all(vec3<bool>(
          finite_f32(prior_velocity.x), finite_f32(prior_velocity.y),
          finite_f32(prior_velocity.z)
        ))
        || !all(vec3<bool>(
          finite_f32(next_velocity.x), finite_f32(next_velocity.y),
          finite_f32(next_velocity.z)
        ))
        || !finite_f32(prior_virtual_delta)
        || !finite_f32(prior_weight) || prior_weight < 0.0
        || proposal_count > 0xffffffffu - contribution_count) {
      reflux_reject(REFLUX_NONFINITE | REFLUX_OVERFLOW);
      return;
    }
    if (!velocity_endpoint_within_physical_audit(
        next_velocity, coarse_vmax
      )) {
      ws_reject(STATUS_CFL_REJECTED, 86u);
      prepare_reject(REFLUX_CFL_REJECTED, 201u);
      return;
    }
    if (!(cfl_ratio >= 0.0) || !finite_f32(cfl_ratio)) {
      reflux_reject(REFLUX_NONFINITE | REFLUX_OVERFLOW);
      return;
    }
    let pressure_velocity_delta = pressure_impulse / mass;
    let drag_velocity_delta = drag_impulse / mass;
    let total_linear = dot(prior_velocity, applied);
    let total_quadratic = 0.5 * dot(applied, applied) / mass;
    let delta = total_linear + total_quadratic;
    let pressure_linear = dot(prior_velocity, pressure_impulse);
    let pressure_quadratic =
      0.5 * dot(pressure_impulse, pressure_impulse) / mass;
    let pressure_delta = pressure_linear + pressure_quadratic;
    let after_pressure = prior_velocity + pressure_velocity_delta;
    let drag_linear = dot(after_pressure, drag_impulse);
    let drag_quadratic = 0.5 * dot(drag_impulse, drag_impulse) / mass;
    let drag_delta = drag_linear + drag_quadratic;
    let after_drag = after_pressure + drag_velocity_delta;
    let causal_linear = dot(after_drag, causal_impulse);
    let causal_quadratic = 0.5 * dot(causal_impulse, causal_impulse) / mass;
    let causal_delta = causal_linear + causal_quadratic;
    let channel_operation_conditioning =
      dot_product_conditioning(prior_velocity, applied) + abs(total_quadratic)
      + dot_product_conditioning(prior_velocity, pressure_impulse)
      + abs(pressure_quadratic)
      + dot_product_conditioning(prior_velocity, drag_impulse)
      + dot_product_conditioning(pressure_velocity_delta, drag_impulse)
      + abs(drag_quadratic)
      + dot_product_conditioning(prior_velocity, causal_impulse)
      + dot_product_conditioning(pressure_velocity_delta, causal_impulse)
      + dot_product_conditioning(drag_velocity_delta, causal_impulse)
      + abs(causal_quadratic);
    let pressure_weight = abs(pressure_delta);
    let drag_weight = abs(drag_delta);
    let causal_weight = abs(causal_delta);
    let weight = drag_weight + causal_weight;
    if (!finite_f32(delta) || !finite_f32(weight)
        || !finite_f32(pressure_delta)
        || !finite_f32(drag_delta)
        || !finite_f32(causal_delta)
        || !finite_f32(channel_operation_conditioning)
        || !finite_f32(prior_virtual_delta + delta)
        || !finite_f32(prior_weight + weight)) {
      prepare_reject(REFLUX_NONFINITE, 5u);
      return;
    }
    if (!measured_channel_energy_close(
        delta,
        pressure_delta,
        drag_delta,
        causal_delta,
        channel_operation_conditioning
      )) {
      reflux_reject(REFLUX_ENERGY_REJECTED);
      return;
    }
    coarse_virtual_energy_delta = coarse_virtual_energy_delta + delta;
    coarse_pressure_energy_delta =
      coarse_pressure_energy_delta + pressure_delta;
    coarse_drag_energy_delta =
      coarse_drag_energy_delta + drag_delta;
    coarse_causal_energy_delta =
      coarse_causal_energy_delta + causal_delta;
    applied_coarse_impulse = applied_coarse_impulse + applied;
    applied_coarse_angular = applied_coarse_angular
      + cross(parent_node_position(parent), applied);
    coarse_pressure_weight = coarse_pressure_weight + pressure_weight;
    coarse_drag_weight = coarse_drag_weight + drag_weight;
    coarse_causal_weight = coarse_causal_weight + causal_weight;
    if (pressure_weight > 0.0) {
      last_coarse_pressure = coarse_field;
    }
    if (drag_weight > 0.0) {
      last_coarse_drag = coarse_field;
    }
  }

  let applied_momentum_residual =
    applied_fine_impulse + applied_coarse_impulse;
  let applied_angular_residual =
    applied_fine_angular + applied_coarse_angular;
  let applied_momentum_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * (
      length(applied_fine_impulse) + length(applied_coarse_impulse)
    )
  );
  let applied_angular_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * (
      length(applied_fine_angular) + length(applied_coarse_angular)
    )
  );
  if (max(abs(applied_momentum_residual.x), max(
        abs(applied_momentum_residual.y),
        abs(applied_momentum_residual.z)
      )) > applied_momentum_tolerance
      || max(abs(applied_angular_residual.x), max(
        abs(applied_angular_residual.y),
        abs(applied_angular_residual.z)
      )) > applied_angular_tolerance) {
    reflux_reject(REFLUX_ROUTE_REJECTED);
    return;
  }

  let virtual_delta = fine_energy_delta + coarse_virtual_energy_delta;
  let pressure_energy_delta =
    fine_pressure_energy_delta + coarse_pressure_energy_delta;
  let drag_energy_delta =
    fine_drag_energy_delta + coarse_drag_energy_delta;
  let causal_energy_delta =
    fine_causal_energy_delta + coarse_causal_energy_delta;
  let virtual_scale = abs(fine_energy_delta)
    + abs(coarse_virtual_energy_delta)
    + abs(pressure_energy_delta)
    + abs(drag_energy_delta)
    + abs(causal_energy_delta);
  let virtual_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * virtual_scale
  );
  let pressure_compensation = -pressure_energy_delta;
  let drag_heat = max(0.0, -drag_energy_delta);
  let causal_heat = max(0.0, -causal_energy_delta);
  let virtual_heat = drag_heat + causal_heat;
  let decomposed_delta =
    pressure_energy_delta + drag_energy_delta + causal_energy_delta;
  let closure_residual =
    virtual_delta + pressure_compensation + virtual_heat;
  if (!finite_f32(virtual_delta)
      || !finite_f32(pressure_energy_delta)
      || !finite_f32(drag_energy_delta)
      || !finite_f32(causal_energy_delta)
      || !finite_f32(pressure_compensation)
      || !finite_f32(drag_heat)
      || !finite_f32(causal_heat)
      || !finite_f32(virtual_heat)
      || abs(virtual_delta - decomposed_delta) > virtual_tolerance
      || drag_energy_delta > virtual_tolerance
      || causal_energy_delta > virtual_tolerance
      || abs(closure_residual) > virtual_tolerance) {
    reflux_reject(REFLUX_NONFINITE | REFLUX_ENERGY_REJECTED);
    return;
  }
  let total_pressure_weight =
    fine_pressure_weight + coarse_pressure_weight;
  let total_drag_weight = fine_drag_weight + coarse_drag_weight;
  let total_causal_weight = fine_causal_weight + coarse_causal_weight;
  if ((abs(pressure_compensation) > virtual_tolerance
        && !(total_pressure_weight > 0.0))
      || (drag_heat > virtual_tolerance && !(total_drag_weight > 0.0))
      || (causal_heat > virtual_tolerance && !(total_causal_weight > 0.0))) {
    reflux_reject(REFLUX_ENERGY_REJECTED);
    return;
  }
  var fine_pressure_compensation = 0.0;
  if (total_pressure_weight > 0.0 && fine_pressure_weight > 0.0) {
    fine_pressure_compensation =
      (fine_pressure_weight / total_pressure_weight)
        * pressure_compensation;
  }
  let coarse_pressure_compensation =
    pressure_compensation - fine_pressure_compensation;
  var fine_drag_heat = 0.0;
  if (total_drag_weight > 0.0 && fine_drag_weight > 0.0) {
    fine_drag_heat =
      (fine_drag_weight / total_drag_weight) * drag_heat;
  }
  let coarse_drag_heat = max(0.0, drag_heat - fine_drag_heat);
  var fine_causal_heat = 0.0;
  if (total_causal_weight > 0.0 && fine_causal_weight > 0.0) {
    fine_causal_heat =
      (fine_causal_weight / total_causal_weight) * causal_heat;
  }
  let coarse_causal_heat = max(0.0, causal_heat - fine_causal_heat);
  var fine_route_heat = 0.0;
  fine_route_heat = fine_drag_heat + fine_causal_heat;
  let coarse_route_heat = coarse_drag_heat + coarse_causal_heat;
  if (!finite_f32(fine_pressure_compensation)
      || !finite_f32(coarse_pressure_compensation)
      || !finite_f32(fine_drag_heat)
      || !finite_f32(coarse_drag_heat)
      || !finite_f32(fine_causal_heat)
      || !finite_f32(coarse_causal_heat)
      || !finite_f32(fine_route_heat)
      || !finite_f32(coarse_route_heat)
      || abs(fine_route_heat + coarse_route_heat - virtual_heat)
        > virtual_tolerance) {
    reflux_reject(REFLUX_NONFINITE | REFLUX_ENERGY_REJECTED);
    return;
  }

  let next_fine_impulse = vec3<f32>(
    bitcast<f32>(reflux_load(16u)),
    bitcast<f32>(reflux_load(17u)),
    bitcast<f32>(reflux_load(18u))
  ) + applied_fine_impulse;
  let next_coarse_impulse = vec3<f32>(
    bitcast<f32>(reflux_load(19u)),
    bitcast<f32>(reflux_load(20u)),
    bitcast<f32>(reflux_load(21u))
  ) + applied_coarse_impulse;
  let next_fine_angular = vec3<f32>(
    bitcast<f32>(reflux_load(22u)),
    bitcast<f32>(reflux_load(23u)),
    bitcast<f32>(reflux_load(24u))
  ) + applied_fine_angular;
  let next_coarse_angular = vec3<f32>(
    bitcast<f32>(reflux_load(25u)),
    bitcast<f32>(reflux_load(26u)),
    bitcast<f32>(reflux_load(27u))
  ) + applied_coarse_angular;
  let next_fine_energy = bitcast<f32>(reflux_load(28u))
    + fine_energy_delta;
  let next_virtual_coarse_energy = bitcast<f32>(reflux_load(29u))
    + coarse_virtual_energy_delta;
  let next_fine_route_heat = bitcast<f32>(reflux_load(112u))
    + fine_route_heat;
  let next_fine_cross_level_pressure_compensation =
    bitcast<f32>(reflux_load(128u)) + fine_pressure_compensation;
  let next_fine_cross_level_drag_heat =
    bitcast<f32>(reflux_load(130u)) + fine_drag_heat;
  let next_coarse_cross_level_drag_heat =
    bitcast<f32>(reflux_load(131u)) + coarse_drag_heat;
  let next_local_heat = bitcast<f32>(reflux_load(116u)) + local_heat;
  let next_pou_residual = max(
    bitcast<f32>(reflux_load(90u)), max_pou_residual
  );
  let next_pou_sum_abs = bitcast<f32>(reflux_load(91u)) + pou_sum_abs;
  let next_moment_residual = max(
    bitcast<f32>(reflux_load(92u)), max_first_moment_residual
  );
  let next_moment_sum_abs = bitcast<f32>(reflux_load(93u))
    + first_moment_sum_abs;
  let next_fine_cfl_ratio = max(
    bitcast<f32>(reflux_load(42u)), max_fine_cfl_ratio
  );
  let projected_field_heat = local_heat + fine_route_heat;
  let next_mass_residual = bitcast<f32>(reflux_load(32u))
    + measured_mass_residual;
  let next_first_mass_moment_residual = vec3<f32>(
    bitcast<f32>(reflux_load(33u)), bitcast<f32>(reflux_load(34u)),
    bitcast<f32>(reflux_load(35u))
  ) + measured_first_mass_moment_residual;
  let next_mass_sum_abs = bitcast<f32>(reflux_load(85u))
    + measured_mass_sum_abs;
  let next_first_mass_moment_sum_abs = bitcast<f32>(reflux_load(86u))
    + measured_first_mass_moment_sum_abs;
  if (measured_contribution_count > 0xffffffffu - reflux_load(94u)) {
    reflux_reject(REFLUX_OVERFLOW);
    return;
  }
  let next_measurement_contribution_count = reflux_load(94u)
    + measured_contribution_count;
  if (!all(vec3<bool>(
      finite_f32(next_fine_impulse.x), finite_f32(next_fine_impulse.y),
      finite_f32(next_fine_impulse.z)
    )) || !all(vec3<bool>(
      finite_f32(next_coarse_impulse.x), finite_f32(next_coarse_impulse.y),
      finite_f32(next_coarse_impulse.z)
    )) || !all(vec3<bool>(
      finite_f32(next_fine_angular.x), finite_f32(next_fine_angular.y),
      finite_f32(next_fine_angular.z)
    )) || !all(vec3<bool>(
      finite_f32(next_coarse_angular.x), finite_f32(next_coarse_angular.y),
      finite_f32(next_coarse_angular.z)
    )) || !finite_f32(next_fine_energy)
      || !finite_f32(next_virtual_coarse_energy)
      || !finite_f32(next_fine_route_heat) || next_fine_route_heat < 0.0
      || !finite_f32(next_fine_cross_level_pressure_compensation)
      || !finite_f32(next_fine_cross_level_drag_heat)
      || next_fine_cross_level_drag_heat < 0.0
      || !finite_f32(next_coarse_cross_level_drag_heat)
      || next_coarse_cross_level_drag_heat < 0.0
      || !finite_f32(next_local_heat) || next_local_heat < 0.0
      || !finite_f32(next_pou_residual) || next_pou_residual < 0.0
      || !finite_f32(next_pou_sum_abs)
      || !finite_f32(next_moment_residual) || next_moment_residual < 0.0
      || !finite_f32(next_moment_sum_abs)
      || !finite_f32(next_fine_cfl_ratio)
      || !finite_f32(projected_field_heat)
      || projected_field_heat < 0.0
      || !finite_f32(next_mass_residual)
      || !all(vec3<bool>(
        finite_f32(next_first_mass_moment_residual.x),
        finite_f32(next_first_mass_moment_residual.y),
        finite_f32(next_first_mass_moment_residual.z)
      ))
      || !finite_f32(next_mass_sum_abs) || next_mass_sum_abs < 0.0
      || !finite_f32(next_first_mass_moment_sum_abs)
      || next_first_mass_moment_sum_abs < 0.0) {
    prepare_reject(REFLUX_NONFINITE, 6u);
    return;
  }

  // Seal exact fine heat shares, exact future velocities, and exact sidecar
  // words while the live field is still VELOCITY/HEAT_BUILDING. After this
  // pass, the claim/commit/apply sequence has no reachable arithmetic reject.
  var assigned_fine_heat = 0.0;
  var assigned_fine_pressure_compensation = 0.0;
  var assigned_fine_drag_heat = 0.0;
  var assigned_fine_causal_heat = 0.0;
  var projected_total_heat_sum = 0.0;
  var projected_max_specific_heat = 0.0;
  for (var fine_field = 0u; fine_field < ws_load(21u); fine_field = fine_field + 1u) {
    let impulse_row = params.fine_impulse_offset
      + fine_field * FINE_IMPULSE_WORDS;
    let state = fine_load(30u) + fine_field * ROW_WORDS;
    let state_active = fine_load(state + 7u) != 0u;
    if (!state_active) {
      ws_store(impulse_row, 0u);
      ws_store(impulse_row + 1u, 0u);
      ws_store(impulse_row + 2u, 0u);
      ws_store(impulse_row + 3u, 0u);
      ws_store(impulse_row + 5u, 0u);
      ws_store(impulse_row + 6u, 0u);
      ws_store(impulse_row + 7u, 0u);
      for (var word = 8u; word < FINE_IMPULSE_WORDS; word = word + 1u) {
        ws_store(impulse_row + word, 0u);
      }
      continue;
    }
    let mass = bitcast<f32>(fine_load(state));
    let prior = vec3<f32>(
      bitcast<f32>(fine_load(state + 1u)),
      bitcast<f32>(fine_load(state + 2u)),
      bitcast<f32>(fine_load(state + 3u))
    );
    let impulse = vec3<f32>(
      bitcast<f32>(ws_load(impulse_row)),
      bitcast<f32>(ws_load(impulse_row + 1u)),
      bitcast<f32>(ws_load(impulse_row + 2u))
    );
    let raw_pressure_impulse = vec3<f32>(
      bitcast<f32>(ws_load(impulse_row + 8u)),
      bitcast<f32>(ws_load(impulse_row + 9u)),
      bitcast<f32>(ws_load(impulse_row + 10u))
    );
    let raw_drag_impulse = vec3<f32>(
      bitcast<f32>(ws_load(impulse_row + 11u)),
      bitcast<f32>(ws_load(impulse_row + 12u)),
      bitcast<f32>(ws_load(impulse_row + 13u))
    );
    let pressure_impulse = route_cfl_alpha * raw_pressure_impulse;
    let drag_impulse = route_cfl_alpha * raw_drag_impulse;
    let causal_impulse = route_cfl_alpha * causal_alpha * (
      impulse - raw_pressure_impulse - raw_drag_impulse
    );
    let applied = pressure_impulse + drag_impulse + causal_impulse;
    let next_velocity = prior + applied / mass;
    let delta = dot(prior, applied)
      + 0.5 * dot(applied, applied) / mass;
    let pressure_delta = dot(prior, pressure_impulse)
      + 0.5 * dot(pressure_impulse, pressure_impulse) / mass;
    let after_pressure = prior + pressure_impulse / mass;
    let drag_delta = dot(after_pressure, drag_impulse)
      + 0.5 * dot(drag_impulse, drag_impulse) / mass;
    let after_drag = after_pressure + drag_impulse / mass;
    let causal_delta = dot(after_drag, causal_impulse)
      + 0.5 * dot(causal_impulse, causal_impulse) / mass;
    let pressure_weight = abs(pressure_delta);
    let drag_weight = abs(drag_delta);
    let causal_weight = abs(causal_delta);
    var pressure_share = 0.0;
    if (pressure_weight > 0.0 && fine_pressure_weight > 0.0) {
      let remaining = fine_pressure_compensation
        - assigned_fine_pressure_compensation;
      if (fine_field == last_fine_pressure) {
        pressure_share = remaining;
      } else {
        pressure_share = (
          pressure_weight / fine_pressure_weight
        ) * fine_pressure_compensation;
      }
    }
    var drag_share = 0.0;
    if (drag_weight > 0.0
        && fine_drag_weight > 0.0
        && fine_drag_heat > 0.0) {
      let remaining = max(
        0.0,
        fine_drag_heat - assigned_fine_drag_heat
      );
      if (fine_field == last_fine_drag) {
        drag_share = remaining;
      } else {
        drag_share = min(
          (drag_weight / fine_drag_weight) * fine_drag_heat,
          remaining
        );
      }
    }
    var causal_share = 0.0;
    if (causal_weight > 0.0
        && fine_causal_weight > 0.0
        && fine_causal_heat > 0.0) {
      let remaining = max(
        0.0,
        fine_causal_heat - assigned_fine_causal_heat
      );
      if (fine_field == last_fine_causal) {
        causal_share = remaining;
      } else {
        causal_share = min(
          (causal_weight / fine_causal_weight) * fine_causal_heat,
          remaining
        );
      }
    }
    // Preserve the mandatory dissipative drag subset in every recipient,
    // matching the coarse terminal route: only the residual causal heat is
    // distributed independently.
    let share = drag_share + causal_share;
    let accumulator = fine_load(28u)
      + fine_field * FIELD_ACCUMULATOR_WORDS;
    let prior_total = bitcast<f32>(fine_load(accumulator));
    let prior_pressure =
      bitcast<f32>(fine_load(accumulator + 3u));
    let prior_local_count = fine_load(accumulator + 1u);
    let has_share = share > 0.0;
    let next_field_total = prior_total + share;
    let next_field_route = share;
    let next_field_pressure = prior_pressure + pressure_share;
    let next_local_count = prior_local_count + select(0u, 1u, has_share);
    let next_assigned = assigned_fine_heat + share;
    let next_assigned_pressure =
      assigned_fine_pressure_compensation + pressure_share;
    let next_assigned_drag = assigned_fine_drag_heat + drag_share;
    let next_assigned_causal =
      assigned_fine_causal_heat + causal_share;
    let next_projected_total = projected_total_heat_sum + next_field_total;
    let specific_heat = next_field_total / mass;
    if (!finite_f32(share) || share < 0.0
        || !finite_f32(pressure_share)
        || !finite_f32(drag_share) || drag_share < 0.0
        || !finite_f32(causal_share) || causal_share < 0.0
        || share < drag_share
        || !finite_f32(next_assigned)
        || !finite_f32(next_assigned_pressure)
        || !finite_f32(next_assigned_drag)
        || !finite_f32(next_assigned_causal)
        || next_assigned > fine_route_heat + virtual_tolerance
        || next_assigned_drag > fine_drag_heat + virtual_tolerance
        || next_assigned_causal > fine_causal_heat + virtual_tolerance
        || !finite_f32(next_field_total) || next_field_total < 0.0
        || !finite_f32(next_field_route) || next_field_route < 0.0
        || !finite_f32(next_field_pressure)
        || !finite_f32(next_projected_total)
        || !finite_f32(specific_heat) || specific_heat < 0.0
        || (has_share && (
          prior_local_count == 0xffffffffu
          || route_recipient_count == 0xffffffffu
        ))) {
      reflux_reject(REFLUX_NONFINITE | REFLUX_OVERFLOW | REFLUX_ENERGY_REJECTED);
      return;
    }
    if (has_share) { route_recipient_count = route_recipient_count + 1u; }
    assigned_fine_heat = next_assigned;
    assigned_fine_pressure_compensation = next_assigned_pressure;
    assigned_fine_drag_heat = next_assigned_drag;
    assigned_fine_causal_heat = next_assigned_causal;
    projected_total_heat_sum = next_projected_total;
    projected_max_specific_heat = max(
      projected_max_specific_heat, specific_heat
    );
    // J is no longer needed after preparation; replace it with the exact
    // future velocity so apply_fine_velocity_correction is store-only.
    ws_store(impulse_row, bitcast<u32>(next_velocity.x));
    ws_store(impulse_row + 1u, bitcast<u32>(next_velocity.y));
    ws_store(impulse_row + 2u, bitcast<u32>(next_velocity.z));
    ws_store(impulse_row + 3u, bitcast<u32>(share));
    ws_store(impulse_row + 5u, bitcast<u32>(next_field_total));
    ws_store(impulse_row + 6u, bitcast<u32>(next_field_route));
    ws_store(impulse_row + 7u, next_local_count);
    ws_store(impulse_row + 14u, bitcast<u32>(next_field_pressure));
    ws_store(impulse_row + 15u, bitcast<u32>(drag_share));
  }
  let assigned_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8
      * (abs(assigned_fine_heat) + abs(fine_route_heat))
  );
  if (abs(assigned_fine_heat - fine_route_heat) > assigned_tolerance) {
    reflux_reject(REFLUX_ENERGY_REJECTED);
    return;
  }
  let assigned_pressure_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * (
      abs(assigned_fine_pressure_compensation)
        + abs(fine_pressure_compensation)
    )
  );
  let assigned_drag_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * (
      abs(assigned_fine_drag_heat) + abs(fine_drag_heat)
    )
  );
  let assigned_causal_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * (
      abs(assigned_fine_causal_heat) + abs(fine_causal_heat)
    )
  );
  if (abs(
      assigned_fine_pressure_compensation
        - fine_pressure_compensation
    ) > assigned_pressure_tolerance
      || abs(assigned_fine_drag_heat - fine_drag_heat)
        > assigned_drag_tolerance
      || abs(assigned_fine_causal_heat - fine_causal_heat)
        > assigned_causal_tolerance) {
    reflux_reject(REFLUX_ENERGY_REJECTED);
    return;
  }
  if (route_recipient_count > 0xffffffffu - local_contribution_sum) {
    reflux_reject(REFLUX_OVERFLOW);
    return;
  }
  let projected_contribution_count = local_contribution_sum
    + route_recipient_count;
  let projected_heat_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8
      * (abs(projected_total_heat_sum) + abs(projected_field_heat))
  );
  if (!finite_f32(projected_max_specific_heat)
      || abs(projected_total_heat_sum - projected_field_heat)
        > projected_heat_tolerance) {
    reflux_reject(REFLUX_NONFINITE | REFLUX_ENERGY_REJECTED);
    return;
  }

  // Replace every route proposal with its exact future persistent row. The
  // post-claim ledger commit only copies these sealed words.
  var assigned_coarse_pressure_compensation = 0.0;
  var assigned_coarse_drag_heat = 0.0;
  var future_coarse_pressure_compensation_sum = 0.0;
  for (var coarse_field = 0u; coarse_field < ws_load(22u); coarse_field = coarse_field + 1u) {
    let proposal_base = params.route_proposal_offset
      + coarse_field * ROUTE_WORDS;
    let proposal = vec3<f32>(
      bitcast<f32>(ws_load(proposal_base)),
      bitcast<f32>(ws_load(proposal_base + 1u)),
      bitcast<f32>(ws_load(proposal_base + 2u))
    );
    let row = reflux_row(coarse_field);
    let existing = vec3<f32>(
      bitcast<f32>(reflux_load(row + 5u)),
      bitcast<f32>(reflux_load(row + 6u)),
      bitcast<f32>(reflux_load(row + 7u))
    );
    let raw_pressure_impulse = vec3<f32>(
      bitcast<f32>(ws_load(proposal_base + 8u)),
      bitcast<f32>(ws_load(proposal_base + 9u)),
      bitcast<f32>(ws_load(proposal_base + 10u))
    );
    let raw_drag_impulse = vec3<f32>(
      bitcast<f32>(ws_load(proposal_base + 11u)),
      bitcast<f32>(ws_load(proposal_base + 12u)),
      bitcast<f32>(ws_load(proposal_base + 13u))
    );
    let pressure_impulse = route_cfl_alpha * raw_pressure_impulse;
    let drag_impulse = route_cfl_alpha * raw_drag_impulse;
    let causal_impulse = route_cfl_alpha * causal_alpha * (
      proposal - raw_pressure_impulse - raw_drag_impulse
    );
    let applied = pressure_impulse + drag_impulse + causal_impulse;
    let parent = parent_view[parent_view[54u] + coarse_field];
    let coarse_state = params.coarse_state_offset + parent * ROW_WORDS;
    let mass = state_load(coarse_state, 0u);
    let prior_velocity = velocity(coarse_state) + existing / mass;
    let delta = dot(prior_velocity, applied)
      + 0.5 * dot(applied, applied) / mass;
    let pressure_delta = dot(prior_velocity, pressure_impulse)
      + 0.5 * dot(pressure_impulse, pressure_impulse) / mass;
    let after_pressure = prior_velocity + pressure_impulse / mass;
    let drag_delta = dot(after_pressure, drag_impulse)
      + 0.5 * dot(drag_impulse, drag_impulse) / mass;
    let after_drag = after_pressure + drag_impulse / mass;
    let causal_delta = dot(after_drag, causal_impulse)
      + 0.5 * dot(causal_impulse, causal_impulse) / mass;
    let pressure_weight = abs(pressure_delta);
    let drag_weight = abs(drag_delta);
    let causal_weight = abs(causal_delta);
    var pressure_share = 0.0;
    if (pressure_weight > 0.0 && coarse_pressure_weight > 0.0) {
      let remaining = coarse_pressure_compensation
        - assigned_coarse_pressure_compensation;
      if (coarse_field == last_coarse_pressure) {
        pressure_share = remaining;
      } else {
        pressure_share = (
          pressure_weight / coarse_pressure_weight
        ) * coarse_pressure_compensation;
      }
    }
    var drag_share = 0.0;
    if (drag_weight > 0.0
        && coarse_drag_weight > 0.0
        && coarse_drag_heat > 0.0) {
      let remaining = max(
        0.0,
        coarse_drag_heat - assigned_coarse_drag_heat
      );
      if (coarse_field == last_coarse_drag) {
        drag_share = remaining;
      } else {
        drag_share = min(
          (drag_weight / coarse_drag_weight) * coarse_drag_heat,
          remaining
        );
      }
    }
    let future_coarse_pressure_compensation =
      bitcast<f32>(reflux_load(row + 16u)) + pressure_share;
    let next_future_coarse_pressure_compensation_sum =
      future_coarse_pressure_compensation_sum
        + future_coarse_pressure_compensation;
    if (!finite_f32(future_coarse_pressure_compensation)
        || !finite_f32(next_future_coarse_pressure_compensation_sum)) {
      reflux_reject(REFLUX_NONFINITE | REFLUX_ENERGY_REJECTED);
      return;
    }
    assigned_coarse_pressure_compensation =
      assigned_coarse_pressure_compensation + pressure_share;
    assigned_coarse_drag_heat =
      assigned_coarse_drag_heat + drag_share;
    future_coarse_pressure_compensation_sum =
      next_future_coarse_pressure_compensation_sum;
    ws_store(proposal_base, bitcast<u32>(existing.x + applied.x));
    ws_store(proposal_base + 1u, bitcast<u32>(existing.y + applied.y));
    ws_store(proposal_base + 2u, bitcast<u32>(existing.z + applied.z));
    ws_store(
      proposal_base + 3u,
      reflux_load(row + 13u) + ws_load(proposal_base + 3u)
    );
    ws_store(
      proposal_base + 4u,
      bitcast<u32>(bitcast<f32>(reflux_load(row + 9u)) + delta)
    );
    ws_store(
      proposal_base + 5u,
      bitcast<u32>(
        bitcast<f32>(reflux_load(row + 15u))
          + causal_weight
      )
    );
    ws_store(
      proposal_base + 14u,
      bitcast<u32>(future_coarse_pressure_compensation)
    );
    ws_store(
      proposal_base + 15u,
      bitcast<u32>(
        bitcast<f32>(reflux_load(row + 17u)) + drag_share
      )
    );
    ws_store(proposal_base + 7u, ordinal + 1u);
  }
  let coarse_pressure_assignment_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * (
      abs(assigned_coarse_pressure_compensation)
        + abs(coarse_pressure_compensation)
    )
  );
  let coarse_drag_assignment_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * (
      abs(assigned_coarse_drag_heat) + abs(coarse_drag_heat)
    )
  );
  if (abs(
      assigned_coarse_pressure_compensation
        - coarse_pressure_compensation
    ) > coarse_pressure_assignment_tolerance
      || abs(assigned_coarse_drag_heat - coarse_drag_heat)
        > coarse_drag_assignment_tolerance) {
    reflux_reject(REFLUX_ENERGY_REJECTED);
    return;
  }
  // Stage the exact future ledger header and fine receipt tuple. Index 0..31
  // is private workspace storage; none of these writes are externally visible.
  fine_stage_store(0u, bitcast<u32>(next_fine_impulse.x));
  fine_stage_store(1u, bitcast<u32>(next_fine_impulse.y));
  fine_stage_store(2u, bitcast<u32>(next_fine_impulse.z));
  fine_stage_store(3u, bitcast<u32>(next_coarse_impulse.x));
  fine_stage_store(4u, bitcast<u32>(next_coarse_impulse.y));
  fine_stage_store(5u, bitcast<u32>(next_coarse_impulse.z));
  fine_stage_store(6u, bitcast<u32>(next_fine_angular.x));
  fine_stage_store(7u, bitcast<u32>(next_fine_angular.y));
  fine_stage_store(8u, bitcast<u32>(next_fine_angular.z));
  fine_stage_store(9u, bitcast<u32>(next_coarse_angular.x));
  fine_stage_store(10u, bitcast<u32>(next_coarse_angular.y));
  fine_stage_store(11u, bitcast<u32>(next_coarse_angular.z));
  fine_stage_store(12u, bitcast<u32>(next_fine_energy));
  fine_stage_store(13u, bitcast<u32>(next_virtual_coarse_energy));
  fine_stage_store(14u, bitcast<u32>(next_fine_cfl_ratio));
  fine_stage_store(15u, bitcast<u32>(next_pou_residual));
  fine_stage_store(16u, bitcast<u32>(next_pou_sum_abs));
  fine_stage_store(17u, bitcast<u32>(next_moment_residual));
  fine_stage_store(18u, bitcast<u32>(next_moment_sum_abs));
  fine_stage_store(19u, bitcast<u32>(next_fine_route_heat));
  fine_stage_store(20u, bitcast<u32>(next_local_heat));
  fine_stage_store(21u, bitcast<u32>(projected_field_heat));
  fine_stage_store(22u, projected_contribution_count);
  fine_stage_store(23u, bitcast<u32>(projected_max_specific_heat));
  fine_stage_store(24u, bitcast<u32>(max_fine_cfl_ratio));
  fine_stage_store(25u, bitcast<u32>(next_mass_residual));
  fine_stage_store(26u, bitcast<u32>(next_first_mass_moment_residual.x));
  fine_stage_store(27u, bitcast<u32>(next_first_mass_moment_residual.y));
  fine_stage_store(28u, bitcast<u32>(next_first_mass_moment_residual.z));
  fine_stage_store(29u, bitcast<u32>(next_mass_sum_abs));
  fine_stage_store(30u, bitcast<u32>(next_first_mass_moment_sum_abs));
  fine_stage_store(31u, reflux_load(111u) + 1u);
  // The route decomposition in row zero is dead after every future route row
  // has been staged. Preserve exact cumulative ambient evidence and the
  // canonical future coarse-pressure header here so the post-claim reflux
  // commit remains store-only for those signed ledgers.
  ws_store(
    params.route_proposal_offset + 8u,
    bitcast<u32>(next_reflux_ambient_impulse.x)
  );
  ws_store(
    params.route_proposal_offset + 9u,
    bitcast<u32>(next_reflux_ambient_impulse.y)
  );
  ws_store(
    params.route_proposal_offset + 10u,
    bitcast<u32>(next_reflux_ambient_impulse.z)
  );
  ws_store(
    params.route_proposal_offset + 11u,
    bitcast<u32>(next_reflux_ambient_external_work)
  );
  ws_store(
    params.route_proposal_offset + 12u,
    bitcast<u32>(future_coarse_pressure_compensation_sum)
  );
  // Row zero has one additional sealed word after route staging.
  ws_store(params.route_proposal_offset + 6u, next_measurement_contribution_count);
  ws_store(68u, bitcast<u32>(min(route_cfl_alpha, causal_alpha)));
  // Preparation token is last. begin_fine_velocity_correction will not claim
  // the field unless every projected persistent/physical word is sealed.
  ws_store(67u, ordinal + 1u);
}

@compute @workgroup_size(1)
fn commit_routed_reflux() {
  let ordinal = params.fine_substep_ordinal;
  if (!workspace_admitted(PHASE_PREDICTORS) || !reflux_accumulating()
      || ws_load(67u) != ordinal + 1u
      || !fine_admitted(
        FIELD_EMPTY,
        params.fine_correction_output_mutation_ordinal
      )
      || !fine_receipt_admitted(
        FIELD_RECEIPT_HEAT_BUILDING,
        params.fine_correction_output_mutation_ordinal
      )
      || reflux_load(8u) != ordinal
      || reflux_load(15u) != ordinal) {
    return;
  }
  var fine_pressure_compensation = 0.0;
  var fine_drag_heat = 0.0;
  for (
    var fine_field = 0u;
    fine_field < ws_load(21u);
    fine_field = fine_field + 1u
  ) {
    let impulse_row = params.fine_impulse_offset
      + fine_field * FINE_IMPULSE_WORDS;
    let accumulator =
      fine_load(28u) + fine_field * FIELD_ACCUMULATOR_WORDS;
    fine_pressure_compensation =
      fine_pressure_compensation
      + bitcast<f32>(ws_load(impulse_row + 14u))
      - bitcast<f32>(fine_load(accumulator + 3u));
    fine_drag_heat =
      fine_drag_heat + bitcast<f32>(ws_load(impulse_row + 15u));
  }
  var coarse_drag_heat = 0.0;
  for (var coarse_field = 0u; coarse_field < ws_load(22u); coarse_field = coarse_field + 1u) {
    let proposal = params.route_proposal_offset + coarse_field * ROUTE_WORDS;
    let row = reflux_row(coarse_field);
    coarse_drag_heat =
      coarse_drag_heat
      + bitcast<f32>(ws_load(proposal + 15u))
      - bitcast<f32>(reflux_load(row + 17u));
    reflux_store(row + 5u, ws_load(proposal));
    reflux_store(row + 6u, ws_load(proposal + 1u));
    reflux_store(row + 7u, ws_load(proposal + 2u));
    reflux_store(row + 13u, ws_load(proposal + 3u));
    reflux_store(row + 9u, ws_load(proposal + 4u));
    reflux_store(row + 15u, ws_load(proposal + 5u));
    reflux_store(row + 16u, ws_load(proposal + 14u));
    reflux_store(row + 17u, ws_load(proposal + 15u));
  }
  reflux_store(16u, fine_stage_load(0u));
  reflux_store(17u, fine_stage_load(1u));
  reflux_store(18u, fine_stage_load(2u));
  reflux_store(19u, fine_stage_load(3u));
  reflux_store(20u, fine_stage_load(4u));
  reflux_store(21u, fine_stage_load(5u));
  reflux_store(22u, fine_stage_load(6u));
  reflux_store(23u, fine_stage_load(7u));
  reflux_store(24u, fine_stage_load(8u));
  reflux_store(25u, fine_stage_load(9u));
  reflux_store(26u, fine_stage_load(10u));
  reflux_store(27u, fine_stage_load(11u));
  reflux_store(28u, fine_stage_load(12u));
  reflux_store(29u, fine_stage_load(13u));
  reflux_store(42u, fine_stage_load(14u));
  reflux_store(90u, fine_stage_load(15u));
  reflux_store(91u, fine_stage_load(16u));
  reflux_store(92u, fine_stage_load(17u));
  reflux_store(93u, fine_stage_load(18u));
  reflux_store(112u, fine_stage_load(19u));
  reflux_store(116u, fine_stage_load(20u));
  reflux_store(
    128u,
    bitcast<u32>(
      bitcast<f32>(reflux_load(128u)) + fine_pressure_compensation
    )
  );
  reflux_store(
    129u,
    ws_load(params.route_proposal_offset + 12u)
  );
  reflux_store(
    130u,
    bitcast<u32>(
      bitcast<f32>(reflux_load(130u)) + fine_drag_heat
    )
  );
  reflux_store(
    131u,
    bitcast<u32>(
      bitcast<f32>(reflux_load(131u)) + coarse_drag_heat
    )
  );
  reflux_store(132u, ws_load(params.route_proposal_offset + 8u));
  reflux_store(133u, ws_load(params.route_proposal_offset + 9u));
  reflux_store(134u, ws_load(params.route_proposal_offset + 10u));
  reflux_store(135u, ws_load(params.route_proposal_offset + 11u));
  reflux_store(32u, fine_stage_load(25u));
  reflux_store(33u, fine_stage_load(26u));
  reflux_store(34u, fine_stage_load(27u));
  reflux_store(35u, fine_stage_load(28u));
  reflux_store(85u, fine_stage_load(29u));
  reflux_store(86u, fine_stage_load(30u));
  reflux_store(94u, ws_load(params.route_proposal_offset + 6u));
  reflux_store(97u, ordinal + 1u);
  reflux_store(111u, fine_stage_load(31u));
  if (bitcast<f32>(ws_load(68u)) < 1.0 - 3.8146973e-6) {
    reflux_store(10u, reflux_load(10u) + 1u);
  }
  // The persistent fine transaction commit word is unconditionally last.
  reflux_store(8u, ordinal + 1u);
}

@compute @workgroup_size(1)
fn finalize_fine_velocity_correction() {
  if (!workspace_admitted(PHASE_PREDICTORS) || !fine_admitted(
      FIELD_EMPTY,
      params.fine_correction_output_mutation_ordinal
    ) || !fine_receipt_admitted(
      FIELD_RECEIPT_HEAT_BUILDING,
      params.fine_correction_output_mutation_ordinal
    ) || !reflux_accumulating()
      || reflux_load(8u) != params.fine_substep_ordinal + 1u
      || reflux_load(15u) != params.fine_substep_ordinal
      || !fine_pressure_receipt_admitted(
        params.transport_enabled != 0u,
        params.transport_enabled != 0u
      )) { return; }
  let receipt = fine_receipt_offset();
  fine_store(receipt + 4u, params.fine_substep_ordinal);
  fine_store(receipt + 6u, fine_load(34u));
  fine_store(receipt + 7u, fine_stage_load(22u));
  fine_store(receipt + 8u, fine_stage_load(21u));
  fine_store(receipt + 9u, fine_stage_load(21u));
  fine_store(receipt + 10u, 0u);
  fine_store(receipt + 11u, fine_stage_load(23u));
  fine_store(receipt + 12u, params.macro_owner_generation);
  fine_store(receipt + 13u, fine_stage_load(24u));
  fine_store(receipt + 14u, ws_load(50u));
  fine_store(receipt + 15u, ws_load(48u));
  var pressure_compensation = 0.0;
  for (
    var fine_field = 0u;
    fine_field < ws_load(21u);
    fine_field = fine_field + 1u
  ) {
    let accumulator =
      fine_load(28u) + fine_field * FIELD_ACCUMULATOR_WORDS;
    pressure_compensation =
      pressure_compensation
        + bitcast<f32>(fine_load(accumulator + 3u));
  }
  fine_store(receipt + 16u, bitcast<u32>(pressure_compensation));
  fine_store(receipt + 17u, bitcast<u32>(pressure_compensation));
  fine_store(59u, FIELD_VELOCITY);
  ws_store(36u, PHASE_FINE_COMPLETE);
  ws_store(58u, FIELD_VELOCITY);
  ws_store(70u, params.completion_ordinal);
  if (params.transport_enabled != 0u) {
    let prior_pressure_consumed = atomicOr(
      &fine_view[receipt + 34u],
      FIELD_PRESSURE_CONSUMER_CROSS_LEVEL
    );
    if ((prior_pressure_consumed & FIELD_PRESSURE_CONSUMER_CROSS_LEVEL) != 0u
        || (
          fine_load(receipt + 34u)
            & (
              FIELD_PRESSURE_CONSUMER_LOCAL
                | FIELD_PRESSURE_CONSUMER_CROSS_LEVEL
            )
        ) != (
          FIELD_PRESSURE_CONSUMER_LOCAL
            | FIELD_PRESSURE_CONSUMER_CROSS_LEVEL
        )) {
      reject_pressure_authority();
      ws_reject(STATUS_INVALID_SOURCE, 87u);
      return;
    }
  }
  // Receipt phase is the field-side publication commit word and is last.
  fine_store(receipt + 3u, FIELD_RECEIPT_ENERGY_READY);
}

// Terminal M2 is a prepared transaction over the actual deferred-seal coarse
// VELOCITY field. Successful validation mutates workspace storage only. The
// first persistent successful write is the field mutation-ordinal CAS below;
// every pass after that claim is a store-only, failure-free replay of sealed
// words.
@compute @workgroup_size(1)
fn begin_coarse_terminal_validation() {
  let ordinal = params.fine_substep_count;
  if (!workspace_admitted(PHASE_PREDICTORS) || !reflux_accumulating()
      || params.fine_substep_ordinal != ordinal
      || params.coarse_predictor_mutation_ordinal
        != params.coarse_publish_expected_mutation_ordinal
      || params.coarse_publish_expected_mutation_ordinal == 0xffffffffu
      || params.coarse_publish_output_mutation_ordinal
        != params.coarse_publish_expected_mutation_ordinal + 1u
      || bitcast<u32>(params.dt) != bitcast<u32>(params.macro_dt)
      || !(params.macro_dt > 0.0) || !finite_f32(params.macro_dt)
      || !(params.cfl_factor > 0.0) || !finite_f32(params.cfl_factor)
      || !(params.coarse_spacing_m > 0.0)
      || !finite_f32(params.coarse_spacing_m)
      || !coarse_admitted(
        FIELD_VELOCITY, params.coarse_publish_expected_mutation_ordinal
      ) || !coarse_receipt_admitted(
        FIELD_RECEIPT_HEAT_BUILDING,
        params.coarse_publish_expected_mutation_ordinal
      )) {
    ws_reject(STATUS_INVALID_SOURCE, 37u);
    if (reflux_structural()) {
      reflux_reject(REFLUX_PHASE_REJECTED);
    }
    return;
  }
  let receipt = coarse_receipt_offset();
  let evidence_count = max(1u, reflux_load(94u));
  let fine_route = bitcast<f32>(reflux_load(112u));
  let consumed_fine_route = bitcast<f32>(reflux_load(114u));
  let local_heat = bitcast<f32>(reflux_load(116u));
  let consumed_local_heat = bitcast<f32>(reflux_load(117u));
  let consumed_heat = bitcast<f32>(reflux_load(84u));
  let provenance_empty = reflux_load(61u) == 0u
    && reflux_load(62u) == 0u && reflux_load(63u) == 0u
    && reflux_load(64u) == 0u && reflux_load(65u) == 0u
    && reflux_load(66u) == 0u && reflux_load(67u) == 0u
    && reflux_load(68u) == 0u && reflux_load(69u) == 0u
    && reflux_load(70u) == 0u && reflux_load(71u) == 0u
    && reflux_load(72u) == 0u && reflux_load(73u) == 0u
    && reflux_load(74u) == 0u && reflux_load(75u) == 0u
    && reflux_load(76u) == 0u;
  if (reflux_load(7u) != params.macro_owner_id
      || reflux_load(7u) != reflux_load(82u)
      || reflux_load(8u) != ordinal || reflux_load(15u) != ordinal
      || reflux_load(9u) != 0u
      || reflux_load(54u) != ordinal || reflux_load(97u) != ordinal
      || reflux_load(98u) != ordinal + 1u
      || reflux_load(120u) != ordinal
      || reflux_load(82u) != params.macro_owner_id
      || reflux_load(83u) != params.macro_owner_generation
      || reflux_load(123u) != params.macro_owner_generation
      || reflux_load(80u) != 0u || reflux_load(81u) != 0u
      || reflux_load(95u) != 0u || reflux_load(96u) != 0u
      || reflux_load(99u) != 0u || reflux_load(100u) != 0u
      || reflux_load(101u) != 0u || reflux_load(102u) != 0u
      || reflux_load(103u) != 0u || reflux_load(118u) != 0u
      || reflux_load(119u) != 0u || reflux_load(121u) != 0u
      || reflux_load(113u) != 0u || reflux_load(115u) != 0u
      || reflux_load(111u) != ordinal + 1u
      || reflux_load(124u) != 0xffffffffu
      || reflux_load(125u) != 0u || !provenance_empty
      || !finite_f32(fine_route) || fine_route < 0.0
      || !finite_f32(consumed_fine_route) || consumed_fine_route < 0.0
      || !finite_f32(local_heat) || local_heat < 0.0
      || !finite_f32(consumed_local_heat) || consumed_local_heat < 0.0
      || !finite_f32(consumed_heat) || consumed_heat < 0.0
      || !finite_f32(bitcast<f32>(reflux_load(90u)))
      || bitcast<f32>(reflux_load(90u)) < 0.0
      || !finite_f32(bitcast<f32>(reflux_load(92u)))
      || bitcast<f32>(reflux_load(92u)) < 0.0
      || !measured_close(fine_route, consumed_fine_route, evidence_count)
      || !measured_close(local_heat, consumed_local_heat, evidence_count)
      || !measured_close(
        consumed_heat,
        consumed_fine_route + consumed_local_heat,
        evidence_count
      ) || coarse_load(receipt + 4u) != 0u
      || coarse_load(receipt + 5u)
        != params.coarse_publish_expected_mutation_ordinal
      || coarse_load(receipt + 6u) != ws_load(22u)
      || coarse_load(receipt + 10u) != 0u
      || coarse_load(receipt + 12u) != 0u
      || coarse_load(receipt + 13u) != 0u
      || coarse_load(receipt + 14u) != 0u
      || coarse_load(receipt + 15u) != 0u) {
    ws_reject(STATUS_INVALID_SOURCE | STATUS_INVALID_ROUTE, 86u);
    reflux_reject(REFLUX_PHASE_REJECTED | REFLUX_ROUTE_REJECTED);
    return;
  }
  for (var stage = 0u; stage < 32u; stage = stage + 1u) {
    fine_stage_store(stage, 0u);
  }
  for (var coarse_field = 0u; coarse_field < ws_load(22u); coarse_field = coarse_field + 1u) {
    let proposal = params.route_proposal_offset + coarse_field * ROUTE_WORDS;
    for (var word = 0u; word < ROUTE_WORDS; word = word + 1u) {
      ws_store(proposal + word, 0u);
    }
    // An active row can never report UINT_MAX state contributions. This is
    // the unambiguous "validator has not visited this row" sentinel.
    ws_store(proposal + 5u, 0xffffffffu);
  }
  ws_store(66u, 0u);
  ws_store(67u, 0u);
  ws_store(68u, 0u);
}

@compute @workgroup_size(64)
fn validate_coarse_velocity_publish(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let coarse_field = indirect_row_index(id, workgroup_count);
  if (!workspace_admitted(PHASE_PREDICTORS) || !reflux_accumulating()
      || coarse_field >= ws_load(22u)) { return; }
  if (!coarse_admitted(
      FIELD_VELOCITY, params.coarse_publish_expected_mutation_ordinal
    ) || !coarse_receipt_admitted(
      FIELD_RECEIPT_HEAT_BUILDING,
      params.coarse_publish_expected_mutation_ordinal
    )) {
    ws_reject(STATUS_INVALID_SOURCE, 37u);
    reflux_reject(REFLUX_PHASE_REJECTED);
    return;
  }
  let parent = parent_view[parent_view[54u] + coarse_field];
  let row = reflux_row(coarse_field);
  if (parent >= ws_load(23u)
      || parent_to_coarse_load(parent) != coarse_field
      || !coarse_parent_key_matches(coarse_field, parent)) {
    ws_reject(STATUS_INVALID_KEY | STATUS_INVALID_REGISTRY, 87u);
    reflux_reject(REFLUX_KEY_REJECTED);
    return;
  }
  let state = coarse_load(30u) + coarse_field * FIELD_STATE_WORDS;
  let accumulator = coarse_load(28u)
    + coarse_field * FIELD_ACCUMULATOR_WORDS;
  let mass = bitcast<f32>(coarse_load(state));
  let frozen_mass = bitcast<f32>(reflux_load(row + 4u));
  let state_contribution_count = coarse_load(state + 7u);
  let local_heat = bitcast<f32>(coarse_load(accumulator));
  let local_contribution_count = coarse_load(accumulator + 1u);
  let causal_weight = bitcast<f32>(reflux_load(row + 15u));
  let virtual_energy = bitcast<f32>(reflux_load(row + 9u));
  let prior = vec3<f32>(
    bitcast<f32>(coarse_load(state + 1u)),
    bitcast<f32>(coarse_load(state + 2u)),
    bitcast<f32>(coarse_load(state + 3u))
  );
  let impulse = vec3<f32>(
    bitcast<f32>(reflux_load(row + 5u)),
    bitcast<f32>(reflux_load(row + 6u)),
    bitcast<f32>(reflux_load(row + 7u))
  );
  if (!(mass > 0.0) || !finite_f32(mass)
      || !(frozen_mass > 0.0) || !finite_f32(frozen_mass)
      || state_contribution_count == 0u
      || state_contribution_count == 0xffffffffu
      || !measured_close(mass, frozen_mass, state_contribution_count)
      || !finite_f32(local_heat) || local_heat < 0.0
      || !finite_f32(causal_weight) || causal_weight < 0.0
      || !finite_f32(virtual_energy)
      || reflux_load(row + 8u) != 0u
      || reflux_load(row + 10u) != 0u
      || reflux_load(row + 11u) != 0u
      || reflux_load(row + 12u) != 0u
      || reflux_load(row + 14u) != 1u
      || coarse_load(accumulator + 2u) != 0u
      || !finite_f32(bitcast<f32>(coarse_load(accumulator + 3u)))
      || !finite_f32(bitcast<f32>(coarse_load(accumulator + 4u)))
      || !finite_f32(bitcast<f32>(coarse_load(accumulator + 5u)))
      || !finite_f32(bitcast<f32>(coarse_load(accumulator + 6u)))
      || !finite_f32(bitcast<f32>(coarse_load(accumulator + 7u)))
      || !all(vec3<bool>(
        finite_f32(prior.x), finite_f32(prior.y), finite_f32(prior.z)
      )) || !all(vec3<bool>(
        finite_f32(impulse.x), finite_f32(impulse.y), finite_f32(impulse.z)
      )) || !all(vec3<bool>(
        finite_f32(bitcast<f32>(coarse_load(state + 4u))),
        finite_f32(bitcast<f32>(coarse_load(state + 5u))),
        finite_f32(bitcast<f32>(coarse_load(state + 6u)))
      ))) {
    ws_reject(STATUS_INVALID_REGISTRY | STATUS_NONFINITE, 87u);
    reflux_reject(REFLUX_KEY_REJECTED | REFLUX_NONFINITE);
    return;
  }
  let future = prior + impulse / mass;
  let delta_energy = dot(prior, impulse)
    + 0.5 * dot(impulse, impulse) / mass;
  let vmax = params.cfl_factor * params.coarse_spacing_m / params.macro_dt;
  let cfl_ratio = velocity_magnitude_ratio(future, vmax);
  if (!all(vec3<bool>(
      finite_f32(future.x), finite_f32(future.y), finite_f32(future.z)
    )) || !finite_f32(delta_energy) || !finite_f32(vmax) || !(vmax > 0.0)
      || !finite_f32(cfl_ratio)
      || cfl_ratio < 0.0
      || !velocity_endpoint_within_physical_audit(future, vmax)) {
    ws_reject(STATUS_CFL_REJECTED | STATUS_NONFINITE, 86u);
    reflux_reject(REFLUX_CFL_REJECTED | REFLUX_NONFINITE);
    return;
  }
  let proposal = params.route_proposal_offset
    + coarse_field * ROUTE_WORDS;
  ws_store(proposal, bitcast<u32>(future.x));
  ws_store(proposal + 1u, bitcast<u32>(future.y));
  ws_store(proposal + 2u, bitcast<u32>(future.z));
  ws_store(proposal + 3u, bitcast<u32>(delta_energy));
  // Row 15 is the cumulative causal-loss weight from committed fine slices.
  // Drag has its own exact nonnegative row17 ledger and must not be mixed into
  // this distribution weight.
  // It remains immutable; prepare later replaces only this workspace copy.
  ws_store(proposal + 4u, bitcast<u32>(causal_weight));
  ws_store(proposal + 5u, state_contribution_count);
  ws_store(proposal + 6u, bitcast<u32>(local_heat));
  ws_store(proposal + 7u, local_contribution_count);
}

@compute @workgroup_size(1)
fn seal_coarse_velocity_publish() {
  if (!workspace_admitted(PHASE_PREDICTORS) || !reflux_accumulating()
      || !coarse_admitted(
        FIELD_VELOCITY, params.coarse_publish_expected_mutation_ordinal
      ) || !coarse_receipt_admitted(
        FIELD_RECEIPT_HEAT_BUILDING,
        params.coarse_publish_expected_mutation_ordinal
      )) { return; }
  let ordinal = params.fine_substep_count;
  let fine_impulse = vec3<f32>(
    bitcast<f32>(reflux_load(16u)), bitcast<f32>(reflux_load(17u)),
    bitcast<f32>(reflux_load(18u))
  );
  let recorded_coarse_impulse = vec3<f32>(
    bitcast<f32>(reflux_load(19u)), bitcast<f32>(reflux_load(20u)),
    bitcast<f32>(reflux_load(21u))
  );
  let fine_angular = vec3<f32>(
    bitcast<f32>(reflux_load(22u)), bitcast<f32>(reflux_load(23u)),
    bitcast<f32>(reflux_load(24u))
  );
  let recorded_coarse_angular = vec3<f32>(
    bitcast<f32>(reflux_load(25u)), bitcast<f32>(reflux_load(26u)),
    bitcast<f32>(reflux_load(27u))
  );
  var actual_coarse_impulse = vec3<f32>(0.0);
  var actual_coarse_angular = vec3<f32>(0.0);
  var actual_coarse_energy = 0.0;
  var actual_coarse_energy_sum_abs = 0.0;
  var virtual_coarse_energy = 0.0;
  var virtual_energy_sum_abs = 0.0;
  var terminal_mass_residual = 0.0;
  var terminal_mass_sum_abs = 0.0;
  var terminal_moment_residual = vec3<f32>(0.0);
  var terminal_moment_sum_abs = 0.0;
  var local_heat_sum = 0.0;
  var local_pressure_internal_compensation_sum = 0.0;
  var local_pressure_internal_compensation_sum_abs = 0.0;
  var local_contribution_sum = 0u;
  var state_contribution_sum = 0u;
  var max_specific_heat = 0.0;
  var max_coarse_cfl = 0.0;
  var causal_weight_sum = 0.0;
  var coarse_pressure_compensation_sum = 0.0;
  var coarse_drag_heat_sum = 0.0;
  var local_ambient_impulse_sum = vec3<f32>(0.0);
  var local_ambient_impulse_sum_abs = vec3<f32>(0.0);
  var local_ambient_external_work_sum = 0.0;
  var local_ambient_external_work_sum_abs = 0.0;
  var momentum_sum_abs = abs(fine_impulse.x) + abs(fine_impulse.y)
    + abs(fine_impulse.z);
  var angular_sum_abs = abs(fine_angular.x) + abs(fine_angular.y)
    + abs(fine_angular.z);
  for (var coarse_field = 0u; coarse_field < ws_load(22u); coarse_field = coarse_field + 1u) {
    let proposal = params.route_proposal_offset
      + coarse_field * ROUTE_WORDS;
    let state_contribution_count = ws_load(proposal + 5u);
    let local_contribution_count = ws_load(proposal + 7u);
    if (state_contribution_count == 0u
        || state_contribution_count == 0xffffffffu
        || state_contribution_count > 0xffffffffu - state_contribution_sum
        || local_contribution_count > 0xffffffffu - local_contribution_sum) {
      ws_reject(STATUS_OVERFLOW | STATUS_INVALID_REGISTRY, 38u);
      reflux_reject(REFLUX_OVERFLOW | REFLUX_KEY_REJECTED);
      return;
    }
    state_contribution_sum = state_contribution_sum
      + state_contribution_count;
    local_contribution_sum = local_contribution_sum
      + local_contribution_count;
    let row = reflux_row(coarse_field);
    let parent = parent_view[parent_view[54u] + coarse_field];
    let state = coarse_load(30u) + coarse_field * FIELD_STATE_WORDS;
    let accumulator = coarse_load(28u)
      + coarse_field * FIELD_ACCUMULATOR_WORDS;
    let mass = bitcast<f32>(coarse_load(state));
    let frozen_mass = bitcast<f32>(reflux_load(row + 4u));
    let local_heat = bitcast<f32>(ws_load(proposal + 6u));
    let pressure_internal_compensation =
      bitcast<f32>(coarse_load(accumulator + 3u));
    let causal_weight = bitcast<f32>(ws_load(proposal + 4u));
    let cross_level_pressure_compensation =
      bitcast<f32>(reflux_load(row + 16u));
    let cross_level_drag_heat =
      bitcast<f32>(reflux_load(row + 17u));
    let ambient_impulse = vec3<f32>(
      bitcast<f32>(coarse_load(accumulator + 4u)),
      bitcast<f32>(coarse_load(accumulator + 5u)),
      bitcast<f32>(coarse_load(accumulator + 6u))
    );
    let ambient_external_work =
      bitcast<f32>(coarse_load(accumulator + 7u));
    let delta_energy = bitcast<f32>(ws_load(proposal + 3u));
    let prior_virtual_energy = bitcast<f32>(reflux_load(row + 9u));
    let future = vec3<f32>(
      bitcast<f32>(ws_load(proposal)),
      bitcast<f32>(ws_load(proposal + 1u)),
      bitcast<f32>(ws_load(proposal + 2u))
    );
    let impulse = vec3<f32>(
      bitcast<f32>(reflux_load(row + 5u)),
      bitcast<f32>(reflux_load(row + 6u)),
      bitcast<f32>(reflux_load(row + 7u))
    );
    if (parent >= ws_load(23u)
        || parent_to_coarse_load(parent) != coarse_field
        || !coarse_parent_key_matches(coarse_field, parent)
        || coarse_load(state + 7u) != state_contribution_count
        || coarse_load(accumulator) != ws_load(proposal + 6u)
        || coarse_load(accumulator + 1u) != local_contribution_count
        || !measured_close(mass, frozen_mass, state_contribution_count)
        || !finite_f32(local_heat) || local_heat < 0.0
        || !finite_f32(causal_weight) || causal_weight < 0.0
        || !finite_f32(cross_level_pressure_compensation)
        || !finite_f32(cross_level_drag_heat)
        || cross_level_drag_heat < 0.0
        || !all(vec3<bool>(
          finite_f32(ambient_impulse.x),
          finite_f32(ambient_impulse.y),
          finite_f32(ambient_impulse.z)
        ))
        || !finite_f32(ambient_external_work)
        || !finite_f32(delta_energy) || !finite_f32(prior_virtual_energy)
        || !all(vec3<bool>(
          finite_f32(future.x), finite_f32(future.y), finite_f32(future.z)
        ))) {
      ws_reject(STATUS_INVALID_REGISTRY | STATUS_NONFINITE, 87u);
      reflux_reject(REFLUX_KEY_REJECTED | REFLUX_NONFINITE);
      return;
    }
    let position = parent_node_position(parent);
    let angular = cross(position, impulse);
    let cfl_ratio = length(future) * params.macro_dt
      / (params.cfl_factor * params.coarse_spacing_m);
    let next_coarse_energy = actual_coarse_energy + delta_energy;
    let next_actual_energy_sum_abs = actual_coarse_energy_sum_abs
      + abs(delta_energy);
    let next_virtual_energy = virtual_coarse_energy + prior_virtual_energy;
    let next_virtual_sum_abs = virtual_energy_sum_abs
      + abs(prior_virtual_energy);
    let next_local_heat = local_heat_sum + local_heat;
    let next_causal_weight = causal_weight_sum + causal_weight;
    let next_local_pressure_internal_compensation_sum_abs =
      local_pressure_internal_compensation_sum_abs
        + abs(pressure_internal_compensation);
    let next_coarse_pressure_compensation =
      coarse_pressure_compensation_sum
        + cross_level_pressure_compensation;
    let next_coarse_drag_heat =
      coarse_drag_heat_sum + cross_level_drag_heat;
    let next_local_ambient_impulse =
      local_ambient_impulse_sum + ambient_impulse;
    let next_local_ambient_impulse_sum_abs =
      local_ambient_impulse_sum_abs + abs(ambient_impulse);
    let next_local_ambient_external_work =
      local_ambient_external_work_sum + ambient_external_work;
    let next_local_ambient_external_work_sum_abs =
      local_ambient_external_work_sum_abs + abs(ambient_external_work);
    if (!all(vec3<bool>(
        finite_f32(position.x), finite_f32(position.y), finite_f32(position.z)
      )) || !all(vec3<bool>(
        finite_f32(angular.x), finite_f32(angular.y), finite_f32(angular.z)
      )) || !finite_f32(cfl_ratio) || cfl_ratio < 0.0
        || !finite_f32(next_coarse_energy)
        || !finite_f32(next_actual_energy_sum_abs)
        || !finite_f32(next_virtual_energy)
        || !finite_f32(next_virtual_sum_abs)
        || !finite_f32(next_local_heat) || next_local_heat < 0.0
        || !finite_f32(pressure_internal_compensation)
        || !finite_f32(
          local_pressure_internal_compensation_sum
            + pressure_internal_compensation
        )
        || !finite_f32(next_local_pressure_internal_compensation_sum_abs)
        || next_local_pressure_internal_compensation_sum_abs < 0.0
        || !finite_f32(next_causal_weight) || next_causal_weight < 0.0
        || !finite_f32(next_coarse_pressure_compensation)
        || !finite_f32(next_coarse_drag_heat)
        || next_coarse_drag_heat < 0.0
        || !all(vec3<bool>(
          finite_f32(next_local_ambient_impulse.x),
          finite_f32(next_local_ambient_impulse.y),
          finite_f32(next_local_ambient_impulse.z)
        ))
        || !all(vec3<bool>(
          finite_f32(next_local_ambient_impulse_sum_abs.x),
          finite_f32(next_local_ambient_impulse_sum_abs.y),
          finite_f32(next_local_ambient_impulse_sum_abs.z)
        ))
        || !finite_f32(next_local_ambient_external_work)
        || !finite_f32(next_local_ambient_external_work_sum_abs)
        || next_local_ambient_external_work_sum_abs < 0.0) {
      ws_reject(STATUS_NONFINITE, 39u);
      reflux_reject(REFLUX_NONFINITE);
      return;
    }
    actual_coarse_impulse = actual_coarse_impulse + impulse;
    actual_coarse_angular = actual_coarse_angular + angular;
    actual_coarse_energy = next_coarse_energy;
    actual_coarse_energy_sum_abs = next_actual_energy_sum_abs;
    virtual_coarse_energy = next_virtual_energy;
    virtual_energy_sum_abs = next_virtual_sum_abs;
    local_heat_sum = next_local_heat;
    local_pressure_internal_compensation_sum =
      local_pressure_internal_compensation_sum
        + pressure_internal_compensation;
    local_pressure_internal_compensation_sum_abs =
      next_local_pressure_internal_compensation_sum_abs;
    causal_weight_sum = next_causal_weight;
    coarse_pressure_compensation_sum =
      next_coarse_pressure_compensation;
    coarse_drag_heat_sum = next_coarse_drag_heat;
    local_ambient_impulse_sum = next_local_ambient_impulse;
    local_ambient_impulse_sum_abs =
      next_local_ambient_impulse_sum_abs;
    local_ambient_external_work_sum =
      next_local_ambient_external_work;
    local_ambient_external_work_sum_abs =
      next_local_ambient_external_work_sum_abs;
    max_coarse_cfl = max(max_coarse_cfl, cfl_ratio);
    max_specific_heat = max(max_specific_heat, local_heat / mass);
    momentum_sum_abs = momentum_sum_abs + abs(impulse.x)
      + abs(impulse.y) + abs(impulse.z);
    angular_sum_abs = angular_sum_abs + abs(angular.x)
      + abs(angular.y) + abs(angular.z);
    let mass_delta = mass - frozen_mass;
    terminal_mass_residual = terminal_mass_residual + mass_delta;
    terminal_mass_sum_abs = terminal_mass_sum_abs
      + abs(mass) + abs(frozen_mass);
    terminal_moment_residual = terminal_moment_residual
      + mass_delta * position;
    terminal_moment_sum_abs = terminal_moment_sum_abs
      + (abs(mass) + abs(frozen_mass))
        * (abs(position.x) + abs(position.y) + abs(position.z));
  }
  let receipt = coarse_receipt_offset();
  let receipt_heat = bitcast<f32>(coarse_load(receipt + 8u));
  let published_heat = bitcast<f32>(coarse_load(receipt + 9u));
  let receipt_pressure_internal_compensation =
    bitcast<f32>(coarse_load(receipt + 16u));
  let published_pressure_internal_compensation =
    bitcast<f32>(coarse_load(receipt + 17u));
  let receipt_max_specific = bitcast<f32>(coarse_load(receipt + 11u));
  let fine_cross_level_pressure_compensation =
    bitcast<f32>(reflux_load(128u));
  let coarse_cross_level_pressure_compensation =
    bitcast<f32>(reflux_load(129u));
  let fine_cross_level_drag_heat = bitcast<f32>(reflux_load(130u));
  let coarse_cross_level_drag_heat = bitcast<f32>(reflux_load(131u));
  let receipt_ambient_impulse = vec3<f32>(
    bitcast<f32>(coarse_load(receipt + 20u)),
    bitcast<f32>(coarse_load(receipt + 21u)),
    bitcast<f32>(coarse_load(receipt + 22u))
  );
  let receipt_ambient_external_work =
    bitcast<f32>(coarse_load(receipt + 23u));
  let coarse_signed_reduction_count = independent_reduction_operation_count(
    ws_load(22u)
  );
  if (local_contribution_sum != coarse_load(receipt + 7u)
      || !measured_close(
        local_heat_sum, receipt_heat, local_contribution_sum
      ) || !measured_close(
        receipt_heat, published_heat, local_contribution_sum
      ) || !measured_conditioned_close(
        local_pressure_internal_compensation_sum,
        receipt_pressure_internal_compensation,
        local_pressure_internal_compensation_sum_abs,
        coarse_signed_reduction_count
      ) || !measured_close(
        receipt_pressure_internal_compensation,
        published_pressure_internal_compensation,
        state_contribution_sum
      ) || !measured_close(
        max_specific_heat, receipt_max_specific, local_contribution_sum
      ) || !finite_f32(fine_cross_level_pressure_compensation)
      || !finite_f32(coarse_cross_level_pressure_compensation)
      || !finite_f32(fine_cross_level_drag_heat)
      || fine_cross_level_drag_heat < 0.0
      || !finite_f32(coarse_cross_level_drag_heat)
      || coarse_cross_level_drag_heat < 0.0
      || bitcast<u32>(coarse_pressure_compensation_sum)
        != bitcast<u32>(coarse_cross_level_pressure_compensation)
      || !measured_close(
        coarse_drag_heat_sum,
        coarse_cross_level_drag_heat,
        state_contribution_sum
      ) || !all(vec3<bool>(
        finite_f32(receipt_ambient_impulse.x),
        finite_f32(receipt_ambient_impulse.y),
        finite_f32(receipt_ambient_impulse.z)
      ))
      || !finite_f32(receipt_ambient_external_work)
      || !measured_conditioned_close(
        local_ambient_impulse_sum.x,
        receipt_ambient_impulse.x,
        local_ambient_impulse_sum_abs.x,
        coarse_signed_reduction_count
      ) || !measured_conditioned_close(
        local_ambient_impulse_sum.y,
        receipt_ambient_impulse.y,
        local_ambient_impulse_sum_abs.y,
        coarse_signed_reduction_count
      ) || !measured_conditioned_close(
        local_ambient_impulse_sum.z,
        receipt_ambient_impulse.z,
        local_ambient_impulse_sum_abs.z,
        coarse_signed_reduction_count
      ) || !measured_conditioned_close(
        local_ambient_external_work_sum,
        receipt_ambient_external_work,
        local_ambient_external_work_sum_abs,
        coarse_signed_reduction_count
      )) {
    ws_reject(STATUS_ENERGY_REJECTED | STATUS_INVALID_SOURCE, 86u);
    reflux_reject(REFLUX_ENERGY_REJECTED | REFLUX_PHASE_REJECTED);
    return;
  }
  if (state_contribution_sum > 0xffffffffu - reflux_load(94u)) {
    ws_reject(STATUS_OVERFLOW, 38u);
    reflux_reject(REFLUX_OVERFLOW);
    return;
  }
  let next_measurement_count = reflux_load(94u) + state_contribution_sum;
  let next_mass_residual = bitcast<f32>(reflux_load(32u))
    + terminal_mass_residual;
  let next_mass_sum_abs = bitcast<f32>(reflux_load(85u))
    + terminal_mass_sum_abs;
  let next_moment_residual = vec3<f32>(
    bitcast<f32>(reflux_load(33u)), bitcast<f32>(reflux_load(34u)),
    bitcast<f32>(reflux_load(35u))
  ) + terminal_moment_residual;
  let next_moment_sum_abs = bitcast<f32>(reflux_load(86u))
    + terminal_moment_sum_abs;
  let mass_tolerance = measured_scale_tolerance(
    next_mass_sum_abs, next_measurement_count
  );
  let moment_tolerance = measured_scale_tolerance(
    next_moment_sum_abs, next_measurement_count
  );
  let momentum_residual = fine_impulse + actual_coarse_impulse;
  let angular_residual = fine_angular + actual_coarse_angular;
  let momentum_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * momentum_sum_abs
  );
  let angular_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * angular_sum_abs
  );
  let fine_energy = bitcast<f32>(reflux_load(28u));
  let recorded_virtual_coarse_energy = bitcast<f32>(reflux_load(29u));
  let cross_level_pressure_compensation =
    fine_cross_level_pressure_compensation
      + coarse_cross_level_pressure_compensation;
  let cross_level_drag_heat =
    fine_cross_level_drag_heat + coarse_cross_level_drag_heat;
  // Pressure work is reversible signed internal-energy exchange. Remove it
  // before classifying the remaining drag/causal kinetic change as heat.
  let causal_kinetic_residual = fine_energy + virtual_coarse_energy
    + cross_level_pressure_compensation;
  let actual_kinetic_residual = fine_energy + actual_coarse_energy
    + cross_level_pressure_compensation;
  // The terminal coarse field lives at macro time while every frozen virtual
  // row was evaluated at its fine predictor theta. Their signed difference is
  // operator-split synchronization work, not dissipative reflux heat.
  let synchronization_work = actual_coarse_energy - virtual_coarse_energy;
  let synchronization_conditioning_sum_abs =
    actual_coarse_energy_sum_abs + virtual_energy_sum_abs;
  let synchronization_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8
      * synchronization_conditioning_sum_abs
  );
  let terminal_receipt = coarse_receipt_offset();
  let next_terminal_ambient_impulse = vec3<f32>(
    bitcast<f32>(reflux_load(132u)),
    bitcast<f32>(reflux_load(133u)),
    bitcast<f32>(reflux_load(134u))
  ) + vec3<f32>(
    bitcast<f32>(coarse_load(terminal_receipt + 20u)),
    bitcast<f32>(coarse_load(terminal_receipt + 21u)),
    bitcast<f32>(coarse_load(terminal_receipt + 22u))
  );
  let next_terminal_ambient_external_work =
    bitcast<f32>(reflux_load(135u))
      + bitcast<f32>(coarse_load(terminal_receipt + 23u));
  if (!all(vec3<bool>(
      finite_f32(next_terminal_ambient_impulse.x),
      finite_f32(next_terminal_ambient_impulse.y),
      finite_f32(next_terminal_ambient_impulse.z)
    )) || !finite_f32(next_terminal_ambient_external_work)) {
    ws_reject(STATUS_ENERGY_REJECTED | STATUS_NONFINITE, 86u);
    reflux_reject(REFLUX_ENERGY_REJECTED | REFLUX_NONFINITE);
    return;
  }
  let causal_energy_sum_abs = abs(fine_energy) + virtual_energy_sum_abs
    + abs(fine_cross_level_pressure_compensation)
    + abs(coarse_cross_level_pressure_compensation);
  let causal_energy_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * causal_energy_sum_abs
  );
  let fine_route_heat = bitcast<f32>(reflux_load(112u));
  let causal_route_heat = max(0.0, -causal_kinetic_residual);
  let deferred_unclamped = causal_route_heat - fine_route_heat;
  var deferred_route_heat = max(0.0, deferred_unclamped);
  var coarse_causal_route_heat = max(
    0.0,
    deferred_route_heat - coarse_cross_level_drag_heat
  );
  if (coarse_causal_route_heat <= causal_energy_tolerance
      && !(causal_weight_sum > 0.0)) {
    coarse_causal_route_heat = 0.0;
    // Preserve the independently accumulated mandatory drag subset exactly;
    // the resulting closure perturbation is already bounded by tolerance.
    deferred_route_heat = coarse_cross_level_drag_heat;
  }
  let total_route_heat = fine_route_heat + deferred_route_heat;
  let causal_energy_residual = causal_kinetic_residual + total_route_heat;
  let energy_sum_abs = abs(fine_energy) + actual_coarse_energy_sum_abs
    + abs(fine_cross_level_pressure_compensation)
    + abs(coarse_cross_level_pressure_compensation)
    + abs(total_route_heat) + abs(synchronization_work);
  let energy_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * energy_sum_abs
  );
  let total_energy_residual = actual_kinetic_residual + total_route_heat
    - synchronization_work;
  let next_local_heat = bitcast<f32>(reflux_load(116u))
    + local_heat_sum;
  let mass_ok = abs(next_mass_residual) <= mass_tolerance
    && max(abs(next_moment_residual.x), max(
      abs(next_moment_residual.y), abs(next_moment_residual.z)
    )) <= moment_tolerance;
  let momentum_ok = max(abs(momentum_residual.x), max(
    abs(momentum_residual.y), abs(momentum_residual.z)
  )) <= momentum_tolerance && max(
    abs(actual_coarse_impulse.x - recorded_coarse_impulse.x), max(
      abs(actual_coarse_impulse.y - recorded_coarse_impulse.y),
      abs(actual_coarse_impulse.z - recorded_coarse_impulse.z)
    )
  ) <= momentum_tolerance;
  let angular_ok = max(abs(angular_residual.x), max(
    abs(angular_residual.y), abs(angular_residual.z)
  )) <= angular_tolerance && max(
    abs(actual_coarse_angular.x - recorded_coarse_angular.x), max(
      abs(actual_coarse_angular.y - recorded_coarse_angular.y),
      abs(actual_coarse_angular.z - recorded_coarse_angular.z)
    )
  ) <= angular_tolerance;
  let energy_ok = causal_kinetic_residual <= causal_energy_tolerance
    && deferred_unclamped >= -causal_energy_tolerance
    && fine_cross_level_drag_heat
      <= fine_route_heat + causal_energy_tolerance
    && coarse_cross_level_drag_heat
      <= deferred_route_heat + causal_energy_tolerance
    && cross_level_drag_heat
      <= total_route_heat + causal_energy_tolerance
    && abs(causal_energy_residual) <= causal_energy_tolerance
    && abs(total_energy_residual) <= energy_tolerance
    && abs(synchronization_work)
      <= synchronization_conditioning_sum_abs + synchronization_tolerance
    && abs(
      recorded_virtual_coarse_energy - virtual_coarse_energy
    ) <= max(
      8.0 * 1.175494351e-38,
      1024.0 * 5.960464477539063e-8
        * (abs(recorded_virtual_coarse_energy) + virtual_energy_sum_abs)
    );
  if (!finite_f32(next_mass_residual)
      || !finite_f32(next_mass_sum_abs) || next_mass_sum_abs < 0.0
      || !all(vec3<bool>(
        finite_f32(next_moment_residual.x),
        finite_f32(next_moment_residual.y),
        finite_f32(next_moment_residual.z)
      )) || !finite_f32(next_moment_sum_abs)
      || next_moment_sum_abs < 0.0
      || !all(vec3<bool>(
        finite_f32(momentum_residual.x),
        finite_f32(momentum_residual.y),
        finite_f32(momentum_residual.z)
      )) || !all(vec3<bool>(
        finite_f32(angular_residual.x),
        finite_f32(angular_residual.y),
        finite_f32(angular_residual.z)
      )) || !finite_f32(total_route_heat) || total_route_heat < 0.0
      || !finite_f32(deferred_route_heat) || deferred_route_heat < 0.0
      || !finite_f32(next_local_heat) || next_local_heat < 0.0
      || !finite_f32(max_specific_heat) || max_specific_heat < 0.0
      || !finite_f32(max_coarse_cfl) || max_coarse_cfl < 0.0
      || !finite_f32(momentum_sum_abs) || momentum_sum_abs < 0.0
      || !finite_f32(angular_sum_abs) || angular_sum_abs < 0.0
      || !finite_f32(actual_coarse_energy_sum_abs)
      || actual_coarse_energy_sum_abs < 0.0
      || !finite_f32(recorded_virtual_coarse_energy)
      || !finite_f32(cross_level_pressure_compensation)
      || !finite_f32(cross_level_drag_heat)
      || cross_level_drag_heat < 0.0
      || !finite_f32(causal_kinetic_residual)
      || !finite_f32(causal_energy_residual)
      || !finite_f32(actual_kinetic_residual)
      || !finite_f32(coarse_causal_route_heat)
      || coarse_causal_route_heat < 0.0
      || !finite_f32(synchronization_work)
      || !finite_f32(synchronization_conditioning_sum_abs)
      || synchronization_conditioning_sum_abs < 0.0
      || !finite_f32(synchronization_tolerance)
      || synchronization_tolerance < 0.0
      || !finite_f32(causal_energy_sum_abs) || causal_energy_sum_abs < 0.0
      || !finite_f32(causal_energy_tolerance)
      || causal_energy_tolerance < 0.0
      || !finite_f32(energy_sum_abs) || energy_sum_abs < 0.0
      || !finite_f32(mass_tolerance) || mass_tolerance < 0.0
      || !finite_f32(moment_tolerance) || moment_tolerance < 0.0
      || !finite_f32(momentum_tolerance) || momentum_tolerance < 0.0
      || !finite_f32(angular_tolerance) || angular_tolerance < 0.0
      || !finite_f32(energy_tolerance) || energy_tolerance < 0.0
      || max_coarse_cfl > ROUTE_CFL_PHYSICAL_AUDIT_FACTOR
      || !mass_ok || !momentum_ok || !angular_ok || !energy_ok
      || (coarse_causal_route_heat > causal_energy_tolerance
        && !(causal_weight_sum > 0.0))) {
    ws_reject(
      STATUS_NONFINITE | select(0u, STATUS_INVALID_REGISTRY, !mass_ok)
        | select(0u, STATUS_INVALID_ROUTE, !momentum_ok || !angular_ok)
        | select(0u, STATUS_ENERGY_REJECTED, !energy_ok),
      86u
    );
    reflux_reject(
      REFLUX_NONFINITE | select(0u, REFLUX_KEY_REJECTED, !mass_ok)
        | select(0u, REFLUX_ROUTE_REJECTED, !momentum_ok || !angular_ok)
        | select(0u, REFLUX_ENERGY_REJECTED, !energy_ok)
    );
    return;
  }
  fine_stage_store(0u, bitcast<u32>(actual_coarse_energy));
  fine_stage_store(1u, bitcast<u32>(total_route_heat));
  fine_stage_store(2u, bitcast<u32>(deferred_route_heat));
  fine_stage_store(3u, bitcast<u32>(next_local_heat));
  fine_stage_store(4u, bitcast<u32>(local_heat_sum));
  fine_stage_store(5u, local_contribution_sum);
  fine_stage_store(6u, bitcast<u32>(max_specific_heat));
  fine_stage_store(7u, bitcast<u32>(max_coarse_cfl));
  fine_stage_store(8u, bitcast<u32>(next_mass_residual));
  fine_stage_store(9u, bitcast<u32>(next_mass_sum_abs));
  fine_stage_store(10u, bitcast<u32>(next_moment_residual.x));
  fine_stage_store(11u, bitcast<u32>(next_moment_residual.y));
  fine_stage_store(12u, bitcast<u32>(next_moment_residual.z));
  fine_stage_store(13u, bitcast<u32>(next_moment_sum_abs));
  fine_stage_store(14u, bitcast<u32>(abs(momentum_residual.x)));
  fine_stage_store(15u, bitcast<u32>(abs(momentum_residual.y)));
  fine_stage_store(16u, bitcast<u32>(abs(momentum_residual.z)));
  fine_stage_store(17u, bitcast<u32>(abs(angular_residual.x)));
  fine_stage_store(18u, bitcast<u32>(abs(angular_residual.y)));
  fine_stage_store(19u, bitcast<u32>(abs(angular_residual.z)));
  fine_stage_store(20u, bitcast<u32>(momentum_tolerance));
  fine_stage_store(21u, bitcast<u32>(angular_tolerance));
  fine_stage_store(22u, bitcast<u32>(abs(total_energy_residual)));
  fine_stage_store(23u, bitcast<u32>(energy_tolerance));
  // Slots 24/25 are dead after terminal mass/moment admission and carry the
  // authenticated temporal synchronization evidence to persistent commit.
  fine_stage_store(24u, bitcast<u32>(synchronization_work));
  fine_stage_store(
    25u, bitcast<u32>(synchronization_conditioning_sum_abs)
  );
  fine_stage_store(26u, 0u);
  fine_stage_store(27u, next_measurement_count);
  fine_stage_store(28u, ordinal + 2u);
  fine_stage_store(29u, ws_load(22u));
  fine_stage_store(30u, bitcast<u32>(energy_sum_abs));
  fine_stage_store(31u, bitcast<u32>(causal_weight_sum));
  // Seal the remaining measured scales in row-zero scratch. Per-row state and
  // local counts are no longer needed after this serial seal.
  ws_store(params.route_proposal_offset + 5u, bitcast<u32>(momentum_sum_abs));
  ws_store(params.route_proposal_offset + 6u, bitcast<u32>(angular_sum_abs));
  // The row-zero pressure/drag impulse decomposition is dead after terminal
  // validation. Seal the cumulative ambient header before any field claim.
  ws_store(
    params.route_proposal_offset + 8u,
    bitcast<u32>(next_terminal_ambient_impulse.x)
  );
  ws_store(
    params.route_proposal_offset + 9u,
    bitcast<u32>(next_terminal_ambient_impulse.y)
  );
  ws_store(
    params.route_proposal_offset + 10u,
    bitcast<u32>(next_terminal_ambient_impulse.z)
  );
  ws_store(
    params.route_proposal_offset + 11u,
    bitcast<u32>(next_terminal_ambient_external_work)
  );
}

@compute @workgroup_size(1)
fn prepare_coarse_transaction() {
  if (!workspace_admitted(PHASE_PREDICTORS) || !reflux_accumulating()
      || fine_stage_load(29u) != ws_load(22u)
      || reflux_load(111u) != params.fine_substep_count + 1u) { return; }
  let deferred_heat = bitcast<f32>(fine_stage_load(2u));
  let weight_sum = bitcast<f32>(fine_stage_load(31u));
  let energy_tolerance = bitcast<f32>(fine_stage_load(23u));
  let coarse_drag_heat = bitcast<f32>(reflux_load(131u));
  let coarse_causal_heat_unclamped = deferred_heat - coarse_drag_heat;
  let coarse_causal_heat = max(0.0, coarse_causal_heat_unclamped);
  let synchronization_work = bitcast<f32>(fine_stage_load(24u));
  let synchronization_conditioning_sum_abs = bitcast<f32>(
    fine_stage_load(25u)
  );
  let synchronization_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8
      * synchronization_conditioning_sum_abs
  );
  var last_weighted = INVALID_INDEX;
  for (var coarse_field = 0u; coarse_field < ws_load(22u); coarse_field = coarse_field + 1u) {
    let weight = bitcast<f32>(reflux_load(reflux_row(coarse_field) + 15u));
    if (weight > 0.0) { last_weighted = coarse_field; }
  }
  if (!finite_f32(coarse_drag_heat) || coarse_drag_heat < 0.0
      || !finite_f32(coarse_causal_heat_unclamped)
      || coarse_causal_heat_unclamped < -energy_tolerance
      || !finite_f32(coarse_causal_heat)
      || coarse_causal_heat < 0.0
      || (coarse_causal_heat > energy_tolerance
        && last_weighted == INVALID_INDEX)) {
    ws_reject(STATUS_ENERGY_REJECTED | STATUS_INVALID_ROUTE, 86u);
    reflux_reject(REFLUX_ENERGY_REJECTED | REFLUX_ROUTE_REJECTED);
    return;
  }
  var assigned_causal_heat = 0.0;
  var assigned_drag_heat = 0.0;
  var assigned_total_heat = 0.0;
  var future_pressure_compensation_sum = 0.0;
  var future_pressure_compensation_sum_abs = 0.0;
  var published_energy_sum_abs = abs(bitcast<f32>(reflux_load(28u)));
  var minimum_positive = bitcast<f32>(0x7f7fffffu);
  for (var coarse_field = 0u; coarse_field < ws_load(22u); coarse_field = coarse_field + 1u) {
    let proposal = params.route_proposal_offset
      + coarse_field * ROUTE_WORDS;
    let row = reflux_row(coarse_field);
    let actual_delta_energy = bitcast<f32>(ws_load(proposal + 3u));
    let weight = bitcast<f32>(reflux_load(row + 15u));
    let pressure_compensation = bitcast<f32>(reflux_load(row + 16u));
    let drag_heat = bitcast<f32>(reflux_load(row + 17u));
    let accumulator = coarse_load(28u)
      + coarse_field * FIELD_ACCUMULATOR_WORDS;
    let local_pressure_compensation =
      bitcast<f32>(coarse_load(accumulator + 3u));
    var causal_share = 0.0;
    if (coarse_causal_heat > 0.0 && weight > 0.0 && weight_sum > 0.0) {
      let remaining = max(
        0.0,
        coarse_causal_heat - assigned_causal_heat
      );
      causal_share = select(
        min(coarse_causal_heat * weight / weight_sum, remaining),
        remaining,
        coarse_field == last_weighted
      );
    }
    let share = drag_heat + causal_share;
    let future_pressure_compensation =
      local_pressure_compensation + pressure_compensation;
    let next_assigned_causal_heat =
      assigned_causal_heat + causal_share;
    let next_assigned_drag_heat = assigned_drag_heat + drag_heat;
    let next_assigned_total_heat = assigned_total_heat + share;
    let next_future_pressure_compensation_sum =
      future_pressure_compensation_sum + future_pressure_compensation;
    let next_future_pressure_compensation_sum_abs =
      future_pressure_compensation_sum_abs
        + abs(local_pressure_compensation)
        + abs(pressure_compensation);
    if (!finite_f32(causal_share) || causal_share < 0.0
        || !finite_f32(drag_heat) || drag_heat < 0.0
        || !finite_f32(share) || share < 0.0
        || !finite_f32(pressure_compensation)
        || !finite_f32(local_pressure_compensation)
        || !finite_f32(future_pressure_compensation)
        || !finite_f32(next_assigned_causal_heat)
        || !finite_f32(next_assigned_drag_heat)
        || !finite_f32(next_assigned_total_heat)
        || !finite_f32(next_future_pressure_compensation_sum)
        || !finite_f32(next_future_pressure_compensation_sum_abs)
        || next_future_pressure_compensation_sum_abs < 0.0
        || next_assigned_causal_heat
          > coarse_causal_heat + energy_tolerance
        || next_assigned_drag_heat
          > coarse_drag_heat + energy_tolerance
        || next_assigned_total_heat
          > deferred_heat + energy_tolerance) {
      ws_reject(STATUS_ENERGY_REJECTED | STATUS_NONFINITE, 86u);
      reflux_reject(REFLUX_ENERGY_REJECTED | REFLUX_NONFINITE);
      return;
    }
    ws_store(proposal + 4u, bitcast<u32>(share));
    // The post-claim field apply is store-only. Preserve the exact future
    // pressure sidecar now, while every reject path is still transactional.
    ws_store(
      proposal + 14u,
      bitcast<u32>(future_pressure_compensation)
    );
    assigned_causal_heat = next_assigned_causal_heat;
    assigned_drag_heat = next_assigned_drag_heat;
    assigned_total_heat = next_assigned_total_heat;
    future_pressure_compensation_sum =
      next_future_pressure_compensation_sum;
    future_pressure_compensation_sum_abs =
      next_future_pressure_compensation_sum_abs;
    published_energy_sum_abs = published_energy_sum_abs
      + abs(actual_delta_energy);
    if (share > 0.0) { minimum_positive = min(minimum_positive, share); }
  }
  if (abs(assigned_causal_heat - coarse_causal_heat) > energy_tolerance
      || abs(assigned_drag_heat - coarse_drag_heat) > energy_tolerance
      || abs(assigned_total_heat - deferred_heat) > energy_tolerance) {
    ws_reject(STATUS_ENERGY_REJECTED, 86u);
    reflux_reject(REFLUX_ENERGY_REJECTED);
    return;
  }
  let prior_published_pressure_compensation = bitcast<f32>(
    coarse_load(coarse_receipt_offset() + 17u)
  );
  let expected_future_pressure_compensation =
    prior_published_pressure_compensation
      + bitcast<f32>(reflux_load(129u));
  let future_pressure_reassociation_count =
    independent_reduction_operation_count(
      min(ws_load(22u), 0x7fffffffu) * 2u
    );
  if (!finite_f32(prior_published_pressure_compensation)
      || !finite_f32(expected_future_pressure_compensation)
      || !measured_conditioned_close(
        future_pressure_compensation_sum,
        expected_future_pressure_compensation,
        future_pressure_compensation_sum_abs,
        future_pressure_reassociation_count
      )) {
    ws_reject(STATUS_ENERGY_REJECTED | STATUS_NONFINITE, 86u);
    reflux_reject(REFLUX_ENERGY_REJECTED | REFLUX_NONFINITE);
    return;
  }
  // Row-zero word15 is terminal-only scratch after all per-row transport
  // evidence has moved to the persistent reflux ledger.
  ws_store(
    params.route_proposal_offset + 15u,
    bitcast<u32>(future_pressure_compensation_sum)
  );
  let fine_route_heat = bitcast<f32>(reflux_load(112u));
  let published_total_heat = fine_route_heat + assigned_total_heat;
  let pressure_compensation = bitcast<f32>(reflux_load(128u))
    + bitcast<f32>(reflux_load(129u));
  let kinetic_residual = bitcast<f32>(reflux_load(28u))
    + bitcast<f32>(fine_stage_load(0u))
    + pressure_compensation;
  let published_residual = kinetic_residual + published_total_heat
    - synchronization_work;
  published_energy_sum_abs = published_energy_sum_abs
    + abs(bitcast<f32>(reflux_load(128u)))
    + abs(bitcast<f32>(reflux_load(129u)))
    + abs(published_total_heat) + abs(synchronization_work);
  let published_energy_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * published_energy_sum_abs
  );
  if (!finite_f32(assigned_causal_heat)
      || assigned_causal_heat < 0.0
      || !finite_f32(assigned_drag_heat) || assigned_drag_heat < 0.0
      || !finite_f32(assigned_total_heat) || assigned_total_heat < 0.0
      || !finite_f32(published_total_heat) || published_total_heat < 0.0
      || !finite_f32(pressure_compensation)
      || !finite_f32(kinetic_residual)
      || !finite_f32(published_residual)
      || !finite_f32(synchronization_work)
      || !finite_f32(synchronization_conditioning_sum_abs)
      || synchronization_conditioning_sum_abs < 0.0
      || !finite_f32(synchronization_tolerance)
      || synchronization_tolerance < 0.0
      || abs(synchronization_work)
        > synchronization_conditioning_sum_abs + synchronization_tolerance
      || !finite_f32(published_energy_sum_abs)
      || published_energy_sum_abs < 0.0
      || !finite_f32(published_energy_tolerance)
      || published_energy_tolerance < 0.0
      || abs(published_residual) > published_energy_tolerance) {
    ws_reject(STATUS_ENERGY_REJECTED | STATUS_NONFINITE, 86u);
    reflux_reject(REFLUX_ENERGY_REJECTED | REFLUX_NONFINITE);
    return;
  }
  // Derive every published energy word from the actual staged row8 sum.
  fine_stage_store(1u, bitcast<u32>(published_total_heat));
  fine_stage_store(2u, bitcast<u32>(assigned_total_heat));
  fine_stage_store(22u, bitcast<u32>(abs(published_residual)));
  fine_stage_store(23u, bitcast<u32>(published_energy_tolerance));
  fine_stage_store(30u, bitcast<u32>(published_energy_sum_abs));
  fine_stage_store(
    26u,
    bitcast<u32>(select(
      0.0,
      minimum_positive,
      assigned_total_heat > 0.0
    ))
  );
  // Preserve the independently accumulated row sum for the final preclaim
  // gate; H113 is published from the same staged value.
  fine_stage_store(31u, bitcast<u32>(assigned_total_heat));
  // A begin pass may claim the field only after every future persistent word
  // and every row-local heat share has been sealed.
  ws_store(67u, params.fine_substep_count + 1u);
}

@compute @workgroup_size(1)
fn begin_coarse_velocity_publish() {
  if (!workspace_admitted(PHASE_PREDICTORS) || !reflux_accumulating()
      || ws_load(67u) != params.fine_substep_count + 1u
      || fine_stage_load(29u) != ws_load(22u)
      || fine_stage_load(31u) != fine_stage_load(2u)
      || !coarse_admitted(
        FIELD_VELOCITY, params.coarse_publish_expected_mutation_ordinal
      ) || !coarse_receipt_admitted(
        FIELD_RECEIPT_HEAT_BUILDING,
        params.coarse_publish_expected_mutation_ordinal
      )) {
    ws_reject(STATUS_INVALID_SOURCE, 37u);
    reflux_reject(REFLUX_PHASE_REJECTED);
    return;
  }
  loop {
    let claimed = atomicCompareExchangeWeak(
      &coarse_view[63u],
      params.coarse_publish_expected_mutation_ordinal,
      params.coarse_publish_output_mutation_ordinal
    );
    if (claimed.exchanged) { break; }
    if (claimed.old_value
        != params.coarse_publish_expected_mutation_ordinal) {
      ws_reject(STATUS_INVALID_SOURCE, 37u);
      reflux_reject(REFLUX_PHASE_REJECTED);
      return;
    }
  }
  coarse_store(
    coarse_receipt_offset() + 5u,
    params.coarse_publish_output_mutation_ordinal
  );
  coarse_store(59u, FIELD_EMPTY);
  // The post-CAS passes depend only on this immutable workspace claim token,
  // never on mutable persistent guards that could strand the field EMPTY.
  ws_store(68u, params.fine_substep_count + 2u);
}

@compute @workgroup_size(1)
fn commit_coarse_reflux() {
  if (!workspace_admitted(PHASE_PREDICTORS)
      || ws_load(68u) != params.fine_substep_count + 2u) { return; }
  reflux_store(29u, fine_stage_load(0u));
  reflux_store(30u, fine_stage_load(1u));
  reflux_store(31u, fine_stage_load(22u));
  reflux_store(32u, fine_stage_load(8u));
  reflux_store(33u, fine_stage_load(10u));
  reflux_store(34u, fine_stage_load(11u));
  reflux_store(35u, fine_stage_load(12u));
  reflux_store(36u, fine_stage_load(14u));
  reflux_store(37u, fine_stage_load(15u));
  reflux_store(38u, fine_stage_load(16u));
  reflux_store(39u, fine_stage_load(17u));
  reflux_store(40u, fine_stage_load(18u));
  reflux_store(41u, fine_stage_load(19u));
  reflux_store(43u, fine_stage_load(7u));
  reflux_store(44u, fine_stage_load(26u));
  reflux_store(45u, fine_stage_load(20u));
  reflux_store(46u, fine_stage_load(21u));
  reflux_store(47u, fine_stage_load(23u));
  reflux_store(48u, 1u);
  reflux_store(49u, 1u);
  reflux_store(50u, 1u);
  reflux_store(51u, 1u);
  reflux_store(52u, 1u);
  reflux_store(53u, 1u);
  reflux_store(61u, params.coarse_publish_expected_mutation_ordinal);
  reflux_store(62u, params.coarse_publish_output_mutation_ordinal);
  reflux_store(63u, FIELD_VELOCITY);
  reflux_store(64u, params.generation_id);
  reflux_store(65u, params.device_ordinal);
  reflux_store(66u, params.lane_ordinal);
  reflux_store(67u, params.lease_token);
  reflux_store(68u, params.source_family_id);
  reflux_store(69u, params.storage_generation);
  reflux_store(70u, params.physics_tick);
  reflux_store(71u, params.physics_substep);
  reflux_store(72u, params.position_epoch);
  reflux_store(73u, params.topology_epoch);
  reflux_store(74u, params.chart_epoch);
  reflux_store(75u, params.level_epoch);
  reflux_store(76u, params.support_epoch);
  reflux_store(85u, fine_stage_load(9u));
  reflux_store(86u, fine_stage_load(13u));
  reflux_store(87u, ws_load(params.route_proposal_offset + 5u));
  reflux_store(88u, ws_load(params.route_proposal_offset + 6u));
  reflux_store(89u, fine_stage_load(30u));
  reflux_store(94u, fine_stage_load(27u));
  reflux_store(113u, fine_stage_load(2u));
  reflux_store(116u, fine_stage_load(3u));
  reflux_store(126u, fine_stage_load(24u));
  reflux_store(127u, fine_stage_load(25u));
  reflux_store(132u, ws_load(params.route_proposal_offset + 8u));
  reflux_store(133u, ws_load(params.route_proposal_offset + 9u));
  reflux_store(134u, ws_load(params.route_proposal_offset + 10u));
  reflux_store(135u, ws_load(params.route_proposal_offset + 11u));
  // Header evidence is staged after both physical store passes. Finalize owns
  // the persistent operation-count commit and publication words.
  ws_store(66u, params.fine_substep_count + 3u);
}

@compute @workgroup_size(64)
fn apply_coarse_reflux_rows(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let coarse_field = indirect_row_index(id, workgroup_count);
  if (!workspace_admitted(PHASE_PREDICTORS)
      || ws_load(68u) != params.fine_substep_count + 2u
      || coarse_field >= ws_load(22u)) { return; }
  let proposal = params.route_proposal_offset
    + coarse_field * ROUTE_WORDS;
  let row = reflux_row(coarse_field);
  reflux_store(row + 8u, ws_load(proposal + 4u));
  reflux_store(row + 9u, ws_load(proposal + 3u));
  reflux_store(row + 10u, reflux_load(row + 5u));
  reflux_store(row + 11u, reflux_load(row + 6u));
  reflux_store(row + 12u, reflux_load(row + 7u));
}

@compute @workgroup_size(64)
fn apply_coarse_velocity_publish(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let coarse_field = indirect_row_index(id, workgroup_count);
  if (!workspace_admitted(PHASE_PREDICTORS)
      || ws_load(68u) != params.fine_substep_count + 2u
      || coarse_field >= ws_load(22u)) { return; }
  let proposal = params.route_proposal_offset
    + coarse_field * ROUTE_WORDS;
  let state = coarse_load(30u) + coarse_field * FIELD_STATE_WORDS;
  let accumulator = coarse_load(28u)
    + coarse_field * FIELD_ACCUMULATOR_WORDS;
  coarse_store(state + 1u, ws_load(proposal));
  coarse_store(state + 2u, ws_load(proposal + 1u));
  coarse_store(state + 3u, ws_load(proposal + 2u));
  coarse_store(accumulator + 3u, ws_load(proposal + 14u));
}

@compute @workgroup_size(1)
fn finalize_coarse_velocity_publish() {
  if (!workspace_admitted(PHASE_PREDICTORS)
      || ws_load(68u) != params.fine_substep_count + 2u
      || ws_load(66u) != params.fine_substep_count + 3u) { return; }
  // The terminal coarse pressure receipt is authenticated by its own consumer,
  // the coarse G2P, which checks magic/version/status/law/count, the sealed
  // source ordinal, and the consumer masks. Re-validating it here against the
  // workspace's predictor ordinal and ambient is mis-specified: the pressure
  // rows were sealed by the coarse P2G at the pre-update ordinal, which the
  // terminal grid update has since advanced. Baseline gates nothing here.
  let receipt = coarse_receipt_offset();
  coarse_store(receipt + 4u, params.fine_substep_count);
  coarse_store(receipt + 6u, coarse_load(34u));
  coarse_store(receipt + 7u, fine_stage_load(5u));
  coarse_store(receipt + 8u, fine_stage_load(4u));
  coarse_store(receipt + 9u, fine_stage_load(4u));
  coarse_store(receipt + 10u, 0u);
  coarse_store(receipt + 11u, fine_stage_load(6u));
  coarse_store(receipt + 12u, params.macro_owner_generation);
  coarse_store(receipt + 13u, fine_stage_load(7u));
  coarse_store(receipt + 14u, reflux_load(90u));
  coarse_store(receipt + 15u, reflux_load(92u));
  coarse_store(
    receipt + 16u,
    ws_load(params.route_proposal_offset + 15u)
  );
  coarse_store(
    receipt + 17u,
    ws_load(params.route_proposal_offset + 15u)
  );
  coarse_store(59u, FIELD_VELOCITY);
  ws_store(47u, fine_stage_load(29u));
  ws_store(36u, PHASE_COARSE_COMPLETE);
  ws_store(59u, FIELD_VELOCITY);
  ws_store(70u, params.completion_ordinal);
  reflux_store(9u, fine_stage_load(29u));
  reflux_store(99u, 1u);
  reflux_store(111u, fine_stage_load(28u));
  // Captured operation count commits after row, field, and header stores.
  reflux_store(97u, params.fine_substep_count + 1u);
  reflux_store(59u, REFLUX_PHASE_ENERGY_READY);
  // The terminal field declares LOCAL as its sole pressure consumer. Its
  // coarse grid update has already claimed and consumed the immutable P2G
  // pressure receipt; terminal reflux publishes velocity/energy without
  // inventing a cross-level pressure consumer.
  // The field receipt phase is the globally last terminal publication word.
  coarse_store(receipt + 3u, FIELD_RECEIPT_ENERGY_READY);
}
`;
