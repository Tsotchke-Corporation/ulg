import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_SCHROEDER_HIERARCHY_ARTIFACT_LEDGER_SCHEMA,
  bindSchroederHierarchyArtifactLedgerSpatialEpoch,
  createSchroederHierarchyArtifactLedger,
  reclaimSchroederHierarchyArtifactTransfers,
  registerSchroederHierarchyArtifact,
  registerSchroederHierarchyArtifactFamily,
  releaseSchroederHierarchyArtifactTransfers,
  retireDiscardedSchroederHierarchyArtifacts,
  scheduleSchroederHierarchyArtifactRetirement,
  summarizeSchroederHierarchyArtifactLedger,
  transferSchroederHierarchyArtifact,
  transferSchroederHierarchyArtifactFamily
} from '../src/runtime/sph/schroederHierarchyArtifactLedger.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fakeBuffer(label, onDestroy = null) {
  return {
    label,
    size: 64,
    destroyCount: 0,
    destroy() {
      this.destroyCount += 1;
      onDestroy?.();
    }
  };
}

test('hierarchy ledger binds one exact spatial generation identity', () => {
  const ledger = createSchroederHierarchyArtifactLedger({
    ledgerId: 'spatial-identity',
    generationId: 7
  });

  let summary = bindSchroederHierarchyArtifactLedgerSpatialEpoch(ledger, 41);
  assert.equal(summary.generationId, 7);
  assert.equal(summary.spatialEpochGenerationId, 41);
  summary = bindSchroederHierarchyArtifactLedgerSpatialEpoch(ledger, 41);
  assert.equal(summary.spatialEpochGenerationId, 41);
  assert.throws(
    () => bindSchroederHierarchyArtifactLedgerSpatialEpoch(ledger, 42),
    /already bound/
  );
  assert.throws(
    () => bindSchroederHierarchyArtifactLedgerSpatialEpoch(ledger, '41'),
    /exact u32/
  );
});

test('hierarchy ledger canonicalizes physical aliases and destroys one buffer once', () => {
  const ledger = createSchroederHierarchyArtifactLedger({ ledgerId: 'aliases' });
  const buffer = fakeBuffer('aliased-buffer');

  registerSchroederHierarchyArtifact(ledger, {
    resourceKey: 'gas:canonical',
    aliases: ['gas:pressure-interface'],
    family: 'gas',
    role: 'cells',
    buffer,
    destroy: () => buffer.destroy(),
    destroyAuthority: 'test-buffer'
  });
  registerSchroederHierarchyArtifact(ledger, {
    resourceKey: 'gas:published-alias',
    family: 'gas',
    role: 'cells',
    buffer,
    destroyAuthority: 'test-buffer'
  });

  const before = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(ledger.schema, ULG_SCHROEDER_HIERARCHY_ARTIFACT_LEDGER_SCHEMA);
  assert.equal(before.resourceCount, 1);
  assert.equal(before.aliasCount, 2);

  retireDiscardedSchroederHierarchyArtifacts(ledger, { reason: 'unit-test-discard' });
  retireDiscardedSchroederHierarchyArtifacts(ledger, { reason: 'duplicate-discard' });

  const after = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(buffer.destroyCount, 1);
  assert.equal(after.destroyedResourceCount, 1);
  assert.equal(after.retirementAttemptedResourceCount, 1);
});

test('cross-family aliases transfer the canonical physical buffer through either membership', async () => {
  const ledger = createSchroederHierarchyArtifactLedger({ ledgerId: 'cross-family-alias' });
  const buffer = fakeBuffer('cross-family-render-buffer');
  registerSchroederHierarchyArtifactFamily(ledger, {
    family: 'active-node-list',
    artifact: { activeNodeBuffer: buffer }
  });
  registerSchroederHierarchyArtifactFamily(ledger, {
    family: 'hierarchy-aggregate-node',
    artifact: { aggregateNodeBuffer: buffer }
  });

  const transfers = transferSchroederHierarchyArtifactFamily(
    ledger,
    'hierarchy-aggregate-node',
    { transferClass: 'render', roles: 'aggregate-nodes' }
  );
  assert.equal(transfers.length, 1);
  const before = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.deepEqual(before.resources['active-node-list:active-nodes'].memberships, [
    { family: 'active-node-list', role: 'active-nodes' },
    { family: 'hierarchy-aggregate-node', role: 'aggregate-nodes' }
  ]);

  await scheduleSchroederHierarchyArtifactRetirement(ledger, {
    after: Promise.resolve()
  });
  assert.equal(buffer.destroyCount, 0);
  await releaseSchroederHierarchyArtifactTransfers(ledger, {
    transferClass: 'render',
    families: 'hierarchy-aggregate-node',
    roles: 'aggregate-nodes',
    submitted: false
  });
  assert.equal(buffer.destroyCount, 1);
});

