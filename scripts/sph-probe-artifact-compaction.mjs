export const PROBE_ARTIFACT_DETAIL_MODES = Object.freeze([
  'full',
  'visual-compact'
]);

const VISUAL_COMPACTION_SCHEMA =
  'peercompute.ulg.sph-probe-visual-artifact-compaction.v1';
const VISUAL_SETTLEMENT_REPLAY_RELEASE_SCHEMA =
  'peercompute.ulg.sph-probe-visual-settlement-replay-release.v1';

const VISUAL_SETTLEMENT_REPLAY_ARRAY_FIELDS = Object.freeze([
  'schroederSameLevelMechanicsSummaries',
  'schroederSpatialEpochTransactionSummaries',
  'schroederHierarchyArtifactLedgerSummaries',
  'stepSummaries',
  'schroederUploadProvenance',
  'schroederSuccessorSourceFamilyRetirementReceipts'
]);

const VISUAL_SETTLEMENT_PROMISE_FIELDS = Object.freeze([
  'schroederSuccessorSourceFamilyRetirementPromise',
  'schroederSpatialEpochSettlementPromise',
  'schroederBackgroundSettlementPromise'
]);

export function normalizeProbeArtifactDetailMode(value = 'full') {
  const normalized = String(value || 'full').trim().toLowerCase();
  if (!PROBE_ARTIFACT_DETAIL_MODES.includes(normalized)) {
    throw new Error(
      `Unsupported SPH probe artifact detail mode "${value}"; expected `
      + PROBE_ARTIFACT_DETAIL_MODES.join(' or ')
    );
  }
  return normalized;
}

function arrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Remove replay-only per-step Schroeder histories from a visual-gate metric.
 *
 * The exact per-step surface-stress submissions remain in the artifact. Visual
 * acceptance therefore keeps its fail-closed proof for every requested step,
 * while transaction/generation/resource-ledger settlement stays represented by
 * the production aggregate counts and completeness booleans already present on
 * residentSteps.
 */
export function compactVisualProbeMetric(
  metric,
  { detailMode = 'visual-compact' } = {}
) {
  const normalizedMode = normalizeProbeArtifactDetailMode(detailMode);
  if (normalizedMode === 'full' || !metric?.residentSteps) {
    return metric;
  }

  const {
    schroederSpatialEpochTransactionSummaries,
    schroederSpatialEpochGenerationSummaries,
    schroederHierarchyArtifactLedgerSummaries,
    ...retainedResidentSteps
  } = metric.residentSteps;

  return {
    ...metric,
    residentSteps: {
      ...retainedResidentSteps,
      artifactCompaction: {
        schema: VISUAL_COMPACTION_SCHEMA,
        status: 'replay-only-schroeder-step-histories-omitted',
        detailMode: normalizedMode,
        exactSurfaceStressSubmissionsRetained: true,
        retainedSurfaceStressSubmissionCount: arrayLength(
          retainedResidentSteps.phaseVolumeSurfaceStressSubmissions
        ),
        omittedArrayItemCounts: {
          schroederSpatialEpochTransactionSummaries: arrayLength(
            schroederSpatialEpochTransactionSummaries
          ),
          schroederSpatialEpochGenerationSummaries: arrayLength(
            schroederSpatialEpochGenerationSummaries
          ),
          schroederHierarchyArtifactLedgerSummaries: arrayLength(
            schroederHierarchyArtifactLedgerSummaries
          )
        }
      }
    }
  };
}

/**
 * Refresh settlement evidence on an already compacted visual metric without
 * restoring the replay-only histories that compaction removed.
 *
 * Background settlement completes after the metric is first retained. The
 * probe must therefore update the aggregate settlement proof in place, while
 * keeping the browser heap and final JSON bounded by recording only the exact
 * number of omitted replay rows.
 */
