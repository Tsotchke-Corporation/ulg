import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
const diag = [];
page.on('console', (m) => { const t = m.text(); if (t.includes('ulg-live-bound') || t.includes('ulg-merge-diag')) diag.push(t.slice(0, 300)); });
await page.goto(`https://localhost:5173/?scenario=sodium-water&contactInnerRounds=2&probeEpoch=${Date.now()}${process.env.ULG_PROBE_EXTRA || ''}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => { const b = document.querySelector('#sph-play'); return b && !b.disabled; }, null, { timeout: 180000 });
const t0 = Date.now();
let prev = null; const commits = [];
while (Date.now() - t0 < Number(process.env.ULG_PROBE_WINDOW_MS || 60000)) {
  const c = await page.evaluate(() => document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane?.laneCompletedStepTotal ?? 0);
  if (c !== prev) { commits.push({ t: Date.now() - t0, c }); prev = c; }
  await page.waitForTimeout(300);
}
await browser.close();
console.log(JSON.stringify({ commits, diag }, null, 1));
