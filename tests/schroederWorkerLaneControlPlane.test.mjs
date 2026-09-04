import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_SCHROEDER_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA,
  ULG_SCHROEDER_WORKER_HIERARCHY_CONFIG_SCHEMA,
  ULG_SCHROEDER_WORKER_LANE_SEQUENCE_CONTRACT_SCHEMA,
  ULG_WORKER_RESIDENT_SCHEDULE_TERMINAL_REFLUX_RECEIPT_SCHEMA,
  ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_SCHEMA,
  ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA,
  ULG_WORKER_SCHEDULE_EXECUTION_ROUTE_RECEIPT_SCHEMA,
  ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA,
  createSchroederTargetScheduleAuthority,
  createSchroederTargetScheduleConfiguration,
  createSchroederTargetScheduleProviderAuthority,
  createSchroederWorkerHierarchyConfig,
  createSchroederWorkerResidentStepOptions,
  createSchroederWorkerLaneSequenceContract,
  estimateSchroederWorkerLaneSeedUploadBytes,
  runSchroederWorkerLaneScheduleWithAuthority,
  schroederParticleGasLedgerActionableForResidentStepOptions,
  schroederTargetScheduleConfigurationReceipt,
  validateSchroederWorkerScheduleExecutionRouteReceipt
} from '../src/runtime/sph/schroederWorkerLaneControlPlane.js';
import {
  attachResidentStateManagerCommitBridge
} from '../src/runtime/peercomputeResidentCommitBridge.js';
import {
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE,
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION,
  SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT,
  createSphReactionMotionEnvelope,
  isSphReactionMotionEnvelopeReceipt
} from '../src/runtime/sph/sphReactionMotionEnvelope.js';
import {
  ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_IDENTITY_CORRESPONDENCE_REVISION,
  ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_KERNEL_REVISION
} from '../src/runtime/sph/sphPhaseCarrierMaterializationGpu.js';
import {
  schroederAuthorityTextFingerprint
} from '../src/runtime/sph/schroederAuthorityFingerprint.js';
import {
  SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
  SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE,
  SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
} from '../src/runtime/sph/schroederDynamicLawRoutingContract.js';
import {
  ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA,
  WORKER_DYNAMIC_LAW_OBSERVATION_FAILURE_POLICY
} from '../src/runtime/sph/schroederWorkerScheduleRouteEvidence.js';
import {
  isExactQuiescentSphReactionTable
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  buildSphReactionTable
} from '../src/runtime/sph/sphReactionGpuKernel.js';
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

