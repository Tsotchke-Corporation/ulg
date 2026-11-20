// A6 diagnostic: run the warm MoonLab and Eshkol WebGPU workers directly in a
// browser page (no PeerCompute), printing their replies.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  page.on('console', (m) => console.log('console:', m.text().slice(0, 300)));
  await page.goto('https://127.0.0.1:5173/service-assets/README.md', { waitUntil: 'domcontentloaded' });
  const out = await page.evaluate(async () => {
    const ask = (worker, message) => new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ timeout: true }), 60000);
      worker.onmessage = (e) => { if (e.data?.id === message.id) { clearTimeout(timer); resolve(e.data); } };
      worker.onerror = (e) => { clearTimeout(timer); resolve({ workerError: String(e.message ?? e) }); };
      worker.postMessage(message);
    });
    const moonlab = new Worker('/workers/moonlab-warm-webgpu.worker.js');
    const eshkol = new Worker('/workers/eshkol-warm-vm.worker.js');
    const r1 = await ask(moonlab, { id: 'm1', type: 'ghz', qubits: 12 });
    const r2 = await ask(moonlab, { id: 'm2', type: 'ghz', qubits: 12 });
    const e1 = await ask(eshkol, { id: 'e1', type: 'matmul-sum', threshold: 1, n: 4,
      a: Array.from({ length: 16 }, (_, i) => i + 1), b: Array.from({ length: 16 }, (_, i) => 16 - i) });
    const e2 = await ask(eshkol, { id: 'e2', type: 'sample', threshold: 1,
      definition: '(define (rho T P) (/ (* P 0.028014) (* 8.314462618 T)))', call: 'rho', points: [[300, 101325]] });
    return { r1, r2: { ok: r2.ok, residency: r2.residency }, e1, e2, gpu: !!navigator.gpu };
  });
  console.log(JSON.stringify(out, null, 1).slice(0, 4000));
} finally { await browser.close(); }
