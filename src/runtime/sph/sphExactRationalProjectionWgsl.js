import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as ERROR }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';

/** Checked, round-once projection of (signed numerator / positive denominator)
 * * 2^binaryExponent. Requires matching EM/EE/EC libraries. Projection neither
 * changes the retained rational nor grants physical publication authority.
 * Nonzero subnormals succeed; rounding a nonzero value to signed zero reports
 * PROJECTION_UNDERFLOW. Overflow returns zero bits with PROJECTION_OVERFLOW. */
export function createSphExactRationalProjectionWgsl(format) {
  validateSphExactMassFormat(format);
  const words = 3 * format.wordCount + 26;
  return /* wgsl */ `
const ER_WORDS: u32 = ${words + 1}u;
struct ExactRationalScratch { words: array<u32, ${words + 1}>, error: u32 }
fn er_scratch(value: ExactCaloric) -> ExactRationalScratch {
  var result = ExactRationalScratch();
  for (var i = 0u; i < EC_WORDS; i++) { result.words[i] = value.words[i]; }
  return result;
}
fn er_shift_left(value: ExactRationalScratch, shift: u32) -> ExactRationalScratch {
  var result = ExactRationalScratch(); result.error = value.error;
  let whole = shift / 32u; let part = shift % 32u;
  for (var i = 0u; i < ER_WORDS; i++) {
    let word = value.words[i]; if (word == 0u) { continue; }
    if (whole >= ER_WORDS || i >= ER_WORDS - whole) {
      result.error |= ${ERROR.OVERFLOW}u; continue;
    }
    let dest = i + whole; result.words[dest] |= word << part;
    if (part != 0u) {
      let upper = word >> (32u - part);
      if (dest + 1u >= ER_WORDS) {
        if (upper != 0u) { result.error |= ${ERROR.OVERFLOW}u; }
      } else { result.words[dest + 1u] |= upper; }
    }
  }
  return result;
}
fn er_compare(a: ExactRationalScratch, b: ExactRationalScratch) -> i32 {
  for (var i = i32(ER_WORDS) - 1; i >= 0; i--) {
    if (a.words[u32(i)] < b.words[u32(i)]) { return -1; }
    if (a.words[u32(i)] > b.words[u32(i)]) { return 1; }
  }
  return 0;
}
fn er_difference(a: ExactRationalScratch, b: ExactRationalScratch) -> ExactRationalScratch {
  var result = ExactRationalScratch(); var borrow = 0u;
  result.error = a.error | b.error;
  for (var i = 0u; i < ER_WORDS; i++) {
    let first = a.words[i] - b.words[i]; result.words[i] = first - borrow;
    borrow = select(0u, 1u, a.words[i] < b.words[i] || first < borrow);
  }
  if (borrow != 0u) { result.error |= ${ERROR.UNDERFLOW}u; }
  return result;
}
fn er_shift_right_one(value: ExactRationalScratch) -> ExactRationalScratch {
  var result = ExactRationalScratch(); result.error = value.error;
  for (var i = 0u; i < ER_WORDS; i++) {
    result.words[i] = value.words[i] >> 1u;
    if (i + 1u < ER_WORDS) { result.words[i] |= value.words[i + 1u] << 31u; }
  }
  return result;
}
fn er_project_f32_bits(numerator: ExactCaloric, denominator: ExactCaloric,
  binaryExponent: i32) -> ExactMassProjection {
  let top_n = ec_top(numerator); let top_d = ec_top(denominator);
  var error = ec_input_error(numerator) | ec_input_error(denominator);
  if (denominator.negative != 0u) { error |= ${ERROR.INVALID_RATIO}u; }
  if (top_d < 0) { error |= ${ERROR.DIVISION_BY_ZERO}u; }
  // Carry canonical-sign validation in the zero terminal value itself.
  // A zero magnitude does not erase malformed metadata or denominator errors.
  if (top_n < 0) {
    return ExactMassProjection(0u, error | select(0u, ${ERROR.INVALID_RATIO}u, numerator.negative != 0u));
  }
  if (error != 0u) { return ExactMassProjection(0u, error); }
  let sign = numerator.negative << 31u;
  // Bound arbitrary i32 exponents before adding the bounded ratio order.
  if (binaryExponent > ${128 + 32 * words}) {
    return ExactMassProjection(0u, ${ERROR.PROJECTION_OVERFLOW}u);
  }
  if (binaryExponent < ${-150 - 32 * words}) {
    return ExactMassProjection(sign, ${ERROR.PROJECTION_UNDERFLOW}u);
  }
  var ratio_order = top_n - top_d;
  let n = er_scratch(numerator); let d = er_scratch(denominator);
  var order_comparison = 0;
  if (ratio_order >= 0) { order_comparison = er_compare(n, er_shift_left(d, u32(ratio_order))); }
  else { order_comparison = er_compare(er_shift_left(n, u32(-ratio_order)), d); }
  if (order_comparison < 0) { ratio_order--; }
  var order = ratio_order + binaryExponent;
  if (order > 127) { return ExactMassProjection(0u, ${ERROR.PROJECTION_OVERFLOW}u); }
  if (order < -150) { return ExactMassProjection(sign, ${ERROR.PROJECTION_UNDERFLOW}u); }
  let subnormal = order < -126;
  let shift = select(ratio_order - 23, -149 - binaryExponent, subnormal);
  var remainder = n; var divisor = d;
  if (shift >= 0) { divisor = er_shift_left(d, u32(shift)); }
  else { remainder = er_shift_left(n, u32(-shift)); }
  // At most 24 quotient bits are needed. One additional limb accommodates
  // full-width inputs and the aligned divisor, including half-min-subnormal.
  var aligned = er_shift_left(divisor, 23u);
  error = remainder.error | divisor.error | aligned.error;
  if (error != 0u) { return ExactMassProjection(0u, error); }
  var quotient = 0u;
  for (var bit = 23; bit >= 0; bit--) {
    if (er_compare(remainder, aligned) >= 0) {
      remainder = er_difference(remainder, aligned); quotient |= 1u << u32(bit);
    }
    aligned = er_shift_right_one(aligned);
  }
  let distance = er_difference(divisor, remainder);
  error = remainder.error | distance.error;
  if (error != 0u) { return ExactMassProjection(0u, error); }
  let halfway = er_compare(remainder, distance);
  if (halfway > 0 || (halfway == 0 && (quotient & 1u) != 0u)) { quotient++; }
  if (subnormal) {
    return ExactMassProjection(sign | quotient,
      select(0u, ${ERROR.PROJECTION_UNDERFLOW}u, quotient == 0u));
  }
  if (quotient == 0x01000000u) { quotient >>= 1u; order++; }
  if (order > 127) { return ExactMassProjection(0u, ${ERROR.PROJECTION_OVERFLOW}u); }
  return ExactMassProjection(sign | (u32(order + 127) << 23u) | (quotient - 0x00800000u), 0u);
}
`;
}
