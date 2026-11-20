// A1: CPU profile of every thread (page + workers) while the resident lane
// steps, via Chrome tracing (v8 cpu_profiler ProfileChunk events).
//   node scripts/a1-worker-cpu-profile.mjs [scenario] [extraQuery]
// A1_WINDOW_MS (default 10000), A1_OUT_DIR, A1_BASE_URL. Writes a summary JSON.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
const scenario = process.argv[2] || 'iron-ice-quench';
const extra = process.argv[3] || '';
const windowMs = Number(process.env.A1_WINDOW_MS || 10000);
const outDir = process.env.A1_OUT_DIR || join(homedir(), '.cache/icc/repos/ulg/a1-hold-20261114');
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
  await page.waitForTimeout(8000);
  const tracePath = join(outDir, 'worker-cpu-trace.json');
  const s0 = await page.evaluate(lane);
  await browser.startTracing(page, { path: tracePath, categories: ['disabled-by-default-v8.cpu_profiler', 'v8.execute', '__metadata'] });
  await page.waitForTimeout(windowMs);
  await browser.stopTracing();
  const steps = (await page.evaluate(lane)) - s0;
  const trace = JSON.parse(await readFile(tracePath, 'utf8'));
  const events = trace.traceEvents ?? trace;
  const threadNames = {};
  for (const e of events) if (e.name === 'thread_name') threadNames[`${e.pid}:${e.tid}`] = e.args?.name;
  // Profiles: 'Profile' (start) + 'ProfileChunk' events keyed by id per thread.
  const profiles = {};
  for (const e of events) {
    if (e.name !== 'ProfileChunk' && e.name !== 'Profile') continue;
    const key = `${e.pid}:${e.id}`;
    const p = profiles[key] ??= { thread: `${e.pid}:${e.tid}`, nodes: new Map(), samples: [], deltas: [] };
    const cp = e.args?.data?.cpuProfile;
    for (const n of cp?.nodes ?? []) p.nodes.set(n.id, n);
    if (cp?.samples) p.samples.push(...cp.samples);
    if (e.args?.data?.timeDeltas) p.deltas.push(...e.args.data.timeDeltas);
  }
  const out = { url, windowMs, steps, threads: [] };
  for (const p of Object.values(profiles)) {
    const self = new Map(), incl = new Map();
    let totalUs = 0;
    const label = (n) => { const f = n.callFrame ?? {}; const file = (f.url || '').split('/').pop().split('?')[0];
      return `${f.functionName || '(anon)'} ${file}:${(f.lineNumber ?? -1) + 1}`; };
    for (let i = 0; i < p.samples.length; i++) {
      const dt = p.deltas[i + 1] ?? p.deltas[i] ?? 0; totalUs += dt;
      let n = p.nodes.get(p.samples[i]); if (!n) continue;
      const l = label(n); self.set(l, (self.get(l) ?? 0) + dt);
      const seenL = new Set();
      while (n) { const ll = label(n); if (!seenL.has(ll)) { incl.set(ll, (incl.get(ll) ?? 0) + dt); seenL.add(ll); } n = n.parent != null ? p.nodes.get(n.parent) : null; }
    }
    if (totalUs < 1e5) continue;
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 35).map(([k, v]) => [k, +(v / 1000).toFixed(1)]);
    out.threads.push({ thread: p.thread, name: threadNames[p.thread] ?? null, sampledMs: +(totalUs / 1000).toFixed(0),
      idleMs: +((self.get('(idle) :0') ?? 0) / 1000).toFixed(0), self: top(self), inclusive: top(incl) });
  }
  await writeFile(join(outDir, 'worker-cpu-profile.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ steps, threads: out.threads.map((t) => ({ thread: t.thread, name: t.name, sampledMs: t.sampledMs, idleMs: t.idleMs })) }));
} finally { await browser.close(); }
