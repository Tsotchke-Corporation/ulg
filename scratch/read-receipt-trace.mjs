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
const preEdit = await page.evaluate(() => (globalThis.__ulgCommittedPresentationReceiptTrace || []).slice());
await page.evaluate(() => {
  const el = document.querySelectorAll('#sph-counts input')[1];
  el.value = '16';
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('#sph-play')?.click());
await page.waitForTimeout(60000);
const postRebuild = await page.evaluate(() => (globalThis.__ulgCommittedPresentationReceiptTrace || []).slice());
await browser.close();
console.log(JSON.stringify({ preEdit, postRebuild: postRebuild.slice(preEdit.length) }, null, 1));
