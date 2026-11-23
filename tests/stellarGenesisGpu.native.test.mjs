import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_STELLAR_GENESIS === '1'
  || process.env.ULG_RUN_NATIVE_COSMIC_QUANTUM === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test('General WebGPU self-gravitating-hydro@1 (8,192 pts, ClosureRegistry 2D EOS, shared residentGpuPresenter zero-copy) produces BOTH stable 1 M_sun star AND emergent 18 M_sun supernova on real Vulkan GPU with 0 GPU errors', {
  skip: !RUN_NATIVE && 'set ULG_RUN_NATIVE_STELLAR_GENESIS=1 or ULG_RUN_NATIVE_WEBGPU=1',
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
    const url = 'https://127.0.0.1:5173/__self_gravitating_hydro_gpu_proof__';
    await page.route(url, (route) => route.fulfill({
      contentType: 'text/html',
      body: '<title>General Self-Gravitating Hydro WebGPU Proof</title>'
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
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message || e.error)));

      const { createZeroCopyResidentBodyPresenter, loadThreeWebGpuAndTsl } = await import('/src/runtime/residentGpuPresenter.js');
      const { THREE, TSL } = await loadThreeWebGpuAndTsl();
      const { ArtifactCache } = await import('/src/runtime/ArtifactCache.js');
      const { ClosureRegistry } = await import('/src/runtime/ClosureRegistry.js');
      const { registerPlasmaFusionClosureArtifact } = await import('/src/runtime/astrophysics/hydrogenStellarClosure.js');
      const { createHydrogenNebulaInitialBodies } = await import('/src/runtime/astrophysics/nebulaInitialConditions.js');
      const {
        HYDRO_PARTICLE_STRIDE_FLOATS,
        createSelfGravitatingHydroEngine,
        createSelfGravitatingHydroModuleRegistration
      } = await import('/src/runtime/sph/selfGravitatingHydroGpu.js');
      const { createSimulationModuleRegistry } = await import('/src/runtime/simulationModuleRegistry.js');
      const { createUlgTaskCapsule, ULG_SERVICE_IDS, ULG_TASK_KINDS } = await import('/ulg-gpu-abi/src/serviceContract.js');

      const cache = new ArtifactCache();
      const closureRegistry = new ClosureRegistry({ artifactCache: cache });
      const { table } = await registerPlasmaFusionClosureArtifact({ closureRegistry });

      const renderer = new THREE.WebGPURenderer({ antialias: false, device });
      renderer.setSize(256, 256);
      await renderer.init();
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
      cam.position.set(0, 8, 18);
      cam.lookAt(0, 0, 0);

      // 1. 1.0 M_sun cold molecular cloud
      const solarBodies = createHydrogenNebulaInitialBodies({ count: 8192, preset: 'solar-nebula', seed: 1939 });
      const engine = createSelfGravitatingHydroEngine({
        device,
        initialBodies: solarBodies,
        eosClosureTable: table,
        label: 'proof-sgh-8k'
      });
      const registry = createSimulationModuleRegistry();
      registry.registerModule(createSelfGravitatingHydroModuleRegistration({ engine, zeroCopy: true }));

      const presenter = createZeroCopyResidentBodyPresenter({
        THREE,
        TSL,
        renderer,
        bodyCount: engine.count,
        strideFloats: HYDRO_PARTICLE_STRIDE_FLOATS,
        palette: 'blackbody-thermo',
        initialBuffer: engine.getResidentBuffer()
      });
      scene.add(presenter.mesh);

      let solarPeakTempK = 0;
      let solarPeakEps = 0;
      let solarMinFH2 = 1;
      for (let s = 0; s < 150; s += 1) {
        const cap = createUlgTaskCapsule({
          taskId: `sgh-sol-${s}`,
          serviceId: ULG_SERVICE_IDS.ulgRuntime,
          taskKind: ULG_TASK_KINDS.simulationStep,
          method: { model: 'self-gravitating-hydro', version: 1 },
          input: { stepIndex: s, parameters: { dt: 0.020, timeAccel: 4.5, readTelemetry: s % 5 === 0 || s === 149 } }
        });
        const res = await registry.dispatchSimulationStepCapsule(cap, { device });
        presenter.bindLeaseHandle(res.leaseHandle);
        if (s % 15 === 0) renderer.render(scene, cam);
        res.leaseHandle.release();
        const tel = engine.getTelemetry();
        if (tel.coreTempK > solarPeakTempK) solarPeakTempK = tel.coreTempK;
        if (tel.peakEpsNucWPerKg > solarPeakEps) solarPeakEps = tel.peakEpsNucWPerKg;
        if (tel.coreFH2 < solarMinFH2) solarMinFH2 = tel.coreFH2;
      }
      await device.queue.onSubmittedWorkDone();
      const solarTel = engine.getTelemetry();
      const readBodies = await engine.readbackBodies();
      let allFinite = true;
      let maxNucleonErr = 0;
      for (let i = 0; i < readBodies.length; i += 16) {
        for (let k = 0; k < 16; k += 1) {
          if (!Number.isFinite(readBodies[i + k])) allFinite = false;
        }
        const err = Math.abs((readBodies[i + 10] + readBodies[i + 14] + readBodies[i + 15]) - 1.0);
        if (err > maxNucleonErr) maxNucleonErr = err;
      }

      // 2. EXACT SAME ENGINE & WGSL SHADER — ONLY feed 18 M_sun initial particle masses!
      const massiveBodies = createHydrogenNebulaInitialBodies({ count: 8192, preset: 'massive-supernova', seed: 1939 });
      engine.resetBodies(massiveBodies);
      presenter.bindResidentBuffer(engine.getResidentBuffer());
      let snStep = -1;
      for (let s = 0; s < 220; s += 1) {
        const tel = await engine.step({ dt: 0.020, timeAccel: 6.5, readTelemetry: s % 4 === 0 || s === 219 });
        if (tel.supernovaTriggered && snStep < 0) snStep = s;
        if (s % 25 === 0) {
          presenter.bindResidentBuffer(engine.getResidentBuffer());
          renderer.render(scene, cam);
        }
      }
      await device.queue.onSubmittedWorkDone();
      const snTel = engine.getTelemetry();

      const stats = presenter.getStats();
      const backend = engine.backend;
      presenter.dispose();
      engine.dispose();
      renderer.dispose?.();

      return {
        gpuErrors,
        backend,
        zeroCopy: stats.zeroCopy,
        readbackBytesPerFrame: stats.readbackBytesPerFrame,
        allFinite,
        maxNucleonErr,
        solarPeakTempK,
        solarPeakEps,
        solarMinFH2,
        solarSupernova: solarTel.supernovaTriggered,
        snStep,
        snTriggered: snTel.supernovaTriggered,
        snRemnant: snTel.remnantClass,
        snCoreTempK: snTel.coreTempK,
        snCoreRho: snTel.coreRhoKgM3,
        snBouncePts: snTel.nuclearBounceCount
      };
    });

    assert.equal(result.gpuErrors.length, 0, `GPU validation errors: ${result.gpuErrors.join('; ')}`);
    assert.equal(result.backend, 'webgpu');
    assert.equal(result.zeroCopy, true);
    assert.equal(result.readbackBytesPerFrame, 0);
    assert.equal(result.allFinite, true);
    assert.ok(result.maxNucleonErr < 1e-4, `nucleon drift ${result.maxNucleonErr}`);
    assert.ok(result.solarPeakTempK > 5e6, `solar core must ignite (>5e6 K), got ${result.solarPeakTempK}`);
    assert.ok(result.solarPeakEps > 1e-5, `solar pp-chain must ignite, got ${result.solarPeakEps}`);
    assert.ok(result.solarMinFH2 < 0.05, `solar core H2 must dissociate, got ${result.solarMinFH2}`);
    assert.equal(result.solarSupernova, false, '1 M_sun solar star must stay stable');
    assert.equal(result.snTriggered, true, `18 M_sun star must reach emergent core collapse/bounce on GPU (T=${result.snCoreTempK}, rho=${result.snCoreRho}, bounce=${result.snBouncePts})`);
    assert.equal(result.snRemnant, 'black-hole');
  } finally {
    await browser.close();
  }
});
