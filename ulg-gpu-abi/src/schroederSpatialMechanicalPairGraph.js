export const ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanical-pair-graph.v10';

export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_MAGIC = 0x4d50_4731;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_VERSION = 10;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS = 130;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORDS = 48;
// The matching-cleanup control buffer holds one fixed 12-word header plus
// eight per-pass evidence lanes (selection/copy/apply/wall counts, applied
// pair count, max position ratio, max velocity residual, contact-frontier
// count). The pass budget is a declared per-invocation solver parameter; the
// words scale with it.
export const
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_HEADER_WORDS = 12;
export const
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_LANE_COUNT = 8;
// Reference pass budget mirrored by the batch/native/diagnostic preset of the
// mechanical proposals solver. Callers with a different declared budget must
// size their control buffer through the function below.
export const
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_REFERENCE_PASSES = 1024;
export function schroederSpatialMechanicalMatchingCleanupControlWordsForPasses(
  matchingCleanupPasses
) {
  if (
    typeof matchingCleanupPasses !== 'number'
    || !Number.isInteger(matchingCleanupPasses)
    || matchingCleanupPasses < 1
    || matchingCleanupPasses > 0xffff_ffff
  ) {
    throw new RangeError(
      'matchingCleanupPasses must be a positive u32 integer'
    );
  }
  return SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_HEADER_WORDS
    + SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_LANE_COUNT
      * matchingCleanupPasses;
}
export const SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_WORDS =
  schroederSpatialMechanicalMatchingCleanupControlWordsForPasses(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_REFERENCE_PASSES
  );
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_INDIRECT_DISPATCH_WORDS = 3;
// The exact traversal decides on-GPU whether a certified zero-edge completion
// can replace the CSR solver. One dispatch triplet launches that path without
// a host readback; the ordinary solver stays direct and checks its control bit.
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_COUNT = 1;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_WORDS =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_INDIRECT_DISPATCH_WORDS;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_WORDS = 3;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_DIRECTED_ROW_WORDS = 1;
export const SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_MAGIC =
  0x4d49_5231;
export const SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_VERSION = 3;
export const SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS = 22;
export const SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS = 2;
export const SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_BUILDING =
  1 << 0;
export const SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_READY =
  1 << 1;
export const SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_ADMITTED =
  1 << 2;
export const SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_FAIL_CLOSED =
  1 << 3;
// Receipt v3 phase-reuses the four-word-per-directed-edge matching-constraint
// arena after its final residual/diagnostic reader. The core source offsets
// and {peer,signedArea} rows remain independently authoritative. When the
// remaining arena can also retain two cursor slots per published row, these
// words publish a source-local 50%-load exact hash for later thermal lookup.
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_ALGORITHM_SOURCE_LOCAL_LINEAR_PROBE = 1;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW = 2;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ARENA_WORDS_PER_DIRECTED_PAIR = 4;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_EMPTY = 0xffff_ffff;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_HASH_MULTIPLIER = 2654435761;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_ALGORITHM_WORD = 16;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_BASE_WORD = 17;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_SLOT_COUNT_WORD = 18;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_COMPLETED_SOURCE_COUNT_WORD = 19;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_INSERTED_CURSOR_COUNT_WORD = 20;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_WORD = 21;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_BUILDING =
    SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_BUILDING;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_READY =
    SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_READY;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_ADMITTED =
    SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_ADMITTED;
export const
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_FAIL_CLOSED =
    SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_FAIL_CLOSED;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATE_ROW_WORDS = 8;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCALE_ROW_WORDS = 4;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ENERGY_ROW_WORDS = 8;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_HEADER_WORDS = 16;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_ROW_WORDS = 8;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_PER_DIRECTED_PAIR =
  (SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_WORDS
    + SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_DIRECTED_ROW_WORDS)
  * Uint32Array.BYTES_PER_ELEMENT;

export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATUS = Object.freeze({
  READY: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATUS_READY,
  ADMITTED: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATUS_ADMITTED,
  FAIL_CLOSED: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATUS_FAIL_CLOSED
});

export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE = Object.freeze({
  INITIALIZED: 1 << 0,
  SUPPORT_REDUCED: 1 << 1,
  TRAVERSED: 1 << 2,
  SCANNED: 1 << 3,
  CSR_SCATTERED: 1 << 4,
  GRAPH_VERIFIED: 1 << 5,
  ITERATION_0: 1 << 6,
  ITERATION_1: 1 << 7,
  ITERATION_2: 1 << 8,
  ITERATION_3: 1 << 9,
  RESIDUAL_VERIFIED: 1 << 10,
  PROPOSAL_PUBLISHED: 1 << 11,
  COMMITTED: 1 << 12,
  ENERGY_ITERATION_0: 1 << 13,
  ENERGY_ITERATION_1: 1 << 14,
  ENERGY_ITERATION_2: 1 << 15,
  ENERGY_ITERATION_3: 1 << 16,
  ENERGY_VERIFIED: 1 << 17,
  ITERATION_4: 1 << 18,
  ITERATION_5: 1 << 19,
  ITERATION_6: 1 << 20,
  ITERATION_7: 1 << 21,
  ENERGY_ITERATION_4: 1 << 22,
  ENERGY_ITERATION_5: 1 << 23,
  ENERGY_ITERATION_6: 1 << 24,
  ENERGY_ITERATION_7: 1 << 25,
  // Iterations 8-15 retain exact individual completion counters below. These
  // two mask bits authenticate the extended solve/energy stage family without
  // exhausting the remaining u32 stage namespace.
  ITERATIONS_8_15: 1 << 26,
  ENERGY_ITERATIONS_8_15: 1 << 27,
  MATCHING_CLEANUP: 1 << 28,
  MATCHING_TRUST_RESTORED: 1 << 29,
  CONTACT_INTERFACE_RECEIPT_PUBLISHED: 1 << 30
});

