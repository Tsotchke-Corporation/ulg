import {
  mkdir,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

import {
  serializeSphInitialBodies,
  sphInitialBodiesFromLegacyDropBase
} from '../src/runtime/sphInitialBodies.js';
import {
  sphPhaseScenarioPresetUrl
} from '../src/runtime/sphPhaseScenarioPresets.js';
import {
  exactWorktreeFingerprint
} from './sph-performance-acceptance-campaign.mjs';

export const RESIDENT_HOT_LOOP_REPORT_SCHEMA =
  'peercompute.ulg.sph-resident-hot-loop-instrumented-probe.v1';
export const RESIDENT_HOT_LOOP_EVENT_KIND = 'ulg_sph_probe';
export const RESIDENT_HOT_LOOP_EVENT_NAME =
  'normal_hot_loop_readback_free';
export const RESIDENT_HOT_LOOP_MEASURED_STEP_COUNT = 2;
export const RESIDENT_HOT_LOOP_WARMUP_STEP_COUNT = 2;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRepoDir = path.resolve(scriptDir, '..');
const DEFAULT_BASE_URL = 'https://127.0.0.1:5174/';
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_REPORT_PATH =
  '/tmp/ulg-resident-hot-loop-instrumented-probe.json';
const DEFAULT_CHROMIUM_ARGS = Object.freeze([
  '--enable-unsafe-webgpu',
  '--use-angle=vulkan',
  '--enable-features=Vulkan,UseSkiaRenderer'
]);
const AUTHORITATIVE_STEP_STATUS =
  'schroeder-two-level-authoritative-step-executed';
const PAIRED_FIELD_CONSTRUCTION_MODE = 'paired-v2-shared-radix';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const NO_COMPACT_SUMMARY_MODE = 'none';
const PARTICLE_VISUAL_SUMMARY_SCOPE = 'particle-visual';
const MEASURED_EXECUTION_OWNER =
  'instrumented-page-direct-scene-refresh';
const CRITICAL_GPU_PATTERN =
  /\[ulg-gpu-uncaptured-error|\[ulg-gpu-device-lost|GPUOutOfMemoryError|WebGPU[^\n]{0,80}out[- ]of[- ]memory|\bdevice loss\b|\bGPUDevice\b[^\n]{0,80}\blost\b|\[Invalid (?:Buffer|BindGroup|CommandBuffer|ComputePipeline|ShaderModule)|WebGPU: too many warnings/i;

/**
 * Hash every tracked and untracked non-ignored file, plus exact Git status.
 * This intentionally matches the acceptance campaign's worktree identity
 * algorithm instead of trusting HEAD in a dirty candidate tree.
 */
export async function exactResidentProbeWorktreeFingerprint(repoDir) {
  return exactWorktreeFingerprint(path.resolve(repoDir));
}

const CESIUM_FLUORINE_TWO_LEVEL_BODIES = serializeSphInitialBodies(
  sphInitialBodiesFromLegacyDropBase({
    baseMaterial: 'F',
    dropMaterial: 'Cs',
    baseSizeM: [1, 1, 1],
    dropSizeM: [0.6, 0.6, 0.6],
    baseCenterM: [2, 0.5, 2],
    dropCenterM: [2, 1.31, 2],
    baseTemperatureK: 293.15,
    dropTemperatureK: 293.15,
    baseParticlesPerEdge: [5, 5, 5],
    dropParticlesPerEdge: [5, 5, 5]
  })
);
const CESIUM_FLUORINE_FINE_SUPPORT_RADIUS_M = Math.cbrt(
  (3 * (0.6 / 5) ** 3) / (4 * Math.PI)
);
const CESIUM_FLUORINE_TWO_LEVEL_BASE_DX_M =
  CESIUM_FLUORINE_FINE_SUPPORT_RADIUS_M / 1.5;

export function canonicalResidentHotLoopScenarioPath() {
  return sphPhaseScenarioPresetUrl('cesium-fluorine', {
    bodies: CESIUM_FLUORINE_TWO_LEVEL_BODIES,
    mech: 'mlsmpm',
    renderer: 'native-webgpu',
    renderOwnership: 'main-thread-renderer',
    surfaceDraw: 'metadata',
    visualCapture: '1',
    residentAuto: '0',
    // The interactive application requires its browser worker pool even when
    // resident playback is disabled. The measured interval below still calls
    // scene.refreshMlsMpmResidentSteps directly in this instrumented page;
    // residentStageWorkers=0 prevents worker-stage execution from escaping the
    // native wrappers installed here.
    residentWorkers: '1',
    residentStageWorkers: '0',
    residentActiveGrid: '0',
    residentFuseSequence: '0',
    residentQueueFence: '0',
    residentGpuTimestampProfile: '0',
    residentGpuTimestamp: '0',
    residentGpuTimestampFeature: '0',
    contactBinMetadataReadback: '0',
    reactionBinMetadataReadback: '0',
    anomalyRowReadback: '0',
    ss: '1',
    schroederLevel: '0',
    schroederMinLevel: '0',
    schroederMaxLevel: '1',
    schroederBaseGridSpacingM:
      String(CESIUM_FLUORINE_TWO_LEVEL_BASE_DX_M),
    schroederTwoLevel: '1',
    schroederMechanicsFieldPairV2: '1',
    schroederTwoLevelAuthority: 'authoritative',
    schroederTwoLevelSubsteps: '2',
    schroederCrossLevelCoupling: '1',
    schroederPortableSummary: '1',
    schroederActiveNodeIndex: '1',
    schroederPhaseVolumeMigration: '1',
    schroederLawQueue: '1',
    schroederLawNeighborCandidates: '1'
  });
}

export function canonicalResidentHotLoopScenarioEvidence(value) {
  let expected = null;
  let observed = null;
  try {
    expected = new URL(
      canonicalResidentHotLoopScenarioPath(),
      'https://ulg-resident-probe.invalid'
    );
    observed = new URL(
      String(value || ''),
      'https://ulg-resident-probe.invalid'
    );
  } catch {
    expected = null;
    observed = null;
  }
  const sortedEntries = (url) => (
    url
      ? [...url.searchParams.entries()].sort(([leftKey, leftValue], [
        rightKey,
        rightValue
      ]) => (
        leftKey.localeCompare(rightKey)
        || leftValue.localeCompare(rightValue)
      ))
      : []
  );
  const expectedEntries = sortedEntries(expected);
  const observedEntries = sortedEntries(observed);
  const complete = Boolean(
    expected
    && observed
    && observed.pathname === expected.pathname
    && observedEntries.length === expectedEntries.length
    && observedEntries.every(([key, entryValue], index) => (
      key === expectedEntries[index][0]
      && entryValue === expectedEntries[index][1]
    ))
  );
  return Object.freeze({
    complete,
    expectedPathname: expected?.pathname ?? null,
    observedPathname: observed?.pathname ?? null,
    expectedParamCount: expectedEntries.length,
    observedParamCount: observedEntries.length,
    expectedParams: Object.freeze(Object.fromEntries(expectedEntries)),
    observedParams: Object.freeze(Object.fromEntries(observedEntries))
  });
}

function exactFingerprint(value) {
  return Boolean(
    value
    && typeof value.gitHead === 'string'
    && /^[0-9a-f]{40,64}$/u.test(value.gitHead)
    && typeof value.sourceFingerprint === 'string'
    && /^[0-9a-f]{64}$/u.test(value.sourceFingerprint)
    && typeof value.worktreeDirty === 'boolean'
    && typeof value.worktreeStatusHash === 'string'
    && /^[0-9a-f]{64}$/u.test(value.worktreeStatusHash)
    && Number.isSafeInteger(value.trackedAndUntrackedFileCount)
    && value.trackedAndUntrackedFileCount >= 0
  );
}

function fingerprintsEqual(left, right) {
  return Boolean(
    exactFingerprint(left)
    && exactFingerprint(right)
    && left.gitHead === right.gitHead
    && left.sourceFingerprint === right.sourceFingerprint
    && left.worktreeDirty === right.worktreeDirty
    && left.worktreeStatusHash === right.worktreeStatusHash
    && left.trackedAndUntrackedFileCount
      === right.trackedAndUntrackedFileCount
  );
}

function exactZero(value) {
  return Number.isSafeInteger(value) && value === 0;
}

function telemetrySourceComplete(source, expectedLabel) {
  return Boolean(
    source
    && source.label === expectedLabel
    && source.readbackTelemetryComplete === true
    && Array.isArray(source.readbackTelemetryUnknownSources)
    && source.readbackTelemetryUnknownSources.length === 0
    && exactZero(source.mapAsyncCount)
    && exactZero(source.readbackBytes)
    && exactZero(source.hostQueueFenceCount)
    && exactZero(source.observedMapAsyncCount)
    && exactZero(source.observedReadbackBytes)
    && exactZero(source.observedHostQueueFenceCount)
    && source.normalHotLoopReadbackFree === true
    && source.fullParticleReadbackPerformed === false
    && source.fullParticleReadbackFree === true
  );
}

function exactScenarioConfiguration(configuration) {
  return Boolean(
    configuration
    && configuration.scenarioId === 'cesium-fluorine'
    && configuration.mechanics === 'mlsmpm'
    && configuration.schroederSimulation === true
    && configuration.twoLevelMechanics === true
    && configuration.mechanicsFieldPairV2 === true
    && configuration.twoLevelAuthority === 'authoritative'
    && configuration.twoLevelFineSubstepCount === 2
    && configuration.stageWorkersEnabled === false
    && configuration.residentWorkersEnabled === true
    && configuration.residentAutoEnabled === false
    && configuration.measuredExecutionOwner
      === MEASURED_EXECUTION_OWNER
    && configuration.gpuTimestampsEnabled === false
    && configuration.diagnosticReadbacksEnabled === false
    && configuration.renderRefreshPerformed === false
    && configuration.readbackMode === NO_FULL_READBACK_MODE
    && configuration.compactSummaryMode === NO_COMPACT_SUMMARY_MODE
    && configuration.compactSummaryScope
      === PARTICLE_VISUAL_SUMMARY_SCOPE
    && configuration.canonicalScenarioIdentity?.complete === true
    && canonicalResidentHotLoopScenarioEvidence(
      configuration.scenarioUrl
    ).complete === true
    && configuration.warmupStepCount
      === RESIDENT_HOT_LOOP_WARMUP_STEP_COUNT
    && configuration.measuredStepCount
      === RESIDENT_HOT_LOOP_MEASURED_STEP_COUNT
  );
}

/**
 * Pure fail-closed evaluator. Unknown, missing, non-integral, or merely
 * configured evidence never counts as an observed zero.
 */
export function evaluateResidentHotLoopProbe(report) {
  const failures = [];
  const evidence = report?.evidence;
  const identity = report?.worktreeIdentity;
  const instrumentation = evidence?.instrumentation;
  const execution = evidence?.execution;
  const liveness = execution?.liveness;
  const settlement = execution?.settlement;
  const runtimeTelemetry = execution?.runtimeReadbackTelemetry;

  if (report?.schema !== RESIDENT_HOT_LOOP_REPORT_SCHEMA) {
    failures.push('report-schema-mismatch');
  }
  if (report?.probeError != null) {
    failures.push('probe-execution-error');
  }
  if (!exactScenarioConfiguration(evidence?.configuration)) {
    failures.push('canonical-measured-configuration-incomplete');
  }
  if (
    evidence?.browser?.headless !== true
    || evidence?.browser?.ownership
      !== 'playwright-launched-isolated-browser'
  ) {
    failures.push('isolated-headless-browser-evidence-incomplete');
  }
  if (
    instrumentation?.bufferMapWrapperInstalled !== true
    || instrumentation?.queueFenceWrapperInstalled !== true
    || instrumentation?.mappedRangeWrapperInstalled !== true
    || instrumentation?.wrappersIntact !== true
    || !Array.isArray(instrumentation?.mapAsyncCallsites)
    || !Array.isArray(instrumentation?.mappedRangeCallsites)
    || !Array.isArray(instrumentation?.queueFenceCallsites)
  ) {
    failures.push('native-wrapper-installation-or-integrity-incomplete');
  }
  if (!exactZero(instrumentation?.mapAsyncCount)) {
    failures.push('native-map-async-count-nonzero-or-unknown');
  }
  if (!exactZero(instrumentation?.mapAsyncRequestedBytes)) {
    failures.push('native-map-async-requested-bytes-nonzero-or-unknown');
  }
  if (!exactZero(instrumentation?.getMappedRangeCount)) {
    failures.push('native-mapped-range-count-nonzero-or-unknown');
  }
  if (!exactZero(instrumentation?.mappedByteLength)) {
    failures.push('native-mapped-byte-length-nonzero-or-unknown');
  }
  if (!exactZero(instrumentation?.queueFenceCount)) {
    failures.push('native-queue-fence-count-nonzero-or-unknown');
  }
  if (
    instrumentation?.deviceFaultWatcherInstalled !== true
    || !Number.isSafeInteger(instrumentation?.attachedDeviceCount)
    || instrumentation.attachedDeviceCount < 1
  ) {
    failures.push('gpu-device-fault-watcher-incomplete');
  }
  if (
    !Array.isArray(instrumentation?.gpuErrors)
    || instrumentation.gpuErrors.length !== 0
    || !Array.isArray(instrumentation?.deviceLosses)
    || instrumentation.deviceLosses.length !== 0
    || !Array.isArray(instrumentation?.browserGpuIssues)
    || instrumentation.browserGpuIssues.length !== 0
    || !Array.isArray(instrumentation?.pageErrors)
    || instrumentation.pageErrors.length !== 0
  ) {
    failures.push('gpu-error-device-loss-or-page-error-observed');
  }

  if (
    execution?.schema == null
    || execution?.status !== 'resident-steps-executed'
    || execution?.backend !== 'webgpu'
    || execution?.schroederSimulation !== true
    || execution?.stepCount !== RESIDENT_HOT_LOOP_MEASURED_STEP_COUNT
    || execution?.completedStepCount
      !== RESIDENT_HOT_LOOP_MEASURED_STEP_COUNT
  ) {
    failures.push('resident-two-step-execution-incomplete');
  }
  if (
    liveness?.continuedFromWarmup !== true
    || liveness?.continuationAvailable !== true
    || !Number.isSafeInteger(liveness?.stepBefore)
    || !Number.isSafeInteger(liveness?.stepAfter)
    || liveness.stepAfter - liveness.stepBefore
      !== RESIDENT_HOT_LOOP_MEASURED_STEP_COUNT
    || liveness?.authoritativeStepCount
      !== RESIDENT_HOT_LOOP_MEASURED_STEP_COUNT
    || liveness?.finalStepStatus !== AUTHORITATIVE_STEP_STATUS
    || liveness?.twoLevelAuthority !== 'authoritative'
    || liveness?.twoLevelFineSubstepCount !== 2
    || liveness?.authoritativeCommitVerified !== true
    || liveness?.mechanicsFieldPairV2Enabled !== true
    || liveness?.mechanicsFieldConstructionMode
      !== PAIRED_FIELD_CONSTRUCTION_MODE
  ) {
    failures.push('authoritative-two-level-liveness-incomplete');
  }
  if (
    !Array.isArray(liveness?.stepStatuses)
    || liveness.stepStatuses.length
      !== RESIDENT_HOT_LOOP_MEASURED_STEP_COUNT
    || liveness.stepStatuses.some(
      (status) => status !== AUTHORITATIVE_STEP_STATUS
    )
  ) {
    failures.push('authoritative-step-status-coverage-incomplete');
  }
  if (
    settlement?.backgroundSettlementConfirmed !== true
    || settlement?.spatialEpochReleaseSettlementComplete !== true
    || settlement?.spatialEpochReleaseSettlementCount
      !== RESIDENT_HOT_LOOP_MEASURED_STEP_COUNT
    || settlement?.hierarchyArtifactLedgerSettlementComplete !== true
    || settlement?.hierarchyArtifactLedgerSettlementCount
      !== RESIDENT_HOT_LOOP_MEASURED_STEP_COUNT
    || settlement?.successorRetirementComplete !== true
    || !Array.isArray(settlement?.transactionStates)
    || settlement.transactionStates.length
      !== RESIDENT_HOT_LOOP_MEASURED_STEP_COUNT
    || settlement.transactionStates.some(
      (entry) => entry?.state !== 'released' || entry?.releaseCount !== 1
    )
    || !Array.isArray(settlement?.artifactLedgerSafe)
    || settlement.artifactLedgerSafe.length
      !== RESIDENT_HOT_LOOP_MEASURED_STEP_COUNT
    || settlement.artifactLedgerSafe.some((safe) => safe !== true)
  ) {
    failures.push('authoritative-lifecycle-settlement-incomplete');
  }
  if (
    runtimeTelemetry?.sourceCount !== 4
    || !Array.isArray(runtimeTelemetry?.sources)
    || runtimeTelemetry.sources.length !== 4
    || !telemetrySourceComplete(
      runtimeTelemetry.sources[0],
      'resident-execution'
    )
    || !telemetrySourceComplete(
      runtimeTelemetry.sources[1],
      'resident-final-step'
    )
    || !telemetrySourceComplete(
      runtimeTelemetry.sources[2],
      'schroeder-mechanics-step-0'
    )
    || !telemetrySourceComplete(
      runtimeTelemetry.sources[3],
      'schroeder-mechanics-step-1'
    )
  ) {
    failures.push('runtime-readback-telemetry-incomplete-or-nonzero');
  }
  const observedRuntimeTelemetry = runtimeTelemetry?.sources?.[0];
  if (
    Number.isSafeInteger(instrumentation?.mapAsyncCount)
    && Number.isSafeInteger(instrumentation?.mapAsyncRequestedBytes)
    && Number.isSafeInteger(instrumentation?.queueFenceCount)
    && (
      observedRuntimeTelemetry?.observedMapAsyncCount
        !== instrumentation.mapAsyncCount
      || observedRuntimeTelemetry?.observedReadbackBytes
        !== instrumentation.mapAsyncRequestedBytes
      || observedRuntimeTelemetry?.observedHostQueueFenceCount
        !== instrumentation.queueFenceCount
    )
  ) {
    failures.push('runtime-telemetry-diverged-from-native-observation');
  }
  if (
    !exactFingerprint(identity?.before)
    || !fingerprintsEqual(identity?.before, identity?.after)
    || !fingerprintsEqual(identity?.before, identity?.current)
  ) {
    failures.push('worktree-fingerprint-drift-or-incomplete');
  }

  return Object.freeze({
    passed: failures.length === 0,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    failureReasons: Object.freeze(failures)
  });
}

export function finalizeResidentHotLoopProbeReport(report) {
  const candidate = {
    ...report,
    schema: RESIDENT_HOT_LOOP_REPORT_SCHEMA
  };
  const evaluation = evaluateResidentHotLoopProbe(candidate);
  return Object.freeze({
    ...candidate,
    status: evaluation.status,
    evaluation
  });
}

export function residentHotLoopProbeIccEvent(report, {
  reportPath = null
} = {}) {
  const evaluation = evaluateResidentHotLoopProbe(report);
  const passed = report?.status === 'PASS' && evaluation.passed;
  const status = passed ? 'PASS' : 'FAIL';
  return Object.freeze({
    kind: RESIDENT_HOT_LOOP_EVENT_KIND,
    name: RESIDENT_HOT_LOOP_EVENT_NAME,
    status,
    value: status,
    details: Object.freeze({
      authentic: passed,
      reportPath,
      reportSchema: report?.schema ?? null,
      sourceFingerprint:
        report?.worktreeIdentity?.current?.sourceFingerprint ?? null,
      sourceFingerprintBefore:
        report?.worktreeIdentity?.before?.sourceFingerprint ?? null,
      sourceFingerprintAfter:
        report?.worktreeIdentity?.after?.sourceFingerprint ?? null,
      sourceFingerprintCurrent:
        report?.worktreeIdentity?.current?.sourceFingerprint ?? null,
      fingerprintStable: fingerprintsEqual(
        report?.worktreeIdentity?.before,
        report?.worktreeIdentity?.after
      ) && fingerprintsEqual(
        report?.worktreeIdentity?.before,
        report?.worktreeIdentity?.current
      ),
      gitHead: report?.worktreeIdentity?.current?.gitHead ?? null,
      worktreeStatusHash:
        report?.worktreeIdentity?.current?.worktreeStatusHash ?? null,
      worktreeDirty:
        report?.worktreeIdentity?.current?.worktreeDirty ?? null,
      trackedAndUntrackedFileCount:
        report?.worktreeIdentity?.current
          ?.trackedAndUntrackedFileCount ?? null,
      measuredStepCount:
        report?.evidence?.configuration?.measuredStepCount ?? null,
      mapAsyncCount:
        report?.evidence?.instrumentation?.mapAsyncCount ?? null,
      mappedByteLength:
        report?.evidence?.instrumentation?.mappedByteLength ?? null,
      queueFenceCount:
        report?.evidence?.instrumentation?.queueFenceCount ?? null,
      failureReasons: [...evaluation.failureReasons]
    }),
    snippet: passed
      ? 'Direct native instrumentation observed a fingerprint-stable canonical authoritative Cs/F two-step interval with zero CPU maps, mapped bytes, and awaited queue fences.'
      : 'The dedicated native resident hot-loop observation was missing, stale, incomplete, or observed host synchronization.'
  });
}

export function failClosedResidentHotLoopSentinel({
  reportPath = null,
  reason = 'probe-not-completed'
} = {}) {
  const report = Object.freeze({
    schema: RESIDENT_HOT_LOOP_REPORT_SCHEMA,
    status: 'FAIL',
    failClosedSentinel: true,
    reason,
    worktreeIdentity: {
      before: null,
      after: null,
      current: null
    },
    evidence: null,
    evaluation: {
      passed: false,
      status: 'FAIL',
      failureReasons: [reason]
    }
  });
  return Object.freeze({
    report,
    event: residentHotLoopProbeIccEvent(report, { reportPath })
  });
}

async function writeArtifacts({ reportPath, tracePath, report, event }) {
  await Promise.all([
    mkdir(path.dirname(reportPath), { recursive: true }),
    mkdir(path.dirname(tracePath), { recursive: true })
  ]);
  const writeReport = () => writeFile(
    reportPath,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  const writeTrace = () => writeFile(
    tracePath,
    `${JSON.stringify(event)}\n`,
    'utf8'
  );
  if (event?.status === 'PASS') {
    // A PASS receipt is published last, only after its complete report exists.
    await writeReport();
    await writeTrace();
  } else {
    // Invalidation is receipt-first so an interrupted rerun cannot retain a
    // stale PASS event while its new fail-closed report is being written.
    await writeTrace();
    await writeReport();
  }
}

export async function prewriteResidentHotLoopFailSentinel({
  reportPath,
  tracePath,
  reason = 'probe-started-pass-not-yet-proved'
}) {
  const resolvedReportPath = path.resolve(reportPath);
  const resolvedTracePath = path.resolve(tracePath);
  if (resolvedReportPath === resolvedTracePath) {
    throw new Error('Report and ICC JSONL paths must be distinct');
  }
  const sentinel = failClosedResidentHotLoopSentinel({
    reportPath: resolvedReportPath,
    reason
  });
  await writeArtifacts({
    reportPath: resolvedReportPath,
    tracePath: resolvedTracePath,
    ...sentinel
  });
  return sentinel;
}

export async function writeResidentHotLoopProbeArtifacts({
  reportPath,
  tracePath,
  report
}) {
  const resolvedReportPath = path.resolve(reportPath);
  const resolvedTracePath = path.resolve(tracePath);
  if (resolvedReportPath === resolvedTracePath) {
    throw new Error('Report and ICC JSONL paths must be distinct');
  }
  const finalized = finalizeResidentHotLoopProbeReport(report);
  const event = residentHotLoopProbeIccEvent(finalized, {
    reportPath: resolvedReportPath
  });
  await writeArtifacts({
    reportPath: resolvedReportPath,
    tracePath: resolvedTracePath,
    report: finalized,
    event
  });
  return Object.freeze({ report: finalized, event });
}

function pathIsInside(rootPath, candidatePath) {
  const relative = path.relative(
    path.resolve(rootPath),
    path.resolve(candidatePath)
  );
  return relative === ''
    || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
}

export function assertResidentProbeArtifactPathsOutsideRepo({
  repoDir,
  reportPath,
  tracePath
}) {
  const resolvedRepoDir = path.resolve(repoDir);
  const resolvedReportPath = path.resolve(reportPath);
  const resolvedTracePath = path.resolve(tracePath);
  if (
    pathIsInside(resolvedRepoDir, resolvedReportPath)
    || pathIsInside(resolvedRepoDir, resolvedTracePath)
  ) {
    throw new Error(
      'Resident hot-loop runtime artifacts must stay outside the source '
      + 'repository so artifact writes cannot mutate their own fingerprint'
    );
  }
  return Object.freeze({
    repoDir: resolvedRepoDir,
    reportPath: resolvedReportPath,
    tracePath: resolvedTracePath
  });
}

function positiveInteger(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function parseChromiumArgs(value) {
  return String(value || '')
    .split(/\s+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function chromiumLaunchOptions() {
  const extraArgs = parseChromiumArgs(
    process.env.ULG_RESIDENT_HOT_LOOP_CHROMIUM_ARGS
  );
  const args = [...new Set([...DEFAULT_CHROMIUM_ARGS, ...extraArgs])];
  const executablePath = String(
    process.env.ULG_RESIDENT_HOT_LOOP_CHROMIUM_EXECUTABLE || ''
  ).trim();
  const channel = String(
    process.env.ULG_RESIDENT_HOT_LOOP_CHROMIUM_CHANNEL || ''
  ).trim();
  return {
    headless: true,
    args,
    ...(executablePath ? { executablePath } : {}),
    ...(channel ? { channel } : {})
  };
}

async function ensureOverlay(page, timeoutMs) {
  const overlay = page.locator('#sph-phase-overlay');
  if (await overlay.count() === 0) {
    await page.locator('#run-sph-phase').click({
      timeout: Math.min(timeoutMs, 30_000)
    }).catch(async (error) => {
      if (await overlay.count() > 0) return;
      throw error;
    });
  }
  await page.waitForSelector('#sph-phase-overlay', { timeout: timeoutMs });
  const target = new URL(page.url());
  const hashParams = new URLSearchParams(target.hash.replace(/^#/, ''));
  const param = (name) => (
    target.searchParams.get(name) ?? hashParams.get(name)
  );
  const expectedRoute = Object.freeze({
    twoLevelMechanics: param('schroederTwoLevel') === '1',
    mechanicsFieldPairV2:
      param('schroederMechanicsFieldPairV2') === '1',
    twoLevelMechanicsAuthority:
      param('schroederTwoLevelAuthority') ?? 'observation'
  });
  await page.waitForFunction((expected) => {
    const mounted = document.querySelector('#sph-phase-overlay');
    const scene = mounted?.__sphScene;
    const config = mounted?.__sphSchroederSimulationConfig;
    return Boolean(
      mounted?.__sphSimulationRuntimeAdmission?.ready === true
      && !mounted?.__sphCpuClosureTask?.active
      && scene?.getSphGpuParticleState?.()?.schema
      && scene?.getMlsMpmGpuParticleState?.()?.schema
      && typeof scene?.refreshMlsMpmResidentSteps === 'function'
      && config?.enabled === true
      && config?.enableTwoLevelMechanics
        === expected.twoLevelMechanics
      && config?.enableMechanicsFieldPairV2
        === expected.mechanicsFieldPairV2
      && (
        expected.twoLevelMechanics !== true
        || config?.twoLevelMechanicsAuthority
          === expected.twoLevelMechanicsAuthority
      )
      && (
        expected.twoLevelMechanics !== true
        || config?.twoLevelFineSubstepCount === 2
      )
      && !mounted?.__mlsMpmResidentStepsPending
    );
  }, expectedRoute, { timeout: timeoutMs });
}

function installPageInstrumentation() {
  if (globalThis.__ulgResidentHotLoopInstrumentation) return;
  const counters = {
    mapAsyncCount: 0,
    mapAsyncRequestedBytes: 0,
    getMappedRangeCount: 0,
    mappedByteLength: 0,
    queueFenceCount: 0
  };
  const gpuErrors = [];
  const deviceLosses = [];
  const mapAsyncCallsites = [];
  const mappedRangeCallsites = [];
  const queueFenceCallsites = [];
  const seenDevices = new WeakSet();
  const installed = {
    bufferMap: false,
    mappedRange: false,
    queueFence: false,
    deviceFaultWatcher: false
  };
  const wrappers = {
    mapAsync: null,
    getMappedRange: null,
    onSubmittedWorkDone: null,
    requestDevice: null
  };
  let attachedDeviceCount = 0;
  let installAttempts = 0;
  let resetOrdinal = 0;
  const recordCallsite = (target, ordinal) => {
    if (target.length >= 128) return;
    target.push({
      ordinal,
      stack: new Error('native synchronization observed').stack || null
    });
  };

  const finiteMappedLength = (buffer, offset, requestedSize) => {
    const start = Math.max(0, Number(offset) || 0);
    const size = Number(requestedSize);
    if (Number.isFinite(size) && size >= 0) return Math.round(size);
    const bufferSize = Number(buffer?.size);
    return Number.isFinite(bufferSize)
      ? Math.max(0, Math.round(bufferSize - start))
      : 0;
  };
  const attachDevice = (device) => {
    if (!device || seenDevices.has(device)) return device;
    seenDevices.add(device);
    attachedDeviceCount += 1;
    device.addEventListener?.('uncapturederror', (event) => {
      const error = event?.error || null;
      gpuErrors.push({
        name: error?.name || error?.constructor?.name || 'GPUError',
        message: error?.message || String(error || 'unknown WebGPU error')
      });
    });
    Promise.resolve(device.lost).then((info) => {
      deviceLosses.push({
        reason: info?.reason || 'unknown',
        message: info?.message || 'WebGPU device lost without a message'
      });
    }).catch((error) => {
      deviceLosses.push({
        reason: 'device-lost-watch-error',
        message: error?.message || String(error)
      });
    });
    return device;
  };

  const install = () => {
    installAttempts += 1;
    const bufferPrototype = globalThis.GPUBuffer?.prototype;
    if (
      !installed.bufferMap
      && typeof bufferPrototype?.mapAsync === 'function'
    ) {
      const original = bufferPrototype.mapAsync;
      wrappers.mapAsync = function (...args) {
        counters.mapAsyncCount += 1;
        recordCallsite(mapAsyncCallsites, counters.mapAsyncCount);
        counters.mapAsyncRequestedBytes += finiteMappedLength(
          this,
          args[1],
          args[2]
        );
        return original.apply(this, args);
      };
      Object.defineProperty(bufferPrototype, 'mapAsync', {
        configurable: true,
        writable: true,
        value: wrappers.mapAsync
      });
      installed.bufferMap = true;
    }
    if (
      !installed.mappedRange
      && typeof bufferPrototype?.getMappedRange === 'function'
    ) {
      const original = bufferPrototype.getMappedRange;
      wrappers.getMappedRange = function (...args) {
        counters.getMappedRangeCount += 1;
        recordCallsite(mappedRangeCallsites, counters.getMappedRangeCount);
        counters.mappedByteLength += finiteMappedLength(
          this,
          args[0],
          args[1]
        );
        return original.apply(this, args);
      };
      Object.defineProperty(bufferPrototype, 'getMappedRange', {
        configurable: true,
        writable: true,
        value: wrappers.getMappedRange
      });
      installed.mappedRange = true;
    }
    const queuePrototype = globalThis.GPUQueue?.prototype;
    if (
      !installed.queueFence
      && typeof queuePrototype?.onSubmittedWorkDone === 'function'
    ) {
      const original = queuePrototype.onSubmittedWorkDone;
      wrappers.onSubmittedWorkDone = function (...args) {
        counters.queueFenceCount += 1;
        recordCallsite(queueFenceCallsites, counters.queueFenceCount);
        return original.apply(this, args);
      };
      Object.defineProperty(queuePrototype, 'onSubmittedWorkDone', {
        configurable: true,
        writable: true,
        value: wrappers.onSubmittedWorkDone
      });
      installed.queueFence = true;
    }
    const adapterPrototype = globalThis.GPUAdapter?.prototype;
    if (
      !installed.deviceFaultWatcher
      && typeof adapterPrototype?.requestDevice === 'function'
    ) {
      const original = adapterPrototype.requestDevice;
      wrappers.requestDevice = async function (...args) {
        return attachDevice(await original.apply(this, args));
      };
      Object.defineProperty(adapterPrototype, 'requestDevice', {
        configurable: true,
        writable: true,
        value: wrappers.requestDevice
      });
      installed.deviceFaultWatcher = true;
    }
    if (
      !installed.bufferMap
      || !installed.mappedRange
      || !installed.queueFence
      || !installed.deviceFaultWatcher
    ) {
      if (installAttempts < 1000) setTimeout(install, 10);
    }
  };
  const wrappersIntact = () => Boolean(
    installed.bufferMap
    && installed.mappedRange
    && installed.queueFence
    && globalThis.GPUBuffer?.prototype?.mapAsync === wrappers.mapAsync
    && globalThis.GPUBuffer?.prototype?.getMappedRange
      === wrappers.getMappedRange
    && globalThis.GPUQueue?.prototype?.onSubmittedWorkDone
      === wrappers.onSubmittedWorkDone
  );
  globalThis.__ulgResidentHotLoopInstrumentation = Object.freeze({
    install,
    attachDevice,
    reset() {
      for (const key of Object.keys(counters)) counters[key] = 0;
      mapAsyncCallsites.length = 0;
      mappedRangeCallsites.length = 0;
      queueFenceCallsites.length = 0;
      resetOrdinal += 1;
      return resetOrdinal;
    },
    snapshot() {
      return {
        ...counters,
        bufferMapWrapperInstalled: installed.bufferMap,
        mappedRangeWrapperInstalled: installed.mappedRange,
        queueFenceWrapperInstalled: installed.queueFence,
        deviceFaultWatcherInstalled: installed.deviceFaultWatcher,
        wrappersIntact: wrappersIntact(),
        installAttempts,
        resetOrdinal,
        attachedDeviceCount,
        mapAsyncCallsites: mapAsyncCallsites.map((entry) => ({ ...entry })),
        mappedRangeCallsites:
          mappedRangeCallsites.map((entry) => ({ ...entry })),
        queueFenceCallsites:
          queueFenceCallsites.map((entry) => ({ ...entry })),
        gpuErrors: gpuErrors.map((entry) => ({ ...entry })),
        deviceLosses: deviceLosses.map((entry) => ({ ...entry }))
      };
    }
  });
  install();
}

async function runMeasuredPageInterval(page) {
  return page.evaluate(async ({
    warmupStepCount,
    measuredStepCount,
    noFullReadbackMode,
    compactSummaryMode,
    compactSummaryScope,
    authoritativeStepStatus,
    measuredExecutionOwner
  }) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene || null;
    const instrumentation =
      globalThis.__ulgResidentHotLoopInstrumentation || null;
    if (!overlay || !scene || !instrumentation) {
      throw new Error('Mounted scene or native instrumentation is unavailable');
    }
    instrumentation.install();
    const residentDevice = await scene.requestOpticalGpuDevice?.();
    instrumentation.attachDevice(residentDevice?.device ?? null);
    const config = overlay.__sphSchroederSimulationConfig || {};
    // residentAuto=0 intentionally leaves the scheduler-owned option snapshot
    // unpublished. Reconstruct the same exact options from the mounted config
    // so this direct, instrumented page call cannot silently fall back to the
    // generic single-level path.
    const schroederOptions =
      overlay.__mlsMpmSchroederExecutionOptions
      || (config.enabled === true
        ? {
            schroederSimulation: true,
            schroederSelectedLevel: config.selectedLevel,
            schroederSpatialArenaCount: config.spatialArenaCount,
            schroederBaseGridSpacingM: config.baseGridSpacingM,
            schroederMinLevel: config.minLevel,
            schroederMaxLevel: config.maxLevel,
            schroederTileCellCount: config.tileCellCount,
            schroederEnablePortableSummary: config.enablePortableSummary,
            schroederPortableSummaryPeerComputeUseCase:
              config.portableSummaryPeerComputeUseCase,
            schroederEnableActiveNodeIndex: config.enableActiveNodeIndex,
            schroederEnableActiveNodeSortedIndex:
              config.enableActiveNodeSortedIndex,
            schroederActiveNodeSortedIndexPolicyMode:
              config.activeNodeSortedIndexPolicyMode,
            schroederLawNeighborTraversalPolicyMode:
              config.lawNeighborTraversalPolicyMode,
            schroederLawNeighborCandidateReadbackMode:
              config.lawNeighborCandidateReadbackMode,
            schroederEnableCrossLevelCoupling:
              config.enableCrossLevelCoupling,
            schroederEnablePhaseVolumeMigration:
              config.enablePhaseVolumeMigration,
            schroederEnableLawQueue: config.enableLawQueue,
            schroederEnableLawNeighborCandidates:
              config.enableLawNeighborCandidates,
            schroederEnableTwoLevelMechanics:
              config.enableTwoLevelMechanics,
            schroederEnableMechanicsFieldPairV2:
              config.enableMechanicsFieldPairV2,
            schroederTwoLevelMechanicsAuthority:
              config.twoLevelMechanicsAuthority,
            schroederTwoLevelFineSubstepCount:
              config.twoLevelFineSubstepCount,
            schroederEnableParticleStorageMaterialization:
              config.enableParticleStorageMaterialization,
            schroederParticleStorageAdmissionRowBudget:
              config.particleStorageAdmissionRowBudget,
            schroederParticleStorageRequiredCapacity:
              config.particleStorageRequiredCapacity,
            schroederParticleStorageCapacityMargin:
              config.particleStorageCapacityMargin,
            schroederParticleStorageFreeListSlotCapacity:
              config.particleStorageFreeListSlotCapacity,
            schroederParticleStorageFreeListAvailableSlotCount:
              config.particleStorageFreeListAvailableSlotCount,
            schroederParticleStorageFreeListMaxSlotsPerRow:
              config.particleStorageFreeListMaxSlotsPerRow
          }
        : { schroederSimulation: false });
    const residentPolicy = {
      ...(overlay.__mlsMpmResidentExecutionPolicy || {}),
      fuseNoFullResidentMechanicsSequence: false,
      fuseNoFullResidentMechanicsActiveGrid: false,
      activeGridDispatchPlanRefreshMode: 'none',
      measureFusedSequenceQueueFence: false
    };
    const execute = async ({ stepCount, continueFromResidentState }) => {
      const execution = await scene.refreshMlsMpmResidentSteps({
        preferWebGpu: true,
        force: true,
        stepCount,
        readbackMode: noFullReadbackMode,
        compactSummaryMode,
        compactSummaryScope,
        continueFromResidentState,
        emitResidentProgressConsole: false,
        contactKinematicsParticleBinMetadataReadback: false,
        reactionParticleBinMetadataReadback: false,
        schroederPressureInterfaceOwnerScopeDiagnosticReadback: false,
        schroederGpuTimestampRecorder: null,
        measureFusedSequenceQueueFence: false,
        gasPressureSummary:
          overlay.__sphResidentGasPressureSummary
          || overlay.__sphPhaseViewState?.gasPressureSummary
          || null,
        ...residentPolicy,
        ...schroederOptions
      });
      const background = execution?.schroederBackgroundSettlementPromise;
      let backgroundSettlementConfirmed = false;
      if (background && typeof background.then === 'function') {
        backgroundSettlementConfirmed = await background;
      } else {
        backgroundSettlementConfirmed = Boolean(
          execution?.schroederSpatialEpochReleaseSettlementComplete
          && execution?.schroederHierarchyArtifactLedgerSettlementComplete
          && execution?.schroederSuccessorSourceFamilyRetirementComplete
        );
      }
      if (backgroundSettlementConfirmed !== true) {
        throw new Error('Resident lifecycle background settlement did not complete');
      }
      return execution;
    };

    const warmup = await execute({
      stepCount: warmupStepCount,
      continueFromResidentState: Boolean(
        scene.getMlsMpmResidentSteps?.()?.continuationAvailable
      )
    });
    overlay.__mlsMpmResidentSteps = warmup;
    const stepBefore = Number(
      warmup?.nextSphParticleState?.step
      ?? warmup?.nextMlsMpmParticleState?.step
    );
    const resetOrdinal = instrumentation.reset();
    const beforeInstrumentation = instrumentation.snapshot();
    if (
      beforeInstrumentation.wrappersIntact !== true
      || beforeInstrumentation.resetOrdinal !== resetOrdinal
    ) {
      throw new Error('Native instrumentation wrappers were not intact after warmup');
    }

    const execution = await execute({
      stepCount: measuredStepCount,
      continueFromResidentState: true
    });
    const nativeInstrumentation = instrumentation.snapshot();
    const finalStep = execution?.finalStep || null;
    const mechanicsSummaries = Array.isArray(
      execution?.schroederSameLevelMechanicsSummaries
    ) ? execution.schroederSameLevelMechanicsSummaries : [];
    const stepSummaries = Array.isArray(execution?.stepSummaries)
      ? execution.stepSummaries
      : [];
    const transactions = Array.isArray(
      execution?.schroederSpatialEpochTransactionSummaries
    ) ? execution.schroederSpatialEpochTransactionSummaries : [];
    const ledgers = Array.isArray(
      execution?.schroederHierarchyArtifactLedgerSummaries
    ) ? execution.schroederHierarchyArtifactLedgerSummaries : [];
    const finalMechanics = mechanicsSummaries.at(-1)
      || execution?.schroederSameLevelMechanics
      || null;
    const stepAfter = Number(
      execution?.nextSphParticleState?.step
      ?? execution?.nextMlsMpmParticleState?.step
    );
    const runtimeSources = [
      {
        label: 'resident-execution',
        source: execution
      },
      {
        label: 'resident-final-step',
        source: finalStep
      },
      ...mechanicsSummaries.map((source, index) => ({
        label: `schroeder-mechanics-step-${index}`,
        source
      }))
    ].map(({ source, label }) => ({
      label,
      readbackTelemetrySchema: source?.readbackTelemetrySchema ?? null,
      readbackTelemetryScope: source?.readbackTelemetryScope ?? null,
      readbackTelemetryComplete:
        source?.readbackTelemetryComplete === true,
      readbackTelemetryUnknownSources: [
        ...(source?.readbackTelemetryUnknownSources || [])
      ],
      mapAsyncCount: source?.mapAsyncCount ?? null,
      readbackBytes: source?.readbackBytes ?? null,
      hostQueueFenceCount: source?.hostQueueFenceCount ?? null,
      observedMapAsyncCount: source?.observedMapAsyncCount ?? null,
      observedReadbackBytes: source?.observedReadbackBytes ?? null,
      observedHostQueueFenceCount:
        source?.observedHostQueueFenceCount ?? null,
      normalHotLoopReadbackFree:
        source?.normalHotLoopReadbackFree === true,
      fullParticleReadbackPerformed:
        typeof source?.fullParticleReadbackPerformed === 'boolean'
          ? source.fullParticleReadbackPerformed
          : null,
      fullParticleReadbackFree:
        source?.fullParticleReadbackFree === true
    }));
    const url = new URL(window.location.href);
    const param = (name) => (
      url.searchParams.get(name)
      ?? new URLSearchParams(url.hash.replace(/^#/, '')).get(name)
    );
    const pairEnabled = Boolean(
      schroederOptions?.schroederEnableMechanicsFieldPairV2
      ?? config.enableMechanicsFieldPairV2
    );
    return {
      configuration: {
        scenarioId: param('scenario'),
        mechanics: param('mech'),
        schroederSimulation: Boolean(
          schroederOptions?.schroederSimulation
          ?? config.enabled
        ),
        twoLevelMechanics: Boolean(
          schroederOptions?.schroederEnableTwoLevelMechanics
          ?? config.enableTwoLevelMechanics
        ),
        mechanicsFieldPairV2: pairEnabled,
        twoLevelAuthority:
          schroederOptions?.schroederTwoLevelMechanicsAuthority
          ?? config.twoLevelMechanicsAuthority
          ?? null,
        twoLevelFineSubstepCount: Number(
          schroederOptions?.schroederTwoLevelFineSubstepCount
          ?? config.twoLevelFineSubstepCount
        ),
        stageWorkersEnabled:
          param('residentStageWorkers') !== '0'
          || Boolean(overlay.__sphMountedMechanicsStageWorkerLane),
        residentWorkersEnabled: param('residentWorkers') !== '0',
        residentAutoEnabled: param('residentAuto') !== '0',
        measuredExecutionOwner,
        gpuTimestampsEnabled: Boolean(
          param('residentGpuTimestampFeature') !== '0'
          || param('residentGpuTimestampProfile') !== '0'
          || param('residentGpuTimestamp') !== '0'
          || scene.scene?.userData
            ?.sphResidentGpuTimestampProfilingRequested === true
        ),
        diagnosticReadbacksEnabled: Boolean(
          param('contactBinMetadataReadback') !== '0'
          || param('reactionBinMetadataReadback') !== '0'
          || param('anomalyRowReadback') !== '0'
        ),
        renderRefreshPerformed: false,
        readbackMode: noFullReadbackMode,
        compactSummaryMode,
        compactSummaryScope,
        warmupStepCount,
        measuredStepCount
      },
      instrumentation: nativeInstrumentation,
      execution: {
        schema: execution?.schema ?? null,
        status: execution?.status ?? null,
        backend: execution?.backend ?? null,
        schroederSimulation: execution?.schroederSimulation === true,
        stepCount: execution?.stepCount ?? null,
        completedStepCount: execution?.completedStepCount ?? null,
        liveness: {
          continuedFromWarmup:
            execution?.continuedFromResidentState === true,
          continuationAvailable:
            execution?.continuationAvailable === true,
          stepBefore: Number.isSafeInteger(stepBefore)
            ? stepBefore
            : null,
          stepAfter: Number.isSafeInteger(stepAfter)
            ? stepAfter
            : null,
          authoritativeStepCount: stepSummaries.filter(
            (summary) => summary?.status === authoritativeStepStatus
          ).length,
          stepStatuses: stepSummaries.map(
            (summary) => summary?.status ?? null
          ),
          finalStepStatus: finalStep?.status ?? null,
          twoLevelAuthority:
            finalStep?.twoLevelMechanicsAuthority ?? null,
          twoLevelFineSubstepCount:
            finalStep?.twoLevelFineSubstepCount ?? null,
          authoritativeCommitVerified:
            finalStep?.twoLevelAuthoritativeCommitVerified === true,
          mechanicsFieldPairV2Enabled:
            finalMechanics?.mechanicsFieldPairV2Enabled === true,
          mechanicsFieldConstructionMode:
            finalMechanics?.mechanicsFieldConstructionMode ?? null
        },
        settlement: {
          backgroundSettlementConfirmed: true,
          spatialEpochReleaseSettlementComplete:
            execution?.schroederSpatialEpochReleaseSettlementComplete
              === true,
          spatialEpochReleaseSettlementCount:
            execution?.schroederSpatialEpochReleaseSettlementCount ?? null,
          hierarchyArtifactLedgerSettlementComplete:
            execution?.schroederHierarchyArtifactLedgerSettlementComplete
              === true,
          hierarchyArtifactLedgerSettlementCount:
            execution?.schroederHierarchyArtifactLedgerSettlementCount
            ?? null,
          successorRetirementComplete:
            execution
              ?.schroederSuccessorSourceFamilyRetirementComplete === true,
          transactionStates: transactions.map((transaction) => ({
            state: transaction?.state ?? null,
            releaseCount: transaction?.counters?.releaseCount ?? null
          })),
          artifactLedgerSafe: ledgers.map(
            (ledger) => ledger?.safe === true
          )
        },
        runtimeReadbackTelemetry: {
          sourceCount: runtimeSources.length,
          sources: runtimeSources
        }
      }
    };
  }, {
    warmupStepCount: RESIDENT_HOT_LOOP_WARMUP_STEP_COUNT,
    measuredStepCount: RESIDENT_HOT_LOOP_MEASURED_STEP_COUNT,
    noFullReadbackMode: NO_FULL_READBACK_MODE,
    compactSummaryMode: NO_COMPACT_SUMMARY_MODE,
    compactSummaryScope: PARTICLE_VISUAL_SUMMARY_SCOPE,
    authoritativeStepStatus: AUTHORITATIVE_STEP_STATUS,
    measuredExecutionOwner: MEASURED_EXECUTION_OWNER
  });
}

/**
 * Launches and closes only the isolated headless browser returned by this
 * function. It never discovers, signals, or terminates an existing browser.
 */
export async function runResidentHotLoopBrowserObservation({
  baseUrl = DEFAULT_BASE_URL,
  scenarioPath = canonicalResidentHotLoopScenarioPath(),
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const browser = await chromium.launch(chromiumLaunchOptions());
  const consoleEntries = [];
  const pageErrors = [];
  try {
    const page = await browser.newPage({
      ignoreHTTPSErrors: true,
      viewport: { width: 960, height: 640 }
    });
    page.on('console', (message) => {
      consoleEntries.push({
        type: message.type(),
        text: message.text()
      });
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error instanceof Error ? error.message : String(error));
    });
    await page.addInitScript(installPageInstrumentation);
    const target = new URL(scenarioPath, baseUrl).toString();
    await page.goto(target, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs
    });
    await ensureOverlay(page, timeoutMs);
    const measured = await runMeasuredPageInterval(page);
    const finalNativeInstrumentation = await page.evaluate(() => (
      globalThis.__ulgResidentHotLoopInstrumentation?.snapshot?.() ?? null
    ));
    return {
      ...measured,
      configuration: {
        ...measured.configuration,
        baseUrl: new URL(baseUrl).toString(),
        scenarioUrl: target,
        canonicalScenarioIdentity:
          canonicalResidentHotLoopScenarioEvidence(target)
      },
      instrumentation: {
        ...(finalNativeInstrumentation || measured.instrumentation),
        browserGpuIssues: consoleEntries.filter(
          (entry) => CRITICAL_GPU_PATTERN.test(entry.text)
        ),
        pageErrors
      },
      browser: {
        headless: true,
        ownership: 'playwright-launched-isolated-browser',
        launchArgs: [...chromiumLaunchOptions().args],
        consoleEntryCount: consoleEntries.length
      }
    };
  } finally {
    await browser.close().catch(() => null);
  }
}

export async function runResidentHotLoopInstrumentedProbe({
  repoDir = sourceRepoDir,
  baseUrl = process.env.ULG_RESIDENT_HOT_LOOP_BASE_URL
    || DEFAULT_BASE_URL,
  scenarioPath = process.env.ULG_RESIDENT_HOT_LOOP_SCENARIO_URL
    || canonicalResidentHotLoopScenarioPath(),
  timeoutMs = positiveInteger(
    process.env.ULG_RESIDENT_HOT_LOOP_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS
  ),
  reportPath = process.env.ULG_RESIDENT_HOT_LOOP_REPORT
    || DEFAULT_REPORT_PATH,
  tracePath = process.env.ULG_RESIDENT_HOT_LOOP_ICC_TRACE
    || `${reportPath}.icc.jsonl`
} = {}) {
  const resolvedRepoDir = path.resolve(repoDir);
  const resolvedReportPath = path.resolve(reportPath);
  const resolvedTracePath = path.resolve(tracePath);
  assertResidentProbeArtifactPathsOutsideRepo({
    repoDir: resolvedRepoDir,
    reportPath: resolvedReportPath,
    tracePath: resolvedTracePath
  });
  await prewriteResidentHotLoopFailSentinel({
    reportPath: resolvedReportPath,
    tracePath: resolvedTracePath
  });

  let before = null;
  let after = null;
  let current = null;
  let evidence = null;
  let probeError = null;
  try {
    before = await exactResidentProbeWorktreeFingerprint(resolvedRepoDir);
    evidence = await runResidentHotLoopBrowserObservation({
      baseUrl,
      scenarioPath,
      timeoutMs
    });
    after = await exactResidentProbeWorktreeFingerprint(resolvedRepoDir);
    current = await exactResidentProbeWorktreeFingerprint(resolvedRepoDir);
  } catch (error) {
    probeError = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack || null : null
    };
    try {
      after = await exactResidentProbeWorktreeFingerprint(resolvedRepoDir);
      current = await exactResidentProbeWorktreeFingerprint(resolvedRepoDir);
    } catch (fingerprintError) {
      probeError.fingerprintError =
        fingerprintError instanceof Error
          ? fingerprintError.message
          : String(fingerprintError);
    }
  }
  const candidate = {
    schema: RESIDENT_HOT_LOOP_REPORT_SCHEMA,
    status: 'FAIL',
    probeError,
    repoDir: resolvedRepoDir,
    worktreeIdentity: { before, after, current },
    evidence
  };
  const written = await writeResidentHotLoopProbeArtifacts({
    reportPath: resolvedReportPath,
    tracePath: resolvedTracePath,
    report: candidate
  });
  return Object.freeze({
    reportPath: resolvedReportPath,
    tracePath: resolvedTracePath,
    ...written
  });
}

async function main() {
  const reportPath = process.argv[2]
    || process.env.ULG_RESIDENT_HOT_LOOP_REPORT
    || DEFAULT_REPORT_PATH;
  const tracePath = process.argv[3]
    || process.env.ULG_RESIDENT_HOT_LOOP_ICC_TRACE
    || `${reportPath}.icc.jsonl`;
  if (process.argv.length > 4) {
    throw new Error(
      'Usage: node scripts/sph-resident-hot-loop-instrumented-probe.mjs '
      + '[report.json] [trace.jsonl]'
    );
  }
  const result = await runResidentHotLoopInstrumentedProbe({
    reportPath,
    tracePath
  });
  process.stdout.write(`${JSON.stringify({
    status: result.report.status,
    reportPath: result.reportPath,
    tracePath: result.tracePath,
    sourceFingerprint:
      result.report.worktreeIdentity?.current?.sourceFingerprint ?? null,
    failureReasons:
      result.report.evaluation?.failureReasons ?? []
  }, null, 2)}\n`);
  if (result.report.status !== 'PASS') process.exitCode = 1;
}

const executedAsScript = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;
if (executedAsScript) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exitCode = 2;
  });
}
