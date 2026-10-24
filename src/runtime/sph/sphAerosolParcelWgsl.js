import {
  SPH_AEROSOL_BUDGET_ERROR as ERROR,
  SPH_AEROSOL_BUDGET_MAGIC,
  SPH_AEROSOL_BUDGET_VERSION
} from '../../../ulg-gpu-abi/src/sphAerosolParcel.js';

const commonWgsl = `
struct AerosolParams {
  particle_count: u32,
  parcel_capacity: u32,
  partial_count: u32,
  generation: u32,
};
const AEROSOL_MAX_F32: f32 = 3.402823466e+38;
const AEROSOL_MAGIC: u32 = ${SPH_AEROSOL_BUDGET_MAGIC}u;
const AEROSOL_VERSION: u32 = ${SPH_AEROSOL_BUDGET_VERSION}u;
const ERROR_LAYOUT: u32 = ${ERROR.LAYOUT}u;
const ERROR_CARRIER: u32 = ${ERROR.CARRIER_INVALID}u;
const ERROR_PARCEL: u32 = ${ERROR.PARCEL_INVALID}u;
const ERROR_POPULATION: u32 = ${ERROR.POPULATION_OVERFLOW}u;
const ERROR_COUNT: u32 = ${ERROR.COUNT_OVERFLOW}u;
const ERROR_NUMERIC: u32 = ${ERROR.NUMERIC_OVERFLOW}u;
const ERROR_PARTIAL: u32 = ${ERROR.PARTIAL_INVALID}u;

fn aerosol_finite(value: f32) -> bool {
  return value == value && abs(value) <= AEROSOL_MAX_F32;
}
fn aerosol_positive(value: f32) -> bool {
  return aerosol_finite(value) && value > 0.0;
}
fn aerosol_nonnegative(value: f32) -> bool {
  return aerosol_finite(value) && value >= 0.0;
}
fn aerosol_u64_float(lo: u32, hi: u32) -> f32 {
  // Approximation for geometry only. Storage/reduction preserve both limbs.
  return f32(hi) * 4294967296.0 + f32(lo);
}
fn aerosol_radius(mass: f32, density: f32, lo: u32, hi: u32) -> f32 {
  // Avoid underflow of m/(rho*N) when the final radius is representable.
  return exp((log(mass) - log(density)
    - log(aerosol_u64_float(lo, hi)) - 1.432411958301181) / 3.0);
}
fn aerosol_material_valid(material: f32) -> bool {
  return aerosol_positive(material) && material <= 16777215.0
    && floor(material) == material;
}
fn aerosol_expected_partials(particles: u32, capacity: u32) -> u32 {
  let count = max(particles, capacity);
  return max(1u, count / 32u + select(0u, 1u, count % 32u != 0u));
}
`;

// Intentionally restricted to explicit initial-condition rows. In particular,
// neither a carrier index nor a supersaturation diagnostic authorizes birth.
export const sphAerosolParcelInitializeWgsl = commonWgsl + `
@group(0) @binding(0) var<storage, read_write> parcels: array<u32>;
@group(0) @binding(1) var<uniform> params: AerosolParams;

fn initial_parcel_valid(base: u32) -> bool {
  for (var word = 0u; word < 10u; word = word + 1u) {
    if (!aerosol_finite(bitcast<f32>(parcels[base + word]))) { return false; }
  }
  return aerosol_positive(bitcast<f32>(parcels[base + 3u]))
    && aerosol_finite(bitcast<f32>(parcels[base + 7u]))
    && aerosol_positive(bitcast<f32>(parcels[base + 8u]))
    && aerosol_positive(bitcast<f32>(parcels[base + 9u]))
    && parcels[base + 11u] == 0u
    && parcels[base + 12u] > 0u && parcels[base + 12u] <= 16777215u
    && (parcels[base + 13u] == 1u || parcels[base + 13u] == 2u)
    && (parcels[base + 14u] | parcels[base + 15u]) != 0u
    && (parcels[base + 16u] | parcels[base + 17u]) != 0u
    && parcels[base + 18u] == 0xffffffffu
    && parcels[base + 19u] == 0u
    && (parcels[base + 20u] | parcels[base + 21u]) != 0u
    && parcels[base + 22u] == 1u && parcels[base + 23u] == 1u;
}

@compute @workgroup_size(64)
fn initialize_aerosol(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) groups: vec3<u32>
) {
  let index = id.x + groups.x * 64u * (id.y + groups.y * id.z);
  if (index >= params.parcel_capacity || index >= arrayLength(&parcels) / 24u) { return; }
  let base = index * 24u;
  var all_zero = true;
  for (var word = 0u; word < 24u; word = word + 1u) {
    all_zero = all_zero && parcels[base + word] == 0u;
  }
  if (all_zero) { return; }
  if (params.parcel_capacity > arrayLength(&parcels) / 24u
      || !initial_parcel_valid(base)) {
    parcels[base + 10u] = 0u;
    parcels[base + 22u] = 255u;
    return;
  }
  let radius = aerosol_radius(bitcast<f32>(parcels[base + 3u]),
    bitcast<f32>(parcels[base + 9u]), parcels[base + 14u], parcels[base + 15u]);
  if (!aerosol_positive(radius)) {
    parcels[base + 10u] = 0u;
    parcels[base + 22u] = 255u;
    return;
  }
  parcels[base + 10u] = bitcast<u32>(radius);
}
`;

