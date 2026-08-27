import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto(`https://localhost:5173/?scenario=sodium-water&residentStepsPerSchedule=256&residentStepsPerScheduleMax=256&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => { const b = document.querySelector('#sph-play'); return b && !b.disabled; }, null, { timeout: 180000 });
await page.waitForTimeout(12000);
const info = await page.evaluate(() => {
  const o = document.querySelector('#sph-phase-overlay');
  const scenePolicy = o?.__sphPeerComputeRenderOwnershipPolicy || null;
  const sceneUserData = o?.__mlsMpmResidentSteps?.workerOwnedResidentLane ? 'lane-present' : 'no-lane';
  return {
    evidence: o?.__sphResidentScheduleControlEvidence ?? null,
    overlayPolicyOverride: scenePolicy?.residentStepsPerScheduleOverride ?? null,
    overlayPolicyMax: scenePolicy?.residentStepsPerScheduleMax ?? null,
    lane: sceneUserData,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
