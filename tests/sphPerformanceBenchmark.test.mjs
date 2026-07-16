import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateSchroederResidentBatchEvidence,
  scenarioPerformanceGate
} from '../scripts/sph-performance-benchmark.mjs';

function transaction({ generationId, physicsTick, positionEpoch, legacyPrivate = 0, legacyExhaustive = 0 }) {
  return {
    state: 'released',
    generationId,
    epochIdentity: {
      physicsTick,
      positionEpoch
    },
    counters: {
      epochCount: 1,
      directoryBuildCount: 1,
      sortUniqueCount: 1,
      privateCanonicalLookupBuildCount: 0,
      readerRejectCount: 0,
      proposalSealCount: 1,
      commitCount: 1,
      releaseScheduleCount: 1,
      releaseRetryCount: 0,
      releaseCount: 1,
      staleLawInputForwardCount: 0,
      legacyPrivateLookupBuildCount: legacyPrivate,
      legacyExhaustiveTraversalCount: legacyExhaustive
    }
  };
}

function generation(generationId, backpressureWaitCount = 0) {
  return {
    generationId,
    directoryBuildCount: 1,
    privateLookupBuildCount: 0,
    releaseScheduled: true,
    releaseStatus: 'spatial-epoch-generation-released-after-final-consumer',
    releaseAttemptCount: 1,
    releaseFailureCount: 0,
    backpressureWaitCount,
    backpressureWaitMs: backpressureWaitCount * 0.25
  };
}

function artifactLedger(generationId) {
  return {
    generationId,
    spatialEpochGenerationId: generationId,
    safe: true,
    resourceCount: 2,
    retirementScheduled: true,
    retirementCompleted: true,
    failedDestroyResourceCount: 0,
    blockerCount: 0,
    unsafeUnretiredOwnedResourceCount: 0,
    resourceInventoryComplete: true,
    unretiredOwnedResourceCountMatches: true
  };
}

function residentBatch({ batchIndex, firstGenerationId, firstPhysicsTick, firstPositionEpoch }) {
  const transactions = [
    transaction({
      generationId: firstGenerationId,
      physicsTick: firstPhysicsTick,
      positionEpoch: firstPositionEpoch,
      legacyPrivate: batchIndex === 1 ? 2 : 0,
      legacyExhaustive: batchIndex === 2 ? 1 : 0
    }),
    transaction({
      generationId: firstGenerationId + 1,
      physicsTick: firstPhysicsTick + 1,
      positionEpoch: firstPositionEpoch + 1
    })
  ];
  return {
    batchIndex,
    phase: 'resident-batch',
    schroederTelemetry: {
      requested: true,
      active: true
    },
    residentSteps: {
      status: 'resident-steps-executed',
      completedStepCount: 2,
      nextStep: firstPhysicsTick + 2,
      schroederSpatialEpochReleaseSettlementCount: 2,
      schroederSpatialEpochReleaseSettlementComplete: true,
      schroederHierarchyArtifactLedgerSettlementCount: 2,
      schroederHierarchyArtifactLedgerSettlementComplete: true,
      schroederSpatialEpochTransactionSummaries: transactions,
      schroederSpatialEpochGenerationSummaries: transactions.map(
        (entry, index) => generation(entry.generationId, index === 1 ? 1 : 0)
      ),
      schroederHierarchyArtifactLedgerSummaries: transactions.map(
        (entry) => artifactLedger(entry.generationId)
      )
    }
  };
}

function completeMetrics() {
  return [
    { batchIndex: 0, phase: 'initial' },
    residentBatch({
      batchIndex: 1,
      firstGenerationId: 41,
      firstPhysicsTick: 10,
      firstPositionEpoch: 20
    }),
    residentBatch({
      batchIndex: 2,
      firstGenerationId: 43,
      firstPhysicsTick: 12,
      firstPositionEpoch: 22
    })
  ];
}

function aggregate(metrics) {
  return aggregateSchroederResidentBatchEvidence({
    metrics,
    requestedBatchCount: 2,
    requestedBatchStepCount: 2,
    schroederSimulationRequested: true
  });
}

test('SS performance evidence aggregates every requested batch and all released ticks', () => {
  const evidence = aggregate(completeMetrics());

  assert.equal(evidence.transactionCoverageComplete, true);
  assert.equal(evidence.observedBatchCount, 2);
  assert.deepEqual(evidence.observedBatchIndices, [1, 2]);
  assert.equal(evidence.expectedStepCount, 4);
  assert.equal(evidence.completedStepCount, 4);
  assert.equal(evidence.releaseSettlementCount, 4);
  assert.equal(evidence.releaseSettlementCoverageComplete, true);
  assert.equal(evidence.artifactLedgerSummaryCount, 4);
  assert.equal(evidence.artifactLedgerFailedDestroyResourceCount, 0);
  assert.equal(evidence.artifactLedgerBlockerCount, 0);
  assert.equal(evidence.artifactLedgerUnsafeUnretiredOwnedResourceCount, 0);
  assert.equal(evidence.artifactLedgerGenerationAlignmentComplete, true);
  assert.equal(evidence.artifactLedgerCoverageComplete, true);
  assert.equal(evidence.transactionMountedCount, 4);
  assert.equal(evidence.generationSummaryCount, 4);
  assert.equal(evidence.transactionGenerationSequence.start, 41);
  assert.equal(evidence.transactionGenerationSequence.end, 44);
  assert.equal(evidence.transactionPhysicsTickSequence.start, 10);
  assert.equal(evidence.transactionPhysicsTickSequence.end, 13);
  assert.equal(evidence.transactionPositionEpochSequence.start, 20);
  assert.equal(evidence.transactionPositionEpochSequence.end, 23);
  assert.equal(evidence.transactionCounterTotals.releaseCount, 4);
  assert.equal(evidence.transactionCounterTotals.releaseRetryCount, 0);
  assert.equal(evidence.transactionCounterTotals.legacyPrivateLookupBuildCount, 2);
  assert.equal(evidence.transactionCounterTotals.legacyExhaustiveTraversalCount, 1);
  assert.equal(evidence.backpressureWaitCount, 2);
  assert.equal(evidence.backpressureWaitMs, 0.5);
});

