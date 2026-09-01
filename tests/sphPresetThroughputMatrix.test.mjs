import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SPH_PRESET_THROUGHPUT_MATRIX_SCHEMA,
  SPH_PRESET_THROUGHPUT_SCENARIO_SCHEMA,
  evaluateSphPresetThroughputSamples,
  expectedSphPresetExecutionRoute
} from '../scripts/sph-preset-throughput-matrix.mjs';
import {
  ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA
} from '../src/services/workerResidentScheduleTaskYielder.js';

function controlPlaneYieldReceipt(overrides = {}) {
  return {
    schema:
      ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA,
    status: 'worker-resident-schedule-control-plane-yield-not-required',
    mode: 'none',
    mechanism: 'none-atomic-tier0',
    scheduledYieldOpportunityCount: 0,
    yieldRequestCount: 0,
    completedYieldCount: 0,
    messageChannelCreated: false,
    messageChannelYieldCount: 0,
    timerFallbackYieldCount: 0,
    ownedPortCount: 0,
    closedPortCount: 0,
    portsClosed: true,
    totalWaitMs: 0,
    ...overrides
  };
}

function workerLanePageTiming(authorityCommitCompletedAtMs, overrides = {}) {
  return {
    scheduleFunctionEnteredAtMs: authorityCommitCompletedAtMs - 60,
    scheduleDispatchPostedAtMs: authorityCommitCompletedAtMs - 50,
    scheduleTerminalReceivedAtMs: authorityCommitCompletedAtMs - 5,
    authorityCommitCompletedAtMs,
    laneExecutionReturnedAtMs: authorityCommitCompletedAtMs + 2,
    ...overrides
  };
}

function tier0Sample(index, overrides = {}) {
  const authorityCommitCompletedAtMs = 1_000 + index * 64;
  return {
    capturedAtMs: authorityCommitCompletedAtMs + 4,
    pageTimeOriginMs: 1_000_000,
    laneSimTimeS: index * 0.064,
    laneCompletedStepTotal: index * 64,
    laneId: 'lane:fixture',
    stateKey: 'lane:fixture:state',
    laneSeededThisSchedule: index === 0,
    scheduleId: `lane:fixture:schedule:${index + 1}`,
    scheduleFirstStepStartedAtMs: index * 64,
    resultAssembledAtMs: index * 64 + 48,
    workerLanePageTiming:
      workerLanePageTiming(authorityCommitCompletedAtMs),
    lastResidentPostComputeMs: 16,
    fullParticleReadbackFree: true,
    workerLaneContinuationReady: true,
    committedPresentationReady: true,
    runtimeError: null,
    controlPlaneYieldReceipt: controlPlaneYieldReceipt(),
    executionRoute: {
      route: 'tier0-fused-resident-sequence',
      terminalFenceSatisfied: true,
      residentContinuationReady: true,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      mapAsyncCount: 0,
      readbackBytes: 0
    },
    ...overrides
  };
}

