// Extracted from schroederSpatialMechanicalProposalsGpu.js (Gate 6 Phase D mechanical decomposition).

import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  createSchroederSpatialExactNearTraversalV1Wgsl,
  createSchroederSpatialExactNearTraversalV2Wgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNearTraversalWgsl.js';
import {
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAGIC,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_RANKS_PER_LANE,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_VERSION,
  ULG_SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_SCHEMA,
  validateSchroederSpatialActiveRankViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialActiveRankView.js';
import {
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_FAILURE,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_VERSION,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ARENA_WORDS_PER_DIRECTED_PAIR,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_ALGORITHM_SOURCE_LOCAL_LINEAR_PROBE,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_ALGORITHM_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_BASE_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_COMPLETED_SOURCE_COUNT_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_EMPTY,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_HASH_MULTIPLIER,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_INSERTED_CURSOR_COUNT_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_SLOT_COUNT_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_BUILDING,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_STATUS_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_BUILDING,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_PASS_CAP_FALLBACK,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_VERSION,
  ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
  createSchroederSpatialMechanicalPairGraphCapacityPlan,
  schroederSpatialMechanicalMatchingCleanupControlWordsForPasses
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicalPairGraph.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_ABSOLUTE_M,
  SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER,
  SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS
} from './sphCanonicalContactMotionBound.js';


export const ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanical-proposal.v3';
export const ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_BUFFER_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanical-proposal-buffer.v3';
export const ULG_SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanical-interface-receipt.v3';
export const ULG_SCHROEDER_SPATIAL_CONSUMER_GPU_EVIDENCE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-consumer-gpu-evidence.v3';
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS =
  'schroeder-spatial-mechanical-contact-graph-prepared';
export const SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY =
  'post-g2p-state-with-swept-pre-integration-ss-directory';
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE =
  'proposal-deferred-to-post-mechanics';
export const ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_CAPTURE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanical-proposal-capture.v1';
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_CAPTURE_MODE =
  'history-and-final-mechanical-v1';

export const SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS = Object.freeze([
  Object.freeze({
    consumerId: 'pressure-contact-interface',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1
  }),
  Object.freeze({
    consumerId: 'separation',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1
  }),
  Object.freeze({
    consumerId: 'local-material-interface',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1
  })
]);

export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC = 0x4d50_4831;
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_VERSION = 3;
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS = 16;
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS = 8;
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_FLOATS = 8;
export const SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORDS;
export const SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS = 16;
export const SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES = 1024;
export const SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES = 1024;
// Chunked owner encoding: every single-workgroup owner dispatch runs this
// many LOGICAL cleanup passes in an in-shader loop with workgroup/storage
// barriers between passes, instead of one host-encoded dispatch per logical
// pass. 512 divides both production presets exactly (batch 1024 -> 2
// dispatches, interactive 512 -> 1) and stays TDR-safe: each logical pass
// is a fixed number of workset-strided scans bounded by the admission caps
// below (~0.3 ms measured at N=1216), so one dispatch stays well under
// watchdog horizons. Fewer chunk boundaries also means fewer dispatch-start
// full sweeps: every boundary resets the workgroup-resident mover lists and
// forces one complete frontier expansion + wall claim + propagate, so the
// interactive preset now pays 1 full sweep per step instead of 16 (32-pass
// chunks were the pre-moved-set layout, chosen before the incremental
// passes existed to amortize >~640 serially encoded dispatches per step).
// The pass clock stays fully logical: evidence rows, the terminal
// ITERATION_INCOMPLETE window, and convergence acceptance are all keyed by
// the logical pass number; the in-loop latch re-check breaks out of the
// chunk (workgroup-uniformly) exactly where the per-dispatch early return
// used to fire. Chunk size only selects full-sweep vs incremental pass
// boundaries, and both derive bit-identical state by the moved-set
// soundness argument, so this constant is a pure performance knob.
export const
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH = 512;
export const
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_DISPATCHES =
    Math.ceil(
      SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
        / SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH
    );
export const
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_HEADER_WORDS = 5;
// The owner admits a bounded contact/wall frontier. This is an incident-CSR
// admission cap, not a claim that every owner stage visits each cursor once.
export const
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES =
    1024;
// Mover-list capacity for moved-set incremental expansion. Movers per pass
// are bounded by applied pairs (few) plus wall changes; overflow forces the
// next pass to a complete frontier sweep, which is bit-identical to the
// incremental pass by the moved-set soundness argument, so this cap trades
// workgroup memory against full-sweep frequency, never correctness. 512
// frees 4 KB of the 16 KB baseline workgroup budget for the selection
// reduction scratch below.
export const
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MOVED_CAPACITY = 512;
export const
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS =
    131072;
export const
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS =
    64;
export const
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_WALL_REFINEMENT_ROUNDS = 16;
export const SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_MAGIC =
  0x4d44_5431;
export const SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_VERSION = 1;
export const SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_WORDS = 64;
export const SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_BYTES =
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_WORDS
    * Uint32Array.BYTES_PER_ELEMENT;
export const
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC = 0x4d54_5431;
export const
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION = 1;
export const
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD = 64;
export const
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD = 128;
export const
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS = 2;
export const
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS = 32;
export const
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS =
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD
    + SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
      * SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
      * SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS;
export const
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_BYTES =
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS
      * Uint32Array.BYTES_PER_ELEMENT;
export const SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS =
  Object.freeze({
    HEADER_VALID: 1 << 0,
    LOCAL_CAPTURE_COMPLETE: 1 << 1,
    POST_WALL_CAPTURE_COMPLETE: 1 << 2,
    WINNER_TARGET_MATCH: 1 << 3,
    INVALID: 0x8000_0000
  });
export const SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS =
  Object.freeze({
    SELECTED: 1 << 0,
    RECIPROCAL: 1 << 1,
    APPLIED: 1 << 2,
    TARGET_IS_LOW: 1 << 3,
    PAIR_CONTAINS_BOTH_TARGETS: 1 << 4,
    ROUND_ZERO_TARGET_WALL_CLIPPED: 1 << 5,
    ROUND_ZERO_PEER_WALL_CLIPPED: 1 << 6,
    LOCAL_CAPTURE_COMPLETE: 1 << 7,
    POST_WALL_CAPTURE_COMPLETE: 1 << 8,
    POST_WALL_CHANGED: 1 << 9,
    THREE_BLOCK_APPLIED: 1 << 10
  });
export const SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS =
  Object.freeze({
    HEADER_VALID: 1 << 0,
    APPLY_OBSERVED: 1 << 1,
    TERMINAL_MEASURED: 1 << 2,
    WINNER_MATERIALIZED: 1 << 3,
    PRODUCTION_MAX_MATCH: 1 << 4,
    IMPULSE_FINITE: 1 << 5,
    INVALID: 0x8000_0000
  });
export const
  SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S = 1e-5;
export const
  SCHROEDER_SPATIAL_MECHANICAL_RECIPROCAL_LAPLACIAN_BOUND_FACTOR = 2;
export const SCHROEDER_SPATIAL_MECHANICAL_POSITION_TRUST_DIAMETERS =
  SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS;
export const SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION =
  0.02;
export const SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT = 1;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_DEFAULT =
  16 * 1024 * 1024;
export const SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE = 16;
const MATCHING_CONSTRAINT_ROW_WORDS =
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ARENA_WORDS_PER_DIRECTED_PAIR;
export const MATCHING_CONSTRAINT_BYTES_PER_DIRECTED_PAIR =
  MATCHING_CONSTRAINT_ROW_WORDS * Float32Array.BYTES_PER_ELEMENT;

export const MATCHING_CLEANUP_CONTROL_MAGIC = 0x4d43_4c31;
export const MATCHING_CLEANUP_CONTROL_VERSION = 1;
const MATCHING_CLEANUP_CONTROL_HEADER_WORDS = 12;
const MATCHING_CLEANUP_SELECTION_COUNT_WORD =
  MATCHING_CLEANUP_CONTROL_HEADER_WORDS;
const MATCHING_CLEANUP_COPY_COUNT_WORD =
  MATCHING_CLEANUP_SELECTION_COUNT_WORD
    + SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;
const MATCHING_CLEANUP_APPLY_COUNT_WORD =
  MATCHING_CLEANUP_COPY_COUNT_WORD
    + SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;
const MATCHING_CLEANUP_WALL_COUNT_WORD =
  MATCHING_CLEANUP_APPLY_COUNT_WORD
    + SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;
const MATCHING_CLEANUP_APPLIED_PAIR_COUNT_WORD =
  MATCHING_CLEANUP_WALL_COUNT_WORD
    + SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;
const MATCHING_CLEANUP_MAX_POSITION_RATIO_WORD =
  MATCHING_CLEANUP_APPLIED_PAIR_COUNT_WORD
    + SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;
const MATCHING_CLEANUP_MAX_VELOCITY_RESIDUAL_WORD =
  MATCHING_CLEANUP_MAX_POSITION_RATIO_WORD
    + SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;
const MATCHING_CLEANUP_CONTACT_COUNT_WORD =
  MATCHING_CLEANUP_MAX_VELOCITY_RESIDUAL_WORD
    + SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;
const MATCHING_CLEANUP_CONTROL_EXPECTED_WORDS =
  MATCHING_CLEANUP_CONTACT_COUNT_WORD
    + SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;
if (
  MATCHING_CLEANUP_CONTROL_EXPECTED_WORDS
    !== SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_CONTROL_WORDS
) {
  throw new Error('mechanical matching-cleanup control ABI word count drifted');
}
if (
  !Number.isSafeInteger(
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES
  )
  || SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES <= 0
  || SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES
    > SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES
  || (
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES & 1
  ) !== (SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES & 1)
) {
  throw new Error(
    'mechanical matching-cleanup encoded pass budget must preserve terminal buffer parity within the logical receipt capacity'
  );
}

// --- Per-invocation solver budget ("knobs") ------------------------------
// The Jacobi round count and the matching-cleanup pass budget are declared,
// sealed solver parameters. The module keeps NO default cleanup budget:
// every invocation must select one. The two production presets are the
// batch/native/diagnostic horizon (1024, covering the measured ~890-pass
// iron-ice worst case) and the interactive demo cadence budget (512, below
// the ~640-serial-pass starvation threshold of the interactive path).
export const SCHROEDER_SPATIAL_MECHANICAL_JACOBI_ITERATIONS_MIN = 1;
export const SCHROEDER_SPATIAL_MECHANICAL_JACOBI_ITERATIONS_MAX =
  SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS;
export const SCHROEDER_SPATIAL_MECHANICAL_CLEANUP_PASS_BUDGET_MIN = 16;
export const SCHROEDER_SPATIAL_MECHANICAL_CLEANUP_PASS_BUDGET_MAX = 65536;
export const SCHROEDER_SPATIAL_MECHANICAL_BATCH_CLEANUP_PASS_BUDGET =
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;
export const SCHROEDER_SPATIAL_MECHANICAL_INTERACTIVE_CLEANUP_PASS_BUDGET =
  512;
export const SCHROEDER_SPATIAL_MECHANICAL_PARALLEL_JACOBI_CLEANUP_ROUNDS_DEFAULT =
  8;

const mechanicalSolverBudgetCache = new Map();

export function resolveSchroederSpatialMechanicalSolverBudget({
  jacobiIterations = SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
  cleanupPassBudget,
  // Opt-in inner solver rounds per logical cleanup pass: each pass runs
  // this many selection+apply+propagate rounds, advancing several
  // violation layers while paying the expansion, wall, and evidence
  // phases once. Compiled into the shader variant (part of this sealed
  // budget and its cache key); 1 preserves the historical single-round
  // pass bit-for-bit.
  contactInnerRounds = 1,
  parallelJacobiCleanupRounds =
    SCHROEDER_SPATIAL_MECHANICAL_PARALLEL_JACOBI_CLEANUP_ROUNDS_DEFAULT
} = {}) {
  if (cleanupPassBudget == null) {
    throw new RangeError(
      'canonical mechanical solver requires an explicit cleanupPassBudget; '
      + 'there is no module default. Select the batch preset '
      + `(${SCHROEDER_SPATIAL_MECHANICAL_BATCH_CLEANUP_PASS_BUDGET}) or the `
      + 'interactive preset '
      + `(${SCHROEDER_SPATIAL_MECHANICAL_INTERACTIVE_CLEANUP_PASS_BUDGET}).`
    );
  }
  if (
    typeof jacobiIterations !== 'number'
    || !Number.isInteger(jacobiIterations)
    || jacobiIterations < SCHROEDER_SPATIAL_MECHANICAL_JACOBI_ITERATIONS_MIN
    || jacobiIterations > SCHROEDER_SPATIAL_MECHANICAL_JACOBI_ITERATIONS_MAX
  ) {
    throw new RangeError(
      'canonical mechanical jacobiIterations must be an integer within '
      + `${SCHROEDER_SPATIAL_MECHANICAL_JACOBI_ITERATIONS_MIN}..`
      + `${SCHROEDER_SPATIAL_MECHANICAL_JACOBI_ITERATIONS_MAX}`
    );
  }
  if (
    typeof cleanupPassBudget !== 'number'
    || !Number.isInteger(cleanupPassBudget)
    || cleanupPassBudget < SCHROEDER_SPATIAL_MECHANICAL_CLEANUP_PASS_BUDGET_MIN
    || cleanupPassBudget > SCHROEDER_SPATIAL_MECHANICAL_CLEANUP_PASS_BUDGET_MAX
  ) {
    throw new RangeError(
      'canonical mechanical cleanupPassBudget must be an integer within '
      + `${SCHROEDER_SPATIAL_MECHANICAL_CLEANUP_PASS_BUDGET_MIN}..`
      + `${SCHROEDER_SPATIAL_MECHANICAL_CLEANUP_PASS_BUDGET_MAX}`
    );
  }
  const innerRounds = Number(contactInnerRounds ?? 1);
  if (
    !Number.isInteger(innerRounds)
    || innerRounds < 1
    || innerRounds > 16
  ) {
    throw new RangeError(
      'canonical mechanical contactInnerRounds must be an integer within 1..16'
    );
  }
  if (
    !Number.isInteger(parallelJacobiCleanupRounds)
    || parallelJacobiCleanupRounds < 0
    || parallelJacobiCleanupRounds > 128
    || (parallelJacobiCleanupRounds & 1) !== 0
  ) {
    throw new RangeError(
      'canonical mechanical parallelJacobiCleanupRounds must be an even integer within 0..128'
    );
  }
  const parallelJacobiCleanupDispatches = parallelJacobiCleanupRounds > 0
    ? parallelJacobiCleanupRounds * 3 + Math.floor(parallelJacobiCleanupRounds / 2) + 2
    : 0;
  const cacheKey = `j${jacobiIterations}.p${cleanupPassBudget}${
    innerRounds > 1 ? `.i${innerRounds}` : ''
  }${
    parallelJacobiCleanupRounds
      !== SCHROEDER_SPATIAL_MECHANICAL_PARALLEL_JACOBI_CLEANUP_ROUNDS_DEFAULT
      ? `.pj${parallelJacobiCleanupRounds}`
      : ''
  }`;
  let budget = mechanicalSolverBudgetCache.get(cacheKey);
  if (budget) return budget;
  const selectionCountWord = MATCHING_CLEANUP_CONTROL_HEADER_WORDS;
  const copyCountWord = selectionCountWord + cleanupPassBudget;
  const applyCountWord = copyCountWord + cleanupPassBudget;
  const wallCountWord = applyCountWord + cleanupPassBudget;
  const appliedPairCountWord = wallCountWord + cleanupPassBudget;
  const maxPositionRatioWord = appliedPairCountWord + cleanupPassBudget;
  const maxVelocityResidualWord = maxPositionRatioWord + cleanupPassBudget;
  const contactCountWord = maxVelocityResidualWord + cleanupPassBudget;
  const matchingCleanupControlWords =
    schroederSpatialMechanicalMatchingCleanupControlWordsForPasses(
      cleanupPassBudget
    );
  if (
    matchingCleanupControlWords !== contactCountWord + cleanupPassBudget
  ) {
    throw new Error(
      'mechanical matching-cleanup control ABI word count drifted for the declared budget'
    );
  }
  const diagnosticTargetTraceWords =
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD
    + cleanupPassBudget
      * SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
      * SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS;
  budget = Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-mechanical-solver-budget.v1',
    cacheKey,
    jacobiIterations,
    cleanupPassBudget,
    contactInnerRounds: innerRounds,
    parallelJacobiCleanupRounds,
    parallelJacobiCleanupDispatches,
    // The encoded horizon IS the declared budget: the shader variant, the
    // control-buffer sizing, and the receipt lanes are all compiled/sized
    // from this one sealed value.
    encodedPassBudget: cleanupPassBudget,
    ownerPassesPerDispatch:
      SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH,
    // Chunked owner encoding: ceil(logical passes / passes-per-dispatch)
    // host-encoded single-workgroup dispatches cover the whole declared
    // budget; a final partial chunk is truncated on-GPU by the uniform
    // in-loop pass-clock latch, never by the host.
    ownerDispatches: Math.ceil(
      cleanupPassBudget
        / SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH
    ),
    selectionCountWord,
    copyCountWord,
    applyCountWord,
    wallCountWord,
    appliedPairCountWord,
    maxPositionRatioWord,
    maxVelocityResidualWord,
    contactCountWord,
    matchingCleanupControlWords,
    diagnosticTargetTraceWords,
    diagnosticTargetTraceBytes:
      diagnosticTargetTraceWords * Uint32Array.BYTES_PER_ELEMENT
  });
  mechanicalSolverBudgetCache.set(cacheKey, budget);
  return budget;
}

export const SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET =
  resolveSchroederSpatialMechanicalSolverBudget({
    jacobiIterations: SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
    cleanupPassBudget: SCHROEDER_SPATIAL_MECHANICAL_BATCH_CLEANUP_PASS_BUDGET
  });
export const SCHROEDER_SPATIAL_MECHANICAL_INTERACTIVE_SOLVER_BUDGET =
  resolveSchroederSpatialMechanicalSolverBudget({
    jacobiIterations: SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
    cleanupPassBudget:
      SCHROEDER_SPATIAL_MECHANICAL_INTERACTIVE_CLEANUP_PASS_BUDGET
  });

export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT = Object.freeze([
  'magic:u32',
  'version:u32',
  'generationId:u32',
  'supportEpoch:u32',
  'particleCount:u32',
  'rowWords:u32',
  'pressureContactSupportProfileId:u32',
  'separationSupportProfileId:u32',
  'localMaterialInterfaceSupportProfileId:u32',
  'positionEpoch:u32',
  'topologyEpoch:u32',
  'storageGeneration:u32',
  'physicsTick:u32',
  'physicsSubstep:u32',
  'traversalCount:u32',
  'consumerCount:u32'
]);

export const SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT = Object.freeze([
  'magic:u32',
  'abiVersion:u32',
  'statusFlags:atomic<u32>',
  'generationId:u32',
  'storageGeneration:u32',
  'physicsTick:u32',
  'physicsSubstep:u32',
  'positionEpoch:u32',
  'topologyEpoch:u32',
  'supportEpoch:u32',
  'selectedLevel:i32',
  'particleCount:u32',
  'particleCapacity:u32',
  'directedPairCapacity:u32',
  'appendAttemptCount:atomic<u32>',
  'stagedDirectedPairCount:atomic<u32>',
  'requiredDirectedPairCount:atomic<u32>',
  'publishedDirectedPairCount:atomic<u32>',
  'overflowCount:atomic<u32>',
  'invalidSourceCount:atomic<u32>',
  'invalidPeerCount:atomic<u32>',
  'duplicatePeerCount:atomic<u32>',
  'asymmetricPeerCount:atomic<u32>',
  'countPassCount:atomic<u32>',
  'scanPassCount:atomic<u32>',
  'scatterPassCount:atomic<u32>',
  'verifyPassCount:atomic<u32>',
  'publishPassCount:atomic<u32>',
  'measurePassCount:atomic<u32>',
  'solvePassCount:atomic<u32>',
  'maxPositionResidualOrderedF32:atomic<u32>',
  'maxVelocityResidualOrderedF32:atomic<u32>',
  'energyMeasurePassCount:atomic<u32>',
  'pairKineticDeltaJ:f32-bits',
  'pairHeatJ:f32-bits',
  'wallHeatJ:f32-bits',
  'energyResidualJ:f32-bits',
  'energyToleranceJ:f32-bits',
  'energyGainCount:atomic<u32>',
  'negativeInternalEnergyCount:atomic<u32>',
  'candidateVisitCount:atomic<u32>',
  'aggregateSummaryPhaseMismatchCount:atomic<u32>',
  'aggregateSummaryPreflightCount:atomic<u32>',
  'aggregateHierarchyNodeVisitCount:atomic<u32>',
  'aggregateHierarchyPrunedNodeCount:atomic<u32>',
  'aggregateHierarchySourceCount:atomic<u32>',
  'aggregateSummaryLineageMaterialMismatchCount:atomic<u32>',
  // This is deliberately narrower than candidateVisitCount: aggregate active
  // prefixes account dormant members without loading their endpoint metadata.
  'projectedPeerVisitCount:atomic<u32>'
]);

export const SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE;

export const SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_FAILURE;

export const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};

export const EXPECTATION_BYTES = 112;
export const MECHANICAL_PARAMS_BYTES = 128;
export const MECHANICAL_SOLVER_ITERATION_PARAMS_BYTES = 16;
export const MECHANICAL_SUPPORT_HEADER_WORDS = 6;
export const MECHANICAL_SUPPORT_ROW_WORDS = 8;
export const MECHANICAL_SUPPORT_TRAILER_WORDS = 1;
const MECHANICAL_SUPPORT_MAX_DIAMETER_WORD = 0;
const MECHANICAL_SUPPORT_MAX_DISPLACEMENT_WORD = 1;
const MECHANICAL_SUPPORT_MAX_WALL_PROJECTION_WORD = 2;
const MECHANICAL_SUPPORT_AGGREGATE_PREFLIGHT_WORD = 3;
export const MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD = 4;
export const MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD = 5;
export const MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET = 0xffff_ffff;
const MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTED = 1;
export const WORKGROUP_SIZE = 64;
export const MECHANICAL_APPLY_ALL_LEVELS = -0x8000_0000;
export const SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_MAGIC;
export const SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_VERSION;
export const MECHANICAL_PROPOSAL_HEADER_BYTES =
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const MECHANICAL_PROPOSAL_ROW_BYTES =
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const mechanicalProposalPools = new WeakMap();
export const liveMechanicalProposalArtifacts = new WeakSet();
const mechanicalProposalCaptureRecords = new WeakMap();

function exactPositiveCaptureStepCount(value) {
  const stepCount = Number(value);
  if (!Number.isSafeInteger(stepCount) || stepCount < 1) {
    throw new RangeError(
      'mechanical proposal capture sequenceStepCount must be a positive safe integer'
    );
  }
  return stepCount;
}

function requireMechanicalProposalCaptureRecord(capture) {
  const record = mechanicalProposalCaptureRecords.get(capture);
  if (!record) {
    throw new TypeError(
      'mechanical proposal capture must be an exact handle created by this module instance'
    );
  }
  if (record.destroyed) {
    throw new Error('mechanical proposal capture has been destroyed');
  }
  return record;
}

export function createSchroederSpatialMechanicalProposalCapture({
  sequenceStepCount,
  mode = SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_CAPTURE_MODE
} = {}) {
  const resolvedSequenceStepCount = exactPositiveCaptureStepCount(
    sequenceStepCount
  );
  if (mode !== SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_CAPTURE_MODE) {
    throw new RangeError(`unsupported mechanical proposal capture mode: ${mode}`);
  }
  const capture = Object.freeze({});
  mechanicalProposalCaptureRecords.set(capture, {
    mode,
    sequenceStepCount: resolvedSequenceStepCount,
    nextSequenceIndex: 0,
    device: null,
    particleCount: null,
    buffer: null,
    layout: null,
    lastProposal: null,
    destroyed: false
  });
  return capture;
}

