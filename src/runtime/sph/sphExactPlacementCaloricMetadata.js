import { resolveSphExactReactionAllocation } from './sphExactReactionAllocation.js';
import { sphReactionEnergyEntry } from './sphReactionEnergyAuthority.js';

const HEADER_WORDS = 8, MATERIAL_WORDS = 8, INTERVAL_WORDS = 8;
const MAGIC = 0x58514331;
const bits = value => new Uint32Array(new Float32Array([value]).buffer)[0];
const checked = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0x3fffffff) {
    throw new RangeError(`Exact placement caloric metadata ${label} exceeds word addressing`);
  }
  return value;
};

/** Cold data copied only from original admitted compiler/energy records. This
 * does not authenticate a receiver or grant physical publication. Material
 * rows retain an original term descriptor and all its original intervals for
 * this phase; they never borrow a reaction-wide product-temperature bracket.
 *
 * Header8: magic,version,materialCount,materialStride,intervalCount,
 * intervalStride,intervalOffset,reserved.
 * Material8: material,phase,molarBits,originalDescriptor,firstInterval,
 * intervalCount,reserved[2].
 * Interval8: TminBits,TmaxBits,UminBits,UmaxBits,densityBits,
 * originalCurveRecord,reserved[2].
 * All table offsets address the unchanged original combined vec4 records.
 */
export function encodeSphExactPlacementCaloricMetadata(compiled, expected = {}) {
  if (!Array.isArray(compiled) || !compiled.length || !expected.reactionTable) {
    throw new TypeError('Original exact compiler records and reaction table required');
  }
  // Snapshot the consumed list so reentrant array access cannot validate one
  // token and then supply a different one during the packing loop.
  const tokens = Object.freeze([...compiled]);
  if (!tokens.length) throw new TypeError('Original exact compiler records required');
  const validate = () => { for (const token of tokens) resolveSphExactReactionAllocation(token, expected); };
  validate();
  const table = expected.reactionTable, rows = new Map();
  for (const token of tokens) {
    const entry = sphReactionEnergyEntry(table, token.reactionIndex);
    if (!entry) throw new TypeError('Missing original receiver caloric entry');
    for (const term of [...entry.reactants, ...entry.products]) {
      const phases = [...new Set(term.curves.map(curve => curve.phaseId))].sort((a, b) => a - b);
      for (const phase of phases) {
        const intervals = term.curves.flatMap((curve, index) => curve.phaseId === phase ? [{
          curve, originalRecord: table.combinedRecords[term.offset * 4 + 4] + 2 * index
        }] : []);
        // Compare the actual caloric gauge, samples and density. Stoichiometric
        // coefficient, term ordinal and reaction reference energy are not a
        // second caloric law and must not narrow a compatible material row.
        const signature = JSON.stringify([bits(term.molarMass), intervals.map(({ curve }) => [
          bits(curve.tMin), bits(curve.tMax), bits(curve.uMin), bits(curve.uMax),
          bits(curve.density), curve.samples.map(bits)
        ])]);
        const key = `${term.materialId}:${phase}`, previous = rows.get(key);
        if (previous) {
          if (previous.signature !== signature) {
            throw new TypeError('Conflicting original receiver caloric graphs or molar identities');
          }
          continue;
        }
        if (!Number.isInteger(term.offset) || term.offset <= 0
          || (term.offset + 3) * 4 > table.combinedRecords.length) {
          throw new TypeError('Invalid original receiver caloric descriptor');
        }
        rows.set(key, { material: term.materialId, phase, molarBits: bits(term.molarMass),
          descriptor: term.offset, signature, intervals });
      }
    }
  }
  const ordered = [...rows.values()].sort((a, b) => a.material - b.material || a.phase - b.phase);
  const intervalCount = checked(ordered.reduce((sum, row) => sum + row.intervals.length, 0), 'interval count');
  const intervalOffsetWords = checked(HEADER_WORDS + ordered.length * MATERIAL_WORDS, 'interval offset');
  const words = new Uint32Array(checked(intervalOffsetWords + intervalCount * INTERVAL_WORDS, 'arena'));
  words.set([MAGIC, 1, ordered.length, MATERIAL_WORDS, intervalCount, INTERVAL_WORDS, intervalOffsetWords, 0]);
  let interval = 0;
  ordered.forEach((row, index) => {
    words.set([row.material, row.phase, row.molarBits, row.descriptor, interval, row.intervals.length, 0, 0],
      HEADER_WORDS + index * MATERIAL_WORDS);
    for (const { curve, originalRecord } of row.intervals) {
      if (!Number.isInteger(originalRecord) || originalRecord <= 0
        || (originalRecord + 2) * 4 > table.combinedRecords.length) {
        throw new TypeError('Invalid original receiver caloric interval');
      }
      words.set([bits(curve.tMin), bits(curve.tMax), bits(curve.uMin), bits(curve.uMax),
        bits(curve.density), originalRecord, 0, 0], intervalOffsetWords + interval * INTERVAL_WORDS);
      interval++;
    }
  });
  validate();
  return Object.freeze({ words, headerWords: HEADER_WORDS, materialCount: ordered.length,
    materialRecordWords: MATERIAL_WORDS, intervalCount, intervalRecordWords: INTERVAL_WORDS,
    intervalOffsetWords });
}
