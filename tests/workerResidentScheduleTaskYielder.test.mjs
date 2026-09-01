import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA,
  createWorkerResidentScheduleControlPlaneTaskYielder,
  workerResidentScheduleControlPlaneYieldNotRequiredReceipt
} from '../src/services/workerResidentScheduleTaskYielder.js';

function fakeMessageChannelHarness({
  throwOnPost = false,
  messageErrorOnPost = false
} = {}) {
  const stats = {
    constructionCount: 0,
    startCount: 0,
    postCount: 0,
    closeCount: 0
  };
  class FakeMessageChannel {
    constructor() {
      stats.constructionCount += 1;
      let messageHandler = null;
      let messageErrorHandler = null;
      this.port1 = {
        get onmessage() { return messageHandler; },
        set onmessage(handler) { messageHandler = handler; },
        get onmessageerror() { return messageErrorHandler; },
        set onmessageerror(handler) { messageErrorHandler = handler; },
        start() { stats.startCount += 1; },
        close() { stats.closeCount += 1; }
      };
      this.port2 = {
        postMessage(data) {
          stats.postCount += 1;
          if (throwOnPost) throw new Error('injected post failure');
          queueMicrotask(() => {
            if (messageErrorOnPost) {
              messageErrorHandler?.({ data });
              return;
            }
            messageHandler?.({ data });
          });
        },
        close() { stats.closeCount += 1; }
      };
    }
  }
  return { FakeMessageChannel, stats };
}

test('resident schedule task yielder reuses one MessageChannel and closes both ports', async () => {
  const { FakeMessageChannel, stats } = fakeMessageChannelHarness();
  let tick = 0;
  const yielder = createWorkerResidentScheduleControlPlaneTaskYielder({
    scheduledYieldOpportunityCount: 2,
    MessageChannelConstructor: FakeMessageChannel,
    clock: () => tick++
  });

  yielder.observeCancellation(1);
  await yielder.yieldTask(2);
  await yielder.yieldTask(3);
  yielder.observeCancellation(3);
  const receipt = yielder.close();

  assert.equal(stats.constructionCount, 1);
  assert.equal(stats.startCount, 1);
  assert.equal(stats.postCount, 2);
  assert.equal(stats.closeCount, 2);
  assert.equal(
    receipt.schema,
    ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA
  );
  assert.equal(receipt.mode, 'message-channel');
  assert.equal(receipt.mechanism, 'message-channel-task');
  assert.equal(receipt.scheduledYieldOpportunityCount, 2);
  assert.equal(receipt.yieldRequestCount, 2);
  assert.equal(receipt.completedYieldCount, 2);
  assert.equal(receipt.messageChannelCreated, true);
  assert.equal(receipt.messageChannelYieldCount, 2);
  assert.equal(receipt.timerFallbackYieldCount, 0);
  assert.equal(receipt.fallbackReason, null);
  assert.equal(receipt.ownedPortCount, 2);
  assert.equal(receipt.closedPortCount, 2);
  assert.equal(receipt.portsClosed, true);
  assert.equal(receipt.totalWaitMs, 2);
  assert.equal(receipt.firstBeforeStepOrdinal, 2);
  assert.equal(receipt.lastBeforeStepOrdinal, 3);
  assert.equal(receipt.cancellationObservedAfterYield, true);
  assert.equal(receipt.cancellationObservedBeforeStepOrdinal, 3);
  assert.ok(Object.isFrozen(receipt));
  assert.strictEqual(yielder.close(), receipt, 'close is idempotent');
  assert.equal(stats.closeCount, 2);
  await assert.rejects(yielder.yieldTask(4), /yielder is closed/);
});

test('resident schedule task yielder falls back to zero-delay timer tasks', async () => {
  const timerDelays = [];
  const taskOrder = [];
  let tick = 0;
  const yielder = createWorkerResidentScheduleControlPlaneTaskYielder({
    scheduledYieldOpportunityCount: 2,
    MessageChannelConstructor: null,
    scheduleTimer(callback, delay) {
      timerDelays.push(delay);
      setTimeout(() => {
        taskOrder.push('yield-timer');
        callback();
      }, delay);
    },
    clock: () => tick++
  });

  setTimeout(() => taskOrder.push('queued-control-plane-task'), 0);
  await yielder.yieldTask(2);
  await yielder.yieldTask(3);
  const receipt = yielder.close();

  assert.deepEqual(timerDelays, [0, 0]);
  assert.deepEqual(taskOrder, [
    'queued-control-plane-task',
    'yield-timer',
    'yield-timer'
  ]);
  assert.equal(receipt.mode, 'timer-fallback');
  assert.equal(receipt.mechanism, 'timer-task-fallback');
  assert.equal(receipt.yieldRequestCount, 2);
  assert.equal(receipt.completedYieldCount, 2);
  assert.equal(receipt.messageChannelCreated, false);
  assert.equal(receipt.messageChannelYieldCount, 0);
  assert.equal(receipt.timerFallbackYieldCount, 2);
  assert.equal(receipt.fallbackReason, 'message-channel-unavailable');
  assert.equal(receipt.ownedPortCount, 0);
  assert.equal(receipt.closedPortCount, 0);
  assert.equal(receipt.portsClosed, true);
});

