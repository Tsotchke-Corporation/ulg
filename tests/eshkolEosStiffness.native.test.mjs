// Native gate for the A1 larger-dt slice, step 2: Eshkol automatic
// differentiation (the warm client VM worker, A6) derives K(rho) = rho dp/drho
// of the GPU's packed EOS programs; the A4 fit must reproduce it within its
// tolerance and Eshkol's AD must match the analytic derivative.
//
// Run: ULG_RUN_NATIVE_ESHKOL_EOS=1 node --test tests/eshkolEosStiffness.native.test.mjs
// (HTTPS dev server on 5173; override with ULG_ESHKOL_EOS_BASE_URL.)
import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_ESHKOL_EOS === '1';
const BASE_URL = process.env.ULG_ESHKOL_EOS_BASE_URL || 'https://127.0.0.1:5173/';

test('Eshkol AD derives the packed EOS stiffness exactly enough for the A4 fit', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_ESHKOL_EOS=1 to run against the Eshkol WASM worker'
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let out;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    out = await page.evaluate(async () => {
      const { deriveEosStiffnessResponse, ESHKOL_EOS_MODEL } = await import('/src/runtime/material/eshkolEosStiffness.js');
      const { evaluateResponseFunction } = await import('/src/runtime/material/localClosureFitCache.js');
      const worker = new Worker('/workers/eshkol-warm-vm.worker.js');
      let nextId = 1;
      const sample = (definition, call, points) => new Promise((resolve, reject) => {
        const id = nextId++;
        const onMessage = (event) => {
          if (event.data?.id !== id) return;
          worker.removeEventListener('message', onMessage);
          if (event.data.ok) resolve(event.data.samples);
          else reject(new Error(event.data.error));
        };
        worker.addEventListener('message', onMessage);
        worker.postMessage({ id, type: 'sample', definition, call, points });
      });
      const results = {};
      // Water-like liquid (Tait) and an ideal-gas-like phase at reduced CFL sound speeds.
      for (const [name, eosModel, rho0, c] of [['tait', ESHKOL_EOS_MODEL.TAIT, 998, 7.5],
        ['gas', ESHKOL_EOS_MODEL.LINEAR_GAS, 1.204, 40]]) {
        const started = performance.now();
        const derived = await deriveEosStiffnessResponse({ sample, eosModel, restDensityKgPerM3: rho0, soundSpeedMPerS: c });
        const probes = [0.93, 1.0, 1.06].map((f) => {
          const rho = f * rho0;
          const r = evaluateResponseFunction(derived.responseFunction, [rho]);
          const exact = eosModel === ESHKOL_EOS_MODEL.TAIT ? rho * c * c * (rho / rho0) ** 6 : rho * c * c;
          return { rho, ok: r.ok, relativeError: Math.abs(r.value - exact) / exact };
        });
        results[name] = { crossCheck: derived.crossCheckMaxRelativeError, sampleCount: derived.sampleCount,
          residualBound: derived.responseFunction.residuals.relativeBound, probes, ms: performance.now() - started };
      }
      worker.terminate();
      return results;
    });
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(out));
  for (const [name, result] of Object.entries(out)) {
    assert.ok(result.crossCheck <= 1e-9, `${name}: Eshkol AD vs analytic derivative ${result.crossCheck}`);
    assert.ok(result.residualBound <= 1e-6, `${name}: fit residual bound ${result.residualBound}`);
    for (const probe of result.probes) {
      assert.equal(probe.ok, true);
      assert.ok(probe.relativeError <= 1e-6, `${name} at ${probe.rho}: ${probe.relativeError}`);
    }
  }
});
