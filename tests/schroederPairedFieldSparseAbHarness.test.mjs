import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CURRENT_SERVER_PORT,
  DEFAULT_SCHEDULE,
  HISTORICAL_COMMIT,
  HISTORICAL_SERVER_PORT,
  VPN_SERVER_PORT,
  buildRunSchedule,
  canonicalizeContainmentParentHeader,
  canonicalizeFieldDescriptorWords,
  mechanicsFieldPairV2EnabledForSparseAbArm,
  parseArgs,
  projectStableOrderToPhysical,
  scenarioDefinitions,
  summarizeSamples,
  validateCrossAuthorityFieldHeaders,
  validateOptions,
  verifySameSourceContainmentDiagnostics
} from '../scripts/schroeder-paired-field-sparse-ab.mjs';

test('paired sparse A/B explicitly opts only the current arm into paired-v2', () => {
  assert.equal(mechanicsFieldPairV2EnabledForSparseAbArm('historical'), false);
  assert.equal(mechanicsFieldPairV2EnabledForSparseAbArm('current'), true);
  assert.equal(
    mechanicsFieldPairV2EnabledForSparseAbArm('current-independent'),
    false
  );
  assert.throws(
    () => mechanicsFieldPairV2EnabledForSparseAbArm('unknown'),
    /unknown paired sparse A\/B arm/
  );
});

test('paired sparse A/B defaults are dry-run, pinned, capped-command ready, and avoid VPN port 5174', () => {
  const options = parseArgs([]);
  assert.equal(options.dryRun, true);
  assert.equal(options.executeNative, false);
  assert.equal(options.checkServers, false);
  assert.equal(options.requireCgroupCap, true);
  assert.equal(options.includeCurrentIndependent, true);
  assert.equal(options.armTimeoutMs, 180_000);
  assert.equal(options.historicalCommit, HISTORICAL_COMMIT);
  assert.equal(options.historicalPort, HISTORICAL_SERVER_PORT);
  assert.equal(options.currentPort, CURRENT_SERVER_PORT);
  assert.notEqual(options.historicalPort, VPN_SERVER_PORT);
  assert.notEqual(options.currentPort, VPN_SERVER_PORT);
  assert.equal(validateOptions(options), true);
  assert.equal(
    parseArgs(['--dry-run', '--check-servers']).checkServers,
    true
  );

  assert.throws(
    () => validateOptions({
      ...options,
      historicalPort: VPN_SERVER_PORT
    }),
    /VPN server port 5174/
  );
  assert.throws(
    () => validateOptions({
      ...options,
      historicalCommit: `${HISTORICAL_COMMIT.slice(0, -1)}0`
    }),
    /historicalCommit must remain pinned/
  );
});

test('fair sparse and all-active scenarios preserve exact common A=P tiers', () => {
  const options = parseArgs([]);
  const scenarios = scenarioDefinitions(options);

  assert.deepEqual({
    physical: scenarios.sparse.physicalSourceCount,
    active: scenarios.sparse.activeSourceCount,
    physicalTier: scenarios.sparse.retainedPhysicalTier,
    activeTier: scenarios.sparse.retainedActiveTier,
    candidateCount: scenarios.sparse.candidateCount,
    candidateCapacity: scenarios.sparse.candidateCapacity
  }, {
    physical: 8_192,
    active: 4_500,
    physicalTier: 8_192,
    activeTier: 8_192,
    candidateCount: 121_500,
    candidateCapacity: 221_184
  });
  assert.equal(scenarios.sparse.activeSourceCapacity, null);
  assert.equal(scenarios.sparse.exactNearCellTreeEnabled, true);

  assert.deepEqual({
    physical: scenarios.allActive.physicalSourceCount,
    active: scenarios.allActive.activeSourceCount,
    physicalTier: scenarios.allActive.retainedPhysicalTier,
    activeTier: scenarios.allActive.retainedActiveTier,
    candidateCount: scenarios.allActive.candidateCount,
    candidateCapacity: scenarios.allActive.candidateCapacity,
    warmups: scenarios.allActive.warmups,
    samples: scenarios.allActive.samples
  }, {
    physical: 8_192,
    active: 8_192,
    physicalTier: 8_192,
    activeTier: 8_192,
    candidateCount: 221_184,
    candidateCapacity: 221_184,
    warmups: 2,
    samples: 5
  });
  assert.equal(scenarios.allActive.activeSourceCapacity, null);
  assert.equal(scenarios.allActive.exactNearCellTreeEnabled, true);
});

