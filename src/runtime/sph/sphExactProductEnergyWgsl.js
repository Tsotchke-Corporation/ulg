import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as E }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';

/** Exact energy retained when the selected COM velocity is projected to f32.
 * Requires matching EM, EE and EC helpers. The returned integers share the
 * supplied denominator and quantum; this helper grants no physical ownership. */
export function createSphExactProductEnergyWgsl(format) {
  validateSphExactMassFormat(format);
  return /* wgsl */ `
struct ExactProductEnergy {
  correction: ExactCaloric, residual: ExactCaloric, total: ExactCaloric, error: u32
}
fn ep_failure(error: u32) -> ExactProductEnergy {
  return ExactProductEnergy(ec_failure(error), ec_failure(error), ec_failure(error), error);
}
fn ep_extensive_input_error(value: ExactExtensive) -> u32 {
  return ee_input_error(value) | select(0u, ${E.INVALID_RATIO}u,
    value.negative != 0u && ee_top(value) < 0);
}
fn ep_caloric_input_error(value: ExactCaloric) -> u32 {
  return ec_input_error(value) | select(0u, ${E.INVALID_RATIO}u,
    value.negative != 0u && ec_top(value) < 0);
}
fn ep_energy(total: ExactMass, px: ExactExtensive, py: ExactExtensive, pz: ExactExtensive,
  projected_ke: ExactExtensive, product_internal: ExactExtensive, mass_scale: ExactCaloric,
  denominator: ExactCaloric, fractional_shift: u32, chosen_residual: ExactCaloric) -> ExactProductEnergy {
  var error = ep_extensive_input_error(px) | ep_extensive_input_error(py)
    | ep_extensive_input_error(pz) | ep_extensive_input_error(projected_ke)
    | ep_extensive_input_error(product_internal) | ep_caloric_input_error(mass_scale)
    | ep_caloric_input_error(denominator) | ep_caloric_input_error(chosen_residual);
  if (em_zero(total)) { error |= ${E.DIVISION_BY_ZERO}u; }
  let scale_top = ec_top(mass_scale);
  if (mass_scale.negative != 0u || scale_top < 0 || scale_top >= i32((EM_WORDS + 4u) * 32u)
    || denominator.negative != 0u || ec_top(denominator) < 0 || fractional_shift > 104u
    || projected_ke.negative != 0u) { error |= ${E.INVALID_RATIO}u; }
  let p_x = ec_momentum_units(px); let p_y = ec_momentum_units(py); let p_z = ec_momentum_units(pz);
  error |= p_x.error | p_y.error | p_z.error;
  if (error != 0u) { return ep_failure(error); }
  let mass = ec_from_mass(total);
  let expected_denominator = ec_multiply(mass, mass_scale);
  if (expected_denominator.error != 0u) { return ep_failure(expected_denominator.error); }
  if (ec_compare(expected_denominator, denominator) != 0) { return ep_failure(${E.INVALID_RATIO}u); }
  let momentum_squared = ec_add(ec_add(ec_multiply(p_x, p_x), ec_multiply(p_y, p_y)), ec_multiply(p_z, p_z));
  let kinetic = ec_from_extensive(projected_ke);
  let difference = ec_subtract(momentum_squared, ec_multiply(mass, kinetic));
  let correction = ec_shift_left(ec_multiply(difference, mass_scale), fractional_shift);
  let residual = ec_add(chosen_residual, correction);
  // Widen before adding U and K: the intermediate sum need not fit EE.
  let represented_energy = ec_add(ec_from_extensive(product_internal), kinetic);
  let represented_total = ec_shift_left(ec_multiply(represented_energy, denominator), fractional_shift);
  let energy_total = ec_add(represented_total, residual);
  error |= correction.error | residual.error | energy_total.error;
  if (error != 0u) { return ep_failure(error); }
  return ExactProductEnergy(correction, residual, energy_total, 0u);
}
`;
}
