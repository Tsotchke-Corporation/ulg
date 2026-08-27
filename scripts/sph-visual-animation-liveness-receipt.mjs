#!/usr/bin/env node

import { fork, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { STANDARD_SCENARIOS } from './sph-visual-sanity-matrix.mjs';
import {
  comparePhysicalPixelPngFrames,
  decodePhysicalPixelPng,
  publicPhysicalPixelPngMetrics
} from './physicalPixelPngEvidence.mjs';
import { createBrowserConsoleCapture } from './sph-long-horizon-probe.mjs';
import {
  artifactMetadataMatches,
  assertArtifactPathsPairwiseDistinct,
  canonicalJson,
  exactWorktreeFingerprint,
  exactWorktreeFingerprintsEqual,
  readHashedArtifact
} from './ss-release-evidence-common.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const repoDir = path.resolve(path.dirname(scriptPath), '..');

export const VISUAL_LIVENESS_RECEIPT_SCHEMA =
  'peercompute.ulg.sph-visual-animation-liveness-receipt.v1';
export const VISUAL_LIVENESS_SCENARIO_SCHEMA =
  'peercompute.ulg.sph-visual-animation-liveness-scenario.v1';
export const VISUAL_LIVENESS_POLICY_ID =
  'standard-four-demo-controlled-autoplay-compositor-liveness-v3';
export const VISUAL_LIVENESS_COVERAGE =
  'bounded-autoplay-liveness-not-deep-scientific-horizon';
export const VISUAL_LIVENESS_EVENT_KIND = 'ulg_sph_probe';
export const VISUAL_LIVENESS_EVENT_NAME = 'standard_visual_matrix_passed';
export const VISUAL_LIVENESS_AUTOPLAY_START_MODE =
  'harness-click-after-quiescent-initial-presentation';

export const VISUAL_LIVENESS_LIMITS_MS = Object.freeze({
  overlay: 30_000,
  readiness: 60_000,
  firstAdvance: 90_000,
  visibleMotion: 180_000,
  milestone: 300_000,
  noProgress: 45_000,
  absolute: 480_000,
  cleanup: 10_000
});

const MIN_ADVANCEMENT_SAMPLE_COUNT = 3;
export const MIN_SUSTAINED_PRESENTED_STEP_COUNT = 160;
export const MIN_SUSTAINED_PROGRESS_MS = 60_000;
export const QUIESCENT_CAPTURE_STABILITY_MS = 500;
export const MAX_PRESENTATION_STEP_LAG = 3;
export const VISUAL_LIVENESS_CHECKPOINT_STEP_DELTAS = Object.freeze([
  40,
  96,
  MIN_SUSTAINED_PRESENTED_STEP_COUNT
]);
export const MAX_COMPOSITOR_FRAME_COUNT = 4;
const POLL_INTERVAL_MS = 500;
const COMPOSITOR_CAPTURE_TIMEOUT_MS = 10_000;
const CHILD_OUTPUT_LIMIT_BYTES = 64 * 1024;
const DEFAULT_VIEWPORT = Object.freeze({ width: 640, height: 480 });
const GPU_LAUNCH_ARGS = Object.freeze([
  '--enable-unsafe-webgpu',
  '--use-angle=vulkan',
  '--enable-features=Vulkan,UseSkiaRenderer'
]);

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeIntegerOrNull(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function compactError(error) {
  if (error == null) return null;
  if (typeof error === 'string') return error.slice(0, 2_000);
  return String(error?.message || error).slice(0, 2_000);
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function boundedDeadline(env, name, fallback, ceiling) {
  const raw = env[name];
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  if (value > ceiling) {
    throw new RangeError(`${name} cannot exceed ${ceiling} ms`);
  }
  return value;
}

export function resolveVisualLivenessDeadlines(env = process.env) {
  const deadlines = Object.freeze({
    overlay: boundedDeadline(
      env,
      'ULG_VISUAL_LIVENESS_OVERLAY_TIMEOUT_MS',
      VISUAL_LIVENESS_LIMITS_MS.overlay,
      VISUAL_LIVENESS_LIMITS_MS.overlay
    ),
    readiness: boundedDeadline(
      env,
      'ULG_VISUAL_LIVENESS_READINESS_TIMEOUT_MS',
      VISUAL_LIVENESS_LIMITS_MS.readiness,
      VISUAL_LIVENESS_LIMITS_MS.readiness
    ),
    firstAdvance: boundedDeadline(
      env,
      'ULG_VISUAL_LIVENESS_FIRST_ADVANCE_TIMEOUT_MS',
      VISUAL_LIVENESS_LIMITS_MS.firstAdvance,
      VISUAL_LIVENESS_LIMITS_MS.firstAdvance
    ),
    visibleMotion: boundedDeadline(
      env,
      'ULG_VISUAL_LIVENESS_VISIBLE_MOTION_TIMEOUT_MS',
      VISUAL_LIVENESS_LIMITS_MS.visibleMotion,
      VISUAL_LIVENESS_LIMITS_MS.visibleMotion
    ),
    milestone: boundedDeadline(
      env,
      'ULG_VISUAL_LIVENESS_MILESTONE_TIMEOUT_MS',
      VISUAL_LIVENESS_LIMITS_MS.milestone,
      VISUAL_LIVENESS_LIMITS_MS.milestone
    ),
    noProgress: boundedDeadline(
      env,
      'ULG_VISUAL_LIVENESS_NO_PROGRESS_TIMEOUT_MS',
      VISUAL_LIVENESS_LIMITS_MS.noProgress,
      VISUAL_LIVENESS_LIMITS_MS.noProgress
    ),
    absolute: boundedDeadline(
      env,
      'ULG_VISUAL_LIVENESS_ABSOLUTE_TIMEOUT_MS',
      VISUAL_LIVENESS_LIMITS_MS.absolute,
      VISUAL_LIVENESS_LIMITS_MS.absolute
    ),
    cleanup: boundedDeadline(
      env,
      'ULG_VISUAL_LIVENESS_CLEANUP_TIMEOUT_MS',
      VISUAL_LIVENESS_LIMITS_MS.cleanup,
      VISUAL_LIVENESS_LIMITS_MS.cleanup
    )
  });
  if (
    deadlines.overlay > deadlines.readiness
    || deadlines.readiness > deadlines.firstAdvance
    || deadlines.firstAdvance > deadlines.visibleMotion
    || deadlines.visibleMotion > deadlines.milestone
    || deadlines.milestone > deadlines.absolute
  ) {
    throw new RangeError('visual liveness deadlines must be monotonic');
  }
  return deadlines;
}

export function standardVisualLivenessScenarios(selection = null) {
  const selected = selection == null
    ? null
    : new Set(
        String(selection)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      );
  const scenarios = STANDARD_SCENARIOS
    .filter((scenario) => (
      selected == null
      || selected.has(scenario.presetId)
      || selected.has(scenario.label)
    ))
    .map((scenario) => {
      const url = new URL(scenario.url, 'http://ulg-visual-liveness.invalid');
      // Capture the t=0 compositor while the resident queue is idle, then use
      // the real Play control to start continuous playback. Starting with URL
      // autoplay enabled can enqueue the first resident workload before the
      // compositor baseline is observed, making screenshot capture contend
      // with that workload instead of testing visible animation.
      url.searchParams.set('residentAuto', '0');
      url.searchParams.set('residentStepsPerSchedule', '1');
      url.searchParams.set('residentStepsPerScheduleMax', '1');
      url.searchParams.set('visualCapture', '1');
      return Object.freeze({
        id: scenario.presetId,
        label: scenario.label,
        url: `${url.pathname}${url.search}`,
        expectedRenderer: 'native-webgpu',
        expectedSurfaceDraw: url.searchParams.get('surfaceDraw'),
        expectedRenderOwnership:
          url.searchParams.get('renderOwnership')
      });
    });
  if (selected != null && scenarios.length !== selected.size) {
    const resolved = new Set(
      scenarios.flatMap((scenario) => [scenario.id, scenario.label])
    );
    const missing = [...selected].filter((value) => !resolved.has(value));
    if (missing.length > 0) {
      throw new Error(`unknown standard visual liveness scenarios: ${missing.join(', ')}`);
    }
  }
  if (scenarios.length === 0) {
    throw new Error('standard visual liveness scenario selection is empty');
  }
  return Object.freeze(scenarios);
}

function increasing(current, previous, { allowZeroPrevious = false } = {}) {
  if (!Number.isFinite(current)) return false;
  if (!Number.isFinite(previous)) {
    return allowZeroPrevious ? current > 0 : false;
  }
  return current > previous;
}

function nativePresentationHealthy(snapshot) {
  return Boolean(
    snapshot?.rendererBackend === 'native-webgpu'
    && snapshot?.surfaceDrawMode === 'native-webgpu-surface-consumer'
    && snapshot?.nativePresentationReady === true
    && snapshot?.presentationAdmitted === true
    && snapshot?.pendingPresentationActive !== true
    && snapshot?.residentError == null
    && snapshot?.renderError == null
    && snapshot?.workerRebuildError == null
  );
}

function snapshotSourceCorrelated(snapshot) {
  const physicsStep = snapshot?.nextStep;
  const presentedStep = snapshot?.renderBridgeSourceResidentNextStep;
  return Boolean(
    Number.isSafeInteger(physicsStep)
    && Number.isSafeInteger(presentedStep)
    && presentedStep >= 0
    && presentedStep <= physicsStep
    && physicsStep - presentedStep <= MAX_PRESENTATION_STEP_LAG
    && Number(snapshot?.renderBridgeSubmittedDrawCount) > 0
  );
}

function quiescentSchedulersInactive(snapshot) {
  const inactiveCount = (value) => value == null || value === 0;
  return Boolean(
    inactiveCount(snapshot?.renderRefreshActiveCount)
    && inactiveCount(snapshot?.renderRefreshQueuedCount)
    && inactiveCount(snapshot?.candidateValidationActiveCount)
    && inactiveCount(snapshot?.candidateValidationQueuedCount)
    && snapshot?.postStepPresentationGateActive !== true
    && snapshot?.cameraPresentationRecoveryActive !== true
    && snapshot?.latePresentationRecoveryActive !== true
  );
}

export function visualLivenessQuiescentPresentationReady(snapshot) {
  return Boolean(
    snapshot?.overlayPresent === true
    && snapshot?.scenePresent === true
    && snapshot?.particleStateReady === true
    && snapshot?.playbackActive === false
    && snapshot?.playText === 'Play'
    && snapshot?.playButtonDisabled === false
    && snapshot?.residentPending == null
    && Number(snapshot?.staleResidentSubmissions ?? 0) === 0
    && Number(snapshot?.renderBridgeFrameCount) > 0
    && snapshotSourceCorrelated(snapshot)
    && quiescentSchedulersInactive(snapshot)
    && nativePresentationHealthy(snapshot)
  );
}

export function visualLivenessInitialPresentationReady(snapshot) {
  return Boolean(
    visualLivenessQuiescentPresentationReady(snapshot)
    && snapshot?.residentAuto === false
    && snapshot?.residentAutoConfigured === false
    && Number.isSafeInteger(snapshot?.nextStep)
    && snapshot.nextStep === 0
    && Number.isSafeInteger(snapshot?.residentSubmissions)
    && snapshot.residentSubmissions === 0
  );
}

export function visualLivenessSnapshotReady(snapshot) {
  return Boolean(
    snapshot?.overlayPresent === true
    && snapshot?.scenePresent === true
    && snapshot?.particleStateReady === true
    && Number(snapshot?.renderBridgeFrameCount) > 0
    && snapshot?.playbackActive === true
    && snapshot?.playText === 'Pause'
    && Number(snapshot?.residentSubmissions) > 0
    && snapshot?.residentPending == null
    && Number(snapshot?.staleResidentSubmissions ?? 0) === 0
    && snapshotSourceCorrelated(snapshot)
    && exactZeroReadbackTelemetry(snapshot)
    && nativePresentationHealthy(snapshot)
  );
}

export function visualLivenessSnapshotAdvanced(previous, current) {
  if (!visualLivenessSnapshotReady(current)) return false;
  const physicsAdvanced = Boolean(
    increasing(current.nextStep, previous?.nextStep, { allowZeroPrevious: true })
    && increasing(current.nextTimeS, previous?.nextTimeS, { allowZeroPrevious: true })
    && increasing(
      current.lastResidentCompletionAtMs,
      previous?.lastResidentCompletionAtMs,
      { allowZeroPrevious: true }
    )
    && increasing(
      current.residentSubmissions,
      previous?.residentSubmissions,
      { allowZeroPrevious: true }
    )
  );
  const presentationAdvanced = Boolean(
    increasing(
      current.renderBridgeSourceResidentNextStep,
      previous?.renderBridgeSourceResidentNextStep,
      { allowZeroPrevious: true }
    )
    && Number(current.renderBridgeSourceResidentNextStep)
      <= Number(current.nextStep)
    && Number(current.nextStep)
      - Number(current.renderBridgeSourceResidentNextStep)
      <= MAX_PRESENTATION_STEP_LAG
    && Number(current.renderBridgeSubmittedDrawCount) > 0
    && (
      increasing(
        current.renderBridgeFrameCount,
        previous?.renderBridgeFrameCount,
        { allowZeroPrevious: true }
      )
      || increasing(
        current.renderBridgeUpdateCount,
        previous?.renderBridgeUpdateCount,
        { allowZeroPrevious: true }
      )
    )
  );
  return physicsAdvanced && presentationAdvanced;
}

export function visualLivenessQuiescentSnapshotAdvanced(previous, current) {
  if (!visualLivenessQuiescentPresentationReady(current)) return false;
  if (!exactZeroReadbackTelemetry(current)) return false;
  const physicsAdvanced = Boolean(
    increasing(current.nextStep, previous?.nextStep, { allowZeroPrevious: true })
    && increasing(current.nextTimeS, previous?.nextTimeS, { allowZeroPrevious: true })
    && increasing(
      current.lastResidentCompletionAtMs,
      previous?.lastResidentCompletionAtMs,
      { allowZeroPrevious: true }
    )
    && increasing(
      current.residentSubmissions,
      previous?.residentSubmissions,
      { allowZeroPrevious: true }
    )
  );
  const presentationAdvanced = Boolean(
    increasing(
      current.renderBridgeSourceResidentNextStep,
      previous?.renderBridgeSourceResidentNextStep,
      { allowZeroPrevious: true }
    )
    && snapshotSourceCorrelated(current)
    && (
      increasing(
        current.renderBridgeFrameCount,
        previous?.renderBridgeFrameCount,
        { allowZeroPrevious: true }
      )
      || increasing(
        current.renderBridgeUpdateCount,
        previous?.renderBridgeUpdateCount,
        { allowZeroPrevious: true }
      )
    )
  );
  return physicsAdvanced && presentationAdvanced;
}

export function evaluateVisualLivenessSustainedProgress({
  baselineSnapshot = null,
  currentSnapshot = null,
  firstAdvanceAtMs = null,
  currentAtMs = null,
  checkpointSnapshots = [],
  milestonePassed = false
} = {}) {
  const baselinePhysicsStep = Number(baselineSnapshot?.nextStep);
  const currentPhysicsStep = Number(currentSnapshot?.nextStep);
  const baselinePresentedStep = Number(
    baselineSnapshot?.renderBridgeSourceResidentNextStep
  );
  const currentPresentedStep = Number(
    currentSnapshot?.renderBridgeSourceResidentNextStep
  );
  const physicsStepDelta = Number.isFinite(baselinePhysicsStep)
    && Number.isFinite(currentPhysicsStep)
    ? currentPhysicsStep - baselinePhysicsStep
    : null;
  const presentedStepDelta = Number.isFinite(baselinePresentedStep)
    && Number.isFinite(currentPresentedStep)
    ? currentPresentedStep - baselinePresentedStep
    : null;
  const sustainedDurationMs = Number.isFinite(Number(firstAdvanceAtMs))
    && Number.isFinite(Number(currentAtMs))
    ? Number(currentAtMs) - Number(firstAdvanceAtMs)
    : null;
  const observedCheckpointDeltas = checkpointSnapshots.map((entry) => (
    Number(entry?.stepDelta ?? entry?.threshold)
  )).filter(Number.isFinite);
  const checkpointsPassed = VISUAL_LIVENESS_CHECKPOINT_STEP_DELTAS.every(
    (threshold) => observedCheckpointDeltas.some((value) => value >= threshold)
  );
  const presentationLag = Number.isFinite(currentPhysicsStep)
    && Number.isFinite(currentPresentedStep)
    ? currentPhysicsStep - currentPresentedStep
    : null;
  const passed = Boolean(
    visualLivenessSnapshotReady(currentSnapshot)
    && milestonePassed === true
    && Number(physicsStepDelta) >= MIN_SUSTAINED_PRESENTED_STEP_COUNT
    && Number(presentedStepDelta) >= MIN_SUSTAINED_PRESENTED_STEP_COUNT
    && Number(sustainedDurationMs) >= MIN_SUSTAINED_PROGRESS_MS
    && Number(presentationLag) >= 0
    && Number(presentationLag) <= MAX_PRESENTATION_STEP_LAG
    && checkpointsPassed
    && checkpointSnapshots.length >= MIN_ADVANCEMENT_SAMPLE_COUNT
  );
  return Object.freeze({
    passed,
    minimumPresentedStepCount: MIN_SUSTAINED_PRESENTED_STEP_COUNT,
    minimumSustainedProgressMs: MIN_SUSTAINED_PROGRESS_MS,
    physicsStepDelta,
    presentedStepDelta,
    sustainedDurationMs,
    presentationLag,
    checkpointCount: checkpointSnapshots.length,
    requiredCheckpointStepDeltas: [
      ...VISUAL_LIVENESS_CHECKPOINT_STEP_DELTAS
    ],
    observedCheckpointStepDeltas: observedCheckpointDeltas,
    checkpointsPassed
  });
}

function exactSurfaceStressMilestone(surfaceStress) {
  return Boolean(
    surfaceStress?.schema
      === 'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2'
    && surfaceStress?.status
      === 'eighteen-pass-central-bond-surface-stress-submitted-unverified'
    && surfaceStress?.submitted === true
    && Number(surfaceStress?.dispatchCount) === 18
    && Number(surfaceStress?.lifecycleDispatchCount) === 21
  );
}

function exactProductHistoryGpuRenderCommit(productHistory) {
  const generation = Number(productHistory?.generation);
  const seal = Number(productHistory?.seal);
  const renderGeneration = Number(productHistory?.renderGeneration);
  const renderSeal = Number(productHistory?.renderSeal);
  return Boolean(
    productHistory?.residentProductMassStatus
      === 'resident-product-mass-merged-gpu-resident'
    && productHistory?.compactionStatus
      === 'product-event-filtered-append-gpu-count-resident'
    && productHistory?.gpuCommitStatus
      === 'gpu-conditioned-publication-commit-pending'
    && productHistory?.arenaStatus
      === 'resident-product-history-arena-gpu-commit-pending'
    && productHistory?.renderProductEventBufferBound === true
    && Number(productHistory?.renderProductEventBufferByteLength) > 0
    && productHistory?.renderResidentProductMassStatus
      === 'resident-product-mass-merged-gpu-resident'
    && productHistory?.renderCountAuthority
      === 'gpu-authored-filtered-live-prefix'
    && productHistory?.renderControlAuthentication
      === 'full-eight-word-gpu-commit-gate'
    && productHistory?.renderControlHostObserved === false
    && productHistory?.renderCountHostKnown === false
    && Number.isSafeInteger(generation)
    && generation > 0
    && Number.isSafeInteger(seal)
    && seal > 0
    && Number.isSafeInteger(renderGeneration)
    && renderGeneration > 0
    && renderGeneration <= generation
    && generation - renderGeneration <= MAX_PRESENTATION_STEP_LAG
    && Number.isSafeInteger(renderSeal)
    && renderSeal > 0
  );
}

function exactProductHistoryGpuCommit(productHistory) {
  const p2gRouteAccepted = Boolean(
    (
      productHistory?.gridCouplingStatus
        === 'resident-product-mass-bound-to-p2g-grid'
      && productHistory?.dispatchMode
        === 'gpu-authored-indirect-live-count'
    )
    || (
      productHistory?.gridCouplingStatus
        === 'resident-product-mass-gas-only-certified-no-mechanics-p2g-scatter'
      && productHistory?.dispatchMode
        === 'gpu-authenticated-gas-only-no-mechanics-scatter'
    )
  );
  return Boolean(
    exactProductHistoryGpuRenderCommit(productHistory)
    && p2gRouteAccepted
    && productHistory?.countAuthority
      === 'gpu-authored-filtered-live-prefix'
    && Number(productHistory?.rowCapacity) > 0
    && productHistory?.countHostKnown === false
  );
}

export function evaluateVisualLivenessMilestone(scenarioId, snapshot) {
  const milestone = snapshot?.milestone || {};
  if (scenarioId === 'water-cycle') {
    return Object.freeze({
      id: 'thermal-webgpu-step',
      passed: Boolean(
        milestone.thermalStatus === 'thermal-step-executed'
        && milestone.thermalBackend === 'webgpu'
      ),
      observed: milestone
    });
  }
  if (scenarioId === 'iron-ice-quench') {
    return Object.freeze({
      id: 'surface-stress-exact-submission',
      passed: exactSurfaceStressMilestone(milestone.surfaceStress),
      observed: milestone
    });
  }
  if (scenarioId === 'sodium-water') {
    return Object.freeze({
      id: 'resident-product-history-gpu-commit',
      passed: exactProductHistoryGpuCommit(milestone.productHistory),
      observed: milestone
    });
  }
  if (scenarioId === 'cesium-fluorine') {
    const authority = String(milestone.twoLevelAuthority || '');
    return Object.freeze({
      id: 'authoritative-two-level-product-step',
      passed: Boolean(
        ['authoritative', 'two-level-authoritative-resident-mechanics-replaced']
          .includes(authority)
        && milestone.twoLevelCommitVerified === true
        && Number(milestone.twoLevelFineSubstepCount) === 2
        && exactProductHistoryGpuRenderCommit(milestone.productHistory)
      ),
      observed: milestone
    });
  }
  return Object.freeze({
    id: 'unknown-standard-scenario',
    passed: false,
    observed: milestone
  });
}

function appendBounded(current, chunk, limit = CHILD_OUTPUT_LIMIT_BYTES) {
  const combined = Buffer.concat([current, Buffer.from(chunk)]);
  return combined.byteLength <= limit
    ? combined
    : combined.subarray(combined.byteLength - limit);
}

function processGroupExists(processGroupId) {
  if (!Number.isSafeInteger(processGroupId) || processGroupId <= 1) return false;
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

async function waitForProcessGroupExit(processGroupId, timeoutMs) {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (Date.now() < deadline) {
    if (!processGroupExists(processGroupId)) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return !processGroupExists(processGroupId);
}

function signalOwnedProcessGroup(processGroupId, signal) {
  if (!processGroupExists(processGroupId)) return false;
  try {
    process.kill(-processGroupId, signal);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

export async function terminateOwnedProcessGroup(processGroupId, {
  termGraceMs = 2_000,
  killGraceMs = 3_000
} = {}) {
  const existed = processGroupExists(processGroupId);
  const termSent = signalOwnedProcessGroup(processGroupId, 'SIGTERM');
  if (await waitForProcessGroupExit(processGroupId, termGraceMs)) {
    return Object.freeze({
      processGroupId,
      existed,
      termSent,
      killSent: false,
      stopped: true
    });
  }
  const killSent = signalOwnedProcessGroup(processGroupId, 'SIGKILL');
  const stopped = await waitForProcessGroupExit(processGroupId, killGraceMs);
  return Object.freeze({
    processGroupId,
    existed,
    termSent,
    killSent,
    stopped
  });
}

async function reserveLocalPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' ? address?.port : null;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (!Number.isSafeInteger(port) || port <= 0) {
    throw new Error('failed to reserve a localhost port');
  }
  return port;
}

async function atomicWriteJson(outputPath, value) {
  const temporaryPath = `${outputPath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, outputPath);
}

function childArgument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix));
  return value == null ? null : value.slice(prefix.length);
}

function serializeFailure(error, type = 'scenario-error') {
  return Object.freeze({
    type,
    message: compactError(error),
    stack: error instanceof Error ? error.stack || null : null
  });
}

async function waitForHttp(url, { timeoutMs = 20_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return true;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`owned Vite did not become ready: ${compactError(lastError)}`);
}

function startOwnedVite(port) {
  const viteBin = path.join(repoDir, 'node_modules', 'vite', 'bin', 'vite.js');
  const vite = spawn(process.execPath, [
    viteBin,
    '--host', '127.0.0.1',
    '--port', String(port),
    '--strictPort'
  ], {
    cwd: repoDir,
    env: {
      ...process.env,
      ULG_VITE_HTTPS: '0',
      ULG_VITE_PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = Buffer.alloc(0);
  let stderr = Buffer.alloc(0);
  vite.stdout.on('data', (chunk) => {
    stdout = appendBounded(stdout, chunk);
  });
  vite.stderr.on('data', (chunk) => {
    stderr = appendBounded(stderr, chunk);
  });
  return {
    process: vite,
    output: () => ({
      stdout: stdout.toString('utf8'),
      stderr: stderr.toString('utf8')
    })
  };
}

async function stopDirectChild(child, timeoutMs = 2_000) {
  if (!child || child.exitCode != null || child.signalCode != null) return true;
  const closed = new Promise((resolve) => child.once('close', resolve));
  child.kill('SIGTERM');
  const graceful = await Promise.race([
    closed.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs))
  ]);
  if (graceful) return true;
  if (child.exitCode == null && child.signalCode == null) child.kill('SIGKILL');
  return Promise.race([
    closed.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs))
  ]);
}

function installGpuFaultCaptureScript() {
  return () => {
    const installKey = '__ulgVisualLivenessGpuFaultCaptureV1';
    if (globalThis[installKey]) return;
    globalThis[installKey] = true;
    const seenDevices = new WeakSet();
    const attachDevice = (device) => {
      if (!device || seenDevices.has(device)) return device;
      seenDevices.add(device);
      device.addEventListener?.('uncapturederror', (event) => {
        const error = event?.error;
        console.error(
          `[ulg-gpu-uncaptured-error:${error?.name || 'GPUError'}] `
          + `${error?.message || String(error || 'unknown WebGPU error')}`
        );
      });
      Promise.resolve(device.lost).then((info) => {
        console.error(
          `[ulg-gpu-device-lost] reason=${info?.reason || 'unknown'} `
          + `message=${info?.message || 'WebGPU device lost without a message'}`
        );
      }).catch((error) => {
        console.error(`[ulg-gpu-device-lost] watch-error=${error?.message || String(error)}`);
      });
      return device;
    };
    const prototype = globalThis.GPUAdapter?.prototype;
    const requestDevice = prototype?.requestDevice;
    if (typeof requestDevice !== 'function') return;
    const wrapped = async function (...args) {
      return attachDevice(await requestDevice.apply(this, args));
    };
    try {
      Object.defineProperty(prototype, 'requestDevice', {
        configurable: true,
        writable: true,
        value: wrapped
      });
    } catch {
      try {
        prototype.requestDevice = wrapped;
      } catch {
        // Chromium still emits its native validation diagnostics to console.
      }
    }
  };
}

async function snapshotPage(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    if (!overlay) {
      return {
        capturedAtMs: performance.now(),
        overlayPresent: false,
        documentUrl: location.href
      };
    }
    const sceneApi = overlay.__sphScene || null;
    const execution = sceneApi?.getMlsMpmResidentSteps?.()
      || overlay.__mlsMpmResidentSteps
      || null;
    const finalStep = execution?.finalStep || execution || null;
    const surfaceDraw = sceneApi?.getSphResidentSurfaceDraw?.()
      || overlay.__sphResidentSurfaceDraw
      || null;
    const renderState = sceneApi?.getSphResidentRenderState?.()
      || overlay.__sphResidentRenderState
      || null;
    const bridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.() || null;
    const schedule = overlay.__mlsMpmResidentAutoSchedule || null;
    const counters = overlay.__sphFrameCounters || {};
    const perf = overlay.__sphResidentPerf || {};
    const presentation = overlay.__sphResidentPresentationProof || null;
    const pendingPresentation = overlay.__sphPendingPresentation || null;
    const sceneUserData = sceneApi?.scene?.userData || null;
    const renderRefreshScheduler =
      sceneUserData?.sphResidentRenderRefreshSerialization || null;
    const candidateValidationScheduler =
      sceneUserData?.sphNativeSurfaceCandidateValidationScheduler || null;
    const postStepPresentationGate =
      overlay.__sphResidentPostStepPresentationGate || null;
    const cameraPresentationRecovery =
      overlay.__sphNativeSurfaceCameraPresentationRecovery || null;
    const latePresentationRecovery =
      overlay.__sphNativeSurfaceLatePresentationRecovery || null;
    const startup = overlay.__sphRendererSurfaceStartupSelection || null;
    const particleState = sceneApi?.getSphGpuParticleState?.()
      || overlay.__sphGpuParticleState
      || null;
    const mlsParticleState = sceneApi?.getMlsMpmGpuParticleState?.()
      || overlay.__mlsMpmGpuParticleState
      || null;
    const surfaceStress = finalStep?.phaseVolumeSurfaceStressSubmission
      || finalStep?.gridUpdate?.phaseVolumeSurfaceStressSubmission
      || execution?.finalStepPhaseVolumeSurfaceStressSubmission
      || null;
    const thermal = finalStep?.thermalStep?.result
      || finalStep?.thermalStep
      || null;
    const twoLevel = execution?.finalSchroederResult?.twoLevelMechanics
      || execution?.schroederSameLevelMechanics?.twoLevelMechanics
      || null;
    const rendererBackend = sceneApi?.scene?.userData?.sphRendererBackend
      || startup?.rendererBackend
      || null;
    const surfaceDrawMode = surfaceDraw?.visibleRendererBridge
      || startup?.surfaceDrawMode
      || null;
    const visibleGpuConsumerReady =
      surfaceDraw?.surfaceDrawVisibleGpuConsumerReady
      ?? surfaceDraw?.visibleGpuConsumerReady
      ?? renderState?.surfaceDrawVisibleGpuConsumerReady
      ?? false;
    const visibleGpuConsumerRuntimePresentationAdmitted =
      surfaceDraw?.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted
      ?? surfaceDraw?.visibleGpuConsumerRuntimePresentationAdmitted
      ?? renderState?.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted
      ?? false;
    const renderBridgeLastRenderStatus =
      bridge?.lastRenderStatus
      ?? surfaceDraw?.renderBridgeLastRenderStatus
      ?? renderState?.surfaceDrawRenderBridgeLastRenderStatus
      ?? null;
    const compactObject = (value) => {
      if (!value || typeof value !== 'object') return value ?? null;
      return {
        schema: value.schema ?? null,
        status: value.status ?? null,
        reason: value.reason ?? null,
        active: typeof value.active === 'boolean' ? value.active : null,
        progress: Number.isFinite(Number(value.progress)) ? Number(value.progress) : null,
        generation: Number.isSafeInteger(value.generation) ? value.generation : null,
        blockers: Array.isArray(value.blockers) ? value.blockers.slice(0, 16) : null
      };
    };
    const runtimeTelemetry = globalThis.__ulgDemo?.telemetry || null;
    const compactTelemetryRows = (rows) => {
      if (!rows || typeof rows !== 'object') return null;
      return Object.fromEntries(
        Object.entries(rows).slice(0, 32).map(([key, value]) => [key, compactObject(value)])
      );
    };
    const residentError = overlay.__mlsMpmResidentStepsError;
    const renderError = overlay.__sphResidentRenderStateError
      || overlay.__sphResidentSurfaceDrawError
      || null;
    const residentProductMass = finalStep?.residentProductMass
      || finalStep?.reactionStep?.result?.residentProductMass
      || finalStep?.reactionStep?.residentProductMass
      || null;
    const playButton = overlay.querySelector('#sph-play');
    const playText = String(playButton?.textContent || '').trim();
    const nextStepCandidate = execution?.nextSphParticleState?.step
      ?? execution?.nextStep
      ?? finalStep?.particlePingPong?.nextStep
      ?? mlsParticleState?.step
      ?? particleState?.step;
    const nextTimeCandidate = execution?.nextSphParticleState?.time
      ?? execution?.nextTime
      ?? finalStep?.particlePingPong?.nextTime
      ?? mlsParticleState?.time
      ?? particleState?.time;
    const nextStep = Number.isSafeInteger(nextStepCandidate)
      ? Number(nextStepCandidate)
      : null;
    const nextTimeS = Number.isFinite(Number(nextTimeCandidate))
      ? Number(nextTimeCandidate)
      : null;
    const presentedSourceCandidate = bridge?.sourceResidentNextStep
      ?? surfaceDraw?.renderBridgeSourceResidentNextStep
      ?? surfaceDraw?.sourceResidentNextStep;
    // The admitted t=0 surface precedes the first resident execution and has
    // no resident-execution source field yet. Bind that one exact state to step
    // zero; every post-start frame still requires the explicit bridge source.
    const presentedSourceStep = Number.isSafeInteger(presentedSourceCandidate)
      ? Number(presentedSourceCandidate)
      : (execution == null && nextStep === 0 ? 0 : null);
    return {
      capturedAtMs: performance.now(),
      documentUrl: location.href,
      overlayPresent: true,
      scenePresent: Boolean(sceneApi),
      particleStateReady: Boolean(particleState?.schema && mlsParticleState?.schema),
      playText,
      playButtonDisabled: playButton?.disabled === true,
      playbackActive: playText === 'Pause',
      residentAuto: schedule?.residentAuto === true,
      residentAutoConfigured: schedule?.residentAuto === true,
      autoScheduleStatus: schedule?.status ?? null,
      autoScheduleGeneration: Number.isSafeInteger(schedule?.generation)
        ? schedule.generation
        : null,
      nextStep,
      nextTimeS,
      lastResidentCompletionAtMs: Number.isFinite(Number(
        counters.lastResidentCompletionAtMs
      )) ? Number(counters.lastResidentCompletionAtMs) : null,
      residentSubmissions: Number.isSafeInteger(perf.residentSubmissions)
        ? perf.residentSubmissions
        : null,
      staleResidentSubmissions: Number.isSafeInteger(perf.staleResidentSubmissions)
        ? perf.staleResidentSubmissions
        : null,
      lastResidentCycleMs: Number.isFinite(Number(perf.lastResidentCycleMs))
        ? Number(perf.lastResidentCycleMs)
        : null,
      renderBridgeFrameCount: Number.isSafeInteger(
        bridge?.frameCount ?? surfaceDraw?.renderBridgeFrameCount
      ) ? Number(bridge?.frameCount ?? surfaceDraw?.renderBridgeFrameCount) : null,
      renderBridgeUpdateCount: Number.isSafeInteger(
        bridge?.updateCount ?? surfaceDraw?.renderBridgeUpdateCount
      ) ? Number(bridge?.updateCount ?? surfaceDraw?.renderBridgeUpdateCount) : null,
      renderBridgeSubmittedDrawCount: Number.isSafeInteger(
        bridge?.lastSubmittedDrawCount
          ?? surfaceDraw?.renderBridgeLastSubmittedDrawCount
      ) ? Number(
        bridge?.lastSubmittedDrawCount
          ?? surfaceDraw?.renderBridgeLastSubmittedDrawCount
      ) : null,
      renderBridgeSourceResidentNextStep: presentedSourceStep,
      rendererBackend,
      surfaceDrawMode,
      visibleGpuConsumerReady: visibleGpuConsumerReady === true,
      visibleGpuConsumerRuntimePresentationAdmitted:
        visibleGpuConsumerRuntimePresentationAdmitted === true,
      renderBridgeLastRenderStatus,
      nativePresentationReady: Boolean(
        visibleGpuConsumerReady === true
        && bridge?.rendererBridge === 'native-webgpu-surface-consumer'
        && [
          'native-webgpu-surface-consumer-rendered',
          'native-webgpu-surface-consumer-candidate-staged-composite-presented'
        ].includes(
          renderBridgeLastRenderStatus
        )
      ),
      presentationStatus: presentation?.status ?? null,
      presentationAdmitted: presentation?.admitted === true
        || visibleGpuConsumerRuntimePresentationAdmitted === true,
      pendingPresentationActive: pendingPresentation?.active === true,
      pendingPresentation: compactObject(pendingPresentation),
      renderRefreshActiveCount:
        Number.isSafeInteger(renderRefreshScheduler?.activeCount)
          ? renderRefreshScheduler.activeCount
          : null,
      renderRefreshQueuedCount:
        Number.isSafeInteger(renderRefreshScheduler?.queuedCount)
          ? renderRefreshScheduler.queuedCount
          : null,
      candidateValidationActiveCount:
        Number.isSafeInteger(candidateValidationScheduler?.activeCount)
          ? candidateValidationScheduler.activeCount
          : null,
      candidateValidationQueuedCount:
        Number.isSafeInteger(candidateValidationScheduler?.queuedCount)
          ? candidateValidationScheduler.queuedCount
          : null,
      postStepPresentationGateActive: postStepPresentationGate?.active === true,
      cameraPresentationRecoveryActive:
        cameraPresentationRecovery?.active === true,
      latePresentationRecoveryActive: latePresentationRecovery?.active === true,
      residentPending: compactObject(overlay.__mlsMpmResidentStepsPending),
      residentError: residentError == null
        ? null
        : String(residentError?.message || residentError).slice(0, 2_000),
      renderError: renderError == null
        ? null
        : String(renderError?.message || renderError).slice(0, 2_000),
      workerRebuild: compactObject(overlay.__sphPhaseRebuildWorker),
      workerRebuildError: overlay.__sphPhaseRebuildWorkerError == null
        ? null
        : String(
          overlay.__sphPhaseRebuildWorkerError?.reason
            || overlay.__sphPhaseRebuildWorkerError?.message
            || overlay.__sphPhaseRebuildWorkerError
        ).slice(0, 2_000),
      cpuClosureTask: compactObject(overlay.__sphCpuClosureTask),
      runtimeAdmission: compactObject(overlay.__sphSimulationRuntimeAdmission),
      runtimeTelemetry: runtimeTelemetry == null ? null : {
        services: compactTelemetryRows(runtimeTelemetry.services),
        tasks: compactTelemetryRows(runtimeTelemetry.tasks)
      },
      statusText: String(overlay.querySelector('#sph-status')?.textContent || '')
        .slice(0, 4_000),
      warningText: String(overlay.querySelector('#sph-warning-bar')?.textContent || '')
        .slice(0, 2_000),
      telemetry: {
        schema: execution?.readbackTelemetrySchema ?? null,
        complete: execution?.readbackTelemetryComplete ?? null,
        normalHotLoopReadbackFree: execution?.normalHotLoopReadbackFree ?? null,
        mapAsyncCount: Number.isSafeInteger(execution?.mapAsyncCount)
          ? execution.mapAsyncCount
          : null,
        readbackBytes: Number.isSafeInteger(execution?.readbackBytes)
          ? execution.readbackBytes
          : null,
        hostQueueFenceCount: Number.isSafeInteger(execution?.hostQueueFenceCount)
          ? execution.hostQueueFenceCount
          : null
      },
      milestone: {
        thermalStatus: thermal?.status ?? null,
        thermalBackend: thermal?.backend
          ?? finalStep?.stageBackends?.thermal
          ?? null,
        productHistory: residentProductMass == null ? null : {
          residentProductMassStatus: residentProductMass.status ?? null,
          compactionStatus:
            residentProductMass.productEventCompactionStatus ?? null,
          gpuCommitStatus:
            residentProductMass.productEventGpuCommitStatus ?? null,
          arenaStatus:
            residentProductMass.productEventHistoryArenaStatus ?? null,
          generation:
            residentProductMass.productEventLiveCountAuthority?.generation
            ?? null,
          seal:
            residentProductMass.productEventLiveCountAuthority?.seal
            ?? null,
          gridCouplingStatus:
            finalStep?.residentProductMassGridCouplingStatus
            ?? finalStep?.p2gGridProjection
              ?.residentProductMassGridCouplingStatus
            ?? null,
          countAuthority:
            finalStep?.residentProductMassInputProductEventCountAuthority
            ?? finalStep?.p2gGridProjection
              ?.residentProductMassInputProductEventCountAuthority
            ?? null,
          rowCapacity:
            finalStep?.residentProductMassInputProductEventRowCapacity
            ?? finalStep?.p2gGridProjection
              ?.residentProductMassInputProductEventRowCapacity
            ?? null,
          countHostKnown:
            finalStep?.residentProductMassInputProductEventCountHostKnown
            ?? finalStep?.p2gGridProjection
              ?.residentProductMassInputProductEventCountHostKnown
            ?? null,
          dispatchMode:
            finalStep?.residentProductMassProductEventDispatchMode
            ?? finalStep?.p2gGridProjection
              ?.residentProductMassProductEventDispatchMode
            ?? null,
          renderProductEventBufferBound:
            renderState?.productEventBufferBound === true,
          renderProductEventBufferByteLength:
            renderState?.productEventBufferByteLength ?? null,
          renderResidentProductMassStatus:
            renderState?.residentProductMassStatus ?? null,
          renderCountAuthority:
            renderState?.productEventCountAuthority ?? null,
          renderControlAuthentication:
            renderState?.productEventControlAuthentication ?? null,
          renderControlHostObserved:
            renderState?.productEventControlHostObserved ?? null,
          renderCountHostKnown:
            renderState?.productEventCountHostKnown ?? null,
          renderGeneration:
            renderState?.productEventCountAuthorityGeneration ?? null,
          renderSeal:
            renderState?.productEventCountAuthoritySeal ?? null
        },
        surfaceStress: surfaceStress == null ? null : {
          schema: surfaceStress.schema ?? null,
          status: surfaceStress.status ?? null,
          submitted: surfaceStress.submitted === true,
          dispatchCount: Number(surfaceStress.dispatchCount) || 0,
          lifecycleDispatchCount: Number(surfaceStress.lifecycleDispatchCount) || 0,
          verification: surfaceStress.verification ?? null
        },
        twoLevelAuthority: twoLevel?.authority
          ?? finalStep?.twoLevelMechanicsAuthority
          ?? null,
        twoLevelCommitVerified:
          finalStep?.twoLevelAuthoritativeCommitVerified === true,
        twoLevelFineSubstepCount:
          finalStep?.twoLevelFineSubstepCount ?? null
      }
    };
  });
}

async function nativeCanvasClip(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const sceneApi = overlay?.__sphScene || null;
    const bridge = sceneApi?.getSphResidentSurfaceDrawRenderBridge?.() || null;
    const nativeConsumer = sceneApi?.scene?.userData?.sphNativeWebGpuSurfaceConsumer
      || bridge?.nativeConsumer
      || null;
    const canvas = nativeConsumer?.canvas || bridge?.canvas || null;
    const rect = canvas?.getBoundingClientRect?.();
    if (
      !canvas
      || !canvas.isConnected
      || bridge?.rendererBridge !== 'native-webgpu-surface-consumer'
      || !rect
      || !(rect.width > 20)
      || !(rect.height > 20)
    ) return null;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const visibleLeft = Math.max(0, rect.left);
    const visibleTop = Math.max(0, rect.top);
    const visibleRight = Math.min(viewportWidth, rect.right);
    const visibleBottom = Math.min(viewportHeight, rect.bottom);
    const visibleWidth = visibleRight - visibleLeft;
    const visibleHeight = visibleBottom - visibleTop;
    if (!(visibleWidth > 20) || !(visibleHeight > 20)) return null;
    const width = Math.min(480, visibleWidth * 0.8);
    const height = Math.min(360, visibleHeight * 0.8);
    return {
      x: visibleLeft + (visibleWidth - width) / 2,
      y: visibleTop + (visibleHeight - height) / 2,
      width,
      height
    };
  });
}

function publicFrame(frame) {
  if (!frame) return null;
  const { bytes: _bytes, ...publicValue } = frame;
  return publicValue;
}

function frameCaptureIdentity(snapshot) {
  return Object.freeze({
    residentStep: snapshot?.nextStep ?? null,
    residentTimeS: snapshot?.nextTimeS ?? null,
    presentedSourceStep:
      snapshot?.renderBridgeSourceResidentNextStep ?? null,
    residentSubmissions: snapshot?.residentSubmissions ?? null,
    renderBridgeFrameCount: snapshot?.renderBridgeFrameCount ?? null,
    renderBridgeUpdateCount: snapshot?.renderBridgeUpdateCount ?? null
  });
}

export function visualLivenessCaptureWindowStable(before, after) {
  return Boolean(
    visualLivenessQuiescentPresentationReady(before)
    && visualLivenessQuiescentPresentationReady(after)
    && Number.isSafeInteger(before?.nextStep)
    && before.nextStep === after?.nextStep
    && Number.isFinite(before?.nextTimeS)
    && before.nextTimeS === after?.nextTimeS
    && Number.isSafeInteger(before?.renderBridgeSourceResidentNextStep)
    && before.renderBridgeSourceResidentNextStep
      === after?.renderBridgeSourceResidentNextStep
    && Number.isSafeInteger(before?.residentSubmissions)
    && before.residentSubmissions === after?.residentSubmissions
  );
}

export function visualLivenessQuiescentWindowStable(
  before,
  after,
  {
    elapsedMs = 0,
    minStableMs = QUIESCENT_CAPTURE_STABILITY_MS
  } = {}
) {
  return Boolean(
    Number.isFinite(elapsedMs)
    && Number.isFinite(minStableMs)
    && minStableMs >= 0
    && elapsedMs >= minStableMs
    && visualLivenessCaptureWindowStable(before, after)
  );
}

async function captureCompositorFrame(
  page,
  outputDirectory,
  role,
  ordinal,
  snapshot = null
) {
  const clip = await nativeCanvasClip(page);
  if (!clip) throw new Error('native compositor canvas clip is unavailable');
  const bytes = await page.screenshot({
    type: 'png',
    clip,
    timeout: COMPOSITOR_CAPTURE_TIMEOUT_MS
  });
  const fileName = `frame-${String(ordinal).padStart(2, '0')}-${role}.png`;
  const filePath = path.join(outputDirectory, fileName);
  // Preserve the native compositor artifact even when validation rejects it;
  // timeout/failure receipts need the actual pixels that caused the failure.
  await writeFile(filePath, bytes);
  const decoded = decodePhysicalPixelPng(bytes);
  const frame = Object.freeze({
    role,
    path: filePath,
    byteLength: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    validationStatus: decoded?.status ?? 'invalid',
    visibleSurfaceContent: decoded?.hasVisibleSurfaceContent === true,
    png: publicPhysicalPixelPngMetrics(decoded),
    source: snapshot == null ? null : frameCaptureIdentity(snapshot),
    bytes
  });
  if (decoded?.status !== 'ready' || decoded.hasVisibleSurfaceContent !== true) {
    const error = new Error(
      `native compositor frame is not visible surface content: ${decoded?.reason || decoded?.status}`
    );
    error.visualLivenessFrame = frame;
    throw error;
  }
  return frame;
}

function bestFrameDelta(referenceFrame, candidateFrames) {
  let best = null;
  for (const frame of candidateFrames) {
    const delta = comparePhysicalPixelPngFrames(
      referenceFrame.bytes,
      frame.bytes,
      {
        minChannelDelta: 2,
        minChangedPixelCount: 8,
        minChangedPixelRatio: 0.001,
        minChangedBoundsWidth: 2,
        minChangedBoundsHeight: 2
      }
    );
    const candidate = { ...delta, candidateRole: frame.role };
    if (
      best == null
      || candidate.visibleContentAdvanced === true
      || Number(candidate.changedPixelCount) > Number(best.changedPixelCount)
    ) {
      best = candidate;
    }
    if (candidate.visibleContentAdvanced === true) break;
  }
  return best;
}

function sendChildMessage(value) {
  try {
    process.send?.(value);
  } catch {
    // The supervising parent may already have enforced the process deadline.
  }
}

async function setPlaybackActive(page, active) {
  const result = await page.evaluate((requestedActive) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const button = overlay?.querySelector('#sph-play');
    if (!button || button.disabled) {
      return {
        changed: false,
        playbackActive: null,
        playText: button?.textContent?.trim?.() || null,
        reason: button ? 'play-button-disabled' : 'play-button-missing'
      };
    }
    const beforeActive = String(button.textContent || '').trim() === 'Pause';
    if (beforeActive !== requestedActive) button.click();
    const playText = String(button.textContent || '').trim();
    return {
      changed: beforeActive !== requestedActive,
      playbackActive: playText === 'Pause',
      playText,
      reason: null
    };
  }, active);
  if (result?.playbackActive !== active) {
    throw new Error(
      `failed to ${active ? 'start' : 'pause'} visual autoplay: `
      + `${result?.reason || result?.playText || 'unknown play-control state'}`
    );
  }
  return result;
}

export async function waitForQuiescentCaptureSnapshot(page, {
  timeoutMs = COMPOSITOR_CAPTURE_TIMEOUT_MS,
  onSnapshot = null,
  sampleSnapshot = snapshotPage,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now
} = {}) {
  const deadlineAtMs = now() + timeoutMs;
  let snapshot = null;
  let stableSnapshot = null;
  let stableSinceMs = null;
  while (now() < deadlineAtMs) {
    snapshot = await sampleSnapshot(page);
    onSnapshot?.(snapshot);
    const observedAtMs = now();
    if (!visualLivenessQuiescentPresentationReady(snapshot)) {
      stableSnapshot = null;
      stableSinceMs = null;
    } else if (
      stableSnapshot != null
      && visualLivenessQuiescentWindowStable(stableSnapshot, snapshot, {
        elapsedMs: observedAtMs - stableSinceMs
      })
    ) {
      return snapshot;
    } else if (
      stableSnapshot == null
      || !visualLivenessCaptureWindowStable(stableSnapshot, snapshot)
    ) {
      stableSnapshot = snapshot;
      stableSinceMs = observedAtMs;
    }
    await sleep(100);
  }
  throw new Error(
    `native compositor source did not quiesce within ${timeoutMs} ms`
  );
}

async function runScenarioChild({ scenario, outputDirectory, port, deadlines }) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const consoleCapture = createBrowserConsoleCapture();
  const consoleErrors = [];
  const requestFailures = [];
  const pageCrashes = [];
  const snapshots = [];
  const acceptedSnapshots = [];
  const frames = [];
  let lastSnapshot = null;
  let browser = null;
  let context = null;
  let page = null;
  let vite = null;
  let ownedServer = null;
  let browserLaunch = null;
  let result = null;
  let lastPartialEvidence = null;
  try {
    await mkdir(outputDirectory, { recursive: true });
    const borrowedBaseUrl = String(
      process.env.ULG_VISUAL_LIVENESS_BASE_URL || ''
    ).trim();
    let baseUrl;
    if (borrowedBaseUrl) {
      baseUrl = borrowedBaseUrl;
      ownedServer = {
        ownership: 'borrowed',
        baseUrl,
        stoppedByScenario: false
      };
    } else {
      vite = startOwnedVite(port);
      baseUrl = `http://127.0.0.1:${port}`;
      await waitForHttp(baseUrl, { timeoutMs: 20_000 });
      ownedServer = {
        ownership: 'owned-process-group-child',
        baseUrl,
        pid: vite.process.pid,
        stoppedByScenario: true
      };
    }

    const extraArgs = String(
      process.env.ULG_VISUAL_LIVENESS_CHROMIUM_ARGS || ''
    ).split(/\s+/u).map((value) => value.trim()).filter(Boolean);
    browserLaunch = Object.freeze({
      headless: parseBoolean(process.env.ULG_VISUAL_LIVENESS_HEADLESS, true),
      executablePath:
        process.env.ULG_VISUAL_LIVENESS_CHROMIUM_EXECUTABLE || null,
      args: Object.freeze([...new Set([...GPU_LAUNCH_ARGS, ...extraArgs])]),
      viewport: DEFAULT_VIEWPORT,
      ignoreHTTPSErrors: true
    });
    browser = await chromium.launch({
      headless: browserLaunch.headless,
      args: browserLaunch.args,
      ...(browserLaunch.executablePath
        ? { executablePath: browserLaunch.executablePath }
        : {})
    });
    context = await browser.newContext({
      viewport: DEFAULT_VIEWPORT,
      ignoreHTTPSErrors: true
    });
    page = await context.newPage();
    page.setDefaultTimeout(10_000);
    await page.addInitScript(installGpuFaultCaptureScript());
    page.on('console', (message) => {
      consoleCapture.recordConsole(message);
      if (message.type() === 'error') {
        consoleErrors.push({
          text: message.text().slice(0, 2_000),
          location: message.location()
        });
      }
    });
    page.on('pageerror', (error) => consoleCapture.recordPageError(error));
    page.on('crash', () => pageCrashes.push({ at: new Date().toISOString() }));
    page.on('requestfailed', (request) => {
      if (!['document', 'script', 'stylesheet', 'worker', 'fetch', 'xhr']
        .includes(request.resourceType())) return;
      requestFailures.push({
        url: request.url(),
        resourceType: request.resourceType(),
        failure: request.failure()?.errorText || null
      });
    });

    const targetUrl = new URL(scenario.url, baseUrl).toString();
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: Math.min(30_000, deadlines.overlay)
    });
    sendChildMessage({ type: 'phase', phase: 'navigated', atMs: Date.now() });

    let readyAtMs = null;
    let firstAdvanceAtMs = null;
    let initialPresentationAtMs = null;
    let initialPresentationSnapshot = null;
    let autoplayStartedAtMs = null;
    let baselineSnapshot = null;
    let baselineFrame = null;
    let frameDelta = null;
    let milestone = evaluateVisualLivenessMilestone(scenario.id, null);
    let lastAcceptedSnapshot = null;
    let sustainedProgress = evaluateVisualLivenessSustainedProgress();
    const checkpointSnapshots = [];
    const partialCheckpointPath = path.join(
      outputDirectory,
      'scenario-checkpoint.json'
    );
    const partialEvidence = () => ({
      schema: 'peercompute.ulg.sph-visual-animation-liveness-checkpoint.v1',
      scenarioId: scenario.id,
      updatedAt: new Date().toISOString(),
      lastSnapshot,
      initialPresentation: initialPresentationSnapshot == null ? null : {
        capturedAtMs: initialPresentationAtMs - startedAtMs,
        snapshot: initialPresentationSnapshot
      },
      autoplayStart: autoplayStartedAtMs == null ? null : {
        mode: VISUAL_LIVENESS_AUTOPLAY_START_MODE,
        startedAtMs: autoplayStartedAtMs - startedAtMs
      },
      samples: acceptedSnapshots.slice(-8),
      checkpointSnapshots: checkpointSnapshots.map((entry) => ({
        threshold: entry.threshold,
        stepDelta: entry.stepDelta,
        snapshot: entry.snapshot
      })),
      milestone,
      sustainedProgress,
      frames: frames.map(publicFrame),
      compositorDelta: frameDelta,
      consoleSummary: consoleCapture.summary(),
      consoleErrors,
      requestFailures,
      pageCrashes
    });
    const persistPartialEvidence = async () => {
      const evidence = partialEvidence();
      lastPartialEvidence = evidence;
      await atomicWriteJson(partialCheckpointPath, evidence);
      sendChildMessage({ type: 'evidence', evidence });
      return evidence;
    };
    const recordSnapshot = (snapshot) => {
      lastSnapshot = snapshot;
      snapshots.push(snapshot);
      if (snapshots.length > 64) snapshots.shift();
      sendChildMessage({ type: 'snapshot', snapshot });
      return snapshot;
    };
    const captureAndRecordFrame = async (role, beforeSnapshot) => {
      try {
        const capturedFrame = await captureCompositorFrame(
          page,
          outputDirectory,
          role,
          frames.length,
          beforeSnapshot
        );
        const afterSnapshot = recordSnapshot(await snapshotPage(page));
        const frame = Object.freeze({
          ...capturedFrame,
          source: frameCaptureIdentity(afterSnapshot),
          captureWindow: Object.freeze({
            before: frameCaptureIdentity(beforeSnapshot),
            after: frameCaptureIdentity(afterSnapshot)
          })
        });
        if (!visualLivenessCaptureWindowStable(beforeSnapshot, afterSnapshot)) {
          const error = new Error(
            'native compositor source changed during screenshot capture'
          );
          error.visualLivenessFrame = frame;
          throw error;
        }
        frames.push(frame);
        await persistPartialEvidence();
        return { frame, snapshot: afterSnapshot };
      } catch (error) {
        if (error?.visualLivenessFrame) {
          frames.push(error.visualLivenessFrame);
          await persistPartialEvidence();
        }
        throw error;
      }
    };

    while (Date.now() - startedAtMs < deadlines.absolute) {
      recordSnapshot(await snapshotPage(page));

      if (
        lastSnapshot.residentError != null
        || lastSnapshot.renderError != null
        || lastSnapshot.workerRebuildError != null
      ) {
        throw new Error(
          lastSnapshot.residentError
          || lastSnapshot.renderError
          || lastSnapshot.workerRebuildError
        );
      }
      if (
        Number.isSafeInteger(lastSnapshot.residentSubmissions)
        && lastSnapshot.residentSubmissions > 0
        && !exactZeroReadbackTelemetry(lastSnapshot)
      ) {
        throw new Error('resident visual liveness zero-readback contract failed');
      }
      const consoleSummary = consoleCapture.summary();
      if (
        consoleSummary.issueCount > 0
        || consoleErrors.length > 0
        || consoleSummary.pageErrorCount > 0
        || requestFailures.length > 0
        || pageCrashes.length > 0
      ) {
        throw new Error('browser, page, request, or WebGPU fault observed');
      }

      if (
        initialPresentationSnapshot == null
        && visualLivenessInitialPresentationReady(lastSnapshot)
      ) {
        initialPresentationAtMs = Date.now();
        const initialCapture = await captureAndRecordFrame(
          'initial',
          lastSnapshot
        );
        initialPresentationSnapshot = initialCapture.snapshot;
        baselineFrame = initialCapture.frame;
        await setPlaybackActive(page, true);
        autoplayStartedAtMs = Date.now();
        await persistPartialEvidence();
        sendChildMessage({
          type: 'phase',
          phase: 'autoplay-started-after-initial-presentation',
          atMs: autoplayStartedAtMs,
          snapshot: initialPresentationSnapshot
        });
      }

      if (
        initialPresentationSnapshot != null
        && visualLivenessSnapshotReady(lastSnapshot)
      ) {
        if (readyAtMs == null) {
          readyAtMs = Date.now();
          baselineSnapshot = lastSnapshot;
          lastAcceptedSnapshot = baselineSnapshot;
          milestone = evaluateVisualLivenessMilestone(
            scenario.id,
            baselineSnapshot
          );
          sendChildMessage({
            type: 'phase',
            phase: 'ready',
            atMs: readyAtMs,
            snapshot: baselineSnapshot
          });
        } else if (
          visualLivenessSnapshotAdvanced(lastAcceptedSnapshot, lastSnapshot)
        ) {
          acceptedSnapshots.push(lastSnapshot);
          lastAcceptedSnapshot = lastSnapshot;
          if (firstAdvanceAtMs == null) firstAdvanceAtMs = Date.now();
          milestone = evaluateVisualLivenessMilestone(scenario.id, lastSnapshot);

          const physicsStepDelta = Math.max(
            0,
            Number(lastSnapshot.nextStep) - Number(baselineSnapshot.nextStep || 0)
          );
          const presentedStepDelta = Math.max(
            0,
            Number(lastSnapshot.renderBridgeSourceResidentNextStep)
              - Number(
                baselineSnapshot.renderBridgeSourceResidentNextStep || 0
              )
          );
          const correlatedStepDelta = Math.min(
            physicsStepDelta,
            presentedStepDelta
          );
          const nextCheckpointThreshold =
            VISUAL_LIVENESS_CHECKPOINT_STEP_DELTAS[
              checkpointSnapshots.length
            ] ?? null;
          if (
            nextCheckpointThreshold != null
            && correlatedStepDelta >= nextCheckpointThreshold
          ) {
            await setPlaybackActive(page, false);
            const quiescentBefore = await waitForQuiescentCaptureSnapshot(
              page,
              {
                onSnapshot: recordSnapshot
              }
            );
            if (!exactZeroReadbackTelemetry(quiescentBefore)) {
              throw new Error(
                'checkpoint compositor capture lost zero-readback telemetry'
              );
            }
            const quiescentPhysicsDelta = Math.max(
              0,
              Number(quiescentBefore.nextStep)
                - Number(baselineSnapshot.nextStep || 0)
            );
            const quiescentPresentedDelta = Math.max(
              0,
              Number(quiescentBefore.renderBridgeSourceResidentNextStep)
                - Number(
                  baselineSnapshot.renderBridgeSourceResidentNextStep || 0
                )
            );
            const quiescentCorrelatedDelta = Math.min(
              quiescentPhysicsDelta,
              quiescentPresentedDelta
            );
            if (quiescentCorrelatedDelta < nextCheckpointThreshold) {
              throw new Error(
                `checkpoint ${nextCheckpointThreshold} regressed while pausing`
              );
            }
            const checkpointCapture = await captureAndRecordFrame(
              `checkpoint-${nextCheckpointThreshold}`,
              quiescentBefore
            );
            const checkpoint = {
              threshold: nextCheckpointThreshold,
              stepDelta: quiescentCorrelatedDelta,
              snapshot: checkpointCapture.snapshot
            };
            checkpointSnapshots.push(checkpoint);
            lastAcceptedSnapshot = checkpoint.snapshot;
            milestone = evaluateVisualLivenessMilestone(
              scenario.id,
              checkpoint.snapshot
            );
            frameDelta = bestFrameDelta(baselineFrame, frames.slice(1));
            await setPlaybackActive(page, true);
          }
          sustainedProgress = evaluateVisualLivenessSustainedProgress({
            baselineSnapshot,
            currentSnapshot: lastSnapshot,
            firstAdvanceAtMs,
            currentAtMs: Date.now(),
            checkpointSnapshots,
            milestonePassed: milestone.passed === true
          });
          await persistPartialEvidence();
          sendChildMessage({
            type: 'progress',
            snapshot: lastSnapshot,
            acceptedSampleCount: acceptedSnapshots.length,
            visibleContentAdvanced: frameDelta?.visibleContentAdvanced === true,
            milestonePassed: milestone.passed === true,
            sustainedProgress
          });
        }

        if (
          frameDelta?.visibleContentAdvanced === true
          && milestone.passed === true
          && sustainedProgress.passed === true
        ) {
          result = {
            schema: VISUAL_LIVENESS_SCENARIO_SCHEMA,
            id: scenario.id,
            label: scenario.label,
            url: targetUrl,
            status: 'complete',
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAtMs,
            initialPresentation: {
              capturedAtMs: initialPresentationAtMs - startedAtMs,
              snapshot: initialPresentationSnapshot
            },
            autoplayStart: {
              mode: VISUAL_LIVENESS_AUTOPLAY_START_MODE,
              startedAtMs: autoplayStartedAtMs - startedAtMs
            },
            readiness: {
              readyAtMs: readyAtMs - startedAtMs,
              firstAdvanceAtMs: firstAdvanceAtMs - startedAtMs,
              initialSnapshot: baselineSnapshot
            },
            acceptedSampleCount: acceptedSnapshots.length,
            samples: acceptedSnapshots.slice(-8),
            checkpointSnapshots,
            milestone,
            sustainedProgress,
            frames: frames.map(publicFrame),
            compositorDelta: frameDelta,
            consoleSummary: consoleCapture.summary(),
            consoleErrors,
            requestFailures,
            pageCrashes,
            browserLaunch,
            ownedServer,
            failure: null
          };
          break;
        }
      }

      const elapsedMs = Date.now() - startedAtMs;
      if (!lastSnapshot.overlayPresent && elapsedMs >= deadlines.overlay) {
        throw new Error(`overlay did not appear within ${deadlines.overlay} ms`);
      }
      if (readyAtMs == null && elapsedMs >= deadlines.readiness) {
        throw new Error(`particle state and native frame were not ready within ${deadlines.readiness} ms`);
      }
      if (readyAtMs != null && firstAdvanceAtMs == null && elapsedMs >= deadlines.firstAdvance) {
        throw new Error(`autoplay did not complete its first presented step within ${deadlines.firstAdvance} ms`);
      }
      if (
        readyAtMs != null
        && frameDelta?.visibleContentAdvanced !== true
        && elapsedMs >= deadlines.visibleMotion
      ) {
        throw new Error(`compositor pixels did not visibly advance within ${deadlines.visibleMotion} ms`);
      }
      if (milestone.passed !== true && elapsedMs >= deadlines.milestone) {
        throw new Error(`scenario milestone did not pass within ${deadlines.milestone} ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    if (!result) throw new Error(`scenario exceeded ${deadlines.absolute} ms`);
  } catch (error) {
    result = {
      schema: VISUAL_LIVENESS_SCENARIO_SCHEMA,
      id: scenario.id,
      label: scenario.label,
      url: scenario.url,
      status: 'failed',
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      lastSnapshot,
      snapshots: snapshots.slice(-8),
      initialPresentation: lastPartialEvidence?.initialPresentation
        || (initialPresentationSnapshot == null ? null : {
          capturedAtMs: initialPresentationAtMs - startedAtMs,
          snapshot: initialPresentationSnapshot
        }),
      autoplayStart: lastPartialEvidence?.autoplayStart
        || (autoplayStartedAtMs == null ? null : {
          mode: VISUAL_LIVENESS_AUTOPLAY_START_MODE,
          startedAtMs: autoplayStartedAtMs - startedAtMs
        }),
      samples: lastPartialEvidence?.samples || [],
      checkpointSnapshots:
        lastPartialEvidence?.checkpointSnapshots || [],
      milestone: lastPartialEvidence?.milestone || null,
      sustainedProgress: lastPartialEvidence?.sustainedProgress || null,
      frames: frames.map(publicFrame),
      compositorDelta: lastPartialEvidence?.compositorDelta || null,
      consoleSummary: consoleCapture.summary(),
      consoleErrors,
      consoleTail: consoleCapture.entries.slice(-25),
      pageErrors: consoleCapture.pageErrors.slice(-10),
      requestFailures,
      pageCrashes,
      browserLaunch,
      ownedServer,
      failure: serializeFailure(error)
    };
  } finally {
    if (page) await page.close({ runBeforeUnload: false }).catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) {
      await Promise.race([
        browser.close().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2_000))
      ]);
    }
    if (vite?.process) {
      const stopped = await stopDirectChild(vite.process, 2_000);
      ownedServer = {
        ...ownedServer,
        stopped,
        output: vite.output()
      };
      if (result) result.ownedServer = ownedServer;
    }
  }
  const resultPath = path.join(outputDirectory, 'scenario.json');
  await atomicWriteJson(resultPath, result);
  sendChildMessage({ type: 'result', result, resultPath });
  return result;
}

async function scenarioChildMain() {
  const scenarioId = childArgument('scenario');
  const outputDirectory = childArgument('output-dir');
  const port = Number(childArgument('port'));
  const scenario = standardVisualLivenessScenarios(scenarioId)[0];
  if (!outputDirectory || !Number.isSafeInteger(port) || port <= 0) {
    throw new Error('visual liveness child arguments are incomplete');
  }
  const deadlines = resolveVisualLivenessDeadlines(process.env);
  const result = await runScenarioChild({
    scenario,
    outputDirectory: path.resolve(outputDirectory),
    port,
    deadlines
  });
  process.exitCode = result.status === 'complete' ? 0 : 1;
}

export function timeoutFailure({
  scenario,
  type,
  message,
  startedAtMs,
  lastSnapshot,
  partialEvidence = null,
  logs,
  artifactDirectory = null
}) {
  return {
    schema: VISUAL_LIVENESS_SCENARIO_SCHEMA,
    id: scenario.id,
    label: scenario.label,
    url: scenario.url,
    status: 'failed',
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    artifactDirectory,
    lastSnapshot: lastSnapshot || partialEvidence?.lastSnapshot || null,
    initialPresentation: partialEvidence?.initialPresentation || null,
    autoplayStart: partialEvidence?.autoplayStart || null,
    samples: Array.isArray(partialEvidence?.samples)
      ? partialEvidence.samples
      : [],
    checkpointSnapshots: Array.isArray(partialEvidence?.checkpointSnapshots)
      ? partialEvidence.checkpointSnapshots
      : [],
    milestone: partialEvidence?.milestone || null,
    sustainedProgress: partialEvidence?.sustainedProgress || null,
    frames: Array.isArray(partialEvidence?.frames)
      ? partialEvidence.frames
      : [],
    compositorDelta: partialEvidence?.compositorDelta || null,
    consoleSummary: partialEvidence?.consoleSummary || null,
    consoleErrors: Array.isArray(partialEvidence?.consoleErrors)
      ? partialEvidence.consoleErrors
      : [],
    requestFailures: Array.isArray(partialEvidence?.requestFailures)
      ? partialEvidence.requestFailures
      : [],
    pageCrashes: Array.isArray(partialEvidence?.pageCrashes)
      ? partialEvidence.pageCrashes
      : [],
    failure: { type, message },
    supervisorLogs: logs
  };
}

async function readPartialScenarioEvidence(filePath) {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function superviseScenario({
  scenario,
  outputDirectory,
  deadlines,
  onProcessGroup = null
}) {
  const port = await reserveLocalPort();
  const scenarioDirectory = path.join(
    outputDirectory,
    scenario.id,
    `attempt-${Date.now()}-${randomUUID()}`
  );
  const temporaryDirectory = path.join(
    '/tmp',
    `ulg-pw-liveness-${process.pid}-${scenario.id}-${randomUUID()}`
  );
  await Promise.all([
    mkdir(scenarioDirectory, { recursive: true }),
    mkdir(temporaryDirectory, { recursive: true })
  ]);
  const startedAtMs = Date.now();
  const child = fork(scriptPath, [
    '--visual-liveness-child',
    `--scenario=${scenario.id}`,
    `--port=${port}`,
    `--output-dir=${scenarioDirectory}`
  ], {
    cwd: repoDir,
    detached: true,
    env: {
      ...process.env,
      TMPDIR: temporaryDirectory
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  onProcessGroup?.(child.pid);
  let stdout = Buffer.alloc(0);
  let stderr = Buffer.alloc(0);
  let lastSnapshot = null;
  let lastAcceptedSnapshot = null;
  let lastPartialEvidence = null;
  let overlayAtMs = null;
  let readyAtMs = null;
  let firstAdvanceAtMs = null;
  let lastProgressAtMs = null;
  let childResult = null;
  let childResultPath = null;
  let completionDeadlineMs = null;
  let timeout = null;
  child.stdout.on('data', (chunk) => {
    stdout = appendBounded(stdout, chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr = appendBounded(stderr, chunk);
  });
  child.on('message', (message) => {
    if (!message || typeof message !== 'object') return;
    if (message.snapshot && typeof message.snapshot === 'object') {
      lastSnapshot = message.snapshot;
      const now = Date.now();
      if (lastSnapshot.overlayPresent === true && overlayAtMs == null) {
        overlayAtMs = now;
      }
      if (visualLivenessSnapshotReady(lastSnapshot) && readyAtMs == null) {
        readyAtMs = now;
        lastProgressAtMs = now;
        lastAcceptedSnapshot = lastSnapshot;
      } else if (
        readyAtMs != null
        && visualLivenessSnapshotAdvanced(lastAcceptedSnapshot, lastSnapshot)
      ) {
        lastAcceptedSnapshot = lastSnapshot;
        lastProgressAtMs = now;
        if (firstAdvanceAtMs == null) firstAdvanceAtMs = now;
      }
    }
    if (message.type === 'result') {
      childResult = message.result;
      childResultPath = message.resultPath || null;
      completionDeadlineMs = Date.now() + 5_000;
    }
    if (
      message.type === 'evidence'
      && message.evidence
      && typeof message.evidence === 'object'
    ) {
      lastPartialEvidence = message.evidence;
    }
  });

  const closed = new Promise((resolve) => {
    child.once('error', (error) => resolve({
      code: null,
      signal: null,
      error: compactError(error)
    }));
    child.once('close', (code, signal) => resolve({ code, signal, error: null }));
  });

  const monitor = setInterval(() => {
    const now = Date.now();
    const elapsed = now - startedAtMs;
    if (timeout != null) return;
    if (overlayAtMs == null && elapsed >= deadlines.overlay) {
      timeout = {
        type: 'overlay-timeout',
        message: `overlay did not appear within ${deadlines.overlay} ms`
      };
    } else if (readyAtMs == null && elapsed >= deadlines.readiness) {
      timeout = {
        type: 'readiness-timeout',
        message: `particle state and initial compositor frame were not ready within ${deadlines.readiness} ms`
      };
    } else if (readyAtMs != null && firstAdvanceAtMs == null && elapsed >= deadlines.firstAdvance) {
      timeout = {
        type: 'first-advance-timeout',
        message: `first autoplay advancement exceeded ${deadlines.firstAdvance} ms`
      };
    } else if (
      readyAtMs != null
      && lastProgressAtMs != null
      && now - lastProgressAtMs >= deadlines.noProgress
    ) {
      timeout = {
        type: 'no-progress-timeout',
        message: `physics and presentation made no joint progress for ${deadlines.noProgress} ms`
      };
    } else if (elapsed >= deadlines.absolute) {
      timeout = {
        type: 'absolute-timeout',
        message: `scenario exceeded the absolute ${deadlines.absolute} ms deadline`
      };
    } else if (completionDeadlineMs != null && now >= completionDeadlineMs) {
      timeout = {
        type: 'cleanup-timeout',
        message: 'scenario reported a result but did not exit within 5000 ms'
      };
    }
  }, 100);

  let exit;
  try {
    while (timeout == null) {
      const winner = await Promise.race([
        closed.then((value) => ({ type: 'closed', value })),
        new Promise((resolve) => setTimeout(
          () => resolve({ type: 'tick' }),
          100
        ))
      ]);
      if (winner.type === 'closed') {
        exit = winner.value;
        break;
      }
    }
    if (timeout != null) {
      await terminateOwnedProcessGroup(child.pid, {
        termGraceMs: 2_000,
        killGraceMs: Math.max(1_000, deadlines.cleanup - 2_000)
      });
      exit = await Promise.race([
        closed,
        new Promise((resolve) => setTimeout(() => resolve({
          code: null,
          signal: 'cleanup-wait-timeout',
          error: null
        }), deadlines.cleanup))
      ]);
    }
  } finally {
    clearInterval(monitor);
  }

  const cleanup = await terminateOwnedProcessGroup(child.pid, {
    termGraceMs: 500,
    killGraceMs: Math.max(1_000, deadlines.cleanup - 500)
  });
  const logs = {
    stdout: stdout.toString('utf8'),
    stderr: stderr.toString('utf8'),
    exit,
    childResultPath
  };
  const diskPartialEvidence = await readPartialScenarioEvidence(
    path.join(scenarioDirectory, 'scenario-checkpoint.json')
  );
  const partialEvidence = diskPartialEvidence || lastPartialEvidence;
  if (timeout != null) {
    const failed = timeoutFailure({
      scenario,
      ...timeout,
      startedAtMs,
      lastSnapshot,
      partialEvidence,
      artifactDirectory: scenarioDirectory,
      logs
    });
    failed.cleanup = cleanup;
    await atomicWriteJson(path.join(scenarioDirectory, 'scenario.json'), failed);
    return failed;
  }
  if (!childResult) {
    const failed = timeoutFailure({
      scenario,
      type: 'child-exited-without-result',
      message: `scenario child exited code=${exit?.code} signal=${exit?.signal}`,
      startedAtMs,
      lastSnapshot,
      partialEvidence,
      artifactDirectory: scenarioDirectory,
      logs
    });
    failed.cleanup = cleanup;
    await atomicWriteJson(path.join(scenarioDirectory, 'scenario.json'), failed);
    return failed;
  }
  return {
    ...childResult,
    artifactDirectory: scenarioDirectory,
    supervisor: logs,
    cleanup
  };
}

async function matrixMain() {
  const deadlines = resolveVisualLivenessDeadlines(process.env);
  const scenarioSelection = String(
    process.env.ULG_VISUAL_LIVENESS_SCENARIOS || ''
  ).trim() || null;
  const scenarios = standardVisualLivenessScenarios(
    scenarioSelection
  );
  const standardScenarios = standardVisualLivenessScenarios();
  const exactStandardScenarioInventory = Boolean(
    scenarios.length === standardScenarios.length
    && scenarios.every((scenario, index) => (
      scenario.id === standardScenarios[index]?.id
      && scenario.label === standardScenarios[index]?.label
      && scenario.url === standardScenarios[index]?.url
    ))
  );
  const outputDirectory = path.resolve(
    process.env.ULG_VISUAL_LIVENESS_OUTPUT_DIR
      || path.join('/tmp', `ulg-sph-visual-liveness-${process.pid}`)
  );
  const receiptPath = path.resolve(
    process.env.ULG_VISUAL_LIVENESS_OUTPUT
      || path.join(outputDirectory, 'receipt.json')
  );
  await mkdir(outputDirectory, { recursive: true });
  const startedAtMs = Date.now();
  const sourceFingerprintBefore = await exactWorktreeFingerprint(repoDir);
  const receipt = {
    schema: VISUAL_LIVENESS_RECEIPT_SCHEMA,
    policyId: VISUAL_LIVENESS_POLICY_ID,
    coverage: VISUAL_LIVENESS_COVERAGE,
    status: 'running',
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: null,
    durationMs: null,
    repoDir,
    outputDirectory,
    receiptPath,
    deadlines,
    autoplayStartMode: VISUAL_LIVENESS_AUTOPLAY_START_MODE,
    minimumAdvancementSampleCount: MIN_ADVANCEMENT_SAMPLE_COUNT,
    maximumCompositorFrameCount: MAX_COMPOSITOR_FRAME_COUNT,
    sourceFingerprintBefore,
    sourceFingerprintAfter: null,
    sourceStable: null,
    scenarioCount: scenarios.length,
    scenarios: [],
    failures: []
  };
  await atomicWriteJson(receiptPath, receipt);

  let activeProcessGroupId = null;
  let terminating = false;
  const handleSignal = async (signal) => {
    if (terminating) return;
    terminating = true;
    if (activeProcessGroupId != null) {
      await terminateOwnedProcessGroup(activeProcessGroupId).catch(() => {});
    }
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', () => void handleSignal('SIGINT'));
  process.once('SIGTERM', () => void handleSignal('SIGTERM'));

  for (const scenario of scenarios) {
    const scenarioResult = await superviseScenario({
      scenario,
      outputDirectory,
      deadlines,
      onProcessGroup: (processGroupId) => {
        activeProcessGroupId = processGroupId;
      }
    });
    activeProcessGroupId = null;
    receipt.scenarios.push(scenarioResult);
    if (scenarioResult.status !== 'complete') {
      receipt.failures.push({
        scenarioId: scenario.id,
        failure: scenarioResult.failure
      });
      await atomicWriteJson(receiptPath, receipt);
      break;
    }
    await atomicWriteJson(receiptPath, receipt);
  }

  receipt.sourceFingerprintAfter = await exactWorktreeFingerprint(repoDir);
  receipt.sourceStable = exactWorktreeFingerprintsEqual(
    receipt.sourceFingerprintBefore,
    receipt.sourceFingerprintAfter
  );
  if (!receipt.sourceStable) {
    receipt.failures.push({
      scenarioId: null,
      failure: {
        type: 'source-drift',
        message: 'worktree changed during the visual liveness receipt'
      }
    });
  }
  receipt.completedAt = new Date().toISOString();
  receipt.durationMs = Date.now() - startedAtMs;
  receipt.status = (
    receipt.failures.length === 0
    && receipt.scenarios.length === scenarios.length
    && receipt.scenarios.every((scenario) => scenario.status === 'complete')
  ) ? 'complete' : 'failed';
  if (receipt.status === 'complete' && exactStandardScenarioInventory) {
    try {
      const artifactEvidence = await readVisualLivenessArtifactEvidence({
        receipt,
        repoDir
      });
      const formalEvaluation = evaluateVisualLivenessReceipt(receipt, {
        currentFingerprint: receipt.sourceFingerprintAfter,
        artifactEvidence
      });
      if (formalEvaluation.passed !== true) {
        receipt.failures.push({
          scenarioId: null,
          failure: {
            type: 'formal-evaluation-failed',
            message: formalEvaluation.failures.join('; '),
            failures: formalEvaluation.failures
          }
        });
      }
    } catch (error) {
      receipt.failures.push({
        scenarioId: null,
        failure: {
          type: 'formal-evaluation-error',
          message: compactError(error)
        }
      });
    }
  }
  const sourceFingerprintFinal = await exactWorktreeFingerprint(repoDir);
  if (!exactWorktreeFingerprintsEqual(
    receipt.sourceFingerprintBefore,
    receipt.sourceFingerprintAfter,
    sourceFingerprintFinal
  )) {
    receipt.sourceFingerprintAfter = sourceFingerprintFinal;
    receipt.sourceStable = false;
    if (!receipt.failures.some(
      ({ failure }) => failure?.type === 'source-drift'
    )) {
      receipt.failures.push({
        scenarioId: null,
        failure: {
          type: 'source-drift',
          message: 'worktree changed during final visual artifact validation'
        }
      });
    }
  }
  receipt.completedAt = new Date().toISOString();
  receipt.durationMs = Date.now() - startedAtMs;
  receipt.status = (
    receipt.failures.length === 0
    && receipt.scenarios.length === scenarios.length
    && receipt.scenarios.every((scenario) => scenario.status === 'complete')
  ) ? 'complete' : 'failed';
  await atomicWriteJson(receiptPath, receipt);
  process.stdout.write(`${JSON.stringify({
    schema: receipt.schema,
    status: receipt.status,
    receiptPath,
    durationMs: receipt.durationMs,
    completedScenarioCount: receipt.scenarios.filter(
      (scenario) => scenario.status === 'complete'
    ).length,
    scenarioCount: scenarios.length,
    failures: receipt.failures
  })}\n`);
  process.exitCode = receipt.status === 'complete' ? 0 : 1;
}

export function visualLivenessReceiptSummary(receipt) {
  return Object.freeze({
    schema: receipt?.schema ?? null,
    status: receipt?.status ?? null,
    policyId: receipt?.policyId ?? null,
    coverage: receipt?.coverage ?? null,
    scenarioCount: Array.isArray(receipt?.scenarios)
      ? receipt.scenarios.length
      : 0,
    completeScenarioCount: Array.isArray(receipt?.scenarios)
      ? receipt.scenarios.filter((scenario) => scenario?.status === 'complete').length
      : 0,
    failureCount: Array.isArray(receipt?.failures) ? receipt.failures.length : 0
  });
}

function exactZeroReadbackTelemetry(snapshot) {
  return Boolean(
    snapshot?.telemetry?.schema === 'peercompute.ulg.gpu-readback-telemetry.v1'
    && snapshot.telemetry.complete === true
    && snapshot.telemetry.normalHotLoopReadbackFree === true
    && Number.isSafeInteger(snapshot.telemetry.mapAsyncCount)
    && snapshot.telemetry.mapAsyncCount === 0
    && Number.isSafeInteger(snapshot.telemetry.readbackBytes)
    && snapshot.telemetry.readbackBytes === 0
    && Number.isSafeInteger(snapshot.telemetry.hostQueueFenceCount)
    && snapshot.telemetry.hostQueueFenceCount === 0
  );
}

function exactDefaultBrowserLaunch(browserLaunch) {
  return Boolean(
    browserLaunch?.headless === true
    && browserLaunch?.executablePath == null
    && canonicalJson(browserLaunch?.args) === canonicalJson(GPU_LAUNCH_ARGS)
    && canonicalJson(browserLaunch?.viewport) === canonicalJson(DEFAULT_VIEWPORT)
    && browserLaunch?.ignoreHTTPSErrors === true
  );
}

function exactScenarioUrl(scenario, expected) {
  try {
    const baseUrl = new URL(scenario?.ownedServer?.baseUrl);
    const observed = new URL(scenario?.url);
    const expectedUrl = new URL(expected.url, baseUrl);
    return baseUrl.protocol === 'http:'
      && baseUrl.hostname === '127.0.0.1'
      && observed.href === expectedUrl.href;
  } catch {
    return false;
  }
}

function snapshotHasNoFault(snapshot) {
  return Boolean(
    visualLivenessSnapshotReady(snapshot)
    && exactZeroReadbackTelemetry(snapshot)
    && Number(snapshot?.staleResidentSubmissions ?? 0) === 0
    && snapshot?.residentPending == null
    && snapshot?.residentError == null
    && snapshot?.renderError == null
    && snapshot?.workerRebuildError == null
  );
}

function initialPresentationSnapshotHasNoFault(snapshot) {
  return Boolean(
    visualLivenessInitialPresentationReady(snapshot)
    && Number(snapshot?.staleResidentSubmissions ?? 0) === 0
    && snapshot?.residentPending == null
    && snapshot?.residentError == null
    && snapshot?.renderError == null
    && snapshot?.workerRebuildError == null
    && (
      snapshot?.telemetry?.schema == null
      || exactZeroReadbackTelemetry(snapshot)
    )
  );
}

function quiescentSnapshotHasNoFault(snapshot) {
  return Boolean(
    visualLivenessQuiescentPresentationReady(snapshot)
    && exactZeroReadbackTelemetry(snapshot)
    && Number(snapshot?.staleResidentSubmissions ?? 0) === 0
    && snapshot?.residentPending == null
    && snapshot?.residentError == null
    && snapshot?.renderError == null
    && snapshot?.workerRebuildError == null
  );
}

function expectedFrameRoles() {
  return Object.freeze([
    'initial',
    ...VISUAL_LIVENESS_CHECKPOINT_STEP_DELTAS.map(
      (threshold) => `checkpoint-${threshold}`
    )
  ]);
}

function frameArtifactMetadata(frameEvidence) {
  if (!frameEvidence) return null;
  return {
    path: frameEvidence.artifactPath,
    byteLength: frameEvidence.byteLength,
    sha256: frameEvidence.sha256
  };
}

/**
 * Independently re-reads and decodes every compositor PNG named by a bounded
 * visual receipt. The returned path key is intentionally `artifactPath`, not
 * `path`: the contained-release graph already owns the same authenticated
 * path and must not mistake the reader's second observation for a new logical
 * artifact.
 */
export async function readVisualLivenessArtifactEvidence({
  receipt,
  repoDir: evidenceRepoDir = repoDir
}) {
  const scenarios = Array.isArray(receipt?.scenarios) ? receipt.scenarios : [];
  const frameRows = scenarios.flatMap((scenario, scenarioIndex) => (
    (Array.isArray(scenario?.frames) ? scenario.frames : []).map(
      (frame, frameIndex) => ({ scenario, scenarioIndex, frame, frameIndex })
    )
  ));
  if (frameRows.length >= 2) {
    await assertArtifactPathsPairwiseDistinct({
      repoDir: evidenceRepoDir,
      label: 'bounded visual compositor frames',
      paths: frameRows.map(({ scenario, frame, frameIndex }) => ({
        path: frame?.path,
        label: `${scenario?.id || 'unknown'} compositor frame ${frameIndex}`
      }))
    });
  }
  const evidenceScenarios = [];
  for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex += 1) {
    const scenario = scenarios[scenarioIndex];
    const frames = [];
    for (let frameIndex = 0; frameIndex < (scenario?.frames?.length ?? 0); frameIndex += 1) {
      const sourceFrame = scenario.frames[frameIndex];
      const expectedName = `frame-${String(frameIndex).padStart(2, '0')}-${sourceFrame?.role}.png`;
      if (
        path.dirname(path.resolve(sourceFrame?.path ?? ''))
          !== path.resolve(scenario?.artifactDirectory ?? '')
        || path.basename(sourceFrame?.path ?? '') !== expectedName
      ) {
        throw new Error(`${scenario?.id || 'visual scenario'} frame path mismatch`);
      }
      const artifact = await readHashedArtifact({
        artifactPath: sourceFrame.path,
        repoDir: evidenceRepoDir,
        label: `${scenario.id} compositor frame ${frameIndex}`,
        includeBytes: true,
        maxByteLength: 32 * 1024 * 1024
      });
      const decoded = decodePhysicalPixelPng(artifact.bytes);
      frames.push(Object.freeze({
        artifactPath: artifact.path,
        byteLength: artifact.byteLength,
        sha256: artifact.sha256,
        png: publicPhysicalPixelPngMetrics(decoded),
        bytes: artifact.bytes
      }));
    }
    const reference = frames[0];
    const computedDelta = reference == null
      ? null
      : bestFrameDelta(
          { ...reference, role: scenario?.frames?.[0]?.role },
          frames.slice(1).map((frame, index) => ({
            ...frame,
            role: scenario?.frames?.[index + 1]?.role
          }))
        );
    evidenceScenarios.push(Object.freeze({
      id: scenario?.id ?? null,
      frames: Object.freeze(frames.map(({ bytes: _bytes, ...frame }) => (
        Object.freeze(frame)
      ))),
      computedDelta
    }));
  }
  return Object.freeze({ scenarios: Object.freeze(evidenceScenarios) });
}

export function evaluateVisualLivenessReceipt(receipt, {
  currentFingerprint,
  artifactEvidence
} = {}) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const expectedScenarios = standardVisualLivenessScenarios();
  const scenarios = Array.isArray(receipt?.scenarios) ? receipt.scenarios : [];
  if (receipt?.schema !== VISUAL_LIVENESS_RECEIPT_SCHEMA) {
    fail('bounded visual receipt schema mismatch');
  }
  if (receipt?.policyId !== VISUAL_LIVENESS_POLICY_ID) {
    fail('bounded visual policy mismatch');
  }
  if (receipt?.coverage !== VISUAL_LIVENESS_COVERAGE) {
    fail('bounded visual coverage mismatch');
  }
  if (receipt?.status !== 'complete') fail('bounded visual receipt did not complete');
  if (
    receipt?.sourceStable !== true
    || !exactWorktreeFingerprintsEqual(
      receipt?.sourceFingerprintBefore,
      receipt?.sourceFingerprintAfter,
      currentFingerprint
    )
  ) {
    fail('bounded visual exact source binding mismatch');
  }
  if (canonicalJson(receipt?.deadlines) !== canonicalJson(VISUAL_LIVENESS_LIMITS_MS)) {
    fail('bounded visual deadline policy mismatch');
  }
  if (receipt?.autoplayStartMode !== VISUAL_LIVENESS_AUTOPLAY_START_MODE) {
    fail('bounded visual controlled autoplay policy mismatch');
  }
  if (
    receipt?.minimumAdvancementSampleCount !== MIN_ADVANCEMENT_SAMPLE_COUNT
    || receipt?.maximumCompositorFrameCount !== MAX_COMPOSITOR_FRAME_COUNT
  ) {
    fail('bounded visual sampling policy mismatch');
  }
  if (
    receipt?.scenarioCount !== expectedScenarios.length
    || scenarios.length !== expectedScenarios.length
    || !Array.isArray(receipt?.failures)
    || receipt.failures.length !== 0
  ) {
    fail('bounded visual receipt must contain the complete four-demo inventory');
  }
  const maximumMatrixDurationMs = expectedScenarios.length
    * (VISUAL_LIVENESS_LIMITS_MS.absolute + VISUAL_LIVENESS_LIMITS_MS.cleanup);
  if (
    !Number.isFinite(Number(receipt?.durationMs))
    || Number(receipt.durationMs) < 0
    || Number(receipt.durationMs) > maximumMatrixDurationMs
  ) {
    fail('bounded visual matrix exceeded its fixed wall-clock budget');
  }
  const evidenceScenarios = Array.isArray(artifactEvidence?.scenarios)
    ? artifactEvidence.scenarios
    : [];
  if (evidenceScenarios.length !== expectedScenarios.length) {
    fail('bounded visual compositor artifact evidence is incomplete');
  }
  for (let index = 0; index < expectedScenarios.length; index += 1) {
    const expected = expectedScenarios[index];
    const scenario = scenarios[index];
    const evidence = evidenceScenarios[index];
    const prefix = `bounded visual scenario ${expected.id}`;
    if (
      scenario?.schema !== VISUAL_LIVENESS_SCENARIO_SCHEMA
      || scenario?.id !== expected.id
      || scenario?.label !== expected.label
      || !exactScenarioUrl(scenario, expected)
      || evidence?.id !== expected.id
    ) {
      fail(`${prefix} identity mismatch`);
      continue;
    }
    if (
      scenario?.status !== 'complete'
      || scenario?.failure != null
      || !Number.isFinite(Number(scenario?.durationMs))
      || Number(scenario.durationMs) < 0
      || Number(scenario.durationMs) > VISUAL_LIVENESS_LIMITS_MS.absolute
      || scenario?.ownedServer?.ownership !== 'owned-process-group-child'
      || scenario?.ownedServer?.stoppedByScenario !== true
      || scenario?.ownedServer?.stopped !== true
      || !exactDefaultBrowserLaunch(scenario?.browserLaunch)
      || scenario?.supervisor?.exit?.code !== 0
      || scenario?.supervisor?.exit?.signal != null
      || scenario?.supervisor?.exit?.error != null
      || scenario?.cleanup?.stopped !== true
    ) {
      fail(`${prefix} lifecycle or fixed runtime policy failed`);
    }
    const initialPresentation = scenario?.initialPresentation;
    const initialPresentationSnapshot = initialPresentation?.snapshot;
    const autoplayStart = scenario?.autoplayStart;
    const baseline = scenario?.readiness?.initialSnapshot;
    const samples = Array.isArray(scenario?.samples) ? scenario.samples : [];
    const finalSnapshot = samples.at(-1);
    const checkpoints = Array.isArray(scenario?.checkpointSnapshots)
      ? scenario.checkpointSnapshots
      : [];
    if (
      !initialPresentationSnapshotHasNoFault(initialPresentationSnapshot)
      || !snapshotHasNoFault(baseline)
      || checkpoints.some(
        (checkpoint) => !quiescentSnapshotHasNoFault(checkpoint?.snapshot)
      )
      || !snapshotHasNoFault(finalSnapshot)
      || !samples.every((snapshot) => snapshotHasNoFault(snapshot))
    ) {
      fail(`${prefix} reported an invalid, readback, or faulted snapshot`);
    }
    if (
      autoplayStart?.mode !== VISUAL_LIVENESS_AUTOPLAY_START_MODE
      || !Number.isFinite(Number(initialPresentation?.capturedAtMs))
      || Number(initialPresentation.capturedAtMs) < 0
      || !Number.isFinite(Number(autoplayStart?.startedAtMs))
      || Number(autoplayStart.startedAtMs)
        < Number(initialPresentation.capturedAtMs)
      || !Number.isFinite(Number(scenario?.readiness?.readyAtMs))
      || Number(scenario.readiness.readyAtMs)
        < Number(autoplayStart.startedAtMs)
      || !Number.isFinite(Number(scenario?.readiness?.firstAdvanceAtMs))
      || Number(scenario.readiness.firstAdvanceAtMs)
        < Number(scenario.readiness.readyAtMs)
    ) {
      fail(`${prefix} controlled autoplay ordering failed`);
    }
    for (let checkpointIndex = 0; checkpointIndex < VISUAL_LIVENESS_CHECKPOINT_STEP_DELTAS.length; checkpointIndex += 1) {
      const threshold = VISUAL_LIVENESS_CHECKPOINT_STEP_DELTAS[checkpointIndex];
      const checkpoint = checkpoints[checkpointIndex];
      if (
        checkpoint?.threshold !== threshold
        || Number(checkpoint?.stepDelta) < threshold
        || !visualLivenessQuiescentSnapshotAdvanced(
          checkpointIndex === 0 ? baseline : checkpoints[checkpointIndex - 1]?.snapshot,
          checkpoint?.snapshot
        )
      ) {
        fail(`${prefix} checkpoint ${threshold} is not correlated`);
      }
    }
    const physicsStepDelta = Number(finalSnapshot?.nextStep) - Number(baseline?.nextStep);
    const presentedStepDelta = Number(finalSnapshot?.renderBridgeSourceResidentNextStep)
      - Number(baseline?.renderBridgeSourceResidentNextStep ?? 0);
    const presentationLag = Number(finalSnapshot?.nextStep)
      - Number(finalSnapshot?.renderBridgeSourceResidentNextStep);
    if (
      checkpoints.length !== VISUAL_LIVENESS_CHECKPOINT_STEP_DELTAS.length
      || Number(scenario?.acceptedSampleCount) < MIN_ADVANCEMENT_SAMPLE_COUNT
      || samples.length < MIN_ADVANCEMENT_SAMPLE_COUNT
      || physicsStepDelta < MIN_SUSTAINED_PRESENTED_STEP_COUNT
      || presentedStepDelta < MIN_SUSTAINED_PRESENTED_STEP_COUNT
      || presentationLag < 0
      || presentationLag > MAX_PRESENTATION_STEP_LAG
      || scenario?.sustainedProgress?.passed !== true
      || Number(scenario?.sustainedProgress?.sustainedDurationMs)
        < MIN_SUSTAINED_PROGRESS_MS
      || Number(scenario?.sustainedProgress?.physicsStepDelta) !== physicsStepDelta
      || Number(scenario?.sustainedProgress?.presentedStepDelta) !== presentedStepDelta
      || scenario?.sustainedProgress?.checkpointsPassed !== true
    ) {
      fail(`${prefix} did not prove sustained correlated progress`);
    }
    const milestone = evaluateVisualLivenessMilestone(expected.id, finalSnapshot);
    if (
      milestone.passed !== true
      || scenario?.milestone?.passed !== true
      || scenario?.milestone?.id !== milestone.id
    ) {
      fail(`${prefix} route milestone failed`);
    }
    const warningCounts = Object.values(scenario?.consoleSummary?.warningCounts ?? {});
    if (
      Number(scenario?.consoleSummary?.issueCount) !== 0
      || Number(scenario?.consoleSummary?.pageErrorCount) !== 0
      || warningCounts.some((value) => Number(value) !== 0)
      || !Array.isArray(scenario?.consoleErrors)
      || scenario.consoleErrors.length !== 0
      || !Array.isArray(scenario?.requestFailures)
      || scenario.requestFailures.length !== 0
      || !Array.isArray(scenario?.pageCrashes)
      || scenario.pageCrashes.length !== 0
    ) {
      fail(`${prefix} browser or GPU fault evidence is not clean`);
    }
    const frames = Array.isArray(scenario?.frames) ? scenario.frames : [];
    const evidenceFrames = Array.isArray(evidence?.frames) ? evidence.frames : [];
    const roles = expectedFrameRoles();
    if (frames.length !== roles.length || evidenceFrames.length !== roles.length) {
      fail(`${prefix} compositor frame coverage mismatch`);
    }
    for (let frameIndex = 0; frameIndex < roles.length; frameIndex += 1) {
      const frame = frames[frameIndex];
      const observed = evidenceFrames[frameIndex];
      const expectedSnapshot = frameIndex === 0
        ? initialPresentationSnapshot
        : checkpoints[frameIndex - 1]?.snapshot;
      const captureBefore = frame?.captureWindow?.before;
      const captureAfter = frame?.captureWindow?.after;
      const stableCaptureSource = Boolean(
        Number.isSafeInteger(captureBefore?.residentStep)
        && captureBefore.residentStep === captureAfter?.residentStep
        && Number.isFinite(captureBefore?.residentTimeS)
        && captureBefore.residentTimeS === captureAfter?.residentTimeS
        && Number.isSafeInteger(captureBefore?.presentedSourceStep)
        && captureBefore.presentedSourceStep
          === captureAfter?.presentedSourceStep
        && Number.isSafeInteger(captureBefore?.residentSubmissions)
        && captureBefore.residentSubmissions
          === captureAfter?.residentSubmissions
        && Number.isSafeInteger(captureBefore?.renderBridgeFrameCount)
        && Number.isSafeInteger(captureAfter?.renderBridgeFrameCount)
        && captureAfter.renderBridgeFrameCount
          >= captureBefore.renderBridgeFrameCount
        && Number.isSafeInteger(captureBefore?.renderBridgeUpdateCount)
        && Number.isSafeInteger(captureAfter?.renderBridgeUpdateCount)
        && captureAfter.renderBridgeUpdateCount
          >= captureBefore.renderBridgeUpdateCount
      );
      if (
        frame?.role !== roles[frameIndex]
        || frame?.validationStatus !== 'ready'
        || frame?.visibleSurfaceContent !== true
        || !artifactMetadataMatches(frame, frameArtifactMetadata(observed))
        || observed?.png?.status !== 'ready'
        || observed?.png?.hasVisibleSurfaceContent !== true
        || canonicalJson(frame?.png) !== canonicalJson(observed?.png)
        || !stableCaptureSource
        || canonicalJson(frame?.source) !== canonicalJson(captureAfter)
        || frame?.source?.residentStep !== expectedSnapshot?.nextStep
        || frame?.source?.residentTimeS !== expectedSnapshot?.nextTimeS
        || frame?.source?.residentSubmissions
          !== expectedSnapshot?.residentSubmissions
        || frame?.source?.presentedSourceStep
          !== expectedSnapshot?.renderBridgeSourceResidentNextStep
        || frame?.source?.renderBridgeFrameCount
          !== expectedSnapshot?.renderBridgeFrameCount
        || frame?.source?.renderBridgeUpdateCount
          !== expectedSnapshot?.renderBridgeUpdateCount
      ) {
        fail(`${prefix} compositor frame ${frameIndex} mismatch`);
      }
    }
    if (
      evidence?.computedDelta?.visibleContentAdvanced !== true
      || canonicalJson(scenario?.compositorDelta)
        !== canonicalJson(evidence?.computedDelta)
    ) {
      fail(`${prefix} compositor pixels did not visibly advance`);
    }
  }
  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze([...new Set(failures)])
  });
}

const isMain = process.argv[1] != null
  && path.resolve(process.argv[1]) === scriptPath;

if (isMain) {
  const childMode = process.argv.includes('--visual-liveness-child');
  Promise.resolve(childMode ? scenarioChildMain() : matrixMain()).catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  });
}
