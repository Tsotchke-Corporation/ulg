import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

export const MOUNTED_RESIDENT_AUTHORITY_PROBE_SCHEMA =
  'peercompute.ulg.mounted-resident-authority-probe.v0';
export const STRICT_SCHROEDER_AUTHORITY_STAGE_ORDER = Object.freeze([
  'sparse-hierarchy-compaction',
  'fine-sparse-grid-view-build',
  'fine-compact-p2g',
  'coarse-sparse-grid-view-build',
  'coarse-compact-p2g',
  'cross-level-grid-restriction',
  'coarse-pre-update-grid-copy',
  'coarse-compact-grid-update',
  'fine-compact-grid-update-0',
  'cross-level-velocity-delta-transfer-0',
  'fine-compact-g2p-0',
  'coarse-compact-g2p',
  'cross-level-retained-conservation-evidence'
]);

const DEFAULT_BASE_URL = 'https://127.0.0.1:5173/';
const DEFAULT_OUTPUT_PATH = '/tmp/ulg-mounted-resident-authority.json';
const DEFAULT_TIMEOUT_MS = 240_000;
const DEFAULT_TARGET_RESIDENT_SUBMISSION_COUNT = 1;
const DEFAULT_RESIDENT_STEPS_PER_SCHEDULE = 1;

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function finiteNonNegativeInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 0;
}

function positiveSafeInteger(value, fallback = 1) {
  const candidate = Number(value);
  return Number.isSafeInteger(candidate) && candidate > 0 ? candidate : fallback;
}

function compactRecord(source, fields) {
  if (!source || typeof source !== 'object') return null;
  return Object.fromEntries(fields.map((field) => [field, source[field] ?? null]));
}

export function compactMountedResidentFinalStepPerformance(finalStep = null) {
  if (!finalStep || typeof finalStep !== 'object') return null;
  const stageTiming = finalStep.stageTiming || {};
  const fused = finalStep.fusedResidentSequence || {};
  const thermal = finalStep.thermalStep?.result || finalStep.thermalStep || {};
  const reaction = finalStep.reactionStep?.result || finalStep.reactionStep || {};
  const gasCellEos = fused.residentGasCellEos || {};
  const neighborhood = fused.residentNeighborhoodLane
    || stageTiming.residentNeighborhoodLane
    || {};
  const reactive = fused.reactiveResidentSequence || {};
  const hostTiming = stageTiming.hostTiming || fused.hostTiming || null;
  const allocationEvidence = stageTiming.gpuAllocationEvidence
    || fused.gpuAllocationEvidence
    || null;
  const residentSequenceWorkspace = stageTiming.residentSequenceWorkspace
    || fused.residentSequenceWorkspace
    || null;

  return {
    schema: 'peercompute.ulg.mounted-resident-final-step-performance.v0',
    stageTimingTotalMs: stageTiming.totalMs ?? null,
    hostTiming: compactRecord(hostTiming, [
      'schema',
      'workspaceEligible',
      'preWorkspaceSetupMs',
      'workspaceAcquireMs',
      'postWorkspaceSetupMs',
      'commandRecordingMs',
      'queueSubmitCallMs',
      'postSubmitBookkeepingMs',
      'allocationEvidenceMs',
      'postAllocationFinalizeMs',
      'classifiedMs',
      'unclassifiedMs',
      'totalMs'
    ]),
    gpuAllocationEvidence: compactRecord(allocationEvidence, [
      'schema',
      'scope',
      'bufferCount',
      'ownedBufferCount',
      'borrowedBufferCount',
      'createdThisSubmissionBufferCount',
      'persistentWorkspaceBufferCount',
      'transientSubmissionBufferCount',
      'knownByteLengthBufferCount',
      'unknownByteLengthBufferCount',
      'allocatedByteLength',
      'createdThisSubmissionByteLength',
      'persistentWorkspaceByteLength',
      'transientSubmissionByteLength',
      'borrowedByteLength',
      'bufferRowsIncluded',
      'bufferRowsOmittedCount'
    ]),
    residentSequenceWorkspace: compactRecord(residentSequenceWorkspace, [
      'schema',
      'status',
      'deviceId',
      'laneId',
      'stateKey',
      'sourceFamily',
      'layoutKey',
      'workspaceGeneration',
      'pendingSubmissionCount',
      'peakPendingSubmissionCount',
      'maxInFlightSubmissions',
      'totalAcquisitionCount',
      'totalSubmissionCount',
      'totalBackpressureWaitCount',
      'totalWorkspaceCreationCount',
      'totalWorkspaceReuseCount',
      'totalWorkspaceGrowthCount',
      'retiredWorkspaceCount',
      'retiredWorkspaceDestroyCount',
      'totalByteLength',
      'particleFamilyByteLength',
      'gridScratchByteLength',
      'authoritativeBuffersPublished',
      'publicationVersion',
      'acquisitionId',
      'acquisitionStatus',
      'acquisitionSettled',
      'commandEncoderBound',
      'submissionSealed',
      'createdThisAcquisition',
      'reused',
      'grew',
      'waitedForCapacity',
      'authorityRebased',
      'waitedForAuthorityRebase',
      'particleFamilyTransitionCounts',
      'poisoned',
      'poisonReason'
    ]),
    workspaceTelemetry: compactRecord(stageTiming, [
      'thermalWorkspaceSchema',
      'thermalWorkspaceStatus',
      'thermalWorkspaceParticleCapacity',
      'thermalWorkspaceBufferCount',
      'thermalWorkspaceByteLength',
      'thermalWorkspaceReusedSubstepCount',
      'reactionCoreWorkspaceSchema',
      'reactionCoreWorkspaceStatus',
      'reactionCoreWorkspaceParticleCapacity',
      'reactionCoreWorkspaceBufferCount',
      'reactionCoreWorkspaceByteLength',
      'reactionCoreWorkspaceReusedSubstepCount',
      'pressureInterfaceWorkspaceSchema',
      'pressureInterfaceWorkspaceStatus',
      'pressureInterfaceWorkspaceCandidateCapacity',
      'pressureInterfaceWorkspaceBufferCount',
      'pressureInterfaceWorkspaceByteLength',
      'pressureInterfaceWorkspaceReusedSubstepCount',
      'reactionProductEventPlacementWorkspaceStatus',
      'reactionProductEventPlacementWorkspaceCapacityRows',
      'reactionProductEventPlacementWorkspaceBufferCount',
      'reactionProductEventPlacementWorkspaceByteLength',
      'reactionProductEventPlacementWorkspaceReusedSubstepCount'
    ]),
    commandTopology: compactRecord(fused, [
      'dispatchCount',
      'mechanicsDispatchCount',
      'sidecarFusionDispatchCount',
      'sidecarFusionStageCount',
      'residentProductMassProductEventRowCount',
      'residentProductMassScatterDispatchCount'
    ]),
    neighborhoodTelemetry: compactRecord(neighborhood, [
      'status',
      'generationCount',
      'unconditionalExecutedRebuildCount',
      'conditionalGpuDecisionCount',
      'directGenerationCount',
      'directSegmentedMaskedGenerationCount',
      'radixGenerationCount',
      'builderStrategy',
      'encodedDispatchCount',
      'encodedComputePassCount',
      'bindGroupCreationCount',
      'proofOverheadPassCount',
      'encodedCommandProportionalityStatus',
      'pooledLaneReused',
      'laneAcquisitionOrdinal'
    ]),
    reactiveTelemetry: compactRecord(reactive, [
      'status',
      'stepCount',
      'productEventRowsPerSubstep',
      'productEventAppendCount',
      'materialInterfaceProductEventRowCountUpperBounds',
      'materialInterfaceFutureCapacityRowsExcluded',
      'gasCellEosGenerationCount',
      'gasCellEosSkippedEmptyGenerationCount',
      'gasCellEosSourceRowCountUpperBounds',
      'gasCellEosFutureCapacityRowsExcluded',
      'pressureGenerationCount',
      'commandSubmissionCount',
      'normalHotLoopReadbackFree'
    ]),
    gasCellEosTelemetry: compactRecord({
      ...gasCellEos,
      laneCacheStatus: fused.residentGasCellEosLaneCacheStatus,
      sourceRowCount: fused.residentGasCellEosSourceRowCount
        ?? gasCellEos.sourceRowCount,
      sourceCapacity: fused.residentGasCellEosSourceCapacity
        ?? gasCellEos.sourceCapacity
    }, [
      'status',
      'laneCacheStatus',
      'sourceRowCount',
      'sourceCapacity',
      'aggregationStrategy',
      'directSourceLimit',
      'directPrefix',
      'radixBypassed',
      'encodedDispatchCount',
      'encodedComputePassCount',
      'bindGroupCreationCount',
      'bindGroupReuseCount',
      'bindGroupCacheEntryCount',
      'laneBindGroupCreationCount',
      'laneBindGroupReuseCount'
    ]),
    cacheTelemetry: {
      mechanics: {
        entryCount: fused.mechanicsBindGroupCacheEntryCount
          ?? stageTiming.fusedMechanicsBindGroupCacheEntryCount
          ?? null,
        creationCount: fused.mechanicsBindGroupCreationCount
          ?? stageTiming.fusedMechanicsBindGroupCreationCount
          ?? null,
        reuseCount: fused.mechanicsBindGroupReuseCount
          ?? stageTiming.fusedMechanicsBindGroupReuseCount
          ?? null
      },
      thermal: {
        lastBindGroupCacheHit: thermal.thermalBindGroupCacheHit ?? null,
        ...(thermal.thermalBindGroupCacheEvidence || {})
      },
      reaction: {
        lastProposeBindGroupCacheHit: reaction.reactionProposeBindGroupCacheHit ?? null,
        lastResolveBindGroupCacheHit: reaction.reactionResolveBindGroupCacheHit ?? null,
        ...(reaction.reactionBindGroupCacheEvidence || {}),
        productEventParamsSlotIndex: reaction.productEventParamsSlotIndex ?? null,
        productEventParamsByteOffset: reaction.productEventParamsByteOffset ?? null,
        productEventParamsByteStride: reaction.productEventParamsByteStride ?? null,
        productEventBindGroupCacheHits: reaction.productEventBindGroupCacheHits ?? null,
        productEventBindGroupCacheEvidence:
          reaction.productEventBindGroupCacheEvidence ?? null
      },
      gasCellEos: {
        laneCacheStatus: fused.residentGasCellEosLaneCacheStatus ?? null,
        bindGroupCreationCount: gasCellEos.bindGroupCreationCount ?? null,
        bindGroupReuseCount: gasCellEos.bindGroupReuseCount ?? null,
        bindGroupCacheEntryCount: gasCellEos.bindGroupCacheEntryCount ?? null,
        laneBindGroupCreationCount: gasCellEos.laneBindGroupCreationCount ?? null,
        laneBindGroupReuseCount: gasCellEos.laneBindGroupReuseCount ?? null
      }
    }
  };
}

export function compactMountedResidentPerf(perf = null) {
  return compactRecord(perf, [
    'schema',
    'residentSubmissions',
    'residentStepsPerSchedule',
    'lastResidentMs',
    'lastResidentCycleMs',
    'lastResidentPostComputeMs',
    'lastResidentMaterialInterfaceRefreshMs',
    'lastResidentPressureInterfaceRefreshMs',
    'lastResidentInterfaceRefreshMs',
    'lastRenderReadbackMs',
    'residentPresentationBackpressurePending',
    'residentPresentationBackpressureStatus',
    'residentPresentationBackpressureWaitCount',
    'residentPresentationBackpressureDeferredScheduleCount',
    'lastResidentPresentationBackpressureMs',
    'residentPresentationMaxComputeSubmissionsAhead',
    'residentInterfaceRefreshPending',
    'residentRenderRefreshPending'
  ]);
}