function assertClose(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test('configured preset route expectations cover both canonical and Tier-0 arms', () => {
  assert.equal(
    SPH_PRESET_THROUGHPUT_MATRIX_SCHEMA,
    'peercompute.ulg.sph-preset-throughput-matrix.v1'
  );
  assert.equal(
    SPH_PRESET_THROUGHPUT_SCENARIO_SCHEMA,
    'peercompute.ulg.sph-preset-throughput-scenario.v1'
  );
  assert.equal(
    expectedSphPresetExecutionRoute('water-cycle'),
    'canonical-schroeder'
  );
  assert.equal(
    expectedSphPresetExecutionRoute('iron-ice-quench'),
    'canonical-schroeder'
  );
  assert.equal(
    expectedSphPresetExecutionRoute('sodium-water'),
    'canonical-schroeder'
  );
  assert.equal(
    expectedSphPresetExecutionRoute('cesium-fluorine'),
    'canonical-schroeder'
  );
  assert.equal(
    expectedSphPresetExecutionRoute('bulk-water'),
    'tier0-fused-resident-sequence'
  );
  assert.equal(
    expectedSphPresetExecutionRoute('water-realtime'),
    'tier0-fused-resident-sequence'
  );
});

test('throughput evaluator measures simulation time per wall time after warmup', () => {
  const result = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [0, 1, 2, 3].map(tier0Sample),
    warmupCommitCount: 1,
    minRealtimeFactor: 1
  });
  assert.equal(result.status, 'pass');
  assert.equal(result.timingBasis, 'page-authority-commit');
  assert.equal(result.timingReady, true);
  assert.equal(result.authorityCadenceReady, true);
  assert.equal(result.capturedCadenceReady, true);
  assert.equal(result.cohortStable, true);
  assert.equal(result.scheduleIdentityReady, true);
  assert.equal(result.pageAuthorityPhaseOrderValid, true);
  assert.equal(result.progressCountersReady, true);
  assert.equal(result.counterResetDetected, false);
  assert.equal(result.realTimeFactor, 1);
  assert.equal(result.physicsStepsPerSecond, 1_000);
  assert.equal(result.capturedRealTimeFactor, 1);
  assert.equal(result.capturedPhysicsStepsPerSecond, 1_000);
  assert.equal(result.routeMatched, true);
  assert.equal(result.terminalAuthorityReady, true);
  assert.equal(result.readbackFree, true);
  assert.equal(result.controlPlaneYieldEvidenceReady, true);
  assert.deepEqual(
    result.controlPlaneYieldMechanisms,
    ['none-atomic-tier0']
  );
  assert.equal(result.meanControlPlaneYieldWaitMs, 0);
  assert.equal(result.meanControlPlaneYieldWaitPerBoundaryMs, 0);
  assert.equal(result.meanWorkerTurnaroundMs, 16);
  assert.equal(result.meanPostComputeMs, 16);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.timingFailureReasons), true);
  assert.equal(Object.isFrozen(result.controlPlaneYieldMechanisms), true);
  assert.equal(Object.isFrozen(result.intervals), true);
  assert.equal(Object.isFrozen(result.intervals[0]), true);
});

test('throughput evaluator fails closed on a wrong route or readback', () => {
  const wrongRoute = tier0Sample(2, {
    executionRoute: {
      ...tier0Sample(2).executionRoute,
      route: 'canonical-schroeder'
    }
  });
  const routeResult = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [tier0Sample(0), tier0Sample(1), wrongRoute],
    warmupCommitCount: 0
  });
  assert.equal(routeResult.status, 'fail');
  assert.equal(routeResult.routeMatched, false);

  const readback = tier0Sample(2, {
    fullParticleReadbackFree: false,
    executionRoute: {
      ...tier0Sample(2).executionRoute,
      fullParticleReadbackPerformed: true,
      fullParticleReadbackFree: false,
      mapAsyncCount: 1,
      readbackBytes: 64
    }
  });
  const readbackResult = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [tier0Sample(0), tier0Sample(1), readback],
    warmupCommitCount: 0
  });
  assert.equal(readbackResult.status, 'fail');
  assert.equal(readbackResult.readbackFree, false);
});

test('canonical authority uses the full worker-lane predicate instead of a Tier0-only route field', () => {
  const canonicalSample = (index, overrides = {}) => tier0Sample(index, {
    controlPlaneYieldReceipt: controlPlaneYieldReceipt({
      status: 'worker-resident-schedule-control-plane-yielder-closed',
      mode: 'message-channel',
      mechanism: 'message-channel-task',
      scheduledYieldOpportunityCount: 15,
      yieldRequestCount: 15,
      completedYieldCount: 15,
      messageChannelCreated: true,
      messageChannelYieldCount: 15,
      ownedPortCount: 2,
      closedPortCount: 2,
      totalWaitMs: 30
    }),
    executionRoute: {
      route: 'canonical-schroeder',
      terminalFenceSatisfied: true,
      residentContinuationReady: false,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: false,
      mapAsyncCount: null,
      readbackBytes: null
    },
    ...overrides
  });
  const passed = evaluateSphPresetThroughputSamples({
    presetId: 'water-cycle',
    samples: [0, 1, 2].map(canonicalSample),
    warmupCommitCount: 0,
    minRealtimeFactor: 0.001
  });
  assert.equal(passed.routeMatched, true);
  assert.equal(passed.terminalAuthorityReady, true);
  assert.equal(passed.readbackFree, true);
  assert.equal(passed.controlPlaneYieldEvidenceReady, true);
  assert.deepEqual(
    passed.controlPlaneYieldMechanisms,
    ['message-channel-task']
  );
  assert.equal(passed.meanControlPlaneYieldWaitMs, 30);
  assert.equal(passed.meanControlPlaneYieldWaitPerBoundaryMs, 2);
  assert.equal(passed.status, 'pass');

  const missingLaneAuthority = canonicalSample(2, {
    workerLaneContinuationReady: false
  });
  const failed = evaluateSphPresetThroughputSamples({
    presetId: 'water-cycle',
    samples: [canonicalSample(0), canonicalSample(1), missingLaneAuthority],
    warmupCommitCount: 0,
    minRealtimeFactor: 0.001
  });
  assert.equal(failed.terminalAuthorityReady, false);
  assert.equal(failed.status, 'fail');
});

