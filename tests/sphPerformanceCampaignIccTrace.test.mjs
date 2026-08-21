import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyAuthoritativeTwoLevelLowNAcceptancePolicy,
  buildAuthoritativeTwoLevelCampaignIccTrace,
  exactWorktreeFingerprint
} from '../scripts/sph-performance-acceptance-campaign.mjs';
import {
  convertCampaignReportToIccTrace
} from '../scripts/sph-performance-campaign-icc-trace.mjs';
import {
  summarizePairedAuthoritativeTwoLevelScalingRuns
} from '../scripts/sph-performance-benchmark.mjs';

const repoDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const HISTORICAL_HEAD = '6c20c32b814a0e4cb66ff973fb4cc225659f3f25';
const BASELINE_EXECUTION_HEAD = 'fbcfd6ed2e02420cbd5ab512a56b5a073d114af9';
const BASELINE_FINGERPRINT = 'a'.repeat(64);
const ARTIFACT_SHA256 = 'c'.repeat(64);
const COMMON_CONFIG_SIGNATURE = 'c'.repeat(64);
const BASELINE_ARM_CONFIG_SIGNATURE = 'd'.repeat(64);
const CANDIDATE_ARM_CONFIG_SIGNATURE = 'e'.repeat(64);
const BASELINE_STATUS_HASH = 'e'.repeat(64);
const DEFAULT_CANDIDATE_REPO_DIR = '/tmp/ulg-candidate';
const CHANGED_PATHS = [
  'src/runtime/sph/schroederCrossLevelCouplingGpu.js',
  'src/runtime/sph/schroederSpatialEpochGpu.js',
  'src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js',
  'src/runtime/sph/schroederSpatialParentFieldViewGpu.js',
  'src/services/ulgOffscreenRender.worker.js',
  'tests/schroederSpatialParentFieldMechanicsWorkspaceGpu.test.mjs',
  'tests/schroederSpatialParentFieldViewGpu.test.mjs',
  'ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspace.js',
  'ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspaceWgsl.js',
  'ulg-gpu-abi/src/schroederSpatialParentFieldViewWgsl.js'
];
const PINNED_ENVIRONMENT = {
  ULG_VITE_HTTPS: '0',
  ULG_PROBE_HEADLESS: '1',
  ULG_PROBE_CHROMIUM_EXECUTABLE: '/usr/bin/google-chrome',
  ULG_PROBE_CHROMIUM_ARGS: '--ignore-gpu-blocklist',
  ULG_BENCH_MAX_READBACK_BYTES_PER_STEP: '0',
  ULG_BENCH_COMPACT_SUMMARY_MODE: 'none',
  ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE: 'final-only',
  ULG_BENCH_FUSE_RESIDENT_MECHANICS_SEQUENCE: '1',
  ULG_BENCH_FUSE_RESIDENT_ACTIVE_GRID: '1',
  ULG_BENCH_MEASURE_GPU_QUEUE_FENCE: '0',
  ULG_BENCH_LAW_THERMAL: '1',
  ULG_BENCH_LAW_REACTIONS: '1',
  ULG_BENCH_LAW_VISCOSITY: '1',
  ULG_BENCH_LAW_SURFACE_TENSION: '0',
  ULG_BENCH_VIEWPORT_WIDTH: '1280',
  ULG_BENCH_VIEWPORT_HEIGHT: '800',
  ULG_BENCH_IS_MOBILE: '0',
  ULG_BENCH_HAS_TOUCH: '0',
  ULG_BENCH_SURFACE_DRAW_MODE: 'three-render-row-points',
  ULG_BENCH_MATERIAL_INTERFACE_DIAGNOSTIC: '0',
  ULG_BENCH_CAPTURE_THERMAL_CSR_ROUTE_EVIDENCE: '0',
  VITE_ULG_SCHROEDER_SPATIAL_EPOCH_ARENA_COUNT: '4',
  VITE_ULG_SCHROEDER_PARENT_FIELD_MECHANICS_ARENA_COUNT: '1'
};

function syntheticCandidateWorktree() {
  return {
    gitHead: 'd'.repeat(40),
    sourceFingerprint: 'b'.repeat(64),
    worktreeDirty: true,
    worktreeStatusHash: 'f'.repeat(64),
    trackedAndUntrackedFileCount: 683
  };
}

