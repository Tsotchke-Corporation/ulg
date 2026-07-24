import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkpointRowMatches,
  condensedLaunchEvidence,
  generatedCohortTrajectoryEvidence,
  phaseAwareVolumeRatioEvidence
} from '../scripts/sph-visual-phase-acceptance.mjs';

function row({
  material = 'arbitrary',
  phase = 'solid',
  massKg = 1,
  yCenterM = 0,
  yMaxM = yCenterM,
  kineticEnergyJ = 0,
  minJ = 1,
  maxJ = 1,
  mechanicsSampleCount = 1,
  mechanicsProblemParticleCount = 0
} = {}) {
  return {
    material,
    phase,
    massKg,
    yCenterMassWeightedM: yCenterM,
    yMaxM,
    kineticEnergyJ,
    minVolumeRatioJ: minJ,
    maxVolumeRatioJ: maxJ,
    mechanicsSampleCount,
    mechanicsProblemParticleCount
  };
}

function checkpoint(sourceTimeS, materialPhases = []) {
  return { sourceTimeS, materialPhases };
}

test('phase-aware J evidence admits the gas floor without weakening condensed bounds', () => {
  const evidence = phaseAwareVolumeRatioEvidence([
    checkpoint(0, [
      row({ material: 'alpha', phase: 'solid', minJ: 0.98, maxJ: 1.02 }),
      row({ material: 'beta', phase: 'gas', minJ: 0.1, maxJ: 12 })
    ]),
    checkpoint(1, [
      row({ material: 'alpha', phase: 'liquid', minJ: 0.95, maxJ: 1.05 }),
      row({ material: 'beta', phase: 'gas', minJ: 0.1, maxJ: 30 })
    ])
  ]);

  assert.equal(evidence.status, 'pass');
  assert.equal(evidence.condensed.status, 'pass');
  assert.equal(evidence.gas.status, 'pass');
  assert.equal(evidence.gasFloorTelemetry.hitCheckpointCount, 2);
  assert.equal(evidence.gasFloorTelemetry.maximumConsecutiveHitCheckpoints, 2);
});

test('phase-aware J evidence reports condensed collapse and illegal gas separately', () => {
  const condensedFailure = phaseAwareVolumeRatioEvidence([
    checkpoint(0, [
      row({ material: 'gamma', phase: 'liquid', minJ: 0.19, maxJ: 1 }),
      row({ material: 'delta', phase: 'gas', minJ: 0.1, maxJ: 1000 })
    ])
  ]);
  assert.equal(condensedFailure.status, 'fail');
  assert.equal(condensedFailure.condensed.status, 'fail');
  assert.equal(condensedFailure.gas.status, 'pass');

  const gasFailure = phaseAwareVolumeRatioEvidence([
    checkpoint(0, [
      row({ material: 'gamma', phase: 'solid', minJ: 1, maxJ: 1 }),
      row({ material: 'delta', phase: 'gas', minJ: 0.09, maxJ: 1 })
    ])
  ]);
  assert.equal(gasFailure.status, 'fail');
  assert.equal(gasFailure.condensed.status, 'pass');
  assert.equal(gasFailure.gas.status, 'fail');

  const missingMechanics = phaseAwareVolumeRatioEvidence([
    checkpoint(0, [
      row({ material: 'gamma', phase: 'solid', mechanicsSampleCount: 0 })
    ])
  ]);
  assert.equal(missingMechanics.status, 'fail');
  assert.equal(missingMechanics.condensed.violations[0].mechanicsSampleCount, 0);
});

test('generated-cohort trajectory rejects no formation and a peak followed by sinking', () => {
  const selector = { materials: ['product-x'], phases: ['gas'] };
  const missing = generatedCohortTrajectoryEvidence([
    checkpoint(0, [row({ material: 'carrier', phase: 'liquid' })]),
    checkpoint(1, [row({ material: 'carrier', phase: 'liquid' })])
  ], { selector });
  assert.equal(missing.status, 'missing');
  assert.equal(missing.formed, false);

  const sinking = generatedCohortTrajectoryEvidence([
    checkpoint(0, [row({ material: 'carrier', phase: 'liquid', yMaxM: 0.8 })]),
    checkpoint(1, [row({ material: 'product-x', phase: 'gas', yCenterM: 1 })]),
    checkpoint(2, [row({ material: 'product-x', phase: 'gas', yCenterM: 1.2 })]),
    checkpoint(3, [row({ material: 'product-x', phase: 'gas', yCenterM: 0.96 })]),
    checkpoint(4, [row({ material: 'product-x', phase: 'gas', yCenterM: 0.94 })])
  ], {
    selector,
    minimumSustainedRiseM: 0.05,
    tailSampleCount: 2
  });
  assert.equal(sinking.formed, true);
  assert.ok(sinking.peakRiseFromBirthM > 0.19);
  assert.equal(sinking.sustainedRisePassed, false);
  assert.equal(sinking.status, 'fail');
});

