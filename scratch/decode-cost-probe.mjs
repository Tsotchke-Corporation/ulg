import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto('https://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const out = await page.evaluate(async () => {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  // 6 distinct pipelines to mimic pipeline switching
  const pipelines = [];
  for (let i = 0; i < 6; i++) {
    const module = device.createShaderModule({ code: `
      @group(0) @binding(0) var<storage, read_write> a: array<f32>;
      @group(0) @binding(1) var<storage, read_write> b: array<f32>;
      @group(0) @binding(2) var<storage, read_write> c: array<f32>;
      @group(0) @binding(3) var<storage, read_write> d: array<f32>;
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) id: vec3<u32>) {
        if (id.x < arrayLength(&a)) { a[id.x] = b[id.x] * ${1 + i}.0 + c[id.x] + d[id.x]; }
      }` });
    pipelines.push(device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } }));
  }
  const bufs = Array.from({ length: 4 }, () => device.createBuffer({ size: 1216 * 4, usage: GPUBufferUsage.STORAGE }));
  const binds = pipelines.map((p) => device.createBindGroup({
    layout: p.getBindGroupLayout(0),
    entries: bufs.map((b, i) => ({ binding: i, resource: { buffer: b } })),
  }));
  const paramsBuf = device.createBuffer({ size: 256, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const runConfig = async (label, { submitsPerStep, passesPerSubmit, dispatchesPerPass, writeBuffersPerStep, steps }) => {
    // warmup GPU clocks
    await device.queue.onSubmittedWorkDone();
    const t0 = performance.now();
    for (let s = 0; s < steps; s++) {
      for (let w = 0; w < writeBuffersPerStep; w++) {
        device.queue.writeBuffer(paramsBuf, 0, new Uint32Array(16));
      }
      for (let sub = 0; sub < submitsPerStep; sub++) {
        const e = device.createCommandEncoder();
        for (let p = 0; p < passesPerSubmit; p++) {
          const pass = e.beginComputePass();
          for (let di = 0; di < dispatchesPerPass; di++) {
            const k = (sub + p + di) % 6;
            pass.setPipeline(pipelines[k]);
            pass.setBindGroup(0, binds[k]);
            pass.dispatchWorkgroups(19);
          }
          pass.end();
        }
        device.queue.submit([e.finish()]);
      }
      if (s % 16 === 15) await device.queue.onSubmittedWorkDone();
    }
    await device.queue.onSubmittedWorkDone();
    const dt = performance.now() - t0;
    return { label, msPerStep: +(dt / steps).toFixed(2) };
  };
  const results = [];
  // app-like shape: 30 submits x 6 passes x 1 dispatch = 180 dispatches, 100 writeBuffers
  results.push(await runConfig('app-shape', { submitsPerStep: 30, passesPerSubmit: 6, dispatchesPerPass: 1, writeBuffersPerStep: 100, steps: 100 }));
  // same dispatch count, 1 submit
  results.push(await runConfig('one-submit', { submitsPerStep: 1, passesPerSubmit: 180, dispatchesPerPass: 1, writeBuffersPerStep: 100, steps: 100 }));
  // same dispatches in ONE pass
  results.push(await runConfig('one-pass', { submitsPerStep: 1, passesPerSubmit: 1, dispatchesPerPass: 180, writeBuffersPerStep: 100, steps: 100 }));
  // fewer dispatches
  results.push(await runConfig('quarter-dispatches', { submitsPerStep: 30, passesPerSubmit: 2, dispatchesPerPass: 1, writeBuffersPerStep: 25, steps: 100 }));
  // no writebuffers
  results.push(await runConfig('no-writes', { submitsPerStep: 30, passesPerSubmit: 6, dispatchesPerPass: 1, writeBuffersPerStep: 0, steps: 100 }));
  results.push(await runConfig('app-shape-again', { submitsPerStep: 30, passesPerSubmit: 6, dispatchesPerPass: 1, writeBuffersPerStep: 100, steps: 100 }));
  return results;
});
console.log(JSON.stringify(out));
await browser.close();