function normalizationAttestation() {
  return {
    schema:
      'peercompute.ulg.performance-baseline-normalization-attestation.v1',
    policyId: 'webgpu-portability-v1',
    status: 'verified',
    claim: 'approved-portability-normalized-historical-algorithm',
    historicalOriginGitHead: HISTORICAL_HEAD,
    executionGitHead: BASELINE_EXECUTION_HEAD,
    directParentGitHead: HISTORICAL_HEAD,
    directNonMergeDescendant: true,
    canonicalDiffAlgorithm: 'git-diff-binary-full-index-v1',
    canonicalDiffSha256:
      '029d3c8c1e6ed4c6c7eb15fcbeacc58ebe8f08295de8895f4de0f2cefb58ce06',
    canonicalDiffByteLength: 73566,
    changedPaths: [...CHANGED_PATHS],
    changedPathPolicyComplete: true,
    sourceFingerprint: BASELINE_FINGERPRINT,
    trackedAndUntrackedFileCount: 548,
    runtimeEnvironment: {
      VITE_ULG_SCHROEDER_SPATIAL_EPOCH_ARENA_COUNT: '4',
      VITE_ULG_SCHROEDER_PARENT_FIELD_MECHANICS_ARENA_COUNT: '1'
    }
  };
}

function scenario(targetParticleCount, {
  physicsStepsPerSecond,
  backpressureWaitCount = 0,
  backpressureWaitMs = 0,
  pairV2 = false
}) {
  return {
    targetParticleCount,
    actualParticleCount: targetParticleCount,
    effectiveParticleCount: targetParticleCount,
    status: 'good',
    performanceGate: {
      status: 'pass',
      blockers: [],
      thresholds: { maxReadbackBytesPerStep: 0 },
      observed: {
        estimatedReadbackBytesPerStep: 0,
        schroederMechanicsFieldPairV2Requested: pairV2,
        schroederMechanicsFieldPairV2Enabled: pairV2 ? true : null,
        schroederMechanicsFieldConstructionMode:
          pairV2 ? 'paired-v2-shared-radix' : null,
        schroederMechanicsFieldPairV2CoverageComplete:
          pairV2 ? true : null
      }
    },
    probeMode: 'scene',
    physicsStepsPerSecondSource: 'complete-engine-batch',
    physicsStepsPerSecond,
    batches: 5,
    batchSteps: 16,
    completedStepCount: 16,
    schroederSimulationConfiguredRequested: true,
    schroederSimulationActive: true,
    schroederTransactionCoverageComplete: true,
    schroederSpatialEpochGenerationCoverageComplete: true,
    schroederTransactionLifecycleCoverageComplete: true,
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
    schroederMechanicsFieldPairV2ConfiguredRequested: pairV2,
    schroederMechanicsFieldPairV2Enabled: pairV2 ? true : null,
    schroederMechanicsFieldConstructionMode:
      pairV2 ? 'paired-v2-shared-radix' : null,
    schroederMechanicsFieldPairV2CoverageComplete:
      pairV2 ? true : null,
    scenarioUrl:
      '/?ss=1&schroederLevel=0&schroederMaxLevel=1'
      + '&schroederSpatialArenaCount=4'
      + '&schroederCrossLevelCoupling=1&schroederTwoLevel=1'
      + '&schroederTwoLevelAuthority=authoritative'
      + '&schroederTwoLevelSubsteps=2'
      + (pairV2 ? '&schroederMechanicsFieldPairV2=1' : ''),
    schroederBackpressureWaitCount: backpressureWaitCount,
    schroederBackpressureWaitMs: backpressureWaitMs,
    probeIssues: [],
    estimatedReadbackBytesPerStep: 0,
    estimatedReadbackBytesPerBatch: 0,
    copyBudget: {
      schema: 'peercompute.ulg.sph-performance-benchmark-copy-budget.v0',
      estimatedReadbackBytesPerStep: 0,
      estimatedReadbackBytesPerBatch: 0,
      renderRowsReadbackByteLength: 0,
      surfaceDrawSummaryReadbackByteLength: 0
    },
    renderRowsReadback: false,
    surfaceDrawReadback: false,
    surfaceDrawSummaryReadback: false,
    schroederRenderFieldReadback: false,
    schroederRenderRowsReadback: false,
    renderRowsReadbackMode: 'no-full-readback',
    thermalCandidateCsrRouteEvidence: {
      status: 'not-requested',
      requested: false,
      normalHotLoopReadbackFree: true
    },
    probeResidentBatchTiming: {
      residentStageWallTrace: {
        status: 'not-requested',
        requested: false,
        mapAsyncCount: 0,
        queueFenceCount: 0
      },
      gpuTimestampInterval: {
        status: 'not-requested',
        requested: false,
        mapAsyncCount: 0
      },
      gpuStageTimestamps: {
        status: 'not-requested',
        requested: false,
        mapAsyncCount: 0
      }
    }
  };
}

