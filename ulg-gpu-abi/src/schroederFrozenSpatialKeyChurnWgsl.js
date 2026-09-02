import {
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_CHECKSUM_PRIME,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_CHECKSUM_SALT,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_FLAG_ADMITTED,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_MAGIC,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_ADMITTED,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_FAIL_CLOSED,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_READY,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_VERSION,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORD,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORDS
} from './schroederFrozenSpatialKeyChurn.js';

export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORKGROUP_SIZE = 64;
export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_PARAMS_WORDS = 24;
export const SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_PARAMS_BYTES =
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_PARAMS_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export { SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_FLAG_ADMITTED } from './schroederFrozenSpatialKeyChurn.js';

function u32(value) {
  return `${value >>> 0}u`;
}

const w = SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORD;

/**
 * Diagnostic-only exact-key census for a frozen fine-substep assignment.
 * It deliberately runs as a separate opt-in pass so the production refresh
 * shader and bind-group layout remain unchanged. The key calculation and
 * active-row predicate mirror the canonical ActiveSource/key-emission f32
 * rules. A caller copies the sealed 128-byte record in the same encoder.
 */
export const schroederFrozenSpatialKeyChurnWgsl = /* wgsl */ `
struct FrozenSpatialKeyChurnParams {
  particle_count: u32,
  assignment_stride_words: u32,
  state_stride_words: u32,
  flags: u32,
  step_ordinal: u32,
  fine_substep_ordinal: u32,
  prior_position_epoch: u32,
  successor_position_epoch: u32,
  topology_epoch: u32,
  chart_epoch: u32,
  level_epoch: u32,
  support_epoch: u32,
  query_chart_id: u32,
  query_min_level: i32,
  query_max_level: i32,
  query_base_grid_spacing_m: f32,
  cell_min_x: i32,
  cell_min_y: i32,
  cell_min_z: i32,
  cell_count_x: u32,
  cell_count_y: u32,
  cell_count_z: u32,
  exact_cell_atlas_enabled: u32,
  padding_0: u32,
};

@group(0) @binding(0) var<storage, read> prior_assignments: array<u32>;
@group(0) @binding(1) var<storage, read> current_state: array<u32>;
@group(0) @binding(2) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: FrozenSpatialKeyChurnParams;

const ASSIGNMENT_STRIDE_WORDS: u32 = 16u;
const STATE_STRIDE_WORDS: u32 = 8u;
const FLAG_ADMITTED: u32 = ${u32(SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_FLAG_ADMITTED)};
const RECORD_WORDS: u32 = ${u32(SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORDS)};
const MAGIC: u32 = ${u32(SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_MAGIC)};
const VERSION: u32 = ${u32(SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_VERSION)};
const STATUS_READY: u32 = ${u32(SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_READY)};
const STATUS_ADMITTED: u32 = ${u32(SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_ADMITTED)};
const STATUS_FAIL_CLOSED: u32 = ${u32(SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_STATUS_FAIL_CLOSED)};
const CHECKSUM_SALT: u32 = ${u32(SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_CHECKSUM_SALT)};
const CHECKSUM_PRIME: u32 = ${u32(SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_CHECKSUM_PRIME)};
const MAX_EXACT_F32_INTEGER: f32 = 16777215.0;
const MIN_SAFE_I32_F32: f32 = -2147483520.0;
const MAX_SAFE_I32_F32: f32 = 2147483520.0;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn integral_f32(value: f32) -> bool {
  return finite_f32(value) && value == trunc(value);
}

fn safe_i32_f32(value: f32) -> bool {
  return finite_f32(value)
    && value >= MIN_SAFE_I32_F32
    && value <= MAX_SAFE_I32_F32;
}

fn signed_order_key(value: i32) -> u32 {
  return bitcast<u32>(value) ^ 0x80000000u;
}

fn assignment_f32(row: u32, word: u32) -> f32 {
  return bitcast<f32>(prior_assignments[row + word]);
}

fn query_profile_ready() -> bool {
  let min_order = signed_order_key(params.query_min_level);
  let max_order = signed_order_key(params.query_max_level);
  if (max_order < min_order || max_order - min_order >= 64u) {
    return false;
  }
  let min_spacing = params.query_base_grid_spacing_m
    * exp2(f32(params.query_min_level));
  let max_spacing = params.query_base_grid_spacing_m
    * exp2(f32(params.query_max_level));
  let atlas_ready = params.exact_cell_atlas_enabled == 1u
    && params.cell_count_x > 0u
    && params.cell_count_y > 0u
    && params.cell_count_z > 0u
    && params.cell_count_x - 1u
      <= 0xffffffffu - signed_order_key(params.cell_min_x)
    && params.cell_count_y - 1u
      <= 0xffffffffu - signed_order_key(params.cell_min_y)
    && params.cell_count_z - 1u
      <= 0xffffffffu - signed_order_key(params.cell_min_z);
  return params.query_chart_id <= 0x00ffffffu
    && finite_f32(params.query_base_grid_spacing_m)
    && params.query_base_grid_spacing_m > 0.0
    && finite_f32(min_spacing)
    && min_spacing >= 0.000001
    && finite_f32(max_spacing)
    && max_spacing > 0.0
    && atlas_ready;
}

fn exact_cell_atlas_admitted(cell_f: vec3<f32>) -> bool {
  if (!(
    safe_i32_f32(cell_f.x)
    && safe_i32_f32(cell_f.y)
    && safe_i32_f32(cell_f.z)
  )) {
    return false;
  }
  let cell_order = vec3<u32>(
    signed_order_key(i32(cell_f.x)),
    signed_order_key(i32(cell_f.y)),
    signed_order_key(i32(cell_f.z))
  );
  let min_order = vec3<u32>(
    signed_order_key(params.cell_min_x),
    signed_order_key(params.cell_min_y),
    signed_order_key(params.cell_min_z)
  );
  let offset = cell_order - min_order;
  return cell_order.x >= min_order.x
    && offset.x < params.cell_count_x
    && cell_order.y >= min_order.y
    && offset.y < params.cell_count_y
    && cell_order.z >= min_order.z
    && offset.z < params.cell_count_z;
}

fn structural_valid(row: u32, position: vec3<f32>) -> bool {
  let level_f = assignment_f32(row, 0u);
  let native_spacing = assignment_f32(row, 1u);
  let rest_density = assignment_f32(row, 7u);
  let phase_f = assignment_f32(row, 8u);
  let material_f = assignment_f32(row, 9u);
  let status_f = assignment_f32(row, 10u);
  let hysteresis = assignment_f32(row, 11u);
  let chart_f = assignment_f32(row, 15u);
  if (!(
    integral_f32(level_f)
    && level_f >= MIN_SAFE_I32_F32
    && level_f <= MAX_SAFE_I32_F32
    && finite_f32(native_spacing)
    && native_spacing > 0.0
    && finite_f32(rest_density)
    && integral_f32(phase_f)
    && phase_f >= 0.0
    && phase_f <= MAX_EXACT_F32_INTEGER
    && integral_f32(material_f)
    && material_f >= 0.0
    && material_f <= MAX_EXACT_F32_INTEGER
    && integral_f32(status_f)
    && status_f >= 0.0
    && status_f <= 255.0
    && (u32(round(status_f)) & 31u) > 0u
    && (u32(round(status_f)) & 128u) == 0u
    && (u32(round(status_f)) & 64u) == 0u
    && finite_f32(hysteresis)
    && hysteresis >= 0.0
    && integral_f32(chart_f)
    && chart_f >= 0.0
    && chart_f <= MAX_EXACT_F32_INTEGER
    && u32(round(chart_f)) == params.query_chart_id
    && all(vec3<bool>(
      finite_f32(position.x),
      finite_f32(position.y),
      finite_f32(position.z)
    ))
  )) {
    return false;
  }
  let level = i32(round(level_f));
  let level_order = signed_order_key(level);
  let min_order = signed_order_key(params.query_min_level);
  let max_order = signed_order_key(params.query_max_level);
  let expected_spacing = params.query_base_grid_spacing_m * exp2(f32(level));
  if (
    !query_profile_ready()
    || level_order < min_order
    || level_order > max_order
    || bitcast<u32>(native_spacing) != bitcast<u32>(expected_spacing)
  ) {
    return false;
  }
  let cell_f = floor(position / native_spacing);
  return exact_cell_atlas_admitted(cell_f);
}

fn geometry_active(row: u32) -> bool {
  let support_radius = assignment_f32(row, 2u);
  let represented_volume = assignment_f32(row, 3u);
  let rest_volume = assignment_f32(row, 4u);
  let current_volume = assignment_f32(row, 5u);
  let mass = assignment_f32(row, 6u);
  let rest_density = assignment_f32(row, 7u);
  return finite_f32(support_radius)
    && finite_f32(represented_volume)
    && finite_f32(rest_volume)
    && finite_f32(current_volume)
    && finite_f32(mass)
    && mass > 0.0
    && support_radius >= 0.0
    && represented_volume >= 0.0
    && rest_volume > 0.0
    && current_volume > 0.0
    && rest_density > 0.0;
}

fn geometry_dormant(row: u32) -> bool {
  return prior_assignments[row + 2u] == 0u
    && prior_assignments[row + 3u] == 0u
    && prior_assignments[row + 4u] == 0u
    && prior_assignments[row + 5u] == 0u
    && prior_assignments[row + 6u] == 0u;
}

fn ordered_delta(a: i32, b: i32) -> u32 {
  let ordered_a = signed_order_key(a);
  let ordered_b = signed_order_key(b);
  return select(ordered_b - ordered_a, ordered_a - ordered_b, ordered_a >= ordered_b);
}

fn store_record_identity() {
  atomicStore(&receipt[${u32(w.MAGIC)}], MAGIC);
  atomicStore(&receipt[${u32(w.VERSION)}], VERSION);
  atomicStore(&receipt[${u32(w.STATUS)}], 0u);
  atomicStore(&receipt[${u32(w.FLAGS)}], params.flags);
  atomicStore(&receipt[${u32(w.STEP_ORDINAL)}], params.step_ordinal);
  atomicStore(&receipt[${u32(w.FINE_SUBSTEP_ORDINAL)}], params.fine_substep_ordinal);
  atomicStore(&receipt[${u32(w.PARTICLE_COUNT)}], params.particle_count);
  atomicStore(&receipt[${u32(w.PRIOR_POSITION_EPOCH)}], params.prior_position_epoch);
  atomicStore(&receipt[${u32(w.SUCCESSOR_POSITION_EPOCH)}], params.successor_position_epoch);
  atomicStore(&receipt[${u32(w.TOPOLOGY_EPOCH)}], params.topology_epoch);
  atomicStore(&receipt[${u32(w.CHART_EPOCH)}], params.chart_epoch);
  atomicStore(&receipt[${u32(w.LEVEL_EPOCH)}], params.level_epoch);
  atomicStore(&receipt[${u32(w.SUPPORT_EPOCH)}], params.support_epoch);
}

@compute @workgroup_size(${SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_WORKGROUP_SIZE})
fn classify(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index == 0u && arrayLength(&receipt) >= RECORD_WORDS) {
    store_record_identity();
  }
  if (
    particle_index >= params.particle_count
    || arrayLength(&receipt) < RECORD_WORDS
    || params.assignment_stride_words != ASSIGNMENT_STRIDE_WORDS
    || params.state_stride_words != STATE_STRIDE_WORDS
    || (params.flags & FLAG_ADMITTED) == 0u
  ) {
    return;
  }
  atomicAdd(&receipt[${u32(w.VISITED_COUNT)}], 1u);
  let row = particle_index * ASSIGNMENT_STRIDE_WORDS;
  let state_row = particle_index * STATE_STRIDE_WORDS;
  let prior_position = vec3<f32>(
    assignment_f32(row, 12u),
    assignment_f32(row, 13u),
    assignment_f32(row, 14u)
  );
  let successor_position = vec3<f32>(
    bitcast<f32>(current_state[state_row + 0u]),
    bitcast<f32>(current_state[state_row + 1u]),
    bitcast<f32>(current_state[state_row + 2u])
  );
  let exact_source_index = particle_index <= 16777215u;
  let prior_structural = exact_source_index
    && structural_valid(row, prior_position);
  let successor_structural = exact_source_index
    && structural_valid(row, successor_position);
  let active_geometry = geometry_active(row);
  let dormant_geometry = geometry_dormant(row);
  let prior_active = prior_structural && active_geometry;
  let successor_active = successor_structural && active_geometry;
  if (prior_active) {
    atomicAdd(&receipt[${u32(w.PRIOR_ACTIVE_COUNT)}], 1u);
  } else if (prior_structural && dormant_geometry) {
    atomicAdd(&receipt[${u32(w.DORMANT_COUNT)}], 1u);
  } else {
    atomicAdd(&receipt[${u32(w.INVALID_PRIOR_COUNT)}], 1u);
  }
  if (successor_active) {
    atomicAdd(&receipt[${u32(w.SUCCESSOR_ACTIVE_COUNT)}], 1u);
  } else if (!(successor_structural && dormant_geometry)) {
    atomicAdd(&receipt[${u32(w.INVALID_SUCCESSOR_COUNT)}], 1u);
  }
  if (prior_active && !successor_active) {
    atomicAdd(&receipt[${u32(w.DEACTIVATED_COUNT)}], 1u);
    return;
  }
  if (!prior_active && successor_active) {
    atomicAdd(&receipt[${u32(w.ACTIVATED_COUNT)}], 1u);
    return;
  }
  if (!prior_active || !successor_active) {
    return;
  }
  atomicAdd(&receipt[${u32(w.COMPARED_ACTIVE_COUNT)}], 1u);
  if (
    prior_assignments[row + 12u] != current_state[state_row + 0u]
    || prior_assignments[row + 13u] != current_state[state_row + 1u]
    || prior_assignments[row + 14u] != current_state[state_row + 2u]
  ) {
    atomicAdd(&receipt[${u32(w.MOVED_COUNT)}], 1u);
  }
  let spacing = assignment_f32(row, 1u);
  let prior_cell = vec3<i32>(floor(prior_position / spacing));
  let successor_cell = vec3<i32>(floor(successor_position / spacing));
  let changed = prior_cell != successor_cell;
  if (any(changed)) {
    atomicAdd(&receipt[${u32(w.SPATIAL_KEY_CHANGED_COUNT)}], 1u);
    if (changed.x) {
      atomicAdd(&receipt[${u32(w.CELL_X_CHANGED_COUNT)}], 1u);
    }
    if (changed.y) {
      atomicAdd(&receipt[${u32(w.CELL_Y_CHANGED_COUNT)}], 1u);
    }
    if (changed.z) {
      atomicAdd(&receipt[${u32(w.CELL_Z_CHANGED_COUNT)}], 1u);
    }
  } else {
    atomicAdd(&receipt[${u32(w.SPATIAL_KEY_UNCHANGED_COUNT)}], 1u);
  }
  atomicMax(
    &receipt[${u32(w.MAX_ABS_CELL_DELTA_X)}],
    ordered_delta(prior_cell.x, successor_cell.x)
  );
  atomicMax(
    &receipt[${u32(w.MAX_ABS_CELL_DELTA_Y)}],
    ordered_delta(prior_cell.y, successor_cell.y)
  );
  atomicMax(
    &receipt[${u32(w.MAX_ABS_CELL_DELTA_Z)}],
    ordered_delta(prior_cell.z, successor_cell.z)
  );
}

@compute @workgroup_size(1)
fn seal() {
  if (arrayLength(&receipt) < RECORD_WORDS) {
    return;
  }
  let visited = atomicLoad(&receipt[${u32(w.VISITED_COUNT)}]);
  let prior_active = atomicLoad(&receipt[${u32(w.PRIOR_ACTIVE_COUNT)}]);
  let successor_active = atomicLoad(&receipt[${u32(w.SUCCESSOR_ACTIVE_COUNT)}]);
  let compared = atomicLoad(&receipt[${u32(w.COMPARED_ACTIVE_COUNT)}]);
  let activated = atomicLoad(&receipt[${u32(w.ACTIVATED_COUNT)}]);
  let deactivated = atomicLoad(&receipt[${u32(w.DEACTIVATED_COUNT)}]);
  let changed = atomicLoad(&receipt[${u32(w.SPATIAL_KEY_CHANGED_COUNT)}]);
  let unchanged = atomicLoad(&receipt[${u32(w.SPATIAL_KEY_UNCHANGED_COUNT)}]);
  let moved = atomicLoad(&receipt[${u32(w.MOVED_COUNT)}]);
  let invalid_prior = atomicLoad(&receipt[${u32(w.INVALID_PRIOR_COUNT)}]);
  let invalid_successor = atomicLoad(&receipt[${u32(w.INVALID_SUCCESSOR_COUNT)}]);
  let dormant = atomicLoad(&receipt[${u32(w.DORMANT_COUNT)}]);
  let cell_x_changed = atomicLoad(&receipt[${u32(w.CELL_X_CHANGED_COUNT)}]);
  let cell_y_changed = atomicLoad(&receipt[${u32(w.CELL_Y_CHANGED_COUNT)}]);
  let cell_z_changed = atomicLoad(&receipt[${u32(w.CELL_Z_CHANGED_COUNT)}]);
  let max_delta_x = atomicLoad(&receipt[${u32(w.MAX_ABS_CELL_DELTA_X)}]);
  let max_delta_y = atomicLoad(&receipt[${u32(w.MAX_ABS_CELL_DELTA_Y)}]);
  let max_delta_z = atomicLoad(&receipt[${u32(w.MAX_ABS_CELL_DELTA_Z)}]);
  let admitted = params.particle_count > 0u
    && params.assignment_stride_words == ASSIGNMENT_STRIDE_WORDS
    && params.state_stride_words == STATE_STRIDE_WORDS
    && (params.flags & FLAG_ADMITTED) != 0u
    && params.flags == FLAG_ADMITTED
    && params.step_ordinal > 0u
    && params.fine_substep_ordinal > 0u
    && params.prior_position_epoch < params.successor_position_epoch
    && query_profile_ready()
    && visited == params.particle_count
    && compared + deactivated == prior_active
    && compared + activated == successor_active
    && changed + unchanged == compared
    && prior_active + dormant + invalid_prior == params.particle_count
    && successor_active + invalid_successor <= params.particle_count
    && moved <= compared
    && changed <= moved
    && cell_x_changed <= changed
    && cell_y_changed <= changed
    && cell_z_changed <= changed
    && changed <= cell_x_changed + cell_y_changed + cell_z_changed
    && (cell_x_changed == 0u) == (max_delta_x == 0u)
    && (cell_y_changed == 0u) == (max_delta_y == 0u)
    && (cell_z_changed == 0u) == (max_delta_z == 0u);
  let status = STATUS_READY | select(STATUS_FAIL_CLOSED, STATUS_ADMITTED, admitted);
  atomicStore(&receipt[${u32(w.STATUS)}], status);
  var checksum = CHECKSUM_SALT;
  for (var index = 0u; index < ${u32(w.CHECKSUM)}; index = index + 1u) {
    checksum = (checksum ^ atomicLoad(&receipt[index])) * CHECKSUM_PRIME;
  }
  atomicStore(&receipt[${u32(w.CHECKSUM)}], checksum);
}
`;
