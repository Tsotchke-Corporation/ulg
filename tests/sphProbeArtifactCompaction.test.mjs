import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  compactVisualProbeMetric,
  normalizeProbeArtifactDetailMode,
  refreshCompactedVisualSettlementEvidence,
  releaseCompactedVisualSettlementReplayState
} from '../scripts/sph-probe-artifact-compaction.mjs';
import {
  createGpuReadbackTelemetry,
  normalizePageVisibleGpuReadbackTelemetry
} from '../src/runtime/sph/sphGpuReadbackTelemetry.js';

const PAGE_VISIBLE_BREAKDOWN_COUNT_FIELDS = Object.freeze([
  'observedMapAsyncCount',
  'observedReadbackBytes',
  'observedHostQueueFenceCount',
  'finalDiagnosticMapAsyncCount',
  'finalDiagnosticReadbackBytes',
  'deferredCleanupHostQueueFenceCount',
  'awaitedBackpressureHostQueueFenceCount',
  'unclassifiedMapAsyncCount',
  'unclassifiedReadbackBytes',
  'unclassifiedHostQueueFenceCount'
]);

function zeroPageVisibleBreakdownRow(source) {
  return {
    source,
    ...Object.fromEntries(
      PAGE_VISIBLE_BREAKDOWN_COUNT_FIELDS.map((field) => [field, 0])
    )
  };
}

function extractedArrowFunctionExpressions(source, marker) {
  const expressions = [];
  let cursor = 0;
  while ((cursor = source.indexOf(marker, cursor)) !== -1) {
    const expressionStart = cursor + marker.length;
    const bodyStart = source.indexOf('{', expressionStart);
    let depth = 0;
    let bodyEnd = -1;
    for (let index = bodyStart; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          bodyEnd = index + 1;
          break;
        }
      }
    }
    assert.notEqual(bodyEnd, -1, `${marker} body must be balanced`);
    expressions.push(source.slice(expressionStart, bodyEnd));
    cursor = bodyEnd;
  }
  return expressions;
}

function extractedProbeReadbackSerializers(source) {
  const expressions = extractedArrowFunctionExpressions(
    source,
    'const compactPageVisibleReadbackTelemetry = '
  );
  return {
    expressions,
    serializers: expressions.map(
      (expression) => Function(`return (${expression});`)()
    )
  };
}

function extractedProbeReadbackComposers(source, serializers) {
  const expressions = extractedArrowFunctionExpressions(
    source,
    'const composePageVisibleReadbackTelemetry = '
  );
  return {
    expressions,
    composers: expressions.map(
      (expression, index) => Function(
        'compactPageVisibleReadbackTelemetry',
        `return (${expression});`
      )(serializers[index])
    )
  };
}

