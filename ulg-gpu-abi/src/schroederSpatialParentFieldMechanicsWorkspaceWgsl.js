import {
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ATOMIC_SCALE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_BINDING_ALIGNMENT_WORDS,
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
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_ENERGY_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_BUILDING,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
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
};

@group(0) @binding(0) var<storage, read> parent_view: array<u32>;
@group(0) @binding(1) var<storage, read_write> fine_view: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> coarse_view: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> workspace: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> reflux_ledger: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: ParentFieldMechanicsParams;
@group(0) @binding(11) var<storage, read_write> parent_to_coarse_ordinals: array<atomic<u32>>;
@group(0) @binding(12) var<storage, read_write> workspace_continuation: array<atomic<u32>>;

const WORKSPACE_MAGIC: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_MAGIC}u;
const WORKSPACE_VERSION: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_VERSION}u;
const WORKSPACE_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_WORDS}u;
const ROW_WORDS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROW_WORDS}u;
const ROUTE_WORDS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROUTE_WORDS}u;
const FINE_IMPULSE_WORDS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_FINE_IMPULSE_WORDS}u;
const WORKSPACE_BINDING_ALIGNMENT_WORDS: u32 = ${SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_BINDING_ALIGNMENT_WORDS}u;
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
const FIELD_RECEIPT_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC}u;
const FIELD_RECEIPT_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION}u;
const FIELD_RECEIPT_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED
}u;
const FIELD_RECEIPT_HEAT_BUILDING: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_BUILDING}u;
const FIELD_RECEIPT_ENERGY_READY: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_ENERGY_READY}u;
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

fn workspace_split_word() -> u32 {
  return params.combined_offset
    - params.combined_offset % WORKSPACE_BINDING_ALIGNMENT_WORDS;
}

fn workspace_ranges_admitted() -> bool {
  let split_word = workspace_split_word();
  if (params.required_words < split_word) { return false; }
  return arrayLength(&workspace) == split_word
    && arrayLength(&workspace_continuation)
      == params.required_words - split_word;
}

fn ws_load(word: u32) -> u32 {
  let split_word = workspace_split_word();
  if (word < split_word) {
    return atomicLoad(&workspace[word]);
  }
  return atomicLoad(&workspace_continuation[word - split_word]);
}

fn ws_store(word: u32, value: u32) {
  let split_word = workspace_split_word();
  if (word < split_word) {
    atomicStore(&workspace[word], value);
    return;
  }
  atomicStore(&workspace_continuation[word - split_word], value);
}

fn ws_atomic_add(word: u32, value: u32) -> u32 {
  let split_word = workspace_split_word();
  if (word < split_word) {
    return atomicAdd(&workspace[word], value);
  }
  return atomicAdd(&workspace_continuation[word - split_word], value);
}

fn ws_atomic_or(word: u32, value: u32) -> u32 {
  let split_word = workspace_split_word();
  if (word < split_word) {
    return atomicOr(&workspace[word], value);
  }
  return atomicOr(&workspace_continuation[word - split_word], value);
}

fn ws_compare_exchange_weak(
  word: u32,
  compare: u32,
  value: u32
) -> bool {
  let split_word = workspace_split_word();
  if (word < split_word) {
    return atomicCompareExchangeWeak(
      &workspace[word], compare, value
    ).exchanged;
  }
  return atomicCompareExchangeWeak(
    &workspace_continuation[word - split_word], compare, value
  ).exchanged;
}

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

fn indirect_row_index(
  id: vec3<u32>,
  workgroup_count: vec3<u32>
) -> u32 {
  return id.x + id.y * workgroup_count.x * 64u;
}

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= bitcast<f32>(0x7f7fffffu);
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
  ws_atomic_or(2u, STATUS_FAIL_CLOSED | STATUS_INVALID_SOURCE);
  ws_atomic_add(37u, 1u);
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
    if (attempts >= 256u) { return false; }
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
    if (attempts >= 256u) { return false; }
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
    if (attempts >= 256u) { return false; }
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
    if (ws_compare_exchange_weak(
      address, prior_bits, bitcast<u32>(next)
    )) { return true; }
    attempts = attempts + 1u;
    if (attempts >= 256u) { return false; }
  }
}

fn ws_atomic_min_nonnegative_f32(address: u32, value: f32) -> bool {
  if (!finite_f32(value) || value < 0.0) { return false; }
  var attempts = 0u;
  loop {
    let prior_bits = ws_load(address);
    let prior = bitcast<f32>(prior_bits);
    if (!finite_f32(prior) || prior <= value) { return finite_f32(prior); }
    if (ws_compare_exchange_weak(
      address, prior_bits, bitcast<u32>(value)
    )) { return true; }
    attempts = attempts + 1u;
    if (attempts >= 256u) { return false; }
  }
}

