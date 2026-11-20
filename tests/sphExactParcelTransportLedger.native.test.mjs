import assert from 'node:assert/strict';
import test from 'node:test';

// G2 Phase 5 gate (plan/todo/g2-integer-ledger-proposal.md): parcel transport
// and deposition with exact ownership. A manufactured 0.2 m box with one gas
// cell moving at +0.5 m/s, two condensed water carriers and five parcels:
// one touching carrier A, two touching carrier B (one step, one receiver),
// one leaving through the +x wall, one airborne. Over 10 steps mass and
// energy close bit-exactly over carriers + parcels + sinks, deposited parcels
// are exact zero, and the airborne parcel moves with the gas plus the f64
// Stokes-Cunningham settling velocity.
// ULG_RUN_NATIVE_EXACT_PARCEL_TRANSPORT=1, with the HTTPS dev server running.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_EXACT_PARCEL_TRANSPORT === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('native Vulkan parcel transport and deposition keep ownership and budgets bit-exact', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_EXACT_PARCEL_TRANSPORT=1 for native Vulkan WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const { sphExactParcelSettlingVelocity } = await import('../src/runtime/sph/sphExactParcelTransportLedgerGpu.js');
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
      const tp = await import('/src/runtime/sph/sphExactParcelTransportLedgerGpu.js');
      const mass = await import('/ulg-gpu-abi/src/sphExactMassInventory.js');
      const signed = await import('/ulg-gpu-abi/src/sphExactSignedLedger.js');
      const format = mass.createSphExactMassFormat(); const W = format.wordCount;
      const fr = Math.fround, WATER = 501, AIR = 7;
      // Carriers: gas (cell velocity +0.5 m/s), water A, water B (1e-6 kg cubes, 1 mm edge).
      const carriers = [
        { pos: [0.1, 0.1, 0.1], m: fr(1e-2), v: [0.5, 0, 0], u: fr(2.1e5), material: AIR, phase: 3 },
        { pos: [0.05, 0.05, 0.05], m: fr(1e-6), v: [0, 0, 0], u: fr(4.2e4), material: WATER, phase: 2 },
        { pos: [0.15, 0.05, 0.05], m: fr(1e-6), v: [0, 0, 0], u: fr(4.3e4), material: WATER, phase: 2 }];
      const state = new Float32Array(carriers.length * 8), thermo = new Float32Array(carriers.length * 12);
      carriers.forEach((c, i) => { state.set([...c.pos, c.m, ...c.v, c.u], i * 8); thermo.set([c.material, c.phase, 290, 1], i * 12); });
      const cmass = new Uint32Array(carriers.length * W), cenergy = new Uint32Array(2 * carriers.length * W + 4);
      carriers.forEach((c, i) => { cmass.set(mass.encodeSphExactMass(c.m, format), i * W);
        cenergy.set(signed.encodeSphExactSigned(fr(c.m * c.u), format), i * W); });
      // Parcels: 1e4 droplets each, 5 um water radius on a 50 nm core.
      const n = 1e4, rDry = 5e-8, r = 5e-6;
      const md = 1770 * 4 / 3 * Math.PI * rDry ** 3, mw = 1000 * (4 / 3 * Math.PI * r ** 3 - md / 1770);
      // Transport moves each parcel 0.5 mm in +x before contact is tested.
      const placements = [[0.0497, 0.05, 0.05], [0.1497, 0.05, 0.05], [0.1499, 0.0502, 0.05], [0.1999, 0.15, 0.15], [0.05, 0.15, 0.15]];
      const parcels = new Float32Array(placements.length * 8), ledger = new Uint32Array(placements.length * 3 * W);
      placements.forEach((p, i) => {
        parcels.set([...p, n, 1770, 0.61, 290, r], i * 8);
        ledger.set(mass.encodeSphExactMass(fr(md * n), format), (i * 3) * W);
        ledger.set(mass.encodeSphExactMass(fr(mw * n * (1 + 0.01 * i)), format), (i * 3 + 1) * W);
        ledger.set(signed.encodeSphExactSigned(fr(fr(mw * n) * 7.0e4), format), (i * 3 + 2) * W);
      });
      const sinks = new Uint32Array(3 * W);
      const buffer = data => { const b = device.createBuffer({ size: data.byteLength, usage: 0x80 | 0x04 | 0x08 });
        device.queue.writeBuffer(b, 0, data); return b; };
      const bufs = { carrierStateBuffer: buffer(state), carrierThermoBuffer: buffer(thermo), carrierMassBuffer: buffer(cmass),
        carrierEnergyBuffer: buffer(cenergy), parcelBuffer: buffer(parcels), parcelLedgerBuffer: buffer(ledger), sinkBuffer: buffer(sinks) };
      const stage = tp.createSphExactParcelTransportStage({ device, carrierCount: carriers.length, parcelCount: placements.length,
        dims: [1, 1, 1], origin: [0, 0, 0], cellSizeM: 0.2, boxM: [0.2, 0.2, 0.2], waterMaterialId: WATER, ...bufs });
      const read = async b => { const c = device.createBuffer({ size: b.size, usage: 1 | 8 });
        const e = device.createCommandEncoder(); e.copyBufferToBuffer(b, 0, c, 0, b.size); device.queue.submit([e.finish()]);
        await c.mapAsync(1); const w = new Uint32Array(c.getMappedRange().slice(0)); c.unmap(); c.destroy(); return Array.from(w); };
      const snap = async () => ({ cmass: await read(bufs.carrierMassBuffer), cenergy: await read(bufs.carrierEnergyBuffer),
        ledger: await read(bufs.parcelLedgerBuffer), sinks: await read(bufs.sinkBuffer) });
      const snapshots = [await snap()];
      let targets = null;
      const dt = 1e-3, steps = 10;
      for (let step = 0; step < steps; step++) {
        const encoder = device.createCommandEncoder(); stage.encode(encoder, dt); device.queue.submit([encoder.finish()]);
        if (step === 0) targets = await read(stage.targetBuffer);
        snapshots.push(await snap());
      }
      const after = Array.from(new Float32Array(Uint32Array.from(await read(bufs.parcelBuffer)).buffer));
      device.destroy();
      return { status: 'ran', W, carrierCount: carriers.length, parcelCount: placements.length, snapshots, targets, after,
        placements, errors, dt, steps, md, mw, n, r };
    });
    assert.notEqual(run.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.deepEqual(run.errors, [], 'no GPU validation errors');
    const { W } = run;
    const big = (words, row) => words.slice(row * W, (row + 1) * W).reduceRight((v, w) => (v << 32n) | BigInt(w >>> 0), 0n);
    const sbig = (words, row) => { const v = big(words, row); return v >= 1n << BigInt(32 * W - 1) ? v - (1n << BigInt(32 * W)) : v; };
    const totals = s => {
      let m = 0n, e = 0n;
      for (let c = 0; c < run.carrierCount; c++) { m += big(s.cmass, c); e += sbig(s.cenergy, c); }
      for (let p = 0; p < run.parcelCount; p++) { m += big(s.ledger, p * 3) + big(s.ledger, p * 3 + 1); e += sbig(s.ledger, p * 3 + 2); }
      m += big(s.sinks, 0) + big(s.sinks, 2); e += sbig(s.sinks, 1);
      return { m, e, control: s.cenergy.slice(2 * run.carrierCount * W) };
    };
    const cold = totals(run.snapshots[0]);
    for (const [i, s] of run.snapshots.entries()) {
      const now = totals(s);
      assert.equal(now.m, cold.m, `step ${i}: mass closes over carriers + parcels + sinks`);
      assert.equal(now.e, cold.e, `step ${i}: energy closes over carriers + parcels + sinks`);
      assert.deepEqual(now.control, [0, 0, 0, 0], `step ${i}: no flags`);
    }
    // Fates after step 1: parcel 0 -> carrier 1, parcels 1-2 -> carrier 2, parcel 3 -> wall, parcel 4 airborne.
    assert.deepEqual(run.targets, [1, 2, 2, 0xfffffffe, 0xffffffff], 'deposition targets');
    const first = run.snapshots[0], last = run.snapshots.at(-1);
    for (const p of [0, 1, 2, 3]) {
      for (const slot of [0, 1, 2]) assert.equal(big(last.ledger, p * 3 + slot), 0n, `parcel ${p} slot ${slot} is exact zero`);
    }
    assert.equal(big(last.cmass, 2) - big(first.cmass, 2), big(first.ledger, 1 * 3 + 1) + big(first.ledger, 2 * 3 + 1),
      'carrier B gains exactly both parcels\' water');
    assert.equal(big(last.sinks, 0), big(first.ledger, 3 * 3) + big(first.ledger, 3 * 3 + 1), 'wall sink holds the whole wall parcel');
    assert.equal(big(last.sinks, 2), big(first.ledger, 0) + big(first.ledger, 3) + big(first.ledger, 6), 'solute sink holds the deposited cores');
    // Airborne parcel 4: displacement = (gas velocity + settling) * t.
    // md and mw are per droplet; parcel 4 carries 1.04x the base water.
    const volume = run.mw * 1.04 / 1000 + run.md / 1770;
    const r4 = Math.cbrt(3 * volume / (4 * Math.PI));
    const rho = (run.mw * 1.04 + run.md) / volume;
    const vs = sphExactParcelSettlingVelocity({ r: r4, rhoParticle: rho });
    const t = run.dt * run.steps;
    const dx = run.after[4 * 8] - run.placements[4][0], dy = run.after[4 * 8 + 1] - run.placements[4][1];
    assert.ok(Math.abs(dx - 0.5 * t) < 1e-6, `airborne parcel moves with the gas: dx ${dx}`);
    // f32 positions near 0.15 m resolve ~1.5e-8 m, about 0.5% of each ~3 um
    // settling increment, so the 10-step sum carries a few 1e-3 of rounding.
    assert.ok(Math.abs(dy - vs * t) <= 1e-2 * Math.abs(vs * t), `settling dy ${dy} vs f64 ${vs * t}`);
  } finally { await browser.close(); }
});
