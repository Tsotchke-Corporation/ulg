import { chromium } from '/home/cos/projects/ulg/node_modules/playwright/index.mjs';
const drop = process.argv[2] || 'Na';
const base = process.argv[3] || 'h2o';
const tag = process.argv[4] || 'na-h2o';
const url = `http://127.0.0.1:5186/?drop=${drop}&base=${base}&dropt=300&baset=293&iceh=0&ironh=1.01&dropn=2&basen=4&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=1&residentFuseSequence=1&visualCapture=1&surfaceDraw=native-webgpu-surface-consumer`;
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--ignore-certificate-errors'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 800 } });
await page.goto(url);
await page.waitForTimeout(2000);
if (await page.locator('#sph-phase-overlay').count() === 0) await page.locator('#run-sph-phase').click().catch(() => {});
await page.waitForSelector('#sph-phase-overlay', { timeout: 240000 });
for (const [i, waitMs] of [[1, 12000], [2, 12000], [3, 15000]]) {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `/tmp/fork-placement/${tag}-${i}.png` });
}
await browser.close();
console.log('shots done');
