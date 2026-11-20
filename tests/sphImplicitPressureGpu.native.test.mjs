// Native gate for the A1 larger-dt slice's canonical implicit pressure module:
// the WGSL compiles, a divergence-free grid velocity is a fixed point, and a
// compressive field loses most of its particle divergence at c dt / dx = 4.
//
// Run: ULG_RUN_NATIVE_IMPLICIT_PRESSURE=1 node --test tests/sphImplicitPressureGpu.native.test.mjs
// (HTTPS dev server on 5173; override with ULG_IMPLICIT_PRESSURE_BASE_URL.)
import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_IMPLICIT_PRESSURE === '1';
const BASE_URL = process.env.ULG_IMPLICIT_PRESSURE_BASE_URL || 'https://127.0.0.1:5173/';

test('canonical implicit pressure: compiles, keeps div-free flow, removes compression', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_IMPLICIT_PRESSURE=1 to run on native WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let out;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 5 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 500));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice({ requiredLimits: {
        maxStorageBuffersPerShaderStage: Math.min(12, adapter.limits.maxStorageBuffersPerShaderStage) } });
      device.pushErrorScope('validation');
      const ip = await import('/src/runtime/sph/sphImplicitPressureGpu.js');
      const compileErrors = await ip.sphImplicitPressureCompilationErrors(device);
      const h = 0.1, shift = 2, box = [0.7, 0.7, 0.7];
      const dims = box.map((b) => Math.round(b / h) + 5);
      const gridSpec = { gridSpacingM: h, boxDimsM: box, shift, gridDims: dims,
        gridNodeCount: dims[0] * dims[1] * dims[2] };
      const spacing = h / 2, rho0 = 1000, c = 50, dt = 0.008;
      const positions = [];
      for (let x = 0.2 + spacing / 2; x < 0.5; x += spacing)
        for (let y = 0.2 + spacing / 2; y < 0.5; y += spacing)
          for (let z = 0.2 + spacing / 2; z < 0.5; z += spacing) positions.push([x, y, z]);
      const n = positions.length, vol = spacing ** 3, mass = rho0 * vol;
      const state = new Float32Array(n * 8), thermo = new Float32Array(n * 12), mech = new Float32Array(n * 32);
      positions.forEach((p, i) => {
        state.set([...p, mass], i * 8);
        thermo[i * 12 + 3] = rho0;
        mech.set([0, 0, 1, vol], i * 32 + 16); // row4: J = 1, V0
        mech.set([0, c, 1, 0], i * 32 + 24); // row6: c, Tait
      });
      const weights = (fx) => [0.5 * (1.5 - fx) ** 2, 0.75 - (fx - 1) ** 2, 0.5 * (fx - 0.5) ** 2];
      const index = (i, j, k) => ((i + shift) * dims[1] + (j + shift)) * dims[2] + (k + shift);
      const stencil = (p, visit) => {
        const g = p.map((v) => v / h), b = g.map((v) => Math.floor(v - 0.5));
        const w = g.map((v, a) => weights(v - b[a]));
        for (let a = 0; a < 3; a += 1) for (let bb = 0; bb < 3; bb += 1) for (let cc = 0; cc < 3; cc += 1) {
          const node = [b[0] + a, b[1] + bb, b[2] + cc];
          visit(index(...node), w[0][a] * w[1][bb] * w[2][cc], node.map((v, d) => (v - g[d]) * h));
        }
      };
      const nodeMass = new Float64Array(gridSpec.gridNodeCount);
      positions.forEach((p) => stencil(p, (idx, w) => { nodeMass[idx] += w * mass; }));
      const run = async (field, extraOptions = {}) => {
        const grid = new Float32Array(gridSpec.gridNodeCount * 8);
        for (let i = -shift; i < dims[0] - shift; i += 1) for (let j = -shift; j < dims[1] - shift; j += 1)
          for (let k = -shift; k < dims[2] - shift; k += 1) {
            const idx = index(i, j, k), pos = [i * h, j * h, k * h];
            if (nodeMass[idx] > 0) grid.set([nodeMass[idx], ...field(pos)], idx * 8);
            grid.set([...pos, nodeMass[idx] > 0 ? 1 : 0], idx * 8 + 4);
          }
        const S = GPUBufferUsage;
        const upload = (data, usage = S.STORAGE | S.COPY_DST) => {
          const b = device.createBuffer({ size: data.byteLength, usage });
          device.queue.writeBuffer(b, 0, data);
          return b;
        };
        const buffers = { state: upload(state), thermo: upload(thermo), mech: upload(mech),
          grid: upload(grid, S.STORAGE | S.COPY_DST | S.COPY_SRC) };
        const read = device.createBuffer({ size: grid.byteLength, usage: S.MAP_READ | S.COPY_DST });
        const encoder = device.createCommandEncoder();
        const dispatches = ip.encodeSphImplicitPressureSolve(device, encoder, {
          options: ip.normalizeSphImplicitPressureOptions({ iterations: 20, cflSafety: 4, ...extraOptions }),
          stateBuffer: buffers.state, thermoBuffer: buffers.thermo, mechanicsBuffer: buffers.mech,
          gridBuffer: buffers.grid, gridSpec, particleCount: n, dt });
        encoder.copyBufferToBuffer(buffers.grid, 0, read, 0, grid.byteLength);
        device.queue.submit([encoder.finish()]);
        await read.mapAsync(GPUMapMode.READ);
        const result = new Float32Array(read.getMappedRange().slice(0));
        read.unmap();
        Object.values(buffers).forEach((b) => b.destroy()); read.destroy();
        const divergence = (g) => positions.map((p) => {
          let div = 0;
          stencil(p, (idx, w, dpos) => {
            if (!(g[idx * 8] > 0)) return;
            div += 4 / (h * h) * w * (g[idx * 8 + 1] * dpos[0] + g[idx * 8 + 2] * dpos[1] + g[idx * 8 + 3] * dpos[2]);
          });
          return div;
        });
        const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
        let maxChange = 0;
        for (let i = 0; i < gridSpec.gridNodeCount; i += 1) for (let d = 1; d < 4; d += 1)
          maxChange = Math.max(maxChange, Math.abs(result[i * 8 + d] - grid[i * 8 + d]));
        let hash = 0x811c9dc5;
        for (const word of new Uint32Array(result.buffer)) hash = Math.imul(hash ^ word, 0x01000193) >>> 0;
        return { dispatches, before: rms(divergence(grid)), after: rms(divergence(result)), maxChange,
          finite: Array.from(result).every(Number.isFinite), hash };
      };
      const uniform = await run(() => [1, -0.5, 0.25]);
      const compressive = await run((pos) => pos.map((v) => -(v - 0.35)));
      const compressiveJacobi = await run((pos) => pos.map((v) => -(v - 0.35)), { jacobi: true });
      const compressiveRepeat = await run((pos) => pos.map((v) => -(v - 0.35)));
      const compressiveClosedForm = await run((pos) => pos.map((v) => -(v - 0.35)), { stiffnessSource: 'closed-form' });
      const validation = await device.popErrorScope();
      device.destroy();
      return { status: 'ran', particles: n, compileErrors, uniform, compressive, compressiveJacobi, compressiveRepeat, compressiveClosedForm,
        cflNumber: c * dt / h,
        validation: validation?.message ?? null };
    });
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(out));
  assert.equal(out.status, 'ran');
  assert.deepEqual(out.compileErrors, []);
  assert.equal(out.validation, null, out.validation);
  // Uniform velocity: every particle's divergence is exactly representable as ~0.
  assert.equal(out.uniform.finite, true);
  // CG on an f32-noise residual (the divergence stays at noise level).
  assert.ok(out.uniform.maxChange < 5e-5, `uniform flow changed by ${out.uniform.maxChange}`);
  assert.ok(out.uniform.after < 1e-5, `uniform flow divergence ${out.uniform.after}`);
  // Fixed-point scatter sums and fixed-order reductions: bit-reproducible.
  assert.equal(out.compressiveRepeat.hash, out.compressive.hash);
  // Eshkol-derived K (default) and the closed form agree to f32 noise.
  assert.ok(Math.abs(out.compressiveClosedForm.after - out.compressive.after) <= 1e-4 * out.compressive.after,
    `Eshkol table ${out.compressive.after} vs closed form ${out.compressiveClosedForm.after}`);
  // Compression: backward Euler at c dt/dx = 4 leaves div ~ 1/(1 + (c dt/dx)^2 ...) of the start.
  assert.equal(out.compressive.finite, true);
  // The converged backward-Euler answer leaves 4.3% of the divergence (f32
  // reference 0.1295 of 3.0); a quantization fault left 6.2% and moved one
  // node by 43 m/s, so both are bounded.
  assert.ok(out.compressive.after < 0.05 * out.compressive.before,
    `divergence ${out.compressive.before} -> ${out.compressive.after}`);
  assert.ok(out.compressive.maxChange < 2, `compressive velocity change ${out.compressive.maxChange}`);
});
