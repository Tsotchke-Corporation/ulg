import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 560 } });
await page.goto(`https://localhost:5173/?scenario=bulk-water&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 240000 });
await page.waitForFunction(() => /completion=\d/.test(document.querySelector('#sph-fps')?.textContent || ''), null, { timeout: 120000 });
await page.evaluate(() => {
  const el = document.querySelectorAll('#sph-counts input')[1];
  el.value = '16';
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('#sph-play')?.click());
// Wait until the rebuilt lane has committed at least two schedules, then read the envelope.
await page.waitForTimeout(55000);
const out = await page.evaluate(() => {
  const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  return {
    scheduleId: lane?.scheduleId ?? null,
    committedPresentation: lane?.committedPresentation ? JSON.parse(JSON.stringify(lane.committedPresentation)) : null,
  };
});
await browser.close();
console.log(JSON.stringify(out, null, 1));
