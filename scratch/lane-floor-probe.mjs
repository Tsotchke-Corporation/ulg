import { chromium } from '@playwright/test';

const query = process.env.ULG_QUERY ?? 'ss=1';
const waitS = Number(process.env.ULG_WAIT_S ?? 75);
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
const url = `https://localhost:5173/?${query}&probeEpoch=${Date.now()}`;
await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 180000 });

const laneSnap = () => page.evaluate(() => {
  const o = document.querySelector('#sph-phase-overlay');
  const lane = o?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  return {
    steps: lane?.laneCompletedStepTotal ?? 0,
    simTimeS: lane?.laneSimTimeS ?? 0,
    laneExists: Boolean(lane),
    playText: document.querySelector('#sph-play')?.textContent.trim() ?? null,
  };
});

let s0 = await laneSnap();
// If nothing advances in 10 s and lane is absent or idle, press play once.
await page.waitForTimeout(10000);
let s1 = await laneSnap();
let clickedPlay = false;
if (s1.steps === s0.steps) {
  await page.click('#sph-play').catch(() => {});
  clickedPlay = true;
  await page.waitForTimeout(3000);
  s0 = await laneSnap();
} else {
  s0 = s1;
}
const t0 = Date.now();
await page.waitForTimeout(waitS * 1000);
const out = await page.evaluate(() => {
  const o = document.querySelector('#sph-phase-overlay');
  const env = o?.__mlsMpmResidentSteps;
  const lane = env?.workerOwnedResidentLane;
  const perStep = lane?.perStepSummaries;
  const last = perStep?.lastStep;
  const hier = lane?.hierarchyStageSummary;
  const perf = o?.__sphResidentPerf;
  const pick = (obj, re) => {
    if (!obj || typeof obj !== 'object') return null;
    const outp = {};
    for (const k of Object.keys(obj)) {
      if (re.test(k)) {
        const v = obj[k];
        outp[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? v : v;
      }
    }
    return Object.keys(outp).length ? outp : null;
  };
  return {
    laneExists: Boolean(lane),
    laneStepTotal: lane?.laneCompletedStepTotal ?? null,
    laneSimTimeS: lane?.laneSimTimeS ?? null,
    scheduleId: lane?.scheduleId ?? null,
    particleCount: last?.particleCount ?? null,
    lastStepTimings: last ? {
      stepOrdinal: last.stepOrdinal,
      epochStageElapsedMs: last.epochStageElapsedMs,
      mechanicsStageElapsedMs: last.mechanicsStageElapsedMs,
      stepElapsedMs: last.stepElapsedMs,
    } : null,
    stageMsRanked: hier?.residentStageTiming?.stageMs
      ? Object.entries(hier.residentStageTiming.stageMs).sort((a, b) => b[1] - a[1]).slice(0, 14)
      : null,
    residentStageTimingKeys: hier?.residentStageTiming ? Object.keys(hier.residentStageTiming) : null,
    lastStepSchroederKeys: last ? Object.keys(last).filter((k) => /schroeder|law|traversal|neighbor|contact|fallback/i.test(k)) : null,
    traversalFromLastStep: pick(last, /traversal|lawNeighbor|lawQueue/i),
    contactFromLastStep: pick(last, /contact/i),
    workerLaneLastFallback: o?.__sphScene?.userData?.sphWorkerLaneLastFallback ?? null,
    perf: perf ? {
      lastResidentMs: perf.lastResidentMs,
      completionStepsPerSecond: perf.completionStepsPerSecond ?? perf.residentCompletionStepsPerSecond,
      ewma: perf.completionStepsPerSecondEwma ?? perf.residentCompletionStepsPerSecondEwma,
    } : null,
    residentStatusPolicy: (() => {
      const st = o?.__sphResidentExecutionPolicy ?? o?.__sphResidentStatus ?? null;
      return st ? pick(st, /schroederLaw|residentComputeManagerMode|ActiveNodeIndex|SortedIndex/i) : null;
    })(),
    envKeys: env ? Object.keys(env) : null,
    overlayKeys: o ? Object.keys(o).filter((k) => k.startsWith('__')).slice(0, 60) : null,
  };
});
const wallS = (Date.now() - t0) / 1000;
console.log(JSON.stringify({
  query,
  clickedPlay,
  wallS,
  stepsCompleted: (out.laneStepTotal ?? 0) - s0.steps,
  stepsPerSecond: ((out.laneStepTotal ?? 0) - s0.steps) / wallS,
  msPerStep: wallS * 1000 / Math.max(1, (out.laneStepTotal ?? 0) - s0.steps),
  simSecondsPerWallSecond: ((out.laneSimTimeS ?? 0) - s0.simTimeS) / wallS,
  ...out,
}, null, 1));
await browser.close();