test('target-schedule authority SHA-256 fingerprint has a stable known vector', () => {
  assert.equal(
    schroederAuthorityTextFingerprint('abc', 'test'),
    'sha256:test:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

function authorityFixture() {
  const calls = [];
  const warmByScope = new Map();
  const stateManager = {
    commitDelta(delta) {
      const scope = delta.scope;
      const entries = warmByScope.get(scope) || {};
      entries[delta.taskId] = {
        version: delta.version,
        ts: delta.timestamp,
        payload: structuredClone(delta.payload)
      };
      warmByScope.set(scope, entries);
    },
    getWarmDeltas(scope) {
      return warmByScope.get(scope) || {};
    }
  };
  const activeLeases = new Map();
  const computeManager = {
    acquireGpuResidentLaneLease(spec) {
      calls.push(['acquire', spec]);
      const lease = {
        ...structuredClone(spec),
        leaseId: `${spec.laneId}:lease:test`
      };
      activeLeases.set(lease.leaseId, lease);
      return lease;
    },
    completeGpuResidentLaneLease(leaseId, options) {
      calls.push(['complete', leaseId, options]);
      const lease = activeLeases.get(leaseId);
      assert.ok(lease);
      activeLeases.delete(leaseId);
      lease.status = options.completed === true
        ? 'completed'
        : 'completed-unsatisfied-fence';
      return {
        lease,
        gpuFence: {
          schema: 'peercompute.compute.gpu-fence-report.v0',
          status: options.status,
          method: options.method,
          fenceSatisfied: options.completed === true,
          required: true,
          laneId: lease.laneId,
          stateKey: lease.stateKey,
          queueFencePolicy: lease.queueFencePolicy,
          queueCompletionStatus: options.queueCompletionStatus,
          queueCompletionMethod: options.queueCompletionMethod,
          retainedBufferRefs: [...options.retainedBufferRefs]
        }
      };
    },
    rejectGpuResidentLaneLease(leaseId, reason) {
      calls.push(['reject', leaseId, reason]);
      activeLeases.delete(leaseId);
      return { leaseId, reason };
    },
    commitDelta(delta) {
      calls.push(['commit', delta]);
      stateManager.commitDelta(delta);
    }
  };
  return { calls, computeManager, stateManager, activeLeases };
}

function terminalScheduleFence({
  scheduleId,
  laneId,
  stateKey,
  completedStepCount,
  method = 'worker-device.queue.onSubmittedWorkDone',
  fenceSatisfied = true,
  authorityAdmissionReady = fenceSatisfied,
  terminalRefluxReceipt = null
}) {
  return {
    status: fenceSatisfied ? 'gpu-fence-satisfied' : 'gpu-fence-unsatisfied',
    required: true,
    fenceSatisfied,
    scope: 'resident-schedule-terminal',
    terminalScheduleFence: true,
    authorityAdmissionReady,
    scheduleId,
    laneId,
    stateKey,
    completedStepCount,
    queueCompletionStatus: fenceSatisfied
      ? 'queue-work-completed'
      : 'queue-completion-error',
    queueCompletionMethod: method,
    ...(terminalRefluxReceipt ? { terminalRefluxReceipt } : {})
  };
}

function terminalRefluxScheduleReceipt({
  scheduleId,
  laneId,
  stateKey,
  stepCount,
  admitted = true
}) {
  return {
    schema: ULG_WORKER_RESIDENT_SCHEDULE_TERMINAL_REFLUX_RECEIPT_SCHEMA,
    status: admitted
      ? 'terminal-reflux-schedule-receipt-admitted'
      : 'terminal-reflux-receipt-rejected',
    required: true,
    scheduleId,
    laneId,
    stateKey,
    expectedStepCount: stepCount,
    observedStepCount: stepCount,
    admittedStepCount: admitted ? stepCount : Math.max(0, stepCount - 1),
    firstRejectedStepOrdinal: admitted ? null : Math.max(1, stepCount - 1),
    allStepsAdmitted: admitted
  };
}

const ROUTE_SOURCE_LINEAGE = Object.freeze({
  storageGeneration: 11,
  physicsTick: 13,
  physicsSubstep: 0,
  positionEpoch: 17,
  topologyEpoch: 19,
  chartEpoch: 23,
  levelEpoch: 29,
  supportEpoch: 31
});

function reactionTableAuthorityFixture(seed = 1) {
  const records = new Float32Array([
    seed, seed + 1, seed + 2, 300,
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
    reactionHeaderStrideFloats: SPH_GPU_REACTION_HEADER_ROW_LAYOUT.length,
    reactantTermStrideFloats:
      SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT.length,
    productTermStrideFloats: SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT.length,
    gasProductStrideFloats: SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT.length,
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

function targetScheduleAuthorityFixture({
  scheduleId,
  laneId,
  stateKey,
  stepCount,
  activationOverrides = {},
  sourceLineage = ROUTE_SOURCE_LINEAGE,
  sourceParticleCount = 64,
  sourcePhaseLaneCount = 1,
  predecessorDynamicLawObservation = null,
  predecessorTargetScheduleAuthority = null,
  prospectiveTargetConfiguration = null,
  includeReactionWatch = false,
  targetScheduleRequestId = `${scheduleId}:next-law-route`,
  reactionTableSeed = 1,
  reactionTableOverride = null,
  staticGasBoundarySource = true,
  dtS = 0.001
}) {
  const activation = routeLawActivation(activationOverrides);
  const authorizedReactionTable = reactionTableOverride
    ?? reactionTableAuthorityFixture(reactionTableSeed);
  const residentStepOptions = {
    contactSolverEnabled: activation.contactSolverRequested,
    ...(activation.explicitVacuumAmbient ? { ambientPressurePa: 0 } : {}),
    ...(activation.thermal
      ? { thermalMaterialTable: { schema: 'test-thermal-table', rowCount: 1 } }
      : {}),
    ...(activation.reaction
      ? { reactionTable: authorizedReactionTable }
      : includeReactionWatch
        ? {
            reactionActivationWatchTable:
              authorizedReactionTable
          }
        : {}),
    ...(activation.surfaceTension
      ? { mechanicsMaterialTable: { surfaceTensionEnabled: true } }
      : {}),
    ...(
      activation.gasBoundaryActionable
      && !activation.particleGasLedgerActionable
      && staticGasBoundarySource
      ? { externalGaugePressureEnabled: true }
      : {})
  };
  const hierarchyConfig = {
    enablePhaseVolumeMigration: activation.phaseVolumeMigration,
    enableTwoLevelMechanics: activation.twoLevelMechanics,
    enableLawQueue: activation.lawQueue,
    enableLawNeighborCandidates: activation.lawNeighborCandidates
  };
  const epochOptions = {
    mechanicsFieldViewsRequired: activation.mechanicsFieldViews,
    ...hierarchyConfig
  };
  const mechanicsOptions = { ...hierarchyConfig };
  return createSchroederTargetScheduleAuthority({
    sourceScheduleId: scheduleId,
    targetScheduleRequestId,
    laneId,
    stateKey,
    sourceLineage,
    sourceParticleCount,
    sourcePhaseLaneCount,
    predecessorDynamicLawObservation,
    predecessorTargetScheduleAuthority,
    prospectiveTargetConfiguration,
    maxFutureSubsteps: stepCount,
    dtS,
    gridSpacingM: 0.25,
    cflFactor: 0.4,
    boxDimsM: [5, 5, 5],
    residentStepOptions,
    epochOptions,
    mechanicsOptions,
    hierarchyConfig,
    particleGasLedgerActionable:
      activation.particleGasLedgerActionable,
    scheduleStepOptionsProvider:
      createSchroederTargetScheduleProviderAuthority({ kind: 'none' })
  });
}

function routeLawActivation(overrides = {}) {
  const receipt = {
    schema: ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA,
    thermal: false,
    reaction: false,
    contactSolver: true,
    contactSolverRequested: true,
    contactSolverEscalatedForDynamicLaws: false,
    lawQueue: false,
    lawNeighborCandidates: false,
    phaseVolumeMigration: false,
    twoLevelMechanics: false,
    surfaceTension: false,
    particleGasLedgerActionable: false,
    retainedProductGasBoundaryActionable: false,
    gasBoundaryActionable: false,
    explicitVacuumAmbient: false,
    phaseVolumeSidecars: false,
    mechanicsFieldViews: true,
    activationAuthority: 'schedule-config-static-declaration-no-readback',
    ...overrides
  };
  const nonParticleGasBoundaryActionable = Boolean(
    receipt.retainedProductGasBoundaryActionable
    || (
      receipt.gasBoundaryActionable
      && !receipt.particleGasLedgerActionable
    )
  );
  receipt.gasBoundaryActionable = Boolean(
    receipt.gasBoundaryActionable
    || receipt.particleGasLedgerActionable
    || receipt.retainedProductGasBoundaryActionable
  );
  receipt.phaseVolumeSidecars = Boolean(
    receipt.phaseVolumeMigration
    || receipt.twoLevelMechanics
    || receipt.particleGasLedgerActionable
    || receipt.retainedProductGasBoundaryActionable
  );
  if (
    Object.prototype.hasOwnProperty.call(overrides, 'contactSolver')
    && !Object.prototype.hasOwnProperty.call(
      overrides,
      'contactSolverRequested'
    )
  ) {
    receipt.contactSolverRequested = overrides.contactSolver === true;
  }
  const dynamicLawActive = Boolean(
    receipt.thermal
    || receipt.reaction
    || receipt.lawQueue
    || receipt.lawNeighborCandidates
    || receipt.phaseVolumeMigration
    || receipt.twoLevelMechanics
    || receipt.surfaceTension
    || nonParticleGasBoundaryActionable
  );
  receipt.contactSolverEscalatedForDynamicLaws =
    Object.prototype.hasOwnProperty.call(
      overrides,
      'contactSolverEscalatedForDynamicLaws'
    )
      ? overrides.contactSolverEscalatedForDynamicLaws === true
      : receipt.contactSolverRequested !== true && dynamicLawActive;
  receipt.contactSolver = Boolean(
    receipt.contactSolverRequested
    || receipt.contactSolverEscalatedForDynamicLaws
  );
  return receipt;
}

function routeActivationBlockers(activation) {
  return [
    activation.thermal ? 'thermal-active' : null,
    activation.reaction ? 'reaction-active' : null,
    activation.contactSolver ? 'contact-solver-active' : null,
    activation.lawQueue ? 'law-queue-active' : null,
    activation.lawNeighborCandidates
      ? 'law-neighbor-candidates-active'
      : null,
    activation.phaseVolumeMigration
      ? 'phase-volume-migration-active'
      : null,
    activation.twoLevelMechanics ? 'two-level-mechanics-active' : null,
    activation.surfaceTension ? 'surface-tension-active' : null,
    activation.gasBoundaryActionable ? 'gas-boundary-actionable' : null,
    activation.mechanicsFieldViews
      ? 'mechanics-field-views-required'
      : null
  ].filter(Boolean);
}

function routeParticleCardinality(sourceParticleCount, targetParticleCount) {
  return {
    schema: 'peercompute.ulg.worker-schedule-particle-cardinality.v0',
    status: 'worker-schedule-particle-cardinality-exact',
    sourceParticleCount,
    targetParticleCount,
    sourceSphStateParticleCount: sourceParticleCount,
    sourceSphUploadParticleCount: sourceParticleCount,
    sourceMlsMpmStateParticleCount: sourceParticleCount,
    sourceMlsMpmUploadParticleCount: sourceParticleCount,
    targetSphStateParticleCount: targetParticleCount,
    targetSphUploadParticleCount: targetParticleCount,
    targetMlsMpmStateParticleCount: targetParticleCount,
    targetMlsMpmUploadParticleCount: targetParticleCount,
    terminalStepParticleCount: targetParticleCount,
    exactSourceParticleFamily: true,
    exactTargetParticleFamily: true
  };
}

function tier0TopologyAttestation(particleCount) {
  return {
    schema: 'peercompute.ulg.worker-tier0-topology-attestation.v0',
    status: 'tier0-topology-quiescence-attested',
    phaseCarrierPlanSchema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    phaseCarrierPlanStatus: 'phase-lane-capacity-ready',
    lineageCapacity: particleCount,
    primaryCapacity: particleCount,
    phaseLaneCount: 1,
    phaseLaneStride: particleCount,
    companionStart: particleCount,
    companionCapacity: 0,
    particleCapacity: particleCount,
    sourceParticleCount: particleCount,
    phaseCompanionLanesRequired: false,
    identityBufferRequired: true,
    identityBufferPresent: true,
    identitySchema: 'peercompute.ulg.sph-gpu-particle-identity-buffer.v0',
    identityStrideBytes: 4,
    identityRevision: 'identity-seed-test',
    identityBufferByteLength: particleCount * 4,
    identityBufferSize: particleCount * 4,
    identityStorageUsage: true,
    identityDeviceMatched: true,
    identityAuthorityComplete: true,
    exactFourBufferFamily: true,
    exactFourBufferDeviceFamily: true,
    planMatchesParticleFamily: true
  };
}

function retainedProductWriterEvidence({
  productEventRowCount = 8,
  observedLiveRowCount = 0,
  slotId = 3,
  leaseSerial = 11,
  viewOrdinal = 7,
  countAuthorityGeneration = 19,
  countAuthoritySeal = 0x5a17_c0de,
  terminalGpuFenceSatisfied = true,
  scheduleCancelled = false,
  includeArenaIdentity = true,
  includeLiveBound = true
} = {}) {
  const arenaIdentity = includeArenaIdentity
    ? {
        schema:
          'peercompute.ulg.sph-resident-product-history-arena-identity.v0',
        status: 'retained-product-history-arena-authenticated',
        slotId,
        leaseSerial,
        viewOrdinal,
        rowCapacity: productEventRowCount,
        bufferByteLength: productEventRowCount * 80,
        rowStrideFloats: 20,
        countAuthorityGeneration,
        countAuthoritySeal
      }
    : null;
  const liveBound = includeLiveBound && arenaIdentity
    ? {
        schema:
          'peercompute.ulg.sph-product-history-live-bound-observation.v0',
        observedLiveRowCount,
        previousUpperBound: productEventRowCount,
        tightenedUpperBound: Math.min(
          productEventRowCount,
          Math.max(1, observedLiveRowCount)
        ),
        arenaRowCapacity: productEventRowCount,
        readbackByteLength: Uint32Array.BYTES_PER_ELEMENT,
        arenaIdentity: structuredClone(arenaIdentity)
      }
    : null;
  const gasBoundaryActionable = Boolean(
    arenaIdentity
    && terminalGpuFenceSatisfied
    && !scheduleCancelled
  );
  return {
    schema: ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA,
    status: gasBoundaryActionable
      ? 'worker-retained-product-gas-boundary-actionable'
      : 'worker-retained-product-gas-boundary-uncertain',
    gasBoundaryActionable,
    retainedProductGasBoundaryActionable: gasBoundaryActionable,
    source: 'worker-retained-product-event-buffer',
    productEventBufferRetained: true,
    productEventRowCount,
    productHistoryArenaIdentity: arenaIdentity,
    productHistoryLiveBoundObservation: liveBound,
    terminalGpuFenceSatisfied,
    scheduleCancelled
  };
}

function dynamicLawRoutingObservation({
  scheduleId,
  laneId,
  stateKey,
  terminalLineage,
  triggeredSourceCount = 0,
  uncertainty = false,
  producerRoute = 'canonical-schroeder',
  maxFutureSubsteps = 2,
  particleCount = 64,
  thermalPhaseEvolutionEnabled = false,
  contactCorrectionEnabled = false,
  targetScheduleAuthority = null,
  prospectiveWriterEvidence = null,
  scheduleCancelled = false
}) {
  const observationSucceeded = uncertainty !== true;
  const motionEnvelope = targetScheduleAuthority?.motionEnvelope
    ?? createSphReactionMotionEnvelope({
      maxFutureSubsteps,
      dtS: 0.001,
      gridSpacingM: 0.25,
      cflFactor: 0.4,
      boxDimsM: [5, 5, 5],
      separationDisplacementEnabled: !contactCorrectionEnabled,
      contactCorrectionEnabled,
      thermalPhaseEvolutionEnabled
    });
  const writerEvidence = prospectiveWriterEvidence ?? {
    schema: ULG_WORKER_SCHEDULE_PROSPECTIVE_WRITER_EVIDENCE_SCHEMA,
    status: 'worker-retained-product-gas-boundary-inactive',
    gasBoundaryActionable: false,
    retainedProductGasBoundaryActionable: false,
    source: null,
    productEventBufferRetained: false,
    productEventRowCount: 0,
    productHistoryArenaIdentity: null,
    productHistoryLiveBoundObservation: null,
    terminalGpuFenceSatisfied: true,
    scheduleCancelled
  };
  return {
    schema: ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA,
    status: observationSucceeded
      ? 'dynamic-law-routing-observation-ready'
      : 'dynamic-law-routing-observation-uncertain',
    sourceScheduleId: scheduleId,
    targetScheduleRequestId:
      targetScheduleAuthority?.targetScheduleRequestId ?? null,
    targetScheduleAuthorityFingerprint:
      targetScheduleAuthority?.requestFingerprint ?? null,
    laneId,
    stateKey,
    lawFamily: 'reaction',
    predicateRevision: SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION,
    predicate: SPH_REACTION_MOTION_ENVELOPE_PREDICATE,
    producerRoute,
    sampleStage: producerRoute === 'canonical-schroeder'
      ? 'canonical-terminal-published-carrier-family-motion-envelope'
      : 'tier0-terminal-post-separation-motion-envelope',
    nodeDomain: 'fixed-phase-carrier-slot',
    motionEnvelope,
    shadowOnly: SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY,
    routingAuthority: SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
    executionGating: SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE,
    observationSucceeded,
    triggered: uncertainty === true || triggeredSourceCount > 0,
    triggeredSourceCount: observationSucceeded
      ? triggeredSourceCount
      : null,
    uncertainty: !observationSucceeded,
    rawEvidenceWord: observationSucceeded
      ? triggeredSourceCount
      : 0xffff_ffff,
    particleCount,
    reactionCount: 1,
    reactionTableFingerprint:
      targetScheduleAuthority?.tableFingerprints
        ?.watchReactionTableFingerprint ?? 'fnv-test:reaction-table',
    prospectiveWriterEvidence: structuredClone(writerEvidence),
    mapAsyncCount: 1,
    readbackByteLength: Uint32Array.BYTES_PER_ELEMENT,
    fullParticleReadbackPerformed: false,
    terminalLineage: { ...terminalLineage },
    failureReason: observationSucceeded
      ? null
      : 'gpu-reaction-activation-evidence-fail-closed',
    failurePolicy: WORKER_DYNAMIC_LAW_OBSERVATION_FAILURE_POLICY
  };
}

function canonicalRouteScheduleEvidence({
  scheduleId,
  laneId,
  stateKey,
  requestedStepCount,
  completedStepCount = requestedStepCount,
  retainedBufferRefs = ['worker:state'],
  activationOverrides = {},
  sourceLineage = ROUTE_SOURCE_LINEAGE,
  targetScheduleRequestId = undefined,
  predecessorDynamicLawObservation = null,
  predecessorTargetScheduleAuthority = null,
  prospectiveTargetConfiguration = null,
  prospectiveWriterEvidence = null,
  staticGasBoundarySource = true,
  includeReactionWatch = false,
  sourcePhaseLaneCount = 1,
  generationId = 41,
  cancelled = false
}) {
  const activationReceipt = routeLawActivation(activationOverrides);
  const targetScheduleAuthority =
    activationReceipt.reaction || includeReactionWatch
    ? targetScheduleAuthorityFixture({
        scheduleId,
        laneId,
        stateKey,
        stepCount: requestedStepCount,
        activationOverrides,
        sourceLineage,
        predecessorDynamicLawObservation,
        predecessorTargetScheduleAuthority,
        prospectiveTargetConfiguration,
        includeReactionWatch,
        sourcePhaseLaneCount,
        staticGasBoundarySource,
        targetScheduleRequestId
      })
    : null;
  const target = {
    ...sourceLineage,
    storageGeneration:
      sourceLineage.storageGeneration + completedStepCount,
    physicsTick: sourceLineage.physicsTick + completedStepCount,
    positionEpoch: sourceLineage.positionEpoch + completedStepCount
  };
  const finalEpochLineage = completedStepCount === 1
    ? { ...sourceLineage }
    : {
        ...sourceLineage,
        storageGeneration:
          sourceLineage.storageGeneration + completedStepCount - 1,
        physicsTick:
          sourceLineage.physicsTick + completedStepCount - 1,
        positionEpoch:
          sourceLineage.positionEpoch + completedStepCount - 1
      };
  const finalEpochSeal = {
    schema: 'peercompute.ulg.worker-schroeder-spatial-epoch-seal.v0',
    generationId,
    deviceId: 'ulg-webgpu-device:test',
    consumerDeviceId: 'ulg-webgpu-device:test',
    directoryAbiVersion: 2,
    mechanicsLevelCount: 1,
    mechanicsLevels: [0],
    ...finalEpochLineage
  };
  const nextScheduleLawActivationObservation =
    activationReceipt.reaction || includeReactionWatch
    ? dynamicLawRoutingObservation({
        scheduleId,
        laneId,
        stateKey,
        terminalLineage: target,
        maxFutureSubsteps: requestedStepCount,
        contactCorrectionEnabled: activationReceipt.contactSolver,
        uncertainty: includeReactionWatch && !activationReceipt.reaction,
        scheduleCancelled: cancelled,
        prospectiveWriterEvidence,
        targetScheduleAuthority
      })
    : null;
  const particleCardinality = routeParticleCardinality(64, 64);
  const currentTargetConfiguration = targetScheduleAuthority == null
    ? null
    : schroederTargetScheduleConfigurationReceipt(targetScheduleAuthority);
  const predecessorTransition =
    targetScheduleAuthority?.predecessorDynamicLawTransition ?? null;
  const predecessorTargetTokenConsumption =
    predecessorDynamicLawObservation == null
      ? null
      : {
          schema:
            'peercompute.ulg.worker-predecessor-target-token-consumption.v2',
          status:
            'predecessor-target-token-consumed-before-route-selection',
          predecessorScheduleId:
            predecessorDynamicLawObservation.sourceScheduleId,
          targetScheduleRequestId:
            predecessorDynamicLawObservation.targetScheduleRequestId,
          targetScheduleAuthorityFingerprint:
            predecessorDynamicLawObservation
              .targetScheduleAuthorityFingerprint,
          consumerScheduleId: scheduleId,
          laneId,
          stateKey,
          terminalLineage: {
            ...predecessorDynamicLawObservation.terminalLineage
          },
          sourceParticleCount:
            predecessorDynamicLawObservation.particleCount,
          sourcePhaseLaneCount:
            targetScheduleAuthority.sourcePhaseLaneCount,
          conservativeActivationRequired: Boolean(
            predecessorDynamicLawObservation.prospectiveWriterEvidence
              ?.terminalGpuFenceSatisfied === true
            && predecessorDynamicLawObservation.prospectiveWriterEvidence
              ?.scheduleCancelled === false
            && (
              predecessorDynamicLawObservation.uncertainty
              || predecessorDynamicLawObservation.triggered
              || predecessorDynamicLawObservation.prospectiveWriterEvidence
                ?.gasBoundaryActionable
            )
          ),
          configurationContinuityMode: predecessorTransition == null
            ? 'exact-configuration-continuation'
            : predecessorTransition.kind
                === 'retained-product-gas-boundary-inactive-to-actionable'
              ? 'prospective-retained-product-gas-boundary-actionable'
              : 'prospective-reaction-dormant-to-executing',
          predecessorConfigurationFingerprint: predecessorTransition
            ?.sourceConfiguration?.configurationFingerprint
            ?? currentTargetConfiguration.configurationFingerprint,
          currentConfigurationFingerprint:
            currentTargetConfiguration.configurationFingerprint,
          prospectiveDynamicLawTransitionFingerprint:
            predecessorTransition?.transitionFingerprint ?? null,
          consumedBeforeRouteSelection: true,
          consumedBeforeGpuWork: true,
          shadowOnly: SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY,
          routingAuthority: SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
          executionGating: SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE
        };
  return {
    schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
    status: cancelled
      ? 'worker-resident-schedule-cancelled'
      : 'worker-resident-schedule-completed',
    requestedStepCount,
    completedStepCount,
    cancelled,
    lawActivationReceipt: activationReceipt,
    predecessorTargetTokenConsumption,
    nextScheduleLawActivationObservation,
    phaseCarrierOneToFourTransition: null,
    particleCardinality: structuredClone(particleCardinality),
    finalMechanicsLineage: { ...target },
    finalEpochIdentity: { ...finalEpochLineage },
    finalEpochSeal,
    executionRouteReceipt: {
      schema: ULG_WORKER_SCHEDULE_EXECUTION_ROUTE_RECEIPT_SCHEMA,
      status: 'canonical-schroeder-admitted',
      scheduleId,
      laneId,
      stateKey,
      route: 'canonical-schroeder',
      routeDecisionStatus: 'canonical-schroeder-selected',
      activationReceipt: { ...activationReceipt },
      targetScheduleAuthority,
      predecessorTargetTokenConsumption:
        predecessorTargetTokenConsumption == null
          ? null
          : structuredClone(predecessorTargetTokenConsumption),
      nextScheduleLawActivationObservation:
        nextScheduleLawActivationObservation == null
          ? null
          : structuredClone(nextScheduleLawActivationObservation),
      topologyAttestation: null,
      phaseCarrierOneToFourTransition: null,
      particleCardinality,
      blockers: routeActivationBlockers(activationReceipt),
      transition: 'fresh-or-canonical-continuation',
      execution: {
        requestedStepCount,
        completedStepCount,
        atomicSchedule: false,
        progressMode: 'per-canonical-step',
        cancellationMode: 'between-canonical-steps',
        preflightSchema: null,
        preflightStatus: null,
        fusedSequenceSchema: null,
        fusedSequenceStatus: null,
        submissionMode: null,
        commandSubmissionCount: null,
        submissionStepCounts: null,
        maxSubstepsPerSubmission: null,
        presentationBoundaryCount: null,
        presentationBoundaryCompletedCount: null,
        presentationBoundaryFailureCount: null,
        presentationQosHostQueueFenceCount: null,
        logicalAuthorityPublicationCount: null,
        intermediateAuthorityPublicationCount: null,
        internalPositionSubstepCount: null,
        fullParticleReadbackPerformed: null,
        fullParticleReadbackFree: null,
        mapAsyncCount: null,
        readbackBytes: null,
        residentContinuationReady: null,
        canonicalSpatialEpochGenerated: true,
        canonicalSpatialGenerationId: generationId,
        finalEpochSealRequired: true,
        terminalFenceSatisfied: true,
        sameWorkerDevice: true,
        submittedCleanupOwnership: null,
        submittedCleanupRegistrationCount: null,
        submittedCleanupRelease: null,
        phaseCarrierOneToFourMaterialized: false,
        phaseCarrierOneToFourCommandSubmissionCount: 0,
        phaseCarrierOneToFourFullParticleReadbackPerformed: false,
        phaseCarrierOneToFourSourceRetirement: null
      },
      lineage: {
        source: { ...sourceLineage },
        target: { ...target },
        storageGenerationDelta: null,
        physicsTickDelta: null,
        committedPositionEpochDelta: null,
        topologyChanged: null,
        hierarchyIdentityChanged: null,
        exactParticleFamily: true
      },
      retainedBufferRefs: [...retainedBufferRefs],
      supersededFamilyRetirement: null,
      authority: {
        workerTerminalFence: 'satisfied',
        computeManager: 'pending',
        stateManager: 'pending',
        presentation: 'pending'
      }
    }
  };
}

function oneToFourCanonicalRouteScheduleEvidence({
  scheduleId,
  laneId,
  stateKey,
  retainedBufferRefs = [
    'worker:state',
    'worker:thermo',
    'worker:identity',
    'worker:mechanics'
  ]
}) {
  const sourceParticleCount = 2;
  const terminalParticleCount = 8;
  const result = canonicalRouteScheduleEvidence({
    scheduleId,
    laneId,
    stateKey,
    requestedStepCount: 1,
    retainedBufferRefs,
    activationOverrides: { thermal: true }
  });
  const terminalTopologyLineage = {
    ...ROUTE_SOURCE_LINEAGE,
    storageGeneration: ROUTE_SOURCE_LINEAGE.storageGeneration + 1,
    topologyEpoch: ROUTE_SOURCE_LINEAGE.topologyEpoch + 1
  };
  const terminalMechanicsLineage = {
    ...terminalTopologyLineage,
    storageGeneration: terminalTopologyLineage.storageGeneration + 1,
    physicsTick: terminalTopologyLineage.physicsTick + 1,
    positionEpoch: terminalTopologyLineage.positionEpoch + 1
  };
  const sourcePlan = {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity: sourceParticleCount,
    primaryCapacity: sourceParticleCount,
    phaseLaneCount: 1,
    phaseLaneStride: sourceParticleCount,
    companionStart: sourceParticleCount,
    companionCapacity: 0,
    particleCapacity: sourceParticleCount,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
    phaseCompanionLanesRequired: false,
    reason: 'laws-quiescent-no-phase-mutation-path'
  };
  const terminalPlan = {
    ...sourcePlan,
    phaseLaneCount: 4,
    companionCapacity: sourceParticleCount * 3,
    particleCapacity: terminalParticleCount,
    phaseCompanionLanesRequired: true,
    reason:
      'static-schedule-law-activation-requires-four-phase-carrier-lanes'
  };
  const sourceRetirement = {
    schema:
      'peercompute.ulg.worker-phase-carrier-one-to-four-source-retirement.v0',
    status:
      'phase-carrier-one-to-four-source-retired-after-terminal-fence',
    terminalFenceSatisfied: true,
    sourceFamilyAdopted: true,
    retiredSourceBufferCount: 4,
    rejectedOutputRetired: false,
    submittedWorkCleanupReleased: true
  };
  const transition = {
    schema: ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_SCHEMA,
    status: 'phase-carrier-one-to-four-adopted-terminal-fence-satisfied',
    scheduleId,
    sourceParticleCount,
    terminalParticleCount,
    companionParticleCount: 6,
    countSummary: {
      schema:
        'peercompute.ulg.sph-phase-carrier-one-to-four-count-summary.v0',
      status: 'phase-carrier-one-to-four-counts-exact',
      sourceParticleCount,
      terminalParticleCount,
      companionParticleCount: 6,
      sourceToTerminalRatio: 4,
      sourceLineageCount: sourceParticleCount,
      terminalLineageCount: sourceParticleCount,
      phaseLaneCount: 4,
      phaseLaneStride: sourceParticleCount,
      stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
      terminalIndexFromSource:
        'phaseLane*sourceParticleCount+sourceParticleIndex',
      sourceIndexFromTerminal:
        'terminalParticleIndex%sourceParticleCount',
      phaseLaneFromTerminal:
        'floor(terminalParticleIndex/sourceParticleCount)',
      exactCountAuthority: true
    },
    sourcePhaseCarrierPlan: sourcePlan,
    terminalPhaseCarrierPlan: terminalPlan,
    sourceLineage: { ...ROUTE_SOURCE_LINEAGE },
    terminalLineage: terminalTopologyLineage,
    identityCorrespondence:
      'duplicate-source-render-domain-identity-across-four-fixed-phase-lanes',
    identityCorrespondenceRevision:
      ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_IDENTITY_CORRESPONDENCE_REVISION,
    materializationKernelRevision:
      ULG_SPH_PHASE_CARRIER_ONE_TO_FOUR_KERNEL_REVISION,
    sourceIdentitySchema:
      'peercompute.ulg.sph-gpu-particle-identity-buffer.v0',
    terminalIdentitySchema:
      'peercompute.ulg.sph-gpu-particle-identity-buffer.v0',
    sourceIdentityStrideBytes: 4,
    terminalIdentityStrideBytes: 4,
    sourceIdentityRevision: 'identity-seed-test',
    terminalIdentityRevision:
      'identity-seed-test:phase-carrier-1-to-4:2->8:sg12:te20',
    sourceStateBufferByteLength: sourceParticleCount * 8 * 4,
    sourceThermoBufferByteLength: sourceParticleCount * 12 * 4,
    sourceMechanicsBufferByteLength: sourceParticleCount * 32 * 4,
    sourceIdentityBufferByteLength: sourceParticleCount * 4,
    terminalStateBufferByteLength: terminalParticleCount * 8 * 4,
    terminalThermoBufferByteLength: terminalParticleCount * 12 * 4,
    terminalMechanicsBufferByteLength: terminalParticleCount * 32 * 4,
    terminalIdentityBufferByteLength: terminalParticleCount * 4,
    validationStatus: 'phase-carrier-one-to-four-execution-valid',
    validationErrorScopeStatus: 'validation-error-scope-clean',
    validationErrorScopeCount: 1,
    validationErrorObserved: false,
    auxiliaryBufferOwnershipTransfer: {
      schema:
        'peercompute.ulg.worker-phase-carrier-auxiliary-ownership-transfer.v0',
      status: 'phase-carrier-auxiliary-ownership-transferred',
      aliasedAuxiliaryBufferCount: 0,
      transferredOwnedBufferCount: 0,
      borrowedAuxiliaryBufferCount: 0,
      sourceOwnershipCleared: true,
      terminalOwnershipAdopted: true
    },
    publicationFamilies: ['state', 'thermo', 'mechanics', 'identity'],
    commandSubmissionCount: 1,
    fullParticleReadbackPerformed: false,
    mapAsyncCount: 0,
    readbackBytes: 0,
    activationAuthority: 'schedule-config-static-declaration-no-readback',
    trigger: 'static-thermal-law-active',
    routingAuthority: false,
    dynamicLawRoutingAuthority: false,
    terminalFenceSatisfied: true,
    supersededSourceRetired: true,
    sourceRetirement
  };
  Object.assign(result, {
    phaseCarrierOneToFourTransition: structuredClone(transition),
    particleCardinality: routeParticleCardinality(
      sourceParticleCount,
      terminalParticleCount
    ),
    finalMechanicsLineage: { ...terminalMechanicsLineage },
    finalEpochIdentity: { ...terminalTopologyLineage },
    finalEpochSeal: {
      ...result.finalEpochSeal,
      ...terminalTopologyLineage
    }
  });
  Object.assign(result.executionRouteReceipt, {
    topologyAttestation: tier0TopologyAttestation(sourceParticleCount),
    phaseCarrierOneToFourTransition: transition,
    particleCardinality: structuredClone(result.particleCardinality),
    transition: 'tier0-one-to-four-to-canonical-schedule-boundary',
    lineage: {
      source: { ...ROUTE_SOURCE_LINEAGE },
      target: { ...terminalMechanicsLineage },
      storageGenerationDelta: null,
      physicsTickDelta: null,
      committedPositionEpochDelta: null,
      topologyChanged: true,
      hierarchyIdentityChanged: false,
      exactParticleFamily: true
    }
  });
  Object.assign(result.executionRouteReceipt.execution, {
    phaseCarrierOneToFourMaterialized: true,
    phaseCarrierOneToFourCommandSubmissionCount: 1,
    phaseCarrierOneToFourFullParticleReadbackPerformed: false,
    phaseCarrierOneToFourSourceRetirement: sourceRetirement
  });
  return result;
}

function tier0RouteScheduleEvidence({
  scheduleId,
  laneId,
  stateKey,
  stepCount,
  retainedBufferRefs = [
    'worker:tier0:state',
    'worker:tier0:thermo',
    'worker:tier0:identity',
    'worker:tier0:mechanics'
  ],
  includeReactionWatch = false,
  submissionStepCounts = [stepCount],
  presentationBoundaryFailureCount = 0
}) {
  const activationReceipt = routeLawActivation({
    contactSolver: false,
    explicitVacuumAmbient: true,
    mechanicsFieldViews: false
  });
  const target = {
    ...ROUTE_SOURCE_LINEAGE,
    storageGeneration: ROUTE_SOURCE_LINEAGE.storageGeneration + 1,
    physicsTick: ROUTE_SOURCE_LINEAGE.physicsTick + stepCount,
    positionEpoch: ROUTE_SOURCE_LINEAGE.positionEpoch + 1
  };
  const targetScheduleAuthority = includeReactionWatch
    ? targetScheduleAuthorityFixture({
        scheduleId,
        laneId,
        stateKey,
        stepCount,
        activationOverrides: {
          contactSolver: false,
          explicitVacuumAmbient: true,
          mechanicsFieldViews: false
        },
        sourceParticleCount: 1,
        includeReactionWatch: true
      })
    : null;
  const nextScheduleLawActivationObservation = includeReactionWatch
    ? dynamicLawRoutingObservation({
        scheduleId,
        laneId,
        stateKey,
        terminalLineage: target,
        uncertainty: true,
        producerRoute: 'tier0-fused-resident-sequence',
        maxFutureSubsteps: stepCount,
        particleCount: 1,
        targetScheduleAuthority
      })
    : null;
  const particleCardinality = routeParticleCardinality(1, 1);
  const commandSubmissionCount = submissionStepCounts.length;
  const presentationBoundaryCount = Math.max(
    0,
    commandSubmissionCount - 1
  );
  const qosChunked = commandSubmissionCount > 1;
  return {
    lawActivationReceipt: activationReceipt,
    predecessorTargetTokenConsumption: null,
    nextScheduleLawActivationObservation,
    phaseCarrierOneToFourTransition: null,
    particleCardinality: structuredClone(particleCardinality),
    finalMechanicsLineage: { ...target },
    finalEpochIdentity: { ...target },
    finalEpochSeal: null,
    executionRouteReceipt: {
      schema: ULG_WORKER_SCHEDULE_EXECUTION_ROUTE_RECEIPT_SCHEMA,
      status: 'tier0-fused-resident-sequence-admitted',
      scheduleId,
      laneId,
      stateKey,
      route: 'tier0-fused-resident-sequence',
      routeDecisionStatus: 'tier0-fused-resident-sequence-selected',
      activationReceipt: { ...activationReceipt },
      targetScheduleAuthority,
      predecessorTargetTokenConsumption: null,
      nextScheduleLawActivationObservation:
        nextScheduleLawActivationObservation == null
          ? null
          : structuredClone(nextScheduleLawActivationObservation),
      topologyAttestation: tier0TopologyAttestation(1),
      phaseCarrierOneToFourTransition: null,
      particleCardinality,
      blockers: [],
      transition: 'fresh-to-tier0-schedule-boundary',
      execution: {
        requestedStepCount: stepCount,
        completedStepCount: stepCount,
        atomicSchedule: true,
        progressMode: 'terminal-only',
        cancellationMode: 'terminal-only-after-atomic-submit',
        preflightSchema:
          'peercompute.ulg.mls-mpm-fused-resident-sequence-preflight.v0',
        preflightStatus: 'fused-resident-sequence-preflight-ready',
        fusedSequenceSchema:
          'peercompute.ulg.mls-mpm-fused-resident-sequence.v0',
        fusedSequenceStatus: 'fused-resident-sequence-executed',
        submissionMode: qosChunked
          ? 'queue-ordered-presentation-qos-chunks'
          : 'single-terminal-submission',
        commandSubmissionCount,
        submissionStepCounts: [...submissionStepCounts],
        maxSubstepsPerSubmission: qosChunked
          ? Math.max(...submissionStepCounts)
          : null,
        presentationBoundaryCount,
        presentationBoundaryCompletedCount:
          presentationBoundaryCount - presentationBoundaryFailureCount,
        presentationBoundaryFailureCount,
        presentationQosHostQueueFenceCount:
          presentationBoundaryCount - presentationBoundaryFailureCount,
        logicalAuthorityPublicationCount: 1,
        intermediateAuthorityPublicationCount: 0,
        internalPositionSubstepCount: stepCount,
        fullParticleReadbackPerformed: false,
        fullParticleReadbackFree: true,
        mapAsyncCount: 0,
        readbackBytes: 0,
        residentContinuationReady: true,
        canonicalSpatialEpochGenerated: false,
        canonicalSpatialGenerationId: null,
        finalEpochSealRequired: false,
        terminalFenceSatisfied: true,
        sameWorkerDevice: true,
        submittedCleanupOwnership: 'caller-terminal-fence',
        submittedCleanupRegistrationCount: 1,
        submittedCleanupRelease: {
          schema:
            'peercompute.ulg.worker-tier0-submitted-cleanup-release.v0',
          status:
            'tier0-submitted-cleanup-released-after-terminal-fence',
          terminalFenceSatisfied: true,
          registeredCount: 1,
          releasedCount: 1,
          failedCount: 0
        },
        phaseCarrierOneToFourMaterialized: false,
        phaseCarrierOneToFourCommandSubmissionCount: 0,
        phaseCarrierOneToFourFullParticleReadbackPerformed: false,
        phaseCarrierOneToFourSourceRetirement: null
      },
      lineage: {
        source: { ...ROUTE_SOURCE_LINEAGE },
        target: { ...target },
        storageGenerationDelta: 1,
        physicsTickDelta: stepCount,
        committedPositionEpochDelta: 1,
        topologyChanged: false,
        hierarchyIdentityChanged: false,
        exactParticleFamily: true
      },
      retainedBufferRefs: [...retainedBufferRefs],
      supersededFamilyRetirement: {
        schema:
          'peercompute.ulg.worker-tier0-superseded-family-retirement.v0',
        status:
          'tier0-superseded-family-retired-after-terminal-fence',
        terminalFenceSatisfied: true,
        retiredBufferCount: 3,
        seedAssignmentRetired: true
      },
      authority: {
        workerTerminalFence: 'satisfied',
        computeManager: 'pending',
        stateManager: 'pending',
        presentation: 'pending'
      }
    }
  };
}

function tier0ScheduleResult({
  scheduleId,
  laneId,
  stateKey,
  stepCount = 3,
  retainedBufferRefs = [
    'worker:tier0:state',
    'worker:tier0:thermo',
    'worker:tier0:identity',
    'worker:tier0:mechanics'
  ],
  includeReactionWatch = false,
  submissionStepCounts = [stepCount],
  presentationBoundaryFailureCount = 0
}) {
  return {
    schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
    status: 'worker-resident-schedule-completed',
    scheduleId,
    laneId,
    stateKey,
    requestedStepCount: stepCount,
    completedStepCount: stepCount,
    cancelled: false,
    retainedBufferRefs: [...retainedBufferRefs],
    ...tier0RouteScheduleEvidence({
      scheduleId,
      laneId,
      stateKey,
      stepCount,
      retainedBufferRefs,
      includeReactionWatch,
      submissionStepCounts,
      presentationBoundaryFailureCount
    }),
    gpuFence: terminalScheduleFence({
      scheduleId,
      laneId,
      stateKey,
      completedStepCount: stepCount
    })
  };
}

test('worker hierarchy config freezes every executable switch, including false', () => {
  const enabled = createSchroederWorkerHierarchyConfig({
    selectedLevel: 1,
    baseGridSpacingM: 0.125,
    minLevel: 0,
    maxLevel: 1,
    tileCellCount: 8,
    spatialArenaCount: 4,
    enableTwoLevelMechanics: true,
    twoLevelMechanicsAuthority: 'authoritative',
    twoLevelFineSubstepCount: 4,
    enableMechanicsFieldPairV2: true,
    enablePortableSummary: true,
    enableActiveNodeIndex: true,
    enableActiveNodeSortedIndex: true,
    activeNodeSortedIndexPolicyMode: 'canonical-radix',
    lawNeighborTraversalPolicyMode: 'exact-near-cell-tree',
    lawNeighborCandidateReadbackMode: 'compact-terminal',
    enableLawQueue: true,
    enableLawNeighborCandidates: true,
    enableCrossLevelCoupling: true,
    enablePhaseVolumeMigration: true
  });
  assert.equal(enabled.schema, ULG_SCHROEDER_WORKER_HIERARCHY_CONFIG_SCHEMA);
  assert.equal(enabled.status, 'schroeder-worker-hierarchy-config-ready');
  assert.equal(Object.isFrozen(enabled), true);
  assert.equal(enabled.enableTwoLevelMechanics, true);
  assert.equal(enabled.twoLevelMechanicsAuthority, 'authoritative');
  assert.equal(enabled.twoLevelFineSubstepCount, 4);
  assert.equal(enabled.enableLawQueue, true);
  assert.equal(enabled.enableLawNeighborCandidates, true);
  assert.equal(enabled.enableCrossLevelCoupling, true);
  assert.equal(enabled.enablePhaseVolumeMigration, true);
  assert.deepEqual(structuredClone(enabled), { ...enabled });
  assert.equal(
    createSchroederWorkerHierarchyConfig({ ...enabled }).signature,
    enabled.signature,
    'the exact executable graph must have one deterministic lane signature'
  );

  const disabled = createSchroederWorkerHierarchyConfig({
    selectedLevel: 0,
    minLevel: 0,
    maxLevel: 0,
    enableTwoLevelMechanics: false,
    enableMechanicsFieldPairV2: false,
    enablePortableSummary: false,
    enableActiveNodeIndex: false,
    enableActiveNodeSortedIndex: false,
    enableLawQueue: false,
    enableLawNeighborCandidates: false,
    enableCrossLevelCoupling: false,
    enablePhaseVolumeMigration: false
  });
  for (const field of [
    'enableTwoLevelMechanics',
    'enableMechanicsFieldPairV2',
    'enablePortableSummary',
    'enableActiveNodeIndex',
    'enableActiveNodeSortedIndex',
    'enableLawQueue',
    'enableLawNeighborCandidates',
    'enableCrossLevelCoupling',
    'enablePhaseVolumeMigration'
  ]) {
    assert.equal(disabled[field], false, `${field} must cross the boundary as false`);
  }
  assert.notEqual(disabled.signature, enabled.signature);

  assert.throws(
    () => createSchroederWorkerHierarchyConfig({ minLevel: 2, maxLevel: 1 }),
    /minLevel/
  );
  assert.throws(
    () => createSchroederWorkerHierarchyConfig({
      selectedLevel: 2,
      minLevel: 0,
      maxLevel: 1
    }),
    /selectedLevel/
  );
  assert.throws(
    () => createSchroederWorkerHierarchyConfig({
      enableTwoLevelMechanics: true,
      twoLevelMechanicsAuthority: 'authoritative',
      twoLevelFineSubstepCount: 1
    }),
    /at least two fine substeps/
  );
  assert.throws(
    () => createSchroederWorkerHierarchyConfig({ twoLevelFineSubstepCount: 5 }),
    /expected an integer/
  );
});

test('worker-lane sequence contract exposes the hierarchy and presentation dependencies', () => {
  const contract = createSchroederWorkerLaneSequenceContract({
    laneId: 'lane:a',
    stateKey: 'state:a',
    stepCount: 16
  });
  assert.equal(contract.schema, ULG_SCHROEDER_WORKER_LANE_SEQUENCE_CONTRACT_SCHEMA);
  assert.equal(contract.authority, 'NodeKernel/ComputeManager/StateManager');
  assert.equal(contract.executionOwner, 'offscreen-presentation-worker');
  assert.equal(contract.stepCount, 16);
  assert.equal(contract.defaultEnabled, true);
  assert.equal(
    contract.routeSelectionAuthority,
    'peercompute.ulg.worker-schedule-execution-route-decision.v0'
  );
  assert.equal(
    contract.lawActivationEvidence,
    ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA
  );
  assert.deepEqual(
    contract.executionRouteProfiles.map((profile) => profile.id),
    ['tier0-fused-resident-sequence', 'canonical-schroeder']
  );
  assert.deepEqual(
    contract.executionRouteProfiles[0].stageIds,
    ['tier0FusedResidentSequence', 'residentRenderCandidate']
  );
  assert.equal(
    contract.executionRouteProfiles[0].canonicalSpatialEpochRequired,
    false
  );
  assert.equal(
    contract.executionRouteProfiles[1].canonicalSpatialEpochRequired,
    true
  );
  assert.deepEqual(
    contract.passDagStages.map((stage) => stage.id),
    ['schroederSpatialEpoch', 'schroederHierarchyMechanics', 'residentRenderCandidate']
  );
  assert.deepEqual(
    contract.passDagStages[1].dependsOn,
    ['schroederSpatialEpoch']
  );
  assert.deepEqual(
    contract.passDagStages[2].dependsOn,
    ['schroederHierarchyMechanics']
  );
});

test('seed upload budget counts each cloneable particle row family exactly once', () => {
  assert.equal(estimateSchroederWorkerLaneSeedUploadBytes({
    sphParticleState: {
      state: new Float32Array(8),
      thermo: new Float32Array(12),
      identity: new Uint32Array(4)
    },
    mlsMpmParticleState: { mechanics: new Float32Array(16) }
  }), (8 + 12 + 4 + 16) * 4);
});

test('resident step options cross the worker boundary without functions or page GPU resources', () => {
  const gpuBuffer = { destroy() {}, byteLength: 256 };
  const dormantReactionWatchRecords = new Float32Array([1, 2, 3, 4]);
  const options = createSchroederWorkerResidentStepOptions({
    internalPressureScale: 0.75,
    gasPressureMechanicsBoundaryEnabled: true,
    particleGasLedgerActionable: false,
    stageMechanicsTraceEnabled: true,
    thermalMaterialTable: {
      rows: new Float32Array([1, 2, 3]),
      helper() {},
      deviceBuffer: gpuBuffer
    },
    thermalStepOptions: {
      conductionRate: 0.2,
      thermalResponseGraphUpload: { stateBuffer: gpuBuffer }
    },
    reactionTable: null,
    reactionActivationWatchTable: {
      schema: 'peercompute.ulg.sph-gpu-reaction-table.v1',
      reactionCount: 1,
      combinedRecords: dormantReactionWatchRecords
    },
    p2gRunner() {},
    device: { createCommandEncoder() {} }
  });
  assert.equal(options.internalPressureScale, 0.75);
  assert.equal(options.gasPressureMechanicsBoundaryEnabled, true);
  assert.equal(options.particleGasLedgerActionable, false);
  assert.equal(options.stageMechanicsTraceEnabled, true);
  assert.deepEqual([...options.thermalMaterialTable.rows], [1, 2, 3]);
  assert.equal(options.thermalMaterialTable.helper, undefined);
  assert.equal(options.thermalMaterialTable.deviceBuffer, undefined);
  assert.equal(options.thermalStepOptions.thermalResponseGraphUpload, undefined);
  assert.equal(options.reactionTable, null);
  assert.equal(options.reactionActivationWatchTable.reactionCount, 1);
  assert.notEqual(
    options.reactionActivationWatchTable.combinedRecords,
    dormantReactionWatchRecords
  );
  assert.deepEqual(
    [...options.reactionActivationWatchTable.combinedRecords],
    [...dormantReactionWatchRecords]
  );
  assert.equal(options.p2gRunner, undefined);
  assert.doesNotThrow(() => structuredClone(options));
});

test('particle gas actionability distinguishes writers from a dormant reaction watch and latches prior evidence', () => {
  const dormantGasWatch = {
    reactionActivationWatchTable: { gasProductCount: 1 }
  };
  assert.equal(
    schroederParticleGasLedgerActionableForResidentStepOptions({
      residentStepOptions: dormantGasWatch
    }),
    false,
    'a dormant envelope watch cannot write gas'
  );
  assert.equal(
    schroederParticleGasLedgerActionableForResidentStepOptions({
      residentStepOptions: {
        reactionTable: { gasProductCount: 0 }
      }
    }),
    false,
    'a condensed-only executing reaction does not activate particle gas'
  );
  assert.equal(
    schroederParticleGasLedgerActionableForResidentStepOptions({
      residentStepOptions: {
        reactionTable: { gasProductCount: 1 }
      }
    }),
    true
  );
  assert.equal(
    schroederParticleGasLedgerActionableForResidentStepOptions({
      residentStepOptions: { thermalMaterialTable: {} }
    }),
    true,
    'an active phase writer prospectively authorizes gas classification'
  );
  assert.equal(
    schroederParticleGasLedgerActionableForResidentStepOptions({
      priorActionable: true,
      residentStepOptions: dormantGasWatch
    }),
    true,
    'retained gas evidence is monotonic until the lane is reset'
  );
});

test('worker schedule is leased by ComputeManager and committed through StateManager', async () => {
  const fixture = authorityFixture();
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: fixture.computeManager,
    stateManager: fixture.stateManager,
    laneId: 'lane:a',
    stateKey: 'state:a',
    scheduleId: 'schedule:1',
    stepCount: 16,
    seedRequired: true,
    seedUploadBytes: 4096,
    executeSchedule: async ({ lease, residentSequenceLaneContract }) => {
      assert.equal(lease.laneId, 'lane:a');
      assert.equal(residentSequenceLaneContract.stepCount, 16);
      return {
        schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
        status: 'worker-resident-schedule-completed',
        scheduleId: 'schedule:1',
        laneId: 'lane:a',
        stateKey: 'state:a',
        completedStepCount: 16,
        retainedBufferRefs: ['worker:state', 'worker:thermo'],
        ...canonicalRouteScheduleEvidence({
          scheduleId: 'schedule:1',
          laneId: 'lane:a',
          stateKey: 'state:a',
          requestedStepCount: 16,
          retainedBufferRefs: ['worker:state', 'worker:thermo']
        }),
        gpuFence: terminalScheduleFence({
          scheduleId: 'schedule:1',
          laneId: 'lane:a',
          stateKey: 'state:a',
          completedStepCount: 16,
          method: 'queue.onSubmittedWorkDone'
        })
      };
    }
  });
  assert.equal(result.status, 'state-manager-committed-worker-schedule');
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(
    result.computeManagerCompletion.schema,
    ULG_SCHROEDER_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA
  );
  assert.equal(result.computeManagerCompletion.status, 'completed');
  assert.equal(
    result.computeManagerCompletion.leaseId,
    'lane:a:lease:test'
  );
  assert.equal(result.stateManagerCommit.accepted, true);
  assert.equal(result.stateManagerCommit.status, 'committed');
  assert.deepEqual(fixture.calls.map(([kind]) => kind), [
    'acquire',
    'complete',
    'commit'
  ]);
  assert.equal(fixture.calls[0][1].copyBudget.uploadBytes, 4096);
  assert.equal(
    fixture.calls[0][1].copyBudget.readbackBytes,
    2 * Uint32Array.BYTES_PER_ELEMENT
  );
  assert.equal(fixture.activeLeases.size, 0);
});

test('a presealed dormant reaction watch admits exactly one authoritative S0-to-S1 activation', async () => {
  const scheduleId = 'schedule:prospective-reaction:s0';
  const successorScheduleId = 'schedule:prospective-reaction:s1';
  const laneId = 'lane:prospective-reaction';
  const stateKey = 'state:prospective-reaction';
  const stepCount = 2;
  // Production SS presets enter this transition with the canonical
  // four-carrier family already provisioned by thermal/contact laws. The
  // isolated Tier0 one-to-four successor is proven in the worker integration
  // suite below; this control-plane proof covers the production phase-4 path.
  const sourcePhaseLaneCount = 4;
  const sourceActivation = { contactSolver: false };
  const targetActivation = { reaction: true, contactSolver: false };
  const retainedBufferRefs = ['worker:prospective-reaction'];
  const targetPrototype = targetScheduleAuthorityFixture({
    scheduleId: 'schedule:prospective-reaction:prototype',
    laneId,
    stateKey,
    stepCount,
    sourcePhaseLaneCount,
    activationOverrides: targetActivation
  });
  const prospectiveTargetConfiguration =
    schroederTargetScheduleConfigurationReceipt(targetPrototype);
  const s0Evidence = canonicalRouteScheduleEvidence({
    scheduleId,
    laneId,
    stateKey,
    requestedStepCount: stepCount,
    retainedBufferRefs,
    activationOverrides: sourceActivation,
    sourcePhaseLaneCount,
    includeReactionWatch: true,
    targetScheduleRequestId: successorScheduleId,
    prospectiveTargetConfiguration,
    generationId: 201
  });
  const s0Authority = s0Evidence.executionRouteReceipt
    .targetScheduleAuthority;
  const prospectiveTransition = s0Authority
    .prospectiveDynamicLawTransition;
  assert.equal(
    prospectiveTransition.kind,
    'reaction-dormant-watch-to-executing-reaction'
  );
  assert.equal(
    prospectiveTransition.sourceConfiguration.writerSet.reaction,
    false
  );
  assert.equal(
    prospectiveTransition.targetConfiguration.writerSet.reaction,
    true
  );
  assert.equal(
    prospectiveTransition.sourceConfiguration.tableFingerprints
      .watchReactionTableDomainFingerprint,
    prospectiveTransition.targetConfiguration.tableFingerprints
      .watchReactionTableDomainFingerprint
  );
  assert.equal(
    prospectiveTransition.shadowOnly,
    SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
  );
  assert.equal(
    prospectiveTransition.routingAuthority,
    SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
  );
  assert.equal(
    prospectiveTransition.executionGating,
    SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE
  );
  const invalidProspectiveTargets = [
    targetScheduleAuthorityFixture({
      scheduleId: 'schedule:prospective-reaction:table-substitution',
      laneId,
      stateKey,
      stepCount,
      activationOverrides: targetActivation,
      reactionTableSeed: 2
    }),
    targetScheduleAuthorityFixture({
      scheduleId: 'schedule:prospective-reaction:unrelated-thermal',
      laneId,
      stateKey,
      stepCount,
      activationOverrides: {
        ...targetActivation,
        thermal: true
      }
    }),
    targetScheduleAuthorityFixture({
      scheduleId: 'schedule:prospective-reaction:horizon-drift',
      laneId,
      stateKey,
      stepCount: stepCount + 1,
      activationOverrides: targetActivation
    })
  ].map((authority) => schroederTargetScheduleConfigurationReceipt(authority));
  for (const invalidTarget of invalidProspectiveTargets) {
    assert.throws(
      () => targetScheduleAuthorityFixture({
        scheduleId,
        targetScheduleRequestId: successorScheduleId,
        laneId,
        stateKey,
        stepCount,
        activationOverrides: sourceActivation,
        includeReactionWatch: true,
        prospectiveTargetConfiguration: invalidTarget
      }),
      /one exact admitted writer delta/
    );
  }

  const zeroObservation = dynamicLawRoutingObservation({
    scheduleId,
    laneId,
    stateKey,
    terminalLineage: s0Evidence.finalMechanicsLineage,
    triggeredSourceCount: 0,
    contactCorrectionEnabled: false,
    targetScheduleAuthority: s0Authority
  });
  assert.throws(
    () => targetScheduleAuthorityFixture({
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      stepCount,
      activationOverrides: targetActivation,
      sourcePhaseLaneCount,
      sourceLineage: s0Evidence.finalMechanicsLineage,
      predecessorDynamicLawObservation: zeroObservation,
      predecessorTargetScheduleAuthority: s0Authority
    }),
    /not prospectively authorized/
  );
  const cancelledObservation = dynamicLawRoutingObservation({
    scheduleId,
    laneId,
    stateKey,
    terminalLineage: s0Evidence.finalMechanicsLineage,
    uncertainty: true,
    scheduleCancelled: true,
    contactCorrectionEnabled: false,
    targetScheduleAuthority: s0Authority
  });
  cancelledObservation.rawEvidenceWord = null;
  cancelledObservation.mapAsyncCount = 0;
  cancelledObservation.readbackByteLength = 0;
  cancelledObservation.failureReason =
    'reaction-activation-observation-not-sampled-after-partial-cancellation';
  assert.throws(
    () => targetScheduleAuthorityFixture({
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      stepCount,
      activationOverrides: targetActivation,
      sourcePhaseLaneCount,
      sourceLineage: s0Evidence.finalMechanicsLineage,
      predecessorDynamicLawObservation: cancelledObservation,
      predecessorTargetScheduleAuthority: s0Authority
    }),
    /not prospectively authorized/,
    'partial cancellation must not activate a presealed dynamic-law transition'
  );
  const triggeredObservation = dynamicLawRoutingObservation({
    scheduleId,
    laneId,
    stateKey,
    terminalLineage: s0Evidence.finalMechanicsLineage,
    triggeredSourceCount: 1,
    contactCorrectionEnabled: false,
    targetScheduleAuthority: s0Authority
  });
  const triggeredSuccessorAuthority = targetScheduleAuthorityFixture({
    scheduleId: successorScheduleId,
    laneId,
    stateKey,
    stepCount,
    activationOverrides: targetActivation,
    sourcePhaseLaneCount,
    sourceLineage: s0Evidence.finalMechanicsLineage,
    predecessorDynamicLawObservation: triggeredObservation,
    predecessorTargetScheduleAuthority: s0Authority
  });
  assert.equal(
    triggeredSuccessorAuthority.predecessorDynamicLawTransition
      .transitionFingerprint,
    prospectiveTransition.transitionFingerprint
  );

  const cancelledManagers = authorityFixture();
  const cancelledS0Evidence = canonicalRouteScheduleEvidence({
    scheduleId,
    laneId,
    stateKey,
    requestedStepCount: stepCount,
    completedStepCount: 1,
    retainedBufferRefs,
    activationOverrides: sourceActivation,
    sourcePhaseLaneCount,
    includeReactionWatch: true,
    targetScheduleRequestId: successorScheduleId,
    prospectiveTargetConfiguration,
    generationId: 202,
    cancelled: true
  });
  for (const observation of [
    cancelledS0Evidence.nextScheduleLawActivationObservation,
    cancelledS0Evidence.executionRouteReceipt
      .nextScheduleLawActivationObservation
  ]) {
    observation.rawEvidenceWord = null;
    observation.mapAsyncCount = 0;
    observation.readbackByteLength = 0;
  }
  const cancelledS0Authority = cancelledS0Evidence.executionRouteReceipt
    .targetScheduleAuthority;
  const cancelledS0Result = {
    scheduleId,
    laneId,
    stateKey,
    retainedBufferRefs,
    ...cancelledS0Evidence,
    gpuFence: terminalScheduleFence({
      scheduleId,
      laneId,
      stateKey,
      completedStepCount: 1
    })
  };
  const cancelledS0 = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: cancelledManagers.computeManager,
    stateManager: cancelledManagers.stateManager,
    scheduleId,
    laneId,
    stateKey,
    stepCount,
    targetScheduleAuthority: cancelledS0Authority,
    executeSchedule: async () => cancelledS0Result
  });
  assert.equal(cancelledS0.scheduleResult.cancelled, true);
  const forgedCancellationObservation =
    cancelledS0.scheduleResult.nextScheduleLawActivationObservation;
  const cancelledCallCount = cancelledManagers.calls.length;
  assert.throws(
    () => canonicalRouteScheduleEvidence({
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      requestedStepCount: stepCount,
      retainedBufferRefs,
      activationOverrides: targetActivation,
      sourcePhaseLaneCount,
      sourceLineage: cancelledS0Result.finalMechanicsLineage,
      predecessorDynamicLawObservation: forgedCancellationObservation,
      predecessorTargetScheduleAuthority: cancelledS0Authority,
      generationId: 203
    }),
    /not prospectively authorized/,
    'a cancelled predecessor cannot even mint an executable successor authority'
  );
  assert.equal(cancelledManagers.calls.length, cancelledCallCount);

  const lossManagers = authorityFixture();
  const lossS0Result = {
    scheduleId,
    laneId,
    stateKey,
    retainedBufferRefs,
    ...s0Evidence,
    gpuFence: terminalScheduleFence({
      scheduleId,
      laneId,
      stateKey,
      completedStepCount: stepCount
    })
  };
  const lossS0 = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: lossManagers.computeManager,
    stateManager: lossManagers.stateManager,
    scheduleId,
    laneId,
    stateKey,
    stepCount,
    targetScheduleAuthority: s0Authority,
    executeSchedule: async () => lossS0Result
  });
  const lossObservation =
    lossS0.scheduleResult.nextScheduleLawActivationObservation;
  const lossS1Evidence = canonicalRouteScheduleEvidence({
    scheduleId: successorScheduleId,
    laneId,
    stateKey,
    requestedStepCount: stepCount,
    retainedBufferRefs,
    activationOverrides: targetActivation,
    sourcePhaseLaneCount,
    sourceLineage: lossS0Result.finalMechanicsLineage,
    predecessorDynamicLawObservation: lossObservation,
    predecessorTargetScheduleAuthority: s0Authority,
    generationId: 204
  });
  const lossS1Authority = lossS1Evidence.executionRouteReceipt
    .targetScheduleAuthority;
  const simulatedLoss = new Error('simulated device loss after token burn');
  simulatedLoss.code = 'GPU_DEVICE_LOST';
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: lossManagers.computeManager,
      stateManager: lossManagers.stateManager,
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      stepCount,
      targetScheduleAuthority: lossS1Authority,
      predecessorTargetScheduleAuthority: s0Authority,
      predecessorDynamicLawObservation: lossObservation,
      executeSchedule: async () => {
        throw simulatedLoss;
      }
    }),
    simulatedLoss
  );
  assert.deepEqual(
    lossManagers.calls.slice(-2).map(([kind]) => kind),
    ['acquire', 'reject']
  );
  const lossConsumptionTaskId =
    `ulg:schroeder-predecessor-target-token-consumption:${successorScheduleId}`;
  assert.equal(
    lossManagers.stateManager.getWarmDeltas('ulg-sph-resident-pass-dag')
      [lossConsumptionTaskId]?.payload?.status,
    'predecessor-target-token-consumed-before-lease-acquisition'
  );
  const lossCallCountBeforeReplay = lossManagers.calls.length;
  let lossReplayExecuted = false;
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: lossManagers.computeManager,
      stateManager: lossManagers.stateManager,
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      stepCount,
      targetScheduleAuthority: lossS1Authority,
      predecessorTargetScheduleAuthority: s0Authority,
      predecessorDynamicLawObservation: lossObservation,
      executeSchedule: async () => {
        lossReplayExecuted = true;
        return lossS1Evidence;
      }
    }),
    (error) => {
      assert.equal(error.reason, 'predecessor-target-token-replayed');
      return true;
    }
  );
  assert.equal(lossReplayExecuted, false);
  assert.equal(lossManagers.calls.length, lossCallCountBeforeReplay);

  const managers = authorityFixture();
  const admittedS0Result = {
    scheduleId,
    laneId,
    stateKey,
    retainedBufferRefs,
    ...s0Evidence,
    gpuFence: terminalScheduleFence({
      scheduleId,
      laneId,
      stateKey,
      completedStepCount: stepCount
    })
  };
  const s0 = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: managers.computeManager,
    stateManager: managers.stateManager,
    scheduleId,
    laneId,
    stateKey,
    stepCount,
    targetScheduleAuthority: s0Authority,
    executeSchedule: async () => admittedS0Result
  });
  const observation = s0.scheduleResult.nextScheduleLawActivationObservation;
  assert.equal(observation.uncertainty, true);
  assert.equal(observation.triggered, true);

  const s1Evidence = canonicalRouteScheduleEvidence({
    scheduleId: successorScheduleId,
    laneId,
    stateKey,
    requestedStepCount: stepCount,
    retainedBufferRefs,
    activationOverrides: targetActivation,
    sourcePhaseLaneCount,
    sourceLineage: admittedS0Result.finalMechanicsLineage,
    predecessorDynamicLawObservation: observation,
    predecessorTargetScheduleAuthority: s0Authority,
    generationId: 203
  });
  const s1Authority = s1Evidence.executionRouteReceipt
    .targetScheduleAuthority;
  assert.equal(
    s1Authority.predecessorDynamicLawTransition.transitionFingerprint,
    prospectiveTransition.transitionFingerprint
  );
  const admittedS1Result = {
    scheduleId: successorScheduleId,
    laneId,
    stateKey,
    retainedBufferRefs,
    ...s1Evidence,
    gpuFence: terminalScheduleFence({
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      completedStepCount: stepCount
    })
  };
  let releaseS1Execution;
  const s1ExecutionGate = new Promise((resolve) => {
    releaseS1Execution = resolve;
  });
  let s1ExecutionEntered = false;
  const s1Promise = runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: managers.computeManager,
    stateManager: managers.stateManager,
    scheduleId: successorScheduleId,
    laneId,
    stateKey,
    stepCount,
    targetScheduleAuthority: s1Authority,
    predecessorTargetScheduleAuthority: s0Authority,
    predecessorDynamicLawObservation: observation,
    executeSchedule: async () => {
      s1ExecutionEntered = true;
      await s1ExecutionGate;
      return admittedS1Result;
    }
  });
  assert.equal(s1ExecutionEntered, true);
  const consumptionTaskId =
    `ulg:schroeder-predecessor-target-token-consumption:${successorScheduleId}`;
  const inFlightWarmEntries = managers.stateManager.getWarmDeltas(
    'ulg-sph-resident-pass-dag'
  );
  assert.equal(
    inFlightWarmEntries[consumptionTaskId]?.payload?.status,
    'predecessor-target-token-consumed-before-lease-acquisition'
  );
  assert.equal(
    inFlightWarmEntries[
      `ulg:schroeder-worker-schedule:${successorScheduleId}`
    ],
    undefined,
    'the one-use burn must exist before the successor final commit'
  );
  const callCountBeforeConcurrentReplay = managers.calls.length;
  let concurrentReplayExecuted = false;
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: managers.computeManager,
      stateManager: managers.stateManager,
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      stepCount,
      targetScheduleAuthority: s1Authority,
      predecessorTargetScheduleAuthority: s0Authority,
      predecessorDynamicLawObservation: observation,
      executeSchedule: async () => {
        concurrentReplayExecuted = true;
        return admittedS1Result;
      }
    }),
    (error) => {
      assert.equal(error.reason, 'predecessor-target-token-replayed');
      return true;
    }
  );
  assert.equal(concurrentReplayExecuted, false);
  assert.equal(managers.calls.length, callCountBeforeConcurrentReplay);
  releaseS1Execution();
  const s1 = await s1Promise;
  assert.equal(
    s1.predecessorTargetTokenAdmission.configurationContinuityMode,
    'prospective-reaction-dormant-to-executing'
  );
  assert.equal(
    s1.predecessorTargetTokenAdmission
      .prospectiveDynamicLawTransitionFingerprint,
    prospectiveTransition.transitionFingerprint
  );
  assert.equal(
    s1.predecessorTargetTokenConsumption.workerConsumption
      .configurationContinuityMode,
    'prospective-reaction-dormant-to-executing'
  );
  assert.equal(
    s1.stateManagerCommit.warmEntry.payload
      .predecessorTargetTokenConsumption.workerConsumption
      .prospectiveDynamicLawTransitionFingerprint,
    prospectiveTransition.transitionFingerprint
  );
  const callCountBeforeReplay = managers.calls.length;
  let replayExecuted = false;
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: managers.computeManager,
      stateManager: managers.stateManager,
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      stepCount,
      targetScheduleAuthority: s1Authority,
      predecessorTargetScheduleAuthority: s0Authority,
      predecessorDynamicLawObservation: observation,
      executeSchedule: async () => {
        replayExecuted = true;
        return admittedS1Result;
      }
    }),
    (error) => {
      assert.equal(error.reason, 'predecessor-target-token-replayed');
      return true;
    }
  );
  assert.equal(replayExecuted, false);
  assert.equal(managers.calls.length, callCountBeforeReplay);
});

