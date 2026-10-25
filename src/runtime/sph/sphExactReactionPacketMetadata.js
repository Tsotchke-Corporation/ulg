import { resolveSphExactReactionAllocation } from './sphExactReactionAllocation.js';
import { sphReactionEnergyEntry } from './sphReactionEnergyAuthority.js';

export const SPH_EXACT_REACTION_PACKET_METADATA_MAGIC = 0x4552504d;
export const SPH_EXACT_REACTION_PACKET_METADATA_VERSION = 1;
export const SPH_EXACT_REACTION_PACKET_METADATA_HEADER_WORDS = 16;
export const SPH_EXACT_REACTION_PACKET_METADATA_HEADER = Object.freeze({
  MAGIC: 0, VERSION: 1, MASS_WORDS: 2, WIDE_WORDS: 3, TERM_COUNT: 4, ELEMENT_COUNT: 5,
  TERMS_OFFSET: 6, TERM_STRIDE: 7, ELEMENTS_OFFSET: 8, ELEMENT_STRIDE: 9,
  WEIGHTS_OFFSET: 10, WEIGHT_STRIDE: 11, DENOMINATOR_OFFSET: 12, AVOGADRO_OFFSET: 13,
  MOLE_EXPONENT: 14, RESIDUAL_EXPONENT: 15
});
// Exact SI definition, intentionally distinct from any legacy f32 projection.
export const SPH_EXACT_REACTION_AVOGADRO = 602214076000000000000000n;

const abs = value => value < 0n ? -value : value;
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const fail = message => { throw new TypeError(`Exact reaction packet metadata: ${message}`); };
const floatBits = value => new Uint32Array(new Float32Array([value]).buffer)[0];

function decodedFloat(value) {
  if (!Number.isFinite(value) || !Object.is(Math.fround(value), value)) fail('original finite f32 required');
  const bits = floatBits(value), encoded = (bits >>> 23) & 255;
  const coefficient = BigInt((bits & 0x7fffff) | (encoded ? 0x800000 : 0));
  return { bits, coefficient: bits >>> 31 ? -coefficient : coefficient,
    exponent: encoded ? encoded - 150 : -149 };
}

function molarDyadic(value) {
  if (!(value > 0)) fail('positive original molar mass required');
  const result = decodedFloat(value);
  while ((result.coefficient & 1n) === 0n) { result.coefficient >>= 1n; result.exponent++; }
  return result;
}

/** Cold numeric metadata only. Every offset is relative to this block, in u32
 * words. Terms are donor A/B then products. Element rows include Z=0 charge.
 * Moles = massUnits*weight/L * 2^(q-eMax); element/charge residuals use the
 * same denominator and exponent q-eMax-149. No per-pair tolerance is encoded.
 * The original allocation token and tables are resolved before and after
 * compilation; the returned numeric block cannot authenticate GPU owners. */
