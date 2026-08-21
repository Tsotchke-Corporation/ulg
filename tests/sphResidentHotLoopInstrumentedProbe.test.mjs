import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  RESIDENT_HOT_LOOP_EVENT_KIND,
  RESIDENT_HOT_LOOP_EVENT_NAME,
  RESIDENT_HOT_LOOP_REPORT_SCHEMA,
  assertResidentProbeArtifactPathsOutsideRepo,
  canonicalResidentHotLoopScenarioEvidence,
  canonicalResidentHotLoopScenarioPath,
  evaluateResidentHotLoopProbe,
  finalizeResidentHotLoopProbeReport,
  prewriteResidentHotLoopFailSentinel,
  residentHotLoopProbeIccEvent,
  writeResidentHotLoopProbeArtifacts
} from '../scripts/sph-resident-hot-loop-instrumented-probe.mjs';

const AUTHORITATIVE_STEP_STATUS =
  'schroeder-two-level-authoritative-step-executed';

function fingerprint(overrides = {}) {
  return {
    gitHead: 'a'.repeat(40),
    sourceFingerprint: 'b'.repeat(64),
    worktreeDirty: true,
    worktreeStatusHash: 'c'.repeat(64),
    trackedAndUntrackedFileCount: 417,
    ...overrides
  };
}

function telemetry(label, overrides = {}) {
  return {
    label,
    readbackTelemetrySchema:
      'peercompute.ulg.gpu-readback-telemetry.v0',
    readbackTelemetryScope: label,
    readbackTelemetryComplete: true,
    readbackTelemetryUnknownSources: [],
    mapAsyncCount: 0,
    readbackBytes: 0,
    hostQueueFenceCount: 0,
    observedMapAsyncCount: 0,
    observedReadbackBytes: 0,
    observedHostQueueFenceCount: 0,
    normalHotLoopReadbackFree: true,
    fullParticleReadbackPerformed: false,
    fullParticleReadbackFree: true,
    ...overrides
  };
}

