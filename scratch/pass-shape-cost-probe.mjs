// A1: GPU-process/host cost of the Iron Ice step's API shape without indirect
// dispatches: passes, direct dispatches, submits and small writeBuffers.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto('https://127.0.0.1:5173/service-assets/README.md', { waitUntil: 'domcontentloaded', timeout: 30000 });
const out = await page.evaluate(async () => {
  let adapter = null;
  for (let i = 0; i < 20 && !adapter; i++) { adapter = await navigator.gpu.requestAdapter(); if (!adapter) await new Promise(r => setTimeout(r, 100)); }
  const device = await adapter.requestDevice();
  const module = device.createShaderModule({ code: `
    @group(0) @binding(0) var<storage, read_write> a: array<f32>;
    @group(0) @binding(1) var<uniform> p: vec4<u32>;
    @compute @workgroup_size(64)
    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      if (id.x < arrayLength(&a) && p.x != 7u) { a[id.x] = a[id.x] + 1.0; }
    }` });
  const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
  const buf = device.createBuffer({ size: 2048 * 4, usage: GPUBufferUsage.STORAGE });
  const uni = Array.from({ length: 16 }, () => device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
  const binds = uni.map((u) => device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: buf } }, { binding: 1, resource: { buffer: u } }] }));
  const indirectBuf = device.createBuffer({ size: 4096, usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(indirectBuf, 0, new Uint32Array([32, 1, 1]));
  const data = new Uint8Array(576);
  const run = async (label, { passes, dispatchesPerPass, submits, writes, indirect = 0, steps = 40 }) => {
    await device.queue.onSubmittedWorkDone();
    const t0 = performance.now();
    for (let s = 0; s < steps; s++) {
      for (let w = 0; w < writes; w++) device.queue.writeBuffer(uni[w % 16], 0, data, 0, 256);
      const perSubmit = Math.ceil(passes / submits);
      let p = 0, ind = 0;
      for (let sub = 0; sub < submits; sub++) {
        const e = device.createCommandEncoder();
        for (let k = 0; k < perSubmit && p < passes; k++, p++) {
          const pass = e.beginComputePass();
          pass.setPipeline(pipeline);
          for (let d = 0; d < dispatchesPerPass; d++) {
            pass.setBindGroup(0, binds[(p + d) % 16]);
            if (ind < indirect) { pass.dispatchWorkgroupsIndirect(indirectBuf, (ind % 32) * 128); ind++; }
            else pass.dispatchWorkgroups(32);
          }
          pass.end();
        }
        device.queue.submit([e.finish()]);
      }
    }
    await device.queue.onSubmittedWorkDone();
    return { label, msPerStep: +((performance.now() - t0) / steps).toFixed(2) };
  };
  const results = [];
  results.push(await run('warmup', { passes: 10, dispatchesPerPass: 3, submits: 2, writes: 4 }));
  results.push(await run('iron-ice-shape-direct', { passes: 136, dispatchesPerPass: 3, submits: 21, writes: 112 }));
  results.push(await run('iron-ice-shape-51-indirect', { passes: 136, dispatchesPerPass: 3, submits: 21, writes: 112, indirect: 51 }));
  results.push(await run('passes-only-136', { passes: 136, dispatchesPerPass: 3, submits: 1, writes: 0 }));
  results.push(await run('passes-34-same-dispatches', { passes: 34, dispatchesPerPass: 12, submits: 1, writes: 0 }));
  results.push(await run('submits-21', { passes: 21, dispatchesPerPass: 1, submits: 21, writes: 0 }));
  results.push(await run('writes-112', { passes: 1, dispatchesPerPass: 1, submits: 1, writes: 112 }));
  device.destroy();
  return results;
});
console.log(JSON.stringify(out));
await browser.close();
