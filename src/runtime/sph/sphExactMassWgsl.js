import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as ERROR }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';

// One run-wide numeric format, shared by all species. No buffer ownership or
// physical interval is conferred by this arithmetic library. All operations
// use integer limbs, including f32 ingress/egress and subnormal encodings.
export function createSphExactMassWgsl(format) {
  validateSphExactMassFormat(format);
  return /* wgsl */ `
const EM_WORDS: u32 = ${format.wordCount}u;
const EM_QUANTUM: i32 = ${format.quantumExponent}i;
struct ExactMass { words: array<u32, ${format.wordCount}> }
struct ExactMassResult { value: ExactMass, error: u32 }
struct ExactMassProjection { bits: u32, error: u32 }
struct ExactMassTransfer { donor: ExactMass, receiver: ExactMass, error: u32 }

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
  if (carry != 0u) { return ExactMassResult(a, ${ERROR.OVERFLOW}u); }
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
  if (borrow != 0u) { return ExactMassResult(a, ${ERROR.UNDERFLOW}u); }
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
    return ExactMassProjection(rounded, select(0u, ${ERROR.PROJECTION_UNDERFLOW}u, rounded == 0u));
  }
  var significand = em_rounded_shift(a, top - 23);
  if (significand == 0x01000000u) { significand >>= 1u; order++; }
  if (order > 127) { return ExactMassProjection(0u, ${ERROR.PROJECTION_OVERFLOW}u); }
  return ExactMassProjection((u32(order + 127) << 23u) | (significand - 0x00800000u), 0u);
}
fn em_from_f32_bits(bits: u32) -> ExactMassResult {
  var result: ExactMass;
  if ((bits & 0x80000000u) != 0u || bits >= 0x7f800000u) {
    return ExactMassResult(result, ${ERROR.INVALID_FLOAT}u);
  }
  let encoded = (bits >> 23u) & 255u;
  var coefficient = bits & 0x007fffffu;
  var exponent = -149i;
  if (encoded != 0u) { coefficient |= 0x00800000u; exponent = i32(encoded) - 150; }
  let shift = exponent - EM_QUANTUM;
  for (var i = 0i; i < 24; i++) {
    if ((coefficient & (1u << u32(i))) == 0u) { continue; }
    let bit = i + shift;
    if (bit < 0) { return ExactMassResult(ExactMass(), ${ERROR.INEXACT_INPUT}u); }
    if (bit >= i32(EM_WORDS * 32u)) { return ExactMassResult(ExactMass(), ${ERROR.OVERFLOW}u); }
    result.words[u32(bit) / 32u] |= 1u << (u32(bit) % 32u);
  }
  return ExactMassResult(result, 0u);
}
`;
}
