import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const outDir = process.env.ULG_DAM_OUT || '/tmp/ulg-dam-break';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1200, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e?.message || e).slice(0, 200)));
await page.goto(`https://localhost:5173/?scenario=${process.env.ULG_DAM_SCENARIO || 'bulk-water'}${process.env.ULG_DAM_EXTRA || ''}&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 240000 });
const simT = async () => page.evaluate(() => {
  const hud = document.querySelector('#sph-hud')?.textContent || '';
  const m = hud.match(/sim t ([0-9.]+)s/);
  const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  return { simT: m ? Number(m[1]) : null, committed: lane?.laneCompletedStepTotal ?? 0, hud: hud.slice(0, 160) };
});
const shots = [];
const intervalMs = Number(process.env.ULG_DAM_INTERVAL_MS || 20000);
const count = Number(process.env.ULG_DAM_SHOTS || 4);
for (let i = 0; i < count; i += 1) {
  if (i > 0) await page.waitForTimeout(intervalMs);
  const t = await simT();
  const path = `${outDir}/shot-${i}.png`;
  await page.screenshot({ path });
  shots.push({ index: i, ...t, path });
}
await browser.close();
console.log(JSON.stringify({ shots, errors: errors.slice(0, 5) }, null, 1));
