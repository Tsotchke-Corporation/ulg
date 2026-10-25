import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat, SPH_EXACT_MASS_ERROR as E }
  from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactExtensiveWgsl } from '../src/runtime/sph/sphExactExtensiveWgsl.js';
import { exactExtensiveCases, referenceExactExtensive, referenceExactExtensiveProduct,
  referenceExactExtensiveRatio } from './fixtures/sphExactExtensiveNative.js';

const signed = value => ({ value, negative: Number(value < 0n), error: 0 });
const projection = (value, denominator = 1n) => referenceExactExtensiveRatio(signed(value), denominator);
const abs = value => value < 0n ? -value : value;

for (const wordCount of [1, 9, 66]) {
  const format = createSphExactMassFormat({ wordCount, quantumExponent: wordCount === 66 ? -1074 : -149 });
  const maximum = (1n << BigInt(32 * wordCount)) - 1n;
  test(`extensive ${wordCount}-word exact products keep complete subnormal and signed low parts`, () => {
    assert.deepEqual(referenceExactExtensiveProduct(format, 1n, 1, 1, true), signed(1n));
    assert.deepEqual(referenceExactExtensiveProduct(format, 1n, 0x80000001, 1, true), signed(-1n));
    assert.deepEqual(referenceExactExtensiveProduct(format, maximum, 0x3f800000), signed(maximum << 299n));
    assert.deepEqual(referenceExactExtensiveProduct(format, maximum, 0x80000000), signed(0n));
    // (1+2^-23)(1+3*2^-23)/2, retaining the cross-product's last bits.
    const expected = maximum * ((1n << 23n) + 1n) * ((1n << 23n) + 3n) << 252n;
    assert.equal(referenceExactExtensiveProduct(format, maximum, 0x3f800001, 0x3f800003, true).value, expected);
    assert.equal(referenceExactExtensiveProduct(format, 0n, 0x7f800000).error, E.INVALID_FLOAT);
  });
  test(`extensive ${wordCount}-word headroom fits maximal products and detects wider raw sums`, () => {
    const value = referenceExactExtensiveProduct(format, maximum, 0x7f7fffff, 0x7f7fffff);
    const exact = maximum * ((1n << 24n) - 1n) ** 2n << 507n;
    assert.equal(value.value, exact); assert.equal(value.error, 0);
    assert.ok(exact < 1n << BigInt(32 * (wordCount + 18)));
    assert.ok(exact >= 1n << BigInt(32 * (wordCount + 17)), 'one fewer limb is insufficient');
    const full = (1n << BigInt(32 * (wordCount + 18))) - 1n;
    assert.equal(referenceExactExtensive(format, { op: 5, rawA: full, rawB: 1n }).error, E.OVERFLOW);
    assert.deepEqual(referenceExactExtensive(format, { op: 6, rawA: full, rawB: full - 1n }).value, 1n);
    assert.equal(referenceExactExtensive(format, { op: 5, rawA: full, rawB: -full }).negative, 0);
  });
  test(`extensive ${wordCount}-word fixture references preserve algebraic identities and checked metadata`, () => {
    const rows = exactExtensiveCases(format);
    assert.equal(rows.length, 131);
    for (const row of rows) {
      const result = referenceExactExtensive(format, row);
      assert.ok(abs(result.value) < 1n << BigInt(32 * (wordCount + 18)), row.name);
      assert.ok(Number.isInteger(result.projection.bits) && result.projection.bits >= 0 && result.projection.bits <= 0xffffffff, row.name);
      if (row.op === 2 || row.op === 3 || row.op === 4) {
        const a = referenceExactExtensiveProduct(format, row.mass ?? 1n, row.a ?? 0x3f800000, row.b ?? 0x3f800000, row.half);
        const b = referenceExactExtensiveProduct(format, row.massB ?? 1n, row.c ?? 0x3f800000, row.d ?? 0x3f800000, row.halfB);
        if (!a.error && !b.error) assert.equal(result.value, a.value + (row.op === 3 ? -b.value : b.value), row.name);
      }
    }
    const cancellation = rows.find(row => row.name === 'cancel-to-minimum-quantum');
    assert.equal(referenceExactExtensive(format, cancellation).value, 1n);
  });
}

