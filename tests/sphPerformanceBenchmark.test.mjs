import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateSchroederResidentBatchEvidence,
  buildSchroederReactionReceiptIccTrace,
  createSchroederBenchmarkScenarioParams,
  currentResidentSurfaceDrawEvidence,
  scenarioUrlForCount,
  scenarioPerformanceGate,
  summarizePairedGpuStageProducerRuns,
  summarizePairedGpuTimestampRuns,
  summarizePairedSpatialArenaDepthThroughputRuns,
  summarizePairedPhysicsThroughputRuns,
  summarizeResidentGpuStageTimestampEvidence,
  summarizeResidentGpuTimestampEvidence
} from '../scripts/sph-performance-benchmark.mjs';

function finalizedReactionReceiptTelemetry(overrides = {}) {
  return {
    schema: 'peercompute.ulg.schroeder-spatial-consumer-receipt-telemetry.v1',
    status: 'schroeder-spatial-epoch-consumer-receipt-finalized',
    backend: 'webgpu',
    backendSelection: 'same-device-submitted-webgpu-generation',
    fallbackIntent: 'forbidden',
    consumerId: 'reaction-discovery',
    deviceId: 'test-webgpu-device',
    generationId: 41,
    epochIdentity: {
      storageGeneration: 1,
      physicsTick: 10,
      physicsSubstep: 0,
      positionEpoch: 20,
      topologyEpoch: 30,
      chartEpoch: 40,
      levelEpoch: 50,
      supportEpoch: 60
    },
    authenticated: true,
    gpuAuthenticated: true,
    bindingAuthenticated: false,
    submissionAuthenticated: false,
    resultAuthenticated: true,
    submitPerformed: true,
    generationBound: true,
    expectedTraversalCount: 1,
    traversalCount: 1,
    overflowed: false,
    partialPublication: false,
    fallbackObserved: false,
    fullReadbackPerformed: false,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    ...overrides
  };
}

function transaction({
  generationId,
  physicsTick,
  positionEpoch,
  deviceId = null,
  epochIdentity = null,
  successorEpochEvidence = null,
  legacyPrivate = 0,
  legacyExhaustive = 0,
  privateAdvance = 0,
  commit = 1
}) {
  return {
    state: 'released',
    generationId,
    deviceId,
    epochIdentity: epochIdentity ?? {
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
      privateAdvanceCount: privateAdvance,
      commitCount: commit,
      releaseScheduleCount: 1,
      releaseRetryCount: 0,
      releaseCount: 1,
      staleLawInputForwardCount: 0,
      legacyPrivateLookupBuildCount: legacyPrivate,
      legacyExhaustiveTraversalCount: legacyExhaustive
    },
    ...(successorEpochEvidence == null ? {} : { successorEpochEvidence })
  };
}

function fullEpochIdentity({
  storageGeneration,
  physicsTick,
  physicsSubstep = 0,
  positionEpoch,
  topologyEpoch,
  chartEpoch,
  levelEpoch,
  supportEpoch
}) {
  return {
    storageGeneration,
    physicsTick,
    physicsSubstep,
    positionEpoch,
    topologyEpoch,
    chartEpoch,
    levelEpoch,
    supportEpoch
  };
}

