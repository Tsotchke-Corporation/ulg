import test from 'node:test';
import assert from 'node:assert/strict';

import { deferSubmittedWorkCleanup } from '../src/runtime/webgpuComputeLayout.js';

function fenceDevice() {
  const resolvers = [];
  let created = 0;
  return {
    // Total fences ever opened, not the outstanding count: settling shifts one
    // off, so an outstanding count cannot tell "reused" from "opened another".
    fencesCreated: () => created,
    outstanding: () => resolvers.length,
    // Resolve the oldest outstanding fence and let its callbacks run.
    async settleOldest() {
      const resolve = resolvers.shift();
      assert.ok(resolve, 'expected an outstanding fence to settle');
      resolve();
      // .catch().finally() plus the cleanup loop take a few microtask turns.
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
    },
    device: {
      queue: {
        onSubmittedWorkDone() {
          created += 1;
          return new Promise((resolve) => {
            resolvers.push(resolve);
          });
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

test('cleanups registered while a fence is in flight share the next fence', async () => {
  // The measured regression: 161 registrations in one production batch created
  // 161 fences, all waiting for the same device idle point.
  const fake = fenceDevice();
  const ran = [];
  deferSubmittedWorkCleanup(fake.device, () => ran.push('a'));
  // One fence so far, and 'a' owns it.
  assert.equal(fake.fencesCreated(), 1);
  for (let i = 0; i < 160; i += 1) {
    deferSubmittedWorkCleanup(fake.device, () => ran.push(`b${i}`));
  }
  // Still one: the 160 newcomers did not each open a fence.
  assert.equal(fake.fencesCreated(), 1);
  assert.deepEqual(ran, []);

  await fake.settleOldest();
  assert.deepEqual(ran, ['a'], 'only the first batch runs on the first fence');
  // Exactly one more fence for all 160, not 160 more.
  assert.equal(fake.fencesCreated(), 2);

  await fake.settleOldest();
  assert.equal(ran.length, 161);
  assert.equal(ran[160], 'b159');
  // Nothing pending, so no further fence is opened.
  assert.equal(fake.fencesCreated(), 2);
  assert.equal(fake.outstanding(), 0);
});

test('a cleanup never runs on a fence that predates its registration', async () => {
  // This is the safety rule the coalescing has to preserve: attaching a late
  // registration to an already-outstanding fence could free a buffer while the
  // device is still reading it.
  const fake = fenceDevice();
  const ran = [];
  deferSubmittedWorkCleanup(fake.device, () => ran.push('early'));
  deferSubmittedWorkCleanup(fake.device, () => ran.push('late'));
  await fake.settleOldest();
  assert.deepEqual(ran, ['early'], 'the late registration must wait for its own fence');
  await fake.settleOldest();
  assert.deepEqual(ran, ['early', 'late']);
});

test('a throwing cleanup does not strand its batch, and is reported', async () => {
  const fake = fenceDevice();
  const ran = [];
  const reported = [];
  const realError = console.error;
  console.error = (...args) => reported.push(args[0]);
  try {
    // The first registration opens a fence and owns it alone. The next two
    // arrive while it is in flight, so they share the second batch -- which is
    // the case that matters: a throw from one must not strand the other, since
    // these are buffer releases and one bad one would leak everything queued
    // behind it.
    deferSubmittedWorkCleanup(fake.device, () => ran.push('opener'));
    deferSubmittedWorkCleanup(fake.device, () => { throw new Error('cleanup blew up'); });
    deferSubmittedWorkCleanup(fake.device, () => ran.push('sibling'));
    assert.equal(fake.fencesCreated(), 1);
    await fake.settleOldest();
    assert.deepEqual(ran, ['opener']);
    await fake.settleOldest();
  } finally {
    console.error = realError;
  }
  assert.deepEqual(ran, ['opener', 'sibling']);
  assert.equal(reported.length, 1);
  assert.match(String(reported[0]), /deferred submitted-work cleanup threw/);
});

test('a rejected fence still releases its batch', async () => {
  // Device loss rejects the fence. The buffers still need releasing.
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

test('separate devices keep separate queues', async () => {
  const one = fenceDevice();
  const two = fenceDevice();
  const ran = [];
  deferSubmittedWorkCleanup(one.device, () => ran.push('one'));
  deferSubmittedWorkCleanup(two.device, () => ran.push('two'));
  assert.equal(one.fencesCreated(), 1);
  assert.equal(two.fencesCreated(), 1);
  await one.settleOldest();
  assert.deepEqual(ran, ['one'], 'settling one device must not release the other');
  await two.settleOldest();
  assert.deepEqual(ran, ['one', 'two']);
});

test('a queue that cannot schedule a fence releases now and tells the caller', () => {
  // Coalescing introduced shared state, which made this path dangerous: an
  // early return with inFlight still set would strand every later cleanup on
  // the device, since nothing would ever arrive to clear it.
  const device = {
    queue: {
      onSubmittedWorkDone() {
        throw new Error('injected fence scheduling failure');
      }
    }
  };
  const ran = [];
  assert.throws(
    () => deferSubmittedWorkCleanup(device, () => ran.push('released')),
    /injected fence scheduling failure/
  );
  // Released rather than leaked, even though the fence could not be scheduled.
  assert.deepEqual(ran, ['released']);
  // And the queue is not poisoned: the next registration is still attempted.
  assert.throws(
    () => deferSubmittedWorkCleanup(device, () => ran.push('second')),
    /injected fence scheduling failure/
  );
  assert.deepEqual(ran, ['released', 'second']);
});

test('a fence failure inside the resolve callback is logged, not left unhandled', async () => {
  // Same failure one turn later, where there is no caller left to throw to.
  let calls = 0;
  const resolvers = [];
  const device = {
    queue: {
      onSubmittedWorkDone() {
        calls += 1;
        if (calls > 1) throw new Error('injected late fence failure');
        return new Promise((resolve) => resolvers.push(resolve));
      }
    }
  };
  const ran = [];
  const reported = [];
  const realError = console.error;
  console.error = (...args) => reported.push(args[0]);
  try {
    deferSubmittedWorkCleanup(device, () => ran.push('first'));
    deferSubmittedWorkCleanup(device, () => ran.push('second'));
    resolvers[0]();
    for (let turn = 0; turn < 16; turn += 1) await Promise.resolve();
  } finally {
    console.error = realError;
  }
  assert.deepEqual(ran, ['first', 'second'], 'the second batch is still released');
  assert.equal(reported.length, 1);
  assert.match(String(reported[0]), /could not schedule a submitted-work fence/);
});
