// Memory soak: run the live route with no in-page instrumentation and let an
// external sampler read process RSS. Presses Play once, then idles.
//   node scripts/a1-memory-soak.mjs <durationMs> [scenario] [extraQuery]
import { chromium } from '@playwright/test';
const durationMs = Number(process.argv[2] || 300000);
const scenario = process.argv[3] || 'iron-ice-quench';
const extra = process.argv[4] || '';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: process.env.A1_HEADLESS !== '0' && process.env.ULG_HEADED !== '1',
  args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(`https://127.0.0.1:5173/pages.html?scenario=${scenario}&residentAuto=1${extra}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const t0 = Date.now();
  let played = false;
  while (Date.now() - t0 < durationMs) {
    await page.waitForTimeout(5000);
    if (!played) {
      const row = await page.evaluate(() => ({ play: document.querySelector('#sph-play')?.textContent,
        rebuild: document.querySelector('#sph-phase-overlay')?.__sphPhaseRebuildWorker?.status }));
      if (row.rebuild === 'complete' && row.play === 'Play') { await page.locator('#sph-play').click().catch(() => {}); played = true; }
    }
  }
  console.log(JSON.stringify(await page.evaluate(() => ({ fps: document.querySelector('#sph-fps')?.textContent }))));
} finally { await browser.close(); }
