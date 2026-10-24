import assert from 'node:assert/strict';
import test from 'node:test';
import { ISOSURFACE_MOTION_WGSL } from '../src/visualization/isosurfaceMotionWgsl.js';

// Small authored fields and analytic answers, not a CPU interpolator/solver.
const unit = (v) => v.map((component) => component / Math.hypot(...v));
const uniform = (x) => [3 * (1 + x), -2 * (1 + x), 1 + x, 1 + x];
const hold = { displacement: [0, 0, 0], normal: [1, 0, 0] };
const capDyX = -8 / (17 * Math.sqrt(17));
const capDyY = 32 / (17 * Math.sqrt(17));
const cases = [
  { name: 'weighted-uniform-translation', rows: uniform,
    displacement: [0.3, -0.2, 0.1], normal: [1, 0, 0] },
  { name: 'affine-shear-cofactor', rows: (x, y) => [0.5 * y, 0, 0, 1], scale: 0.25, age: 0.2,
    displacement: [0.04, 0, 0], normal: unit([1, -0.4, 0]) },
  { name: 'quotient-after-interpolation', rows: (x, y) => [12 * y, 0, 0, 1 + 2 * y],
    grid: [0.3, 0.5, 0.5], scale: 0.5, age: 0.2,
    displacement: [0.6, 0, 0], normal: unit([1, -1.2, 0]) },
  { name: 'radial-cap-jacobian', rows: (x, y) => [2, y, 0, 1],
    grid: [0.3, 0.5, 0.5], age: 1, cap: 1,
    displacement: [4 / Math.sqrt(17), 1 / Math.sqrt(17), 0], normal: unit([1 + capDyY, -capDyX, 0]) },
  { name: 'empty-weight-holds', rows: () => [0, 0, 0, 0], ...hold },
  { name: 'weightless-moment-invalid', rows: () => [1, 0, 0, 0], ...hold },
  { name: 'tiny-positive-weight-not-discarded', rows: (x) => uniform(x).map((v) => v * 1e-20),
    displacement: [0.3, -0.2, 0.1], normal: [1, 0, 0] },
  { name: 'collapsed-normal-finite-fallback', rows: (x) => [-x, 0, 0, 1], age: 1,
    grid: [0.25, 0.5, 0.5], sourceNormal: [0, 1, 0], displacement: [-0.25, 0, 0], normal: [0, 1, 0] },
  { name: 'clamped-field-has-zero-outward-derivative', rows: (x, y) => [0.5 * y, 0, 0, 1],
    grid: [0.3, -0.2, 0.5], scale: 0.25, age: 0.2, ...hold },
  { name: 'zero-age-holds', rows: uniform, age: 0, ...hold },
  { name: 'zero-cap-holds', rows: uniform, cap: 0, ...hold },
  { name: 'nonfinite-position-holds', rows: uniform, grid: [NaN, 0.4, 0.5], ...hold },
  { name: 'nonfinite-row-holds', rows: () => [NaN, 0, 0, 1], ...hold },
  { name: 'truncated-sidecar-holds', rows: uniform, truncate: true, ...hold },
  { name: 'overflow-offset-holds', rows: uniform, offset: 0xffffffff, ...hold },
  { name: 'overflow-resolution-holds', rows: uniform, resolution: 0xffffffff, ...hold }
];
const motionRows = new Float32Array(cases.length * 8 * 4);
const inputBytes = new ArrayBuffer(cases.length * 64);
const floats = new Float32Array(inputBytes);
const integers = new Uint32Array(inputBytes);
for (let index = 0; index < cases.length; index++) {
  const fixture = cases[index];
  for (let corner = 0; corner < 8; corner++) {
    motionRows.set(fixture.rows(corner & 1, (corner >> 1) & 1, (corner >> 2) & 1), (index * 8 + corner) * 4);
  }
  floats.set([...(fixture.grid ?? [0.3, 0.4, 0.5]), fixture.scale ?? 1,
    ...(fixture.sourceNormal ?? [1, 0, 0]), fixture.age ?? 0.1, fixture.cap ?? 100, 0, 0, 0], index * 16);
  integers.set([fixture.offset ?? index * 8, fixture.resolution ?? 2,
    fixture.truncate ? index * 8 + 7 : cases.length * 8, 0], index * 16 + 12);
}
const shader = /* wgsl */ `
@group(0) @binding(0) var<storage, read> isosurface_motion_rows: array<vec4<f32>>;
${ISOSURFACE_MOTION_WGSL}
struct MotionCase { grid_scale: vec4<f32>, normal_age: vec4<f32>, cap: vec4<f32>, indexing: vec4<u32> };
@group(0) @binding(1) var<storage, read> inputs: array<MotionCase>;
@group(0) @binding(2) var<storage, read_write> evidence: array<vec4<f32>>;
@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let input = inputs[id.x];
  let sampled = sample_isosurface_motion(input.grid_scale.xyz, input.grid_scale.w,
    input.normal_age.xyz, input.normal_age.w, input.cap.x,
    input.indexing.x, input.indexing.y, input.indexing.z);
  evidence[id.x * 2u] = vec4<f32>(sampled.displacement, 0.0);
  evidence[id.x * 2u + 1u] = vec4<f32>(sampled.normal, 0.0);
}
`;

