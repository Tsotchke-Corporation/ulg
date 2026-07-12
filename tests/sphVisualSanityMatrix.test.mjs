import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  deterministicRandomPairScenarios,
  evaluateStandardScenarioBehavior,
  selectedScenarios,
  standardGpuTimestampEvidence
} from '../scripts/sph-visual-sanity-matrix.mjs';

function checkpoint({
  batchIndex,
  reactantMassKg = 10,
  productMassKg = 0,
  phaseFractionResidualAbsKg = 0,
  unclassifiedMassKg = 0,
  overflowMassKg = 0,
  materialPhaseCapacityStatus = 'within-capacity',
  materialMappingStatus = 'complete'
}) {
  const materialPhases = [
    {
      material: 'Ba',
      phase: 'solid',
      massKg: reactantMassKg / 2,
      phaseWeightedParticleCount: 5,
      temperatureMinK: 300,
      temperatureMaxK: 300,
      temperatureMassWeightedMeanK: 300,
      yCenterMassWeightedM: 1
    },
    {
      material: 'Pb',
      phase: 'solid',
      massKg: reactantMassKg / 2,
      phaseWeightedParticleCount: 5,
      temperatureMinK: 300,
      temperatureMaxK: 300,
      temperatureMassWeightedMeanK: 300,
      yCenterMassWeightedM: 0.5
    }
  ];
  if (productMassKg > 0) {
    materialPhases.push({
      material: 'bapb-product',
      phase: 'solid',
      massKg: productMassKg,
      phaseWeightedParticleCount: 1,
      temperatureMinK: 300,
      temperatureMaxK: 300,
      temperatureMassWeightedMeanK: 300,
      yCenterMassWeightedM: 0.75
    });
  }
  return {
    schema: 'peercompute.ulg.sph-authoritative-gpu-material-phase-checkpoint.v1',
    status: 'captured',
    phase: batchIndex === 0 ? 'initial' : 'resident-batch',
    batchIndex,
    sourceTimeS: batchIndex,
    liveParticleCount: 10,
    invalidMassParticleCount: 0,
    materialPhaseCapacityStatus,
    materialMappingStatus,
    phaseFractionResidualAbsKg,
    unclassifiedMassKg,
    overflowMassKg,
    totals: { massKg: reactantMassKg + productMassKg },
    materialPhases
  };
}

function randomPairProbe({ reactionEventsTotal = 0, productMassKg = 0, checkpointPatch = {} } = {}) {
  return {
    timeline: {
      metrics: [0, 1].map((batchIndex) => ({
        batchIndex,
        authoritativeGpuCheckpoint: checkpoint({
          batchIndex,
          reactantMassKg: 10 - productMassKg,
          productMassKg,
          ...checkpointPatch
        }),
        residentStep: { reactionEventsTotal }
      }))
    }
  };
}

function randomPairReactionCheck(probe) {
  const behavior = evaluateStandardScenarioBehavior({
    label: 'random-elements-ba-pb',
    standardEnabled: true,
    randomPair: { drop: 'Ba', base: 'Pb' }
  }, probe);
  return behavior.checks.find((check) => (
    check.id === 'random-reaction-product-residual-evidence'
  ));
}

test('deterministic random pairs exist before label filtering', () => {
  const options = { count: 4, rawSeed: 0x7a11d2026 };
  const first = deterministicRandomPairScenarios(options);
  const second = deterministicRandomPairScenarios(options);
  assert.deepEqual(second, first);
  assert.equal(first.length, 4);

  const wanted = first[2];
  const filtered = selectedScenarios({
    filter: wanted.label,
    standard: false,
    randomPairCount: options.count,
    randomSeed: options.rawSeed
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].label, wanted.label);
  assert.deepEqual(filtered[0].randomPair, wanted.randomPair);
});

test('reported random-pair reactions require admitted product and residual evidence', () => {
  assert.equal(randomPairReactionCheck(randomPairProbe()).status, 'pass');

  const admittedReaction = randomPairReactionCheck(randomPairProbe({
    reactionEventsTotal: 1,
    productMassKg: 0.25
  }));
  assert.equal(admittedReaction.status, 'pass');
  assert.equal(admittedReaction.observed.reactionReported, true);
  assert.equal(admittedReaction.observed.residualEvidence.length, 2);

  const missingProduct = randomPairReactionCheck(randomPairProbe({ reactionEventsTotal: 1 }));
  assert.equal(missingProduct.status, 'fail');

  const invalidResidual = randomPairReactionCheck(randomPairProbe({
    reactionEventsTotal: 1,
    productMassKg: 0.25,
    checkpointPatch: { phaseFractionResidualAbsKg: Number.NaN }
  }));
  assert.equal(invalidResidual.status, 'fail');
  assert.equal(invalidResidual.observed.residualEvidence[0].finite, false);

  const unadmitted = randomPairReactionCheck(randomPairProbe({
    reactionEventsTotal: 1,
    productMassKg: 0.25,
    checkpointPatch: { materialMappingStatus: 'incomplete' }
  }));
  assert.equal(unadmitted.status, 'fail');
});

test('standard timestamp evidence preserves unsupported status and accepts real spans', () => {
  assert.equal(standardGpuTimestampEvidence({}, { requested: false }).status, 'not-requested');

  const unsupported = standardGpuTimestampEvidence({
    timeline: {
      metrics: [{
        residentStep: {
          stageTiming: {
            gpuTimestampRequested: true,
            gpuTimestampStatus: 'unsupported',
            gpuTimestampProfile: { status: 'unsupported', validSpanCount: 0 }
          }
        }
      }]
    }
  }, { requested: true });
  assert.equal(unsupported.status, 'inconclusive-unsupported');
  assert.equal(unsupported.requestedObserved, true);

  const complete = standardGpuTimestampEvidence({
    timeline: {
      metrics: [{
        residentStep: {
          stageTiming: {
            gpuTimestampRequested: true,
            gpuTimestampStatus: 'timestamp-profile-complete',
            gpuTimestampProfile: {
              status: 'timestamp-profile-complete',
              validSpanCount: 2
            }
          }
        }
      }]
    }
  }, { requested: true });
  assert.equal(complete.status, 'pass');
  assert.equal(complete.validSpanCount, 2);
});

test('standard visual package script requests GPU profiling', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(packageJson.scripts['test:sph-standard-visual'], /ULG_PROBE_GPU_PROFILE=1/);
});
