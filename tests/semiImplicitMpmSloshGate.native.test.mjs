// A1 larger-dt slice, the physics-scored gate (plan/todo/a1-eshkol-coarse-dt.md).
// MPM's per-step transfers make "error against a finer-dt run" ill-posed (the
// finer run is differently filtered, not more converged), so the gate scores
// each run against physics: the first sloshing mode of a rectangular tank,
// omega^2 = g k tanh(k h), k = pi / L, fitted to the centre-of-mass x(t) as a
// damped sinusoid. Reports frequency against the analytic mode and against the
// explicit reference, damping, and the x(t) trajectory error.
//
// Run: ULG_RUN_NATIVE_SEMI_IMPLICIT_MPM=1 node --test tests/semiImplicitMpmSloshGate.native.test.mjs
// Env: SLOSH_RUNS (JSON [name, semi, dt, cgIterations, theta, rk2]), SLOSH_T (s),
//      SLOSH_SLOPE, SLOSH_GRID (32 or 64), SLOSH_SOUND (m/s).
import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SEMI_IMPLICIT_MPM === '1';
const BASE_URL = process.env.ULG_SEMI_IMPLICIT_MPM_BASE_URL || 'https://127.0.0.1:5173/';

/** Least-squares x(t) = c + e^{-g t} (a cos w t + b sin w t) by grid search on (w, g). */
export function fitDampedMode(t, x, omegaGuess) {
  const solve3 = (M, r) => {
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
      - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(M);
    return [0, 1, 2].map((k) => det(M.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)))) / D);
  };
  const residual = (w, g) => {
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], r = [0, 0, 0];
    const basis = t.map((ti) => [1, Math.exp(-g * ti) * Math.cos(w * ti), Math.exp(-g * ti) * Math.sin(w * ti)]);
    basis.forEach((f, n) => { for (let i = 0; i < 3; i += 1) { r[i] += f[i] * x[n]; for (let j = 0; j < 3; j += 1) M[i][j] += f[i] * f[j]; } });
    const coef = solve3(M, r);
    let e = 0;
    basis.forEach((f, n) => { const d = x[n] - (coef[0] * f[0] + coef[1] * f[1] + coef[2] * f[2]); e += d * d; });
    return { e, coef };
  };
  let best = { e: Infinity };
  let wLo = 0.5 * omegaGuess, wHi = 1.5 * omegaGuess, gLo = 0, gHi = 3;
  for (let round = 0; round < 4; round += 1) {
    const nw = 60, ng = 30;
    for (let i = 0; i <= nw; i += 1) {
      for (let j = 0; j <= ng; j += 1) {
        const w = wLo + (wHi - wLo) * i / nw, g = gLo + (gHi - gLo) * j / ng;
        const r = residual(w, g);
        if (r.e < best.e) best = { ...r, w, g };
      }
    }
    const dw = (wHi - wLo) / 60 * 2, dg = (gHi - gLo) / 30 * 2;
    wLo = best.w - dw; wHi = best.w + dw; gLo = Math.max(0, best.g - dg); gHi = best.g + dg;
  }
  const amplitude = Math.hypot(best.coef[1], best.coef[2]);
  const rms = Math.sqrt(x.reduce((s, xi) => s + (xi - best.coef[0]) ** 2, 0) / x.length);
  return { omega: best.w, gamma: best.g, amplitude, mean: best.coef[0],
    fitResidualRelative: Math.sqrt(best.e / x.length) / Math.max(rms, 1e-12) };
}