test('visual probe compaction drops replay histories but retains exact CSS evidence', () => {
  const cssSubmission = {
    schema: 'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2',
    status: 'eighteen-pass-central-bond-surface-stress-submitted-unverified',
    requested: true,
    submitted: true
  };
  const readbackTelemetry = createGpuReadbackTelemetry({
    scope: 'final-presentation-summary',
    mapAsyncCount: 1,
    readbackBytes: 256,
    hostQueueFenceCount: 2,
    finalDiagnosticMapAsyncCount: 1,
    finalDiagnosticReadbackBytes: 256,
    deferredCleanupHostQueueFenceCount: 2
  });
  const metric = {
    batchIndex: 4,
    residentSteps: {
      completedStepCount: 2,
      ...readbackTelemetry,
      phaseVolumeSurfaceStressSubmissionCount: 2,
      phaseVolumeSurfaceStressSubmissionEvidenceComplete: true,
      phaseVolumeSurfaceStressSubmissions: [cssSubmission, cssSubmission],
      schroederSpatialEpochReleaseSettlementCount: 2,
      schroederSpatialEpochReleaseSettlementComplete: true,
      schroederHierarchyArtifactLedgerSettlementCount: 2,
      schroederHierarchyArtifactLedgerSettlementComplete: true,
      schroederSpatialEpochTransactionSummaries: [{ step: 1 }, { step: 2 }],
      schroederSpatialEpochGenerationSummaries: [{ step: 1 }, { step: 2 }],
      schroederHierarchyArtifactLedgerSummaries: [{ step: 1 }, { step: 2 }]
    }
  };

  const compact = compactVisualProbeMetric(metric);

  assert.notStrictEqual(compact, metric);
  assert.deepEqual(
    compact.residentSteps.phaseVolumeSurfaceStressSubmissions,
    metric.residentSteps.phaseVolumeSurfaceStressSubmissions
  );
  assert.equal(compact.residentSteps.schroederSpatialEpochTransactionSummaries, undefined);
  assert.equal(compact.residentSteps.schroederSpatialEpochGenerationSummaries, undefined);
  assert.equal(compact.residentSteps.schroederHierarchyArtifactLedgerSummaries, undefined);
  assert.deepEqual(
    compact.residentSteps.artifactCompaction.omittedArrayItemCounts,
    {
      schroederSpatialEpochTransactionSummaries: 2,
      schroederSpatialEpochGenerationSummaries: 2,
      schroederHierarchyArtifactLedgerSummaries: 2
    }
  );
  assert.equal(
    compact.residentSteps.artifactCompaction.retainedSurfaceStressSubmissionCount,
    2
  );
  assert.equal(compact.residentSteps.finalDiagnosticMapAsyncCount, 1);
  assert.equal(compact.residentSteps.finalDiagnosticReadbackBytes, 256);
  assert.equal(compact.residentSteps.deferredCleanupHostQueueFenceCount, 2);
  assert.equal(compact.residentSteps.awaitedBackpressureHostQueueFenceCount, 0);
  assert.equal(compact.residentSteps.unclassifiedMapAsyncCount, 0);
  assert.equal(compact.residentSteps.unclassifiedReadbackBytes, 0);
  assert.equal(compact.residentSteps.unclassifiedHostQueueFenceCount, 0);
  assert.equal(compact.residentSteps.readbackTelemetryComplete, true);
  assert.equal(compact.residentSteps.normalHotLoopReadbackFree, false);
  assert.equal(compact.residentSteps.productionHotLoopHostDependencyFree, true);
  assert.deepEqual(
    compact.residentSteps.readbackTelemetrySourceBreakdown,
    metric.residentSteps.readbackTelemetrySourceBreakdown
  );
  assert.equal(metric.residentSteps.schroederSpatialEpochTransactionSummaries.length, 2);
});

test('visual settlement refresh preserves aggregates without restoring replay histories', () => {
  const cssSubmission = {
    schema: 'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2',
    status: 'eighteen-pass-central-bond-surface-stress-submitted-unverified',
    requested: true,
    submitted: true
  };
  const compact = compactVisualProbeMetric({
    residentSteps: {
      phaseVolumeSurfaceStressSubmissions: [cssSubmission, cssSubmission],
      schroederSpatialEpochTransactionSummaries: [{ state: 'pending' }],
      schroederSpatialEpochGenerationSummaries: [{ generation: 1 }],
      schroederHierarchyArtifactLedgerSummaries: [{ state: 'pending' }],
      schroederSpatialEpochReleaseSettlementCount: 0,
      schroederSpatialEpochReleaseSettlementComplete: false,
      schroederHierarchyArtifactLedgerSettlementCount: 0,
      schroederHierarchyArtifactLedgerSettlementComplete: false
    }
  });
  const residentSteps = compact.residentSteps;
  const settledExecution = {
    schroederSpatialEpochTransactionSummaries: [
      { state: 'released', replayPayload: 'must-not-be-retained' },
      { state: 'released', replayPayload: 'must-not-be-retained' }
    ],
    schroederSpatialEpochReleaseSettlementCount: 2,
    schroederSpatialEpochReleaseSettlementComplete: true,
    schroederHierarchyArtifactLedgerSummaries: [
      { state: 'retired', replayPayload: 'must-not-be-retained' },
      { state: 'retired', replayPayload: 'must-not-be-retained' }
    ],
    schroederHierarchyArtifactLedgerSettlementCount: 2,
    schroederHierarchyArtifactLedgerSettlementComplete: true
  };

  assert.strictEqual(
    refreshCompactedVisualSettlementEvidence(residentSteps, settledExecution),
    residentSteps
  );
  assert.equal(residentSteps.schroederSpatialEpochTransactionSummaries, undefined);
  assert.equal(residentSteps.schroederSpatialEpochGenerationSummaries, undefined);
  assert.equal(residentSteps.schroederHierarchyArtifactLedgerSummaries, undefined);
  assert.equal(residentSteps.schroederSpatialEpochReleaseSettlementCount, 2);
  assert.equal(residentSteps.schroederSpatialEpochReleaseSettlementComplete, true);
  assert.equal(residentSteps.schroederHierarchyArtifactLedgerSettlementCount, 2);
  assert.equal(residentSteps.schroederHierarchyArtifactLedgerSettlementComplete, true);
  assert.deepEqual(
    residentSteps.artifactCompaction.omittedArrayItemCounts,
    {
      schroederSpatialEpochTransactionSummaries: 2,
      schroederSpatialEpochGenerationSummaries: 1,
      schroederHierarchyArtifactLedgerSummaries: 2
    }
  );
  assert.deepEqual(
    residentSteps.phaseVolumeSurfaceStressSubmissions,
    [cssSubmission, cssSubmission]
  );
  assert.doesNotMatch(JSON.stringify(compact), /must-not-be-retained/);
});