test('a fenced retained-product owner admits one exact S1-to-S2 gas writer transition', async () => {
  const scheduleId = 'schedule:retained-product:s1';
  const successorScheduleId = 'schedule:retained-product:s2';
  const continuationScheduleId = 'schedule:retained-product:s3';
  const laneId = 'lane:retained-product';
  const stateKey = 'state:retained-product';
  const stepCount = 1;
  const retainedBufferRefs = ['worker:retained-product'];
  const sourceActivation = {
    reaction: true,
    contactSolver: false,
    explicitVacuumAmbient: true,
    mechanicsFieldViews: false
  };
  const targetActivation = {
    ...sourceActivation,
    retainedProductGasBoundaryActionable: true,
    mechanicsFieldViews: true
  };
  const retainedTargetConfiguration = (maxFutureSubsteps) =>
    createSchroederTargetScheduleConfiguration({
      maxFutureSubsteps,
      dtS: 0.001,
      gridSpacingM: 0.25,
      cflFactor: 0.4,
      boxDimsM: [5, 5, 5],
      residentStepOptions: {
        contactSolverEnabled: false,
        ambientPressurePa: 0,
        reactionTable: reactionTableAuthorityFixture(1)
      },
      epochOptions: {
        mechanicsFieldViewsRequired: true,
        enablePhaseVolumeMigration: false,
        enableTwoLevelMechanics: false,
        enableLawQueue: false,
        enableLawNeighborCandidates: false
      },
      mechanicsOptions: {
        enablePhaseVolumeMigration: false,
        enableTwoLevelMechanics: false,
        enableLawQueue: false,
        enableLawNeighborCandidates: false
      },
      hierarchyConfig: {
        enablePhaseVolumeMigration: false,
        enableTwoLevelMechanics: false,
        enableLawQueue: false,
        enableLawNeighborCandidates: false
      },
      scheduleStepOptionsProvider:
        createSchroederTargetScheduleProviderAuthority({ kind: 'none' }),
      retainedProductGasBoundaryActionable: true
    });
  const prospectiveTargetConfiguration =
    retainedTargetConfiguration(stepCount);
  const zeroLiveWriterEvidence = retainedProductWriterEvidence({
    observedLiveRowCount: 0
  });
  const s1Evidence = canonicalRouteScheduleEvidence({
    scheduleId,
    laneId,
    stateKey,
    requestedStepCount: stepCount,
    retainedBufferRefs,
    activationOverrides: sourceActivation,
    targetScheduleRequestId: successorScheduleId,
    prospectiveTargetConfiguration,
    prospectiveWriterEvidence: zeroLiveWriterEvidence,
    generationId: 211
  });
  const s1Authority = s1Evidence.executionRouteReceipt
    .targetScheduleAuthority;
  const prospectiveTransition = s1Authority.prospectiveDynamicLawTransition;
  assert.equal(
    prospectiveTransition.kind,
    'retained-product-gas-boundary-inactive-to-actionable'
  );
  assert.equal(prospectiveTransition.sourceConfiguration.writerSet.reaction, true);
  assert.equal(
    prospectiveTransition.sourceConfiguration.writerSet.gasBoundaryActionable,
    false
  );
  assert.equal(
    prospectiveTransition.sourceConfiguration.writerSet
      .retainedProductGasBoundaryActionable,
    false
  );
  assert.equal(
    prospectiveTransition.targetConfiguration.writerSet.gasBoundaryActionable,
    true
  );
  assert.equal(
    prospectiveTransition.targetConfiguration.writerSet
      .retainedProductGasBoundaryActionable,
    true
  );
  assert.equal(
    prospectiveTransition.sourceConfiguration.writerSet.mechanicsFieldViews,
    false
  );
  assert.equal(
    prospectiveTransition.targetConfiguration.writerSet.mechanicsFieldViews,
    true
  );
  assert.deepEqual(
    prospectiveTransition.sourceConfiguration.motionEnvelope,
    prospectiveTransition.targetConfiguration.motionEnvelope
  );
  assert.deepEqual(
    prospectiveTransition.sourceConfiguration.tableFingerprints,
    prospectiveTransition.targetConfiguration.tableFingerprints
  );
  assert.equal(
    prospectiveTransition.shadowOnly,
    SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
  );
  assert.equal(
    prospectiveTransition.routingAuthority,
    SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
  );

  const multiStepSource = targetScheduleAuthorityFixture({
    scheduleId: 'schedule:retained-product:multi-step-source',
    targetScheduleRequestId: 'schedule:retained-product:multi-step-target',
    laneId,
    stateKey,
    stepCount: 2,
    activationOverrides: sourceActivation,
    prospectiveTargetConfiguration: retainedTargetConfiguration(2)
  });
  assert.equal(
    multiStepSource.prospectiveDynamicLawTransition.kind,
    'retained-product-gas-boundary-inactive-to-actionable',
    'a terminally fenced multi-step source may preseal its NEXT schedule writer set'
  );
  assert.equal(
    multiStepSource.prospectiveDynamicLawTransition.sourceConfiguration
      .motionEnvelope.maxFutureSubsteps,
    2
  );

  const s1Observation = s1Evidence.nextScheduleLawActivationObservation;
  assert.equal(
    s1Observation.prospectiveWriterEvidence
      .productHistoryLiveBoundObservation.observedLiveRowCount,
    0,
    'an authenticated empty arena is still an exact next-schedule writer capability'
  );
  assert.equal(
    s1Observation.prospectiveWriterEvidence.gasBoundaryActionable,
    true
  );
  for (const invalidWriterEvidence of [
    retainedProductWriterEvidence({ includeArenaIdentity: false }),
    retainedProductWriterEvidence({ scheduleCancelled: true })
  ]) {
    const invalidObservation = dynamicLawRoutingObservation({
      scheduleId,
      laneId,
      stateKey,
      terminalLineage: s1Evidence.finalMechanicsLineage,
      targetScheduleAuthority: s1Authority,
      prospectiveWriterEvidence: invalidWriterEvidence,
      scheduleCancelled: invalidWriterEvidence.scheduleCancelled
    });
    assert.throws(
      () => targetScheduleAuthorityFixture({
        scheduleId: successorScheduleId,
        laneId,
        stateKey,
        stepCount,
        activationOverrides: targetActivation,
        staticGasBoundarySource: false,
        sourceLineage: s1Evidence.finalMechanicsLineage,
        predecessorDynamicLawObservation: invalidObservation,
        predecessorTargetScheduleAuthority: s1Authority
      }),
      /not prospectively authorized/
    );
  }
  for (const mutateEvidence of [
    (evidence) => { evidence.productEventRowCount += 1; },
    (evidence) => { evidence.productHistoryArenaIdentity.viewOrdinal += 1; },
    (evidence) => {
      evidence.productHistoryArenaIdentity.countAuthoritySeal ^= 1;
    }
  ]) {
    const mutatedObservation = structuredClone(s1Observation);
    mutateEvidence(mutatedObservation.prospectiveWriterEvidence);
    assert.throws(
      () => targetScheduleAuthorityFixture({
        scheduleId: successorScheduleId,
        laneId,
        stateKey,
        stepCount,
        activationOverrides: targetActivation,
        staticGasBoundarySource: false,
        sourceLineage: s1Evidence.finalMechanicsLineage,
        predecessorDynamicLawObservation: mutatedObservation,
        predecessorTargetScheduleAuthority: s1Authority
      }),
      /exact admitted observation/
    );
  }

  const managers = authorityFixture();
  const completedResult = (id, evidence) => ({
    scheduleId: id,
    laneId,
    stateKey,
    retainedBufferRefs,
    ...evidence,
    gpuFence: terminalScheduleFence({
      scheduleId: id,
      laneId,
      stateKey,
      completedStepCount: stepCount
    })
  });
  const admittedS1 = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: managers.computeManager,
    stateManager: managers.stateManager,
    scheduleId,
    laneId,
    stateKey,
    stepCount,
    targetScheduleAuthority: s1Authority,
    executeSchedule: async () => completedResult(scheduleId, s1Evidence)
  });
  const admittedS1Observation = admittedS1.scheduleResult
    .nextScheduleLawActivationObservation;
  const persistentWriterEvidence = retainedProductWriterEvidence({
    observedLiveRowCount: 0
  });
  const s2Evidence = canonicalRouteScheduleEvidence({
    scheduleId: successorScheduleId,
    laneId,
    stateKey,
    requestedStepCount: stepCount,
    retainedBufferRefs,
    activationOverrides: targetActivation,
    staticGasBoundarySource: false,
    targetScheduleRequestId: continuationScheduleId,
    sourceLineage: s1Evidence.finalMechanicsLineage,
    predecessorDynamicLawObservation: admittedS1Observation,
    predecessorTargetScheduleAuthority: s1Authority,
    prospectiveWriterEvidence: persistentWriterEvidence,
    generationId: 212
  });
  const s2Authority = s2Evidence.executionRouteReceipt
    .targetScheduleAuthority;
  assert.equal(s2Authority.writerSet.gasBoundaryActionable, true);
  assert.equal(
    s2Authority.writerSet.retainedProductGasBoundaryActionable,
    true
  );
  assert.equal(
    s2Evidence.executionRouteReceipt.predecessorTargetTokenConsumption
      .configurationContinuityMode,
    'prospective-retained-product-gas-boundary-actionable'
  );
  assert.equal(
    s2Evidence.executionRouteReceipt.predecessorTargetTokenConsumption
      .conservativeActivationRequired,
    true
  );
  const s2 = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: managers.computeManager,
    stateManager: managers.stateManager,
    scheduleId: successorScheduleId,
    laneId,
    stateKey,
    stepCount,
    targetScheduleAuthority: s2Authority,
    predecessorTargetScheduleAuthority: s1Authority,
    predecessorDynamicLawObservation: admittedS1Observation,
    executeSchedule: async () => {
      const burnTaskId =
        `ulg:schroeder-predecessor-target-token-consumption:${successorScheduleId}`;
      assert.equal(
        managers.stateManager.getWarmDeltas('ulg-sph-resident-pass-dag')
          [burnTaskId]?.payload?.status,
        'predecessor-target-token-consumed-before-lease-acquisition'
      );
      return completedResult(successorScheduleId, s2Evidence);
    }
  });
  assert.equal(
    s2.predecessorTargetTokenAdmission.configurationContinuityMode,
    'prospective-retained-product-gas-boundary-actionable'
  );
  assert.equal(
    s2.predecessorTargetTokenConsumption.workerConsumption
      .prospectiveDynamicLawTransitionFingerprint,
    prospectiveTransition.transitionFingerprint
  );

  const callCountBeforeReplay = managers.calls.length;
  let replayExecuted = false;
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: managers.computeManager,
      stateManager: managers.stateManager,
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      stepCount,
      targetScheduleAuthority: s2Authority,
      predecessorTargetScheduleAuthority: s1Authority,
      predecessorDynamicLawObservation: admittedS1Observation,
      executeSchedule: async () => {
        replayExecuted = true;
        return completedResult(successorScheduleId, s2Evidence);
      }
    }),
    /predecessor-target-token-replayed/
  );
  assert.equal(replayExecuted, false);
  assert.equal(managers.calls.length, callCountBeforeReplay);

  const s2Observation = s2.scheduleResult.nextScheduleLawActivationObservation;
  const s3Evidence = canonicalRouteScheduleEvidence({
    scheduleId: continuationScheduleId,
    laneId,
    stateKey,
    requestedStepCount: stepCount,
    retainedBufferRefs,
    activationOverrides: targetActivation,
    staticGasBoundarySource: false,
    sourceLineage: s2Evidence.finalMechanicsLineage,
    predecessorDynamicLawObservation: s2Observation,
    predecessorTargetScheduleAuthority: s2Authority,
    prospectiveWriterEvidence: persistentWriterEvidence,
    generationId: 213
  });
  assert.equal(
    s3Evidence.executionRouteReceipt.predecessorTargetTokenConsumption
      .configurationContinuityMode,
    'exact-configuration-continuation'
  );
  assert.equal(
    s3Evidence.executionRouteReceipt.predecessorTargetTokenConsumption
      .prospectiveDynamicLawTransitionFingerprint,
    null
  );
  const s3Authority = s3Evidence.executionRouteReceipt
    .targetScheduleAuthority;
  const s3 = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: managers.computeManager,
    stateManager: managers.stateManager,
    scheduleId: continuationScheduleId,
    laneId,
    stateKey,
    stepCount,
    targetScheduleAuthority: s3Authority,
    predecessorTargetScheduleAuthority: s2Authority,
    predecessorDynamicLawObservation: s2Observation,
    executeSchedule: async () => completedResult(
      continuationScheduleId,
      s3Evidence
    )
  });
  assert.equal(
    s3.predecessorTargetTokenAdmission.configurationContinuityMode,
    'exact-configuration-continuation'
  );
});