function authenticatedPlacementSuccessorEpochEvidence({
  previous,
  next,
  deviceId = 'test-webgpu-device'
}) {
  return {
    schema: 'peercompute.ulg.schroeder-committed-successor-source-family.v1',
    status: 'schroeder-committed-successor-source-family-authenticated',
    ready: true,
    admitted: true,
    authenticated: true,
    deviceId,
    sourceFamily: 'hot-particle-successor',
    sourceFamilyRole: 'committed-successor-x-n-plus-1',
    publicationAuthority: 'spatial-epoch-transaction-preflight-and-commit',
    exactBufferFamilyAuthenticated: true,
    storageAllocationAuthenticated: true,
    topologyTransitionAuthenticated: true,
    sourceGenerationId: previous.generationId,
    ancestorSpatialGenerationId: previous.generationId,
    positionAuthority:
      'authenticated-transactional-placement-epoch-floor-with-conservative-final-family',
    positionEpochFloorAuthenticated: true,
    positionEpochFloor: next.epochIdentity.positionEpoch,
    positionTransitionAuthenticated: false,
    positionChanged: true,
    sourceEpochIdentity: { ...previous.epochIdentity },
    successorEpochIdentity: { ...next.epochIdentity }
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

function sameLevelReactionPlacementFloorMetrics() {
  const metrics = completeMetrics();
  const transactions = metrics
    .filter((metric) => metric.phase === 'resident-batch')
    .flatMap((metric) => metric.residentSteps.schroederSpatialEpochTransactionSummaries);
  for (let index = 0; index < transactions.length; index += 1) {
    const transactionSummary = transactions[index];
    transactionSummary.deviceId = 'test-webgpu-device';
    transactionSummary.epochIdentity = fullEpochIdentity({
      storageGeneration: 100 + index,
      physicsTick: 10 + index,
      positionEpoch: 20 + index * 2,
      topologyEpoch: 30 + index,
      chartEpoch: 40 + index,
      levelEpoch: 50 + index,
      supportEpoch: 60 + index
    });
  }
  for (let index = 0; index < transactions.length - 1; index += 1) {
    transactions[index].successorEpochEvidence =
      authenticatedPlacementSuccessorEpochEvidence({
        previous: transactions[index],
        next: transactions[index + 1]
      });
  }
  return metrics;
}

function authoritativeTwoLevelMetrics() {
  const metrics = structuredClone(completeMetrics());
  for (const metric of metrics.filter((entry) => entry.phase === 'resident-batch')) {
    metric.schroederTelemetry = {
      ...metric.schroederTelemetry,
      twoLevelMechanicsRequested: true,
      twoLevelMechanicsActive: true,
      twoLevelMechanicsAuthorityRequested: 'authoritative',
      twoLevelMechanicsAuthorityObserved: 'authoritative',
      twoLevelFineSubstepCountRequested: 2,
      twoLevelFineSubstepCountObserved: 2,
      twoLevelMechanicsStepStatus:
        'schroeder-two-level-authoritative-step-executed',
      twoLevelAuthoritativeCommitVerified: true,
      twoLevelAuthoritativeStepCount: 2,
      twoLevelMechanicsCoverageComplete: true
    };
    metric.residentSteps.schroederTwoLevelAuthoritativeStepCount = 2;
    for (const transactionSummary of metric.residentSteps
      .schroederSpatialEpochTransactionSummaries) {
      transactionSummary.counters.privateAdvanceCount = 1;
      transactionSummary.counters.commitCount = 0;
    }
  }
  return metrics;
}

function aggregateAuthoritativeTwoLevel(metrics) {
  return aggregateSchroederResidentBatchEvidence({
    metrics,
    requestedBatchCount: 2,
    requestedBatchStepCount: 2,
    schroederSimulationRequested: true,
    schroederTwoLevelMechanicsRequested: true,
    schroederTwoLevelMechanicsAuthority: 'authoritative',
    schroederTwoLevelFineSubstepCount: 2
  });
}

function withGpuTimestampIntervals(metrics, durationsMs = [4, 6]) {
  const result = structuredClone(metrics);
  for (const metric of result.filter((entry) => entry.phase === 'resident-batch')) {
    const durationMs = durationsMs[metric.batchIndex - 1];
    const startTimestampNs = BigInt(metric.batchIndex * 1_000_000);
    const durationNs = BigInt(Math.round(durationMs * 1e6));
    metric.probeResidentBatchTiming = {
      schema: 'peercompute.ulg.sph-probe-resident-batch-timing.v0',
      gpuTimestampInterval: {
        schema: 'peercompute.ulg.sph-probe-gpu-queue-interval.v0',
        requested: true,
        batchIndex: metric.batchIndex,
        status: 'gpu-timestamp-interval-complete',
        timestampUnit: 'nanoseconds',
        timestampProfilingRequested: true,
        timestampQuerySupported: true,
        requiredFeatures: ['timestamp-query'],
        enabledFeatures: ['timestamp-query'],
        queryCount: 2,
        validQueryCount: 2,
        invalidQueryCount: 0,
        markerSubmissionCount: 2,
        queryResolveByteLength: 16,
        mappedReadbackByteLength: 16,
        mapAsyncCount: 1,
        startTimestampNs: startTimestampNs.toString(),
        endTimestampNs: (startTimestampNs + durationNs).toString(),
        durationNs: Number(durationNs),
        durationMs,
        intervalSemantics:
          'same-queue-start-to-end-markers-includes-production-work-and-queue-idle'
      }
    };
  }
  return result;
}

function pairedTimestampCampaignRuns({
  candidateScale = 1.04,
  orders = ['AB', 'BA', 'AB']
} = {}) {
  const fingerprint = 'a'.repeat(64);
  const commonConfigSignature = 'b'.repeat(64);
  const baselineArmConfigSignature = 'c'.repeat(64);
  const candidateArmConfigSignature = 'd'.repeat(64);
  const gitHead = 'e'.repeat(40);
  const timestamp = (p50Ms, p95Ms) => ({
    schema: 'peercompute.ulg.sph-performance-gpu-queue-interval-evidence.v0',
    status: 'complete',
    requested: true,
    warmupBatchCount: 4,
    measuredSampleCount: 9,
    batchCoverageComplete: true,
    measurementCoverageComplete: true,
    percentileEstimator: 'nearest-rank-ceil-nq',
    p50Ms,
    p95Ms
  });
  const provenance = (armConfigSignature) => ({
    gitHead,
    sourceFingerprintBefore: fingerprint,
    sourceFingerprintAfter: fingerprint,
    commonConfigSignature,
    armConfigSignature,
    worktreeDirtyBefore: true,
    worktreeDirtyAfter: true
  });
  const baselineScenario = {
    schroederSimulationConfiguredRequested: true,
    schroederTransactionCoverageComplete: true,
    schroederTwoLevelMechanicsConfiguredRequested: false
  };
  const candidateScenario = {
    schroederSimulationConfiguredRequested: true,
    schroederTransactionCoverageComplete: true,
    schroederTwoLevelMechanicsConfiguredRequested: true,
    schroederTwoLevelMechanicsRequestedObserved: true,
    schroederTwoLevelMechanicsCoverageComplete: true,
    schroederTwoLevelMechanicsAuthorityRequested: 'authoritative',
    schroederTwoLevelMechanicsAuthorityObserved: 'authoritative',
    schroederTwoLevelAuthoritativeCommitVerified: true
  };
  return orders.map((order, index) => {
    const baselineP50 = 10 + index;
    const baselineP95 = 12 + index;
    return {
      runId: `run-${index + 1}`,
      order,
      baseline: {
        gpuTimestampIntervalEvidence: timestamp(baselineP50, baselineP95),
        sourceProvenance: provenance(baselineArmConfigSignature),
        scenario: baselineScenario
      },
      candidate: {
        gpuTimestampIntervalEvidence: timestamp(
          baselineP50 * candidateScale,
          baselineP95 * candidateScale
        ),
        sourceProvenance: provenance(candidateArmConfigSignature),
        scenario: candidateScenario
      }
    };
  });
}

function pairedThroughputCampaignRuns({
  candidateScale = 0.96,
  orders = ['AB', 'BA', 'AB']
} = {}) {
  const commonConfigSignature = 'c'.repeat(64);
  const armConfigSignature = 'd'.repeat(64);
  const provenance = ({
    gitHead,
    fingerprint,
    statusHash,
    dirty
  }) => ({
    gitHead,
    sourceFingerprintBefore: fingerprint,
    sourceFingerprintAfter: fingerprint,
    worktreeDirtyBefore: dirty,
    worktreeDirtyAfter: dirty,
    worktreeStatusHashBefore: statusHash,
    worktreeStatusHashAfter: statusHash,
    trackedAndUntrackedFileCountBefore: 100,
    trackedAndUntrackedFileCountAfter: 100,
    commonConfigSignature,
    armConfigSignature
  });
  const scenario = (physicsStepsPerSecond) => ({
    status: 'good',
    probeMode: 'scene',
    batches: 5,
    batchSteps: 16,
    completedStepCount: 16,
    physicsStepsPerSecond,
    physicsStepsPerSecondSource: 'complete-engine-batch',
    schroederSimulationConfiguredRequested: true,
    schroederSimulationActive: true,
    schroederTransactionCoverageComplete: true,
    schroederTwoLevelMechanicsConfiguredRequested: false,
    schroederTwoLevelMechanicsRequestedObserved: false,
    probeIssues: []
  });
  return [100, 110, 90].map((baselineFps, index) => ({
    runId: `throughput-pair-${index + 1}`,
    order: orders[index],
    baseline: {
      process: { exitCode: 0 },
      reportStatus: 'complete',
      reportPerformanceGateStatus: 'pass',
      scenarioStatus: 'good',
      scenario: scenario(baselineFps),
      sourceProvenance: provenance({
        gitHead: 'e'.repeat(40),
        fingerprint: 'a'.repeat(64),
        statusHash: '1'.repeat(64),
        dirty: false
      })
    },
    candidate: {
      process: { exitCode: 0 },
      reportStatus: 'complete',
      reportPerformanceGateStatus: 'pass',
      scenarioStatus: 'good',
      scenario: scenario(baselineFps * candidateScale),
      sourceProvenance: provenance({
        gitHead: 'f'.repeat(40),
        fingerprint: 'b'.repeat(64),
        statusHash: '2'.repeat(64),
        dirty: true
      })
    }
  }));
}

function pairedSpatialArenaDepthCampaignRuns({
  comparisonScale = 1.05,
  orders = ['AB', 'BA', 'AB']
} = {}) {
  const commonConfigSignature = 'c'.repeat(64);
  const referenceArmConfigSignature = '3'.repeat(64);
  const comparisonArmConfigSignature = '8'.repeat(64);
  const provenance = (armConfigSignature) => ({
    gitHead: 'e'.repeat(40),
    sourceFingerprintBefore: 'a'.repeat(64),
    sourceFingerprintAfter: 'a'.repeat(64),
    worktreeDirtyBefore: true,
    worktreeDirtyAfter: true,
    worktreeStatusHashBefore: '1'.repeat(64),
    worktreeStatusHashAfter: '1'.repeat(64),
    trackedAndUntrackedFileCountBefore: 100,
    trackedAndUntrackedFileCountAfter: 100,
    commonConfigSignature,
    armConfigSignature
  });
  const scenario = ({ physicsStepsPerSecond, arenaCount, backpressureWaitCount }) => ({
    status: 'good',
    probeMode: 'scene',
    scenarioUrl: `https://benchmark.invalid/?ss=1&schroederLevel=0&schroederMaxLevel=0&schroederCrossLevelCoupling=0&schroederSpatialArenaCount=${arenaCount}`,
    batches: 7,
    batchSteps: 16,
    completedStepCount: 16,
    physicsStepsPerSecond,
    physicsStepsPerSecondSource: 'complete-engine-batch',
    schroederSimulationConfiguredRequested: true,
    schroederSimulationActive: true,
    schroederTransactionCoverageComplete: true,
    schroederTwoLevelMechanicsConfiguredRequested: false,
    schroederTwoLevelMechanicsRequestedObserved: false,
    schroederSpatialArenaCountRequested: arenaCount,
    schroederSpatialArenaCountsObserved: [arenaCount],
    schroederSpatialArenaCountCoverageComplete: true,
    schroederBackpressureWaitCount: backpressureWaitCount,
    schroederBackpressureWaitMs: backpressureWaitCount * 0.5,
    probeIssues: []
  });
  return [100, 110, 90].map((referenceFps, index) => ({
    runId: `arena-depth-pair-${index + 1}`,
    order: orders[index],
    baseline: {
      process: { exitCode: 0 },
      reportStatus: 'complete',
      reportPerformanceGateStatus: 'pass',
      scenarioStatus: 'good',
      scenario: scenario({
        physicsStepsPerSecond: referenceFps,
        arenaCount: 3,
        backpressureWaitCount: 16
      }),
      sourceProvenance: provenance(referenceArmConfigSignature)
    },
    candidate: {
      process: { exitCode: 0 },
      reportStatus: 'complete',
      reportPerformanceGateStatus: 'pass',
      scenarioStatus: 'good',
      scenario: scenario({
        physicsStepsPerSecond: referenceFps * comparisonScale,
        arenaCount: 8,
        backpressureWaitCount: 2
      }),
      sourceProvenance: provenance(comparisonArmConfigSignature)
    }
  }));
}

function gpuStageTimestampMetric({
  batchIndex = 1,
  generationCount = 4,
  traversalCount = 1,
  additionalProducerIds = []
} = {}) {
  const producerIds = [
    ...Array.from({ length: generationCount }, () =>
      'schroeder-spatial-key-emission'),
    ...Array.from({ length: generationCount }, () =>
      'webgpu-stable-radix-sort'),
    ...Array.from({ length: generationCount }, () =>
      'webgpu-sorted-unique'),
    ...Array.from({ length: generationCount }, () =>
      'schroeder-spatial-derived-view-build'),
    ...Array.from({ length: traversalCount }, () =>
      'schroeder-spatial-aggregate-traversal'),
    ...additionalProducerIds
  ];
  const spans = producerIds.map((producerId, index) => {
    const startTimestampNs = BigInt(1_000_000 + index * 2_000_000);
    const durationNs = 1_000_000;
    const groupedProducer = producerId === 'webgpu-stable-radix-sort'
      || producerId === 'webgpu-sorted-unique';
    const residentQueueProducer = producerId.startsWith(
      'mls-mpm-resident:'
    );
    const hierarchyQueueProducer = producerId.startsWith(
      'schroeder-hierarchy:'
    );
    return {
      schema: 'peercompute.ulg.sph-probe-gpu-stage-span.v0',
      producerId,
      stage: producerId,
      spanClass: groupedProducer
        ? 'same-grouped-production-compute-pass'
        : (residentQueueProducer
          ? 'resident-queue-stage'
          : (hierarchyQueueProducer
            ? 'hierarchy-queue-stage'
            : 'same-production-command-encoder')),
      markerSubmissionMode: residentQueueProducer || hierarchyQueueProducer
        ? 'same-queue-boundary-submissions'
        : 'same-production-command-encoder',
      startQueryIndex: index * 2,
      endQueryIndex: index * 2 + 1,
      startTimestampNs: startTimestampNs.toString(),
      endTimestampNs: (startTimestampNs + BigInt(durationNs)).toString(),
      durationNs,
      durationMs: 1,
      valid: true
    };
  });
  return {
    phase: 'resident-batch',
    batchIndex,
    probeResidentBatchTiming: {
      gpuStageTimestamps: {
        schema: 'peercompute.ulg.sph-probe-gpu-stage-timestamps.v0',
        status: 'gpu-stage-timestamps-complete',
        requested: true,
        batchIndex,
        timestampUnit: 'nanoseconds',
        productionPassGroupingPreserved: true,
        queryCount: spans.length * 2,
        spanCount: spans.length,
        validSpanCount: spans.length,
        invalidSpanCount: 0,
        markerSubmissionCount: 0,
        queryResolveByteLength: spans.length * 16,
        mappedReadbackByteLength: spans.length * 16,
        resolveSubmissionCount: 1,
        mapAsyncCount: 1,
        spans
      }
    }
  };
}

function reactionStageEvidence({
  targetDurationMs,
  segmentedPlacement
}) {
  const metrics = Array.from({ length: 13 }, (_, index) => {
    const metric = gpuStageTimestampMetric({
      batchIndex: index + 1,
      generationCount: 4,
      traversalCount: 1,
      additionalProducerIds: [
        'schroeder-hierarchy:two-level-post-mechanics-reaction-discovery-proposal',
        'schroeder-hierarchy:two-level-post-mechanics-thermal-proposal',
        'schroeder-hierarchy:two-level-post-mechanics-reactionStep',
        segmentedPlacement
          ? 'sph-reaction-summary:product-event-placement:capture-radix'
          : 'sph-reaction-summary:product-event-placement'
      ]
    });
    const targetSpan = metric.probeResidentBatchTiming.gpuStageTimestamps
      .spans.find((span) => (
        span.producerId
          === 'schroeder-hierarchy:two-level-post-mechanics-reactionStep'
      ));
    const durationNs = Math.round(targetDurationMs * 1e6);
    targetSpan.endTimestampNs = String(
      BigInt(targetSpan.startTimestampNs) + BigInt(durationNs)
    );
    targetSpan.durationNs = durationNs;
    targetSpan.durationMs = durationNs / 1e6;
    return metric;
  });
  return summarizeResidentGpuStageTimestampEvidence({
    metrics,
    requested: true,
    requestedBatchCount: 13,
    requestedBatchStepCount: 1,
    warmupBatchCount: 4,
    twoLevelAuthoritative: true,
    twoLevelFineSubstepCount: 2,
    requireMigratedLawCoverage: true,
    lawThermalEnabled: true,
    lawReactionsEnabled: true
  });
}

function completeGpuIntervalEvidence() {
  return {
    schema: 'peercompute.ulg.sph-performance-gpu-queue-interval-evidence.v0',
    status: 'complete',
    requested: true,
    warmupBatchCount: 4,
    measuredSampleCount: 9,
    batchCoverageComplete: true,
    measurementCoverageComplete: true,
    percentileEstimator: 'nearest-rank-ceil-nq',
    p50Ms: 500,
    p95Ms: 550
  };
}

function reactionHistoricalScenario(gpuStageTimestampEvidence) {
  return {
    status: 'good',
    exitCode: 0,
    probeMode: 'scene',
    targetParticleCount: 1000,
    actualParticleCount: 1024,
    effectiveParticleCount: 1024,
    batches: 13,
    batchSteps: 1,
    completedStepCount: 1,
    scenarioUrl:
      '/?drop=na&base=h2o&dropt=300&baset=300&dropn=8&basen=8&mech=mlsmpm&ss=1&schroederLevel=0&schroederMaxLevel=1&schroederCrossLevelCoupling=1&schroederTwoLevel=1&schroederTwoLevelAuthority=authoritative&schroederTwoLevelSubsteps=2&residentGpuTimestampProfile=1&lawr=1',
    schroederSimulationConfiguredRequested: true,
    schroederSimulationRequestedObserved: true,
    schroederSimulationActive: true,
    schroederTransactionCoverageComplete: true,
    schroederSelectedLevel: 0,
    schroederTwoLevelMechanicsConfiguredRequested: true,
    schroederTwoLevelMechanicsRequestedObserved: true,
    schroederTwoLevelMechanicsCoverageComplete: true,
    schroederTwoLevelMechanicsAuthorityRequested: 'authoritative',
    schroederTwoLevelMechanicsAuthorityObserved: 'authoritative',
    schroederTwoLevelFineSubstepCountRequested: 2,
    schroederTwoLevelFineSubstepCountObserved: 2,
    schroederTwoLevelMechanicsStepStatus:
      'schroeder-two-level-authoritative-step-executed',
    schroederTwoLevelAuthoritativeCommitVerified: true,
    performanceGate: {
      status: 'pass',
      blockers: []
    },
    gpuTimestampIntervalEvidence: completeGpuIntervalEvidence(),
    gpuStageTimestampEvidence
  };
}

function pairedReactionStageProducerCampaignRuns({
  candidateScale = 1.04,
  orders = ['AB', 'BA', 'AB'],
  candidateSerialPlacement = false
} = {}) {
  const expectedBaselineGitHead =
    '6c20c32b814a0e4cb66ff973fb4cc225659f3f25';
  const commonConfigSignature = '1'.repeat(64);
  const armConfigSignature = '2'.repeat(64);
  const provenance = ({ baseline }) => ({
    gitHead: baseline ? expectedBaselineGitHead : 'f'.repeat(40),
    sourceFingerprintBefore: baseline ? 'a'.repeat(64) : 'b'.repeat(64),
    sourceFingerprintAfter: baseline ? 'a'.repeat(64) : 'b'.repeat(64),
    worktreeDirtyBefore: !baseline,
    worktreeDirtyAfter: !baseline,
    worktreeStatusHashBefore: baseline ? '3'.repeat(64) : '4'.repeat(64),
    worktreeStatusHashAfter: baseline ? '3'.repeat(64) : '4'.repeat(64),
    trackedAndUntrackedFileCountBefore: baseline ? 500 : 525,
    trackedAndUntrackedFileCountAfter: baseline ? 500 : 525,
    commonConfigSignature,
    armConfigSignature
  });
  const arm = ({ baseline, targetDurationMs }) => {
    const stageEvidence = reactionStageEvidence({
      targetDurationMs,
      segmentedPlacement: baseline || candidateSerialPlacement
        ? false
        : true
    });
    return {
      process: { exitCode: 0 },
      reportStatus: 'complete',
      reportPerformanceGateStatus: 'pass',
      scenarioStatus: 'good',
      gpuTimestampIntervalEvidence: completeGpuIntervalEvidence(),
      gpuStageTimestampEvidence: stageEvidence,
      scenario: reactionHistoricalScenario(stageEvidence),
      sourceProvenance: provenance({ baseline })
    };
  };
  return [340, 345, 350].map((baselineP50Ms, index) => ({
    runId: `reaction-stage-pair-${index + 1}`,
    order: orders[index],
    baseline: arm({ baseline: true, targetDurationMs: baselineP50Ms }),
    candidate: arm({
      baseline: false,
      targetDurationMs: baselineP50Ms * candidateScale
    })
  }));
}

test('SS benchmark preserves only buffer-free admitted receipt telemetry', () => {
  const metrics = completeMetrics();
  const receiptTelemetry = finalizedReactionReceiptTelemetry();
  metrics[1].residentSteps.schroederSpatialEpochTransactionSummaries[0]
    .admittedReaders = [{ receiptTelemetry }];

  const evidence = aggregate(metrics);
  assert.deepEqual(evidence.admittedConsumerReceiptTelemetry, [receiptTelemetry]);
  assert.equal(
    'proposalBuffer' in evidence.admittedConsumerReceiptTelemetry[0],
    false
  );
  assert.equal(
    'evidenceBuffer' in evidence.admittedConsumerReceiptTelemetry[0],
    false
  );
});

test('SS benchmark emits ICC receipt proof only for a finalized no-fallback WebGPU reaction receipt', () => {
  const receiptTelemetry = finalizedReactionReceiptTelemetry();
  const events = buildSchroederReactionReceiptIccTrace({
    scenarios: [{
      targetParticleCount: 1024,
      schroederSimulationActive: true,
      schroederTransactionCoverageComplete: true,
      schroederAdmittedConsumerReceiptTelemetry: [receiptTelemetry]
    }],
    reportPath: '/tmp/ulg-reaction-receipt.json'
  });

  assert.equal(events.length, 2);
  assert.equal(events[0].kind, 'function_called');
  assert.equal(
    events[0].name,
    'finalizeSchroederSpatialExactNearConsumerReceipt'
  );
  assert.equal(events[1].kind, 'test_result');
  assert.equal(events[1].status, 'PASS');
  assert.equal(events[1].value.backend, 'webgpu');
  assert.equal(events[1].value.fallbackIntent, 'forbidden');
  assert.equal(events[1].value.receiptCount, 1);

  assert.deepEqual(buildSchroederReactionReceiptIccTrace({
    scenarios: [{
      schroederSimulationActive: true,
      schroederTransactionCoverageComplete: true,
      schroederAdmittedConsumerReceiptTelemetry: [
        finalizedReactionReceiptTelemetry({ fallbackObserved: true })
      ]
    }]
  }), []);
});

test('benchmark scenario params explicitly mount authoritative two-level mechanics', () => {
  const params = createSchroederBenchmarkScenarioParams({
    simulationRequested: true,
    selectedLevel: 3,
    maxLevel: 3,
    spatialArenaCount: 8,
    crossLevelCouplingRequested: true,
    twoLevelMechanicsRequested: true,
    twoLevelMechanicsAuthority: 'authoritative',
    twoLevelFineSubstepCount: 4
  });

  assert.equal(params.ss, '1');
  assert.equal(params.schroederLevel, '3');
  assert.equal(params.schroederMaxLevel, '4');
  assert.equal(params.schroederSpatialArenaCount, '8');
  assert.equal(params.schroederCrossLevelCoupling, '1');
  assert.equal(params.schroederTwoLevel, '1');
  assert.equal(params.schroederTwoLevelAuthority, 'authoritative');
  assert.equal(params.schroederTwoLevelSubsteps, '4');
  assert.deepEqual(createSchroederBenchmarkScenarioParams(), {});
});

test('benchmark scene geometry derives a touching base height from its particle edge', () => {
  const scenario = scenarioUrlForCount(1024);
  const params = new URL(`https://benchmark.invalid${scenario.url}`).searchParams;

  assert.equal(scenario.edge, 8);
  assert.equal(scenario.actualParticleCount, 1024);
  assert.equal(scenario.iceBaseHeightM, 0);
  assert.equal(scenario.baseBlockEdgeM, 1.6);
  assert.equal(scenario.ironBaseHeightM, 1.6);
  assert.equal(scenario.ironBaseHeightSource, 'derived-touching-base-block-edge');
  assert.equal(params.get('iceh'), '0');
  assert.equal(params.get('ironh'), '1.6');
  assert.equal(params.get('basen'), '8');
  assert.equal(params.get('dropn'), '8');
});

test('current resident surface telemetry outranks a stale render-state snapshot', () => {
  const current = currentResidentSurfaceDrawEvidence({
    surfaceDraw: {
      status: 'resident-extension-surface-draw-buffers-retained',
      visibleRendererBridge: 'native-webgpu-surface-consumer',
      gpuBufferHandoffReady: true,
      gpuBufferHandoffKind: 'surface-draw-buffers',
      gpuBufferHandoffUpperBoundVertexCount: 18,
      drawIndirectRowsBufferByteLength: 16,
      compactPositionRowsBufferByteLength: 288,
      visibleRenderSource: 'resident-surface-draw-native-webgpu-consumer'
    },
    renderState: {
      surfaceDrawStatus: 'resident-surface-draw-unavailable',
      surfaceDrawVisibleRendererBridge: 'pending-three-webgpu-binding',
      surfaceDrawGpuBufferHandoffReady: false,
      surfaceDrawGpuBufferHandoffKind: null,
      surfaceDrawGpuBufferHandoffUpperBoundVertexCount: 0,
      surfaceDrawIndirectRowsBufferByteLength: 0,
      surfaceDrawCompactPositionRowsBufferByteLength: 0,
      surfaceDrawVisibleRenderSource: 'three-marching-cubes-fallback'
    }
  });

  assert.equal(current.status, 'resident-extension-surface-draw-buffers-retained');
  assert.equal(current.bridge, 'native-webgpu-surface-consumer');
  assert.equal(current.gpuBufferHandoffReady, true);
  assert.equal(current.gpuBufferHandoffKind, 'surface-draw-buffers');
  assert.equal(current.gpuBufferHandoffUpperBoundVertexCount, 18);
  assert.equal(current.indirectRowsBufferByteLength, 16);
  assert.equal(current.compactPositionRowsBufferByteLength, 288);
  assert.equal(current.source, 'resident-surface-draw-native-webgpu-consumer');

  const directFailure = currentResidentSurfaceDrawEvidence({
    surfaceDraw: {
      gpuBufferHandoffReady: false,
      drawIndirectRowsBufferByteLength: 0
    },
    renderState: {
      surfaceDrawGpuBufferHandoffReady: true,
      surfaceDrawIndirectRowsBufferByteLength: 16
    }
  });
  assert.equal(directFailure.gpuBufferHandoffReady, false);
  assert.equal(directFailure.indirectRowsBufferByteLength, 0);

  const fallback = currentResidentSurfaceDrawEvidence({
    renderState: {
      surfaceDrawStatus: 'resident-surface-draw-snapshot-only',
      surfaceDrawGpuBufferHandoffReady: true,
      surfaceDrawIndirectRowsBufferByteLength: 16
    }
  });
  assert.equal(fallback.status, 'resident-surface-draw-snapshot-only');
  assert.equal(fallback.gpuBufferHandoffReady, true);
  assert.equal(fallback.indirectRowsBufferByteLength, 16);
});

test('benchmark SS control params leave two-level mechanics absent', () => {
  const params = createSchroederBenchmarkScenarioParams({
    simulationRequested: true,
    selectedLevel: 3,
    maxLevel: 3,
    crossLevelCouplingRequested: true,
    twoLevelMechanicsRequested: false
  });

  assert.equal(params.ss, '1');
  assert.equal(params.schroederLevel, '3');
  assert.equal(params.schroederMaxLevel, '3');
  assert.equal(params.schroederCrossLevelCoupling, '1');
  assert.equal('schroederTwoLevel' in params, false);
  assert.equal('schroederTwoLevelAuthority' in params, false);
  assert.equal('schroederTwoLevelSubsteps' in params, false);
});

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

test('SS performance evidence proves the requested direct spatial arena depth', () => {
  const metrics = completeMetrics();
  for (const metric of metrics.filter((entry) => entry.phase === 'resident-batch')) {
    for (const summary of metric.residentSteps
      .schroederSpatialEpochGenerationSummaries) {
      summary.directArenaCount = 8;
      summary.arenaCapacity = 8;
    }
  }
  const evidence = aggregateSchroederResidentBatchEvidence({
    metrics,
    requestedBatchCount: 2,
    requestedBatchStepCount: 2,
    schroederSimulationRequested: true,
    schroederSpatialArenaCount: 8
  });

  assert.equal(evidence.requestedSpatialArenaCount, 8);
  assert.deepEqual(evidence.observedSpatialArenaCounts, [8]);
  assert.equal(evidence.spatialArenaCountCoverageComplete, true);

  metrics[1].residentSteps.schroederSpatialEpochGenerationSummaries[0]
    .arenaCapacity = 3;
  assert.equal(aggregateSchroederResidentBatchEvidence({
    metrics,
    requestedBatchCount: 2,
    requestedBatchStepCount: 2,
    schroederSimulationRequested: true,
    schroederSpatialArenaCount: 8
  }).spatialArenaCountCoverageComplete, false);
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

test('SS performance gate fails closed when a requested arena depth is not observed', () => {
  const evidence = scenarioPerformanceGate({
    estimatedReadbackBytesPerStep: 0,
    schroederSimulationRequested: true,
    schroederSimulationRequestedObserved: true,
    schroederSimulationActive: true,
    schroederTransactionCoverageComplete: true,
    schroederSpatialArenaCountRequested: 8,
    schroederSpatialArenaCountCoverageComplete: false
  });

  assert.equal(evidence.status, 'fail');
  assert.ok(evidence.blockers.includes(
    'schroeder-spatial-arena-count-coverage-incomplete'
  ));
});

test('authoritative two-level performance evidence covers every step in every batch', () => {
  const evidence = aggregateAuthoritativeTwoLevel(authoritativeTwoLevelMetrics());

  assert.equal(evidence.transactionCoverageComplete, true);
  assert.equal(evidence.twoLevelMechanicsCoverageComplete, true);
  assert.equal(evidence.twoLevelAuthoritativeStepCount, 4);
  assert.deepEqual(
    evidence.batchCoverage.map((batch) => batch.twoLevelAuthoritativeStepCount),
    [2, 2]
  );

  const oneSameLevelFallback = authoritativeTwoLevelMetrics();
  oneSameLevelFallback[1].residentSteps.schroederTwoLevelAuthoritativeStepCount = 1;
  oneSameLevelFallback[1].schroederTelemetry.twoLevelAuthoritativeStepCount = 1;
  oneSameLevelFallback[1].schroederTelemetry.twoLevelMechanicsCoverageComplete = false;
  assert.equal(
    aggregateAuthoritativeTwoLevel(oneSameLevelFallback)
      .twoLevelMechanicsCoverageComplete,
    false
  );

  const tornStepCount = authoritativeTwoLevelMetrics();
  tornStepCount[1].schroederTelemetry.twoLevelAuthoritativeStepCount = 1;
  assert.equal(
    aggregateAuthoritativeTwoLevel(tornStepCount)
      .twoLevelMechanicsCoverageComplete,
    false
  );
});

test('authoritative private substeps may consume generation and position ordinals between outer ticks', () => {
  const applyPrivateOrdinalGaps = (metrics) => {
    let generationId = 41;
    let positionEpoch = 20;
    for (const metric of metrics.filter((entry) => entry.phase === 'resident-batch')) {
      const transactions = metric.residentSteps.schroederSpatialEpochTransactionSummaries;
      const generations = metric.residentSteps.schroederSpatialEpochGenerationSummaries;
      const ledgers = metric.residentSteps.schroederHierarchyArtifactLedgerSummaries;
      for (let index = 0; index < transactions.length; index += 1) {
        transactions[index].generationId = generationId;
        transactions[index].epochIdentity.positionEpoch = positionEpoch;
        generations[index].generationId = generationId;
        ledgers[index].generationId = generationId;
        ledgers[index].spatialEpochGenerationId = generationId;
        generationId += 4;
        positionEpoch += 3;
      }
    }
    return metrics;
  };

  const authoritative = aggregateAuthoritativeTwoLevel(
    applyPrivateOrdinalGaps(authoritativeTwoLevelMetrics())
  );
  assert.equal(authoritative.transactionGenerationSequence.contiguous, false);
  assert.equal(authoritative.transactionPositionEpochSequence.contiguous, false);
  assert.equal(authoritative.transactionGenerationSequence.complete, true);
  assert.equal(authoritative.transactionPositionEpochSequence.complete, true);
  assert.equal(authoritative.stepIdentityCoverageComplete, true);
  assert.equal(authoritative.generationCoverageComplete, true);
  assert.equal(authoritative.transactionCoverageComplete, true);

  const sameLevel = aggregate(applyPrivateOrdinalGaps(completeMetrics()));
  assert.equal(sameLevel.transactionGenerationSequence.contiguous, false);
  assert.equal(sameLevel.transactionPositionEpochSequence.contiguous, false);
  assert.equal(sameLevel.stepIdentityCoverageComplete, false);
  assert.equal(sameLevel.transactionCoverageComplete, false);
});

test('same-level reaction placement epoch floors require an exact authenticated successor chain', () => {
  const valid = aggregate(sameLevelReactionPlacementFloorMetrics());
  assert.equal(valid.transactionPositionEpochSequence.contiguous, false);
  assert.equal(valid.transactionPositionEpochSequence.complete, true);
  assert.equal(
    valid.transactionPositionEpochTransitionEvidence.authenticatedPlacementTransitionCount,
    3
  );
  assert.equal(
    valid.transactionPositionEpochTransitionEvidence.rejectedTransitionCount,
    0
  );
  assert.equal(valid.stepIdentityCoverageComplete, true);
  assert.equal(valid.transactionCoverageComplete, true);

  const missing = sameLevelReactionPlacementFloorMetrics();
  delete missing[1].residentSteps.schroederSpatialEpochTransactionSummaries[0]
    .successorEpochEvidence;
  assert.equal(aggregate(missing).transactionCoverageComplete, false);

  const mismatched = sameLevelReactionPlacementFloorMetrics();
  mismatched[1].residentSteps.schroederSpatialEpochTransactionSummaries[0]
    .successorEpochEvidence.successorEpochIdentity.positionEpoch += 1;
  assert.equal(aggregate(mismatched).transactionCoverageComplete, false);

  const unauthenticated = sameLevelReactionPlacementFloorMetrics();
  unauthenticated[1].residentSteps.schroederSpatialEpochTransactionSummaries[0]
    .successorEpochEvidence.authenticated = false;
  assert.equal(aggregate(unauthenticated).transactionCoverageComplete, false);

  const unsupportedGap = sameLevelReactionPlacementFloorMetrics();
  const gapTarget = unsupportedGap[1]
    .residentSteps.schroederSpatialEpochTransactionSummaries[1];
  gapTarget.epochIdentity.positionEpoch += 1;
  assert.equal(aggregate(unsupportedGap).transactionCoverageComplete, false);

  const contradictoryContiguousProof = sameLevelReactionPlacementFloorMetrics();
  const contiguousTransactions = contradictoryContiguousProof
    .filter((metric) => metric.phase === 'resident-batch')
    .flatMap((metric) => metric.residentSteps.schroederSpatialEpochTransactionSummaries);
  for (let index = 0; index < contiguousTransactions.length; index += 1) {
    contiguousTransactions[index].epochIdentity.positionEpoch = 20 + index;
  }
  assert.equal(
    aggregate(contradictoryContiguousProof).transactionCoverageComplete,
    false
  );
});

test('performance gate fails closed when authoritative two-level proof is incomplete', () => {
  const evidence = scenarioPerformanceGate({
    estimatedReadbackBytesPerStep: 0,
    schroederSimulationRequested: true,
    schroederSimulationRequestedObserved: true,
    schroederSimulationActive: true,
    schroederTransactionCoverageComplete: true,
    schroederTwoLevelMechanicsRequested: true,
    schroederTwoLevelMechanicsRequestedObserved: true,
    schroederTwoLevelMechanicsCoverageComplete: false,
    schroederTwoLevelMechanicsAuthorityRequested: 'authoritative',
    schroederTwoLevelMechanicsAuthorityObserved: 'observation',
    schroederTwoLevelFineSubstepCountRequested: 2,
    schroederTwoLevelFineSubstepCountObserved: 1,
    schroederTwoLevelMechanicsStepStatus: 'resident-step-webgpu-executed',
    schroederTwoLevelAuthoritativeCommitVerified: false
  });

  assert.equal(evidence.status, 'fail');
  assert.ok(evidence.blockers.includes('schroeder-two-level-batch-coverage-incomplete'));
  assert.ok(evidence.blockers.includes('schroeder-two-level-authority-mismatch'));
  assert.ok(evidence.blockers.includes('schroeder-two-level-substep-count-mismatch'));
  assert.ok(evidence.blockers.includes('schroeder-two-level-authoritative-step-not-executed'));
  assert.ok(evidence.blockers.includes('schroeder-two-level-authoritative-commit-unverified'));
});

test('GPU timestamp evidence requires every batch and excludes warmups from percentiles', () => {
  const metrics = withGpuTimestampIntervals(completeMetrics(), [4, 6]);
  const evidence = summarizeResidentGpuTimestampEvidence({
    metrics,
    requested: true,
    requestedBatchCount: 2,
    warmupBatchCount: 1
  });

  assert.equal(evidence.status, 'complete');
  assert.equal(evidence.batchCoverageComplete, true);
  assert.equal(evidence.measurementCoverageComplete, true);
  assert.equal(evidence.warmupBatchCount, 1);
  assert.equal(evidence.measuredSampleCount, 1);
  assert.equal(evidence.p50Ms, 6);
  assert.equal(evidence.p95Ms, 6);
  assert.equal(evidence.percentileEstimator, 'nearest-rank-ceil-nq');
  assert.deepEqual(evidence.profilingOverhead, {
    markerSubmissionCount: 4,
    queryResolveByteLength: 32,
    mappedReadbackByteLength: 32,
    mapAsyncCount: 2,
    productionHotStateReadback: false,
    classification: 'benchmark-only-timestamp-query-readback'
  });
  assert.deepEqual(evidence.samples.map((sample) => sample.warmup), [true, false]);
});

test('GPU timestamp evidence and performance gate fail closed on partial queries', () => {
  const metrics = withGpuTimestampIntervals(completeMetrics());
  metrics[1].probeResidentBatchTiming.gpuTimestampInterval.validQueryCount = 1;
  metrics[1].probeResidentBatchTiming.gpuTimestampInterval.invalidQueryCount = 1;
  const evidence = summarizeResidentGpuTimestampEvidence({
    metrics,
    requested: true,
    requestedBatchCount: 2
  });

  assert.equal(evidence.status, 'incomplete');
  assert.equal(evidence.batchCoverageComplete, false);
  assert.equal(evidence.invalidSampleCount, 1);
  const gate = scenarioPerformanceGate({
    estimatedReadbackBytesPerStep: 0,
    gpuTimestampIntervalEvidence: evidence,
    gpuTimestampRequired: true
  });
  assert.equal(gate.status, 'fail');
  assert.ok(gate.blockers.includes('gpu-timestamp-interval-evidence-incomplete'));
});

test('GPU timestamp evidence rejects stale identity, inconsistent duration, and torn batches', () => {
  const staleSchema = withGpuTimestampIntervals(completeMetrics());
  staleSchema[1].probeResidentBatchTiming.gpuTimestampInterval.schema = 'stale.v0';
  assert.equal(summarizeResidentGpuTimestampEvidence({
    metrics: staleSchema,
    requested: true,
    requestedBatchCount: 2
  }).status, 'incomplete');

  const wrongBatch = withGpuTimestampIntervals(completeMetrics());
  wrongBatch[1].probeResidentBatchTiming.gpuTimestampInterval.batchIndex = 2;
  assert.equal(summarizeResidentGpuTimestampEvidence({
    metrics: wrongBatch,
    requested: true,
    requestedBatchCount: 2
  }).status, 'incomplete');

  const inconsistentDuration = withGpuTimestampIntervals(completeMetrics());
  inconsistentDuration[1].probeResidentBatchTiming
    .gpuTimestampInterval.durationNs += 1;
  assert.equal(summarizeResidentGpuTimestampEvidence({
    metrics: inconsistentDuration,
    requested: true,
    requestedBatchCount: 2
  }).status, 'incomplete');

  const duplicatedBatch = withGpuTimestampIntervals(completeMetrics());
  duplicatedBatch.push(structuredClone(duplicatedBatch[1]));
  assert.equal(summarizeResidentGpuTimestampEvidence({
    metrics: duplicatedBatch,
    requested: true,
    requestedBatchCount: 2
  }).batchIndexCoverageComplete, false);

  const missingBatch = withGpuTimestampIntervals(completeMetrics()).slice(0, 2);
  assert.equal(summarizeResidentGpuTimestampEvidence({
    metrics: missingBatch,
    requested: true,
    requestedBatchCount: 2
  }).batchIndexCoverageComplete, false);
});

test('coarse GPU stage evidence proves exact authoritative generation and traversal counts', () => {
  const evidence = summarizeResidentGpuStageTimestampEvidence({
    metrics: [gpuStageTimestampMetric()],
    requested: true,
    requestedBatchCount: 1,
    requestedBatchStepCount: 1,
    twoLevelAuthoritative: true,
    twoLevelFineSubstepCount: 2
  });

  assert.equal(evidence.status, 'complete');
  assert.equal(evidence.expectedGenerationCountPerBatch, 4);
  assert.equal(evidence.expectedTraversalCountPerBatch, 1);
  assert.equal(evidence.batchCoverageComplete, true);
  assert.equal(evidence.stageCoverageComplete, true);
  assert.deepEqual(
    evidence.producerSummaries.map((summary) => summary.producerId),
    [
      'schroeder-spatial-aggregate-traversal',
      'schroeder-spatial-derived-view-build',
      'schroeder-spatial-key-emission',
      'webgpu-sorted-unique',
      'webgpu-stable-radix-sort'
    ]
  );
});

test('coarse GPU stage evidence fails closed when one canonical generation span is missing', () => {
  const metric = gpuStageTimestampMetric();
  const stageEvidence = metric.probeResidentBatchTiming.gpuStageTimestamps;
  const removed = stageEvidence.spans.findIndex(
    (span) => span.producerId === 'webgpu-stable-radix-sort'
  );
  stageEvidence.spans.splice(removed, 1);
  stageEvidence.queryCount -= 2;
  stageEvidence.spanCount -= 1;
  stageEvidence.validSpanCount -= 1;
  stageEvidence.queryResolveByteLength -= 16;
  stageEvidence.mappedReadbackByteLength -= 16;
  const evidence = summarizeResidentGpuStageTimestampEvidence({
    metrics: [metric],
    requested: true,
    requestedBatchCount: 1,
    requestedBatchStepCount: 1,
    twoLevelAuthoritative: true,
    twoLevelFineSubstepCount: 2
  });

  assert.equal(evidence.status, 'incomplete');
  assert.equal(evidence.stageCoverageComplete, false);
});

test('coarse GPU stage evidence rejects a grouped pass mislabeled as split instrumentation', () => {
  const metric = gpuStageTimestampMetric();
  metric.probeResidentBatchTiming.gpuStageTimestamps.spans.find(
    (span) => span.producerId === 'webgpu-stable-radix-sort'
  ).spanClass = 'instrumented-dispatch-granular-nonrepresentative';
  const evidence = summarizeResidentGpuStageTimestampEvidence({
    metrics: [metric],
    requested: true,
    requestedBatchCount: 1,
    requestedBatchStepCount: 1,
    twoLevelAuthoritative: true,
    twoLevelFineSubstepCount: 2
  });

  assert.equal(evidence.status, 'incomplete');
  assert.equal(evidence.batches[0].exactProducerContractComplete, false);
});

test('coarse GPU stage evidence maps each shared migrated-law producer once', () => {
  const metric = gpuStageTimestampMetric({
    generationCount: 1,
    traversalCount: 0,
    additionalProducerIds: [
      'mls-mpm-resident:spatialMechanicalProposal',
      'mls-mpm-resident:spatialReactionDiscoveryProposal',
      'mls-mpm-resident:spatialThermalProposal'
    ]
  });
  const evidence = summarizeResidentGpuStageTimestampEvidence({
    metrics: [metric],
    requested: true,
    requestedBatchCount: 1,
    requestedBatchStepCount: 1,
    requireMigratedLawCoverage: true,
    lawThermalEnabled: true,
    lawReactionsEnabled: true
  });

  assert.equal(evidence.status, 'complete');
  assert.equal(evidence.migratedLawCoverageComplete, true);
  assert.deepEqual(evidence.requiredMigratedLawConsumerIds, [
    'pressure-contact-interface',
    'separation',
    'local-material-interface',
    'reaction-discovery',
    'thermal-conduction',
    'thermal-radiation'
  ]);
  const mechanical = evidence.migratedLawConsumerMappings.find(
    (mapping) => mapping.producerId
      === 'mls-mpm-resident:spatialMechanicalProposal'
  );
  assert.equal(mechanical.sharedProducerSpan, true);
  assert.equal(mechanical.sampleCount, 1);
  assert.deepEqual(mechanical.consumerIds, [
    'pressure-contact-interface',
    'separation',
    'local-material-interface'
  ]);
  assert.match(mechanical.aggregationRule, /never-sum/);
});

test('coarse GPU stage evidence fails closed on a missing required law producer', () => {
  const metric = gpuStageTimestampMetric({
    generationCount: 1,
    traversalCount: 0,
    additionalProducerIds: [
      'mls-mpm-resident:spatialMechanicalProposal',
      'mls-mpm-resident:spatialThermalProposal'
    ]
  });
  const evidence = summarizeResidentGpuStageTimestampEvidence({
    metrics: [metric],
    requested: true,
    requestedBatchCount: 1,
    requestedBatchStepCount: 1,
    requireMigratedLawCoverage: true,
    lawThermalEnabled: true,
    lawReactionsEnabled: true
  });

  assert.equal(evidence.status, 'incomplete');
  assert.equal(evidence.stageCoverageComplete, false);
  assert.equal(evidence.migratedLawCoverageComplete, false);
  assert.equal(
    evidence.migratedLawConsumerMappings.find(
      (mapping) => mapping.consumerIds.includes('reaction-discovery')
    ).coverageComplete,
    false
  );
});

test('coarse GPU stage percentiles exclude declared warmup batches', () => {
  const warmup = gpuStageTimestampMetric({
    batchIndex: 1,
    generationCount: 1,
    traversalCount: 0
  });
  const measured = gpuStageTimestampMetric({
    batchIndex: 2,
    generationCount: 1,
    traversalCount: 0
  });
  const measuredKey = measured.probeResidentBatchTiming.gpuStageTimestamps.spans
    .find((span) => span.producerId === 'schroeder-spatial-key-emission');
  measuredKey.endTimestampNs = String(BigInt(measuredKey.startTimestampNs) + 2_000_000n);
  measuredKey.durationNs = 2_000_000;
  measuredKey.durationMs = 2;
  const evidence = summarizeResidentGpuStageTimestampEvidence({
    metrics: [warmup, measured],
    requested: true,
    requestedBatchCount: 2,
    requestedBatchStepCount: 1,
    warmupBatchCount: 1
  });

  assert.equal(evidence.status, 'complete');
  assert.equal(evidence.measuredBatchCount, 1);
  assert.equal(
    evidence.producerSummaries.find(
      (summary) => summary.producerId === 'schroeder-spatial-key-emission'
    ).p50Ms,
    2
  );
});

test('paired GPU timestamp campaign requires three fresh AB/BA runs and applies the five-percent gate', () => {
  const evidence = summarizePairedGpuTimestampRuns({
    runs: pairedTimestampCampaignRuns({ candidateScale: 1.04 })
  });

  assert.equal(evidence.status, 'pass');
  assert.deepEqual(evidence.method.expectedRunOrders, ['AB', 'BA', 'AB']);
  assert.equal(evidence.method.requiredWarmupBatchCount, 4);
  assert.equal(evidence.method.requiredMeasuredSampleCount, 9);
  assert.ok(Math.abs(evidence.paired.medianP50DeltaPercent - 4) < 1e-12);
  assert.ok(Math.abs(evidence.paired.medianP95DeltaPercent - 4) < 1e-12);
  assert.equal(evidence.paired.p50WithinThreshold, true);
  assert.equal(evidence.paired.p95WithinThreshold, true);
  assert.ok(
    Math.abs(evidence.independentMedianCrossCheck.p50Ratio - 1.04) < 1e-12
  );
});

test('paired GPU timestamp campaign fails closed on stale source, bad ordering, sparse samples, and regression', () => {
  const runs = pairedTimestampCampaignRuns({
    candidateScale: 1.06,
    orders: ['AB', 'AB', 'BA']
  });
  runs[0].candidate.sourceProvenance.sourceFingerprintAfter = 'f'.repeat(64);
  runs[1].baseline.gpuTimestampIntervalEvidence.measuredSampleCount = 8;
  runs[2].runId = runs[1].runId;
  const evidence = summarizePairedGpuTimestampRuns({ runs });

  assert.equal(evidence.status, 'fail');
  assert.ok(evidence.blockers.includes('run-identities-missing-or-duplicated'));
  assert.ok(evidence.blockers.includes('run-order-not-ab-ba-alternating'));
  assert.ok(evidence.blockers.includes('baseline-timestamp-evidence-incomplete'));
  assert.ok(evidence.blockers.includes('candidate-source-provenance-incomplete'));
  assert.ok(evidence.blockers.includes('paired-p50-regression-exceeds-threshold'));
  assert.ok(evidence.blockers.includes('paired-p95-regression-exceeds-threshold'));
});

test('target-path paired GPU timestamp campaign can report cost without misapplying the non-target gate', () => {
  const evidence = summarizePairedGpuTimestampRuns({
    runs: pairedTimestampCampaignRuns({ candidateScale: 2.5 }),
    applyRegressionGate: false
  });

  assert.equal(evidence.status, 'pass');
  assert.equal(evidence.method.applyRegressionGate, false);
  assert.equal(evidence.paired.p50WithinThreshold, false);
  assert.equal(evidence.paired.p95WithinThreshold, false);
  assert.equal(
    evidence.blockers.includes('paired-p50-regression-exceeds-threshold'),
    false
  );
});

test('paired historical reaction-step stage campaign accepts exact authoritative segmented evidence', () => {
  const evidence = summarizePairedGpuStageProducerRuns({
    runs: pairedReactionStageProducerCampaignRuns({ candidateScale: 1.04 }),
    expectedBaselineGitHead:
      '6c20c32b814a0e4cb66ff973fb4cc225659f3f25'
  });

  assert.equal(evidence.status, 'pass');
  assert.equal(
    evidence.method.producerId,
    'schroeder-hierarchy:two-level-post-mechanics-reactionStep'
  );
  assert.deepEqual(evidence.method.expectedRunOrders, ['AB', 'BA', 'AB']);
  assert.equal(evidence.method.requiredWarmupBatchCount, 4);
  assert.equal(evidence.method.requiredMeasuredSampleCount, 9);
  assert.ok(Math.abs(evidence.paired.medianP50Ratio - 1.04) < 1e-12);
  assert.ok(Math.abs(evidence.paired.medianP95Ratio - 1.04) < 1e-12);
  assert.equal(evidence.paired.p50WithinThreshold, true);
  assert.equal(evidence.paired.p95WithinThreshold, true);
  assert.equal(
    evidence.independentMedianCrossCheck.p50WithinThreshold,
    true
  );
  assert.equal(
    evidence.independentMedianCrossCheck.p95WithinThreshold,
    true
  );
  assert.equal(evidence.absoluteCandidateCeiling.withinCeiling, true);
  assert.match(
    evidence.absoluteCandidateCeiling.provenance,
    /best-accepted-historical/
  );
  assert.equal(
    evidence.runs.every((run) => (
      run.candidate.segmentedPlacementAttributionComplete
      && run.candidate.serialPlacementSummaryCount === 0
      && run.baseline.historicalDiscoveryIdentityComplete
      && run.candidate.historicalDiscoveryIdentityComplete
    )),
    true
  );
});

test('paired historical reaction-step stage campaign fails closed on provenance, route, and sparse raw spans', () => {
  const runs = pairedReactionStageProducerCampaignRuns({
    orders: ['AB', 'AB', 'BA']
  });
  runs[1].runId = runs[0].runId;
  runs[0].candidate.sourceProvenance.sourceFingerprintAfter = '9'.repeat(64);
  runs[1].candidate.sourceProvenance.commonConfigSignature = '8'.repeat(64);
  runs[1].candidate.scenario.scenarioUrl = runs[1].candidate.scenario
    .scenarioUrl.replace('schroederMaxLevel=1', 'schroederMaxLevel=0');
  const sparseBatch = runs[2].candidate.gpuStageTimestampEvidence.batches[4];
  sparseBatch.spans = sparseBatch.spans.filter((span) => (
    span.producerId
      !== 'schroeder-hierarchy:two-level-post-mechanics-reactionStep'
  ));

  const evidence = summarizePairedGpuStageProducerRuns({
    runs,
    expectedBaselineGitHead: '0'.repeat(40)
  });

  assert.equal(evidence.status, 'fail');
  assert.ok(evidence.blockers.includes(
    'run-identities-missing-or-duplicated'
  ));
  assert.ok(evidence.blockers.includes('run-order-not-ab-ba-alternating'));
  assert.ok(evidence.blockers.includes(
    'candidate-source-provenance-incomplete'
  ));
  assert.ok(evidence.blockers.includes('common-config-signature-mismatch'));
  assert.ok(evidence.blockers.includes(
    'candidate-authoritative-route-incomplete'
  ));
  assert.ok(evidence.blockers.includes(
    'candidate-stage-producer-evidence-incomplete'
  ));
  assert.ok(evidence.blockers.includes(
    'historical-baseline-git-head-mismatch'
  ));
  assert.equal(
    evidence.runs[2].candidate.targetSpanCoverageComplete,
    false,
    'the campaign recomputes target coverage from raw measured batch spans'
  );
});

test('paired historical reaction-step stage campaign rejects serial placement and all regression gates independently', () => {
  const runs = pairedReactionStageProducerCampaignRuns({
    candidateScale: 1.06,
    candidateSerialPlacement: true
  });
  const evidence = summarizePairedGpuStageProducerRuns({
    runs,
    expectedBaselineGitHead:
      '6c20c32b814a0e4cb66ff973fb4cc225659f3f25'
  });

  assert.equal(evidence.status, 'fail');
  assert.ok(evidence.blockers.includes(
    'candidate-segmented-placement-attribution-incomplete'
  ));
  assert.ok(evidence.blockers.includes(
    'candidate-serial-placement-producer-present'
  ));
  assert.ok(evidence.blockers.includes(
    'paired-stage-producer-p50-regression-exceeds-threshold'
  ));
  assert.ok(evidence.blockers.includes(
    'paired-stage-producer-p95-regression-exceeds-threshold'
  ));
  assert.ok(evidence.blockers.includes(
    'independent-median-stage-producer-p50-regression-exceeds-threshold'
  ));
  assert.ok(evidence.blockers.includes(
    'independent-median-stage-producer-p95-regression-exceeds-threshold'
  ));
  assert.ok(evidence.blockers.includes(
    'candidate-stage-producer-p50-exceeds-absolute-ceiling'
  ));
});

test('paired historical physics throughput campaign passes a four-percent regression', () => {
  const evidence = summarizePairedPhysicsThroughputRuns({
    runs: pairedThroughputCampaignRuns({ candidateScale: 0.96 }),
    expectedBaselineGitHead: 'e'.repeat(40)
  });

  assert.equal(evidence.status, 'pass');
  assert.deepEqual(evidence.method.expectedRunOrders, ['AB', 'BA', 'AB']);
  assert.equal(evidence.method.direction, 'higher-is-better');
  assert.ok(Math.abs(evidence.paired.medianRatio - 0.96) < 1e-12);
  assert.ok(
    Math.abs(evidence.paired.medianRegressionPercent - 4) < 1e-12
  );
  assert.equal(evidence.paired.withinThreshold, true);
  assert.equal(
    evidence.independentMedianCrossCheck.withinThreshold,
    true
  );
});

test('paired historical physics throughput campaign fails closed on contamination and regression', () => {
  const runs = pairedThroughputCampaignRuns({
    candidateScale: 0.94,
    orders: ['AB', 'AB', 'BA']
  });
  runs[1].runId = runs[0].runId;
  runs[0].candidate.sourceProvenance.sourceFingerprintAfter = '9'.repeat(64);
  runs[1].candidate.sourceProvenance.armConfigSignature = '8'.repeat(64);
  runs[2].candidate.scenario.physicsStepsPerSecondSource =
    'probe-wall-batch';
  runs[2].candidate.scenario.schroederTwoLevelMechanicsConfiguredRequested =
    true;
  const evidence = summarizePairedPhysicsThroughputRuns({
    runs,
    expectedBaselineGitHead: '0'.repeat(40)
  });

  assert.equal(evidence.status, 'fail');
  assert.ok(evidence.blockers.includes(
    'run-identities-missing-or-duplicated'
  ));
  assert.ok(evidence.blockers.includes('run-order-not-ab-ba-alternating'));
  assert.ok(evidence.blockers.includes(
    'candidate-throughput-evidence-incomplete'
  ));
  assert.ok(evidence.blockers.includes(
    'candidate-source-provenance-incomplete'
  ));
  assert.ok(evidence.blockers.includes(
    'non-target-route-signature-mismatch'
  ));
  assert.ok(evidence.blockers.includes(
    'historical-baseline-git-head-mismatch'
  ));
  assert.ok(evidence.blockers.includes(
    'paired-physics-throughput-regression-exceeds-threshold'
  ));
  assert.ok(evidence.blockers.includes(
    'independent-median-physics-throughput-regression-exceeds-threshold'
  ));
});

test('paired spatial arena-depth characterization proves same-source 3-versus-8 evidence', () => {
  const evidence = summarizePairedSpatialArenaDepthThroughputRuns({
    runs: pairedSpatialArenaDepthCampaignRuns()
  });

  assert.equal(evidence.status, 'pass');
  assert.equal(evidence.method.referenceRole, 'arena-3-reference');
  assert.equal(evidence.method.comparisonRole, 'arena-8-comparison');
  assert.equal(evidence.method.performanceGate,
    'diagnostic-only-no-throughput-threshold');
  assert.ok(Math.abs(
    evidence.paired.medianPhysicsStepsPerSecondRatio - 1.05
  ) < 1e-12);
  assert.equal(evidence.paired.medianBackpressureWaitCountDelta, -14);
  assert.equal(evidence.paired.medianBackpressureWaitMsDelta, -7);
});

test('paired spatial arena-depth characterization rejects a miswired depth and source drift', () => {
  const runs = pairedSpatialArenaDepthCampaignRuns();
  runs[1].candidate.scenario.schroederSpatialArenaCountsObserved = [3];
  runs[2].candidate.sourceProvenance.worktreeStatusHashBefore = '2'.repeat(64);
  runs[2].candidate.sourceProvenance.worktreeStatusHashAfter = '2'.repeat(64);
  const evidence = summarizePairedSpatialArenaDepthThroughputRuns({ runs });

  assert.equal(evidence.status, 'fail');
  assert.ok(evidence.blockers.includes(
    'comparison-arena-depth-evidence-incomplete'
  ));
  assert.ok(evidence.blockers.includes(
    'arena-depth-arms-do-not-share-exact-source'
  ));
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