test('visual settlement refresh fails closed without exact compaction metadata', () => {
  assert.throws(
    () => refreshCompactedVisualSettlementEvidence({}, {}),
    /requires exact visual-compaction metadata/
  );
  assert.throws(
    () => refreshCompactedVisualSettlementEvidence(null, {}),
    /requires resident steps and a settled execution/
  );
});

test('settled visual replay state releases arrays and diagnostic promises but retains continuation cleanup state', () => {
  const finalStep = { status: 'final-step' };
  const nextParticleUploads = { status: 'continuation-ready' };
  const queueOrderedFinalConsumer = { status: 'consumer-submitted' };
  const execution = {
    schroederSpatialEpochReleaseSettlementComplete: true,
    schroederHierarchyArtifactLedgerSettlementComplete: true,
    schroederSuccessorSourceFamilyRetirementScheduledCount: 2,
    schroederSuccessorSourceFamilyRetirementComplete: true,
    schroederSameLevelMechanicsSummaries: [{}, {}],
    schroederSpatialEpochTransactionSummaries: [{}, {}],
    schroederHierarchyArtifactLedgerSummaries: [{}, {}],
    stepSummaries: [{}, {}],
    schroederUploadProvenance: [{}, {}],
    schroederSuccessorSourceFamilyRetirementReceipts: [{}, {}],
    finalStep,
    nextParticleUploads
  };
  Object.defineProperties(execution, {
    queueOrderedPriorResidentExecutionFinalConsumer: {
      value: queueOrderedFinalConsumer,
      enumerable: false
    },
    schroederSuccessorSourceFamilyRetirementPromise: {
      value: Promise.resolve([]),
      enumerable: false,
      configurable: true
    },
    schroederSpatialEpochSettlementPromise: {
      value: Promise.resolve([]),
      enumerable: false,
      configurable: true
    },
    schroederBackgroundSettlementPromise: {
      value: Promise.resolve(true),
      enumerable: false,
      configurable: true
    }
  });

  const evidence = releaseCompactedVisualSettlementReplayState(execution);

  assert.equal(evidence.status, 'settled-replay-state-released');
  assert.deepEqual(evidence.releasedArrayItemCounts, {
    schroederSameLevelMechanicsSummaries: 2,
    schroederSpatialEpochTransactionSummaries: 2,
    schroederHierarchyArtifactLedgerSummaries: 2,
    stepSummaries: 2,
    schroederUploadProvenance: 2,
    schroederSuccessorSourceFamilyRetirementReceipts: 2
  });
  assert.deepEqual(evidence.releasedPromiseFields, [
    'schroederSuccessorSourceFamilyRetirementPromise',
    'schroederSpatialEpochSettlementPromise',
    'schroederBackgroundSettlementPromise'
  ]);
  assert.equal(evidence.queueOrderedCleanupCapabilityAvailable, true);
  assert.equal(evidence.queueOrderedCleanupCapabilityRetained, true);
  assert.equal(execution.finalStep, finalStep);
  assert.equal(execution.nextParticleUploads, nextParticleUploads);
  assert.equal(
    execution.queueOrderedPriorResidentExecutionFinalConsumer,
    queueOrderedFinalConsumer
  );
  assert.equal('stepSummaries' in execution, false);
  assert.equal('schroederBackgroundSettlementPromise' in execution, false);
});