test('generated-cohort trajectory rejects trace phase residue relative to represented system mass', () => {
  const traceGas = row({
    material: 'vapor-trace',
    phase: 'gas',
    massKg: 5e-7,
    yCenterM: 1
  });
  const bulk = row({ material: 'bulk', phase: 'liquid', massKg: 1 });
  const evidence = generatedCohortTrajectoryEvidence([
    checkpoint(0, [bulk]),
    checkpoint(1, [bulk, traceGas]),
    checkpoint(2, [bulk, traceGas]),
    checkpoint(3, [bulk, traceGas])
  ], {
    selector: { materials: ['vapor-trace'], phases: ['gas'] },
    minimumMassFractionOfSystem: 1e-6,
    tailSampleCount: 2
  });

  assert.equal(evidence.status, 'missing');
  assert.equal(evidence.formed, false);
  assert.equal(evidence.systemReferenceMassKg, 1.0000005);
  assert.ok(evidence.minimumMassKg > traceGas.massKg);
});

test('generated-cohort trajectory keeps material populations above the relative mass floor', () => {
  const bulk = row({ material: 'bulk', phase: 'solid', massKg: 1000 });
  const gas = (yCenterM) => row({
    material: 'vapor-material',
    phase: 'gas',
    massKg: 0.01,
    yCenterM
  });
  const evidence = generatedCohortTrajectoryEvidence([
    checkpoint(0, [bulk]),
    checkpoint(1, [bulk, gas(1)]),
    checkpoint(2, [bulk, gas(1.1)]),
    checkpoint(3, [bulk, gas(1.12)])
  ], {
    selector: { materials: ['vapor-material'], phases: ['gas'] },
    minimumMassFractionOfSystem: 1e-6,
    minimumSustainedRiseM: 0.05,
    tailSampleCount: 2
  });

  assert.equal(evidence.status, 'pass');
  assert.equal(evidence.formed, true);
  assert.equal(evidence.samples.length, 3);
});

test('generated-cohort trajectory requires a sustained tail and can track an interface', () => {
  const gas = (yCenterM) => row({ material: 'vapor-z', phase: 'gas', yCenterM });
  const carrier = row({ material: 'carrier-q', phase: 'liquid', yCenterM: 0.5, yMaxM: 0.9 });
  const evidence = generatedCohortTrajectoryEvidence([
    checkpoint(0, [carrier]),
    checkpoint(1, [carrier, gas(1)]),
    checkpoint(2, [carrier, gas(1.03)]),
    checkpoint(3, [carrier, gas(1.08)]),
    checkpoint(4, [carrier, gas(1.1)])
  ], {
    selector: { materials: ['vapor-z'], phases: ['gas'] },
    interfaceSelector: { materials: ['carrier-q'], excludePhases: ['gas'] },
    minimumSustainedRiseM: 0.05,
    minimumSustainedInterfaceSeparationM: 0.1,
    tailSampleCount: 2
  });

  assert.equal(evidence.status, 'pass');
  assert.equal(evidence.sustainedRisePassed, true);
  assert.equal(evidence.sustainedInterfaceSeparationPassed, true);
  assert.equal(evidence.tail.length, 2);
});

test('condensed launch evidence detects a rebound from the prior settled minimum', () => {
  const condensed = (yCenterM, kineticEnergyJ = 0) => row({
    material: 'body-r',
    phase: 'solid',
    massKg: 10,
    yCenterM,
    kineticEnergyJ
  });
  const launched = condensedLaunchEvidence([
    checkpoint(0, [condensed(2)]),
    checkpoint(1, [condensed(1.2)]),
    checkpoint(2, [condensed(1)]),
    checkpoint(3, [condensed(1.25, 2)]),
    checkpoint(4, [condensed(1.8, 8)])
  ], { maxUpwardExcursionM: 0.35 });
  assert.equal(launched.status, 'fail');
  assert.ok(Math.abs(launched.maximumUpwardExcursionM - 0.8) < 1e-12);
  assert.equal(launched.peakExcursion.minimum.yCenterM, 1);

  const settling = condensedLaunchEvidence([
    checkpoint(0, [condensed(2)]),
    checkpoint(1, [condensed(1.8)]),
    checkpoint(2, [condensed(1.6)]),
    checkpoint(3, [condensed(1.5)])
  ], { maxUpwardExcursionM: 0.35 });
  assert.equal(settling.status, 'pass');
  assert.equal(settling.maximumUpwardExcursionM, 0);
});

test('row selectors are generic and case-insensitive', () => {
  const candidate = row({ material: 'Synthetic-42', phase: 'GAS', massKg: 0.25 });
  assert.equal(checkpointRowMatches(candidate, {
    materials: ['synthetic-42'],
    phases: ['gas'],
    minimumMassKg: 0.2
  }), true);
  assert.equal(checkpointRowMatches(candidate, { excludePhases: ['gas'] }), false);
});