test('authority cadence ignores polling jitter and aggregates skipped variable batches after warmup deduplication', () => {
  const warmup = tier0Sample(0, { capturedAtMs: 2_000 });
  const duplicateWarmup = {
    ...warmup,
    capturedAtMs: 9_000
  };
  const first = tier0Sample(1, { capturedAtMs: 10_000 });
  const second = tier0Sample(2, { capturedAtMs: 16_000 });
  const skippedBatch = tier0Sample(4, { capturedAtMs: 28_000 });
  const result = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [warmup, duplicateWarmup, first, second, skippedBatch],
    warmupCommitCount: 1
  });

  assert.equal(result.status, 'pass');
  assert.equal(result.observedSampleCount, 5);
  assert.equal(result.observedCommitEndpointCount, 4);
  assert.equal(result.duplicateSampleCount, 1);
  assert.equal(result.measuredCommitEndpointCount, 3);
  assert.equal(result.measuredIntervalCount, 2);
  assert.equal(result.wallDeltaS, 0.192);
  assert.equal(result.simTimeDeltaS, 0.192);
  assert.equal(result.stepDelta, 192);
  assert.equal(result.realTimeFactor, 1);
  assert.equal(result.physicsStepsPerSecond, 1_000);
  assert.equal(result.capturedWallDeltaS, 18);
  assertClose(result.capturedRealTimeFactor, 0.192 / 18);
  assertClose(result.capturedPhysicsStepsPerSecond, 192 / 18);
  assert.deepEqual(
    result.intervals.map((interval) => interval.wallDeltaMs),
    [64, 128]
  );
  assert.deepEqual(
    result.intervals.map((interval) => interval.capturedWallDeltaMs),
    [6_000, 12_000]
  );
  assert.deepEqual(
    result.intervals.map((interval) => interval.schedulesAdjacent),
    [true, false]
  );
  assert.equal(result.meanWorkerTurnaroundMs, 16);
});

test('missing authority timing fails closed without falling back to capture cadence', () => {
  const missingCommit = tier0Sample(1, {
    workerLanePageTiming: workerLanePageTiming(1_064, {
      authorityCommitCompletedAtMs: null
    })
  });
  const result = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [tier0Sample(0), missingCommit, tier0Sample(2)],
    warmupCommitCount: 0
  });

  assert.equal(result.status, 'fail');
  assert.equal(result.timingReady, false);
  assert.equal(result.authorityCadenceReady, false);
  assert.equal(result.capturedCadenceReady, true);
  assert.equal(result.wallDeltaS, null);
  assert.equal(result.realTimeFactor, null);
  assert.equal(result.physicsStepsPerSecond, null);
  assert.equal(result.capturedWallDeltaS, 0.128);
  assert.equal(result.capturedRealTimeFactor, 1);
  assert.ok(
    result.timingFailureReasons.includes('authority-commit-cadence-invalid')
  );
});

