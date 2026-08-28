import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1200, height: 700 } });
await page.goto(`https://localhost:5173/?scenario=${process.env.ULG_SHOT_SCENARIO || 'bulk-water'}${process.env.ULG_SHOT_EXTRA || ''}&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => {
  const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  return (lane?.laneCompletedStepTotal ?? 0) > 128;
}, null, { timeout: 240000 });
const dump = await page.evaluate(() => {
  const steps = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps;
  const lane = steps?.workerOwnedResidentLane ?? null;
  const p = lane?.committedPresentation ?? null;
  return {
    residentComputeManagerMode: steps?.residentComputeManagerMode ?? null,
    workerLaneFallback: steps?.workerLaneFallback ?? null,
    laneStatus: lane?.residentScheduleStatus ?? null,
    cancelled: lane?.cancelled ?? null,
    completedStepCount: lane?.completedStepCount ?? null,
    finalEpochIdentity: lane?.finalEpochIdentity ?? null,
    retainedBufferRefsLength: lane?.retainedBufferRefs?.length ?? null,
    committedPresentation: p,
    scheduleId: lane?.scheduleId ?? null,
    laneId: lane?.laneId ?? null,
    stateKey: lane?.stateKey ?? null,
    presentationBanner: document.querySelector('#sph-warning-banner')?.textContent?.slice(0, 200) ?? null
  };
});
await browser.close();
console.log(JSON.stringify(dump, null, 1));
