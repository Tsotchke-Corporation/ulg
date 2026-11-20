// A1 coarse-dt error harness (the 1% budget for Eshkol-derived larger-dt
// operators, user decision 2026-11-15). Runs one scenario at several dt,
// captures the exact particle state at the same simulated time (the lane
// fingerprint, copied in queue order at step round(T/dt)), and compares each
// coarser run against the finest: position, momentum, kinetic and internal
// energy. State layout per particle: x, y, z, mass, vx, vy, vz, u.
//   node scripts/a1-coarse-dt-error.mjs <scenario> <T seconds> <dt list> [extraQuery]
//   e.g. node scripts/a1-coarse-dt-error.mjs water-cycle 0.2 0.0005,0.001,0.002
// Env: A1DT_OUT (JSON receipt path), A1DT_TIMEOUT_MS per run.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const scenario = process.argv[2] || 'water-cycle';
const simTimeS = Number(process.argv[3] || 0.2);
const dts = String(process.argv[4] || '0.0005,0.001').split(',').map(Number).sort((a, b) => a - b);
const extra = process.argv[5] || '';
// A1DT_RUNS: JSON [[dt, extraQuery], ...] (first = reference) to compare runs
// that differ in more than dt (e.g. the implicit-pressure flag).
const runs = process.env.A1DT_RUNS ? JSON.parse(process.env.A1DT_RUNS) : dts.map((dt) => [dt, extra]);
const timeoutMs = Number(process.env.A1DT_TIMEOUT_MS || 400000);

async function captureAt(dt, runExtra = extra) {
  const targetStep = Math.round(simTimeS / dt);
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: process.env.ULG_HEADED !== '1',
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  try {
    const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } })).newPage();
    const workers = [];
    page.on('worker', (w) => {
      workers.push(w);
      w.evaluate(([step]) => {
        globalThis.__ulgFingerprintStep = step;
        globalThis.__ulgFingerprintExport = true;
      }, [targetStep]).catch(() => {});
    });
    // A1DT_FIXED_CFL_AT_1MS: pin the effective sound speed (cflSafety * L / dt)
    // across dt by scaling cflSafety with dt, so runs differ only in time
    // integration, not in stiffness.
    const fixedCfl = Number(process.env.A1DT_FIXED_CFL_AT_1MS || 0);
    const cflQuery = fixedCfl > 0 ? `&cflSafety=${+(fixedCfl * dt / 0.001).toPrecision(6)}` : '';
    await page.goto(new URL(`pages.html?scenario=${scenario}&residentAuto=1&sdt=${dt}${cflQuery}${runExtra}`,
      'https://127.0.0.1:5173/').href, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      await page.waitForTimeout(2000);
      const row = await page.evaluate(() => ({ play: document.querySelector('#sph-play')?.textContent,
        rebuild: document.querySelector('#sph-phase-overlay')?.__sphPhaseRebuildWorker?.status }));
      if (row.rebuild === 'complete' && row.play === 'Play') {
        await page.locator('#sph-play').click({ timeout: 5000 }).catch(() => {});
      }
      for (const w of workers) {
        const result = await w.evaluate(() => globalThis.__ulgLaneFingerprint?.read?.() ?? null).catch(() => null);
        if (result?.raw?.state) return { dt, targetStep, wallS: (Date.now() - started) / 1000, ...result };
        const missed = await w.evaluate(() => globalThis.__ulgLaneFingerprint?.missed ?? null).catch(() => null);
        if (missed) return { dt, targetStep, error: `target inside an adopted sequence (${JSON.stringify(missed)})` };
      }
    }
    return { dt, targetStep, error: 'timed out before the fingerprint step' };
  } finally {
    await browser.close();
  }
}