test('non-authoritative polling cadence and worker-clock diagnostics do not gate authority cadence', () => {
  const first = tier0Sample(1, {
    capturedAtMs: 2_000,
    resultAssembledAtMs: null,
    lastResidentPostComputeMs: null
  });
  const second = tier0Sample(2, {
    capturedAtMs: null,
    scheduleFirstStepStartedAtMs: null
  });
  const result = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [first, second],
    warmupCommitCount: 0,
    sampleIntervalCount: 1
  });

  assert.equal(result.status, 'pass');
  assert.equal(result.timingReady, true);
  assert.equal(result.authorityCadenceReady, true);
  assert.equal(result.capturedCadenceReady, false);
  assert.equal(result.realTimeFactor, 1);
  assert.equal(result.capturedWallDeltaS, null);
  assert.equal(result.capturedRealTimeFactor, null);
  assert.equal(result.capturedPhysicsStepsPerSecond, null);
  assert.equal(result.meanWorkerTurnaroundMs, null);
  assert.equal(result.meanPostComputeMs, null);
});

test('internal counter reset cannot be hidden by positive endpoint progress', () => {
  const before = tier0Sample(2);
  const advanced = tier0Sample(5);
  const reset = tier0Sample(6, {
    laneCompletedStepTotal: 192,
    laneSimTimeS: 0.192
  });
  const result = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [before, advanced, reset],
    warmupCommitCount: 0,
    minRealtimeFactor: 0.001
  });

  assert.ok(reset.laneCompletedStepTotal > before.laneCompletedStepTotal);
  assert.equal(result.status, 'fail');
  assert.equal(result.counterResetDetected, true);
  assert.equal(result.progressCountersReady, false);
  assert.equal(result.stepDelta, null);
  assert.equal(result.simTimeDeltaS, null);
  assert.ok(
    result.timingFailureReasons.includes('lane-progress-counter-reset')
  );
});

test('mixed authority cohorts, phase-order violations, and conflicting commits fail closed', () => {
  const mixedCohort = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [
      tier0Sample(0),
      tier0Sample(1, { laneId: 'lane:other' }),
      tier0Sample(2)
    ],
    warmupCommitCount: 0
  });
  assert.equal(mixedCohort.status, 'fail');
  assert.equal(mixedCohort.cohortStable, false);

  const phaseOrder = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [
      tier0Sample(0),
      tier0Sample(1, {
        workerLanePageTiming: workerLanePageTiming(1_064, {
          scheduleTerminalReceivedAtMs: 1_065
        })
      }),
      tier0Sample(2)
    ],
    warmupCommitCount: 0
  });
  assert.equal(phaseOrder.status, 'fail');
  assert.equal(phaseOrder.pageAuthorityPhaseOrderValid, false);

  const firstCommit = tier0Sample(1);
  const conflictingCommit = {
    ...firstCommit,
    workerLanePageTiming: {
      ...firstCommit.workerLanePageTiming,
      scheduleTerminalReceivedAtMs: 2_000
    }
  };
  const conflict = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [tier0Sample(0), firstCommit, conflictingCommit, tier0Sample(2)],
    warmupCommitCount: 0
  });
  assert.equal(conflict.status, 'fail');
  assert.equal(conflict.conflictingCommitSampleDetected, true);
  assert.ok(
    conflict.timingFailureReasons.includes('conflicting-commit-sample')
  );
});

test('strict pass requires a valid control-plane yield receipt', () => {
  const invalidYield = tier0Sample(2, {
    controlPlaneYieldReceipt: controlPlaneYieldReceipt({
      portsClosed: false
    })
  });
  const result = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [tier0Sample(0), tier0Sample(1), invalidYield],
    warmupCommitCount: 0
  });
  assert.equal(result.timingReady, true);
  assert.equal(result.controlPlaneYieldEvidenceReady, false);
  assert.equal(result.status, 'fail');
});