const budgetWgsl = commonWgsl + `
struct AerosolBudget {
  values: array<f32, 30>,
  carrier_count: u32,
  parcel_count: u32,
  population_lo: u32,
  population_hi: u32,
  errors: u32,
};

fn aerosol_empty_budget() -> AerosolBudget {
  var result: AerosolBudget;
  result.values[16u] = AEROSOL_MAX_F32;
  result.values[17u] = AEROSOL_MAX_F32;
  result.values[18u] = AEROSOL_MAX_F32;
  result.values[19u] = -AEROSOL_MAX_F32;
  result.values[20u] = -AEROSOL_MAX_F32;
  result.values[21u] = -AEROSOL_MAX_F32;
  result.values[22u] = AEROSOL_MAX_F32;
  result.values[23u] = -AEROSOL_MAX_F32;
  result.values[27u] = AEROSOL_MAX_F32;
  return result;
}
fn aerosol_bad_budget(error: u32) -> AerosolBudget {
  var result = aerosol_empty_budget();
  result.errors = error;
  return result;
}
fn aerosol_checked_budget(value: AerosolBudget) -> AerosolBudget {
  for (var i = 0u; i < 30u; i = i + 1u) {
    if (!aerosol_finite(value.values[i])) {
      return aerosol_bad_budget(value.errors | ERROR_NUMERIC);
    }
  }
  return value;
}
fn aerosol_merge(a: AerosolBudget, b: AerosolBudget) -> AerosolBudget {
  var result = a;
  result.errors = a.errors | b.errors;
  for (var i = 0u; i < 30u; i = i + 1u) {
    if ((i >= 16u && i <= 18u) || i == 22u || i == 27u) {
      result.values[i] = min(a.values[i], b.values[i]);
    } else if ((i >= 19u && i <= 21u) || i == 23u || i == 24u || i == 28u) {
      result.values[i] = max(a.values[i], b.values[i]);
    } else {
      result.values[i] = a.values[i] + b.values[i];
      if (!aerosol_finite(result.values[i])) {
        result.errors = result.errors | ERROR_NUMERIC;
        result.values[i] = 0.0;
      }
    }
  }
  result.carrier_count = a.carrier_count + b.carrier_count;
  result.parcel_count = a.parcel_count + b.parcel_count;
  if (result.carrier_count < a.carrier_count || result.parcel_count < a.parcel_count) {
    result.errors = result.errors | ERROR_COUNT;
  }
  result.population_lo = a.population_lo + b.population_lo;
  let carry = select(0u, 1u, result.population_lo < a.population_lo);
  let hi = a.population_hi + b.population_hi;
  result.population_hi = hi + carry;
  if (hi < a.population_hi || result.population_hi < hi) {
    result.errors = result.errors | ERROR_POPULATION;
  }
  return result;
}
fn aerosol_body_budget(
  position: vec3<f32>, mass: f32, velocity: vec3<f32>, u: f32, temperature: f32
) -> AerosolBudget {
  var result = aerosol_empty_budget();
  result.values[0u] = mass;
  result.values[5u] = mass * velocity.x;
  result.values[6u] = mass * velocity.y;
  result.values[7u] = mass * velocity.z;
  result.values[8u] = mass * u;
  result.values[9u] = 0.5 * mass * dot(velocity, velocity);
  result.values[10u] = result.values[8u] + result.values[9u];
  result.values[12u] = mass * position.x;
  result.values[13u] = mass * position.y;
  result.values[14u] = mass * position.z;
  result.values[15u] = mass * temperature;
  result.values[16u] = position.x;
  result.values[17u] = position.y;
  result.values[18u] = position.z;
  result.values[19u] = position.x;
  result.values[20u] = position.y;
  result.values[21u] = position.z;
  result.values[22u] = temperature;
  result.values[23u] = temperature;
  result.values[24u] = length(velocity);
  return result;
}
var<workgroup> aerosol_budgets: array<AerosolBudget, 32>;
`;