export function compactMountedRenderRefreshTrace(trace = []) {
  if (!Array.isArray(trace)) return [];
  return trace.map((event = {}) => compactRecord(event, [
    'status',
    'sequence',
    'activeSequence',
    'pendingSequence',
    'entrySuperseded',
    'supersededBySequence',
    'activeSuperseded',
    'requiredVisible',
    'inheritedRequiredVisible',
    'visibilityObligationTransferred',
    'requestSource',
    'requestReason',
    'requestGeneration',
    'sourceResidentExecutionGeneration',
    'sourceResidentNextStep',
    'physicsSubmissionsAdvancedDuringRefresh',
    'published',
    'reason',
    'elapsedMs'
  ]));
}

export function snapshotMountedBrowserErrors(errors = {}) {
  const cloneEntries = (entries) => (Array.isArray(entries)
    ? entries.map((entry) => (
        entry && typeof entry === 'object' ? { ...entry } : entry
      ))
    : []);
  return {
    console: cloneEntries(errors.console),
    page: cloneEntries(errors.page),
    request: cloneEntries(errors.request),
    http: cloneEntries(errors.http),
    harness: cloneEntries(errors.harness)
  };
}

export function buildMountedResidentAuthorityUrl(baseUrl = DEFAULT_BASE_URL, {
  requireSchroeder = false,
  residentStepsPerSchedule = DEFAULT_RESIDENT_STEPS_PER_SCHEDULE
} = {}) {
  const target = new URL(baseUrl);
  const normalizedResidentStepsPerSchedule = positiveSafeInteger(
    residentStepsPerSchedule,
    DEFAULT_RESIDENT_STEPS_PER_SCHEDULE
  );
  for (const [key, value] of Object.entries({
    mech: 'mlsmpm',
    lawp: '1',
    residentAuto: '1',
    residentStepsPerSchedule: String(normalizedResidentStepsPerSchedule),
    residentComputeManagerMode: 'compute-manager',
    renderer: 'native-webgpu',
    renderOwnership: 'main-thread-renderer',
    surfaceDraw: 'native-webgpu-surface-consumer',
    visualCapture: '1'
  })) {
    target.searchParams.set(key, value);
  }
  if (requireSchroeder) {
    for (const [key, value] of Object.entries({
      ss: '1',
      ssLevel: '0',
      ssTwoLevel: '1',
      schroederTwoLevelAuthority: 'authoritative',
      schroederCrossLevelCoupling: '1',
      lawp: '0',
      lawt: '0',
      lawr: '0',
      schroederActiveNodeIndex: '0',
      schroederActiveNodeSortedIndex: '0',
      schroederLawQueue: '0',
      schroederLawNeighbors: '0',
      schroederLawNeighborCandidates: '0'
    })) {
      target.searchParams.set(key, value);
    }
  }
  return target.toString();
}

export function summarizeMountedScheduleTrace(trace = []) {
  const active = new Set();
  const scheduledTokens = [];
  const publishedTokens = [];
  const scheduleRecords = new Map();
  let duplicateScheduleCount = 0;
  let publishWithoutScheduleCount = 0;
  let maximumInFlight = 0;

  for (const event of Array.isArray(trace) ? trace : []) {
    const token = Number(event?.scheduleToken);
    if (!Number.isInteger(token)) continue;
    if (event.stage === 'scheduled') {
      scheduledTokens.push(token);
      if (!scheduleRecords.has(token)) {
        scheduleRecords.set(token, {
          scheduleToken: token,
          scheduledAtMs: event.atMs ?? null,
          publishedAtMs: null,
          durationMs: null,
          status: event.status ?? null,
          stale: event.stale ?? null,
          requestedStepCount: event.requestedStepCount ?? null,
          continueFromResidentState: event.continueFromResidentState ?? null,
          residentSequenceAuthorityEpoch: event.residentSequenceAuthorityEpoch ?? null
        });
      }
      if (active.has(token)) duplicateScheduleCount += 1;
      active.add(token);
      maximumInFlight = Math.max(maximumInFlight, active.size);
    } else if (event.stage === 'published') {
      publishedTokens.push(token);
      const record = scheduleRecords.get(token);
      if (record) {
        record.publishedAtMs = event.atMs ?? null;
        record.durationMs = record.scheduledAtMs != null
          && record.publishedAtMs != null
          && Number.isFinite(Number(record.scheduledAtMs))
          && Number.isFinite(Number(record.publishedAtMs))
          ? Math.max(0, Number(record.publishedAtMs) - Number(record.scheduledAtMs))
          : null;
        record.status = event.status ?? record.status;
        record.stale = event.stale ?? record.stale;
      }
      if (!active.has(token)) publishWithoutScheduleCount += 1;
      active.delete(token);
    } else {
      const record = scheduleRecords.get(token);
      if (record) {
        record.status = event.status ?? record.status;
        record.stale = event.stale ?? record.stale;
      }
    }
  }

  return {
    scheduledCount: scheduledTokens.length,
    publishedCount: publishedTokens.length,
    scheduledTokens,
    publishedTokens,
    maximumInFlight,
    remainingInFlight: active.size,
    duplicateScheduleCount,
    publishWithoutScheduleCount,
    schedules: [...scheduleRecords.values()]
  };
}

