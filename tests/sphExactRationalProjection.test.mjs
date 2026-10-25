import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat, encodeSphExactMassUnits, projectSphExactMassF32Bits,
  SPH_EXACT_MASS_ERROR as E } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactRationalProjectionWgsl } from '../src/runtime/sph/sphExactRationalProjectionWgsl.js';
import { exactRationalProjectionCases, referenceExactRationalProjection, runExactRationalProjectionNative }
  from './fixtures/sphExactRationalProjectionNative.js';
import { exactExtensiveCases, referenceExactExtensive, referenceExactExtensiveProduct, referenceExactExtensiveRatio }
  from './fixtures/sphExactExtensiveNative.js';

for (const wordCount of [1, 9, 66]) {
  const format = createSphExactMassFormat({ wordCount, quantumExponent: wordCount === 66 ? -1074 : -149 });
  const project = row => referenceExactRationalProjection(format, row);
  const maximum = (1n << BigInt(32 * (3 * wordCount + 26))) - 1n;

  test(`rational projection ${wordCount}-word exact rounding boundaries and signed subnormals`, () => {
    const cases = new Map(exactRationalProjectionCases(format).map(row => [row.name, row]));
    for (const [name, bits, error = 0] of [
      ['canonical-zero', 0], ['positive-one', 0x3f800000], ['negative-one', 0xbf800000],
      ['positive-third', 0x3eaaaaab], ['negative-third', 0xbeaaaaab],
      ['tie-even-down', 0x3f800000], ['tie-even-up', 0x3f800002], ['negative-tie-even-up', 0xbf800002],
      ['carry-next-binade', 0x40000000], ['minimum-subnormal', 1], ['negative-minimum-subnormal', 0x80000001],
      ['half-minimum-subnormal', 0, E.PROJECTION_UNDERFLOW], ['negative-half-minimum-subnormal', 0x80000000, E.PROJECTION_UNDERFLOW],
      ['subnormal-tie-odd', 2], ['subnormal-tie-even', 2], ['subnormal-to-normal-tie', 0x00800000],
      ['maximum-finite', 0x7f7fffff], ['below-overflow-midpoint', 0x7f7fffff],
      ['overflow-midpoint', 0, E.PROJECTION_OVERFLOW], ['negative-overflow-midpoint', 0, E.PROJECTION_OVERFLOW],
      ['full-width-equal', 0x3f800000], ['full-width-low-bit-denominator', 0x3f800000],
      ['full-width-half-subnormal', 0, E.PROJECTION_UNDERFLOW], ['full-width-above-half-subnormal', 1],
      ['full-width-below-half-subnormal', 0, E.PROJECTION_UNDERFLOW],
      ['full-width-normalization-left', 0x3f000000], ['full-width-normalization-right', 0x40000000],
      ['full-width-exact-tie', 0x3f800000], ['full-width-one-bit-above-tie', 0x3f800001], ['full-width-one-bit-below-tie', 0x3f800000],
      ['minimum-i32-exponent', 0, E.PROJECTION_UNDERFLOW], ['maximum-i32-exponent', 0, E.PROJECTION_OVERFLOW],
      ['zero-ignores-extreme-exponent', 0]
    ]) assert.deepEqual(project(cases.get(name)), { bits, error }, name);
  });

  test(`rational projection ${wordCount}-word malformed ratios and error union`, () => {
    for (const [row, error] of [
      [{ numerator: 1n, denominator: 0n }, E.DIVISION_BY_ZERO],
      [{ denominator: 0n }, E.DIVISION_BY_ZERO],
      [{ numerator: 1n, denominator: -1n }, E.INVALID_RATIO],
      [{ denominator: { value: 0n, negative: 1 } }, E.INVALID_RATIO | E.DIVISION_BY_ZERO],
      [{ numerator: { value: 0n, negative: 1 } }, E.INVALID_RATIO],
      [{ numerator: { value: 1n, negative: 2 } }, E.INVALID_RATIO],
      [{ denominator: { value: 1n, negative: 2 } }, E.INVALID_RATIO],
      [{ numerator: { value: 1n, error: E.OVERFLOW }, denominator: { value: 1n, error: E.INVALID_FLOAT } }, E.OVERFLOW | E.INVALID_FLOAT],
      [{ numerator: { value: 0n, error: E.INEXACT_INPUT } }, E.INEXACT_INPUT]
    ]) assert.deepEqual(project(row), { bits: 0, error });
    for (const row of [{ numerator: maximum + 1n }, { denominator: maximum + 1n },
      { binaryExponent: 2147483648 }, { binaryExponent: -2147483649 }, { binaryExponent: 0.5 }]) {
      assert.throws(() => project(row), RangeError);
    }
  });

  test(`rational projection ${wordCount}-word agrees with established exact inventory projection`, () => {
    const massMaximum = (1n << BigInt(wordCount * 32)) - 1n;
    for (const quantumExponent of [-1074, -150, -149, -126, 0, 104, 1023]) {
      const massFormat = createSphExactMassFormat({ wordCount, quantumExponent });
      for (const numerator of [0n, 1n, 3n, 0xffffffn, 0x1000001n, massMaximum - 1n, massMaximum]) {
        assert.deepEqual(project({ numerator, binaryExponent: quantumExponent }),
          projectSphExactMassF32Bits(encodeSphExactMassUnits(numerator, massFormat), massFormat));
      }
    }
  });

  test(`rational projection ${wordCount}-word agrees with established extensive projection and survivor scaling`, () => {
    for (const row of exactExtensiveCases(format)) {
      const value = referenceExactExtensive(format, row);
      if (value.negative !== 0 && value.value === 0n) continue; // this API requires canonical zero
      assert.deepEqual(project({ numerator: value, denominator: row.denominator ?? 1n, binaryExponent: -299 }), value.projection, row.name);
    }
    for (const v0Bits of [1, 0x007fffff, 0x00800000, 0x3f800001, 0x7f7fffff]) {
      const numerator = referenceExactExtensiveProduct(format, 2n, v0Bits);
      assert.deepEqual(project({ numerator, denominator: 3n, binaryExponent: -299 }), referenceExactExtensiveRatio(numerator, 3n));
    }
  });

  test(`rational projection ${wordCount}-word preserves exact rational rescaling and underflow ownership`, () => {
    for (const exponent of [-200, -149, -127, -25, 0, 100, 150]) {
      const row = { numerator: 0x123456789abcdefn, denominator: 0x23456789abcdef1n, binaryExponent: exponent };
      const expected = project(row);
      assert.deepEqual(project({ ...row, numerator: row.numerator * 37n, denominator: row.denominator * 37n }), expected);
      assert.deepEqual(project({ ...row, numerator: row.numerator << 31n, binaryExponent: exponent - 31 }), expected);
      assert.deepEqual(project({ ...row, denominator: row.denominator << 29n, binaryExponent: exponent + 29 }), expected);
    }
    const numerator = Object.freeze({ value: 1n, negative: 0, error: 0 });
    const denominator = Object.freeze({ value: maximum, negative: 0, error: 0 });
    const row = Object.freeze({ numerator, denominator, binaryExponent: -149 });
    assert.deepEqual(project(row), { bits: 0, error: E.PROJECTION_UNDERFLOW });
    assert.equal(row.numerator.value, 1n);
    assert.equal(row.denominator.value, maximum);
  });

  test(`rational projection ${wordCount}-word native vectors pack every retained limb before the GPU boundary`, async () => {
    const rows = exactRationalProjectionCases(format);
    assert.equal(rows.length, 138);
    assert.equal(new Set(rows.map(row => row.name)).size, rows.length);
    assert.ok(rows.some(row => row.numerator === maximum));
    assert.ok(rows.some(row => row.denominator === maximum));
    for (const row of rows) {
      const result = project(row);
      assert.ok(Number.isInteger(result.bits) && result.bits >= 0 && result.bits <= 0xffffffff);
      assert.ok(Number.isInteger(result.error) && result.error >= 0);
    }
    const sentinel = new Error('CPU rational projection fixture packing complete');
    await assert.rejects(runExactRationalProjectionNative({ createShaderModule() { throw sentinel; } }, format), error => error === sentinel);
  });

  test(`rational projection ${wordCount}-word native packing preserves malformed negative zero for shader rejection`, async () => {
    const sentinel = new Error('Stop at CPU upload boundary');
    let packed = null;
    const created = [];
    const device = {
      createShaderModule() { return { getCompilationInfo: async () => ({ messages: [] }) }; },
      createComputePipelineAsync: async () => ({}),
      createBuffer(descriptor) {
        const buffer = { ...descriptor, destroyed: false, destroy() { this.destroyed = true; } };
        created.push(buffer); return buffer;
      },
      queue: { writeBuffer(buffer, offset, words) {
        assert.equal(buffer.label, 'rational-projection-native-source');
        assert.equal(offset, 0); packed = words.slice(); throw sentinel;
      } }
    };
    await assert.rejects(runExactRationalProjectionNative(device, format), error => error === sentinel);
    assert.ok(created.length > 0 && created.every(buffer => buffer.destroyed));
    const rows = exactRationalProjectionCases(format), cw = 3 * wordCount + 26, stride = 4 + 2 * (cw + 2);
    assert.equal(rows.length, 138, 'the original native corpus remains intact');
    const index = rows.findIndex(row => row.name === 'negative-zero-numerator'), at = index * stride;
    assert.ok(index >= 0);
    assert.equal(packed[at], 0);
    assert.ok(packed.subarray(at + 4, at + 4 + cw).every(word => word === 0));
    assert.equal(packed[at + 4 + cw], 1, 'raw invalid negative sign reaches the shader');
    assert.equal(packed[at + 5 + cw], 0);
    assert.equal(packed[at + 6 + cw], 1, 'denominator is exactly one');
    assert.ok(packed.subarray(at + 7 + cw, at + stride).every(word => word === 0));
    assert.deepEqual(project(rows[index]), { bits: 0, error: E.INVALID_RATIO });
  });
}

test('rational projection shader requires the original immutable format', () => {
  const format = createSphExactMassFormat();
  assert.equal(typeof createSphExactRationalProjectionWgsl(format), 'string');
  assert.throws(() => createSphExactRationalProjectionWgsl({ ...format }), /original/i);
});
