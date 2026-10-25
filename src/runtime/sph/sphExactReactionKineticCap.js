import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as ERROR }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { resolveSphExactReactionAllocation } from './sphExactReactionAllocation.js';

// Numeric metadata only. The caller must authenticate the current source,
// proposal, time interval and kinetic law; none are authorized by this codec.
// Four header words, then N+4 little-endian coefficient words. The coefficient
// is (WA+WB)*scale.coefficient; header[0] is scale.exponent-quantumExponent as
// signed i32 bits. Header[1] is its significant word count; [2:4] are zero.
export function encodeSphExactReactionKineticScale(compiled) {
  resolveSphExactReactionAllocation(compiled);
  const { format, reactantWeightSum, reactantWeightScale: scale } = compiled;
  let coefficient = reactantWeightSum * scale.coefficient;
  const result = new Uint32Array(format.wordCount + 8);
  result[0] = scale.exponent - format.quantumExponent;
  for (let i = 4; coefficient !== 0n; i++) {
    if (i >= result.length) throw new RangeError('Exact kinetic scale exceeds its declared width');
    result[i] = Number(coefficient & 0xffffffffn);
    coefficient >>= 32n;
    result[1]++;
  }
  return result;
}

/** Independent BigInt reference: floor the selected finite f32 extent times
 * the ORIGINAL binary64 stoichiometric mass scale once, then cap by inventory.
 * This does not calculate geometry, flux or chemical/physical admissibility. */
export function selectSphExactReactionKineticCap(compiled, extentBits, available) {
  resolveSphExactReactionAllocation(compiled);
  if (!Number.isInteger(extentBits) || extentBits < 0 || extentBits > 0xffffffff
      || (extentBits & 0x80000000) !== 0 || extentBits >= 0x7f800000) {
    throw new RangeError('Kinetic extent must encode a finite nonnegative f32, excluding negative zero');
  }
  if (typeof available !== 'bigint' || available < 0n
      || available >= (1n << BigInt(compiled.format.wordCount * 32))) {
    throw new RangeError('Available mass is outside inventory width');
  }
  const encoded = (extentBits >>> 23) & 255;
  const significand = BigInt((extentBits & 0x7fffff) | (encoded ? 0x800000 : 0));
  const exponent = encoded ? encoded - 150 : -149;
  const scale = compiled.reactantWeightScale;
  const product = significand * compiled.reactantWeightSum * scale.coefficient;
  const shift = exponent + scale.exponent - compiled.format.quantumExponent;
  const cap = shift >= 0 ? product << BigInt(shift) : product >> BigInt(-shift);
  return cap < available ? cap : available;
}

/** Binding-free helper. Caller supplies the original mass helpers and
 * ek_scale_word(index: u32) -> u32 over a validated full scale record. */
export function createSphExactReactionKineticCapWgsl(format) {
  validateSphExactMassFormat(format);
  const coefficientWords = format.wordCount + 4;
  const halfWords = (format.wordCount + 5) * 2;
  return /* wgsl */ `
// N inventory words + 106 scale bits + 24 extent bits fit N+5 product words.
// Base-2^16 partial products, existing digit and carry sum to at most 2^32-1.
fn ek_cap_from_extent(extent_bits: u32, scale_offset: u32,
  available: ExactMass) -> ExactMassResult {
  if ((extent_bits & 0x80000000u) != 0u || extent_bits >= 0x7f800000u) {
    return ExactMassResult(ExactMass(), ${ERROR.INVALID_FLOAT}u);
  }
  let scale_exponent = bitcast<i32>(ek_scale_word(scale_offset));
  let coefficient_words = ek_scale_word(scale_offset + 1u);
  if (coefficient_words == 0u || coefficient_words > ${coefficientWords}u
      || scale_exponent < ${-2148 - format.quantumExponent}i
      || scale_exponent > ${2046 - format.quantumExponent}i
      || ek_scale_word(scale_offset + 2u) != 0u
      || ek_scale_word(scale_offset + 3u) != 0u) {
    return ExactMassResult(ExactMass(), ${ERROR.INVALID_RATIO}u);
  }
  // Do not let a short count silently hide a nonzero high coefficient word.
  for (var i = 0u; i < ${coefficientWords}u; i++) {
    let word = ek_scale_word(scale_offset + 4u + i);
    if ((i + 1u == coefficient_words && word == 0u)
        || (i >= coefficient_words && word != 0u)) {
      return ExactMassResult(ExactMass(), ${ERROR.INVALID_RATIO}u);
    }
  }
  let encoded = (extent_bits >> 23u) & 255u;
  var significand = extent_bits & 0x007fffffu;
  var exponent = -149i;
  if (encoded != 0u) {
    significand |= 0x00800000u;
    exponent = i32(encoded) - 150;
  }
  if (significand == 0u || em_zero(available)) {
    return ExactMassResult(ExactMass(), 0u);
  }
  var product: array<u32, ${halfWords}>;
  for (var i = 0u; i < coefficient_words * 2u; i++) {
    let word = ek_scale_word(scale_offset + 4u + i / 2u);
    let digit = (word >> ((i % 2u) * 16u)) & 65535u;
    var carry = 0u;
    for (var j = 0u; j < 2u; j++) {
      let term = (significand >> (j * 16u)) & 65535u;
      let sum = product[i + j] + digit * term + carry;
      product[i + j] = sum & 65535u;
      carry = sum >> 16u;
    }
    product[i + 2u] = carry;
  }
  var top = -1i;
  for (var i = ${halfWords - 1}i; i >= 0; i--) {
    let digit = product[u32(i)];
    if (digit != 0u) { top = i * 16 + 31 - i32(countLeadingZeros(digit)); break; }
  }
  let shift = scale_exponent + exponent;
  let shifted_top = top + shift;
  if (shifted_top < 0) { return ExactMassResult(ExactMass(), 0u); }
  // Compare the shifted bit length BEFORE narrowing. Large caps saturate at
  // exact availability, never overflow or become a synthetic 'no cap'.
  if (shifted_top > em_top(available)) { return ExactMassResult(available, 0u); }
  var result: ExactMass;
  for (var bit = 0i; bit <= shifted_top; bit++) {
    let source_bit = bit - shift;
    if (source_bit >= 0 && source_bit < ${halfWords * 16}i) {
      let selected = (product[u32(source_bit) / 16u] >> (u32(source_bit) % 16u)) & 1u;
      result.words[u32(bit) / 32u] |= selected << (u32(bit) % 32u);
    }
  }
  if (em_compare(result, available) > 0) { return ExactMassResult(available, 0u); }
  return ExactMassResult(result, 0u);
}
`;
}
