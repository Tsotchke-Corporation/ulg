// G2 Phase 0: run the exact-ledger probe inside the live Iron Ice app, on the
// GPUDevice the app is simulating and presenting with, while it plays.
//
//   node scripts/g2-ledger-live-probe.mjs [--steps 1000] [--interval ms] [--out dir]
//
// The dev server must be running (npm run dev). The run records the app's
// own step and presentation rates before, during and after the probe, the
// probe's fixed-size evidence and host verification, and every NVIDIA Xid
// line the kernel logged while the browser was open.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  createSphExactLedgerProbeFixture, verifySphExactLedgerProbeEvidence
} from '../tests/fixtures/sphExactLedgerProbeNative.js';

const argument = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : fallback;
};
const steps = Number(argument('steps', 1000));
const batchSteps = Number(argument('batch', 8));
const stepIntervalMs = Number(argument('interval', 0));
const baseUrl = argument('base', 'https://127.0.0.1:5173/');
const outDir = argument('out', join(homedir(), '.cache/icc/repos/ulg/g2-ledger-phase0-20261027'));
const tag = argument('tag', `live-${steps}`);
const appUrl = new URL('pages.html?scenario=iron-ice-quench&residentAuto=1&residentGpuTimestampFeature=1', baseUrl).href;

const started = new Date();
const evidence = { schema: 'ulg.g2-ledger-live-probe.v1', started: started.toISOString(), appUrl, steps, batchSteps,
  stepIntervalMs,
  appSamples: [], workers: [], pageErrors: [], console: [] };

// Installed in every context: remembers each GPUDevice that encodes work.
const captureDevices = () => {
  if (globalThis.__g2LedgerDevices) return;
  const devices = globalThis.__g2LedgerDevices = [];
  const original = GPUDevice.prototype.createCommandEncoder;
  GPUDevice.prototype.createCommandEncoder = function (...args) {
    let entry = devices.find(item => item.device === this);
    if (!entry) { entry = { device: this, encoders: 0, lost: null }; devices.push(entry);
      this.lost.then(info => { entry.lost = `${info.reason}: ${info.message}`; }); }
    entry.encoders++;
    return Reflect.apply(original, this, args);
  };
};
const deviceCensus = () => (globalThis.__g2LedgerDevices || []).map(item => ({
  encoders: item.encoders, lost: item.lost, features: [...item.device.features] }));
const appRow = () => ({
  fps: document.querySelector('#sph-fps')?.textContent ?? '',
  play: document.querySelector('#sph-play')?.textContent ?? '',
  rebuild: document.querySelector('#sph-phase-overlay')?.__sphPhaseRebuildWorker?.status ?? null,
  stepsError: document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentStepsError ?? null
});
const parseRates = fps => ({
  physicsStepsPerS: Number(fps.match(/physics ([0-9.]+) steps\/s/)?.[1] ?? NaN),
  presentedStatesPerS: Number(fps.match(/presented ([0-9.]+) states\/s/)?.[1] ?? NaN),
  rafPerS: Number(fps.match(/ui raf ([0-9.]+) callbacks\/s/)?.[1] ?? NaN),
  simTimeS: Number(fps.match(/sim t ([0-9.]+)s/)?.[1] ?? NaN)
});

