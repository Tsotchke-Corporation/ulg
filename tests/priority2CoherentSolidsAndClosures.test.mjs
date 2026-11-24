import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  SCHROEDER_SOLID_BENCHMARK_CONTACT_LAW,
  deriveSchroederSolidContactLaw
} from '../src/runtime/sph/schroederSolidRigidGpu.js';
import { buildSchroederMultilevelProxyCatalog } from '../src/runtime/sph/schroederSolidMultilevelGpu.js';
import {
  deriveDiluteGasTransportFromPairPotential,
  neufeldOmega22
} from '../src/runtime/md/pairPotential.js';
import { anchorDerivedMaterialProperties } from '../src/runtime/material/referenceBankAnchoring.js';
import {
  buildSphExactVaporParcelLedgerWgsl,
  createSphExactVaporParcelLaw,
  sphExactVaporParcelDropletRate
} from '../src/runtime/sph/sphExactVaporParcelLedgerGpu.js';

test('P2: deriveSchroederSolidContactLaw derives continuous mechanics restitution/friction with benchmark fallback', () => {
  const fb = deriveSchroederSolidContactLaw({});
  assert.equal(fb, SCHROEDER_SOLID_BENCHMARK_CONTACT_LAW);
  assert.equal(fb.source, 'benchmark-fallback');

  const stiffCold = deriveSchroederSolidContactLaw({
    bulkModulusPa: 1.7e11,
    shearModulusPa: 8.2e10,
    temperatureK: 300,
    meltTemperatureK: 1811
  });
  const softHot = deriveSchroederSolidContactLaw({
    bulkModulusPa: 9e9,
    shearModulusPa: 3.5e9,
    temperatureK: 265,
    meltTemperatureK: 273.15
  });
  assert.equal(stiffCold.source, 'derived-material-mechanics');
  assert.equal(softHot.source, 'derived-material-mechanics');
  assert.ok(stiffCold.restitution > softHot.restitution, 'stiff cold solid should be more elastic than soft near-melt solid');
  assert.ok(softHot.restitution >= 0.05 && stiffCold.restitution <= 0.85);
  assert.ok(softHot.friction >= 0.12 && softHot.friction <= 0.65);
});

test('P2: SOL-6 buildSchroederMultilevelProxyCatalog supports shipped 10^3 ice and 3^3 Na/Cs with exact area', () => {
  // 10^3 ice block (28 mm cube, 2.8 mm pitch -> raw 10 per axis -> padded to 12)
  const ice = buildSchroederMultilevelProxyCatalog({
    bodyIndex: 0,
    halfExtentsM: [0.014, 0.014, 0.014],
    finePitchM: 0.0028,
    padToMultipleOf4: true
  });
  assert.ok(ice.macroCount > 0);
  const expectedIceArea = 6 * 0.028 * 0.028;
  assert.ok(Math.abs(ice.exactAreaM2 - expectedIceArea) < 1e-12, `ice area ${ice.exactAreaM2} vs ${expectedIceArea}`);

  // 3^3 Na/Cs block (0.6 m cube, 0.2 m pitch -> raw 3 -> padded to 4)
  const alkali = buildSchroederMultilevelProxyCatalog({
    bodyIndex: 0,
    halfExtentsM: [0.3, 0.3, 0.3],
    finePitchM: 0.2,
    padToMultipleOf4: true
  });
  assert.equal(alkali.macroCount, 6);
  assert.ok(Math.abs(alkali.exactAreaM2 - 6 * 0.6 * 0.6) < 1e-12);

  // Strict mode still rejects non-multiple-of-4
  assert.throws(() => buildSchroederMultilevelProxyCatalog({
    bodyIndex: 0,
    halfExtentsM: [0.014, 0.014, 0.014],
    finePitchM: 0.0028
  }), RangeError);
});

