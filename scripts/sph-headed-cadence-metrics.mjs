const DEFAULT_NOMINAL_PRESENTATION_HZ = 60;

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
 * Count only distinct, admitted visual states observed on animation frames.
 * A source-step jump of K is one presentation, not K frames. Repeated RAFs,
 * canvas redraws, and presentation serial churn with unchanged visual input
 * are deliberately ignored. A future temporal presentation path may provide
 * an admitted motion-frame identity when it actually advances the geometry.
 */
export function summarizeVisiblePresentationCadence(observations, {
  sampleDurationMs
} = {}) {
  const durationMs = finiteOrNull(sampleDurationMs);
  const rows = Array.isArray(observations) ? observations : [];
  const ownerCohorts = new Set();
  const presentationCohorts = new Set();
  const sourceIdentities = new Set();
  const visualIdentities = new Set();
  const visualTransitionIntervalsMs = [];
  const sourceTransitionIntervalsMs = [];
  const admissionBlockerCounts = new Map();
  let observedPresentationCount = 0;
  let visualTransitionCount = 0;
  let sourceTransitionCount = 0;
  let invalidObservationCount = 0;
  let presentationSerialRegressionCount = 0;
  let presentationCohortTransitionCount = 0;
  let sourceStepRegressionCount = 0;
  let motionFrameRegressionCount = 0;
  let timestampRegressionCount = 0;
  let lastObservedTimestampMs = null;
  let lastObservedCohortIdentity = null;
  let lastValidCohortIdentity = null;
  let lastSourceStep = null;
  let lastMotionFrameSerial = null;
  let lastVisualTransitionAtMs = null;
  let lastSourceTransitionAtMs = null;
  let lastPresentationSerial = null;

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
    const visualIdentity = visiblePresentationIdentity(observation);
    if (
      timestampMs != null
      && lastObservedTimestampMs != null
      && timestampMs < lastObservedTimestampMs
    ) {
      timestampRegressionCount += 1;
    }
    if (timestampMs != null) lastObservedTimestampMs = timestampMs;
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
      || !visualIdentity
    ) {
      invalidObservationCount += 1;
      continue;
    }
    observedPresentationCount += 1;
    sourceIdentities.add(`${fullCohortIdentity}|step:${sourceStep}`);
    visualIdentities.add(visualIdentity);

    const presentationSerial = safeIntegerOrNull(observation?.presentationSerial);
    if (
      fullCohortIdentity === lastValidCohortIdentity
      && presentationSerial != null
      && lastPresentationSerial != null
      && presentationSerial < lastPresentationSerial
    ) {
      presentationSerialRegressionCount += 1;
    }
    if (presentationSerial != null) lastPresentationSerial = presentationSerial;

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
      continue;
    }
    if (fullCohortIdentity !== lastValidCohortIdentity) {
      lastValidCohortIdentity = fullCohortIdentity;
      lastSourceStep = sourceStep;
      lastMotionFrameSerial = admittedMotionFrame ? motionFrameSerial : null;
      lastVisualTransitionAtMs = timestampMs;
      lastSourceTransitionAtMs = timestampMs;
      lastPresentationSerial = presentationSerial;
      continue;
    }

    let visualAdvanced = false;
    if (sourceStep > lastSourceStep) {
      sourceTransitionCount += 1;
      const sourceIntervalMs = timestampMs - lastSourceTransitionAtMs;
      if (Number.isFinite(sourceIntervalMs) && sourceIntervalMs > 0) {
        sourceTransitionIntervalsMs.push(sourceIntervalMs);
      }
      lastSourceTransitionAtMs = timestampMs;
      lastSourceStep = sourceStep;
      lastMotionFrameSerial = admittedMotionFrame ? motionFrameSerial : null;
      visualAdvanced = true;
    } else if (sourceStep < lastSourceStep) {
      sourceStepRegressionCount += 1;
    } else if (admittedMotionFrame) {
      if (
        lastMotionFrameSerial == null
        || motionFrameSerial > lastMotionFrameSerial
      ) {
        lastMotionFrameSerial = motionFrameSerial;
        visualAdvanced = true;
      } else if (motionFrameSerial < lastMotionFrameSerial) {
        motionFrameRegressionCount += 1;
      }
    }

    if (visualAdvanced) {
      const intervalMs = timestampMs - lastVisualTransitionAtMs;
      if (Number.isFinite(intervalMs) && intervalMs > 0) {
        visualTransitionIntervalsMs.push(intervalMs);
      }
      visualTransitionCount += 1;
      lastVisualTransitionAtMs = timestampMs;
    }
  }

  const meanVisiblePresentationHz = durationMs > 0
    ? visualTransitionCount * 1000 / durationMs
    : null;
  const medianVisualIntervalMs = median(visualTransitionIntervalsMs);
  const p95VisualIntervalMs = percentile(visualTransitionIntervalsMs, 0.95);
  const meanSourcePresentationHz = durationMs > 0
    ? sourceTransitionCount * 1000 / durationMs
    : null;
  const medianSourceIntervalMs = median(sourceTransitionIntervalsMs);
  return Object.freeze({
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
    presentationSerialRegressionCount,
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
    meanSourcePresentationHz,
    medianSourcePresentationHz: medianSourceIntervalMs > 0
      ? 1000 / medianSourceIntervalMs
      : null,
    visualTransitionIntervalsMs: Object.freeze(visualTransitionIntervalsMs),
    sourceTransitionIntervalsMs: Object.freeze(sourceTransitionIntervalsMs)
  });
}

