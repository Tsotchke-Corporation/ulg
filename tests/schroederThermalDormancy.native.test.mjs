import assert from 'node:assert/strict';
import test from 'node:test';

// G4 slice 1 gate (plan/todo/g4-dynamic-laws-proposal.md): the conservative
// thermal dormancy predicate (src/runtime/sph/schroederThermalDormancyGpu.js).
//   D1 uniform temperature: every present source is dormant (zero-work witness);
//   D2 a two-temperature field with sub-epsilon noise: every pair within the
//      conduction support whose |dT| exceeds epsilon has BOTH endpoints
//      active (exhaustive host check of the GPU flags), and the active set is
//      confined to the interface region;
//   D3 a hot floor: sources within the wall support of it are active;
//   zero-mass rows are never counted.
// ULG_RUN_NATIVE_SOLID_RIGID=1 (shares the G3 native flag); run memory-capped.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('native Vulkan thermal dormancy predicate is pair-conservative', {
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
      const device = await adapter.requestDevice();
      const errors = []; let errorCount = 0;
      device.addEventListener('uncapturederror', e => { if (errorCount++ < 20) errors.push(String(e.error?.message ?? e).slice(0, 500)); });
      const dormancy = await import('/src/runtime/sph/schroederThermalDormancyGpu.js');
      const info = await device.createShaderModule({ code: dormancy.schroederThermalDormancyWgsl }).getCompilationInfo();
      const bad = info.messages.filter(m => m.type === 'error').map(m => `${m.lineNum}:${m.linePos} ${m.message}`);
      if (bad.length) { device.destroy(); return { status: 'compile-error', compileErrors: bad }; }
      // Deterministic pseudo-random positions in a 2 m box; every 17th row is empty.
      const n = 4000; let seed = 12345;
      const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
      const positions = Array.from({ length: n }, () => [0.02 + 1.96 * rand(), 0.02 + 1.96 * rand(), 0.02 + 1.96 * rand()]);
      const masses = positions.map((_, i) => i % 17 === 0 ? 0 : 0.01);
      const run = async ({ temperature, uncertainty = null, walls }) => {
        const state = new Float32Array(n * 8);
        const thermoFloats = n * 12 + (uncertainty ? n : 0);
        const thermo = new Float32Array(thermoFloats);
        positions.forEach((p, i) => {
          state.set([...p, masses[i]], i * 8);
          thermo.set([1, 2, temperature(p, i), 1000], i * 12);
          if (uncertainty) thermo[n * 12 + i] = uncertainty(p, i);
        });
        const make = data => { const b = device.createBuffer({ size: data.byteLength, usage: 0x80 | 0x08 }); device.queue.writeBuffer(b, 0, data); return b; };
        const stateBuffer = make(state), thermoBuffer = make(thermo);
        const stage = dormancy.createSchroederThermalDormancyStage({ device, particleCount: n, boxM: [2, 2, 2],
          cellEdgeM: 0.25, epsilonK: 0.01, wallSupportM: 0.1, wallTemperaturesK: walls,
          uncertaintyWordOffset: uncertainty ? n * 12 : null });
        const e = device.createCommandEncoder(); stage.encode(e, { stateBuffer, thermoBuffer }); device.queue.submit([e.finish()]);
        const read = async b => { const c = device.createBuffer({ size: b.size, usage: 1 | 8 }); const x = device.createCommandEncoder();
          x.copyBufferToBuffer(b, 0, c, 0, b.size); device.queue.submit([x.finish()]); await c.mapAsync(1);
          const w = Array.from(new Uint32Array(c.getMappedRange().slice(0))); c.unmap(); c.destroy(); return w; };
        const result = { dormant: (await read(stage.dormantBuffer)).slice(0, n), counts: (await read(stage.countBuffer)).slice(0, 4),
          temperatures: positions.map((p, i) => Math.fround(temperature(p, i))) };
        stage.destroy(); stateBuffer.destroy(); thermoBuffer.destroy();
        return result;
      };
      const uniform = await run({ temperature: () => 300, walls: [0, 0, 0, 0, 0, 0] });
      // Two regions (x < 1 at 300 K, x >= 1 at 310 K) with noise below epsilon / 4.
      const step = await run({ temperature: (p, i) => (p[0] < 1 ? 300 : 310) + 0.0025 * ((i * 7919) % 1000) / 1000,
        walls: [0, 0, 0, 0, 0, 0] });
      const wall = await run({ temperature: () => 300, walls: [0, 0, 400, 0, 0, 0] });
      // D4: G6 empirical uncertainty interval [T - dT, T + dT] stays dormant when
      // 2*dT <= epsilon (0.004 <= 0.01) and activates conservatively when 2*dT > epsilon (0.016 > 0.01).
      const uncSmall = await run({ temperature: () => 300, uncertainty: () => 0.002, walls: [0, 0, 0, 0, 0, 0] });
      const uncStraddle = await run({ temperature: () => 300, uncertainty: () => 0.008, walls: [0, 0, 0, 0, 0, 0] });
      const uncWall = await run({ temperature: () => 300, uncertainty: () => 0.004, walls: [0, 0, 300.008, 0, 0, 0] });
      device.destroy();
      return { status: 'ran', errors, errorCount, positions, masses, uniform, step, wall, uncSmall, uncStraddle, uncWall };
    });
    assert.notEqual(out.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.notEqual(out.status, 'compile-error', `dormancy WGSL compiles: ${JSON.stringify(out.compileErrors)}`);
    assert.deepEqual(out.errors, [], `no GPU validation errors (${out.errorCount})`);
    const present = out.masses.filter(m => m > 0).length;
    const report = {};
    // D1.
    report.uniform = out.uniform.counts;
    assert.deepEqual(out.uniform.counts.slice(0, 3), [0, present, present], 'D1: all present sources dormant');
    // D2: exhaustive pair check within the conduction support (0.2 m <= cell edge).
    { const s = out.step, support2 = 0.2 ** 2; let violations = 0, hotPairs = 0;
      for (let a = 0; a < out.positions.length; a++) {
        if (!(out.masses[a] > 0)) continue;
        for (let b = a + 1; b < out.positions.length; b++) {
          if (!(out.masses[b] > 0)) continue;
          const d2 = out.positions[a].reduce((sum, v, k) => sum + (v - out.positions[b][k]) ** 2, 0);
          if (d2 > support2) continue;
          if (Math.abs(s.temperatures[a] - s.temperatures[b]) > 0.01) {
            hotPairs++;
            if (s.dormant[a] || s.dormant[b]) violations++;
          }
        }
      }
      const activeXs = out.positions.filter((p, i) => out.masses[i] > 0 && !s.dormant[i]).map(p => p[0]);
      report.step = { counts: s.counts, hotPairs, violations, activeXRange: [Math.min(...activeXs), Math.max(...activeXs)] };
      assert.ok(hotPairs > 0, 'D2: the field has pairs above epsilon');
      assert.equal(violations, 0, 'D2: every above-epsilon pair has both endpoints active');
      // Active sources lie within two cells (0.5 m) of the interface at x = 1.
      assert.ok(Math.min(...activeXs) >= 0.5 - 1e-6 && Math.max(...activeXs) <= 1.5 + 1e-6, 'D2: activity confined to the interface region');
      assert.ok(s.counts[1] > 0, 'D2: far regions stay dormant');
    }
    // D3: the hot floor activates sources within its 0.1 m support, and only those.
    { const w = out.wall;
      for (let i = 0; i < out.positions.length; i++) {
        if (!(out.masses[i] > 0)) continue;
        const nearFloor = out.positions[i][1] <= 0.1;
        assert.equal(w.dormant[i] === 0, nearFloor, `D3: source ${i} wall activation`);
      }
      report.wall = w.counts;
    }
    // D4: conservative G6 uncertainty intervals.
    assert.deepEqual(out.uncSmall.counts.slice(0, 3), [0, present, present],
      'D4: sub-epsilon uncertainty band (2*dT < eps) remains dormant');
    assert.deepEqual(out.uncStraddle.counts.slice(0, 3), [present, 0, present],
      'D4: uncertainty straddling epsilon (2*dT > eps) activates conservatively');
    { const uw = out.uncWall;
      for (let i = 0; i < out.positions.length; i++) {
        if (!(out.masses[i] > 0)) continue;
        const nearFloor = out.positions[i][1] <= 0.1;
        assert.equal(uw.dormant[i] === 0, nearFloor, `D4: wall + uncertainty activates near-floor source ${i}`);
      }
      report.uncertainty = { small: out.uncSmall.counts, straddle: out.uncStraddle.counts, wall: uw.counts };
    }
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
});
