import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_DISPERSED_MEDIUM_OPTICS_PRODUCER === '1';
const NATIVE_BASE_URL =
  process.env.ULG_DISPERSED_MEDIUM_OPTICS_PRODUCER_BASE_URL
  || 'http://127.0.0.1:5173/';
const NATIVE_CHROME =
  process.env.ULG_DISPERSED_MEDIUM_OPTICS_PRODUCER_CHROME
  || '/usr/bin/google-chrome';

test('native dispersed-medium optics producer compiles both generalized WebGPU stages', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_DISPERSED_MEDIUM_OPTICS_PRODUCER=1 for native Vulkan WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: NATIVE_CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage();
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'adapter-unavailable' };
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const producer = await import(
        `/src/runtime/sph/sphDispersedMediumOpticsProducerGpu.js?native=${Date.now()}`
      );
      const shader = device.createShaderModule({
        label: 'ulg-dispersed-medium-optics-producer-native-gate',
        code: producer.sphDispersedMediumOpticsProducerWgsl
      });
      const compilation = await shader.getCompilationInfo();
      const compilationErrors = compilation.messages
        .filter((message) => message.type === 'error')
        .map((message) => ({
          lineNum: message.lineNum,
          linePos: message.linePos,
          message: message.message
        }));
      if (compilationErrors.length > 0) {
        return { status: 'compile-failed', compilationErrors };
      }

      const pipelineResults = [];
      for (const entryPoint of ['preflight', 'apply_production']) {
        try {
          await device.createComputePipelineAsync({
            label: `ulg-dispersed-medium-optics-${entryPoint}`,
            layout: 'auto',
            compute: { module: shader, entryPoint }
          });
          pipelineResults.push({ entryPoint, status: 'ready' });
        } catch (error) {
          pipelineResults.push({
            entryPoint,
            status: 'pipeline-failed',
            error: error?.message || String(error)
          });
        }
      }
      await device.queue.onSubmittedWorkDone();
      const validationError = await device.popErrorScope();
      return {
        status: 'ok',
        pipelineResults,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'ok', JSON.stringify(native));
  assert.deepEqual(native.pipelineResults, [
    { entryPoint: 'preflight', status: 'ready' },
    { entryPoint: 'apply_production', status: 'ready' }
  ], JSON.stringify(native));
  assert.equal(native.validationError, null, JSON.stringify(native));
  assert.deepEqual(native.uncapturedErrors, [], JSON.stringify(native));
});
