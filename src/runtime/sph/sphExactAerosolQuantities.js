import { validateSphExactMassFormat, encodeSphExactMass, decodeSphExactMass,
  projectSphExactMassF32Bits } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { sphExactRationalQuantityLayout } from './sphExactRationalQuantityWgsl.js';

// Cold initial-condition codec only. The original aerosol family owns the GPU
// quantities and their numerical parcel view together. This module issues no
// source, inventory, count or publication capability.
export function sphExactAerosolQuantityLayout(format, capacity) {
  validateSphExactMassFormat(format);
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 0xffffff) {
    throw new RangeError('Exact aerosol capacity must be positive and bounded');
  }
  const scalar = sphExactRationalQuantityLayout({ wordCount: 4 * format.wordCount + 27 });
  const scalarOffsetWords = 16 + format.wordCount;
  const recordWords = scalarOffsetWords + 7 * scalar.recordWords;
  if (capacity * recordWords > 0x3fffffff) throw new RangeError('Exact aerosol quantity addressing overflow');
  return Object.freeze({ version: 1, rowCount: capacity, recordWords, headerWords: 16,
    massOffsetWords: 16, massWordCount: format.wordCount, scalarOffsetWords, scalar,
    fields: Object.freeze(['momentumX', 'momentumY', 'momentumZ', 'totalEnergy',
      'restVolume', 'currentVolume', 'phaseReferenceMass']), byteLength: capacity * recordWords * 4 });
}

function gcd(a, b) { while (b) { const next = a % b; a = b; b = next; } return a; }
function rational(n, d = 1n, e = 0) {
  if (d <= 0n) throw new RangeError('Exact initial aerosol divisor must be positive');
  if (!n) return { n: 0n, d: 1n, e: 0 };
  const common = gcd(n < 0n ? -n : n, d); n /= common; d /= common;
  while ((n & 1n) === 0n) { n >>= 1n; e++; }
  while ((d & 1n) === 0n) { d >>= 1n; e--; }
  return { n, d, e };
}
function fromBits(bits) {
  const exponent = (bits >>> 23) & 255;
  if (exponent === 255) throw new RangeError('Nonfinite initial aerosol quantity');
  const n = BigInt((bits & 0x7fffff) | (exponent ? 0x800000 : 0));
  return rational(bits >>> 31 ? -n : n, 1n, exponent ? exponent - 150 : -149);
}
const multiply = (a, b) => rational(a.n * b.n, a.d * b.d, a.e + b.e);
const divide = (a, b) => rational(a.n * b.d, a.d * b.n, a.e - b.e);
function add(a, b) {
  const e = Math.min(a.e, b.e);
  return rational((a.n << BigInt(a.e - e)) * b.d + (b.n << BigInt(b.e - e)) * a.d, a.d * b.d, e);
}
function storeScalar(words, at, scalar, value) {
  let n = value.n < 0n ? -value.n : value.n, d = value.d;
  words[at] = Number(value.n < 0n); words[at + 2] = value.e >>> 0;
  for (let i = 0; i < scalar.wordCount; i++) {
    words[at + 4 + i] = Number(n & 0xffffffffn);
    words[at + 4 + scalar.wordCount + i] = Number(d & 0xffffffffn);
    n >>= 32n; d >>= 32n;
  }
  if (n || d) throw new RangeError('Exact initial aerosol quantity capacity exceeded');
}

/** massesKg were captured from explicit cold inputs before f32 packing.
 * All other values use the original packed physical initial conditions. */
export function encodeSphExactAerosolInitialQuantities({ format, capacity, massesKg, parcelWords }) {
  const layout = sphExactAerosolQuantityLayout(format, capacity);
  if (!Array.isArray(massesKg) || massesKg.length !== capacity
      || !(parcelWords instanceof Uint32Array) || parcelWords.length !== capacity * 24) {
    throw new TypeError('Complete original cold aerosol rows required');
  }
  const words = new Uint32Array(layout.byteLength / 4);
  for (let row = 0; row < capacity; row++) {
    const massWords = encodeSphExactMass(massesKg[row], format);
    const { coefficient, exponent } = decodeSphExactMass(massWords, format);
    const p = row * 24, at = row * layout.recordWords;
    if (!coefficient) {
      if (parcelWords.slice(p, p + 24).some(Boolean)) throw new TypeError('Empty exact aerosol slot must be empty physically');
      continue;
    }
    const projection = projectSphExactMassF32Bits(massWords, format);
    if (projection.error || projection.bits < 0x00800000 || projection.bits !== parcelWords[p + 3]
        || parcelWords[p + 22] !== 1 || ![1, 2].includes(parcelWords[p + 13])) {
      throw new RangeError('Exact aerosol mass requires its original normal-f32 physical projection');
    }
    // Header: ready,error,material,phase,densityBits,sourceKind,sourceRow,
    // sourceEpoch,version,massWords,rationalWords,active,reserved[4].
    words.set([1, 0, parcelWords[p + 12], parcelWords[p + 13], parcelWords[p + 9],
      parcelWords[p + 23], parcelWords[p + 18], parcelWords[p + 19], 1,
      format.wordCount, layout.scalar.wordCount, 1], at);
    words.set(massWords, at + layout.massOffsetWords);
    const mass = rational(coefficient, 1n, exponent);
    const velocity = [4, 5, 6].map(i => fromBits(parcelWords[p + i]));
    const specific = velocity.reduce((u, v) => add(u, multiply(multiply(v, v), rational(1n, 1n, -1))),
      fromBits(parcelWords[p + 7]));
    const volume = divide(mass, fromBits(parcelWords[p + 9]));
    const values = [...velocity.map(v => multiply(mass, v)), multiply(mass, specific), volume, volume, mass];
    values.forEach((v, field) => storeScalar(words, at + layout.scalarOffsetWords + field * layout.scalar.recordWords, layout.scalar, v));
  }
  return { words, layout, format };
}
