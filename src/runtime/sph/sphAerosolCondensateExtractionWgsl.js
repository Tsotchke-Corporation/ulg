import { sphPhaseCarrierThermodynamicsWgsl } from './sphPhaseCarrierThermodynamicsWgsl.js';
import { sphGasConstitutiveWgsl } from '../../../ulg-gpu-abi/src/sphGasConstitutiveWgsl.js';

export const SPH_AEROSOL_CONDENSATE_EXTRACTION_ERROR = Object.freeze({
  LAYOUT: 1,
  REQUEST: 2,
  SOURCE: 4,
  PRIOR: 8,
  CLOSURE: 16,
  PHASE: 32,
  ENERGY: 64,
  MECHANICS: 128,
  NUMERIC: 256
});

// A declaration of already-activated physical nuclei, not a nucleation law.
// The host owns immutable source buffers, unique IDs, the initialized header,
// and one-shot paired adoption. Neither shader can mutate those source owners.
const commonWgsl = /* wgsl */ `
struct CondensateParams {
  particle_count: u32,
  lineage_capacity: u32,
  request_count: u32,
  source_capacity: u32,
  target_capacity: u32,
  source_generation: u32,
  target_generation: u32,
  topology_epoch: u32,
  thermal_segment_count: u32,
  mechanics_record_count: u32,
  thermal_offset_vec4: u32,
  mechanics_offset_vec4: u32,
  material_record_count: u32,
  material_record_offset_vec4: u32,
  absolute_pressure_authority: u32,
  reserved0: u32,
  fraction_validation_epsilon: f32,
  relative_tolerance: f32,
  mass_epsilon: f32,
  fraction_activation_epsilon: f32,
  reserved1: u32,
  reserved2: u32,
  reserved3: u32,
  reserved4: u32,
};
const EXTRACTION_MAGIC: u32 = 0x41455830u;
const EXTRACTION_VERSION: u32 = 0u;
const ERROR_LAYOUT: u32 = 1u;
const ERROR_REQUEST: u32 = 2u;
const ERROR_SOURCE: u32 = 4u;
const ERROR_PRIOR: u32 = 8u;
const ERROR_CLOSURE: u32 = 16u;
const ERROR_PHASE: u32 = 32u;
const ERROR_ENERGY: u32 = 64u;
const ERROR_MECHANICS: u32 = 128u;
const ERROR_NUMERIC: u32 = 256u;
const INVALID_INDEX: u32 = 0xffffffffu;

fn ce_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}
fn ce_positive(value: f32) -> bool {
  return ce_finite(value) && value > 0.0;
}
fn ce_nonnegative(value: f32) -> bool {
  return ce_finite(value) && value >= 0.0;
}
fn ce_index(value: f32) -> bool {
  return ce_nonnegative(value) && value <= 16777215.0 && floor(value) == value;
}
fn ce_near(a: f32, b: f32) -> bool {
  return ce_finite(a) && ce_finite(b)
    && abs(a - b) <= params.relative_tolerance * max(1.0, max(abs(a), abs(b)));
}
// Strictly relative for positive physical scales: a 2e-4 absolute volume
// tolerance would silently accept unrelated micrometre-scale rest volumes.
fn ce_relative(a: f32, b: f32) -> bool {
  return ce_positive(a) && ce_positive(b)
    && abs(a - b) <= params.relative_tolerance * max(abs(a), abs(b));
}
fn ce_range(offset: u32, count: u32, stride: u32, length: u32) -> bool {
  return offset <= length && count <= (length - offset) / stride;
}
fn ce_params_valid() -> bool {
  return params.particle_count > 0u && params.particle_count % 4u == 0u
    && params.lineage_capacity == params.particle_count / 4u
    && params.request_count > 0u && params.request_count <= params.lineage_capacity
    && params.target_capacity >= params.source_capacity
    && params.request_count <= params.target_capacity - params.source_capacity
    && params.source_generation < 0xffffffffu
    && params.target_generation == params.source_generation + 1u
    && params.absolute_pressure_authority == 1u
    && params.reserved0 == 0u && params.reserved1 == 0u
    && params.reserved2 == 0u && params.reserved3 == 0u && params.reserved4 == 0u
    && params.fraction_validation_epsilon == 1e-7
    && params.relative_tolerance == 2e-4
    && params.mass_epsilon == 1e-20
    && params.fraction_activation_epsilon == 0.0;
}
fn ce_header_valid() -> bool {
  return arrayLength(&scratch) >= 16u && ce_params_valid()
    && params.request_count <= (arrayLength(&scratch) - 16u) / 80u
    && atomicLoad(&scratch[0u]) == EXTRACTION_MAGIC
    && atomicLoad(&scratch[1u]) == EXTRACTION_VERSION
    && atomicLoad(&scratch[4u]) == params.request_count
    && atomicLoad(&scratch[5u]) == params.particle_count
    && atomicLoad(&scratch[6u]) == params.source_capacity
    && atomicLoad(&scratch[7u]) == params.target_capacity
    && atomicLoad(&scratch[8u]) == params.source_generation
    && atomicLoad(&scratch[9u]) == params.target_generation
    && atomicLoad(&scratch[10u]) == params.topology_epoch
    && atomicLoad(&scratch[12u]) == 0u && atomicLoad(&scratch[13u]) == 0u
    && atomicLoad(&scratch[14u]) == 0u && atomicLoad(&scratch[15u]) == 0u;
}
fn ce_fail(bits: u32) {
  if (arrayLength(&scratch) >= 16u) { atomicOr(&scratch[2u], bits); }
}
`;

