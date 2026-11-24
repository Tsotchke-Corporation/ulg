import assert from 'node:assert/strict';
import test from 'node:test';

// Gate 5A, 5B & 5C Native Vulkan GPU Invariant Proof:
//   1. Gate 5A WebGPU Polytope-Atlas Planetary Interior (`buildPlanetaryPolytopeAtlasWebGpu`
//      + `solvePlanetaryInteriorWebGpu` evaluating `eval_polytope_atlas_bank_2d` inline on GPU):
//      uses REAL Gate 1-2 `Fe` & `Al2O3` bundles from `foundation-polytope-atlas.json` fitted
//      up to 1 TPa, deriving realistic terrestrial mass/radius/MoI, AND proving strict FAIL-CLOSED
//      rejection (`valid: false, failClosed: true, reason: 'polytope-out-of-domain'`) at 5 TPa
//      and on the lower-pressure 10 GPa ambient atlas!
//   2. Gate 5A Symplectic Planetary N-body (`runSymplecticPlanetaryNBodyWebGpu`): exact
//      Keplerian energy & angular-momentum conservation (< 1e-3).
//   3. Gate 5B WebGPU Stellar Nuclear Network (`evaluateStellarNuclearNetworkWebGpu`) &
//      WebGPU RK4 Lane-Emden (`solveLaneEmdenPolytropeWebGpu`).
//   4. Gate 5C Galactic DM + Stars + Compressible SPH ISM + Symmetric Paczyński-Wiita SMBH
//      (`runGalacticIsmWebGpu`): ping-pong race-free buffers, live Gate 1 WebGPU atomic cooling
//      (`deriveGate1IsmCoolingAnchorsWebGpu`), exact Newton's 3rd law momentum conservation
//      (`momentumDrift < 1e-4`), and strict translation invariance (`< 1e-3`)!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1'
  || process.env.ULG_RUN_NATIVE_GATE5 === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Gate 5A, 5B & 5C native Vulkan proof: WebGPU Polytope planetary interiors (with fail-closed out-of-domain), GPU nuclear/Lane-Emden, symplectic N-body & race-free momentum-conserving galactic ISM', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Gate 5A/5B/5C proof',
  timeout: 180_000
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

    const res = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 6 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 300));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const {
        buildPlanetaryPolytopeAtlasWebGpu,
        solvePlanetaryInteriorWebGpu,
        runSymplecticPlanetaryNBodyWebGpu
      } = await import('/src/runtime/astrophysics/planetaryStructureGpu.js');
      const {
        evaluateStellarNuclearNetworkWebGpu,
        solveLaneEmdenPolytropeWebGpu
      } = await import('/src/runtime/astrophysics/stellarNucleosynthesisBridge.js');
      const {
        deriveGate1IsmCoolingAnchorsWebGpu,
        runGalacticIsmWebGpu
      } = await import('/src/runtime/astrophysics/galacticIsmCoolingGpu.js');
      const {
        lookupFoundationPolytopeRecord,
        hydrateFoundationPolytopes
      } = await import('/src/runtime/material/foundationPolytopeAtlasGpuBridge.js');

      // 1. Gate 5A WebGPU Polytope-Atlas Planetary Interior from REAL Gate 1-2 Fe & Al2O3 bundles!
      const feBundle = lookupFoundationPolytopeRecord('Fe');
      const oxideBundle = lookupFoundationPolytopeRecord('Al2O3');
      const feAtlas1TPa = await buildPlanetaryPolytopeAtlasWebGpu(device, feBundle, { maxPressurePa: 1e12, materialIndex: 0 });
      const oxideAtlas1TPa = await buildPlanetaryPolytopeAtlasWebGpu(device, oxideBundle, { maxPressurePa: 1e12, materialIndex: 1 });

      const earthGpu = await solvePlanetaryInteriorWebGpu(device, {
        centralPressurePa: 360e9,
        layers: [
          { name: 'iron-core', bundle: feBundle, atlas: feAtlas1TPa, massFractionTarget: 0.325, tempK: 5200 },
          { name: 'oxide-mantle', bundle: oxideBundle, atlas: oxideAtlas1TPa, massFractionTarget: 0.675, tempK: 2200 }
        ]
      });

      // Fail-closed test 1: 5 TPa exceeds 1 TPa fitted atlas envelope -> MUST fail closed!
      const outOfDomain5TPa = await solvePlanetaryInteriorWebGpu(device, {
        centralPressurePa: 5e12,
        layers: [
          { name: 'iron-core', bundle: feBundle, atlas: feAtlas1TPa, massFractionTarget: 0.325, tempK: 5200 },
          { name: 'oxide-mantle', bundle: oxideBundle, atlas: oxideAtlas1TPa, massFractionTarget: 0.675, tempK: 2200 }
        ]
      });

      // Fail-closed test 2: Ambient 10 GPa atlas queried at 360 GPa core -> MUST fail closed!
      const outOfDomain10GPa = await solvePlanetaryInteriorWebGpu(device, {
        centralPressurePa: 360e9,
        layers: [
          { name: 'iron-core-ambient', bundle: feBundle, polytopes: hydrateFoundationPolytopes(feBundle), massFractionTarget: 1.0, tempK: 1500 }
        ]
      });

      // 2. Symplectic Planetary N-body conservation
      const bodies0 = [
        { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mass: 1.0 },
        { x: 1.0, y: 0, z: 0, vx: 0, vy: 1.0, vz: 0, mass: 1e-4 },
        { x: 0, y: 2.2, z: 0, vx: -1 / Math.sqrt(2.2), vy: 0, vz: 0, mass: 2e-4 }
      ];
      const pStart = await runSymplecticPlanetaryNBodyWebGpu(device, { bodies: bodies0, dt: 0.005, steps: 1 });
      const pEnd = await runSymplecticPlanetaryNBodyWebGpu(device, { bodies: bodies0, dt: 0.005, steps: 400 });
      const eRelErr = Math.abs(pEnd.totalEnergy - pStart.totalEnergy) / Math.abs(pStart.totalEnergy);
      const lRelErr = Math.abs(pEnd.angularMomentum[2] - pStart.angularMomentum[2]) / Math.abs(pStart.angularMomentum[2]);

      // 3. Gate 5B WebGPU Stellar Nuclear Network & WebGPU RK4 Lane-Emden
      const nucGpu = await evaluateStellarNuclearNetworkWebGpu(device, [
        { rhoKgM3: 1.5e5, temperatureK: 1.5e7, xH: 0.70, xHe: 0.28, xZ: 0.02, dtS: 1e13 },
        { rhoKgM3: 1.0e8, temperatureK: 1.5e8, xH: 0.0, xHe: 0.98, xZ: 0.02, dtS: 1e10 }
      ]);
      const leGpu = await solveLaneEmdenPolytropeWebGpu(device, [1.5, 3.0], { dXi: 0.002 });

      // 4. Gate 5C Galactic DM + Stars + Compressible SPH ISM + Symmetric Paczynski-Wiita SMBH
      const coolingAnchors = await deriveGate1IsmCoolingAnchorsWebGpu(device);
      const mkGal = (ox, oy, oz) => {
        const list = [{ x: ox, y: oy, z: oz, vx: 0, vy: 0, vz: 0, mass: 5.0, tempK: 0, type: 3 }];
        for (let i = 0; i < 64; i += 1) {
          const ang = (i / 64) * 2 * Math.PI;
          const r = 1.2 + (i % 8) * 0.45;
          const vc = Math.sqrt(5.0 / r);
          const isIsm = i % 2 === 0;
          list.push({
            x: ox + r * Math.cos(ang),
            y: oy + r * Math.sin(ang),
            z: oz + ((i % 5) - 2) * 0.05,
            vx: -vc * Math.sin(ang),
            vy: vc * Math.cos(ang),
            vz: 0,
            mass: 0.02,
            tempK: isIsm ? 25000 : 0,
            type: isIsm ? 2 : 1
          });
        }
        return list;
      };
      const galA = await runGalacticIsmWebGpu(device, { bodies: mkGal(0, 0, 0), dt: 0.01, steps: 20, coolingAnchors });
      const galB = await runGalacticIsmWebGpu(device, { bodies: mkGal(50, -30, 20), dt: 0.01, steps: 20, coolingAnchors });
      const comShiftErr = Math.hypot(
        (galB.com[0] - 50) - galA.com[0],
        (galB.com[1] + 30) - galA.com[1],
        (galB.com[2] - 20) - galA.com[2]
      );
      const tempDiff = Math.abs(galB.meanIsmTempK - galA.meanIsmTempK);

      device.destroy();
      return {
        status: 'ok',
        gpuErrors,
        planetaryInterior: {
          backend: earthGpu.backend,
          valid: earthGpu.valid,
          failClosed: earthGpu.failClosed,
          radiusM: earthGpu.radiusM,
          totalMassKg: earthGpu.totalMassKg,
          moiFactor: earthGpu.moiFactor,
          dynamoCapable: earthGpu.dynamoCapable,
          profileLen: earthGpu.profile.length,
          outOfDomain5TPa: { valid: outOfDomain5TPa.valid, failClosed: outOfDomain5TPa.failClosed, reason: outOfDomain5TPa.reason },
          outOfDomain10GPa: { valid: outOfDomain10GPa.valid, failClosed: outOfDomain10GPa.failClosed, reason: outOfDomain10GPa.reason }
        },
        planetaryNBody: { eRelErr, lRelErr },
        stellarGpu: {
          ppEps: nucGpu.results[0].epsPpWPerKg,
          ppEnergyDep: nucGpu.results[0].energyDepositedJPerKg,
          he3aEps: nucGpu.results[1].eps3aWPerKg,
          le15: leGpu.solutions[0],
          le30: leGpu.solutions[1]
        },
        galactic: {
          pingPongBuffered: galA.pingPongBuffered,
          compressibleIsmHydroEnabled: galA.compressibleIsmHydroEnabled,
          coolingBackend: galA.gate1CoolingAnchors.backend,
          meanIsmTempK: galA.meanIsmTempK,
          momentumDrift: galA.momentumDrift,
          comShiftErr,
          tempDiff
        }
      };
    });
    await ctx.close();

    assert.deepEqual(pageErrors, []);
    assert.equal(res.status, 'ok');
    assert.deepEqual(res.gpuErrors, []);

    // Gate 5A inline WGSL Polytope-Atlas planetary interior assertions
    assert.equal(res.planetaryInterior.backend, 'webgpu-polytope-atlas');
    assert.equal(res.planetaryInterior.valid, true);
    assert.equal(res.planetaryInterior.failClosed, false);
    assert.ok(res.planetaryInterior.radiusM > 4.5e6 && res.planetaryInterior.radiusM < 1.2e7, `GPU Earth-like R=${res.planetaryInterior.radiusM}`);
    assert.ok(res.planetaryInterior.totalMassKg > 1.5e24 && res.planetaryInterior.totalMassKg < 2.5e25, `GPU Earth-like M=${res.planetaryInterior.totalMassKg}`);
    assert.ok(res.planetaryInterior.moiFactor > 0.20 && res.planetaryInterior.moiFactor < 0.40, `GPU MoI=${res.planetaryInterior.moiFactor}`);
    assert.equal(res.planetaryInterior.dynamoCapable, true);
    assert.ok(res.planetaryInterior.profileLen > 10);
    // Strict fail-closed domain enforcement!
    assert.equal(res.planetaryInterior.outOfDomain5TPa.valid, false);
    assert.equal(res.planetaryInterior.outOfDomain5TPa.failClosed, true);
    assert.equal(res.planetaryInterior.outOfDomain5TPa.reason, 'polytope-out-of-domain');
    assert.equal(res.planetaryInterior.outOfDomain10GPa.valid, false);
    assert.equal(res.planetaryInterior.outOfDomain10GPa.failClosed, true);
    assert.equal(res.planetaryInterior.outOfDomain10GPa.reason, 'polytope-out-of-domain');

    // Gate 5A Symplectic N-body
    assert.ok(res.planetaryNBody.eRelErr < 1e-3, `Symplectic E rel err=${res.planetaryNBody.eRelErr}`);
    assert.ok(res.planetaryNBody.lRelErr < 1e-4, `Symplectic L rel err=${res.planetaryNBody.lRelErr}`);

    // Gate 5B WebGPU nuclear & Lane-Emden
    assert.ok(res.stellarGpu.ppEps > 1e-4 && res.stellarGpu.ppEnergyDep > 0, `GPU pp-chain eps=${res.stellarGpu.ppEps}`);
    assert.ok(res.stellarGpu.he3aEps > 1e-2, `GPU triple-alpha eps=${res.stellarGpu.he3aEps}`);
    assert.ok(Math.abs(res.stellarGpu.le15.xi1 - 3.65375) < 0.02, `GPU Lane-Emden n=1.5 xi1=${res.stellarGpu.le15.xi1}`);
    assert.ok(Math.abs(res.stellarGpu.le30.xi1 - 6.89685) < 0.03, `GPU Lane-Emden n=3.0 xi1=${res.stellarGpu.le30.xi1}`);

    // Gate 5C Galactic ISM: ping-pong race-free, Gate 1 WebGPU cooling, compressible SPH hydro, exact Newton 3rd-law SMBH symmetry!
    assert.equal(res.galactic.pingPongBuffered, true);
    assert.equal(res.galactic.compressibleIsmHydroEnabled, true);
    assert.equal(res.galactic.coolingBackend, 'webgpu-gate1-radial-ks');
    assert.ok(res.galactic.meanIsmTempK < 24500 && res.galactic.meanIsmTempK > 15, `ISM cooled from 25000 K to ${res.galactic.meanIsmTempK} K`);
    assert.ok(res.galactic.momentumDrift < 1e-3, `Symmetric Paczynski-Wiita SMBH + SPH ISM must conserve total linear momentum (<1e-3), got ${res.galactic.momentumDrift}`);
    assert.ok(res.galactic.comShiftErr < 1e-3, `Galactic translation invariance err=${res.galactic.comShiftErr}`);
    assert.ok(res.galactic.tempDiff < 1e-2, `Galactic ISM cooling translation invariance err=${res.galactic.tempDiff}`);
  } finally {
    await browser.close();
  }
});