test('multi-step product evidence remains inert without a presealed gas transition', () => {
  const scheduleId = 'schedule:retained-product:k64:s1';
  const successorScheduleId = 'schedule:retained-product:k64:s2';
  const laneId = 'lane:retained-product:k64';
  const stateKey = 'state:retained-product:k64';
  const stepCount = 64;
  const activation = {
    reaction: true,
    contactSolver: false,
    explicitVacuumAmbient: true,
    mechanicsFieldViews: false
  };
  const writerEvidence = retainedProductWriterEvidence({
    observedLiveRowCount: 0
  });
  const s1Evidence = canonicalRouteScheduleEvidence({
    scheduleId,
    laneId,
    stateKey,
    requestedStepCount: stepCount,
    activationOverrides: activation,
    targetScheduleRequestId: successorScheduleId,
    prospectiveWriterEvidence: writerEvidence,
    generationId: 311
  });
  const s1Authority = s1Evidence.executionRouteReceipt
    .targetScheduleAuthority;
  const s1Observation = s1Evidence.nextScheduleLawActivationObservation;
  assert.equal(s1Authority.writerSet.gasBoundaryActionable, false);
  assert.equal(s1Authority.prospectiveDynamicLawTransition, null);
  assert.equal(
    s1Observation.prospectiveWriterEvidence.gasBoundaryActionable,
    true,
    'the fenced product arena remains truthful physical evidence'
  );

  const s2Evidence = canonicalRouteScheduleEvidence({
    scheduleId: successorScheduleId,
    laneId,
    stateKey,
    requestedStepCount: stepCount,
    activationOverrides: activation,
    sourceLineage: s1Evidence.finalMechanicsLineage,
    predecessorDynamicLawObservation: s1Observation,
    predecessorTargetScheduleAuthority: s1Authority,
    prospectiveWriterEvidence: writerEvidence,
    generationId: 312
  });
  const s2Authority = s2Evidence.executionRouteReceipt
    .targetScheduleAuthority;
  const consumption = s2Evidence.executionRouteReceipt
    .predecessorTargetTokenConsumption;
  assert.equal(s2Authority.writerSet.gasBoundaryActionable, false);
  assert.equal(s2Authority.predecessorDynamicLawTransition, null);
  assert.equal(
    consumption.configurationContinuityMode,
    'exact-configuration-continuation'
  );
  assert.equal(consumption.conservativeActivationRequired, true);
  assert.equal(consumption.prospectiveDynamicLawTransitionFingerprint, null);
});