test('generation retirement skips borrowed and transferred resources until their owners release them', async () => {
  const ledger = createSchroederHierarchyArtifactLedger({ ledgerId: 'transfers' });
  const temporary = fakeBuffer('temporary');
  const borrowed = fakeBuffer('borrowed');
  const render = fakeBuffer('render');
  const nextTick = fakeBuffer('next-tick');
  const continuation = fakeBuffer('continuation');
  for (const [key, buffer, owned] of [
    ['temporary', temporary, true],
    ['borrowed', borrowed, false],
    ['render', render, true],
    ['next-tick', nextTick, true],
    ['continuation', continuation, true]
  ]) {
    registerSchroederHierarchyArtifact(ledger, {
      resourceKey: key,
      family: 'test',
      role: key,
      buffer,
      owned,
      destroy: () => buffer.destroy(),
      destroyAuthority: `test:${key}`
    });
  }
  transferSchroederHierarchyArtifact(ledger, 'render', { transferClass: 'render' });
  transferSchroederHierarchyArtifact(ledger, 'next-tick', { transferClass: 'next-tick' });
  transferSchroederHierarchyArtifact(ledger, 'continuation', { transferClass: 'continuation' });

  const generationFence = deferred();
  const retirement = scheduleSchroederHierarchyArtifactRetirement(ledger, {
    after: generationFence.promise
  });
  assert.equal(temporary.destroyCount, 0);
  generationFence.resolve();
  await retirement;

  assert.equal(temporary.destroyCount, 1);
  assert.equal(borrowed.destroyCount, 0);
  assert.equal(render.destroyCount, 0);
  assert.equal(nextTick.destroyCount, 0);
  assert.equal(continuation.destroyCount, 0);

  await releaseSchroederHierarchyArtifactTransfers(ledger, {
    transferClass: 'render',
    submitted: false
  });
  await releaseSchroederHierarchyArtifactTransfers(ledger, {
    transferClass: 'next-tick',
    submitted: false
  });
  await releaseSchroederHierarchyArtifactTransfers(ledger, {
    transferClass: 'continuation',
    submitted: false
  });

  const summary = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(render.destroyCount, 1);
  assert.equal(nextTick.destroyCount, 1);
  assert.equal(continuation.destroyCount, 0);
  assert.equal(summary.resources.continuation.externallyOwned, true);
  assert.equal(summary.pendingTransferCount, 0);
});

test('retirement waits for its fence and duplicate scheduling remains one-shot', async () => {
  const ledger = createSchroederHierarchyArtifactLedger({ ledgerId: 'fenced-once' });
  const buffer = fakeBuffer('fenced-once');
  registerSchroederHierarchyArtifact(ledger, {
    resourceKey: 'fenced-once',
    buffer,
    destroy: () => buffer.destroy()
  });
  const fence = deferred();

  const first = scheduleSchroederHierarchyArtifactRetirement(ledger, { after: fence.promise });
  const second = scheduleSchroederHierarchyArtifactRetirement(ledger, { after: Promise.resolve() });
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(buffer.destroyCount, 0);
  fence.resolve();
  await first;
  assert.equal(buffer.destroyCount, 1);
});

