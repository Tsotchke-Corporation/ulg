import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as ERROR }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';

/** Integer extensive arithmetic only. Requires createSphExactMassWgsl(format)
 * in the same module. No physical source, energy closure or publication
 * authority is conferred by these numerical operations. */
export function createSphExactExtensiveWgsl(format) {
  validateSphExactMassFormat(format);
  const words = format.wordCount + 18;
  return /* wgsl */ `
const EE_WORDS: u32 = ${words}u;
const EE_QUANTUM: i32 = ${format.quantumExponent - 299}i;
struct ExactExtensive {
  words: array<u32, ${words}>, negative: u32, error: u32
}
fn ee_failure(error: u32) -> ExactExtensive {
  var result: ExactExtensive; result.error = error; return result;
}
fn ee_top(a: ExactExtensive) -> i32 {
  for (var i = i32(EE_WORDS) - 1; i >= 0; i--) {
    if (a.words[u32(i)] != 0u) {
      return i * 32 + 31 - i32(countLeadingZeros(a.words[u32(i)]));
    }
  }
  return -1;
}
fn ee_compare_magnitude(a: ExactExtensive, b: ExactExtensive) -> i32 {
  for (var i = i32(EE_WORDS) - 1; i >= 0; i--) {
    if (a.words[u32(i)] < b.words[u32(i)]) { return -1; }
    if (a.words[u32(i)] > b.words[u32(i)]) { return 1; }
  }
  return 0;
}
fn ee_input_error(a: ExactExtensive) -> u32 {
  return a.error | select(0u, ${ERROR.INVALID_RATIO}u, a.negative > 1u);
}
fn ee_normalize(a: ExactExtensive) -> ExactExtensive {
  var result = a;
  if (ee_top(result) < 0) { result.negative = 0u; }
  return result;
}
// Magnitude-only helper: caller establishes a >= b and supplies result sign.
fn ee_difference(a: ExactExtensive, b: ExactExtensive) -> ExactExtensive {
  var result: ExactExtensive; var borrow = 0u;
  for (var i = 0u; i < EE_WORDS; i++) {
    let first = a.words[i] - b.words[i];
    result.words[i] = first - borrow;
    borrow = select(0u, 1u, a.words[i] < b.words[i] || first < borrow);
  }
  if (borrow != 0u) { return ee_failure(${ERROR.UNDERFLOW}u); }
  return result;
}
fn ee_add(a: ExactExtensive, b: ExactExtensive) -> ExactExtensive {
  let error = ee_input_error(a) | ee_input_error(b);
  if (error != 0u) { return ee_failure(error); }
  var result: ExactExtensive;
  if (a.negative != b.negative) {
    if (ee_compare_magnitude(a, b) >= 0) {
      result = ee_difference(a, b); result.negative = a.negative;
    } else {
      result = ee_difference(b, a); result.negative = b.negative;
    }
  } else {
    var carry = 0u;
    for (var i = 0u; i < EE_WORDS; i++) {
      let first = a.words[i] + b.words[i];
      let second = first + carry;
      carry = select(0u, 1u, first < a.words[i] || second < first);
      result.words[i] = second;
    }
    if (carry != 0u) { return ee_failure(${ERROR.OVERFLOW}u); }
    result.negative = a.negative;
  }
  return ee_normalize(result);
}
fn ee_subtract(a: ExactExtensive, b: ExactExtensive) -> ExactExtensive {
  let error = ee_input_error(a) | ee_input_error(b);
  if (error != 0u) { return ee_failure(error); }
  var opposite = b; opposite.negative ^= 1u;
  return ee_add(a, opposite);
}
fn ee_shift_left(a: ExactExtensive, shift: i32) -> ExactExtensive {
  if (a.error != 0u) { return ee_failure(a.error); }
  if (shift < 0) { return ee_failure(${ERROR.INVALID_RATIO}u); }
  var result: ExactExtensive; result.negative = a.negative;
  let whole = u32(shift) / 32u; let part = u32(shift) % 32u;
  for (var i = 0u; i < EE_WORDS; i++) {
    let word = a.words[i];
    if (word == 0u) { continue; }
    if (whole >= EE_WORDS || i >= EE_WORDS - whole) { return ee_failure(${ERROR.OVERFLOW}u); }
    let dest = i + whole;
    result.words[dest] |= word << part;
    if (part != 0u) {
      let upper = word >> (32u - part);
      if (dest + 1u >= EE_WORDS) {
        if (upper != 0u) { return ee_failure(${ERROR.OVERFLOW}u); }
      } else { result.words[dest + 1u] |= upper; }
    }
  }
  return ee_normalize(result);
}
fn ee_half_magnitude(a: ExactExtensive) -> ExactExtensive {
  var result: ExactExtensive; var carry = 0u;
  for (var i = i32(EE_WORDS) - 1; i >= 0; i--) {
    let word = a.words[u32(i)];
    result.words[u32(i)] = (word >> 1u) | carry;
    carry = word << 31u;
  }
  return result;
}
// Two base-2^16 digits in factor. Each partial product, prior digit and
// carry sum fits u32. Extra digits detect overflow rather than discarding it.
fn ee_multiply24(a: ExactExtensive, factor: u32) -> ExactExtensive {
  if (a.error != 0u) { return ee_failure(a.error); }
  var digits: array<u32, ${words * 2 + 2}>;
  for (var i = 0u; i < EE_WORDS * 2u; i++) {
    let digit = (a.words[i / 2u] >> ((i % 2u) * 16u)) & 65535u;
    var carry = 0u;
    for (var j = 0u; j < 2u; j++) {
      let term = (factor >> (j * 16u)) & 65535u;
      let sum = digits[i + j] + digit * term + carry;
      digits[i + j] = sum & 65535u; carry = sum >> 16u;
    }
    digits[i + 2u] = carry;
  }
  if ((digits[EE_WORDS * 2u] | digits[EE_WORDS * 2u + 1u]) != 0u) {
    return ee_failure(${ERROR.OVERFLOW}u);
  }
  var result: ExactExtensive; result.negative = a.negative;
  for (var i = 0u; i < EE_WORDS; i++) {
    result.words[i] = digits[i * 2u] | (digits[i * 2u + 1u] << 16u);
  }
  return ee_normalize(result);
}
fn ee_mass_product(mass: ExactMass, a_bits: u32, b_bits: u32, half_product: bool) -> ExactExtensive {
  let a_exponent = (a_bits >> 23u) & 255u; let b_exponent = (b_bits >> 23u) & 255u;
  if (a_exponent == 255u || b_exponent == 255u) { return ee_failure(${ERROR.INVALID_FLOAT}u); }
  let a_coefficient = (a_bits & 0x007fffffu) | select(0u, 0x00800000u, a_exponent != 0u);
  let b_coefficient = (b_bits & 0x007fffffu) | select(0u, 0x00800000u, b_exponent != 0u);
  var value: ExactExtensive;
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = mass.words[i]; }
  value.negative = (a_bits ^ b_bits) >> 31u;
  value = ee_multiply24(ee_multiply24(value, a_coefficient), b_coefficient);
  let shift = select(-149, i32(a_exponent) - 150, a_exponent != 0u)
    + select(-149, i32(b_exponent) - 150, b_exponent != 0u) + 299 - select(0, 1, half_product);
  return ee_shift_left(value, shift);
}
fn ee_mass_scaled(mass: ExactMass, a_bits: u32) -> ExactExtensive {
  return ee_mass_product(mass, a_bits, 0x3f800000u, false);
}
// RN-even (numerator / denominator) * 2^-299. Quantum q cancels.
// Normalize once, then divide only the 24 output significand bits. Each step
// is a full-limb compare/subtract; no nested division over every source bit.
fn ee_ratio_f32_bits(numerator: ExactExtensive, denominator: ExactMass) -> ExactMassProjection {
  var error = ee_input_error(numerator);
  if (em_zero(denominator)) { error |= ${ERROR.DIVISION_BY_ZERO}u; }
  if (error != 0u) { return ExactMassProjection(0u, error); }
  let top = ee_top(numerator);
  if (top < 0) { return ExactMassProjection(0u, 0u); }
  let sign = numerator.negative << 31u;
  var divisor: ExactExtensive;
  for (var i = 0u; i < EM_WORDS; i++) { divisor.words[i] = denominator.words[i]; }
  var ratio_order = top - em_top(denominator);
  if (ratio_order >= 0) {
    if (ee_compare_magnitude(numerator, ee_shift_left(divisor, ratio_order)) < 0) { ratio_order--; }
  } else {
    if (ee_compare_magnitude(ee_shift_left(numerator, -ratio_order), divisor) < 0) { ratio_order--; }
  }
  var order = ratio_order - 299;
  if (order > 127) { return ExactMassProjection(0u, ${ERROR.PROJECTION_OVERFLOW}u); }
  if (order < -150) { return ExactMassProjection(sign, ${ERROR.PROJECTION_UNDERFLOW}u); }
  let normal = order >= -126;
  // Even subnormal output quantization divides by D*2^150. For normal
  // output the shift is >=150. Every aligned divisor fits N+18 words.
  divisor = ee_shift_left(divisor, select(150, ratio_order - 23, normal));
  var aligned = ee_shift_left(divisor, 23);
  var remainder = numerator;
  var quotient = 0u;
  for (var bit = 23i; bit >= 0; bit--) {
    if (ee_compare_magnitude(remainder, aligned) >= 0) {
      remainder = ee_difference(remainder, aligned); quotient |= 1u << u32(bit);
    }
    aligned = ee_half_magnitude(aligned);
  }
  let comparison = ee_compare_magnitude(remainder, ee_difference(divisor, remainder));
  if (comparison > 0 || (comparison == 0 && (quotient & 1u) != 0u)) { quotient++; }
  if (!normal) {
    return ExactMassProjection(sign | quotient,
      select(0u, ${ERROR.PROJECTION_UNDERFLOW}u, quotient == 0u));
  }
  if (quotient == 0x01000000u) { quotient >>= 1u; order++; }
  if (order > 127) { return ExactMassProjection(0u, ${ERROR.PROJECTION_OVERFLOW}u); }
  return ExactMassProjection(sign | (u32(order + 127) << 23u) | (quotient - 0x00800000u), 0u);
}
`;
}
