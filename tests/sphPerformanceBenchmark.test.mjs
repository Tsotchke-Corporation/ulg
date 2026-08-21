import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  aggregateSchroederResidentBatchEvidence,
  buildSchroederReactionReceiptIccTrace,
  createGpuTimestampBenchmarkScenarioParams,
  createSchroederBenchmarkScenarioParams,
  currentResidentSurfaceDrawConsumerMetricValue,
  currentResidentSurfaceDrawEvidence,
  durableBenchmarkReleasePublicationEnabled,
  finalCachedEngineMetric,
  probeReleasePublicationEnvironment,
  scenarioUrlForCount,
  scenarioPerformanceGate,
  summarizePairedGpuStageProducerRuns,
  summarizePairedGpuTimestampRuns,
  summarizePairedSpatialArenaDepthThroughputRuns,
  summarizePairedPhysicsThroughputRuns,
  summarizePairedAuthoritativeTwoLevelPhysicsThroughputRuns,
  summarizePairedAuthoritativeTwoLevelScalingRuns,
  summarizeMechanicsFieldPairV2Evidence,
  summarizeResidentGpuStageTimestampEvidence,
  summarizeResidentGpuTimestampEvidence,
  writeBenchmarkReport
} from '../scripts/sph-performance-benchmark.mjs';
import {
  applyAuthoritativeTwoLevelLowNAcceptancePolicy,
  campaignArmPorts
} from '../scripts/sph-performance-acceptance-campaign.mjs';

