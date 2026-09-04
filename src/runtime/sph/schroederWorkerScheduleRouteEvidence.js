import {
  SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT,
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE,
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION,
  isSphReactionMotionEnvelopeReceipt
} from './sphReactionMotionEnvelope.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
} from './sphGpuBuffers.js';
import {
  ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_IDENTITY_CORRESPONDENCE_REVISION,
  ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_KERNEL_REVISION
} from './sphPhaseCarrierMaterializationGpu.js';
import {
  SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
  SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE,
  SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
} from './schroederDynamicLawRoutingContract.js';

export const ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA =
  'peercompute.ulg.worker-schedule-dynamic-law-observation.v8';
export const ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA_V0 =
  'peercompute.ulg.worker-schedule-prospective-writer-evidence.v0';
export const ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA =
  'peercompute.ulg.worker-schedule-prospective-writer-evidence.v1';
export const ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_SCHEMA =
  'peercompute.ulg.worker-phase-carrier-one-to-four-transition.v1';
export const WORKER_DYNAMIC_LAW_OBSERVATION_FAILURE_POLICY =
  'conservative-activate-on-next-authenticated-presealed-schedule';

export const WORKER_ROUTE_LINEAGE_FIELDS = Object.freeze([
  'storageGeneration',
  'physicsTick',
  'physicsSubstep',
  'positionEpoch',
  'topologyEpoch',
  'chartEpoch',
  'levelEpoch',
  'supportEpoch'
]);

const WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_KEYS = Object.freeze([
  'schema',
  'status',
  'scheduleId',
  'sourceParticleCount',
  'terminalParticleCount',
  'companionParticleCount',
  'countSummary',
  'sourcePhaseCarrierPlan',
  'terminalPhaseCarrierPlan',
  'sourceLineage',
  'terminalLineage',
  'identityCorrespondence',
  'identityCorrespondenceRevision',
  'materializationKernelRevision',
  'sourceIdentitySchema',
  'terminalIdentitySchema',
  'sourceIdentityStrideBytes',
  'terminalIdentityStrideBytes',
  'sourceIdentityRevision',
  'terminalIdentityRevision',
  'sourceStateBufferByteLength',
  'sourceThermoBufferByteLength',
  'sourceMechanicsBufferByteLength',
  'sourceIdentityBufferByteLength',
  'terminalStateBufferByteLength',
  'terminalThermoBufferByteLength',
  'terminalMechanicsBufferByteLength',
  'terminalIdentityBufferByteLength',
  'validationStatus',
  'validationErrorScopeStatus',
  'validationErrorScopeCount',
  'validationErrorObserved',
  'auxiliaryBufferOwnershipTransfer',
  'publicationFamilies',
  'commandSubmissionCount',
  'fullParticleReadbackPerformed',
  'mapAsyncCount',
  'readbackBytes',
  'activationAuthority',
  'trigger',
  'routingAuthority',
  'dynamicLawRoutingAuthority',
  'terminalFenceSatisfied',
  'supersededSourceRetired',
  'sourceRetirement'
]);
const WORKER_PHASE_CARRIER_ONE_TO_FOUR_COUNT_SUMMARY_KEYS = Object.freeze([
  'schema',
  'status',
  'sourceParticleCount',
  'terminalParticleCount',
  'companionParticleCount',
  'sourceToTerminalRatio',
  'sourceLineageCount',
  'terminalLineageCount',
  'phaseLaneCount',
  'phaseLaneStride',
  'stableLaneAddress',
  'terminalIndexFromSource',
  'sourceIndexFromTerminal',
  'phaseLaneFromTerminal',
  'exactCountAuthority'
]);
const WORKER_PHASE_CARRIER_ONE_TO_FOUR_PLAN_KEYS = Object.freeze([
  'schema',
  'status',
  'lineageCapacity',
  'primaryCapacity',
  'phaseLaneCount',
  'phaseLaneStride',
  'companionStart',
  'companionCapacity',
  'particleCapacity',
  'stableLaneAddress',
  'phaseCompanionLanesRequired',
  'reason'
]);
const WORKER_PHASE_CARRIER_ONE_TO_FOUR_SOURCE_RETIREMENT_KEYS = Object.freeze([
  'schema',
  'status',
  'terminalFenceSatisfied',
  'sourceFamilyAdopted',
  'retiredSourceBufferCount',
  'rejectedOutputRetired',
  'submittedWorkCleanupReleased'
]);
const WORKER_PHASE_CARRIER_AUXILIARY_OWNERSHIP_TRANSFER_KEYS = Object.freeze([
  'schema',
  'status',
  'aliasedAuxiliaryBufferCount',
  'transferredOwnedBufferCount',
  'borrowedAuxiliaryBufferCount',
  'sourceOwnershipCleared',
  'terminalOwnershipAdopted'
]);
const WORKER_ROUTE_PARTICLE_CARDINALITY_KEYS = Object.freeze([
  'schema',
  'status',
  'sourceParticleCount',
  'targetParticleCount',
  'sourceSphStateParticleCount',
  'sourceSphUploadParticleCount',
  'sourceMlsMpmStateParticleCount',
  'sourceMlsMpmUploadParticleCount',
  'targetSphStateParticleCount',
  'targetSphUploadParticleCount',
  'targetMlsMpmStateParticleCount',
  'targetMlsMpmUploadParticleCount',
  'terminalStepParticleCount',
  'exactSourceParticleFamily',
  'exactTargetParticleFamily'
]);
const WORKER_DYNAMIC_LAW_OBSERVATION_KEYS = Object.freeze([
  'schema',
  'status',
  'sourceScheduleId',
  'targetScheduleRequestId',
  'targetScheduleAuthorityFingerprint',
  'laneId',
  'stateKey',
  'lawFamily',
  'predicateRevision',
  'predicate',
  'producerRoute',
  'sampleStage',
  'nodeDomain',
  'motionEnvelope',
  'shadowOnly',
  'routingAuthority',
  'executionGating',
  'observationSucceeded',
  'triggered',
  'triggeredSourceCount',
  'uncertainty',
  'rawEvidenceWord',
  'particleCount',
  'reactionCount',
  'reactionTableFingerprint',
  'prospectiveWriterEvidence',
  'mapAsyncCount',
  'readbackByteLength',
  'fullParticleReadbackPerformed',
  'terminalLineage',
  'failureReason',
  'failurePolicy'
]);
const WORKER_PROSPECTIVE_WRITER_EVIDENCE_KEYS = Object.freeze([
  'schema',
  'status',
  'gasBoundaryActionable',
  'retainedProductGasBoundaryActionable',
  'source',
  'productEventBufferRetained',
  'productEventRowCount',
  'productHistoryArenaIdentity',
  'productHistoryLiveBoundObservation',
  'terminalGpuFenceSatisfied',
  'scheduleCancelled'
]);
const PRODUCT_HISTORY_LIVE_BOUND_OBSERVATION_KEYS = Object.freeze([
  'schema',
  'observedLiveRowCount',
  'previousUpperBound',
  'tightenedUpperBound',
  'arenaRowCapacity',
  'readbackByteLength',
  'arenaIdentity'
]);
const PRODUCT_HISTORY_ARENA_IDENTITY_KEYS = Object.freeze([
  'schema',
  'status',
  'slotId',
  'leaseSerial',
  'viewOrdinal',
  'rowCapacity',
  'bufferByteLength',
  'rowStrideFloats',
  'countAuthorityGeneration',
  'countAuthoritySeal'
]);

