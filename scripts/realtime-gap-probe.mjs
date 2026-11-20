// Where does a preset step's time go? Runs the real app headed, presses Play,
// then measures three windows on every GPUDevice:
//   A  API census only (passes, dispatches, submits, readbacks per step)
//   B  census + a timestamp pair injected into every app compute/render pass
//      (per-label GPU time; perturbs the rate a little)
//   C  census only again (did the rate recover?)
//
//   node scripts/realtime-gap-probe.mjs [scenario] [tag] [extraQuery]
//
// The dev server must be running (npm run dev). RT_WINDOW_MS sets the window
// length, RT_OUT_DIR the evidence directory, RT_BASE_URL the server.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const scenario = process.argv[2] || 'iron-ice-quench';
const tag = process.argv[3] || scenario;
const extra = process.argv[4] || '';
const windowMs = Number(process.env.RT_WINDOW_MS || 30000);
const outDir = process.env.RT_OUT_DIR || join(homedir(), '.cache/icc/repos/ulg/realtime-gap-20261027');
const url = new URL(`pages.html?scenario=${scenario}&residentAuto=1&residentGpuTimestampFeature=1${extra}`,
  process.env.RT_BASE_URL || 'https://127.0.0.1:5173/').href;
const started = new Date();
const evidence = { schema: 'ulg.realtime-gap-probe.v1', started: started.toISOString(), url, windowMs, samples: [],
  windows: {}, workers: [], errors: [], console: [] };

