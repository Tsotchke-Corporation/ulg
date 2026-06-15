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
