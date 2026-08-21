import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_WGSL,
  SPH_GENERATED_GAS_COHORT_SUMMARY_WORD,
  createGeneratedGasCohortSummaryWords,
  createAuthoritativeGeneratedGasCohortTracker,
  decodeGeneratedGasCohortSummary,
  hashFrozenLineageMask,
  validateFrozenGeneratedGasCohortTopology
} from '../src/runtime/sph/sphFrozenGeneratedGasCohortGpu.js';

function phaseCarrierPlan(lineageCapacity = 1368) {
  return {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity,
    primaryCapacity: lineageCapacity,
    phaseLaneCount: 4,
    phaseLaneStride: lineageCapacity,
    companionStart: lineageCapacity,
    companionCapacity: lineageCapacity * 3,
    particleCapacity: lineageCapacity * 4,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex'
  };
}

function setFloat(words, index, value) {
  words[index] = new Uint32Array(new Float32Array([value]).buffer)[0];
}

test('frozen generated-gas topology requires exact paired phase-lane identity', () => {
  assert.throws(
    () => createAuthoritativeGeneratedGasCohortTracker(),
    /requires exactly one target material/
  );
  const plan = phaseCarrierPlan();
  const ready = validateFrozenGeneratedGasCohortTopology({
    particleCount: plan.particleCapacity,
    sphPhaseCarrierPlan: plan,
    mechanicsPhaseCarrierPlan: { ...plan }
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.lineageCapacity, 1368);
  assert.equal(ready.gasLane, 2);
  assert.equal(Math.ceil(ready.lineageCapacity / 32) * 4, 172);

  const stale = validateFrozenGeneratedGasCohortTopology({
    particleCount: plan.particleCapacity,
    sphPhaseCarrierPlan: plan,
    mechanicsPhaseCarrierPlan: {
      ...plan,
      phaseLaneStride: plan.lineageCapacity + 1
    }
  });
  assert.equal(stale.ready, false);
  assert.ok(stale.blockers.includes('mechanics-phase-plan-topology-mismatch'));
  assert.ok(stale.blockers.includes('phase-plan-pair-signature-mismatch'));
});

test('tracker arms at the first pre-formation shared-slot checkpoint', async () => {
  const plan = phaseCarrierPlan(8);
  const device = {
    createBuffer() {
      throw new Error('an empty pre-formation capture must not allocate');
    },
    queue: {
      submit() {},
      writeBuffer() {}
    }
  };
  const tracker = createAuthoritativeGeneratedGasCohortTracker({
    targetMaterial: 'h2o'
  });
  const capture = ({
    sourceStep,
    sourceTimeS,
    topologyEpoch,
    identityRevision,
    sharedSlotIdentityVerified,
    materialPhases = []
  }) => tracker.capture({
    device,
    particleCount: plan.particleCapacity,
    stateStrideBytes: 32,
    thermoStrideBytes: 48,
    sphPhaseCarrierPlan: plan,
    mechanicsPhaseCarrierPlan: { ...plan },
    sharedSlotIdentityVerified,
    sourceStep,
    sourceTimeS,
    topologyEpoch,
    identityRevision,
    checkpointIndex: sourceStep,
    materialPhaseReduction: {
      totals: { massKg: 0.25 },
      materialPhases
    }
  });

  const initial = await capture({
    sourceStep: 0,
    sourceTimeS: 0,
    topologyEpoch: 0,
    identityRevision: 'initial-separate-uploads',
    sharedSlotIdentityVerified: false
  });
  assert.equal(initial.status, 'awaiting-shared-slot-lineage');
  assert.equal(initial.topologyEpoch, undefined);

  const armed = await capture({
    sourceStep: 512,
    sourceTimeS: 0.256,
    topologyEpoch: 512,
    identityRevision: 'resident-shared-slots',
    sharedSlotIdentityVerified: true
  });
  assert.equal(armed.status, 'awaiting-formation');
  assert.equal(armed.topologyEpoch, 512);
  assert.equal(armed.identityRevision, 'resident-shared-slots');

  const continuing = await capture({
    sourceStep: 1024,
    sourceTimeS: 0.512,
    topologyEpoch: 1024,
    identityRevision: 'resident-shared-slots',
    sharedSlotIdentityVerified: true
  });
  assert.equal(continuing.status, 'awaiting-formation');
  assert.equal(continuing.topologyEpoch, 512);
  assert.equal(continuing.observedTopologyEpoch, 1024);

  const stale = await capture({
    sourceStep: 1536,
    sourceTimeS: 0.768,
    topologyEpoch: 1000,
    identityRevision: 'resident-shared-slots',
    sharedSlotIdentityVerified: true
  });
  assert.equal(stale.status, 'invalidated');
  assert.equal(stale.invalidation.reason, 'topology-epoch-regressed');
});

test('frozen lineage mask fingerprint is deterministic and content-sensitive', () => {
  const mask = new Uint32Array([0, 1, 0x80000000]);
  assert.equal(hashFrozenLineageMask(mask), hashFrozenLineageMask(mask.slice()));
  const changed = mask.slice();
  changed[0] = 1;
  assert.notEqual(hashFrozenLineageMask(mask), hashFrozenLineageMask(changed));
});

test('cohort summary proves a fixed lineage identity and fails closed on impurity', () => {
  const field = SPH_GENERATED_GAS_COHORT_SUMMARY_WORD;
  const words = createGeneratedGasCohortSummaryWords();
  words[field.frozenLineageCount] = 3;
  words[field.activeGasCarrierCount] = 2;
  words[field.processedFrozenLineageCount] = 3;
  setFloat(words, field.massKg, 0.25);
  setFloat(words, field.massWeightedYKgM, 0.5);
  setFloat(words, field.massWeightedVyKgMPerS, 0.075);
  setFloat(words, field.yMinM, 1.5);
  setFloat(words, field.yMaxM, 2.5);
  setFloat(words, field.minVyMPerS, 0.2);
  setFloat(words, field.maxVyMPerS, 0.4);

  const captured = decodeGeneratedGasCohortSummary({
    words,
    material: 'h2o',
    materialId: 3061144,
    formedAtCheckpointIndex: 4,
    formedAtStep: 2048,
    formedAtTimeS: 1.024,
    frozenLineageMaskHash: 'fnv1a32:12345678',
    frozenLineageMaskByteLength: 172,
    topologySignature: 'exact-phase-plan'
  });
  assert.equal(captured.status, 'captured');
  assert.equal(captured.sameCarrierLineageProven, true);
  assert.equal(captured.frozenLineageCount, 3);
  assert.equal(captured.activeGasCarrierCount, 2);
  assert.equal(captured.inactiveFrozenLineageCount, 1);
  assert.ok(Math.abs(captured.yCenterMassWeightedM - 2) < 1e-6);
  assert.ok(Math.abs(captured.meanVyMPerS - 0.3) < 1e-6);

  words[field.phasePurityProblemCount] = 1;
  const invalid = decodeGeneratedGasCohortSummary({
    words,
    material: 'h2o',
    materialId: 3061144,
    frozenLineageMaskHash: 'fnv1a32:12345678',
    frozenLineageMaskByteLength: 172,
    topologySignature: 'exact-phase-plan'
  });
  assert.equal(invalid.status, 'invalid');
  assert.equal(invalid.sameCarrierLineageProven, false);
});

test('cohort shader freezes and reduces the exact gas lane without particle readback', () => {
  assert.match(
    SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_WGSL,
    /gas_lane \* params\.phase_lane_stride \+ lineage_index/
  );
  assert.equal(
    SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_WGSL.includes(
      'atomicOr(&lineage_mask[word_index]'
    ),
    true
  );
  assert.match(
    SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_WGSL,
    /fn reduce_main/
  );
});
