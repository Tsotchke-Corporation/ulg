import { chromium } from '@playwright/test';
const extra = process.env.ULG_PROBE_EXTRA || '';
const scenario = process.env.ULG_PROBE_SCENARIO || 'bulk-water';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e?.message || e).slice(0, 300)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error') errors.push(t.slice(0, 300)); });
try {
  await page.goto(`https://localhost:5173/?scenario=${scenario}${extra}&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => { const b = document.querySelector('#sph-play'); return b && !b.disabled; }, null, { timeout: Number(process.env.ULG_PROBE_STARTUP_MS || 300000) });
} catch (e) {
  console.log(JSON.stringify({ phase: 'startup-failed', error: String(e).slice(0, 200), errors: errors.slice(0, 8) }));
  await browser.close();
  process.exit(0);
}
const t0 = Date.now();
let prev = null; const commits = []; let lastCensus = null;
while (Date.now() - t0 < Number(process.env.ULG_PROBE_WINDOW_MS || 90000)) {
  const c = await page.evaluate(() => {
    const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
    return {
      committed: lane?.laneCompletedStepTotal ?? 0,
      n: lane?.perStepSummaries?.lastStep?.particleCount ?? null,
      completedStepCount: lane?.completedStepCount ?? null,
      firstStepStart: lane?.scheduleFirstStepStartedAtMs ?? null,
      lastStepEnd: lane?.scheduleLastStepEndedAtMs ?? null,
      tailFenceDone: lane?.tailTerminalFenceDoneAtMs ?? null,
      resultAssembled: lane?.resultAssembledAtMs ?? null,
      submitCensus: lane?.submitCensus ?? null,
      submitCensusDeviceMs: lane?.submitCensusDeviceMs ?? null,
      submitBurstObservation: lane?.submitBurstObservation ?? null,
      stageGpuMs: lane?.perStepSummaries?.lastStep?.stageGpuMs ?? null,
    };
  });
  if (c.committed !== prev) {
    prev = c.committed;
    if (c.submitCensus || c.submitBurstObservation) lastCensus = c;
    commits.push({ t: Date.now() - t0, committed: c.committed, n: c.n });
  }
  await page.waitForTimeout(400);
}
await browser.close();
console.log(JSON.stringify({ phase: 'ok', commits: commits.slice(-12), lastCensus, errors: errors.slice(0, 8) }, null, 1));
