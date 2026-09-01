#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetUrl
} from '../src/runtime/sphPhaseScenarioPresets.js';
import {
  ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA
} from '../src/services/workerResidentScheduleTaskYielder.js';

export const SPH_PRESET_THROUGHPUT_MATRIX_SCHEMA =
  'peercompute.ulg.sph-preset-throughput-matrix.v0';
export const SPH_PRESET_THROUGHPUT_SCENARIO_SCHEMA =
  'peercompute.ulg.sph-preset-throughput-scenario.v0';

const DEFAULT_BASE_URL = 'https://127.0.0.1:5173';
const DEFAULT_OUTPUT = '/tmp/ulg-sph-preset-throughput-matrix.json';
const DEFAULT_INIT_TIMEOUT_MS = 300_000;
const DEFAULT_SAMPLE_TIMEOUT_MS = 600_000;
const DEFAULT_NO_PROGRESS_TIMEOUT_MS = 180_000;
const DEFAULT_POLL_MS = 250;
const DEFAULT_WARMUP_COMMIT_COUNT = 1;
const DEFAULT_SAMPLE_INTERVAL_COUNT = 2;
const DEFAULT_MIN_REALTIME_FACTOR = 1;

const TIER0_PRESET_IDS = new Set(['bulk-water', 'water-realtime']);

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

export function expectedSphPresetExecutionRoute(presetId) {
  return TIER0_PRESET_IDS.has(String(presetId))
    ? 'tier0-fused-resident-sequence'
    : 'canonical-schroeder';
}

function routeEvidenceIsReadbackFree(sample) {
  const route = sample?.executionRoute;
  if (!route || sample?.fullParticleReadbackFree !== true) return false;
  if (route.route === 'tier0-fused-resident-sequence') {
    return route.fullParticleReadbackPerformed === false
      && route.fullParticleReadbackFree === true
      && route.mapAsyncCount === 0
      && route.readbackBytes === 0;
  }
  // Canonical receipts intentionally seal route-local byte counters as null;
  // the public execution envelope is the authoritative no-full-readback fact.
  return route.fullParticleReadbackPerformed === false;
}

