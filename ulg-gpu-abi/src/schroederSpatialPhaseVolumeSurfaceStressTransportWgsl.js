import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
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
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_MAGIC,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_READY,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_VERSION,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE
} from './schroederSpatialPhaseVolumeTransport.js';
import {
  schroederSpatialPhaseVolumeSurfaceStressOperatorWgsl
} from './schroederSpatialPhaseVolumeSurfaceStressOperatorWgsl.js';

const u32 = (value) => `${Number(value) >>> 0}u`;

/**
 * Transactional S9 continuum-surface-stress adapter.
 *
 * This is a separate dispatch because embedding the additional Cartesian
 * neighbor traversal in the already-large pressure/drag stage exceeds a
 * native Vulkan pipeline-compiler limit on the supported browser stack. It
 * adds no retained buffer or readback: it consumes the already authenticated
 * field/moment/material inputs and rewrites only its own sealed scratch row
 * between the existing stage and validate dispatches. Nine central-bond
 * families use two-color passes, making every reciprocal update race-free and
 * torque-free without atomics.
 */
export const schroederSpatialPhaseVolumeSurfaceStressTransportWgsl =
/* wgsl */ `
struct PhaseVolumeSurfaceStressParams {
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
  surface_stress_enabled: u32,
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

struct SurfacePhaseMechanics {
  rest_density: f32,
  surface_tension: f32,
  status: f32,
};

@group(0) @binding(0) var<storage, read_write> field_view: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> moment_rows: array<u32>;
@group(0) @binding(5) var<storage, read> material_phase_records: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: PhaseVolumeSurfaceStressParams;
@group(0) @binding(7) var<storage, read_write> transport_scratch: array<atomic<u32>>;

${schroederSpatialPhaseVolumeSurfaceStressOperatorWgsl}

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
const FIELD_STATE_EMPTY: u32 = ${u32(
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY
)};
const FIELD_HEADER_KEY_WORDS: u32 = 4u;
const FIELD_STATE_WORDS: u32 = 8u;
const FIELD_ACCUMULATOR_WORDS: u32 = 8u;
const MOMENT_ROW_WORDS: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS
)};
const MOMENT_READY_ADMITTED: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY
    | SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED
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
const SCRATCH_PRESSURE_J: u32 = 5u;
const SCRATCH_AMBIENT_X: u32 = 6u;
const SCRATCH_AMBIENT_Y: u32 = 7u;
const SCRATCH_AMBIENT_Z: u32 = 8u;
const SCRATCH_AMBIENT_WORK_J: u32 = 9u;
const SCRATCH_STATUS: u32 = 10u;
const SCRATCH_SEAL: u32 = 11u;
const SCRATCH_MAX_FIELD_CAPACITY: u32 = 357913940u;
const INVALID_FIELD: u32 = 0xffffffffu;
const PHASE_GAS: u32 = 3u;
const ACC_PRESSURE_COMPENSATION: u32 = ${u32(
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR
    .localPressureInternalCompensationJ
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

fn surface_finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn surface_finite_vec3(value: vec3<f32>) -> bool {
  return surface_finite_f32(value.x)
    && surface_finite_f32(value.y)
    && surface_finite_f32(value.z);
}

fn field_load(word: u32) -> u32 {
  return atomicLoad(&field_view[word]);
}

fn field_store(word: u32, value: u32) {
  atomicStore(&field_view[word], value);
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

fn reject_surface_stress() {
  if (arrayLength(&field_view) < FIELD_HEADER_WORDS) { return; }
  field_store(2u, FIELD_FAIL_CLOSED);
  field_store(57u, 0u);
  field_store(59u, FIELD_STATE_EMPTY);
  field_store(63u, params.field_mutation_input_ordinal);
}

fn field_admitted() -> bool {
  return params.surface_stress_enabled == 1u
    && params.grid_nx > 0u
    && params.grid_ny > 0u
    && params.grid_nz > 0u
    && params.grid_nx * params.grid_ny * params.grid_nz
      == params.grid_node_count
    && params.field_capacity > 0u
    && params.phase_record_count > 0u
    && params.dt > 0.0
    && surface_finite_f32(params.dt)
    && params.grid_spacing_m > 0.0
    && surface_finite_f32(params.grid_spacing_m)
    && params.cfl_factor >= 0.0
    && surface_finite_f32(params.cfl_factor)
    && params.max_impulse_fraction >= 0.0
    && surface_finite_f32(params.max_impulse_fraction)
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
    && field_load(27u) == FIELD_HEADER_KEY_WORDS
    && field_load(32u) == params.field_capacity
    && field_load(34u) <= params.field_capacity
    && field_load(38u) == params.field_completion_ordinal
    && field_load(57u) == 1u
    && field_load(59u) == FIELD_STATE_EMPTY
    && field_load(63u) == params.field_mutation_output_ordinal;
}

fn field_key(field_index: u32) -> u32 {
  return field_load(26u) + field_index * FIELD_HEADER_KEY_WORDS;
}

fn field_state(field_index: u32) -> u32 {
  return field_load(30u) + field_index * FIELD_STATE_WORDS;
}

fn field_accumulator(field_index: u32) -> u32 {
  return field_load(28u) + field_index * FIELD_ACCUMULATOR_WORDS;
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

fn field_gradient(field_index: u32) -> vec3<f32> {
  let row = field_index * MOMENT_ROW_WORDS;
  return vec3<f32>(
    bitcast<f32>(moment_rows[row + 5u]),
    bitcast<f32>(moment_rows[row + 6u]),
    bitcast<f32>(moment_rows[row + 7u])
  );
}

fn field_volume(field_index: u32) -> f32 {
  return bitcast<f32>(
    moment_rows[
      field_index * MOMENT_ROW_WORDS + 4u
    ]
  );
}

fn moment_valid(field_index: u32) -> bool {
  let row = field_index * MOMENT_ROW_WORDS;
  let key = field_key(field_index);
  if (field_index >= field_load(34u)
      || row + MOMENT_ROW_WORDS > arrayLength(&moment_rows)) {
    return false;
  }
  let volume = bitcast<f32>(moment_rows[row + 4u]);
  return moment_rows[row] == field_load(key)
    && moment_rows[row + 1u] == field_load(key + 1u)
    && moment_rows[row + 2u] == field_load(key + 2u)
    && moment_rows[row + 3u] == field_load(key + 3u)
    && volume > 0.0
    && surface_finite_f32(volume)
    && surface_finite_vec3(field_gradient(field_index))
    && moment_rows[row + 8u] > 0u
    && moment_rows[row + 9u] == MOMENT_READY_ADMITTED;
}

fn phase_mechanics(
  material_id: u32,
  phase_id: u32
) -> SurfacePhaseMechanics {
  for (
    var record = 0u;
    record < params.phase_record_count;
    record = record + 1u
  ) {
    let row0 = material_phase_records[record * 3u];
    if (row0.x == f32(material_id) && row0.y == f32(phase_id)) {
      let row2 = material_phase_records[record * 3u + 2u];
      return SurfacePhaseMechanics(row0.z, row2.w, row2.y);
    }
  }
  return SurfacePhaseMechanics(0.0, 0.0, 255.0);
}

fn field_material_valid(field_index: u32) -> bool {
  let key = field_key(field_index);
  let mechanics = phase_mechanics(
    field_load(key + 2u),
    field_load(key + 1u)
  );
  return field_load(key + 1u) >= 1u
    && field_load(key + 1u) <= 4u
    && field_load(key + 2u) != 0u
    && mechanics.status == 1.0
    && mechanics.rest_density > 0.0
    && mechanics.surface_tension >= 0.0
    && surface_finite_f32(mechanics.rest_density)
    && surface_finite_f32(mechanics.surface_tension);
}

fn field_row_valid(field_index: u32) -> bool {
  if (field_index >= field_load(34u)) { return false; }
  let state = field_state(field_index);
  let mass = field_mass(field_index);
  return mass > 0.0
    && surface_finite_f32(mass)
    && surface_finite_vec3(field_velocity(field_index))
    && field_load(state + 7u) > 0u
    && moment_valid(field_index)
    && field_material_valid(field_index);
}

fn field_full_key_less(field_index: u32, key: vec4<u32>) -> bool {
  let row = field_key(field_index);
  let word0 = field_load(row);
  if (word0 != key.x) { return word0 < key.x; }
  let word1 = field_load(row + 1u);
  if (word1 != key.y) { return word1 < key.y; }
  let word2 = field_load(row + 2u);
  if (word2 != key.z) { return word2 < key.z; }
  return field_load(row + 3u) < key.w;
}

fn find_field_key(key: vec4<u32>) -> u32 {
  var low = 0u;
  var high = field_load(34u);
  loop {
    if (low >= high) { break; }
    let middle = low + (high - low) / 2u;
    if (field_full_key_less(middle, key)) {
      low = middle + 1u;
    } else {
      high = middle;
    }
  }
  if (low >= field_load(34u)) { return INVALID_FIELD; }
  let row = field_key(low);
  return select(
    INVALID_FIELD,
    low,
    field_load(row) == key.x
      && field_load(row + 1u) == key.y
      && field_load(row + 2u) == key.z
      && field_load(row + 3u) == key.w
  );
}

fn node_axis_coordinate(node: u32, axis: u32) -> u32 {
  let yz = params.grid_ny * params.grid_nz;
  let x = node / yz;
  let remainder = node - x * yz;
  let y = remainder / params.grid_nz;
  let z = remainder - y * params.grid_nz;
  if (axis == 0u) { return x; }
  if (axis == 1u) { return y; }
  return z;
}

fn surface_stress_bond_delta(bond: u32) -> vec3<i32> {
  if (bond == 0u) { return vec3<i32>(1, 0, 0); }
  if (bond == 1u) { return vec3<i32>(0, 1, 0); }
  if (bond == 2u) { return vec3<i32>(0, 0, 1); }
  if (bond == 3u) { return vec3<i32>(1, 1, 0); }
  if (bond == 4u) { return vec3<i32>(1, -1, 0); }
  if (bond == 5u) { return vec3<i32>(1, 0, 1); }
  if (bond == 6u) { return vec3<i32>(1, 0, -1); }
  if (bond == 7u) { return vec3<i32>(0, 1, 1); }
  return vec3<i32>(0, 1, -1);
}

fn surface_stress_bond_neighbor(node: u32, bond: u32) -> u32 {
  let yz = params.grid_ny * params.grid_nz;
  let x = node / yz;
  let remainder = node - x * yz;
  let y = remainder / params.grid_nz;
  let z = remainder - y * params.grid_nz;
  let delta = surface_stress_bond_delta(bond);
  let neighbor_x = i32(x) + delta.x;
  let neighbor_y = i32(y) + delta.y;
  let neighbor_z = i32(z) + delta.z;
  if (neighbor_x < 0
      || neighbor_y < 0
      || neighbor_z < 0
      || neighbor_x >= i32(params.grid_nx)
      || neighbor_y >= i32(params.grid_ny)
      || neighbor_z >= i32(params.grid_nz)) {
    return INVALID_FIELD;
  }
  return u32(neighbor_x) * yz
    + u32(neighbor_y) * params.grid_nz
    + u32(neighbor_z);
}

fn surface_stress_bond_axis(bond: u32) -> vec3<f32> {
  return vec3<f32>(surface_stress_bond_delta(bond));
}

fn surface_stress_bond_component_axes(bond: u32) -> vec2<u32> {
  if (bond == 0u) { return vec2<u32>(0u, 0u); }
  if (bond == 1u) { return vec2<u32>(1u, 1u); }
  if (bond == 2u) { return vec2<u32>(2u, 2u); }
  if (bond <= 4u) { return vec2<u32>(0u, 1u); }
  if (bond <= 6u) { return vec2<u32>(0u, 2u); }
  return vec2<u32>(1u, 2u);
}

fn surface_stress_bond_component_sign(bond: u32) -> f32 {
  return select(1.0, -1.0, bond == 4u || bond == 6u || bond == 8u);
}

fn surface_stress_bond_length_cells(bond: u32) -> f32 {
  return select(1.0, 1.4142135623730951, bond >= 3u);
}

fn surface_stress_bond_parity_axis(bond: u32) -> u32 {
  if (bond == 1u || bond >= 7u) { return 1u; }
  if (bond == 2u) { return 2u; }
  return 0u;
}

fn scratch_velocity(field_index: u32) -> vec3<f32> {
  let row = scratch_row(field_index);
  return vec3<f32>(
    bitcast<f32>(scratch_load(row + SCRATCH_VELOCITY_X)),
    bitcast<f32>(scratch_load(row + SCRATCH_VELOCITY_Y)),
    bitcast<f32>(scratch_load(row + SCRATCH_VELOCITY_Z))
  );
}

fn scratch_row_seal(field_index: u32) -> u32 {
  let row = scratch_row(field_index);
  var seal = SCRATCH_ROW_READY ^ field_index;
  for (var word = 0u; word <= SCRATCH_STATUS; word = word + 1u) {
    seal = seal ^ scratch_load(row + word);
  }
  return seal;
}

fn scratch_row_valid(field_index: u32) -> bool {
  let row = scratch_row(field_index);
  if (row + SCRATCH_ROW_WORDS > arrayLength(&transport_scratch)
      || scratch_load(row + SCRATCH_STATUS) != SCRATCH_ROW_READY
      || scratch_load(row + SCRATCH_SEAL) != scratch_row_seal(field_index)) {
    return false;
  }
  for (var word = 0u; word <= 9u; word = word + 1u) {
    if (!surface_finite_f32(bitcast<f32>(scratch_load(row + word)))) {
      return false;
    }
  }
  return true;
}

fn scratch_set_velocity(field_index: u32, velocity: vec3<f32>) -> bool {
  if (!surface_finite_vec3(velocity)) { return false; }
  let row = scratch_row(field_index);
  scratch_store(row + SCRATCH_VELOCITY_X, bitcast<u32>(velocity.x));
  scratch_store(row + SCRATCH_VELOCITY_Y, bitcast<u32>(velocity.y));
  scratch_store(row + SCRATCH_VELOCITY_Z, bitcast<u32>(velocity.z));
  return true;
}

fn scratch_add_compensation(field_index: u32, value: f32) -> bool {
  if (!surface_finite_f32(value)) { return false; }
  let word = scratch_row(field_index) + SCRATCH_PRESSURE_J;
  let prior = bitcast<f32>(scratch_load(word));
  let next = prior + value;
  if (!surface_finite_f32(prior) || !surface_finite_f32(next)) {
    return false;
  }
  scratch_store(word, bitcast<u32>(next));
  return true;
}

fn scratch_add_f32(field_index: u32, offset: u32, value: f32) -> bool {
  if (!surface_finite_f32(value)) { return false; }
  let word = scratch_row(field_index) + offset;
  let prior = bitcast<f32>(scratch_load(word));
  let next = prior + value;
  if (!surface_finite_f32(prior) || !surface_finite_f32(next)) {
    return false;
  }
  scratch_store(word, bitcast<u32>(next));
  return true;
}

fn stage_same_level_ambient_buoyancy(field_index: u32) -> bool {
  let phase_id = field_load(field_key(field_index) + 1u);
  if (phase_id < PHASE_GAS || params.ambient_density_kg_per_m3 <= 0.0) {
    return true;
  }
  let mass = field_mass(field_index);
  let volume = field_volume(field_index);
  let initial_velocity = scratch_velocity(field_index);
  var impulse = -params.ambient_density_kg_per_m3
    * volume
    * vec3<f32>(params.gravity_x, params.gravity_y, params.gravity_z)
    * params.dt;
  let max_speed = max(
    1.0e-6,
    params.cfl_factor * params.grid_spacing_m / max(params.dt, 1.0e-12)
  );
  let max_impulse =
    max(0.0, params.max_impulse_fraction) * mass * max_speed;
  let impulse_length = length(impulse);
  if (impulse_length > max_impulse && impulse_length > 0.0) {
    impulse = impulse * (max_impulse / impulse_length);
  }
  let velocity = initial_velocity + impulse / mass;
  let kinetic_before =
    0.5 * mass * dot(initial_velocity, initial_velocity);
  let kinetic_after = 0.5 * mass * dot(velocity, velocity);
  let work_j = kinetic_after - kinetic_before;
  if (!surface_finite_f32(volume)
      || !(volume > 0.0)
      || !surface_finite_vec3(impulse)
      || !surface_finite_vec3(velocity)
      || !surface_finite_f32(work_j)
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

fn initialize_surface_stress_row(field_index: u32) -> bool {
  if (!field_row_valid(field_index)) { return false; }
  let row = scratch_row(field_index);
  let velocity = field_velocity(field_index);
  let prior_compensation = bitcast<f32>(
    field_load(
      field_accumulator(field_index) + ACC_PRESSURE_COMPENSATION
    )
  );
  let prior_ambient_x = bitcast<f32>(
    field_load(field_accumulator(field_index) + ACC_AMBIENT_IMPULSE_X)
  );
  let prior_ambient_y = bitcast<f32>(
    field_load(field_accumulator(field_index) + ACC_AMBIENT_IMPULSE_Y)
  );
  let prior_ambient_z = bitcast<f32>(
    field_load(field_accumulator(field_index) + ACC_AMBIENT_IMPULSE_Z)
  );
  let prior_ambient_work = bitcast<f32>(
    field_load(field_accumulator(field_index) + ACC_AMBIENT_WORK)
  );
  if (!surface_finite_vec3(velocity)
      || !surface_finite_f32(prior_compensation)
      || !surface_finite_f32(prior_ambient_x)
      || !surface_finite_f32(prior_ambient_y)
      || !surface_finite_f32(prior_ambient_z)
      || !surface_finite_f32(prior_ambient_work)) {
    return false;
  }
  for (var word = 0u; word < SCRATCH_ROW_WORDS; word = word + 1u) {
    scratch_store(row + word, 0u);
  }
  scratch_store(row + SCRATCH_VELOCITY_X, bitcast<u32>(velocity.x));
  scratch_store(row + SCRATCH_VELOCITY_Y, bitcast<u32>(velocity.y));
  scratch_store(row + SCRATCH_VELOCITY_Z, bitcast<u32>(velocity.z));
  scratch_store(
    row + SCRATCH_PRESSURE_J,
    bitcast<u32>(prior_compensation)
  );
  scratch_store(row + SCRATCH_AMBIENT_X, bitcast<u32>(prior_ambient_x));
  scratch_store(row + SCRATCH_AMBIENT_Y, bitcast<u32>(prior_ambient_y));
  scratch_store(row + SCRATCH_AMBIENT_Z, bitcast<u32>(prior_ambient_z));
  scratch_store(
    row + SCRATCH_AMBIENT_WORK_J,
    bitcast<u32>(prior_ambient_work)
  );
  if (!stage_same_level_ambient_buoyancy(field_index)) {
    return false;
  }
  scratch_store(row + SCRATCH_STATUS, SCRATCH_ROW_READY);
  scratch_store(row + SCRATCH_SEAL, scratch_row_seal(field_index));
  return true;
}

fn stage_surface_stress_pair(
  field_index: u32,
  bond: u32,
  parity: u32
) -> bool {
  if (!field_row_valid(field_index)) {
    return false;
  }
  let key_row = field_key(field_index);
  let node = field_load(key_row);
  let coordinate = node_axis_coordinate(
    node,
    surface_stress_bond_parity_axis(bond)
  );
  if (coordinate % 2u != parity) { return true; }
  let neighbor_node = surface_stress_bond_neighbor(node, bond);
  if (neighbor_node == INVALID_FIELD) { return true; }
  let phase_id = field_load(key_row + 1u);
  let material_id = field_load(key_row + 2u);
  let domain_id = field_load(key_row + 3u);
  let neighbor = find_field_key(vec4<u32>(
    neighbor_node,
    phase_id,
    material_id,
    domain_id
  ));
  if (neighbor == INVALID_FIELD) { return true; }
  if (!field_row_valid(neighbor)
      || !scratch_row_valid(field_index)
      || !scratch_row_valid(neighbor)) {
    return false;
  }
  let mechanics = phase_mechanics(material_id, phase_id);
  if (mechanics.surface_tension == 0.0) { return true; }

  let left_mass = field_mass(field_index);
  let right_mass = field_mass(neighbor);
  let component_axes = surface_stress_bond_component_axes(bond);
  let bond_result = schroeder_phase_volume_surface_stress_bond(
    left_mass,
    right_mass,
    1.0 / left_mass,
    1.0 / right_mass,
    field_gradient(field_index),
    field_gradient(neighbor),
    mechanics.surface_tension,
    mechanics.surface_tension,
    surface_stress_bond_axis(bond),
    component_axes.x,
    component_axes.y,
    surface_stress_bond_component_sign(bond),
    surface_stress_bond_length_cells(bond),
    params.max_impulse_fraction / 18.0,
    params.grid_spacing_m,
    params.dt,
    params.cfl_factor
  );
  if (bond_result.valid != 1u) { return false; }
  let impulse_ns = bond_result.bond_impulse_ns;
  if (all(impulse_ns == vec3<f32>(0.0))) { return true; }

  let left_initial_velocity = scratch_velocity(field_index);
  let right_initial_velocity = scratch_velocity(neighbor);
  let left_velocity = left_initial_velocity + impulse_ns / left_mass;
  let right_velocity = right_initial_velocity - impulse_ns / right_mass;
  let left_kinetic_before =
    0.5 * left_mass * dot(left_initial_velocity, left_initial_velocity);
  let right_kinetic_before =
    0.5 * right_mass * dot(right_initial_velocity, right_initial_velocity);
  let left_kinetic_after =
    0.5 * left_mass * dot(left_velocity, left_velocity);
  let right_kinetic_after =
    0.5 * right_mass * dot(right_velocity, right_velocity);
  let left_compensation_j =
    -(left_kinetic_after - left_kinetic_before);
  let right_compensation_j =
    -(right_kinetic_after - right_kinetic_before);
  if (!surface_finite_vec3(left_velocity)
      || !surface_finite_vec3(right_velocity)
      || !surface_finite_f32(left_compensation_j)
      || !surface_finite_f32(right_compensation_j)) {
    return false;
  }

  let left_row = scratch_row(field_index);
  let right_row = scratch_row(neighbor);
  scratch_store(left_row + SCRATCH_STATUS, 0u);
  scratch_store(left_row + SCRATCH_SEAL, 0u);
  scratch_store(right_row + SCRATCH_STATUS, 0u);
  scratch_store(right_row + SCRATCH_SEAL, 0u);
  if (!scratch_add_compensation(field_index, left_compensation_j)
      || !scratch_add_compensation(neighbor, right_compensation_j)
      || !scratch_set_velocity(field_index, left_velocity)
      || !scratch_set_velocity(neighbor, right_velocity)) {
    return false;
  }
  scratch_store(left_row + SCRATCH_STATUS, SCRATCH_ROW_READY);
  scratch_store(left_row + SCRATCH_SEAL, scratch_row_seal(field_index));
  scratch_store(right_row + SCRATCH_STATUS, SCRATCH_ROW_READY);
  scratch_store(right_row + SCRATCH_SEAL, scratch_row_seal(neighbor));
  return true;
}

fn dispatch_surface_stress_pass(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>,
  bond: u32,
  parity: u32
) {
  let linear_group =
    workgroup_id.x + workgroup_id.y * field_load(60u);
  let field_index =
    linear_group * ${u32(
      SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE
    )} + local_id.x;
  if (!field_admitted() || !scratch_admitted()) {
    reject_scratch();
    return;
  }
  if (field_index >= field_load(34u)) { return; }
  if (scratch_load(SCRATCH_FAILURE_WORD) != 0u
      || !stage_surface_stress_pair(field_index, bond, parity)) {
    reject_scratch();
  }
  _ = bond;
  _ = parity;
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn initialize_surface_stress(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group =
    workgroup_id.x + workgroup_id.y * field_load(60u);
  let field_index =
    linear_group * ${u32(
      SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE
    )} + local_id.x;
  if (!field_admitted() || !scratch_admitted()) {
    reject_scratch();
    return;
  }
  if (field_index >= field_load(34u)) { return; }
  if (scratch_load(SCRATCH_FAILURE_WORD) != 0u
      || !initialize_surface_stress_row(field_index)) {
    reject_scratch();
  }
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_x_even(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  dispatch_surface_stress_pass(local_id, workgroup_id, 0u, 0u);
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_x_odd(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  dispatch_surface_stress_pass(local_id, workgroup_id, 0u, 1u);
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_y_even(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  dispatch_surface_stress_pass(local_id, workgroup_id, 1u, 0u);
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_y_odd(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  dispatch_surface_stress_pass(local_id, workgroup_id, 1u, 1u);
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_z_even(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  dispatch_surface_stress_pass(local_id, workgroup_id, 2u, 0u);
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_z_odd(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  dispatch_surface_stress_pass(local_id, workgroup_id, 2u, 1u);
}

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_xy_positive_even(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) { dispatch_surface_stress_pass(local_id, workgroup_id, 3u, 0u); }

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_xy_positive_odd(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) { dispatch_surface_stress_pass(local_id, workgroup_id, 3u, 1u); }

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_xy_negative_even(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) { dispatch_surface_stress_pass(local_id, workgroup_id, 4u, 0u); }

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_xy_negative_odd(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) { dispatch_surface_stress_pass(local_id, workgroup_id, 4u, 1u); }

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_xz_positive_even(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) { dispatch_surface_stress_pass(local_id, workgroup_id, 5u, 0u); }

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_xz_positive_odd(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) { dispatch_surface_stress_pass(local_id, workgroup_id, 5u, 1u); }

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_xz_negative_even(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) { dispatch_surface_stress_pass(local_id, workgroup_id, 6u, 0u); }

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_xz_negative_odd(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) { dispatch_surface_stress_pass(local_id, workgroup_id, 6u, 1u); }

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_yz_positive_even(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) { dispatch_surface_stress_pass(local_id, workgroup_id, 7u, 0u); }

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_yz_positive_odd(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) { dispatch_surface_stress_pass(local_id, workgroup_id, 7u, 1u); }

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_yz_negative_even(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) { dispatch_surface_stress_pass(local_id, workgroup_id, 8u, 0u); }

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn stage_surface_stress_yz_negative_odd(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) { dispatch_surface_stress_pass(local_id, workgroup_id, 8u, 1u); }

@compute @workgroup_size(${SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE})
fn validate_surface_stress(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group =
    workgroup_id.x + workgroup_id.y * field_load(60u);
  let field_index =
    linear_group * ${u32(
      SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE
    )} + local_id.x;
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
fn commit_surface_stress(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group =
    workgroup_id.x + workgroup_id.y * field_load(60u);
  let field_index =
    linear_group * ${u32(
      SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE
    )} + local_id.x;
  if (!scratch_admitted()
      || scratch_load(SCRATCH_FAILURE_WORD) != 0u) {
    if (field_index == 0u) { reject_surface_stress(); }
    return;
  }
  if (field_index >= field_load(34u)) { return; }
  // Validation ran in a prior dispatch, so this pass is store-only.
  let row = scratch_row(field_index);
  let state = field_state(field_index);
  let accumulator = field_accumulator(field_index);
  field_store(state + 1u, scratch_load(row + SCRATCH_VELOCITY_X));
  field_store(state + 2u, scratch_load(row + SCRATCH_VELOCITY_Y));
  field_store(state + 3u, scratch_load(row + SCRATCH_VELOCITY_Z));
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