// Installed in the page and every worker. Wraps prototypes, so it also sees
// devices created before it was installed.
const hook = () => {
  if (globalThis.__rtGap) return;
  const G = globalThis.__rtGap = { devices: [], timing: false, fenceSites: true, readbackErrors: 0, pending: 0, untimed: 0 };
  const encDev = new WeakMap(), passInfo = new WeakMap(), cbInfo = new WeakMap(), encTiming = new WeakMap(),
    queueDev = new WeakMap();
  const fresh = () => ({ encoders: 0, computePasses: 0, renderPasses: 0, dispatch: 0, dispatchIndirect: 0,
    workgroups: 0, submits: 0, commandBuffers: 0, writeBuffer: 0, writeBytes: 0, mapAsync: 0, workDone: 0,
    pipelines: 0, copies: 0, timedPasses: 0 });
  const entryFor = device => {
    let e = G.devices.find(x => x.device === device);
    if (!e) {
      e = { device, c: fresh(), labels: new Map(), indirect: new Map(), ns: new Map(), nsCount: new Map(), qsPool: [], bufPool: [] };
      G.devices.push(e); queueDev.set(device.queue, e);
      device.lost.then(info => { e.lost = `${info.reason}: ${info.message}`; });
    }
    return e;
  };
  const orig = {};
  const wrap = (proto, name, fn) => {
    const original = proto[name];
    if (!original || original.__rtGap) return;
    orig[`${proto.constructor.name}.${name}`] = original;
    const wrapped = function (...args) { return fn.call(this, original, args); };
    wrapped.__rtGap = true; proto[name] = wrapped;
  };
  wrap(GPUDevice.prototype, 'createCommandEncoder', function (o, a) {
    const e = entryFor(this); e.c.encoders++;
    const encoder = Reflect.apply(o, this, a); encDev.set(encoder, e); return encoder;
  });
  for (const name of ['createComputePipeline', 'createComputePipelineAsync', 'createRenderPipeline', 'createRenderPipelineAsync']) {
    wrap(GPUDevice.prototype, name, function (o, a) { entryFor(this).c.pipelines++; return Reflect.apply(o, this, a); });
  }
  const timedDescriptor = (encoder, e, descriptor, label) => {
    if (!G.timing || descriptor?.timestampWrites || !e.device.features.has('timestamp-query')) return [descriptor, -1];
    let t = encTiming.get(encoder);
    if (!t) {
      t = { qs: e.qsPool.pop() || e.device.createQuerySet({ type: 'timestamp', count: 1024 }), labels: [] };
      encTiming.set(encoder, t);
    }
    if (t.labels.length >= 512) { G.untimed++; return [descriptor, -1]; }
    const slot = t.labels.length; t.labels.push(label);
    return [{ ...(descriptor || {}), timestampWrites: { querySet: t.qs, beginningOfPassWriteIndex: 2 * slot,
      endOfPassWriteIndex: 2 * slot + 1 } }, slot];
  };
  wrap(GPUCommandEncoder.prototype, 'beginComputePass', function (o, a) {
    const e = encDev.get(this);
    if (!e) return Reflect.apply(o, this, a);
    e.c.computePasses++;
    const [descriptor, slot] = timedDescriptor(this, e, a[0], a[0]?.label || '');
    const pass = Reflect.apply(o, this, [descriptor]);
    passInfo.set(pass, { e, encoder: this, slot, label: a[0]?.label || '', pipeline: null });
    return pass;
  });
  wrap(GPUCommandEncoder.prototype, 'beginRenderPass', function (o, a) {
    const e = encDev.get(this);
    if (!e) return Reflect.apply(o, this, a);
    e.c.renderPasses++;
    const label = `render:${a[0]?.label || ''}`;
    const [descriptor] = timedDescriptor(this, e, a[0], label);
    e.labels.set(label, (e.labels.get(label) || 0) + 1);
    return Reflect.apply(o, this, [descriptor]);
  });
  wrap(GPUComputePassEncoder.prototype, 'setPipeline', function (o, a) {
    const info = passInfo.get(this);
    if (info) info.currentPipeline = a[0]?.label || '?';
    if (info && info.pipeline === null) {
      info.pipeline = a[0]?.label || '?';
      if (info.slot >= 0 && !info.label) encTiming.get(info.encoder).labels[info.slot] = `pipe:${info.pipeline}`;
    }
    return Reflect.apply(o, this, a);
  });
  wrap(GPUComputePassEncoder.prototype, 'dispatchWorkgroups', function (o, a) {
    const info = passInfo.get(this);
    if (info) { info.e.c.dispatch++; info.e.c.workgroups += (a[0] || 0) * (a[1] ?? 1) * (a[2] ?? 1); }
    return Reflect.apply(o, this, a);
  });
  wrap(GPUComputePassEncoder.prototype, 'dispatchWorkgroupsIndirect', function (o, a) {
    const info = passInfo.get(this);
    if (info) { info.e.c.dispatchIndirect++;
      // Per pass label and pipeline: which sites still launch indirectly.
      const key = `${info.label || '?'} | ${info.currentPipeline || info.pipeline || '?'}`;
      info.e.indirect.set(key, (info.e.indirect.get(key) || 0) + 1); }
    return Reflect.apply(o, this, a);
  });
  wrap(GPUComputePassEncoder.prototype, 'end', function (o, a) {
    const info = passInfo.get(this);
    if (info) { const key = info.label || `pipe:${info.pipeline}`; info.e.labels.set(key, (info.e.labels.get(key) || 0) + 1); }
    return Reflect.apply(o, this, a);
  });
  wrap(GPUCommandEncoder.prototype, 'copyBufferToBuffer', function (o, a) {
    const e = encDev.get(this); if (e) e.c.copies++;
    return Reflect.apply(o, this, a);
  });
  wrap(GPUCommandEncoder.prototype, 'finish', function (o, a) {
    const e = encDev.get(this), t = encTiming.get(this);
    if (e && t && t.labels.length) {
      const n = t.labels.length;
      const bufs = e.bufPool.pop() || {
        resolve: e.device.createBuffer({ size: 8192, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }),
        read: e.device.createBuffer({ size: 8192, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }) };
      this.resolveQuerySet(t.qs, 0, 2 * n, bufs.resolve, 0);
      orig['GPUCommandEncoder.copyBufferToBuffer'].call(this, bufs.resolve, 0, bufs.read, 0, 16 * n);
      encTiming.delete(this);
      const commandBuffer = Reflect.apply(o, this, a);
      cbInfo.set(commandBuffer, { e, t, bufs, n });
      return commandBuffer;
    }
    return Reflect.apply(o, this, a);
  });
  wrap(GPUQueue.prototype, 'submit', function (o, a) {
    const e = queueDev.get(this);
    const result = Reflect.apply(o, this, a);
    if (e) {
      e.c.submits++; e.c.commandBuffers += a[0]?.length || 0;
      for (const commandBuffer of a[0] || []) {
        const info = cbInfo.get(commandBuffer); if (!info) continue;
        cbInfo.delete(commandBuffer); G.pending++;
        orig['GPUBuffer.mapAsync'].call(info.bufs.read, GPUMapMode.READ, 0, 16 * info.n).then(() => {
          const stamps = new BigUint64Array(info.bufs.read.getMappedRange(0, 16 * info.n));
          for (let i = 0; i < info.n; i++) {
            const ns = Number(stamps[2 * i + 1] - stamps[2 * i]);
            if (!(ns >= 0 && ns < 5e9)) continue;
            const key = info.t.labels[i] || 'unlabelled';
            e.ns.set(key, (e.ns.get(key) || 0) + ns); e.nsCount.set(key, (e.nsCount.get(key) || 0) + 1);
            e.c.timedPasses++;
          }
          info.bufs.read.unmap(); e.bufPool.push(info.bufs); e.qsPool.push(info.t.qs);
        }).catch(() => { G.readbackErrors++; }).finally(() => { G.pending--; });
      }
    }
    return result;
  });
  wrap(GPUQueue.prototype, 'writeBuffer', function (o, a) {
    const e = queueDev.get(this);
    if (e) { e.c.writeBuffer++; e.c.writeBytes += a[4] ?? (a[2]?.byteLength ?? 0); }
    return Reflect.apply(o, this, a);
  });
  // Call sites of fences and readbacks (top app frames).
  const site = () => { if (!G.fenceSites) return null;
    const frames = (new Error().stack || '').split('\n').slice(2).map(l => l.trim())
      .filter(l => !l.includes('Reflect') && !l.includes('wrap')).slice(0, 4)
      .map(l => l.replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').replace(/\?[^:)]*/, ''));
    return frames.join(' <- '); };
  const countSite = (e, kind) => { const k = site(); if (!k || !e) return;
    e.sites ??= new Map(); const key = `${kind}: ${k}`; e.sites.set(key, (e.sites.get(key) || 0) + 1); };
  wrap(GPUQueue.prototype, 'onSubmittedWorkDone', function (o, a) {
    const e = queueDev.get(this); if (e) { e.c.workDone++; countSite(e, 'workDone'); }
    return Reflect.apply(o, this, a);
  });
  // Object creation per device (GPU-process work besides command recording).
  for (const name of ['createBindGroup', 'createBuffer', 'createTexture', 'createQuerySet', 'createShaderModule',
    'createComputePipeline', 'createBindGroupLayout', 'createPipelineLayout', 'createCommandEncoder']) {
    wrap(GPUDevice.prototype, name, function (o, a) {
      const e = entryFor(this); if (e) { e.created ??= {}; e.created[name] = (e.created[name] || 0) + 1; }
      return Reflect.apply(o, this, a); });
  }
  wrap(GPUBuffer.prototype, 'destroy', function (o, a) {
    for (const e of G.devices) { e.created ??= {}; e.created.destroyBuffer = (e.created.destroyBuffer || 0) + 1; }
    return Reflect.apply(o, this, a); });
  for (const name of ['popErrorScope', 'createComputePipelineAsync', 'createRenderPipelineAsync']) {
    wrap(GPUDevice.prototype, name, function (o, a) { countSite(entryFor(this), name); return Reflect.apply(o, this, a); });
  }
  wrap(GPUBuffer.prototype, 'mapAsync', function (o, a) {
    // Buffers do not expose their device; count against every device (one is busy).
    for (const e of G.devices) e.c.mapAsync++;
    countSite(G.devices.find(x => x.c.computePasses > 0) || G.devices[0], 'mapAsync');
    return Reflect.apply(o, this, a);
  });
  G.reset = () => { for (const e of G.devices) { e.c = fresh(); e.labels = new Map(); e.indirect = new Map(); e.sites = new Map(); e.created = {}; e.ns = new Map(); e.nsCount = new Map(); } };
  G.snapshot = () => G.devices.map(e => ({ lost: e.lost ?? null, counters: { ...e.c },
    labels: Object.fromEntries([...e.labels].sort((x, y) => y[1] - x[1])),
    indirect: Object.fromEntries([...(e.indirect || new Map())].sort((x, y) => y[1] - x[1])),
    sites: Object.fromEntries([...(e.sites || new Map())].sort((x, y) => y[1] - x[1]).slice(0, 40)),
    created: { ...(e.created || {}) },
    ns: Object.fromEntries([...e.ns].sort((x, y) => y[1] - x[1])),
    nsCount: Object.fromEntries(e.nsCount) }));
};

const appRow = () => {
  const overlay = document.querySelector('#sph-phase-overlay');
  const lane = overlay?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
  return {
    fps: document.querySelector('#sph-fps')?.textContent ?? '',
    play: document.querySelector('#sph-play')?.textContent ?? '',
    rebuild: overlay?.__sphPhaseRebuildWorker?.status ?? null,
    laneSteps: lane?.laneCompletedStepTotal ?? null,
    laneSimTimeS: lane?.laneSimTimeS ?? null,
    scheduleId: lane?.scheduleId ?? null,
    completedStepCount: lane?.completedStepCount ?? null,
    scheduleFirstStepStartedAtMs: lane?.scheduleFirstStepStartedAtMs ?? null,
    scheduleLastStepEndedAtMs: lane?.scheduleLastStepEndedAtMs ?? null,
    tailTerminalFenceDoneAtMs: lane?.tailTerminalFenceDoneAtMs ?? null,
    resultAssembledAtMs: lane?.resultAssembledAtMs ?? null
  };
};
const simT = fps => Number(fps.match(/sim t ([0-9.]+)s/)?.[1] ?? NaN);

let browser;
try {
  await mkdir(outDir, { recursive: true });
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
    args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-webgpu-developer-features'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.addInitScript(hook);
  const workers = [];
  page.on('worker', worker => { workers.push(worker); evidence.workers.push(worker.url());
    void worker.evaluate(hook).catch(error => evidence.errors.push(`hook ${String(error).slice(0, 200)}`)); });
  page.on('pageerror', error => evidence.errors.push(String(error).slice(0, 400)));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) evidence.console.push(message.text().slice(0, 400));
  });
  const contexts = () => [{ name: 'page', target: page },
    ...workers.map(worker => ({ name: worker.url().split('/').pop().split('?')[0], target: worker }))];
  const inAll = async fn => {
    const out = [];
    for (const { name, target } of contexts()) {
      const value = await target.evaluate(fn).catch(() => null);
      if (value && value.length) out.push({ context: name, devices: value });
    }
    return out;
  };
  const sample = async phase => {
    const row = { phase, at: (Date.now() - started.getTime()) / 1000, ...(await page.evaluate(appRow)) };
    row.simTimeS = simT(row.fps);
    evidence.samples.push(row);
    return row;
  };
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(2000);
    const row = await sample('warmup');
    console.log(JSON.stringify({ warmup: row.at.toFixed(0), rebuild: row.rebuild, play: row.play, simTimeS: row.simTimeS,
      laneSteps: row.laneSteps }));
    if (!evidence.playClickedAt && row.rebuild === 'complete' && row.play === 'Play') {
      await page.locator('#sph-play').click({ timeout: 5000 }); evidence.playClickedAt = row.at;
    }
    if (row.simTimeS > 0.002) break;
  }
  if (!(evidence.samples.at(-1).simTimeS > 0)) throw new Error('The app never started stepping');
  await page.waitForTimeout(10_000);
  for (const [name, timing] of [['A', false], ['B', true], ['C', false]]) {
    await inAll(() => { globalThis.__rtGap.timing = false; globalThis.__rtGap.reset(); return []; });
    if (timing) await inAll(() => { globalThis.__rtGap.timing = true; return []; });
    const begin = await sample(`${name}-begin`); const t0 = Date.now();
    while (Date.now() - t0 < windowMs) { await page.waitForTimeout(1000); await sample(name); }
    await inAll(() => { globalThis.__rtGap.timing = false; return []; });
    if (timing) await page.waitForTimeout(1500); // let injected readbacks land
    const end = await sample(`${name}-end`);
    const snapshot = await inAll(() => globalThis.__rtGap.snapshot());
    const pending = await inAll(() => [{ pending: globalThis.__rtGap.pending, errors: globalThis.__rtGap.readbackErrors,
      untimed: globalThis.__rtGap.untimed }]);
    const wallS = (Date.now() - t0) / 1000;
    const simS = end.simTimeS - begin.simTimeS;
    const laneSteps = end.laneSteps != null && begin.laneSteps != null ? end.laneSteps - begin.laneSteps : null;
    evidence.windows[name] = { timing, wallS, simS, steps: laneSteps ?? Math.round(simS / 0.0005),
      stepsSource: laneSteps != null ? 'lane' : 'simT/0.5ms', snapshot, pending };
    console.log(JSON.stringify({ window: name, timing, wallS: wallS.toFixed(1), simS: simS.toFixed(4),
      steps: evidence.windows[name].steps, stepsPerS: (evidence.windows[name].steps / wallS).toFixed(2) }));
  }
  await page.screenshot({ path: `${outDir}/${tag}.png` });
} catch (error) {
  evidence.failure = error?.stack || String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  evidence.finished = new Date().toISOString();
  try {
    evidence.xid = execFileSync('journalctl', ['-k', '--since', `@${Math.floor(started.getTime() / 1000)}`, '--no-pager'],
      { encoding: 'utf8' }).split('\n').filter(line => /Xid/.test(line));
  } catch (error) { evidence.xidError = String(error); }
  await writeFile(`${outDir}/${tag}.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ out: `${outDir}/${tag}.json`, failure: evidence.failure?.slice(0, 400),
    xid: evidence.xid, errors: evidence.errors.slice(0, 4) }));
}