test('current reduced-A arm is separately labeled and excluded from historical fairness', () => {
  const options = parseArgs([]);
  const scenarios = scenarioDefinitions(options);
  const schedule = buildRunSchedule(options);
  const fairness = schedule.slice(0, DEFAULT_SCHEDULE.length);
  const attribution = schedule.at(-1);
  const containment = schedule.find(
    ({ arm }) => arm === 'current-independent'
  );

  assert.deepEqual(
    fairness.map(({ arm }) => arm),
    Array.from(DEFAULT_SCHEDULE)
  );
  assert.ok(fairness.every(({ scenarioIds }) => (
    scenarioIds.includes(scenarios.sparse.id)
      && scenarioIds.includes(scenarios.allActive.id)
  )));
  assert.deepEqual(attribution, {
    arm: 'current',
    blockIndex: 'attribution',
    scenarioIds: [scenarios.currentReducedActive.id]
  });
  assert.deepEqual(containment, {
    arm: 'current-independent',
    blockIndex: 'containment',
    scenarioIds: [scenarios.sparse.id, scenarios.allActive.id]
  });
  assert.equal(
    scenarios.currentReducedActive.comparisonClass,
    'current-only-attribution'
  );
  assert.equal(scenarios.currentReducedActive.physicalSourceCount, 8_192);
  assert.equal(scenarios.currentReducedActive.activeSourceCapacity, 4_500);
  assert.equal(scenarios.currentReducedActive.candidateCapacity, 121_500);
  assert.equal(
    scenarios.currentReducedActive.exactNearCellTreeEnabled,
    false
  );
});

test('same-source containment evidence requires exact paired and rollback routes plus semantic parity', () => {
  const options = parseArgs([]);
  const scenarios = scenarioDefinitions(options);
  const diagnostic = (paired) => ({
    physicalSourceCount: 8_192,
    physicalSourceCapacity: 8_192,
    activeSourceCapacity: 8_192,
    activeCount: 4_500,
    dormantCount: 3_692,
    overflowCount: 0,
    candidateCount: 121_500,
    activeMapHash: 'active-map',
    exactNearPresent: true,
    noReadback: true,
    pairPresent: paired,
    mechanicsFieldPairV2Enabled: paired,
    mechanicsFieldConstructionMode: paired
      ? 'paired-v2-shared-radix'
      : 'independent-v2',
    childEvidence: [0, 1].map(() => ({
      candidateSourceDomain: 'active-ordinal',
      canonicalDescriptorHash: 'descriptor',
      keyHash: 'keys',
      canonicalStableOrderHash: 'order',
      canonicalStableOrderCount: 121_500
    })),
    parentHeader: Array.from({ length: 80 }, (_, word) => word + 1)
  });
  const output = (scenario, paired) => ({
    scenario,
    diagnosticBefore: diagnostic(paired),
    diagnosticAfter: diagnostic(paired),
    samples: []
  });
  const results = [
    {
      arm: 'current',
      outputs: [
        output(scenarios.sparse, true),
        output(scenarios.allActive, true)
      ]
    },
    {
      arm: 'current-independent',
      outputs: [
        output(scenarios.sparse, false),
        output(scenarios.allActive, false)
      ]
    }
  ];

  const reorderedCurrent = structuredClone(results[0]);
  for (const scenarioOutput of reorderedCurrent.outputs) {
    for (const diagnosticKey of ['diagnosticBefore', 'diagnosticAfter']) {
      for (const word of [3, 6, 44, 45, 46, 47, 57, 63]) {
        scenarioOutput[diagnosticKey].parentHeader[word] += 6;
      }
    }
  }
  results.splice(1, 0, reorderedCurrent);

  assert.deepEqual(
    verifySameSourceContainmentDiagnostics(results, options),
    {
      schema: 'peercompute.ulg.paired-field-containment-evidence.v0',
      status: 'paired-v2-contained-same-source-parity-verified',
      defaultRoute: 'independent-v2',
      optInRoute: 'paired-v2-shared-radix',
      scenarioIds: [scenarios.sparse.id, scenarios.allActive.id],
      pairedRunCount: 4,
      defaultRouteContainmentVerified: true,
      explicitOptInRouteVerified: true,
      independentV2RollbackVerified: true,
      sameSourceSemanticParityVerified: true
    }
  );

  const tampered = structuredClone(results);
  tampered.find(({ arm }) => arm === 'current-independent')
    .outputs[0].diagnosticAfter.childEvidence[0].keyHash = 'different';
  assert.throws(
    () => verifySameSourceContainmentDiagnostics(tampered, options),
    /same-source child 0 keyHash mismatch/
  );

  const tamperedParent = structuredClone(results);
  tamperedParent.find(({ arm }) => arm === 'current-independent')
    .outputs[0].diagnosticAfter.parentHeader[34] += 1;
  assert.throws(
    () => verifySameSourceContainmentDiagnostics(tamperedParent, options),
    /same-source parent header mismatch/
  );
});

test('containment parent headers erase only generation-local ordinals', () => {
  const parentHeader = Array.from({ length: 80 }, (_, word) => word + 200);
  const reordered = [...parentHeader];
  for (const word of [3, 6, 44, 45, 46, 47, 57, 63]) {
    reordered[word] += 11;
  }
  assert.deepEqual(
    canonicalizeContainmentParentHeader(parentHeader),
    canonicalizeContainmentParentHeader(reordered)
  );

  reordered[34] += 1;
  assert.notDeepEqual(
    canonicalizeContainmentParentHeader(parentHeader),
    canonicalizeContainmentParentHeader(reordered)
  );

  const wrappedSemanticWord = [...parentHeader];
  wrappedSemanticWord[34] += 0x1_0000_0000;
  assert.notDeepEqual(
    canonicalizeContainmentParentHeader(parentHeader),
    canonicalizeContainmentParentHeader(wrappedSemanticWord),
    'semantic words must not alias through uint32 coercion'
  );
});

