import {
  ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA,
  createMlsMpmResidentStepsCommitDelta
} from './sphMlsMpmGpuStep.js';
import {
  readResidentStepsCommittedWarmDelta
} from '../peercomputeResidentCommitBridge.js';
import {
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
} from './sphGpuBuffers.js';
import {
  ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_SCHEMA,
  ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA,
  WORKER_ROUTE_LINEAGE_FIELDS,
  exactWorkerDynamicLawObservation,
  exactWorkerDynamicLawObservationSelf,
  exactWorkerPhaseCarrierOneToFourTransition,
  exactWorkerRouteLineage,
  exactWorkerRouteParticleCardinality,
  exactWorkerRouteStringList,
  workerRouteLineageEquals,
  workerRouteObjectHasExactKeys,
  workerRoutePlainObject,
  workerRouteStringListsEqual,
  workerRouteValuesEqual
} from './schroederWorkerScheduleRouteEvidence.js';
import {
  SCHROEDER_PROSPECTIVE_RETAINED_PRODUCT_GAS_TRANSITION_KIND,
  SCHROEDER_TARGET_SCHEDULE_EXECUTION_GATE,
  ULG_SCHROEDER_TARGET_SCHEDULE_AUTHORITY_SCHEMA,
  createSchroederTargetScheduleAuthority,
  createSchroederTargetScheduleConfiguration,
  createSchroederTargetScheduleProviderAuthority,
  exactSchroederTargetScheduleAuthority,
  schroederTargetScheduleAuthorityEquals,
  schroederTargetScheduleConfigurationReceipt,
  schroederTargetScheduleWriterSetMatchesActivation,
  validateSchroederTargetScheduleConfigurationContinuity
} from './schroederTargetScheduleAuthority.js';
import {
  SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
  SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
} from './schroederDynamicLawRoutingContract.js';

export {
  SCHROEDER_TARGET_SCHEDULE_EXECUTION_GATE,
  ULG_SCHROEDER_TARGET_SCHEDULE_AUTHORITY_SCHEMA,
  ULG_WORKER_PHASE_CARRIER_ONE_TO_FOUR_TRANSITION_SCHEMA,
  ULG_WORKER_SCHEDULE_DYNAMIC_LAW_OBSERVATION_SCHEMA,
  createSchroederTargetScheduleAuthority,
  createSchroederTargetScheduleConfiguration,
  createSchroederTargetScheduleProviderAuthority,
  schroederTargetScheduleConfigurationReceipt
};

export const ULG_SCHROEDER_WORKER_LANE_AUTHORITY_SCHEMA =
  'peercompute.ulg.schroeder-worker-lane-authority.v0';
export const ULG_SCHROEDER_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA =
  'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0';
export const ULG_SCHROEDER_PREDECESSOR_TARGET_TOKEN_CONSUMPTION_DELTA_SCHEMA =
  'peercompute.ulg.schroeder-predecessor-target-token-consumption-delta.v1';
export const ULG_SCHROEDER_PREDECESSOR_TARGET_TOKEN_CONSUMPTION_SCHEMA =
  'peercompute.ulg.schroeder-predecessor-target-token-state-manager-consumption.v1';
export const ULG_SCHROEDER_WORKER_LANE_SEQUENCE_CONTRACT_SCHEMA =
  'peercompute.ulg.schroeder-worker-lane-sequence-contract.v0';
export const ULG_WORKER_RESIDENT_SCHEDULE_TERMINAL_REFLUX_RECEIPT_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-terminal-reflux-receipt.v0';
export const ULG_WORKER_SCHEDULE_EXECUTION_ROUTE_RECEIPT_SCHEMA =
  'peercompute.ulg.worker-schedule-execution-route-receipt.v6';
export const ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA =
  'peercompute.ulg.worker-schedule-law-activation-receipt.v0';
export const ULG_WORKER_TIER0_TOPOLOGY_ATTESTATION_SCHEMA =
  'peercompute.ulg.worker-tier0-topology-attestation.v0';
export const ULG_SCHROEDER_WORKER_HIERARCHY_CONFIG_SCHEMA =
  'peercompute.ulg.schroeder-worker-hierarchy-config.v0';
const SCHROEDER_TERMINAL_REFLUX_HEADER_BYTE_LENGTH = 136
  * Uint32Array.BYTES_PER_ELEMENT;

export const ULG_SCHROEDER_WORKER_LANE_READ_FAMILIES = Object.freeze([
  'sph-particle-state',
  'sph-thermo-phase',
  'mls-mpm-mechanics',
  'resident-product-mass',
  'resident-gas-ledger',
  'pressure-interface-force-rows',
  'schroeder-hierarchy-state'
]);

export const ULG_SCHROEDER_WORKER_LANE_WRITE_FAMILIES = Object.freeze([
  'sph-particle-state',
  'sph-thermo-phase',
  'mls-mpm-mechanics',
  'resident-product-mass',
  'resident-gas-ledger',
  'pressure-interface-force-rows',
  'schroeder-hierarchy-state',
  'resident-render-candidate'
]);

const QUEUE_FENCE_POLICY = 'queue.onSubmittedWorkDone-before-admission';
const COMMIT_SCOPE = 'ulg-sph-resident-pass-dag';
const WORKER_ROUTE_ACTIVATION_FIELDS = Object.freeze([
  'thermal',
  'reaction',
  'contactSolver',
  'contactSolverRequested',
  'contactSolverEscalatedForDynamicLaws',
  'lawQueue',
  'lawNeighborCandidates',
  'phaseVolumeMigration',
  'twoLevelMechanics',
  'surfaceTension',
  'gasBoundaryActionable',
  'explicitVacuumAmbient',
  'phaseVolumeSidecars',
  'mechanicsFieldViews'
]);
const WORKER_ROUTE_ACTIVE_LAW_BLOCKERS = Object.freeze([
  Object.freeze(['thermal', 'thermal-active']),
  Object.freeze(['reaction', 'reaction-active']),
  Object.freeze(['contactSolver', 'contact-solver-active']),
  Object.freeze(['lawQueue', 'law-queue-active']),
  Object.freeze([
    'lawNeighborCandidates',
    'law-neighbor-candidates-active'
  ]),
  Object.freeze(['phaseVolumeMigration', 'phase-volume-migration-active']),
  Object.freeze(['twoLevelMechanics', 'two-level-mechanics-active']),
  Object.freeze(['surfaceTension', 'surface-tension-active']),
  Object.freeze(['gasBoundaryActionable', 'gas-boundary-actionable']),
  Object.freeze(['mechanicsFieldViews', 'mechanics-field-views-required'])
]);
const WORKER_ROUTE_RECEIPT_KEYS = Object.freeze([
  'schema',
  'status',
  'scheduleId',
  'laneId',
  'stateKey',
  'route',
  'routeDecisionStatus',
  'activationReceipt',
  'targetScheduleAuthority',
  'predecessorTargetTokenConsumption',
  'nextScheduleLawActivationObservation',
  'topologyAttestation',
  'phaseCarrierOneToFourTransition',
  'particleCardinality',
  'blockers',
  'transition',
  'execution',
  'lineage',
  'retainedBufferRefs',
  'supersededFamilyRetirement',
  'authority'
]);
const WORKER_ROUTE_EXECUTION_KEYS = Object.freeze([
  'requestedStepCount',
  'completedStepCount',
  'atomicSchedule',
  'progressMode',
  'cancellationMode',
  'preflightSchema',
  'preflightStatus',
  'fusedSequenceSchema',
  'fusedSequenceStatus',
  'commandSubmissionCount',
  'internalPositionSubstepCount',
  'fullParticleReadbackPerformed',
  'fullParticleReadbackFree',
  'mapAsyncCount',
  'readbackBytes',
  'residentContinuationReady',
  'canonicalSpatialEpochGenerated',
  'canonicalSpatialGenerationId',
  'finalEpochSealRequired',
  'terminalFenceSatisfied',
  'sameWorkerDevice',
  'submittedCleanupOwnership',
  'submittedCleanupRegistrationCount',
  'submittedCleanupRelease',
  'phaseCarrierOneToFourMaterialized',
  'phaseCarrierOneToFourCommandSubmissionCount',
  'phaseCarrierOneToFourFullParticleReadbackPerformed',
  'phaseCarrierOneToFourSourceRetirement'
]);
const WORKER_ROUTE_LINEAGE_KEYS = Object.freeze([
  'source',
  'target',
  'storageGenerationDelta',
  'physicsTickDelta',
  'committedPositionEpochDelta',
  'topologyChanged',
  'hierarchyIdentityChanged',
  'exactParticleFamily'
]);
const WORKER_ROUTE_AUTHORITY_KEYS = Object.freeze([
  'workerTerminalFence',
  'computeManager',
  'stateManager',
  'presentation'
]);
const WORKER_PREDECESSOR_TARGET_TOKEN_CONSUMPTION_KEYS = Object.freeze([
  'schema',
  'status',
  'predecessorScheduleId',
  'targetScheduleRequestId',
  'targetScheduleAuthorityFingerprint',
  'consumerScheduleId',
  'laneId',
  'stateKey',
  'terminalLineage',
  'sourceParticleCount',
  'sourcePhaseLaneCount',
  'conservativeActivationRequired',
  'configurationContinuityMode',
  'predecessorConfigurationFingerprint',
  'currentConfigurationFingerprint',
  'prospectiveDynamicLawTransitionFingerprint',
  'consumedBeforeRouteSelection',
  'consumedBeforeGpuWork',
  'shadowOnly',
  'routingAuthority',
  'executionGating'
]);
const WORKER_ROUTE_CLEANUP_RELEASE_KEYS = Object.freeze([
  'schema',
  'status',
  'terminalFenceSatisfied',
  'registeredCount',
  'releasedCount',
  'failedCount'
]);
const WORKER_ROUTE_RETIREMENT_KEYS = Object.freeze([
  'schema',
  'status',
  'terminalFenceSatisfied',
  'retiredBufferCount',
  'seedAssignmentRetired'
]);
const WORKER_ROUTE_TOPOLOGY_ATTESTATION_KEYS = Object.freeze([
  'schema',
  'status',
  'phaseCarrierPlanSchema',
  'phaseCarrierPlanStatus',
  'lineageCapacity',
  'primaryCapacity',
  'phaseLaneCount',
  'phaseLaneStride',
  'companionStart',
  'companionCapacity',
  'particleCapacity',
  'sourceParticleCount',
  'phaseCompanionLanesRequired',
  'identityBufferRequired',
  'identityBufferPresent',
  'identitySchema',
  'identityStrideBytes',
  'identityRevision',
  'identityBufferByteLength',
  'identityBufferSize',
  'identityStorageUsage',
  'identityDeviceMatched',
  'identityAuthorityComplete',
  'exactFourBufferFamily',
  'exactFourBufferDeviceFamily',
  'planMatchesParticleFamily'
]);
const WORKER_FINAL_EPOCH_SEAL_KEYS = Object.freeze([
  'schema',
  'generationId',
  'deviceId',
  'consumerDeviceId',
  'directoryAbiVersion',
  'mechanicsLevelCount',
  'mechanicsLevels',
  ...WORKER_ROUTE_LINEAGE_FIELDS
]);
const WORKER_RESIDENT_STEP_OPTION_FIELDS = Object.freeze([
  'internalPressureScale',
  'ambientPressurePa',
  'externalGaugePressurePa',
  'externalGaugePressureEnabled',
  'mechanicsSubmitBurstSteps',
  'contactSolverEnabled',
  'consumeCompactMechanicsView',
  'observeCanonicalSpatialAuthority',
  'phaseVolumeMaxImpulseFraction',
  'pressureFeedback',
  'gasPressureSummary',
  'pressureInterfaceGasCellFieldImport',
  'pressureInterfaceGasCellFieldAdmission',
  'pressureInterfaceGridForceAdmission',
  'contactKinematicsParticleBinMetadataReadback',
  'contactJacobiIterations',
  'contactCleanupPassBudget',
  'contactInnerRounds',
  'contactCleanupProfileReadback',
  'residentGpuTimestampProfilingRequested',
  'residentGpuTimestampProfiling',
  'reactionParticleBinMetadataReadback',
  // Diagnostic-only fixed-size GPU authority receipts. Keep this explicit:
  // ordinary worker schedules remain readback-free unless the caller opts in.
  'stageMechanicsTraceEnabled',
  'thermalMaterialTable',
  'mechanicsMaterialTable',
  'thermalStepOptions',
  'mechanicsRefreshOptions',
  'reactionTable',
  'reactionActivationWatchTable',
  'reactionStepOptions',
  'cohortRanges',
  'parityTolerances',
  'compactSummaryMode',
  'compactSummaryScope',
  'activeGridDispatchPlanRefreshMode',
  'activeGridSafetyCells',
  'schroederPressureInterfaceOwnerScopeDiagnosticReadback'
]);

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function nonEmptyString(value, fallback = null) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function optionalInteger(value, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new RangeError(`expected an integer in [${min}, ${max}]`);
  }
  return number;
}

