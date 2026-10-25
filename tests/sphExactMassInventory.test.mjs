import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSphExactMassFormat, encodeSphExactMass, encodeSphExactMassUnits,
  decodeSphExactMass, projectSphExactMassF32Bits, SPH_EXACT_MASS_ERROR as E
} from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { dyadicFromNumber, dyadicEqual } from '../src/runtime/material/exactDyadicInventory.js';

const format = createSphExactMassFormat();
const bits = value => new Uint32Array(new Float32Array([value]).buffer)[0];
const float = word => new Float32Array(new Uint32Array([word]).buffer)[0];
const units = words => decodeSphExactMass(words, format).coefficient;

test('immutable numeric format is explicit and does not accept a mutable lookalike', () => {
  assert.equal(Object.isFrozen(format), true);
  assert.deepEqual({ ...format }, { schema: 'peercompute.ulg.exact-mass-inventory.v1',
    wordCount: 9, quantumExponent: -149, byteStride: 36 });
  assert.throws(() => encodeSphExactMass(1, { ...format }), /Original immutable/);
  for (const wordCount of [0, -1, 1.5, 67, Infinity, NaN]) {
    assert.throws(() => createSphExactMassFormat({ wordCount }), /Exact mass requires/);
  }
  for (const quantumExponent of [-1075, 1024, .5, NaN, Infinity]) {
    assert.throws(() => createSphExactMassFormat({ quantumExponent }), /Exact mass requires/);
  }
});

test('cold inputs preserve their original binary64 bits, without first rounding to f32', () => {
  for (const value of [0, 1, .01, 1e-24, 2 ** -149, 1.5, 2 ** -10 + 2 ** -33,
    float(0x7f7fffff)]) {
    const exact = decodeSphExactMass(encodeSphExactMass(value, format), format);
    assert.ok(dyadicEqual(exact, dyadicFromNumber(value)), String(value));
  }
  assert.notEqual(units(encodeSphExactMass(.01, format)), units(encodeSphExactMass(Math.fround(.01), format)));
});

test('nonrepresentable inputs reject; a finer profile admits them without loss', () => {
  for (const value of [2 ** -150, 1e-40, 2 ** 139, -1, -0, Infinity, NaN, '1']) {
    assert.throws(() => encodeSphExactMass(value, format), RangeError);
  }
  const wide = createSphExactMassFormat({ wordCount: 66, quantumExponent: -1074 });
  for (const value of [Number.MIN_VALUE, 1e-300, 1e-40, Number.MAX_VALUE]) {
    assert.ok(dyadicEqual(decodeSphExactMass(encodeSphExactMass(value, wide), wide), dyadicFromNumber(value)));
  }
});

test('complete, unsigned nonshared word records are required', () => {
  for (const input of [[], new Uint32Array(8), new Int32Array(9),
    new Uint32Array(new SharedArrayBuffer(36))]) assert.throws(() => decodeSphExactMass(input, format));
  for (const input of [-1n, 1n << 288n, 1]) assert.throws(() => encodeSphExactMassUnits(input, format));
  assert.equal(units(encodeSphExactMassUnits((1n << 288n) - 1n, format)), (1n << 288n) - 1n);
});

test('every f32 exponent and representative significands round-trips, including raw subnormals', () => {
  for (let exponent = 0; exponent < 255; exponent++) {
    for (const fraction of [0, 1, 2, 0x123456, 0x400000, 0x7ffffe, 0x7fffff]) {
      const word = exponent * 0x800000 + fraction;
      assert.deepEqual(projectSphExactMassF32Bits(encodeSphExactMass(float(word), format), format),
        { bits: word, error: 0 });
    }
  }
});

test('random binary64 cold values project identically to one IEEE f32 rounding', () => {
  let seed = 0x12345678;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  for (let i = 0; i < 4000; i++) {
    const value = (1 + random() / 2 ** 32) * 2 ** ((random() % 180) - 90);
    assert.deepEqual(projectSphExactMassF32Bits(encodeSphExactMass(value, format), format),
      { bits: bits(value), error: 0 });
  }
});

test('ties to even, significand carry, subnormal promotion and projection refusal', () => {
  for (const [value, expected] of [[1 + 2 ** -24, 0x3f800000],
    [1 + 3 * 2 ** -24, 0x3f800002], [2 - 2 ** -24, 0x40000000]]) {
    assert.deepEqual(projectSphExactMassF32Bits(encodeSphExactMass(value, format), format), { bits: expected, error: 0 });
  }
  const fine = createSphExactMassFormat({ wordCount: 12, quantumExponent: -256 });
  for (const [value, expected, error] of [[2 ** -150, 0, E.PROJECTION_UNDERFLOW],
    [3 * 2 ** -150, 2, 0], [2 ** -126 - 2 ** -150, 0x00800000, 0]]) {
    assert.deepEqual(projectSphExactMassF32Bits(encodeSphExactMass(value, fine), fine), { bits: expected, error });
  }
  const overflow = encodeSphExactMass(2 ** 128, format);
  assert.deepEqual(projectSphExactMassF32Bits(overflow, format), { bits: 0, error: E.PROJECTION_OVERFLOW });
  assert.notEqual(units(overflow), 0n, 'projection refusal cannot erase inventory');
});

test('handoff counterexample keeps the odd low bit after crossing a mass binade', () => {
  const gas = units(encodeSphExactMass(1.5, format));
  const liquid = units(encodeSphExactMass(2 ** -10 + 2 ** -33, format));
  const packet = units(encodeSphExactMass(2 ** -10, format));
  const nextGas = gas - packet, nextLiquid = liquid + packet;
  assert.equal(nextGas + nextLiquid, gas + liquid);
  assert.equal(nextLiquid & ((1n << 117n) - 1n), 1n << 116n);
  const projected = projectSphExactMassF32Bits(encodeSphExactMassUnits(nextLiquid, format), format);
  assert.notEqual(units(encodeSphExactMass(float(projected.bits), format)), nextLiquid,
    'rounded projection is not a valid replacement for the exact successor');
});
