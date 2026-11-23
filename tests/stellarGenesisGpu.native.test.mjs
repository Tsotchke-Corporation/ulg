import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_STELLAR_GENESIS === '1'
  || process.env.ULG_RUN_NATIVE_COSMIC_QUANTUM === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test('GPU-native self-gravitating-hydro@1 invariance proof on real Vulkan GPU: off-origin translation invariance, true two-star binary formation, stable 1 M_sun star, and emergent 18 M_sun core-collapse bounce', {
  skip: !RUN_NATIVE && 'set ULG_RUN_NATIVE_STELLAR_GENESIS=1 or ULG_RUN_NATIVE_WEBGPU=1',
  timeout: 180000
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
      body: '<title>General Self-Gravitating Hydro WebGPU Invariance Proof</title>'
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

      const computeComAndMomentum = (bodies) => {
        let mTot = 0;
        let cx = 0; let cy = 0; let cz = 0;
        let px = 0; let py = 0; let pz = 0;
        for (let i = 0; i < bodies.length; i += HYDRO_PARTICLE_STRIDE_FLOATS) {
          const m = bodies[i + 3];
          mTot += m;
          cx += m * bodies[i + 0];
          cy += m * bodies[i + 1];
          cz += m * bodies[i + 2];
          px += m * bodies[i + 4];
          py += m * bodies[i + 5];
          pz += m * bodies[i + 6];
        }
        return {
          com: [cx / mTot, cy / mTot, cz / mTot],
          momentum: [px, py, pz],
          mTot
        };
      };

      const renderer = new THREE.WebGPURenderer({ antialias: false, device });
      renderer.setSize(256, 256);
      await renderer.init();
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
      cam.position.set(0, 8, 18);
      cam.lookAt(0, 0, 0);

      // --- 1. Origin 1.0 M_sun star via SimulationModuleRegistry + zero-copy presenter ---
      const solarOriginBodies = createHydrogenNebulaInitialBodies({ count: 4096, preset: 'solar-nebula', seed: 1939 });
      const initOriginCom = computeComAndMomentum(solarOriginBodies);
      const engine = createSelfGravitatingHydroEngine({
        device,
        initialBodies: solarOriginBodies,
        eosClosureTable: table,
        label: 'proof-sgh-origin'
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
      let originShortBodies = null;
      for (let s = 0; s < 160; s += 1) {
        const cap = createUlgTaskCapsule({
          taskId: `sgh-sol-${s}`,
          serviceId: ULG_SERVICE_IDS.ulgRuntime,
          taskKind: ULG_TASK_KINDS.simulationStep,
          method: { model: 'self-gravitating-hydro', version: 1 },
          input: { stepIndex: s, parameters: { dt: 0.018, timeAccel: 4.5, readTelemetry: s % 8 === 0 || s === 159 } }
        });
        const res = await registry.dispatchSimulationStepCapsule(cap, { device });
        presenter.bindLeaseHandle(res.leaseHandle);
        if (s % 20 === 0) renderer.render(scene, cam);
        res.leaseHandle.release();
        if (s === 11) {
          await device.queue.onSubmittedWorkDone();
          originShortBodies = Float32Array.from(await engine.readbackBodies());
        }
        const tel = engine.getTelemetry();
        if (tel.coreTempK > solarPeakTempK) solarPeakTempK = tel.coreTempK;
        if (tel.peakEpsNucWPerKg > solarPeakEps) solarPeakEps = tel.peakEpsNucWPerKg;
        if (tel.coreFH2 < solarMinFH2) solarMinFH2 = tel.coreFH2;
      }
      await device.queue.onSubmittedWorkDone();
      const solarOriginTel = engine.getTelemetry();
      const originEndBodies = Float32Array.from(await engine.readbackBodies());
      const originEndCom = computeComAndMomentum(originEndBodies);
      const computeRmsRadius = (bodies, com) => {
        let sumR2 = 0;
        let mTot = 0;
        for (let i = 0; i < bodies.length; i += HYDRO_PARTICLE_STRIDE_FLOATS) {
          const m = bodies[i + 3];
          const dx = bodies[i + 0] - com[0];
          const dy = bodies[i + 1] - com[1];
          const dz = bodies[i + 2] - com[2];
          sumR2 += m * (dx * dx + dy * dy + dz * dz);
          mTot += m;
        }
        return Math.sqrt(sumR2 / Math.max(1e-9, mTot));
      };
      const originEndRmsR = computeRmsRadius(originEndBodies, originEndCom.com);

      let allFinite = true;
      let maxNucleonErr = 0;
      for (let i = 0; i < originEndBodies.length; i += 16) {
        for (let k = 0; k < 16; k += 1) {
          if (!Number.isFinite(originEndBodies[i + k])) allFinite = false;
        }
        const err = Math.abs((originEndBodies[i + 10] + originEndBodies[i + 14] + originEndBodies[i + 15]) - 1.0);
        if (err > maxNucleonErr) maxNucleonErr = err;
      }

      // --- 2. TRANSLATION INVARIANCE PROOF: identical 1.0 M_sun cloud shifted to (+3.5, -1.5, +2.0)! ---
      const shift = [3.5, -1.5, 2.0];
      const solarShiftedBodies = createHydrogenNebulaInitialBodies({
        count: 4096,
        preset: 'solar-nebula',
        seed: 1939,
        centerOffset: shift
      });
      const initShiftedCom = computeComAndMomentum(solarShiftedBodies);
      engine.resetBodies(solarShiftedBodies);
      let shiftedPeakTempK = 0;
      let shiftedShortBodies = null;
      for (let s = 0; s < 160; s += 1) {
        const tel = await engine.step({ dt: 0.018, timeAccel: 4.5, readTelemetry: s % 8 === 0 || s === 159 });
        if (s === 11) {
          await device.queue.onSubmittedWorkDone();
          shiftedShortBodies = Float32Array.from(await engine.readbackBodies());
        }
        if (tel.coreTempK > shiftedPeakTempK) shiftedPeakTempK = tel.coreTempK;
      }
      await device.queue.onSubmittedWorkDone();
      const solarShiftedTel = engine.getTelemetry();
      const shiftedEndBodies = Float32Array.from(await engine.readbackBodies());
      const shiftedEndCom = computeComAndMomentum(shiftedEndBodies);
      const shiftedEndRmsR = computeRmsRadius(shiftedEndBodies, shiftedEndCom.com);

      // Measure exact short-horizon per-particle position diff (pre-Lyapunov) AND macroscopic long-horizon invariants!
      let maxShortRelPosDiff = 0;
      for (let i = 0; i < originShortBodies.length; i += 16) {
        const dx = (shiftedShortBodies[i + 0] - shift[0]) - originShortBodies[i + 0];
        const dy = (shiftedShortBodies[i + 1] - shift[1]) - originShortBodies[i + 1];
        const dz = (shiftedShortBodies[i + 2] - shift[2]) - originShortBodies[i + 2];
        const d = Math.hypot(dx, dy, dz);
        if (d > maxShortRelPosDiff) maxShortRelPosDiff = d;
      }
      const shiftedComShiftErr = Math.hypot(
        (shiftedEndCom.com[0] - originEndCom.com[0]) - shift[0],
        (shiftedEndCom.com[1] - originEndCom.com[1]) - shift[1],
        (shiftedEndCom.com[2] - originEndCom.com[2]) - shift[2]
      );

      // --- 3. TRUE MULTI-BODY BINARY FORMATION PROOF (2.4 M_sun twin-lobe -> 2 distinct hot cores!) ---
      const binBodies = createHydrogenNebulaInitialBodies({ count: 4096, preset: 'binary-nursery', seed: 1939 });
      engine.resetBodies(binBodies);
      for (let s = 0; s < 120; s += 1) {
        await engine.step({ dt: 0.016, timeAccel: 4.0, readTelemetry: s === 119 });
      }
      await device.queue.onSubmittedWorkDone();
      const binTel = engine.getTelemetry();
      const binEnd = Float32Array.from(await engine.readbackBodies());
      // Track the two initial lobes (even vs odd indices) separately to prove they stay TWO distinct stars!
      let m0 = 0; let c0x = 0; let c0y = 0; let c0z = 0; let maxT0 = 0;
      let m1 = 0; let c1x = 0; let c1y = 0; let c1z = 0; let maxT1 = 0;
      for (let i = 0; i < 4096; i += 1) {
        if (i % 10 === 0) continue; // skip bridge particles
        const o = i * 16;
        const m = binEnd[o + 3];
        const T = Math.pow(10, binEnd[o + 8]);
        if ((i & 1) === 0) {
          m0 += m; c0x += m * binEnd[o + 0]; c0y += m * binEnd[o + 1]; c0z += m * binEnd[o + 2];
          if (T > maxT0) maxT0 = T;
        } else {
          m1 += m; c1x += m * binEnd[o + 0]; c1y += m * binEnd[o + 1]; c1z += m * binEnd[o + 2];
          if (T > maxT1) maxT1 = T;
        }
      }
      const lobe0Com = [c0x / m0, c0y / m0, c0z / m0];
      const lobe1Com = [c1x / m1, c1y / m1, c1z / m1];
      const binarySeparation = Math.hypot(lobe1Com[0] - lobe0Com[0], lobe1Com[1] - lobe0Com[1], lobe1Com[2] - lobe0Com[2]);

      // --- 4. EMERGENT 18 M_sun CORE-COLLAPSE SUPERNOVA (IDENTICAL ENGINE, ONLY 18x MASS!) ---
      const massiveBodies = createHydrogenNebulaInitialBodies({ count: 4096, preset: 'massive-supernova', seed: 1939 });
      engine.resetBodies(massiveBodies);
      presenter.bindResidentBuffer(engine.getResidentBuffer());
      let snStep = -1;
      let snPeakTempK = 0;
      let snPeakRho = 0;
      for (let s = 0; s < 220; s += 1) {
        const tel = await engine.step({ dt: 0.018, timeAccel: 6.5, readTelemetry: s % 4 === 0 || s === 219 });
        if (tel.coreTempK > snPeakTempK) snPeakTempK = tel.coreTempK;
        if (tel.coreRhoKgM3 > snPeakRho) snPeakRho = tel.coreRhoKgM3;
        if (tel.supernovaTriggered && snStep < 0) snStep = s;
        if (s % 40 === 0) {
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
        solarOriginEndTempK: solarOriginTel.coreTempK,
        solarOriginEndRho: solarOriginTel.coreRhoKgM3,
        solarOriginSupernova: solarOriginTel.supernovaTriggered,
        shiftedPeakTempK,
        solarShiftedEndTempK: solarShiftedTel.coreTempK,
        originEndRmsR,
        shiftedEndRmsR,
        maxShortRelPosDiff,
        shiftedComShiftErr,
        initOriginCom: initOriginCom.com,
        initShiftedCom: initShiftedCom.com,
        originEndCom: originEndCom.com,
        shiftedEndCom: shiftedEndCom.com,
        binarySeparation,
        binaryLobe0MaxT: maxT0,
        binaryLobe1MaxT: maxT1,
        binaryCoreTempK: binTel.coreTempK,
        snStep,
        snPeakTempK,
        snPeakRho,
        snTriggered: snTel.supernovaTriggered,
        snRemnant: snTel.remnantClass,
        snBouncePts: snTel.nuclearBounceCount,
        snCoreXZ: snTel.coreXZ
      };
    });
    if (process.env.ULG_DEBUG_SGH === '1') {
      console.log('SGH_DIAG:', JSON.stringify(result, null, 2));
    }

    assert.deepEqual(result.gpuErrors, [], `GPU validation errors: ${result.gpuErrors.join('; ')}`);
    assert.equal(result.backend, 'webgpu');
    assert.equal(result.zeroCopy, true);
    assert.equal(result.readbackBytesPerFrame, 0);
    assert.equal(result.allFinite, true);
    assert.ok(result.maxNucleonErr < 1e-4, `nucleon drift ${result.maxNucleonErr}`);

    // 1. 1.0 M_sun stable main-sequence star
    assert.ok(result.solarPeakTempK > 5e6, `1 M_sun must ignite pp-chain (>5e6 K), got ${result.solarPeakTempK}`);
    assert.ok(result.solarPeakEps > 1e-5, `1 M_sun pp-chain must ignite, got ${result.solarPeakEps}`);
    assert.ok(result.solarMinFH2 < 0.05, `1 M_sun core H2 must dissociate, got ${result.solarMinFH2}`);
    assert.equal(result.solarOriginSupernova, false, `1 M_sun star must remain stable without supernova (T=${result.solarOriginEndTempK})`);

    // 2. Strict Off-Origin Translation Invariance!
    const tempRelDiff = Math.abs(result.shiftedPeakTempK - result.solarPeakTempK) / Math.max(1, result.solarPeakTempK);
    const rmsRelDiff = Math.abs(result.shiftedEndRmsR - result.originEndRmsR) / Math.max(1e-6, result.originEndRmsR);
    assert.ok(tempRelDiff < 0.02, `Translation invariance failed on peak core temp: origin=${result.solarPeakTempK}, shifted=${result.shiftedPeakTempK} (relDiff=${tempRelDiff})`);
    assert.ok(rmsRelDiff < 0.03, `Translation invariance failed on final RMS radius: origin=${result.originEndRmsR}, shifted=${result.shiftedEndRmsR} (relDiff=${rmsRelDiff})`);
    assert.ok(result.shiftedComShiftErr < 0.05, `Shifted cloud COM drifted relative to origin cloud: err=${result.shiftedComShiftErr}, originCom=${JSON.stringify(result.originEndCom)}, shiftedCom=${JSON.stringify(result.shiftedEndCom)}`);
    assert.ok(result.maxShortRelPosDiff < 0.02, `Short-horizon per-particle trajectory diverged under pure translation: maxShortRelPosDiff=${result.maxShortRelPosDiff}`);

    // 3. True Multi-Body Binary Formation (TWO separated hot cores, NOT collapsed to origin!)
    assert.ok(result.binarySeparation > 2.5, `Binary nursery must keep two distinct separated cores (>2.5), got separation=${result.binarySeparation}`);
    assert.ok(result.binaryLobe0MaxT > 1e5 && result.binaryLobe1MaxT > 1e5,
      `Both binary lobes must independently compress and heat (>1e5 K), got lobe0=${result.binaryLobe0MaxT}, lobe1=${result.binaryLobe1MaxT}`);

    // 4. Emergent 18 M_sun core-collapse supernova & black hole remnant
    assert.ok(result.snPeakTempK > 5e8, `18 M_sun must climb >5e8 K from self-gravity alone, got ${result.snPeakTempK}`);
    assert.equal(result.snTriggered, true, `18 M_sun must trigger emergent nuclear bounce/collapse (peakT=${result.snPeakTempK}, peakRho=${result.snPeakRho}, bounce=${result.snBouncePts})`);
    assert.equal(result.snRemnant, 'black-hole');
  } finally {
    await browser.close();
  }
});
