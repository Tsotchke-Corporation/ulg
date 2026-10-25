import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat, SPH_EXACT_MASS_ERROR as E }
  from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactCaloricWgsl } from '../src/runtime/sph/sphExactCaloricWgsl.js';
import { exactCaloricCases, exactCaloricPairSource, referenceExactCaloric,
  referenceExactCaloricTarget, referenceExactCaloricTrial, runExactCaloricNative }
  from './fixtures/sphExactCaloricNative.js';

const abs = n => n < 0n ? -n : n;
const value = n => ({ value: n, negative: Number(n < 0n), error: 0 });
// Direct bit-to-integer velocity in units 2^-149, independent of the EE product helper.
function velocityUnits(bits) {
  const exponent = (bits >>> 23) & 255;
  assert.notEqual(exponent, 255);
  const magnitude = BigInt((bits & 0x7fffff) | (exponent ? 0x800000 : 0)) << BigInt(exponent ? exponent - 1 : 0);
  return bits >>> 31 ? -magnitude : magnitude;
}

for (const wordCount of [1, 9, 66]) {
  const format = createSphExactMassFormat({ wordCount, quantumExponent: wordCount === 66 ? -1074 : -149 });
  const maximum = (1n << BigInt(32 * wordCount)) - 1n;
  const wideBits = 32 * (3 * wordCount + 26), wideMaximum = (1n << BigInt(wideBits)) - 1n;
  const scaleMaximum = (1n << BigInt(32 * (wordCount + 4))) - 1n;

  test(`caloric ${wordCount}-word COM elimination equals the direct two-body relative-energy identity`, () => {
    const a = maximum / 3n, b = maximum - a;
    const pairs = [
      [[1, 0x80000001, 0], [2, 0, 0x80000001]],
      [[0x3f800001, 0xbf800003, 1], [0x3f800001, 0xbf800003, 1]],
      [[0x7f7fffff, 0xff7ffffe, 0x00800000], [0x7f7ffffe, 0xff7fffff, 0x007fffff]],
      [[0x3f800000, 0xbf800000, 0x40000000], [0xbf800000, 0x40000000, 0xc0000000]]
    ];
    for (const [va, vb] of pairs) {
      const source = exactCaloricPairSource(format, a, b, va, vb);
      const differenceSquared = va.reduce((sum, bits, axis) => sum + (velocityUnits(bits) - velocityUnits(vb[axis])) ** 2n, 0n);
      const direct = a * b * differenceSquared;
      const original = source.kinetic * source.total
        - [source.px, source.py, source.pz].reduce((sum, momentum) => sum + (momentum >> 150n) ** 2n, 0n);
      assert.equal(original, direct);
      const caloric = referenceExactCaloricTarget(format, source);
      assert.equal(caloric.error, 0);
      assert.equal(caloric.numerator.value, direct);
      assert.equal(caloric.denominator.value, maximum);
    }
  });

  test(`caloric ${wordCount}-word uniform COM cancels exactly while sensible low parts survive`, () => {
    const a = maximum / 3n, b = maximum - a, velocity = [0x7f7fffff, 0x80000001, 0xff7ffffe];
    const source = exactCaloricPairSource(format, a, b, velocity, velocity);
    for (const sensible of [1n, -1n, (maximum << 299n) + 1n]) {
      const result = referenceExactCaloric(format, { ...source, sensible, trial: sensible, massScale: scaleMaximum });
      assert.equal(result.error, 0);
      assert.equal(result.numerator.value, sensible * maximum * scaleMaximum);
      assert.equal(result.denominator.value, maximum * scaleMaximum);
      assert.deepEqual(result.residual, value(0n));
      assert.equal(result.comparison, 0);
    }
    assert.equal(referenceExactCaloric(format, { sensible: 2n, trial: 1n }).residual.value, 1n);
    assert.equal(referenceExactCaloric(format, { sensible: -2n, trial: -1n }).residual.value, -1n);
  });

  test(`caloric ${wordCount}-word signed formation remains a rational without division or clipping`, () => {
    const total = maximum, scale = scaleMaximum, sensible = -17n, kinetic = 3n;
    // Minimum f32 delta and largest scale exponent require the full 104-bit fractional shift.
    for (const sign of [1n, -1n]) {
      const result = referenceExactCaloricTarget(format, { total, sensible, kinetic, massScale: scale,
        scaleExponent: 254, deltaBits: sign > 0n ? 1 : 0x80000001 });
      assert.equal(result.error, 0);
      assert.equal(result.fractionalShift, 104);
      assert.equal(result.numerator.value, ((sensible * total + kinetic * total) * scale << 104n) - total * total * sign);
      assert.equal(result.denominator.value, total * scale);
      const trial = referenceExactCaloricTrial(format, 1n, result.denominator, result.fractionalShift);
      assert.equal(trial.value, total * scale << 104n);
    }
    for (const deltaBits of [0, 0x80000000]) {
      const result = referenceExactCaloricTarget(format, { total, sensible, massScale: scale, scaleExponent: 254, deltaBits });
      assert.equal(result.fractionalShift, 0);
      assert.equal(result.numerator.value, sensible * total * scale);
    }
    const large = referenceExactCaloricTarget(format, { total, deltaBits: 0x7f7fffff, scaleExponent: -298 });
    assert.equal(large.error, 0);
    assert.equal(large.numerator.value, -(total * total * ((1n << 24n) - 1n) << 701n));
    assert.equal(referenceExactCaloricTarget(format, { total, deltaBits: 0xff7fffff, scaleExponent: -298 }).numerator.value,
      -large.numerator.value);
  });

  test(`caloric ${wordCount}-word full-width arithmetic checks final carry, borrow, signs and shifts`, () => {
    const calculate = row => referenceExactCaloric(format, row).numerator;
    assert.deepEqual(calculate({ op: 1, rawA: wideMaximum - 1n, rawB: 1n }), value(wideMaximum));
    assert.equal(calculate({ op: 1, rawA: wideMaximum, rawB: 1n }).error, E.OVERFLOW);
    assert.deepEqual(calculate({ op: 1, rawA: wideMaximum, rawB: -wideMaximum }), value(0n));
    assert.deepEqual(calculate({ op: 2, rawA: wideMaximum, rawB: wideMaximum - 1n }), value(1n));
    const center = 1n << BigInt(wideBits / 2);
    assert.deepEqual(calculate({ op: 3, rawA: center - 1n, rawB: center + 1n }), value(wideMaximum));
    assert.equal(calculate({ op: 3, rawA: center + 1n, rawB: center + 1n }).error, E.OVERFLOW);
    assert.deepEqual(calculate({ op: 3, rawA: -wideMaximum, rawB: 0n }), value(0n));
    assert.deepEqual(calculate({ op: 4, rawA: -1n, shift: wideBits - 1 }), value(-(1n << BigInt(wideBits - 1))));
    assert.equal(calculate({ op: 4, rawA: 1n, shift: wideBits }).error, E.OVERFLOW);
    assert.deepEqual(calculate({ op: 4, rawA: { value: 0n, negative: 1 }, shift: 0xffffffff }), value(0n));
    assert.equal(referenceExactCaloric(format, { op: 8, rawA: -wideMaximum, rawB: -1n }).comparison, -1);
    assert.equal(referenceExactCaloric(format, { op: 8, rawA: { value: 0n, negative: 1 }, rawB: 0n }).comparison, 0);
  });

  test(`caloric ${wordCount}-word malformed metadata and inconsistent kinetic source reject explicitly`, () => {
    const rejects = [
      [{ total: 0n }, E.DIVISION_BY_ZERO],
      [{ massScale: 0n }, E.INVALID_RATIO], [{ massScale: -1n }, E.INVALID_RATIO],
      [{ massScale: scaleMaximum + 1n }, E.INVALID_RATIO],
      [{ massScale: { value: 1n, negative: 2 } }, E.INVALID_RATIO],
      [{ sensible: { value: 1n, negative: 2 } }, E.INVALID_RATIO],
      [{ scaleExponent: -299 }, E.INVALID_RATIO], [{ scaleExponent: 255 }, E.INVALID_RATIO],
      [{ kinetic: -1n }, E.INVALID_RATIO], [{ px: 1n << 150n }, E.INVALID_RATIO],
      [{ px: 1n }, E.INEXACT_INPUT], [{ py: 1n << 149n }, E.INEXACT_INPUT],
      [{ pz: -(1n << 149n) }, E.INEXACT_INPUT],
      ...[0x7f800000, 0xff800000, 0x7fc00000].map(deltaBits => [{ deltaBits }, E.INVALID_FLOAT]),
      [{ kinetic: { value: 0n, error: E.OVERFLOW }, massScale: { value: 1n, error: E.INVALID_FLOAT } }, E.OVERFLOW | E.INVALID_FLOAT]
    ];
    for (const [row, expected] of rejects) {
      const result = referenceExactCaloricTarget(format, row);
      assert.equal(result.error, expected);
      assert.deepEqual(result.numerator, { value: 0n, negative: 0, error: expected });
      assert.deepEqual(result.denominator, result.numerator);
      assert.equal(result.fractionalShift, 0);
    }
    assert.equal(referenceExactCaloricTrial(format, 1n, -1n, 0).error, E.INVALID_RATIO);
    assert.equal(referenceExactCaloricTrial(format, 1n, 0n, 0).error, E.INVALID_RATIO);
    assert.equal(referenceExactCaloricTrial(format, 1n, 1n, 105).error, E.INVALID_RATIO);
    assert.equal(referenceExactCaloricTrial(format, 2n, wideMaximum, 0).error, E.OVERFLOW);
  });

  test(`caloric ${wordCount}-word native matrix stays representable and retains error evidence`, async () => {
    const rows = exactCaloricCases(format);
    assert.equal(rows.length, 80);
    for (const row of rows) {
      const result = referenceExactCaloric(format, row);
      for (const field of ['numerator', 'denominator', 'trial', 'residual']) {
        assert.ok(abs(result[field].value) <= wideMaximum, `${row.name}: ${field}`);
        assert.ok([0, 1].includes(result[field].negative), `${row.name}: ${field} sign`);
        if (result[field].error) assert.equal(result[field].value, 0n, `${row.name}: ${field} error payload`);
      }
      if (row.name.startsWith('independent-pair-')) assert.equal(result.error, 0, row.name);
    }
    assert.equal(referenceExactCaloric(format, rows.find(row => row.name === 'maximum-source-and-scale')).error, 0);
    // Exercise packing every original source word before stopping at the GPU boundary.
    const sentinel = new Error('CPU fixture packing complete');
    await assert.rejects(runExactCaloricNative({ createShaderModule() { throw sentinel; } }, format), error => error === sentinel);
  });
}

test('caloric shader generation requires the original immutable mass format', () => {
  const format = createSphExactMassFormat();
  assert.equal(typeof createSphExactCaloricWgsl(format), 'string');
  assert.throws(() => createSphExactCaloricWgsl({ ...format }), /original/i);
});
