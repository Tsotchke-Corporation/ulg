import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as ERROR }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';

// Signed ledger arithmetic on the exact-mass run format: the same W words read
// as a two's-complement count of 2^q quanta (energy U = m*u, sources). Append
// it after createSphExactMassWgsl(format) in the same module. Every operation
// is a fixed W-word loop: no GCD, no wide multiply, no large private arrays.
export function createSphExactLedgerWgsl(format) {
  validateSphExactMassFormat(format);
  return /* wgsl */ `
fn el_negative(a: ExactMass) -> bool { return (a.words[EM_WORDS - 1u] & 0x80000000u) != 0u; }
fn el_negate(a: ExactMass) -> ExactMass {
  var result: ExactMass; var carry = 1u;
  for (var i = 0u; i < EM_WORDS; i++) {
    let inverted = ~a.words[i]; let sum = inverted + carry;
    carry = select(0u, 1u, sum < inverted);
    result.words[i] = sum;
  }
  return result;
}
// Magnitude of a signed value. The minimum value has no magnitude in range and
// returns OVERFLOW.
fn el_magnitude(a: ExactMass) -> ExactMassResult {
  if (!el_negative(a)) { return ExactMassResult(a, 0u); }
  let magnitude = el_negate(a);
  if (el_negative(magnitude)) { return ExactMassResult(a, ${ERROR.OVERFLOW}u); }
  return ExactMassResult(magnitude, 0u);
}
fn el_add(a: ExactMass, b: ExactMass) -> ExactMassResult {
  var result: ExactMass; var carry = 0u;
  for (var i = 0u; i < EM_WORDS; i++) {
    let first = a.words[i] + b.words[i];
    let second = first + carry;
    carry = select(0u, 1u, first < a.words[i] || second < first);
    result.words[i] = second;
  }
  if (el_negative(a) == el_negative(b) && el_negative(result) != el_negative(a)) {
    return ExactMassResult(a, ${ERROR.OVERFLOW}u);
  }
  return ExactMassResult(result, 0u);
}
fn el_subtract(a: ExactMass, b: ExactMass) -> ExactMassResult {
  var result: ExactMass; var borrow = 0u;
  for (var i = 0u; i < EM_WORDS; i++) {
    let first = a.words[i] - b.words[i];
    let second = first - borrow;
    borrow = select(0u, 1u, a.words[i] < b.words[i] || first < borrow);
    result.words[i] = second;
  }
  if (el_negative(a) != el_negative(b) && el_negative(result) != el_negative(a)) {
    return ExactMassResult(a, ${ERROR.OVERFLOW}u);
  }
  return ExactMassResult(result, 0u);
}
fn el_compare(a: ExactMass, b: ExactMass) -> i32 {
  let top_a = bitcast<i32>(a.words[EM_WORDS - 1u]);
  let top_b = bitcast<i32>(b.words[EM_WORDS - 1u]);
  if (top_a < top_b) { return -1; }
  if (top_a > top_b) { return 1; }
  for (var i = i32(EM_WORDS) - 2; i >= 0; i--) {
    if (a.words[u32(i)] < b.words[u32(i)]) { return -1; }
    if (a.words[u32(i)] > b.words[u32(i)]) { return 1; }
  }
  return 0;
}
// A finite f32 packet as exact signed quanta. The 24-bit coefficient lands in
// at most two adjacent words, so this is one W-word select loop. A packet that
// needs the sign bit, or is finer than the run quantum, is rejected rather
// than rounded.
fn el_from_f32_bits(bits: u32) -> ExactMassResult {
  let encoded = (bits >> 23u) & 255u;
  if (encoded == 255u) { return ExactMassResult(ExactMass(), ${ERROR.INVALID_FLOAT}u); }
  var coefficient = bits & 0x007fffffu; var exponent = -149i;
  if (encoded != 0u) { coefficient |= 0x00800000u; exponent = i32(encoded) - 150; }
  var shift = exponent - EM_QUANTUM;
  if (shift < 0) {
    let dropped = u32(-shift);
    let mask = select((1u << dropped) - 1u, 0xffffffffu, dropped >= 24u);
    if ((coefficient & mask) != 0u) { return ExactMassResult(ExactMass(), ${ERROR.INEXACT_INPUT}u); }
    coefficient = select(coefficient >> dropped, 0u, dropped >= 24u);
    shift = 0;
  }
  if (coefficient == 0u) { return ExactMassResult(ExactMass(), 0u); }
  let word = u32(shift) / 32u; let offset = u32(shift) % 32u;
  let low = coefficient << offset;
  let high = select(0u, coefficient >> (32u - offset), offset != 0u);
  let top = select(word, word + 1u, high != 0u);
  if (top >= EM_WORDS || (top == EM_WORDS - 1u && (select(low, high, high != 0u) & 0x80000000u) != 0u)) {
    return ExactMassResult(ExactMass(), ${ERROR.OVERFLOW}u);
  }
  var result: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) {
    result.words[i] = select(0u, low, i == word) | select(0u, high, i == word + 1u);
  }
  if ((bits & 0x80000000u) != 0u) { result = el_negate(result); }
  return ExactMassResult(result, 0u);
}
// Nearest-even f32 bits of a signed value: the view the f32 solver reads.
fn el_project_f32_bits(a: ExactMass) -> ExactMassProjection {
  let magnitude = el_magnitude(a);
  if (magnitude.error != 0u) { return ExactMassProjection(0u, ${ERROR.PROJECTION_OVERFLOW}u); }
  let projection = em_project_f32_bits(magnitude.value);
  if (!el_negative(a) || projection.error != 0u || projection.bits == 0u) { return projection; }
  return ExactMassProjection(projection.bits | 0x80000000u, 0u);
}
`;
}

