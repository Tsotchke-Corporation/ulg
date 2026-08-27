import { chromium } from '@playwright/test';

const preset = process.argv[2] || 'sodium-water';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
await page.goto(`https://localhost:5173/?scenario=${preset}&probeEpoch=${Date.now()}${process.env.ULG_PROBE_EXTRA || ''}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 180000 });

// Wait for schedule commits and harvest the per-step ring (now carrying
// stepStartedAtMs/stepElapsedMs) so intra-cycle gaps are visible.
const commits = [];
const t0 = Date.now();
const horizonMs = Number(process.env.ULG_PROBE_WINDOW_MS || 60000);
let prevCommitted = null;
let earlyCaptured = true;
while (Date.now() - t0 < horizonMs) {
  const snap = await page.evaluate(() => {
    const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
    const ps = lane?.perStepSummaries;
    return {
      committed: lane?.laneCompletedStepTotal ?? 0,
      phase: {
        first: lane?.scheduleFirstStepStartedAtMs ?? null,
        lastEnd: lane?.scheduleLastStepEndedAtMs ?? null,
        fenceDone: lane?.tailTerminalFenceDoneAtMs ?? null,
        census: lane?.submitCensus ?? null,
        assembled: lane?.resultAssembledAtMs ?? null,
      },
      ring: Array.isArray(ps?.ring)
        ? ps.ring.map((r) => ({
            ord: r.stepOrdinal,
            t: r.stepStartedAtMs,
            step: r.stepElapsedMs,
            epoch: r.epochStageElapsedMs,
            mech: r.mechanicsStageElapsedMs,
            epochGpu: r.epochQueueIntervalMs ?? null,
            epochTimeline: r.epochQueueTimeline ?? null,
            gpu: r.stageGpuMs ?? null,
          }))
        : [],
    };
  });
  if (snap.committed !== prevCommitted && snap.ring.length && snap.ring[0].t != null) {
    commits.push({ tMs: Date.now() - t0, committed: snap.committed, ring: snap.ring, phase: snap.phase });
    prevCommitted = snap.committed;
    earlyCaptured = false;
  }
  if (!earlyCaptured && snap.ring.length && snap.ring[0].t != null
      && snap.ring.some((r) => r.ord <= 8)) {
    commits.push({ tMs: Date.now() - t0, committed: 'mid:' + snap.committed, ring: snap.ring, phase: snap.phase });
    earlyCaptured = true;
  }
  await page.waitForTimeout(250);
}
await browser.close();
console.log(JSON.stringify({ preset, commits }, null, 1));
