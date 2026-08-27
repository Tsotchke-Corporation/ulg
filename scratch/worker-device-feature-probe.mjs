import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto('https://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
const info = await page.evaluate(async () => {
  const a = await navigator.gpu.requestAdapter();
  const feats = [...a.features].map(String);
  let dev = null, err = null;
  try {
    dev = await a.requestDevice({ requiredFeatures: feats.includes('timestamp-query') ? ['timestamp-query'] : [] });
  } catch (e) { err = String(e); }
  return {
    adapterFeatures: feats.filter(f => f.includes('timestamp')),
    deviceHas: dev ? [...dev.features].map(String).filter(f => f.includes('timestamp')) : null,
    err,
  };
});
console.log(JSON.stringify(info));
await browser.close();