function nonEmptyString(value, fallback = null) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function exactCanonicalInteger(value, minimum, maximum) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && !Object.is(value, -0)
    && value >= minimum
    && value <= maximum;
}

export function exactWorkerRouteStringList(value) {
  if (!Array.isArray(value)) return null;
  const output = [];
  const seen = new Set();
  for (const entry of value) {
    const text = nonEmptyString(entry);
    if (!text || seen.has(text)) return null;
    seen.add(text);
    output.push(text);
  }
  return output;
}

export function workerRoutePlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function workerRouteObjectHasExactKeys(value, keys) {
  if (!workerRoutePlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

export function exactWorkerProductHistoryArenaIdentity(value) {
  return value != null
    && workerRouteObjectHasExactKeys(
      value,
      PRODUCT_HISTORY_ARENA_IDENTITY_KEYS
    )
    && value.schema
      === 'peercompute.ulg.sph-resident-product-history-arena-identity.v0'
    && value.status
      === 'retained-product-history-arena-authenticated'
    && exactCanonicalInteger(value.slotId, 1, Number.MAX_SAFE_INTEGER)
    && exactCanonicalInteger(
      value.leaseSerial,
      1,
      Number.MAX_SAFE_INTEGER
    )
    && exactCanonicalInteger(
      value.viewOrdinal,
      1,
      Number.MAX_SAFE_INTEGER
    )
    && exactCanonicalInteger(
      value.rowCapacity,
      1,
      SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
    )
    && exactCanonicalInteger(
      value.bufferByteLength,
      1,
      Number.MAX_SAFE_INTEGER
    )
    && exactCanonicalInteger(
      value.rowStrideFloats,
      1,
      Number.MAX_SAFE_INTEGER
    )
    && exactCanonicalInteger(
      value.countAuthorityGeneration,
      1,
      0xffff_ffff
    )
    && exactCanonicalInteger(
      value.countAuthoritySeal,
      1,
      0xffff_ffff
    )
      ? value
      : null;
}

export function exactWorkerProspectiveWriterEvidence(value) {
  if (
    !workerRouteObjectHasExactKeys(
      value,
      WORKER_PROSPECTIVE_WRITER_EVIDENCE_KEYS
    )
    || value.schema
      !== ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA
    || typeof value.gasBoundaryActionable !== 'boolean'
    || typeof value.retainedProductGasBoundaryActionable !== 'boolean'
    || value.retainedProductGasBoundaryActionable
      !== value.gasBoundaryActionable
    || typeof value.productEventBufferRetained !== 'boolean'
    || typeof value.terminalGpuFenceSatisfied !== 'boolean'
    || typeof value.scheduleCancelled !== 'boolean'
    || !exactCanonicalInteger(
      value.productEventRowCount,
      0,
      SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
    )
  ) return null;
  const arenaIdentity = exactWorkerProductHistoryArenaIdentity(
    value.productHistoryArenaIdentity
  );
  const liveBound = value.productHistoryLiveBoundObservation;
  const exactLiveBound = liveBound != null
    && workerRouteObjectHasExactKeys(
      liveBound,
      PRODUCT_HISTORY_LIVE_BOUND_OBSERVATION_KEYS
    )
    && liveBound.schema
      === 'peercompute.ulg.sph-product-history-live-bound-observation.v0'
    && exactCanonicalInteger(
      liveBound.observedLiveRowCount,
      0,
      SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
    )
    && exactCanonicalInteger(
      liveBound.previousUpperBound,
      1,
      SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
    )
    && exactCanonicalInteger(
      liveBound.tightenedUpperBound,
      1,
      SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
    )
    && exactCanonicalInteger(
      liveBound.arenaRowCapacity,
      1,
      SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
    )
    && liveBound.observedLiveRowCount <= liveBound.arenaRowCapacity
    && liveBound.previousUpperBound <= liveBound.arenaRowCapacity
    && liveBound.tightenedUpperBound === Math.min(
      liveBound.previousUpperBound,
      Math.max(1, liveBound.observedLiveRowCount)
    )
    && liveBound.readbackByteLength === Uint32Array.BYTES_PER_ELEMENT
    && exactWorkerProductHistoryArenaIdentity(liveBound.arenaIdentity)
    && liveBound.arenaIdentity.rowCapacity === liveBound.arenaRowCapacity
    && workerRouteValuesEqual(liveBound.arenaIdentity, arenaIdentity);
  if (value.gasBoundaryActionable) {
    return value.status
      === 'worker-retained-product-gas-boundary-actionable'
      && value.source === 'worker-retained-product-event-buffer'
      && value.productEventBufferRetained === true
      && value.productEventRowCount > 0
      && arenaIdentity
      && arenaIdentity.rowCapacity === value.productEventRowCount
      && (liveBound === null || exactLiveBound)
      && (liveBound === null
        || liveBound.arenaRowCapacity === value.productEventRowCount)
      && value.terminalGpuFenceSatisfied === true
      && value.scheduleCancelled === false
      ? value
      : null;
  }
  if (value.status === 'worker-retained-product-gas-boundary-inactive') {
    return value.source === null
      && value.productEventBufferRetained === false
      && value.productEventRowCount === 0
      && arenaIdentity === null
      && liveBound === null
      ? value
      : null;
  }
  return value.status === 'worker-retained-product-gas-boundary-uncertain'
    && value.source === 'worker-retained-product-event-buffer'
    && value.productEventBufferRetained === true
    && value.productEventRowCount > 0
    && (arenaIdentity === null
      || arenaIdentity.rowCapacity === value.productEventRowCount)
    && (liveBound === null || exactLiveBound)
    && !(
      arenaIdentity
      && value.terminalGpuFenceSatisfied === true
      && value.scheduleCancelled === false
    )
    ? value
    : null;
}

export function workerRouteValuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every(
        (entry, index) => workerRouteValuesEqual(entry, right[index])
      );
  }
  if (!workerRoutePlainObject(left) || !workerRoutePlainObject(right)) {
    return false;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index]
      && workerRouteValuesEqual(left[key], right[key])
    ));
}

