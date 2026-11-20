import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ULG_LAW_ACTIVATION_RECEIPT_SCHEMA,
  closeLawActivationReceiptRing,
  encodeLawActivationCount,
  openLawActivationReceiptRing
} from '../src/runtime/sph/lawActivationReceiptRing.js';

function fakeDevice() {
  const buffers = [];
  return {
    buffers,
    createBuffer({ size, label }) {
      const data = new Uint8Array(size);
      const buffer = { label, size, data, destroyed: false, mapped: false,
        async mapAsync() { this.mapped = true; },
        getMappedRange() { return data.buffer; },
        unmap() { this.mapped = false; },
        destroy() { this.destroyed = true; } };
      buffers.push(buffer);
      return buffer;
    }
  };
}
const encoder = {
  copyBufferToBuffer(src, srcOffset, dst, dstOffset, size) {
    dst.data.set(src.data.subarray(srcOffset, srcOffset + size), dstOffset);
  }
};
const counts = (active, dormant, present, overflow = 0) => ({
  data: new Uint8Array(new Uint32Array([active, dormant, present, overflow]).buffer)
});

test('law scope receipt sums per-law counts and counts zero-work steps', async () => {
  const device = fakeDevice();
  assert.ok(openLawActivationReceiptRing(device, { capacityPerLaw: 4 }));
  encodeLawActivationCount(encoder, device, 'thermal', counts(10, 5, 15), { epsilon: 0 });
  encodeLawActivationCount(encoder, device, 'thermal', counts(0, 15, 15), { epsilon: 0 });
  encodeLawActivationCount(encoder, device, 'reaction', counts(3, 7, 10));
  const receipt = await closeLawActivationReceiptRing(device);
  assert.equal(receipt.schema, ULG_LAW_ACTIVATION_RECEIPT_SCHEMA);
  assert.deepEqual({ ...receipt.laws.thermal }, {
    gatedEncodes: 2, unrecordedEncodes: 0, activeSourceSteps: 10, dormantSourceSteps: 20,
    presentSourceSteps: 30, overflowSteps: 0, zeroWorkSteps: 1, epsilon: 0, exact: true
  });
  assert.equal(receipt.laws.reaction.activeSourceSteps, 3);
  assert.equal(receipt.laws.reaction.zeroWorkSteps, 0);
  assert.equal(receipt.laws.reaction.exact, true);
  assert.equal(device.buffers[0].destroyed, true, 'the ring is released after reading');
});

test('law scope receipt records overflowed encodes and non-exact epsilon', async () => {
  const device = fakeDevice();
  openLawActivationReceiptRing(device, { capacityPerLaw: 1 });
  encodeLawActivationCount(encoder, device, 'thermal', counts(1, 0, 1), { epsilon: 0.5 });
  assert.equal(encodeLawActivationCount(encoder, device, 'thermal', counts(1, 0, 1), { epsilon: 0.5 }), false);
  const receipt = await closeLawActivationReceiptRing(device);
  assert.equal(receipt.laws.thermal.unrecordedEncodes, 1);
  assert.equal(receipt.laws.thermal.exact, false);
});

test('law scope receipt is inert without a ring or gated stages', async () => {
  const device = fakeDevice();
  assert.equal(encodeLawActivationCount(encoder, device, 'thermal', counts(1, 0, 1)), false);
  assert.equal(await closeLawActivationReceiptRing(device), null);
  openLawActivationReceiptRing(device, { capacityPerLaw: 2 });
  assert.equal(await closeLawActivationReceiptRing(device), null, 'no gated encode, no receipt');
  assert.equal(openLawActivationReceiptRing(null, { capacityPerLaw: 2 }), null);
});