export function evaluateMountedResidentAuthoritySnapshot(snapshot = {}, {
  requireSchroeder = snapshot.requireSchroeder === true,
  targetResidentSubmissionCount = snapshot.probeConfig?.targetResidentSubmissionCount
    ?? DEFAULT_TARGET_RESIDENT_SUBMISSION_COUNT,
  residentStepsPerSchedule = snapshot.probeConfig?.residentStepsPerSchedule
    ?? snapshot.residentPerf?.residentStepsPerSchedule
    ?? DEFAULT_RESIDENT_STEPS_PER_SCHEDULE
} = {}) {
  const expectedResidentSubmissionCount = positiveSafeInteger(
    targetResidentSubmissionCount,
    DEFAULT_TARGET_RESIDENT_SUBMISSION_COUNT
  );
  const expectedResidentStepsPerSchedule = positiveSafeInteger(
    residentStepsPerSchedule,
    DEFAULT_RESIDENT_STEPS_PER_SCHEDULE
  );
  const execution = snapshot.execution || {};
  const task = execution.computeManagerTask || {};
  const commit = execution.stateManagerCommit || {};
  const delta = execution.commitDelta || {};
  const payload = delta.payload || {};
  const identity = payload.pressureSourceFieldConsumptionIdentity || {};
  const lane = execution.residentNeighborhoodLane || {};
  const consumption = execution.materialInterfaceSourceFieldConsumption || {};
  const consumed = identity.consumedNeighborhoodIdentity || {};
  const warm = snapshot.stateManagerWarmEntry || {};
  const surface = snapshot.nativeSurface || {};
  const schroeder = snapshot.schroederEvidence || {};
  const schroederSequence = schroeder.authoritySequence || {};
  const schroederLane = schroederSequence.computeManagerLaneIdentity || {};
  const schroederStages = Array.isArray(schroederSequence.stageList)
    ? schroederSequence.stageList
    : [];
  const schroederStageOrderExact =
    schroederStages.length === STRICT_SCHROEDER_AUTHORITY_STAGE_ORDER.length
    && schroederStages.every(
      (stage, index) => stage === STRICT_SCHROEDER_AUTHORITY_STAGE_ORDER[index]
    );
  const schedule = summarizeMountedScheduleTrace(snapshot.scheduleTrace);
  const residentScheduleSnapshots = Array.isArray(snapshot.residentScheduleSnapshots)
    ? snapshot.residentScheduleSnapshots
    : schedule.schedules.slice(0, expectedResidentSubmissionCount);
  const browserErrors = [
    ...(snapshot.browserErrors?.console || []),
    ...(snapshot.browserErrors?.page || []),
    ...(snapshot.browserErrors?.request || []),
    ...(snapshot.browserErrors?.http || []),
    ...(snapshot.browserErrors?.harness || []),
    ...(snapshot.residentError ? [{ kind: 'resident-runtime', message: snapshot.residentError }] : [])
  ];
  const webGpuErrors = Array.isArray(snapshot.webGpuErrors) ? snapshot.webGpuErrors : [];
  const checks = [];
  const add = (id, pass, evidence = null) => checks.push({ id, pass: pass === true, evidence });

  add('mounted-peercompute-authority',
    snapshot.host?.schema === 'peercompute.ulg.browser-resident-authority-host.v0'
      && snapshot.host?.status === 'ready'
      && snapshot.host?.computeManagerReady === true
      && snapshot.host?.stateManagerReady === true,
    snapshot.host || null);

  add('compute-manager-owned-resident-step',
    snapshot.computeManager?.source === 'peercompute-resident-authority-host'
      && snapshot.computeManager?.submitTask === true
      && snapshot.stateManager?.source === 'peercompute-resident-authority-host'
      && execution.schema === 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0'
      && execution.backend === 'webgpu'
      && execution.residentComputeManagerMode === 'compute-manager'
      && execution.residentComputeManagerActive === true
      && execution.completedStepCount === expectedResidentStepsPerSchedule
      && payload.completedStepCount === expectedResidentStepsPerSchedule
      && task.status === 'state-manager-committed-inline-execution-returned'
      && nonEmptyString(task.acceptedTaskId)
      && nonEmptyString(task.laneId)
      && task.requestedLaneId === 'ulg:sph-resident:demo-auto',
    {
      computeManager: snapshot.computeManager || null,
      stateManager: snapshot.stateManager || null,
      executionSchema: execution.schema ?? null,
      backend: execution.backend ?? null,
      residentComputeManagerMode: execution.residentComputeManagerMode ?? null,
      completedStepCount: execution.completedStepCount ?? null,
      expectedResidentStepsPerSchedule,
      task
    });

  add('single-in-flight-mounted-schedule',
    schedule.scheduledCount === expectedResidentSubmissionCount
      && schedule.publishedCount === expectedResidentSubmissionCount
      && schedule.maximumInFlight === 1
      && schedule.remainingInFlight === 0
      && schedule.duplicateScheduleCount === 0
      && schedule.publishWithoutScheduleCount === 0
      && schedule.scheduledTokens.every(
        (token, index) => token === schedule.publishedTokens[index]
      )
      && residentScheduleSnapshots.length === expectedResidentSubmissionCount
      && residentScheduleSnapshots.every((entry, index) => (
        entry?.scheduleToken === schedule.scheduledTokens[index]
          && entry?.publishedAtMs != null
      ))
      && snapshot.pendingSchedule == null,
    {
      expectedResidentSubmissionCount,
      schedule,
      residentScheduleSnapshots,
      pendingSchedule: snapshot.pendingSchedule ?? null
    });

  add('state-manager-commit-accepted',
    task.stateManagerCommitAccepted === true
      && task.stateManagerCommitStatus === 'committed'
      && commit.accepted === true
      && commit.status === 'committed'
      && commit.gpuFenceSatisfied === true
      && Array.isArray(commit.issues)
      && commit.issues.length === 0
      && commit.taskId === delta.taskId
      && commit.stateKey === payload.stateKey,
    { task, commit });

  add('state-manager-exact-warm-entry',
    warm.found === true
      && warm.taskId === delta.taskId
      && warm.scope === delta.scope
      && warm.version === delta.version
      && warm.payloadSchema === 'peercompute.ulg.mls-mpm-resident-steps-state-delta.v0'
      && warm.payloadStateKey === payload.stateKey
      && warm.payloadCompletedStepCount === payload.completedStepCount
      && warm.payloadBackend === payload.backend
      && warm.payloadReadbackMode === payload.readbackMode
      && warm.payloadResidentSourceMode === payload.residentSourceMode
      && warm.payloadNormalHotLoopReadbackFree === payload.normalHotLoopReadbackFree
      && warm.payloadGpuAuthoritativeState === payload.gpuAuthoritativeState
      && (requireSchroeder || (
        warm.payloadPressureRequestedSourceStep === payload.pressureRequestedSourceStep
        && warm.payloadPressureEpochCount === payload.pressureEpochCount
        && warm.payloadPressureAppliedSubstepCount === payload.pressureAppliedSubstepCount
        && warm.payloadPressureIdentityLaneId === identity.laneId
        && warm.payloadPressureIdentityLeaseId === identity.leaseId
        && warm.payloadPressureIdentityStateKey === identity.stateKey
        && warm.payloadPressureIdentityConsumerLeaseId === identity.consumerLeaseId
      )),
    warm);

  if (!requireSchroeder) {
  add('pressure-state-mutation-admitted',
    payload.pressureSourceFieldRequested === true
      && payload.pressureStateManagerAdmissionApproved === true
      && payload.pressureStateManagerAdmissionStatus === 'pressure-coupling-state-mutation-admitted'
      && Array.isArray(payload.pressureStateManagerAdmissionBlockers)
      && payload.pressureStateManagerAdmissionBlockers.length === 0,
    {
      pressureSourceFieldRequested: payload.pressureSourceFieldRequested ?? null,
      pressureStateManagerAdmissionApproved:
        payload.pressureStateManagerAdmissionApproved ?? null,
      pressureStateManagerAdmissionStatus:
        payload.pressureStateManagerAdmissionStatus ?? null,
      pressureStateManagerAdmissionBlockers:
        payload.pressureStateManagerAdmissionBlockers ?? null
    });

  add('requested-pressure-epochs-and-applied-substeps',
    payload.completedStepCount === expectedResidentStepsPerSchedule
      && payload.pressurePhysicsStepCount === expectedResidentStepsPerSchedule
      && payload.pressureEpochCount === expectedResidentStepsPerSchedule
      && payload.pressureAppliedSubstepCount === expectedResidentStepsPerSchedule
      && identity.physicsStepCount === expectedResidentStepsPerSchedule
      && identity.pressureEpochCount === expectedResidentStepsPerSchedule
      && identity.pressureAppliedSubstepCount === expectedResidentStepsPerSchedule
      && consumption.pressureEpochCount === expectedResidentStepsPerSchedule
      && consumption.pressureAppliedSubstepCount === expectedResidentStepsPerSchedule,
    {
      expectedResidentStepsPerSchedule,
      completedStepCount: payload.completedStepCount ?? null,
      pressurePhysicsStepCount: payload.pressurePhysicsStepCount ?? null,
      pressureEpochCount: payload.pressureEpochCount ?? null,
      pressureAppliedSubstepCount: payload.pressureAppliedSubstepCount ?? null,
      consumedPressureEpochCount: consumption.pressureEpochCount ?? null,
      consumedPressureAppliedSubstepCount:
        consumption.pressureAppliedSubstepCount ?? null
    });

  add('injected-lane-identity-exact',
    nonEmptyString(identity.laneId)
      && identity.laneId === lane.laneId
      && identity.laneId === consumption.consumerLaneId
      && identity.laneId === consumed.laneId
      && identity.laneId === task.laneId
      && identity.laneId === commit.gpuFenceLaneId
      && identity.sourceNeighborhoodLaneId === consumption.sourceNeighborhoodLaneId
      && (
        identity.sourceNeighborhoodLaneId == null
        || identity.sourceNeighborhoodLaneId === identity.laneId
      )
      && identity.consumerLaneTaskId === task.acceptedTaskId
      && identity.consumerLaneAuthoritative === true
      && consumption.consumerLaneTaskId === task.acceptedTaskId
      && consumption.consumerLaneAuthoritative === true
      && consumed.authoritative === true,
    {
      commitLaneId: identity.laneId ?? null,
      commitSourceLaneId: identity.sourceNeighborhoodLaneId ?? null,
      laneEvidenceLaneId: lane.laneId ?? null,
      consumerLaneId: consumption.consumerLaneId ?? null,
      sourceLaneId: consumption.sourceNeighborhoodLaneId ?? null,
      consumedLaneId: consumed.laneId ?? null,
      computeTaskLaneId: task.laneId ?? null,
      gpuFenceLaneId: commit.gpuFenceLaneId ?? null,
      consumerLaneTaskId: consumption.consumerLaneTaskId ?? null,
      acceptedTaskId: task.acceptedTaskId ?? null,
      consumerLaneAuthoritative: consumption.consumerLaneAuthoritative ?? null,
      consumedAuthoritative: consumed.authoritative ?? null
    });

  add('injected-lane-lease-identity-exact',
    nonEmptyString(identity.leaseId)
      && identity.leaseId === lane.leaseId
      && identity.leaseId === consumption.consumerLaneLeaseId
      && identity.leaseId === consumed.leaseId,
    {
      commitLeaseId: identity.leaseId ?? null,
      laneEvidenceLeaseId: lane.leaseId ?? null,
      consumerLaneLeaseId: consumption.consumerLaneLeaseId ?? null,
      consumedLeaseId: consumed.leaseId ?? null
    });

  add('injected-state-identity-exact',
    nonEmptyString(identity.stateKey)
      && identity.stateKey === lane.stateKey
      && identity.stateKey === consumption.consumerStateKey
      && identity.stateKey === consumed.stateKey
      && identity.stateKey === task.stateKey
      && identity.stateKey === payload.stateKey
      && identity.stateKey === commit.stateKey
      && identity.stateKey === commit.gpuFenceStateKey
      && identity.sourceNeighborhoodStateKey === consumption.sourceNeighborhoodStateKey
      && (
        identity.sourceNeighborhoodStateKey == null
        || identity.sourceNeighborhoodStateKey === identity.stateKey
      ),
    {
      commitIdentityStateKey: identity.stateKey ?? null,
      commitSourceStateKey: identity.sourceNeighborhoodStateKey ?? null,
      laneEvidenceStateKey: lane.stateKey ?? null,
      consumerStateKey: consumption.consumerStateKey ?? null,
      sourceStateKey: consumption.sourceNeighborhoodStateKey ?? null,
      consumedStateKey: consumed.stateKey ?? null,
      computeTaskStateKey: task.stateKey ?? null,
      payloadStateKey: payload.stateKey ?? null,
      commitStateKey: commit.stateKey ?? null,
      gpuFenceStateKey: commit.gpuFenceStateKey ?? null
    });

  add('injected-device-identity-exact',
    nonEmptyString(identity.sourceDeviceId)
      && identity.sourceDeviceId === identity.consumerDeviceId
      && identity.sourceDeviceId === consumption.sourceDeviceId
      && identity.consumerDeviceId === consumption.consumerDeviceId
      && identity.consumerDeviceId === consumed.deviceId,
    {
      commitSourceDeviceId: identity.sourceDeviceId ?? null,
      commitConsumerDeviceId: identity.consumerDeviceId ?? null,
      sourceDeviceId: consumption.sourceDeviceId ?? null,
      consumerDeviceId: consumption.consumerDeviceId ?? null,
      consumedDeviceId: consumed.deviceId ?? null
    });

  add('source-consumer-lease-non-null',
    nonEmptyString(identity.consumerLeaseId)
      && identity.consumerLeaseId === consumption.consumerLeaseId
      && nonEmptyString(identity.consumerLeaseStatus)
      && identity.consumerLeaseStatus === consumption.consumerLeaseStatus,
    {
      commitConsumerLeaseId: identity.consumerLeaseId ?? null,
      sourceConsumerLeaseId: consumption.consumerLeaseId ?? null,
      commitConsumerLeaseStatus: identity.consumerLeaseStatus ?? null,
      sourceConsumerLeaseStatus: consumption.consumerLeaseStatus ?? null
    });

  const sourceStep = Number(payload.pressureRequestedSourceStep);
  const expectedEpoch = identity.sourcePositionEpoch;
  add('source-step-epoch-generation-exact',
    finiteNonNegativeInteger(sourceStep)
      && identity.sourceStep === sourceStep
      && consumption.sourceStep === sourceStep
      && identity.sourcePositionEpoch === expectedEpoch
      && identity.sourceNeighborhoodGeneration === expectedEpoch
      && identity.neighborhoodPositionEpochBase === expectedEpoch
      && identity.neighborhoodGenerationBase === expectedEpoch
      && consumption.sourcePositionEpoch === expectedEpoch
      && consumption.sourceNeighborhoodGeneration === expectedEpoch
      && consumed.positionEpoch === expectedEpoch
      && consumed.generation === expectedEpoch
      && lane.positionEpochBase === expectedEpoch
      && lane.generationBase === expectedEpoch,
    {
      pressureRequestedSourceStep: payload.pressureRequestedSourceStep ?? null,
      identitySourceStep: identity.sourceStep ?? null,
      consumedSourceStep: consumption.sourceStep ?? null,
      expectedEpoch,
      identitySourcePositionEpoch: identity.sourcePositionEpoch ?? null,
      identitySourceNeighborhoodGeneration:
        identity.sourceNeighborhoodGeneration ?? null,
      neighborhoodPositionEpochBase: identity.neighborhoodPositionEpochBase ?? null,
      neighborhoodGenerationBase: identity.neighborhoodGenerationBase ?? null,
      consumedPositionEpoch: consumed.positionEpoch ?? null,
      consumedGeneration: consumed.generation ?? null,
      lanePositionEpochBase: lane.positionEpochBase ?? null,
      laneGenerationBase: lane.generationBase ?? null
    });
  } else {
    add('schroeder-authoritative-compute-manager-execution',
      schroeder.executionSchroederSimulation === true
        && schroeder.sameLevelSequenceStatus
          === 'compute-manager-schroeder-resident-steps-executed'
        && schroeder.residentSourceMode === 'compute-manager-gpu-resident-schroeder'
        && schroeder.normalHotLoopReadbackFree === true
        && schroeder.gpuAuthoritativeState === true
        && schroeder.finalStepSchema
          === 'peercompute.ulg.schroeder-two-level-authoritative-step.v0'
        && schroeder.finalStepStatus
          === 'schroeder-two-level-authoritative-step-executed'
        && schroeder.finalStepTwoLevelMechanicsAuthority === 'authoritative'
        && payload.gpuAuthoritativeState === true
        && payload.normalHotLoopReadbackFree === true,
      schroeder);

    add('schroeder-compute-manager-lane-identity-exact',
      schroederSequence.computeManagerLaneIdentityStatus
        === 'actual-compute-manager-lane-identity-bound'
        && schroederLane.ready === true
        && schroederLane.authoritative === true
        && nonEmptyString(schroederLane.leaseId)
        && nonEmptyString(schroederLane.laneId)
        && nonEmptyString(schroederLane.stateKey)
        && nonEmptyString(schroederLane.sourceFamily)
        && nonEmptyString(schroederLane.taskId)
        && schroederLane.laneId === task.laneId
        && schroederLane.laneId === commit.gpuFenceLaneId
        && schroederLane.stateKey === task.stateKey
        && schroederLane.stateKey === payload.stateKey
        && schroederLane.stateKey === commit.stateKey
        && schroederLane.stateKey === commit.gpuFenceStateKey
        && schroederLane.taskId === task.acceptedTaskId,
      {
        sequenceStatus: schroederSequence.computeManagerLaneIdentityStatus ?? null,
        laneIdentity: schroederLane,
        computeManagerTask: task,
        commitLaneId: commit.gpuFenceLaneId ?? null,
        commitStateKey: commit.stateKey ?? null,
        commitFenceStateKey: commit.gpuFenceStateKey ?? null
      });

    add('schroeder-two-level-only',
      schroeder.twoLevelMechanicsSchema
        === 'peercompute.ulg.schroeder-two-level-mechanics-step-execution.v0'
        && schroeder.twoLevelMechanicsStatus
          === 'schroeder-two-level-mechanics-step-submitted'
        && schroeder.twoLevelMechanicsAuthority
          === 'two-level-authoritative-resident-mechanics-replaced'
        && schroeder.twoLevelFineLevel === 0
        && schroeder.twoLevelCoarseLevel === 1
        && schroeder.sparseHierarchyFineLevel === 0
        && schroeder.sparseHierarchyCoarseLevel === 1
        && schroeder.sparseHierarchyLevelCount === 2,
      schroeder);

    add('schroeder-caller-owned-single-submit',
      schroederSequence.schema
        === 'peercompute.ulg.schroeder-two-level-authority-sequence.v0'
        && schroederSequence.status
          === 'schroeder-two-level-authority-sequence-completed'
        && schroederSequence.commandEncoderOwnership === 'caller'
        && schroederSequence.sharedCommandEncoder === true
        && schroederSequence.commandSubmissionCount === 1
        && schroederSequence.stageCount === STRICT_SCHROEDER_AUTHORITY_STAGE_ORDER.length
        && schroederSequence.stageCount === schroederStages.length
        && schroederStageOrderExact
        && schroeder.executionAuthoritySubmissionCount === 1
        && schroederSequence.queueCompletionStatus === 'queue-work-completed'
        && schroederSequence.queueCompletionMethod === 'queue.onSubmittedWorkDone'
        && schroederSequence.queueFenceCompleted === true,
      schroederSequence);

    add('schroeder-sparse-hierarchy-retained',
      schroeder.sparseHierarchyStatus
        === 'schroeder-sparse-two-level-hierarchy-encoded'
        && schroeder.sparseHierarchyCompaction === 'exact-stable-u32-radix-unique-csr'
        && schroeder.sparseHierarchyRetainedCompactNodeBuffer === true
        && schroeder.sparseHierarchyRetainedSourceMembershipBuffers === true
        && schroeder.sparseHierarchyRetainedEvidenceBuffer === true
        && schroeder.sparseHierarchyReadbackMode === 'no-full-readback'
        && schroeder.sparseHierarchyFullParticleReadbackPerformed === false
        && schroederSequence.sparseHierarchyStatus
          === schroeder.sparseHierarchyStatus
        && schroederSequence.sparseHierarchyCompaction
          === schroeder.sparseHierarchyCompaction,
      schroeder);

    add('schroeder-sparse-grid-views',
      schroederSequence.sparseFineGridStatus === 'schroeder-sparse-grid-view-encoded'
        && schroederSequence.sparseCoarseGridStatus
          === 'schroeder-sparse-grid-view-encoded',
      {
        sparseFineGridStatus: schroederSequence.sparseFineGridStatus ?? null,
        sparseCoarseGridStatus: schroederSequence.sparseCoarseGridStatus ?? null
      });

    add('schroeder-compact-p2g-update-g2p',
      schroederSequence.compactP2gStatus === 'fine-and-coarse-compact-p2g-encoded'
        && schroederSequence.compactGridUpdateStatus
          === 'fine-and-coarse-compact-grid-update-encoded'
        && schroederSequence.compactG2pStatus
          === 'fine-and-coarse-compact-g2p-encoded',
      {
        compactP2gStatus: schroederSequence.compactP2gStatus ?? null,
        compactGridUpdateStatus: schroederSequence.compactGridUpdateStatus ?? null,
        compactG2pStatus: schroederSequence.compactG2pStatus ?? null
      });

    add('schroeder-cross-level-retained-evidence',
      schroederSequence.crossLevelTransferStatus
        === 'restriction-and-velocity-delta-prolongation-encoded'
        && schroederSequence.conservationEvidenceStatus
          === 'schroeder-cross-level-grid-conservation-summary-submitted'
        && schroederSequence.conservationEvidenceRetained === true
        && Number(schroederSequence.conservationEvidenceBufferByteLength) > 0,
      {
        crossLevelTransferStatus: schroederSequence.crossLevelTransferStatus ?? null,
        conservationEvidenceStatus:
          schroederSequence.conservationEvidenceStatus ?? null,
        conservationEvidenceRetained:
          schroederSequence.conservationEvidenceRetained ?? null,
        conservationEvidenceBufferByteLength:
          schroederSequence.conservationEvidenceBufferByteLength ?? null
      });

    add('schroeder-normal-path-readback-free',
      schroederSequence.normalPathMapCount === 0
        && schroederSequence.normalPathReadbackBytes === 0
        && schroederSequence.fullReadbackPerformed === false
        && schroederSequence.fullParticleReadbackPerformed === false
        && schroeder.executionNormalPathMapCount === 0
        && schroeder.executionNormalPathReadbackBytes === 0,
      {
        sequenceNormalPathMapCount: schroederSequence.normalPathMapCount ?? null,
        sequenceNormalPathReadbackBytes:
          schroederSequence.normalPathReadbackBytes ?? null,
        executionNormalPathMapCount: schroeder.executionNormalPathMapCount ?? null,
        executionNormalPathReadbackBytes:
          schroeder.executionNormalPathReadbackBytes ?? null,
        fullReadbackPerformed: schroederSequence.fullReadbackPerformed ?? null,
        fullParticleReadbackPerformed:
          schroederSequence.fullParticleReadbackPerformed ?? null
      });

    add('schroeder-third-level-hold',
      schroederSequence.sparseHierarchyThirdLevelHold === true
        && schroeder.sparseHierarchyThirdLevelHold === true
        && schroeder.executionThirdLevelHold === true,
      {
        sequenceThirdLevelHold: schroederSequence.sparseHierarchyThirdLevelHold ?? null,
        sparseHierarchyThirdLevelHold:
          schroeder.sparseHierarchyThirdLevelHold ?? null,
        executionThirdLevelHold: schroeder.executionThirdLevelHold ?? null
      });
  }

  add('scene-native-webgpu-surface-bridge',
    surface.rendererBridge === 'native-webgpu-surface-consumer'
      && surface.nativeWebGpuSurfaceConsumer === true
      && surface.deviceReady === true
      && surface.canvasReady === true
      && surface.drawStateReady === true
      && surface.cameraBufferReady === true
      && surface.failureReason == null
      && !String(surface.source || '').toLowerCase().includes('standalone')
      && !String(surface.source || '').toLowerCase().includes('fallback'),
    surface);

  add('native-surface-extraction-one-submit',
    surface.nativeMarchingCubesExtractionBatchStatus
        === 'native-marching-cubes-multi-surface-batch-submitted'
      && surface.nativeMarchingCubesExtractionBatchMode
        === 'external-command-encoder-one-submit'
      && Number(surface.nativeMarchingCubesExtractionBatchJobCount) >= 1
      && surface.nativeMarchingCubesExtractionBatchSharedCommandEncoder === true
      && surface.nativeMarchingCubesExtractionBatchCallerSubmitCount === 1
      && surface.nativeMarchingCubesExtractionBatchInternalSubmitCount === 0
      && surface.nativeMarchingCubesExtractionBatchCpuSurfaceReadback === false
      && surface.nativeMarchingCubesExtractionBatchPointFallback === false
      && surface.nativeMarchingCubesExtractionBatchTemporaryResourceCount
        === surface.nativeMarchingCubesExtractionBatchRetiredTemporaryResourceCount,
    surface);

  add('zero-browser-errors', browserErrors.length === 0, browserErrors);
  add('zero-webgpu-errors', webGpuErrors.length === 0, webGpuErrors);

  return {
    status: checks.every((check) => check.pass) ? 'passed' : 'failed',
    checkCount: checks.length,
    passedCheckCount: checks.filter((check) => check.pass).length,
    failedCheckIds: checks.filter((check) => !check.pass).map((check) => check.id),
    checks,
    schedule,
    targetResidentSubmissionCount: expectedResidentSubmissionCount,
    residentStepsPerSchedule: expectedResidentStepsPerSchedule,
    profile: requireSchroeder ? 'strict-schroeder' : 'pressure-authority',
    deferredCrossComposition: requireSchroeder
      ? 'priority-5-pressure-thermal-reaction-composition-not-required-by-this-profile'
      : null
  };
}

