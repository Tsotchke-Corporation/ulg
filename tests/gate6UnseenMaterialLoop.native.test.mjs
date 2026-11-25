import assert from 'node:assert/strict';
import test from 'node:test';

// Gate 6 Phase E Native Vulkan Proof:
// Live Unseen-Material Continuum <-> Quantum OPFS + PeerCompute ReservationLedger Hot-Swap Loop:
//   1. Confirms `KBr` and `GeO2` are 100% absent from static `foundation-polytope-atlas.json`.
//   2. Evaluates `KBr` & `GeO2` against the seeded live GPU bank BEFORE hot-swap -> strictly
//      fail-closed `hit === false` (`hitFlag == 0`), while static `H2O`/`Fe` hit cleanly.
//   3. Clears real browser OPFS cache -> runs `hotSwapUnseenMaterialAtlasWebGpu(device, 'KBr')`
//      and `hotSwapUnseenMaterialAtlasWebGpu(device, 'GeO2')` (first-principles GPU derivation +
//      `cristobalite-C9` covalent tetrahedral network for `GeO2` + OPFS persist + PeerCompute
//      `ReservationLedger` CAS atomic bank swap).
//   4. Evaluates live hot-swapped GPU bank (`eval_polytope_atlas_bank_2d`) AND live continuum
//      mechanics refresh (`runMlsMpmMechanicsRefreshWebGpu` at `@binding(8)`) -> both `KBr` and
//      `GeO2` hit with physically positive densities, static `H2O`/`Fe` still hit, and extreme
//      out-of-domain queries (`T=999999 K`) still fail closed (`hit === false`).
//   5. Reloads browser page (`page.reload()`) -> fresh JS realm + fresh `GPUDevice` -> hydrates
//      `KBr` and `GeO2` directly from real OPFS (`cacheStatus === 'hit'`, ZERO `fitConvexPolytopeWebGpu`
//      recomputation!) -> hot-swaps onto the new `GPUDevice` bank -> verifies BIT-EXACT identical
//      GPU `densityKgPerM3` and `phaseCode` to pre-reload!
//   6. Corrupts a cached OPFS JSON entry -> confirms fail-closed eviction, fresh GPU rebuild,
//      and atomic CAS hot-swap recovery.

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Gate 6 Phase E native Vulkan proof: unseen KBr & GeO2 derivation -> OPFS cache -> PeerCompute CAS bank hot-swap -> cross-reload bit-exact continuum hit', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Gate 6 Phase E proof',
  timeout: 240_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // PASS 1: Cold unseen derivation -> OPFS persist -> PeerCompute CAS hot-swap -> live GPU bank + mechanics refresh
    const pass1 = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 250));
      }
      if (!adapter) return { status: 'unsupported' };
      const { webGpuDeviceDescriptorForResidentSph } = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(webGpuDeviceDescriptorForResidentSph(adapter));
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const {
        lookupFoundationPolytopeRecord,
        seedStudioFoundationTriadOnDevice,
        getFoundationPolytopeGpuBinding,
        getFoundationPolytopeDeviceStatus,
        evaluatePolytopeAtlasBankBatchWebGpu,
        hotSwapUnseenMaterialAtlasWebGpu,
        consumeAndEscalatePolytopeReceiptOnDevice
      } = await import('/src/runtime/material/foundationPolytopeAtlasGpuBridge.js');
      const { getSharedPolytopeAtlasPersistentCache } = await import('/src/runtime/material/polytopeAtlasPersistentCache.js');
      const { stableOpticalMaterialId, GPU_PHASE_IDS } = await import('/src/runtime/material/opticalGpuBuffers.js');
      const { buildMlsMpmMechanicsMaterialTable } = await import('/src/runtime/sph/sphMechanicsMaterialTable.js');
      const { runMlsMpmMechanicsRefreshWebGpu } = await import('/src/runtime/sph/sphMechanicsRefreshGpuKernel.js');
      const {
        ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
        ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
        MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT
      } = await import('/ulg-gpu-abi/src/index.js');

      const staticKbr = lookupFoundationPolytopeRecord('KBr');
      const staticGeo2 = lookupFoundationPolytopeRecord('GeO2');

      const cache = getSharedPolytopeAtlasPersistentCache();
      await cache.clear();
      const cacheBackend = await cache.getBackend();

      // Seed standard Studio bank (H2O, Fe, N2...)
      await seedStudioFoundationTriadOnDevice(device, ['h2o', 'fe', 'n2']);
      const genBefore = getFoundationPolytopeGpuBinding(device).generation;

      // BEFORE hot-swap: KBr & GeO2 must strictly MISS (`hit === false`), while H2O & Fe HIT
      const beforeEval = await evaluatePolytopeAtlasBankBatchWebGpu(device, {
        queries: [
          { materialKey: 'KBr', temperatureK: 400, pressurePa: 101325 },
          { materialKey: 'GeO2', temperatureK: 600, pressurePa: 101325 },
          { materialKey: 'H2O', temperatureK: 300, pressurePa: 101325 },
          { materialKey: 'Fe', temperatureK: 300, pressurePa: 101325 }
        ]
      });

      // Hot-swap brand-new unseen compounds KBr (ionic rocksalt/CsCl) & GeO2 (covalent cristobalite-C9)
      const kbrSwap = await hotSwapUnseenMaterialAtlasWebGpu(device, 'KBr', {
        runLiveMd: true,
        mdSteps: 8,
        mdCellsPerSide: 2,
        consumerId: 'phase-e-kbr-cold'
      });
      const geo2Swap = await hotSwapUnseenMaterialAtlasWebGpu(device, 'GeO2', {
        runLiveMd: true,
        mdSteps: 8,
        mdCellsPerSide: 2,
        consumerId: 'phase-e-geo2-cold'
      });

      // Evaluate live hot-swapped GPU bank (in-domain hits incl. formula alias 'GeO2' + out-of-domain fail-closed misses + static H2O/Fe)
      const afterEval = await evaluatePolytopeAtlasBankBatchWebGpu(device, {
        queries: [
          { materialKey: kbrSwap.bundle.materialKey, temperatureK: 400, pressurePa: 101325 },
          { materialKey: 'GeO2', temperatureK: 600, pressurePa: 101325 },
          { materialKey: 'H2O', temperatureK: 300, pressurePa: 101325 },
          { materialKey: 'Fe', temperatureK: 300, pressurePa: 101325 },
          { materialKey: kbrSwap.bundle.materialKey, temperatureK: 999999, pressurePa: 101325 },
          { materialKey: geo2Swap.bundle.materialKey, temperatureK: 600, pressurePa: 1e18 }
        ]
      });

      // Live Continuum Mechanics Refresh consuming the hot-swapped unseen KBr & GeO2 at @binding(8)!
      const kbrId = kbrSwap.admission.materialId;
      const geo2Id = geo2Swap.admission.materialId;
      const kbrKeyNorm = kbrSwap.bundle.materialKey.toLowerCase();
      const geo2KeyNorm = geo2Swap.bundle.materialKey.toLowerCase();
      const table = buildMlsMpmMechanicsMaterialTable({
        [kbrKeyNorm]: {
          molarMassKgPerMol: kbrSwap.bundle.nuclear.molarMassU * 1e-3,
          phases: [{
            name: 'solid',
            densityKgPerM3: kbrSwap.bundle.mechanical.densityKgPerM3,
            bulkModulusPa: kbrSwap.bundle.mechanical.bulkModulusPa,
            shearModulusPa: kbrSwap.bundle.mechanical.shearModulusPa,
            cpJPerKgK: kbrSwap.bundle.thermodynamic.heatCapacityCpJPerKgK,
            temperatureRange: [0, kbrSwap.bundle.thermodynamic.meltingPointK]
          }]
        },
        [geo2KeyNorm]: {
          molarMassKgPerMol: geo2Swap.bundle.nuclear.molarMassU * 1e-3,
          phases: [{
            name: 'solid',
            densityKgPerM3: geo2Swap.bundle.mechanical.densityKgPerM3,
            bulkModulusPa: geo2Swap.bundle.mechanical.bulkModulusPa,
            shearModulusPa: geo2Swap.bundle.mechanical.shearModulusPa,
            cpJPerKgK: geo2Swap.bundle.thermodynamic.heatCapacityCpJPerKgK,
            temperatureRange: [0, geo2Swap.bundle.thermodynamic.meltingPointK]
          }]
        }
      }, { soundSpeedScale: 0.5 });

      const state = new Float32Array([
        0.1, 0.1, 0.1, 0.01, 0, 0, 0, 1.5e5,
        0.2, 0.1, 0.1, 0.01, 0, 0, 0, 2.5e5
      ]);
      const thermo = new Float32Array(2 * 12);
      thermo.set([kbrId, GPU_PHASE_IDS.solid, 400, kbrSwap.bundle.mechanical.densityKgPerM3, 0, 1, 0, 0, 0.005, 1, 0, 0.005], 0);
      thermo.set([geo2Id, GPU_PHASE_IDS.solid, 600, geo2Swap.bundle.mechanical.densityKgPerM3, 0, 1, 0, 0, 0.005, 1, 0, 0.005], 12);
      const mechStride = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
      const mechanics = new Float32Array(2 * mechStride);
      for (let i = 0; i < 2; i += 1) {
        mechanics[i * mechStride + 0] = 1;
        mechanics[i * mechStride + 4] = 1;
        mechanics[i * mechStride + 8] = 1;
        mechanics[i * mechStride + 18] = 1;
        mechanics[i * mechStride + 19] = 1e-5;
        mechanics[i * mechStride + 21] = 1;
        mechanics[i * mechStride + 27] = 1;
      }
      const makeBuf = (arr) => {
        const b = device.createBuffer({ size: arr.byteLength, usage: 0x80 | 0x04 | 0x08 });
        device.queue.writeBuffer(b, 0, arr);
        return b;
      };
      const stBuf = makeBuf(state);
      const thBuf = makeBuf(thermo);
      const mcBuf = makeBuf(mechanics);
      const refreshOut = await runMlsMpmMechanicsRefreshWebGpu({
        device,
        sphParticleState: { schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: 2, state, thermo },
        mlsMpmParticleState: { schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: 2, mechanics },
        mechanicsMaterialTable: table,
        sphParticleUpload: { stateBuffer: stBuf, thermoBuffer: thBuf },
        mlsMpmParticleUpload: { mechanicsBuffer: mcBuf },
        retainOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        capturePolytopeReceipt: true
      });
      await device.queue.onSubmittedWorkDone();
      const continuumReceipt = await consumeAndEscalatePolytopeReceiptOnDevice(device);
      stBuf.destroy();
      thBuf.destroy();
      mcBuf.destroy();
      refreshOut?.mechanicsBuffer?.destroy?.();

      // Persist bundles in sessionStorage so post-reload pass can test pure OPFS hydration without re-fitting
      sessionStorage.setItem('__gate6_phase_e_kbr_bundle', JSON.stringify(kbrSwap.bundle));
      sessionStorage.setItem('__gate6_phase_e_geo2_bundle', JSON.stringify(geo2Swap.bundle));

      const deviceStatus = getFoundationPolytopeDeviceStatus(device);
      device.destroy();

      return {
        status: 'ok',
        gpuErrors,
        staticKbr,
        staticGeo2,
        cacheBackend,
        genBefore,
        beforeEval,
        kbr: {
          materialKey: kbrSwap.bundle.materialKey,
          crystal: kbrSwap.bundle.mechanical.crystalStructure,
          density: kbrSwap.bundle.mechanical.densityKgPerM3,
          cacheStatus: kbrSwap.cacheStatus,
          cacheBackend: kbrSwap.cacheBackend,
          cacheKey: kbrSwap.cacheKey,
          admission: {
            admitted: kbrSwap.admission.admitted,
            materialId: kbrSwap.admission.materialId,
            bankGeneration: kbrSwap.admission.bankGeneration,
            reservationEpoch: kbrSwap.admission.reservationEpoch,
            polytopeCount: kbrSwap.admission.polytopeCount
          }
        },
        geo2: {
          materialKey: geo2Swap.bundle.materialKey,
          crystal: geo2Swap.bundle.mechanical.crystalStructure,
          density: geo2Swap.bundle.mechanical.densityKgPerM3,
          cacheStatus: geo2Swap.cacheStatus,
          cacheBackend: geo2Swap.cacheBackend,
          cacheKey: geo2Swap.cacheKey,
          admission: {
            admitted: geo2Swap.admission.admitted,
            materialId: geo2Swap.admission.materialId,
            bankGeneration: geo2Swap.admission.bankGeneration,
            reservationEpoch: geo2Swap.admission.reservationEpoch,
            polytopeCount: geo2Swap.admission.polytopeCount
          }
        },
        afterEval,
        continuumRefresh: {
          polytopeAtlasBound: refreshOut?.polytopeAtlasBound ?? false,
          polytopeAtlasGeneration: refreshOut?.polytopeAtlasGeneration ?? 0,
          receipt: continuumReceipt
        },
        deviceStatus
      };
    });

    assert.deepEqual(pageErrors, []);
    assert.equal(pass1.status, 'ok');
    assert.deepEqual(pass1.gpuErrors, []);
    console.log('[gate6-phase-e-pass1]', JSON.stringify({
      cacheBackend: pass1.cacheBackend,
      genBefore: pass1.genBefore,
      kbr: pass1.kbr,
      geo2: pass1.geo2,
      beforeReceipt: pass1.beforeEval.receipt,
      afterReceipt: pass1.afterEval.receipt,
      afterRows: pass1.afterEval.rows,
      continuumRefresh: pass1.continuumRefresh
    }));

    // 1. Genuinely unseen in static bank
    assert.equal(pass1.staticKbr, null);
    assert.equal(pass1.staticGeo2, null);
    assert.ok(pass1.cacheBackend === 'opfs' || pass1.cacheBackend === 'indexeddb', `expected persistent cache backend, got ${pass1.cacheBackend}`);

    // 2. Before hot-swap: KBr & GeO2 strictly MISS, H2O & Fe strictly HIT
    assert.equal(pass1.beforeEval.rows[0].hit, false, 'KBr must miss before hot-swap');
    assert.equal(pass1.beforeEval.rows[1].hit, false, 'GeO2 must miss before hot-swap');
    assert.equal(pass1.beforeEval.rows[2].hit, true, 'static H2O must hit before hot-swap');
    assert.equal(pass1.beforeEval.rows[3].hit, true, 'static Fe must hit before hot-swap');

    // 3. Cold derivation + OPFS store + CAS admission
    assert.equal(pass1.kbr.cacheStatus, 'miss-stored');
    assert.equal(pass1.geo2.cacheStatus, 'miss-stored');
    assert.equal(pass1.geo2.crystal, 'cristobalite-C9', `GeO2 must derive extended covalent cristobalite-C9, got ${pass1.geo2.crystal}`);
    assert.equal(pass1.kbr.admission.admitted, true);
    assert.equal(pass1.geo2.admission.admitted, true);
    assert.ok(pass1.kbr.admission.bankGeneration > pass1.genBefore);
    assert.ok(pass1.geo2.admission.bankGeneration > pass1.kbr.admission.bankGeneration);

    // 4. After hot-swap: KBr, GeO2, H2O, Fe all HIT; extreme out-of-domain T/P still MISS (fail-closed!)
    assert.equal(pass1.afterEval.rows[0].hit, true, 'KBr must hit live GPU bank after hot-swap');
    assert.equal(pass1.afterEval.rows[1].hit, true, 'GeO2 must hit live GPU bank after hot-swap');
    assert.equal(pass1.afterEval.rows[2].hit, true, 'H2O must remain hitting after hot-swap');
    assert.equal(pass1.afterEval.rows[3].hit, true, 'Fe must remain hitting after hot-swap');
    assert.equal(pass1.afterEval.rows[4].hit, false, 'KBr T=999999 K must fail closed');
    assert.equal(pass1.afterEval.rows[5].hit, false, 'GeO2 P=1e18 Pa must fail closed');
    assert.ok(pass1.afterEval.rows[0].densityKgPerM3 > 1200 && pass1.afterEval.rows[0].densityKgPerM3 < 6000,
      `KBr GPU density out of physical solid range: ${pass1.afterEval.rows[0].densityKgPerM3}`);
    assert.ok(pass1.afterEval.rows[1].densityKgPerM3 > 1800 && pass1.afterEval.rows[1].densityKgPerM3 < 8000,
      `GeO2 GPU density out of physical solid range: ${pass1.afterEval.rows[1].densityKgPerM3}`);
    assert.equal(pass1.continuumRefresh.polytopeAtlasBound, true);
    assert.equal(pass1.continuumRefresh.receipt?.hits, 2, `Continuum mechanics refresh must hit both unseen KBr & GeO2: ${JSON.stringify(pass1.continuumRefresh)}`);
    assert.equal(pass1.continuumRefresh.receipt?.applied, 2);
    assert.equal(pass1.continuumRefresh.receipt?.misses, 0);

    // PASS 2: Full browser page.reload() -> fresh JS realm + fresh GPUDevice -> OPFS warm hydration (0 re-derivation!)
    //         -> bit-exact GPU density & phaseCode -> corrupt OPFS eviction + fail-closed GPU rebuild recovery!
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    const pass2 = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 250));
      }
      if (!adapter) return { status: 'unsupported' };
      const { webGpuDeviceDescriptorForResidentSph } = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(webGpuDeviceDescriptorForResidentSph(adapter));
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const {
        seedStudioFoundationTriadOnDevice,
        evaluatePolytopeAtlasBankBatchWebGpu,
        hotSwapUnseenMaterialAtlasWebGpu
      } = await import('/src/runtime/material/foundationPolytopeAtlasGpuBridge.js');
      const { getSharedPolytopeAtlasPersistentCache } = await import('/src/runtime/material/polytopeAtlasPersistentCache.js');

      const kbrBundle = JSON.parse(sessionStorage.getItem('__gate6_phase_e_kbr_bundle'));
      const geo2Bundle = JSON.parse(sessionStorage.getItem('__gate6_phase_e_geo2_bundle'));

      await seedStudioFoundationTriadOnDevice(device, ['h2o', 'fe']);
      const t0 = performance.now();
      const kbrWarm = await hotSwapUnseenMaterialAtlasWebGpu(device, kbrBundle, {
        consumerId: 'phase-e-kbr-reload'
      });
      const geo2Warm = await hotSwapUnseenMaterialAtlasWebGpu(device, geo2Bundle, {
        consumerId: 'phase-e-geo2-reload'
      });
      const warmMs = performance.now() - t0;

      const warmEval = await evaluatePolytopeAtlasBankBatchWebGpu(device, {
        queries: [
          { materialKey: kbrBundle.materialKey, temperatureK: 400, pressurePa: 101325 },
          { materialKey: geo2Bundle.materialKey, temperatureK: 600, pressurePa: 101325 }
        ]
      });

      // Corruption test: write corrupt JSON under KBr's OPFS key -> fail-closed eviction & fresh GPU rebuild + CAS epoch advance
      const cache = getSharedPolytopeAtlasPersistentCache();
      await cache.writeRawForTest(kbrWarm.cacheKey, '{"schema":"corrupt-truncated"');
      const kbrRecovered = await hotSwapUnseenMaterialAtlasWebGpu(device, kbrBundle, {
        consumerId: 'phase-e-kbr-corrupt-recovery'
      });
      const cacheStatsAfterCorrupt = cache.getStats();
      const recoveredEval = await evaluatePolytopeAtlasBankBatchWebGpu(device, {
        queries: [
          { materialKey: kbrBundle.materialKey, temperatureK: 400, pressurePa: 101325 }
        ]
      });

      device.destroy();
      return {
        status: 'ok',
        gpuErrors,
        warmMs,
        kbrWarm: {
          cacheStatus: kbrWarm.cacheStatus,
          cacheBackend: kbrWarm.cacheBackend,
          cacheKey: kbrWarm.cacheKey,
          reservationEpoch: kbrWarm.admission.reservationEpoch,
          bankGeneration: kbrWarm.admission.bankGeneration
        },
        geo2Warm: {
          cacheStatus: geo2Warm.cacheStatus,
          cacheBackend: geo2Warm.cacheBackend,
          cacheKey: geo2Warm.cacheKey,
          reservationEpoch: geo2Warm.admission.reservationEpoch,
          bankGeneration: geo2Warm.admission.bankGeneration
        },
        warmEval,
        kbrRecovered: {
          cacheStatus: kbrRecovered.cacheStatus,
          reservationEpoch: kbrRecovered.admission.reservationEpoch,
          bankGeneration: kbrRecovered.admission.bankGeneration
        },
        cacheStatsAfterCorrupt,
        recoveredEval
      };
    });

    assert.deepEqual(pageErrors, []);
    assert.equal(pass2.status, 'ok');
    assert.deepEqual(pass2.gpuErrors, []);
    console.log('[gate6-phase-e-pass2-reload]', JSON.stringify({
      warmMs: Number(pass2.warmMs.toFixed(2)),
      kbrWarm: pass2.kbrWarm,
      geo2Warm: pass2.geo2Warm,
      warmRows: pass2.warmEval.rows,
      kbrRecovered: pass2.kbrRecovered,
      cacheStatsAfterCorrupt: pass2.cacheStatsAfterCorrupt,
      recoveredRow: pass2.recoveredEval.rows[0]
    }));

    // Cross-reload OPFS hits & BIT-EXACT GPU density + phaseCode match!
    assert.equal(pass2.kbrWarm.cacheStatus, 'hit', 'KBr must hit OPFS across page reload');
    assert.equal(pass2.geo2Warm.cacheStatus, 'hit', 'GeO2 must hit OPFS across page reload');
    assert.equal(pass2.kbrWarm.cacheBackend, pass1.cacheBackend);
    assert.equal(pass2.geo2Warm.cacheBackend, pass1.cacheBackend);
    assert.equal(pass2.warmEval.rows[0].hit, true);
    assert.equal(pass2.warmEval.rows[1].hit, true);
    assert.equal(pass2.warmEval.rows[0].densityKgPerM3, pass1.afterEval.rows[0].densityKgPerM3,
      'Cross-reload OPFS KBr GPU density must be bit-exact identical to pre-reload');
    assert.equal(pass2.warmEval.rows[0].phaseCode, pass1.afterEval.rows[0].phaseCode);
    assert.equal(pass2.warmEval.rows[1].densityKgPerM3, pass1.afterEval.rows[1].densityKgPerM3,
      'Cross-reload OPFS GeO2 GPU density must be bit-exact identical to pre-reload');
    assert.equal(pass2.warmEval.rows[1].phaseCode, pass1.afterEval.rows[1].phaseCode);

    // Corrupt OPFS entry evicted fail-closed, rebuilt on GPU, and re-admitted with advanced ReservationLedger epoch!
    assert.equal(pass2.kbrRecovered.cacheStatus, 'miss-stored');
    assert.equal(pass2.kbrRecovered.reservationEpoch, pass2.kbrWarm.reservationEpoch + 1);
    assert.ok(pass2.kbrRecovered.bankGeneration > pass2.geo2Warm.bankGeneration);
    assert.ok(pass2.cacheStatsAfterCorrupt.evictions >= 1);
    assert.equal(pass2.recoveredEval.rows[0].hit, true);
    assert.equal(pass2.recoveredEval.rows[0].densityKgPerM3, pass1.afterEval.rows[0].densityKgPerM3);
  } finally {
    await browser.close();
  }
});