test('settled visual replay release distinguishes an absent cleanup capability from a dropped one', () => {
  const execution = {
    schroederSpatialEpochReleaseSettlementComplete: true,
    schroederHierarchyArtifactLedgerSettlementComplete: true,
    schroederSuccessorSourceFamilyRetirementScheduledCount: 0,
    finalStep: {},
    nextParticleUploads: {}
  };

  const evidence = releaseCompactedVisualSettlementReplayState(execution);

  assert.equal(evidence.queueOrderedCleanupCapabilityAvailable, false);
  assert.equal(evidence.queueOrderedCleanupCapabilityRetained, true);
});

test('settled visual replay release fails closed before settlement or for non-releasable promises', () => {
  assert.throws(
    () => releaseCompactedVisualSettlementReplayState({
      schroederSpatialEpochReleaseSettlementComplete: false,
      schroederHierarchyArtifactLedgerSettlementComplete: true
    }),
    /requires complete owner settlement/
  );

  const execution = {
    schroederSpatialEpochReleaseSettlementComplete: true,
    schroederHierarchyArtifactLedgerSettlementComplete: true,
    schroederSuccessorSourceFamilyRetirementScheduledCount: 0,
    stepSummaries: [{}]
  };
  Object.defineProperty(execution, 'schroederBackgroundSettlementPromise', {
    value: Promise.resolve(true),
    enumerable: false
  });
  assert.throws(
    () => releaseCompactedVisualSettlementReplayState(execution),
    /is not releasable/
  );
  assert.equal(execution.stepSummaries.length, 1);
});