test('failed handoff reclaims active transfers behind the generation fence exactly once', async () => {
  const ledger = createSchroederHierarchyArtifactLedger({ ledgerId: 'failed-handoff' });
  const render = fakeBuffer('failed-render');
  const continuation = fakeBuffer('failed-continuation');
  registerSchroederHierarchyArtifact(ledger, {
    resourceKey: 'failed-render',
    family: 'active-node-list',
    buffer: render,
    destroy: () => render.destroy()
  });
  registerSchroederHierarchyArtifact(ledger, {
    resourceKey: 'failed-continuation',
    family: 'particle-storage-materialization',
    buffer: continuation,
    destroy: () => continuation.destroy()
  });
  transferSchroederHierarchyArtifact(ledger, 'failed-render', { transferClass: 'render' });
  transferSchroederHierarchyArtifact(ledger, 'failed-continuation', {
    transferClass: 'continuation',
    retirementAuthority: 'external-owner'
  });
  const fence = deferred();
  const reclaim = reclaimSchroederHierarchyArtifactTransfers(ledger, {
    after: fence.promise,
    submitted: true
  });
  const retirement = scheduleSchroederHierarchyArtifactRetirement(ledger, {
    after: fence.promise,
    submitted: true
  });

  assert.equal(render.destroyCount, 0);
  assert.equal(continuation.destroyCount, 0);
  fence.resolve();
  await Promise.all([reclaim, retirement]);

  const summary = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(render.destroyCount, 1);
  assert.equal(continuation.destroyCount, 1);
  assert.equal(summary.pendingTransferCount, 0);
  assert.equal(summary.destroyedResourceCount, 2);
  assert.equal(summary.unretiredOwnedResourceCount, 0);
  assert.ok(summary.transfers.every((transfer) => (
    transfer.status === 'reclaimed-after-failed-handoff'
  )));
});

test('fence rejection blocks cleanup until a confirmed retry and isolates destroy failures', async () => {
  const ledger = createSchroederHierarchyArtifactLedger({ ledgerId: 'failure-isolation' });
  const bad = fakeBuffer('bad');
  const good = fakeBuffer('good');
  registerSchroederHierarchyArtifact(ledger, {
    resourceKey: 'bad',
    buffer: bad,
    destroy: () => {
      bad.destroyCount += 1;
      throw new Error('intentional destroy failure');
    }
  });
  registerSchroederHierarchyArtifact(ledger, {
    resourceKey: 'good',
    buffer: good,
    destroy: () => good.destroy()
  });

  await scheduleSchroederHierarchyArtifactRetirement(ledger, {
    after: Promise.reject(new Error('intentional fence failure'))
  });
  let summary = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(bad.destroyCount, 0);
  assert.equal(good.destroyCount, 0);
  assert.equal(summary.retirementCompleted, false);
  assert.ok(summary.blockers.some(
    (entry) => entry.includes('artifact-retirement-fence-rejected')
  ));

  await scheduleSchroederHierarchyArtifactRetirement(ledger, {
    after: Promise.resolve(true)
  });

  summary = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(bad.destroyCount, 1);
  assert.equal(good.destroyCount, 1);
  assert.equal(summary.failedDestroyResourceCount, 1);
  assert.equal(summary.unretiredOwnedResourceCount, 1);
  assert.equal(
    summary.blockers.some((entry) => entry.includes('artifact-retirement-fence-rejected')),
    false
  );
  assert.ok(summary.warnings.some(
    (entry) => entry.includes('artifact-retirement-fence-retry-confirmed')
  ));
  assert.ok(summary.blockers.some((entry) => entry.includes('artifact-destroy-failed:bad')));
});

test('generation-owner retirement requires exact true and permits a confirmed retry', async () => {
  const ledger = createSchroederHierarchyArtifactLedger({
    ledgerId: 'unconfirmed-fence-retry'
  });
  const buffer = fakeBuffer('unconfirmed-fence-buffer');
  registerSchroederHierarchyArtifact(ledger, {
    resourceKey: 'unconfirmed-fence-buffer',
    buffer,
    destroy: () => buffer.destroy()
  });

  await scheduleSchroederHierarchyArtifactRetirement(ledger, {
    after: Promise.resolve(),
    requireConfirmedTrue: true
  });
  let summary = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(buffer.destroyCount, 0);
  assert.equal(summary.retirementCompleted, false);
  assert.equal(summary.unretiredOwnedResourceCount, 1);
  assert.ok(summary.blockers.some(
    (entry) => entry.includes('artifact-retirement-fence-unconfirmed')
  ));

  await scheduleSchroederHierarchyArtifactRetirement(ledger, {
    after: Promise.resolve(true),
    requireConfirmedTrue: true
  });
  summary = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(buffer.destroyCount, 1);
  assert.equal(summary.retirementCompleted, true);
  assert.equal(summary.unretiredOwnedResourceCount, 0);
});

