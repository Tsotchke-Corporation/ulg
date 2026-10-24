// Shared admission and wall-clock counting for the live dashboard and headed sweep.
// This module performs no GPU work. Presentation evidence is read-only.
import {
  isExactWorkerIsosurfacePresentationQueueAttributionProof
} from '../runtime/sph/sphWorkerPresentationQos.js';

export const SPH_PRESENTATION_CADENCE_EVIDENCE = Object.freeze({
  measurementSemantics: 'admitted-render-input-transitions-not-pixel-motion',
  visibleMotionCadenceVerified: false
});

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeIntegerOrNull(value) {
  const number = finiteOrNull(value);
  return Number.isSafeInteger(number) ? number : null;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  );
  return sorted[index];
}

function nonEmptyString(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

// This describes a render input, never pixel motion. Keep its validation shared
// with the durable worker receipt so camera redraws cannot masquerade as motion.
export function readIsosurfaceTemporalInput(receipt = {}) {
  if (!receipt || typeof receipt !== 'object') return { claimed: false, valid: false };
  const fields = [
    'isosurfaceTemporalPresentation', 'isosurfacePresentationMotionAgeS',
    'isosurfacePresentationSourceTimeS', 'isosurfacePresentationMotionMethod'
  ];
  const claimed = fields.some((field) => Object.hasOwn(receipt, field));
  if (!claimed) return { claimed: false, valid: false };
  const ageS = receipt.isosurfacePresentationMotionAgeS;
  const sourceTimeS = receipt.isosurfacePresentationSourceTimeS;
  const version = [
    receipt.presentationLaneEpoch, receipt.residentExecutionGeneration,
    receipt.sphStep, receipt.stepOrdinal, receipt.requestGeneration
  ];
  const valid = Boolean(
    receipt.schema === 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0'
    && receipt.presentationGeometry === 'worker-owned-true-isosurface'
    && typeof ageS === 'number' && Number.isFinite(ageS) && ageS >= 0
    && typeof sourceTimeS === 'number' && Number.isFinite(sourceTimeS) && sourceTimeS >= 0
    && receipt.isosurfaceTemporalPresentation === (ageS > 0)
    && receipt.isosurfacePresentationMotionMethod === (ageS > 0
      ? 'bounded-gpu-field-velocity-extrapolation' : 'committed-source-mesh')
    && receipt.presentationOnly === (ageS > 0)
    && receipt.authoritativeStateMutation === false
    && nonEmptyString(receipt.laneId) && nonEmptyString(receipt.stateKey)
    && version.every((value) => Number.isSafeInteger(value) && value >= 0)
    && version[0] > 0 && version[3] > 0 && version[4] > 0
  );
  return {
    claimed, valid,
    ageS: valid ? ageS : null,
    sourceTimeS: valid ? sourceTimeS : null,
    sourceVersion: valid ? version : null,
    sourceIdentity: valid
      ? JSON.stringify([receipt.laneId, receipt.stateKey, ...version]) : null
  };
}

function admittedIsosurfaceInput(observation) {
  return observation?.isosurfaceTemporalInputAdmitted === true
    && nonEmptyString(observation.isosurfaceTemporalSourceIdentity)
    && Number.isFinite(observation.isosurfaceMotionAgeS)
    && observation.isosurfaceMotionAgeS >= 0
    && Number.isFinite(observation.isosurfaceSourceTimeS)
    && observation.isosurfaceSourceTimeS >= 0;
}

function isosurfaceInputRegressed(previous, incoming) {
  if (!admittedIsosurfaceInput(previous) || !admittedIsosurfaceInput(incoming)) return false;
  const priorVersion = previous.isosurfaceTemporalSourceVersion;
  const nextVersion = incoming.isosurfaceTemporalSourceVersion;
  if (Array.isArray(priorVersion) && Array.isArray(nextVersion)) {
    for (let index = 0; index < priorVersion.length; index += 1) {
      if (nextVersion[index] < priorVersion[index]) return true;
      if (nextVersion[index] > priorVersion[index]) return false;
    }
  }
  return previous.sourceStep === incoming.sourceStep
    && previous.isosurfaceTemporalSourceIdentity === incoming.isosurfaceTemporalSourceIdentity
    && (previous.isosurfaceSourceTimeS !== incoming.isosurfaceSourceTimeS
      || incoming.isosurfaceMotionAgeS < previous.isosurfaceMotionAgeS);
}

export function visiblePresentationIdentity(observation = {}) {
  const owner = nonEmptyString(observation.owner);
  const cohortIdentity = nonEmptyString(observation.cohortIdentity);
  const sourceStep = safeIntegerOrNull(observation.sourceStep);
  if (
    !owner
    || !cohortIdentity
    || observation.admitted !== true
    || sourceStep == null
    || sourceStep < 0
  ) return null;
  if (admittedIsosurfaceInput(observation)) {
    return `${owner}|${cohortIdentity}|step:${sourceStep}|isosurface:${observation.isosurfaceTemporalSourceIdentity}|age:${observation.isosurfaceMotionAgeS}`;
  }
  const motionFrameSerial = safeIntegerOrNull(observation.motionFrameSerial);
  const admittedMotionFrame = Boolean(
    observation.motionFrameAdmitted === true
    && motionFrameSerial != null
    && motionFrameSerial >= 0
  );
  return admittedMotionFrame
    ? `${owner}|${cohortIdentity}|step:${sourceStep}|motion:${motionFrameSerial}`
    : `${owner}|${cohortIdentity}|step:${sourceStep}`;
}

/**
 * Count distinct admitted render-input states observed on animation frames.
 * A source-step jump of K is one presentation, not K frames. Repeated RAFs,
 * canvas redraws, and presentation serial churn with unchanged visual input
 * are deliberately ignored. An admitted temporal parameter change counts as
 * a presented state, but may leave geometry/pixels unchanged (zero velocity,
 * displacement caps, or occlusion). Legacy "visible" field names do not prove
 * visible animation; the evidence semantics below accompany every summary.
 */
export function summarizeVisiblePresentationCadence(observations, {
  sampleDurationMs,
  sampleStartedAtMs = null,
  sampleEndedAtMs = null,
  sustainedWindowDurationMs = 500
} = {}) {
  const durationMs = finiteOrNull(sampleDurationMs);
  const rows = Array.isArray(observations) ? observations : [];
  const ownerCohorts = new Set();
  const presentationCohorts = new Set();
  const sourceIdentities = new Set();
  const visualIdentities = new Set();
  const visualTransitionIntervalsMs = [];
  const visualTransitionTimestampsMs = [];
  const sourceTransitionIntervalsMs = [];
  const admissionBlockerCounts = new Map();
  let observedPresentationCount = 0;
  let visualTransitionCount = 0;
  let sourceTransitionCount = 0;
  let temporalTransitionCount = 0;
  let invalidObservationCount = 0;
  let presentationSerialRegressionCount = 0;
  let presentationSerialStallCount = 0;
  let presentationCohortTransitionCount = 0;
  let sourceStepRegressionCount = 0;
  let motionFrameRegressionCount = 0;
  let timestampRegressionCount = 0;
  let firstObservedTimestampMs = null;
  let lastObservedTimestampMs = null;
  let firstValidPresentationAtMs = null;
  let lastObservedCohortIdentity = null;
  let lastValidCohortIdentity = null;
  let lastSourceStep = null;
  let lastMotionFrameSerial = null;
  let lastVisualTransitionAtMs = null;
  let lastSourceTransitionAtMs = null;
  let lastPresentationSerial = null;
  let lastIsosurfaceObservation = null;

  for (const observation of rows) {
    const admissionBlockers = Array.isArray(observation?.admissionBlockers)
      ? [...new Set(observation.admissionBlockers.filter(nonEmptyString))]
      : [];
    for (const blocker of admissionBlockers) {
      admissionBlockerCounts.set(
        blocker,
        (admissionBlockerCounts.get(blocker) || 0) + 1
      );
    }
    const timestampMs = finiteOrNull(observation?.timestampMs);
    const owner = nonEmptyString(observation?.owner);
    const cohortIdentity = nonEmptyString(observation?.cohortIdentity);
    const sourceStep = safeIntegerOrNull(observation?.sourceStep);
    const presentationSerial = safeIntegerOrNull(
      observation?.presentationSerial
    );
    const visualIdentity = visiblePresentationIdentity(observation);
    if (
      timestampMs != null
      && lastObservedTimestampMs != null
      && timestampMs < lastObservedTimestampMs
    ) {
      timestampRegressionCount += 1;
    }
    if (timestampMs != null) lastObservedTimestampMs = timestampMs;
    if (timestampMs != null && firstObservedTimestampMs == null) {
      firstObservedTimestampMs = timestampMs;
    }
    if (owner) ownerCohorts.add(owner);
    const fullCohortIdentity = owner && cohortIdentity
      ? `${owner}|${cohortIdentity}`
      : null;
    if (fullCohortIdentity) {
      presentationCohorts.add(fullCohortIdentity);
      if (
        lastObservedCohortIdentity != null
        && fullCohortIdentity !== lastObservedCohortIdentity
      ) {
        presentationCohortTransitionCount += 1;
      }
      lastObservedCohortIdentity = fullCohortIdentity;
    }
    if (
      timestampMs == null
      || !owner
      || !cohortIdentity
      || sourceStep == null
      || sourceStep < 0
      || presentationSerial == null
      || presentationSerial < 0
      || !visualIdentity
    ) {
      invalidObservationCount += 1;
      continue;
    }
    if (fullCohortIdentity === lastValidCohortIdentity
      && isosurfaceInputRegressed(lastIsosurfaceObservation, observation)) {
      motionFrameRegressionCount += 1;
      invalidObservationCount += 1;
      continue;
    }
    observedPresentationCount += 1;
    if (firstValidPresentationAtMs == null) {
      firstValidPresentationAtMs = timestampMs;
    }
    sourceIdentities.add(`${fullCohortIdentity}|step:${sourceStep}`);
    visualIdentities.add(visualIdentity);

    if (
      fullCohortIdentity === lastValidCohortIdentity
      && presentationSerial != null
      && lastPresentationSerial != null
      && presentationSerial < lastPresentationSerial
    ) {
      presentationSerialRegressionCount += 1;
    }
    const motionFrameSerial = safeIntegerOrNull(observation?.motionFrameSerial);
    const admittedMotionFrame = Boolean(
      observation?.motionFrameAdmitted === true
      && motionFrameSerial != null
      && motionFrameSerial >= 0
    );
    if (lastValidCohortIdentity == null) {
      lastValidCohortIdentity = fullCohortIdentity;
      lastSourceStep = sourceStep;
      lastMotionFrameSerial = admittedMotionFrame ? motionFrameSerial : null;
      lastVisualTransitionAtMs = timestampMs;
      lastSourceTransitionAtMs = timestampMs;
      lastPresentationSerial = presentationSerial;
      lastIsosurfaceObservation = observation;
      continue;
    }
    if (fullCohortIdentity !== lastValidCohortIdentity) {
      lastValidCohortIdentity = fullCohortIdentity;
      lastSourceStep = sourceStep;
      lastMotionFrameSerial = admittedMotionFrame ? motionFrameSerial : null;
      lastVisualTransitionAtMs = timestampMs;
      lastSourceTransitionAtMs = timestampMs;
      lastPresentationSerial = presentationSerial;
      lastIsosurfaceObservation = observation;
      continue;
    }

    let sourceAdvanced = false;
    let motionAdvanced = false;
    if (sourceStep > lastSourceStep) {
      sourceAdvanced = true;
    } else if (sourceStep < lastSourceStep) {
      sourceStepRegressionCount += 1;
    } else if (admittedIsosurfaceInput(observation)) {
      motionAdvanced = Boolean(
        admittedIsosurfaceInput(lastIsosurfaceObservation)
        && observation.isosurfaceTemporalSourceIdentity
          === lastIsosurfaceObservation.isosurfaceTemporalSourceIdentity
        && observation.isosurfaceMotionAgeS > lastIsosurfaceObservation.isosurfaceMotionAgeS
      );
    } else if (admittedMotionFrame) {
      if (
        lastMotionFrameSerial == null
        || motionFrameSerial > lastMotionFrameSerial
      ) {
        motionAdvanced = true;
      } else if (motionFrameSerial < lastMotionFrameSerial) {
        motionFrameRegressionCount += 1;
      }
    }

    let visualAdvanced = false;
    if (sourceAdvanced || motionAdvanced) {
      if (presentationSerial > lastPresentationSerial) {
        visualAdvanced = true;
        if (sourceAdvanced) {
          sourceTransitionCount += 1;
          const sourceIntervalMs = timestampMs - lastSourceTransitionAtMs;
          if (Number.isFinite(sourceIntervalMs) && sourceIntervalMs > 0) {
            sourceTransitionIntervalsMs.push(sourceIntervalMs);
          }
          lastSourceTransitionAtMs = timestampMs;
          lastSourceStep = sourceStep;
          lastMotionFrameSerial = admittedMotionFrame
            ? motionFrameSerial
            : null;
        } else {
          temporalTransitionCount += 1;
          lastMotionFrameSerial = motionFrameSerial;
        }
      } else {
        presentationSerialStallCount += 1;
      }
    }
    if (visualAdvanced) {
      const intervalMs = timestampMs - lastVisualTransitionAtMs;
      if (Number.isFinite(intervalMs) && intervalMs > 0) {
        visualTransitionIntervalsMs.push(intervalMs);
      }
      visualTransitionCount += 1;
      visualTransitionTimestampsMs.push(timestampMs);
      lastVisualTransitionAtMs = timestampMs;
    }
    lastPresentationSerial = presentationSerial;
    lastIsosurfaceObservation = observation;
  }

  const meanVisiblePresentationHz = durationMs > 0
    ? visualTransitionCount * 1000 / durationMs
    : null;
  const medianVisualIntervalMs = median(visualTransitionIntervalsMs);
  const p95VisualIntervalMs = percentile(visualTransitionIntervalsMs, 0.95);
  const cadenceSampleStartedAtMs = finiteOrNull(sampleStartedAtMs)
    ?? firstObservedTimestampMs;
  const cadenceSampleEndedAtMs = finiteOrNull(sampleEndedAtMs)
    ?? (
      cadenceSampleStartedAtMs != null && durationMs > 0
        ? cadenceSampleStartedAtMs + durationMs
        : lastObservedTimestampMs
    );
  const sampleBoundsReady = Boolean(
    cadenceSampleStartedAtMs != null
    && cadenceSampleEndedAtMs != null
    && cadenceSampleEndedAtMs >= cadenceSampleStartedAtMs
  );
  const boundedVisualTransitionTimestampsMs = sampleBoundsReady
    ? visualTransitionTimestampsMs.filter((timestampMs) => (
        Number.isFinite(timestampMs)
        && timestampMs >= cadenceSampleStartedAtMs
        && timestampMs <= cadenceSampleEndedAtMs
      ))
    : [];
  const boundedVisualProgressTimestampsMs = sampleBoundsReady
    ? [firstValidPresentationAtMs, ...boundedVisualTransitionTimestampsMs]
        .filter((timestampMs) => (
          Number.isFinite(timestampMs)
          && timestampMs >= cadenceSampleStartedAtMs
          && timestampMs <= cadenceSampleEndedAtMs
        ))
        .sort((left, right) => left - right)
    : [];
  // Censor both sample edges. Transition-to-transition intervals alone miss a
  // producer that presents rapidly and then freezes for the remainder of the
  // declared measurement window.
  const visiblePresentationGapsMs = [];
  if (sampleBoundsReady) {
    let gapStartMs = cadenceSampleStartedAtMs;
    for (const timestampMs of boundedVisualProgressTimestampsMs) {
      visiblePresentationGapsMs.push(Math.max(0, timestampMs - gapStartMs));
      gapStartMs = timestampMs;
    }
    visiblePresentationGapsMs.push(Math.max(
      0,
      cadenceSampleEndedAtMs - gapStartMs
    ));
  }
  const leadingVisiblePresentationHoldMs = visiblePresentationGapsMs.length > 0
    ? visiblePresentationGapsMs[0]
    : null;
  const terminalVisiblePresentationHoldMs = visiblePresentationGapsMs.length > 0
    ? visiblePresentationGapsMs.at(-1)
    : null;
  const maximumVisiblePresentationGapMs = visiblePresentationGapsMs.length > 0
    ? Math.max(...visiblePresentationGapsMs)
    : null;
  const requestedSustainedWindowDurationMs = finiteOrNull(
    sustainedWindowDurationMs
  );
  const exactSustainedWindowDurationMs = Boolean(
    sampleBoundsReady
    && requestedSustainedWindowDurationMs > 0
    && requestedSustainedWindowDurationMs
      <= cadenceSampleEndedAtMs - cadenceSampleStartedAtMs
  )
    ? requestedSustainedWindowDurationMs
    : null;
  let minimumSustainedWindowTransitionCount = null;
  let minimumSustainedWindowStartedAtMs = null;
  if (exactSustainedWindowDurationMs != null) {
    const latestWindowStartMs =
      cadenceSampleEndedAtMs - exactSustainedWindowDurationMs;
    const candidateWindowStartsMs = [
      cadenceSampleStartedAtMs,
      latestWindowStartMs,
      ...boundedVisualTransitionTimestampsMs.filter((timestampMs) => (
        timestampMs >= cadenceSampleStartedAtMs
        && timestampMs <= latestWindowStartMs
      ))
    ];
    const epsilonMs = 1e-6;
    for (const windowStartedAtMs of candidateWindowStartsMs) {
      const windowEndedAtMs =
        windowStartedAtMs + exactSustainedWindowDurationMs;
      const transitionCount = boundedVisualTransitionTimestampsMs.filter(
        (timestampMs) => (
          timestampMs - windowStartedAtMs > epsilonMs
          && timestampMs <= windowEndedAtMs + epsilonMs
        )
      ).length;
      if (
        minimumSustainedWindowTransitionCount == null
        || transitionCount < minimumSustainedWindowTransitionCount
      ) {
        minimumSustainedWindowTransitionCount = transitionCount;
        minimumSustainedWindowStartedAtMs = windowStartedAtMs;
      }
    }
  }
  const meanSourcePresentationHz = durationMs > 0
    ? sourceTransitionCount * 1000 / durationMs
    : null;
  const medianSourceIntervalMs = median(sourceTransitionIntervalsMs);
  return Object.freeze({
    ...SPH_PRESENTATION_CADENCE_EVIDENCE,
    observedPresentationCount,
    invalidObservationCount,
    admissionBlockerCounts: Object.freeze(Object.fromEntries(
      [...admissionBlockerCounts.entries()].sort((left, right) => (
        right[1] - left[1] || left[0].localeCompare(right[0])
      ))
    )),
    presentationOwnerCohortCount: ownerCohorts.size,
    presentationOwners: Object.freeze([...ownerCohorts]),
    presentationCohortCount: presentationCohorts.size,
    presentationCohortTransitionCount,
    distinctSourceCount: sourceIdentities.size,
    distinctVisualStateCount: visualIdentities.size,
    visualTransitionCount,
    sourceTransitionCount,
    temporalTransitionCount,
    presentationSerialRegressionCount,
    presentationSerialStallCount,
    sourceStepRegressionCount,
    motionFrameRegressionCount,
    timestampRegressionCount,
    meanVisiblePresentationHz,
    medianVisiblePresentationHz: medianVisualIntervalMs > 0
      ? 1000 / medianVisualIntervalMs
      : null,
    p95VisualIntervalMs,
    p95VisualIntervalEquivalentHz: p95VisualIntervalMs > 0
      ? 1000 / p95VisualIntervalMs
      : null,
    cadenceSampleStartedAtMs,
    cadenceSampleEndedAtMs,
    leadingVisiblePresentationHoldMs,
    terminalVisiblePresentationHoldMs,
    maximumVisiblePresentationGapMs,
    sustainedWindowDurationMs: exactSustainedWindowDurationMs,
    minimumSustainedWindowTransitionCount,
    minimumSustainedWindowStartedAtMs,
    meanSourcePresentationHz,
    meanTemporalPresentationHz: durationMs > 0
      ? temporalTransitionCount * 1000 / durationMs : null,
    medianSourcePresentationHz: medianSourceIntervalMs > 0
      ? 1000 / medianSourceIntervalMs
      : null,
    visualTransitionIntervalsMs: Object.freeze(visualTransitionIntervalsMs),
    sourceTransitionIntervalsMs: Object.freeze(sourceTransitionIntervalsMs)
  });
}

function safeNonNegativeInteger(value) {
  const number = safeIntegerOrNull(value);
  return number != null && number >= 0 ? number : null;
}

export function observeSphPresentation({
  timestampMs,
  presentation = null,
  renderState = null,
  surfaceDraw = null,
  steps = null,
  nativePresentation = null,
  renderBridge = null,
  presentationProof = null,
  workerCanvasVisible = false,
  nativeCanvasVisible = false,
  mainCanvasOpacity = null,
  compositorOwner = null,
  pendingPresentation = null,
  pendingPresentationVisible = false
} = {}) {
  const workerLane = steps?.workerOwnedResidentLane || null;
  const owner = presentation?.displayOwner ?? null;
  const latestRows = presentation?.workerOffscreenRenderRows
    || renderState?.workerOffscreenRenderRows
    || null;
  // Measure the exact admitted framebuffer that still owns the visible
  // canvas. A newer queue-submitted keyframe is diagnostic state only
  // until its GPU-completion + presentation-opportunity proof lands.
  const rows = owner === 'worker'
    ? (presentation?.displayOwnerLastRenderedContent || latestRows)
    : latestRows;
  const durableWorkerFrame = Boolean(
    owner === 'worker'
    && presentation?.displayOwnerLastRenderedContent === rows
  );
  const laneId = nonEmptyString(workerLane?.laneId);
  const stateKey = nonEmptyString(workerLane?.stateKey);
  const lifecycleGeneration = safeNonNegativeInteger(
    presentation?.lifecycleGeneration
  );
  const displayOwnerEpoch = safeNonNegativeInteger(
    presentation?.displayOwnerEpoch
  );
  const cohortIdentity = (
    laneId
    && stateKey
    && lifecycleGeneration > 0
    && displayOwnerEpoch != null
  )
    ? JSON.stringify([
        laneId,
        stateKey,
        lifecycleGeneration,
        displayOwnerEpoch
      ])
    : null;
  if (owner === 'worker') {
    const sourceStep = safeNonNegativeInteger(rows?.sphStep);
    const particleCount = safeNonNegativeInteger(rows?.particleCount);
    const frameCount = safeNonNegativeInteger(rows?.frameCount);
    const readyFrameCount = safeNonNegativeInteger(rows?.readyFrameCount);
    const presentationFrameCount = safeNonNegativeInteger(
      presentation?.frameCount
    );
    const presentationReadyFrameCount = safeNonNegativeInteger(
      presentation?.readyFrameCount
    );
    const rowsDisplayOwnerEpoch = safeNonNegativeInteger(
      rows?.displayOwnerEpoch
    );
    const motionFrameSerial = safeNonNegativeInteger(
      rows?.motionFrameSerial
    );
    const motionFrameSubmittedSerial = safeNonNegativeInteger(
      rows?.motionFrameSubmittedSerial
    );
    const motionSourceFrameCount = safeNonNegativeInteger(
      rows?.motionSourceFrameCount
    );
    const motionSourceSphStep = safeNonNegativeInteger(
      rows?.motionSourceSphStep
    );
    const motionFrameClaimed = Boolean(
      rows?.motionFrameSchema != null
      || rows?.motionFrameAdmitted === true
      || rows?.motionFrameSerial != null
    );
    const presentationQueueCompletionCount = safeNonNegativeInteger(
      rows?.presentationQueueCompletionCount
    );
    const presentationQueueCompletionSerial = safeNonNegativeInteger(
      rows?.presentationQueueCompletionSerial
    );
    const physicsQueuePrefixCoverage = rows?.physicsQueuePrefixCoverage;
    const motionPresentationQosBoundary =
      rows?.motionPresentationQosBoundary;
    const exactIncludedPhysicsPrefix = Boolean(
      physicsQueuePrefixCoverage !== 'physics-queue-prefix-included'
      || (
        rows?.physicsHostQueueFenceParticipation === true
        && Number.isSafeInteger(Number(
          motionPresentationQosBoundary?.submissionOrdinal
        ))
        && Number(motionPresentationQosBoundary.submissionOrdinal) > 0
        && Number.isSafeInteger(Number(
          motionPresentationQosBoundary?.completedSubstepCount
        ))
        && Number(motionPresentationQosBoundary.completedSubstepCount) > 0
        && Number.isSafeInteger(Number(
          motionPresentationQosBoundary?.totalSubstepCount
        ))
        && Number(motionPresentationQosBoundary.totalSubstepCount)
          > Number(motionPresentationQosBoundary.completedSubstepCount)
        && Number.isSafeInteger(Number(
          motionPresentationQosBoundary?.chunkStepCount
        ))
        && Number(motionPresentationQosBoundary.chunkStepCount) > 0
      )
    );
    const exactUnattributedPhysicsPrefix = Boolean(
      physicsQueuePrefixCoverage
        !== 'physics-queue-prefix-not-attributed'
      || rows?.physicsHostQueueFenceParticipation !== true
    );
    const exactPresentationQueueCompletionProof = Boolean(
      presentationQueueCompletionCount > 0
      && presentationQueueCompletionSerial > 0
      && presentationQueueCompletionCount
        === presentationQueueCompletionSerial
      && rows?.presentationQueueCompletionMethod
        === 'worker-device.queue.onSubmittedWorkDone'
      && rows?.presentationQueueCompletionScope
        === 'worker-offscreen-shared-device-queue-frame-proof'
      && (
        physicsQueuePrefixCoverage
          === 'physics-queue-prefix-not-attributed'
        || physicsQueuePrefixCoverage
          === 'physics-queue-prefix-included'
      )
      && exactIncludedPhysicsPrefix
      && exactUnattributedPhysicsPrefix
    );
    const exactMotionFrameProof = Boolean(
      rows?.motionFrameSchema
        === 'peercompute.ulg.worker-offscreen-particle-temporal-motion-frame.v0'
      && rows?.motionFrameStatus
        === 'worker-particle-temporal-motion-frame-presentation-opportunity'
      && rows?.motionFrameAdmitted === true
      && rows?.motionFrameGpuCompleted === true
      && rows?.motionFramePresentationOpportunity === true
      && rows?.motionFramePresentationOpportunityMethod
        === 'worker-request-animation-frame-after-gpu-completion'
      && motionFrameSerial > 0
      && motionFrameSubmittedSerial >= motionFrameSerial
      && motionSourceSphStep === sourceStep
      && motionSourceFrameCount > 0
      && motionSourceFrameCount < frameCount
      && rows?.motionMethod === 'bounded-keyframe-velocity-extrapolation'
      && rows?.motionVelocityBufferRetained === true
      && exactPresentationQueueCompletionProof
    );
    const particlePresentation = Boolean(
      rows?.schema
        === 'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0'
      && rows?.presentationGeometry === 'sphere-impostor-depth-fallback'
    );
    const isosurfacePresentation = Boolean(
      rows?.schema
        === 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0'
      && rows?.presentationGeometry === 'worker-owned-true-isosurface'
    );
    const exactIsosurfaceFrameProof = Boolean(
      isosurfacePresentation
      && rows?.status
        === 'worker-offscreen-resident-isosurface-presentation-rendered'
      && rows?.presentationFrameSchema
        === 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0'
      && rows?.presentationFrameStatus
        === 'worker-owned-isosurface-presentation-opportunity'
      && rows?.presentationFrameAdmitted === true
      && rows?.presentationFrameGpuCompleted === true
      && rows?.presentationFrameGpuCompletionMethod
        === 'worker-device.queue.onSubmittedWorkDone'
      && rows?.presentationFramePresentationOpportunity === true
      && rows?.presentationFramePresentationOpportunityMethod
        === 'worker-request-animation-frame-after-gpu-completion'
      && exactPresentationQueueCompletionProof
      && isExactWorkerIsosurfacePresentationQueueAttributionProof(rows)
    );
    const isosurfaceInput = readIsosurfaceTemporalInput(rows);
    const admissionChecks = {
      'cohort-ready': Boolean(cohortIdentity),
      'display-owner-epoch-ready': displayOwnerEpoch != null,
      'render-row-owner-epoch-current':
        rowsDisplayOwnerEpoch === displayOwnerEpoch,
      'display-owner-content-ready':
        presentation?.displayOwnerContentReady === true,
      'display-owner-content-frame-ready':
        safeNonNegativeInteger(
          presentation?.displayOwnerContentFrameSerial
        ) > 0,
      'display-owner-content-step-current':
        safeNonNegativeInteger(
          presentation?.displayOwnerPresentedSphStep
        ) === sourceStep,
      'worker-canvas-status-visible':
        presentation?.displayCanvasVisible === true,
      'worker-canvas-visible': workerCanvasVisible,
      'main-canvas-hidden': mainCanvasOpacity === '0',
      'compositor-owner-worker':
        compositorOwner
          === 'worker',
      'control-envelope-retired': pendingPresentation?.active !== true,
      'control-envelope-layer-hidden': !pendingPresentationVisible,
      'render-row-abi-ready': rows?.renderRowsSchema
        === 'peercompute.ulg.worker-offscreen-render-rows.v0',
      'worker-presentation-geometry-supported':
        particlePresentation || isosurfacePresentation,
      'worker-local-render-row-ready':
        rows?.workerLocalRenderRowsProduced === true,
      'render-row-lane-current': rows?.laneId == null || rows.laneId === laneId,
      'render-row-state-current':
        rows?.stateKey == null || rows.stateKey === stateKey,
      'particle-count-ready': particleCount > 0,
      'frame-count-ready': frameCount > 0,
      'frame-count-current': durableWorkerFrame
        || frameCount === presentationFrameCount,
      'ready-frame-count-ready': readyFrameCount > 0,
      'ready-frame-count-current':
        durableWorkerFrame
        || readyFrameCount === presentationReadyFrameCount,
      'worker-same-device-ready': rows?.sameDevicePresentation === true,
      'source-step-ready': sourceStep != null,
      ...(particlePresentation
        ? {
            'particle-render-row-status-ready': rows?.status
              === 'worker-offscreen-resident-particle-state-producer-rendered',
            'particle-keyframe-proof-schema-ready':
              rows?.presentationFrameSchema
                === 'peercompute.ulg.worker-offscreen-particle-keyframe-presentation-frame.v0',
            'particle-keyframe-proof-status-ready':
              rows?.presentationFrameStatus
                === 'worker-particle-keyframe-presentation-opportunity',
            'particle-keyframe-gpu-completed':
              rows?.presentationFrameGpuCompleted === true,
            'particle-keyframe-presentation-opportunity':
              rows?.presentationFramePresentationOpportunity === true,
            'particle-keyframe-admitted':
              rows?.presentationFrameAdmitted === true,
            'particle-keyframe-presentation-opportunity-method-ready':
              rows?.presentationFramePresentationOpportunityMethod
                === 'worker-request-animation-frame-after-gpu-completion',
            'particle-keyframe-presentation-queue-proof-ready': Boolean(
              exactPresentationQueueCompletionProof
            ),
            'particle-motion-frame-proof-ready':
              !motionFrameClaimed || exactMotionFrameProof,
            'particle-depth-ready': rows?.depthAttachmentReady === true
          }
        : {}),
      ...(isosurfacePresentation
        ? {
            'isosurface-frame-proof-ready': exactIsosurfaceFrameProof,
            'isosurface-temporal-input-ready':
              physicsQueuePrefixCoverage === 'physics-queue-prefix-included'
                ? isosurfaceInput.valid && isosurfaceInput.ageS > 0
                : !isosurfaceInput.claimed || isosurfaceInput.valid,
            'isosurface-surface-count-ready':
              safeNonNegativeInteger(rows?.surfaceCount) > 0,
            'isosurface-indirect-draw-ready':
              safeNonNegativeInteger(rows?.indirectDrawCount) > 0
          }
        : {})
    };
    const admissionBlockers = Object.entries(admissionChecks)
      .filter(([, ready]) => !ready)
      .map(([name]) => name);
    const admitted = admissionBlockers.length === 0;
    return {
      timestampMs,
      owner,
      admitted,
      sourceStep,
      cohortIdentity,
      presentationSerial: frameCount,
      displayOwnerEpoch,
      admissionBlockers,
      isosurfaceTemporalInputAdmitted: Boolean(
        admitted && exactIsosurfaceFrameProof && isosurfaceInput.valid
      ),
      isosurfaceTemporalSourceIdentity: isosurfaceInput.sourceIdentity ?? null,
      isosurfaceTemporalSourceVersion: isosurfaceInput.sourceVersion ?? null,
      isosurfaceMotionAgeS: isosurfaceInput.ageS ?? null,
      isosurfaceSourceTimeS: isosurfaceInput.sourceTimeS ?? null,
      // A submit receipt is not display cadence: same-queue motion
      // commands can sit behind a long fused mechanics dispatch and then
      // reach the compositor in a burst. Count a temporal frame only once
      // the producer has proved both GPU completion and a subsequent
      // presentation opportunity.
      motionFrameAdmitted: Boolean(
        exactMotionFrameProof
      ),
      motionFrameSerial: exactMotionFrameProof
        ? motionFrameSerial
        : null,
      motionFrameSchema: exactMotionFrameProof
        ? rows.motionFrameSchema
        : null,
      motionSourceFrameCount: exactMotionFrameProof
        ? motionSourceFrameCount
        : null,
      motionSourceSphStep: exactMotionFrameProof
        ? motionSourceSphStep
        : null
    };
  }
  if (owner === 'main-native') {
    const renderSource = renderState?.residentRenderSource || null;
    const handoff = renderSource?.workerLaneNativeSurfaceSnapshotHandoff
      || null;
    const committedPresentation = workerLane?.committedPresentation || null;
    const sourceStep = safeNonNegativeInteger(
      nativePresentation?.sourceStep
    );
    const renderStateSourceStep = safeNonNegativeInteger(
      renderState?.sourceResidentNextStep
      ?? renderState?.residentRenderSource?.nextStep
    );
    const renderBridgeSourceStep = safeNonNegativeInteger(
      renderBridge?.sourceResidentNextStep
    );
    const surfaceDrawSourceStep = safeNonNegativeInteger(
      surfaceDraw?.sourceResidentNextStep
    );
    const surfaceDrawBridgeSourceStep = safeNonNegativeInteger(
      surfaceDraw?.renderBridgeSourceResidentNextStep
    );
    const drawSourceSteps = [
      renderBridgeSourceStep,
      surfaceDrawSourceStep,
      surfaceDrawBridgeSourceStep
    ].filter((step) => step != null);
    const renderBridgeFrameCount = safeNonNegativeInteger(
      renderBridge?.frameCount
    );
    const committedSourceStep = safeNonNegativeInteger(
      committedPresentation?.sphStep
    );
    const sourceTimesReady = Boolean(
      Number.isFinite(Number(nativePresentation?.sourceTimeS))
      && Number.isFinite(Number(workerLane?.laneSimTimeS))
      && Math.abs(
        Number(nativePresentation.sourceTimeS) - Number(workerLane.laneSimTimeS)
      ) <= 1e-9
    );
    const handoffTimesReady = Boolean(
      Number.isFinite(Number(handoff?.sourceTimeS))
      && Number.isFinite(Number(nativePresentation?.sourceTimeS))
      && Math.abs(
        Number(handoff.sourceTimeS) - Number(nativePresentation.sourceTimeS)
      ) <= 1e-9
    );
    const admissionChecks = {
      'cohort-ready': Boolean(cohortIdentity),
      'display-owner-epoch-ready': displayOwnerEpoch != null,
      'display-owner-content-ready':
        presentation?.displayOwnerContentReady === true,
      'worker-canvas-status-hidden':
        presentation?.displayCanvasVisible === false,
      'native-canvas-visible': nativeCanvasVisible,
      'worker-canvas-hidden': !workerCanvasVisible,
      'main-canvas-visible': mainCanvasOpacity === '1',
      'compositor-owner-native':
        compositorOwner
          === 'main-native',
      'control-envelope-retired': pendingPresentation?.active !== true,
      'control-envelope-layer-hidden': !pendingPresentationVisible,
      'presentation-proof-bridge-ready':
        presentationProof?.bridge === 'native-webgpu-surface-consumer',
      'presentation-proof-admitted': presentationProof?.admitted === true,
      'presentation-proof-source-current':
        presentationProof?.sourceCurrent === true,
      'native-source-schema-ready': nativePresentation?.schema
        === 'peercompute.ulg.worker-lane-native-surface-presentation-source.v0',
      'native-source-status-ready': nativePresentation?.status
        === 'worker-lane-native-surface-presentation-source-ready',
      'native-source-request-ready':
        Boolean(nonEmptyString(nativePresentation?.requestId)),
      'native-source-cache-current':
        nativePresentation?.cacheKey === nativePresentation?.requestId,
      'native-render-bridge-ready':
        renderBridge?.rendererBridge === 'native-webgpu-surface-consumer',
      'native-source-step-ready': sourceStep != null,
      'committed-source-step-ready': committedSourceStep != null,
      'native-source-step-current':
        committedSourceStep != null && sourceStep === committedSourceStep + 1,
      'native-source-time-current': sourceTimesReady,
      'render-state-source-current': renderState?.sourceResidentRenderSourceStatus
        === 'resident-render-source-current',
      'render-state-generation-current':
        renderState?.sourceResidentExecutionGenerationMatchesCurrent === true,
      'render-source-generation-current':
        renderSource?.residentExecutionGenerationMatchesCurrent === true,
      'surface-draw-generation-current':
        surfaceDraw?.sourceResidentExecutionGenerationMatchesCurrent === true,
      'render-bridge-generation-current':
        renderBridge?.sourceResidentExecutionGenerationMatchesCurrent === true,
      'render-state-source-step-current': sourceStep === renderStateSourceStep,
      'draw-source-step-receipts-ready': drawSourceSteps.length > 0,
      'draw-source-steps-current':
        drawSourceSteps.every((step) => step === sourceStep),
      'native-source-schedule-current':
        nativePresentation?.scheduleId === workerLane?.scheduleId,
      'native-source-lane-current': nativePresentation?.laneId === laneId,
      'native-source-state-current': nativePresentation?.stateKey === stateKey,
      'native-source-particles-ready':
        safeNonNegativeInteger(nativePresentation?.particleCount) > 0,
      'native-handoff-schema-ready': handoff?.schema
        === 'peercompute.ulg.worker-lane-native-surface-presentation-source.v0',
      'native-handoff-status-ready': handoff?.status
        === 'worker-lane-native-surface-presentation-source-admitted',
      'native-handoff-schedule-current':
        handoff?.scheduleId === nativePresentation?.scheduleId,
      'native-handoff-lane-current': handoff?.laneId === laneId,
      'native-handoff-state-current': handoff?.stateKey === stateKey,
      'native-handoff-request-current':
        handoff?.requestId === nativePresentation?.requestId,
      'native-handoff-cache-current':
        handoff?.cacheKey === nativePresentation?.cacheKey,
      'native-handoff-step-current':
        safeNonNegativeInteger(handoff?.sourceStep) === sourceStep,
      'native-handoff-time-current': handoffTimesReady,
      'native-handoff-shared-slot-ready':
        handoff?.sharedSlotIdentityVerified === true,
      'native-handoff-lineage-ready': handoff?.workerLineageMetadataStatus
        === 'worker-retained-compact-snapshot-lineage-metadata-ready',
      'native-handoff-terminal-readback-ready':
        handoff?.terminalCompactSnapshotReadback === true,
      'native-frame-count-ready': renderBridgeFrameCount > 0
    };
    const admissionBlockers = Object.entries(admissionChecks)
      .filter(([, ready]) => !ready)
      .map(([name]) => name);
    const admitted = admissionBlockers.length === 0;
    return {
      timestampMs,
      owner,
      admitted,
      sourceStep,
      cohortIdentity,
      presentationSerial: renderBridgeFrameCount,
      displayOwnerEpoch,
      admissionBlockers,
      motionFrameAdmitted: false,
      motionFrameSerial: null
    };
  }
  return {
    timestampMs,
    owner,
    admitted: false,
    sourceStep: null,
    cohortIdentity,
    presentationSerial: null,
    displayOwnerEpoch,
    admissionBlockers: ['unsupported-display-owner'],
    motionFrameAdmitted: false,
    motionFrameSerial: null
  };
}

// Keep DOM sampling separate from the pure admission checks.
export function readVisiblePresentationObservation(timestampMs, {
  document: presentationDocument = globalThis.document,
  getComputedStyle: readStyle = globalThis.getComputedStyle
} = {}) {
  const overlay = presentationDocument?.querySelector('#sph-phase-overlay');
  const scene = overlay?.__sphScene || null;
  const renderBridge = scene?.getSphResidentSurfaceDrawRenderBridge?.() || null;
  const workerCanvas = presentationDocument?.querySelector(
    'canvas[data-ulg-worker-offscreen-presentation="true"]'
  );
  const mainCanvas = presentationDocument?.querySelector(
    '#sph-scene canvas:not([data-ulg-worker-offscreen-presentation="true"])'
  );
  const nativeCanvas = scene?.scene?.userData?.sphNativeWebGpuSurfaceConsumer?.canvas
    || renderBridge?.canvas || null;
  const visible = (element) => {
    if (!element?.isConnected || presentationDocument?.visibilityState !== 'visible') {
      return false;
    }
    const style = readStyle(element);
    const bounds = element.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none'
      && Number(style.opacity ?? 1) > 0
      && Number(bounds.width) > 0 && Number(bounds.height) > 0;
  };
  return observeSphPresentation({
    timestampMs,
    presentation: scene?.getWorkerOffscreenPresentation?.()
      || overlay?.__sphWorkerOffscreenPresentation || null,
    renderState: scene?.getSphResidentRenderState?.()
      || overlay?.__sphResidentRenderState || null,
    surfaceDraw: scene?.getSphResidentSurfaceDraw?.()
      || overlay?.__sphResidentSurfaceDraw || null,
    steps: scene?.getMlsMpmResidentSteps?.()
      || overlay?.__mlsMpmResidentSteps || null,
    nativePresentation: overlay?.__sphWorkerLaneNativeSurfacePresentation || null,
    presentationProof: overlay?.__sphResidentPresentationProof || null,
    renderBridge,
    workerCanvasVisible: visible(workerCanvas),
    nativeCanvasVisible: visible(nativeCanvas),
    mainCanvasOpacity: mainCanvas ? readStyle(mainCanvas).opacity : null,
    compositorOwner: mainCanvas?.getAttribute('data-ulg-presentation-compositor-owner'),
    pendingPresentation: overlay?.__sphPendingPresentation || null,
    pendingPresentationVisible: visible(
      overlay?.querySelector('#sph-pending-presentation')
    )
  });
}

/** A bounded observed wall-clock window, reset whenever its proof scope changes. */
export function createSphPresentationCadenceTracker({ windowDurationMs = 5_000 } = {}) {
  if (!(Number.isFinite(windowDurationMs) && windowDurationMs > 0)) {
    throw new RangeError('windowDurationMs must be positive');
  }
  let observations = [];
  let scope = null;
  let unavailableReason = 'presentation-proof-unavailable';
  let admissionBlockers = [];
  const reset = (reason = 'presentation-window-reset') => {
    observations = [];
    scope = null;
    unavailableReason = reason;
    admissionBlockers = [];
  };
  const observe = (observation, scopeIdentity = null) => {
    const timestampMs = finiteOrNull(observation?.timestampMs);
    const presentationSerial = safeNonNegativeInteger(observation?.presentationSerial);
    const nextScope = JSON.stringify([
      scopeIdentity, observation?.owner ?? null, observation?.cohortIdentity ?? null
    ]);
    if (nextScope !== scope) reset('presentation-window-reset');
    scope = nextScope;
    if (timestampMs == null || presentationSerial == null
      || !visiblePresentationIdentity(observation)) {
      reset('presentation-proof-unavailable');
      admissionBlockers = [...(observation?.admissionBlockers || [])];
      return;
    }
    const previous = observations.at(-1);
    if (previous && (
      timestampMs < previous.timestampMs
      || observation.sourceStep < previous.sourceStep
      || presentationSerial < previous.presentationSerial
      || isosurfaceInputRegressed(previous, observation)
      || (observation.sourceStep === previous.sourceStep
        && observation.motionFrameAdmitted === true
        && previous.motionFrameAdmitted === true
        && observation.motionFrameSerial < previous.motionFrameSerial)
    )) {
      reset('presentation-evidence-regressed');
      return;
    }
    observations.push({ ...observation, timestampMs, presentationSerial });
    // Retain exactly one baseline at/before the left edge so a held frame at
    // that edge does not become a new update when older observations expire.
    const cutoffMs = timestampMs - windowDurationMs;
    while (observations.length > 1 && observations[1].timestampMs <= cutoffMs) {
      observations.shift();
    }
    unavailableReason = 'presentation-window-pending';
    admissionBlockers = [];
  };
  const sample = () => {
    const endedAtMs = observations.at(-1)?.timestampMs ?? null;
    const startedAtMs = endedAtMs == null ? null : Math.max(
      observations[0].timestampMs, endedAtMs - windowDurationMs
    );
    const elapsedMs = endedAtMs == null ? 0 : endedAtMs - startedAtMs;
    const summary = elapsedMs > 0 ? summarizeVisiblePresentationCadence(observations, {
      sampleDurationMs: elapsedMs,
      sampleStartedAtMs: startedAtMs,
      sampleEndedAtMs: endedAtMs,
      sustainedWindowDurationMs: null
    }) : null;
    const available = Boolean(summary && summary.presentationSerialStallCount === 0);
    return Object.freeze({
      ...SPH_PRESENTATION_CADENCE_EVIDENCE,
      presentationCadenceStatus: available ? 'available'
        : summary ? 'presentation-serial-stalled' : unavailableReason,
      presentationCadenceBlockers: Object.freeze([...admissionBlockers]),
      presentationCadenceWindowMs: elapsedMs,
      visibleUpdatesPerSecond: null,
      presentedStatesPerSecond: available ? summary.meanVisiblePresentationHz : null,
      sourceStatesPerSecond: available ? summary.meanSourcePresentationHz : null,
      temporalInputStatesPerSecond: available ? summary.meanTemporalPresentationHz : null,
      visualTransitionCount: summary?.visualTransitionCount ?? 0,
      sourceTransitionCount: summary?.sourceTransitionCount ?? 0,
      temporalTransitionCount: summary?.temporalTransitionCount ?? 0
    });
  };
  return Object.freeze({ observe, sample, reset });
}

export function resetSphDashboardFrameCounters({
  frameCounters, presentationTracker, nowMs, reason = 'presentation-window-reset'
}) {
  presentationTracker.reset(reason);
  Object.assign(frameCounters, presentationTracker.sample(), {
    renderFrames: 0,
    physicsFrames: 0,
    residentFrames: 0,
    renderFps: 0,
    physicsFps: 0,
    residentFps: 0,
    uiCallbacksPerSecond: null,
    physicsStepsPerSecond: null,
    residentStepsPerSecond: null,
    simulatedSecondsPerWallSecond: null,
    lastSimulationSampleTimeS: undefined,
    lastSampleMs: nowMs
  });
}

// A hidden page may stop receiving rAF entirely. Lifecycle events must clear
// both sides of that gap before any resumed callback samples the new window.
export function installSphDashboardCadenceLifecycle({
  frameCounters,
  presentationTracker,
  document: presentationDocument = globalThis.document,
  page = globalThis.window,
  now = () => performance.now(),
  onReset = () => {}
}) {
  const reset = (event) => {
    resetSphDashboardFrameCounters({
      frameCounters,
      presentationTracker,
      nowMs: now(),
      reason: `presentation-${event.type}-${presentationDocument.visibilityState}`
    });
    onReset();
  };
  presentationDocument.addEventListener('visibilitychange', reset);
  page.addEventListener('pagehide', reset);
  page.addEventListener('pageshow', reset);
  return () => {
    presentationDocument.removeEventListener('visibilitychange', reset);
    page.removeEventListener('pagehide', reset);
    page.removeEventListener('pageshow', reset);
  };
}

/** The dashboard's sampler; legacy *Fps fields remain aliases for old receipts. */
export function sampleSphDashboardFrameCounters({
  frameCounters,
  presentationTracker,
  observation,
  simulationTimeS = null,
  scopeIdentity = null
}) {
  const nowMs = finiteOrNull(observation?.timestampMs);
  if (nowMs == null) return false;
  presentationTracker.observe(observation, scopeIdentity);
  frameCounters.renderFrames += 1;
  const elapsedS = (nowMs - frameCounters.lastSampleMs) / 1000;
  if (frameCounters.lastSimulationSampleTimeS === undefined) {
    frameCounters.lastSimulationSampleTimeS = finiteOrNull(simulationTimeS);
  }
  if (elapsedS < 1) return false;
  const previousSimulationTimeS = finiteOrNull(frameCounters.lastSimulationSampleTimeS);
  const currentSimulationTimeS = finiteOrNull(simulationTimeS);
  const simulationDeltaS = currentSimulationTimeS != null && previousSimulationTimeS != null
    ? currentSimulationTimeS - previousSimulationTimeS : null;
  Object.assign(frameCounters, presentationTracker.sample(), {
    uiCallbacksPerSecond: frameCounters.renderFrames / elapsedS,
    physicsStepsPerSecond: frameCounters.physicsFrames / elapsedS,
    residentStepsPerSecond: frameCounters.residentFrames / elapsedS,
    simulatedSecondsPerWallSecond: simulationDeltaS != null && simulationDeltaS >= 0
      ? simulationDeltaS / elapsedS : null,
    lastSimulationSampleTimeS: currentSimulationTimeS,
    lastSampleMs: nowMs
  });
  frameCounters.renderFps = frameCounters.uiCallbacksPerSecond;
  frameCounters.physicsFps = frameCounters.physicsStepsPerSecond;
  frameCounters.residentFps = frameCounters.residentStepsPerSecond;
  frameCounters.renderFrames = 0;
  frameCounters.physicsFrames = 0;
  frameCounters.residentFrames = 0;
  return true;
}

export function sphDashboardCadenceText(counters = {}) {
  const rate = (value, digits = 1) => Number.isFinite(value)
    ? value.toFixed(digits) : 'unavailable';
  return [
    'visible unavailable updates/s',
    `presented ${rate(counters.presentedStatesPerSecond)} states/s`,
    `source ${rate(counters.sourceStatesPerSecond)} states/s`,
    `ui raf ${rate(counters.uiCallbacksPerSecond)} callbacks/s`,
    `physics ${rate(counters.physicsStepsPerSecond)} steps/s`,
    `resident ${rate(counters.residentStepsPerSecond)} steps/s`,
    `sim speed ${rate(counters.simulatedSecondsPerWallSecond, 3)} sim s/wall s`
  ].join(' | ');
}
