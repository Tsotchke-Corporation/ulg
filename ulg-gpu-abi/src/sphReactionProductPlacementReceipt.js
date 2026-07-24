export const ULG_SPH_REACTION_PRODUCT_PLACEMENT_COMPLETION_RECEIPT_SCHEMA =
  'peercompute.ulg.sph-reaction-product-placement-completion-receipt.v5';

// "RPP9" in little-endian-friendly hexadecimal. The compact receipt remains
// GPU-resident on the canonical hot path; the exact submit wrapper copies it
// only when an explicit diagnostic observation was requested.
export const SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC = 0x52505039;
export const SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION = 5;
export const SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS = 78;
export const SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES =
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS * Uint32Array.BYTES_PER_ELEMENT;

export const SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS = Object.freeze({
  PENDING: 0,
  COMPLETE: 1,
  CANONICAL_DECISION_REJECTED: 2,
  CONTRACT_REJECTED: 3
});

// Final same-command publication result. This is distinct from `status`,
// which records whether the speculative placement contract itself completed.
// A successor may consume the no-readback submission only because the exact
// encoded terminal protocol guarantees one of the two SAFE outcomes.
export const SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS = Object.freeze({
  PENDING: 0,
  SAFE_PLACED: 1,
  SAFE_FROZEN_FALLBACK: 2,
  UNSAFE: 3
});

export const SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS = Object.freeze({
  PREFIX_SCAN_CAPACITY: 1 << 0,
  ATOMIC_COUNTER: 1 << 1,
  MOTION_BOUND_REJECTED: 1 << 2
});

export const SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_LAYOUT = Object.freeze([
  'magic:u32',
  'version:u32',
  'generationId:u32',
  'supportProfileId:u32',
  'eventCapacity:u32',
  'compactCountPassCount:u32',
  'compactScanPassCount:u32',
  'compactScatterPassCount:u32',
  'activeEventCount:u32',
  'compactionInputVisitCount:u32',
  'compactionLiveFlagCount:u32',
  'compactionOverflowCount:u32',
  'envelopePartialPassCount:u32',
  'envelopeFinalizePassCount:u32',
  'envelopeInputVisitCount:u32',
  'envelopeAdmitted:u32',
  'classifierPassCount:u32',
  'classifierReadyCount:u32',
  'classifierRejectedCount:u32',
  'classifierUnknownCount:u32',
  'ssCellVisitCount:u32',
  'ssMemberVisitCount:u32',
  'ssMaterialPhaseFilterCount:u32',
  'ssCaptureHitCount:u32',
  'spareFlagPassCount:u32',
  'spareScanPassCount:u32',
  'spareAssignPassCount:u32',
  'spareCandidateVisitCount:u32',
  'spareAvailableCount:u32',
  'spareAssignedCount:u32',
  'applyPassCount:u32',
  'applyVisitedCount:u32',
  'directOnlyEventCount:u32',
  'sparePlacementEventCount:u32',
  'captureMergeEventCount:u32',
  'fallbackEventCount:u32',
  'subthresholdEventCount:u32',
  'noCarrierEventCount:u32',
  'rejectedEventCount:u32',
  'unknownDispositionCount:u32',
  'serialConflictFoldPassCount:u32',
  'serialConflictFoldEventCount:u32',
  'maxSerialConflictFoldSize:u32',
  'mutationConflictRetryCount:u32',
  'privateLookupBuildCount:u32',
  'exhaustiveTraversalCount:u32',
  'overflowFlags:u32',
  'status:u32',
  'applyPreflightPassCount:u32',
  'intentEmitPassCount:u32',
  'mutationIntentCapacity:u32',
  'mutationIntentCount:u32',
  'destinationRadixPassCount:u32',
  'destinationSegmentReducePassCount:u32',
  'destinationApplyPassCount:u32',
  'destinationIntentVisitedCount:u32',
  'destinationMutationCount:u32',
  'maxDestinationSegmentSize:u32',
  'summaryRadixPassCount:u32',
  'summarySegmentReducePassCount:u32',
  'summaryApplyPassCount:u32',
  'summaryContributionCount:u32',
  'globalSerialEventFoldCount:u32',
  'hostCompletionReadbackCount:u32',
  'transactionalPublishPassCount:u32',
  'transactionalVisitedParticleCount:u32',
  'transactionalCommittedParticleCount:u32',
  'transactionalFallbackParticleCount:u32',
  'transactionalEventPublishPassCount:u32',
  'transactionalVisitedEventRowCount:u32',
  'transactionalCommittedEventRowCount:u32',
  'transactionalFallbackEventRowCount:u32',
  'transactionalSummaryPublishPassCount:u32',
  'transactionalVisitedSummaryRowCount:u32',
  'transactionalCommittedSummaryRowCount:u32',
  'transactionalFallbackSummaryRowCount:u32',
  'transactionalTerminalSealPassCount:u32',
  'transactionalTerminalStatus:u32'
]);

export const SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX = Object.freeze(
  Object.fromEntries(
    SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_LAYOUT.map((field, index) => [
      field.slice(0, field.indexOf(':')),
      index
    ])
  )
);