test('sample summaries use declared nearest-rank medians and p95 values', () => {
  const samples = Array.from({ length: 9 }, (_, index) => ({
    queueCompleteWallMs: index + 1,
    generationGpuMs: (index + 1) * 2,
    fieldGpuMs: (index + 1) * 3
  }));
  assert.deepEqual(summarizeSamples(samples), {
    sampleCount: 9,
    queueCompleteWallMedianMs: 5,
    queueCompleteWallP95Ms: 9,
    generationGpuMedianMs: 10,
    generationGpuP95Ms: 18,
    fieldGpuMedianMs: 15,
    fieldGpuP95Ms: 27
  });
});

test('inactive descriptor payloads canonicalize while admitted rows remain exact', () => {
  const historical = new Uint32Array(64);
  historical.set([7, 11, 13, 1, 17, 19], 0);
  historical.set([0, 0, 0, 0, 0, 0], 32);
  const current = historical.slice();
  current.fill(0xffff_ffff, 36, 63);

  assert.deepEqual(
    canonicalizeFieldDescriptorWords(historical),
    canonicalizeFieldDescriptorWords(current)
  );

  const changedAdmitted = current.slice();
  changedAdmitted[4] = 23;
  assert.notDeepEqual(
    canonicalizeFieldDescriptorWords(historical),
    canonicalizeFieldDescriptorWords(changedAdmitted)
  );
  const invalidStatus = current.slice();
  invalidStatus[35] = 2;
  assert.throws(
    () => canonicalizeFieldDescriptorWords(invalidStatus),
    /invalid status/
  );
  assert.throws(
    () => canonicalizeFieldDescriptorWords(new Uint32Array(31)),
    /complete 32-word rows/
  );
});

test('stable order projects physical and active-ordinal domains to one exact physical identity', () => {
  const common = {
    physicalSourceCount: 4,
    activePhysicalSources: [0, 2],
    stencilSize: 2
  };
  const historical = projectStableOrderToPhysical({
    ...common,
    sourceDomain: 'physical',
    orderWords: [0, 4, 1, 5, 2, 3, 6, 7]
  });
  const current = projectStableOrderToPhysical({
    ...common,
    sourceDomain: 'active-ordinal',
    orderWords: [0, 2, 1, 3]
  });
  assert.deepEqual(historical, Uint32Array.from([0, 4, 1, 5]));
  assert.deepEqual(current, historical);

  assert.throws(
    () => projectStableOrderToPhysical({
      ...common,
      sourceDomain: 'active-ordinal',
      orderWords: [0, 2, 1, 4]
    }),
    /out of range/
  );
  assert.throws(
    () => projectStableOrderToPhysical({
      ...common,
      sourceDomain: 'active-ordinal',
      orderWords: [0, 2, 1, 1]
    }),
    /duplicate/
  );
  assert.throws(
    () => projectStableOrderToPhysical({
      ...common,
      activePhysicalSources: [2, 0],
      sourceDomain: 'active-ordinal',
      orderWords: [0, 2, 1, 3]
    }),
    /unique, ascending/
  );
});

test('field headers admit only exact P*27 versus A*27 domain differences', () => {
  const historical = new Uint32Array(64);
  const current = new Uint32Array(64);
  historical[0] = current[0] = 0x5346_4635;
  historical[16] = current[16] = 8;
  historical[33] = historical[51] = 8 * 27;
  current[33] = current[51] = 5 * 27;
  assert.equal(validateCrossAuthorityFieldHeaders({
    historicalHeader: historical,
    currentHeader: current,
    physicalSourceCount: 8,
    activeSourceCount: 5
  }), true);

  const wrongDomain = current.slice();
  wrongDomain[51] += 1;
  assert.throws(
    () => validateCrossAuthorityFieldHeaders({
      historicalHeader: historical,
      currentHeader: wrongDomain,
      physicalSourceCount: 8,
      activeSourceCount: 5
    }),
    /does not authenticate/
  );
  const semanticMismatch = current.slice();
  semanticMismatch[34] = 1;
  assert.throws(
    () => validateCrossAuthorityFieldHeaders({
      historicalHeader: historical,
      currentHeader: semanticMismatch,
      physicalSourceCount: 8,
      activeSourceCount: 5
    }),
    /semantic mismatch/
  );
  assert.throws(
    () => validateCrossAuthorityFieldHeaders({
      historicalHeader: historical.subarray(0, 63),
      currentHeader: current,
      physicalSourceCount: 8,
      activeSourceCount: 5
    }),
    /exactly 64 words/
  );
});
