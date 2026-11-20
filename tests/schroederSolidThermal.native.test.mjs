import assert from 'node:assert/strict';
import test from 'node:test';

// G3 Phase 4a gate (plan/todo/g3-solids-proposal.md): member conduction in a
// rigid body on the actual WGSL (src/runtime/sph/schroederSolidThermalGpu.js).
// Benchmark water-like caloric branches (declared below), 1 cm members.
//   T1 no walls: a half-hot/half-cold body conserves sum m u within the f32
//      update budget and its temperature spread shrinks monotonically;
//   T2 floor at 1500 K: sum m (u - u0) equals the exact wall-heat ledger within
//      the f32 update budget; a member inside the melt plateau sits exactly at
//      the melt temperature; bottom members melt completely.
// ULG_RUN_NATIVE_SOLID_RIGID=1; run memory-capped.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const ULP = x => 2 ** (Math.floor(Math.log2(Math.max(Math.abs(x), 2 ** -126))) - 23);

test('native Vulkan rigid-member conduction conserves energy and holds the melt plateau', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SOLID_RIGID=1 for native Vulkan WebGPU',
  timeout: 600_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const out = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const errors = []; let errorCount = 0;
      device.addEventListener('uncapturederror', e => { if (errorCount++ < 20) errors.push(String(e.error?.message ?? e).slice(0, 500)); });
      const solid = await import('/src/runtime/sph/schroederSolidRigidGpu.js');
      const thermal = await import('/src/runtime/sph/schroederSolidThermalGpu.js');
      const info = await device.createShaderModule({ code: thermal.schroederSolidThermalWgsl }).getCompilationInfo();
      const bad = info.messages.filter(m => m.type === 'error').map(m => `${m.lineNum}:${m.linePos} ${m.message}`);
      if (bad.length) { device.destroy(); return { status: 'compile-error', compileErrors: bad.slice(0, 5) }; }
      // Benchmark water-like branches: ice cv 2050, melt 273.15 K, latent
      // 333.55 kJ/kg, water cv 4186; k_ice 2.2, k_water 0.6 W/m/K.
      const solidBranch = { referenceTemperatureK: 250, referenceInternalEnergyJPerKg: -380000, cvJPerKgK: 2050 };
      solidBranch.energyMaxJPerKg = solidBranch.referenceInternalEnergyJPerKg + 2050 * (273.15 - 250);
      const liquidBranch = { referenceTemperatureK: 273.15, cvJPerKgK: 4186 };
      liquidBranch.energyMinJPerKg = solidBranch.energyMaxJPerKg + 333550;
      liquidBranch.referenceInternalEnergyJPerKg = liquidBranch.energyMinJPerKg;
      const pitch = 0.01, mass = Math.fround(917 * pitch ** 3);
      const run = async ({ walls, hot, steps, dt, sampleEvery }) => {
        const members = [];
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 4; k++)
          members.push({ x: [1 + pitch * (i + 0.5), pitch * (j + 0.5), 1 + pitch * (k + 0.5)], massKg: mass, layer: j });
        const seed = solid.seedSchroederSolidRigidBody({ bodyId: 0, members });
        const packed = solid.packSchroederSolidRigidBodies([seed]);
        const seeded = thermal.seedSchroederSolidMemberThermal({ seeds: [seed], pitchByAxisM: [[pitch, pitch, pitch]],
          temperaturesK: [250], solidBranch });
        // T1: half the members start hotter on the solid branch.
        if (hot) seeded.thermo.forEach((_, n) => { if (n % 4 === 0 && (n / 4) % 2 === 0) {
          seeded.thermo[n] += 2050 * 20; seeded.thermo[n + 1] += 20; } });
        // World positions in the seed's member order (the stage reads them for wall gaps).
        const world = new Float32Array(packed.memberCount * 8);
        const [qx, qy, qz, qw] = seed.quaternion;
        const rot = v => { const t = [2 * (qy * v[2] - qz * v[1]), 2 * (qz * v[0] - qx * v[2]), 2 * (qx * v[1] - qy * v[0])];
          return [v[0] + qw * t[0] + (qy * t[2] - qz * t[1]), v[1] + qw * t[1] + (qz * t[0] - qx * t[2]), v[2] + qw * t[2] + (qx * t[1] - qy * t[0])]; };
        seed.members.forEach((member, n) => { const r = rot(member.rest);
          world.set([seed.centerOfMass[0] + r[0], seed.centerOfMass[1] + r[1], seed.centerOfMass[2] + r[2], mass], n * 8); });
        const make = data => { const b = device.createBuffer({ size: data.byteLength, usage: 0x80 | 0x04 | 0x08 });
          device.queue.writeBuffer(b, 0, data); return b; };
        const memberBuffer = make(packed.members), worldBuffer = make(world);
        const stage = thermal.createSchroederSolidThermalStage({ device, memberCount: packed.memberCount, bodyCount: 1,
          memberBuffer, memberWorldBuffer: worldBuffer, thermo: seeded.thermo, neighbors: seeded.neighbors,
          solidBranch, liquidBranch, meltTemperatureK: 273.15, solidConductivity: 2.2, liquidConductivity: 0.6,
          pitchM: [pitch, pitch, pitch], memberRadiusM: 0.5 * pitch, wallTemperaturesK: walls, boxM: [5, 5, 5] });
        const read = async buffer => { const c = device.createBuffer({ size: buffer.size, usage: 1 | 8 });
          const e = device.createCommandEncoder(); e.copyBufferToBuffer(buffer, 0, c, 0, buffer.size); device.queue.submit([e.finish()]);
          await c.mapAsync(1); const w = Array.from(new Uint32Array(c.getMappedRange().slice(0))); c.unmap(); c.destroy(); return w; };
        const samples = [Array.from(seeded.thermo)];
        for (let s = 0; s < steps; s++) {
          const e = device.createCommandEncoder(); stage.encode(e, dt); device.queue.submit([e.finish()]);
          if ((s + 1) % sampleEvery === 0) samples.push(Array.from(new Float32Array(Uint32Array.from(await read(stage.thermoBuffer)).buffer)));
        }
        const ledger = await read(stage.heatLedgerBuffer);
        stage.destroy(); memberBuffer.destroy(); worldBuffer.destroy();
        return { samples, ledger, mass, layers: members.map(m => m.layer), steps, dt };
      };
      // Ice diffusivity k/(rho c) ~ 1.2e-6 m^2/s: equilibrating 4 cm takes
      // L^2/alpha ~ 1,400 s. Explicit stability: dt <= rho c d^2 / (7 k) ~ 12 s.
      const t1 = await run({ walls: [0, 0, 0, 0, 0, 0], hot: true, steps: 3000, dt: 1.0, sampleEvery: 250 });
      const t2 = await run({ walls: [0, 0, 1500, 0, 0, 0], hot: false, steps: 2000, dt: 0.05, sampleEvery: 100 });
      device.destroy();
      return { status: 'ran', errors, errorCount, t1, t2, solidBranch, liquidBranch };
    });
    assert.notEqual(out.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.notEqual(out.status, 'compile-error', `thermal WGSL compiles: ${JSON.stringify(out.compileErrors)}`);
    assert.deepEqual(out.errors, [], `no GPU validation errors (${out.errorCount})`);
    const W = 9;
    const exactValue = words => { let v = 0n; for (let i = W - 1; i >= 0; i--) v = (v << 32n) | BigInt(words[i] >>> 0);
      if (v >= 1n << BigInt(32 * W - 1)) v -= 1n << BigInt(32 * W); return Number(v) * 2 ** -149; };
    const rows = s => Array.from({ length: s.length / 4 }, (_, i) => s.slice(i * 4, i * 4 + 4));
    const energy = (s, m) => rows(s).reduce((sum, r) => sum + m * r[0], 0);
    const report = {};
    // T1: conservation and equilibration. Budget: one f32 rounding of each u
    // update per member per step, 0.5 ulp(|u|) * m.
    { const r = out.t1, m = r.mass, e0 = energy(r.samples[0], m);
      const budget = r.steps * 32 * 0.5 * ULP(400000) * m;
      const spreads = r.samples.map(s => { const t = rows(s).map(x => x[1]); return Math.max(...t) - Math.min(...t); });
      const drift = Math.max(...r.samples.map(s => Math.abs(energy(s, m) - e0)));
      report.t1 = { drift, budget, spreads };
      assert.ok(drift <= budget, `T1: energy drift ${drift} within ${budget}`);
      for (let i = 1; i < spreads.length; i++) assert.ok(spreads[i] <= spreads[i - 1] + 1e-4, 'T1: spread shrinks monotonically');
      assert.ok(spreads.at(-1) < 0.05 * spreads[0], `T1: equilibrated (${spreads.at(-1)} K)`);
    }
    // T2: wall heat ledger and plateau.
    { const r = out.t2, m = r.mass, last = rows(r.samples.at(-1));
      const gained = energy(r.samples.at(-1), m) - energy(r.samples[0], m);
      const wallHeat = exactValue(r.ledger);
      const budget = r.steps * 32 * 0.5 * ULP(400000) * m;
      const plateau = last.filter(x => x[2] > 0 && x[2] < 1);
      const melted = last.filter(x => x[2] >= 1);
      report.t2 = { gained, wallHeat, budget, plateauCount: plateau.length, meltedCount: melted.length,
        bottomFractions: last.filter((_, i) => r.layers[i] === 0).map(x => +x[2].toFixed(3)),
        topTemperatures: last.filter((_, i) => r.layers[i] === 1).map(x => +x[1].toFixed(2)) };
      assert.ok(wallHeat > 0, 'T2: the hot floor delivered heat');
      assert.ok(Math.abs(gained - wallHeat) <= budget, `T2: energy ${gained} vs wall heat ${wallHeat} (budget ${budget})`);
      for (const sample of r.samples) for (const x of rows(sample)) {
        if (x[2] > 0 && x[2] < 1) assert.equal(x[1], Math.fround(273.15), 'T2: plateau members sit at the melt temperature');
      }
      report.t2.plateauSeen = r.samples.reduce((n, sample) => n + rows(sample).filter(x => x[2] > 0 && x[2] < 1).length, 0);
      assert.ok(melted.length > 0, 'T2: bottom members melt completely');
    }
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
});