test('native retained-isosurface motion preserves analytic sampling, cap, normals, and fail-closed bounds', {
  skip: process.env.ULG_RUN_NATIVE_ISOSURFACE_MOTION === '1' ? false : 'opt-in owned desktop WebGPU check',
  timeout: 120_000
}, async (t) => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
    args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(new URL('/package.json', process.env.ULG_ISOSURFACE_MOTION_BASE_URL
      || 'https://fastbox.tail5c077c.ts.net:5173/').href);
    const result = await page.evaluate(async ({ code, inputWords, motionWords, count }) => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unavailable' };
      const device = await adapter.requestDevice();
      const resources = [];
      const errors = [];
      device.addEventListener('uncapturederror', (event) => errors.push(event.error.message));
      const make = (size, usage) => {
        const buffer = device.createBuffer({ size, usage }); resources.push(buffer); return buffer;
      };
      try {
        const module = device.createShaderModule({ code });
        const messages = (await module.getCompilationInfo()).messages.filter((m) => m.type === 'error');
        if (messages.length) return { status: 'compile-failed', messages: messages.map((m) => m.message) };
        device.pushErrorScope('validation');
        const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
        const motion = make(motionWords.length * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        const input = make(inputWords.length * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        const output = make(count * 32, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
        const readback = make(count * 32, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
        device.queue.writeBuffer(motion, 0, new Uint32Array(motionWords));
        device.queue.writeBuffer(input, 0, new Uint32Array(inputWords));
        const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: motion } }, { binding: 1, resource: { buffer: input } },
          { binding: 2, resource: { buffer: output } }] });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.dispatchWorkgroups(count); pass.end();
        encoder.copyBufferToBuffer(output, 0, readback, 0, count * 32);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const evidence = Array.from(new Float32Array(readback.getMappedRange())); readback.unmap();
        const validationError = await device.popErrorScope();
        return { status: 'ok', evidence, errors, validationError: validationError?.message ?? null,
          fallback: adapter.info?.isFallbackAdapter ?? adapter.isFallbackAdapter ?? false };
      } finally { for (const resource of resources) resource.destroy(); device.destroy(); }
    }, { code: shader, inputWords: Array.from(integers),
      motionWords: Array.from(new Uint32Array(motionRows.buffer)), count: cases.length });
    assert.equal(result.status, 'ok', JSON.stringify(result));
    assert.equal(result.fallback, false);
    assert.equal(result.validationError, null);
    assert.deepEqual(result.errors, []);
    for (let index = 0; index < cases.length; index++) {
      const fixture = cases[index];
      const actual = result.evidence.slice(index * 8, index * 8 + 8);
      for (let axis = 0; axis < 3; axis++) {
        assert.ok(Math.abs(actual[axis] - fixture.displacement[axis]) <= 3e-5,
          `${fixture.name} displacement: ${actual}`);
        assert.ok(Math.abs(actual[axis + 4] - fixture.normal[axis]) <= 3e-5,
          `${fixture.name} normal: ${actual}`);
      }
    }
    t.diagnostic(JSON.stringify({ cases: cases.length, fixedEvidenceBytes: cases.length * 32,
      scope: 'shared WGSL manufactured rendering deformation; not physical evolution or cadence acceptance' }));
  } finally { await browser.close(); }
});