function arm({
  baseline,
  runIndex,
  port,
  currentWorktree,
  lowNPass,
  backpressureWaitCount
}) {
  const fingerprint = baseline
    ? BASELINE_FINGERPRINT
    : currentWorktree.sourceFingerprint;
  const gitHead = baseline
    ? BASELINE_EXECUTION_HEAD
    : currentWorktree.gitHead;
  const statusHash = baseline
    ? BASELINE_STATUS_HASH
    : currentWorktree.worktreeStatusHash;
  const worktreeDirty = baseline ? false : currentWorktree.worktreeDirty;
  const trackedFileCount = baseline
    ? 548
    : currentWorktree.trackedAndUntrackedFileCount;
  const outputPath = `/tmp/run-${runIndex}-${
    baseline ? 'baseline' : 'candidate'
  }.json`;
  const lowFps = baseline ? 4.2 : (lowNPass ? 4.2 : 2.1);
  const highFps = baseline ? 0.7 : 1.45;
  return {
    arm: baseline ? 'baseline' : 'candidate',
    port,
    outputPath,
    outputArtifact: {
      path: outputPath,
      byteLength: 2048 + runIndex,
      sha256: (baseline ? 'e' : 'f').repeat(64)
    },
    process: {
      exitCode: 0,
      signal: null,
      error: null,
      stderrTail: ''
    },
    reportStatus: 'complete',
    reportPerformanceGateStatus: 'pass',
    sourceProvenance: {
      gitHead,
      sourceFingerprintBefore: fingerprint,
      sourceFingerprintAfter: fingerprint,
      worktreeStatusHashBefore: statusHash,
      worktreeStatusHashAfter: statusHash,
      worktreeDirtyBefore: worktreeDirty,
      worktreeDirtyAfter: worktreeDirty,
      trackedAndUntrackedFileCountBefore: trackedFileCount,
      trackedAndUntrackedFileCountAfter: trackedFileCount,
      commonConfigSignature: COMMON_CONFIG_SIGNATURE,
      armConfigSignature: baseline
        ? BASELINE_ARM_CONFIG_SIGNATURE
        : CANDIDATE_ARM_CONFIG_SIGNATURE,
      normalizationAttestation: baseline
        ? normalizationAttestation()
        : null,
      normalizationAttestationStable: baseline ? true : null
    },
    scenarios: [
      scenario(1024, {
        physicsStepsPerSecond: lowFps,
        pairV2: !baseline
      }),
      scenario(9826, {
        physicsStepsPerSecond: highFps,
        backpressureWaitCount,
        backpressureWaitMs: backpressureWaitCount === 0 ? 0 : 100,
        pairV2: !baseline
      })
    ]
  };
}

