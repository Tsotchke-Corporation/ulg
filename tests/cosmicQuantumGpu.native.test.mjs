import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_COSMIC_QUANTUM === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test('GPU-native tiled WebGPU N-body verifies planetary Keplerian conservation, galactic momentum & translation invariance, and comoving LCDM expansion on real Vulkan GPU', {
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
      body: '<title>Cosmic Quantum Tiled N-Body GPU-Native Invariance Proof</title>'
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
        createPlanetarySystemBodies,
        createResidentTiledNBodyEngine,
        createResidentCosmicModuleRegistration
      } = await import('/src/demos/cosmicQuantumGpuKernels.js');
      const { createSimulationModuleRegistry } = await import('/src/runtime/simulationModuleRegistry.js');
      const { createUlgTaskCapsule, ULG_SERVICE_IDS, ULG_TASK_KINDS } = await import('/ulg-gpu-abi/src/serviceContract.js');

      const momentum = (arr) => {
        let px = 0; let py = 0; let pz = 0;
        for (let i = 0; i < arr.length; i += 8) {
          const m = arr[i + 3];
          px += m * arr[i + 4];
          py += m * arr[i + 5];
          pz += m * arr[i + 6];
        }
        return [px, py, pz];
      };

      const totalEnergyAndAngMom = (arr, G, eps2) => {
        const n = arr.length / 8;
        let ke = 0; let pe = 0;
        let lx = 0; let ly = 0; let lz = 0;
        for (let i = 0; i < n; i += 1) {
          const o = i * 8;
          const m = arr[o + 3];
          const x = arr[o]; const y = arr[o + 1]; const z = arr[o + 2];
          const vx = arr[o + 4]; const vy = arr[o + 5]; const vz = arr[o + 6];
          ke += 0.5 * m * (vx * vx + vy * vy + vz * vz);
          lx += m * (y * vz - z * vy);
          ly += m * (z * vx - x * vz);
          lz += m * (x * vy - y * vx);
          for (let j = i + 1; j < n; j += 1) {
            const q = j * 8;
            const r = Math.sqrt((arr[q] - x) ** 2 + (arr[q + 1] - y) ** 2 + (arr[q + 2] - z) ** 2 + eps2);
            pe -= (G * m * arr[q + 3]) / r;
          }
        }
        return { energy: ke + pe, L: Math.hypot(lx, ly, lz) };
      };

      // 1. Galactic Newtonian momentum conservation + exact off-origin translation invariance!
      const shift = [4.2, -2.1, 3.3];
      const galOriginInit = createGalacticBodies({ count: 256, preset: 'disk', seed: 825 });
      const galShiftInit = createGalacticBodies({ count: 256, preset: 'disk', seed: 825, centerOffset: shift });
      const galOrigin = createResidentTiledNBodyEngine({ device, initialBodies: galOriginInit, mode: 0, label: 'gal-orig' });
      const galShift = createResidentTiledNBodyEngine({ device, initialBodies: galShiftInit, mode: 0, label: 'gal-shift' });
      const p0 = momentum(galOriginInit);

      for (let s = 0; s < 10; s += 1) {
        await galOrigin.step({ dt: 0.012, gravity: 1.0, softening: 0.22, readback: s === 9 });
        await galShift.step({ dt: 0.012, gravity: 1.0, softening: 0.22, readback: s === 9 });
      }
      const galOut0 = galOrigin.getBodies();
      const galOutS = galShift.getBodies();
      const p1 = momentum(galOut0);
      const galMomentumErr = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      let galTransMaxDiff = 0;
      for (let i = 0; i < 256; i += 1) {
        const o = i * 8;
        const d = Math.hypot(
          (galOutS[o + 0] - shift[0]) - galOut0[o + 0],
          (galOutS[o + 1] - shift[1]) - galOut0[o + 1],
          (galOutS[o + 2] - shift[2]) - galOut0[o + 2]
        );
        if (d > galTransMaxDiff) galTransMaxDiff = d;
      }

      // 2. Planetary Newtonian Keplerian system on real GPU (150 steps -> energy & angular momentum conserved!)
      const planInit = createPlanetarySystemBodies({ gravity: 1.0, softening: 0.02 });
      const planInv0 = totalEnergyAndAngMom(planInit, 1.0, 0.02 * 0.02);
      const planEngine = createResidentTiledNBodyEngine({ device, initialBodies: planInit, mode: 0, label: 'plan-gpu' });
      for (let s = 0; s < 150; s += 1) {
        await planEngine.step({ dt: 0.012, gravity: 1.0, softening: 0.02, readback: s === 149 });
      }
      const planEnd = planEngine.getBodies();
      const planInv1 = totalEnergyAndAngMom(planEnd, 1.0, 0.02 * 0.02);
      const planEnergyRelErr = Math.abs(planInv1.energy - planInv0.energy) / Math.max(1e-6, Math.abs(planInv0.energy));
      const planAngMomRelErr = Math.abs(planInv1.L - planInv0.L) / Math.max(1e-6, Math.abs(planInv0.L));
      let minPlanetOrbitDisp = Infinity;
      let maxRadiusDriftFrac = 0;
      for (let i = 1; i < 5; i += 1) {
        const o = i * 8;
        const disp = Math.hypot(planEnd[o] - planInit[o], planEnd[o + 1] - planInit[o + 1], planEnd[o + 2] - planInit[o + 2]);
        if (disp < minPlanetOrbitDisp) minPlanetOrbitDisp = disp;
        const r0 = Math.hypot(planInit[o] - planInit[0], planInit[o + 1] - planInit[1], planInit[o + 2] - planInit[2]);
        const r1 = Math.hypot(planEnd[o] - planEnd[0], planEnd[o + 1] - planEnd[1], planEnd[o + 2] - planEnd[2]);
        const rDrift = Math.abs(r1 - r0) / r0;
        if (rDrift > maxRadiusDriftFrac) maxRadiusDriftFrac = rDrift;
      }

      // 3. Supergalactic Comoving LCDM translation invariance + scale factor a(t) expansion
      const webInit0 = createCosmicWebBodies({ count: 256, seed: 1370 });
      const webInitS = createCosmicWebBodies({ count: 256, seed: 1370, centerOffset: shift });
      const web0 = createResidentTiledNBodyEngine({ device, initialBodies: webInit0, mode: 1, label: 'web-0' });
      const webS = createResidentTiledNBodyEngine({ device, initialBodies: webInitS, mode: 1, label: 'web-s' });
      for (let s = 0; s < 5; s += 1) {
        await web0.step({ dt: 0.016, gravity: 0.08, softening: 0.85, hubbleRate: 0.14, readback: s === 4 });
        await webS.step({ dt: 0.016, gravity: 0.08, softening: 0.85, hubbleRate: 0.14, readback: s === 4 });
      }
      const w0 = web0.getBodies();
      const wS = webS.getBodies();
      let webTransMaxDiff = 0;
      for (let i = 0; i < 256; i += 1) {
        const o = i * 8;
        const d = Math.hypot(
          (wS[o + 0] - shift[0]) - w0[o + 0],
          (wS[o + 1] - shift[1]) - w0[o + 1],
          (wS[o + 2] - shift[2]) - w0[o + 2]
        );
        if (d > webTransMaxDiff) webTransMaxDiff = d;
      }

      // 4. Full 4096-body dispatch via SimulationModuleRegistry + ResidentModuleBufferSession
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
        scaleRangeM: [1e6, 1e22],
        zeroCopy: true
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

      const webScaleFactorA = web0.scaleFactorA;
      galOrigin.dispose();
      galShift.dispose();
      planEngine.dispose();
      web0.dispose();
      webS.dispose();
      bigEngine.dispose();
      device.destroy();

      return {
        galMomentumErr,
        galTransMaxDiff,
        planEnergyRelErr,
        planAngMomRelErr,
        minPlanetOrbitDisp,
        maxRadiusDriftFrac,
        webTransMaxDiff,
        webScaleFactorA,
        bigHasGpuBuffer,
        bigBackend,
        bigCount,
        errors
      };
    });

    console.log('Cosmic-Quantum GPU-Native Tiled N-Body Invariance Proof:', JSON.stringify(result));
    assert.deepEqual(result.errors, []);
    assert.ok(result.galMomentumErr < 1e-2, `Galactic momentum drift ${result.galMomentumErr}`);
    assert.ok(result.galTransMaxDiff < 2e-4, `Galactic translation invariance diff ${result.galTransMaxDiff}`);
    assert.ok(result.planEnergyRelErr < 1e-2, `Planetary energy rel err ${result.planEnergyRelErr}`);
    assert.ok(result.planAngMomRelErr < 1e-3, `Planetary angular momentum rel err ${result.planAngMomRelErr}`);
    assert.ok(result.minPlanetOrbitDisp > 0.5, `All planets must genuinely orbit via GPU gravity, minDisp=${result.minPlanetOrbitDisp}`);
    assert.ok(result.maxRadiusDriftFrac < 0.04, `Circular Keplerian orbits must remain stable, maxRadiusDrift=${result.maxRadiusDriftFrac}`);
    assert.ok(result.webTransMaxDiff < 2e-4, `Comoving LCDM translation invariance diff ${result.webTransMaxDiff}`);
    assert.ok(result.webScaleFactorA > 0.25);
    assert.equal(result.bigHasGpuBuffer, true);
    assert.equal(result.bigBackend, 'webgpu');
    assert.equal(result.bigCount, 4096);
  } finally {
    await browser.close();
  }
});
