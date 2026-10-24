import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  acquireSphAerosolParcelRead as acquire, validateSphAerosolParcelRead as validate,
  forkSphAerosolParcelRead as fork,
  releaseSphAerosolParcelRead as release, releaseSphAerosolParcelFamily
} from '../src/runtime/sph/sphAerosolParcelGpu.js';
import { fakeAerosolDevice, initialFamily } from './sphAerosolSpatialFixtures.mjs';

test('exact aerosol reads reject copied owners/capabilities and wrong device/generation', async () => {
  const device = fakeAerosolDevice(), family = initialFamily(device);
  const input = { device, family, expectedGeneration: 0 }, read = acquire(input);
  assert.equal(validate(read, input), true);
  assert.equal(Object.isFrozen(read), true);
  assert.equal(read.capacity, 2); assert.equal(read.familyId, family.familyId);
  assert.equal(validate({ ...read }, input), false);
  assert.equal(validate(read, { ...input, expectedGeneration: 1 }), false);
  assert.equal(validate(read, { ...input, device: fakeAerosolDevice() }), false);
  assert.throws(() => acquire({ ...input, family: { ...family } }), /exact live/);
  assert.throws(() => acquire({ ...input, expectedGeneration: 1 }), /generation/);
  assert.throws(() => release({ ...read }), /exact capability/);
  assert.equal(release(read), true); assert.equal(release(read), false);
  assert.equal(validate(read, input), false);
  releaseSphAerosolParcelFamily(family); await device.finishQueue();
  assert.ok(device.buffers.every((buffer) => buffer.destroyed === 1));
});

test('existing borrowed read outlives family release until its own queue fence', async () => {
  const device = fakeAerosolDevice(), family = initialFamily(device);
  const input = { device, family, expectedGeneration: 0 }, read = acquire(input);
  releaseSphAerosolParcelFamily(family);
  assert.throws(() => acquire(input), /exact live/);
  await device.finishQueue();
  assert.equal(read.buffer.destroyed, 0); assert.equal(validate(read, input), true);
  release(read); assert.equal(read.buffer.destroyed, 0);
  await device.finishQueue(); assert.equal(read.buffer.destroyed, 1);
});

for (const failure of ['throw', 'reject']) test(`aerosol read ${failure} fence quarantines until confirmed device loss`, async () => {
  const device = fakeAerosolDevice(), family = initialFamily(device);
  await device.finishQueue();
  const input = { device, family, expectedGeneration: 0 };
  const read = acquire(input), other = acquire(input);
  releaseSphAerosolParcelFamily(family);
  device.fenceFailure = failure; release(read);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(read.buffer.destroyed, 0); assert.equal(validate(other, input), false);
  await device.lose(); assert.equal(read.buffer.destroyed, 1);
  assert.equal(release(other), false); await device.finishQueue();
  assert.equal(read.buffer.destroyed, 1);
});

test('confirmed device loss drains outstanding read borrows without a caller release', async () => {
  const device = fakeAerosolDevice(), family = initialFamily(device);
  await device.finishQueue();
  const input = { device, family, expectedGeneration: 0 }, a = acquire(input), b = acquire(input);
  await device.lose();
  assert.equal(validate(a, input), false); assert.equal(validate(b, input), false);
  assert.equal(a.buffer.destroyed, 1); assert.equal(release(a), false);
  await device.finishQueue(); assert.equal(a.buffer.destroyed, 1);
});

test('a live retained owner forks exact reads after original family release without reviving a retired parent', async () => {
  const device = fakeAerosolDevice(), family = initialFamily(device);
  const input = { device, family, expectedGeneration: 0 }, parent = acquire(input);
  releaseSphAerosolParcelFamily(family); await device.finishQueue();
  assert.throws(() => acquire(input), /exact live/);
  assert.throws(() => fork({ ...parent }, input), /exact live parent/);
  assert.throws(() => fork(parent, { ...input, device: fakeAerosolDevice() }), /exact live parent/);
  assert.throws(() => fork(parent, { ...input, expectedGeneration: 1 }), /exact live parent/);
  const child = fork(parent, input);
  assert.notEqual(child, parent); assert.equal(child.buffer, parent.buffer);
  release(parent); await device.finishQueue();
  assert.equal(child.buffer.destroyed, 0); assert.equal(validate(child, input), true);
  assert.throws(() => fork(parent, input), /exact live parent/);
  release(child); await device.finishQueue(); assert.equal(child.buffer.destroyed, 1);
});