export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_FAILURE = Object.freeze({
  DIRECTORY_REJECT: 1 << 0,
  MALFORMED_TRAVERSAL: 1 << 1,
  COUNTER_OVERFLOW: 1 << 2,
  GRAPH_CAPACITY: 1 << 3,
  SCAN_COUNT_MISMATCH: 1 << 4,
  CSR_BOUNDS_OR_RANK: 1 << 5,
  DUPLICATE_ENDPOINT: 1 << 6,
  MISSING_RECIPROCAL: 1 << 7,
  LEVEL_OR_SOURCE_IDENTITY: 1 << 8,
  NONFINITE: 1 << 9,
  ITERATION_INCOMPLETE: 1 << 10,
  POSITION_RESIDUAL: 1 << 11,
  VELOCITY_RESIDUAL: 1 << 12,
  HEADER_OR_EPOCH: 1 << 13,
  PUBLICATION_INCOMPLETE: 1 << 14,
  STAGE_ORDER: 1 << 15,
  ENERGY_GAIN: 1 << 16,
  ENERGY_CLOSURE: 1 << 17,
  NEGATIVE_INTERNAL_ENERGY: 1 << 18,
  CONTACT_INTERFACE_RECEIPT: 1 << 19
});

export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_LAYOUT =
  Object.freeze([
    'magic:u32',
    'abiVersion:u32',
    'generationId:u32',
    'storageGeneration:u32',
    'physicsTick:u32',
    'physicsSubstep:u32',
    'positionEpoch:u32',
    'topologyEpoch:u32',
    'supportEpoch:u32',
    'selectedLevel:i32-bits',
    'directedPairCapacity:u32',
    'appendAttemptCount:u32',
    'requiredDirectedPairCount:u32',
    'publishedCsrDirectedPairCount:u32',
    'stickyFailureBits:u32',
    'completedStageMask:u32',
    'validationCount:u32',
    'verificationCount:u32',
    'publicationCount:u32',
    'measureCount0:u32',
    'measureCount1:u32',
    'measureCount2:u32',
    'measureCount3:u32',
    'solveCount0:u32',
    'solveCount1:u32',
    'solveCount2:u32',
    'solveCount3:u32',
    'maxPositionResidualOrderedF32:u32',
    'maxVelocityResidualOrderedF32:u32',
    'dispatchIndirectX:u32',
    'dispatchIndirectY:u32',
    'dispatchIndirectZ:u32',
    'energyMeasureCount0:u32',
    'energyMeasureCount1:u32',
    'energyMeasureCount2:u32',
    'energyMeasureCount3:u32',
    'pairKineticDeltaJ:f32-bits',
    'pairHeatJ:f32-bits',
    'wallHeatJ:f32-bits',
    'energyResidualJ:f32-bits',
    'fullSolverPath:u32',
    'zeroEdgeDispatchX:u32',
    'zeroEdgeDispatchY:u32',
    'zeroEdgeDispatchZ:u32',
    'measureCount4:u32',
    'measureCount5:u32',
    'measureCount6:u32',
    'measureCount7:u32',
    'solveCount4:u32',
    'solveCount5:u32',
    'solveCount6:u32',
    'solveCount7:u32',
    'energyMeasureCount4:u32',
    'energyMeasureCount5:u32',
    'energyMeasureCount6:u32',
    'energyMeasureCount7:u32',
    'measureCount8:u32',
    'measureCount9:u32',
    'measureCount10:u32',
    'measureCount11:u32',
    'measureCount12:u32',
    'measureCount13:u32',
    'measureCount14:u32',
    'measureCount15:u32',
    'solveCount8:u32',
    'solveCount9:u32',
    'solveCount10:u32',
    'solveCount11:u32',
    'solveCount12:u32',
    'solveCount13:u32',
    'solveCount14:u32',
    'solveCount15:u32',
    'energyMeasureCount8:u32',
    'energyMeasureCount9:u32',
    'energyMeasureCount10:u32',
    'energyMeasureCount11:u32',
    'energyMeasureCount12:u32',
    'energyMeasureCount13:u32',
    'energyMeasureCount14:u32',
    'energyMeasureCount15:u32',
    'preSolveMaxPositionResidualOrderedF32_0:u32',
    'preSolveMaxPositionResidualOrderedF32_1:u32',
    'preSolveMaxPositionResidualOrderedF32_2:u32',
    'preSolveMaxPositionResidualOrderedF32_3:u32',
    'preSolveMaxPositionResidualOrderedF32_4:u32',
    'preSolveMaxPositionResidualOrderedF32_5:u32',
    'preSolveMaxPositionResidualOrderedF32_6:u32',
    'preSolveMaxPositionResidualOrderedF32_7:u32',
    'preSolveMaxPositionResidualOrderedF32_8:u32',
    'preSolveMaxPositionResidualOrderedF32_9:u32',
    'preSolveMaxPositionResidualOrderedF32_10:u32',
    'preSolveMaxPositionResidualOrderedF32_11:u32',
    'preSolveMaxPositionResidualOrderedF32_12:u32',
    'preSolveMaxPositionResidualOrderedF32_13:u32',
    'preSolveMaxPositionResidualOrderedF32_14:u32',
    'preSolveMaxPositionResidualOrderedF32_15:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_0:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_1:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_2:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_3:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_4:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_5:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_6:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_7:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_8:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_9:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_10:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_11:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_12:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_13:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_14:u32',
    'preSolveMaxPositionViolationRatioOrderedF32_15:u32',
    'preSolveMaxVelocityResidualOrderedF32_0:u32',
    'preSolveMaxVelocityResidualOrderedF32_1:u32',
    'preSolveMaxVelocityResidualOrderedF32_2:u32',
    'preSolveMaxVelocityResidualOrderedF32_3:u32',
    'preSolveMaxVelocityResidualOrderedF32_4:u32',
    'preSolveMaxVelocityResidualOrderedF32_5:u32',
    'preSolveMaxVelocityResidualOrderedF32_6:u32',
    'preSolveMaxVelocityResidualOrderedF32_7:u32',
    'preSolveMaxVelocityResidualOrderedF32_8:u32',
    'preSolveMaxVelocityResidualOrderedF32_9:u32',
    'preSolveMaxVelocityResidualOrderedF32_10:u32',
    'preSolveMaxVelocityResidualOrderedF32_11:u32',
    'preSolveMaxVelocityResidualOrderedF32_12:u32',
    'preSolveMaxVelocityResidualOrderedF32_13:u32',
    'preSolveMaxVelocityResidualOrderedF32_14:u32',
    'preSolveMaxVelocityResidualOrderedF32_15:u32',
    'matchingCleanupPassCount:u32',
    'matchingCleanupTrustRestoreCount:u32'
  ]);

