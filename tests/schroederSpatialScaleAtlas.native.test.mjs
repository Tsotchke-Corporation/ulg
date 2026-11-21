import assert from 'node:assert/strict';
import test from 'node:test';

test('native Vulkan GPU 40-OOM dyadic scale-chart atlas verifies multi-chart double-float rebasing and parallel-axis conservation', {
  skip: process.env.ULG_RUN_NATIVE_SCALE_ATLAS !== '1',
  timeout: 180000
}, async () => {
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
      '--enable-webgpu-developer-features',
      ...(wayland ? ['--ozone-platform=wayland'] : [])
    ]
  });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const url = 'https://127.0.0.1:5173/__scale_atlas_gpu_test__';
    await page.route(url, (route) => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>40-OOM Scale Atlas GPU</title>'
    }));
    await page.goto(url);

    const result = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return { fatal: 'no-webgpu-adapter' };
      const device = await adapter.requestDevice();
      const { createSchroederScaleAtlasPlan } = await import('/ulg-gpu-abi/src/index.js');
      const { createSchroederSpatialScaleAtlasGpu } = await import('/src/runtime/sph/schroederSpatialScaleAtlasGpu.js');

      const atlasPlan = createSchroederScaleAtlasPlan({
        referenceSpacingM: 1.0,
        charts: [
          { chartId: 0, label: 'supercluster', globalBaseLevel: 84, localMinLevel: 0, localMaxLevel: 2, parentChartId: null, originInParentUnits: [0, 0, 0] },
          { chartId: 1, label: 'galactic', globalBaseLevel: 64, localMinLevel: 0, localMaxLevel: 2, parentChartId: 0, originInParentUnits: [1.5, -0.75, 2.25] },
          { chartId: 2, label: 'interstellar', globalBaseLevel: 44, localMinLevel: 0, localMaxLevel: 2, parentChartId: 1, originInParentUnits: [-1.25, 2.5, 0.5] },
          { chartId: 3, label: 'planetary', globalBaseLevel: 24, localMinLevel: 0, localMaxLevel: 2, parentChartId: 2, originInParentUnits: [3.25, -1.5, 0.75] },
          { chartId: 4, label: 'laboratory', globalBaseLevel: 0, localMinLevel: 0, localMaxLevel: 3, parentChartId: 3, originInParentUnits: [0.5, 1.25, -2.0] },
          { chartId: 5, label: 'aerosol', globalBaseLevel: -24, localMinLevel: 0, localMaxLevel: 2, parentChartId: 4, originInParentUnits: [1.75, 0.25, -0.5] },
          { chartId: 6, label: 'nuclear', globalBaseLevel: -50, localMinLevel: 0, localMaxLevel: 2, parentChartId: 5, originInParentUnits: [-0.5, 0.75, 1.25] }
        ]
      });

      const samples = [
        { chartId: 6, posLocal: [0.75, -1.25, 2.5], massKg: 1.5, energyJ: 42.0, linearMomentumKgMPerS: [0.5, -0.25, 0.125], angularMomentumKgM2PerS: [0.1, 0.2, 0.3] },
        { chartId: 5, posLocal: [-2.0, 0.5, 1.125], massKg: 3.25, energyJ: 128.5, linearMomentumKgMPerS: [-0.75, 1.0, 0.25], angularMomentumKgM2PerS: [-0.2, 0.4, -0.1] },
        { chartId: 4, posLocal: [1.0, 1.0, 1.0], massKg: 12.0, energyJ: 500.0, linearMomentumKgMPerS: [2.0, -1.0, 0.5], angularMomentumKgM2PerS: [1.0, -2.0, 3.0] },
        { chartId: 3, posLocal: [-0.25, 3.5, -1.75], massKg: 8.0, energyJ: 90.0, linearMomentumKgMPerS: [0.25, 0.75, -0.5], angularMomentumKgM2PerS: [0.5, 0.5, 0.5] },
        { chartId: 2, posLocal: [0.125, -0.875, 0.625], massKg: 4.5, energyJ: 19.25, linearMomentumKgMPerS: [-0.5, -0.5, 1.0], angularMomentumKgM2PerS: [-1.0, 0.0, 1.0] },
        { chartId: 1, posLocal: [2.25, -1.5, 0.375], massKg: 2.0, energyJ: 7.5, linearMomentumKgMPerS: [1.25, 0.0, -0.75], angularMomentumKgM2PerS: [0.0, 0.25, -0.25] }
      ];

      const errors = [];
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      const gpuAtlas = createSchroederSpatialScaleAtlasGpu(device, { atlasPlan, maxSamples: 16 });
      const receipt = await gpuAtlas.runVerificationReadback(samples);
      gpuAtlas.destroy();
      const internalErr = await device.popErrorScope();
      const validationErr = await device.popErrorScope();
      if (internalErr) errors.push(`internal: ${internalErr.message}`);
      if (validationErr) errors.push(`validation: ${validationErr.message}`);
      device.destroy();

      return {
        errors,
        ordersOfMagnitude: atlasPlan.ordersOfMagnitude,
        sparseOccupancyRatio: atlasPlan.sparseOccupancyRatio,
        receipt
      };
    });

    console.log(JSON.stringify(result));
    assert.equal(result.fatal, undefined);
    assert.deepEqual(result.errors, []);
    assert.ok(result.ordersOfMagnitude > 40.9, `expected > 40.9 OOM, got ${result.ordersOfMagnitude}`);
    assert.ok(result.sparseOccupancyRatio < 0.2);
    assert.equal(result.receipt.verified, true, JSON.stringify(result.receipt));
    assert.equal(result.receipt.errorMask, 0);
    assert.equal(result.receipt.verifiedSampleCount, 6);
    assert.equal(result.receipt.totalChartHops, 6 + 5 + 4 + 3 + 2 + 1);
    assert.equal(result.receipt.dyadicSpanLevels, 137);
    assert.equal(result.receipt.chartCount, 7);
    assert.equal(result.receipt.activeLevelCount, 22);
    assert.ok(result.receipt.maxRelPosError < 1e-4, `maxRelPosError=${result.receipt.maxRelPosError}`);
    assert.ok(result.receipt.maxRelAngularError < 1e-4, `maxRelAngularError=${result.receipt.maxRelAngularError}`);
  } finally {
    await browser.close();
  }
});
