import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto('https://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const out = await page.evaluate(async () => {
    const adapter = await navigator.gpu.requestAdapter(); const device = await adapter.requestDevice();
    const mod = await import('/src/runtime/sph/schroederSpatialThermalProposalsGpu.js');
    const result = {};
    for (const [name, code] of [
      ['ledger-v1', mod.createSchroederSpatialThermalProposalLedgerWgsl(mod.schroederSpatialThermalProposalWgsl)],
      ['ledger-v2', mod.createSchroederSpatialThermalProposalLedgerWgsl(mod.schroederSpatialThermalProposalV2Wgsl)]
    ]) {
      const info = await device.createShaderModule({ code }).getCompilationInfo();
      result[name] = info.messages.filter(m => m.type === 'error').slice(0, 6).map(m => `${m.lineNum}:${m.linePos} ${m.message}`);
    }
    device.destroy(); return result;
  });
  console.log(JSON.stringify(out));
} finally { await browser.close(); }
