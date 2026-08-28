import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 560 } });
const consoleTail = [];
page.on('console', (msg) => {
  consoleTail.push(`${msg.type()}: ${msg.text().slice(0, 180)}`);
  if (consoleTail.length > 60) consoleTail.shift();
});
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e?.message || e).slice(0, 250)));
const url = `${process.env.ULG_SCEN_URL || 'https://localhost:5173/?scenario=bulk-water'}&probeEpoch=${Date.now()}`;
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
const snap = async () => page.evaluate(() => ({
  atS: Math.round(performance.now() / 1000),
  status: (document.querySelector('#sph-status')?.textContent || '').slice(0, 220),
  playDisabled: document.querySelector('#sph-play')?.disabled ?? 'no-button',
  fps: (document.querySelector('#sph-fps')?.textContent || '').slice(0, 140),
  gpu: Boolean(navigator.gpu),
}));
const trace = [];
for (let i = 0; i < 6; i += 1) {
  await page.waitForTimeout(10000);
  trace.push(await snap());
  const last = trace[trace.length - 1];
  if (last.playDisabled === false) break;
}
await browser.close();
console.log(JSON.stringify({ url: url.replace(/probeEpoch=\d+/, 'pe=X'), trace, pageErrors: pageErrors.slice(0, 8), consoleTail: consoleTail.slice(-25) }, null, 1));
