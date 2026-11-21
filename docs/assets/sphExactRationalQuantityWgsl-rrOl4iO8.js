import{t as e}from"./sphExactMassInventory-FFefHwOc.js";function t({wordCount:e}={}){if(!Number.isSafeInteger(e)||e<1||e>4096)throw RangeError(`Exact rational quantity requires 1..4096 limbs`);return Object.freeze({wordCount:e,headerWords:4,recordWords:4+2*e,numeratorOffsetWords:4,denominatorOffsetWords:4+e,scratchWordCount:2*e+1})}function n(n){let{wordCount:r,scratchWordCount:i}=t(n),a=n?.canonicalOperands??!1;if(typeof a!=`boolean`)throw TypeError(`canonicalOperands must be boolean`);let o=a?`xrp_rational_copy`:`xrp_normalize`;return`
const XR_WORDS: u32 = ${r}u;
const XR_SCRATCH_WORDS: u32 = ${i}u;
struct ExactRational {
  negative: u32, error: u32, exponent: i32, reserved: u32,
  numerator: array<u32, ${r}>, denominator: array<u32, ${r}>
}
struct ExactRationalWide { words: array<u32, ${i}>, error: u32 }
struct ExactRationalExponent { value: i32, error: u32 }
struct ExactRationalProjection { bits: u32, error: u32 }
fn xr_zero() -> ExactRational {
  var v = ExactRational(); v.denominator[0] = 1u; return v;
}
fn xr_failure(error: u32) -> ExactRational {
  var v = xr_zero(); v.error = error; return v;
}
fn xrp_top(v: ptr<function, ExactRationalWide>) -> i32 {
  for (var i = i32(XR_SCRATCH_WORDS) - 1; i >= 0; i--) {
    let word = (*v).words[u32(i)];
    if (word != 0u) { return i * 32 + 31 - i32(countLeadingZeros(word)); }
  }
  return -1;
}
fn xrp_trailing(v: ptr<function, ExactRationalWide>) -> u32 {
  for (var i = 0u; i < XR_SCRATCH_WORDS; i++) {
    let word = (*v).words[i];
    if (word != 0u) { return i * 32u + countTrailingZeros(word); }
  }
  return XR_SCRATCH_WORDS * 32u;
}
fn xrp_compare(a: ptr<function, ExactRationalWide>, b: ptr<function, ExactRationalWide>) -> i32 {
  for (var i = i32(XR_SCRATCH_WORDS) - 1; i >= 0; i--) {
    if ((*a).words[u32(i)] < (*b).words[u32(i)]) { return -1; }
    if ((*a).words[u32(i)] > (*b).words[u32(i)]) { return 1; }
  }
  return 0;
}
fn xrp_copy(dest: ptr<function, ExactRationalWide>, source: ptr<function, ExactRationalWide>) {
  for (var i = 0u; i < XR_SCRATCH_WORDS; i++) { (*dest).words[i] = (*source).words[i]; }
  (*dest).error = (*source).error;
}
fn xrp_swap(a: ptr<function, ExactRationalWide>, b: ptr<function, ExactRationalWide>) {
  for (var i = 0u; i < XR_SCRATCH_WORDS; i++) {
    let saved = (*a).words[i]; (*a).words[i] = (*b).words[i]; (*b).words[i] = saved;
  }
  let saved_error = (*a).error; (*a).error = (*b).error; (*b).error = saved_error;
}
fn xrp_shift_right(v: ptr<function, ExactRationalWide>, shift: u32) {
  let whole = shift / 32u; let part = shift % 32u;
  // Ascending destinations read only their own or higher untouched source words.
  for (var i = 0u; i < XR_SCRATCH_WORDS; i++) {
    var word = 0u;
    if (whole < XR_SCRATCH_WORDS && i < XR_SCRATCH_WORDS - whole) {
      word = (*v).words[i + whole] >> part;
      if (part != 0u && i + whole + 1u < XR_SCRATCH_WORDS) {
        word |= (*v).words[i + whole + 1u] << (32u - part);
      }
    }
    (*v).words[i] = word;
  }
}
fn xrp_shift_left(v: ptr<function, ExactRationalWide>, shift: u32) {
  let top = xrp_top(v);
  if (top >= 0 && shift > XR_SCRATCH_WORDS * 32u - 1u - u32(top)) {
    (*v).error |= ${e.OVERFLOW}u;
  }
  let whole = shift / 32u; let part = shift % 32u;
  // Descending destinations read only their own or lower untouched source words.
  // The error and truncated low payload match xr_wide_shift_left even on overflow.
  for (var i = i32(XR_SCRATCH_WORDS) - 1; i >= 0; i--) {
    let dest = u32(i); var word = 0u;
    if (whole < XR_SCRATCH_WORDS && dest >= whole) {
      let source = dest - whole; word = (*v).words[source] << part;
      if (part != 0u && source > 0u) { word |= (*v).words[source - 1u] >> (32u - part); }
    }
    (*v).words[dest] = word;
  }
}
fn xrp_subtract(a: ptr<function, ExactRationalWide>, b: ptr<function, ExactRationalWide>) {
  (*a).error |= (*b).error; var borrow = 0u;
  for (var i = 0u; i < XR_SCRATCH_WORDS; i++) {
    let original = (*a).words[i]; let first = original - (*b).words[i];
    (*a).words[i] = first - borrow;
    borrow = select(0u, 1u, original < (*b).words[i] || first < borrow);
  }
  if (borrow != 0u) { (*a).error |= ${e.UNDERFLOW}u; }
}
// This is the same binary GCD ordering and the same zero/one/error terminals as
// the by-value version. Only the physical storage passed between helpers changes.
fn xrp_gcd(left: ptr<function, ExactRationalWide>, right: ptr<function, ExactRationalWide>) {
  if (xrp_top(left) < 0) { xrp_copy(left, right); return; }
  if (xrp_top(right) < 0) { return; }
  let common_shift = min(xrp_trailing(left), xrp_trailing(right));
  xrp_shift_right(left, xrp_trailing(left));
  loop {
    xrp_shift_right(right, xrp_trailing(right));
    if (xrp_top(left) == 0) {
      (*left).error |= (*right).error; xrp_shift_left(left, common_shift); return;
    }
    if (xrp_top(right) == 0) {
      (*right).error |= (*left).error; xrp_copy(left, right);
      xrp_shift_left(left, common_shift); return;
    }
    if (xrp_compare(left, right) > 0) { xrp_swap(left, right); }
    xrp_subtract(right, left);
    if (xrp_top(right) < 0 || (*right).error != 0u) { break; }
  }
  (*left).error |= (*right).error; xrp_shift_left(left, common_shift);
}
fn xr_exponent_add(a: i32, b: i32) -> ExactRationalExponent {
  if ((b > 0 && a > 2147483647 - b) || (b < 0 && a < (-2147483647 - 1) - b)) {
    return ExactRationalExponent(0, ${e.OVERFLOW}u);
  }
  return ExactRationalExponent(a + b, 0u);
}
fn xr_exponent_subtract(a: i32, b: i32) -> ExactRationalExponent {
  if (b == (-2147483647 - 1)) {
    if (a >= 0) { return ExactRationalExponent(0, ${e.OVERFLOW}u); }
    return ExactRationalExponent((a + 2147483647) + 1, 0u);
  }
  return xr_exponent_add(a, -b);
}

// Private pointer cores keep wide/rational temporaries in caller-owned function
// storage. Each written argument is distinct from all other arguments at every
// call site; read operands are not mutated. Public wrappers preserve value APIs.
fn xrp_wide_zero(out: ptr<function, ExactRationalWide>) {
  for (var i = 0u; i < XR_SCRATCH_WORDS; i++) { (*out).words[i] = 0u; }
  (*out).error = 0u;
}
fn xrp_add(a: ptr<function, ExactRationalWide>, b: ptr<function, ExactRationalWide>) {
  (*a).error |= (*b).error; var carry = 0u;
  for (var i = 0u; i < XR_SCRATCH_WORDS; i++) {
    let original = (*a).words[i]; let first = original + (*b).words[i]; let sum = first + carry;
    carry = select(0u, 1u, first < original || sum < first); (*a).words[i] = sum;
  }
  if (carry != 0u) { (*a).error |= ${e.OVERFLOW}u; }
}
fn xrp_multiply(out: ptr<function, ExactRationalWide>, a: ptr<function, ExactRationalWide>, b: ptr<function, ExactRationalWide>) {
  xrp_wide_zero(out); (*out).error = (*a).error | (*b).error;
  let top_a = xrp_top(a); let top_b = xrp_top(b);
  if (top_a < 0 || top_b < 0 || (*out).error != 0u) { return; }
  if (top_a + top_b >= i32(XR_SCRATCH_WORDS * 32u)) { (*out).error |= ${e.OVERFLOW}u; return; }
  let count_a = u32(top_a) / 16u + 1u; let count_b = u32(top_b) / 16u + 1u;
  var digits: array<u32, ${2*i}>;
  for (var i = 0u; i < count_a; i++) {
    let da = ((*a).words[i / 2u] >> ((i % 2u) * 16u)) & 65535u; var carry = 0u;
    for (var j = 0u; j < count_b; j++) {
      let db = ((*b).words[j / 2u] >> ((j % 2u) * 16u)) & 65535u;
      let sum = digits[i + j] + da * db + carry;
      digits[i + j] = sum & 65535u; carry = sum >> 16u;
    }
    if (i + count_b >= XR_SCRATCH_WORDS * 2u) { if (carry != 0u) { (*out).error |= ${e.OVERFLOW}u; } }
    else { digits[i + count_b] = carry; }
  }
  for (var i = 0u; i < XR_SCRATCH_WORDS; i++) { (*out).words[i] = digits[2u * i] | (digits[2u * i + 1u] << 16u); }
}
fn xrp_divide_exact(out: ptr<function, ExactRationalWide>, a: ptr<function, ExactRationalWide>, b: ptr<function, ExactRationalWide>) {
  xrp_wide_zero(out); (*out).error = (*a).error | (*b).error;
  var divisor: ExactRationalWide; var remainder: ExactRationalWide;
  xrp_copy(&divisor, b); xrp_copy(&remainder, a);
  let top_b = xrp_top(&divisor);
  if (top_b < 0) { (*out).error |= ${e.DIVISION_BY_ZERO}u; return; }
  if ((*out).error != 0u) { return; }
  if (top_b == 0) { xrp_copy(out, a); return; }
  let top_a = xrp_top(&remainder); let shift = top_a - top_b;
  if (shift < 0) { if (top_a >= 0) { (*out).error |= ${e.INEXACT_INPUT}u; } return; }
  xrp_shift_left(&divisor, u32(shift));
  for (var bit = shift; bit >= 0; bit--) {
    if (xrp_compare(&remainder, &divisor) >= 0) {
      xrp_subtract(&remainder, &divisor); (*out).words[u32(bit) / 32u] |= 1u << (u32(bit) % 32u);
    }
    xrp_shift_right(&divisor, 1u);
  }
  (*out).error |= remainder.error | divisor.error;
  if (xrp_top(&remainder) >= 0) { (*out).error |= ${e.INEXACT_INPUT}u; }
}
fn xrp_rational_zero(out: ptr<function, ExactRational>) {
  (*out).negative = 0u; (*out).error = 0u; (*out).exponent = 0; (*out).reserved = 0u;
  for (var i = 0u; i < XR_WORDS; i++) { (*out).numerator[i] = 0u; (*out).denominator[i] = 0u; }
  (*out).denominator[0] = 1u;
}
fn xrp_failure(out: ptr<function, ExactRational>, error: u32) {
  xrp_rational_zero(out); (*out).error = error;
}
fn xrp_rational_copy(out: ptr<function, ExactRational>, source: ptr<function, ExactRational>) {
  (*out).negative = (*source).negative; (*out).error = (*source).error;
  (*out).exponent = (*source).exponent; (*out).reserved = (*source).reserved;
  for (var i = 0u; i < XR_WORDS; i++) { (*out).numerator[i] = (*source).numerator[i]; (*out).denominator[i] = (*source).denominator[i]; }
}
fn xrp_numerator(out: ptr<function, ExactRationalWide>, source: ptr<function, ExactRational>) {
  xrp_wide_zero(out); (*out).error = (*source).error;
  for (var i = 0u; i < XR_WORDS; i++) { (*out).words[i] = (*source).numerator[i]; }
}
fn xrp_denominator(out: ptr<function, ExactRationalWide>, source: ptr<function, ExactRational>) {
  xrp_wide_zero(out); (*out).error = (*source).error;
  for (var i = 0u; i < XR_WORDS; i++) { (*out).words[i] = (*source).denominator[i]; }
}
fn xrp_finish(out: ptr<function, ExactRational>, n: ptr<function, ExactRationalWide>, d: ptr<function, ExactRationalWide>, negative: u32, exponent: i32) {
  var error = (*n).error | (*d).error;
  if (negative > 1u) { error |= ${e.INVALID_RATIO}u; }
  if (xrp_top(d) < 0) { error |= ${e.DIVISION_BY_ZERO}u; }
  if (error != 0u) { xrp_failure(out, error); return; }
  if (xrp_top(n) < 0) { xrp_rational_zero(out); return; }
  let nt = xrp_trailing(n); let dt = xrp_trailing(d);
  let adjusted = xr_exponent_add(exponent, i32(nt) - i32(dt));
  if (adjusted.error != 0u) { xrp_failure(out, adjusted.error); return; }
  var numerator: ExactRationalWide; var denominator: ExactRationalWide;
  xrp_copy(&numerator, n); xrp_shift_right(&numerator, nt);
  xrp_copy(&denominator, d); xrp_shift_right(&denominator, dt);
  if (xrp_top(&numerator) != 0 && xrp_top(&denominator) != 0) {
    var divisor: ExactRationalWide; var gcd_right: ExactRationalWide;
    xrp_copy(&divisor, &numerator); xrp_copy(&gcd_right, &denominator); xrp_gcd(&divisor, &gcd_right);
    var reduced_n: ExactRationalWide; var reduced_d: ExactRationalWide;
    xrp_divide_exact(&reduced_n, &numerator, &divisor);
    xrp_divide_exact(&reduced_d, &denominator, &divisor);
    xrp_copy(&numerator, &reduced_n); xrp_copy(&denominator, &reduced_d);
  }
  error |= numerator.error | denominator.error;
  if (xrp_top(&numerator) >= i32(XR_WORDS * 32u) || xrp_top(&denominator) >= i32(XR_WORDS * 32u)) { error |= ${e.OVERFLOW}u; }
  if (error != 0u) { xrp_failure(out, error); return; }
  xrp_rational_zero(out); (*out).negative = negative; (*out).exponent = adjusted.value;
  for (var i = 0u; i < XR_WORDS; i++) { (*out).numerator[i] = numerator.words[i]; (*out).denominator[i] = denominator.words[i]; }
}
fn xrp_normalize(out: ptr<function, ExactRational>, v: ptr<function, ExactRational>) {
  var n: ExactRationalWide; var d: ExactRationalWide; xrp_numerator(&n, v); xrp_denominator(&d, v);
  var error = (*v).error;
  if ((*v).negative > 1u || (*v).reserved != 0u || ((*v).negative != 0u && xrp_top(&n) < 0)) { error |= ${e.INVALID_RATIO}u; }
  if (xrp_top(&d) < 0) { error |= ${e.DIVISION_BY_ZERO}u; }
  if (error != 0u) { xrp_failure(out, error); return; }
  xrp_finish(out, &n, &d, (*v).negative, (*v).exponent);
}
fn xrp_rational_add(out: ptr<function, ExactRational>, a: ptr<function, ExactRational>, b: ptr<function, ExactRational>) {
  var left: ExactRational; var right: ExactRational;
  ${o}(&left, a); ${o}(&right, b); let error = left.error | right.error;
  if (error != 0u) { xrp_failure(out, error); return; }
  var ln: ExactRationalWide; var rn: ExactRationalWide;
  xrp_numerator(&ln, &left); xrp_numerator(&rn, &right);
  if (xrp_top(&ln) < 0) { xrp_rational_copy(out, &right); return; }
  if (xrp_top(&rn) < 0) { xrp_rational_copy(out, &left); return; }
  var ld: ExactRationalWide; var rd: ExactRationalWide;
  xrp_denominator(&ld, &left); xrp_denominator(&rd, &right);
  let exponent = min(left.exponent, right.exponent);
  var lp: ExactRationalWide; var rp: ExactRationalWide; var denominator: ExactRationalWide;
  xrp_multiply(&lp, &ln, &rd);
  xrp_shift_left(&lp, bitcast<u32>(left.exponent) - bitcast<u32>(exponent));
  xrp_multiply(&rp, &rn, &ld);
  xrp_shift_left(&rp, bitcast<u32>(right.exponent) - bitcast<u32>(exponent));
  xrp_multiply(&denominator, &ld, &rd);
  if ((lp.error | rp.error | denominator.error) != 0u) { xrp_failure(out, lp.error | rp.error | denominator.error); return; }
  if (left.negative == right.negative) {
    xrp_add(&lp, &rp); xrp_finish(out, &lp, &denominator, left.negative, exponent); return;
  }
  if (xrp_compare(&lp, &rp) >= 0) {
    xrp_subtract(&lp, &rp); xrp_finish(out, &lp, &denominator, left.negative, exponent); return;
  }
  xrp_subtract(&rp, &lp); xrp_finish(out, &rp, &denominator, right.negative, exponent);
}
fn xrp_rational_subtract(out: ptr<function, ExactRational>, a: ptr<function, ExactRational>, b: ptr<function, ExactRational>) {
  var right: ExactRational; ${o}(&right, b);
  var rn: ExactRationalWide; xrp_numerator(&rn, &right);
  if (xrp_top(&rn) >= 0) { right.negative ^= 1u; }
  xrp_rational_add(out, a, &right);
}
fn xrp_rational_multiply(out: ptr<function, ExactRational>, a: ptr<function, ExactRational>, b: ptr<function, ExactRational>) {
  var left: ExactRational; var right: ExactRational;
  ${o}(&left, a); ${o}(&right, b); let error = left.error | right.error;
  if (error != 0u) { xrp_failure(out, error); return; }
  var ln: ExactRationalWide; var rn: ExactRationalWide;
  xrp_numerator(&ln, &left); xrp_numerator(&rn, &right);
  if (xrp_top(&ln) < 0 || xrp_top(&rn) < 0) { xrp_rational_zero(out); return; }
  let exponent = xr_exponent_add(left.exponent, right.exponent);
  if (exponent.error != 0u) { xrp_failure(out, exponent.error); return; }
  var ld: ExactRationalWide; var rd: ExactRationalWide;
  xrp_denominator(&ld, &left); xrp_denominator(&rd, &right);
  var numerator: ExactRationalWide; var denominator: ExactRationalWide;
  xrp_multiply(&numerator, &ln, &rn); xrp_multiply(&denominator, &ld, &rd);
  xrp_finish(out, &numerator, &denominator, left.negative ^ right.negative, exponent.value);
}
fn xrp_rational_divide(out: ptr<function, ExactRational>, a: ptr<function, ExactRational>, b: ptr<function, ExactRational>) {
  var left: ExactRational; var right: ExactRational;
  ${o}(&left, a); ${o}(&right, b); var error = left.error | right.error;
  if (error != 0u) { xrp_failure(out, error); return; }
  var rn: ExactRationalWide; xrp_numerator(&rn, &right);
  if (xrp_top(&rn) < 0) { error |= ${e.DIVISION_BY_ZERO}u; }
  if (error != 0u) { xrp_failure(out, error); return; }
  var ln: ExactRationalWide; xrp_numerator(&ln, &left);
  if (xrp_top(&ln) < 0) { xrp_rational_zero(out); return; }
  let exponent = xr_exponent_subtract(left.exponent, right.exponent);
  if (exponent.error != 0u) { xrp_failure(out, exponent.error); return; }
  var ld: ExactRationalWide; var rd: ExactRationalWide;
  xrp_denominator(&ld, &left); xrp_denominator(&rd, &right);
  var numerator: ExactRationalWide; var denominator: ExactRationalWide;
  xrp_multiply(&numerator, &ln, &rd); xrp_multiply(&denominator, &ld, &rn);
  xrp_finish(out, &numerator, &denominator, left.negative ^ right.negative, exponent.value);
}
fn xrp_scale_pow2(out: ptr<function, ExactRational>, v: ptr<function, ExactRational>, shift: i32) {
  ${o}(out, v); var n: ExactRationalWide; xrp_numerator(&n, out);
  if ((*out).error != 0u || xrp_top(&n) < 0) { return; }
  let exponent = xr_exponent_add((*out).exponent, shift);
  if (exponent.error != 0u) { xrp_failure(out, exponent.error); return; }
  (*out).exponent = exponent.value;
}
fn xrp_from_f32_bits(out: ptr<function, ExactRational>, bits: u32) {
  let encoded = (bits >> 23u) & 255u;
  if (encoded == 255u) { xrp_failure(out, ${e.INVALID_FLOAT}u); return; }
  let coefficient = (bits & 0x007fffffu) | select(0u, 0x00800000u, encoded != 0u);
  if (coefficient == 0u) { xrp_rational_zero(out); return; }
  var raw: ExactRational; xrp_rational_zero(&raw); raw.negative = bits >> 31u; raw.numerator[0] = coefficient;
  raw.exponent = select(-149, i32(encoded) - 150, encoded != 0u); xrp_normalize(out, &raw);
}
fn xrp_project_f32_bits(v: ptr<function, ExactRational>) -> ExactRationalProjection {
  var value: ExactRational; ${o}(&value, v);
  if (value.error != 0u) { return ExactRationalProjection(0u, value.error); }
  var n: ExactRationalWide; var d: ExactRationalWide; xrp_numerator(&n, &value); xrp_denominator(&d, &value);
  let top_n = xrp_top(&n); let top_d = xrp_top(&d);
  if (top_n < 0) { return ExactRationalProjection(0u, 0u); }
  let sign = value.negative << 31u;
  if (value.exponent > ${128+32*r}) { return ExactRationalProjection(0u, ${e.PROJECTION_OVERFLOW}u); }
  if (value.exponent < ${-150-32*r}) { return ExactRationalProjection(sign, ${e.PROJECTION_UNDERFLOW}u); }
  var ratio_order = top_n - top_d; var order_comparison = 0;
  var compared: ExactRationalWide;
  if (ratio_order >= 0) {
    xrp_copy(&compared, &d); xrp_shift_left(&compared, u32(ratio_order)); order_comparison = xrp_compare(&n, &compared);
  } else {
    xrp_copy(&compared, &n); xrp_shift_left(&compared, u32(-ratio_order)); order_comparison = xrp_compare(&compared, &d);
  }
  if (order_comparison < 0) { ratio_order--; }
  var order = ratio_order + value.exponent;
  if (order > 127) { return ExactRationalProjection(0u, ${e.PROJECTION_OVERFLOW}u); }
  if (order < -150) { return ExactRationalProjection(sign, ${e.PROJECTION_UNDERFLOW}u); }
  let subnormal = order < -126;
  let shift = select(ratio_order - 23, -149 - value.exponent, subnormal);
  var remainder: ExactRationalWide; var divisor: ExactRationalWide;
  xrp_copy(&remainder, &n); xrp_copy(&divisor, &d);
  if (shift >= 0) { xrp_shift_left(&divisor, u32(shift)); }
  else { xrp_shift_left(&remainder, u32(-shift)); }
  var aligned: ExactRationalWide; xrp_copy(&aligned, &divisor); xrp_shift_left(&aligned, 23u);
  var error = remainder.error | divisor.error | aligned.error;
  if (error != 0u) { return ExactRationalProjection(0u, error); }
  var quotient = 0u;
  for (var bit = 23; bit >= 0; bit--) {
    if (xrp_compare(&remainder, &aligned) >= 0) { xrp_subtract(&remainder, &aligned); quotient |= 1u << u32(bit); }
    xrp_shift_right(&aligned, 1u);
  }
  var distance: ExactRationalWide; xrp_copy(&distance, &divisor); xrp_subtract(&distance, &remainder);
  error = remainder.error | distance.error;
  if (error != 0u) { return ExactRationalProjection(0u, error); }
  let halfway = xrp_compare(&remainder, &distance);
  if (halfway > 0 || (halfway == 0 && (quotient & 1u) != 0u)) { quotient++; }
  if (subnormal) { return ExactRationalProjection(sign | quotient, select(0u, ${e.PROJECTION_UNDERFLOW}u, quotient == 0u)); }
  if (quotient == 0x01000000u) { quotient >>= 1u; order++; }
  if (order > 127) { return ExactRationalProjection(0u, ${e.PROJECTION_OVERFLOW}u); }
  return ExactRationalProjection(sign | (u32(order + 127) << 23u) | (quotient - 0x00800000u), 0u);
}

// Public value wrappers copy external operands once, preserve every original
// signature, and never expose private mutable temporaries to their caller.
fn xr_wide_top(v: ExactRationalWide) -> i32 { var local = v; return xrp_top(&local); }
fn xr_wide_trailing(v: ExactRationalWide) -> u32 { var local = v; return xrp_trailing(&local); }
fn xr_wide_compare(a: ExactRationalWide, b: ExactRationalWide) -> i32 {
  var left = a; var right = b; return xrp_compare(&left, &right);
}
fn xr_wide_one(v: ExactRationalWide) -> bool { var local = v; return xrp_top(&local) == 0; }
fn xr_numerator(v: ExactRational) -> ExactRationalWide {
  var local = v; var out: ExactRationalWide; xrp_numerator(&out, &local); return out;
}
fn xr_denominator(v: ExactRational) -> ExactRationalWide {
  var local = v; var out: ExactRationalWide; xrp_denominator(&out, &local); return out;
}
fn xr_wide_shift_left(v: ExactRationalWide, shift: u32) -> ExactRationalWide {
  var out = v; xrp_shift_left(&out, shift); return out;
}
fn xr_wide_shift_right(v: ExactRationalWide, shift: u32) -> ExactRationalWide {
  var out = v; xrp_shift_right(&out, shift); return out;
}
fn xr_wide_add(a: ExactRationalWide, b: ExactRationalWide) -> ExactRationalWide {
  var out = a; var right = b; xrp_add(&out, &right); return out;
}
fn xr_wide_subtract(a: ExactRationalWide, b: ExactRationalWide) -> ExactRationalWide {
  var out = a; var right = b; xrp_subtract(&out, &right); return out;
}
fn xr_wide_multiply(a: ExactRationalWide, b: ExactRationalWide) -> ExactRationalWide {
  var left = a; var right = b; var out: ExactRationalWide; xrp_multiply(&out, &left, &right); return out;
}
fn xr_wide_gcd(a: ExactRationalWide, b: ExactRationalWide) -> ExactRationalWide {
  var left = a; var right = b; xrp_gcd(&left, &right); return left;
}
fn xr_wide_divide_exact(a: ExactRationalWide, b: ExactRationalWide) -> ExactRationalWide {
  var left = a; var right = b; var out: ExactRationalWide; xrp_divide_exact(&out, &left, &right); return out;
}
fn xr_finish(n: ExactRationalWide, d: ExactRationalWide, negative: u32, exponent: i32) -> ExactRational {
  var numerator = n; var denominator = d; var out: ExactRational;
  xrp_finish(&out, &numerator, &denominator, negative, exponent); return out;
}
fn xr_normalize(v: ExactRational) -> ExactRational {
  var local = v; var out: ExactRational; xrp_normalize(&out, &local); return out;
}
fn xr_add(a: ExactRational, b: ExactRational) -> ExactRational {
  var left = a; var right = b; var out: ExactRational; xrp_rational_add(&out, &left, &right); return out;
}
fn xr_subtract(a: ExactRational, b: ExactRational) -> ExactRational {
  var left = a; var right = b; var out: ExactRational; xrp_rational_subtract(&out, &left, &right); return out;
}
fn xr_multiply(a: ExactRational, b: ExactRational) -> ExactRational {
  var left = a; var right = b; var out: ExactRational; xrp_rational_multiply(&out, &left, &right); return out;
}
fn xr_divide(a: ExactRational, b: ExactRational) -> ExactRational {
  var left = a; var right = b; var out: ExactRational; xrp_rational_divide(&out, &left, &right); return out;
}
fn xr_scale_pow2(v: ExactRational, shift: i32) -> ExactRational {
  var local = v; var out: ExactRational; xrp_scale_pow2(&out, &local, shift); return out;
}
fn xr_from_f32_bits(bits: u32) -> ExactRational {
  var out: ExactRational; xrp_from_f32_bits(&out, bits); return out;
}
fn xr_project_f32_bits(v: ExactRational) -> ExactRationalProjection {
  var local = v; return xrp_project_f32_bits(&local);
}
`}export{t as n,n as t};