export function exactWorkerRouteLineage(value, { exactKeys = false } = {}) {
  if (!value || typeof value !== 'object') return null;
  if (
    exactKeys
    && !workerRouteObjectHasExactKeys(value, WORKER_ROUTE_LINEAGE_FIELDS)
  ) return null;
  const lineage = {};
  for (const field of WORKER_ROUTE_LINEAGE_FIELDS) {
    const word = value[field];
    if (!Number.isSafeInteger(word) || word < 0 || word > 0xffff_ffff) {
      return null;
    }
    lineage[field] = word;
  }
  return lineage;
}

export function workerRouteLineageEquals(left, right) {
  const exactLeft = exactWorkerRouteLineage(left);
  const exactRight = exactWorkerRouteLineage(right);
  return Boolean(
    exactLeft
    && exactRight
    && WORKER_ROUTE_LINEAGE_FIELDS.every(
      (field) => exactLeft[field] === exactRight[field]
    )
  );
}

export function workerRouteStringListsEqual(left, right) {
  const exactLeft = exactWorkerRouteStringList(left);
  const exactRight = exactWorkerRouteStringList(right);
  return Boolean(
    exactLeft
    && exactRight
    && exactLeft.length === exactRight.length
    && exactLeft.every((entry, index) => entry === exactRight[index])
  );
}

