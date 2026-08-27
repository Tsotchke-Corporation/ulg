import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
const diag = [];
page.on('console', (m) => { const t = m.text(); if (t.includes('ulg-fence-diag')) diag.push(t); });
await page.goto(`https://localhost:5173/?scenario=sodium-water&contactCleanupPasses=16&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => { const b = document.querySelector('#sph-play'); return b && !b.disabled; }, null, { timeout: 180000 });
const t0 = Date.now();
let prev = null; const commits = [];
while (Date.now() - t0 < 45000) {
  const snap = await page.evaluate(() => {
    const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
    return { committed: lane?.laneCompletedStepTotal ?? 0,
      lastEnd: lane?.scheduleLastStepEndedAtMs ?? null, fenceDone: lane?.tailTerminalFenceDoneAtMs ?? null };
  });
  if (snap.committed !== prev) { commits.push({ t: Date.now() - t0, ...snap }); prev = snap.committed; }
  await page.waitForTimeout(300);
}
await browser.close();
console.log(JSON.stringify({ commits, diag: diag.slice(0, 12) }, null, 1));
