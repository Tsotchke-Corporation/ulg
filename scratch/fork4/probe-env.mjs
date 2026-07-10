import { chromium } from '/home/cos/projects/ulg/node_modules/playwright/index.mjs';
const scenario = process.argv[2] || 'water';
const mode = process.argv[3] || 'native-webgpu-surface-consumer';
const bgimg = process.argv[4] === 'bg' ? '&bgimg=/plan/background-1.jpg' : '';
const drops = {
  water: 'drop=h2o&base=h2o&dropt=293&baset=293',
  iron: 'drop=fe&base=h2o&dropt=1800&baset=293',
  csf: 'drop=Cs&base=F&dropt=293&baset=293'
};
const url = `http://127.0.0.1:5191/?${drops[scenario]}&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=1&residentFuseSequence=1&visualCapture=1&surfaceDraw=${mode}${bgimg}`;
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--ignore-certificate-errors'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on('console', (m) => { const t = m.text(); if (/env-map/i.test(t)) console.log('[env]', t.slice(0, 180)); });
await page.goto(url);
await page.waitForTimeout(2000);
if (await page.locator('#sph-phase-overlay').count() === 0) await page.locator('#run-sph-phase').click().catch(() => {});
await page.waitForSelector('#sph-phase-overlay', { timeout: 240000 });
for (const [i, waitMs] of [[1, 14000], [2, 8000]]) {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `/tmp/fork4-shots/${scenario}-${mode.slice(0, 6)}${bgimg ? '-bg' : '-nobg'}-${i}.png` });
}
const envState = await page.evaluate(() => {
  const o = document.querySelector('#sph-phase-overlay');
  const b = o.__sphScene?.scene?.userData?.sphResidentSurfaceDrawRenderBridge;
  return { envMapUrl: b?.envMapUrl ?? null, hasView: Boolean(b?.envMapView) };
});
console.log(JSON.stringify(envState));
await browser.close();
