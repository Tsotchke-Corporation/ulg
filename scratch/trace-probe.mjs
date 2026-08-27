import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-tracing=disabled-by-default-gpu.dawn,gpu,toplevel,cc',
    '--trace-startup-file=/tmp/claude-1000/-home-cos-projects-ulg/b3ad11a8-4350-4ffa-aac3-07d3f000a014/scratchpad/gpu-trace.json',
    '--trace-startup-duration=45', '--trace-startup-format=json'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
await page.goto(`https://localhost:5173/?scenario=sodium-water&contactCleanupPasses=16&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => { const b = document.querySelector('#sph-play'); return b && !b.disabled; }, null, { timeout: 180000 });
await page.waitForTimeout(32000);
const lane = await page.evaluate(() => document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane?.laneCompletedStepTotal ?? 0);
console.log(JSON.stringify({ committed: lane }));
await page.waitForTimeout(4000);
await browser.close();
