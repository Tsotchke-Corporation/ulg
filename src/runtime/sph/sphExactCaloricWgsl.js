import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as ERROR }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';

/** Wide integer caloric target arithmetic. Requires the matching EM and EE
 * libraries. These functions neither authenticate a physical source nor admit
 * a temperature, reaction, placement or publication. */
export function createSphExactCaloricWgsl(format) {
  validateSphExactMassFormat(format);
  const words = 3 * format.wordCount + 26;
  return /* wgsl */ `
const EC_WORDS: u32 = ${words}u;
struct ExactCaloric { words: array<u32, ${words}>, negative: u32, error: u32 }
struct ExactCaloricTarget {
  numerator: ExactCaloric, denominator: ExactCaloric, fractional_shift: u32, error: u32
}
fn ec_failure(error: u32) -> ExactCaloric {
  var value: ExactCaloric; value.error = error; return value;
}
fn ec_input_error(value: ExactCaloric) -> u32 {
  return value.error | select(0u, ${ERROR.INVALID_RATIO}u, value.negative > 1u);
}
fn ec_top(value: ExactCaloric) -> i32 {
  for (var i = i32(EC_WORDS) - 1; i >= 0; i--) {
    if (value.words[u32(i)] != 0u) {
      return i * 32 + 31 - i32(countLeadingZeros(value.words[u32(i)]));
    }
  }
  return -1;
}
fn ec_normalize(value: ExactCaloric) -> ExactCaloric {
  var result = value; if (ec_top(value) < 0) { result.negative = 0u; } return result;
}
fn ec_compare_magnitude(a: ExactCaloric, b: ExactCaloric) -> i32 {
  for (var i = i32(EC_WORDS) - 1; i >= 0; i--) {
    if (a.words[u32(i)] < b.words[u32(i)]) { return -1; }
    if (a.words[u32(i)] > b.words[u32(i)]) { return 1; }
  }
  return 0;
}
// Error validation belongs to the caller; exact zero has no negative sign.
fn ec_compare(a: ExactCaloric, b: ExactCaloric) -> i32 {
  let negative_a = a.negative != 0u && ec_top(a) >= 0;
  let negative_b = b.negative != 0u && ec_top(b) >= 0;
  if (negative_a != negative_b) { return select(1, -1, negative_a); }
  let order = ec_compare_magnitude(a, b);
  return select(order, -order, negative_a);
}
fn ec_difference(a: ExactCaloric, b: ExactCaloric) -> ExactCaloric {
  var result: ExactCaloric; var borrow = 0u;
  for (var i = 0u; i < EC_WORDS; i++) {
    let first = a.words[i] - b.words[i]; result.words[i] = first - borrow;
    borrow = select(0u, 1u, a.words[i] < b.words[i] || first < borrow);
  }
  if (borrow != 0u) { return ec_failure(${ERROR.UNDERFLOW}u); }
  return result;
}
fn ec_add(a: ExactCaloric, b: ExactCaloric) -> ExactCaloric {
  let error = ec_input_error(a) | ec_input_error(b);
  if (error != 0u) { return ec_failure(error); }
  var result: ExactCaloric;
  if (a.negative != b.negative) {
    if (ec_compare_magnitude(a, b) >= 0) {
      result = ec_difference(a, b); result.negative = a.negative;
    } else { result = ec_difference(b, a); result.negative = b.negative; }
  } else {
    var carry = 0u;
    for (var i = 0u; i < EC_WORDS; i++) {
      let first = a.words[i] + b.words[i]; let second = first + carry;
      carry = select(0u, 1u, first < a.words[i] || second < first); result.words[i] = second;
    }
    if (carry != 0u) { return ec_failure(${ERROR.OVERFLOW}u); }
    result.negative = a.negative;
  }
  return ec_normalize(result);
}
fn ec_subtract(a: ExactCaloric, b: ExactCaloric) -> ExactCaloric {
  let error = ec_input_error(a) | ec_input_error(b);
  if (error != 0u) { return ec_failure(error); }
  var opposite = b; opposite.negative ^= 1u; return ec_add(a, opposite);
}
fn ec_shift_left(value: ExactCaloric, shift: u32) -> ExactCaloric {
  let error = ec_input_error(value);
  if (error != 0u) { return ec_failure(error); }
  var result: ExactCaloric; result.negative = value.negative;
  let whole = shift / 32u; let part = shift % 32u;
  for (var i = 0u; i < EC_WORDS; i++) {
    let word = value.words[i]; if (word == 0u) { continue; }
    if (whole >= EC_WORDS || i >= EC_WORDS - whole) { return ec_failure(${ERROR.OVERFLOW}u); }
    let dest = i + whole; result.words[dest] |= word << part;
    if (part != 0u) {
      let upper = word >> (32u - part);
      if (dest + 1u >= EC_WORDS) {
        if (upper != 0u) { return ec_failure(${ERROR.OVERFLOW}u); }
      } else { result.words[dest + 1u] |= upper; }
    }
  }
  return ec_normalize(result);
}
// Base-2^16 schoolbook multiplication over significant digits only. Each
// prior digit + digit product + carry fits u32; no floating multiplication.
fn ec_multiply(a: ExactCaloric, b: ExactCaloric) -> ExactCaloric {
  let error = ec_input_error(a) | ec_input_error(b);
  if (error != 0u) { return ec_failure(error); }
  let top_a = ec_top(a); let top_b = ec_top(b);
  if (top_a < 0 || top_b < 0) { return ExactCaloric(); }
  if (top_a + top_b >= i32(EC_WORDS * 32u)) { return ec_failure(${ERROR.OVERFLOW}u); }
  let count_a = u32(top_a) / 16u + 1u; let count_b = u32(top_b) / 16u + 1u;
  var digits: array<u32, ${2 * words}>;
  for (var i = 0u; i < count_a; i++) {
    let digit_a = (a.words[i / 2u] >> ((i % 2u) * 16u)) & 65535u;
    var carry = 0u;
    for (var j = 0u; j < count_b; j++) {
      let digit_b = (b.words[j / 2u] >> ((j % 2u) * 16u)) & 65535u;
      let sum = digits[i + j] + digit_a * digit_b + carry;
      digits[i + j] = sum & 65535u; carry = sum >> 16u;
    }
    if (i + count_b >= EC_WORDS * 2u) {
      if (carry != 0u) { return ec_failure(${ERROR.OVERFLOW}u); }
    } else { digits[i + count_b] = carry; }
  }
  var result: ExactCaloric; result.negative = a.negative ^ b.negative;
  for (var i = 0u; i < EC_WORDS; i++) { result.words[i] = digits[i * 2u] | (digits[i * 2u + 1u] << 16u); }
  return ec_normalize(result);
}
fn ec_from_mass(value: ExactMass) -> ExactCaloric {
  var result: ExactCaloric;
  for (var i = 0u; i < EM_WORDS; i++) { result.words[i] = value.words[i]; }
  return result;
}
fn ec_from_extensive(value: ExactExtensive) -> ExactCaloric {
  let error = ee_input_error(value);
  if (error != 0u) { return ec_failure(error); }
  var result: ExactCaloric; result.negative = value.negative;
  for (var i = 0u; i < EE_WORDS; i++) { result.words[i] = value.words[i]; }
  return ec_normalize(result);
}
fn ec_momentum_units(value: ExactExtensive) -> ExactCaloric {
  let error = ee_input_error(value);
  if (error != 0u) { return ec_failure(error); }
  for (var i = 0u; i < 4u; i++) {
    if (value.words[i] != 0u) { return ec_failure(${ERROR.INEXACT_INPUT}u); }
  }
  if ((value.words[4u] & 0x003fffffu) != 0u) { return ec_failure(${ERROR.INEXACT_INPUT}u); }
  var result: ExactCaloric; result.negative = value.negative;
  for (var i = 0u; i + 4u < EE_WORDS; i++) {
    result.words[i] = value.words[i + 4u] >> 22u;
    if (i + 5u < EE_WORDS) { result.words[i] |= value.words[i + 5u] << 10u; }
  }
  return ec_normalize(result);
}
fn ec_target_failure(error: u32) -> ExactCaloricTarget {
  return ExactCaloricTarget(ec_failure(error), ec_failure(error), 0u, error);
}
fn ec_target(total: ExactMass, source_sensible: ExactExtensive, source_ke: ExactExtensive,
  px: ExactExtensive, py: ExactExtensive, pz: ExactExtensive,
  mass_scale: ExactCaloric, scale_exponent: i32, delta_bits: u32) -> ExactCaloricTarget {
  var error = ee_input_error(source_sensible) | ee_input_error(source_ke)
    | ee_input_error(px) | ee_input_error(py) | ee_input_error(pz) | ec_input_error(mass_scale);
  if (em_zero(total)) { error |= ${ERROR.DIVISION_BY_ZERO}u; }
  let scale_top = ec_top(mass_scale);
  if (mass_scale.negative != 0u || scale_top < 0 || scale_top >= i32((EM_WORDS + 4u) * 32u)
      || scale_exponent < -298 || scale_exponent > 254
      || (source_ke.negative != 0u && ee_top(source_ke) >= 0)) { error |= ${ERROR.INVALID_RATIO}u; }
  let encoded = (delta_bits >> 23u) & 255u;
  if (encoded == 255u) { error |= ${ERROR.INVALID_FLOAT}u; }
  let p_x = ec_momentum_units(px); let p_y = ec_momentum_units(py); let p_z = ec_momentum_units(pz);
  error |= p_x.error | p_y.error | p_z.error;
  if (error != 0u) { return ec_target_failure(error); }
  let mass = ec_from_mass(total);
  let momentum_squared = ec_add(ec_add(ec_multiply(p_x, p_x), ec_multiply(p_y, p_y)), ec_multiply(p_z, p_z));
  let relative = ec_subtract(ec_multiply(ec_from_extensive(source_ke), mass), momentum_squared);
  error |= relative.error;
  if (relative.negative != 0u) { error |= ${ERROR.INVALID_RATIO}u; }
  if (error != 0u) { return ec_target_failure(error); }
  let coefficient = (delta_bits & 0x007fffffu) | select(0u, 0x00800000u, encoded != 0u);
  let exponent = select(-149, i32(encoded) - 150, encoded != 0u);
  let shift = 299 + exponent - scale_exponent;
  let fractional_shift = select(u32(max(-shift, 0)), 0u, coefficient == 0u);
  let base = ec_multiply(ec_add(ec_multiply(ec_from_extensive(source_sensible), mass), relative), mass_scale);
  var delta: ExactCaloric; delta.words[0] = coefficient; delta.negative = delta_bits >> 31u;
  let formation = ec_shift_left(ec_multiply(ec_multiply(mass, mass), delta), u32(max(shift, 0)));
  let numerator = ec_subtract(ec_shift_left(base, fractional_shift), formation);
  let denominator = ec_multiply(mass, mass_scale);
  error |= numerator.error | denominator.error;
  if (error != 0u) { return ec_target_failure(error); }
  return ExactCaloricTarget(numerator, denominator, fractional_shift, 0u);
}
fn ec_scaled_trial(sensible: ExactExtensive, denominator: ExactCaloric, fractional_shift: u32) -> ExactCaloric {
  var error = ee_input_error(sensible) | ec_input_error(denominator);
  if (denominator.negative != 0u || ec_top(denominator) < 0 || fractional_shift > 104u) {
    error |= ${ERROR.INVALID_RATIO}u;
  }
  if (error != 0u) { return ec_failure(error); }
  return ec_shift_left(ec_multiply(ec_from_extensive(sensible), denominator), fractional_shift);
}
`;
}