function chromiumArgs() {
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu'
  ];
}

async function installMountedProbeInstrumentation(page, {
  targetResidentSubmissionCount = DEFAULT_TARGET_RESIDENT_SUBMISSION_COUNT
} = {}) {
  const normalizedTargetResidentSubmissionCount = positiveSafeInteger(
    targetResidentSubmissionCount,
    DEFAULT_TARGET_RESIDENT_SUBMISSION_COUNT
  );
  await page.addInitScript(({ targetResidentSubmissionCount: targetSubmissionCount }) => {
    const attachedDevices = new WeakSet();
    const control = {
      schema: 'peercompute.ulg.mounted-resident-authority-browser-control.v0',
      gpuErrors: [],
      pauseClicks: 0,
      firstScheduledToken: null,
      targetResidentSubmissionCount: targetSubmissionCount,
      scheduleTrace: [],
      observedScheduleEvents: new Set()
    };
    globalThis.__ulgMountedResidentAuthorityProbeControl = control;

    const tick = () => {
      const overlay = document.querySelector('#sph-phase-overlay');
      const scene = overlay?.__sphScene;
      const bridge = scene?.getSphResidentSurfaceDrawRenderBridge?.();
      const device = bridge?.device || null;
      if (device?.addEventListener && !attachedDevices.has(device)) {
        attachedDevices.add(device);
        device.addEventListener('uncapturederror', (event) => {
          control.gpuErrors.push({
            kind: 'uncapturederror',
            message: event.error?.message || String(event.error)
          });
        });
        device.lost?.then((info) => {
          if (info?.reason === 'destroyed') return;
          control.gpuErrors.push({
            kind: 'device-lost',
            reason: info?.reason ?? null,
            message: info?.message ?? null
          });
        });
      }

      for (const event of overlay?.__sphResidentScheduleTrace || []) {
        const key = [event?.scheduleToken, event?.stage, event?.atMs].join(':');
        if (control.observedScheduleEvents.has(key)) continue;
        control.observedScheduleEvents.add(key);
        control.scheduleTrace.push({
          scheduleToken: event?.scheduleToken ?? null,
          stage: event?.stage ?? null,
          atMs: event?.atMs ?? null,
          status: event?.status ?? null,
          stale: event?.stale ?? null,
          requestedStepCount: event?.requestedStepCount ?? null,
          continueFromResidentState: event?.continueFromResidentState ?? null,
          residentSequenceAuthorityEpoch: event?.residentSequenceAuthorityEpoch ?? null,
          renderReason: event?.renderReason ?? null,
          requiredVisible: event?.requiredVisible ?? null,
          presentationBackpressureStatus:
            event?.presentationBackpressure?.status ?? null,
          presentationBackpressureRequired:
            event?.presentationBackpressure?.required ?? null,
          maxComputeSubmissionsAheadOfPresentation:
            event?.presentationBackpressure?.maxComputeSubmissionsAheadOfPresentation
              ?? event?.maxComputeSubmissionsAheadOfPresentation
              ?? null,
          presentationBackpressureWaitMs: event?.waitMs ?? null,
          presentationBackpressureBarrierCount: event?.barrierCount ?? null
        });
      }
      const scheduled = control.scheduleTrace
        .filter((event) => event?.stage === 'scheduled');
      if (scheduled.length > 0 && control.firstScheduledToken == null) {
        control.firstScheduledToken = scheduled[0].scheduleToken ?? null;
      }
      if (scheduled.length >= targetSubmissionCount && control.pauseClicks === 0) {
        const playButton = overlay?.querySelector?.('#sph-play');
        if (playButton && String(playButton.textContent).trim().toLowerCase() === 'pause') {
          playButton.click();
          control.pauseClicks += 1;
        }
      }
    };
    globalThis.__ulgMountedResidentAuthorityProbeTimer = setInterval(tick, 4);
  }, { targetResidentSubmissionCount: normalizedTargetResidentSubmissionCount });
}

