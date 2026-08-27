import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto('https://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const out = await page.evaluate(async () => {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const module = device.createShaderModule({ code: `
    @group(0) @binding(0) var<storage, read_write> data: array<f32>;
    @compute @workgroup_size(64)
    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      if (id.x < arrayLength(&data)) {
        var v = data[id.x];
        for (var i = 0u; i < 32u; i = i + 1u) { v = v * 1.0000001 + 0.0000001; }
        data[id.x] = v;
      }
    }` });
  const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
  const buf = device.createBuffer({ size: 1216 * 4, usage: GPUBufferUsage.STORAGE });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: buf } }] });
  const N = 512;
  const run = async (mode) => {
    // warmup + measure
    const t0 = performance.now();
    if (mode === 'split') {
      for (let i = 0; i < N; i++) {
        const e = device.createCommandEncoder();
        const p = e.beginComputePass(); p.setPipeline(pipeline); p.setBindGroup(0, bind); p.dispatchWorkgroups(19); p.end();
        device.queue.submit([e.finish()]);
      }
    } else if (mode === 'fusedPasses') {
      const e = device.createCommandEncoder();
      for (let i = 0; i < N; i++) {
        const p = e.beginComputePass(); p.setPipeline(pipeline); p.setBindGroup(0, bind); p.dispatchWorkgroups(19); p.end();
      }
      device.queue.submit([e.finish()]);
    } else if (mode === 'multiBuffer') {
      const buffers = [];
      for (let i = 0; i < N; i++) {
        const e = device.createCommandEncoder();
        const p = e.beginComputePass(); p.setPipeline(pipeline); p.setBindGroup(0, bind); p.dispatchWorkgroups(19); p.end();
        buffers.push(e.finish());
      }
      device.queue.submit(buffers);
    }
    const tSubmitted = performance.now();
    await device.queue.onSubmittedWorkDone();
    const t1 = performance.now();
    return { hostMs: +(tSubmitted - t0).toFixed(1), wallMs: +(t1 - t0).toFixed(1) };
  };
  const results = {};
  for (const mode of ['fusedPasses', 'split', 'multiBuffer', 'fusedPasses', 'split']) {
    const r = await run(mode);
    results[mode + (results[mode] ? '2' : '')] = r;
  }
  return results;
});
console.log(JSON.stringify(out));
await browser.close();
