import{s as e,t}from"./sphExactMassInventory-RqW1sZ8d.js";function n(n){return e(n),`
const EM_WORDS: u32 = ${n.wordCount}u;
const EM_QUANTUM: i32 = ${n.quantumExponent}i;
struct ExactMass { words: array<u32, ${n.wordCount}> }
struct ExactMassResult { value: ExactMass, error: u32 }
struct ExactMassProjection { bits: u32, error: u32 }
struct ExactMassTransfer { donor: ExactMass, receiver: ExactMass, error: u32 }
struct ExactMassRatio { value: ExactMass, remainder: ExactMass, error: u32 }

fn em_zero(a: ExactMass) -> bool {
  var bits = 0u;
  for (var i = 0u; i < EM_WORDS; i++) { bits |= a.words[i]; }
  return bits == 0u;
}
fn em_compare(a: ExactMass, b: ExactMass) -> i32 {
  for (var i = i32(EM_WORDS) - 1; i >= 0; i--) {
    if (a.words[u32(i)] < b.words[u32(i)]) { return -1; }
    if (a.words[u32(i)] > b.words[u32(i)]) { return 1; }
  }
  return 0;
}
fn em_add(a: ExactMass, b: ExactMass) -> ExactMassResult {
  var result: ExactMass; var carry = 0u;
  for (var i = 0u; i < EM_WORDS; i++) {
    let first = a.words[i] + b.words[i];
    let second = first + carry;
    carry = select(0u, 1u, first < a.words[i] || second < first);
    result.words[i] = second;
  }
  if (carry != 0u) { return ExactMassResult(a, ${t.OVERFLOW}u); }
  return ExactMassResult(result, 0u);
}
fn em_subtract(a: ExactMass, b: ExactMass) -> ExactMassResult {
  var result: ExactMass; var borrow = 0u;
  for (var i = 0u; i < EM_WORDS; i++) {
    let first = a.words[i] - b.words[i];
    let second = first - borrow;
    borrow = select(0u, 1u, a.words[i] < b.words[i] || first < borrow);
    result.words[i] = second;
  }
  if (borrow != 0u) { return ExactMassResult(a, ${t.UNDERFLOW}u); }
  return ExactMassResult(result, 0u);
}
fn em_transfer(donor: ExactMass, receiver: ExactMass, packet: ExactMass) -> ExactMassTransfer {
  let debit = em_subtract(donor, packet);
  let credit = em_add(receiver, packet);
  let error = debit.error | credit.error;
  if (error != 0u) { return ExactMassTransfer(donor, receiver, error); }
  return ExactMassTransfer(debit.value, credit.value, 0u);
}
fn em_bit(a: ExactMass, bit: i32) -> u32 {
  if (bit < 0 || bit >= i32(EM_WORDS * 32u)) { return 0u; }
  return (a.words[u32(bit) / 32u] >> (u32(bit) % 32u)) & 1u;
}
fn em_any_below(a: ExactMass, end: i32) -> bool {
  let bound = u32(clamp(end, 0, i32(EM_WORDS * 32u)));
  for (var i = 0u; i < EM_WORDS; i++) {
    let start = i * 32u;
    if (start >= bound) { break; }
    let count = min(32u, bound - start);
    var mask = 0xffffffffu;
    if (count < 32u) { mask = (1u << count) - 1u; }
    if ((a.words[i] & mask) != 0u) { return true; }
  }
  return false;
}
fn em_top(a: ExactMass) -> i32 {
  for (var i = i32(EM_WORDS) - 1; i >= 0; i--) {
    let word = a.words[u32(i)];
    if (word != 0u) { return i * 32 + 31 - i32(countLeadingZeros(word)); }
  }
  return -1;
}
// floor(a * numerator / denominator), including the exact division remainder.
// A bounded ratio needs no double-width product. At each source bit, reduce
// 2*r and then r+numerator before either addition can overflow. The quotient
// stays <= the processed prefix of a, even when a occupies every limb.
// This is integer packet selection, not floating-point mass reconstruction.
fn em_multiply_ratio(a: ExactMass, numerator: ExactMass, denominator: ExactMass) -> ExactMassRatio {
  if (em_zero(denominator)) {
    return ExactMassRatio(a, ExactMass(), ${t.DIVISION_BY_ZERO}u);
  }
  let ratio_order = em_compare(numerator, denominator);
  if (ratio_order > 0) {
    return ExactMassRatio(a, ExactMass(), ${t.INVALID_RATIO}u);
  }
  // Keep invalid denominator/ratio checks above these exact endpoints. Pure
  // phase transfers spend the entire integer packet, including its low bit;
  // zero-weight terms spend none. Neither case needs bitwise long division.
  if (em_zero(numerator)) {
    return ExactMassRatio(ExactMass(), ExactMass(), 0u);
  }
  if (ratio_order == 0) {
    return ExactMassRatio(a, ExactMass(), 0u);
  }
  var quotient: ExactMass;
  var remainder: ExactMass;
  let denominator_minus_numerator = em_subtract(denominator, numerator).value;
  for (var bit = em_top(a); bit >= 0; bit--) {
    var increment = 0u;
    let complement = em_subtract(denominator, remainder).value;
    if (em_compare(remainder, complement) >= 0) {
      remainder = em_subtract(remainder, complement).value;
      increment = 1u;
    } else {
      remainder = em_add(remainder, remainder).value;
    }
    if (em_bit(a, bit) != 0u) {
      if (em_compare(remainder, denominator_minus_numerator) >= 0) {
        remainder = em_subtract(remainder, denominator_minus_numerator).value;
        increment++;
      } else {
        remainder = em_add(remainder, numerator).value;
      }
    }
    // q' = 2*q + increment, where increment can be two. Propagate that
    // extra unit explicitly; bitwise OR would lose it at a low-word carry.
    var shift_carry = 0u;
    for (var word = 0u; word < EM_WORDS; word++) {
      let next_carry = quotient.words[word] >> 31u;
      quotient.words[word] = (quotient.words[word] << 1u) | shift_carry;
      shift_carry = next_carry;
    }
    var add_carry = increment;
    for (var word = 0u; word < EM_WORDS; word++) {
      let before = quotient.words[word];
      quotient.words[word] += add_carry;
      add_carry = select(0u, 1u, quotient.words[word] < before);
    }
    if (shift_carry != 0u || add_carry != 0u) {
      return ExactMassRatio(a, ExactMass(), ${t.OVERFLOW}u);
    }
  }
  return ExactMassRatio(quotient, remainder, 0u);
}

// An ordered product term owns [lower, upper) in an exact cumulative weight
// partition. Adjacent terms telescope; [0, denominator) allocates all of a,
// including its last low bit. A zero share is an exact result, not permission
// to erase a positive physical owner. Material/phase gates remain separate.
fn em_partition_share(a: ExactMass, lower: ExactMass, upper: ExactMass,
  denominator: ExactMass) -> ExactMassResult {
  if (em_compare(lower, upper) > 0) {
    return ExactMassResult(a, ${t.INVALID_RATIO}u);
  }
  let start = em_multiply_ratio(a, lower, denominator);
  let end = em_multiply_ratio(a, upper, denominator);
  let error = start.error | end.error;
  if (error != 0u) { return ExactMassResult(a, error); }
  return em_subtract(end.value, start.value);
}
// Caller establishes that the rounded result has at most 25 significant bits.
fn em_rounded_shift(a: ExactMass, shift: i32) -> u32 {
  var high = 0u;
  for (var i = 0i; i < 25; i++) { high |= em_bit(a, i + shift) << u32(i); }
  if (shift > 0 && em_bit(a, shift - 1) != 0u
      && (em_any_below(a, shift - 1) || (high & 1u) != 0u)) { high++; }
  return high;
}
fn em_project_f32_bits(a: ExactMass) -> ExactMassProjection {
  let top = em_top(a);
  if (top < 0) { return ExactMassProjection(0u, 0u); }
  var order = top + EM_QUANTUM;
  if (order < -126) {
    let rounded = em_rounded_shift(a, -149 - EM_QUANTUM);
    return ExactMassProjection(rounded, select(0u, ${t.PROJECTION_UNDERFLOW}u, rounded == 0u));
  }
  var significand = em_rounded_shift(a, top - 23);
  if (significand == 0x01000000u) { significand >>= 1u; order++; }
  if (order > 127) { return ExactMassProjection(0u, ${t.PROJECTION_OVERFLOW}u); }
  return ExactMassProjection((u32(order + 127) << 23u) | (significand - 0x00800000u), 0u);
}
fn em_from_f32_bits(bits: u32) -> ExactMassResult {
  var result: ExactMass;
  if ((bits & 0x80000000u) != 0u || bits >= 0x7f800000u) {
    return ExactMassResult(result, ${t.INVALID_FLOAT}u);
  }
  let encoded = (bits >> 23u) & 255u;
  var coefficient = bits & 0x007fffffu;
  var exponent = -149i;
  if (encoded != 0u) { coefficient |= 0x00800000u; exponent = i32(encoded) - 150; }
  let shift = exponent - EM_QUANTUM;
  for (var i = 0i; i < 24; i++) {
    if ((coefficient & (1u << u32(i))) == 0u) { continue; }
    let bit = i + shift;
    if (bit < 0) { return ExactMassResult(ExactMass(), ${t.INEXACT_INPUT}u); }
    if (bit >= i32(EM_WORDS * 32u)) { return ExactMassResult(ExactMass(), ${t.OVERFLOW}u); }
    result.words[u32(bit) / 32u] |= 1u << (u32(bit) % 32u);
  }
  return ExactMassResult(result, 0u);
}
`}export{n as t};