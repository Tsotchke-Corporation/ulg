import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
await page.goto(`https://localhost:5173/?scenario=sodium-water&probeEpoch=${Date.now()}${process.env.ULG_PROBE_EXTRA || ''}`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => { const b = document.querySelector('#sph-play'); return b && !b.disabled; }, null, { timeout: 180000 });
const t0 = Date.now();
const seen = [];
let prev = null;
while (Date.now() - t0 < Number(process.env.ULG_PROBE_WINDOW_MS || 90000)) {
  const snap = await page.evaluate(() => {
    const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
    const steps = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps;
    const rpm = steps?.residentProductMass || lane?.residentProductMass || null;
    const summary = steps?.reactionSummary || lane?.reactionSummary || null;
    const pick = (o) => o && {
      rowCount: o.productEventRowCount ?? null,
      liveUpper: o.productEventLiveRowCountUpperBound ?? null,
      liveAuthority: o.productEventLiveRowCountUpperBoundAuthority ?? null,
      activeEvents: o.productEventActiveEventCount ?? null,
      byteLength: o.productEventBufferByteLength ?? null,
      capacityBytes: o.productEventBufferCapacityByteLength ?? null,
      strideFloats: o.productEventStrideFloats ?? null,
    };
    return {
      committed: lane?.laneCompletedStepTotal ?? 0,
      rpm: pick(rpm),
      summaryRowCount: summary?.productEventRowCount ?? null,
      laneKeys: lane ? Object.keys(lane).filter((k) => /product|Product/.test(k)).slice(0, 20) : [],
      stepsKeys: steps ? Object.keys(steps).filter((k) => /product|Product|reaction/i.test(k)).slice(0, 20) : [],
    };
  });
  if (snap.committed !== prev) { seen.push({ t: Date.now() - t0, ...snap }); prev = snap.committed; }
  await page.waitForTimeout(400);
}
await browser.close();
console.log(JSON.stringify(seen, null, 1));
