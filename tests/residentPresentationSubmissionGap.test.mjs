import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hasResidentPresentationSubmissionGap,
  registerResidentPresentationSubmissionGap,
  requestResidentPresentationSubmissionGap
} from '../src/runtime/sph/residentPresentationSubmissionGap.js';

test('submission gaps are exact-device scoped, queried without presenting, and unregister once', async () => {
  const device = {};
  let calls = 0;
  const unregister = registerResidentPresentationSubmissionGap(device, {
    isCurrent: () => true, isReady: () => true,
    present: async () => { calls += 1; return true; }
  });
  assert.equal(hasResidentPresentationSubmissionGap(device), true);
  assert.equal(hasResidentPresentationSubmissionGap({}), false);
  assert.equal(calls, 0);
  assert.equal(await requestResidentPresentationSubmissionGap({}), false);
  assert.equal(await requestResidentPresentationSubmissionGap(device), true);
  assert.equal(calls, 1);
  assert.equal(unregister(), true);
  assert.equal(unregister(), false);
  assert.equal(hasResidentPresentationSubmissionGap(device), false);
});

test('replacement aborts old requests and old unregister cannot retire the new owner', async () => {
  const device = {};
  let oldSignal;
  let finishOld;
  const unregisterOld = registerResidentPresentationSubmissionGap(device, {
    isCurrent: () => true, isReady: () => true,
    present: ({ signal }) => {
      oldSignal = signal;
      return new Promise((resolve) => { finishOld = resolve; });
    }
  });
  const oldRequest = requestResidentPresentationSubmissionGap(device);
  const unregisterNew = registerResidentPresentationSubmissionGap(device, {
    isCurrent: () => true, isReady: () => true, present: async () => true
  });
  assert.equal(oldSignal.aborted, true);
  assert.equal(unregisterOld(), false);
  assert.equal(await requestResidentPresentationSubmissionGap(device), true);
  finishOld(true);
  assert.equal(await oldRequest, false);
  assert.equal(unregisterNew(), true);
});

test('paused, stale, throwing and nonboolean readiness never invoke presentation', async () => {
  for (const callbacks of [
    { isCurrent: () => false, isReady: () => true },
    { isCurrent: () => true, isReady: () => false },
    { isCurrent: () => { throw Error('retired'); }, isReady: () => true },
    { isCurrent: () => true, isReady: () => Promise.resolve(true) }
  ]) {
    const device = {};
    const unregister = registerResidentPresentationSubmissionGap(device, {
      ...callbacks, present: () => assert.fail('must not present')
    });
    assert.equal(hasResidentPresentationSubmissionGap(device), false);
    assert.equal(await requestResidentPresentationSubmissionGap(device), false);
    unregister();
  }
});

test('in-flight requests coalesce, propagate cancellation and ignore stale acknowledgments', async () => {
  const device = {};
  const controller = new AbortController();
  let finish;
  let callbackSignal;
  const unregister = registerResidentPresentationSubmissionGap(device, {
    isCurrent: () => true, isReady: () => true,
    present: ({ signal }) => {
      callbackSignal = signal;
      return new Promise((resolve) => { finish = resolve; });
    }
  });
  const request = requestResidentPresentationSubmissionGap(device, { signal: controller.signal });
  assert.equal(await requestResidentPresentationSubmissionGap(device), false);
  controller.abort();
  assert.equal(callbackSignal.aborted, true);
  finish(true);
  assert.equal(await request, false);
  assert.equal(await requestResidentPresentationSubmissionGap(device, { signal: controller.signal }), false);
  unregister();
});

test('unregister aborts its pending request; callback failures and objects are not submission proofs', async () => {
  const device = {};
  let signal;
  let finish;
  const unregister = registerResidentPresentationSubmissionGap(device, {
    isCurrent: () => true, isReady: () => true,
    present: (options) => {
      signal = options.signal;
      return new Promise((resolve) => { finish = resolve; });
    }
  });
  const request = requestResidentPresentationSubmissionGap(device);
  unregister();
  assert.equal(signal.aborted, true);
  finish(true);
  assert.equal(await request, false);
  for (const present of [async () => { throw Error('optional frame'); }, async () => ({ submitted: true })]) {
    const end = registerResidentPresentationSubmissionGap(device, {
      isCurrent: () => true, isReady: () => true, present
    });
    assert.equal(await requestResidentPresentationSubmissionGap(device), false);
    end();
  }
});

test('malformed device or callbacks cannot register a gap', () => {
  assert.throws(() => registerResidentPresentationSubmissionGap(null, {}), TypeError);
  assert.throws(() => registerResidentPresentationSubmissionGap({}, {}), TypeError);
});

