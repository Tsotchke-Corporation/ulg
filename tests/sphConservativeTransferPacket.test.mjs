import test from 'node:test';
import assert from 'node:assert/strict';
import { referenceDyadic53Packet as round, dyadic53PacketWithinBound as bounded } from './fixtures/sphTransferPacketReference.js';
import { referenceExactRationalQuantity } from './fixtures/sphExactRationalQuantityNative.js';
import { SPH_EXACT_MASS_ERROR as E } from '../ulg-gpu-abi/src/sphExactMassInventory.js';

test('packet oracle rounds halfway cases to even and carries without losing the exponent', () => {
  assert.deepEqual(round({ n: (1n << 53n) + 1n, d: 1n, e: -53 }), { n: 1n, d: 1n, e: 0 });
  assert.deepEqual(round({ n: (1n << 53n) + 3n, d: 1n, e: -53 }), { n: (1n << 51n) + 1n, d: 1n, e: -51 });
  assert.deepEqual(round({ n: (1n << 54n) - 1n, d: 1n, e: -53 }), { n: 1n, d: 1n, e: 1 });
  assert.deepEqual(round({ n: -((1n << 53n) + 1n), d: 1n, e: -53 }), { n: -1n, d: 1n, e: 0 });
});

test('packet exponent is independent of binary64 and finite-capacity errors remain explicit', () => {
  for (const exponent of [-2147483648, -2000, 2000, 2147483647]) {
    const value = referenceExactRationalQuantity({ wordCount: 1 }, { operation: 'roundPacket53', a: { numerator: 1n, exponent } });
    assert.equal(value.error, 0); assert.equal(value.exponent, exponent); assert.equal(value.numerator, 1n);
  }
  assert.equal(referenceExactRationalQuantity({ wordCount: 1 }, {
    operation: 'roundPacket53', a: { numerator: 1n, denominator: 3n }
  }).error, E.OVERFLOW);
  assert.equal(referenceExactRationalQuantity({ wordCount: 2 }, {
    operation: 'roundPacket53', a: { numerator: 1n, denominator: 3n, exponent: -2147483648 }
  }).error, E.OVERFLOW);
});

test('wide packet inputs meet the exact relative-error bound and preserve sign without underflow', () => {
  for (const bits of [32, 64, 288, 2016, 2112]) for (const exponent of [-2000, 0, 2000]) {
    const max = (1n << BigInt(bits)) - 1n;
    for (const [n, d] of [[1n, max], [max, 1n], [max - 2n, max], [-max, max - 2n]]) {
      const value = { n, d, e: exponent }, packet = round(value);
      assert.ok(bounded(value, packet)); assert.notEqual(packet.n, 0n);
      assert.equal(packet.n < 0n, n < 0n); assert.equal(packet.d, 1n);
      assert.ok((packet.n < 0n ? -packet.n : packet.n).toString(2).length <= 53);
    }
  }
});

test('paired dyadic packets retain the original odd denominator through repeated exact debit and credit', () => {
  let donor = { numerator: 7n, denominator: 13n }, receiver = { numerator: 3n, denominator: 17n };
  const run = row => referenceExactRationalQuantity({ wordCount: 9 }, row);
  const total = run({ operation: 'add', a: donor, b: receiver });
  for (let step = 0; step < 128; step++) {
    const packet = run({ operation: 'roundPacket53', a: { numerator: BigInt(step + 1), denominator: BigInt(2 * step + 3), exponent: -20 } });
    donor = run({ operation: 'subtract', a: donor, b: packet });
    receiver = run({ operation: 'add', a: receiver, b: packet });
    assert.equal(donor.error | receiver.error, 0);
    assert.equal(donor.denominator, 13n); assert.equal(receiver.denominator, 17n);
    const sum = run({ operation: 'add', a: donor, b: receiver });
    assert.equal(run({ operation: 'subtract', a: sum, b: total }).numerator, 0n);
  }
});