// Order-independent accumulation for rows with several writers in one pass.
// A row's counters hold 16-bit chunk sums of contribution magnitudes, positive
// and negative halves separately: 2 * 2W atomic words per row starting at
// row * stride + offset. The counters may be storage or workgroup atomics.
// Integer addition commutes, so the drained total does not depend on atomic
// order. One counter absorbs 65,537 full chunks before it can wrap; the
// caller bounds contributions per row between drains. An f32 packet touches
// at most three chunks. A drain is one carry pass and clears the row.
export function createSphExactLedgerScatterWgsl(format, {
  prefix, counters, stride = 4 * format.wordCount, offset = 0
}) {
  validateSphExactMassFormat(format);
  if (!/^[a-z][a-z0-9_]*$/.test(prefix) || !/^[a-z][a-z0-9_]*$/.test(counters)) {
    throw new TypeError('Scatter prefix and counter names must be WGSL identifiers');
  }
  if (!Number.isInteger(stride) || stride < 0 || !Number.isInteger(offset) || offset < 0) {
    throw new RangeError('Scatter stride and offset must be nonnegative integers');
  }
  const chunks = 2 * format.wordCount;
  return /* wgsl */ `
fn ${prefix}_base(row: u32, negative: bool) -> u32 {
  return row * ${stride}u + ${offset}u + select(0u, ${chunks}u, negative);
}
fn ${prefix}_add_chunk(base: u32, chunk: u32, digit: u32) -> u32 {
  if (digit == 0u) { return 0u; }
  if (chunk >= ${chunks}u) { return ${ERROR.OVERFLOW}u; }
  atomicAdd(&${counters}[base + chunk], digit);
  return 0u;
}
// Scatter one finite f32 packet as exact quanta: at most three atomic adds.
fn ${prefix}_scatter_f32(row: u32, bits: u32) -> u32 {
  let encoded = (bits >> 23u) & 255u;
  if (encoded == 255u) { return ${ERROR.INVALID_FLOAT}u; }
  var coefficient = bits & 0x007fffffu; var exponent = -149i;
  if (encoded != 0u) { coefficient |= 0x00800000u; exponent = i32(encoded) - 150; }
  if (coefficient == 0u) { return 0u; }
  let shift = exponent - EM_QUANTUM;
  if (shift < 0) { return ${ERROR.INEXACT_INPUT}u; }
  let chunk = u32(shift) / 16u; let offset = u32(shift) % 16u;
  let shifted = coefficient << offset;
  let base = ${prefix}_base(row, (bits & 0x80000000u) != 0u);
  var error = ${prefix}_add_chunk(base, chunk, shifted & 0xffffu);
  error |= ${prefix}_add_chunk(base, chunk + 1u, shifted >> 16u);
  error |= ${prefix}_add_chunk(base, chunk + 2u, select(0u, coefficient >> (32u - offset), offset != 0u));
  return error;
}
// Scatter a full-width signed value (a whole ledger moving, for example).
fn ${prefix}_scatter_value(row: u32, value: ExactMass) -> u32 {
  let magnitude = el_magnitude(value);
  if (magnitude.error != 0u) { return magnitude.error; }
  let base = ${prefix}_base(row, el_negative(value));
  for (var i = 0u; i < EM_WORDS; i++) {
    let word = magnitude.value.words[i];
    ${prefix}_add_chunk(base, 2u * i, word & 0xffffu);
    ${prefix}_add_chunk(base, 2u * i + 1u, word >> 16u);
  }
  return 0u;
}
// Add raw counters (already chunk sums) from another accumulator.
fn ${prefix}_add_counter(row: u32, index: u32, counter: u32) {
  if (counter != 0u) { atomicAdd(&${counters}[row * ${stride}u + ${offset}u + index], counter); }
}
fn ${prefix}_drain_half(base: u32) -> ExactMassResult {
  var result: ExactMass; var carry = 0u;
  for (var chunk = 0u; chunk < ${chunks}u; chunk++) {
    let counter = atomicExchange(&${counters}[base + chunk], 0u);
    let sum = counter + carry;
    let wrapped = select(0u, 1u, sum < counter);
    let digit = sum & 0xffffu;
    carry = (sum >> 16u) | (wrapped << 16u);
    if ((chunk & 1u) == 0u) { result.words[chunk / 2u] = digit; }
    else { result.words[chunk / 2u] |= digit << 16u; }
  }
  if (carry != 0u || el_negative(result)) { return ExactMassResult(result, ${ERROR.OVERFLOW}u); }
  return ExactMassResult(result, 0u);
}
// The row's signed total since the last drain; the counters are cleared.
fn ${prefix}_drain(row: u32) -> ExactMassResult {
  let positive = ${prefix}_drain_half(${prefix}_base(row, false));
  let negative = ${prefix}_drain_half(${prefix}_base(row, true));
  let error = positive.error | negative.error;
  if (error != 0u) { return ExactMassResult(ExactMass(), error); }
  return el_subtract(positive.value, negative.value);
}
`;
}
