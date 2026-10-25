import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createSphReactionProductEventCompactWgsl, sphReactionProductEventCompactWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import { exactReactionEventCompactionCases, referenceExactReactionEventCompaction } from './fixtures/sphExactReactionEventCompactionNative.js';

const integer = words => words.reduceRight((value, word) => value * (1n << 32n) + BigInt(word), 0n);

test('default event compactor preserves the complete legacy shader bytes', () => {
  assert.equal(createSphReactionProductEventCompactWgsl(), sphReactionProductEventCompactWgsl);
  assert.equal(createSphReactionProductEventCompactWgsl({ exactCompanion: null }), sphReactionProductEventCompactWgsl);
  // Baseline captured before introducing the exact variant.
  assert.equal(createHash('sha256').update(sphReactionProductEventCompactWgsl).digest('hex'),
    '55e5d4fc96d39560d96f3eee4716c2de5bef1c40e50c5fd381c09d6b8e1d703b');
});

test('exact companion generation checks its fixed integer width', () => {
  for (const massWordCount of [0, -1, 1.5, 67, Infinity, NaN, '9', undefined]) {
    assert.throws(() => createSphReactionProductEventCompactWgsl({ exactCompanion: { massWordCount } }), RangeError);
  }
  for (const massWordCount of [1, 9, 66]) {
    assert.notEqual(createSphReactionProductEventCompactWgsl({ exactCompanion: { massWordCount } }), sphReactionProductEventCompactWgsl);
  }
});

for (const n of [1, 9, 66]) {
  const stride = 8 + 3 * n;
  test(`${n}-word reference retains stable order across three workgroups without merging repeated terms`, () => {
    const input = exactReactionEventCompactionCases(n)[0];
    const beforeEvents = input.events.slice(), beforeCompanions = input.companions.slice();
    const result = referenceExactReactionEventCompaction(input, n);
    assert.equal(result.error, 0);
    assert.equal(result.liveCount, 87);
    const expectedRows = Array.from({ length: 130 }, (_, row) => row)
      .filter(row => row % 3 !== 0 || [63, 64, 127, 128].includes(row));
    assert.deepEqual(result.sourceRows, expectedRows);
    for (const [destination, source] of expectedRows.entries()) {
      assert.deepEqual(result.events.slice(destination * 32, (destination + 1) * 32),
        [...input.events.subarray(source * 32, (source + 1) * 32)]);
      const companion = result.companions.slice(destination * stride, (destination + 1) * stride);
      assert.deepEqual(companion, [...input.companions.subarray(source * stride, (source + 1) * stride)]);
      assert.equal(companion[1], 7, 'repeated global term IDs are separate stable events');
      const selected = integer(companion.slice(8, 8 + n));
      assert.ok(selected > 0n);
      assert.equal(selected, integer(companion.slice(8 + n, 8 + 2 * n)) + integer(companion.slice(8 + 2 * n)));
    }
    assert.deepEqual(input.events, beforeEvents);
    assert.deepEqual(input.companions, beforeCompanions);
  });

  test(`${n}-word reference keeps hidden-positive fully direct products despite zero float projections`, () => {
    const input = exactReactionEventCompactionCases(n)[0];
    const result = referenceExactReactionEventCompaction(input, n);
    const destination = result.sourceRows.indexOf(64);
    assert.ok(destination >= 0);
    const event = result.events.slice(destination * 32, (destination + 1) * 32);
    const companion = result.companions.slice(destination * stride, (destination + 1) * stride);
    assert.equal(event[3], 0); assert.equal(event[12], 0); assert.equal(event[13], 0);
    assert.equal(event[15], 1); assert.equal(event[16], 0x80000000);
    assert.equal(integer(companion.slice(8, 8 + n)), 1n);
    assert.equal(integer(companion.slice(8 + n, 8 + 2 * n)), 1n);
    assert.equal(integer(companion.slice(8 + 2 * n)), 0n);
    assert.deepEqual(companion.slice(4, 8), [1, 1, 0, 0]);
    const directOnly = exactReactionEventCompactionCases(n).find(row => row.name === 'full-direct-all-rows');
    const all = referenceExactReactionEventCompaction(directOnly, n);
    assert.equal(all.error, 0); assert.equal(all.liveCount, 130);
    assert.deepEqual(all.sourceRows, Array.from({ length: 130 }, (_, i) => i));
  });

  test(`${n}-word empty prefixes and complete zero diagnostics produce no events`, () => {
    for (const name of ['empty-logical-prefix', 'zero-only-diagnostic-prefix']) {
      const input = exactReactionEventCompactionCases(n).find(row => row.name === name);
      assert.deepEqual(referenceExactReactionEventCompaction(input, n),
        { error: 0, liveCount: 0, sourceRows: [], events: [], companions: [] }, name);
    }
  });

  test(`${n}-word malformed integer partitions, partial headers, and capacity mismatches fail globally`, () => {
    const cases = exactReactionEventCompactionCases(n);
    assert.equal(cases.length, 24);
    assert.equal(new Set(cases.map(row => row.name)).size, cases.length);
    for (const input of cases.slice(4)) {
      assert.deepEqual(referenceExactReactionEventCompaction(input, n),
        { error: 1, liveCount: 0, sourceRows: [], events: [], companions: [] }, input.name);
    }
    const overflow = cases.find(row => row.name === 'partition-carry-overflow').companions;
    const at = 64 * stride;
    assert.equal(integer(overflow.subarray(at + 8, at + 8 + n)), 0n);
    assert.equal(integer(overflow.subarray(at + 8 + n, at + 8 + 2 * n))
      + integer(overflow.subarray(at + 8 + 2 * n, at + stride)), 1n << BigInt(32 * n),
    'matching wrapped low limbs never authorize an overflowing partition');
  });

  test(`${n}-word destination can be smaller than dense input when every live row fits`, () => {
    const input = exactReactionEventCompactionCases(n)[0];
    input.outputCapacity = 87; input.outputCompanionWords = 87 * stride;
    assert.equal(referenceExactReactionEventCompaction(input, n).liveCount, 87);
    input.outputCapacity = 86; input.outputCompanionWords = 86 * stride;
    assert.equal(referenceExactReactionEventCompaction(input, n).error, 1);
  });
}
