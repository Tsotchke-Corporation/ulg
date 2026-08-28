import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1200, height: 700 } });
await page.goto(`https://localhost:5173/?scenario=${process.env.ULG_SHOT_SCENARIO || 'bulk-water'}${process.env.ULG_SHOT_EXTRA || ''}&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => (
  (document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane?.laneCompletedStepTotal ?? 0) > 192
), null, { timeout: 240000 });
const dump = await page.evaluate(() => {
  const overlay = document.querySelector('#sph-phase-overlay');
  const p = overlay.__sphWorkerLaneNativeSurfacePresentation ?? null;
  const rs = overlay.__sphResidentRenderState ?? null;
  const lane = overlay.__mlsMpmResidentSteps?.workerOwnedResidentLane ?? null;
  return {
    presentationRecord: p,
    laneScheduleId: lane?.scheduleId ?? null,
    laneSphStep: lane?.committedPresentation?.sphStep ?? null,
    laneSimTimeS: lane?.laneSimTimeS ?? null,
    renderStateStatus: rs?.status ?? null,
    renderStateError: overlay.__sphResidentRenderStateError ?? null,
    sourceResidentRenderSourceStatus: rs?.sourceResidentRenderSourceStatus ?? null,
    surfaceDrawOverlayPolicyStatus: rs?.surfaceDrawOverlayPolicyStatus ?? null,
    workerOffscreenPresentationStatus: rs?.workerOffscreenPresentationStatus ?? null,
    compactSnapshotStatus: rs?.workerOffscreenRetainedCompactSnapshotStatus ?? null,
    compactSnapshotAvailable: rs?.workerOffscreenRetainedCompactSnapshotAvailable ?? null,
    compactSnapshotStep: rs?.workerOffscreenRetainedCompactSnapshotStep ?? null,
    renderSourceNextStep: rs?.residentRenderSource?.nextStep ?? null,
    renderSourceGenMatch: rs?.residentRenderSource?.residentExecutionGenerationMatchesCurrent ?? null
  };
});
await browser.close();
console.log(JSON.stringify(dump, null, 1));