export function encodeSphExactReactionPacketMetadata(token, { reactionTable, thermalMaterialTable } = {}) {
  const expected = { reactionTable, thermalMaterialTable };
  resolveSphExactReactionAllocation(token, expected);
  const entry = sphReactionEnergyEntry(reactionTable, token.reactionIndex);
  if (!entry || entry.reactants.length !== 2 || entry.products.length !== token.products.length) {
    fail('original two-donor energy entry required');
  }
  const massWordCount = token.format.wordCount, wideWordCount = 3 * massWordCount + 26;
  const limit = 1n << BigInt(wideWordCount * 32), maximumMass = (1n << BigInt(massWordCount * 32)) - 1n;
  const bounded = (value, label) => {
    if (abs(value) >= limit) throw new RangeError(`Exact reaction packet ${label} exceeds checked arithmetic capacity`);
    return value;
  };
  const terms = [...entry.reactants, ...entry.products].map((term, index) => {
    const original = index < 2 ? token.reactants[index] : token.products[index - 2];
    if (term.termIndex !== original.termIndex || term.materialId !== original.materialId
        || !Object.is(term.molarMass, original.molarMass)) fail('changed original term identity');
    return { kind: index < 2 ? 1 : 2, termIndex: term.termIndex, materialId: term.materialId,
      coefficient: term.coefficient, molar: molarDyadic(term.molarMass), atoms: new Map(), charge: 0n, atomRows: 0 };
  });
  let commonDenominator = 1n, maximumMolarExponent = -149;
  for (const term of terms) {
    commonDenominator = bounded((commonDenominator / gcd(commonDenominator, term.molar.coefficient))
      * term.molar.coefficient, 'common molar denominator');
    maximumMolarExponent = Math.max(maximumMolarExponent, term.molar.exponent);
  }
  for (const term of terms) term.weight = bounded((commonDenominator / term.molar.coefficient)
    << BigInt(maximumMolarExponent - term.molar.exponent), 'molar weight');
  const termById = new Map(terms.map(term => [`${term.kind}:${term.termIndex}`, term]));
  const atomRows = reactionTable.atomTermRecords, elements = new Set([0]);
  for (let row = 0; row < reactionTable.atomTermCount; row++) {
    const at = row * 8;
    if (atomRows[at] !== token.reactionIndex) continue;
    const term = termById.get(`${atomRows[at + 1]}:${atomRows[at + 2]}`);
    const z = atomRows[at + 3], count = atomRows[at + 4], charge = atomRows[at + 6];
    if (!term || atomRows[at + 7] !== 1 || !Number.isInteger(z) || z < 1 || z > 118
        || !Number.isInteger(count) || !(count > 0) || !Number.isFinite(count)
        || atomRows[at + 5] !== term.coefficient) fail('invalid original atom row');
    term.atoms.set(z, (term.atoms.get(z) ?? 0n) + BigInt(count));
    // The original authority/diagnostic sums row[6] across every term row.
    // Do not reinterpret charge as one implicit value per formula or per atom.
    const decoded = decodedFloat(charge);
    term.charge += decoded.coefficient << BigInt(decoded.exponent + 149);
    term.atomRows++;
    elements.add(z);
  }
  if (terms.some(term => term.atomRows === 0)) fail('missing original atom inventory');
  const elementNumbers = [...elements].sort((a, b) => a - b);
  const speciesWeights = elementNumbers.map(z => terms.map(term => bounded(term.weight
    * (z === 0 ? term.charge : (term.atoms.get(z) ?? 0n) << 149n), 'element/charge weight')));

  // Bound a sum of absolute values for the full donor+product set. This is
  // stronger than the actual selected-pair mass constraints and covers every
  // intermediate subset, signed residual, and exact entity multiplication.
  const moleWeightSum = terms.reduce((sum, term) => sum + term.weight, 0n);
  const maximumMoleNumerator = bounded(maximumMass * moleWeightSum, 'mole numerator sum');
  const maximumEntityNumerator = bounded(maximumMoleNumerator * SPH_EXACT_REACTION_AVOGADRO, 'entity numerator sum');
  const maximumResidualNumerators = speciesWeights.map(row => bounded(maximumMass
    * row.reduce((sum, weight) => sum + abs(weight), 0n), 'element/charge residual sum'));
  bounded(SPH_EXACT_REACTION_AVOGADRO, 'Avogadro definition');

  const termCount = terms.length, elementCount = elementNumbers.length;
  const denominatorOffset = 16, avogadroOffset = denominatorOffset + wideWordCount;
  const termsOffset = avogadroOffset + wideWordCount, termStride = 4 + wideWordCount;
  const elementsOffset = termsOffset + termCount * termStride, elementStride = 4;
  const weightsOffset = elementsOffset + elementCount * elementStride, weightStride = 2 + wideWordCount;
  const totalWords = weightsOffset + elementCount * termCount * weightStride;
  if (!Number.isSafeInteger(totalWords) || totalWords > 0xffffffff || totalWords * 4 > 0xffffffff) {
    throw new RangeError('Exact reaction packet metadata exceeds u32 byte addressing');
  }
  const moleExponentOffset = -maximumMolarExponent, residualExponentOffset = moleExponentOffset - 149;
  const moleExponent = token.format.quantumExponent + moleExponentOffset;
  const residualExponent = token.format.quantumExponent + residualExponentOffset;
  const words = new Uint32Array(totalWords);
  words.set([SPH_EXACT_REACTION_PACKET_METADATA_MAGIC, SPH_EXACT_REACTION_PACKET_METADATA_VERSION,
    massWordCount, wideWordCount, termCount, elementCount, termsOffset, termStride,
    elementsOffset, elementStride, weightsOffset, weightStride, denominatorOffset, avogadroOffset,
    moleExponent, residualExponent]);
  const writeMagnitude = (value, offset) => {
    value = abs(value);
    for (let word = 0; word < wideWordCount; word++) {
      words[offset + word] = Number(value & 0xffffffffn); value >>= 32n;
    }
    if (value !== 0n) throw new RangeError('Exact reaction packet metadata limb truncation');
  };
  writeMagnitude(commonDenominator, denominatorOffset);
  writeMagnitude(SPH_EXACT_REACTION_AVOGADRO, avogadroOffset);
  const termIdentifiers = terms.map((term, index) => {
    const at = termsOffset + index * termStride;
    words.set([term.kind, term.termIndex, term.materialId, term.molar.bits], at);
    writeMagnitude(term.weight, at + 4);
    return Object.freeze({ kind: term.kind, termIndex: term.termIndex,
      materialId: term.materialId, molarMassBits: term.molar.bits });
  });
  elementNumbers.forEach((z, row) => {
    const start = weightsOffset + row * termCount * weightStride;
    words.set([z, start, 0, 0], elementsOffset + row * elementStride);
    speciesWeights[row].forEach((weight, column) => {
      const at = start + column * weightStride;
      words[at] = Number(weight < 0n); writeMagnitude(weight, at + 2);
    });
  });
  resolveSphExactReactionAllocation(token, expected);
  return Object.freeze({
    massWordCount, wideWordCount, headerWords: 16, termCount, elementCount,
    termsOffset, termStride, elementsOffset, elementStride, weightsOffset, weightStride,
    denominatorOffset, avogadroOffset, totalWords, moleExponentOffset, residualExponentOffset,
    moleExponent, residualExponent, maximumMolarExponent, commonDenominator,
    avogadro: SPH_EXACT_REACTION_AVOGADRO, termIdentifiers: Object.freeze(termIdentifiers),
    elementNumbers: Object.freeze(elementNumbers),
    capacityBounds: Object.freeze({ maximumMass, maximumMoleNumerator, maximumEntityNumerator,
      maximumResidualNumerators: Object.freeze(maximumResidualNumerators) }),
    physicalPublicationAdmitted: false,
    // A caller can upload or modify its copy, but cannot alter this encoding
    // or promote it into a physical authority. Re-encoding rechecks the token.
    get words() { return words.slice(); }
  });
}