export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_LAYOUT =
  Object.freeze([
    'magic:u32',
    'abiVersion:u32',
    'statusFlags:u32',
    'generationId:u32',
    'storageGeneration:u32',
    'physicsTick:u32',
    'physicsSubstep:u32',
    'positionEpoch:u32',
    'topologyEpoch:u32',
    'supportEpoch:u32',
    'selectedLevel:i32-bits',
    'particleCount:u32',
    'particleCapacity:u32',
    'directedPairCapacity:u32',
    'appendAttemptCount:u32',
    'stagedDirectedPairCount:u32',
    'requiredDirectedPairCount:u32',
    'publishedDirectedPairCount:u32',
    'overflowCount:u32',
    'invalidSourceCount:u32',
    'invalidPeerCount:u32',
    'duplicatePeerCount:u32',
    'asymmetricPeerCount:u32',
    'countPassCount:u32',
    'scanPassCount:u32',
    'scatterPassCount:u32',
    'verifyPassCount:u32',
    'publishPassCount:u32',
    'measurePassCount:u32',
    'solvePassCount:u32',
    'maxPositionResidualOrderedF32:u32',
    'maxVelocityResidualOrderedF32:u32',
    'energyMeasurePassCount:u32',
    'pairKineticDeltaJ:f32-bits',
    'pairHeatJ:f32-bits',
    'wallHeatJ:f32-bits',
    'energyResidualJ:f32-bits',
    'energyToleranceJ:f32-bits',
    'energyGainCount:u32',
    'negativeInternalEnergyCount:u32',
    'candidateVisitCount:u32',
    'aggregateSummaryPhaseMismatchCount:u32',
    'aggregateSummaryPreflightCount:u32',
    'aggregateHierarchyNodeVisitCount:u32',
    'aggregateHierarchyPrunedNodeCount:u32',
    'aggregateHierarchySourceCount:u32',
    'aggregateSummaryLineageMaterialMismatchCount:u32',
    // Counts only peers that reach endpoint metadata/predicate evaluation.
    // Unlike candidateVisitCount, this excludes aggregate projection entries
    // accounted for as dormant without being loaded from particle state.
    'projectedPeerVisitCount:u32'
  ]);

export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_INDIRECT_DISPATCH_LAYOUT =
  Object.freeze([
    'dispatchX:u32',
    'dispatchY:u32',
    'dispatchZ:u32'
  ]);

export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_LAYOUT =
  Object.freeze([
    'zeroEdgeDispatchX:u32',
    'zeroEdgeDispatchY:u32',
    'zeroEdgeDispatchZ:u32'
  ]);

function wordOffsetMap(layout) {
  return Object.freeze(Object.fromEntries(layout.map((field, word) => [
    field.slice(0, field.indexOf(':')),
    word
  ])));
}

export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD =
  wordOffsetMap(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_LAYOUT);
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD =
  wordOffsetMap(SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_LAYOUT);
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD_OFFSETS =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD_OFFSETS =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD;

export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_LAYOUT =
  Object.freeze([
    'sourceIndex:u32',
    'peerIndex:u32',
    'sourceLocalRank:u32'
  ]);
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_DIRECTED_ROW_LAYOUT =
  Object.freeze([
    'peerIndex:u32'
  ]);
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATE_ROW_LAYOUT =
  Object.freeze([
    'positionX:f32-bits',
    'positionY:f32-bits',
    'positionZ:f32-bits',
    'massKg:f32-bits',
    'velocityX:f32-bits',
    'velocityY:f32-bits',
    'velocityZ:f32-bits',
    'specificInternalEnergyJPerKg:f32-bits'
  ]);
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCALE_ROW_LAYOUT =
  Object.freeze([
    'barrierDxScale:f32-bits',
    'barrierDvScale:f32-bits',
    'softDxScale:f32-bits',
    'softDvScale:f32-bits'
  ]);
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ENERGY_ROW_LAYOUT =
  Object.freeze([
    'iterationQuadraticBudgetFraction:f32-bits',
    'iterationQuadraticEnergyJ:f32-bits',
    'iterationHalfLinearLossBudgetJ:f32-bits',
    'iterationWallKineticLossJ:f32-bits',
    'cumulativePairKineticDeltaJ:f32-bits',
    'cumulativePairHeatJ:f32-bits',
    'cumulativeWallHeatJ:f32-bits',
    'initialSpecificInternalEnergyJPerKg:f32-bits'
  ]);
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_ROW_LAYOUT =
  Object.freeze([
    'positionDeltaX:f32-bits',
    'positionDeltaY:f32-bits',
    'positionDeltaZ:f32-bits',
    'mechanicalHeatJ:f32-bits',
    'velocityDeltaX:f32-bits',
    'velocityDeltaY:f32-bits',
    'velocityDeltaZ:f32-bits',
    'specificInternalEnergyDeltaJPerKg:f32-bits'
  ]);