test('benchmark durable release publication is opt-in, private, and no-clobber', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-benchmark-publication-'));
  try {
    const repoDir = path.join(root, 'repo');
    const outputPath = path.join(root, 'release', 'benchmark.json');
    await mkdir(repoDir, { recursive: true });
    assert.equal(durableBenchmarkReleasePublicationEnabled('1'), true);
    assert.equal(durableBenchmarkReleasePublicationEnabled('true'), false);
    assert.deepEqual(probeReleasePublicationEnvironment(false), {});
    assert.deepEqual(probeReleasePublicationEnvironment(true), {
      ULG_PROBE_DURABLE_RELEASE_PUBLICATION: '1'
    });

    await writeBenchmarkReport({
      outputPath,
      repoDir,
      report: { status: 'legacy-first' }
    });
    await writeBenchmarkReport({
      outputPath,
      repoDir,
      report: { status: 'legacy-second' }
    });
    assert.equal(JSON.parse(await readFile(outputPath, 'utf8')).status, 'legacy-second');

    const durableOutputPath = path.join(root, 'durable', 'benchmark.json');
    const report = { status: 'durable' };
    await writeBenchmarkReport({
      outputPath: durableOutputPath,
      repoDir,
      report,
      durableReleasePublication: true
    });
    const artifactStat = await lstat(durableOutputPath);
    const parentStat = await lstat(path.dirname(durableOutputPath));
    assert.equal(artifactStat.mode & 0o777, 0o600);
    assert.equal(parentStat.mode & 0o777, 0o700);
    const exactBytes = await readFile(durableOutputPath, 'utf8');
    await assert.rejects(
      writeBenchmarkReport({
        outputPath: durableOutputPath,
        repoDir,
        report: { status: 'replacement' },
        durableReleasePublication: true
      }),
      /already exists and will not be replaced/
    );
    assert.equal(await readFile(durableOutputPath, 'utf8'), exactBytes);
    await assert.rejects(
      writeBenchmarkReport({
        outputPath: path.join(repoDir, 'unsafe.json'),
        repoDir,
        report,
        durableReleasePublication: true
      }),
      /outside the repository/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('benchmark selects the exact final cached measured batch', () => {
  const result = {
    timeline: {
      interactiveCacheLifecycle: {
        schema: 'peercompute.ulg.sph-interactive-cache-lifecycle.v1',
        status: 'same-page-warm-reset-cached-measurement-complete',
        completedAtMs: 400,
        pageInstanceId: 'page-1',
        reset: {
          resetOrdinal: 4,
          playbackQuiescence: {
            schema:
              'peercompute.ulg.sph-interactive-playback-quiescence.v0',
            status: 'resident-playback-quiescent',
            reason: 'reset-playback-before-direct-measurement',
            initialButtonText: 'Pause',
            finalButtonText: 'Play',
            pauseRequested: true,
            residentPending: false,
            stableFrameCount: 2,
            completedStepCount: 1,
            elapsedMs: 1
          }
        },
        postResetMeasurement: {
          warmupBatchIndices: [1],
          measuredBatchIndices: [2, 3],
          observedResidentBatchIndices: [1, 2, 3],
          observedMeasurementClasses: [
            'post-reset-warmup',
            'post-reset-measured',
            'post-reset-measured'
          ],
          drain: {
            schema:
              'peercompute.ulg.sph-interactive-cache-terminal-drain.v1',
            status: 'unmeasured-terminal-consumer-complete',
            measured: false,
            metricPublished: false,
            sourceBatchIndex: 3,
            successorBatchIndex: 4,
            completedStepCount: 1,
            elapsedMs: 1.25,
            settledStatus:
              'background-settlement-complete-after-unmeasured-terminal-consumer'
          },
          terminalHandoff: {
            schema:
              'peercompute.ulg.sph-interactive-cache-terminal-handoff.v1',
            status: 'scene-terminal-consumer-settled',
            reason: null,
            terminalConsumerMethod: 'scene-api-dispose',
            terminalConsumerContract:
              'queue-ordered-overlay-clear-final-consumer-before-resident-artifact-retirement',
            recordedDrainExecutionMatched: true,
            backgroundSettlementPromisePresent: true,
            playbackQuiescence: {
              schema:
                'peercompute.ulg.sph-interactive-playback-quiescence.v0',
              status: 'resident-playback-quiescent',
              reason: 'terminal-handoff-before-dispose',
              initialButtonText: 'Play',
              finalButtonText: 'Play',
              pauseRequested: false,
              residentPending: false,
              stableFrameCount: 2,
              completedStepCount: 1,
              elapsedMs: 1
            },
            pendingBeforeDispose: true,
            disposeInvoked: true,
            settlementAwaitMs: 0.5,
            settlementStatus: 'terminal-settlement-resolved',
            settlementValue: true,
            spatialEpochSettlementComplete: true,
            hierarchyArtifactSettlementComplete: true,
            successorSourceFamilyRetirementComplete: true,
            completedAtMs: 400
          }
        }
      },
      metrics: [
        {
          phase: 'resident-batch',
          batchIndex: 1,
          pageInstanceId: 'page-1',
          cacheResetOrdinal: 4,
          interactiveCacheMeasurementClass: 'post-reset-warmup',
          renderState: { marker: 'warmup' }
        },
        {
          phase: 'resident-batch',
          batchIndex: 2,
          pageInstanceId: 'page-1',
          cacheResetOrdinal: 4,
          interactiveCacheMeasurementClass: 'post-reset-measured',
          renderState: { marker: 'measured-1' }
        },
        {
          phase: 'resident-batch',
          batchIndex: 3,
          pageInstanceId: 'page-1',
          cacheResetOrdinal: 4,
          interactiveCacheMeasurementClass: 'post-reset-measured',
          renderState: { marker: 'measured-2' }
        },
        {
          phase: 'resident-batch-retained-continuation',
          batchIndex: 3,
          renderState: { marker: 'later-nonmeasurement' }
        }
      ]
    }
  };
  assert.equal(
    finalCachedEngineMetric(result)?.renderState?.marker,
    'measured-2'
  );
  result.timeline.metrics[2].pageInstanceId = 'different-page';
  assert.equal(finalCachedEngineMetric(result), null);
  result.timeline.metrics[2].pageInstanceId = 'page-1';
  result.timeline.interactiveCacheLifecycle.postResetMeasurement
    .measuredBatchIndices = [2];
  assert.equal(finalCachedEngineMetric(result), null);
  result.timeline.interactiveCacheLifecycle.postResetMeasurement
    .measuredBatchIndices = [2, 3];
  result.timeline.interactiveCacheLifecycle.postResetMeasurement
    .terminalHandoff.settlementValue = false;
  assert.equal(finalCachedEngineMetric(result), null);
  result.timeline.interactiveCacheLifecycle.postResetMeasurement
    .terminalHandoff.settlementValue = true;
  result.timeline.interactiveCacheLifecycle.reset
    .playbackQuiescence.status = 'resident-playback-quiescence-timeout';
  assert.equal(finalCachedEngineMetric(result), null);
  result.timeline.interactiveCacheLifecycle.reset
    .playbackQuiescence.status = 'resident-playback-quiescent';
  result.timeline.interactiveCacheLifecycle.postResetMeasurement
    .terminalHandoff.playbackQuiescence.residentPending = true;
  assert.equal(finalCachedEngineMetric(result), null);
});

test('interactive probe pipelines settlement and proves same-page reset telemetry', async () => {
  const source = await readFile(
    new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
    'utf8'
  );
  assert.match(source, /pending-successor-consumer/u);
  assert.match(
    source,
    /background-settlement-complete-after-successor-consumer/u
  );
  assert.match(source, /unmeasured-terminal-consumer-complete/u);
  assert.doesNotMatch(
    source,
    /const settled = await backgroundSettlementPromise/u
  );
  assert.match(source, /resetButton\.click\(\)/u);
  assert.match(source, /quiesceInteractivePlayback/u);
  assert.match(source, /reset-playback-before-direct-measurement/u);
  assert.match(source, /resident-playback-quiescent/u);
  assert.match(source, /performance\.timeOrigin/u);
  assert.match(source, /interactiveCacheMeasurementClass/u);
  assert.match(source, /missingSourceKeys/u);
  assert.match(source, /nativeIndirectArgsReadbackRequested === true/u);
  assert.match(source, /materialInterfaceDiagnosticMs: 0/u);
  assert.match(source, /sceneApi\.dispose\(\)/u);
  assert.match(
    source,
    /terminalExecution === recordedDrainExecution/u
  );
  assert.match(source, /scene-terminal-consumer-settled/u);
});

test('direct resident probe preserves the explicit paired-v2 option without auto scheduling', async () => {
  const source = await readFile(
    new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
    'utf8'
  );
  const directFallback = source.match(
    /const schroederExecutionOptions =[\s\S]*?\|\| \(schroederSimulationConfig\?\.enabled === true[\s\S]*?: \{ schroederSimulation: false \}\);/u
  )?.[0] || '';

  assert.match(
    directFallback,
    /schroederEnableMechanicsFieldPairV2:\s*schroederSimulationConfig\.enableMechanicsFieldPairV2/u,
    'residentAuto=0 probes must forward the paired-v2 URL/config opt-in'
  );
});

test('compatibility-normalized campaign reserves disjoint two-count arm ports', () => {
  assert.deepEqual(
    campaignArmPorts({
      basePort: 5280,
      runCount: 3,
      particleCountCount: 2
    }),
    [5280, 5282, 5284, 5286, 5288, 5290]
  );
  assert.throws(
    () => campaignArmPorts({
      basePort: 65_530,
      runCount: 3,
      particleCountCount: 2
    }),
    /exceeds 65535/
  );
});

test('compatibility-normalized campaign pins approved provenance and strict server isolation', async () => {
  const [campaignSource, probeSource, policy] = await Promise.all([
    readFile(
      new URL(
        '../scripts/sph-performance-acceptance-campaign.mjs',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
      'utf8'
    ),
    readFile(
      new URL(
        '../scripts/performance-baselines/webgpu-portability-v1.json',
        import.meta.url
      ),
      'utf8'
    ).then(JSON.parse)
  ]);
  assert.equal(policy.policyId, 'webgpu-portability-v1');
  assert.equal(
    policy.historicalOriginGitHead,
    '6c20c32b814a0e4cb66ff973fb4cc225659f3f25'
  );
  assert.equal(
    policy.executionGitHead,
    'fbcfd6ed2e02420cbd5ab512a56b5a073d114af9'
  );
  assert.equal(
    policy.canonicalDiff.sha256,
    '029d3c8c1e6ed4c6c7eb15fcbeacc58ebe8f08295de8895f4de0f2cefb58ce06'
  );
  assert.equal(policy.changedPaths.length, 10);
  assert.match(
    campaignSource,
    /Compatibility-normalized baseline must be a direct non-merge child/
  );
  assert.match(campaignSource, /changed-path set does not match/);
  assert.match(campaignSource, /canonical diff does not match/);
  assert.match(
    campaignSource,
    /authoritative-two-level-physics-scaling-compatibility-normalized-campaign\.v1/
  );
  assert.match(campaignSource, /ULG_BENCH_PROBE_SCRIPT/);
  assert.equal(
    [
      ...campaignSource.matchAll(
        /ULG_BENCH_SCHROEDER_SPATIAL_ARENA_COUNT: '4'/gu
      )
    ].length,
    2
  );
  assert.equal(
    [
      ...campaignSource.matchAll(
        /VITE_ULG_SCHROEDER_SPATIAL_EPOCH_ARENA_COUNT: '4'/gu
      )
    ].length >= 2,
    true
  );
  assert.equal(
    [
      ...campaignSource.matchAll(
        /VITE_ULG_SCHROEDER_PARENT_FIELD_MECHANICS_ARENA_COUNT: '1'/gu
      )
    ].length >= 2,
    true
  );
  assert.match(probeSource, /'--strictPort'/);
  assert.match(probeSource, /await server\.stop\(\)/);
});

test('GPU timestamp benchmarks negotiate queries without enabling serialized scene profiling', () => {
  assert.deepEqual(
    createGpuTimestampBenchmarkScenarioParams({
      measureGpuTimestampInterval: true,
      measureGpuStageTimestamps: false
    }),
    { residentGpuTimestampFeature: '1' }
  );
  assert.deepEqual(
    createGpuTimestampBenchmarkScenarioParams({
      measureGpuTimestampInterval: true,
      measureGpuStageTimestamps: true
    }),
    { residentGpuTimestampFeature: '1' }
  );
  assert.deepEqual(createGpuTimestampBenchmarkScenarioParams(), {});
});

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
    schema: 'peercompute.ulg.schroeder-spatial-epoch-transaction-summary.v0',
    status: 'schroeder-spatial-epoch-transaction-released',
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
  orders = ['AB', 'BA', 'AB'],
  authoritativeTwoLevel = false
} = {}) {
  const commonConfigSignature = 'c'.repeat(64);
  const baselineArmConfigSignature = 'd'.repeat(64);
  const candidateArmConfigSignature = authoritativeTwoLevel
    ? 'e'.repeat(64)
    : baselineArmConfigSignature;
  const provenance = ({
    gitHead,
    fingerprint,
    statusHash,
    dirty,
    armConfigSignature
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
  const scenario = (
    physicsStepsPerSecond,
    { pairV2 = false } = {}
  ) => ({
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
    scenarioUrl: authoritativeTwoLevel
      ? (
          'https://benchmark.invalid/?ss=1&schroederLevel=0'
          + '&schroederMaxLevel=1&schroederCrossLevelCoupling=1'
          + '&schroederTwoLevel=1'
          + '&schroederTwoLevelAuthority=authoritative'
          + '&schroederTwoLevelSubsteps=2'
          + (pairV2 ? '&schroederMechanicsFieldPairV2=1' : '')
        )
      : 'https://benchmark.invalid/?ss=1&schroederLevel=0&schroederMaxLevel=0&schroederCrossLevelCoupling=0',
    schroederTwoLevelMechanicsConfiguredRequested: authoritativeTwoLevel,
    schroederTwoLevelMechanicsRequestedObserved: authoritativeTwoLevel,
    schroederTwoLevelMechanicsCoverageComplete:
      authoritativeTwoLevel ? true : null,
    schroederTwoLevelMechanicsAuthorityRequested:
      authoritativeTwoLevel ? 'authoritative' : 'observation',
    schroederTwoLevelMechanicsAuthorityObserved:
      authoritativeTwoLevel ? 'authoritative' : null,
    schroederTwoLevelFineSubstepCountRequested:
      authoritativeTwoLevel ? 2 : null,
    schroederTwoLevelFineSubstepCountObserved:
      authoritativeTwoLevel ? 2 : null,
    schroederTwoLevelMechanicsStepStatus: authoritativeTwoLevel
      ? 'schroeder-two-level-authoritative-step-executed'
      : null,
    schroederTwoLevelAuthoritativeCommitVerified:
      authoritativeTwoLevel ? true : null,
    schroederMechanicsFieldPairV2ConfiguredRequested:
      authoritativeTwoLevel ? pairV2 : false,
    schroederMechanicsFieldPairV2Enabled:
      authoritativeTwoLevel && pairV2 ? true : null,
    schroederMechanicsFieldConstructionMode:
      authoritativeTwoLevel && pairV2
        ? 'paired-v2-shared-radix'
        : null,
    schroederMechanicsFieldPairV2CoverageComplete:
      authoritativeTwoLevel && pairV2 ? true : null,
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
      scenario: scenario(baselineFps, { pairV2: false }),
      sourceProvenance: provenance({
        gitHead: 'e'.repeat(40),
        fingerprint: 'a'.repeat(64),
        statusHash: '1'.repeat(64),
        dirty: false,
        armConfigSignature: baselineArmConfigSignature
      })
    },
    candidate: {
      process: { exitCode: 0 },
      reportStatus: 'complete',
      reportPerformanceGateStatus: 'pass',
      scenarioStatus: 'good',
      scenario: scenario(
        baselineFps * candidateScale,
        { pairV2: authoritativeTwoLevel }
      ),
      sourceProvenance: provenance({
        gitHead: 'f'.repeat(40),
        fingerprint: 'b'.repeat(64),
        statusHash: '2'.repeat(64),
        dirty: true,
        armConfigSignature: candidateArmConfigSignature
      })
    }
  }));
}

function pairedAuthoritativeTwoLevelScalingRuns({
  lowCandidateScale = 0.89,
  highCandidateScale = 0.97,
  orders = ['AB', 'BA', 'AB']
} = {}) {
  const runs = pairedThroughputCampaignRuns({
    candidateScale: 1,
    orders,
    authoritativeTwoLevel: true
  });
  return runs.map((run, index) => {
    const lowBaselineFps = [100, 110, 90][index];
    const highBaselineFps = [10, 11, 9][index];
    const scenarioAtCount = (
      source,
      particleCount,
      physicsStepsPerSecond
    ) => ({
      ...source,
      targetParticleCount: particleCount,
      actualParticleCount: particleCount,
      effectiveParticleCount: particleCount,
      physicsStepsPerSecond,
      schroederBackpressureWaitCount: 0,
      schroederBackpressureWaitMs: 0,
      performanceGate: {
        status: 'pass',
        blockers: []
      }
    });
    return {
      ...run,
      baseline: {
        ...run.baseline,
        scenario: null,
        scenarios: [
          scenarioAtCount(run.baseline.scenario, 1024, lowBaselineFps),
          scenarioAtCount(run.baseline.scenario, 9826, highBaselineFps)
        ]
      },
      candidate: {
        ...run.candidate,
        scenario: null,
        scenarios: [
          scenarioAtCount(
            run.candidate.scenario,
            1024,
            lowBaselineFps * lowCandidateScale
          ),
          scenarioAtCount(
            run.candidate.scenario,
            9826,
            highBaselineFps * highCandidateScale
          )
        ]
      }
    };
  });
}

function cleanCampaignMemoryEvidence() {
  const events = {
    low: 0,
    high: 0,
    max: 0,
    oom: 0,
    oom_kill: 0,
    oom_group_kill: 0
  };
  return {
    status: 'pass',
    before: {
      schema: 'peercompute.ulg.cgroup-memory-snapshot.v0',
      path: '/user.slice/test.scope',
      memoryHigh: '4294967296',
      memoryMax: '7516192768',
      memorySwapMax: '0',
      memoryCurrent: 64_000_000,
      memoryPeak: 80_000_000,
      events: { ...events }
    },
    after: {
      schema: 'peercompute.ulg.cgroup-memory-snapshot.v0',
      path: '/user.slice/test.scope',
      memoryHigh: '4294967296',
      memoryMax: '7516192768',
      memorySwapMax: '0',
      memoryCurrent: 128_000_000,
      memoryPeak: 2_947_850_240,
      events: { ...events }
    },
    eventDeltas: { ...events }
  };
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
  additionalProducerIds = [],
  twoLevelAuthoritative = null
} = {}) {
  const authoritativeTwoLevel = twoLevelAuthoritative
    ?? generationCount > 1;
  const encoderSpanSemantics =
    'same-command-encoder-empty-pass-boundaries-bracket-production-commands';
  const queueIntervalSemantics =
    'ordered-queue-boundary-marker-submissions-measure-elapsed-queue-interval-including-production-work-and-queue-idle-not-pure-gpu-busy';
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
    const queueBoundarySpan = residentQueueProducer
      || hierarchyQueueProducer;
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
      markerSubmissionMode: queueBoundarySpan
        ? 'same-queue-boundary-submissions'
        : 'same-production-command-encoder',
      measurementKind: queueBoundarySpan
        ? 'elapsed-queue-interval'
        : 'same-command-encoder-gpu-elapsed-interval',
      intervalSemantics: queueBoundarySpan
        ? queueIntervalSemantics
        : encoderSpanSemantics,
      startQueryIndex: index * 2,
      endQueryIndex: index * 2 + 1,
      startTimestampNs: startTimestampNs.toString(),
      endTimestampNs: (startTimestampNs + BigInt(durationNs)).toString(),
      durationNs,
      durationMs: 1,
      valid: true
    };
  });
  const publicGenerationId = batchIndex;
  const physicsTick = batchIndex - 1;
  const epochIdentity = fullEpochIdentity({
    storageGeneration: batchIndex,
    physicsTick,
    positionEpoch: physicsTick,
    topologyEpoch: physicsTick,
    chartEpoch: physicsTick,
    levelEpoch: physicsTick,
    supportEpoch: physicsTick
  });
  const releasedTransaction = transaction({
    generationId: publicGenerationId,
    physicsTick,
    positionEpoch: physicsTick,
    deviceId: 'test-webgpu-device',
    epochIdentity,
    privateAdvance: authoritativeTwoLevel ? 1 : 0,
    commit: authoritativeTwoLevel ? 0 : 1
  });
  const queueBoundarySpanCount = spans.filter(
    (span) => (
      span.markerSubmissionMode === 'same-queue-boundary-submissions'
    )
  ).length;
  return {
    phase: 'resident-batch',
    batchIndex,
    schroederTelemetry: {
      requested: true,
      active: true,
      ...(authoritativeTwoLevel ? {
        twoLevelMechanicsRequested: true,
        twoLevelMechanicsActive: true,
        twoLevelMechanicsAuthorityRequested: 'authoritative',
        twoLevelMechanicsAuthorityObserved: 'authoritative',
        twoLevelFineSubstepCountRequested:
          Math.max(1, generationCount - 2),
        twoLevelFineSubstepCountObserved:
          Math.max(1, generationCount - 2),
        twoLevelMechanicsStepStatus:
          'schroeder-two-level-authoritative-step-executed',
        twoLevelAuthoritativeCommitVerified: true,
        twoLevelAuthoritativeStepCount: 1,
        twoLevelMechanicsCoverageComplete: true
      } : {})
    },
    residentSteps: {
      status: 'resident-steps-executed',
      completedStepCount: 1,
      nextStep: physicsTick + 1,
      schroederSpatialEpochReleaseSettlementCount: 1,
      schroederSpatialEpochReleaseSettlementComplete: true,
      schroederHierarchyArtifactLedgerSettlementCount: 1,
      schroederHierarchyArtifactLedgerSettlementComplete: true,
      schroederSpatialEpochTransactionSummaries: [releasedTransaction],
      schroederSpatialEpochGenerationSummaries: [
        generation(publicGenerationId)
      ],
      schroederHierarchyArtifactLedgerSummaries: [
        artifactLedger(publicGenerationId)
      ],
      ...(authoritativeTwoLevel
        ? { schroederTwoLevelAuthoritativeStepCount: 1 }
        : {})
    },
    probeResidentBatchTiming: {
      gpuStageTimestamps: {
        schema: 'peercompute.ulg.sph-probe-gpu-stage-timestamps.v0',
        status: 'gpu-stage-timestamps-complete',
        requested: true,
        batchIndex,
        timestampUnit: 'nanoseconds',
        timestampProfilingRequested: true,
        timestampQuerySupported: true,
        requiredFeatures: ['timestamp-query'],
        enabledFeatures: ['timestamp-query'],
        markerEncodingMode: 'empty-compute-pass-timestampWrites',
        encoderSpanSemantics,
        queueIntervalSemantics,
        queryCapacityPreflightStatus:
          'gpu-stage-timestamp-query-capacity-ready',
        queryCapacityExhausted: false,
        requiredQueryCapacity: 2048,
        queryBudgetPerStep: 2048,
        configuredBatchStepCount: 1,
        twoLevelConfigured: authoritativeTwoLevel,
        configuredFineSubstepCount: authoritativeTwoLevel
          ? Math.max(1, generationCount - 2)
          : 0,
        maxQueryCapacity: 8192,
        productionPassGroupingPreserved: true,
        queryCount: spans.length * 2,
        queryCapacity: Math.max(2048, spans.length * 2),
        spanCount: spans.length,
        validSpanCount: spans.length,
        invalidSpanCount: 0,
        markerSubmissionCount: queueBoundarySpanCount * 2,
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
      '/?drop=na&base=h2o&dropt=300&baset=300&dropn=8&basen=8&mech=mlsmpm&ss=1&schroederLevel=0&schroederMaxLevel=1&schroederCrossLevelCoupling=1&schroederTwoLevel=1&schroederTwoLevelAuthority=authoritative&schroederTwoLevelSubsteps=2&residentGpuTimestampFeature=1&lawr=1',
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
    twoLevelFineSubstepCount: 4,
    mechanicsFieldPairV2Requested: true
  });

  assert.equal(params.ss, '1');
  assert.equal(params.schroederLevel, '3');
  assert.equal(params.schroederMaxLevel, '4');
  assert.equal(params.schroederSpatialArenaCount, '8');
  assert.equal(params.schroederCrossLevelCoupling, '1');
  assert.equal(params.schroederTwoLevel, '1');
  assert.equal(params.schroederTwoLevelAuthority, 'authoritative');
  assert.equal(params.schroederTwoLevelSubsteps, '4');
  assert.equal(params.schroederMechanicsFieldPairV2, '1');
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
  assert.equal(params.get('residentAuto'), '0');
});

