import { encodeSphExactMass, decodeSphExactMass } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { sphExactPlacementQuantityLayout } from './sphExactPlacementQuantityWgsl.js';

// Cold numeric codec only. Its caller binds the original SPH and MLS uploads;
// these bytes do not confer a continuing inventory or publication capability.
const bitsOf = array => new Uint32Array(array.buffer, array.byteOffset, array.length);
function dyadic(n, e = 0) {
  if (n === 0n) return { n, e: 0 };
  while ((n & 1n) === 0n) { n >>= 1n; e++; }
  return { n, e };
}
function fromBits(bits) {
  const encoded = (bits >>> 23) & 255;
  if (encoded === 255) throw new RangeError('Nonfinite initial particle quantity');
  const n = BigInt((bits & 0x7fffff) | (encoded ? 0x800000 : 0));
  return dyadic(bits >>> 31 ? -n : n, encoded ? encoded - 150 : -149);
}
const multiply = (a, b) => dyadic(a.n * b.n, a.e + b.e);
function add(a, b) {
  const e = Math.min(a.e, b.e);
  return dyadic((a.n << BigInt(a.e - e)) + (b.n << BigInt(b.e - e)), e);
}
function store(words, at, scalar, value) {
  if (!Number.isInteger(value.e) || value.e < -2147483648 || value.e > 2147483647) {
    throw new RangeError('Initial particle quantity exponent overflow');
  }
  let n = value.n < 0n ? -value.n : value.n;
  words[at] = Number(value.n < 0n); words[at + 2] = value.e >>> 0;
  words[at + 4 + scalar.wordCount] = 1;
  for (let i = 0; i < scalar.wordCount; i++, n >>= 32n) words[at + 4 + i] = Number(n & 0xffffffffn);
  if (n) throw new RangeError('Initial particle quantity capacity exceeded');
}

/** Use declared exact mass and the original packed binary32 initial values.
 * This records the existing thermal plus translational kinetic energy plane;
 * it does not reset or replace F, C or J. Chemical conversion still applies
 * its separate relaxed-mechanics admission before spending these quantities.
 * Missing material identity has no supported cold seed here.
 */
export function encodeSphExactParticleInitialQuantities(seed, mechanics) {
  const { format, packed, massesKg, massWords } = seed, count = packed.particleCount;
  if (!(mechanics instanceof Float32Array) || mechanics.length !== count * 32) {
    throw new TypeError('Complete original cold mechanics rows required');
  }
  const state = bitsOf(packed.state), mls = bitsOf(mechanics);
  const masses = Array.from({ length: count }, (_, row) => massWords
    ? massWords.slice(row * format.wordCount, (row + 1) * format.wordCount)
    : encodeSphExactMass(massesKg[row], format));
  for (let row = 0; row < count; row++) {
    if (!masses[row].some(Boolean)) continue;
    const metadata = packed.metadata[row], m = row * 32;
    if (!metadata?.initialPhaseReferenceMatchesMass
        || !(metadata.molarMassBits >= 0x00800000 && metadata.molarMassBits < 0x7f800000)
        || !(mls[m + 19] > 0 && mls[m + 19] < 0x7f800000)
        || !(mls[m + 18] > 0 && mls[m + 18] < 0x7f800000)
        || mls[m + 31] !== state[row * 8 + 3]
        || !mechanics.subarray(m, m + 20).every(Number.isFinite)) return null;
  }
  const base = sphExactPlacementQuantityLayout(format, { particleCount: count, eventCapacity: 1 });
  const layout = Object.freeze({ ...base, rowCount: count, wordLength: count * base.recordWords });
  const words = new Uint32Array(layout.wordLength);
  for (let row = 0; row < count; row++) {
    const at = row * layout.recordWords, active = masses[row].some(Boolean);
    words.set([1, 0, packed.thermo[row * 12], packed.thermo[row * 12 + 1],
      packed.metadata[row].molarMassBits ?? 0, 1, row, 0xffffffff, 0xffffffff,
      format.wordCount, layout.scalar.wordCount, Number(active)], at);
    words.set(masses[row], at + layout.massOffsetWords);
    let values = Array(7).fill(dyadic(0n));
    if (active) {
      const { coefficient, exponent } = decodeSphExactMass(masses[row], format);
      const mass = dyadic(coefficient, exponent), velocity = [4, 5, 6].map(i => fromBits(state[row * 8 + i]));
      const specific = velocity.reduce((u, v) => add(u, multiply(multiply(v, v), dyadic(1n, -1))),
        fromBits(state[row * 8 + 7]));
      const rest = fromBits(mls[row * 32 + 19]);
      values = [...velocity.map(v => multiply(mass, v)), multiply(mass, specific),
        rest, multiply(rest, fromBits(mls[row * 32 + 18])), mass];
    }
    values.forEach((value, field) => store(words,
      at + layout.scalarOffsetWords + field * layout.scalar.recordWords, layout.scalar, value));
  }
  return Object.freeze({ words, layout, format });
}
