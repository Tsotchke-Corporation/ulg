import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForWorkerPresentationOpportunity } from '../src/services/workerPresentationOpportunity.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
}

function fakePlatform() {
  const frames = new Map();
  const timers = new Map();
  const cancelledFrames = [];
  const clearedTimers = [];
  let nextHandle = 0;
  let clockMs = 0;
  let frameRegistrations = 0;
  const platform = {
    requestAnimationFrame(callback) {
      frameRegistrations += 1;
      const handle = ++nextHandle;
      frames.set(handle, callback);
      return handle;
    },
    cancelAnimationFrame(handle) { cancelledFrames.push(handle); frames.delete(handle); },
    setTimeout(callback, delay) {
      const handle = ++nextHandle;
      timers.set(handle, { callback, delay, dueAtMs: clockMs + delay });
      return handle;
    },
    clearTimeout(handle) { clearedTimers.push(handle); timers.delete(handle); },
    now: () => clockMs
  };
  return {
    platform, frames, timers, cancelledFrames, clearedTimers,
    get frameRegistrations() { return frameRegistrations; },
    setClock(value) { clockMs = value; },
    fireFrame(timestamp = clockMs) {
      const next = frames.entries().next().value;
      assert.ok(next, 'one pending frame callback exists');
      frames.delete(next[0]);
      next[1](timestamp);
    },
    fireTimer() {
      const next = timers.entries().next().value;
      assert.ok(next, 'one pending post-GPU timer exists');
      timers.delete(next[0]);
      next[1].callback();
    }
  };
}

test('prearmed opportunity accepts an already-pending callback only after the exact GPU fence fulfills', async () => {
  const gpu = deferred();
  const fake = fakePlatform();
  let settled = false;
  const waiting = waitForWorkerPresentationOpportunity({ afterGpuCompletion: gpu.promise }, fake.platform);
  void waiting.then(() => { settled = true; });
  assert.equal(fake.frames.size, 1, 'callback is armed while the GPU fence remains pending');
  assert.equal(fake.timers.size, 0);
  assert.equal(settled, false);
  fake.setClock(100);
  gpu.resolve();
  await flushMicrotasks();
  assert.equal(settled, false, 'GPU completion alone is not a presentation opportunity');
  assert.equal(fake.frames.size, 1);
  assert.equal(fake.frameRegistrations, 1, 'the pending callback is reused, not registered again');
  assert.equal(fake.timers.size, 1);
  fake.setClock(110);
  fake.fireFrame(1);
  const proof = await waiting;
  assert.equal(proof.available, true);
  assert.equal(proof.method, 'worker-request-animation-frame-after-gpu-completion');
  assert.equal(proof.observedAtMs, 110, 'actual callback delivery clock wins over its old RAF timestamp');
  assert.ok(Object.isFrozen(proof));
  assert.equal(fake.frames.size, 0);
  assert.equal(fake.timers.size, 0);
});

test('prearmed early callback cannot admit or spin while GPU work is pending and needs a fresh post-GPU callback', async () => {
  const gpu = deferred();
  const fake = fakePlatform();
  let settled = false;
  const waiting = waitForWorkerPresentationOpportunity({ afterGpuCompletion: gpu.promise }, fake.platform);
  void waiting.then(() => { settled = true; });
  fake.setClock(20);
  fake.fireFrame(1e9);
  await flushMicrotasks();
  assert.equal(settled, false, 'even a future RAF timestamp cannot prove incomplete GPU work');
  assert.equal(fake.frames.size, 0);
  assert.equal(fake.frameRegistrations, 1);
  assert.equal(fake.timers.size, 0);
  fake.setClock(10000);
  await flushMicrotasks();
  assert.equal(fake.frameRegistrations, 1, 'no pending-GPU RAF polling loop');
  gpu.resolve();
  await flushMicrotasks();
  assert.equal(settled, false);
  assert.equal(fake.frames.size, 1);
  assert.equal(fake.frameRegistrations, 2);
  assert.equal(fake.timers.size, 1);
  fake.setClock(10001);
  fake.fireFrame();
  assert.equal((await waiting).available, true);
  assert.equal(fake.timers.size, 0);
});

