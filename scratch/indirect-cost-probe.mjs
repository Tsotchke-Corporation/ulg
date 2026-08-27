import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-dawn-features=allow_unsafe_apis'] });
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
  const buf = device.createBuffer({ size: 1216 * 4, usage: GPUBufferUsage.STORAGE });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: buf } }] });
  const indirectBuf = device.createBuffer({ size: 4096, usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(indirectBuf, 0, new Uint32Array([19, 1, 1]));
  const run = async (label, { indirect, dispatches, submits, steps }) => {
    await device.queue.onSubmittedWorkDone();
    const t0 = performance.now();
    for (let s = 0; s < steps; s++) {
      for (let sub = 0; sub < submits; sub++) {
        const e = device.createCommandEncoder();
        const pass = e.beginComputePass();
        for (let d = 0; d < dispatches; d++) {
          pass.setPipeline(pipeline); pass.setBindGroup(0, bind);
          if (indirect) pass.dispatchWorkgroupsIndirect(indirectBuf, (d % 32) * 128);
          else pass.dispatchWorkgroups(19);
        }
        pass.end();
        device.queue.submit([e.finish()]);
      }
      if (s % 16 === 15) await device.queue.onSubmittedWorkDone();
    }
    await device.queue.onSubmittedWorkDone();
    return { label, msPerStep: +((performance.now() - t0) / steps).toFixed(2) };
  };
  const results = [];
  results.push(await run('direct-180x6sub', { indirect: false, dispatches: 30, submits: 6, steps: 120 }));
  results.push(await run('indirect-180x6sub', { indirect: true, dispatches: 30, submits: 6, steps: 120 }));
  results.push(await run('indirect-360x6sub', { indirect: true, dispatches: 60, submits: 6, steps: 120 }));
  results.push(await run('direct-again', { indirect: false, dispatches: 30, submits: 6, steps: 120 }));
  return results;
});
console.log(JSON.stringify(out));
await browser.close();
