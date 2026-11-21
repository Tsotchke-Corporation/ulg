import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SCALE_ATLAS === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test(
  '40-OOM dynamic chart migration and cross-chart multipole gravity + radiation coupling preserve exact momentum and energy balance on real Vulkan WebGPU',
  { skip: !RUN_NATIVE, timeout: 180000 },
  async () => {
    const { chromium } = await import('@playwright/test');
    const wayland = Boolean(process.env.WAYLAND_DISPLAY);
    const browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: !wayland,
      args: [
        '--ignore-certificate-errors',
        '--use-angle=vulkan',
        '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        ...(wayland ? ['--ozone-platform=wayland'] : [])
      ]
    });
    let result;
    try {
      const page = await browser.newPage({ ignoreHTTPSErrors: true });
      const base = 'https://127.0.0.1:5173/';
      await page.route((u) => u.href === base, (route) => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>40-OOM Scale Atlas Multipole GPU</title>'
      }));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      result = await page.evaluate(async () => {
        const rtMod = await import('/src/runtime/sph/schroederSpatialScaleAtlasRuntime.js');
        const mpMod = await import('/src/runtime/sph/schroederScaleAtlasMultipoleGpu.js');

        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice({
          requiredLimits: { maxStorageBuffersPerShaderStage: 16 }
        });
        const errors = [];
        device.addEventListener('uncapturederror', (e) => errors.push(e.error.message));
        device.pushErrorScope('validation');

        // Build a 40+ OOM sparse dynamic atlas: L = -50 (sub-atomic), L = 0 (meter), L = +86 (galactic) -> 136 dyadic levels = 40.94 OOM!
        const runtime = rtMod.createDynamicSchroederScaleAtlasRuntime({
          referenceSpacingM: 1.0,
          rootGlobalBaseLevel: 0,
          rootLocalMinLevel: 0,
          rootLocalMaxLevel: 2
        });
        const fine = runtime.ensureChartForScaleLevel({
          targetGlobalLevel: -50,
          originInParentUnits: [1.5, -0.75, 0.25],
          parentChartId: 0,
          localSpanLevels: 3
        });
        const midHot = runtime.ensureChartForScaleLevel({
          targetGlobalLevel: 4,
          originInParentUnits: [50.0, 10.0, -5.0],
          parentChartId: 0,
          localSpanLevels: 3
        });
        const midCold = runtime.ensureChartForScaleLevel({
          targetGlobalLevel: 4,
          originInParentUnits: [-40.0, -15.0, 20.0],
          parentChartId: 0,
          localSpanLevels: 3
        });
        const cosmic = runtime.ensureChartForScaleLevel({
          targetGlobalLevel: 86,
          originInParentUnits: [2.0, 3.0, -1.0],
          parentChartId: 0,
          localSpanLevels: 3
        });
        const atlas = runtime.snapshotAtlas();
        const oom = runtime.summary().ordersOfMagnitude;

        // 1. GPU migration forward (fine -> midHot) & roundtrip back (midHot -> fine)
        const srcParticles = [
          {
            chartId: fine.chartId,
            targetChartId: midHot.chartId,
            massKg: 2.5,
            energyJ: 120.0,
            posLocalHi: [0.5, -0.25, 0.75],
            posLocalLo: [0, 0, 0],
            linearMomentumKgMPerS: [1.0, -0.5, 0.25],
            angularMomentumKgM2PerS: [0.1, 0.2, -0.3]
          },
          {
            chartId: midHot.chartId,
            targetChartId: cosmic.chartId,
            massKg: 10.0,
            energyJ: 500.0,
            posLocalHi: [1.0, 2.0, -1.0],
            posLocalLo: [0, 0, 0],
            linearMomentumKgMPerS: [0.2, 0.4, -0.1],
            angularMomentumKgM2PerS: [1.0, -2.0, 0.5]
          }
        ];
        const migFwd = await rtMod.runSchroederScaleAtlasMigrationWebGpu(device, {
          atlas,
          particles: srcParticles
        });
        const migBack = await rtMod.runSchroederScaleAtlasMigrationWebGpu(device, {
          atlas,
          particles: migFwd.particles.map((p, idx) => ({
            ...p,
            targetChartId: srcParticles[idx].chartId
          }))
        });

        // 2. GPU cross-chart Barnes-Hut / FMM multipole gravity (monopole + quadrupole) & radiative exchange
        const mpParticles = [
          // Asymmetric hot dipole in midHot (nonzero quadrupole, 1800 K)
          { chartId: midHot.chartId, massKg: 5e12, temperatureK: 1800, posLocal: [-0.4, 0.1, 0.0], effectiveAreaM2: 4.0 },
          { chartId: midHot.chartId, massKg: 7e12, temperatureK: 1650, posLocal: [0.5, -0.2, 0.1], effectiveAreaM2: 4.0 },
          // Asymmetric cold cluster in midCold (260 K)
          { chartId: midCold.chartId, massKg: 8e12, temperatureK: 260, posLocal: [-0.3, 0.2, -0.1], effectiveAreaM2: 6.0 },
          { chartId: midCold.chartId, massKg: 4e12, temperatureK: 250, posLocal: [0.4, -0.1, 0.2], effectiveAreaM2: 6.0 },
          // Root-chart mass at origin (300 K)
          { chartId: 0, massKg: 3e12, temperatureK: 300, posLocal: [0.1, 0.2, -0.1], effectiveAreaM2: 2.0 },
          // Sub-atomic chart (L=-50) and cosmic chart (L=+86) verifying finite 40+ OOM coupling!
          { chartId: fine.chartId, massKg: 1e6, temperatureK: 500, posLocal: [0.2, 0.0, 0.0], effectiveAreaM2: 1e-6 },
          { chartId: cosmic.chartId, massKg: 1e14, temperatureK: 2.7, posLocal: [0.0, 0.0, 0.0], effectiveAreaM2: 10.0 }
        ];
        const mp = await mpMod.runSchroederScaleAtlasMultipoleWebGpu(device, {
          atlas,
          particles: mpParticles,
          thetaMax: 0.5
        });

        const val = await device.popErrorScope();
        device.destroy();
        return {
          oom,
          migFwdReceipt: migFwd.receipt,
          migBackReceipt: migBack.receipt,
          angMomRoundtrip0: migBack.particles[0].angularMomentumKgM2PerS,
          expectedAngMom0: srcParticles[0].angularMomentumKgMPerS ?? srcParticles[0].angularMomentumKgM2PerS,
          mpReceipt: mp.receipt,
          mpOutputs: mp.chartOutputs,
          hotIdx: atlas.charts.findIndex((c) => c.chartId === midHot.chartId),
          coldIdx: atlas.charts.findIndex((c) => c.chartId === midCold.chartId),
          validation: val?.message ?? null,
          errors
        };
      });
    } finally {
      await browser.close();
    }

    console.log('40-OOM Scale Atlas Multipole GPU:', JSON.stringify({
      oom: result.oom,
      migFwdReceipt: result.migFwdReceipt,
      migBackReceipt: result.migBackReceipt,
      mpReceipt: result.mpReceipt
    }));
    assert.equal(result.validation, null);
    assert.deepEqual(result.errors, []);
    assert.ok(result.oom > 40, `expected > 40 OOM, got ${result.oom}`);
    assert.equal(result.migFwdReceipt.verified, true);
    assert.equal(result.migBackReceipt.verified, true);
    assert.equal(result.mpReceipt.verified, true);
    assert.ok(result.mpReceipt.momentumRelError < 1e-5, `Newton 3rd law momentumRelError=${result.mpReceipt.momentumRelError}`);
    assert.ok(result.mpReceipt.radiativeRelError < 1e-5, `Kirchhoff radiativeRelError=${result.mpReceipt.radiativeRelError}`);
    // Hot chart must emit net radiative power (< 0) and cold chart must absorb net radiative power (> 0)!
    assert.ok(result.mpOutputs[result.hotIdx].netRadiativePowerW < 0, 'hot chart must lose net radiative power');
    assert.ok(result.mpOutputs[result.coldIdx].netRadiativePowerW > 0, 'cold chart must absorb net radiative power');
    assert.ok(result.mpReceipt.farFieldPairDirectedCount > 0, 'expected far-field multipole pairs');
  }
);
