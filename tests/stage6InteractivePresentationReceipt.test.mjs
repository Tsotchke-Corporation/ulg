import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  EXTRACTION_PRESENTATION_COUNTERS_SCHEMA,
  EXTRACTION_PRESENTATION_COUNTER_SOURCE_KEYS,
  INTERACTIVE_CACHE_LIFECYCLE_SCHEMA,
  INTERACTIVE_PRESENTATION_EVENT_NAMES,
  INTERACTIVE_PRESENTATION_RECEIPT_SCHEMA,
  createInteractivePresentationCommandPolicy,
  evaluatePairedV2OptInInteractivePresentationReceipt,
  evaluateInteractivePresentationReceipt,
  parseInteractivePresentationReceiptCliArgs,
  readAndEvaluateInteractivePresentationReceipt,
  runPairedV2OptInInteractivePresentationReceipt,
  runInteractivePresentationReceipt
} from '../scripts/stage6-interactive-presentation-receipt.mjs';
import {
  SS_CONTAINED_POLICY_TRACK,
  canonicalJsonSha256,
  createNonProductionFixtureCapability,
  sha256Bytes
} from '../scripts/ss-release-evidence-common.mjs';

const productionRepoDir = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..'
);

function fingerprint(seed = 'a') {
  return {
    gitHead: seed.repeat(40),
    sourceFingerprint: seed.repeat(64),
    worktreeDirty: false,
    worktreeStatusHash: seed.repeat(64),
    trackedAndUntrackedFileCount: 7
  };
}

function metadata(filePath, text) {
  return {
    path: filePath,
    byteLength: Buffer.byteLength(text),
    sha256: sha256Bytes(text)
  };
}

function zeroCounters() {
  return {
    schema: EXTRACTION_PRESENTATION_COUNTERS_SCHEMA,
    coverage: {
      schema:
        'peercompute.ulg.sph-extraction-presentation-counter-coverage.v1',
      status: 'complete',
      complete: true,
      requiredSourceCount:
        EXTRACTION_PRESENTATION_COUNTER_SOURCE_KEYS.length,
      observedSourceCount:
        EXTRACTION_PRESENTATION_COUNTER_SOURCE_KEYS.length,
      requiredSourceKeys: [...EXTRACTION_PRESENTATION_COUNTER_SOURCE_KEYS],
      observedSourceKeys: [...EXTRACTION_PRESENTATION_COUNTER_SOURCE_KEYS],
      missingSourceKeys: []
    },
    cpuSurfaceFallbackCount: 0,
    diagnosticFallbackCount: 0,
    fullReadbackCount: 0,
    summaryReadbackCount: 0,
    nativeReadbackFallbackCount: 0,
    surfaceExtractionErrorCount: 0,
    presentationErrorCount: 0
  };
}

function renderState(batchIndex) {
  const warmup = batchIndex === 1;
  return {
    schema: 'peercompute.ulg.sph-resident-render-state.v0',
    status: 'resident-render-field-applied',
    source: 'resident-gpu-render-field',
    backend: 'webgpu',
    nativeBufferMapTally: {},
    nativeQueueFenceTraceInstalled: true,
    nativeQueueFenceTally: {},
    nativeQueueFenceTotal: 0,
    renderFieldReadback: false,
    renderFieldEmptyRetryReadback: false,
    renderFieldCpuFallbackGeometryAvailable: false,
    renderRowsReadback: false,
    renderRowsReadbackMode: 'no-full-readback',
    renderRowsReadbackByteLength: 0,
    surfaceDrawReadback: false,
    surfaceDrawSummaryReadback: false,
    surfaceDrawSummaryReadbackByteLength: 0,
    fullSurfaceDrawReadback: false,
    surfaceDrawGpuBufferHandoffNoFullReadback: true,
    surfaceDrawGpuBufferHandoffNoSummaryReadback: true,
    surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated: false,
    surfaceDrawDiagnosticFallbackReason: null,
    surfaceDrawExtractionPresentationCounters: zeroCounters(),
    renderFieldBufferMode: 'native-marching-cubes-buffer-volume-extracted',
    surfaceDrawVisibleRendererBridge: 'native-webgpu-surface-consumer',
    surfaceDrawGpuBufferHandoffReady: true,
    surfaceDrawGpuBufferHandoffStatus:
      'resident-surface-buffer-direct-consumer-ready',
    surfaceDrawGpuBufferHandoffReason: null,
    surfaceDrawGpuBufferHandoffKind: 'surface-draw-buffers',
    surfaceDrawGpuBufferHandoffInputSchema:
      'peercompute.ulg.sph-resident-surface-draw.v0',
    surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction: false,
    surfaceDrawVisibleGpuConsumerReady: true,
    surfaceDrawVisibleGpuConsumerStatus:
      'resident-surface-visible-gpu-consumer-ready',
    surfaceDrawVisibleGpuConsumerReason: null,
    surfaceDrawVisibleGpuConsumerInputReady: true,
    surfaceDrawVisibleGpuConsumerInputKind: 'surface-draw-buffers',
    surfaceDrawVisibleGpuConsumerRuntimeReady: true,
    surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: true,
    surfaceDrawVisibleGpuConsumerForegroundProofValidated: false,
    surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted: true,
    surfaceDrawVisibleGpuConsumerSameQueueForegroundSubmissionValidated: false,
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus:
      'passed',
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind:
      'same-queue-private-staged-composite-submission',
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary:
      true,
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount: 1,
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration: 7,
    surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration: 7,
    surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected: true,
    surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute:
      'native-webgpu-surface-consumer',
    surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread:
      'main-thread',
    surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope:
      'engine-owned-native-webgpu-canvas-device',
    surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus:
      'same-device-main-thread-import-ready',
    surfaceDrawRequestedDiagnosticMode: 'native-webgpu-surface-consumer',
    surfaceDrawSource: 'webgpu-marching-cubes-extension',
    surfaceDrawVisibleRenderSource:
      'resident-surface-draw-native-webgpu-consumer',
    surfaceDrawCompactPositionRowsBufferByteLength: 4096,
    surfaceDrawCompactPositionRowsVertexCount: 256,
    surfaceDrawCompactPositionRowsStrideFloats: 4,
    surfaceDrawDirectCompactPositionDraw: true,
    surfaceDrawRenderBridgeExternalGpuBufferInputLayout:
      'webgpu-marching-cubes-compact-position-rows',
    surfaceDrawRenderBridgeCompactPositionDirectInput: true,
    surfaceDrawCompactedVertexRowsBufferByteLength: 0,
    surfaceDrawNativeMarchingCubesExtractionAllowed: true,
    surfaceDrawNativeMarchingCubesExtractionStatus:
      'webgpu-marching-cubes-surface-extracted',
    surfaceDrawNativeMarchingCubesExtractionReason: null,
    surfaceDrawNativeMarchingCubesExtractionElapsedMs: 2,
    surfaceDrawNativeMarchingCubesExtensionExecutionElapsedMs: 1.5,
    surfaceDrawNativeMarchingCubesTotalElapsedMs: 3,
    surfaceDrawNativeMarchingCubesExtractionErrorName: null,
    surfaceDrawNativeMarchingCubesExtractionErrorStatus: null,
    surfaceDrawNativeMarchingCubesExtractionErrorStage: null,
    surfaceDrawNativeMarchingCubesExtractionErrorStack: null,
    surfaceDrawExtensionSurfaceAdapterExecutionStatus:
      'webgpu-extension-surface-executed',
    surfaceDrawExtensionSurfaceRawExecutionStatus:
      'webgpu-marching-cubes-executed',
    surfaceDrawExtensionSurfaceRawVertexCount: 256,
    surfaceDrawExtensionSurfaceTranslationElapsedMs: 0.5,
    surfaceDrawExtensionSurfaceRefreshElapsedMs: 1,
    surfaceDrawNativeMarchingCubesAdapterCacheHit: !warmup,
    surfaceDrawNativeMarchingCubesAdapterCacheStatus: warmup
      ? 'native-marching-cubes-adapter-cache-miss-created'
      : 'native-marching-cubes-adapter-cache-hit',
    surfaceDrawNativeMarchingCubesAdapterCacheHitCount: warmup
      ? 0
      : batchIndex - 1,
    surfaceDrawNativeMarchingCubesAdapterCacheMissCount: 1,
    surfaceDrawNativeMarchingCubesAdapterCacheReleaseCount: 0,
    surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus: warmup
      ? 'pipeline-cache-miss'
      : 'pipeline-cache-hit',
    surfaceDrawExtensionSurfaceTranslationPipelineCreated: true,
    surfaceDrawExtensionSurfaceTranslationBindGroupCreated: true,
    surfaceDrawExtensionSurfaceTranslationCommandEncoderCreated: true,
    surfaceDrawExtensionSurfaceTranslationWorkgroupCountX: 1,
    surfaceDrawExtensionSurfaceTranslationSubmissionObserved: true,
    surfaceDrawExtensionSurfaceDirectCompactPositionDrawIndirectSource:
      'ulg-compact-position-draw-metadata-kernel',
    surfaceDrawExtensionSurfaceDrawIndirectRowsOwnership:
      'ulg-owned-retained-buffer',
    surfaceDrawExtensionSurfaceDrawIndirectBufferRetained: true,
    surfaceDrawExtensionSurfaceDrawIndirectBufferByteLength: 16,
    surfaceDrawExtensionSurfaceQueueCompletionStatus:
      'queue-submitted-cleanup-deferred',
    surfaceDrawExtensionSurfaceQueueCompletionMethod:
      'deferred queue.onSubmittedWorkDone cleanup',
    surfaceDrawExtensionSurfaceVertexRowsBufferClearStatus:
      'skipped-direct-compact-position-draw',
    surfaceDrawExtensionSurfaceHotLoopGpuTranslationRequired: false,
    surfaceDrawRenderBridgeFrameCount: batchIndex + 4,
    surfaceDrawRenderBridgeUpdateCount: batchIndex,
    surfaceDrawRenderBridgeReused: !warmup,
    surfaceDrawRenderBridgeNativeSurfaceReuseStatus: warmup
      ? 'native-webgpu-surface-consumer-bridge-created'
      : 'native-webgpu-surface-consumer-bridge-reused',
    surfaceDrawRenderBridgeLastRenderSkipReason: null,
    surfaceDrawRenderBridgeLastRenderStatus:
      'native-webgpu-surface-consumer-candidate-staged-composite-presented',
    surfaceDrawRenderBridgeLastDrawOrderCount: 1
  };
}