function optionalPositiveFinite(value) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new RangeError('expected a finite positive number');
  }
  return number;
}

/**
 * Freeze the exact clone-safe hierarchy policy consumed by a worker lane.
 *
 * Keeping this separate from residentStepOptions is deliberate: these fields
 * select hierarchy stages and therefore must participate in lane identity,
 * even when their value is false. Omitting a false value would otherwise let
 * runSchroederSameLevelMechanicsWebGpu inherit its historically permissive
 * defaults and make UI/config telemetry disagree with the executed graph.
 */
export function createSchroederWorkerHierarchyConfig(options = {}) {
  const selectedLevel = optionalInteger(options.selectedLevel ?? 0);
  const minLevel = optionalInteger(options.minLevel);
  const maxLevel = optionalInteger(options.maxLevel);
  if (minLevel != null && maxLevel != null && minLevel > maxLevel) {
    throw new RangeError('minLevel must be less than or equal to maxLevel');
  }
  if (
    minLevel != null
    && maxLevel != null
    && (selectedLevel < minLevel || selectedLevel > maxLevel)
  ) {
    throw new RangeError('selectedLevel must lie inside [minLevel, maxLevel]');
  }
  const enableTwoLevelMechanics = options.enableTwoLevelMechanics === true;
  const twoLevelMechanicsAuthority =
    String(options.twoLevelMechanicsAuthority ?? 'observation')
      .trim()
      .toLowerCase() === 'authoritative'
      ? 'authoritative'
      : 'observation';
  const twoLevelFineSubstepCount = optionalInteger(
    options.twoLevelFineSubstepCount
      ?? (twoLevelMechanicsAuthority === 'authoritative' ? 2 : 1),
    { min: 1, max: 4 }
  );
  if (
    enableTwoLevelMechanics
    && twoLevelMechanicsAuthority === 'authoritative'
    && twoLevelFineSubstepCount < 2
  ) {
    throw new RangeError(
      'authoritative two-level mechanics requires at least two fine substeps'
    );
  }
  const config = {
    schema: ULG_SCHROEDER_WORKER_HIERARCHY_CONFIG_SCHEMA,
    status: 'schroeder-worker-hierarchy-config-ready',
    selectedLevel,
    baseGridSpacingM: optionalPositiveFinite(options.baseGridSpacingM),
    minLevel,
    maxLevel,
    tileCellCount: optionalInteger(options.tileCellCount, { min: 1 }),
    spatialArenaCount: optionalInteger(options.spatialArenaCount, {
      min: 1,
      max: 8
    }),
    enableTwoLevelMechanics,
    twoLevelMechanicsAuthority,
    twoLevelFineSubstepCount,
    enableMechanicsFieldPairV2:
      options.enableMechanicsFieldPairV2 === true,
    enablePortableSummary: options.enablePortableSummary === true,
    enableActiveNodeIndex: options.enableActiveNodeIndex === true,
    enableActiveNodeSortedIndex:
      options.enableActiveNodeSortedIndex === true,
    activeNodeSortedIndexPolicyMode:
      nonEmptyString(options.activeNodeSortedIndexPolicyMode),
    lawNeighborTraversalPolicyMode:
      nonEmptyString(options.lawNeighborTraversalPolicyMode),
    lawNeighborCandidateReadbackMode:
      nonEmptyString(options.lawNeighborCandidateReadbackMode),
    enableLawQueue: options.enableLawQueue === true,
    enableLawNeighborCandidates:
      options.enableLawNeighborCandidates === true,
    enableCrossLevelCoupling:
      options.enableCrossLevelCoupling === true,
    enablePhaseVolumeMigration:
      options.enablePhaseVolumeMigration === true
  };
  const signature = [
    config.selectedLevel,
    config.baseGridSpacingM ?? 'default',
    config.minLevel ?? 'default',
    config.maxLevel ?? 'default',
    config.tileCellCount ?? 'default',
    config.spatialArenaCount ?? 'default',
    config.enableTwoLevelMechanics ? 1 : 0,
    config.twoLevelMechanicsAuthority,
    config.twoLevelFineSubstepCount,
    config.enableMechanicsFieldPairV2 ? 1 : 0,
    config.enablePortableSummary ? 1 : 0,
    config.enableActiveNodeIndex ? 1 : 0,
    config.enableActiveNodeSortedIndex ? 1 : 0,
    config.activeNodeSortedIndexPolicyMode ?? 'default',
    config.lawNeighborTraversalPolicyMode ?? 'default',
    config.lawNeighborCandidateReadbackMode ?? 'none',
    config.enableLawQueue ? 1 : 0,
    config.enableLawNeighborCandidates ? 1 : 0,
    config.enableCrossLevelCoupling ? 1 : 0,
    config.enablePhaseVolumeMigration ? 1 : 0
  ].join(':');
  return Object.freeze({ ...config, signature });
}

function cloneableByteLength(value) {
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (value instanceof ArrayBuffer) return value.byteLength;
  return 0;
}

function cloneWorkerValue(value, seen = new WeakMap()) {
  if (value == null || ['string', 'boolean'].includes(typeof value)) {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value instanceof DataView) {
    const buffer = value.buffer.slice(
      value.byteOffset,
      value.byteOffset + value.byteLength
    );
    return new DataView(buffer);
  }
  if (ArrayBuffer.isView(value)) return new value.constructor(value);
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (typeof value !== 'object') return undefined;
  // GPU resources and device-bound wrappers are never cloneable authority
  // inputs. Detect the common WebGPU capability surface without relying on
  // browser constructors that are absent in node tests.
  if (
    typeof value.destroy === 'function'
    || typeof value.mapAsync === 'function'
    || typeof value.createBindGroup === 'function'
    || typeof value.createCommandEncoder === 'function'
  ) return undefined;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const output = [];
    seen.set(value, output);
    for (const entry of value) {
      const cloned = cloneWorkerValue(entry, seen);
      if (cloned !== undefined) output.push(cloned);
    }
    return output;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const output = {};
  seen.set(value, output);
  for (const [key, entry] of Object.entries(value)) {
    const cloned = cloneWorkerValue(entry, seen);
    if (cloned !== undefined) output[key] = cloned;
  }
  return output;
}

export function createSchroederWorkerResidentStepOptions(options = {}) {
  const selected = {};
  for (const field of WORKER_RESIDENT_STEP_OPTION_FIELDS) {
    const cloned = cloneWorkerValue(options?.[field]);
    if (cloned !== undefined) selected[field] = cloned;
  }
  // A page-device upload can be nested inside thermal/mechanics options. It
  // is deliberately absent; the worker materializes static GPU tables on its
  // own device from the retained clone-safe table inputs.
  if (selected.thermalStepOptions) {
    delete selected.thermalStepOptions.thermalResponseGraphUpload;
  }
  if (selected.reactionStepOptions) {
    delete selected.reactionStepOptions.thermalResponseGraphUpload;
  }
  if (selected.mechanicsRefreshOptions) {
    delete selected.mechanicsRefreshOptions.mechanicsMaterialPhaseUpload;
  }
  return selected;
}

export function estimateSchroederWorkerLaneSeedUploadBytes({
  sphParticleState = null,
  mlsMpmParticleState = null
} = {}) {
  return [
    sphParticleState?.state,
    sphParticleState?.thermo,
    sphParticleState?.identity,
    mlsMpmParticleState?.mechanics
  ].reduce((total, value) => total + cloneableByteLength(value), 0);
}

export function createSchroederWorkerLaneSequenceContract({
  laneId,
  stateKey,
  domainKey = null,
  stepCount = 1
} = {}) {
  const requestedStepCount = positiveInteger(stepCount, 1);
  const executionRouteProfiles = Object.freeze([
    Object.freeze({
      id: 'tier0-fused-resident-sequence',
      selectionAuthority:
        'peercompute.ulg.worker-schedule-execution-route-decision.v0',
      lawActivationEvidence:
        ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA,
      activationMode: 'laws-quiescent-exact',
      atomicSchedule: true,
      canonicalSpatialEpochRequired: false,
      progressMode: 'terminal-only',
      cancellationMode: 'terminal-only-after-atomic-submit',
      stageIds: Object.freeze([
        'tier0FusedResidentSequence',
        'residentRenderCandidate'
      ])
    }),
    Object.freeze({
      id: 'canonical-schroeder',
      selectionAuthority:
        'peercompute.ulg.worker-schedule-execution-route-decision.v0',
      lawActivationEvidence:
        ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA,
      activationMode: 'dynamic-laws-or-structural-blocker',
      atomicSchedule: false,
      canonicalSpatialEpochRequired: true,
      progressMode: 'per-canonical-step',
      cancellationMode: 'between-canonical-steps',
      stageIds: Object.freeze([
        'schroederSpatialEpoch',
        'schroederHierarchyMechanics',
        'residentRenderCandidate'
      ])
    })
  ]);
  return Object.freeze({
    schema: ULG_SCHROEDER_WORKER_LANE_SEQUENCE_CONTRACT_SCHEMA,
    status: 'worker-internal-batched-stage-dag-ready',
    authority: 'NodeKernel/ComputeManager/StateManager',
    executionOwner: 'offscreen-presentation-worker',
    executionMode: 'worker-internal-batched-stage-dag',
    laneId: nonEmptyString(laneId),
    stateKey: nonEmptyString(stateKey),
    domainKey: nonEmptyString(domainKey),
    stepCount: requestedStepCount,
    sequenceRunnable: true,
    defaultEnabled: true,
    stageDependencyMode: 'sequential-stage-order',
    queueFencePolicy: QUEUE_FENCE_POLICY,
    routeSelectionAuthority:
      'peercompute.ulg.worker-schedule-execution-route-decision.v0',
    lawActivationEvidence:
      ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA,
    executionRouteProfiles,
    passDagStages: Object.freeze([
      Object.freeze({
        id: 'schroederSpatialEpoch',
        lawNodeId: 'ulg-mls-mpm-mechanics-schroederSpatialEpoch-stage',
        runtimeTarget: 'offscreen-presentation-worker-resident-lane',
        reads: ['sph-particle-state', 'schroeder-hierarchy-state'],
        writes: ['schroeder-spatial-epoch']
      }),
      Object.freeze({
        id: 'schroederHierarchyMechanics',
        lawNodeId: 'ulg-mls-mpm-mechanics-schroederHierarchyMechanics-stage',
        runtimeTarget: 'offscreen-presentation-worker-resident-lane',
        dependsOn: ['schroederSpatialEpoch'],
        reads: [
          'schroeder-spatial-epoch',
          'sph-particle-state',
          'sph-thermo-phase',
          'mls-mpm-mechanics',
          'resident-product-mass',
          'resident-gas-ledger',
          'pressure-interface-force-rows'
        ],
        writes: [
          'sph-particle-state',
          'sph-thermo-phase',
          'mls-mpm-mechanics',
          'resident-product-mass',
          'resident-gas-ledger',
          'pressure-interface-force-rows',
          'schroeder-hierarchy-state'
        ]
      }),
      Object.freeze({
        id: 'residentRenderCandidate',
        lawNodeId: 'ulg-resident-render-candidate-publication',
        runtimeTarget: 'offscreen-presentation-worker',
        dependsOn: ['schroederHierarchyMechanics'],
        reads: ['sph-particle-state', 'sph-thermo-phase'],
        writes: ['resident-render-candidate']
      })
    ])
  });
}

