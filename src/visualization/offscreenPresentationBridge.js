import {
  createResidentRenderCandidateMailbox
} from './residentRenderCandidateMailbox.js';
import {
  isExactWorkerPresentationFrameQueueCompletionProof
} from '../runtime/sph/sphWorkerPresentationQos.js';

export {
  ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA
} from './residentRenderCandidateMailbox.js';

export const ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA =
  'peercompute.ulg.worker-offscreen-presentation.v0';
export const ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT =
  'worker-owned-presented-canvas';
export const ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF =
  'transferControlToOffscreen';
export const ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT = 'frame-copy-back';
export const ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA =
  'peercompute.ulg.worker-offscreen-render-rows.v0';
export const ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT =
  'main-thread-compact-render-row-transfer';
export const ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS = 8;
const ULG_WORKER_OFFSCREEN_GAS_PHASE_ID = 3;
export const ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_HANDOFF_SCHEMA =
  'peercompute.ulg.worker-offscreen-retained-gpubuffer-handoff.v0';
export const ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_TRANSPORT =
  'cross-worker-gpubuffer-structured-clone';
export const ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT =
  'worker-owned-resident-render-producer';
export const ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA =
  'peercompute.ulg.worker-offscreen-resident-render-producer.v0';
export const ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA =
  'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0';
export const ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_KEYFRAME_PRESENTATION_FRAME_SCHEMA =
  'peercompute.ulg.worker-offscreen-particle-keyframe-presentation-frame.v0';
export const ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_TEMPORAL_MOTION_FRAME_SCHEMA =
  'peercompute.ulg.worker-offscreen-particle-temporal-motion-frame.v0';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA =
  'peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS =
  'worker-offscreen-resident-isosurface-presentation-enqueued';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS =
  'worker-offscreen-resident-isosurface-presentation-rendered';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY =
  'worker-owned-true-isosurface';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA =
  'peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0';
export const ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_TRANSPORT =
  'worker-resident-particle-state-transfer';
export const ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_CACHE_TRANSPORT =
  'worker-resident-particle-state-cache';
export const ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS = 8;
export const ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA =
  'peercompute.ulg.presentation-worker-resident-stage.v0';
export const ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT =
  'offscreen-presentation-worker-device';
export const ULG_WORKER_OFFSCREEN_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA =
  'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0';
export const ULG_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA =
  'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0';
export const ULG_WORKER_RESIDENT_SCHEDULE_TERMINAL_REFLUX_RECEIPT_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-terminal-reflux-receipt.v0';
export const ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA =
  'peercompute.ulg.presentation-worker-retained-compact-snapshot-export.v0';
export const ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA =
  'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0';