test('SS performance evidence requires every batch to publish complete release-hook settlement', () => {
  const missingSettlementFlag = structuredClone(completeMetrics());
  delete missingSettlementFlag[1].residentSteps
    .schroederSpatialEpochReleaseSettlementComplete;
  assert.equal(aggregate(missingSettlementFlag).transactionCoverageComplete, false);

  const droppedSettlementHook = structuredClone(completeMetrics());
  droppedSettlementHook[1].residentSteps
    .schroederSpatialEpochReleaseSettlementCount = 1;
  assert.equal(aggregate(droppedSettlementHook).transactionCoverageComplete, false);

  const incompleteSettlement = structuredClone(completeMetrics());
  incompleteSettlement[1].residentSteps
    .schroederSpatialEpochReleaseSettlementComplete = false;
  assert.equal(aggregate(incompleteSettlement).transactionCoverageComplete, false);
});

test('SS performance evidence requires every transaction to prove exact-once counters', () => {
  const redistributedReleaseCounts = structuredClone(completeMetrics());
  redistributedReleaseCounts[1].residentSteps
    .schroederSpatialEpochTransactionSummaries[0].counters.releaseCount = 2;
  redistributedReleaseCounts[1].residentSteps
    .schroederSpatialEpochTransactionSummaries[1].counters.releaseCount = 0;

  const evidence = aggregate(redistributedReleaseCounts);
  assert.equal(evidence.transactionCounterTotals.releaseCount, 4);
  assert.equal(evidence.transactionExactOnceCoverageComplete, false);
  assert.equal(evidence.transactionCoverageComplete, false);
});

test('SS performance evidence requires safe artifact-ledger retirement for every step', () => {
  const missingLedger = structuredClone(completeMetrics());
  missingLedger[1].residentSteps.schroederHierarchyArtifactLedgerSummaries.pop();
  assert.equal(aggregate(missingLedger).transactionCoverageComplete, false);

  const failedDestroy = structuredClone(completeMetrics());
  failedDestroy[1].residentSteps
    .schroederHierarchyArtifactLedgerSummaries[0].failedDestroyResourceCount = 1;
  failedDestroy[1].residentSteps
    .schroederHierarchyArtifactLedgerSummaries[0].safe = false;
  assert.equal(aggregate(failedDestroy).transactionCoverageComplete, false);

  const unsafeRemainder = structuredClone(completeMetrics());
  unsafeRemainder[1].residentSteps
    .schroederHierarchyArtifactLedgerSummaries[0].unsafeUnretiredOwnedResourceCount = 1;
  unsafeRemainder[1].residentSteps
    .schroederHierarchyArtifactLedgerSummaries[0].safe = false;
  assert.equal(aggregate(unsafeRemainder).transactionCoverageComplete, false);

  const staleLedger = structuredClone(completeMetrics());
  staleLedger[1].residentSteps
    .schroederHierarchyArtifactLedgerSummaries[1].spatialEpochGenerationId = 41;
  const staleEvidence = aggregate(staleLedger);
  assert.equal(staleEvidence.artifactLedgerGenerationAlignmentComplete, false);
  assert.equal(staleEvidence.transactionCoverageComplete, false);
});

test('SS performance gate cannot downgrade an explicit SS request from false telemetry', () => {
  const evidence = scenarioPerformanceGate({
    estimatedReadbackBytesPerStep: 0,
    schroederSimulationRequested: true,
    schroederSimulationRequestedObserved: false,
    schroederSimulationActive: false,
    schroederTransactionCoverageComplete: false
  });

  assert.equal(evidence.status, 'fail');
  assert.ok(evidence.blockers.includes('schroeder-simulation-request-not-observed'));
  assert.ok(evidence.blockers.includes('schroeder-simulation-requested-but-inactive'));
  assert.ok(evidence.blockers.includes('schroeder-spatial-transaction-coverage-incomplete'));
});

test('SS performance evidence rejects missing, duplicated, or unreleased earlier ticks', () => {
  const missingFirstBatch = completeMetrics().slice(0, 1).concat(completeMetrics().slice(2));
  assert.equal(aggregate(missingFirstBatch).transactionCoverageComplete, false);

  const duplicatedEarlierTick = structuredClone(completeMetrics());
  duplicatedEarlierTick[1].residentSteps.schroederSpatialEpochTransactionSummaries[1]
    .epochIdentity.physicsTick = 10;
  assert.equal(aggregate(duplicatedEarlierTick).transactionCoverageComplete, false);

  const unreleasedEarlierTick = structuredClone(completeMetrics());
  const firstTransaction = unreleasedEarlierTick[1]
    .residentSteps.schroederSpatialEpochTransactionSummaries[0];
  firstTransaction.state = 'release-scheduled';
  firstTransaction.counters.releaseCount = 0;
  assert.equal(aggregate(unreleasedEarlierTick).transactionCoverageComplete, false);

  const retriedEarlierRelease = structuredClone(completeMetrics());
  const retriedTransaction = retriedEarlierRelease[1]
    .residentSteps.schroederSpatialEpochTransactionSummaries[0];
  retriedTransaction.counters.releaseScheduleCount = 2;
  retriedTransaction.counters.releaseRetryCount = 1;
  assert.equal(aggregate(retriedEarlierRelease).transactionCoverageComplete, false);
});