function residentMetric(batchIndex) {
  return {
    batchIndex,
    phase: 'resident-batch',
    capturedAtMs: 300 + batchIndex,
    pageInstanceId: 'page-instance-1',
    cacheResetOrdinal: 1,
    interactiveCacheMeasurementClass: batchIndex === 1
      ? 'post-reset-warmup'
      : 'post-reset-measured',
    sceneTimeS: batchIndex * 0.01,
    probeResidentBatchTiming: {
      status: 'resident-batch-timing-collected',
      residentStepsAwaitMs: 10,
      backgroundSettlementAwaitMs: 0.25,
      backgroundSettlementStatus: batchIndex === 3
        ? 'background-settlement-complete-after-unmeasured-terminal-consumer'
        : 'background-settlement-complete-after-successor-consumer',
      backgroundSettlementSuccessorBatchIndex: batchIndex + 1,
      backgroundSettlementTerminalDrain: batchIndex === 3,
      renderRefreshAwaitMs: 5,
      materialInterfaceDiagnosticMs: 0,
      viewportRefreshMs: 5,
      viewportRafMs: 1,
      nativeSurfaceValidationWaitMs: 1,
      totalBeforeSampleMs: 25
    },
    residentSteps: {
      schema: 'peercompute.ulg.sph-resident-steps.v0',
      status: 'resident-steps-executed',
      backend: 'webgpu',
      completedStepCount: 1,
      normalHotLoopReadbackFree: true,
      readbackMode: 'no-full-readback',
      readbackTelemetrySchema: 'peercompute.ulg.gpu-readback-telemetry.v1',
      readbackTelemetryScope:
        'sph-phase-scene-schroeder-resident-sequence',
      readbackTelemetryComplete: true,
      readbackTelemetryUnknownSources: [],
      observedMapAsyncCount: 0,
      observedReadbackBytes: 0,
      observedHostQueueFenceCount: 0,
      mapAsyncCount: 0,
      readbackBytes: 0,
      hostQueueFenceCount: 0,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      residentContinuationReady: true,
      continuedFromResidentState: batchIndex > 1,
      nextStep: batchIndex,
      nextTime: batchIndex * 0.01,
      schroederSpatialEpochGenerationSummaries: [{
        spatialEpochGeneration: {
          generationId: batchIndex,
          mechanicsFieldPairV2Enabled: false,
          mechanicsFieldConstructionMode: 'independent-v2'
        }
      }]
    },
    renderState: renderState(batchIndex)
  };
}

