import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_RESIDENT_BUFFER_LEASE_LEDGER_SCHEMA,
  addResidentBufferLease,
  canDestroyResidentBuffer,
  createResidentBufferLeaseLedger,
  destroyResidentBufferWithLease,
  registerResidentBufferResource,
  releaseResidentBufferLease,
  residentProductMassResourceKey,
  summarizeResidentBufferLeaseLedger
} from '../src/runtime/residentBufferLease.js';

test('resident buffer lease ledger blocks destroy while a consumer lease is active', () => {
  const ledger = createResidentBufferLeaseLedger({
    ledgerId: 'lease-test',
    step: 4
  });
  registerResidentBufferResource(ledger, {
    resourceKey: 'product-events:a',
    resourceKind: 'resident-product-event-buffer',
    stateFamily: 'reaction-products',
    ownerStage: 'reaction-step',
    byteLength: 256,
    rowCount: 2,
    expectedConsumers: ['next-p2g']
  });
  const lease = addResidentBufferLease(ledger, {
    resourceKey: 'product-events:a',
    consumerStage: 'next-p2g',
    reason: 'borrowed-product-events'
  });
  let destroyed = false;

  assert.equal(ledger.schema, ULG_RESIDENT_BUFFER_LEASE_LEDGER_SCHEMA);
  assert.equal(canDestroyResidentBuffer(ledger, 'product-events:a').canDestroy, false);
  const skipped = destroyResidentBufferWithLease(ledger, 'product-events:a', () => {
    destroyed = true;
  });
  assert.equal(skipped.status, 'destroy-skipped-active-lease');
  assert.equal(destroyed, false);
  assert.equal(ledger.status, 'resident-buffer-lease-ledger-active');

  releaseResidentBufferLease(ledger, lease.leaseId);
  const destroyedEvent = destroyResidentBufferWithLease(ledger, 'product-events:a', () => {
    destroyed = true;
  });
  assert.equal(destroyedEvent.status, 'destroyed');
  assert.equal(destroyed, true);
  assert.equal(ledger.status, 'resident-buffer-lease-ledger-cleaned');
});

test('resident product-mass resource keys are stable across equivalent handles', () => {
  const handle = {
    source: 'reaction-step',
    status: 'resident-product-mass-buffer-retained',
    productEventBuffer: { label: 'product-events' },
    productEventRowCount: 8,
    productEventBufferByteLength: 1024
  };

  assert.equal(
    residentProductMassResourceKey('resident-product-mass', handle),
    'resident-product-mass:product-events:8:1024'
  );
});

test('resident buffer lease summary exposes compact resource and event counts', () => {
  const ledger = createResidentBufferLeaseLedger();
  registerResidentBufferResource(ledger, {
    resourceKey: 'compact-summary:ready',
    resourceKind: 'compact-diagnostic-summary',
    stateFamily: 'diagnostics',
    retained: false,
    byteLength: 128
  });
  const event = destroyResidentBufferWithLease(ledger, 'compact-summary:ready', null);
  const summary = summarizeResidentBufferLeaseLedger(ledger);

  assert.equal(event.status, 'destroy-noop-no-destroy-fn');
  assert.equal(summary.resourceCount, 1);
  assert.equal(summary.events.length, 1);
  assert.equal(summary.resources['compact-summary:ready'].destroyStatus, 'destroy-noop-no-destroy-fn');
});

test('resident buffer lease ledger reports asynchronous owner completion truthfully', async () => {
  for (const outcome of ['released', 'refused', 'rejected']) {
    const ledger = createResidentBufferLeaseLedger({
      ledgerId: `async-owner-${outcome}`
    });
    const resourceKey = `product-events:${outcome}`;
    registerResidentBufferResource(ledger, {
      resourceKey,
      resourceKind: 'resident-product-event-buffer'
    });
    let settle;
    const ownerCompletion = new Promise((resolve, reject) => {
      settle = outcome === 'rejected' ? reject : resolve;
    });
    const event = destroyResidentBufferWithLease(
      ledger,
      resourceKey,
      () => ownerCompletion,
      { reason: 'async-owner-release' }
    );

    assert.equal(event.status, 'destroy-scheduled-owner-pending');
    assert.equal(ledger.resources[resourceKey].destroyed, false);
    assert.equal(
      summarizeResidentBufferLeaseLedger(ledger).resources[resourceKey]
        .destroyStatus,
      'destroy-scheduled-owner-pending'
    );

    if (outcome === 'released') settle(true);
    else if (outcome === 'refused') settle(false);
    else settle(new Error('injected-owner-release-failure'));
    await event.completion;

    const summary = summarizeResidentBufferLeaseLedger(ledger);
    if (outcome === 'released') {
      assert.equal(event.status, 'destroyed');
      assert.equal(summary.resources[resourceKey].destroyed, true);
      assert.equal(summary.status, 'resident-buffer-lease-ledger-cleaned');
    } else {
      assert.equal(
        event.status,
        outcome === 'refused'
          ? 'destroy-owner-refused'
          : 'destroy-owner-failed'
      );
      assert.equal(summary.resources[resourceKey].destroyed, false);
      assert.equal(summary.status, 'resident-buffer-lease-ledger-blocked');
    }
  }
});