export function describeSchroederSpatialMechanicalProposalCapture(capture) {
  const record = requireMechanicalProposalCaptureRecord(capture);
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_CAPTURE_SCHEMA,
    status: record.nextSequenceIndex === record.sequenceStepCount
      ? 'complete'
      : (record.buffer ? 'capturing' : 'prepared'),
    mode: record.mode,
    sequenceStepCount: record.sequenceStepCount,
    encodedStepCount: record.nextSequenceIndex,
    complete: record.nextSequenceIndex === record.sequenceStepCount,
    device: record.device,
    particleCount: record.particleCount,
    buffer: record.buffer,
    layout: record.layout,
    lastProposal: record.lastProposal,
    fullParticleReadbackPerformed: false,
    hostSummaryReadbackPerformed: false,
    hostQueueFenceCount: 0
  });
}

export function destroySchroederSpatialMechanicalProposalCapture(capture) {
  const record = mechanicalProposalCaptureRecords.get(capture);
  if (!record || record.destroyed) return false;
  record.buffer?.destroy?.();
  record.buffer = null;
  record.lastProposal = null;
  record.destroyed = true;
  return true;
}

function captureByteProduct(left, right, label) {
  const value = left * right;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} exceeds the safe WebGPU capture byte range`);
  }
  return value;
}

export function createMechanicalProposalCaptureLayout({
  sequenceStepCount,
  particleCount,
  controlByteLength,
  evidenceByteLength,
  matchingCleanupByteLength
}) {
  const historyStrideByteLength =
    controlByteLength + evidenceByteLength + matchingCleanupByteLength;
  const historyByteLength = captureByteProduct(
    sequenceStepCount,
    historyStrideByteLength,
    'mechanical proposal capture history'
  );
  const stateByteLength = captureByteProduct(
    particleCount,
    8 * Float32Array.BYTES_PER_ELEMENT,
    'mechanical proposal capture state'
  );
  const thermoByteLength = captureByteProduct(
    particleCount,
    12 * Float32Array.BYTES_PER_ELEMENT,
    'mechanical proposal capture thermo'
  );
  const mechanicsByteLength = captureByteProduct(
    particleCount,
    32 * Float32Array.BYTES_PER_ELEMENT,
    'mechanical proposal capture mechanics'
  );
  const identityByteLength = captureByteProduct(
    particleCount,
    Uint32Array.BYTES_PER_ELEMENT,
    'mechanical proposal capture identity'
  );
  const stateByteOffset = historyByteLength;
  const thermoByteOffset = stateByteOffset + stateByteLength;
  const mechanicsByteOffset = thermoByteOffset + thermoByteLength;
  const identityByteOffset = mechanicsByteOffset + mechanicsByteLength;
  const totalByteLength = identityByteOffset + identityByteLength;
  if (!Number.isSafeInteger(totalByteLength) || totalByteLength < 4) {
    throw new RangeError('mechanical proposal capture total byte length is invalid');
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_CAPTURE_SCHEMA,
    mode: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_CAPTURE_MODE,
    totalByteLength,
    history: Object.freeze({
      byteOffset: 0,
      byteLength: historyByteLength,
      strideByteLength: historyStrideByteLength,
      stepCount: sequenceStepCount,
      control: Object.freeze({ byteOffset: 0, byteLength: controlByteLength }),
      evidence: Object.freeze({
        byteOffset: controlByteLength,
        byteLength: evidenceByteLength
      }),
      matchingCleanup: Object.freeze({
        byteOffset: controlByteLength + evidenceByteLength,
        byteLength: matchingCleanupByteLength
      })
    }),
    final: Object.freeze({
      state: Object.freeze({ byteOffset: stateByteOffset, byteLength: stateByteLength }),
      thermo: Object.freeze({ byteOffset: thermoByteOffset, byteLength: thermoByteLength }),
      mechanics: Object.freeze({ byteOffset: mechanicsByteOffset, byteLength: mechanicsByteLength }),
      identity: Object.freeze({ byteOffset: identityByteOffset, byteLength: identityByteLength })
    })
  });
}

export function resolveMechanicalProposalCaptureRequest({
  capture,
  sequenceIndex,
  sequenceStepCount
}) {
  if (capture == null) return null;
  const record = requireMechanicalProposalCaptureRecord(capture);
  const resolvedSequenceStepCount = exactPositiveCaptureStepCount(
    sequenceStepCount
  );
  const resolvedSequenceIndex = Number(sequenceIndex);
  if (
    !Number.isSafeInteger(resolvedSequenceIndex)
    || resolvedSequenceIndex < 0
    || resolvedSequenceIndex >= resolvedSequenceStepCount
  ) {
    throw new RangeError(
      'mechanical proposal capture sequenceIndex must identify one sequence step'
    );
  }
  if (resolvedSequenceStepCount !== record.sequenceStepCount) {
    throw new Error('mechanical proposal capture sequence length changed');
  }
  if (resolvedSequenceIndex !== record.nextSequenceIndex) {
    throw new Error(
      'mechanical proposal capture steps must be encoded once in strict sequence order'
    );
  }
  return Object.freeze({
    record,
    sequenceIndex: resolvedSequenceIndex,
    sequenceStepCount: resolvedSequenceStepCount
  });
}

export function mechanicalSolverIterationUniformPlan(
  device,
  solverIterationCount = SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS
) {
  const requestedAlignment = Math.trunc(finiteNumber(
    device?.limits?.minUniformBufferOffsetAlignment,
    MECHANICAL_SOLVER_ITERATION_PARAMS_BYTES
  ));
  const alignment = Math.ceil(Math.max(
    MECHANICAL_SOLVER_ITERATION_PARAMS_BYTES,
    requestedAlignment
  ) / MECHANICAL_SOLVER_ITERATION_PARAMS_BYTES)
    * MECHANICAL_SOLVER_ITERATION_PARAMS_BYTES;
  const strideBytes = Math.ceil(
    MECHANICAL_SOLVER_ITERATION_PARAMS_BYTES / alignment
  ) * alignment;
  const byteLength = strideBytes * solverIterationCount;
  const values = new Uint32Array(byteLength / Uint32Array.BYTES_PER_ELEMENT);
  for (
    let iteration = 0;
    iteration < solverIterationCount;
    iteration += 1
  ) {
    values[iteration * strideBytes / Uint32Array.BYTES_PER_ELEMENT] = iteration;
  }
  return Object.freeze({ strideBytes, byteLength, values });
}

export function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteVector3(value, fallback = [0, 0, 0]) {
  return [0, 1, 2].map((axis) => finiteNumber(value?.[axis], fallback[axis]));
}

function vectorScale(vector, scale) {
  return vector.map((value) => value * scale);
}

function vectorSubtract(left, right) {
  return left.map((value, axis) => value - right[axis]);
}

function vectorAdd(left, right) {
  return left.map((value, axis) => value + right[axis]);
}

function vectorLength(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function dot3(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function schroederSpatialMechanicalCoincidenceNormal(selfIndex, otherIndex) {
  const self = Math.max(0, Math.trunc(finiteNumber(selfIndex, 0))) >>> 0;
  const peer = Math.max(0, Math.trunc(finiteNumber(otherIndex, 0))) >>> 0;
  const lowIndex = Math.min(self, peer) >>> 0;
  let hash = (
    Math.imul(lowIndex, 2_654_435_761) + 0x9e37_79b9
  ) >>> 0;
  hash = Math.imul((hash ^ (hash >>> 16)) >>> 0, 2_246_822_519) >>> 0;
  hash = (hash ^ (hash >>> 13)) >>> 0;
  const raw = [
    (hash & 1023) / 511.5 - 1,
    ((hash >>> 10) & 1023) / 511.5 - 1,
    ((hash >>> 20) & 1023) / 511.5 - 1
  ];
  const rawLength = vectorLength(raw);
  const normal = rawLength > 1e-4
    ? vectorScale(raw, 1 / Math.max(rawLength, 1e-6))
    : [0, 1, 0];
  return vectorScale(normal, self > peer ? 1 : -1);
}

/**
 * Small manufactured-pair policy oracle. This is deliberately not a
 * production neighbor fallback; it mirrors the per-pair WGSL eligibility
 * policy so focused tests can prove domain/material routing explicitly.
 */
export function classifySchroederSpatialMechanicalPair({
  phaseClass,
  otherPhaseClass,
  materialId,
  otherMaterialId,
  domainId = 0,
  otherDomainId = 0,
  identityEnabled = true
} = {}) {
  const selfClass = Math.trunc(finiteNumber(phaseClass, 0));
  const peerClass = Math.trunc(finiteNumber(otherPhaseClass, 0));
  if (selfClass === 0 || peerClass === 0) {
    return Object.freeze({ handled: false, reason: 'gas-or-eos-disabled' });
  }
  const sameMaterial = Math.abs(
    finiteNumber(materialId, 0) - finiteNumber(otherMaterialId, 0)
  ) < 0.5;
  const selfDomain = Math.max(0, Math.trunc(finiteNumber(domainId, 0)));
  const peerDomain = Math.max(0, Math.trunc(finiteNumber(otherDomainId, 0)));
  const sameBodySolid = selfClass === 2
    && peerClass === 2
    && sameMaterial
    && (
      identityEnabled !== true
      || selfDomain === 0
      || peerDomain === 0
      || selfDomain === peerDomain
    );
  if (sameBodySolid) {
    return Object.freeze({ handled: false, reason: 'same-body-solid' });
  }
  return Object.freeze({
    handled: true,
    reason: sameMaterial ? 'cross-domain-or-condensed-phase' : 'cross-material-interface'
  });
}

/**
 * Return whether a handled condensed pair is a true unilateral interface
 * constraint. Cross-material interfaces and distinct solid bodies require a
 * positional non-penetration barrier even when optional liquid-particle
 * separation is disabled. Their reciprocal velocity constraint belongs to
 * the material/domain mechanics-field solve; applying another impulse from
 * this stale pre-integration particle view would double the response.
 * Same-material liquid/liquid carriers keep the softer excluded-volume policy
 * so ordinary flow is not turned into artificial surface tension. A
 * solid/liquid pair that reached this classifier is from different conserved
 * phase lineages (same-lineage companions are rejected while the graph is
 * built), so it is a real material interface and needs the same unilateral
 * non-penetration constraint as an unlike-material condensed pair.
 */
export function schroederSpatialMechanicalPairRequiresUnilateralContact({
  phaseClass,
  otherPhaseClass,
  materialId,
  otherMaterialId,
  domainId = 0,
  otherDomainId = 0,
  identityEnabled = true
} = {}) {
  const selfClass = Math.trunc(finiteNumber(phaseClass, 0));
  const peerClass = Math.trunc(finiteNumber(otherPhaseClass, 0));
  if (selfClass === 0 || peerClass === 0) return false;
  const sameMaterial = Math.abs(
    finiteNumber(materialId, 0) - finiteNumber(otherMaterialId, 0)
  ) < 0.5;
  if (!sameMaterial) return true;
  const solidLiquidInterface = (selfClass === 2 && peerClass === 1)
    || (selfClass === 1 && peerClass === 2);
  if (solidLiquidInterface) return true;
  if (selfClass !== 2 || peerClass !== 2 || identityEnabled !== true) {
    return false;
  }
  const selfDomain = Math.max(0, Math.trunc(finiteNumber(domainId, 0)));
  const peerDomain = Math.max(0, Math.trunc(finiteNumber(otherDomainId, 0)));
  return selfDomain > 0 && peerDomain > 0 && selfDomain !== peerDomain;
}

/** Return whether two phase-lane indices represent one conserved carrier. */
export function schroederSpatialMechanicalPairSharesPhaseLineage({
  selfIndex,
  otherIndex,
  lineageCapacity = 0,
  phaseLaneCount = 0
} = {}) {
  const self = Math.trunc(finiteNumber(selfIndex, -1));
  const peer = Math.trunc(finiteNumber(otherIndex, -1));
  const capacity = Math.trunc(finiteNumber(lineageCapacity, 0));
  const laneCount = Math.trunc(finiteNumber(phaseLaneCount, 0));
  return self >= 0
    && peer >= 0
    && self !== peer
    && capacity > 0
    && laneCount > 1
    && self < capacity * laneCount
    && peer < capacity * laneCount
    && self % capacity === peer % capacity;
}

/**
 * Resolve whether one condensed phase carrier is wholly hidden inside the
 * finite-volume cell of a companion from the same conserved lineage.
 *
 * Phase transfer initially materializes solid/liquid companions at the same
 * position.  Treating both nested cells as independent exterior geometry
 * double-counts the lineage boundary and can create an impossible contact
 * star against a third material.  Only the outer cell owns that portion of
 * the union boundary.  A companion must contain the carrier at both ends of
 * the mechanical sweep; independently moving phase components therefore
 * regain their own exposed geometry as soon as either endpoint is exposed.
 */
export function evaluateSchroederSpatialMechanicalPhaseGeometryOcclusion({
  selfIndex = 0,
  lineageCapacity = 0,
  phaseLaneCount = 0,
  carriers = []
} = {}) {
  const index = Math.trunc(finiteNumber(selfIndex, -1));
  const capacity = Math.trunc(finiteNumber(lineageCapacity, 0));
  const laneCount = Math.trunc(finiteNumber(phaseLaneCount, 0));
  if (
    index < 0
    || capacity <= 0
    || laneCount <= 1
    || index >= capacity * laneCount
  ) {
    return Object.freeze({
      valid: true,
      occluded: false,
      ownerIndex: null,
      reason: 'phase-lineage-disabled'
    });
  }
  const byIndex = new Map(carriers.map((carrier) => [
    Math.trunc(finiteNumber(carrier?.index, -1)),
    carrier
  ]));
  const self = byIndex.get(index);
  const normalize = (carrier) => {
    const massKg = finiteNumber(carrier?.massKg, Number.NaN);
    const restVolumeM3 = finiteNumber(
      carrier?.restVolumeM3,
      Number.NaN
    );
    const phaseClass = Math.trunc(finiteNumber(carrier?.phaseClass, -1));
    const rawPosition = carrier?.position;
    const rawEpochPosition = carrier?.epochPosition ?? rawPosition;
    const position = [0, 1, 2].map((axis) => Number(rawPosition?.[axis]));
    const epochPosition = [0, 1, 2].map(
      (axis) => Number(rawEpochPosition?.[axis])
    );
    const valid = Number.isFinite(massKg)
      && Number.isFinite(restVolumeM3)
      && position.every(Number.isFinite)
      && epochPosition.every(Number.isFinite);
    return {
      massKg,
      restVolumeM3,
      phaseClass,
      materialId: finiteNumber(carrier?.materialId, Number.NaN),
      position,
      epochPosition,
      valid
    };
  };
  const selfCarrier = normalize(self);
  if (!self || !selfCarrier.valid) {
    return Object.freeze({
      valid: false,
      occluded: false,
      ownerIndex: null,
      reason: 'invalid-self-carrier'
    });
  }
  if (
    !(selfCarrier.massKg > 0)
    || !(selfCarrier.restVolumeM3 > 0)
    || (selfCarrier.phaseClass !== 1 && selfCarrier.phaseClass !== 2)
  ) {
    return Object.freeze({
      valid: true,
      occluded: false,
      ownerIndex: null,
      reason: 'non-condensed-or-dormant'
    });
  }
  const selfEdgeM = Math.cbrt(selfCarrier.restVolumeM3);
  let ownerIndex = null;
  let ownerEdgeM = -1;
  const lineage = index % capacity;
  for (let lane = 0; lane < laneCount; lane += 1) {
    const peerIndex = lane * capacity + lineage;
    if (peerIndex === index) continue;
    const peer = byIndex.get(peerIndex);
    if (!peer) continue;
    const candidate = normalize(peer);
    if (!candidate.valid) {
      return Object.freeze({
        valid: false,
        occluded: false,
        ownerIndex: null,
        reason: 'invalid-lineage-companion'
      });
    }
    if (
      !(candidate.massKg > 0)
      || !(candidate.restVolumeM3 > 0)
      || (candidate.phaseClass !== 1 && candidate.phaseClass !== 2)
    ) continue;
    if (
      !Number.isFinite(selfCarrier.materialId)
      || !Number.isFinite(candidate.materialId)
      || Math.abs(candidate.materialId - selfCarrier.materialId) >= 0.5
    ) {
      return Object.freeze({
        valid: false,
        occluded: false,
        ownerIndex: null,
        reason: 'lineage-material-mismatch'
      });
    }
    const peerEdgeM = Math.cbrt(candidate.restVolumeM3);
    const geometricScaleM = Math.max(
      selfEdgeM,
      peerEdgeM,
      ...selfCarrier.position.map(Math.abs),
      ...candidate.position.map(Math.abs),
      ...selfCarrier.epochPosition.map(Math.abs),
      ...candidate.epochPosition.map(Math.abs),
      1e-12
    );
    const toleranceM = 16 * 1.1920928955078125e-7 * geometricScaleM;
    const candidateOwnsSize = peerEdgeM > selfEdgeM + toleranceM
      || (
        Math.abs(peerEdgeM - selfEdgeM) <= toleranceM
        && peerIndex < index
      );
    if (!candidateOwnsSize) continue;
    const containsAt = (selfPosition, peerPosition) => (
      selfPosition.every((value, axis) => (
        Math.abs(value - peerPosition[axis]) + 0.5 * selfEdgeM
          <= 0.5 * peerEdgeM + toleranceM
      ))
    );
    if (
      !containsAt(selfCarrier.position, candidate.position)
      || !containsAt(selfCarrier.epochPosition, candidate.epochPosition)
    ) continue;
    if (
      peerEdgeM > ownerEdgeM + toleranceM
      || (
        Math.abs(peerEdgeM - ownerEdgeM) <= toleranceM
        && (ownerIndex == null || peerIndex < ownerIndex)
      )
    ) {
      ownerIndex = peerIndex;
      ownerEdgeM = peerEdgeM;
    }
  }
  return Object.freeze({
    valid: true,
    occluded: ownerIndex != null,
    ownerIndex,
    reason: ownerIndex == null
      ? 'phase-geometry-exposed'
      : 'contained-by-lineage-companion'
  });
}

function schroederSpatialMechanicalInterfaceFaceAtDelta({
  deltaM,
  selfEdgeM,
  otherEdgeM,
  normalToleranceM
}) {
  const halfSumM = 0.5 * (selfEdgeM + otherEdgeM);
  const separationM = deltaM.map((value) => Math.abs(value) - halfSumM);
  let normalAxis = 0;
  if (separationM[1] > separationM[normalAxis]) normalAxis = 1;
  if (separationM[2] > separationM[normalAxis]) normalAxis = 2;
  if (separationM[normalAxis] > normalToleranceM) return null;
  const tangentAxes = normalAxis === 0
    ? [1, 2]
    : normalAxis === 1
      ? [0, 2]
      : [0, 1];
  // Positions and cell edges are f32 in production. Decimal lattice points
  // that meet only at an edge or corner can therefore appear to overlap by a
  // few binary32 ulps after subtraction. Such a zero-area contact must not
  // become a full-strength unilateral constraint.
  const tangentZeroToleranceM =
    16 * 1.1920928955078125e-7 * Math.max(
      selfEdgeM,
      otherEdgeM,
      halfSumM,
      ...deltaM.map(Math.abs),
      1e-12
    );
  const overlapM = tangentAxes.map((axis) => {
    const overlap = Math.min(
      selfEdgeM,
      otherEdgeM,
      halfSumM - Math.abs(deltaM[axis])
    );
    return overlap > tangentZeroToleranceM ? overlap : 0;
  });
  if (!(overlapM[0] > 0) || !(overlapM[1] > 0)) return null;
  return Object.freeze({
    areaM2: overlapM[0] * overlapM[1],
    normalAxis,
    overlapM: Object.freeze(overlapM)
  });
}

function schroederSpatialMechanicalAabbNormalRoundoffToleranceM({
  deltaM,
  selfEdgeM,
  otherEdgeM
}) {
  const halfSumM = 0.5 * (selfEdgeM + otherEdgeM);
  // The production geometry is evaluated in f32. A converged face can land a
  // few representational steps outside support after reciprocal Jacobi
  // corrections are accumulated and written back. Keep that numerical shell
  // proportional to the actual cell geometry: it must retain a closing
  // velocity constraint at a represented face, but it must not become a
  // world-scale absolute gap. Position overlap remains clamped to zero, so the
  // shell never attracts separated carriers.
  const geometricScaleM = Math.max(
    selfEdgeM,
    otherEdgeM,
    halfSumM,
    ...deltaM.map(Math.abs),
    1e-12
  );
  return Math.min(
    8 * 1.1920928955078125e-7 * geometricScaleM,
    1e-4 * halfSumM
  );
}

function schroederSpatialMechanicalFiniteVolumeContact({
  deltaM,
  epochDeltaM,
  selfEdgeM,
  otherEdgeM,
  selfIndex,
  otherIndex
}) {
  const halfSumM = 0.5 * (selfEdgeM + otherEdgeM);
  const normalRoundoffToleranceM =
    schroederSpatialMechanicalAabbNormalRoundoffToleranceM({
      deltaM,
      selfEdgeM,
      otherEdgeM
    });
  const currentFace = schroederSpatialMechanicalInterfaceFaceAtDelta({
    deltaM,
    selfEdgeM,
    otherEdgeM,
    normalToleranceM: normalRoundoffToleranceM
  });
  const sweepDeltaM = vectorSubtract(deltaM, epochDeltaM);
  let entryT = -Number.MAX_VALUE;
  let exitT = Number.MAX_VALUE;
  let sweptFace = null;
  if (vectorLength(sweepDeltaM) > 1e-12) {
    for (let axis = 0; axis < 3; axis += 1) {
      const startM = epochDeltaM[axis];
      const sweepM = sweepDeltaM[axis];
      if (Math.abs(sweepM) <= 1e-12) {
        if (Math.abs(startM) > halfSumM) {
          entryT = Number.POSITIVE_INFINITY;
          exitT = Number.NEGATIVE_INFINITY;
          break;
        }
        continue;
      }
      const firstT = (-halfSumM - startM) / sweepM;
      const secondT = (halfSumM - startM) / sweepM;
      entryT = Math.max(entryT, Math.min(firstT, secondT));
      exitT = Math.min(exitT, Math.max(firstT, secondT));
    }
    if (entryT <= exitT && exitT >= 0 && entryT <= 1) {
      const impactT = Math.min(1, Math.max(0, entryT));
      const impactDeltaM = vectorAdd(
        epochDeltaM,
        vectorScale(sweepDeltaM, impactT)
      );
      const impactFace = schroederSpatialMechanicalInterfaceFaceAtDelta({
        deltaM: impactDeltaM,
        selfEdgeM,
        otherEdgeM,
        normalToleranceM:
          schroederSpatialMechanicalAabbNormalRoundoffToleranceM({
            deltaM: impactDeltaM,
            selfEdgeM,
            otherEdgeM
          })
      });
      if (impactFace) sweptFace = { impactT, impactDeltaM, impactFace };
    }
  }
  const cohortInverted = dot3(epochDeltaM, deltaM) <= 0;
  let sourceFace = null;
  let sourceDeltaM = null;
  if (sweptFace && (
    !currentFace
    || cohortInverted
    || Math.max(...epochDeltaM.map(Math.abs)) >= halfSumM
  )) {
    sourceFace = sweptFace.impactFace;
    sourceDeltaM = sweptFace.impactDeltaM;
  } else if (currentFace) {
    sourceFace = currentFace;
    sourceDeltaM = deltaM;
  }
  // A center-vector inversion is not itself a collision. A pair can exchange
  // sides while remaining disjoint in a tangential slab; only a finite-area
  // current or swept AABB face may admit the unilateral constraint.
  if (!sourceDeltaM) return null;
  const normalAxis = sourceFace?.normalAxis
    ?? sourceDeltaM.reduce(
      (best, value, axis) => (
        Math.abs(value) > Math.abs(sourceDeltaM[best]) ? axis : best
      ),
      0
    );
  const coincidenceNormal =
    schroederSpatialMechanicalCoincidenceNormal(selfIndex, otherIndex);
  const normalSign = Math.abs(sourceDeltaM[normalAxis]) > 1e-12
    ? Math.sign(sourceDeltaM[normalAxis])
    : Math.sign(coincidenceNormal[normalAxis]) || 1;
  const normal = [0, 0, 0];
  normal[normalAxis] = normalSign;
  // Axis-aligned finite-volume cells exchange only the impulse and position
  // correction normal to their admitted face. A center-to-center swept
  // response would manufacture tangential momentum whenever impact is
  // off-axis, ejecting the two materials laterally despite exact pair COM.
  const responseNormal = normal;
  const responseProjection = 1;
  const supportDistanceM = halfSumM;
  return Object.freeze({
    normal: Object.freeze(normal),
    responseNormal: Object.freeze(responseNormal),
    responseProjection,
    supportDistanceM,
    overlapM: Math.max(supportDistanceM - dot3(deltaM, normal), 0),
    sweptContact: Boolean(sweptFace),
    sweptImpactT: sweptFace?.impactT ?? null,
    cohortInverted
  });
}

/**
 * Manufactured oracle for the v2 mechanical interface receipt geometry.
 * Rest-volume carriers are axis-aligned finite-volume cells. Static contact
 * selects the least-penetration face with an x/y/z tie break and measures the
 * exact overlap of the two tangential intervals. A separated final state can
 * still publish the same-substep face at the first swept AABB impact.
 */
export function evaluateSchroederSpatialMechanicalInterfaceFaceContact({
  position = [0, 0, 0],
  otherPosition = [0, 0, 0],
  epochPosition = position,
  otherEpochPosition = otherPosition,
  restVolumeM3 = 1,
  otherRestVolumeM3 = 1,
  normalToleranceM = null
} = {}) {
  const selfVolumeM3 = Math.max(finiteNumber(restVolumeM3, 0), 0);
  const otherVolumeM3 = Math.max(finiteNumber(otherRestVolumeM3, 0), 0);
  if (!(selfVolumeM3 > 0) || !(otherVolumeM3 > 0)) {
    return Object.freeze({
      contact: false,
      sweptContact: false,
      reason: 'inactive-finite-volume-cell',
      areaM2: 0,
      impactT: null,
      normalAxis: null
    });
  }
  const selfEdgeM = Math.cbrt(Math.max(selfVolumeM3, 1e-18));
  const otherEdgeM = Math.cbrt(Math.max(otherVolumeM3, 1e-18));
  const halfSumM = 0.5 * (selfEdgeM + otherEdgeM);
  const resolvedNormalToleranceM = normalToleranceM == null
    ? Math.max(
        1e-5,
        SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION
          * halfSumM
      )
    : Math.max(finiteNumber(normalToleranceM, 0), 0);
  const finalDeltaM = vectorSubtract(
    finiteVector3(position),
    finiteVector3(otherPosition)
  );
  const finalFace = schroederSpatialMechanicalInterfaceFaceAtDelta({
    deltaM: finalDeltaM,
    selfEdgeM,
    otherEdgeM,
    normalToleranceM: resolvedNormalToleranceM
  });
  if (finalFace) {
    return Object.freeze({
      contact: true,
      sweptContact: false,
      reason: 'final-face-overlap',
      areaM2: finalFace.areaM2,
      impactT: 1,
      normalAxis: finalFace.normalAxis,
      overlapM: finalFace.overlapM
    });
  }
  const epochDeltaM = vectorSubtract(
    finiteVector3(epochPosition),
    finiteVector3(otherEpochPosition)
  );
  const sweepDeltaM = vectorSubtract(finalDeltaM, epochDeltaM);
  let entryT = -Number.MAX_VALUE;
  let exitT = Number.MAX_VALUE;
  for (let axis = 0; axis < 3; axis += 1) {
    const startM = epochDeltaM[axis];
    const velocityM = sweepDeltaM[axis];
    if (Math.abs(velocityM) <= 1e-12) {
      if (Math.abs(startM) > halfSumM) {
        return Object.freeze({
          contact: false,
          sweptContact: false,
          reason: 'outside-swept-face-support',
          areaM2: 0,
          impactT: null,
          normalAxis: null
        });
      }
      continue;
    }
    const firstT = (-halfSumM - startM) / velocityM;
    const secondT = (halfSumM - startM) / velocityM;
    entryT = Math.max(entryT, Math.min(firstT, secondT));
    exitT = Math.min(exitT, Math.max(firstT, secondT));
  }
  if (entryT > exitT || exitT < 0 || entryT > 1) {
    return Object.freeze({
      contact: false,
      sweptContact: false,
      reason: 'outside-swept-face-support',
      areaM2: 0,
      impactT: null,
      normalAxis: null
    });
  }
  const impactT = Math.min(1, Math.max(0, entryT));
  const impactDeltaM = vectorAdd(
    epochDeltaM,
    vectorScale(sweepDeltaM, impactT)
  );
  const impactFace = schroederSpatialMechanicalInterfaceFaceAtDelta({
    deltaM: impactDeltaM,
    selfEdgeM,
    otherEdgeM,
    normalToleranceM: 0
  });
  if (!impactFace) {
    return Object.freeze({
      contact: false,
      sweptContact: false,
      reason: 'edge-or-corner-only-impact',
      areaM2: 0,
      impactT: null,
      normalAxis: null
    });
  }
  return Object.freeze({
    contact: true,
    sweptContact: true,
    reason: 'swept-face-overlap',
    areaM2: impactFace.areaM2,
    impactT,
    normalAxis: impactFace.normalAxis,
    overlapM: impactFace.overlapM
  });
}

/** Small manufactured-pair oracle for the symmetric WGSL pair contribution. */
export function evaluateSchroederSpatialMechanicalPairProposal({
  position = [0, 0, 0],
  otherPosition = [0, 0, 0],
  epochPosition = position,
  otherEpochPosition = otherPosition,
  velocity = [0, 0, 0],
  otherVelocity = [0, 0, 0],
  massKg = 1,
  otherMassKg = 1,
  restVolumeM3 = 1,
  otherRestVolumeM3 = 1,
  relaxation = 0.35,
  normalVelocityDamping = 0.25,
  frozenMatchingFrame = null,
  selfIndex = 0,
  otherIndex = 1,
  phaseLineageCapacity = 0,
  phaseLaneCount = 0,
  ...pairPolicy
} = {}) {
  const selfMass = Math.max(finiteNumber(massKg, 0), 0);
  const peerMass = Math.max(finiteNumber(otherMassKg, 0), 0);
  const selfVolume = Math.max(finiteNumber(restVolumeM3, 0), 0);
  const peerVolume = Math.max(finiteNumber(otherRestVolumeM3, 0), 0);
  const bothMechanicallyActive = selfMass > 0
    && peerMass > 0
    && selfVolume > 0
    && peerVolume > 0;
  const sharedPhaseLineage = schroederSpatialMechanicalPairSharesPhaseLineage({
    selfIndex,
    otherIndex,
    lineageCapacity: phaseLineageCapacity,
    phaseLaneCount
  });
  const sharedLineageMaterialMismatch = sharedPhaseLineage
    && bothMechanicallyActive
    && Math.abs(
    finiteNumber(pairPolicy.materialId, 0)
      - finiteNumber(pairPolicy.otherMaterialId, 0)
  ) >= 0.5;
  const policy = sharedPhaseLineage
    ? Object.freeze({
        handled: false,
        reason: sharedLineageMaterialMismatch
          ? 'invalid-phase-lineage-material-mismatch'
          : 'same-phase-carrier-lineage',
        invalid: sharedLineageMaterialMismatch
      })
    : classifySchroederSpatialMechanicalPair(pairPolicy);
  const unilateralContact = policy.handled
    && schroederSpatialMechanicalPairRequiresUnilateralContact(pairPolicy);
  const zero = Object.freeze([0, 0, 0]);
  if (!policy.handled || !(selfMass > 0) || !(peerMass > 0)
      || !(selfVolume > 0) || !(peerVolume > 0)) {
    return Object.freeze({
      ...policy,
      unilateralContact,
      overlapM: 0,
      positionDeltaM: zero,
      otherPositionDeltaM: zero,
      velocityDeltaMPerS: zero,
      otherVelocityDeltaMPerS: zero
    });
  }
  const selfPosition = finiteVector3(position);
  const peerPosition = finiteVector3(otherPosition);
  const delta = vectorSubtract(selfPosition, peerPosition);
  const distanceM = vectorLength(delta);
  const selfDiameterM = Math.cbrt(Math.max(selfVolume, 1e-18));
  const peerDiameterM = Math.cbrt(Math.max(peerVolume, 1e-18));
  const restDistanceM = 0.5 * (selfDiameterM + peerDiameterM);
  const selfEpochPosition = finiteVector3(epochPosition);
  const peerEpochPosition = finiteVector3(otherEpochPosition);
  const epochDelta = vectorSubtract(selfEpochPosition, peerEpochPosition);
  const sweepDelta = vectorSubtract(delta, epochDelta);
  const sweepLengthSq = dot3(sweepDelta, sweepDelta);
  const closestT = sweepLengthSq > 1e-18
    ? Math.min(1, Math.max(0, -dot3(epochDelta, sweepDelta) / sweepLengthSq))
    : 0;
  const closestDelta = vectorAdd(
    epochDelta,
    vectorScale(sweepDelta, closestT)
  );
  const sweptDistanceM = vectorLength(closestDelta);
  if (unilateralContact) {
    let finiteVolumeContact = null;
    if (frozenMatchingFrame != null) {
      const frozenNormal = finiteVector3(frozenMatchingFrame.normal);
      const frozenResponseNormal = finiteVector3(
        frozenMatchingFrame.responseNormal
      );
      const frozenProjection = finiteNumber(
        frozenMatchingFrame.responseProjection,
        dot3(frozenResponseNormal, frozenNormal)
      );
      const frozenSupportDistanceM = finiteNumber(
        frozenMatchingFrame.supportDistanceM,
        restDistanceM
      );
      const frozenNormalLength = vectorLength(frozenNormal);
      const frozenResponseNormalLength = vectorLength(frozenResponseNormal);
      const frozenNormalAxis = frozenNormal.reduce(
        (best, value, axis) => (
          Math.abs(value) > Math.abs(frozenNormal[best]) ? axis : best
        ),
        0
      );
      const frozenTangentAxes = frozenNormalAxis === 0
        ? [1, 2]
        : frozenNormalAxis === 1
          ? [0, 2]
          : [0, 1];
      const frozenFaceToleranceM =
        schroederSpatialMechanicalAabbNormalRoundoffToleranceM({
          deltaM: delta,
          selfEdgeM: selfDiameterM,
          otherEdgeM: peerDiameterM
        });
      const frozenFaceIsActive =
        dot3(delta, frozenNormal)
          <= frozenSupportDistanceM + frozenFaceToleranceM
        && frozenTangentAxes.every(
          (axis) => Math.abs(delta[axis]) < frozenSupportDistanceM
        );
      const frozenSweptContact = frozenFaceIsActive
        || frozenMatchingFrame.admitted === false
        ? null
        : schroederSpatialMechanicalFiniteVolumeContact({
            deltaM: delta,
            epochDeltaM: epochDelta,
            selfEdgeM: selfDiameterM,
            otherEdgeM: peerDiameterM,
            selfIndex,
            otherIndex
          });
      const frozenSweptFaceIsActive = Boolean(
        frozenSweptContact?.sweptContact
        && dot3(frozenSweptContact.normal, frozenNormal) > 1 - 1e-6
      );
      if (
        frozenNormalLength > 1e-12
        && frozenResponseNormalLength > 1e-12
        && frozenProjection > 1e-6
        && frozenSupportDistanceM > 0
        // An initially admitted supporting face is still finite. Once cleanup
        // motion leaves either tangential slab, retaining its infinite
        // halfspace would manufacture a position and velocity impulse between
        // cells that no longer share a face. An initially admitted constraint
        // may still represent a genuine same-step sweep through that exact
        // frozen face even when the endpoint is tangentially disjoint.
        && (frozenFaceIsActive || frozenSweptFaceIsActive)
      ) {
        finiteVolumeContact = Object.freeze({
          normal: Object.freeze(frozenNormal),
          responseNormal: Object.freeze(frozenResponseNormal),
          responseProjection: frozenProjection,
          supportDistanceM: frozenSupportDistanceM,
          overlapM: Math.max(
            frozenSupportDistanceM - dot3(delta, frozenNormal),
            0
          ),
          sweptContact:
            Boolean(frozenMatchingFrame.sweptContact)
            || frozenSweptFaceIsActive,
          sweptImpactT:
            frozenMatchingFrame.sweptImpactT
            ?? frozenSweptContact?.sweptImpactT
            ?? null,
          cohortInverted: Boolean(frozenMatchingFrame.cohortInverted)
        });
      }
    } else {
      finiteVolumeContact =
        schroederSpatialMechanicalFiniteVolumeContact({
          deltaM: delta,
          epochDeltaM: epochDelta,
          selfEdgeM: selfDiameterM,
          otherEdgeM: peerDiameterM,
          selfIndex,
          otherIndex
        });
    }
    if (!finiteVolumeContact) {
      return Object.freeze({
        ...policy,
        unilateralContact,
        handled: false,
        reason: 'outside-pair-support',
        restDistanceM,
        distanceM,
        sweptDistanceM,
        sweptContact: false,
        cohortInverted: false,
        overlapM: 0,
        positionDeltaM: zero,
        otherPositionDeltaM: zero,
        velocityDeltaMPerS: zero,
        otherVelocityDeltaMPerS: zero
      });
    }
    const { normal } = finiteVolumeContact;
    let {
      responseNormal,
      responseProjection
    } = finiteVolumeContact;
    const relativeVelocity = vectorSubtract(
      finiteVector3(velocity),
      finiteVector3(otherVelocity)
    );
    const overlapM = finiteVolumeContact.overlapM;
    const inverseMass = 1 / Math.max(selfMass, 1e-30);
    const otherInverseMass = 1 / Math.max(peerMass, 1e-30);
    const inverseMassSum = inverseMass + otherInverseMass;
    const share = inverseMass / inverseMassSum;
    const otherShare = otherInverseMass / inverseMassSum;
    const approachMPerS = dot3(relativeVelocity, normal);
    const dampingSpeedMPerS = approachMPerS < 0 ? -approachMPerS : 0;
    let relativeVelocityDelta = vectorScale(
      responseNormal,
      dampingSpeedMPerS / responseProjection
    );
    if (approachMPerS < 0) {
      const centralLinearWorkSpeedSquared = dot3(
        relativeVelocity,
        relativeVelocityDelta
      );
      const kineticDeltaSpeedSquared =
        2 * centralLinearWorkSpeedSquared
          + dot3(
            relativeVelocityDelta,
            relativeVelocityDelta
          );
      const kineticToleranceSpeedSquared =
        64 * 1.1920928955078125e-7
          * Math.max(dot3(relativeVelocity, relativeVelocity), 1);
      if (
        centralLinearWorkSpeedSquared > 0
        || kineticDeltaSpeedSquared > kineticToleranceSpeedSquared
      ) {
        const radialApproachMPerS = dot3(
          relativeVelocity,
          responseNormal
        );
        const radialDelta = vectorScale(
          responseNormal,
          Math.max(-radialApproachMPerS, 0)
        );
        const afterRadial = vectorAdd(relativeVelocity, radialDelta);
        const faceDelta = vectorScale(
          normal,
          Math.max(-dot3(afterRadial, normal), 0)
        );
        relativeVelocityDelta = vectorAdd(radialDelta, faceDelta);
      }
    }
    return Object.freeze({
      ...policy,
      unilateralContact,
      handled: true,
      reason: 'overlapping-finite-volume-pair',
      restDistanceM,
      distanceM,
      sweptDistanceM,
      sweptContact: finiteVolumeContact.sweptContact,
      sweptImpactT: finiteVolumeContact.sweptImpactT,
      cohortInverted: finiteVolumeContact.cohortInverted,
      overlapM,
      normal: Object.freeze(normal),
      responseNormal: Object.freeze(responseNormal),
      responseProjection,
      supportDistanceM: finiteVolumeContact.supportDistanceM,
      positionDeltaM: Object.freeze(
        vectorScale(responseNormal, share * overlapM / responseProjection)
      ),
      otherPositionDeltaM: Object.freeze(
        vectorScale(
          responseNormal,
          -otherShare * overlapM / responseProjection
        )
      ),
      velocityDeltaMPerS: Object.freeze(
        vectorScale(relativeVelocityDelta, share)
      ),
      otherVelocityDeltaMPerS: Object.freeze(
        vectorScale(relativeVelocityDelta, -otherShare)
      )
    });
  }
  const sweptContact = unilateralContact && sweptDistanceM < restDistanceM;
  const epochDistanceM = vectorLength(epochDelta);
  const sweepB = dot3(epochDelta, sweepDelta);
  const sweepC = dot3(epochDelta, epochDelta)
    - restDistanceM * restDistanceM;
  const sweepDiscriminant = sweepB * sweepB - sweepLengthSq * sweepC;
  let sweptImpactT = null;
  let sweptImpactNormal = null;
  if (
    sweptContact
    && sweepLengthSq > 1e-18
    && sweepC >= -1e-12 * Math.max(restDistanceM * restDistanceM, 1)
    && sweepDiscriminant >= 0
  ) {
    const entryDenominator = -sweepB + Math.sqrt(sweepDiscriminant);
    const candidateT = entryDenominator > 1e-18
      ? sweepC / entryDenominator
      : Number.NaN;
    if (Number.isFinite(candidateT) && candidateT >= -1e-12 && candidateT <= 1 + 1e-12) {
      sweptImpactT = Math.min(1, Math.max(0, candidateT));
      const impactDelta = vectorAdd(
        epochDelta,
        vectorScale(sweepDelta, sweptImpactT)
      );
      const impactDistanceM = vectorLength(impactDelta);
      if (impactDistanceM > 1e-9) {
        sweptImpactNormal = vectorScale(impactDelta, 1 / impactDistanceM);
      } else {
        sweptImpactT = null;
      }
    }
  }
  let overlapM = Math.max(0, restDistanceM - distanceM);
  if (!(overlapM > 0) && !sweptContact) {
    return Object.freeze({
      ...policy,
      unilateralContact,
      handled: false,
      reason: 'outside-pair-support',
      restDistanceM,
      distanceM,
      sweptDistanceM,
      sweptContact: false,
      cohortInverted: false,
      overlapM: 0,
      positionDeltaM: zero,
      otherPositionDeltaM: zero,
      velocityDeltaMPerS: zero,
      otherVelocityDeltaMPerS: zero
    });
  }
  const cohortInverted = sweptContact && dot3(epochDelta, delta) <= 0;
  let normal;
  if (sweptImpactNormal) {
    // Project against the first time-of-impact sphere normal. Using the epoch
    // axis after a non-collinear cohort crossing creates a noncentral impulse
    // and changes orbital angular momentum. The impact normal preserves the
    // tangential remainder of the swept trajectory while restoring support.
    normal = sweptImpactNormal;
    overlapM = Math.max(0, restDistanceM - dot3(delta, normal));
  } else if (cohortInverted && epochDistanceM > 1e-9) {
    normal = vectorScale(epochDelta, 1 / epochDistanceM);
    overlapM = Math.max(0, restDistanceM - dot3(delta, normal));
  } else if (distanceM > 1e-9) {
    normal = vectorScale(delta, 1 / distanceM);
  } else if (sweptDistanceM > 1e-9) {
    normal = vectorScale(closestDelta, 1 / sweptDistanceM);
  } else {
    normal = schroederSpatialMechanicalCoincidenceNormal(selfIndex, otherIndex);
  }
  const inverseMass = 1 / Math.max(selfMass, 1e-30);
  const otherInverseMass = 1 / Math.max(peerMass, 1e-30);
  const inverseMassSum = inverseMass + otherInverseMass;
  const share = inverseMass / inverseMassSum;
  const otherShare = otherInverseMass / inverseMassSum;
  // Contact is a relative constraint. Split its complete residual by inverse
  // mass so independently evaluated endpoint rows preserve center of mass.
  // Depending on absolute lab-frame displacement would change the response
  // under a common translation and could canonize the wrong swept cohort.
  const positionShare = share;
  const otherPositionShare = otherShare;
  // A unilateral interface is a constraint, not optional liquid separation:
  // project the complete pair overlap. Its reciprocal velocity response is
  // owned by the mechanics-field solve, so this pre-integration particle
  // proposal is evaluated on the actual post-G2P state, so it removes only
  // residual closing motion left by the field solve. Softer
  // same-material liquid separation continues to honor the user controls.
  const alpha = unilateralContact
    ? 1
    : Math.max(0, finiteNumber(relaxation, 0));
  const beta = unilateralContact
    ? 1
    : Math.min(1, Math.max(0, finiteNumber(normalVelocityDamping, 0)));
  const positionDeltaM = vectorScale(normal, alpha * positionShare * overlapM);
  const otherPositionDeltaM = vectorScale(normal, -alpha * otherPositionShare * overlapM);
  const approachMPerS = dot3(
    vectorSubtract(finiteVector3(velocity), finiteVector3(otherVelocity)),
    normal
  );
  // The relative normal velocity is Galilean invariant. Inverse-mass endpoint
  // weights make its dissipative projection conserve linear momentum.
  const velocityShare = share;
  const otherVelocityShare = otherShare;
  const dampingSpeedMPerS = approachMPerS < 0 ? -beta * approachMPerS : 0;
  const velocityDeltaMPerS = vectorScale(
    normal,
    dampingSpeedMPerS * velocityShare
  );
  const otherVelocityDeltaMPerS = vectorScale(
    normal,
    -dampingSpeedMPerS * otherVelocityShare
  );
  return Object.freeze({
    ...policy,
    unilateralContact,
    handled: true,
    reason: 'overlapping-condensed-pair',
    restDistanceM,
    distanceM,
    sweptDistanceM,
    sweptContact,
    sweptImpactT,
    cohortInverted,
    overlapM,
    normal: Object.freeze(normal),
    positionDeltaM: Object.freeze(positionDeltaM),
    otherPositionDeltaM: Object.freeze(otherPositionDeltaM),
    velocityDeltaMPerS: Object.freeze(velocityDeltaMPerS),
    otherVelocityDeltaMPerS: Object.freeze(otherVelocityDeltaMPerS)
  });
}

export function exactU32(value, label, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffff_ffff
  ) {
    throw new RangeError(`${label} must be an exact ${positive ? 'positive ' : ''}u32`);
  }
  return value;
}

export function exactI32(value, label) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must be an exact i32`);
  }
  return value;
}

