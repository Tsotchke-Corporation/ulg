#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

const route = String(process.argv[2] || 'worker').trim().toLowerCase();
const reactionsEnabled = String(process.argv[3] ?? '1') !== '0';
if (!['worker', 'direct'].includes(route)) {
  throw new Error(`route must be worker or direct, got ${route}`);
}

const baseUrl = process.env.ULG_CANONICAL_PROBE_BASE_URL || 'https://localhost:5173';
const timeoutMs = Math.max(
  5_000,
  Math.floor(Number(process.env.ULG_CANONICAL_PROBE_TIMEOUT_MS) || 75_000)
);
const headless = String(process.env.ULG_CANONICAL_PROBE_HEADLESS || '0') === '1';
const runId = `${route}-lawr${reactionsEnabled ? 1 : 0}-${Date.now()}`;
const artifactDir = path.resolve(
  process.env.ULG_CANONICAL_PROBE_ARTIFACT_DIR
    || path.join('/tmp', 'ulg-canonical-worker-liveness', runId)
);
await mkdir(artifactDir, { recursive: true });

const url = new URL(baseUrl);
for (const [key, value] of Object.entries({
  scenario: 'sodium-water',
  ss: '1',
  lawr: reactionsEnabled ? '1' : '0',
  residentAuto: '0',
  residentStepsPerSchedule: '1',
  residentStepsPerScheduleMax: '1',
  visualCapture: '1',
  renderOwnership: route === 'worker'
    ? 'worker-owned-resident-render-producer'
    : 'main-thread-renderer',
  residentComputeManagerMode: route === 'worker' ? 'compute-manager' : 'direct',
  probeEpoch: Date.now()
})) {
  url.searchParams.set(key, value);
}

const browser = await chromium.launch({
  headless,
  args: [
    '--no-sandbox',
    '--enable-unsafe-webgpu',
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer'
  ]
});
const page = await browser.newPage({
  ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 900 }
});
const consoleRows = [];
page.on('console', (message) => {
  const row = {
    atMs: Date.now(),
    type: message.type(),
    text: message.text().slice(0, 4_000)
  };
  consoleRows.push(row);
  if (consoleRows.length > 1_000) consoleRows.shift();
});
page.on('pageerror', (error) => {
  consoleRows.push({
    atMs: Date.now(),
    type: 'pageerror',
    text: String(error?.stack || error?.message || error).slice(0, 8_000)
  });
});

const compact = (value) => {
  if (!value || typeof value !== 'object') return value ?? null;
  return {
    schema: value.schema ?? null,
    status: value.status ?? null,
    reason: value.reason ?? null,
    detail: value.detail ?? null,
    errorName: value.errorName ?? null,
    errorMessage: value.errorMessage ?? null,
    elapsedMs: Number.isFinite(Number(value.elapsedMs)) ? Number(value.elapsedMs) : null,
    scheduleId: value.scheduleId ?? value.residentScheduleResult?.scheduleId ?? null,
    laneId: value.laneId ?? null,
    stateKey: value.stateKey ?? null,
    stageId: value.stageId ?? null,
    stepCount: value.stepCount ?? null,
    completedStepCount:
      value.completedStepCount ?? value.residentScheduleResult?.completedStepCount ?? null,
    requestedStepCount:
      value.requestedStepCount ?? value.residentScheduleResult?.requestedStepCount ?? null,
    cancelled: value.cancelled ?? value.residentScheduleResult?.cancelled ?? null,
    residentScheduleError: value.residentScheduleError
      ? {
          scheduleId: value.residentScheduleError.scheduleId ?? null,
          stepOrdinal: value.residentScheduleError.stepOrdinal ?? null,
          stageId: value.residentScheduleError.stageId ?? null,
          reason: value.residentScheduleError.reason ?? null,
          message: value.residentScheduleError.message ?? null,
          laneState: value.residentScheduleError.laneState ?? null
        }
      : null
  };
};

