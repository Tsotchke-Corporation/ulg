import assert from 'node:assert/strict';
import test from 'node:test';

// G2 Phase 6 optics gate (plan/todo/g2-integer-ledger-proposal.md): the
// parcel optics pass adds each parcel's extinction to the H2O collective
// route in the render field's units. For a parcel inside the box, the sum of
// tau * edge^2 over render cells equals its f64 cross-section N pi r^2 Q
// (anomalous diffraction, n = 1.333, 550 nm), the asymmetry lane is 0.85 tau,
// the absorption lane is untouched, and the temperature lane becomes the
// extinction-weighted mean of the prior medium and the parcel.
// ULG_RUN_NATIVE_LEDGER_PARCEL_OPTICS=1, with the HTTPS dev server running.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_LEDGER_PARCEL_OPTICS === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

function extinctionEfficiency(r) {
  const x = 2 * Math.PI * r / 550e-9, rho = 2 * x * 0.333;
  return 2 - 4 / rho * Math.sin(rho) + 4 / (rho * rho) * (1 - Math.cos(rho));
}

test('native Vulkan parcel optics deposit the f64 cross-section in render-field units', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_LEDGER_PARCEL_OPTICS=1 for native Vulkan WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(
      async () => Boolean(await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' })),
      null,
      { timeout: 10_000, polling: 250 }
    );
    const run = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const errors = [];
      // Capped: an invalid shader raises one error per dispatch, and an uncapped
      // list returned to node exhausted memory (OOM, 2026-11-14).
      let errorCount = 0;
      device.addEventListener('uncapturederror', e => { if (errorCount++ < 20) errors.push(String(e.error?.message ?? e).slice(0, 500)); });
      const optics = await import('/src/runtime/sph/sphLedgerParcelOpticsGpu.js');
      const res = 32, padding = 0.05, refEdgeM = 5, fieldOffset = 7;
      const cells = res ** 3;
      // A second route occupies cells [0, fieldOffset) so the offset is exercised.
      const rows = new Float32Array((fieldOffset + cells) * 8);
      // One prior medium cell at the parcel's node: tau_s 0.5, tau_a 0.25, T 500 K.
      const priorCell = 16 + 16 * res + 16 * res * res;
      rows.set([500, 0.5, 0.25, 0.1], (fieldOffset + priorCell) * 8 + 4);
      const field = device.createBuffer({ size: rows.byteLength, usage: 0x80 | 0x04 | 0x08 });
      device.queue.writeBuffer(field, 0, rows);
      // Parcel A interior (2.5 m), parcel B with zero radius (skipped).
      const parcels = new Float32Array([2.5, 2.5, 2.5, 1e9, 1770, 0.61, 290, 8e-6,
        1.0, 1.0, 1.0, 1e9, 1770, 0.61, 290, 0]);
      const paramsBuffer = device.createBuffer({ size: parcels.byteLength, usage: 0x80 | 0x08 });
      device.queue.writeBuffer(paramsBuffer, 0, parcels);
      const family = { count: 2, paramsBuffer, boxDimensionsM: [5, 5, 5], cellsPerAxis: 2 };
      const encoder = device.createCommandEncoder();
      const uniform = optics.encodeSphLedgerParcelOpticsWebGpu({ device, encoder, parcels: family,
        fieldRowsBuffer: field, fieldOffset, resolution: res, fieldPadding: padding, refEdgeM });
      const copy = device.createBuffer({ size: rows.byteLength, usage: 1 | 8 });
      encoder.copyBufferToBuffer(field, 0, copy, 0, rows.byteLength);
      device.queue.submit([encoder.finish()]);
      await copy.mapAsync(1);
      const out = Array.from(new Float32Array(copy.getMappedRange().slice(0)));
      copy.unmap(); uniform.destroy(); device.destroy();
      return { status: 'ran', errors, out, res, padding, refEdgeM, fieldOffset, priorCell };
    });
    assert.notEqual(run.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.deepEqual(run.errors, [], 'no GPU validation errors');
    const { out, res, padding, refEdgeM, fieldOffset, priorCell } = run;
    for (let i = 0; i < fieldOffset * 8; i++) assert.equal(out[i], 0, 'the other route is untouched');
    const edge = refEdgeM / ((1 - 2 * padding) * res);
    let tauSum = 0, asymSum = 0;
    for (let c = 0; c < res ** 3; c++) {
      const row = (fieldOffset + c) * 8;
      assert.equal(out[row], 0, 'density lane untouched');
      if (c === priorCell) continue;
      assert.equal(out[row + 6], 0, 'no absorption from water droplets');
      tauSum += out[row + 5]; asymSum += out[row + 7];
      if (out[row + 5] > 0) assert.ok(Math.abs(out[row + 4] - 290) < 1e-3, 'parcel-only cell carries the parcel T');
    }
    const r = 8e-6, sigma = 1e9 * Math.PI * r * r * extinctionEfficiency(r);
    const prior = (fieldOffset + priorCell) * 8;
    const added = out[prior + 5] - 0.5;
    tauSum += added; asymSum += out[prior + 7] - 0.1;
    // f64 mirror of the node-sampled tent: node i sits at (i/res - padding) * ref / span.
    const h = 2.5, tent = d => Math.max(0, 1 - Math.abs(d) / h) / h;
    let axisSum = 0;
    for (let i = 0; i < res; i++) axisSum += tent((i / res - padding) * refEdgeM / (1 - 2 * padding) - 2.5);
    const mirror = sigma * (axisSum * edge) ** 3;
    assert.ok(Math.abs(tauSum * edge * edge / mirror - 1) < 1e-4, `sum tau edge^2 ${tauSum * edge * edge} vs f64 node sum ${mirror}`);
    // The node sum differs from the tent's integral by O((edge/h)^2) when its
    // kinks fall between nodes; at h = 14.4 edges that stays well under 1%.
    assert.ok(Math.abs(mirror / sigma - 1) < 1e-2, `node discretization ${mirror / sigma - 1}`);
    assert.ok(Math.abs(asymSum / tauSum - 0.85) < 1e-5, 'asymmetry lane is 0.85 tau');
    assert.equal(out[prior + 6], 0.25, 'prior absorption kept');
    const expectedT = (500 * 0.75 + 290 * added) / (0.75 + added);
    assert.ok(Math.abs(out[prior + 4] - expectedT) < 1e-3, `extinction-weighted T ${out[prior + 4]} vs ${expectedT}`);
  } finally { await browser.close(); }
});