export const sphAerosolInventoryPartialsWgsl = budgetWgsl + `
@group(0) @binding(0) var<storage, read> carrier_state: array<f32>;
@group(0) @binding(1) var<storage, read> carrier_thermo: array<f32>;
@group(0) @binding(2) var<storage, read> parcels: array<u32>;
@group(0) @binding(3) var<storage, read_write> partials: array<u32>;
@group(0) @binding(4) var<uniform> params: AerosolParams;

fn carrier_budget(index: u32) -> AerosolBudget {
  let base = index * 8u;
  let thermo = index * 12u;
  let mass = carrier_state[base + 3u];
  if (!aerosol_nonnegative(mass)) { return aerosol_bad_budget(ERROR_CARRIER); }
  if (mass == 0.0) { return aerosol_empty_budget(); }
  for (var word = 0u; word < 8u; word = word + 1u) {
    if (!aerosol_finite(carrier_state[base + word])) { return aerosol_bad_budget(ERROR_CARRIER); }
  }
  if (!aerosol_finite(carrier_state[base + 7u])
      || !aerosol_material_valid(carrier_thermo[thermo])
      || !aerosol_positive(carrier_thermo[thermo + 2u])
      || !aerosol_positive(carrier_thermo[thermo + 3u])
      || carrier_thermo[thermo + 10u] != 1.0) {
    return aerosol_bad_budget(ERROR_CARRIER);
  }
  let phase = carrier_thermo[thermo + 1u];
  if (!(phase >= 1.0 && phase <= 4.0 && floor(phase) == phase)) {
    return aerosol_bad_budget(ERROR_CARRIER);
  }
  var fraction_sum = 0.0;
  for (var k = 0u; k < 4u; k = k + 1u) {
    let fraction = carrier_thermo[thermo + 4u + k];
    if (!aerosol_nonnegative(fraction) || fraction > 1.0) {
      return aerosol_bad_budget(ERROR_CARRIER);
    }
    fraction_sum = fraction_sum + fraction;
  }
  // Admission tolerance, never normalization or clipping of supplied mass.
  if (abs(fraction_sum - 1.0) > 0.0002) { return aerosol_bad_budget(ERROR_CARRIER); }
  let position = vec3<f32>(carrier_state[base], carrier_state[base + 1u], carrier_state[base + 2u]);
  let velocity = vec3<f32>(carrier_state[base + 4u], carrier_state[base + 5u], carrier_state[base + 6u]);
  var result = aerosol_body_budget(position, mass, velocity,
    carrier_state[base + 7u], carrier_thermo[thermo + 2u]);
  for (var k = 0u; k < 4u; k = k + 1u) {
    result.values[1u + k] = mass * carrier_thermo[thermo + 4u + k];
  }
  result.carrier_count = 1u;
  return aerosol_checked_budget(result);
}

fn parcel_budget(index: u32) -> AerosolBudget {
  let base = index * 24u;
  var all_zero = true;
  for (var word = 0u; word < 24u; word = word + 1u) {
    all_zero = all_zero && parcels[base + word] == 0u;
  }
  if (all_zero) { return aerosol_empty_budget(); }
  let initial_origin = parcels[base + 23u] == 1u
    && parcels[base + 18u] == 0xffffffffu && parcels[base + 19u] == 0u;
  let extracted_origin = parcels[base + 23u] == 2u
    && parcels[base + 18u] != 0xffffffffu;
  if (parcels[base + 22u] != 1u || !(initial_origin || extracted_origin)
      || parcels[base + 11u] != 0u
      || parcels[base + 12u] == 0u || parcels[base + 12u] > 16777215u
      || (parcels[base + 13u] != 1u && parcels[base + 13u] != 2u)
      || (parcels[base + 14u] | parcels[base + 15u]) == 0u
      || (parcels[base + 16u] | parcels[base + 17u]) == 0u
      || (parcels[base + 20u] | parcels[base + 21u]) == 0u) {
    return aerosol_bad_budget(ERROR_PARCEL);
  }
  for (var word = 0u; word < 11u; word = word + 1u) {
    if (!aerosol_finite(bitcast<f32>(parcels[base + word]))) {
      return aerosol_bad_budget(ERROR_PARCEL);
    }
  }
  let mass = bitcast<f32>(parcels[base + 3u]);
  let u = bitcast<f32>(parcels[base + 7u]);
  let temperature = bitcast<f32>(parcels[base + 8u]);
  let density = bitcast<f32>(parcels[base + 9u]);
  let radius = bitcast<f32>(parcels[base + 10u]);
  if (!(mass > 0.0 && temperature > 0.0 && density > 0.0 && radius > 0.0)) {
    return aerosol_bad_budget(ERROR_PARCEL);
  }
  let derived_radius = aerosol_radius(mass, density, parcels[base + 14u], parcels[base + 15u]);
  if (!aerosol_positive(derived_radius) || abs(radius - derived_radius) > 0.0001 * derived_radius) {
    return aerosol_bad_budget(ERROR_PARCEL);
  }
  let position = vec3<f32>(bitcast<f32>(parcels[base]),
    bitcast<f32>(parcels[base + 1u]), bitcast<f32>(parcels[base + 2u]));
  let velocity = vec3<f32>(bitcast<f32>(parcels[base + 4u]),
    bitcast<f32>(parcels[base + 5u]), bitcast<f32>(parcels[base + 6u]));
  var result = aerosol_body_budget(position, mass, velocity, u, temperature);
  result.values[parcels[base + 13u]] = mass;
  result.values[11u] = mass;
  result.values[25u] = mass / density;
  result.values[26u] = 0.75 * result.values[25u] / radius;
  if (!(result.values[25u] > 0.0 && result.values[26u] > 0.0)) {
    return aerosol_bad_budget(ERROR_NUMERIC);
  }
  result.values[27u] = radius;
  result.values[28u] = radius;
  result.parcel_count = 1u;
  result.population_lo = parcels[base + 14u];
  result.population_hi = parcels[base + 15u];
  return aerosol_checked_budget(result);
}

fn write_partial(index: u32, budget: AerosolBudget) {
  let base = index * 40u;
  for (var i = 0u; i < 30u; i = i + 1u) { partials[base + i] = bitcast<u32>(budget.values[i]); }
  partials[base + 30u] = budget.carrier_count;
  partials[base + 31u] = budget.parcel_count;
  partials[base + 32u] = budget.population_lo;
  partials[base + 33u] = budget.population_hi;
  partials[base + 34u] = budget.errors;
  partials[base + 35u] = AEROSOL_MAGIC;
  partials[base + 36u] = AEROSOL_VERSION;
  partials[base + 37u] = params.parcel_capacity;
  partials[base + 38u] = params.particle_count;
  partials[base + 39u] = params.generation;
}

@compute @workgroup_size(32)
fn inventory_partials(
  @builtin(local_invocation_index) lane: u32,
  @builtin(workgroup_id) group: vec3<u32>,
  @builtin(num_workgroups) groups: vec3<u32>
) {
  let partial = group.x + groups.x * (group.y + groups.y * group.z);
  if (partial >= params.partial_count || partial >= arrayLength(&partials) / 40u) { return; }
  let layout_ready = params.particle_count <= arrayLength(&carrier_state) / 8u
    && params.particle_count <= arrayLength(&carrier_thermo) / 12u
    && params.parcel_capacity <= arrayLength(&parcels) / 24u
    && params.partial_count <= arrayLength(&partials) / 40u
    && params.partial_count == aerosol_expected_partials(params.particle_count, params.parcel_capacity);
  var budget = aerosol_empty_budget();
  if (!layout_ready) {
    budget.errors = ERROR_LAYOUT;
  } else {
    let index = partial * 32u + lane;
    if (index < params.particle_count) { budget = carrier_budget(index); }
    if (index < params.parcel_capacity) { budget = aerosol_merge(budget, parcel_budget(index)); }
  }
  aerosol_budgets[lane] = budget;
  workgroupBarrier();
  for (var stride = 16u; stride > 0u; stride = stride / 2u) {
    if (lane < stride) { aerosol_budgets[lane] = aerosol_merge(aerosol_budgets[lane], aerosol_budgets[lane + stride]); }
    workgroupBarrier();
  }
  if (lane == 0u) { write_partial(partial, aerosol_budgets[0u]); }
}
`;

