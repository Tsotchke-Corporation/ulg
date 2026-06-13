import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === '1';
const webServerTimeout = Number(process.env.PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS || 20_000);
const enableUnsafeWebGpu = process.env.PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU === '1';

export default defineConfig({
  testDir: '.',
  testMatch: /demo\.e2e\.mjs/,
  timeout: 30_000,
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
      use: {
        browserName: 'chromium',
        launchOptions: enableUnsafeWebGpu
          ? { args: ['--enable-unsafe-webgpu'] }
          : undefined
      }
    }
  ]
});