test('P2: SOL-4 N-level chain passes mechanicsBuffer; solid thermal uses exposed face area; smear is frame-indifferent', () => {
  const chainSrc = readFileSync(new URL('../src/runtime/sph/schroederSpatialChainStepGpu.js', import.meta.url), 'utf8');
  assert.match(chainSrc, /runSchroederDeformableSolidSurfaceLaneStep\([\s\S]*mechanicsBuffer:\s*g2p\.mechanicsBuffer/);

  const solidThermalSrc = readFileSync(new URL('../src/runtime/sph/schroederSolidThermalGpu.js', import.meta.url), 'utf8');
  assert.match(solidThermalSrc, /var exposed_area_m2 = 0\.0;/);
  assert.match(solidThermalSrc, /if \(exposed_area_m2 > 0\.0 && amb_t > 0\.0 && emiss > 0\.0\)/);

  const wgslSrc = readFileSync(new URL('../ulg-gpu-abi/src/wgsl.js', import.meta.url), 'utf8');
  assert.match(wgslSrc, /let ang_mom = rel_pos_cross_v_weighted \* inv_w - cross\(mean_r, mean_velocity\);/);
  assert.match(wgslSrc, /let dispersion_sq_ms = max\(0\.0, raw_dispersion_sq - rigid_rot_sq\);/);
});

test('P2: Chapman-Enskog dilute gas transport derives realistic Ar/N2 viscosity & conductivity from LJ pair potential', () => {
  // Argon standard LJ params: sigma = 3.405e-10 m, eps/k_B = 119.8 K, M = 0.039948 kg/mol
  // Measured Ar at 300 K: mu ~= 2.27e-5 Pa s, k ~= 0.0177 W/(m K)
  const ar = deriveDiluteGasTransportFromPairPotential({
    molarMassKgPerMol: 0.039948,
    sigmaM: 3.405e-10,
    epsilonJ: 119.8 * 1.380649e-23,
    temperatureK: 300
  });
  assert.ok(ar && neufeldOmega22(ar.reducedTemperature) > 0.5);
  assert.ok(Math.abs(ar.dynamicViscosityPaS - 2.27e-5) / 2.27e-5 < 0.05, `Ar mu=${ar.dynamicViscosityPaS}`);
  assert.ok(Math.abs(ar.thermalConductivityWPerMK - 0.0177) / 0.0177 < 0.08, `Ar k=${ar.thermalConductivityWPerMK}`);

  // Non-bank arbitrary noble gas gets first-principles Chapman-Enskog k & mu
  const synth = anchorDerivedMaterialProperties({
    molarMassKgPerMol: 0.083798, // Krypton-like
    boilingPointK: 119.93,
    phases: [
      { name: 'liquid', densityKgPerM3: 2413 },
      { name: 'gas', referenceTemperatureK: 300, specificHeatCapacityJPerKgK: 150 }
    ]
  }, 'SyntheticKrGas');
  const gasPhase = synth.properties.phases.find((p) => p.name === 'gas');
  assert.equal(gasPhase.thermalConductivityProvenance?.status, 'physical-law');
  assert.equal(gasPhase.thermalConductivityProvenance?.source, 'pair-potential-chapman-enskog');
  assert.ok(gasPhase.dynamicViscosityPaS > 1e-5 && gasPhase.dynamicViscosityPaS < 6e-5);
  assert.ok(gasPhase.thermalConductivityWPerMK > 0.004 && gasPhase.thermalConductivityWPerMK < 0.03);
});

test('P2: Vapor parcel law generalizes beyond H2O/air and scene isovalues use continuous density scaling (zero h2o/fe keys)', () => {
  const ethanolLaw = createSphExactVaporParcelLaw({
    gasConstantVaporJPerKgK: 180.5,
    waterDensityKgPerM3: 789,
    waterSpecificHeatJPerKgK: 2440
  });
  const wgsl = buildSphExactVaporParcelLedgerWgsl(ethanolLaw);
  assert.match(wgsl, /const RV: f32 = 180\.5;/);
  assert.match(wgsl, /const RHO_W: f32 = 789;/);
  const rEth = sphExactVaporParcelDropletRate({ r: 5e-6, rDry: 1e-7, kappa: 0.1, t: 300, p: 101325, s: 1.02, law: ethanolLaw });
  assert.ok(Number.isFinite(rEth.rate) && rEth.rate > 0);

  const sceneSrc = readFileSync(new URL('../src/visualization/sphPhaseScene.js', import.meta.url), 'utf8');
  assert.doesNotMatch(sceneSrc, /const SURFACE_CONFIG\s*=\s*\{\s*h2o:/);
  assert.match(sceneSrc, /function surfaceConfigForDescriptor\(renderKey, phase, densityKgPerM3 = null\)/);

  const workerSrc = readFileSync(new URL('../src/services/ulgMechanicsResidentStage.worker.js', import.meta.url), 'utf8');
  assert.match(workerSrc, /maxVolumeRatio:\s*computedVolumeRatio/);
  assert.match(workerSrc, /maxThermalGradientKPerM:\s*computedThermalGradientKPerM/);
});