export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
  version: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_VERSION,
  controlLayout: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_LAYOUT,
  controlWord: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD,
  evidenceLayout: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_LAYOUT,
  evidenceWord: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD,
  indirectDispatchLayout:
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_INDIRECT_DISPATCH_LAYOUT,
  conditionalDispatchLayout:
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_LAYOUT,
  stagingRowLayout:
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_LAYOUT,
  directedRowLayout:
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_DIRECTED_ROW_LAYOUT,
  stateRowLayout: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATE_ROW_LAYOUT,
  scaleRowLayout: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCALE_ROW_LAYOUT,
  energyRowLayout: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ENERGY_ROW_LAYOUT,
  proposalRowLayout:
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_ROW_LAYOUT,
  stageBits: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE,
  stickyFailureBits: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_FAILURE,
  construction:
    'one-exact-near-traversal-atomic-append-source-count-exclusive-scan-deterministic-local-rank-scatter',
  stagingOrder: 'atomic-append-order-non-authoritative',
  directedCsrOrder:
    'source-major-then-exact-near-deterministic-source-local-rank',
  directedSourceIdentity: 'implicit-csr-source-offset-range',
  directedRowPayload: 'peer-source-index-u32',
  csrTerminator: 'sourceOffsets[particleCapacity]=requiredDirectedPairCount',
  reciprocityValidation:
    'each-source-range-rejects-duplicate-peer-and-each-peer-range-contains-exactly-one-reciprocal-source',
  countPolicy:
    'append-attempt-and-required-total-saturating-with-sticky-overflow',
  candidateVisitPolicy:
    'directory-member-visits-including-self-and-members-rejected-by-contact-filters-saturating-with-sticky-overflow',
  projectedPeerVisitPolicy:
    'post-active-projection peer endpoint metadata and pair-predicate visits; dormant entries represented only by candidate accounting are excluded',
  overflowPolicy:
    'fail-closed-zero-indirect-dispatch-and-no-truncated-prefix-publication',
  controlDispatchEvidence:
    'control-words-29-through-31-computed-dispatch-fields-evidence-only',
  indirectDispatchBufferPolicy:
    'dedicated-three-u32-storage-indirect-buffer-no-control-alias',
  conditionalDispatchBufferPolicy:
    'authenticated-control-zero-edge-triplet selects certified zero-edge completion, then the full-solver path phase-reuses the dedicated storage-indirect triplet for GPU-latched matching-cleanup particle dispatch without host readback',
  sortPolicy: 'none-csr-order-authored-by-exclusive-scan-and-source-local-rank',
  exactNearTraversalCount: 1,
  radixSortRequired: false,
  sentinelPaddingRequired: false,
  readbackPolicy: 'fixed-evidence-diagnostic-only',
  submissionOwnership: 'caller',
  bytesPerDirectedPair:
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_PER_DIRECTED_PAIR
});

const UINT32_MAX = 0xffff_ffff;
const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const DEFAULT_BYTE_LIMIT = Number.MAX_SAFE_INTEGER;

function positiveU32(value, label) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < 1
    || value > UINT32_MAX
  ) {
    throw new RangeError(`${label} must be a positive u32 integer`);
  }
  return value;
}

function positiveSafeInteger(value, label) {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 1
  ) {
    throw new RangeError(`${label} must be a positive safe integer byte count`);
  }
  return value;
}

function checkedAdd(left, right, label, { u32 = true } = {}) {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${label} exceeds the JavaScript safe-integer range`);
  }
  if (u32 && result > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32 word range`);
  }
  return result;
}

function checkedMultiply(left, right, label, { u32 = true } = {}) {
  const result = left * right;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${label} exceeds the JavaScript safe-integer range`);
  }
  if (u32 && result > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32 word range`);
  }
  return result;
}

function byteLengthForWords(wordLength, label) {
  return checkedMultiply(wordLength, UINT32_BYTES, `${label} byte length`, {
    u32: false
  });
}

function resolveDeviceLimits(deviceLimits) {
  if (deviceLimits == null) {
    return Object.freeze({
      maxBufferSize: DEFAULT_BYTE_LIMIT,
      maxStorageBufferBindingSize: DEFAULT_BYTE_LIMIT
    });
  }
  if (typeof deviceLimits !== 'object') {
    throw new TypeError('deviceLimits must be a WebGPU limits object or device');
  }
  const source = deviceLimits.limits ?? deviceLimits;
  return Object.freeze({
    maxBufferSize: positiveSafeInteger(
      source.maxBufferSize,
      'deviceLimits.maxBufferSize'
    ),
    maxStorageBufferBindingSize: positiveSafeInteger(
      source.maxStorageBufferBindingSize,
      'deviceLimits.maxStorageBufferBindingSize'
    )
  });
}

function resolveRetainedByteLimit({
  maxRetainedBytes = null,
  arenaByteLimit = null
} = {}) {
  if (
    maxRetainedBytes != null
    && arenaByteLimit != null
    && maxRetainedBytes !== arenaByteLimit
  ) {
    throw new RangeError('maxRetainedBytes and arenaByteLimit must match when both are supplied');
  }
  return positiveSafeInteger(
    maxRetainedBytes ?? arenaByteLimit ?? DEFAULT_BYTE_LIMIT,
    'maxRetainedBytes'
  );
}