function probeDocument() {
  const metrics = [1, 2, 3].map(residentMetric);
  return {
    schema: 'peercompute.ulg.sph-history-probe-result.v0',
    status: 'good',
    browserLaunch: {
      schema: 'peercompute.ulg.sph-probe-browser-launch.v0',
      headless: false,
      channel: null,
      executablePath: '/usr/bin/google-chrome',
      args: [
        '--enable-unsafe-webgpu',
        '--use-angle=vulkan',
        '--enable-features=Vulkan,UseSkiaRenderer',
        '--ignore-gpu-blocklist',
        '--ozone-platform=x11',
        '--window-position=-10000,-10000',
        '--window-size=320,240'
      ]
    },
    timeline: {
      status: 'complete',
      errors: [],
      browserConsole: {
        issueCount: 0,
        pageErrorCount: 0
      },
      visualFrameCapture: {
        enabled: true,
        visualIntervalCaptureRequested: false
      },
      authoritativeGpuCheckpointCapture: {
        enabled: false,
        status: 'disabled'
      },
      nativeSurfaceDrawIndirectArgsValidation: {
        status: 'not-requested'
      },
      interactiveCacheLifecycle: {
        schema: INTERACTIVE_CACHE_LIFECYCLE_SCHEMA,
        status: 'same-page-warm-reset-cached-measurement-complete',
        completedAtMs: 400,
        sameBrowserProcess: true,
        sameBrowserContext: true,
        samePage: true,
        pageInstanceId: 'page-instance-1',
        pageIdentity: {
          pageInstanceId: 'page-instance-1',
          performanceTimeOrigin: 10,
          documentUrl: 'https://benchmark.invalid/cached',
          navigationEntryCount: 1
        },
        warmup: {
          completedAtMs: 100,
          completedResidentBatchCount: 1,
          staticTableWrite: {
            schema: 'peercompute.ulg.sph-static-table-cache-update.v0',
            status: 'stored',
            counts: {
              tables: 4,
              gpuWarmup: 1
            }
          }
        },
        reset: {
          completedAtMs: 200,
          resetOrdinal: 1,
          control: 'sph-reset',
          navigationPerformed: false,
          residentStateReset: true,
          resetGenerationAdvanced: true,
          residentExecutionIdentityChanged: true,
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
          },
          performanceTimeOrigin: 10,
          documentUrl: 'https://benchmark.invalid/cached',
          navigationEntryCount: 1,
          staticTableCacheStatus: 'static-table-cache-bundle-hit',
          staticTableRead: {
            status: 'static-table-cache-bundle-hit',
            hitCount: 4,
            tableCount: 4,
            gpuWarmupCount: 1
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
      metrics
    },
    analysis: {
      status: 'good',
      issues: []
    }
  };
}

function scenarioDocument(rawProbeArtifact) {
  const engineBatchMs = 19.25;
  const fps = 1000 / engineBatchMs;
  return {
    schema: 'peercompute.ulg.sph-performance-benchmark-scenario.v0',
    status: 'good',
    probeStatus: 'good',
    exitCode: 0,
    probeIssues: [],
    performanceGate: {
      status: 'pass',
      blockers: []
    },
    scenarioUrl:
      '/?drop=h2o&base=h2o&ss=1&schroederLevel=0'
      + '&schroederMaxLevel=1&schroederCrossLevelCoupling=1'
      + '&schroederTwoLevel=1'
      + '&schroederTwoLevelAuthority=authoritative'
      + '&schroederTwoLevelSubsteps=2'
      + '&surfaceDraw=native-webgpu-surface-consumer',
    physicsStepsPerSecond: fps,
    physicsStepsPerSecondSource: 'complete-engine-batch',
    probeEngineBatchMs: engineBatchMs,
    browserConsoleIssueCount: 0,
    browserConsoleIssueCounts: {},
    estimatedReadbackBytesPerStep: 0,
    estimatedReadbackBytesPerBatch: 0,
    copyBudget: {
      estimatedReadbackBytesPerStep: 0,
      estimatedReadbackBytesPerBatch: 0
    },
    schroederMechanicsFieldPairV2ConfiguredRequested: false,
    schroederMechanicsFieldPairV2Enabled: false,
    schroederMechanicsFieldConstructionMode: 'independent-v2',
    schroederMechanicsFieldPairV2CoverageComplete: true,
    schroederMechanicsFieldPairV2Evidence: {
      configuredRequested: false,
      generationSummaryCount: 3,
      enabledObservationCount: 3,
      constructionModeObservationCount: 3,
      observedEnabledValues: [false],
      observedConstructionModes: ['independent-v2'],
      coverageComplete: true
    },
    validResidentSurfaceBufferHandoff: true,
    surfaceDrawBridge: 'native-webgpu-surface-consumer',
    surfaceDrawGpuBufferHandoffReady: true,
    surfaceDrawVisibleGpuConsumerReady: true,
    surfaceDrawVisibleGpuConsumerRuntimeReady: true,
    surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: true,
    surfaceDrawVisibleGpuConsumerForegroundProofValidated: false,
    surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted: true,
    surfaceDrawVisibleGpuConsumerSameQueueForegroundSubmissionValidated: false,
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus:
      'passed',
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind:
      'same-queue-private-staged-composite-submission',
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary:
      true,
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount: 1,
    surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration: 7,
    surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration: 7,
    surfaceDrawRenderBridgeExternalGpuBufferInputLayout:
      'webgpu-marching-cubes-compact-position-rows',
    surfaceDrawDirectCompactPositionDraw: true,
    surfaceDrawRenderBridgeCompactPositionDirectInput: true,
    surfaceDrawNativeMarchingCubesAdapterCacheHit: true,
    surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus:
      'pipeline-cache-hit',
    surfaceDrawExtensionSurfaceTranslationPipelineCreated: true,
    surfaceDrawExtensionSurfaceTranslationBindGroupCreated: true,
    surfaceDrawExtensionSurfaceTranslationCommandEncoderCreated: true,
    surfaceDrawExtensionSurfaceTranslationWorkgroupCountX: 1,
    surfaceDrawExtensionSurfaceTranslationSubmissionObserved: true,
    surfaceDrawExtensionSurfaceDirectCompactPositionDrawIndirectSource:
      'ulg-compact-position-draw-metadata-kernel',
    surfaceDrawExtensionSurfaceDrawIndirectRowsOwnership:
      'ulg-owned-retained-buffer',
    surfaceDrawExtensionSurfaceDrawIndirectBufferRetained: true,
    surfaceDrawExtensionSurfaceDrawIndirectBufferByteLength: 16,
    surfaceDrawExtensionSurfaceQueueCompletionStatus:
      'queue-submitted-cleanup-deferred',
    surfaceDrawExtensionSurfaceQueueCompletionMethod:
      'deferred queue.onSubmittedWorkDone cleanup',
    surfaceDrawExtensionSurfaceVertexRowsBufferClearStatus:
      'skipped-direct-compact-position-draw',
    surfaceDrawExtensionSurfaceHotLoopGpuTranslationRequired: false,
    surfaceDrawRenderBridgeFrameCount: 7,
    surfaceDrawRenderBridgeUpdateCount: 3,
    rawProbeArtifact
  };
}

function applyExtensionDrawIndirectBypassWitness(state) {
  Object.assign(state, {
    surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus:
      'skipped-extension-draw-indirect-buffer',
    surfaceDrawExtensionSurfaceTranslationPipelineCreated: false,
    surfaceDrawExtensionSurfaceTranslationBindGroupCreated: false,
    surfaceDrawExtensionSurfaceTranslationCommandEncoderCreated: false,
    surfaceDrawExtensionSurfaceTranslationWorkgroupCountX: 0,
    surfaceDrawExtensionSurfaceTranslationSubmissionObserved: false,
    surfaceDrawExtensionSurfaceDirectCompactPositionDrawIndirectSource:
      'webgpu-marching-cubes-extension-draw-indirect-buffer',
    surfaceDrawExtensionSurfaceDrawIndirectRowsOwnership:
      'extension-owned-retained-buffer',
    surfaceDrawExtensionSurfaceDrawIndirectBufferRetained: true,
    surfaceDrawExtensionSurfaceDrawIndirectBufferByteLength: 16,
    surfaceDrawExtensionSurfaceQueueCompletionStatus:
      'queue-work-not-required',
    surfaceDrawExtensionSurfaceQueueCompletionMethod:
      'extension-owned-draw-indirect-buffer',
    surfaceDrawExtensionSurfaceVertexRowsBufferClearStatus:
      'skipped-direct-compact-position-draw',
    surfaceDrawExtensionSurfaceHotLoopGpuTranslationRequired: false
  });
  if ('surfaceDrawExtensionSurfaceTranslationElapsedMs' in state) {
    state.surfaceDrawExtensionSurfaceTranslationElapsedMs = 0;
  }
  return state;
}

function applyFixtureTranslationBypass(value) {
  for (const metric of value.evidence.probe.json.timeline.metrics) {
    if (metric?.renderState) {
      applyExtensionDrawIndirectBypassWitness(metric.renderState);
    }
  }
  applyExtensionDrawIndirectBypassWitness(
    value.evidence.benchmark.json.scenarios[0]
  );
  refreshJsonEvidence(value);
  return value;
}

function fixture({
  root = '/tmp/ulg-interactive-receipt-fixture',
  paired = false
} = {}) {
  const benchmarkPath = path.join(root, 'benchmark.json');
  const probePath = path.join(root, 'probe.json');
  const stdoutPath = path.join(root, 'benchmark.stdout.json');
  const stderrPath = path.join(root, 'benchmark.stderr.log');
  const probe = probeDocument();
  let probeText = `${JSON.stringify(probe, null, 2)}\n`;
  let probeArtifact = metadata(probePath, probeText);
  const report = {
    schema: 'peercompute.ulg.sph-performance-benchmark.v0',
    status: 'complete',
    durableReleasePublication: true,
    performanceGate: {
      status: 'pass'
    },
    schroederMechanicsFieldPairV2Requested: false,
    scenarios: [scenarioDocument(probeArtifact)]
  };
  if (paired) {
    const scenario = report.scenarios[0];
    scenario.scenarioUrl += '&schroederMechanicsFieldPairV2=1';
    report.schroederMechanicsFieldPairV2Requested = true;
    scenario.schroederMechanicsFieldPairV2ConfiguredRequested = true;
    scenario.schroederMechanicsFieldPairV2Enabled = true;
    scenario.schroederMechanicsFieldConstructionMode = 'paired-v2-shared-radix';
    scenario.schroederMechanicsFieldPairV2Evidence = {
      ...scenario.schroederMechanicsFieldPairV2Evidence,
      configuredRequested: true,
      observedEnabledValues: [true],
      observedConstructionModes: ['paired-v2-shared-radix']
    };
    for (const metric of probe.timeline.metrics) {
      const generation = metric.residentSteps
        .schroederSpatialEpochGenerationSummaries[0].spatialEpochGeneration;
      generation.mechanicsFieldPairV2Enabled = true;
      generation.mechanicsFieldConstructionMode = 'paired-v2-shared-radix';
    }
    probeText = `${JSON.stringify(probe, null, 2)}\n`;
    probeArtifact = metadata(probePath, probeText);
    scenario.rawProbeArtifact = probeArtifact;
  }
  const benchmarkText = `${JSON.stringify(report, null, 2)}\n`;
  const stderrText = '';
  const evidence = {
    stdout: {
      ...metadata(stdoutPath, benchmarkText),
      text: benchmarkText
    },
    stderr: {
      ...metadata(stderrPath, stderrText),
      text: stderrText
    },
    benchmark: {
      ...metadata(benchmarkPath, benchmarkText),
      text: benchmarkText,
      json: report
    },
    probe: {
      ...probeArtifact,
      text: probeText,
      json: probe
    }
  };
  const policy = createInteractivePresentationCommandPolicy({
    benchmarkOutputPath: benchmarkPath,
    ...(paired ? { route: 'paired-v2-opt-in' } : {})
  });
  const sourceFingerprint = fingerprint();
  const receipt = {
    schema: INTERACTIVE_PRESENTATION_RECEIPT_SCHEMA,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    status: 'complete',
    commandPolicy: policy,
    sourceFingerprintBefore: sourceFingerprint,
    sourceFingerprintAfter: sourceFingerprint,
    command: {
      invocationSha256: canonicalJsonSha256(policy.command),
      exitCode: 0,
      signal: null,
      spawnError: null,
      stdoutArtifact: {
        path: evidence.stdout.path,
        byteLength: evidence.stdout.byteLength,
        sha256: evidence.stdout.sha256
      },
      stderrArtifact: {
        path: evidence.stderr.path,
        byteLength: evidence.stderr.byteLength,
        sha256: evidence.stderr.sha256
      },
      benchmarkArtifact: {
        path: evidence.benchmark.path,
        byteLength: evidence.benchmark.byteLength,
        sha256: evidence.benchmark.sha256
      },
      probeArtifact: {
        path: evidence.probe.path,
        byteLength: evidence.probe.byteLength,
        sha256: evidence.probe.sha256
      }
    }
  };
  return {
    receipt,
    policy,
    sourceFingerprint,
    evidence
  };
}

function evaluate(value) {
  return evaluateInteractivePresentationReceipt(value.receipt, {
    expectedPolicy: value.policy,
    currentFingerprint: value.sourceFingerprint,
    artifactEvidence: value.evidence
  });
}

test('authenticates cached FPS and native marching cubes with exact ICC kinds', () => {
  const value = fixture();
  const result = evaluate(value);
  assert.equal(result.passed, true, result.failures.join('\n'));
  assert.equal(result.physicsPassed, true);
  assert.equal(result.marchingPassed, true);
  assert.deepEqual(
    result.events.map(({ kind, name, status }) => ({ kind, name, status })),
    [
      {
        kind: 'ulg_perf_probe',
        name: INTERACTIVE_PRESENTATION_EVENT_NAMES.physics,
        status: 'PASS'
      },
      {
        kind: 'ulg_sph_probe',
        name: INTERACTIVE_PRESENTATION_EVENT_NAMES.marching,
        status: 'PASS'
      }
    ]
  );
  assert.equal(
    result.events[0].details.measuredBatches.length,
    2
  );
  assert.equal(
    result.events[0].details.measuredBatches.every(
      (entry) => entry.metricSource === 'complete-engine-batch'
        && entry.physicsStepsPerSecond >= 30
    ),
    true
  );
  assert.equal(value.policy.browserOwnership.headless, false);
  assert.equal(
    value.policy.browserOwnership.mode,
    'isolated-child-owned-offscreen-x11-browser'
  );
  assert.equal(
    value.policy.command.environment.ULG_PROBE_CHROMIUM_ARGS,
    '--ignore-gpu-blocklist --ozone-platform=x11 '
      + '--window-position=-10000,-10000 --window-size=320,240'
  );
});

test('presentation receipt rejects legacy, stale, and coercible native admission claims', () => {
  const mutations = [
    {
      name: 'legacy ready and foreground-validation claims',
      apply(state) {
        state.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted = false;
        state.surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted =
          false;
        state.surfaceDrawVisibleGpuConsumerSameQueueForegroundSubmissionValidated =
          true;
      }
    },
    {
      name: 'stale candidate generation',
      apply(state) {
        state
          .surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration =
            6;
      }
    },
    {
      name: 'coercible candidate generation',
      apply(state) {
        state
          .surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration =
            '7';
      }
    },
    {
      name: 'conflated structural and foreground claims',
      apply(state) {
        state.surfaceDrawVisibleGpuConsumerForegroundProofValidated = true;
      }
    }
  ];

  for (const mutation of mutations) {
    const value = fixture();
    for (const metric of value.evidence.probe.json.timeline.metrics) {
      mutation.apply(metric.renderState);
    }
    mutation.apply(value.evidence.benchmark.json.scenarios[0]);
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false, mutation.name);
    assert.equal(result.marchingPassed, false, mutation.name);
    assert.match(
      result.failures.join('\n'),
      /exact presentation-admission telemetry incomplete/u,
      mutation.name
    );
  }
});

test('authenticates the exact extension-owned indirect-draw translation bypass', () => {
  const value = applyFixtureTranslationBypass(fixture());
  const result = evaluate(value);
  assert.equal(result.passed, true, result.failures.join('\n'));
  assert.equal(
    result.events[1].details.translationExecutionRoute,
    'extension-draw-indirect-bypass'
  );
  assert.deepEqual(
    result.events[1].details.translationExecutionRoutes,
    [
      'extension-draw-indirect-bypass',
      'extension-draw-indirect-bypass',
      'extension-draw-indirect-bypass'
    ]
  );
  assert.equal(
    result.events[1].details.scenarioTranslationRoute,
    'extension-draw-indirect-bypass'
  );
});

test('translation bypass fails closed for every missing or malformed typed witness', () => {
  const invalidValues = new Map([
    ['surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus', 'skipped-other-work'],
    ['surfaceDrawDirectCompactPositionDraw', false],
    [
      'surfaceDrawExtensionSurfaceDirectCompactPositionDrawIndirectSource',
      'ulg-compact-position-draw-metadata-kernel'
    ],
    [
      'surfaceDrawExtensionSurfaceDrawIndirectRowsOwnership',
      'ulg-owned-retained-buffer'
    ],
    ['surfaceDrawExtensionSurfaceDrawIndirectBufferRetained', 'true'],
    ['surfaceDrawExtensionSurfaceDrawIndirectBufferByteLength', 15],
    ['surfaceDrawExtensionSurfaceQueueCompletionStatus', 'queue-submitted'],
    ['surfaceDrawExtensionSurfaceQueueCompletionMethod', 'queue.submit'],
    [
      'surfaceDrawExtensionSurfaceVertexRowsBufferClearStatus',
      'skipped-arbitrary-reason'
    ],
    ['surfaceDrawExtensionSurfaceTranslationPipelineCreated', 0],
    ['surfaceDrawExtensionSurfaceTranslationBindGroupCreated', true],
    ['surfaceDrawExtensionSurfaceTranslationCommandEncoderCreated', true],
    ['surfaceDrawExtensionSurfaceTranslationWorkgroupCountX', '0'],
    ['surfaceDrawExtensionSurfaceTranslationSubmissionObserved', true],
    ['surfaceDrawExtensionSurfaceHotLoopGpuTranslationRequired', true]
  ]);
  for (const [key, invalidValue] of invalidValues) {
    const value = applyFixtureTranslationBypass(fixture());
    value.evidence.probe.json.timeline.metrics[0].renderState[key] = invalidValue;
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false, `${key} accepted ${String(invalidValue)}`);
    assert.match(result.failures.join('\n'), /translation route/u);
  }
  for (const key of invalidValues.keys()) {
    const value = applyFixtureTranslationBypass(fixture());
    delete value.evidence.probe.json.timeline.metrics[0].renderState[key];
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false, `${key} was optional`);
    assert.match(result.failures.join('\n'), /translation route/u);
  }
});

