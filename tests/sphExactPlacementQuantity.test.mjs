import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { compileSphExactReactionAllocation } from '../src/runtime/sph/sphExactReactionAllocation.js';
import { sphExactPlacementQuantityLayout, encodeSphExactPlacementMolarMetadata }
  from '../src/runtime/sph/sphExactPlacementQuantityWgsl.js';
import { createExactReactionAllocationFixture } from './fixtures/sphExactReactionAllocationNative.js';

test('current quantities keep rollback, carriers and compact residuals in disjoint complete records', () => {
  for (const wordCount of [1, 9, 66]) {
    const format = createSphExactMassFormat({ wordCount, quantumExponent: wordCount === 66 ? -1074 : -149 });
    const l = sphExactPlacementQuantityLayout(format, { particleCount: 13, eventCapacity: 39 });
    assert.equal(l.originalRowOffset, 0); assert.equal(l.currentRowOffset, 13); assert.equal(l.eventRowOffset, 26);
    assert.equal(l.rowCount, 65); assert.equal(l.wordLength, 65 * l.recordWords);
    assert.equal(l.massOffsetWords + wordCount, l.scalarOffsetWords);
    assert.equal(l.scalarOffsetWords + l.fields.length * l.scalar.recordWords, l.recordWords);
    assert.equal(l.scalar.wordCount, 4 * wordCount + 27);
    assert.equal(l.scalar.scratchWordCount, 2 * l.scalar.wordCount + 1);
  }
});

test('quantity layout rejects undersized first-fragment storage and overflowing arenas', () => {
  const format = createSphExactMassFormat();
  assert.throws(() => sphExactPlacementQuantityLayout(format, { particleCount: 2, eventCapacity: 6,
    rationalWordCount: 4 * format.wordCount + 26 }), /truncate/);
  for (const values of [{ particleCount: 0, eventCapacity: 6 }, { particleCount: 2, eventCapacity: 0 },
    { particleCount: 0x3fffffff, eventCapacity: 1 }, { particleCount: 2 ** 20, eventCapacity: 2 ** 20 }]) {
    assert.throws(() => sphExactPlacementQuantityLayout(format, values), /addressing/);
  }
});

test('cold molar identities come from original sealed compiler records and preserve repeated terms', () => {
  const fixture = createExactReactionAllocationFixture({ reactionCount: 2 });
  const format = createSphExactMassFormat();
  const tokens = [0, 1].map(reactionIndex => compileSphExactReactionAllocation({ ...fixture, reactionIndex, format }));
  const words = encodeSphExactPlacementMolarMetadata(tokens, fixture);
  const decoded = new Map(Array.from({ length: words.length / 2 }, (_, i) => [words[i * 2], words[i * 2 + 1]]));
  const expected = new Map();
  for (const token of tokens) for (const term of [...token.reactants, ...token.products]) {
    expected.set(term.materialId, new Uint32Array(new Float32Array([term.molarMass]).buffer)[0]);
  }
  assert.deepEqual(decoded, new Map([...expected].sort((a, b) => a[0] - b[0])));
  assert.throws(() => encodeSphExactPlacementMolarMetadata([{ ...tokens[0] }], fixture), /original|Original|compiled|authentic/);
  fixture.reactionTable.productTermRecords[3] *= 2;
  assert.throws(() => encodeSphExactPlacementMolarMetadata(tokens, fixture), /changed|Changed|original|Original/);
});

test('inert thermal species keep an exact molecular identity through unrelated chemistry', () => {
  const fixture = createExactReactionAllocationFixture({ identity: true });
  const format = createSphExactMassFormat();
  const token = compileSphExactReactionAllocation({ ...fixture, reactionIndex: 0, format });
  const words = encodeSphExactPlacementMolarMetadata([token], fixture);
  assert.equal(words.length, fixture.thermalMaterialTable.molarMassIdentities.length);
  const original = fixture.thermalMaterialTable.molarMassIdentities;
  assert.deepEqual(words, new Uint32Array(Array.from({ length: original.length / 2 }, (_, i) =>
    [original[i * 2], original[i * 2 + 1]]).sort((a, b) => a[0] - b[0]).flat()));
  // Changing even an otherwise unreactive species must invalidate the original
  // compiled table snapshot; u32 bit patterns cannot round through f32 here.
  const identities = fixture.thermalMaterialTable.molarMassIdentities;
  identities[identities.length - 1] ^= 1;
  assert.throws(() => encodeSphExactPlacementMolarMetadata([token], fixture), /snapshot changed/);
});
