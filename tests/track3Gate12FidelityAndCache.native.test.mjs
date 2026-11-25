import assert from 'node:assert/strict';
import test from 'node:test';

// Track 3 Native Vulkan Proof:
//   1. 4-Component Radial Dirac-KS on WebGPU (`solveAtomFullWebGpu` -> coupled G/F spinors,
//      non-perturbative j = l +- 1/2 splitting, 1s smallComponentNormSq scaling as (alpha*Z)^2,
//      0 per-SCF CPU readbacks, Au gold optical sRGB preserved).
//   2. Spin-Polarized DFT+U & Live 3D FFT Tran-Blaha mBJ (`periodicBulkDftWebGpu` -> Fe/Gd U_eff,
//      spin-split Bloch bands, Si live c_mBJ & band gap, Cu closed d^10 U_eff == 0).
//   3. Universal 5f Actinide Morse+EAM Stability (`Pu Z=94`, `Am Z=95`, `Bk Z=97` live GPU MD
//      with bounded virial pressure & positive finite MSD).
//   4. Extended Covalent AX2 `SiO2` (`cristobalite-C9`, Stillinger-Weber GPU MD) vs Molecular `CO2`.
//   5. Multi-Step GPU CI-NEB Reaction Network (`solveMultiStepReactionNetworkWebGpu` 2-step network).
//   6. Live Browser OPFS / IndexedDB Persistent Polytope Atlas Warm Cache in `elements-lab.html`
//      (cold miss-stored -> warm hit -> cross-reload hit -> corruption fail-closed eviction & rebuild).

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Track 3 native Vulkan proof: 4-comp Dirac-KS, DFT+U/mBJ, 5f MD, SiO2 C9, multi-step CI-NEB & OPFS/IDB warm cache', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Track 3 proof',
  timeout: 240_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });

  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Parts 1-5: Direct Vulkan WebGPU Physics & Chemistry Proofs
    const phys = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 6 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 300));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const { deriveElementBundleWebGpu } = await import('/src/runtime/material/periodicTableEngineWebGpu.js');
      const { deriveCompoundBundleWebGpu } = await import('/src/runtime/material/recursiveCompoundPipeline.js');
      const { solveMultiStepReactionNetworkWebGpu } = await import('/src/runtime/chemistry/reactionPathwayWebGpu.js');

      // 1 & 2: 4-Component Dirac-KS + DFT+U + mBJ across H, Si, Fe, Cu, Gd, Au, U
      const elems = {};
      for (const Z of [1, 14, 26, 29, 64, 79, 92]) {
        const r = await deriveElementBundleWebGpu(device, Z, {
          runNuclearGpuVolume: false,
          runLiveMd: false,
          atomicMaxScf: 45,
          blochGridN: 16
        });
        const orb1s = r.visualData.atom.orbitals.find((o) => o.n === 1 && o.l === 0);
        const orb5d = r.visualData.atom.orbitals.find((o) => o.n === 5 && o.l === 2);
        elems[Z] = {
          symbol: r.bundle.symbol,
          dirac4Component: r.visualData.atom.dirac4Component,
          relativisticMethod: r.visualData.atom.relativisticMethod,
          perScfCpuReadbacks: r.visualData.atom.perScfCpuReadbacks,
          small1s: orb1s?.smallComponentNormSq ?? 0,
          totalSmall: r.visualData.atom.totalSmallComponentNormSq,
          au5dSplitHa: orb5d?.spinOrbitSplittingHa ?? null,
          au5dEPlus: orb5d?.energyJPlusHa ?? null,
          au5dEMinus: orb5d?.energyJMinusHa ?? null,
          dftUHubbardEv: r.visualData.bulk.dftUHubbardEv,
          dftUExchangeSplittingEv: r.visualData.bulk.dftUExchangeSplittingEv,
          mbjCParameter: r.visualData.bulk.mbjCParameter,
          bandGapEv: r.bundle.electromagnetic.bandGapEv,
          magPhase: r.bundle.electromagnetic.magneticPhase,
          isMetal: r.bundle.electromagnetic.isMetal,
          opticalSrgb: r.bundle.electromagnetic.opticalSrgb,
          spinSplitDelta0: (r.visualData.bulk.spinSplitBandsEv.down[0][0] - r.visualData.bulk.spinSplitBandsEv.up[0][0])
        };
      }

      // 3: 5f Actinide live WebGPU MD stability (Pu Z=94, Am Z=95, Bk Z=97)
      const actinides = {};
      for (const Z of [94, 95, 97]) {
        const r = await deriveElementBundleWebGpu(device, Z, {
          runNuclearGpuVolume: false,
          runLiveMd: true,
          mdSteps: 16,
          mdCellsPerSide: 3,
          atomicMaxScf: 40,
          blochGridN: 16
        });
        actinides[Z] = {
          symbol: r.bundle.symbol,
          crystal: r.bundle.mechanical.crystalStructure,
          alpha: r.visualData.thermo.potential.alphaOrLambda,
          fShellSoftness: r.visualData.thermo.potential.fShellSoftness,
          mdTempK: r.bundle.thermodynamic.mdTempK,
          mdPressureGPa: r.bundle.thermodynamic.mdPressureGPa,
          mdMsdA2: r.bundle.thermodynamic.mdMsdA2,
          mdEnergyEv: r.bundle.thermodynamic.mdEnergyEv
        };
      }

      // 4: Extended covalent SiO2 cristobalite-C9 vs molecular CO2 live WebGPU derivation + MD
      const sio2 = await deriveCompoundBundleWebGpu(device, 'SiO2', { runLiveMd: true, mdSteps: 12, mdCellsPerSide: 2 });
      const co2 = await deriveCompoundBundleWebGpu(device, 'CO2', { runLiveMd: true, mdSteps: 8, mdCellsPerSide: 2 });

      // 5: 2-step GPU CI-NEB reaction network on H2O bent -> linear-stretched -> inverted bent
      const s0 = [
        { Z: 8, position: [0, 0, 0] },
        { Z: 1, position: [1.4304, 1.1072, 0] },
        { Z: 1, position: [-1.4304, 1.1072, 0] }
      ];
      const s1 = [
        { Z: 8, position: [0, 0, 0] },
        { Z: 1, position: [1.85, 0.15, 0] },
        { Z: 1, position: [-1.85, 0.15, 0] }
      ];
      const s2 = [
        { Z: 8, position: [0, 0, 0] },
        { Z: 1, position: [1.4304, -1.1072, 0] },
        { Z: 1, position: [-1.4304, -1.1072, 0] }
      ];
      const net = await solveMultiStepReactionNetworkWebGpu(device, {
        intermediates: [
          { label: 'H2O(up)', atoms: s0 },
          { label: 'H2O(stretch)', atoms: s1 },
          { label: 'H2O(down)', atoms: s2 }
        ],
        nImagesPerStep: 5,
        maxNebSteps: 2,
        temperatureK: 350
      });

      device.destroy();
      return {
        status: 'ok',
        gpuErrors,
        elems,
        actinides,
        sio2: {
          crystal: sio2.bundle.mechanical.crystalStructure,
          spaceGroup: sio2.bundle.mechanical.spaceGroup,
          meltingK: sio2.bundle.thermodynamic.meltingPointK,
          bandGapEv: sio2.bundle.electromagnetic.bandGapEv,
          mdModel: sio2.visualData.mdConfig.modelName,
          mdTempK: sio2.bundle.thermodynamic.mdTempK,
          mdPressureGPa: sio2.bundle.thermodynamic.mdPressureGPa,
          crystalAtoms: sio2.visualData.multiSpeciesCrystal.atomCount,
          crystalBonds: sio2.visualData.multiSpeciesCrystal.bondCount
        },
        co2: {
          crystal: co2.bundle.mechanical.crystalStructure,
          meltingK: co2.bundle.thermodynamic.meltingPointK,
          mdTempK: co2.bundle.thermodynamic.mdTempK
        },
        network: {
          schema: net.schema,
          backend: net.backend,
          stepCount: net.stepCount,
          totalGpuRhfCalls: net.totalGpuRhfCalls,
          stitchedCount: net.stitchedImages.length,
          xiEnd: net.stitchedImages[net.stitchedImages.length - 1].xi,
          energeticSpanEv: net.energeticSpanEv,
          tdiStateIndex: net.tdiStateIndex,
          tdtsStepIndex: net.tdtsStepIndex,
          eyringNetRateSInv: net.eyringNetRateSInv
        }
      };
    });

    assert.deepEqual(pageErrors, []);
    assert.equal(phys.status, 'ok');
    assert.deepEqual(phys.gpuErrors, []);

    console.log('[track3-dirac-dftu-mbj]', JSON.stringify(phys.elems));
    console.log('[track3-actinide-md]', JSON.stringify(phys.actinides));
    console.log('[track3-sio2-co2]', JSON.stringify({ sio2: phys.sio2, co2: phys.co2 }));
    console.log('[track3-multistep-neb]', JSON.stringify(phys.network));

    // Assert 1: 4-Component Dirac-KS
    for (const Z of [1, 14, 26, 29, 64, 79, 92]) {
      assert.equal(phys.elems[Z].dirac4Component, true, `Z=${Z} dirac4Component`);
      assert.equal(phys.elems[Z].relativisticMethod, 'dirac-4comp-gpu+qed');
      assert.equal(phys.elems[Z].perScfCpuReadbacks, 0);
    }
    assert.ok(phys.elems[1].small1s > 0 && phys.elems[1].small1s < phys.elems[26].small1s, '1s small component grows H -> Fe');
    assert.ok(phys.elems[26].small1s < phys.elems[79].small1s, '1s small component grows Fe -> Au');
    assert.ok(phys.elems[79].small1s < phys.elems[92].small1s, '1s small component grows Au -> U');
    assert.ok(phys.elems[79].small1s > 0.02, `Au 1s small component norm^2=${phys.elems[79].small1s}`);
    assert.ok(phys.elems[79].au5dSplitHa > 0.015, `Au 5d Dirac spin-orbit splitting=${phys.elems[79].au5dSplitHa} Ha`);
    assert.ok(phys.elems[79].au5dEPlus > phys.elems[79].au5dEMinus, 'Au 5d_5/2 must lie above 5d_3/2');
    assert.ok(phys.elems[79].opticalSrgb[0] > phys.elems[79].opticalSrgb[2], `Au stays Gold under 4-comp Dirac-KS: ${phys.elems[79].opticalSrgb}`);

    // Assert 2: Spin-Polarized DFT+U & Live 3D FFT Tran-Blaha mBJ
    assert.ok(phys.elems[26].dftUHubbardEv > 1.5, `Fe DFT+U=${phys.elems[26].dftUHubbardEv}`);
    assert.ok(phys.elems[26].spinSplitDelta0 > 0.1, `Fe spin-split bands=${phys.elems[26].spinSplitDelta0}`);
    assert.equal(phys.elems[26].magPhase, 'ferromagnetic');
    assert.ok(phys.elems[64].dftUHubbardEv > 3.0, `Gd DFT+U=${phys.elems[64].dftUHubbardEv}`);
    assert.equal(phys.elems[64].magPhase, 'ferromagnetic');
    assert.equal(phys.elems[14].dftUHubbardEv, 0, 'Si sp semiconductor has U_eff == 0');
    assert.ok(phys.elems[14].mbjCParameter >= 1.05 && phys.elems[14].mbjCParameter <= 1.95, `Si c_mBJ=${phys.elems[14].mbjCParameter}`);
    assert.ok(phys.elems[14].bandGapEv > 0.4, `Si mBJ bandGap=${phys.elems[14].bandGapEv}`);
    assert.equal(phys.elems[29].dftUHubbardEv, 0, 'Closed 3d^10 Cu has U_eff == 0');

    // Assert 3: Universal 5f Actinide MD stability (Pu, Am, Bk)
    for (const Z of [94, 95, 97]) {
      const a = phys.actinides[Z];
      assert.equal(a.fShellSoftness, 0.78, `Z=${Z} fShellSoftness`);
      assert.ok(a.alpha >= 0.85 && a.alpha <= 2.25, `Z=${Z} alpha=${a.alpha}`);
      assert.ok(Number.isFinite(a.mdTempK) && a.mdTempK > 10, `Z=${Z} mdTempK=${a.mdTempK}`);
      assert.ok(Number.isFinite(a.mdMsdA2) && a.mdMsdA2 > 0, `Z=${Z} mdMsdA2=${a.mdMsdA2}`);
      assert.ok(Number.isFinite(a.mdPressureGPa) && Math.abs(a.mdPressureGPa) < 35, `Z=${Z} bounded virial pressure=${a.mdPressureGPa} GPa`);
    }

    // Assert 4: SiO2 cristobalite-C9 vs CO2 molecular-fcc
    assert.equal(phys.sio2.crystal, 'cristobalite-C9');
    assert.equal(phys.sio2.spaceGroup, 'Fd-3m (227)');
    assert.ok(phys.sio2.meltingK > 1400, `SiO2 Tm=${phys.sio2.meltingK}`);
    assert.ok(phys.sio2.bandGapEv > 5.0, `SiO2 gap=${phys.sio2.bandGapEv}`);
    assert.ok(Number.isFinite(phys.sio2.mdTempK) && phys.sio2.mdTempK > 10);
    assert.ok(phys.sio2.crystalAtoms === 192 && phys.sio2.crystalBonds > 100);
    assert.equal(phys.co2.crystal, 'molecular-fcc');
    assert.ok(phys.co2.meltingK < 400);

    // Assert 5: Multi-Step GPU CI-NEB Reaction Network
    assert.equal(phys.network.backend, 'webgpu');
    assert.equal(phys.network.stepCount, 2);
    assert.ok(phys.network.totalGpuRhfCalls >= 10);
    assert.equal(phys.network.stitchedCount, 9);
    assert.ok(Math.abs(phys.network.xiEnd - 2) < 1e-6);
    assert.ok(Number.isFinite(phys.network.energeticSpanEv) && phys.network.energeticSpanEv > 0.1);
    assert.ok(Number.isFinite(phys.network.eyringNetRateSInv) && phys.network.eyringNetRateSInv >= 0);

    // Part 6: Live Browser OPFS / IndexedDB Persistent Warm Cache in elements-lab.html
    await page.goto(`${BASE_URL}/elements-lab.html?z=26&tab=polytope`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 26 && window.__ulgElementsLabState?.atlasPolytopeCount >= 4, null, { timeout: 60_000 });

    const cachePass1 = await page.evaluate(async () => {
      await window.__ulgElementsLabApi.clearPolytopeCache();
      const first = await window.__ulgElementsLabApi.rebuildPolytopeAtlas('planetary');
      const second = await window.__ulgElementsLabApi.rebuildPolytopeAtlas('planetary');
      return { first, second, stats: window.__ulgElementsLabApi.getPolytopeCacheStats() };
    });
    console.log('[track3-cache-pass1]', JSON.stringify(cachePass1));
    assert.equal(cachePass1.first.cacheStatus, 'miss-stored');
    assert.ok(['opfs', 'indexeddb'].includes(cachePass1.first.cacheBackend), `Browser must persist to OPFS or IndexedDB, got ${cachePass1.first.cacheBackend}`);
    assert.equal(cachePass1.first.pressureRangePa[1], 1e12, 'Planetary regime must honor pressureRangePa [1e2, 1e12]');
    assert.equal(cachePass1.second.cacheStatus, 'hit', 'Immediate second request must hit persistent warm cache');
    assert.equal(cachePass1.second.polytopeCount, cachePass1.first.polytopeCount);

    // Reload browser page and verify cross-reload persistence + fail-closed corruption recovery!
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 26 && window.__ulgElementsLabState?.atlasPolytopeCount >= 4, null, { timeout: 60_000 });

    const cachePass2 = await page.evaluate(async (expectedKey) => {
      const afterReload = await window.__ulgElementsLabApi.rebuildPolytopeAtlas('planetary');
      // Corrupt the persisted cache entry and verify fail-closed eviction + automatic GPU re-fit!
      await window.__ulgElementsLabApi.corruptPolytopeCacheEntryForTest(expectedKey, '{corrupt_opfs_payload');
      const afterCorrupt = await window.__ulgElementsLabApi.rebuildPolytopeAtlas('planetary');
      return { afterReload, afterCorrupt, stats: window.__ulgElementsLabApi.getPolytopeCacheStats() };
    }, cachePass1.first.cacheKey);
    console.log('[track3-cache-pass2]', JSON.stringify(cachePass2));
    assert.equal(cachePass2.afterReload.cacheStatus, 'hit', 'Persisted OPFS/IDB atlas must survive full browser reload');
    assert.equal(cachePass2.afterCorrupt.cacheStatus, 'miss-stored', 'Corrupt cache entry must be evicted and freshly rebuilt on GPU');
    assert.ok(cachePass2.stats.staleRejections >= 1, 'Corruption must increment staleRejections');
    assert.equal(cachePass2.stats.lastRejectionReason, 'corrupt-json');

    await ctx.close();
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
});
