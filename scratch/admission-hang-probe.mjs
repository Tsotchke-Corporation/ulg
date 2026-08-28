import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1200, height: 700 } });
const lines = [];
page.on('pageerror', (e) => lines.push(['pageerror', String(e?.message || e).slice(0, 300)]));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || m.type() === 'warning' || /ulg|schroeder|contact|worker|reject|fail|error|admission/i.test(t)) {
    lines.push([m.type(), t.slice(0, 4000)]);
  }
});
await page.goto(`https://localhost:5173/?scenario=${process.env.ULG_HANG_SCENARIO || 'bulk-water'}${process.env.ULG_HANG_EXTRA || '&contactSolver=0'}&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
const waitMs = Number(process.env.ULG_HANG_WAIT_MS || 50000);
const snapshots = [];
for (let i = 0; i < 5; i += 1) {
  await page.waitForTimeout(waitMs / 5);
  snapshots.push(await page.evaluate(() => ({
    status: document.querySelector('#sph-status')?.textContent?.slice(0, 200) ?? null,
    playDisabled: document.querySelector('#sph-play')?.disabled ?? null,
    hud: document.querySelector('#sph-hud')?.textContent?.slice(0, 160) ?? null,
    lane: (() => {
      const s = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps;
      return {
        committed: s?.workerOwnedResidentLane?.laneCompletedStepTotal ?? 0,
        status: s?.workerOwnedResidentLane?.residentScheduleStatus ?? null,
        terminal: s?.workerOwnedResidentLane?.terminalStatus ?? null,
        fallback: document.querySelector('#sph-phase-overlay')?.__sphSceneUserDataProbe ?? null
      };
    })(),
    workerFallback: (() => {
      try {
        const scene = document.querySelector('#sph-phase-overlay')?.__sphSceneRef;
        return scene?.userData?.sphWorkerLaneLastFallback ?? null;
      } catch { return null; }
    })()
  })));
}
await browser.close();
console.log(JSON.stringify({ snapshots, console: lines.slice(0, 60) }, null, 1));