test('interactive cache lifecycle starts one warm resident execution', () => {
  const scenario = scenarioUrlForCount(1024, {
    interactiveCacheLifecycle: true
  });
  const params = new URL(`https://benchmark.invalid${scenario.url}`).searchParams;

  assert.equal(params.get('residentAuto'), '1');
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

  assert.equal(
    currentResidentSurfaceDrawConsumerMetricValue({
      surfaceDraw: {
        surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: true,
        visibleGpuConsumerForegroundProofValidated: false,
        surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration: 9
      },
      renderState: {
        surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: false,
        surfaceDrawVisibleGpuConsumerForegroundProofValidated: true,
        surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration: 8
      },
      key: 'surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted'
    }),
    true
  );
  assert.equal(
    currentResidentSurfaceDrawConsumerMetricValue({
      surfaceDraw: {
        visibleGpuConsumerForegroundProofValidated: false
      },
      renderState: {
        surfaceDrawVisibleGpuConsumerForegroundProofValidated: true
      },
      key: 'surfaceDrawVisibleGpuConsumerForegroundProofValidated'
    }),
    false
  );
  assert.equal(
    currentResidentSurfaceDrawConsumerMetricValue({
      surfaceDraw: null,
      renderState: {
        surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration: 8
      },
      key: 'surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration'
    }),
    8
  );
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

test('SS performance evidence accepts exact-successor queue-ordered generation release', () => {
  const metrics = completeMetrics();
  for (const metric of metrics.filter((entry) => entry.phase === 'resident-batch')) {
    for (const summary of metric.residentSteps
      .schroederSpatialEpochGenerationSummaries) {
      summary.releaseStatus =
        'spatial-epoch-generation-released-queue-ordered-after-exact-successor';
    }
  }

  const evidence = aggregate(metrics);
  assert.equal(evidence.generationCoverageComplete, true);
  assert.equal(evidence.transactionCoverageComplete, true);

  metrics[1].residentSteps.schroederSpatialEpochGenerationSummaries[0]
    .releaseStatus = 'spatial-epoch-generation-release-unconfirmed';
  const unconfirmed = aggregate(metrics);
  assert.equal(unconfirmed.generationCoverageComplete, false);
  assert.equal(unconfirmed.transactionCoverageComplete, false);
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

  const legacyMetrics = structuredClone(metrics);
  for (const metric of legacyMetrics.filter(
    (entry) => entry.phase === 'resident-batch'
  )) {
    for (const summary of metric.residentSteps
      .schroederSpatialEpochGenerationSummaries) {
      delete summary.directArenaCount;
    }
  }
  const legacyEvidence = aggregateSchroederResidentBatchEvidence({
    metrics: legacyMetrics,
    requestedBatchCount: 2,
    requestedBatchStepCount: 2,
    schroederSimulationRequested: true,
    schroederSpatialArenaCount: 8
  });
  assert.deepEqual(legacyEvidence.observedSpatialArenaCounts, [8]);
  assert.equal(legacyEvidence.spatialArenaCountCoverageComplete, true);

  legacyMetrics[1].residentSteps.schroederSpatialEpochGenerationSummaries[0]
    .arenaCapacity = 3;
  assert.equal(aggregateSchroederResidentBatchEvidence({
    metrics: legacyMetrics,
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

test('paired-v2 benchmark evidence authenticates every retained generation', () => {
  const metrics = [{
    phase: 'resident-batch',
    residentSteps: {
      schroederSpatialEpochGenerationSummaries: [
        {
          mechanicsFieldPairV2Enabled: true,
          mechanicsFieldConstructionMode: 'paired-v2-shared-radix'
        },
        {
          spatialEpochGeneration: {
            mechanicsFieldPairV2Enabled: true,
            mechanicsFieldConstructionMode: 'paired-v2-shared-radix'
          }
        }
      ]
    }
  }];
  const evidence = summarizeMechanicsFieldPairV2Evidence({
    metrics,
    configuredRequested: true
  });

  assert.equal(evidence.generationSummaryCount, 2);
  assert.equal(evidence.mechanicsFieldPairV2Enabled, true);
  assert.equal(
    evidence.mechanicsFieldConstructionMode,
    'paired-v2-shared-radix'
  );
  assert.equal(evidence.coverageComplete, true);

  const mixed = structuredClone(metrics);
  mixed[0].residentSteps.schroederSpatialEpochGenerationSummaries[1]
    .spatialEpochGeneration.mechanicsFieldConstructionMode =
      'independent-v2';
  assert.equal(summarizeMechanicsFieldPairV2Evidence({
    metrics: mixed,
    configuredRequested: true
  }).coverageComplete, false);
});

test('performance gate fails closed when paired-v2 construction is not observed', () => {
  const evidence = scenarioPerformanceGate({
    estimatedReadbackBytesPerStep: 0,
    schroederMechanicsFieldPairV2Requested: true,
    schroederMechanicsFieldPairV2Enabled: false,
    schroederMechanicsFieldConstructionMode: 'independent-v2',
    schroederMechanicsFieldPairV2CoverageComplete: false
  });

  assert.equal(evidence.status, 'fail');
  assert.ok(evidence.blockers.includes(
    'schroeder-mechanics-field-pair-v2-request-not-observed'
  ));
  assert.ok(evidence.blockers.includes(
    'schroeder-mechanics-field-pair-v2-construction-mode-mismatch'
  ));
  assert.ok(evidence.blockers.includes(
    'schroeder-mechanics-field-pair-v2-coverage-incomplete'
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
  assert.equal(evidence.releasedTransactionEvidenceComplete, true);
  assert.equal(
    evidence.releasedTransactionEvidence.status,
    'authentic-released-transaction-evidence-complete'
  );
  assert.equal(evidence.batches[0].timestampCapabilityComplete, true);
  assert.equal(evidence.batches[0].markerSemanticsComplete, true);
  assert.equal(evidence.batches[0].queryCapacityComplete, true);
  assert.equal(evidence.batches[0].markerSubmissionCoverageComplete, true);
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

test('coarse GPU stage evidence fails closed on unauthenticated timestamp capabilities, marker semantics, capacity, and overhead', () => {
  const corruptions = [
    {
      name: 'profiling-not-requested',
      mutate: (stage) => { stage.timestampProfilingRequested = false; },
      failedField: 'timestampCapabilityComplete'
    },
    {
      name: 'timestamp-query-not-supported',
      mutate: (stage) => { stage.timestampQuerySupported = false; },
      failedField: 'timestampCapabilityComplete'
    },
    {
      name: 'timestamp-query-not-required',
      mutate: (stage) => { stage.requiredFeatures = []; },
      failedField: 'timestampCapabilityComplete'
    },
    {
      name: 'timestamp-query-not-enabled',
      mutate: (stage) => { stage.enabledFeatures = []; },
      failedField: 'timestampCapabilityComplete'
    },
    {
      name: 'nonportable-marker-mode',
      mutate: (stage) => { stage.markerEncodingMode = 'writeTimestamp'; },
      failedField: 'markerSemanticsComplete'
    },
    {
      name: 'wrong-encoder-interval-semantics',
      mutate: (stage) => {
        stage.encoderSpanSemantics = 'unbracketed-production-pass';
      },
      failedField: 'markerSemanticsComplete'
    },
    {
      name: 'queue-interval-mislabeled-as-gpu-busy',
      mutate: (stage) => {
        stage.queueIntervalSemantics = 'pure-gpu-busy-time';
      },
      failedField: 'markerSemanticsComplete'
    },
    {
      name: 'query-capacity-smaller-than-query-count',
      mutate: (stage) => { stage.queryCapacity = stage.queryCount - 1; },
      failedField: 'queryCapacityComplete'
    },
    {
      name: 'capacity-preflight-not-ready',
      mutate: (stage) => {
        stage.queryCapacityPreflightStatus =
          'gpu-stage-timestamp-capacity-preflight-impossible';
      },
      failedField: 'queryCapacityComplete'
    },
    {
      name: 'capacity-preflight-does-not-cover-required-budget',
      mutate: (stage) => {
        stage.requiredQueryCapacity = stage.queryCapacity + 1;
      },
      failedField: 'queryCapacityComplete'
    },
    {
      name: 'capacity-preflight-bound-to-wrong-step-count',
      mutate: (stage) => { stage.configuredBatchStepCount = 2; },
      failedField: 'queryCapacityComplete'
    },
    {
      name: 'capacity-preflight-bound-to-wrong-two-level-mode',
      mutate: (stage) => { stage.twoLevelConfigured = false; },
      failedField: 'queryCapacityComplete'
    },
    {
      name: 'capacity-exhausted',
      mutate: (stage) => { stage.queryCapacityExhausted = true; },
      failedField: 'queryCapacityComplete'
    },
    {
      name: 'queue-boundary-submission-count-torn',
      mutate: (stage) => { stage.markerSubmissionCount += 1; },
      failedField: 'markerSubmissionCoverageComplete'
    }
  ];
  for (const { name, mutate, failedField } of corruptions) {
    const metric = gpuStageTimestampMetric();
    mutate(metric.probeResidentBatchTiming.gpuStageTimestamps);
    const evidence = summarizeResidentGpuStageTimestampEvidence({
      metrics: [metric],
      requested: true,
      requestedBatchCount: 1,
      requestedBatchStepCount: 1,
      twoLevelAuthoritative: true,
      twoLevelFineSubstepCount: 2
    });
    assert.equal(evidence.status, 'incomplete', name);
    assert.equal(evidence.batches[0][failedField], false, name);
  }
});

test('coarse GPU stage evidence labels queue-boundary spans as elapsed queue intervals', () => {
  const metric = gpuStageTimestampMetric({
    generationCount: 1,
    traversalCount: 0,
    additionalProducerIds: [
      'mls-mpm-resident:spatialMechanicalProposal'
    ]
  });
  const stageEvidence = metric.probeResidentBatchTiming.gpuStageTimestamps;
  const queueSpan = stageEvidence.spans.find(
    (span) => span.producerId
      === 'mls-mpm-resident:spatialMechanicalProposal'
  );
  assert.equal(queueSpan.measurementKind, 'elapsed-queue-interval');
  assert.match(queueSpan.intervalSemantics, /not-pure-gpu-busy/);
  assert.equal(stageEvidence.markerSubmissionCount, 2);

  queueSpan.measurementKind = 'pure-gpu-busy-time';
  const evidence = summarizeResidentGpuStageTimestampEvidence({
    metrics: [metric],
    requested: true,
    requestedBatchCount: 1,
    requestedBatchStepCount: 1,
    requireMigratedLawCoverage: true,
    lawThermalEnabled: false,
    lawReactionsEnabled: false
  });
  assert.equal(evidence.status, 'incomplete');
  assert.equal(evidence.batches[0].markerSemanticsComplete, false);
  assert.equal(
    evidence.batches[0].spans.find(
      (span) => span.producerId
        === 'mls-mpm-resident:spatialMechanicalProposal'
    ).intervalContractComplete,
    false
  );
});

test('coarse GPU stage evidence requires authentic released transaction settlement', () => {
  const unreleased = gpuStageTimestampMetric();
  const transactionSummary = unreleased.residentSteps
    .schroederSpatialEpochTransactionSummaries[0];
  transactionSummary.state = 'committed';
  transactionSummary.status =
    'schroeder-spatial-epoch-transaction-committed';
  const unreleasedEvidence = summarizeResidentGpuStageTimestampEvidence({
    metrics: [unreleased],
    requested: true,
    requestedBatchCount: 1,
    requestedBatchStepCount: 1,
    twoLevelAuthoritative: true,
    twoLevelFineSubstepCount: 2
  });
  assert.equal(unreleasedEvidence.status, 'incomplete');
  assert.equal(unreleasedEvidence.releasedTransactionEvidenceComplete, false);
  assert.equal(
    unreleasedEvidence.batches[0].releasedTransactionBatchComplete,
    false
  );

  const unsettledLedger = gpuStageTimestampMetric();
  unsettledLedger.residentSteps
    .schroederHierarchyArtifactLedgerSettlementComplete = false;
  const unsettledEvidence = summarizeResidentGpuStageTimestampEvidence({
    metrics: [unsettledLedger],
    requested: true,
    requestedBatchCount: 1,
    requestedBatchStepCount: 1,
    twoLevelAuthoritative: true,
    twoLevelFineSubstepCount: 2
  });
  assert.equal(unsettledEvidence.status, 'incomplete');
  assert.equal(
    unsettledEvidence.releasedTransactionEvidence
      .artifactLedgerCoverageComplete,
    false
  );
});

test('long-horizon stage timestamp probe scales query capacity and fails closed before overflow', async () => {
  const source = await readFile(
    new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
    'utf8'
  );
  assert.match(
    source,
    /GPU_STAGE_TIMESTAMP_MIN_QUERY_CAPACITY\s*=\s*2048/
  );
  assert.match(
    source,
    /GPU_STAGE_TIMESTAMP_MAX_QUERY_CAPACITY\s*=\s*8192/
  );
  assert.match(
    source,
    /GPU_STAGE_TIMESTAMP_QUERY_BUDGET_PER_STEP\s*=\s*2048/
  );
  assert.match(
    source,
    /configuredBatchStepCount\s*\*\s*queryBudgetPerStep/
  );
  assert.match(
    source,
    /gpu-stage-timestamp-capacity-preflight-impossible/
  );
  assert.match(
    source,
    /gpu-stage-timestamp-capacity-exhausted-unexpectedly/
  );
  assert.match(source, /allocateQueryPair/);
  assert.doesNotMatch(
    source,
    /GPU stage timestamp query capacity \$\{queryCapacity\} exhausted/
  );
});

test('long-horizon benchmark authenticates deferred Schroeder settlement after a useful successor', async () => {
  const source = await readFile(
    new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
    'utf8'
  );
  assert.match(
    source,
    /execution\?\.schroederBackgroundSettlementPromise/
  );
  assert.match(
    source,
    /authenticatePendingBackgroundSettlement/
  );
  assert.match(source, /pending-successor-consumer/);
  assert.match(source, /unmeasured-terminal-consumer-complete/);
  assert.doesNotMatch(source, /await backgroundSettlementPromise/);
  assert.match(
    source,
    /Schroeder resident batch omitted its pending background settlement promise/
  );
  assert.match(source, /backgroundSettlementAwaitMs/);
  assert.match(source, /backgroundSettlementStatus/);
});

test('long-horizon stage timing compaction preserves queue profiler identity and summaries', async () => {
  const source = await readFile(
    new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
    'utf8'
  );
  for (const field of [
    'queueStageGpuMs',
    'queueStageGpuStats',
    'queueStageGpuSummaryStatus',
    'queueStageGpuRecorderSchema',
    'queueStageGpuRecorderKind',
    'queueStageGpuRecorderCapabilities'
  ]) {
    assert.match(
      source,
      new RegExp(`const compactStageTiming[\\s\\S]*?${field}`)
    );
    assert.match(
      source,
      new RegExp(`stageTiming: step\\.stageTiming[\\s\\S]*?${field}`)
    );
  }
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

test('paired authoritative two-level historical throughput campaign accepts only the exact complete-engine route', () => {
  const evidence = summarizePairedAuthoritativeTwoLevelPhysicsThroughputRuns({
    runs: pairedThroughputCampaignRuns({
      candidateScale: 0.96,
      authoritativeTwoLevel: true
    }),
    expectedBaselineGitHead: 'e'.repeat(40)
  });

  assert.equal(evidence.status, 'pass');
  assert.equal(
    evidence.schema,
    'peercompute.ulg.sph-paired-authoritative-two-level-physics-throughput-campaign.v0'
  );
  assert.equal(evidence.method.routeKind, 'authoritative-two-level');
  assert.equal(evidence.method.requiredFineSubstepCount, 2);
  assert.ok(evidence.runs.every((run) => (
    run.baseline.twoLevelRoute.complete
    && run.candidate.twoLevelRoute.complete
  )));
  assert.ok(Math.abs(evidence.paired.medianRatio - 0.96) < 1e-12);
});

test('paired authoritative throughput rejects unauthenticated paired-v2 candidates', () => {
  const runs = pairedThroughputCampaignRuns({
    authoritativeTwoLevel: true
  });
  runs[0].candidate.scenario.scenarioUrl =
    runs[0].candidate.scenario.scenarioUrl.replace(
      '&schroederMechanicsFieldPairV2=1',
      ''
    );
  runs[1].candidate.scenario.schroederMechanicsFieldConstructionMode =
    'independent-v2';
  runs[2].candidate.scenario.schroederMechanicsFieldPairV2Enabled = false;

  const evidence = summarizePairedAuthoritativeTwoLevelPhysicsThroughputRuns({
    runs,
    expectedBaselineGitHead: 'e'.repeat(40)
  });

  assert.equal(evidence.status, 'fail');
  assert.ok(evidence.blockers.includes(
    'candidate-throughput-evidence-incomplete'
  ));
  assert.equal(
    evidence.runs[0].candidate.twoLevelRoute.scenarioUrl.complete,
    false
  );
  assert.equal(
    evidence.runs[1].candidate.twoLevelRoute.pairV2EvidenceComplete,
    false
  );
  assert.equal(
    evidence.runs[2].candidate.twoLevelRoute.pairV2EvidenceComplete,
    false
  );
});

test('paired authoritative two-level historical throughput campaign rejects observation, wrong depth, and incomplete authority', () => {
  const runs = pairedThroughputCampaignRuns({
    authoritativeTwoLevel: true
  });
  runs[0].candidate.scenario.schroederTwoLevelMechanicsAuthorityObserved =
    'observation';
  runs[1].baseline.scenario.scenarioUrl =
    runs[1].baseline.scenario.scenarioUrl.replace(
      'schroederMaxLevel=1',
      'schroederMaxLevel=0'
    );
  runs[2].candidate.scenario
    .schroederTwoLevelAuthoritativeCommitVerified = false;

  const evidence = summarizePairedAuthoritativeTwoLevelPhysicsThroughputRuns({
    runs,
    expectedBaselineGitHead: 'e'.repeat(40)
  });

  assert.equal(evidence.status, 'fail');
  assert.ok(evidence.blockers.includes(
    'baseline-throughput-evidence-incomplete'
  ));
  assert.ok(evidence.blockers.includes(
    'candidate-throughput-evidence-incomplete'
  ));
  assert.equal(
    evidence.runs[0].candidate.twoLevelRoute.authorityObserved,
    'observation'
  );
  assert.equal(
    evidence.runs[1].baseline.twoLevelRoute.scenarioUrl.complete,
    false
  );
  assert.equal(
    evidence.runs[2].candidate.twoLevelRoute.authoritativeCommitVerified,
    false
  );
});

test('paired authoritative two-level scaling accepts bounded same-N degradation when relative performance improves with N', () => {
  const evidence = summarizePairedAuthoritativeTwoLevelScalingRuns({
    runs: pairedAuthoritativeTwoLevelScalingRuns({
      lowCandidateScale: 0.89,
      highCandidateScale: 0.97
    }),
    expectedBaselineGitHead: 'e'.repeat(40)
  });

  assert.equal(evidence.status, 'pass');
  assert.equal(
    evidence.schema,
    'peercompute.ulg.sph-paired-authoritative-two-level-physics-scaling-campaign.v1'
  );
  assert.deepEqual(
    evidence.method.requiredParticleCounts,
    [1024, 9826]
  );
  assert.equal(evidence.method.minimumRelativeScalingGain, 1.03);
  assert.equal(evidence.method.minimumSameNThroughputRatio, 0.75);
  assert.match(evidence.method.sameNPolicy, /not-five-percent/);
  assert.ok(Math.abs(
    evidence.sameN.low.paired.medianRatio - 0.89
  ) < 1e-12);
  assert.ok(Math.abs(
    evidence.sameN.high.paired.medianRatio - 0.97
  ) < 1e-12);
  assert.ok(Math.abs(
    evidence.paired.medianRelativeScalingGain - (0.97 / 0.89)
  ) < 1e-12);
  assert.equal(evidence.paired.withinThreshold, true);
  assert.equal(
    evidence.independentMedianCrossCheck.withinThreshold,
    true
  );
  assert.ok(evidence.paired.scalingExponentAdvantage > 0);
  assert.ok(evidence.particleCoverage.every((run) => (
    run.baseline.complete && run.candidate.complete
  )));
});

test('paired authoritative two-level scaling rejects worsening relative performance even when both same-N ratios are bounded', () => {
  const evidence = summarizePairedAuthoritativeTwoLevelScalingRuns({
    runs: pairedAuthoritativeTwoLevelScalingRuns({
      lowCandidateScale: 0.97,
      highCandidateScale: 0.94
    }),
    expectedBaselineGitHead: 'e'.repeat(40)
  });

  assert.equal(evidence.status, 'fail');
  assert.equal(evidence.sameN.low.status, 'pass');
  assert.equal(evidence.sameN.high.status, 'pass');
  assert.ok(evidence.blockers.includes(
    'paired-authoritative-two-level-relative-scaling-gain-below-threshold'
  ));
  assert.ok(evidence.blockers.includes(
    'independent-median-authoritative-two-level-relative-scaling-gain-below-threshold'
  ));
});

test('paired authoritative two-level scaling keeps a catastrophic same-N floor and exact route/count coverage', () => {
  const catastrophic = summarizePairedAuthoritativeTwoLevelScalingRuns({
    runs: pairedAuthoritativeTwoLevelScalingRuns({
      lowCandidateScale: 0.74,
      highCandidateScale: 0.90
    }),
    expectedBaselineGitHead: 'e'.repeat(40)
  });
  assert.equal(catastrophic.status, 'fail');
  assert.ok(catastrophic.blockers.includes(
    'low-n-paired-physics-throughput-regression-exceeds-threshold'
  ));
  assert.ok(catastrophic.blockers.includes(
    'low-n-independent-median-physics-throughput-regression-exceeds-threshold'
  ));
  assert.equal(catastrophic.paired.withinThreshold, true);

  const corruptedRuns = pairedAuthoritativeTwoLevelScalingRuns();
  corruptedRuns[0].candidate.scenarios[1].actualParticleCount = 9825;
  corruptedRuns[1].candidate.scenarios[1]
    .schroederTwoLevelMechanicsAuthorityObserved = 'observation';
  const corrupted = summarizePairedAuthoritativeTwoLevelScalingRuns({
    runs: corruptedRuns,
    expectedBaselineGitHead: 'e'.repeat(40)
  });
  assert.equal(corrupted.status, 'fail');
  assert.ok(corrupted.blockers.includes(
    'authoritative-two-level-scaling-particle-coverage-incomplete'
  ));
  assert.ok(corrupted.blockers.includes(
    'high-n-candidate-throughput-evidence-incomplete'
  ));
});

test('Stage 4 campaign accepts a half-speed low-N result only as quantified warning debt', () => {
  const runs = pairedAuthoritativeTwoLevelScalingRuns({
    lowCandidateScale: 0.50,
    highCandidateScale: 0.90
  });
  const measured = summarizePairedAuthoritativeTwoLevelScalingRuns({
    runs,
    expectedBaselineGitHead: 'e'.repeat(40),
    minimumRelativeScalingGain: 1.03,
    minimumSameNThroughputRatio: 0.75
  });
  const accepted = applyAuthoritativeTwoLevelLowNAcceptancePolicy(measured, {
    runs,
    cgroupMemoryEvidence: cleanCampaignMemoryEvidence()
  });

  assert.equal(measured.status, 'fail');
  assert.equal(measured.sameN.low.status, 'fail');
  assert.equal(accepted.status, 'pass');
  assert.equal(accepted.sameN.low.status, 'fail');
  assert.deepEqual(accepted.blockers, []);
  assert.equal(
    accepted.acceptancePolicy.lowN.status,
    'accepted-with-warning'
  );
  assert.equal(accepted.acceptancePolicy.lowN.blocking, false);
  assert.equal(
    accepted.acceptancePolicy.lowN.warningCode,
    'authoritative-two-level-low-n-transitional-throughput-debt'
  );
  assert.equal(
    accepted.acceptancePolicy.lowN.ordinaryMinimumAcceptedRatio,
    0.75
  );
  assert.equal(
    accepted.acceptancePolicy.lowN.catastrophicMinimumAcceptedRatio,
    0.40
  );
  assert.ok(Math.abs(
    accepted.acceptancePolicy.lowN.pairedMedianRatio - 0.50
  ) < 1e-12);
  assert.ok(Math.abs(
    accepted.acceptancePolicy.lowN.pairedDebtToOrdinaryFloorRatio - 0.25
  ) < 1e-12);
  assert.equal(accepted.warnings.length, 1);
  assert.equal(accepted.warnings[0].severity, 'warning');
  assert.equal(accepted.warnings[0].blocking, false);
});

test('Stage 4 campaign hard-blocks low-N below the catastrophic 0.40 floor', () => {
  const runs = pairedAuthoritativeTwoLevelScalingRuns({
    lowCandidateScale: 0.39,
    highCandidateScale: 0.90
  });
  const measured = summarizePairedAuthoritativeTwoLevelScalingRuns({
    runs,
    expectedBaselineGitHead: 'e'.repeat(40),
    minimumRelativeScalingGain: 1.03,
    minimumSameNThroughputRatio: 0.75
  });
  const rejected = applyAuthoritativeTwoLevelLowNAcceptancePolicy(measured, {
    runs,
    cgroupMemoryEvidence: cleanCampaignMemoryEvidence()
  });

  assert.equal(rejected.status, 'fail');
  assert.equal(rejected.acceptancePolicy.lowN.status, 'blocked');
  assert.equal(
    rejected.acceptancePolicy.lowN.catastrophicFloorStatus,
    'not-met'
  );
  assert.ok(rejected.blockers.includes(
    'low-n-paired-catastrophic-throughput-floor-not-met'
  ));
  assert.ok(rejected.blockers.includes(
    'low-n-independent-median-catastrophic-throughput-floor-not-met'
  ));
  assert.deepEqual(rejected.warnings, []);
});

test('Stage 4 low-N debt cannot waive high-N, scaling, or memory failures', () => {
  const summarize = ({ lowCandidateScale, highCandidateScale }) => {
    const runs = pairedAuthoritativeTwoLevelScalingRuns({
      lowCandidateScale,
      highCandidateScale
    });
    const measured = summarizePairedAuthoritativeTwoLevelScalingRuns({
      runs,
      expectedBaselineGitHead: 'e'.repeat(40),
      minimumRelativeScalingGain: 1.03,
      minimumSameNThroughputRatio: 0.75
    });
    return { runs, measured };
  };
  const highFailure = summarize({
    lowCandidateScale: 0.50,
    highCandidateScale: 0.70
  });
  const highRejected = applyAuthoritativeTwoLevelLowNAcceptancePolicy(
    highFailure.measured,
    {
      runs: highFailure.runs,
      cgroupMemoryEvidence: cleanCampaignMemoryEvidence()
    }
  );
  assert.equal(highRejected.status, 'fail');
  assert.equal(highRejected.acceptancePolicy.lowN.status, 'blocked');
  assert.ok(highRejected.blockers.some((blocker) => (
    blocker.startsWith('high-n-')
  )));

  const scalingFailure = summarize({
    lowCandidateScale: 0.80,
    highCandidateScale: 0.81
  });
  const scalingRejected = applyAuthoritativeTwoLevelLowNAcceptancePolicy(
    scalingFailure.measured,
    {
      runs: scalingFailure.runs,
      cgroupMemoryEvidence: cleanCampaignMemoryEvidence()
    }
  );
  assert.equal(scalingRejected.status, 'fail');
  assert.ok(scalingRejected.blockers.includes(
    'paired-authoritative-two-level-relative-scaling-gain-below-threshold'
  ));

  const memoryFailure = cleanCampaignMemoryEvidence();
  memoryFailure.after.memoryPeak = 8_000_000_000;
  const lowDebt = summarize({
    lowCandidateScale: 0.50,
    highCandidateScale: 0.90
  });
  const memoryRejected = applyAuthoritativeTwoLevelLowNAcceptancePolicy(
    lowDebt.measured,
    {
      runs: lowDebt.runs,
      cgroupMemoryEvidence: memoryFailure
    }
  );
  assert.equal(memoryRejected.status, 'fail');
  assert.equal(memoryRejected.acceptancePolicy.lowN.status, 'blocked');
  assert.ok(memoryRejected.blockers.includes(
    'authoritative-two-level-campaign-memory-evidence-incomplete'
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