async function captureMountedResidentAuthoritySnapshot(page, browserErrors, {
  targetResidentSubmissionCount = DEFAULT_TARGET_RESIDENT_SUBMISSION_COUNT,
  residentStepsPerSchedule = DEFAULT_RESIDENT_STEPS_PER_SCHEDULE
} = {}) {
  const pageSnapshot = await page.evaluate(async () => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene || null;
    const execution = overlay?.__mlsMpmResidentSteps
      || scene?.getMlsMpmResidentSteps?.()
      || null;
    const task = execution?.computeManagerTask || null;
    const commit = execution?.stateManagerCommit || null;
    const delta = execution?.committedStateDelta || execution?.commitDelta || null;
    const payload = delta?.payload || null;
    const identity = payload?.pressureSourceFieldConsumptionIdentity || null;
    const finalStep = execution?.finalStep || null;
    const stageTiming = finalStep?.stageTiming || null;
    const fused = finalStep?.fusedResidentSequence || null;
    const thermalResult = finalStep?.thermalStep?.result || finalStep?.thermalStep || null;
    const reactionResult = finalStep?.reactionStep?.result || finalStep?.reactionStep || null;
    let productEventArenaDiagnostic = null;
    const productEventArena = finalStep?.residentProductMass?.productEventArena
      || fused?.residentProductMass?.productEventArena
      || null;
    if (productEventArena?.device) {
      try {
        const arenaModule = await import(
          '/src/runtime/sph/residentProductEventArenaGpu.js'
        );
        productEventArenaDiagnostic = await arenaModule
          .mapResidentProductEventArenaMetadataDiagnostic(
            productEventArena.device,
            productEventArena
          );
      } catch (error) {
        productEventArenaDiagnostic = {
          status: 'resident-product-event-arena-post-run-diagnostic-failed',
          reason: error instanceof Error ? error.message : String(error)
        };
      }
    }
    const safeCacheEvidence = (workspace) => {
      try {
        return typeof workspace?.bindGroupCacheEvidence === 'function'
          ? { ...workspace.bindGroupCacheEvidence() }
          : null;
      } catch {
        return null;
      }
    };
    const thermalBindGroupCacheEvidence = safeCacheEvidence(
      thermalResult?.thermalWorkspace || finalStep?.thermalStep?.thermalWorkspace
    );
    const reactionBindGroupCacheEvidence = safeCacheEvidence(
      reactionResult?.reactionCoreWorkspace || finalStep?.reactionStep?.reactionCoreWorkspace
    );
    const consumption = finalStep?.materialInterfaceSourceFieldConsumption
      || fused?.materialInterfaceSourceFieldConsumption
      || execution?.materialInterfaceSourceFieldConsumption
      || null;
    const lane = fused?.residentNeighborhoodLane
      || finalStep?.stageTiming?.residentNeighborhoodLane
      || null;
    const schroederMechanics = execution?.schroederSameLevelMechanics
      || finalStep?.schroederSameLevelMechanics
      || null;
    const schroederTwoLevelMechanics = schroederMechanics?.twoLevelMechanics || null;
    const schroederSparseHierarchy = schroederMechanics?.sparseHierarchy
      || finalStep?.schroederSparseHierarchy
      || null;
    const schroederAuthoritySequence = execution?.schroederTwoLevelAuthoritySequence
      || finalStep?.schroederTwoLevelAuthoritySequence
      || schroederTwoLevelMechanics?.authoritySequence
      || null;
    const host = scene?.getResidentAuthorityHost?.()
      || globalThis.__ulgResidentAuthorityHost
      || null;
    const stateManager = host?.getStateManager?.() || host?.stateManager || null;
    const warmDeltas = delta?.scope && stateManager?.getWarmDeltas
      ? stateManager.getWarmDeltas(delta.scope)
      : null;
    const warmEntry = delta?.taskId && warmDeltas
      ? warmDeltas[delta.taskId] || null
      : null;
    const warmPayload = warmEntry?.payload || null;
    const warmIdentity = warmPayload?.pressureSourceFieldConsumptionIdentity || null;
    const bridge = scene?.getSphResidentSurfaceDrawRenderBridge?.() || null;
    const bridgeFailureReason = bridge?.failureReason
      ?? bridge?.nativeSurfaceFailureReason
      ?? bridge?.nativeWebGpuSurfaceConsumerFailureReason
      ?? null;
    const renderState = scene?.getSphResidentRenderState?.() || null;
    const immutablePipelineCache =
      scene?.scene?.userData?.sphWebGpuImmutablePipelineCache || null;
    const control = globalThis.__ulgMountedResidentAuthorityProbeControl || null;
    const pick = (source, fields) => source && typeof source === 'object'
      ? Object.fromEntries(fields.map((field) => [field, source[field] ?? null]))
      : null;
    const finalStepPerformanceSource = finalStep ? {
      stageTiming: stageTiming ? {
        totalMs: stageTiming.totalMs ?? null,
        hostTiming: pick(stageTiming.hostTiming, [
          'schema',
          'workspaceEligible',
          'preWorkspaceSetupMs',
          'workspaceAcquireMs',
          'postWorkspaceSetupMs',
          'commandRecordingMs',
          'queueSubmitCallMs',
          'postSubmitBookkeepingMs',
          'allocationEvidenceMs',
          'postAllocationFinalizeMs',
          'classifiedMs',
          'unclassifiedMs',
          'totalMs'
        ]),
        gpuAllocationEvidence: pick(stageTiming.gpuAllocationEvidence, [
          'schema',
          'scope',
          'bufferCount',
          'ownedBufferCount',
          'borrowedBufferCount',
          'createdThisSubmissionBufferCount',
          'persistentWorkspaceBufferCount',
          'transientSubmissionBufferCount',
          'knownByteLengthBufferCount',
          'unknownByteLengthBufferCount',
          'allocatedByteLength',
          'createdThisSubmissionByteLength',
          'persistentWorkspaceByteLength',
          'transientSubmissionByteLength',
          'borrowedByteLength',
          'bufferRowsIncluded',
          'bufferRowsOmittedCount'
        ]),
        residentSequenceWorkspace: pick(stageTiming.residentSequenceWorkspace, [
          'schema',
          'status',
          'deviceId',
          'laneId',
          'stateKey',
          'sourceFamily',
          'layoutKey',
          'workspaceGeneration',
          'pendingSubmissionCount',
          'peakPendingSubmissionCount',
          'maxInFlightSubmissions',
          'totalAcquisitionCount',
          'totalSubmissionCount',
          'totalBackpressureWaitCount',
          'totalWorkspaceCreationCount',
          'totalWorkspaceReuseCount',
          'totalWorkspaceGrowthCount',
          'retiredWorkspaceCount',
          'retiredWorkspaceDestroyCount',
          'totalByteLength',
          'particleFamilyByteLength',
          'gridScratchByteLength',
          'authoritativeBuffersPublished',
          'publicationVersion',
          'acquisitionId',
          'acquisitionStatus',
          'acquisitionSettled',
          'commandEncoderBound',
          'submissionSealed',
          'createdThisAcquisition',
          'reused',
          'grew',
          'waitedForCapacity',
          'authorityRebased',
          'waitedForAuthorityRebase',
          'particleFamilyTransitionCounts',
          'poisoned',
          'poisonReason'
        ]),
        ...pick(stageTiming, [
          'thermalWorkspaceSchema',
          'thermalWorkspaceStatus',
          'thermalWorkspaceParticleCapacity',
          'thermalWorkspaceBufferCount',
          'thermalWorkspaceByteLength',
          'thermalWorkspaceReusedSubstepCount',
          'reactionCoreWorkspaceSchema',
          'reactionCoreWorkspaceStatus',
          'reactionCoreWorkspaceParticleCapacity',
          'reactionCoreWorkspaceBufferCount',
          'reactionCoreWorkspaceByteLength',
          'reactionCoreWorkspaceReusedSubstepCount',
          'pressureInterfaceWorkspaceSchema',
          'pressureInterfaceWorkspaceStatus',
          'pressureInterfaceWorkspaceCandidateCapacity',
          'pressureInterfaceWorkspaceBufferCount',
          'pressureInterfaceWorkspaceByteLength',
          'pressureInterfaceWorkspaceReusedSubstepCount',
          'reactionProductEventPlacementWorkspaceStatus',
          'reactionProductEventPlacementWorkspaceCapacityRows',
          'reactionProductEventPlacementWorkspaceBufferCount',
          'reactionProductEventPlacementWorkspaceByteLength',
          'reactionProductEventPlacementWorkspaceReusedSubstepCount',
          'fusedMechanicsBindGroupCacheEntryCount',
          'fusedMechanicsBindGroupCreationCount',
          'fusedMechanicsBindGroupReuseCount'
        ])
      } : null,
      fusedResidentSequence: fused ? {
        hostTiming: pick(fused.hostTiming, [
          'schema',
          'workspaceEligible',
          'preWorkspaceSetupMs',
          'workspaceAcquireMs',
          'postWorkspaceSetupMs',
          'commandRecordingMs',
          'queueSubmitCallMs',
          'postSubmitBookkeepingMs',
          'allocationEvidenceMs',
          'postAllocationFinalizeMs',
          'classifiedMs',
          'unclassifiedMs',
          'totalMs'
        ]),
        gpuAllocationEvidence: pick(fused.gpuAllocationEvidence, [
          'schema',
          'scope',
          'bufferCount',
          'ownedBufferCount',
          'borrowedBufferCount',
          'createdThisSubmissionBufferCount',
          'persistentWorkspaceBufferCount',
          'transientSubmissionBufferCount',
          'knownByteLengthBufferCount',
          'unknownByteLengthBufferCount',
          'allocatedByteLength',
          'createdThisSubmissionByteLength',
          'persistentWorkspaceByteLength',
          'transientSubmissionByteLength',
          'borrowedByteLength',
          'bufferRowsIncluded',
          'bufferRowsOmittedCount'
        ]),
        residentSequenceWorkspace: pick(fused.residentSequenceWorkspace, [
          'schema',
          'status',
          'workspaceGeneration',
          'totalAcquisitionCount',
          'totalSubmissionCount',
          'totalWorkspaceCreationCount',
          'totalWorkspaceReuseCount',
          'createdThisAcquisition',
          'reused',
          'totalByteLength'
        ]),
        mechanicsBindGroupCacheEntryCount:
          fused.mechanicsBindGroupCacheEntryCount ?? null,
        mechanicsBindGroupCreationCount: fused.mechanicsBindGroupCreationCount ?? null,
        mechanicsBindGroupReuseCount: fused.mechanicsBindGroupReuseCount ?? null,
        residentGasCellEosLaneCacheStatus: fused.residentGasCellEosLaneCacheStatus ?? null,
        residentGasCellEos: fused.residentGasCellEos ? pick(fused.residentGasCellEos, [
          'status',
          'sourceRowCount',
          'sourceCapacity',
          'aggregationStrategy',
          'directSourceLimit',
          'directPrefix',
          'radixBypassed',
          'encodedDispatchCount',
          'encodedComputePassCount',
          'bindGroupCreationCount',
          'bindGroupReuseCount',
          'bindGroupCacheEntryCount',
          'laneBindGroupCreationCount',
          'laneBindGroupReuseCount'
        ]) : null,
        residentGasCellEosSourceRowCount:
          fused.residentGasCellEosSourceRowCount ?? null,
        residentGasCellEosSourceCapacity:
          fused.residentGasCellEosSourceCapacity ?? null,
        ...pick(fused, [
          'dispatchCount',
          'mechanicsDispatchCount',
          'sidecarFusionDispatchCount',
          'sidecarFusionStageCount',
          'residentProductMassProductEventRowCount',
          'residentProductMassScatterDispatchCount'
        ]),
        residentNeighborhoodLane: pick(fused.residentNeighborhoodLane, [
          'status',
          'generationCount',
          'unconditionalExecutedRebuildCount',
          'conditionalGpuDecisionCount',
          'directGenerationCount',
          'directSegmentedMaskedGenerationCount',
          'radixGenerationCount',
          'builderStrategy',
          'encodedDispatchCount',
          'encodedComputePassCount',
          'bindGroupCreationCount',
          'proofOverheadPassCount',
          'encodedCommandProportionalityStatus',
          'pooledLaneReused',
          'laneAcquisitionOrdinal'
        ]),
        reactiveResidentSequence: pick(fused.reactiveResidentSequence, [
          'status',
          'stepCount',
          'productEventRowsPerSubstep',
          'productEventAppendCount',
          'materialInterfaceProductEventRowCountUpperBounds',
          'materialInterfaceFutureCapacityRowsExcluded',
          'gasCellEosGenerationCount',
          'gasCellEosSkippedEmptyGenerationCount',
          'gasCellEosSourceRowCountUpperBounds',
          'gasCellEosFutureCapacityRowsExcluded',
          'pressureGenerationCount',
          'commandSubmissionCount',
          'normalHotLoopReadbackFree'
        ])
      } : null,
      thermalStep: thermalResult ? {
        result: {
          thermalBindGroupCacheHit: thermalResult.thermalBindGroupCacheHit ?? null,
          thermalBindGroupCacheEvidence
        }
      } : null,
      reactionStep: reactionResult ? {
        result: {
          reactionProposeBindGroupCacheHit:
            reactionResult.reactionProposeBindGroupCacheHit ?? null,
          reactionResolveBindGroupCacheHit:
            reactionResult.reactionResolveBindGroupCacheHit ?? null,
          reactionBindGroupCacheEvidence,
          productEventParamsSlotIndex:
            reactionResult.productEventParamsSlotIndex ?? null,
          productEventParamsByteOffset:
            reactionResult.productEventParamsByteOffset ?? null,
          productEventParamsByteStride:
            reactionResult.productEventParamsByteStride ?? null,
          productEventBindGroupCacheHits:
            reactionResult.productEventBindGroupCacheHits ?? null,
          productEventBindGroupCacheEvidence:
            reactionResult.productEventBindGroupCacheEvidence ?? null
        }
      } : null
    } : null;

    return {
      location: globalThis.location.href,
      host: overlay?.__sphPeerComputeResidentAuthorityHost || null,
      computeManager: overlay?.__sphResidentComputeManager || null,
      stateManager: overlay?.__sphResidentStateManager || null,
      execution: execution ? {
        schema: execution.schema ?? null,
        status: execution.status ?? null,
        backend: execution.backend ?? null,
        schroederSimulation: execution.schroederSimulation === true,
        schroederSameLevelSequenceStatus:
          execution.schroederSameLevelSequenceStatus ?? null,
        residentSourceMode: execution.residentSourceMode ?? null,
        normalHotLoopReadbackFree: execution.normalHotLoopReadbackFree === true,
        gpuAuthoritativeState: execution.gpuAuthoritativeState === true,
        residentComputeManagerMode: execution.residentComputeManagerMode ?? null,
        residentComputeManagerActive: execution.residentComputeManagerActive === true,
        completedStepCount: execution.completedStepCount ?? null,
        computeManagerTask: task ? {
          schema: task.schema ?? null,
          status: task.status ?? null,
          laneId: task.laneId ?? null,
          requestedLaneId: task.requestedLaneId ?? null,
          stateKey: task.stateKey ?? null,
          acceptedTaskId: task.acceptedTaskId ?? null,
          stateManagerCommitAccepted: task.stateManagerCommitAccepted ?? null,
          stateManagerCommitStatus: task.stateManagerCommitStatus ?? null,
          stateManagerCommitReason: task.stateManagerCommitReason ?? null
        } : null,
        stateManagerCommit: commit ? {
          schema: commit.schema ?? null,
          accepted: commit.accepted === true,
          status: commit.status ?? null,
          reason: commit.reason ?? null,
          issues: Array.isArray(commit.issues) ? [...commit.issues] : [],
          taskId: commit.taskId ?? null,
          scope: commit.scope ?? null,
          stateKey: commit.stateKey ?? null,
          completedStepCount: commit.completedStepCount ?? null,
          gpuFenceSatisfied: commit.gpuFenceSatisfied === true,
          gpuFenceStatus: commit.gpuFenceStatus ?? null,
          gpuFenceLaneId: commit.gpuFenceLaneId ?? null,
          gpuFenceStateKey: commit.gpuFenceStateKey ?? null,
          pressureSourceFieldRequested: commit.pressureSourceFieldRequested ?? null,
          pressureRequestedSourceStep: commit.pressureRequestedSourceStep ?? null,
          pressureEpochCount: commit.pressureEpochCount ?? null,
          pressureAppliedSubstepCount: commit.pressureAppliedSubstepCount ?? null,
          pressureStateManagerAdmissionApproved:
            commit.pressureStateManagerAdmissionApproved ?? null,
          pressureStateManagerAdmissionStatus:
            commit.pressureStateManagerAdmissionStatus ?? null,
          pressureStateManagerAdmissionBlockers:
            commit.pressureStateManagerAdmissionBlockers ?? null
        } : null,
        commitDelta: delta ? {
          schema: delta.schema ?? null,
          taskId: delta.taskId ?? null,
          scope: delta.scope ?? null,
          version: delta.version ?? null,
          payload: payload ? {
            schema: payload.schema ?? null,
            status: payload.status ?? null,
            stateKey: payload.stateKey ?? null,
            backend: payload.backend ?? null,
            readbackMode: payload.readbackMode ?? null,
            residentSourceMode: payload.residentSourceMode ?? null,
            normalHotLoopReadbackFree: payload.normalHotLoopReadbackFree === true,
            gpuAuthoritativeState: payload.gpuAuthoritativeState === true,
            completedStepCount: payload.completedStepCount ?? null,
            pressureSourceFieldRequested: payload.pressureSourceFieldRequested ?? null,
            pressureRequestedSourceStep: payload.pressureRequestedSourceStep ?? null,
            pressureEpochCount: payload.pressureEpochCount ?? null,
            pressureAppliedSubstepCount: payload.pressureAppliedSubstepCount ?? null,
            pressurePhysicsStepCount: payload.pressurePhysicsStepCount ?? null,
            pressureStateManagerAdmissionApproved:
              payload.pressureStateManagerAdmissionApproved ?? null,
            pressureStateManagerAdmissionStatus:
              payload.pressureStateManagerAdmissionStatus ?? null,
            pressureStateManagerAdmissionBlockers:
              Array.isArray(payload.pressureStateManagerAdmissionBlockers)
                ? [...payload.pressureStateManagerAdmissionBlockers]
                : [],
            pressureSourceFieldConsumptionIdentity: identity ? {
              status: identity.status ?? null,
              sourceStep: identity.sourceStep ?? null,
              sourcePositionEpoch: identity.sourcePositionEpoch ?? null,
              sourceNeighborhoodGeneration: identity.sourceNeighborhoodGeneration ?? null,
              sourceNeighborhoodLaneId: identity.sourceNeighborhoodLaneId ?? null,
              sourceNeighborhoodStateKey: identity.sourceNeighborhoodStateKey ?? null,
              sourceDeviceId: identity.sourceDeviceId ?? null,
              consumerDeviceId: identity.consumerDeviceId ?? null,
              pressureEpochCount: identity.pressureEpochCount ?? null,
              pressureAppliedSubstepCount: identity.pressureAppliedSubstepCount ?? null,
              physicsStepCount: identity.physicsStepCount ?? null,
              laneId: identity.laneId ?? null,
              stateKey: identity.stateKey ?? null,
              leaseId: identity.leaseId ?? null,
              consumerLaneTaskId: identity.consumerLaneTaskId ?? null,
              consumerLaneAuthoritative: identity.consumerLaneAuthoritative ?? null,
              consumerLeaseId: identity.consumerLeaseId ?? null,
              consumerLeaseStatus: identity.consumerLeaseStatus ?? null,
              neighborhoodGenerationBase: identity.neighborhoodGenerationBase ?? null,
              neighborhoodPositionEpochBase: identity.neighborhoodPositionEpochBase ?? null,
              neighborhoodGenerationCount: identity.neighborhoodGenerationCount ?? null,
              queueCompletionStatus: identity.queueCompletionStatus ?? null,
              queueCompletionMethod: identity.queueCompletionMethod ?? null,
              consumedNeighborhoodIdentity: identity.consumedNeighborhoodIdentity
                ? { ...identity.consumedNeighborhoodIdentity }
                : null
            } : null
          } : null
        } : null,
        residentNeighborhoodLane: lane ? {
          schema: lane.schema ?? null,
          status: lane.status ?? null,
          laneId: lane.laneId ?? null,
          stateKey: lane.stateKey ?? null,
          leaseId: lane.leaseId ?? null,
          sourceFamily: lane.sourceFamily ?? null,
          authoritative: lane.authoritative ?? null,
          singleFlight: lane.singleFlight ?? null,
          generationBase: lane.generationBase ?? null,
          positionEpochBase: lane.positionEpochBase ?? null,
          generationCount: lane.generationCount ?? null,
          initialGenerationEncodedBeforeFirstP2g:
            lane.initialGenerationEncodedBeforeFirstP2g ?? null
        } : null,
        materialInterfaceSourceFieldConsumption: consumption ? {
          status: consumption.status ?? null,
          sourceStep: consumption.sourceStep ?? null,
          sourcePositionEpoch: consumption.sourcePositionEpoch ?? null,
          sourceNeighborhoodGeneration: consumption.sourceNeighborhoodGeneration ?? null,
          sourceNeighborhoodLaneId: consumption.sourceNeighborhoodLaneId ?? null,
          sourceNeighborhoodStateKey: consumption.sourceNeighborhoodStateKey ?? null,
          sourceDeviceId: consumption.sourceDeviceId ?? null,
          consumerDeviceId: consumption.consumerDeviceId ?? null,
          consumerLaneId: consumption.consumerLaneId ?? null,
          consumerStateKey: consumption.consumerStateKey ?? null,
          consumerLaneLeaseId: consumption.consumerLaneLeaseId ?? null,
          consumerLaneTaskId: consumption.consumerLaneTaskId ?? null,
          consumerLaneAuthoritative: consumption.consumerLaneAuthoritative ?? null,
          consumerLeaseId: consumption.consumerLeaseId ?? null,
          consumerLeaseStatus: consumption.consumerLeaseStatus ?? null,
          pressureEpochCount: consumption.pressureEpochCount ?? null,
          pressureAppliedSubstepCount: consumption.pressureAppliedSubstepCount ?? null,
          physicsStepCount: consumption.physicsStepCount ?? null,
          queueCompletionStatus: consumption.queueCompletionStatus ?? null,
          queueCompletionMethod: consumption.queueCompletionMethod ?? null,
          consumedNeighborhoodIdentity: consumption.consumedNeighborhoodIdentity
            ? { ...consumption.consumedNeighborhoodIdentity }
            : null
        } : null
      } : null,
      stateManagerWarmEntry: {
        found: Boolean(warmEntry),
        taskId: delta?.taskId ?? null,
        scope: delta?.scope ?? null,
        version: warmEntry?.version ?? null,
        timestamp: warmEntry?.ts ?? null,
        payloadSchema: warmPayload?.schema ?? null,
        payloadStateKey: warmPayload?.stateKey ?? null,
        payloadCompletedStepCount: warmPayload?.completedStepCount ?? null,
        payloadBackend: warmPayload?.backend ?? null,
        payloadReadbackMode: warmPayload?.readbackMode ?? null,
        payloadResidentSourceMode: warmPayload?.residentSourceMode ?? null,
        payloadNormalHotLoopReadbackFree:
          warmPayload?.normalHotLoopReadbackFree === true,
        payloadGpuAuthoritativeState: warmPayload?.gpuAuthoritativeState === true,
        payloadPressureRequestedSourceStep:
          warmPayload?.pressureRequestedSourceStep ?? null,
        payloadPressureEpochCount: warmPayload?.pressureEpochCount ?? null,
        payloadPressureAppliedSubstepCount:
          warmPayload?.pressureAppliedSubstepCount ?? null,
        payloadPressureIdentityLaneId: warmIdentity?.laneId ?? null,
        payloadPressureIdentityLeaseId: warmIdentity?.leaseId ?? null,
        payloadPressureIdentityStateKey: warmIdentity?.stateKey ?? null,
        payloadPressureIdentityConsumerLeaseId: warmIdentity?.consumerLeaseId ?? null
      },
      schroederEvidence: {
        executionSchroederSimulation: execution?.schroederSimulation === true,
        sameLevelSequenceStatus: execution?.schroederSameLevelSequenceStatus ?? null,
        residentSourceMode: execution?.residentSourceMode ?? null,
        normalHotLoopReadbackFree: execution?.normalHotLoopReadbackFree === true,
        gpuAuthoritativeState: execution?.gpuAuthoritativeState === true,
        finalStepSchema: finalStep?.schema ?? null,
        finalStepStatus: finalStep?.status ?? null,
        finalStepTwoLevelMechanicsAuthority:
          finalStep?.twoLevelMechanicsAuthority ?? null,
        twoLevelMechanicsSchema: schroederTwoLevelMechanics?.schema ?? null,
        twoLevelMechanicsStatus: schroederTwoLevelMechanics?.status ?? null,
        twoLevelMechanicsAuthority: schroederTwoLevelMechanics?.authority ?? null,
        twoLevelFineLevel: schroederTwoLevelMechanics?.fineLevel ?? null,
        twoLevelCoarseLevel: schroederTwoLevelMechanics?.coarseLevel ?? null,
        sparseHierarchyStatus: schroederSparseHierarchy?.status ?? null,
        sparseHierarchyCompaction: schroederSparseHierarchy?.compaction ?? null,
        sparseHierarchyFineLevel: schroederSparseHierarchy?.fineLevel ?? null,
        sparseHierarchyCoarseLevel: schroederSparseHierarchy?.coarseLevel ?? null,
        sparseHierarchyLevelCount: schroederSparseHierarchy?.levelCount ?? null,
        sparseHierarchyThirdLevelHold:
          schroederSparseHierarchy?.thirdLevelHold === true,
        sparseHierarchyRetainedCompactNodeBuffer:
          schroederSparseHierarchy?.retainedCompactNodeBuffer === true,
        sparseHierarchyRetainedSourceMembershipBuffers:
          schroederSparseHierarchy?.retainedSourceMembershipBuffers === true,
        sparseHierarchyRetainedEvidenceBuffer:
          schroederSparseHierarchy?.retainedEvidenceBuffer === true,
        sparseHierarchyReadbackMode: schroederSparseHierarchy?.readbackMode ?? null,
        sparseHierarchyFullParticleReadbackPerformed:
          schroederSparseHierarchy?.fullParticleReadbackPerformed ?? null,
        executionAuthoritySubmissionCount:
          execution?.schroederTwoLevelAuthoritySubmissionCount ?? null,
        executionNormalPathMapCount: execution?.schroederNormalPathMapCount ?? null,
        executionNormalPathReadbackBytes:
          execution?.schroederNormalPathReadbackBytes ?? null,
        executionThirdLevelHold: execution?.schroederThirdLevelHold === true,
        authoritySequence: schroederAuthoritySequence ? {
          schema: schroederAuthoritySequence.schema ?? null,
          status: schroederAuthoritySequence.status ?? null,
          commandEncoderOwnership:
            schroederAuthoritySequence.commandEncoderOwnership ?? null,
          sharedCommandEncoder: schroederAuthoritySequence.sharedCommandEncoder === true,
          commandSubmissionCount:
            schroederAuthoritySequence.commandSubmissionCount ?? null,
          stageList: Array.isArray(schroederAuthoritySequence.stageList)
            ? [...schroederAuthoritySequence.stageList]
            : [],
          stageCount: schroederAuthoritySequence.stageCount ?? null,
          sparseHierarchyStatus:
            schroederAuthoritySequence.sparseHierarchyStatus ?? null,
          sparseHierarchyCompaction:
            schroederAuthoritySequence.sparseHierarchyCompaction ?? null,
          sparseHierarchyThirdLevelHold:
            schroederAuthoritySequence.sparseHierarchyThirdLevelHold === true,
          sparseFineGridStatus:
            schroederAuthoritySequence.sparseFineGridStatus ?? null,
          sparseCoarseGridStatus:
            schroederAuthoritySequence.sparseCoarseGridStatus ?? null,
          compactP2gStatus: schroederAuthoritySequence.compactP2gStatus ?? null,
          compactGridUpdateStatus:
            schroederAuthoritySequence.compactGridUpdateStatus ?? null,
          compactG2pStatus: schroederAuthoritySequence.compactG2pStatus ?? null,
          crossLevelTransferStatus:
            schroederAuthoritySequence.crossLevelTransferStatus ?? null,
          conservationEvidenceStatus:
            schroederAuthoritySequence.conservationEvidenceStatus ?? null,
          conservationEvidenceRetained:
            schroederAuthoritySequence.conservationEvidenceRetained === true,
          conservationEvidenceBufferByteLength:
            schroederAuthoritySequence.conservationEvidenceBufferByteLength ?? null,
          normalPathMapCount: schroederAuthoritySequence.normalPathMapCount ?? null,
          normalPathReadbackBytes:
            schroederAuthoritySequence.normalPathReadbackBytes ?? null,
          fullReadbackPerformed:
            schroederAuthoritySequence.fullReadbackPerformed ?? null,
          fullParticleReadbackPerformed:
            schroederAuthoritySequence.fullParticleReadbackPerformed ?? null,
          queueCompletionStatus:
            schroederAuthoritySequence.queueCompletionStatus ?? null,
          queueCompletionMethod:
            schroederAuthoritySequence.queueCompletionMethod ?? null,
          queueFenceCompleted:
            schroederAuthoritySequence.queueFenceCompleted === true,
          computeManagerLaneIdentityStatus:
            schroederAuthoritySequence.computeManagerLaneIdentityStatus ?? null,
          computeManagerLaneIdentity:
            schroederAuthoritySequence.computeManagerLaneIdentity
              ? { ...schroederAuthoritySequence.computeManagerLaneIdentity }
              : null
        } : null
      },
      nativeSurface: {
        rendererBridge: bridge?.rendererBridge ?? null,
        source: bridge?.source
          ?? bridge?.renderBridgeSource
          ?? bridge?.nativeSurfacePresentationOwner
          ?? null,
        nativeWebGpuSurfaceConsumer: bridge?.nativeWebGpuSurfaceConsumer === true,
        deviceReady: Boolean(bridge?.device),
        canvasReady: Boolean(bridge?.canvas),
        drawStateReady: Boolean(bridge?.drawState),
        cameraBufferReady: Boolean(bridge?.cameraBuffer),
        failureReason: bridgeFailureReason,
        renderRefreshTotalMs: renderState?.renderRefreshTotalMs ?? null,
        renderRefreshStageMs: renderState?.renderRefreshStageMs
          ? { ...renderState.renderRefreshStageMs }
          : null,
        immutablePipelineCache: immutablePipelineCache
          ? { ...immutablePipelineCache }
          : null,
        nativeMarchingCubesExtractionBatchSchema:
          renderState?.surfaceDrawNativeMarchingCubesExtractionBatchSchema ?? null,
        nativeMarchingCubesExtractionBatchStatus:
          renderState?.surfaceDrawNativeMarchingCubesExtractionBatchStatus ?? null,
        nativeMarchingCubesExtractionBatchMode:
          renderState?.surfaceDrawNativeMarchingCubesExtractionBatchMode ?? null,
        nativeMarchingCubesExtractionBatchJobCount:
          renderState?.surfaceDrawNativeMarchingCubesExtractionBatchJobCount ?? null,
        nativeMarchingCubesExtractionBatchSharedCommandEncoder:
          renderState?.surfaceDrawNativeMarchingCubesExtractionBatchSharedCommandEncoder ?? null,
        nativeMarchingCubesExtractionBatchCallerSubmitCount:
          renderState?.surfaceDrawNativeMarchingCubesExtractionBatchCallerSubmitCount ?? null,
        nativeMarchingCubesExtractionBatchInternalSubmitCount:
          renderState?.surfaceDrawNativeMarchingCubesExtractionBatchInternalSubmitCount ?? null,
        nativeMarchingCubesExtractionBatchQueueSubmitMs:
          renderState?.surfaceDrawNativeMarchingCubesExtractionBatchQueueSubmitMs ?? null,
        nativeMarchingCubesExtractionBatchCpuSurfaceReadback:
          renderState?.surfaceDrawNativeMarchingCubesExtractionBatchCpuSurfaceReadback ?? null,
        nativeMarchingCubesExtractionBatchPointFallback:
          renderState?.surfaceDrawNativeMarchingCubesExtractionBatchPointFallback ?? null,
        nativeMarchingCubesExtractionBatchTemporaryResourceCount:
          renderState?.surfaceDrawNativeMarchingCubesExtractionBatchTemporaryResourceCount ?? null,
        nativeMarchingCubesExtractionBatchRetiredTemporaryResourceCount:
          renderState
            ?.surfaceDrawNativeMarchingCubesExtractionBatchRetiredTemporaryResourceCount ?? null
      },
      scheduleTrace: (control?.scheduleTrace || overlay?.__sphResidentScheduleTrace || []).map((event) => ({
        scheduleToken: event?.scheduleToken ?? null,
        stage: event?.stage ?? null,
        atMs: event?.atMs ?? null,
        status: event?.status ?? null,
        stale: event?.stale ?? null,
        requestedStepCount: event?.requestedStepCount ?? null,
        continueFromResidentState: event?.continueFromResidentState ?? null,
        residentSequenceAuthorityEpoch: event?.residentSequenceAuthorityEpoch ?? null,
        renderReason: event?.renderReason ?? null,
        requiredVisible: event?.requiredVisible ?? null,
        presentationBackpressureStatus:
          event?.presentationBackpressure?.status
            ?? event?.presentationBackpressureStatus
            ?? null,
        presentationBackpressureRequired:
          event?.presentationBackpressure?.required
            ?? event?.presentationBackpressureRequired
            ?? null,
        maxComputeSubmissionsAheadOfPresentation:
          event?.presentationBackpressure?.maxComputeSubmissionsAheadOfPresentation
            ?? event?.maxComputeSubmissionsAheadOfPresentation
            ?? null,
        presentationBackpressureWaitMs:
          event?.waitMs ?? event?.presentationBackpressureWaitMs ?? null,
        presentationBackpressureBarrierCount:
          event?.barrierCount ?? event?.presentationBackpressureBarrierCount ?? null
      })),
      renderRefreshTrace: Array.isArray(overlay?.__sphResidentRenderRefreshTrace)
        ? overlay.__sphResidentRenderRefreshTrace.map((event) => ({ ...event }))
        : [],
      pendingSchedule: overlay?.__mlsMpmResidentStepsPending
        ? {
            status: overlay.__mlsMpmResidentStepsPending.status ?? null,
            scheduleToken: overlay.__mlsMpmResidentStepsPending.scheduleToken ?? null,
            generation: overlay.__mlsMpmResidentStepsPending.generation ?? null
          }
        : null,
      residentError: overlay?.__mlsMpmResidentStepsError ?? null,
      residentAdmissionError: overlay?.__mlsMpmResidentStepsAdmissionError
        ? { ...overlay.__mlsMpmResidentStepsAdmissionError }
        : null,
      sceneProgress: scene?.scene?.userData?.mlsMpmResidentStepsProgress
        ? { ...scene.scene.userData.mlsMpmResidentStepsProgress }
        : null,
      finalStepPerformanceSource,
      productEventArenaDiagnostic,
      residentPerf: overlay?.__sphResidentPerf ? {
        schema: overlay.__sphResidentPerf.schema ?? null,
        residentSubmissions: overlay.__sphResidentPerf.residentSubmissions ?? null,
        residentStepsPerSchedule: overlay.__sphResidentPerf.residentStepsPerSchedule ?? null,
        lastResidentMs: overlay.__sphResidentPerf.lastResidentMs ?? null,
        lastResidentCycleMs: overlay.__sphResidentPerf.lastResidentCycleMs ?? null,
        lastResidentPostComputeMs:
          overlay.__sphResidentPerf.lastResidentPostComputeMs ?? null,
        lastResidentMaterialInterfaceRefreshMs:
          overlay.__sphResidentPerf.lastResidentMaterialInterfaceRefreshMs ?? null,
        lastResidentPressureInterfaceRefreshMs:
          overlay.__sphResidentPerf.lastResidentPressureInterfaceRefreshMs ?? null,
        lastResidentInterfaceRefreshMs:
          overlay.__sphResidentPerf.lastResidentInterfaceRefreshMs ?? null,
        lastRenderReadbackMs: overlay.__sphResidentPerf.lastRenderReadbackMs ?? null,
        residentPresentationBackpressurePending:
          overlay.__sphResidentPerf.residentPresentationBackpressurePending ?? null,
        residentPresentationBackpressureStatus:
          overlay.__sphResidentPerf.residentPresentationBackpressureStatus ?? null,
        residentPresentationBackpressureWaitCount:
          overlay.__sphResidentPerf.residentPresentationBackpressureWaitCount ?? null,
        residentPresentationBackpressureDeferredScheduleCount:
          overlay.__sphResidentPerf.residentPresentationBackpressureDeferredScheduleCount ?? null,
        lastResidentPresentationBackpressureMs:
          overlay.__sphResidentPerf.lastResidentPresentationBackpressureMs ?? null,
        residentPresentationMaxComputeSubmissionsAhead:
          overlay.__sphResidentPerf.residentPresentationMaxComputeSubmissionsAhead ?? null,
        residentInterfaceRefreshPending:
          overlay.__sphResidentPerf.residentInterfaceRefreshPending ?? null,
        residentRenderRefreshPending:
          overlay.__sphResidentPerf.residentRenderRefreshPending ?? null
      } : null,
      browserControl: control ? {
        schema: control.schema ?? null,
        pauseClicks: control.pauseClicks ?? null,
        firstScheduledToken: control.firstScheduledToken ?? null,
        targetResidentSubmissionCount:
          control.targetResidentSubmissionCount ?? null
      } : null,
      webGpuErrors: Array.isArray(control?.gpuErrors) ? [...control.gpuErrors] : []
    };
  });

  const schedule = summarizeMountedScheduleTrace(pageSnapshot.scheduleTrace);
  const normalizedTargetResidentSubmissionCount = positiveSafeInteger(
    targetResidentSubmissionCount,
    DEFAULT_TARGET_RESIDENT_SUBMISSION_COUNT
  );
  const normalizedResidentStepsPerSchedule = positiveSafeInteger(
    residentStepsPerSchedule,
    DEFAULT_RESIDENT_STEPS_PER_SCHEDULE
  );
  const finalStepPerformance = compactMountedResidentFinalStepPerformance(
    pageSnapshot.finalStepPerformanceSource
  );
  pageSnapshot.residentPerf = compactMountedResidentPerf(pageSnapshot.residentPerf);
  pageSnapshot.renderRefreshTrace = compactMountedRenderRefreshTrace(
    pageSnapshot.renderRefreshTrace
  );
  delete pageSnapshot.finalStepPerformanceSource;
  return {
    ...pageSnapshot,
    probeConfig: {
      targetResidentSubmissionCount: normalizedTargetResidentSubmissionCount,
      residentStepsPerSchedule: normalizedResidentStepsPerSchedule
    },
    residentScheduleSnapshots: schedule.schedules.slice(
      0,
      normalizedTargetResidentSubmissionCount
    ),
    finalStepPerformance,
    browserErrors: snapshotMountedBrowserErrors(browserErrors)
  };
}

