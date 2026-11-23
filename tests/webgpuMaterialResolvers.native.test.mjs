import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_MATERIAL_RESOLVERS === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test('Phase 6 WebGPU-derived Drude-Lorentz/CIE optics, Cherenkov, and radial Kohn-Sham PBE+SO match CPU on real Vulkan GPU', {
  skip: !RUN_NATIVE && 'set ULG_RUN_NATIVE_MATERIAL_RESOLVERS=1 or ULG_RUN_NATIVE_WEBGPU=1',
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
    const url = 'https://127.0.0.1:5173/__phase6_webgpu_material_resolvers__';
    await page.route(url, (route) => route.fulfill({
      contentType: 'text/html',
      body: '<title>Phase 6 WebGPU Material Resolvers Proof</title>'
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
        OPTICAL_RESOLVER_MODE_CHERENKOV,
        OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ,
        resolveOpticalBatchWebGpu
      } = await import('/src/runtime/material/opticalResolverWebGpu.js');
      const {
        metalRelativisticColorSrgb,
        relativisticInterbandOscillators
      } = await import('/src/runtime/material/opticalClosure.js');
      const { evaluateCherenkovClosure } = await import('/src/runtime/material/nuclearCherenkovClosure.js');
      const { solveAtomWebGpu } = await import('/src/runtime/electronicStructure/radialKohnShamWebGpu.js');
      const { solveAtom } = await import('/src/runtime/electronicStructure/radialKohnSham.js');
      const { createMaterialResolverPipeline } = await import('/src/runtime/material/materialResolverPipeline.js');

      // 1. Batched Drude-Lorentz + spin-orbit interband GPU vs CPU parity for Cu, Ag, Au, Hg
      const metals = [
        { symbol: 'Cu', Z: 29, ne: 8.49e28 },
        { symbol: 'Ag', Z: 47, ne: 5.86e28 },
        { symbol: 'Au', Z: 79, ne: 5.90e28 },
        { symbol: 'Hg', Z: 80, ne: 8.13e28 }
      ];
      const fastOpt = { gridPointsN: 420, rMaxBohr: 36, maxScf: 160 };
      const cpuColors = metals.map((m) => {
        const osc = relativisticInterbandOscillators({
          atomicNumberZ: m.Z,
          conductionElectronDensityPerM3: m.ne,
          options: fastOpt
        });
        return {
          ...m,
          osc,
          cpu: metalRelativisticColorSrgb({
            atomicNumberZ: m.Z,
            conductionElectronDensityPerM3: m.ne,
            interbandOscillators: osc
          })
        };
      });

      const batch = await resolveOpticalBatchWebGpu(device, [
        ...cpuColors.map((m) => ({
          mode: OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ,
          conductionElectronDensityPerM3: m.ne,
          interbandOscillators: m.osc,
          pathLengthM: 0.3
        })),
        { mode: OPTICAL_RESOLVER_MODE_CHERENKOV, beta: 0.62, refractiveIndex: 1.333, chargeZ: 1 },
        { mode: OPTICAL_RESOLVER_MODE_CHERENKOV, beta: 0.94, refractiveIndex: 1.333, chargeZ: 1 }
      ], { keepResident: true });

      const residentSize = batch.residentBuffers?.outputBuffer?.size || 0;
      batch.residentBuffers?.destroy();

      let maxColorErr = 0;
      const metalSummary = [];
      for (let i = 0; i < cpuColors.length; i += 1) {
        const m = cpuColors[i];
        const gpu = batch.results[i];
        const err = Math.max(
          Math.abs(gpu.r - m.cpu.r),
          Math.abs(gpu.g - m.cpu.g),
          Math.abs(gpu.b - m.cpu.b)
        );
        if (err > maxColorErr) maxColorErr = err;
        metalSummary.push({
          symbol: m.symbol,
          gpuRgb: [gpu.r, gpu.g, gpu.b],
          cpuRgb: [m.cpu.r, m.cpu.g, m.cpu.b],
          err,
          spectralCount: gpu.spectralSamples.length
        });
      }

      const cherenkovSub = batch.results[4];
      const cherenkovSup = batch.results[5];
      const cherenkovCpuSup = evaluateCherenkovClosure({ beta: 0.94, refractiveIndex: 1.333, chargeZ: 1 });
      const cherenkovRgbErr = Math.max(
        Math.abs(cherenkovSup.r - cherenkovCpuSup.srgb[0]),
        Math.abs(cherenkovSup.g - cherenkovCpuSup.srgb[1]),
        Math.abs(cherenkovSup.b - cherenkovCpuSup.srgb[2])
      );
      const cherenkovPhotonRelErr = Math.abs(cherenkovSup.photonsPerMeter - cherenkovCpuSup.photonsPerMeter)
        / Math.max(1, cherenkovCpuSup.photonsPerMeter);

      // 2. Native WebGPU Radial Kohn-Sham PBE+SO SCF parity for He (Z=2), O (Z=8), and Au (Z=79)
      const ksAtoms = [];
      for (const Z of [2, 8, 79]) {
        const gpuAtom = await solveAtomWebGpu(device, Z, {
          functional: 'pbe',
          spinOrbit: true,
          gridPointsN: 256,
          maxScf: 80,
          tol: 2e-4
        });
        const cpuAtom = solveAtom(Z, {
          functional: 'pbe',
          scalarRelativistic: true,
          spinOrbit: true,
          gridPointsN: 256,
          maxScf: 120,
          tol: 2e-4
        });
        const energyRelErr = Math.abs(gpuAtom.totalEnergyHa - cpuAtom.totalEnergyHa) / Math.abs(cpuAtom.totalEnergyHa);
        const neErr = Math.abs(gpuAtom.integratedElectrons - gpuAtom.electronCount);
        const soOrb = gpuAtom.orbitals.find((o) => o.l >= 1 && o.spinOrbitSplittingHa > 0) || null;
        ksAtoms.push({
          Z,
          symbol: gpuAtom.symbol,
          gpuTotalEnergyHa: gpuAtom.totalEnergyHa,
          cpuTotalEnergyHa: cpuAtom.totalEnergyHa,
          energyRelErr,
          neErr,
          scfIterations: gpuAtom.scfIterations,
          hasSpinOrbit: Boolean(soOrb),
          resolverStatus: gpuAtom.resolverStatus
        });
      }

      // 3. End-to-end MaterialResolverPipeline with attached GPUDevice (Hg Z=80)
      const pipeline = createMaterialResolverPipeline({ device });
      const hg1 = await pipeline.resolveElement(80, { gridPointsN: 256, includeGasPhase: true, opticalInterbandOptions: fastOpt });
      const hg2 = await pipeline.resolveElement(80, { gridPointsN: 256, includeGasPhase: true, opticalInterbandOptions: fastOpt });
      const pipeStats = pipeline.stats();

      await device.queue.onSubmittedWorkDone();
      return {
        errors,
        residentSize,
        maxColorErr,
        metalSummary,
        cherenkovSubActive: cherenkovSub.active,
        cherenkovSubRgb: cherenkovSub.baseColorSrgb,
        cherenkovSupActive: cherenkovSup.active,
        cherenkovSupAngleDeg: cherenkovSup.cherenkovAngleDeg,
        cherenkovRgbErr,
        cherenkovPhotonRelErr,
        ksAtoms,
        hgFirstStatus: hg1.resolverStatus,
        hgSecondStatus: hg2.resolverStatus,
        hgPhase: hg1.properties.standardPhaseAt298K,
        hgWebgpuDerived: hg1.properties.webgpuDerived,
        pipeStats
      };
    });

    assert.deepEqual(result.errors, [], `WebGPU validation errors: ${JSON.stringify(result.errors)}`);
    assert.ok(result.residentSize > 0, 'resident output buffer should be allocated');
    assert.ok(result.maxColorErr < 2e-3, `GPU vs CPU Drude-Lorentz sRGB max error too high: ${result.maxColorErr}`);
    for (const m of result.metalSummary) {
      assert.equal(m.spectralCount, 9);
    }
    assert.equal(result.cherenkovSubActive, false);
    assert.deepEqual(result.cherenkovSubRgb, [0, 0, 0]);
    assert.equal(result.cherenkovSupActive, true);
    assert.ok(result.cherenkovSupAngleDeg > 35 && result.cherenkovSupAngleDeg < 40);
    assert.ok(result.cherenkovRgbErr < 2e-3, `Cherenkov GPU vs CPU sRGB error: ${result.cherenkovRgbErr}`);
    assert.ok(result.cherenkovPhotonRelErr < 1e-3, `Cherenkov GPU vs CPU photon yield error: ${result.cherenkovPhotonRelErr}`);

    for (const atom of result.ksAtoms) {
      assert.equal(atom.resolverStatus, 'webgpu-derived');
      assert.ok(atom.energyRelErr < 5e-3, `Z=${atom.Z} (${atom.symbol}) GPU vs CPU KS total energy relErr=${atom.energyRelErr}`);
      assert.ok(atom.neErr < 0.15, `Z=${atom.Z} electron count integral error=${atom.neErr}`);
      if (atom.Z >= 8) assert.equal(atom.hasSpinOrbit, true);
    }

    assert.equal(result.hgFirstStatus, 'webgpu-derived');
    assert.equal(result.hgSecondStatus, 'cache-hit');
    assert.equal(result.hgPhase, 'liquid');
    assert.equal(result.hgWebgpuDerived, true);
    assert.equal(result.pipeStats.webgpuDeviceAttached, true);
    assert.equal(result.pipeStats.webgpuDerivations, 1);
    assert.equal(result.pipeStats.hits, 1);
  } finally {
    await browser.close();
  }
});