export function exactWorkerDynamicLawObservation(value, {
  scheduleId = null,
  laneId = null,
  stateKey = null,
  terminalLineage = null,
  requestedStepCount = null,
  thermalPhaseEvolutionRequired = false,
  expectedContactCorrectionEnabled = null,
  expectedTargetScheduleRequestId = null,
  expectedTargetScheduleAuthorityFingerprint = null,
  expectedReactionTableFingerprint = null,
  expectedReactionCount = null
} = {}) {
  const targetScheduleRequestId = nonEmptyString(
    value?.targetScheduleRequestId
  );
  const targetScheduleAuthorityFingerprint = nonEmptyString(
    value?.targetScheduleAuthorityFingerprint
  );
  const expectedTargetRequest = expectedTargetScheduleRequestId == null
    ? null
    : nonEmptyString(expectedTargetScheduleRequestId);
  const expectedTargetFingerprint =
    expectedTargetScheduleAuthorityFingerprint == null
      ? null
      : nonEmptyString(expectedTargetScheduleAuthorityFingerprint);
  const expectedReactionFingerprint = expectedReactionTableFingerprint == null
    ? null
    : nonEmptyString(expectedReactionTableFingerprint);
  const expectedWatchReactionCount = expectedReactionCount == null
    ? null
    : expectedReactionCount;
  if (
    !workerRouteObjectHasExactKeys(
      value,
      WORKER_DYNAMIC_LAW_OBSERVATION_KEYS
    )
    || value.schema !== ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA
    || value.sourceScheduleId !== scheduleId
    || !(
      value.targetScheduleRequestId === null
      || targetScheduleRequestId
    )
    || !(
      value.targetScheduleAuthorityFingerprint === null
      || targetScheduleAuthorityFingerprint
    )
    || (value.targetScheduleRequestId === null)
      !== (value.targetScheduleAuthorityFingerprint === null)
    || (
      expectedTargetScheduleRequestId != null
      && (
        !expectedTargetRequest
        || targetScheduleRequestId !== expectedTargetRequest
      )
    )
    || (
      expectedTargetScheduleAuthorityFingerprint != null
      && (
        !expectedTargetFingerprint
        || targetScheduleAuthorityFingerprint !== expectedTargetFingerprint
      )
    )
    || (
      expectedReactionTableFingerprint != null
      && (
        !expectedReactionFingerprint
        || value.reactionTableFingerprint !== expectedReactionFingerprint
      )
    )
    || (
      expectedReactionCount != null
      && (
        !exactCanonicalInteger(
          expectedWatchReactionCount,
          1,
          SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
        )
        || value.reactionCount !== expectedWatchReactionCount
      )
    )
    || value.laneId !== laneId
    || value.stateKey !== stateKey
    || value.lawFamily !== 'reaction'
    || value.predicateRevision
      !== SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION
    || value.predicate !== SPH_REACTION_MOTION_ENVELOPE_PREDICATE
    || ![
      'canonical-schroeder',
      'tier0-fused-resident-sequence'
    ].includes(value.producerRoute)
    || value.sampleStage !== (
      value.producerRoute === 'canonical-schroeder'
        ? 'canonical-terminal-published-carrier-family-motion-envelope'
        : 'tier0-terminal-post-separation-motion-envelope'
    )
    || value.nodeDomain !== 'fixed-phase-carrier-slot'
    || value.shadowOnly !== SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
    || value.routingAuthority !== SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
    || value.executionGating !== SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE
    || typeof value.observationSucceeded !== 'boolean'
    || typeof value.triggered !== 'boolean'
    || typeof value.uncertainty !== 'boolean'
    || value.fullParticleReadbackPerformed !== false
    || value.failurePolicy !== WORKER_DYNAMIC_LAW_OBSERVATION_FAILURE_POLICY
    || !exactWorkerProspectiveWriterEvidence(
      value.prospectiveWriterEvidence
    )
    || !(
      value.particleCount === null
      || exactCanonicalInteger(
        value.particleCount,
        1,
        SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
      )
    )
    || !(
      value.reactionCount === null
      || exactCanonicalInteger(
        value.reactionCount,
        1,
        SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
      )
    )
    || !exactCanonicalInteger(value.mapAsyncCount, 0, 1)
    || !exactCanonicalInteger(
      value.readbackByteLength,
      0,
      Uint32Array.BYTES_PER_ELEMENT
    )
    || ![0, Uint32Array.BYTES_PER_ELEMENT].includes(
      value.readbackByteLength
    )
  ) return null;
  const exactTerminalLineage = exactWorkerRouteLineage(
    value.terminalLineage,
    { exactKeys: true }
  );
  if (
    !exactTerminalLineage
    || !workerRouteLineageEquals(exactTerminalLineage, terminalLineage)
    || (
      value.motionEnvelope != null
      && value.motionEnvelope.maxFutureSubsteps !== requestedStepCount
    )
    || (
      thermalPhaseEvolutionRequired === true
      && value.motionEnvelope?.thermalPhaseEvolutionEnabled !== true
    )
    || (
      typeof expectedContactCorrectionEnabled === 'boolean'
      && (
        value.motionEnvelope?.contactCorrectionEnabled
          !== expectedContactCorrectionEnabled
        || value.motionEnvelope?.separationDisplacementEnabled
          === expectedContactCorrectionEnabled
      )
    )
  ) return null;

  if (value.observationSucceeded === true) {
    if (
      value.status !== 'dynamic-law-routing-observation-ready'
      || value.uncertainty !== false
      || !exactCanonicalInteger(
        value.particleCount,
        1,
        SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
      )
      || !exactCanonicalInteger(
        value.reactionCount,
        1,
        SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
      )
      || !exactCanonicalInteger(
        value.triggeredSourceCount,
        0,
        value.particleCount
      )
      || !exactCanonicalInteger(
        value.rawEvidenceWord,
        0,
        value.particleCount
      )
      || value.rawEvidenceWord !== value.triggeredSourceCount
      || value.triggered !== (value.triggeredSourceCount > 0)
      || typeof value.reactionTableFingerprint !== 'string'
      || value.reactionTableFingerprint.length < 1
      || !isSphReactionMotionEnvelopeReceipt(value.motionEnvelope)
      || value.mapAsyncCount !== 1
      || value.readbackByteLength !== Uint32Array.BYTES_PER_ELEMENT
      || value.failureReason !== null
      || (
        value.motionEnvelope?.thermalPhaseEvolutionEnabled === true
        && (
          value.triggered !== true
          || value.triggeredSourceCount !== value.particleCount
        )
      )
    ) return null;
  } else if (
    value.status !== 'dynamic-law-routing-observation-uncertain'
    || value.uncertainty !== true
    || value.triggered !== true
    || value.triggeredSourceCount !== null
    || !(
      value.rawEvidenceWord === null
      || value.rawEvidenceWord === 0xffff_ffff
    )
    || !(
      value.reactionTableFingerprint === null
      || (
        typeof value.reactionTableFingerprint === 'string'
        && value.reactionTableFingerprint.length > 0
      )
    )
    || !(
      value.motionEnvelope === null
      || isSphReactionMotionEnvelopeReceipt(value.motionEnvelope)
    )
    || typeof value.failureReason !== 'string'
    || value.failureReason.length < 1
    || (
      value.rawEvidenceWord === 0xffff_ffff
      && (
        value.mapAsyncCount !== 1
        || value.readbackByteLength !== Uint32Array.BYTES_PER_ELEMENT
      )
    )
    || (
      value.rawEvidenceWord === null
      && value.readbackByteLength !== 0
    )
  ) return null;
  return value;
}