export function requireBuffer(device, buffer, label) {
  if (!buffer || !webGpuBufferMatchesDevice(buffer, device)) {
    throw new TypeError(`${label} must be a live buffer on the canonical generation device`);
  }
  return buffer;
}

export function resolveMechanicalDiagnosticTrace({
  device,
  diagnosticTrace,
  execution,
  particleCount,
  solverBudget
}) {
  if (diagnosticTrace == null) return null;
  const buffer = requireBuffer(
    device,
    diagnosticTrace.buffer,
    'diagnosticTrace.buffer'
  );
  const byteOffset = diagnosticTrace.byteOffset ?? 0;
  const alignment = Math.max(
    1,
    Math.trunc(finiteNumber(
      device?.limits?.minStorageBufferOffsetAlignment,
      256
    ))
  );
  if (
    !Number.isSafeInteger(byteOffset)
    || byteOffset < 0
    || byteOffset % alignment !== 0
  ) {
    throw new RangeError(
      `diagnosticTrace.byteOffset must be a nonnegative ${alignment}-byte multiple`
    );
  }
  const requestedTargetIndices = diagnosticTrace.targetIndices ?? null;
  let targetIndices = null;
  if (requestedTargetIndices != null) {
    if (
      !Array.isArray(requestedTargetIndices)
      || requestedTargetIndices.length
        !== SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
    ) {
      throw new RangeError(
        'diagnosticTrace.targetIndices must contain exactly two particle indices'
      );
    }
    targetIndices = Object.freeze(requestedTargetIndices.map(
      (value, index) => {
        const target = exactU32(
          value,
          `diagnosticTrace.targetIndices[${index}]`
        );
        if (target >= particleCount) {
          throw new RangeError(
            `diagnosticTrace.targetIndices[${index}] exceeds particleCount`
          );
        }
        return target;
      }
    ));
    if (targetIndices[0] === targetIndices[1]) {
      throw new RangeError(
        'diagnosticTrace.targetIndices must be distinct'
      );
    }
  }
  const traceWordCount = targetIndices
    ? solverBudget.diagnosticTargetTraceWords
    : SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_WORDS;
  const traceByteLength = targetIndices
    ? solverBudget.diagnosticTargetTraceBytes
    : SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_BYTES;
  if (
    !Number.isSafeInteger(buffer.size)
    || byteOffset + traceByteLength > buffer.size
  ) {
    throw new RangeError(
      `diagnosticTrace.buffer must expose one complete ${traceByteLength}-byte trace slot`
    );
  }
  const requiredUsage = 0x4 | 0x8 | 0x80;
  if (
    Number.isFinite(buffer.usage)
    && (buffer.usage & requiredUsage) !== requiredUsage
  ) {
    throw new TypeError(
      'diagnosticTrace.buffer requires COPY_SRC, COPY_DST, and STORAGE usage'
    );
  }
  const materialId = (value, label) => {
    const resolved = Number(value);
    if (
      !Number.isSafeInteger(resolved)
      || resolved < 0
      || Math.fround(resolved) !== resolved
    ) {
      throw new RangeError(`${label} must be a nonnegative exact f32 integer`);
    }
    return resolved;
  };
  const materialAId = materialId(
    diagnosticTrace.materialAId,
    'diagnosticTrace.materialAId'
  );
  const materialBId = materialId(
    diagnosticTrace.materialBId,
    'diagnosticTrace.materialBId'
  );
  if (materialAId === materialBId) {
    throw new RangeError('diagnosticTrace material IDs must be distinct');
  }
  const words = new Uint32Array(traceWordCount);
  const floats = new Float32Array(words.buffer);
  words[0] = SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_MAGIC;
  words[1] = SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_VERSION;
  words[2] =
    SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.HEADER_VALID;
  words[3] = exactU32(
    execution.generationId,
    'diagnosticTrace execution.generationId',
    { positive: true }
  );
  words[4] = exactU32(
    execution.storageGeneration,
    'diagnosticTrace execution.storageGeneration',
    { positive: true }
  );
  words[5] = exactU32(
    execution.physicsTick,
    'diagnosticTrace execution.physicsTick'
  );
  words[6] = exactU32(
    execution.physicsSubstep,
    'diagnosticTrace execution.physicsSubstep'
  );
  words[7] = exactU32(
    execution.positionEpoch,
    'diagnosticTrace execution.positionEpoch'
  );
  words[8] = exactU32(
    execution.topologyEpoch,
    'diagnosticTrace execution.topologyEpoch'
  );
  words[9] = exactU32(
    execution.supportEpoch,
    'diagnosticTrace execution.supportEpoch'
  );
  words[10] = exactU32(
    particleCount,
    'diagnosticTrace particleCount',
    { positive: true }
  );
  words[11] = solverBudget.cleanupPassBudget;
  floats[12] = materialAId;
  floats[13] = materialBId;
  for (const word of [18, 19, 30, 31, 33, 34, 35, 36, 37, 38]) {
    words[word] = 0xffff_ffff;
  }
  if (targetIndices) {
    const header =
      SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
    words[header] =
      SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC;
    words[header + 1] =
      SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION;
    words[header + 2] =
      SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS.HEADER_VALID;
    words[header + 3] = solverBudget.cleanupPassBudget;
    words[header + 4] =
      SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
    words[header + 5] =
      SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS;
    words[header + 6] = targetIndices[0];
    words[header + 7] = targetIndices[1];
    for (
      let passIndex = 0;
      passIndex < solverBudget.cleanupPassBudget;
      passIndex += 1
    ) {
      for (
        let targetSlot = 0;
        targetSlot
          < SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
        targetSlot += 1
      ) {
        const row =
          SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD
          + (
            passIndex
              * SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
            + targetSlot
          )
            * SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS;
        words[row] = passIndex;
        words[row + 1] = targetIndices[targetSlot];
        words[row + 2] = 0xffff_ffff;
        words[row + 3] = 0xffff_ffff;
        words[row + 4] = 0xffff_ffff;
      }
    }
  }
  device.queue.writeBuffer(buffer, byteOffset, words);
  return Object.freeze({
    buffer,
    byteOffset,
    byteLength: traceByteLength,
    materialAId,
    materialBId,
    targetIndices
  });
}

