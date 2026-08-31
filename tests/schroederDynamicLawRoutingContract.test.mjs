import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
  SCHROEDER_DYNAMIC_LAW_ROUTING_DEFAULT_POLICY,
  SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE,
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICIES,
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE,
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_DISABLED,
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_SHADOW,
  SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY,
  SCHROEDER_REACTION_ACTIVATION_POLICY_AUTHORITATIVE,
  SCHROEDER_REACTION_ACTIVATION_POLICY_DISABLED,
  SCHROEDER_REACTION_ACTIVATION_POLICY_SHADOW,
  exactSchroederDynamicLawRoutingPolicy,
  normalizeSchroederReactionActivationPolicy
} from '../src/runtime/sph/schroederDynamicLawRoutingContract.js';
import {
  SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_REVISION,
  SCHROEDER_TARGET_SCHEDULE_EXECUTION_GATE,
  SCHROEDER_TARGET_SCHEDULE_REQUEST_REVISION,
  ULG_SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_SCHEMA,
  ULG_SCHROEDER_TARGET_SCHEDULE_AUTHORITY_SCHEMA,
  createSchroederTargetScheduleAuthority,
  createSchroederTargetScheduleConfiguration,
  createSchroederTargetScheduleProviderAuthority,
  exactSchroederProspectiveDynamicLawTransition,
  exactSchroederTargetScheduleAuthority,
  schroederTargetScheduleSuccessorReactionExecutionRequired,
  validateSchroederTargetScheduleConfigurationContinuity
} from '../src/runtime/sph/schroederTargetScheduleAuthority.js';
import {
  ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA,
  ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA,
  WORKER_DYNAMIC_LAW_OBSERVATION_FAILURE_POLICY,
  exactWorkerDynamicLawObservationSelf
} from '../src/runtime/sph/schroederWorkerScheduleRouteEvidence.js';
import {
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE,
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION
} from '../src/runtime/sph/sphReactionMotionEnvelope.js';
import {
  SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT,
  SPH_GPU_REACTION_HEADER_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_RECORD_ROW_LAYOUT,
  ULG_REACTION_CLOSURE_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../ulg-gpu-abi/src/index.js';

const ENABLED_GATE =
  'enabled-on-serialized-scene-worker-lane-after-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers';
const LANE_ID = 'lane:dynamic-law-contract';
const STATE_KEY = 'state:dynamic-law-contract';
const PARTICLE_COUNT = 64;
const SOURCE_LINEAGE = Object.freeze({
  storageGeneration: 11,
  physicsTick: 13,
  physicsSubstep: 0,
  positionEpoch: 17,
  topologyEpoch: 19,
  chartEpoch: 23,
  levelEpoch: 29,
  supportEpoch: 31
});
const TERMINAL_LINEAGE = Object.freeze({
  ...SOURCE_LINEAGE,
  storageGeneration: 12,
  physicsTick: 14,
  positionEpoch: 18
});
const PROVIDER = createSchroederTargetScheduleProviderAuthority({
  kind: 'none'
});
const COMMON_CONFIGURATION = Object.freeze({
  maxFutureSubsteps: 2,
  dtS: 0.001,
  gridSpacingM: 0.25,
  cflFactor: 0.4,
  boxDimsM: Object.freeze([5, 5, 5])
});

function reactionTableFixture() {
  const records = new Float32Array([
    1, 2, 3, 300,
    0, 0.1, 0, 0,
    1, 0, 0, 0
  ]);
  const reactionHeaders = new Float32Array(
    SPH_GPU_REACTION_HEADER_ROW_LAYOUT.length
  );
  const reactantTermRecords = new Float32Array(0);
  const productTermRecords = new Float32Array(0);
  const gasProductRecords = new Float32Array(0);
  const atomTermRecords = new Float32Array(0);
  const productPhaseRecords = new Float32Array(0);
  const combinedRecords = new Float32Array([
    ...records,
    ...productPhaseRecords,
    ...reactionHeaders,
    ...reactantTermRecords,
    ...productTermRecords,
    ...gasProductRecords,
    ...atomTermRecords
  ]);
  return {
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionClosureSchema: ULG_REACTION_CLOSURE_SCHEMA,
    status: 'derived-reaction-table-ready',
    reactionCount: 1,
    reactionHeaderCount: 1,
    reactantTermCount: 0,
    productTermCount: 0,
    gasProductCount: 0,
    atomTermCount: 0,
    productPhaseCount: 0,
    combinedRecordCount: combinedRecords.length / 4,
    recordLayout: [...SPH_GPU_REACTION_RECORD_ROW_LAYOUT],
    reactionHeaderLayout: [...SPH_GPU_REACTION_HEADER_ROW_LAYOUT],
    reactantTermLayout: [...SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT],
    productTermLayout: [...SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT],
    gasProductLayout: [...SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT],
    atomTermLayout: [...SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT],
    productPhaseLayout: [...SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT],
    recordStrideFloats: SPH_GPU_REACTION_RECORD_ROW_LAYOUT.length,
    reactionHeaderStrideFloats:
      SPH_GPU_REACTION_HEADER_ROW_LAYOUT.length,
    reactantTermStrideFloats:
      SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT.length,
    productTermStrideFloats:
      SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT.length,
    gasProductStrideFloats:
      SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT.length,
    atomTermStrideFloats: SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT.length,
    productPhaseStrideFloats:
      SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT.length,
    records,
    reactionHeaders,
    reactantTermRecords,
    productTermRecords,
    gasProductRecords,
    atomTermRecords,
    productPhaseRecords,
    combinedRecords
  };
}

const REACTION_TABLE = reactionTableFixture();

function residentStepOptions(reactionActive) {
  return {
    ambientPressurePa: 0,
    contactSolverEnabled: false,
    ...(reactionActive
      ? { reactionTable: REACTION_TABLE }
      : { reactionActivationWatchTable: REACTION_TABLE })
  };
}

function targetConfiguration(reactionActive) {
  return createSchroederTargetScheduleConfiguration({
    ...COMMON_CONFIGURATION,
    residentStepOptions: residentStepOptions(reactionActive),
    scheduleStepOptionsProvider: PROVIDER
  });
}

function targetAuthority({
  sourceScheduleId,
  targetScheduleRequestId,
  sourceLineage = SOURCE_LINEAGE,
  reactionActive = false,
  presealReactionActivation = false,
  predecessorTargetScheduleAuthority = null,
  predecessorDynamicLawObservation = null
}) {
  return createSchroederTargetScheduleAuthority({
    sourceScheduleId,
    targetScheduleRequestId,
    laneId: LANE_ID,
    stateKey: STATE_KEY,
    sourceLineage,
    sourceParticleCount: PARTICLE_COUNT,
    sourcePhaseLaneCount: 1,
    predecessorTargetScheduleAuthority,
    predecessorDynamicLawObservation,
    prospectiveTargetConfiguration: presealReactionActivation
      ? targetConfiguration(true)
      : null,
    ...COMMON_CONFIGURATION,
    residentStepOptions: residentStepOptions(reactionActive),
    scheduleStepOptionsProvider: PROVIDER
  });
}

function prospectiveWriterEvidence({
  gasBoundaryActionable = false,
  terminalGpuFenceSatisfied = true,
  scheduleCancelled = false
} = {}) {
  if (gasBoundaryActionable) {
    const productEventRowCount = 8;
    const arenaIdentity = {
      schema:
        'peercompute.ulg.sph-resident-product-history-arena-identity.v0',
      status: 'retained-product-history-arena-authenticated',
      slotId: 3,
      leaseSerial: 11,
      viewOrdinal: 7,
      rowCapacity: productEventRowCount,
      bufferByteLength: productEventRowCount * 80,
      rowStrideFloats: 20,
      countAuthorityGeneration: 19,
      countAuthoritySeal: 0x5a17_c0de
    };
    return {
      schema: ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA,
      status: 'worker-retained-product-gas-boundary-actionable',
      gasBoundaryActionable: true,
      source: 'worker-retained-product-event-buffer',
      productEventBufferRetained: true,
      productEventRowCount,
      productHistoryArenaIdentity: arenaIdentity,
      productHistoryLiveBoundObservation: {
        schema:
          'peercompute.ulg.sph-product-history-live-bound-observation.v0',
        observedLiveRowCount: 0,
        previousUpperBound: productEventRowCount,
        tightenedUpperBound: 1,
        arenaRowCapacity: productEventRowCount,
        readbackByteLength: Uint32Array.BYTES_PER_ELEMENT,
        arenaIdentity: structuredClone(arenaIdentity)
      },
      terminalGpuFenceSatisfied,
      scheduleCancelled
    };
  }
  return {
    schema: ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA,
    status: 'worker-retained-product-gas-boundary-inactive',
    gasBoundaryActionable: false,
    source: null,
    productEventBufferRetained: false,
    productEventRowCount: 0,
    productHistoryArenaIdentity: null,
    productHistoryLiveBoundObservation: null,
    terminalGpuFenceSatisfied,
    scheduleCancelled
  };
}

function dynamicLawObservation(authority, {
  triggeredSourceCount = 0,
  uncertainty = false,
  retainedProductGasBoundaryActionable = false,
  terminalGpuFenceSatisfied = true,
  scheduleCancelled = false,
  failureReason = 'gpu-reaction-activation-evidence-fail-closed'
} = {}) {
  const observationSucceeded = uncertainty !== true;
  const observation = {
    schema: ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA,
    status: observationSucceeded
      ? 'dynamic-law-routing-observation-ready'
      : 'dynamic-law-routing-observation-uncertain',
    sourceScheduleId: authority.sourceScheduleId,
    targetScheduleRequestId: authority.targetScheduleRequestId,
    targetScheduleAuthorityFingerprint: authority.requestFingerprint,
    laneId: authority.laneId,
    stateKey: authority.stateKey,
    lawFamily: 'reaction',
    predicateRevision: SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION,
    predicate: SPH_REACTION_MOTION_ENVELOPE_PREDICATE,
    producerRoute: 'tier0-fused-resident-sequence',
    sampleStage: 'tier0-terminal-post-separation-motion-envelope',
    nodeDomain: 'fixed-phase-carrier-slot',
    motionEnvelope: authority.motionEnvelope,
    shadowOnly: SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY,
    routingAuthority: SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
    executionGating: SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE,
    observationSucceeded,
    triggered: uncertainty || triggeredSourceCount > 0,
    triggeredSourceCount: observationSucceeded ? triggeredSourceCount : null,
    uncertainty,
    rawEvidenceWord: observationSucceeded
      ? triggeredSourceCount
      : 0xffff_ffff,
    particleCount: PARTICLE_COUNT,
    reactionCount: authority.tableFingerprints.watchReactionCount,
    reactionTableFingerprint:
      authority.tableFingerprints.watchReactionTableFingerprint,
    prospectiveWriterEvidence: prospectiveWriterEvidence({
      gasBoundaryActionable: retainedProductGasBoundaryActionable,
      terminalGpuFenceSatisfied,
      scheduleCancelled
    }),
    mapAsyncCount: 1,
    readbackByteLength: Uint32Array.BYTES_PER_ELEMENT,
    fullParticleReadbackPerformed: false,
    terminalLineage: { ...TERMINAL_LINEAGE },
    failureReason: observationSucceeded ? null : failureReason,
    failurePolicy: WORKER_DYNAMIC_LAW_OBSERVATION_FAILURE_POLICY
  };
  assert.equal(exactWorkerDynamicLawObservationSelf(observation), observation);
  return observation;
}

function successorAuthority(predecessor, observation, reactionActive) {
  return targetAuthority({
    sourceScheduleId: predecessor.targetScheduleRequestId,
    targetScheduleRequestId: `${predecessor.targetScheduleRequestId}:next`,
    sourceLineage: TERMINAL_LINEAGE,
    reactionActive,
    predecessorTargetScheduleAuthority: predecessor,
    predecessorDynamicLawObservation: observation
  });
}

test('dynamic-law routing contract exposes one enabled composite tuple and exact tri-state policy', () => {
  assert.equal(SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY, false);
  assert.equal(SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY, true);
  assert.equal(SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE, ENABLED_GATE);
  assert.equal(SCHROEDER_TARGET_SCHEDULE_EXECUTION_GATE, ENABLED_GATE);
  assert.deepEqual(SCHROEDER_DYNAMIC_LAW_ROUTING_POLICIES, [
    'disabled',
    'shadow',
    'authoritative'
  ]);
  assert.equal(SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_DISABLED, 'disabled');
  assert.equal(SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_SHADOW, 'shadow');
  assert.equal(
    SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE,
    'authoritative'
  );
  assert.equal(SCHROEDER_REACTION_ACTIVATION_POLICY_DISABLED, 'disabled');
  assert.equal(SCHROEDER_REACTION_ACTIVATION_POLICY_SHADOW, 'shadow');
  assert.equal(
    SCHROEDER_REACTION_ACTIVATION_POLICY_AUTHORITATIVE,
    'authoritative'
  );
  assert.equal(SCHROEDER_DYNAMIC_LAW_ROUTING_DEFAULT_POLICY, 'shadow');
  assert.equal(exactSchroederDynamicLawRoutingPolicy('disabled'), 'disabled');
  assert.equal(exactSchroederDynamicLawRoutingPolicy(' shadow '), null);
  assert.equal(normalizeSchroederReactionActivationPolicy('authoritative'),
    'authoritative');
  assert.equal(normalizeSchroederReactionActivationPolicy('invalid'), 'shadow');
  assert.equal(normalizeSchroederReactionActivationPolicy(
    'invalid',
    SCHROEDER_REACTION_ACTIVATION_POLICY_DISABLED
  ), 'disabled');
});

test('target authority accepts one exact precomputed configuration without re-deriving it', () => {
  const rawAuthority = targetAuthority({
    sourceScheduleId: 'schedule:precomputed-source',
    targetScheduleRequestId: 'schedule:precomputed-target'
  });
  const configuration = targetConfiguration(false);
  const precomputedAuthority = createSchroederTargetScheduleAuthority({
    sourceScheduleId: 'schedule:precomputed-source',
    targetScheduleRequestId: 'schedule:precomputed-target',
    laneId: LANE_ID,
    stateKey: STATE_KEY,
    sourceLineage: SOURCE_LINEAGE,
    sourceParticleCount: PARTICLE_COUNT,
    sourcePhaseLaneCount: 1,
    currentTargetConfiguration: configuration
  });

  assert.equal(
    precomputedAuthority.requestFingerprint,
    rawAuthority.requestFingerprint
  );
  assert.deepEqual(
    precomputedAuthority.motionEnvelope,
    rawAuthority.motionEnvelope
  );
  assert.throws(() => createSchroederTargetScheduleAuthority({
    sourceScheduleId: 'schedule:mixed-source',
    targetScheduleRequestId: 'schedule:mixed-target',
    laneId: LANE_ID,
    stateKey: STATE_KEY,
    sourceLineage: SOURCE_LINEAGE,
    sourceParticleCount: PARTICLE_COUNT,
    sourcePhaseLaneCount: 1,
    currentTargetConfiguration: configuration,
    ...COMMON_CONFIGURATION,
    residentStepOptions: residentStepOptions(false),
    scheduleStepOptionsProvider: PROVIDER
  }), /mutually exclusive/);
});

test('precomputed configuration preserves dormant-to-active reaction continuity', () => {
  const predecessor = targetAuthority({
    sourceScheduleId: 'schedule:precomputed-dormant-source',
    targetScheduleRequestId: 'schedule:precomputed-dormant-target',
    presealReactionActivation: true
  });
  const observation = dynamicLawObservation(predecessor, {
    triggeredSourceCount: 1
  });
  const successor = createSchroederTargetScheduleAuthority({
    sourceScheduleId: predecessor.targetScheduleRequestId,
    targetScheduleRequestId: 'schedule:precomputed-active-target',
    laneId: LANE_ID,
    stateKey: STATE_KEY,
    sourceLineage: TERMINAL_LINEAGE,
    sourceParticleCount: PARTICLE_COUNT,
    sourcePhaseLaneCount: 1,
    predecessorTargetScheduleAuthority: predecessor,
    predecessorDynamicLawObservation: observation,
    currentTargetConfiguration: targetConfiguration(true)
  });

  assert.equal(successor.writerSet.reaction, true);
  assert.equal(
    validateSchroederTargetScheduleConfigurationContinuity({
      predecessorTargetScheduleAuthority: predecessor,
      currentTargetScheduleAuthority: successor,
      predecessorDynamicLawObservation: observation
    }).mode,
    'prospective-reaction-dormant-to-executing'
  );
});

test('precomputed gas actionability stays fail-closed without rejecting static gas writers', () => {
  const gasInactive = targetConfiguration(true);
  assert.equal(gasInactive.writerSet.gasBoundaryActionable, false);
  const retainedGasActive = createSchroederTargetScheduleConfiguration({
    ...COMMON_CONFIGURATION,
    residentStepOptions: residentStepOptions(true),
    scheduleStepOptionsProvider: PROVIDER,
    retainedProductGasBoundaryActionable: true
  });
  const predecessor = createSchroederTargetScheduleAuthority({
    sourceScheduleId: 'schedule:precomputed-gas-predecessor-source',
    targetScheduleRequestId: 'schedule:precomputed-gas-predecessor-target',
    laneId: LANE_ID,
    stateKey: STATE_KEY,
    sourceLineage: SOURCE_LINEAGE,
    sourceParticleCount: PARTICLE_COUNT,
    sourcePhaseLaneCount: 1,
    prospectiveTargetConfiguration: retainedGasActive,
    ...COMMON_CONFIGURATION,
    residentStepOptions: residentStepOptions(true),
    scheduleStepOptionsProvider: PROVIDER
  });
  const observation = dynamicLawObservation(predecessor, {
    retainedProductGasBoundaryActionable: true
  });
  assert.throws(() => createSchroederTargetScheduleAuthority({
    sourceScheduleId: predecessor.targetScheduleRequestId,
    targetScheduleRequestId: 'schedule:precomputed-gas-target',
    laneId: LANE_ID,
    stateKey: STATE_KEY,
    sourceLineage: TERMINAL_LINEAGE,
    sourceParticleCount: PARTICLE_COUNT,
    sourcePhaseLaneCount: 1,
    predecessorTargetScheduleAuthority: predecessor,
    predecessorDynamicLawObservation: observation,
    currentTargetConfiguration: gasInactive
  }), /gas-boundary actionability does not match predecessor authority/);

  const retainedGasAuthority = createSchroederTargetScheduleAuthority({
    sourceScheduleId: predecessor.targetScheduleRequestId,
    targetScheduleRequestId: 'schedule:precomputed-retained-gas-target',
    laneId: LANE_ID,
    stateKey: STATE_KEY,
    sourceLineage: TERMINAL_LINEAGE,
    sourceParticleCount: PARTICLE_COUNT,
    sourcePhaseLaneCount: 1,
    predecessorTargetScheduleAuthority: predecessor,
    predecessorDynamicLawObservation: observation,
    currentTargetConfiguration: retainedGasActive
  });
  assert.equal(retainedGasAuthority.writerSet.gasBoundaryActionable, true);
  assert.equal(
    validateSchroederTargetScheduleConfigurationContinuity({
      predecessorTargetScheduleAuthority: predecessor,
      currentTargetScheduleAuthority: retainedGasAuthority,
      predecessorDynamicLawObservation: observation
    }).mode,
    'prospective-retained-product-gas-boundary-actionable'
  );

  const externalGaugeGasActive = createSchroederTargetScheduleConfiguration({
    ...COMMON_CONFIGURATION,
    residentStepOptions: {
      ...residentStepOptions(true),
      externalGaugePressureEnabled: true
    },
    scheduleStepOptionsProvider: PROVIDER
  });
  const externalGaugeAuthority = createSchroederTargetScheduleAuthority({
    sourceScheduleId: 'schedule:precomputed-external-gauge-source',
    targetScheduleRequestId: 'schedule:precomputed-external-gauge-target',
    laneId: LANE_ID,
    stateKey: STATE_KEY,
    sourceLineage: SOURCE_LINEAGE,
    sourceParticleCount: PARTICLE_COUNT,
    sourcePhaseLaneCount: 1,
    currentTargetConfiguration: externalGaugeGasActive,
    retainedProductGasBoundaryActionable: false
  });
  assert.equal(externalGaugeAuthority.writerSet.gasBoundaryActionable, true);
});

test('precomputed configuration rejects a structurally tampered receipt', () => {
  const tampered = structuredClone(targetConfiguration(false));
  tampered.motionEnvelope.dtS *= 2;
  assert.throws(() => createSchroederTargetScheduleAuthority({
    sourceScheduleId: 'schedule:precomputed-tampered-source',
    targetScheduleRequestId: 'schedule:precomputed-tampered-target',
    laneId: LANE_ID,
    stateKey: STATE_KEY,
    sourceLineage: SOURCE_LINEAGE,
    sourceParticleCount: PARTICLE_COUNT,
    sourcePhaseLaneCount: 1,
    currentTargetConfiguration: tampered
  }), /must be an exact target schedule configuration/);
});

test('target authority and prospective transition reject every legacy disabled tuple', () => {
  const authority = targetAuthority({
    sourceScheduleId: 'schedule:legacy-source',
    targetScheduleRequestId: 'schedule:legacy-target',
    presealReactionActivation: true
  });
  const transition = authority.prospectiveDynamicLawTransition;
  assert.equal(ULG_SCHROEDER_TARGET_SCHEDULE_AUTHORITY_SCHEMA,
    'peercompute.ulg.schroeder-target-schedule-authority.v5');
  assert.equal(ULG_SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_SCHEMA,
    'peercompute.ulg.schroeder-prospective-dynamic-law-transition.v2');
  assert.equal(SCHROEDER_TARGET_SCHEDULE_REQUEST_REVISION,
    'main-thread-next-schedule-request-prospective-writer-transition-sha256-v7');
  assert.equal(SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_REVISION,
    'reaction-or-retained-product-gas-boundary-sha256-v2');
  assert.equal(authority.shadowOnly, false);
  assert.equal(authority.routingAuthority, true);
  assert.equal(transition.shadowOnly, false);
  assert.equal(transition.routingAuthority, true);
  assert.match(authority.requestFingerprint,
    /^sha256:schroeder-target-schedule-authority-v6:/);
  assert.match(transition.transitionFingerprint,
    /^sha256:schroeder-prospective-dynamic-law-transition-v1:/);

  const legacyAuthority = structuredClone(authority);
  legacyAuthority.shadowOnly = true;
  legacyAuthority.routingAuthority = false;
  legacyAuthority.executionGating =
    'disabled-until-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers';
  assert.equal(exactSchroederTargetScheduleAuthority(legacyAuthority), null);

  const legacyTransition = structuredClone(transition);
  legacyTransition.shadowOnly = true;
  legacyTransition.routingAuthority = false;
  legacyTransition.executionGating =
    'disabled-until-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers';
  assert.equal(
    exactSchroederProspectiveDynamicLawTransition(legacyTransition),
    null
  );
});

test('a trustworthy trigger consumes the presealed dormant reaction transition', () => {
  const predecessor = targetAuthority({
    sourceScheduleId: 'schedule:trigger-source',
    targetScheduleRequestId: 'schedule:trigger-target',
    presealReactionActivation: true
  });
  const observation = dynamicLawObservation(predecessor, {
    triggeredSourceCount: 3
  });
  assert.equal(
    schroederTargetScheduleSuccessorReactionExecutionRequired({
      predecessorTargetScheduleAuthority: predecessor,
      predecessorDynamicLawObservation: observation
    }),
    true
  );
  const successor = successorAuthority(predecessor, observation, true);
  assert.equal(successor.writerSet.reaction, true);
  assert.deepEqual(
    successor.predecessorDynamicLawTransition,
    predecessor.prospectiveDynamicLawTransition
  );
  assert.deepEqual(
    validateSchroederTargetScheduleConfigurationContinuity({
      predecessorTargetScheduleAuthority: predecessor,
      currentTargetScheduleAuthority: successor,
      predecessorDynamicLawObservation: observation
    }),
    {
      ready: true,
      reason: null,
      mode: 'prospective-reaction-dormant-to-executing',
      predecessorConfigurationFingerprint:
        predecessor.prospectiveDynamicLawTransition.sourceConfiguration
          .configurationFingerprint,
      currentConfigurationFingerprint:
        predecessor.prospectiveDynamicLawTransition.targetConfiguration
          .configurationFingerprint,
      prospectiveDynamicLawTransitionFingerprint:
        predecessor.prospectiveDynamicLawTransition.transitionFingerprint,
      conservativeActivationRequired: true
    }
  );
});

test('non-cancellation uncertainty consumes the same authenticated preseal', () => {
  const predecessor = targetAuthority({
    sourceScheduleId: 'schedule:uncertain-source',
    targetScheduleRequestId: 'schedule:uncertain-target',
    presealReactionActivation: true
  });
  const observation = dynamicLawObservation(predecessor, {
    uncertainty: true,
    terminalGpuFenceSatisfied: true,
    scheduleCancelled: false
  });
  assert.equal(
    schroederTargetScheduleSuccessorReactionExecutionRequired({
      predecessorTargetScheduleAuthority: predecessor,
      predecessorDynamicLawObservation: observation
    }),
    true
  );
  const successor = successorAuthority(predecessor, observation, true);
  assert.equal(successor.writerSet.reaction, true);
  assert.equal(
    validateSchroederTargetScheduleConfigurationContinuity({
      predecessorTargetScheduleAuthority: predecessor,
      currentTargetScheduleAuthority: successor,
      predecessorDynamicLawObservation: observation
    }).mode,
    'prospective-reaction-dormant-to-executing'
  );
});

test('successful zero and partial cancellation continue dormant without consuming the preseal', () => {
  const zeroPredecessor = targetAuthority({
    sourceScheduleId: 'schedule:zero-source',
    targetScheduleRequestId: 'schedule:zero-target',
    presealReactionActivation: true
  });
  const zeroObservation = dynamicLawObservation(zeroPredecessor);
  assert.equal(
    schroederTargetScheduleSuccessorReactionExecutionRequired({
      predecessorTargetScheduleAuthority: zeroPredecessor,
      predecessorDynamicLawObservation: zeroObservation
    }),
    false
  );
  const zeroSuccessor = successorAuthority(
    zeroPredecessor,
    zeroObservation,
    false
  );
  const zeroContinuity = validateSchroederTargetScheduleConfigurationContinuity({
    predecessorTargetScheduleAuthority: zeroPredecessor,
    currentTargetScheduleAuthority: zeroSuccessor,
    predecessorDynamicLawObservation: zeroObservation
  });
  assert.equal(zeroContinuity.mode, 'exact-configuration-continuation');
  assert.equal(zeroContinuity.conservativeActivationRequired, false);

  const cancelledPredecessor = targetAuthority({
    sourceScheduleId: 'schedule:cancelled-source',
    targetScheduleRequestId: 'schedule:cancelled-target',
    presealReactionActivation: true
  });
  const cancelledObservation = dynamicLawObservation(cancelledPredecessor, {
    uncertainty: true,
    terminalGpuFenceSatisfied: false,
    scheduleCancelled: true,
    failureReason:
      'reaction-activation-observation-not-sampled-after-partial-cancellation'
  });
  assert.equal(
    schroederTargetScheduleSuccessorReactionExecutionRequired({
      predecessorTargetScheduleAuthority: cancelledPredecessor,
      predecessorDynamicLawObservation: cancelledObservation
    }),
    false
  );
  const cancelledSuccessor = successorAuthority(
    cancelledPredecessor,
    cancelledObservation,
    false
  );
  const cancelledContinuity =
    validateSchroederTargetScheduleConfigurationContinuity({
      predecessorTargetScheduleAuthority: cancelledPredecessor,
      currentTargetScheduleAuthority: cancelledSuccessor,
      predecessorDynamicLawObservation: cancelledObservation
    });
  assert.equal(cancelledContinuity.mode,
    'exact-configuration-continuation');
  assert.equal(cancelledContinuity.conservativeActivationRequired, false);
});

test('authenticated trigger fails closed when the reaction target was not presealed', () => {
  const predecessor = targetAuthority({
    sourceScheduleId: 'schedule:missing-source',
    targetScheduleRequestId: 'schedule:missing-target'
  });
  const observation = dynamicLawObservation(predecessor, {
    triggeredSourceCount: 1
  });
  assert.throws(
    () => successorAuthority(predecessor, observation, false),
    /configuration-continuity-required-reaction-transition-missing/
  );
});

test('an authorized presealed transition cannot be ignored by an equal successor configuration', () => {
  const predecessor = targetAuthority({
    sourceScheduleId: 'schedule:ignored-source',
    targetScheduleRequestId: 'schedule:ignored-target',
    presealReactionActivation: true
  });
  const observation = dynamicLawObservation(predecessor, {
    triggeredSourceCount: 2
  });
  assert.throws(
    () => successorAuthority(predecessor, observation, false),
    /configuration-continuity-authorized-transition-not-consumed/
  );
});

test('a structurally cancelled trigger forgery cannot authorize reaction execution', () => {
  const predecessor = targetAuthority({
    sourceScheduleId: 'schedule:forged-source',
    targetScheduleRequestId: 'schedule:forged-target',
    presealReactionActivation: true
  });
  const cancelledForgery = dynamicLawObservation(predecessor, {
    triggeredSourceCount: 4,
    terminalGpuFenceSatisfied: true,
    scheduleCancelled: true
  });
  assert.equal(
    schroederTargetScheduleSuccessorReactionExecutionRequired({
      predecessorTargetScheduleAuthority: predecessor,
      predecessorDynamicLawObservation: cancelledForgery
    }),
    false
  );
  const successor = successorAuthority(predecessor, cancelledForgery, false);
  const continuity = validateSchroederTargetScheduleConfigurationContinuity({
    predecessorTargetScheduleAuthority: predecessor,
    currentTargetScheduleAuthority: successor,
    predecessorDynamicLawObservation: cancelledForgery
  });
  assert.equal(continuity.ready, true);
  assert.equal(continuity.conservativeActivationRequired, false);
});

test('an already-active exact authority remains reaction-executing after an authenticated zero', () => {
  const predecessor = targetAuthority({
    sourceScheduleId: 'schedule:active-source',
    targetScheduleRequestId: 'schedule:active-target',
    reactionActive: true
  });
  const observation = dynamicLawObservation(predecessor);
  assert.equal(
    schroederTargetScheduleSuccessorReactionExecutionRequired({
      predecessorTargetScheduleAuthority: predecessor,
      predecessorDynamicLawObservation: observation
    }),
    true
  );
  const wrongIdentity = {
    ...structuredClone(observation),
    targetScheduleRequestId: 'schedule:forged-target'
  };
  assert.equal(
    schroederTargetScheduleSuccessorReactionExecutionRequired({
      predecessorTargetScheduleAuthority: predecessor,
      predecessorDynamicLawObservation: wrongIdentity
    }),
    false
  );
  const cancelledObservation = dynamicLawObservation(predecessor, {
    terminalGpuFenceSatisfied: true,
    scheduleCancelled: true
  });
  assert.equal(
    schroederTargetScheduleSuccessorReactionExecutionRequired({
      predecessorTargetScheduleAuthority: predecessor,
      predecessorDynamicLawObservation: cancelledObservation
    }),
    false
  );
});