function requireAuthorityManagers(computeManager, stateManager) {
  for (const method of [
    'acquireGpuResidentLaneLease',
    'completeGpuResidentLaneLease',
    'rejectGpuResidentLaneLease',
    'commitDelta'
  ]) {
    if (typeof computeManager?.[method] !== 'function') {
      throw new TypeError(
        `Schroeder worker lane authority requires ComputeManager.${method}()`
      );
    }
  }
  if (
    !stateManager
    || typeof stateManager.commitDelta !== 'function'
    || (
      typeof stateManager.getWarmDeltas !== 'function'
      && typeof stateManager.readWarm !== 'function'
      && typeof stateManager.getDataState !== 'function'
    )
  ) {
    throw new TypeError(
      'Schroeder worker lane authority requires a readable and writable StateManager warm-delta store'
    );
  }
}

function readStateManagerWarmEntry(stateManager, { taskId, scope } = {}) {
  if (!stateManager || !nonEmptyString(taskId)) return undefined;
  if (typeof stateManager.getWarmDeltas === 'function') {
    const deltas = stateManager.getWarmDeltas(scope);
    if (deltas && Object.prototype.hasOwnProperty.call(deltas, taskId)) {
      return deltas[taskId];
    }
  }
  if (typeof stateManager.readWarm === 'function') {
    const entry = stateManager.readWarm(taskId, scope);
    if (entry !== undefined) return entry;
  }
  const dataState = typeof stateManager.getDataState === 'function'
    ? stateManager.getDataState()
    : null;
  return typeof dataState?.readWarm === 'function'
    ? dataState.readWarm(taskId, scope)
    : undefined;
}

function workerFenceFromScheduleResult(scheduleResult = null, {
  scheduleId = null,
  laneId = null,
  stateKey = null,
  requestedStepCount = null,
  twoLevelTerminalRefluxReceiptRequired = false
} = {}) {
  const fence = scheduleResult?.gpuFence;
  if (!fence || typeof fence !== 'object') {
    throw new Error('Schroeder worker schedule completed without a GPU fence');
  }
  if (
    scheduleResult?.scheduleId !== scheduleId
    || scheduleResult?.laneId !== laneId
    || scheduleResult?.stateKey !== stateKey
  ) {
    throw new Error(
      'Schroeder worker schedule result identity does not match its authority request'
    );
  }
  if (fence.fenceSatisfied !== true) {
    throw new Error('Schroeder worker schedule GPU fence was not satisfied');
  }
  if (
    fence.required !== true
    || fence.terminalScheduleFence !== true
    || fence.scope !== 'resident-schedule-terminal'
    || fence.authorityAdmissionReady !== true
  ) {
    throw new Error(
      'Schroeder worker schedule requires a terminal schedule fence attestation'
    );
  }
  const completedStepCount = Number(scheduleResult?.completedStepCount);
  if (
    !Number.isSafeInteger(completedStepCount)
    || completedStepCount < 0
    || completedStepCount > requestedStepCount
    || (
      scheduleResult?.status === 'worker-resident-schedule-completed'
      && completedStepCount !== requestedStepCount
    )
  ) {
    throw new Error(
      'Schroeder worker schedule completedStepCount is not an admissible exact integer'
    );
  }
  if (
    scheduleResult?.schema
      !== 'peercompute.ulg.worker-resident-schedule-result.v0'
    || scheduleResult.requestedStepCount !== requestedStepCount
    || (
      scheduleResult.status === 'worker-resident-schedule-completed'
        ? !(
            scheduleResult.cancelled === false
            && completedStepCount === requestedStepCount
          )
        : scheduleResult.status === 'worker-resident-schedule-cancelled'
          ? !(
              scheduleResult.cancelled === true
              && completedStepCount < requestedStepCount
            )
          : true
    )
  ) {
    throw new Error(
      'Schroeder worker schedule status/cancellation envelope is not exact'
    );
  }
  if (
    fence.scheduleId !== scheduleId
    || fence.laneId !== laneId
    || fence.stateKey !== stateKey
    || fence.completedStepCount !== completedStepCount
  ) {
    throw new Error(
      'Schroeder worker terminal schedule fence identity does not match its schedule result'
    );
  }
  if (twoLevelTerminalRefluxReceiptRequired === true) {
    const receipt = fence.terminalRefluxReceipt ?? null;
    if (
      receipt?.schema
        !== ULG_WORKER_RESIDENT_SCHEDULE_TERMINAL_REFLUX_RECEIPT_SCHEMA
      || receipt.status !== 'terminal-reflux-schedule-receipt-admitted'
      || receipt.required !== true
      || receipt.scheduleId !== scheduleId
      || receipt.laneId !== laneId
      || receipt.stateKey !== stateKey
      || receipt.expectedStepCount !== completedStepCount
      || receipt.observedStepCount !== completedStepCount
      || receipt.admittedStepCount !== completedStepCount
      || receipt.firstRejectedStepOrdinal != null
      || receipt.allStepsAdmitted !== true
    ) {
      throw new Error(
        'Schroeder worker schedule terminal reflux receipt was not exactly admitted'
      );
    }
  }
  const method = nonEmptyString(
    fence.queueCompletionMethod,
    nonEmptyString(fence.method)
  );
  const queueOnSubmittedWorkDoneMethods = new Set([
    'queue.onSubmittedWorkDone',
    'worker-device.queue.onSubmittedWorkDone'
  ]);
  if (!queueOnSubmittedWorkDoneMethods.has(method)) {
    throw new Error(
      `Schroeder worker schedule requires queue.onSubmittedWorkDone, got ${
        method || 'no completion method'
      }`
    );
  }
  return fence;
}

function deepFreezeWorkerRouteValue(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const entry of Object.values(value)) deepFreezeWorkerRouteValue(entry);
  return Object.freeze(value);
}

function cloneWorkerRouteReceipt(value) {
  let clone = null;
  try {
    clone = structuredClone(value);
  } catch {
    return null;
  }
  return deepFreezeWorkerRouteValue(clone);
}

function exactWorkerRouteActivationReceipt(value) {
  if (
    !value
    || typeof value !== 'object'
    || value.schema !== ULG_WORKER_SCHEDULE_LAW_ACTIVATION_RECEIPT_SCHEMA
    || value.activationAuthority
      !== 'schedule-config-static-declaration-no-readback'
    || !workerRouteObjectHasExactKeys(value, [
      'schema',
      'activationAuthority',
      ...WORKER_ROUTE_ACTIVATION_FIELDS
    ])
  ) return null;
  const receipt = {
    schema: value.schema,
    activationAuthority: value.activationAuthority
  };
  for (const field of WORKER_ROUTE_ACTIVATION_FIELDS) {
    if (typeof value[field] !== 'boolean') return null;
    receipt[field] = value[field];
  }
  if (
    receipt.phaseVolumeSidecars
      !== (receipt.phaseVolumeMigration || receipt.twoLevelMechanics)
    || receipt.contactSolver
      !== (
        receipt.contactSolverRequested
        || receipt.contactSolverEscalatedForDynamicLaws
      )
    || (
      receipt.contactSolverEscalatedForDynamicLaws
      && (
        receipt.contactSolverRequested
        || !(
          receipt.thermal
          || receipt.reaction
          || receipt.lawQueue
          || receipt.lawNeighborCandidates
          || receipt.phaseVolumeMigration
          || receipt.twoLevelMechanics
          || receipt.surfaceTension
          || receipt.gasBoundaryActionable
        )
      )
    )
  ) return null;
  return receipt;
}

function workerRouteActivationEquals(left, right) {
  const exactLeft = exactWorkerRouteActivationReceipt(left);
  const exactRight = exactWorkerRouteActivationReceipt(right);
  return Boolean(
    exactLeft
    && exactRight
    && exactLeft.activationAuthority === exactRight.activationAuthority
    && WORKER_ROUTE_ACTIVATION_FIELDS.every(
      (field) => exactLeft[field] === exactRight[field]
    )
  );
}

function workerRouteReceiptError(reason) {
  const error = new Error(
    `Schroeder worker schedule execution route receipt was not exactly admitted: ${reason}`
  );
  error.code = 'ERR_ULG_WORKER_SCHEDULE_EXECUTION_ROUTE_RECEIPT_REJECTED';
  error.reason = reason;
  return error;
}

function requireWorkerRouteReceipt(condition, reason) {
  if (!condition) throw workerRouteReceiptError(reason);
}

