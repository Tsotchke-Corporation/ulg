import test from 'node:test';
import assert from 'node:assert/strict';

import {
  markMlsMpmResidentExecutionStale,
  schroederHierarchyArtifactLedgerSettlementEvidence,
  settleSupersededMlsMpmResidentExecutions,
  settleSchroederSpatialEpochBatchEvidence
} from '../src/visualization/sphPhaseScene.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function transactionSummary(generationId) {
  return {
    generationId,
    state: 'released',
    counters: { releaseCount: 1 }
  };
}

function generationSummary(generationId) {
  return {
    generationId,
    releaseStatus: 'spatial-epoch-generation-released-after-final-consumer',
    releaseAttemptCount: 1,
    releaseFailureCount: 0
  };
}

function artifactLedgerSummary(generationId) {
  return {
    schema: 'peercompute.ulg.schroeder-hierarchy-artifact-ledger-summary.v0',
    ledgerId: `ledger:${generationId}`,
    generationId,
    spatialEpochGenerationId: generationId,
    status: 'schroeder-hierarchy-artifact-ledger-transferred',
    resourceCount: 2,
    ownedResourceCount: 2,
    borrowedResourceCount: 0,
    transferredResourceCount: 1,
    pendingTransferCount: 1,
    retirementAttemptedResourceCount: 1,
    destroyedResourceCount: 1,
    failedDestroyResourceCount: 0,
    unretiredOwnedResourceCount: 1,
    retirementScheduled: true,
    retirementCompleted: true,
    blockers: [],
    resources: {
      destroyed: {
        owned: true,
        destroyed: true,
        externallyOwned: false,
        transfer: null
      },
      retained: {
        owned: true,
        destroyed: false,
        externallyOwned: false,
        transfer: {
          status: 'active',
          retirementAuthority: 'ledger-consumer'
        }
      }
    }
  };
}

function settlement(generationId, overrides = {}) {
  return {
    index: generationId - 1,
    releasePromise: Promise.resolve(true),
    artifactRetirementPromise: Promise.resolve(true),
    currentTransactionSummary: () => transactionSummary(generationId),
    currentGenerationSummary: () => generationSummary(generationId),
    currentArtifactLedgerSummary: () => artifactLedgerSummary(generationId),
    ...overrides
  };
}

test('artifact-ledger settlement permits only explicit live transfers to remain', () => {
  const accepted = schroederHierarchyArtifactLedgerSettlementEvidence(
    artifactLedgerSummary(1)
  );
  assert.equal(accepted.safe, true);
  assert.equal(accepted.unsafeUnretiredOwnedResourceCount, 0);

  const unsafe = artifactLedgerSummary(1);
  unsafe.resources.retained.transfer = null;
  const rejected = schroederHierarchyArtifactLedgerSettlementEvidence(unsafe);
  assert.equal(rejected.safe, false);
  assert.equal(rejected.unsafeUnretiredOwnedResourceCount, 1);
});

test('resident generation handoff waits for pending execution and background owner settlement', async () => {
  const pendingExecution = deferred();
  const backgroundSettlement = deferred();
  let handoffComplete = false;
  const handoff = settleSupersededMlsMpmResidentExecutions({
    pendingExecutions: [pendingExecution.promise]
  }).then((settled) => {
    handoffComplete = true;
    return settled;
  });

  await Promise.resolve();
  assert.equal(handoffComplete, false);
  const execution = { schema: 'peercompute.ulg.mls-mpm-resident-steps-execution.v0' };
  Object.defineProperty(execution, 'schroederBackgroundSettlementPromise', {
    value: backgroundSettlement.promise,
    enumerable: false
  });
  pendingExecution.resolve(execution);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(handoffComplete, false);

  backgroundSettlement.resolve(true);
  assert.equal(await handoff, true);
  assert.equal(handoffComplete, true);
});

test('stale resident envelope preserves its non-enumerable owner-settlement capability', () => {
  const backgroundSettlement = Promise.resolve(true);
  const execution = { status: 'resident-steps-executed' };
  Object.defineProperty(execution, 'schroederBackgroundSettlementPromise', {
    value: backgroundSettlement,
    enumerable: false
  });

  const stale = markMlsMpmResidentExecutionStale(execution, {
    startGeneration: 4,
    currentGeneration: 5,
    reason: 'reset'
  });

  assert.equal(stale.stale, true);
  assert.equal(stale.staleReason, 'reset');
  assert.equal(stale.residentExecutionGeneration, 4);
  assert.equal(stale.currentResidentExecutionGeneration, 5);
  assert.equal(
    stale.schroederBackgroundSettlementPromise,
    backgroundSettlement
  );
  assert.equal(
    Object.keys(stale).includes('schroederBackgroundSettlementPromise'),
    false
  );
});