export const sphAerosolCondensateProposalWgsl = commonWgsl + /* wgsl */ `
@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> prior_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> closure_rows: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> requests: array<u32>;
@group(0) @binding(6) var<storage, read_write> scratch: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params: CondensateParams;

${sphPhaseCarrierThermodynamicsWgsl}
${sphGasConstitutiveWgsl}

struct CondensateClosure {
  valid: u32,
  gas_record: u32,
  liquid_u: f32,
  gas_u: f32,
  liquid_density: f32,
  gas_density: f32,
  temperature: f32,
};

fn ce_closure_layout_valid() -> bool {
  let length = arrayLength(&closure_rows);
  let end = params.material_record_offset_vec4 + params.material_record_count * 2u;
  return params.thermal_segment_count > 0u && params.mechanics_record_count > 0u
    && (length == end || length == end + params.mechanics_record_count)
    && params.material_record_count > 0u && params.thermal_offset_vec4 == 0u
    && ce_range(0u, params.thermal_segment_count, 3u, length)
    && params.mechanics_offset_vec4 == params.thermal_segment_count * 3u
    && ce_range(params.mechanics_offset_vec4, params.mechanics_record_count, 3u, length)
    && params.material_record_offset_vec4
      == params.mechanics_offset_vec4 + params.mechanics_record_count * 3u
    && ce_range(params.material_record_offset_vec4, params.material_record_count, 2u, length);
}
fn ce_rows_finite(base: u32, count: u32) -> bool {
  for (var row = 0u; row < count; row = row + 1u) {
    for (var lane = 0u; lane < 4u; lane = lane + 1u) {
      if (!ce_finite(closure_rows[base + row][lane])) { return false; }
    }
  }
  return true;
}
fn ce_mechanics_record_valid(base: u32, phase: u32) -> bool {
  let r0 = closure_rows[base];
  let r1 = closure_rows[base + 1u];
  let r2 = closure_rows[base + 2u];
  return ce_rows_finite(base, 3u) && r0.y == f32(phase)
    && ce_positive(r0.z) && ce_nonnegative(r0.w)
    && r1.x == 0.0 && r1.y == 0.0 && ce_nonnegative(r1.z)
    && select(r1.w == 0.0 || r1.w == 1.0, r1.w == 2.0, phase == 3u)
    && r2.x == 0.0 && r2.y == 1.0 && ce_nonnegative(r2.z) && r2.w == 0.0;
}

fn ce_closure(material: f32, energy: f32, pressure: f32) -> CondensateClosure {
  var invalid: CondensateClosure;
  if (!ce_closure_layout_valid() || !ce_positive(pressure)) { return invalid; }
  var material_count = 0u;
  var segment_offset = 0u;
  var segment_count = 0u;
  for (var record = 0u; record < params.material_record_count; record = record + 1u) {
    let base = params.material_record_offset_vec4 + record * 2u;
    let r0 = closure_rows[base];
    if (r0.x != material) { continue; }
    material_count = material_count + 1u;
    let r1 = closure_rows[base + 1u];
    if (!ce_rows_finite(base, 2u) || r0.w != 1.0
        || !ce_index(r0.y) || !ce_index(r0.z) || r0.z == 0.0
        || r1.y != 1.0 || !ce_positive(r1.z) || !ce_positive(r1.w)) { return invalid; }
    segment_offset = u32(r0.y);
    segment_count = u32(r0.z);
    if (!ce_range(segment_offset, segment_count, 1u, params.thermal_segment_count)) { return invalid; }
  }
  if (material_count != 1u) { return invalid; }

  // Validate all possible matches used by the unchanged shared helper, not
  // merely the first ready row. An ambiguous or out-of-range law is unavailable.
  var plateau_count = 0u;
  var plateau_index = INVALID_INDEX;
  var plateau_start = 0.0;
  var reference_temperature = 0.0;
  var liquid_density = 0.0;
  var gas_density = 0.0;
  for (var segment = 0u; segment < params.thermal_segment_count; segment = segment + 1u) {
    let base = params.thermal_offset_vec4 + segment * 3u;
    let r0 = closure_rows[base];
    let in_range = segment >= segment_offset && segment - segment_offset < segment_count;
    if ((r0.x == material) != in_range) { return invalid; }
    if (r0.x != material || !(abs(r0.y - 2.0) < 0.5)
        || round(r0.z) != 2.0 || round(r0.w) != 3.0) { continue; }
    plateau_count = plateau_count + 1u;
    let r1 = closure_rows[base + 1u];
    let r2 = closure_rows[base + 2u];
    if (!ce_rows_finite(base, 3u) || r0.y != 2.0 || r0.z != 2.0 || r0.w != 3.0
        || !(r1.y > r1.x) || !ce_positive(r1.z) || r1.w != r1.z
        || !ce_positive(r2.x) || !ce_positive(r2.y) || r2.z != 1.0) { return invalid; }
    plateau_index = segment;
    plateau_start = r1.x;
    reference_temperature = r1.z;
    liquid_density = r2.x;
    gas_density = r2.y;
  }
  if (plateau_count != 1u || plateau_index == INVALID_INDEX) { return invalid; }
  var anchor_count = 0u;
  for (var segment = 0u; segment < params.thermal_segment_count; segment = segment + 1u) {
    let base = params.thermal_offset_vec4 + segment * 3u;
    let r0 = closure_rows[base];
    let r1 = closure_rows[base + 1u];
    if (r0.x != material || !(abs(r0.y - 1.0) < 0.5) || r1.y != plateau_start) { continue; }
    anchor_count = anchor_count + 1u;
    let r2 = closure_rows[base + 2u];
    if (!ce_rows_finite(base, 3u) || r0.y != 1.0 || r0.z != 2.0 || r0.w != 2.0
        || !(r1.y > r1.x) || !ce_positive(r1.z) || !(reference_temperature > r1.z)
        || r1.w != reference_temperature || r2.z != 1.0
        || !ce_relative(r2.x, liquid_density) || !ce_relative(r2.y, liquid_density)) { return invalid; }
  }
  if (anchor_count != 1u) { return invalid; }
  var gas_record = INVALID_INDEX;
  var liquid_record = INVALID_INDEX;
  for (var record = 0u; record < params.mechanics_record_count; record = record + 1u) {
    let base = params.mechanics_offset_vec4 + record * 3u;
    let r0 = closure_rows[base];
    if (r0.x != material) { continue; }
    if (round(r0.y) == 2.0) {
      if (liquid_record != INVALID_INDEX || !ce_mechanics_record_valid(base, 2u)
          || !ce_relative(r0.z, liquid_density)) { return invalid; }
      liquid_record = record;
    }
    if (round(r0.y) == 3.0) {
      if (gas_record != INVALID_INDEX || !ce_mechanics_record_valid(base, 3u)
          || !ce_relative(r0.z, gas_density)) { return invalid; }
      gas_record = record;
    }
  }
  if (gas_record == INVALID_INDEX || liquid_record == INVALID_INDEX) { return invalid; }
  let plateau = carrier_plateau_for(material, pressure);
  if (plateau.valid == 0u || !ce_positive(plateau.shifted_temperature_k)) { return invalid; }
  let liquid = plateau_endpoint(material, 2u, 3u, energy, 2u, pressure);
  let gas = plateau_endpoint(material, 2u, 3u, energy, 3u, pressure);
  if (liquid.y != 1.0 || gas.y != 1.0 || !ce_finite(liquid.x)
      || !ce_finite(gas.x) || !(gas.x > liquid.x)) { return invalid; }
  return CondensateClosure(1u, gas_record, liquid.x, gas.x,
    liquid_density, gas_density, plateau.shifted_temperature_k);
}

fn ce_request_valid(index: u32) -> bool {
  let base = index * 8u;
  if (requests[base] >= params.lineage_capacity
      || requests[base + 1u] < params.source_capacity
      || requests[base + 1u] >= params.target_capacity
      || (requests[base + 2u] | requests[base + 3u]) == 0u
      || (requests[base + 4u] | requests[base + 5u]) == 0u
      || (requests[base + 6u] | requests[base + 7u]) == 0u) { return false; }
  // Host static admission also checks uniqueness, including prior inventories.
  // This device check prevents a malformed batch from racing candidate writes.
  for (var other = 0u; other < params.request_count; other = other + 1u) {
    if (other == index) { continue; }
    let ob = other * 8u;
    if (requests[ob] == requests[base] || requests[ob + 1u] == requests[base + 1u]
        || (requests[ob + 4u] == requests[base + 4u] && requests[ob + 5u] == requests[base + 5u])
        || (requests[ob + 6u] == requests[base + 6u] && requests[ob + 7u] == requests[base + 7u])) { return false; }
  }
  return true;
}
fn ce_source_mechanics_valid(index: u32, mass: f32, closure: CondensateClosure) -> bool {
  let base = index * 8u;
  let record = params.mechanics_offset_vec4 + closure.gas_record * 3u;
  let r0 = closure_rows[record];
  let r1 = closure_rows[record + 1u];
  let r2 = closure_rows[record + 2u];
  let end = params.material_record_offset_vec4 + params.material_record_count * 2u;
  var c = r1.z;
  var prior_c = c;
  if (arrayLength(&closure_rows) > end) {
    c = gas_constitutive_sound_speed(closure_rows[end + closure.gas_record], source_thermo[index * 3u].z);
    prior_c = gas_constitutive_sound_speed(closure_rows[end + closure.gas_record], prior_thermo[index * 3u].z);
  }
  let m4 = source_mechanics[base + 4u];
  let m5 = source_mechanics[base + 5u];
  let m6 = source_mechanics[base + 6u];
  let m7 = source_mechanics[base + 7u];
  for (var word = 9u; word < 18u; word = word + 1u) {
    if (source_mechanics[base + word / 4u][word % 4u] != 0.0) { return false; }
  }
  let f0 = source_mechanics[base];
  let f1 = source_mechanics[base + 1u];
  let f2 = source_mechanics[base + 2u];
  let determinant_f = determinant(mat3x3<f32>(f0.xyz,
    vec3<f32>(f0.w, f1.xy), vec3<f32>(f1.zw, f2.x)));
  return ce_relative(determinant_f, m4.z)
    && ce_relative(m4.w, mass / closure.gas_density)
    && ce_positive(m4.z * m4.w)
    && m5.x == 0.0 && m5.y == 1.0
    && ce_near(m5.z, r0.w) && m5.w == 0.0
    // Thermal precedes extraction and final phase/mechanics refresh. A donor
    // may carry its authenticated predecessor c or an already-refreshed
    // reaction c. These are derived-state witnesses, not lineage authority.
    && c >= 0.0 && prior_c >= 0.0 && m6.x == 0.0
    && (ce_near(m6.y, c) || ce_near(m6.y, prior_c)) && m6.z == r1.w && m6.w == 1.0
    && ce_positive(m7.x) && ce_near(m7.y, r2.z) && m7.z == 0.0
    && ce_relative(m7.w, mass);
}

@compute @workgroup_size(64)
fn propose_condensate(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) groups: vec3<u32>
) {
  let index = id.x + groups.x * 64u * (id.y + groups.y * id.z);
  if (index >= params.request_count) { return; }
  if (!ce_header_valid() || atomicLoad(&scratch[11u]) != 0u
      || params.particle_count > arrayLength(&source_state) / 2u
      || params.particle_count > arrayLength(&source_thermo) / 3u
      || params.particle_count > arrayLength(&source_mechanics) / 8u
      || params.particle_count > arrayLength(&prior_thermo) / 3u
      || params.request_count > arrayLength(&requests) / 8u) { ce_fail(ERROR_LAYOUT); return; }
  let output = 16u + index * 80u;
  for (var word = 0u; word < 80u; word = word + 1u) { atomicStore(&scratch[output + word], 0u); }
  if (!ce_request_valid(index)) { ce_fail(ERROR_REQUEST); return; }
  let request = index * 8u;
  let lineage = requests[request];
  let donor = params.lineage_capacity * 2u + lineage;
  let s0 = source_state[donor * 2u];
  let s1 = source_state[donor * 2u + 1u];
  let t0 = source_thermo[donor * 3u];
  let fractions = source_thermo[donor * 3u + 1u];
  let t2 = source_thermo[donor * 3u + 2u];
  for (var lane = 0u; lane < 4u; lane = lane + 1u) {
    if (!ce_finite(s0[lane]) || !ce_finite(s1[lane]) || !ce_finite(t0[lane])
        || !ce_finite(fractions[lane]) || !ce_finite(t2[lane])) { ce_fail(ERROR_SOURCE); return; }
  }
  for (var row = 0u; row < 8u; row = row + 1u) {
    for (var lane = 0u; lane < 4u; lane = lane + 1u) {
      if (!ce_finite(source_mechanics[donor * 8u + row][lane])) { ce_fail(ERROR_MECHANICS); return; }
    }
  }
  if (!(s0.w > params.mass_epsilon) || !ce_index(t0.x) || t0.x == 0.0
      || !ce_positive(t0.z) || !ce_positive(t0.w) || !ce_positive(t2.x)
      || !ce_nonnegative(t2.y) || t2.z != 1.0 || !ce_positive(t2.w)) { ce_fail(ERROR_SOURCE); return; }
  let p0 = prior_thermo[donor * 3u];
  let pf = prior_thermo[donor * 3u + 1u];
  let p2 = prior_thermo[donor * 3u + 2u];
  for (var lane = 0u; lane < 4u; lane = lane + 1u) {
    if (!ce_finite(p0[lane]) || !ce_finite(pf[lane]) || !ce_finite(p2[lane])) { ce_fail(ERROR_PRIOR); return; }
  }
  if (p0.x != t0.x || p0.y != 3.0 || !ce_positive(p0.z) || !ce_positive(p0.w)
      || any(pf != vec4<f32>(0.0, 0.0, 1.0, 0.0)) || p2.z != 1.0) { ce_fail(ERROR_PRIOR); return; }
  if ((t0.y != 2.0 && t0.y != 3.0) || fractions.x != 0.0 || fractions.w != 0.0
      || !(fractions.y > 0.0) || !(fractions.z > 0.0)
      || fractions.y > 1.0 || fractions.z > 1.0
      || abs(fractions.y + fractions.z - 1.0) > params.fraction_validation_epsilon) { ce_fail(ERROR_PHASE); return; }
  let closure = ce_closure(t0.x, s1.w, source_mechanics[donor * 8u + 7u].x);
  if (closure.valid == 0u) { ce_fail(ERROR_CLOSURE); return; }
  if (!ce_source_mechanics_valid(donor, s0.w, closure)) { ce_fail(ERROR_MECHANICS); return; }
  let reconstructed = fractions.y * closure.liquid_u + fractions.z * closure.gas_u;
  if (!ce_near(reconstructed, s1.w) || !ce_near(t0.z, closure.temperature)) { ce_fail(ERROR_ENERGY); return; }

  let condensed_mass = s0.w * fractions.y;
  let residual_mass = s0.w - condensed_mass;
  let source_energy = s0.w * s1.w;
  let condensed_energy = condensed_mass * closure.liquid_u;
  let residual_energy = source_energy - condensed_energy;
  let residual_u = residual_energy / residual_mass;
  if (!ce_positive(condensed_mass) || !(residual_mass > params.mass_epsilon)
      || !ce_finite(source_energy) || !ce_finite(condensed_energy) || !ce_finite(residual_energy)
      || !ce_near(residual_u, closure.gas_u)
      || !ce_near(condensed_energy + residual_mass * residual_u, source_energy)) { ce_fail(ERROR_ENERGY); return; }
  let ratio = residual_mass / s0.w;
  let residual_entities = t2.y * ratio;
  let radius_cubed = pow(t2.w, 3.0) * ratio;
  let residual_radius = pow(radius_cubed, 1.0 / 3.0);
  let rest_volume = residual_mass / closure.gas_density;
  // f32 conversion is geometry-only. Exact physical N and both IDs stay u64.
  let population = f32(requests[request + 3u]) * 4294967296.0 + f32(requests[request + 2u]);
  let parcel_radius = exp((log(condensed_mass) - log(closure.liquid_density)
    - log(population) - 1.432411958301181) / 3.0);
  let condensed_volume = condensed_mass / closure.liquid_density;
  let geometric_cross_section = 0.75 * condensed_volume / parcel_radius;
  let source_kinetic_energy = 0.5 * s0.w * dot(s1.xyz, s1.xyz);
  if (!ce_positive(ratio) || !(ratio < 1.0) || !ce_nonnegative(residual_entities)
      || (t2.y > 0.0 && !(residual_entities > 0.0))
      || !ce_positive(radius_cubed) || !ce_positive(residual_radius)
      || !ce_positive(rest_volume) || !ce_positive(parcel_radius)
      || !ce_positive(condensed_volume) || !ce_positive(geometric_cross_section)
      || !ce_finite(source_kinetic_energy) || !ce_finite(source_energy + source_kinetic_energy)
      || !ce_positive(t0.z * s0.w)) { ce_fail(ERROR_NUMERIC); return; }
  for (var lane = 0u; lane < 3u; lane = lane + 1u) {
    if (!ce_finite(s0[lane] * s0.w) || !ce_finite(s1[lane] * s0.w)) { ce_fail(ERROR_NUMERIC); return; }
  }
  var row: array<u32, 80>;
  for (var word = 0u; word < 8u; word = word + 1u) {
    row[word] = bitcast<u32>(source_state[donor * 2u + word / 4u][word % 4u]);
  }
  for (var word = 0u; word < 12u; word = word + 1u) {
    row[8u + word] = bitcast<u32>(source_thermo[donor * 3u + word / 4u][word % 4u]);
  }
  for (var word = 0u; word < 32u; word = word + 1u) {
    row[20u + word] = bitcast<u32>(source_mechanics[donor * 8u + word / 4u][word % 4u]);
  }
  row[3u] = bitcast<u32>(residual_mass);
  row[7u] = bitcast<u32>(residual_u);
  row[9u] = bitcast<u32>(3.0);
  row[11u] = bitcast<u32>(closure.gas_density);
  row[12u] = 0u; row[13u] = 0u; row[14u] = bitcast<u32>(1.0); row[15u] = 0u;
  row[17u] = bitcast<u32>(residual_entities);
  row[19u] = bitcast<u32>(residual_radius);
  row[39u] = bitcast<u32>(rest_volume);
  let gas_tail = params.material_record_offset_vec4 + params.material_record_count * 2u;
  if (arrayLength(&closure_rows) > gas_tail) {
    // Current T was validated against the caloric closure above. Refresh only
    // derived c; preserve F/C/J and every conserved mass/energy/momentum lane.
    row[45u] = bitcast<u32>(gas_constitutive_sound_speed(
      closure_rows[gas_tail + closure.gas_record], t0.z));
  }
  row[51u] = bitcast<u32>(residual_mass);
  row[52u] = bitcast<u32>(s0.x); row[53u] = bitcast<u32>(s0.y); row[54u] = bitcast<u32>(s0.z);
  row[55u] = bitcast<u32>(condensed_mass);
  row[56u] = bitcast<u32>(s1.x); row[57u] = bitcast<u32>(s1.y); row[58u] = bitcast<u32>(s1.z);
  row[59u] = bitcast<u32>(closure.liquid_u);
  row[60u] = bitcast<u32>(t0.z);
  row[61u] = bitcast<u32>(closure.liquid_density);
  row[62u] = bitcast<u32>(parcel_radius);
  row[64u] = u32(t0.x); row[65u] = 2u;
  row[66u] = requests[request + 2u]; row[67u] = requests[request + 3u];
  row[68u] = requests[request + 4u]; row[69u] = requests[request + 5u];
  row[70u] = lineage; row[71u] = params.topology_epoch;
  row[72u] = requests[request + 6u]; row[73u] = requests[request + 7u];
  row[74u] = 1u; row[75u] = 2u;
  row[76u] = donor; row[77u] = requests[request + 1u]; row[78u] = 1u;
  for (var word = 0u; word < 80u; word = word + 1u) {
    atomicStore(&scratch[output + word], row[word]);
  }
  atomicAdd(&scratch[3u], 1u);
}
`;