test('resident buffer lease ledger requires exact async confirmation and replays one pending owner lease', async () => {
  const ledger = createResidentBufferLeaseLedger({
    ledgerId: 'async-owner-exact-confirmation'
  });
  const resourceKey = 'product-events:exact-confirmation';
  registerResidentBufferResource(ledger, {
    resourceKey,
    resourceKind: 'resident-product-event-buffer'
  });
  let settleFirst;
  let ownerCallCount = 0;
  const firstOwnerCompletion = new Promise((resolve) => {
    settleFirst = resolve;
  });
  const destroyOwner = () => {
    ownerCallCount += 1;
    return firstOwnerCompletion;
  };

  const first = destroyResidentBufferWithLease(
    ledger,
    resourceKey,
    destroyOwner
  );
  const replay = destroyResidentBufferWithLease(
    ledger,
    resourceKey,
    destroyOwner
  );
  assert.equal(replay, first);
  assert.equal(replay.completion, first.completion);
  assert.equal(ownerCallCount, 1);

  settleFirst(undefined);
  await first.completion;
  assert.equal(first.status, 'destroy-owner-refused');
  assert.equal(ledger.resources[resourceKey].destroyed, false);

  const retry = destroyResidentBufferWithLease(
    ledger,
    resourceKey,
    () => {
      ownerCallCount += 1;
      return Promise.resolve(true);
    }
  );
  assert.notEqual(retry, first);
  assert.equal(ownerCallCount, 2);
  await retry.completion;
  assert.equal(retry.status, 'destroyed');
  assert.equal(ledger.resources[resourceKey].destroyed, true);
  assert.equal(ledger.status, 'resident-buffer-lease-ledger-cleaned');

  const completedReplay = destroyResidentBufferWithLease(
    ledger,
    resourceKey,
    () => {
      ownerCallCount += 1;
      return Promise.resolve(true);
    }
  );
  assert.equal(completedReplay, retry);
  assert.equal(ownerCallCount, 2);
});

test('resident buffer lease ledger clears a stale refusal blocker after a synchronous retry succeeds', () => {
  const ledger = createResidentBufferLeaseLedger({
    ledgerId: 'sync-owner-refusal-retry'
  });
  const resourceKey = 'product-events:sync-refusal-retry';
  registerResidentBufferResource(ledger, {
    resourceKey,
    resourceKind: 'resident-product-event-buffer'
  });
  let ownerCallCount = 0;
  const refused = destroyResidentBufferWithLease(
    ledger,
    resourceKey,
    () => {
      ownerCallCount += 1;
      return false;
    }
  );
  assert.equal(refused.status, 'destroy-owner-refused');
  assert.equal(ledger.status, 'resident-buffer-lease-ledger-blocked');
  assert.deepEqual(ledger.blockers, [
    `destroy-owner-refused:${resourceKey}`
  ]);

  const retried = destroyResidentBufferWithLease(
    ledger,
    resourceKey,
    () => {
      ownerCallCount += 1;
      return true;
    }
  );
  assert.equal(retried.status, 'destroyed');
  assert.equal(ledger.resources[resourceKey].destroyed, true);
  assert.deepEqual(ledger.blockers, []);
  assert.equal(ledger.status, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(ownerCallCount, 2);

  const replay = destroyResidentBufferWithLease(
    ledger,
    resourceKey,
    () => {
      ownerCallCount += 1;
      return true;
    }
  );
  assert.equal(replay, retried);
  assert.equal(ownerCallCount, 2);
});