test('prearmed timeout budget starts after GPU completion and cancels the undelivered callback', async () => {
  const gpu = deferred();
  const fake = fakePlatform();
  const waiting = waitForWorkerPresentationOpportunity({ afterGpuCompletion: gpu.promise, timeoutMs: 75 }, fake.platform);
  fake.setClock(50000);
  assert.equal(fake.timers.size, 0, 'slow GPU work does not consume the browser opportunity timeout');
  gpu.resolve();
  await flushMicrotasks();
  assert.deepEqual([...fake.timers.values()].map(timer => [timer.delay, timer.dueAtMs]), [[75, 50075]]);
  fake.setClock(50075);
  fake.fireTimer();
  const receipt = await waiting;
  assert.equal(receipt.available, false);
  assert.equal(receipt.method, 'worker-request-animation-frame-timeout');
  assert.equal(fake.frames.size, 0);
  assert.equal(fake.timers.size, 0);
  assert.equal(fake.cancelledFrames.length, 1);
});

for (const ageMs of [74, 75, 100]) {
  test(`prearmed delivery at post-GPU age ${ageMs} ms uses the deadline even when its timer task has not run`, async () => {
    const gpu = deferred();
    const fake = fakePlatform();
    const waiting = waitForWorkerPresentationOpportunity({ afterGpuCompletion: gpu.promise, timeoutMs: 75 }, fake.platform);
    fake.setClock(1000);
    gpu.resolve();
    await flushMicrotasks();
    fake.setClock(1000 + ageMs);
    fake.fireFrame(1001);
    const receipt = await waiting;
    assert.equal(receipt.available, ageMs < 75);
    assert.equal(receipt.method, ageMs < 75
      ? 'worker-request-animation-frame-after-gpu-completion'
      : 'worker-request-animation-frame-timeout');
    assert.equal(fake.timers.size, 0);
    assert.equal(fake.frames.size, 0);
  });
}

for (const phase of ['before arm', 'before GPU', 'after GPU']) {
  test(`prearmed abort ${phase} cleans callbacks and timers without presentation evidence`, async () => {
    const gpu = deferred();
    const fake = fakePlatform();
    const controller = new AbortController();
    if (phase === 'before arm') controller.abort();
    const waiting = waitForWorkerPresentationOpportunity({ afterGpuCompletion: gpu.promise,
      signal: controller.signal }, fake.platform);
    if (phase === 'after GPU') {
      gpu.resolve();
      await flushMicrotasks();
      assert.equal(fake.timers.size, 1);
    }
    controller.abort();
    const receipt = await waiting;
    assert.equal(receipt.available, false);
    assert.equal(receipt.method, 'worker-request-animation-frame-aborted');
    assert.equal(fake.frames.size, 0);
    assert.equal(fake.timers.size, 0);
    gpu.resolve();
    await flushMicrotasks();
    assert.equal(fake.frames.size, 0, 'later fence fulfillment cannot resurrect an aborted observer');
  });
}

for (const phase of ['before arm', 'at GPU completion', 'at callback', 'at timeout']) {
  test(`prearmed stale lifecycle ${phase} cannot admit and cleans owned resources`, async () => {
    const gpu = deferred();
    const fake = fakePlatform();
    let current = phase !== 'before arm';
    const waiting = waitForWorkerPresentationOpportunity({ afterGpuCompletion: gpu.promise,
      isCurrent: () => current }, fake.platform);
    if (phase === 'at GPU completion') current = false;
    gpu.resolve();
    await flushMicrotasks();
    if (phase === 'at callback') { current = false; fake.fireFrame(); }
    if (phase === 'at timeout') { current = false; fake.setClock(75); fake.fireTimer(); }
    const receipt = await waiting;
    assert.equal(receipt.available, false);
    assert.equal(receipt.method, 'worker-request-animation-frame-stale');
    assert.equal(fake.frames.size, 0);
    assert.equal(fake.timers.size, 0);
  });
}