export function resolveMechanicalSpatialAuthority({
  device,
  generation,
  sphParticleUpload,
  mlsMpmParticleUpload,
  particleCount
}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('canonical mechanical proposals require a WebGPU-like device');
  }
  const execution = generation?.execution || null;
  const source = generation?.source || null;
  const runtime = generation?.runtime || null;
  if (
    generation?.selected !== true
    || generation?.ready !== true
    || generation?.releaseScheduled === true
    || generation?.directoryBuildCount !== 1
    || generation?.privateLookupBuildCount !== 0
    || execution?.submitPerformed !== true
    || execution?.released === true
    || execution?.generationId == null
    || source?.ready !== true
    || source?.sourceCount !== particleCount
    || source?.exactNearQueryProfile?.ready !== true
    || execution?.exactNearQueryProfile?.ready !== true
    || execution?.queryGeometryEvidence !== execution.exactNearQueryProfile
    || runtime !== execution?.ownerRuntime
    || execution?.deviceId !== webGpuDeviceId(device)
  ) {
    throw new TypeError(
      'canonical mechanical proposals require one live submitted exact-near generation'
    );
  }
  if (
    typeof runtime?.ownsExecution === 'function'
    && runtime.ownsExecution(execution) !== true
  ) {
    throw new TypeError('canonical mechanical proposal generation is not owned by its runtime');
  }
  if (
    typeof runtime?.isExecutionSubmitted === 'function'
    && runtime.isExecutionSubmitted(execution) !== true
  ) {
    throw new TypeError('canonical mechanical proposal generation has no submitted-work proof');
  }
  const stateBuffer = requireBuffer(
    device,
    sphParticleUpload?.stateBuffer,
    'sphParticleUpload.stateBuffer'
  );
  const thermoBuffer = requireBuffer(
    device,
    sphParticleUpload?.thermoBuffer,
    'sphParticleUpload.thermoBuffer'
  );
  const mechanicsBuffer = requireBuffer(
    device,
    mlsMpmParticleUpload?.mechanicsBuffer,
    'mlsMpmParticleUpload.mechanicsBuffer'
  );
  const directoryBuffer = requireBuffer(
    device,
    execution.directoryBuffer,
    'generation.execution.directoryBuffer'
  );
  const identityBuffer = sphParticleUpload?.identityBuffer
    ? requireBuffer(device, sphParticleUpload.identityBuffer, 'sphParticleUpload.identityBuffer')
    : null;
  return {
    generation,
    device,
    execution,
    source,
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    identityBuffer,
    directoryBuffer
  };
}

export function createSchroederSpatialExactNearExpectationArray({
  generation,
  supportProfileId,
  derivationEnabled = true
} = {}) {
  const execution = generation?.execution || null;
  const source = generation?.source || null;
  const profile = execution?.exactNearQueryProfile || source?.exactNearQueryProfile || null;
  const layout = execution?.layout || null;
  if (!execution || !source || !profile || !layout) {
    throw new TypeError('exact-near expectation requires a complete generation execution');
  }
  const buffer = new ArrayBuffer(EXPECTATION_BYTES);
  const view = new DataView(buffer);
  const u32 = (offset, value, label, options) => {
    view.setUint32(offset, exactU32(value, label, options), true);
  };
  u32(0, source.sourceCount, 'source.sourceCount', { positive: true });
  u32(4, derivationEnabled ? 1 : 0, 'derivationEnabled');
  u32(8, supportProfileId, 'supportProfileId', { positive: true });
  u32(12, profile.chartId, 'profile.chartId');
  u32(16, profile.levelCount, 'profile.levelCount', { positive: true });
  u32(20, execution.generationId, 'execution.generationId', { positive: true });
  u32(24, execution.deviceOrdinal, 'execution.deviceOrdinal');
  u32(28, execution.laneOrdinal, 'execution.laneOrdinal');
  u32(32, execution.leaseToken, 'execution.leaseToken', { positive: true });
  u32(36, execution.sourceFamilyId, 'execution.sourceFamilyId', { positive: true });
  u32(40, execution.storageGeneration, 'execution.storageGeneration', { positive: true });
  u32(44, execution.physicsTick, 'execution.physicsTick');
  u32(48, execution.physicsSubstep, 'execution.physicsSubstep');
  u32(52, execution.positionEpoch, 'execution.positionEpoch');
  u32(56, execution.topologyEpoch, 'execution.topologyEpoch');
  u32(60, execution.chartEpoch, 'execution.chartEpoch');
  u32(64, execution.levelEpoch, 'execution.levelEpoch');
  u32(68, execution.supportEpoch, 'execution.supportEpoch');
  view.setInt32(72, exactI32(profile.minLevel, 'profile.minLevel'), true);
  view.setFloat32(76, finiteNumber(profile.baseGridSpacingM, 0), true);
  u32(80, layout.cellKeysOffsetWords, 'layout.cellKeysOffsetWords');
  u32(84, layout.cellOffsetsOffsetWords, 'layout.cellOffsetsOffsetWords');
  u32(88, layout.cellMembersOffsetWords, 'layout.cellMembersOffsetWords');
  u32(92, layout.particleToCellOffsetWords, 'layout.particleToCellOffsetWords');
  u32(96, layout.wordLength, 'layout.wordLength', { positive: true });
  u32(100, execution.sourceCapacity, 'execution.sourceCapacity', { positive: true });
  u32(104, execution.cellCapacity, 'execution.cellCapacity', { positive: true });
  return buffer;
}

export function createMechanicalParamsArray({
  particleCount,
  directedPairCapacity,
  relaxation,
  normalVelocityDamping,
  gridSpacingM,
  boxDimsM,
  identityEnabled,
  unilateralVelocityImpulseHandledByMechanicsField = false,
  selectedLevel,
  phaseLineageCapacity,
  phaseLaneCount,
  retainCompleteAuthenticatedCellCliques,
  aggregateHierarchyEnabled,
  activeRankViewEnabled,
  aggregateSourceRowLayoutId,
  aggregateCapacityWords,
  solverIterationCount,
  execution
}) {
  const dims = Array.isArray(boxDimsM) ? boxDimsM : [5, 5, 5];
  const buffer = new ArrayBuffer(MECHANICAL_PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, exactU32(particleCount, 'particleCount', { positive: true }), true);
  view.setFloat32(4, Math.max(0, finiteNumber(relaxation, 0)), true);
  view.setFloat32(8, Math.min(1, Math.max(0, finiteNumber(normalVelocityDamping, 0))), true);
  view.setFloat32(12, Math.max(0, finiteNumber(gridSpacingM, 0)), true);
  view.setFloat32(16, finiteNumber(dims[0], 5), true);
  view.setFloat32(20, finiteNumber(dims[1], 5), true);
  view.setFloat32(24, finiteNumber(dims[2], 5), true);
  // Bit 0: particle identity buffer enabled. Bit 1: unilateral velocity impulse
  // is already owned by canonical mechanics-field `contact_fields` on this step
  // (suppresses duplicate `barrier_dv` while preserving `barrier_dx`).
  view.setUint32(
    28,
    (identityEnabled ? 1 : 0)
      | (unilateralVelocityImpulseHandledByMechanicsField ? 2 : 0),
    true
  );
  view.setUint32(32, SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1, true);
  view.setUint32(36, SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1, true);
  view.setUint32(40, SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1, true);
  view.setInt32(44, selectedLevel == null
    ? MECHANICAL_APPLY_ALL_LEVELS
    : exactI32(selectedLevel, 'selectedLevel'), true);
  view.setUint32(48, exactU32(execution?.generationId, 'execution.generationId', {
    positive: true
  }), true);
  view.setUint32(52, exactU32(execution?.supportEpoch, 'execution.supportEpoch'), true);
  view.setUint32(56, exactU32(execution?.positionEpoch, 'execution.positionEpoch'), true);
  view.setUint32(60, exactU32(execution?.topologyEpoch, 'execution.topologyEpoch'), true);
  view.setUint32(64, exactU32(
    execution?.storageGeneration,
    'execution.storageGeneration',
    { positive: true }
  ), true);
  view.setUint32(68, exactU32(execution?.physicsTick, 'execution.physicsTick'), true);
  view.setUint32(72, exactU32(execution?.physicsSubstep, 'execution.physicsSubstep'), true);
  view.setUint32(76, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC, true);
  view.setUint32(80, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_VERSION, true);
  view.setUint32(84, SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT, true);
  view.setUint32(88, SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.length, true);
  view.setUint32(92, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS, true);
  view.setUint32(96, exactU32(
    Math.max(0, Math.trunc(finiteNumber(phaseLineageCapacity, 0))),
    'phaseLineageCapacity'
  ), true);
  view.setUint32(100, exactU32(
    Math.max(0, Math.trunc(finiteNumber(phaseLaneCount, 0))),
    'phaseLaneCount'
  ), true);
  view.setUint32(104, exactU32(
    directedPairCapacity,
    'directedPairCapacity',
    { positive: true }
  ), true);
  view.setUint32(
    108,
    exactU32(solverIterationCount, 'solverIterationCount', {
      positive: true
    }),
    true
  );
  view.setUint32(112, retainCompleteAuthenticatedCellCliques ? 1 : 0, true);
  view.setUint32(
    116,
    aggregateHierarchyEnabled ? 1 : (activeRankViewEnabled ? 2 : 0),
    true
  );
  view.setUint32(120, exactU32(
    Math.max(0, Math.trunc(finiteNumber(aggregateSourceRowLayoutId, 0))),
    'aggregateSourceRowLayoutId'
  ), true);
  view.setUint32(124, exactU32(
    Math.max(0, Math.trunc(finiteNumber(aggregateCapacityWords, 0))),
    'aggregateCapacityWords'
  ), true);
  return buffer;
}

export function createMechanicalProposalHeader(execution, particleCount) {
  const words = new Uint32Array(SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS);
  words[0] = SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC;
  words[1] = SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_VERSION;
  words[2] = exactU32(execution?.generationId, 'execution.generationId', {
    positive: true
  });
  words[3] = exactU32(execution?.supportEpoch, 'execution.supportEpoch');
  words[4] = exactU32(particleCount, 'particleCount', { positive: true });
  words[5] = SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS;
  words[6] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1;
  words[7] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1;
  words[8] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1;
  words[9] = exactU32(execution?.positionEpoch, 'execution.positionEpoch');
  words[10] = exactU32(execution?.topologyEpoch, 'execution.topologyEpoch');
  words[11] = exactU32(
    execution?.storageGeneration,
    'execution.storageGeneration',
    { positive: true }
  );
  words[12] = exactU32(execution?.physicsTick, 'execution.physicsTick');
  words[13] = exactU32(execution?.physicsSubstep, 'execution.physicsSubstep');
  words[14] = SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT;
  words[15] = SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.length;
  return words;
}

export function createMechanicalMatchingCleanupControlHeader(
  execution,
  particleCount,
  solverBudget
) {
  const words = new Uint32Array(solverBudget.matchingCleanupControlWords);
  words[0] = MATCHING_CLEANUP_CONTROL_MAGIC;
  words[1] = MATCHING_CLEANUP_CONTROL_VERSION;
  words[2] = exactU32(execution?.generationId, 'execution.generationId', {
    positive: true
  });
  words[3] = exactU32(
    execution?.storageGeneration,
    'execution.storageGeneration',
    { positive: true }
  );
  words[4] = exactU32(execution?.physicsTick, 'execution.physicsTick');
  words[5] = exactU32(
    execution?.physicsSubstep,
    'execution.physicsSubstep'
  );
  words[6] = exactU32(execution?.positionEpoch, 'execution.positionEpoch');
  words[7] = exactU32(execution?.topologyEpoch, 'execution.topologyEpoch');
  words[8] = exactU32(execution?.supportEpoch, 'execution.supportEpoch');
  words[9] = exactU32(particleCount, 'particleCount', {
    positive: true
  });
  // Words 10 and 11 seal the declared per-invocation solver budget into the
  // GPU-visible control header; every budget-compiled shader verifies them
  // (fail-closed) before trusting the cleanup receipt lanes.
  words[10] = solverBudget.jacobiIterations;
  words[11] = solverBudget.cleanupPassBudget;
  return words;
}

export function createMechanicalPairGraphEvidenceHeader({
  execution,
  selectedLevel,
  particleCount,
  particleCapacity,
  directedPairCapacity
}) {
  const buffer = new ArrayBuffer(
    SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS * Uint32Array.BYTES_PER_ELEMENT
  );
  const view = new DataView(buffer);
  view.setUint32(0, SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC, true);
  view.setUint32(4, SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION, true);
  view.setUint32(8, 1, true);
  view.setUint32(12, exactU32(execution?.generationId, 'execution.generationId', {
    positive: true
  }), true);
  view.setUint32(16, exactU32(
    execution?.storageGeneration,
    'execution.storageGeneration',
    { positive: true }
  ), true);
  view.setUint32(20, exactU32(execution?.physicsTick, 'execution.physicsTick'), true);
  view.setUint32(
    24,
    exactU32(execution?.physicsSubstep, 'execution.physicsSubstep'),
    true
  );
  view.setUint32(28, exactU32(execution?.positionEpoch, 'execution.positionEpoch'), true);
  view.setUint32(32, exactU32(execution?.topologyEpoch, 'execution.topologyEpoch'), true);
  view.setUint32(36, exactU32(execution?.supportEpoch, 'execution.supportEpoch'), true);
  view.setInt32(40, exactI32(selectedLevel, 'selectedLevel'), true);
  view.setUint32(44, exactU32(particleCount, 'particleCount', { positive: true }), true);
  view.setUint32(
    48,
    exactU32(particleCapacity, 'particleCapacity', { positive: true }),
    true
  );
  view.setUint32(
    52,
    exactU32(directedPairCapacity, 'directedPairCapacity', { positive: true }),
    true
  );
  return buffer;
}

const exactNearTraversalV1Wgsl = createSchroederSpatialExactNearTraversalV1Wgsl({
  directoryBindingName: 'spatial_directory'
});
const exactNearTraversalV2Wgsl = createSchroederSpatialExactNearTraversalV2Wgsl({
  directoryBindingName: 'spatial_directory'
});

export const mechanicalContactGraphParamsWgsl = /* wgsl */ `
struct MechanicalProposalParams {
  particle_count: u32,
  relaxation: f32,
  normal_velocity_damping: f32,
  grid_spacing_m: f32,
  box_dims_m: vec3<f32>,
  identity_enabled: u32,
  contact_support_profile_id: u32,
  separation_support_profile_id: u32,
  interface_support_profile_id: u32,
  apply_selected_level: i32,
  generation_id: u32,
  support_epoch: u32,
  position_epoch: u32,
  topology_epoch: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  proposal_magic: u32,
  proposal_version: u32,
  traversal_count: u32,
  consumer_count: u32,
  proposal_row_words: u32,
  phase_lineage_capacity: u32,
  phase_lane_count: u32,
  directed_pair_capacity: u32,
  solver_iteration_count: u32,
  retain_complete_authenticated_cell_cliques: u32,
  aggregate_hierarchy_enabled: u32,
  aggregate_source_row_layout_id: u32,
  aggregate_capacity_words: u32,
};
`;

export const schroederSpatialMechanicalProposalWgsl = /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

@group(0) @binding(0) var<storage, read> current_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> source_identity: array<u32>;
@group(0) @binding(4) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(5) var<storage, read> spatial_source_rows: array<f32>;
@group(0) @binding(6) var<storage, read_write> source_counts: array<u32>;
@group(0) @binding(7) var<storage, read_write> append_records: array<u32>;
@group(0) @binding(8) var<storage, read_write> graph_control: array<atomic<u32>>;
@group(0) @binding(9) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(10) var<storage, read_write> global_support_bits: array<atomic<u32>>;
@group(0) @binding(11) var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(12) var<uniform> mechanical_params: MechanicalProposalParams;
@group(0) @binding(13) var<storage, read> spatial_aggregate_view: array<u32>;

${exactNearTraversalV1Wgsl}

const MECHANICAL_AGGREGATE_MAGIC: u32 = 0x53414731u;
const MECHANICAL_AGGREGATE_VERSION: u32 = 2u;
const MECHANICAL_AGGREGATE_HEADER_WORDS: u32 = 112u;
const MECHANICAL_AGGREGATE_RECORD_WORDS: u32 = 44u;
const MECHANICAL_AGGREGATE_TREE_ARITY: u32 = 2u;
const MECHANICAL_AGGREGATE_PREFIX_BITS: u32 = 160u;
const MECHANICAL_AGGREGATE_TOPOLOGY_MODE: u32 = 2u;
const MECHANICAL_AGGREGATE_STATUS_READY: u32 = 1u;
const MECHANICAL_AGGREGATE_STATUS_ADMITTED: u32 = 2u;
const MECHANICAL_AGGREGATE_STATUS_TRAVERSAL_READY: u32 = 256u;
const MECHANICAL_AGGREGATE_STATUS_EXACT: u32 = 259u;
const MECHANICAL_AGGREGATE_RECORD_VALID: u32 = 1u;
const MECHANICAL_AGGREGATE_RECORD_LEAF: u32 = 2u;
const MECHANICAL_AGGREGATE_RECORD_INTERNAL: u32 = 4u;
const MECHANICAL_AGGREGATE_RECORD_ROOT: u32 = 8u;
const MECHANICAL_AGGREGATE_RECORD_AUTHENTICATED: u32 = 64u;
const MECHANICAL_AGGREGATE_RECORD_DOMAIN_SUMMARY_EXACT: u32 = 128u;
const MECHANICAL_AGGREGATE_HIERARCHY_COMPILED: bool = true;
const MECHANICAL_AGGREGATE_INVALID_U32: u32 = 0xffffffffu;
const MECHANICAL_AGGREGATE_PREFLIGHT_FAILED: u32 = 0x80000000u;
const MECHANICAL_SUPPORT_ACTIVE_PROJECTION_MEMBER: u32 = 8u;
const MECHANICAL_SUPPORT_PHASE_GEOMETRY_OCCLUDED: u32 = 16u;
const MECHANICAL_ACTIVE_MEMBER_MAGIC: u32 = 0x53414d31u;
const MECHANICAL_ACTIVE_MEMBER_VERSION: u32 = 1u;
const MECHANICAL_ACTIVE_MEMBER_STATUS_EXACT: u32 = 3u;
const MECHANICAL_ACTIVE_MEMBER_CONSTRUCTION_CELL_PREFIX: u32 = 1u;
const MECHANICAL_PROJECTION_MODE_NONE: u32 = 0u;
const MECHANICAL_PROJECTION_MODE_AGGREGATE: u32 = 1u;
const MECHANICAL_PROJECTION_MODE_ACTIVE_RANK: u32 = 2u;
const MECHANICAL_ACTIVE_RANK_VIEW_COMPILED: bool = false;
const MECHANICAL_ACTIVE_RANK_VIEW_MAGIC: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAGIC >>> 0}u;
const MECHANICAL_ACTIVE_RANK_VIEW_VERSION: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_VERSION}u;
const MECHANICAL_ACTIVE_RANK_VIEW_STATUS_EXACT: u32 = ${
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_READY
  | SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_ADMITTED
}u;
const MECHANICAL_ACTIVE_RANK_VIEW_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS}u;
const MECHANICAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT}u;
const MECHANICAL_ACTIVE_RANK_VIEW_RANKS_PER_LANE: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_RANKS_PER_LANE}u;
const MECHANICAL_ACTIVE_RANK_VIEW_FINGERPRINT_BASIS: u32 = 2166136261u;
const MECHANICAL_ACTIVE_RANK_VIEW_FINGERPRINT_PRIME: u32 = 16777619u;

struct MechanicalActiveRankLookup {
  source_rank: u32,
  source_index: u32,
  admitted: u32,
};

struct MechanicalActiveRankRange {
  begin: u32,
  end: u32,
  admitted: u32,
};

fn mechanical_active_rank_fold(value: u32, word: u32) -> u32 {
  return (value ^ word) * MECHANICAL_ACTIVE_RANK_VIEW_FINGERPRINT_PRIME;
}

fn mechanical_active_rank_replay_guard_token() -> u32 {
  var value = mechanical_active_rank_fold(
    MECHANICAL_ACTIVE_RANK_VIEW_FINGERPRINT_BASIS,
    spatial_directory[3u]
  );
  value = mechanical_active_rank_fold(value, spatial_directory[7u]);
  value = mechanical_active_rank_fold(value, spatial_directory[8u]);
  value = mechanical_active_rank_fold(value, spatial_directory[9u]);
  value = mechanical_active_rank_fold(value, spatial_directory[10u]);
  value = mechanical_active_rank_fold(value, spatial_directory[11u]);
  value = mechanical_active_rank_fold(value, spatial_directory[12u]);
  value = mechanical_active_rank_fold(value, spatial_directory[13u]);
  value = mechanical_active_rank_fold(value, spatial_directory[14u]);
  value = mechanical_active_rank_fold(value, spatial_directory[15u]);
  return mechanical_active_rank_fold(value, spatial_directory[35u]);
}

