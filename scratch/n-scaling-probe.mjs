import { chromium } from '@playwright/test';
const extra = process.env.ULG_PROBE_EXTRA || '';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
await page.goto(`https://localhost:5173/?scenario=sodium-water${extra}&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => { const b = document.querySelector('#sph-play'); return b && !b.disabled; }, null, { timeout: 240000 });
const t0 = Date.now();
let prev = null; const commits = [];
while (Date.now() - t0 < Number(process.env.ULG_PROBE_WINDOW_MS || 90000)) {
  const c = await page.evaluate(() => {
    const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
    return { committed: lane?.laneCompletedStepTotal ?? 0, n: lane?.perStepSummaries?.lastStep?.particleCount ?? null };
  });
  if (c.committed !== prev) { commits.push({ t: Date.now() - t0, ...c }); prev = c.committed; }
  await page.waitForTimeout(400);
}
await browser.close();
console.log(JSON.stringify(commits));