function nonEmptyString(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function compactWorkerOwnedOpticalPresentation(value = null) {
  if (
    value?.schema
      !== 'peercompute.ulg.worker-isosurface-optical-presentation.v0'
  ) return null;
  const count = (field) => {
    const number = Number(value[field]);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  };
  const gasSurfaceCount = count('gasSurfaceCount');
  const closureGovernedGasSurfaceCount = count(
    'closureGovernedGasSurfaceCount'
  );
  const visibleClosureGasSurfaceCount = count(
    'visibleClosureGasSurfaceCount'
  );
  const opticallyThinHiddenGasSurfaceCount = count(
    'opticallyThinHiddenGasSurfaceCount'
  );
  if (
    gasSurfaceCount == null
    || closureGovernedGasSurfaceCount == null
    || visibleClosureGasSurfaceCount == null
    || opticallyThinHiddenGasSurfaceCount == null
  ) return null;
  return Object.freeze({
    schema: value.schema,
    status: nonEmptyString(value.status),
    gasSurfaceCount,
    closureGovernedGasSurfaceCount,
    visibleClosureGasSurfaceCount,
    opticallyThinHiddenGasSurfaceCount,
    allGasSurfacesClosureGoverned:
      value.allGasSurfacesClosureGoverned === true,
    heuristicGasOpacityUsed: value.heuristicGasOpacityUsed === true,
    opticalProvenanceSources: Array.isArray(value.opticalProvenanceSources)
      ? value.opticalProvenanceSources.map(nonEmptyString).filter(Boolean)
      : []
  });
}

function workerPresentationPhysicsPrefixNotAttributed(receipt = null) {
  return Boolean(
    receipt?.physicsQueuePrefixCoverage
      === 'physics-queue-prefix-not-attributed'
    && receipt?.physicsHostQueueFenceParticipation !== true
  );
}

function workerParticleMotionQueueAttributionReady(receipt = null) {
  if (workerPresentationPhysicsPrefixNotAttributed(receipt)) return true;
  const boundary = receipt?.motionPresentationQosBoundary;
  const completedSubstepCount = Number(boundary?.completedSubstepCount);
  const totalSubstepCount = Number(boundary?.totalSubstepCount);
  const chunkStepCount = Number(boundary?.chunkStepCount);
  return Boolean(
    receipt?.physicsQueuePrefixCoverage === 'physics-queue-prefix-included'
    && receipt?.physicsHostQueueFenceParticipation === true
    && Number.isSafeInteger(Number(boundary?.submissionOrdinal))
    && Number(boundary.submissionOrdinal) > 0
    && Number.isSafeInteger(completedSubstepCount)
    && completedSubstepCount > 0
    && Number.isSafeInteger(totalSubstepCount)
    && totalSubstepCount > completedSubstepCount
    && Number.isSafeInteger(chunkStepCount)
    && chunkStepCount > 0
  );
}

function workerParticleKeyframePresentationProofReady(receipt = null) {
  return Boolean(
    receipt?.presentationFrameSchema
      === ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_KEYFRAME_PRESENTATION_FRAME_SCHEMA
    && receipt?.presentationFrameStatus
      === 'worker-particle-keyframe-presentation-opportunity'
    && receipt?.presentationFrameAdmitted === true
    && receipt?.presentationFrameGpuCompleted === true
    && receipt?.presentationFramePresentationOpportunity === true
    && receipt?.presentationFramePresentationOpportunityMethod
      === 'worker-request-animation-frame-after-gpu-completion'
    && isExactWorkerPresentationFrameQueueCompletionProof(receipt)
    && workerPresentationPhysicsPrefixNotAttributed(receipt)
  );
}

function workerParticleTemporalMotionFrameSelfProofReady(receipt = null) {
  const motionFrameSerial = Number(receipt?.motionFrameSerial);
  const motionFrameSubmittedSerial = Number(
    receipt?.motionFrameSubmittedSerial
  );
  const motionSourceFrameCount = Number(receipt?.motionSourceFrameCount);
  const motionSourceSphStep = Number(receipt?.motionSourceSphStep);
  return Boolean(
    receipt?.motionFrameSchema
      === ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_TEMPORAL_MOTION_FRAME_SCHEMA
    && receipt?.motionFrameStatus
      === 'worker-particle-temporal-motion-frame-presentation-opportunity'
    && receipt?.motionFrameAdmitted === true
    && receipt?.motionFrameGpuCompleted === true
    && receipt?.motionFramePresentationOpportunity === true
    && receipt?.motionFramePresentationOpportunityMethod
      === 'worker-request-animation-frame-after-gpu-completion'
    && Number.isSafeInteger(motionFrameSerial)
    && motionFrameSerial > 0
    && Number.isSafeInteger(motionFrameSubmittedSerial)
    && motionFrameSubmittedSerial >= motionFrameSerial
    && Number.isSafeInteger(motionSourceFrameCount)
    && motionSourceFrameCount > 0
    && Number.isSafeInteger(motionSourceSphStep)
    && motionSourceSphStep >= 0
    && Number(receipt?.sphStep) === motionSourceSphStep
    && receipt?.motionMethod === 'bounded-keyframe-velocity-extrapolation'
    && receipt?.motionVelocityBufferRetained === true
    && isExactWorkerPresentationFrameQueueCompletionProof(receipt)
    && workerParticleMotionQueueAttributionReady(receipt)
  );
}

function workerParticleTemporalMotionFrameBoundToSource(
  receipt,
  previousReceipt
) {
  if (
    !workerParticleTemporalMotionFrameSelfProofReady(receipt)
    || !previousReceipt
  ) return false;
  const previousIsMotion =
    workerParticleTemporalMotionFrameSelfProofReady(previousReceipt);
  const expectedSourceSphStep = Number(
    previousIsMotion
      ? previousReceipt.motionSourceSphStep
      : previousReceipt.sphStep
  );
  const expectedSourceFrameCount = Number(
    previousIsMotion
      ? previousReceipt.motionSourceFrameCount
      : previousReceipt.frameCount
  );
  return Boolean(
    Number(receipt.motionSourceSphStep) === expectedSourceSphStep
    && Number(receipt.motionSourceFrameCount) === expectedSourceFrameCount
    && Number(receipt.frameCount) > Number(previousReceipt.frameCount)
  );
}

function workerIsosurfacePresentationProofReady(receipt = null) {
  return Boolean(
    receipt?.presentationFrameSchema
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA
    && receipt?.presentationFrameStatus
      === 'worker-owned-isosurface-presentation-opportunity'
    && receipt?.presentationFrameAdmitted === true
    && receipt?.presentationFrameGpuCompleted === true
    && receipt?.presentationFrameGpuCompletionMethod
      === 'worker-device.queue.onSubmittedWorkDone'
    && receipt?.presentationFramePresentationOpportunity === true
    && receipt?.presentationFramePresentationOpportunityMethod
      === 'worker-request-animation-frame-after-gpu-completion'
    && isExactWorkerPresentationFrameQueueCompletionProof(receipt)
    && workerPresentationPhysicsPrefixNotAttributed(receipt)
  );
}

function committedPresentationReceiptVersion(receipt = null) {
  const presentationLaneEpoch = Number(receipt?.presentationLaneEpoch);
  const residentExecutionGeneration = Number(
    receipt?.residentExecutionGeneration
  );
  const sphStep = Number(receipt?.sphStep);
  const stepOrdinal = Number(receipt?.stepOrdinal);
  if (
    !Number.isSafeInteger(presentationLaneEpoch)
    || presentationLaneEpoch <= 0
    || !Number.isSafeInteger(residentExecutionGeneration)
    || residentExecutionGeneration < 0
    || !Number.isSafeInteger(sphStep)
    || sphStep < 0
    || !Number.isSafeInteger(stepOrdinal)
    || stepOrdinal <= 0
  ) return null;
  const requestGeneration = Number(receipt?.requestGeneration);
  const motionFrameSerial = Number(receipt?.motionFrameSerial);
  return Object.freeze([
    presentationLaneEpoch,
    residentExecutionGeneration,
    sphStep,
    stepOrdinal,
    Number.isSafeInteger(requestGeneration) && requestGeneration > 0
      ? requestGeneration
      : 0,
    workerParticleTemporalMotionFrameSelfProofReady(receipt)
      ? motionFrameSerial
      : 0
  ]);
}

function committedPresentationReceiptStatusRank(status) {
  const normalized = String(status || '');
  if (/-rendered$/.test(normalized)) return 3;
  if (/(?:blocked|failed|superseded)/.test(normalized)) return 2;
  if (/-enqueued$/.test(normalized)) return 1;
  return 0;
}

function committedPresentationReceiptCanAdvance(previous, incoming) {
  if (!previous) return true;
  const previousVersion = committedPresentationReceiptVersion(previous);
  const incomingVersion = committedPresentationReceiptVersion(incoming);
  if (!previousVersion) return true;
  if (!incomingVersion) return false;
  for (let index = 0; index < incomingVersion.length; index += 1) {
    if (incomingVersion[index] > previousVersion[index]) return true;
    if (incomingVersion[index] < previousVersion[index]) return false;
  }
  return committedPresentationReceiptStatusRank(incoming?.status)
    >= committedPresentationReceiptStatusRank(previous?.status);
}

function committedPresentationFramebufferCanAdvance(
  previous,
  incoming,
  queueCompletionSerialHighWater = 0
) {
  const incomingQueueCompletionSerial = Number(
    incoming?.presentationQueueCompletionSerial
  );
  const queueSerialFloor = Number(queueCompletionSerialHighWater);
  if (
    Number.isSafeInteger(queueSerialFloor)
    && queueSerialFloor > 0
    && Number.isSafeInteger(incomingQueueCompletionSerial)
    && incomingQueueCompletionSerial > 0
    && incomingQueueCompletionSerial <= queueSerialFloor
  ) return false;
  if (!previous) return true;
  const previousQueueCompletionSerial = Number(
    previous?.presentationQueueCompletionSerial
  );
  if (
    Number.isSafeInteger(previousQueueCompletionSerial)
    && previousQueueCompletionSerial > 0
    && Number.isSafeInteger(incomingQueueCompletionSerial)
    && incomingQueueCompletionSerial > 0
    && incomingQueueCompletionSerial <= previousQueueCompletionSerial
  ) return false;
  const previousVersion = committedPresentationReceiptVersion(previous);
  const incomingVersion = committedPresentationReceiptVersion(incoming);
  if (!previousVersion) return true;
  if (!incomingVersion) return false;
  for (let index = 0; index < incomingVersion.length; index += 1) {
    if (incomingVersion[index] > previousVersion[index]) return true;
    if (incomingVersion[index] < previousVersion[index]) return false;
  }
  // Camera redraws intentionally retain the same source/version tuple. The
  // strictly advancing same-worker queue-completion serial above is their
  // framebuffer identity; equal source coordinates are not a replay.
  return Number.isSafeInteger(incomingQueueCompletionSerial)
    && incomingQueueCompletionSerial > 0;
}

export function buildUlgWorkerOffscreenCommittedResidentSchedulePresentationAdmission({
  workerLaneAuthority = null,
  reason = 'present-committed-resident-schedule-candidate'
} = {}) {
  const scheduleResult = workerLaneAuthority?.scheduleResult;
  const terminalFence = scheduleResult?.gpuFence;
  const managerExecution = workerLaneAuthority?.gpuResidentLaneExecution;
  const managerFence = managerExecution?.gpuFence;
  const managerCompletion = workerLaneAuthority?.computeManagerCompletion;
  const stateManagerCommit = workerLaneAuthority?.stateManagerCommit;
  const scheduleId = nonEmptyString(scheduleResult?.scheduleId);
  const laneId = nonEmptyString(scheduleResult?.laneId);
  const stateKey = nonEmptyString(scheduleResult?.stateKey);
  const completedStepCount = Number(scheduleResult?.completedStepCount);
  const storageGeneration = Number(
    scheduleResult?.finalEpochIdentity?.storageGeneration
  );
  const physicsTick = Number(scheduleResult?.finalEpochIdentity?.physicsTick);
  const managerLease = managerExecution?.lease;
  const managerLeaseId = nonEmptyString(managerLease?.leaseId);
  const taskId = nonEmptyString(workerLaneAuthority?.taskId);
  const queueCompletionMethod = nonEmptyString(
    terminalFence?.queueCompletionMethod ?? terminalFence?.method
  );
  const twoLevelEvidence =
    scheduleResult?.perStepSummaries?.twoLevelMechanics ?? null;
  const terminalRefluxReceiptRequired = Boolean(
    workerLaneAuthority?.twoLevelTerminalRefluxReceiptRequired === true
    || (
      twoLevelEvidence?.requested === true
      && twoLevelEvidence?.authorityRequested === 'authoritative'
    )
  );
  const terminalRefluxReceipt = terminalFence?.terminalRefluxReceipt ?? null;
  const terminalRefluxReceiptReady = Boolean(
    terminalRefluxReceiptRequired !== true
    || (
      terminalRefluxReceipt?.schema
        === ULG_WORKER_RESIDENT_SCHEDULE_TERMINAL_REFLUX_RECEIPT_SCHEMA
      && terminalRefluxReceipt.status
        === 'terminal-reflux-schedule-receipt-admitted'
      && terminalRefluxReceipt.required === true
      && terminalRefluxReceipt.scheduleId === scheduleId
      && terminalRefluxReceipt.laneId === laneId
      && terminalRefluxReceipt.stateKey === stateKey
      && terminalRefluxReceipt.expectedStepCount === completedStepCount
      && terminalRefluxReceipt.observedStepCount === completedStepCount
      && terminalRefluxReceipt.admittedStepCount === completedStepCount
      && terminalRefluxReceipt.firstRejectedStepOrdinal == null
      && terminalRefluxReceipt.allStepsAdmitted === true
      && workerLaneAuthority?.terminalRefluxReceipt
        === terminalRefluxReceipt
    )
  );
  const ready = Boolean(
    workerLaneAuthority?.status === 'state-manager-committed-worker-schedule'
    && scheduleId
    && laneId
    && stateKey
    && workerLaneAuthority?.scheduleId === scheduleId
    && workerLaneAuthority?.laneId === laneId
    && workerLaneAuthority?.stateKey === stateKey
    && Number.isSafeInteger(completedStepCount)
    && completedStepCount > 0
    && Number.isSafeInteger(storageGeneration)
    && storageGeneration >= 0
    && Number.isSafeInteger(physicsTick)
    && physicsTick >= 0
    && terminalFence?.required === true
    && terminalFence?.scope === 'resident-schedule-terminal'
    && terminalFence?.terminalScheduleFence === true
    && terminalFence?.fenceSatisfied === true
    && terminalFence?.authorityAdmissionReady === true
    && terminalRefluxReceiptReady
    && terminalFence?.queueCompletionStatus === 'queue-work-completed'
    && [
      'queue.onSubmittedWorkDone',
      'worker-device.queue.onSubmittedWorkDone'
    ].includes(queueCompletionMethod)
    && terminalFence?.scheduleId === scheduleId
    && terminalFence?.laneId === laneId
    && terminalFence?.stateKey === stateKey
    && Number(terminalFence?.completedStepCount) === completedStepCount
    && managerCompletion?.schema
      === ULG_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA
    && managerCompletion?.status === 'completed'
    && taskId
    && managerCompletion?.taskId === taskId
    && managerLeaseId
    && managerCompletion?.leaseId === managerLeaseId
    && managerCompletion?.laneId === laneId
    && managerCompletion?.stateKey === stateKey
    && managerCompletion?.fenceSatisfied === true
    && managerLease?.status === 'completed'
    && managerLease?.taskId === taskId
    && managerFence?.fenceSatisfied === true
    && managerFence?.laneId === laneId
    && managerFence?.stateKey === stateKey
    && managerLease?.laneId === laneId
    && managerLease?.stateKey === stateKey
    && stateManagerCommit?.accepted === true
    && stateManagerCommit?.status === 'committed'
    && stateManagerCommit?.taskId === taskId
  );
  if (!ready) {
    return Object.freeze({
      schema:
        ULG_WORKER_OFFSCREEN_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA,
      status:
        'state-manager-committed-resident-schedule-presentation-blocked-authority-unproven',
      ready: false,
      reason,
      scheduleId,
      laneId,
      stateKey
    });
  }
  return Object.freeze({
    schema:
      ULG_WORKER_OFFSCREEN_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA,
    status: 'state-manager-committed-resident-schedule-presentation-admission',
    ready: true,
    reason,
    taskId,
    scheduleId,
    laneId,
    stateKey,
    candidateVersion: Object.freeze({
      residentExecutionGeneration: storageGeneration,
      nextStep: physicsTick,
      scheduleId,
      stepOrdinal: completedStepCount
    }),
    authority: Object.freeze({
      status: 'state-manager-committed-worker-schedule',
      computeManagerCompletionSchema: managerCompletion.schema,
      computeManagerLeaseId: managerCompletion.leaseId,
      computeManagerLeaseStatus: managerCompletion.status,
      computeManagerFenceSatisfied:
        managerCompletion.fenceSatisfied === true,
      stateManagerCommitStatus: stateManagerCommit.status,
      stateManagerCommitAccepted: stateManagerCommit.accepted === true
    }),
    terminalFence: Object.freeze({
      required: true,
      scope: 'resident-schedule-terminal',
      terminalScheduleFence: true,
      fenceSatisfied: true,
      authorityAdmissionReady: true,
      terminalRefluxReceiptRequired,
      terminalRefluxReceiptAdmitted: terminalRefluxReceiptReady,
      scheduleId,
      laneId,
      stateKey,
      completedStepCount,
      queueCompletionStatus: 'queue-work-completed',
      queueCompletionMethod
    })
  });
}

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function positiveNumber(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizePresentationBoxDimsM(value = null) {
  if (!(Array.isArray(value) || ArrayBuffer.isView(value)) || value.length !== 3) {
    return null;
  }
  const dims = Array.from(value, Number);
  return dims.every((entry) => Number.isFinite(entry) && entry > 0)
    ? dims
    : null;
}

function arrayLikeLength(value) {
  return value && Number.isFinite(Number(value.length))
    ? Math.max(0, Math.floor(Number(value.length)))
    : 0;
}

function uniqueStringList(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value ?? '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function readArrayLikeNumber(value, index, fallback = 0) {
  if (!value || index < 0 || index >= arrayLikeLength(value)) return fallback;
  return finiteNumber(value[index], fallback);
}

function normalizeViewProjectionMatrix(value) {
  if (value instanceof Float32Array && value.length >= 16) {
    return value.length === 16 ? new Float32Array(value) : new Float32Array(value.slice(0, 16));
  }
  const matrix = new Float32Array(16);
  if (value && arrayLikeLength(value) >= 16) {
    for (let index = 0; index < 16; index += 1) {
      matrix[index] = finiteNumber(value[index], index % 5 === 0 ? 1 : 0);
    }
    return matrix;
  }
  matrix[0] = 1;
  matrix[5] = 1;
  matrix[10] = 1;
  matrix[15] = 1;
  return matrix;
}

function residentRenderProducerPackedSourceCacheKey({
  sourceCacheKey = null,
  alpha = 0.92,
  fallbackColorRgb = [1, 1, 1],
  fallbackRadiusM = 0.02
} = {}) {
  const sourceArrayCacheKey = sourceCacheKey == null
    ? null
    : String(sourceCacheKey);
  return sourceArrayCacheKey
    ? [
        sourceArrayCacheKey,
        `alpha:${finiteNumber(alpha, 0.92)}`,
        `fallbackColor:${finiteNumber(fallbackColorRgb?.[0], 1)},${finiteNumber(fallbackColorRgb?.[1], 1)},${finiteNumber(fallbackColorRgb?.[2], 1)}`,
        `fallbackRadius:${finiteNumber(fallbackRadiusM, 0.02)}`
      ].join('|')
    : null;
}

function residentRenderProducerExpectedPayloadShape(positionsM = null) {
  const particleCount = Math.floor(arrayLikeLength(positionsM) / 3);
  const strideFloats = ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS;
  return {
    particleCount,
    strideFloats,
    byteLength: particleCount * strideFloats * 4
  };
}

function normalizeResidentParticleStateProducerColorRows(value = null) {
  if (value instanceof Float32Array) {
    const alignedLength = value.length - (value.length % ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS);
    return value.length === alignedLength ? new Float32Array(value) : new Float32Array(value.slice(0, alignedLength));
  }
  const length = arrayLikeLength(value);
  const alignedLength = length - (length % ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS);
  const rows = new Float32Array(alignedLength);
  for (let index = 0; index < alignedLength; index += 1) {
    rows[index] = finiteNumber(value?.[index], 0);
  }
  return rows;
}

function residentParticleStateProducerExpectedPayloadShape({
  sphParticleState = null,
  materialColorRows = null
} = {}) {
  const particleCount = Math.max(0, Math.floor(Number(sphParticleState?.particleCount) || 0));
  const stateStrideFloats = Math.max(1, Math.floor(Number(sphParticleState?.stateStrideFloats) || 8));
  const thermoStrideFloats = Math.max(1, Math.floor(Number(sphParticleState?.thermoStrideFloats) || 12));
  const stateByteLength = particleCount * stateStrideFloats * Float32Array.BYTES_PER_ELEMENT;
  const thermoByteLength = particleCount * thermoStrideFloats * Float32Array.BYTES_PER_ELEMENT;
  const colorRows = normalizeResidentParticleStateProducerColorRows(materialColorRows);
  return {
    particleCount,
    stateStrideFloats,
    thermoStrideFloats,
    stateByteLength,
    thermoByteLength,
    colorRows,
    colorRowCount: Math.floor(colorRows.length / ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS),
    colorRowsByteLength: colorRows.byteLength
  };
}

function sameDeviceRetainedBufferImportFrom(source = null) {
  return source?.sameDeviceRetainedBufferImport
    || source?.localSameDeviceRetainedBufferImport
    || source?.workerRetainedAccessContract?.sameDeviceRetainedBufferImport
    || source?.workerRetainedBufferImport?.sameDeviceRetainedBufferImport
    || source?.workerRetainedBufferImport?.workerRetainedAccessContract?.sameDeviceRetainedBufferImport
    || null;
}

function retainedCompactSnapshotLocalMaterializationStatus({
  source = null,
  laneId = null,
  stateKey = null,
  cacheKey = null,
  sourceStageId = 'g2p',
  particleCount = null,
  reason = 'export-retained-compact-snapshot',
  workerDeviceProvided = false
} = {}) {
  if (!source || typeof source !== 'object') return null;
  const sameDeviceRetainedBufferImport = sameDeviceRetainedBufferImportFrom(source);
  const sameDeviceRetainedBufferImportAvailable = sameDeviceRetainedBufferImport?.sameDevice === true;
  const workerRetainedBufferRefs = uniqueStringList(
    source.workerRetainedBufferRefs
      || source.retainedBufferRefs
      || source.workerRetainedAccessContract?.workerRetainedBufferRefs
      || source.workerRetainedBufferImport?.workerRetainedBufferRefs
      || []
  );
  const sameWorkerLocalReady = workerRetainedBufferRefs.length > 0
    || source.workerRetainedContinuationApplied === true
    || source.useWorkerRetainedInput === true
    || source.consumerMode === 'same-worker-lane-retained-buffer-ref';
  if (!sameDeviceRetainedBufferImportAvailable && !sameWorkerLocalReady) return null;
  const localMaterializationMode = sameDeviceRetainedBufferImportAvailable
    ? 'same-device-retained-buffer-import'
    : 'same-worker-lane-retained-buffer-ref';
  return {
    schema: ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA,
    status: 'presentation-worker-retained-compact-snapshot-export-bypassed-local-materialization-ready',
    reason,
    laneId,
    stateKey,
    cacheKey,
    sourceStageId,
    sourceHotBufferKey: source.sourceHotBufferKey || source.hotBufferKey || null,
    hotBufferKey: source.hotBufferKey || source.sourceHotBufferKey || null,
    particleCount,
    compactBufferSnapshotSchema: ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
    compactBufferSnapshot: null,
    portableSnapshotAvailable: false,
    portableSnapshotRequired: source.portableSnapshotRequired !== false,
    crossPeerReplayReady: false,
    crossPeerReplayStatus:
      source.crossPeerReplayStatus || 'blocked-portable-compact-buffer-snapshot-required',
    crossPeerReplayBlocker:
      source.crossPeerReplayBlocker || 'worker-retained-gpu-handles-are-not-cross-peer-portable',
    localMaterializationReady: true,
    localMaterializationStatus: `${localMaterializationMode}-ready`,
    localMaterializationMode,
    localMaterializationBypass: true,
    workerReadbackBypassed: true,
    workerMapAsyncBypassed: true,
    readbackByteLength: 0,
    sameDeviceRetainedBufferImportAvailable,
    sameDeviceRetainedBufferImport: sameDeviceRetainedBufferImportAvailable
      ? sameDeviceRetainedBufferImport
      : null,
    sameDeviceSourceHotBufferKey: sameDeviceRetainedBufferImport?.sourceHotBufferKey || null,
    workerRetainedBufferRefs,
    workerRetainedBufferRefCount: workerRetainedBufferRefs.length,
    acceptedConsumerModes: sameDeviceRetainedBufferImportAvailable
      ? ['same-device-retained-buffer-import', 'same-worker-lane-retained-buffer-ref']
      : ['same-worker-lane-retained-buffer-ref'],
    acceptedMaterializationModes: sameDeviceRetainedBufferImportAvailable
      ? ['same-device-retained-buffer-import', 'same-worker-lane-retained-buffer-ref']
      : ['same-worker-lane-retained-buffer-ref'],
    portableMaterializationContract:
      source.portableMaterializationContract
      || source.workerRetainedAccessContract?.portableMaterializationContract
      || source.workerRetainedBufferImport?.portableMaterializationContract
      || null,
    workerDeviceSource: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT,
    workerDeviceProvided,
    updatedAtMs: nowMs(),
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

function residentParticleStateProducerCacheMissReason(bridge, {
  normalizedSourceCacheKey = null,
  expected = null
} = {}) {
  if (!normalizedSourceCacheKey) return 'source-cache-key-missing';
  if (!bridge.residentParticleStateProducerCacheKey) return 'source-cache-empty';
  if (bridge.residentParticleStateProducerCacheKey !== normalizedSourceCacheKey) {
    return 'source-cache-key-changed';
  }
  if (bridge.residentParticleStateProducerParticleCount !== expected?.particleCount) {
    return 'particle-count-changed';
  }
  if (bridge.residentParticleStateProducerStateStrideFloats !== expected?.stateStrideFloats) {
    return 'state-stride-changed';
  }
  if (bridge.residentParticleStateProducerThermoStrideFloats !== expected?.thermoStrideFloats) {
    return 'thermo-stride-changed';
  }
  if (bridge.residentParticleStateProducerStateByteLength !== expected?.stateByteLength) {
    return 'state-byte-length-changed';
  }
  if (bridge.residentParticleStateProducerThermoByteLength !== expected?.thermoByteLength) {
    return 'thermo-byte-length-changed';
  }
  if (bridge.residentParticleStateProducerColorRowsByteLength !== expected?.colorRowsByteLength) {
    return 'color-row-byte-length-changed';
  }
  return 'source-cache-unavailable';
}

export function packUlgWorkerOffscreenRenderRowsPayload({
  positionsM = null,
  colorsRgb = null,
  particleRadiiM = null,
  particlePhaseIds = null,
  alpha = 0.92,
  fallbackColorRgb = [1, 1, 1],
  fallbackRadiusM = 0.02,
  maxParticles = null
} = {}) {
  const positionCount = Math.floor(arrayLikeLength(positionsM) / 3);
  const requestedMaxParticles = maxParticles != null && Number.isFinite(Number(maxParticles))
    ? Math.max(0, Math.floor(Number(maxParticles)))
    : positionCount;
  const particleCount = Math.min(positionCount, requestedMaxParticles);
  const particleRows = new Float32Array(
    particleCount * ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS
  );
  const hasColors = arrayLikeLength(colorsRgb) >= particleCount * 3;
  const hasRadii = arrayLikeLength(particleRadiiM) >= particleCount;
  const hasPhaseIds = arrayLikeLength(particlePhaseIds) >= particleCount;
  for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
    const sourceOffset = particleIndex * 3;
    const targetOffset = particleIndex * ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS;
    particleRows[targetOffset + 0] = readArrayLikeNumber(positionsM, sourceOffset + 0);
    particleRows[targetOffset + 1] = readArrayLikeNumber(positionsM, sourceOffset + 1);
    particleRows[targetOffset + 2] = readArrayLikeNumber(positionsM, sourceOffset + 2);
    const radiusM = Math.max(
      0,
      hasRadii
        ? readArrayLikeNumber(particleRadiiM, particleIndex, fallbackRadiusM)
        : finiteNumber(fallbackRadiusM, 0.02)
    );
    const phaseId = hasPhaseIds
      ? readArrayLikeNumber(particlePhaseIds, particleIndex, 0)
      : 0;
    const vaporLike = Math.abs(phaseId - ULG_WORKER_OFFSCREEN_GAS_PHASE_ID) < 0.5;
    // Signed radius is presentation-only metadata shared by both the direct
    // compact-row renderer and its worker-resident copy producer. Exact gas
    // rows take the depth-tested/non-depth-writing pass; plasma and condensed
    // phases retain normal depth writes. Zero-radius dormant rows stay hidden.
    particleRows[targetOffset + 3] = vaporLike && radiusM > 0 ? -radiusM : radiusM;
    particleRows[targetOffset + 4] = Math.max(0, Math.min(1, hasColors
      ? readArrayLikeNumber(colorsRgb, sourceOffset + 0, fallbackColorRgb[0] ?? 1)
      : finiteNumber(fallbackColorRgb[0], 1)));
    particleRows[targetOffset + 5] = Math.max(0, Math.min(1, hasColors
      ? readArrayLikeNumber(colorsRgb, sourceOffset + 1, fallbackColorRgb[1] ?? 1)
      : finiteNumber(fallbackColorRgb[1], 1)));
    particleRows[targetOffset + 6] = Math.max(0, Math.min(1, hasColors
      ? readArrayLikeNumber(colorsRgb, sourceOffset + 2, fallbackColorRgb[2] ?? 1)
      : finiteNumber(fallbackColorRgb[2], 1)));
    particleRows[targetOffset + 7] = Math.max(0, Math.min(1, finiteNumber(alpha, 0.92)));
  }
  return {
    schema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
    status: particleCount > 0
      ? 'worker-offscreen-render-rows-packed'
      : 'worker-offscreen-render-rows-empty',
    inputTransport: ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT,
    particleRows,
    particleCount,
    strideFloats: ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS,
    byteLength: particleRows.byteLength,
    positionsByteLength: arrayLikeLength(positionsM) * Float32Array.BYTES_PER_ELEMENT,
    colorsByteLength: arrayLikeLength(colorsRgb) * Float32Array.BYTES_PER_ELEMENT,
    radiiByteLength: arrayLikeLength(particleRadiiM) * Float32Array.BYTES_PER_ELEMENT
  };
}

export function resolveUlgWorkerOffscreenRetainedGpuBufferHandoffCapability({
  requested = false,
  presentationStatus = null,
  retainedRenderRowsBufferAvailable = false,
  retainedRenderRowsBufferByteLength = 0,
  retainedSurfaceDrawBufferAvailable = false,
  retainedSurfaceDrawBufferByteLength = 0,
  crossOriginIsolated = globalThis.crossOriginIsolated,
  gpuBufferStructuredCloneSupported = false,
  gpuBufferStructuredCloneProbeStatus = null,
  gpuBufferStructuredCloneProbeReason = null,
  workerPresentationDeviceOwner = 'worker-owned-presentation-device',
  residentBufferDeviceOwner = 'main-thread-resident-device',
  reason = 'resident-render-refresh'
} = {}) {
  const requestedHandoff = Boolean(requested);
  const presentationReady = Boolean(
    presentationStatus?.canvasTransferred
    && presentationStatus?.workerReady
    && presentationStatus?.status !== 'worker-offscreen-presentation-disposed'
  );
  const retainedBufferAvailable = Boolean(
    retainedRenderRowsBufferAvailable || retainedSurfaceDrawBufferAvailable
  );
  const structuredCloneSupported = Boolean(gpuBufferStructuredCloneSupported);
  const sameDeviceOwner = workerPresentationDeviceOwner === residentBufferDeviceOwner
    || residentBufferDeviceOwner === 'same-worker-presentation-device';
  let status = 'worker-offscreen-retained-gpubuffer-handoff-not-requested';
  let blockerReason = null;
  if (requestedHandoff && !presentationReady) {
    status = 'worker-offscreen-retained-gpubuffer-handoff-blocked-presentation-unavailable';
    blockerReason = 'worker-owned presentation must be transferred and ready before retained GPUBuffer handoff can be considered';
  } else if (requestedHandoff && !retainedBufferAvailable) {
    status = 'worker-offscreen-retained-gpubuffer-handoff-blocked-no-retained-buffer';
    blockerReason = 'resident render refresh did not expose a retained GPUBuffer input for the worker canvas';
  } else if (requestedHandoff && !structuredCloneSupported) {
    status = 'worker-offscreen-retained-gpubuffer-handoff-blocked-structured-clone-unavailable';
    blockerReason = gpuBufferStructuredCloneProbeReason
      || (crossOriginIsolated
        ? 'GPUBuffer structured-clone handoff to the presentation worker has not been validated'
        : 'GPUBuffer structured-clone handoff requires browser support not available on this page; current page is not cross-origin isolated');
  } else if (requestedHandoff && !sameDeviceOwner) {
    status = 'worker-offscreen-retained-gpubuffer-handoff-blocked-device-owner-split';
    blockerReason = 'main-thread resident GPUBuffer cannot be bound by the worker-owned presentation GPUDevice';
  } else if (requestedHandoff) {
    status = 'worker-offscreen-retained-gpubuffer-handoff-ready';
  }
  return {
    schema: ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_HANDOFF_SCHEMA,
    status,
    reason: blockerReason || reason,
    requested: requestedHandoff,
    inputTransport: requestedHandoff ? ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_TRANSPORT : null,
    preferredReplacementTransport: requestedHandoff
      ? ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT
      : null,
    displayTransport: requestedHandoff ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
    displayHandoff: requestedHandoff ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
    rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
    frameCopyBackRejected: true,
    copiedBytesPerFrame: 0,
    copiedBytesPerSecond: 0,
    retainedRenderRowsBufferAvailable: Boolean(retainedRenderRowsBufferAvailable),
    retainedRenderRowsBufferByteLength: Math.max(
      0,
      Math.floor(Number(retainedRenderRowsBufferByteLength) || 0)
    ),
    retainedSurfaceDrawBufferAvailable: Boolean(retainedSurfaceDrawBufferAvailable),
    retainedSurfaceDrawBufferByteLength: Math.max(
      0,
      Math.floor(Number(retainedSurfaceDrawBufferByteLength) || 0)
    ),
    presentationReady,
    canvasTransferred: Boolean(presentationStatus?.canvasTransferred),
    workerReady: Boolean(presentationStatus?.workerReady),
    crossOriginIsolated: Boolean(crossOriginIsolated),
    gpuBufferStructuredCloneSupported: structuredCloneSupported,
    gpuBufferStructuredCloneProbeStatus,
    gpuBufferStructuredCloneProbeReason,
    workerPresentationDeviceOwner,
    residentBufferDeviceOwner,
    sameDeviceOwner,
    planChangeRequired: requestedHandoff && status !== 'worker-offscreen-retained-gpubuffer-handoff-ready',
    updatedAtMs: nowMs(),
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

function resolveWorkerConstructor(workerFactory = null, windowRef = globalThis) {
  return workerFactory || windowRef?.Worker || globalThis.Worker || null;
}

function createWorkerFromFactory(workerFactory, url, options) {
  try {
    return new workerFactory(url, options);
  } catch (error) {
    if (error instanceof TypeError) return workerFactory(url, options);
    throw error;
  }
}

export function resolveUlgWorkerOffscreenPresentationSize({
  container = null,
  width = null,
  height = null,
  devicePixelRatio = globalThis.devicePixelRatio
} = {}) {
  const rect = typeof container?.getBoundingClientRect === 'function'
    ? container.getBoundingClientRect()
    : null;
  const cssWidth = positiveNumber(
    width ?? rect?.width ?? container?.clientWidth ?? globalThis.innerWidth,
    1
  );
  const cssHeight = positiveNumber(
    height ?? rect?.height ?? container?.clientHeight ?? globalThis.innerHeight,
    1
  );
  const pixelRatio = Math.max(1, Math.min(2, positiveNumber(devicePixelRatio, 1)));
  return {
    cssWidth,
    cssHeight,
    pixelRatio,
    backingWidth: Math.max(1, Math.floor(cssWidth * pixelRatio)),
    backingHeight: Math.max(1, Math.floor(cssHeight * pixelRatio))
  };
}

export function resolveUlgWorkerOffscreenPresentationCapability({
  requested = false,
  canvas = null,
  workerFactory = null,
  workerAvailable = null,
  windowRef = globalThis,
  navigatorRef = globalThis.navigator
} = {}) {
  const requestedPresentation = Boolean(requested);
  const resolvedWorkerAvailable = workerAvailable ?? Boolean(resolveWorkerConstructor(workerFactory, windowRef));
  const transferAvailable = typeof canvas?.transferControlToOffscreen === 'function';
  const mainThreadWebGpuAvailable = Boolean(navigatorRef?.gpu || globalThis.navigator?.gpu);
  let status = 'worker-offscreen-presentation-not-requested';
  let reason = null;
  if (requestedPresentation && !resolvedWorkerAvailable) {
    status = 'worker-offscreen-presentation-blocked-worker-unavailable';
    reason = 'worker-owned presentation requires a module Worker';
  } else if (requestedPresentation && !canvas) {
    status = 'worker-offscreen-presentation-blocked-canvas-unavailable';
    reason = 'worker-owned presentation requires a display canvas element';
  } else if (requestedPresentation && !transferAvailable) {
    status = 'worker-offscreen-presentation-blocked-transfer-unavailable';
    reason = 'worker-owned presentation requires HTMLCanvasElement.transferControlToOffscreen';
  } else if (requestedPresentation) {
    status = 'worker-offscreen-presentation-transfer-ready';
  }
  return {
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    status,
    reason,
    requested: requestedPresentation,
    transport: requestedPresentation ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
    displayHandoff: requestedPresentation ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
    rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
    frameCopyBackRejected: true,
    copiedBytesPerFrame: 0,
    copiedBytesPerSecond: 0,
    workerAvailable: Boolean(resolvedWorkerAvailable),
    transferControlToOffscreenAvailable: transferAvailable,
    mainThreadWebGpuAvailable,
    canvasTransferred: false,
    workerReady: false,
    updatedAtMs: nowMs(),
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

function setDisplayCanvasStyle(canvas) {
  if (!canvas?.style) return;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '3';
  canvas.style.background = 'transparent';
}

function setDisplayCanvasOwnedVisibility(canvas, visible) {
  if (!canvas?.style) return;
  canvas.style.visibility = visible ? 'visible' : 'hidden';
}

function retainedCompactSnapshotRequestIdentity(status = null) {
  if (!status || typeof status !== 'object') return null;
  return Object.freeze({
    laneId: status.laneId ?? null,
    stateKey: status.stateKey ?? null,
    cacheKey: status.cacheKey ?? null,
    sourceStageId: status.sourceStageId ?? null
  });
}

function retainedCompactSnapshotIdentityMismatch(
  status = null,
  expectedIdentity = null
) {
  if (!status || !expectedIdentity) return null;
  for (const field of ['laneId', 'stateKey', 'cacheKey', 'sourceStageId']) {
    const expected = expectedIdentity[field];
    const actual = status[field];
    if (
      expected != null
      && actual != null
      && String(actual) !== String(expected)
    ) {
      return field;
    }
  }
  return null;
}

function compactRetainedCompactSnapshotPublicStatus(status = null) {
  if (!status || typeof status !== 'object') return status;
  const { compactBufferSnapshot = null, ...summary } = status;
  return {
    ...summary,
    compactBufferSnapshot: null,
    compactBufferSnapshotPayloadRetainedPrivately:
      Boolean(compactBufferSnapshot),
    compactBufferSnapshotSchema:
      compactBufferSnapshot?.schema
      || status.compactBufferSnapshotSchema
      || null,
    compactBufferSnapshotStatus:
      compactBufferSnapshot?.status ?? null,
    compactBufferSnapshotStep:
      Number.isFinite(Number(compactBufferSnapshot?.step))
        ? Number(compactBufferSnapshot.step)
        : null,
    compactBufferSnapshotTime:
      Number.isFinite(Number(compactBufferSnapshot?.time))
        ? Number(compactBufferSnapshot.time)
        : null,
    compactBufferSnapshotTopologyEpoch:
      Number.isSafeInteger(Number(compactBufferSnapshot?.topologyEpoch))
        ? Number(compactBufferSnapshot.topologyEpoch)
        : null,
    compactBufferSnapshotSharedSlotIdentityVerified:
      compactBufferSnapshot?.sharedSlotIdentityVerified === true
  };
}

function applyInitialCanvasBackingSize(canvas, size) {
  if (!canvas) return;
  canvas.width = size.backingWidth;
  canvas.height = size.backingHeight;
}

export function createUlgWorkerOffscreenPresentationBridge({
  requested = false,
  retainedGpuBufferHandoffRequested = requested,
  container = null,
  width = null,
  height = null,
  devicePixelRatio = globalThis.devicePixelRatio,
  backgroundColor = '#000000',
  clearAlpha = 0,
  workerFactory = null,
  windowRef = globalThis,
  navigatorRef = globalThis.navigator,
  onStatus = null,
  onRenderRowsStatus = null,
  onRetainedGpuBufferHandoffStatus = null,
  onResidentStageStatus = null,
  onRetainedCompactSnapshotStatus = null,
  onResidentRenderCandidate = null
} = {}) {
  const documentRef = container?.ownerDocument || windowRef?.document || globalThis.document || null;
  let currentBackgroundColor = backgroundColor;
  const requestedRetainedGpuBufferHandoff = Boolean(retainedGpuBufferHandoffRequested);
  const canvas = requested && typeof documentRef?.createElement === 'function'
    ? documentRef.createElement('canvas')
    : null;
  const size = resolveUlgWorkerOffscreenPresentationSize({
    container,
    width,
    height,
    devicePixelRatio
  });
  const publish = (nextStatus, { allowDisposed = false } = {}) => {
    if (bridge?.disposed && !allowDisposed) return bridge.status;
    const status = {
      schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
      transport: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
      displayHandoff: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
      rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
      frameCopyBackRejected: true,
      copiedBytesPerFrame: 0,
      copiedBytesPerSecond: 0,
      cssWidth: size.cssWidth,
      cssHeight: size.cssHeight,
      pixelRatio: size.pixelRatio,
      backingWidth: size.backingWidth,
      backingHeight: size.backingHeight,
      disposed: Boolean(bridge?.disposed),
      lifecycleGeneration: bridge?.lifecycleGeneration ?? 1,
      updatedAtMs: nowMs(),
      scientificValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false,
      ...nextStatus
    };
    bridge.status = status;
    onStatus?.(status);
    return status;
  };
  const disposedMutationStatus = (method) => ({
    ...(bridge?.status || {}),
    status: 'worker-offscreen-presentation-disposed-mutation-rejected',
    reason: `worker offscreen presentation is disposed; ${method} rejected`,
    disposed: true,
    lifecycleGeneration: bridge?.lifecycleGeneration ?? null,
    rejectedMutation: method
  });
  const bridge = {
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    canvas,
    worker: null,
    workerMessageHandler: null,
    workerErrorHandler: null,
    disposed: false,
    lifecycleGeneration: 1,
    status: null,
    renderRowsStatus: null,
    retainedGpuBufferHandoffStatus: null,
    residentStageStatus: null,
    retainedCompactSnapshotStatus: null,
    retainedCompactSnapshotRequestIdentity: null,
    retainedCompactSnapshotRejectedStaleCount: 0,
    committedResidentSchedulePresentationStatus: null,
    // W3: bridge-owned mirror of the presentation worker's resident-schedule
    // render-candidate lane. Fed by 'resident-schedule-candidate' worker
    // messages; the mailbox drops stale/duplicate versions with counters and
    // fails closed (TypeError) on malformed candidates — rejections are
    // counted below instead of crashing the worker message handler. The
    // optional onResidentRenderCandidate factory callback fires only for
    // accepted (newest-version) candidates.
    residentRenderCandidateMailbox: createResidentRenderCandidateMailbox({
      onCandidate: onResidentRenderCandidate
    }),
    residentRenderCandidateStreamIdentity: null,
    residentRenderCandidateRejectedCount: 0,
    displayOwner: requested ? 'worker' : 'none',
    displayOwnerEpoch: 0,
    displayOwnerReason: 'bridge-initialization',
    displayOwnerContentReady: false,
    displayOwnerContentFrameSerial: 0,
    displayOwnerPresentedSphStep: null,
    // Durable proof of the exact positive worker frame that currently owns
    // the canvas. `renderRowsStatus` is intentionally ephemeral (a later
    // stale draw rejection replaces it), so presentation admission must not
    // infer visible content from that last status alone.
    displayOwnerLastRenderedContent: null,
    // Exact positive candidate frame currently resident in the worker canvas,
    // independent of which compositor owner is visible. This lets a worker
    // handoff adopt pixels rendered while the native seed still owned display,
    // but only while the framebuffer counters remain unchanged.
    workerCanvasLastRenderedContent: null,
    // Monotonic bridge-owned identity for the pixels themselves. Unlike the
    // display-owner epoch, every destructive canvas operation advances this
    // even when ownership does not change.
    workerFramebufferEpoch: 1,
    // Queue-completion serials are allocated by one presentation-worker
    // lifecycle. Canvas clears, resizes, and owner handoffs invalidate pixels,
    // but they must not reset this replay floor while that worker is alive.
    workerFramebufferQueueCompletionSerialHighWater: 0,
    residentRenderProducerSourceCacheKey: null,
    residentRenderProducerSourceParticleCount: 0,
    residentRenderProducerSourceStrideFloats: 0,
    residentRenderProducerSourceByteLength: 0,
    residentParticleStateProducerCacheKey: null,
    residentParticleStateProducerParticleCount: 0,
    residentParticleStateProducerStateStrideFloats: 0,
    residentParticleStateProducerThermoStrideFloats: 0,
    residentParticleStateProducerStateByteLength: 0,
    residentParticleStateProducerThermoByteLength: 0,
    residentParticleStateProducerColorRowsByteLength: 0,
    clearResidentRenderProducerSourceCache() {
      if (this.disposed) return disposedMutationStatus('clearResidentRenderProducerSourceCache');
      this.residentRenderProducerSourceCacheKey = null;
      this.residentRenderProducerSourceParticleCount = 0;
      this.residentRenderProducerSourceStrideFloats = 0;
      this.residentRenderProducerSourceByteLength = 0;
    },
    clearResidentParticleStateProducerCache() {
      if (this.disposed) return disposedMutationStatus('clearResidentParticleStateProducerCache');
      this.residentParticleStateProducerCacheKey = null;
      this.residentParticleStateProducerParticleCount = 0;
      this.residentParticleStateProducerStateStrideFloats = 0;
      this.residentParticleStateProducerThermoStrideFloats = 0;
      this.residentParticleStateProducerStateByteLength = 0;
      this.residentParticleStateProducerThermoByteLength = 0;
      this.residentParticleStateProducerColorRowsByteLength = 0;
    },
    setDisplayOwner({
      owner = 'worker',
      epoch = null,
      reason = 'display-owner-update',
      revealWhenContentReady = owner === 'worker',
      expectedOwner = null,
      expectedEpoch = null,
      expectedLifecycleGeneration = null
    } = {}) {
      if (this.disposed) return disposedMutationStatus('setDisplayOwner');
      const normalizedOwner = owner === 'main-native'
        ? 'main-native'
        : (owner === 'worker' ? 'worker' : 'none');
      const requestedEpoch = epoch != null && Number.isFinite(Number(epoch))
        ? Math.max(0, Math.round(Number(epoch)))
        : (
          normalizedOwner === this.displayOwner
            ? this.displayOwnerEpoch
            : this.displayOwnerEpoch + 1
        );
      const ownerExpectationMatches = expectedOwner == null
        || expectedOwner === this.displayOwner;
      const epochExpectationMatches = expectedEpoch == null
        || Number(expectedEpoch) === this.displayOwnerEpoch;
      const lifecycleExpectationMatches = expectedLifecycleGeneration == null
        || Number(expectedLifecycleGeneration) === this.lifecycleGeneration;
      if (
        !ownerExpectationMatches
        || !epochExpectationMatches
        || !lifecycleExpectationMatches
      ) {
        return publish({
          ...(this.status || {}),
          status: 'worker-offscreen-display-owner-compare-and-swap-rejected',
          reason,
          displayOwner: this.displayOwner,
          displayOwnerEpoch: this.displayOwnerEpoch,
          lifecycleGeneration: this.lifecycleGeneration,
          expectedDisplayOwner: expectedOwner,
          expectedDisplayOwnerEpoch: expectedEpoch,
          expectedLifecycleGeneration,
          rejectedDisplayOwner: normalizedOwner,
          rejectedDisplayOwnerEpoch: requestedEpoch,
          displayCanvasVisible: this.canvas?.style?.visibility !== 'hidden'
        });
      }
      if (requestedEpoch < this.displayOwnerEpoch) {
        return publish({
          ...(this.status || {}),
          status: 'worker-offscreen-display-owner-stale-epoch-rejected',
          reason,
          displayOwner: this.displayOwner,
          displayOwnerEpoch: this.displayOwnerEpoch,
          rejectedDisplayOwner: normalizedOwner,
          rejectedDisplayOwnerEpoch: requestedEpoch,
          displayCanvasVisible: this.canvas?.style?.visibility !== 'hidden'
        });
      }
      const displayOwnerChanged = normalizedOwner !== this.displayOwner;
      this.displayOwner = normalizedOwner;
      this.displayOwnerEpoch = requestedEpoch;
      this.displayOwnerReason = reason;
      // An epoch refresh by the same presenter is not an ownership handoff.
      // Keep its last complete frame visible until the matching new-epoch
      // receipt arrives; hiding on every resident generation creates a blank
      // frame between each simulation update.
      if (displayOwnerChanged) {
        this.displayOwnerContentReady = normalizedOwner === 'main-native';
        this.displayOwnerPresentedSphStep = null;
        this.displayOwnerLastRenderedContent = null;
        if (normalizedOwner === 'main-native') {
          // The main-native handoff below posts a worker clear.
          this.workerCanvasLastRenderedContent = null;
        } else if (
          normalizedOwner === 'worker'
          && this.workerCanvasLastRenderedContent
          && Number(this.workerCanvasLastRenderedContent.frameCount)
            === Number(this.status?.frameCount)
          && Number(this.workerCanvasLastRenderedContent.readyFrameCount)
            === Number(this.status?.readyFrameCount)
        ) {
          this.displayOwnerContentReady = true;
          this.displayOwnerPresentedSphStep =
            this.workerCanvasLastRenderedContent.sphStep;
          this.displayOwnerLastRenderedContent =
            this.workerCanvasLastRenderedContent;
          this.displayOwnerContentFrameSerial += 1;
        }
      }
      const workerCanvasVisible = Boolean(
        normalizedOwner === 'worker'
        && (!revealWhenContentReady || this.displayOwnerContentReady)
      );
      setDisplayCanvasOwnedVisibility(this.canvas, workerCanvasVisible);
      if (normalizedOwner === 'main-native' && this.worker && displayOwnerChanged) {
        this.workerFramebufferEpoch += 1;
        this.workerCanvasLastRenderedContent = null;
        this.residentRenderCandidateMailbox.reset();
        this.residentRenderCandidateStreamIdentity = null;
        this.worker.postMessage?.({
          type: 'clear',
          backgroundColor: currentBackgroundColor,
          clearAlpha,
          displayOwnerEpoch: requestedEpoch,
          workerFramebufferEpoch: this.workerFramebufferEpoch,
          resetResidentScheduleCandidateMailbox: true,
          reason: `display-owner-main-native:${reason}`
        });
      }
      return publish({
        ...(this.status || {}),
        status: normalizedOwner === 'main-native'
          ? 'worker-offscreen-display-hidden-main-native-owner'
          : (workerCanvasVisible
            ? 'worker-offscreen-display-worker-content-visible'
            : 'worker-offscreen-display-worker-content-pending'),
        reason,
        displayOwner: normalizedOwner,
        displayOwnerEpoch: requestedEpoch,
        displayOwnerContentReady: this.displayOwnerContentReady,
        displayOwnerContentFrameSerial: this.displayOwnerContentFrameSerial,
        displayOwnerPresentedSphStep: this.displayOwnerPresentedSphStep,
        displayOwnerLastRenderedContent: this.displayOwnerLastRenderedContent,
        displayCanvasVisible: workerCanvasVisible
      });
    },
    publishRenderRowsStatus(nextStatus = {}) {
      if (this.disposed) return disposedMutationStatus('publishRenderRowsStatus');
      if (
        nextStatus?.schema === ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA
        && nextStatus?.sourceCacheStatus === 'source-cache-miss'
      ) {
        this.clearResidentRenderProducerSourceCache();
      }
      if (
        nextStatus?.schema === ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA
        && nextStatus?.sourceCacheStatus === 'resident-particle-state-cache-miss'
      ) {
        this.clearResidentParticleStateProducerCache();
      }
      const status = {
        schema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        status: 'worker-offscreen-render-rows-status',
        inputTransport: requested ? ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT : null,
        displayTransport: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
        displayHandoff: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
        rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
        frameCopyBackRejected: true,
        copiedBytesPerFrame: 0,
        copiedBytesPerSecond: 0,
        particleCount: 0,
        inputTransferBytes: 0,
        strideFloats: ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS,
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady),
        updatedAtMs: nowMs(),
        scientificValidation: false,
        sphValidation: false,
        fullPhysicsValidation: false,
        ...nextStatus
      };
      this.renderRowsStatus = status;
      onRenderRowsStatus?.(status);
      return status;
    },
    publishRetainedGpuBufferHandoffStatus(nextStatus = {}) {
      if (this.disposed) {
        return disposedMutationStatus('publishRetainedGpuBufferHandoffStatus');
      }
      const status = {
        schema: ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_HANDOFF_SCHEMA,
        status: 'worker-offscreen-retained-gpubuffer-handoff-status',
        requested: requestedRetainedGpuBufferHandoff,
        inputTransport: requestedRetainedGpuBufferHandoff
          ? ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_TRANSPORT
          : null,
        preferredReplacementTransport: requestedRetainedGpuBufferHandoff
          ? ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT
          : null,
        displayTransport: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
        displayHandoff: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
        rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
        frameCopyBackRejected: true,
        copiedBytesPerFrame: 0,
        copiedBytesPerSecond: 0,
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady),
        updatedAtMs: nowMs(),
        scientificValidation: false,
        sphValidation: false,
        fullPhysicsValidation: false,
        ...nextStatus
      };
      this.retainedGpuBufferHandoffStatus = status;
      onRetainedGpuBufferHandoffStatus?.(status);
      return status;
    },
    publishResidentStageStatus(nextStatus = {}) {
      if (this.disposed) return disposedMutationStatus('publishResidentStageStatus');
      const status = {
        schema: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA,
        status: 'worker-offscreen-resident-stage-on-presentation-device-status',
        inputTransport: requested
          ? ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT
          : null,
        displayTransport: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
        displayHandoff: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
        rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
        frameCopyBackRejected: true,
        copiedBytesPerFrame: 0,
        copiedBytesPerSecond: 0,
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady),
        updatedAtMs: nowMs(),
        scientificValidation: false,
        sphValidation: false,
        fullPhysicsValidation: false,
        ...nextStatus
      };
      this.residentStageStatus = status;
      onResidentStageStatus?.(status);
      return status;
    },
    publishRetainedCompactSnapshotStatus(nextStatus = {}) {
      if (this.disposed) {
        return disposedMutationStatus('publishRetainedCompactSnapshotStatus');
      }
      const identityMismatch = retainedCompactSnapshotIdentityMismatch(
        nextStatus,
        this.retainedCompactSnapshotRequestIdentity
      );
      if (identityMismatch) {
        this.retainedCompactSnapshotRejectedStaleCount += 1;
        const staleStatus = {
          schema: ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA,
          status:
            'presentation-worker-retained-compact-snapshot-stale-response-rejected',
          reason:
            `retained compact snapshot ${identityMismatch} does not match the active export request`,
          stale: true,
          identityMismatch,
          rejectedLaneId: nextStatus?.laneId ?? null,
          rejectedStateKey: nextStatus?.stateKey ?? null,
          rejectedCacheKey: nextStatus?.cacheKey ?? null,
          rejectedSourceStageId: nextStatus?.sourceStageId ?? null,
          activeRequestIdentity: this.retainedCompactSnapshotRequestIdentity,
          rejectedStaleCount: this.retainedCompactSnapshotRejectedStaleCount,
          compactBufferSnapshot: null,
          portableSnapshotAvailable: false,
          crossPeerReplayReady: false,
          updatedAtMs: nowMs(),
          scientificValidation: false,
          sphValidation: false,
          fullPhysicsValidation: false
        };
        onRetainedCompactSnapshotStatus?.(staleStatus);
        return staleStatus;
      }
      const status = {
        schema: ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA,
        status: 'presentation-worker-retained-compact-snapshot-export-status',
        compactBufferSnapshotSchema: ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
        displayTransport: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
        displayHandoff: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
        rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
        frameCopyBackRejected: true,
        copiedBytesPerFrame: 0,
        copiedBytesPerSecond: 0,
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady),
        portableSnapshotAvailable: false,
        crossPeerReplayReady: false,
        readbackByteLength: 0,
        updatedAtMs: nowMs(),
        scientificValidation: false,
        sphValidation: false,
        fullPhysicsValidation: false,
        ...nextStatus
      };
      this.retainedCompactSnapshotStatus = status;
      onRetainedCompactSnapshotStatus?.(status);
      return status;
    },
    resolveRetainedGpuBufferHandoff(next = {}) {
      if (this.disposed) return disposedMutationStatus('resolveRetainedGpuBufferHandoff');
      return this.publishRetainedGpuBufferHandoffStatus(
        resolveUlgWorkerOffscreenRetainedGpuBufferHandoffCapability({
          requested: requestedRetainedGpuBufferHandoff,
          presentationStatus: this.status,
          crossOriginIsolated: Boolean(windowRef?.crossOriginIsolated ?? globalThis.crossOriginIsolated),
          ...next
        })
      );
    },
    resize(next = {}) {
      if (this.disposed) return disposedMutationStatus('resize');
      const previousSize = { ...size };
      const nextSize = resolveUlgWorkerOffscreenPresentationSize({
        container,
        width: next.width ?? width,
        height: next.height ?? height,
        devicePixelRatio: next.devicePixelRatio ?? devicePixelRatio
      });
      const workerResizeRequired = Boolean(
        nextSize.backingWidth !== previousSize.backingWidth
        || nextSize.backingHeight !== previousSize.backingHeight
        || nextSize.cssWidth !== previousSize.cssWidth
        || nextSize.cssHeight !== previousSize.cssHeight
        || nextSize.pixelRatio !== previousSize.pixelRatio
      );
      Object.assign(size, nextSize);
      if (this.worker && workerResizeRequired) {
        // The worker's resize path reconfigures and clears the OffscreenCanvas.
        // Invalidate the exact content receipt before posting that operation;
        // a later positive render receipt is required to reveal it again.
        this.workerFramebufferEpoch += 1;
        this.workerCanvasLastRenderedContent = null;
        if (this.displayOwner === 'worker') {
          this.displayOwnerContentReady = false;
          this.displayOwnerPresentedSphStep = null;
          this.displayOwnerLastRenderedContent = null;
          setDisplayCanvasOwnedVisibility(this.canvas, false);
        }
        this.worker.postMessage?.({
          type: 'resize',
          width: nextSize.backingWidth,
          height: nextSize.backingHeight,
          cssWidth: nextSize.cssWidth,
          cssHeight: nextSize.cssHeight,
          pixelRatio: nextSize.pixelRatio,
          workerFramebufferEpoch: this.workerFramebufferEpoch,
          reason: next.reason || 'resize'
        });
      }
      return publish({
        ...(this.status || {}),
        status: workerResizeRequired
          ? (this.status?.status || 'worker-offscreen-presentation-resize-posted')
          : (this.status?.status || 'worker-offscreen-presentation-resize-not-required'),
        reason: next.reason || 'resize',
        workerResizeRequired,
        cssWidth: nextSize.cssWidth,
        cssHeight: nextSize.cssHeight,
        pixelRatio: nextSize.pixelRatio,
        backingWidth: nextSize.backingWidth,
        backingHeight: nextSize.backingHeight,
        displayOwnerContentReady: this.displayOwnerContentReady,
        displayOwnerContentFrameSerial: this.displayOwnerContentFrameSerial,
        displayOwnerPresentedSphStep: this.displayOwnerPresentedSphStep,
        displayOwnerLastRenderedContent: this.displayOwnerLastRenderedContent,
        displayCanvasVisible: this.canvas?.style?.visibility !== 'hidden'
      });
    },
    updatePreviewViewProjection(matrix, {
      reason = 'preview-camera-update',
      cameraPositionM = null
    } = {}) {
      // Fire-and-forget camera stream for whichever worker-owned geometry is
      // visible; deliberately no page status publication (it can run per
      // animation frame during drags).
      if (this.disposed || !this.worker || !matrix || Number(matrix.length) !== 16) {
        return null;
      }
      const normalizedCameraPosition =
        (Array.isArray(cameraPositionM) || ArrayBuffer.isView(cameraPositionM))
        && cameraPositionM.length === 3
        && Array.from(cameraPositionM, Number).every(Number.isFinite)
          ? Array.from(cameraPositionM, Number)
          : null;
      this.worker.postMessage?.({
        type: 'update-preview-view-projection',
        viewProjectionMatrix: matrix,
        ...(normalizedCameraPosition
          ? { cameraPositionM: normalizedCameraPosition }
          : {}),
        reason
      });
      return { status: 'worker-offscreen-preview-view-projection-posted', reason };
    },
    setBackgroundColor(color, { reason = 'background-color' } = {}) {
      if (this.disposed) return disposedMutationStatus('setBackgroundColor');
      currentBackgroundColor = color || currentBackgroundColor;
      if (this.worker) {
        this.workerFramebufferEpoch += 1;
        this.workerCanvasLastRenderedContent = null;
        if (this.displayOwner === 'worker') {
          this.displayOwnerContentReady = false;
          this.displayOwnerPresentedSphStep = null;
          this.displayOwnerLastRenderedContent = null;
          setDisplayCanvasOwnedVisibility(this.canvas, false);
        }
        this.worker.postMessage?.({
          type: 'clear',
          backgroundColor: currentBackgroundColor,
          clearAlpha,
          workerFramebufferEpoch: this.workerFramebufferEpoch,
          resetResidentScheduleCandidateMailbox: false,
          reason
        });
      }
      return publish({
        ...(this.status || {}),
        status: this.status?.status || 'worker-offscreen-presentation-clear-posted',
        reason,
        backgroundColor: color,
        displayOwnerContentReady: this.displayOwnerContentReady,
        displayOwnerContentFrameSerial: this.displayOwnerContentFrameSerial,
        displayOwnerPresentedSphStep: this.displayOwnerPresentedSphStep,
        displayOwnerLastRenderedContent: this.displayOwnerLastRenderedContent,
        displayCanvasVisible: this.canvas?.style?.visibility !== 'hidden'
      });
    },
    drawRenderRows({
      sphStep = null,
      boxDimsM = null,
      positionsM = null,
      colorsRgb = null,
      particleRadiiM = null,
      particlePhaseIds = null,
      viewProjectionMatrix = null,
      alpha = 0.92,
      fallbackColorRgb = [1, 1, 1],
      fallbackRadiusM = 0.02,
      radiusScalePx = 96,
      fallbackPointSizePx = 6,
      minPointSizePx = 2,
      maxPointSizePx = 22,
      reason = 'resident-render-rows-refresh'
    } = {}) {
      if (this.disposed) return disposedMutationStatus('drawRenderRows');
      if (!requested) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-render-rows-not-requested',
          reason
        });
      }
      if (!this.worker) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-render-rows-blocked-worker-unavailable',
          reason,
          canvasTransferred: Boolean(this.status?.canvasTransferred),
          workerReady: false
        });
      }
      const payload = packUlgWorkerOffscreenRenderRowsPayload({
        positionsM,
        colorsRgb,
        particleRadiiM,
        particlePhaseIds,
        alpha,
        fallbackColorRgb,
        fallbackRadiusM
      });
      if (payload.particleCount <= 0) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-render-rows-skipped-empty',
          reason,
          particleCount: 0,
          inputTransferBytes: 0
        });
      }
      const viewProjection = normalizeViewProjectionMatrix(viewProjectionMatrix);
      const presentationBoxDimsM = normalizePresentationBoxDimsM(boxDimsM);
      const inputTransferBytes = payload.byteLength + viewProjection.byteLength;
      this.worker.postMessage?.({
        type: 'draw-render-rows',
        displayOwnerEpoch: this.displayOwnerEpoch,
        workerFramebufferEpoch: this.workerFramebufferEpoch,
        sphStep: Number.isFinite(Number(sphStep)) ? Number(sphStep) : null,
        schema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        inputTransport: ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT,
        particleRows: payload.particleRows,
        particleCount: payload.particleCount,
        strideFloats: payload.strideFloats,
        viewProjectionMatrix: viewProjection,
        boxDimsM: presentationBoxDimsM,
        width: size.backingWidth,
        height: size.backingHeight,
        cssWidth: size.cssWidth,
        cssHeight: size.cssHeight,
        pixelRatio: size.pixelRatio,
        radiusScalePx: finiteNumber(radiusScalePx, 96),
        fallbackPointSizePx: finiteNumber(fallbackPointSizePx, 6),
        minPointSizePx: finiteNumber(minPointSizePx, 2),
        maxPointSizePx: finiteNumber(maxPointSizePx, 22),
        backgroundColor: currentBackgroundColor,
        clearAlpha,
        reason
      }, [payload.particleRows.buffer, viewProjection.buffer]);
      return this.publishRenderRowsStatus({
        status: 'worker-offscreen-render-rows-submit-posted',
        reason,
        particleCount: payload.particleCount,
        inputTransferBytes,
        inputTransport: ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT,
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady)
      });
    },
    drawResidentRenderProducer({
      sphStep = null,
      boxDimsM = null,
      positionsM = null,
      colorsRgb = null,
      particleRadiiM = null,
      particlePhaseIds = null,
      sourceCacheKey = null,
      viewProjectionMatrix = null,
      alpha = 0.92,
      fallbackColorRgb = [1, 1, 1],
      fallbackRadiusM = 0.02,
      radiusScalePx = 96,
      fallbackPointSizePx = 6,
      minPointSizePx = 2,
      maxPointSizePx = 22,
      reason = 'worker-owned-resident-render-producer-refresh'
    } = {}) {
      if (this.disposed) return disposedMutationStatus('drawResidentRenderProducer');
      if (!requested) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-render-producer-not-requested',
          reason,
          inputTransport: null
        });
      }
      if (!this.worker) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-render-producer-blocked-worker-unavailable',
          reason,
          inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
          canvasTransferred: Boolean(this.status?.canvasTransferred),
          workerReady: false
        });
      }
      const normalizedSourceCacheKey = residentRenderProducerPackedSourceCacheKey({
        sourceCacheKey,
        alpha,
        fallbackColorRgb,
        fallbackRadiusM
      });
      const expectedPayload = residentRenderProducerExpectedPayloadShape(positionsM);
      if (expectedPayload.particleCount <= 0) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-render-producer-skipped-empty',
          reason,
          inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
          particleCount: 0,
          inputTransferBytes: 0
        });
      }
      const viewProjection = normalizeViewProjectionMatrix(viewProjectionMatrix);
      const presentationBoxDimsM = normalizePresentationBoxDimsM(boxDimsM);
      let sourceCacheReusable = Boolean(
        normalizedSourceCacheKey
        && this.residentRenderProducerSourceCacheKey === normalizedSourceCacheKey
        && this.residentRenderProducerSourceParticleCount === expectedPayload.particleCount
        && this.residentRenderProducerSourceStrideFloats === expectedPayload.strideFloats
        && this.residentRenderProducerSourceByteLength === expectedPayload.byteLength
      );
      const payload = sourceCacheReusable
        ? null
        : packUlgWorkerOffscreenRenderRowsPayload({
            positionsM,
            colorsRgb,
            particleRadiiM,
            particlePhaseIds,
            alpha,
            fallbackColorRgb,
            fallbackRadiusM
          });
      if (payload && payload.particleCount <= 0) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-render-producer-skipped-empty',
          reason,
          inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
          particleCount: 0,
          inputTransferBytes: 0
        });
      }
      const particleCount = payload?.particleCount ?? expectedPayload.particleCount;
      const strideFloats = payload?.strideFloats ?? expectedPayload.strideFloats;
      const sourceByteLength = payload?.byteLength ?? expectedPayload.byteLength;
      sourceCacheReusable = Boolean(
        sourceCacheReusable
        && particleCount === expectedPayload.particleCount
        && strideFloats === expectedPayload.strideFloats
        && sourceByteLength === expectedPayload.byteLength
      );
      const inputTransferBytes = (
        sourceCacheReusable
          ? viewProjection.byteLength
          : sourceByteLength + viewProjection.byteLength
      );
      const message = {
        type: 'draw-resident-render-producer',
        displayOwnerEpoch: this.displayOwnerEpoch,
        workerFramebufferEpoch: this.workerFramebufferEpoch,
        sphStep: Number.isFinite(Number(sphStep)) ? Number(sphStep) : null,
        schema: ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA,
        renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
        sourceCacheKey: normalizedSourceCacheKey,
        sourceCacheStatus: sourceCacheReusable ? 'source-cache-reused' : 'source-cache-uploaded',
        reuseSourceCache: sourceCacheReusable,
        sourceRowsPacked: !sourceCacheReusable,
        particleCount,
        strideFloats,
        sourceRowsByteLength: sourceByteLength,
        viewProjectionMatrix: viewProjection,
        boxDimsM: presentationBoxDimsM,
        width: size.backingWidth,
        height: size.backingHeight,
        cssWidth: size.cssWidth,
        cssHeight: size.cssHeight,
        pixelRatio: size.pixelRatio,
        radiusScalePx: finiteNumber(radiusScalePx, 96),
        fallbackPointSizePx: finiteNumber(fallbackPointSizePx, 6),
        minPointSizePx: finiteNumber(minPointSizePx, 2),
        maxPointSizePx: finiteNumber(maxPointSizePx, 22),
        backgroundColor: currentBackgroundColor,
        clearAlpha,
        reason
      };
      const transferList = [viewProjection.buffer];
      if (!sourceCacheReusable) {
        message.sourceParticleRows = payload.particleRows;
        transferList.unshift(payload.particleRows.buffer);
        this.residentRenderProducerSourceCacheKey = normalizedSourceCacheKey;
        this.residentRenderProducerSourceParticleCount = particleCount;
        this.residentRenderProducerSourceStrideFloats = strideFloats;
        this.residentRenderProducerSourceByteLength = sourceByteLength;
      }
      this.worker.postMessage?.(message, transferList);
      return this.publishRenderRowsStatus({
        status: 'worker-offscreen-resident-render-producer-submit-posted',
        reason,
        schema: ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA,
        renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        particleCount,
        inputTransferBytes,
        inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
        sourceCacheKey: normalizedSourceCacheKey,
        sourceCacheStatus: sourceCacheReusable ? 'source-cache-reused' : 'source-cache-uploaded',
        sourceCacheHit: sourceCacheReusable,
        sourceRowsPacked: !sourceCacheReusable,
        sourceTransferBytes: sourceCacheReusable ? 0 : sourceByteLength,
        producerSourceTransport: sourceCacheReusable
          ? 'worker-resident-source-cache'
          : 'main-thread-visual-source-transfer',
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady)
      });
    },
    drawResidentParticleStateProducer({
      sphStep = null,
      boxDimsM = null,
      sphParticleState = null,
      materialColorRows = null,
      sourceCacheKey = null,
      sourceCacheKeyStrategy = null,
      sourceCpuStateStale = null,
      viewProjectionMatrix = null,
      alpha = 0.92,
      fallbackColorRgb = [1, 1, 1],
      fallbackRadiusM = 0.02,
      radiusScalePx = 96,
      fallbackPointSizePx = 6,
      minPointSizePx = 2,
      maxPointSizePx = 22,
      reason = 'worker-owned-resident-particle-state-producer-refresh'
    } = {}) {
      if (this.disposed) {
        return disposedMutationStatus('drawResidentParticleStateProducer');
      }
      if (!requested) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-particle-state-producer-not-requested',
          reason,
          inputTransport: null
        });
      }
      if (!this.worker) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-particle-state-producer-blocked-worker-unavailable',
          reason,
          schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
          inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
          canvasTransferred: Boolean(this.status?.canvasTransferred),
          workerReady: false
        });
      }
      const expected = residentParticleStateProducerExpectedPayloadShape({
        sphParticleState,
        materialColorRows
      });
      if (expected.particleCount <= 0 || expected.stateByteLength <= 0 || expected.thermoByteLength <= 0) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-particle-state-producer-skipped-empty',
          reason,
          schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
          inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
          particleCount: 0,
          inputTransferBytes: 0
        });
      }
      const normalizedSourceCacheKey = sourceCacheKey == null
        ? null
        : [
            String(sourceCacheKey),
            `alpha:${finiteNumber(alpha, 0.92)}`,
            `fallbackColor:${finiteNumber(fallbackColorRgb?.[0], 1)},${finiteNumber(fallbackColorRgb?.[1], 1)},${finiteNumber(fallbackColorRgb?.[2], 1)}`,
            `fallbackRadius:${finiteNumber(fallbackRadiusM, 0.02)}`
          ].join('|');
      const viewProjection = normalizeViewProjectionMatrix(viewProjectionMatrix);
      const presentationBoxDimsM = normalizePresentationBoxDimsM(boxDimsM);
      const sourceCacheReusable = Boolean(
        normalizedSourceCacheKey
        && this.residentParticleStateProducerCacheKey === normalizedSourceCacheKey
        && this.residentParticleStateProducerParticleCount === expected.particleCount
        && this.residentParticleStateProducerStateStrideFloats === expected.stateStrideFloats
        && this.residentParticleStateProducerThermoStrideFloats === expected.thermoStrideFloats
        && this.residentParticleStateProducerStateByteLength === expected.stateByteLength
        && this.residentParticleStateProducerThermoByteLength === expected.thermoByteLength
        && this.residentParticleStateProducerColorRowsByteLength === expected.colorRowsByteLength
      );
      const sourceCacheMissReason = sourceCacheReusable
        ? null
        : residentParticleStateProducerCacheMissReason(this, {
            normalizedSourceCacheKey,
            expected
          });
      const state = sourceCacheReusable
        ? null
        : new Float32Array(sphParticleState?.state || []);
      const thermo = sourceCacheReusable
        ? null
        : new Float32Array(sphParticleState?.thermo || []);
      if (!sourceCacheReusable && (
        state.byteLength < expected.stateByteLength
        || thermo.byteLength < expected.thermoByteLength
      )) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-particle-state-producer-skipped-incomplete-state',
          reason,
          schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
          inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
          particleCount: expected.particleCount,
          inputTransferBytes: 0,
          sourceCacheKey: normalizedSourceCacheKey,
          sourceCacheStatus: 'resident-particle-state-incomplete',
          sourceCacheKeyStrategy,
          sourceCpuStateStale,
          sourceCacheMissReason
        });
      }
      const sourceTransferBytes = sourceCacheReusable
        ? 0
        : state.byteLength + thermo.byteLength + expected.colorRowsByteLength;
      const inputTransferBytes = viewProjection.byteLength + sourceTransferBytes;
      const message = {
        type: 'draw-resident-particle-state-producer',
        displayOwnerEpoch: this.displayOwnerEpoch,
        workerFramebufferEpoch: this.workerFramebufferEpoch,
        sphStep: Number.isFinite(Number(sphStep)) ? Number(sphStep) : null,
        schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
        renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
        producerSourceKind: 'worker-resident-particle-state',
        sourceCacheKey: normalizedSourceCacheKey,
        sourceCacheStatus: sourceCacheReusable
          ? 'resident-particle-state-cache-reused'
          : 'resident-particle-state-uploaded',
        sourceCacheKeyStrategy,
        sourceCpuStateStale,
        sourceCacheMissReason,
        reuseSourceCache: sourceCacheReusable,
        sourceRowsPacked: false,
        particleCount: expected.particleCount,
        stateStrideFloats: expected.stateStrideFloats,
        thermoStrideFloats: expected.thermoStrideFloats,
        stateByteLength: expected.stateByteLength,
        thermoByteLength: expected.thermoByteLength,
        colorRowCount: expected.colorRowCount,
        colorRowsByteLength: expected.colorRowsByteLength,
        fallbackRadiusM: finiteNumber(fallbackRadiusM, 0.02),
        alpha: finiteNumber(alpha, 0.92),
        fallbackColorRgb: [
          finiteNumber(fallbackColorRgb?.[0], 1),
          finiteNumber(fallbackColorRgb?.[1], 1),
          finiteNumber(fallbackColorRgb?.[2], 1)
        ],
        viewProjectionMatrix: viewProjection,
        boxDimsM: presentationBoxDimsM,
        width: size.backingWidth,
        height: size.backingHeight,
        cssWidth: size.cssWidth,
        cssHeight: size.cssHeight,
        pixelRatio: size.pixelRatio,
        radiusScalePx: finiteNumber(radiusScalePx, 96),
        fallbackPointSizePx: finiteNumber(fallbackPointSizePx, 6),
        minPointSizePx: finiteNumber(minPointSizePx, 2),
        maxPointSizePx: finiteNumber(maxPointSizePx, 22),
        backgroundColor: currentBackgroundColor,
        clearAlpha,
        reason
      };
      const transferList = [viewProjection.buffer];
      if (!sourceCacheReusable) {
        // Transfer COPIES: state/thermo are the scene's authoritative packed
        // particle arrays. Transferring their live buffers detaches them on
        // the main thread (byteLength 0), and every runner that sizes GPU
        // output buffers from state.byteLength then allocates 4-byte buffers
        // and fails validation - this froze the post-adoption merged-set
        // continuation. colorRows may also be cached by the caller.
        const sourceStateCopy = state.slice();
        const sourceThermoCopy = thermo.slice();
        const materialColorRowsCopy = expected.colorRows.slice();
        message.sourceState = sourceStateCopy;
        message.sourceThermo = sourceThermoCopy;
        message.materialColorRows = materialColorRowsCopy;
        transferList.unshift(
          sourceStateCopy.buffer,
          sourceThermoCopy.buffer,
          materialColorRowsCopy.buffer
        );
        this.residentParticleStateProducerCacheKey = normalizedSourceCacheKey;
        this.residentParticleStateProducerParticleCount = expected.particleCount;
        this.residentParticleStateProducerStateStrideFloats = expected.stateStrideFloats;
        this.residentParticleStateProducerThermoStrideFloats = expected.thermoStrideFloats;
        this.residentParticleStateProducerStateByteLength = expected.stateByteLength;
        this.residentParticleStateProducerThermoByteLength = expected.thermoByteLength;
        this.residentParticleStateProducerColorRowsByteLength = expected.colorRowsByteLength;
      }
      this.worker.postMessage?.(message, transferList);
      return this.publishRenderRowsStatus({
        status: 'worker-offscreen-resident-particle-state-producer-submit-posted',
        reason,
        schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
        renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        particleCount: expected.particleCount,
        inputTransferBytes,
        inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
        producerSourceKind: 'worker-resident-particle-state',
        producerSourceTransport: sourceCacheReusable
          ? ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_CACHE_TRANSPORT
          : ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_TRANSPORT,
        sourceCacheKey: normalizedSourceCacheKey,
        sourceCacheStatus: sourceCacheReusable
          ? 'resident-particle-state-cache-reused'
          : 'resident-particle-state-uploaded',
        sourceCacheKeyStrategy,
        sourceCpuStateStale,
        sourceCacheMissReason,
        sourceCacheHit: sourceCacheReusable,
        sourceRowsPacked: false,
        sourceTransferBytes: 0,
        sourceStateTransferBytes: sourceTransferBytes,
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady)
      });
    },
    runResidentStageOnPresentationDevice({
      payload = null,
      reason = 'run-resident-stage-on-presentation-device'
    } = {}) {
      if (this.disposed) {
        return disposedMutationStatus('runResidentStageOnPresentationDevice');
      }
      if (!requested) {
        return this.publishResidentStageStatus({
          status: 'worker-offscreen-resident-stage-on-presentation-device-not-requested',
          reason,
          inputTransport: null
        });
      }
      if (!this.worker) {
        return this.publishResidentStageStatus({
          status: 'worker-offscreen-resident-stage-on-presentation-device-blocked-worker-unavailable',
          reason,
          workerReady: false
        });
      }
      const stagePayload = payload && typeof payload === 'object' ? payload : {};
      const message = {
        type: 'run-resident-stage-on-presentation-device',
        schema: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA,
        payload: stagePayload,
        reason
      };
      this.worker.postMessage?.(message);
      return this.publishResidentStageStatus({
        status: 'worker-offscreen-resident-stage-on-presentation-device-submit-posted',
        reason,
        stageId: stagePayload.stage?.id || null,
        laneId: stagePayload.lease?.laneId || stagePayload.lane?.laneId || null,
        stateKey: stagePayload.lease?.stateKey || stagePayload.lane?.stateKey || null,
        workerDeviceSource: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT,
        workerDeviceProvided: true
      });
    },
    // W4b: batched SS schedule on the presentation-worker device. Mirrors
    // runResidentStageOnPresentationDevice exactly but drives the worker's
    // 'run-resident-schedule-on-presentation-device' verb (W2 driver behind
    // the W3 message). Terminal truth arrives on the resident-stage status
    // channel as residentScheduleResult / residentScheduleError.
    runResidentScheduleOnPresentationDevice({
      payload = null,
      id = null,
      reason = 'run-resident-schedule-on-presentation-device'
    } = {}) {
      if (this.disposed) {
        return disposedMutationStatus('runResidentScheduleOnPresentationDevice');
      }
      if (!requested) {
        return this.publishResidentStageStatus({
          status: 'worker-offscreen-resident-schedule-on-presentation-device-not-requested',
          reason,
          inputTransport: null
        });
      }
      if (!this.worker) {
        return this.publishResidentStageStatus({
          status: 'worker-offscreen-resident-schedule-on-presentation-device-blocked-worker-unavailable',
          reason,
          workerReady: false
        });
      }
      const schedulePayload = payload && typeof payload === 'object' ? payload : {};
      this.worker.postMessage?.({
        type: 'run-resident-schedule-on-presentation-device',
        schema: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA,
        id: id ?? schedulePayload.schedule?.scheduleId ?? null,
        payload: schedulePayload,
        reason
      });
      return this.publishResidentStageStatus({
        status: 'worker-offscreen-resident-schedule-on-presentation-device-submit-posted',
        reason,
        scheduleId: schedulePayload.schedule?.scheduleId ?? id ?? null,
        stepCount: schedulePayload.schedule?.stepCount ?? null,
        laneId: schedulePayload.lease?.laneId || schedulePayload.lane?.laneId || null,
        stateKey: schedulePayload.lease?.stateKey || schedulePayload.lane?.stateKey || null,
        workerDeviceSource: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT,
        workerDeviceProvided: true
      });
    },
    presentCommittedResidentScheduleCandidate({
      workerLaneAuthority = null,
      reason = 'present-committed-resident-schedule-candidate'
    } = {}) {
      if (this.disposed) {
        return disposedMutationStatus(
          'presentCommittedResidentScheduleCandidate'
        );
      }
      const admission =
        buildUlgWorkerOffscreenCommittedResidentSchedulePresentationAdmission({
          workerLaneAuthority,
          reason
        });
      if (admission.ready !== true) {
        this.committedResidentSchedulePresentationStatus = admission;
        return admission;
      }
      if (!this.worker) {
        const blocked = Object.freeze({
          ...admission,
          status:
            'state-manager-committed-resident-schedule-presentation-blocked-worker-unavailable',
          ready: false
        });
        this.committedResidentSchedulePresentationStatus = blocked;
        return blocked;
      }
      const presentationAdmissionPostedAtMs = nowMs();
      this.worker.postMessage?.({
        type: 'present-committed-resident-schedule-candidate',
        ...admission,
        presentationAdmissionPostedAtMs
      });
      const posted = Object.freeze({
        ...admission,
        presentationAdmissionPostedAtMs,
        status:
          'state-manager-committed-resident-schedule-presentation-admission-posted'
      });
      this.committedResidentSchedulePresentationStatus = posted;
      return posted;
    },
    cancelResidentScheduleOnPresentationDevice({
      id = null,
      reason = 'cancel-resident-schedule-on-presentation-device'
    } = {}) {
      if (this.disposed) {
        return disposedMutationStatus('cancelResidentScheduleOnPresentationDevice');
      }
      if (!this.worker) {
        return this.publishResidentStageStatus({
          status: 'worker-offscreen-resident-schedule-cancel-blocked-worker-unavailable',
          reason,
          workerReady: false
        });
      }
      this.worker.postMessage?.({
        type: 'cancel-resident-schedule-on-presentation-device',
        id,
        reason
      });
      return this.publishResidentStageStatus({
        status: 'worker-offscreen-resident-schedule-cancel-posted',
        reason,
        scheduleId: id ?? null
      });
    },
    exportRetainedCompactSnapshot({
      laneId = null,
      stateKey = null,
      cacheKey = null,
      sourceStageId = 'g2p',
      particleCount = null,
      stateStrideFloats = null,
      thermoStrideFloats = null,
      mechanicsStrideFloats = null,
      step = null,
      time = null,
      dimension = 3,
      smoothingLengthM = 0,
      timeoutMs = null,
      localMaterializationSource = null,
      allowLocalMaterializationBypass = true,
      reason = 'export-retained-compact-snapshot'
    } = {}) {
      if (this.disposed) {
        return disposedMutationStatus('exportRetainedCompactSnapshot');
      }
      if (!requested) {
        return this.publishRetainedCompactSnapshotStatus({
          status: 'presentation-worker-retained-compact-snapshot-export-not-requested',
          reason,
          inputTransport: null
        });
      }
      this.retainedCompactSnapshotRequestIdentity =
        retainedCompactSnapshotRequestIdentity({
          laneId,
          stateKey,
          cacheKey,
          sourceStageId
        });
      // Beginning a new export is the reset boundary for the private payload.
      // Never keep the prior schedule's full typed arrays reachable while a
      // newer request is active.
      this.retainedCompactSnapshotStatus = null;
      const localMaterialization = allowLocalMaterializationBypass !== false
        ? retainedCompactSnapshotLocalMaterializationStatus({
            source: localMaterializationSource,
            laneId,
            stateKey,
            cacheKey,
            sourceStageId,
            particleCount,
            reason,
            workerDeviceProvided: Boolean(this.worker)
          })
        : null;
      if (localMaterialization) {
        return this.publishRetainedCompactSnapshotStatus(localMaterialization);
      }
      if (!this.worker) {
        return this.publishRetainedCompactSnapshotStatus({
          status: 'presentation-worker-retained-compact-snapshot-export-blocked-worker-unavailable',
          reason,
          laneId,
          stateKey,
          workerReady: false
        });
      }
      const message = {
        type: 'export-retained-compact-snapshot',
        schema: ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA,
        laneId,
        stateKey,
        cacheKey,
        sourceStageId,
        particleCount,
        stateStrideFloats,
        thermoStrideFloats,
        mechanicsStrideFloats,
        step,
        time,
        dimension,
        smoothingLengthM,
        timeoutMs,
        reason
      };
      this.worker.postMessage?.(message);
      return this.publishRetainedCompactSnapshotStatus({
        status: 'presentation-worker-retained-compact-snapshot-export-submit-posted',
        reason,
        laneId,
        stateKey,
        cacheKey,
        sourceStageId,
        particleCount,
        workerDeviceSource: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT,
        workerDeviceProvided: true
      });
    },
    dispose() {
      if (this.disposed) return this.status;
      const worker = this.worker;
      const messageHandler = this.workerMessageHandler;
      this.disposed = true;
      this.lifecycleGeneration += 1;
      this.residentRenderCandidateMailbox.reset({ resetCounters: true });
      this.residentRenderCandidateStreamIdentity = null;
      if (worker && messageHandler) {
        if (typeof worker.removeEventListener === 'function') {
          try { worker.removeEventListener('message', messageHandler); } catch {}
        } else if (worker.onmessage === messageHandler) {
          worker.onmessage = null;
        }
      }
      if (worker && worker.onerror === this.workerErrorHandler) {
        worker.onerror = null;
      }
      this.workerMessageHandler = null;
      this.workerErrorHandler = null;
      worker?.postMessage?.({ type: 'dispose', reason: 'scene-dispose' });
      worker?.terminate?.();
      if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
      this.worker = null;
      this.residentRenderProducerSourceCacheKey = null;
      this.residentRenderProducerSourceParticleCount = 0;
      this.residentRenderProducerSourceStrideFloats = 0;
      this.residentRenderProducerSourceByteLength = 0;
      this.residentParticleStateProducerCacheKey = null;
      this.residentParticleStateProducerParticleCount = 0;
      this.residentParticleStateProducerStateStrideFloats = 0;
      this.residentParticleStateProducerThermoStrideFloats = 0;
      this.residentParticleStateProducerStateByteLength = 0;
      this.residentParticleStateProducerThermoByteLength = 0;
      this.residentParticleStateProducerColorRowsByteLength = 0;
      this.displayOwnerContentReady = false;
      this.displayOwnerPresentedSphStep = null;
      this.displayOwnerLastRenderedContent = null;
      this.workerCanvasLastRenderedContent = null;
      this.workerFramebufferQueueCompletionSerialHighWater = 0;
      this.workerFramebufferEpoch = 0;
      this.committedResidentSchedulePresentationStatus = null;
      this.retainedCompactSnapshotStatus = null;
      this.retainedCompactSnapshotRequestIdentity = null;
      return publish({
        ...(this.status || {}),
        status: 'worker-offscreen-presentation-disposed',
        reason: 'scene-dispose',
        workerReady: false,
        disposed: true,
        lifecycleGeneration: this.lifecycleGeneration,
        workerOffscreenRetainedCompactSnapshot: null
      }, { allowDisposed: true });
    }
  };
  const capability = resolveUlgWorkerOffscreenPresentationCapability({
    requested,
    canvas,
    workerFactory,
    windowRef,
    navigatorRef
  });
  publish(capability);
  if (capability.status !== 'worker-offscreen-presentation-transfer-ready') {
    return bridge;
  }
  try {
    setDisplayCanvasStyle(canvas);
    canvas.setAttribute?.('aria-hidden', 'true');
    canvas.setAttribute?.('data-ulg-worker-offscreen-presentation', 'true');
    applyInitialCanvasBackingSize(canvas, size);
    container?.appendChild?.(canvas);
    const offscreenCanvas = canvas.transferControlToOffscreen();
    const workerCtor = resolveWorkerConstructor(workerFactory, windowRef);
    const worker = createWorkerFromFactory(
      workerCtor,
      new URL('../services/ulgOffscreenRender.worker.js', import.meta.url),
      { type: 'module', name: 'ulg-offscreen-render' }
    );
    bridge.worker = worker;
    // A fresh worker starts a fresh candidate-stream epoch namespace. The
    // bridge object outlives workers across page rebuilds, so its stream
    // identity/mailbox from the prior worker must not remain pinned — a
    // rebuilt lane re-entering at epoch 1 would otherwise fail the committed
    // receipt identity forever.
    bridge.residentRenderCandidateMailbox?.reset?.();
    bridge.residentRenderCandidateStreamIdentity = null;
    bridge.committedResidentSchedulePresentationStatus = null;
    bridge.workerFramebufferQueueCompletionSerialHighWater = 0;
    const workerLifecycleGeneration = bridge.lifecycleGeneration;
    const handleWorkerMessage = (event) => {
      if (
        bridge.disposed
        || bridge.lifecycleGeneration !== workerLifecycleGeneration
      ) return;
      let data = event?.data || {};
      // W3: resident-schedule render candidates arrive as their own message
      // type (not a presentation status envelope) and are arbitrated by the
      // bridge-owned versioned mailbox. Handled before the schema guard so
      // every existing status handler below stays untouched.
      if (data?.type === 'resident-schedule-candidate') {
        try {
          const presentationLaneEpoch = Number(
            data?.candidate?.presentationLaneEpoch
          );
          const laneId = nonEmptyString(
            data?.candidate?.laneId ?? data?.laneId
          );
          const stateKey = nonEmptyString(
            data?.candidate?.stateKey ?? data?.stateKey
          );
          if (
            !Number.isSafeInteger(presentationLaneEpoch)
            || presentationLaneEpoch <= 0
            || !laneId
            || !stateKey
          ) {
            throw new TypeError(
              'resident schedule candidate lacks an exact presentation lane identity'
            );
          }
          const activeStream = bridge.residentRenderCandidateStreamIdentity;
          if (
            activeStream
            && (
              presentationLaneEpoch < activeStream.presentationLaneEpoch
              || (
                presentationLaneEpoch === activeStream.presentationLaneEpoch
                && (
                  laneId !== activeStream.laneId
                  || stateKey !== activeStream.stateKey
                )
              )
            )
          ) {
            throw new TypeError(
              'resident schedule candidate belongs to an inactive presentation lane'
            );
          }
          if (
            !activeStream
            || presentationLaneEpoch > activeStream.presentationLaneEpoch
          ) {
            bridge.residentRenderCandidateMailbox.reset();
            bridge.residentRenderCandidateStreamIdentity = Object.freeze({
              presentationLaneEpoch,
              laneId,
              stateKey
            });
          }
          bridge.residentRenderCandidateMailbox.publish(data.candidate);
        } catch {
          // Fail-closed mailbox rejection (malformed candidate): counted,
          // never silently accepted, never allowed to crash the handler.
          bridge.residentRenderCandidateRejectedCount += 1;
        }
        return;
      }
      if (data?.schema !== ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA) return;
      const contentReceipt = data.workerOffscreenRenderRows || null;
      const exactFramebufferReceipt = Boolean(
        contentReceipt
        && /-rendered$/.test(String(contentReceipt.status || ''))
        && Math.max(0, Math.floor(Number(contentReceipt.particleCount) || 0)) > 0
        // Clear/resize envelopes can carry the prior render-row status while
        // advancing the actual presentation frame. Admit content only when
        // the nested receipt names the exact framebuffer represented by this
        // envelope; otherwise a cleared canvas could be falsely revealed.
        && Number.isFinite(Number(contentReceipt.frameCount))
        && Number(contentReceipt.frameCount) === Number(data.frameCount)
        && Number.isFinite(Number(contentReceipt.readyFrameCount))
        && Number(contentReceipt.readyFrameCount) === Number(data.readyFrameCount)
        && Number.isSafeInteger(Number(contentReceipt.workerFramebufferEpoch))
        && Number(contentReceipt.workerFramebufferEpoch)
          === bridge.workerFramebufferEpoch
      );
      const committedReceiptLaneEpoch = Number(
        contentReceipt?.presentationLaneEpoch
      );
      const committedReceiptLaneId = nonEmptyString(contentReceipt?.laneId);
      const committedReceiptStateKey = nonEmptyString(contentReceipt?.stateKey);
      if (
        contentReceipt?.stateManagerCommittedPresentation === true
        && Number.isSafeInteger(committedReceiptLaneEpoch)
        && committedReceiptLaneEpoch > 0
        && committedReceiptLaneId
        && committedReceiptStateKey
        && (
          !bridge.residentRenderCandidateStreamIdentity
          || committedReceiptLaneEpoch
            > bridge.residentRenderCandidateStreamIdentity.presentationLaneEpoch
        )
      ) {
        bridge.residentRenderCandidateMailbox.reset();
        bridge.residentRenderCandidateStreamIdentity = Object.freeze({
          presentationLaneEpoch: committedReceiptLaneEpoch,
          laneId: committedReceiptLaneId,
          stateKey: committedReceiptStateKey
        });
      }
      const committedReceiptAuthorityReady = Boolean(
        [
          ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
          ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA
        ].includes(contentReceipt?.schema)
        && contentReceipt?.renderRowsSchema
          === ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA
        && contentReceipt?.residentScheduleCandidatePresentation === true
        && contentReceipt?.stateManagerCommittedPresentation === true
        && contentReceipt?.committedPresentationSchema
          === ULG_WORKER_OFFSCREEN_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA
        && contentReceipt?.committedPresentationStatus
          === 'state-manager-committed-resident-schedule-presentation-admission'
        && nonEmptyString(contentReceipt?.scheduleId)
        && committedReceiptLaneId
        && committedReceiptStateKey
        && Number.isSafeInteger(committedReceiptLaneEpoch)
        && committedReceiptLaneEpoch > 0
        && committedReceiptLaneEpoch
          === Number(
            bridge.residentRenderCandidateStreamIdentity
              ?.presentationLaneEpoch
          )
        && committedReceiptLaneId
          === bridge.residentRenderCandidateStreamIdentity?.laneId
        && committedReceiptStateKey
          === bridge.residentRenderCandidateStreamIdentity?.stateKey
        && Number.isSafeInteger(Number(
          contentReceipt?.residentExecutionGeneration
        ))
        && Number(contentReceipt.residentExecutionGeneration) >= 0
        && Number.isSafeInteger(Number(contentReceipt?.sphStep))
        && Number(contentReceipt.sphStep) >= 0
        && Number.isSafeInteger(Number(contentReceipt?.stepOrdinal))
        && Number(contentReceipt.stepOrdinal) > 0
        && contentReceipt?.authorityStatus
          === 'state-manager-committed-worker-schedule'
        && contentReceipt?.computeManagerCompletionSchema
          === ULG_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA
        && nonEmptyString(contentReceipt?.computeManagerLeaseId)
        && contentReceipt?.computeManagerLeaseStatus === 'completed'
        && contentReceipt?.computeManagerFenceSatisfied === true
        && contentReceipt?.stateManagerCommitStatus === 'committed'
        && contentReceipt?.stateManagerCommitAccepted === true
        && contentReceipt?.terminalScheduleFence === true
        && contentReceipt?.terminalFenceScope === 'resident-schedule-terminal'
        && contentReceipt?.terminalFenceSatisfied === true
        && contentReceipt?.terminalFenceAuthorityAdmissionReady === true
      );
      const keyframePresentationProofReady =
        workerParticleKeyframePresentationProofReady(contentReceipt);
      const temporalMotionFrameClaimed = Boolean(
        contentReceipt?.motionFrameSchema != null
        || contentReceipt?.motionFrameAdmitted === true
        || (
          contentReceipt?.motionFrameSerial != null
          && Number.isSafeInteger(Number(contentReceipt.motionFrameSerial))
        )
      );
      const temporalMotionFrameProofReady =
        workerParticleTemporalMotionFrameBoundToSource(
          contentReceipt,
          bridge.workerCanvasLastRenderedContent
        );
      const legacyParticleCandidateReceiptReady = Boolean(
        exactFramebufferReceipt
        && committedReceiptAuthorityReady
        && contentReceipt.schema
          === ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA
        && contentReceipt.renderRowsSchema === ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA
        && contentReceipt.status
          === 'worker-offscreen-resident-particle-state-producer-rendered'
        && (
          (
            !temporalMotionFrameClaimed
            && keyframePresentationProofReady
          )
          || (
            temporalMotionFrameClaimed
            && temporalMotionFrameProofReady
          )
        )
        && contentReceipt.residentScheduleCandidatePresentation === true
        && contentReceipt.stateManagerCommittedPresentation === true
        && contentReceipt.committedPresentationSchema
          === ULG_WORKER_OFFSCREEN_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA
        && contentReceipt.committedPresentationStatus
          === 'state-manager-committed-resident-schedule-presentation-admission'
        && nonEmptyString(contentReceipt.scheduleId)
        && nonEmptyString(contentReceipt.laneId)
        && nonEmptyString(contentReceipt.stateKey)
        && Number.isSafeInteger(Number(
          contentReceipt.presentationLaneEpoch
        ))
        && Number(contentReceipt.presentationLaneEpoch) > 0
        && Number(contentReceipt.presentationLaneEpoch)
          === Number(
            bridge.residentRenderCandidateStreamIdentity
              ?.presentationLaneEpoch
          )
        && contentReceipt.laneId
          === bridge.residentRenderCandidateStreamIdentity?.laneId
        && contentReceipt.stateKey
          === bridge.residentRenderCandidateStreamIdentity?.stateKey
        && Number.isSafeInteger(Number(
          contentReceipt.residentExecutionGeneration
        ))
        && Number(contentReceipt.residentExecutionGeneration) >= 0
        && Number.isSafeInteger(Number(contentReceipt.stepOrdinal))
        && Number(contentReceipt.stepOrdinal) > 0
        && contentReceipt.authorityStatus
          === 'state-manager-committed-worker-schedule'
        && contentReceipt.computeManagerCompletionSchema
          === ULG_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA
        && nonEmptyString(contentReceipt.computeManagerLeaseId)
        && contentReceipt.computeManagerLeaseStatus === 'completed'
        && contentReceipt.computeManagerFenceSatisfied === true
        && contentReceipt.stateManagerCommitStatus === 'committed'
        && contentReceipt.stateManagerCommitAccepted === true
        && contentReceipt.terminalScheduleFence === true
        && contentReceipt.terminalFenceScope === 'resident-schedule-terminal'
        && contentReceipt.terminalFenceSatisfied === true
        && contentReceipt.terminalFenceAuthorityAdmissionReady === true
        && contentReceipt.producerSourceKind
          === 'worker-retained-resident-stage-output'
        && contentReceipt.producerSourceTransport
          === 'worker-retained-resident-stage-output'
        && contentReceipt.sourceStageId === 'schroederSameLevelMechanics'
        && contentReceipt.retainedParticleStateStatus
          === 'worker-retained-particle-state-ready'
      );
      const isosurfaceReceipt = Boolean(
        contentReceipt?.schema
          === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA
        && contentReceipt?.presentationGeometry
          === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY
      );
      const isosurfaceEnqueueReceiptReady = Boolean(
        committedReceiptAuthorityReady
        && isosurfaceReceipt
        && contentReceipt?.status
          === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
        && contentReceipt?.sourceCapturedBeforePhysicsContinuation === true
        && contentReceipt?.producerSourceKind
          === 'worker-retained-resident-stage-output'
        && contentReceipt?.producerSourceTransport
          === 'worker-retained-resident-stage-output'
        && contentReceipt?.sourceStageId === 'schroederSameLevelMechanics'
        && contentReceipt?.retainedParticleStateStatus
          === 'worker-retained-particle-state-ready'
      );
      const isosurfaceRenderedReceiptReady = Boolean(
        exactFramebufferReceipt
        && committedReceiptAuthorityReady
        && isosurfaceReceipt
        && workerIsosurfacePresentationProofReady(contentReceipt)
        && contentReceipt?.status
          === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
        && contentReceipt?.producerSourceKind
          === 'worker-retained-resident-stage-output'
        && contentReceipt?.producerSourceTransport
          === 'worker-retained-resident-stage-output'
        && contentReceipt?.sourceStageId === 'schroederSameLevelMechanics'
        && contentReceipt?.retainedParticleStateStatus
          === 'worker-retained-particle-state-ready'
      );
      const candidateReceiptReady = Boolean(
        legacyParticleCandidateReceiptReady
        || isosurfaceRenderedReceiptReady
      );
      const committedPresentationTerminalReceipt = Boolean(
        committedReceiptAuthorityReady
        && (
          (
            contentReceipt.status
              === 'worker-offscreen-resident-particle-state-producer-rendered'
            && exactFramebufferReceipt
          )
          || isosurfaceEnqueueReceiptReady
          || isosurfaceRenderedReceiptReady
          || /(?:blocked|failed|superseded)/.test(
            String(contentReceipt.status || '')
          )
        )
      );
      const committedPresentationReceiptCurrent =
        committedPresentationReceiptCanAdvance(
          bridge.committedResidentSchedulePresentationStatus,
          contentReceipt
        );
      const committedPresentationFramebufferCurrent = Boolean(
        candidateReceiptReady
        && committedPresentationReceiptCurrent
        && committedPresentationFramebufferCanAdvance(
          bridge.workerCanvasLastRenderedContent,
          contentReceipt,
          bridge.workerFramebufferQueueCompletionSerialHighWater
        )
      );
      if (
        committedPresentationTerminalReceipt
        && committedPresentationReceiptCurrent
      ) {
        bridge.committedResidentSchedulePresentationStatus = Object.freeze({
          ...contentReceipt
        });
      }
      // Diagnostic ring: a committed-presentation receipt that fails one of
      // the conjunctions above is otherwise invisible (the page's wait sees
      // nothing and burns its full timeout). Record every evaluation of a
      // receipt that CLAIMS committed presentation so a probe can name the
      // failing term.
      if (
        contentReceipt?.stateManagerCommittedPresentation === true
        || /committed-resident-schedule-presentation/.test(
          String(contentReceipt?.status || '')
        )
      ) {
        const ring = (globalThis.__ulgCommittedPresentationReceiptTrace ||= []);
        ring.push({
          atMs: Math.round(
            (globalThis.performance?.now?.() ?? Date.now())
          ),
          status: contentReceipt?.status ?? null,
          reason: contentReceipt?.reason ?? null,
          sphStep: contentReceipt?.sphStep ?? null,
          stepOrdinal: contentReceipt?.stepOrdinal ?? null,
          scheduleId: contentReceipt?.scheduleId ?? null,
          laneId: contentReceipt?.laneId ?? null,
          presentationLaneEpoch: contentReceipt?.presentationLaneEpoch ?? null,
          streamLaneEpoch:
            bridge.residentRenderCandidateStreamIdentity
              ?.presentationLaneEpoch ?? null,
          streamLaneId:
            bridge.residentRenderCandidateStreamIdentity?.laneId ?? null,
          residentExecutionGeneration:
            contentReceipt?.residentExecutionGeneration ?? null,
          exactFramebufferReceipt,
          workerFramebufferEpoch: contentReceipt?.workerFramebufferEpoch ?? null,
          expectedWorkerFramebufferEpoch: bridge.workerFramebufferEpoch,
          committedReceiptAuthorityReady,
          isosurfaceEnqueueReceiptReady,
          isosurfaceRenderedReceiptReady,
          candidateReceiptReady,
          committedPresentationTerminalReceipt,
          committedPresentationReceiptCurrent,
          committedPresentationFramebufferCurrent
        });
        if (ring.length > 32) ring.splice(0, ring.length - 32);
      }
      const compactContentReceipt = exactFramebufferReceipt
        ? Object.freeze({
            schema: contentReceipt.schema ?? null,
            renderRowsSchema: contentReceipt.renderRowsSchema ?? null,
            status: contentReceipt.status ?? null,
            sphStep: Number.isFinite(Number(contentReceipt.sphStep))
              ? Number(contentReceipt.sphStep)
              : null,
            particleCount: Math.max(
              0,
              Math.floor(Number(contentReceipt.particleCount) || 0)
            ),
            frameCount: Number(contentReceipt.frameCount),
            readyFrameCount: Number(contentReceipt.readyFrameCount),
            workerFramebufferEpoch:
              Number(contentReceipt.workerFramebufferEpoch),
            displayOwnerEpoch: Number.isFinite(Number(contentReceipt.displayOwnerEpoch))
              ? Number(contentReceipt.displayOwnerEpoch)
              : bridge.displayOwnerEpoch,
            residentScheduleCandidatePresentation:
              contentReceipt.residentScheduleCandidatePresentation === true,
            stateManagerCommittedPresentation:
              contentReceipt.stateManagerCommittedPresentation === true,
            committedPresentationSchema:
              contentReceipt.committedPresentationSchema ?? null,
            committedPresentationStatus:
              contentReceipt.committedPresentationStatus ?? null,
            scheduleId: contentReceipt.scheduleId ?? null,
            laneId: contentReceipt.laneId ?? null,
            stateKey: contentReceipt.stateKey ?? null,
            presentationLaneEpoch:
              Number.isSafeInteger(Number(
                contentReceipt.presentationLaneEpoch
              ))
                ? Number(contentReceipt.presentationLaneEpoch)
                : null,
            residentExecutionGeneration:
              Number.isSafeInteger(Number(
                contentReceipt.residentExecutionGeneration
              ))
                ? Number(contentReceipt.residentExecutionGeneration)
                : null,
            stepOrdinal: Number.isSafeInteger(Number(contentReceipt.stepOrdinal))
              ? Number(contentReceipt.stepOrdinal)
              : null,
            ...(Number.isSafeInteger(Number(contentReceipt.requestGeneration))
              && Number(contentReceipt.requestGeneration) > 0
              ? {
                  requestGeneration: Number(contentReceipt.requestGeneration)
                }
              : {}),
            ...(contentReceipt.presentationFrameSchema
              === ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_KEYFRAME_PRESENTATION_FRAME_SCHEMA
              ? {
                  presentationFrameSchema:
                    contentReceipt.presentationFrameSchema,
                  presentationFrameStatus:
                    contentReceipt.presentationFrameStatus ?? null,
                  presentationFrameAdmitted:
                    contentReceipt.presentationFrameAdmitted === true,
                  presentationFrameGpuCompleted:
                    contentReceipt.presentationFrameGpuCompleted === true,
                  presentationFrameGpuCompletedAtMs:
                    Number.isFinite(Number(
                      contentReceipt.presentationFrameGpuCompletedAtMs
                    ))
                      ? Number(contentReceipt.presentationFrameGpuCompletedAtMs)
                      : null,
                  presentationFramePresentationOpportunity:
                    contentReceipt.presentationFramePresentationOpportunity
                      === true,
                  presentationFramePresentationOpportunityMethod:
                    contentReceipt
                      .presentationFramePresentationOpportunityMethod ?? null,
                  presentationFrameSubmitToGpuCompleteMs:
                    Number.isFinite(Number(
                      contentReceipt.presentationFrameSubmitToGpuCompleteMs
                    ))
                      ? Number(
                          contentReceipt.presentationFrameSubmitToGpuCompleteMs
                        )
                      : null,
                  presentationFrameSubmitToPresentationOpportunityMs:
                    Number.isFinite(Number(
                      contentReceipt
                        .presentationFrameSubmitToPresentationOpportunityMs
                    ))
                      ? Number(
                          contentReceipt
                            .presentationFrameSubmitToPresentationOpportunityMs
                        )
                      : null,
                  presentationQueueCompletionCount:
                    Number.isSafeInteger(Number(
                      contentReceipt.presentationQueueCompletionCount
                    ))
                      ? Number(
                          contentReceipt.presentationQueueCompletionCount
                        )
                      : null,
                  presentationQueueCompletionSerial:
                    Number.isSafeInteger(Number(
                      contentReceipt.presentationQueueCompletionSerial
                    ))
                      ? Number(contentReceipt.presentationQueueCompletionSerial)
                      : null,
                  presentationQueueCompletionMethod:
                    contentReceipt.presentationQueueCompletionMethod ?? null,
                  presentationQueueCompletionScope:
                    contentReceipt.presentationQueueCompletionScope
                      ?? null,
                  physicsQueuePrefixCoverage:
                    contentReceipt.physicsQueuePrefixCoverage ?? null,
                  physicsHostQueueFenceParticipation:
                    typeof contentReceipt.physicsHostQueueFenceParticipation
                      === 'boolean'
                      ? contentReceipt.physicsHostQueueFenceParticipation
                      : null
                }
              : {}),
            ...(contentReceipt.presentationFrameSchema
              === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA
              ? {
                  presentationFrameSchema:
                    contentReceipt.presentationFrameSchema,
                  presentationFrameStatus:
                    contentReceipt.presentationFrameStatus ?? null,
                  presentationFrameAdmitted:
                    contentReceipt.presentationFrameAdmitted === true,
                  presentationFrameGpuCompleted:
                    contentReceipt.presentationFrameGpuCompleted === true,
                  presentationFrameGpuCompletionMethod:
                    contentReceipt.presentationFrameGpuCompletionMethod
                    ?? null,
                  presentationFramePresentationOpportunity:
                    contentReceipt.presentationFramePresentationOpportunity
                      === true,
                  presentationFramePresentationOpportunityMethod:
                    contentReceipt
                      .presentationFramePresentationOpportunityMethod ?? null,
                  presentationFrameSubmitToGpuCompleteMs:
                    Number.isFinite(Number(
                      contentReceipt.presentationFrameSubmitToGpuCompleteMs
                    ))
                      ? Number(
                          contentReceipt.presentationFrameSubmitToGpuCompleteMs
                        )
                      : null,
                  presentationFrameSubmitToPresentationOpportunityMs:
                    Number.isFinite(Number(
                      contentReceipt
                        .presentationFrameSubmitToPresentationOpportunityMs
                    ))
                      ? Number(
                          contentReceipt
                            .presentationFrameSubmitToPresentationOpportunityMs
                        )
                      : null,
                  presentationQueueCompletionCount:
                    Number.isSafeInteger(Number(
                      contentReceipt.presentationQueueCompletionCount
                    ))
                      ? Number(contentReceipt.presentationQueueCompletionCount)
                      : null,
                  presentationQueueCompletionSerial:
                    Number.isSafeInteger(Number(
                      contentReceipt.presentationQueueCompletionSerial
                    ))
                      ? Number(contentReceipt.presentationQueueCompletionSerial)
                      : null,
                  presentationQueueCompletionMethod:
                    contentReceipt.presentationQueueCompletionMethod ?? null,
                  presentationQueueCompletionScope:
                    contentReceipt.presentationQueueCompletionScope ?? null,
                  physicsQueuePrefixCoverage:
                    contentReceipt.physicsQueuePrefixCoverage ?? null,
                  physicsHostQueueFenceParticipation:
                    typeof contentReceipt.physicsHostQueueFenceParticipation
                      === 'boolean'
                      ? contentReceipt.physicsHostQueueFenceParticipation
                      : null,
                  workerOwnedOpticalPresentation:
                    compactWorkerOwnedOpticalPresentation(
                      contentReceipt.workerOwnedOpticalPresentation
                    )
                }
              : {}),
            ...(temporalMotionFrameProofReady
              ? {
                  motionFrameSchema: contentReceipt.motionFrameSchema ?? null,
                  motionFrameStatus: contentReceipt.motionFrameStatus ?? null,
                  motionFrameAdmitted: true,
                  motionFrameGpuCompleted: true,
                  motionFramePresentationOpportunity: true,
                  motionFramePresentationOpportunityMethod:
                    contentReceipt.motionFramePresentationOpportunityMethod
                    ?? null,
                  motionFrameSerial: Number(contentReceipt.motionFrameSerial),
                  motionFrameSubmittedSerial:
                    Number.isSafeInteger(Number(
                      contentReceipt.motionFrameSubmittedSerial
                    ))
                      ? Number(contentReceipt.motionFrameSubmittedSerial)
                      : null,
                  motionSourceFrameCount:
                    Number.isSafeInteger(Number(
                      contentReceipt.motionSourceFrameCount
                    ))
                      ? Number(contentReceipt.motionSourceFrameCount)
                      : null,
                  motionSourceSphStep:
                    Number.isSafeInteger(Number(
                      contentReceipt.motionSourceSphStep
                    ))
                      ? Number(contentReceipt.motionSourceSphStep)
                      : null,
                  motionAgeS: Number.isFinite(Number(contentReceipt.motionAgeS))
                    ? Number(contentReceipt.motionAgeS)
                    : null,
                  motionAgeSource: contentReceipt.motionAgeSource ?? null,
                  motionHorizonS:
                    Number.isFinite(Number(contentReceipt.motionHorizonS))
                      ? Number(contentReceipt.motionHorizonS)
                      : null,
                  motionSimulationTimeScale:
                    Number.isFinite(Number(
                      contentReceipt.motionSimulationTimeScale
                    ))
                      ? Number(contentReceipt.motionSimulationTimeScale)
                      : null,
                  motionMaxSimulationAgeS:
                    Number.isFinite(Number(
                      contentReceipt.motionMaxSimulationAgeS
                    ))
                      ? Number(contentReceipt.motionMaxSimulationAgeS)
                      : null,
                  motionMaxDisplacementM:
                    Number.isFinite(Number(
                      contentReceipt.motionMaxDisplacementM
                    ))
                      ? Number(contentReceipt.motionMaxDisplacementM)
                      : null,
                  motionTargetHz:
                    Number.isFinite(Number(contentReceipt.motionTargetHz))
                      ? Number(contentReceipt.motionTargetHz)
                      : null,
                  motionMethod: contentReceipt.motionMethod ?? null,
                  motionVelocityBufferRetained:
                    contentReceipt.motionVelocityBufferRetained === true,
                  ...(contentReceipt.motionPresentationQosBoundary
                    && typeof contentReceipt.motionPresentationQosBoundary
                      === 'object'
                    ? {
                        motionPresentationQosBoundary: Object.freeze({
                          submissionOrdinal: Number(
                            contentReceipt.motionPresentationQosBoundary
                              .submissionOrdinal
                          ),
                          completedSubstepCount: Number(
                            contentReceipt.motionPresentationQosBoundary
                              .completedSubstepCount
                          ),
                          totalSubstepCount: Number(
                            contentReceipt.motionPresentationQosBoundary
                              .totalSubstepCount
                          ),
                          chunkStepCount: Number(
                            contentReceipt.motionPresentationQosBoundary
                              .chunkStepCount
                          )
                        })
                      }
                    : {}),
                  motionSubmitToGpuCompleteMs:
                    Number.isFinite(Number(
                      contentReceipt.motionSubmitToGpuCompleteMs
                    ))
                      ? Number(contentReceipt.motionSubmitToGpuCompleteMs)
                      : null,
                  motionSubmitToPresentationOpportunityMs:
                    Number.isFinite(Number(
                      contentReceipt.motionSubmitToPresentationOpportunityMs
                    ))
                      ? Number(
                          contentReceipt
                            .motionSubmitToPresentationOpportunityMs
                        )
                      : null
                }
              : {}),
            authorityStatus: contentReceipt.authorityStatus ?? null,
            computeManagerCompletionSchema:
              contentReceipt.computeManagerCompletionSchema ?? null,
            computeManagerLeaseId:
              contentReceipt.computeManagerLeaseId ?? null,
            computeManagerLeaseStatus:
              contentReceipt.computeManagerLeaseStatus ?? null,
            computeManagerFenceSatisfied:
              contentReceipt.computeManagerFenceSatisfied === true,
            stateManagerCommitStatus:
              contentReceipt.stateManagerCommitStatus ?? null,
            stateManagerCommitAccepted:
              contentReceipt.stateManagerCommitAccepted === true,
            terminalScheduleFence:
              contentReceipt.terminalScheduleFence === true,
            terminalFenceScope:
              contentReceipt.terminalFenceScope ?? null,
            terminalFenceSatisfied:
              contentReceipt.terminalFenceSatisfied === true,
            terminalFenceAuthorityAdmissionReady:
              contentReceipt.terminalFenceAuthorityAdmissionReady === true,
            producerSourceKind: contentReceipt.producerSourceKind ?? null,
            producerSourceTransport: contentReceipt.producerSourceTransport ?? null,
            sourceStageId: contentReceipt.sourceStageId ?? null,
            retainedParticleStateStatus:
              contentReceipt.retainedParticleStateStatus ?? null,
            workerLocalRenderRowsProduced:
              contentReceipt.workerLocalRenderRowsProduced === true,
            ...(typeof contentReceipt.presentationGeometry === 'string'
              ? {
                  presentationGeometry: contentReceipt.presentationGeometry,
                  particleImpostorShape:
                    contentReceipt.particleImpostorShape ?? null,
                  particleImpostorPassCount: Math.max(
                    0,
                    Math.floor(Number(contentReceipt.particleImpostorPassCount) || 0)
                  ),
                  projectiveParticleSizing:
                    contentReceipt.projectiveParticleSizing === true,
                  particleDepthModel:
                    contentReceipt.particleDepthModel ?? null,
                  depthAttachmentFormat:
                    contentReceipt.depthAttachmentFormat ?? null,
                  depthAttachmentReady:
                    contentReceipt.depthAttachmentReady === true,
                  condensedDepthTestEnabled:
                    contentReceipt.condensedDepthTestEnabled === true,
                  condensedDepthWriteEnabled:
                    contentReceipt.condensedDepthWriteEnabled === true,
                  vaporDepthTestEnabled:
                    contentReceipt.vaporDepthTestEnabled === true,
                  vaporDepthWriteEnabled:
                    contentReceipt.vaporDepthWriteEnabled === true,
                  boxWireframeDrawCount: Math.max(
                    0,
                    Math.floor(Number(contentReceipt.boxWireframeDrawCount) || 0)
                  ),
                  boxDimsM: normalizePresentationBoxDimsM(
                    contentReceipt.boxDimsM
                  ),
                  ...(contentReceipt.presentationGeometry
                    === 'worker-owned-true-isosurface'
                    ? {
                        surfaceCount: Math.max(
                          0,
                          Math.floor(Number(contentReceipt.surfaceCount) || 0)
                        ),
                        indirectDrawCount: Math.max(
                          0,
                          Math.floor(
                            Number(contentReceipt.indirectDrawCount) || 0
                          )
                        )
                      }
                    : {}),
                  sameDevicePresentation:
                    contentReceipt.sameDevicePresentation === true
                }
              : {}),
            ...(typeof contentReceipt.residentSchedulePresentationMode === 'string'
              ? {
                  residentSchedulePresentationMode:
                    contentReceipt.residentSchedulePresentationMode
                }
              : {}),
            ...(contentReceipt.committedPresentationPromotedWithoutRedraw === true
              ? { committedPresentationPromotedWithoutRedraw: true }
              : {}),
            ...(Number.isFinite(Number(
              contentReceipt.presentationAdmissionPostedAtMs
            ))
              ? {
                  presentationAdmissionPostedAtMs:
                    Number(contentReceipt.presentationAdmissionPostedAtMs)
                }
              : {}),
            ...(Number.isFinite(Number(contentReceipt.updatedAtMs))
              ? {
                  workerPresentationUpdatedAtMs:
                    Number(contentReceipt.updatedAtMs),
                  bridgePresentationReceivedAtMs: nowMs()
                }
              : {})
          })
        : null;
      if (committedPresentationFramebufferCurrent) {
        bridge.workerCanvasLastRenderedContent = compactContentReceipt;
        const acceptedQueueCompletionSerial = Number(
          contentReceipt?.presentationQueueCompletionSerial
        );
        if (
          Number.isSafeInteger(acceptedQueueCompletionSerial)
          && acceptedQueueCompletionSerial > 0
        ) {
          bridge.workerFramebufferQueueCompletionSerialHighWater = Math.max(
            bridge.workerFramebufferQueueCompletionSerialHighWater,
            acceptedQueueCompletionSerial
          );
        }
        if (committedPresentationReceiptCurrent) {
          bridge.committedResidentSchedulePresentationStatus =
            compactContentReceipt;
        }
      }
      const contentReceiptReady = Boolean(
        exactFramebufferReceipt
        && (
          (
            contentReceipt.residentScheduleCandidatePresentation !== true
            && Number(contentReceipt.displayOwnerEpoch)
              === bridge.displayOwnerEpoch
          )
          // W4b: only the exact post-StateManager-commit candidate receipt may
          // bypass the page epoch. Raw progress/terminal candidate markers are
          // telemetry and can never reveal pixels.
          || (
            committedPresentationFramebufferCurrent
          )
        )
        && bridge.displayOwner === 'worker'
      );
      if (contentReceiptReady) {
        bridge.displayOwnerContentReady = true;
        bridge.displayOwnerContentFrameSerial += 1;
        bridge.displayOwnerPresentedSphStep = Number.isFinite(Number(contentReceipt.sphStep))
          ? Number(contentReceipt.sphStep)
          : null;
        bridge.displayOwnerLastRenderedContent = compactContentReceipt;
        setDisplayCanvasOwnedVisibility(canvas, true);
      }
      if (
        data.workerOffscreenRenderRows?.schema === ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA
        || data.workerOffscreenRenderRows?.schema === ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA
        || data.workerOffscreenRenderRows?.schema === ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA
        || data.workerOffscreenRenderRows?.schema === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA
      ) {
        bridge.publishRenderRowsStatus(data.workerOffscreenRenderRows);
      }
      if (
        data.workerOffscreenResidentStage?.schema
        === ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA
      ) {
        bridge.publishResidentStageStatus(data.workerOffscreenResidentStage);
      }
      if (
        data.workerOffscreenRetainedCompactSnapshot?.schema
        === ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA
      ) {
        const retainedCompactSnapshotStatus =
          bridge.publishRetainedCompactSnapshotStatus(
            data.workerOffscreenRetainedCompactSnapshot
          );
        data = {
          ...data,
          ...(retainedCompactSnapshotStatus?.stale === true
            ? {
                status: retainedCompactSnapshotStatus.status,
                reason: retainedCompactSnapshotStatus.reason
              }
            : {}),
          workerOffscreenRetainedCompactSnapshot:
            compactRetainedCompactSnapshotPublicStatus(
              retainedCompactSnapshotStatus
            )
        };
      }
      publish({
        ...data,
        requested: true,
        canvasTransferred: true,
        displayOwner: bridge.displayOwner,
        displayOwnerEpoch: bridge.displayOwnerEpoch,
        displayOwnerContentReady: bridge.displayOwnerContentReady,
        displayOwnerContentFrameSerial: bridge.displayOwnerContentFrameSerial,
        displayOwnerPresentedSphStep: bridge.displayOwnerPresentedSphStep,
        displayOwnerLastRenderedContent: bridge.displayOwnerLastRenderedContent,
        displayCanvasVisible: canvas?.style?.visibility !== 'hidden'
      });
    };
    bridge.workerMessageHandler = handleWorkerMessage;
    if (typeof worker.addEventListener === 'function') {
      worker.addEventListener('message', handleWorkerMessage);
    } else {
      worker.onmessage = handleWorkerMessage;
    }
    const handleWorkerError = (event) => {
      if (
        bridge.disposed
        || bridge.lifecycleGeneration !== workerLifecycleGeneration
      ) return;
      publish({
        status: 'worker-offscreen-presentation-worker-error',
        reason: event?.message || 'worker-owned presentation worker error',
        requested: true,
        canvasTransferred: true,
        workerReady: false
      });
    };
    bridge.workerErrorHandler = handleWorkerError;
    worker.onerror = handleWorkerError;
    worker.postMessage({
      type: 'init-offscreen-presentation',
      canvas: offscreenCanvas,
      width: size.backingWidth,
      height: size.backingHeight,
      cssWidth: size.cssWidth,
      cssHeight: size.cssHeight,
      pixelRatio: size.pixelRatio,
      backgroundColor: currentBackgroundColor,
      clearAlpha,
      workerFramebufferEpoch: bridge.workerFramebufferEpoch
    }, [offscreenCanvas]);
    publish({
      status: 'worker-offscreen-presentation-transfer-submitted',
      reason: null,
      requested: true,
      canvasTransferred: true,
      workerReady: false
    });
    return bridge;
  } catch (error) {
    if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
    return publish({
      status: 'worker-offscreen-presentation-transfer-error',
      reason: error instanceof Error ? error.message : String(error),
      requested: true,
      canvasTransferred: false,
      workerReady: false
    });
  }
}
