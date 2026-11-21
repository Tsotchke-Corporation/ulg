import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ULG_ESHKOL_TRIAD_CLOSURES_SCHEMA,
  deriveEshkolHelmholtzPotentialClosure,
  deriveEshkolSolidHyperelasticClosure,
  deriveEshkolTransportClosures,
  eshkolHelmholtzProgram,
  eshkolSolidHyperelasticProgram,
  eshkolTransportPrograms,
  eshkolTriadClosuresWgsl,
  packEshkolTriadClosureBundleForGpu
} from '../src/runtime/material/eshkolTriadClosures.js';
import {
  ULG_MOONLAB_COLD_MISS_SYNTHESIS_SCHEMA,
  buildDebyeG6CaloricSamples,
  debyeHeatCapacityRatio,
  deriveFirstPrinciplesMaterialParametersFromMoonlab,
  synthesizeMoonlabFirstPrinciplesClosures
} from '../src/runtime/material/moonlabColdMissSynthesis.js';
import { createWarmClosureMissBridge } from '../src/runtime/material/warmClosureMissBridge.js';

test('Eshkol AD Helmholtz, Solid Hyperelastic, and 2D Transport closures fit accurately and pack for GPU', async () => {
  const hProg = eshkolHelmholtzProgram({ material: 'h2o-liquid', cvJPerKgK: 4180, rSpecificJPerKgK: 461.5, bulkModulusPa: 2.2e9 });
  assert.ok(hProg.definition.includes('(define (helmholtz-a T v)'));
  assert.ok(hProg.definition.includes('(derivative '));

  const helmholtz = await deriveEshkolHelmholtzPotentialClosure({
    material: 'h2o-liquid',
    cvJPerKgK: 4180,
    rSpecificJPerKgK: 461.5,
    bulkModulusPa: 2.2e9,
    refTemperatureK: 300,
    refSpecificVolumeM3PerKg: 1e-3,
    temperatureRangeK: [275, 370],
    specificVolumeRangeM3PerKg: [0.95e-3, 1.05e-3],
    sample: async (_def, _call, pts) => pts.map(([T, v]) => hProg.closedForm.a(T, v))
  });
  assert.equal(helmholtz.schema, ULG_ESHKOL_TRIAD_CLOSURES_SCHEMA);
  assert.ok(helmholtz.responseFunction.residuals.relativeBound < 1e-5);

  const sProg = eshkolSolidHyperelasticProgram({ material: 'fe-solid' });
  const solid = await deriveEshkolSolidHyperelasticClosure({
    material: 'fe-solid',
    sample: async (_def, _call, pts) => pts.map(([J, T]) => sProg.closedForm.psi(J, T))
  });
  assert.ok(solid.responseFunction.residuals.relativeBound < 1e-5);

  const tProg = eshkolTransportPrograms({ material: 'h2o-vapor' });
  const transport = await deriveEshkolTransportClosures({
    material: 'h2o-vapor',
    sample: async (_def, call, pts) => {
      const key = call === 'transport-k' ? 'k' : (call === 'transport-mu' ? 'mu' : 'D');
      return pts.map(([T, rho]) => tProg.closedForm[key](T, rho));
    }
  });
  assert.ok(transport.conductivity.responseFunction.residuals.relativeBound < 1e-5);
  assert.ok(transport.viscosity.responseFunction.residuals.relativeBound < 1e-5);
  assert.ok(transport.diffusivity.responseFunction.residuals.relativeBound < 1e-5);

  const bundle = packEshkolTriadClosureBundleForGpu({
    helmholtz,
    solidHyperelastic: solid,
    transport
  });
  assert.equal(bundle.packed.functionCount, 5);
  assert.ok(bundle.packed.data instanceof Float32Array);
  const wgsl = eshkolTriadClosuresWgsl();
  assert.ok(wgsl.includes('fn triad_eval_helmholtz'));
  assert.ok(wgsl.includes('fn triad_eval_solid_hyperelastic'));
  assert.ok(wgsl.includes('fn triad_eval_transport'));

  // Host evaluation matches exact physics inside box and rejects outside box.
  const kEval = bundle.evaluateHost.k(500, 2.0);
  const kExact = tProg.closedForm.k(500, 2.0);
  assert.ok(Math.abs(kEval.value - kExact) / kExact < 1e-5);
  assert.equal(bundle.evaluateHost.k(50, 2.0).ok, false);
});

