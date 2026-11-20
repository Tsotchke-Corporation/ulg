// A1: how much wall time does the resident lane spend held behind the
// post-step presentation proof? Samples the mount's auto-schedule status and
// the lane step counter in the page every 10 ms over a window.
//   node scripts/a1-hold-census.mjs [scenario] [extraQuery]
// A1_WINDOW_MS (default 60000), A1_BASE_URL, A1_OUT (JSON path).
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const scenario = process.argv[2] || 'iron-ice-quench';
const extra = process.argv[3] || '';
const windowMs = Number(process.env.A1_WINDOW_MS || 60000);
const url = new URL(`pages.html?scenario=${scenario}&residentAuto=1${extra}`, process.env.A1_BASE_URL || 'https://127.0.0.1:5173/').href;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const lane = () => document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane?.laneCompletedStepTotal ?? 0;
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(2000);
    const row = await page.evaluate(() => ({ play: document.querySelector('#sph-play')?.textContent,
      rebuild: document.querySelector('#sph-phase-overlay')?.__sphPhaseRebuildWorker?.status }));
    if (row.rebuild === 'complete' && row.play === 'Play') await page.locator('#sph-play').click({ timeout: 5000 }).catch(() => {});
    if ((await page.evaluate(lane)) > 0) break;
  }
  await page.waitForTimeout(10000);
  const out = await page.evaluate(async (windowMs) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const steps = () => overlay?.__mlsMpmResidentSteps?.workerOwnedResidentLane?.laneCompletedStepTotal ?? 0;
    const statusMs = {}; const gateMs = {}; let last = performance.now();
    const frames = () => Number(overlay?.__sphResidentRenderState?.workerOffscreenPresentationFrameCount ?? NaN);
    const t0 = last, s0 = steps(), f0 = frames(); let stepChanges = 0, lastSteps = s0;
    const spanSeen = new Set(), spanMs = {}, spanCount = {};
    const pageTimings = []; let lastTimingSchedule = null;
    const timeline = []; let prevKey = '';
    const snap = () => {
      const gate = overlay?.__sphResidentPostStepPresentationGate;
      const proof = overlay?.__sphResidentPresentationProof;
      const wait = overlay?.__sphResidentPresentationProofWait;
      const render = overlay?.__sphResidentRenderState;
      return { steps: steps(), gate: gate?.active ? gate.status : '-', gateHandoff: gate?.handoffStatus ?? null,
        proof: proof?.status ?? null, proofVisible: proof?.visible === true, proofCurrent: proof?.sourceCurrent === true,
        wait: wait?.status ?? null, renderStatus: render?.status ?? null,
        renderSource: render?.sourceResidentStepsSignature ?? render?.residentStepsSignature ?? null };
    };
    await new Promise((resolve) => {
      const id = setInterval(() => {
        const now = performance.now(), dt = now - last; last = now;
        const status = overlay?.__mlsMpmResidentAutoSchedule?.status ?? 'none';
        statusMs[status] = (statusMs[status] ?? 0) + dt;
        const gate = overlay?.__sphResidentPostStepPresentationGate;
        const g = gate?.active ? `active:${gate.status}` : 'inactive';
        gateMs[g] = (gateMs[g] ?? 0) + dt;
        const s = steps(); if (s !== lastSteps) { stepChanges++; lastSteps = s; }
        const laneNow = overlay?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
        if (laneNow?.workerLanePageTiming && laneNow.scheduleId !== lastTimingSchedule && pageTimings.length < 40) {
          lastTimingSchedule = laneNow.scheduleId;
          pageTimings.push({ scheduleId: laneNow.scheduleId, ...laneNow.workerLanePageTiming });
        }
        if (timeline.length < 400) { const row = snap(); const key = JSON.stringify(row);
          if (key !== prevKey) { prevKey = key; timeline.push({ t: Math.round(now - t0), ...row }); } }
        for (const span of overlay?.__sphPerformanceTrace?.spans ?? []) {
          const key = `${span.label}@${span.startMs}`;
          if (spanSeen.has(key) || span.startMs < t0) continue;
          spanSeen.add(key); spanMs[span.label] = (spanMs[span.label] ?? 0) + span.durationMs;
          spanCount[span.label] = (spanCount[span.label] ?? 0) + 1;
        }
        if (now - t0 >= windowMs) { clearInterval(id); resolve(); }
      }, 10);
    });
    const wall = performance.now() - t0, done = steps() - s0;
    const frac = (m) => Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / wall).toFixed(3)]));
    return { wallMs: Math.round(wall), steps: done, stepsPerS: +(done / wall * 1000).toFixed(2), counterUpdates: stepChanges,
      presentedFrames: frames() - f0, presentedFramesPerS: +((frames() - f0) / wall * 1000).toFixed(2),
      statusFraction: frac(statusMs), gateFraction: frac(gateMs),
      spans: Object.fromEntries(Object.entries(spanMs).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k,
        { count: spanCount[k], totalMs: Math.round(v), meanMs: Math.round(v / spanCount[k]), wallFraction: +(v / wall).toFixed(3) }])),
      fps: document.querySelector('#sph-fps')?.textContent ?? '', timeline, pageTimings,
      stageTiming: (() => {
        const seen = new Set();
        const find = (value, depth) => {
          if (!value || typeof value !== 'object' || depth > 8 || seen.has(value)) return null;
          seen.add(value);
          if (value.residentStageTiming?.stageMs) return value.residentStageTiming;
          for (const key of Object.keys(value)) { const hit = find(value[key], depth + 1); if (hit) return hit; }
          return null;
        };
        try { const t = find(overlay?.__mlsMpmResidentSteps, 0); return t ? JSON.parse(JSON.stringify({ totalMs: t.totalMs,
          stageMs: Object.fromEntries(Object.entries(t.stageMs).sort((a, b) => b[1] - a[1]).slice(0, 40)) })) : null; } catch { return null; }
      })(),
      stepRing: (() => {
        const seen = new Set();
        const find = (value, depth) => {
          if (!value || typeof value !== 'object' || depth > 9 || seen.has(value)) return null;
          seen.add(value);
          if (Array.isArray(value.stepSummaryRing) && value.stepSummaryRing.length) return value.stepSummaryRing;
          for (const key of Object.keys(value)) { const hit = find(value[key], depth + 1); if (hit) return hit; }
          return null;
        };
        try { const ring = find(overlay?.__mlsMpmResidentSteps, 0) ?? find(overlay, 0);
          return ring ? ring.map((r) => ({ o: r.stepOrdinal, start: r.stepStartedAtMs, step: r.stepElapsedMs,
            epoch: r.epochStageElapsedMs, mech: r.mechanicsStageElapsedMs })) : null; } catch { return null; }
      })(),
      scheduleTrace: (overlay?.__sphResidentScheduleTrace ?? []).map((e) => ({ token: e.scheduleToken, stage: e.stage,
        t: Math.round(e.atMs - t0) })),
      renderKeys: (() => {
        const pick = (o) => o ? Object.fromEntries(Object.entries(o).filter(([k, v]) => /bridge|worker|present|visible|frame|status|source/i.test(k)
          && (v == null || typeof v !== 'object')).slice(0, 80)) : null;
        return { renderState: pick(overlay?.__sphResidentRenderState), surfaceDraw: pick(overlay?.__sphResidentSurfaceDraw),
          proof: pick(overlay?.__sphResidentPresentationProof) };
      })() };
  }, windowMs);
  for (const w of page.workers()) {
    try { const t = await w.evaluate(() => globalThis.__ulgLaneStepTiming ?? null); if (t) { out.laneStepTiming = t; break; } } catch {}
  }
  console.log(JSON.stringify(out, null, 1));
  if (process.env.A1_OUT) await writeFile(process.env.A1_OUT, JSON.stringify({ url, ...out }, null, 1));
} finally { await browser.close(); }