fn mechanical_active_rank_header_fingerprint(
  replay_token: u32,
  active_count: u32,
  dormant_count: u32,
  prefix_offset: u32,
  prefix_capacity: u32,
  active_ranks_offset: u32,
  active_rank_capacity: u32,
  active_source_indices_offset: u32,
  active_source_index_capacity: u32
) -> u32 {
  var value = mechanical_active_rank_fold(replay_token, prefix_offset);
  value = mechanical_active_rank_fold(value, prefix_capacity);
  value = mechanical_active_rank_fold(value, active_ranks_offset);
  value = mechanical_active_rank_fold(value, active_rank_capacity);
  value = mechanical_active_rank_fold(value, active_source_indices_offset);
  value = mechanical_active_rank_fold(value, active_source_index_capacity);
  value = mechanical_active_rank_fold(value, active_count);
  value = mechanical_active_rank_fold(value, dormant_count);
  return mechanical_active_rank_fold(value, 1u);
}

fn mechanical_active_rank_view_admitted() -> bool {
  if (
    !MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
    || mechanical_params.aggregate_hierarchy_enabled
      != MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
    || !ss_exact_near_directory_admitted(spatial_expectation)
    || arrayLength(&spatial_aggregate_view)
      < MECHANICAL_ACTIVE_RANK_VIEW_HEADER_WORDS
  ) { return false; }
  let source_count = spatial_expectation.source_count;
  let source_capacity = spatial_directory[17u];
  let prefix_offset = MECHANICAL_ACTIVE_RANK_VIEW_HEADER_WORDS;
  let prefix_capacity = source_capacity + 1u;
  let active_ranks_offset = prefix_offset + prefix_capacity;
  let active_source_indices_offset = active_ranks_offset + source_capacity;
  let physical_capacity = active_source_indices_offset + source_capacity;
  let active_count = spatial_aggregate_view[26u];
  let dormant_count = spatial_aggregate_view[27u];
  let replay_token = mechanical_active_rank_replay_guard_token();
  let dispatch_x = max(1u, (active_count + 63u) / 64u);
  return source_capacity <= MECHANICAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT
    && physical_capacity <= arrayLength(&spatial_aggregate_view)
    && spatial_aggregate_view[0u] == MECHANICAL_ACTIVE_RANK_VIEW_MAGIC
    && spatial_aggregate_view[1u] == MECHANICAL_ACTIVE_RANK_VIEW_VERSION
    && spatial_aggregate_view[2u] == MECHANICAL_ACTIVE_RANK_VIEW_STATUS_EXACT
    && spatial_aggregate_view[3u] == spatial_directory[3u]
    && spatial_aggregate_view[4u] == spatial_directory[4u]
    && spatial_aggregate_view[5u] == spatial_directory[5u]
    && spatial_aggregate_view[6u] == spatial_directory[6u]
    && spatial_aggregate_view[7u] == spatial_directory[7u]
    && spatial_aggregate_view[8u] == spatial_directory[8u]
    && spatial_aggregate_view[9u] == spatial_directory[9u]
    && spatial_aggregate_view[10u] == spatial_directory[10u]
    && spatial_aggregate_view[11u] == spatial_directory[11u]
    && spatial_aggregate_view[12u] == spatial_directory[12u]
    && spatial_aggregate_view[13u] == spatial_directory[13u]
    && spatial_aggregate_view[14u] == spatial_directory[14u]
    && spatial_aggregate_view[15u] == spatial_directory[15u]
    && spatial_aggregate_view[16u] == source_count
    && spatial_aggregate_view[17u] == source_capacity
    && spatial_aggregate_view[18u] == spatial_directory[18u]
    && spatial_aggregate_view[19u] == spatial_directory[19u]
    && spatial_aggregate_view[20u] == MECHANICAL_ACTIVE_RANK_VIEW_HEADER_WORDS
    && spatial_aggregate_view[21u] == prefix_offset
    && spatial_aggregate_view[22u] == prefix_capacity
    && spatial_aggregate_view[23u] == active_ranks_offset
    && spatial_aggregate_view[24u] == source_capacity
    && spatial_aggregate_view[25u] == physical_capacity
    && active_count <= source_count
    && dormant_count == source_count - active_count
    && spatial_aggregate_view[28u] == 0u
    && spatial_aggregate_view[29u] == 1u
    && spatial_aggregate_view[30u] == spatial_directory[46u]
    && spatial_aggregate_view[31u] == spatial_directory[31u]
    && spatial_aggregate_view[32u] == spatial_directory[35u]
    && spatial_aggregate_view[33u] == spatial_directory[35u]
    && spatial_aggregate_view[34u] == spatial_directory[33u]
    && spatial_aggregate_view[35u] == 64u
    && spatial_aggregate_view[36u] == 44u
    && spatial_aggregate_view[37u] == 3u
    && spatial_aggregate_view[38u] == spatial_directory[22u]
    && spatial_aggregate_view[39u] == spatial_directory[47u]
    && spatial_aggregate_view[40u] == replay_token
    && spatial_aggregate_view[41u] == mechanical_active_rank_header_fingerprint(
      replay_token,
      active_count,
      dormant_count,
      prefix_offset,
      prefix_capacity,
      active_ranks_offset,
      source_capacity,
      active_source_indices_offset,
      source_capacity
    )
    && spatial_aggregate_view[42u]
      == MECHANICAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT
    && spatial_aggregate_view[43u]
      == MECHANICAL_ACTIVE_RANK_VIEW_RANKS_PER_LANE
    && spatial_aggregate_view[44u] == dispatch_x
    && spatial_aggregate_view[45u] == 1u
    && spatial_aggregate_view[46u] == 1u
    && spatial_aggregate_view[47u]
      == MECHANICAL_ACTIVE_RANK_VIEW_HEADER_WORDS
    && spatial_aggregate_view[48u] == physical_capacity
    && spatial_aggregate_view[49u] == active_source_indices_offset
    && spatial_aggregate_view[50u] == source_capacity
    && spatial_aggregate_view[prefix_offset] == 0u
    && spatial_aggregate_view[prefix_offset + source_count] == active_count;
}

fn mechanical_active_rank_source_at_rank(
  source_rank: u32
) -> MechanicalActiveRankLookup {
  let rejected = MechanicalActiveRankLookup(0u, 0u, 0u);
  if (source_rank >= spatial_expectation.source_count) { return rejected; }
  let member_word = spatial_directory[31u] + source_rank;
  if (member_word >= arrayLength(&spatial_directory)) { return rejected; }
  let source_index = spatial_directory[member_word];
  if (source_index >= mechanical_params.particle_count) { return rejected; }
  return MechanicalActiveRankLookup(source_rank, source_index, 1u);
}

fn mechanical_active_rank_membership_matches(
  source_rank: u32,
  source_index: u32,
  mechanically_active: bool
) -> bool {
  let prefix_offset = spatial_aggregate_view[21u];
  let active_ranks_offset = spatial_aggregate_view[23u];
  let active_source_indices_offset = spatial_aggregate_view[49u];
  if (
    source_rank >= spatial_expectation.source_count
    || prefix_offset + source_rank + 1u >= arrayLength(&spatial_aggregate_view)
  ) { return false; }
  let prefix = spatial_aggregate_view[prefix_offset + source_rank];
  let next_prefix = spatial_aggregate_view[prefix_offset + source_rank + 1u];
  let expected_delta = select(0u, 1u, mechanically_active);
  if (
    prefix > next_prefix
    || next_prefix - prefix != expected_delta
    || next_prefix > spatial_aggregate_view[26u]
  ) { return false; }
  if (!mechanically_active) { return true; }
  return active_ranks_offset + prefix < arrayLength(&spatial_aggregate_view)
    && active_source_indices_offset + prefix
      < arrayLength(&spatial_aggregate_view)
    && spatial_aggregate_view[active_ranks_offset + prefix] == source_rank
    && spatial_aggregate_view[active_source_indices_offset + prefix]
      == source_index;
}

fn mechanical_active_rank_source_at_ordinal(
  active_ordinal: u32
) -> MechanicalActiveRankLookup {
  let rejected = MechanicalActiveRankLookup(0u, 0u, 0u);
  let active_count = spatial_aggregate_view[26u];
  let active_ranks_offset = spatial_aggregate_view[23u];
  let active_source_indices_offset = spatial_aggregate_view[49u];
  if (
    active_ordinal >= active_count
    || active_ranks_offset + active_ordinal
      >= arrayLength(&spatial_aggregate_view)
    || active_source_indices_offset + active_ordinal
      >= arrayLength(&spatial_aggregate_view)
  ) { return rejected; }
  let source_rank = spatial_aggregate_view[active_ranks_offset + active_ordinal];
  let source_index = spatial_aggregate_view[
    active_source_indices_offset + active_ordinal
  ];
  if (
    source_rank >= spatial_expectation.source_count
    || source_index >= mechanical_params.particle_count
  ) { return rejected; }
  return MechanicalActiveRankLookup(source_rank, source_index, 1u);
}

fn mechanical_active_rank_cell_range(
  member_begin: u32,
  member_end: u32
) -> MechanicalActiveRankRange {
  let rejected = MechanicalActiveRankRange(0u, 0u, 0u);
  let prefix_offset = spatial_aggregate_view[21u];
  if (
    member_begin > member_end
    || member_end > spatial_expectation.source_count
    || prefix_offset + member_end >= arrayLength(&spatial_aggregate_view)
  ) { return rejected; }
  let begin = spatial_aggregate_view[prefix_offset + member_begin];
  let end = spatial_aggregate_view[prefix_offset + member_end];
  if (begin > end || end > spatial_aggregate_view[26u]) { return rejected; }
  return MechanicalActiveRankRange(begin, end, 1u);
}

// ULG_MECHANICAL_AGGREGATE_HELPERS_BEGIN
fn mechanical_aggregate_mix_u32(input_value: u32) -> u32 {
  var value = input_value;
  value = (value ^ (value >> 16u)) * 0x7feb352du;
  value = (value ^ (value >> 15u)) * 0x846ca68bu;
  return value ^ (value >> 16u);
}

fn mechanical_aggregate_fold_fingerprint(seed: u32, value: u32) -> u32 {
  return mechanical_aggregate_mix_u32(
    seed ^ mechanical_aggregate_mix_u32(value)
  );
}

fn mechanical_aggregate_record_base(record_index: u32) -> u32 {
  return MECHANICAL_AGGREGATE_HEADER_WORDS
    + record_index * MECHANICAL_AGGREGATE_RECORD_WORDS;
}

fn mechanical_aggregate_replay_guard_token(cell_count: u32) -> u32 {
  var token = mechanical_aggregate_fold_fingerprint(
    MECHANICAL_AGGREGATE_MAGIC,
    spatial_expectation.source_count
  );
  token = mechanical_aggregate_fold_fingerprint(token, cell_count);
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_generation_id
  );
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_storage_generation
  );
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_position_epoch
  );
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_topology_epoch
  );
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_chart_epoch
  );
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_level_epoch
  );
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_support_epoch
  );
  return mechanical_aggregate_fold_fingerprint(token, spatial_directory[35u]);
}

fn mechanical_aggregate_header_fingerprint(
  replay_token: u32,
  total_record_count: u32,
  root_record_index: u32
) -> u32 {
  var value = mechanical_aggregate_fold_fingerprint(
    replay_token,
    total_record_count
  );
  value = mechanical_aggregate_fold_fingerprint(value, root_record_index);
  return mechanical_aggregate_fold_fingerprint(
    value,
    MECHANICAL_AGGREGATE_PREFIX_BITS
  );
}

fn mechanical_active_member_fingerprint(active_member_count: u32) -> u32 {
  var value = mechanical_aggregate_fold_fingerprint(
    spatial_aggregate_view[101u],
    MECHANICAL_ACTIVE_MEMBER_MAGIC
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[94u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[95u]
  );
  value = mechanical_aggregate_fold_fingerprint(value, spatial_expectation.source_count);
  value = mechanical_aggregate_fold_fingerprint(value, spatial_directory[18u]);
  value = mechanical_aggregate_fold_fingerprint(value, active_member_count);
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_expectation.expected_generation_id
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_expectation.expected_storage_generation
  );
  return mechanical_aggregate_fold_fingerprint(value, spatial_directory[35u]);
}

fn mechanical_aggregate_topology_fingerprint(record_index: u32) -> u32 {
  let base = mechanical_aggregate_record_base(record_index);
  var value = mechanical_aggregate_fold_fingerprint(
    spatial_aggregate_view[62u],
    record_index
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 27u] & (
      MECHANICAL_AGGREGATE_RECORD_LEAF
        | MECHANICAL_AGGREGATE_RECORD_INTERNAL
        | MECHANICAL_AGGREGATE_RECORD_ROOT
    )
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 28u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 29u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 30u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 31u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 32u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 36u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 37u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 38u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 39u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 40u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 33u]
  );
  return mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 34u]
  );
}

fn mechanical_aggregate_view_admitted() -> bool {
  if (!MECHANICAL_AGGREGATE_HIERARCHY_COMPILED) {
    return mechanical_params.aggregate_hierarchy_enabled == 0u;
  }
  if (mechanical_params.aggregate_hierarchy_enabled == 0u) { return true; }
  let bound_words = arrayLength(&spatial_aggregate_view);
  if (
    bound_words < MECHANICAL_AGGREGATE_HEADER_WORDS
    || mechanical_params.aggregate_capacity_words
      > bound_words
    || mechanical_params.aggregate_capacity_words
      < MECHANICAL_AGGREGATE_HEADER_WORDS
  ) { return false; }
  let cell_count = spatial_directory[18u];
  if (cell_count == 0u || cell_count > 0x03ffffffu) { return false; }
  let leaf_count = spatial_aggregate_view[23u];
  let internal_count = spatial_aggregate_view[55u];
  let total_record_count = spatial_aggregate_view[54u];
  let root_record_index = spatial_aggregate_view[53u];
  let expected_total_record_count = cell_count * 2u - 1u;
  let expected_internal_count = cell_count - 1u;
  let required_words = MECHANICAL_AGGREGATE_HEADER_WORDS
    + expected_total_record_count * MECHANICAL_AGGREGATE_RECORD_WORDS;
  let root_record_base = mechanical_aggregate_record_base(root_record_index);
  let replay_token = mechanical_aggregate_replay_guard_token(cell_count);
  return spatial_aggregate_view[0u] == MECHANICAL_AGGREGATE_MAGIC
    && spatial_aggregate_view[1u] == MECHANICAL_AGGREGATE_VERSION
    && spatial_aggregate_view[2u] == MECHANICAL_AGGREGATE_STATUS_EXACT
    && spatial_aggregate_view[3u]
      == spatial_expectation.expected_generation_id
    && spatial_aggregate_view[4u]
      == spatial_expectation.expected_device_ordinal
    && spatial_aggregate_view[5u]
      == spatial_expectation.expected_lane_ordinal
    && spatial_aggregate_view[6u]
      == spatial_expectation.expected_lease_token
    && spatial_aggregate_view[7u]
      == spatial_expectation.expected_source_family_id
    && spatial_aggregate_view[8u]
      == spatial_expectation.expected_storage_generation
    && spatial_aggregate_view[9u]
      == spatial_expectation.expected_physics_tick
    && spatial_aggregate_view[10u]
      == spatial_expectation.expected_physics_substep
    && spatial_aggregate_view[11u]
      == spatial_expectation.expected_position_epoch
    && spatial_aggregate_view[12u]
      == spatial_expectation.expected_topology_epoch
    && spatial_aggregate_view[13u]
      == spatial_expectation.expected_chart_epoch
    && spatial_aggregate_view[14u]
      == spatial_expectation.expected_level_epoch
    && spatial_aggregate_view[15u]
      == spatial_expectation.expected_support_epoch
    && spatial_aggregate_view[16u] == spatial_expectation.source_count
    && spatial_aggregate_view[17u]
      == spatial_expectation.expected_source_capacity
    && spatial_aggregate_view[18u] == cell_count
    && spatial_aggregate_view[19u]
      == spatial_expectation.expected_cell_capacity
    && spatial_aggregate_view[20u] == MECHANICAL_AGGREGATE_RECORD_WORDS
    && spatial_aggregate_view[21u] == MECHANICAL_AGGREGATE_HEADER_WORDS
    && spatial_aggregate_view[23u] == cell_count
    && spatial_aggregate_view[24u] == MECHANICAL_AGGREGATE_TREE_ARITY
    && spatial_aggregate_view[27u] == expected_internal_count
    && spatial_aggregate_view[29u] == expected_total_record_count
    && spatial_aggregate_view[30u] == required_words
    && spatial_aggregate_view[30u] <= mechanical_params.aggregate_capacity_words
    && spatial_aggregate_view[31u] == mechanical_params.aggregate_capacity_words
    && spatial_aggregate_view[32u] == 0u
    && spatial_aggregate_view[33u] == 0u
    && spatial_aggregate_view[34u] == 0u
    && spatial_aggregate_view[35u] == 0u
    && spatial_aggregate_view[36u] == spatial_expectation.source_count
    && spatial_aggregate_view[37u] == spatial_expectation.source_count
    && spatial_aggregate_view[38u] == cell_count
    && spatial_aggregate_view[39u] == expected_internal_count
    && spatial_aggregate_view[40u] == spatial_directory[35u]
    && spatial_aggregate_view[41u]
      == spatial_expectation.expected_generation_id
    && spatial_aggregate_view[42u] == spatial_directory[35u]
    && spatial_aggregate_view[43u]
      == mechanical_params.aggregate_source_row_layout_id
    && spatial_aggregate_view[44u] == 8u
    && spatial_aggregate_view[45u] == 12u
    && spatial_aggregate_view[46u] == 1u
    && spatial_aggregate_view[51u] == MECHANICAL_AGGREGATE_TOPOLOGY_MODE
    && spatial_aggregate_view[52u] == MECHANICAL_AGGREGATE_PREFIX_BITS
    && leaf_count == cell_count
    && internal_count == expected_internal_count
    && total_record_count == expected_total_record_count
    && root_record_index < total_record_count
    && root_record_base + 43u < mechanical_params.aggregate_capacity_words
    && spatial_aggregate_view[root_record_base + 43u]
      == spatial_expectation.source_count
    && spatial_aggregate_view[root_record_base + 19u]
      <= spatial_expectation.source_count
    && internal_count + leaf_count == total_record_count
    && spatial_aggregate_view[56u] != 0u
    && spatial_aggregate_view[57u] == MECHANICAL_AGGREGATE_STATUS_EXACT
    && spatial_aggregate_view[58u] == cell_count
    && spatial_aggregate_view[59u] == 0u
    && spatial_aggregate_view[60u] == 9u
    && spatial_aggregate_view[62u] != 0u
    && spatial_aggregate_view[62u] == replay_token
    && spatial_aggregate_view[63u] == mechanical_aggregate_header_fingerprint(
      replay_token,
      total_record_count,
      root_record_index
    )
    && spatial_aggregate_view[72u] == cell_count
    && spatial_aggregate_view[73u] == total_record_count
    && spatial_aggregate_view[74u] == expected_internal_count
    && spatial_aggregate_view[75u] == expected_internal_count * 2u
    && spatial_aggregate_view[76u] == total_record_count
    && spatial_aggregate_view[77u] == total_record_count
    && spatial_aggregate_view[78u] == 1u
    && spatial_aggregate_view[79u] == 0u
    && spatial_aggregate_view[80u] == root_record_index
    && spatial_aggregate_view[81u] == MECHANICAL_AGGREGATE_INVALID_U32
    && spatial_aggregate_view[82u] == 1u
    && spatial_aggregate_view[83u] == 1u
    && spatial_aggregate_view[84u] == MECHANICAL_AGGREGATE_TREE_ARITY
    && spatial_aggregate_view[85u] == total_record_count
    && spatial_aggregate_view[86u] == spatial_directory[46u]
    && spatial_aggregate_view[87u]
      == spatial_expectation.expected_cell_keys_offset_words
    && spatial_aggregate_view[88u]
      == spatial_expectation.expected_cell_offsets_offset_words
    && spatial_aggregate_view[89u]
      == spatial_expectation.expected_cell_members_offset_words
    && spatial_aggregate_view[90u]
      == spatial_expectation.expected_particle_to_cell_offset_words
    && spatial_aggregate_view[91u] == MECHANICAL_ACTIVE_MEMBER_MAGIC
    && spatial_aggregate_view[92u] == MECHANICAL_ACTIVE_MEMBER_VERSION
    && spatial_aggregate_view[93u] == MECHANICAL_ACTIVE_MEMBER_STATUS_EXACT
    && spatial_aggregate_view[94u]
      == mechanical_params.aggregate_capacity_words
    && spatial_aggregate_view[95u]
      == spatial_expectation.expected_source_capacity
    && spatial_aggregate_view[96u]
      == spatial_aggregate_view[root_record_base + 19u]
    && spatial_aggregate_view[97u] == spatial_expectation.source_count
    && spatial_aggregate_view[98u] == cell_count
    && spatial_aggregate_view[99u]
      == spatial_expectation.expected_generation_id
    && spatial_aggregate_view[100u] == spatial_directory[35u]
    && spatial_aggregate_view[101u] == replay_token
    && spatial_aggregate_view[102u] == spatial_directory[46u]
    && spatial_aggregate_view[103u]
      == spatial_expectation.expected_cell_members_offset_words
    && spatial_aggregate_view[104u] == cell_count
    && spatial_aggregate_view[105u] == 0u
    && spatial_aggregate_view[106u]
      == MECHANICAL_ACTIVE_MEMBER_CONSTRUCTION_CELL_PREFIX
    && spatial_aggregate_view[107u]
      == mechanical_params.aggregate_capacity_words
        + spatial_expectation.expected_source_capacity
    && spatial_aggregate_view[107u] <= bound_words
    && spatial_aggregate_view[108u]
      == mechanical_params.aggregate_source_row_layout_id
    && spatial_aggregate_view[109u]
      == spatial_expectation.expected_storage_generation
    && spatial_aggregate_view[110u]
      == mechanical_active_member_fingerprint(spatial_aggregate_view[96u]);
}

fn mechanical_aggregate_squared_distance_to_aabb(
  point: vec3<f32>,
  minimum: vec3<f32>,
  maximum: vec3<f32>
) -> f32 {
  let delta = max(max(minimum - point, point - maximum), vec3<f32>(0.0));
  return dot(delta, delta);
}

fn mechanical_aggregate_empty_payload_exact(base: u32) -> bool {
  for (var word = 0u; word <= 24u; word = word + 1u) {
    if (spatial_aggregate_view[base + word] != 0u) { return false; }
  }
  return spatial_aggregate_view[base + 25u]
      == MECHANICAL_AGGREGATE_INVALID_U32
    && spatial_aggregate_view[base + 26u]
      == MECHANICAL_AGGREGATE_INVALID_U32
    && spatial_aggregate_view[base + 42u]
      == MECHANICAL_AGGREGATE_INVALID_U32;
}

