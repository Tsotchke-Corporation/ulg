// W4 verification harness: drives the demo with the worker-owned resident
// producer mode and measures the acceptance criteria that define the lane:
//   1. sim advances (physics alive end to end through the worker lane)
//   2. residentComputeManagerMode seals 'worker-owned-resident-lane'
//   3. main-thread long tasks collapse versus the direct route
//   4. physics cadence continues while pointer interaction occupies the page
// Usage: node w4-worker-lane-verify.mjs [scenario] [mode]
//   mode: 'worker-owned' (default), 'default' (no ownership override), or
//   'direct' (baseline comparison run)
import assert from 'node:assert/strict';

const { chromium } = await import('file:///home/cos/projects/ulg/node_modules/playwright/index.mjs');
const scenario = process.argv[2] || 'water-cycle';
const mode = process.argv[3] || 'worker-owned';
const ownership = mode === 'direct'
  ? 'main-thread-renderer'
  : (mode === 'default' ? null : 'worker-owned-resident-render-producer');
const baseUrl = process.env.ULG_W4_BASE_URL || 'https://localhost:5173';
const startupTimeoutMs = Number(process.env.ULG_W4_STARTUP_TIMEOUT_MS || 120000);
const measurementMs = Number(process.env.ULG_W4_MEASUREMENT_MS || 15000);
const dragMeasurementMs = Number(process.env.ULG_W4_DRAG_MS || 5000);
const residentAuto = process.env.ULG_W4_RESIDENT_AUTO === '0' ? 0 : 1;
const ownershipQuery = ownership ? `&renderOwnership=${ownership}` : '';
const url = `${baseUrl}/?scenario=${scenario}${ownershipQuery}&ss=1&residentAuto=${residentAuto}`;

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
});
await page.goto(url, { waitUntil: 'load', timeout: 60000 });

async function readAdmissionDiagnostics() {
  return page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const authorityHost = overlay?.__sphPeerComputeResidentAuthorityHost ?? null;
    const rebuildWorker = overlay?.__sphPhaseRebuildWorker ?? null;
    const runtimeAdmission = overlay?.__sphSimulationRuntimeAdmission ?? null;
    const residentProgress = overlay?.__mlsMpmResidentStepsProgress ?? null;
    const bodyLines = document.body.innerText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /PHYSICS|sim t|resident|worker|error|blocked|pending/i.test(line))
      .slice(0, 40);
    return {
      play: (() => {
        const button = document.querySelector('#sph-play');
        return button ? { disabled: button.disabled, text: button.textContent.trim() } : null;
      })(),
      admission: overlay?.__sphWorkerOwnedResidentLaneAdmission ?? null,
      authorityHost: authorityHost ? {
        status: authorityHost.status ?? null,
        computeManagerReady: authorityHost.computeManagerReady ?? null,
        stateManagerReady: authorityHost.stateManagerReady ?? null,
        workerStatus: authorityHost.workerStatus ?? authorityHost.worker?.status ?? null,
        workerCount: authorityHost.workerCount ?? authorityHost.worker?.workerCount ?? null,
        renderOwnershipMode: authorityHost.renderOwnershipMode ?? authorityHost.renderPolicy?.mode ?? null
      } : null,
      rebuildWorker: rebuildWorker ? {
        status: rebuildWorker.status ?? null,
        generation: rebuildWorker.generation ?? null,
        backend: rebuildWorker.backend ?? null,
        elapsedMs: rebuildWorker.elapsedMs ?? rebuildWorker.timing?.elapsedMs ?? null,
        reason: rebuildWorker.reason ?? null
      } : null,
      cpuClosureTask: overlay?.__sphCpuClosureTask ?? null,
      simulationRuntimeAdmission: runtimeAdmission ? {
        status: runtimeAdmission.status ?? null,
        ready: runtimeAdmission.ready ?? null,
        reason: runtimeAdmission.reason ?? null,
        workerStatus: runtimeAdmission.workerStatus ?? runtimeAdmission.worker?.status ?? null,
        workerReady: runtimeAdmission.workerReady ?? runtimeAdmission.worker?.ready ?? null
      } : null,
      initialBodiesDraftInvalid: overlay?.__sphInitialBodiesDraftInvalid ?? null,
      residentProgress: residentProgress ? {
        status: residentProgress.status ?? null,
        completedStepCount: residentProgress.completedStepCount ?? null,
        requestedStepCount: residentProgress.requestedStepCount ?? null,
        residentComputeManagerMode: residentProgress.residentComputeManagerMode ?? null,
        workerLaneFallback: residentProgress.workerLaneFallback ?? null
      } : null,
      residentAutoSchedule: (() => {
        const autoSchedule = overlay?.__mlsMpmResidentAutoSchedule ?? null;
        const progress = autoSchedule?.progress ?? null;
        return autoSchedule ? {
          status: autoSchedule.status ?? null,
          generation: autoSchedule.generation ?? null,
          residentPolicy: autoSchedule.residentPolicy ?? null,
          progress: progress ? {
            status: progress.status ?? null,
            completedStepCount: progress.completedStepCount ?? null,
            requestedStepCount: progress.requestedStepCount ?? null,
            error: progress.error ?? progress.detail ?? null
          } : null
        } : null;
      })(),
      computeManager: overlay?.__sphResidentComputeManager ?? null,
      workerLaneLastFallback:
        overlay?.__sphScene?.scene?.userData?.sphWorkerLaneLastFallback ?? null,
      execution: (() => {
        const execution = overlay?.__mlsMpmResidentSteps ?? null;
        return execution ? {
          status: execution.status ?? null,
          residentComputeManagerMode: execution.residentComputeManagerMode ?? null,
          workerLaneFallback: execution.workerLaneFallback ?? null
        } : null;
      })(),
      bodyLines
    };
  });
}