test('MoonLab first-principles cold-miss synthesis derives certified A4 + G6 closures and fails closed on invalid inputs', async () => {
  // Debye heat capacity approaches 0 at low T and 1 at high T.
  const lowRatio = debyeHeatCapacityRatio(40, 470);
  const highRatio = debyeHeatCapacityRatio(4000, 470);
  assert.ok(lowRatio > 0 && lowRatio < 0.05, `lowRatio=${lowRatio}`);
  assert.ok(highRatio > 0.99 && highRatio <= 1.0, `highRatio=${highRatio}`);

  // Fail closed on nonphysical observables.
  assert.throws(() => deriveFirstPrinciplesMaterialParametersFromMoonlab({
    material: 'bad',
    molarMassKgPerMol: -1,
    cohesiveEnergyEvPerAtom: 4.2,
    debyeTemperatureK: 470,
    molecularDiameterM: 2.8e-10,
    refDensityKgPerM3: 7874
  }));

  const synthesized = await synthesizeMoonlabFirstPrinciplesClosures({
    material: 'fe-quantum-cold-miss',
    molarMassKgPerMol: 0.055845,
    atomsPerFormula: 1,
    cohesiveEnergyEvPerAtom: 4.28,
    debyeTemperatureK: 470,
    molecularDiameterM: 2.52e-10,
    refDensityKgPerM3: 7874,
    meltTemperatureK: 1811,
    temperatureRangeK: [240, 1200],
    quantumProbeReceipt: { qubits: 4, fingerprint: 'moonlab-fe-q4' }
  });
  assert.equal(synthesized.schema, ULG_MOONLAB_COLD_MISS_SYNTHESIS_SCHEMA);
  assert.equal(synthesized.gpuBundle.packed.functionCount, 5);
  assert.equal(synthesized.g6DebyeSamples.length, 33);
  // Strictly monotone G6 Debye caloric samples (u_k < u_{k+1}, T_k < T_{k+1}).
  for (let i = 1; i < synthesized.g6DebyeSamples.length; i += 1) {
    assert.ok(synthesized.g6DebyeSamples[i].u > synthesized.g6DebyeSamples[i - 1].u);
    assert.ok(synthesized.g6DebyeSamples[i].temperatureK > synthesized.g6DebyeSamples[i - 1].temperatureK);
  }
  assert.ok(synthesized.parameters.bulkModulusPa > 50e9 && synthesized.parameters.bulkModulusPa < 500e9);

  // Build standalone G6 Debye samples helper check.
  const samples = buildDebyeG6CaloricSamples({
    dulongPetitCvJPerKgK: 450,
    debyeTemperatureK: 470,
    tMinK: 100,
    tMaxK: 1000,
    sampleCount: 15
  });
  assert.equal(samples.length, 15);
});

test('PeerCompute A6 warmClosureMissBridge orchestrates MoonLab+Eshkol triad synthesis under G5 CAS reservations and schedule adoption', async () => {
  const commits = [];
  const bridge = createWarmClosureMissBridge({
    maxInFlight: 2,
    sourceIdentity: 'triad-test-v1',
    taskRunner: async (payload) => {
      assert.equal(payload.service, 'moonlab');
      return {
        value: { qubits: payload.qubits, bellFidelity: 0.9999 },
        commitDelta: { taskId: 'mock-moonlab', payload: { residency: 'warm-mock-worker' } }
      };
    },
    onStateCommit: (delta) => commits.push(delta)
  });

  const dispatch = bridge.requestTriadClosureSynthesisMiss({
    missKey: 'triad:fe-cold',
    material: 'fe',
    molarMassKgPerMol: 0.055845,
    atomsPerFormula: 1,
    cohesiveEnergyEvPerAtom: 4.28,
    debyeTemperatureK: 470,
    molecularDiameterM: 2.52e-10,
    refDensityKgPerM3: 7874,
    meltTemperatureK: 1811,
    scheduleId: 'sched-1'
  });
  assert.equal(dispatch.status, 'dispatched');
  const entry = await dispatch.promise;
  assert.equal(entry.kind, 'triad-synthesis');
  assert.equal(entry.packedGpuTable.functionCount, 5);
  assert.equal(entry.g6DebyeSamples.length, 33);

  // Before schedule boundary, not adopted yet.
  assert.equal(bridge.getStatus().pendingAdoptionCount, 1);
  assert.equal(commits.length, 0);

  // Adopt at schedule boundary.
  const adoption = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 'sched-2' });
  assert.equal(adoption.adoptedCount, 1);
  assert.deepEqual(adoption.adoptedKeys, ['triad:fe-cold']);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].kind, 'triad-synthesis');
  assert.equal(commits[0].sourceFingerprint, entry.sourceFingerprint);

  // Second request hits cache.
  const cached = bridge.requestTriadClosureSynthesisMiss({
    missKey: 'triad:fe-cold',
    material: 'fe',
    molarMassKgPerMol: 0.055845,
    cohesiveEnergyEvPerAtom: 4.28,
    debyeTemperatureK: 470,
    molecularDiameterM: 2.52e-10,
    refDensityKgPerM3: 7874
  });
  assert.equal(cached.status, 'cache-hit');

  // Source change invalidates cached entry.
  assert.equal(bridge.sourceChanged('triad-test-v2'), 1);
  bridge.destroy();
});
