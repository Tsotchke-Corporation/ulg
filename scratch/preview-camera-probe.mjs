import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
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
await page.waitForTimeout(3000);
const clip = { x: 0, y: 90, width: 900, height: 400 };
const shot = async (p) => page.screenshot({ path: p || undefined, clip });
await shot('/tmp/claude-1000/-home-cos-projects-ulg/9d60386a-809e-4710-aa35-92b37707f771/scratchpad/ghost-check.png');
// Pause so only camera motion can change the fluid region.
await page.evaluate(() => document.querySelector('#sph-play')?.click());
await page.waitForTimeout(1200);
const hash = (b) => createHash('sha256').update(b).digest('hex').slice(0, 10);
const baseline = hash(await shot());
const hashes = [baseline];
await page.mouse.move(450, 300);
await page.mouse.down();
for (let i = 1; i <= 10; i += 1) {
  await page.mouse.move(450 + i * 22, 300 + i * 8);
  await page.waitForTimeout(80);
  hashes.push(hash(await shot()));
}
await page.mouse.up();
await page.waitForTimeout(300);
hashes.push(hash(await shot()));
let transitions = 0;
for (let i = 1; i < hashes.length; i += 1) if (hashes[i] !== hashes[i - 1]) transitions += 1;
const owner = await page.evaluate(() => {
  const p = document.querySelector('#sph-phase-overlay')?.__sphScene?.getWorkerOffscreenPresentation?.() || null;
  return { displayOwner: p?.displayOwner, displayCanvasVisible: p?.displayCanvasVisible, contentReady: p?.displayOwnerContentReady };
});
await browser.close();
console.log(JSON.stringify({ dragSamples: hashes.length - 2, dragTransitions: transitions, owner }, null, 1));
