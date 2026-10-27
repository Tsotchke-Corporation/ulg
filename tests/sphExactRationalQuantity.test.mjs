import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactRationalQuantityWgsl, sphExactRationalQuantityLayout }
  from '../src/runtime/sph/sphExactRationalQuantityWgsl.js';
import { SPH_EXACT_MASS_ERROR as E } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { EXACT_RATIONAL_QUANTITY_OPERATIONS, exactRationalQuantityCases,
  referenceExactRationalQuantity, referenceRationalQuantityProjection, runExactRationalQuantityNative }
  from './fixtures/sphExactRationalQuantityNative.js';

const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const value = (n, d = 1n, e = 0) => ({ numerator: n, denominator: d, exponent: e });
const rational = v => {
  let n = v.negative ? -v.numerator : v.numerator, d = v.denominator;
  if (v.exponent >= 0) n <<= BigInt(v.exponent); else d <<= BigInt(-v.exponent);
  return [n, d];
};
const equalFraction = (v, n, d = 1n) => {
  assert.equal(v.error, 0); const [vn, vd] = rational(v); assert.equal(vn * d, n * vd);
};

test('rational quantity numeric ABI has explicit capacity and no authority or shader bindings', () => {
  for (const wordCount of [1, 31, 63, 291, 4096]) {
    const layout = sphExactRationalQuantityLayout({ wordCount });
    assert.deepEqual(layout, { wordCount, headerWords: 4, recordWords: 4 + 2 * wordCount,
      numeratorOffsetWords: 4, denominatorOffsetWords: 4 + wordCount, scratchWordCount: 2 * wordCount + 1 });
    assert.ok(Object.isFrozen(layout));
    const shader = createSphExactRationalQuantityWgsl({ wordCount });
    assert.match(shader, new RegExp(`const XR_WORDS: u32 = ${wordCount}u;`));
    assert.match(shader, new RegExp(`const XR_SCRATCH_WORDS: u32 = ${2 * wordCount + 1}u;`));
    for (const name of ['zero', 'normalize', 'add', 'subtract', 'multiply', 'divide', 'scale_pow2', 'from_f32_bits', 'project_f32_bits']) {
      assert.match(shader, new RegExp(`fn xr_${name}\\(`));
    }
    assert.doesNotMatch(shader, /@binding|@group|ExactCaloric|EC_WORDS|f32\(/);
    assert.match(shader, /shift \/ 32u/);
  }
  for (const wordCount of [undefined, 0, -1, 1.5, NaN, Infinity, 4097]) {
    assert.throws(() => sphExactRationalQuantityLayout({ wordCount }), RangeError);
    assert.throws(() => createSphExactRationalQuantityWgsl({ wordCount }), RangeError);
  }
});

for (const wordCount of [1, 9, 31, 63, 66, 291]) {
  const options = { wordCount }, max = (1n << BigInt(32 * wordCount)) - 1n;
  const run = row => referenceExactRationalQuantity(options, row);

  test(`rational quantity R=${wordCount} canonical identities, cancellation and exact cross-reduction`, () => {
    const normalized = run({ a: value(-12n, 40n, 3) }); equalFraction(normalized, -12n, 5n);
    assert.deepEqual([normalized.numerator, normalized.denominator, normalized.negative, normalized.exponent], [3n, 5n, 1, 2]);
    const sum = run({ operation: 'add', a: value(1n, 3n), b: value(1n, 5n) }); equalFraction(sum, 8n, 15n);
    assert.deepEqual([sum.numerator, sum.denominator, sum.exponent], [1n, 15n, 3]);
    equalFraction(run({ operation: 'subtract', a: value(1n, 3n), b: value(1n, 5n) }), 2n, 15n);
    equalFraction(run({ operation: 'divide', a: -3n, b: value(5n, 7n) }), -21n, 5n);
    equalFraction(run({ operation: 'multiply', a: value(max, max - 2n), b: value(max - 2n, max) }), 1n);
    equalFraction(run({ operation: 'divide', a: value(max, max - 2n), b: value(max, max - 2n) }), 1n);
    for (const operation of ['subtract', 'add']) {
      const canceled = run({ operation, a: value(max, max - 2n), b: value(operation === 'add' ? -max : max, max - 2n) });
      assert.deepEqual([canceled.numerator, canceled.denominator, canceled.negative, canceled.exponent, canceled.error], [0n, 1n, 0, 0, 0]);
    }
    const carry = run({ operation: 'add', a: max, b: max });
    assert.deepEqual([carry.numerator, carry.denominator, carry.exponent, carry.error], [max, 1n, 1, 0]);
  });

  test(`rational quantity R=${wordCount} capacity, malformed values and exponent endpoints fail explicitly`, () => {
    for (const [row, error] of [
      [{ a: { negative: 1 } }, E.INVALID_RATIO], [{ a: { negative: 2, numerator: 1n } }, E.INVALID_RATIO],
      [{ a: { reserved: 1 } }, E.INVALID_RATIO], [{ a: value(1n, 0n) }, E.DIVISION_BY_ZERO],
      [{ operation: 'divide', a: 1n }, E.DIVISION_BY_ZERO],
      [{ operation: 'add', a: max, b: 2n }, E.OVERFLOW], [{ operation: 'multiply', a: max, b: max }, E.OVERFLOW],
      [{ operation: 'scale', a: value(1n, 1n, 2147483647), argument: 1 }, E.OVERFLOW],
      [{ operation: 'scale', a: value(1n, 1n, -2147483648), argument: -1 }, E.OVERFLOW],
      [{ a: value(2n, 1n, 2147483647) }, E.OVERFLOW], [{ a: value(1n, 2n, -2147483648) }, E.OVERFLOW],
      [{ operation: 'divide', a: 1n, b: value(1n, 1n, -2147483648) }, E.OVERFLOW],
      [{ operation: 'add', a: value(1n, 1n, -2147483648), b: value(1n, 1n, 2147483647) }, E.OVERFLOW],
      [{ operation: 'add', a: { error: E.INVALID_FLOAT }, b: { error: E.INEXACT_INPUT } }, E.INVALID_FLOAT | E.INEXACT_INPUT]
    ]) {
      const actual = run(row); assert.equal(actual.error, error);
      assert.deepEqual([actual.numerator, actual.denominator, actual.negative, actual.exponent], [0n, 1n, 0, 0]);
      assert.deepEqual(actual.projection, { bits: 0, error });
    }
    equalFraction(run({ operation: 'divide', a: value(1n, 1n, -2147483648), b: value(1n, 1n, -2147483648) }), 1n);
    equalFraction(run({ operation: 'scale', argument: -2147483648 }), 0n);
    for (const a of [value(max + 1n), value(1n, max + 1n), value(1n, -1n), value(1n, 1n, 2147483648)]) {
      assert.throws(() => run({ a }), RangeError);
    }
  });

  test(`rational quantity R=${wordCount} exact f32 bits and full-capacity projection boundaries`, () => {
    for (const word of [0, 0x80000000, 1, 0x80000001, 0x7fffff, 0x800000, 0x3f800001, 0xbf800001, 0x7f7fffff]) {
      const result = run({ operation: 'fromFloat', argument: word });
      assert.deepEqual(result.projection, { bits: word === 0x80000000 ? 0 : word, error: 0 });
    }
    for (const word of [0x7f800000, 0xff800000, 0x7fc00000, 0xffc12345]) {
      assert.equal(run({ operation: 'fromFloat', argument: word }).error, E.INVALID_FLOAT);
    }
    for (const [a, bits, error = 0] of [
      [value(1n, 3n), 0x3eaaaaab], [value(-1n, 3n), 0xbeaaaaab],
      [value(1n, 1n, -150), 0, E.PROJECTION_UNDERFLOW], [value(-1n, 1n, -150), 0x80000000, E.PROJECTION_UNDERFLOW],
      [value(3n, 1n, -150), 2], [value(5n, 1n, -150), 2], [value(0xffffffn, 1n, -150), 0x800000],
      [value(0x1000001n, 1n, -24), 0x3f800000], [value(0x1000003n, 1n, -24), 0x3f800002],
      [value(0x1ffffffn, 1n, 103), 0, E.PROJECTION_OVERFLOW], [value(max - 2n, max), 0x3f800000],
      [value(1n, max, 32 * wordCount - 1), 0x3f000000], [value(max, 1n, 1 - 32 * wordCount), 0x40000000]
    ]) assert.deepEqual(run({ a }).projection, { bits, error });
    const original = Object.freeze(value(1n, max, -149));
    const retained = run({ a: original }); assert.equal(retained.error, 0); assert.equal(retained.projection.error, E.PROJECTION_UNDERFLOW);
    assert.equal(original.numerator, 1n); assert.equal(original.denominator, max);
  });

  test(`rational quantity R=${wordCount} native corpus has canonical exact oracle and complete operation coverage`, async () => {
    const rows = exactRationalQuantityCases(options);
    assert.equal(new Set(rows.map(x => x.name)).size, rows.length);
    assert.deepEqual([...new Set(rows.map(x => x.operation ?? 'normalize'))].sort(), Object.keys(EXACT_RATIONAL_QUANTITY_OPERATIONS).sort());
    for (const row of rows) {
      const out = run(row);
      assert.ok(out.denominator > 0n && out.numerator <= max && out.denominator <= max);
      assert.equal(gcd(out.numerator, out.denominator), 1n);
      if (out.numerator > 0n) { assert.equal(out.numerator & 1n, 1n); assert.equal(out.denominator & 1n, 1n); }
      else assert.deepEqual([out.denominator, out.negative, out.exponent], [1n, 0, 0]);
    }
    const sentinel = new Error('CPU packing reached compilation boundary');
    await assert.rejects(runExactRationalQuantityNative({ createShaderModule() { throw sentinel; } }, options), e => e === sentinel);
  });
}

test('independent rational oracle preserves 2000 signed fractional arithmetic identities', () => {
  const options = { wordCount: 9 }; let seed = 0x713529a1;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  for (let i = 0; i < 500; i++) {
    const an = BigInt(random() || 1) * (i % 2 ? -1n : 1n), ad = BigInt(random() || 1);
    const bn = BigInt(random() || 1) * (i % 3 ? -1n : 1n), bd = BigInt(random() || 1);
    const a = value(an, ad), b = value(bn, bd);
    for (const [operation, n, d] of [['add', an * bd + bn * ad, ad * bd], ['subtract', an * bd - bn * ad, ad * bd],
      ['multiply', an * bn, ad * bd], ['divide', an * bd, ad * bn]]) {
      equalFraction(referenceExactRationalQuantity(options, { operation, a, b }), n, d);
    }
  }
});

test('native packing preserves all full-capacity limbs and malformed headers and cleans unsubmitted buffers', async () => {
  const options = { wordCount: 291 }, layout = sphExactRationalQuantityLayout(options), rows = exactRationalQuantityCases(options);
  const sentinel = new Error('Stop after independent upload'); let uploaded; const owned = [];
  const device = {
    createShaderModule() { return { getCompilationInfo: async () => ({ messages: [] }) }; }, createComputePipelineAsync: async () => ({}),
    createBuffer(descriptor) { const buffer = { ...descriptor, count: 0, destroy() { this.count++; } }; owned.push(buffer); return buffer; },
    queue: { writeBuffer(buffer, offset, words) { assert.equal(buffer.label, 'rational-quantity-native-source'); assert.equal(offset, 0); uploaded = words.slice(); throw sentinel; } }
  };
  await assert.rejects(runExactRationalQuantityNative(device, options), e => e === sentinel);
  assert.ok(owned.length > 0 && owned.every(b => b.count === 1));
  const stride = 4 + 2 * layout.recordWords;
  const full = rows.findIndex(x => x.name === 'normalize-full-width-equal') * stride + 4;
  assert.ok(uploaded.slice(full + 4, full + layout.recordWords).every(x => x === 0xffffffff));
  const negativeZero = rows.findIndex(x => x.name === 'negative-zero-invalid') * stride + 4;
  assert.equal(uploaded[negativeZero], 1);
  assert.ok(uploaded.slice(negativeZero + 4, negativeZero + 4 + layout.wordCount).every(x => x === 0));
  const reserved = rows.findIndex(x => x.name === 'reserved-header-invalid') * stride + 4;
  assert.equal(uploaded[reserved + 3], 1);
});

test('projection oracle stays independent of normalization and represents canonical signed exact ratios', () => {
  assert.deepEqual(referenceRationalQuantityProjection({ numerator: 1n, denominator: 3n, exponent: 0, negative: 1, error: 0 }), { bits: 0xbeaaaaab, error: 0 });
  assert.deepEqual(referenceRationalQuantityProjection({ numerator: 1n, denominator: 1n, exponent: -149, negative: 1, error: 0 }), { bits: 0x80000001, error: 0 });
});