test('translation route rejects mixed frames, stale summaries, and fake pipeline work', () => {
  {
    const value = fixture();
    applyExtensionDrawIndirectBypassWitness(
      value.evidence.probe.json.timeline.metrics[0].renderState
    );
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /translation route/u);
  }
  {
    const value = applyFixtureTranslationBypass(fixture());
    const scenario = value.evidence.benchmark.json.scenarios[0];
    const pipelineFinal = renderState(3);
    for (const [key, fieldValue] of Object.entries(pipelineFinal)) {
      if (
        key === 'surfaceDrawDirectCompactPositionDraw'
        || key.startsWith('surfaceDrawExtensionSurface')
      ) {
        scenario[key] = fieldValue;
      }
    }
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /translation route/u);
  }
  {
    const value = fixture();
    value.evidence.probe.json.timeline.metrics[1].renderState
      .surfaceDrawExtensionSurfaceTranslationSubmissionObserved = false;
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /translation route/u);
  }
  {
    const value = fixture();
    value.evidence.probe.json.timeline.metrics[1].renderState
      .surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus =
        'pipeline-cache-miss';
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /translation route/u);
  }
});

test('production receipt rejects arbitrary injected process runners', async () => {
  await assert.rejects(
    createNonProductionFixtureCapability({
      repoDir: productionRepoDir,
      productionRepoDir
    }),
    /cannot target the production repository/u
  );
  await assert.rejects(
    runInteractivePresentationReceipt({
      receiptPath: '/tmp/ulg-forbidden-interactive-receipt.json',
      processRunner: async () => {
        throw new Error('must not run');
      }
    }),
    /does not accept processRunner/u
  );
  await assert.rejects(
    runPairedV2OptInInteractivePresentationReceipt({
      receiptPath: '/tmp/ulg-forbidden-paired-interactive-receipt.json',
      processRunner: async () => {
        throw new Error('must not run');
      }
    }),
    /does not accept processRunner/u
  );
  await assert.rejects(
    runInteractivePresentationReceipt({
      receiptPath: '/tmp/ulg-forbidden-production-fixture-receipt.json',
      repoDir: productionRepoDir,
      fixtureCapability: Object.freeze({}),
      fixtureProcessRunner: async () => {
        throw new Error('must not run');
      }
    }),
    /requires an opaque fixture capability/u
  );
});

