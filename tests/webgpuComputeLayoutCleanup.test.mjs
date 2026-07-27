import test from 'node:test';
import assert from 'node:assert/strict';

import { deferSubmittedWorkCleanup } from '../src/runtime/webgpuComputeLayout.js';

function fenceDevice() {
  const resolvers = [];
  let created = 0;
  return {
    fencesCreated: () => created,
    async settleAll() {
      const pending = resolvers.splice(0, resolvers.length);
      for (const resolve of pending) resolve();
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
    },
    device: {
      queue: {
        onSubmittedWorkDone() {
          created += 1;
          return new Promise((resolve) => { resolvers.push(resolve); });
        }
      }
    }
  };
}

test('a device without a queue fence runs cleanup immediately', () => {
  let ran = 0;
  assert.equal(deferSubmittedWorkCleanup({}, () => { ran += 1; }), false);
  assert.equal(ran, 1);
});

test('a non-function cleanup is refused rather than scheduled', () => {
  const fake = fenceDevice();
  assert.equal(deferSubmittedWorkCleanup(fake.device, null), false);
  assert.equal(fake.fencesCreated(), 0);
});

test('a cleanup runs only after its own fence resolves', () => {
  const fake = fenceDevice();
  const ran = [];
  assert.equal(deferSubmittedWorkCleanup(fake.device, () => ran.push('released')), true);
  assert.equal(fake.fencesCreated(), 1);
  assert.deepEqual(ran, [], 'the buffer is still in use until the device goes idle');
});

test('each registration gets its own fence, and releases immediately on it', async () => {
  // This is load-bearing, not incidental. Arena leases are released through
  // this helper, so a release delayed behind another cleanup's fence lets the
  // next substep reach `acquire` while the lease is still held -- "Thermal
  // proposal arena 0 is still leased by generation 1", which is what happened
  // when these were coalesced onto a shared fence. See the note on the helper.
  const fake = fenceDevice();
  const ran = [];
  deferSubmittedWorkCleanup(fake.device, () => ran.push('first'));
  deferSubmittedWorkCleanup(fake.device, () => ran.push('second'));
  assert.equal(fake.fencesCreated(), 2);
  await fake.settleAll();
  assert.deepEqual(ran, ['first', 'second'], 'neither waits on the other');
});

test('a rejected fence still releases its cleanup', async () => {
  // Device loss rejects the fence. The buffers and leases still need releasing.
  const rejecters = [];
  const device = {
    queue: {
      onSubmittedWorkDone() {
        return new Promise((_, reject) => { rejecters.push(reject); });
      }
    }
  };
  const ran = [];
  deferSubmittedWorkCleanup(device, () => ran.push('released'));
  rejecters[0](new Error('device lost'));
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
  assert.deepEqual(ran, ['released']);
});

test('a queue that cannot schedule a fence surfaces the failure to its caller', () => {
  const device = {
    queue: {
      onSubmittedWorkDone() {
        throw new Error('injected fence scheduling failure');
      }
    }
  };
  assert.throws(
    () => deferSubmittedWorkCleanup(device, () => {}),
    /injected fence scheduling failure/
  );
});
