// Signed companion of the exact-mass inventory. It reads the same immutable
// run format (W u32 words, quantum 2^q) as a two's-complement integer, so an
// extensive energy U = m*u is stored as an exact count of 2^q J quanta. Like
// the mass codecs, these are cold-input codecs and diagnostic projections;
// they never advance resident state.
import {
  validateSphExactMassFormat, encodeSphExactMassUnits, projectSphExactMassF32Bits,
  SPH_EXACT_MASS_ERROR
} from './sphExactMassInventory.js';

export const SPH_EXACT_SIGNED_LEDGER_SCHEMA = 'peercompute.ulg.exact-signed-ledger.v1';

const uintMask = 0xffffffffn;
const f64 = new DataView(new ArrayBuffer(8));

function signedBounds(format) {
  const bits = BigInt(format.wordCount * 32);
  return { modulus: 1n << bits, min: -(1n << (bits - 1n)), max: (1n << (bits - 1n)) - 1n };
}

export function encodeSphExactSignedUnits(value, format) {
  validateSphExactMassFormat(format);
  const { modulus, min, max } = signedBounds(format);
  if (typeof value !== 'bigint' || value < min || value > max) {
    throw new RangeError("Signed ledger units exceed the two's-complement run format");
  }
  let unsigned = value < 0n ? value + modulus : value;
  const words = new Uint32Array(format.wordCount);
  for (let i = 0; i < words.length; i++) {
    words[i] = Number(unsigned & uintMask); unsigned >>= 32n;
  }
  return words;
}

export function decodeSphExactSignedUnits(words, format) {
  validateSphExactMassFormat(format);
  if (!(words instanceof Uint32Array) || words.length !== format.wordCount) {
    throw new TypeError('One complete signed ledger word record required');
  }
  let value = 0n;
  for (let i = words.length - 1; i >= 0; i--) value = (value << 32n) | BigInt(words[i]);
  const { modulus, max } = signedBounds(format);
  return value > max ? value - modulus : value;
}

// Exact units of a finite binary64 value. Throws rather than rounding when the
// value is finer than the run quantum.
export function encodeSphExactSigned(value, format) {
  validateSphExactMassFormat(format);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError('Signed ledger value must be a finite binary64 value');
  }
  f64.setFloat64(0, value, false);
  const bits = f64.getBigUint64(0, false), encoded = Number((bits >> 52n) & 2047n);
  let coefficient = (bits & ((1n << 52n) - 1n)) | (encoded ? 1n << 52n : 0n);
  const shift = (encoded ? encoded - 1075 : -1074) - format.quantumExponent;
  if (shift < 0) {
    const count = BigInt(-shift);
    if (coefficient & ((1n << count) - 1n)) {
      throw new RangeError('Value is not exact in the selected binary quantum; choose a finer run format');
    }
    coefficient >>= count;
  } else coefficient <<= BigInt(shift);
  return encodeSphExactSignedUnits(bits >> 63n ? -coefficient : coefficient, format);
}

// Exact units of one f32 bit pattern: every finite f32 is an integer multiple
// of 2^-149, so in the -149 format this never rounds. Used to form expected
// totals of f32 packets on the host.
export function sphExactUnitsFromF32Bits(bits, format) {
  validateSphExactMassFormat(format);
  const pattern = bits >>> 0, encoded = (pattern >>> 23) & 255;
  if (encoded === 255) throw new RangeError('Packet must be a finite f32');
  let coefficient = BigInt(pattern & 0x7fffff);
  let exponent = -149;
  if (encoded) { coefficient |= 1n << 23n; exponent = encoded - 150; }
  const shift = exponent - format.quantumExponent;
  if (shift < 0) {
    const count = BigInt(-shift);
    if (coefficient & ((1n << count) - 1n)) throw new RangeError('Packet is finer than the run quantum');
    coefficient >>= count;
  } else coefficient <<= BigInt(shift);
  return pattern >>> 31 ? -coefficient : coefficient;
}

// Nearest-even f32 bits of a signed ledger value. Projection is a view for the
// f32 solver, never the continuing inventory.
export function projectSphExactSignedF32Bits(words, format) {
  const value = decodeSphExactSignedUnits(words, format);
  const { max } = signedBounds(format);
  if (value >= 0n) return projectSphExactMassF32Bits(encodeSphExactMassUnits(value, format), format);
  if (-value > max) return Object.freeze({ bits: 0, error: SPH_EXACT_MASS_ERROR.PROJECTION_OVERFLOW });
  const magnitude = projectSphExactMassF32Bits(encodeSphExactMassUnits(-value, format), format);
  if (magnitude.error || magnitude.bits === 0) return magnitude;
  return Object.freeze({ bits: (magnitude.bits | 0x80000000) >>> 0, error: 0 });
}
