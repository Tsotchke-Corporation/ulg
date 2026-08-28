import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const outDir = '/tmp/ulg-animate-check';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
await page.goto(`https://localhost:5173/?scenario=${process.env.ULG_SHOT_SCENARIO || 'sodium-water'}${process.env.ULG_SHOT_EXTRA || ''}&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 180000 });
// wait for the first live commit
await page.waitForFunction(() => (
  (document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane?.laneCompletedStepTotal ?? 0) > 0
), null, { timeout: 120000 });
const steps1 = await page.evaluate(() => document.querySelector('#sph-phase-overlay').__mlsMpmResidentSteps.workerOwnedResidentLane.laneCompletedStepTotal);
await page.screenshot({ path: `${outDir}/live-a.png` });
await page.waitForTimeout(20000);
const steps2 = await page.evaluate(() => document.querySelector('#sph-phase-overlay').__mlsMpmResidentSteps.workerOwnedResidentLane.laneCompletedStepTotal);
await page.screenshot({ path: `${outDir}/live-b.png` });
await browser.close();
console.log(JSON.stringify({ stepsA: steps1, stepsB: steps2 }));
