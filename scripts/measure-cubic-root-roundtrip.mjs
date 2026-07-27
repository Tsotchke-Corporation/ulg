// Measures, on the real GPU, what the fluid mechanics path's J round-trip does
// to volume ratios near 1.
//
// `ulg-gpu-abi/src/wgsl.js` computes `next_j = det3(nF)`, then for a fluid
// (`row5.x < 0.5`) discards it: it takes `s = cubic_root_positive(next_j)`,
// rebuilds F as `s * I`, and recomputes `next_j = det3(s * I)`. So the stored J
// is `cbrt(J)^3` -- and `cubic_root_positive` is `exp(log(x) / 3.0)`.
//
// A settled 0.9 m water column needs J = 1 - rho*g*h/K = 1 - 4.0e-6 to price
// 8,826 Pa through the Tait EOS. That is ~34 f32 ULPs below 1.0, so it is
// representable; the question this script answers is whether the round-trip
// preserves it or snaps it to exactly 1.0.
import { chromium } from '@playwright/test';

const BASE_URL = process.env.ULG_PROBE_BASE_URL || 'https://127.0.0.1:5174';

const WGSL = `
struct Params { count: u32 };
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> input_j: array<f32>;
@group(0) @binding(2) var<storage, read_write> output_j: array<f32>;

fn cubic_root_positive(value: f32) -> f32 {
  return exp(log(max(value, 1.0e-12)) / 3.0);
}

fn det3(
  m00: f32, m01: f32, m02: f32,
  m10: f32, m11: f32, m12: f32,
  m20: f32, m21: f32, m22: f32
) -> f32 {
  return m00 * (m11 * m22 - m12 * m21)
    - m01 * (m10 * m22 - m12 * m20)
    + m02 * (m10 * m21 - m11 * m20);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let j_in = input_j[i];
  // Exactly the fluid branch from the mechanics kernel.
  let s = cubic_root_positive(max(j_in, 0.05));
  let j_out = det3(s, 0.0, 0.0, 0.0, s, 0.0, 0.0, 0.0, s);
  output_j[i * 3u] = j_out;
  output_j[i * 3u + 1u] = s;
  // A single-precision cube of the same s, to separate det3 from the cbrt.
  output_j[i * 3u + 2u] = s * s * s;
}
`;

const probes = [];
// The physically required strain for a 0.9 m column, and neighbours around it.
for (const delta of [
  -4.0e-6, -1.0e-6, -4.0e-7, -1.19e-7, -5.96e-8, 0,
  5.96e-8, 1.19e-7, 4.0e-7, 1.0e-6, 4.0e-6, 1.0e-4, 1.0e-3
]) {
  probes.push(1 + delta);
}

const browser = await chromium.launch({
  args: [
    '--enable-unsafe-webgpu',
    '--ignore-certificate-errors',
    '--use-angle=vulkan',
    '--enable-features=Vulkan'
  ]
});
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

const result = await page.evaluate(async ({ wgsl, values }) => {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) return { error: 'no adapter' };
  const device = await adapter.requestDevice();
  const count = values.length;

  const inputData = new Float32Array(values);
  const input = device.createBuffer({
    size: inputData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(input, 0, inputData);

  const outBytes = count * 3 * 4;
  const output = device.createBuffer({
    size: outBytes,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });
  const readback = device.createBuffer({
    size: outBytes,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  const uniform = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(uniform, 0, new Uint32Array([count, 0, 0, 0]));

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: device.createShaderModule({ code: wgsl }), entryPoint: 'main' }
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniform } },
      { binding: 1, resource: { buffer: input } },
      { binding: 2, resource: { buffer: output } }
    ]
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(count / 64));
  pass.end();
  encoder.copyBufferToBuffer(output, 0, readback, 0, outBytes);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPUMapMode.READ);
  const out = Array.from(new Float32Array(readback.getMappedRange().slice(0)));
  readback.unmap();
  return { out, adapterInfo: adapter.info ? { ...adapter.info } : null };
}, { wgsl: WGSL, values: probes });

await browser.close();

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

console.log('adapter:', JSON.stringify(result.adapterInfo));
console.log('');
console.log('  J_in            J_out(det3)     s=cbrt(J)       s*s*s           verdict');
let snapped = 0;
for (const [index, jIn] of probes.entries()) {
  const jOut = result.out[index * 3];
  const s = result.out[index * 3 + 1];
  const cube = result.out[index * 3 + 2];
  const lost = jIn !== 1 && jOut === 1;
  if (lost) snapped += 1;
  const verdict = lost
    ? 'SNAPPED TO 1.0 -- strain destroyed'
    : (jOut === jIn ? 'preserved exactly' : `drift ${(jOut - jIn).toExponential(3)}`);
  console.log(
    `  ${jIn.toPrecision(12).padEnd(15)} ${jOut.toPrecision(12).padEnd(15)} `
    + `${s.toPrecision(12).padEnd(15)} ${cube.toPrecision(12).padEnd(15)} ${verdict}`
  );
}
console.log('');
console.log(`${snapped} of ${probes.length} probe values were snapped to exactly 1.0.`);
