// Independent mathematical packet oracle. BigInt division supplies quotient
// and remainder directly; no production limb helpers or GPU instruction DAG.
export function referenceDyadic53Packet({ n, d, e }) {
  if (d <= 0n) throw new Error('Positive packet denominator required');
  if (n === 0n) return { n: 0n, d: 1n, e: 0 };
  const negative = n < 0n;
  if (negative) n = -n;
  let order = n.toString(2).length - d.toString(2).length;
  if (order >= 0 ? n < (d << BigInt(order)) : (n << BigInt(-order)) < d) order--;
  const shift = order - 52;
  const numerator = shift < 0 ? n << BigInt(-shift) : n;
  const denominator = shift > 0 ? d << BigInt(shift) : d;
  let coefficient = numerator / denominator;
  const remainder = numerator % denominator;
  if (2n * remainder > denominator || (2n * remainder === denominator && (coefficient & 1n))) coefficient++;
  e += shift;
  while (!(coefficient & 1n)) { coefficient >>= 1n; e++; }
  return { n: negative ? -coefficient : coefficient, d: 1n, e };
}

// Relative error <= 2^-53, checked with integer cross-products. Exponent
// differences remain small even for values outside the binary64 range.
export function dyadic53PacketWithinBound(source, packet) {
  const exponent = Math.min(source.e, packet.e);
  const left = (source.n << BigInt(source.e - exponent)) * packet.d;
  const right = (packet.n << BigInt(packet.e - exponent)) * source.d;
  const abs = n => n < 0n ? -n : n;
  return (abs(left - right) << 53n) <= abs(left);
}
