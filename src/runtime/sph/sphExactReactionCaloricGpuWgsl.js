import { createSphReactionEnergyGraphWgsl } from '../../../ulg-gpu-abi/src/sphReactionEnergyWgsl.js';
import { createSphExactCaloricWgsl } from './sphExactCaloricWgsl.js';

export const SPH_EXACT_REACTION_CALORIC_HEADER_WORDS = 16;
export const SPH_EXACT_REACTION_CALORIC_FIELDS = Object.freeze([
  'targetNumerator', 'denominator', 'lowerResidual', 'upperResidual', 'chosenResidual'
]);
export const SPH_EXACT_REACTION_CALORIC_PRODUCT_WORDS = 8;
export const SPH_EXACT_REACTION_CALORIC_ERROR = Object.freeze({
  SOURCE_NOT_READY: 4194304, DOMAIN: 8388608, INCOMPLETE_SEARCH: 16777216, INCONSISTENT_GRAPH: 33554432
});

// Composed into the genuine source producer. Every quantity is preparation;
// endpoint writes, element accounting and terminal physical ownership follow.
export function createSphExactReactionCaloricGpuWgsl(format) {
  const E = SPH_EXACT_REACTION_CALORIC_ERROR;
  return createSphExactCaloricWgsl(format)
    + createSphReactionEnergyGraphWgsl({ record: index => `es_energy_record(${index})` }) + /* wgsl */ `
fn es_energy_record(index: u32) -> vec4<f32> {
  let at = es_params.reaction_table_offset + index * 4u;
  return bitcast<vec4<f32>>(vec4<u32>(es_metadata[at], es_metadata[at + 1u],
    es_metadata[at + 2u], es_metadata[at + 3u]));
}
fn es_energy_bits(index: u32, component: u32) -> u32 {
  return es_metadata[es_params.reaction_table_offset + index * 4u + component];
}
fn es_caloric_start(out: u32) -> u32 { return out + es_params.caloric_offset_words; }
fn es_store_caloric(out: u32, field: u32, value: ExactCaloric) {
  let at = es_caloric_start(out) + 16u + field * (EC_WORDS + 2u);
  es_output[at] = value.negative; es_output[at + 1u] = value.error;
  for (var i = 0u; i < EC_WORDS; i++) { es_output[at + 2u + i] = value.words[i]; }
}
fn es_load_caloric(out: u32, field: u32) -> ExactCaloric {
  let at = es_caloric_start(out) + 16u + field * (EC_WORDS + 2u);
  var value: ExactCaloric;
  value.negative = es_output[at]; value.error = es_output[at + 1u];
  for (var i = 0u; i < EC_WORDS; i++) { value.words[i] = es_output[at + 2u + i]; }
  return value;
}
fn es_caloric_fail(out: u32, error: u32) {
  let at = es_caloric_start(out); es_output[at] = 0u; es_output[at + 1u] |= error;
}
fn es_caloric_source_ready(rx: u32, row: u32) -> bool {
  let m = row * 8u;
  return energy_source_ready(rx, es_thermo[row * 3u], es_thermo[row * 3u + 1u],
    es_thermo[row * 3u + 2u], bitcast<vec4<f32>>(es_state[row * 2u + 1u]))
    && energy_relaxed_mechanics(es_mechanics[m], es_mechanics[m + 1u], es_mechanics[m + 2u],
      es_mechanics[m + 3u], es_mechanics[m + 4u]);
}
@compute @workgroup_size(1)
fn prepare_exact_reaction_caloric_target(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= es_params.count) { return; }
  let out = id.x * es_params.record_words; let at = es_caloric_start(out);
  // Receipt8 is minted by complete exact source-extensive accumulation, before
  // optional velocity projection. A projected underflow cannot erase energy.
  if (es_output[out] != 1u || es_output[out + 1u] != 0u || es_output[at + 8u] != 1u) { return; }
  let rx = es_output[out + 4u]; let rule = rx * 24u;
  if (!reaction_energy_enabled(rx) || !es_caloric_source_ready(rx, es_output[out + 2u])
      || !es_caloric_source_ready(rx, es_output[out + 3u])) {
    es_caloric_fail(out, ${E.SOURCE_NOT_READY}u); return;
  }
  let scale_at = es_metadata[rule + 1u]; var scale: ExactCaloric;
  for (var i = 0u; i < EM_WORDS + 4u; i++) { scale.words[i] = es_metadata[scale_at + 4u + i]; }
  let delta = es_energy_bits(energy_header(rx), 1u);
  let caloric_target = ec_target(es_load_output(out + 12u),
    ee_subtract(es_load_extensive(out, 3u), es_load_extensive(out, 5u)),
    es_load_extensive(out, 4u), es_load_extensive(out, 0u), es_load_extensive(out, 1u),
    es_load_extensive(out, 2u), scale, bitcast<i32>(es_metadata[scale_at]) + EM_QUANTUM, delta);
  es_store_caloric(out, 0u, caloric_target.numerator); es_store_caloric(out, 1u, caloric_target.denominator);
  es_output[at + 6u] = caloric_target.fractional_shift; es_output[at + 7u] = delta;
  if (caloric_target.error != 0u) { es_caloric_fail(out, caloric_target.error); return; }
  es_output[at] = 2u;
}

// Evaluate the shared, original caloric graph, then multiply its admitted raw
// U bits and its original Uref bits separately by the selected product mass.
// Each bracket endpoint owns the actual graph values used in its residual.
fn es_caloric_product_start(out: u32, state_slot: u32, term: u32) -> u32 {
  let base = 16u + 5u * (EC_WORDS + 2u);
  let capacity = (es_params.caloric_record_words - base) / 24u;
  return es_caloric_start(out) + base + (state_slot * capacity + term) * 8u;
}
fn es_copy_caloric_states(out: u32, from_slot: u32, to_slot: u32) {
  for (var term = 0u; term < es_output[out + 5u]; term++) {
    let source = es_caloric_product_start(out, from_slot, term);
    let dest = es_caloric_product_start(out, to_slot, term);
    for (var field = 0u; field < 8u; field++) { es_output[dest + field] = es_output[source + field]; }
  }
}
fn es_product_sensible(out: u32, temperature_bits: u32, state_slot: u32) -> ExactExtensive {
  let rx = es_output[out + 4u]; var sensible: ExactExtensive;
  for (var term = 0u; term < es_output[out + 5u]; term++) {
    let source = out + 12u + 7u * EM_WORDS + term * (4u + 3u * EM_WORDS);
    let mass = es_load_output(source + 4u); let global_term = es_output[source];
    let write_states = state_slot < 3u;
    let dest = es_caloric_product_start(out, state_slot, term);
    if (write_states) {
      for (var i = 0u; i < 3u; i++) { es_output[dest + i] = es_output[source + i]; }
    }
    if (em_zero(mass)) { continue; }
    let descriptor = energy_term(rx, 1u, f32(global_term));
    let state = energy_product_state(rx, global_term, bitcast<f32>(temperature_bits));
    if (descriptor == 0u || state.z != 1.0 || state.w != f32(es_output[source + 2u])
        || !(state.y > 0.0) || !energy_finite(state.x) || !energy_finite(state.y)) {
      if (write_states) { es_output[dest + 7u] = ${E.DOMAIN}u; }
      return ee_failure(${E.DOMAIN}u);
    }
    let u = bitcast<u32>(state.x); let reference = es_energy_bits(descriptor, 3u);
    sensible = ee_add(sensible, ee_subtract(ee_mass_scaled(mass, u), ee_mass_scaled(mass, reference)));
    if (write_states) {
      es_output[dest + 3u] = 1u; es_output[dest + 4u] = u;
      es_output[dest + 5u] = bitcast<u32>(state.y); es_output[dest + 6u] = reference;
    }
  }
  return sensible;
}
fn es_caloric_residual(out: u32, temperature_bits: u32, state_slot: u32) -> ExactCaloric {
  let at = es_caloric_start(out);
  return ec_subtract(es_load_caloric(out, 0u), ec_scaled_trial(
    es_product_sensible(out, temperature_bits, state_slot), es_load_caloric(out, 1u), es_output[at + 6u]));
}
@compute @workgroup_size(1)
fn initialize_exact_reaction_caloric_bracket(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= es_params.count) { return; }
  let out = id.x * es_params.record_words; let at = es_caloric_start(out);
  if (es_output[at] != 2u) { return; }
  let header = energy_header(es_output[out + 4u]); let domain = es_energy_record(header + 2u);
  if (!(domain.x > 0.0) || !(domain.y > domain.x) || !energy_finite(domain.y)) {
    es_caloric_fail(out, ${E.DOMAIN}u); return;
  }
  let lo = bitcast<u32>(domain.x); let hi = bitcast<u32>(domain.y);
  let lower = es_caloric_residual(out, lo, 0u); let upper = es_caloric_residual(out, hi, 1u);
  let error = lower.error | upper.error;
  if (error != 0u) { es_caloric_fail(out, error); return; }
  if (ec_compare(lower, ExactCaloric()) < 0 || ec_compare(upper, ExactCaloric()) > 0) {
    es_caloric_fail(out, ${E.DOMAIN}u); return;
  }
  es_store_caloric(out, 2u, lower); es_store_caloric(out, 3u, upper);
  es_output[at + 2u] = lo; es_output[at + 3u] = hi; es_output[at] = 3u;
}
@compute @workgroup_size(1)
fn refine_exact_reaction_caloric_bracket(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= es_params.count) { return; }
  let out = id.x * es_params.record_words; let at = es_caloric_start(out);
  if (es_output[at] != 3u) { return; }
  let lo = es_output[at + 2u]; let hi = es_output[at + 3u];
  if (hi - lo <= 1u) { return; }
  let mid = lo + (hi - lo) / 2u; let residual = es_caloric_residual(out, mid, 2u);
  if (residual.error != 0u) { es_caloric_fail(out, residual.error); return; }
  if (ec_compare(residual, es_load_caloric(out, 2u)) > 0
      || ec_compare(residual, es_load_caloric(out, 3u)) < 0) {
    es_caloric_fail(out, ${E.INCONSISTENT_GRAPH}u); return;
  }
  es_output[at + 5u]++;
  let comparison = ec_compare(residual, ExactCaloric());
  if (comparison >= 0) {
    es_output[at + 2u] = mid; es_store_caloric(out, 2u, residual); es_copy_caloric_states(out, 2u, 0u);
  }
  if (comparison <= 0) {
    es_output[at + 3u] = mid; es_store_caloric(out, 3u, residual); es_copy_caloric_states(out, 2u, 1u);
  }
}
@compute @workgroup_size(1)
fn finalize_exact_reaction_caloric_state(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= es_params.count) { return; }
  let out = id.x * es_params.record_words; let at = es_caloric_start(out);
  if (es_output[at] != 3u) { return; }
  let lo = es_output[at + 2u]; let hi = es_output[at + 3u];
  if (hi < lo || hi - lo > 1u) { es_caloric_fail(out, ${E.INCOMPLETE_SEARCH}u); return; }
  var lower = es_load_caloric(out, 2u); var upper = es_load_caloric(out, 3u);
  lower.negative = 0u; upper.negative = 0u;
  let comparison = ec_compare(lower, upper);
  let choose_low = comparison < 0 || (comparison == 0 && (lo & 1u) == 0u);
  let chosen = select(hi, lo, choose_low);
  es_copy_caloric_states(out, select(1u, 0u, choose_low), 2u);
  var stored_sensible: ExactExtensive;
  for (var term = 0u; term < es_output[out + 5u]; term++) {
    let source = out + 12u + 7u * EM_WORDS + term * (4u + 3u * EM_WORDS);
    let mass = es_load_output(source + 4u); let state = es_caloric_product_start(out, 2u, term);
    for (var field = 0u; field < 3u; field++) {
      if (es_output[state + field] != es_output[source + field]) {
        es_caloric_fail(out, ${E.INCONSISTENT_GRAPH}u); return;
      }
    }
    if (es_output[state + 7u] != 0u || es_output[state + 3u] != select(1u, 0u, em_zero(mass))) {
      es_caloric_fail(out, ${E.INCONSISTENT_GRAPH}u); return;
    }
    if (em_zero(mass)) { continue; }
    stored_sensible = ee_add(stored_sensible, ee_subtract(ee_mass_scaled(mass, es_output[state + 4u]),
      ee_mass_scaled(mass, es_output[state + 6u])));
  }
  let residual = ec_subtract(es_load_caloric(out, 0u),
    ec_scaled_trial(stored_sensible, es_load_caloric(out, 1u), es_output[at + 6u]));
  if (residual.error != 0u) { es_caloric_fail(out, residual.error); return; }
  if (ec_compare(residual, es_load_caloric(out, select(3u, 2u, choose_low))) != 0) {
    es_caloric_fail(out, ${E.INCONSISTENT_GRAPH}u); return;
  }
  es_store_caloric(out, 4u, residual); es_output[at + 4u] = chosen;
  // Numeric caloric preparation, with the full rational endpoint residual.
  // No endpoint, placement event, or physical publication is authorized here.
  es_output[at] = 1u;
}
`;
}