function validateOuterPredecessorTargetToken({
  stateManager,
  currentTargetScheduleAuthority,
  predecessorTargetScheduleAuthority = null,
  predecessorDynamicLawObservation = null,
  scheduleId,
  laneId,
  stateKey
} = {}) {
  const currentObservation =
    currentTargetScheduleAuthority?.predecessorDynamicLawObservation ?? null;
  if (
    currentObservation == null
    && predecessorTargetScheduleAuthority == null
    && predecessorDynamicLawObservation == null
  ) return null;
  const predecessorAuthority = exactSchroederTargetScheduleAuthority(
    predecessorTargetScheduleAuthority
  );
  const predecessorObservation = exactWorkerDynamicLawObservationSelf(
    predecessorDynamicLawObservation
  );
  requireWorkerRouteReceipt(
    Boolean(predecessorAuthority)
      && Boolean(predecessorObservation)
      && workerRouteValuesEqual(
        currentObservation,
        predecessorObservation
      ),
    'predecessor-target-token-outer-authority'
  );
  requireWorkerRouteReceipt(
    predecessorAuthority.sourceScheduleId
      === predecessorObservation.sourceScheduleId
      && predecessorAuthority.targetScheduleRequestId === scheduleId
      && predecessorAuthority.targetScheduleRequestId
        === predecessorObservation.targetScheduleRequestId
      && predecessorAuthority.requestFingerprint
        === predecessorObservation.targetScheduleAuthorityFingerprint
      && predecessorAuthority.laneId === laneId
      && predecessorAuthority.stateKey === stateKey
      && predecessorObservation.laneId === laneId
      && predecessorObservation.stateKey === stateKey
      && workerRouteLineageEquals(
        predecessorObservation.terminalLineage,
        currentTargetScheduleAuthority.sourceLineage
      )
      && predecessorObservation.particleCount
        === currentTargetScheduleAuthority.sourceParticleCount,
    'predecessor-target-token-successor-binding'
  );
  const configurationContinuity =
    validateSchroederTargetScheduleConfigurationContinuity({
      predecessorTargetScheduleAuthority: predecessorAuthority,
      currentTargetScheduleAuthority,
      predecessorDynamicLawObservation: predecessorObservation
    });
  requireWorkerRouteReceipt(
    configurationContinuity.ready === true,
    'predecessor-target-token-configuration'
  );
  const consumerTaskId = `ulg:schroeder-worker-schedule:${scheduleId}`;
  const stateManagerConsumptionTaskId =
    `ulg:schroeder-predecessor-target-token-consumption:${scheduleId}`;
  const existingConsumerWarmEntry = readStateManagerWarmEntry(stateManager, {
    taskId: consumerTaskId,
    scope: COMMIT_SCOPE
  });
  const existingConsumptionWarmEntry = readStateManagerWarmEntry(
    stateManager,
    {
      taskId: stateManagerConsumptionTaskId,
      scope: COMMIT_SCOPE
    }
  );
  requireWorkerRouteReceipt(
    existingConsumerWarmEntry == null
      && existingConsumptionWarmEntry == null,
    'predecessor-target-token-replayed'
  );
  const predecessorTaskId =
    `ulg:schroeder-worker-schedule:${predecessorAuthority.sourceScheduleId}`;
  const warmEntry = readStateManagerWarmEntry(stateManager, {
    taskId: predecessorTaskId,
    scope: COMMIT_SCOPE
  });
  const warmPayload = warmEntry?.payload ?? null;
  const warmRouteReceipt = warmPayload?.executionRouteReceipt ?? null;
  const warmExecution = warmRouteReceipt?.execution ?? null;
  const warmGpuFence = warmPayload?.gpuFence ?? null;
  const warmGpuResidentLaneRequirement =
    warmPayload?.gpuResidentLaneRequirement ?? null;
  const warmCompletedStepCount = warmPayload?.completedStepCount;
  const warmRequestedStepCount = warmExecution?.requestedStepCount;
  const warmStatusAndCountExact = Boolean(
    Number.isSafeInteger(warmCompletedStepCount)
    && Number.isSafeInteger(warmRequestedStepCount)
    && warmRequestedStepCount > 0
    && (
      warmPayload?.status === 'worker-resident-schedule-completed'
        ? warmCompletedStepCount === warmRequestedStepCount
        : warmPayload?.status === 'worker-resident-schedule-cancelled'
          && warmCompletedStepCount > 0
          && warmCompletedStepCount < warmRequestedStepCount
    )
  );
  const warmTargetLineage = exactWorkerRouteLineage(
    warmRouteReceipt?.lineage?.target,
    { exactKeys: true }
  );
  const warmParticleCardinality = exactWorkerRouteParticleCardinality(
    warmRouteReceipt?.particleCardinality
  );
  const warmTerminalPhaseLaneCount = Number(
    warmRouteReceipt?.phaseCarrierOneToFourTransition
      ?.terminalPhaseCarrierPlan?.phaseLaneCount
    ?? predecessorAuthority.sourcePhaseLaneCount
  );
  requireWorkerRouteReceipt(
    warmPayload?.schema === ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA
      && warmPayload?.stateKey === stateKey
      && warmStatusAndCountExact
      && (
        configurationContinuity.mode
          === 'exact-configuration-continuation'
        || warmPayload?.status === 'worker-resident-schedule-completed'
      )
      && warmExecution?.completedStepCount === warmCompletedStepCount
      && warmExecution?.terminalFenceSatisfied === true
      && warmRequestedStepCount
        === predecessorAuthority.motionEnvelope.maxFutureSubsteps
      && warmGpuFence?.required === true
      && warmGpuFence?.fenceSatisfied === true
      && warmGpuFence?.laneId === laneId
      && warmGpuFence?.stateKey === stateKey
      && warmGpuFence?.queueFencePolicy === QUEUE_FENCE_POLICY
      && warmGpuFence?.status === 'queue-work-completed'
      && warmGpuFence?.method === 'queue.onSubmittedWorkDone'
      && warmGpuFence?.queueCompletionStatus === 'queue-work-completed'
      && warmGpuFence?.queueCompletionMethod === 'queue.onSubmittedWorkDone'
      && warmGpuResidentLaneRequirement?.laneId === laneId
      && warmGpuResidentLaneRequirement?.stateKey === stateKey
      && warmGpuResidentLaneRequirement?.queueFencePolicy
        === QUEUE_FENCE_POLICY
      && schroederTargetScheduleAuthorityEquals(
        warmPayload?.targetScheduleAuthority,
        predecessorAuthority
      )
      && workerRouteValuesEqual(
        warmPayload?.nextScheduleLawActivationObservation,
        predecessorObservation
      )
      && schroederTargetScheduleAuthorityEquals(
        warmRouteReceipt?.targetScheduleAuthority,
        predecessorAuthority
      )
      && workerRouteValuesEqual(
        warmRouteReceipt?.nextScheduleLawActivationObservation,
        predecessorObservation
      )
      && warmRouteReceipt?.scheduleId
        === predecessorAuthority.sourceScheduleId
      && warmRouteReceipt?.laneId === laneId
      && warmRouteReceipt?.stateKey === stateKey
      && Boolean(warmTargetLineage)
      && workerRouteLineageEquals(
        warmTargetLineage,
        predecessorObservation.terminalLineage
      )
      && warmParticleCardinality?.targetParticleCount
        === predecessorObservation.particleCount
      && warmTerminalPhaseLaneCount
        === currentTargetScheduleAuthority.sourcePhaseLaneCount,
    'predecessor-target-token-state-manager-issuance'
  );
  return deepFreezeWorkerRouteValue({
    schema: 'peercompute.ulg.schroeder-predecessor-target-token-admission.v2',
    status: 'predecessor-target-token-issued-by-state-manager',
    stateManagerConsumptionTaskId,
    predecessorTaskId,
    predecessorScheduleId: predecessorAuthority.sourceScheduleId,
    targetScheduleRequestId: predecessorAuthority.targetScheduleRequestId,
    targetScheduleAuthorityFingerprint:
      predecessorAuthority.requestFingerprint,
    consumerScheduleId: scheduleId,
    laneId,
    stateKey,
    terminalLineage: { ...predecessorObservation.terminalLineage },
    sourceParticleCount: predecessorObservation.particleCount,
    sourcePhaseLaneCount: warmTerminalPhaseLaneCount,
    conservativeActivationRequired:
      configurationContinuity.conservativeActivationRequired === true,
    configurationContinuityMode: configurationContinuity.mode,
    predecessorConfigurationFingerprint:
      configurationContinuity.predecessorConfigurationFingerprint,
    currentConfigurationFingerprint:
      configurationContinuity.currentConfigurationFingerprint,
    prospectiveDynamicLawTransitionFingerprint:
      configurationContinuity.prospectiveDynamicLawTransitionFingerprint,
    shadowOnly: SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY,
    routingAuthority: SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
    executionGating: SCHROEDER_TARGET_SCHEDULE_EXECUTION_GATE
  });
}

function persistOuterPredecessorTargetTokenConsumption({
  stateManager,
  admission
} = {}) {
  if (admission == null) return null;
  const taskId = nonEmptyString(admission.stateManagerConsumptionTaskId);
  requireWorkerRouteReceipt(
    Boolean(taskId)
      && readStateManagerWarmEntry(stateManager, {
        taskId,
        scope: COMMIT_SCOPE
      }) == null,
    'predecessor-target-token-replayed'
  );
  const payload = deepFreezeWorkerRouteValue({
    ...structuredClone(admission),
    schema:
      ULG_SCHROEDER_PREDECESSOR_TARGET_TOKEN_CONSUMPTION_SCHEMA,
    status:
      'predecessor-target-token-consumed-before-lease-acquisition',
    consumedBeforeLeaseAcquisition: true,
    consumedBeforeScheduleDispatch: true,
    consumedBeforeGpuWork: true
  });
  const delta = deepFreezeWorkerRouteValue({
    schema:
      ULG_SCHROEDER_PREDECESSOR_TARGET_TOKEN_CONSUMPTION_DELTA_SCHEMA,
    taskId,
    scope: COMMIT_SCOPE,
    version: 0,
    timestamp: Date.now(),
    payload
  });
  stateManager.commitDelta(delta);
  const warmEntry = readStateManagerWarmEntry(stateManager, {
    taskId,
    scope: COMMIT_SCOPE
  });
  requireWorkerRouteReceipt(
    warmEntry?.version === delta.version
      && warmEntry?.ts === delta.timestamp
      && workerRouteValuesEqual(warmEntry?.payload, payload),
    'predecessor-target-token-state-manager-consumption'
  );
  return deepFreezeWorkerRouteValue({
    delta,
    warmEntry: structuredClone(warmEntry)
  });
}

function exactWorkerPredecessorTargetTokenConsumption(value, {
  targetScheduleAuthority = null,
  scheduleId = null,
  laneId = null,
  stateKey = null
} = {}) {
  const authority = exactSchroederTargetScheduleAuthority(
    targetScheduleAuthority
  );
  const observation = authority?.predecessorDynamicLawObservation ?? null;
  const terminalLineage = exactWorkerRouteLineage(
    value?.terminalLineage,
    { exactKeys: true }
  );
  if (!authority || !observation) return null;
  const currentConfiguration =
    schroederTargetScheduleConfigurationReceipt(authority);
  const predecessorTransition = authority.predecessorDynamicLawTransition;
  const expectedConfigurationContinuityMode = predecessorTransition == null
    ? 'exact-configuration-continuation'
    : predecessorTransition.kind
        === SCHROEDER_PROSPECTIVE_RETAINED_PRODUCT_GAS_TRANSITION_KIND
      ? 'prospective-retained-product-gas-boundary-actionable'
      : 'prospective-reaction-dormant-to-executing';
  const expectedPredecessorConfigurationFingerprint = predecessorTransition
    ?.sourceConfiguration?.configurationFingerprint
    ?? currentConfiguration?.configurationFingerprint
    ?? null;
  const expectedCurrentConfigurationFingerprint = currentConfiguration
    ?.configurationFingerprint ?? null;
  const expectedTransitionFingerprint = predecessorTransition
    ?.transitionFingerprint ?? null;
  const expectedConservativeActivationRequired = Boolean(
    observation.prospectiveWriterEvidence?.terminalGpuFenceSatisfied === true
    && observation.prospectiveWriterEvidence?.scheduleCancelled === false
    && (
      observation.uncertainty
      || observation.triggered
      || observation.prospectiveWriterEvidence?.gasBoundaryActionable
    )
  );
  if (
    !workerRouteObjectHasExactKeys(
      value,
      WORKER_PREDECESSOR_TARGET_TOKEN_CONSUMPTION_KEYS
    )
    || value.schema
      !== 'peercompute.ulg.worker-predecessor-target-token-consumption.v2'
    || value.status
      !== 'predecessor-target-token-consumed-before-route-selection'
    || value.predecessorScheduleId !== observation.sourceScheduleId
    || value.targetScheduleRequestId !== observation.targetScheduleRequestId
    || value.targetScheduleAuthorityFingerprint
      !== observation.targetScheduleAuthorityFingerprint
    || value.consumerScheduleId !== scheduleId
    || value.consumerScheduleId !== authority.sourceScheduleId
    || value.laneId !== laneId
    || value.stateKey !== stateKey
    || !terminalLineage
    || !workerRouteLineageEquals(
      terminalLineage,
      observation.terminalLineage
    )
    || value.sourceParticleCount !== authority.sourceParticleCount
    || value.sourceParticleCount !== observation.particleCount
    || value.sourcePhaseLaneCount !== authority.sourcePhaseLaneCount
    || value.conservativeActivationRequired
      !== expectedConservativeActivationRequired
    || value.configurationContinuityMode
      !== expectedConfigurationContinuityMode
    || value.predecessorConfigurationFingerprint
      !== expectedPredecessorConfigurationFingerprint
    || value.currentConfigurationFingerprint
      !== expectedCurrentConfigurationFingerprint
    || value.prospectiveDynamicLawTransitionFingerprint
      !== expectedTransitionFingerprint
    || value.consumedBeforeRouteSelection !== true
    || value.consumedBeforeGpuWork !== true
    || value.shadowOnly !== SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
    || value.routingAuthority !== SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
    || value.executionGating !== SCHROEDER_TARGET_SCHEDULE_EXECUTION_GATE
  ) return null;
  return value;
}

/**
 * Admit the worker's schedule-boundary route evidence before either outer
 * authority is allowed to mutate. Dynamic-law selection stays worker-local,
 * but ComputeManager/StateManager accept only its exact clone-safe receipt.
 */