export function evaluateSphPresetThroughputSamples({
  presetId,
  samples = [],
  warmupCommitCount = DEFAULT_WARMUP_COMMIT_COUNT,
  minRealtimeFactor = DEFAULT_MIN_REALTIME_FACTOR
} = {}) {
  const expectedRoute = expectedSphPresetExecutionRoute(presetId);
  const warmup = nonNegativeInteger(
    warmupCommitCount,
    DEFAULT_WARMUP_COMMIT_COUNT
  );
  const measured = samples.slice(Math.min(warmup, samples.length));
  const first = measured[0] ?? null;
  const last = measured.at(-1) ?? null;
  const wallDeltaS = first && last
    ? Math.max(0, (Number(last.capturedAtMs) - Number(first.capturedAtMs)) / 1000)
    : 0;
  const simTimeDeltaS = first && last
    ? Math.max(0, Number(last.laneSimTimeS) - Number(first.laneSimTimeS))
    : 0;
  const stepDelta = first && last
    ? Math.max(
        0,
        Number(last.laneCompletedStepTotal)
          - Number(first.laneCompletedStepTotal)
      )
    : 0;
  const realTimeFactor = wallDeltaS > 0 ? simTimeDeltaS / wallDeltaS : null;
  const physicsStepsPerSecond = wallDeltaS > 0 ? stepDelta / wallDeltaS : null;
  const intervals = [];
  for (let index = 1; index < measured.length; index += 1) {
    const previous = measured[index - 1];
    const current = measured[index];
    const workerTurnaroundMs = Number.isFinite(
      Number(current.scheduleFirstStepStartedAtMs)
    ) && Number.isFinite(Number(previous.resultAssembledAtMs))
      ? Number(current.scheduleFirstStepStartedAtMs)
        - Number(previous.resultAssembledAtMs)
      : null;
    intervals.push({
      previousScheduleId: previous.scheduleId ?? null,
      scheduleId: current.scheduleId ?? null,
      wallDeltaMs:
        Number(current.capturedAtMs) - Number(previous.capturedAtMs),
      simTimeDeltaS:
        Number(current.laneSimTimeS) - Number(previous.laneSimTimeS),
      stepDelta:
        Number(current.laneCompletedStepTotal)
          - Number(previous.laneCompletedStepTotal),
      workerTurnaroundMs,
      previousPostComputeMs:
        finiteNumber(previous.lastResidentPostComputeMs)
    });
  }
  const routes = measured.map((sample) => sample?.executionRoute?.route ?? null);
  const routeMatched = measured.length >= 2
    && routes.every((route) => route === expectedRoute);
  const terminalAuthorityReady = measured.length >= 2
    && measured.every((sample) => (
      sample?.workerLaneContinuationReady === true
      && sample?.executionRoute?.terminalFenceSatisfied === true
      && (
        sample?.executionRoute?.route !== 'tier0-fused-resident-sequence'
        || sample?.executionRoute?.residentContinuationReady === true
      )
      && sample?.committedPresentationReady === true
    ));
  const readbackFree = measured.length >= 2
    && measured.every(routeEvidenceIsReadbackFree);
  const noRuntimeErrors = measured.length >= 2
    && measured.every((sample) => sample?.runtimeError == null);
  const controlPlaneYieldReceipts = measured.map(
    (sample) => sample?.controlPlaneYieldReceipt ?? null
  );
  const controlPlaneYieldEvidenceReady = measured.length >= 2
    && controlPlaneYieldReceipts.every((receipt) => (
      receipt?.schema
        === ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA
      && receipt.portsClosed === true
      && Number.isSafeInteger(receipt.completedYieldCount)
      && receipt.completedYieldCount >= 0
      && Number.isSafeInteger(receipt.yieldRequestCount)
      && receipt.yieldRequestCount === receipt.completedYieldCount
      && Number.isSafeInteger(receipt.messageChannelYieldCount)
      && receipt.messageChannelYieldCount >= 0
      && Number.isSafeInteger(receipt.timerFallbackYieldCount)
      && receipt.timerFallbackYieldCount >= 0
      && receipt.messageChannelYieldCount + receipt.timerFallbackYieldCount
        === receipt.completedYieldCount
      && Number.isSafeInteger(receipt.ownedPortCount)
      && receipt.ownedPortCount >= 0
      && Number.isSafeInteger(receipt.closedPortCount)
      && receipt.closedPortCount === receipt.ownedPortCount
      && Number.isFinite(receipt.totalWaitMs)
      && receipt.totalWaitMs >= 0
    ));
  const controlPlaneYieldMechanisms = Object.freeze([
    ...new Set(
      controlPlaneYieldReceipts
        .map((receipt) => receipt?.mechanism ?? null)
        .filter(Boolean)
    )
  ]);
  const meanControlPlaneYieldWaitMs = mean(
    controlPlaneYieldReceipts.map(
      (receipt) => finiteNumber(receipt?.totalWaitMs)
    )
  );
  const meanControlPlaneYieldWaitPerBoundaryMs = mean(
    controlPlaneYieldReceipts.map((receipt) => {
      const waitMs = finiteNumber(receipt?.totalWaitMs);
      const completedYieldCount = Number(receipt?.completedYieldCount);
      if (waitMs == null || !Number.isSafeInteger(completedYieldCount)) {
        return null;
      }
      return completedYieldCount > 0 ? waitMs / completedYieldCount : 0;
    })
  );
  const threshold = positiveNumber(
    minRealtimeFactor,
    DEFAULT_MIN_REALTIME_FACTOR
  );
  const realTimePassed = Number.isFinite(realTimeFactor)
    && realTimeFactor >= threshold;
  const passed = Boolean(
    measured.length >= 2
    && stepDelta > 0
    && routeMatched
    && terminalAuthorityReady
    && readbackFree
    && noRuntimeErrors
    && realTimePassed
  );
  return Object.freeze({
    status: passed ? 'pass' : 'fail',
    passed,
    presetId: String(presetId || ''),
    expectedRoute,
    warmupCommitCount: warmup,
    measuredCommitCount: measured.length,
    measuredIntervalCount: intervals.length,
    wallDeltaS,
    simTimeDeltaS,
    stepDelta,
    realTimeFactor,
    physicsStepsPerSecond,
    minimumRealtimeFactor: threshold,
    realTimePassed,
    routeMatched,
    terminalAuthorityReady,
    readbackFree,
    noRuntimeErrors,
    controlPlaneYieldEvidenceReady,
    controlPlaneYieldMechanisms,
    meanControlPlaneYieldWaitMs,
    meanControlPlaneYieldWaitPerBoundaryMs,
    meanWorkerTurnaroundMs: mean(
      intervals.map((interval) => interval.workerTurnaroundMs)
    ),
    meanPostComputeMs: mean(
      intervals.map((interval) => interval.previousPostComputeMs)
    ),
    intervals: Object.freeze(intervals.map((interval) => Object.freeze(interval)))
  });
}