test('prearmed throwing lifetime predicate is stale rather than a detached rejection', async () => {
  const fake = fakePlatform();
  const receipt = await waitForWorkerPresentationOpportunity({ afterGpuCompletion: Promise.resolve(),
    isCurrent() { throw new Error('lost owner'); } }, fake.platform);
  assert.equal(receipt.available, false);
  assert.equal(receipt.method, 'worker-request-animation-frame-stale');
  assert.equal(fake.frames.size, 0);
  assert.equal(fake.timers.size, 0);
});

for (const abortFirst of [false, true]) {
  test(`prearmed GPU rejection is handled immediately${abortFirst ? ' even after early abort' : ' before anyone awaits the opportunity'}`, async () => {
    const fake = fakePlatform();
    const gpu = deferred();
    const reason = new Error('exact GPU fence failed');
    const controller = new AbortController();
    const unhandled = [];
    const listener = reason => unhandled.push(reason);
    process.on('unhandledRejection', listener);
    try {
      const waiting = waitForWorkerPresentationOpportunity({ afterGpuCompletion: gpu.promise,
        signal: controller.signal }, fake.platform);
      if (abortFirst) controller.abort();
      gpu.reject(reason);
      await new Promise(resolve => setImmediate(resolve));
      const receipt = await waiting;
      assert.equal(receipt.available, false);
      assert.equal(receipt.method, abortFirst
        ? 'worker-request-animation-frame-aborted' : 'worker-gpu-completion-failed');
      assert.deepEqual(unhandled, []);
      await assert.rejects(gpu.promise, error => error === reason,
        'the original fence rejection remains available to its authority-bearing caller');
      assert.equal(fake.frames.size, 0);
      assert.equal(fake.timers.size, 0);
    } finally {
      process.off('unhandledRejection', listener);
    }
  });
}

for (const missing of [undefined, null, {}, 1]) {
  test(`prearmed missing exact GPU completion ${String(missing)} fails closed`, async () => {
    const fake = fakePlatform();
    const receipt = await waitForWorkerPresentationOpportunity({ afterGpuCompletion: missing }, fake.platform);
    assert.equal(receipt.available, false);
    assert.equal(receipt.method, 'worker-gpu-completion-unavailable');
    assert.equal(fake.frames.size, 0);
    assert.equal(fake.timers.size, 0);
  });
}

for (const throws of [false, true]) {
  test(`prearmed ${throws ? 'throwing' : 'missing'} RAF is unavailable and cannot hide a later GPU rejection`, async () => {
    const fake = fakePlatform();
    const gpu = deferred();
    fake.platform.requestAnimationFrame = throws ? () => { throw new Error('RAF unavailable'); } : undefined;
    const waiting = waitForWorkerPresentationOpportunity({ afterGpuCompletion: gpu.promise }, fake.platform);
    assert.equal((await waiting).method, 'worker-request-animation-frame-unavailable');
    gpu.reject(new Error('later queue failure'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fake.frames.size, 0);
    assert.equal(fake.timers.size, 0);
  });
}

for (const phase of ['GPU completion', 'callback']) {
  for (const badClock of [NaN, Infinity, 'throw']) {
    test(`prearmed ${phase} with ${String(badClock)} delivery clock fails closed without fabricating time`, async () => {
      const fake = fakePlatform();
      const gpu = deferred();
      const waiting = waitForWorkerPresentationOpportunity({ afterGpuCompletion: gpu.promise }, fake.platform);
      const invalidateClock = () => {
        fake.platform.now = () => {
          if (badClock === 'throw') throw new Error('clock unavailable');
          return badClock;
        };
      };
      if (phase === 'GPU completion') invalidateClock();
      gpu.resolve();
      await flushMicrotasks();
      if (phase === 'callback') { invalidateClock(); fake.fireFrame(1234); }
      const receipt = await waiting;
      assert.equal(receipt.available, false);
      assert.equal(receipt.method, 'worker-request-animation-frame-unavailable');
      assert.equal(receipt.observedAtMs, null);
      assert.equal(fake.frames.size, 0);
      assert.equal(fake.timers.size, 0);
    });
  }
}
