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
// wait until at least one schedule commits
await page.waitForFunction(() => {
  const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  return (lane?.laneCompletedStepTotal ?? 0) >= 64;
}, null, { timeout: 240000 });
const out = await page.evaluate(() => {
  const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  const hier = lane?.hierarchyStageSummary || null;
  const last = lane?.perStepSummaries?.lastStep || null;
  const pick = (obj, keys) => obj ? Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]])) : null;
  const grepKeys = (obj, re) => obj ? Object.fromEntries(Object.entries(obj).filter(([k]) => re.test(k))) : null;
  return {
    steps: lane?.laneCompletedStepTotal ?? 0,
    hierarchyStageSummaryKeys: hier ? Object.keys(hier) : null,
    hierLaw: grepKeys(hier, /law|Law|index|Index|traversal|Traversal|candidate|Candidate|contact|Contact|pressure|Pressure/),
    lastStepKeys: last ? Object.keys(last) : null,
    lastLaw: grepKeys(last, /law|Law|index|Index|traversal|Traversal|candidate|Candidate|neighbor|Neighbor/),
    lastPressure: grepKeys(last, /pressure|Pressure|contact|Contact/),
    reaction: grepKeys(last, /reaction|Reaction/),
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
