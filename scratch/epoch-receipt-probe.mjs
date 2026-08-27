import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto(`https://localhost:5173/?scenario=sodium-water&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => { const b = document.querySelector('#sph-play'); return b && !b.disabled; }, null, { timeout: 180000 });
await page.waitForTimeout(15000);
const info = await page.evaluate(() => {
  const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  const gen = lane?.epochGenerationSummary || lane?.hierarchyStageSummary?.generationSummary || null;
  const ring = lane?.perStepSummaries?.ring;
  return {
    genKeys: gen ? Object.keys(gen).slice(0, 40) : null,
    gen: gen ? JSON.parse(JSON.stringify(gen)) : null,
  };
});
console.log(JSON.stringify(info).slice(0, 1500));
await browser.close();