await page.evaluate(() => {
  globalThis.__w4LongTasks = { count: 0, totalMs: 0, maxMs: 0 };
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      globalThis.__w4LongTasks.count += 1;
      globalThis.__w4LongTasks.totalMs += entry.duration;
      globalThis.__w4LongTasks.maxMs = Math.max(globalThis.__w4LongTasks.maxMs, entry.duration);
    }
  });
  observer.observe({ type: 'longtask', buffered: true });
});

const playDeadline = Date.now() + startupTimeoutMs;
let playing = false;
let lastPlayClickError = null;
while (Date.now() < playDeadline) {
  const playButton = page.locator('#sph-play');
  const st = await playButton.isVisible().catch(() => false)
    ? await playButton.evaluate((button) => ({
        disabled: button.disabled,
        text: button.textContent.trim()
      }))
    : null;
  if (residentAuto === 0 && st?.text === 'Play' && st.disabled === false) {
    // Use the browser's actual pointer path. HTMLElement.click() proved too
    // weak for this UI gate because it can race the staged-control rebuild
    // without producing the same trusted interaction sequence.
    try {
      await playButton.click({ timeout: 5000, force: true });
      lastPlayClickError = null;
    } catch (error) {
      lastPlayClickError = error instanceof Error ? error.message : String(error);
    }
  }
  if (st?.text === 'Pause') {
    playing = true;
    break;
  }
  await sleep(1000);
}
if (!playing) {
  const diagnostics = await readAdmissionDiagnostics();
  console.error(JSON.stringify({
    status: 'worker-lane-play-admission-timeout',
    diagnostics,
    lastPlayClickError,
    browserErrors
  }, null, 1));
  await browser.close();
  process.exitCode = 1;
  process.exit();
}

// settle past cold start, then measurement window
const firstTickDeadline = Date.now() + startupTimeoutMs;
let firstTickObserved = false;
while (Date.now() < firstTickDeadline) {
  const t = await page.evaluate(() => parseFloat(document.body.innerText.match(/sim t ([0-9.]+)s/)?.[1] || '0'));
  if (t > 0.01) {
    firstTickObserved = true;
    break;
  }
  await sleep(1000);
}
if (!firstTickObserved) {
  const diagnostics = await readAdmissionDiagnostics();
  console.error(JSON.stringify({ status: 'worker-lane-first-tick-timeout', diagnostics, browserErrors }, null, 1));
  await browser.close();
  process.exitCode = 1;
  process.exit();
}
await page.evaluate(() => { globalThis.__w4LongTasks = { count: 0, totalMs: 0, maxMs: 0 }; });
const t0 = await page.evaluate(() => parseFloat(document.body.innerText.match(/sim t ([0-9.]+)s/)?.[1] || '0'));
const wall0 = Date.now();
await sleep(measurementMs);

