import assert from 'node:assert/strict';
import test from 'node:test';

// Gate 2 Native Vulkan WebGPU Proof:
//   1. GPU Molecular RHF (`solveMoleculeRhfWebGpu`): generalized Fock solve
//      F C = S C ε strictly on WebGPU via `gpuMath` + 3D volumetric orbital/density
//      sampling for H2O, H2, and HF.
//   2. Recursive Compound Feedback Loop (`deriveCompoundBundleWebGpu`): feeds
//      chemical reaction products (H2O, NaOH, CsF, NaCl, FeO, CO2, NH3) back
//      through the Gate 1-2 first-principles pipeline (nuclear + molecular QM /
//      ionic crystal screening + GPU optics + WebGPU MD) -> validated
//      `ulg.material-property-bundle.v1` with zero `reference-fallback` cheats.
//   3. Convex Polytope Atlas Compiler (`buildMaterialPolytopeAtlasWebGpu`):
//      compiles elements (Fe, Ar) AND reaction-derived compounds (H2O, NaCl)
//      into GPU-fitted slanted Clausius-Clapeyron convex polytope atlases
//      (`ulg.polytope-atlas-gpu-buffer.v1`) with fail-closed out-of-domain misses.

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1'
  || process.env.ULG_RUN_NATIVE_GATE2 === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Gate 2 native Vulkan proof: GPU molecular RHF, recursive compound feedback loop, and Convex Polytope Atlas', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Gate 2 proof',
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
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 6 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 300));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const { solveMoleculeRhfWebGpu } = await import('/src/runtime/electronicStructure/molecularHartreeFockWebGpu.js');
      const { deriveCompoundBundleWebGpu } = await import('/src/runtime/material/recursiveCompoundPipeline.js');
      const { deriveElementBundleWebGpu } = await import('/src/runtime/material/periodicTableEngineWebGpu.js');
      const { buildMaterialPolytopeAtlasWebGpu } = await import('/src/runtime/material/polytopeAtlasBuilder.js');
      const { validateMaterialPropertyBundle } = await import('/ulg-gpu-abi/src/materialFoundationAbi.js');

      // 1. Direct GPU Molecular RHF on H2O (STO-3G exact ~ -74.96 Ha!)
      const h2oRhf = await solveMoleculeRhfWebGpu(device, [
        { Z: 8, x: 0, y: 0, z: 0 },
        { Z: 1, x: 1.4304, y: 1.1072, z: 0 },
        { Z: 1, x: -1.4304, y: 1.1072, z: 0 }
      ], { maxScf: 30, volDim: 16 });

      // 2. Recursive Compound Feedback Loop across molecular & ionic reaction products
      const formulas = ['H2O', 'NaOH', 'CsF', 'NaCl', 'FeO', 'CO2', 'NH3'];
      const compounds = [];
      for (const f of formulas) {
        const res = await deriveCompoundBundleWebGpu(device, f, {
          runLiveMd: f === 'H2O' || f === 'NaCl',
          mdSteps: 10,
          reactionContext: { discoveredBy: 'gate2-feedback-test' }
        });
        const check = validateMaterialPropertyBundle(res.bundle);
        compounds.push({
          formula: f,
          valid: check.ok,
          errors: check.errors,
          totalZ: res.bundle.nuclear.totalProtonsZ,
          totalA: res.bundle.nuclear.totalNucleonsA,
          rhfSolved: res.bundle.atomic.molecularRhfSolvedOnGpu,
          dipoleDebye: res.bundle.atomic.dipoleDebye,
          crystal: res.bundle.mechanical.crystalStructure,
          rhoKgM3: res.bundle.mechanical.densityKgPerM3,
          bandGapEv: res.bundle.electromagnetic.bandGapEv,
          meltingK: res.bundle.thermodynamic.meltingPointK,
          boilingK: res.bundle.thermodynamic.boilingPointK,
          mdTempK: res.bundle.thermodynamic.mdTempK,
          status: res.bundle.provenance.status
        });
      }

      // 3. Convex Polytope Atlas compilation for BOTH an Element (Fe) AND a Reaction Compound (H2O, NaCl)
      const fe = await deriveElementBundleWebGpu(device, 26, { runNuclearGpuVolume: false, runLiveMd: false, atomicMaxScf: 40 });
      const h2o = await deriveCompoundBundleWebGpu(device, 'H2O', { runLiveMd: false });
      const nacl = await deriveCompoundBundleWebGpu(device, 'NaCl', { runLiveMd: false });
      const atlases = [];
      for (const b of [fe.bundle, h2o.bundle, nacl.bundle]) {
        const atlas = await buildMaterialPolytopeAtlasWebGpu(device, b, { degrees: [4, 3], relativeTolerance: 0.05, maxBisectDepth: 1 });
        const solidHit = atlas.registry.resolveState(b.materialKey, { temperatureK: Math.max(5, b.thermodynamic.meltingPointK * 0.5), pressurePa: 101325 });
        const missHit = atlas.registry.resolveState(b.materialKey, { temperatureK: 500, pressurePa: 1e16 });
        atlases.push({
          materialKey: b.materialKey,
          family: b.family,
          polytopeCount: atlas.polytopeCount,
          packedFloats: atlas.packedGpuAtlas.data.length,
          solidFound: solidHit.found,
          solidPhase: solidHit.polytope?.phase,
          solidFitValid: solidHit.fit?.valid,
          outsideFailClosed: !missHit.found && missHit.status === 'outside-domain'
        });
      }

      device.destroy();
      return {
        status: 'ok',
        gpuErrors,
        h2oRhf: {
          totalEnergyHa: h2oRhf.totalEnergyHa,
          homoLumoGapEv: h2oRhf.homoLumoGapEv,
          dipoleDebye: h2oRhf.dipoleDebye,
          volumePeak: Math.max(...h2oRhf.volumeData)
        },
        compounds,
        atlases
      };
    });
    await ctx.close();

    assert.deepEqual(pageErrors, []);
    assert.equal(out.status, 'ok');
    assert.deepEqual(out.gpuErrors, []);

    // H2O STO-3G RHF reference is -74.96 Ha!
    assert.ok(out.h2oRhf.totalEnergyHa < -74.0 && out.h2oRhf.totalEnergyHa > -76.0, `H2O RHF E=${out.h2oRhf.totalEnergyHa}`);
    assert.ok(out.h2oRhf.homoLumoGapEv > 8.0, `H2O gap=${out.h2oRhf.homoLumoGapEv}`);
    assert.ok(out.h2oRhf.dipoleDebye > 0.8, `H2O dipole=${out.h2oRhf.dipoleDebye}`);
    assert.ok(out.h2oRhf.volumePeak > 0.1, '3D molecular density volume populated on GPU');

    for (const c of out.compounds) {
      assert.equal(c.valid, true, `Compound ${c.formula} bundle invalid: ${c.errors}`);
      assert.ok(c.rhoKgM3 > 50, `${c.formula} rho=${c.rhoKgM3}`);
      assert.ok(c.meltingK > 10 && c.boilingK > c.meltingK, `${c.formula} Tm/Tb`);
      assert.equal(c.status, 'webgpu-derived');
    }
    const byF = Object.fromEntries(out.compounds.map((c) => [c.formula, c]));
    assert.equal(byF.H2O.totalZ, 10);
    assert.equal(byF.NaCl.crystal.startsWith('rocksalt') || byF.NaCl.crystal.startsWith('cscl'), true);
    assert.ok(byF.NaCl.meltingK > byF.H2O.meltingK, 'Ionic NaCl melts far above molecular H2O');
    assert.ok(byF.H2O.mdTempK > 5 && byF.NaCl.mdTempK > 5, 'Live compound WebGPU MD ran');

    for (const a of out.atlases) {
      assert.ok(a.polytopeCount >= 4, `${a.materialKey} polytopes=${a.polytopeCount}`);
      assert.equal(a.solidFound, true);
      assert.equal(a.solidPhase, 'solid');
      assert.equal(a.solidFitValid, true, `${a.materialKey} solid Chebyshev fit valid`);
      assert.equal(a.outsideFailClosed, true, `${a.materialKey} fail-closed outside polytope`);
    }
  } finally {
    await browser.close();
  }
});
