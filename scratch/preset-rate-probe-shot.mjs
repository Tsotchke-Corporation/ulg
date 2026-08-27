import { chromium } from '@playwright/test';

const preset = process.argv[2] || 'sodium-water';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e?.message || e).slice(0, 900)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text().slice(0, 900)}`); });
await page.goto(`https://localhost:5173/?scenario=${preset}&probeEpoch=${Date.now()}${process.env.ULG_PROBE_EXTRA || ''}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 180000 });

const samples = [];
for (let i = 0; i < 140; i += 1) {
  const s = await page.evaluate(() => {
    const o = document.querySelector('#sph-phase-overlay');
    const lane = o?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
    return {
      steps: lane?.laneCompletedStepTotal ?? 0,
      scheduleId: lane?.scheduleId ?? null,
      playing: document.querySelector('#sph-play')?.textContent.trim() ?? null,
    };
  });
  samples.push({ tMs: Date.now(), ...s });
  const n = samples.length;
  if (n >= 40 && samples[n - 1].steps === samples[n - 40].steps && samples[n - 1].steps > 0) break;
  if (samples[n - 1].steps >= 192) break;
  await page.waitForTimeout(1000);
}
const advancing = samples.filter((s, i) => i === 0 || s.steps > samples[i - 1].steps);
const first = samples.find((s) => s.steps > 0);
const last = [...samples].reverse().find((s) => s.steps > 0);
const activeS = first && last && last.tMs > first.tMs ? (last.tMs - first.tMs) / 1000 : null;
const jumps = [];
for (let i = 1; i < samples.length; i += 1) {
  if (samples[i].steps > samples[i - 1].steps) {
    jumps.push({ atS: Math.round((samples[i].tMs - samples[0].tMs) / 100) / 10, steps: samples[i].steps });
  }
}
const particleCount = await page.evaluate(() => {
  const o = document.querySelector('#sph-phase-overlay');
  return o?.__mlsMpmResidentSteps?.workerOwnedResidentLane?.perStepSummaries?.lastStep?.particleCount ?? null;
});
const cleanupProfile = await page.evaluate(() => {
  const o = document.querySelector('#sph-phase-overlay');
  return o?.__mlsMpmResidentSteps?.workerOwnedResidentLane?.hierarchyStageSummary?.matchingCleanupProfile ?? null;
});
console.log(JSON.stringify({
  consoleErrors: errors.slice(0, 6),
  cleanupProfile,
  particleCount,
  extra: process.env.ULG_PROBE_EXTRA || '',
  scheduleCommits: jumps,
  preset,
  totalSteps: last?.steps ?? 0,
  finalSchedule: last?.scheduleId ?? null,
  activeWindowS: activeS,
  activeStepsPerSecond: activeS ? (last.steps - first.steps) / activeS : null,
  series: samples.map((s) => s.steps).join(','),
  finalPlayState: samples[samples.length - 1].playing,
}, null, 1));
await page.screenshot({ path: '/tmp/ulg-preset-sweep/movedset-check.png' });
await browser.close();
