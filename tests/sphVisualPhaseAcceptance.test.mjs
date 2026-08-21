import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkpointRowMatches,
  coldCeilingCondensationEvidence,
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
  meanVyMPerS = 0.1,
  vySampleMassKg = massKg,
  liveParticleCount = 1,
  phaseWeightedParticleCount = liveParticleCount,
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
    meanVyMPerS,
    vySampleMassKg,
    liveParticleCount,
    phaseWeightedParticleCount,
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
  assert.equal(evidence.sustainedUpwardVelocityPassed, true);
  assert.equal(evidence.liveCarrierContinuityPassed, true);
  assert.equal(evidence.checkpointContinuityPassed, true);
  assert.equal(evidence.sameCarrierLineageProven, false);
  assert.equal(evidence.sustainedInterfaceSeparationPassed, true);
  assert.equal(evidence.tail.length, 2);
});

test('generated-cohort trajectory rejects aggregate rise caused by a new high carrier', () => {
  const selector = { materials: ['steam'], phases: ['gas'] };
  const evidence = generatedCohortTrajectoryEvidence([
    checkpoint(0, [row({ material: 'bulk', phase: 'liquid' })]),
    checkpoint(1, [row({
      material: 'steam',
      phase: 'gas',
      massKg: 1,
      yCenterM: 0.1,
      meanVyMPerS: -0.1
    })]),
    checkpoint(2, [row({
      material: 'steam',
      phase: 'gas',
      massKg: 1,
      yCenterM: 0.09,
      meanVyMPerS: -0.1
    })]),
    checkpoint(3, [row({
      material: 'steam',
      phase: 'gas',
      massKg: 2,
      yCenterM: 0.8,
      meanVyMPerS: -0.05,
      liveParticleCount: 2
    })]),
    checkpoint(4, [row({
      material: 'steam',
      phase: 'gas',
      massKg: 2,
      yCenterM: 0.9,
      meanVyMPerS: -0.02,
      liveParticleCount: 2
    })])
  ], {
    selector,
    minimumSustainedRiseM: 0.05,
    tailSampleCount: 2
  });

  assert.ok(evidence.finalRiseFromBirthM > 0.7);
  assert.equal(evidence.sustainedRisePassed, true);
  assert.equal(evidence.liveCarrierContinuityPassed, false);
  assert.equal(evidence.sustainedUpwardVelocityPassed, false);
  assert.equal(evidence.status, 'fail');
});

test('generated-cohort trajectory accepts only the same frozen GPU lineage mask', () => {
  const cohort = ({
    checkpointIndex,
    timeS,
    y,
    vy,
    mask = 'fnv1a32:abc12345'
  }) => ({
    sourceTimeS: timeS,
    totals: { massKg: 1 },
    materialPhases: [{
      material: 'h2o',
      phase: 'liquid',
      massKg: 0.9,
      yMaxM: 0.1
    }],
    generatedGasCohortCapture: {
      status: 'captured',
      checkpointIndex,
      sameCarrierLineageProven: true,
      topologyEpoch: 0,
      identityRevision: 'stable-identity'
    },
    generatedGasCohorts: [{
      schema: 'peercompute.ulg.sph-authoritative-generated-gas-cohort.v0',
      status: 'captured',
      authority: 'gpu-resident-frozen-phase-lineage-bitmask',
      sameCarrierLineageProven: true,
      material: 'h2o',
      materialId: 3061144,
      phase: 'gas',
      massKg: 0.01,
      activeGasCarrierCount: 2,
      frozenLineageCount: 3,
      frozenLineageMaskHash: mask,
      topologySignature: 'exact-phase-plan',
      formedAtCheckpointIndex: 1,
      yCenterMassWeightedM: y,
      meanVyMPerS: vy,
      vySampleMassKg: 0.01
    }]
  });
  const checkpoints = [
    cohort({ checkpointIndex: 1, timeS: 1, y: 0.2, vy: 0.1 }),
    cohort({ checkpointIndex: 2, timeS: 2, y: 0.27, vy: 0.1 }),
    cohort({ checkpointIndex: 3, timeS: 3, y: 0.29, vy: 0.1 })
  ];
  const evidence = generatedCohortTrajectoryEvidence(checkpoints, {
    selector: { materials: ['h2o'], phases: ['gas'] },
    interfaceSelector: { materials: ['h2o'], excludePhases: ['gas'] },
    minimumMassFractionOfSystem: 1e-6,
    minimumSustainedRiseM: 0.05,
    tailSampleCount: 2
  });
  assert.equal(evidence.status, 'pass');
  assert.equal(evidence.sameCarrierLineageProven, true);
  assert.equal(evidence.authority, 'gpu-resident-frozen-phase-lineage-bitmask');

  checkpoints[2].generatedGasCohorts[0].frozenLineageMaskHash =
    'fnv1a32:different';
  const changed = generatedCohortTrajectoryEvidence(checkpoints, {
    selector: { materials: ['h2o'], phases: ['gas'] },
    minimumMassFractionOfSystem: 1e-6,
    minimumSustainedRiseM: 0.05,
    tailSampleCount: 2
  });
  assert.equal(changed.status, 'fail');
  assert.equal(changed.sameCarrierLineageProven, false);
});