test('deferred fence rejection blocks cleanup and preserves owned buffers', async () => {
  const ledger = createSchroederHierarchyArtifactLedger({
    ledgerId: 'deferred-fence-rejection',
    deferCleanup(_cleanup, rejectCleanup) {
      rejectCleanup(new Error('intentional deferred fence rejection'));
      return true;
    }
  });
  const buffer = fakeBuffer('deferred-fence-buffer');
  registerSchroederHierarchyArtifact(ledger, {
    resourceKey: 'deferred-fence-buffer',
    buffer,
    destroy: () => buffer.destroy()
  });

  await scheduleSchroederHierarchyArtifactRetirement(ledger, {
    submitted: true
  });
  const summary = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(buffer.destroyCount, 0);
  assert.equal(summary.retirementCompleted, false);
  assert.equal(summary.unretiredOwnedResourceCount, 1);
  assert.ok(summary.blockers.some(
    (entry) => entry.includes('artifact-retirement-fence-rejected')
      && entry.includes('intentional deferred fence rejection')
  ));
});

test('key, ownership, destroy-authority, and final-owner conflicts fail closed', () => {
  const ledger = createSchroederHierarchyArtifactLedger({ ledgerId: 'conflicts' });
  const first = fakeBuffer('first');
  const second = fakeBuffer('second');
  registerSchroederHierarchyArtifact(ledger, {
    resourceKey: 'stable-key',
    buffer: first,
    owned: true,
    destroyAuthority: 'authority-a'
  });

  assert.throws(
    () => registerSchroederHierarchyArtifact(ledger, {
      resourceKey: 'stable-key',
      buffer: second,
      owned: true
    }),
    /already identifies another buffer/
  );
  assert.throws(
    () => registerSchroederHierarchyArtifact(ledger, {
      resourceKey: 'borrowed-alias',
      buffer: first,
      owned: false,
      destroyAuthority: 'authority-a'
    }),
    /ownership conflict/
  );
  assert.throws(
    () => registerSchroederHierarchyArtifact(ledger, {
      resourceKey: 'authority-alias',
      buffer: first,
      owned: true,
      destroyAuthority: 'authority-b'
    }),
    /destroy-authority conflict/
  );

  transferSchroederHierarchyArtifact(ledger, 'stable-key', { transferClass: 'render' });
  assert.throws(
    () => transferSchroederHierarchyArtifact(ledger, 'stable-key', { transferClass: 'next-tick' }),
    /already transferred to another owner/
  );
  assert.equal(summarizeSchroederHierarchyArtifactLedger(ledger).resourceCount, 1);
});

test('submitted resources fail closed without a fence while discarded resources retire synchronously', async () => {
  const submittedLedger = createSchroederHierarchyArtifactLedger({ ledgerId: 'missing-fence' });
  const retained = fakeBuffer('retained');
  registerSchroederHierarchyArtifact(submittedLedger, {
    resourceKey: 'retained',
    buffer: retained,
    destroy: () => retained.destroy()
  });
  await scheduleSchroederHierarchyArtifactRetirement(submittedLedger);
  const blocked = summarizeSchroederHierarchyArtifactLedger(submittedLedger);
  assert.equal(retained.destroyCount, 0);
  assert.ok(blocked.blockers.includes('artifact-retirement-fence-missing:generation-retirement'));

  const discardedLedger = createSchroederHierarchyArtifactLedger({ ledgerId: 'discarded' });
  const discarded = fakeBuffer('discarded');
  registerSchroederHierarchyArtifact(discardedLedger, {
    resourceKey: 'discarded',
    buffer: discarded,
    destroy: () => discarded.destroy()
  });
  retireDiscardedSchroederHierarchyArtifacts(discardedLedger);
  assert.equal(discarded.destroyCount, 1);
});

test('family registration rejects divergent alias fields', () => {
  const ledger = createSchroederHierarchyArtifactLedger({ ledgerId: 'divergent-aliases' });
  assert.throws(
    () => registerSchroederHierarchyArtifactFamily(ledger, {
      family: 'far-aggregate-gas-state-delta',
      artifact: {
        gasStateDeltaBuffer: fakeBuffer('gas-delta'),
        stateDeltaBuffer: fakeBuffer('different-delta')
      }
    }),
    /aliases identify different buffers/
  );
  assert.equal(summarizeSchroederHierarchyArtifactLedger(ledger).resourceCount, 0);
});