test('rational projection uses nearest-even across normal and subnormal boundaries', () => {
  assert.deepEqual(projection(1n << 299n, 3n), { bits: 0x3eaaaaab, error: 0 });
  assert.deepEqual(projection(-(1n << 299n), 3n), { bits: 0xbeaaaaab, error: 0 });
  assert.deepEqual(projection(1n << 149n), { bits: 0, error: E.PROJECTION_UNDERFLOW });
  assert.deepEqual(projection((1n << 149n) + 1n), { bits: 1, error: 0 });
  assert.deepEqual(projection(-(1n << 149n)), { bits: 0x80000000, error: E.PROJECTION_UNDERFLOW });
  assert.equal(projection(3n << 149n).bits, 2);
  assert.equal(projection(5n << 149n).bits, 2);
  assert.equal(projection(((1n << 24n) - 1n) << 149n).bits, 0x800000);
  assert.equal(projection(((1n << 24n) + 1n) << 275n).bits, 0x3f800000);
  assert.equal(projection(((1n << 24n) + 3n) << 275n).bits, 0x3f800002);
  assert.equal(projection(((1n << 25n) - 1n) << 275n).bits, 0x40000000);
  const overflowTie = ((1n << 25n) - 1n) << 402n;
  assert.equal(projection(overflowTie - 1n).bits, 0x7f7fffff);
  assert.deepEqual(projection(overflowTie), { bits: 0, error: E.PROJECTION_OVERFLOW });
});

test('full-width rational COM scales exactly and retains a below-f32 cancellation residual', () => {
  const denominator = (1n << 2112n) - 1n;
  const one = denominator << 299n;
  assert.deepEqual(projection(one, denominator), { bits: 0x3f800000, error: 0 });
  assert.deepEqual(projection(one + 1n, denominator), { bits: 0x3f800000, error: 0 });
  assert.deepEqual(projection(1n, denominator), { bits: 0, error: E.PROJECTION_UNDERFLOW });
  // Scaling numerator and denominator equally cannot change rational rounding.
  for (let i = 1n; i < 64n; i++) {
    const numerator = i * (1n << 293n) + 7n;
    assert.deepEqual(projection(numerator, 29n), projection(numerator * denominator, 29n * denominator));
  }
});

test('projection propagates input errors, rejects zero denominator and canonicalizes exact zero', () => {
  assert.deepEqual(referenceExactExtensiveRatio({ value: 1n, negative: 0, error: E.INVALID_FLOAT }, 0n),
    { bits: 0, error: E.INVALID_FLOAT | E.DIVISION_BY_ZERO });
  assert.deepEqual(referenceExactExtensiveRatio({ value: 1n, negative: 2, error: 0 }, 1n),
    { bits: 0, error: E.INVALID_RATIO });
  assert.deepEqual(referenceExactExtensiveRatio({ value: 0n, negative: 1, error: 0 }, 1n), { bits: 0, error: 0 });
});

test('extensive generator requires the original numeric format and varies only declared width/quantum', () => {
  const low = createSphExactMassFormat({ wordCount: 1, quantumExponent: -1074 });
  const high = createSphExactMassFormat({ wordCount: 1, quantumExponent: 1023 });
  assert.throws(() => createSphExactExtensiveWgsl({ ...low }), /Original immutable/);
  assert.equal(createSphExactExtensiveWgsl(low).replace('const EE_QUANTUM: i32 = -1373i;', ''),
    createSphExactExtensiveWgsl(high).replace('const EE_QUANTUM: i32 = 724i;', ''));
});
