import { encodeSphExactReactionPacketMetadata } from './sphExactReactionPacketMetadata.js';
import { resolveSphExactReactionAllocation } from './sphExactReactionAllocation.js';
import { deriveSphReactionStrictGateStaticBlockerFlags } from './sphReactionGpuSummary.js';
import { createSphReactionStrictGateFinalizeParams, SPH_REACTION_STRICT_GATE_PARAMS_INDEX as G }
  from '../../../ulg-gpu-abi/src/sphReactionStrictGate.js';

export const SPH_EXACT_CHEMISTRY_METADATA_MAGIC = 0x58434231;
/** Cold numeric copy only. It carries original static blockers and exactly the
 * original GPU plan's f32 tolerance bits. It issues no source/receipt authority.
 * Header16: magic,version,reactions,N,W,indexOffset,totalWords,atomBits,
 * chargeBits,staticBlockers,reserved[6]. Index rows2: blockOffset,blockWords.
 * Every block is the ORIGINAL PacketMetadata encoding, without changed units. */
export function encodeSphExactReactionChemistryMetadata(compiled, {
  reactionTable, thermalMaterialTable, atomResidualToleranceMol = 1e-6,
  chargeResidualToleranceMol = 1e-6
} = {}) {
  if (!Array.isArray(compiled) || !compiled.length || compiled.length !== reactionTable?.reactionCount) {
    throw new TypeError('Complete original reaction compilations required');
  }
  const expected = { reactionTable, thermalMaterialTable };
  const validate = () => compiled.forEach((token, reactionIndex) =>
    resolveSphExactReactionAllocation(token, { ...expected, reactionIndex }));
  validate();
  const format = compiled[0].format;
  if (compiled.some(token => token.format !== format)) throw new TypeError('One original exact mass format required');
  const blocks = compiled.map(token => encodeSphExactReactionPacketMetadata(token, expected));
  const plan = createSphReactionStrictGateFinalizeParams({ reactionCount: reactionTable.reactionCount,
    atomTermCount: reactionTable.atomTermCount,
    staticBlockerFlags: deriveSphReactionStrictGateStaticBlockerFlags(reactionTable),
    atomResidualToleranceMol, chargeResidualToleranceMol });
  const totalWords = 16 + compiled.length * 2 + blocks.reduce((n, block) => n + block.totalWords, 0);
  if (!Number.isSafeInteger(totalWords) || totalWords > 0x3fffffff) throw new RangeError('Chemistry metadata exceeds word addressing');
  const words = new Uint32Array(totalWords), n = format.wordCount, w = 3 * n + 26;
  words.set([SPH_EXACT_CHEMISTRY_METADATA_MAGIC, 1, compiled.length, n, w, 16, totalWords,
    plan[G.atomResidualToleranceMol], plan[G.chargeResidualToleranceMol], plan[G.staticBlockerFlags]]);
  let offset = 16 + compiled.length * 2;
  blocks.forEach((block, rx) => { words.set([offset, block.totalWords], 16 + rx * 2); words.set(block.words, offset); offset += block.totalWords; });
  validate();
  return Object.freeze({ reactionCount: compiled.length, massWordCount: n, wideWordCount: w, totalWords,
    atomToleranceBits: words[7], chargeToleranceBits: words[8], staticBlockerFlags: words[9],
    tolerancePolicy: 'original-gpu-f32-encoded',
    requestedAtomToleranceMol: atomResidualToleranceMol, requestedChargeToleranceMol: chargeResidualToleranceMol,
    physicalPublicationAdmitted: false, get words() { return words.slice(); } });
}