function passingReport() {
  const exactFingerprint = fingerprint();
  return {
    schema: RESIDENT_HOT_LOOP_REPORT_SCHEMA,
    status: 'PASS',
    probeError: null,
    repoDir: '/worktree',
    worktreeIdentity: {
      before: { ...exactFingerprint },
      after: { ...exactFingerprint },
      current: { ...exactFingerprint }
    },
    evidence: {
      browser: {
        headless: true,
        ownership: 'playwright-launched-isolated-browser',
        launchArgs: [],
        consoleEntryCount: 0
      },
      configuration: {
        scenarioId: 'cesium-fluorine',
        mechanics: 'mlsmpm',
        schroederSimulation: true,
        twoLevelMechanics: true,
        mechanicsFieldPairV2: true,
        twoLevelAuthority: 'authoritative',
        twoLevelFineSubstepCount: 2,
        stageWorkersEnabled: false,
        residentWorkersEnabled: true,
        residentAutoEnabled: false,
        measuredExecutionOwner:
          'instrumented-page-direct-scene-refresh',
        gpuTimestampsEnabled: false,
        diagnosticReadbacksEnabled: false,
        renderRefreshPerformed: false,
        readbackMode: 'no-full-readback',
        compactSummaryMode: 'none',
        compactSummaryScope: 'particle-visual',
        canonicalScenarioIdentity: {
          complete: true
        },
        warmupStepCount: 2,
        measuredStepCount: 2,
        baseUrl: 'https://127.0.0.1:5174/',
        scenarioUrl: new URL(
          canonicalResidentHotLoopScenarioPath(),
          'https://127.0.0.1:5174/'
        ).toString()
      },
      instrumentation: {
        bufferMapWrapperInstalled: true,
        mappedRangeWrapperInstalled: true,
        queueFenceWrapperInstalled: true,
        deviceFaultWatcherInstalled: true,
        wrappersIntact: true,
        attachedDeviceCount: 1,
        resetOrdinal: 1,
        mapAsyncCount: 0,
        mapAsyncRequestedBytes: 0,
        getMappedRangeCount: 0,
        mappedByteLength: 0,
        queueFenceCount: 0,
        mapAsyncCallsites: [],
        mappedRangeCallsites: [],
        queueFenceCallsites: [],
        gpuErrors: [],
        deviceLosses: [],
        browserGpuIssues: [],
        pageErrors: []
      },
      execution: {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps.v0',
        status: 'resident-steps-executed',
        backend: 'webgpu',
        schroederSimulation: true,
        stepCount: 2,
        completedStepCount: 2,
        liveness: {
          continuedFromWarmup: true,
          continuationAvailable: true,
          stepBefore: 2,
          stepAfter: 4,
          authoritativeStepCount: 2,
          stepStatuses: [
            AUTHORITATIVE_STEP_STATUS,
            AUTHORITATIVE_STEP_STATUS
          ],
          finalStepStatus: AUTHORITATIVE_STEP_STATUS,
          twoLevelAuthority: 'authoritative',
          twoLevelFineSubstepCount: 2,
          authoritativeCommitVerified: true,
          mechanicsFieldPairV2Enabled: true,
          mechanicsFieldConstructionMode: 'paired-v2-shared-radix'
        },
        settlement: {
          backgroundSettlementConfirmed: true,
          spatialEpochReleaseSettlementComplete: true,
          spatialEpochReleaseSettlementCount: 2,
          hierarchyArtifactLedgerSettlementComplete: true,
          hierarchyArtifactLedgerSettlementCount: 2,
          successorRetirementComplete: true,
          transactionStates: [
            { state: 'released', releaseCount: 1 },
            { state: 'released', releaseCount: 1 }
          ],
          artifactLedgerSafe: [true, true]
        },
        runtimeReadbackTelemetry: {
          sourceCount: 4,
          sources: [
            telemetry('resident-execution'),
            telemetry('resident-final-step'),
            telemetry('schroeder-mechanics-step-0'),
            telemetry('schroeder-mechanics-step-1')
          ]
        }
      }
    }
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('canonical residency probe URL pins authoritative paired Cs/F and disables perturbing lanes', () => {
  const url = new URL(
    canonicalResidentHotLoopScenarioPath(),
    'https://probe.invalid'
  );
  const expected = {
    scenario: 'cesium-fluorine',
    mech: 'mlsmpm',
    renderer: 'native-webgpu',
    residentAuto: '0',
    residentWorkers: '1',
    residentStageWorkers: '0',
    residentQueueFence: '0',
    residentGpuTimestampProfile: '0',
    residentGpuTimestamp: '0',
    residentGpuTimestampFeature: '0',
    contactBinMetadataReadback: '0',
    reactionBinMetadataReadback: '0',
    anomalyRowReadback: '0',
    ss: '1',
    schroederTwoLevel: '1',
    schroederMechanicsFieldPairV2: '1',
    schroederTwoLevelAuthority: 'authoritative',
    schroederTwoLevelSubsteps: '2',
    schroederCrossLevelCoupling: '1'
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(url.searchParams.get(key), value, key);
  }
  assert.ok(url.searchParams.get('bodies'));
  assert.ok(Number(url.searchParams.get('schroederBaseGridSpacingM')) > 0);
  assert.equal(
    canonicalResidentHotLoopScenarioEvidence(url).complete,
    true
  );
  url.searchParams.set('residentStageWorkers', '1');
  assert.equal(
    canonicalResidentHotLoopScenarioEvidence(url).complete,
    false
  );
});

test('pure evaluator admits only complete fingerprint-bound observed evidence', () => {
  const report = passingReport();
  const evaluation = evaluateResidentHotLoopProbe(report);
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.status, 'PASS');
  assert.deepEqual(evaluation.failureReasons, []);

  const finalized = finalizeResidentHotLoopProbeReport({
    ...report,
    status: 'FAIL'
  });
  assert.equal(finalized.status, 'PASS');
  assert.equal(finalized.evaluation.passed, true);
});

test('pure evaluator fails closed for every native synchronization counter', async (t) => {
  const cases = [
    ['mapAsyncCount', 1, 'native-map-async-count-nonzero-or-unknown'],
    [
      'mapAsyncRequestedBytes',
      256,
      'native-map-async-requested-bytes-nonzero-or-unknown'
    ],
    [
      'getMappedRangeCount',
      1,
      'native-mapped-range-count-nonzero-or-unknown'
    ],
    [
      'mappedByteLength',
      256,
      'native-mapped-byte-length-nonzero-or-unknown'
    ],
    ['queueFenceCount', 1, 'native-queue-fence-count-nonzero-or-unknown']
  ];
  for (const [field, value, failure] of cases) {
    await t.test(field, () => {
      const report = passingReport();
      report.evidence.instrumentation[field] = value;
      const evaluation = evaluateResidentHotLoopProbe(report);
      assert.equal(evaluation.passed, false);
      assert.ok(evaluation.failureReasons.includes(failure));
    });
  }
});

test('pure evaluator rejects missing or replaced wrappers and device watchers', () => {
  const replaced = passingReport();
  replaced.evidence.instrumentation.wrappersIntact = false;
  assert.ok(
    evaluateResidentHotLoopProbe(replaced).failureReasons.includes(
      'native-wrapper-installation-or-integrity-incomplete'
    )
  );

  const noDevice = passingReport();
  noDevice.evidence.instrumentation.attachedDeviceCount = 0;
  assert.ok(
    evaluateResidentHotLoopProbe(noDevice).failureReasons.includes(
      'gpu-device-fault-watcher-incomplete'
    )
  );
});

test('pure evaluator requires isolated headless-browser evidence', () => {
  const report = passingReport();
  report.evidence.browser.headless = false;
  assert.ok(
    evaluateResidentHotLoopProbe(report).failureReasons.includes(
      'isolated-headless-browser-evidence-incomplete'
    )
  );
});

test('pure evaluator rejects GPU errors, device loss, browser GPU issues, and page errors', async (t) => {
  const fields = [
    ['gpuErrors', [{ name: 'GPUValidationError', message: 'bad' }]],
    ['deviceLosses', [{ reason: 'unknown', message: 'lost' }]],
    ['browserGpuIssues', [{ type: 'error', text: 'WebGPU out of memory' }]],
    ['pageErrors', ['page crashed']]
  ];
  for (const [field, value] of fields) {
    await t.test(field, () => {
      const report = passingReport();
      report.evidence.instrumentation[field] = value;
      assert.ok(
        evaluateResidentHotLoopProbe(report).failureReasons.includes(
          'gpu-error-device-loss-or-page-error-observed'
        )
      );
    });
  }
});

test('pure evaluator rejects incomplete and nonzero runtime readback telemetry', async (t) => {
  const mutations = [
    ['telemetry incomplete', (report) => {
      report.evidence.execution.runtimeReadbackTelemetry
        .sources[0].readbackTelemetryComplete = false;
    }],
    ['unknown source', (report) => {
      report.evidence.execution.runtimeReadbackTelemetry
        .sources[1].readbackTelemetryUnknownSources = ['missing-stage'];
    }],
    ['runtime map', (report) => {
      report.evidence.execution.runtimeReadbackTelemetry
        .sources[2].mapAsyncCount = 1;
    }],
    ['runtime bytes', (report) => {
      report.evidence.execution.runtimeReadbackTelemetry
        .sources[3].readbackBytes = 4;
    }],
    ['runtime fence', (report) => {
      report.evidence.execution.runtimeReadbackTelemetry
        .sources[0].hostQueueFenceCount = null;
    }],
    ['runtime claim false', (report) => {
      report.evidence.execution.runtimeReadbackTelemetry
        .sources[0].normalHotLoopReadbackFree = false;
    }],
    ['performed-readback claim missing', (report) => {
      delete report.evidence.execution.runtimeReadbackTelemetry
        .sources[0].fullParticleReadbackPerformed;
    }],
    ['native observation divergence', (report) => {
      report.evidence.instrumentation.queueFenceCount = 1;
    }]
  ];
  for (const [name, mutate] of mutations) {
    await t.test(name, () => {
      const report = passingReport();
      mutate(report);
      assert.ok(
        evaluateResidentHotLoopProbe(report).failureReasons.includes(
          'runtime-readback-telemetry-incomplete-or-nonzero'
        )
        || evaluateResidentHotLoopProbe(report).failureReasons.includes(
          'runtime-telemetry-diverged-from-native-observation'
        )
      );
    });
  }
});

test('pure evaluator rejects incomplete liveness, status, and lifecycle settlement', () => {
  const liveness = passingReport();
  liveness.evidence.execution.liveness.stepAfter = 3;
  liveness.evidence.execution.liveness.mechanicsFieldConstructionMode =
    'independent-v2';
  assert.ok(
    evaluateResidentHotLoopProbe(liveness).failureReasons.includes(
      'authoritative-two-level-liveness-incomplete'
    )
  );

  const statuses = passingReport();
  statuses.evidence.execution.liveness.stepStatuses[1] =
    'schroeder-same-level-step-executed';
  assert.ok(
    evaluateResidentHotLoopProbe(statuses).failureReasons.includes(
      'authoritative-step-status-coverage-incomplete'
    )
  );

  const settlement = passingReport();
  settlement.evidence.execution.settlement
    .spatialEpochReleaseSettlementComplete = false;
  settlement.evidence.execution.settlement.transactionStates[1].releaseCount =
    0;
  assert.ok(
    evaluateResidentHotLoopProbe(settlement).failureReasons.includes(
      'authoritative-lifecycle-settlement-incomplete'
    )
  );
});

test('pure evaluator rejects configured-copy evidence in place of exact measured configuration', () => {
  const report = passingReport();
  report.evidence.configuration.renderRefreshPerformed = null;
  report.evidence.configuration.diagnosticReadbacksEnabled = null;
  report.evidence.configuration.measuredExecutionOwner =
    'resident-worker-stage';
  assert.ok(
    evaluateResidentHotLoopProbe(report).failureReasons.includes(
      'canonical-measured-configuration-incomplete'
    )
  );
});

test('pure evaluator rejects probe exceptions even with otherwise complete evidence', () => {
  const report = passingReport();
  report.probeError = {
    message: 'browser observation failed after returning evidence'
  };
  assert.ok(
    evaluateResidentHotLoopProbe(report).failureReasons.includes(
      'probe-execution-error'
    )
  );
});

test('pure evaluator rejects before/after/current source drift and malformed fingerprints', () => {
  const drift = passingReport();
  drift.worktreeIdentity.after.sourceFingerprint = 'd'.repeat(64);
  assert.ok(
    evaluateResidentHotLoopProbe(drift).failureReasons.includes(
      'worktree-fingerprint-drift-or-incomplete'
    )
  );

  const malformed = passingReport();
  malformed.worktreeIdentity.current.worktreeStatusHash = null;
  assert.ok(
    evaluateResidentHotLoopProbe(malformed).failureReasons.includes(
      'worktree-fingerprint-drift-or-incomplete'
    )
  );
});

test('ICC event is exact and cannot be forged by stored PASS fields', () => {
  const passReport = finalizeResidentHotLoopProbeReport(passingReport());
  const passEvent = residentHotLoopProbeIccEvent(passReport, {
    reportPath: '/tmp/probe.json'
  });
  assert.equal(passEvent.kind, RESIDENT_HOT_LOOP_EVENT_KIND);
  assert.equal(passEvent.name, RESIDENT_HOT_LOOP_EVENT_NAME);
  assert.equal(passEvent.status, 'PASS');
  assert.equal(passEvent.value, 'PASS');
  assert.equal(passEvent.details.authentic, true);
  assert.equal(passEvent.details.fingerprintStable, true);
  assert.equal(
    passEvent.details.sourceFingerprint,
    fingerprint().sourceFingerprint
  );

  const forged = clone(passReport);
  forged.status = 'PASS';
  forged.evaluation = {
    passed: true,
    status: 'PASS',
    failureReasons: []
  };
  forged.evidence.instrumentation.queueFenceCount = 1;
  const failEvent = residentHotLoopProbeIccEvent(forged);
  assert.equal(failEvent.status, 'FAIL');
  assert.equal(failEvent.value, 'FAIL');
  assert.equal(failEvent.details.authentic, false);
});

test('artifact writer prewrites FAIL and overwrites stale PASS with recomputed truth', async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'ulg-resident-hot-loop-unit-')
  );
  const reportPath = path.join(directory, 'report.json');
  const tracePath = path.join(directory, 'report.icc.jsonl');
  try {
    await prewriteResidentHotLoopFailSentinel({
      reportPath,
      tracePath
    });
    const sentinelReport = JSON.parse(await readFile(reportPath, 'utf8'));
    const sentinelEvent = JSON.parse(
      (await readFile(tracePath, 'utf8')).trim()
    );
    assert.equal(sentinelReport.status, 'FAIL');
    assert.equal(sentinelReport.failClosedSentinel, true);
    assert.equal(sentinelEvent.status, 'FAIL');

    const pass = await writeResidentHotLoopProbeArtifacts({
      reportPath,
      tracePath,
      report: passingReport()
    });
    assert.equal(pass.report.status, 'PASS');
    assert.equal(pass.event.status, 'PASS');
    assert.equal(
      JSON.parse(await readFile(reportPath, 'utf8')).status,
      'PASS'
    );
    assert.equal(
      JSON.parse((await readFile(tracePath, 'utf8')).trim()).status,
      'PASS'
    );

    const broken = passingReport();
    broken.status = 'PASS';
    broken.evidence.instrumentation.mapAsyncCount = 1;
    const fail = await writeResidentHotLoopProbeArtifacts({
      reportPath,
      tracePath,
      report: broken
    });
    assert.equal(fail.report.status, 'FAIL');
    assert.equal(fail.event.status, 'FAIL');
    assert.equal(
      JSON.parse(await readFile(reportPath, 'utf8')).status,
      'FAIL'
    );
    assert.equal(
      JSON.parse((await readFile(tracePath, 'utf8')).trim()).status,
      'FAIL'
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('artifact-path guard keeps reports out of their own source fingerprint', () => {
  assert.deepEqual(
    assertResidentProbeArtifactPathsOutsideRepo({
      repoDir: '/worktree/repo',
      reportPath: '/tmp/report.json',
      tracePath: '/tmp/report.jsonl'
    }),
    {
      repoDir: '/worktree/repo',
      reportPath: '/tmp/report.json',
      tracePath: '/tmp/report.jsonl'
    }
  );
  assert.throws(
    () => assertResidentProbeArtifactPathsOutsideRepo({
      repoDir: '/worktree/repo',
      reportPath: '/worktree/repo/artifact.json',
      tracePath: '/tmp/report.jsonl'
    }),
    /must stay outside the source repository/
  );
});

test('browser observation closes only its owned isolated browser, including setup failures', async () => {
  const source = await readFile(
    new URL(
      '../scripts/sph-resident-hot-loop-instrumented-probe.mjs',
      import.meta.url
    ),
    'utf8'
  );
  const launchIndex = source.indexOf(
    'const browser = await chromium.launch(chromiumLaunchOptions());'
  );
  const tryIndex = source.indexOf('try {', launchIndex);
  const pageIndex = source.indexOf(
    'const page = await browser.newPage({',
    launchIndex
  );
  const finallyIndex = source.indexOf('} finally {', pageIndex);
  const closeIndex = source.indexOf(
    'await browser.close().catch(() => null);',
    finallyIndex
  );

  assert.ok(launchIndex >= 0);
  assert.ok(tryIndex > launchIndex);
  assert.ok(pageIndex > tryIndex);
  assert.ok(finallyIndex > pageIndex);
  assert.ok(closeIndex > finallyIndex);
  assert.doesNotMatch(
    source,
    /\b(?:pkill|killall)\b|process\.kill|SIG(?:KILL|TERM)/
  );
});

test('browser observation reconstructs authoritative paired options for the direct page interval', async () => {
  const source = await readFile(
    new URL(
      '../scripts/sph-resident-hot-loop-instrumented-probe.mjs',
      import.meta.url
    ),
    'utf8'
  );
  assert.match(
    source,
    /mounted\?\.__sphSimulationRuntimeAdmission\?\.ready === true[\s\S]*?!mounted\?\.__sphCpuClosureTask\?\.active/
  );
  assert.doesNotMatch(
    source.slice(
      source.indexOf('async function ensureOverlay'),
      source.indexOf('function installPageInstrumentation')
    ),
    /__sphDriver/
  );
  assert.match(
    source,
    /const schroederOptions =[\s\S]*?overlay\.__mlsMpmSchroederExecutionOptions[\s\S]*?config\.enabled === true[\s\S]*?schroederEnableMechanicsFieldPairV2:[\s\S]*?config\.enableMechanicsFieldPairV2/
  );
  assert.match(
    source,
    /measuredExecutionOwner:\s*MEASURED_EXECUTION_OWNER/
  );
});