function summarize(capture) {
  const s = capture.raw.state;
  const n = s.length / 8;
  let mass = 0, px = 0, py = 0, pz = 0, ke = 0, ie = 0, speed2 = 0;
  for (let i = 0; i < n; i += 1) {
    const o = i * 8, m = s[o + 3];
    if (!(m > 0)) continue;
    mass += m; px += m * s[o + 4]; py += m * s[o + 5]; pz += m * s[o + 6];
    const v2 = s[o + 4] ** 2 + s[o + 5] ** 2 + s[o + 6] ** 2;
    ke += 0.5 * m * v2; ie += m * s[o + 7]; speed2 += m * v2;
  }
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i += 1) {
    const o = i * 8, m = s[o + 3];
    if (!(m > 0)) continue;
    cx += m * s[o]; cy += m * s[o + 1]; cz += m * s[o + 2];
  }
  const speeds = [];
  for (let i = 0; i < n; i += 1) {
    const o = i * 8;
    if (s[o + 3] > 0) speeds.push(Math.hypot(s[o + 4], s[o + 5], s[o + 6]));
  }
  speeds.sort((a, b) => a - b);
  return { n, mass, momentum: [px, py, pz], kineticJ: ke, internalJ: ie, rmsSpeed: Math.sqrt(speed2 / mass),
    centerOfMass: [cx / mass, cy / mass, cz / mass],
    speedP99: speeds[Math.floor(0.99 * (speeds.length - 1))] ?? null, speedMax: speeds.at(-1) ?? null };
}

function compare(fine, coarse) {
  const a = fine.raw.state, b = coarse.raw.state;
  if (a.length !== b.length) return { comparable: false, reason: `particle counts differ (${a.length / 8} vs ${b.length / 8})` };
  const n = a.length / 8;
  let num = 0, mass = 0, maxDx = 0;
  for (let i = 0; i < n; i += 1) {
    const o = i * 8, m = a[o + 3];
    if (!(m > 0)) continue;
    const d2 = (a[o] - b[o]) ** 2 + (a[o + 1] - b[o + 1]) ** 2 + (a[o + 2] - b[o + 2]) ** 2;
    num += m * d2; mass += m; maxDx = Math.max(maxDx, Math.sqrt(d2));
  }
  const fs = summarize(fine), cs = summarize(coarse);
  const pScale = fs.mass * Math.max(fs.rmsSpeed, 1e-9);
  const dp = Math.hypot(...fs.momentum.map((p, k) => p - cs.momentum[k]));
  // Motion scale over the interval: rms speed x T (positions error relative to it).
  const motionM = Math.max(fs.rmsSpeed * simTimeS, 1e-9);
  const positionRmsM = Math.sqrt(num / mass);
  return {
    comparable: true,
    positionRmsM, positionMaxM: maxDx,
    positionRelativeToMotion: positionRmsM / motionM,
    centerOfMassRelativeToMotion: Math.hypot(...fs.centerOfMass.map((c, k) => c - cs.centerOfMass[k])) / motionM,
    momentumRelative: dp / pScale,
    kineticRelative: Math.abs(cs.kineticJ - fs.kineticJ) / Math.max(fs.kineticJ, 1e-30),
    internalRelative: Math.abs(cs.internalJ - fs.internalJ) / Math.max(Math.abs(fs.internalJ), 1e-30),
    fine: fs, coarse: cs
  };
}

const captures = [];
for (const [dt, runExtra] of runs) {
  const capture = { ...(await captureAt(dt, runExtra)), extra: runExtra };
  const s = capture.raw?.state;
  const nonFinite = s ? s.filter((v) => !Number.isFinite(v)).length : null;
  console.log(JSON.stringify({ dt, extra: runExtra, targetStep: capture.targetStep, wallS: capture.wallS,
    error: capture.error ?? null, particles: s ? s.length / 8 : null, nonFinite,
    stateHash: capture.state?.hash ?? null, summary: s && !nonFinite ? summarize(capture) : null }));
  captures.push(capture);
}
const fine = captures[0];
const rows = captures.slice(1).map((coarse) => ({ dt: coarse.dt, extra: coarse.extra,
  ...(fine.raw && coarse.raw ? compare(fine, coarse) : { comparable: false, reason: coarse.error || fine.error }) }));
for (const row of rows) {
  const { fine: _f, coarse: _c, ...brief } = row;
  console.log(JSON.stringify({ versus: fine.dt, ...brief }));
}
if (process.env.A1DT_OUT) {
  await writeFile(process.env.A1DT_OUT, JSON.stringify({ schema: 'peercompute.ulg.a1-coarse-dt-error.v1', scenario,
    simTimeS, dts, extra, rows, captures: captures.map(({ raw, ...rest }) => rest) }, null, 1));
}