test('warmup excludes cost but cannot hide cadence resets or invalid authority evidence', () => {
  const counterReset = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [
      tier0Sample(0, {
        laneCompletedStepTotal: 640,
        laneSimTimeS: 0.64
      }),
      tier0Sample(1),
      tier0Sample(2)
    ],
    warmupCommitCount: 1,
    sampleIntervalCount: 1
  });
  assert.equal(counterReset.status, 'fail');
  assert.equal(counterReset.counterResetDetected, true);
  assert.equal(counterReset.progressCountersReady, false);

  const commitReset = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [
      tier0Sample(0, {
        workerLanePageTiming: workerLanePageTiming(1_200)
      }),
      tier0Sample(1),
      tier0Sample(2)
    ],
    warmupCommitCount: 1,
    sampleIntervalCount: 1
  });
  assert.equal(commitReset.status, 'fail');
  assert.equal(commitReset.authorityHistoryReady, false);
  assert.ok(
    commitReset.timingFailureReasons.includes(
      'authority-commit-history-invalid'
    )
  );

  const invalidWarmup = tier0Sample(0, {
    fullParticleReadbackFree: false,
    controlPlaneYieldReceipt: controlPlaneYieldReceipt({
      status: null,
      mode: null,
      mechanism: null
    }),
    executionRoute: {
      ...tier0Sample(0).executionRoute,
      fullParticleReadbackPerformed: true,
      fullParticleReadbackFree: false,
      mapAsyncCount: 1,
      readbackBytes: 64
    }
  });
  const invalidAuthority = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [invalidWarmup, tier0Sample(1), tier0Sample(2)],
    warmupCommitCount: 1,
    sampleIntervalCount: 1
  });
  assert.equal(invalidAuthority.timingReady, true);
  assert.equal(invalidAuthority.readbackFree, false);
  assert.equal(invalidAuthority.controlPlaneYieldEvidenceReady, false);
  assert.equal(invalidAuthority.status, 'fail');
});

test('normalization cannot reduce a requested measurement window and still pass', () => {
  const firstMeasured = tier0Sample(1);
  const result = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [
      tier0Sample(0),
      firstMeasured,
      { ...firstMeasured },
      tier0Sample(2)
    ],
    warmupCommitCount: 1,
    sampleIntervalCount: 2
  });
  assert.equal(result.duplicateSampleCount, 1);
  assert.equal(result.measuredIntervalCount, 1);
  assert.equal(result.requestedIntervalCountReady, false);
  assert.equal(result.status, 'fail');
  assert.ok(
    result.timingFailureReasons.includes(
      'insufficient-measured-authority-intervals'
    )
  );
});

test('schedule lineage and absolute progress values are strict and non-coercive', () => {
  const descendingSchedule = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [
      tier0Sample(0, { scheduleId: 'lane:fixture:schedule:2' }),
      tier0Sample(1, { scheduleId: 'lane:fixture:schedule:1' }),
      tier0Sample(2, { scheduleId: 'lane:fixture:schedule:3' })
    ],
    warmupCommitCount: 0
  });
  assert.equal(descendingSchedule.scheduleIdentityReady, false);
  assert.equal(descendingSchedule.status, 'fail');

  const wrongLanePrefix = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [
      tier0Sample(0),
      tier0Sample(1, { scheduleId: 'lane:other:schedule:1' }),
      tier0Sample(2)
    ],
    warmupCommitCount: 0
  });
  assert.equal(wrongLanePrefix.scheduleIdentityReady, false);
  assert.equal(wrongLanePrefix.status, 'fail');

  for (const malformedStepTotal of ['64', [64], -64]) {
    const malformedProgress = evaluateSphPresetThroughputSamples({
      presetId: 'water-realtime',
      samples: [
        tier0Sample(0),
        tier0Sample(1, {
          laneCompletedStepTotal: malformedStepTotal
        }),
        tier0Sample(2)
      ],
      warmupCommitCount: 0
    });
    assert.equal(malformedProgress.progressCountersReady, false);
    assert.equal(malformedProgress.status, 'fail');
  }
});

test('yield authority requires the complete route-coherent receipt shape', () => {
  const incompleteReceipt = {
    schema:
      ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA,
    scheduledYieldOpportunityCount: 0,
    yieldRequestCount: 0,
    completedYieldCount: 0,
    messageChannelCreated: false,
    messageChannelYieldCount: 0,
    timerFallbackYieldCount: 0,
    ownedPortCount: 0,
    closedPortCount: 0,
    portsClosed: true,
    totalWaitMs: 0
  };
  const result = evaluateSphPresetThroughputSamples({
    presetId: 'water-realtime',
    samples: [
      tier0Sample(0),
      tier0Sample(1),
      tier0Sample(2, { controlPlaneYieldReceipt: incompleteReceipt })
    ],
    warmupCommitCount: 0
  });
  assert.equal(result.controlPlaneYieldEvidenceReady, false);
  assert.equal(result.status, 'fail');
});
