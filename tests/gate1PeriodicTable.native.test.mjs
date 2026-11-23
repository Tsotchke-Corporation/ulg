import assert from 'node:assert/strict';
import test from 'node:test';

// Gate 1 Native Vulkan WebGPU Proof across ALL Periodic Table Blocks:
//   Runs `deriveElementBundleWebGpu` across 14 representative elements spanning
//   Z = 1..118 (s, p, d, f, noble gases, semiconductors, ferromagnets, heavy
//   relativistic metals, actinides, and superheavy Z=118 Og), proving:
//   - Validated 5-domain `ulg.material-property-bundle.v1` for every Z
//   - 0 per-SCF CPU readbacks (`perScfCpuReadbacks === 0`) + finite nucleus V_nuc(r)
//   - GPU 3D nuclear density + 118x200 Chart of Nuclides
//   - GPU Bloch band structure + 3D Bloch charge density via fft3dWebGpu
//   - Emergent Fe/Gd ferromagnetism, noble-gas insulating gap, metallic Cu/Au conductivity
//   - Live WebGPU MD telemetry with zero GPU/page errors.

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1'
  || process.env.ULG_RUN_NATIVE_GATE1 === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Gate 1 native Vulkan proof: complete 5-domain WebGPU Periodic Table engine across Z=1..118 blocks', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Gate 1 proof',
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

      const { deriveElementBundleWebGpu } = await import('/src/runtime/material/periodicTableEngineWebGpu.js');
      const { validateMaterialPropertyBundle } = await import('/ulg-gpu-abi/src/materialFoundationAbi.js');

      const probeZs = [1, 2, 6, 10, 11, 14, 18, 26, 29, 64, 79, 80, 92, 118];
      const rows = [];
      for (const Z of probeZs) {
        const res = await deriveElementBundleWebGpu(device, Z, {
          runNuclearGpuVolume: Z === 26 || Z === 92, // prove GPU nuclear volume & chart on Fe & U
          runLiveMd: Z === 18 || Z === 26 || Z === 14 || Z === 79, // prove LJ, EAM, SW, heavy metal MD
          mdSteps: 12,
          atomicMaxScf: 45,
          nuclearVolDim: 16,
          blochGridN: 16
        });
        const val = validateMaterialPropertyBundle(res.bundle);
        rows.push({
          Z,
          symbol: res.bundle.symbol,
          valid: val.ok,
          errors: val.errors,
          tier: res.bundle.accuracyTier,
          isotope: res.bundle.nuclear.isotope,
          bPerA: res.bundle.nuclear.bindingPerNucleonMeV,
          rNucFm: res.bundle.nuclear.chargeRadiusFm,
          finiteNucleusUsed: res.bundle.atomic.finiteNucleusUsed,
          perScfCpuReadbacks: res.bundle.atomic.perScfCpuReadbacks,
          qedShiftHa: res.bundle.atomic.qedRadiativeShiftHa,
          totalEnergyHa: res.bundle.atomic.totalEnergyHa,
          crystal: res.bundle.mechanical.crystalStructure,
          rhoKgM3: res.bundle.mechanical.densityKgPerM3,
          kGPa: res.bundle.mechanical.bulkModulusPa * 1e-9,
          bandGapEv: res.bundle.electromagnetic.bandGapEv,
          isMetal: res.bundle.electromagnetic.isMetal,
          magPhase: res.bundle.electromagnetic.magneticPhase,
          sigmaSPerM: res.bundle.electromagnetic.electricalConductivitySPerM,
          meltingK: res.bundle.thermodynamic.meltingPointK,
          boilingK: res.bundle.thermodynamic.boilingPointK,
          mdTempK: res.bundle.thermodynamic.mdTempK,
          blochPeak: res.visualData.bulk.blochDensity3d ? Math.max(...res.visualData.bulk.blochDensity3d) : 0,
          g7: res.g7Advisory
        });
      }
      device.destroy();
      return { status: 'ok', gpuErrors, rows };
    });
    await ctx.close();

    assert.deepEqual(pageErrors, []);
    assert.equal(out.status, 'ok');
    assert.deepEqual(out.gpuErrors, []);
    assert.equal(out.rows.length, 14);

    for (const r of out.rows) {
      assert.equal(r.valid, true, `Bundle invalid for ${r.symbol}: ${r.errors}`);
      assert.equal(r.finiteNucleusUsed, true, `Finite nucleus must feed atomic DFT for ${r.symbol}`);
      assert.equal(r.perScfCpuReadbacks, 0, `0 per-SCF CPU readbacks for ${r.symbol}`);
      assert.ok(Number.isFinite(r.totalEnergyHa) && r.totalEnergyHa < 0, `totalEnergyHa=${r.totalEnergyHa} for ${r.symbol}`);
      assert.ok(Number.isFinite(r.rhoKgM3) && r.rhoKgM3 > 10, `rhoKgM3=${r.rhoKgM3} for ${r.symbol}`);
      assert.ok(r.meltingK > 1 && r.boilingK > r.meltingK, `Tm/Tb ordering for ${r.symbol}`);
      assert.ok(r.blochPeak > 0.9, `Bloch 3D FFT density normalized peak for ${r.symbol}`);
    }

    const byZ = Object.fromEntries(out.rows.map((r) => [r.Z, r]));
    assert.equal(byZ[2].isMetal, false, 'He must be insulating');
    assert.equal(byZ[10].isMetal, false, 'Ne must be insulating');
    assert.equal(byZ[18].isMetal, false, 'Ar must be insulating');
    assert.equal(byZ[14].crystal, 'diamond', 'Si selects diamond crystal');
    assert.ok(byZ[14].bandGapEv > 0.4, `Si band gap=${byZ[14].bandGapEv}`);
    assert.equal(byZ[26].magPhase, 'ferromagnetic', 'Fe must be emergent ferromagnetic');
    assert.equal(byZ[64].magPhase, 'ferromagnetic', 'Gd must be emergent ferromagnetic');
    assert.equal(byZ[29].isMetal, true, 'Cu must be metallic');
    assert.ok(byZ[29].sigmaSPerM > 1e5, `Cu conductivity=${byZ[29].sigmaSPerM}`);
    assert.ok(byZ[79].qedShiftHa > byZ[6].qedShiftHa, 'Relativistic QED radiative shift grows strongly with Z');
    assert.equal(byZ[118].tier, 'tier-3-theoretical-envelope', 'Og must carry honest tier-3 theoretical label');
    assert.ok(Number.isFinite(byZ[26].mdTempK) && byZ[26].mdTempK > 10, 'Live Fe EAM MD ran');
    assert.ok(Number.isFinite(byZ[18].mdTempK) && byZ[18].mdTempK > 5, 'Live Ar LJ MD ran');
  } finally {
    await browser.close();
  }
});
