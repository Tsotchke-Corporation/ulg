import assert from 'node:assert/strict';
import test from 'node:test';

// A5 SOL-3 mechanical gate (plan/todo/a5-solid-fluid-coupling.md): rigid
// member <-> SPH particle contact on the actual WGSL
// (src/runtime/sph/schroederSolidFluidContactGpu.js).
//   M1 linear momentum: sum m_p v_p + P_body is conserved within f32 rounding;
//   M2 every contacting particle leaves with a normal velocity relative to
//      the body (after its reaction) >= the Baumgarte target: no approach;
//   M3 the body's angular momentum change equals sum (c - COM) x (-J) from
//      the particles' own impulses;
//   M4 separating and far particles are bit-for-bit untouched.
// ULG_RUN_NATIVE_SOLID_RIGID=1; run memory-capped.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('native Vulkan rigid-member / SPH-particle contact conserves momentum and stops approach', {
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
      const contact = await import('/src/runtime/sph/schroederSolidFluidContactGpu.js');
      const info = await device.createShaderModule({ code: contact.schroederSolidFluidContactWgsl }).getCompilationInfo();
      const bad = info.messages.filter(m => m.type === 'error').map(m => `${m.lineNum}:${m.linePos} ${m.message}`);
      if (bad.length) { device.destroy(); return { status: 'compile-error', compileErrors: bad.slice(0, 5) }; }
      const pitch = 0.01, mass = Math.fround(917 * pitch ** 3);
      const members = [];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 4; k++)
        members.push({ x: [1 + pitch * (i + 0.5), 0.1 + pitch * (j + 0.5), 1 + pitch * (k + 0.5)], massKg: mass });
      const seed = solid.seedSchroederSolidRigidBody({ bodyId: 0, members });
      const packed = solid.packSchroederSolidRigidBodies([seed]);
      const world = new Float32Array(packed.memberCount * 8);
      const [qx, qy, qz, qw] = seed.quaternion;
      const rot = v => { const t = [2 * (qy * v[2] - qz * v[1]), 2 * (qz * v[0] - qx * v[2]), 2 * (qx * v[1] - qy * v[0])];
        return [v[0] + qw * t[0] + (qy * t[2] - qz * t[1]), v[1] + qw * t[1] + (qz * t[0] - qx * t[2]), v[2] + qw * t[2] + (qx * t[1] - qy * t[0])]; };
      seed.members.forEach((member, n) => { const r = rot(member.rest);
        world.set([seed.centerOfMass[0] + r[0], seed.centerOfMass[1] + r[1], seed.centerOfMass[2] + r[2], mass], n * 8); });
      // Particles below the body's bottom layer moving up into it (off-centre
      // so the body also gets a torque), one separating, one far.
      const pm = Math.fround(7000 * 0.005 ** 3 * 8), radius = 0.005;
      const particles = [];
      for (let i = 0; i < 2; i++) for (let k = 0; k < 4; k++)
        particles.push({ x: [1 + pitch * (i + 0.5), 0.1 - 0.004, 1 + pitch * (k + 0.5)], v: [0.1, 1.0, 0], role: 'approach' });
      particles.push({ x: [1 + pitch * 3.5, 0.1 - 0.004, 1 + pitch * 0.5], v: [0, -1.0, 0], role: 'separating' });
      particles.push({ x: [3, 3, 3], v: [0, 1, 0], role: 'far' });
      const state = new Float32Array(particles.length * 8), thermo = new Float32Array(particles.length * 12);
      particles.forEach((p, n) => { state.set([...p.x, pm, ...p.v, 1.2e6], n * 8);
        thermo.set([7, 2, 1800, 7000, 0, 1, 0, 0, 0.004, 1, 0, radius], n * 12); });
      const make = data => { const b = device.createBuffer({ size: data.byteLength, usage: 0x80 | 0x04 | 0x08 });
        device.queue.writeBuffer(b, 0, data); return b; };
      const memberBuffer = make(packed.members), worldBuffer = make(world), frameBuffer = make(packed.frames);
      const stateBuffer = make(state), thermoBuffer = make(thermo);
      const stage = contact.createSchroederSolidFluidContactStage({ device, memberCount: packed.memberCount, bodyCount: 1,
        memberBuffer, memberWorldBuffer: worldBuffer, frameBuffer, memberRadiusM: 0.5 * pitch });
      const read = async (buffer, Type = Float32Array) => { const c = device.createBuffer({ size: buffer.size, usage: 1 | 8 });
        const e = device.createCommandEncoder(); e.copyBufferToBuffer(buffer, 0, c, 0, buffer.size); device.queue.submit([e.finish()]);
        await c.mapAsync(1); const w = Array.from(new Type(c.getMappedRange().slice(0))); c.unmap(); c.destroy(); return w; };
      const frameBefore = await read(frameBuffer);
      const dt = 5e-4;
      const e = device.createCommandEncoder();
      stage.encode(e, dt, { fluidStateBuffer: stateBuffer, fluidThermoBuffer: thermoBuffer, particleCount: particles.length });
      device.queue.submit([e.finish()]);
      const result = { stateBefore: Array.from(state), stateAfter: await read(stateBuffer), frameBefore,
        frameAfter: await read(frameBuffer), ledger: await read(stage.ledgerBuffer, Uint32Array),
        world: Array.from(world), roles: particles.map(p => p.role), pm, radius, a: 0.5 * pitch, dt,
        law: contact.SCHROEDER_SOLID_FLUID_CONTACT_LAW };
      stage.destroy();
      for (const b of [memberBuffer, worldBuffer, frameBuffer, stateBuffer, thermoBuffer]) b.destroy();
      device.destroy();
      return { status: 'ran', errors, errorCount, ...result };
    });
    assert.notEqual(out.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.notEqual(out.status, 'compile-error', `WGSL compiles: ${JSON.stringify(out.compileErrors)}`);
    assert.deepEqual(out.errors, [], `no GPU validation errors (${out.errorCount})`);
    const n = out.roles.length;
    const v = (s, i) => [s[i * 8 + 4], s[i * 8 + 5], s[i * 8 + 6]];
    const P = f => [f[8], f[9], f[10]], L = f => [f[12], f[13], f[14]], com = f => [f[0], f[1], f[2]];
    // M1.
    const momentum = (s, f) => [0, 1, 2].map(k => Array.from({ length: n }, (_, i) => out.pm * v(s, i)[k]).reduce((a, b) => a + b, 0) + P(f)[k]);
    const before = momentum(out.stateBefore, out.frameBefore), after = momentum(out.stateAfter, out.frameAfter);
    const report = { ledger: out.ledger, before, after, bodyP: P(out.frameAfter) };
    assert.equal(out.ledger[1], 0, 'no exact-scatter errors');
    assert.equal(out.ledger[0], 8, 'eight approaching contacts');
    // f32 budget: half an ulp of each updated velocity times its mass, and of the body's P.
    const ulp = x => 2 ** (Math.floor(Math.log2(Math.max(Math.abs(x), 2 ** -126))) - 23);
    for (let k = 0; k < 3; k++) {
      const budget = Array.from({ length: n }, (_, i) => 0.5 * ulp(v(out.stateAfter, i)[k]) * out.pm).reduce((a, b) => a + b, 0)
        + 0.5 * ulp(P(out.frameAfter)[k]) + 1e-12;
      report[`budget${k}`] = budget;
      assert.ok(Math.abs(after[k] - before[k]) <= budget, `M1: momentum ${k}: ${before[k]} -> ${after[k]} (budget ${budget})`);
    }
    assert.ok(P(out.frameAfter)[1] > 0, 'M1: the body is pushed up');
    // M2 and M3.
    const memberCount = out.world.length / 8;
    let dL = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      if (out.roles[i] !== 'approach') continue;
      const x = out.stateBefore.slice(i * 8, i * 8 + 3);
      const dv = v(out.stateAfter, i).map((c, k) => c - v(out.stateBefore, i)[k]);
      const J = dv.map(c => c * out.pm);
      for (let m = 0; m < memberCount; m++) {
        const xm = out.world.slice(m * 8, m * 8 + 3);
        const off = x.map((c, k) => c - xm[k]); const d = Math.hypot(...off);
        if (!(d < out.a + out.radius)) continue;
        const normal = off.map(c => c / d);
        // Relative to the body's post-impulse velocity (the reaction is shared
        // through m_eff = 1/(1/m_p + 1/M)).
        const bodyV = P(out.frameAfter).map(q => q / out.frameAfter[3]);
        const vn = v(out.stateAfter, i).reduce((s, c, k) => s + (c - bodyV[k]) * normal[k], 0);
        const goal = Math.min(out.law.baumgarte * Math.max(out.a + out.radius - d - out.law.slopM, 0) / out.dt, out.law.maxBiasSpeedMPerS);
        assert.ok(vn >= goal - 1e-5, `M2: particle ${i} v_n ${vn} reaches the target ${goal}`);
        const c = xm.map((q, k) => q + normal[k] * out.a);
        const lever = c.map((q, k) => q - com(out.frameBefore)[k]);
        const r = J.map(q => -q);
        dL = dL.map((q, k) => q + [lever[1] * r[2] - lever[2] * r[1], lever[2] * r[0] - lever[0] * r[2], lever[0] * r[1] - lever[1] * r[0]][k]);
      }
    }
    const measuredL = L(out.frameAfter).map((q, k) => q - L(out.frameBefore)[k]);
    report.dL = { expected: dL, measured: measuredL };
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(measuredL[k] - dL[k]) <= 1e-9 + 1e-4 * Math.abs(dL[k]), `M3: angular ${k}`);
    // M4.
    out.roles.forEach((role, i) => {
      if (role === 'approach') return;
      assert.deepEqual(v(out.stateAfter, i), v(out.stateBefore, i).map(Math.fround), `M4: ${role} particle untouched`);
    });
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
});
