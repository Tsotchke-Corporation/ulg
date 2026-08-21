#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  SS_CONTAINED_POLICY_TRACK,
  assertArtifactPathsPairwiseDistinct,
  artifactMetadataMatches,
  assertNonProductionFixtureCapability,
  canonicalJson,
  canonicalJsonSha256,
  createFailSentinelWriter,
  exactWorktreeFingerprint,
  exactWorktreeFingerprintsEqual,
  readHashedArtifact,
  runProcessToArtifacts,
  scrubReleaseEvidenceChildEnvironment
} from './ss-release-evidence-common.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRepoDir = path.resolve(scriptDir, '..');

export const INTERACTIVE_PRESENTATION_RECEIPT_SCHEMA =
  'peercompute.ulg.stage6-interactive-presentation-receipt.v1';
export const INTERACTIVE_PRESENTATION_COMMAND_POLICY_SCHEMA =
  'peercompute.ulg.stage6-interactive-presentation-command-policy.v1';
export const INTERACTIVE_PRESENTATION_POLICY_ID =
  'stage6-contained-default-off-cached-native-presentation-v2';
export const INTERACTIVE_CACHE_LIFECYCLE_SCHEMA =
  'peercompute.ulg.sph-interactive-cache-lifecycle.v1';
const INTERACTIVE_CACHE_TERMINAL_HANDOFF_SCHEMA =
  'peercompute.ulg.sph-interactive-cache-terminal-handoff.v1';
const INTERACTIVE_CACHE_TERMINAL_HANDOFF_CONTRACT =
  'queue-ordered-overlay-clear-final-consumer-before-resident-artifact-retirement';
export const EXTRACTION_PRESENTATION_COUNTERS_SCHEMA =
  'peercompute.ulg.sph-extraction-presentation-counters.v1';

export const EXTRACTION_PRESENTATION_COUNTER_SOURCE_KEYS = Object.freeze([
  'renderFieldCpuFallbackGeometryAvailable',
  'surfaceDrawVisibleRenderSource',
  'surfaceDrawDiagnosticFallbackReason',
  'renderFieldReadback',
  'renderRowsReadback',
  'surfaceDrawReadback',
  'fullSurfaceDrawReadback',
  'renderFieldSurfaceSummaryReadback',
  'surfaceDrawSummaryReadback',
  'surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated',
  'surfaceDrawNativeMarchingCubesExtractionStatus',
  'surfaceDrawNativeMarchingCubesExtractionErrorName',
  'surfaceDrawNativeMarchingCubesExtractionErrorStatus',
  'surfaceDrawNativeMarchingCubesExtractionErrorStage',
  'surfaceDrawNativeMarchingCubesExtractionErrorStack',
  'surfaceDrawExtensionSurfaceAdapterExecutionStatus',
  'surfaceDrawExtensionSurfaceRawExecutionStatus',
  'surfaceDrawRenderBridgeStatus',
  'surfaceDrawRenderBridgeReason',
  'surfaceDrawRenderBridgeLastRenderStatus',
  'surfaceDrawRenderBridgeLastRenderSkipReason',
  'surfaceDrawRenderBridgeDeviceLost',
  'surfaceDrawVisibleGpuConsumerStatus',
  'surfaceDrawVisibleGpuConsumerReason',
  'surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationStatus',
  'surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationReason'
]);

export const INTERACTIVE_PRESENTATION_EVENT_NAMES = Object.freeze({
  physics: 'physics_steps_per_second_at_least_30_on_cached_run',
  marching: 'webgpu_marching_cubes_active'
});

const INTERACTIVE_ROUTE = Object.freeze({
  independent: 'independent-v2-default',
  paired: 'paired-v2-opt-in'
});

const PAIRED_V2_OPT_IN_CLI_FLAG = '--paired-v2-opt-in';

const PAIR_ROUTE_KEYS = Object.freeze([
  'schroederMechanicsFieldPairV2',
  'schroederMechanicsFieldPair',
  'schroederPairV2',
  'mechanicsFieldPairV2'
]);

const REQUIRED_CHROMIUM_ARGS = Object.freeze([
  '--enable-unsafe-webgpu',
  '--use-angle=vulkan',
  '--enable-features=Vulkan,UseSkiaRenderer',
  '--ignore-gpu-blocklist',
  '--ozone-platform=x11',
  '--window-position=-10000,-10000',
  '--window-size=320,240'
]);

const OWNED_PRESENTATION_CHROMIUM_ARGS = Object.freeze(
  REQUIRED_CHROMIUM_ARGS.slice(3)
);

const REQUIRED_ZERO_COUNTERS = Object.freeze([
  'cpuSurfaceFallbackCount',
  'diagnosticFallbackCount',
  'fullReadbackCount',
  'summaryReadbackCount',
  'nativeReadbackFallbackCount',
  'surfaceExtractionErrorCount',
  'presentationErrorCount'
]);

const TRANSLATION_EXECUTION_ROUTE = Object.freeze({
  pipeline: 'translation-pipeline',
  extensionDrawIndirectBypass: 'extension-draw-indirect-bypass'
});

const TRANSLATION_PIPELINE_CACHE_STATUS = Object.freeze({
  miss: 'pipeline-cache-miss',
  hit: 'pipeline-cache-hit',
  extensionDrawIndirectBypass: 'skipped-extension-draw-indirect-buffer'
});

