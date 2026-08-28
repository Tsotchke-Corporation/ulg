import {
  createMlsMpmResidentStepsCommitDelta
} from './sphMlsMpmGpuStep.js';
import {
  readResidentStepsCommittedWarmDelta
} from '../peercomputeResidentCommitBridge.js';

export const ULG_SCHROEDER_WORKER_LANE_AUTHORITY_SCHEMA =
  'peercompute.ulg.schroeder-worker-lane-authority.v0';
export const ULG_SCHROEDER_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA =
  'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0';
export const ULG_SCHROEDER_WORKER_LANE_SEQUENCE_CONTRACT_SCHEMA =
  'peercompute.ulg.schroeder-worker-lane-sequence-contract.v0';
export const ULG_WORKER_RESIDENT_SCHEDULE_TERMINAL_REFLUX_RECEIPT_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-terminal-reflux-receipt.v0';
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
const WORKER_RESIDENT_STEP_OPTION_FIELDS = Object.freeze([
  'internalPressureScale',
  'ambientPressurePa',
  'mechanicsSubmitBurstSteps',
  'contactSolverEnabled',
  'consumeCompactMechanicsView',
  'observeCanonicalSpatialAuthority',
  'phaseVolumeMaxImpulseFraction',
  'pressureFeedback',
  'gasPressureSummary',
  'pressureInterfaceGasCellFieldImport',
  'pressureInterfaceGasCellFieldAdmission',
  'contactKinematicsParticleBinMetadataReadback',
  'contactJacobiIterations',
  'contactCleanupPassBudget',
  'contactInnerRounds',
  'contactCleanupProfileReadback',
  'residentGpuTimestampProfilingRequested',
  'reactionParticleBinMetadataReadback',
  // Diagnostic-only fixed-size GPU authority receipts. Keep this explicit:
  // ordinary worker schedules remain readback-free unless the caller opts in.
  'stageMechanicsTraceEnabled',
  'thermalMaterialTable',
  'mechanicsMaterialTable',
  'thermalStepOptions',
  'mechanicsRefreshOptions',
  'reactionTable',
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
  if (!stateManager || (
    typeof stateManager.getWarmDeltas !== 'function'
    && typeof stateManager.readWarm !== 'function'
    && typeof stateManager.getDataState !== 'function'
  )) {
    throw new TypeError(
      'Schroeder worker lane authority requires a readable StateManager warm-delta store'
    );
  }
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

export async function runSchroederWorkerLaneScheduleWithAuthority({
  computeManager,
  stateManager,
  executeSchedule,
  laneId,
  stateKey,
  domainKey = null,
  scheduleId,
  stepCount = 1,
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
        readbackBytes: 0,
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
      queueCompletionMethod: gpuFence.queueCompletionMethod ?? null
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