function memoryEvidence() {
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

function campaignReport({
  lowNPass = false,
  currentWorktree = syntheticCandidateWorktree(),
  candidateRepoDir = DEFAULT_CANDIDATE_REPO_DIR,
  backpressureWaits = [10, 6, 0]
} = {}) {
  const armPorts = [5280, 5282, 5284, 5286, 5288, 5290];
  const runs = ['AB', 'BA', 'AB'].map((order, index) => ({
    runId: `authoritative-two-level-scaling-pair-${index + 1}`,
    order,
    baseline: arm({
      baseline: true,
      runIndex: index + 1,
      port: armPorts[(index * 2) + (order === 'AB' ? 0 : 1)],
      currentWorktree,
      lowNPass,
      backpressureWaitCount: 0
    }),
    candidate: arm({
      baseline: false,
      runIndex: index + 1,
      port: armPorts[(index * 2) + (order === 'AB' ? 1 : 0)],
      currentWorktree,
      lowNPass,
      backpressureWaitCount: backpressureWaits[index]
    })
  }));
  const normalization = normalizationAttestation();
  const rawAggregation = summarizePairedAuthoritativeTwoLevelScalingRuns({
    runs,
    requiredRunCount: 3,
    expectedRunOrders: ['AB', 'BA', 'AB'],
    requiredWarmupBatchCount: 4,
    requiredMeasuredBatchCount: 1,
    requiredBatchStepCount: 16,
    expectedBaselineGitHead: BASELINE_EXECUTION_HEAD,
    requiredFineSubstepCount: 2,
    requiredParticleCounts: [1024, 9826],
    minimumRelativeScalingGain: 1.03,
    minimumSameNThroughputRatio: 0.75
  });
  const cgroupMemory = memoryEvidence();
  const aggregation = applyAuthoritativeTwoLevelLowNAcceptancePolicy(
    rawAggregation,
    {
      runs,
      cgroupMemoryEvidence: cgroupMemory
    }
  );
  return {
    schema:
      'peercompute.ulg.authoritative-two-level-physics-scaling-compatibility-normalized-campaign.v1',
    status: aggregation.status,
    generatedAt: '2026-07-31T04:41:31.914Z',
    campaignKind: 'authoritative-two-level-physics-fps-historical',
    candidateRepoDir,
    baselineRepoDir: '/tmp/ulg-baseline',
    artifactDirectory: '/tmp/ulg-campaign',
    targetInterpretation:
      'same-authoritative-two-level-ss-on-route-approved-portability-normalized-historical-algorithm-versus-current-complete-engine-relative-scaling-gate',
    armPorts,
    materials: {
      drop: 'h2o',
      base: 'h2o',
      dropTemperatureK: 300,
      baseTemperatureK: 300
    },
    armFailureCount: 0,
    baselineNormalization: normalization,
    executionProvenance: {
      schema: 'peercompute.ulg.performance-campaign-execution-provenance.v1',
      node: {
        executable: '/usr/bin/node',
        version: 'v24.18.0'
      },
      chromium: {
        executable: '/usr/bin/google-chrome',
        version: 'Google Chrome test',
        args: '--ignore-gpu-blocklist',
        headless: '1'
      },
      dependencies: {
        playwright: '1.60.0',
        vite: '8.0.16',
        packageLockSha256: '9'.repeat(64)
      },
      commonConfigSignature: COMMON_CONFIG_SIGNATURE,
      externallyPinnedPerformanceEnvironment: { ...PINNED_ENVIRONMENT },
      cgroupMemory
    },
    aggregation: {
      ...aggregation,
      schema:
        'peercompute.ulg.sph-paired-authoritative-two-level-physics-scaling-compatibility-normalized-campaign.v1',
      baselineNormalization: normalization
    },
    runs
  };
}

function buildFixtureTrace(report, currentWorktree, reportPath) {
  return buildAuthoritativeTwoLevelCampaignIccTrace(report, {
    reportPath,
    artifactSha256: ARTIFACT_SHA256,
    expectedCandidateWorktree: currentWorktree,
    expectedCandidateRepoDir: report.candidateRepoDir
  });
}

test('campaign ICC trace keeps backpressure blocking low-N debt acceptance', () => {
  const currentWorktree = syntheticCandidateWorktree();
  const report = campaignReport({ currentWorktree });
  const events = buildFixtureTrace(
    report,
    currentWorktree,
    '/tmp/campaign.json'
  );

  assert.deepEqual(
    events.map(({ status }) => status),
    ['PASS', 'PASS', 'FAIL', 'PASS', 'PASS', 'FAIL', 'PASS']
  );
  assert.equal(events.every((event) => event.details.authentic), true);
  assert.equal(
    events[2].name,
    'authoritative_two_level_zero_backpressure_waits'
  );
  assert.equal(
    events[5].name,
    'authoritative_two_level_low_n_catastrophic_floor_met'
  );
  assert.equal(events[5].classification, 'blocking-failure');
  assert.equal(events[5].details.lowNReceiptStatus, 'blocked');
  assert.equal(
    events[1].name,
    'authoritative_two_level_configured_copy_budget_zero'
  );
  assert.equal(
    events.some((event) => event.name === 'normal_hot_loop_readback_free'),
    false
  );
});

test('campaign ICC trace retains half-speed low-N as a quantified warning, not an ordinary-floor PASS', () => {
  const currentWorktree = syntheticCandidateWorktree();
  const report = campaignReport({
    currentWorktree,
    backpressureWaits: [0, 0, 0]
  });
  const events = buildFixtureTrace(
    report,
    currentWorktree,
    '/tmp/low-n-warning.json'
  );
  const lowN = events.find((event) => (
    event.name === 'authoritative_two_level_low_n_catastrophic_floor_met'
  ));

  assert.equal(report.status, 'pass');
  assert.equal(report.aggregation.sameN.low.status, 'fail');
  assert.equal(events.every((event) => event.status === 'PASS'), true);
  assert.equal(lowN.classification, 'accepted-with-warning');
  assert.equal(lowN.details.lowNReceiptStatus, 'accepted-with-warning');
  assert.equal(lowN.details.ordinaryFloorStatus, 'below');
  assert.equal(lowN.details.catastrophicFloorStatus, 'met');
  assert.equal(
    lowN.details.warningCode,
    'authoritative-two-level-low-n-transitional-throughput-debt'
  );
  assert.ok(Math.abs(lowN.details.pairedMedianRatio - 0.50) < 1e-12);
  assert.equal(lowN.details.ordinaryMinimumAcceptedRatio, 0.75);
  assert.equal(lowN.details.catastrophicMinimumAcceptedRatio, 0.40);
  assert.ok(Math.abs(
    lowN.details.pairedDebtToOrdinaryFloorRatio - 0.25
  ) < 1e-12);
  assert.match(lowN.snippet, /^WARNING:/u);
});

test('campaign ICC trace recomputes statistics and fails closed on drift', () => {
  const currentWorktree = syntheticCandidateWorktree();
  const drifted = campaignReport({
    lowNPass: true,
    currentWorktree,
    backpressureWaits: [0, 0, 0]
  });
  drifted.runs[1].candidate.sourceProvenance.sourceFingerprintBefore =
    '1'.repeat(64);
  drifted.runs[1].candidate.sourceProvenance.sourceFingerprintAfter =
    '1'.repeat(64);
  const driftEvents = buildFixtureTrace(
    drifted,
    currentWorktree,
    '/tmp/drifted.json'
  );
  assert.equal(driftEvents.every((event) => event.status === 'FAIL'), true);
  assert.equal(driftEvents.every((event) => !event.details.authentic), true);

  const forged = campaignReport({
    currentWorktree,
    backpressureWaits: [0, 0, 0]
  });
  forged.aggregation.sameN.low.status = 'pass';
  forged.aggregation.sameN.low.paired.withinThreshold = true;
  forged.aggregation.sameN.low.independentMedianCrossCheck.withinThreshold =
    true;
  forged.status = 'pass';
  const forgedEvents = buildFixtureTrace(
    forged,
    currentWorktree,
    '/tmp/forged.json'
  );
  assert.equal(forgedEvents.every((event) => event.status === 'FAIL'), true);
  assert.equal(
    forgedEvents.every(
      (event) => event.details.aggregationRecomputedExact === false
    ),
    true
  );
});

test('campaign ICC trace rejects missing coverage and invalid memory caps', () => {
  const currentWorktree = syntheticCandidateWorktree();
  const incomplete = campaignReport({
    lowNPass: true,
    currentWorktree,
    backpressureWaits: [0, 0, 0]
  });
  incomplete.runs[2].candidate.scenarios.pop();
  const incompleteEvents = buildFixtureTrace(
    incomplete,
    currentWorktree,
    '/tmp/incomplete.json'
  );
  assert.equal(
    incompleteEvents.every((event) => event.status === 'FAIL'),
    true
  );

  const overCap = campaignReport({
    lowNPass: true,
    currentWorktree,
    backpressureWaits: [0, 0, 0]
  });
  overCap.executionProvenance.cgroupMemory.after.memoryPeak =
    8_000_000_000;
  overCap.status = 'fail';
  const overCapEvents = buildFixtureTrace(
    overCap,
    currentWorktree,
    '/tmp/over-cap.json'
  );
  assert.equal(overCapEvents.every((event) => event.status === 'FAIL'), true);
});

test('campaign ICC trace rejects a candidate that does not authenticate paired-v2', () => {
  const currentWorktree = syntheticCandidateWorktree();
  const report = campaignReport({
    lowNPass: true,
    currentWorktree,
    backpressureWaits: [0, 0, 0]
  });
  report.runs[1].candidate.scenarios[0]
    .schroederMechanicsFieldConstructionMode = 'independent-v2';
  const measured = summarizePairedAuthoritativeTwoLevelScalingRuns({
    runs: report.runs,
    requiredRunCount: 3,
    expectedRunOrders: ['AB', 'BA', 'AB'],
    requiredWarmupBatchCount: 4,
    requiredMeasuredBatchCount: 1,
    requiredBatchStepCount: 16,
    expectedBaselineGitHead: BASELINE_EXECUTION_HEAD,
    requiredFineSubstepCount: 2,
    requiredParticleCounts: [1024, 9826],
    minimumRelativeScalingGain: 1.03,
    minimumSameNThroughputRatio: 0.75
  });
  const recomputed = applyAuthoritativeTwoLevelLowNAcceptancePolicy(
    measured,
    {
      runs: report.runs,
      cgroupMemoryEvidence: report.executionProvenance.cgroupMemory
    }
  );
  report.status = recomputed.status;
  report.aggregation = {
    ...recomputed,
    schema:
      'peercompute.ulg.sph-paired-authoritative-two-level-physics-scaling-compatibility-normalized-campaign.v1',
    baselineNormalization: report.baselineNormalization
  };

  const events = buildFixtureTrace(
    report,
    currentWorktree,
    '/tmp/pair-v2-mismatch.json'
  );
  assert.equal(events.every((event) => event.status === 'FAIL'), true);
  assert.equal(
    events.every(
      (event) => event.details.aggregationRecomputedExact === true
    ),
    true
  );
  assert.equal(events.every((event) => event.details.authentic === false), true);
});

test('campaign trace replay binds PASS evidence to the current worktree', async (t) => {
  const temporaryDir = await mkdtemp(
    path.join(os.tmpdir(), 'ulg-campaign-icc-trace-')
  );
  t.after(() => rm(temporaryDir, { recursive: true, force: true }));
  const reportPath = path.join(temporaryDir, 'campaign.json');
  const outputPath = path.join(temporaryDir, 'campaign.icc.jsonl');
  const currentWorktree = await exactWorktreeFingerprint(repoDir);

  await writeFile(
    reportPath,
    `${JSON.stringify(campaignReport({
      lowNPass: true,
      currentWorktree,
      candidateRepoDir: repoDir,
      backpressureWaits: [0, 0, 0]
    }))}\n`,
    'utf8'
  );
  const passing = await convertCampaignReportToIccTrace({
    reportPath,
    outputPath,
    repoDir
  });
  assert.equal(passing.allPassed, true);
  assert.equal(
    passing.currentWorktree.sourceFingerprint,
    currentWorktree.sourceFingerprint
  );

  await writeFile(reportPath, '{"truncated":', 'utf8');
  const failing = await convertCampaignReportToIccTrace({
    reportPath,
    outputPath,
    repoDir
  });
  assert.equal(failing.allPassed, false);
  assert.match(failing.conversionError, /JSON/u);

  const persisted = (await readFile(outputPath, 'utf8'))
    .trim()
    .split('\n')
    .map(JSON.parse);
  assert.equal(persisted.length, 7);
  assert.equal(persisted.every((event) => event.status === 'FAIL'), true);
  assert.equal(
    persisted.every((event) => event.details.authentic === false),
    true
  );
  assert.equal(
    persisted.every(
      (event) => typeof event.details.conversionError === 'string'
    ),
    true
  );
});

test('campaign trace replay rejects a stale candidate fingerprint', async (t) => {
  const temporaryDir = await mkdtemp(
    path.join(os.tmpdir(), 'ulg-campaign-icc-stale-')
  );
  t.after(() => rm(temporaryDir, { recursive: true, force: true }));
  const reportPath = path.join(temporaryDir, 'campaign.json');
  const outputPath = path.join(temporaryDir, 'campaign.icc.jsonl');
  await writeFile(
    reportPath,
    `${JSON.stringify(campaignReport({
      lowNPass: true,
      backpressureWaits: [0, 0, 0]
    }))}\n`,
    'utf8'
  );

  const stale = await convertCampaignReportToIccTrace({
    reportPath,
    outputPath,
    repoDir
  });
  assert.equal(stale.conversionError, null);
  assert.equal(stale.allPassed, false);
  assert.equal(stale.events.every((event) => event.status === 'FAIL'), true);
  assert.equal(stale.events.every((event) => !event.details.authentic), true);
});