test('outer authority latches an immutable target before deferred worker execution', async () => {
  const scheduleId = 'schedule:latched-target-authority';
  const laneId = 'lane:latched-target-authority';
  const stateKey = 'state:latched-target-authority';
  const stepCount = 2;
  const retainedBufferRefs = ['worker:latched-target-authority'];
  const scheduleEvidence = canonicalRouteScheduleEvidence({
    scheduleId,
    laneId,
    stateKey,
    requestedStepCount: stepCount,
    retainedBufferRefs,
    activationOverrides: { reaction: true }
  });
  const workerAuthority = scheduleEvidence.executionRouteReceipt
    .targetScheduleAuthority;
  const callerOwnedAuthority = structuredClone(targetScheduleAuthorityFixture({
    scheduleId,
    laneId,
    stateKey,
    stepCount,
    activationOverrides: { reaction: true },
    reactionTableSeed: 9
  }));
  assert.notEqual(
    callerOwnedAuthority.requestFingerprint,
    workerAuthority.requestFingerprint
  );
  const scheduleResult = {
    scheduleId,
    laneId,
    stateKey,
    retainedBufferRefs,
    ...scheduleEvidence,
    gpuFence: terminalScheduleFence({
      scheduleId,
      laneId,
      stateKey,
      completedStepCount: stepCount
    })
  };
  const managers = authorityFixture();
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: managers.computeManager,
      stateManager: managers.stateManager,
      scheduleId,
      laneId,
      stateKey,
      stepCount,
      targetScheduleAuthority: callerOwnedAuthority,
      executeSchedule: async () => {
        for (const key of Object.keys(callerOwnedAuthority)) {
          delete callerOwnedAuthority[key];
        }
        Object.assign(
          callerOwnedAuthority,
          structuredClone(workerAuthority)
        );
        return scheduleResult;
      }
    }),
    /target-schedule-authority-mismatch/
  );
  assert.deepEqual(
    managers.calls.map(([kind]) => kind),
    ['acquire', 'reject'],
    'a post-admission authority swap must never complete or commit'
  );
});

