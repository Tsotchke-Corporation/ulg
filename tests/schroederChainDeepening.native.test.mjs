import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_CHAIN_DEEPENING === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test(
  'semi-implicit pressure per-node GPU envelope watch detects acoustic/advective/linearization breaches on real Vulkan WebGPU',
  { skip: !RUN_NATIVE, timeout: 180000 },
  async () => {
    const { chromium } = await import('@playwright/test');
    const wayland = Boolean(process.env.WAYLAND_DISPLAY);
    const browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: !wayland,
      args: [
        '--ignore-certificate-errors',
        '--use-angle=vulkan',
        '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        ...(wayland ? ['--ozone-platform=wayland'] : [])
      ]
    });
    let result;
    try {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const url = 'https://127.0.0.1:5173/__chain_deepening_gpu_test__';
      await page.route(url, (route) => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Chain Deepening GPU</title>'
      }));
      await page.goto(url);
      result = await page.evaluate(async () => {
        const ip = await import('/src/runtime/sph/sphImplicitPressureGpu.js');
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice();
        const errors = [];
        device.addEventListener('uncapturederror', (e) => errors.push(e.error.message));
        device.pushErrorScope('validation');

        // Case 1: all 4 occupied nodes safely within envelope (advective CFL <= 0.04, linErr <= 0.005)
        const calmNodes = new Float32Array([
          1.0, 0.5, 0.0, 0.001,
          0.0, -1.5, 0.5, 0.002,
          0.0, 0.0, 0.0, 0.0,   // empty node ignored
          2.0, 0.0, 0.0, 0.001
        ]);
        const calmReceipt = await ip.runSphImplicitPressureEnvelopeWatchWebGpu(device, {
          nodeVelocityMassRows: calmNodes,
          gridSpacingM: 0.01,
          dtS: 2e-4,
          soundSpeedMPerS: 180
        });

        // Case 2: 2 calm nodes + 1 fast shock node (v = 40 m/s -> advCFL = 0.8 > 0.5, linErr = 1.92 > 0.05!)
        const shockNodes = new Float32Array([
          1.0, 0.0, 0.0, 0.001,
          0.0, 2.0, 0.0, 0.001,
          40.0, 0.0, 0.0, 0.001
        ]);
        const shockReceipt = await ip.runSphImplicitPressureEnvelopeWatchWebGpu(device, {
          nodeVelocityMassRows: shockNodes,
          gridSpacingM: 0.01,
          dtS: 2e-4,
          soundSpeedMPerS: 180
        });

        const validationError = await device.popErrorScope();
        device.destroy();
        return {
          errors,
          validationError: validationError ? validationError.message : null,
          calmReceipt,
          shockReceipt
        };
      });
    } finally {
      await browser.close();
    }

    assert.deepEqual(result.errors, []);
    assert.equal(result.validationError, null);
    assert.equal(result.calmReceipt.admittedNodes, 3);
    assert.equal(result.calmReceipt.fallbackRequired, false);
    assert.equal(result.calmReceipt.advectiveCflBreaches, 0);

    assert.equal(result.shockReceipt.admittedNodes, 2);
    assert.equal(result.shockReceipt.advectiveCflBreaches, 1);
    assert.equal(result.shockReceipt.linearizationBreaches, 1);
    assert.equal(result.shockReceipt.fallbackRequired, true);
    assert.ok(Math.abs(result.shockReceipt.maxAdvectiveCfl - 0.8) < 1e-4);
  }
);
