// One route-generic presentation policy shared by the page-side temporal
// horizon planner and the worker-side Tier0 mechanics scheduler. Materials and
// scenarios supply laws and initial conditions; they do not select a different
// presentation pipeline or chunk size.
export const ULG_WORKER_TIER0_PRESENTATION_QOS_MAX_SUBSTEPS_PER_SUBMISSION = 2;
export const ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_SCHEMA =
  'peercompute.ulg.worker-tier0-presentation-qos-boundary-proof.v0';
export const ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_STATUS =
  'worker-particle-temporal-presentation-boundary-completed';
export const ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE =
  'worker-offscreen-shared-device-queue-frame-proof';
export const ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_INCLUDED =
  'physics-queue-prefix-included';
export const ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED =
  'physics-queue-prefix-not-attributed';

export function isExactWorkerPresentationFrameQueueCompletionProof(
  receipt,
  { requirePhysicsPrefixIncluded = false } = {}
) {
  const completionCount = Number(receipt?.presentationQueueCompletionCount);
  const completionSerial = Number(receipt?.presentationQueueCompletionSerial);
  const prefixCoverage = receipt?.physicsQueuePrefixCoverage;
  return Boolean(
    Number.isSafeInteger(completionCount)
    && completionCount > 0
    && Number.isSafeInteger(completionSerial)
    && completionSerial > 0
    && completionCount === completionSerial
    && receipt?.presentationQueueCompletionMethod
      === 'worker-device.queue.onSubmittedWorkDone'
    && receipt?.presentationQueueCompletionScope
      === ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE
    && (
      prefixCoverage === ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_INCLUDED
      || prefixCoverage
        === ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED
    )
    && (
      requirePhysicsPrefixIncluded !== true
      || prefixCoverage === ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_INCLUDED
    )
  );
}

export function resolveWorkerTier0PresentationQosSubsteps(
  {
    requestedStepCount,
    presentationRequested = false
  } = {}
) {
  const stepCount = Number(requestedStepCount);
  if (!Number.isSafeInteger(stepCount) || stepCount <= 0) return null;
  return presentationRequested === true
    ? Math.min(
        stepCount,
        ULG_WORKER_TIER0_PRESENTATION_QOS_MAX_SUBSTEPS_PER_SUBMISSION
      )
    : stepCount;
}

export function createWorkerTier0PresentationQosPlan({
  requestedStepCount,
  presentationRequested = false,
  targetHz = 60,
  dtS = 0
} = {}) {
  const stepCount = Number(requestedStepCount);
  const cadenceHz = Number(targetHz);
  if (!Number.isSafeInteger(stepCount) || stepCount <= 0) {
    throw new RangeError('requestedStepCount must be a positive safe integer');
  }
  if (!Number.isFinite(cadenceHz) || cadenceHz <= 0) {
    throw new RangeError('targetHz must be finite and positive');
  }
  const presentationDemand = presentationRequested === true;
  const effectiveSubstepsPerSubmission =
    resolveWorkerTier0PresentationQosSubsteps({
      requestedStepCount: stepCount,
      presentationRequested: presentationDemand
    });
  const presentationSlotCount = Math.max(
    1,
    Math.ceil(stepCount / effectiveSubstepsPerSubmission)
  );
  const expectedWallHorizonS = presentationSlotCount / cadenceHz;
  const simulationHorizonS = Math.max(
    1e-6,
    Math.abs(Number(dtS) || 0) * stepCount
  );
  return Object.freeze({
    requestedStepCount: stepCount,
    presentationRequested: presentationDemand,
    effectiveSubstepsPerSubmission,
    targetHz: cadenceHz,
    presentationSlotCount,
    expectedWallHorizonS,
    simulationHorizonS
  });
}

export function isExactWorkerTier0PresentationQosBoundaryProof(
  receipt,
  boundary
) {
  if (!receipt || !boundary) return false;
  return Boolean(
    receipt.schema
      === ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_SCHEMA
    && receipt.status
      === ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_STATUS
    && receipt.submissionOrdinal === boundary.submissionOrdinal
    && receipt.completedSubstepCount === boundary.completedSubstepCount
    && receipt.totalSubstepCount === boundary.totalSubstepCount
    && receipt.chunkStepCount === boundary.chunkStepCount
    && Number.isSafeInteger(receipt.motionFrameSubmittedSerial)
    && receipt.motionFrameSubmittedSerial > 0
    && Number.isSafeInteger(receipt.motionFrameSerial)
    && receipt.motionFrameSerial > 0
    && receipt.motionFrameSubmittedSerial >= receipt.motionFrameSerial
    && receipt.gpuCompleted === true
    && receipt.gpuCompletionMethod
      === 'worker-device.queue.onSubmittedWorkDone'
    && receipt.presentationOpportunity === true
    && receipt.presentationOpportunityMethod
      === 'worker-request-animation-frame-after-gpu-completion'
    && receipt.queuePrefixCoveredPhysics === true
    && isExactWorkerPresentationFrameQueueCompletionProof(receipt, {
      requirePhysicsPrefixIncluded: true
    })
    && receipt.physicsContinuationBlocked === true
    && receipt.presentationQosHostQueueFenceCount === 1
  );
}