test('authenticates a sub-30 cached result as a contained warning', () => {
  const value = fixture();
  value.receipt.events = [{
    kind: 'ulg_perf_probe',
    name: INTERACTIVE_PRESENTATION_EVENT_NAMES.physics,
    status: 'PASS',
    value: 'PASS'
  }];
  for (const metric of value.evidence.probe.json.timeline.metrics.filter(
    (entry) => entry.interactiveCacheMeasurementClass
      === 'post-reset-measured'
  )) {
    metric.probeResidentBatchTiming.residentStepsAwaitMs = 25;
    metric.probeResidentBatchTiming.totalBeforeSampleMs = 40;
  }
  value.evidence.benchmark.json.scenarios[0].probeEngineBatchMs = 34.25;
  value.evidence.benchmark.json.scenarios[0].physicsStepsPerSecond =
    1000 / 34.25;
  refreshJsonEvidence(value);
  const result = evaluate(value);
  assert.equal(result.passed, true, result.failures.join('\n'));
  assert.equal(result.containedBlockingPassed, true);
  assert.equal(result.allTargetsPassed, false);
  assert.equal(result.physicsEvidencePassed, true);
  assert.equal(result.physicsPassed, false);
  assert.equal(result.marchingPassed, true);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.warnings, [
    'post-warmup cached complete-engine physics steps per second was below 30 or missing'
  ]);
  assert.deepEqual(
    result.events.map((entry) => entry.status),
    ['FAIL', 'PASS']
  );
  assert.equal(result.events[0].details.authentic, true);
  assert.match(
    result.events[0].details.evaluatorFailures.join('\n'),
    /below 30/u
  );
});

function refreshJsonEvidence(value) {
  const probeText = `${JSON.stringify(value.evidence.probe.json, null, 2)}\n`;
  Object.assign(
    value.evidence.probe,
    metadata(value.evidence.probe.path, probeText),
    { text: probeText }
  );
  value.evidence.benchmark.json.scenarios[0].rawProbeArtifact = {
    path: value.evidence.probe.path,
    byteLength: value.evidence.probe.byteLength,
    sha256: value.evidence.probe.sha256
  };
  const benchmarkText =
    `${JSON.stringify(value.evidence.benchmark.json, null, 2)}\n`;
  Object.assign(
    value.evidence.benchmark,
    metadata(value.evidence.benchmark.path, benchmarkText),
    { text: benchmarkText }
  );
  Object.assign(
    value.evidence.stdout,
    metadata(value.evidence.stdout.path, benchmarkText),
    { text: benchmarkText }
  );
  for (const key of ['stdout', 'benchmark', 'probe']) {
    const artifact = value.evidence[key];
    value.receipt.command[`${key}Artifact`] = {
      path: artifact.path,
      byteLength: artifact.byteLength,
      sha256: artifact.sha256
    };
  }
}

test('fails closed when cache and comprehensive marching telemetry are absent', () => {
  const value = fixture();
  delete value.evidence.probe.json.timeline.interactiveCacheLifecycle;
  for (const metric of value.evidence.probe.json.timeline.metrics) {
    delete metric.renderState.renderFieldBufferMode;
    delete metric.renderState.surfaceDrawExtractionPresentationCounters;
  }
  refreshJsonEvidence(value);
  const result = evaluate(value);
  assert.equal(result.passed, false);
  assert.deepEqual(
    result.events.map((entry) => entry.status),
    ['FAIL', 'FAIL']
  );
  assert.match(result.failures.join('\n'), /cache lifecycle/u);
  assert.match(result.failures.join('\n'), /zero-fallback counters/u);
});