// Interaction phase: continuous pointer drag while sampling sim t.
const tPreDrag = await page.evaluate(() => parseFloat(document.body.innerText.match(/sim t ([0-9.]+)s/)?.[1] || '0'));
const dragStart = Date.now();
while (Date.now() - dragStart < dragMeasurementMs) {
  await page.mouse.move(300, 300);
  await page.mouse.down();
  for (let x = 300; x <= 420; x += 12) { await page.mouse.move(x, 300 + (x % 24)); await sleep(16); }
  await page.mouse.up();
}
const tPostDrag = await page.evaluate(() => parseFloat(document.body.innerText.match(/sim t ([0-9.]+)s/)?.[1] || '0'));

const t1 = await page.evaluate(() => parseFloat(document.body.innerText.match(/sim t ([0-9.]+)s/)?.[1] || '0'));
const wallS = (Date.now() - wall0) / 1000;
const longTasks = await page.evaluate(() => globalThis.__w4LongTasks);
// Route detection reads the REAL published seals: the execution envelope the
// page publishes on the overlay element (residentComputeManagerMode,
// workerOwnedResidentLane, workerLaneFallback) plus the mount's lane
// admission record.
const routeMode = await page.evaluate(() => {
  const overlay = document.querySelector('#sph-phase-overlay');
  const execution = overlay?.__mlsMpmResidentSteps || null;
  const lane = execution?.workerOwnedResidentLane || null;
  return {
    residentComputeManagerMode: execution?.residentComputeManagerMode ?? null,
    workerLaneFallback: execution?.workerLaneFallback ?? null,
    laneAdmission: overlay?.__sphWorkerOwnedResidentLaneAdmission ?? null,
    computeManagerStatus: overlay?.__sphResidentComputeManager?.status ?? null,
    lane: lane
      ? {
          laneId: lane.laneId,
          scheduleId: lane.scheduleId,
          completedStepCount: lane.completedStepCount,
          requestedStepCount: lane.requestedStepCount,
          cancelled: lane.cancelled,
          finalEpochIdentity: lane.finalEpochIdentity,
          retainedBufferRefCount: lane.retainedBufferRefs?.length ?? 0,
          authority: lane.authority ?? null
        }
      : null,
    workerLaneSimTime: execution?.workerLaneSimTime ?? null,
    executionStatus: execution?.status ?? null,
    completedStepCount: execution?.completedStepCount ?? null
  };
});

const receipt = {
  mode, ownership, scenario,
  simAdvanceS: Number((t1 - t0).toFixed(4)),
  wallS: Number(wallS.toFixed(1)),
  stepsPerWallSecondProxy: Number(((t1 - t0) / wallS).toFixed(5)),
  dragWindow: { simAdvanceDuringDragS: Number((tPostDrag - tPreDrag).toFixed(4)) },
  mainThreadLongTasks: longTasks,
  route: routeMode,
  browserErrors
};
console.log(JSON.stringify(receipt, null, 1));

assert.ok(receipt.simAdvanceS > 0, 'simulation must advance during the measurement window');
assert.ok(
  receipt.dragWindow.simAdvanceDuringDragS > 0,
  'simulation must advance while pointer interaction occupies the page'
);
if (mode === 'worker-owned' || mode === 'default') {
  assert.equal(
    routeMode.residentComputeManagerMode,
    'worker-owned-resident-lane',
    'worker-owned run must seal the worker resident lane route'
  );
  assert.equal(routeMode.workerLaneFallback, null, 'worker-owned run must not fall back');
  assert.equal(
    routeMode.lane?.authority?.computeManagerLeaseStatus,
    'completed',
    'ComputeManager must publish a completed worker lane lease'
  );
  assert.equal(
    routeMode.lane?.authority?.computeManagerFenceSatisfied,
    true,
    'ComputeManager must publish a satisfied worker lane fence'
  );
  assert.equal(
    routeMode.lane?.authority?.stateManagerCommitStatus,
    'committed',
    'StateManager must publish the admitted worker lane delta'
  );
  assert.ok(routeMode.lane, 'worker-owned run must publish a terminal lane receipt');
  assert.equal(routeMode.lane.cancelled, false, 'worker-owned lane must complete without cancellation');
  assert.equal(
    routeMode.lane.completedStepCount,
    routeMode.lane.requestedStepCount,
    'worker-owned lane must complete every requested resident step'
  );
  assert.ok(
    routeMode.lane.retainedBufferRefCount > 0,
    'worker-owned lane must retain GPU-resident output refs for presentation'
  );
}
await browser.close();