function parseScenarioSelection(value) {
  const available = new Map(
    SPH_PHASE_SCENARIO_PRESETS.map((entry) => [entry.id, entry])
  );
  const selectedIds = String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (selectedIds.length === 0) return [...available.values()];
  const missing = selectedIds.filter((id) => !available.has(id));
  if (missing.length > 0) {
    throw new Error(`unknown SPH preset(s): ${missing.join(', ')}`);
  }
  return selectedIds.map((id) => available.get(id));
}

async function compactPageSnapshot(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const execution = overlay?.__mlsMpmResidentSteps ?? null;
    const lane = execution?.workerOwnedResidentLane ?? null;
    const route = lane?.executionRoute ?? null;
    const presentation = lane?.committedPresentation ?? null;
    const lastStepSummary = lane?.perStepSummaries?.lastStep ?? null;
    const lastStepRing = Array.isArray(lane?.perStepSummaries?.ring)
      ? lane.perStepSummaries.ring.at(-1) ?? null
      : null;
    const perf = overlay?.__sphResidentPerf ?? null;
    const pendingPreview = overlay?.__sphPendingBodyEnvelopePreview
      ?? null;
    const workerPresentation = overlay?.__sphScene
      ?.getWorkerOffscreenPresentation?.()
      ?? null;
    return {
      capturedAtMs: performance.now(),
      documentUrl: location.href,
      playText:
        document.querySelector('#sph-play')?.textContent?.trim() ?? null,
      playDisabled:
        document.querySelector('#sph-play')?.disabled === true,
      laneCompletedStepTotal: lane?.laneCompletedStepTotal ?? 0,
      laneSimTimeS: lane?.laneSimTimeS ?? 0,
      scheduleId: lane?.scheduleId ?? null,
      scheduleFunctionEnteredAtMs:
        lane?.scheduleFunctionEnteredAtMs ?? null,
      scheduleFirstStepStartedAtMs:
        lane?.scheduleFirstStepStartedAtMs ?? null,
      scheduleLastStepEndedAtMs:
        lane?.scheduleLastStepEndedAtMs ?? null,
      tailTerminalFenceDoneAtMs:
        lane?.tailTerminalFenceDoneAtMs ?? null,
      resultAssembledAtMs: lane?.resultAssembledAtMs ?? null,
      workerLanePageTiming: lane?.workerLanePageTiming == null
        ? null
        : { ...lane.workerLanePageTiming },
      controlPlaneYieldReceipt: lane?.controlPlaneYieldReceipt == null
        ? null
        : { ...lane.controlPlaneYieldReceipt },
      executionRoute: route == null ? null : { ...route },
      fullParticleReadbackPerformed:
        execution?.fullParticleReadbackPerformed === true,
      fullParticleReadbackFree:
        execution?.fullParticleReadbackFree === true,
      requestedReadbackMode: execution?.readbackMode ?? null,
      workerLaneContinuationReady:
        overlay?.__sphWorkerLaneContinuationReady === true,
      committedPresentationReady: Boolean(
        presentation?.stateManagerCommittedPresentation === true
        && presentation?.terminalFenceAuthorityAdmissionReady === true
        && presentation?.status
          === 'worker-offscreen-resident-particle-state-producer-rendered'
      ),
      committedPresentationStatus: presentation?.status ?? null,
      committedPresentationMode:
        presentation?.residentSchedulePresentationMode ?? null,
      committedPresentationPromotedWithoutRedraw:
        presentation?.committedPresentationPromotedWithoutRedraw === true,
      presentationAdmissionPostedAtMs:
        presentation?.presentationAdmissionPostedAtMs ?? null,
      workerPresentationUpdatedAtMs:
        presentation?.workerPresentationUpdatedAtMs ?? null,
      bridgePresentationReceivedAtMs:
        presentation?.bridgePresentationReceivedAtMs ?? null,
      workerPresentationStatus: workerPresentation?.status ?? null,
      workerPresentationSphStep: workerPresentation?.sphStep ?? null,
      particleCount:
        lane?.perStepSummaries?.lastStep?.particleCount ?? null,
      lastStepTiming: lastStepSummary == null
        ? null
        : {
            stepElapsedMs: lastStepSummary.stepElapsedMs ?? null,
            epochStageElapsedMs:
              lastStepSummary.epochStageElapsedMs ?? null,
            mechanicsStageElapsedMs:
              lastStepSummary.mechanicsStageElapsedMs ?? null,
            residentStageTiming:
              lastStepSummary.hierarchyStageSummary?.residentStageTiming
                ?? null,
            ringStepElapsedMs: lastStepRing?.stepElapsedMs ?? null,
            ringEpochStageElapsedMs:
              lastStepRing?.epochStageElapsedMs ?? null,
            ringMechanicsStageElapsedMs:
              lastStepRing?.mechanicsStageElapsedMs ?? null
          },
      submitCensus: lane?.submitCensus ?? null,
      submitBurstObservation: lane?.submitBurstObservation ?? null,
      lastResidentMs: perf?.lastResidentMs ?? null,
      lastResidentCycleMs: perf?.lastResidentCycleMs ?? null,
      lastResidentPostComputeMs: perf?.lastResidentPostComputeMs ?? null,
      renderReadbacks: perf?.renderReadbacks ?? null,
      pendingPreviewActive: pendingPreview?.active === true,
      pendingPreviewStatus: pendingPreview?.status ?? null,
      residentScheduleTrace: Array.isArray(
        overlay?.__sphResidentScheduleTrace
      )
        ? overlay.__sphResidentScheduleTrace.slice(-24).map((entry) => ({
            scheduleToken: entry?.scheduleToken ?? null,
            stage: entry?.stage ?? null,
            atMs: entry?.atMs ?? null
          }))
        : [],
      runtimeError: overlay?.__mlsMpmResidentStepsError == null
        ? null
        : String(
            overlay.__mlsMpmResidentStepsError?.message
              ?? overlay.__mlsMpmResidentStepsError
          ),
      pendingStatus: overlay?.__mlsMpmResidentStepsPending?.status ?? null,
      slowStatus: overlay?.__mlsMpmResidentStepsSlow?.status ?? null,
      statusText:
        document.querySelector('#sph-status')?.textContent?.slice(0, 1_000)
        ?? null,
      warningText:
        document.querySelector('#sph-warning-bar')?.textContent?.slice(0, 1_000)
        ?? null
    };
  });
}