export async function runMountedResidentAuthorityProbe({
  baseUrl = process.env.ULG_MOUNTED_RESIDENT_AUTHORITY_BASE_URL || DEFAULT_BASE_URL,
  outputPath = process.env.ULG_MOUNTED_RESIDENT_AUTHORITY_OUTPUT || DEFAULT_OUTPUT_PATH,
  requireSchroeder =
    process.env.ULG_MOUNTED_RESIDENT_AUTHORITY_REQUIRE_SCHROEDER === '1',
  targetResidentSubmissionCount =
    process.env.ULG_MOUNTED_RESIDENT_AUTHORITY_TARGET_SUBMISSIONS
      ?? DEFAULT_TARGET_RESIDENT_SUBMISSION_COUNT,
  residentStepsPerSchedule =
    process.env.ULG_MOUNTED_RESIDENT_AUTHORITY_STEPS_PER_SCHEDULE
      ?? DEFAULT_RESIDENT_STEPS_PER_SCHEDULE,
  timeoutMs = Math.max(
    30_000,
    Number(process.env.ULG_MOUNTED_RESIDENT_AUTHORITY_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  )
} = {}) {
  const normalizedTargetResidentSubmissionCount = positiveSafeInteger(
    targetResidentSubmissionCount,
    DEFAULT_TARGET_RESIDENT_SUBMISSION_COUNT
  );
  const normalizedResidentStepsPerSchedule = positiveSafeInteger(
    residentStepsPerSchedule,
    DEFAULT_RESIDENT_STEPS_PER_SCHEDULE
  );
  const startedAt = new Date().toISOString();
  const targetUrl = buildMountedResidentAuthorityUrl(baseUrl, {
    requireSchroeder,
    residentStepsPerSchedule: normalizedResidentStepsPerSchedule
  });
  const browserErrors = { console: [], page: [], request: [], http: [], harness: [] };
  let snapshot = {};
  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });

  try {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 760 },
      ignoreHTTPSErrors: true
    });
    await installMountedProbeInstrumentation(page, {
      targetResidentSubmissionCount: normalizedTargetResidentSubmissionCount
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      browserErrors.console.push(message.text());
    });
    page.on('pageerror', (error) => {
      browserErrors.page.push(error.message || String(error));
    });
    page.on('requestfailed', (request) => {
      browserErrors.request.push({
        url: request.url(),
        resourceType: request.resourceType(),
        errorText: request.failure()?.errorText ?? null
      });
    });
    page.on('response', (response) => {
      const resourceType = response.request().resourceType();
      if (
        response.status() >= 400
        && ['document', 'script', 'stylesheet', 'fetch', 'xhr'].includes(resourceType)
      ) {
        browserErrors.http.push({
          url: response.url(),
          resourceType,
          status: response.status()
        });
      }
    });

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page.waitForSelector('#sph-phase-overlay', { timeout: timeoutMs });
      await page.waitForFunction(({
        schroederRequired,
        targetResidentSubmissionCount: targetSubmissionCount,
        residentStepsPerSchedule: expectedStepCount
      }) => {
        const overlay = document.querySelector('#sph-phase-overlay');
        if (overlay?.__mlsMpmResidentStepsError) return true;
        const scene = overlay?.__sphScene;
        const execution = overlay?.__mlsMpmResidentSteps
          || scene?.getMlsMpmResidentSteps?.();
        const bridge = scene?.getSphResidentSurfaceDrawRenderBridge?.();
        const authoritySequence = execution?.schroederTwoLevelAuthoritySequence
          || execution?.finalStep?.schroederTwoLevelAuthoritySequence
          || null;
        const profileReady = schroederRequired
          ? authoritySequence?.status
              === 'schroeder-two-level-authority-sequence-completed'
            && authoritySequence?.commandSubmissionCount === 1
          : execution?.commitDelta?.payload?.pressureEpochCount === expectedStepCount
            && execution?.commitDelta?.payload?.pressureAppliedSubstepCount
              === expectedStepCount;
        const retainedScheduleTrace = (
          globalThis.__ulgMountedResidentAuthorityProbeControl?.scheduleTrace
            || overlay?.__sphResidentScheduleTrace
            || []
        );
        const publishedScheduleCount = retainedScheduleTrace
          .filter((event) => event?.stage === 'published').length;
        const releasedScheduleCount = retainedScheduleTrace
          .filter((event) => event?.stage === 'physics-flight-released').length;
        const residentPerf = overlay?.__sphResidentPerf;
        return Boolean(
          overlay?.__sphPeerComputeResidentAuthorityHost?.status === 'ready'
          && overlay?.__sphResidentComputeManager?.source
            === 'peercompute-resident-authority-host'
          && overlay?.__sphResidentStateManager?.source
            === 'peercompute-resident-authority-host'
          && execution?.computeManagerTask?.status
            === 'state-manager-committed-inline-execution-returned'
          && execution?.stateManagerCommit?.status === 'committed'
          && execution?.completedStepCount === expectedStepCount
          && residentPerf?.residentStepsPerSchedule === expectedStepCount
          && residentPerf?.residentSubmissions >= targetSubmissionCount
          && publishedScheduleCount >= targetSubmissionCount
          && releasedScheduleCount >= targetSubmissionCount
          && Number.isFinite(residentPerf?.lastResidentMs)
          && Number.isFinite(residentPerf?.lastResidentCycleMs)
          && Number.isFinite(residentPerf?.lastResidentPostComputeMs)
          && profileReady
          && bridge?.rendererBridge === 'native-webgpu-surface-consumer'
          && bridge?.nativeWebGpuSurfaceConsumer === true
          && bridge?.device
          && bridge?.canvas
          && bridge?.drawState
        );
      }, {
        schroederRequired: requireSchroeder,
        targetResidentSubmissionCount: normalizedTargetResidentSubmissionCount,
        residentStepsPerSchedule: normalizedResidentStepsPerSchedule
      }, { timeout: timeoutMs });
      await page.waitForTimeout(100);
    } catch (error) {
      browserErrors.harness.push(error instanceof Error ? error.message : String(error));
    }

    try {
      snapshot = await captureMountedResidentAuthoritySnapshot(page, browserErrors, {
        targetResidentSubmissionCount: normalizedTargetResidentSubmissionCount,
        residentStepsPerSchedule: normalizedResidentStepsPerSchedule
      });
      snapshot.requireSchroeder = requireSchroeder;
    } catch (error) {
      browserErrors.harness.push(
        `snapshot-capture-failed: ${error instanceof Error ? error.message : String(error)}`
      );
      snapshot = {
        requireSchroeder,
        probeConfig: {
          targetResidentSubmissionCount: normalizedTargetResidentSubmissionCount,
          residentStepsPerSchedule: normalizedResidentStepsPerSchedule
        },
        residentScheduleSnapshots: [],
        browserErrors,
        webGpuErrors: []
      };
    }
  } finally {
    await browser.close();
  }

  const evaluation = evaluateMountedResidentAuthoritySnapshot(snapshot, {
    requireSchroeder,
    targetResidentSubmissionCount: normalizedTargetResidentSubmissionCount,
    residentStepsPerSchedule: normalizedResidentStepsPerSchedule
  });
  const artifact = {
    schema: MOUNTED_RESIDENT_AUTHORITY_PROBE_SCHEMA,
    status: evaluation.status,
    startedAt,
    completedAt: new Date().toISOString(),
    baseUrl,
    targetUrl,
    outputPath,
    requireSchroeder,
    targetResidentSubmissionCount: normalizedTargetResidentSubmissionCount,
    residentStepsPerSchedule: normalizedResidentStepsPerSchedule,
    profile: evaluation.profile,
    evaluation,
    snapshot
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}

const invokedModuleUrl = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedModuleUrl === import.meta.url) {
  const artifact = await runMountedResidentAuthorityProbe();
  if (artifact.status !== 'passed') process.exitCode = 1;
}
