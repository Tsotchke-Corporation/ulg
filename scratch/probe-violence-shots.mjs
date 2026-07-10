// Visual timeline screenshots for the violence-calibration scenes.
import { chromium } from '/home/cos/projects/ulg/node_modules/playwright/index.mjs';
const DROP = process.env.DROP ?? 'Na';
const BASE = process.env.BASE ?? 'h2o';
const TAG = process.env.TAG ?? 'na';
const PORT = process.env.PORT ?? '5187';
const url = `http://127.0.0.1:${PORT}/?drop=${DROP}&base=${BASE}&dropt=${process.env.DROPT ?? '300'}&baset=${process.env.BASET ?? '293'}&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=1&residentFuseSequence=1&visualCapture=1&surfaceDraw=native-webgpu-surface-consumer`;
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--ignore-certificate-errors'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 800 } });
await page.goto(url);
await page.waitForTimeout(2000);
if (await page.locator('#sph-phase-overlay').count() === 0) await page.locator('#run-sph-phase').click().catch(() => {});
await page.waitForSelector('#sph-phase-overlay', { timeout: 300000 });
for (const [i, waitMs] of [[1, 4000], [2, 8000], [3, 12000], [4, 16000]]) {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `/tmp/fork12-shots/${TAG}-${i}.png` });
}
await browser.close();