fn mechanical_aggregate_record_preflight(record_index: u32) -> bool {
  let bound_words = arrayLength(&spatial_aggregate_view);
  let capacity_words = mechanical_params.aggregate_capacity_words;
  if (
    capacity_words < MECHANICAL_AGGREGATE_HEADER_WORDS
    || capacity_words > bound_words
    || record_index > (
      capacity_words - MECHANICAL_AGGREGATE_HEADER_WORDS
    ) / MECHANICAL_AGGREGATE_RECORD_WORDS
  ) { return false; }
  let total_record_count = spatial_aggregate_view[54u];
  let leaf_count = spatial_aggregate_view[23u];
  let root_record_index = spatial_aggregate_view[53u];
  let record_capacity = (
    capacity_words - MECHANICAL_AGGREGATE_HEADER_WORDS
  ) / MECHANICAL_AGGREGATE_RECORD_WORDS;
  if (record_index >= total_record_count) { return false; }
  let base = mechanical_aggregate_record_base(record_index);
  if (
    base > capacity_words
    || MECHANICAL_AGGREGATE_RECORD_WORDS > capacity_words - base
  ) { return false; }
  let status = spatial_aggregate_view[base + 27u];
  let is_leaf = (status & MECHANICAL_AGGREGATE_RECORD_LEAF) != 0u;
  let is_internal = (status & MECHANICAL_AGGREGATE_RECORD_INTERNAL) != 0u;
  let is_root = (status & MECHANICAL_AGGREGATE_RECORD_ROOT) != 0u;
  let rank_begin = spatial_aggregate_view[base + 38u];
  let rank_end = spatial_aggregate_view[base + 39u];
  let escape_record_index = spatial_aggregate_view[base + 37u];
  let active_member_count = spatial_aggregate_view[base + 19u];
  let source_member_count = spatial_aggregate_view[base + 43u];
  let minimum = vec3<f32>(
    bitcast<f32>(spatial_aggregate_view[base + 12u]),
    bitcast<f32>(spatial_aggregate_view[base + 13u]),
    bitcast<f32>(spatial_aggregate_view[base + 14u])
  );
  let maximum = vec3<f32>(
    bitcast<f32>(spatial_aggregate_view[base + 15u]),
    bitcast<f32>(spatial_aggregate_view[base + 16u]),
    bitcast<f32>(spatial_aggregate_view[base + 17u])
  );
  var valid = (
    status & (
      MECHANICAL_AGGREGATE_RECORD_VALID
        | MECHANICAL_AGGREGATE_RECORD_AUTHENTICATED
    )
  ) == (
    MECHANICAL_AGGREGATE_RECORD_VALID
      | MECHANICAL_AGGREGATE_RECORD_AUTHENTICATED
  )
    && is_leaf != is_internal
    && is_leaf == (record_index < leaf_count)
    && is_root == (record_index == root_record_index)
    && rank_begin < rank_end
    && rank_end <= leaf_count
    && source_member_count > 0u
    && source_member_count <= mechanical_params.particle_count
    && active_member_count <= source_member_count
    && (
      escape_record_index == MECHANICAL_AGGREGATE_INVALID_U32
      || escape_record_index < total_record_count
    )
    && all(vec3<bool>(
      ss_exact_near_finite(minimum.x),
      ss_exact_near_finite(minimum.y),
      ss_exact_near_finite(minimum.z)
    ))
    && all(vec3<bool>(
      ss_exact_near_finite(maximum.x),
      ss_exact_near_finite(maximum.y),
      ss_exact_near_finite(maximum.z)
    ))
    && all(minimum <= maximum)
    && spatial_aggregate_view[base + 41u]
      == mechanical_aggregate_topology_fingerprint(record_index);
  if (!valid) { return false; }
  if (is_root) {
    valid = spatial_aggregate_view[base + 36u]
        == MECHANICAL_AGGREGATE_INVALID_U32
      && escape_record_index == MECHANICAL_AGGREGATE_INVALID_U32
      && rank_begin == 0u
      && rank_end == leaf_count
      && source_member_count == mechanical_params.particle_count;
    if (!valid) { return false; }
  }
  if (is_internal) {
    let left_child = spatial_aggregate_view[base + 33u];
    let right_child = spatial_aggregate_view[base + 34u];
    if (
      left_child >= total_record_count
      || right_child >= total_record_count
      || left_child >= record_capacity
      || right_child >= record_capacity
      || left_child == right_child
    ) { return false; }
    let left_base = mechanical_aggregate_record_base(left_child);
    let right_base = mechanical_aggregate_record_base(right_child);
    let left_source_count = spatial_aggregate_view[left_base + 43u];
    let right_source_count = spatial_aggregate_view[right_base + 43u];
    let left_active_count = spatial_aggregate_view[left_base + 19u];
    let right_active_count = spatial_aggregate_view[right_base + 19u];
    valid = left_source_count <= source_member_count
      && right_source_count == source_member_count - left_source_count
      && left_active_count <= active_member_count
      && right_active_count == active_member_count - left_active_count;
    if (!valid) { return false; }
  }
  if (!is_leaf) {
    return active_member_count != 0u
      || mechanical_aggregate_empty_payload_exact(base);
  }
  if (
    active_member_count == 0u
    && !mechanical_aggregate_empty_payload_exact(base)
  ) { return false; }
  let cell_index = spatial_aggregate_view[base + 35u];
  if (cell_index != record_index || cell_index >= leaf_count) { return false; }
  let member_range = ss_exact_near_cell_member_range(
    spatial_expectation,
    cell_index
  );
  if (
    member_range.admitted == 0u
    || rank_end != rank_begin + 1u
    || spatial_aggregate_view[base + 33u] != member_range.begin
    || spatial_aggregate_view[base + 34u] != member_range.end
    || source_member_count != member_range.end - member_range.begin
  ) { return false; }
  let cell_level_order = ss_exact_near_cell_key_word(
    spatial_expectation,
    cell_index,
    1u
  );
  let cell_level = bitcast<i32>(cell_level_order ^ 0x80000000u);
  let cell_spacing_m = spatial_expectation.base_grid_spacing_m
    * exp2(f32(cell_level));
  let cell_coordinates = vec3<f32>(
    f32(bitcast<i32>(ss_exact_near_cell_key_word(
      spatial_expectation,
      cell_index,
      2u
    ) ^ 0x80000000u)),
    f32(bitcast<i32>(ss_exact_near_cell_key_word(
      spatial_expectation,
      cell_index,
      3u
    ) ^ 0x80000000u)),
    f32(bitcast<i32>(ss_exact_near_cell_key_word(
      spatial_expectation,
      cell_index,
      4u
    ) ^ 0x80000000u))
  );
  let cell_minimum = cell_coordinates * cell_spacing_m;
  let cell_maximum = (cell_coordinates + vec3<f32>(1.0)) * cell_spacing_m;
  if (
    !ss_exact_near_finite(cell_spacing_m)
    || cell_spacing_m <= 0.0
    || !all(vec3<bool>(
      ss_exact_near_finite(cell_minimum.x),
      ss_exact_near_finite(cell_minimum.y),
      ss_exact_near_finite(cell_minimum.z)
    ))
    || !all(vec3<bool>(
      ss_exact_near_finite(cell_maximum.x),
      ss_exact_near_finite(cell_maximum.y),
      ss_exact_near_finite(cell_maximum.z)
    ))
  ) { return false; }
  let projection_base = spatial_aggregate_view[94u];
  let projection_bound = spatial_aggregate_view[107u];
  if (
    projection_base > projection_bound
    || member_range.begin > projection_bound - projection_base
  ) { return false; }
  let projection_begin = projection_base + member_range.begin;
  if (active_member_count > projection_bound - projection_begin) {
    return false;
  }
  var active_ordinal = 0u;
  for (
    var member_ordinal = 0u;
    member_ordinal < source_member_count;
    member_ordinal = member_ordinal + 1u
  ) {
    let member = ss_exact_near_source_at_member(
      spatial_expectation,
      member_range.begin + member_ordinal
    );
    if (
      member.admitted == 0u
      || member.source_index >= mechanical_params.particle_count
    ) { return false; }
    let member_mass = current_state[member.source_index * 2u].w;
    let member_volume = source_mechanics[member.source_index * 8u + 4u].w;
    let member_finite = ss_exact_near_finite(member_mass)
      && ss_exact_near_finite(member_volume);
    let member_active = member_finite && member_mass > 0.0 && member_volume > 0.0;
    let member_dormant = member_finite
      && bitcast<u32>(member_mass) == 0u
      && bitcast<u32>(member_volume) == 0u;
    if (!member_active && !member_dormant) { return false; }
    if (member_dormant) { continue; }
    if (active_ordinal >= active_member_count) { return false; }
    let projected_source = spatial_aggregate_view[projection_begin + active_ordinal];
    if (projected_source != member.source_index) { return false; }
    let projected_cell = ss_exact_near_cell_for_source(
      spatial_expectation,
      projected_source
    );
    if (
      projected_cell.admitted == 0u
      || projected_cell.source_index != cell_index
    ) { return false; }
    atomicOr(
      &global_support_bits[
        mechanical_graph_support_row_base(projected_source) + 3u
      ],
      MECHANICAL_SUPPORT_ACTIVE_PROJECTION_MEMBER
    );
    active_ordinal = active_ordinal + 1u;
  }
  return active_ordinal == active_member_count;
}
// ULG_MECHANICAL_AGGREGATE_HELPERS_END

fn mechanical_graph_squared_distance_to_aabb(
  point: vec3<f32>,
  minimum: vec3<f32>,
  maximum: vec3<f32>
) -> f32 {
  let delta = max(max(minimum - point, point - maximum), vec3<f32>(0.0));
  return dot(delta, delta);
}

fn mechanical_graph_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

fn mechanical_graph_source_row_base(index: u32) -> u32 {
  return index * 16u;
}

fn mechanical_graph_epoch_position(index: u32) -> vec3<f32> {
  let base = mechanical_graph_source_row_base(index);
  return vec3<f32>(
    spatial_source_rows[base + 12u],
    spatial_source_rows[base + 13u],
    spatial_source_rows[base + 14u]
  );
}

fn mechanical_graph_support_row_base(index: u32) -> u32 {
  return ${MECHANICAL_SUPPORT_HEADER_WORDS}u
    + index * ${MECHANICAL_SUPPORT_ROW_WORDS}u;
}

struct MechanicalGraphEndpointMetadata {
  index: u32,
  support_base: u32,
  descriptor: u32,
  material_bits: u32,
  domain_id: u32,
};

struct MechanicalGraphSelfCache {
  endpoint: MechanicalGraphEndpointMetadata,
  current_position_m: vec3<f32>,
  epoch_position_m: vec3<f32>,
  diameter_m: f32,
  displacement_m: f32,
  wall_projection_m: f32,
};

struct MechanicalGraphPairPolicy {
  eligible: u32,
  unilateral: u32,
};

fn mechanical_graph_aggregate_preflight_seal_word() -> u32 {
  return ${MECHANICAL_SUPPORT_HEADER_WORDS}u
    + mechanical_params.particle_count * ${MECHANICAL_SUPPORT_ROW_WORDS}u;
}

fn mechanical_graph_cached_epoch_position(index: u32) -> vec3<f32> {
  let base = mechanical_graph_support_row_base(index);
  return vec3<f32>(
    bitcast<f32>(atomicLoad(&global_support_bits[base + 4u])),
    bitcast<f32>(atomicLoad(&global_support_bits[base + 5u])),
    bitcast<f32>(atomicLoad(&global_support_bits[base + 6u]))
  );
}

fn mechanical_graph_source_phase_class(index: u32) -> u32 {
  let row5 = source_mechanics[index * 8u + 5u];
  let row6 = source_mechanics[index * 8u + 6u];
  if (row5.x > 0.5) { return 2u; }
  if (row6.z > 0.5 && row6.z < 1.5) { return 1u; }
  return 0u;
}

fn mechanical_graph_support_descriptor(index: u32) -> u32 {
  return atomicLoad(
    &global_support_bits[mechanical_graph_support_row_base(index) + 3u]
  );
}

fn mechanical_graph_material_bits(index: u32) -> u32 {
  return atomicLoad(
    &global_support_bits[mechanical_graph_support_row_base(index) + 7u]
  );
}

fn mechanical_graph_load_endpoint_metadata(
  index: u32
) -> MechanicalGraphEndpointMetadata {
  let support_base = mechanical_graph_support_row_base(index);
  let descriptor = atomicLoad(&global_support_bits[support_base + 3u]);
  var material_bits = 0u;
  var domain_id = 0u;
  if ((descriptor & 1u) != 0u) {
    material_bits = atomicLoad(&global_support_bits[support_base + 7u]);
  }
  return MechanicalGraphEndpointMetadata(
    index,
    support_base,
    descriptor,
    material_bits,
    domain_id
  );
}

fn mechanical_graph_load_self_endpoint_metadata(
  index: u32
) -> MechanicalGraphEndpointMetadata {
  let endpoint = mechanical_graph_load_endpoint_metadata(index);
  var domain_id = 0u;
  if (
    (endpoint.descriptor & 1u) != 0u
    && (mechanical_params.identity_enabled & 1u) != 0u
  ) {
    domain_id = source_identity[index];
  }
  return MechanicalGraphEndpointMetadata(
    endpoint.index,
    endpoint.support_base,
    endpoint.descriptor,
    endpoint.material_bits,
    domain_id
  );
}

fn mechanical_graph_thermo_phase_class(index: u32) -> u32 {
  let phase_id = source_thermo[index * 3u].y;
  if (!ss_exact_near_finite(phase_id) || phase_id != trunc(phase_id)) {
    return 0xffffffffu;
  }
  if (phase_id == 1.0) { return 2u; }
  if (phase_id == 2.0) { return 1u; }
  if (phase_id == 3.0 || phase_id == 4.0) { return 0u; }
  return 0xffffffffu;
}

fn mechanical_graph_same_phase_lineage(self_index: u32, other_index: u32) -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  return capacity > 0u
    && mechanical_params.phase_lane_count > 1u
    && self_index < capacity * mechanical_params.phase_lane_count
    && other_index < capacity * mechanical_params.phase_lane_count
    && self_index % capacity == other_index % capacity;
}

// A solid/liquid split represents one conserved finite-volume lineage.  While
// one condensed companion is wholly nested inside another at both sweep
// endpoints, the inner cell contributes no exposed union boundary.  Give the
// larger cell deterministic ownership (lower index breaks an f32 size tie) so
// a newly materialized companion cannot double-count external contact.  Once
// either endpoint is exposed, both independently moving components retain
// their ordinary geometry.
fn mechanical_graph_phase_geometry_occlusion(index: u32) -> u32 {
  let capacity = mechanical_params.phase_lineage_capacity;
  let lane_count = mechanical_params.phase_lane_count;
  if (
    capacity == 0u
    || lane_count <= 1u
    || index >= capacity * lane_count
  ) { return 0u; }
  let self_state = current_state[index * 2u];
  let self_volume = source_mechanics[index * 8u + 4u].w;
  let self_class = mechanical_graph_source_phase_class(index);
  if (
    !(self_state.w > 0.0)
    || !(self_volume > 0.0)
    || (self_class != 1u && self_class != 2u)
  ) { return 0u; }
  let self_edge_m = mechanical_graph_cbrt(self_volume);
  let self_epoch_position = mechanical_graph_epoch_position(index);
  if (
    !ss_exact_near_finite(self_state.x)
    || !ss_exact_near_finite(self_state.y)
    || !ss_exact_near_finite(self_state.z)
    || !ss_exact_near_finite(self_edge_m)
    || !ss_exact_near_finite(self_epoch_position.x)
    || !ss_exact_near_finite(self_epoch_position.y)
    || !ss_exact_near_finite(self_epoch_position.z)
  ) { return 0xffffffffu; }
  let lineage = index % capacity;
  for (var lane = 0u; lane < lane_count; lane = lane + 1u) {
    let peer_index = lane * capacity + lineage;
    if (peer_index == index) { continue; }
    let peer_state = current_state[peer_index * 2u];
    let peer_volume = source_mechanics[peer_index * 8u + 4u].w;
    let peer_class = mechanical_graph_source_phase_class(peer_index);
    let peer_active = peer_state.w > 0.0 && peer_volume > 0.0;
    if (
      !peer_active
      || (peer_class != 1u && peer_class != 2u)
    ) { continue; }
    let peer_edge_m = mechanical_graph_cbrt(peer_volume);
    let peer_epoch_position = mechanical_graph_epoch_position(peer_index);
    if (
      !ss_exact_near_finite(peer_state.x)
      || !ss_exact_near_finite(peer_state.y)
      || !ss_exact_near_finite(peer_state.z)
      || !ss_exact_near_finite(peer_edge_m)
      || !ss_exact_near_finite(peer_epoch_position.x)
      || !ss_exact_near_finite(peer_epoch_position.y)
      || !ss_exact_near_finite(peer_epoch_position.z)
    ) { return 0xffffffffu; }
    let geometric_scale_m = max(
      max(self_edge_m, peer_edge_m),
      max(
        max(
          max(abs(self_state.x), abs(self_state.y)),
          abs(self_state.z)
        ),
        max(
          max(
            max(abs(peer_state.x), abs(peer_state.y)),
            abs(peer_state.z)
          ),
          max(
            max(
              max(
                max(abs(self_epoch_position.x), abs(self_epoch_position.y)),
                abs(self_epoch_position.z)
              ),
              max(abs(peer_epoch_position.x), abs(peer_epoch_position.y))
            ),
            abs(peer_epoch_position.z)
          )
        )
      )
    );
    let tolerance_m = 16.0 * 1.1920929e-7
      * max(geometric_scale_m, 1.0e-12);
    let peer_owns_size = peer_edge_m > self_edge_m + tolerance_m
      || (
        abs(peer_edge_m - self_edge_m) <= tolerance_m
        && peer_index < index
      );
    if (!peer_owns_size) { continue; }
    let current_delta = abs(self_state.xyz - peer_state.xyz);
    let epoch_delta = abs(self_epoch_position - peer_epoch_position);
    let containment_limit_m = 0.5 * peer_edge_m
      - 0.5 * self_edge_m + tolerance_m;
    if (
      all(current_delta <= vec3<f32>(containment_limit_m))
      && all(epoch_delta <= vec3<f32>(containment_limit_m))
    ) { return 1u; }
  }
  return 0u;
}

fn mechanical_graph_pair_policy(
  self_endpoint: MechanicalGraphEndpointMetadata,
  other_endpoint: MechanicalGraphEndpointMetadata
) -> MechanicalGraphPairPolicy {
  let rejected = MechanicalGraphPairPolicy(0u, 0u);
  let self_index = self_endpoint.index;
  let other_index = other_endpoint.index;
  if (
    other_index == self_index
    || other_index >= mechanical_params.particle_count
    || (other_endpoint.descriptor & 1u) == 0u
  ) { return rejected; }
  if (mechanical_graph_same_phase_lineage(self_index, other_index)) {
    if (self_endpoint.material_bits != other_endpoint.material_bits) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u
      );
      atomicAdd(&traversal_evidence[19u], 1u);
    }
    return rejected;
  }
  if (
    ((self_endpoint.descriptor | other_endpoint.descriptor)
      & MECHANICAL_SUPPORT_PHASE_GEOMETRY_OCCLUDED) != 0u
  ) { return rejected; }
  let self_class = (self_endpoint.descriptor >> 1u) & 3u;
  let other_class = (other_endpoint.descriptor >> 1u) & 3u;
  if (self_class == 0u || other_class == 0u) { return rejected; }
  let same_material = self_endpoint.material_bits
    == other_endpoint.material_bits;
  let both_solid = self_class == 2u && other_class == 2u;
  let self_domain = self_endpoint.domain_id;
  var other_domain = 0u;
  var solid_domains_differ = false;
  if (
    same_material
    && both_solid
    && (mechanical_params.identity_enabled & 1u) != 0u
  ) {
    // Liquid/liquid and solid/liquid pairs never need peer identity.  Keep the
    // read on the only branch whose ownership law depends on body domains.
    other_domain = source_identity[other_index];
    solid_domains_differ = self_domain != 0u
      && other_domain != 0u
      && self_domain != other_domain;
  }
  let same_body_solid = same_material
    && both_solid
    && (
      (mechanical_params.identity_enabled & 1u) == 0u
      || self_domain == 0u
      || other_domain == 0u
      || self_domain == other_domain
    );
  if (same_body_solid) { return rejected; }
  let solid_liquid_interface = (self_class == 2u && other_class == 1u)
    || (self_class == 1u && other_class == 2u);
  let unilateral = !same_material
    || solid_liquid_interface
    || solid_domains_differ;
  return MechanicalGraphPairPolicy(1u, select(0u, 1u, unilateral));
}

fn mechanical_graph_wall_projection_bound(index: u32) -> f32 {
  let position = current_state[index * 2u].xyz;
  let volume = max(source_mechanics[index * 8u + 4u].w, 0.0);
  var clearance = 0.5 * mechanical_graph_cbrt(volume);
  if (mechanical_params.grid_spacing_m > 0.0) {
    clearance = min(clearance, 0.5 * mechanical_params.grid_spacing_m);
  }
  let min_dimension = min(
    mechanical_params.box_dims_m.x,
    min(mechanical_params.box_dims_m.y, mechanical_params.box_dims_m.z)
  );
  if (min_dimension > 0.0) {
    clearance = min(clearance, 0.49 * min_dimension);
  }
  let lower = vec3<f32>(clearance);
  let upper = max(lower, mechanical_params.box_dims_m - lower);
  return length(clamp(position, lower, upper) - position);
}

fn mechanical_graph_pair_within_symmetric_envelope(
  self_cache: MechanicalGraphSelfCache,
  other_endpoint: MechanicalGraphEndpointMetadata,
  unilateral: bool,
  shares_authenticated_cell: bool
) -> bool {
  let self_index = self_cache.endpoint.index;
  let other_index = other_endpoint.index;
  let other_support_base = other_endpoint.support_base;
  if (
    (self_cache.endpoint.descriptor & 1u) == 0u
    || (other_endpoint.descriptor & 1u) == 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return false;
  }
  let self_diameter = self_cache.diameter_m;
  let other_diameter = bitcast<f32>(
    atomicLoad(&global_support_bits[other_support_base])
  );
  let current_delta_m = self_cache.current_position_m
    - current_state[other_index * 2u].xyz;
  let current_distance_squared_m2 = dot(current_delta_m, current_delta_m);
  let rest_distance_m = 0.5 * (self_diameter + other_diameter);
  // Same-material liquid pairs own only the optional round-zero soft law.
  // Their admission depends solely on current overlap, so reject or admit
  // them before loading epoch positions, swept displacement, and wall
  // projection. The explicit clique diagnostic remains on the fully
  // certified path below because it deliberately widens normal closure.
  if (
    !unilateral
    && !(
      mechanical_params.retain_complete_authenticated_cell_cliques != 0u
      && shares_authenticated_cell
    )
  ) {
    if (
      !ss_exact_near_finite(self_diameter)
      || !ss_exact_near_finite(other_diameter)
      || !ss_exact_near_finite(current_distance_squared_m2)
      || !ss_exact_near_finite(rest_distance_m)
      || rest_distance_m <= 0.0
    ) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return false;
    }
    // Most directory candidates are outside the liquid overlap shell. Reject
    // only a conservatively distant squared shell here; candidates near the
    // boundary still take the original sqrt comparison, preserving its exact
    // admission result while avoiding sqrt for definite misses.
    let rest_distance_squared_m2 = rest_distance_m * rest_distance_m;
    if (
      ss_exact_near_finite(rest_distance_squared_m2)
      && current_distance_squared_m2
        > rest_distance_squared_m2 * 1.000003814697265625
    ) { return false; }
    let current_distance_m = sqrt(max(current_distance_squared_m2, 0.0));
    return current_distance_m < rest_distance_m;
  }
  let self_displacement_m = self_cache.displacement_m;
  let other_displacement_m = bitcast<f32>(
    atomicLoad(&global_support_bits[other_support_base + 1u])
  );
  let self_wall_projection_m = self_cache.wall_projection_m;
  let other_wall_projection_m = bitcast<f32>(
    atomicLoad(&global_support_bits[other_support_base + 2u])
  );
  let self_epoch_position = self_cache.epoch_position_m;
  let other_epoch_position = mechanical_graph_cached_epoch_position(other_index);
  let epoch_distance_m = length(self_epoch_position - other_epoch_position);
  let current_distance_m = sqrt(max(current_distance_squared_m2, 0.0));
  // The retained solver keeps every corrected endpoint inside an authenticated
  // epoch ball: sixteen own diameters, twice its post-G2P displacement, and its
  // initial wall projection. The displacement term permits swept-cohort
  // rollback after a deep crossing without restoring a per-round shell.
  // Orthogonal box projection is non-expansive, so only the initial distance
  // to the box must be added. This is a certificate, not a heuristic radius.
  let pair_radius_m = rest_distance_m
    + 2.0 * (self_displacement_m + other_displacement_m)
    + ${SCHROEDER_SPATIAL_MECHANICAL_POSITION_TRUST_DIAMETERS}.0
      * (self_diameter + other_diameter)
    + self_wall_projection_m
    + other_wall_projection_m;
  if (
    !ss_exact_near_finite(self_displacement_m)
    || !ss_exact_near_finite(other_displacement_m)
    || !ss_exact_near_finite(self_wall_projection_m)
    || !ss_exact_near_finite(other_wall_projection_m)
    || !ss_exact_near_finite(epoch_distance_m)
    || !ss_exact_near_finite(current_distance_m)
    || !ss_exact_near_finite(pair_radius_m)
    || pair_radius_m <= 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return false;
  }
  // The explicit diagnostic mode retains a complete authenticated-cell clique
  // to stress deterministic dense graph capacity without widening production
  // closure. Normal simulation uses only the certified geometric envelope.
  if (
    mechanical_params.retain_complete_authenticated_cell_cliques != 0u
    && shares_authenticated_cell
  ) { return true; }
  // The epoch-ball predicate is the complete certificate. Unlike cumulative
  // path-length accounting, it permits later Jacobi rounds to recover trust
  // by moving back toward the epoch without making an unretained pair
  // reachable.
  return epoch_distance_m <= pair_radius_m;
}

