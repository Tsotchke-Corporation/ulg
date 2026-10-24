import { exactWorkerRouteLineage } from '../runtime/sph/schroederWorkerScheduleRouteEvidence.js';

const BOOTSTRAP_SCHEMA = 'peercompute.ulg.isosurface-source-timing-bootstrap.v0';
const BOOTSTRAP_METHOD = 'seeded-source-interval-bootstrap';
const finiteNonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const integerNonnegative = value => Number.isSafeInteger(value) && value >= 0;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

// Private rendering evidence, not a new physics/authority receipt. Copy before
// asynchronous capture: the retained upload and caller objects are live aliases.
export function snapshotIsosurfaceSourceTimingBootstrap(value) {
  if (value?.schema !== BOOTSTRAP_SCHEMA) return null;
  const sourceLineage = exactWorkerRouteLineage(value.sourceLineage);
  const targetLineage = exactWorkerRouteLineage(value.targetLineage);
  const version = value.candidateVersion;
  if (!sourceLineage || !targetLineage
    || !(targetLineage.physicsTick > sourceLineage.physicsTick)
    || ![value.sourceTimeS, value.terminalSourceTimeS, value.sourceObservedAtMs].every(finiteNonnegative)
    || !(value.terminalSourceTimeS > value.sourceTimeS)
    || ![value.scheduleId, value.laneId, value.stateKey].every(nonempty)
    || !integerNonnegative(value.presentationLaneEpoch)
    || !version || version.scheduleId !== value.scheduleId
    || ![version.residentExecutionGeneration, version.nextStep, version.stepOrdinal].every(integerNonnegative)) return null;
  return Object.freeze({
    schema: BOOTSTRAP_SCHEMA,
    scheduleId: value.scheduleId, laneId: value.laneId, stateKey: value.stateKey,
    presentationLaneEpoch: value.presentationLaneEpoch,
    candidateVersion: Object.freeze({
      residentExecutionGeneration: version.residentExecutionGeneration,
      nextStep: version.nextStep, scheduleId: version.scheduleId, stepOrdinal: version.stepOrdinal
    }),
    sourceTimeS: value.sourceTimeS, sourceObservedAtMs: value.sourceObservedAtMs,
    terminalSourceTimeS: value.terminalSourceTimeS,
    sourceLineage: Object.freeze(sourceLineage), targetLineage: Object.freeze(targetLineage)
  });
}

function bootstrapMatchesFrame(bootstrap, frame) {
  if (!bootstrap || !frame) return false;
  const receipt = frame.receiptFields;
  return receipt?.residentScheduleCandidatePresentation === true
    && receipt.stateManagerCommittedPresentation === true
    && receipt.committedPresentationSchema === 'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0'
    && receipt.committedPresentationStatus === 'state-manager-committed-resident-schedule-presentation-admission'
    && receipt.authorityStatus === 'state-manager-committed-worker-schedule'
    && receipt.computeManagerCompletionSchema === 'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0'
    && nonempty(receipt.computeManagerLeaseId)
    && receipt.computeManagerLeaseStatus === 'completed'
    && receipt.computeManagerFenceSatisfied === true
    && receipt.stateManagerCommitStatus === 'committed'
    && receipt.stateManagerCommitAccepted === true
    && receipt.terminalScheduleFence === true
    && receipt.terminalFenceScope === 'resident-schedule-terminal'
    && receipt.terminalFenceSatisfied === true
    && receipt.terminalFenceAuthorityAdmissionReady === true
    && ['scheduleId', 'laneId', 'stateKey', 'presentationLaneEpoch'].every(key => receipt[key] === bootstrap[key])
    && receipt.residentExecutionGeneration === bootstrap.candidateVersion.residentExecutionGeneration
    && receipt.stepOrdinal === bootstrap.candidateVersion.stepOrdinal
    && receipt.sphStep === bootstrap.candidateVersion.nextStep
    && frame.sphStep === bootstrap.candidateVersion.nextStep
    && frame.sourceTimeS === bootstrap.terminalSourceTimeS;
}

