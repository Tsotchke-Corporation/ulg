import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_IMPLICIT_THERMAL === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test(
  'IMEX semi-implicit thermal PCG runs on real Vulkan WebGPU at Fo=50 with exact energy conservation and CPU parity',
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
      const url = 'https://127.0.0.1:5173/__implicit_thermal_gpu_test__';
      await page.route(url, (route) => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>IMEX Thermal GPU</title>'
      }));
      await page.goto(url);
      result = await page.evaluate(async () => {
        const mod = await import('/src/runtime/sph/sphImplicitThermalGpu.js');
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: 12 } });
        const errors = [];
        device.addEventListener('uncapturederror', (e) => errors.push(e.error.message));
        device.pushErrorScope('validation');

        const n = 32;
        const nodeState = new Float32Array(n * 4);
        const rowOffsets = [0];
        const edgeNeighbors = [];
        const edgeConductance = [];
        for (let i = 0; i < n; i += 1) {
          nodeState[i * 4] = i < 16 ? 1.2 : 2.8;
          nodeState[i * 4 + 1] = i < 16 ? 1850 : 233;
          nodeState[i * 4 + 2] = i === 0 || i === n - 1 ? 0.25 : 0;
          nodeState[i * 4 + 3] = 293.15;
        }
        for (let i = 0; i < n; i += 1) {
          if (i > 0) {
            edgeNeighbors.push(i - 1);
            edgeConductance.push(
              1.5 + mod.linearizedRadiativeConductanceWPerK(nodeState[i * 4 + 1], nodeState[(i - 1) * 4 + 1], 0.8, 2e-4)
            );
          }
          if (i + 1 < n) {
            edgeNeighbors.push(i + 1);
            edgeConductance.push(
              1.5 + mod.linearizedRadiativeConductanceWPerK(nodeState[i * 4 + 1], nodeState[(i + 1) * 4 + 1], 0.8, 2e-4)
            );
          }
          rowOffsets.push(edgeNeighbors.length);
        }
        const dt = 20;
        const opts = { theta: 1, maxFourierNumber: 50, relativeTolerance: 1e-5 };
        const cpu = mod.solveSphImplicitThermalCpuReference({
          nodeState, rowOffsets, edgeNeighbors, edgeConductance, dt, options: opts
        });
        const gpu = await mod.runSphImplicitThermalSolveWebGpu(device, {
          nodeState, rowOffsets, edgeNeighbors, edgeConductance, dt, options: opts
        });
        const val = await device.popErrorScope();
        device.destroy();

        let maxRelTempDiff = 0;
        let gpuPairSum = 0;
        let gpuWallSum = 0;
        let gpuTotalSum = 0;
        let minT = Infinity;
        let maxT = -Infinity;
        for (let i = 0; i < n; i += 1) {
          const tG = gpu.outEnergy[i * 4];
          const tC = cpu.outEnergy[i * 4];
          maxRelTempDiff = Math.max(maxRelTempDiff, Math.abs(tG - tC) / Math.max(1, tC));
          minT = Math.min(minT, tG);
          maxT = Math.max(maxT, tG);
          gpuTotalSum += gpu.outEnergy[i * 4 + 1];
          gpuWallSum += gpu.outEnergy[i * 4 + 2];
          gpuPairSum += gpu.outEnergy[i * 4 + 3];
        }
        return {
          maxRelTempDiff,
          gpuPairSum,
          gpuWallSum,
          gpuTotalSum,
          minT,
          maxT,
          gpuRelRes: gpu.relativeResidual,
          validation: val?.message ?? null,
          errors
        };
      });
    } finally {
      await browser.close();
    }
    console.log('IMEX thermal GPU:', JSON.stringify(result));
    assert.equal(result.validation, null);
    assert.deepEqual(result.errors, []);
    assert.ok(result.maxRelTempDiff < 1e-4, `GPU/CPU parity drift ${result.maxRelTempDiff}`);
    assert.ok(Math.abs(result.gpuPairSum) < 1e-2, `Pair energy sum ${result.gpuPairSum}`);
    assert.ok(Math.abs(result.gpuTotalSum - result.gpuWallSum) < 1e-2);
    assert.ok(result.minT >= 233 && result.maxT <= 1850, `Max principle violated [${result.minT}, ${result.maxT}]`);
  }
);
