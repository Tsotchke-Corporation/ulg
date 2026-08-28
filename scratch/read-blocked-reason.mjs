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
const hits = await page.evaluate(async () => {
  const seen = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 90000 && seen.length < 4) {
    const s = document.querySelector('#sph-phase-overlay')?.__sphScene?.getWorkerOffscreenPresentation?.() || null;
    if (s && /committed-resident-schedule-presentation-blocked|presentation-blocked/.test(String(s.status))) {
      const key = `${s.scheduleId}|${s.reason}`;
      if (!seen.some((x) => x.key === key)) {
        seen.push({ key, status: s.status, reason: s.reason, scheduleId: s.scheduleId ?? null, laneId: s.laneId ?? null, sphStep: s.sphStep ?? null, stepOrdinal: s.stepOrdinal ?? null });
      }
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  return seen;
});
await browser.close();
console.log(JSON.stringify(hits, null, 1));
