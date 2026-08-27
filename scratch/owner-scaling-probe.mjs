import { chromium } from '@playwright/test';

const preset = process.argv[2] || 'sodium-water';
const breakSteps = Number(process.env.ULG_PROBE_BREAK_STEPS || 64);
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
await page.goto(`https://localhost:5173/?scenario=${preset}&residentGpuTimestampProfile=1&contactCleanupProfileReadback=1&probeEpoch=${Date.now()}${process.env.ULG_PROBE_EXTRA || ''}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 180000 });

// Wait for enough committed steps, then read the LAST step's owner GPU time
// and cleanup profile together (same step, same knobs).
const t0 = Date.now();
let out = null;
while (Date.now() - t0 < 300000) {
  out = await page.evaluate(() => {
    const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
    const hier = lane?.hierarchyStageSummary;
    return {
      steps: lane?.laneCompletedStepTotal ?? 0,
      stageGpuMs: hier?.residentStageTiming?.stageGpuMs ?? null,
      profile: hier?.matchingCleanupProfile ?? null,
    };
  });
  if (out.steps >= breakSteps) break;
  await page.waitForTimeout(1000);
}
await browser.close();
const p = out?.profile;
console.log(JSON.stringify({
  preset,
  breakSteps,
  steps: out?.steps ?? null,
  stageGpuMs: out?.stageGpuMs ?? null,
  profile: p
    ? {
        appliedPairTotal: p.appliedPairTotal,
        firstZeroAppliedPass: p.firstZeroAppliedPass,
        lastNonzeroAppliedPass: p.lastNonzeroAppliedPass,
        maxContactCount: p.maxContactCount,
      }
    : null,
}, null, 1));