fn ws_atomic_max_nonnegative_f32(address: u32, value: f32) -> bool {
  if (!finite_f32(value) || value < 0.0) { return false; }
  var attempts = 0u;
  loop {
    let prior_bits = ws_load(address);
    let prior = bitcast<f32>(prior_bits);
    if (!finite_f32(prior) || prior >= value) { return finite_f32(prior); }
    if (ws_compare_exchange_weak(
      address, prior_bits, bitcast<u32>(value)
    )) { return true; }
    attempts = attempts + 1u;
    if (attempts >= 256u) { return false; }
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
  ws_atomic_or(2u, STATUS_FAIL_CLOSED | flags);
  if (counter_word < WORKSPACE_HEADER_WORDS) {
    ws_atomic_add(counter_word, 1u);
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
  if (active_required < state_offset) {
    mask = mask | (1u << 12u);
  } else {
    let active_gap = active_required - state_offset;
    if (active_gap % FIELD_STATE_WORDS != 0u
        || active_gap / FIELD_STATE_WORDS != active_count) {
      mask = mask | (1u << 12u);
    }
  }
  if (capacity_words < state_offset) {
    mask = mask | (1u << 13u);
  } else {
    let state_gap = capacity_words - state_offset;
    if (state_gap % FIELD_STATE_WORDS != 0u
        || state_gap / FIELD_STATE_WORDS != capacity) {
      mask = mask | (1u << 13u);
    }
  }
  if (active_count > capacity || active_required > capacity_words
      || capacity_words > words) {
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

fn workspace_admitted(phase: u32) -> bool {
  return workspace_ranges_admitted()
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
    && ws_load(30u) == params.required_words
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
  let old = bitcast<i32>(ws_atomic_add(address, bitcast<u32>(q.x)));
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
  ws_store(85u, bitcast<u32>(1.0));
  ws_store(28u, ROW_WORDS);
  ws_store(29u, params.required_words);
  ws_store(30u, params.required_words);
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
    || !workspace_ranges_admitted()
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
  ws_store(30u, params.required_words);
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
    || !workspace_ranges_admitted()
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
  let source_active = fine_load(source + 7u);
  let source_massive = source_values[0] > 0.0;
  var inactive_nonzero = false;
  if (!source_massive) {
    for (var word = 0u; word < 7u; word = word + 1u) {
      inactive_nonzero = inactive_nonzero || source_values[word] != 0.0;
    }
  }
  if (source_values[0] < 0.0 || source_active > 1u
      || (source_active == 1u) != source_massive || inactive_nonzero) {
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
    ws_atomic_add(destination + 7u, 1u);
    if (!valid) { ws_reject(STATUS_OVERFLOW, 38u); }
    ws_atomic_add(42u, 1u);
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
  if (active_flag != 0u) {
    ws_atomic_add(44u, 1u);
    ws_atomic_add(45u, 1u);
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
  let combined_was_active = ws_load(combined + 7u) != 0u;
  var source_values: array<f32, 7>;
  for (var word = 0u; word < 7u; word = word + 1u) {
    source_values[word] = bitcast<f32>(coarse_load(source + word));
    if (!finite_f32(source_values[word])) {
      ws_reject(STATUS_NONFINITE, 39u);
      return;
    }
  }
  let source_active = coarse_load(source + 7u);
  let source_massive = source_values[0] > 0.0;
  var inactive_nonzero = false;
  if (!source_massive) {
    for (var word = 0u; word < 7u; word = word + 1u) {
      inactive_nonzero = inactive_nonzero || source_values[word] != 0.0;
    }
  }
  if (source_values[0] < 0.0 || source_active > 1u
      || (source_active == 1u) != source_massive || inactive_nonzero) {
    ws_reject(STATUS_INVALID_SOURCE, 37u);
    return;
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
  ws_store(coarse_state + 7u, source_active);
  if (!combined_was_active && ws_load(combined + 7u) != 0u) {
    ws_atomic_add(45u, 1u);
  }
  ws_atomic_add(43u, 1u);
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

fn wall_alpha(mass: f32, gap: f32) -> f32 {
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
    normal_stiffness * params.dt * params.dt / mass,
    mass > 0.0 && params.dt > 0.0
  );
  return clamp(
    (ratio / (1.0 + ratio)) * clamp(params.wall_barrier_contact_scale, 0.0, 1.0),
    0.0,
    1.0
  );
}

fn wall_correct(value: f32, mass: f32, gap: f32) -> f32 {
  let alpha = wall_alpha(mass, gap);
  var corrected = value + max(0.0, -value) * alpha;
  if (alpha >= 1.0 - 1.0e-6 && corrected < 1.0e-6 && value < 0.0) {
    corrected = 0.0;
  }
  return corrected;
}

fn update_predictor_state(base: u32, node: vec3<f32>) {
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
  ) / mass + vec3<f32>(params.gravity_x, params.gravity_y, params.gravity_z) * params.dt;
  let vmax = params.cfl_factor * params.coarse_spacing_m / max(params.dt, 1.0e-12);
  let speed2 = dot(velocity, velocity);
  if (speed2 > vmax * vmax) { velocity = velocity * (vmax / sqrt(speed2)); }
  let epsilon = max(1.0e-7, abs(params.coarse_spacing_m) * 1.0e-6);
  if (node.x <= params.coarse_spacing_m + epsilon) {
    velocity.x = wall_correct(velocity.x, mass, node.x - params.coarse_spacing_m + epsilon);
  }
  if (node.x >= params.box_x - params.coarse_spacing_m - epsilon) {
    velocity.x = -wall_correct(-velocity.x, mass, params.box_x - params.coarse_spacing_m - node.x + epsilon);
  }
  if (node.y < params.coarse_spacing_m - epsilon) {
    velocity.y = wall_correct(velocity.y, mass, node.y);
  }
  if (node.y >= params.box_y - params.coarse_spacing_m - epsilon) {
    velocity.y = -wall_correct(-velocity.y, mass, params.box_y - params.coarse_spacing_m - node.y + epsilon);
  }
  if (node.z <= params.coarse_spacing_m + epsilon) {
    velocity.z = wall_correct(velocity.z, mass, node.z - params.coarse_spacing_m + epsilon);
  }
  if (node.z >= params.box_z - params.coarse_spacing_m - epsilon) {
    velocity.z = -wall_correct(-velocity.z, mass, params.box_z - params.coarse_spacing_m - node.z + epsilon);
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
  update_predictor_state(params.baseline_offset + parent * ROW_WORDS, node);
  update_predictor_state(params.combined_offset + parent * ROW_WORDS, node);
  update_predictor_state(params.coarse_state_offset + parent * ROW_WORDS, node);
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
    }
  }
}

@compute @workgroup_size(1)
fn seal_parent_field_predictors() {
  if (!workspace_admitted(PHASE_BUILDING)) { return; }
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

struct CausalRouteEvaluation {
  // 0: no causal impulse, 1: coherent causal impulse, 2: causal but the
  // affine recipient support is incomplete and the operation must reject.
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
  coarse_state: u32
) -> bool {
  let coarse_mass = state_load(coarse_state, 0u);
  if (!(coarse_mass > 0.0)) { return false; }
  let coarse_velocity = velocity(coarse_state);
  let relative = coarse_velocity - fine_velocity;
  if (cohort_equal(candidate_cohort, fine_key_cohort)) {
    return dot(relative, relative) > 1.0e-18;
  }
  let coarse_specific_gradient = vec3<f32>(
    state_load(coarse_state, 4u), state_load(coarse_state, 5u),
    state_load(coarse_state, 6u)
  ) / coarse_mass;
  let normal_raw = fine_specific_gradient - coarse_specific_gradient;
  let normal_length2 = dot(normal_raw, normal_raw);
  if (normal_length2 <= 1.0e-12) { return false; }
  return dot(relative, normal_raw / sqrt(normal_length2)) < 0.0;
}

fn evaluate_causal_route(
  fine_field: u32,
  candidate_cohort: vec3<u32>
) -> CausalRouteEvaluation {
  let fine_state = fine_load(30u) + fine_field * ROW_WORDS;
  let fine_mass = bitcast<f32>(fine_load(fine_state));
  if (!(fine_mass > 0.0)) {
    return CausalRouteEvaluation(0u, vec3<f32>(0.0));
  }
  let fine_velocity = vec3<f32>(
    bitcast<f32>(fine_load(fine_state + 1u)),
    bitcast<f32>(fine_load(fine_state + 2u)),
    bitcast<f32>(fine_load(fine_state + 3u))
  );
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
  var incomplete = false;
  var locally_causal = false;
  for (var local = 0u; local < edge_count; local = local + 1u) {
    let edge = edge_begin + local;
    let fine_parent = parent_view[parent_view[52u] + edge];
    let weight = bitcast<f32>(parent_view[parent_view[53u] + edge]);
    let recipient = find_parent_key(vec4<u32>(
      parent_key(fine_parent, 0u), candidate_cohort
    ));
    if (recipient == INVALID_INDEX) {
      incomplete = true;
      continue;
    }
    let coarse_ordinal = parent_to_coarse_load(recipient);
    if (coarse_ordinal == INVALID_INDEX || coarse_ordinal >= ws_load(22u)) {
      incomplete = true;
      continue;
    }
    let coarse_state = params.coarse_state_offset + recipient * ROW_WORDS;
    let coarse_mass = state_load(coarse_state, 0u);
    if (!(coarse_mass > 0.0) || !finite_f32(coarse_mass)) {
      incomplete = true;
      continue;
    }
    locally_causal = locally_causal || local_route_is_causal(
      fine_velocity,
      fine_specific_gradient,
      candidate_cohort,
      source_cohort,
      coarse_state
    );
    let ledger_row = reflux_row(coarse_ordinal);
    let prior_reflux_impulse = vec3<f32>(
      bitcast<f32>(reflux_load(ledger_row + 5u)),
      bitcast<f32>(reflux_load(ledger_row + 6u)),
      bitcast<f32>(reflux_load(ledger_row + 7u))
    );
    coarse_velocity = coarse_velocity + weight * (
      velocity(coarse_state) + prior_reflux_impulse / coarse_mass
    );
    coarse_specific_gradient = coarse_specific_gradient + weight * vec3<f32>(
      state_load(coarse_state, 4u), state_load(coarse_state, 5u),
      state_load(coarse_state, 6u)
    ) / coarse_mass;
    inverse_effective_mass = inverse_effective_mass
      + weight * weight / coarse_mass;
  }
  if (incomplete) {
    return CausalRouteEvaluation(2u, vec3<f32>(0.0));
  }
  if (!(inverse_effective_mass > 0.0) || !finite_f32(inverse_effective_mass)) {
    return CausalRouteEvaluation(2u, vec3<f32>(0.0));
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
    return CausalRouteEvaluation(2u, vec3<f32>(0.0));
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
    ws_atomic_add(proposal + 3u, 1u);
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
    if (scatter) { ws_atomic_add(88u, 1u); }
  }
  return total;
}

fn velocity_alpha_limit(
  prior: vec3<f32>, delta: vec3<f32>, vmax: f32, ceiling: f32
) -> f32 {
  var alpha = 1.0;
  let delta_length = length(delta);
  if (ceiling > 0.0 && delta_length > ceiling) {
    alpha = min(alpha, ceiling / delta_length);
  }
  if (!(vmax > 0.0) || !finite_f32(vmax)) { return -1.0; }
  let prior2 = dot(prior, prior);
  let tolerance = max(
    8.0 * 1.175494351e-38,
    3.8146973e-6 * (abs(prior2) + abs(vmax * vmax))
  );
  if (prior2 > vmax * vmax + tolerance) { return -1.0; }
  let trial = prior + alpha * delta;
  if (dot(trial, trial) <= vmax * vmax + tolerance) { return alpha; }
  let a = dot(delta, delta);
  if (!(a > 0.0)) { return 0.0; }
  let b = 2.0 * dot(prior, delta);
  let c = prior2 - vmax * vmax;
  let discriminant = b * b - 4.0 * a * c;
  if (!(discriminant >= 0.0) || !finite_f32(discriminant)) { return -1.0; }
  let root = (-b + sqrt(discriminant)) / (2.0 * a);
  if (!finite_f32(root)) { return -1.0; }
  return clamp(min(alpha, root), 0.0, 1.0);
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
  ws_atomic_add(47u, edge_count);
  let prior = vec3<f32>(
    bitcast<f32>(fine_load(state + 1u)),
    bitcast<f32>(fine_load(state + 2u)),
    bitcast<f32>(fine_load(state + 3u))
  );
  let impulse = causal_impulse_sum(fine_field, true);
  if (!workspace_admitted(PHASE_PREDICTORS)) { return; }
  ws_store(fine_impulse_row, bitcast<u32>(impulse.x));
  ws_store(fine_impulse_row + 1u, bitcast<u32>(impulse.y));
  ws_store(fine_impulse_row + 2u, bitcast<u32>(impulse.z));
  ws_store(fine_impulse_row + 3u, 0u);
  ws_store(fine_impulse_row + 4u, 1u);
  let delta = impulse / mass;
  let fine_spacing = bitcast<f32>(fine_load(23u));
  let vmax = params.cfl_factor * fine_spacing / max(params.fine_dt, 1.0e-12);
  let alpha_limit = velocity_alpha_limit(
    prior, delta, vmax, max(params.max_correction_m_per_s, 0.0)
  );
  if (!(alpha_limit >= 0.0)
      || (dot(impulse, impulse) > 1.0e-24 && alpha_limit <= 0.0)
      || !ws_atomic_min_nonnegative_f32(85u, alpha_limit)) {
    ws_reject(STATUS_CFL_REJECTED, 86u);
    reflux_reject(REFLUX_CFL_REJECTED);
    return;
  }
  var valid = true;
  valid = ws_atomic_add_f32(80u, dot(prior, impulse)) && valid;
  valid = ws_atomic_add_f32(81u, 0.5 * dot(impulse, impulse) / mass) && valid;
  valid = ws_atomic_add_f32(90u, impulse.x) && valid;
  valid = ws_atomic_add_f32(91u, impulse.y) && valid;
  valid = ws_atomic_add_f32(92u, impulse.z) && valid;
  let angular = cross(fine_position, impulse);
  valid = ws_atomic_add_f32(96u, angular.x) && valid;
  valid = ws_atomic_add_f32(97u, angular.y) && valid;
  valid = ws_atomic_add_f32(98u, angular.z) && valid;
  if (!valid) {
    ws_reject(STATUS_NONFINITE, 39u);
    reflux_reject(REFLUX_NONFINITE);
    return;
  }
  ws_atomic_add(89u, 1u);
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
  let existing = vec3<f32>(
    bitcast<f32>(reflux_load(row + 5u)),
    bitcast<f32>(reflux_load(row + 6u)),
    bitcast<f32>(reflux_load(row + 7u))
  );
  let prior = velocity(coarse_state) + existing / mass;
  let delta = proposal / mass;
  let vmax = params.cfl_factor * params.coarse_spacing_m
    / max(params.macro_dt, 1.0e-12);
  let alpha_limit = velocity_alpha_limit(prior, delta, vmax, 0.0);
  if (!(alpha_limit >= 0.0)
      || (dot(proposal, proposal) > 1.0e-24 && alpha_limit <= 0.0)
      || !ws_atomic_min_nonnegative_f32(85u, alpha_limit)) {
    ws_reject(STATUS_CFL_REJECTED, 86u);
    reflux_reject(REFLUX_CFL_REJECTED);
    return;
  }
  let position = parent_node_position(parent);
  let angular = cross(position, proposal);
  var valid = true;
  valid = ws_atomic_add_f32(82u, dot(prior, proposal)) && valid;
  valid = ws_atomic_add_f32(83u, 0.5 * dot(proposal, proposal) / mass) && valid;
  valid = ws_atomic_add_f32(93u, proposal.x) && valid;
  valid = ws_atomic_add_f32(94u, proposal.y) && valid;
  valid = ws_atomic_add_f32(95u, proposal.z) && valid;
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
  let fine_impulse = vec3<f32>(
    bitcast<f32>(ws_load(90u)), bitcast<f32>(ws_load(91u)),
    bitcast<f32>(ws_load(92u))
  );
  let coarse_impulse = vec3<f32>(
    bitcast<f32>(ws_load(93u)), bitcast<f32>(ws_load(94u)),
    bitcast<f32>(ws_load(95u))
  );
  let fine_angular = vec3<f32>(
    bitcast<f32>(ws_load(96u)), bitcast<f32>(ws_load(97u)),
    bitcast<f32>(ws_load(98u))
  );
  let coarse_angular = vec3<f32>(
    bitcast<f32>(ws_load(99u)), bitcast<f32>(ws_load(100u)),
    bitcast<f32>(ws_load(101u))
  );
  let momentum_residual = fine_impulse + coarse_impulse;
  let angular_residual = fine_angular + coarse_angular;
  let momentum_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8
      * (length(fine_impulse) + length(coarse_impulse))
  );
  let angular_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8
      * (length(fine_angular) + length(coarse_angular))
  );
  if (max(abs(momentum_residual.x), max(
        abs(momentum_residual.y), abs(momentum_residual.z)
      )) > momentum_tolerance
      || max(abs(angular_residual.x), max(
        abs(angular_residual.y), abs(angular_residual.z)
      )) > angular_tolerance) {
    ws_reject(STATUS_INVALID_ROUTE, 86u);
    reflux_reject(REFLUX_ROUTE_REJECTED);
    return;
  }
  let alpha_limit = bitcast<f32>(ws_load(85u));
  let linear = bitcast<f32>(ws_load(80u)) + bitcast<f32>(ws_load(82u));
  let quadratic = bitcast<f32>(ws_load(81u)) + bitcast<f32>(ws_load(83u));
  let scale = abs(linear) + abs(quadratic);
  let tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * scale
  );
  if (!finite_f32(alpha_limit) || !finite_f32(linear)
      || !finite_f32(quadratic) || alpha_limit < 0.0
      || alpha_limit > 1.0 || quadratic < 0.0) {
    ws_reject(STATUS_NONFINITE | STATUS_ENERGY_REJECTED, 39u);
    reflux_reject(REFLUX_NONFINITE | REFLUX_ENERGY_REJECTED);
    return;
  }
  if (ws_load(88u) == 0u) {
    ws_store(85u, bitcast<u32>(0.0));
    return;
  }
  if (alpha_limit < 1.0 - 3.8146973e-6) {
    ws_reject(STATUS_CFL_REJECTED, 86u);
    reflux_reject(REFLUX_CFL_REJECTED);
    return;
  }
  if (linear + quadratic > tolerance) {
    ws_reject(STATUS_ENERGY_REJECTED, 86u);
    reflux_reject(REFLUX_ENERGY_REJECTED);
    return;
  }
  ws_store(85u, bitcast<u32>(1.0));
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
  let heat_j = bitcast<f32>(ws_load(impulse_row + 3u));
  if (!(heat_j > 0.0)) { return; }
  let accumulator = fine_load(28u)
    + fine_field * FIELD_ACCUMULATOR_WORDS;
  // word0 is total heat and word2 is the route-only audit subset. G2P adds
  // word0 to particle U exactly once and samples word2 only for evidence.
  fine_store(accumulator, ws_load(impulse_row + 5u));
  fine_store(accumulator + 1u, ws_load(impulse_row + 7u));
  fine_store(accumulator + 2u, ws_load(impulse_row + 6u));
  fine_store(accumulator + 3u, 1u);
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
  ws_atomic_add(46u, 1u);
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
  let alpha = bitcast<f32>(ws_load(85u));
  let ordinal = params.fine_substep_ordinal;
  let expected = params.fine_substep_count;
  if (!finite_f32(alpha) || alpha < 0.0 || alpha > 1.0
      || ordinal >= expected
      || reflux_load(8u) != ordinal
      || reflux_load(15u) != ordinal
      || reflux_load(54u) != expected
      || reflux_load(97u) != ordinal
      || reflux_load(111u) != ordinal + 1u) {
    reflux_reject(REFLUX_PHASE_REJECTED);
    return;
  }

  let receipt = fine_receipt_offset();
  let local_heat = bitcast<f32>(fine_load(receipt + 8u));
  let published_local_heat = bitcast<f32>(fine_load(receipt + 9u));
  if (!(local_heat >= 0.0) || !finite_f32(local_heat)
      || bitcast<u32>(local_heat) != bitcast<u32>(published_local_heat)) {
    reflux_reject(REFLUX_NONFINITE | REFLUX_ENERGY_REJECTED);
    return;
  }

  var fine_energy_delta = 0.0;
  var coarse_virtual_energy_delta = 0.0;
  var fine_heat_weight = 0.0;
  var coarse_heat_weight = 0.0;
  var last_fine_heat = INVALID_INDEX;
  var max_pou_residual = 0.0;
  var max_first_moment_residual = 0.0;
  var pou_sum_abs = 0.0;
  var first_moment_sum_abs = 0.0;
  var max_fine_cfl_ratio = 0.0;
  var route_recipient_count = 0u;
  var local_contribution_sum = 0u;
  var local_heat_sum = 0.0;
  let fine_spacing = bitcast<f32>(fine_load(23u));
  let fine_vmax = params.cfl_factor * fine_spacing
    / max(params.fine_dt, 1.0e-12);
  if (!(fine_vmax > 0.0) || !finite_f32(fine_vmax)) {
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
    let route_count = fine_load(accumulator + 3u);
    if (!finite_f32(pou_residual) || pou_residual < 0.0
        || !finite_f32(moment_residual) || moment_residual < 0.0
        || ws_load(impulse_row + 5u) != ordinal
        || !finite_f32(prior_total) || prior_total < 0.0
        || prior_route != 0.0 || route_count != 0u
        || local_count > 0xffffffffu - local_contribution_sum
        || !finite_f32(local_heat_sum + prior_total)) {
      reflux_reject(REFLUX_ROUTE_REJECTED | REFLUX_NONFINITE);
      return;
    }
    local_contribution_sum = local_contribution_sum + local_count;
    local_heat_sum = local_heat_sum + prior_total;
    max_pou_residual = max(max_pou_residual, pou_residual);
    max_first_moment_residual = max(
      max_first_moment_residual, moment_residual
    );
    let state = fine_load(30u) + fine_field * ROW_WORDS;
    let state_active = fine_load(state + 7u) != 0u;
    let impulse_active = ws_load(impulse_row + 4u) != 0u;
    if (!state_active) {
      if (impulse_active || prior_total != 0.0 || local_count != 0u) {
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
    let applied = alpha * impulse;
    if (!(mass > 0.0) || !finite_f32(mass)
        || !all(vec3<bool>(
          finite_f32(prior.x), finite_f32(prior.y), finite_f32(prior.z)
        ))
        || !all(vec3<bool>(
          finite_f32(applied.x), finite_f32(applied.y), finite_f32(applied.z)
        ))) {
      reflux_reject(REFLUX_NONFINITE);
      return;
    }
    let delta = dot(prior, applied)
      + 0.5 * dot(applied, applied) / mass;
    let next_velocity = prior + applied / mass;
    let cfl_ratio = length(next_velocity) / max(fine_vmax, 1.0e-20);
    if (!finite_f32(delta)
        || !all(vec3<bool>(
          finite_f32(next_velocity.x), finite_f32(next_velocity.y),
          finite_f32(next_velocity.z)
        )) || !finite_f32(cfl_ratio)
        || cfl_ratio > 1.0 + 3.8146973e-6) {
      reflux_reject(REFLUX_NONFINITE);
      return;
    }
    max_fine_cfl_ratio = max(max_fine_cfl_ratio, cfl_ratio);
    fine_energy_delta = fine_energy_delta + delta;
    let weight = max(0.0, -delta);
    fine_heat_weight = fine_heat_weight + weight;
    if (weight > 0.0) {
      last_fine_heat = fine_field;
      if (fine_load(accumulator + 1u) == 0xffffffffu
          || fine_load(accumulator + 3u) == 0xffffffffu) {
        reflux_reject(REFLUX_NONFINITE | REFLUX_OVERFLOW);
        return;
      }
    }
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
    reflux_reject(REFLUX_NONFINITE);
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
    let row = reflux_row(coarse_field);
    let existing = vec3<f32>(
      bitcast<f32>(reflux_load(row + 5u)),
      bitcast<f32>(reflux_load(row + 6u)),
      bitcast<f32>(reflux_load(row + 7u))
    );
    let applied = alpha * proposal;
    let next = existing + applied;
    let parent = parent_view[parent_view[54u] + coarse_field];
    let coarse_state = params.coarse_state_offset + parent * ROW_WORDS;
    let mass = state_load(coarse_state, 0u);
    let prior_velocity = velocity(coarse_state) + existing / mass;
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
        || !finite_f32(prior_virtual_delta)
        || !finite_f32(prior_weight) || prior_weight < 0.0
        || proposal_count > 0xffffffffu - contribution_count) {
      reflux_reject(REFLUX_NONFINITE | REFLUX_OVERFLOW);
      return;
    }
    let delta = dot(prior_velocity, applied)
      + 0.5 * dot(applied, applied) / mass;
    let weight = max(0.0, -delta);
    if (!finite_f32(delta) || !finite_f32(weight)
        || !finite_f32(prior_virtual_delta + delta)
        || !finite_f32(prior_weight + weight)) {
      reflux_reject(REFLUX_NONFINITE);
      return;
    }
    coarse_virtual_energy_delta = coarse_virtual_energy_delta + delta;
    coarse_heat_weight = coarse_heat_weight + weight;
  }

  let virtual_delta = fine_energy_delta + coarse_virtual_energy_delta;
  let virtual_scale = abs(fine_energy_delta)
    + abs(coarse_virtual_energy_delta);
  let virtual_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * virtual_scale
  );
  if (!finite_f32(virtual_delta) || virtual_delta > virtual_tolerance
      || !finite_f32(fine_heat_weight)
      || !finite_f32(coarse_heat_weight)) {
    reflux_reject(REFLUX_NONFINITE | REFLUX_ENERGY_REJECTED);
    return;
  }
  let virtual_heat = max(0.0, -virtual_delta);
  let total_heat_weight = fine_heat_weight + coarse_heat_weight;
  if (virtual_heat > virtual_tolerance && !(total_heat_weight > 0.0)) {
    reflux_reject(REFLUX_ENERGY_REJECTED);
    return;
  }
  var fine_route_heat = 0.0;
  if (total_heat_weight > 0.0 && fine_heat_weight > 0.0) {
    fine_route_heat = (fine_heat_weight / total_heat_weight) * virtual_heat;
  }

  let next_fine_impulse = vec3<f32>(
    bitcast<f32>(reflux_load(16u)),
    bitcast<f32>(reflux_load(17u)),
    bitcast<f32>(reflux_load(18u))
  ) + alpha * vec3<f32>(
    bitcast<f32>(ws_load(90u)), bitcast<f32>(ws_load(91u)),
    bitcast<f32>(ws_load(92u))
  );
  let next_coarse_impulse = vec3<f32>(
    bitcast<f32>(reflux_load(19u)),
    bitcast<f32>(reflux_load(20u)),
    bitcast<f32>(reflux_load(21u))
  ) + alpha * vec3<f32>(
    bitcast<f32>(ws_load(93u)), bitcast<f32>(ws_load(94u)),
    bitcast<f32>(ws_load(95u))
  );
  let next_fine_angular = vec3<f32>(
    bitcast<f32>(reflux_load(22u)),
    bitcast<f32>(reflux_load(23u)),
    bitcast<f32>(reflux_load(24u))
  ) + alpha * vec3<f32>(
    bitcast<f32>(ws_load(96u)), bitcast<f32>(ws_load(97u)),
    bitcast<f32>(ws_load(98u))
  );
  let next_coarse_angular = vec3<f32>(
    bitcast<f32>(reflux_load(25u)),
    bitcast<f32>(reflux_load(26u)),
    bitcast<f32>(reflux_load(27u))
  ) + alpha * vec3<f32>(
    bitcast<f32>(ws_load(99u)), bitcast<f32>(ws_load(100u)),
    bitcast<f32>(ws_load(101u))
  );
  let next_fine_energy = bitcast<f32>(reflux_load(28u))
    + fine_energy_delta;
  let next_virtual_coarse_energy = bitcast<f32>(reflux_load(29u))
    + coarse_virtual_energy_delta;
  let next_fine_route_heat = bitcast<f32>(reflux_load(112u))
    + fine_route_heat;
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
    reflux_reject(REFLUX_NONFINITE);
    return;
  }

  // Seal exact fine heat shares, exact future velocities, and exact sidecar
  // words while the live field is still VELOCITY/HEAT_BUILDING. After this
  // pass, the claim/commit/apply sequence has no reachable arithmetic reject.
  var assigned_fine_heat = 0.0;
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
    let applied = alpha * impulse;
    let next_velocity = prior + applied / mass;
    let delta = dot(prior, applied)
      + 0.5 * dot(applied, applied) / mass;
    let weight = max(0.0, -delta);
    var share = 0.0;
    if (weight > 0.0 && fine_route_heat > 0.0) {
      let remaining = max(0.0, fine_route_heat - assigned_fine_heat);
      if (fine_field == last_fine_heat) {
        share = remaining;
      } else {
        share = min(
          (weight / fine_heat_weight) * fine_route_heat,
          remaining
        );
      }
    }
    let accumulator = fine_load(28u)
      + fine_field * FIELD_ACCUMULATOR_WORDS;
    let prior_total = bitcast<f32>(fine_load(accumulator));
    let prior_local_count = fine_load(accumulator + 1u);
    let has_share = share > 0.0;
    let next_field_total = prior_total + share;
    let next_field_route = share;
    let next_local_count = prior_local_count + select(0u, 1u, has_share);
    let next_assigned = assigned_fine_heat + share;
    let next_projected_total = projected_total_heat_sum + next_field_total;
    let specific_heat = next_field_total / mass;
    if (!finite_f32(share) || share < 0.0
        || !finite_f32(next_assigned)
        || next_assigned > fine_route_heat + virtual_tolerance
        || !finite_f32(next_field_total) || next_field_total < 0.0
        || !finite_f32(next_field_route) || next_field_route < 0.0
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
    let applied = alpha * proposal;
    let parent = parent_view[parent_view[54u] + coarse_field];
    let coarse_state = params.coarse_state_offset + parent * ROW_WORDS;
    let mass = state_load(coarse_state, 0u);
    let prior_velocity = velocity(coarse_state) + existing / mass;
    let delta = dot(prior_velocity, applied)
      + 0.5 * dot(applied, applied) / mass;
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
        bitcast<f32>(reflux_load(row + 15u)) + max(0.0, -delta)
      )
    );
    ws_store(proposal_base + 7u, ordinal + 1u);
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
  // Row zero has two spare sealed words after route staging.
  ws_store(params.route_proposal_offset + 6u, next_measurement_contribution_count);
  ws_store(68u, bitcast<u32>(alpha));
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
  for (var coarse_field = 0u; coarse_field < ws_load(22u); coarse_field = coarse_field + 1u) {
    let proposal = params.route_proposal_offset + coarse_field * ROUTE_WORDS;
    let row = reflux_row(coarse_field);
    reflux_store(row + 5u, ws_load(proposal));
    reflux_store(row + 6u, ws_load(proposal + 1u));
    reflux_store(row + 7u, ws_load(proposal + 2u));
    reflux_store(row + 13u, ws_load(proposal + 3u));
    reflux_store(row + 9u, ws_load(proposal + 4u));
    reflux_store(row + 15u, ws_load(proposal + 5u));
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
  reflux_store(32u, fine_stage_load(25u));
  reflux_store(33u, fine_stage_load(26u));
  reflux_store(34u, fine_stage_load(27u));
  reflux_store(35u, fine_stage_load(28u));
  reflux_store(85u, fine_stage_load(29u));
  reflux_store(86u, fine_stage_load(30u));
  reflux_store(94u, ws_load(params.route_proposal_offset + 6u));
  reflux_store(97u, ordinal + 1u);
  reflux_store(111u, fine_stage_load(31u));
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
      || reflux_load(15u) != params.fine_substep_ordinal) { return; }
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
  fine_store(59u, FIELD_VELOCITY);
  ws_store(36u, PHASE_FINE_COMPLETE);
  ws_store(58u, FIELD_VELOCITY);
  ws_store(70u, params.completion_ordinal);
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
      || coarse_load(accumulator + 3u) != 0u
      || coarse_load(accumulator + 4u) != 0u
      || coarse_load(accumulator + 5u) != 0u
      || coarse_load(accumulator + 6u) != 0u
      || coarse_load(accumulator + 7u) != 0u
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
  let cfl_ratio = length(future) / vmax;
  let cfl_tolerance = measured_tolerance(
    cfl_ratio, 1.0, state_contribution_count
  );
  if (!all(vec3<bool>(
      finite_f32(future.x), finite_f32(future.y), finite_f32(future.z)
    )) || !finite_f32(delta_energy) || !finite_f32(vmax) || !(vmax > 0.0)
      || !finite_f32(cfl_ratio)
      || cfl_ratio < 0.0 || cfl_ratio > 1.0 + cfl_tolerance) {
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
  // Row 15 is the cumulative causal loss weight from committed fine slices.
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
  var local_contribution_sum = 0u;
  var state_contribution_sum = 0u;
  var max_specific_heat = 0.0;
  var max_coarse_cfl = 0.0;
  var causal_weight_sum = 0.0;
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
    let causal_weight = bitcast<f32>(ws_load(proposal + 4u));
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
        || !finite_f32(next_causal_weight) || next_causal_weight < 0.0) {
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
    causal_weight_sum = next_causal_weight;
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
  let receipt_max_specific = bitcast<f32>(coarse_load(receipt + 11u));
  if (local_contribution_sum != coarse_load(receipt + 7u)
      || !measured_close(
        local_heat_sum, receipt_heat, local_contribution_sum
      ) || !measured_close(
        receipt_heat, published_heat, local_contribution_sum
      ) || !measured_close(
        max_specific_heat, receipt_max_specific, local_contribution_sum
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
  let causal_kinetic_residual = fine_energy + virtual_coarse_energy;
  let actual_kinetic_residual = fine_energy + actual_coarse_energy;
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
  let causal_energy_sum_abs = abs(fine_energy) + virtual_energy_sum_abs;
  let causal_energy_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * causal_energy_sum_abs
  );
  let fine_route_heat = bitcast<f32>(reflux_load(112u));
  let causal_route_heat = max(0.0, -causal_kinetic_residual);
  let deferred_unclamped = causal_route_heat - fine_route_heat;
  var deferred_route_heat = max(0.0, deferred_unclamped);
  if (deferred_route_heat <= causal_energy_tolerance
      && !(causal_weight_sum > 0.0)) {
    deferred_route_heat = 0.0;
  }
  let total_route_heat = fine_route_heat + deferred_route_heat;
  let causal_energy_residual = causal_kinetic_residual + total_route_heat;
  let energy_sum_abs = abs(fine_energy) + actual_coarse_energy_sum_abs
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
      || !finite_f32(causal_kinetic_residual)
      || !finite_f32(causal_energy_residual)
      || !finite_f32(actual_kinetic_residual)
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
      || max_coarse_cfl > 1.0 + measured_tolerance(
        max_coarse_cfl, 1.0, state_contribution_sum
      ) || !mass_ok || !momentum_ok || !angular_ok || !energy_ok
      || (deferred_route_heat > 0.0 && !(causal_weight_sum > 0.0))) {
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
}

@compute @workgroup_size(1)
fn prepare_coarse_transaction() {
  if (!workspace_admitted(PHASE_PREDICTORS) || !reflux_accumulating()
      || fine_stage_load(29u) != ws_load(22u)
      || reflux_load(111u) != params.fine_substep_count + 1u) { return; }
  let deferred_heat = bitcast<f32>(fine_stage_load(2u));
  let weight_sum = bitcast<f32>(fine_stage_load(31u));
  let energy_tolerance = bitcast<f32>(fine_stage_load(23u));
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
  if (deferred_heat > 0.0 && last_weighted == INVALID_INDEX) {
    ws_reject(STATUS_ENERGY_REJECTED | STATUS_INVALID_ROUTE, 86u);
    reflux_reject(REFLUX_ENERGY_REJECTED | REFLUX_ROUTE_REJECTED);
    return;
  }
  var assigned = 0.0;
  var published_energy_sum_abs = abs(bitcast<f32>(reflux_load(28u)));
  var minimum_positive = bitcast<f32>(0x7f7fffffu);
  for (var coarse_field = 0u; coarse_field < ws_load(22u); coarse_field = coarse_field + 1u) {
    let proposal = params.route_proposal_offset
      + coarse_field * ROUTE_WORDS;
    let actual_delta_energy = bitcast<f32>(ws_load(proposal + 3u));
    let weight = bitcast<f32>(reflux_load(reflux_row(coarse_field) + 15u));
    var share = 0.0;
    if (deferred_heat > 0.0 && weight > 0.0 && weight_sum > 0.0) {
      let remaining = max(0.0, deferred_heat - assigned);
      share = select(
        min(deferred_heat * weight / weight_sum, remaining),
        remaining,
        coarse_field == last_weighted
      );
    }
    let next_assigned = assigned + share;
    if (!finite_f32(share) || share < 0.0
        || !finite_f32(next_assigned)
        || next_assigned > deferred_heat + energy_tolerance) {
      ws_reject(STATUS_ENERGY_REJECTED | STATUS_NONFINITE, 86u);
      reflux_reject(REFLUX_ENERGY_REJECTED | REFLUX_NONFINITE);
      return;
    }
    ws_store(proposal + 4u, bitcast<u32>(share));
    assigned = next_assigned;
    published_energy_sum_abs = published_energy_sum_abs
      + abs(actual_delta_energy);
    if (share > 0.0) { minimum_positive = min(minimum_positive, share); }
  }
  if (abs(assigned - deferred_heat) > energy_tolerance) {
    ws_reject(STATUS_ENERGY_REJECTED, 86u);
    reflux_reject(REFLUX_ENERGY_REJECTED);
    return;
  }
  let fine_route_heat = bitcast<f32>(reflux_load(112u));
  let published_total_heat = fine_route_heat + assigned;
  let kinetic_residual = bitcast<f32>(reflux_load(28u))
    + bitcast<f32>(fine_stage_load(0u));
  let published_residual = kinetic_residual + published_total_heat
    - synchronization_work;
  published_energy_sum_abs = published_energy_sum_abs
    + abs(published_total_heat) + abs(synchronization_work);
  let published_energy_tolerance = max(
    8.0 * 1.175494351e-38,
    1024.0 * 5.960464477539063e-8 * published_energy_sum_abs
  );
  if (!finite_f32(assigned) || assigned < 0.0
      || !finite_f32(published_total_heat) || published_total_heat < 0.0
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
  fine_stage_store(2u, bitcast<u32>(assigned));
  fine_stage_store(22u, bitcast<u32>(abs(published_residual)));
  fine_stage_store(23u, bitcast<u32>(published_energy_tolerance));
  fine_stage_store(30u, bitcast<u32>(published_energy_sum_abs));
  fine_stage_store(
    26u,
    bitcast<u32>(select(0.0, minimum_positive, assigned > 0.0))
  );
  // Preserve the independently accumulated row sum for the final preclaim
  // gate; H113 is published from the same staged value.
  fine_stage_store(31u, bitcast<u32>(assigned));
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
  coarse_store(state + 1u, ws_load(proposal));
  coarse_store(state + 2u, ws_load(proposal + 1u));
  coarse_store(state + 3u, ws_load(proposal + 2u));
}

@compute @workgroup_size(1)
fn finalize_coarse_velocity_publish() {
  if (!workspace_admitted(PHASE_PREDICTORS)
      || ws_load(68u) != params.fine_substep_count + 2u
      || ws_load(66u) != params.fine_substep_count + 3u) { return; }
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
  // The field receipt phase is the globally last terminal publication word.
  coarse_store(receipt + 3u, FIELD_RECEIPT_ENERGY_READY);
}
`;
