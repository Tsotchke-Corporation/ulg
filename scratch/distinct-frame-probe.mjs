import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: Number(process.env.ULG_W || 900), height: Number(process.env.ULG_H || 560) } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e?.message || e).slice(0, 200)));
const url = process.env.ULG_URL || `https://localhost:5173/?scenario=bulk-water&probeEpoch=${Date.now()}`;
await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 240000 });
// Start the sim if it isn't already running.
const playState = await page.evaluate(() => {
  const b = document.querySelector('#sph-play');
  const label = b?.textContent || '';
  if (label.trim().toLowerCase() === 'play') { b.click(); return 'clicked-play'; }
  return `already:${label.trim()}`;
});
// Let it warm up past seed/first schedule.
await page.waitForTimeout(6000);
const lane = () => page.evaluate(() => {
  const l = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  const hud = document.querySelector('#sph-hud')?.textContent || '';
  const fps = document.querySelector('#sph-fps')?.textContent || '';
  return { committed: l?.laneCompletedStepTotal ?? null, hud: hud.slice(0, 140), fps: fps.slice(0, 100) };
});
const before = await lane();
const startMs = Date.now();
const hashes = [];
const SHOTS = Number(process.env.ULG_SHOTS || 32);
const GAP = Number(process.env.ULG_GAP_MS || 250);
for (let i = 0; i < SHOTS; i += 1) {
  const buf = await page.screenshot();
  hashes.push(createHash('sha256').update(buf).digest('hex').slice(0, 12));
  const elapsed = Date.now() - startMs;
  const target = (i + 1) * GAP;
  if (target > elapsed) await page.waitForTimeout(target - elapsed);
}
const wallS = (Date.now() - startMs) / 1000;
const after = await lane();
const owner = await page.evaluate(() => {
  const overlay = document.querySelector('#sph-phase-overlay');
  const p = overlay?.__sphScene?.getWorkerOffscreenPresentation?.() || null;
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return {
    displayOwner: p?.displayOwner ?? null,
    displayOwnerContentReady: p?.displayOwnerContentReady ?? null,
    status: p?.status ?? null,
    hashWorkerLivePreview: h.get('workerLivePreview'),
    hashCompactMechanicsView: h.get('compactMechanicsView'),
    hashScenario: h.get('scenario'),
  };
});
await browser.close();
let transitions = 0;
for (let i = 1; i < hashes.length; i += 1) if (hashes[i] !== hashes[i - 1]) transitions += 1;
const distinct = new Set(hashes).size;
console.log(JSON.stringify({
  url: url.replace(/probeEpoch=\d+/, 'probeEpoch=X'), playState, wallS: Number(wallS.toFixed(2)),
  shots: SHOTS, gapMs: GAP, distinctImages: distinct, transitions,
  observedDistinctFps: Number((transitions / wallS).toFixed(2)),
  committedBefore: before.committed, committedAfter: after.committed,
  committedStepsPerS: before.committed != null && after.committed != null ? Number(((after.committed - before.committed) / wallS).toFixed(1)) : null,
  hudBefore: before.hud, hudAfter: after.hud, fpsEl: after.fps, owner,
  errors: errors.slice(0, 5),
}, null, 1));
