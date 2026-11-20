// A1: where does the GPU process's main thread spend time while the lane
// steps? Chrome tracing with Dawn/GPU categories; sums top-level and Dawn
// slice durations per name on the GPU process threads.
//   node scripts/a1-gpu-process-trace.mjs [scenario] [extraQuery]
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
const scenario = process.argv[2] || 'iron-ice-quench';
const extra = process.argv[3] || '';
const windowMs = Number(process.env.A1_WINDOW_MS || 8000);
const outDir = process.env.A1_OUT_DIR || join(homedir(), '.cache/icc/repos/ulg/a1-hold-20261114');
const url = new URL(`pages.html?scenario=${scenario}&residentAuto=1${extra}`, 'https://127.0.0.1:5173/').href;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const lane = () => document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane?.laneCompletedStepTotal ?? 0;
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(1000);
    const row = await page.evaluate(() => ({ play: document.querySelector('#sph-play')?.textContent,
      rebuild: document.querySelector('#sph-phase-overlay')?.__sphPhaseRebuildWorker?.status }));
    if (row.rebuild === 'complete' && row.play === 'Play') await page.locator('#sph-play').click({ timeout: 5000 }).catch(() => {});
    if ((await page.evaluate(lane)) > 0) break;
  }
  await page.waitForTimeout(8000);
  const tracePath = join(outDir, 'gpu-process-trace.json');
  const s0 = await page.evaluate(lane);
  await browser.startTracing(page, { path: tracePath, categories: ['gpu', 'gpu.dawn', 'disabled-by-default-gpu.dawn', 'toplevel', 'gpu.service', '__metadata'] });
  await page.waitForTimeout(windowMs);
  await browser.stopTracing();
  const steps = (await page.evaluate(lane)) - s0;
  const trace = JSON.parse(await readFile(tracePath, 'utf8'));
  const events = trace.traceEvents ?? trace;
  const names = {}, procNames = {};
  for (const e of events) {
    if (e.name === 'thread_name') names[`${e.pid}:${e.tid}`] = e.args?.name;
    if (e.name === 'process_name') procNames[e.pid] = e.args?.name;
  }
  const gpuPids = new Set(Object.entries(procNames).filter(([, n]) => /GPU/i.test(n)).map(([p]) => Number(p)));
  const byThread = {};
  for (const e of events) {
    if (!gpuPids.has(e.pid) || e.ph !== 'X' || !(e.dur > 0)) continue;
    const key = `${names[`${e.pid}:${e.tid}`] ?? e.tid}`;
    const t = byThread[key] ??= { total: 0, names: {} };
    t.names[e.name] = (t.names[e.name] ?? 0) + e.dur;
    if (e.name === 'ThreadControllerImpl::RunTask' || e.name === 'ThreadPool_RunTask') t.total += e.dur;
  }
  const out = { steps, windowMs, threads: Object.fromEntries(Object.entries(byThread).map(([k, v]) => [k, {
    runTaskMs: +(v.total / 1000).toFixed(0),
    top: Object.entries(v.names).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([n, us]) => [n, +(us / 1000).toFixed(1)]) }])) };
  await writeFile(join(outDir, 'gpu-process-summary.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1).slice(0, 5000));
} finally { await browser.close(); }
