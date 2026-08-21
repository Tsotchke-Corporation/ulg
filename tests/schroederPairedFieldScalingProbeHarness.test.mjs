import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CURRENT_SCALING_SERVER_PORT,
  DEFAULT_ACTIVE_SOURCE_COUNTS,
  DEFAULT_PHYSICAL_SOURCE_COUNT,
  buildScalingAnalysis,
  canonicalizeDiagnosticEvidence,
  fitLinearScaling,
  parseArgs,
  scenarioDefinitions,
  summarizeSamples,
  validateOptions
} from '../scripts/schroeder-paired-field-scaling-probe.mjs';

test('paired-field scaling probe defaults are current-only, dry, capped, and avoid VPN port 5174', () => {
  const options = parseArgs([]);
  assert.equal(options.dryRun, true);
  assert.equal(options.executeNative, false);
  assert.equal(options.requireCgroupCap, true);
  assert.equal(options.serverPort, CURRENT_SCALING_SERVER_PORT);
  assert.notEqual(options.serverPort, 5174);
  assert.equal(options.physicalSourceCount, DEFAULT_PHYSICAL_SOURCE_COUNT);
  assert.deepEqual(
    options.activeSourceCounts,
    DEFAULT_ACTIVE_SOURCE_COUNTS
  );
  assert.equal(validateOptions(options), true);
  assert.throws(
    () => validateOptions({ ...options, serverPort: 5174 }),
    /VPN server port 5174/
  );
  assert.throws(
    () => parseArgs(['--execute-native', '--dry-run']),
    /mutually exclusive/
  );
});

test('scaling scenarios isolate actual A across five tiers with fixed P, retained capacity, and candidate capacity', () => {
  const options = parseArgs([]);
  const scenarios = scenarioDefinitions(options);
  assert.equal(scenarios.length, 5);
  assert.deepEqual(
    scenarios.map(({ activeSourceCount }) => activeSourceCount),
    [512, 1_024, 2_048, 4_096, 8_192]
  );
  for (const scenario of scenarios) {
    assert.equal(scenario.physicalSourceCount, 8_192);
    assert.equal(scenario.activeSourceCapacity, 8_192);
    assert.equal(scenario.candidateCount, scenario.activeSourceCount * 27);
    assert.equal(scenario.candidateCapacity, 8_192 * 27);
    assert.equal(scenario.exactNearCellTreeEnabled, false);
    assert.equal(scenario.comparisonClass, 'current-only-attribution');
  }
  assert.throws(
    () => parseArgs(['--active-source-counts', '1,2,3']),
    /at least four/
  );
});

test('sample summaries retain nearest-rank medians and p95 for wall, generation, field, and partition spans', () => {
  const samples = Array.from({ length: 7 }, (_, index) => ({
    queueCompleteWallMs: index + 1,
    generationGpuMs: (index + 1) * 2,
    fieldGpuMs: (index + 1) * 3,
    partitionGpuMs: (index + 1) * 4
  }));
  assert.deepEqual(summarizeSamples(samples), {
    sampleCount: 7,
    queueCompleteWallMsMedian: 4,
    queueCompleteWallMsP95: 7,
    generationGpuMsMedian: 8,
    generationGpuMsP95: 14,
    fieldGpuMsMedian: 12,
    fieldGpuMsP95: 21,
    partitionGpuMsMedian: 16,
    partitionGpuMsP95: 28
  });
});

test('scaling analysis reports exact slope, normalized candidate cost, and linear exponent without imposing a threshold', () => {
  const fit = fitLinearScaling([
    { x: 1, y: 3 },
    { x: 2, y: 5 },
    { x: 4, y: 9 },
    { x: 8, y: 17 }
  ]);
  assert.equal(fit.slope, 2);
  assert.equal(fit.intercept, 1);
  assert.equal(fit.rSquared, 1);

  const outputs = [1, 2, 4, 8].map((activeSourceCount) => ({
    scenario: {
      activeSourceCount,
      candidateCount: activeSourceCount * 27
    },
    summary: {
      queueCompleteWallMsMedian: activeSourceCount * 4,
      generationGpuMsMedian: activeSourceCount * 3,
      fieldGpuMsMedian: activeSourceCount * 2,
      partitionGpuMsMedian: activeSourceCount
    }
  }));
  const analysis = buildScalingAnalysis(outputs);
  assert.equal(
    analysis.interpretation,
    'descriptive-current-only-scaling-evidence-no-fixed-performance-threshold'
  );
  assert.equal(analysis.metrics.partitionGpuMs.slopeMsPerActiveSource, 1);
  assert.ok(
    Math.abs(analysis.metrics.partitionGpuMs.logLogExponent - 1)
      < 1e-12
  );
  assert.ok(
    Math.abs(
      analysis.metrics.partitionGpuMs.normalized[0].medianNsPerCandidate
        - 1e6 / 27
    ) < 1e-9
  );
});

test('exact diagnostic comparison canonicalizes only generation-local field and parent ordinals', () => {
  const fieldHeader = Array.from({ length: 64 }, (_, word) => word + 100);
  const parentHeader = Array.from({ length: 80 }, (_, word) => word + 200);
  const before = {
    activeCount: 512,
    dormantCount: 7_680,
    overflowCount: 0,
    candidateCount: 13_824,
    activeMapHash: 'semantic-forward-and-reverse-map',
    childEvidence: [{
      header: fieldHeader,
      descriptorHash: 'descriptor',
      keyHash: 'key',
      stableOrderHash: 'order'
    }],
    parentHeader
  };
  const after = structuredClone(before);
  for (const word of [3, 6, 38, 50]) {
    after.childEvidence[0].header[word] += 11;
  }
  for (const word of [3, 6, 44, 45, 46, 47, 57, 63]) {
    after.parentHeader[word] += 11;
  }
  assert.deepEqual(
    canonicalizeDiagnosticEvidence(before),
    canonicalizeDiagnosticEvidence(after)
  );

  after.childEvidence[0].header[34] += 1;
  assert.notDeepEqual(
    canonicalizeDiagnosticEvidence(before),
    canonicalizeDiagnosticEvidence(after),
    'field count remains exact semantic evidence'
  );
});