test('both probe serializers gate positive residency claims and counts on complete telemetry', () => {
  const source = readFileSync(
    new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
    'utf8'
  );
  const { expressions, serializers } =
    extractedProbeReadbackSerializers(source);
  assert.equal(serializers.length, 2);
  assert.equal(
    expressions[0],
    expressions[1],
    'the mounted and direct-resident serializers must remain structurally identical'
  );
  assert.equal(
    Buffer.byteLength(expressions[0], 'utf8'),
    9632,
    'the audited embedded serializer remains on its exact whitelisted surface'
  );
  assert.equal(
    createHash('sha256').update(expressions[0]).digest('hex'),
    'a0f93741889533b0f1f571fcbc9d77b249f4082e578bf0497a94dcc2e00cf529',
    'the audited serializer whitelist hash must remain unchanged'
  );
  assert.equal(
    [...source.matchAll(/\.\.\.readbackTelemetry,/g)].length,
    2,
    'both resident-step serializers publish only the sanitized telemetry record'
  );

  const valid = createGpuReadbackTelemetry({
    scope: 'probe-page-visible-zero'
  });
  const withoutClaims = { ...valid };
  delete withoutClaims.normalHotLoopReadbackFree;
  delete withoutClaims.productionHotLoopHostDependencyFree;
  const missingCount = { ...valid };
  delete missingCount.hostQueueFenceCount;
  const missingBreakdown = { ...valid };
  delete missingBreakdown.readbackTelemetrySourceBreakdown;
  const nonconservingRow = createGpuReadbackTelemetry({
    scope: 'probe-forged-row',
    mapAsyncCount: 1
  }).readbackTelemetrySourceBreakdown[0];
  const taintedBreakdownSource = createGpuReadbackTelemetry({
    scope: 'probe-tainted-source-row',
    mapAsyncCount: 1,
    readbackBytes: 64,
    hostQueueFenceCount: 1,
    finalDiagnosticMapAsyncCount: 1,
    finalDiagnosticReadbackBytes: 64,
    deferredCleanupHostQueueFenceCount: 1
  });
  const taintedRow = taintedBreakdownSource
    .readbackTelemetrySourceBreakdown[0];
  const telemetryWithTaintedRow = {
    ...taintedBreakdownSource,
    readbackTelemetrySourceBreakdown: [{
      ...taintedRow,
      source: ` ${taintedRow.source} `,
      mapAsyncCount: 999,
      readbackTelemetryComplete: false,
      normalHotLoopReadbackFree: true,
      productionHotLoopHostDependencyFree: false,
      untrustedArtifactField: 'must-not-escape'
    }]
  };
  const duplicateSourceRows = {
    ...valid,
    readbackTelemetrySourceBreakdown: [
      zeroPageVisibleBreakdownRow('duplicate-source'),
      zeroPageVisibleBreakdownRow(' duplicate-source ')
    ]
  };
  const legacyExactZero = {
    readbackTelemetrySchema:
      'peercompute.ulg.gpu-readback-telemetry.v1',
    readbackTelemetryComplete: true,
    readbackTelemetryUnknownSources: [],
    observedMapAsyncCount: 0,
    observedReadbackBytes: 0,
    observedHostQueueFenceCount: 0,
    normalHotLoopReadbackFree: true
  };
  const cases = [
    ['valid complete', valid],
    ['valid derived claims', withoutClaims],
    ['legacy exact-zero', legacyExactZero],
    ['allowlisted tainted source row', telemetryWithTaintedRow],
    ['canonically duplicate source rows', duplicateSourceRows],
    ['missing completeness', {
      ...valid,
      readbackTelemetryComplete: undefined
    }],
    ['explicit incomplete failure', {
      ...valid,
      readbackTelemetryComplete: false,
      normalHotLoopReadbackFree: false,
      productionHotLoopHostDependencyFree: false
    }],
    ['coercible count', { ...valid, observedMapAsyncCount: '0' }],
    ['negative count', { ...valid, observedReadbackBytes: -1 }],
    ['missing count', missingCount],
    ['missing breakdown', missingBreakdown],
    ['unknown source', {
      ...valid,
      readbackTelemetryUnknownSources: ['unverified-stage']
    }],
    ['nonconserving breakdown', {
      ...valid,
      readbackTelemetrySourceBreakdown: [nonconservingRow]
    }],
    ['contradictory strict claim', {
      ...valid,
      normalHotLoopReadbackFree: false
    }],
    ['contradictory production claim', {
      ...valid,
      productionHotLoopHostDependencyFree: false
    }]
  ];

  for (const [name, telemetry] of cases) {
    const expected = normalizePageVisibleGpuReadbackTelemetry(telemetry);
    for (const [index, serializer] of serializers.entries()) {
      assert.deepEqual(
        serializer(telemetry),
        expected,
        `${name}: serializer ${index + 1}`
      );
    }
  }

  for (const [index, serializer] of serializers.entries()) {
    const artifact = serializer(telemetryWithTaintedRow);
    assert.equal(artifact.readbackTelemetryComplete, true);
    assert.equal(
      artifact.readbackTelemetrySourceBreakdown[0].source,
      taintedRow.source
    );
    assert.deepEqual(
      Object.keys(artifact.readbackTelemetrySourceBreakdown[0]),
      ['source', ...PAGE_VISIBLE_BREAKDOWN_COUNT_FIELDS],
      `serializer ${index + 1}: artifact row must contain only canonical fields`
    );
    assert.equal(
      artifact.readbackTelemetrySourceBreakdown[0].mapAsyncCount,
      undefined
    );
    assert.equal(
      artifact.readbackTelemetrySourceBreakdown[0]
        .normalHotLoopReadbackFree,
      undefined
    );
    assert.equal(
      artifact.readbackTelemetrySourceBreakdown[0]
        .productionHotLoopHostDependencyFree,
      undefined
    );
    assert.equal(
      artifact.readbackTelemetrySourceBreakdown[0].untrustedArtifactField,
      undefined
    );
  }
});