test('resident generation handoff rejects an unconfirmed background settlement', async () => {
  const execution = {};
  Object.defineProperty(execution, 'schroederBackgroundSettlementPromise', {
    value: Promise.resolve(false),
    enumerable: false
  });

  await assert.rejects(
    settleSupersededMlsMpmResidentExecutions({
      publishedExecutions: [execution]
    }),
    { code: 'ERR_MLS_MPM_RESIDENT_GENERATION_HANDOFF_UNCONFIRMED' }
  );
});

test('batch settlement resamples every transaction, generation, and ledger after fences', async () => {
  const resampleCounts = [0, 0];
  const settlements = [1, 2].map((generationId, index) => settlement(generationId, {
    currentTransactionSummary: () => {
      resampleCounts[index] += 1;
      return transactionSummary(generationId);
    }
  }));

  const settled = await settleSchroederSpatialEpochBatchEvidence({
    settlements,
    expectedCount: 2
  });

  assert.deepEqual(resampleCounts, [1, 1]);
  assert.deepEqual(settled.map((entry) => entry.transactionSummary.generationId), [1, 2]);
  assert.ok(settled.every((entry) => entry.artifactLedgerSummary.safe === true));
});

test('batch settlement accepts exact-successor queue-ordered generation retirement', async () => {
  const settled = await settleSchroederSpatialEpochBatchEvidence({
    settlements: [settlement(1, {
      currentGenerationSummary: () => ({
        ...generationSummary(1),
        releaseStatus:
          'spatial-epoch-generation-released-queue-ordered-after-exact-successor'
      })
    })],
    expectedCount: 1
  });

  assert.equal(settled[0].generationSummary.releaseStatus,
    'spatial-epoch-generation-released-queue-ordered-after-exact-successor');
});

test('batch settlement accepts exact final-consumer queue-ordered generation retirement', async () => {
  const settled = await settleSchroederSpatialEpochBatchEvidence({
    settlements: [settlement(1, {
      currentGenerationSummary: () => ({
        ...generationSummary(1),
        releaseStatus:
          'spatial-epoch-generation-released-queue-ordered-after-final-consumer'
      })
    })],
    expectedCount: 1
  });

  assert.equal(settled[0].generationSummary.releaseStatus,
    'spatial-epoch-generation-released-queue-ordered-after-final-consumer');
});

test('batch settlement rejects missing hooks, false confirmation, and fence rejection', async () => {
  await assert.rejects(
    settleSchroederSpatialEpochBatchEvidence({
      settlements: [settlement(1)],
      expectedCount: 2
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_BATCH_RELEASE_HOOKS' }
  );

  await assert.rejects(
    settleSchroederSpatialEpochBatchEvidence({
      settlements: [settlement(1, { releasePromise: Promise.resolve(false) })],
      expectedCount: 1
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_BATCH_RELEASE_UNCONFIRMED' }
  );

  await assert.rejects(
    settleSchroederSpatialEpochBatchEvidence({
      settlements: [settlement(1, {
        releasePromise: Promise.reject(new Error('device queue failure'))
      })],
      expectedCount: 1
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_BATCH_RELEASE_REJECTED' }
  );
});

test('batch settlement rejects failed artifact retirement despite a released epoch', async () => {
  const failedLedger = artifactLedgerSummary(1);
  failedLedger.failedDestroyResourceCount = 1;
  await assert.rejects(
    settleSchroederSpatialEpochBatchEvidence({
      settlements: [settlement(1, {
        currentArtifactLedgerSummary: () => failedLedger
      })],
      expectedCount: 1
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_BATCH_RELEASE_UNCONFIRMED' }
  );
});

test('batch settlement rejects a safe ledger from a stale spatial generation', async () => {
  const staleLedger = artifactLedgerSummary(1);
  staleLedger.spatialEpochGenerationId = 9;
  await assert.rejects(
    settleSchroederSpatialEpochBatchEvidence({
      settlements: [settlement(1, {
        currentArtifactLedgerSummary: () => staleLedger
      })],
      expectedCount: 1
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_BATCH_RELEASE_UNCONFIRMED' }
  );
});