test('rejects zero counters whose runtime-source coverage is incomplete', () => {
  const value = fixture();
  const counters = value.evidence.probe.json.timeline.metrics[1]
    .renderState.surfaceDrawExtractionPresentationCounters;
  const missing = counters.coverage.observedSourceKeys.pop();
  counters.coverage.observedSourceCount -= 1;
  counters.coverage.missingSourceKeys = [missing];
  counters.coverage.status = 'incomplete';
  counters.coverage.complete = false;
  refreshJsonEvidence(value);
  const result = evaluate(value);
  assert.equal(result.marchingPassed, false);
  assert.match(result.failures.join('\n'), /zero-fallback counters/u);
});

test('rejects lifecycle telemetry that cannot prove the same document', () => {
  const value = fixture();
  value.evidence.probe.json.timeline.interactiveCacheLifecycle
    .reset.performanceTimeOrigin = 11;
  refreshJsonEvidence(value);
  const result = evaluate(value);
  assert.equal(result.passed, false);
  assert.match(result.failures.join('\n'), /cache lifecycle telemetry/u);
});

test('rejects non-exact batch partitions and omitted settlement proof', () => {
  {
    const value = fixture();
    value.evidence.probe.json.timeline.interactiveCacheLifecycle
      .postResetMeasurement.measuredBatchIndices = [2, 4];
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /batch partition/u);
  }
  {
    const value = fixture();
    delete value.evidence.probe.json.timeline.interactiveCacheLifecycle
      .postResetMeasurement.drain;
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /settlement drain/u);
  }
  {
    const value = fixture();
    value.evidence.probe.json.timeline.interactiveCacheLifecycle
      .postResetMeasurement.terminalHandoff.status =
        'scene-terminal-consumer-incomplete';
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /terminal drain ownership/u);
  }
  {
    const value = fixture();
    delete value.evidence.probe.json.timeline.interactiveCacheLifecycle
      .reset.playbackQuiescence;
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /same-page reset/u);
  }
  {
    const value = fixture();
    value.evidence.probe.json.timeline.interactiveCacheLifecycle
      .postResetMeasurement.terminalHandoff
      .playbackQuiescence.residentPending = true;
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /terminal drain ownership/u);
  }
  {
    const value = fixture();
    value.evidence.probe.json.timeline.metrics[2]
      .probeResidentBatchTiming.backgroundSettlementStatus =
        'pending-successor-consumer';
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /settlement chain/u);
  }
});

test('rejects incomplete or nonzero authoritative readback telemetry', () => {
  {
    const value = fixture();
    delete value.evidence.probe.json.timeline.metrics[1]
      .residentSteps.fullParticleReadbackPerformed;
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /runtime readback/u);
  }
  {
    const value = fixture();
    const steps = value.evidence.probe.json.timeline.metrics[1].residentSteps;
    steps.readbackTelemetryUnknownSources = ['unclassified-map'];
    steps.observedMapAsyncCount = 1;
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /runtime readback/u);
  }
});

test('rejects pair opt-in and missing independent-v2 generation coverage', () => {
  const value = fixture();
  const scenario = value.evidence.benchmark.json.scenarios[0];
  scenario.scenarioUrl += '&schroederMechanicsFieldPairV2=1';
  scenario.schroederMechanicsFieldPairV2ConfiguredRequested = true;
  scenario.schroederMechanicsFieldPairV2Enabled = true;
  scenario.schroederMechanicsFieldConstructionMode = 'paired-v2-shared-radix';
  value.evidence.probe.json.timeline.metrics[1]
    .residentSteps.schroederSpatialEpochGenerationSummaries[0]
    .spatialEpochGeneration.mechanicsFieldConstructionMode =
      'paired-v2-shared-radix';
  refreshJsonEvidence(value);
  const result = evaluate(value);
  assert.equal(result.passed, false);
  assert.deepEqual(
    result.events.map((entry) => entry.status),
    ['FAIL', 'FAIL']
  );
  assert.match(result.failures.join('\n'), /pair query key/u);
  assert.match(result.failures.join('\n'), /every generation/u);
});

test('authenticates the separately explicit paired-v2 opt-in and never treats it as default evidence', () => {
  const value = fixture({ paired: true });
  const defaultPolicy = createInteractivePresentationCommandPolicy({
    benchmarkOutputPath: value.evidence.benchmark.path
  });
  assert.equal(
    defaultPolicy.command.environment.ULG_BENCH_SCHROEDER_MECHANICS_FIELD_PAIR_V2,
    undefined
  );
  assert.equal(
    value.policy.command.environment.ULG_BENCH_SCHROEDER_MECHANICS_FIELD_PAIR_V2,
    '1'
  );
  assert.notEqual(value.policy.commandPolicySha256, defaultPolicy.commandPolicySha256);
  const paired = evaluatePairedV2OptInInteractivePresentationReceipt(
    value.receipt,
    {
      expectedPolicy: value.policy,
      currentFingerprint: value.sourceFingerprint,
      artifactEvidence: value.evidence
    }
  );
  assert.equal(paired.passed, true, paired.failures.join('\n'));
  assert.equal(
    value.policy.command.environment.ULG_BENCH_DURABLE_RELEASE_PUBLICATION,
    '1'
  );
  const defaultResult = evaluateInteractivePresentationReceipt(value.receipt, {
    currentFingerprint: value.sourceFingerprint,
    artifactEvidence: value.evidence
  });
  assert.equal(defaultResult.passed, false);
  assert.match(defaultResult.failures.join('\n'), /command policy mismatch/u);
});

test('interactive evaluator binds the benchmark durable-publication attestation', () => {
  const value = fixture();
  value.evidence.benchmark.json.durableReleasePublication = false;
  refreshJsonEvidence(value);
  const result = evaluate(value);
  assert.equal(result.passed, false);
  assert.match(
    result.failures.join('\n'),
    /durable release publication binding mismatch/
  );
});

test('requires installed native queue-fence tracing with no cached hot-loop growth', () => {
  for (const mutate of [
    (metric) => { metric.renderState.nativeQueueFenceTraceInstalled = false; },
    (metric) => { metric.renderState.nativeQueueFenceTotal = 1; },
    (metric) => { metric.renderState.nativeQueueFenceTally = { callsite: 1 }; }
  ]) {
    const value = fixture();
    mutate(value.evidence.probe.json.timeline.metrics[1]);
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /queue-fence trace/u);
  }
});

test('accepts stable cold synchronization counters and rejects measured growth', () => {
  {
    const value = fixture();
    for (const metric of value.evidence.probe.json.timeline.metrics) {
      metric.renderState.nativeBufferMapTally = {
        'cold-optical-parity': 2
      };
      metric.renderState.nativeQueueFenceTally = {
        'cold-reset-retirement': 12
      };
      metric.renderState.nativeQueueFenceTotal = 12;
    }
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, true, result.failures.join('\n'));
  }
  {
    const value = fixture();
    for (const metric of value.evidence.probe.json.timeline.metrics) {
      metric.renderState.nativeBufferMapTally = {
        'cold-optical-parity': 2
      };
    }
    value.evidence.probe.json.timeline.metrics[2]
      .renderState.nativeBufferMapTally['hot-loop-readback'] = 1;
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /runtime readback grew/u);
  }
});