test('particle role retirement cannot invalidate a transferred sibling', async () => {
  const ledger = createSchroederHierarchyArtifactLedger({ ledgerId: 'particle-role-isolation' });
  const artifact = {
    particleStateBuffer: fakeBuffer('state'),
    particleThermoBuffer: fakeBuffer('thermo'),
    particleMechanicsBuffer: fakeBuffer('mechanics'),
    particleIdentityBuffer: fakeBuffer('identity'),
    destroyParticleBuffers() {
      this.particleStateBuffer.destroy();
      this.particleThermoBuffer.destroy();
      this.particleMechanicsBuffer.destroy();
      this.particleIdentityBuffer.destroy();
    }
  };
  registerSchroederHierarchyArtifactFamily(ledger, {
    family: 'particle-storage-compaction',
    artifact
  });
  transferSchroederHierarchyArtifact(
    ledger,
    'particle-storage-compaction:particle-state',
    { transferClass: 'continuation' }
  );
  retireDiscardedSchroederHierarchyArtifacts(ledger, {
    families: 'particle-storage-compaction',
    roles: ['particle-thermo', 'particle-mechanics', 'particle-identity']
  });

  assert.equal(artifact.particleStateBuffer.destroyCount, 0);
  assert.equal(artifact.particleThermoBuffer.destroyCount, 1);
  assert.equal(artifact.particleMechanicsBuffer.destroyCount, 1);
  assert.equal(artifact.particleIdentityBuffer.destroyCount, 1);
  await releaseSchroederHierarchyArtifactTransfers(ledger, {
    transferClass: 'continuation',
    submitted: false
  });
  assert.equal(artifact.particleStateBuffer.destroyCount, 0);
});

test('multi-buffer grouped destroy fallbacks fail closed around a transferred sibling', () => {
  const ledger = createSchroederHierarchyArtifactLedger({ ledgerId: 'unsafe-group-fallback' });
  let groupedDestroyCount = 0;
  const artifact = {
    bucketCountBuffer: { label: 'group-bucket-count' },
    bucketSlotBuffer: { label: 'group-bucket-slots' },
    nodeBucketSlotBuffer: { label: 'group-node-bucket-slots' },
    overflowCounterBuffer: { label: 'group-overflow-counter' },
    destroyIndexBuffers() {
      groupedDestroyCount += 1;
    }
  };
  registerSchroederHierarchyArtifactFamily(ledger, {
    family: 'active-node-index',
    artifact
  });
  transferSchroederHierarchyArtifact(ledger, 'active-node-index:bucket-count', {
    transferClass: 'render'
  });
  retireDiscardedSchroederHierarchyArtifacts(ledger, {
    families: 'active-node-index'
  });

  const summary = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(groupedDestroyCount, 0);
  assert.equal(summary.destroyedResourceCount, 0);
  assert.equal(summary.unretiredOwnedResourceCount, 4);
  assert.ok(summary.blockers.some((blocker) => (
    blocker.startsWith('artifact-destroy-authority-missing:active-node-index:')
  )));
});

test('owned no-authority resources stay visibly unretired and sealed ledgers reject late mutation', async () => {
  const ledger = createSchroederHierarchyArtifactLedger({ ledgerId: 'sealed-no-authority' });
  registerSchroederHierarchyArtifact(ledger, {
    resourceKey: 'opaque-owned-buffer',
    buffer: { label: 'opaque' },
    owned: true
  });
  await scheduleSchroederHierarchyArtifactRetirement(ledger, {
    after: Promise.resolve()
  });
  const summary = summarizeSchroederHierarchyArtifactLedger(ledger);
  assert.equal(summary.unretiredOwnedResourceCount, 1);
  assert.equal(summary.resources['opaque-owned-buffer'].retirementAttempted, false);
  assert.ok(summary.blockers.includes('artifact-destroy-authority-missing:opaque-owned-buffer'));
  assert.throws(
    () => registerSchroederHierarchyArtifact(ledger, {
      resourceKey: 'late',
      buffer: fakeBuffer('late')
    }),
    /ledger is sealed/
  );
  assert.throws(
    () => transferSchroederHierarchyArtifact(ledger, 'opaque-owned-buffer', {
      transferClass: 'render'
    }),
    /ledger is sealed/
  );
});
