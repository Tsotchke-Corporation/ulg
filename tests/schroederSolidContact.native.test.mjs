import assert from 'node:assert/strict';
import test from 'node:test';

// G3 SOL-1 Phase 1 contact gates (plan/todo/g3-solids-proposal.md), on the
// actual WGSL rigid lane with box-wall contact proxies; budgets declared below.
//   G1 free fall before contact matches the discrete kick-drift solution;
//   G2 a body resting on a face neither sinks, creeps nor spins;
//   G3 a tilted spinning drop bounces, settles, does not penetrate beyond
//      budget, and closes momentum: dP - N h m g = exact contact impulse;
//   G4 swapping the contact-proxy set mid-rest keeps mass/moments bit-identical
//      and injects no impulse.
// ULG_RUN_NATIVE_SOLID_RIGID=1, with the HTTPS dev server running. Run it in a
// memory-capped scope (see the ulg-native-test-oom-crash note).
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const G = 9.80665, H = 1e-3, RADIUS = 0.025;

test('native Vulkan rigid lane: free fall, rest, drop and proxy-swap contact gates', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SOLID_RIGID=1 for native Vulkan WebGPU',
  timeout: 600_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const out = await page.evaluate(async ({ G, H, RADIUS }) => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const errors = []; let errorCount = 0;
      device.addEventListener('uncapturederror', e => { if (errorCount++ < 20) errors.push(String(e.error?.message ?? e).slice(0, 500)); });
      const solid = await import('/src/runtime/sph/schroederSolidRigidGpu.js');
      const info = await device.createShaderModule({ code: solid.schroederSolidRigidWgsl() }).getCompilationInfo();
      const compileErrors = info.messages.filter(m => m.type === 'error').map(m => `${m.lineNum}:${m.linePos} ${m.message}`);
      if (compileErrors.length) { device.destroy(); return { status: 'compile-error', compileErrors }; }
      // The asymmetric "L" (14 members, 5 cm pitch); its j = 0 layer (8 members) is a flat face.
      const cells = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [0, 1, 0], [0, 2, 0], [0, 3, 0], [1, 1, 0],
        [0, 0, 1], [1, 0, 1], [2, 0, 1], [0, 1, 1], [0, 2, 1], [3, 0, 1]];
      const membersAt = y0 => cells.map(([i, j, k], n) => ({ x: [2.0 + 0.05 * i, y0 + 0.05 * j, 2.0 + 0.05 * k],
        massKg: Math.fround(0.1 + 0.013 * ((n * 7) % 11)), layer: j }));
      const read = async buffer => {
        const copy = device.createBuffer({ size: buffer.size, usage: 1 | 8 });
        const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, 0, copy, 0, buffer.size);
        device.queue.submit([encoder.finish()]); await copy.mapAsync(1);
        const words = Array.from(new Uint32Array(copy.getMappedRange().slice(0))); copy.unmap(); copy.destroy(); return words;
      };
      const make = data => { const b = device.createBuffer({ size: data.byteLength, usage: 0x80 | 0x04 | 0x08 });
        device.queue.writeBuffer(b, 0, data); return b; };
      const body = ({ y0, velocity, angularVelocity }) => {
        const members = membersAt(y0);
        const seed = solid.seedSchroederSolidRigidBody({ bodyId: 3, members, velocity, angularVelocity });
        const packed = solid.packSchroederSolidRigidBodies([seed]);
        return { seed, members, packed, frameBuffer: make(packed.frames), memberBuffer: make(packed.members) };
      };
      const stageFor = (b, memberFilter = null) => {
        const { proxies, proxyCount } = solid.packSchroederSolidContactProxies([b.seed], { radiusM: RADIUS,
          memberFilter: memberFilter ? (member, index) => memberFilter(b.members[index]) : null });
        const proxyBuffer = make(proxies);
        const stage = solid.createSchroederSolidRigidStage({ device, bodyCount: 1, memberCount: b.packed.memberCount,
          frameBuffer: b.frameBuffer, memberBuffer: b.memberBuffer, proxyBuffer, proxyCount, gravity: [0, -G, 0], boxM: [5, 5, 5] });
        return { stage, proxyBuffer, proxyCount };
      };
      const steps = async (stage, n, sampleEvery, frameBuffer, samples) => {
        for (let i = 0; i < n; i++) {
          const encoder = device.createCommandEncoder(); stage.encode(encoder, H); device.queue.submit([encoder.finish()]);
          if (sampleEvery && (i + 1) % sampleEvery === 0) samples.push(await read(frameBuffer));
        }
      };
      const result = {};
      // G1: free fall from COM height ~3.5 m, 300 steps (the body stays > 2 m up).
      { const b = body({ y0: 3.45, velocity: [0, 0, 0], angularVelocity: [0, 0, 0] });
        const { stage } = stageFor(b); const samples = [];
        await steps(stage, 300, 0, b.frameBuffer, samples);
        result.fall = { seed: b.seed, frame: await read(b.frameBuffer), ledger: await read(stage.impulseLedgerBuffer) };
        stage.destroy(); }
      // G2: resting on the j = 0 face: member centres at y = RADIUS touch the floor.
      { const b = body({ y0: RADIUS, velocity: [0, 0, 0], angularVelocity: [0, 0, 0] });
        const { stage } = stageFor(b); const samples = [];
        await steps(stage, 3000, 100, b.frameBuffer, samples);
        result.rest = { seed: b.seed, samples, reductions: await read(stage.reductionBuffer), memberWorld: await read(stage.memberWorldBuffer) };
        stage.destroy(); }
      // G3: tilted spinning drop from ~1 m.
      { const b = body({ y0: 1.0, velocity: [0.3, 0, -0.2], angularVelocity: [2.0, 1.0, 3.0] });
        const { stage } = stageFor(b); const samples = [];
        await steps(stage, 5000, 10, b.frameBuffer, samples);
        result.drop = { seed: b.seed, samples, ledger: await read(stage.impulseLedgerBuffer),
          memberWorld: await read(stage.memberWorldBuffer), steps: 5000 };
        stage.destroy(); }
      // G4: rest 1,000 steps with all-member proxies, then 1,000 with the bottom layer only.
      { const b = body({ y0: RADIUS, velocity: [0, 0, 0], angularVelocity: [0, 0, 0] });
        const all = stageFor(b); const before = [], after = [];
        await steps(all.stage, 1000, 50, b.frameBuffer, before);
        const reductionsAll = await read(all.stage.reductionBuffer); all.stage.destroy();
        const bottom = stageFor(b, member => member.layer === 0);
        await steps(bottom.stage, 1000, 10, b.frameBuffer, after);
        result.swap = { before, after, proxyCounts: [all.proxyCount, bottom.proxyCount],
          massRows: [reductionsAll.slice(0, 9), (await read(bottom.stage.reductionBuffer)).slice(0, 9)] };
        bottom.stage.destroy(); }
      device.destroy();
      return { status: 'ran', errors, errorCount, result };
    }, { G, H, RADIUS });
    assert.notEqual(out.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.notEqual(out.status, 'compile-error', `rigid WGSL compiles: ${JSON.stringify(out.compileErrors)}`);
    assert.deepEqual(out.errors, [], `no GPU validation errors (${out.errorCount})`);
    const f32 = words => new Float32Array(Uint32Array.from(words).buffer);
    const frameOf = words => { const f = f32(words);
      return { x: [f[0], f[1], f[2]], m: f[3], q: [f[4], f[5], f[6], f[7]], p: [f[8], f[9], f[10]], l: [f[12], f[13], f[14]], I: [f[16], f[17], f[18]] }; };
    const rotInv = (q, v) => { const [x, y, z, w] = [-q[0], -q[1], -q[2], q[3]];
      const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
      return [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])]; };
    const omegaOf = fr => { const pi = rotInv(fr.q, fr.l); return Math.hypot(pi[0] / fr.I[0], pi[1] / fr.I[1], pi[2] / fr.I[2]); };
    const speed = fr => Math.hypot(...fr.p) / fr.m;
    const W = 9;
    const exactValue = (words, row) => { let v = 0n; for (let i = W - 1; i >= 0; i--) v = (v << 32n) | BigInt(words[row * W + i] >>> 0);
      if (v >= 1n << BigInt(32 * W - 1)) v -= 1n << BigInt(32 * W); return Number(v) * 2 ** -149; };
    const failures = [];
    const check = (cond, msg) => { if (!cond) failures.push(msg); };
    const checkEqual = (a, b, msg) => { if (a !== b) failures.push(`${msg}: ${a} vs ${b}`); };
    const checkDeepEqual = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) failures.push(msg); };
    const report = {};

    // G1: y_n = y0 - g h^2 n (n + 1) / 2 for kick-drift; f32 budget 1e-4 m over 300 steps.
    { const fr = frameOf(out.result.fall.frame), n = 300, y0 = out.result.fall.seed.centerOfMass[1];
      const expected = y0 - G * H * H * n * (n + 1) / 2;
      report.fall = { y: fr.x[1], expected };
      check(Math.abs(fr.x[1] - expected) <= 1e-4, `G1: free-fall y ${fr.x[1]} vs ${expected}`);
      checkEqual(exactValue(out.result.fall.ledger, 1), 0, 'G1: no contact impulse before contact');
    }
    // G2: rest 3 s. Budgets: speed <= 2e-3 m/s, spin <= 2e-2 rad/s at the end;
    // sinking <= slop + 1 mm; horizontal creep <= 1e-4 m.
    { const r = out.result.rest, frames = r.samples.map(frameOf), first = r.seed.centerOfMass, last = frames.at(-1);
      report.rest = { finalSpeed: speed(last), finalSpin: omegaOf(last), dy: last.x[1] - first[1],
        creep: Math.hypot(last.x[0] - first[0], last.x[2] - first[2]), maxSpeed: Math.max(...frames.map(speed)) };
      check(speed(last) <= 2e-3, `G2: resting speed ${speed(last)}`);
      check(omegaOf(last) <= 2e-2, `G2: resting spin ${omegaOf(last)}`);
      check(first[1] - last.x[1] <= 5e-4 + 1e-3, `G2: sinking ${first[1] - last.x[1]}`);
      check(report.rest.creep <= 1e-4, `G2: creep ${report.rest.creep}`);
    }
    // G3: drop and settle.
    { const r = out.result.drop, frames = r.samples.map(frameOf), last = frames.at(-1), m = last.m;
      const world = f32(r.memberWorld);
      const minY = Math.min(...Array.from({ length: world.length / 8 }, (_, i) => world[i * 8 + 1]));
      const t = r.steps * H;
      const impulse = [0, 1, 2].map(k => exactValue(r.ledger, k));
      const expectedDp = [0, 1, 2].map(k => last.p[k] - r.seed.linearMomentum[k] + (k === 1 ? G * m * t : 0));
      const ke = 0.5 * m * speed(last) ** 2;
      const upward = frames.map(f => f.p[1] / f.m);
      report.drop = { finalSpeed: speed(last), finalSpin: omegaOf(last), minMemberY: minY, impulse, expectedDp,
        maxUpwardSpeed: Math.max(...upward), finalKe: ke };
      check(Math.max(...upward) > 0.05, 'G3: the body bounces (restitution)');
      check(ke <= 1e-3 * m * G * 1.0, `G3: settled kinetic energy ${ke}`);
      check(omegaOf(last) <= 5e-2, `G3: settled spin ${omegaOf(last)}`);
      // Member centres may not sink below the floor contact by more than slop + 2 mm.
      check(minY >= RADIUS - 5e-4 - 2e-3, `G3: penetration ${RADIUS - minY}`);
      // Momentum: P(t) - P(0) + m g t = sum of contact impulses; f32 budget 1e-3 m g t.
      for (let k = 0; k < 3; k++) check(Math.abs(expectedDp[k] - impulse[k]) <= 1e-3 * m * G * t,
        `G3: momentum balance ${k}: ${expectedDp[k]} vs ${impulse[k]}`);
    }
    // G4: proxy swap.
    { const s = out.result.swap, after = s.after.map(frameOf), before = s.before.map(frameOf);
      report.swap = { proxyCounts: s.proxyCounts, maxSpeedAfter: Math.max(...after.map(speed)),
        maxSpinAfter: Math.max(...after.map(omegaOf)), speedBefore: speed(before.at(-1)) };
      checkDeepEqual(s.massRows[0], s.massRows[1], 'G4: exact member mass unchanged by the proxy set');
      checkDeepEqual(after.at(-1).I, before.at(-1).I, 'G4: principal moments unchanged');
      check(report.swap.maxSpeedAfter <= 2e-3, `G4: no impulse injected by the swap: ${report.swap.maxSpeedAfter}`);
      check(report.swap.maxSpinAfter <= 2e-2, `G4: no spin injected by the swap: ${report.swap.maxSpinAfter}`);
    }
    console.log(JSON.stringify(report));
    assert.deepEqual(failures, [], 'all contact gates pass');
  } finally { await browser.close(); }
});
