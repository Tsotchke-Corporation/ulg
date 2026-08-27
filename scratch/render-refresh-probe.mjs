import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
await page.goto(`https://localhost:5173/?scenario=sodium-water&residentGpuTimestampProfile=1&contactCleanupPasses=128&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => { const b = document.querySelector('#sph-play'); return b && !b.disabled; }, null, { timeout: 180000 });
await page.waitForTimeout(30000);
const info = await page.evaluate(() => {
  const scene = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps;
  const rs = window?.__ulgScene?.userData?.sphResidentRenderState
    || document.querySelector('#sph-phase-overlay')?.__sphResidentRenderState
    || null;
  // fall back: scene userData via any exposed handle
  const handles = Object.keys(window).filter(k => k.includes('ulg') || k.includes('Scene')).slice(0, 10);
  return {
    handles,
    renderRefreshStageMs: rs?.renderRefreshStageMs ?? null,
    queueStageStats: rs?.residentGpuQueueStageStats ?? null,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