/**
 * Validate a clone-safe dynamic-law observation against the identity carried
 * by the observation itself. Callers that hold independent schedule authority
 * should continue to use exactWorkerDynamicLawObservation() with explicit
 * expectations; this helper is for embedding the already-admitted observation
 * in the following schedule's one-use predecessor token.
 */
export function exactWorkerDynamicLawObservationSelf(value) {
  const sourceScheduleId = nonEmptyString(value?.sourceScheduleId);
  const laneId = nonEmptyString(value?.laneId);
  const stateKey = nonEmptyString(value?.stateKey);
  if (!sourceScheduleId || !laneId || !stateKey) return null;
  return exactWorkerDynamicLawObservation(value, {
    scheduleId: sourceScheduleId,
    laneId,
    stateKey,
    terminalLineage: value?.terminalLineage ?? null,
    requestedStepCount: value?.motionEnvelope?.maxFutureSubsteps ?? null,
    expectedTargetScheduleRequestId:
      value?.targetScheduleRequestId ?? null,
    expectedTargetScheduleAuthorityFingerprint:
      value?.targetScheduleAuthorityFingerprint ?? null,
    expectedReactionTableFingerprint:
      value?.reactionTableFingerprint ?? null,
    expectedReactionCount: value?.reactionCount ?? null
  });
}

