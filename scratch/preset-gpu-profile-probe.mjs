import { chromium } from '@playwright/test';

const preset = process.argv[2] || 'sodium-water';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
await page.goto(`https://localhost:5173/?scenario=${preset}&residentGpuTimestampProfile=1&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 180000 });
const t0 = Date.now();
const s0 = await page.evaluate(() => {
  const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  return { steps: lane?.laneCompletedStepTotal ?? 0, simTimeS: lane?.laneSimTimeS ?? 0 };
});
await page.waitForTimeout(90000);
const out = await page.evaluate(() => {
  const o = document.querySelector('#sph-phase-overlay');
  const env = o?.__mlsMpmResidentSteps;
  const lane = env?.workerOwnedResidentLane;
  const perStep = lane?.perStepSummaries;
  const last = perStep?.lastStep;
  const hier = lane?.hierarchyStageSummary;
  const perf = o?.__sphResidentPerf;
  const ctrl = o?.__sphResidentScheduleControlEvidence;
  const sched = lane?.scheduleResult ?? lane;
  return {
    laneStepTotal: lane?.laneCompletedStepTotal ?? null,
    laneSimTimeS: lane?.laneSimTimeS ?? null,
    scheduleId: lane?.scheduleId ?? null,
    scheduleControl: ctrl ? { requested: ctrl.requestedStepCount ?? ctrl.requested, effective: ctrl.effectiveStepCount ?? ctrl.effective, policyMax: ctrl.policyMaxStepCount ?? ctrl.policyMax } : null,
    lastStepTimings: last ? {
      stepOrdinal: last.stepOrdinal,
      epochStageElapsedMs: last.epochStageElapsedMs,
      mechanicsStageElapsedMs: last.mechanicsStageElapsedMs,
      stepElapsedMs: last.stepElapsedMs,
    } : null,
    ringSample: Array.isArray(perStep?.ring) ? perStep.ring.slice(-4) : null,
    droppedStepCount: perStep?.droppedStepCount ?? null,
    residentStageTiming: hier?.residentStageTiming ?? null,
    queueDrainCheckpoints: (lane?.queueDrainCheckpoints || []).map((c) => ({ stepOrdinal: c.stepOrdinal, elapsedMs: c.elapsedMs })),
    perf: perf ? {
      lastResidentMs: perf.lastResidentMs,
      lastResidentCycleMs: perf.lastResidentCycleMs,
      lastResidentPostComputeMs: perf.lastResidentPostComputeMs,
      completionStepsPerSecond: perf.completionStepsPerSecond ?? perf.residentCompletionStepsPerSecond,
      ewma: perf.completionStepsPerSecondEwma ?? perf.residentCompletionStepsPerSecondEwma,
    } : null,
    gpuProfile: o?.__sphResidentPerf?.lastResidentStageTiming ?? hier?.residentStageTiming ?? null,
    queueStageGpuMs: hier?.residentStageTiming?.queueStageGpuMs ?? null,
    stageGpuMs: hier?.residentStageTiming?.stageGpuMs ?? null,
    stageTimingKeys: hier?.residentStageTiming?.stageMs ? Object.entries(hier.residentStageTiming.stageMs).sort((a, b) => b[1] - a[1]).slice(0, 12) : null,
  };
});
const s1 = { steps: out.laneStepTotal ?? 0, simTimeS: out.laneSimTimeS ?? 0 };
const wallS = (Date.now() - t0) / 1000;
console.log(JSON.stringify({
  preset,
  wallS,
  stepsCompleted: s1.steps - s0.steps,
  stepsPerSecond: (s1.steps - s0.steps) / wallS,
  simSecondsPerWallSecond: (s1.simTimeS - s0.simTimeS) / wallS,
  ...out,
}, null, 1));
await browser.close();
