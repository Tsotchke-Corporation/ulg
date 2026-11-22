import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_COSMIC_QUANTUM === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test('Resident tiled WebGPU N-body engine verifies Newtonian Galactic and Comoving LCDM CPU/GPU parity on real Vulkan GPU', {
  skip: !RUN_NATIVE && 'set ULG_RUN_NATIVE_COSMIC_QUANTUM=1 or ULG_RUN_NATIVE_WEBGPU=1',
  timeout: 120000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--ignore-certificate-errors',
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
      '--enable-webgpu-developer-features'
    ]
  });
  try {
    const page = await browser.newPage();
    const url = 'https://127.0.0.1:5173/__cosmic_quantum_gpu_proof__';
    await page.route(url, (route) => route.fulfill({
      contentType: 'text/html',
      body: '<title>Cosmic Quantum Tiled N-Body Native GPU Proof</title>'
    }));
    await page.goto(url);
    await page.waitForFunction(
      async () => Boolean(await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' })),
      null,
      { timeout: 10000, polling: 250 }
    );

    const result = await page.evaluate(async () => {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      const device = await adapter.requestDevice();
      const errors = [];
      device.addEventListener('uncapturederror', (e) => errors.push(String(e.error?.message || e.error)));

      const {
        createGalacticBodies,
        createCosmicWebBodies,
        createResidentTiledNBodyEngine,
        createResidentCosmicModuleRegistration
      } = await import('/src/demos/cosmicQuantumGpuKernels.js');
      const { createSimulationModuleRegistry } = await import('/src/runtime/simulationModuleRegistry.js');
      const { createUlgTaskCapsule, ULG_SERVICE_IDS, ULG_TASK_KINDS } = await import('/ulg-gpu-abi/src/serviceContract.js');

      // 1. Galactic Newtonian parity (256 bodies, 3 steps)
      const galInit = createGalacticBodies({ count: 256, preset: 'disk', seed: 825 });
      const galCpu = createResidentTiledNBodyEngine({ device: null, initialBodies: galInit, mode: 0, label: 'gal-cpu' });
      const galGpu = createResidentTiledNBodyEngine({ device, initialBodies: galInit, mode: 0, label: 'gal-gpu' });

      for (let s = 0; s < 3; s += 1) {
        await galCpu.step({ dt: 0.012, gravity: 1.0, softening: 0.22 });
        await galGpu.step({ dt: 0.012, gravity: 1.0, softening: 0.22, readback: true });
      }
      const galCpuOut = galCpu.getBodies();
      const galGpuOut = galGpu.getBodies();
      let galMaxDiff = 0;
      for (let i = 0; i < galCpuOut.length; i += 1) {
        const d = Math.abs(galGpuOut[i] - galCpuOut[i]);
        if (d > galMaxDiff) galMaxDiff = d;
      }

      // 2. Supergalactic Comoving LCDM parity (256 nodes, 3 steps)
      const webInit = createCosmicWebBodies({ count: 256, seed: 1370 });
      const webCpu = createResidentTiledNBodyEngine({ device: null, initialBodies: webInit, mode: 1, label: 'web-cpu' });
      const webGpu = createResidentTiledNBodyEngine({ device, initialBodies: webInit, mode: 1, label: 'web-gpu' });
      for (let s = 0; s < 3; s += 1) {
        await webCpu.step({ dt: 0.016, gravity: 0.08, softening: 0.85, hubbleRate: 0.14 });
        await webGpu.step({ dt: 0.016, gravity: 0.08, softening: 0.85, hubbleRate: 0.14, readback: true });
      }
      const webCpuOut = webCpu.getBodies();
      const webGpuOut = webGpu.getBodies();
      let webMaxDiff = 0;
      for (let i = 0; i < webCpuOut.length; i += 1) {
        const d = Math.abs(webGpuOut[i] - webCpuOut[i]);
        if (d > webMaxDiff) webMaxDiff = d;
      }

      // 3. Full 4096-body dispatch via SimulationModuleRegistry + ResidentModuleBufferSession
      const bigEngine = createResidentTiledNBodyEngine({
        device,
        initialBodies: createGalacticBodies({ count: 4096, preset: 'disk', seed: 825 }),
        mode: 0,
        label: 'gal-4096'
      });
      const registry = createSimulationModuleRegistry();
      registry.registerModule(createResidentCosmicModuleRegistration({
        method: { model: 'nbody-gravity', version: 1 },
        engine: bigEngine,
        scaleRangeM: [1e6, 1e22]
      }));
      const cap = createUlgTaskCapsule({
        taskId: 'gpu-gal-4096-0',
        serviceId: ULG_SERVICE_IDS.ulgRuntime,
        taskKind: ULG_TASK_KINDS.simulationStep,
        method: { model: 'nbody-gravity', version: 1 },
        input: { stepIndex: 0, parameters: { dt: 0.012, gravity: 1.0, softening: 0.22 } }
      });
      const res = await registry.dispatchSimulationStepCapsule(cap, { device });
      const bigHasGpuBuffer = res.leaseHandle.buffer instanceof GPUBuffer && res.leaseHandle.isCurrent();
      const bigBackend = res.artifact.execution.backend;
      const bigCount = res.artifact.validity.bodyCount;
      res.leaseHandle.release();

      const galBackend = galGpu.backend;
      const webBackend = webGpu.backend;
      const webScaleFactorA = webGpu.scaleFactorA;

      galCpu.dispose();
      galGpu.dispose();
      webCpu.dispose();
      webGpu.dispose();
      bigEngine.dispose();
      device.destroy();

      return {
        galBackend,
        galMaxDiff,
        webBackend,
        webMaxDiff,
        webScaleFactorA,
        bigHasGpuBuffer,
        bigBackend,
        bigCount,
        errors
      };
    });

    console.log('Cosmic-Quantum Tiled N-Body Vulkan Proof:', JSON.stringify(result));
    assert.deepEqual(result.errors, []);
    assert.equal(result.galBackend, 'webgpu');
    assert.equal(result.webBackend, 'webgpu');
    assert.ok(result.galMaxDiff < 2e-4, `Galactic CPU/GPU max diff ${result.galMaxDiff}`);
    assert.ok(result.webMaxDiff < 2e-4, `Comoving LCDM CPU/GPU max diff ${result.webMaxDiff}`);
    assert.ok(result.webScaleFactorA > 0.25);
    assert.equal(result.bigHasGpuBuffer, true);
    assert.equal(result.bigBackend, 'webgpu');
    assert.equal(result.bigCount, 4096);
  } finally {
    await browser.close();
  }
});