fn mechanical_graph_allocate_append_slot() -> u32 {
  // Atomic add gives every admitted pair one contention-independent ticket.
  // Once the retained arena is full, clamp the diagnostic counter to the
  // first rejected ticket. The exact scanned source counts remain the
  // required-total authority and the sticky capacity bit seals publication.
  let capacity = mechanical_params.directed_pair_capacity;
  let append_slot = atomicAdd(&graph_control[11u], 1u);
  if (append_slot < capacity) { return append_slot; }
  atomicMin(&graph_control[11u], capacity + 1u);
  atomicOr(
    &graph_control[14u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.GRAPH_CAPACITY}u
  );
  return 0xffffffffu;
}

fn mechanical_graph_evidence_saturating_add(word: u32, value: u32) -> bool {
  if (value == 0u) { return true; }
  // A valid retained hierarchy has at most (2N - 1) records and each source
  // visits each record/member at most once.  For N <= 46,340 every aggregate
  // evidence total is therefore bounded by N * 2N <= UINT32_MAX.  The direct
  // atomic add is exact in that range and avoids serializing every active
  // source through a globally contended compare/exchange loop.  Retain the
  // saturating path for larger source families, where the proof no longer fits
  // in u32.  An unexpected wrap in the proven range is still made terminal so
  // corrupted input cannot publish a graph.
  if (mechanical_params.particle_count <= 46340u) {
    let prior = atomicAdd(&traversal_evidence[word], value);
    if (prior <= 0xffffffffu - value) { return true; }
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
    );
    return false;
  }
  var attempt = 0u;
  loop {
    let prior = atomicLoad(&traversal_evidence[word]);
    if (prior > 0xffffffffu - value) {
      atomicStore(&traversal_evidence[word], 0xffffffffu);
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
      );
      return false;
    }
    let claimed = atomicCompareExchangeWeak(
      &traversal_evidence[word],
      prior,
      prior + value
    );
    if (claimed.exchanged) { return true; }
    attempt = attempt + 1u;
    if (attempt >= 256u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
      );
      return false;
    }
  }
}

@compute @workgroup_size(64)
fn reduce_support(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let source_rank = global_id.x;
  if (source_rank >= mechanical_params.particle_count) { return; }
  var particle_index = source_rank;
  if (
    MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled
      == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
  ) {
    let rank_lookup = mechanical_active_rank_source_at_rank(source_rank);
    if (rank_lookup.admitted == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.DIRECTORY_REJECT}u
      );
      return;
    }
    particle_index = rank_lookup.source_index;
  }
  // ULG_MECHANICAL_AGGREGATE_PREFLIGHT_BEGIN
  if (
    MECHANICAL_AGGREGATE_HIERARCHY_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled != 0u
  ) {
    let total_record_count = spatial_aggregate_view[54u];
    let seal_word = mechanical_graph_aggregate_preflight_seal_word();
    var record_index = particle_index;
    for (var record_batch = 0u; record_batch < 2u; record_batch = record_batch + 1u) {
      if (record_index < total_record_count) {
        if (mechanical_aggregate_record_preflight(record_index)) {
          atomicAdd(&global_support_bits[seal_word], 1u);
        } else {
          atomicOr(
            &global_support_bits[seal_word],
            MECHANICAL_AGGREGATE_PREFLIGHT_FAILED
          );
          atomicOr(
            &graph_control[14u],
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MALFORMED_TRAVERSAL}u
          );
        }
      }
      if (
        record_index
          > 0xffffffffu - mechanical_params.particle_count
      ) { break; }
      record_index = record_index + mechanical_params.particle_count;
    }
  }
  // ULG_MECHANICAL_AGGREGATE_PREFLIGHT_END
  atomicAdd(
    &traversal_evidence[
      ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.aggregateSummaryPreflightCount}u
    ],
    1u
  );
  let raw_volume = source_mechanics[particle_index * 8u + 4u].w;
  let mass = current_state[particle_index * 2u].w;
  let mechanics_finite = ss_exact_near_finite(raw_volume)
    && ss_exact_near_finite(mass);
  let mechanically_active = mechanics_finite
    && raw_volume > 0.0
    && mass > 0.0;
  let mechanically_dormant = mechanics_finite
    && bitcast<u32>(raw_volume) == 0u
    && bitcast<u32>(mass) == 0u;
  if (!mechanically_active && !mechanically_dormant) {
    atomicOr(&global_support_bits[3u], 0x80000000u);
    atomicOr(
      &graph_control[14u],
      select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        !mechanics_finite
      )
    );
  }
  if (
    MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled
      == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
    && !mechanical_active_rank_membership_matches(
      source_rank,
      particle_index,
      mechanically_active
    )
  ) {
    atomicOr(&global_support_bits[3u], 0x80000000u);
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MALFORMED_TRAVERSAL}u
    );
  }
  let material_id = source_thermo[particle_index * 3u].x;
  let material_valid = !mechanically_active || (
    ss_exact_near_finite(material_id)
      && material_id == trunc(material_id)
      && material_id >= 0.0
      && material_id <= 16777215.0
  );
  if (!material_valid) {
    atomicOr(&global_support_bits[3u], 0x80000000u);
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u
    );
  }
  let phase_summary_matches = !mechanically_active
    || mechanical_graph_thermo_phase_class(particle_index)
      == mechanical_graph_source_phase_class(particle_index);
  if (!phase_summary_matches) {
    // The high bit seals summary admission while the low bits count completed
    // preflight invocations. Materialization runs in a later dispatch, so it
    // can require both complete coverage and no mismatch without a grid-wide
    // barrier inside this pass.
    atomicOr(&global_support_bits[3u], 0x80000000u);
    atomicAdd(
      &traversal_evidence[
        ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.aggregateSummaryPhaseMismatchCount}u
      ],
      1u
    );
  }
  // A source-local liquid overlap is the only production pair law that needs
  // no swept, wall, material-interface, or body-domain envelope.  Certify
  // that special *population shape* here, in the support pass that already
  // authenticates every active endpoint.  This is deliberately a generic
  // phase/material proof rather than a material-name shortcut: any active
  // gas, solid, mismatched phase summary, invalid material, or second
  // material makes the later traversal retain its broad mixed-law envelope.
  if (mechanically_active) {
    let source_phase_class = mechanical_graph_source_phase_class(particle_index);
    if (
      !material_valid
      || !phase_summary_matches
      || source_phase_class != 1u
    ) {
      atomicOr(
        &global_support_bits[
          ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD}u
        ],
        ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTED}u
      );
    } else {
      let material_bits = bitcast<u32>(material_id);
      var certified_material = atomicLoad(
        &global_support_bits[
          ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD}u
        ]
      );
      loop {
        if (certified_material == material_bits) { break; }
        if (
          certified_material
            != ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET}u
        ) {
          atomicOr(
            &global_support_bits[
              ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD}u
            ],
            ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTED}u
          );
          break;
        }
        // Weak compare-exchange may fail spuriously.  Retrying while the
        // header remains unset prevents a same-material race from needlessly
        // disabling this optional optimization; observing a different value
        // is a real mixed-material certificate failure.
        let claim = atomicCompareExchangeWeak(
          &global_support_bits[
            ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD}u
          ],
          ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET}u,
          material_bits
        );
        if (claim.exchanged) { break; }
        certified_material = claim.old_value;
      }
    }
  }
  var lineage_material_matches = true;
  let lineage_capacity = mechanical_params.phase_lineage_capacity;
  let phase_lane_count = mechanical_params.phase_lane_count;
  if (
    mechanically_active
    && lineage_capacity > 0u
    && phase_lane_count > 1u
  ) {
    let lineage_index = particle_index % lineage_capacity;
    lineage_material_matches = material_valid;
    for (
      var phase_lane = 0u;
      phase_lane < phase_lane_count && lineage_material_matches;
      phase_lane = phase_lane + 1u
    ) {
      let peer_index = phase_lane * lineage_capacity + lineage_index;
      if (peer_index >= mechanical_params.particle_count) {
        lineage_material_matches = false;
        continue;
      }
      let peer_mass = current_state[peer_index * 2u].w;
      let peer_volume = source_mechanics[peer_index * 8u + 4u].w;
      let peer_finite = ss_exact_near_finite(peer_mass)
        && ss_exact_near_finite(peer_volume);
      let peer_active = peer_finite && peer_mass > 0.0 && peer_volume > 0.0;
      let peer_dormant = peer_finite
        && bitcast<u32>(peer_mass) == 0u
        && bitcast<u32>(peer_volume) == 0u;
      if (!peer_active && !peer_dormant) {
        lineage_material_matches = false;
        continue;
      }
      if (peer_active) {
        let peer_material = source_thermo[peer_index * 3u].x;
        if (
          !ss_exact_near_finite(peer_material)
          || peer_material != trunc(peer_material)
          || abs(peer_material - material_id) >= 0.5
        ) {
          lineage_material_matches = false;
        }
      }
    }
  }
  if (!lineage_material_matches) {
    atomicOr(&global_support_bits[3u], 0x80000000u);
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u
    );
    atomicAdd(
      &traversal_evidence[
        ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.aggregateSummaryLineageMaterialMismatchCount}u
      ],
      1u
    );
  }
  var phase_geometry_occlusion = 0u;
  if (mechanically_active && lineage_material_matches) {
    phase_geometry_occlusion =
      mechanical_graph_phase_geometry_occlusion(particle_index);
  }
  if (phase_geometry_occlusion == 0xffffffffu) {
    atomicOr(&global_support_bits[3u], 0x80000000u);
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
  }
  atomicAdd(&global_support_bits[3u], 1u);
  let volume = max(raw_volume, 0.0);
  if (mechanically_active) {
    let support_base = mechanical_graph_support_row_base(particle_index);
    let diameter_m = mechanical_graph_cbrt(volume);
    let epoch_position = mechanical_graph_epoch_position(particle_index);
    let displacement_m = length(
      current_state[particle_index * 2u].xyz - epoch_position
    );
    let wall_projection_m = mechanical_graph_wall_projection_bound(particle_index);
    let support_payload_finite = ss_exact_near_finite(diameter_m)
      && ss_exact_near_finite(displacement_m)
      && ss_exact_near_finite(wall_projection_m)
      && all(vec3<bool>(
        ss_exact_near_finite(epoch_position.x),
        ss_exact_near_finite(epoch_position.y),
        ss_exact_near_finite(epoch_position.z)
      ));
    if (!support_payload_finite) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
    } else if (material_valid) {
      atomicStore(&global_support_bits[support_base], bitcast<u32>(diameter_m));
      atomicStore(
        &global_support_bits[support_base + 1u],
        bitcast<u32>(max(displacement_m, 0.0))
      );
      atomicStore(
        &global_support_bits[support_base + 2u],
        bitcast<u32>(max(wall_projection_m, 0.0))
      );
      atomicStore(
        &global_support_bits[support_base + 4u],
        bitcast<u32>(epoch_position.x)
      );
      atomicStore(
        &global_support_bits[support_base + 5u],
        bitcast<u32>(epoch_position.y)
      );
      atomicStore(
        &global_support_bits[support_base + 6u],
        bitcast<u32>(epoch_position.z)
      );
      atomicStore(
        &global_support_bits[support_base + 7u],
        bitcast<u32>(material_id)
      );
      atomicOr(
        &global_support_bits[support_base + 3u],
        1u
          | (mechanical_graph_source_phase_class(particle_index) << 1u)
          | select(
            0u,
            MECHANICAL_SUPPORT_PHASE_GEOMETRY_OCCLUDED,
            phase_geometry_occlusion == 1u
          )
      );
      if (
        MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
        && mechanical_params.aggregate_hierarchy_enabled
          == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
      ) {
        atomicOr(
          &global_support_bits[support_base + 3u],
          MECHANICAL_SUPPORT_ACTIVE_PROJECTION_MEMBER
        );
      }
    }
    // Words 0 and 1 size only the pair query radius. A class-0 endpoint
    // (gas, or any non-liquid non-solid carrier) is rejected from every pair
    // by both the graph and the solver, so its diameter and swept
    // displacement can never reach an admitted pair. Letting them in turned
    // a single steam carrier (rest volume ~1,600x its liquid) into a
    // whole-scene query for every source. Word 2 (wall projection) still
    // covers every active row: it also gates the zero-edge solver path.
    let pair_endpoint_class =
      mechanical_graph_source_phase_class(particle_index) != 0u;
    if (pair_endpoint_class) {
      atomicMax(
        &global_support_bits[0u],
        bitcast<u32>(diameter_m)
      );
    }
    if (ss_exact_near_finite(displacement_m)) {
      if (pair_endpoint_class) {
        atomicMax(
          &global_support_bits[1u],
          bitcast<u32>(max(displacement_m, 0.0))
        );
      }
    } else {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
    }
    if (ss_exact_near_finite(wall_projection_m)) {
      atomicMax(
        &global_support_bits[2u],
        bitcast<u32>(max(wall_projection_m, 0.0))
      );
    } else {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
    }
  } else if (mechanically_dormant) {
    // Dormant phase-carrier rows never own graph edges, but Jacobi still
    // carries their epoch-ball trust through the same sealed row counts as
    // active particles.  Preserve the exact raw-source geometry they used
    // before the phase-local cache alias; descriptor bit 0 intentionally
    // remains clear so a dormant row can never authorize a contact pair.
    let support_base = mechanical_graph_support_row_base(particle_index);
    let diameter_m = mechanical_graph_cbrt(volume);
    let epoch_position = mechanical_graph_epoch_position(particle_index);
    if (
      !ss_exact_near_finite(diameter_m)
      || !all(vec3<bool>(
        ss_exact_near_finite(epoch_position.x),
        ss_exact_near_finite(epoch_position.y),
        ss_exact_near_finite(epoch_position.z)
      ))
    ) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
    } else {
      atomicStore(&global_support_bits[support_base], bitcast<u32>(diameter_m));
      atomicStore(
        &global_support_bits[support_base + 4u],
        bitcast<u32>(epoch_position.x)
      );
      atomicStore(
        &global_support_bits[support_base + 5u],
        bitcast<u32>(epoch_position.y)
      );
      atomicStore(
        &global_support_bits[support_base + 6u],
        bitcast<u32>(epoch_position.z)
      );
    }
  }
  if (source_rank == 0u) {
    if (
      spatial_expectation.support_profile_id
        != mechanical_params.contact_support_profile_id
      || !ss_exact_near_directory_admitted(spatial_expectation)
      || !mechanical_aggregate_view_admitted()
    ) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.DIRECTORY_REJECT}u
      );
      atomicAdd(&traversal_evidence[19u], 1u);
    }
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}u
    );
  }
}

fn mechanical_graph_materialize_cell(
  self_cache: MechanicalGraphSelfCache,
  cell_index: u32,
  self_cell_index: u32,
  active_member_count: u32,
  use_active_projection: bool,
  local_rank: ptr<function, u32>,
  candidate_count: ptr<function, u32>,
  projected_peer_visit_count: ptr<function, u32>,
  staged_count: ptr<function, u32>,
  overflow_count: ptr<function, u32>,
  malformed: ptr<function, bool>
) {
  let self_index = self_cache.endpoint.index;
  let member_range = ss_exact_near_cell_member_range(
    spatial_expectation,
    cell_index
  );
  if (member_range.admitted == 0u) {
    *malformed = true;
    return;
  }
  let source_member_count = member_range.end - member_range.begin;
  var resolved_active_member_count = active_member_count;
  var active_ordinal_begin = 0u;
  var resolved_use_active_projection = use_active_projection;
  if (
    MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled
      == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
  ) {
    let active_range = mechanical_active_rank_cell_range(
      member_range.begin,
      member_range.end
    );
    if (active_range.admitted == 0u) {
      *malformed = true;
      return;
    }
    active_ordinal_begin = active_range.begin;
    resolved_active_member_count = active_range.end - active_range.begin;
    resolved_use_active_projection = true;
  }
  if (
    resolved_use_active_projection
    && resolved_active_member_count > source_member_count
  ) {
    *malformed = true;
    return;
  }
  let skipped_dormant_count = select(
    0u,
    source_member_count - resolved_active_member_count,
    resolved_use_active_projection
  );
  if (*candidate_count > 0xffffffffu - skipped_dormant_count) {
    *malformed = true;
    return;
  }
  *candidate_count = *candidate_count + skipped_dormant_count;
  let visited_member_count = select(
    source_member_count,
    resolved_active_member_count,
    resolved_use_active_projection
  );
  for (
    var member_ordinal = 0u;
    member_ordinal < visited_member_count;
    member_ordinal = member_ordinal + 1u
  ) {
    var other_index = MECHANICAL_AGGREGATE_INVALID_U32;
    if (
      MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
      && mechanical_params.aggregate_hierarchy_enabled
        == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
    ) {
      let active_lookup = mechanical_active_rank_source_at_ordinal(
        active_ordinal_begin + member_ordinal
      );
      if (
        active_lookup.admitted == 0u
        || active_lookup.source_rank < member_range.begin
        || active_lookup.source_rank >= member_range.end
      ) {
        *malformed = true;
        return;
      }
      other_index = active_lookup.source_index;
    } else if (use_active_projection) {
      let projection_word = spatial_aggregate_view[94u]
        + member_range.begin + member_ordinal;
      if (projection_word >= spatial_aggregate_view[107u]) {
        *malformed = true;
        return;
      }
      other_index = spatial_aggregate_view[projection_word];
    } else {
      let lookup = ss_exact_near_source_at_member(
        spatial_expectation,
        member_range.begin + member_ordinal
      );
      if (lookup.admitted == 0u) {
        *malformed = true;
        return;
      }
      other_index = lookup.source_index;
    }
    if (
      other_index >= mechanical_params.particle_count
      || *candidate_count == 0xffffffffu
    ) {
      *malformed = true;
      return;
    }
    *candidate_count = *candidate_count + 1u;
    // Candidate accounting includes dormant aggregate members without a load.
    // Count only the peer rows that actually reach metadata/pair evaluation so
    // a performance audit can distinguish projection savings from the raw
    // broad-phase envelope without changing any graph semantics.
    if (*projected_peer_visit_count == 0xffffffffu) {
      *malformed = true;
      return;
    }
    *projected_peer_visit_count = *projected_peer_visit_count + 1u;
    let other_endpoint = mechanical_graph_load_endpoint_metadata(other_index);
    let pair_policy = mechanical_graph_pair_policy(
      self_cache.endpoint,
      other_endpoint
    );
    if (pair_policy.eligible == 0u) {
      continue;
    }
    if (!mechanical_graph_pair_within_symmetric_envelope(
      self_cache,
      other_endpoint,
      pair_policy.unilateral != 0u,
      cell_index == self_cell_index
    )) {
      continue;
    }
    if (*local_rank == 0xffffffffu) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
      );
      *malformed = true;
      return;
    }
    let pair_rank = *local_rank;
    *local_rank = *local_rank + 1u;
    let append_slot = mechanical_graph_allocate_append_slot();
    if (append_slot < mechanical_params.directed_pair_capacity) {
      let append_base = append_slot * 3u;
      append_records[append_base] = self_index;
      append_records[append_base + 1u] = other_index;
      append_records[append_base + 2u] = pair_rank;
      *staged_count = *staged_count + 1u;
    } else {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.GRAPH_CAPACITY}u
      );
      *overflow_count = *overflow_count + 1u;
    }
  }
}

