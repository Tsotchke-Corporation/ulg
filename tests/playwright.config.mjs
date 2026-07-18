import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === '1';
const webServerTimeout = Number(process.env.PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS || 20_000);
const enableUnsafeWebGpu = process.env.PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU === '1';
const freshWebGpuProcessGate = /@fresh-webgpu-process/;
const chromiumWebGpuUse = {
  browserName: 'chromium',
  // When WebGPU is enabled for tests it must run on the Vulkan ANGLE
  // backend: headless GL-ANGLE WebGPU is unstable (canvas presentation
  // is invisible and engaging it tears the shared instance, e.g.
  // compact-summary mapAsync fails with "A valid external Instance
  // reference no longer exists"). With surfaceDraw=auto now resolving
  // to the native WebGPU surface consumer, gates exercise that path.
  launchOptions: enableUnsafeWebGpu
    ? { args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] }
    : undefined
};

export default defineConfig({
  testDir: '.',
  testMatch: /demo\.e2e\.mjs/,
  timeout: 30_000,
  // GPU tests intentionally share one worker so two Vulkan browsers never
  // compete for the same adapter. The long compaction stress gate runs in a
  // second project, which gives it a fresh Chromium/Dawn process after the
  // main suite without losing Playwright-managed fixtures or traces.
  workers: 1,
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure'
  },
  webServer: skipWebServer ? undefined : {
    command: process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: process.env.PLAYWRIGHT_WEB_SERVER_URL || baseURL,
    reuseExistingServer: true,
    timeout: webServerTimeout
  },
  projects: [
    {
      name: 'chromium',
      grepInvert: freshWebGpuProcessGate,
      use: chromiumWebGpuUse
    },
    {
      name: 'chromium-fresh-webgpu',
      grep: freshWebGpuProcessGate,
      retries: 0,
      use: chromiumWebGpuUse
    }
  ]
});