async function runPreset({
  browser,
  entry,
  baseUrl,
  initTimeoutMs,
  sampleTimeoutMs,
  noProgressTimeoutMs,
  pollMs,
  warmupCommitCount,
  sampleIntervalCount,
  minRealtimeFactor
}) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1600, height: 900 }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text().slice(0, 4_000));
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(String(error?.stack || error?.message || error).slice(0, 8_000));
  });
  const relativeUrl = sphPhaseScenarioPresetUrl(entry.id, {
    residentAuto: '0',
    probeEpoch: String(Date.now())
  });
  const targetUrl = new URL(relativeUrl, baseUrl).toString();
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const samples = [];
  let lastSnapshot = null;
  let failure = null;
  try {
    await page.goto(targetUrl, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForSelector('#sph-phase-overlay', {
      timeout: initTimeoutMs
    });
    await page.waitForFunction(() => {
      const play = document.querySelector('#sph-play');
      return Boolean(play && play.disabled === false);
    }, null, { timeout: initTimeoutMs });
    await page.evaluate(() => {
      const play = document.querySelector('#sph-play');
      if (String(play?.textContent || '').trim() === 'Play') play.click();
    });
    const requiredCommitCount = warmupCommitCount + sampleIntervalCount + 1;
    let lastProgressAtMs = Date.now();
    let previousCompletedStepTotal = -1;
    while (Date.now() - startedAtMs < sampleTimeoutMs) {
      lastSnapshot = await compactPageSnapshot(page);
      const completedStepTotal = Number(lastSnapshot.laneCompletedStepTotal);
      if (
        Number.isFinite(completedStepTotal)
        && completedStepTotal > 0
        && completedStepTotal !== previousCompletedStepTotal
      ) {
        samples.push(lastSnapshot);
        previousCompletedStepTotal = completedStepTotal;
        lastProgressAtMs = Date.now();
        if (samples.length >= requiredCommitCount) break;
      }
      if (lastSnapshot.runtimeError != null) {
        failure = {
          type: 'runtime-error',
          message: lastSnapshot.runtimeError
        };
        break;
      }
      if (Date.now() - lastProgressAtMs > noProgressTimeoutMs) {
        failure = {
          type: 'no-progress-timeout',
          message: `no committed schedule advanced for ${noProgressTimeoutMs} ms`
        };
        break;
      }
      await page.waitForTimeout(pollMs);
    }
    if (!failure && samples.length < requiredCommitCount) {
      failure = {
        type: 'sample-timeout',
        message:
          `captured ${samples.length}/${requiredCommitCount} committed schedules`
      };
    }
  } catch (error) {
    failure = {
      type: 'probe-exception',
      message: String(error?.stack || error?.message || error)
    };
  }
  const evaluation = evaluateSphPresetThroughputSamples({
    presetId: entry.id,
    samples,
    warmupCommitCount,
    minRealtimeFactor
  });
  await context.close();
  return {
    schema: SPH_PRESET_THROUGHPUT_SCENARIO_SCHEMA,
    status: failure == null && evaluation.passed ? 'pass' : 'fail',
    presetId: entry.id,
    label: entry.label,
    targetUrl,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    failure,
    evaluation,
    samples,
    lastSnapshot,
    consoleErrors,
    pageErrors
  };
}

