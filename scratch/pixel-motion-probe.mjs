import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const outDir = process.env.ULG_PIX_OUT || '/tmp/ulg-pixel-motion';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1200, height: 700 } });
await page.goto(`https://localhost:5173/?scenario=${process.env.ULG_PIX_SCENARIO || 'bulk-water'}${process.env.ULG_PIX_EXTRA || ''}&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => (
  (document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane?.laneCompletedStepTotal ?? 0) > 64
), null, { timeout: 240000 });
const simT = () => page.evaluate(() => {
  const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  return lane?.laneCompletedStepTotal ?? 0;
});
const a = await page.screenshot({ path: `${outDir}/a.png` });
const stepsA = await simT();
await page.waitForTimeout(Number(process.env.ULG_PIX_WAIT_MS || 120000));
const b = await page.screenshot({ path: `${outDir}/b.png` });
const stepsB = await simT();
// crude pixel diff
const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
let diffRatio = null;
if (PNG) {
  const pa = PNG.sync.read(a); const pb = PNG.sync.read(b);
  let diff = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    if (Math.abs(pa.data[i] - pb.data[i]) > 8 || Math.abs(pa.data[i+1] - pb.data[i+1]) > 8) diff += 1;
  }
  diffRatio = diff / (pa.data.length / 4);
}
await browser.close();
console.log(JSON.stringify({ stepsA, stepsB, simSecondsSpanned: (stepsB - stepsA) / 1000, diffRatio }));