test('submission acknowledgment survives newly occupied readiness and keeps proof signal live until retirement', async () => {
  const device = {};
  let ready = true;
  let signal;
  const unregister = registerResidentPresentationSubmissionGap(device, {
    isCurrent: () => true, isReady: () => ready,
    present: async (options) => { signal = options.signal; ready = false; return true; }
  });
  assert.equal(await requestResidentPresentationSubmissionGap(device), true);
  assert.equal(signal.aborted, false);
  assert.equal(hasResidentPresentationSubmissionGap(device), false);
  unregister();
  assert.equal(signal.aborted, true);
});

test('ordinary readiness stays nonwaiting while only an exact final request can use busy-slot eligibility', async () => {
  const device = {};
  let busy = false;
  let eligible = true;
  const readinessOptions = [];
  const presentOptions = [];
  const unregister = registerResidentPresentationSubmissionGap(device, {
    isCurrent: () => true,
    isReady(options) {
      readinessOptions.push(options);
      return eligible && (!busy || options?.waitForPendingSlot === true);
    },
    async present({ waitForPendingSlot }) {
      presentOptions.push(waitForPendingSlot);
      busy = true;
      return true;
    }
  });
  try {
    assert.equal(hasResidentPresentationSubmissionGap(device), true);
    assert.deepEqual(readinessOptions[0], { waitForPendingSlot: false });
    assert.equal(await requestResidentPresentationSubmissionGap(device), true);
    assert.equal(hasResidentPresentationSubmissionGap(device), false);
    assert.equal(await requestResidentPresentationSubmissionGap(device), false);
    assert.equal(await requestResidentPresentationSubmissionGap(device, { waitForPendingSlot: true }), true);
    assert.deepEqual(presentOptions, [false, true]);
    eligible = false;
    assert.equal(await requestResidentPresentationSubmissionGap(device, { waitForPendingSlot: true }), false,
      'final waiting cannot bypass spent/stale intrinsic eligibility');
  } finally { unregister(); }
});

test('malformed waiting flags fail closed before readiness or presentation', async () => {
  const device = {};
  let readinessCalls = 0;
  let presentationCalls = 0;
  const unregister = registerResidentPresentationSubmissionGap(device, {
    isCurrent: () => true,
    isReady: () => { readinessCalls++; return true; },
    present: async () => { presentationCalls++; return true; }
  });
  try {
    for (const waitForPendingSlot of [null, 0, 1, 'true', {}, [], NaN]) {
      assert.equal(await requestResidentPresentationSubmissionGap(device, { waitForPendingSlot }), false);
    }
    assert.equal(readinessCalls, 0);
    assert.equal(presentationCalls, 0);
  } finally { unregister(); }
});

test('final waiting requests remain single-pending and retirement cannot authorize a late acknowledgment', async () => {
  const device = {};
  let finish;
  let requestSignal;
  let calls = 0;
  const unregister = registerResidentPresentationSubmissionGap(device, {
    isCurrent: () => true,
    isReady: (options) => options?.waitForPendingSlot === true,
    present({ signal, waitForPendingSlot }) {
      assert.equal(waitForPendingSlot, true);
      calls++;
      requestSignal = signal;
      return new Promise(resolve => { finish = resolve; });
    }
  });
  const waiting = requestResidentPresentationSubmissionGap(device, { waitForPendingSlot: true });
  assert.equal(calls, 1);
  assert.equal(await requestResidentPresentationSubmissionGap(device, { waitForPendingSlot: true }), false);
  assert.equal(unregister(), true);
  assert.equal(requestSignal.aborted, true);
  finish(true);
  assert.equal(await waiting, false);
  assert.equal(calls, 1);
});

test('a final readiness callback that replaces its registration never invokes the retired presenter', async () => {
  const device = {};
  let unregisterNext;
  const unregisterOld = registerResidentPresentationSubmissionGap(device, {
    isCurrent: () => true,
    isReady() {
      unregisterNext = registerResidentPresentationSubmissionGap(device, {
        isCurrent: () => true, isReady: () => true, present: async () => true
      });
      return true;
    },
    present: () => assert.fail('retired registration must not be called')
  });
  assert.equal(await requestResidentPresentationSubmissionGap(device, { waitForPendingSlot: true }), false);
  assert.equal(unregisterOld(), false);
  assert.equal(await requestResidentPresentationSubmissionGap(device, { waitForPendingSlot: true }), true);
  unregisterNext();
});

test('a final request rechecks eligibility before invoking the presenter', async () => {
  const device = {};
  let readinessCalls = 0;
  let presentationCalls = 0;
  const unregister = registerResidentPresentationSubmissionGap(device, {
    isCurrent: () => true,
    isReady: ({ waitForPendingSlot }) => waitForPendingSlot && ++readinessCalls === 1,
    present: async () => { presentationCalls++; return true; }
  });
  try {
    assert.equal(await requestResidentPresentationSubmissionGap(device, { waitForPendingSlot: true }), false);
    assert.equal(readinessCalls, 2);
    assert.equal(presentationCalls, 0, 'an earlier eligibility query cannot authorize spent/stale work');
  } finally { unregister(); }
});
