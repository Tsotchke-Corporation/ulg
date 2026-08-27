import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto('https://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
const info = await page.evaluate(async () => {
  const a = await navigator.gpu?.requestAdapter?.();
  if (!a) return { error: 'no adapter' };
  const i = a.info || {};
  return {
    vendor: i.vendor, architecture: i.architecture, device: i.device,
    description: i.description,
    isFallbackAdapter: a.isFallbackAdapter ?? null,
    limits: { wgStorage: a.limits?.maxComputeWorkgroupStorageSize },
  };
});
console.log(JSON.stringify(info));
await browser.close();
