import assert from 'node:assert/strict';
import test from 'node:test';
import { createSchroederQuadraticControlVolumeDescriptor } from '../ulg-gpu-abi/src/schroederQuadraticControlVolumeProjection.js';
import { schroederQuadraticControlVolumeProjectionWgsl } from '../ulg-gpu-abi/src/schroederQuadraticControlVolumeProjectionWgsl.js';

// Manufactured geometry and GPU reductions only. No CPU occupancy, gas solver,
// pressure path, hot-state readback, or CPU/GPU parity acceptance architecture.
const variants = [];
for (const translation of [0, 33554432, -33554432]) {
  for (const [lc, lf, uc, uf] of [[0, 0, 4, 0], [0, 0.125, 5, 0.875],
    [0, 0, 0, 2 ** -28], [0, 0.5 - 2 ** -24, 0, 0.5 + 2 ** -23],
    [0, 1 - 2 ** -20, 1, 2 ** -20], [0, 0.125, 12, 0.375]]) {
    variants.push({ lc: lc + translation, lf, uc: uc + translation, uf });
  }
}
// Deterministic f32 boundary fractions exercise split intervals independently
// of the JS geometry helper. Keep this manufactured GPU workload bounded.
let seed = 0x51c091a3;
const randomWord = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed;
};
for (let index = 0; index < 48; index += 1) {
  const lc = [0, 33554432, -33554432][index % 3];
  const lf = (randomWord() & 0xffff) / 65536;
  const span = 1 + randomWord() % 12;
  const uf = (randomWord() & 0xffff) / 65536;
  variants.push({ lc, lf, uc: lc + span, uf });
}
const floatBits = (v) => new Uint32Array(new Float32Array([v]).buffer)[0];
const inputWords = variants.flatMap(({ lc, lf, uc, uf }) => [lc >>> 0, floatBits(lf), uc >>> 0, floatBits(uf)]);
// Read NaN from storage so WGSL's constant evaluator does not reject it before
// the production finite guard can execute.
inputWords.push(0x7fc00000);
const descriptor = createSchroederQuadraticControlVolumeDescriptor({
  gridSpacingM: 0.5, gridDims: [8, 8, 8], gridNodeCount: 512,
  gridShift: 2, selectedLevel: 1, chartId: 7,
  boxMinM: [0.125, 0.25, 0.375], boxMaxM: [2.125, 2.25, 2.375]
});
const shader = /* wgsl */ `${schroederQuadraticControlVolumeProjectionWgsl}
@group(0) @binding(0) var<storage, read> cases: array<u32>;
@group(0) @binding(1) var<storage, read_write> result: array<u32>;
fn pressure(cell: i32, base: i32) -> f32 {
  let k = cell - base;
  // A missing sparse cell is ambient zero gauge, not a renormalized sample.
  if (k == 1) { return 0.0; }
  return f32((k * 13 + 7) % 11) * 0.25 - 1.0;
}
fn node_value(node: i32, base: i32) -> f32 { return 0.125 + f32(node - base + 3) * 0.25; }
fn parent_weight(fine: i32, coarse: i32) -> f32 {
  if (fine == coarse) { return 0.75; }
  if ((fine + 1) % 3 == coarse) { return 0.25; }
  return 0.0;
}
@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let j = id.x * 4u; let out = id.x * 16u;
  let lc = bitcast<i32>(cases[j]); let lf = bitcast<f32>(cases[j + 1u]);
  let uc = bitcast<i32>(cases[j + 2u]); let uf = bitcast<f32>(cases[j + 3u]);
  var failures = 0u; var capacity_sum = 0.0; var max_partition = 0.0;
  var positive_nodes = 0u; var lhs = 0.0; var rhs = 0.0; var max_uniform = 0.0;
  var max_relative_uniform = 0.0;
  for (var node = lc - 2; node <= uc + 2; node++) {
    let p = qcv_axis_projection(node, lc, lf, uc, uf);
    if (p.valid != 1u) { failures++; }
    if (p.capacity > 0.0) {
      positive_nodes++;
      capacity_sum += p.capacity;
      max_partition = max(max_partition, abs(p.weight0 + p.weight1 - 1.0));
      if (p.weight0 <= 0.0 || p.weight1 < 0.0 || p.capacity > 1.0) { failures++; }
      let sample = p.weight0 * pressure(p.cell0, lc) + p.weight1 * pressure(p.cell1, lc);
      rhs += node_value(node, lc) * sample;
    }
  }
  for (var cell = lc; cell <= uc; cell++) {
    var volume = 0.0; var arbitrary = 0.0;
    for (var node = lc - 2; node <= uc + 2; node++) {
      let p = qcv_axis_projection(node, lc, lf, uc, uf);
      var weight = 0.0;
      if (cell == p.cell0) { weight += p.weight0; }
      if (cell == p.cell1) { weight += p.weight1; }
      volume += p.capacity * weight;
      arbitrary += node_value(node, lc) * weight;
    }
    let geometric = qcv_primal_axis_extent(cell, lc, lf, uc, uf);
    let uniform_error = abs(volume - geometric);
    max_uniform = max(max_uniform, uniform_error);
    if (geometric > 0.0) {
      max_relative_uniform = max(max_relative_uniform, uniform_error / geometric);
    } else if (volume != 0.0) {
      failures++;
    }
    lhs += arbitrary * pressure(cell, lc);
  }
  // Independent traversal orders for the manufactured A/W adjoint: forward
  // gathers parent volume before W, transpose samples W then gathers A^T.
  var composed_forward = 0.0; var composed_transpose = 0.0;
  for (var cell = lc; cell <= uc; cell++) {
    var deposited = 0.0;
    for (var coarse = 0; coarse < 3; coarse++) {
      var parent_volume = 0.0;
      for (var fine = 0; fine < 3; fine++) { parent_volume += f32(fine + 1) * parent_weight(fine, coarse); }
      let p = qcv_axis_projection(lc + coarse - 1, lc, lf, uc, uf);
      if (cell == p.cell0) { deposited += parent_volume * p.weight0; }
      if (cell == p.cell1) { deposited += parent_volume * p.weight1; }
    }
    composed_forward += deposited * pressure(cell, lc);
  }
  for (var fine = 0; fine < 3; fine++) {
    var sample = 0.0;
    for (var coarse = 0; coarse < 3; coarse++) {
      let p = qcv_axis_projection(lc + coarse - 1, lc, lf, uc, uf);
      sample += parent_weight(fine, coarse) * (p.weight0 * pressure(p.cell0, lc) + p.weight1 * pressure(p.cell1, lc));
    }
    composed_transpose += f32(fine + 1) * sample;
  }
  let bad = qcv_axis_projection(lc, lc, bitcast<f32>(cases[arrayLength(&cases) - 1u]), uc, uf);
  let halo = qcv_axis_projection(-1, 0, 0.0, 4, 0.0);
  let middle = qcv_axis_projection(1, 0, 0.0, 4, 0.0);
  let folded = halo.capacity + qcv_axis_projection(0, 0, 0.0, 4, 0.0).capacity + 0.5 * middle.capacity;
  let bounds = array<u32, 12>(${descriptor.boundsWords.map((w) => `${w}u`).join(', ')});
  result[out] = failures; result[out + 1u] = positive_nodes;
  result[out + 2u] = bitcast<u32>(capacity_sum);
  result[out + 3u] = bitcast<u32>(qcv_pair_width(lc, lf, uc, uf));
  result[out + 4u] = bitcast<u32>(max_uniform);
  result[out + 5u] = bitcast<u32>(max_partition);
  result[out + 6u] = bitcast<u32>(lhs - rhs);
  result[out + 7u] = bitcast<u32>(composed_forward - composed_transpose);
  result[out + 8u] = bad.valid;
  result[out + 9u] = bitcast<u32>(halo.capacity);
  result[out + 10u] = bitcast<u32>(folded);
  result[out + 11u] = bitcast<u32>(middle.weight0 * 3.0);
  result[out + 12u] = qcv_descriptor_seal(1u, 0.5, vec3<i32>(-2), vec3<u32>(8u), 512u, 7u, 1, bounds);
  result[out + 13u] = bitcast<u32>(qcv_primal_axis_center_fraction(lc, lc, lf, uc, uf));
  result[out + 14u] = bitcast<u32>(max_relative_uniform);
}
`;

