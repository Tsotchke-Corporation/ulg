import assert from 'node:assert/strict';
import test from 'node:test';

// G3 SOL-0 GPU invariant gates (plan/todo/g3-solids-proposal.md), on the
// actual WGSL rigid lane (src/runtime/sph/schroederSolidRigidGpu.js) with
// exact GPU reductions; no CPU mirror of the dynamics.
//   A  translation across >= 100 cells of 0.1 m: pose, pair distances,
//      orientation, exact mass, inertia and momentum invariants;
//   B  torque-free tumbling of an asymmetric body: world L bit-constant,
//      member-reduced L, bounded energy error without secular drift,
//      quaternion norm;
//   C  driven rotation: L(t) = tau t;
//   D  metamorphic: permuted members x workgroup sizes 32/64/128 give
//      bit-identical exact reductions and frames.
// Every budget is declared below with its derivation.
// ULG_RUN_NATIVE_SOLID_RIGID=1, with the HTTPS dev server running.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const ULP = x => 2 ** (Math.floor(Math.log2(Math.max(Math.abs(x), 2 ** -126))) - 23);

test('native Vulkan rigid lane keeps SOL-0 invariants within declared budgets', {
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
      const errors = [];
      // Capped: an invalid shader raises one error per dispatch, and an uncapped
      // list returned to node exhausted memory (OOM, 2026-11-14).
      let errorCount = 0;
      device.addEventListener('uncapturederror', e => { if (errorCount++ < 20) errors.push(String(e.error?.message ?? e).slice(0, 500)); });
      const solid = await import('/src/runtime/sph/schroederSolidRigidGpu.js');
      // Fail fast on a shader that does not compile, before any dispatch.
      for (const workgroupSize of [32, 64, 128]) {
        const info = await device.createShaderModule({ code: solid.schroederSolidRigidWgsl({ workgroupSize }) }).getCompilationInfo();
        const compileErrors = info.messages.filter(m => m.type === 'error').slice(0, 5)
          .map(m => `${m.lineNum}:${m.linePos} ${m.message}`.slice(0, 300));
        if (compileErrors.length) { device.destroy(); return { status: 'compile-error', compileErrors }; }
      }
      // An asymmetric 3D "L" of 14 members with unequal masses (5 cm pitch).
      const cells = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [0, 1, 0], [0, 2, 0], [0, 3, 0], [1, 1, 0],
        [0, 0, 1], [1, 0, 1], [2, 0, 1], [0, 1, 1], [0, 2, 1], [3, 0, 1]];
      const baseMembers = cells.map(([i, j, k], n) => ({ x: [0.2 + 0.05 * i, 0.3 + 0.05 * j, 0.25 + 0.05 * k],
        massKg: Math.fround(0.1 + 0.013 * ((n * 7) % 11)) }));
      const read = async buffer => {
        const copy = device.createBuffer({ size: buffer.size, usage: 1 | 8 });
        const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, 0, copy, 0, buffer.size);
        device.queue.submit([encoder.finish()]); await copy.mapAsync(1);
        const words = Array.from(new Uint32Array(copy.getMappedRange().slice(0))); copy.unmap(); copy.destroy(); return words;
      };
      const f32 = words => Array.from(new Float32Array(Uint32Array.from(words).buffer));
      const run = async ({ members, velocity = [0, 0, 0], angularVelocity = [0, 0, 0], torque = [0, 0, 0],
        steps, dt = 1e-3, workgroupSize = 64, sampleEvery = 0, order = null }) => {
        const seed = solid.seedSchroederSolidRigidBody({ bodyId: 7, members, velocity, angularVelocity });
        // A metamorphic order permutes the packed member rows of the same seed.
        const packed = solid.packSchroederSolidRigidBodies([order ? { ...seed, members: order.map(i => seed.members[i]) } : seed]);
        const make = data => { const b = device.createBuffer({ size: data.byteLength, usage: 0x80 | 0x04 | 0x08 });
          device.queue.writeBuffer(b, 0, data); return b; };
        const frameBuffer = make(packed.frames), memberBuffer = make(packed.members);
        const stage = solid.createSchroederSolidRigidStage({ device, bodyCount: 1, memberCount: packed.memberCount,
          frameBuffer, memberBuffer, torque, workgroupSize });
        const samples = [];
        for (let step = 0; step < steps; step++) {
          const encoder = device.createCommandEncoder(); stage.encode(encoder, dt); device.queue.submit([encoder.finish()]);
          if (sampleEvery && (step + 1) % sampleEvery === 0) samples.push(f32(await read(frameBuffer)));
        }
        const result = { seed, frame: await read(frameBuffer), reductions: await read(stage.reductionBuffer),
          memberWorld: f32(await read(stage.memberWorldBuffer)), samples };
        stage.destroy(); frameBuffer.destroy(); memberBuffer.destroy();
        return result;
      };
      // A: 10 m/s for 1 s = 10 m = 100 cells of 0.1 m, many subcell offsets.
      const translation = await run({ members: baseMembers, velocity: [10, 0.37, -0.21], steps: 1000 });
      // B: tumbling near the intermediate axis (Dzhanibekov), 10,000 steps.
      const tumbling = await run({ members: baseMembers, angularVelocity: [0.02, 6.0, 0.03], steps: 10000, sampleEvery: 100 });
      // C: driven rotation from rest.
      const driven = await run({ members: baseMembers, torque: [0.002, -0.001, 0.0005], steps: 2000 });
      // D: permutations x workgroup sizes, 500 tumbling steps each.
      const n = baseMembers.length;
      const orders = [['base', null], ['reversed', baseMembers.map((_, i) => n - 1 - i)],
        ['shuffled', baseMembers.map((_, i) => (i * 5) % n)]];
      const metamorphic = [];
      for (const [label, order] of orders) {
        for (const workgroupSize of [32, 64, 128]) {
          const r = await run({ members: baseMembers, angularVelocity: [0.02, 6.0, 0.03], steps: 500, workgroupSize, order });
          metamorphic.push({ label, workgroupSize, frame: r.frame, reductions: r.reductions });
        }
      }
      device.destroy();
      return { status: 'ran', errors, baseMembers, translation, tumbling, driven, metamorphic };
    });
    assert.notEqual(out.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.notEqual(out.status, 'compile-error', `rigid WGSL compiles: ${JSON.stringify(out.compileErrors)}`);
    assert.deepEqual(out.errors, [], 'no GPU validation errors');
    const W = 9, ROWS = 16;
    const exact = (words, row) => { let v = 0n; for (let i = W - 1; i >= 0; i--) v = (v << 32n) | BigInt(words[row * W + i] >>> 0);
      return v >= 1n << BigInt(32 * W - 1) ? v - (1n << BigInt(32 * W)) : v; };
    const value = (words, row) => Number(exact(words, row)) * 2 ** -149;
    const frameOf = words => { const f = new Float32Array(Uint32Array.from(words).buffer);
      return { x: [f[0], f[1], f[2]], m: f[3], q: [f[4], f[5], f[6], f[7]], p: [f[8], f[9], f[10]], l: [f[12], f[13], f[14]],
        I: [f[16], f[17], f[18]] }; };
    const rot = (q, v) => { const [x, y, z, w] = q; const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
      return [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])]; };
    const rotInv = (q, v) => rot([-q[0], -q[1], -q[2], q[3]], v);
    const energy = fr => { const pi = rotInv(fr.q, fr.l); return 0.5 * (pi[0] ** 2 / fr.I[0] + pi[1] ** 2 / fr.I[1] + pi[2] ** 2 / fr.I[2]); };
    const relErr = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-30);
    // Exact mass: the GPU exact sum must equal the exact sum of the f32 masses.
    const massQuanta = out.baseMembers.reduce((s, m) => s + BigInt(Math.round(Math.fround(m.massKg) * 2 ** 149)), 0n);

    // A: translation.
    { const r = out.translation, fr = frameOf(r.frame), seed = r.seed;
      const t = 1.0, v = [10, 0.37, -0.21];
      for (let k = 0; k < 3; k++) {
        const expected = seed.centerOfMass[k] + v[k] * t;
        // f32 position update rounds once per step: budget 0.5 ulp(|x|) per step.
        assert.ok(Math.abs(fr.x[k] - expected) <= 1000 * 0.5 * ULP(expected) + 1e-6 * Math.abs(v[k] * t),
          `A: com[${k}] ${fr.x[k]} vs ${expected}`);
      }
      // Zero spin: each step multiplies by the identity and renormalizes, so
      // the orientation may move only by renormalization rounding.
      for (let k = 0; k < 4; k++) assert.ok(Math.abs(fr.q[k] - Math.fround(seed.quaternion[k])) <= 1e-6, 'A: orientation unchanged');
      assert.ok(Math.abs(Math.hypot(...fr.q) - 1) <= 1e-6, 'A: unit quaternion');
      assert.equal(exact(r.reductions, 0), massQuanta, 'A: exact member mass sum');
      // Pair distances from regenerated members vs rest geometry: 8 ulp of |x|.
      const world = i => r.memberWorld.slice(i * 8, i * 8 + 3);
      const restD = (i, j) => Math.hypot(...[0, 1, 2].map(k => seed.members[i].rest[k] - seed.members[j].rest[k]));
      let maxPair = 0;
      for (let i = 0; i < seed.members.length; i++) for (let j = i + 1; j < seed.members.length; j++) {
        maxPair = Math.max(maxPair, Math.abs(Math.hypot(...[0, 1, 2].map(k => world(i)[k] - world(j)[k])) - restD(i, j)));
      }
      assert.ok(maxPair <= 8 * ULP(10.5), `A: pair distances within 8 ulp(|x|): ${maxPair}`);
      console.log(JSON.stringify({ gate: 'A', com: fr.x, expected: seed.centerOfMass.map((c, k) => c + v[k] * t), maxPairError: maxPair,
        budget: 8 * ULP(10.5), q: fr.q }));
      // Momentum from members (exact sum of rounded m v) vs the frame: 1e-6.
      for (let k = 0; k < 3; k++) assert.ok(relErr(value(r.reductions, 4 + k), fr.p[k]) <= 1e-6, `A: momentum ${k}`);
      // World inertia from members vs R diag(I) R^T: 1e-6 relative to the largest moment.
      const Iw = [10, 11, 12].map(k => value(r.reductions, k));
      for (let k = 0; k < 3; k++) {
        const axis = [0, 0, 0]; axis[k] = 1;
        const b = rotInv(fr.q, axis); const e = b[0] ** 2 * fr.I[0] + b[1] ** 2 * fr.I[1] + b[2] ** 2 * fr.I[2];
        assert.ok(Math.abs(Iw[k] - e) <= 1e-6 * fr.I[2], `A: world inertia ${k}: ${Iw[k]} vs ${e}`);
      }
    }
    // B: torque-free tumbling.
    { const r = out.tumbling, fr = frameOf(r.frame), l0 = r.seed.angularMomentum.map(Math.fround);
      assert.deepEqual(fr.l, l0, 'B: world angular momentum bit-constant without torque');
      for (let k = 0; k < 3; k++) assert.ok(relErr(value(r.reductions, 7 + k), fr.l[k]) <= 1e-5 || Math.abs(value(r.reductions, 7 + k) - fr.l[k]) <= 1e-5 * Math.hypot(...fr.l),
        `B: member-reduced L ${k}: ${value(r.reductions, 7 + k)} vs ${fr.l[k]}`);
      const frames = r.samples.map(s => frameOf(Array.from(new Uint32Array(Float32Array.from(s).buffer))));
      const energies = frames.map(energy);
      const seedE = (() => { const fr0 = { q: r.seed.quaternion, l: r.seed.angularMomentum, I: r.seed.principalMoments }; return energy(fr0); })();
      const errs = energies.map(e => relErr(e, seedE));
      // DLM is second order: energy error O((h omega)^2) with omega <= 6 rad/s,
      // h = 1e-3: (h omega)^2 = 3.6e-5; budget 1e-4, and no secular growth.
      const half = Math.floor(errs.length / 2);
      const firstMax = Math.max(...errs.slice(0, half)), secondMax = Math.max(...errs.slice(half));
      assert.ok(Math.max(firstMax, secondMax) <= 1e-4, `B: energy error ${Math.max(firstMax, secondMax)}`);
      assert.ok(secondMax <= 2 * firstMax + 1e-6, `B: no secular energy drift (${firstMax} then ${secondMax})`);
      for (const f of frames) assert.ok(Math.abs(Math.hypot(...f.q) - 1) <= 1e-6, 'B: unit quaternion');
      // The intermediate-axis spin must actually tumble (the body's axis flips).
      const pis = frames.map(f => rotInv(f.q, f.l));
      console.log(JSON.stringify({ gate: 'B', energyErrorFirstHalf: firstMax, energyErrorSecondHalf: secondMax,
        minPi2: Math.min(...pis.map(p => p[1])), maxPi2: Math.max(...pis.map(p => p[1])),
        lMembers: [7, 8, 9].map(k => value(r.reductions, k)), lFrame: fr.l }));
      assert.ok(pis.some(pi => pi[1] < 0), 'B: Dzhanibekov flip observed (body-frame L2 changes sign)');
    }
    // C: driven rotation: L = tau t, accumulated in f32 (one rounding per half kick).
    { const fr = frameOf(out.driven.frame), tau = [0.002, -0.001, 0.0005], t = 2.0;
      console.log(JSON.stringify({ gate: 'C', l: fr.l, expected: tau.map(x => x * t) }));
      for (let k = 0; k < 3; k++) assert.ok(Math.abs(fr.l[k] - tau[k] * t) <= 4000 * ULP(tau[k] * t), `C: L ${k}: ${fr.l[k]} vs ${tau[k] * t}`);
    }
    // D: metamorphic invariance (bit-identical).
    { const ref = out.metamorphic[0];
      for (const m of out.metamorphic) {
        assert.deepEqual(m.frame, ref.frame, `D: frame identical for ${m.label}/wg${m.workgroupSize}`);
        assert.deepEqual(m.reductions.slice(0, ROWS * W), ref.reductions.slice(0, ROWS * W),
          `D: exact reductions identical for ${m.label}/wg${m.workgroupSize}`);
      }
    }
  } finally { await browser.close(); }
});
