import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dyadicFromNumber,
  dyadicAdd,
  dyadicNegate,
  dyadicMultiply,
  dyadicToNumber,
  dyadicRatio,
  dyadicEqual
} from '../src/runtime/material/exactDyadicInventory.js';

// These tests concern exact inventories of the *supplied binary64 values*.
// They do not promote decimal input literals into exact decimal measurements.
const d = dyadicFromNumber;
const subtract = (a, b) => dyadicAdd(a, dyadicNegate(b));
function assertNormalized(value) {
  assert.equal(typeof value.coefficient, 'bigint');
  assert.ok(Number.isSafeInteger(value.exponent));
  assert.equal(Object.isFrozen(value), true);
  if (value.coefficient === 0n) assert.equal(value.exponent, 0);
  else assert.ok((value.coefficient & 1n) !== 0n, 'nonzero coefficient is odd');
}
function exactSame(a, b, label) {
  const exponent = Math.min(a.exponent, b.exponent);
  const left = a.coefficient << BigInt(a.exponent - exponent);
  const right = b.coefficient << BigInt(b.exponent - exponent);
  assert.equal(left, right, label);
  assert.equal(dyadicEqual(a, b), true, label);
}

for (const [input, coefficient, exponent] of [
  [0, 0n, 0], [-0, 0n, 0], [1, 1n, 0], [-1, -1n, 0],
  [0.5, 1n, -1], [1.5, 3n, -1], [-1.5, -3n, -1],
  [0.1, 3602879701896397n, -55],
  [Number.EPSILON, 1n, -52],
  [Number.MIN_VALUE, 1n, -1074],
  [2 ** -1022, 1n, -1022],
  [Number.MAX_VALUE, 9007199254740991n, 971],
  [-Number.MAX_VALUE, -9007199254740991n, 971]
]) test(`binary64 ${String(input)} becomes its exact normalized dyadic inventory`, () => {
  const value = d(input);
  assert.deepEqual(value, { coefficient, exponent });
  assertNormalized(value);
  assert.ok(dyadicToNumber(value) === input, 'binary64 round trip including canonical zero');
});

for (const value of [NaN, Infinity, -Infinity, '1', 1n, undefined, null, new Number(1)]) {
  test(`binary64 import rejects nonfinite or coerced input ${String(value)}`, () => {
    assert.throws(() => d(value));
  });
}

test('addition, multiplication and negation have independently exact integer values', () => {
  const a = d(1.5), b = d(-0.625);
  const outputs = [dyadicAdd(a, b), dyadicMultiply(a, b), dyadicNegate(b)];
  assert.deepEqual(outputs[0], { coefficient: 7n, exponent: -3 });
  assert.deepEqual(outputs[1], { coefficient: -15n, exponent: -4 });
  assert.deepEqual(outputs[2], { coefficient: 5n, exponent: -3 });
  outputs.forEach(assertNormalized);
  assert.deepEqual(a, { coefficient: 3n, exponent: -1 });
  assert.deepEqual(b, { coefficient: -5n, exponent: -3 });
  assert.deepEqual(dyadicAdd(a, dyadicNegate(a)), { coefficient: 0n, exponent: 0 });
  assert.deepEqual(dyadicMultiply(a, d(0)), { coefficient: 0n, exponent: 0 });
  assert.equal(dyadicEqual(a, b), false);
});

test('decimal-looking inputs retain their actual IEEE values rather than silently rebasing to decimals', () => {
  const sum = dyadicAdd(d(0.1), d(0.2));
  assert.deepEqual(sum, { coefficient: 10808639105689191n, exponent: -55 });
  assert.equal(dyadicEqual(sum, d(0.3)), false);
  assert.deepEqual(subtract(sum, d(0.3)), { coefficient: 1n, exponent: -55 });
  assert.equal(dyadicToNumber(sum), 0.1 + 0.2);
});

test('sub-ULP mass debit and credit are retained even when both displayed masses are unchanged', () => {
  const gas = d(0.01), liquid = d(0.02), dm = d(1e-25);
  const gasAfter = subtract(gas, dm), liquidAfter = dyadicAdd(liquid, dm);
  assert.equal(dyadicToNumber(gasAfter), 0.01);
  assert.equal(dyadicToNumber(liquidAfter), 0.02);
  assert.equal(dyadicEqual(gasAfter, gas), false, 'the authoritative debit did occur');
  assert.equal(dyadicEqual(liquidAfter, liquid), false, 'the authoritative credit did occur');
  exactSame(subtract(gas, gasAfter), dm, 'exact gas debit');
  exactSame(subtract(liquidAfter, liquid), dm, 'exact liquid credit');
  exactSame(dyadicAdd(gasAfter, liquidAfter), dyadicAdd(gas, liquid), 'exact joint mass');
});

