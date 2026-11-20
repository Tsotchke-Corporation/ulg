// A1 larger-dt slice, step 3 measurement (plan/todo/a1-eshkol-coarse-dt.md):
// the semi-implicit pressure prototype against the explicit scheme at one
// fixed sound speed, on a GPU dam break. Reports momentum, kinetic energy and
// centre-of-mass error of each run against the explicit fine-dt reference;
// asserts only stability (finite state) and records the 1%-budget verdict.
//
// Run: ULG_RUN_NATIVE_SEMI_IMPLICIT_MPM=1 node --test tests/semiImplicitMpm.native.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SEMI_IMPLICIT_MPM === '1';
const BASE_URL = process.env.ULG_SEMI_IMPLICIT_MPM_BASE_URL || 'https://127.0.0.1:5173/';

test('semi-implicit pressure holds the dam break at coarse dt (1% budget report)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SEMI_IMPLICIT_MPM=1 to run on native WebGPU',
  timeout: 600_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let out;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (process.env.SEMI_SWEEP) {
      await page.evaluate((sweep) => { globalThis.__semiSweep = sweep; }, JSON.parse(process.env.SEMI_SWEEP));
    }
    if (process.env.SEMI_SCENE) {
      await page.evaluate((scene) => { globalThis.__semiScene = scene; }, process.env.SEMI_SCENE);
    }
    out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 5 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 500));
      }
      if (!adapter) return { status: 'unsupported' };
      // The CG prototype binds ten storage buffers (default limit 8).
      const device = await adapter.requestDevice({ requiredLimits: {
        maxStorageBuffersPerShaderStage: Math.min(16, adapter.limits.maxStorageBuffersPerShaderStage)
        // (11 with the SSP-RK2 saved state)
      } });
      device.pushErrorScope('validation');
      const proto = await import('/tests/fixtures/semiImplicitMpmPrototype.js');
      const T = 0.3;
      const soundSpeed = 25; // c dt / dx = 0.2 at dt 0.25 ms on the 32^3 grid
      const sweep = (globalThis.__semiSweep ?? null);
      const runs = sweep ?? [
        ['explicit-0.25ms', false, 0.00025],
        ['semi-0.25ms', true, 0.00025],
        ['explicit-1ms', false, 0.001],
        ['semi-1ms', true, 0.001],
        ['semi-2ms', true, 0.002],
        ['semi-4ms', true, 0.004]
      ];
      const results = {};
      // __semiScene = 'slosh': a thin tank, tilted free surface, no splash.
      const scene = globalThis.__semiScene === 'slosh'
        ? { block: { min: [0.0625, 0.0625, 0.0625], max: [0.90625, 0.5, 0.90625] }, surface: { h0: 0.22, slope: 0.25 },
          equalityWalls: true }
        : {};
      for (const [name, semiImplicit, dt, iterations = 40, theta = 1, rk2 = false] of runs) {
        const started = performance.now();
        const state = await proto.runSemiImplicitMpmPrototype(device, { semiImplicit, dt, steps: Math.round(T / dt), soundSpeed,
          jacobiIterations: iterations, theta, rk2, ...scene });
        results[name] = { ...proto.summarizeSemiImplicitMpmState(state), dt, count: state.count,
          ms: performance.now() - started };
      }
      const validation = await device.popErrorScope();
      device.destroy();
      return { status: 'ran', T, soundSpeed, results, validation: validation?.message ?? null };
    });
  } finally {
    await browser.close();
  }
  assert.equal(out.status, 'ran');
  assert.equal(out.validation, null, out.validation);
  // The reference is the first run (default: explicit 0.25 ms).
  const ref = out.results[Object.keys(out.results)[0]];
  const motion = Math.max(Math.sqrt(2 * ref.kinetic / ref.mass) * out.T, 1e-9);
  const pScale = ref.mass * Math.sqrt(2 * ref.kinetic / ref.mass);
  const report = {};
  for (const [name, r] of Object.entries(out.results)) {
    report[name] = {
      finite: r.finite,
      momentumRelative: Math.hypot(...r.momentum.map((p, k) => p - ref.momentum[k])) / pScale,
      kineticRelative: Math.abs(r.kinetic - ref.kinetic) / ref.kinetic,
      centerOfMassRelative: Math.hypot(...r.centerOfMass.map((c, k) => c - ref.centerOfMass[k])) / motion,
      meanJ: r.meanJ,
      nonFiniteJ: r.nonFiniteJ,
      ms: Math.round(r.ms)
    };
  }
  console.log(JSON.stringify({ T: out.T, soundSpeed: out.soundSpeed, particles: ref.count, report }));
  if (!process.env.SEMI_SWEEP) {
    assert.equal(report['semi-0.25ms'].finite, true);
    assert.equal(report['semi-1ms'].finite, true);
  }
});
