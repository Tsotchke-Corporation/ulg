import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto('https://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
const res = await page.evaluate(async () => {
  const a = await navigator.gpu.requestAdapter();
  const d = await a.requestDevice();
  const code = `@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    var x = f32(id.x);
    for (var i = 0u; i < 64u; i = i + 1u) { x = x * 1.0000001 + 0.5; }
  }`;
  const mod = d.createShaderModule({ code });
  const pipe = d.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } });
  const makeBuf = () => {
    const e = d.createCommandEncoder();
    const p = e.beginComputePass();
    p.setPipeline(pipe);
    p.dispatchWorkgroups(4);
    p.end();
    return e.finish();
  };
  const run = async (groups, per) => {
    await d.queue.onSubmittedWorkDone();
    const t0 = performance.now();
    for (let g = 0; g < groups; g += 1) {
      const bufs = [];
      for (let i = 0; i < per; i += 1) bufs.push(makeBuf());
      d.queue.submit(bufs);
    }
    await d.queue.onSubmittedWorkDone();
    return performance.now() - t0;
  };
  const split = await run(1000, 1);   // 1000 submits of 1 buffer
  const fused = await run(10, 100);   // 10 submits of 100 buffers
  return { splitMs: +split.toFixed(1), fusedMs: +fused.toFixed(1), perSubmitOverheadMs: +(((split - fused) / 990)).toFixed(3) };
});
console.log(JSON.stringify(res));
await browser.close();