export function exactWorkerPhaseCarrierOneToFourTransition(
  transition,
  { scheduleId = null, sourceLineage = null } = {}
) {
  const authenticatedDynamicReactionSuccessor =
    transition?.trigger === 'authenticated-dynamic-reaction-successor';
  if (
    !workerRouteObjectHasExactKeys(
      transition,
      WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_KEYS
    )
    || transition.schema
      !== ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_SCHEMA
    || transition.status
      !== 'phase-carrier-one-to-four-adopted-terminal-fence-satisfied'
    || transition.scheduleId !== scheduleId
  ) return null;
  const sourceCount = transition.sourceParticleCount;
  const terminalCount = transition.terminalParticleCount;
  if (
    !exactCanonicalInteger(
      sourceCount,
      1,
      Math.floor(SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT / 4)
    )
    || !exactCanonicalInteger(
      terminalCount,
      1,
      SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
    )
    || terminalCount !== sourceCount * 4
    || transition.companionParticleCount !== sourceCount * 3
  ) return null;
  const summary = transition.countSummary;
  if (
    !workerRouteObjectHasExactKeys(
      summary,
      WORKER_PHASE_CARRIER_ONE_TO_FOUR_COUNT_SUMMARY_KEYS
    )
    || summary.schema
      !== 'peercompute.ulg.sph-phase-carrier-one-to-four-count-summary.v0'
    || summary.status !== 'phase-carrier-one-to-four-counts-exact'
    || summary.sourceParticleCount !== sourceCount
    || summary.terminalParticleCount !== terminalCount
    || summary.companionParticleCount !== sourceCount * 3
    || summary.sourceToTerminalRatio !== 4
    || summary.sourceLineageCount !== sourceCount
    || summary.terminalLineageCount !== sourceCount
    || summary.phaseLaneCount !== 4
    || summary.phaseLaneStride !== sourceCount
    || summary.stableLaneAddress
      !== 'phaseLane*phaseLaneStride+lineageIndex'
    || summary.terminalIndexFromSource
      !== 'phaseLane*sourceParticleCount+sourceParticleIndex'
    || summary.sourceIndexFromTerminal
      !== 'terminalParticleIndex%sourceParticleCount'
    || summary.phaseLaneFromTerminal
      !== 'floor(terminalParticleIndex/sourceParticleCount)'
    || summary.exactCountAuthority !== true
  ) return null;
  const sourcePlan = transition.sourcePhaseCarrierPlan;
  const terminalPlan = transition.terminalPhaseCarrierPlan;
  if (
    !workerRouteObjectHasExactKeys(
      sourcePlan,
      WORKER_PHASE_CARRIER_ONE_TO_FOUR_PLAN_KEYS
    )
    || !workerRouteObjectHasExactKeys(
      terminalPlan,
      WORKER_PHASE_CARRIER_ONE_TO_FOUR_PLAN_KEYS
    )
    || sourcePlan.schema !== 'peercompute.ulg.sph-phase-carrier-plan.v2'
    || terminalPlan.schema !== sourcePlan.schema
    || sourcePlan.status !== 'phase-lane-capacity-ready'
    || terminalPlan.status !== sourcePlan.status
    || sourcePlan.lineageCapacity !== sourceCount
    || sourcePlan.primaryCapacity !== sourceCount
    || sourcePlan.phaseLaneCount !== 1
    || sourcePlan.phaseLaneStride !== sourceCount
    || sourcePlan.companionStart !== sourceCount
    || sourcePlan.companionCapacity !== 0
    || sourcePlan.particleCapacity !== sourceCount
    || sourcePlan.stableLaneAddress
      !== 'phaseLane*phaseLaneStride+lineageIndex'
    || sourcePlan.phaseCompanionLanesRequired !== false
    || !nonEmptyString(sourcePlan.reason)
    || terminalPlan.lineageCapacity !== sourceCount
    || terminalPlan.primaryCapacity !== sourceCount
    || terminalPlan.phaseLaneCount !== 4
    || terminalPlan.phaseLaneStride !== sourceCount
    || terminalPlan.companionStart !== sourceCount
    || terminalPlan.companionCapacity !== sourceCount * 3
    || terminalPlan.particleCapacity !== terminalCount
    || terminalPlan.stableLaneAddress !== sourcePlan.stableLaneAddress
    || terminalPlan.phaseCompanionLanesRequired !== true
    || !nonEmptyString(terminalPlan.reason)
  ) return null;
  const exactSource = exactWorkerRouteLineage(
    transition.sourceLineage,
    { exactKeys: true }
  );
  const exactTarget = exactWorkerRouteLineage(
    transition.terminalLineage,
    { exactKeys: true }
  );
  if (
    !exactSource
    || !exactTarget
    || !workerRouteLineageEquals(exactSource, sourceLineage)
    || exactTarget.storageGeneration !== exactSource.storageGeneration + 1
    || exactTarget.physicsTick !== exactSource.physicsTick
    || exactTarget.physicsSubstep !== exactSource.physicsSubstep
    || exactTarget.positionEpoch !== exactSource.positionEpoch
    || exactTarget.topologyEpoch !== exactSource.topologyEpoch + 1
    || exactTarget.chartEpoch !== exactSource.chartEpoch
    || exactTarget.levelEpoch !== exactSource.levelEpoch
    || exactTarget.supportEpoch !== exactSource.supportEpoch
  ) return null;
  const expectedTerminalIdentityRevision = `${
    transition.sourceIdentityRevision
  }:phase-carrier-1-to-4:${sourceCount}->${terminalCount}:sg${
    exactTarget.storageGeneration
  }:te${exactTarget.topologyEpoch}`;
  if (
    transition.identityCorrespondenceRevision
      !== ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_IDENTITY_CORRESPONDENCE_REVISION
    || transition.materializationKernelRevision
      !== ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_KERNEL_REVISION
    || transition.sourceIdentitySchema
      !== ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
    || transition.terminalIdentitySchema
      !== ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
    || transition.sourceIdentityStrideBytes
      !== SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT
    || transition.terminalIdentityStrideBytes
      !== SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT
    || !nonEmptyString(transition.sourceIdentityRevision)
    || transition.terminalIdentityRevision
      !== expectedTerminalIdentityRevision
    || transition.sourceStateBufferByteLength
      !== sourceCount
        * SPH_GPU_PARTICLE_STATE_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    || transition.sourceThermoBufferByteLength
      !== sourceCount
        * SPH_GPU_PARTICLE_THERMO_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    || transition.sourceMechanicsBufferByteLength
      !== sourceCount
        * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    || transition.sourceIdentityBufferByteLength
      !== sourceCount
        * SPH_GPU_PARTICLE_IDENTITY_UINTS
        * Uint32Array.BYTES_PER_ELEMENT
    || transition.terminalStateBufferByteLength
      !== terminalCount
        * SPH_GPU_PARTICLE_STATE_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    || transition.terminalThermoBufferByteLength
      !== terminalCount
        * SPH_GPU_PARTICLE_THERMO_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    || transition.terminalMechanicsBufferByteLength
      !== terminalCount
        * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    || transition.terminalIdentityBufferByteLength
      !== terminalCount
        * SPH_GPU_PARTICLE_IDENTITY_UINTS
        * Uint32Array.BYTES_PER_ELEMENT
    || transition.validationStatus
      !== 'phase-carrier-one-to-four-execution-valid'
    || transition.validationErrorScopeStatus
      !== 'validation-error-scope-clean'
    || transition.validationErrorScopeCount !== 1
    || transition.validationErrorObserved !== false
  ) return null;
  const auxiliaryOwnership = transition.auxiliaryBufferOwnershipTransfer;
  if (
    !workerRouteObjectHasExactKeys(
      auxiliaryOwnership,
      WORKER_PHASE_CARRIER_AUXILIARY_OWNERSHIP_TRANSFER_KEYS
    )
    || auxiliaryOwnership.schema
      !== 'peercompute.ulg.worker-phase-carrier-auxiliary-ownership-transfer.v0'
    || auxiliaryOwnership.status
      !== 'phase-carrier-auxiliary-ownership-transferred'
    || !Number.isSafeInteger(
      auxiliaryOwnership.aliasedAuxiliaryBufferCount
    )
    || auxiliaryOwnership.aliasedAuxiliaryBufferCount < 0
    || auxiliaryOwnership.aliasedAuxiliaryBufferCount > 4
    || !Number.isSafeInteger(
      auxiliaryOwnership.transferredOwnedBufferCount
    )
    || auxiliaryOwnership.transferredOwnedBufferCount < 0
    || !Number.isSafeInteger(
      auxiliaryOwnership.borrowedAuxiliaryBufferCount
    )
    || auxiliaryOwnership.borrowedAuxiliaryBufferCount < 0
    || auxiliaryOwnership.transferredOwnedBufferCount
      + auxiliaryOwnership.borrowedAuxiliaryBufferCount
      !== auxiliaryOwnership.aliasedAuxiliaryBufferCount
    || auxiliaryOwnership.sourceOwnershipCleared !== true
    || auxiliaryOwnership.terminalOwnershipAdopted !== true
  ) return null;
  const retirement = transition.sourceRetirement;
  if (
    !workerRouteObjectHasExactKeys(
      retirement,
      WORKER_PHASE_CARRIER_ONE_TO_FOUR_SOURCE_RETIREMENT_KEYS
    )
    || retirement.schema
      !== 'peercompute.ulg.worker-phase-carrier-one-to-four-source-retirement.v0'
    || retirement.status
      !== 'phase-carrier-one-to-four-source-retired-after-terminal-fence'
    || retirement.terminalFenceSatisfied !== true
    || retirement.sourceFamilyAdopted !== true
    || retirement.retiredSourceBufferCount !== 4
    || retirement.rejectedOutputRetired !== false
    || retirement.submittedWorkCleanupReleased !== true
  ) return null;
  if (
    transition.identityCorrespondence
      !== 'duplicate-source-render-domain-identity-across-four-fixed-phase-lanes'
    || !workerRouteStringListsEqual(
      transition.publicationFamilies,
      ['state', 'thermo', 'mechanics', 'identity']
    )
    || transition.commandSubmissionCount !== 1
    || transition.fullParticleReadbackPerformed !== false
    || transition.mapAsyncCount !== 0
    || transition.readbackBytes !== 0
    || transition.activationAuthority
      !== 'schedule-config-static-declaration-no-readback'
    || ![
      'static-thermal-law-active',
      'static-reaction-law-active',
      'authenticated-dynamic-reaction-successor'
    ].includes(transition.trigger)
    || transition.routingAuthority
      !== authenticatedDynamicReactionSuccessor
    || transition.dynamicLawRoutingAuthority
      !== authenticatedDynamicReactionSuccessor
    || transition.terminalFenceSatisfied !== true
    || transition.supersededSourceRetired !== true
  ) return null;
  return transition;
}

