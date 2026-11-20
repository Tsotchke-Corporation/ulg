// A4 resident GPU evaluator: WGSL rf_eval against the host's strict
// evaluateResponseFunction for a 1-D (Eshkol-derived Tait stiffness), 2-D
// (N2 ideal-gas density) and 3-D synthetic response, plus out-of-box refusal.
//
// Run: ULG_RUN_NATIVE_RESPONSE_FUNCTION_GPU=1 node --test tests/responseFunctionGpu.native.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_RESPONSE_FUNCTION_GPU === '1';

test('GPU rf_eval matches the host evaluator and refuses out-of-box points', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_RESPONSE_FUNCTION_GPU=1 to run on native WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let out;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(process.env.ULG_RESPONSE_FUNCTION_GPU_BASE_URL || 'https://127.0.0.1:5173/',
      { waitUntil: 'domcontentloaded', timeout: 60_000 });
    out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 5 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 500));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      device.pushErrorScope('validation');
      const { fitResponseFunction, evaluateResponseFunction } = await import('/src/runtime/material/localClosureFitCache.js');
      const { packResponseFunctionsForGpu, responseFunctionGpuWgsl } = await import('/src/runtime/material/responseFunctionGpu.js');
      const { ESHKOL_TAIT_STIFFNESS_TABLE: T } = await import('/src/runtime/material/eshkolEosStiffnessTable.js');
      const R = 8.314462618, M = 2 * 14.007e-3;
      const fns = [
        // 1-D: the cached Eshkol-derived stiffness as a response function.
        { axes: [{ lo: T.domain[0], hi: T.domain[1], degree: T.degree }], coefficients: T.coefficients,
          residuals: { relativeBound: T.relativeResidualBound } },
        fitResponseFunction({ generator: { id: 'n2', axes: [{ name: 'T', unit: 'K' }, { name: 'P', unit: 'Pa' }],
          outputUnit: 'kg/m^3', sourceFingerprint: 'n2', regimeOf: () => 'gas',
          evaluate: ([t, p]) => p * M / (R * t) }, box: [[300, 1000], [5e4, 2e5]], degrees: [14, 1], relativeTolerance: 1e-6 }),
        fitResponseFunction({ generator: { id: 's3', axes: [{ name: 'x', unit: '1' }, { name: 'y', unit: '1' }, { name: 'z', unit: '1' }],
          outputUnit: '1', sourceFingerprint: 's3', regimeOf: () => 'one',
          evaluate: ([x, y, z]) => Math.exp(0.3 * x) * (1 + 0.2 * y) * (2 + Math.cos(0.5 * z)) },
        box: [[0, 2], [-1, 1], [0, 3]], degrees: [10, 2, 9], relativeTolerance: 1e-6 })
      ];
      const hostEval = (k, xs) => {
        if (k === 0) {
          const t = 2 * (xs[0] - T.domain[0]) / (T.domain[1] - T.domain[0]) - 1;
          if (!(xs[0] >= T.domain[0] && xs[0] <= T.domain[1])) return { ok: false };
          let b1 = 0, b2 = 0;
          for (let j = T.coefficients.length - 1; j >= 1; j--) { const b0 = 2 * t * b1 - b2 + T.coefficients[j]; b2 = b1; b1 = b0; }
          return { ok: true, value: t * b1 - b2 + T.coefficients[0] };
        }
        return evaluateResponseFunction(fns[k], xs.slice(0, fns[k].axes.length));
      };
      const points = [];
      for (let i = 0; i < 300; i += 1) {
        const u = (i * 0.618034) % 1, v = (i * 0.414214) % 1, w = (i * 0.732051) % 1;
        points.push([0, [0.9 + 0.2 * u, 0, 0]], [1, [300 + 700 * u, 5e4 + 1.5e5 * v, 0]], [2, [2 * u, -1 + 2 * v, 3 * w]]);
      }
      // Out-of-box probes on every function.
      points.push([0, [1.2, 0, 0]], [1, [250, 1e5, 0]], [2, [1, 1.5, 1]]);
      const packed = packResponseFunctionsForGpu(fns);
      const table = device.createBuffer({ size: packed.data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(table, 0, packed.data);
      const input = new Float32Array(points.length * 4);
      points.forEach(([k, xs], i) => input.set([...xs, k], i * 4));
      const inBuf = device.createBuffer({ size: input.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(inBuf, 0, input);
      const outBuf = device.createBuffer({ size: points.length * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      const read = device.createBuffer({ size: points.length * 8, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      const module = device.createShaderModule({ code: `
@group(0) @binding(0) var<storage, read> rf_table: array<f32>;
@group(0) @binding(1) var<storage, read> probes: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> results: array<vec2<f32>>;
${responseFunctionGpuWgsl('rf_table')}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= arrayLength(&probes)) { return; }
  let p = probes[id.x];
  results[id.x] = rf_eval(u32(p.w), p.xyz);
}` });
      const errors = (await module.getCompilationInfo()).messages.filter((m) => m.type === 'error').map((m) => m.message);
      const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
      const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: table } }, { binding: 1, resource: { buffer: inBuf } },
        { binding: 2, resource: { buffer: outBuf } }] });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.ceil(points.length / 64)); pass.end();
      encoder.copyBufferToBuffer(outBuf, 0, read, 0, points.length * 8);
      device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ);
      const gpu = new Float32Array(read.getMappedRange().slice(0));
      read.unmap();
      const maxRel = [0, 0, 0];
      let mismatchedOk = 0;
      points.forEach(([k, xs], i) => {
        const host = hostEval(k, xs);
        const ok = gpu[i * 2 + 1] > 0.5;
        if (ok !== Boolean(host.ok)) { mismatchedOk += 1; return; }
        if (ok) maxRel[k] = Math.max(maxRel[k], Math.abs(gpu[i * 2] - host.value) / Math.abs(host.value));
      });
      const validation = await device.popErrorScope();
      device.destroy();
      return { status: 'ran', errors, validation: validation?.message ?? null, maxRel, mismatchedOk,
        refused: [gpu[(points.length - 3) * 2 + 1], gpu[(points.length - 2) * 2 + 1], gpu[(points.length - 1) * 2 + 1]] };
    });
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(out));
  assert.equal(out.status, 'ran');
  assert.deepEqual(out.errors, []);
  assert.equal(out.validation, null, out.validation);
  assert.equal(out.mismatchedOk, 0);
  assert.deepEqual(out.refused, [0, 0, 0]);
  // f32 evaluation of an f64 fit: single-precision agreement.
  out.maxRel.forEach((rel, k) => assert.ok(rel < 2e-6, `function ${k}: GPU vs host relative error ${rel}`));
});