const GPU_FAILURE_PATTERNS = Object.freeze([
  /\bGPU(?:Validation|Internal|OutOfMemory)Error\b/iu,
  /\bWebGPU adapter (?:unavailable|unsupported)\b/iu,
  /\bdevice (?:lost|loss)\b/iu,
  /\bInvalid (?:Buffer|BindGroup|CommandBuffer)\b/iu,
  /\bError while parsing WGSL\b/iu,
  /\bvkAllocateMemory failed\b/iu
]);

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegativeInteger(value) {
  const number = finiteNumber(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function exactNonNegativeInteger(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    ? value
    : null;
}

function exactNativeStructuralPresentationAdmission(state) {
  const activeGeneration = exactNonNegativeInteger(
    state?.surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration
  );
  const candidateGeneration = exactNonNegativeInteger(
    state
      ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration
  );
  const submittedDrawCount = exactNonNegativeInteger(
    state
      ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount
  );
  return state
      ?.surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted
        === true
    && state
      ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus
        === 'passed'
    && state?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind
      === 'same-queue-private-staged-composite-submission'
    && state
      ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary
        === true
    && submittedDrawCount !== null
    && submittedDrawCount > 0
    && activeGeneration !== null
    && candidateGeneration === activeGeneration;
}

function exactNativeForegroundPixelProof(state) {
  const activeGeneration = exactNonNegativeInteger(
    state?.surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration
  );
  const offscreenGeneration = exactNonNegativeInteger(
    state
      ?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration
  );
  const offscreenPixelCount = exactNonNegativeInteger(
    state
      ?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationNonzeroPixelCount
  );
  const browserGeneration = exactNonNegativeInteger(
    state
      ?.surfaceDrawVisibleGpuConsumerNativePixelValidationResourceGeneration
  );
  const browserPixelCount = exactNonNegativeInteger(
    state
      ?.surfaceDrawVisibleGpuConsumerNativePixelValidationNonzeroPixelCount
  );
  const offscreenProof = Boolean(
    state?.surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated === true
    && state?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus
      === 'passed'
    && offscreenPixelCount !== null
    && offscreenPixelCount > 0
    && activeGeneration !== null
    && offscreenGeneration === activeGeneration
  );
  const browserProof = Boolean(
    state?.surfaceDrawVisibleGpuConsumerBrowserFrameForegroundValidated === true
    && state?.surfaceDrawVisibleGpuConsumerPixelValidationStatus === 'passed'
    && /browser-frame|playwright.*compositor|composited-frame/iu.test(
      String(
        state?.surfaceDrawVisibleGpuConsumerNativePixelValidationSource ?? ''
      )
    )
    && browserPixelCount !== null
    && browserPixelCount > 0
    && activeGeneration !== null
    && browserGeneration === activeGeneration
  );
  return state?.surfaceDrawVisibleGpuConsumerForegroundProofValidated === true
    && (offscreenProof || browserProof);
}

function exactNativePresentationAdmission(state) {
  const structuralAdmission = exactNativeStructuralPresentationAdmission(state);
  const foregroundPixelProof = exactNativeForegroundPixelProof(state);
  return state?.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted === true
    && state
      ?.surfaceDrawVisibleGpuConsumerSameQueueForegroundSubmissionValidated
        === false
    && state?.surfaceDrawVisibleGpuConsumerForegroundProofValidated
      === foregroundPixelProof
    && (structuralAdmission || foregroundPixelProof);
}

function positiveNumber(value) {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : null;
}

function validPlaybackQuiescence(
  evidence,
  { terminal = false, reason } = {}
) {
  return evidence?.schema
      === 'peercompute.ulg.sph-interactive-playback-quiescence.v0'
    && evidence?.status === 'resident-playback-quiescent'
    && evidence?.reason === reason
    && ['Play', 'Pause'].includes(evidence?.initialButtonText)
    && evidence?.finalButtonText === 'Play'
    && evidence?.pauseRequested
      === (evidence.initialButtonText === 'Pause')
    && evidence?.residentPending === false
    && nonNegativeInteger(evidence?.stableFrameCount) >= 2
    && (terminal
      ? nonNegativeInteger(evidence?.completedStepCount) === 1
      : nonNegativeInteger(evidence?.completedStepCount) >= 1)
    && finiteNumber(evidence?.elapsedMs) !== null
    && Number(evidence.elapsedMs) >= 0;
}

function approximatelyEqual(left, right) {
  const a = finiteNumber(left);
  const b = finiteNumber(right);
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= Math.max(1e-9, Math.abs(a) * 1e-9);
}

function strictlyIncreasing(values) {
  return values.length > 1
    && values.every((value, index) => (
      finiteNumber(value) !== null
      && (index === 0 || Number(value) > Number(values[index - 1]))
    ));
}

function gpuFailureLines(...texts) {
  return texts
    .flatMap((text) => String(text ?? '').split(/\r?\n/u))
    .map((line) => line.trim())
    .filter((line) => (
      line.length > 0
      && GPU_FAILURE_PATTERNS.some((pattern) => pattern.test(line))
    ));
}

function commandEnvironment(benchmarkOutputPath, route) {
  return Object.freeze({
    ULG_BENCH_OUTPUT: path.resolve(benchmarkOutputPath),
    ULG_BENCH_DURABLE_RELEASE_PUBLICATION: '1',
    ULG_BENCH_PROFILE: 'smoke',
    ULG_BENCH_PARTICLE_COUNTS: '1000',
    ULG_BENCH_BATCHES: '3',
    ULG_BENCH_BATCH_STEPS: '1',
    ULG_BENCH_INTERACTIVE_CACHE_LIFECYCLE: '1',
    ULG_BENCH_PROBE_MODE: 'scene',
    ULG_BENCH_SURFACE_DRAW_MODE: 'native-webgpu-surface-consumer',
    ULG_BENCH_COMPACT_SUMMARY_MODE: 'none',
    ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE: 'final-only',
    ULG_BENCH_FUSE_RESIDENT_MECHANICS_SEQUENCE: '1',
    ULG_BENCH_FUSE_RESIDENT_ACTIVE_GRID: '1',
    ULG_BENCH_SCHROEDER_SIMULATION: '1',
    ULG_BENCH_SCHROEDER_LEVEL: '0',
    ULG_BENCH_SCHROEDER_MAX_LEVEL: '1',
    ULG_BENCH_SCHROEDER_CROSS_LEVEL_COUPLING: '1',
    ULG_BENCH_SCHROEDER_TWO_LEVEL: '1',
    ULG_BENCH_SCHROEDER_TWO_LEVEL_AUTHORITY: 'authoritative',
    ULG_BENCH_SCHROEDER_TWO_LEVEL_SUBSTEPS: '2',
    ULG_BENCH_LAW_THERMAL: '1',
    ULG_BENCH_LAW_REACTIONS: '1',
    ULG_BENCH_LAW_VISCOSITY: '1',
    ULG_BENCH_LAW_SURFACE_TENSION: '0',
    ULG_BENCH_MAX_READBACK_BYTES_PER_STEP: '0',
    ULG_BENCH_MEASURE_GPU_QUEUE_FENCE: '0',
    ULG_BENCH_MEASURE_GPU_TIMESTAMPS: '0',
    ULG_BENCH_MEASURE_GPU_STAGE_TIMESTAMPS: '0',
    ULG_BENCH_MATERIAL_INTERFACE_DIAGNOSTIC: '0',
    ULG_BENCH_CAPTURE_THERMAL_CSR_ROUTE_EVIDENCE: '0',
    ULG_BENCH_FAIL_ON_ERROR: '1',
    // Chrome's Linux headless Vulkan path can execute WebGPU compute while
    // failing to create the compositor surface. That produces truthful GPU
    // telemetry but no inspectable presented pixels. Use an isolated,
    // off-screen X11 window so the signed presentation receipt proves the
    // same native surface that a headed browser actually presents.
    ULG_PROBE_HEADLESS: '0',
    ULG_PROBE_CHROMIUM_EXECUTABLE: '/usr/bin/google-chrome',
    ULG_PROBE_CHROMIUM_ARGS: OWNED_PRESENTATION_CHROMIUM_ARGS.join(' '),
    ULG_PROBE_CAPTURE_FRAMES: '0',
    ULG_PROBE_FRAME_EVERY: '1',
    ULG_PROBE_FRAME_MAX: '8',
    ULG_PROBE_ARTIFACT_DETAIL_MODE: 'full',
    ULG_PROBE_TRACE_NATIVE_BUFFER_MAP: '1',
    ULG_PROBE_TRACE_NATIVE_QUEUE_FENCES: '1',
    ULG_PROBE_ANOMALY_ROW_READBACK: '0',
    ULG_PROBE_RESIDENT_BUFFER_DEBUG: '0',
    ...(route === INTERACTIVE_ROUTE.paired
      ? { ULG_BENCH_SCHROEDER_MECHANICS_FIELD_PAIR_V2: '1' }
      : {})
  });
}

/**
 * Pin the audited scene benchmark. The policy intentionally does not claim
 * that the current benchmark implements the cache lifecycle contract below:
 * the authenticated artifact must contain that evidence or evaluation fails.
 */
export function createInteractivePresentationCommandPolicy({
  benchmarkOutputPath,
  route = INTERACTIVE_ROUTE.independent
}) {
  if (typeof benchmarkOutputPath !== 'string' || benchmarkOutputPath.length === 0) {
    throw new TypeError('benchmarkOutputPath must be a non-empty string');
  }
  if (!Object.values(INTERACTIVE_ROUTE).includes(route)) {
    throw new RangeError('interactive presentation route is unsupported');
  }
  const paired = route === INTERACTIVE_ROUTE.paired;
  const command = Object.freeze({
    executable: 'node',
    args: Object.freeze(['scripts/sph-performance-benchmark.mjs']),
    environment: commandEnvironment(benchmarkOutputPath, route)
  });
  const core = {
    schema: INTERACTIVE_PRESENTATION_COMMAND_POLICY_SCHEMA,
    policyId: INTERACTIVE_PRESENTATION_POLICY_ID,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    unsetEnvironmentPrefixes: Object.freeze(['ULG_BENCH_', 'ULG_PROBE_']),
    unsetEnvironmentNames: Object.freeze(['NODE_OPTIONS']),
    command,
    browserOwnership: Object.freeze({
      mode: 'isolated-child-owned-offscreen-x11-browser',
      headless: false,
      presentationSurface: 'x11-offscreen-window',
      windowPosition: Object.freeze([-10000, -10000]),
      windowSize: Object.freeze([320, 240]),
      executablePath: '/usr/bin/google-chrome',
      requiredArgs: REQUIRED_CHROMIUM_ARGS,
      closeScope: 'only-the-browser-launched-by-the-probe',
      userBrowserTerminationForbidden: true
    }),
    routeContract: Object.freeze({
      route,
      configuredMechanicsFieldPairV2Requested: paired,
      observedMechanicsFieldPairV2Enabled: paired,
      observedMechanicsFieldConstructionMode: paired
        ? 'paired-v2-shared-radix'
        : 'independent-v2',
      requiredQueryKey: paired ? 'schroederMechanicsFieldPairV2' : null,
      forbiddenQueryKeys: paired
        ? PAIR_ROUTE_KEYS.filter((key) => key !== 'schroederMechanicsFieldPairV2')
        : PAIR_ROUTE_KEYS
    }),
    cacheContract: Object.freeze({
      schema: INTERACTIVE_CACHE_LIFECYCLE_SCHEMA,
      sameBrowserProcess: true,
      sameBrowserContext: true,
      samePage: true,
      resetControl: 'sph-reset',
      resetNavigationAllowed: false,
      requiredStaticTableCount: 4,
      requiredGpuWarmupCount: 1,
      requiredStaticTableHitCount: 4,
      postResetWarmupBatchCount: 1,
      measuredBatchCount: 2,
      postResetWarmupBatchIndices: Object.freeze([1]),
      postResetMeasuredBatchIndices: Object.freeze([2, 3]),
      terminalDrainSuccessorBatchIndex: 4,
      terminalHandoffSchema: INTERACTIVE_CACHE_TERMINAL_HANDOFF_SCHEMA,
      terminalHandoffStatus: 'scene-terminal-consumer-settled',
      terminalHandoffMethod: 'scene-api-dispose',
      terminalHandoffContract: INTERACTIVE_CACHE_TERMINAL_HANDOFF_CONTRACT
    }),
    performanceContract: Object.freeze({
      metricSource: 'complete-engine-batch',
      minimumPhysicsStepsPerSecond: 30
    }),
    synchronizationContract: Object.freeze({
      scope: 'post-reset-cached-hot-loop',
      baselineMeasurementClass: 'post-reset-warmup',
      measuredMeasurementClass: 'post-reset-measured',
      requireNativeMapTallyGrowth: 0,
      requireNativeQueueFenceTallyGrowth: 0,
      requireNativeQueueFenceTotalGrowth: 0
    }),
    presentationContract: Object.freeze({
      bridge: 'native-webgpu-surface-consumer',
      inputLayout: 'webgpu-marching-cubes-compact-position-rows',
      renderFieldBufferMode:
        'native-marching-cubes-buffer-volume-extracted',
      adapterCacheStatusAfterWarmup:
        'native-marching-cubes-adapter-cache-hit',
      translationPipelineCacheStatusAfterWarmup:
        TRANSLATION_PIPELINE_CACHE_STATUS.hit,
      translationExecutionRoutes: Object.freeze([
        TRANSLATION_EXECUTION_ROUTE.pipeline,
        TRANSLATION_EXECUTION_ROUTE.extensionDrawIndirectBypass
      ]),
      translationExtensionDrawIndirectBypassStatus:
        TRANSLATION_PIPELINE_CACHE_STATUS.extensionDrawIndirectBypass,
      requiredMeasuredPresentedFrames: 2,
      countersSchema: EXTRACTION_PRESENTATION_COUNTERS_SCHEMA,
      requiredZeroCounters: REQUIRED_ZERO_COUNTERS
    })
  };
  return Object.freeze({
    ...core,
    commandPolicySha256: canonicalJsonSha256(core)
  });
}

function addFailure(failures, condition, message) {
  if (!condition) failures.push(message);
  return condition;
}

function parseScenarioUrl(value) {
  try {
    return new URL(String(value ?? ''), 'https://benchmark.invalid');
  } catch {
    return null;
  }
}

function validateRoute({
  report,
  scenario,
  residentMetrics,
  policy,
  failures
}) {
  const contract = policy.routeContract;
  const paired = contract.route === INTERACTIVE_ROUTE.paired;
  const url = parseScenarioUrl(scenario?.scenarioUrl);
  const expected = {
    ss: '1',
    schroederLevel: '0',
    schroederMaxLevel: '1',
    schroederCrossLevelCoupling: '1',
    schroederTwoLevel: '1',
    schroederTwoLevelAuthority: 'authoritative',
    schroederTwoLevelSubsteps: '2',
    surfaceDraw: 'native-webgpu-surface-consumer'
  };
  addFailure(
    failures,
    Boolean(url) && Object.entries(expected).every(
      ([key, value]) => url.searchParams.get(key) === value
    ),
    `${contract.route} route query mismatch`
  );
  addFailure(
    failures,
    Boolean(url)
      && (paired
        ? url.searchParams.get(contract.requiredQueryKey) === '1'
          && contract.forbiddenQueryKeys.every((key) => !url.searchParams.has(key))
        : contract.forbiddenQueryKeys.every((key) => !url.searchParams.has(key))),
    paired
      ? 'paired-v2 opt-in query telemetry mismatch'
      : 'mechanics-field pair query key must be absent'
  );
  addFailure(
    failures,
    report?.schroederMechanicsFieldPairV2Requested
        === contract.configuredMechanicsFieldPairV2Requested
      && scenario?.schroederMechanicsFieldPairV2ConfiguredRequested
        === contract.configuredMechanicsFieldPairV2Requested
      && scenario?.schroederMechanicsFieldPairV2Enabled
        === contract.observedMechanicsFieldPairV2Enabled
      && scenario?.schroederMechanicsFieldConstructionMode
        === contract.observedMechanicsFieldConstructionMode
      && scenario?.schroederMechanicsFieldPairV2CoverageComplete === true,
    `${contract.route} summary telemetry mismatch`
  );
  const generations = residentMetrics.flatMap((metric) => (
    Array.isArray(metric?.residentSteps?.schroederSpatialEpochGenerationSummaries)
      ? metric.residentSteps.schroederSpatialEpochGenerationSummaries
        .map((entry) => entry?.spatialEpochGeneration ?? entry)
      : []
  ));
  addFailure(
    failures,
    generations.length > 0
      && generations.every((generation) => (
        generation?.mechanicsFieldPairV2Enabled
          === contract.observedMechanicsFieldPairV2Enabled
        && generation?.mechanicsFieldConstructionMode
          === contract.observedMechanicsFieldConstructionMode
      )),
    'independent-v2 telemetry was not complete for every generation'
  );
  const evidence = scenario?.schroederMechanicsFieldPairV2Evidence;
  addFailure(
    failures,
    evidence?.configuredRequested === contract.configuredMechanicsFieldPairV2Requested
      && evidence?.coverageComplete === true
      && evidence?.generationSummaryCount === generations.length
      && evidence?.enabledObservationCount === generations.length
      && evidence?.constructionModeObservationCount === generations.length
      && canonicalJson(evidence?.observedEnabledValues)
        === canonicalJson([contract.observedMechanicsFieldPairV2Enabled])
      && canonicalJson(evidence?.observedConstructionModes)
        === canonicalJson([contract.observedMechanicsFieldConstructionMode]),
    'mechanics-field construction evidence did not cover every generation'
  );
  return generations;
}

function validateCacheLifecycle({
  timeline,
  residentMetrics,
  policy,
  failures
}) {
  const lifecycle = timeline?.interactiveCacheLifecycle;
  const contract = policy.cacheContract;
  addFailure(
    failures,
    lifecycle?.schema === contract.schema
      && lifecycle?.status
        === 'same-page-warm-reset-cached-measurement-complete'
      && lifecycle?.sameBrowserProcess === true
      && lifecycle?.sameBrowserContext === true
      && lifecycle?.samePage === true
      && typeof lifecycle?.pageInstanceId === 'string'
      && lifecycle.pageInstanceId.length > 0
      && lifecycle?.pageIdentity?.pageInstanceId
        === lifecycle.pageInstanceId
      && positiveNumber(lifecycle?.pageIdentity?.performanceTimeOrigin) !== null
      && lifecycle?.pageIdentity?.performanceTimeOrigin
        === lifecycle?.reset?.performanceTimeOrigin
      && lifecycle?.pageIdentity?.documentUrl
        === lifecycle?.reset?.documentUrl
      && nonNegativeInteger(
        lifecycle?.pageIdentity?.navigationEntryCount
      ) === nonNegativeInteger(lifecycle?.reset?.navigationEntryCount),
    'same-page cache lifecycle telemetry unavailable or incomplete'
  );
  const warm = lifecycle?.warmup;
  addFailure(
    failures,
    warm?.staticTableWrite?.schema
      === 'peercompute.ulg.sph-static-table-cache-update.v0'
      && warm?.staticTableWrite?.status === 'stored'
      && nonNegativeInteger(warm?.staticTableWrite?.counts?.tables)
        >= contract.requiredStaticTableCount
      && nonNegativeInteger(warm?.staticTableWrite?.counts?.gpuWarmup)
        >= contract.requiredGpuWarmupCount
      && nonNegativeInteger(warm?.completedResidentBatchCount) >= 1,
    'real static-table/GPU cache warmup was not authenticated'
  );
  const reset = lifecycle?.reset;
  addFailure(
    failures,
    reset?.control === contract.resetControl
      && reset?.navigationPerformed === false
      && reset?.residentStateReset === true
      && reset?.resetGenerationAdvanced === true
      && reset?.residentExecutionIdentityChanged === true
      && reset?.staticTableCacheStatus === 'static-table-cache-bundle-hit'
      && reset?.staticTableRead?.status === 'static-table-cache-bundle-hit'
      && nonNegativeInteger(reset?.staticTableRead?.hitCount)
        >= contract.requiredStaticTableHitCount
      && nonNegativeInteger(reset?.staticTableRead?.tableCount)
        >= contract.requiredStaticTableCount
      && nonNegativeInteger(reset?.staticTableRead?.gpuWarmupCount)
        >= contract.requiredGpuWarmupCount
      && validPlaybackQuiescence(reset?.playbackQuiescence, {
        reason: 'reset-playback-before-direct-measurement'
      }),
    'same-page reset did not authenticate a static-table cache bundle hit'
  );
  addFailure(
    failures,
    positiveNumber(warm?.completedAtMs) !== null
      && positiveNumber(reset?.completedAtMs) !== null
      && Number(reset.completedAtMs) > Number(warm.completedAtMs),
    'cache warmup/reset chronology is invalid'
  );
  const postReset = lifecycle?.postResetMeasurement;
  const warmupIndices = postReset?.warmupBatchIndices;
  const measuredIndices = postReset?.measuredBatchIndices;
  const expectedWarmupIndices = contract.postResetWarmupBatchIndices;
  const expectedMeasuredIndices = contract.postResetMeasuredBatchIndices;
  const expectedResidentIndices = [
    ...expectedWarmupIndices,
    ...expectedMeasuredIndices
  ];
  const expectedMeasurementClasses = expectedResidentIndices.map(
    (index) => expectedWarmupIndices.includes(index)
      ? 'post-reset-warmup'
      : 'post-reset-measured'
  );
  addFailure(
    failures,
    Array.isArray(warmupIndices)
      && warmupIndices.length === contract.postResetWarmupBatchCount
      && Array.isArray(measuredIndices)
      && measuredIndices.length === contract.measuredBatchCount
      && canonicalJson(warmupIndices) === canonicalJson(expectedWarmupIndices)
      && canonicalJson(measuredIndices) === canonicalJson(expectedMeasuredIndices)
      && new Set([...warmupIndices, ...measuredIndices]).size
        === warmupIndices.length + measuredIndices.length
      && [...warmupIndices, ...measuredIndices].every(
        (index) => Number.isSafeInteger(index) && index > 0
      ),
    'post-reset warmup/measured batch partition mismatch'
  );
  const metricByBatch = new Map(
    residentMetrics.map((metric) => [Number(metric.batchIndex), metric])
  );
  const warmupMetrics = Array.isArray(warmupIndices)
    ? warmupIndices.map((index) => metricByBatch.get(index)).filter(Boolean)
    : [];
  const measuredMetrics = Array.isArray(measuredIndices)
    ? measuredIndices.map((index) => metricByBatch.get(index)).filter(Boolean)
    : [];
  addFailure(
    failures,
    residentMetrics.length
      === contract.postResetWarmupBatchCount + contract.measuredBatchCount
      && warmupMetrics.length === contract.postResetWarmupBatchCount
      && measuredMetrics.length === contract.measuredBatchCount
      && residentMetrics.every((metric) => (
        metric?.pageInstanceId === lifecycle?.pageInstanceId
        && metric?.cacheResetOrdinal === reset?.resetOrdinal
        && positiveNumber(metric?.capturedAtMs) !== null
        && Number(metric.capturedAtMs) > Number(reset?.completedAtMs)
      ))
      && warmupMetrics.every(
        (metric) => metric?.interactiveCacheMeasurementClass
          === 'post-reset-warmup'
      )
      && measuredMetrics.every(
        (metric) => metric?.interactiveCacheMeasurementClass
          === 'post-reset-measured'
      )
      && canonicalJson(postReset?.observedResidentBatchIndices)
        === canonicalJson(expectedResidentIndices)
      && canonicalJson(postReset?.observedMeasurementClasses)
        === canonicalJson(expectedMeasurementClasses),
    'resident batches were not bound to the post-reset cached page'
  );
  const finalMeasuredBatchIndex = expectedMeasuredIndices.at(-1);
  const drain = postReset?.drain;
  addFailure(
    failures,
    drain?.schema
      === 'peercompute.ulg.sph-interactive-cache-terminal-drain.v1'
      && drain?.status === 'unmeasured-terminal-consumer-complete'
      && drain?.measured === false
      && drain?.metricPublished === false
      && drain?.sourceBatchIndex === finalMeasuredBatchIndex
      && drain?.successorBatchIndex
        === contract.terminalDrainSuccessorBatchIndex
      && nonNegativeInteger(drain?.completedStepCount) === 1
      && finiteNumber(drain?.elapsedMs) !== null
      && Number(drain.elapsedMs) >= 0
      && drain?.settledStatus
        === 'background-settlement-complete-after-unmeasured-terminal-consumer',
    'final measured batch settlement drain was absent or unauthenticated'
  );
  const terminalHandoff = postReset?.terminalHandoff;
  addFailure(
    failures,
    terminalHandoff?.schema === contract.terminalHandoffSchema
      && terminalHandoff?.status === contract.terminalHandoffStatus
      && terminalHandoff?.reason === null
      && terminalHandoff?.terminalConsumerMethod
        === contract.terminalHandoffMethod
      && terminalHandoff?.terminalConsumerContract
        === contract.terminalHandoffContract
      && terminalHandoff?.recordedDrainExecutionMatched === true
      && terminalHandoff?.backgroundSettlementPromisePresent === true
      && validPlaybackQuiescence(
        terminalHandoff?.playbackQuiescence,
        {
          terminal: true,
          reason: 'terminal-handoff-before-dispose'
        }
      )
      && typeof terminalHandoff?.pendingBeforeDispose === 'boolean'
      && terminalHandoff?.disposeInvoked === true
      && finiteNumber(terminalHandoff?.settlementAwaitMs) !== null
      && Number(terminalHandoff.settlementAwaitMs) >= 0
      && terminalHandoff?.settlementStatus
        === 'terminal-settlement-resolved'
      && terminalHandoff?.settlementValue === true
      && terminalHandoff?.spatialEpochSettlementComplete === true
      && terminalHandoff?.hierarchyArtifactSettlementComplete === true
      && terminalHandoff?.successorSourceFamilyRetirementComplete === true
      && positiveNumber(terminalHandoff?.completedAtMs) !== null
      && lifecycle?.completedAtMs === terminalHandoff.completedAtMs
      && Number(terminalHandoff.completedAtMs)
        > Math.max(
          Number(reset?.completedAtMs) || 0,
          ...residentMetrics.map((metric) => Number(metric?.capturedAtMs) || 0)
        ),
    'terminal drain ownership was not closed by the exact scene terminal consumer'
  );
  addFailure(
    failures,
    expectedResidentIndices.every((batchIndex) => {
      const metric = metricByBatch.get(batchIndex);
      const finalMeasured = batchIndex === finalMeasuredBatchIndex;
      const timing = metric?.probeResidentBatchTiming;
      return timing?.backgroundSettlementStatus === (finalMeasured
        ? 'background-settlement-complete-after-unmeasured-terminal-consumer'
        : 'background-settlement-complete-after-successor-consumer')
        && finiteNumber(timing?.backgroundSettlementAwaitMs) !== null
        && Number(timing.backgroundSettlementAwaitMs) >= 0
        && timing?.backgroundSettlementSuccessorBatchIndex === batchIndex + 1
        && timing?.backgroundSettlementTerminalDrain === finalMeasured;
    }),
    'resident batch background settlement chain was incomplete'
  );
  return { lifecycle, warmupMetrics, measuredMetrics };
}

function engineMeasurement(metric, failures) {
  const timing = metric?.probeResidentBatchTiming;
  const keys = [
    'residentStepsAwaitMs',
    'backgroundSettlementAwaitMs',
    'renderRefreshAwaitMs',
    'materialInterfaceDiagnosticMs',
    'viewportRefreshMs',
    'viewportRafMs',
    'nativeSurfaceValidationWaitMs',
    'totalBeforeSampleMs'
  ];
  const values = Object.fromEntries(
    keys.map((key) => [key, finiteNumber(timing?.[key])])
  );
  const complete = timing?.status === 'resident-batch-timing-collected'
    && keys.every((key) => values[key] !== null && values[key] >= 0);
  addFailure(
    failures,
    complete,
    `batch ${metric?.batchIndex ?? '?'} complete-engine timing unavailable`
  );
  if (!complete) {
    return {
      batchIndex: metric?.batchIndex ?? null,
      engineBatchMs: null,
      physicsStepsPerSecond: null
    };
  }
  const viewportNonRafMs = values.viewportRefreshMs
    - values.viewportRafMs
    - values.nativeSurfaceValidationWaitMs;
  addFailure(
    failures,
    viewportNonRafMs >= 0,
    `batch ${metric.batchIndex} viewport timing is internally inconsistent`
  );
  const engineBatchMs = values.residentStepsAwaitMs
    + values.backgroundSettlementAwaitMs
    + values.renderRefreshAwaitMs
    + values.materialInterfaceDiagnosticMs
    + Math.max(0, viewportNonRafMs)
    + values.nativeSurfaceValidationWaitMs;
  const completedStepCount = nonNegativeInteger(
    metric?.residentSteps?.completedStepCount
  );
  const fps = completedStepCount > 0 && engineBatchMs > 0
    ? completedStepCount * 1000 / engineBatchMs
    : null;
  addFailure(
    failures,
    engineBatchMs > 0
      && values.totalBeforeSampleMs >= engineBatchMs
      && completedStepCount > 0
      && fps !== null,
    `batch ${metric.batchIndex} complete-engine rate is invalid`
  );
  return {
    batchIndex: metric.batchIndex,
    metricSource: 'complete-engine-batch',
    completedStepCount,
    engineBatchMs,
    physicsStepsPerSecond: fps
  };
}

function validatePhysics({
  scenario,
  residentMetrics,
  measuredMetrics,
  policy,
  failures,
  performanceTargetFailures
}) {
  const allMeasurements = residentMetrics.map(
    (metric) => engineMeasurement(metric, failures)
  );
  const measuredIndexSet = new Set(
    measuredMetrics.map((metric) => Number(metric.batchIndex))
  );
  const measured = allMeasurements.filter(
    (entry) => measuredIndexSet.has(Number(entry.batchIndex))
  );
  addFailure(
    performanceTargetFailures,
    measured.length === policy.cacheContract.measuredBatchCount
      && measured.every((entry) => (
        entry.metricSource === policy.performanceContract.metricSource
        && entry.physicsStepsPerSecond
          >= policy.performanceContract.minimumPhysicsStepsPerSecond
      )),
    'post-warmup cached complete-engine physics steps per second was below 30 or missing'
  );
  const finalMeasurement = measured.at(-1);
  addFailure(
    failures,
    scenario?.physicsStepsPerSecondSource
      === policy.performanceContract.metricSource
      && approximatelyEqual(
        scenario?.probeEngineBatchMs,
        finalMeasurement?.engineBatchMs
      )
      && approximatelyEqual(
        scenario?.physicsStepsPerSecond,
        finalMeasurement?.physicsStepsPerSecond
      ),
    'benchmark summary does not match the final cached engine measurement'
  );
  const steps = residentMetrics.map((metric) => metric?.residentSteps?.nextStep);
  const times = residentMetrics.map((metric) => (
    metric?.residentSteps?.nextTime ?? metric?.sceneTimeS
  ));
  addFailure(
    failures,
    strictlyIncreasing(steps)
      && strictlyIncreasing(times)
      && residentMetrics.every((metric) => (
        metric?.residentSteps?.status === 'resident-steps-executed'
        && metric?.residentSteps?.backend === 'webgpu'
        && metric?.residentSteps?.completedStepCount === 1
        && metric?.residentSteps?.normalHotLoopReadbackFree === true
        && metric?.residentSteps?.readbackMode === 'no-full-readback'
      )),
    'cached resident physics did not advance every measured batch'
  );
  return measured;
}

function validCumulativeTally(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.values(value).every(
      (count) => nonNegativeInteger(count) !== null
    );
}

function cumulativeTallyDoesNotGrow(values) {
  if (
    !Array.isArray(values)
    || values.length < 2
    || !values.every(validCumulativeTally)
  ) {
    return false;
  }
  return values.slice(1).every((current, index) => {
    const previous = values[index];
    const keys = new Set([
      ...Object.keys(previous),
      ...Object.keys(current)
    ]);
    return [...keys].every(
      (key) => nonNegativeInteger(current[key] ?? 0)
        === nonNegativeInteger(previous[key] ?? 0)
    );
  });
}

function validateNoReadbackAndErrors({
  report,
  scenario,
  probe,
  residentMetrics,
  warmupMetrics,
  measuredMetrics,
  artifactEvidence,
  failures
}) {
  addFailure(
    failures,
    report?.status === 'complete'
      && report?.performanceGate?.status === 'pass'
      && scenario?.status === 'good'
      && scenario?.probeStatus === 'good'
      && scenario?.exitCode === 0
      && scenario?.performanceGate?.status === 'pass'
      && Array.isArray(scenario?.performanceGate?.blockers)
      && scenario.performanceGate.blockers.length === 0
      && Array.isArray(scenario?.probeIssues)
      && scenario.probeIssues.length === 0,
    'benchmark or scenario status was not good'
  );
  addFailure(
    failures,
    probe?.status === 'good'
      && probe?.timeline?.status === 'complete'
      && probe?.analysis?.status === 'good'
      && Array.isArray(probe?.timeline?.errors)
      && probe.timeline.errors.length === 0
      && Array.isArray(probe?.analysis?.issues)
      && probe.analysis.issues.length === 0
      && probe?.timeline?.browserConsole?.issueCount === 0
      && probe?.timeline?.browserConsole?.pageErrorCount === 0
      && scenario?.browserConsoleIssueCount === 0
      && Object.keys(scenario?.browserConsoleIssueCounts ?? {}).length === 0,
    'browser/probe reported an error or GPU issue'
  );
  addFailure(
    failures,
    gpuFailureLines(
      artifactEvidence?.stdout?.text,
      artifactEvidence?.stderr?.text
    ).length === 0,
    'process logs contain a GPU/browser failure'
  );
  addFailure(
    failures,
    scenario?.estimatedReadbackBytesPerStep === 0
      && scenario?.estimatedReadbackBytesPerBatch === 0
      && scenario?.copyBudget?.estimatedReadbackBytesPerStep === 0
      && scenario?.copyBudget?.estimatedReadbackBytesPerBatch === 0,
    'benchmark copy budget was not exactly zero'
  );
  const synchronizationMetrics = [
    ...(Array.isArray(warmupMetrics) ? warmupMetrics.slice(-1) : []),
    ...(Array.isArray(measuredMetrics) ? measuredMetrics : [])
  ];
  const nativeMapTallies = synchronizationMetrics.map(
    (metric) => metric?.renderState?.nativeBufferMapTally
  );
  addFailure(
    failures,
    residentMetrics.every((metric) => {
      const state = metric?.renderState;
      const steps = metric?.residentSteps;
      return steps?.readbackTelemetrySchema
          === 'peercompute.ulg.gpu-readback-telemetry.v1'
        && steps?.readbackTelemetryScope
          === 'sph-phase-scene-schroeder-resident-sequence'
        && steps?.readbackTelemetryComplete === true
        && canonicalJson(steps?.readbackTelemetryUnknownSources) === '[]'
        && nonNegativeInteger(steps?.observedMapAsyncCount) === 0
        && nonNegativeInteger(steps?.observedReadbackBytes) === 0
        && nonNegativeInteger(steps?.observedHostQueueFenceCount) === 0
        && nonNegativeInteger(steps?.mapAsyncCount) === 0
        && nonNegativeInteger(steps?.readbackBytes) === 0
        && nonNegativeInteger(steps?.hostQueueFenceCount) === 0
        && steps?.fullParticleReadbackPerformed === false
        && steps?.fullParticleReadbackFree === true
        && steps?.residentContinuationReady === true
        && state?.renderFieldReadback === false
        && state?.renderFieldEmptyRetryReadback === false
        && state?.renderRowsReadback === false
        && state?.renderRowsReadbackMode === 'no-full-readback'
        && state?.renderRowsReadbackByteLength === 0
        && state?.surfaceDrawReadback === false
        && state?.surfaceDrawSummaryReadback === false
        && state?.surfaceDrawSummaryReadbackByteLength === 0
        && state?.fullSurfaceDrawReadback === false
        && state?.surfaceDrawGpuBufferHandoffNoFullReadback === true
        && state?.surfaceDrawGpuBufferHandoffNoSummaryReadback === true
        && state?.surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated
          === false
        && state?.renderFieldCpuFallbackGeometryAvailable === false
        && state?.surfaceDrawDiagnosticFallbackReason === null;
    })
      && cumulativeTallyDoesNotGrow(nativeMapTallies),
    'runtime readback grew during the cached hot loop, or a CPU/diagnostic fallback was observed'
  );
  const queueFenceTotals = synchronizationMetrics.map(
    (metric) => nonNegativeInteger(metric?.renderState?.nativeQueueFenceTotal)
  );
  addFailure(
    failures,
    synchronizationMetrics.length >= 2
      && synchronizationMetrics.every((metric) => (
      metric?.renderState?.nativeQueueFenceTraceInstalled === true
      && validCumulativeTally(metric?.renderState?.nativeQueueFenceTally)
    ))
      && cumulativeTallyDoesNotGrow(
        synchronizationMetrics.map(
          (metric) => metric?.renderState?.nativeQueueFenceTally
        )
      )
      && queueFenceTotals.every((count) => count !== null)
      && queueFenceTotals.every(
        (count, index) => index === 0 || count - queueFenceTotals[index - 1] === 0
      ),
    'native GPU queue-fence trace was absent or grew during the cached hot loop'
  );
  addFailure(
    failures,
    probe?.timeline?.visualFrameCapture?.visualIntervalCaptureRequested
        === false
      && probe?.timeline?.authoritativeGpuCheckpointCapture?.enabled === false
      && probe?.timeline?.nativeSurfaceDrawIndirectArgsValidation?.status
        === 'not-requested',
    'post-probe GPU readback diagnostic was enabled or not authenticated as disabled'
  );
}

function successfulExtractionStatus(value) {
  return typeof value === 'string'
    && value.length > 0
    && !/(?:blocked|skipped|error|failed|unavailable)/iu.test(value);
}

function successfulExecutionStatus(value) {
  return typeof value === 'string'
    && value.length > 0
    && !/(?:blocked|skipped|error|failed|unavailable)/iu.test(value);
}

function translationRouteWitness(state) {
  return Object.freeze({
    status:
      state?.surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus ?? null,
    directCompactPositionDraw:
      state?.surfaceDrawDirectCompactPositionDraw ?? null,
    directCompactPositionDrawIndirectSource:
      state?.surfaceDrawExtensionSurfaceDirectCompactPositionDrawIndirectSource
      ?? null,
    drawIndirectRowsOwnership:
      state?.surfaceDrawExtensionSurfaceDrawIndirectRowsOwnership ?? null,
    extensionDrawIndirectBufferRetained:
      state?.surfaceDrawExtensionSurfaceDrawIndirectBufferRetained ?? null,
    extensionDrawIndirectBufferByteLength:
      state?.surfaceDrawExtensionSurfaceDrawIndirectBufferByteLength ?? null,
    queueCompletionStatus:
      state?.surfaceDrawExtensionSurfaceQueueCompletionStatus ?? null,
    queueCompletionMethod:
      state?.surfaceDrawExtensionSurfaceQueueCompletionMethod ?? null,
    vertexRowsBufferClearStatus:
      state?.surfaceDrawExtensionSurfaceVertexRowsBufferClearStatus ?? null,
    translationPipelineCreated:
      state?.surfaceDrawExtensionSurfaceTranslationPipelineCreated ?? null,
    translationBindGroupCreated:
      state?.surfaceDrawExtensionSurfaceTranslationBindGroupCreated ?? null,
    translationCommandEncoderCreated:
      state?.surfaceDrawExtensionSurfaceTranslationCommandEncoderCreated
      ?? null,
    translationWorkgroupCountX:
      state?.surfaceDrawExtensionSurfaceTranslationWorkgroupCountX ?? null,
    translationSubmissionObserved:
      state?.surfaceDrawExtensionSurfaceTranslationSubmissionObserved ?? null,
    hotLoopGpuTranslationRequired:
      state?.surfaceDrawExtensionSurfaceHotLoopGpuTranslationRequired ?? null
  });
}

function classifyTranslationExecutionRoute(witness) {
  if (
    witness?.status
      === TRANSLATION_PIPELINE_CACHE_STATUS.extensionDrawIndirectBypass
    && witness?.directCompactPositionDraw === true
    && witness?.directCompactPositionDrawIndirectSource
      === 'webgpu-marching-cubes-extension-draw-indirect-buffer'
    && witness?.drawIndirectRowsOwnership
      === 'extension-owned-retained-buffer'
    && witness?.extensionDrawIndirectBufferRetained === true
    && Number.isSafeInteger(witness?.extensionDrawIndirectBufferByteLength)
    && witness.extensionDrawIndirectBufferByteLength >= 16
    && witness?.queueCompletionStatus === 'queue-work-not-required'
    && witness?.queueCompletionMethod
      === 'extension-owned-draw-indirect-buffer'
    && witness?.vertexRowsBufferClearStatus
      === 'skipped-direct-compact-position-draw'
    && witness?.translationPipelineCreated === false
    && witness?.translationBindGroupCreated === false
    && witness?.translationCommandEncoderCreated === false
    && witness?.translationWorkgroupCountX === 0
    && witness?.translationSubmissionObserved === false
    && witness?.hotLoopGpuTranslationRequired === false
  ) {
    return TRANSLATION_EXECUTION_ROUTE.extensionDrawIndirectBypass;
  }
  if (
    [
      TRANSLATION_PIPELINE_CACHE_STATUS.miss,
      TRANSLATION_PIPELINE_CACHE_STATUS.hit
    ].includes(witness?.status)
    && witness?.translationPipelineCreated === true
    && witness?.translationBindGroupCreated === true
    && witness?.translationCommandEncoderCreated === true
    && Number.isSafeInteger(witness?.translationWorkgroupCountX)
    && witness.translationWorkgroupCountX >= 1
    && witness?.translationSubmissionObserved === true
    && witness?.hotLoopGpuTranslationRequired === false
  ) {
    return TRANSLATION_EXECUTION_ROUTE.pipeline;
  }
  return null;
}

function validateMarching({
  scenario,
  residentMetrics,
  warmupMetrics,
  measuredMetrics,
  policy,
  failures
}) {
  const allStates = residentMetrics.map((metric) => metric?.renderState);
  const allTranslationWitnesses = allStates.map(translationRouteWitness);
  const allTranslationRoutes = allTranslationWitnesses.map(
    classifyTranslationExecutionRoute
  );
  const selectedTranslationRoute = allTranslationRoutes[0] ?? null;
  const finalHandoffState = allStates.at(-1) ?? null;
  addFailure(
    failures,
    allStates.every((state) => {
      const counters = state?.surfaceDrawExtractionPresentationCounters;
      return counters?.schema === policy.presentationContract.countersSchema
        && counters?.coverage?.status === 'complete'
        && counters?.coverage?.complete === true
        && canonicalJson(counters?.coverage?.requiredSourceKeys)
          === canonicalJson(EXTRACTION_PRESENTATION_COUNTER_SOURCE_KEYS)
        && canonicalJson(counters?.coverage?.observedSourceKeys)
          === canonicalJson(EXTRACTION_PRESENTATION_COUNTER_SOURCE_KEYS)
        && counters?.coverage?.requiredSourceCount
          === EXTRACTION_PRESENTATION_COUNTER_SOURCE_KEYS.length
        && counters?.coverage?.observedSourceCount
          === EXTRACTION_PRESENTATION_COUNTER_SOURCE_KEYS.length
        && Array.isArray(counters?.coverage?.missingSourceKeys)
        && counters.coverage.missingSourceKeys.length === 0
        && REQUIRED_ZERO_COUNTERS.every(
          (key) => nonNegativeInteger(counters?.[key]) === 0
        );
    }),
    'comprehensive extraction/presentation zero-fallback counters unavailable'
  );
  addFailure(
    failures,
    allStates.every((state) => (
      state?.renderFieldBufferMode
        === policy.presentationContract.renderFieldBufferMode
      && state?.surfaceDrawVisibleRendererBridge
        === policy.presentationContract.bridge
      && state?.surfaceDrawGpuBufferHandoffReady === true
      && state?.surfaceDrawGpuBufferHandoffStatus
        === 'resident-surface-buffer-direct-consumer-ready'
      && state?.surfaceDrawGpuBufferHandoffReason === null
      && state?.surfaceDrawGpuBufferHandoffKind === 'surface-draw-buffers'
      && typeof state?.surfaceDrawGpuBufferHandoffInputSchema === 'string'
      && state.surfaceDrawGpuBufferHandoffInputSchema.length > 0
      && state?.surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction === false
      && state?.surfaceDrawVisibleGpuConsumerReady === true
      && state?.surfaceDrawVisibleGpuConsumerStatus
        === 'resident-surface-visible-gpu-consumer-ready'
      && state?.surfaceDrawVisibleGpuConsumerReason === null
      && state?.surfaceDrawVisibleGpuConsumerInputReady === true
      && state?.surfaceDrawVisibleGpuConsumerInputKind === 'surface-draw-buffers'
      && state?.surfaceDrawVisibleGpuConsumerRuntimeReady === true
      && exactNativePresentationAdmission(state)
    ))
      && finalHandoffState
        ?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected
          === true
      && finalHandoffState
        ?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute
          === policy.presentationContract.bridge
      && finalHandoffState
        ?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread
          === 'main-thread'
      && finalHandoffState
        ?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope
          === 'engine-owned-native-webgpu-canvas-device'
      && finalHandoffState
        ?.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus
          === 'same-device-main-thread-import-ready',
    'native WebGPU handoff or exact presentation-admission telemetry incomplete'
  );
  addFailure(
    failures,
    allStates.every((state) => (
      state?.surfaceDrawRequestedDiagnosticMode
        === policy.presentationContract.bridge
      && state?.surfaceDrawVisibleRenderSource
        === 'resident-surface-draw-native-webgpu-consumer'
      && state?.surfaceDrawCompactPositionRowsBufferByteLength > 0
      && state?.surfaceDrawCompactPositionRowsVertexCount > 0
      && state?.surfaceDrawCompactPositionRowsStrideFloats === 4
      && state?.surfaceDrawDirectCompactPositionDraw === true
      && state?.surfaceDrawRenderBridgeExternalGpuBufferInputLayout
        === policy.presentationContract.inputLayout
      && state?.surfaceDrawRenderBridgeCompactPositionDirectInput === true
      && state?.surfaceDrawCompactedVertexRowsBufferByteLength === 0
    )),
    'compact-position native marching-cubes layout was not retained'
  );
  addFailure(
    failures,
    allStates.every((state) => (
      state?.surfaceDrawNativeMarchingCubesExtractionAllowed === true
      && successfulExtractionStatus(
        state?.surfaceDrawNativeMarchingCubesExtractionStatus
      )
      && state?.surfaceDrawNativeMarchingCubesExtractionReason === null
      && positiveNumber(
        state?.surfaceDrawNativeMarchingCubesExtractionElapsedMs
      ) !== null
      && positiveNumber(
        state?.surfaceDrawNativeMarchingCubesExtensionExecutionElapsedMs
      ) !== null
      && positiveNumber(
        state?.surfaceDrawNativeMarchingCubesTotalElapsedMs
      ) !== null
      && state?.surfaceDrawNativeMarchingCubesExtractionErrorName === null
      && state?.surfaceDrawNativeMarchingCubesExtractionErrorStatus === null
      && state?.surfaceDrawNativeMarchingCubesExtractionErrorStage === null
      && state?.surfaceDrawNativeMarchingCubesExtractionErrorStack === null
      && successfulExecutionStatus(
        state?.surfaceDrawExtensionSurfaceAdapterExecutionStatus
      )
      && successfulExecutionStatus(
        state?.surfaceDrawExtensionSurfaceRawExecutionStatus
      )
      && positiveNumber(state?.surfaceDrawExtensionSurfaceRawVertexCount)
        !== null
      && (
        classifyTranslationExecutionRoute(translationRouteWitness(state))
          === TRANSLATION_EXECUTION_ROUTE.extensionDrawIndirectBypass
          ? finiteNumber(
              state?.surfaceDrawExtensionSurfaceTranslationElapsedMs
            ) !== null
            && Number(state.surfaceDrawExtensionSurfaceTranslationElapsedMs)
              >= 0
          : positiveNumber(
              state?.surfaceDrawExtensionSurfaceTranslationElapsedMs
            ) !== null
      )
      && positiveNumber(state?.surfaceDrawExtensionSurfaceRefreshElapsedMs)
        !== null
    )),
    'positive native marching-cubes extraction execution was not authenticated'
  );
  addFailure(
    failures,
    warmupMetrics.length === 1
      && warmupMetrics.every((metric) => (
        (
          (
            metric?.renderState?.surfaceDrawNativeMarchingCubesAdapterCacheHit
              === false
            && [
              'native-marching-cubes-adapter-cache-miss-created',
              'native-marching-cubes-adapter-cache-miss-replaced'
            ].includes(
              metric?.renderState
                ?.surfaceDrawNativeMarchingCubesAdapterCacheStatus
            )
          )
          || (
            metric?.renderState?.surfaceDrawNativeMarchingCubesAdapterCacheHit
              === true
            && metric?.renderState
              ?.surfaceDrawNativeMarchingCubesAdapterCacheStatus
              === policy.presentationContract.adapterCacheStatusAfterWarmup
            && nonNegativeInteger(
              metric?.renderState
                ?.surfaceDrawNativeMarchingCubesAdapterCacheHitCount
            ) >= 1
          )
        )
      ))
      && measuredMetrics.length
        === policy.presentationContract.requiredMeasuredPresentedFrames
      && measuredMetrics.every((metric) => (
        metric?.renderState?.surfaceDrawNativeMarchingCubesAdapterCacheHit
          === true
        && metric?.renderState?.surfaceDrawNativeMarchingCubesAdapterCacheStatus
          === policy.presentationContract.adapterCacheStatusAfterWarmup
        && nonNegativeInteger(
          metric?.renderState?.surfaceDrawNativeMarchingCubesAdapterCacheHitCount
        ) > nonNegativeInteger(
          warmupMetrics[0]?.renderState
            ?.surfaceDrawNativeMarchingCubesAdapterCacheHitCount
        )
      )),
    'marching-cubes adapter cache hit was not observed after warmup'
  );
  const measuredTranslationWitnesses = measuredMetrics.map(
    (metric) => translationRouteWitness(metric?.renderState)
  );
  const finalTranslationWitness = allTranslationWitnesses.at(-1) ?? null;
  const scenarioTranslationWitness = translationRouteWitness(scenario);
  const scenarioTranslationRoute = classifyTranslationExecutionRoute(
    scenarioTranslationWitness
  );
  const translationRouteConsistent = Boolean(
    selectedTranslationRoute
    && allTranslationRoutes.every(
      (route) => route === selectedTranslationRoute
    )
    && scenarioTranslationRoute === selectedTranslationRoute
  );
  const translationRouteSteadyState = selectedTranslationRoute
      === TRANSLATION_EXECUTION_ROUTE.pipeline
    ? measuredTranslationWitnesses.every(
        (witness) => witness.status === TRANSLATION_PIPELINE_CACHE_STATUS.hit
      )
      && finalTranslationWitness?.status
        === TRANSLATION_PIPELINE_CACHE_STATUS.hit
      && scenarioTranslationWitness.status
        === TRANSLATION_PIPELINE_CACHE_STATUS.hit
    : selectedTranslationRoute
        === TRANSLATION_EXECUTION_ROUTE.extensionDrawIndirectBypass;
  addFailure(
    failures,
    translationRouteConsistent
      && translationRouteSteadyState
      && canonicalJson(scenarioTranslationWitness)
        === canonicalJson(finalTranslationWitness),
    'marching-cubes translation route was invalid, mixed, or stale'
  );
  const frameCounts = allStates.map(
    (state) => state?.surfaceDrawRenderBridgeFrameCount
  );
  const updateCounts = allStates.map(
    (state) => state?.surfaceDrawRenderBridgeUpdateCount
  );
  addFailure(
    failures,
    strictlyIncreasing(frameCounts)
      && strictlyIncreasing(updateCounts)
      && measuredMetrics.every((metric) => {
        const state = metric?.renderState;
        return state?.surfaceDrawRenderBridgeReused === true
          && state?.surfaceDrawRenderBridgeNativeSurfaceReuseStatus
            === 'native-webgpu-surface-consumer-bridge-reused'
          && state?.surfaceDrawRenderBridgeLastRenderSkipReason === null
          && /^native-webgpu-surface-consumer-.+(?:rendered|presented)$/u.test(
            state?.surfaceDrawRenderBridgeLastRenderStatus ?? ''
          )
          && positiveNumber(state?.surfaceDrawRenderBridgeLastDrawOrderCount)
            !== null;
      }),
    'native presentation frame/update counters did not grow across frames'
  );
  const finalState = allStates.at(-1);
  addFailure(
    failures,
    scenario?.validResidentSurfaceBufferHandoff === true
      && scenario?.surfaceDrawBridge === policy.presentationContract.bridge
      && scenario?.surfaceDrawGpuBufferHandoffReady === true
      && scenario?.surfaceDrawVisibleGpuConsumerReady === true
      && scenario?.surfaceDrawVisibleGpuConsumerRuntimeReady === true
      && exactNativePresentationAdmission(scenario)
      && scenario?.surfaceDrawRenderBridgeExternalGpuBufferInputLayout
        === policy.presentationContract.inputLayout
      && scenario?.surfaceDrawDirectCompactPositionDraw === true
      && scenario?.surfaceDrawRenderBridgeCompactPositionDirectInput === true
      && scenario?.surfaceDrawNativeMarchingCubesAdapterCacheHit === true
      && scenarioTranslationRoute === selectedTranslationRoute
      && canonicalJson(scenarioTranslationWitness)
        === canonicalJson(finalTranslationWitness)
      && scenario?.surfaceDrawRenderBridgeFrameCount
        === finalState?.surfaceDrawRenderBridgeFrameCount
      && scenario?.surfaceDrawRenderBridgeUpdateCount
        === finalState?.surfaceDrawRenderBridgeUpdateCount,
    'benchmark native presentation summary does not match raw telemetry'
  );
  return {
    frameCounts,
    updateCounts,
    extractionStatuses: allStates.map(
      (state) => state?.surfaceDrawNativeMarchingCubesExtractionStatus ?? null
    ),
    adapterCacheStatuses: allStates.map(
      (state) => state?.surfaceDrawNativeMarchingCubesAdapterCacheStatus ?? null
    ),
    pipelineCacheStatuses: allStates.map(
      (state) => (
        state?.surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus
        ?? null
      )
    ),
    translationExecutionRoute: selectedTranslationRoute,
    translationExecutionRoutes: allTranslationRoutes,
    translationRouteWitnesses: allTranslationWitnesses,
    scenarioTranslationRoute,
    scenarioTranslationWitness
  };
}

function event({
  kind,
  name,
  passed,
  authentic = passed,
  details,
  passSnippet,
  failSnippet
}) {
  const status = passed ? 'PASS' : 'FAIL';
  return Object.freeze({
    kind,
    name,
    status,
    value: status,
    details: Object.freeze({
      policyTrack: SS_CONTAINED_POLICY_TRACK,
      authentic: authentic === true,
      ...details
    }),
    snippet: passed ? passSnippet : failSnippet
  });
}

function evaluateInteractivePresentationReceiptForRoute(
  receipt,
  {
    expectedPolicy = createInteractivePresentationCommandPolicy({
      benchmarkOutputPath: receipt?.command?.benchmarkArtifact?.path
        ?? '/invalid/missing-benchmark-output.json',
      route: INTERACTIVE_ROUTE.independent
    }),
    currentFingerprint,
    artifactEvidence
  } = {}
) {
  const globalFailures = [];
  addFailure(
    globalFailures,
    receipt?.schema === INTERACTIVE_PRESENTATION_RECEIPT_SCHEMA,
    'receipt schema mismatch'
  );
  addFailure(
    globalFailures,
    receipt?.policyTrack === SS_CONTAINED_POLICY_TRACK,
    'policy track mismatch'
  );
  addFailure(
    globalFailures,
    receipt?.status === 'complete',
    'receipt did not complete'
  );
  addFailure(
    globalFailures,
    canonicalJson(receipt?.commandPolicy) === canonicalJson(expectedPolicy)
      && receipt?.commandPolicy?.commandPolicySha256
        === expectedPolicy?.commandPolicySha256,
    'interactive command policy mismatch'
  );
  addFailure(
    globalFailures,
    exactWorktreeFingerprintsEqual(
      receipt?.sourceFingerprintBefore,
      receipt?.sourceFingerprintAfter,
      currentFingerprint
    ),
    'exact worktree fingerprint changed'
  );
  const command = receipt?.command;
  addFailure(
    globalFailures,
    command?.invocationSha256
      === canonicalJsonSha256(expectedPolicy?.command),
    'interactive command invocation mismatch'
  );
  addFailure(
    globalFailures,
    command?.exitCode === 0
      && command?.signal == null
      && command?.spawnError == null,
    'interactive benchmark process failed'
  );
  for (const key of ['stdout', 'stderr', 'benchmark', 'probe']) {
    addFailure(
      globalFailures,
      artifactMetadataMatches(
        command?.[`${key}Artifact`],
        artifactEvidence?.[key]
      ),
      `${key} artifact mismatch`
    );
  }
  const report = artifactEvidence?.benchmark?.json;
  const probe = artifactEvidence?.probe?.json;
  let scenario = null;
  addFailure(
    globalFailures,
    report?.schema === 'peercompute.ulg.sph-performance-benchmark.v0'
      && Array.isArray(report?.scenarios)
      && report.scenarios.length === 1,
    'benchmark report schema/scenario count mismatch'
  );
  addFailure(
    globalFailures,
    expectedPolicy?.command?.environment?.ULG_BENCH_DURABLE_RELEASE_PUBLICATION === '1'
      && report?.durableReleasePublication === true,
    'interactive benchmark durable release publication binding mismatch'
  );
  scenario = Array.isArray(report?.scenarios) && report.scenarios.length === 1
    ? report.scenarios[0]
    : null;
  addFailure(
    globalFailures,
    probe?.schema === 'peercompute.ulg.sph-history-probe-result.v0',
    'raw probe schema mismatch'
  );
  addFailure(
    globalFailures,
    artifactMetadataMatches(
      scenario?.rawProbeArtifact,
      artifactEvidence?.probe
    ),
    'benchmark raw-probe reference mismatch'
  );
  let stdoutReport = null;
  try {
    stdoutReport = JSON.parse(artifactEvidence?.stdout?.text ?? '');
  } catch {
    stdoutReport = null;
  }
  addFailure(
    globalFailures,
    canonicalJson(stdoutReport) === canonicalJson(report),
    'benchmark stdout/report content mismatch'
  );
  const launch = probe?.browserLaunch;
  addFailure(
    globalFailures,
    launch?.schema === 'peercompute.ulg.sph-probe-browser-launch.v0'
      && launch?.headless === expectedPolicy?.browserOwnership?.headless
      && launch?.executablePath
        === expectedPolicy?.browserOwnership?.executablePath
      && expectedPolicy?.browserOwnership?.requiredArgs?.every(
        (arg) => launch?.args?.includes(arg)
      ),
    'isolated owned presentation browser launch mismatch'
  );
  const residentMetrics = Array.isArray(probe?.timeline?.metrics)
    ? probe.timeline.metrics.filter(
      (metric) => metric?.phase === 'resident-batch'
    )
    : [];
  const routeFailures = [];
  const generations = validateRoute({
    report,
    scenario,
    residentMetrics,
    policy: expectedPolicy,
    failures: routeFailures
  });
  const cacheFailures = [];
  const cache = validateCacheLifecycle({
    timeline: probe?.timeline,
    residentMetrics,
    policy: expectedPolicy,
    failures: cacheFailures
  });
  const commonEvidenceFailures = [];
  validateNoReadbackAndErrors({
    report,
    scenario,
    probe,
    residentMetrics,
    warmupMetrics: cache.warmupMetrics,
    measuredMetrics: cache.measuredMetrics,
    artifactEvidence,
    failures: commonEvidenceFailures
  });
  const physicsFailures = [];
  const physicsPerformanceTargetFailures = [];
  const measurements = validatePhysics({
    scenario,
    residentMetrics,
    measuredMetrics: cache.measuredMetrics,
    policy: expectedPolicy,
    failures: physicsFailures,
    performanceTargetFailures: physicsPerformanceTargetFailures
  });
  const marchingFailures = [];
  const marching = validateMarching({
    scenario,
    residentMetrics,
    warmupMetrics: cache.warmupMetrics,
    measuredMetrics: cache.measuredMetrics,
    policy: expectedPolicy,
    failures: marchingFailures
  });
  const sharedFailures = [
    ...globalFailures,
    ...routeFailures,
    ...cacheFailures,
    ...commonEvidenceFailures
  ];
  const physicsEvidenceFailures = [...sharedFailures, ...physicsFailures];
  const physicsAllFailures = [
    ...physicsEvidenceFailures,
    ...physicsPerformanceTargetFailures
  ];
  const marchingAllFailures = [...sharedFailures, ...marchingFailures];
  const physicsEvidencePassed = physicsEvidenceFailures.length === 0;
  const physicsPassed = physicsEvidencePassed
    && physicsPerformanceTargetFailures.length === 0;
  const marchingPassed = marchingAllFailures.length === 0;
  const warnings = physicsEvidencePassed
    ? [...physicsPerformanceTargetFailures]
    : [];
  const events = Object.freeze([
    event({
      kind: 'ulg_perf_probe',
      name: INTERACTIVE_PRESENTATION_EVENT_NAMES.physics,
      passed: physicsPassed,
      authentic: physicsEvidencePassed,
      details: {
        evaluatorFailures: Object.freeze(physicsAllFailures),
        metricSource:
          expectedPolicy?.performanceContract?.metricSource ?? null,
        minimumPhysicsStepsPerSecond:
          expectedPolicy?.performanceContract
            ?.minimumPhysicsStepsPerSecond ?? null,
        measuredBatchCount: measurements.length,
        measuredBatches: Object.freeze(measurements)
      },
      passSnippet:
        'Two post-warmup cached resident batches stayed at or above 30 complete-engine physics steps per second on one warm-reset page; this is not a display-FPS claim.',
      failSnippet:
        'Cached same-page complete-engine physics evidence was absent, stale, tampered, or below 30 steps per second.'
    }),
    event({
      kind: 'ulg_sph_probe',
      name: INTERACTIVE_PRESENTATION_EVENT_NAMES.marching,
      passed: marchingPassed,
      details: {
        evaluatorFailures: Object.freeze(marchingAllFailures),
        generationSummaryCount: generations.length,
        frameCounts: Object.freeze(marching.frameCounts),
        updateCounts: Object.freeze(marching.updateCounts),
        extractionStatuses: Object.freeze(marching.extractionStatuses),
        adapterCacheStatuses: Object.freeze(marching.adapterCacheStatuses),
        pipelineCacheStatuses: Object.freeze(marching.pipelineCacheStatuses),
        translationExecutionRoute: marching.translationExecutionRoute,
        translationExecutionRoutes: Object.freeze(
          marching.translationExecutionRoutes
        ),
        translationRouteWitnesses: Object.freeze(
          marching.translationRouteWitnesses
        ),
        scenarioTranslationRoute: marching.scenarioTranslationRoute,
        scenarioTranslationWitness: marching.scenarioTranslationWitness
      },
      passSnippet:
        'Native WebGPU marching-cubes extraction and compact-position presentation advanced across cached frames without readback or fallback.',
      failSnippet:
        'Native WebGPU marching-cubes extraction/presentation evidence was absent, stale, tampered, non-advancing, or used a readback/fallback path.'
    })
  ]);
  const failures = [...new Set([
    ...physicsEvidenceFailures,
    ...marchingAllFailures
  ])];
  return Object.freeze({
    // The 30 steps/s target remains a truthful event and a default-enable
    // blocker, but is advisory for the contained/default-off merge track.
    passed: physicsEvidencePassed && marchingPassed,
    containedBlockingPassed: physicsEvidencePassed && marchingPassed,
    allTargetsPassed: physicsPassed && marchingPassed,
    physicsEvidencePassed,
    physicsPassed,
    marchingPassed,
    failures: Object.freeze(failures),
    warnings: Object.freeze(warnings),
    events
  });
}

export function evaluateInteractivePresentationReceipt(receipt, options = {}) {
  const expectedPolicy = options.expectedPolicy
    ?? createInteractivePresentationCommandPolicy({
      benchmarkOutputPath: receipt?.command?.benchmarkArtifact?.path
        ?? '/invalid/missing-benchmark-output.json',
      route: INTERACTIVE_ROUTE.independent
    });
  return evaluateInteractivePresentationReceiptForRoute(receipt, {
    ...options,
    expectedPolicy
  });
}

export function evaluatePairedV2OptInInteractivePresentationReceipt(
  receipt,
  options = {}
) {
  const expectedPolicy = options.expectedPolicy
    ?? createInteractivePresentationCommandPolicy({
      benchmarkOutputPath: receipt?.command?.benchmarkArtifact?.path
        ?? '/invalid/missing-benchmark-output.json',
      route: INTERACTIVE_ROUTE.paired
    });
  return evaluateInteractivePresentationReceiptForRoute(receipt, {
    ...options,
    expectedPolicy
  });
}

async function readJsonEvidence({
  artifactPath,
  repoDir,
  label
}) {
  const artifact = await readHashedArtifact({
    artifactPath,
    repoDir,
    label,
    includeBytes: true
  });
  const text = artifact.bytes.toString('utf8');
  return Object.freeze({
    path: artifact.path,
    byteLength: artifact.byteLength,
    sha256: artifact.sha256,
    text,
    json: JSON.parse(text)
  });
}

export async function readInteractivePresentationArtifactEvidence({
  receipt,
  repoDir = sourceRepoDir
}) {
  const command = receipt?.command;
  const [stdout, stderr, benchmark, probe] = await Promise.all([
    readHashedArtifact({
      artifactPath: command?.stdoutArtifact?.path,
      repoDir,
      label: 'interactive benchmark stdout',
      includeBytes: true
    }),
    readHashedArtifact({
      artifactPath: command?.stderrArtifact?.path,
      repoDir,
      label: 'interactive benchmark stderr',
      includeBytes: true
    }),
    readJsonEvidence({
      artifactPath: command?.benchmarkArtifact?.path,
      repoDir,
      label: 'interactive benchmark report'
    }),
    readJsonEvidence({
      artifactPath: command?.probeArtifact?.path,
      repoDir,
      label: 'interactive raw probe'
    })
  ]);
  const textEvidence = (artifact) => Object.freeze({
    path: artifact.path,
    byteLength: artifact.byteLength,
    sha256: artifact.sha256,
    text: artifact.bytes.toString('utf8')
  });
  return Object.freeze({
    stdout: textEvidence(stdout),
    stderr: textEvidence(stderr),
    benchmark,
    probe
  });
}

async function readAndEvaluateInteractivePresentationReceiptForRoute({
  receiptPath,
  repoDir = sourceRepoDir,
  route
}) {
  const receiptArtifact = await readHashedArtifact({
    artifactPath: receiptPath,
    repoDir,
    label: 'interactive presentation receipt',
    includeBytes: true
  });
  const receipt = JSON.parse(receiptArtifact.bytes.toString('utf8'));
  const expectedPolicy = createInteractivePresentationCommandPolicy({
    benchmarkOutputPath: receipt?.command?.benchmarkArtifact?.path
      ?? '/invalid/missing-benchmark-output.json',
    route
  });
  const [currentFingerprint, artifactEvidence] = await Promise.all([
    exactWorktreeFingerprint(repoDir),
    readInteractivePresentationArtifactEvidence({ receipt, repoDir })
  ]);
  return Object.freeze({
    receipt,
    receiptArtifact: Object.freeze({
      path: receiptArtifact.path,
      byteLength: receiptArtifact.byteLength,
      sha256: receiptArtifact.sha256
    }),
    currentFingerprint,
    evaluation: evaluateInteractivePresentationReceiptForRoute(receipt, {
      expectedPolicy,
      currentFingerprint,
      artifactEvidence
    })
  });
}

export async function readAndEvaluateInteractivePresentationReceipt(options) {
  return readAndEvaluateInteractivePresentationReceiptForRoute({
    ...options,
    route: INTERACTIVE_ROUTE.independent
  });
}

export async function readAndEvaluatePairedV2OptInInteractivePresentationReceipt(
  options
) {
  return readAndEvaluateInteractivePresentationReceiptForRoute({
    ...options,
    route: INTERACTIVE_ROUTE.paired
  });
}

function failedSentinel(reason) {
  return {
    schema: INTERACTIVE_PRESENTATION_RECEIPT_SCHEMA,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    status: 'failed',
    reason
  };
}

async function assertDistinctOutputPaths(entries, repoDir) {
  await assertArtifactPathsPairwiseDistinct({
    paths: entries.map(([label, artifactPath]) => ({
      label,
      path: artifactPath
    })),
    repoDir,
    label: 'interactive presentation output'
  });
}

async function runInteractivePresentationReceiptForRoute({
  receiptPath,
  artifactDir = `${receiptPath}.artifacts`,
  repoDir = sourceRepoDir,
  fixtureCapability,
  fixtureProcessRunner,
  processRunner,
  route
}) {
  const resolvedRepoDir = path.resolve(repoDir);
  if (processRunner != null) {
    throw new Error(
      'interactive presentation receipt does not accept processRunner; use a fixture capability and fixtureProcessRunner'
    );
  }
  let executionRunner = runProcessToArtifacts;
  let executionProvenance = 'production';
  if (fixtureProcessRunner != null) {
    if (typeof fixtureProcessRunner !== 'function') {
      throw new TypeError('interactive fixture process runner must be a function');
    }
    await assertNonProductionFixtureCapability({
      capability: fixtureCapability,
      repoDir: resolvedRepoDir,
      productionRepoDir: sourceRepoDir,
      label: 'interactive fixture process runner'
    });
    executionRunner = fixtureProcessRunner;
    executionProvenance = 'fixture';
  } else if (fixtureCapability != null) {
    throw new Error('interactive fixture capability requires a fixture process runner');
  }
  const resolvedArtifactDir = path.resolve(artifactDir);
  const resolvedReceiptPath = path.resolve(receiptPath);
  const benchmarkOutputPath = path.join(
    resolvedArtifactDir,
    route === INTERACTIVE_ROUTE.paired
      ? 'interactive-benchmark.paired-v2-opt-in.json'
      : 'interactive-benchmark.json'
  );
  const policy = createInteractivePresentationCommandPolicy({
    benchmarkOutputPath,
    route
  });
  const stdoutPath = path.join(
    resolvedArtifactDir,
    route === INTERACTIVE_ROUTE.paired
      ? 'interactive-benchmark.paired-v2-opt-in.stdout.json'
      : 'interactive-benchmark.stdout.json'
  );
  const stderrPath = path.join(
    resolvedArtifactDir,
    route === INTERACTIVE_ROUTE.paired
      ? 'interactive-benchmark.paired-v2-opt-in.stderr.log'
      : 'interactive-benchmark.stderr.log'
  );
  // Collision validation must precede writer construction: default receipt
  // creation is no-clobber, and a malformed artifact layout must not create a
  // sentinel as a side effect before the benchmark runner is considered.
  await assertDistinctOutputPaths([
    ['receipt output', resolvedReceiptPath],
    ['benchmark output', benchmarkOutputPath],
    ['benchmark stdout', stdoutPath],
    ['benchmark stderr', stderrPath]
  ], resolvedRepoDir);
  const writer = await createFailSentinelWriter({
    outputPath: receiptPath,
    repoDir: resolvedRepoDir,
    sentinel: failedSentinel(
      'interactive presentation receipt did not complete'
    ),
    label: 'interactive presentation receipt'
  });
  let before = null;
  let command = null;
  try {
    before = await exactWorktreeFingerprint(resolvedRepoDir);
    const env = scrubReleaseEvidenceChildEnvironment(process.env, {
      unsetKeys: policy.unsetEnvironmentNames,
      unsetPrefixes: policy.unsetEnvironmentPrefixes
    });
    Object.assign(env, policy.command.environment);
    const executed = await executionRunner({
      executable: process.execPath,
      args: [...policy.command.args],
      cwd: resolvedRepoDir,
      env,
      stdoutPath,
      stderrPath,
      repoDir: resolvedRepoDir
    });
    const benchmarkArtifact = await readHashedArtifact({
      artifactPath: benchmarkOutputPath,
      repoDir: resolvedRepoDir,
      label: 'interactive benchmark report',
      includeBytes: true
    });
    const report = JSON.parse(benchmarkArtifact.bytes.toString('utf8'));
    const rawProbePath = report?.scenarios?.[0]?.rawProbeArtifact?.path;
    await assertDistinctOutputPaths([
      ['receipt output', resolvedReceiptPath],
      ['benchmark output', benchmarkOutputPath],
      ['benchmark stdout', stdoutPath],
      ['benchmark stderr', stderrPath],
      ['raw probe output', rawProbePath]
    ], resolvedRepoDir);
    const probeArtifact = await readHashedArtifact({
      artifactPath: rawProbePath,
      repoDir: resolvedRepoDir,
      label: 'interactive raw probe'
    });
    command = {
      invocationSha256: canonicalJsonSha256(policy.command),
      exitCode: executed.exitCode,
      signal: executed.signal,
      spawnError: executed.spawnError,
      stdoutArtifact: executed.stdoutArtifact,
      stderrArtifact: executed.stderrArtifact,
      benchmarkArtifact: {
        path: benchmarkArtifact.path,
        byteLength: benchmarkArtifact.byteLength,
        sha256: benchmarkArtifact.sha256
      },
      probeArtifact
    };
    const after = await exactWorktreeFingerprint(resolvedRepoDir);
    const candidateReceipt = {
      schema: INTERACTIVE_PRESENTATION_RECEIPT_SCHEMA,
      policyTrack: SS_CONTAINED_POLICY_TRACK,
      status: 'complete',
      commandPolicy: policy,
      executionProvenance,
      sourceFingerprintBefore: before,
      sourceFingerprintAfter: after,
      command
    };
    const artifactEvidence =
      await readInteractivePresentationArtifactEvidence({
        receipt: candidateReceipt,
        repoDir: resolvedRepoDir
      });
    const evaluation = evaluateInteractivePresentationReceiptForRoute(
      candidateReceipt,
      {
        expectedPolicy: policy,
        currentFingerprint: after,
        artifactEvidence
      }
    );
    const receipt = evaluation.passed
      ? {
          ...candidateReceipt,
          ...(evaluation.warnings.length > 0
            ? {
                semanticEvaluationWarnings: [...evaluation.warnings]
              }
            : {})
        }
      : {
          ...candidateReceipt,
          status: 'failed',
          reason:
            'interactive presentation semantic evaluation failed',
          semanticEvaluationFailures: [...evaluation.failures]
        };
    await writer.replace(receipt);
    return Object.freeze({
      receiptPath: writer.outputPath,
      receipt,
      evaluation
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const receipt = {
      ...failedSentinel(reason),
      commandPolicy: policy,
      sourceFingerprintBefore: before,
      command
    };
    await writer.replace(receipt);
    const evaluation = Object.freeze({
      passed: false,
      containedBlockingPassed: false,
      allTargetsPassed: false,
      physicsEvidencePassed: false,
      physicsPassed: false,
      marchingPassed: false,
      failures: Object.freeze([reason]),
      warnings: Object.freeze([]),
      events: Object.freeze([
        event({
          kind: 'ulg_perf_probe',
          name: INTERACTIVE_PRESENTATION_EVENT_NAMES.physics,
          passed: false,
          details: { evaluatorFailures: Object.freeze([reason]) },
          passSnippet: '',
          failSnippet: 'Interactive cached physics receipt production failed.'
        }),
        event({
          kind: 'ulg_sph_probe',
          name: INTERACTIVE_PRESENTATION_EVENT_NAMES.marching,
          passed: false,
          details: { evaluatorFailures: Object.freeze([reason]) },
          passSnippet: '',
          failSnippet: 'Interactive native marching-cubes receipt production failed.'
        })
      ])
    });
    return Object.freeze({
      receiptPath: writer.outputPath,
      receipt,
      evaluation
    });
  }
}

export async function runInteractivePresentationReceipt(options) {
  return runInteractivePresentationReceiptForRoute({
    ...options,
    route: INTERACTIVE_ROUTE.independent
  });
}

export async function runPairedV2OptInInteractivePresentationReceipt(options) {
  return runInteractivePresentationReceiptForRoute({
    ...options,
    route: INTERACTIVE_ROUTE.paired
  });
}

export function parseInteractivePresentationReceiptCliArgs(argv) {
  const args = Array.isArray(argv) ? [...argv] : [];
  const paired = args[0] === PAIRED_V2_OPT_IN_CLI_FLAG;
  if (paired) args.shift();
  const [receiptPath, artifactDir, ...extra] = args;
  if (!receiptPath || extra.length > 0) {
    throw new Error(
      'Usage: node scripts/stage6-interactive-presentation-receipt.mjs '
        + `[${PAIRED_V2_OPT_IN_CLI_FLAG}] <receipt.json> [artifact-directory]`
    );
  }
  return Object.freeze({
    route: paired ? INTERACTIVE_ROUTE.paired : INTERACTIVE_ROUTE.independent,
    receiptPath,
    ...(artifactDir == null ? {} : { artifactDir })
  });
}

async function main() {
  const options = parseInteractivePresentationReceiptCliArgs(process.argv.slice(2));
  const result = options.route === INTERACTIVE_ROUTE.paired
    ? await runPairedV2OptInInteractivePresentationReceipt(options)
    : await runInteractivePresentationReceipt(options);
  process.stdout.write(`${JSON.stringify({
    receiptPath: result.receiptPath,
    status: result.receipt.status,
    eligible: result.evaluation.passed,
    allTargetsPassed: result.evaluation.allTargetsPassed,
    events: result.evaluation.events.map(({ kind, name, status }) => ({
      kind,
      name,
      status
    })),
    failures: result.evaluation.failures,
    warnings: result.evaluation.warnings
  }, null, 2)}\n`);
  if (!result.evaluation.passed) process.exitCode = 1;
}

const executedAsScript = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;
if (executedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 2;
  });
}