// Presentation pacing only. These values never advance the authoritative clock.
export function createIsosurfaceMotionPacing(frame, previousFrame, presentedAtMs, sourceTimingBootstrap = null,
  { pausedWallDeltaMs = 0 } = {}) {
  // A real predecessor always wins, including a rejected/regressed pair: never
  // disguise an invalid source handoff as a fresh bootstrap.
  const bootstrap = previousFrame == null
    ? snapshotIsosurfaceSourceTimingBootstrap(sourceTimingBootstrap) : null;
  if (previousFrame == null && !bootstrapMatchesFrame(bootstrap, frame)) return null;
  const sourceTimeS = frame?.sourceTimeS;
  const previousTimeS = bootstrap ? bootstrap.sourceTimeS : previousFrame?.sourceTimeS;
  const previousWallMs = bootstrap ? bootstrap.sourceObservedAtMs : previousFrame?.sourcePresentedAtMs;
  if (![sourceTimeS, previousTimeS, presentedAtMs, previousWallMs]
    .every(value => typeof value === 'number' && Number.isFinite(value))) return null;
  const sourceDeltaS = sourceTimeS - previousTimeS;
  if (!finiteNonnegative(pausedWallDeltaMs)) return null;
  const wallDeltaS = (presentedAtMs - previousWallMs - pausedWallDeltaMs) / 1000;
  if (!(sourceDeltaS > 0) || !(wallDeltaS > 0)
    || (previousFrame != null && (!(frame.sphStep > previousFrame.sphStep)
    || frame.receiptFields?.laneId !== previousFrame.receiptFields?.laneId
    || frame.receiptFields?.stateKey !== previousFrame.receiptFields?.stateKey))) return null;
  // Forecast arrival jitter in WALL time, never by extending the physical
  // motion envelope. Compare rates because consecutive schedules may cover
  // different simulation intervals. Keep the raw observation, not this
  // forecast, as history: feeding padded budgets back would compound delay.
  const observedWallSecondsPerSimulationSecond = wallDeltaS / sourceDeltaS;
  const previousPacing = previousFrame?.motionPacing;
  // Cold seed-to-first-presentation latency is not an observed inter-frame
  // arrival rate; it must not pad subsequent real-frame jitter forecasts.
  const previousRate = previousPacing?.pacingMethod !== BOOTSTRAP_METHOD
    && previousPacing?.sourceTimeS === previousTimeS
    ? previousPacing.observedWallSecondsPerSimulationSecond : null;
  const hasPreviousRate = typeof previousRate === 'number'
    && Number.isFinite(previousRate) && previousRate > 0;
  const arrivalRateBudget = hasPreviousRate
    ? Math.max(observedWallSecondsPerSimulationSecond, previousRate)
      + Math.max(0, observedWallSecondsPerSimulationSecond - previousRate)
    : observedWallSecondsPerSimulationSecond;
  const maxWallAgeS = sourceDeltaS * arrivalRateBudget;
  const simulationTimeScale = sourceDeltaS / maxWallAgeS;
  if (![sourceDeltaS, observedWallSecondsPerSimulationSecond, maxWallAgeS,
    simulationTimeScale].every(value => Number.isFinite(value) && value > 0)) return null;
  return Object.freeze({
    sourceTimeS, startedAtMs: presentedAtMs,
    simulationTimeScale,
    maxSimulationAgeS: sourceDeltaS,
    maxWallAgeS,
    observedWallSecondsPerSimulationSecond,
    pacingMethod: bootstrap ? BOOTSTRAP_METHOD : 'two-source-interval-jitter-budget',
    targetHz: 60,
    method: 'bounded-gpu-field-velocity-extrapolation',
    authoritativeStateMutation: false
  });
}