export function validateSchroederWorkerScheduleExecutionRouteReceipt(
  scheduleResult = null,
  {
    scheduleId = null,
    laneId = null,
    stateKey = null,
    requestedStepCount = null,
    targetScheduleAuthority = null
  } = {}
) {
  const receipt = scheduleResult?.executionRouteReceipt ?? null;
  requireWorkerRouteReceipt(
    workerRouteObjectHasExactKeys(receipt, WORKER_ROUTE_RECEIPT_KEYS)
      && receipt.schema === ULG_WORKER_SCHEDULE_EXECUTION_ROUTE_RECEIPT_SCHEMA,
    'schema'
  );
  requireWorkerRouteReceipt(
    receipt.scheduleId === scheduleId
      && receipt.laneId === laneId
      && receipt.stateKey === stateKey,
    'schedule-identity'
  );
  const route = receipt.route;
  requireWorkerRouteReceipt(
    route === 'tier0-fused-resident-sequence'
      || route === 'canonical-schroeder',
    'route'
  );
  const activation = exactWorkerRouteActivationReceipt(
    receipt.activationReceipt
  );
  requireWorkerRouteReceipt(Boolean(activation), 'activation-receipt');
  requireWorkerRouteReceipt(
    workerRouteActivationEquals(
      receipt.activationReceipt,
      scheduleResult?.lawActivationReceipt
    ),
    'activation-receipt-mismatch'
  );
  const latchedTargetScheduleAuthority = targetScheduleAuthority == null
    ? null
    : cloneWorkerRouteReceipt(targetScheduleAuthority);
  const expectedTargetScheduleAuthority = latchedTargetScheduleAuthority == null
    ? null
    : exactSchroederTargetScheduleAuthority(latchedTargetScheduleAuthority);
  requireWorkerRouteReceipt(
    targetScheduleAuthority == null
      || Boolean(expectedTargetScheduleAuthority),
    'target-schedule-authority-expected'
  );
  requireWorkerRouteReceipt(
    expectedTargetScheduleAuthority == null
      ? receipt.targetScheduleAuthority == null
      : schroederTargetScheduleAuthorityEquals(
          receipt.targetScheduleAuthority,
          expectedTargetScheduleAuthority
        ),
    'target-schedule-authority-mismatch'
  );
  const rawPredecessorTargetTokenConsumption =
    receipt.predecessorTargetTokenConsumption;
  const predecessorTargetTokenConsumption =
    rawPredecessorTargetTokenConsumption == null
      ? null
      : exactWorkerPredecessorTargetTokenConsumption(
          rawPredecessorTargetTokenConsumption,
          {
            targetScheduleAuthority: expectedTargetScheduleAuthority,
            scheduleId,
            laneId,
            stateKey
          }
        );
  requireWorkerRouteReceipt(
    expectedTargetScheduleAuthority?.predecessorDynamicLawObservation == null
      ? rawPredecessorTargetTokenConsumption == null
      : Boolean(predecessorTargetTokenConsumption),
    'predecessor-target-token-consumption'
  );
  requireWorkerRouteReceipt(
    workerRouteValuesEqual(
      rawPredecessorTargetTokenConsumption,
      scheduleResult?.predecessorTargetTokenConsumption ?? null
    ),
    'predecessor-target-token-consumption-mismatch'
  );
  const blockers = exactWorkerRouteStringList(receipt.blockers);
  requireWorkerRouteReceipt(Boolean(blockers), 'blockers');
  const tier0Transitions = new Set([
    'fresh-to-tier0-schedule-boundary',
    'tier0-continuation'
  ]);
  const canonicalTransitions = new Set([
    'fresh-or-canonical-continuation',
    'tier0-to-canonical-schedule-boundary',
    'tier0-one-to-four-to-canonical-schedule-boundary'
  ]);
  requireWorkerRouteReceipt(
    (route === 'tier0-fused-resident-sequence'
      ? tier0Transitions
      : canonicalTransitions).has(receipt.transition),
    'transition'
  );
  const requestedCount = requestedStepCount;
  const completedCount = scheduleResult?.completedStepCount;
  const execution = receipt.execution ?? null;
  requireWorkerRouteReceipt(
    Number.isSafeInteger(requestedCount)
      && requestedCount > 0
      && Number.isSafeInteger(completedCount)
      && completedCount >= 0
      && completedCount <= requestedCount
      && scheduleResult?.requestedStepCount === requestedCount
      && workerRouteObjectHasExactKeys(
        execution,
        WORKER_ROUTE_EXECUTION_KEYS
      )
      && execution.requestedStepCount === requestedCount
      && execution.completedStepCount === completedCount
      && execution.terminalFenceSatisfied === true
      && execution.sameWorkerDevice === true,
    'execution-count-or-worker-fence'
  );
  const retainedBufferRefs = exactWorkerRouteStringList(
    scheduleResult?.retainedBufferRefs
  );
  requireWorkerRouteReceipt(
    Boolean(retainedBufferRefs)
      && retainedBufferRefs.length > 0
      && workerRouteStringListsEqual(
        receipt.retainedBufferRefs,
        retainedBufferRefs
      ),
    'retained-buffer-refs'
  );
  requireWorkerRouteReceipt(
    workerRouteObjectHasExactKeys(
      receipt.authority,
      WORKER_ROUTE_AUTHORITY_KEYS
    )
      && receipt.authority.workerTerminalFence === 'satisfied'
      && receipt.authority.computeManager === 'pending'
      && receipt.authority.stateManager === 'pending'
      && receipt.authority.presentation === 'pending',
    'outer-authority-state'
  );
  requireWorkerRouteReceipt(
    workerRouteObjectHasExactKeys(receipt.lineage, WORKER_ROUTE_LINEAGE_KEYS),
    'lineage-envelope'
  );
  const sourceLineage = exactWorkerRouteLineage(
    receipt.lineage.source,
    { exactKeys: true }
  );
  const targetLineage = exactWorkerRouteLineage(
    receipt.lineage.target,
    { exactKeys: true }
  );
  requireWorkerRouteReceipt(
    Boolean(sourceLineage)
      && Boolean(targetLineage)
      && receipt.lineage.exactParticleFamily === true
      && workerRouteLineageEquals(
        targetLineage,
        scheduleResult?.finalMechanicsLineage
      ),
    'lineage'
  );
  const rawPhaseCarrierOneToFourTransition =
    receipt.phaseCarrierOneToFourTransition;
  const phaseCarrierOneToFourTransition =
    rawPhaseCarrierOneToFourTransition == null
      ? null
      : exactWorkerPhaseCarrierOneToFourTransition(
          rawPhaseCarrierOneToFourTransition,
          { scheduleId, sourceLineage }
        );
  requireWorkerRouteReceipt(
    rawPhaseCarrierOneToFourTransition == null
      || Boolean(phaseCarrierOneToFourTransition),
    'phase-carrier-one-to-four-transition'
  );
  requireWorkerRouteReceipt(
    workerRouteValuesEqual(
      rawPhaseCarrierOneToFourTransition,
      scheduleResult?.phaseCarrierOneToFourTransition ?? null
    ),
    'phase-carrier-one-to-four-transition-mismatch'
  );
  const authenticatedDynamicReactionSuccessor = Boolean(
    predecessorTargetTokenConsumption?.configurationContinuityMode
      === 'prospective-reaction-dormant-to-executing'
  );
  requireWorkerRouteReceipt(
    phaseCarrierOneToFourTransition == null
      || (
        route === 'canonical-schroeder'
        && (activation.thermal === true || activation.reaction === true)
        && phaseCarrierOneToFourTransition.trigger
          === (authenticatedDynamicReactionSuccessor
            ? 'authenticated-dynamic-reaction-successor'
            : activation.thermal === true
              ? 'static-thermal-law-active'
              : 'static-reaction-law-active')
      ),
    'phase-carrier-one-to-four-activation'
  );
  const predecessorSourcePhaseLaneCount =
    predecessorTargetTokenConsumption?.sourcePhaseLaneCount ?? null;
  requireWorkerRouteReceipt(
    !authenticatedDynamicReactionSuccessor
      ? phaseCarrierOneToFourTransition?.trigger
          !== 'authenticated-dynamic-reaction-successor'
      : predecessorSourcePhaseLaneCount === 1
        ? phaseCarrierOneToFourTransition?.trigger
            === 'authenticated-dynamic-reaction-successor'
        : predecessorSourcePhaseLaneCount === 4
          && phaseCarrierOneToFourTransition == null,
    'dynamic-reaction-successor-phase-carrier-transition'
  );
  const phaseCarrierLawActive = Boolean(
    activation.thermal === true || activation.reaction === true
  );
  const tier0CanonicalSameCountClaim =
    receipt.transition === 'tier0-to-canonical-schedule-boundary';
  const tier0CanonicalOneToFourClaim =
    receipt.transition
      === 'tier0-one-to-four-to-canonical-schedule-boundary';
  requireWorkerRouteReceipt(
    tier0CanonicalOneToFourClaim
      === Boolean(phaseCarrierOneToFourTransition),
    'phase-carrier-one-to-four-transition-proof'
  );
  requireWorkerRouteReceipt(
    !(
      route === 'canonical-schroeder'
      && tier0CanonicalSameCountClaim
      && phaseCarrierLawActive
    ),
    'tier0-canonical-phase-carrier-one-to-four-required'
  );
  const particleCardinality = exactWorkerRouteParticleCardinality(
    receipt.particleCardinality
  );
  requireWorkerRouteReceipt(
    Boolean(particleCardinality)
      && workerRouteValuesEqual(
        receipt.particleCardinality,
        scheduleResult?.particleCardinality
      )
      && (
        phaseCarrierOneToFourTransition
          ? particleCardinality.sourceParticleCount
              === phaseCarrierOneToFourTransition.sourceParticleCount
            && particleCardinality.targetParticleCount
              === phaseCarrierOneToFourTransition.terminalParticleCount
            && particleCardinality.targetParticleCount
              === particleCardinality.sourceParticleCount * 4
          : particleCardinality.targetParticleCount
            === particleCardinality.sourceParticleCount
      ),
    'particle-cardinality'
  );
  if (expectedTargetScheduleAuthority) {
    requireWorkerRouteReceipt(
      expectedTargetScheduleAuthority.status
        === 'target-schedule-authority-ready'
        && expectedTargetScheduleAuthority.sourceScheduleId === scheduleId
        && expectedTargetScheduleAuthority.laneId === laneId
        && expectedTargetScheduleAuthority.stateKey === stateKey
        && expectedTargetScheduleAuthority.motionEnvelope.maxFutureSubsteps
          === requestedCount
        && workerRouteLineageEquals(
          expectedTargetScheduleAuthority.sourceLineage,
          sourceLineage
        )
        && expectedTargetScheduleAuthority.sourceParticleCount
          === particleCardinality.sourceParticleCount
        && schroederTargetScheduleWriterSetMatchesActivation(
          expectedTargetScheduleAuthority.writerSet,
          activation
        )
        && expectedTargetScheduleAuthority.writerSet.crossLevelCoupling
          === blockers.includes('cross-level-coupling-active')
        && expectedTargetScheduleAuthority.writerSet.mechanicsFieldPairV2
          === blockers.includes('mechanics-field-pair-v2-active')
        && expectedTargetScheduleAuthority.writerSet
          .scheduleStepOptionsProviderMayWrite
          === blockers.includes('schedule-step-options-provider-present'),
      'target-schedule-authority-request'
    );
    if (receipt.topologyAttestation != null) {
      requireWorkerRouteReceipt(
        expectedTargetScheduleAuthority.sourcePhaseLaneCount
          === receipt.topologyAttestation.phaseLaneCount,
        'target-schedule-authority-topology'
      );
    }
  }
  const rawDynamicLawObservation =
    receipt.nextScheduleLawActivationObservation;
  const dynamicLawObservation = rawDynamicLawObservation == null
    ? null
    : exactWorkerDynamicLawObservation(rawDynamicLawObservation, {
        scheduleId,
        laneId,
        stateKey,
        terminalLineage: targetLineage,
        requestedStepCount: requestedCount,
        thermalPhaseEvolutionRequired: Boolean(
          activation.thermal
          || activation.phaseVolumeMigration
          || blockers.includes('schedule-step-options-provider-present')
        ),
        expectedContactCorrectionEnabled: activation.contactSolver,
        expectedTargetScheduleRequestId:
          expectedTargetScheduleAuthority?.targetScheduleRequestId ?? null,
        expectedTargetScheduleAuthorityFingerprint:
          expectedTargetScheduleAuthority?.requestFingerprint ?? null,
        expectedReactionTableFingerprint:
          expectedTargetScheduleAuthority?.tableFingerprints
            ?.watchReactionTableFingerprint ?? null,
        expectedReactionCount:
          expectedTargetScheduleAuthority?.tableFingerprints
            ?.watchReactionCount ?? null
      });
  requireWorkerRouteReceipt(
    workerRouteValuesEqual(
      rawDynamicLawObservation,
      scheduleResult?.nextScheduleLawActivationObservation ?? null
    ),
    'dynamic-law-observation-mismatch'
  );
  requireWorkerRouteReceipt(
    rawDynamicLawObservation == null
      ? expectedTargetScheduleAuthority?.tableFingerprints
          ?.watchReactionTableFingerprint == null
      : Boolean(expectedTargetScheduleAuthority)
        && workerRouteValuesEqual(
          rawDynamicLawObservation.motionEnvelope,
          expectedTargetScheduleAuthority.motionEnvelope
        )
        && rawDynamicLawObservation.targetScheduleRequestId
          === expectedTargetScheduleAuthority.targetScheduleRequestId
        && rawDynamicLawObservation.targetScheduleAuthorityFingerprint
          === expectedTargetScheduleAuthority.requestFingerprint
        && rawDynamicLawObservation.reactionCount
          === expectedTargetScheduleAuthority.tableFingerprints
            .watchReactionCount
        && (
          rawDynamicLawObservation.observationSucceeded !== true
          || rawDynamicLawObservation.reactionTableFingerprint
            === expectedTargetScheduleAuthority.tableFingerprints
              .watchReactionTableFingerprint
        ),
    'dynamic-law-target-schedule-authority'
  );
  requireWorkerRouteReceipt(
    activation.reaction === true
      ? route === 'canonical-schroeder'
        && dynamicLawObservation?.producerRoute === 'canonical-schroeder'
      : rawDynamicLawObservation === null
        || (
          (route === 'tier0-fused-resident-sequence'
            && dynamicLawObservation?.producerRoute
              === 'tier0-fused-resident-sequence')
          || (route === 'canonical-schroeder'
            && dynamicLawObservation?.producerRoute
              === 'canonical-schroeder')
        ),
    'dynamic-law-observation'
  );
  requireWorkerRouteReceipt(
    !dynamicLawObservation
      || dynamicLawObservation.particleCount
        === particleCardinality.targetParticleCount,
    'dynamic-law-observation-particle-cardinality'
  );
  requireWorkerRouteReceipt(
    scheduleResult?.cancelled !== true
      || dynamicLawObservation == null
      || (
        dynamicLawObservation.observationSucceeded === false
        && dynamicLawObservation.uncertainty === true
        && dynamicLawObservation.triggered === true
        && dynamicLawObservation.triggeredSourceCount === null
        && dynamicLawObservation.rawEvidenceWord === null
        && dynamicLawObservation.mapAsyncCount === 0
        && dynamicLawObservation.readbackByteLength === 0
        && dynamicLawObservation.prospectiveWriterEvidence
          ?.gasBoundaryActionable === false
        && dynamicLawObservation.prospectiveWriterEvidence
          ?.scheduleCancelled === true
      ),
    'cancelled-dynamic-law-observation-must-be-unmeasured-uncertainty'
  );

  if (route === 'tier0-fused-resident-sequence') {
    requireWorkerRouteReceipt(
      phaseCarrierOneToFourTransition == null
        && execution.phaseCarrierOneToFourMaterialized === false
        && execution.phaseCarrierOneToFourCommandSubmissionCount === 0
        && execution.phaseCarrierOneToFourFullParticleReadbackPerformed
          === false
        && execution.phaseCarrierOneToFourSourceRetirement == null,
      'tier0-phase-carrier-one-to-four-absent'
    );
    requireWorkerRouteReceipt(
      receipt.status === 'tier0-fused-resident-sequence-admitted'
        && receipt.routeDecisionStatus
          === 'tier0-fused-resident-sequence-selected',
      'tier0-status'
    );
    requireWorkerRouteReceipt(
      blockers.length === 0
        && WORKER_ROUTE_ACTIVE_LAW_BLOCKERS.every(
          ([field]) => activation[field] === false
        )
        && activation.explicitVacuumAmbient === true
        && activation.phaseVolumeSidecars === false,
      'tier0-laws-not-quiescent'
    );
    requireWorkerRouteReceipt(
      scheduleResult?.status === 'worker-resident-schedule-completed'
        && scheduleResult?.cancelled !== true
        && completedCount === requestedCount
        && execution.atomicSchedule === true
        && execution.progressMode === 'terminal-only'
        && execution.cancellationMode
          === 'terminal-only-after-atomic-submit',
      'tier0-atomic-completion'
    );
    requireWorkerRouteReceipt(
      execution.preflightSchema
        === 'peercompute.ulg.mls-mpm-fused-resident-sequence-preflight.v0'
        && execution.preflightStatus
          === 'fused-resident-sequence-preflight-ready'
        && execution.fusedSequenceSchema
          === 'peercompute.ulg.mls-mpm-fused-resident-sequence.v0'
        && execution.fusedSequenceStatus
          === 'fused-resident-sequence-executed'
        && execution.commandSubmissionCount === 1
        && execution.internalPositionSubstepCount === requestedCount,
      'tier0-fused-execution'
    );
    requireWorkerRouteReceipt(
      execution.fullParticleReadbackPerformed === false
        && execution.fullParticleReadbackFree === true
        && execution.mapAsyncCount === 0
        && execution.readbackBytes === 0
        && execution.residentContinuationReady === true
        && execution.canonicalSpatialEpochGenerated === false
        && execution.canonicalSpatialGenerationId == null
        && execution.finalEpochSealRequired === false
        && scheduleResult?.finalEpochSeal == null
        && workerRouteLineageEquals(
          targetLineage,
          scheduleResult?.finalEpochIdentity
        ),
      'tier0-readback-or-canonical-artifact'
    );
    const cleanupRelease = execution.submittedCleanupRelease ?? null;
    requireWorkerRouteReceipt(
      execution.submittedCleanupOwnership === 'caller-terminal-fence'
        && execution.submittedCleanupRegistrationCount === 1
        && workerRouteObjectHasExactKeys(
          cleanupRelease,
          WORKER_ROUTE_CLEANUP_RELEASE_KEYS
        )
        && cleanupRelease.schema
          === 'peercompute.ulg.worker-tier0-submitted-cleanup-release.v0'
        && cleanupRelease.status
          === 'tier0-submitted-cleanup-released-after-terminal-fence'
        && cleanupRelease.terminalFenceSatisfied === true
        && cleanupRelease.registeredCount === 1
        && cleanupRelease.releasedCount === 1
        && cleanupRelease.failedCount === 0,
      'tier0-submitted-cleanup'
    );
    const topologyAttestation = receipt.topologyAttestation ?? null;
    requireWorkerRouteReceipt(
      workerRouteObjectHasExactKeys(
        topologyAttestation,
        WORKER_ROUTE_TOPOLOGY_ATTESTATION_KEYS
      )
        && topologyAttestation.schema
          === ULG_WORKER_TIER0_TOPOLOGY_ATTESTATION_SCHEMA
        && topologyAttestation.status
          === 'tier0-topology-quiescence-attested'
        && topologyAttestation.phaseCarrierPlanSchema
          === 'peercompute.ulg.sph-phase-carrier-plan.v2'
        && topologyAttestation.phaseCarrierPlanStatus
          === 'phase-lane-capacity-ready'
        && Number.isSafeInteger(topologyAttestation.sourceParticleCount)
        && topologyAttestation.sourceParticleCount > 0
        && topologyAttestation.lineageCapacity
          === topologyAttestation.sourceParticleCount
        && topologyAttestation.primaryCapacity
          === topologyAttestation.sourceParticleCount
        && topologyAttestation.phaseLaneCount === 1
        && topologyAttestation.phaseLaneStride
          === topologyAttestation.sourceParticleCount
        && topologyAttestation.companionStart
          === topologyAttestation.sourceParticleCount
        && topologyAttestation.companionCapacity === 0
        && topologyAttestation.particleCapacity
          === topologyAttestation.sourceParticleCount
        && topologyAttestation.phaseCompanionLanesRequired === false
        && topologyAttestation.identityBufferRequired === true
        && topologyAttestation.identityBufferPresent === true
        && topologyAttestation.identitySchema
          === ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
        && topologyAttestation.identityStrideBytes
          === SPH_GPU_PARTICLE_IDENTITY_UINTS
            * Uint32Array.BYTES_PER_ELEMENT
        && nonEmptyString(topologyAttestation.identityRevision)
        && topologyAttestation.identityBufferByteLength
          === topologyAttestation.sourceParticleCount
            * SPH_GPU_PARTICLE_IDENTITY_UINTS
            * Uint32Array.BYTES_PER_ELEMENT
        && Number.isSafeInteger(topologyAttestation.identityBufferSize)
        && topologyAttestation.identityBufferSize
          >= topologyAttestation.identityBufferByteLength
        && topologyAttestation.identityStorageUsage === true
        && topologyAttestation.identityDeviceMatched === true
        && topologyAttestation.identityAuthorityComplete === true
        && topologyAttestation.exactFourBufferFamily === true
        && topologyAttestation.exactFourBufferDeviceFamily === true
        && topologyAttestation.planMatchesParticleFamily === true
        && topologyAttestation.sourceParticleCount
          === particleCardinality.sourceParticleCount
        && retainedBufferRefs.length === 4,
      'tier0-topology-attestation'
    );
    requireWorkerRouteReceipt(
      targetLineage.storageGeneration === sourceLineage.storageGeneration + 1
        && targetLineage.physicsTick
          === sourceLineage.physicsTick + requestedCount
        && targetLineage.physicsSubstep === 0
        && targetLineage.positionEpoch === sourceLineage.positionEpoch + 1
        && targetLineage.topologyEpoch === sourceLineage.topologyEpoch
        && targetLineage.chartEpoch === sourceLineage.chartEpoch
        && targetLineage.levelEpoch === sourceLineage.levelEpoch
        && targetLineage.supportEpoch === sourceLineage.supportEpoch
        && receipt.lineage.storageGenerationDelta === 1
        && receipt.lineage.physicsTickDelta === requestedCount
        && receipt.lineage.committedPositionEpochDelta === 1
        && receipt.lineage.topologyChanged === false
        && receipt.lineage.hierarchyIdentityChanged === false,
      'tier0-lineage-transition'
    );
    const retirement = receipt.supersededFamilyRetirement ?? null;
    requireWorkerRouteReceipt(
      workerRouteObjectHasExactKeys(retirement, WORKER_ROUTE_RETIREMENT_KEYS)
        && retirement.schema
          === 'peercompute.ulg.worker-tier0-superseded-family-retirement.v0'
        && retirement.status
        === 'tier0-superseded-family-retired-after-terminal-fence'
        && retirement.terminalFenceSatisfied === true
        && Number.isSafeInteger(retirement.retiredBufferCount)
        && retirement.retiredBufferCount >= 0
        && typeof retirement.seedAssignmentRetired === 'boolean',
      'tier0-superseded-family-retirement'
    );
  } else {
    requireWorkerRouteReceipt(
      receipt.status === 'canonical-schroeder-admitted'
        && receipt.routeDecisionStatus === 'canonical-schroeder-selected',
      'canonical-status'
    );
    requireWorkerRouteReceipt(
      blockers.length > 0
        && WORKER_ROUTE_ACTIVE_LAW_BLOCKERS.every(
          ([field, blocker]) => !activation[field] || blockers.includes(blocker)
        ),
      'canonical-activation-blockers'
    );
    requireWorkerRouteReceipt(
      execution.atomicSchedule === false
        && execution.progressMode === 'per-canonical-step'
        && execution.cancellationMode === 'between-canonical-steps'
        && execution.preflightSchema == null
        && execution.preflightStatus == null
        && execution.fusedSequenceSchema == null
        && execution.fusedSequenceStatus == null
        && execution.commandSubmissionCount == null
        && execution.internalPositionSubstepCount == null
        && execution.fullParticleReadbackPerformed == null
        && execution.fullParticleReadbackFree == null
        && execution.mapAsyncCount == null
        && execution.readbackBytes == null
        && execution.residentContinuationReady == null
        && execution.submittedCleanupOwnership == null
        && execution.submittedCleanupRegistrationCount == null
        && execution.submittedCleanupRelease == null
        && receipt.supersededFamilyRetirement == null
        && receipt.lineage.storageGenerationDelta == null
        && receipt.lineage.physicsTickDelta == null
        && receipt.lineage.committedPositionEpochDelta == null
        && (
          phaseCarrierOneToFourTransition
            ? execution.phaseCarrierOneToFourMaterialized === true
              && execution.phaseCarrierOneToFourCommandSubmissionCount === 1
              && execution.phaseCarrierOneToFourFullParticleReadbackPerformed
                === false
              && workerRouteValuesEqual(
                execution.phaseCarrierOneToFourSourceRetirement,
                phaseCarrierOneToFourTransition.sourceRetirement
              )
              && receipt.lineage.topologyChanged === true
              && receipt.lineage.hierarchyIdentityChanged === false
              && receipt.transition
                === 'tier0-one-to-four-to-canonical-schedule-boundary'
            : execution.phaseCarrierOneToFourMaterialized === false
              && execution.phaseCarrierOneToFourCommandSubmissionCount === 0
              && execution.phaseCarrierOneToFourFullParticleReadbackPerformed
                === false
              && execution.phaseCarrierOneToFourSourceRetirement == null
              && receipt.topologyAttestation == null
              && receipt.lineage.topologyChanged == null
              && receipt.lineage.hierarchyIdentityChanged == null
        ),
      'canonical-execution-profile'
    );
    if (phaseCarrierOneToFourTransition) {
      const topologyAttestation = receipt.topologyAttestation;
      requireWorkerRouteReceipt(
        workerRouteObjectHasExactKeys(
          topologyAttestation,
          WORKER_ROUTE_TOPOLOGY_ATTESTATION_KEYS
        )
          && topologyAttestation.schema
            === ULG_WORKER_TIER0_TOPOLOGY_ATTESTATION_SCHEMA
          && topologyAttestation.status
            === 'tier0-topology-quiescence-attested'
          && topologyAttestation.phaseCarrierPlanSchema
            === 'peercompute.ulg.sph-phase-carrier-plan.v2'
          && topologyAttestation.phaseCarrierPlanStatus
            === 'phase-lane-capacity-ready'
          && topologyAttestation.sourceParticleCount
            === phaseCarrierOneToFourTransition.sourceParticleCount
          && topologyAttestation.lineageCapacity
            === topologyAttestation.sourceParticleCount
          && topologyAttestation.primaryCapacity
            === topologyAttestation.sourceParticleCount
          && topologyAttestation.phaseLaneCount === 1
          && topologyAttestation.phaseLaneStride
            === topologyAttestation.sourceParticleCount
          && topologyAttestation.companionStart
            === topologyAttestation.sourceParticleCount
          && topologyAttestation.companionCapacity === 0
          && topologyAttestation.particleCapacity
            === topologyAttestation.sourceParticleCount
          && topologyAttestation.phaseCompanionLanesRequired === false
          && topologyAttestation.identityBufferRequired === true
          && topologyAttestation.identityBufferPresent === true
          && topologyAttestation.identitySchema
            === ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
          && topologyAttestation.identitySchema
            === phaseCarrierOneToFourTransition.sourceIdentitySchema
          && topologyAttestation.identityStrideBytes
            === SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT
          && topologyAttestation.identityStrideBytes
            === phaseCarrierOneToFourTransition.sourceIdentityStrideBytes
          && nonEmptyString(topologyAttestation.identityRevision)
          && topologyAttestation.identityRevision
            === phaseCarrierOneToFourTransition.sourceIdentityRevision
          && topologyAttestation.identityBufferByteLength
            === topologyAttestation.sourceParticleCount
              * SPH_GPU_PARTICLE_IDENTITY_UINTS
              * Uint32Array.BYTES_PER_ELEMENT
          && topologyAttestation.identityBufferByteLength
            === phaseCarrierOneToFourTransition
              .sourceIdentityBufferByteLength
          && Number.isSafeInteger(topologyAttestation.identityBufferSize)
          && topologyAttestation.identityBufferSize
            >= topologyAttestation.identityBufferByteLength
          && topologyAttestation.identityStorageUsage === true
          && topologyAttestation.identityDeviceMatched === true
          && topologyAttestation.identityAuthorityComplete === true
          && topologyAttestation.exactFourBufferFamily === true
          && topologyAttestation.exactFourBufferDeviceFamily === true
          && topologyAttestation.planMatchesParticleFamily === true,
        'canonical-phase-carrier-one-to-four-topology-attestation'
      );
    }
    const finalEpochSeal = scheduleResult?.finalEpochSeal ?? null;
    const finalEpochLineage = exactWorkerRouteLineage(finalEpochSeal);
    const mechanicsLevels = finalEpochSeal?.mechanicsLevels;
    requireWorkerRouteReceipt(
      completedCount > 0
        && workerRouteObjectHasExactKeys(
          finalEpochSeal,
          WORKER_FINAL_EPOCH_SEAL_KEYS
        )
        && finalEpochSeal.schema
          === 'peercompute.ulg.worker-schroeder-spatial-epoch-seal.v0'
        && Number.isSafeInteger(finalEpochSeal.generationId)
        && finalEpochSeal.generationId > 0
        && nonEmptyString(finalEpochSeal.deviceId)
        && finalEpochSeal.consumerDeviceId === finalEpochSeal.deviceId
        && Number.isSafeInteger(finalEpochSeal.directoryAbiVersion)
        && finalEpochSeal.directoryAbiVersion > 0
        && Number.isSafeInteger(finalEpochSeal.mechanicsLevelCount)
        && finalEpochSeal.mechanicsLevelCount > 0
        && Array.isArray(mechanicsLevels)
        && mechanicsLevels.length === finalEpochSeal.mechanicsLevelCount
        && mechanicsLevels.every(
          (level) => Number.isSafeInteger(level) && level >= 0
        )
        && new Set(mechanicsLevels).size === mechanicsLevels.length
        && Boolean(finalEpochLineage)
        && execution.canonicalSpatialEpochGenerated === true
        && execution.canonicalSpatialGenerationId
          === finalEpochSeal.generationId
        && execution.finalEpochSealRequired === true
        && workerRouteLineageEquals(
          finalEpochSeal,
          scheduleResult?.finalEpochIdentity
        ),
      'canonical-epoch-seal'
    );
    const canonicalSourceLineage = phaseCarrierOneToFourTransition
      ? phaseCarrierOneToFourTransition.terminalLineage
      : sourceLineage;
    const sourceToSealExact = completedCount === 1
      ? workerRouteLineageEquals(canonicalSourceLineage, finalEpochLineage)
      : canonicalSourceLineage.storageGeneration
          < finalEpochLineage.storageGeneration
        && canonicalSourceLineage.physicsTick < finalEpochLineage.physicsTick
        && canonicalSourceLineage.positionEpoch
          < finalEpochLineage.positionEpoch
        && canonicalSourceLineage.physicsSubstep === 0
        && finalEpochLineage.physicsSubstep === 0
        && canonicalSourceLineage.topologyEpoch
          <= finalEpochLineage.topologyEpoch
        && canonicalSourceLineage.chartEpoch === finalEpochLineage.chartEpoch
        && canonicalSourceLineage.levelEpoch <= finalEpochLineage.levelEpoch
        && canonicalSourceLineage.supportEpoch
          <= finalEpochLineage.supportEpoch;
    requireWorkerRouteReceipt(
      sourceToSealExact
        && targetLineage.storageGeneration
          > finalEpochLineage.storageGeneration
        && targetLineage.physicsTick > finalEpochLineage.physicsTick
        && targetLineage.physicsSubstep === 0
        && targetLineage.positionEpoch > finalEpochLineage.positionEpoch
        && targetLineage.topologyEpoch >= finalEpochLineage.topologyEpoch
        && targetLineage.chartEpoch === finalEpochLineage.chartEpoch
        && targetLineage.levelEpoch >= finalEpochLineage.levelEpoch
        && targetLineage.supportEpoch >= finalEpochLineage.supportEpoch,
      'canonical-lineage-transition'
    );
    requireWorkerRouteReceipt(
      scheduleResult.status === 'worker-resident-schedule-completed'
        ? scheduleResult.cancelled === false
          && completedCount === requestedCount
        : scheduleResult.status === 'worker-resident-schedule-cancelled'
          ? scheduleResult.cancelled === true
            && completedCount < requestedCount
          : false,
      'canonical-status-cancellation'
    );
  }
  const sanitizedReceipt = cloneWorkerRouteReceipt(receipt);
  requireWorkerRouteReceipt(Boolean(sanitizedReceipt), 'clone-safe-receipt');
  return deepFreezeWorkerRouteValue({
    schema: ULG_WORKER_SCHEDULE_EXECUTION_ROUTE_RECEIPT_SCHEMA,
    status: 'worker-schedule-execution-route-receipt-admitted',
    route,
    receipt: sanitizedReceipt,
    activationReceipt: sanitizedReceipt.activationReceipt,
    targetScheduleAuthority: sanitizedReceipt.targetScheduleAuthority,
    predecessorTargetTokenConsumption:
      sanitizedReceipt.predecessorTargetTokenConsumption,
    nextScheduleLawActivationObservation:
      sanitizedReceipt.nextScheduleLawActivationObservation,
    particleCardinality: sanitizedReceipt.particleCardinality,
    sourceLineage: { ...sourceLineage },
    targetLineage: { ...targetLineage },
    retainedBufferRefs: [...retainedBufferRefs]
  });
}

