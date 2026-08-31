import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateSphPresetThroughputSamples,
  expectedSphPresetExecutionRoute
} from '../scripts/sph-preset-throughput-matrix.mjs';

function tier0Sample(index, overrides = {}) {
  return {
    capturedAtMs: index * 64,
    laneSimTimeS: index * 0.064,
    laneCompletedStepTotal: index * 64,
    scheduleId: `schedule:${index}`,
    scheduleFirstStepStartedAtMs: index * 64,
    resultAssembledAtMs: index * 64 + 48,
    lastResidentPostComputeMs: 16,
    fullParticleReadbackFree: true,
    workerLaneContinuationReady: true,
    committedPresentationReady: true,
    runtimeError: null,
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

test('configured preset route expectations cover both canonical and Tier-0 arms', () => {
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
  assert.equal(result.realTimeFactor, 1);
  assert.equal(result.physicsStepsPerSecond, 1_000);
  assert.equal(result.routeMatched, true);
  assert.equal(result.terminalAuthorityReady, true);
  assert.equal(result.readbackFree, true);
  assert.equal(result.meanWorkerTurnaroundMs, 16);
  assert.equal(result.meanPostComputeMs, 16);
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
