import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto('https://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const out = await page.evaluate(async () => {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const module = device.createShaderModule({ code: `
    @group(0) @binding(0) var<storage, read_write> a: array<f32>;
    @compute @workgroup_size(64)
    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      if (id.x < arrayLength(&a)) { a[id.x] = a[id.x] + 1.0; }
    }` });
  const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
  const stable = device.createBuffer({ size: 1216 * 4, usage: GPUBufferUsage.STORAGE });
  const stableBind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: stable } }] });
  // App-like buffer size mix: params (256B), small state (~80KB), medium (~1MB)
  const sizes = [];
  for (let i = 0; i < 40; i++) sizes.push(256 + (i % 7) * 64);
  for (let i = 0; i < 15; i++) sizes.push(80_000 + (i % 5) * 4096);
  for (let i = 0; i < 4; i++) sizes.push(1_048_576);
  const run = async (label, { buffersPerStep, bindGroupsPerStep, steps }) => {
    await device.queue.onSubmittedWorkDone();
    const t0 = performance.now();
    let graveyard = [];
    for (let s = 0; s < steps; s++) {
      const transient = [];
      for (let i = 0; i < buffersPerStep; i++) {
        transient.push(device.createBuffer({ size: sizes[i % sizes.length], usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }));
      }
      for (let i = 0; i < bindGroupsPerStep; i++) {
        device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: transient.length ? transient[i % transient.length] : stable } }] });
      }
      const e = device.createCommandEncoder();
      const pass = e.beginComputePass();
      for (let d = 0; d < 12; d++) { pass.setPipeline(pipeline); pass.setBindGroup(0, stableBind); pass.dispatchWorkgroups(19); }
      pass.end();
      device.queue.submit([e.finish()]);
      // destroy last step's transients (they're no longer in flight... mimic app churn)
      for (const b of graveyard) b.destroy();
      graveyard = transient;
      if (s % 16 === 15) await device.queue.onSubmittedWorkDone();
    }
    await device.queue.onSubmittedWorkDone();
    for (const b of graveyard) b.destroy();
    const dt = performance.now() - t0;
    return { label, msPerStep: +(dt / steps).toFixed(2) };
  };
  const results = [];
  results.push(await run('no-churn', { buffersPerStep: 0, bindGroupsPerStep: 0, steps: 150 }));
  results.push(await run('bg-only-160', { buffersPerStep: 0, bindGroupsPerStep: 160, steps: 150 }));
  results.push(await run('buf-59', { buffersPerStep: 59, bindGroupsPerStep: 0, steps: 150 }));
  results.push(await run('buf-59+bg-160', { buffersPerStep: 59, bindGroupsPerStep: 160, steps: 150 }));
  results.push(await run('no-churn-again', { buffersPerStep: 0, bindGroupsPerStep: 0, steps: 150 }));
  return results;
});
console.log(JSON.stringify(out));
await browser.close();