// Pause accounting is separate from real submission/admission timestamps.
// Admitted sources retain cumulative snapshots, so no interval history grows
// with playback duration. A late bootstrap can resolve the current/latest
// interval or the known initial prefix; older ambiguous anchors fail closed.
export function createPresentationPauseClock() {
  let playing = true;
  let pausedSinceMs = null;
  let completedPausedMs = 0;
  let firstPauseMs = null;
  let latestPause = null;
  let lastTransitionMs = null;
  return Object.freeze({
    setPlaying(value, atMs) {
      if (typeof value !== 'boolean') throw new TypeError('presentation playing must be a boolean');
      if (value === playing) return false;
      if (!finiteNonnegative(atMs) || (lastTransitionMs != null && atMs < lastTransitionMs)) {
        throw new TypeError('presentation playback requires a monotonic wall clock');
      }
      if (!value) {
        firstPauseMs ??= atMs;
        pausedSinceMs = atMs;
      } else {
        latestPause = { startMs: pausedSinceMs, endMs: atMs, pausedBeforeMs: completedPausedMs };
        completedPausedMs += atMs - pausedSinceMs;
        pausedSinceMs = null;
      }
      lastTransitionMs = atMs;
      playing = value;
      return true;
    },
    pausedAt(atMs) {
      if (!finiteNonnegative(atMs)) return null;
      if (firstPauseMs == null || atMs <= firstPauseMs) return 0;
      if (pausedSinceMs != null && atMs >= pausedSinceMs) {
        return completedPausedMs + atMs - pausedSinceMs;
      }
      if (latestPause && atMs >= latestPause.endMs) return completedPausedMs;
      if (latestPause && atMs >= latestPause.startMs) {
        return latestPause.pausedBeforeMs + atMs - latestPause.startMs;
      }
      return completedPausedMs === 0 ? 0 : null;
    }
  });
}

export function resumeIsosurfaceMotionPacing(pacing, atMs, admittedAgeS) {
  if (!pacing || !finiteNonnegative(atMs) || !finiteNonnegative(admittedAgeS)
    || atMs < pacing.startedAtMs || admittedAgeS > pacing.maxSimulationAgeS) return pacing;
  const rate = pacing.segmentSimulationTimeScale ?? pacing.simulationTimeScale;
  if (!(Number.isFinite(rate) && rate > 0)) return pacing;
  return Object.freeze({
    ...pacing,
    segmentAnchorAtMs: atMs,
    segmentAnchorAgeS: admittedAgeS,
    segmentSimulationTimeScale: rate
  });
}

export function isosurfaceMotionAge(pacing, atMs) {
  if (!pacing || !Number.isFinite(atMs) || atMs < pacing.startedAtMs) return null;
  const anchorAtMs = pacing.segmentAnchorAtMs ?? pacing.startedAtMs;
  if (atMs < anchorAtMs) return null;
  const elapsedS = (atMs - anchorAtMs) / 1000;
  return Math.min(pacing.maxSimulationAgeS,
    (pacing.segmentAnchorAgeS ?? 0)
      + elapsedS * (pacing.segmentSimulationTimeScale ?? pacing.simulationTimeScale));
}

// A pending schedule's executed-iteration rate is a work-time forecast, NOT
// admitted physics. Spend only the still-unused display age more slowly when
// that measured forecast exceeds its remaining wall budget. Raw source timing
// and its original forecast stay intact for the next admitted source pair.
export function slowIsosurfaceMotionPacing(pacing, atMs, remainingWallS, lastDisplayedMotionAgeS = 0) {
  if (!pacing || !finiteNonnegative(lastDisplayedMotionAgeS)
    || !(Number.isFinite(remainingWallS) && remainingWallS > 0)) return pacing;
  const clockAgeS = isosurfaceMotionAge(pacing, atMs);
  const ageS = Math.max(clockAgeS ?? NaN, lastDisplayedMotionAgeS);
  const remainingAgeS = pacing.maxSimulationAgeS - ageS;
  const currentRate = pacing.segmentSimulationTimeScale ?? pacing.simulationTimeScale;
  const nextRate = remainingAgeS / remainingWallS;
  if (!(Number.isFinite(ageS) && ageS >= 0 && remainingAgeS > 0)
    || !(Number.isFinite(currentRate) && currentRate > 0)
    || !(Number.isFinite(nextRate) && nextRate > 0 && nextRate < currentRate)
    || !Number.isFinite(atMs + remainingWallS * 1000)) return pacing;
  return Object.freeze({
    ...pacing,
    segmentAnchorAtMs: atMs,
    segmentAnchorAgeS: ageS,
    segmentSimulationTimeScale: nextRate
  });
}