test('queue-fence tracing publishes the exact metric witness only after wrapping', async () => {
  const source = await readFile(
    new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
    'utf8'
  );
  const wrapperOffset = source.indexOf(
    "Object.defineProperty(prototype, 'onSubmittedWorkDone',"
  );
  const witnessOffset = source.indexOf(
    'globalThis.__ulgQueueFenceTraceInstalled = true;',
    wrapperOffset
  );
  assert.ok(wrapperOffset >= 0);
  assert.ok(witnessOffset > wrapperOffset);
  assert.match(
    source,
    /nativeQueueFenceTraceInstalled:\s*\n?\s*globalThis\.__ulgQueueFenceTraceInstalled === true/u
  );
});

test('paired-v2 CLI mode remains opt-in while preserving the independent default', () => {
  assert.deepEqual(
    parseInteractivePresentationReceiptCliArgs(['receipt.json', 'artifacts']),
    {
      route: 'independent-v2-default',
      receiptPath: 'receipt.json',
      artifactDir: 'artifacts'
    }
  );
  assert.deepEqual(
    parseInteractivePresentationReceiptCliArgs([
      '--paired-v2-opt-in',
      'paired-receipt.json',
      'paired-artifacts'
    ]),
    {
      route: 'paired-v2-opt-in',
      receiptPath: 'paired-receipt.json',
      artifactDir: 'paired-artifacts'
    }
  );
  assert.throws(
    () => parseInteractivePresentationReceiptCliArgs(['--paired-v2-opt-in']),
    /Usage:/u
  );
});

test('long-horizon browser paths own cleanup from launch through close failure', async () => {
  const source = await readFile(
    new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
    'utf8'
  );
  assert.match(source, /async function closeOwnedProbeBrowser\(browser\)/u);
  assert.equal(
    (source.match(/browser = await launchProbeBrowser\(\);/gu) ?? []).length,
    2
  );
  assert.equal(
    (source.match(/if \(browser !== null\) \{/gu) ?? []).length >= 2,
    true
  );
  assert.equal(
    (source.match(/await closeOwnedProbeBrowser\(browser\);/gu) ?? []).length,
    2
  );
  assert.doesNotMatch(source, /browser\.close\(\)\.catch\(\(\) => null\)/u);
});

test('rejects artifact tampering and exact source drift', () => {
  {
    const value = fixture();
    value.evidence.probe.sha256 = 'f'.repeat(64);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /probe artifact mismatch/u);
  }
  {
    const value = fixture();
    value.sourceFingerprint = fingerprint('b');
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(
      result.failures.join('\n'),
      /exact worktree fingerprint changed/u
    );
  }
});

test('rejects readback regressions and non-advancing native frames', () => {
  {
    const value = fixture();
    const state = value.evidence.probe.json.timeline.metrics[1].renderState;
    state.renderRowsReadback = true;
    state.renderRowsReadbackByteLength = 4096;
    state.nativeBufferMapTally = { 'surface-readback': 1 };
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.deepEqual(
      result.events.map((entry) => entry.status),
      ['FAIL', 'FAIL']
    );
    assert.match(result.failures.join('\n'), /runtime readback/u);
  }
  {
    const value = fixture();
    value.evidence.probe.json.timeline
      .nativeSurfaceDrawIndirectArgsValidation = {
        status: 'passed',
        readbackByteLength: 16,
        mapAsyncCount: 1
      };
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.passed, false);
    assert.match(result.failures.join('\n'), /post-probe GPU readback/u);
  }
  {
    const value = fixture();
    value.evidence.probe.json.timeline.metrics[2]
      .renderState.surfaceDrawRenderBridgeFrameCount = 6;
    value.evidence.probe.json.timeline.metrics[2]
      .renderState.surfaceDrawRenderBridgeUpdateCount = 2;
    value.evidence.benchmark.json.scenarios[0]
      .surfaceDrawRenderBridgeFrameCount = 6;
    value.evidence.benchmark.json.scenarios[0]
      .surfaceDrawRenderBridgeUpdateCount = 2;
    refreshJsonEvidence(value);
    const result = evaluate(value);
    assert.equal(result.physicsPassed, true);
    assert.equal(result.marchingPassed, false);
    assert.deepEqual(
      result.events.map((entry) => entry.status),
      ['PASS', 'FAIL']
    );
    assert.match(result.failures.join('\n'), /did not grow/u);
  }
});