function frozenBufferLayout(role, wordLength, { indirect = false } = {}) {
  return Object.freeze({
    role,
    wordLength,
    byteLength: byteLengthForWords(wordLength, role),
    storageBinding: true,
    indirect
  });
}

function computePairGraphBuffers(
  particleCapacity,
  directedPairCapacity,
  matchingCleanupControlWords
) {
  const sourceOffsetWordLength = checkedAdd(
    particleCapacity,
    1,
    'mechanical pair graph source-offset word length'
  );
  const stagingWordLength = checkedMultiply(
    directedPairCapacity,
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_WORDS,
    'mechanical pair graph append-staging word length'
  );
  const directedPeerWordLength = checkedMultiply(
    directedPairCapacity,
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_DIRECTED_ROW_WORDS,
    'mechanical pair graph directed-peer word length'
  );
  const scratchStateWordLength = checkedMultiply(
    particleCapacity,
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATE_ROW_WORDS,
    'mechanical pair graph scratch-state word length'
  );
  const scaleWordLength = checkedMultiply(
    particleCapacity,
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCALE_ROW_WORDS,
    'mechanical pair graph scale word length'
  );
  const proposalRowWordLength = checkedMultiply(
    particleCapacity,
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_ROW_WORDS,
    'mechanical pair graph proposal-row word length'
  );
  const proposalWordLength = checkedAdd(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_HEADER_WORDS,
    proposalRowWordLength,
    'mechanical pair graph proposal word length'
  );
  return Object.freeze([
    frozenBufferLayout(
      'mechanical-pair-graph-control',
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS
    ),
    frozenBufferLayout(
      'mechanical-pair-graph-evidence',
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORDS
    ),
    frozenBufferLayout(
      'mechanical-pair-graph-matching-cleanup-control',
      matchingCleanupControlWords
    ),
    frozenBufferLayout(
      'mechanical-pair-graph-indirect-dispatch',
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_INDIRECT_DISPATCH_WORDS,
      { indirect: true }
    ),
    frozenBufferLayout(
      'mechanical-pair-graph-conditional-dispatch',
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_WORDS,
      { indirect: true }
    ),
    frozenBufferLayout('mechanical-pair-graph-source-counts', particleCapacity),
    frozenBufferLayout(
      'mechanical-pair-graph-source-offsets',
      sourceOffsetWordLength
    ),
    frozenBufferLayout('mechanical-pair-graph-append-staging', stagingWordLength),
    frozenBufferLayout('mechanical-pair-graph-directed-peers', directedPeerWordLength),
    frozenBufferLayout('mechanical-pair-graph-scratch-state-a', scratchStateWordLength),
    frozenBufferLayout('mechanical-pair-graph-scratch-state-b', scratchStateWordLength),
    frozenBufferLayout('mechanical-pair-graph-scales', scaleWordLength),
    frozenBufferLayout('mechanical-pair-graph-proposals', proposalWordLength)
  ]);
}

function validateBufferLimits(buffers, limits) {
  for (const buffer of buffers) {
    if (buffer.byteLength > limits.maxBufferSize) {
      throw new RangeError(
        `${buffer.role} byte length ${buffer.byteLength} exceeds deviceLimits.maxBufferSize `
        + `${limits.maxBufferSize}`
      );
    }
    if (
      buffer.storageBinding
      && buffer.byteLength > limits.maxStorageBufferBindingSize
    ) {
      throw new RangeError(
        `${buffer.role} byte length ${buffer.byteLength} exceeds `
        + 'deviceLimits.maxStorageBufferBindingSize '
        + `${limits.maxStorageBufferBindingSize}`
      );
    }
  }
}

function keyedLengths(buffers, field) {
  return Object.freeze(Object.fromEntries(buffers.map((buffer) => [
    buffer.role,
    buffer[field]
  ])));
}

function maximumPhysicalDirectedPairs(particleCapacity) {
  if (particleCapacity > 65536) return UINT32_MAX;
  return particleCapacity * (particleCapacity - 1);
}

function minimumInterfaceReceiptDirectedCapacity(particleCapacity) {
  const receiptPrefixWords =
    SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS
      + particleCapacity + 1;
  const maximumPublished = maximumPhysicalDirectedPairs(particleCapacity);
  const denseCapacity = Math.ceil(
    receiptPrefixWords
      / (
        SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ARENA_WORDS_PER_DIRECTED_PAIR
          - SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS
      )
  );
  const capacity = denseCapacity <= maximumPublished
    ? denseCapacity
    : Math.ceil(
        (
          receiptPrefixWords
            + maximumPublished
              * SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS
        )
          / SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ARENA_WORDS_PER_DIRECTED_PAIR
      );
  if (capacity < 1 || capacity > UINT32_MAX) {
    throw new RangeError(
      'mechanical interface receipt capacity is unrepresentable'
    );
  }
  return capacity;
}