@compute @workgroup_size(64)
fn materialize_contact_graph(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let dispatch_ordinal = global_id.x;
  let active_rank_dispatch = MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled
      == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK;
  if (active_rank_dispatch) {
    // The retained view dispatches ceil(activeCount / 64) workgroups.  Lanes
    // beyond that dense list are intentionally inert; treating them as a
    // rejected ordinal makes every non-multiple-of-64 active set fail closed.
    // An admitted empty view still dispatches one group so lane zero can seal
    // the traversal stage as a valid no-op graph.
    let active_count = spatial_aggregate_view[26u];
    if (dispatch_ordinal >= active_count) {
      if (dispatch_ordinal == 0u) {
        atomicAdd(&traversal_evidence[23u], 1u);
        atomicOr(
          &graph_control[15u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}u
        );
      }
      return;
    }
  } else if (dispatch_ordinal >= mechanical_params.particle_count) {
    return;
  }
  // ULG_MECHANICAL_AGGREGATE_SEAL_BEGIN
  if (
    MECHANICAL_AGGREGATE_HIERARCHY_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled != 0u
  ) {
    let cell_count = spatial_directory[18u];
    let preflight_seal = atomicLoad(
      &global_support_bits[mechanical_graph_aggregate_preflight_seal_word()]
    );
    if (
      cell_count == 0u
      || cell_count > 0x03ffffffu
      || preflight_seal != cell_count * 2u - 1u
    ) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MALFORMED_TRAVERSAL}u
      );
      return;
    }
  }
  // ULG_MECHANICAL_AGGREGATE_SEAL_END
  // Directory membership is a permutation of the complete source family.
  // Dispatching adjacent lanes in canonical spatial order keeps their tree
  // walks and member reads coherent without changing source-local CSR rank or
  // graph semantics.
  var source_rank = dispatch_ordinal;
  var self_index = MECHANICAL_AGGREGATE_INVALID_U32;
  var source_admitted = false;
  if (
    MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled
      == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
  ) {
    let active_lookup = mechanical_active_rank_source_at_ordinal(
      dispatch_ordinal
    );
    source_rank = active_lookup.source_rank;
    self_index = active_lookup.source_index;
    source_admitted = active_lookup.admitted != 0u;
  } else {
    let source_lookup = ss_exact_near_source_at_member(
      spatial_expectation,
      source_rank
    );
    self_index = source_lookup.source_index;
    source_admitted = source_lookup.admitted != 0u;
  }
  if (!source_admitted || self_index >= mechanical_params.particle_count) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.DIRECTORY_REJECT}u
    );
    return;
  }
  if (dispatch_ordinal == 0u) {
    atomicAdd(&traversal_evidence[23u], 1u);
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}u
    );
  }
  if (
    atomicLoad(&graph_control[14u]) != 0u
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}u
    ) == 0u
  ) {
    source_counts[self_index] = 0u;
    return;
  }
  let self_pos_mass = current_state[self_index * 2u];
  let self_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  if (self_pos_mass.w <= 0.0 || self_volume <= 0.0) {
    source_counts[self_index] = 0u;
    return;
  }
  let self_endpoint = mechanical_graph_load_self_endpoint_metadata(self_index);
  let self_support_descriptor = self_endpoint.descriptor;
  if (
    mechanical_params.aggregate_hierarchy_enabled != 0u
    && (
      self_support_descriptor & (
        1u | MECHANICAL_SUPPORT_ACTIVE_PROJECTION_MEMBER
      )
    ) != (1u | MECHANICAL_SUPPORT_ACTIVE_PROJECTION_MEMBER)
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MALFORMED_TRAVERSAL}u
    );
    source_counts[self_index] = 0u;
    return;
  }
  let self_phase_class = (self_support_descriptor >> 1u) & 3u;
  if (self_phase_class == 0u) {
    source_counts[self_index] = 0u;
    return;
  }
  let self_source_cell = ss_exact_near_cell_for_source(
    spatial_expectation,
    self_index
  );
  if (self_source_cell.admitted == 0u) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.DIRECTORY_REJECT}u
    );
    source_counts[self_index] = 0u;
    return;
  }
  if (
    mechanical_params.apply_selected_level != -2147483648
    && ss_exact_near_cell_key_word(
      spatial_expectation,
      self_source_cell.source_index,
      1u
    ) != ss_exact_near_signed_order_key(
      mechanical_params.apply_selected_level
    )
  ) {
    source_counts[self_index] = 0u;
    return;
  }
  let global_max_diameter = bitcast<f32>(
    atomicLoad(&global_support_bits[0u])
  );
  let global_max_displacement_m = bitcast<f32>(
    atomicLoad(&global_support_bits[1u])
  );
  let global_max_wall_projection_m = bitcast<f32>(
    atomicLoad(&global_support_bits[2u])
  );
  let self_epoch_position = mechanical_graph_cached_epoch_position(self_index);
  let self_diameter_m = bitcast<f32>(
    atomicLoad(&global_support_bits[self_endpoint.support_base])
  );
  let self_displacement_m = bitcast<f32>(
    atomicLoad(&global_support_bits[self_endpoint.support_base + 1u])
  );
  let self_wall_projection_m = bitcast<f32>(
    atomicLoad(&global_support_bits[self_endpoint.support_base + 2u])
  );
  let self_cache = MechanicalGraphSelfCache(
    self_endpoint,
    self_pos_mass.xyz,
    self_epoch_position,
    self_diameter_m,
    self_displacement_m,
    self_wall_projection_m
  );
  let support_reduction_summary = atomicLoad(&global_support_bits[
    ${MECHANICAL_SUPPORT_AGGREGATE_PREFLIGHT_WORD}u
  ]);
  let support_reduction_complete =
    (support_reduction_summary & 0x80000000u) == 0u
    && (support_reduction_summary & 0x7fffffffu)
      == mechanical_params.particle_count;
  let homogeneous_liquid_material_bits = atomicLoad(&global_support_bits[
    ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD}u
  ]);
  let homogeneous_liquid_certificate =
    mechanical_params.retain_complete_authenticated_cell_cliques == 0u
    && self_phase_class == 1u
    && support_reduction_complete
    && homogeneous_liquid_material_bits
      != ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET}u
    && homogeneous_liquid_material_bits == self_endpoint.material_bits
    && atomicLoad(&global_support_bits[
      ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD}u
    ]) == 0u;
  // Mixed-phase/material populations retain the generation-wide conservative
  // cube.  It covers unilateral swept rollback, wall projection, and body
  // interfaces, then the pair predicate removes its excess shell.
  let mixed_law_query_radius_m = ${
    1 + 2 * SCHROEDER_SPATIAL_MECHANICAL_POSITION_TRUST_DIAMETERS
  }.0 * max(global_max_diameter, 0.0)
    + 4.0 * max(global_max_displacement_m, 0.0)
    + 2.0 * max(global_max_wall_projection_m, 0.0);
  // Once every active source is certified as one liquid material, eligible
  // pairs use only the exact current-overlap predicate.  An epoch-directory
  // source at B can therefore overlap source A only inside A's own swept
  // displacement plus B's generation maximum swept displacement and the two
  // half-diameters.  The expression is reciprocal, so it preserves both
  // directed edges without paying the broad mixed-law traversal radius.
  let homogeneous_liquid_query_radius_m = 0.5 * (
    max(self_diameter_m, 0.0) + max(global_max_diameter, 0.0)
  )
    + max(self_displacement_m, 0.0)
    + max(global_max_displacement_m, 0.0);
  let query_radius_m = select(
    mixed_law_query_radius_m,
    homogeneous_liquid_query_radius_m,
    homogeneous_liquid_certificate
  );
  if (
    !ss_exact_near_finite(query_radius_m)
    || !ss_exact_near_finite(global_max_wall_projection_m)
    || query_radius_m <= 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    source_counts[self_index] = 0u;
    return;
  }

  var local_rank = 0u;
  var candidate_count = 0u;
  var projected_peer_visit_count = 0u;
  var staged_count = 0u;
  var overflow_count = 0u;
  var aggregate_node_visit_count = 0u;
  var aggregate_pruned_node_count = 0u;
  var malformed = false;
  // ULG_MECHANICAL_AGGREGATE_BRANCH_BEGIN
  if (
    MECHANICAL_AGGREGATE_HIERARCHY_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled != 0u
  ) {
    let total_record_count = spatial_aggregate_view[54u];
    let leaf_count = spatial_aggregate_view[23u];
    let root_record_index = spatial_aggregate_view[53u];
    let hierarchy_padding_m = max(
      query_radius_m * 0.000001,
      spatial_expectation.base_grid_spacing_m * 0.000001
    );
    let hierarchy_radius_m = query_radius_m + hierarchy_padding_m;
    let hierarchy_radius_squared = hierarchy_radius_m * hierarchy_radius_m;
    // For a same-material liquid pair, the exact overlap predicate is bounded
    // by half the two diameters plus the swept displacement of each endpoint.
    // Combining this source's certified support with the generation maxima is
    // reciprocal and strictly tighter than charging both endpoints the maxima.
    let liquid_radius_m = 0.5 * (
      max(self_diameter_m, 0.0) + max(global_max_diameter, 0.0)
    )
      + max(self_displacement_m, 0.0)
      + max(global_max_displacement_m, 0.0)
      + hierarchy_padding_m;
    let liquid_radius_squared = liquid_radius_m * liquid_radius_m;
    let summary_preflight = atomicLoad(&global_support_bits[3u]);
    let summary_pruning_admitted =
      (summary_preflight & 0x80000000u) == 0u
      && (summary_preflight & 0x7fffffffu)
        == mechanical_params.particle_count;
    let self_material_id = u32(round(bitcast<f32>(self_endpoint.material_bits)));
    let self_domain_id = self_endpoint.domain_id;
    var record_index = root_record_index;
    var visited_record_count = 0u;
    if (
      !ss_exact_near_finite(hierarchy_radius_squared)
      || hierarchy_radius_squared <= 0.0
      || !ss_exact_near_finite(liquid_radius_squared)
      || liquid_radius_squared <= 0.0
    ) {
      malformed = true;
    }
    loop {
      if (malformed || record_index == MECHANICAL_AGGREGATE_INVALID_U32) {
        break;
      }
      if (
        visited_record_count >= total_record_count
        || record_index >= total_record_count
      ) {
        malformed = true;
        break;
      }
      visited_record_count = visited_record_count + 1u;
      aggregate_node_visit_count = aggregate_node_visit_count + 1u;
      let record_base = mechanical_aggregate_record_base(record_index);
      let record_status = spatial_aggregate_view[record_base + 27u];
      let is_leaf = (
        record_status & MECHANICAL_AGGREGATE_RECORD_LEAF
      ) != 0u;
      let escape_record_index = spatial_aggregate_view[record_base + 37u];
      let record_particle_count = spatial_aggregate_view[record_base + 19u];
      if (record_particle_count == 0u) {
        aggregate_pruned_node_count = aggregate_pruned_node_count + 1u;
        record_index = escape_record_index;
        continue;
      }
      let record_phase_mask = spatial_aggregate_view[record_base + 24u];
      let homogeneous_material_id = spatial_aggregate_view[record_base + 25u];
      let homogeneous_phase_id = spatial_aggregate_view[record_base + 26u];
      let homogeneous_domain_id = spatial_aggregate_view[record_base + 42u];
      let domain_summary_exact = (
        record_status & MECHANICAL_AGGREGATE_RECORD_DOMAIN_SUMMARY_EXACT
      ) != 0u;
      if (
        summary_pruning_admitted
        && domain_summary_exact
        && (record_phase_mask & 0x00000006u) == 0u
      ) {
        aggregate_pruned_node_count = aggregate_pruned_node_count + 1u;
        record_index = escape_record_index;
        continue;
      }
      let same_body_solid_subtree = summary_pruning_admitted
        && domain_summary_exact
        && self_phase_class == 2u
        && homogeneous_material_id == self_material_id
        && homogeneous_phase_id == 1u
        && (
          (mechanical_params.identity_enabled & 1u) == 0u
          || self_domain_id == 0u
          || homogeneous_domain_id == 0u
          || (
            homogeneous_domain_id != MECHANICAL_AGGREGATE_INVALID_U32
            && homogeneous_domain_id == self_domain_id
          )
        );
      if (same_body_solid_subtree) {
        aggregate_pruned_node_count = aggregate_pruned_node_count + 1u;
        record_index = escape_record_index;
        continue;
      }
      let same_material_liquid_subtree = summary_pruning_admitted
        && domain_summary_exact
        && self_phase_class == 1u
        && homogeneous_material_id == self_material_id
        && homogeneous_phase_id == 2u;
      // Empty, irrelevant-phase, and same-body solid records need no geometry.
      // Delay the six AABB loads until metadata pruning has failed.
      let minimum = vec3<f32>(
        bitcast<f32>(spatial_aggregate_view[record_base + 12u]),
        bitcast<f32>(spatial_aggregate_view[record_base + 13u]),
        bitcast<f32>(spatial_aggregate_view[record_base + 14u])
      );
      let maximum = vec3<f32>(
        bitcast<f32>(spatial_aggregate_view[record_base + 15u]),
        bitcast<f32>(spatial_aggregate_view[record_base + 16u]),
        bitcast<f32>(spatial_aggregate_view[record_base + 17u])
      );
      let record_radius_squared = select(
        hierarchy_radius_squared,
        liquid_radius_squared,
        same_material_liquid_subtree
      );
      let aggregate_intersects = mechanical_aggregate_squared_distance_to_aabb(
        self_epoch_position,
        minimum,
        maximum
      ) <= record_radius_squared;
      if (!aggregate_intersects) {
        aggregate_pruned_node_count = aggregate_pruned_node_count + 1u;
        record_index = escape_record_index;
        continue;
      }
      if (is_leaf) {
        let cell_index = spatial_aggregate_view[record_base + 35u];
        if (cell_index != record_index || cell_index >= leaf_count) {
          malformed = true;
          break;
        }
        let cell_level_order = ss_exact_near_cell_key_word(
          spatial_expectation,
          cell_index,
          1u
        );
        let cell_level = bitcast<i32>(cell_level_order ^ 0x80000000u);
        let cell_spacing_m = spatial_expectation.base_grid_spacing_m
          * exp2(f32(cell_level));
        let cell_coordinates = vec3<f32>(
          f32(bitcast<i32>(ss_exact_near_cell_key_word(
            spatial_expectation,
            cell_index,
            2u
          ) ^ 0x80000000u)),
          f32(bitcast<i32>(ss_exact_near_cell_key_word(
            spatial_expectation,
            cell_index,
            3u
          ) ^ 0x80000000u)),
          f32(bitcast<i32>(ss_exact_near_cell_key_word(
            spatial_expectation,
            cell_index,
            4u
          ) ^ 0x80000000u))
        );
        let cell_minimum = cell_coordinates * cell_spacing_m;
        let cell_maximum = (cell_coordinates + vec3<f32>(1.0))
          * cell_spacing_m;
        let selected_level = mechanical_params.apply_selected_level
          == -2147483648
          || cell_level == mechanical_params.apply_selected_level;
        let cell_intersects = mechanical_aggregate_squared_distance_to_aabb(
          self_epoch_position,
          cell_minimum,
          cell_maximum
        ) <= record_radius_squared;
        if (selected_level && cell_intersects) {
          mechanical_graph_materialize_cell(
            self_cache,
            cell_index,
            self_source_cell.source_index,
            record_particle_count,
            true,
            &local_rank,
            &candidate_count,
            &projected_peer_visit_count,
            &staged_count,
            &overflow_count,
            &malformed
          );
        }
        record_index = escape_record_index;
        continue;
      }
      let left_child = spatial_aggregate_view[record_base + 33u];
      record_index = left_child;
    }
  } else {
  // ULG_MECHANICAL_FLAT_BODY_BEGIN
  let directory_padding_m = max(
    query_radius_m * 0.000001,
    spatial_expectation.base_grid_spacing_m * 0.000001
  );
  let directory_radius_m = query_radius_m + directory_padding_m;
  let directory_radius_squared = directory_radius_m * directory_radius_m;
  for (
    var level_ordinal = 0u;
    level_ordinal < spatial_expectation.level_count;
    level_ordinal = level_ordinal + 1u
  ) {
    if (!ss_exact_near_level_occupied(spatial_expectation, level_ordinal)) {
      continue;
    }
    let level = spatial_expectation.min_level + i32(level_ordinal);
    if (
      mechanical_params.apply_selected_level != -2147483648
      && level != mechanical_params.apply_selected_level
    ) {
      continue;
    }
    let spacing_m = spatial_expectation.base_grid_spacing_m * exp2(f32(level));
    if (!ss_exact_near_finite(spacing_m) || spacing_m <= 0.0) {
      malformed = true;
      break;
    }
    let center_cell = vec3<i32>(floor(self_epoch_position / spacing_m));
    let radius_cells = max(
      0,
      i32(min(ceil(query_radius_m / spacing_m), 2147483520.0))
    );
    let minimum_cell = vec3<i32>(
      ss_exact_near_saturating_sub_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.z, radius_cells)
    );
    let maximum_cell = vec3<i32>(
      ss_exact_near_saturating_add_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.z, radius_cells)
    );
    let level_order = ss_exact_near_signed_order_key(level);
    let minimum_order = vec3<u32>(
      ss_exact_near_signed_order_key(minimum_cell.x),
      ss_exact_near_signed_order_key(minimum_cell.y),
      ss_exact_near_signed_order_key(minimum_cell.z)
    );
    let maximum_order = vec3<u32>(
      ss_exact_near_signed_order_key(maximum_cell.x),
      ss_exact_near_signed_order_key(maximum_cell.y),
      ss_exact_near_signed_order_key(maximum_cell.z)
    );
    let level_begin = ss_exact_near_lower_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0u)
    );
    let level_end = ss_exact_near_upper_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0xffffffffu)
    );
    var x_cursor = ss_exact_near_lower_bound_cell_key_range(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(minimum_order.x, 0u, 0u),
      level_begin,
      level_end
    );
    for (
      var x_iteration = 0u;
      x_iteration < spatial_expectation.source_count && x_cursor < level_end;
      x_iteration = x_iteration + 1u
    ) {
      let x_order = ss_exact_near_cell_key_word(
        spatial_expectation,
        x_cursor,
        2u
      );
      if (x_order > maximum_order.x) {
        x_cursor = level_end;
        continue;
      }
      let x_end = ss_exact_near_upper_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, 0xffffffffu, 0xffffffffu),
        x_cursor,
        level_end
      );
      if (x_end <= x_cursor) { malformed = true; break; }
      var y_cursor = ss_exact_near_lower_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, minimum_order.y, 0u),
        x_cursor,
        x_end
      );
      for (
        var y_iteration = 0u;
        y_iteration < spatial_expectation.source_count && y_cursor < x_end;
        y_iteration = y_iteration + 1u
      ) {
        let y_order = ss_exact_near_cell_key_word(
          spatial_expectation,
          y_cursor,
          3u
        );
        if (y_order > maximum_order.y) {
          y_cursor = x_end;
          continue;
        }
        let y_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, 0xffffffffu),
          y_cursor,
          x_end
        );
        if (y_end <= y_cursor) { malformed = true; break; }
        let z_begin = ss_exact_near_lower_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, minimum_order.z),
          y_cursor,
          y_end
        );
        let z_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, maximum_order.z),
          z_begin,
          y_end
        );
        for (
          var cell_index = z_begin;
          cell_index < z_end;
          cell_index = cell_index + 1u
        ) {
          let z_order = ss_exact_near_cell_key_word(
            spatial_expectation,
            cell_index,
            4u
          );
          let cell_coordinates = vec3<f32>(
            f32(bitcast<i32>(x_order ^ 0x80000000u)),
            f32(bitcast<i32>(y_order ^ 0x80000000u)),
            f32(bitcast<i32>(z_order ^ 0x80000000u))
          );
          let cell_minimum = cell_coordinates * spacing_m;
          let cell_maximum = (cell_coordinates + vec3<f32>(1.0))
            * spacing_m;
          let cell_intersects =
            mechanical_graph_squared_distance_to_aabb(
              self_epoch_position,
              cell_minimum,
              cell_maximum
            ) <= directory_radius_squared;
          if (cell_intersects) {
            mechanical_graph_materialize_cell(
              self_cache,
              cell_index,
              self_source_cell.source_index,
              0u,
              false,
              &local_rank,
              &candidate_count,
              &projected_peer_visit_count,
              &staged_count,
              &overflow_count,
              &malformed
            );
          }
          if (malformed) { break; }
        }
        if (malformed) { break; }
        y_cursor = y_end;
      }
      if (malformed || y_cursor < x_end) {
        malformed = true;
        break;
      }
      x_cursor = x_end;
    }
    if (malformed || x_cursor < level_end) {
      malformed = true;
      break;
    }
  }
  // ULG_MECHANICAL_FLAT_BODY_END
  }
  // ULG_MECHANICAL_AGGREGATE_BRANCH_END
  source_counts[self_index] = local_rank;
  mechanical_graph_evidence_saturating_add(15u, staged_count);
  mechanical_graph_evidence_saturating_add(18u, overflow_count);
  if (!mechanical_graph_evidence_saturating_add(14u, local_rank)) {
    malformed = true;
  }
  if (!mechanical_graph_evidence_saturating_add(
    ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.candidateVisitCount}u,
    candidate_count
  )) {
    malformed = true;
  }
  if (!mechanical_graph_evidence_saturating_add(
    ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.projectedPeerVisitCount}u,
    projected_peer_visit_count
  )) {
    malformed = true;
  }
  // ULG_MECHANICAL_AGGREGATE_EVIDENCE_BEGIN
  if (
    MECHANICAL_AGGREGATE_HIERARCHY_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled != 0u
  ) {
    mechanical_graph_evidence_saturating_add(
      ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.aggregateHierarchyNodeVisitCount}u,
      aggregate_node_visit_count
    );
    mechanical_graph_evidence_saturating_add(
      ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.aggregateHierarchyPrunedNodeCount}u,
      aggregate_pruned_node_count
    );
    mechanical_graph_evidence_saturating_add(
      ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.aggregateHierarchySourceCount}u,
      1u
    );
  }
  // ULG_MECHANICAL_AGGREGATE_EVIDENCE_END
  if (candidate_count == 0xffffffffu) {
    malformed = true;
  }
  if (malformed) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MALFORMED_TRAVERSAL}u
    );
  }
}

`;

function createSchroederSpatialMechanicalProposalV2Wgsl(source) {
  const traversalSpecialized = source.replace(
    exactNearTraversalV1Wgsl,
    exactNearTraversalV2Wgsl
  );
  if (traversalSpecialized === source) {
    throw new Error(
      'mechanical proposal v2 specialization could not replace exact-near traversal'
    );
  }
  const expectationSpecialized = traversalSpecialized.replace(
    'var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV1;',
    'var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV2;'
  );
  if (expectationSpecialized === traversalSpecialized) {
    throw new Error(
      'mechanical proposal v2 specialization could not replace expectation type'
    );
  }
  return expectationSpecialized
    .replaceAll(
      'spatial_expectation.source_count',
      'spatial_expectation.physical_source_count'
    )
    .replace(
      '} else if (dispatch_ordinal >= mechanical_params.particle_count) {',
      '} else if (dispatch_ordinal >= spatial_directory[37u]) {'
    );
}

export const schroederSpatialMechanicalProposalV2Wgsl =
  createSchroederSpatialMechanicalProposalV2Wgsl(
    schroederSpatialMechanicalProposalWgsl
  );

function createSchroederSpatialMechanicalProposalFlatWgsl(
  source,
  { activeRankView = false } = {}
) {
  const section = (text, beginMarker, endMarker) => {
    const begin = text.indexOf(beginMarker);
    const end = text.indexOf(endMarker, begin + beginMarker.length);
    if (begin < 0 || end < 0) {
      throw new Error(`mechanical WGSL specialization marker missing: ${beginMarker}`);
    }
    return { begin, end };
  };
  const helperBeginMarker = '// ULG_MECHANICAL_AGGREGATE_HELPERS_BEGIN';
  const helperEndMarker = '// ULG_MECHANICAL_AGGREGATE_HELPERS_END';
  const helper = section(source, helperBeginMarker, helperEndMarker);
  const projectionAdmission = activeRankView
    ? 'return mechanical_active_rank_view_admitted();'
    : 'return mechanical_params.aggregate_hierarchy_enabled == 0u;';
  let flat = `${source.slice(0, helper.begin)}
fn mechanical_aggregate_view_admitted() -> bool {
  ${projectionAdmission}
}
fn mechanical_aggregate_record_preflight(record_index: u32) -> bool {
  return false;
}
${source.slice(helper.end + helperEndMarker.length)}`;
  const preflightBeginMarker = '// ULG_MECHANICAL_AGGREGATE_PREFLIGHT_BEGIN';
  const preflightEndMarker = '// ULG_MECHANICAL_AGGREGATE_PREFLIGHT_END';
  const preflight = section(flat, preflightBeginMarker, preflightEndMarker);
  flat = `${flat.slice(0, preflight.begin)}${flat.slice(
    preflight.end + preflightEndMarker.length
  )}`;
  const sealBeginMarker = '// ULG_MECHANICAL_AGGREGATE_SEAL_BEGIN';
  const sealEndMarker = '// ULG_MECHANICAL_AGGREGATE_SEAL_END';
  const seal = section(flat, sealBeginMarker, sealEndMarker);
  flat = `${flat.slice(0, seal.begin)}${flat.slice(
    seal.end + sealEndMarker.length
  )}`;
  const branchBeginMarker = '// ULG_MECHANICAL_AGGREGATE_BRANCH_BEGIN';
  const flatBodyBeginMarker = '// ULG_MECHANICAL_FLAT_BODY_BEGIN';
  const flatBodyEndMarker = '// ULG_MECHANICAL_FLAT_BODY_END';
  const branchEndMarker = '// ULG_MECHANICAL_AGGREGATE_BRANCH_END';
  const branch = section(flat, branchBeginMarker, branchEndMarker);
  const flatBody = section(flat, flatBodyBeginMarker, flatBodyEndMarker);
  if (flatBody.begin < branch.begin || flatBody.end > branch.end) {
    throw new Error('mechanical WGSL flat specialization markers are misordered');
  }
  flat = `${flat.slice(0, branch.begin)}${flat.slice(
    flatBody.begin + flatBodyBeginMarker.length,
    flatBody.end
  )}${flat.slice(branch.end + branchEndMarker.length)}`;
  const evidenceBeginMarker = '// ULG_MECHANICAL_AGGREGATE_EVIDENCE_BEGIN';
  const evidenceEndMarker = '// ULG_MECHANICAL_AGGREGATE_EVIDENCE_END';
  const evidence = section(flat, evidenceBeginMarker, evidenceEndMarker);
  flat = `${flat.slice(0, evidence.begin)}${flat.slice(
    evidence.end + evidenceEndMarker.length
  )}`;
  return flat
    .replace(
      'const MECHANICAL_AGGREGATE_HIERARCHY_COMPILED: bool = true;',
      'const MECHANICAL_AGGREGATE_HIERARCHY_COMPILED: bool = false;'
    )
    .replace(
      'const MECHANICAL_ACTIVE_RANK_VIEW_COMPILED: bool = false;',
      `const MECHANICAL_ACTIVE_RANK_VIEW_COMPILED: bool = ${
        activeRankView ? 'true' : 'false'
      };`
    )
    .replace('  var aggregate_node_visit_count = 0u;\n', '')
    .replace('  var aggregate_pruned_node_count = 0u;\n', '');
}

export const schroederSpatialMechanicalProposalFlatWgsl =
  createSchroederSpatialMechanicalProposalFlatWgsl(
    schroederSpatialMechanicalProposalWgsl
  );

export const schroederSpatialMechanicalProposalActiveRankWgsl =
  createSchroederSpatialMechanicalProposalFlatWgsl(
    schroederSpatialMechanicalProposalWgsl,
    { activeRankView: true }
  );
export const schroederSpatialMechanicalProposalV2FlatWgsl =
  createSchroederSpatialMechanicalProposalFlatWgsl(
    schroederSpatialMechanicalProposalV2Wgsl
  );
export const schroederSpatialMechanicalProposalV2ActiveRankWgsl =
  createSchroederSpatialMechanicalProposalFlatWgsl(
    schroederSpatialMechanicalProposalV2Wgsl,
    { activeRankView: true }
  );

