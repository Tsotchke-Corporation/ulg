import { chromium } from '@playwright/test';

const preset = process.argv[2] || 'sodium-water';
const outDir = process.env.ULG_SHOT_DIR || '/tmp/ulg-animate-check';
import { mkdirSync } from 'node:fs';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e?.message || e).slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[err] ${m.text().slice(0, 400)}`); });
await page.goto(`https://localhost:5173/?scenario=${preset}&probeEpoch=${Date.now()}${process.env.ULG_PROBE_EXTRA || ''}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 180000 });

const snap = async (name) => {
  const state = await page.evaluate(() => {
    const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
    return { steps: lane?.laneCompletedStepTotal ?? 0 };
  });
  await page.screenshot({ path: `${outDir}/${name}.png` });
  return state;
};

const a = await snap('t0');
await page.waitForTimeout(12000);
const b = await snap('t1');
await page.waitForTimeout(12000);
const c = await snap('t2');
await browser.close();
console.log(JSON.stringify({ steps: [a.steps, b.steps, c.steps], errors: errors.slice(0, 5), outDir }));
