import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_QUANTUM_ARTIFACTS === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test('WebGPU molecular 3D charge density sampler and shared-device simulation module leases verify on real Vulkan WebGPU', {
  skip: !RUN_NATIVE && 'set ULG_RUN_NATIVE_QUANTUM_ARTIFACTS=1 or ULG_RUN_NATIVE_WEBGPU=1',
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
    const url = 'https://127.0.0.1:5173/__quantum_module_lease_test__';
    await page.route(url, (route) => route.fulfill({
      contentType: 'text/html',
      body: '<title>Quantum Density and Module Lease Native Proof</title>'
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

      const { rhf } = await import('/src/runtime/electronicStructure/molecularHartreeFock.js');
      const {
        sampleMolecularChargeDensityCpu,
        sampleMolecularChargeDensityWebGpu,
        createQuantumDerivationSimulationModule
      } = await import('/src/runtime/electronicStructure/quantumDerivationArtifacts.js');
      const {
        createSimulationModuleRegistry,
        createNBodyGravityModuleRegistration
      } = await import('/src/runtime/simulationModuleRegistry.js');
      const { createUlgTaskCapsule, ULG_SERVICE_IDS, ULG_TASK_KINDS } = await import('/ulg-gpu-abi/src/serviceContract.js');

      // 1. Compare WebGPU vs CPU molecular charge density on H2O in 6-31G(d) (19 basis functions)
      const h2o = [
        { Z: 8, position: [0, 0, 0] },
        { Z: 1, position: [1.43, 0, 1.108] },
        { Z: 1, position: [-1.43, 0, 1.108] }
      ];
      const hf = rhf(h2o, { basis: '6-31g(d)' });
      const gridSpec = {
        basis: hf.basis,
        densityMatrix: hf.P,
        boundsMinBohr: [-4.2, -3.2, -3.2],
        boundsMaxBohr: [4.2, 3.2, 4.3],
        dimensions: [16, 16, 16]
      };
      const cpu = sampleMolecularChargeDensityCpu(gridSpec);
      const gpu = await sampleMolecularChargeDensityWebGpu(device, gridSpec);
      let maxAbsDiff = 0;
      let maxRelDiff = 0;
      for (let i = 0; i < cpu.density.length; i += 1) {
        const diff = Math.abs(gpu.density[i] - cpu.density[i]);
        if (diff > maxAbsDiff) maxAbsDiff = diff;
        if (cpu.density[i] > 1e-3) {
          const rel = diff / cpu.density[i];
          if (rel > maxRelDiff) maxRelDiff = rel;
        }
      }

      // 2. Shared-device SimulationModuleRegistry with nbody-gravity@1 + quantum-material-derivation@1
      const registry = createSimulationModuleRegistry();
      registry.registerModule(createNBodyGravityModuleRegistration({
        initialBodies: Float32Array.from([
          -1, 0, 0, 2, 0, 0, 0, 0.1,
          1, 0, 0, 3, 0, 0, 0, 0.1
        ])
      }));
      registry.registerModule(createQuantumDerivationSimulationModule());

      const nbodyCapsule = createUlgTaskCapsule({
        taskId: 'gpu-nbody-0',
        serviceId: ULG_SERVICE_IDS.ulgRuntime,
        taskKind: ULG_TASK_KINDS.simulationStep,
        method: { model: 'nbody-gravity', version: 1 },
        input: { stepIndex: 0, parameters: { dt: 0.015, gravity: 1.0, softening: 0.18, collisions: false } }
      });
      const nbodyRes = await registry.dispatchSimulationStepCapsule(nbodyCapsule, { device });
      const checkpoint = await nbodyRes.leaseSession.createPortableCheckpoint({ resourceKey: 'bodies' });
      const oldHandleValidBeforeReset = nbodyRes.leaseHandle.isCurrent();
      const hasRealGpuBuffer = nbodyRes.leaseHandle.buffer instanceof GPUBuffer;

      await registry.resetModuleSession({ model: 'nbody-gravity', version: 1 });
      const oldHandleValidAfterReset = nbodyRes.leaseHandle.isCurrent();
      let staleRejected = false;
      try {
        nbodyRes.leaseSession.assertValidLeaseHandle(nbodyRes.leaseHandle);
      } catch (err) {
        staleRejected = err?.code === 'ERR_STALE_RESIDENT_BUFFER_LEASE';
      }

      const restored = await nbodyRes.leaseSession.restoreFromCheckpoint(checkpoint, {
        uploadFn: (cp) => {
          const arr = Float32Array.from(cp.values);
          const buf = device.createBuffer({
            label: 'restored-nbody-gpu',
            size: arr.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
          });
          device.queue.writeBuffer(buf, 0, arr);
          return { buffer: buf, byteLength: arr.byteLength };
        }
      });
      const restoredHandle = nbodyRes.leaseSession.borrowBufferReadLease({
        resourceKey: 'bodies',
        consumerStage: 'gpu-verifier'
      });

      const qCapsule = createUlgTaskCapsule({
        taskId: 'gpu-quantum-0',
        serviceId: ULG_SERVICE_IDS.ulgRuntime,
        taskKind: ULG_TASK_KINDS.simulationStep,
        method: { model: 'quantum-material-derivation', version: 1 },
        input: {
          materialKey: 'h2o',
          formula: 'H2O',
          atoms: h2o,
          parameters: { basis: 'sto-3g', functional: 'pbe', gridDim: 10 },
          includeUmp2: false,
          includeQhaClosure: false,
          includeTriadA4Replay: true
        }
      });
      const qRes = await registry.dispatchSimulationStepCapsule(qCapsule, { device });
      const qGpuBufValid = qRes.leaseHandle.buffer instanceof GPUBuffer && qRes.leaseHandle.isCurrent();

      restoredHandle.release();
      qRes.leaseHandle.release();
      nbodyRes.leaseSession.dispose();
      qRes.leaseSession.dispose();
      device.destroy();

      return {
        processedVoxels: gpu.processedVoxels,
        expectedVoxels: 16 * 16 * 16,
        cpuMaxRho: cpu.maxRho,
        gpuMaxRho: gpu.maxRho,
        maxAbsDiff,
        maxRelDiff,
        oldHandleValidBeforeReset,
        oldHandleValidAfterReset,
        hasRealGpuBuffer,
        staleRejected,
        restoredEpoch: restored.published.resetEpoch,
        restoredStep: restored.published.stepIndex,
        qGpuBufValid,
        errors
      };
    });

    console.log('Quantum Density & Module Lease Vulkan Proof:', JSON.stringify(result));
    assert.deepEqual(result.errors, []);
    assert.equal(result.processedVoxels, result.expectedVoxels);
    assert.ok(result.maxAbsDiff < 2e-5, `GPU vs CPU density maxAbsDiff ${result.maxAbsDiff}`);
    assert.ok(result.maxRelDiff < 2e-5, `GPU vs CPU density maxRelDiff ${result.maxRelDiff}`);
    assert.equal(result.hasRealGpuBuffer, true);
    assert.equal(result.oldHandleValidBeforeReset, true);
    assert.equal(result.oldHandleValidAfterReset, false);
    assert.equal(result.staleRejected, true);
    assert.equal(result.restoredStep, 1);
    assert.equal(result.qGpuBufValid, true);
  } finally {
    await browser.close();
  }
});