let browser;
try {
  await mkdir(outDir, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.ULG_LEDGER_CHROME || '/usr/bin/google-chrome',
    headless: false, args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-webgpu-developer-features'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.addInitScript(captureDevices);
  const workers = [];
  page.on('worker', worker => {
    workers.push(worker); evidence.workers.push(worker.url());
    void worker.evaluate(captureDevices).catch(() => {});
  });
  page.on('pageerror', error => evidence.pageErrors.push(String(error)));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) evidence.console.push(message.text().slice(0, 600));
  });
  const sample = async phase => {
    const row = { phase, at: (Date.now() - started.getTime()) / 1000, ...(await page.evaluate(appRow)) };
    Object.assign(row, parseRates(row.fps));
    row.devices = [{ context: 'page', devices: await page.evaluate(deviceCensus) }];
    for (const worker of workers) {
      const devices = await worker.evaluate(deviceCensus).catch(() => null);
      if (devices?.length) row.devices.push({ context: worker.url().split('/').pop().split('?')[0], devices });
    }
    evidence.appSamples.push(row);
    console.log(JSON.stringify({ phase, at: row.at.toFixed(1), play: row.play,
      rates: row.fps.split('callbacks/s | ').pop(), encoders: row.devices.map(d => `${d.context}:${d.devices.map(x => x.encoders)}`) }));
    return row;
  };

  await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // Warm up: play once the rebuild completes, then wait for real steps.
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(2000);
    const row = await sample('warmup');
    if (!evidence.playClickedAt && row.rebuild === 'complete' && row.play === 'Play') {
      await page.locator('#sph-play').click({ timeout: 5000 }); evidence.playClickedAt = row.at;
    }
    if (row.physicsStepsPerS > 0 && row.simTimeS > 0) break;
  }
  const stepping = evidence.appSamples.at(-1);
  if (!(stepping.physicsStepsPerS > 0)) throw new Error('The app never started stepping; no probe was run');
  for (let i = 0; i < 5; i++) { await page.waitForTimeout(2000); await sample('before'); }

  // The busiest device is the one the app simulates and presents with.
  const census = evidence.appSamples.at(-1).devices.flatMap(entry =>
    entry.devices.map((device, index) => ({ context: entry.context, index, ...device })));
  const chosen = census.sort((a, b) => b.encoders - a.encoders)[0];
  evidence.probeDevice = chosen;
  const target = chosen.context === 'page' ? page
    : workers.find(worker => worker.url().split('/').pop().split('?')[0] === chosen.context);
  if (!target) throw new Error(`No context for device ${JSON.stringify(chosen)}`);

  let probeDone = false;
  const sampler = (async () => {
    while (!probeDone) { await page.waitForTimeout(2000); if (!probeDone) await sample('during'); }
  })();
  const probeStarted = Date.now();
  evidence.probe = await target.evaluate(async ({ index, steps, batchSteps, stepIntervalMs }) => {
    const entry = globalThis.__g2LedgerDevices[index];
    const encodersBefore = entry.encoders;
    const probe = await import('/tests/fixtures/sphExactLedgerProbeNative.js');
    const result = await probe.runSphExactLedgerProbe(entry.device, { steps, batchSteps, stepIntervalMs,
      errorScopes: false, label: 'g2-ledger-probe' });
    // Encoders the app created while the probe ran (the probe uses 1 per step).
    result.appEncodersDuringProbe = entry.encoders - encodersBefore - steps - 2;
    result.deviceLostAfter = entry.lost;
    return result;
  }, { index: chosen.index, steps, batchSteps, stepIntervalMs });
  evidence.probeWallMs = Date.now() - probeStarted;
  probeDone = true;
  await sampler;
  for (let i = 0; i < 5; i++) { await page.waitForTimeout(2000); await sample('after'); }
  await page.screenshot({ path: join(outDir, `${tag}.png`) });
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
  if (evidence.probe) {
    evidence.verification = verifySphExactLedgerProbeEvidence(evidence.probe, createSphExactLedgerProbeFixture());
    const rates = phase => evidence.appSamples.filter(row => row.phase === phase);
    const mean = (rows, key) => rows.length ? rows.reduce((sum, row) => sum + row[key], 0) / rows.length : null;
    evidence.appRates = Object.fromEntries(['before', 'during', 'after'].map(phase => [phase, {
      samples: rates(phase).length, physicsStepsPerS: mean(rates(phase), 'physicsStepsPerS'),
      presentedStatesPerS: mean(rates(phase), 'presentedStatesPerS'), rafPerS: mean(rates(phase), 'rafPerS'),
      simTimeS: rates(phase).at(-1)?.simTimeS ?? null }]));
  }
  evidence.gate = {
    noXid: Array.isArray(evidence.xid) && evidence.xid.length === 0,
    bitExact: evidence.verification?.passed === true,
    appKeptStepping: (evidence.appRates?.after?.simTimeS ?? 0) > (evidence.appRates?.before?.simTimeS ?? Infinity),
    ledgerOnlyPassesPerStep: evidence.probe?.ledgerOnlyPasses?.length ?? null
  };
  await writeFile(join(outDir, `${tag}.json`), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ out: join(outDir, `${tag}.json`), gate: evidence.gate, failure: evidence.failure,
    probeException: evidence.probe?.exception, probeErrors: evidence.probe?.gpuErrors, xid: evidence.xid,
    timing: evidence.probe?.timing, stepGpuSpan: evidence.probe?.stepGpuSpan, appRates: evidence.appRates,
    checks: evidence.verification?.checks }, null, 1));
}