export const sphAerosolCondensateApplyWgsl = commonWgsl + /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> scratch: array<atomic<u32>>;
@group(0) @binding(1) var<storage, read_write> residual_state: array<u32>;
@group(0) @binding(2) var<storage, read_write> residual_thermo: array<u32>;
@group(0) @binding(3) var<storage, read_write> residual_mechanics: array<u32>;
@group(0) @binding(4) var<storage, read_write> successor_parcels: array<u32>;
@group(0) @binding(5) var<uniform> params: CondensateParams;

@compute @workgroup_size(64)
fn apply_condensate(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) groups: vec3<u32>
) {
  let index = id.x + groups.x * 64u * (id.y + groups.y * id.z);
  if (index >= params.request_count) { return; }
  // These checks are batch-uniform. No validation failure may arise after some
  // invocations have begun writing a candidate. Proposal is a prior dispatch;
  // readyCount is published only after each complete per-request row is saved.
  if (!ce_header_valid()
      || params.particle_count > arrayLength(&residual_state) / 8u
      || params.particle_count > arrayLength(&residual_thermo) / 12u
      || params.particle_count > arrayLength(&residual_mechanics) / 32u
      || params.target_capacity > arrayLength(&successor_parcels) / 24u) { ce_fail(ERROR_LAYOUT); return; }
  if (atomicLoad(&scratch[2u]) != 0u || atomicLoad(&scratch[3u]) != params.request_count) { return; }
  let row = 16u + index * 80u;
  let donor = atomicLoad(&scratch[row + 76u]);
  let parcel = atomicLoad(&scratch[row + 77u]);
  // Private proposal scratch is never exposed as a mutable caller resource.
  // One unique request owns each donor and appended parcel destination.
  for (var word = 0u; word < 8u; word = word + 1u) {
    residual_state[donor * 8u + word] = atomicLoad(&scratch[row + word]);
  }
  for (var word = 0u; word < 12u; word = word + 1u) {
    residual_thermo[donor * 12u + word] = atomicLoad(&scratch[row + 8u + word]);
  }
  for (var word = 0u; word < 32u; word = word + 1u) {
    residual_mechanics[donor * 32u + word] = atomicLoad(&scratch[row + 20u + word]);
  }
  for (var word = 0u; word < 24u; word = word + 1u) {
    successor_parcels[parcel * 24u + word] = atomicLoad(&scratch[row + 52u + word]);
  }
  // Never use this changing counter as a per-invocation gate in this dispatch.
  atomicAdd(&scratch[11u], 1u);
}
`;
