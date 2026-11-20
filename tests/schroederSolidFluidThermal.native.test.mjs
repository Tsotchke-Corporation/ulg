import assert from 'node:assert/strict';
import test from 'node:test';

// A5 SOL-3 thermal gate (plan/todo/a5-solid-fluid-coupling.md): rigid-member
// <-> SPH-particle conduction on the actual WGSL
// (src/runtime/sph/schroederSolidFluidThermalGpu.js), run with the member
// conduction stage as the rigid lane runs it.
//   C1 sum(m u) over members and particles is conserved within one f32
//      rounding per update;
//   C2 the per-step ledger (net quanta into the solid) equals the members'
//      energy change and minus the particles' within that budget;
//   C3 heat flows hot -> cold and no member overshoots the fluid temperature;
//   C4 particles out of contact are bit-for-bit untouched;
//   C5 contact members reach the melt plateau and sit at the melt temperature.
// ULG_RUN_NATIVE_SOLID_RIGID=1; run memory-capped.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const ULP = x => 2 ** (Math.floor(Math.log2(Math.max(Math.abs(x), 2 ** -126))) - 23);

test('native Vulkan rigid-member / SPH-particle conduction is exact in quanta and conserves energy', {
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
      const coupling = await import('/src/runtime/sph/schroederSolidFluidThermalGpu.js');
      for (const code of [thermal.schroederSolidThermalWgsl, coupling.schroederSolidFluidThermalWgsl]) {
        const info = await device.createShaderModule({ code }).getCompilationInfo();
        const bad = info.messages.filter(m => m.type === 'error').map(m => `${m.lineNum}:${m.linePos} ${m.message}`);
        if (bad.length) { device.destroy(); return { status: 'compile-error', compileErrors: bad.slice(0, 5) }; }
      }
      // Benchmark ice/water branches (as the member conduction gate).
      const solidBranch = { referenceTemperatureK: 250, referenceInternalEnergyJPerKg: -380000, cvJPerKgK: 2050 };
      solidBranch.energyMaxJPerKg = solidBranch.referenceInternalEnergyJPerKg + 2050 * (273.15 - 250);
      const liquidBranch = { referenceTemperatureK: 273.15, cvJPerKgK: 4186 };
      liquidBranch.energyMinJPerKg = solidBranch.energyMaxJPerKg + 333550;
      liquidBranch.referenceInternalEnergyJPerKg = liquidBranch.energyMinJPerKg;
      const pitch = 0.01, mass = Math.fround(917 * pitch ** 3);
      // Ice body 4 x 2 x 4 members at y in [0.10, 0.12].
      const members = [];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 4; k++)
        members.push({ x: [1 + pitch * (i + 0.5), 0.1 + pitch * (j + 0.5), 1 + pitch * (k + 0.5)], massKg: mass, layer: j });
      const seed = solid.seedSchroederSolidRigidBody({ bodyId: 0, members });
      const packed = solid.packSchroederSolidRigidBodies([seed]);
      const seeded = thermal.seedSchroederSolidMemberThermal({ seeds: [seed], pitchByAxisM: [[pitch, pitch, pitch]],
        temperaturesK: [250], solidBranch });
      const world = new Float32Array(packed.memberCount * 8);
      const [qx, qy, qz, qw] = seed.quaternion;
      const rot = v => { const t = [2 * (qy * v[2] - qz * v[1]), 2 * (qz * v[0] - qx * v[2]), 2 * (qx * v[1] - qy * v[0])];
        return [v[0] + qw * t[0] + (qy * t[2] - qz * t[1]), v[1] + qw * t[1] + (qz * t[0] - qx * t[2]), v[2] + qw * t[2] + (qx * t[1] - qy * t[0])]; };
      const memberLayer = seed.members.map(member => { const r = rot(member.rest); return seed.centerOfMass[1] + r[1] < 0.11 ? 0 : 1; });
      seed.members.forEach((member, n) => { const r = rot(member.rest);
        world.set([seed.centerOfMass[0] + r[0], seed.centerOfMass[1] + r[1], seed.centerOfMass[2] + r[2], mass], n * 8); });
      // Hot fluid: a 4 x 4 layer just below the body (touching its bottom
      // members) and a far 2 x 2 layer that touches nothing.
      const fluidMaterial = 7, fluidPhase = 2, fluidT = 1800, fluidMass = Math.fround(7000 * 0.005 ** 3 * 8);
      const fluid = [];
      for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) fluid.push({ x: [1 + pitch * (i + 0.5), 0.1 - 0.004, 1 + pitch * (k + 0.5)], near: true });
      for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) fluid.push({ x: [2 + pitch * i, 0.1, 2 + pitch * k], near: false });
      const fluidState = new Float32Array(fluid.length * 8), fluidThermo = new Float32Array(fluid.length * 12);
      fluid.forEach((p, n) => { fluidState.set([...p.x, fluidMass, 0, 0, 0, 1.2e6 + n], n * 8);
        fluidThermo.set([fluidMaterial, fluidPhase, fluidT, 7000, 0, 1, 0, 0, 0.004, 1, 0, 0.005], n * 12); });
      const make = data => { const b = device.createBuffer({ size: data.byteLength, usage: 0x80 | 0x04 | 0x08 });
        device.queue.writeBuffer(b, 0, data); return b; };
      const memberBuffer = make(packed.members), worldBuffer = make(world);
      const stateBuffer = make(fluidState), thermoBuffer = make(fluidThermo);
      const stage = thermal.createSchroederSolidThermalStage({ device, memberCount: packed.memberCount, bodyCount: 1,
        memberBuffer, memberWorldBuffer: worldBuffer, thermo: seeded.thermo, neighbors: seeded.neighbors,
        solidBranch, liquidBranch, meltTemperatureK: 273.15, solidConductivity: 2.2, liquidConductivity: 0.6,
        pitchM: [pitch, pitch, pitch], memberRadiusM: 0.5 * pitch, wallTemperaturesK: [0, 0, 0, 0, 0, 0], boxM: [5, 5, 5] });
      const couplingStage = coupling.createSchroederSolidFluidThermalStage({ device, memberCount: packed.memberCount,
        memberBuffer, memberWorldBuffer: worldBuffer,
        fluidTable: coupling.packSchroederSolidFluidTable([{ materialId: fluidMaterial, phaseId: fluidPhase,
          conductivityWPerMK: 40, heatCapacityJPerKgK: 820 }]),
        solidBranch, liquidBranch, meltTemperatureK: 273.15, solidConductivity: 2.2, liquidConductivity: 0.6,
        halfPitchM: 0.5 * pitch });
      const read = async (buffer, Type = Float32Array) => { const c = device.createBuffer({ size: buffer.size, usage: 1 | 8 });
        const e = device.createCommandEncoder(); e.copyBufferToBuffer(buffer, 0, c, 0, buffer.size); device.queue.submit([e.finish()]);
        await c.mapAsync(1); const w = Array.from(new Type(c.getMappedRange().slice(0))); c.unmap(); c.destroy(); return w; };
      const dt = 0.002, steps = 4000, samples = [];
      let ledgerQuanta = 0, maxPairs = 0;
      samples.push({ members: Array.from(seeded.thermo), fluid: Array.from(fluidState), ledgerQuanta: 0 });
      for (let s = 0; s < steps; s++) {
        const e = device.createCommandEncoder();
        stage.encode(e, dt);
        couplingStage.encode(e, dt, { memberThermoBuffer: stage.thermoBuffer, fluidStateBuffer: stateBuffer,
          fluidThermoBuffer: thermoBuffer, particleCount: fluid.length });
        device.queue.submit([e.finish()]);
        const ledger = await read(couplingStage.ledgerBuffer, Int32Array);
        ledgerQuanta += ledger[0]; maxPairs = Math.max(maxPairs, ledger[1]);
        if (ledger[2] !== 0) return { status: 'overflow', ledger };
        if ((s + 1) % 500 === 0) samples.push({ members: await read(stage.thermoBuffer), fluid: await read(stateBuffer), ledgerQuanta });
      }
      couplingStage.destroy(); stage.destroy();
      for (const b of [memberBuffer, worldBuffer, stateBuffer, thermoBuffer]) b.destroy();
      device.destroy();
      return { status: 'ran', errors, errorCount, samples, mass, fluidMass, near: fluid.map(p => p.near), memberLayer,
        steps, quantum: couplingStage.quantumJ, maxPairs, fluidT };
    });
    assert.notEqual(out.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.notEqual(out.status, 'compile-error', `WGSL compiles: ${JSON.stringify(out.compileErrors)}`);
    assert.notEqual(out.status, 'overflow', 'no quanta overflow');
    assert.deepEqual(out.errors, [], `no GPU validation errors (${out.errorCount})`);
    const memberEnergy = s => Array.from({ length: s.members.length / 4 }, (_, i) => s.members[i * 4]).reduce((a, u) => a + out.mass * u, 0);
    const fluidEnergy = s => Array.from({ length: s.fluid.length / 8 }, (_, n) => s.fluid[n * 8 + 7] * s.fluid[n * 8 + 3]).reduce((a, b) => a + b, 0);
    const first = out.samples[0];
    const report = { maxPairs: out.maxPairs, checkpoints: [] };
    for (const s of out.samples.slice(1)) {
      const dMembers = memberEnergy(s) - memberEnergy(first), dFluid = fluidEnergy(s) - fluidEnergy(first);
      const ledgerJ = s.ledgerQuanta * out.quantum;
      // One f32 rounding per u update: members (32) and contact particles (16) per step.
      const steps = out.steps * (out.samples.indexOf(s) / (out.samples.length - 1));
      const budget = steps * (32 * 0.5 * ULP(400000) * out.mass + 16 * 0.5 * ULP(1.3e6) * out.fluidMass);
      report.checkpoints.push({ dMembers, dFluid, ledgerJ, residual: dMembers + dFluid, budget });
      assert.ok(Math.abs(dMembers + dFluid) <= budget, `C1: energy residual ${dMembers + dFluid} within ${budget}`);
      assert.ok(Math.abs(dMembers - ledgerJ) <= budget, `C2: member gain ${dMembers} vs ledger ${ledgerJ}`);
      assert.ok(Math.abs(dFluid + ledgerJ) <= budget, `C2: fluid loss ${dFluid} vs ledger ${ledgerJ}`);
    }
    const last = out.samples.at(-1);
    const rows = Array.from({ length: last.members.length / 4 }, (_, i) => last.members.slice(i * 4, i * 4 + 4));
    assert.ok(report.checkpoints.at(-1).ledgerJ > 0, 'C3: heat flowed into the solid');
    for (const s of out.samples) for (let i = 0; i < s.members.length / 4; i++) {
      assert.ok(s.members[i * 4 + 1] <= out.fluidT, 'C3: no member overshoots the fluid temperature');
    }
    out.near.forEach((near, n) => { if (!near) assert.equal(last.fluid[n * 8 + 7], first.fluid[n * 8 + 7], `C4: far particle ${n} untouched`); });
    const bottom = rows.filter((_, i) => out.memberLayer[i] === 0);
    report.bottom = bottom.map(r => ({ T: +r[1].toFixed(2), fraction: +r[2].toFixed(3) }));
    assert.ok(bottom.some(r => r[2] > 0), 'C5: contact members reach the melt plateau');
    for (const r of rows) if (r[2] > 0 && r[2] < 1) assert.equal(r[1], Math.fround(273.15), 'C5: plateau at the melt temperature');
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
});
