// W4 verification harness: drives the demo with the worker-owned resident
// producer mode and measures the acceptance criteria that define the lane:
//   1. sim advances (physics alive end to end through the worker lane)
//   2. residentComputeManagerMode seals 'worker-owned-resident-lane'
//   3. main-thread long tasks collapse versus the direct route
//   4. physics cadence continues while pointer interaction occupies the page
// Usage: node w4-worker-lane-verify.mjs [scenario] [mode]
//   mode: 'worker-owned' (default) or 'direct' (baseline comparison run)
const { chromium } = await import('file:///home/cos/projects/ulg/node_modules/playwright/index.mjs');
const scenario = process.argv[2] || 'water-cycle';
const mode = process.argv[3] || 'worker-owned';
const ownership = mode === 'direct' ? 'main-thread-renderer' : 'worker-owned-resident-render-producer';
const url = `https://localhost:5173/?scenario=${scenario}&renderOwnership=${ownership}&ss=1&residentAuto=0`;

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto(url, { waitUntil: 'load', timeout: 60000 });

await page.evaluate(() => {
  globalThis.__w4LongTasks = { count: 0, totalMs: 0, maxMs: 0 };
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      globalThis.__w4LongTasks.count += 1;
      globalThis.__w4LongTasks.totalMs += entry.duration;
      globalThis.__w4LongTasks.maxMs = Math.max(globalThis.__w4LongTasks.maxMs, entry.duration);
    }
  });
  observer.observe({ type: 'longtask', buffered: true });
});

for (let i = 0; i < 120; i += 1) {
  const st = await page.evaluate(() => {
    const b = document.querySelector('#sph-play');
    if (!b || b.disabled) return 'wait';
    const t = b.textContent.trim();
    if (t === 'Pause') return 'playing';
    if (!document.body.innerText.includes('PHYSICS PENDING')
      && !document.body.innerText.includes('deriving material')) b.click();
    return t;
  }).catch(() => 'gone');
  if (st === 'playing') break;
  await sleep(3000);
}

// settle past cold start, then measurement window
for (let i = 0; i < 60; i += 1) {
  const t = await page.evaluate(() => parseFloat(document.body.innerText.match(/sim t ([0-9.]+)s/)?.[1] || '0'));
  if (t > 0.01) break;
  await sleep(3000);
}
await page.evaluate(() => { globalThis.__w4LongTasks = { count: 0, totalMs: 0, maxMs: 0 }; });
const t0 = await page.evaluate(() => parseFloat(document.body.innerText.match(/sim t ([0-9.]+)s/)?.[1] || '0'));
const wall0 = Date.now();
await sleep(30000);

// interaction phase: continuous pointer drag for 10s while sampling sim t
const tPreDrag = await page.evaluate(() => parseFloat(document.body.innerText.match(/sim t ([0-9.]+)s/)?.[1] || '0'));
const dragStart = Date.now();
while (Date.now() - dragStart < 10000) {
  await page.mouse.move(300, 300);
  await page.mouse.down();
  for (let x = 300; x <= 420; x += 12) { await page.mouse.move(x, 300 + (x % 24)); await sleep(16); }
  await page.mouse.up();
}
const tPostDrag = await page.evaluate(() => parseFloat(document.body.innerText.match(/sim t ([0-9.]+)s/)?.[1] || '0'));

const t1 = await page.evaluate(() => parseFloat(document.body.innerText.match(/sim t ([0-9.]+)s/)?.[1] || '0'));
const wallS = (Date.now() - wall0) / 1000;
const longTasks = await page.evaluate(() => globalThis.__w4LongTasks);
// Route detection reads the REAL published seals: the execution envelope the
// page publishes on the overlay element (residentComputeManagerMode,
// workerOwnedResidentLane, workerLaneFallback) plus the mount's lane
// admission record.
const routeMode = await page.evaluate(() => {
  const overlay = document.querySelector('#sph-phase-overlay');
  const execution = overlay?.__mlsMpmResidentSteps || null;
  const lane = execution?.workerOwnedResidentLane || null;
  return {
    residentComputeManagerMode: execution?.residentComputeManagerMode ?? null,
    workerLaneFallback: execution?.workerLaneFallback ?? null,
    laneAdmission: overlay?.__sphWorkerOwnedResidentLaneAdmission ?? null,
    computeManagerStatus: overlay?.__sphResidentComputeManager?.status ?? null,
    lane: lane
      ? {
          laneId: lane.laneId,
          scheduleId: lane.scheduleId,
          completedStepCount: lane.completedStepCount,
          requestedStepCount: lane.requestedStepCount,
          cancelled: lane.cancelled,
          finalEpochIdentity: lane.finalEpochIdentity,
          retainedBufferRefCount: lane.retainedBufferRefs?.length ?? 0
        }
      : null,
    workerLaneSimTime: execution?.workerLaneSimTime ?? null,
    executionStatus: execution?.status ?? null,
    completedStepCount: execution?.completedStepCount ?? null
  };
});

console.log(JSON.stringify({
  mode, ownership, scenario,
  simAdvanceS: Number((t1 - t0).toFixed(4)),
  wallS: Number(wallS.toFixed(1)),
  stepsPerWallSecondProxy: Number(((t1 - t0) / wallS).toFixed(5)),
  dragWindow: { simAdvanceDuringDragS: Number((tPostDrag - tPreDrag).toFixed(4)) },
  mainThreadLongTasks: longTasks,
  route: routeMode
}, null, 1));
await browser.close();