export function exactWorkerRouteParticleCardinality(cardinality) {
  if (
    !workerRouteObjectHasExactKeys(
      cardinality,
      WORKER_ROUTE_PARTICLE_CARDINALITY_KEYS
    )
    || cardinality.schema
      !== 'peercompute.ulg.worker-schedule-particle-cardinality.v0'
    || cardinality.status
      !== 'worker-schedule-particle-cardinality-exact'
    || !exactCanonicalInteger(
      cardinality.sourceParticleCount,
      1,
      SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
    )
    || !exactCanonicalInteger(
      cardinality.targetParticleCount,
      1,
      SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
    )
    || cardinality.sourceSphStateParticleCount
      !== cardinality.sourceParticleCount
    || cardinality.sourceSphUploadParticleCount
      !== cardinality.sourceParticleCount
    || cardinality.sourceMlsMpmStateParticleCount
      !== cardinality.sourceParticleCount
    || cardinality.sourceMlsMpmUploadParticleCount
      !== cardinality.sourceParticleCount
    || cardinality.targetSphStateParticleCount
      !== cardinality.targetParticleCount
    || cardinality.targetSphUploadParticleCount
      !== cardinality.targetParticleCount
    || cardinality.targetMlsMpmStateParticleCount
      !== cardinality.targetParticleCount
    || cardinality.targetMlsMpmUploadParticleCount
      !== cardinality.targetParticleCount
    || cardinality.terminalStepParticleCount
      !== cardinality.targetParticleCount
    || cardinality.exactSourceParticleFamily !== true
    || cardinality.exactTargetParticleFamily !== true
  ) return null;
  return cardinality;
}