export function evaluateCadenceSample(sample, {
  minimumHz = DEFAULT_NOMINAL_PRESENTATION_HZ * 0.9,
  targetHz = DEFAULT_NOMINAL_PRESENTATION_HZ
} = {}) {
  const sampleDurationMs = finiteOrNull(sample?.sampleDurationMs);
  const rafFrameCount = Number(sample?.rafFrameCount);
  const visualTransitionCount = Number(sample?.visualTransitionCount);
  const meanVisiblePresentationHz = finiteOrNull(sample?.meanVisiblePresentationHz);
  const medianVisiblePresentationHz = finiteOrNull(sample?.medianVisiblePresentationHz);
  const observedPresentationCount = Number(sample?.observedPresentationCount);
  const presentationOwnerCohortCount = Number(sample?.presentationOwnerCohortCount);
  const presentationCohortCount = Number(sample?.presentationCohortCount);
  const presentationCohortTransitionCount = Number(
    sample?.presentationCohortTransitionCount
  );
  const presentationSerialRegressionCount = Number(
    sample?.presentationSerialRegressionCount
  );
  const sourceStepRegressionCount = Number(sample?.sourceStepRegressionCount);
  const motionFrameRegressionCount = Number(sample?.motionFrameRegressionCount);
  const timestampRegressionCount = Number(sample?.timestampRegressionCount);
  const p95VisualIntervalEquivalentHz = finiteOrNull(
    sample?.p95VisualIntervalEquivalentHz
  );
  const requiredVisualTransitionCount = sampleDurationMs > 0
    ? Math.ceil(minimumHz * sampleDurationMs / 1000)
    : null;
  const issues = [];
  if (sample?.documentVisibility !== 'visible') issues.push('document-not-visible');
  if (sample?.documentHasFocus !== true) issues.push('document-not-focused');
  if (sample?.finalDocumentVisibility !== 'visible') {
    issues.push('document-not-visible-at-window-end');
  }
  if (sample?.finalDocumentHasFocus !== true) {
    issues.push('document-not-focused-at-window-end');
  }
  if (!(sampleDurationMs >= 5_000)) issues.push('cadence-window-too-short');
  if (!(Number.isSafeInteger(rafFrameCount) && rafFrameCount > 0)) {
    issues.push('raf-samples-missing');
  }
  if (!(Number.isSafeInteger(observedPresentationCount) && observedPresentationCount > 1)) {
    issues.push('visible-presentation-observations-missing');
  }
  if (!(Number.isSafeInteger(visualTransitionCount) && visualTransitionCount > 0)) {
    issues.push('visible-presentation-transitions-missing');
  }
  if (
    Number.isSafeInteger(visualTransitionCount)
    && Number.isSafeInteger(requiredVisualTransitionCount)
    && visualTransitionCount < requiredVisualTransitionCount
  ) {
    issues.push('visible-presentation-transition-count-below-target');
  }
  if (
    Number.isSafeInteger(visualTransitionCount)
    && Number.isSafeInteger(rafFrameCount)
    && visualTransitionCount > rafFrameCount
  ) {
    issues.push('visible-presentation-transitions-exceed-raf-samples');
  }
  if (!(meanVisiblePresentationHz >= minimumHz)) {
    issues.push('mean-visible-presentation-below-target');
  }
  if (!(medianVisiblePresentationHz >= minimumHz)) {
    issues.push('median-visible-presentation-below-target');
  }
  if (!(p95VisualIntervalEquivalentHz >= minimumHz)) {
    issues.push('p95-visible-presentation-below-target');
  }
  if (presentationOwnerCohortCount !== 1) {
    issues.push('presentation-owner-unstable');
  }
  if (presentationCohortCount !== 1 || presentationCohortTransitionCount > 0) {
    issues.push('presentation-source-cohort-unstable');
  }
  if (presentationSerialRegressionCount > 0) {
    issues.push('presentation-serial-regressed');
  }
  if (sourceStepRegressionCount > 0) {
    issues.push('presentation-source-step-regressed');
  }
  if (motionFrameRegressionCount > 0) {
    issues.push('presentation-motion-frame-regressed');
  }
  if (timestampRegressionCount > 0) {
    issues.push('presentation-observation-time-regressed');
  }
  return Object.freeze({
    status: issues.length === 0 ? 'pass' : 'fail',
    targetHz,
    minimumMeasuredHz: minimumHz,
    requiredVisualTransitionCount,
    issues: Object.freeze(issues)
  });
}