test('canonical reaction routing evidence is admitted and persisted without replacing current activation authority', async () => {
  const scheduleId = 'schedule:reaction-shadow';
  const laneId = 'lane:reaction-shadow';
  const stateKey = 'state:reaction-shadow';
  const stepCount = 2;
  const retainedBufferRefs = ['worker:state', 'worker:thermo'];
  const scheduleResult = (
    activationOverrides = { reaction: true }
  ) => ({
    scheduleId,
    laneId,
    stateKey,
    retainedBufferRefs,
    ...canonicalRouteScheduleEvidence({
      scheduleId,
      laneId,
      stateKey,
      requestedStepCount: stepCount,
      retainedBufferRefs,
      activationOverrides
    }),
    gpuFence: terminalScheduleFence({
      scheduleId,
      laneId,
      stateKey,
      completedStepCount: stepCount
    })
  });

  const admittedScheduleResult = scheduleResult();
  const mainTargetScheduleAuthority =
    admittedScheduleResult.executionRouteReceipt.targetScheduleAuthority;
  const admitted = authorityFixture();
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: admitted.computeManager,
    stateManager: admitted.stateManager,
    scheduleId,
    laneId,
    stateKey,
    stepCount,
    targetScheduleAuthority: mainTargetScheduleAuthority,
    executeSchedule: async () => admittedScheduleResult
  });
  const admitPredecessorOnFreshManagers = async () => {
    const managers = authorityFixture();
    await runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: managers.computeManager,
      stateManager: managers.stateManager,
      scheduleId,
      laneId,
      stateKey,
      stepCount,
      targetScheduleAuthority: mainTargetScheduleAuthority,
      executeSchedule: async () => admittedScheduleResult
    });
    return managers;
  };
  const observation = result.scheduleResult
    .nextScheduleLawActivationObservation;
  assert.equal(
    observation.shadowOnly,
    SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
  );
  assert.equal(
    observation.routingAuthority,
    SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
  );
  assert.equal(
    observation.executionGating,
    SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE
  );
  assert.equal(
    observation.motionEnvelope.thermalPhaseEvolutionEnabled,
    false
  );
  assert.equal(
    observation.motionEnvelope.futureRestDiameterBoundStatus,
    'terminal-upper-under-declared-no-writer-premise'
  );
  assert.equal(observation.triggered, false);
  assert.equal(
    observation.targetScheduleRequestId,
    mainTargetScheduleAuthority.targetScheduleRequestId
  );
  assert.equal(
    observation.targetScheduleAuthorityFingerprint,
    mainTargetScheduleAuthority.requestFingerprint
  );
  assert.equal(result.scheduleResult.lawActivationReceipt.reaction, true);
  assert.equal(
    result.scheduleResult.lawActivationReceipt.activationAuthority,
    'schedule-config-static-declaration-no-readback'
  );
  assert.deepEqual(
    result.commitDelta.payload.nextScheduleLawActivationObservation,
    observation
  );
  assert.deepEqual(
    result.stateManagerCommit.warmEntry.payload
      .nextScheduleLawActivationObservation,
    observation
  );
  assert.equal(
    admitted.calls[0][1].copyBudget.readbackBytes,
    observation.readbackByteLength + Uint32Array.BYTES_PER_ELEMENT,
    'the lease budgets the reaction word plus the optional product-history word'
  );

  const successorScheduleId =
    mainTargetScheduleAuthority.targetScheduleRequestId;
  const successorScheduleResult = ({
    predecessorObservation = observation,
    generationId = 43
  } = {}) => ({
    scheduleId: successorScheduleId,
    laneId,
    stateKey,
    retainedBufferRefs,
    ...canonicalRouteScheduleEvidence({
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      requestedStepCount: stepCount,
      retainedBufferRefs,
      activationOverrides: { reaction: true },
      sourceLineage: admittedScheduleResult.finalMechanicsLineage,
      predecessorDynamicLawObservation: predecessorObservation,
      generationId
    }),
    gpuFence: terminalScheduleFence({
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      completedStepCount: stepCount
    })
  });
  const admittedSuccessorScheduleResult = successorScheduleResult();
  const successorTargetScheduleAuthority =
    admittedSuccessorScheduleResult.executionRouteReceipt
      .targetScheduleAuthority;

  const predecessorTaskId = `ulg:schroeder-worker-schedule:${scheduleId}`;
  const predecessorWarmEntry = admitted.stateManager.getWarmDeltas(
    'ulg-sph-resident-pass-dag'
  )[predecessorTaskId];
  assert.ok(predecessorWarmEntry);
  const admittedPredecessorWarmPayload = structuredClone(
    predecessorWarmEntry.payload
  );
  const producerWarmAttestationMutations = [
    ['payload-schema', (payload) => {
      payload.schema = 'peercompute.ulg.forged-state-delta.v0';
    }],
    ['payload-status', (payload) => {
      payload.status = 'worker-resident-schedule-in-flight';
    }],
    ['payload-state-key', (payload) => {
      payload.stateKey = `${stateKey}:forged`;
    }],
    ['payload-completed-step-count', (payload) => {
      payload.completedStepCount = stepCount - 1;
    }],
    ['gpu-fence-required', (payload) => {
      payload.gpuFence.required = false;
    }],
    ['gpu-fence-lane', (payload) => {
      payload.gpuFence.laneId = `${laneId}:forged`;
    }],
    ['gpu-fence-state', (payload) => {
      payload.gpuFence.stateKey = `${stateKey}:forged`;
    }],
    ['gpu-fence-queue-policy', (payload) => {
      payload.gpuFence.queueFencePolicy = 'queue-submit-without-terminal-fence';
    }],
    ['gpu-fence-method', (payload) => {
      payload.gpuFence.method = 'queue.submit';
    }],
    ['gpu-resident-lane-requirement-lane', (payload) => {
      payload.gpuResidentLaneRequirement.laneId = `${laneId}:forged`;
    }],
    ['gpu-resident-lane-requirement-state', (payload) => {
      payload.gpuResidentLaneRequirement.stateKey = `${stateKey}:forged`;
    }],
    ['gpu-resident-lane-requirement-queue-policy', (payload) => {
      payload.gpuResidentLaneRequirement.queueFencePolicy =
        'queue-submit-without-terminal-fence';
    }],
    ['route-execution-completed-step-count', (payload) => {
      payload.executionRouteReceipt.execution.completedStepCount =
        stepCount - 1;
    }],
    ['route-execution-terminal-fence', (payload) => {
      payload.executionRouteReceipt.execution.terminalFenceSatisfied = false;
    }],
    ['route-execution-status-count-consistency', (payload) => {
      payload.executionRouteReceipt.execution.requestedStepCount =
        stepCount + 1;
    }]
  ];
  try {
    for (const [label, mutate] of producerWarmAttestationMutations) {
      predecessorWarmEntry.payload = structuredClone(
        admittedPredecessorWarmPayload
      );
      mutate(predecessorWarmEntry.payload);
      const callCountBeforeRejection = admitted.calls.length;
      let executeCalled = false;
      await assert.rejects(
        runSchroederWorkerLaneScheduleWithAuthority({
          computeManager: admitted.computeManager,
          stateManager: admitted.stateManager,
          scheduleId: successorScheduleId,
          laneId,
          stateKey,
          stepCount,
          targetScheduleAuthority: successorTargetScheduleAuthority,
          predecessorTargetScheduleAuthority: mainTargetScheduleAuthority,
          predecessorDynamicLawObservation: observation,
          executeSchedule: async () => {
            executeCalled = true;
            return admittedSuccessorScheduleResult;
          }
        }),
        (error) => {
          assert.equal(
            error?.reason,
            'predecessor-target-token-state-manager-issuance',
            label
          );
          return true;
        }
      );
      assert.equal(executeCalled, false, label);
      assert.equal(
        admitted.calls.length,
        callCountBeforeRejection,
        `${label} must reject before ComputeManager acquisition`
      );
    }
  } finally {
    predecessorWarmEntry.payload = structuredClone(
      admittedPredecessorWarmPayload
    );
  }

  const forgedPredecessorObservation = structuredClone(observation);
  forgedPredecessorObservation.triggered = true;
  forgedPredecessorObservation.triggeredSourceCount =
    forgedPredecessorObservation.particleCount;
  forgedPredecessorObservation.rawEvidenceWord =
    forgedPredecessorObservation.particleCount;
  const coherentlyForgedSuccessor = successorScheduleResult({
    predecessorObservation: forgedPredecessorObservation,
    generationId: 47
  });
  const coherentlyForgedSuccessorAuthority =
    coherentlyForgedSuccessor.executionRouteReceipt.targetScheduleAuthority;
  assert.equal(
    validateSchroederWorkerScheduleExecutionRouteReceipt(
      coherentlyForgedSuccessor,
      {
        scheduleId: successorScheduleId,
        laneId,
        stateKey,
        requestedStepCount: stepCount,
        targetScheduleAuthority: coherentlyForgedSuccessorAuthority
      }
    ).status,
    'worker-schedule-execution-route-receipt-admitted',
    'the forged predecessor, current seal, consumption, and worker echoes agree'
  );
  const coherentForgeryManagers =
    await admitPredecessorOnFreshManagers();
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: coherentForgeryManagers.computeManager,
      stateManager: coherentForgeryManagers.stateManager,
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      stepCount,
      targetScheduleAuthority: successorTargetScheduleAuthority,
      predecessorTargetScheduleAuthority: mainTargetScheduleAuthority,
      predecessorDynamicLawObservation: observation,
      executeSchedule: async () => coherentlyForgedSuccessor
    }),
    /target-schedule-authority-mismatch/
  );
  assert.deepEqual(
    coherentForgeryManagers.calls.slice(-2).map(([kind]) => kind),
    ['acquire', 'reject']
  );

  const extraLineageKeySuccessor = successorScheduleResult({
    generationId: 49
  });
  for (const consumption of [
    extraLineageKeySuccessor.predecessorTargetTokenConsumption,
    extraLineageKeySuccessor.executionRouteReceipt
      .predecessorTargetTokenConsumption
  ]) {
    consumption.terminalLineage.unadmittedWord = 1;
  }
  const extraLineageManagers = await admitPredecessorOnFreshManagers();
  const callCountBeforeExtraLineageKey = extraLineageManagers.calls.length;
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: extraLineageManagers.computeManager,
      stateManager: extraLineageManagers.stateManager,
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      stepCount,
      targetScheduleAuthority: successorTargetScheduleAuthority,
      predecessorTargetScheduleAuthority: mainTargetScheduleAuthority,
      predecessorDynamicLawObservation: observation,
      executeSchedule: async () => extraLineageKeySuccessor
    }),
    (error) => {
      assert.equal(error?.reason, 'predecessor-target-token-consumption');
      return true;
    }
  );
  assert.deepEqual(
    extraLineageManagers.calls
      .slice(callCountBeforeExtraLineageKey)
      .map(([kind]) => kind),
    ['acquire', 'reject'],
    'a malformed worker consumption rejects its lease without completion or commit'
  );

  const successor = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: admitted.computeManager,
    stateManager: admitted.stateManager,
    scheduleId: successorScheduleId,
    laneId,
    stateKey,
    stepCount,
    targetScheduleAuthority: successorTargetScheduleAuthority,
    predecessorTargetScheduleAuthority: mainTargetScheduleAuthority,
    predecessorDynamicLawObservation: observation,
    executeSchedule: async () => admittedSuccessorScheduleResult
  });
  assert.equal(
    successor.predecessorTargetTokenAdmission.status,
    'predecessor-target-token-issued-by-state-manager'
  );
  assert.equal(
    successor.executionRouteAdmission.predecessorTargetTokenConsumption
      .targetScheduleRequestId,
    successorScheduleId
  );
  assert.deepEqual(
    successor.commitDelta.payload.predecessorTargetTokenAdmission,
    successor.predecessorTargetTokenAdmission
  );
  assert.deepEqual(
    successor.stateManagerCommit.warmEntry.payload
      .predecessorTargetTokenConsumption,
    successor.predecessorTargetTokenConsumption
  );

  const callCountBeforeReplay = admitted.calls.length;
  let replayExecuteCalled = false;
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: admitted.computeManager,
      stateManager: admitted.stateManager,
      scheduleId: successorScheduleId,
      laneId,
      stateKey,
      stepCount,
      targetScheduleAuthority: successorTargetScheduleAuthority,
      predecessorTargetScheduleAuthority: mainTargetScheduleAuthority,
      predecessorDynamicLawObservation: observation,
      executeSchedule: async () => {
        replayExecuteCalled = true;
        return admittedSuccessorScheduleResult;
      }
    }),
    (error) => {
      assert.equal(error?.reason, 'predecessor-target-token-replayed');
      return true;
    }
  );
  assert.equal(replayExecuteCalled, false);
  assert.equal(
    admitted.calls.length,
    callCountBeforeReplay,
    'a persisted successor consumption rejects replay before lease acquisition'
  );

  const latchedCandidate = scheduleResult();
  for (const latchedObservation of [
    latchedCandidate.nextScheduleLawActivationObservation,
    latchedCandidate.executionRouteReceipt.nextScheduleLawActivationObservation
  ]) {
    latchedObservation.triggered = true;
    latchedObservation.triggeredSourceCount = latchedObservation.particleCount;
    latchedObservation.rawEvidenceWord = latchedObservation.particleCount;
  }
  assert.equal(
    latchedCandidate.nextScheduleLawActivationObservation.motionEnvelope
      .futureRestDiameterBoundStatus,
    'terminal-upper-under-declared-no-writer-premise'
  );
  assert.equal(
    validateSchroederWorkerScheduleExecutionRouteReceipt(latchedCandidate, {
      scheduleId,
      laneId,
      stateKey,
      requestedStepCount: stepCount,
      targetScheduleAuthority:
        latchedCandidate.executionRouteReceipt.targetScheduleAuthority
    }).nextScheduleLawActivationObservation.triggeredSourceCount,
    64
  );
  const outerThermalLatchFalse = scheduleResult({
    reaction: true,
    thermal: true
  });
  for (const thermalLatchObservation of [
    outerThermalLatchFalse.nextScheduleLawActivationObservation,
    outerThermalLatchFalse.executionRouteReceipt
      .nextScheduleLawActivationObservation
  ]) {
    thermalLatchObservation.motionEnvelope = createSphReactionMotionEnvelope({
      maxFutureSubsteps: stepCount,
      dtS: thermalLatchObservation.motionEnvelope.dtS,
      gridSpacingM: thermalLatchObservation.motionEnvelope.gridSpacingM,
      cflFactor: thermalLatchObservation.motionEnvelope.cflFactor,
      boxDimsM: thermalLatchObservation.motionEnvelope.boxDimsM,
      separationDisplacementEnabled:
        thermalLatchObservation.motionEnvelope.separationDisplacementEnabled,
      contactCorrectionEnabled:
        thermalLatchObservation.motionEnvelope.contactCorrectionEnabled,
      thermalPhaseEvolutionEnabled: false
    });
  }
  assert.equal(
    outerThermalLatchFalse.nextScheduleLawActivationObservation.motionEnvelope
      .thermalPhaseEvolutionEnabled,
    false
  );
  assert.throws(
    () => validateSchroederWorkerScheduleExecutionRouteReceipt(
      outerThermalLatchFalse,
      {
        scheduleId,
        laneId,
        stateKey,
        requestedStepCount: stepCount,
        targetScheduleAuthority:
          outerThermalLatchFalse.executionRouteReceipt.targetScheduleAuthority
      }
    ),
    /execution route receipt was not exactly admitted: dynamic-law-(?:observation|target-schedule-authority)/
  );
  const outerContactModeDowngrade = scheduleResult();
  for (const downgradedObservation of [
    outerContactModeDowngrade.nextScheduleLawActivationObservation,
    outerContactModeDowngrade.executionRouteReceipt
      .nextScheduleLawActivationObservation
  ]) {
    downgradedObservation.motionEnvelope = createSphReactionMotionEnvelope({
      maxFutureSubsteps: stepCount,
      dtS: downgradedObservation.motionEnvelope.dtS,
      gridSpacingM: downgradedObservation.motionEnvelope.gridSpacingM,
      cflFactor: downgradedObservation.motionEnvelope.cflFactor,
      boxDimsM: downgradedObservation.motionEnvelope.boxDimsM,
      separationDisplacementEnabled: true,
      contactCorrectionEnabled: false
    });
  }
  assert.throws(
    () => validateSchroederWorkerScheduleExecutionRouteReceipt(
      outerContactModeDowngrade,
      {
        scheduleId,
        laneId,
        stateKey,
        requestedStepCount: stepCount,
        targetScheduleAuthority:
          outerContactModeDowngrade.executionRouteReceipt
            .targetScheduleAuthority
      }
    ),
    /execution route receipt was not exactly admitted: dynamic-law-(?:observation|target-schedule-authority)/
  );
  const outerPhaseMigrationLatchFalse = scheduleResult({
    reaction: true,
    phaseVolumeMigration: true
  });
  for (const phaseLatchObservation of [
    outerPhaseMigrationLatchFalse.nextScheduleLawActivationObservation,
    outerPhaseMigrationLatchFalse.executionRouteReceipt
      .nextScheduleLawActivationObservation
  ]) {
    phaseLatchObservation.motionEnvelope = createSphReactionMotionEnvelope({
      maxFutureSubsteps: stepCount,
      dtS: phaseLatchObservation.motionEnvelope.dtS,
      gridSpacingM: phaseLatchObservation.motionEnvelope.gridSpacingM,
      cflFactor: phaseLatchObservation.motionEnvelope.cflFactor,
      boxDimsM: phaseLatchObservation.motionEnvelope.boxDimsM,
      separationDisplacementEnabled:
        phaseLatchObservation.motionEnvelope.separationDisplacementEnabled,
      contactCorrectionEnabled:
        phaseLatchObservation.motionEnvelope.contactCorrectionEnabled,
      thermalPhaseEvolutionEnabled: false
    });
  }
  assert.throws(
    () => validateSchroederWorkerScheduleExecutionRouteReceipt(
      outerPhaseMigrationLatchFalse,
      {
        scheduleId,
        laneId,
        stateKey,
        requestedStepCount: stepCount,
        targetScheduleAuthority:
          outerPhaseMigrationLatchFalse.executionRouteReceipt
            .targetScheduleAuthority
      }
    ),
    /execution route receipt was not exactly admitted: dynamic-law-(?:observation|target-schedule-authority)/
  );
  const outerProviderLatchFalse = scheduleResult();
  outerProviderLatchFalse.executionRouteReceipt.blockers.push(
    'schedule-step-options-provider-present'
  );
  assert.throws(
    () => validateSchroederWorkerScheduleExecutionRouteReceipt(
      outerProviderLatchFalse,
      {
        scheduleId,
        laneId,
        stateKey,
        requestedStepCount: stepCount,
        targetScheduleAuthority:
          outerProviderLatchFalse.executionRouteReceipt.targetScheduleAuthority
      }
    ),
    /execution route receipt was not exactly admitted: target-schedule-authority-request/
  );

  const invalidCases = [
    ['missing', (candidate) => {
      candidate.nextScheduleLawActivationObservation = null;
      candidate.executionRouteReceipt
        .nextScheduleLawActivationObservation = null;
    }],
    ['torn-result', (candidate) => {
      candidate.nextScheduleLawActivationObservation.triggered = true;
    }],
    ['schedule-identity', (candidate) => {
      candidate.nextScheduleLawActivationObservation.sourceScheduleId =
        'schedule:wrong';
      candidate.executionRouteReceipt.nextScheduleLawActivationObservation
        .sourceScheduleId = 'schedule:wrong';
    }],
    ['terminal-lineage', (candidate) => {
      candidate.nextScheduleLawActivationObservation.terminalLineage
        .physicsTick += 1;
      candidate.executionRouteReceipt.nextScheduleLawActivationObservation
        .terminalLineage.physicsTick += 1;
    }],
    ['pre-terminal-sample-stage', (candidate) => {
      for (const observation of [
        candidate.nextScheduleLawActivationObservation,
        candidate.executionRouteReceipt.nextScheduleLawActivationObservation
      ]) {
        observation.sampleStage =
          'canonical-post-thermal-pre-reaction-motion-envelope';
      }
    }],
    ['aggregate-node-domain', (candidate) => {
      for (const observation of [
        candidate.nextScheduleLawActivationObservation,
        candidate.executionRouteReceipt.nextScheduleLawActivationObservation
      ]) {
        observation.nodeDomain = 'primary-particle';
      }
    }],
    ['contact-bound-revision', (candidate) => {
      for (const observation of [
        candidate.nextScheduleLawActivationObservation,
        candidate.executionRouteReceipt.nextScheduleLawActivationObservation
      ]) {
        observation.motionEnvelope = {
          ...structuredClone(observation.motionEnvelope),
          contactMotionBoundRevision: 'forged-contact-bound'
        };
      }
    }],
    ['contact-box-bit', (candidate) => {
      for (const observation of [
        candidate.nextScheduleLawActivationObservation,
        candidate.executionRouteReceipt.nextScheduleLawActivationObservation
      ]) {
        const forged = structuredClone(observation.motionEnvelope);
        forged.boxDimsF32Bits[0] += 1;
        observation.motionEnvelope = forged;
      }
    }],
    ['missing-thermal-phase-latch-revision', (candidate) => {
      for (const observation of [
        candidate.nextScheduleLawActivationObservation,
        candidate.executionRouteReceipt.nextScheduleLawActivationObservation
      ]) {
        const forged = structuredClone(observation.motionEnvelope);
        delete forged.thermalPhaseLatchRevision;
        observation.motionEnvelope = forged;
      }
    }],
    ['contradictory-future-rest-diameter-status', (candidate) => {
      for (const observation of [
        candidate.nextScheduleLawActivationObservation,
        candidate.executionRouteReceipt.nextScheduleLawActivationObservation
      ]) {
        observation.motionEnvelope = {
          ...structuredClone(observation.motionEnvelope),
          futureRestDiameterBoundStatus:
            'future-upper-unclaimed-trigger-positive'
        };
      }
    }],
    ['latched-successful-zero', (candidate) => {
      for (const observation of [
        candidate.nextScheduleLawActivationObservation,
        candidate.executionRouteReceipt.nextScheduleLawActivationObservation
      ]) {
        observation.motionEnvelope = createSphReactionMotionEnvelope({
          maxFutureSubsteps: stepCount,
          dtS: observation.motionEnvelope.dtS,
          gridSpacingM: observation.motionEnvelope.gridSpacingM,
          cflFactor: observation.motionEnvelope.cflFactor,
          boxDimsM: observation.motionEnvelope.boxDimsM,
          separationDisplacementEnabled:
            observation.motionEnvelope.separationDisplacementEnabled,
          contactCorrectionEnabled:
            observation.motionEnvelope.contactCorrectionEnabled,
          thermalPhaseEvolutionEnabled: true
        });
      }
      assert.ok([
        candidate.nextScheduleLawActivationObservation,
        candidate.executionRouteReceipt.nextScheduleLawActivationObservation
      ].every(({ motionEnvelope }) => (
        isSphReactionMotionEnvelopeReceipt(motionEnvelope)
      )));
    }],
    ['motion-envelope-k', (candidate) => {
      const forgedEnvelopes = [];
      for (const observation of [
        candidate.nextScheduleLawActivationObservation,
        candidate.executionRouteReceipt.nextScheduleLawActivationObservation
      ]) {
        observation.motionEnvelope = createSphReactionMotionEnvelope({
          maxFutureSubsteps: stepCount + 1,
          dtS: observation.motionEnvelope.dtS,
          gridSpacingM: observation.motionEnvelope.gridSpacingM,
          cflFactor: observation.motionEnvelope.cflFactor,
          boxDimsM: observation.motionEnvelope.boxDimsM,
          separationDisplacementEnabled:
            observation.motionEnvelope.separationDisplacementEnabled,
          contactCorrectionEnabled:
            observation.motionEnvelope.contactCorrectionEnabled
        });
        forgedEnvelopes.push(observation.motionEnvelope);
      }
      assert.ok(forgedEnvelopes.every(isSphReactionMotionEnvelopeReceipt));
      assert.deepEqual(forgedEnvelopes[0], forgedEnvelopes[1]);
    }]
  ];
  for (const [suffix, mutate] of invalidCases) {
    const rejected = authorityFixture();
    const candidate = scheduleResult();
    const retainedTargetScheduleAuthority =
      candidate.executionRouteReceipt.targetScheduleAuthority;
    mutate(candidate);
    await assert.rejects(
      runSchroederWorkerLaneScheduleWithAuthority({
        computeManager: rejected.computeManager,
        stateManager: rejected.stateManager,
        scheduleId,
        laneId,
        stateKey,
        stepCount,
        targetScheduleAuthority: retainedTargetScheduleAuthority,
        executeSchedule: async () => candidate
      }),
      /execution route receipt was not exactly admitted/,
      suffix
    );
    assert.deepEqual(
      rejected.calls.map(([kind]) => kind),
      ['acquire', 'reject'],
      suffix
    );
  }

  const coherentlyForged = scheduleResult({
    reaction: true,
    thermal: true
  });
  const forgedActivation = routeLawActivation({
    reaction: true,
    thermal: true
  });
  const forgedTargetScheduleAuthority = targetScheduleAuthorityFixture({
    scheduleId,
    laneId,
    stateKey,
    stepCount,
    activationOverrides: { reaction: true, thermal: true },
    targetScheduleRequestId: `${scheduleId}:forged-next-law-route`,
    reactionTableSeed: 73,
    dtS: 0.0010001
  });
  const forgedObservation = dynamicLawRoutingObservation({
    scheduleId,
    laneId,
    stateKey,
    terminalLineage: coherentlyForged.finalMechanicsLineage,
    triggeredSourceCount: 64,
    maxFutureSubsteps: stepCount,
    thermalPhaseEvolutionEnabled: true,
    contactCorrectionEnabled: true,
    targetScheduleAuthority: forgedTargetScheduleAuthority
  });
  coherentlyForged.lawActivationReceipt = structuredClone(forgedActivation);
  coherentlyForged.nextScheduleLawActivationObservation =
    structuredClone(forgedObservation);
  coherentlyForged.executionRouteReceipt.activationReceipt =
    structuredClone(forgedActivation);
  coherentlyForged.executionRouteReceipt.blockers =
    routeActivationBlockers(forgedActivation);
  coherentlyForged.executionRouteReceipt.targetScheduleAuthority =
    structuredClone(forgedTargetScheduleAuthority);
  coherentlyForged.executionRouteReceipt.nextScheduleLawActivationObservation =
    structuredClone(forgedObservation);
  assert.equal(
    validateSchroederWorkerScheduleExecutionRouteReceipt(coherentlyForged, {
      scheduleId,
      laneId,
      stateKey,
      requestedStepCount: stepCount,
      targetScheduleAuthority: forgedTargetScheduleAuthority
    }).status,
    'worker-schedule-execution-route-receipt-admitted',
    'the forged worker copies are mutually consistent'
  );
  const forgedOuter = authorityFixture();
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: forgedOuter.computeManager,
      stateManager: forgedOuter.stateManager,
      scheduleId,
      laneId,
      stateKey,
      stepCount,
      targetScheduleAuthority: mainTargetScheduleAuthority,
      executeSchedule: async () => coherentlyForged
    }),
    /target-schedule-authority-mismatch/
  );
  assert.deepEqual(forgedOuter.calls.map(([kind]) => kind), [
    'acquire',
    'reject'
  ]);
});

test('malformed main target-schedule authority is rejected before a lease or worker call', async () => {
  const scheduleId = 'schedule:malformed-target-authority';
  const laneId = 'lane:malformed-target-authority';
  const stateKey = 'state:malformed-target-authority';
  const fixture = authorityFixture();
  const malformedTargetScheduleAuthority = structuredClone(
    targetScheduleAuthorityFixture({
      scheduleId,
      laneId,
      stateKey,
      stepCount: 2,
      activationOverrides: { reaction: true }
    })
  );
  delete malformedTargetScheduleAuthority.requestFingerprint;
  let executeCallCount = 0;

  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: fixture.computeManager,
      stateManager: fixture.stateManager,
      scheduleId,
      laneId,
      stateKey,
      stepCount: 2,
      targetScheduleAuthority: malformedTargetScheduleAuthority,
      executeSchedule: async () => {
        executeCallCount += 1;
        throw new Error('worker must not run');
      }
    }),
    /target-schedule-authority-request/
  );
  assert.equal(executeCallCount, 0);
  assert.deepEqual(fixture.calls, []);
  assert.equal(fixture.activeLeases.size, 0);
});

