import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const outDir = process.env.ULG_OUT || '/home/cos/.claude/jobs/9d60386a/tmp/hash-degrade';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 560 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e?.message || e).slice(0, 200)));
const waitReady = async () => page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 240000 });
const hashState = async () => page.evaluate(() => {
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const pick = (k) => h.get(k);
  return {
    scenario: pick('scenario'),
    workerLivePreview: pick('workerLivePreview'),
    compactMechanicsView: pick('compactMechanicsView'),
    submitBurstSteps: pick('submitBurstSteps'),
    ambientPressurePa: pick('ambientPressurePa'),
    contactSolver: pick('contactSolver'),
    basen: pick('basen'),
  };
});
const laneState = async () => page.evaluate(() => {
  const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  const hud = document.querySelector('#sph-hud')?.textContent || '';
  return { committed: lane?.laneCompletedStepTotal ?? 0, hud: hud.slice(0, 120) };
});

await page.goto(`https://localhost:5173/?scenario=bulk-water&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await waitReady();
const afterFirstSync = await hashState();

// Reproduce the user's edit: basen 32 -> 16 through the legacy control.
await page.evaluate(() => {
  const el = document.querySelectorAll('#sph-counts input')[1];
  if (!el) throw new Error('basen control not found under #sph-counts');
  el.value = '16';
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(500);
const afterEdit = await hashState();

await page.reload({ waitUntil: 'load', timeout: 30000 });
await waitReady();
const afterReload = await hashState();
const t0 = await laneState();
await page.screenshot({ path: `${outDir}/reload-a.png` });
await page.waitForTimeout(4000);
const t1 = await laneState();
await page.screenshot({ path: `${outDir}/reload-b.png` });

await browser.close();
console.log(JSON.stringify({ afterFirstSync, afterEdit, afterReload, t0, t1, errors: errors.slice(0, 5) }, null, 1));
