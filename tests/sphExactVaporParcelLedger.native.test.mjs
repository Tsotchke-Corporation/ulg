import assert from 'node:assert/strict';
import test from 'node:test';

// G2 Phase 4 gate (plan/todo/g2-integer-ledger-proposal.md): vapor <-> parcel
// water exchange on the integer ledger. A manufactured supersaturated gas cell
// (S = 1.005 at 283.15 K) holds two H2O vapor carriers, one dry-air carrier
// and three aerosol parcels (activated, growing haze, and a small droplet
// that evaporates). Over 20 steps: vapor mass + parcel water is bit-exact and
// sum(U) over carriers and parcels is bit-exact (no sources). The step-1 GPU
// growth rate matches the same law evaluated in f64 at the same state.
// ULG_RUN_NATIVE_EXACT_VAPOR_PARCEL=1, with the HTTPS dev server running.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_EXACT_VAPOR_PARCEL === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('native Vulkan vapor-parcel exchange keeps water and energy bit-exact and matches its law', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_EXACT_VAPOR_PARCEL=1 for native Vulkan WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const { sphExactVaporParcelDropletRate } = await import('../src/runtime/sph/sphExactVaporParcelLedgerGpu.js');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const run = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const errors = [];
      // Capped: an invalid shader raises one error per dispatch, and an uncapped
      // list returned to node exhausted memory (OOM, 2026-11-14).
      let errorCount = 0;
      device.addEventListener('uncapturederror', e => { if (errorCount++ < 20) errors.push(String(e.error?.message ?? e).slice(0, 500)); });
      const vp = await import('/src/runtime/sph/sphExactVaporParcelLedgerGpu.js');
      const mass = await import('/ulg-gpu-abi/src/sphExactMassInventory.js');
      const signed = await import('/ulg-gpu-abi/src/sphExactSignedLedger.js');
      const format = mass.createSphExactMassFormat(); const W = format.wordCount;
      const T = 283.15, cell = 0.1, volume = cell ** 3, VAPOR = 501, AIR = 7;
      const es = vp.sphExactVaporParcelDropletRate({ r: 1e-6, rDry: 1e-7, kappa: 0.6, t: T, p: 101325, s: 1 }).saturationPa;
      const vaporTotal = 1.005 * es / (461.5 * T) * volume;
      const fr = Math.fround;
      // Gas rows: two vapor carriers (60/40) and one dry-air carrier.
      const gas = [
        { m: fr(vaporTotal * 0.6), u: fr(2.4e6), material: VAPOR },
        { m: fr(vaporTotal * 0.4), u: fr(2.41e6), material: VAPOR },
        { m: fr(1.25e-3), u: fr(2.03e5), material: AIR }];
      const state = new Float32Array(gas.length * 8), thermo = new Float32Array(gas.length * 12);
      gas.forEach((g, i) => { state.set([0.05, 0.05, 0.05, g.m, 0, 0, 0, g.u], i * 8);
        thermo.set([g.material, 3, T, 1], i * 12); });
      const gasMass = new Uint32Array(gas.length * W);
      const energyRecord = new Uint32Array(2 * gas.length * W + 4);
      gas.forEach((g, i) => { gasMass.set(mass.encodeSphExactMass(g.m, format), i * W);
        energyRecord.set(signed.encodeSphExactSigned(fr(g.m * g.u), format), i * W); });
      // Parcels: ammonium-sulfate-like cores (rho 1770, kappa 0.61), 1e6 droplets each.
      const U0 = 0, CW = 4186, uLiquid = fr(U0 + CW * (T - 273.15));
      const parcelsDef = [
        { rDry: 5e-8, r: 2e-6 },    // activated droplet: grows
        { rDry: 5e-8, r: 2.0e-7 },  // haze near equilibrium
        { rDry: 1e-8, r: 3e-8 }];   // tiny droplet: Kelvin term wins, evaporates
      const n = 1e6;
      const parcels = new Float32Array(parcelsDef.length * 8), ledger = new Uint32Array(parcelsDef.length * 3 * W);
      parcelsDef.forEach((pd, i) => {
        const md = 1770 * 4 / 3 * Math.PI * pd.rDry ** 3, mw = 1000 * (4 / 3 * Math.PI * pd.r ** 3 - md / 1770);
        parcels.set([0.05, 0.05, 0.05, n, 1770, 0.61, T, pd.r], i * 8);
        ledger.set(mass.encodeSphExactMass(fr(md * n), format), (i * 3) * W);
        ledger.set(mass.encodeSphExactMass(fr(mw * n), format), (i * 3 + 1) * W);
        ledger.set(signed.encodeSphExactSigned(fr(fr(mw * n) * uLiquid), format), (i * 3 + 2) * W);
      });
      const buffer = (data, usage = 0x80 | 0x04 | 0x08) => { const b = device.createBuffer({ size: data.byteLength, usage });
        device.queue.writeBuffer(b, 0, data); return b; };
      const gasStateBuffer = buffer(state), gasThermoBuffer = buffer(thermo), gasMassBuffer = buffer(gasMass);
      const gasEnergyBuffer = buffer(energyRecord), parcelBuffer = buffer(parcels), parcelLedgerBuffer = buffer(ledger);
      const stage = vp.createSphExactVaporParcelExchangeStage({ device, gasCount: gas.length, parcelCount: parcelsDef.length,
        dims: [1, 1, 1], origin: [0, 0, 0], cellSizeM: cell, vaporMaterialId: VAPOR, pressurePa: 101325, waterReferenceU0: U0,
        gasStateBuffer, gasThermoBuffer, gasMassBuffer, gasEnergyBuffer, parcelBuffer, parcelLedgerBuffer });
      const read = async (b) => { const c = device.createBuffer({ size: b.size, usage: 1 | 8 });
        const e = device.createCommandEncoder(); e.copyBufferToBuffer(b, 0, c, 0, b.size); device.queue.submit([e.finish()]);
        await c.mapAsync(1); const w = new Uint32Array(c.getMappedRange().slice(0)); c.unmap(); c.destroy(); return Array.from(w); };
      const snapshots = [{ gasMass: Array.from(gasMass), energy: Array.from(energyRecord), ledger: Array.from(ledger) }];
      let probe = null;
      for (let step = 0; step < 20; step++) {
        const encoder = device.createCommandEncoder(); stage.encode(encoder, 1e-3); device.queue.submit([encoder.finish()]);
        if (step === 0) probe = Array.from(new Float32Array(Uint32Array.from(await read(stage.probeBuffer)).buffer));
        snapshots.push({ gasMass: await read(gasMassBuffer), energy: await read(gasEnergyBuffer), ledger: await read(parcelLedgerBuffer) });
      }
      const parcelsAfter = Array.from(new Float32Array(Uint32Array.from(await read(parcelBuffer)).buffer));
      device.destroy();
      return { status: 'ran', W, gasCount: gas.length, parcelCount: parcelsDef.length, snapshots, probe, parcelsAfter, errors,
        T, parcelsDef, n };
    });
    assert.notEqual(run.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.deepEqual(run.errors, [], 'no GPU validation errors');
    const { W } = run;
    const big = (words, row) => words.slice(row * W, (row + 1) * W).reduceRight((v, w) => (v << 32n) | BigInt(w >>> 0), 0n);
    const sbig = (words, row) => { const v = big(words, row); return v >= 1n << BigInt(32 * W - 1) ? v - (1n << BigInt(32 * W)) : v; };
    const totals = snap => {
      let water = 0n, energy = 0n, sources = 0n;
      for (let g = 0; g < run.gasCount; g++) {
        if (g < 2) water += big(snap.gasMass, g);
        energy += sbig(snap.energy, g); sources += sbig(snap.energy, run.gasCount + g);
      }
      for (let p = 0; p < run.parcelCount; p++) { water += big(snap.ledger, p * 3 + 1); energy += sbig(snap.ledger, p * 3 + 2); }
      return { water, energy, sources, control: snap.energy.slice(2 * run.gasCount * W) };
    };
    const cold = totals(run.snapshots[0]);
    for (const [index, snap] of run.snapshots.entries()) {
      const now = totals(snap);
      assert.equal(now.water, cold.water, `step ${index}: vapor + parcel water is bit-exact`);
      assert.equal(now.energy, cold.energy, `step ${index}: sum(U) over carriers and parcels is bit-exact`);
      assert.equal(now.sources, 0n, `step ${index}: no recorded sources`);
      assert.deepEqual(now.control, [0, 0, 0, 0], `step ${index}: no ledger flags`);
    }
    // Growth direction and law: step-1 GPU rate vs f64 evaluation at the GPU's own r and S.
    const last = run.snapshots.at(-1), first = run.snapshots[0];
    for (let p = 0; p < run.parcelCount; p++) {
      const [rate, sEq, s, r] = run.probe.slice(p * 4, p * 4 + 4);
      const ref = sphExactVaporParcelDropletRate({ r, rDry: run.parcelsDef[p].rDry, kappa: 0.61, t: run.T, p: 101325, s });
      assert.ok(Math.abs(rate - ref.rate) <= 2e-4 * Math.abs(ref.rate) + 1e-30, `parcel ${p}: rate ${rate} vs f64 ${ref.rate}`);
      assert.ok(Math.abs(sEq - ref.sEq) <= 1e-5 * ref.sEq, `parcel ${p}: S_eq ${sEq} vs f64 ${ref.sEq}`);
      const grew = big(last.ledger, p * 3 + 1) > big(first.ledger, p * 3 + 1);
      assert.equal(grew, ref.rate > 0, `parcel ${p}: water moved in the law's direction`);
    }
  } finally { await browser.close(); }
});