test('both probe call sites couple final-step certification without double-counting snapshots', () => {
  const source = readFileSync(
    new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
    'utf8'
  );
  const { serializers } = extractedProbeReadbackSerializers(source);
  const {
    expressions,
    composers
  } = extractedProbeReadbackComposers(source, serializers);
  assert.equal(composers.length, 2);
  assert.equal(
    expressions[0],
    expressions[1],
    'mounted and direct-resident composition must remain structurally identical'
  );
  assert.equal(
    [...source.matchAll(
      /composePageVisibleReadbackTelemetry\(steps, steps\?\.finalStep\)/g
    )].length,
    2,
    'both publication sites must include the present final step'
  );

  const parent = createGpuReadbackTelemetry({
    scope: 'probe-parent-sequence-aggregate',
    mapAsyncCount: 2,
    readbackBytes: 128,
    hostQueueFenceCount: 2,
    finalDiagnosticMapAsyncCount: 2,
    finalDiagnosticReadbackBytes: 128,
    deferredCleanupHostQueueFenceCount: 2
  });
  const finalStep = createGpuReadbackTelemetry({
    scope: 'probe-final-step-snapshot',
    mapAsyncCount: 1,
    readbackBytes: 64,
    hostQueueFenceCount: 1,
    finalDiagnosticMapAsyncCount: 1,
    finalDiagnosticReadbackBytes: 64,
    deferredCleanupHostQueueFenceCount: 1
  });
  for (const [index, compose] of composers.entries()) {
    const composed = compose(parent, finalStep);
    assert.equal(composed.readbackTelemetryComplete, true);
    assert.equal(
      composed.observedMapAsyncCount,
      parent.observedMapAsyncCount,
      `composer ${index + 1}: parent aggregate is the sole count authority`
    );
    assert.equal(
      composed.observedReadbackBytes,
      parent.observedReadbackBytes,
      `composer ${index + 1}: final snapshot bytes are not added twice`
    );
    assert.deepEqual(
      composed.readbackTelemetrySourceBreakdown,
      parent.readbackTelemetrySourceBreakdown,
      `composer ${index + 1}: parent breakdown remains authoritative`
    );
  }

  const rawNoSchema = {
    normalHotLoopReadbackFree: true,
    productionHotLoopHostDependencyFree: true
  };
  const positiveParent = createGpuReadbackTelemetry({
    scope: 'probe-positive-parent-sequence-aggregate'
  });
  const positiveFinalStep = createGpuReadbackTelemetry({
    scope: 'probe-positive-final-step-snapshot'
  });
  const malformedFinalSteps = [
    ['wrong schema', {
      ...positiveFinalStep,
      readbackTelemetrySchema: 'peercompute.ulg.gpu-readback-telemetry.wrong'
    }],
    ['explicit incomplete', {
      ...positiveFinalStep,
      readbackTelemetryComplete: false
    }],
    ['malformed count', {
      ...positiveFinalStep,
      observedMapAsyncCount: -1
    }],
    ['raw no-schema', rawNoSchema]
  ];
  for (const [name, malformedFinalStep] of malformedFinalSteps) {
    for (const [index, compose] of composers.entries()) {
      const composed = compose(positiveParent, malformedFinalStep);
      assert.notEqual(
        composed.readbackTelemetryComplete,
        true,
        `${name}: composer ${index + 1}: completeness`
      );
      for (const field of [
        'observedMapAsyncCount',
        'observedReadbackBytes',
        'observedHostQueueFenceCount',
        'mapAsyncCount',
        'readbackBytes',
        'hostQueueFenceCount'
      ]) {
        assert.equal(
          composed[field],
          null,
          `${name}: composer ${index + 1}: ${field}`
        );
      }
      assert.equal(
        composed.readbackTelemetrySourceBreakdown,
        null,
        `${name}: composer ${index + 1}: breakdown`
      );
      assert.equal(
        composed.normalHotLoopReadbackFree,
        null,
        `${name}: composer ${index + 1}: strict claim`
      );
      assert.equal(
        composed.productionHotLoopHostDependencyFree,
        null,
        `${name}: composer ${index + 1}: production claim`
      );
    }
  }

  const explicitFailure = {
    readbackTelemetryComplete: false,
    normalHotLoopReadbackFree: false,
    productionHotLoopHostDependencyFree: false
  };
  for (const [index, compose] of composers.entries()) {
    const composed = compose(parent, explicitFailure);
    assert.equal(composed.readbackTelemetryComplete, false);
    assert.equal(
      composed.normalHotLoopReadbackFree,
      false,
      `composer ${index + 1}: explicit strict false survives`
    );
    assert.equal(
      composed.productionHotLoopHostDependencyFree,
      false,
      `composer ${index + 1}: explicit production false survives`
    );
  }
});

test('full probe detail mode preserves metric identity', () => {
  const metric = {
    residentSteps: {
      schroederSpatialEpochTransactionSummaries: [{ step: 1 }]
    }
  };
  assert.strictEqual(
    compactVisualProbeMetric(metric, { detailMode: 'full' }),
    metric
  );
});

test('probe artifact detail mode rejects unknown values', () => {
  assert.equal(normalizeProbeArtifactDetailMode('VISUAL-COMPACT'), 'visual-compact');
  assert.throws(
    () => normalizeProbeArtifactDetailMode('tiny'),
    /Unsupported SPH probe artifact detail mode/
  );
});