export function createSchroederSpatialMechanicalPairGraphLayout({
  particleCapacity,
  directedPairCapacity,
  // Declared matching-cleanup pass budget. The reference (batch) preset keeps
  // existing callers byte-identical; per-invocation budgets must be threaded
  // explicitly so CONTROL_WORDS sizing follows the passed budget.
  matchingCleanupPasses =
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_REFERENCE_PASSES,
  maxRetainedBytes = null,
  arenaByteLimit = null,
  deviceLimits = null
} = {}) {
  const resolvedParticleCapacity = positiveU32(
    particleCapacity,
    'particleCapacity'
  );
  const resolvedDirectedPairCapacity = positiveU32(
    directedPairCapacity,
    'directedPairCapacity'
  );
  const resolvedMatchingCleanupPasses = positiveU32(
    matchingCleanupPasses,
    'matchingCleanupPasses'
  );
  const matchingCleanupControlWords =
    schroederSpatialMechanicalMatchingCleanupControlWordsForPasses(
      resolvedMatchingCleanupPasses
    );
  const resolvedDeviceLimits = resolveDeviceLimits(deviceLimits);
  const resolvedMaxRetainedBytes = resolveRetainedByteLimit({
    maxRetainedBytes,
    arenaByteLimit
  });
  const buffers = computePairGraphBuffers(
    resolvedParticleCapacity,
    resolvedDirectedPairCapacity,
    matchingCleanupControlWords
  );
  validateBufferLimits(buffers, resolvedDeviceLimits);
  const retainedWordLength = buffers.reduce((sum, buffer) => checkedAdd(
    sum,
    buffer.wordLength,
    'mechanical pair graph retained word length',
    { u32: false }
  ), 0);
  const retainedByteLength = byteLengthForWords(
    retainedWordLength,
    'mechanical pair graph retained arena'
  );
  if (retainedByteLength > resolvedMaxRetainedBytes) {
    throw new RangeError(
      `mechanical pair graph retained byte length ${retainedByteLength} exceeds `
      + `maxRetainedBytes ${resolvedMaxRetainedBytes}`
    );
  }
  const fixedRetainedByteLength = retainedByteLength
    - resolvedDirectedPairCapacity
      * SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_PER_DIRECTED_PAIR;
  const [
    control,
    evidence,
    matchingCleanupControl,
    indirectDispatch,
    conditionalDispatch,
    sourceCounts,
    sourceOffsets,
    appendStaging,
    directedPeers,
    scratchStateA,
    scratchStateB,
    scales,
    proposals
  ] = buffers;
  const energyLedger = Object.freeze({
    role: 'mechanical-pair-graph-energy-ledger',
    wordLength: resolvedParticleCapacity
      * SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ENERGY_ROW_WORDS,
    byteLength: resolvedParticleCapacity
      * SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ENERGY_ROW_WORDS
      * UINT32_BYTES,
    storageBinding: true,
    indirect: false,
    aliased: true,
    aliasOf: proposals.role,
    aliasWordOffset:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_HEADER_WORDS,
    aliasByteOffset:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_HEADER_WORDS
        * UINT32_BYTES
  });
  const interfaceReceiptMaximumPublishedRows = Math.min(
    resolvedDirectedPairCapacity,
    maximumPhysicalDirectedPairs(resolvedParticleCapacity)
  );
  const interfaceReceiptPrefixWordLength =
    SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS
      + resolvedParticleCapacity + 1;
  const interfaceReceiptBaseWordLength =
    interfaceReceiptPrefixWordLength
      + interfaceReceiptMaximumPublishedRows
        * SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS;
  const interfaceReceiptWordLength = checkedMultiply(
    resolvedDirectedPairCapacity,
    SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ARENA_WORDS_PER_DIRECTED_PAIR,
    'mechanical contact interface receipt arena word length'
  );
  const interfaceReceiptMaximumIndexedRows = Math.min(
    interfaceReceiptMaximumPublishedRows,
    Math.floor(
      (interfaceReceiptWordLength - interfaceReceiptPrefixWordLength)
        / (
          SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS
            + SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW
        )
    )
  );
  const interfaceReceipt = Object.freeze({
    role: 'mechanical-contact-interface-receipt',
    wordLength: interfaceReceiptWordLength,
    byteLength: interfaceReceiptWordLength * UINT32_BYTES,
    storageBinding: true,
    indirect: false,
    aliased: true,
    externalPhaseAlias: true,
    aliasOf: 'mechanical-matching-constraint-arena',
    aliasWordOffset: 0,
    aliasByteOffset: 0,
    aliasLifetime:
      'matching-constraints-through-final-residual-and-diagnostic-verification-then-interface-receipt-through-thermal-consumer-release',
    prefixWordLength: interfaceReceiptPrefixWordLength,
    baseWordLength: interfaceReceiptBaseWordLength,
    arenaWordsPerDirectedPair:
      SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ARENA_WORDS_PER_DIRECTED_PAIR,
    indexSlotsPerPublishedRow:
      SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW,
    maximumPublishedRows: interfaceReceiptMaximumPublishedRows,
    maximumIndexedRows: interfaceReceiptMaximumIndexedRows,
    fullDirectedCapacity:
      interfaceReceiptMaximumPublishedRows === resolvedDirectedPairCapacity,
    fullPublishedRangeIndexed:
      interfaceReceiptMaximumIndexedRows
        === interfaceReceiptMaximumPublishedRows
  });
  if (interfaceReceiptBaseWordLength > interfaceReceipt.wordLength) {
    throw new RangeError(
      `mechanical contact interface receipt base word length `
      + `${interfaceReceiptBaseWordLength} exceeds phase-reused matching-constraint `
      + `arena word length ${interfaceReceipt.wordLength}`
    );
  }
  validateBufferLimits([interfaceReceipt], resolvedDeviceLimits);
  const bufferLayouts = Object.freeze({
    control,
    evidence,
    matchingCleanupControl,
    indirectDispatch,
    conditionalDispatch,
    sourceCounts,
    sourceOffsets,
    appendStaging,
    directedPeers,
    scratchStateA,
    scratchStateB,
    scales,
    energyLedger,
    interfaceReceipt,
    proposals
  });
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
    status: 'schroeder-spatial-mechanical-pair-graph-layout-ready',
    particleCapacity: resolvedParticleCapacity,
    directedPairCapacity: resolvedDirectedPairCapacity,
    controlWords: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS,
    evidenceWords: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORDS,
    matchingCleanupPasses: resolvedMatchingCleanupPasses,
    matchingCleanupControlWords,
    indirectDispatchWords:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_INDIRECT_DISPATCH_WORDS,
    conditionalDispatchWords:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_WORDS,
    conditionalDispatchCount:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONDITIONAL_DISPATCH_COUNT,
    sourceCountWordLength: resolvedParticleCapacity,
    sourceOffsetWordLength: resolvedParticleCapacity + 1,
    stagingRowWords: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_WORDS,
    stagingWordLength:
      resolvedDirectedPairCapacity
        * SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_WORDS,
    directedRowWords: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_DIRECTED_ROW_WORDS,
    directedPeerWordLength: resolvedDirectedPairCapacity,
    scratchStateRowWords:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATE_ROW_WORDS,
    scratchStateWordLength:
      resolvedParticleCapacity
        * SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATE_ROW_WORDS,
    scaleRowWords: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCALE_ROW_WORDS,
    scaleWordLength:
      resolvedParticleCapacity
        * SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCALE_ROW_WORDS,
    energyRowWords: SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ENERGY_ROW_WORDS,
    energyWordLength:
      resolvedParticleCapacity
        * SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_ENERGY_ROW_WORDS,
    energyLedgerAliasedToProposalRows: true,
    energyLedgerAliasWordOffset:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_HEADER_WORDS,
    energyLedgerAliasByteOffset:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_HEADER_WORDS
        * UINT32_BYTES,
    energyLedgerAliasLifetime: 'solver-scratch-until-proposal-publication',
    interfaceReceiptHeaderWords:
      SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS,
    interfaceReceiptRowWords:
      SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS,
    interfaceReceiptMaximumPublishedRows,
    interfaceReceiptMaximumIndexedRows,
    interfaceReceiptPrefixWordLength,
    interfaceReceiptBaseWordLength,
    interfaceReceiptWordLength,
    interfaceReceiptAliasedToAppendStaging: false,
    interfaceReceiptAliasedToMatchingConstraintArena: true,
    interfaceReceiptAliasLifetime: interfaceReceipt.aliasLifetime,
    proposalHeaderWords:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_HEADER_WORDS,
    proposalRowWords:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_ROW_WORDS,
    proposalWordLength:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_HEADER_WORDS
        + resolvedParticleCapacity
          * SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_PROPOSAL_ROW_WORDS,
    bytesPerDirectedPair:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_PER_DIRECTED_PAIR,
    fixedRetainedByteLength,
    retainedWordLength,
    retainedByteLength,
    maxRetainedBytes: resolvedMaxRetainedBytes,
    maxBufferSize: resolvedDeviceLimits.maxBufferSize,
    maxStorageBufferBindingSize:
      resolvedDeviceLimits.maxStorageBufferBindingSize,
    buffers,
    bufferAliases: Object.freeze([energyLedger, interfaceReceipt]),
    bufferLayouts,
    bufferWordLengths: keyedLengths(buffers, 'wordLength'),
    bufferByteLengths: keyedLengths(buffers, 'byteLength'),
    indirectDispatchBufferRole: 'mechanical-pair-graph-indirect-dispatch',
    indirectDispatchOffsetWords: 0,
    indirectDispatchOffsetBytes: 0,
    conditionalDispatchBufferRole: 'mechanical-pair-graph-conditional-dispatch',
    conditionalDispatchOffsetWords: 0,
    conditionalDispatchOffsetBytes: 0,
    conditionalDispatchSourceOffsetWords:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .zeroEdgeDispatchX,
    conditionalDispatchSourceOffsetBytes:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .zeroEdgeDispatchX * UINT32_BYTES,
    controlDispatchEvidenceOffsetWords:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.dispatchIndirectX,
    controlDispatchEvidenceOffsetBytes:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.dispatchIndirectX
        * UINT32_BYTES,
    readbackRequired: false
  });
}

