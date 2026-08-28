import { chromium } from '@playwright/test';
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
await page.evaluate(() => {
  const el = document.querySelectorAll('#sph-counts input')[1];
  el.value = '16';
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('#sph-play')?.click());
const timeline = await page.evaluate(async () => {
  const events = [];
  let last = '';
  const t0 = performance.now();
  while (performance.now() - t0 < 90000 && events.length < 120) {
    const overlay = document.querySelector('#sph-phase-overlay');
    const s = overlay?.__sphScene?.getWorkerOffscreenPresentation?.() || null;
    const sig = s ? `${s.status}|${s.reason}|committed=${s.stateManagerCommittedPresentation ?? '-'}|cand=${s.residentScheduleCandidatePresentation ?? '-'}|sphStep=${s.sphStep ?? '-'}|lane=${s.laneId ?? '-'}` : 'null';
    if (sig !== last) {
      last = sig;
      events.push(`${Math.round(performance.now() - t0)}ms ${sig}`);
    }
    await new Promise((r) => setTimeout(r, 30));
  }
  return events;
});
await browser.close();
console.log(timeline.join('\n'));