async function main() {
  const entries = parseScenarioSelection(
    process.env.ULG_PRESET_THROUGHPUT_SCENARIOS
  );
  const baseUrl = process.env.ULG_PRESET_THROUGHPUT_BASE_URL
    || DEFAULT_BASE_URL;
  const outputPath = path.resolve(
    process.env.ULG_PRESET_THROUGHPUT_OUTPUT || DEFAULT_OUTPUT
  );
  const headless = process.env.ULG_PRESET_THROUGHPUT_HEADLESS !== '0';
  const initTimeoutMs = positiveInteger(
    process.env.ULG_PRESET_THROUGHPUT_INIT_TIMEOUT_MS,
    DEFAULT_INIT_TIMEOUT_MS
  );
  const sampleTimeoutMs = positiveInteger(
    process.env.ULG_PRESET_THROUGHPUT_SAMPLE_TIMEOUT_MS,
    DEFAULT_SAMPLE_TIMEOUT_MS
  );
  const noProgressTimeoutMs = positiveInteger(
    process.env.ULG_PRESET_THROUGHPUT_NO_PROGRESS_TIMEOUT_MS,
    DEFAULT_NO_PROGRESS_TIMEOUT_MS
  );
  const pollMs = positiveInteger(
    process.env.ULG_PRESET_THROUGHPUT_POLL_MS,
    DEFAULT_POLL_MS
  );
  const warmupCommitCount = nonNegativeInteger(
    process.env.ULG_PRESET_THROUGHPUT_WARMUP_COMMITS,
    DEFAULT_WARMUP_COMMIT_COUNT
  );
  const sampleIntervalCount = positiveInteger(
    process.env.ULG_PRESET_THROUGHPUT_SAMPLE_INTERVALS,
    DEFAULT_SAMPLE_INTERVAL_COUNT
  );
  const minRealtimeFactor = positiveNumber(
    process.env.ULG_PRESET_THROUGHPUT_MIN_REALTIME_FACTOR,
    DEFAULT_MIN_REALTIME_FACTOR
  );
  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--enable-unsafe-webgpu',
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer'
    ]
  });
  const receipt = {
    schema: SPH_PRESET_THROUGHPUT_MATRIX_SCHEMA,
    status: 'running',
    startedAt: new Date().toISOString(),
    baseUrl,
    headless,
    policy: {
      warmupCommitCount,
      sampleIntervalCount,
      minimumRealtimeFactor: minRealtimeFactor,
      initTimeoutMs,
      sampleTimeoutMs,
      noProgressTimeoutMs,
      pollMs
    },
    scenarios: []
  };
  try {
    for (const entry of entries) {
      const scenario = await runPreset({
        browser,
        entry,
        baseUrl,
        initTimeoutMs,
        sampleTimeoutMs,
        noProgressTimeoutMs,
        pollMs,
        warmupCommitCount,
        sampleIntervalCount,
        minRealtimeFactor
      });
      receipt.scenarios.push(scenario);
      process.stdout.write(`${JSON.stringify({
        presetId: scenario.presetId,
        status: scenario.status,
        route: scenario.evaluation.expectedRoute,
        realTimeFactor: scenario.evaluation.realTimeFactor,
        physicsStepsPerSecond: scenario.evaluation.physicsStepsPerSecond,
        meanWorkerTurnaroundMs:
          scenario.evaluation.meanWorkerTurnaroundMs,
        meanPostComputeMs: scenario.evaluation.meanPostComputeMs,
        failure: scenario.failure
      })}\n`);
    }
  } finally {
    await browser.close();
  }
  receipt.completedAt = new Date().toISOString();
  receipt.status = receipt.scenarios.length === entries.length
    && receipt.scenarios.every((scenario) => scenario.status === 'pass')
    ? 'pass'
    : 'fail';
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    schema: receipt.schema,
    status: receipt.status,
    outputPath,
    passedScenarioCount: receipt.scenarios.filter(
      (scenario) => scenario.status === 'pass'
    ).length,
    scenarioCount: receipt.scenarios.length
  })}\n`);
  if (receipt.status !== 'pass') process.exitCode = 2;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  await main();
}
