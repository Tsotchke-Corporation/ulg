import assert from 'node:assert/strict';
import test from 'node:test';

// Native Vulkan Chrome physical-invariant & metamorphic null-test suite for ALL 6 new
// Cosmic Epoch & Astrophysical Entity Universal Law Graph WebGPU modules:
//   1. `cosmological-baryon-radiation@1`: CMB (z=1100), Reionization bubbles (z=10), & Bullet-Cluster ICM/Lensing
//   2. `relativistic-compact-kerr-jet@1`: WebGPU GR TOV (WD + NS + BH branches) & Kerr BZ Jet (`spin=0` null test!)
//   3. `compact-magnetosphere-spindown@1`: `B=0` null vs Pulsar spin-down vs Magnetar Hall-yield Giant Flares!
//   4. `relativistic-binary-gw-rprocess@1`: Newtonian (`c=∞`) null vs 2.5PN GW chirp + BNS Kilonova r-process!
//   5. `radiative-photoionization-winds@1`: `uvFlux=0` null vs H II Pillars / Planetary Nebula / Active Dual-Tail Comet!
//   6. `tidal-roche-rheology-cryovolcanism@1`: `r > 2 R_Roche` intact vs `r < 0.7 R_Roche` disruption + `e=0` cryo null!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('All 6 Cosmic Epoch & Astrophysical Entity WebGPU Law Modules pass Vulkan physics & metamorphic invariants', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Cosmic Epochs & Entities proof',
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
    await page.goto(`${BASE_URL}universes.html?level=0`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const result = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 250));
      }
      if (!adapter) throw new Error('No WebGPU adapter');
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e?.error?.message ?? e)));

      const cosmoMod = await import('/src/runtime/astrophysics/cosmologicalBaryonRadiationGpu.js');
      const kerrMod = await import('/src/runtime/astrophysics/relativisticCompactObjectGpu.js');
      const magMod = await import('/src/runtime/astrophysics/compactMagnetosphereGpu.js');
      const binMod = await import('/src/runtime/astrophysics/relativisticBinaryMergerGpu.js');
      const radMod = await import('/src/runtime/astrophysics/radiativePhotoionizationWindGpu.js');
      const tidMod = await import('/src/runtime/astrophysics/tidalRocheDisruptionGpu.js');

      // 1. Cosmological Baryon + Radiation: CMB (z=1100), Reionization (z=10), & Cluster Merger Lensing!
      const cmbSess = cosmoMod.createCosmologicalBaryonRadiationSessionWebGpu(device, { gridN: 16, tracerCount: 512, redshiftZ: 1100 });
      const cmbTel = await cmbSess.step({ dt: 0.08, substeps: 4, readTelemetry: true });
      cmbSess.dispose();

      const reion0Sess = cosmoMod.createCosmologicalBaryonRadiationSessionWebGpu(device, { gridN: 16, tracerCount: 512, redshiftZ: 10, uvFlux: 0.0 });
      const reion0Tel = await reion0Sess.step({ dt: 0.08, substeps: 6, readTelemetry: true });
      reion0Sess.dispose();

      const reionOnSess = cosmoMod.createCosmologicalBaryonRadiationSessionWebGpu(device, { gridN: 16, tracerCount: 512, redshiftZ: 10, uvFlux: 1.4 });
      const reionOnTel = await reionOnSess.step({ dt: 0.08, substeps: 8, readTelemetry: true });
      reionOnSess.dispose();

      const clusSess = cosmoMod.createCosmologicalBaryonRadiationSessionWebGpu(device, { gridN: 16, tracerCount: 512, redshiftZ: 0.3, clusterMergerMode: true });
      const clusTel = await clusSess.step({ dt: 0.08, substeps: 6, readTelemetry: true });
      clusSess.dispose();

      // 2. GR TOV Unified EOS (WD + NS + BH) & Kerr BZ Jet (`spin=0` null vs `spin=0.92`!)
      const tov = await kerrMod.solveRelativisticTovBatchWebGpu(device, [
        { centralRhoKgM3: 1e10, yElectron: 0.5 },   // White Dwarf (~0.8-1.1 M☉, ~3000-7000 km)
        { centralRhoKgM3: 1.0e18, yElectron: 0.5 }, // Neutron Star (~1.3-2.3 M☉, ~9-15 km)
        { centralRhoKgM3: 6.0e18, yElectron: 0.5 }  // Black Hole collapse regime
      ]);
      const kerrOff = kerrMod.createKerrAccretionJetSessionWebGpu(device, { spinA: 0.0, particleCount: 512 });
      const kerrOffTel = await kerrOff.step({ dt: 0.03, substeps: 4, readTelemetry: true });
      kerrOff.dispose();
      const kerrOn = kerrMod.createKerrAccretionJetSessionWebGpu(device, { spinA: 0.92, accretionRateEddington: 0.45, particleCount: 512 });
      const kerrOnTel = await kerrOn.step({ dt: 0.03, substeps: 6, readTelemetry: true });
      kerrOn.dispose();

      // 3. Compact Magnetosphere: B=0 null vs Pulsar vs Magnetar Giant Flare!
      const magOff = magMod.createCompactMagnetosphereSessionWebGpu(device, { surfaceBFieldTesla: 0, particleCount: 512 });
      const magOffTel = await magOff.step({ dt: 0.04, substeps: 4, readTelemetry: true });
      magOff.dispose();
      const pulsar = magMod.createCompactMagnetosphereSessionWebGpu(device, { surfaceBFieldTesla: 4e8, spinPeriodS: 0.033, particleCount: 512 });
      const pulsarTel = await pulsar.step({ dt: 0.04, substeps: 10, readTelemetry: true });
      pulsar.dispose();
      const magnetar = magMod.createCompactMagnetosphereSessionWebGpu(device, { surfaceBFieldTesla: 1.5e11, spinPeriodS: 2.0, particleCount: 512 });
      let magTel = null;
      for (let k = 0; k < 8; k += 1) magTel = await magnetar.step({ dt: 0.06, substeps: 4, readTelemetry: k === 7 });
      magnetar.dispose();

      // 4. Relativistic Binary GW Inspiral: Newtonian (c=∞) null vs 2.5PN Chirp & Kilonova r-process!
      const newtBin = binMod.createRelativisticBinaryMergerSessionWebGpu(device, { separation0: 4.0, eccentricity0: 0.0, cSpeedSim: Infinity, particleCount: 512 });
      const newt0 = newtBin.separation;
      const newtTel = await newtBin.step({ dt: 0.03, substeps: 12, readTelemetry: true });
      newtBin.dispose();

      const gwBin = binMod.createRelativisticBinaryMergerSessionWebGpu(device, { separation0: 2.2, eccentricity0: 0.0, cSpeedSim: 4.2, neutronRich: true, particleCount: 512 });
      const gw0 = gwBin.separation;
      let gwTel = null;
      for (let k = 0; k < 12; k += 1) gwTel = await gwBin.step({ dt: 0.04, substeps: 6, readTelemetry: k === 11 });
      gwBin.dispose();

      // 5. Radiative Photoionization & Dual-Tail Comet: cold/dark null vs active!
      const darkNeb = radMod.createRadiativePhotoionizationWindSessionWebGpu(device, { regime: 'h2-pillars', uvFlux: 0.0, particleCount: 512 });
      const darkNebTel = await darkNeb.step({ dt: 0.04, substeps: 4, readTelemetry: true });
      darkNeb.dispose();
      const litNeb = radMod.createRadiativePhotoionizationWindSessionWebGpu(device, { regime: 'h2-pillars', uvFlux: 1.6, particleCount: 512 });
      const litNebTel = await litNeb.step({ dt: 0.04, substeps: 6, readTelemetry: true });
      litNeb.dispose();
      const coldComet = radMod.createRadiativePhotoionizationWindSessionWebGpu(device, { regime: 'comet-dual-tail', sublimationDrive: 0.0, particleCount: 512 });
      const coldCometTel = await coldComet.step({ dt: 0.04, substeps: 4, readTelemetry: true });
      coldComet.dispose();
      const hotComet = radMod.createRadiativePhotoionizationWindSessionWebGpu(device, { regime: 'comet-dual-tail', sublimationDrive: 1.2, uvFlux: 1.1, particleCount: 512 });
      const hotCometTel = await hotComet.step({ dt: 0.04, substeps: 6, readTelemetry: true });
      hotComet.dispose();

      // 6. Tidal Roche Disruption & Cryovolcanism: far intact vs inside Roche rupture + e=0 null!
      const farCluster = tidMod.createTidalRocheDisruptionSessionWebGpu(device, { mode: 'roche-rings', orbitRadiusSim: 7.2, rRocheSim: 3.6, particleCount: 512 });
      const farTel = await farCluster.step({ dt: 0.025, substeps: 6, readTelemetry: true });
      farCluster.dispose();
      const nearCluster = tidMod.createTidalRocheDisruptionSessionWebGpu(device, { mode: 'roche-rings', orbitRadiusSim: 2.1, rRocheSim: 3.6, particleCount: 512 });
      const nearTel = await nearCluster.step({ dt: 0.025, substeps: 6, readTelemetry: true });
      nearCluster.dispose();
      const cryoOff = tidMod.createTidalRocheDisruptionSessionWebGpu(device, { mode: 'cryo-plumes', tidalHeatDrive: 0.0, particleCount: 512 });
      const cryoOffTel = await cryoOff.step({ dt: 0.025, substeps: 4, readTelemetry: true });
      cryoOff.dispose();
      const cryoOn = tidMod.createTidalRocheDisruptionSessionWebGpu(device, { mode: 'cryo-plumes', tidalHeatDrive: 1.2, particleCount: 512 });
      const cryoOnTel = await cryoOn.step({ dt: 0.025, substeps: 6, readTelemetry: true });
      cryoOn.dispose();

      await device.queue.onSubmittedWorkDone();
      return {
        gpuErrors,
        cosmo: {
          cmbT: cmbTel.cmbTempK, cmbRms: cmbTel.cmbRmsDeltaTOverT,
          reion0: reion0Tel.meanIonizedFraction, reionOn: reionOnTel.meanIonizedFraction,
          clusXray: clusTel.meanXrayEmissivity, clusKappa: clusTel.maxLensingKappa, clusAlpha: clusTel.maxLensingDeflection
        },
        kerr: {
          tovWd: tov[0], tovNs: tov[1], tovBh: tov[2],
          offJet: kerrOffTel.activeJetParcels, onJet: kerrOnTel.activeJetParcels, onGamma: kerrOnTel.maxLorentzGamma
        },
        mag: {
          offBeam: magOffTel.beamFluxProxy, offFlare: magOffTel.flareCount,
          pulsarBeam: pulsarTel.beamFluxProxy, pulsarFlare: pulsarTel.flareCount,
          magnetarFlares: magTel.flareCount, magnetarFlareFlux: magTel.flareFluxProxy
        },
        bin: {
          newt0, newt1: newtTel.separation, newtH: newtTel.gwStrainPlus,
          gw0, gw1: gwTel.separation, gwMerged: gwTel.merged, gwRem: gwTel.remnantType, gwRProc: gwTel.rProcessEjectaCount
        },
        rad: {
          darkIon: darkNebTel.meanIonizedFraction, litIon: litNebTel.meanIonizedFraction,
          coldCometLive: coldCometTel.activeParcels, hotCometLive: hotCometTel.activeParcels
        },
        tidal: {
          farRupture: farTel.rupturedFraction, nearRupture: nearTel.rupturedFraction,
          cryoOffLive: cryoOffTel.activeParticles, cryoOnLive: cryoOnTel.activeParticles
        }
      };
    });

    console.log('Cosmic Epochs & All 6 New Law Modules Raw Result:', JSON.stringify(result));
    assert.deepEqual(result.gpuErrors, [], `GPU errors: ${result.gpuErrors.join('; ')}`);

    // 1. Cosmo Baryon + Radiation proofs
    assert.ok(result.cosmo.cmbT > 2900 && result.cosmo.cmbRms > 0.01);
    assert.ok(result.cosmo.reionOn > result.cosmo.reion0 + 0.05, 'UV photoionization must grow H II reionization bubbles');
    assert.ok(result.cosmo.clusXray > 0.1 && result.cosmo.clusKappa > 0.05 && result.cosmo.clusAlpha > 0.01);

    // 2. GR TOV + Kerr BZ proofs
    assert.equal(result.kerr.tovWd.branch, 'white-dwarf');
    assert.ok(result.kerr.tovWd.massSolar > 0.3 && result.kerr.tovWd.massSolar < 1.45 && result.kerr.tovWd.radiusKm > 1000);
    assert.equal(result.kerr.tovNs.branch, 'neutron-star');
    assert.ok(result.kerr.tovNs.massSolar > 0.8 && result.kerr.tovNs.massSolar < 3.0 && result.kerr.tovNs.radiusKm > 6 && result.kerr.tovNs.radiusKm < 22);
    assert.equal(result.kerr.tovBh.branch, 'black-hole');
    assert.equal(result.kerr.offJet, 0, 'Spin=0 Schwarzschild BH must launch 0 Blandford-Znajek jet parcels');
    assert.ok(result.kerr.onJet > 100 && result.kerr.onGamma > 2.0, 'High-spin Kerr BH must launch relativistic BZ jet');

    // 3. Compact Magnetosphere proofs
    assert.equal(result.mag.offBeam, 0);
    assert.equal(result.mag.offFlare, 0);
    assert.ok(result.mag.pulsarBeam > 10 && result.mag.pulsarFlare === 0, 'Pulsar must emit lighthouse beams with 0 crustal fractures');
    assert.ok(result.mag.magnetarFlares >= 1 && result.mag.magnetarFlareFlux > 10, 'Magnetar must undergo Hall-crustal yield starquake giant flares');

    // 4. Relativistic Binary GW & Kilonova proofs
    assert.equal(result.bin.newtH, 0, 'Newtonian c=∞ binary must emit 0 GW strain');
    assert.ok(Math.abs(result.bin.newt1 - result.bin.newt0) < 0.15, 'Newtonian circular binary must not inspiral');
    assert.ok(result.bin.gw1 < result.bin.gw0 * 0.7 || result.bin.gwMerged, '2.5PN binary must inspiral & merge via GW emission');
    assert.ok(result.bin.gwRProc > 50, 'Neutron-star merger must produce low-Ye r-process ejecta');

    // 5. Radiative Photoionization & Dual-Tail Comet proofs
    assert.ok(result.rad.litIon > result.rad.darkIon + 0.15, 'UV flux must photoionize H II nebula');
    assert.equal(result.rad.coldCometLive, 0, 'Cold comet below T_sub must produce 0 outgassing tail');
    assert.ok(result.rad.hotCometLive > 400, 'Warm comet above T_sub must produce active ion + dust tails');

    // 6. Tidal Roche Disruption & Cryovolcanism proofs
    assert.ok(result.tidal.nearRupture > result.tidal.farRupture + 0.35, 'Rubble-pile inside R_Roche must disrupt while far body stays intact');
    assert.equal(result.tidal.cryoOffLive, 0, 'e=0 zero tidal heating must produce 0 cryovolcanic plumes');
    assert.ok(result.tidal.cryoOnLive > 400, 'Eccentric icy moon must vent active cryovolcanic plumes');

    console.log('Cosmic Epochs & All 6 New Astrophysical Law Modules Vulkan Proof PASS:', JSON.stringify(result));
    await ctx.close();
  } finally {
    await browser.close();
  }
});