test('target-schedule authority rejects hostile count and packed-table numeric domains', () => {
  const base = {
    scheduleId: 'schedule:numeric-target-authority',
    laneId: 'lane:numeric-target-authority',
    stateKey: 'state:numeric-target-authority',
    stepCount: 2,
    activationOverrides: { reaction: true }
  };
  for (const sourceParticleCount of [
    0,
    -0,
    1.5,
    Number.NaN,
    SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT + 1,
    Number.MAX_SAFE_INTEGER
  ]) {
    assert.throws(
      () => targetScheduleAuthorityFixture({
        ...base,
        sourceParticleCount
      }),
      /sourceParticleCount/
    );
  }

  const tableMutations = [
    ['reaction count over cap', (table) => {
      table.reactionCount =
        SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT + 1;
    }],
    ['negative-zero section count', (table) => {
      table.productPhaseCount = -0;
    }],
    ['header count mismatch', (table) => {
      table.reactionHeaderCount = 2;
    }],
    ['section capacity mismatch', (table) => {
      table.reactionHeaders = new Float32Array(0);
    }],
    ['section stride mismatch', (table) => {
      table.reactionHeaderStrideFloats += 1;
    }],
    ['section layout mismatch', (table) => {
      table.reactionHeaderLayout[0] = 'forged-layout-field';
    }],
    ['combined record count overflow', (table) => {
      table.combinedRecordCount = Number.MAX_SAFE_INTEGER;
    }],
    ['finite combined prefix mismatch', (table) => {
      table.combinedRecords[0] += 1;
    }],
    ['trailing combined section', (table) => {
      const extended = new Float32Array(table.combinedRecords.length + 4);
      extended.set(table.combinedRecords);
      table.combinedRecords = extended;
      table.combinedRecordCount = extended.length / 4;
    }],
    ['non-finite packed word', (table) => {
      table.combinedRecords[0] = Number.POSITIVE_INFINITY;
      table.records[0] = Number.POSITIVE_INFINITY;
    }]
  ];
  if (typeof SharedArrayBuffer === 'function') {
    tableMutations.push(
      ['shared section storage', (table) => {
        const sharedRecords = new Float32Array(
          new SharedArrayBuffer(table.records.byteLength)
        );
        sharedRecords.set(table.records);
        table.records = sharedRecords;
      }],
      ['shared combined storage', (table) => {
        const sharedCombined = new Float32Array(
          new SharedArrayBuffer(table.combinedRecords.byteLength)
        );
        sharedCombined.set(table.combinedRecords);
        table.combinedRecords = sharedCombined;
      }]
    );
  }
  for (const [label, mutate] of tableMutations) {
    const reactionTableOverride = structuredClone(
      reactionTableAuthorityFixture(11)
    );
    mutate(reactionTableOverride);
    assert.throws(
      () => targetScheduleAuthorityFixture({
        ...base,
        reactionTableOverride
      }),
      /authorized reaction watch/,
      label
    );
  }
});

test('an exact zero-reaction artifact remains fingerprinted but cannot become an authorized watch', () => {
  const base = {
    scheduleId: 'schedule:quiescent-reaction-table',
    laneId: 'lane:quiescent-reaction-table',
    stateKey: 'state:quiescent-reaction-table',
    stepCount: 2,
    activationOverrides: { reaction: true }
  };
  const builtZeroTable = buildSphReactionTable([]);
  const cachedZeroTable = {
    ...structuredClone(builtZeroTable),
    status: 'static-table-cache-hit',
    cache: {
      family: 'sph-reaction-table',
      cacheKey: 'test:cached-zero-reaction-table'
    }
  };
  for (const reactionTableOverride of [builtZeroTable, cachedZeroTable]) {
    assert.equal(
      isExactQuiescentSphReactionTable(reactionTableOverride),
      true
    );
    const authority = targetScheduleAuthorityFixture({
      ...base,
      reactionTableOverride
    });
    assert.equal(authority.writerSet.reaction, false);
    assert.match(
      authority.tableFingerprints.reactionTable,
      /^sha256:schroeder-reaction-table-v2:/
    );
    assert.equal(
      authority.tableFingerprints.reactionActivationWatchTable,
      null
    );
    assert.equal(authority.tableFingerprints.watchReactionTableSource, null);
    assert.equal(authority.tableFingerprints.watchReactionCount, null);
    assert.equal(
      authority.tableFingerprints.watchReactionTableFingerprint,
      null
    );
    assert.equal(
      authority.tableFingerprints.watchReactionTableDomainFingerprint,
      null
    );
  }

  const malformedZeroTable = structuredClone(builtZeroTable);
  malformedZeroTable.status = 'derived-reaction-table-ready';
  assert.equal(isExactQuiescentSphReactionTable(malformedZeroTable), false);
  assert.throws(
    () => targetScheduleAuthorityFixture({
      ...base,
      reactionTableOverride: malformedZeroTable
    }),
    /authorized reaction watch count is outside the exact f32\/u32 domain/
  );
});

test('phase-capable Tier0-to-canonical claims require an exact one-to-four transition proof', () => {
  for (const lawFamily of ['thermal', 'reaction']) {
    const scheduleId = `schedule:tier0-${lawFamily}-proof-required`;
    const laneId = `lane:tier0-${lawFamily}-proof-required`;
    const stateKey = `state:tier0-${lawFamily}-proof-required`;
    const retainedBufferRefs = ['worker:state', 'worker:thermo'];
    const candidate = {
      scheduleId,
      laneId,
      stateKey,
      retainedBufferRefs,
      ...canonicalRouteScheduleEvidence({
        scheduleId,
        laneId,
        stateKey,
        requestedStepCount: 1,
        retainedBufferRefs,
        activationOverrides: { [lawFamily]: true }
      })
    };
    candidate.executionRouteReceipt.transition =
      'tier0-to-canonical-schedule-boundary';
    assert.throws(
      () => validateSchroederWorkerScheduleExecutionRouteReceipt(candidate, {
        scheduleId,
        laneId,
        stateKey,
        requestedStepCount: 1,
        targetScheduleAuthority:
          candidate.executionRouteReceipt.targetScheduleAuthority
      }),
      /tier0-canonical-phase-carrier-one-to-four-required/,
      lawFamily
    );
  }

  const scheduleId = 'schedule:tier0-one-to-four-proof-downgrade';
  const laneId = 'lane:tier0-one-to-four-proof-downgrade';
  const stateKey = 'state:tier0-one-to-four-proof-downgrade';
  const retainedBufferRefs = [
    'worker:state',
    'worker:thermo',
    'worker:identity',
    'worker:mechanics'
  ];
  const downgraded = {
    scheduleId,
    laneId,
    stateKey,
    retainedBufferRefs,
    ...oneToFourCanonicalRouteScheduleEvidence({
      scheduleId,
      laneId,
      stateKey,
      retainedBufferRefs
    })
  };
  downgraded.executionRouteReceipt.transition =
    'tier0-to-canonical-schedule-boundary';
  assert.throws(
    () => validateSchroederWorkerScheduleExecutionRouteReceipt(downgraded, {
      scheduleId,
      laneId,
      stateKey,
      requestedStepCount: 1
    }),
    /phase-carrier-one-to-four-transition-proof/
  );
});

test('terminal-fenced Tier0 1-to-4 topology evidence is admitted without dynamic routing authority', async () => {
  const scheduleId = 'schedule:one-to-four';
  const laneId = 'lane:one-to-four';
  const stateKey = 'state:one-to-four';
  const retainedBufferRefs = [
    'worker:one-to-four:state',
    'worker:one-to-four:thermo',
    'worker:one-to-four:identity',
    'worker:one-to-four:mechanics'
  ];
  const scheduleResult = () => ({
    scheduleId,
    laneId,
    stateKey,
    retainedBufferRefs,
    ...oneToFourCanonicalRouteScheduleEvidence({
      scheduleId,
      laneId,
      stateKey,
      retainedBufferRefs
    }),
    gpuFence: terminalScheduleFence({
      scheduleId,
      laneId,
      stateKey,
      completedStepCount: 1
    })
  });

  const admitted = authorityFixture();
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: admitted.computeManager,
    stateManager: admitted.stateManager,
    scheduleId,
    laneId,
    stateKey,
    stepCount: 1,
    executeSchedule: async () => scheduleResult()
  });
  const transition = result.scheduleResult
    .phaseCarrierOneToFourTransition;
  assert.equal(transition.sourceParticleCount, 2);
  assert.equal(transition.terminalParticleCount, 8);
  assert.equal(transition.routingAuthority, false);
  assert.equal(transition.dynamicLawRoutingAuthority, false);
  assert.equal(transition.commandSubmissionCount, 1);
  assert.equal(transition.mapAsyncCount, 0);
  assert.equal(
    transition.validationErrorScopeStatus,
    'validation-error-scope-clean'
  );
  assert.equal(
    result.scheduleResult.particleCardinality.targetParticleCount,
    8
  );
  assert.equal(
    transition.sourceRetirement.status,
    'phase-carrier-one-to-four-source-retired-after-terminal-fence'
  );
  assert.equal(result.stateManagerCommit.accepted, true);

  for (const [suffix, mutate] of [
    ['count', (candidate) => {
      candidate.phaseCarrierOneToFourTransition.terminalParticleCount = 7;
      candidate.executionRouteReceipt.phaseCarrierOneToFourTransition
        .terminalParticleCount = 7;
    }],
    ['routing-authority', (candidate) => {
      candidate.phaseCarrierOneToFourTransition.routingAuthority = true;
      candidate.executionRouteReceipt.phaseCarrierOneToFourTransition
        .routingAuthority = true;
    }],
    ['topology-lineage', (candidate) => {
      candidate.phaseCarrierOneToFourTransition.terminalLineage
        .topologyEpoch += 1;
      candidate.executionRouteReceipt.phaseCarrierOneToFourTransition
        .terminalLineage.topologyEpoch += 1;
    }],
    ['source-retirement', (candidate) => {
      candidate.phaseCarrierOneToFourTransition.sourceRetirement
        .terminalFenceSatisfied = false;
      candidate.executionRouteReceipt.phaseCarrierOneToFourTransition
        .sourceRetirement.terminalFenceSatisfied = false;
      candidate.executionRouteReceipt.execution
        .phaseCarrierOneToFourSourceRetirement.terminalFenceSatisfied = false;
    }],
    ['final-cardinality', (candidate) => {
      for (const cardinality of [
        candidate.particleCardinality,
        candidate.executionRouteReceipt.particleCardinality
      ]) {
        cardinality.targetParticleCount = 7;
        cardinality.targetSphStateParticleCount = 7;
        cardinality.targetSphUploadParticleCount = 7;
        cardinality.targetMlsMpmStateParticleCount = 7;
        cardinality.targetMlsMpmUploadParticleCount = 7;
        cardinality.terminalStepParticleCount = 7;
      }
    }],
    ['kernel-revision', (candidate) => {
      candidate.phaseCarrierOneToFourTransition
        .materializationKernelRevision = 'forged-kernel';
      candidate.executionRouteReceipt.phaseCarrierOneToFourTransition
        .materializationKernelRevision = 'forged-kernel';
    }],
    ['identity-abi', (candidate) => {
      candidate.phaseCarrierOneToFourTransition.terminalIdentityStrideBytes = 8;
      candidate.executionRouteReceipt.phaseCarrierOneToFourTransition
        .terminalIdentityStrideBytes = 8;
    }],
    ['source-identity-attestation-mismatch', (candidate) => {
      candidate.executionRouteReceipt.topologyAttestation.identityRevision =
        'identity-attestation-forged';
    }],
    ['terminal-byte-length', (candidate) => {
      candidate.phaseCarrierOneToFourTransition
        .terminalMechanicsBufferByteLength -= 4;
      candidate.executionRouteReceipt.phaseCarrierOneToFourTransition
        .terminalMechanicsBufferByteLength -= 4;
    }],
    ['validation-scope', (candidate) => {
      candidate.phaseCarrierOneToFourTransition.validationErrorObserved = true;
      candidate.executionRouteReceipt.phaseCarrierOneToFourTransition
        .validationErrorObserved = true;
    }],
    ['auxiliary-ownership', (candidate) => {
      candidate.phaseCarrierOneToFourTransition
        .auxiliaryBufferOwnershipTransfer.terminalOwnershipAdopted = false;
      candidate.executionRouteReceipt.phaseCarrierOneToFourTransition
        .auxiliaryBufferOwnershipTransfer.terminalOwnershipAdopted = false;
    }]
  ]) {
    const rejected = authorityFixture();
    const candidate = scheduleResult();
    mutate(candidate);
    await assert.rejects(
      runSchroederWorkerLaneScheduleWithAuthority({
        computeManager: rejected.computeManager,
        stateManager: rejected.stateManager,
        scheduleId,
        laneId,
        stateKey,
        stepCount: 1,
        executeSchedule: async () => candidate
      }),
      /execution route receipt was not exactly admitted/,
      suffix
    );
    assert.deepEqual(
      rejected.calls.map(([kind]) => kind),
      ['acquire', 'reject'],
      suffix
    );
  }
});

test('laws-quiescent Tier0 route receipt gates ComputeManager completion and StateManager commit', async () => {
  const fixture = authorityFixture();
  const scheduleId = 'schedule:tier0-route';
  const laneId = 'lane:tier0-route';
  const stateKey = 'state:tier0-route';
  const stepCount = 3;
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: fixture.computeManager,
    stateManager: fixture.stateManager,
    scheduleId,
    laneId,
    stateKey,
    stepCount,
    executeSchedule: async () => tier0ScheduleResult({
      scheduleId,
      laneId,
      stateKey,
      stepCount
    })
  });

  assert.equal(
    result.executionRouteAdmission.status,
    'worker-schedule-execution-route-receipt-admitted'
  );
  assert.equal(
    result.executionRouteAdmission.route,
    'tier0-fused-resident-sequence'
  );
  assert.equal(
    result.computeManagerCompletion.executionRoute,
    'tier0-fused-resident-sequence'
  );
  assert.equal(
    result.commitDelta.payload.executionRouteReceipt.route,
    'tier0-fused-resident-sequence'
  );
  assert.equal(
    result.commitDelta.payload.lawActivationReceipt.contactSolver,
    false
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), [
    'acquire',
    'complete',
    'commit'
  ]);
  assert.equal(fixture.activeLeases.size, 0);
});

test('queue-ordered Tier0 presentation QoS chunks preserve one logical authority publication', async () => {
  const fixture = authorityFixture();
  const scheduleId = 'schedule:tier0-presentation-qos';
  const laneId = 'lane:tier0-presentation-qos';
  const stateKey = 'state:tier0-presentation-qos';
  const stepCount = 5;
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: fixture.computeManager,
    stateManager: fixture.stateManager,
    scheduleId,
    laneId,
    stateKey,
    stepCount,
    executeSchedule: async () => tier0ScheduleResult({
      scheduleId,
      laneId,
      stateKey,
      stepCount,
      submissionStepCounts: [2, 2, 1],
      presentationBoundaryFailureCount: 1
    })
  });

  const execution = result.executionRouteAdmission.receipt.execution;
  assert.equal(
    execution.submissionMode,
    'queue-ordered-presentation-qos-chunks'
  );
  assert.equal(execution.commandSubmissionCount, 3);
  assert.deepEqual(execution.submissionStepCounts, [2, 2, 1]);
  assert.equal(execution.maxSubstepsPerSubmission, 2);
  assert.equal(execution.presentationBoundaryCount, 2);
  assert.equal(execution.presentationBoundaryCompletedCount, 1);
  assert.equal(execution.presentationBoundaryFailureCount, 1);
  assert.equal(execution.logicalAuthorityPublicationCount, 1);
  assert.equal(execution.intermediateAuthorityPublicationCount, 0);
  assert.deepEqual(fixture.calls.map(([kind]) => kind), [
    'acquire',
    'complete',
    'commit'
  ]);
  assert.equal(fixture.activeLeases.size, 0);
});

test('Tier0 admits a dormant motion-watch receipt without activating reaction execution', async () => {
  const fixture = authorityFixture();
  const scheduleId = 'schedule:tier0-reaction-watch';
  const laneId = 'lane:tier0-reaction-watch';
  const stateKey = 'state:tier0-reaction-watch';
  const stepCount = 3;
  const scheduleResult = tier0ScheduleResult({
    scheduleId,
    laneId,
    stateKey,
    stepCount,
    includeReactionWatch: true
  });
  const targetScheduleAuthority =
    scheduleResult.executionRouteReceipt.targetScheduleAuthority;
  assert.equal(targetScheduleAuthority.writerSet.reaction, false);
  assert.equal(targetScheduleAuthority.tableFingerprints.reactionTable, null);
  assert.notEqual(
    targetScheduleAuthority.tableFingerprints.reactionActivationWatchTable,
    null
  );
  assert.equal(
    targetScheduleAuthority.tableFingerprints.watchReactionTableSource,
    'reaction-activation-watch-table'
  );
  assert.match(
    targetScheduleAuthority.tableFingerprints.watchReactionTableFingerprint,
    /^Float32Array:\d+:sha256:reaction-table-combined-records-v2:[a-f0-9]{64}$/
  );
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: fixture.computeManager,
    stateManager: fixture.stateManager,
    scheduleId,
    laneId,
    stateKey,
    stepCount,
    targetScheduleAuthority,
    executeSchedule: async () => scheduleResult
  });

  const observation = result.scheduleResult
    .nextScheduleLawActivationObservation;
  assert.equal(result.scheduleResult.lawActivationReceipt.reaction, false);
  assert.equal(
    result.executionRouteAdmission.route,
    'tier0-fused-resident-sequence'
  );
  assert.equal(
    observation.producerRoute,
    'tier0-fused-resident-sequence'
  );
  assert.equal(observation.observationSucceeded, false);
  assert.equal(observation.rawEvidenceWord, 0xffff_ffff);
  assert.equal(
    observation.routingAuthority,
    SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
  );
  assert.equal(
    observation.reactionTableFingerprint,
    targetScheduleAuthority.tableFingerprints.watchReactionTableFingerprint
  );
  assert.deepEqual(
    result.commitDelta.payload.nextScheduleLawActivationObservation,
    observation
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), [
    'acquire',
    'complete',
    'commit'
  ]);
});

test('canonical route admits an uncertain dormant motion-watch receipt without activating reaction execution', async () => {
  const fixture = authorityFixture();
  const scheduleId = 'schedule:canonical-dormant-reaction-watch';
  const laneId = 'lane:canonical-dormant-reaction-watch';
  const stateKey = 'state:canonical-dormant-reaction-watch';
  const stepCount = 2;
  const scheduleResult = canonicalRouteScheduleEvidence({
    scheduleId,
    laneId,
    stateKey,
    requestedStepCount: stepCount,
    includeReactionWatch: true
  });
  Object.assign(scheduleResult, { scheduleId, laneId, stateKey });
  scheduleResult.retainedBufferRefs = [
    ...scheduleResult.executionRouteReceipt.retainedBufferRefs
  ];
  scheduleResult.gpuFence = terminalScheduleFence({
    scheduleId,
    laneId,
    stateKey,
    completedStepCount: stepCount
  });
  const targetScheduleAuthority =
    scheduleResult.executionRouteReceipt.targetScheduleAuthority;
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: fixture.computeManager,
    stateManager: fixture.stateManager,
    scheduleId,
    laneId,
    stateKey,
    stepCount,
    targetScheduleAuthority,
    executeSchedule: async () => scheduleResult
  });

  const observation = result.scheduleResult
    .nextScheduleLawActivationObservation;
  assert.equal(result.executionRouteAdmission.route, 'canonical-schroeder');
  assert.equal(result.scheduleResult.lawActivationReceipt.reaction, false);
  assert.equal(targetScheduleAuthority.writerSet.reaction, false);
  assert.equal(targetScheduleAuthority.tableFingerprints.reactionTable, null);
  assert.equal(
    targetScheduleAuthority.tableFingerprints.watchReactionTableSource,
    'reaction-activation-watch-table'
  );
  assert.equal(observation.producerRoute, 'canonical-schroeder');
  assert.equal(observation.observationSucceeded, false);
  assert.equal(observation.uncertainty, true);
  assert.equal(observation.triggered, true);
  assert.equal(observation.rawEvidenceWord, 0xffff_ffff);
  assert.equal(
    observation.routingAuthority,
    SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
  );
  assert.equal(
    observation.reactionTableFingerprint,
    targetScheduleAuthority.tableFingerprints.watchReactionTableFingerprint
  );
  assert.deepEqual(
    result.commitDelta.payload.nextScheduleLawActivationObservation,
    observation
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), [
    'acquire',
    'complete',
    'commit'
  ]);
});