test('the unequal-binade rounded-debit counterexample is conserved by exact inventories', () => {
  const gasNumber = Math.fround(0.01), liquidNumber = Math.fround(0.001);
  const requested = Math.fround(0.001955);
  const roundedGasAfter = Math.fround(gasNumber - requested);
  const roundedLiquidAfter = Math.fround(liquidNumber + requested);
  assert.equal(Math.fround(gasNumber - roundedGasAfter), Math.fround(roundedLiquidAfter - liquidNumber));
  assert.notEqual(gasNumber - roundedGasAfter, roundedLiquidAfter - liquidNumber,
    'matching rounded debits are not matching actual stored-mass differences');
  const gas = d(gasNumber), liquid = d(liquidNumber), dm = d(requested);
  const gasAfter = subtract(gas, dm), liquidAfter = dyadicAdd(liquid, dm);
  exactSame(subtract(gas, gasAfter), subtract(liquidAfter, liquid), 'exact equal and opposite transfer');
  exactSame(dyadicAdd(gasAfter, liquidAfter), dyadicAdd(gas, liquid), 'no lattice leakage');
});

test('thousands of tiny paired energy transfers preserve their full exact total', () => {
  const source = d(1e12), receiver = d(-3e11), quantum = dyadicMultiply(d(1e-25), d(2_700_005));
  let donor = source, recipient = receiver;
  for (let i = 0; i < 2048; i += 1) {
    donor = subtract(donor, quantum);
    recipient = dyadicAdd(recipient, quantum);
  }
  const transferred = dyadicMultiply(quantum, d(2048));
  exactSame(subtract(source, donor), transferred, 'all energy debits remain inventoried');
  exactSame(subtract(recipient, receiver), transferred, 'all energy credits remain inventoried');
  exactSame(dyadicAdd(donor, recipient), dyadicAdd(source, receiver), 'no global energy loss');
});

test('large exponent gaps retain the small term without an overflowing coefficient conversion', () => {
  const wide = dyadicAdd(d(1), d(Number.MIN_VALUE));
  assert.equal(wide.coefficient, (1n << 1074n) + 1n);
  assert.equal(wide.exponent, -1074);
  assert.equal(dyadicToNumber(wide), 1);
  exactSame(subtract(wide, d(1)), d(Number.MIN_VALUE), 'smallest binary64 quantum survives cancellation');
  const twoLarge = dyadicAdd(d(Number.MAX_VALUE), d(Number.MAX_VALUE));
  exactSame(subtract(twoLarge, d(Number.MAX_VALUE)), d(Number.MAX_VALUE), 'exact state may exceed display range');
});

test('dyadic-to-binary64 rounding is nearest-even at normal and subnormal ties', () => {
  const halfUlp = d(2 ** -53);
  assert.equal(dyadicToNumber(dyadicAdd(d(1), halfUlp)), 1, 'tie chooses even mantissa');
  assert.equal(dyadicToNumber(dyadicAdd(d(1 + Number.EPSILON), halfUlp)), 1 + 2 * Number.EPSILON,
    'opposite halfway mantissa rounds upward to even');
  const justAbove = dyadicAdd(dyadicAdd(d(1), halfUlp), d(2 ** -100));
  assert.equal(dyadicToNumber(justAbove), 1 + Number.EPSILON, 'sticky tail matters above midpoint');
  assert.equal(dyadicToNumber(dyadicNegate(justAbove)), -(1 + Number.EPSILON));
  const halfMin = dyadicMultiply(d(Number.MIN_VALUE), d(0.5));
  assert.ok(dyadicToNumber(halfMin) === 0, 'underflow tie chooses zero');
  assert.equal(dyadicToNumber(dyadicMultiply(halfMin, d(3))), 2 * Number.MIN_VALUE,
    'subnormal halfway chooses even quantum');
});

test('ratios cancel huge common scale without separately overflowing or underflowing operands', () => {
  for (const large of [2 ** 900, 2 ** -900]) {
    const common = dyadicMultiply(d(large), d(large));
    const numerator = dyadicMultiply(common, d(3)), denominator = dyadicMultiply(common, d(2));
    assert.equal(dyadicRatio(numerator, denominator), 1.5);
    assert.equal(dyadicRatio(dyadicNegate(numerator), denominator), -1.5);
    assert.equal(dyadicRatio(numerator, dyadicNegate(denominator)), -1.5);
    assert.equal(dyadicRatio(d(0), denominator), 0);
  }
  assert.throws(() => dyadicRatio(d(1), d(0)));
});

test('arithmetic is associative and distributive for exact inventories, not rounded displays', () => {
  const a = d(1e20), b = d(-1e20), c = d(1e-30);
  exactSame(dyadicAdd(dyadicAdd(a, b), c), dyadicAdd(a, dyadicAdd(b, c)), 'associativity');
  exactSame(dyadicMultiply(a, dyadicAdd(b, c)),
    dyadicAdd(dyadicMultiply(a, b), dyadicMultiply(a, c)), 'distributivity');
  assert.equal((1e20 + -1e20) + 1e-30, 1e-30);
  assert.equal(1e20 + (-1e20 + 1e-30), 0, 'the same identity fails for ordinary rounded Number accumulation');
});