test('sloshing-mode gate: coarse-dt semi-implicit against physics and the explicit scheme', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SEMI_IMPLICIT_MPM=1 to run on native WebGPU',
  timeout: 1_200_000
}, async () => {
  const T = Number(process.env.SLOSH_T || 3);
  const slope = Number(process.env.SLOSH_SLOPE || 0.05);
  const gridN = Number(process.env.SLOSH_GRID || 32);
  const soundSpeed = Number(process.env.SLOSH_SOUND || 25);
  const sampleDt = 0.008; // a multiple of every dt in the sweep
  const runs = process.env.SLOSH_RUNS ? JSON.parse(process.env.SLOSH_RUNS) : [
    ['explicit-0.125ms', false, 0.000125],
    ['explicit-0.25ms', false, 0.00025],
    ['explicit-0.5ms', false, 0.0005],
    ['semi-1ms', true, 0.001, 10, 1],
    ['semi-2ms', true, 0.002, 10, 1],
    ['semi-4ms', true, 0.004, 10, 1]
  ];
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let out;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    out = await page.evaluate(async ({ runs, T, slope, gridN, soundSpeed, sampleDt }) => {
      let adapter = null;
      for (let i = 0; i < 5 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 500));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice({ requiredLimits: {
        maxStorageBuffersPerShaderStage: Math.min(16, adapter.limits.maxStorageBuffersPerShaderStage) } });
      device.pushErrorScope('validation');
      const proto = await import('/tests/fixtures/semiImplicitMpmPrototype.js');
      const results = {};
      // The fluid fills the box between the zero-velocity wall planes.
      const hi = (gridN - 1 - gridN / 16) / gridN;
      for (const [name, semiImplicit, dt, iterations = 10, theta = 1, rk2 = false] of runs) {
        const started = performance.now();
        const state = await proto.runSemiImplicitMpmPrototype(device, {
          semiImplicit, dt, steps: Math.round(T / dt), soundSpeed, gridN, wallMarginNodes: gridN / 16,
          jacobiIterations: iterations, theta, rk2, equalityWalls: true,
          block: { min: [0.0625, 0.0625, 0.0625], max: [hi, 0.5, hi] }, surface: { h0: 0.22, slope },
          sampleEverySteps: Math.round(sampleDt / dt) });
        const summary = proto.summarizeSemiImplicitMpmState(state);
        results[name] = { dt, count: state.count, samples: state.samples, finite: summary.finite,
          meanJ: summary.meanJ, ms: performance.now() - started };
      }
      const validation = await device.popErrorScope();
      device.destroy();
      return { status: 'ran', results, validation: validation?.message ?? null };
    }, { runs, T, slope, gridN, soundSpeed, sampleDt });
  } finally {
    await browser.close();
  }
  assert.equal(out.status, 'ran');
  assert.equal(out.validation, null, out.validation);
  // Tank: between the wall planes at 0.0625 and (n - 1 - n/16) / n; floor at 0.0625.
  const g = 9.81, L = (gridN - 1 - gridN / 16) / gridN - 0.0625, h = 0.22 - 0.0625, k = Math.PI / L;
  const omegaAnalytic = Math.sqrt(g * k * Math.tanh(k * h));
  const names = Object.keys(out.results);
  const fits = Object.fromEntries(names.map((name) => {
    const s = out.results[name].samples;
    return [name, fitDampedMode(s.map((q) => q.t), s.map((q) => q.comX), omegaAnalytic)];
  }));
  const ref = names[0];
  const refX = out.results[ref].samples.map((q) => q.comX);
  const report = {};
  for (const name of names) {
    const f = fits[name], s = out.results[name].samples;
    const xs = s.map((q) => q.comX);
    const n = Math.min(xs.length, refX.length);
    let se = 0;
    for (let i = 0; i < n; i += 1) se += (xs[i] - refX[i]) ** 2;
    const e0 = s[0].kinetic + s[0].potential, eT = s.at(-1).kinetic + s.at(-1).potential;
    report[name] = {
      finite: out.results[name].finite,
      omega: f.omega, gamma: f.gamma, amplitude: f.amplitude, fitResidual: f.fitResidualRelative,
      omegaVsAnalytic: f.omega / omegaAnalytic - 1,
      omegaVsReference: f.omega / fits[ref].omega - 1,
      trajectoryVsReference: Math.sqrt(se / n) / fits[ref].amplitude,
      energyLossJ: e0 - eT,
      comYDrift: s.at(-1).comY - s[0].comY,
      meanJ: out.results[name].meanJ,
      ms: Math.round(out.results[name].ms)
    };
  }
  console.log(JSON.stringify({ T, slope, gridN, soundSpeed, particles: out.results[ref].count, omegaAnalytic, report }));
  if (process.env.SLOSH_OUT) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.SLOSH_OUT, JSON.stringify({ omegaAnalytic, fits,
      samples: Object.fromEntries(names.map((name) => [name, out.results[name].samples])) }));
  }
  for (const name of names) assert.equal(report[name].finite, true, name);
});