test('cold-ceiling condensation follows one frozen lineage while total gas keeps rising', () => {
  const cohortCheckpoint = ({
    checkpointIndex,
    totalGasKg,
    cohortMassKg,
    yCenterM,
    yMaxM,
    activeGasCarrierCount,
    mask = 'fnv1a32:coldce11'
  }) => ({
    sourceTimeS: checkpointIndex,
    totals: { massKg: 1000 },
    materialPhases: [
      row({
        material: 'h2o',
        phase: 'liquid',
        massKg: 1000 - totalGasKg,
        yCenterM: 0.1
      }),
      row({
        material: 'h2o',
        phase: 'gas',
        massKg: totalGasKg,
        yCenterM,
        yMaxM
      })
    ],
    generatedGasCohortCapture: {
      status: 'captured',
      checkpointIndex,
      sameCarrierLineageProven: true,
      topologyEpoch: 7,
      identityRevision: 'stable-cold-ceiling-lineage'
    },
    generatedGasCohorts: [{
      schema: 'peercompute.ulg.sph-authoritative-generated-gas-cohort.v0',
      status: 'captured',
      authority: 'gpu-resident-frozen-phase-lineage-bitmask',
      sameCarrierLineageProven: true,
      material: 'h2o',
      materialId: 3061144,
      phase: 'gas',
      massKg: cohortMassKg,
      activeGasCarrierCount,
      inactiveFrozenLineageCount: 7 - activeGasCarrierCount,
      frozenLineageCount: 7,
      processedFrozenLineageCount: 7,
      invalidActiveCarrierCount: 0,
      phasePurityProblemCount: 0,
      frozenLineageMaskHash: mask,
      topologySignature: 'exact-phase-plan',
      formedAtCheckpointIndex: 0,
      yCenterMassWeightedM: yCenterM,
      yMinM: Math.max(0, yCenterM - 0.1),
      yMaxM,
      meanVyMPerS: 0.1,
      vySampleMassKg: cohortMassKg
    }]
  });
  const checkpoints = [
    cohortCheckpoint({
      checkpointIndex: 0,
      totalGasKg: 10,
      cohortMassKg: 1,
      yCenterM: 0.2,
      yMaxM: 0.3,
      activeGasCarrierCount: 7
    }),
    cohortCheckpoint({
      checkpointIndex: 1,
      totalGasKg: 20,
      cohortMassKg: 4,
      yCenterM: 3.8,
      yMaxM: 4.8,
      activeGasCarrierCount: 7
    }),
    cohortCheckpoint({
      checkpointIndex: 2,
      totalGasKg: 30,
      cohortMassKg: 5,
      yCenterM: 4.8,
      yMaxM: 4.88,
      activeGasCarrierCount: 7
    }),
    cohortCheckpoint({
      checkpointIndex: 3,
      totalGasKg: 40,
      cohortMassKg: 4,
      yCenterM: 4.7,
      yMaxM: 4.88,
      activeGasCarrierCount: 6
    }),
    cohortCheckpoint({
      checkpointIndex: 4,
      totalGasKg: 50,
      cohortMassKg: 0.1,
      yCenterM: 0.5,
      yMaxM: 0.7,
      activeGasCarrierCount: 3
    })
  ];
  const options = {
    selector: { materials: ['h2o'], phases: ['gas'] },
    minimumCeilingContactYM: 4.75,
    minimumGasMassLossFraction: 0.02,
    minimumGasMassLossFractionOfSystem: 1e-6,
    minimumReturnDropM: 0.25
  };
  const evidence = coldCeilingCondensationEvidence(
    checkpoints,
    options
  );

  assert.equal(evidence.status, 'pass');
  assert.equal(evidence.ceilingContactCheckpointIndex, 1);
  assert.equal(evidence.condensedLineageCount, 1);
  assert.equal(evidence.condensation.checkpointIndex, 3);
  assert.equal(evidence.returnSample.checkpointIndex, 4);
  assert.ok(evidence.gasMassLossKg > 0.9);
  assert.ok(evidence.returnDropM > 4);

  const noContact = structuredClone(checkpoints);
  for (const entry of noContact) {
    entry.generatedGasCohorts[0].yMaxM = 4.7;
  }
  assert.equal(
    coldCeilingCondensationEvidence(noContact, options).status,
    'fail'
  );

  const noGasLaneLoss = structuredClone(checkpoints);
  for (const entry of noGasLaneLoss) {
    entry.generatedGasCohorts[0].activeGasCarrierCount = 7;
    entry.generatedGasCohorts[0].inactiveFrozenLineageCount = 0;
  }
  assert.equal(
    coldCeilingCondensationEvidence(noGasLaneLoss, options).status,
    'fail'
  );

  const changedIdentity = structuredClone(checkpoints);
  changedIdentity[3].generatedGasCohorts[0].frozenLineageMaskHash =
    'fnv1a32:different';
  assert.equal(
    coldCeilingCondensationEvidence(changedIdentity, options).status,
    'fail'
  );
});

test('generated-cohort trajectory fails closed on checkpoint gaps or incomplete velocity mass', () => {
  const selector = { materials: ['steam'], phases: ['gas'] };
  const gas = (yCenterM, overrides = {}) => row({
    material: 'steam',
    phase: 'gas',
    massKg: 1,
    yCenterM,
    meanVyMPerS: 0.1,
    ...overrides
  });
  const checkpoints = [
    checkpoint(0, [row({ material: 'bulk', phase: 'liquid' })]),
    checkpoint(1, [gas(0.1)]),
    checkpoint(2, []),
    checkpoint(3, [gas(0.2)]),
    checkpoint(4, [gas(0.3, { vySampleMassKg: 0.5 })])
  ];
  const evidence = generatedCohortTrajectoryEvidence(checkpoints, {
    selector,
    minimumSustainedRiseM: 0.05,
    tailSampleCount: 2
  });

  assert.equal(evidence.checkpointContinuityPassed, false);
  assert.equal(evidence.velocityMassCoverageComplete, false);
  assert.equal(evidence.status, 'fail');
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