test('native quadratic projection preserves geometry, conservation, W/A adjoints and sparse ambient pressure', {
  skip: process.env.ULG_RUN_NATIVE_QCV === '1' ? false : 'set ULG_RUN_NATIVE_QCV=1 for native WebGPU',
  timeout: 180_000
}, async (t) => {
  const { chromium } = await import('@playwright/test');
  const headless = process.env.ULG_QCV_HEADLESS !== '0';
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', ...(headless ? [] : ['--ozone-platform=wayland'])] });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(new URL('/package.json', process.env.ULG_QCV_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/').href);
    const evidence = await page.evaluate(async ({ code, words, count }) => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported', secureContext: isSecureContext };
      const device = await adapter.requestDevice();
      const errors = [];
      device.addEventListener('uncapturederror', (e) => errors.push(e.error.message));
      const module = device.createShaderModule({ code });
      const messages = (await module.getCompilationInfo()).messages.filter((m) => m.type === 'error').map((m) => m.message);
      if (messages.length) { device.destroy(); return { status: 'compile-failed', messages }; }
      const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
      const input = device.createBuffer({ size: words.length * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      const output = device.createBuffer({ size: count * 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      const read = device.createBuffer({ size: count * 64, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(input, 0, new Uint32Array(words));
      const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: input } }, { binding: 1, resource: { buffer: output } }] });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, bind);
      pass.dispatchWorkgroups(count); pass.end(); encoder.copyBufferToBuffer(output, 0, read, 0, count * 64);
      device.queue.submit([encoder.finish()]); await read.mapAsync(GPUMapMode.READ);
      const rows = Array.from(new Uint32Array(read.getMappedRange())); read.unmap();
      input.destroy(); output.destroy(); read.destroy(); device.destroy();
      return { status: 'ok', rows, errors, adapter: { vendor: adapter.info?.vendor,
        architecture: adapter.info?.architecture, fallback: adapter.info?.isFallbackAdapter ?? adapter.isFallbackAdapter ?? false } };
    }, { code: shader, words: inputWords, count: variants.length });
    assert.equal(evidence.status, 'ok', JSON.stringify(evidence));
    assert.equal(evidence.adapter.fallback, false);
    assert.deepEqual(evidence.errors, []);
    const floats = new Float32Array(new Uint32Array(evidence.rows).buffer);
    for (let i = 0; i < variants.length; i++) {
      const o = i * 16, context = JSON.stringify({ variant: variants[i], rows: evidence.rows.slice(o, o + 16), floats: Array.from(floats.slice(o, o + 16)) });
      assert.equal(evidence.rows[o], 0, context);
      assert.ok(evidence.rows[o + 1] >= 3, context);
      assert.ok(Math.abs(floats[o + 2] - floats[o + 3]) <= 2e-6 * floats[o + 3], context);
      assert.ok(floats[o + 4] <= 5e-7, context);
      assert.ok(floats[o + 14] <= 2e-6, context);
      assert.equal(floats[o + 5], 0, context);
      assert.ok(Math.abs(floats[o + 6]) <= 1e-5, context);
      assert.ok(Math.abs(floats[o + 7]) <= 2e-6, context);
      assert.equal(evidence.rows[o + 8], 0, context);
      assert.ok(Math.abs(floats[o + 9] - 1 / 48) <= 2e-9, context);
      assert.ok(Math.abs(floats[o + 10] - 97 / 96) <= 1e-7, context);
      assert.ok(floats[o + 11] > 0 && floats[o + 11] < 3, context);
      assert.equal(evidence.rows[o + 12], descriptor.seal, context);
      assert.ok(floats[o + 13] >= variants[i].lf, context);
    }
    t.diagnostic(JSON.stringify({ status: evidence.status, adapter: evidence.adapter,
      cases: variants.length, readbackBytesPerCase: 64, scope: 'shared GPU geometry invariants; not full gas/EOS admission' }));
  } finally { await browser.close(); }
});
