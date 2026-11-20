import assert from 'node:assert/strict';
import test from 'node:test';

// A5 SOL-2 body-body contact gates (plan/todo/sol-critic.md "SOL-2"), on the
// WGSL rigid lane with member contact proxies:
//   C1 head-on collision (no gravity): the two bodies' exact impulse ledgers
//      sum to zero (equal and opposite), they separate, no deep penetration;
//   C2 glancing collision: total angular momentum about the origin and linear
//      momentum are conserved to f32, both bodies spin up;
//   C3 stacking under gravity: a cube resting on a cube on the floor settles,
//      neither sinks into the other nor drifts.
// ULG_RUN_NATIVE_SOLID_RIGID=1, with the HTTPS dev server running.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const H = 1e-3, PITCH = 0.02, RADIUS = 0.01, G = 9.80665;

test('native rigid lane: SOL-2 body-body collision, glancing and stacking gates', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SOLID_RIGID=1 for native Vulkan WebGPU',
  timeout: 600_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let out;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    out = await page.evaluate(async ({ H, PITCH, RADIUS, G }) => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const errors = [];
      device.addEventListener('uncapturederror', (e) => { if (errors.length < 10) errors.push(String(e.error?.message ?? e).slice(0, 300)); });
      const solid = await import('/src/runtime/sph/schroederSolidRigidGpu.js');
      const info = await device.createShaderModule({ code: solid.schroederSolidRigidWgsl() }).getCompilationInfo();
      const compileErrors = info.messages.filter((m) => m.type === 'error').map((m) => `${m.lineNum}:${m.linePos} ${m.message}`);
      if (compileErrors.length) { device.destroy(); return { status: 'compile-error', compileErrors }; }
      const cube = (origin, n = 3) => {
        const members = [];
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
          members.push({ x: [origin[0] + PITCH * i, origin[1] + PITCH * j, origin[2] + PITCH * k], massKg: 0.01 });
        }
        return members;
      };
      const make = (data) => { const b = device.createBuffer({ size: data.byteLength, usage: 0x80 | 0x04 | 0x08 });
        device.queue.writeBuffer(b, 0, data); return b; };
      const read = async (buffer) => {
        const copy = device.createBuffer({ size: buffer.size, usage: 1 | 8 });
        const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, 0, copy, 0, buffer.size);
        device.queue.submit([encoder.finish()]); await copy.mapAsync(1);
        const words = Array.from(new Uint32Array(copy.getMappedRange().slice(0))); copy.unmap(); copy.destroy(); return words;
      };
      const scene = async ({ bodies, gravity, steps, sampleEvery = 0 }) => {
        const seeds = bodies.map((b, i) => solid.seedSchroederSolidRigidBody({ bodyId: i, members: b.members,
          velocity: b.velocity ?? [0, 0, 0], angularVelocity: b.angularVelocity ?? [0, 0, 0] }));
        const packed = solid.packSchroederSolidRigidBodies(seeds);
        const frameBuffer = make(packed.frames), memberBuffer = make(packed.members);
        const { proxies, proxyCount } = solid.packSchroederSolidContactProxies(seeds, { radiusM: RADIUS });
        const proxyBuffer = make(proxies);
        const stage = solid.createSchroederSolidRigidStage({ device, bodyCount: seeds.length, memberCount: packed.memberCount,
          frameBuffer, memberBuffer, proxyBuffer, proxyCount, gravity, boxM: [5, 5, 5] });
        const samples = [];
        for (let s = 0; s < steps; s++) {
          const encoder = device.createCommandEncoder(); stage.encode(encoder, H); device.queue.submit([encoder.finish()]);
          if (sampleEvery && (s + 1) % sampleEvery === 0) samples.push(await read(frameBuffer));
        }
        const result = { seeds, initial: Array.from(new Uint32Array(packed.frames)), frames: await read(frameBuffer),
          ledger: await read(stage.impulseLedgerBuffer), members: await read(stage.memberWorldBuffer), samples };
        stage.destroy();
        return result;
      };
      const result = {};
      // C1: head-on along x, 2 cm apart surface to surface, closing at 1 m/s.
      result.headOn = await scene({ gravity: [0, 0, 0], steps: 200, sampleEvery: 2, bodies: [
        { members: cube([2.0, 2.0, 2.0]), velocity: [0.5, 0, 0] },
        { members: cube([2.0 + 2 * PITCH + 2 * RADIUS + 0.02, 2.0, 2.0]), velocity: [-0.5, 0, 0] }] });
      // C2: glancing: offset by one pitch in y.
      result.glancing = await scene({ gravity: [0, 0, 0], steps: 200, bodies: [
        { members: cube([2.0, 2.0, 2.0]), velocity: [0.5, 0, 0] },
        { members: cube([2.0 + 2 * PITCH + 2 * RADIUS + 0.02, 2.0 + PITCH, 2.0]), velocity: [-0.5, 0, 0] }] });
      // C3: stack: bottom cube on the floor, top cube 1 mm above it.
      result.stack = await scene({ gravity: [0, -G, 0], steps: 1500, sampleEvery: 100, bodies: [
        { members: cube([2.0, RADIUS, 2.0]) },
        { members: cube([2.005, RADIUS + 2 * PITCH + 2 * RADIUS + 0.001, 2.0]) }] });
      device.destroy();
      return { status: 'ran', errors, result };
    }, { H, PITCH, RADIUS, G });
  } finally {
    await browser.close();
  }
  assert.notEqual(out.status, 'unsupported', 'WebGPU adapter unavailable');
  assert.notEqual(out.status, 'compile-error', `rigid WGSL compiles: ${JSON.stringify(out.compileErrors)}`);
  assert.deepEqual(out.errors, []);
  const f32 = (words) => new Float32Array(Uint32Array.from(words).buffer);
  const frames = (words) => { const f = f32(words); const n = f.length / 32;
    return Array.from({ length: n }, (_, b) => { const o = b * 32;
      return { x: [f[o], f[o + 1], f[o + 2]], m: f[o + 3], p: [f[o + 8], f[o + 9], f[o + 10]], l: [f[o + 12], f[o + 13], f[o + 14]] }; }); };
  const W = 9;
  const exactRow = (words, row) => { let v = 0n; for (let i = W - 1; i >= 0; i--) v = (v << 32n) | BigInt(words[row * W + i] >>> 0);
    if (v >= 1n << BigInt(32 * W - 1)) v -= 1n << BigInt(32 * W); return v; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const report = {};
  const minMemberGap = (words) => { const f = f32(words); const n = f.length / 8; let min = Infinity;
    const half = n / 2;
    for (let i = 0; i < half; i++) for (let j = half; j < n; j++) {
      const d = Math.hypot(f[i * 8] - f[j * 8], f[i * 8 + 1] - f[j * 8 + 1], f[i * 8 + 2] - f[j * 8 + 2]) - 2 * RADIUS;
      if (d < min) min = d;
    }
    return min; };
  // C1
  { const r = out.result.headOn; const [a, b] = frames(r.frames);
    const sumRows = [0, 1, 2].map((k) => exactRow(r.ledger, k) + exactRow(r.ledger, 3 + k));
    const relative = (b.p[0] / b.m) - (a.p[0] / a.m);
    report.headOn = { va: a.p[0] / a.m, vb: b.p[0] / b.m, relativeAfter: relative, ledgerSum: sumRows.map(String),
      impulseX: Number(exactRow(r.ledger, 0)) * 2 ** -149, minGap: minMemberGap(r.members) };
    assert.deepEqual(sumRows, [0n, 0n, 0n], 'C1: equal and opposite exact impulses');
    assert.ok(report.headOn.impulseX < 0, 'C1: body A was pushed back');
    assert.ok(relative > 0, `C1: the bodies separate (relative ${relative})`);
    assert.ok(report.headOn.minGap > -3e-3, `C1: penetration ${report.headOn.minGap}`); }
  // C2
  { const r = out.result.glancing; const init = frames(r.initial); const fin = frames(r.frames);
    const L = (fs) => fs.reduce((acc, fr) => { const c = cross(fr.x, fr.p); return acc.map((v, k) => v + c[k] + fr.l[k]); }, [0, 0, 0]);
    const P = (fs) => fs.reduce((acc, fr) => acc.map((v, k) => v + fr.p[k]), [0, 0, 0]);
    const l0 = L(init), l1 = L(fin), p0 = P(init), p1 = P(fin);
    const scale = Math.hypot(...init.map((fr) => Math.hypot(...fr.p))) * 2.0;
    report.glancing = { dL: Math.hypot(...l1.map((v, k) => v - l0[k])) / scale, dP: Math.hypot(...p1.map((v, k) => v - p0[k])),
      spin: fin.map((fr) => Math.hypot(...fr.l)) };
    assert.deepEqual([0, 1, 2].map((k) => exactRow(r.ledger, k) + exactRow(r.ledger, 3 + k)), [0n, 0n, 0n]);
    assert.ok(report.glancing.dL < 1e-4, `C2: angular momentum drift ${report.glancing.dL}`);
    assert.ok(report.glancing.dP < 1e-6, `C2: linear momentum drift ${report.glancing.dP}`);
    assert.ok(report.glancing.spin.every((s) => s > 1e-7), 'C2: both bodies spin up'); }
  // C3
  { const r = out.result.stack; const fin = frames(r.frames); const ys = r.samples.map((w) => frames(w)[1].x[1]);
    const contactY = RADIUS + 2 * 0.02 / 2 + 0 ; // bottom COM at radius + pitch (3x3x3, centre layer)
    const ke = fin.reduce((s, fr) => s + Math.hypot(...fr.p) ** 2 / (2 * fr.m), 0);
    report.stack = { bottomY: fin[0].x[1], topY: fin[1].x[1], separation: fin[1].x[1] - fin[0].x[1], tail: ys.slice(-5), ke,
      minGap: minMemberGap(r.members) };
    // Centre-to-centre at rest: three pitches (two half-cubes plus one contact diameter, 2 r = pitch).
    assert.ok(Math.abs(report.stack.separation - 3 * 0.02) < 2e-3, `C3: stack separation ${report.stack.separation}`);
    assert.ok(Math.max(...ys.slice(-5)) - Math.min(...ys.slice(-5)) < 5e-4, `C3: the top cube settles (${ys.slice(-5)})`);
    assert.ok(ke < 1e-4, `C3: residual kinetic energy ${ke}`);
    assert.ok(report.stack.minGap > -2e-3, `C3: penetration ${report.stack.minGap}`); }
  console.log(JSON.stringify(report));
});
