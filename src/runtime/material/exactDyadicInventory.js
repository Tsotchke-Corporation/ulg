// Exact extensive bookkeeping for CPU numerical REFERENCES, not a GPU ABI or
// a hot-state fallback. A rounded constitutive projection never replaces this
// inventory. One accepted binary64 packet has the SAME exact debit and credit.
const bits = new DataView(new ArrayBuffer(8));

function normalize(coefficient, exponent) {
  if (coefficient === 0n) return Object.freeze({ coefficient: 0n, exponent: 0 });
  while ((coefficient & 1n) === 0n) { coefficient >>= 1n; exponent += 1; }
  return Object.freeze({ coefficient, exponent });
}

export function dyadicFromNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('A finite binary64 inventory/packet is required');
  }
  bits.setFloat64(0, value, false);
  const word = bits.getBigUint64(0, false);
  const encodedExponent = Number((word >> 52n) & 2047n);
  let coefficient = word & ((1n << 52n) - 1n);
  if (encodedExponent !== 0) coefficient += 1n << 52n;
  if ((word >> 63n) !== 0n) coefficient = -coefficient;
  return normalize(coefficient, encodedExponent === 0 ? -1074 : encodedExponent - 1075);
}

export function dyadicNegate(value) {
  return Object.freeze({ coefficient: -value.coefficient, exponent: value.exponent });
}

export function dyadicAdd(a, b) {
  const exponent = Math.min(a.exponent, b.exponent);
  return normalize((a.coefficient << BigInt(a.exponent - exponent))
    + (b.coefficient << BigInt(b.exponent - exponent)), exponent);
}

export function dyadicMultiply(a, b) {
  return normalize(a.coefficient * b.coefficient, a.exponent + b.exponent);
}

export function dyadicEqual(a, b) {
  return dyadicAdd(a, dyadicNegate(b)).coefficient === 0n;
}

// Correctly round an exact rational times a power of two, including subnormal
// outputs and ties-to-even. Dividing two rounded totals can lose a small energy
// difference or overflow even when their ratio is ordinary and representable.
function roundedRatio(numerator, denominator, exponent) {
  if (denominator === 0n) throw new RangeError('Zero inventory divisor');
  if (numerator === 0n) return 0;
  const negative = (numerator < 0n) !== (denominator < 0n);
  let n = numerator < 0n ? -numerator : numerator;
  let d = denominator < 0n ? -denominator : denominator;
  let order = n.toString(2).length - d.toString(2).length;
  if (order >= 0 ? n < (d << BigInt(order)) : (n << BigInt(-order)) < d) order -= 1;
  const quantum = Math.max(-1074, exponent + order - 52);
  const shift = exponent - quantum;
  if (shift >= 0) n <<= BigInt(shift);
  else d <<= BigInt(-shift);
  let rounded = n / d;
  const twiceRemainder = 2n * (n % d);
  if (twiceRemainder > d || (twiceRemainder === d && (rounded & 1n) !== 0n)) rounded += 1n;
  const result = Number(rounded) * 2 ** quantum;
  if (!Number.isFinite(result)) throw new RangeError('Inventory projection overflows binary64');
  return negative ? -result : result;
}

export function dyadicToNumber(value) {
  return roundedRatio(value.coefficient, 1n, value.exponent);
}

export function dyadicRatio(a, b) {
  return roundedRatio(a.coefficient, b.coefficient, a.exponent - b.exponent);
}
