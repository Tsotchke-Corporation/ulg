import assert from 'node:assert/strict';
import test from 'node:test';

test('GPU response values, gradients and Hessians share one strict tensor and reject invalid tables', {
  skip: process.env.ULG_RUN_NATIVE_RESPONSE_DIFFERENTIAL !== '1', timeout: 180000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    const base = process.env.ULG_RESPONSE_FUNCTION_GPU_BASE_URL || 'https://127.0.0.1:5173/';
    await page.route(url => url.href === base, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>GPU differential evidence</title>' }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    result = await page.evaluate(async () => {
      let adapter;
      for (let i = 0; i < 5 && !adapter; i++) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise(resolve => setTimeout(resolve, 300));
      }
      if (!adapter) throw new Error('Native WebGPU adapter unavailable');
      const device = await adapter.requestDevice();
      const errors = [];
      device.addEventListener('uncapturederror', event => errors.push(event.error.message));
      device.pushErrorScope('validation');
      const { packResponseFunctionsForGpu, responseFunctionGpuWgsl } = await import('/src/runtime/material/responseFunctionGpu.js');
      // Explicit nonphysical tensor coefficients. Expected values/derivatives
      // are evaluated independently on the GPU; no particle payload is mapped.
      const fn = (domains, terms, entries) => {
        const n = [1, 1, 1]; terms.forEach((v, i) => { n[i] = v; });
        const coefficients = new Array(n[0] * n[1] * n[2]).fill(0);
        for (const [i, j, k, c] of entries) coefficients[(i * n[1] + j) * n[2] + k] = c;
        return { axes: domains.map(([lo, hi], a) => ({ lo, hi, degree: n[a] - 1 })), coefficients,
          residuals: { relativeBound: 0 } };
      };
      const valid = [
        fn([[-2, 6]], [1], [[0, 0, 0, 5]]),
        fn([[2, 6]], [3], [[0, 0, 0, 2], [1, 0, 0, 3], [2, 0, 0, 4]]),
        fn([[-4, 4], [3, 3.5]], [3, 3], [[0, 0, 0, 1], [2, 0, 0, 1], [0, 1, 0, 2], [1, 2, 0, 3]]),
        fn([[10, 14], [-0.125, 0.125], [-8, 8]], [2, 3, 4],
          [[0, 0, 0, 1.5], [1, 0, 0, 2], [0, 2, 0, 0.5], [1, 1, 1, 1], [0, 0, 1, 0.375], [0, 0, 3, 0.125]]),
        fn([[-1, 1]], [32], [[31, 0, 0, 1]]),
        fn([[0, 1e-20], [0, 1e-20], [-1, 1]], [1, 1, 1], [[0, 0, 0, 7]])
      ];
      const bad = 11;
      const packed = packResponseFunctionsForGpu([...valid, ...Array.from({ length: bad }, () => valid[1])]);
      const data = packed.data;
      const row = i => 4 + (valid.length + i) * 16;
      data[row(0)] = 0; data[row(1)] = 4;
      data[row(2) + 2] = 0; data[row(3) + 2] = 33;
      data[row(4) + 6] = data[row(4) + 5];
      data[row(5) + 1] = data.length;
      data[row(6) + 1] = 0.5;
      data[row(7) + 11] = -1;
      data[row(8) + 6] = Infinity;
      data[data[1] + data[row(9) + 1]] = NaN;
      data[row(10) + 5] = -3e38; data[row(10) + 6] = 3e38;
      const table = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(table, 0, data);
      const proof = device.createBuffer({ size: 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      const read = device.createBuffer({ size: 64, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      const code = `
@group(0) @binding(0) var<storage, read> rf_table: array<f32>;
@group(0) @binding(1) var<storage, read_write> proof: array<atomic<u32>>;
${responseFunctionGpuWgsl()}
var<private> proof_case: u32;
fn compare(actual: f32, expected: f32) {
  let error = abs(actual - expected) / max(1.0, abs(expected));
  if (!(error <= 3.0e-5)) { atomicAdd(&proof[0], 1u); atomicAdd(&proof[8u + proof_case], 1u); }
  if (rf_finite(error)) { atomicMax(&proof[3], bitcast<u32>(error)); }
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= 6u * 33u + ${bad}u + 3u) { return; }
  if (id.x >= 6u * 33u) {
    let test_id = id.x - 6u * 33u;
    var index = 6u + test_id;
    var point = vec3<f32>(3.0, 0.0, 0.0);
    if (test_id == ${bad}u) { index = 1000000u; }
    if (test_id == ${bad + 1}u) { index = 1u; point.x = 6.001; }
    if (test_id == ${bad + 2}u) { index = 2u; point = vec3<f32>(0.0, 3.501, 0.0); }
    let value = rf_eval(index, point);
    let response = rf_eval_differential(index, point);
    if (value.y != 0.0 || response.ok != 0u) { atomicAdd(&proof[0], 1u); }
    atomicAdd(&proof[2], 1u);
    return;
  }
  let index = id.x / 33u;
  proof_case = index;
  let q = id.x % 33u;
  var t = vec3<f32>(-1.0 + f32(q) / 16.0, -1.0 + f32((q * 7u) % 33u) / 16.0,
    -1.0 + f32((q * 11u) % 33u) / 16.0);
  if (index == 4u) { t.x = select(-1.0, 1.0, (q & 1u) != 0u); }
  var x = vec3<f32>(0.0);
  var scale = vec3<f32>(0.0);
  let r = 4u + index * 16u;
  for (var a = 0u; a < u32(rf_table[r]); a++) {
    let lo = rf_table[r + 5u + 2u * a];
    let width = rf_table[r + 6u + 2u * a] - lo;
    x[a] = lo + (t[a] + 1.0) * 0.5 * width;
    scale[a] = 2.0 / width;
  }
  var value = 5.0;
  var gradient = vec3<f32>(0.0);
  var hessian = mat3x3<f32>();
  if (index == 1u) {
    value = 2.0 + 3.0 * t.x + 4.0 * (2.0 * t.x * t.x - 1.0);
    gradient.x = 3.0 + 16.0 * t.x; hessian[0][0] = 16.0;
  }
  if (index == 2u) {
    value = 1.0 + (2.0 * t.x * t.x - 1.0) + 2.0 * t.y + 3.0 * t.x * (2.0 * t.y * t.y - 1.0);
    gradient = vec3<f32>(4.0 * t.x + 3.0 * (2.0 * t.y * t.y - 1.0), 2.0 + 12.0 * t.x * t.y, 0.0);
    hessian[0][0] = 4.0; hessian[1][1] = 12.0 * t.x; hessian[0][1] = 12.0 * t.y; hessian[1][0] = hessian[0][1];
  }
  if (index == 3u) {
    value = 1.0 + 2.0 * t.x + t.y * t.y + t.x * t.y * t.z + 0.5 * t.z * t.z * t.z;
    gradient = vec3<f32>(2.0 + t.y * t.z, 2.0 * t.y + t.x * t.z, t.x * t.y + 1.5 * t.z * t.z);
    hessian = mat3x3<f32>(vec3<f32>(0.0, t.z, t.y), vec3<f32>(t.z, 2.0, t.x), vec3<f32>(t.y, t.x, 3.0 * t.z));
  }
  if (index == 4u) { value = t.x; gradient.x = 961.0; hessian[0][0] = 307520.0 * t.x; }
  if (index == 5u) { value = 7.0; }
  gradient *= scale;
  let result = rf_eval_differential(index, x);
  let ordinary = rf_eval(index, x);
  if (result.ok != 1u || ordinary.y != 1.0) { atomicAdd(&proof[0], 1u); }
  compare(result.value, value); compare(ordinary.x, value); compare(result.value, ordinary.x);
  for (var column = 0u; column < 3u; column++) {
    compare(result.gradient[column], gradient[column]);
    hessian[column] = (hessian[column] * scale) * scale[column];
    for (var row = 0u; row < 3u; row++) {
      compare(result.hessian[column][row], hessian[column][row]);
      if (result.hessian[column][row] != result.hessian[row][column]) { atomicAdd(&proof[4], 1u); }
    }
  }
  atomicAdd(&proof[1], 1u);
}`;
      const module = device.createShaderModule({ code });
      const compilation = (await module.getCompilationInfo()).messages.filter(m => m.type === 'error').map(m => m.message);
      if (compilation.length) { device.destroy(); return { compilation, errors }; }
      const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
      const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: table } }, { binding: 1, resource: { buffer: proof } }] });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(4); pass.end(); encoder.copyBufferToBuffer(proof, 0, read, 0, 64);
      device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ);
      const words = Array.from(new Uint32Array(read.getMappedRange().slice(0))); read.unmap();
      const validation = await device.popErrorScope();
      device.destroy();
      return { words, compilation, errors, validation: validation?.message ?? null };
    });
  } finally { await browser.close(); }
  console.log(JSON.stringify(result));
  assert.deepEqual(result.compilation, []);
  assert.deepEqual(result.errors, []);
  assert.equal(result.validation, null);
  assert.equal(result.words[0], 0, 'all numerical and invalid-input checks');
  assert.equal(result.words[1], 198);
  assert.equal(result.words[2], 14);
  assert.equal(result.words[4], 0, 'symmetric Hessian');
});
