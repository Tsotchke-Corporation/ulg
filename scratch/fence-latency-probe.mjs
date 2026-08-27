import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto('https://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
const res = await page.evaluate(async () => {
  const a = await navigator.gpu.requestAdapter();
  const d = await a.requestDevice();
  const times = [];
  for (let i = 0; i < 10; i += 1) {
    const e = d.createCommandEncoder();
    d.queue.submit([e.finish()]);
    const t0 = performance.now();
    await d.queue.onSubmittedWorkDone();
    times.push(performance.now() - t0);
  }
  // and in a busy-loop context: submit, then burn JS ~50ms before awaiting
  const busy = [];
  for (let i = 0; i < 5; i += 1) {
    const e = d.createCommandEncoder();
    d.queue.submit([e.finish()]);
    const p = d.queue.onSubmittedWorkDone();
    const t0 = performance.now();
    while (performance.now() - t0 < 50) { /* burn */ }
    const t1 = performance.now();
    await p;
    busy.push(performance.now() - t1);
  }
  return { idle: times.map((t) => +t.toFixed(2)), afterBusy: busy.map((t) => +t.toFixed(2)) };
});
console.log(JSON.stringify(res));
await browser.close();