export const sphAerosolInventoryFinalizeWgsl = budgetWgsl + `
@group(0) @binding(0) var<storage, read> partials: array<u32>;
@group(0) @binding(1) var<storage, read_write> final_budget: array<u32>;
@group(0) @binding(2) var<uniform> params: AerosolParams;

fn read_partial(index: u32) -> AerosolBudget {
  let base = index * 40u;
  if (partials[base + 35u] != AEROSOL_MAGIC || partials[base + 36u] != AEROSOL_VERSION
      || partials[base + 37u] != params.parcel_capacity
      || partials[base + 38u] != params.particle_count
      || partials[base + 39u] != params.generation || partials[base + 29u] != 0u) {
    return aerosol_bad_budget(ERROR_PARTIAL);
  }
  var result: AerosolBudget;
  for (var i = 0u; i < 30u; i = i + 1u) { result.values[i] = bitcast<f32>(partials[base + i]); }
  result.carrier_count = partials[base + 30u];
  result.parcel_count = partials[base + 31u];
  result.population_lo = partials[base + 32u];
  result.population_hi = partials[base + 33u];
  result.errors = partials[base + 34u];
  if (result.carrier_count > 32u || result.parcel_count > 32u
      || result.carrier_count > params.particle_count || result.parcel_count > params.parcel_capacity) {
    result.errors = result.errors | ERROR_PARTIAL;
  }
  return aerosol_checked_budget(result);
}

@compute @workgroup_size(32)
fn inventory_finalize(
  @builtin(local_invocation_index) lane: u32,
  @builtin(workgroup_id) group: vec3<u32>
) {
  if (any(group != vec3<u32>(0u)) || arrayLength(&final_budget) < 40u) { return; }
  var budget = aerosol_empty_budget();
  if (params.partial_count > arrayLength(&partials) / 40u
      || params.partial_count != aerosol_expected_partials(params.particle_count, params.parcel_capacity)) {
    budget.errors = ERROR_LAYOUT;
  } else {
    for (var index = lane; index < params.partial_count; index = index + 32u) {
      budget = aerosol_merge(budget, read_partial(index));
    }
  }
  aerosol_budgets[lane] = budget;
  workgroupBarrier();
  for (var stride = 16u; stride > 0u; stride = stride / 2u) {
    if (lane < stride) { aerosol_budgets[lane] = aerosol_merge(aerosol_budgets[lane], aerosol_budgets[lane + stride]); }
    workgroupBarrier();
  }
  if (lane != 0u) { return; }
  budget = aerosol_budgets[0u];
  if ((budget.carrier_count | budget.parcel_count) == 0u) {
    for (var i = 16u; i <= 23u; i = i + 1u) { budget.values[i] = 0.0; }
  }
  if (budget.parcel_count == 0u) { budget.values[27u] = 0.0; }
  for (var i = 0u; i < 30u; i = i + 1u) { final_budget[i] = bitcast<u32>(budget.values[i]); }
  final_budget[30u] = budget.carrier_count;
  final_budget[31u] = budget.parcel_count;
  final_budget[32u] = budget.population_lo;
  final_budget[33u] = budget.population_hi;
  final_budget[34u] = budget.errors;
  final_budget[35u] = AEROSOL_MAGIC;
  final_budget[36u] = AEROSOL_VERSION;
  final_budget[37u] = params.parcel_capacity;
  final_budget[38u] = params.particle_count;
  final_budget[39u] = params.generation;
}
`;