test('resident schedule task yielder closes a failed channel before timer fallback', async () => {
  const { FakeMessageChannel, stats } = fakeMessageChannelHarness({
    throwOnPost: true
  });
  const timerDelays = [];
  const yielder = createWorkerResidentScheduleControlPlaneTaskYielder({
    scheduledYieldOpportunityCount: 1,
    MessageChannelConstructor: FakeMessageChannel,
    scheduleTimer(callback, delay) {
      timerDelays.push(delay);
      setTimeout(callback, delay);
    }
  });

  let fallbackCompleted = false;
  const pendingYield = yielder.yieldTask(2).then(() => {
    fallbackCompleted = true;
  });
  await Promise.resolve();
  assert.equal(fallbackCompleted, false, 'fallback crosses a real task boundary');
  await pendingYield;
  const receipt = yielder.close();

  assert.equal(stats.constructionCount, 1);
  assert.equal(stats.postCount, 1);
  assert.equal(stats.closeCount, 2);
  assert.deepEqual(timerDelays, [0]);
  assert.equal(receipt.mode, 'timer-fallback');
  assert.equal(receipt.messageChannelCreated, true);
  assert.equal(receipt.messageChannelYieldCount, 0);
  assert.equal(receipt.timerFallbackYieldCount, 1);
  assert.equal(receipt.fallbackReason, 'message-channel-post-failed');
  assert.equal(receipt.ownedPortCount, 2);
  assert.equal(receipt.closedPortCount, 2);
  assert.equal(receipt.portsClosed, true);
});

test('resident schedule task yielder falls back after a MessageChannel message error', async () => {
  const { FakeMessageChannel, stats } = fakeMessageChannelHarness({
    messageErrorOnPost: true
  });
  const timerDelays = [];
  const yielder = createWorkerResidentScheduleControlPlaneTaskYielder({
    scheduledYieldOpportunityCount: 1,
    MessageChannelConstructor: FakeMessageChannel,
    scheduleTimer(callback, delay) {
      timerDelays.push(delay);
      setTimeout(callback, delay);
    }
  });

  await yielder.yieldTask(2);
  const receipt = yielder.close();

  assert.equal(stats.constructionCount, 1);
  assert.equal(stats.postCount, 1);
  assert.equal(stats.closeCount, 2);
  assert.deepEqual(timerDelays, [0]);
  assert.equal(receipt.mode, 'timer-fallback');
  assert.equal(receipt.messageChannelYieldCount, 0);
  assert.equal(receipt.timerFallbackYieldCount, 1);
  assert.equal(receipt.fallbackReason, 'message-channel-message-error');
  assert.equal(receipt.portsClosed, true);
});

test('resident schedule task yielder ignores cancellation labels before a completed yield', () => {
  const { FakeMessageChannel, stats } = fakeMessageChannelHarness();
  const yielder = createWorkerResidentScheduleControlPlaneTaskYielder({
    scheduledYieldOpportunityCount: 2,
    MessageChannelConstructor: FakeMessageChannel
  });

  yielder.observeCancellation(1);
  const receipt = yielder.close();

  assert.equal(receipt.completedYieldCount, 0);
  assert.equal(receipt.cancellationObservedAfterYield, false);
  assert.equal(receipt.cancellationObservedBeforeStepOrdinal, null);
  assert.equal(receipt.closedPortCount, 2);
  assert.equal(receipt.portsClosed, true);
  assert.equal(stats.closeCount, 2);
});

test('resident schedule task yielder rejects concurrent yields and pending close', async () => {
  const { FakeMessageChannel, stats } = fakeMessageChannelHarness();
  const yielder = createWorkerResidentScheduleControlPlaneTaskYielder({
    scheduledYieldOpportunityCount: 2,
    MessageChannelConstructor: FakeMessageChannel
  });

  const firstYield = yielder.yieldTask(2);
  const concurrentYield = yielder.yieldTask(3);
  assert.throws(
    () => yielder.close(),
    /cannot close during a pending yield/
  );
  await assert.rejects(concurrentYield, /already has a pending yield/);
  await firstYield;
  await yielder.yieldTask(3);
  const receipt = yielder.close();

  assert.equal(receipt.yieldRequestCount, 2);
  assert.equal(receipt.completedYieldCount, 2);
  assert.equal(receipt.portsClosed, true);
  assert.equal(stats.closeCount, 2);
});

test('resident schedule no-yield receipts distinguish Tier0 from one canonical step', () => {
  const tier0 = workerResidentScheduleControlPlaneYieldNotRequiredReceipt({
    tier0RouteSelected: true,
    stepCount: 64
  });
  const canonical = workerResidentScheduleControlPlaneYieldNotRequiredReceipt({
    tier0RouteSelected: false,
    stepCount: 1
  });

  assert.equal(tier0.mechanism, 'none-atomic-tier0');
  assert.equal(tier0.reason, 'tier0-atomic-schedule');
  assert.equal(tier0.scheduledYieldOpportunityCount, 0);
  assert.equal(tier0.yieldRequestCount, 0);
  assert.equal(tier0.messageChannelCreated, false);
  assert.equal(tier0.portsClosed, true);
  assert.equal(canonical.mechanism, 'none-single-step-canonical');
  assert.equal(
    canonical.reason,
    'canonical-schedule-has-no-between-step-boundary'
  );
  assert.equal(canonical.scheduledYieldOpportunityCount, 0);
  assert.equal(canonical.yieldRequestCount, 0);
  assert.ok(Object.isFrozen(tier0));
  assert.ok(Object.isFrozen(canonical));
});
