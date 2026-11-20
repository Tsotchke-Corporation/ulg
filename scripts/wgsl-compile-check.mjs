// Compile-check one exported WGSL string on native Vulkan WebGPU (HTTPS dev
// server on 5173): node scripts/wgsl-compile-check.mjs /src/<module>.js <exportName>
import { chromium } from '@playwright/test';
const modulePath = process.argv[2], exportName = process.argv[3];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto('https://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const out = await page.evaluate(async ({ modulePath, exportName }) => {
    const adapter = await navigator.gpu.requestAdapter(); const device = await adapter.requestDevice();
    const mod = await import(modulePath);
    const info = await device.createShaderModule({ code: mod[exportName] }).getCompilationInfo();
    const msgs = info.messages.filter(m => m.type === 'error').slice(0, 10).map(m => `${m.lineNum}:${m.linePos} ${m.message}`);
    device.destroy(); return msgs;
  }, { modulePath, exportName });
  console.log(JSON.stringify(out));
} finally { await browser.close(); }