function runGit(repoDir, args) {
  return execFileSync('git', ['-C', repoDir, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

test('producer prewrites failure and authenticates only external artifacts', async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'ulg-interactive-producer-')
  );
  const repoDir = path.join(root, 'repo');
  const artifactDir = path.join(root, 'artifacts');
  const receiptPath = path.join(artifactDir, 'receipt.json');
  try {
    await mkdir(repoDir, { recursive: true });
    await writeFile(path.join(repoDir, 'README.md'), 'fixture\n');
    runGit(repoDir, ['init', '-q']);
    runGit(repoDir, ['config', 'user.email', 'release@example.invalid']);
    runGit(repoDir, ['config', 'user.name', 'Release Test']);
    runGit(repoDir, ['add', '.']);
    runGit(repoDir, ['commit', '-qm', 'fixture']);
    await mkdir(artifactDir, { recursive: true, mode: 0o700 });
    const forgedReceipt = '{"status":"forged-pass"}\n';
    await writeFile(receiptPath, forgedReceipt);
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir
    });

    const processRunner = async ({
      executable,
      args,
      cwd,
      env,
      stdoutPath,
      stderrPath
    }) => {
      assert.equal(executable, process.execPath);
      assert.deepEqual(args, ['scripts/sph-performance-benchmark.mjs']);
      assert.equal(cwd, repoDir);
      assert.equal(
        Object.hasOwn(
          env,
          'ULG_BENCH_SCHROEDER_MECHANICS_FIELD_PAIR_V2'
        ),
        false
      );
      assert.equal(env.ULG_PROBE_HEADLESS, '0');
      assert.equal(env.ULG_PROBE_CHROMIUM_EXECUTABLE, '/usr/bin/google-chrome');
      assert.equal(
        env.ULG_PROBE_CHROMIUM_ARGS,
        '--ignore-gpu-blocklist --ozone-platform=x11 '
          + '--window-position=-10000,-10000 --window-size=320,240'
      );
      assert.equal(env.ULG_BENCH_INTERACTIVE_CACHE_LIFECYCLE, '1');
      assert.equal(env.ULG_BENCH_DURABLE_RELEASE_PUBLICATION, '1');
      assert.equal(env.ULG_PROBE_CAPTURE_FRAMES, '0');
      assert.equal(Object.hasOwn(env, 'NODE_OPTIONS'), false);
      assert.equal(path.relative(repoDir, env.ULG_BENCH_OUTPUT).startsWith('..'), true);

      const probePath = path.join(artifactDir, 'owned-probe.json');
      const probe = probeDocument();
      const probeText = `${JSON.stringify(probe, null, 2)}\n`;
      await writeFile(probePath, probeText);
      const probeArtifact = metadata(probePath, probeText);
      const report = {
        schema: 'peercompute.ulg.sph-performance-benchmark.v0',
        status: 'complete',
        durableReleasePublication: true,
        performanceGate: { status: 'pass' },
        schroederMechanicsFieldPairV2Requested: false,
        scenarios: [scenarioDocument(probeArtifact)]
      };
      const reportText = `${JSON.stringify(report, null, 2)}\n`;
      await mkdir(path.dirname(env.ULG_BENCH_OUTPUT), { recursive: true });
      await Promise.all([
        writeFile(env.ULG_BENCH_OUTPUT, reportText),
        writeFile(stdoutPath, reportText),
        writeFile(stderrPath, '')
      ]);
      return {
        exitCode: 0,
        signal: null,
        spawnError: null,
        stdoutArtifact: metadata(stdoutPath, reportText),
        stderrArtifact: metadata(stderrPath, '')
      };
    };

    await assert.rejects(
      runInteractivePresentationReceipt({
        receiptPath,
        artifactDir,
        repoDir,
        fixtureCapability,
        fixtureProcessRunner: processRunner
      }),
      /already exists and will not be replaced/u
    );
    assert.equal(await readFile(receiptPath, 'utf8'), forgedReceipt);

    const successfulReceiptPath = path.join(artifactDir, 'successful-receipt.json');
    const result = await runInteractivePresentationReceipt({
      receiptPath: successfulReceiptPath,
      artifactDir,
      repoDir,
      fixtureCapability,
      fixtureProcessRunner: processRunner
    });
    assert.equal(result.receipt.status, 'complete');
    assert.equal(result.evaluation.passed, true, result.evaluation.failures.join('\n'));
    const written = JSON.parse(await readFile(successfulReceiptPath, 'utf8'));
    assert.equal(written.status, 'complete');
    for (const key of [
      'stdoutArtifact',
      'stderrArtifact',
      'benchmarkArtifact',
      'probeArtifact'
    ]) {
      assert.equal(
        path.relative(repoDir, written.command[key].path).startsWith('..'),
        true
      );
      assert.match(written.command[key].sha256, /^[0-9a-f]{64}$/u);
    }
    const consumed = await readAndEvaluateInteractivePresentationReceipt({
      receiptPath: successfulReceiptPath,
      repoDir
    });
    assert.equal(consumed.evaluation.passed, true);
    await writeFile(path.join(repoDir, 'README.md'), 'fixture mutated\n');
    const stale = await readAndEvaluateInteractivePresentationReceipt({
      receiptPath: successfulReceiptPath,
      repoDir
    });
    assert.equal(stale.evaluation.passed, false);
    assert.match(stale.evaluation.failures.join('\n'), /exact worktree fingerprint changed/u);

    const failedReceiptPath = path.join(
      artifactDir,
      'semantic-failure-receipt.json'
    );
    const semanticFailureRunner = async (options) => {
      const executed = await processRunner(options);
      const report = JSON.parse(
        await readFile(options.env.ULG_BENCH_OUTPUT, 'utf8')
      );
      report.scenarios[0].physicsStepsPerSecond = 1;
      report.scenarios[0].probeEngineBatchMs = 1000;
      const reportText = `${JSON.stringify(report, null, 2)}\n`;
      await Promise.all([
        writeFile(options.env.ULG_BENCH_OUTPUT, reportText),
        writeFile(options.stdoutPath, reportText)
      ]);
      return {
        ...executed,
        stdoutArtifact: metadata(options.stdoutPath, reportText)
      };
    };
    const failedResult = await runInteractivePresentationReceipt({
      receiptPath: failedReceiptPath,
      artifactDir,
      repoDir,
      fixtureCapability,
      fixtureProcessRunner: semanticFailureRunner
    });
    assert.equal(failedResult.evaluation.passed, false);
    assert.equal(failedResult.receipt.status, 'failed');
    assert.match(
      failedResult.receipt.reason,
      /semantic evaluation failed/u
    );
    const failedWritten = JSON.parse(
      await readFile(failedReceiptPath, 'utf8')
    );
    assert.equal(failedWritten.status, 'failed');
    assert.ok(failedWritten.semanticEvaluationFailures.length > 0);

    let collisionRunnerCalled = false;
    const collisionArtifactDir = path.join(root, 'collision-artifacts');
    await mkdir(collisionArtifactDir, { recursive: true, mode: 0o700 });
    const collisionReceiptPath = path.join(
      collisionArtifactDir,
      'interactive-benchmark.json'
    );
    await assert.rejects(
      runInteractivePresentationReceipt({
        receiptPath: collisionReceiptPath,
        artifactDir: collisionArtifactDir,
        repoDir,
        fixtureCapability,
        fixtureProcessRunner: async () => {
          collisionRunnerCalled = true;
          throw new Error('collision runner must not execute');
        }
      }),
      /collides with/u
    );
    assert.equal(collisionRunnerCalled, false);
    await assert.rejects(readFile(collisionReceiptPath, 'utf8'), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('paired-v2 producer route invokes its route-bound command through the fixture runner', async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'ulg-interactive-paired-producer-')
  );
  const repoDir = path.join(root, 'repo');
  const artifactDir = path.join(root, 'paired-artifacts');
  const receiptPath = path.join(artifactDir, 'paired-receipt.json');
  try {
    await mkdir(repoDir, { recursive: true });
    await writeFile(path.join(repoDir, 'README.md'), 'fixture\n');
    runGit(repoDir, ['init', '-q']);
    runGit(repoDir, ['config', 'user.email', 'release@example.invalid']);
    runGit(repoDir, ['config', 'user.name', 'Release Test']);
    runGit(repoDir, ['add', '.']);
    runGit(repoDir, ['commit', '-qm', 'fixture']);
    await mkdir(artifactDir, { recursive: true, mode: 0o700 });
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir
    });
    const pairedFixture = fixture({ root: artifactDir, paired: true });
    let observedEnvironment = null;
    const result = await runPairedV2OptInInteractivePresentationReceipt({
      receiptPath,
      artifactDir,
      repoDir,
      fixtureCapability,
      fixtureProcessRunner: async ({
        executable,
        args,
        cwd,
        env,
        stdoutPath,
        stderrPath
      }) => {
        observedEnvironment = { ...env };
        assert.equal(executable, process.execPath);
        assert.deepEqual(args, ['scripts/sph-performance-benchmark.mjs']);
        assert.equal(cwd, repoDir);
        assert.equal(env.ULG_BENCH_SCHROEDER_MECHANICS_FIELD_PAIR_V2, '1');
        assert.equal(env.ULG_BENCH_DURABLE_RELEASE_PUBLICATION, '1');
        assert.match(
          path.basename(env.ULG_BENCH_OUTPUT),
          /^interactive-benchmark\.paired-v2-opt-in\.json$/u
        );
        await Promise.all([
          writeFile(pairedFixture.evidence.probe.path, pairedFixture.evidence.probe.text),
          writeFile(env.ULG_BENCH_OUTPUT, pairedFixture.evidence.benchmark.text),
          writeFile(stdoutPath, pairedFixture.evidence.benchmark.text),
          writeFile(stderrPath, '')
        ]);
        return {
          exitCode: 0,
          signal: null,
          spawnError: null,
          stdoutArtifact: metadata(stdoutPath, pairedFixture.evidence.benchmark.text),
          stderrArtifact: metadata(stderrPath, '')
        };
      }
    });
    assert.equal(result.receipt.status, 'complete');
    assert.equal(result.evaluation.passed, true, result.evaluation.failures.join('\n'));
    assert.equal(
      observedEnvironment.ULG_BENCH_SCHROEDER_MECHANICS_FIELD_PAIR_V2,
      '1'
    );
    const independentPolicy = createInteractivePresentationCommandPolicy({
      benchmarkOutputPath: path.join(artifactDir, 'interactive-benchmark.json')
    });
    assert.notEqual(
      result.receipt.commandPolicy.commandPolicySha256,
      independentPolicy.commandPolicySha256
    );
    assert.match(
      path.basename(result.receipt.command.benchmarkArtifact.path),
      /^interactive-benchmark\.paired-v2-opt-in\.json$/u
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
