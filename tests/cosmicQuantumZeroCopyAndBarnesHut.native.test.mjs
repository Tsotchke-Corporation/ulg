import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_COSMIC_QUANTUM === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test('Hierarchical WebGPU Barnes-Hut Octree (32,768 bodies), zero-copy WebGPURenderer presenter, and cross-chart multipole verify on real Vulkan GPU', {
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
    const url = 'https://127.0.0.1:5173/__cosmic_bh_zerocopy_proof__';
    await page.route(url, (route) => route.fulfill({
      contentType: 'text/html',
      body: '<title>Barnes-Hut Zero-Copy WebGPU Proof</title>'
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

      const { createZeroCopyResidentBodyPresenter, loadThreeWebGpuAndTsl } = await import('/src/runtime/residentGpuPresenter.js');
      const { THREE, TSL } = await loadThreeWebGpuAndTsl();
      const {
        createContinuumSpecimenBodies,
        createGalacticBodies,
        createResidentBarnesHutNBodyEngine,
        createResidentContinuumDropletEngine,
        createResidentCosmicModuleRegistration
      } = await import('/src/demos/cosmicQuantumGpuKernels.js');
      const { createVolumetricOrbitalRaymarcher } = await import('/src/demos/volumetricOrbitalRaymarcher.js');
      const { createSimulationModuleRegistry } = await import('/src/runtime/simulationModuleRegistry.js');
      const { createUlgTaskCapsule, ULG_SERVICE_IDS, ULG_TASK_KINDS } = await import('/ulg-gpu-abi/src/serviceContract.js');
      const { createCosmicQuantumScaleBridge } = await import('/src/runtime/sph/cosmicQuantumScaleBridge.js');
      const { runSchroederScaleAtlasMultipoleWebGpu } = await import('/src/runtime/sph/schroederScaleAtlasMultipoleGpu.js');

      // 1. 32,768-body Hierarchical WebGPU Barnes-Hut Octree with zero CPU readback
      const bodies0 = createGalacticBodies({ count: 32768, preset: 'disk', seed: 825 });
      const bh = createResidentBarnesHutNBodyEngine({
        device,
        initialBodies: bodies0,
        mode: 0,
        boxHalf: 16.0,
        theta: 0.65,
        label: 'proof-bh-32k'
      });
      const registry = createSimulationModuleRegistry();
      registry.registerModule(createResidentCosmicModuleRegistration({
        method: { model: 'nbody-gravity', version: 1 },
        engine: bh,
        scaleRangeM: [1e6, 1e22],
        zeroCopy: true
      }));

      // 2. Shared-device WebGPURenderer + Zero-Copy Resident GPUBuffer Presenter
      const renderer = new THREE.WebGPURenderer({ antialias: false, device });
      renderer.setSize(256, 256);
      await renderer.init();
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
      cam.position.set(0, 12, 16);
      cam.lookAt(0, 0, 0);
      const presenter = createZeroCopyResidentBodyPresenter({
        THREE,
        TSL,
        renderer,
        bodyCount: bh.count,
        palette: 'galactic',
        initialBuffer: bh.getResidentBuffer()
      });
      scene.add(presenter.mesh);

      const t0 = performance.now();
      let zeroCopySkipped = true;
      for (let s = 0; s < 10; s += 1) {
        const cap = createUlgTaskCapsule({
          taskId: `bh32k-${s}`,
          serviceId: ULG_SERVICE_IDS.ulgRuntime,
          taskKind: ULG_TASK_KINDS.simulationStep,
          method: { model: 'nbody-gravity', version: 1 },
          input: { stepIndex: s, parameters: { dt: 0.011, gravity: 1.0, softening: 0.24, readback: false } }
        });
        const res = await registry.dispatchSimulationStepCapsule(cap, { device });
        if (!res.artifact.execution.zeroCopyReadbackSkipped) zeroCopySkipped = false;
        presenter.bindLeaseHandle(res.leaseHandle);
        renderer.render(scene, cam);
        res.leaseHandle.release();
      }
      await device.queue.onSubmittedWorkDone();
      const step10Ms = performance.now() - t0;

      // Single readback check at the end to confirm finite kinematics + motion
      const finalBodies = await bh.readbackBodies();
      let allFinite = true;
      let moved = 0;
      for (let i = 0; i < finalBodies.length; i += 8) {
        for (let k = 0; k < 8; k += 1) {
          if (!Number.isFinite(finalBodies[i + k])) allFinite = false;
        }
        const d = Math.hypot(
          finalBodies[i] - bodies0[i],
          finalBodies[i + 1] - bodies0[i + 1],
          finalBodies[i + 2] - bodies0[i + 2]
        );
        if (d > 1e-3) moved += 1;
      }

      // 3. Zero-copy Continuum Micro-SPH (1,024 particles, liquid Hg) + 3D Volumetric Raymarcher on same GPUDevice
      const contInit = createContinuumSpecimenBodies({ count: 1024, phase: 'liquid', seed: 4201 });
      const contEngine = createResidentContinuumDropletEngine({
        device,
        initialBodies: contInit,
        phase: 'liquid',
        bulkModulusPa: 25e9,
        label: 'proof-cont-hg'
      });
      registry.registerModule(createResidentCosmicModuleRegistration({
        method: { model: 'continuum-micro-sph', version: 1 },
        engine: contEngine,
        scaleRangeM: [1e-4, 1e2],
        zeroCopy: true
      }));
      const contPresenter = createZeroCopyResidentBodyPresenter({
        THREE,
        TSL,
        renderer,
        bodyCount: contEngine.count,
        palette: 'continuum-material',
        tintColor: [0.82, 0.85, 0.88],
        particleScale: 0.115,
        initialBuffer: contEngine.getResidentBuffer()
      });
      const contScene = new THREE.Scene();
      contScene.add(contPresenter.mesh);
      const radialSamples = Array.from({ length: 32 }, (_, i) => {
        const r = (i / 31) * 5.0;
        return { rBohr: r, radialProbabilityPerBohr: r * r * Math.exp(-1.1 * r) };
      });
      const raymarcher = createVolumetricOrbitalRaymarcher({
        THREE,
        TSL,
        renderer,
        radialSamples,
        rMaxBohr: 5.0,
        r95Bohr: 2.5,
        modeId: 'd_z2',
        boxHalfExtent: 5.1,
        dim: 32
      });
      contScene.add(raymarcher.mesh);

      let contZeroCopySkipped = true;
      for (let s = 0; s < 5; s += 1) {
        const cap = createUlgTaskCapsule({
          taskId: `cont-hg-${s}`,
          serviceId: ULG_SERVICE_IDS.ulgRuntime,
          taskKind: ULG_TASK_KINDS.simulationStep,
          method: { model: 'continuum-micro-sph', version: 1 },
          input: { stepIndex: s, parameters: { dt: 0.015, gravity: 4.8, readback: false } }
        });
        const res = await registry.dispatchSimulationStepCapsule(cap, { device });
        if (!res.artifact.execution.zeroCopyReadbackSkipped) contZeroCopySkipped = false;
        contPresenter.bindLeaseHandle(res.leaseHandle);
        renderer.render(contScene, cam);
        res.leaseHandle.release();
      }
      await device.queue.onSubmittedWorkDone();
      const contFinal = await contEngine.readbackBodies();
      let contAllFinite = true;
      let contMoved = 0;
      for (let i = 0; i < contFinal.length; i += 8) {
        for (let k = 0; k < 8; k += 1) {
          if (!Number.isFinite(contFinal[i + k])) contAllFinite = false;
        }
        if (Math.hypot(contFinal[i] - contInit[i], contFinal[i + 1] - contInit[i + 1], contFinal[i + 2] - contInit[i + 2]) > 1e-3) {
          contMoved += 1;
        }
      }
      const contPresenterStats = contPresenter.getStats();
      const raymarchMode = raymarcher.mode;

      // 4. Cross-chart multipole verification across Planetary/Galactic/Supergalactic charts
      const bridge = createCosmicQuantumScaleBridge({ moduleRegistry: registry });
      const ids = bridge.summary().chartByRegimeId;
      const mp = await runSchroederScaleAtlasMultipoleWebGpu(device, {
        atlas: bridge.atlasRuntime.snapshotAtlas(),
        particles: [
          { chartId: ids['planetary-orbital'], flags: 1, massKg: 1.989e30, temperatureK: 5778, posLocal: [0, 0, 0], effectiveAreaM2: 6.09e18 },
          { chartId: ids['galactic-nbody'], flags: 1, massKg: 2.0e41, temperatureK: 4200, posLocal: [2.5, 0.2, -1.8], effectiveAreaM2: 1.0e32 },
          { chartId: ids['supergalactic-cosmic'], flags: 1, massKg: 2.0e45, temperatureK: 3000, posLocal: [-4.2, 1.5, 3.1], effectiveAreaM2: 1.0e36 }
        ]
      });

      const presenterStats = presenter.getStats();
      const bhMode = bh.gravityMode;
      const bhCount = bh.count;
      raymarcher.dispose();
      contPresenter.dispose();
      contEngine.dispose();
      presenter.dispose();
      renderer.dispose();
      bh.dispose();
      device.destroy();

      return {
        bhMode,
        bhCount,
        step10Ms: Number(step10Ms.toFixed(1)),
        zeroCopySkipped,
        presenterStats,
        allFinite,
        movedBodies: moved,
        contZeroCopySkipped,
        contPresenterStats,
        contAllFinite,
        contMoved,
        raymarchMode,
        multipoleVerified: mp.receipt.verified,
        multipoleMomentumRelError: mp.receipt.momentumRelError,
        errors
      };
    });

    console.log('Barnes-Hut 32K + Continuum Micro-SPH + Volumetric Raymarcher Vulkan Proof:', JSON.stringify(result));
    assert.deepEqual(result.errors, []);
    assert.equal(result.bhMode, 'webgpu-barnes-hut-octree');
    assert.equal(result.bhCount, 32768);
    assert.equal(result.zeroCopySkipped, true);
    assert.equal(result.presenterStats.zeroCopy, true);
    assert.equal(result.presenterStats.readbackBytesPerFrame, 0);
    assert.equal(result.presenterStats.zeroCopyBoundFrames, 10);
    assert.equal(result.allFinite, true);
    assert.ok(result.movedBodies > 30000, `expected >30k moving stars, got ${result.movedBodies}`);
    assert.equal(result.contZeroCopySkipped, true);
    assert.equal(result.contPresenterStats.zeroCopy, true);
    assert.equal(result.contPresenterStats.readbackBytesPerFrame, 0);
    assert.equal(result.contPresenterStats.zeroCopyBoundFrames, 5);
    assert.equal(result.contAllFinite, true);
    assert.ok(result.contMoved > 900, `expected >900 moving micro-SPH particles, got ${result.contMoved}`);
    assert.equal(result.raymarchMode, 'webgpu-3d-volumetric-raymarcher');
    assert.equal(result.multipoleVerified, true);
    assert.ok(result.multipoleMomentumRelError < 1e-5);
  } finally {
    await browser.close();
  }
});
