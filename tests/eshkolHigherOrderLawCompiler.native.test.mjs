import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_ESHKOL_LAW === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test(
  'compiled Eshkol higher-order law + GPU per-node envelope watch & atomic debt receipt execute on real Vulkan WebGPU',
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
      const url = 'https://127.0.0.1:5173/__eshkol_law_compiler_gpu_test__';
      await page.route(url, (route) => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Eshkol Higher-Order Law Compiler GPU</title>'
      }));
      await page.goto(url);
      result = await page.evaluate(async () => {
        const compiler = await import('/src/runtime/material/eshkolHigherOrderLawCompiler.js');
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice();
        const errors = [];
        device.addEventListener('uncapturederror', (e) => errors.push(e.error.message));
        device.pushErrorScope('validation');

        const law = compiler.defineLawObject({
          id: 'gpu-sutherland-k',
          inputs: [
            { name: 'temperature', unit: 'K' },
            { name: 'density', unit: 'kg/m^3' }
          ],
          output: { name: 'k', unit: 'W/(m*K)' },
          envelope: {
            temperatureRangeK: [220, 1200],
            densityRangeKgM3: [0.4, 4.0],
            ranges: { temperature: [220, 1200], density: [0.4, 4.0] },
            homogeneityTest: {
              maxTemperatureVarianceK2: 250,
              maxTemperatureGradientKPerM: 800,
              maxJensenResidual: 0.05
            }
          },
          fallbackPolicy: compiler.LAW_FALLBACK_POLICY.ASYNC,
          evaluate: ({ temperature, density }) =>
            0.026 * Math.pow(temperature / 300, 1.5) * (420 / (temperature + 120)) * (1 + 0.12 * (density / 1.2))
        });

        const approx = compiler.approximateLaw(law, {
          representation: 'chebyshev',
          degrees: [14, 6],
          relativeTolerance: 1e-5
        });
        const compiledAsync = compiler.compileLawToWgsl(approx, { fnPrefix: 'k_async', generation: 5 });

        const queries = [
          [300, 1.2, 0],     // 0: valid hit
          [800, 2.4, 0],     // 1: valid hit
          [150, 1.2, 0],     // 2: domain exit LOW (T < 220)
          [1500, 1.2, 0],    // 3: domain exit HIGH (T > 1200)
          [500, 1.2, 0],     // 4: homogeneity breach (variance > 250)
          [500, 1.2, 0],     // 5: missing homogeneity summary -> fail CLOSED!
          [Number.NaN, 1, 0] // 6: non-finite input -> fail CLOSED!
        ];
        const homog = [
          { temperatureVarianceK2: 10, temperatureGradientKPerM: 50, jensenResidual: 0.001, present: true },
          { temperatureVarianceK2: 20, temperatureGradientKPerM: 120, jensenResidual: 0.002, present: true },
          { temperatureVarianceK2: 10, temperatureGradientKPerM: 50, jensenResidual: 0.001, present: true },
          { temperatureVarianceK2: 10, temperatureGradientKPerM: 50, jensenResidual: 0.001, present: true },
          { temperatureVarianceK2: 900, temperatureGradientKPerM: 50, jensenResidual: 0.001, present: true },
          { present: false },
          { temperatureVarianceK2: 10, temperatureGradientKPerM: 50, jensenResidual: 0.001, present: true }
        ];

        const gpuAsync = await compiler.runCompiledLawEnvelopeWatchWebGpu(device, compiledAsync, {
          queryPoints: queries,
          homogeneityStats: homog
        });
        const ref0 = law.evaluate({ temperature: 300, density: 1.2 });
        const ref1 = law.evaluate({ temperature: 800, density: 2.4 });
        const d1 = compiler.differentiateLaw(law, { axis: 'temperature', order: 1 });
        const refGrad0 = d1.evaluate({ temperature: 300, density: 1.2 });

        const strictLaw = compiler.defineLawObject({
          id: 'gpu-sutherland-k-strict',
          inputs: law.inputs,
          output: law.output,
          envelope: law.envelope,
          fallbackPolicy: compiler.LAW_FALLBACK_POLICY.STRICT,
          evaluate: ({ temperature, density }) =>
            0.026 * Math.pow(temperature / 300, 1.5) * (420 / (temperature + 120)) * (1 + 0.12 * (density / 1.2))
        });
        const strictApprox = compiler.approximateLaw(strictLaw, {
          representation: 'chebyshev',
          degrees: [14, 6],
          relativeTolerance: 1e-5
        });
        const compiledStrict = compiler.compileLawToWgsl(strictApprox, { fnPrefix: 'k_strict', generation: 6 });
        const gpuStrict = await compiler.runCompiledLawEnvelopeWatchWebGpu(device, compiledStrict, {
          queryPoints: queries,
          homogeneityStats: homog
        });

        const validationErr = await device.popErrorScope();
        device.destroy();
        return {
          errors,
          validationError: validationErr ? validationErr.message : null,
          gpuAsync,
          gpuStrict,
          ref0,
          ref1,
          refGrad0
        };
      });
    } finally {
      await browser.close();
    }

    assert.deepEqual(result.errors, []);
    assert.equal(result.validationError, null);
    const { gpuAsync, gpuStrict, ref0, ref1, refGrad0 } = result;
    assert.equal(gpuAsync.results[0].admitted, true);
    assert.equal(gpuAsync.results[1].admitted, true);
    assert.ok(Math.abs(gpuAsync.results[0].value - ref0) / ref0 < 1e-4, `val0 err: ${gpuAsync.results[0].value} vs ${ref0}`);
    assert.ok(Math.abs(gpuAsync.results[1].value - ref1) / ref1 < 1e-4, `val1 err: ${gpuAsync.results[1].value} vs ${ref1}`);
    assert.ok(Math.abs(gpuAsync.results[0].grad0 - refGrad0) / Math.abs(refGrad0) < 2e-3, `grad0 err: ${gpuAsync.results[0].grad0} vs ${refGrad0}`);

    assert.equal(gpuAsync.receipt.hits, 2);
    assert.equal(gpuAsync.receipt.domainExitLow, 1);
    assert.equal(gpuAsync.receipt.domainExitHigh, 1);
    assert.equal(gpuAsync.receipt.homogeneityBreach, 2);
    assert.equal(gpuAsync.receipt.nonFiniteInput, 1);
    assert.equal(gpuAsync.receipt.debtCount, 5);
    assert.equal(gpuAsync.receipt.generation, 5);
    assert.ok(gpuAsync.receipt.maxNormalizedOvershoot > 0.25);

    assert.equal(gpuStrict.receipt.hits, 2);
    assert.equal(gpuStrict.receipt.debtCount, 0);
    assert.equal(gpuStrict.results[2].admitted, false);
    assert.equal(gpuStrict.results[2].value, 0);
    assert.equal(gpuStrict.results[5].admitted, false);
  }
);
