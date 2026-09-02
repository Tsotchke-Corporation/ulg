const DEFAULT_NOMINAL_PRESENTATION_HZ = 60;

// These failures describe rate rather than evidence integrity. They are the
// only cadence failures that the all-preset sweep may waive for presets whose
// acceptance contract is progression/correctness rather than 54 Hz visual
// throughput. Unknown issue ids deliberately remain integrity failures.
export const VISIBLE_PRESENTATION_THROUGHPUT_ISSUES = Object.freeze([
  'visible-presentation-transitions-missing',
  'visible-presentation-transition-count-below-target',
  'mean-visible-presentation-below-target',
  'sustained-visible-presentation-below-target',
  'visible-presentation-stall-exceeds-budget'
]);

const visiblePresentationThroughputIssueSet = new Set(
  VISIBLE_PRESENTATION_THROUGHPUT_ISSUES
);

export function classifyCadenceAcceptanceIssues(issues, {
  throughputRequired = false
} = {}) {
  const uniqueIssues = [...new Set(
    (Array.isArray(issues) ? issues : [])
      .filter((issue) => typeof issue === 'string' && issue.length > 0)
  )];
  const throughputIssues = uniqueIssues.filter((issue) => (
    visiblePresentationThroughputIssueSet.has(issue)
  ));
  const integrityIssues = uniqueIssues.filter((issue) => (
    !visiblePresentationThroughputIssueSet.has(issue)
  ));
  return Object.freeze({
    throughputRequired: throughputRequired === true,
    throughputIssues: Object.freeze(throughputIssues),
    integrityIssues: Object.freeze(integrityIssues),
    acceptanceIssues: Object.freeze([
      ...integrityIssues,
      ...(throughputRequired === true ? throughputIssues : [])
    ])
  });
}

export function resolveHeadedSweepAutomatedDisposition({
  automatedFailureCount = 0,
  completeCannedMatrix = false,
  diagnosticOverridesActive = false
} = {}) {
  const failureCount = Number(automatedFailureCount);
  if (!Number.isSafeInteger(failureCount) || failureCount < 0) {
    throw new RangeError('automatedFailureCount must be a nonnegative integer');
  }
  if (failureCount > 0) {
    return Object.freeze({
      status: 'fail',
      automatedStatus: 'fail',
      acceptanceEligible: false,
      manualVisualReviewStatus: 'blocked-by-automated-failure'
    });
  }
  if (completeCannedMatrix !== true || diagnosticOverridesActive === true) {
    return Object.freeze({
      status: 'diagnostic-pass',
      automatedStatus: 'pass',
      acceptanceEligible: false,
      manualVisualReviewStatus: 'not-acceptance-eligible'
    });
  }
  return Object.freeze({
    status: 'pending-manual-visual-review',
    automatedStatus: 'pass',
    acceptanceEligible: false,
    manualVisualReviewStatus: 'pending'
  });
}

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

    let sourceAdvanced = false;
    let motionAdvanced = false;
    if (sourceStep > lastSourceStep) {
      sourceAdvanced = true;
    } else if (sourceStep < lastSourceStep) {
      sourceStepRegressionCount += 1;
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
  const presentationSerialStallCount = Number(
    sample?.presentationSerialStallCount
  );
  const sourceStepRegressionCount = Number(sample?.sourceStepRegressionCount);
  const motionFrameRegressionCount = Number(sample?.motionFrameRegressionCount);
  const timestampRegressionCount = Number(sample?.timestampRegressionCount);
  const maximumVisiblePresentationGapMs = finiteOrNull(
    sample?.maximumVisiblePresentationGapMs
  );
  const sustainedWindowDurationMs = finiteOrNull(
    sample?.sustainedWindowDurationMs
  );
  const minimumSustainedWindowTransitionCount = safeIntegerOrNull(
    sample?.minimumSustainedWindowTransitionCount
  );
  const p95VisualIntervalEquivalentHz = finiteOrNull(
    sample?.p95VisualIntervalEquivalentHz
  );
  const maximumAllowedVisiblePresentationGapMs = Number(minimumHz) > 0
    ? 3 * 1000 / Number(minimumHz)
    : null;
  const requiredSustainedWindowTransitionCount = (
    Number(minimumHz) > 0
    && sustainedWindowDurationMs > 0
  )
    ? Math.max(
        0,
        Math.ceil(Number(minimumHz) * sustainedWindowDurationMs / 1000) - 1
      )
    : null;
  const minimumSustainedWindowBoundaryAdjustedHz = (
    minimumSustainedWindowTransitionCount != null
    && sustainedWindowDurationMs > 0
  )
    ? (minimumSustainedWindowTransitionCount + 1)
      * 1000 / sustainedWindowDurationMs
    : null;
  const requiredVisualTransitionCount = sampleDurationMs > 0
    ? Math.floor(minimumHz * sampleDurationMs / 1000)
    : null;
  const boundaryAdjustedMeanVisiblePresentationHz = (
    sampleDurationMs > 0
    && Number.isSafeInteger(visualTransitionCount)
    && visualTransitionCount >= 0
  )
    ? (visualTransitionCount + 1) * 1000 / sampleDurationMs
    : null;
  const meetsMinimumHz = (value) => (
    Number.isFinite(value)
    && value + 1e-6 >= minimumHz
  );
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
  if (
    !meetsMinimumHz(meanVisiblePresentationHz)
    && !meetsMinimumHz(boundaryAdjustedMeanVisiblePresentationHz)
  ) {
    issues.push('mean-visible-presentation-below-target');
  }
  if (
    minimumSustainedWindowTransitionCount == null
    || requiredSustainedWindowTransitionCount == null
    || minimumSustainedWindowTransitionCount
      < requiredSustainedWindowTransitionCount
  ) {
    issues.push('sustained-visible-presentation-below-target');
  }
  // Median and p95 inverse-interval rates are valuable frame-pacing
  // diagnostics, but they are not valid throughput gates across refresh
  // rates. For example, an exact 54 Hz stream on a 60 Hz display must repeat
  // one vsync periodically, producing a 33 ms interval and a nominal 30 Hz
  // p95 despite meeting the requested throughput. Gate the actual transition
  // count/mean plus every 500 ms window above, then reject a genuine held-frame
  // stall of three minimum-rate periods here.
  if (
    !Number.isFinite(maximumVisiblePresentationGapMs)
    || !Number.isFinite(maximumAllowedVisiblePresentationGapMs)
    || maximumVisiblePresentationGapMs
      > maximumAllowedVisiblePresentationGapMs + 1e-6
  ) {
    issues.push('visible-presentation-stall-exceeds-budget');
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
  if (presentationSerialStallCount > 0) {
    issues.push('presentation-serial-stalled-on-visual-transition');
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
    boundaryAdjustedMeanVisiblePresentationHz,
    maximumVisiblePresentationGapMs,
    maximumAllowedVisiblePresentationGapMs,
    sustainedWindowDurationMs,
    minimumSustainedWindowTransitionCount,
    requiredSustainedWindowTransitionCount,
    minimumSustainedWindowBoundaryAdjustedHz,
    medianVisiblePresentationHz,
    p95VisualIntervalEquivalentHz,
    tailIntervalRatesDiagnosticOnly: true,
    issues: Object.freeze(issues)
  });
}
