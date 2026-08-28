import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 560 } });
const consoleHits = [];
const presentationMarks = [];
page.on('console', (msg) => {
  const t = msg.text();
  if (/destroyed|WebGPU|Dawn|uncaptured|validation/i.test(t)) consoleHits.push(t.slice(0, 220));
  if (/resident-steps-worker-lane-committed-presentation|presentation-blocked|blocked-pending-committed/.test(t)) {
    Promise.all(msg.args().map((a) => a.jsonValue().catch(() => '<unserializable>')))
      .then((vals) => presentationMarks.push(vals))
      .catch(() => presentationMarks.push([t.slice(0, 300)]));
  }
});
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e?.message || e).slice(0, 200)));
const fpsLine = () => page.evaluate(() => (document.querySelector('#sph-fps')?.textContent || '').slice(0, 160));
const waitReady = () => page.waitForFunction(() => {
  const b = document.querySelector('#sph-play');
  return b && !b.disabled;
}, null, { timeout: 240000 });

await page.goto(`${process.env.ULG_SCEN_URL || 'https://localhost:5173/?scenario=bulk-water'}&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
await waitReady();
// Wait until the first schedule actually commits (completion is a number).
await page.waitForFunction(() => /completion=\d/.test(document.querySelector('#sph-fps')?.textContent || ''), null, { timeout: 120000 });
const laneConfig = () => page.evaluate(() => {
  const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  if (!lane) return null;
  const out = {};
  const want = /contact|compact|burst|preview|observe|fuse|variant|carrier|authority|eligib|schedule|route|steps/i;
  const walk = (obj, prefix, depth) => {
    if (!obj || typeof obj !== 'object' || depth > 2) return;
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v == null || ['string', 'number', 'boolean'].includes(typeof v)) {
        if (want.test(key)) out[key] = v;
      } else if (typeof v === 'object' && !Array.isArray(v) && want.test(k)) {
        walk(v, key, depth + 1);
      }
    }
  };
  walk(lane, '', 0);
  return out;
});
const beforeEdit = await fpsLine();
const laneBefore = await laneConfig();
const hitsBeforeEdit = consoleHits.length;

// The user's flow: edit basen 32 -> 16 in the UI (pauses), then press Play.
await page.evaluate(() => {
  const el = document.querySelectorAll('#sph-counts input')[1];
  el.value = '16';
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('#sph-play')?.click());
await waitReady();
const rebuildTrace = [];
for (let i = 0; i < 6; i += 1) {
  await page.waitForTimeout(5000);
  rebuildTrace.push(await page.evaluate(() => ({
    atMs: Math.round(performance.now()),
    rebuildWorker: globalThis.document && JSON.parse(JSON.stringify(
      document.querySelector('#sph-phase-overlay')?.__sphPhaseRebuildWorker ?? null
    )),
    status: (document.querySelector('#sph-status')?.textContent || '').slice(0, 160),
    fps: (document.querySelector('#sph-fps')?.textContent || '').slice(0, 120),
  })));
  if (/completion=\d/.test(rebuildTrace[rebuildTrace.length - 1].fps)) break;
}
// Poll the progress mirror fast, keeping presentation-blocked details.
const blockedDetails = await page.evaluate(async () => {
  const seen = new Map();
  const t0 = performance.now();
  while (performance.now() - t0 < 40000 && seen.size < 4) {
    const p = document.querySelector('#sph-phase-overlay')?.__sphScene?.scene?.userData?.mlsMpmResidentStepsProgress;
    if (p && /committed-presentation-blocked/.test(String(p.status))) {
      seen.set(`${p.scheduleId}`, {
        scheduleId: p.scheduleId,
        presentationStatus: p.presentationStatus,
        presentationSphStep: p.presentationSphStep,
        laneId: p.laneId,
      });
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return [...seen.values()];
});
// Once the first schedule commits, watch whether the lane ramps back up.
for (let i = 0; i < 8; i += 1) {
  await page.waitForTimeout(5000);
  rebuildTrace.push(await page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const p = overlay?.__sphScene?.getWorkerOffscreenPresentation?.() || null;
    const flat = {};
    if (p) {
      for (const [k, v] of Object.entries(p)) {
        if (v == null || ['string', 'number', 'boolean'].includes(typeof v)) {
          if (/status|schedule|lane|reason|surface|generation|step/i.test(k)) flat[k] = v;
        }
      }
    }
    return {
      atMs: Math.round(performance.now()),
      fps: (document.querySelector('#sph-fps')?.textContent || '').slice(0, 130),
      presentation: flat,
    };
  }));
}
const afterRebuild = await fpsLine();
const laneAfter = await laneConfig();
const rebuildDead = !/completion=\d/.test(afterRebuild) || /physics fps 0\.0/.test(afterRebuild);
const diagnostics = await page.evaluate(() => {
  const poll = globalThis.__ulgWorkerLaneSnapshotPoll;
  const status = (document.querySelector('#sph-status')?.textContent || '').slice(0, 300);
  const warning = (document.querySelector('#sph-warning-bar')?.textContent || '').slice(0, 300);
  const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  return {
    snapshotPoll: poll ? JSON.parse(JSON.stringify(poll)) : null,
    status, warning,
    laneCompleted: lane?.laneCompletedStepTotal ?? null,
    laneKeys: lane ? Object.keys(lane).slice(0, 40) : null,
  };
});
await page.screenshot({ path: '/home/cos/.claude/jobs/9d60386a/tmp/rebuild-after.png' });
await browser.close();
console.log(JSON.stringify({
  beforeEdit, hitsBeforeEdit, afterRebuild, rebuildDead,
  consoleHits: consoleHits.slice(0, 20), consoleHitTotal: consoleHits.length,
  pageErrors: pageErrors.slice(0, 5), diagnostics, rebuildTrace, laneBefore, laneAfter,
  presentationMarks: presentationMarks.slice(-12), blockedDetails,
}, null, 1));
