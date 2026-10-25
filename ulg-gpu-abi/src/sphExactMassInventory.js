// Cold-input codecs and explicit diagnostic projections. These functions never
// advance resident state. GPU inventory is an unsigned integer times 2^q kg;
// the immutable run format is part of its identity, not a material parameter.
export const SPH_EXACT_MASS_SCHEMA = 'peercompute.ulg.exact-mass-inventory.v1';
export const SPH_EXACT_MASS_MAX_WORDS = 66;
export const SPH_EXACT_MASS_ERROR = Object.freeze({
  NONE: 0, OVERFLOW: 1, UNDERFLOW: 2, INVALID_FLOAT: 4,
  INEXACT_INPUT: 8, PROJECTION_OVERFLOW: 16, PROJECTION_UNDERFLOW: 32
});

const formats = new WeakSet();
const f64 = new DataView(new ArrayBuffer(8));
const uintMask = 0xffffffffn;

export function createSphExactMassFormat({ wordCount = 9, quantumExponent = -149 } = {}) {
  if (!Number.isInteger(wordCount) || wordCount < 1 || wordCount > SPH_EXACT_MASS_MAX_WORDS
      || !Number.isInteger(quantumExponent) || quantumExponent < -1074 || quantumExponent > 1023) {
    throw new RangeError('Exact mass requires 1..66 words and a binary quantum exponent in -1074..1023');
  }
  const format = Object.freeze({ schema: SPH_EXACT_MASS_SCHEMA, wordCount, quantumExponent,
    byteStride: wordCount * 4 });
  formats.add(format);
  return format;
}

export function validateSphExactMassFormat(format) {
  if (!formats.has(format)) throw new TypeError('Original immutable exact-mass format required');
  return format;
}

function unsignedDyadic(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || Object.is(value, -0)) {
    throw new RangeError('Mass must be a finite nonnegative binary64 value, excluding negative zero');
  }
  f64.setFloat64(0, value, false);
  const bits = f64.getBigUint64(0, false), encoded = Number((bits >> 52n) & 2047n);
  return { coefficient: (bits & ((1n << 52n) - 1n)) | (encoded ? 1n << 52n : 0n),
    exponent: encoded ? encoded - 1075 : -1074 };
}

export function encodeSphExactMass(value, format) {
  validateSphExactMassFormat(format);
  const source = unsignedDyadic(value);
  const shift = source.exponent - format.quantumExponent;
  let coefficient = source.coefficient;
  if (shift < 0) {
    const count = BigInt(-shift);
    if (coefficient & ((1n << count) - 1n)) {
      throw new RangeError('Mass is not exact in the selected binary quantum; choose a finer run format');
    }
    coefficient >>= count;
  } else coefficient <<= BigInt(shift);
  return encodeSphExactMassUnits(coefficient, format);
}

export function encodeSphExactMassUnits(coefficient, format) {
  validateSphExactMassFormat(format);
  if (typeof coefficient !== 'bigint' || coefficient < 0n
      || coefficient >= (1n << BigInt(format.wordCount * 32))) {
    throw new RangeError('Exact mass units exceed the unsigned inventory format');
  }
  const words = new Uint32Array(format.wordCount);
  for (let i = 0; i < words.length; i++) {
    words[i] = Number(coefficient & uintMask); coefficient >>= 32n;
  }
  return words;
}

export function decodeSphExactMass(words, format) {
  validateSphExactMassFormat(format);
  if (!(words instanceof Uint32Array) || words.length !== format.wordCount
      || !(words.buffer instanceof ArrayBuffer)) {
    throw new TypeError('One complete non-shared exact-mass word record required');
  }
  let coefficient = 0n;
  for (let i = words.length - 1; i >= 0; i--) coefficient = (coefficient << 32n) | BigInt(words[i]);
  return Object.freeze({ coefficient, exponent: format.quantumExponent });
}

function roundShift(coefficient, shift) {
  if (shift <= 0) return coefficient << BigInt(-shift);
  const count = BigInt(shift), high = coefficient >> count;
  const remainder = coefficient - (high << count), half = 1n << (count - 1n);
  return high + BigInt(remainder > half || (remainder === half && (high & 1n) !== 0n));
}

// Returns bits rather than a floating value: WGSL may flush even a bitcast's
// subnormal result. Projection is never the continuing inventory or a test for
// exact activity/depletion. Rounding occurs once, nearest with ties to even.
export function projectSphExactMassF32Bits(words, format) {
  const { coefficient, exponent } = decodeSphExactMass(words, format);
  if (coefficient === 0n) return Object.freeze({ bits: 0, error: 0 });
  const top = coefficient.toString(2).length - 1;
  let order = top + exponent;
  if (order < -126) {
    const rounded = roundShift(coefficient, -149 - exponent);
    return Object.freeze({ bits: Number(rounded),
      error: rounded === 0n ? SPH_EXACT_MASS_ERROR.PROJECTION_UNDERFLOW : 0 });
  }
  let significand = roundShift(coefficient, top - 23);
  if (significand === 1n << 24n) { significand >>= 1n; order++; }
  if (order > 127) return Object.freeze({ bits: 0, error: SPH_EXACT_MASS_ERROR.PROJECTION_OVERFLOW });
  return Object.freeze({ bits: (order + 127) * 0x800000 + Number(significand - (1n << 23n)), error: 0 });
}