export async function runSchroederWorkerLaneScheduleWithAuthority({
  computeManager,
  stateManager,
  executeSchedule,
  laneId,
  stateKey,
  domainKey = null,
  scheduleId,
  stepCount = 1,
  targetScheduleAuthority = null,
  predecessorTargetScheduleAuthority = null,
  predecessorDynamicLawObservation = null,
  seedUploadBytes = 0,
  seedRequired = false,
  retainedBytes = 0,
  compactSummaryBytes = 0,
  twoLevelTerminalRefluxReceiptRequired = false,
  outputFamilies = ULG_SCHROEDER_WORKER_LANE_WRITE_FAMILIES
} = {}) {
  requireAuthorityManagers(computeManager, stateManager);
  if (typeof executeSchedule !== 'function') {
    throw new TypeError(
      'runSchroederWorkerLaneScheduleWithAuthority requires executeSchedule()'
    );
  }
  const resolvedLaneId = nonEmptyString(laneId);
  const resolvedStateKey = nonEmptyString(stateKey);
  const resolvedScheduleId = nonEmptyString(scheduleId);
  if (!resolvedLaneId || !resolvedStateKey || !resolvedScheduleId) {
    throw new TypeError(
      'Schroeder worker lane authority requires laneId, stateKey, and scheduleId'
    );
  }
  const requestedStepCount = positiveInteger(stepCount, 1);
  const latchedRunTargetScheduleAuthority = targetScheduleAuthority == null
    ? null
    : cloneWorkerRouteReceipt(targetScheduleAuthority);
  const expectedTargetScheduleAuthority = latchedRunTargetScheduleAuthority == null
    ? null
    : exactSchroederTargetScheduleAuthority(latchedRunTargetScheduleAuthority);
  if (
    targetScheduleAuthority != null
    && (
      !expectedTargetScheduleAuthority
      || expectedTargetScheduleAuthority.status
        !== 'target-schedule-authority-ready'
      || expectedTargetScheduleAuthority.sourceScheduleId
        !== resolvedScheduleId
      || expectedTargetScheduleAuthority.laneId !== resolvedLaneId
      || expectedTargetScheduleAuthority.stateKey !== resolvedStateKey
      || expectedTargetScheduleAuthority.motionEnvelope.maxFutureSubsteps
        !== requestedStepCount
    )
  ) {
    throw workerRouteReceiptError('target-schedule-authority-request');
  }
  const latchedPredecessorTargetScheduleAuthority =
    predecessorTargetScheduleAuthority == null
      ? null
      : cloneWorkerRouteReceipt(predecessorTargetScheduleAuthority);
  const latchedPredecessorDynamicLawObservation =
    predecessorDynamicLawObservation == null
      ? null
      : cloneWorkerRouteReceipt(predecessorDynamicLawObservation);
  if (
    (predecessorTargetScheduleAuthority != null
      && latchedPredecessorTargetScheduleAuthority == null)
    || (predecessorDynamicLawObservation != null
      && latchedPredecessorDynamicLawObservation == null)
  ) {
    throw workerRouteReceiptError(
      'predecessor-target-token-outer-authority'
    );
  }
  const predecessorTargetTokenAdmission =
    validateOuterPredecessorTargetToken({
      stateManager,
      currentTargetScheduleAuthority: expectedTargetScheduleAuthority,
      predecessorTargetScheduleAuthority:
        latchedPredecessorTargetScheduleAuthority,
      predecessorDynamicLawObservation:
        latchedPredecessorDynamicLawObservation,
      scheduleId: resolvedScheduleId,
      laneId: resolvedLaneId,
      stateKey: resolvedStateKey
    });
  // The StateManager burn is deliberately durable and has no rollback. Once
  // this exact predecessor token authorizes an execution attempt, worker
  // failure, device loss, outer receipt rejection, or process restart must
  // not make the token available again. Persist before lease acquisition so
  // even the serialized GPU lane cannot observe a check-then-act gap.
  const predecessorTargetTokenStateManagerConsumption =
    persistOuterPredecessorTargetTokenConsumption({
      stateManager,
      admission: predecessorTargetTokenAdmission
    });
  const terminalRefluxCompactSummaryBytes =
    twoLevelTerminalRefluxReceiptRequired === true
      ? requestedStepCount * SCHROEDER_TERMINAL_REFLUX_HEADER_BYTE_LENGTH
      : 0;
  const residentSequenceLaneContract = createSchroederWorkerLaneSequenceContract({
    laneId: resolvedLaneId,
    stateKey: resolvedStateKey,
    domainKey,
    stepCount: requestedStepCount
  });
  const readFamilies = [...ULG_SCHROEDER_WORKER_LANE_READ_FAMILIES];
  const writeFamilies = [...outputFamilies];
  const taskId = `ulg:schroeder-worker-schedule:${resolvedScheduleId}`;
  let lease = null;
  try {
    lease = computeManager.acquireGpuResidentLaneLease({
      laneId: resolvedLaneId,
      stateKey: resolvedStateKey,
      domainKey,
      solverId: 'ulg-mls-mpm-sph-resident-steps',
      taskId,
      owner: 'ulg-schroeder-presentation-worker-resident-schedule',
      sourceFamily: 'worker-retained-schroeder-particle-state',
      readFamilies,
      writeFamilies,
      retainedBufferRefs: [],
      queueFencePolicy: QUEUE_FENCE_POLICY,
      copyBudget: {
        uploadBytes: seedRequired === true
          ? Math.max(0, Math.round(Number(seedUploadBytes) || 0))
          : 0,
        // At most two fixed-size schedule-boundary words are mapped: the
        // dynamic-law watch and the retained product-history live-row bound.
        // Route-execution telemetry remains separate (Tier0 still reports
        // zero hot-loop bytes), while the lease admits their additive maximum.
        readbackBytes: 2 * Uint32Array.BYTES_PER_ELEMENT,
        retainedBytes: Math.max(0, Math.round(Number(retainedBytes) || 0)),
        compactSummaryBytes: Math.max(
          terminalRefluxCompactSummaryBytes,
          Math.max(0, Math.round(Number(compactSummaryBytes) || 0))
        ),
        fullReadbackReason: null
      },
      residentSequenceLaneContract
    });
    const scheduleResult = await executeSchedule({
      lease,
      residentSequenceLaneContract,
      twoLevelTerminalRefluxReceiptRequired:
        twoLevelTerminalRefluxReceiptRequired === true
    });
    const workerFence = workerFenceFromScheduleResult(scheduleResult, {
      scheduleId: resolvedScheduleId,
      laneId: resolvedLaneId,
      stateKey: resolvedStateKey,
      requestedStepCount,
      twoLevelTerminalRefluxReceiptRequired:
        twoLevelTerminalRefluxReceiptRequired === true
    });
    const executionRouteAdmission =
      validateSchroederWorkerScheduleExecutionRouteReceipt(scheduleResult, {
        scheduleId: resolvedScheduleId,
        laneId: resolvedLaneId,
        stateKey: resolvedStateKey,
        requestedStepCount,
        targetScheduleAuthority: expectedTargetScheduleAuthority
      });
    const predecessorTargetTokenConsumption =
      predecessorTargetTokenAdmission == null
        ? null
        : deepFreezeWorkerRouteValue({
            ...predecessorTargetTokenAdmission,
            schema:
              'peercompute.ulg.schroeder-predecessor-target-token-consumption.v2',
            status:
              'predecessor-target-token-consumed-before-schedule-gpu-work',
            workerRouteReceiptMatched: true,
            workerConsumption:
              executionRouteAdmission.predecessorTargetTokenConsumption,
            stateManagerPersistence:
              'consumed-before-lease-acquisition-no-rollback',
            stateManagerConsumption:
              predecessorTargetTokenStateManagerConsumption
          });
    const retainedBufferRefs = Array.isArray(scheduleResult?.retainedBufferRefs)
      ? [...scheduleResult.retainedBufferRefs]
      : [];
    const gpuResidentLaneExecution = computeManager.completeGpuResidentLaneLease(
      lease.leaseId,
      {
        // ComputeManager's completion ABI names the terminal queue state,
        // while the worker fence report names the evidence class
        // (`gpu-fence-satisfied`). Preserve the latter on scheduleResult and
        // normalize only the manager-facing completion envelope.
        status:
          workerFence.queueCompletionStatus
          || 'queue-work-completed',
        method: 'queue.onSubmittedWorkDone',
        queueCompletionStatus:
          workerFence.queueCompletionStatus
          || workerFence.status
          || 'queue-work-completed',
        queueCompletionMethod: 'queue.onSubmittedWorkDone',
        retainedBufferRefs,
        completed: true,
        source: 'offscreen-presentation-worker-resident-schedule'
      }
    );
    lease = null;
    const gpuFence = gpuResidentLaneExecution.gpuFence;
    const completedLease = gpuResidentLaneExecution?.lease || null;
    if (
      completedLease?.status !== 'completed'
      || completedLease?.leaseId == null
      || completedLease?.taskId !== taskId
      || completedLease?.laneId !== resolvedLaneId
      || completedLease?.stateKey !== resolvedStateKey
      || gpuFence?.fenceSatisfied !== true
      || gpuFence?.laneId !== resolvedLaneId
      || gpuFence?.stateKey !== resolvedStateKey
    ) {
      throw new Error(
        'Schroeder worker schedule ComputeManager completion was not exactly attested'
      );
    }
    const computeManagerCompletion = Object.freeze({
      schema: ULG_SCHROEDER_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA,
      status: 'completed',
      taskId,
      leaseId: completedLease.leaseId,
      laneId: resolvedLaneId,
      stateKey: resolvedStateKey,
      fenceSatisfied: true,
      queueCompletionStatus: gpuFence.queueCompletionStatus ?? null,
      queueCompletionMethod: gpuFence.queueCompletionMethod ?? null,
      executionRoute: executionRouteAdmission.route
    });
    const compactExecution = {
      schema: scheduleResult.schema || null,
      status: scheduleResult.status || 'worker-resident-schedule-completed',
      backend: 'webgpu',
      completedStepCount: scheduleResult.completedStepCount ?? 0,
      readbackMode: 'no-full-readback',
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      residentContinuationReady: true,
      gpuAuthoritativeState: true,
      gpuFence,
      executionRouteReceipt: executionRouteAdmission.receipt,
      finalStep: {
        backend: 'webgpu',
        status: scheduleResult.status || 'worker-resident-schedule-completed',
        readbackMode: 'no-full-readback',
        fullParticleReadbackPerformed: false,
        fullParticleReadbackFree: true,
        residentContinuationReady: true,
        gpuAuthoritativeState: true,
        gpuFence
      }
    };
    const commitDelta = createMlsMpmResidentStepsCommitDelta(compactExecution, {
      taskId,
      scope: COMMIT_SCOPE,
      stateKey: resolvedStateKey,
      outputFamilies: writeFamilies,
      gpuResidentLane: {
        laneId: resolvedLaneId,
        stateKey: resolvedStateKey,
        domainKey,
        queueFencePolicy: QUEUE_FENCE_POLICY,
        residentSequenceLaneContract
      },
      residentSequenceLaneContract
    });
    commitDelta.payload.executionRouteReceipt =
      executionRouteAdmission.receipt;
    commitDelta.payload.lawActivationReceipt =
      executionRouteAdmission.activationReceipt;
    commitDelta.payload.targetScheduleAuthority =
      executionRouteAdmission.targetScheduleAuthority;
    commitDelta.payload.nextScheduleLawActivationObservation =
      executionRouteAdmission.nextScheduleLawActivationObservation;
    commitDelta.payload.predecessorTargetTokenAdmission =
      predecessorTargetTokenAdmission;
    commitDelta.payload.predecessorTargetTokenConsumption =
      predecessorTargetTokenConsumption;
    computeManager.commitDelta(commitDelta);
    const stateManagerCommit = readResidentStepsCommittedWarmDelta(stateManager, {
      delta: commitDelta,
      taskId,
      scope: COMMIT_SCOPE
    });
    if (stateManagerCommit.accepted !== true) {
      throw new Error(
        `Schroeder worker schedule StateManager commit was not accepted: ${
          stateManagerCommit.reason || 'missing-commit'
        }`
      );
    }
    if (
      !workerRouteValuesEqual(
        stateManagerCommit.warmEntry?.payload?.executionRouteReceipt,
        executionRouteAdmission.receipt
      )
      || !workerRouteValuesEqual(
        stateManagerCommit.warmEntry?.payload?.lawActivationReceipt,
        executionRouteAdmission.activationReceipt
      )
      || !workerRouteValuesEqual(
        stateManagerCommit.warmEntry?.payload?.targetScheduleAuthority,
        executionRouteAdmission.targetScheduleAuthority
      )
      || !workerRouteValuesEqual(
        stateManagerCommit.warmEntry?.payload
          ?.nextScheduleLawActivationObservation,
        executionRouteAdmission.nextScheduleLawActivationObservation
      )
      || !workerRouteValuesEqual(
        stateManagerCommit.warmEntry?.payload
          ?.predecessorTargetTokenAdmission,
        predecessorTargetTokenAdmission
      )
      || !workerRouteValuesEqual(
        stateManagerCommit.warmEntry?.payload
          ?.predecessorTargetTokenConsumption,
        predecessorTargetTokenConsumption
      )
    ) {
      throw new Error(
        'Schroeder worker schedule StateManager did not persist the exact admitted route authority'
      );
    }
    return {
      schema: ULG_SCHROEDER_WORKER_LANE_AUTHORITY_SCHEMA,
      status: 'state-manager-committed-worker-schedule',
      authority: 'NodeKernel/ComputeManager/StateManager',
      executionOwner: 'offscreen-presentation-worker',
      taskId,
      scheduleId: resolvedScheduleId,
      laneId: resolvedLaneId,
      stateKey: resolvedStateKey,
      scheduleResult,
      twoLevelTerminalRefluxReceiptRequired:
        twoLevelTerminalRefluxReceiptRequired === true,
      terminalRefluxReceipt:
        workerFence.terminalRefluxReceipt ?? null,
      executionRouteAdmission,
      executionRouteReceipt: executionRouteAdmission.receipt,
      predecessorTargetTokenAdmission,
      predecessorTargetTokenStateManagerConsumption,
      predecessorTargetTokenConsumption,
      residentSequenceLaneContract,
      gpuResidentLaneExecution,
      computeManagerCompletion,
      gpuFence,
      commitDelta,
      stateManagerCommit
    };
  } catch (error) {
    if (lease?.leaseId) {
      try {
        computeManager.rejectGpuResidentLaneLease(
          lease.leaseId,
          nonEmptyString(error?.code, 'worker-schedule-failed')
        );
      } catch {
        // Preserve the schedule error; the authority failure is already sealed
        // by the rejected/active lease counters in ComputeManager.
      }
    }
    throw error;
  }
}
