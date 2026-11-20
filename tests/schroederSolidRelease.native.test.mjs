import assert from 'node:assert/strict';
import test from 'node:test';

// G3 Phase 4b gate (plan/todo/g3-solids-proposal.md): melted members leave a
// rigid body for reserved fluid rows (schroederSolidThermalGpu release +
// schroederSolidReleaseGpu activation + schroederSolidRigidGpu rebase).
// A spinning, translating 4x2x4 body of 1 cm members in free space has its
// 16 bottom members fully liquid: they release on the first conduction pass.
//   R1 mass: body + released rows = initial (1e-6 relative);
//   R2 linear momentum and R3 angular momentum about the origin are
//      conserved across body + released rows (1e-5 relative);
//   R4 energy: alive + released sum m u = initial (f32 update budget);
//   R5 the rebased frame is the survivors' principal frame: COM matches the
//      alive members (1e-6 m) and their inertia is diagonal in it with the
//      frame moments (1e-4 relative);
//   R6 each activated row holds the member's mass and u.
// ULG_RUN_NATIVE_SOLID_RIGID=1; run memory-capped.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('native Vulkan melt release conserves mass, momentum and energy and rebases the body', {
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
      const release = await import('/src/runtime/sph/schroederSolidReleaseGpu.js');
      for (const code of [solid.schroederSolidRigidWgsl(), thermal.schroederSolidThermalWgsl, release.schroederSolidReleaseWgsl]) {
        const info = await device.createShaderModule({ code }).getCompilationInfo();
        const bad = info.messages.filter(m => m.type === 'error').map(m => `${m.lineNum}:${m.linePos} ${m.message}`);
        if (bad.length) { device.destroy(); return { status: 'compile-error', compileErrors: bad.slice(0, 5) }; }
      }
      const solidBranch = { referenceTemperatureK: 250, referenceInternalEnergyJPerKg: -380000, cvJPerKgK: 2050 };
      solidBranch.energyMaxJPerKg = solidBranch.referenceInternalEnergyJPerKg + 2050 * (273.15 - 250);
      const liquidBranch = { referenceTemperatureK: 273.15, cvJPerKgK: 4186 };
      liquidBranch.energyMinJPerKg = solidBranch.energyMaxJPerKg + 333550;
      liquidBranch.referenceInternalEnergyJPerKg = liquidBranch.energyMinJPerKg;
      const pitch = 0.01, mass = Math.fround(917 * pitch ** 3);
      const members = [];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 4; k++)
        members.push({ x: [2 + pitch * (i + 0.5), 2 + pitch * (j + 0.5), 2 + pitch * (k + 0.5)], massKg: mass, layer: j });
      const seed = solid.seedSchroederSolidRigidBody({ bodyId: 0, members, velocity: [0.2, 0, 0.1], angularVelocity: [0.5, 2.0, 0.3] });
      const packed = solid.packSchroederSolidRigidBodies([seed]);
      const seeded = thermal.seedSchroederSolidMemberThermal({ seeds: [seed], pitchByAxisM: [[pitch, pitch, pitch]],
        temperaturesK: [260], solidBranch });
      // The bottom layer starts fully liquid (in seed member order).
      const layerOf = n => members[n].layer;
      const liquidU = liquidBranch.energyMinJPerKg + 10;
      seed.members.forEach((_, n) => { if (layerOf(n) === 0) { seeded.thermo[n * 4] = liquidU; seeded.thermo[n * 4 + 1] = 273.15; seeded.thermo[n * 4 + 2] = 1; } });
      const make = (data, extra = 0) => { const b = device.createBuffer({ size: Math.max(16, data.byteLength), usage: 0x80 | 0x04 | 0x08 | extra });
        device.queue.writeBuffer(b, 0, data); return b; };
      const frameBuffer = make(packed.frames), memberBuffer = make(packed.members);
      const latticeBuffer = make(solid.packSchroederSolidLattice([seed], [[pitch, pitch, pitch]]));
      const rigid = solid.createSchroederSolidRigidStage({ device, bodyCount: 1, memberCount: packed.memberCount,
        frameBuffer, memberBuffer, latticeBuffer });
      const conduction = thermal.createSchroederSolidThermalStage({ device, memberCount: packed.memberCount, bodyCount: 1,
        memberBuffer, memberWorldBuffer: rigid.memberWorldBuffer, thermo: seeded.thermo, neighbors: seeded.neighbors,
        solidBranch, liquidBranch, meltTemperatureK: 273.15, solidConductivity: 2.2, liquidConductivity: 0.6,
        pitchM: [pitch, pitch, pitch], memberRadiusM: 0.5 * pitch, wallTemperaturesK: [0, 0, 0, 0, 0, 0], boxM: [5, 5, 5] });
      // Fluid rows: member n -> row n + 3 of a 40-row family.
      const rows = 40;
      const releaseRows = new Uint32Array(packed.memberCount).map((_, n) => n + 3);
      const fluidState = make(new Float32Array(rows * 8)), fluidThermo = make(new Float32Array(rows * 12)),
        fluidMechanics = make(new Float32Array(rows * 32));
      const releaser = release.createSchroederSolidReleaseStage({ device, memberCount: packed.memberCount, releaseRows,
        liquidMaterialId: 3061144, liquidDensityKgPerM3: 1000, liquidEntitiesPerKg: 6.02214076e23 / 0.01801528,
        releaseEventBuffer: conduction.releaseEventBuffer,
        releaseCountBuffer: conduction.releaseCountBuffer });
      const read = async buffer => { const c = device.createBuffer({ size: buffer.size, usage: 1 | 8 });
        const e = device.createCommandEncoder(); e.copyBufferToBuffer(buffer, 0, c, 0, buffer.size); device.queue.submit([e.finish()]);
        await c.mapAsync(1); const w = new Float32Array(c.getMappedRange().slice(0)); c.unmap(); c.destroy(); return Array.from(w); };
      const step = dt => { const e = device.createCommandEncoder(); rigid.encode(e, dt); conduction.encode(e, dt, { releaseEnabled: true });
        releaser.encode(e, { stateBuffer: fluidState, thermoBuffer: fluidThermo, mechanicsBuffer: fluidMechanics });
        device.queue.submit([e.finish()]); };
      const dt = 1e-3;
      step(dt);
      const afterRelease = { frame: await read(frameBuffer), thermo: await read(conduction.thermoBuffer),
        fluidState: await read(fluidState), members: await read(memberBuffer) };
      step(dt); step(dt);
      const final = { frame: await read(frameBuffer), thermo: await read(conduction.thermoBuffer),
        fluidState: await read(fluidState), fluidThermo: await read(fluidThermo),
        memberWorld: await read(rigid.memberWorldBuffer), members: await read(memberBuffer) };
      device.destroy();
      return { status: 'ran', errors, errorCount, seed: JSON.parse(JSON.stringify(seed)), mass, afterRelease, final,
        layers: seed.members.map((_, n) => layerOf(n)), initialThermo: Array.from(seeded.thermo), rows };
    });
    assert.notEqual(out.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.notEqual(out.status, 'compile-error', `shaders compile: ${JSON.stringify(out.compileErrors)}`);
    assert.deepEqual(out.errors, [], `no GPU validation errors (${out.errorCount})`);
    const n = out.layers.length, m = out.mass;
    const frameOf = f => ({ x: f.slice(0, 3), M: f[3], q: f.slice(4, 8), p: f.slice(8, 11), l: f.slice(12, 15), I: f.slice(16, 19) });
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const add = (a, b) => a.map((v, k) => v + b[k]);
    const seed = out.seed;
    // Totals before release (seed frame, f64).
    const P0 = seed.linearMomentum, L0 = add(seed.angularMomentum, cross(seed.centerOfMass, seed.linearMomentum));
    const M0 = seed.massKg;
    const fr = frameOf(out.final.frame), fs = out.final.fluidState;
    const released = Array.from({ length: n }, (_, i) => i).filter(i => out.layers[i] === 0);
    let Mr = 0, Pr = [0, 0, 0], Lr = [0, 0, 0], Ur = 0;
    for (const i of released) {
      const row = i + 3, p = fs.slice(row * 8, row * 8 + 3), mi = fs[row * 8 + 3], v = fs.slice(row * 8 + 4, row * 8 + 7);
      Mr += mi; Pr = add(Pr, v.map(c => mi * c)); Lr = add(Lr, cross(p, v.map(c => mi * c))); Ur += mi * fs[row * 8 + 7];
    }
    const report = {};
    // R1 mass.
    report.mass = { body: fr.M, released: Mr, initial: M0 };
    assert.ok(Math.abs(fr.M + Mr - M0) <= 1e-6 * M0, `R1: mass ${fr.M} + ${Mr} vs ${M0}`);
    assert.ok(Math.abs(fr.M - 16 * m) <= 1e-6 * M0, 'R1: the body keeps exactly the 16 survivors');
    // R2 momentum, R3 angular momentum about the origin.
    const P1 = add(fr.p, Pr), L1 = add(add(fr.l, cross(fr.x, fr.p)), Lr);
    report.momentum = { P0, P1, L0, L1 };
    for (let k = 0; k < 3; k++) {
      assert.ok(Math.abs(P1[k] - P0[k]) <= 1e-5 * Math.hypot(...P0) + 1e-9, `R2: momentum ${k}: ${P1[k]} vs ${P0[k]}`);
      assert.ok(Math.abs(L1[k] - L0[k]) <= 1e-5 * Math.hypot(...L0) + 1e-9, `R3: angular momentum ${k}: ${L1[k]} vs ${L0[k]}`);
    }
    // R4 energy.
    const E0 = Array.from({ length: n }, (_, i) => m * out.initialThermo[i * 4]).reduce((a, b) => a + b, 0);
    const alive = Array.from({ length: n }, (_, i) => i).filter(i => out.layers[i] === 1);
    const Ea = alive.reduce((s, i) => s + m * out.final.thermo[i * 4], 0);
    report.energy = { E0, E1: Ea + Ur };
    // One f32 rounding of each member's u update per step at |u| <= 4e5 J/kg
    // (the solid branch): 0.5 ulp(4e5) * m * members * steps.
    const energyBudget = 3 * n * 0.5 * 2 ** (Math.floor(Math.log2(4e5)) - 23) * m;
    report.energy.budget = energyBudget;
    assert.ok(Math.abs(Ea + Ur - E0) <= energyBudget, `R4: energy ${Ea + Ur} vs ${E0} (budget ${energyBudget})`);
    // R5 rebased frame = survivors' principal frame.
    const world = i => out.final.memberWorld.slice(i * 8, i * 8 + 3);
    const com = [0, 1, 2].map(k => alive.reduce((s, i) => s + m * world(i)[k], 0) / (alive.length * m));
    report.rebase = { com, frameX: fr.x, frameI: fr.I };
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(com[k] - fr.x[k]) <= 1e-6, `R5: COM ${k}`);
    const rotInv = (q, v) => { const [x, y, z, w] = [-q[0], -q[1], -q[2], q[3]];
      const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
      return [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])]; };
    const Ib = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const i of alive) {
      const r = rotInv(fr.q, world(i).map((v, k) => v - fr.x[k])), r2 = r[0] ** 2 + r[1] ** 2 + r[2] ** 2;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) Ib[a][b] += m * ((a === b ? r2 : 0) - r[a] * r[b]);
    }
    report.rebase.bodyInertia = Ib;
    const scale = Math.max(...fr.I);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const expected = a === b ? fr.I[a] : 0;
      assert.ok(Math.abs(Ib[a][b] - expected) <= 1e-4 * scale, `R5: body inertia [${a}][${b}] ${Ib[a][b]} vs ${expected}`);
    }
    // R6 activated rows.
    for (const i of released) {
      const row = i + 3;
      assert.equal(fs[row * 8 + 3], m, `R6: row ${row} mass`);
      // R7 the released mass carries its molecules (entities = m N_A / M).
      const entities = out.final.fluidThermo[row * 12 + 9];
      const expectedEntities = m * (6.02214076e23 / 0.01801528);
      assert.ok(Math.abs(entities - expectedEntities) <= 1e-6 * expectedEntities,
        `R7: row ${row} represented entities ${entities} vs ${expectedEntities}`);
      // The member's u at release: its start value less the heat it conducted
      // to colder solid neighbours in that pass (counted in R4), still liquid.
      const liquidMin = -380000 + 2050 * (273.15 - 250) + 333550;
      assert.ok(fs[row * 8 + 7] >= Math.fround(liquidMin) && fs[row * 8 + 7] <= Math.fround(liquidUGuess()),
        `R6: row ${row} u ${fs[row * 8 + 7]} on the liquid branch`);
    }
    console.log(JSON.stringify(report));
    function liquidUGuess() { return -380000 + 2050 * (273.15 - 250) + 333550 + 10; }
  } finally { await browser.close(); }
});
