import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOpticalFdtdParams,
  evaluateFdtdAnalyticDispersion,
  registerPhotonShellOpticsClosureArtifact,
  registerPhotonShellSimulationModules,
  PHOTON_SHELL_FDTD_WGSL
} from '../src/runtime/material/photonShellOpticsWebGpu.js';
import {
  buildOrbitalCdfTables,
  registerOrbitalCloudSimulationModule,
  ORBITAL_CLOUD_SAMPLER_WGSL
} from '../src/runtime/electronicStructure/orbitalPointCloudWebGpu.js';
import { createSimulationModuleRegistry } from '../src/runtime/simulationModuleRegistry.js';
import { ClosureRegistry } from '../src/runtime/ClosureRegistry.js';

test('photonShellOpticsWebGpu: dielectric Sellmeier parameters match refractiveIndex550Nm and exhibit chromatic dispersion', () => {
  const params = buildOpticalFdtdParams({
    isMetal: false,
    bandGapEv: 7.0,
    refractiveIndex550Nm: 1.333
  }, { probeWavelengthNm: 550 });

  assert.equal(params.isMetal, false);
  assert.equal(params.plasmaEv, 0);
  assert.equal(params.oscillators[0].active, 1);

  const disp550 = evaluateFdtdAnalyticDispersion(params, 550);
  const disp450 = evaluateFdtdAnalyticDispersion(params, 450);
  const disp650 = evaluateFdtdAnalyticDispersion(params, 650);

  assert.ok(Math.abs(disp550.nRe - 1.333) < 0.015, `expected n(550nm)≈1.333, got ${disp550.nRe}`);
  assert.ok(disp450.nRe > disp650.nRe, `expected normal chromatic dispersion n(450nm)=${disp450.nRe} > n(650nm)=${disp650.nRe}`);
  assert.ok(disp550.reflectance > 0.015 && disp550.reflectance < 0.05, `expected Fresnel R≈2%, got ${disp550.reflectance}`);
});

test('photonShellOpticsWebGpu: metallic Drude + interband oscillator suppresses Blue reflectance when transition enters visible blue', () => {
  const relParams = buildOpticalFdtdParams({
    isMetal: true,
    plasmaEnergyEv: 9.0,
    drudeDampingEv: 0.12,
    interbandOscillators: [
      { energyEv: 3.15, dampingEv: 0.75, strengthWeight: 1.35, transitionLabel: '5d(5/2)→6p' }
    ]
  });
  const nonRelParams = buildOpticalFdtdParams({
    isMetal: true,
    plasmaEnergyEv: 9.0,
    drudeDampingEv: 0.12,
    interbandOscillators: [
      { energyEv: 4.6, dampingEv: 0.75, strengthWeight: 1.35, transitionLabel: '5d→6p' }
    ]
  });

  const relRed = evaluateFdtdAnalyticDispersion(relParams, 650).reflectance;
  const relBlue = evaluateFdtdAnalyticDispersion(relParams, 450).reflectance;
  const nonRelBlue = evaluateFdtdAnalyticDispersion(nonRelParams, 450).reflectance;

  assert.ok(relRed > relBlue + 0.15, `expected visible-edge absorption: R_red=${relRed} > R_blue=${relBlue}`);
  assert.ok(nonRelBlue > relBlue + 0.15, `expected UV-shifted non-rel oscillator to raise R_blue: ${nonRelBlue} > ${relBlue}`);
  assert.ok(!PHOTON_SHELL_FDTD_WGSL.includes('@workgroup_size(1)'), 'must not contain serial @workgroup_size(1)');
});

test('orbitalPointCloudWebGpu: exact radial nodes and monotonic normalized CDFs for analytic & KS wavefunctions', () => {
  const analytic = buildOrbitalCdfTables({
    Z: 26,
    n: 5,
    l: 2,
    m: 2,
    screeningExchange: true,
    relativisticSpinOrbit: true
  });
  assert.equal(analytic.radialNodeCount, 2, '5d orbital must have n - l - 1 = 2 radial nodes');
  const nRad = analytic.radialPacked.length / 4;
  assert.ok(Math.abs(analytic.radialPacked[(nRad - 1) * 4 + 1] - 1.0) < 1e-4, 'radial CDF must end at 1.0');
  for (let i = 1; i < nRad; i += 1) {
    assert.ok(analytic.radialPacked[i * 4 + 1] >= analytic.radialPacked[(i - 1) * 4 + 1] - 1e-6);
  }
  const nPol = analytic.polarPacked.length / 2;
  assert.ok(Math.abs(analytic.polarPacked[(nPol - 1) * 2] - 1.0) < 1e-4, 'polar CDF must end at 1.0');

  // Test numerical Kohn-Sham eigenstate path (1 radial node -> 2s-like u(r) = r(1 - r/2)e^{-r/2})
  const rGrid = Array.from({ length: 128 }, (_, i) => 0.02 + (i / 127) * 14);
  const uKs = Float32Array.from(rGrid, (r) => r * (1 - 0.5 * r) * Math.exp(-0.5 * r));
  const ksTables = buildOrbitalCdfTables({ Z: 3, n: 2, l: 0, m: 0, rGrid, orbitalU: uKs });
  assert.equal(ksTables.sourceKind, 'webgpu-kohn-sham-eigenstate');
  assert.equal(ksTables.radialNodeCount, 1, 'numerical 2s eigenstate must detect 1 radial node');
  assert.ok(!ORBITAL_CLOUD_SAMPLER_WGSL.includes('@workgroup_size(1)'), 'must not contain serial @workgroup_size(1)');
});

test('canonical ULG SimulationModuleRegistry & ClosureRegistry integration (zero demo silos)', async () => {
  const registry = createSimulationModuleRegistry();
  const orbMods = registerOrbitalCloudSimulationModule(registry);
  const psMods = registerPhotonShellSimulationModules(registry);
  assert.equal(orbMods.orbitalCloudMod.methodKey, 'quantum-orbital-cloud@1');
  assert.equal(orbMods.tdksPhotonMod.methodKey, 'quantum-tdks-photon@1');
  assert.equal(psMods.opticsMod.methodKey, 'photon-shell-fdtd@1');
  assert.equal(psMods.tdseMod.methodKey, 'nuclear-tunneling-tdse@1');

  const keys = registry.listModules().map((m) => m.methodKey);
  assert.ok(keys.includes('quantum-orbital-cloud@1'));
  assert.ok(keys.includes('quantum-tdks-photon@1'));
  assert.ok(keys.includes('photon-shell-fdtd@1'));
  assert.ok(keys.includes('nuclear-tunneling-tdse@1'));

  const store = new Map();
  const closureReg = new ClosureRegistry({
    artifactCache: {
      async put(a) { const uri = `mem://${a.closureId}`; store.set(uri, a); return { uri, hash: a.inputHash }; },
      async get(ref) { return store.get(ref.uri); }
    }
  });
  const { ref, artifact } = await registerPhotonShellOpticsClosureArtifact({
    closureRegistry: closureReg,
    materialKey: 'Au',
    electromagnetic: { isMetal: true, plasmaEnergyEv: 9.0, drudeDampingEv: 0.14, interbandOscillators: [] }
  });
  assert.ok(ref?.uri?.includes('ulg-photon-shell-fdtd-optics:Au.v1'));
  assert.equal(artifact.provenance.scientificValidation, false);
});