export function createSchroederSpatialMechanicalPairGraphCapacityPlan({
  particleCapacity,
  maximumDirectedPairCapacity = UINT32_MAX,
  minimumDirectedPairCapacity = 1,
  matchingCleanupPasses =
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_REFERENCE_PASSES,
  maxRetainedBytes = null,
  arenaByteLimit = null,
  deviceLimits = null
} = {}) {
  const resolvedParticleCapacity = positiveU32(
    particleCapacity,
    'particleCapacity'
  );
  const resolvedMatchingCleanupPasses = positiveU32(
    matchingCleanupPasses,
    'matchingCleanupPasses'
  );
  const resolvedMaximumDirectedPairCapacity = positiveU32(
    maximumDirectedPairCapacity,
    'maximumDirectedPairCapacity'
  );
  const resolvedMinimumDirectedPairCapacity = positiveU32(
    minimumDirectedPairCapacity,
    'minimumDirectedPairCapacity'
  );
  const interfaceReceiptMinimumDirectedCapacity =
    minimumInterfaceReceiptDirectedCapacity(resolvedParticleCapacity);
  const effectiveMinimumDirectedPairCapacity = Math.max(
    resolvedMinimumDirectedPairCapacity,
    interfaceReceiptMinimumDirectedCapacity
  );
  if (
    effectiveMinimumDirectedPairCapacity
      > resolvedMaximumDirectedPairCapacity
  ) {
    throw new RangeError(
      `effective minimum directed-pair capacity `
      + `${effectiveMinimumDirectedPairCapacity} exceeds `
      + `maximumDirectedPairCapacity ${resolvedMaximumDirectedPairCapacity}; `
      + `caller minimum is ${resolvedMinimumDirectedPairCapacity} and `
      + `interface-receipt minimum is `
      + `${interfaceReceiptMinimumDirectedCapacity}`
    );
  }
  const resolvedDeviceLimits = resolveDeviceLimits(deviceLimits);
  const resolvedMaxRetainedBytes = resolveRetainedByteLimit({
    maxRetainedBytes,
    arenaByteLimit
  });

  // The minimum receipt-safe provisional graph validates every fixed-size
  // particle/control buffer through the exact checked layout path. Its
  // directed-row bytes are then removed to recover the capacity-independent
  // base.
  const provisional = createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: resolvedParticleCapacity,
    directedPairCapacity: interfaceReceiptMinimumDirectedCapacity,
    matchingCleanupPasses: resolvedMatchingCleanupPasses,
    maxRetainedBytes: DEFAULT_BYTE_LIMIT,
    deviceLimits: resolvedDeviceLimits
  });
  const fixedRetainedByteLength = provisional.retainedByteLength
    - interfaceReceiptMinimumDirectedCapacity
      * SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_PER_DIRECTED_PAIR;
  const availablePairBytes = resolvedMaxRetainedBytes - fixedRetainedByteLength;
  const perBufferLimit = Math.min(
    resolvedDeviceLimits.maxBufferSize,
    resolvedDeviceLimits.maxStorageBufferBindingSize
  );
  const capacityLimits = Object.freeze({
    requestedMaximum: resolvedMaximumDirectedPairCapacity,
    retainedByteBudget: Math.max(
      0,
      Math.floor(
        availablePairBytes
          / SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_PER_DIRECTED_PAIR
      )
    ),
    stagingU32Words: Math.floor(
      UINT32_MAX
        / SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_WORDS
    ),
    stagingMaxBufferSize: Math.floor(
      resolvedDeviceLimits.maxBufferSize
        / (SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_WORDS
          * UINT32_BYTES)
    ),
    stagingMaxStorageBufferBindingSize: Math.floor(
      resolvedDeviceLimits.maxStorageBufferBindingSize
        / (SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_WORDS
          * UINT32_BYTES)
    ),
    interfaceReceiptArenaU32Words: Math.floor(
      UINT32_MAX
        / SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ARENA_WORDS_PER_DIRECTED_PAIR
    ),
    interfaceReceiptArenaMaxBufferSize: Math.floor(
      resolvedDeviceLimits.maxBufferSize
        / (
          SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ARENA_WORDS_PER_DIRECTED_PAIR
            * UINT32_BYTES
        )
    ),
    interfaceReceiptArenaMaxStorageBufferBindingSize: Math.floor(
      resolvedDeviceLimits.maxStorageBufferBindingSize
        / (
          SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ARENA_WORDS_PER_DIRECTED_PAIR
            * UINT32_BYTES
        )
    ),
    directedPeerMaxBufferSize: Math.floor(
      resolvedDeviceLimits.maxBufferSize
        / (SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_DIRECTED_ROW_WORDS
          * UINT32_BYTES)
    ),
    directedPeerMaxStorageBufferBindingSize: Math.floor(
      resolvedDeviceLimits.maxStorageBufferBindingSize
        / (SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_DIRECTED_ROW_WORDS
          * UINT32_BYTES)
    ),
    perStorageBinding: Math.floor(
      perBufferLimit
        / (SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGING_ROW_WORDS
          * UINT32_BYTES)
    )
  });
  const directedPairCapacity = Math.min(...Object.values(capacityLimits));
  if (directedPairCapacity < effectiveMinimumDirectedPairCapacity) {
    throw new RangeError(
      `mechanical pair graph maxRetainedBytes ${resolvedMaxRetainedBytes} cannot `
      + `admit the required ${effectiveMinimumDirectedPairCapacity} directed pairs `
      + `after fixed retained buffers; device/budget capacity is ${directedPairCapacity}`
    );
  }
  const limitingFactors = Object.freeze(Object.entries(capacityLimits)
    .filter(([, value]) => value === directedPairCapacity)
    .map(([name]) => name));
  const layout = createSchroederSpatialMechanicalPairGraphLayout({
    particleCapacity: resolvedParticleCapacity,
    directedPairCapacity,
    matchingCleanupPasses: resolvedMatchingCleanupPasses,
    maxRetainedBytes: resolvedMaxRetainedBytes,
    deviceLimits: resolvedDeviceLimits
  });
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
    status: 'schroeder-spatial-mechanical-pair-graph-capacity-plan-ready',
    particleCapacity: resolvedParticleCapacity,
    directedPairCapacity,
    matchingCleanupPasses: resolvedMatchingCleanupPasses,
    minimumDirectedPairCapacity: resolvedMinimumDirectedPairCapacity,
    effectiveMinimumDirectedPairCapacity,
    interfaceReceiptMinimumDirectedCapacity,
    maximumDirectedPairCapacity: resolvedMaximumDirectedPairCapacity,
    fixedRetainedByteLength,
    bytesPerDirectedPair:
      SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_PER_DIRECTED_PAIR,
    maxRetainedBytes: resolvedMaxRetainedBytes,
    maxBufferSize: resolvedDeviceLimits.maxBufferSize,
    maxStorageBufferBindingSize:
      resolvedDeviceLimits.maxStorageBufferBindingSize,
    capacityLimits,
    limitingFactors,
    layout,
    readbackRequired: false
  });
}
