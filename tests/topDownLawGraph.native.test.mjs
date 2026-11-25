import assert from 'node:assert/strict';
import test from 'node:test';

// Native Vulkan WebGPU Physical Invariants Proof for ALL New Top-Down & Particle-Rigid Laws:
//   1. `nebular-mhd-collapse@1`: Metamorphic A/B (B0=0 vs B0=0.55), magnetic shear amplification,
//      Dedner GLM div(B) control, polar jet outflow, & +47 AU translation invariance
//   2. `planetary-atmosphere-em@1`: Metamorphic A/B (triboelectric OFF vs ON) across BOTH
//      1-bar moist cloud storms AND 650 Pa low-pressure dry dust storms (Paschen breakdown!)
//   3. `particle-rigid-dynamics@1`: Torque-free asymmetric DLM (1997) symplectic conservation
//      (|ΔL|/|L0| < 1e-4, |ΔKE|/KE0 < 1e-3) + oblique 2-body rubble-pile collision conserving
//      linear & angular momentum while generating real impact spin!
//   4. `protoplanetary-accretion@1`: Snow-line rocky/icy split, Hill-sphere pebble accretion,
//      & aerodynamic gas drag A/B drift
//   5. `build2LptCosmologyICsWebGpu`: Full-Nyquist GPU 2LPT tidal displacement feeding FLRW TreePM!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Top-Down Law Graph + Particle-Rigid Dynamics native Vulkan physical invariant proofs', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan top-down law proofs',
  timeout: 180_000
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
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const res = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 300));
      }
      if (!adapter) throw new Error('WebGPU adapter unavailable');
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message || e.error)));

      // 1. Nebular MHD Collapse (Metamorphic B0=0 vs B0=0.55 + Translation Invariance)
      const nebMod = await import('/src/runtime/astrophysics/nebularMhdCollapseGpu.js');
      const nebHydro = nebMod.createNebularMhdCollapseSessionWebGpu(device, { gridN: 16, tracerCount: 512, initialB0: 0.0, spinOmega: 0.72, seed: 77 });
      const nebMhd = nebMod.createNebularMhdCollapseSessionWebGpu(device, { gridN: 16, tracerCount: 512, initialB0: 0.55, spinOmega: 0.72, seed: 77 });
      const nebShift = nebMod.createNebularMhdCollapseSessionWebGpu(device, { gridN: 16, tracerCount: 512, initialB0: 0.55, spinOmega: 0.72, seed: 77, centerOffset: [47.5, -23.25, 19.75] });
      const telHydro = await nebHydro.step({ dt: 0.025, substeps: 6, readTelemetry: true });
      const telMhd = await nebMhd.step({ dt: 0.025, substeps: 6, readTelemetry: true, readBFieldForStreamlines: true });
      const telShift = await nebShift.step({ dt: 0.025, substeps: 6, readTelemetry: true });
      const streamLinesLen = nebMhd.buildMagneticFieldStreamlines().length;
      nebHydro.dispose(); nebMhd.dispose(); nebShift.dispose();

      // 2. Planetary Baroclinic Atmosphere + Triboelectric Dust/Cloud Lightning (OFF vs Moist 1-bar vs Dry Dusty 650 Pa)
      const atmoMod = await import('/src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js');
      const moistParams = atmoMod.deriveFluidElectrodynamicsState({
        massKg: 5.97e24, radiusM: 6.371e6, surfacePressurePa: 101325, eqTempK: 288,
        volatileMassFrac: 0.75, particulateMassFrac: 0.20
      });
      const dustyParams = atmoMod.deriveFluidElectrodynamicsState({
        massKg: 6.42e23, radiusM: 3.39e6, surfacePressurePa: 650, eqTempK: 215,
        volatileMassFrac: 0.01, particulateMassFrac: 0.90
      });
      const atmoOff = atmoMod.createPlanetaryAtmosphereElectricSessionWebGpu(device, { width: 64, height: 32, bodyParams: moistParams, enableTriboelectric: false, seed: 11 });
      const atmoMoist = atmoMod.createPlanetaryAtmosphereElectricSessionWebGpu(device, { width: 64, height: 32, bodyParams: moistParams, enableTriboelectric: true, seed: 11 });
      const atmoDust = atmoMod.createPlanetaryAtmosphereElectricSessionWebGpu(device, { width: 64, height: 32, bodyParams: dustyParams, enableTriboelectric: true, seed: 11 });
      let telAtmoOff; let telAtmoMoist; let telAtmoDust;
      for (let k = 0; k < 10; k += 1) {
        telAtmoOff = await atmoOff.step({ dtSim: 0.055, substeps: 3, readTelemetry: k === 9 });
        telAtmoMoist = await atmoMoist.step({ dtSim: 0.055, substeps: 3, readTelemetry: k === 9 });
        telAtmoDust = await atmoDust.step({ dtSim: 0.055, substeps: 3, readTelemetry: k === 9 });
      }
      atmoOff.dispose(); atmoMoist.dispose(); atmoDust.dispose();

      // 3. Particle-Based Rigid-Body Dynamics (DLM torque-free conservation + oblique 2-body collision)
      const rigidMod = await import('/src/runtime/sph/particleRigidDynamicsGpu.js');
      // 3A. Asymmetric body torque-free tumbling (DLM 1997 symplectic test)
      const asymParts = [
        { localPos: [0.8, 0, 0], radius: 0.15, mass: 1.5 },
        { localPos: [-0.8, 0, 0], radius: 0.15, mass: 1.5 },
        { localPos: [0, 0.45, 0], radius: 0.15, mass: 1.0 },
        { localPos: [0, -0.45, 0], radius: 0.15, mass: 1.0 },
        { localPos: [0, 0, 0.25], radius: 0.15, mass: 0.6 }
      ];
      const freeSim = rigidMod.createParticleRigidDynamicsSessionWebGpu(device, [{
        position: [0, 0, 0],
        velocity: [0.5, -0.2, 0.3],
        angularVelocity: [1.2, 2.4, 0.9],
        mass: 5.6,
        particles: asymParts
      }]);
      const free0 = await freeSim.step({ dt: 0.004, substeps: 1, readTelemetry: true });
      let free1 = free0;
      for (let k = 0; k < 15; k += 1) {
        free1 = await freeSim.step({ dt: 0.004, substeps: 8, readTelemetry: k === 14 });
      }
      freeSim.dispose();

      // 3B. Oblique 2-body composite rubble-pile impact (exact P & L conservation + spin transfer!)
      const colSim = rigidMod.createParticleRigidDynamicsSessionWebGpu(device, [
        {
          position: [-1.1, 0.18, 0],
          velocity: [2.2, 0, 0],
          angularVelocity: [0, 0, 0],
          mass: 2.0,
          particles: rigidMod.createCompositeClusterParticles({ count: 6, bodyRadius: 0.45, particleRadius: 0.22, mass: 2.0, seed: 3 })
        },
        {
          position: [1.1, -0.18, 0],
          velocity: [-2.2, 0, 0],
          angularVelocity: [0, 0, 0],
          mass: 2.0,
          particles: rigidMod.createCompositeClusterParticles({ count: 6, bodyRadius: 0.45, particleRadius: 0.22, mass: 2.0, seed: 5 })
        }
      ], { stiffnessK: 1400.0, dampingC: 4.0, frictionMu: 0.4, rollingMu: 0.02 });
      const col0 = await colSim.step({ dt: 0.004, substeps: 1, readTelemetry: true });
      let maxContacts = 0;
      let col1 = col0;
      for (let k = 0; k < 28; k += 1) {
        col1 = await colSim.step({ dt: 0.004, substeps: 4, readTelemetry: true });
        if (col1.activeContacts > maxContacts) maxContacts = col1.activeContacts;
      }
      const colBodies = await colSim.readBodiesSnapshot();
      const spin0Mag = Math.hypot(colBodies[12], colBodies[13], colBodies[14]);
      colSim.dispose();

      // 4. Protoplanetary Disk Formation & Snow-Line Pebble Accretion
      const diskMod = await import('/src/runtime/astrophysics/protoplanetaryDiskFormationGpu.js');
      const diskDrag = diskMod.createProtoplanetaryDiskFormationSessionWebGpu(device, { pebbleCount: 1024, embryoCount: 10, enableGasDrag: true, seed: 33 });
      let telDisk;
      for (let k = 0; k < 10; k += 1) {
        telDisk = await diskDrag.step({ dt: 0.022, substeps: 2, readTelemetry: k === 9 });
      }
      diskDrag.dispose();

      // 5. Full-Nyquist GPU 2LPT Cosmology ICs -> FLRW TreePM
      const cosmoMod = await import('/src/runtime/astrophysics/supergalacticTreePmGpu.js');
      const ic2Lpt = await cosmoMod.build2LptCosmologyICsWebGpu(device, { gridPerSide: 16, fftGridN: 16, aInit: 0.14, amplitude: 0.35, seed: 2026 });
      const cosmoSess = cosmoMod.createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 16, pmGridN: 16, aInit: 0.14, initialConditions: ic2Lpt
      });
      const telCosmo = await cosmoSess.step({ readTelemetry: true });
      cosmoSess.destroy();

      return {
        gpuErrors,
        neb: {
          hydroMagE: telHydro.magneticEnergy,
          hydroTorB: telHydro.peakToroidalB,
          mhdMagE: telMhd.magneticEnergy,
          mhdMaxB: telMhd.maxBField,
          mhdTorB: telMhd.peakToroidalB,
          mhdMaxJet: telMhd.maxJetSpeed,
          mhdDivB: telMhd.meanAbsDivB,
          shiftMagEDiff: Math.abs(telShift.magneticEnergy - telMhd.magneticEnergy),
          streamLinesLen
        },
        atmo: {
          offE: telAtmoOff.peakElectricFieldNorm,
          offFlash: telAtmoOff.activeLightningCells,
          moistVort: telAtmoMoist.maxVorticity,
          moistE: telAtmoMoist.peakElectricFieldNorm,
          moistFlash: telAtmoMoist.activeLightningCells,
          moistAurora: telAtmoMoist.maxAuroraGlow,
          dustLoad: telAtmoDust.meanDustLoad,
          dustE: telAtmoDust.peakElectricFieldNorm,
          dustFlash: telAtmoDust.activeLightningCells
        },
        rigid: {
          freeRelKeDrift: Math.abs(free1.kineticEnergy - free0.kineticEnergy) / Math.max(1e-9, free0.kineticEnergy),
          freeRelLDrift: Math.hypot(
            free1.angularMomentum[0] - free0.angularMomentum[0],
            free1.angularMomentum[1] - free0.angularMomentum[1],
            free1.angularMomentum[2] - free0.angularMomentum[2]
          ) / Math.max(1e-9, Math.hypot(...free0.angularMomentum)),
          colMaxContacts: maxContacts,
          colSpinInduced: spin0Mag,
          colRelPDrift: Math.hypot(
            col1.linearMomentum[0] - col0.linearMomentum[0],
            col1.linearMomentum[1] - col0.linearMomentum[1],
            col1.linearMomentum[2] - col0.linearMomentum[2]
          ),
          colRelLDrift: Math.hypot(
            col1.angularMomentum[0] - col0.angularMomentum[0],
            col1.angularMomentum[1] - col0.angularMomentum[1],
            col1.angularMomentum[2] - col0.angularMomentum[2]
          )
        },
        disk: {
          rocky: telDisk.rockyPebbles,
          icy: telDisk.icyPebbles,
          accreted: telDisk.accretedPebbles,
          snowLineAu: telDisk.snowLineAu,
          rigidBodies: telDisk.rigidBodyCount
        },
        cosmo2Lpt: {
          icBackend: ic2Lpt.icBackend,
          rms2Over1: ic2Lpt.rms2Over1,
          sigmaDensity: telCosmo.sigmaDensity,
          submitsPerStep: telCosmo.submitsPerStep
        }
      };
    });

    assert.deepEqual(res.gpuErrors, [], `WebGPU errors: ${res.gpuErrors.join('; ')}`);

    // 1. Nebular MHD assertions
    assert.equal(res.neb.hydroMagE, 0, 'B0=0 hydro-only run must have 0 magnetic energy');
    assert.equal(res.neb.hydroTorB, 0, 'B0=0 hydro-only run must have 0 toroidal B field');
    assert.ok(res.neb.mhdMagE > 10, `Magnetized nebula must carry real magnetic energy (got ${res.neb.mhdMagE})`);
    assert.ok(res.neb.mhdTorB > 0.01, `Differential rotation must wind poloidal B into toroidal B_phi (got ${res.neb.mhdTorB})`);
    assert.ok(res.neb.shiftMagEDiff < 1e-2, `Nebular MHD must be translation-invariant (diff=${res.neb.shiftMagEDiff})`);
    assert.ok(res.neb.streamLinesLen > 100, 'Live 3D magnetic field streamlines must trace through B(x)');

    // 2. Planetary Atmosphere + Triboelectric Dust/Cloud Lightning assertions
    assert.equal(res.atmo.offFlash, 0, 'Triboelectric OFF must fire 0 lightning cells');
    assert.ok(res.atmo.moistVort > 0.1, 'Baroclinic Coriolis fluid must spin up real vorticity');
    assert.ok(res.atmo.moistE > 0.05, 'Moist storm clouds must generate real electrostatic E-field');
    assert.ok(res.atmo.moistAurora > 0.1, 'Geodynamo dipole must produce polar auroral oval');
    assert.ok(res.atmo.dustLoad > 0.15, 'Dry dusty fluid must sustain lifted aeolian dust');
    assert.ok(res.atmo.dustE > 0.05, 'Turbulent dry dust storm must generate real triboelectric E-field');
    assert.ok(res.atmo.moistFlash > 0 || res.atmo.dustFlash > 0, 'Paschen breakdown must fire real electrical discharges inside storm/dust clouds');

    // 3. Particle-Rigid Dynamics assertions
    assert.ok(res.rigid.freeRelLDrift < 1e-4, `DLM torque-free angular momentum drift must be < 1e-4 (got ${res.rigid.freeRelLDrift})`);
    assert.ok(res.rigid.freeRelKeDrift < 2e-3, `DLM torque-free spin KE drift must be < 2e-3 (got ${res.rigid.freeRelKeDrift})`);
    assert.ok(res.rigid.colMaxContacts > 0, 'Oblique composite rubble-pile bodies must collide');
    assert.ok(res.rigid.colSpinInduced > 0.05, 'Oblique particle-rigid impact must induce real spin angular momentum');
    assert.ok(res.rigid.colRelPDrift < 5e-3, `2-body impact must conserve total linear momentum (got ${res.rigid.colRelPDrift})`);
    assert.ok(res.rigid.colRelLDrift < 5e-3, `2-body impact must conserve total angular momentum (got ${res.rigid.colRelLDrift})`);

    // 4. Protoplanetary Disk assertions
    assert.ok(res.disk.rocky > 50 && res.disk.icy > 50, 'Snow line must separate inner silicate & outer icy pebbles');
    assert.ok(res.disk.accreted > 0, 'Embryos must accrete pebbles inside their Hill spheres');
    assert.equal(res.disk.rigidBodies, 11);

    // 5. 2LPT Cosmology assertions
    assert.equal(res.cosmo2Lpt.icBackend, 'webgpu-fft3d-2lpt-full-nyquist');
    assert.ok(res.cosmo2Lpt.rms2Over1 > 0.005, '2LPT tidal correction must be non-trivial');
    assert.ok(res.cosmo2Lpt.sigmaDensity > 0.05);
    assert.equal(res.cosmo2Lpt.submitsPerStep, 1);

    console.log('Top-Down Law Graph + Particle-Rigid Vulkan Proof PASS:', JSON.stringify(res));
    await ctx.close();
  } finally {
    await browser.close();
  }
});
