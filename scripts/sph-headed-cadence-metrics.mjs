const DEFAULT_NOMINAL_PRESENTATION_HZ = 60;

export const HEADED_SWEEP_IGNORED_PAGE_ERRORS = Object.freeze([
  'WebSocket closed without opened.'
]);

const headedSweepIgnoredPageErrorSet = new Set(
  HEADED_SWEEP_IGNORED_PAGE_ERRORS
);

export function classifyHeadedSweepPageErrors(pageErrors = []) {
  const captured = Array.isArray(pageErrors) ? pageErrors : [];
  return Object.freeze({
    actionablePageErrors: Object.freeze(captured.filter((text) => (
      !headedSweepIgnoredPageErrorSet.has(text)
    ))),
    ignoredPageErrors: Object.freeze(captured.filter((text) => (
      headedSweepIgnoredPageErrorSet.has(text)
    )))
  });
}

// The native worker records the submitted passes after GPU completion. Every
// frame clears opaque color/depth, optionally renders refraction, optionally
// composites the ready medium against that depth, then draws vapor/overlays.
// This validates order only; readiness, optics and visible cadence stay separate.
export function isWorkerIsosurfacePassOrderValid(passOrder, {
  mediumRequired
} = {}) {
  if (!Array.isArray(passOrder) || typeof mediumRequired !== 'boolean') {
    return false;
  }
  const expected = ['opaque-isosurface'];
  if (passOrder[1] === 'refractive-isosurface') {
    expected.push('refractive-isosurface');
  }
  if (mediumRequired) expected.push('depth-clipped-participating-medium');
  expected.push('transparent-isosurface-and-overlay');
  return passOrder.length === expected.length
    && expected.every((pass, index) => passOrder[index] === pass);
}

// Rate failures are separate from evidence-integrity failures for diagnostics.
// The all-preset acceptance sweep requires BOTH for every renderer; an explicit
// throughputRequired:false is diagnostic-only, not a passing preset contract.
// Unknown issue ids deliberately remain integrity failures.
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
  throughputRequired = true
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

export {
  SPH_PRESENTATION_CADENCE_EVIDENCE,
  visiblePresentationIdentity,
  summarizeVisiblePresentationCadence
} from '../src/visualization/sphPresentationCadence.js';

// Numerical render-input cadence is useful diagnostic evidence, but cannot
// certify the requested visible-motion rate without independent change proof.
export function visibleMotionCadenceAcceptanceIssues(sample) {
  return sample?.visibleMotionCadenceVerified === true
    ? [] : ['visible-motion-change-evidence-missing'];
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