async function snapshot() {
  return page.evaluate((compactSource) => {
    // Rehydrate the bounded serializer inside the page without exposing any
    // GPUBuffer-bearing scene objects to Playwright's structured clone.
    const compactValue = (0, eval)(`(${compactSource})`);
    const overlay = document.querySelector('#sph-phase-overlay');
    const sceneApi = overlay?.__sphScene || null;
    const userData = sceneApi?.scene?.userData || null;
    const execution = sceneApi?.getMlsMpmResidentSteps?.()
      || overlay?.__mlsMpmResidentSteps
      || null;
    const workerStage = userData?.sphWorkerOffscreenResidentStage
      || sceneApi?.getWorkerOffscreenPresentation?.()?.workerOffscreenResidentStage
      || null;
    const residentProgress = userData?.mlsMpmResidentStepsProgress || null;
    const pending = overlay?.__mlsMpmResidentStepsPending || null;
    const slow = overlay?.__mlsMpmResidentStepsSlow || null;
    const error = overlay?.__mlsMpmResidentStepsError || null;
    const lane = execution?.workerOwnedResidentLane || null;
    const play = document.querySelector('#sph-play');
    const bodyText = String(document.body?.innerText || '');
    const simTimeText = bodyText.match(/sim t\s+([0-9.]+)s/i)?.[1] ?? null;
    return {
      capturedAtMs: performance.now(),
      documentUrl: location.href,
      overlayPresent: Boolean(overlay),
      play: play
        ? { text: String(play.textContent || '').trim(), disabled: play.disabled === true }
        : null,
      simTimeS: simTimeText == null ? null : Number(simTimeText),
      residentProgress: compactValue(residentProgress),
      residentProgressInner: residentProgress?.innerProgress
        ? compactValue(residentProgress.innerProgress)
        : null,
      pending: compactValue(pending),
      slow: compactValue(slow),
      error: error == null ? null : String(error?.stack || error?.message || error).slice(0, 8_000),
      workerStage: compactValue(workerStage),
      workerLaneFallback: compactValue(userData?.sphWorkerLaneLastFallback || null),
      workerLaneAdmission: compactValue(overlay?.__sphWorkerOwnedResidentLaneAdmission || null),
      runtimeAdmission: compactValue(overlay?.__sphSimulationRuntimeAdmission || null),
      stageOrderTrace: compactValue(overlay?.__sphResidentStageOrderTrace || null),
      execution: execution
        ? {
            schema: execution.schema ?? null,
            status: execution.status ?? null,
            backend: execution.backend ?? null,
            residentComputeManagerMode: execution.residentComputeManagerMode ?? null,
            completedStepCount: execution.completedStepCount ?? null,
            requestedReadbackMode: execution.requestedReadbackMode ?? null,
            workerLaneFallback: compactValue(execution.workerLaneFallback || null),
            lane: lane
              ? {
                  laneId: lane.laneId ?? null,
                  scheduleId: lane.scheduleId ?? null,
                  completedStepCount: lane.completedStepCount ?? null,
                  requestedStepCount: lane.requestedStepCount ?? null,
                  finalEpochIdentity: lane.finalEpochIdentity ?? null,
                  authority: lane.authority ?? null,
                  hierarchyStageSummary: lane.hierarchyStageSummary ?? null
                }
              : null,
            finalStep: execution.finalStep
              ? {
                  status: execution.finalStep.status ?? null,
                  stageStatus: execution.finalStep.stageStatus ?? null,
                  stageBackends: execution.finalStep.stageBackends ?? null,
                  reactionProductPlacementAccumulatorStatus:
                    execution.finalStep.reactionProductPlacementAccumulatorStatus ?? null,
                  reactionProductPlacementProvenance:
                    execution.finalStep.reactionProductPlacementProvenance ?? null
                }
              : null
          }
        : null,
      statusText: String(document.querySelector('#sph-status')?.textContent || '').slice(0, 4_000),
      warningText: String(document.querySelector('#sph-warning-bar')?.textContent || '').slice(0, 2_000)
    };
  }, compact.toString());
}

const startedAtMs = Date.now();
const samples = [];
let terminalReason = 'probe-timeout';
let navigationError = null;
try {
  await page.goto(url.href, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForSelector('#sph-phase-overlay', { timeout: 30_000 });
  await page.waitForFunction(() => {
    const play = document.querySelector('#sph-play');
    return Boolean(play && play.disabled === false && String(play.textContent || '').trim() === 'Play');
  }, null, { timeout: 120_000 });
  await page.screenshot({ path: path.join(artifactDir, 'before-play.png') });
  // The control drawer starts translated offscreen while the button still
  // reports CSS visibility. Open it through the real pointer path first.
  await page.locator('#sph-toggle').click({ timeout: 10_000 });
  await page.locator('#sph-play').waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(400);
  await page.locator('#sph-play').click({ force: true, timeout: 10_000 });
  while (Date.now() - startedAtMs < timeoutMs) {
    const current = await snapshot();
    samples.push(current);
    const completed = Number(current.execution?.completedStepCount) > 0;
    const residentFailed = current.error != null;
    if (completed) {
      terminalReason = 'resident-step-completed';
      break;
    }
    if (residentFailed) {
      terminalReason = 'resident-step-error';
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
} catch (error) {
  navigationError = String(error?.stack || error?.message || error);
  terminalReason = 'probe-exception';
}

await page.screenshot({ path: path.join(artifactDir, 'terminal.png') }).catch(() => {});
const receipt = {
  schema: 'peercompute.ulg.sph-canonical-worker-liveness-probe.v0',
  runId,
  route,
  reactionsEnabled,
  headless,
  url: url.href,
  timeoutMs,
  elapsedMs: Date.now() - startedAtMs,
  terminalReason,
  navigationError,
  sampleCount: samples.length,
  samples,
  consoleRows,
  artifactDir
};
await writeFile(
  path.join(artifactDir, 'receipt.json'),
  `${JSON.stringify(receipt, null, 2)}\n`,
  'utf8'
);
console.log(JSON.stringify({
  ...receipt,
  samples: samples.slice(-5),
  consoleRows: consoleRows.slice(-50)
}, null, 2));
await browser.close();
if (terminalReason !== 'resident-step-completed') process.exitCode = 2;