test('invalid Tier0 route receipts reject the lease before completion or commit', async () => {
  const cases = [
    ['missing', (result) => {
      delete result.executionRouteReceipt;
    }],
    ['route', (result) => {
      result.executionRouteReceipt.route = 'canonical-schroeder';
    }],
    ['identity', (result) => {
      result.executionRouteReceipt.scheduleId = 'schedule:wrong';
    }],
    ['count', (result) => {
      result.executionRouteReceipt.execution.requestedStepCount += 1;
    }],
    ['active-law', (result) => {
      result.lawActivationReceipt.thermal = true;
      result.executionRouteReceipt.activationReceipt.thermal = true;
    }],
    ['fused-status', (result) => {
      result.executionRouteReceipt.execution.fusedSequenceStatus =
        'fused-resident-sequence-not-executed';
    }],
    ['submission-step-sum', (result) => {
      Object.assign(result.executionRouteReceipt.execution, {
        submissionMode: 'queue-ordered-presentation-qos-chunks',
        commandSubmissionCount: 2,
        submissionStepCounts: [2, 2],
        maxSubstepsPerSubmission: 2,
        presentationBoundaryCount: 1,
        presentationBoundaryCompletedCount: 1
      });
    }],
    ['submission-boundary-count', (result) => {
      Object.assign(result.executionRouteReceipt.execution, {
        submissionMode: 'queue-ordered-presentation-qos-chunks',
        commandSubmissionCount: 2,
        submissionStepCounts: [2, 1],
        maxSubstepsPerSubmission: 2,
        presentationBoundaryCount: 2,
        presentationBoundaryCompletedCount: 2
      });
    }],
    ['intermediate-authority', (result) => {
      result.executionRouteReceipt.execution
        .intermediateAuthorityPublicationCount = 1;
    }],
    ['logical-authority-count', (result) => {
      result.executionRouteReceipt.execution
        .logicalAuthorityPublicationCount = 2;
    }],
    ['lineage', (result) => {
      result.executionRouteReceipt.lineage.target.physicsTick += 1;
    }],
    ['canonical-seal', (result) => {
      result.finalEpochSeal = {
        generationId: 99,
        ...result.finalEpochIdentity
      };
    }],
    ['claimed-outer-authority', (result) => {
      result.executionRouteReceipt.authority.computeManager = 'satisfied';
    }],
    ['motion-mode', (result) => {
      for (const observation of [
        result.nextScheduleLawActivationObservation,
        result.executionRouteReceipt.nextScheduleLawActivationObservation
      ]) {
        observation.motionEnvelope = createSphReactionMotionEnvelope({
          maxFutureSubsteps: 3,
          dtS: observation.motionEnvelope.dtS,
          gridSpacingM: observation.motionEnvelope.gridSpacingM,
          cflFactor: observation.motionEnvelope.cflFactor,
          boxDimsM: observation.motionEnvelope.boxDimsM,
          separationDisplacementEnabled: false,
          contactCorrectionEnabled: false
        });
      }
    }, true],
    ['partial-atomic', (result) => {
      const completedStepCount = result.completedStepCount - 1;
      result.status = 'worker-resident-schedule-cancelled';
      result.cancelled = true;
      result.completedStepCount = completedStepCount;
      result.gpuFence.completedStepCount = completedStepCount;
      result.executionRouteReceipt.execution.completedStepCount =
        completedStepCount;
    }]
  ];

  for (const [suffix, mutate, includeReactionWatch = false] of cases) {
    const fixture = authorityFixture();
    const scheduleId = `schedule:tier0-invalid:${suffix}`;
    const laneId = `lane:tier0-invalid:${suffix}`;
    const stateKey = `state:tier0-invalid:${suffix}`;
    const scheduleResult = tier0ScheduleResult({
      scheduleId,
      laneId,
      stateKey,
      stepCount: 3,
      includeReactionWatch
    });
    const retainedTargetScheduleAuthority =
      scheduleResult.executionRouteReceipt.targetScheduleAuthority;
    mutate(scheduleResult);
    await assert.rejects(
      runSchroederWorkerLaneScheduleWithAuthority({
        computeManager: fixture.computeManager,
        stateManager: fixture.stateManager,
        scheduleId,
        laneId,
        stateKey,
        stepCount: 3,
        targetScheduleAuthority: retainedTargetScheduleAuthority,
        executeSchedule: async () => scheduleResult
      }),
      /execution route receipt was not exactly admitted/
    );
    assert.deepEqual(fixture.calls.map(([kind]) => kind), [
      'acquire',
      'reject'
    ], suffix);
    assert.equal(fixture.activeLeases.size, 0, suffix);
  }
});

test('authoritative two-level schedules require an exact terminal reflux receipt before StateManager commit', async () => {
  const admitted = authorityFixture();
  const scheduleId = 'schedule:terminal-reflux';
  const laneId = 'lane:terminal-reflux';
  const stateKey = 'state:terminal-reflux';
  const stepCount = 3;
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: admitted.computeManager,
    stateManager: admitted.stateManager,
    laneId,
    stateKey,
    scheduleId,
    stepCount,
    twoLevelTerminalRefluxReceiptRequired: true,
    executeSchedule: async ({
      twoLevelTerminalRefluxReceiptRequired
    }) => {
      assert.equal(twoLevelTerminalRefluxReceiptRequired, true);
      return {
        schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
        status: 'worker-resident-schedule-completed',
        scheduleId,
        laneId,
        stateKey,
        completedStepCount: stepCount,
        retainedBufferRefs: ['worker:state'],
        ...canonicalRouteScheduleEvidence({
          scheduleId,
          laneId,
          stateKey,
          requestedStepCount: stepCount,
          retainedBufferRefs: ['worker:state'],
          activationOverrides: {
            twoLevelMechanics: true,
            mechanicsFieldViews: true
          }
        }),
        gpuFence: terminalScheduleFence({
          scheduleId,
          laneId,
          stateKey,
          completedStepCount: stepCount,
          terminalRefluxReceipt: terminalRefluxScheduleReceipt({
            scheduleId,
            laneId,
            stateKey,
            stepCount
          })
        })
      };
    }
  });
  assert.equal(result.stateManagerCommit.accepted, true);
  assert.equal(
    admitted.calls[0][1].copyBudget.compactSummaryBytes,
    stepCount * 136 * Uint32Array.BYTES_PER_ELEMENT
  );
  assert.equal(
    admitted.calls[0][1].copyBudget.readbackBytes,
    2 * Uint32Array.BYTES_PER_ELEMENT
  );

  for (const [suffix, terminalRefluxReceipt] of [
    ['missing', null],
    ['rejected', terminalRefluxScheduleReceipt({
      scheduleId: `${scheduleId}:rejected`,
      laneId: `${laneId}:rejected`,
      stateKey: `${stateKey}:rejected`,
      stepCount,
      admitted: false
    })]
  ]) {
    const fixture = authorityFixture();
    const currentScheduleId = `${scheduleId}:${suffix}`;
    const currentLaneId = `${laneId}:${suffix}`;
    const currentStateKey = `${stateKey}:${suffix}`;
    await assert.rejects(
      runSchroederWorkerLaneScheduleWithAuthority({
        computeManager: fixture.computeManager,
        stateManager: fixture.stateManager,
        laneId: currentLaneId,
        stateKey: currentStateKey,
        scheduleId: currentScheduleId,
        stepCount,
        twoLevelTerminalRefluxReceiptRequired: true,
        executeSchedule: async () => ({
          schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
          status: 'worker-resident-schedule-completed',
          scheduleId: currentScheduleId,
          laneId: currentLaneId,
          stateKey: currentStateKey,
          completedStepCount: stepCount,
          requestedStepCount: stepCount,
          cancelled: false,
          gpuFence: terminalScheduleFence({
            scheduleId: currentScheduleId,
            laneId: currentLaneId,
            stateKey: currentStateKey,
            completedStepCount: stepCount,
            authorityAdmissionReady: true,
            terminalRefluxReceipt
          })
        })
      }),
      /terminal reflux receipt was not exactly admitted/
    );
    assert.deepEqual(fixture.calls.map(([kind]) => kind), [
      'acquire',
      'reject'
    ]);
  }
});

test('worker-device queue fence spelling is admitted and normalized for ComputeManager', async () => {
  const fixture = authorityFixture();
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: fixture.computeManager,
    stateManager: fixture.stateManager,
    laneId: 'lane:worker-device-fence',
    stateKey: 'state:worker-device-fence',
    scheduleId: 'schedule:worker-device-fence',
    executeSchedule: async () => ({
      scheduleId: 'schedule:worker-device-fence',
      laneId: 'lane:worker-device-fence',
      stateKey: 'state:worker-device-fence',
      completedStepCount: 1,
      retainedBufferRefs: ['worker:state'],
      ...canonicalRouteScheduleEvidence({
        scheduleId: 'schedule:worker-device-fence',
        laneId: 'lane:worker-device-fence',
        stateKey: 'state:worker-device-fence',
        requestedStepCount: 1,
        retainedBufferRefs: ['worker:state']
      }),
      gpuFence: terminalScheduleFence({
        scheduleId: 'schedule:worker-device-fence',
        laneId: 'lane:worker-device-fence',
        stateKey: 'state:worker-device-fence',
        completedStepCount: 1
      })
    })
  });

  assert.equal(result.stateManagerCommit.accepted, true);
  assert.equal(
    fixture.calls.find(([kind]) => kind === 'complete')?.[2]?.queueCompletionMethod,
    'queue.onSubmittedWorkDone'
  );
});

test('a cancelled partial worker schedule commits exactly its terminally fenced steps', async () => {
  const fixture = authorityFixture();
  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager: fixture.computeManager,
    stateManager: fixture.stateManager,
    laneId: 'lane:cancelled-partial',
    stateKey: 'state:cancelled-partial',
    scheduleId: 'schedule:cancelled-partial',
    stepCount: 3,
    executeSchedule: async () => ({
      schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
      status: 'worker-resident-schedule-cancelled',
      scheduleId: 'schedule:cancelled-partial',
      laneId: 'lane:cancelled-partial',
      stateKey: 'state:cancelled-partial',
      completedStepCount: 1,
      cancelled: true,
      retainedBufferRefs: ['worker:state'],
      ...canonicalRouteScheduleEvidence({
        scheduleId: 'schedule:cancelled-partial',
        laneId: 'lane:cancelled-partial',
        stateKey: 'state:cancelled-partial',
          requestedStepCount: 3,
          completedStepCount: 1,
          retainedBufferRefs: ['worker:state'],
          cancelled: true
      }),
      gpuFence: terminalScheduleFence({
        scheduleId: 'schedule:cancelled-partial',
        laneId: 'lane:cancelled-partial',
        stateKey: 'state:cancelled-partial',
        completedStepCount: 1
      })
    })
  });

  assert.equal(result.scheduleResult.cancelled, true);
  assert.equal(result.scheduleResult.completedStepCount, 1);
  assert.equal(result.stateManagerCommit.accepted, true);
  const committedDelta = fixture.calls.find(([kind]) => kind === 'commit')?.[1];
  assert.equal(
    committedDelta?.payload?.status,
    'worker-resident-schedule-cancelled'
  );
  assert.equal(committedDelta?.payload?.completedStepCount, 1);
  assert.equal(committedDelta?.payload?.gpuAuthoritativeState, true);
  assert.equal(
    committedDelta?.payload?.finalStep?.gpuAuthoritativeState,
    true
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), [
    'acquire',
    'complete',
    'commit'
  ]);
});

test('outer authority rejects successful dynamic-law evidence forged onto a cancelled partial schedule', async () => {
  const fixture = authorityFixture();
  const scheduleId = 'schedule:cancelled-ready-watch-forgery';
  const laneId = 'lane:cancelled-ready-watch-forgery';
  const stateKey = 'state:cancelled-ready-watch-forgery';
  const retainedBufferRefs = ['worker:state'];
  const candidate = {
    scheduleId,
    laneId,
    stateKey,
    retainedBufferRefs,
    ...canonicalRouteScheduleEvidence({
      scheduleId,
      laneId,
      stateKey,
      requestedStepCount: 3,
      completedStepCount: 1,
      retainedBufferRefs,
      includeReactionWatch: true,
      cancelled: true
    }),
    gpuFence: terminalScheduleFence({
      scheduleId,
      laneId,
      stateKey,
      completedStepCount: 1
    })
  };
  for (const observation of [
    candidate.nextScheduleLawActivationObservation,
    candidate.executionRouteReceipt.nextScheduleLawActivationObservation
  ]) {
    observation.status = 'dynamic-law-routing-observation-ready';
    observation.observationSucceeded = true;
    observation.triggered = true;
    observation.triggeredSourceCount = 1;
    observation.uncertainty = false;
    observation.rawEvidenceWord = 1;
    observation.mapAsyncCount = 1;
    observation.readbackByteLength = Uint32Array.BYTES_PER_ELEMENT;
    observation.failureReason = null;
  }
  const targetScheduleAuthority =
    candidate.executionRouteReceipt.targetScheduleAuthority;
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: fixture.computeManager,
      stateManager: fixture.stateManager,
      laneId,
      stateKey,
      scheduleId,
      stepCount: 3,
      targetScheduleAuthority,
      executeSchedule: async () => candidate
    }),
    /cancelled-dynamic-law-observation-must-be-unmeasured-uncertainty/
  );
  assert.deepEqual(
    fixture.calls.map(([kind]) => kind),
    ['acquire', 'reject']
  );
});

test('worker schedule failure rejects the ComputeManager lease and never commits', async () => {
  const fixture = authorityFixture();
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: fixture.computeManager,
      stateManager: fixture.stateManager,
      laneId: 'lane:b',
      stateKey: 'state:b',
      scheduleId: 'schedule:2',
      executeSchedule: async () => {
        throw new Error('worker exploded');
      }
    }),
    /worker exploded/
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), ['acquire', 'reject']);
  assert.equal(fixture.activeLeases.size, 0);
});

test('non-terminal worker fences fail closed before StateManager commit', async () => {
  const fixture = authorityFixture();
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: fixture.computeManager,
      stateManager: fixture.stateManager,
      laneId: 'lane:c',
      stateKey: 'state:c',
      scheduleId: 'schedule:3',
      executeSchedule: async () => ({
        scheduleId: 'schedule:3',
        laneId: 'lane:c',
        stateKey: 'state:c',
        completedStepCount: 1,
        gpuFence: {
          status: 'gpu-fence-satisfied',
          queueCompletionMethod: 'same-worker-webgpu-queue-in-order',
          fenceSatisfied: true
        }
      })
    }),
    /requires a terminal schedule fence attestation/
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), ['acquire', 'reject']);
});

test('terminal worker fence identity mismatches fail closed before commit', async () => {
  const fixture = authorityFixture();
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: fixture.computeManager,
      stateManager: fixture.stateManager,
      laneId: 'lane:mismatch',
      stateKey: 'state:mismatch',
      scheduleId: 'schedule:mismatch',
      executeSchedule: async () => ({
        schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
        status: 'worker-resident-schedule-completed',
        scheduleId: 'schedule:mismatch',
        laneId: 'lane:mismatch',
        stateKey: 'state:mismatch',
        completedStepCount: 1,
        requestedStepCount: 1,
        cancelled: false,
        gpuFence: terminalScheduleFence({
          scheduleId: 'schedule:other',
          laneId: 'lane:mismatch',
          stateKey: 'state:mismatch',
          completedStepCount: 1
        })
      })
    }),
    /fence identity does not match/
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), ['acquire', 'reject']);
});

test('unsatisfied terminal worker fences fail closed before commit', async () => {
  const fixture = authorityFixture();
  await assert.rejects(
    runSchroederWorkerLaneScheduleWithAuthority({
      computeManager: fixture.computeManager,
      stateManager: fixture.stateManager,
      laneId: 'lane:unsatisfied',
      stateKey: 'state:unsatisfied',
      scheduleId: 'schedule:unsatisfied',
      executeSchedule: async () => ({
        scheduleId: 'schedule:unsatisfied',
        laneId: 'lane:unsatisfied',
        stateKey: 'state:unsatisfied',
        completedStepCount: 1,
        gpuFence: terminalScheduleFence({
          scheduleId: 'schedule:unsatisfied',
          laneId: 'lane:unsatisfied',
          stateKey: 'state:unsatisfied',
          completedStepCount: 1,
          fenceSatisfied: false
        })
      })
    }),
    /GPU fence was not satisfied/
  );
  assert.deepEqual(fixture.calls.map(([kind]) => kind), ['acquire', 'reject']);
});

test('fractional and over-count worker results fail before authority commit', async () => {
  for (const [suffix, completedStepCount, fenceStepCount] of [
    ['fractional', 1.9, 1],
    ['over', 2, 2]
  ]) {
    const fixture = authorityFixture();
    const scheduleId = `schedule:${suffix}-count`;
    const laneId = `lane:${suffix}-count`;
    const stateKey = `state:${suffix}-count`;
    await assert.rejects(
      runSchroederWorkerLaneScheduleWithAuthority({
        computeManager: fixture.computeManager,
        stateManager: fixture.stateManager,
        laneId,
        stateKey,
        scheduleId,
        stepCount: 1,
        executeSchedule: async () => ({
          status: 'worker-resident-schedule-cancelled',
          scheduleId,
          laneId,
          stateKey,
          completedStepCount,
          gpuFence: terminalScheduleFence({
            scheduleId,
            laneId,
            stateKey,
            completedStepCount: fenceStepCount
          })
        })
      }),
      /completedStepCount is not an admissible exact integer/
    );
    assert.deepEqual(fixture.calls.map(([kind]) => kind), [
      'acquire',
      'reject'
    ]);
  }
});

test('worker schedule authority integrates with real PeerCompute managers', async (t) => {
  const computeUrl = new URL(
    '../../peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js',
    import.meta.url
  );
  const stateUrl = new URL(
    '../../peercompute/peercompute/src/peercompute/stateManager/StateManager.js',
    import.meta.url
  );
  const { ComputeManager } = await import(computeUrl.href);
  const { StateManager } = await import(stateUrl.href);
  const computeManager = new ComputeManager({
    enableWorkers: false,
    gpuDeviceId: 'gpu-device:schroeder-worker-authority-test'
  });
  const stateManager = new StateManager(null, {
    docName: `schroeder-worker-authority-${Date.now()}`,
    enablePersistence: false,
    disableNetworkProvider: true,
    disableBroadcast: true,
    deltaNamespace: 'deltas'
  });
  await stateManager.initialize({
    nodeId: 'schroeder-worker-authority-test-node',
    topology: 'single-node',
    createdAt: Date.now()
  });
  t.after(() => stateManager.destroy?.());
  attachResidentStateManagerCommitBridge({ computeManager, stateManager });
  await computeManager.initialize();

  const result = await runSchroederWorkerLaneScheduleWithAuthority({
    computeManager,
    stateManager,
    laneId: 'lane:real-managers',
    stateKey: 'state:real-managers',
    scheduleId: 'schedule:real-managers',
    stepCount: 2,
    executeSchedule: async () => ({
      schema: 'peercompute.ulg.worker-resident-schedule-result.v0',
      status: 'worker-resident-schedule-completed',
      scheduleId: 'schedule:real-managers',
      laneId: 'lane:real-managers',
      stateKey: 'state:real-managers',
      completedStepCount: 2,
      retainedBufferRefs: ['worker:state'],
      ...canonicalRouteScheduleEvidence({
        scheduleId: 'schedule:real-managers',
        laneId: 'lane:real-managers',
        stateKey: 'state:real-managers',
        requestedStepCount: 2,
        retainedBufferRefs: ['worker:state']
      }),
      gpuFence: terminalScheduleFence({
        scheduleId: 'schedule:real-managers',
        laneId: 'lane:real-managers',
        stateKey: 'state:real-managers',
        completedStepCount: 2,
        method: 'queue.onSubmittedWorkDone'
      })
    })
  });

  assert.equal(result.stateManagerCommit.accepted, true);
  assert.equal(result.gpuResidentLaneExecution.gpuFence.fenceSatisfied, true);
  const stats = computeManager.getStats();
  assert.equal(stats.gpuResidentLanes.activeLeaseCount, 0);
  assert.equal(stats.gpuResidentLanes.completedLeaseCount, 1);
});