export function refreshCompactedVisualSettlementEvidence(
  residentSteps,
  settledExecution
) {
  if (!residentSteps || !settledExecution) {
    throw new Error(
      'Compacted visual settlement refresh requires resident steps and a settled execution'
    );
  }
  const compaction = residentSteps.artifactCompaction;
  if (
    compaction?.schema !== VISUAL_COMPACTION_SCHEMA
    || compaction?.detailMode !== 'visual-compact'
  ) {
    throw new Error(
      'Compacted visual settlement refresh requires exact visual-compaction metadata'
    );
  }

  const transactionSummaryCount = arrayLength(
    settledExecution.schroederSpatialEpochTransactionSummaries
  );
  const artifactLedgerSummaryCount = arrayLength(
    settledExecution.schroederHierarchyArtifactLedgerSummaries
  );

  // Delete defensively as well as declining to reattach: this keeps a metric
  // bounded even if a future caller refreshes one that was compacted late.
  delete residentSteps.schroederSpatialEpochTransactionSummaries;
  delete residentSteps.schroederSpatialEpochGenerationSummaries;
  delete residentSteps.schroederHierarchyArtifactLedgerSummaries;

  residentSteps.schroederSpatialEpochReleaseSettlementCount =
    settledExecution.schroederSpatialEpochReleaseSettlementCount ?? null;
  residentSteps.schroederSpatialEpochReleaseSettlementComplete =
    settledExecution.schroederSpatialEpochReleaseSettlementComplete === true;
  residentSteps.schroederHierarchyArtifactLedgerSettlementCount =
    settledExecution.schroederHierarchyArtifactLedgerSettlementCount ?? null;
  residentSteps.schroederHierarchyArtifactLedgerSettlementComplete =
    settledExecution.schroederHierarchyArtifactLedgerSettlementComplete === true;
  residentSteps.artifactCompaction = {
    ...compaction,
    omittedArrayItemCounts: {
      ...(compaction.omittedArrayItemCounts || {}),
      schroederSpatialEpochTransactionSummaries: transactionSummaryCount,
      schroederHierarchyArtifactLedgerSummaries: artifactLedgerSummaryCount
    }
  };

  return residentSteps;
}

/**
 * Release replay-only state from a superseded visual execution after its
 * successor has consumed the continuation and authenticated settlement.
 *
 * The execution remains usable by deferred GPU cleanup: finalStep,
 * nextParticleUploads, continuation buffers, and queue-ordered consumer
 * capabilities are deliberately retained. Only per-step diagnostic arrays
 * and resolved diagnostic promise handles are removed.
 */
export function releaseCompactedVisualSettlementReplayState(
  settledExecution
) {
  if (!settledExecution || typeof settledExecution !== 'object') {
    throw new Error(
      'Compacted visual replay release requires a settled execution'
    );
  }
  if (
    settledExecution.schroederSpatialEpochReleaseSettlementComplete !== true
    || settledExecution
      .schroederHierarchyArtifactLedgerSettlementComplete !== true
    || (
      Number(
        settledExecution
          .schroederSuccessorSourceFamilyRetirementScheduledCount
      ) > 0
      && settledExecution
        .schroederSuccessorSourceFamilyRetirementComplete !== true
    )
  ) {
    throw new Error(
      'Compacted visual replay release requires complete owner settlement'
    );
  }

  const promiseDescriptors = VISUAL_SETTLEMENT_PROMISE_FIELDS.map(
    (field) => [
      field,
      Object.getOwnPropertyDescriptor(settledExecution, field) ?? null
    ]
  );
  const nonReleasablePromise = promiseDescriptors.find(
    ([, descriptor]) => descriptor && descriptor.configurable !== true
  );
  if (nonReleasablePromise) {
    throw new Error(
      `Compacted visual replay promise ${nonReleasablePromise[0]} is not releasable`
    );
  }

  const releasedArrayItemCounts = Object.fromEntries(
    VISUAL_SETTLEMENT_REPLAY_ARRAY_FIELDS.map((field) => [
      field,
      arrayLength(settledExecution[field])
    ])
  );
  const releasedPromiseFields = promiseDescriptors
    .filter(([, descriptor]) => descriptor)
    .map(([field]) => field);
  const queueOrderedCleanupCapability =
    settledExecution.queueOrderedPriorResidentExecutionFinalConsumer
    ?? null;

  for (const field of VISUAL_SETTLEMENT_REPLAY_ARRAY_FIELDS) {
    delete settledExecution[field];
  }
  for (const field of releasedPromiseFields) {
    delete settledExecution[field];
  }

  return Object.freeze({
    schema: VISUAL_SETTLEMENT_REPLAY_RELEASE_SCHEMA,
    status: 'settled-replay-state-released',
    releasedArrayItemCounts: Object.freeze(releasedArrayItemCounts),
    releasedPromiseFields: Object.freeze(releasedPromiseFields),
    continuationStateRetained: Boolean(
      settledExecution.finalStep
      && settledExecution.nextParticleUploads
    ),
    queueOrderedCleanupCapabilityAvailable: Boolean(
      queueOrderedCleanupCapability
    ),
    // A missing optional capability is not a release failure. This receipt
    // answers whether compaction discarded a capability that existed, while
    // `queueOrderedCleanupCapabilityAvailable` records whether the runtime
    // supplied one for this execution in the first place.
    queueOrderedCleanupCapabilityRetained: Boolean(
      !queueOrderedCleanupCapability
      || settledExecution.queueOrderedPriorResidentExecutionFinalConsumer
        === queueOrderedCleanupCapability
    )
  });
}
