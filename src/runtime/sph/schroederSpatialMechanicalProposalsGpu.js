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
  validateSchroederSpatialAggregateViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialAggregateView.js';
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
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_BUILDING,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_VERSION,
  ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
  createSchroederSpatialMechanicalPairGraphCapacityPlan,
  schroederSpatialMechanicalMatchingCleanupControlWordsForPasses
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicalPairGraph.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { createWebGpuU32ExclusiveScan } from '../webgpuRadixScanUnique.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  createSphGpuTimestampProfiler
} from './sphGpuTimestampProfiler.js';
import {
  SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_STATUS,
  bindSchroederSpatialExactNearResidentConsumerEvidence,
  resolveSchroederSpatialExactNearConsumerGeneration
} from './schroederSpatialEpochGpu.js';
import { validateSphPhaseCarrierPlan } from './sphPhaseCarrierTransferGpu.js';

export const ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanical-proposal.v3';
export const ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_BUFFER_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanical-proposal-buffer.v3';
export const ULG_SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanical-interface-receipt.v2';
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
export const SCHROEDER_SPATIAL_MECHANICAL_POSITION_TRUST_DIAMETERS = 16;
export const SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION =
  0.02;
export const SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT = 1;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_DEFAULT =
  16 * 1024 * 1024;
export const SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE = 16;
const MATCHING_CONSTRAINT_ROW_WORDS = 4;
const MATCHING_CONSTRAINT_BYTES_PER_DIRECTED_PAIR =
  MATCHING_CONSTRAINT_ROW_WORDS * Float32Array.BYTES_PER_ELEMENT;

const MATCHING_CLEANUP_CONTROL_MAGIC = 0x4d43_4c31;
const MATCHING_CLEANUP_CONTROL_VERSION = 1;
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

const mechanicalSolverBudgetCache = new Map();

export function resolveSchroederSpatialMechanicalSolverBudget({
  jacobiIterations = SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
  cleanupPassBudget
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
  const cacheKey = `j${jacobiIterations}.p${cleanupPassBudget}`;
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

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};

const EXPECTATION_BYTES = 112;
const MECHANICAL_PARAMS_BYTES = 128;
const MECHANICAL_SOLVER_ITERATION_PARAMS_BYTES = 16;
const MECHANICAL_SUPPORT_HEADER_WORDS = 6;
const MECHANICAL_SUPPORT_ROW_WORDS = 8;
const MECHANICAL_SUPPORT_TRAILER_WORDS = 1;
const MECHANICAL_SUPPORT_MAX_DIAMETER_WORD = 0;
const MECHANICAL_SUPPORT_MAX_DISPLACEMENT_WORD = 1;
const MECHANICAL_SUPPORT_MAX_WALL_PROJECTION_WORD = 2;
const MECHANICAL_SUPPORT_AGGREGATE_PREFLIGHT_WORD = 3;
const MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD = 4;
const MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD = 5;
const MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET = 0xffff_ffff;
const MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTED = 1;
const WORKGROUP_SIZE = 64;
const MECHANICAL_APPLY_ALL_LEVELS = -0x8000_0000;
export const SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_MAGIC;
export const SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_VERSION;
const MECHANICAL_PROPOSAL_HEADER_BYTES =
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT;
const MECHANICAL_PROPOSAL_ROW_BYTES =
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS * Uint32Array.BYTES_PER_ELEMENT;
const mechanicalProposalPools = new WeakMap();
const liveMechanicalProposalArtifacts = new WeakSet();
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

function createMechanicalProposalCaptureLayout({
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

function resolveMechanicalProposalCaptureRequest({
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

function mechanicalSolverIterationUniformPlan(
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

function finiteNumber(value, fallback = 0) {
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

function exactU32(value, label, { positive = false } = {}) {
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

function exactI32(value, label) {
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

function requireBuffer(device, buffer, label) {
  if (!buffer || !webGpuBufferMatchesDevice(buffer, device)) {
    throw new TypeError(`${label} must be a live buffer on the canonical generation device`);
  }
  return buffer;
}

function resolveMechanicalDiagnosticTrace({
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

function resolveMechanicalSpatialAuthority({
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

function createMechanicalParamsArray({
  particleCount,
  directedPairCapacity,
  relaxation,
  normalVelocityDamping,
  gridSpacingM,
  boxDimsM,
  identityEnabled,
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
  view.setUint32(28, identityEnabled ? 1 : 0, true);
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

function createMechanicalProposalHeader(execution, particleCount) {
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

function createMechanicalMatchingCleanupControlHeader(
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

function createMechanicalPairGraphEvidenceHeader({
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

const mechanicalContactGraphParamsWgsl = /* wgsl */ `
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
    && mechanical_params.identity_enabled != 0u
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
    && mechanical_params.identity_enabled != 0u
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
      mechanical_params.identity_enabled == 0u
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
    atomicMax(
      &global_support_bits[0u],
      bitcast<u32>(diameter_m)
    );
    if (ss_exact_near_finite(displacement_m)) {
      atomicMax(
        &global_support_bits[1u],
        bitcast<u32>(max(displacement_m, 0.0))
      );
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
          mechanical_params.identity_enabled == 0u
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

export const schroederSpatialMechanicalGraphControlWgsl = /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

@group(0) @binding(0) var<storage, read_write> source_counts: array<u32>;
@group(0) @binding(1) var<storage, read_write> source_offsets: array<u32>;
@group(0) @binding(2) var<storage, read_write> append_records: array<u32>;
@group(0) @binding(3) var<storage, read_write> csr_peers: array<u32>;
@group(0) @binding(4) var<storage, read_write> graph_control: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> proposal_rows: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> particle_scales: array<vec4<f32>>;
@group(0) @binding(8) var<uniform> mechanical_params: MechanicalProposalParams;
@group(0) @binding(9) var<storage, read_write> global_support_bits: array<atomic<u32>>;

fn mechanical_graph_control_header_valid() -> bool {
  return arrayLength(&graph_control)
      >= ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS}u
    && atomicLoad(&graph_control[0u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC}u
    && atomicLoad(&graph_control[1u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION}u
    && atomicLoad(&graph_control[2u]) == mechanical_params.generation_id
    && atomicLoad(&graph_control[3u]) == mechanical_params.storage_generation
    && atomicLoad(&graph_control[4u]) == mechanical_params.physics_tick
    && atomicLoad(&graph_control[5u]) == mechanical_params.physics_substep
    && atomicLoad(&graph_control[6u]) == mechanical_params.position_epoch
    && atomicLoad(&graph_control[7u]) == mechanical_params.topology_epoch
    && atomicLoad(&graph_control[8u]) == mechanical_params.support_epoch
    && bitcast<i32>(atomicLoad(&graph_control[9u]))
      == mechanical_params.apply_selected_level
    && atomicLoad(&graph_control[10u])
      == mechanical_params.directed_pair_capacity;
}

fn mechanical_graph_control_lineage_layout_valid() -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  let lane_count = mechanical_params.phase_lane_count;
  if (capacity == 0u || lane_count == 0u) {
    return capacity == 0u && lane_count == 0u;
  }
  return lane_count == 4u
    && capacity <= 0xffffffffu / lane_count
    && capacity * lane_count == mechanical_params.particle_count;
}

fn mechanical_graph_control_same_phase_lineage(
  self_index: u32,
  other_index: u32
) -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  return capacity > 0u
    && mechanical_params.phase_lane_count > 1u
    && self_index < capacity * mechanical_params.phase_lane_count
    && other_index < capacity * mechanical_params.phase_lane_count
    && self_index % capacity == other_index % capacity;
}

fn mechanical_graph_control_fail(bit: u32) {
  atomicOr(&graph_control[14u], bit);
}

fn mechanical_graph_store_conditional_dispatch(
  word_offset: u32,
  dispatch_x: u32
) {
  atomicStore(&graph_control[word_offset], dispatch_x);
  atomicStore(&graph_control[word_offset + 1u], 1u);
  atomicStore(&graph_control[word_offset + 2u], 1u);
}

@compute @workgroup_size(64)
fn initialize_contact_graph(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  source_counts[particle_index] = 0u;
  source_offsets[particle_index] = 0u;
  particle_scales[particle_index] = vec4<f32>(1.0);
  let proposal_row =
    ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
      + particle_index * 2u;
  proposal_rows[proposal_row] = vec4<f32>(0.0);
  proposal_rows[proposal_row + 1u] = vec4<f32>(0.0);
  if (particle_index != 0u) { return; }
  for (var word = 0u;
    word < ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS}u;
    word = word + 1u) {
    atomicStore(&graph_control[word], 0u);
  }
  atomicStore(
    &graph_control[0u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC}u
  );
  atomicStore(
    &graph_control[1u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION}u
  );
  atomicStore(&graph_control[2u], mechanical_params.generation_id);
  atomicStore(&graph_control[3u], mechanical_params.storage_generation);
  atomicStore(&graph_control[4u], mechanical_params.physics_tick);
  atomicStore(&graph_control[5u], mechanical_params.physics_substep);
  atomicStore(&graph_control[6u], mechanical_params.position_epoch);
  atomicStore(&graph_control[7u], mechanical_params.topology_epoch);
  atomicStore(&graph_control[8u], mechanical_params.support_epoch);
  atomicStore(
    &graph_control[9u],
    bitcast<u32>(mechanical_params.apply_selected_level)
  );
  atomicStore(
    &graph_control[10u],
    mechanical_params.directed_pair_capacity
  );
  atomicStore(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.INITIALIZED}u
  );
  // The following support-reduction dispatch authors this certificate.  It
  // starts unset so no source can mistake a fresh all-zero buffer for a
  // homogeneous liquid population before every active endpoint has checked
  // its phase and material identity.
  atomicStore(
    &global_support_bits[${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD}u],
    ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET}u
  );
  atomicStore(
    &global_support_bits[${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD}u],
    0u
  );
  atomicStore(&graph_control[29u], 0u);
  atomicStore(&graph_control[30u], 1u);
  atomicStore(&graph_control[31u], 1u);
  source_offsets[mechanical_params.particle_count] = 0u;
  source_offsets[arrayLength(&source_counts)] = 0u;
}

@compute @workgroup_size(1)
fn finalize_contact_graph_counts() {
  if (
    !mechanical_graph_control_header_valid()
    || !mechanical_graph_control_lineage_layout_valid()
    || (
      atomicLoad(&graph_control[15u])
        & (
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.INITIALIZED}
          | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}
          | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}
        )
    ) != (
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.INITIALIZED}
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}
    )
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.STAGE_ORDER}u
    );
  }
  let particle_count = mechanical_params.particle_count;
  let last_index = particle_count - 1u;
  let last_offset = source_offsets[last_index];
  let last_count = source_counts[last_index];
  var required_count = 0xffffffffu;
  if (last_offset <= 0xffffffffu - last_count) {
    required_count = last_offset + last_count;
  } else {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
    );
  }
  source_offsets[particle_count] = required_count;
  source_offsets[arrayLength(&source_counts)] = required_count;
  atomicStore(&graph_control[12u], required_count);
  atomicStore(&traversal_evidence[16u], required_count);
  let append_attempt_count = atomicLoad(&graph_control[11u]);
  atomicStore(&traversal_evidence[14u], append_attempt_count);
  if (required_count != append_attempt_count) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.SCAN_COUNT_MISMATCH}u
    );
  }
  if (
    required_count > mechanical_params.directed_pair_capacity
    || append_attempt_count > mechanical_params.directed_pair_capacity
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.GRAPH_CAPACITY}u
    );
  }
  atomicAdd(&traversal_evidence[24u], 1u);
  atomicOr(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SCANNED}u
  );
  if (atomicLoad(&graph_control[14u]) == 0u) {
    atomicStore(
      &graph_control[29u],
      (required_count + 63u) / 64u
    );
    if (required_count == 0u) {
      atomicOr(
        &graph_control[15u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u
      );
    }
  } else {
    atomicStore(&graph_control[29u], 0u);
  }
  let path_admitted = atomicLoad(&graph_control[14u]) == 0u;
  let particle_workgroups = (
    mechanical_params.particle_count + 63u
  ) / 64u;
  let has_directed_pairs = required_count != 0u;
  // A zero CSR alone cannot bypass the normal solver: its wall projection is
  // still a real mechanical law. The support reduction provides an exact
  // current-state wall certificate, so only an admitted zero graph with no
  // possible wall projection takes the zero-edge completion path.
  let no_wall_projection = arrayLength(&global_support_bits) >= 3u
    && bitcast<f32>(atomicLoad(&global_support_bits[2u])) == 0.0;
  let zero_edge_path = path_admitted
    && !has_directed_pairs
    && no_wall_projection;
  atomicStore(
    &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .fullSolverPath}u],
    select(0u, 1u, path_admitted && !zero_edge_path)
  );
  mechanical_graph_store_conditional_dispatch(
    ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .zeroEdgeDispatchX}u,
    select(0u, particle_workgroups, zero_edge_path)
  );
}

@compute @workgroup_size(64)
fn scatter_contact_graph_csr(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let append_index = global_id.x;
  let total = atomicLoad(&graph_control[12u]);
  if (
    append_index >= total
    || atomicLoad(&graph_control[14u]) != 0u
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SCANNED}u
    ) == 0u
  ) { return; }
  let append_base = append_index * 3u;
  let self_index = append_records[append_base];
  let other_index = append_records[append_base + 1u];
  let local_rank = append_records[append_base + 2u];
  if (
    self_index >= mechanical_params.particle_count
    || other_index >= mechanical_params.particle_count
    || self_index == other_index
    || local_rank >= source_counts[self_index]
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    atomicAdd(&traversal_evidence[20u], 1u);
    return;
  }
  let source_offset = source_offsets[self_index];
  if (
    source_offset > total
    || local_rank > total - source_offset
    || source_offset + local_rank >= total
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    atomicAdd(&traversal_evidence[19u], 1u);
    return;
  }
  csr_peers[source_offset + local_rank] = other_index;
  atomicAdd(&graph_control[13u], 1u);
  if (append_index == 0u) {
    atomicAdd(&traversal_evidence[25u], 1u);
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u
    );
  }
}

fn mechanical_graph_control_peer_hash(peer_index: u32, slot_count: u32) -> u32 {
  return (peer_index * 2654435761u) % max(slot_count, 1u);
}

// The staging arena is dead after CSR scatter. Reuse its three words per
// directed edge as a source-local exact peer set. One invocation owns each
// source segment, so construction is race-free; the following dispatch is the
// storage barrier before reciprocal lookup. At one-third load, successful and
// missing probes remain bounded without the former degree-squared scans.
@compute @workgroup_size(64)
fn index_contact_graph_csr(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  // The finalizer has authenticated a complete zero-edge graph and selected
  // the separate zero-edge completion dispatch.  Do not manufacture normal
  // graph-verification evidence here: that path is completed atomically by
  // the zero-edge kernel after the direct CSR stages have been bypassed.
  if (atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .fullSolverPath}u]) == 0u) { return; }
  if (
    self_index >= mechanical_params.particle_count
    || atomicLoad(&graph_control[14u]) != 0u
    || atomicLoad(&graph_control[13u]) != atomicLoad(&graph_control[12u])
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u
    ) == 0u
  ) { return; }
  let total = atomicLoad(&graph_control[12u]);
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (begin > end || end > total || end - begin != source_counts[self_index]) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  let degree = end - begin;
  let table_begin = begin * 3u;
  let slot_count = degree * 3u;
  for (var slot = 0u; slot < slot_count; slot = slot + 1u) {
    append_records[table_begin + slot] = 0xffffffffu;
  }
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let peer_index = csr_peers[cursor];
    var slot = mechanical_graph_control_peer_hash(peer_index, slot_count);
    var inserted = false;
    for (var probe = 0u; probe < slot_count; probe = probe + 1u) {
      let table_index = table_begin + slot;
      let resident_peer = append_records[table_index];
      if (resident_peer == 0xffffffffu) {
        append_records[table_index] = peer_index;
        inserted = true;
        break;
      }
      if (resident_peer == peer_index) {
        mechanical_graph_control_fail(
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.DUPLICATE_ENDPOINT}u
        );
        atomicAdd(&traversal_evidence[21u], 1u);
        inserted = true;
        break;
      }
      slot = (slot + 1u) % slot_count;
    }
    if (!inserted) {
      mechanical_graph_control_fail(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
      );
      return;
    }
  }
}

fn mechanical_graph_control_row_contains(
  source_index: u32,
  peer_index: u32,
  total: u32
) -> bool {
  let begin = source_offsets[source_index];
  let end = source_offsets[source_index + 1u];
  if (begin > end || end > total) { return false; }
  let degree = end - begin;
  if (degree == 0u) { return false; }
  let table_begin = begin * 3u;
  let slot_count = degree * 3u;
  var slot = mechanical_graph_control_peer_hash(peer_index, slot_count);
  for (var probe = 0u; probe < slot_count; probe = probe + 1u) {
    let resident_peer = append_records[table_begin + slot];
    if (resident_peer == peer_index) { return true; }
    if (resident_peer == 0xffffffffu) { return false; }
    slot = (slot + 1u) % slot_count;
  }
  return false;
}

@compute @workgroup_size(64)
fn validate_contact_graph_csr(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .fullSolverPath}u]) == 0u) { return; }
  if (self_index >= mechanical_params.particle_count) { return; }
  if (atomicLoad(&graph_control[14u]) != 0u) { return; }
  if (
    atomicLoad(&graph_control[13u])
      != atomicLoad(&graph_control[12u])
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u
    ) == 0u
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.STAGE_ORDER}u
    );
    return;
  }
  let total = atomicLoad(&graph_control[12u]);
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (begin > end || end > total || end - begin != source_counts[self_index]) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    atomicAdd(&traversal_evidence[19u], 1u);
    return;
  }
  var source_valid = true;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = csr_peers[cursor];
    if (
      other_index >= mechanical_params.particle_count
      || other_index == self_index
    ) {
      mechanical_graph_control_fail(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
      );
      atomicAdd(&traversal_evidence[20u], 1u);
      source_valid = false;
      continue;
    }
    if (mechanical_graph_control_same_phase_lineage(
      self_index,
      other_index
    )) {
      mechanical_graph_control_fail(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u
      );
      atomicAdd(&traversal_evidence[20u], 1u);
      source_valid = false;
      continue;
    }
    if (!mechanical_graph_control_row_contains(
      other_index,
      self_index,
      total
    )) {
      mechanical_graph_control_fail(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MISSING_RECIPROCAL}u
      );
      atomicAdd(&traversal_evidence[22u], 1u);
      source_valid = false;
    }
  }
  if (source_valid) {
    atomicAdd(&graph_control[16u], 1u);
  }
  if (self_index == 0u) {
    atomicAdd(&traversal_evidence[26u], 1u);
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.GRAPH_VERIFIED}u
    );
  }
}
`;

const mechanicalSolverInputStateReadWriteDeclarationWgsl =
  '@group(0) @binding(0) var<storage, read_write> input_state: array<vec4<f32>>;';

function createSchroederSpatialMechanicalGraphSolverCoreWgsl(
  solverBudget
) {
  return /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

struct MechanicalSolverIterationParams {
  iteration: u32,
  reserved_0: u32,
  reserved_1: u32,
  reserved_2: u32,
};

${mechanicalSolverInputStateReadWriteDeclarationWgsl}
@group(0) @binding(1) var<storage, read_write> output_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> source_identity: array<u32>;
@group(0) @binding(5) var<storage, read_write> csr_peers: array<u32>;
@group(0) @binding(6) var<storage, read> source_offsets: array<u32>;
@group(0) @binding(7) var<storage, read_write> particle_scales: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> graph_control: array<atomic<u32>>;
@group(0) @binding(9) var<storage, read> spatial_source_rows: array<f32>;
@group(0) @binding(10) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(11) var<uniform> mechanical_params: MechanicalProposalParams;
@group(0) @binding(12) var<storage, read_write> energy_ledger: array<vec4<f32>>;
@group(0) @binding(13) var<storage, read_write> matching_constraints:
  array<vec4<f32>>;
@group(0) @binding(14) var<storage, read_write> matching_cleanup_dispatch:
  array<atomic<u32>>;
@group(0) @binding(15) var<storage, read_write> mechanical_diagnostic_trace:
  array<atomic<u32>>;
@group(0) @binding(16) var<uniform> mechanical_solver_iteration:
  MechanicalSolverIterationParams;

var<workgroup> mechanical_matching_persistent_pass: u32;
var<workgroup> mechanical_matching_persistent_active_count: u32;
var<workgroup> mechanical_matching_persistent_contact_count: u32;
var<workgroup> mechanical_matching_persistent_dispatch_active: u32;

const MECHANICAL_DIAGNOSTIC_TRACE_MAGIC: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_MAGIC}u;
const MECHANICAL_DIAGNOSTIC_TRACE_VERSION: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_VERSION}u;
const MECHANICAL_DIAGNOSTIC_TRACE_WORDS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_WORDS}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_VALID: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS.HEADER_VALID}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_LOCAL_CAPTURE_COMPLETE: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS
    .LOCAL_CAPTURE_COMPLETE}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_POST_WALL_CAPTURE_COMPLETE: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS
    .POST_WALL_CAPTURE_COMPLETE}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_WINNER_TARGET_MATCH: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS
    .WINNER_TARGET_MATCH}u;
const MECHANICAL_DIAGNOSTIC_TARGET_TAIL_INVALID: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS.INVALID >>> 0}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_SELECTED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS.SELECTED}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_RECIPROCAL: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS.RECIPROCAL}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_APPLIED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS.APPLIED}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_TARGET_IS_LOW: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS.TARGET_IS_LOW}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_PAIR_CONTAINS_BOTH_TARGETS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .PAIR_CONTAINS_BOTH_TARGETS}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_ROUND_ZERO_TARGET_WALL_CLIPPED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .ROUND_ZERO_TARGET_WALL_CLIPPED}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_ROUND_ZERO_PEER_WALL_CLIPPED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .ROUND_ZERO_PEER_WALL_CLIPPED}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_LOCAL_CAPTURE_COMPLETE: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .LOCAL_CAPTURE_COMPLETE}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_POST_WALL_CAPTURE_COMPLETE: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .POST_WALL_CAPTURE_COMPLETE}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_POST_WALL_CHANGED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .POST_WALL_CHANGED}u;
const MECHANICAL_DIAGNOSTIC_TARGET_ROW_THREE_BLOCK_APPLIED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS
    .THREE_BLOCK_APPLIED}u;
const MECHANICAL_DIAGNOSTIC_TRACE_HEADER_VALID: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.HEADER_VALID}u;
const MECHANICAL_DIAGNOSTIC_TRACE_APPLY_OBSERVED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.APPLY_OBSERVED}u;
const MECHANICAL_DIAGNOSTIC_TRACE_TERMINAL_MEASURED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.TERMINAL_MEASURED}u;
const MECHANICAL_DIAGNOSTIC_TRACE_WINNER_MATERIALIZED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.WINNER_MATERIALIZED}u;
const MECHANICAL_DIAGNOSTIC_TRACE_PRODUCTION_MAX_MATCH: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.PRODUCTION_MAX_MATCH}u;
const MECHANICAL_DIAGNOSTIC_TRACE_IMPULSE_FINITE: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.IMPULSE_FINITE}u;
const MECHANICAL_DIAGNOSTIC_TRACE_INVALID: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS.INVALID >>> 0}u;

struct MechanicalPairResidual {
  barrier_dx: vec3<f32>,
  barrier_dv: vec3<f32>,
  soft_dx: vec3<f32>,
  soft_dv: vec3<f32>,
  velocity_normal: vec3<f32>,
  position_residual: f32,
  velocity_residual: f32,
  unilateral: u32,
  active_pair: u32,
  valid: u32,
};

struct MechanicalMatchingWallVelocityProjection {
  velocity: vec3<f32>,
  kinetic_delta_j: f32,
  clipped: u32,
  failure_code: u32,
  valid: u32,
};

struct MechanicalMatchingAxisWallConstraint {
  inward_scalar_sign: f32,
  geometry_active: u32,
  valid: u32,
};

struct MechanicalMatchingAxisActiveSetResult {
  primary_u: f32,
  center_u: f32,
  secondary_u: f32,
  primary_lambda: f32,
  secondary_lambda: f32,
  wall_mask: u32,
  valid: u32,
};

struct MechanicalMatchingFourBlockAxisResult {
  velocity: vec4<f32>,
  objective: f32,
  contact_mask: u32,
  valid: u32,
};

struct MechanicalMatchingFourBlockBoxAxisResult {
  velocity: vec4<f32>,
  contact_lambda: vec3<f32>,
  objective: f32,
  contact_mask: u32,
  wall_mask: u32,
  valid: u32,
};

struct MechanicalMatchingFourWallEnergyAllocation {
  delta_j: vec4<f32>,
  valid: u32,
};

struct MechanicalMatchingFourPathCandidate {
  body_0_index: u32,
  body_1_index: u32,
  body_2_index: u32,
  body_3_index: u32,
  edge_0_forward_cursor: u32,
  edge_0_reverse_cursor: u32,
  edge_1_forward_cursor: u32,
  edge_1_reverse_cursor: u32,
  edge_2_forward_cursor: u32,
  edge_2_reverse_cursor: u32,
  light_mass_ratio: f32,
  bridge_rank: u32,
  found: u32,
  valid: u32,
};

struct MechanicalMatchingVelocityRefinement {
  low_velocity: vec3<f32>,
  high_velocity: vec3<f32>,
  low_pair_kinetic_delta_j: f32,
  high_pair_kinetic_delta_j: f32,
  low_wall_kinetic_delta_j: f32,
  high_wall_kinetic_delta_j: f32,
  low_pair_impulse: vec3<f32>,
  high_pair_impulse: vec3<f32>,
  round_count: u32,
  failure_code: u32,
  valid: u32,
};

struct MechanicalMatchingThreeBlockResult {
  center_index: u32,
  primary_index: u32,
  secondary_index: u32,
  center_primary_cursor: u32,
  primary_center_cursor: u32,
  center_secondary_cursor: u32,
  secondary_center_cursor: u32,
  center_velocity: vec3<f32>,
  primary_velocity: vec3<f32>,
  secondary_velocity: vec3<f32>,
  center_kinetic_delta_j: f32,
  primary_kinetic_delta_j: f32,
  secondary_kinetic_delta_j: f32,
  center_wall_kinetic_delta_j: f32,
  primary_wall_kinetic_delta_j: f32,
  secondary_wall_kinetic_delta_j: f32,
  pair_heat_j: f32,
  center_primary_impulse: vec3<f32>,
  primary_impulse: vec3<f32>,
  center_secondary_impulse: vec3<f32>,
  secondary_impulse: vec3<f32>,
  tertiary_index: u32,
  center_tertiary_cursor: u32,
  tertiary_center_cursor: u32,
  tertiary_velocity: vec3<f32>,
  tertiary_kinetic_delta_j: f32,
  tertiary_wall_kinetic_delta_j: f32,
  center_tertiary_impulse: vec3<f32>,
  tertiary_impulse: vec3<f32>,
  member_count: u32,
  block_found: u32,
  applied: u32,
  failure_code: u32,
  valid: u32,
  topology: u32,
  path_owner: u32,
};

// Particle dispatch is constructor-bounded far below 2^30, so both peer high
// bits are solver-private cache lanes. Measure owns each directed CSR row and records
// whether the edge has a law in the unchanged iteration input. Solve and
// energy allocation can then skip the broad retained closure edges that were
// measured inactive without evaluating the swept pair law two more times. The
// matching owner keeps the second bit once a frozen cursor has ever become
// active, so expansion owns never-active rows and selection owns ever-active
// rows instead of both evaluating the complete incident CSR. Final residual
// verification restores public peer indices before publication or retention.
const MECHANICAL_SOLVER_EDGE_INACTIVE_BIT: u32 = 0x80000000u;
const MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT: u32 = 0x40000000u;
const MECHANICAL_SOLVER_EDGE_PEER_MASK: u32 = 0x3fffffffu;
const MECHANICAL_MATCHING_OWNER_ACTIVE_COUNT_WORD: u32 = 3u;
const MECHANICAL_MATCHING_OWNER_ACTIVE_CURSOR_COUNT_WORD: u32 = 4u;
const MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_HEADER_WORDS}u;
const MECHANICAL_MATCHING_OWNER_FRONTIER_BIT: u32 = 0x00000001u;
const MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT: u32 = 0x00000002u;
// Set when a particle's state changed since its last wall evaluation; the
// wall phase claims (clears) it exactly once, so duplicate mover-list
// entries can never double-project a member within one logical pass.
const MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT: u32 = 0x00000004u;
const MECHANICAL_MATCHING_OWNER_CONTACT_BIT: u32 = 0x80000000u;

fn mechanical_solver_full_path_enabled() -> bool {
  return atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .fullSolverPath}u]) != 0u;
}

fn mechanical_solver_peer_index(encoded_peer: u32) -> u32 {
  return encoded_peer & MECHANICAL_SOLVER_EDGE_PEER_MASK;
}

fn mechanical_solver_edge_inactive(encoded_peer: u32) -> bool {
  return (encoded_peer & MECHANICAL_SOLVER_EDGE_INACTIVE_BIT) != 0u;
}

fn mechanical_matching_edge_ever_active(encoded_peer: u32) -> bool {
  return (encoded_peer & MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT) != 0u;
}

fn mechanical_matching_mark_edge_inactive(encoded_peer: u32) -> u32 {
  return encoded_peer | MECHANICAL_SOLVER_EDGE_INACTIVE_BIT;
}

fn mechanical_solver_encode_measured_peer(
  peer_index: u32,
  edge_is_active: bool
) -> u32 {
  return peer_index | select(
    MECHANICAL_SOLVER_EDGE_INACTIVE_BIT,
    0u,
    edge_is_active
  );
}

fn mechanical_solver_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn mechanical_solver_finite3(value: vec3<f32>) -> bool {
  return mechanical_solver_finite(value.x)
    && mechanical_solver_finite(value.y)
    && mechanical_solver_finite(value.z);
}

fn mechanical_diagnostic_trace_header_valid() -> bool {
  let capacity_valid =
    arrayLength(&mechanical_diagnostic_trace)
      >= MECHANICAL_DIAGNOSTIC_TRACE_WORDS;
  if (!capacity_valid) { return false; }
  let valid =
    atomicLoad(&mechanical_diagnostic_trace[0u])
        == MECHANICAL_DIAGNOSTIC_TRACE_MAGIC
      && atomicLoad(&mechanical_diagnostic_trace[1u])
        == MECHANICAL_DIAGNOSTIC_TRACE_VERSION
      && atomicLoad(&mechanical_diagnostic_trace[3u])
        == mechanical_params.generation_id
      && atomicLoad(&mechanical_diagnostic_trace[4u])
        == mechanical_params.storage_generation
      && atomicLoad(&mechanical_diagnostic_trace[5u])
        == mechanical_params.physics_tick
      && atomicLoad(&mechanical_diagnostic_trace[6u])
        == mechanical_params.physics_substep
      && atomicLoad(&mechanical_diagnostic_trace[7u])
        == mechanical_params.position_epoch
      && atomicLoad(&mechanical_diagnostic_trace[8u])
        == mechanical_params.topology_epoch
      && atomicLoad(&mechanical_diagnostic_trace[9u])
        == mechanical_params.support_epoch
      && atomicLoad(&mechanical_diagnostic_trace[10u])
        == mechanical_params.particle_count
      && atomicLoad(&mechanical_diagnostic_trace[11u])
        == ${solverBudget.cleanupPassBudget}u;
  if (!valid) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
  }
  return valid;
}

fn mechanical_diagnostic_trace_load_f32(word: u32) -> f32 {
  return bitcast<f32>(atomicLoad(&mechanical_diagnostic_trace[word]));
}

fn mechanical_diagnostic_trace_store_f32(word: u32, value: f32) {
  atomicStore(&mechanical_diagnostic_trace[word], bitcast<u32>(value));
}

fn mechanical_diagnostic_target_tail_header_valid() -> bool {
  if (
    arrayLength(&mechanical_diagnostic_trace)
      < MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS
  ) { return false; }
  let header = MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
  let target_a = atomicLoad(&mechanical_diagnostic_trace[header + 6u]);
  let target_b = atomicLoad(&mechanical_diagnostic_trace[header + 7u]);
  let valid =
    atomicLoad(&mechanical_diagnostic_trace[header])
        == MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC
      && atomicLoad(&mechanical_diagnostic_trace[header + 1u])
        == MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION
      && (
        atomicLoad(&mechanical_diagnostic_trace[header + 2u])
          & MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_VALID
      ) != 0u
      && (
        atomicLoad(&mechanical_diagnostic_trace[header + 2u])
          & MECHANICAL_DIAGNOSTIC_TARGET_TAIL_INVALID
      ) == 0u
      && atomicLoad(&mechanical_diagnostic_trace[header + 3u])
        == ${solverBudget.cleanupPassBudget}u
      && atomicLoad(&mechanical_diagnostic_trace[header + 4u])
        == MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
      && atomicLoad(&mechanical_diagnostic_trace[header + 5u])
        == MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS
      && target_a < mechanical_params.particle_count
      && target_b < mechanical_params.particle_count
      && target_a != target_b;
  if (!valid) {
    atomicOr(
      &mechanical_diagnostic_trace[header + 2u],
      MECHANICAL_DIAGNOSTIC_TARGET_TAIL_INVALID
    );
  }
  return valid;
}

fn mechanical_diagnostic_target_index(target_slot: u32) -> u32 {
  return atomicLoad(
    &mechanical_diagnostic_trace[
      MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD + 6u + target_slot
    ]
  );
}

fn mechanical_diagnostic_target_row_word(
  pass_index: u32,
  target_slot: u32,
  row_word: u32
) -> u32 {
  return MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD
    + (
      pass_index * MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
        + target_slot
    ) * MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS
    + row_word;
}

fn mechanical_diagnostic_target_row_store_f32(
  pass_index: u32,
  target_slot: u32,
  row_word: u32,
  value: f32
) {
  mechanical_diagnostic_trace_store_f32(
    mechanical_diagnostic_target_row_word(
      pass_index,
      target_slot,
      row_word
    ),
    value
  );
}

fn mechanical_diagnostic_target_row_store_vec3(
  pass_index: u32,
  target_slot: u32,
  row_word: u32,
  value: vec3<f32>
) {
  mechanical_diagnostic_target_row_store_f32(
    pass_index,
    target_slot,
    row_word,
    value.x
  );
  mechanical_diagnostic_target_row_store_f32(
    pass_index,
    target_slot,
    row_word + 1u,
    value.y
  );
  mechanical_diagnostic_target_row_store_f32(
    pass_index,
    target_slot,
    row_word + 2u,
    value.z
  );
}

fn mechanical_solver_zero_pair(valid: u32) -> MechanicalPairResidual {
  return MechanicalPairResidual(
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    0u,
    0u,
    valid
  );
}

fn mechanical_solver_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

fn mechanical_solver_wall_boundary_tolerance_m(
  boundary_m: f32,
  opposite_boundary_m: f32
) -> f32 {
  let span_m = abs(opposite_boundary_m - boundary_m);
  return min(
    8.0 * 1.1920929e-7 * max(abs(boundary_m), 1.0e-12),
    0.25 * span_m
  );
}

fn mechanical_solver_source_row_base(index: u32) -> u32 {
  return index * 16u;
}

fn mechanical_solver_epoch_position(index: u32) -> vec3<f32> {
  let base = mechanical_solver_source_row_base(index);
  return vec3<f32>(
    spatial_source_rows[base + 12u],
    spatial_source_rows[base + 13u],
    spatial_source_rows[base + 14u]
  );
}

fn mechanical_solver_selected(index: u32) -> bool {
  // The verified CSR graph already carries the constructor-bound level
  // selection. The solver must consume that graph, not reinterpret either of
  // the two admitted 16-float spatial-source row ABIs.
  return index < mechanical_params.particle_count;
}

fn mechanical_solver_phase_class(index: u32) -> u32 {
  let row5 = source_mechanics[index * 8u + 5u];
  let row6 = source_mechanics[index * 8u + 6u];
  if (row5.x > 0.5) { return 2u; }
  if (row6.z > 0.5 && row6.z < 1.5) { return 1u; }
  return 0u;
}

fn mechanical_solver_same_phase_lineage(
  self_index: u32,
  other_index: u32
) -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  return capacity > 0u
    && mechanical_params.phase_lane_count > 1u
    && self_index < capacity * mechanical_params.phase_lane_count
    && other_index < capacity * mechanical_params.phase_lane_count
    && self_index % capacity == other_index % capacity;
}

fn mechanical_solver_same_body_solid_pair(
  self_index: u32,
  other_index: u32
) -> bool {
  if (
    mechanical_solver_phase_class(self_index) != 2u
    || mechanical_solver_phase_class(other_index) != 2u
  ) { return false; }
  let self_material = source_thermo[self_index * 3u].x;
  let other_material = source_thermo[other_index * 3u].x;
  if (abs(self_material - other_material) >= 0.5) { return false; }
  if (mechanical_params.identity_enabled == 0u) { return true; }
  let self_domain = source_identity[self_index];
  let other_domain = source_identity[other_index];
  return self_domain == 0u
    || other_domain == 0u
    || self_domain == other_domain;
}

fn mechanical_solver_unilateral_pair(
  self_index: u32,
  other_index: u32
) -> bool {
  let self_class = mechanical_solver_phase_class(self_index);
  let other_class = mechanical_solver_phase_class(other_index);
  if (self_class == 0u || other_class == 0u) { return false; }
  let self_material = source_thermo[self_index * 3u].x;
  let other_material = source_thermo[other_index * 3u].x;
  if (abs(self_material - other_material) >= 0.5) { return true; }
  let solid_liquid_interface = (self_class == 2u && other_class == 1u)
    || (self_class == 1u && other_class == 2u);
  if (solid_liquid_interface) { return true; }
  if (
    self_class != 2u
    || other_class != 2u
    || mechanical_params.identity_enabled == 0u
  ) { return false; }
  let self_domain = source_identity[self_index];
  let other_domain = source_identity[other_index];
  return self_domain != 0u
    && other_domain != 0u
    && self_domain != other_domain;
}

fn mechanical_solver_coincidence_normal(
  self_index: u32,
  other_index: u32
) -> vec3<f32> {
  let low_index = min(self_index, other_index);
  var h = low_index * 2654435761u + 0x9e3779b9u;
  h = (h ^ (h >> 16u)) * 2246822519u;
  h = h ^ (h >> 13u);
  let raw = vec3<f32>(
    f32(h & 1023u) / 511.5 - 1.0,
    f32((h >> 10u) & 1023u) / 511.5 - 1.0,
    f32((h >> 20u) & 1023u) / 511.5 - 1.0
  );
  let raw_length = length(raw);
  let normalized = select(
    vec3<f32>(0.0, 1.0, 0.0),
    raw / max(raw_length, 1.0e-6),
    raw_length > 1.0e-4
  );
  return normalized * select(-1.0, 1.0, self_index > other_index);
}

struct MechanicalFiniteVolumeContact {
  normal: vec3<f32>,
  response_normal: vec3<f32>,
  response_projection: f32,
  support_distance_m: f32,
  overlap_m: f32,
  swept_contact: u32,
  admitted: u32,
};

fn mechanical_solver_aabb_tangent_zero_tolerance_m(
  delta_m: vec3<f32>,
  self_edge_m: f32,
  other_edge_m: f32
) -> f32 {
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let geometric_scale_m = max(
    max(
      max(abs(delta_m.x), max(abs(delta_m.y), abs(delta_m.z))),
      max(self_edge_m, other_edge_m)
    ),
    max(half_sum_m, 1.0e-12)
  );
  // Reject edge/corner-only contacts whose apparent tangential overlap is
  // solely binary32 subtraction roundoff. Unlike the normal shell, this is a
  // strict zero-area predicate and never admits a mechanical constraint.
  return 16.0 * 1.1920929e-7 * geometric_scale_m;
}

fn mechanical_solver_aabb_face(
  delta_m: vec3<f32>,
  self_edge_m: f32,
  other_edge_m: f32,
  normal_tolerance_m: f32
) -> vec2<u32> {
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let separation_m = abs(delta_m) - vec3<f32>(half_sum_m);
  var normal_axis = 0u;
  if (separation_m.y > separation_m.x) { normal_axis = 1u; }
  if (
    separation_m.z
      > select(separation_m.x, separation_m.y, normal_axis == 1u)
  ) { normal_axis = 2u; }
  if (
    separation_m.x > normal_tolerance_m
    || separation_m.y > normal_tolerance_m
    || separation_m.z > normal_tolerance_m
  ) { return vec2<u32>(0u); }
  var tangent_a = 0.0;
  var tangent_b = 0.0;
  if (normal_axis == 0u) {
    tangent_a = min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m.y)
    );
    tangent_b = min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m.z)
    );
  } else if (normal_axis == 1u) {
    tangent_a = min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m.x)
    );
    tangent_b = min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m.z)
    );
  } else {
    tangent_a = min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m.x)
    );
    tangent_b = min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m.y)
    );
  }
  let tangent_zero_tolerance_m =
    mechanical_solver_aabb_tangent_zero_tolerance_m(
      delta_m,
      self_edge_m,
      other_edge_m
    );
  return vec2<u32>(
    normal_axis,
    select(
      0u,
      1u,
      tangent_a > tangent_zero_tolerance_m
        && tangent_b > tangent_zero_tolerance_m
    )
  );
}

fn mechanical_solver_aabb_normal_roundoff_tolerance_m(
  delta_m: vec3<f32>,
  self_edge_m: f32,
  other_edge_m: f32
) -> f32 {
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let geometric_scale_m = max(
    max(
      max(abs(delta_m.x), max(abs(delta_m.y), abs(delta_m.z))),
      max(self_edge_m, other_edge_m)
    ),
    max(half_sum_m, 1.0e-12)
  );
  // Bound the numerical contact shell to eight binary32 roundoff steps at the
  // local cell scale, with a hard 1e-4 support-relative cap. The response
  // overlap remains max(..., 0), so this only retains a closing velocity
  // constraint and never pulls a separated pair together.
  return min(
    8.0 * 1.1920929e-7 * geometric_scale_m,
    1.0e-4 * half_sum_m
  );
}

fn mechanical_solver_swept_aabb_axis_interval(
  start_m: f32,
  sweep_m: f32,
  half_sum_m: f32
) -> vec3<f32> {
  if (abs(sweep_m) <= 1.0e-12) {
    if (abs(start_m) > half_sum_m) { return vec3<f32>(0.0); }
    return vec3<f32>(-3.402823e+38, 3.402823e+38, 1.0);
  }
  let first_t = (-half_sum_m - start_m) / sweep_m;
  let second_t = (half_sum_m - start_m) / sweep_m;
  return vec3<f32>(
    min(first_t, second_t),
    max(first_t, second_t),
    1.0
  );
}

fn mechanical_solver_finite_volume_contact(
  self_index: u32,
  other_index: u32,
  delta_m: vec3<f32>,
  epoch_delta_m: vec3<f32>,
  self_edge_m: f32,
  other_edge_m: f32
) -> MechanicalFiniteVolumeContact {
  let rejected = MechanicalFiniteVolumeContact(
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    0.0,
    0u,
    0u
  );
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let normal_roundoff_tolerance_m =
    mechanical_solver_aabb_normal_roundoff_tolerance_m(
      delta_m,
      self_edge_m,
      other_edge_m
    );
  let current_face = mechanical_solver_aabb_face(
    delta_m,
    self_edge_m,
    other_edge_m,
    normal_roundoff_tolerance_m
  );
  let sweep_delta_m = delta_m - epoch_delta_m;
  var swept_admitted = false;
  var impact_t = 0.0;
  var impact_delta_m = vec3<f32>(0.0);
  var impact_normal_axis = 0u;
  if (length(sweep_delta_m) > 1.0e-12) {
    let interval_x = mechanical_solver_swept_aabb_axis_interval(
      epoch_delta_m.x,
      sweep_delta_m.x,
      half_sum_m
    );
    let interval_y = mechanical_solver_swept_aabb_axis_interval(
      epoch_delta_m.y,
      sweep_delta_m.y,
      half_sum_m
    );
    let interval_z = mechanical_solver_swept_aabb_axis_interval(
      epoch_delta_m.z,
      sweep_delta_m.z,
      half_sum_m
    );
    if (interval_x.z != 0.0 && interval_y.z != 0.0 && interval_z.z != 0.0) {
      let entry_t = max(interval_x.x, max(interval_y.x, interval_z.x));
      let exit_t = min(interval_x.y, min(interval_y.y, interval_z.y));
      if (entry_t <= exit_t && exit_t >= 0.0 && entry_t <= 1.0) {
        impact_t = clamp(entry_t, 0.0, 1.0);
        impact_delta_m = epoch_delta_m + impact_t * sweep_delta_m;
        let impact_face = mechanical_solver_aabb_face(
          impact_delta_m,
          self_edge_m,
          other_edge_m,
          mechanical_solver_aabb_normal_roundoff_tolerance_m(
            impact_delta_m,
            self_edge_m,
            other_edge_m
          )
        );
        impact_normal_axis = impact_face.x;
        swept_admitted = impact_face.y != 0u;
      }
    }
  }
  let cohort_inverted = dot(epoch_delta_m, delta_m) <= 0.0;
  var source_delta_m = vec3<f32>(0.0);
  var source_normal_axis = 0u;
  var admitted = false;
  if (
    swept_admitted
    && (
      current_face.y == 0u
      || cohort_inverted
      || max(
        abs(epoch_delta_m.x),
        max(abs(epoch_delta_m.y), abs(epoch_delta_m.z))
      ) >= half_sum_m
    )
  ) {
    source_delta_m = impact_delta_m;
    source_normal_axis = impact_normal_axis;
    admitted = true;
  } else if (current_face.y != 0u) {
    source_delta_m = delta_m;
    source_normal_axis = current_face.x;
    admitted = true;
  }
  // A center-vector inversion can occur while one tangential slab stays
  // disjoint. Require an actual current or swept finite-area face.
  if (!admitted) { return rejected; }
  let coincidence_normal = mechanical_solver_coincidence_normal(
    self_index,
    other_index
  );
  let source_normal_component = select(
    source_delta_m.x,
    select(source_delta_m.y, source_delta_m.z, source_normal_axis == 2u),
    source_normal_axis != 0u
  );
  let coincidence_normal_component = select(
    coincidence_normal.x,
    select(
      coincidence_normal.y,
      coincidence_normal.z,
      source_normal_axis == 2u
    ),
    source_normal_axis != 0u
  );
  let normal_sign = select(
    select(-1.0, 1.0, coincidence_normal_component >= 0.0),
    select(-1.0, 1.0, source_normal_component >= 0.0),
    abs(source_normal_component) > 1.0e-12
  );
  var normal = vec3<f32>(0.0);
  if (source_normal_axis == 0u) {
    normal.x = normal_sign;
  } else if (source_normal_axis == 1u) {
    normal.y = normal_sign;
  } else {
    normal.z = normal_sign;
  }
  // This finite-volume law has no rotational cell degree of freedom. Apply
  // only the admitted face-normal response so an off-axis sweep cannot create
  // equal-and-opposite artificial tangential material momentum.
  let response_normal = normal;
  let response_projection = 1.0;
  let support_distance_m = half_sum_m;
  let overlap_m = max(
    support_distance_m - dot(delta_m, normal),
    0.0
  );
  if (
    !mechanical_solver_finite3(normal)
    || !mechanical_solver_finite3(response_normal)
    || !mechanical_solver_finite(response_projection)
    || response_projection <= 0.0
    || !mechanical_solver_finite(support_distance_m)
    || !mechanical_solver_finite(overlap_m)
  ) { return rejected; }
  return MechanicalFiniteVolumeContact(
    normal,
    response_normal,
    response_projection,
    support_distance_m,
    overlap_m,
    select(0u, 1u, swept_admitted),
    1u
  );
}

fn mechanical_solver_pair_response(
  self_index: u32,
  other_index: u32,
  self_mass: f32,
  other_mass: f32,
  overlap: f32,
  constraint_normal: vec3<f32>,
  response_normal: vec3<f32>,
  response_projection: f32,
  unilateral: bool,
  include_soft: bool
) -> MechanicalPairResidual {
  let self_inverse_mass = 1.0 / max(self_mass, 1.0e-30);
  let other_inverse_mass = 1.0 / max(other_mass, 1.0e-30);
  let inverse_mass_share = self_inverse_mass
    / (self_inverse_mass + other_inverse_mass);
  let self_velocity = input_state[self_index * 2u + 1u].xyz;
  let other_velocity = input_state[other_index * 2u + 1u].xyz;
  let approach = dot(
    self_velocity - other_velocity,
    constraint_normal
  );
  var relative_dv = vec3<f32>(0.0);
  if (unilateral && approach < 0.0) {
    let proposed_relative_dv = -approach
      / max(response_projection, 1.0e-6)
      * response_normal;
    let central_linear_work_speed_squared = dot(
      self_velocity - other_velocity,
      proposed_relative_dv
    );
    let kinetic_delta_speed_squared =
      2.0 * central_linear_work_speed_squared
        + dot(proposed_relative_dv, proposed_relative_dv);
    let kinetic_tolerance_speed_squared =
      64.0 * 1.1920929e-7 * max(
        dot(
          self_velocity - other_velocity,
          self_velocity - other_velocity
        ),
        1.0
      );
    if (
      central_linear_work_speed_squared > 0.0
      || kinetic_delta_speed_squared > kinetic_tolerance_speed_squared
    ) {
      let radial_approach = dot(
        self_velocity - other_velocity,
        response_normal
      );
      let radial_dv = max(-radial_approach, 0.0) * response_normal;
      let velocity_after_radial =
        self_velocity - other_velocity + radial_dv;
      let face_dv = max(
        -dot(velocity_after_radial, constraint_normal),
        0.0
      ) * constraint_normal;
      relative_dv = radial_dv + face_dv;
    } else {
      relative_dv = proposed_relative_dv;
    }
  }
  var result = mechanical_solver_zero_pair(1u);
  result.active_pair = 1u;
  result.unilateral = select(0u, 1u, unilateral);
  result.position_residual = select(0.0, overlap, unilateral);
  result.velocity_residual = select(
    0.0,
    max(-approach, 0.0),
    unilateral
  );
  if (unilateral) {
    result.barrier_dx = inverse_mass_share
      * overlap
      / max(response_projection, 1.0e-6)
      * response_normal;
    if (length(relative_dv) > 1.0e-12) {
      result.barrier_dv = inverse_mass_share * relative_dv;
      // The oblique response p f^T / dot(p,f) is an idempotent projection:
      // its eigenvalues remain 0/1 even when its singular value exceeds one.
      // Retain p in the Gershgorin basis so an isolated edge receives its
      // exact one-pass projection; the coupled trust scale and explicit
      // kinetic-energy guard remain authoritative for contact networks.
      let relative_dv_length = length(relative_dv);
      result.velocity_normal = select(
        constraint_normal,
        relative_dv / max(relative_dv_length, 1.0e-30),
        relative_dv_length > 1.0e-12
      );
    }
  } else if (include_soft) {
    result.soft_dx = mechanical_params.relaxation
      * inverse_mass_share * overlap * constraint_normal;
    if (approach < 0.0) {
      result.soft_dv = -mechanical_params.normal_velocity_damping
        * inverse_mass_share * approach * constraint_normal;
      result.velocity_normal = constraint_normal;
    }
  }
  if (
    !mechanical_solver_finite3(constraint_normal)
    || !mechanical_solver_finite3(response_normal)
    || !mechanical_solver_finite(response_projection)
    || !mechanical_solver_finite3(relative_dv)
    || response_projection <= 0.0
    || !mechanical_solver_finite3(result.barrier_dx)
    || !mechanical_solver_finite3(result.barrier_dv)
    || !mechanical_solver_finite3(result.soft_dx)
    || !mechanical_solver_finite3(result.soft_dv)
    || !mechanical_solver_finite3(result.velocity_normal)
    || !mechanical_solver_finite(result.position_residual)
    || !mechanical_solver_finite(result.velocity_residual)
  ) {
    result.valid = 0u;
  }
  return result;
}

fn mechanical_solver_pair(
  self_index: u32,
  other_index: u32,
  include_soft: bool
) -> MechanicalPairResidual {
  if (
    self_index >= mechanical_params.particle_count
    || other_index >= mechanical_params.particle_count
    || self_index == other_index
    || !mechanical_solver_selected(self_index)
    || !mechanical_solver_selected(other_index)
  ) { return mechanical_solver_zero_pair(0u); }
  if (mechanical_solver_same_phase_lineage(self_index, other_index)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u
    );
    return mechanical_solver_zero_pair(1u);
  }
  let self_class = mechanical_solver_phase_class(self_index);
  let other_class = mechanical_solver_phase_class(other_index);
  if (
    self_class == 0u
    || other_class == 0u
    || mechanical_solver_same_body_solid_pair(self_index, other_index)
  ) { return mechanical_solver_zero_pair(0u); }
  let unilateral = mechanical_solver_unilateral_pair(self_index, other_index);
  // Non-unilateral pairs are optional same-material liquid relaxation. After
  // the first Jacobi round, and during strict residual verification, they have
  // no law to evaluate. Reject them before loading geometry or sweep history.
  if (!unilateral && !include_soft) {
    return mechanical_solver_zero_pair(1u);
  }
  let self_pos_mass = input_state[self_index * 2u];
  let other_pos_mass = input_state[other_index * 2u];
  let self_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  let other_volume = max(source_mechanics[other_index * 8u + 4u].w, 0.0);
  if (
    self_pos_mass.w <= 0.0
    || other_pos_mass.w <= 0.0
    || self_volume <= 0.0
    || other_volume <= 0.0
  ) { return mechanical_solver_zero_pair(1u); }
  let self_diameter = mechanical_solver_cbrt(self_volume);
  let other_diameter = mechanical_solver_cbrt(other_volume);
  let rest_distance = 0.5 * (self_diameter + other_diameter);
  let delta = self_pos_mass.xyz - other_pos_mass.xyz;
  var distance_m = length(delta);
  var overlap = max(rest_distance - distance_m, 0.0);
  // Soft liquid relaxation has no swept-impact semantics. Most retained broad
  // edges are currently separated, so reject them before any epoch reads. A
  // coincident pair alone consults the epoch direction as a stable fallback.
  if (!unilateral) {
    if (overlap <= 0.0) { return mechanical_solver_zero_pair(1u); }
    var soft_normal = vec3<f32>(0.0, 1.0, 0.0);
    if (distance_m > 1.0e-9) {
      soft_normal = delta / distance_m;
    } else {
      let soft_epoch_delta = mechanical_solver_epoch_position(self_index)
        - mechanical_solver_epoch_position(other_index);
      let soft_epoch_distance = length(soft_epoch_delta);
      soft_normal = select(
        mechanical_solver_coincidence_normal(self_index, other_index),
        soft_epoch_delta / max(soft_epoch_distance, 1.0e-30),
        soft_epoch_distance > 1.0e-9
      );
      distance_m = 0.0;
    }
    return mechanical_solver_pair_response(
      self_index,
      other_index,
      self_pos_mass.w,
      other_pos_mass.w,
      overlap,
      soft_normal,
      soft_normal,
      1.0,
      false,
      include_soft
    );
  }
  let epoch_delta = mechanical_solver_epoch_position(self_index)
    - mechanical_solver_epoch_position(other_index);
  let finite_volume_contact = mechanical_solver_finite_volume_contact(
    self_index,
    other_index,
    delta,
    epoch_delta,
    self_diameter,
    other_diameter
  );
  if (finite_volume_contact.admitted == 0u) {
    return mechanical_solver_zero_pair(1u);
  }
  return mechanical_solver_pair_response(
    self_index,
    other_index,
    self_pos_mass.w,
    other_pos_mass.w,
    finite_volume_contact.overlap_m,
    finite_volume_contact.normal,
    finite_volume_contact.response_normal,
    finite_volume_contact.response_projection,
    true,
    include_soft
  );
}

fn mechanical_measure_count_word(iteration: u32) -> u32 {
  if (iteration < 4u) { return 19u + iteration; }
  if (iteration < 8u) {
    return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.measureCount4}u
      + (iteration - 4u);
  }
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.measureCount8}u
    + (iteration - 8u);
}

fn mechanical_solve_count_word(iteration: u32) -> u32 {
  if (iteration < 4u) { return 23u + iteration; }
  if (iteration < 8u) {
    return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.solveCount4}u
      + (iteration - 4u);
  }
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.solveCount8}u
    + (iteration - 8u);
}

fn mechanical_energy_count_word(iteration: u32) -> u32 {
  if (iteration < 4u) { return 32u + iteration; }
  if (iteration < 8u) {
    return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .energyMeasureCount4}u + (iteration - 4u);
  }
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .energyMeasureCount8}u + (iteration - 8u);
}

fn mechanical_pre_solve_position_residual_word(iteration: u32) -> u32 {
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .preSolveMaxPositionResidualOrderedF32_0}u + iteration;
}

fn mechanical_pre_solve_position_violation_ratio_word(iteration: u32) -> u32 {
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .preSolveMaxPositionViolationRatioOrderedF32_0}u + iteration;
}

fn mechanical_pre_solve_velocity_residual_word(iteration: u32) -> u32 {
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .preSolveMaxVelocityResidualOrderedF32_0}u + iteration;
}

fn mechanical_iteration_stage_bit(iteration: u32) -> u32 {
  if (iteration < 4u) { return 1u << (6u + iteration); }
  if (iteration < 8u) { return 1u << (18u + iteration - 4u); }
  return ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATIONS_8_15}u;
}

fn mechanical_energy_iteration_stage_bit(iteration: u32) -> u32 {
  if (iteration < 4u) { return 1u << (13u + iteration); }
  if (iteration < 8u) { return 1u << (22u + iteration - 4u); }
  return ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE
    .ENERGY_ITERATIONS_8_15}u;
}

fn mechanical_solver_wall_projection_bound(self_index: u32) -> f32 {
  let position = input_state[self_index * 2u].xyz;
  let volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  var clearance = 0.5 * mechanical_solver_cbrt(volume);
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

fn mechanical_measure_iteration(
  self_index: u32,
  iteration: u32,
  include_soft: bool
) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let previous_iteration = select(0u, iteration - 1u, iteration > 0u);
  let previous_energy_ready = iteration > 0u
    && atomicLoad(
      &graph_control[mechanical_energy_count_word(previous_iteration)]
    ) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & mechanical_energy_iteration_stage_bit(previous_iteration)
    ) != 0u;
  let prior_ready = select(
    atomicLoad(&graph_control[16u]) == mechanical_params.particle_count
      && (
        atomicLoad(&graph_control[15u])
          & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.GRAPH_VERIFIED}u
      ) != 0u,
    previous_energy_ready,
    iteration > 0u
  );
  if (!prior_ready || atomicLoad(&graph_control[14u]) != 0u) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (!mechanical_solver_selected(self_index)) {
    particle_scales[self_index] = vec4<f32>(1.0);
    atomicAdd(
      &graph_control[mechanical_measure_count_word(iteration)],
      1u
    );
    if (self_index == 0u) { atomicAdd(&traversal_evidence[28u], 1u); }
    return;
  }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (begin > end || end > total) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  var barrier_dx_triangle_sum_m = 0.0;
  var soft_dx_triangle_sum_m = 0.0;
  var position_dx_sum_m = vec3<f32>(0.0);
  var position_max_pair_dx_m = 0.0;
  var velocity_tensor_00 = 0.0;
  var velocity_tensor_01 = 0.0;
  var velocity_tensor_02 = 0.0;
  var velocity_tensor_11 = 0.0;
  var velocity_tensor_12 = 0.0;
  var velocity_tensor_22 = 0.0;
  var max_position_residual_m = 0.0;
  var max_position_violation_ratio = 0.0;
  var max_velocity_residual_m_per_s = 0.0;
  let self_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = mechanical_solver_peer_index(csr_peers[cursor]);
    let pair = mechanical_solver_pair(
      self_index,
      other_index,
      include_soft
    );
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    csr_peers[cursor] = mechanical_solver_encode_measured_peer(
      other_index,
      pair.active_pair != 0u
    );
    if (pair.active_pair == 0u) { continue; }
    if (pair.unilateral == 1u) {
      let other_volume = max(
        source_mechanics[other_index * 8u + 4u].w,
        0.0
      );
      let rest_distance_m = 0.5 * (
        mechanical_solver_cbrt(self_volume)
          + mechanical_solver_cbrt(other_volume)
      );
      let position_tolerance_m = max(
        1.0e-5,
        ${SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION}
          * rest_distance_m
      );
      max_position_residual_m = max(
        max_position_residual_m,
        pair.position_residual
      );
      max_position_violation_ratio = max(
        max_position_violation_ratio,
        pair.position_residual / position_tolerance_m
      );
      max_velocity_residual_m_per_s = max(
        max_velocity_residual_m_per_s,
        pair.velocity_residual
      );
    }
    barrier_dx_triangle_sum_m = barrier_dx_triangle_sum_m
      + length(pair.barrier_dx);
    soft_dx_triangle_sum_m = soft_dx_triangle_sum_m
      + length(pair.soft_dx);
    let pair_position_dx_m = pair.barrier_dx + pair.soft_dx;
    position_dx_sum_m = position_dx_sum_m + pair_position_dx_m;
    position_max_pair_dx_m = max(
      position_max_pair_dx_m,
      length(pair_position_dx_m)
    );
    if (dot(pair.velocity_normal, pair.velocity_normal) > 0.5) {
      let self_mass = input_state[self_index * 2u].w;
      let other_mass = input_state[other_index * 2u].w;
      let self_inverse_mass = 1.0 / max(self_mass, 1.0e-30);
      let other_inverse_mass = 1.0 / max(other_mass, 1.0e-30);
      let inverse_mass_share = self_inverse_mass
        / (self_inverse_mass + other_inverse_mass);
      let direction = pair.velocity_normal;
      velocity_tensor_00 = velocity_tensor_00
        + inverse_mass_share * direction.x * direction.x;
      velocity_tensor_01 = velocity_tensor_01
        + inverse_mass_share * direction.x * direction.y;
      velocity_tensor_02 = velocity_tensor_02
        + inverse_mass_share * direction.x * direction.z;
      velocity_tensor_11 = velocity_tensor_11
        + inverse_mass_share * direction.y * direction.y;
      velocity_tensor_12 = velocity_tensor_12
        + inverse_mass_share * direction.y * direction.z;
      velocity_tensor_22 = velocity_tensor_22
        + inverse_mass_share * direction.z * direction.z;
    }
  }
  let self_diameter_m = mechanical_solver_cbrt(self_volume);
  let initial_displacement_m = length(
    input_state[self_index * 2u].xyz
      - mechanical_solver_epoch_position(self_index)
  );
  let current_wall_projection_m =
    mechanical_solver_wall_projection_bound(self_index);
  let position_trust_capacity_m = select(
    ${SCHROEDER_SPATIAL_MECHANICAL_POSITION_TRUST_DIAMETERS}.0
      * self_diameter_m
      + 2.0 * initial_displacement_m
      + current_wall_projection_m,
    particle_scales[self_index].z,
    iteration > 0u
  );
  // The graph retains every peer reachable inside this epoch ball. Recompute
  // radial slack from the current iteration state instead of permanently
  // debiting oscillatory path length, while reserving this round's complete
  // orthogonal wall projection.
  let remaining_position_trust_m = max(
    0.0,
    position_trust_capacity_m
      - initial_displacement_m
      - current_wall_projection_m
  );
  let position_triangle_sum_m = barrier_dx_triangle_sum_m
    + soft_dx_triangle_sum_m;
  let position_sum_length_m = length(position_dx_sum_m);
  let position_degree_scale = select(
    1.0,
    min(
      1.0,
      position_max_pair_dx_m / max(position_sum_length_m, 1.0e-30)
    ),
    position_sum_length_m > 1.0e-12
  );
  // The solve takes min(endpoint scales) for every reciprocal edge. A scale
  // first caps the aggregate row to its strongest individual constraint, so a
  // degree-four bed cannot multiply its correction. Reciprocal endpoint minima
  // can disturb vector cancellation, so an independent triangle-sum cap proves
  // the realized row cannot exceed remaining complete-solve trust. Energy
  // allocation debits that realized motion before the next measure.
  let position_trust_scale = select(
    position_degree_scale,
    min(
      position_degree_scale,
      remaining_position_trust_m / max(position_triangle_sum_m, 1.0e-30)
    ),
    position_triangle_sum_m > 1.0e-12
  );
  // Each reciprocal pair uses min(endpoint scales). The symmetric tensor is
  // the diagonal block row's inverse-mass-weighted sum of response projectors.
  // It is positive semidefinite, so its trace is a coordinate-invariant upper
  // bound on the largest eigenvalue and is exact for one rank-one contact.
  // Reciprocal pair impulses form a graph Laplacian with equal off-diagonal
  // neighbour blocks, so the complete block-row bound is twice the diagonal
  // tensor bound. Omitting that second half admits the equal-mass contact-sheet
  // mode alpha*lambda=2, whose Jacobi eigenvalue is exactly -1.
  // Do not additionally cap velocity by max-pair / length(row sum): that
  // legacy single-vector trust bound throttles valid multi-contact rows even
  // when the tensor proves their combined reciprocal impulse is stable.
  // Position retains its triangle-sum trust certificate independently.
  let velocity_operator_bound =
    velocity_tensor_00 + velocity_tensor_11 + velocity_tensor_22;
  let velocity_stability_scale = 1.0 / max(
    ${SCHROEDER_SPATIAL_MECHANICAL_RECIPROCAL_LAPLACIAN_BOUND_FACTOR}.0
      * velocity_operator_bound,
    1.0
  );
  let scale = vec4<f32>(
    position_trust_scale,
    velocity_stability_scale,
    position_trust_capacity_m,
    remaining_position_trust_m
  );
  if (
    !mechanical_solver_finite(initial_displacement_m)
    || !mechanical_solver_finite(current_wall_projection_m)
    || !mechanical_solver_finite(position_trust_capacity_m)
    || !mechanical_solver_finite(remaining_position_trust_m)
    || !mechanical_solver_finite(position_sum_length_m)
    || !mechanical_solver_finite(position_max_pair_dx_m)
    || !mechanical_solver_finite(position_degree_scale)
    || position_trust_scale < 0.0
    || position_trust_scale > 1.0
    || velocity_stability_scale < 0.0
    || velocity_stability_scale > 1.0
    || position_trust_capacity_m < 0.0
    || remaining_position_trust_m < 0.0
    || remaining_position_trust_m > position_trust_capacity_m
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  atomicMax(
    &graph_control[mechanical_pre_solve_position_residual_word(iteration)],
    bitcast<u32>(max_position_residual_m)
  );
  atomicMax(
    &graph_control[
      mechanical_pre_solve_position_violation_ratio_word(iteration)
    ],
    bitcast<u32>(max_position_violation_ratio)
  );
  atomicMax(
    &graph_control[mechanical_pre_solve_velocity_residual_word(iteration)],
    bitcast<u32>(max_velocity_residual_m_per_s)
  );
  particle_scales[self_index] = scale;
  atomicAdd(
    &graph_control[mechanical_measure_count_word(iteration)],
    1u
  );
  if (self_index == 0u) { atomicAdd(&traversal_evidence[28u], 1u); }
}

fn mechanical_solver_pair_scale(
  self_index: u32,
  other_index: u32
) -> vec4<f32> {
  let self_scale = particle_scales[self_index];
  let other_scale = particle_scales[other_index];
  let position_scale = min(self_scale.x, other_scale.x);
  let velocity_scale = min(self_scale.y, other_scale.y);
  // A swept finite-volume projection is conservative only while its central
  // position rollback and impulse retain the same scalar multiplier. Use the
  // stricter of the independently proven trust/stability factors for both;
  // this remains inside each bound and preserves Δr = Δt·Δu.
  let coupled_scale = min(position_scale, velocity_scale);
  return vec4<f32>(
    coupled_scale,
    coupled_scale,
    coupled_scale,
    coupled_scale
  );
}

fn mechanical_energy_base(index: u32) -> u32 {
  return ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
    + index * 2u;
}

struct MechanicalEdgeLinearLoss {
  loss_j: f32,
  valid: u32,
};

fn mechanical_edge_linear_loss_from_pair_dv(
  low_index: u32,
  high_index: u32,
  low_pair_dv: vec3<f32>,
  high_pair_dv: vec3<f32>
) -> MechanicalEdgeLinearLoss {
  let low_pos_mass = input_state[low_index * 2u];
  let high_pos_mass = input_state[high_index * 2u];
  if (!(low_pos_mass.w > 0.0) || !(high_pos_mass.w > 0.0)) {
    return MechanicalEdgeLinearLoss(0.0, 1u);
  }
  let low_momentum_delta = low_pos_mass.w * low_pair_dv;
  let high_momentum_delta = high_pos_mass.w * high_pair_dv;
  let momentum_conditioning = length(low_momentum_delta)
    + length(high_momentum_delta);
  let momentum_tolerance = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(momentum_conditioning, 1.0)
  );
  if (length(low_momentum_delta + high_momentum_delta)
      > momentum_tolerance) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_CLOSURE}u
    );
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  let canonical_pair_momentum_delta = 0.5 * (
    low_momentum_delta - high_momentum_delta
  );
  let relative_linear_work_j = dot(
    input_state[low_index * 2u + 1u].xyz
      - input_state[high_index * 2u + 1u].xyz,
    canonical_pair_momentum_delta
  );
  let work_tolerance_j = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(abs(relative_linear_work_j), 1.0)
  );
  if (!mechanical_solver_finite(relative_linear_work_j)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  if (relative_linear_work_j > work_tolerance_j) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u
    );
    atomicAdd(&traversal_evidence[38u], 1u);
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  return MechanicalEdgeLinearLoss(max(0.0, -relative_linear_work_j), 1u);
}

fn mechanical_solve_iteration(
  self_index: u32,
  iteration: u32,
  include_soft: bool
) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let pos_mass = input_state[self_index * 2u];
  let vel_u = input_state[self_index * 2u + 1u];
  let energy_base = mechanical_energy_base(self_index);
  energy_ledger[energy_base] = vec4<f32>(0.0);
  if (iteration == 0u) {
    energy_ledger[energy_base + 1u] = vec4<f32>(0.0, 0.0, 0.0, vel_u.w);
  }
  output_state[self_index * 2u] = pos_mass;
  output_state[self_index * 2u + 1u] = vel_u;
  if (
    atomicLoad(&graph_control[mechanical_measure_count_word(iteration)])
      != mechanical_params.particle_count
    || atomicLoad(&graph_control[14u]) != 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (!mechanical_solver_selected(self_index) || pos_mass.w <= 0.0) {
    atomicAdd(
      &graph_control[mechanical_solve_count_word(iteration)],
      1u
    );
    if (self_index == 0u) {
      atomicAdd(&traversal_evidence[29u], 1u);
      atomicOr(
        &graph_control[15u],
        mechanical_iteration_stage_bit(iteration)
      );
    }
    return;
  }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (begin > end || end > total) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  var dx = vec3<f32>(0.0);
  var dv = vec3<f32>(0.0);
  var half_linear_loss_budget_j = 0.0;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let encoded_peer = csr_peers[cursor];
    if (mechanical_solver_edge_inactive(encoded_peer)) { continue; }
    let other_index = mechanical_solver_peer_index(encoded_peer);
    let pair = mechanical_solver_pair(self_index, other_index, include_soft);
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    if (pair.active_pair == 0u) { continue; }
    let pair_scale = mechanical_solver_pair_scale(self_index, other_index);
    let self_pair_dv = pair_scale.y * pair.barrier_dv
      + pair_scale.w * pair.soft_dv;
    // The reciprocal pair uses the same symmetric scale and opposite normal.
    // Derive its velocity delta from exact pair-momentum closure instead of
    // evaluating the full swept contact law a second time. This preserves the
    // unequal-mass response while removing one expensive pair-law evaluation
    // for every directed edge in every solver round.
    let other_mass = input_state[other_index * 2u].w;
    if (!(other_mass > 0.0)) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    let other_pair_dv = -(pos_mass.w / other_mass) * self_pair_dv;
    if (!mechanical_solver_finite3(other_pair_dv)) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    let low_index = min(self_index, other_index);
    let high_index = max(self_index, other_index);
    let low_pair_dv = select(other_pair_dv, self_pair_dv, self_index == low_index);
    let high_pair_dv = select(self_pair_dv, other_pair_dv, self_index == low_index);
    let edge = mechanical_edge_linear_loss_from_pair_dv(
      low_index,
      high_index,
      low_pair_dv,
      high_pair_dv
    );
    if (edge.valid == 0u) { return; }
    half_linear_loss_budget_j = half_linear_loss_budget_j
      + 0.5 * edge.loss_j;
    dx = dx
      + pair_scale.x * pair.barrier_dx
      + pair_scale.z * pair.soft_dx;
    dv = dv + self_pair_dv;
  }
  var position = pos_mass.xyz + dx;
  let contact_velocity = vel_u.xyz + dv;
  var velocity = contact_velocity;
  let rest_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  var wall_clearance = 0.0;
  if (rest_volume > 0.0) {
    wall_clearance = 0.5 * mechanical_solver_cbrt(rest_volume);
    if (mechanical_params.grid_spacing_m > 0.0) {
      wall_clearance = min(
        wall_clearance,
        0.5 * mechanical_params.grid_spacing_m
      );
    }
    let min_dimension = min(
      mechanical_params.box_dims_m.x,
      min(
        mechanical_params.box_dims_m.y,
        mechanical_params.box_dims_m.z
      )
    );
    if (min_dimension > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dimension);
    }
  }
  let upper = max(
    vec3<f32>(wall_clearance),
    mechanical_params.box_dims_m - vec3<f32>(wall_clearance)
  );
  let lower = vec3<f32>(wall_clearance);
  let lower_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(lower.x, upper.x),
    mechanical_solver_wall_boundary_tolerance_m(lower.y, upper.y),
    mechanical_solver_wall_boundary_tolerance_m(lower.z, upper.z)
  );
  let upper_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(upper.x, lower.x),
    mechanical_solver_wall_boundary_tolerance_m(upper.y, lower.y),
    mechanical_solver_wall_boundary_tolerance_m(upper.z, lower.z)
  );
  if (position.x < wall_clearance) {
    position.x = wall_clearance;
  } else if (position.x > upper.x) {
    position.x = upper.x;
  }
  if (position.y < wall_clearance) {
    position.y = wall_clearance;
  } else if (position.y > upper.y) {
    position.y = upper.y;
  }
  if (position.z < wall_clearance) {
    position.z = wall_clearance;
  } else if (position.z > upper.z) {
    position.z = upper.z;
  }
  if (
    position.x <= lower.x + lower_tolerance_m.x
    && velocity.x < 0.0
  ) { velocity.x = 0.0; }
  if (
    position.x >= upper.x - upper_tolerance_m.x
    && velocity.x > 0.0
  ) { velocity.x = 0.0; }
  if (
    position.y <= lower.y + lower_tolerance_m.y
    && velocity.y < 0.0
  ) { velocity.y = 0.0; }
  if (
    position.y >= upper.y - upper_tolerance_m.y
    && velocity.y > 0.0
  ) { velocity.y = 0.0; }
  if (
    position.z <= lower.z + lower_tolerance_m.z
    && velocity.z < 0.0
  ) { velocity.z = 0.0; }
  if (
    position.z >= upper.z - upper_tolerance_m.z
    && velocity.z > 0.0
  ) { velocity.z = 0.0; }
  if (!mechanical_solver_finite3(position) || !mechanical_solver_finite3(velocity)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let wall_kinetic_delta_j = 0.5 * pos_mass.w * (
    dot(velocity, velocity) - dot(contact_velocity, contact_velocity)
  );
  let wall_conditioning_j = 0.5 * pos_mass.w * (
    dot(velocity, velocity) + dot(contact_velocity, contact_velocity)
  );
  let wall_tolerance_j = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(wall_conditioning_j, 1.0)
  );
  if (
    !mechanical_solver_finite(wall_kinetic_delta_j)
    || wall_kinetic_delta_j > wall_tolerance_j
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u
    );
    atomicAdd(&traversal_evidence[38u], 1u);
    return;
  }
  let quadratic_energy_j = 0.5 * max(pos_mass.w, 0.0) * dot(dv, dv);
  let wall_heat_j = max(0.0, -wall_kinetic_delta_j);
  let budget_tolerance_j = max(
    1.0e-6,
    128.0 * 1.1920929e-7 * max(
      quadratic_energy_j + half_linear_loss_budget_j,
      1.0
    )
  );
  if (
    !mechanical_solver_finite(quadratic_energy_j)
    || !mechanical_solver_finite(half_linear_loss_budget_j)
    || !mechanical_solver_finite(wall_heat_j)
    || quadratic_energy_j
      > half_linear_loss_budget_j + budget_tolerance_j
    || wall_heat_j < 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
        mechanical_solver_finite(quadratic_energy_j)
          && mechanical_solver_finite(half_linear_loss_budget_j)
          && quadratic_energy_j
            > half_linear_loss_budget_j + budget_tolerance_j
      )
    );
    if (quadratic_energy_j > half_linear_loss_budget_j + budget_tolerance_j) {
      atomicAdd(&traversal_evidence[38u], 1u);
    }
    return;
  }
  let quadratic_budget_fraction = select(
    0.0,
    clamp(
      quadratic_energy_j / max(half_linear_loss_budget_j, 1.0e-30),
      0.0,
      1.0
    ),
    half_linear_loss_budget_j > 0.0
  );
  energy_ledger[energy_base] = vec4<f32>(
    quadratic_budget_fraction,
    quadratic_energy_j,
    half_linear_loss_budget_j,
    wall_heat_j
  );
  output_state[self_index * 2u] = vec4<f32>(position, pos_mass.w);
  output_state[self_index * 2u + 1u] = vec4<f32>(velocity, vel_u.w);
  atomicAdd(
    &graph_control[mechanical_solve_count_word(iteration)],
    1u
  );
  if (self_index == 0u) {
    atomicAdd(&traversal_evidence[29u], 1u);
    atomicOr(
      &graph_control[15u],
      mechanical_iteration_stage_bit(iteration)
    );
  }
}

fn mechanical_energy_effective_pair_dv(
  self_index: u32,
  other_index: u32,
  include_soft: bool
) -> vec3<f32> {
  let pair = mechanical_solver_pair(self_index, other_index, include_soft);
  if (pair.valid == 0u) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return vec3<f32>(0.0);
  }
  let pair_scale = mechanical_solver_pair_scale(self_index, other_index);
  return pair_scale.y * pair.barrier_dv
    + pair_scale.w * pair.soft_dv;
}

fn mechanical_edge_linear_loss(
  low_index: u32,
  high_index: u32,
  include_soft: bool
) -> MechanicalEdgeLinearLoss {
  let low_pair_dv = mechanical_energy_effective_pair_dv(
    low_index,
    high_index,
    include_soft
  );
  if (atomicLoad(&graph_control[14u]) != 0u) {
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  let low_mass = input_state[low_index * 2u].w;
  let high_mass = input_state[high_index * 2u].w;
  if (!(low_mass > 0.0) || !(high_mass > 0.0)) {
    return MechanicalEdgeLinearLoss(0.0, 1u);
  }
  // The directed graph is reciprocal and the pair scale is symmetric. Derive
  // the reverse endpoint response from momentum conservation instead of
  // running the swept pair law again during energy allocation.
  let high_pair_dv = -(low_mass / high_mass) * low_pair_dv;
  if (!mechanical_solver_finite3(high_pair_dv)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  return mechanical_edge_linear_loss_from_pair_dv(
    low_index,
    high_index,
    low_pair_dv,
    high_pair_dv
  );
}

fn mechanical_allocate_energy_iteration(
  self_index: u32,
  iteration: u32,
  include_soft: bool
) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  if (
    atomicLoad(&graph_control[mechanical_solve_count_word(iteration)])
      != mechanical_params.particle_count
    || atomicLoad(&graph_control[14u]) != 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  let energy_base = mechanical_energy_base(self_index);
  let pos_mass = input_state[self_index * 2u];
  let vel_u = input_state[self_index * 2u + 1u];
  let budget = energy_ledger[energy_base];
  var cumulative = energy_ledger[energy_base + 1u];
  var linear_loss_share_j = 0.0;
  var pair_heat_j = 0.0;
  var realized_position_dx_m = vec3<f32>(0.0);
  if (mechanical_solver_selected(self_index) && pos_mass.w > 0.0) {
    let begin = source_offsets[self_index];
    let end = source_offsets[self_index + 1u];
    let total = atomicLoad(&graph_control[12u]);
    if (begin > end || end > total) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
      );
      return;
    }
    for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
      let encoded_peer = csr_peers[cursor];
      if (mechanical_solver_edge_inactive(encoded_peer)) { continue; }
      let peer_index = mechanical_solver_peer_index(encoded_peer);
      let self_pair = mechanical_solver_pair(
        self_index,
        peer_index,
        include_soft
      );
      if (self_pair.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      if (self_pair.active_pair == 0u) { continue; }
      let self_pair_scale = mechanical_solver_pair_scale(
        self_index,
        peer_index
      );
      realized_position_dx_m = realized_position_dx_m
        + self_pair_scale.x * self_pair.barrier_dx
        + self_pair_scale.z * self_pair.soft_dx;
      let low_index = min(self_index, peer_index);
      let high_index = max(self_index, peer_index);
      let low_pos_mass = input_state[low_index * 2u];
      let high_pos_mass = input_state[high_index * 2u];
      let edge = mechanical_edge_linear_loss(
        low_index,
        high_index,
        include_soft
      );
      if (edge.valid == 0u) { return; }
      let edge_heat_fraction = max(
        0.0,
        1.0 - 0.5 * (
          energy_ledger[mechanical_energy_base(low_index)].x
            + energy_ledger[mechanical_energy_base(high_index)].x
        )
      );
      let edge_heat_j = edge.loss_j * edge_heat_fraction;
      let pair_mass = low_pos_mass.w + high_pos_mass.w;
      let low_mass_fraction = select(
        0.5,
        low_pos_mass.w / pair_mass,
        pair_mass > 0.0
      );
      let self_mass_fraction = select(
        1.0 - low_mass_fraction,
        low_mass_fraction,
        self_index == low_index
      );
      linear_loss_share_j = linear_loss_share_j
        + edge.loss_j * self_mass_fraction;
      pair_heat_j = pair_heat_j + edge_heat_j * self_mass_fraction;
    }
  }
  let position_trust_capacity_m = particle_scales[self_index].z;
  let prior_position_trust_m = particle_scales[self_index].w;
  let spent_position_trust_m = length(realized_position_dx_m);
  let next_epoch_displacement_m = length(
    output_state[self_index * 2u].xyz
      - mechanical_solver_epoch_position(self_index)
  );
  let position_trust_tolerance = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(position_trust_capacity_m, 1.0)
  );
  if (
    !mechanical_solver_finite(position_trust_capacity_m)
    || !mechanical_solver_finite(prior_position_trust_m)
    || !mechanical_solver_finite(spent_position_trust_m)
    || !mechanical_solver_finite(next_epoch_displacement_m)
    || position_trust_capacity_m < 0.0
    || prior_position_trust_m < 0.0
    || prior_position_trust_m > position_trust_capacity_m
    || spent_position_trust_m
      > prior_position_trust_m + position_trust_tolerance
    || next_epoch_displacement_m
      > position_trust_capacity_m + position_trust_tolerance
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let remaining_position_trust_m = max(
    0.0,
    position_trust_capacity_m - next_epoch_displacement_m
  );
  let pair_delta_k_j = budget.y - linear_loss_share_j;
  let wall_heat_j = budget.w;
  let cumulative_heat_j = cumulative.y + cumulative.z
    + pair_heat_j + wall_heat_j;
  let next_u = select(
    vel_u.w,
    cumulative.w + cumulative_heat_j / pos_mass.w,
    pos_mass.w > 0.0
  );
  if (
    !mechanical_solver_finite(pair_delta_k_j)
    || !mechanical_solver_finite(pair_heat_j)
    || !mechanical_solver_finite(wall_heat_j)
    || !mechanical_solver_finite(next_u)
    || pair_heat_j < 0.0
    || wall_heat_j < 0.0
    || next_u < 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NEGATIVE_INTERNAL_ENERGY}u,
        mechanical_solver_finite(next_u) && next_u < 0.0
      )
    );
    if (mechanical_solver_finite(next_u) && next_u < 0.0) {
      atomicAdd(&traversal_evidence[39u], 1u);
    }
    return;
  }
  let committed_velocity = output_state[self_index * 2u + 1u];
  output_state[self_index * 2u + 1u] = vec4<f32>(
    committed_velocity.xyz,
    next_u
  );
  cumulative = vec4<f32>(
    cumulative.x + pair_delta_k_j,
    cumulative.y + pair_heat_j,
    cumulative.z + wall_heat_j,
    cumulative.w
  );
  energy_ledger[energy_base + 1u] = cumulative;
  // Lanes z/w carry the epoch-ball certificate through the deterministic
  // conflict-free cleanup that follows the Jacobi warm start. A dedicated
  // terminal pass restores the public four-scale row before verification.
  particle_scales[self_index].z = position_trust_capacity_m;
  particle_scales[self_index].w = remaining_position_trust_m;
  atomicAdd(
    &graph_control[mechanical_energy_count_word(iteration)],
    1u
  );
  if (self_index == 0u) {
    atomicAdd(&traversal_evidence[32u], 1u);
    atomicOr(
      &graph_control[15u],
      mechanical_energy_iteration_stage_bit(iteration)
    );
  }
}

var<workgroup> mechanical_energy_totals: array<vec4<f32>, 64>;
var<workgroup> mechanical_energy_error_bounds: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn verify_contact_energy(
  @builtin(local_invocation_index) local_index: u32
) {
  // This entry point has workgroup barriers, so every lane must still take
  // the same barrier path when the authenticated zero-edge path is selected.
  // Keep its reduction inert instead of returning before those barriers.
  let full_solver_path = mechanical_solver_full_path_enabled();
  var energy_stages_ready = full_solver_path;
  for (var iteration = 0u;
    iteration < mechanical_params.solver_iteration_count;
    iteration = iteration + 1u) {
    energy_stages_ready = energy_stages_ready
      && atomicLoad(&graph_control[mechanical_energy_count_word(iteration)])
        == mechanical_params.particle_count
      && (
        atomicLoad(&graph_control[15u])
          & mechanical_energy_iteration_stage_bit(iteration)
      ) != 0u;
  }
  energy_stages_ready = energy_stages_ready
    && atomicLoad(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupPassCount}u]
    ) == ${solverBudget.cleanupPassBudget}u
    && atomicLoad(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupTrustRestoreCount}u]
    ) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_CLEANUP}u
    ) != 0u
    && (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE
          .MATCHING_TRUST_RESTORED}u
    ) != 0u;
  let prior_failure = atomicLoad(&graph_control[14u]) != 0u;
  let energy_admitted = full_solver_path && energy_stages_ready && !prior_failure;
  var totals = vec4<f32>(0.0);
  var error_bounds = vec4<f32>(0.0);
  if (energy_admitted) {
    for (var index = local_index; index < mechanical_params.particle_count;
      index = index + 64u) {
    let ledger = energy_ledger[mechanical_energy_base(index) + 1u];
    let state = input_state[index * 2u];
    let final_u = input_state[index * 2u + 1u].w;
    if (!all(vec4<bool>(
      mechanical_solver_finite(ledger.x),
      mechanical_solver_finite(ledger.y),
      mechanical_solver_finite(ledger.z),
      mechanical_solver_finite(ledger.w)
    )) || !mechanical_solver_finite(final_u)) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      continue;
    }
    let row_internal_delta_j = state.w * (final_u - ledger.w);
    let row_intended_transfer_j = ledger.y + ledger.z;
    let row_storage_rounding_bound_j = max(
      1.0e-6,
      0.5 * 1.1920929e-7
        * max(state.w, 0.0)
        * max(max(abs(final_u), abs(ledger.w)), 1.0)
        + 16.0 * 1.1920929e-7
          * max(abs(row_intended_transfer_j), 1.0)
    );
    if (abs(row_internal_delta_j - row_intended_transfer_j)
        > row_storage_rounding_bound_j) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_CLOSURE}u
      );
      continue;
    }
    totals = totals + vec4<f32>(
      ledger.x,
      ledger.y,
      ledger.z,
      row_internal_delta_j
    );
    let pair_conditioning_j = abs(ledger.x) + abs(ledger.y);
    let conditioning_j = abs(ledger.x)
      + abs(ledger.y)
      + ledger.z
      + abs(row_internal_delta_j);
      error_bounds = error_bounds + vec4<f32>(
        conditioning_j,
        pair_conditioning_j,
        row_storage_rounding_bound_j,
        0.0
      );
    }
  }
  mechanical_energy_totals[local_index] = totals;
  mechanical_energy_error_bounds[local_index] = error_bounds;
  workgroupBarrier();
  for (var offset = 32u; offset > 0u; offset = offset / 2u) {
    if (local_index < offset) {
      mechanical_energy_totals[local_index] =
        mechanical_energy_totals[local_index]
          + mechanical_energy_totals[local_index + offset];
      mechanical_energy_error_bounds[local_index] =
        mechanical_energy_error_bounds[local_index]
          + mechanical_energy_error_bounds[local_index + offset];
    }
    workgroupBarrier();
  }
  if (local_index != 0u) { return; }
  if (!full_solver_path) { return; }
  if (!energy_stages_ready) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (prior_failure || atomicLoad(&graph_control[14u]) != 0u) { return; }
  let pair_delta_k_j = mechanical_energy_totals[0u].x;
  let pair_heat_j = mechanical_energy_totals[0u].y;
  let wall_heat_j = mechanical_energy_totals[0u].z;
  let internal_energy_delta_j = mechanical_energy_totals[0u].w;
  let conditioning_j = mechanical_energy_error_bounds[0u].x;
  let pair_conditioning_j = mechanical_energy_error_bounds[0u].y;
  let internal_storage_rounding_bound_j =
    mechanical_energy_error_bounds[0u].z;
  let pair_residual_j = pair_delta_k_j + pair_heat_j;
  let internal_residual_j = internal_energy_delta_j
    - pair_heat_j
    - wall_heat_j;
  let residual_j = max(abs(pair_residual_j), abs(internal_residual_j));
  let tolerance_j = max(
    max(
      1.0e-4,
      256.0 * 1.1920929e-7 * max(conditioning_j, 1.0)
    ),
    internal_storage_rounding_bound_j
  );
  let pair_gain_tolerance_j = max(
    1.0e-5,
    128.0 * 1.1920929e-7 * max(pair_conditioning_j, 1.0)
  );
  atomicStore(&graph_control[36u], bitcast<u32>(pair_delta_k_j));
  atomicStore(&graph_control[37u], bitcast<u32>(pair_heat_j));
  atomicStore(&graph_control[38u], bitcast<u32>(wall_heat_j));
  atomicStore(&graph_control[39u], bitcast<u32>(residual_j));
  atomicStore(&traversal_evidence[33u], bitcast<u32>(pair_delta_k_j));
  atomicStore(&traversal_evidence[34u], bitcast<u32>(pair_heat_j));
  atomicStore(&traversal_evidence[35u], bitcast<u32>(wall_heat_j));
  atomicStore(&traversal_evidence[36u], bitcast<u32>(residual_j));
  atomicStore(&traversal_evidence[37u], bitcast<u32>(tolerance_j));
  if (pair_delta_k_j > pair_gain_tolerance_j
      || pair_heat_j < -pair_gain_tolerance_j) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u
    );
    atomicAdd(&traversal_evidence[38u], 1u);
    return;
  }
  if (!mechanical_solver_finite(residual_j)
      || !mechanical_solver_finite(tolerance_j)
      || residual_j > tolerance_j) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_CLOSURE}u
    );
    return;
  }
  atomicOr(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_VERIFIED}u
  );
}

fn mechanical_runtime_iteration_valid(iteration: u32) -> bool {
  return iteration < mechanical_params.solver_iteration_count
    && iteration < ${solverBudget.jacobiIterations}u;
}

@compute @workgroup_size(64)
fn measure_runtime_iteration(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let iteration = mechanical_solver_iteration.iteration;
  if (!mechanical_runtime_iteration_valid(iteration)) {
    if (global_id.x == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
      );
    }
    return;
  }
  mechanical_measure_iteration(global_id.x, iteration, iteration == 0u);
}

@compute @workgroup_size(64)
fn solve_runtime_iteration(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let iteration = mechanical_solver_iteration.iteration;
  if (!mechanical_runtime_iteration_valid(iteration)) {
    if (global_id.x == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
      );
    }
    return;
  }
  mechanical_solve_iteration(global_id.x, iteration, iteration == 0u);
}

@compute @workgroup_size(64)
fn allocate_energy_runtime_iteration(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let iteration = mechanical_solver_iteration.iteration;
  if (!mechanical_runtime_iteration_valid(iteration)) {
    if (global_id.x == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
      );
    }
    return;
  }
  mechanical_allocate_energy_iteration(
    global_id.x,
    iteration,
    iteration == 0u
  );
}

fn mechanical_matching_cleanup_header_valid() -> bool {
  return arrayLength(&traversal_evidence)
      >= ${solverBudget.matchingCleanupControlWords}u
    && atomicLoad(&traversal_evidence[0u])
      == ${MATCHING_CLEANUP_CONTROL_MAGIC}u
    && atomicLoad(&traversal_evidence[1u])
      == ${MATCHING_CLEANUP_CONTROL_VERSION}u
    && atomicLoad(&traversal_evidence[2u])
      == mechanical_params.generation_id
    && atomicLoad(&traversal_evidence[3u])
      == mechanical_params.storage_generation
    && atomicLoad(&traversal_evidence[4u])
      == mechanical_params.physics_tick
    && atomicLoad(&traversal_evidence[5u])
      == mechanical_params.physics_substep
    && atomicLoad(&traversal_evidence[6u])
      == mechanical_params.position_epoch
    && atomicLoad(&traversal_evidence[7u])
      == mechanical_params.topology_epoch
    && atomicLoad(&traversal_evidence[8u])
      == mechanical_params.support_epoch
    && atomicLoad(&traversal_evidence[9u])
      == mechanical_params.particle_count
    && atomicLoad(&traversal_evidence[10u])
      == mechanical_params.solver_iteration_count
    && atomicLoad(&traversal_evidence[11u])
      == ${solverBudget.cleanupPassBudget}u;
}

fn mechanical_matching_selection_count_word(pass_index: u32) -> u32 {
  return ${solverBudget.selectionCountWord}u + pass_index;
}

fn mechanical_matching_copy_count_word(pass_index: u32) -> u32 {
  return ${solverBudget.copyCountWord}u + pass_index;
}

fn mechanical_matching_apply_count_word(pass_index: u32) -> u32 {
  return ${solverBudget.applyCountWord}u + pass_index;
}

fn mechanical_matching_wall_count_word(pass_index: u32) -> u32 {
  return ${solverBudget.wallCountWord}u + pass_index;
}

fn mechanical_matching_applied_pair_count_word(pass_index: u32) -> u32 {
  return ${solverBudget.appliedPairCountWord}u + pass_index;
}

fn mechanical_matching_max_position_ratio_word(pass_index: u32) -> u32 {
  return ${solverBudget.maxPositionRatioWord}u + pass_index;
}

fn mechanical_matching_max_velocity_residual_word(pass_index: u32) -> u32 {
  return ${solverBudget.maxVelocityResidualWord}u + pass_index;
}

fn mechanical_matching_contact_count_word(pass_index: u32) -> u32 {
  return ${solverBudget.contactCountWord}u + pass_index;
}

fn mechanical_matching_jacobi_ready() -> bool {
  let final_iteration = mechanical_params.solver_iteration_count - 1u;
  return mechanical_solver_full_path_enabled()
    && atomicLoad(&graph_control[14u]) == 0u
    && atomicLoad(
      &graph_control[mechanical_energy_count_word(final_iteration)]
    ) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & mechanical_energy_iteration_stage_bit(final_iteration)
    ) != 0u;
}

fn mechanical_matching_jacobi_residual_converged() -> bool {
  let final_iteration = mechanical_params.solver_iteration_count - 1u;
  let position_ratio = bitcast<f32>(atomicLoad(
    &graph_control[
      mechanical_pre_solve_position_violation_ratio_word(final_iteration)
    ]
  ));
  let velocity_residual_m_per_s = bitcast<f32>(atomicLoad(
    &graph_control[
      mechanical_pre_solve_velocity_residual_word(final_iteration)
    ]
  ));
  return mechanical_solver_finite(position_ratio)
    && mechanical_solver_finite(velocity_residual_m_per_s)
    && position_ratio <= 1.0
    && velocity_residual_m_per_s <= ${
      SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
        .toExponential(1)
    };
}

fn mechanical_matching_current_pass() -> u32 {
  return atomicLoad(
    &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .matchingCleanupPassCount}u]
  );
}

fn mechanical_matching_prior_applied_pair_count(pass_index: u32) -> u32 {
  if (pass_index == 0u) { return 0u; }
  return atomicLoad(
    &traversal_evidence[
      mechanical_matching_applied_pair_count_word(pass_index - 1u)
    ]
  );
}

fn mechanical_matching_position_tolerance(
  low_index: u32,
  high_index: u32
) -> f32 {
  let low_volume = max(source_mechanics[low_index * 8u + 4u].w, 0.0);
  let high_volume = max(source_mechanics[high_index * 8u + 4u].w, 0.0);
  let rest_distance_m = 0.5 * (
    mechanical_solver_cbrt(low_volume)
      + mechanical_solver_cbrt(high_volume)
  );
  return max(
    1.0e-5,
    ${SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION}
      * rest_distance_m
  );
}

fn mechanical_matching_edge_rank(low_index: u32, high_index: u32) -> u32 {
  var rank = (low_index * 2654435761u)
    ^ (high_index * 2246822519u)
    ^ 0x9e3779b9u;
  rank = (rank ^ (rank >> 16u)) * 2246822519u;
  rank = (rank ^ (rank >> 13u)) * 3266489917u;
  return rank ^ (rank >> 16u);
}

fn mechanical_matching_constraint_code(normal: vec3<f32>) -> f32 {
  var axis = 0u;
  if (abs(normal.y) > abs(normal.x)) { axis = 1u; }
  if (
    abs(normal.z)
      > select(abs(normal.x), abs(normal.y), axis == 1u)
  ) { axis = 2u; }
  let component = select(
    normal.x,
    select(normal.y, normal.z, axis == 2u),
    axis != 0u
  );
  let sign_code = select(0u, 1u, component >= 0.0);
  return f32(1u + 2u * axis + sign_code);
}

fn mechanical_matching_constraint_code_valid(constraint: vec4<f32>) -> bool {
  let code = abs(constraint.w);
  return mechanical_solver_finite(code)
    && code >= 1.0
    && code <= 6.0
    && code == floor(code);
}

fn mechanical_matching_constraint_normal(
  constraint: vec4<f32>
) -> vec3<f32> {
  let encoded = u32(abs(constraint.w)) - 1u;
  let axis = encoded / 2u;
  let sign = select(-1.0, 1.0, (encoded & 1u) != 0u);
  var normal = vec3<f32>(0.0);
  if (axis == 0u) {
    normal.x = sign;
  } else if (axis == 1u) {
    normal.y = sign;
  } else {
    normal.z = sign;
  }
  return normal;
}

fn mechanical_matching_constraint_face_active(
  current_delta: vec3<f32>,
  low_edge_m: f32,
  high_edge_m: f32,
  constraint_normal: vec3<f32>
) -> bool {
  let half_sum_m = 0.5 * (low_edge_m + high_edge_m);
  var normal_axis = 0u;
  if (abs(constraint_normal.y) > abs(constraint_normal.x)) {
    normal_axis = 1u;
  }
  if (
    abs(constraint_normal.z)
      > select(
        abs(constraint_normal.x),
        abs(constraint_normal.y),
        normal_axis == 1u
      )
  ) {
    normal_axis = 2u;
  }
  var tangent_a_m = current_delta.y;
  var tangent_b_m = current_delta.z;
  if (normal_axis == 1u) {
    tangent_a_m = current_delta.x;
    tangent_b_m = current_delta.z;
  } else if (normal_axis == 2u) {
    tangent_a_m = current_delta.x;
    tangent_b_m = current_delta.y;
  }
  let tangent_zero_tolerance_m =
    mechanical_solver_aabb_tangent_zero_tolerance_m(
      current_delta,
      low_edge_m,
      high_edge_m
    );
  return dot(current_delta, constraint_normal)
      <= half_sum_m
        + mechanical_solver_aabb_normal_roundoff_tolerance_m(
          current_delta,
          low_edge_m,
          high_edge_m
        )
    && half_sum_m - abs(tangent_a_m) > tangent_zero_tolerance_m
    && half_sum_m - abs(tangent_b_m) > tangent_zero_tolerance_m;
}

fn mechanical_matching_positive_constraint_swept_active(
  low_index: u32,
  high_index: u32,
  current_delta: vec3<f32>,
  low_edge_m: f32,
  high_edge_m: f32,
  constraint_normal: vec3<f32>
) -> bool {
  let epoch_delta = mechanical_solver_epoch_position(low_index)
    - mechanical_solver_epoch_position(high_index);
  let swept_contact = mechanical_solver_finite_volume_contact(
    low_index,
    high_index,
    current_delta,
    epoch_delta,
    low_edge_m,
    high_edge_m
  );
  return swept_contact.admitted != 0u
    && swept_contact.swept_contact != 0u
    && dot(swept_contact.normal, constraint_normal) > 1.0 - 1.0e-6;
}

fn mechanical_matching_separating_normal(
  low_index: u32,
  high_index: u32,
  current_delta: vec3<f32>
) -> vec3<f32> {
  let coincidence_normal = mechanical_solver_coincidence_normal(
    low_index,
    high_index
  );
  let source = select(
    coincidence_normal,
    current_delta,
    length(current_delta) > 1.0e-12
  );
  var axis = 0u;
  if (abs(source.y) > abs(source.x)) { axis = 1u; }
  if (
    abs(source.z)
      > select(abs(source.x), abs(source.y), axis == 1u)
  ) { axis = 2u; }
  let component = select(
    source.x,
    select(source.y, source.z, axis == 2u),
    axis != 0u
  );
  let sign = select(-1.0, 1.0, component >= 0.0);
  var normal = vec3<f32>(0.0);
  if (axis == 0u) {
    normal.x = sign;
  } else if (axis == 1u) {
    normal.y = sign;
  } else {
    normal.z = sign;
  }
  return normal;
}

fn mechanical_matching_constraint_pair(
  low_index: u32,
  high_index: u32,
  constraint_cursor: u32
) -> MechanicalPairResidual {
  let constraint = matching_constraints[constraint_cursor];
  if (all(constraint == vec4<f32>(0.0))) {
    return mechanical_solver_zero_pair(1u);
  }
  let low_pos_mass = input_state[low_index * 2u];
  let high_pos_mass = input_state[high_index * 2u];
  let low_volume = max(source_mechanics[low_index * 8u + 4u].w, 0.0);
  let high_volume = max(source_mechanics[high_index * 8u + 4u].w, 0.0);
  if (
    low_pos_mass.w <= 0.0
    || high_pos_mass.w <= 0.0
    || low_volume <= 0.0
    || high_volume <= 0.0
    || !mechanical_solver_finite3(constraint.xyz)
    || !mechanical_matching_constraint_code_valid(constraint)
  ) {
    return mechanical_solver_zero_pair(0u);
  }
  let constraint_normal = mechanical_matching_constraint_normal(constraint);
  let response_normal = constraint.xyz;
  let response_projection = dot(response_normal, constraint_normal);
  let response_normal_length = length(response_normal);
  let current_delta = low_pos_mass.xyz - high_pos_mass.xyz;
  let low_edge_m = mechanical_solver_cbrt(low_volume);
  let high_edge_m = mechanical_solver_cbrt(high_volume);
  let support_distance_m = 0.5 * (low_edge_m + high_edge_m);
  let overlap_m = max(
    support_distance_m - dot(current_delta, constraint_normal),
    0.0
  );
  if (
    !mechanical_solver_finite3(constraint_normal)
    || !mechanical_solver_finite(response_normal_length)
    || abs(response_normal_length - 1.0) > 1.0e-3
    || !mechanical_solver_finite(response_projection)
    || response_projection <= 1.0e-6
    || !mechanical_solver_finite3(current_delta)
    || !mechanical_solver_finite(support_distance_m)
    || !mechanical_solver_finite(overlap_m)
  ) {
    return mechanical_solver_zero_pair(0u);
  }
  // Both initially admitted and dormant constraints describe finite faces.
  // Keeping a positive constraint as an infinite halfspace after tangential
  // support is lost produces equal-and-opposite lateral impulses between
  // already-disjoint cells.
  let current_face_active = mechanical_matching_constraint_face_active(
    current_delta,
    low_edge_m,
    high_edge_m,
    constraint_normal
  );
  let positive_swept_face_active = constraint.w > 0.0
    && !current_face_active
    && mechanical_matching_positive_constraint_swept_active(
      low_index,
      high_index,
      current_delta,
      low_edge_m,
      high_edge_m,
      constraint_normal
    );
  if (!current_face_active && !positive_swept_face_active) {
    return mechanical_solver_zero_pair(1u);
  }
  let fixed_pair = mechanical_solver_pair_response(
    low_index,
    high_index,
    low_pos_mass.w,
    high_pos_mass.w,
    overlap_m,
    constraint_normal,
    response_normal,
    response_projection,
    true,
    false
  );
  if (
    fixed_pair.valid == 0u
    || !mechanical_solver_finite3(fixed_pair.barrier_dx)
    || !mechanical_solver_finite3(fixed_pair.barrier_dv)
    || !mechanical_solver_finite(fixed_pair.position_residual)
    || !mechanical_solver_finite(fixed_pair.velocity_residual)
  ) {
    return mechanical_solver_zero_pair(0u);
  }
  return fixed_pair;
}

fn mechanical_matching_project_wall_velocity(
  particle_index: u32,
  position: vec3<f32>,
  input_velocity: vec3<f32>,
  mass_kg: f32
) -> MechanicalMatchingWallVelocityProjection {
  var velocity = input_velocity;
  var clipped = 0u;
  let rest_volume = max(
    source_mechanics[particle_index * 8u + 4u].w,
    0.0
  );
  var wall_clearance = 0.0;
  if (rest_volume > 0.0) {
    wall_clearance = 0.5 * mechanical_solver_cbrt(rest_volume);
    if (mechanical_params.grid_spacing_m > 0.0) {
      wall_clearance = min(
        wall_clearance,
        0.5 * mechanical_params.grid_spacing_m
      );
    }
    let min_dimension = min(
      mechanical_params.box_dims_m.x,
      min(mechanical_params.box_dims_m.y, mechanical_params.box_dims_m.z)
    );
    if (min_dimension > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dimension);
    }
  }
  let lower = vec3<f32>(wall_clearance);
  let upper = max(lower, mechanical_params.box_dims_m - lower);
  let lower_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(lower.x, upper.x),
    mechanical_solver_wall_boundary_tolerance_m(lower.y, upper.y),
    mechanical_solver_wall_boundary_tolerance_m(lower.z, upper.z)
  );
  let upper_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(upper.x, lower.x),
    mechanical_solver_wall_boundary_tolerance_m(upper.y, lower.y),
    mechanical_solver_wall_boundary_tolerance_m(upper.z, lower.z)
  );
  if (
    position.x <= lower.x + lower_tolerance_m.x
    && velocity.x < 0.0
  ) {
    velocity.x = 0.0;
    clipped = 1u;
  } else if (
    position.x >= upper.x - upper_tolerance_m.x
    && velocity.x > 0.0
  ) {
    velocity.x = 0.0;
    clipped = 1u;
  }
  if (
    position.y <= lower.y + lower_tolerance_m.y
    && velocity.y < 0.0
  ) {
    velocity.y = 0.0;
    clipped = 1u;
  } else if (
    position.y >= upper.y - upper_tolerance_m.y
    && velocity.y > 0.0
  ) {
    velocity.y = 0.0;
    clipped = 1u;
  }
  if (
    position.z <= lower.z + lower_tolerance_m.z
    && velocity.z < 0.0
  ) {
    velocity.z = 0.0;
    clipped = 1u;
  } else if (
    position.z >= upper.z - upper_tolerance_m.z
    && velocity.z > 0.0
  ) {
    velocity.z = 0.0;
    clipped = 1u;
  }
  let kinetic_delta_j = 0.5 * mass_kg * (
    dot(velocity, velocity) - dot(input_velocity, input_velocity)
  );
  let kinetic_conditioning_j = 0.5 * mass_kg * (
    dot(velocity, velocity) + dot(input_velocity, input_velocity)
  );
  let kinetic_tolerance_j = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(kinetic_conditioning_j, 1.0)
  );
  let valid = select(
    0u,
    1u,
    mass_kg > 0.0
      && mechanical_solver_finite3(position)
      && mechanical_solver_finite3(velocity)
      && mechanical_solver_finite(kinetic_delta_j)
      && kinetic_delta_j <= kinetic_tolerance_j
  );
  let failure_code = select(
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
    mechanical_solver_finite(kinetic_delta_j)
      && kinetic_delta_j > kinetic_tolerance_j
  );
  return MechanicalMatchingWallVelocityProjection(
    velocity,
    kinetic_delta_j,
    clipped,
    failure_code,
    valid
  );
}

fn mechanical_matching_relative_velocity_delta(
  relative_velocity: vec3<f32>,
  constraint: vec4<f32>
) -> vec3<f32> {
  let constraint_normal =
    mechanical_matching_constraint_normal(constraint);
  let response_normal = constraint.xyz;
  let response_projection = dot(response_normal, constraint_normal);
  let approach_m_per_s = dot(relative_velocity, constraint_normal);
  if (approach_m_per_s >= 0.0) { return vec3<f32>(0.0); }
  var relative_dv =
    -approach_m_per_s
      / max(response_projection, 1.0e-6)
      * response_normal;
  let central_linear_work_speed_squared = dot(
    relative_velocity,
    relative_dv
  );
  let kinetic_delta_speed_squared =
    2.0 * central_linear_work_speed_squared
      + dot(relative_dv, relative_dv);
  let kinetic_tolerance_speed_squared =
    64.0 * 1.1920929e-7
      * max(dot(relative_velocity, relative_velocity), 1.0);
  if (
    central_linear_work_speed_squared > 0.0
    || kinetic_delta_speed_squared > kinetic_tolerance_speed_squared
  ) {
    let radial_dv = max(
      -dot(relative_velocity, response_normal),
      0.0
    ) * response_normal;
    let velocity_after_radial = relative_velocity + radial_dv;
    let face_dv = max(
      -dot(velocity_after_radial, constraint_normal),
      0.0
    ) * constraint_normal;
    relative_dv = radial_dv + face_dv;
  }
  return relative_dv;
}

fn mechanical_matching_refine_wall_velocity_pair(
  low_index: u32,
  high_index: u32,
  low_position: vec3<f32>,
  high_position: vec3<f32>,
  low_initial_velocity: vec3<f32>,
  high_initial_velocity: vec3<f32>,
  low_mass_kg: f32,
  high_mass_kg: f32,
  low_initial_dv: vec3<f32>,
  high_initial_dv: vec3<f32>,
  constraint: vec4<f32>
) -> MechanicalMatchingVelocityRefinement {
  var result = MechanicalMatchingVelocityRefinement(
    low_initial_velocity,
    high_initial_velocity,
    0.0,
    0.0,
    0.0,
    0.0,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0u,
    0u,
    1u
  );
  let constraint_normal =
    mechanical_matching_constraint_normal(constraint);
  let response_normal = constraint.xyz;
  let response_projection = dot(response_normal, constraint_normal);
  let pair_mass_kg = low_mass_kg + high_mass_kg;
  if (
    !(low_mass_kg > 0.0)
    || !(high_mass_kg > 0.0)
    || !(pair_mass_kg > 0.0)
    || !mechanical_solver_finite3(constraint_normal)
    || !mechanical_solver_finite3(response_normal)
    || !mechanical_solver_finite(response_projection)
    || response_projection <= 1.0e-6
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let low_inverse_mass_share = high_mass_kg / pair_mass_kg;
  var low_velocity = low_initial_velocity;
  var high_velocity = high_initial_velocity;
  var prior_wall_clipped = true;
  for (
    var refinement_round = 0u;
    refinement_round
      < ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_WALL_REFINEMENT_ROUNDS}u;
    refinement_round = refinement_round + 1u
  ) {
    let relative_velocity = low_velocity - high_velocity;
    let approach_m_per_s = dot(relative_velocity, constraint_normal);
    if (
      refinement_round > 0u
      && (
        !prior_wall_clipped
        || approach_m_per_s >= -${
          SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
            .toExponential(1)
        }
      )
    ) {
      break;
    }
    var low_dv = low_initial_dv;
    var high_dv = high_initial_dv;
    if (refinement_round > 0u) {
      let relative_dv = mechanical_matching_relative_velocity_delta(
        relative_velocity,
        constraint
      );
      low_dv = low_inverse_mass_share * relative_dv;
      high_dv = -(low_mass_kg / high_mass_kg) * low_dv;
    }
    let low_pair_velocity = low_velocity + low_dv;
    let high_pair_velocity = high_velocity + high_dv;
    let pair_momentum_residual =
      low_mass_kg * low_dv + high_mass_kg * high_dv;
    let pair_momentum_conditioning =
      low_mass_kg * length(low_dv)
        + high_mass_kg * length(high_dv);
    let pair_momentum_tolerance = max(
      1.0e-6,
      128.0 * 1.1920929e-7 * max(pair_momentum_conditioning, 1.0)
    );
    let low_pair_kinetic_delta_j = 0.5 * low_mass_kg * (
      dot(low_pair_velocity, low_pair_velocity)
        - dot(low_velocity, low_velocity)
    );
    let high_pair_kinetic_delta_j = 0.5 * high_mass_kg * (
      dot(high_pair_velocity, high_pair_velocity)
        - dot(high_velocity, high_velocity)
    );
    let pair_kinetic_delta_j =
      low_pair_kinetic_delta_j + high_pair_kinetic_delta_j;
    let pair_kinetic_conditioning_j =
      0.5 * low_mass_kg * (
        dot(low_pair_velocity, low_pair_velocity)
          + dot(low_velocity, low_velocity)
      )
      + 0.5 * high_mass_kg * (
        dot(high_pair_velocity, high_pair_velocity)
          + dot(high_velocity, high_velocity)
      );
    let pair_kinetic_tolerance_j = max(
      1.0e-6,
      128.0 * 1.1920929e-7 * max(pair_kinetic_conditioning_j, 1.0)
    );
    if (
      !mechanical_solver_finite3(low_pair_velocity)
      || !mechanical_solver_finite3(high_pair_velocity)
      || !mechanical_solver_finite3(pair_momentum_residual)
      || length(pair_momentum_residual) > pair_momentum_tolerance
      || !mechanical_solver_finite(low_pair_kinetic_delta_j)
      || !mechanical_solver_finite(high_pair_kinetic_delta_j)
      || !mechanical_solver_finite(pair_kinetic_delta_j)
      || pair_kinetic_delta_j > pair_kinetic_tolerance_j
    ) {
      result.failure_code = select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
        mechanical_solver_finite(pair_kinetic_delta_j)
          && pair_kinetic_delta_j > pair_kinetic_tolerance_j
      );
      result.valid = 0u;
      break;
    }
    result.low_pair_kinetic_delta_j =
      result.low_pair_kinetic_delta_j + low_pair_kinetic_delta_j;
    result.high_pair_kinetic_delta_j =
      result.high_pair_kinetic_delta_j + high_pair_kinetic_delta_j;
    result.low_pair_impulse =
      result.low_pair_impulse + low_mass_kg * low_dv;
    result.high_pair_impulse =
      result.high_pair_impulse + high_mass_kg * high_dv;
    let low_wall = mechanical_matching_project_wall_velocity(
      low_index,
      low_position,
      low_pair_velocity,
      low_mass_kg
    );
    let high_wall = mechanical_matching_project_wall_velocity(
      high_index,
      high_position,
      high_pair_velocity,
      high_mass_kg
    );
    if (low_wall.valid == 0u || high_wall.valid == 0u) {
      result.failure_code = select(
        high_wall.failure_code,
        low_wall.failure_code,
        low_wall.valid == 0u
      );
      result.valid = 0u;
      break;
    }
    result.low_wall_kinetic_delta_j =
      result.low_wall_kinetic_delta_j + low_wall.kinetic_delta_j;
    result.high_wall_kinetic_delta_j =
      result.high_wall_kinetic_delta_j + high_wall.kinetic_delta_j;
    low_velocity = low_wall.velocity;
    high_velocity = high_wall.velocity;
    result.round_count = result.round_count + 1u;
    prior_wall_clipped = low_wall.clipped != 0u || high_wall.clipped != 0u;
  }
  result.low_velocity = low_velocity;
  result.high_velocity = high_velocity;
  if (result.valid == 0u) { return result; }
  let aggregate_pair_kinetic_delta_j =
    result.low_pair_kinetic_delta_j
      + result.high_pair_kinetic_delta_j;
  let aggregate_pair_momentum_residual =
    result.low_pair_impulse + result.high_pair_impulse;
  let aggregate_pair_momentum_conditioning =
    length(result.low_pair_impulse) + length(result.high_pair_impulse);
  let aggregate_pair_momentum_tolerance = max(
    1.0e-6,
    128.0 * 1.1920929e-7
      * max(aggregate_pair_momentum_conditioning, 1.0)
  );
  let aggregate_kinetic_conditioning_j =
    0.5 * low_mass_kg * (
      dot(low_initial_velocity, low_initial_velocity)
        + dot(result.low_velocity, result.low_velocity)
    )
    + 0.5 * high_mass_kg * (
      dot(high_initial_velocity, high_initial_velocity)
        + dot(result.high_velocity, result.high_velocity)
    );
  let aggregate_kinetic_tolerance_j = max(
    1.0e-6,
    128.0 * 1.1920929e-7 * max(aggregate_kinetic_conditioning_j, 1.0)
  );
  if (
    result.round_count == 0u
    || !mechanical_solver_finite3(result.low_velocity)
    || !mechanical_solver_finite3(result.high_velocity)
    || !mechanical_solver_finite3(result.low_pair_impulse)
    || !mechanical_solver_finite3(result.high_pair_impulse)
    || !mechanical_solver_finite3(aggregate_pair_momentum_residual)
    || length(aggregate_pair_momentum_residual)
      > aggregate_pair_momentum_tolerance
    || !mechanical_solver_finite(aggregate_pair_kinetic_delta_j)
    || aggregate_pair_kinetic_delta_j > aggregate_kinetic_tolerance_j
    || !mechanical_solver_finite(result.low_wall_kinetic_delta_j)
    || !mechanical_solver_finite(result.high_wall_kinetic_delta_j)
    || result.low_wall_kinetic_delta_j > aggregate_kinetic_tolerance_j
    || result.high_wall_kinetic_delta_j > aggregate_kinetic_tolerance_j
  ) {
    result.failure_code = select(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
      (
        mechanical_solver_finite(aggregate_pair_kinetic_delta_j)
        && aggregate_pair_kinetic_delta_j
          > aggregate_kinetic_tolerance_j
      )
        || (
          mechanical_solver_finite(result.low_wall_kinetic_delta_j)
          && result.low_wall_kinetic_delta_j
            > aggregate_kinetic_tolerance_j
        )
        || (
          mechanical_solver_finite(result.high_wall_kinetic_delta_j)
          && result.high_wall_kinetic_delta_j
            > aggregate_kinetic_tolerance_j
        )
    );
    result.valid = 0u;
  }
  return result;
}

fn mechanical_matching_zero_three_block() ->
  MechanicalMatchingThreeBlockResult {
  return MechanicalMatchingThreeBlockResult(
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    vec3<f32>(0.0),
    0.0,
    0.0,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0u,
    0u,
    0u,
    0u,
    1u,
    0u,
    0u
  );
}

fn mechanical_matching_center_oriented_vector(
  center_index: u32,
  other_index: u32,
  canonical_vector: vec3<f32>
) -> vec3<f32> {
  return select(
    -canonical_vector,
    canonical_vector,
    center_index == min(center_index, other_index)
  );
}

fn mechanical_matching_axis_wall_constraint(
  particle_index: u32,
  position: vec3<f32>,
  axis_normal: vec3<f32>
) -> MechanicalMatchingAxisWallConstraint {
  var result = MechanicalMatchingAxisWallConstraint(0.0, 0u, 1u);
  if (
    particle_index >= mechanical_params.particle_count
    || !mechanical_solver_finite3(position)
    || !mechanical_solver_finite3(axis_normal)
    || !mechanical_solver_finite3(mechanical_params.box_dims_m)
  ) {
    result.valid = 0u;
    return result;
  }
  var axis = 0u;
  if (abs(axis_normal.y) > abs(axis_normal.x)) { axis = 1u; }
  if (
    abs(axis_normal.z)
      > select(abs(axis_normal.x), abs(axis_normal.y), axis == 1u)
  ) { axis = 2u; }
  let normal_component = select(
    axis_normal.x,
    select(axis_normal.y, axis_normal.z, axis == 2u),
    axis != 0u
  );
  let position_component = select(
    position.x,
    select(position.y, position.z, axis == 2u),
    axis != 0u
  );
  let box_component = select(
    mechanical_params.box_dims_m.x,
    select(
      mechanical_params.box_dims_m.y,
      mechanical_params.box_dims_m.z,
      axis == 2u
    ),
    axis != 0u
  );
  let rest_volume =
    source_mechanics[particle_index * 8u + 4u].w;
  if (
    abs(abs(normal_component) - 1.0) > 1.0e-6
    || !mechanical_solver_finite(position_component)
    || !mechanical_solver_finite(box_component)
    || !mechanical_solver_finite(rest_volume)
    || box_component <= 0.0
    || rest_volume < 0.0
  ) {
    result.valid = 0u;
    return result;
  }
  var wall_clearance = 0.0;
  if (rest_volume > 0.0) {
    wall_clearance = 0.5 * mechanical_solver_cbrt(rest_volume);
    if (mechanical_params.grid_spacing_m > 0.0) {
      wall_clearance = min(
        wall_clearance,
        0.5 * mechanical_params.grid_spacing_m
      );
    }
    let min_dimension = min(
      mechanical_params.box_dims_m.x,
      min(mechanical_params.box_dims_m.y, mechanical_params.box_dims_m.z)
    );
    if (min_dimension > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dimension);
    }
  }
  let lower = wall_clearance;
  let upper = max(lower, box_component - wall_clearance);
  let lower_tolerance_m =
    mechanical_solver_wall_boundary_tolerance_m(lower, upper);
  let upper_tolerance_m =
    mechanical_solver_wall_boundary_tolerance_m(upper, lower);
  let at_lower = position_component <= lower + lower_tolerance_m;
  let at_upper = position_component >= upper - upper_tolerance_m;
  if (at_lower && at_upper) {
    result.valid = 0u;
    return result;
  }
  if (at_lower) {
    result.inward_scalar_sign = normal_component;
    result.geometry_active = 1u;
  } else if (at_upper) {
    result.inward_scalar_sign = -normal_component;
    result.geometry_active = 1u;
  }
  return result;
}

fn mechanical_matching_axis_contact_normal_valid(
  normal: vec3<f32>
) -> bool {
  if (!mechanical_solver_finite3(normal)) { return false; }
  let abs_normal = abs(normal);
  let x_valid =
    abs_normal.x <= 1.0e-6 || abs(abs_normal.x - 1.0) <= 1.0e-6;
  let y_valid =
    abs_normal.y <= 1.0e-6 || abs(abs_normal.y - 1.0) <= 1.0e-6;
  let z_valid =
    abs_normal.z <= 1.0e-6 || abs(abs_normal.z - 1.0) <= 1.0e-6;
  return x_valid
    && y_valid
    && z_valid
    && abs(abs_normal.x + abs_normal.y + abs_normal.z - 1.0)
      <= 1.0e-6;
}

// Materialize the primal velocity of one enumerated scalar active set from its
// connected components. Broadcasting one shared f32 value makes every active
// contact equality bit-identical instead of accepting inverse-mass roundoff
// under a tolerance wider than the public residual certificate.
fn mechanical_matching_three_block_axis_primal(
  primary_wall_fixed: bool,
  center_wall_fixed: bool,
  secondary_wall_fixed: bool,
  primary_contact_active: bool,
  secondary_contact_active: bool,
  masses_kg: vec3<f32>,
  input_u: vec3<f32>
) -> vec3<f32> {
  if (primary_contact_active && secondary_contact_active) {
    if (
      primary_wall_fixed
      || center_wall_fixed
      || secondary_wall_fixed
    ) {
      return vec3<f32>(0.0);
    }
    let shared_u = (
      masses_kg.x * input_u.x
        + masses_kg.y * input_u.y
        + masses_kg.z * input_u.z
    ) / (masses_kg.x + masses_kg.y + masses_kg.z);
    return vec3<f32>(shared_u);
  }
  if (primary_contact_active) {
    let primary_center_u = select(
      (
        masses_kg.x * input_u.x
          + masses_kg.y * input_u.y
      ) / (masses_kg.x + masses_kg.y),
      0.0,
      primary_wall_fixed || center_wall_fixed
    );
    return vec3<f32>(
      primary_center_u,
      primary_center_u,
      select(input_u.z, 0.0, secondary_wall_fixed)
    );
  }
  if (secondary_contact_active) {
    let center_secondary_u = select(
      (
        masses_kg.y * input_u.y
          + masses_kg.z * input_u.z
      ) / (masses_kg.y + masses_kg.z),
      0.0,
      center_wall_fixed || secondary_wall_fixed
    );
    return vec3<f32>(
      select(input_u.x, 0.0, primary_wall_fixed),
      center_secondary_u,
      center_secondary_u
    );
  }
  return vec3<f32>(
    select(input_u.x, 0.0, primary_wall_fixed),
    select(input_u.y, 0.0, center_wall_fixed),
    select(input_u.z, 0.0, secondary_wall_fixed)
  );
}

// Project one Cartesian lane of a three-particle contact block onto its two
// signed contact halfspaces and three box-wall halfspaces. Frozen finite-volume
// faces and box walls are exact coordinate axes, so the full mass-metric cone
// projection is the product of three independent scalar projections.
fn mechanical_matching_three_block_axis_active_set(
  primary_index: u32,
  center_index: u32,
  secondary_index: u32,
  primary_position: vec3<f32>,
  center_position: vec3<f32>,
  secondary_position: vec3<f32>,
  axis_normal: vec3<f32>,
  primary_contact_sign: f32,
  secondary_contact_sign: f32,
  primary_mass_kg: f32,
  center_mass_kg: f32,
  secondary_mass_kg: f32,
  primary_u: f32,
  center_u: f32,
  secondary_u: f32,
  velocity_tolerance_m_per_s: f32
) -> MechanicalMatchingAxisActiveSetResult {
  var result = MechanicalMatchingAxisActiveSetResult(
    primary_u,
    center_u,
    secondary_u,
    0.0,
    0.0,
    0u,
    0u
  );
  let primary_sign_valid =
    abs(primary_contact_sign) <= 1.0e-6
      || abs(abs(primary_contact_sign) - 1.0) <= 1.0e-6;
  let secondary_sign_valid =
    abs(secondary_contact_sign) <= 1.0e-6
      || abs(abs(secondary_contact_sign) - 1.0) <= 1.0e-6;
  if (
    !primary_sign_valid
    || !secondary_sign_valid
    || !mechanical_solver_finite(primary_mass_kg)
    || !mechanical_solver_finite(center_mass_kg)
    || !mechanical_solver_finite(secondary_mass_kg)
    || !(primary_mass_kg > 0.0)
    || !(center_mass_kg > 0.0)
    || !(secondary_mass_kg > 0.0)
    || !mechanical_solver_finite(primary_u)
    || !mechanical_solver_finite(center_u)
    || !mechanical_solver_finite(secondary_u)
    || !mechanical_solver_finite(velocity_tolerance_m_per_s)
  ) { return result; }
  let primary_wall_constraint =
    mechanical_matching_axis_wall_constraint(
      primary_index,
      primary_position,
      axis_normal
    );
  let center_wall_constraint =
    mechanical_matching_axis_wall_constraint(
      center_index,
      center_position,
      axis_normal
    );
  let secondary_wall_constraint =
    mechanical_matching_axis_wall_constraint(
      secondary_index,
      secondary_position,
      axis_normal
    );
  if (
    primary_wall_constraint.valid == 0u
    || center_wall_constraint.valid == 0u
    || secondary_wall_constraint.valid == 0u
  ) { return result; }
  let primary_contact_present = abs(primary_contact_sign) > 0.5;
  let secondary_contact_present = abs(secondary_contact_sign) > 0.5;
  let primary_inverse_mass = 1.0 / primary_mass_kg;
  let center_inverse_mass = 1.0 / center_mass_kg;
  let secondary_inverse_mass = 1.0 / secondary_mass_kg;
  let velocity_conditioning = max(
    max(abs(primary_u), abs(center_u)),
    max(abs(secondary_u), 1.0)
  );
  let arithmetic_tolerance_m_per_s = max(
    velocity_tolerance_m_per_s,
    128.0 * 1.1920929e-7 * velocity_conditioning
  );
  let impulse_conditioning = (
    primary_mass_kg + center_mass_kg + secondary_mass_kg
  ) * velocity_conditioning;
  let impulse_tolerance = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(impulse_conditioning, 1.0e-6)
  );
  if (
    !mechanical_solver_finite(primary_inverse_mass)
    || !mechanical_solver_finite(center_inverse_mass)
    || !mechanical_solver_finite(secondary_inverse_mass)
    || !mechanical_solver_finite(arithmetic_tolerance_m_per_s)
    || !mechanical_solver_finite(impulse_tolerance)
  ) { return result; }
  var best_found = false;
  var best_objective = 3.0e38;
  for (
    var wall_mask = 0u;
    wall_mask < 8u;
    wall_mask = wall_mask + 1u
  ) {
    let primary_wall_fixed = (wall_mask & 1u) != 0u;
    let center_wall_fixed = (wall_mask & 2u) != 0u;
    let secondary_wall_fixed = (wall_mask & 4u) != 0u;
    if (
      (primary_wall_fixed && primary_wall_constraint.geometry_active == 0u)
      || (center_wall_fixed && center_wall_constraint.geometry_active == 0u)
      || (
        secondary_wall_fixed
        && secondary_wall_constraint.geometry_active == 0u
      )
    ) { continue; }
    let primary_q = select(primary_u, 0.0, primary_wall_fixed);
    let center_q = select(center_u, 0.0, center_wall_fixed);
    let secondary_q = select(secondary_u, 0.0, secondary_wall_fixed);
    let primary_d = select(
      primary_inverse_mass,
      0.0,
      primary_wall_fixed
    );
    let center_d = select(
      center_inverse_mass,
      0.0,
      center_wall_fixed
    );
    let secondary_d = select(
      secondary_inverse_mass,
      0.0,
      secondary_wall_fixed
    );
    let primary_residual =
      primary_contact_sign * (center_q - primary_q);
    let secondary_residual =
      secondary_contact_sign * (center_q - secondary_q);
    let matrix_11 = primary_d + center_d;
    let matrix_22 = center_d + secondary_d;
    let matrix_12 =
      primary_contact_sign * secondary_contact_sign * center_d;
    for (
      var contact_mask = 0u;
      contact_mask < 4u;
      contact_mask = contact_mask + 1u
    ) {
      let primary_contact_active = (contact_mask & 1u) != 0u;
      let secondary_contact_active = (contact_mask & 2u) != 0u;
      if (
        (primary_contact_active && !primary_contact_present)
        || (secondary_contact_active && !secondary_contact_present)
      ) { continue; }
      var candidate_valid = true;
      var primary_lambda = 0.0;
      var secondary_lambda = 0.0;
      if (primary_contact_active && secondary_contact_active) {
        let determinant =
          matrix_11 * matrix_22 - matrix_12 * matrix_12;
        let determinant_conditioning =
          abs(matrix_11 * matrix_22) + abs(matrix_12 * matrix_12);
        let determinant_tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7
            * max(determinant_conditioning, 1.0e-12)
        );
        if (
          mechanical_solver_finite(determinant)
          && determinant > determinant_tolerance
        ) {
          primary_lambda = (
            -primary_residual * matrix_22
              + matrix_12 * secondary_residual
          ) / determinant;
          secondary_lambda = (
            -matrix_11 * secondary_residual
              + matrix_12 * primary_residual
          ) / determinant;
        } else if (
          abs(primary_residual) > arithmetic_tolerance_m_per_s
          || abs(secondary_residual) > arithmetic_tolerance_m_per_s
        ) {
          candidate_valid = false;
        }
      } else if (primary_contact_active) {
        let diagonal_tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(abs(matrix_11), 1.0e-12)
        );
        if (matrix_11 > diagonal_tolerance) {
          primary_lambda = -primary_residual / matrix_11;
        } else if (
          abs(primary_residual) > arithmetic_tolerance_m_per_s
        ) {
          candidate_valid = false;
        }
      } else if (secondary_contact_active) {
        let diagonal_tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(abs(matrix_22), 1.0e-12)
        );
        if (matrix_22 > diagonal_tolerance) {
          secondary_lambda = -secondary_residual / matrix_22;
        } else if (
          abs(secondary_residual) > arithmetic_tolerance_m_per_s
        ) {
          candidate_valid = false;
        }
      }
      if (
        !candidate_valid
        || !mechanical_solver_finite(primary_lambda)
        || !mechanical_solver_finite(secondary_lambda)
        || primary_lambda < -impulse_tolerance
        || secondary_lambda < -impulse_tolerance
      ) { continue; }
      primary_lambda = max(0.0, primary_lambda);
      secondary_lambda = max(0.0, secondary_lambda);
      let primary_pair_impulse =
        -primary_contact_sign * primary_lambda;
      let center_pair_impulse =
        primary_contact_sign * primary_lambda
          + secondary_contact_sign * secondary_lambda;
      let secondary_pair_impulse =
        -secondary_contact_sign * secondary_lambda;
      let candidate_u = mechanical_matching_three_block_axis_primal(
        primary_wall_fixed,
        center_wall_fixed,
        secondary_wall_fixed,
        primary_contact_active,
        secondary_contact_active,
        vec3<f32>(
          primary_mass_kg,
          center_mass_kg,
          secondary_mass_kg
        ),
        vec3<f32>(primary_u, center_u, secondary_u)
      );
      let candidate_primary_u = candidate_u.x;
      let candidate_center_u = candidate_u.y;
      let candidate_secondary_u = candidate_u.z;
      let candidate_primary_residual =
        primary_contact_sign
          * (candidate_center_u - candidate_primary_u);
      let candidate_secondary_residual =
        secondary_contact_sign
          * (candidate_center_u - candidate_secondary_u);
      var contact_feasible = true;
      if (primary_contact_present) {
        contact_feasible = contact_feasible && select(
          candidate_primary_residual >= -velocity_tolerance_m_per_s,
          abs(candidate_primary_residual)
            <= velocity_tolerance_m_per_s,
          primary_contact_active
        );
      }
      if (secondary_contact_present) {
        contact_feasible = contact_feasible && select(
          candidate_secondary_residual >= -velocity_tolerance_m_per_s,
          abs(candidate_secondary_residual)
            <= velocity_tolerance_m_per_s,
          secondary_contact_active
        );
      }
      if (!contact_feasible) { continue; }
      let primary_total_impulse =
        primary_mass_kg * (candidate_primary_u - primary_u);
      let center_total_impulse =
        center_mass_kg * (candidate_center_u - center_u);
      let secondary_total_impulse =
        secondary_mass_kg * (candidate_secondary_u - secondary_u);
      let primary_wall_impulse =
        primary_total_impulse - primary_pair_impulse;
      let center_wall_impulse =
        center_total_impulse - center_pair_impulse;
      let secondary_wall_impulse =
        secondary_total_impulse - secondary_pair_impulse;
      var wall_feasible = true;
      if (primary_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_primary_u) <= velocity_tolerance_m_per_s
          && primary_wall_constraint.inward_scalar_sign
            * primary_wall_impulse >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(primary_wall_impulse) <= impulse_tolerance;
        if (primary_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && primary_wall_constraint.inward_scalar_sign
              * candidate_primary_u >= -velocity_tolerance_m_per_s;
        }
      }
      if (center_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_center_u) <= velocity_tolerance_m_per_s
          && center_wall_constraint.inward_scalar_sign
            * center_wall_impulse >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(center_wall_impulse) <= impulse_tolerance;
        if (center_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && center_wall_constraint.inward_scalar_sign
              * candidate_center_u >= -velocity_tolerance_m_per_s;
        }
      }
      if (secondary_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_secondary_u) <= velocity_tolerance_m_per_s
          && secondary_wall_constraint.inward_scalar_sign
            * secondary_wall_impulse >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(secondary_wall_impulse) <= impulse_tolerance;
        if (secondary_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && secondary_wall_constraint.inward_scalar_sign
              * candidate_secondary_u >= -velocity_tolerance_m_per_s;
        }
      }
      let objective =
        primary_mass_kg
          * (candidate_primary_u - primary_u)
          * (candidate_primary_u - primary_u)
        + center_mass_kg
          * (candidate_center_u - center_u)
          * (candidate_center_u - center_u)
        + secondary_mass_kg
          * (candidate_secondary_u - secondary_u)
          * (candidate_secondary_u - secondary_u);
      if (
        !wall_feasible
        || !mechanical_solver_finite(candidate_primary_u)
        || !mechanical_solver_finite(candidate_center_u)
        || !mechanical_solver_finite(candidate_secondary_u)
        || !mechanical_solver_finite(primary_wall_impulse)
        || !mechanical_solver_finite(center_wall_impulse)
        || !mechanical_solver_finite(secondary_wall_impulse)
        || !mechanical_solver_finite(objective)
      ) { continue; }
      if (!best_found || objective < best_objective) {
        best_found = true;
        best_objective = objective;
        result.primary_u = candidate_primary_u;
        result.center_u = candidate_center_u;
        result.secondary_u = candidate_secondary_u;
        result.primary_lambda = primary_lambda;
        result.secondary_lambda = secondary_lambda;
        result.wall_mask = wall_mask;
      }
    }
  }
  result.valid = select(0u, 1u, best_found);
  return result;
}

fn mechanical_matching_wall_energy_allocation(
  wall_kinetic_delta_j: f32,
  masses_kg: vec3<f32>,
  wall_mask: u32,
  kinetic_tolerance_j: f32
) -> vec4<f32> {
  var allocation = vec4<f32>(0.0, 0.0, 0.0, 1.0);
  if (
    !mechanical_solver_finite(wall_kinetic_delta_j)
    || !mechanical_solver_finite3(masses_kg)
    || !mechanical_solver_finite(kinetic_tolerance_j)
  ) {
    allocation.w = 0.0;
    return allocation;
  }
  if (wall_mask == 0u) {
    if (abs(wall_kinetic_delta_j) > kinetic_tolerance_j) {
      allocation.w = 0.0;
    }
    return allocation;
  }
  let fixed_mass_kg =
    select(0.0, masses_kg.x, (wall_mask & 1u) != 0u)
      + select(0.0, masses_kg.y, (wall_mask & 2u) != 0u)
      + select(0.0, masses_kg.z, (wall_mask & 4u) != 0u);
  if (
    !(fixed_mass_kg > 0.0)
    || !mechanical_solver_finite(fixed_mass_kg)
  ) {
    allocation.w = 0.0;
    return allocation;
  }
  allocation.x = select(
    0.0,
    wall_kinetic_delta_j * masses_kg.x / fixed_mass_kg,
    (wall_mask & 1u) != 0u
  );
  allocation.y = select(
    0.0,
    wall_kinetic_delta_j * masses_kg.y / fixed_mass_kg,
    (wall_mask & 2u) != 0u
  );
  allocation.z = select(
    0.0,
    wall_kinetic_delta_j * masses_kg.z / fixed_mass_kg,
    (wall_mask & 4u) != 0u
  );
  return allocation;
}

// Exact fixed-cost projection for every axis-aligned three-contact/wall
// configuration. Each lane enumerates 8 wall masks x 4 contact masks, so the
// total work is 3 x 8 x 4 candidates independent of particle count or degree.
fn mechanical_matching_three_block_box_wall_active_set(
  seed: MechanicalMatchingThreeBlockResult,
  primary_normal: vec3<f32>,
  secondary_normal: vec3<f32>,
  primary_pos_mass: vec4<f32>,
  center_pos_mass: vec4<f32>,
  secondary_pos_mass: vec4<f32>,
  primary_velocity: vec3<f32>,
  center_velocity: vec3<f32>,
  secondary_velocity: vec3<f32>,
  contact_primary_velocity: vec3<f32>,
  contact_center_velocity: vec3<f32>,
  contact_secondary_velocity: vec3<f32>,
  velocity_tolerance_m_per_s: f32
) -> MechanicalMatchingThreeBlockResult {
  var result = seed;
  if (
    !mechanical_matching_axis_contact_normal_valid(primary_normal)
    || !mechanical_matching_axis_contact_normal_valid(secondary_normal)
    || !mechanical_solver_finite3(primary_velocity)
    || !mechanical_solver_finite3(center_velocity)
    || !mechanical_solver_finite3(secondary_velocity)
    || !mechanical_solver_finite3(contact_primary_velocity)
    || !mechanical_solver_finite3(contact_center_velocity)
    || !mechanical_solver_finite3(contact_secondary_velocity)
  ) { return result; }
  let primary_mass_kg = primary_pos_mass.w;
  let center_mass_kg = center_pos_mass.w;
  let secondary_mass_kg = secondary_pos_mass.w;
  let x_axis = mechanical_matching_three_block_axis_active_set(
    seed.primary_index,
    seed.center_index,
    seed.secondary_index,
    primary_pos_mass.xyz,
    center_pos_mass.xyz,
    secondary_pos_mass.xyz,
    vec3<f32>(1.0, 0.0, 0.0),
    primary_normal.x,
    secondary_normal.x,
    primary_mass_kg,
    center_mass_kg,
    secondary_mass_kg,
    primary_velocity.x,
    center_velocity.x,
    secondary_velocity.x,
    velocity_tolerance_m_per_s
  );
  let y_axis = mechanical_matching_three_block_axis_active_set(
    seed.primary_index,
    seed.center_index,
    seed.secondary_index,
    primary_pos_mass.xyz,
    center_pos_mass.xyz,
    secondary_pos_mass.xyz,
    vec3<f32>(0.0, 1.0, 0.0),
    primary_normal.y,
    secondary_normal.y,
    primary_mass_kg,
    center_mass_kg,
    secondary_mass_kg,
    primary_velocity.y,
    center_velocity.y,
    secondary_velocity.y,
    velocity_tolerance_m_per_s
  );
  let z_axis = mechanical_matching_three_block_axis_active_set(
    seed.primary_index,
    seed.center_index,
    seed.secondary_index,
    primary_pos_mass.xyz,
    center_pos_mass.xyz,
    secondary_pos_mass.xyz,
    vec3<f32>(0.0, 0.0, 1.0),
    primary_normal.z,
    secondary_normal.z,
    primary_mass_kg,
    center_mass_kg,
    secondary_mass_kg,
    primary_velocity.z,
    center_velocity.z,
    secondary_velocity.z,
    velocity_tolerance_m_per_s
  );
  if (x_axis.valid == 0u || y_axis.valid == 0u || z_axis.valid == 0u) {
    return result;
  }
  let resolved_primary_velocity = vec3<f32>(
    x_axis.primary_u,
    y_axis.primary_u,
    z_axis.primary_u
  );
  let resolved_center_velocity = vec3<f32>(
    x_axis.center_u,
    y_axis.center_u,
    z_axis.center_u
  );
  let resolved_secondary_velocity = vec3<f32>(
    x_axis.secondary_u,
    y_axis.secondary_u,
    z_axis.secondary_u
  );
  let primary_impulse = vec3<f32>(
    -primary_normal.x * x_axis.primary_lambda,
    -primary_normal.y * y_axis.primary_lambda,
    -primary_normal.z * z_axis.primary_lambda
  );
  let center_primary_impulse = -primary_impulse;
  let secondary_impulse = vec3<f32>(
    -secondary_normal.x * x_axis.secondary_lambda,
    -secondary_normal.y * y_axis.secondary_lambda,
    -secondary_normal.z * z_axis.secondary_lambda
  );
  let center_secondary_impulse = -secondary_impulse;
  let final_primary_residual = dot(
    resolved_center_velocity - resolved_primary_velocity,
    primary_normal
  );
  let final_secondary_residual = dot(
    resolved_center_velocity - resolved_secondary_velocity,
    secondary_normal
  );
  let pair_momentum_residual =
    primary_impulse
      + center_primary_impulse
      + center_secondary_impulse
      + secondary_impulse;
  let pair_momentum_conditioning =
    length(primary_impulse)
      + length(center_primary_impulse)
      + length(center_secondary_impulse)
      + length(secondary_impulse);
  let pair_momentum_tolerance = max(
    1.0e-10,
    256.0 * 1.1920929e-7
      * max(pair_momentum_conditioning, 1.0e-6)
  );
  if (
    !mechanical_solver_finite3(resolved_primary_velocity)
    || !mechanical_solver_finite3(resolved_center_velocity)
    || !mechanical_solver_finite3(resolved_secondary_velocity)
    || !mechanical_solver_finite3(primary_impulse)
    || !mechanical_solver_finite3(center_primary_impulse)
    || !mechanical_solver_finite3(center_secondary_impulse)
    || !mechanical_solver_finite3(secondary_impulse)
    || !mechanical_solver_finite3(pair_momentum_residual)
    || length(pair_momentum_residual) > pair_momentum_tolerance
    || !mechanical_solver_finite(final_primary_residual)
    || !mechanical_solver_finite(final_secondary_residual)
    || final_primary_residual < -velocity_tolerance_m_per_s
    || final_secondary_residual < -velocity_tolerance_m_per_s
  ) { return result; }
  let resolved_primary_wall = mechanical_matching_project_wall_velocity(
    seed.primary_index,
    primary_pos_mass.xyz,
    resolved_primary_velocity,
    primary_mass_kg
  );
  let resolved_center_wall = mechanical_matching_project_wall_velocity(
    seed.center_index,
    center_pos_mass.xyz,
    resolved_center_velocity,
    center_mass_kg
  );
  let resolved_secondary_wall = mechanical_matching_project_wall_velocity(
    seed.secondary_index,
    secondary_pos_mass.xyz,
    resolved_secondary_velocity,
    secondary_mass_kg
  );
  if (
    resolved_primary_wall.valid == 0u
    || resolved_center_wall.valid == 0u
    || resolved_secondary_wall.valid == 0u
    || resolved_primary_wall.clipped != 0u
    || resolved_center_wall.clipped != 0u
    || resolved_secondary_wall.clipped != 0u
  ) { return result; }
  let primary_pair_kinetic_delta_j = 0.5 * primary_mass_kg * (
    dot(contact_primary_velocity, contact_primary_velocity)
      - dot(primary_velocity, primary_velocity)
  );
  let center_pair_kinetic_delta_j = 0.5 * center_mass_kg * (
    dot(contact_center_velocity, contact_center_velocity)
      - dot(center_velocity, center_velocity)
  );
  let secondary_pair_kinetic_delta_j = 0.5 * secondary_mass_kg * (
    dot(contact_secondary_velocity, contact_secondary_velocity)
      - dot(secondary_velocity, secondary_velocity)
  );
  let pair_kinetic_delta_j =
    primary_pair_kinetic_delta_j
      + center_pair_kinetic_delta_j
      + secondary_pair_kinetic_delta_j;
  let wall_kinetic_delta_x_j = 0.5 * (
    primary_mass_kg * (
      resolved_primary_velocity.x * resolved_primary_velocity.x
        - contact_primary_velocity.x * contact_primary_velocity.x
    )
      + center_mass_kg * (
        resolved_center_velocity.x * resolved_center_velocity.x
          - contact_center_velocity.x * contact_center_velocity.x
      )
      + secondary_mass_kg * (
        resolved_secondary_velocity.x * resolved_secondary_velocity.x
          - contact_secondary_velocity.x * contact_secondary_velocity.x
      )
  );
  let wall_kinetic_delta_y_j = 0.5 * (
    primary_mass_kg * (
      resolved_primary_velocity.y * resolved_primary_velocity.y
        - contact_primary_velocity.y * contact_primary_velocity.y
    )
      + center_mass_kg * (
        resolved_center_velocity.y * resolved_center_velocity.y
          - contact_center_velocity.y * contact_center_velocity.y
      )
      + secondary_mass_kg * (
        resolved_secondary_velocity.y * resolved_secondary_velocity.y
          - contact_secondary_velocity.y * contact_secondary_velocity.y
      )
  );
  let wall_kinetic_delta_z_j = 0.5 * (
    primary_mass_kg * (
      resolved_primary_velocity.z * resolved_primary_velocity.z
        - contact_primary_velocity.z * contact_primary_velocity.z
    )
      + center_mass_kg * (
        resolved_center_velocity.z * resolved_center_velocity.z
          - contact_center_velocity.z * contact_center_velocity.z
      )
      + secondary_mass_kg * (
        resolved_secondary_velocity.z * resolved_secondary_velocity.z
          - contact_secondary_velocity.z * contact_secondary_velocity.z
      )
  );
  let wall_kinetic_delta_j =
    wall_kinetic_delta_x_j
      + wall_kinetic_delta_y_j
      + wall_kinetic_delta_z_j;
  let total_kinetic_delta_j = 0.5 * (
    primary_mass_kg * (
      dot(resolved_primary_velocity, resolved_primary_velocity)
        - dot(primary_velocity, primary_velocity)
    )
      + center_mass_kg * (
        dot(resolved_center_velocity, resolved_center_velocity)
          - dot(center_velocity, center_velocity)
      )
      + secondary_mass_kg * (
        dot(resolved_secondary_velocity, resolved_secondary_velocity)
          - dot(secondary_velocity, secondary_velocity)
      )
  );
  let kinetic_conditioning_j = 0.5 * (
    primary_mass_kg * (
      dot(primary_velocity, primary_velocity)
        + dot(contact_primary_velocity, contact_primary_velocity)
        + dot(resolved_primary_velocity, resolved_primary_velocity)
    )
      + center_mass_kg * (
        dot(center_velocity, center_velocity)
          + dot(contact_center_velocity, contact_center_velocity)
          + dot(resolved_center_velocity, resolved_center_velocity)
      )
      + secondary_mass_kg * (
        dot(secondary_velocity, secondary_velocity)
          + dot(contact_secondary_velocity, contact_secondary_velocity)
          + dot(resolved_secondary_velocity, resolved_secondary_velocity)
      )
  );
  let kinetic_tolerance_j = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(kinetic_conditioning_j, 1.0e-6)
  );
  let masses_kg = vec3<f32>(
    primary_mass_kg,
    center_mass_kg,
    secondary_mass_kg
  );
  let x_wall_allocation = mechanical_matching_wall_energy_allocation(
    wall_kinetic_delta_x_j,
    masses_kg,
    x_axis.wall_mask,
    kinetic_tolerance_j
  );
  let y_wall_allocation = mechanical_matching_wall_energy_allocation(
    wall_kinetic_delta_y_j,
    masses_kg,
    y_axis.wall_mask,
    kinetic_tolerance_j
  );
  let z_wall_allocation = mechanical_matching_wall_energy_allocation(
    wall_kinetic_delta_z_j,
    masses_kg,
    z_axis.wall_mask,
    kinetic_tolerance_j
  );
  let wall_allocations =
    x_wall_allocation.xyz
      + y_wall_allocation.xyz
      + z_wall_allocation.xyz;
  if (
    x_wall_allocation.w == 0.0
    || y_wall_allocation.w == 0.0
    || z_wall_allocation.w == 0.0
    || !mechanical_solver_finite(primary_pair_kinetic_delta_j)
    || !mechanical_solver_finite(center_pair_kinetic_delta_j)
    || !mechanical_solver_finite(secondary_pair_kinetic_delta_j)
    || !mechanical_solver_finite(pair_kinetic_delta_j)
    || !mechanical_solver_finite(wall_kinetic_delta_x_j)
    || !mechanical_solver_finite(wall_kinetic_delta_y_j)
    || !mechanical_solver_finite(wall_kinetic_delta_z_j)
    || !mechanical_solver_finite(wall_kinetic_delta_j)
    || !mechanical_solver_finite(total_kinetic_delta_j)
    || !mechanical_solver_finite3(wall_allocations)
    || pair_kinetic_delta_j > kinetic_tolerance_j
    || wall_kinetic_delta_x_j > kinetic_tolerance_j
    || wall_kinetic_delta_y_j > kinetic_tolerance_j
    || wall_kinetic_delta_z_j > kinetic_tolerance_j
    || wall_kinetic_delta_j > kinetic_tolerance_j
    || wall_allocations.x > kinetic_tolerance_j
    || wall_allocations.y > kinetic_tolerance_j
    || wall_allocations.z > kinetic_tolerance_j
    || abs(
      total_kinetic_delta_j
        - pair_kinetic_delta_j
        - wall_kinetic_delta_j
    ) > kinetic_tolerance_j
  ) { return result; }
  result.primary_velocity = resolved_primary_velocity;
  result.center_velocity = resolved_center_velocity;
  result.secondary_velocity = resolved_secondary_velocity;
  result.primary_kinetic_delta_j = primary_pair_kinetic_delta_j;
  result.center_kinetic_delta_j = center_pair_kinetic_delta_j;
  result.secondary_kinetic_delta_j = secondary_pair_kinetic_delta_j;
  result.primary_wall_kinetic_delta_j = wall_allocations.x;
  result.center_wall_kinetic_delta_j = wall_allocations.y;
  result.secondary_wall_kinetic_delta_j = wall_allocations.z;
  result.pair_heat_j = max(0.0, -pair_kinetic_delta_j);
  result.primary_impulse = primary_impulse;
  result.center_primary_impulse = center_primary_impulse;
  result.center_secondary_impulse = center_secondary_impulse;
  result.secondary_impulse = secondary_impulse;
  result.applied = 1u;
  return result;
}

fn mechanical_matching_inbound_candidate_better(
  candidate_priority: f32,
  candidate_face_alignment: f32,
  candidate_rank: u32,
  candidate_low: u32,
  candidate_high: u32,
  incumbent_priority: f32,
  incumbent_face_alignment: f32,
  incumbent_rank: u32,
  incumbent_low: u32,
  incumbent_high: u32
) -> bool {
  return candidate_priority > incumbent_priority
    || (
      candidate_priority == incumbent_priority
      && (
        candidate_face_alignment > incumbent_face_alignment
        || (
          candidate_face_alignment == incumbent_face_alignment
          && (
            candidate_rank < incumbent_rank
            || (
              candidate_rank == incumbent_rank
              && (
                candidate_low < incumbent_low
                || (
                  candidate_low == incumbent_low
                  && candidate_high < incumbent_high
                )
              )
            )
          )
        )
      )
  );
}

fn mechanical_matching_zero_four_path_candidate() ->
  MechanicalMatchingFourPathCandidate {
  return MechanicalMatchingFourPathCandidate(
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0xffffffffu,
    0.0,
    0xffffffffu,
    0u,
    1u
  );
}

// Lift the particle matching into a matching of two already-disjoint mutual
// pairs. An inactive contact may bridge those pairs after the prior sweep.
// Ranking by the strict-light mass ratio makes both mutual pairs choose the
// same ill-conditioned bridge; the reciprocal-choice check in the caller
// makes the merged four-body write race-free without atomics.
fn mechanical_matching_four_path_candidate(
  mutual_low: u32,
  mutual_high: u32,
  published_total: u32
) -> MechanicalMatchingFourPathCandidate {
  var result = mechanical_matching_zero_four_path_candidate();
  if (
    mutual_low >= mutual_high
    || mutual_high >= mechanical_params.particle_count
    || published_total > arrayLength(&csr_peers)
    || published_total > arrayLength(&matching_constraints)
  ) {
    result.valid = 0u;
    return result;
  }
  let low_selection = energy_ledger[mechanical_energy_base(mutual_low)];
  let high_selection = energy_ledger[mechanical_energy_base(mutual_high)];
  if (
    bitcast<u32>(low_selection.x) != mutual_high
    || bitcast<u32>(high_selection.x) != mutual_low
  ) { return result; }
  for (var endpoint_slot = 0u; endpoint_slot < 2u;
    endpoint_slot = endpoint_slot + 1u) {
    let current_index = select(
      mutual_low,
      mutual_high,
      endpoint_slot != 0u
    );
    let current_partner = select(
      mutual_high,
      mutual_low,
      endpoint_slot != 0u
    );
    let current_selection = select(
      low_selection,
      high_selection,
      endpoint_slot != 0u
    );
    let current_partner_selection = select(
      high_selection,
      low_selection,
      endpoint_slot != 0u
    );
    let begin = source_offsets[current_index];
    let end = source_offsets[current_index + 1u];
    if (begin > end || end > published_total) {
      result.valid = 0u;
      return result;
    }
    for (var bridge_cursor = begin; bridge_cursor < end;
      bridge_cursor = bridge_cursor + 1u) {
      let encoded_bridge_peer = csr_peers[bridge_cursor];
      let bridge_peer = mechanical_solver_peer_index(encoded_bridge_peer);
      if (
        bridge_peer == current_partner
        || bridge_peer >= mechanical_params.particle_count
        || !mechanical_solver_edge_inactive(encoded_bridge_peer)
      ) { continue; }
      let peer_selection =
        energy_ledger[mechanical_energy_base(bridge_peer)];
      let peer_partner = bitcast<u32>(peer_selection.x);
      if (
        peer_partner >= mechanical_params.particle_count
        || peer_partner == current_index
        || peer_partner == current_partner
        || peer_partner == bridge_peer
      ) { continue; }
      let peer_partner_selection =
        energy_ledger[mechanical_energy_base(peer_partner)];
      if (bitcast<u32>(peer_partner_selection.x) != bridge_peer) {
        continue;
      }
      let peer_begin = source_offsets[bridge_peer];
      let peer_end = source_offsets[bridge_peer + 1u];
      if (peer_begin > peer_end || peer_end > published_total) {
        result.valid = 0u;
        return result;
      }
      var bridge_reverse_cursor = 0xffffffffu;
      for (var cursor = peer_begin; cursor < peer_end;
        cursor = cursor + 1u) {
        if (
          mechanical_solver_peer_index(csr_peers[cursor]) == current_index
        ) {
          bridge_reverse_cursor = cursor;
          break;
        }
      }
      if (
        bridge_reverse_cursor == 0xffffffffu
        || !mechanical_solver_edge_inactive(
          csr_peers[bridge_reverse_cursor]
        )
      ) { continue; }
      let current_mass = input_state[current_index * 2u].w;
      let current_partner_mass = input_state[current_partner * 2u].w;
      let peer_mass = input_state[bridge_peer * 2u].w;
      let peer_partner_mass = input_state[peer_partner * 2u].w;
      if (
        !(current_mass > 0.0)
        || !(current_partner_mass > 0.0)
        || !(peer_mass > 0.0)
        || !(peer_partner_mass > 0.0)
        || !mechanical_solver_finite(current_mass)
        || !mechanical_solver_finite(current_partner_mass)
        || !mechanical_solver_finite(peer_mass)
        || !mechanical_solver_finite(peer_partner_mass)
      ) {
        result.valid = 0u;
        return result;
      }
      let current_is_light = current_mass < peer_mass
        && current_mass < current_partner_mass;
      let peer_is_light = peer_mass < current_mass
        && peer_mass < peer_partner_mass;
      if (current_is_light == peer_is_light) { continue; }
      let bridge_pair = mechanical_matching_constraint_pair(
        min(current_index, bridge_peer),
        max(current_index, bridge_peer),
        bridge_cursor
      );
      if (bridge_pair.valid == 0u) {
        result.valid = 0u;
        return result;
      }
      if (
        bridge_pair.active_pair == 0u
        || bridge_pair.unilateral == 0u
      ) { continue; }
      var candidate = mechanical_matching_zero_four_path_candidate();
      if (current_is_light) {
        candidate.body_0_index = current_partner;
        candidate.body_1_index = current_index;
        candidate.body_2_index = bridge_peer;
        candidate.body_3_index = peer_partner;
        candidate.edge_0_forward_cursor = bitcast<u32>(current_selection.z);
        candidate.edge_0_reverse_cursor =
          bitcast<u32>(current_partner_selection.z);
        candidate.edge_1_forward_cursor = bridge_cursor;
        candidate.edge_1_reverse_cursor = bridge_reverse_cursor;
        candidate.edge_2_forward_cursor = bitcast<u32>(peer_selection.z);
        candidate.edge_2_reverse_cursor =
          bitcast<u32>(peer_partner_selection.z);
      } else {
        candidate.body_0_index = peer_partner;
        candidate.body_1_index = bridge_peer;
        candidate.body_2_index = current_index;
        candidate.body_3_index = current_partner;
        candidate.edge_0_forward_cursor = bitcast<u32>(peer_selection.z);
        candidate.edge_0_reverse_cursor =
          bitcast<u32>(peer_partner_selection.z);
        candidate.edge_1_forward_cursor = bridge_reverse_cursor;
        candidate.edge_1_reverse_cursor = bridge_cursor;
        candidate.edge_2_forward_cursor = bitcast<u32>(current_selection.z);
        candidate.edge_2_reverse_cursor =
          bitcast<u32>(current_partner_selection.z);
      }
      let body_0_mass = input_state[candidate.body_0_index * 2u].w;
      let body_1_mass = input_state[candidate.body_1_index * 2u].w;
      let body_2_mass = input_state[candidate.body_2_index * 2u].w;
      candidate.light_mass_ratio = min(body_0_mass, body_2_mass)
        / body_1_mass;
      candidate.bridge_rank = mechanical_matching_edge_rank(
        min(candidate.body_1_index, candidate.body_2_index),
        max(candidate.body_1_index, candidate.body_2_index)
      );
      candidate.found = 1u;
      let better = result.found == 0u
        || candidate.light_mass_ratio > result.light_mass_ratio
        || (
          candidate.light_mass_ratio == result.light_mass_ratio
          && (
            candidate.bridge_rank < result.bridge_rank
            || (
              candidate.bridge_rank == result.bridge_rank
              && (
                candidate.body_0_index < result.body_0_index
                || (
                  candidate.body_0_index == result.body_0_index
                  && candidate.body_1_index < result.body_1_index
                )
              )
            )
          )
        );
      if (better) { result = candidate; }
    }
  }
  return result;
}

// Exact mass-metric projection for the path 0--1--2--3 on one Cartesian
// lane. The eight active masks reduce to explicit connected-component pools.
fn mechanical_matching_four_path_axis_active_set(
  edge_0_sign: f32,
  edge_1_sign: f32,
  edge_2_sign: f32,
  masses_kg: vec4<f32>,
  input_u: vec4<f32>,
  velocity_tolerance_m_per_s: f32
) -> MechanicalMatchingFourBlockAxisResult {
  var result = MechanicalMatchingFourBlockAxisResult(
    input_u,
    0.0,
    0u,
    0u
  );
  let edge_0_present = abs(edge_0_sign) > 0.5;
  let edge_1_present = abs(edge_1_sign) > 0.5;
  let edge_2_present = abs(edge_2_sign) > 0.5;
  if (
    !(masses_kg.x > 0.0)
    || !(masses_kg.y > 0.0)
    || !(masses_kg.z > 0.0)
    || !(masses_kg.w > 0.0)
    || !mechanical_solver_finite(masses_kg.x)
    || !mechanical_solver_finite(masses_kg.y)
    || !mechanical_solver_finite(masses_kg.z)
    || !mechanical_solver_finite(masses_kg.w)
    || !mechanical_solver_finite(input_u.x)
    || !mechanical_solver_finite(input_u.y)
    || !mechanical_solver_finite(input_u.z)
    || !mechanical_solver_finite(input_u.w)
  ) { return result; }
  for (var contact_mask = 0u; contact_mask < 8u;
    contact_mask = contact_mask + 1u) {
    let edge_0_active = (contact_mask & 1u) != 0u;
    let edge_1_active = (contact_mask & 2u) != 0u;
    let edge_2_active = (contact_mask & 4u) != 0u;
    if (
      (edge_0_active && !edge_0_present)
      || (edge_1_active && !edge_1_present)
      || (edge_2_active && !edge_2_present)
    ) { continue; }
    var candidate_u = input_u;
    if (contact_mask == 1u || contact_mask == 5u) {
      let shared_01 = (
        masses_kg.x * input_u.x + masses_kg.y * input_u.y
      ) / (masses_kg.x + masses_kg.y);
      candidate_u.x = shared_01;
      candidate_u.y = shared_01;
    }
    if (contact_mask == 2u) {
      let shared_12 = (
        masses_kg.y * input_u.y + masses_kg.z * input_u.z
      ) / (masses_kg.y + masses_kg.z);
      candidate_u.y = shared_12;
      candidate_u.z = shared_12;
    }
    if (contact_mask == 4u || contact_mask == 5u) {
      let shared_23 = (
        masses_kg.z * input_u.z + masses_kg.w * input_u.w
      ) / (masses_kg.z + masses_kg.w);
      candidate_u.z = shared_23;
      candidate_u.w = shared_23;
    }
    if (contact_mask == 3u) {
      let shared_012 = (
        masses_kg.x * input_u.x
          + masses_kg.y * input_u.y
          + masses_kg.z * input_u.z
      ) / (masses_kg.x + masses_kg.y + masses_kg.z);
      candidate_u.x = shared_012;
      candidate_u.y = shared_012;
      candidate_u.z = shared_012;
    }
    if (contact_mask == 6u) {
      let shared_123 = (
        masses_kg.y * input_u.y
          + masses_kg.z * input_u.z
          + masses_kg.w * input_u.w
      ) / (masses_kg.y + masses_kg.z + masses_kg.w);
      candidate_u.y = shared_123;
      candidate_u.z = shared_123;
      candidate_u.w = shared_123;
    }
    if (contact_mask == 7u) {
      let shared_0123 = dot(masses_kg, input_u)
        / (masses_kg.x + masses_kg.y + masses_kg.z + masses_kg.w);
      candidate_u = vec4<f32>(shared_0123);
    }
    let residual = vec3<f32>(
      edge_0_sign * (candidate_u.y - candidate_u.x),
      edge_1_sign * (candidate_u.y - candidate_u.z),
      edge_2_sign * (candidate_u.z - candidate_u.w)
    );
    if (
      (edge_0_present
        && residual.x < -velocity_tolerance_m_per_s)
      || (edge_1_present
        && residual.y < -velocity_tolerance_m_per_s)
      || (edge_2_present
        && residual.z < -velocity_tolerance_m_per_s)
    ) { continue; }
    let delta_u = candidate_u - input_u;
    let objective = dot(masses_kg, delta_u * delta_u);
    if (
      !mechanical_solver_finite(candidate_u.x)
      || !mechanical_solver_finite(candidate_u.y)
      || !mechanical_solver_finite(candidate_u.z)
      || !mechanical_solver_finite(candidate_u.w)
      || !mechanical_solver_finite3(residual)
      || !mechanical_solver_finite(objective)
    ) { continue; }
    if (result.valid == 0u || objective < result.objective) {
      result.velocity = candidate_u;
      result.objective = objective;
      result.contact_mask = contact_mask;
      result.valid = 1u;
    }
  }
  return result;
}

// A four-body star has one center and three leaves. On one Cartesian lane,
// every active contact equality therefore joins another leaf to the center's
// single pooled component. Enumerating the eight contact masks gives the
// exact mass-metric projection without an iterative per-candidate solve.
fn mechanical_matching_four_block_axis_active_set(
  primary_contact_sign: f32,
  secondary_contact_sign: f32,
  tertiary_contact_sign: f32,
  masses_kg: vec4<f32>,
  input_u: vec4<f32>,
  velocity_tolerance_m_per_s: f32
) -> MechanicalMatchingFourBlockAxisResult {
  var result = MechanicalMatchingFourBlockAxisResult(
    input_u,
    0.0,
    0u,
    0u
  );
  let primary_sign_valid = abs(primary_contact_sign) <= 1.0e-6
    || abs(abs(primary_contact_sign) - 1.0) <= 1.0e-6;
  let secondary_sign_valid = abs(secondary_contact_sign) <= 1.0e-6
    || abs(abs(secondary_contact_sign) - 1.0) <= 1.0e-6;
  let tertiary_sign_valid = abs(tertiary_contact_sign) <= 1.0e-6
    || abs(abs(tertiary_contact_sign) - 1.0) <= 1.0e-6;
  if (
    !primary_sign_valid
    || !secondary_sign_valid
    || !tertiary_sign_valid
    || !(masses_kg.x > 0.0)
    || !(masses_kg.y > 0.0)
    || !(masses_kg.z > 0.0)
    || !(masses_kg.w > 0.0)
    || !mechanical_solver_finite(masses_kg.x)
    || !mechanical_solver_finite(masses_kg.y)
    || !mechanical_solver_finite(masses_kg.z)
    || !mechanical_solver_finite(masses_kg.w)
    || !mechanical_solver_finite(input_u.x)
    || !mechanical_solver_finite(input_u.y)
    || !mechanical_solver_finite(input_u.z)
    || !mechanical_solver_finite(input_u.w)
    || !mechanical_solver_finite(velocity_tolerance_m_per_s)
  ) { return result; }
  let primary_present = abs(primary_contact_sign) > 0.5;
  let secondary_present = abs(secondary_contact_sign) > 0.5;
  let tertiary_present = abs(tertiary_contact_sign) > 0.5;
  for (var contact_mask = 0u; contact_mask < 8u;
    contact_mask = contact_mask + 1u) {
    let primary_active = (contact_mask & 1u) != 0u;
    let secondary_active = (contact_mask & 2u) != 0u;
    let tertiary_active = (contact_mask & 4u) != 0u;
    if (
      (primary_active && !primary_present)
      || (secondary_active && !secondary_present)
      || (tertiary_active && !tertiary_present)
    ) { continue; }
    var pooled_mass_kg = masses_kg.y;
    var pooled_momentum = masses_kg.y * input_u.y;
    if (primary_active) {
      pooled_mass_kg = pooled_mass_kg + masses_kg.x;
      pooled_momentum = pooled_momentum + masses_kg.x * input_u.x;
    }
    if (secondary_active) {
      pooled_mass_kg = pooled_mass_kg + masses_kg.z;
      pooled_momentum = pooled_momentum + masses_kg.z * input_u.z;
    }
    if (tertiary_active) {
      pooled_mass_kg = pooled_mass_kg + masses_kg.w;
      pooled_momentum = pooled_momentum + masses_kg.w * input_u.w;
    }
    if (
      !(pooled_mass_kg > 0.0)
      || !mechanical_solver_finite(pooled_mass_kg)
      || !mechanical_solver_finite(pooled_momentum)
    ) { continue; }
    let shared_u = pooled_momentum / pooled_mass_kg;
    var candidate_u = input_u;
    candidate_u.y = shared_u;
    if (primary_active) { candidate_u.x = shared_u; }
    if (secondary_active) { candidate_u.z = shared_u; }
    if (tertiary_active) { candidate_u.w = shared_u; }
    let primary_residual =
      primary_contact_sign * (candidate_u.y - candidate_u.x);
    let secondary_residual =
      secondary_contact_sign * (candidate_u.y - candidate_u.z);
    let tertiary_residual =
      tertiary_contact_sign * (candidate_u.y - candidate_u.w);
    if (
      (primary_present
        && primary_residual < -velocity_tolerance_m_per_s)
      || (secondary_present
        && secondary_residual < -velocity_tolerance_m_per_s)
      || (tertiary_present
        && tertiary_residual < -velocity_tolerance_m_per_s)
    ) { continue; }
    let delta_u = candidate_u - input_u;
    let objective = dot(masses_kg, delta_u * delta_u);
    if (
      !mechanical_solver_finite(shared_u)
      || !mechanical_solver_finite(candidate_u.x)
      || !mechanical_solver_finite(candidate_u.y)
      || !mechanical_solver_finite(candidate_u.z)
      || !mechanical_solver_finite(candidate_u.w)
      || !mechanical_solver_finite(primary_residual)
      || !mechanical_solver_finite(secondary_residual)
      || !mechanical_solver_finite(tertiary_residual)
      || !mechanical_solver_finite(objective)
    ) { continue; }
    if (result.valid == 0u || objective < result.objective) {
      result.velocity = candidate_u;
      result.objective = objective;
      result.contact_mask = contact_mask;
      result.valid = 1u;
    }
  }
  return result;
}

// Exact fixed-cost projection for one lane of a four-body star coupled to
// axis-aligned box walls. Every candidate is a closed KKT active set:
// 16 wall masks x 8 contact masks, independent of particle count or degree.
fn mechanical_matching_four_block_box_axis_active_set(
  primary_index: u32,
  center_index: u32,
  secondary_index: u32,
  tertiary_index: u32,
  primary_position: vec3<f32>,
  center_position: vec3<f32>,
  secondary_position: vec3<f32>,
  tertiary_position: vec3<f32>,
  axis_normal: vec3<f32>,
  primary_contact_sign: f32,
  secondary_contact_sign: f32,
  tertiary_contact_sign: f32,
  masses_kg: vec4<f32>,
  input_u: vec4<f32>,
  velocity_tolerance_m_per_s: f32
) -> MechanicalMatchingFourBlockBoxAxisResult {
  var result = MechanicalMatchingFourBlockBoxAxisResult(
    input_u,
    vec3<f32>(0.0),
    0.0,
    0u,
    0u,
    0u
  );
  let primary_sign_valid = abs(primary_contact_sign) <= 1.0e-6
    || abs(abs(primary_contact_sign) - 1.0) <= 1.0e-6;
  let secondary_sign_valid = abs(secondary_contact_sign) <= 1.0e-6
    || abs(abs(secondary_contact_sign) - 1.0) <= 1.0e-6;
  let tertiary_sign_valid = abs(tertiary_contact_sign) <= 1.0e-6
    || abs(abs(tertiary_contact_sign) - 1.0) <= 1.0e-6;
  if (
    !primary_sign_valid
    || !secondary_sign_valid
    || !tertiary_sign_valid
    || !(masses_kg.x > 0.0)
    || !(masses_kg.y > 0.0)
    || !(masses_kg.z > 0.0)
    || !(masses_kg.w > 0.0)
    || !mechanical_solver_finite(masses_kg.x)
    || !mechanical_solver_finite(masses_kg.y)
    || !mechanical_solver_finite(masses_kg.z)
    || !mechanical_solver_finite(masses_kg.w)
    || !mechanical_solver_finite(input_u.x)
    || !mechanical_solver_finite(input_u.y)
    || !mechanical_solver_finite(input_u.z)
    || !mechanical_solver_finite(input_u.w)
    || !mechanical_solver_finite(velocity_tolerance_m_per_s)
  ) { return result; }
  let primary_wall_constraint = mechanical_matching_axis_wall_constraint(
    primary_index,
    primary_position,
    axis_normal
  );
  let center_wall_constraint = mechanical_matching_axis_wall_constraint(
    center_index,
    center_position,
    axis_normal
  );
  let secondary_wall_constraint = mechanical_matching_axis_wall_constraint(
    secondary_index,
    secondary_position,
    axis_normal
  );
  let tertiary_wall_constraint = mechanical_matching_axis_wall_constraint(
    tertiary_index,
    tertiary_position,
    axis_normal
  );
  if (
    primary_wall_constraint.valid == 0u
    || center_wall_constraint.valid == 0u
    || secondary_wall_constraint.valid == 0u
    || tertiary_wall_constraint.valid == 0u
  ) { return result; }
  let primary_present = abs(primary_contact_sign) > 0.5;
  let secondary_present = abs(secondary_contact_sign) > 0.5;
  let tertiary_present = abs(tertiary_contact_sign) > 0.5;
  let inverse_mass = vec4<f32>(
    1.0 / masses_kg.x,
    1.0 / masses_kg.y,
    1.0 / masses_kg.z,
    1.0 / masses_kg.w
  );
  let velocity_conditioning = max(
    max(abs(input_u.x), abs(input_u.y)),
    max(max(abs(input_u.z), abs(input_u.w)), 1.0)
  );
  let arithmetic_tolerance_m_per_s = max(
    velocity_tolerance_m_per_s,
    128.0 * 1.1920929e-7 * velocity_conditioning
  );
  let impulse_conditioning = (
    masses_kg.x + masses_kg.y + masses_kg.z + masses_kg.w
  ) * velocity_conditioning;
  let impulse_tolerance = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(impulse_conditioning, 1.0e-6)
  );
  if (
    !mechanical_solver_finite(inverse_mass.x)
    || !mechanical_solver_finite(inverse_mass.y)
    || !mechanical_solver_finite(inverse_mass.z)
    || !mechanical_solver_finite(inverse_mass.w)
    || !mechanical_solver_finite(arithmetic_tolerance_m_per_s)
    || !mechanical_solver_finite(impulse_tolerance)
  ) { return result; }
  for (var wall_mask = 0u; wall_mask < 16u;
    wall_mask = wall_mask + 1u) {
    let primary_wall_fixed = (wall_mask & 1u) != 0u;
    let center_wall_fixed = (wall_mask & 2u) != 0u;
    let secondary_wall_fixed = (wall_mask & 4u) != 0u;
    let tertiary_wall_fixed = (wall_mask & 8u) != 0u;
    if (
      (primary_wall_fixed
        && primary_wall_constraint.geometry_active == 0u)
      || (center_wall_fixed
        && center_wall_constraint.geometry_active == 0u)
      || (secondary_wall_fixed
        && secondary_wall_constraint.geometry_active == 0u)
      || (tertiary_wall_fixed
        && tertiary_wall_constraint.geometry_active == 0u)
    ) { continue; }
    let q = vec4<f32>(
      select(input_u.x, 0.0, primary_wall_fixed),
      select(input_u.y, 0.0, center_wall_fixed),
      select(input_u.z, 0.0, secondary_wall_fixed),
      select(input_u.w, 0.0, tertiary_wall_fixed)
    );
    let d = vec4<f32>(
      select(inverse_mass.x, 0.0, primary_wall_fixed),
      select(inverse_mass.y, 0.0, center_wall_fixed),
      select(inverse_mass.z, 0.0, secondary_wall_fixed),
      select(inverse_mass.w, 0.0, tertiary_wall_fixed)
    );
    let residual = vec3<f32>(
      primary_contact_sign * (q.y - q.x),
      secondary_contact_sign * (q.y - q.z),
      tertiary_contact_sign * (q.y - q.w)
    );
    let diagonal = vec3<f32>(d.x + d.y, d.z + d.y, d.w + d.y);
    let cross_12 = primary_contact_sign
      * secondary_contact_sign * d.y;
    let cross_13 = primary_contact_sign
      * tertiary_contact_sign * d.y;
    let cross_23 = secondary_contact_sign
      * tertiary_contact_sign * d.y;
    for (var contact_mask = 0u; contact_mask < 8u;
      contact_mask = contact_mask + 1u) {
      let primary_active = (contact_mask & 1u) != 0u;
      let secondary_active = (contact_mask & 2u) != 0u;
      let tertiary_active = (contact_mask & 4u) != 0u;
      if (
        (primary_active && !primary_present)
        || (secondary_active && !secondary_present)
        || (tertiary_active && !tertiary_present)
      ) { continue; }
      var candidate_valid = true;
      var contact_lambda = vec3<f32>(0.0);
      if (contact_mask == 1u) {
        let tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(abs(diagonal.x), 1.0e-12)
        );
        if (diagonal.x > tolerance) {
          contact_lambda.x = -residual.x / diagonal.x;
        } else if (abs(residual.x) > arithmetic_tolerance_m_per_s) {
          candidate_valid = false;
        }
      } else if (contact_mask == 2u) {
        let tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(abs(diagonal.y), 1.0e-12)
        );
        if (diagonal.y > tolerance) {
          contact_lambda.y = -residual.y / diagonal.y;
        } else if (abs(residual.y) > arithmetic_tolerance_m_per_s) {
          candidate_valid = false;
        }
      } else if (contact_mask == 4u) {
        let tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(abs(diagonal.z), 1.0e-12)
        );
        if (diagonal.z > tolerance) {
          contact_lambda.z = -residual.z / diagonal.z;
        } else if (abs(residual.z) > arithmetic_tolerance_m_per_s) {
          candidate_valid = false;
        }
      } else if (contact_mask == 3u) {
        let determinant = diagonal.x * diagonal.y
          - cross_12 * cross_12;
        let conditioning = abs(diagonal.x * diagonal.y)
          + abs(cross_12 * cross_12);
        let tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(conditioning, 1.0e-12)
        );
        if (determinant > tolerance) {
          contact_lambda.x = (
            -residual.x * diagonal.y + cross_12 * residual.y
          ) / determinant;
          contact_lambda.y = (
            -diagonal.x * residual.y + cross_12 * residual.x
          ) / determinant;
        } else if (
          abs(residual.x) > arithmetic_tolerance_m_per_s
          || abs(residual.y) > arithmetic_tolerance_m_per_s
        ) { candidate_valid = false; }
      } else if (contact_mask == 5u) {
        let determinant = diagonal.x * diagonal.z
          - cross_13 * cross_13;
        let conditioning = abs(diagonal.x * diagonal.z)
          + abs(cross_13 * cross_13);
        let tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(conditioning, 1.0e-12)
        );
        if (determinant > tolerance) {
          contact_lambda.x = (
            -residual.x * diagonal.z + cross_13 * residual.z
          ) / determinant;
          contact_lambda.z = (
            -diagonal.x * residual.z + cross_13 * residual.x
          ) / determinant;
        } else if (
          abs(residual.x) > arithmetic_tolerance_m_per_s
          || abs(residual.z) > arithmetic_tolerance_m_per_s
        ) { candidate_valid = false; }
      } else if (contact_mask == 6u) {
        let determinant = diagonal.y * diagonal.z
          - cross_23 * cross_23;
        let conditioning = abs(diagonal.y * diagonal.z)
          + abs(cross_23 * cross_23);
        let tolerance = max(
          1.0e-12,
          64.0 * 1.1920929e-7 * max(conditioning, 1.0e-12)
        );
        if (determinant > tolerance) {
          contact_lambda.y = (
            -residual.y * diagonal.z + cross_23 * residual.z
          ) / determinant;
          contact_lambda.z = (
            -diagonal.y * residual.z + cross_23 * residual.y
          ) / determinant;
        } else if (
          abs(residual.y) > arithmetic_tolerance_m_per_s
          || abs(residual.z) > arithmetic_tolerance_m_per_s
        ) { candidate_valid = false; }
      } else if (contact_mask == 7u) {
        let cofactor_11 = diagonal.y * diagonal.z
          - cross_23 * cross_23;
        let cofactor_12 = cross_13 * cross_23
          - cross_12 * diagonal.z;
        let cofactor_13 = cross_12 * cross_23
          - diagonal.y * cross_13;
        let cofactor_22 = diagonal.x * diagonal.z
          - cross_13 * cross_13;
        let cofactor_23 = cross_12 * cross_13
          - diagonal.x * cross_23;
        let cofactor_33 = diagonal.x * diagonal.y
          - cross_12 * cross_12;
        let determinant = diagonal.x * cofactor_11
          + cross_12 * cofactor_12
          + cross_13 * cofactor_13;
        let conditioning = abs(diagonal.x * diagonal.y * diagonal.z)
          + 2.0 * abs(cross_12 * cross_13 * cross_23)
          + abs(diagonal.x * cross_23 * cross_23)
          + abs(diagonal.y * cross_13 * cross_13)
          + abs(diagonal.z * cross_12 * cross_12);
        let tolerance = max(
          1.0e-12,
          128.0 * 1.1920929e-7 * max(conditioning, 1.0e-12)
        );
        if (determinant > tolerance) {
          let rhs = -residual;
          contact_lambda = vec3<f32>(
            dot(vec3<f32>(cofactor_11, cofactor_12, cofactor_13), rhs),
            dot(vec3<f32>(cofactor_12, cofactor_22, cofactor_23), rhs),
            dot(vec3<f32>(cofactor_13, cofactor_23, cofactor_33), rhs)
          ) / determinant;
        } else if (
          abs(residual.x) > arithmetic_tolerance_m_per_s
          || abs(residual.y) > arithmetic_tolerance_m_per_s
          || abs(residual.z) > arithmetic_tolerance_m_per_s
        ) { candidate_valid = false; }
      }
      if (
        !candidate_valid
        || !mechanical_solver_finite3(contact_lambda)
        || contact_lambda.x < -impulse_tolerance
        || contact_lambda.y < -impulse_tolerance
        || contact_lambda.z < -impulse_tolerance
      ) { continue; }
      contact_lambda = max(contact_lambda, vec3<f32>(0.0));
      var pooled_mass_kg = masses_kg.y;
      var pooled_momentum = masses_kg.y * input_u.y;
      if (primary_active) {
        pooled_mass_kg = pooled_mass_kg + masses_kg.x;
        pooled_momentum = pooled_momentum + masses_kg.x * input_u.x;
      }
      if (secondary_active) {
        pooled_mass_kg = pooled_mass_kg + masses_kg.z;
        pooled_momentum = pooled_momentum + masses_kg.z * input_u.z;
      }
      if (tertiary_active) {
        pooled_mass_kg = pooled_mass_kg + masses_kg.w;
        pooled_momentum = pooled_momentum + masses_kg.w * input_u.w;
      }
      let component_wall_fixed = center_wall_fixed
        || (primary_active && primary_wall_fixed)
        || (secondary_active && secondary_wall_fixed)
        || (tertiary_active && tertiary_wall_fixed);
      let shared_u = select(
        pooled_momentum / pooled_mass_kg,
        0.0,
        component_wall_fixed
      );
      var candidate_u = vec4<f32>(
        select(input_u.x, 0.0, primary_wall_fixed),
        select(input_u.y, 0.0, center_wall_fixed),
        select(input_u.z, 0.0, secondary_wall_fixed),
        select(input_u.w, 0.0, tertiary_wall_fixed)
      );
      candidate_u.y = shared_u;
      if (primary_active) { candidate_u.x = shared_u; }
      if (secondary_active) { candidate_u.z = shared_u; }
      if (tertiary_active) { candidate_u.w = shared_u; }
      let candidate_residual = vec3<f32>(
        primary_contact_sign * (candidate_u.y - candidate_u.x),
        secondary_contact_sign * (candidate_u.y - candidate_u.z),
        tertiary_contact_sign * (candidate_u.y - candidate_u.w)
      );
      var contact_feasible = true;
      if (primary_present) {
        contact_feasible = contact_feasible && select(
          candidate_residual.x >= -velocity_tolerance_m_per_s,
          abs(candidate_residual.x) <= velocity_tolerance_m_per_s,
          primary_active
        );
      }
      if (secondary_present) {
        contact_feasible = contact_feasible && select(
          candidate_residual.y >= -velocity_tolerance_m_per_s,
          abs(candidate_residual.y) <= velocity_tolerance_m_per_s,
          secondary_active
        );
      }
      if (tertiary_present) {
        contact_feasible = contact_feasible && select(
          candidate_residual.z >= -velocity_tolerance_m_per_s,
          abs(candidate_residual.z) <= velocity_tolerance_m_per_s,
          tertiary_active
        );
      }
      if (!contact_feasible) { continue; }
      let pair_impulse = vec4<f32>(
        -primary_contact_sign * contact_lambda.x,
        primary_contact_sign * contact_lambda.x
          + secondary_contact_sign * contact_lambda.y
          + tertiary_contact_sign * contact_lambda.z,
        -secondary_contact_sign * contact_lambda.y,
        -tertiary_contact_sign * contact_lambda.z
      );
      let total_impulse = masses_kg * (candidate_u - input_u);
      let wall_impulse = total_impulse - pair_impulse;
      var wall_feasible = true;
      if (primary_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_u.x) <= velocity_tolerance_m_per_s
          && primary_wall_constraint.inward_scalar_sign * wall_impulse.x
            >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(wall_impulse.x) <= impulse_tolerance;
        if (primary_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && primary_wall_constraint.inward_scalar_sign * candidate_u.x
              >= -velocity_tolerance_m_per_s;
        }
      }
      if (center_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_u.y) <= velocity_tolerance_m_per_s
          && center_wall_constraint.inward_scalar_sign * wall_impulse.y
            >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(wall_impulse.y) <= impulse_tolerance;
        if (center_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && center_wall_constraint.inward_scalar_sign * candidate_u.y
              >= -velocity_tolerance_m_per_s;
        }
      }
      if (secondary_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_u.z) <= velocity_tolerance_m_per_s
          && secondary_wall_constraint.inward_scalar_sign * wall_impulse.z
            >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(wall_impulse.z) <= impulse_tolerance;
        if (secondary_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && secondary_wall_constraint.inward_scalar_sign * candidate_u.z
              >= -velocity_tolerance_m_per_s;
        }
      }
      if (tertiary_wall_fixed) {
        wall_feasible = wall_feasible
          && abs(candidate_u.w) <= velocity_tolerance_m_per_s
          && tertiary_wall_constraint.inward_scalar_sign * wall_impulse.w
            >= -impulse_tolerance;
      } else {
        wall_feasible = wall_feasible
          && abs(wall_impulse.w) <= impulse_tolerance;
        if (tertiary_wall_constraint.geometry_active != 0u) {
          wall_feasible = wall_feasible
            && tertiary_wall_constraint.inward_scalar_sign * candidate_u.w
              >= -velocity_tolerance_m_per_s;
        }
      }
      let delta_u = candidate_u - input_u;
      let objective = dot(masses_kg, delta_u * delta_u);
      if (
        !wall_feasible
        || !mechanical_solver_finite(candidate_u.x)
        || !mechanical_solver_finite(candidate_u.y)
        || !mechanical_solver_finite(candidate_u.z)
        || !mechanical_solver_finite(candidate_u.w)
        || !mechanical_solver_finite3(candidate_residual)
        || !mechanical_solver_finite(wall_impulse.x)
        || !mechanical_solver_finite(wall_impulse.y)
        || !mechanical_solver_finite(wall_impulse.z)
        || !mechanical_solver_finite(wall_impulse.w)
        || !mechanical_solver_finite(objective)
      ) { continue; }
      if (result.valid == 0u || objective < result.objective) {
        result.velocity = candidate_u;
        result.contact_lambda = contact_lambda;
        result.objective = objective;
        result.contact_mask = contact_mask;
        result.wall_mask = wall_mask;
        result.valid = 1u;
      }
    }
  }
  return result;
}

fn mechanical_matching_four_wall_energy_allocation(
  wall_kinetic_delta_j: f32,
  masses_kg: vec4<f32>,
  wall_mask: u32,
  kinetic_tolerance_j: f32
) -> MechanicalMatchingFourWallEnergyAllocation {
  var result = MechanicalMatchingFourWallEnergyAllocation(
    vec4<f32>(0.0),
    1u
  );
  if (
    !mechanical_solver_finite(wall_kinetic_delta_j)
    || !mechanical_solver_finite(masses_kg.x)
    || !mechanical_solver_finite(masses_kg.y)
    || !mechanical_solver_finite(masses_kg.z)
    || !mechanical_solver_finite(masses_kg.w)
    || !mechanical_solver_finite(kinetic_tolerance_j)
  ) {
    result.valid = 0u;
    return result;
  }
  if (wall_mask == 0u) {
    if (abs(wall_kinetic_delta_j) > kinetic_tolerance_j) {
      result.valid = 0u;
    }
    return result;
  }
  let fixed_mass_kg =
    select(0.0, masses_kg.x, (wall_mask & 1u) != 0u)
      + select(0.0, masses_kg.y, (wall_mask & 2u) != 0u)
      + select(0.0, masses_kg.z, (wall_mask & 4u) != 0u)
      + select(0.0, masses_kg.w, (wall_mask & 8u) != 0u);
  if (!(fixed_mass_kg > 0.0) || !mechanical_solver_finite(fixed_mass_kg)) {
    result.valid = 0u;
    return result;
  }
  result.delta_j = vec4<f32>(
    select(
      0.0,
      wall_kinetic_delta_j * masses_kg.x / fixed_mass_kg,
      (wall_mask & 1u) != 0u
    ),
    select(
      0.0,
      wall_kinetic_delta_j * masses_kg.y / fixed_mass_kg,
      (wall_mask & 2u) != 0u
    ),
    select(
      0.0,
      wall_kinetic_delta_j * masses_kg.z / fixed_mass_kg,
      (wall_mask & 4u) != 0u
    ),
    select(
      0.0,
      wall_kinetic_delta_j * masses_kg.w / fixed_mass_kg,
      (wall_mask & 8u) != 0u
    )
  );
  return result;
}

fn mechanical_matching_four_block_box_wall_active_set(
  seed: MechanicalMatchingThreeBlockResult,
  primary_normal: vec3<f32>,
  secondary_normal: vec3<f32>,
  tertiary_normal: vec3<f32>,
  primary_pos_mass: vec4<f32>,
  center_pos_mass: vec4<f32>,
  secondary_pos_mass: vec4<f32>,
  tertiary_pos_mass: vec4<f32>,
  primary_velocity: vec3<f32>,
  center_velocity: vec3<f32>,
  secondary_velocity: vec3<f32>,
  tertiary_velocity: vec3<f32>,
  contact_primary_velocity: vec3<f32>,
  contact_center_velocity: vec3<f32>,
  contact_secondary_velocity: vec3<f32>,
  contact_tertiary_velocity: vec3<f32>,
  velocity_tolerance_m_per_s: f32
) -> MechanicalMatchingThreeBlockResult {
  var result = seed;
  let masses_kg = vec4<f32>(
    primary_pos_mass.w,
    center_pos_mass.w,
    secondary_pos_mass.w,
    tertiary_pos_mass.w
  );
  let x_axis = mechanical_matching_four_block_box_axis_active_set(
    seed.primary_index,
    seed.center_index,
    seed.secondary_index,
    seed.tertiary_index,
    primary_pos_mass.xyz,
    center_pos_mass.xyz,
    secondary_pos_mass.xyz,
    tertiary_pos_mass.xyz,
    vec3<f32>(1.0, 0.0, 0.0),
    primary_normal.x,
    secondary_normal.x,
    tertiary_normal.x,
    masses_kg,
    vec4<f32>(
      primary_velocity.x,
      center_velocity.x,
      secondary_velocity.x,
      tertiary_velocity.x
    ),
    velocity_tolerance_m_per_s
  );
  let y_axis = mechanical_matching_four_block_box_axis_active_set(
    seed.primary_index,
    seed.center_index,
    seed.secondary_index,
    seed.tertiary_index,
    primary_pos_mass.xyz,
    center_pos_mass.xyz,
    secondary_pos_mass.xyz,
    tertiary_pos_mass.xyz,
    vec3<f32>(0.0, 1.0, 0.0),
    primary_normal.y,
    secondary_normal.y,
    tertiary_normal.y,
    masses_kg,
    vec4<f32>(
      primary_velocity.y,
      center_velocity.y,
      secondary_velocity.y,
      tertiary_velocity.y
    ),
    velocity_tolerance_m_per_s
  );
  let z_axis = mechanical_matching_four_block_box_axis_active_set(
    seed.primary_index,
    seed.center_index,
    seed.secondary_index,
    seed.tertiary_index,
    primary_pos_mass.xyz,
    center_pos_mass.xyz,
    secondary_pos_mass.xyz,
    tertiary_pos_mass.xyz,
    vec3<f32>(0.0, 0.0, 1.0),
    primary_normal.z,
    secondary_normal.z,
    tertiary_normal.z,
    masses_kg,
    vec4<f32>(
      primary_velocity.z,
      center_velocity.z,
      secondary_velocity.z,
      tertiary_velocity.z
    ),
    velocity_tolerance_m_per_s
  );
  if (x_axis.valid == 0u || y_axis.valid == 0u || z_axis.valid == 0u) {
    return result;
  }
  let active_contact_mask = x_axis.contact_mask
    | y_axis.contact_mask
    | z_axis.contact_mask;
  if ((active_contact_mask & 7u) != 7u) { return result; }
  let resolved_primary_velocity = vec3<f32>(
    x_axis.velocity.x,
    y_axis.velocity.x,
    z_axis.velocity.x
  );
  let resolved_center_velocity = vec3<f32>(
    x_axis.velocity.y,
    y_axis.velocity.y,
    z_axis.velocity.y
  );
  let resolved_secondary_velocity = vec3<f32>(
    x_axis.velocity.z,
    y_axis.velocity.z,
    z_axis.velocity.z
  );
  let resolved_tertiary_velocity = vec3<f32>(
    x_axis.velocity.w,
    y_axis.velocity.w,
    z_axis.velocity.w
  );
  let primary_impulse = vec3<f32>(
    -primary_normal.x * x_axis.contact_lambda.x,
    -primary_normal.y * y_axis.contact_lambda.x,
    -primary_normal.z * z_axis.contact_lambda.x
  );
  let secondary_impulse = vec3<f32>(
    -secondary_normal.x * x_axis.contact_lambda.y,
    -secondary_normal.y * y_axis.contact_lambda.y,
    -secondary_normal.z * z_axis.contact_lambda.y
  );
  let tertiary_impulse = vec3<f32>(
    -tertiary_normal.x * x_axis.contact_lambda.z,
    -tertiary_normal.y * y_axis.contact_lambda.z,
    -tertiary_normal.z * z_axis.contact_lambda.z
  );
  let center_primary_impulse = -primary_impulse;
  let center_secondary_impulse = -secondary_impulse;
  let center_tertiary_impulse = -tertiary_impulse;
  let primary_residual = dot(
    resolved_center_velocity - resolved_primary_velocity,
    primary_normal
  );
  let secondary_residual = dot(
    resolved_center_velocity - resolved_secondary_velocity,
    secondary_normal
  );
  let tertiary_residual = dot(
    resolved_center_velocity - resolved_tertiary_velocity,
    tertiary_normal
  );
  let primary_contact_impulse = -dot(primary_impulse, primary_normal);
  let secondary_contact_impulse = -dot(
    secondary_impulse,
    secondary_normal
  );
  let tertiary_contact_impulse = -dot(
    tertiary_impulse,
    tertiary_normal
  );
  let impulse_conditioning = max(
    max(length(primary_impulse), length(secondary_impulse)),
    length(tertiary_impulse)
  );
  let impulse_tolerance = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(impulse_conditioning, 1.0e-6)
  );
  let pair_momentum_residual = primary_impulse
    + center_primary_impulse
    + secondary_impulse
    + center_secondary_impulse
    + tertiary_impulse
    + center_tertiary_impulse;
  if (
    !mechanical_solver_finite3(resolved_primary_velocity)
    || !mechanical_solver_finite3(resolved_center_velocity)
    || !mechanical_solver_finite3(resolved_secondary_velocity)
    || !mechanical_solver_finite3(resolved_tertiary_velocity)
    || !mechanical_solver_finite3(primary_impulse)
    || !mechanical_solver_finite3(secondary_impulse)
    || !mechanical_solver_finite3(tertiary_impulse)
    || !mechanical_solver_finite3(pair_momentum_residual)
    || !mechanical_solver_finite(primary_residual)
    || !mechanical_solver_finite(secondary_residual)
    || !mechanical_solver_finite(tertiary_residual)
    || primary_residual < -velocity_tolerance_m_per_s
    || secondary_residual < -velocity_tolerance_m_per_s
    || tertiary_residual < -velocity_tolerance_m_per_s
    || !(primary_contact_impulse > 0.0)
    || !(secondary_contact_impulse > 0.0)
    || !(tertiary_contact_impulse > 0.0)
    || length(primary_impulse
      + primary_contact_impulse * primary_normal) > impulse_tolerance
    || length(secondary_impulse
      + secondary_contact_impulse * secondary_normal) > impulse_tolerance
    || length(tertiary_impulse
      + tertiary_contact_impulse * tertiary_normal) > impulse_tolerance
    || length(pair_momentum_residual) > impulse_tolerance
  ) { return result; }
  let resolved_primary_wall = mechanical_matching_project_wall_velocity(
    seed.primary_index,
    primary_pos_mass.xyz,
    resolved_primary_velocity,
    primary_pos_mass.w
  );
  let resolved_center_wall = mechanical_matching_project_wall_velocity(
    seed.center_index,
    center_pos_mass.xyz,
    resolved_center_velocity,
    center_pos_mass.w
  );
  let resolved_secondary_wall = mechanical_matching_project_wall_velocity(
    seed.secondary_index,
    secondary_pos_mass.xyz,
    resolved_secondary_velocity,
    secondary_pos_mass.w
  );
  let resolved_tertiary_wall = mechanical_matching_project_wall_velocity(
    seed.tertiary_index,
    tertiary_pos_mass.xyz,
    resolved_tertiary_velocity,
    tertiary_pos_mass.w
  );
  if (
    resolved_primary_wall.valid == 0u
    || resolved_center_wall.valid == 0u
    || resolved_secondary_wall.valid == 0u
    || resolved_tertiary_wall.valid == 0u
    || resolved_primary_wall.clipped != 0u
    || resolved_center_wall.clipped != 0u
    || resolved_secondary_wall.clipped != 0u
    || resolved_tertiary_wall.clipped != 0u
  ) { return result; }
  let primary_pair_kinetic_delta_j = 0.5 * primary_pos_mass.w * (
    dot(contact_primary_velocity, contact_primary_velocity)
      - dot(primary_velocity, primary_velocity)
  );
  let center_pair_kinetic_delta_j = 0.5 * center_pos_mass.w * (
    dot(contact_center_velocity, contact_center_velocity)
      - dot(center_velocity, center_velocity)
  );
  let secondary_pair_kinetic_delta_j = 0.5 * secondary_pos_mass.w * (
    dot(contact_secondary_velocity, contact_secondary_velocity)
      - dot(secondary_velocity, secondary_velocity)
  );
  let tertiary_pair_kinetic_delta_j = 0.5 * tertiary_pos_mass.w * (
    dot(contact_tertiary_velocity, contact_tertiary_velocity)
      - dot(tertiary_velocity, tertiary_velocity)
  );
  let pair_kinetic_delta_j = primary_pair_kinetic_delta_j
    + center_pair_kinetic_delta_j
    + secondary_pair_kinetic_delta_j
    + tertiary_pair_kinetic_delta_j;
  let wall_kinetic_delta_x_j = 0.5 * dot(masses_kg, vec4<f32>(
    resolved_primary_velocity.x * resolved_primary_velocity.x
      - contact_primary_velocity.x * contact_primary_velocity.x,
    resolved_center_velocity.x * resolved_center_velocity.x
      - contact_center_velocity.x * contact_center_velocity.x,
    resolved_secondary_velocity.x * resolved_secondary_velocity.x
      - contact_secondary_velocity.x * contact_secondary_velocity.x,
    resolved_tertiary_velocity.x * resolved_tertiary_velocity.x
      - contact_tertiary_velocity.x * contact_tertiary_velocity.x
  ));
  let wall_kinetic_delta_y_j = 0.5 * dot(masses_kg, vec4<f32>(
    resolved_primary_velocity.y * resolved_primary_velocity.y
      - contact_primary_velocity.y * contact_primary_velocity.y,
    resolved_center_velocity.y * resolved_center_velocity.y
      - contact_center_velocity.y * contact_center_velocity.y,
    resolved_secondary_velocity.y * resolved_secondary_velocity.y
      - contact_secondary_velocity.y * contact_secondary_velocity.y,
    resolved_tertiary_velocity.y * resolved_tertiary_velocity.y
      - contact_tertiary_velocity.y * contact_tertiary_velocity.y
  ));
  let wall_kinetic_delta_z_j = 0.5 * dot(masses_kg, vec4<f32>(
    resolved_primary_velocity.z * resolved_primary_velocity.z
      - contact_primary_velocity.z * contact_primary_velocity.z,
    resolved_center_velocity.z * resolved_center_velocity.z
      - contact_center_velocity.z * contact_center_velocity.z,
    resolved_secondary_velocity.z * resolved_secondary_velocity.z
      - contact_secondary_velocity.z * contact_secondary_velocity.z,
    resolved_tertiary_velocity.z * resolved_tertiary_velocity.z
      - contact_tertiary_velocity.z * contact_tertiary_velocity.z
  ));
  let wall_kinetic_delta_j = wall_kinetic_delta_x_j
    + wall_kinetic_delta_y_j
    + wall_kinetic_delta_z_j;
  let total_kinetic_delta_j = 0.5 * dot(masses_kg, vec4<f32>(
    dot(resolved_primary_velocity, resolved_primary_velocity)
      - dot(primary_velocity, primary_velocity),
    dot(resolved_center_velocity, resolved_center_velocity)
      - dot(center_velocity, center_velocity),
    dot(resolved_secondary_velocity, resolved_secondary_velocity)
      - dot(secondary_velocity, secondary_velocity),
    dot(resolved_tertiary_velocity, resolved_tertiary_velocity)
      - dot(tertiary_velocity, tertiary_velocity)
  ));
  let kinetic_conditioning_j = 0.5 * dot(masses_kg, vec4<f32>(
    dot(primary_velocity, primary_velocity)
      + dot(contact_primary_velocity, contact_primary_velocity)
      + dot(resolved_primary_velocity, resolved_primary_velocity),
    dot(center_velocity, center_velocity)
      + dot(contact_center_velocity, contact_center_velocity)
      + dot(resolved_center_velocity, resolved_center_velocity),
    dot(secondary_velocity, secondary_velocity)
      + dot(contact_secondary_velocity, contact_secondary_velocity)
      + dot(resolved_secondary_velocity, resolved_secondary_velocity),
    dot(tertiary_velocity, tertiary_velocity)
      + dot(contact_tertiary_velocity, contact_tertiary_velocity)
      + dot(resolved_tertiary_velocity, resolved_tertiary_velocity)
  ));
  let kinetic_tolerance_j = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(kinetic_conditioning_j, 1.0e-6)
  );
  let x_wall_allocation = mechanical_matching_four_wall_energy_allocation(
    wall_kinetic_delta_x_j,
    masses_kg,
    x_axis.wall_mask,
    kinetic_tolerance_j
  );
  let y_wall_allocation = mechanical_matching_four_wall_energy_allocation(
    wall_kinetic_delta_y_j,
    masses_kg,
    y_axis.wall_mask,
    kinetic_tolerance_j
  );
  let z_wall_allocation = mechanical_matching_four_wall_energy_allocation(
    wall_kinetic_delta_z_j,
    masses_kg,
    z_axis.wall_mask,
    kinetic_tolerance_j
  );
  let wall_allocations = x_wall_allocation.delta_j
    + y_wall_allocation.delta_j
    + z_wall_allocation.delta_j;
  if (
    x_wall_allocation.valid == 0u
    || y_wall_allocation.valid == 0u
    || z_wall_allocation.valid == 0u
    || !mechanical_solver_finite(primary_pair_kinetic_delta_j)
    || !mechanical_solver_finite(center_pair_kinetic_delta_j)
    || !mechanical_solver_finite(secondary_pair_kinetic_delta_j)
    || !mechanical_solver_finite(tertiary_pair_kinetic_delta_j)
    || !mechanical_solver_finite(pair_kinetic_delta_j)
    || !mechanical_solver_finite(wall_kinetic_delta_x_j)
    || !mechanical_solver_finite(wall_kinetic_delta_y_j)
    || !mechanical_solver_finite(wall_kinetic_delta_z_j)
    || !mechanical_solver_finite(wall_kinetic_delta_j)
    || !mechanical_solver_finite(total_kinetic_delta_j)
    || !mechanical_solver_finite(wall_allocations.x)
    || !mechanical_solver_finite(wall_allocations.y)
    || !mechanical_solver_finite(wall_allocations.z)
    || !mechanical_solver_finite(wall_allocations.w)
    || pair_kinetic_delta_j > kinetic_tolerance_j
    || wall_kinetic_delta_x_j > kinetic_tolerance_j
    || wall_kinetic_delta_y_j > kinetic_tolerance_j
    || wall_kinetic_delta_z_j > kinetic_tolerance_j
    || wall_kinetic_delta_j > kinetic_tolerance_j
    || wall_allocations.x > kinetic_tolerance_j
    || wall_allocations.y > kinetic_tolerance_j
    || wall_allocations.z > kinetic_tolerance_j
    || wall_allocations.w > kinetic_tolerance_j
    || abs(total_kinetic_delta_j
      - pair_kinetic_delta_j
      - wall_kinetic_delta_j) > kinetic_tolerance_j
  ) { return result; }
  result.primary_velocity = resolved_primary_velocity;
  result.center_velocity = resolved_center_velocity;
  result.secondary_velocity = resolved_secondary_velocity;
  result.tertiary_velocity = resolved_tertiary_velocity;
  result.primary_kinetic_delta_j = primary_pair_kinetic_delta_j;
  result.center_kinetic_delta_j = center_pair_kinetic_delta_j;
  result.secondary_kinetic_delta_j = secondary_pair_kinetic_delta_j;
  result.tertiary_kinetic_delta_j = tertiary_pair_kinetic_delta_j;
  result.primary_wall_kinetic_delta_j = wall_allocations.x;
  result.center_wall_kinetic_delta_j = wall_allocations.y;
  result.secondary_wall_kinetic_delta_j = wall_allocations.z;
  result.tertiary_wall_kinetic_delta_j = wall_allocations.w;
  result.pair_heat_j = max(0.0, -pair_kinetic_delta_j);
  result.primary_impulse = primary_impulse;
  result.center_primary_impulse = center_primary_impulse;
  result.secondary_impulse = secondary_impulse;
  result.center_secondary_impulse = center_secondary_impulse;
  result.tertiary_impulse = tertiary_impulse;
  result.center_tertiary_impulse = center_tertiary_impulse;
  result.member_count = 4u;
  result.applied = 1u;
  return result;
}

// Merge two reciprocal matching edges joined by one previously processed
// bridge. The pair-level reciprocal choice gives exclusive ownership to the
// lexicographically later mutual pair. Besides making the production write
// race-free, that order lets the single-invocation diagnostic replay inspect
// the non-owner before the owner repurposes both pairs' selection scratch.
// This is the exact four-node path that a pairwise sweep otherwise contracts
// only by the small light/heavy mass ratio.
fn mechanical_matching_four_path_block(
  mutual_low: u32,
  mutual_high: u32,
  published_total: u32
) -> MechanicalMatchingThreeBlockResult {
  var result = mechanical_matching_zero_three_block();
  let candidate = mechanical_matching_four_path_candidate(
    mutual_low,
    mutual_high,
    published_total
  );
  if (candidate.valid == 0u) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  if (candidate.found == 0u) { return result; }
  let edge_0_low = min(candidate.body_0_index, candidate.body_1_index);
  let edge_0_high = max(candidate.body_0_index, candidate.body_1_index);
  let edge_2_low = min(candidate.body_2_index, candidate.body_3_index);
  let edge_2_high = max(candidate.body_2_index, candidate.body_3_index);
  let current_is_edge_0 = mutual_low == edge_0_low
    && mutual_high == edge_0_high;
  let current_is_edge_2 = mutual_low == edge_2_low
    && mutual_high == edge_2_high;
  if (!current_is_edge_0 && !current_is_edge_2) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  let partner_low = select(edge_0_low, edge_2_low, current_is_edge_0);
  let partner_high = select(edge_0_high, edge_2_high, current_is_edge_0);
  let reciprocal_candidate = mechanical_matching_four_path_candidate(
    partner_low,
    partner_high,
    published_total
  );
  if (reciprocal_candidate.valid == 0u) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  if (
    reciprocal_candidate.found == 0u
    || reciprocal_candidate.body_0_index != candidate.body_0_index
    || reciprocal_candidate.body_1_index != candidate.body_1_index
    || reciprocal_candidate.body_2_index != candidate.body_2_index
    || reciprocal_candidate.body_3_index != candidate.body_3_index
    || reciprocal_candidate.edge_1_forward_cursor
      != candidate.edge_1_forward_cursor
    || reciprocal_candidate.edge_1_reverse_cursor
      != candidate.edge_1_reverse_cursor
  ) { return result; }
  result.primary_index = candidate.body_0_index;
  result.center_index = candidate.body_1_index;
  result.secondary_index = candidate.body_2_index;
  result.tertiary_index = candidate.body_3_index;
  result.center_primary_cursor = candidate.edge_0_forward_cursor;
  result.primary_center_cursor = candidate.edge_0_reverse_cursor;
  result.center_secondary_cursor = candidate.edge_1_forward_cursor;
  result.secondary_center_cursor = candidate.edge_1_reverse_cursor;
  // For topology 1 these two legacy carrier fields name the 2--3 edge.
  result.center_tertiary_cursor = candidate.edge_2_forward_cursor;
  result.tertiary_center_cursor = candidate.edge_2_reverse_cursor;
  result.block_found = 1u;
  result.member_count = 4u;
  result.topology = 1u;
  result.path_owner = select(0u, 1u, mutual_low > partner_low);
  if (
    candidate.edge_0_forward_cursor >= published_total
    || candidate.edge_0_reverse_cursor >= published_total
    || candidate.edge_1_forward_cursor >= published_total
    || candidate.edge_1_reverse_cursor >= published_total
    || candidate.edge_2_forward_cursor >= published_total
    || candidate.edge_2_reverse_cursor >= published_total
    || mechanical_solver_peer_index(
      csr_peers[candidate.edge_0_forward_cursor]
    ) != candidate.body_0_index
    || mechanical_solver_peer_index(
      csr_peers[candidate.edge_0_reverse_cursor]
    ) != candidate.body_1_index
    || mechanical_solver_peer_index(
      csr_peers[candidate.edge_1_forward_cursor]
    ) != candidate.body_2_index
    || mechanical_solver_peer_index(
      csr_peers[candidate.edge_1_reverse_cursor]
    ) != candidate.body_1_index
    || mechanical_solver_peer_index(
      csr_peers[candidate.edge_2_forward_cursor]
    ) != candidate.body_3_index
    || mechanical_solver_peer_index(
      csr_peers[candidate.edge_2_reverse_cursor]
    ) != candidate.body_2_index
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  let edge_0_pair = mechanical_matching_constraint_pair(
    edge_0_low,
    edge_0_high,
    candidate.edge_0_forward_cursor
  );
  let edge_1_low = min(candidate.body_1_index, candidate.body_2_index);
  let edge_1_high = max(candidate.body_1_index, candidate.body_2_index);
  let edge_1_pair = mechanical_matching_constraint_pair(
    edge_1_low,
    edge_1_high,
    candidate.edge_1_forward_cursor
  );
  let edge_2_pair = mechanical_matching_constraint_pair(
    edge_2_low,
    edge_2_high,
    candidate.edge_2_forward_cursor
  );
  let edge_0_constraint =
    matching_constraints[candidate.edge_0_forward_cursor];
  let edge_0_reverse_constraint =
    matching_constraints[candidate.edge_0_reverse_cursor];
  let edge_1_constraint =
    matching_constraints[candidate.edge_1_forward_cursor];
  let edge_1_reverse_constraint =
    matching_constraints[candidate.edge_1_reverse_cursor];
  let edge_2_constraint =
    matching_constraints[candidate.edge_2_forward_cursor];
  let edge_2_reverse_constraint =
    matching_constraints[candidate.edge_2_reverse_cursor];
  if (
    edge_0_pair.valid == 0u
    || edge_1_pair.valid == 0u
    || edge_2_pair.valid == 0u
    || edge_0_pair.active_pair == 0u
    || edge_1_pair.active_pair == 0u
    || edge_2_pair.active_pair == 0u
    || edge_0_pair.unilateral == 0u
    || edge_1_pair.unilateral == 0u
    || edge_2_pair.unilateral == 0u
    || length(edge_0_constraint.xyz - edge_0_reverse_constraint.xyz)
      > 1.0e-5
    || length(edge_1_constraint.xyz - edge_1_reverse_constraint.xyz)
      > 1.0e-5
    || length(edge_2_constraint.xyz - edge_2_reverse_constraint.xyz)
      > 1.0e-5
    || edge_0_constraint.w != edge_0_reverse_constraint.w
    || edge_1_constraint.w != edge_1_reverse_constraint.w
    || edge_2_constraint.w != edge_2_reverse_constraint.w
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let body_0_pos_mass = input_state[candidate.body_0_index * 2u];
  let body_1_pos_mass = input_state[candidate.body_1_index * 2u];
  let body_2_pos_mass = input_state[candidate.body_2_index * 2u];
  let body_3_pos_mass = input_state[candidate.body_3_index * 2u];
  let body_0_velocity = input_state[candidate.body_0_index * 2u + 1u].xyz;
  let body_1_velocity = input_state[candidate.body_1_index * 2u + 1u].xyz;
  let body_2_velocity = input_state[candidate.body_2_index * 2u + 1u].xyz;
  let body_3_velocity = input_state[candidate.body_3_index * 2u + 1u].xyz;
  let masses_kg = vec4<f32>(
    body_0_pos_mass.w,
    body_1_pos_mass.w,
    body_2_pos_mass.w,
    body_3_pos_mass.w
  );
  if (
    !(masses_kg.x > 0.0)
    || !(masses_kg.y > 0.0)
    || !(masses_kg.z > 0.0)
    || !(masses_kg.w > 0.0)
    || !mechanical_solver_finite3(body_0_velocity)
    || !mechanical_solver_finite3(body_1_velocity)
    || !mechanical_solver_finite3(body_2_velocity)
    || !mechanical_solver_finite3(body_3_velocity)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let edge_0_normal = mechanical_matching_center_oriented_vector(
    candidate.body_1_index,
    candidate.body_0_index,
    mechanical_matching_constraint_normal(edge_0_constraint)
  );
  let edge_1_normal = mechanical_matching_center_oriented_vector(
    candidate.body_1_index,
    candidate.body_2_index,
    mechanical_matching_constraint_normal(edge_1_constraint)
  );
  let edge_2_normal = mechanical_matching_center_oriented_vector(
    candidate.body_2_index,
    candidate.body_3_index,
    mechanical_matching_constraint_normal(edge_2_constraint)
  );
  let edge_0_response = mechanical_matching_center_oriented_vector(
    candidate.body_1_index,
    candidate.body_0_index,
    edge_0_constraint.xyz
  );
  let edge_1_response = mechanical_matching_center_oriented_vector(
    candidate.body_1_index,
    candidate.body_2_index,
    edge_1_constraint.xyz
  );
  let edge_2_response = mechanical_matching_center_oriented_vector(
    candidate.body_2_index,
    candidate.body_3_index,
    edge_2_constraint.xyz
  );
  if (
    !mechanical_matching_axis_contact_normal_valid(edge_0_normal)
    || !mechanical_matching_axis_contact_normal_valid(edge_1_normal)
    || !mechanical_matching_axis_contact_normal_valid(edge_2_normal)
    || length(edge_0_response - edge_0_normal) > 1.0e-5
    || length(edge_1_response - edge_1_normal) > 1.0e-5
    || length(edge_2_response - edge_2_normal) > 1.0e-5
  ) { return result; }
  let edge_0_tolerance = mechanical_matching_position_tolerance(
    edge_0_low,
    edge_0_high
  );
  let edge_1_tolerance = mechanical_matching_position_tolerance(
    edge_1_low,
    edge_1_high
  );
  let edge_2_tolerance = mechanical_matching_position_tolerance(
    edge_2_low,
    edge_2_high
  );
  let edge_0_low_mass = input_state[edge_0_low * 2u].w;
  let edge_0_high_mass = input_state[edge_0_high * 2u].w;
  let edge_1_low_mass = input_state[edge_1_low * 2u].w;
  let edge_1_high_mass = input_state[edge_1_high * 2u].w;
  let edge_2_low_mass = input_state[edge_2_low * 2u].w;
  let edge_2_high_mass = input_state[edge_2_high * 2u].w;
  let edge_0_position_ratio = edge_0_pair.position_residual
    / edge_0_tolerance;
  let edge_1_position_ratio = edge_1_pair.position_residual
    / edge_1_tolerance;
  let edge_2_position_ratio = edge_2_pair.position_residual
    / edge_2_tolerance;
  let edge_0_update_ratio = length(edge_0_pair.barrier_dx)
    * (1.0 + edge_0_low_mass / edge_0_high_mass) / edge_0_tolerance;
  let edge_1_update_ratio = length(edge_1_pair.barrier_dx)
    * (1.0 + edge_1_low_mass / edge_1_high_mass) / edge_1_tolerance;
  let edge_2_update_ratio = length(edge_2_pair.barrier_dx)
    * (1.0 + edge_2_low_mass / edge_2_high_mass) / edge_2_tolerance;
  if (
    edge_0_position_ratio > 0.5
    || edge_1_position_ratio > 0.5
    || edge_2_position_ratio > 0.5
    || edge_0_update_ratio > 0.5
    || edge_1_update_ratio > 0.5
    || edge_2_update_ratio > 0.5
  ) { return result; }
  let x_axis = mechanical_matching_four_path_axis_active_set(
    edge_0_normal.x,
    edge_1_normal.x,
    edge_2_normal.x,
    masses_kg,
    vec4<f32>(
      body_0_velocity.x,
      body_1_velocity.x,
      body_2_velocity.x,
      body_3_velocity.x
    ),
    1.0e-5
  );
  let y_axis = mechanical_matching_four_path_axis_active_set(
    edge_0_normal.y,
    edge_1_normal.y,
    edge_2_normal.y,
    masses_kg,
    vec4<f32>(
      body_0_velocity.y,
      body_1_velocity.y,
      body_2_velocity.y,
      body_3_velocity.y
    ),
    1.0e-5
  );
  let z_axis = mechanical_matching_four_path_axis_active_set(
    edge_0_normal.z,
    edge_1_normal.z,
    edge_2_normal.z,
    masses_kg,
    vec4<f32>(
      body_0_velocity.z,
      body_1_velocity.z,
      body_2_velocity.z,
      body_3_velocity.z
    ),
    1.0e-5
  );
  if (x_axis.valid == 0u || y_axis.valid == 0u || z_axis.valid == 0u) {
    return result;
  }
  if (
    ((x_axis.contact_mask | y_axis.contact_mask | z_axis.contact_mask) & 7u)
      != 7u
  ) { return result; }
  let body_0_resolved_velocity = vec3<f32>(
    x_axis.velocity.x,
    y_axis.velocity.x,
    z_axis.velocity.x
  );
  let body_1_resolved_velocity = vec3<f32>(
    x_axis.velocity.y,
    y_axis.velocity.y,
    z_axis.velocity.y
  );
  let body_2_resolved_velocity = vec3<f32>(
    x_axis.velocity.z,
    y_axis.velocity.z,
    z_axis.velocity.z
  );
  let body_3_resolved_velocity = vec3<f32>(
    x_axis.velocity.w,
    y_axis.velocity.w,
    z_axis.velocity.w
  );
  let edge_0_residual = dot(
    body_1_resolved_velocity - body_0_resolved_velocity,
    edge_0_normal
  );
  let edge_1_residual = dot(
    body_1_resolved_velocity - body_2_resolved_velocity,
    edge_1_normal
  );
  let edge_2_residual = dot(
    body_2_resolved_velocity - body_3_resolved_velocity,
    edge_2_normal
  );
  if (
    edge_0_residual < -1.0e-5
    || edge_1_residual < -1.0e-5
    || edge_2_residual < -1.0e-5
  ) { return result; }
  let body_0_wall = mechanical_matching_project_wall_velocity(
    candidate.body_0_index,
    body_0_pos_mass.xyz,
    body_0_resolved_velocity,
    body_0_pos_mass.w
  );
  let body_1_wall = mechanical_matching_project_wall_velocity(
    candidate.body_1_index,
    body_1_pos_mass.xyz,
    body_1_resolved_velocity,
    body_1_pos_mass.w
  );
  let body_2_wall = mechanical_matching_project_wall_velocity(
    candidate.body_2_index,
    body_2_pos_mass.xyz,
    body_2_resolved_velocity,
    body_2_pos_mass.w
  );
  let body_3_wall = mechanical_matching_project_wall_velocity(
    candidate.body_3_index,
    body_3_pos_mass.xyz,
    body_3_resolved_velocity,
    body_3_pos_mass.w
  );
  if (
    body_0_wall.valid == 0u
    || body_1_wall.valid == 0u
    || body_2_wall.valid == 0u
    || body_3_wall.valid == 0u
    || body_0_wall.clipped != 0u
    || body_1_wall.clipped != 0u
    || body_2_wall.clipped != 0u
    || body_3_wall.clipped != 0u
  ) { return result; }
  let body_0_impulse = body_0_pos_mass.w
    * (body_0_wall.velocity - body_0_velocity);
  let body_1_impulse = body_1_pos_mass.w
    * (body_1_wall.velocity - body_1_velocity);
  let body_2_impulse = body_2_pos_mass.w
    * (body_2_wall.velocity - body_2_velocity);
  let body_3_impulse = body_3_pos_mass.w
    * (body_3_wall.velocity - body_3_velocity);
  let edge_0_lambda = -dot(body_0_impulse, edge_0_normal);
  let edge_2_lambda = -dot(body_3_impulse, edge_2_normal);
  let edge_0_body_1_impulse = edge_0_lambda * edge_0_normal;
  let edge_1_lambda = dot(
    body_1_impulse - edge_0_body_1_impulse,
    edge_1_normal
  );
  let edge_1_body_1_impulse = edge_1_lambda * edge_1_normal;
  let edge_1_body_2_impulse = -edge_1_body_1_impulse;
  let edge_2_body_2_impulse = edge_2_lambda * edge_2_normal;
  let edge_0_body_0_impulse = -edge_0_body_1_impulse;
  let edge_2_body_3_impulse = -edge_2_body_2_impulse;
  let impulse_conditioning = length(body_0_impulse)
    + length(body_1_impulse)
    + length(body_2_impulse)
    + length(body_3_impulse);
  let impulse_tolerance = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(impulse_conditioning, 1.0e-6)
  );
  if (
    !(edge_0_lambda > 0.0)
    || !(edge_1_lambda > 0.0)
    || !(edge_2_lambda > 0.0)
    || length(body_0_impulse - edge_0_body_0_impulse)
      > impulse_tolerance
    || length(
      body_1_impulse
        - edge_0_body_1_impulse
        - edge_1_body_1_impulse
    ) > impulse_tolerance
    || length(
      body_2_impulse
        - edge_1_body_2_impulse
        - edge_2_body_2_impulse
    ) > impulse_tolerance
    || length(body_3_impulse - edge_2_body_3_impulse)
      > impulse_tolerance
    || length(
      body_0_impulse + body_1_impulse
        + body_2_impulse + body_3_impulse
    ) > impulse_tolerance
  ) { return result; }
  let body_0_kinetic_delta_j = 0.5 * body_0_pos_mass.w * (
    dot(body_0_wall.velocity, body_0_wall.velocity)
      - dot(body_0_velocity, body_0_velocity)
  );
  let body_1_kinetic_delta_j = 0.5 * body_1_pos_mass.w * (
    dot(body_1_wall.velocity, body_1_wall.velocity)
      - dot(body_1_velocity, body_1_velocity)
  );
  let body_2_kinetic_delta_j = 0.5 * body_2_pos_mass.w * (
    dot(body_2_wall.velocity, body_2_wall.velocity)
      - dot(body_2_velocity, body_2_velocity)
  );
  let body_3_kinetic_delta_j = 0.5 * body_3_pos_mass.w * (
    dot(body_3_wall.velocity, body_3_wall.velocity)
      - dot(body_3_velocity, body_3_velocity)
  );
  let aggregate_kinetic_delta_j = body_0_kinetic_delta_j
    + body_1_kinetic_delta_j
    + body_2_kinetic_delta_j
    + body_3_kinetic_delta_j;
  let kinetic_conditioning_j = 0.5 * dot(masses_kg, vec4<f32>(
    dot(body_0_velocity, body_0_velocity)
      + dot(body_0_wall.velocity, body_0_wall.velocity),
    dot(body_1_velocity, body_1_velocity)
      + dot(body_1_wall.velocity, body_1_wall.velocity),
    dot(body_2_velocity, body_2_velocity)
      + dot(body_2_wall.velocity, body_2_wall.velocity),
    dot(body_3_velocity, body_3_velocity)
      + dot(body_3_wall.velocity, body_3_wall.velocity)
  ));
  let kinetic_tolerance_j = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(kinetic_conditioning_j, 1.0e-6)
  );
  if (
    !mechanical_solver_finite(aggregate_kinetic_delta_j)
    || aggregate_kinetic_delta_j > kinetic_tolerance_j
  ) { return result; }
  result.primary_velocity = body_0_wall.velocity;
  result.center_velocity = body_1_wall.velocity;
  result.secondary_velocity = body_2_wall.velocity;
  result.tertiary_velocity = body_3_wall.velocity;
  result.primary_kinetic_delta_j = body_0_kinetic_delta_j;
  result.center_kinetic_delta_j = body_1_kinetic_delta_j;
  result.secondary_kinetic_delta_j = body_2_kinetic_delta_j;
  result.tertiary_kinetic_delta_j = body_3_kinetic_delta_j;
  result.primary_wall_kinetic_delta_j = body_0_wall.kinetic_delta_j;
  result.center_wall_kinetic_delta_j = body_1_wall.kinetic_delta_j;
  result.secondary_wall_kinetic_delta_j = body_2_wall.kinetic_delta_j;
  result.tertiary_wall_kinetic_delta_j = body_3_wall.kinetic_delta_j;
  result.pair_heat_j = max(0.0, -aggregate_kinetic_delta_j);
  result.primary_impulse = edge_0_body_0_impulse;
  result.center_primary_impulse = edge_0_body_1_impulse;
  result.center_secondary_impulse = edge_1_body_1_impulse;
  result.secondary_impulse = edge_1_body_2_impulse;
  result.center_tertiary_impulse = edge_2_body_2_impulse;
  result.tertiary_impulse = edge_2_body_3_impulse;
  result.applied = 1u;
  return result;
}

// Extend the proven three-body helper only for the degree-three contact star.
// Contact-only cases use the lighter eight-mask projection; wall-coupled
// cases use the exact 16 x 8 per-axis active set above.
fn mechanical_matching_four_block(
  seed: MechanicalMatchingThreeBlockResult,
  primary_pair: MechanicalPairResidual,
  secondary_pair: MechanicalPairResidual,
  tertiary_pair: MechanicalPairResidual
) -> MechanicalMatchingThreeBlockResult {
  var result = seed;
  if (
    seed.center_index >= mechanical_params.particle_count
    || seed.primary_index >= mechanical_params.particle_count
    || seed.secondary_index >= mechanical_params.particle_count
    || seed.tertiary_index >= mechanical_params.particle_count
    || seed.center_index == seed.primary_index
    || seed.center_index == seed.secondary_index
    || seed.center_index == seed.tertiary_index
    || seed.primary_index == seed.secondary_index
    || seed.primary_index == seed.tertiary_index
    || seed.secondary_index == seed.tertiary_index
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  let primary_pos_mass = input_state[seed.primary_index * 2u];
  let center_pos_mass = input_state[seed.center_index * 2u];
  let secondary_pos_mass = input_state[seed.secondary_index * 2u];
  let tertiary_pos_mass = input_state[seed.tertiary_index * 2u];
  if (
    !(primary_pos_mass.w > center_pos_mass.w)
    || !(secondary_pos_mass.w > center_pos_mass.w)
    || !(tertiary_pos_mass.w > center_pos_mass.w)
    || !(center_pos_mass.w > 0.0)
    || !mechanical_solver_finite3(primary_pos_mass.xyz)
    || !mechanical_solver_finite3(center_pos_mass.xyz)
    || !mechanical_solver_finite3(secondary_pos_mass.xyz)
    || !mechanical_solver_finite3(tertiary_pos_mass.xyz)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let center_primary_constraint =
    matching_constraints[seed.center_primary_cursor];
  let primary_center_constraint =
    matching_constraints[seed.primary_center_cursor];
  let center_secondary_constraint =
    matching_constraints[seed.center_secondary_cursor];
  let secondary_center_constraint =
    matching_constraints[seed.secondary_center_cursor];
  let center_tertiary_constraint =
    matching_constraints[seed.center_tertiary_cursor];
  let tertiary_center_constraint =
    matching_constraints[seed.tertiary_center_cursor];
  if (
    primary_pair.valid == 0u
    || secondary_pair.valid == 0u
    || tertiary_pair.valid == 0u
    || primary_pair.active_pair == 0u
    || secondary_pair.active_pair == 0u
    || tertiary_pair.active_pair == 0u
    || primary_pair.unilateral == 0u
    || secondary_pair.unilateral == 0u
    || tertiary_pair.unilateral == 0u
    || length(
      center_primary_constraint.xyz - primary_center_constraint.xyz
    ) > 1.0e-5
    || length(
      center_secondary_constraint.xyz - secondary_center_constraint.xyz
    ) > 1.0e-5
    || length(
      center_tertiary_constraint.xyz - tertiary_center_constraint.xyz
    ) > 1.0e-5
    || center_primary_constraint.w != primary_center_constraint.w
    || center_secondary_constraint.w != secondary_center_constraint.w
    || center_tertiary_constraint.w != tertiary_center_constraint.w
    || !mechanical_matching_constraint_code_valid(
      center_primary_constraint
    )
    || !mechanical_matching_constraint_code_valid(
      center_secondary_constraint
    )
    || !mechanical_matching_constraint_code_valid(
      center_tertiary_constraint
    )
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let primary_normal = mechanical_matching_center_oriented_vector(
    seed.center_index,
    seed.primary_index,
    mechanical_matching_constraint_normal(center_primary_constraint)
  );
  let secondary_normal = mechanical_matching_center_oriented_vector(
    seed.center_index,
    seed.secondary_index,
    mechanical_matching_constraint_normal(center_secondary_constraint)
  );
  let tertiary_normal = mechanical_matching_center_oriented_vector(
    seed.center_index,
    seed.tertiary_index,
    mechanical_matching_constraint_normal(center_tertiary_constraint)
  );
  let primary_response = mechanical_matching_center_oriented_vector(
    seed.center_index,
    seed.primary_index,
    center_primary_constraint.xyz
  );
  let secondary_response = mechanical_matching_center_oriented_vector(
    seed.center_index,
    seed.secondary_index,
    center_secondary_constraint.xyz
  );
  let tertiary_response = mechanical_matching_center_oriented_vector(
    seed.center_index,
    seed.tertiary_index,
    center_tertiary_constraint.xyz
  );
  if (
    !mechanical_matching_axis_contact_normal_valid(primary_normal)
    || !mechanical_matching_axis_contact_normal_valid(secondary_normal)
    || !mechanical_matching_axis_contact_normal_valid(tertiary_normal)
    || !mechanical_solver_finite3(primary_response)
    || !mechanical_solver_finite3(secondary_response)
    || !mechanical_solver_finite3(tertiary_response)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (
    length(primary_response - primary_normal) > 1.0e-5
    || length(secondary_response - secondary_normal) > 1.0e-5
    || length(tertiary_response - tertiary_normal) > 1.0e-5
    || dot(primary_response, primary_normal) <= 1.0e-6
    || dot(secondary_response, secondary_normal) <= 1.0e-6
    || dot(tertiary_response, tertiary_normal) <= 1.0e-6
  ) { return seed; }
  let primary_low = min(seed.center_index, seed.primary_index);
  let primary_high = max(seed.center_index, seed.primary_index);
  let secondary_low = min(seed.center_index, seed.secondary_index);
  let secondary_high = max(seed.center_index, seed.secondary_index);
  let tertiary_low = min(seed.center_index, seed.tertiary_index);
  let tertiary_high = max(seed.center_index, seed.tertiary_index);
  let primary_tolerance =
    mechanical_matching_position_tolerance(primary_low, primary_high);
  let secondary_tolerance =
    mechanical_matching_position_tolerance(secondary_low, secondary_high);
  let tertiary_tolerance =
    mechanical_matching_position_tolerance(tertiary_low, tertiary_high);
  let primary_low_mass = input_state[primary_low * 2u].w;
  let primary_high_mass = input_state[primary_high * 2u].w;
  let secondary_low_mass = input_state[secondary_low * 2u].w;
  let secondary_high_mass = input_state[secondary_high * 2u].w;
  let tertiary_low_mass = input_state[tertiary_low * 2u].w;
  let tertiary_high_mass = input_state[tertiary_high * 2u].w;
  let primary_position_ratio =
    primary_pair.position_residual / primary_tolerance;
  let secondary_position_ratio =
    secondary_pair.position_residual / secondary_tolerance;
  let tertiary_position_ratio =
    tertiary_pair.position_residual / tertiary_tolerance;
  let primary_update_ratio = length(primary_pair.barrier_dx)
    * (1.0 + primary_low_mass / primary_high_mass)
    / primary_tolerance;
  let secondary_update_ratio = length(secondary_pair.barrier_dx)
    * (1.0 + secondary_low_mass / secondary_high_mass)
    / secondary_tolerance;
  let tertiary_update_ratio = length(tertiary_pair.barrier_dx)
    * (1.0 + tertiary_low_mass / tertiary_high_mass)
    / tertiary_tolerance;
  if (
    !mechanical_solver_finite(primary_position_ratio)
    || !mechanical_solver_finite(secondary_position_ratio)
    || !mechanical_solver_finite(tertiary_position_ratio)
    || !mechanical_solver_finite(primary_update_ratio)
    || !mechanical_solver_finite(secondary_update_ratio)
    || !mechanical_solver_finite(tertiary_update_ratio)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (
    primary_position_ratio > 0.5
    || secondary_position_ratio > 0.5
    || tertiary_position_ratio > 0.5
    || primary_update_ratio > 0.5
    || secondary_update_ratio > 0.5
    || tertiary_update_ratio > 0.5
  ) { return seed; }
  let primary_velocity = input_state[seed.primary_index * 2u + 1u].xyz;
  let center_velocity = input_state[seed.center_index * 2u + 1u].xyz;
  let secondary_velocity =
    input_state[seed.secondary_index * 2u + 1u].xyz;
  let tertiary_velocity =
    input_state[seed.tertiary_index * 2u + 1u].xyz;
  let primary_relative_velocity = dot(
    center_velocity - primary_velocity,
    primary_normal
  );
  if (
    !mechanical_solver_finite3(primary_velocity)
    || !mechanical_solver_finite3(center_velocity)
    || !mechanical_solver_finite3(secondary_velocity)
    || !mechanical_solver_finite3(tertiary_velocity)
    || !mechanical_solver_finite(primary_relative_velocity)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (!(primary_relative_velocity < -1.0e-5)) { return seed; }
  let masses_kg = vec4<f32>(
    primary_pos_mass.w,
    center_pos_mass.w,
    secondary_pos_mass.w,
    tertiary_pos_mass.w
  );
  let x_axis = mechanical_matching_four_block_axis_active_set(
    primary_normal.x,
    secondary_normal.x,
    tertiary_normal.x,
    masses_kg,
    vec4<f32>(
      primary_velocity.x,
      center_velocity.x,
      secondary_velocity.x,
      tertiary_velocity.x
    ),
    1.0e-5
  );
  let y_axis = mechanical_matching_four_block_axis_active_set(
    primary_normal.y,
    secondary_normal.y,
    tertiary_normal.y,
    masses_kg,
    vec4<f32>(
      primary_velocity.y,
      center_velocity.y,
      secondary_velocity.y,
      tertiary_velocity.y
    ),
    1.0e-5
  );
  let z_axis = mechanical_matching_four_block_axis_active_set(
    primary_normal.z,
    secondary_normal.z,
    tertiary_normal.z,
    masses_kg,
    vec4<f32>(
      primary_velocity.z,
      center_velocity.z,
      secondary_velocity.z,
      tertiary_velocity.z
    ),
    1.0e-5
  );
  if (x_axis.valid == 0u || y_axis.valid == 0u || z_axis.valid == 0u) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let active_contact_mask = x_axis.contact_mask
    | y_axis.contact_mask
    | z_axis.contact_mask;
  if ((active_contact_mask & 7u) != 7u) { return seed; }
  let proposed_primary_velocity =
    vec3<f32>(x_axis.velocity.x, y_axis.velocity.x, z_axis.velocity.x);
  let proposed_center_velocity =
    vec3<f32>(x_axis.velocity.y, y_axis.velocity.y, z_axis.velocity.y);
  let proposed_secondary_velocity =
    vec3<f32>(x_axis.velocity.z, y_axis.velocity.z, z_axis.velocity.z);
  let proposed_tertiary_velocity =
    vec3<f32>(x_axis.velocity.w, y_axis.velocity.w, z_axis.velocity.w);
  let primary_residual = dot(
    proposed_center_velocity - proposed_primary_velocity,
    primary_normal
  );
  let secondary_residual = dot(
    proposed_center_velocity - proposed_secondary_velocity,
    secondary_normal
  );
  let tertiary_residual = dot(
    proposed_center_velocity - proposed_tertiary_velocity,
    tertiary_normal
  );
  if (
    !mechanical_solver_finite3(proposed_primary_velocity)
    || !mechanical_solver_finite3(proposed_center_velocity)
    || !mechanical_solver_finite3(proposed_secondary_velocity)
    || !mechanical_solver_finite3(proposed_tertiary_velocity)
    || !mechanical_solver_finite(primary_residual)
    || !mechanical_solver_finite(secondary_residual)
    || !mechanical_solver_finite(tertiary_residual)
    || primary_residual < -1.0e-5
    || secondary_residual < -1.0e-5
    || tertiary_residual < -1.0e-5
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let primary_wall = mechanical_matching_project_wall_velocity(
    seed.primary_index,
    primary_pos_mass.xyz,
    proposed_primary_velocity,
    primary_pos_mass.w
  );
  let center_wall = mechanical_matching_project_wall_velocity(
    seed.center_index,
    center_pos_mass.xyz,
    proposed_center_velocity,
    center_pos_mass.w
  );
  let secondary_wall = mechanical_matching_project_wall_velocity(
    seed.secondary_index,
    secondary_pos_mass.xyz,
    proposed_secondary_velocity,
    secondary_pos_mass.w
  );
  let tertiary_wall = mechanical_matching_project_wall_velocity(
    seed.tertiary_index,
    tertiary_pos_mass.xyz,
    proposed_tertiary_velocity,
    tertiary_pos_mass.w
  );
  if (
    primary_wall.valid == 0u
    || center_wall.valid == 0u
    || secondary_wall.valid == 0u
    || tertiary_wall.valid == 0u
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (
    primary_wall.clipped != 0u
    || center_wall.clipped != 0u
    || secondary_wall.clipped != 0u
    || tertiary_wall.clipped != 0u
  ) {
    return mechanical_matching_four_block_box_wall_active_set(
      seed,
      primary_normal,
      secondary_normal,
      tertiary_normal,
      primary_pos_mass,
      center_pos_mass,
      secondary_pos_mass,
      tertiary_pos_mass,
      primary_velocity,
      center_velocity,
      secondary_velocity,
      tertiary_velocity,
      proposed_primary_velocity,
      proposed_center_velocity,
      proposed_secondary_velocity,
      proposed_tertiary_velocity,
      1.0e-5
    );
  }
  let primary_kinetic_delta_j = 0.5 * primary_pos_mass.w * (
    dot(primary_wall.velocity, primary_wall.velocity)
      - dot(primary_velocity, primary_velocity)
  );
  let center_kinetic_delta_j = 0.5 * center_pos_mass.w * (
    dot(center_wall.velocity, center_wall.velocity)
      - dot(center_velocity, center_velocity)
  );
  let secondary_kinetic_delta_j = 0.5 * secondary_pos_mass.w * (
    dot(secondary_wall.velocity, secondary_wall.velocity)
      - dot(secondary_velocity, secondary_velocity)
  );
  let tertiary_kinetic_delta_j = 0.5 * tertiary_pos_mass.w * (
    dot(tertiary_wall.velocity, tertiary_wall.velocity)
      - dot(tertiary_velocity, tertiary_velocity)
  );
  let primary_impulse = primary_pos_mass.w
    * (primary_wall.velocity - primary_velocity);
  let center_impulse = center_pos_mass.w
    * (center_wall.velocity - center_velocity);
  let secondary_impulse = secondary_pos_mass.w
    * (secondary_wall.velocity - secondary_velocity);
  let tertiary_impulse = tertiary_pos_mass.w
    * (tertiary_wall.velocity - tertiary_velocity);
  let primary_contact_impulse = -dot(primary_impulse, primary_normal);
  let secondary_contact_impulse = -dot(
    secondary_impulse,
    secondary_normal
  );
  let tertiary_contact_impulse = -dot(
    tertiary_impulse,
    tertiary_normal
  );
  let impulse_conditioning = max(
    max(length(primary_impulse), length(secondary_impulse)),
    length(tertiary_impulse)
  );
  let impulse_tolerance = max(
    1.0e-10,
    128.0 * 1.1920929e-7 * max(impulse_conditioning, 1.0e-6)
  );
  if (
    !(primary_contact_impulse > 0.0)
    || !(secondary_contact_impulse > 0.0)
    || !(tertiary_contact_impulse > 0.0)
    || length(
      primary_impulse + primary_contact_impulse * primary_normal
    ) > impulse_tolerance
    || length(
      secondary_impulse + secondary_contact_impulse * secondary_normal
    ) > impulse_tolerance
    || length(
      tertiary_impulse + tertiary_contact_impulse * tertiary_normal
    ) > impulse_tolerance
  ) { return seed; }
  let aggregate_kinetic_delta_j = primary_kinetic_delta_j
    + center_kinetic_delta_j
    + secondary_kinetic_delta_j
    + tertiary_kinetic_delta_j;
  let aggregate_momentum_residual = primary_impulse
    + center_impulse
    + secondary_impulse
    + tertiary_impulse;
  let momentum_conditioning = length(primary_impulse)
    + length(center_impulse)
    + length(secondary_impulse)
    + length(tertiary_impulse);
  let momentum_tolerance = max(
    1.0e-6,
    256.0 * 1.1920929e-7 * max(momentum_conditioning, 1.0)
  );
  let kinetic_conditioning_j = 0.5 * (
    primary_pos_mass.w * (
      dot(primary_velocity, primary_velocity)
        + dot(primary_wall.velocity, primary_wall.velocity)
    )
      + center_pos_mass.w * (
        dot(center_velocity, center_velocity)
          + dot(center_wall.velocity, center_wall.velocity)
      )
      + secondary_pos_mass.w * (
        dot(secondary_velocity, secondary_velocity)
          + dot(secondary_wall.velocity, secondary_wall.velocity)
      )
      + tertiary_pos_mass.w * (
        dot(tertiary_velocity, tertiary_velocity)
          + dot(tertiary_wall.velocity, tertiary_wall.velocity)
      )
  );
  let kinetic_tolerance_j = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(kinetic_conditioning_j, 1.0e-6)
  );
  if (
    !mechanical_solver_finite(primary_kinetic_delta_j)
    || !mechanical_solver_finite(center_kinetic_delta_j)
    || !mechanical_solver_finite(secondary_kinetic_delta_j)
    || !mechanical_solver_finite(tertiary_kinetic_delta_j)
    || !mechanical_solver_finite(aggregate_kinetic_delta_j)
    || !mechanical_solver_finite3(primary_impulse)
    || !mechanical_solver_finite3(center_impulse)
    || !mechanical_solver_finite3(secondary_impulse)
    || !mechanical_solver_finite3(tertiary_impulse)
    || !mechanical_solver_finite3(aggregate_momentum_residual)
    || length(aggregate_momentum_residual) > momentum_tolerance
    || aggregate_kinetic_delta_j > kinetic_tolerance_j
  ) {
    result.failure_code = select(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
      mechanical_solver_finite(aggregate_kinetic_delta_j)
        && aggregate_kinetic_delta_j > kinetic_tolerance_j
    );
    result.valid = 0u;
    return result;
  }
  result.primary_velocity = primary_wall.velocity;
  result.center_velocity = center_wall.velocity;
  result.secondary_velocity = secondary_wall.velocity;
  result.tertiary_velocity = tertiary_wall.velocity;
  result.primary_kinetic_delta_j = primary_kinetic_delta_j;
  result.center_kinetic_delta_j = center_kinetic_delta_j;
  result.secondary_kinetic_delta_j = secondary_kinetic_delta_j;
  result.tertiary_kinetic_delta_j = tertiary_kinetic_delta_j;
  result.primary_wall_kinetic_delta_j = primary_wall.kinetic_delta_j;
  result.center_wall_kinetic_delta_j = center_wall.kinetic_delta_j;
  result.secondary_wall_kinetic_delta_j = secondary_wall.kinetic_delta_j;
  result.tertiary_wall_kinetic_delta_j = tertiary_wall.kinetic_delta_j;
  result.pair_heat_j = max(0.0, -aggregate_kinetic_delta_j);
  result.primary_impulse = primary_impulse;
  result.center_primary_impulse = -primary_impulse;
  result.secondary_impulse = secondary_impulse;
  result.center_secondary_impulse = -secondary_impulse;
  result.tertiary_impulse = tertiary_impulse;
  result.center_tertiary_impulse = -tertiary_impulse;
  result.member_count = 4u;
  result.applied = 1u;
  return result;
}

// A lighter carrier constrained by heavier peers is a coupled star, not a
// sequence of independent pair projections. Detect the race-free selection
// shape rooted at one mutual primary edge, retain the top two deterministic
// inbound selectors, and attempt the four-body projection before the proven
// three-body fallback. This helper is shared by production and diagnostic
// replay and intentionally performs no storage writes or atomics.
fn mechanical_matching_three_block(
  mutual_low: u32,
  mutual_high: u32,
  low_cursor: u32,
  high_cursor: u32,
  published_total: u32
) -> MechanicalMatchingThreeBlockResult {
  var result = mechanical_matching_zero_three_block();
  if (
    mutual_low >= mutual_high
    || mutual_high >= mechanical_params.particle_count
    || published_total > arrayLength(&csr_peers)
    || published_total > arrayLength(&matching_constraints)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  let low_begin = source_offsets[mutual_low];
  let low_end = source_offsets[mutual_low + 1u];
  let high_begin = source_offsets[mutual_high];
  let high_end = source_offsets[mutual_high + 1u];
  if (
    low_begin > low_end
    || high_begin > high_end
    || low_end > published_total
    || high_end > published_total
    || low_cursor < low_begin
    || low_cursor >= low_end
    || high_cursor < high_begin
    || high_cursor >= high_end
    || mechanical_solver_peer_index(csr_peers[low_cursor]) != mutual_high
    || mechanical_solver_peer_index(csr_peers[high_cursor]) != mutual_low
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  let low_constraint = matching_constraints[low_cursor];
  let high_constraint = matching_constraints[high_cursor];
  let primary_pair = mechanical_matching_constraint_pair(
    mutual_low,
    mutual_high,
    low_cursor
  );
  if (
    primary_pair.valid == 0u
    || length(low_constraint.xyz - high_constraint.xyz) > 1.0e-5
    || !mechanical_matching_constraint_code_valid(low_constraint)
    || !mechanical_matching_constraint_code_valid(high_constraint)
    || low_constraint.w != high_constraint.w
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (primary_pair.active_pair == 0u || primary_pair.unilateral == 0u) {
    return result;
  }
  let low_pos_mass = input_state[mutual_low * 2u];
  let high_pos_mass = input_state[mutual_high * 2u];
  if (
    !(low_pos_mass.w > 0.0)
    || !(high_pos_mass.w > 0.0)
    || !mechanical_solver_finite3(low_pos_mass.xyz)
    || !mechanical_solver_finite3(high_pos_mass.xyz)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (low_pos_mass.w == high_pos_mass.w) { return result; }
  let center_is_low = low_pos_mass.w < high_pos_mass.w;
  let center_index = select(mutual_high, mutual_low, center_is_low);
  let primary_index = select(mutual_low, mutual_high, center_is_low);
  let center_pos_mass = select(high_pos_mass, low_pos_mass, center_is_low);
  let primary_pos_mass = select(low_pos_mass, high_pos_mass, center_is_low);
  let center_primary_cursor = select(
    high_cursor,
    low_cursor,
    center_is_low
  );
  let primary_center_cursor = select(
    low_cursor,
    high_cursor,
    center_is_low
  );
  result.center_index = center_index;
  result.primary_index = primary_index;
  result.center_primary_cursor = center_primary_cursor;
  result.primary_center_cursor = primary_center_cursor;
  // The exact active-set projection below is valid for every positive mass
  // triple. Mass only orients ownership around one strictly lighter center;
  // a ratio threshold would strand otherwise solvable unequal-mass blocks.
  if (primary_pos_mass.w <= center_pos_mass.w) { return result; }

  let center_begin = source_offsets[center_index];
  let center_end = source_offsets[center_index + 1u];
  if (center_begin > center_end || center_end > published_total) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
    result.valid = 0u;
    return result;
  }
  var eligible_inbound_count = 0u;
  var secondary_index = 0xffffffffu;
  var center_secondary_cursor = 0xffffffffu;
  var secondary_center_cursor = 0xffffffffu;
  var secondary_pair = mechanical_solver_zero_pair(1u);
  var secondary_priority = -1.0;
  var secondary_face_alignment = 0.0;
  var secondary_rank = 0xffffffffu;
  var secondary_order_low = 0xffffffffu;
  var secondary_order_high = 0xffffffffu;
  var tertiary_index = 0xffffffffu;
  var center_tertiary_cursor = 0xffffffffu;
  var tertiary_center_cursor = 0xffffffffu;
  var tertiary_pair = mechanical_solver_zero_pair(1u);
  var tertiary_priority = -1.0;
  var tertiary_face_alignment = 0.0;
  var tertiary_rank = 0xffffffffu;
  var tertiary_order_low = 0xffffffffu;
  var tertiary_order_high = 0xffffffffu;
  for (
    var cursor = center_begin;
    cursor < center_end;
    cursor = cursor + 1u
  ) {
    let candidate_index =
      mechanical_solver_peer_index(csr_peers[cursor]);
    if (
      candidate_index == primary_index
      || candidate_index >= mechanical_params.particle_count
    ) { continue; }
    let candidate_selection =
      energy_ledger[mechanical_energy_base(candidate_index)];
    let candidate_selected_peer = bitcast<u32>(candidate_selection.x);
    var candidate_cursor = bitcast<u32>(candidate_selection.z);
    var uses_independent_reservation = false;
    if (candidate_selected_peer != center_index) {
      candidate_cursor = bitcast<u32>(candidate_selection.w);
      uses_independent_reservation = true;
      // A vertex in another reciprocal primary match is owned by that match
      // for this pass.  A merely non-reciprocal ordinary selection performs no
      // write, so its independently published inactive support remains safe
      // for this center's coupled block.
      if (candidate_selected_peer < mechanical_params.particle_count) {
        let selected_peer_selection = energy_ledger[
          mechanical_energy_base(candidate_selected_peer)
        ];
        if (bitcast<u32>(selected_peer_selection.x) == candidate_index) {
          continue;
        }
      }
    }
    let candidate_begin = source_offsets[candidate_index];
    let candidate_end = source_offsets[candidate_index + 1u];
    if (
      candidate_begin > candidate_end
      || candidate_end > published_total
    ) {
      result.failure_code =
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
      result.valid = 0u;
      return result;
    }
    let candidate_cursor_valid = candidate_cursor >= candidate_begin
      && candidate_cursor < candidate_end
      && mechanical_solver_peer_index(csr_peers[candidate_cursor])
        == center_index;
    if (!candidate_cursor_valid) {
      if (uses_independent_reservation) { continue; }
      result.failure_code =
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u;
      result.valid = 0u;
      return result;
    }
    if (
      uses_independent_reservation
      && (
        !mechanical_solver_edge_inactive(csr_peers[cursor])
        || !mechanical_solver_edge_inactive(csr_peers[candidate_cursor])
      )
    ) { continue; }
    let candidate_pos_mass = input_state[candidate_index * 2u];
    if (
      !(candidate_pos_mass.w > 0.0)
      || !mechanical_solver_finite3(candidate_pos_mass.xyz)
    ) {
      result.failure_code =
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
      result.valid = 0u;
      return result;
    }
    if (candidate_pos_mass.w <= center_pos_mass.w) { continue; }
    let candidate_pair = mechanical_matching_constraint_pair(
      min(center_index, candidate_index),
      max(center_index, candidate_index),
      cursor
    );
    let center_constraint = matching_constraints[cursor];
    let candidate_constraint = matching_constraints[candidate_cursor];
    if (
      candidate_pair.valid == 0u
      || length(center_constraint.xyz - candidate_constraint.xyz) > 1.0e-5
      || !mechanical_matching_constraint_code_valid(center_constraint)
      || !mechanical_matching_constraint_code_valid(candidate_constraint)
      || center_constraint.w != candidate_constraint.w
    ) {
      result.failure_code =
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
      result.valid = 0u;
      return result;
    }
    if (
      candidate_pair.active_pair == 0u
      || candidate_pair.unilateral == 0u
    ) { continue; }
    let candidate_low = min(center_index, candidate_index);
    let candidate_high = max(center_index, candidate_index);
    let candidate_low_mass = input_state[candidate_low * 2u].w;
    let candidate_high_mass = input_state[candidate_high * 2u].w;
    let candidate_position_tolerance =
      mechanical_matching_position_tolerance(
        candidate_low,
        candidate_high
      );
    let candidate_position_ratio = candidate_pair.position_residual
      / candidate_position_tolerance;
    let candidate_position_update_ratio = length(candidate_pair.barrier_dx)
      * (1.0 + candidate_low_mass / max(candidate_high_mass, 1.0e-30))
      / candidate_position_tolerance;
    let candidate_velocity_ratio = candidate_pair.velocity_residual / ${
      SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
        .toExponential(1)
    };
    let candidate_priority = max(
      max(candidate_position_ratio, candidate_position_update_ratio),
      candidate_velocity_ratio
    );
    let candidate_rank = mechanical_matching_edge_rank(
      candidate_low,
      candidate_high
    );
    let candidate_normal = mechanical_matching_constraint_normal(
      center_constraint
    );
    let candidate_face_alignment = max(
      abs(candidate_normal.x),
      max(abs(candidate_normal.y), abs(candidate_normal.z))
    );
    if (
      !mechanical_solver_finite(candidate_priority)
      || !mechanical_solver_finite3(candidate_normal)
    ) {
      result.failure_code =
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
      result.valid = 0u;
      return result;
    }
    let secondary_better = mechanical_matching_inbound_candidate_better(
      candidate_priority,
      candidate_face_alignment,
      candidate_rank,
      candidate_low,
      candidate_high,
      secondary_priority,
      secondary_face_alignment,
      secondary_rank,
      secondary_order_low,
      secondary_order_high
    );
    eligible_inbound_count = eligible_inbound_count + 1u;
    if (secondary_better) {
      if (secondary_index < mechanical_params.particle_count) {
        tertiary_index = secondary_index;
        center_tertiary_cursor = center_secondary_cursor;
        tertiary_center_cursor = secondary_center_cursor;
        tertiary_pair = secondary_pair;
        tertiary_priority = secondary_priority;
        tertiary_face_alignment = secondary_face_alignment;
        tertiary_rank = secondary_rank;
        tertiary_order_low = secondary_order_low;
        tertiary_order_high = secondary_order_high;
      }
      secondary_index = candidate_index;
      center_secondary_cursor = cursor;
      secondary_center_cursor = candidate_cursor;
      secondary_pair = candidate_pair;
      secondary_priority = candidate_priority;
      secondary_face_alignment = candidate_face_alignment;
      secondary_rank = candidate_rank;
      secondary_order_low = candidate_low;
      secondary_order_high = candidate_high;
    } else if (mechanical_matching_inbound_candidate_better(
      candidate_priority,
      candidate_face_alignment,
      candidate_rank,
      candidate_low,
      candidate_high,
      tertiary_priority,
      tertiary_face_alignment,
      tertiary_rank,
      tertiary_order_low,
      tertiary_order_high
    )) {
      tertiary_index = candidate_index;
      center_tertiary_cursor = cursor;
      tertiary_center_cursor = candidate_cursor;
      tertiary_pair = candidate_pair;
      tertiary_priority = candidate_priority;
      tertiary_face_alignment = candidate_face_alignment;
      tertiary_rank = candidate_rank;
      tertiary_order_low = candidate_low;
      tertiary_order_high = candidate_high;
    }
  }
  // Several heavier peers may reserve the same lighter center, but only its
  // mutual primary can launch a block in this pass. Retain at most two inbound
  // supports with the same deterministic ordering as the matching sweep. The
  // four-body projection is exact only for the closed degree-three star; a
  // higher-degree center must stay on the proven three-body path because a
  // truncated projection can immediately reactivate an omitted contact.
  if (eligible_inbound_count == 0u) { return result; }
  result.block_found = 1u;
  result.secondary_index = secondary_index;
  result.center_secondary_cursor = center_secondary_cursor;
  result.secondary_center_cursor = secondary_center_cursor;
  result.member_count = 3u;
  let terminal_star_window = mechanical_matching_current_pass() + 16u
    >= ${solverBudget.cleanupPassBudget}u;
  if (eligible_inbound_count == 2u && terminal_star_window) {
    result.tertiary_index = tertiary_index;
    result.center_tertiary_cursor = center_tertiary_cursor;
    result.tertiary_center_cursor = tertiary_center_cursor;
    let four_block = mechanical_matching_four_block(
      result,
      primary_pair,
      secondary_pair,
      tertiary_pair
    );
    if (four_block.valid == 0u || four_block.applied != 0u) {
      return four_block;
    }
  }

  let center_primary_constraint =
    matching_constraints[center_primary_cursor];
  let center_secondary_constraint =
    matching_constraints[center_secondary_cursor];
  let primary_normal = mechanical_matching_center_oriented_vector(
    center_index,
    primary_index,
    mechanical_matching_constraint_normal(center_primary_constraint)
  );
  let secondary_normal = mechanical_matching_center_oriented_vector(
    center_index,
    secondary_index,
    mechanical_matching_constraint_normal(center_secondary_constraint)
  );
  let primary_response = mechanical_matching_center_oriented_vector(
    center_index,
    primary_index,
    center_primary_constraint.xyz
  );
  let secondary_response = mechanical_matching_center_oriented_vector(
    center_index,
    secondary_index,
    center_secondary_constraint.xyz
  );
  if (
    !mechanical_solver_finite3(primary_normal)
    || !mechanical_solver_finite3(secondary_normal)
    || !mechanical_solver_finite3(primary_response)
    || !mechanical_solver_finite3(secondary_response)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (
    length(primary_response - primary_normal) > 1.0e-5
    || length(secondary_response - secondary_normal) > 1.0e-5
    || dot(primary_response, primary_normal) <= 1.0e-6
    || dot(secondary_response, secondary_normal) <= 1.0e-6
  ) { return result; }

  let primary_position_tolerance =
    mechanical_matching_position_tolerance(mutual_low, mutual_high);
  let secondary_low = min(center_index, secondary_index);
  let secondary_high = max(center_index, secondary_index);
  let secondary_low_mass = input_state[secondary_low * 2u].w;
  let secondary_high_mass = input_state[secondary_high * 2u].w;
  let secondary_position_tolerance =
    mechanical_matching_position_tolerance(secondary_low, secondary_high);
  let primary_position_ratio =
    primary_pair.position_residual / primary_position_tolerance;
  let primary_position_update_ratio =
    length(primary_pair.barrier_dx)
      * (1.0 + low_pos_mass.w / high_pos_mass.w)
      / primary_position_tolerance;
  let secondary_position_ratio =
    secondary_pair.position_residual / secondary_position_tolerance;
  let secondary_position_update_ratio =
    length(secondary_pair.barrier_dx)
      * (1.0 + secondary_low_mass / secondary_high_mass)
      / secondary_position_tolerance;
  if (
    !mechanical_solver_finite(primary_position_ratio)
    || !mechanical_solver_finite(primary_position_update_ratio)
    || !mechanical_solver_finite(secondary_position_ratio)
    || !mechanical_solver_finite(secondary_position_update_ratio)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  if (
    primary_position_ratio > 0.5
    || primary_position_update_ratio > 0.5
    || secondary_position_ratio > 0.5
    || secondary_position_update_ratio > 0.5
  ) { return result; }

  let center_velocity = input_state[center_index * 2u + 1u].xyz;
  let primary_velocity = input_state[primary_index * 2u + 1u].xyz;
  let secondary_pos_mass = input_state[secondary_index * 2u];
  let secondary_velocity = input_state[secondary_index * 2u + 1u].xyz;
  let primary_relative_velocity = dot(
    center_velocity - primary_velocity,
    primary_normal
  );
  let secondary_relative_velocity = dot(
    center_velocity - secondary_velocity,
    secondary_normal
  );
  if (
    !mechanical_solver_finite3(center_velocity)
    || !mechanical_solver_finite3(primary_velocity)
    || !mechanical_solver_finite3(secondary_velocity)
    || !mechanical_solver_finite(primary_relative_velocity)
    || !mechanical_solver_finite(secondary_relative_velocity)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  // The mutual primary is the currently violated edge. The reserved secondary
  // was already processed in this sweep and is normally satisfied here; it
  // must still participate when the primary-only projection would reactivate
  // it. The dual active-set test below decides whether its multiplier is
  // positive.
  if (!(primary_relative_velocity < -1.0e-5)) { return result; }

  let center_inverse_mass = 1.0 / center_pos_mass.w;
  let primary_inverse_mass = 1.0 / primary_pos_mass.w;
  let secondary_inverse_mass = 1.0 / secondary_pos_mass.w;
  let effective_primary_mass =
    center_inverse_mass + primary_inverse_mass;
  let effective_secondary_mass =
    center_inverse_mass + secondary_inverse_mass;
  let effective_cross_mass =
    center_inverse_mass * dot(primary_normal, secondary_normal);
  let effective_determinant =
    effective_primary_mass * effective_secondary_mass
      - effective_cross_mass * effective_cross_mass;
  let determinant_conditioning =
    abs(effective_primary_mass * effective_secondary_mass)
      + abs(effective_cross_mass * effective_cross_mass);
  let determinant_tolerance = max(
    1.0e-12,
    64.0 * 1.1920929e-7 * max(determinant_conditioning, 1.0e-12)
  );
  if (
    !mechanical_solver_finite(center_inverse_mass)
    || !mechanical_solver_finite(primary_inverse_mass)
    || !mechanical_solver_finite(secondary_inverse_mass)
    || !mechanical_solver_finite(effective_primary_mass)
    || !mechanical_solver_finite(effective_secondary_mass)
    || !mechanical_solver_finite(effective_cross_mass)
    || !mechanical_solver_finite(effective_determinant)
    || effective_determinant <= determinant_tolerance
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let primary_rhs = -primary_relative_velocity;
  let secondary_rhs = -secondary_relative_velocity;
  let primary_lambda = (
    primary_rhs * effective_secondary_mass
      - effective_cross_mass * secondary_rhs
  ) / effective_determinant;
  let secondary_lambda = (
    effective_primary_mass * secondary_rhs
      - effective_cross_mass * primary_rhs
  ) / effective_determinant;
  if (
    !mechanical_solver_finite(primary_lambda)
    || !mechanical_solver_finite(secondary_lambda)
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  // A negative multiplier means the exact active set contains only one edge;
  // leave that case to the ordinary pair projection rather than applying an
  // attractive contact impulse.
  if (!(primary_lambda > 0.0) || !(secondary_lambda > 0.0)) {
    return result;
  }
  let center_impulse = primary_lambda * primary_normal
    + secondary_lambda * secondary_normal;
  let primary_impulse = -primary_lambda * primary_normal;
  let secondary_impulse = -secondary_lambda * secondary_normal;
  let block_masses_kg = vec3<f32>(
    primary_pos_mass.w,
    center_pos_mass.w,
    secondary_pos_mass.w
  );
  let x_contact_primal = mechanical_matching_three_block_axis_primal(
    false,
    false,
    false,
    abs(primary_normal.x) > 0.5,
    abs(secondary_normal.x) > 0.5,
    block_masses_kg,
    vec3<f32>(
      primary_velocity.x,
      center_velocity.x,
      secondary_velocity.x
    )
  );
  let y_contact_primal = mechanical_matching_three_block_axis_primal(
    false,
    false,
    false,
    abs(primary_normal.y) > 0.5,
    abs(secondary_normal.y) > 0.5,
    block_masses_kg,
    vec3<f32>(
      primary_velocity.y,
      center_velocity.y,
      secondary_velocity.y
    )
  );
  let z_contact_primal = mechanical_matching_three_block_axis_primal(
    false,
    false,
    false,
    abs(primary_normal.z) > 0.5,
    abs(secondary_normal.z) > 0.5,
    block_masses_kg,
    vec3<f32>(
      primary_velocity.z,
      center_velocity.z,
      secondary_velocity.z
    )
  );
  let proposed_primary_velocity = vec3<f32>(
    x_contact_primal.x,
    y_contact_primal.x,
    z_contact_primal.x
  );
  let proposed_center_velocity = vec3<f32>(
    x_contact_primal.y,
    y_contact_primal.y,
    z_contact_primal.y
  );
  let proposed_secondary_velocity = vec3<f32>(
    x_contact_primal.z,
    y_contact_primal.z,
    z_contact_primal.z
  );
  let proposed_primary_residual = dot(
    proposed_center_velocity - proposed_primary_velocity,
    primary_normal
  );
  let proposed_secondary_residual = dot(
    proposed_center_velocity - proposed_secondary_velocity,
    secondary_normal
  );
  let block_residual_tolerance_m_per_s = 1.0e-5;
  if (
    !mechanical_solver_finite3(center_impulse)
    || !mechanical_solver_finite3(primary_impulse)
    || !mechanical_solver_finite3(secondary_impulse)
    || !mechanical_solver_finite3(proposed_primary_velocity)
    || !mechanical_solver_finite3(proposed_center_velocity)
    || !mechanical_solver_finite3(proposed_secondary_velocity)
    || !mechanical_solver_finite(proposed_primary_residual)
    || !mechanical_solver_finite(proposed_secondary_residual)
    || abs(proposed_primary_residual)
      > block_residual_tolerance_m_per_s
    || abs(proposed_secondary_residual)
      > block_residual_tolerance_m_per_s
  ) {
    result.failure_code =
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u;
    result.valid = 0u;
    return result;
  }
  let primary_wall = mechanical_matching_project_wall_velocity(
    primary_index,
    primary_pos_mass.xyz,
    proposed_primary_velocity,
    primary_pos_mass.w
  );
  let center_wall = mechanical_matching_project_wall_velocity(
    center_index,
    center_pos_mass.xyz,
    proposed_center_velocity,
    center_pos_mass.w
  );
  let secondary_wall = mechanical_matching_project_wall_velocity(
    secondary_index,
    secondary_pos_mass.xyz,
    proposed_secondary_velocity,
    secondary_pos_mass.w
  );
  if (
    primary_wall.valid == 0u
    || center_wall.valid == 0u
    || secondary_wall.valid == 0u
  ) {
    result.failure_code = select(
      select(
        secondary_wall.failure_code,
        center_wall.failure_code,
        center_wall.valid == 0u
      ),
      primary_wall.failure_code,
      primary_wall.valid == 0u
    );
    result.valid = 0u;
    return result;
  }
  if (
    primary_wall.clipped != 0u
    || center_wall.clipped != 0u
    || secondary_wall.clipped != 0u
  ) {
    return mechanical_matching_three_block_box_wall_active_set(
      result,
      primary_normal,
      secondary_normal,
      primary_pos_mass,
      center_pos_mass,
      secondary_pos_mass,
      primary_velocity,
      center_velocity,
      secondary_velocity,
      proposed_primary_velocity,
      proposed_center_velocity,
      proposed_secondary_velocity,
      block_residual_tolerance_m_per_s
    );
  }
  let primary_kinetic_delta_j = 0.5 * primary_pos_mass.w * (
    dot(primary_wall.velocity, primary_wall.velocity)
      - dot(primary_velocity, primary_velocity)
  );
  let center_kinetic_delta_j = 0.5 * center_pos_mass.w * (
    dot(center_wall.velocity, center_wall.velocity)
      - dot(center_velocity, center_velocity)
  );
  let secondary_kinetic_delta_j = 0.5 * secondary_pos_mass.w * (
    dot(secondary_wall.velocity, secondary_wall.velocity)
      - dot(secondary_velocity, secondary_velocity)
  );
  let realized_primary_impulse =
    primary_pos_mass.w * (primary_wall.velocity - primary_velocity);
  let realized_center_impulse =
    center_pos_mass.w * (center_wall.velocity - center_velocity);
  let realized_secondary_impulse =
    secondary_pos_mass.w * (secondary_wall.velocity - secondary_velocity);
  let aggregate_kinetic_delta_j =
    primary_kinetic_delta_j
      + center_kinetic_delta_j
      + secondary_kinetic_delta_j;
  let aggregate_momentum_residual =
    realized_primary_impulse
      + realized_center_impulse
      + realized_secondary_impulse;
  let momentum_conditioning =
    length(realized_primary_impulse)
      + length(realized_center_impulse)
      + length(realized_secondary_impulse);
  let momentum_tolerance = max(
    1.0e-6,
    256.0 * 1.1920929e-7 * max(momentum_conditioning, 1.0)
  );
  let kinetic_conditioning_j = 0.5 * (
    primary_pos_mass.w * (
      dot(primary_velocity, primary_velocity)
        + dot(primary_wall.velocity, primary_wall.velocity)
    )
      + center_pos_mass.w * (
      dot(center_velocity, center_velocity)
        + dot(center_wall.velocity, center_wall.velocity)
    )
      + secondary_pos_mass.w * (
      dot(secondary_velocity, secondary_velocity)
        + dot(secondary_wall.velocity, secondary_wall.velocity)
    )
  );
  let kinetic_tolerance_j = max(
    1.0e-10,
    256.0 * 1.1920929e-7 * max(kinetic_conditioning_j, 1.0e-6)
  );
  if (
    !mechanical_solver_finite3(primary_wall.velocity)
    || !mechanical_solver_finite3(center_wall.velocity)
    || !mechanical_solver_finite3(secondary_wall.velocity)
    || !mechanical_solver_finite(primary_kinetic_delta_j)
    || !mechanical_solver_finite(center_kinetic_delta_j)
    || !mechanical_solver_finite(secondary_kinetic_delta_j)
    || !mechanical_solver_finite(aggregate_kinetic_delta_j)
    || !mechanical_solver_finite3(realized_primary_impulse)
    || !mechanical_solver_finite3(realized_center_impulse)
    || !mechanical_solver_finite3(realized_secondary_impulse)
    || !mechanical_solver_finite3(aggregate_momentum_residual)
    || length(aggregate_momentum_residual) > momentum_tolerance
    || aggregate_kinetic_delta_j > kinetic_tolerance_j
  ) {
    result.failure_code = select(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
      mechanical_solver_finite(aggregate_kinetic_delta_j)
        && aggregate_kinetic_delta_j > kinetic_tolerance_j
    );
    result.valid = 0u;
    return result;
  }
  result.center_velocity = center_wall.velocity;
  result.primary_velocity = primary_wall.velocity;
  result.secondary_velocity = secondary_wall.velocity;
  result.center_kinetic_delta_j = center_kinetic_delta_j;
  result.primary_kinetic_delta_j = primary_kinetic_delta_j;
  result.secondary_kinetic_delta_j = secondary_kinetic_delta_j;
  result.pair_heat_j = max(0.0, -aggregate_kinetic_delta_j);
  result.primary_impulse = realized_primary_impulse;
  result.center_primary_impulse = -realized_primary_impulse;
  result.secondary_impulse = realized_secondary_impulse;
  result.center_secondary_impulse = -realized_secondary_impulse;
  result.applied = 1u;
  return result;
}

@compute @workgroup_size(64)
fn initialize_matching_cleanup_constraints(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  let owner_word_count =
    MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE
      + mechanical_params.particle_count;
  if (self_index == 0u) {
    if (arrayLength(&matching_cleanup_dispatch) < owner_word_count) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
      );
    } else {
      atomicStore(
        &matching_cleanup_dispatch[0u],
        select(
          0u,
          (mechanical_params.particle_count + 63u) / 64u,
          mechanical_solver_full_path_enabled()
        )
      );
      atomicStore(&matching_cleanup_dispatch[1u], 1u);
      atomicStore(&matching_cleanup_dispatch[2u], 1u);
    }
  }
  if (self_index >= mechanical_params.particle_count) { return; }
  if (arrayLength(&matching_cleanup_dispatch) < owner_word_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (
    !mechanical_matching_jacobi_ready()
    || begin > end
    || end > total
    || total > arrayLength(&matching_constraints)
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let peer_index = mechanical_solver_peer_index(csr_peers[cursor]);
    let low_index = min(self_index, peer_index);
    let high_index = max(self_index, peer_index);
    let low_class = mechanical_solver_phase_class(low_index);
    let high_class = mechanical_solver_phase_class(high_index);
    let eligible_unilateral_pair =
      low_class != 0u
      && high_class != 0u
      && !mechanical_solver_same_phase_lineage(low_index, high_index)
      && !mechanical_solver_same_body_solid_pair(low_index, high_index)
      && mechanical_solver_unilateral_pair(low_index, high_index);
    var constraint = vec4<f32>(0.0);
    let low_pos_mass = input_state[low_index * 2u];
    let high_pos_mass = input_state[high_index * 2u];
    let low_volume = max(source_mechanics[low_index * 8u + 4u].w, 0.0);
    let high_volume = max(source_mechanics[high_index * 8u + 4u].w, 0.0);
    if (
      eligible_unilateral_pair
      && low_pos_mass.w > 0.0
      && high_pos_mass.w > 0.0
      && low_volume > 0.0
      && high_volume > 0.0
    ) {
      let current_delta = low_pos_mass.xyz - high_pos_mass.xyz;
      let epoch_delta = mechanical_solver_epoch_position(low_index)
        - mechanical_solver_epoch_position(high_index);
      let finite_volume_contact = mechanical_solver_finite_volume_contact(
        low_index,
        high_index,
        current_delta,
        epoch_delta,
        mechanical_solver_cbrt(low_volume),
        mechanical_solver_cbrt(high_volume)
      );
      let separating_normal = mechanical_matching_separating_normal(
        low_index,
        high_index,
        current_delta
      );
      let constraint_normal = select(
        separating_normal,
        finite_volume_contact.normal,
        finite_volume_contact.admitted != 0u
      );
      let response_normal = select(
        constraint_normal,
        finite_volume_contact.response_normal,
        finite_volume_contact.admitted != 0u
      );
      let response_projection = dot(response_normal, constraint_normal);
      if (
        !mechanical_solver_finite3(constraint_normal)
        || !mechanical_solver_finite3(response_normal)
        || abs(length(constraint_normal) - 1.0) > 1.0e-3
        || abs(length(response_normal) - 1.0) > 1.0e-3
        || !mechanical_solver_finite(response_projection)
        || response_projection <= 1.0e-6
      ) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      // A fixed supporting halfspace makes the colored cleanup a sequence of
      // projections onto immutable convex constraints. xyz preserves the face
      // response and abs(w) exactly encodes its axis/sign. Positive codes were
      // admitted at initialization. Negative codes remain dormant until
      // cleanup motion reaches that same finite-volume face. Evaluation also
      // requires every positive row to retain finite tangential face support,
      // preventing a frozen face from becoming an infinite lateral barrier.
      let constraint_code =
        mechanical_matching_constraint_code(constraint_normal);
      constraint = vec4<f32>(
        response_normal,
        select(
          -constraint_code,
          constraint_code,
          finite_volume_contact.admitted != 0u
        )
      );
    }
    matching_constraints[cursor] = constraint;
    // Jacobi owns this bit before cleanup, while matching owns it afterward.
    // Strip every row once here so a dormant row that joins the monotone
    // frontier later cannot inherit a stale Jacobi "already processed" mark.
    csr_peers[cursor] = peer_index;
    if (constraint.w != 0.0) {
      let frozen_pair = mechanical_matching_constraint_pair(
        low_index,
        high_index,
        cursor
      );
      if (frozen_pair.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      if (
        frozen_pair.active_pair != 0u
        && frozen_pair.unilateral != 0u
      ) {
        csr_peers[cursor] =
          peer_index | MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT;
        let contact_flags = MECHANICAL_MATCHING_OWNER_FRONTIER_BIT
          | MECHANICAL_MATCHING_OWNER_CONTACT_BIT;
        atomicOr(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
          ],
          contact_flags
        );
        atomicOr(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + peer_index
          ],
          contact_flags
        );
      }
    }
  }
  let input_pos_mass = input_state[self_index * 2u];
  let input_vel_u = input_state[self_index * 2u + 1u];
  let rest_volume = max(
    source_mechanics[self_index * 8u + 4u].w,
    0.0
  );
  let wall_projection_bound_m =
    mechanical_solver_wall_projection_bound(self_index);
  let wall_velocity = mechanical_matching_project_wall_velocity(
    self_index,
    input_pos_mass.xyz,
    input_vel_u.xyz,
    input_pos_mass.w
  );
  let zero_volume_wall_position_active = rest_volume <= 0.0
    && (
      any(input_pos_mass.xyz < vec3<f32>(0.0))
      || any(input_pos_mass.xyz > mechanical_params.box_dims_m)
    );
  let wall_active = (rest_volume > 0.0 && wall_projection_bound_m > 0.0)
    || zero_volume_wall_position_active
    || wall_velocity.clipped != 0u
    || (input_pos_mass.w > 0.0 && wall_velocity.valid == 0u)
    || !mechanical_solver_finite3(input_pos_mass.xyz)
    || !mechanical_solver_finite3(input_vel_u.xyz)
    || !mechanical_solver_finite(wall_projection_bound_m);
  let invalid_index = 0xffffffffu;
  energy_ledger[mechanical_energy_base(self_index)] = vec4<f32>(
    bitcast<f32>(invalid_index),
    0.0,
    bitcast<f32>(invalid_index),
    bitcast<f32>(invalid_index)
  );
  if (wall_active) {
    atomicOr(
      &matching_cleanup_dispatch[
        MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
      ],
      MECHANICAL_MATCHING_OWNER_FRONTIER_BIT
    );
  }
}

fn mechanical_matching_preflight(pass_index: u32) -> bool {
  if (
    !mechanical_matching_cleanup_header_valid()
    || !mechanical_matching_jacobi_ready()
    || arrayLength(&matching_constraints)
      < mechanical_params.directed_pair_capacity
    || pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return false;
  }
  if (
    pass_index > 0u
    && atomicLoad(
      &traversal_evidence[
        mechanical_matching_wall_count_word(pass_index - 1u)
      ]
    ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return false;
  }
  return true;
}

fn select_matching_cleanup_edge_for_index(
  self_index: u32,
  force_full_selection: bool
) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) { return; }
  if (!mechanical_matching_preflight(pass_index)) { return; }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (begin > end || end > total) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  let begin_new_sweep = pass_index == 0u
    || mechanical_matching_prior_applied_pair_count(pass_index) == 0u;
  if (begin_new_sweep) {
    // The CSR high bit is solver-private and final verification always strips
    // it before publication. Reuse it as one fixed-order sweep marker.
    for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
      csr_peers[cursor] = csr_peers[cursor]
        & (MECHANICAL_SOLVER_EDGE_PEER_MASK
          | MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT);
    }
  }
  if (
    pass_index == 0u
    && mechanical_matching_jacobi_residual_converged()
  ) {
    let final_iteration = mechanical_params.solver_iteration_count - 1u;
    let position_ratio = atomicLoad(
      &graph_control[
        mechanical_pre_solve_position_violation_ratio_word(final_iteration)
      ]
    );
    let velocity_residual = atomicLoad(
      &graph_control[
        mechanical_pre_solve_velocity_residual_word(final_iteration)
      ]
    );
    var invalid_index = 0xffffffffu;
    energy_ledger[mechanical_energy_base(self_index)] = vec4<f32>(
      bitcast<f32>(invalid_index),
      0.0,
      bitcast<f32>(invalid_index),
      bitcast<f32>(invalid_index)
    );
    atomicMax(
      &traversal_evidence[
        mechanical_matching_max_position_ratio_word(pass_index)
      ],
      position_ratio
    );
    atomicMax(
      &traversal_evidence[
        mechanical_matching_max_velocity_residual_word(pass_index)
      ],
      velocity_residual
    );
    atomicAdd(
      &traversal_evidence[
        mechanical_matching_selection_count_word(pass_index)
      ],
      1u
    );
    return;
  }
  var best_peer = 0xffffffffu;
  var best_low = 0xffffffffu;
  var best_high = 0xffffffffu;
  var best_rank = 0xffffffffu;
  var best_cursor = 0xffffffffu;
  var best_priority = 0.0;
  var best_face_alignment = 0.0;
  var reserved_peer = 0xffffffffu;
  var reserved_low = 0xffffffffu;
  var reserved_high = 0xffffffffu;
  var reserved_rank = 0xffffffffu;
  var reserved_cursor = 0xffffffffu;
  var reserved_priority = -1.0;
  var reserved_face_alignment = 0.0;
  var row_max_position_ratio = 0.0;
  var row_max_velocity_residual_m_per_s = 0.0;
  let owner_flags = atomicLoad(
    &matching_cleanup_dispatch[
      MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
    ]
  );
  // The production owner partitions dormant discovery from known-active
  // selection. The standalone diagnostic/legacy topology has no expansion
  // phase, so its wrapper forces the historical complete row scan.
  let full_selection = force_full_selection
    || (owner_flags & MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT) != 0u;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let encoded_peer = csr_peers[cursor];
    if (
      !full_selection
      && !mechanical_matching_edge_ever_active(encoded_peer)
    ) { continue; }
    let peer_index = mechanical_solver_peer_index(encoded_peer);
    let low_index = min(self_index, peer_index);
    let high_index = max(self_index, peer_index);
    let pair = mechanical_matching_constraint_pair(
      low_index,
      high_index,
      cursor
    );
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    if (pair.active_pair == 0u || pair.unilateral == 0u) { continue; }
    if (!mechanical_matching_edge_ever_active(encoded_peer)) {
      csr_peers[cursor] =
        encoded_peer | MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT;
    }
    let position_ratio = pair.position_residual
      / mechanical_matching_position_tolerance(low_index, high_index);
    let low_mass = input_state[low_index * 2u].w;
    let high_mass = input_state[high_index * 2u].w;
    let position_update_ratio = length(pair.barrier_dx)
      * (1.0 + low_mass / max(high_mass, 1.0e-30))
      / mechanical_matching_position_tolerance(low_index, high_index);
    let velocity_ratio = pair.velocity_residual / ${
      SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
        .toExponential(1)
    };
    let priority = max(
      max(position_ratio, position_update_ratio),
      velocity_ratio
    );
    row_max_position_ratio = max(row_max_position_ratio, position_ratio);
    row_max_velocity_residual_m_per_s = max(
      row_max_velocity_residual_m_per_s,
      pair.velocity_residual
    );
    let edge_rank = mechanical_matching_edge_rank(low_index, high_index);
    let constraint_normal = mechanical_matching_constraint_normal(
      matching_constraints[cursor]
    );
    let face_alignment = max(
      abs(constraint_normal.x),
      max(abs(constraint_normal.y), abs(constraint_normal.z))
    );
    let self_mass = select(high_mass, low_mass, self_index == low_index);
    let peer_mass = select(low_mass, high_mass, self_index == low_index);
    let reserved_better = priority > reserved_priority
      || (
        priority == reserved_priority
        && (
          face_alignment > reserved_face_alignment
          || (
            face_alignment == reserved_face_alignment
            && (
              edge_rank < reserved_rank
              || (
                edge_rank == reserved_rank
                && (
                  low_index < reserved_low
                  || (
                    low_index == reserved_low
                    && high_index < reserved_high
                  )
                )
              )
            )
          )
        )
      );
    // A processed edge stays part of the frozen contact intersection even
    // while its residual is satisfied. Retain one deterministic heavy-to-light
    // support cursor independently of the ordinary unprocessed selection. The
    // next overlapping mutual pair can then project all three vertices even
    // when this heavy endpoint also has an unrelated non-reciprocal edge. The
    // strict orientation and single cursor reserve the vertex for at most one
    // block without atomics.
    if (
      mechanical_solver_edge_inactive(encoded_peer)
      && self_mass > peer_mass
      && reserved_better
    ) {
      reserved_peer = peer_index;
      reserved_low = low_index;
      reserved_high = high_index;
      reserved_rank = edge_rank;
      reserved_cursor = cursor;
      reserved_priority = priority;
      reserved_face_alignment = face_alignment;
    }
    let better = priority > best_priority
      || (
        priority == best_priority
        && (
          face_alignment > best_face_alignment
          || (
            face_alignment == best_face_alignment
            && (
              edge_rank < best_rank
              || (
                edge_rank == best_rank
                && (
                  low_index < best_low
                  || (low_index == best_low && high_index < best_high)
                )
              )
            )
          )
        )
      );
    if (
      priority > 1.0
      && !mechanical_solver_edge_inactive(encoded_peer)
      && better
    ) {
      best_peer = peer_index;
      best_low = low_index;
      best_high = high_index;
      best_rank = edge_rank;
      best_cursor = cursor;
      best_priority = priority;
      best_face_alignment = face_alignment;
    }
  }
  if (
    best_peer >= mechanical_params.particle_count
    && reserved_peer < mechanical_params.particle_count
  ) {
    best_peer = reserved_peer;
    best_low = reserved_low;
    best_high = reserved_high;
    best_rank = reserved_rank;
    best_cursor = reserved_cursor;
    best_priority = reserved_priority;
    best_face_alignment = reserved_face_alignment;
  }
  energy_ledger[mechanical_energy_base(self_index)] = vec4<f32>(
    bitcast<f32>(best_peer),
    best_priority,
    bitcast<f32>(best_cursor),
    bitcast<f32>(reserved_cursor)
  );
  if (full_selection) {
    atomicAnd(
      &matching_cleanup_dispatch[
        MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
      ],
      ~MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT
    );
  }
  atomicMax(
    &traversal_evidence[
      mechanical_matching_max_position_ratio_word(pass_index)
    ],
    bitcast<u32>(row_max_position_ratio)
  );
  atomicMax(
    &traversal_evidence[
      mechanical_matching_max_velocity_residual_word(pass_index)
    ],
    bitcast<u32>(row_max_velocity_residual_m_per_s)
  );
  atomicAdd(
    &traversal_evidence[mechanical_matching_selection_count_word(pass_index)],
    1u
  );
}

@compute @workgroup_size(64)
fn select_matching_cleanup_edge(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  select_matching_cleanup_edge_for_index(global_id.x, true);
}

fn copy_matching_cleanup_state_for_index(self_index: u32) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) {
    // The host keeps a deterministic ping-pong schedule. Once the GPU has
    // certified convergence, propagate only the terminal state so that the
    // fixed encoded parity remains truthful without repeating pair scans.
    output_state[self_index * 2u] = input_state[self_index * 2u];
    output_state[self_index * 2u + 1u] =
      input_state[self_index * 2u + 1u];
    return;
  }
  if (
    !mechanical_matching_preflight(pass_index)
    || atomicLoad(
        &traversal_evidence[
          mechanical_matching_selection_count_word(pass_index)
        ]
      ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  output_state[self_index * 2u] = input_state[self_index * 2u];
  output_state[self_index * 2u + 1u] = input_state[self_index * 2u + 1u];
  atomicAdd(
    &traversal_evidence[mechanical_matching_copy_count_word(pass_index)],
    1u
  );
}

@compute @workgroup_size(64)
fn copy_matching_cleanup_state(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  copy_matching_cleanup_state_for_index(global_id.x);
}

fn apply_matching_cleanup_edge_for_index(self_index: u32) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) { return; }
  if (
    !mechanical_matching_preflight(pass_index)
    || atomicLoad(
        &traversal_evidence[
          mechanical_matching_copy_count_word(pass_index)
        ]
      ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  let selection = energy_ledger[mechanical_energy_base(self_index)];
  let peer_index = bitcast<u32>(selection.x);
  if (peer_index < mechanical_params.particle_count && self_index < peer_index) {
    let peer_selection = energy_ledger[mechanical_energy_base(peer_index)];
    if (bitcast<u32>(peer_selection.x) == self_index) {
      let low_index = self_index;
      let high_index = peer_index;
      let low_cursor = bitcast<u32>(selection.z);
      let high_cursor = bitcast<u32>(peer_selection.z);
      let low_begin = source_offsets[low_index];
      let low_end = source_offsets[low_index + 1u];
      let high_begin = source_offsets[high_index];
      let high_end = source_offsets[high_index + 1u];
      if (
        low_cursor < low_begin
        || low_cursor >= low_end
        || high_cursor < high_begin
        || high_cursor >= high_end
        || mechanical_solver_peer_index(csr_peers[low_cursor]) != high_index
        || mechanical_solver_peer_index(csr_peers[high_cursor]) != low_index
      ) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
        );
        return;
      }
      let pair = mechanical_matching_constraint_pair(
        low_index,
        high_index,
        low_cursor
      );
      let low_constraint = matching_constraints[low_cursor];
      let high_constraint = matching_constraints[high_cursor];
      if (
        pair.valid == 0u
        || pair.active_pair == 0u
        || pair.unilateral == 0u
        || length(low_constraint.xyz - high_constraint.xyz) > 1.0e-5
        || !mechanical_matching_constraint_code_valid(low_constraint)
        || !mechanical_matching_constraint_code_valid(high_constraint)
        || low_constraint.w != high_constraint.w
      ) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      let low_pos_mass = input_state[low_index * 2u];
      let high_pos_mass = input_state[high_index * 2u];
      let low_vel_u = input_state[low_index * 2u + 1u];
      let high_vel_u = input_state[high_index * 2u + 1u];
      if (!(low_pos_mass.w > 0.0) || !(high_pos_mass.w > 0.0)) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      let published_total = atomicLoad(&graph_control[12u]);
      let terminal_path_window = pass_index + 16u
        >= ${solverBudget.cleanupPassBudget}u;
      var three_block = mechanical_matching_zero_three_block();
      if (terminal_path_window) {
        three_block = mechanical_matching_four_path_block(
          low_index,
          high_index,
          published_total
        );
      }
      if (three_block.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          select(
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
            three_block.failure_code,
            three_block.failure_code != 0u
          )
        );
        return;
      }
      if (
        three_block.applied != 0u
        && three_block.topology == 1u
        && three_block.path_owner == 0u
      ) {
        atomicAdd(
          &traversal_evidence[
            mechanical_matching_apply_count_word(pass_index)
          ],
          1u
        );
        return;
      }
      if (three_block.applied == 0u) {
        three_block = mechanical_matching_three_block(
          low_index,
          high_index,
          low_cursor,
          high_cursor,
          published_total
        );
      }
      if (three_block.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          select(
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
            three_block.failure_code,
            three_block.failure_code != 0u
          )
        );
        return;
      }
      if (
        three_block.applied != 0u
        && three_block.member_count == 4u
      ) {
        let center_index = three_block.center_index;
        let primary_index = three_block.primary_index;
        let secondary_index = three_block.secondary_index;
        let tertiary_index = three_block.tertiary_index;
        let center_pos_mass = input_state[center_index * 2u];
        let primary_pos_mass = input_state[primary_index * 2u];
        let secondary_pos_mass = input_state[secondary_index * 2u];
        let tertiary_pos_mass = input_state[tertiary_index * 2u];
        let aggregate_mass = center_pos_mass.w
          + primary_pos_mass.w
          + secondary_pos_mass.w
          + tertiary_pos_mass.w;
        let center_cumulative =
          energy_ledger[mechanical_energy_base(center_index) + 1u];
        let primary_cumulative =
          energy_ledger[mechanical_energy_base(primary_index) + 1u];
        let secondary_cumulative =
          energy_ledger[mechanical_energy_base(secondary_index) + 1u];
        let tertiary_cumulative =
          energy_ledger[mechanical_energy_base(tertiary_index) + 1u];
        let center_next_pair_heat_j = center_cumulative.y
          + three_block.pair_heat_j * center_pos_mass.w / aggregate_mass;
        let primary_next_pair_heat_j = primary_cumulative.y
          + three_block.pair_heat_j * primary_pos_mass.w / aggregate_mass;
        let secondary_next_pair_heat_j = secondary_cumulative.y
          + three_block.pair_heat_j * secondary_pos_mass.w / aggregate_mass;
        let tertiary_next_pair_heat_j = tertiary_cumulative.y
          + three_block.pair_heat_j * tertiary_pos_mass.w / aggregate_mass;
        let center_next_wall_heat_j = center_cumulative.z
          + max(0.0, -three_block.center_wall_kinetic_delta_j);
        let primary_next_wall_heat_j = primary_cumulative.z
          + max(0.0, -three_block.primary_wall_kinetic_delta_j);
        let secondary_next_wall_heat_j = secondary_cumulative.z
          + max(0.0, -three_block.secondary_wall_kinetic_delta_j);
        let tertiary_next_wall_heat_j = tertiary_cumulative.z
          + max(0.0, -three_block.tertiary_wall_kinetic_delta_j);
        let center_next_u = center_cumulative.w
          + (center_next_pair_heat_j + center_next_wall_heat_j)
            / center_pos_mass.w;
        let primary_next_u = primary_cumulative.w
          + (primary_next_pair_heat_j + primary_next_wall_heat_j)
            / primary_pos_mass.w;
        let secondary_next_u = secondary_cumulative.w
          + (secondary_next_pair_heat_j + secondary_next_wall_heat_j)
            / secondary_pos_mass.w;
        let tertiary_next_u = tertiary_cumulative.w
          + (tertiary_next_pair_heat_j + tertiary_next_wall_heat_j)
            / tertiary_pos_mass.w;
        if (
          !(aggregate_mass > 0.0)
          || !mechanical_solver_finite(center_next_pair_heat_j)
          || !mechanical_solver_finite(primary_next_pair_heat_j)
          || !mechanical_solver_finite(secondary_next_pair_heat_j)
          || !mechanical_solver_finite(tertiary_next_pair_heat_j)
          || !mechanical_solver_finite(center_next_wall_heat_j)
          || !mechanical_solver_finite(primary_next_wall_heat_j)
          || !mechanical_solver_finite(secondary_next_wall_heat_j)
          || !mechanical_solver_finite(tertiary_next_wall_heat_j)
          || !mechanical_solver_finite(center_next_u)
          || !mechanical_solver_finite(primary_next_u)
          || !mechanical_solver_finite(secondary_next_u)
          || !mechanical_solver_finite(tertiary_next_u)
          || center_next_u < 0.0
          || primary_next_u < 0.0
          || secondary_next_u < 0.0
          || tertiary_next_u < 0.0
        ) {
          atomicOr(
            &graph_control[14u],
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
              .NEGATIVE_INTERNAL_ENERGY}u
          );
          return;
        }
        output_state[center_index * 2u] = center_pos_mass;
        output_state[primary_index * 2u] = primary_pos_mass;
        output_state[secondary_index * 2u] = secondary_pos_mass;
        output_state[tertiary_index * 2u] = tertiary_pos_mass;
        output_state[center_index * 2u + 1u] =
          vec4<f32>(three_block.center_velocity, center_next_u);
        output_state[primary_index * 2u + 1u] =
          vec4<f32>(three_block.primary_velocity, primary_next_u);
        output_state[secondary_index * 2u + 1u] =
          vec4<f32>(three_block.secondary_velocity, secondary_next_u);
        output_state[tertiary_index * 2u + 1u] =
          vec4<f32>(three_block.tertiary_velocity, tertiary_next_u);
        mechanical_matching_owner_record_mover(center_index);
        mechanical_matching_owner_record_mover(primary_index);
        mechanical_matching_owner_record_mover(secondary_index);
        mechanical_matching_owner_record_mover(tertiary_index);
        energy_ledger[mechanical_energy_base(center_index) + 1u] =
          vec4<f32>(
            center_cumulative.x + three_block.center_kinetic_delta_j,
            center_next_pair_heat_j,
            center_next_wall_heat_j,
            center_cumulative.w
          );
        energy_ledger[mechanical_energy_base(primary_index) + 1u] =
          vec4<f32>(
            primary_cumulative.x + three_block.primary_kinetic_delta_j,
            primary_next_pair_heat_j,
            primary_next_wall_heat_j,
            primary_cumulative.w
          );
        energy_ledger[mechanical_energy_base(secondary_index) + 1u] =
          vec4<f32>(
            secondary_cumulative.x
              + three_block.secondary_kinetic_delta_j,
            secondary_next_pair_heat_j,
            secondary_next_wall_heat_j,
            secondary_cumulative.w
          );
        energy_ledger[mechanical_energy_base(tertiary_index) + 1u] =
          vec4<f32>(
            tertiary_cumulative.x
              + three_block.tertiary_kinetic_delta_j,
            tertiary_next_pair_heat_j,
            tertiary_next_wall_heat_j,
            tertiary_cumulative.w
          );
        csr_peers[three_block.center_primary_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.center_primary_cursor]
          );
        csr_peers[three_block.primary_center_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.primary_center_cursor]
          );
        csr_peers[three_block.center_secondary_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.center_secondary_cursor]
          );
        csr_peers[three_block.secondary_center_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.secondary_center_cursor]
          );
        csr_peers[three_block.center_tertiary_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.center_tertiary_cursor]
          );
        csr_peers[three_block.tertiary_center_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.tertiary_center_cursor]
          );
        atomicAdd(
          &traversal_evidence[
            mechanical_matching_applied_pair_count_word(pass_index)
          ],
          3u
        );
        atomicAdd(
          &traversal_evidence[
            mechanical_matching_apply_count_word(pass_index)
          ],
          1u
        );
        return;
      }
      if (three_block.applied != 0u) {
        let center_index = three_block.center_index;
        let primary_index = three_block.primary_index;
        let secondary_index = three_block.secondary_index;
        let center_pos_mass = input_state[center_index * 2u];
        let primary_pos_mass = input_state[primary_index * 2u];
        let secondary_pos_mass = input_state[secondary_index * 2u];
        let aggregate_mass =
          center_pos_mass.w + primary_pos_mass.w + secondary_pos_mass.w;
        let center_cumulative =
          energy_ledger[mechanical_energy_base(center_index) + 1u];
        let primary_cumulative =
          energy_ledger[mechanical_energy_base(primary_index) + 1u];
        let secondary_cumulative =
          energy_ledger[mechanical_energy_base(secondary_index) + 1u];
        let center_next_pair_heat_j =
          center_cumulative.y
            + three_block.pair_heat_j * center_pos_mass.w / aggregate_mass;
        let primary_next_pair_heat_j =
          primary_cumulative.y
            + three_block.pair_heat_j * primary_pos_mass.w / aggregate_mass;
        let secondary_next_pair_heat_j =
          secondary_cumulative.y
            + three_block.pair_heat_j * secondary_pos_mass.w / aggregate_mass;
        let center_next_wall_heat_j =
          center_cumulative.z
            + max(0.0, -three_block.center_wall_kinetic_delta_j);
        let primary_next_wall_heat_j =
          primary_cumulative.z
            + max(0.0, -three_block.primary_wall_kinetic_delta_j);
        let secondary_next_wall_heat_j =
          secondary_cumulative.z
            + max(0.0, -three_block.secondary_wall_kinetic_delta_j);
        let center_next_u = center_cumulative.w
          + (center_next_pair_heat_j + center_next_wall_heat_j)
            / center_pos_mass.w;
        let primary_next_u = primary_cumulative.w
          + (primary_next_pair_heat_j + primary_next_wall_heat_j)
            / primary_pos_mass.w;
        let secondary_next_u = secondary_cumulative.w
          + (secondary_next_pair_heat_j + secondary_next_wall_heat_j)
            / secondary_pos_mass.w;
        if (
          !(aggregate_mass > 0.0)
          || !mechanical_solver_finite(center_next_pair_heat_j)
          || !mechanical_solver_finite(primary_next_pair_heat_j)
          || !mechanical_solver_finite(secondary_next_pair_heat_j)
          || !mechanical_solver_finite(center_next_wall_heat_j)
          || !mechanical_solver_finite(primary_next_wall_heat_j)
          || !mechanical_solver_finite(secondary_next_wall_heat_j)
          || !mechanical_solver_finite(center_next_u)
          || !mechanical_solver_finite(primary_next_u)
          || !mechanical_solver_finite(secondary_next_u)
          || center_next_u < 0.0
          || primary_next_u < 0.0
          || secondary_next_u < 0.0
        ) {
          atomicOr(
            &graph_control[14u],
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
              .NEGATIVE_INTERNAL_ENERGY}u
          );
          return;
        }
        // The block is velocity-only by admission. Preserving all three input
        // positions avoids resolving one face by increasing the opposite
        // overlap; the shared normal projection changes no tangential lane.
        output_state[center_index * 2u] = center_pos_mass;
        output_state[primary_index * 2u] = primary_pos_mass;
        output_state[secondary_index * 2u] = secondary_pos_mass;
        output_state[center_index * 2u + 1u] =
          vec4<f32>(three_block.center_velocity, center_next_u);
        output_state[primary_index * 2u + 1u] =
          vec4<f32>(three_block.primary_velocity, primary_next_u);
        output_state[secondary_index * 2u + 1u] =
          vec4<f32>(three_block.secondary_velocity, secondary_next_u);
        mechanical_matching_owner_record_mover(center_index);
        mechanical_matching_owner_record_mover(primary_index);
        mechanical_matching_owner_record_mover(secondary_index);
        energy_ledger[mechanical_energy_base(center_index) + 1u] =
          vec4<f32>(
            center_cumulative.x + three_block.center_kinetic_delta_j,
            center_next_pair_heat_j,
            center_next_wall_heat_j,
            center_cumulative.w
          );
        energy_ledger[mechanical_energy_base(primary_index) + 1u] =
          vec4<f32>(
            primary_cumulative.x + three_block.primary_kinetic_delta_j,
            primary_next_pair_heat_j,
            primary_next_wall_heat_j,
            primary_cumulative.w
          );
        energy_ledger[mechanical_energy_base(secondary_index) + 1u] =
          vec4<f32>(
            secondary_cumulative.x + three_block.secondary_kinetic_delta_j,
            secondary_next_pair_heat_j,
            secondary_next_wall_heat_j,
            secondary_cumulative.w
          );
        csr_peers[three_block.center_primary_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.center_primary_cursor]
          );
        csr_peers[three_block.primary_center_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.primary_center_cursor]
          );
        csr_peers[three_block.center_secondary_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.center_secondary_cursor]
          );
        csr_peers[three_block.secondary_center_cursor] =
          mechanical_matching_mark_edge_inactive(
            csr_peers[three_block.secondary_center_cursor]
          );
        atomicAdd(
          &traversal_evidence[
            mechanical_matching_applied_pair_count_word(pass_index)
          ],
          2u
        );
        atomicAdd(
          &traversal_evidence[
            mechanical_matching_apply_count_word(pass_index)
          ],
          1u
        );
        return;
      }
      let high_mass_ratio = low_pos_mass.w / high_pos_mass.w;
      let low_dx_unscaled = pair.barrier_dx;
      let high_dx_unscaled = -high_mass_ratio * low_dx_unscaled;
      let low_scale = particle_scales[low_index];
      let high_scale = particle_scales[high_index];
      let low_dx_scale = select(
        1.0,
        min(1.0, low_scale.w / max(length(low_dx_unscaled), 1.0e-30)),
        length(low_dx_unscaled) > 1.0e-12
      );
      let high_dx_scale = select(
        1.0,
        min(1.0, high_scale.w / max(length(high_dx_unscaled), 1.0e-30)),
        length(high_dx_unscaled) > 1.0e-12
      );
      let position_scale = min(low_dx_scale, high_dx_scale);
      let low_position = low_pos_mass.xyz
        + position_scale * low_dx_unscaled;
      let high_position = high_pos_mass.xyz
        + position_scale * high_dx_unscaled;
      let low_epoch_displacement = length(
        low_position - mechanical_solver_epoch_position(low_index)
      );
      let high_epoch_displacement = length(
        high_position - mechanical_solver_epoch_position(high_index)
      );
      let trust_tolerance_m = max(
        1.0e-6,
        64.0 * 1.1920929e-7 * max(max(low_scale.z, high_scale.z), 1.0)
      );
      if (
        !mechanical_solver_finite3(low_position)
        || !mechanical_solver_finite3(high_position)
        || low_scale.z < 0.0
        || high_scale.z < 0.0
        || low_epoch_displacement > low_scale.z + trust_tolerance_m
        || high_epoch_displacement > high_scale.z + trust_tolerance_m
      ) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      let low_initial_dv = pair.barrier_dv;
      let high_initial_dv = -high_mass_ratio * low_initial_dv;
      let refinement = mechanical_matching_refine_wall_velocity_pair(
        low_index,
        high_index,
        low_position,
        high_position,
        low_vel_u.xyz,
        high_vel_u.xyz,
        low_pos_mass.w,
        high_pos_mass.w,
        low_initial_dv,
        high_initial_dv,
        low_constraint
      );
      if (refinement.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          select(
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
            refinement.failure_code,
            refinement.failure_code != 0u
          )
        );
        return;
      }
      let pair_kinetic_delta_j =
        refinement.low_pair_kinetic_delta_j
          + refinement.high_pair_kinetic_delta_j;
      let pair_heat_j = max(0.0, -pair_kinetic_delta_j);
      let pair_mass = low_pos_mass.w + high_pos_mass.w;
      let low_mass_fraction = low_pos_mass.w / pair_mass;
      let high_mass_fraction = high_pos_mass.w / pair_mass;
      let low_heat_j = pair_heat_j * low_mass_fraction;
      let high_heat_j = pair_heat_j * high_mass_fraction;
      let low_wall_heat_j = max(
        0.0,
        -refinement.low_wall_kinetic_delta_j
      );
      let high_wall_heat_j = max(
        0.0,
        -refinement.high_wall_kinetic_delta_j
      );
      let low_cumulative =
        energy_ledger[mechanical_energy_base(low_index) + 1u];
      let high_cumulative =
        energy_ledger[mechanical_energy_base(high_index) + 1u];
      let low_next_pair_heat_j = low_cumulative.y + low_heat_j;
      let high_next_pair_heat_j = high_cumulative.y + high_heat_j;
      let low_next_wall_heat_j = low_cumulative.z + low_wall_heat_j;
      let high_next_wall_heat_j = high_cumulative.z + high_wall_heat_j;
      let low_next_u = low_cumulative.w
        + (low_next_pair_heat_j + low_next_wall_heat_j) / low_pos_mass.w;
      let high_next_u = high_cumulative.w
        + (high_next_pair_heat_j + high_next_wall_heat_j) / high_pos_mass.w;
      if (
        !mechanical_solver_finite(low_next_u)
        || !mechanical_solver_finite(high_next_u)
        || low_next_u < 0.0
        || high_next_u < 0.0
      ) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
            .NEGATIVE_INTERNAL_ENERGY}u
        );
        return;
      }
      output_state[low_index * 2u] =
        vec4<f32>(low_position, low_pos_mass.w);
      output_state[high_index * 2u] =
        vec4<f32>(high_position, high_pos_mass.w);
      output_state[low_index * 2u + 1u] =
        vec4<f32>(refinement.low_velocity, low_next_u);
      output_state[high_index * 2u + 1u] =
        vec4<f32>(refinement.high_velocity, high_next_u);
      mechanical_matching_owner_record_mover(low_index);
      mechanical_matching_owner_record_mover(high_index);
      energy_ledger[mechanical_energy_base(low_index) + 1u] = vec4<f32>(
        low_cumulative.x + refinement.low_pair_kinetic_delta_j,
        low_next_pair_heat_j,
        low_next_wall_heat_j,
        low_cumulative.w
      );
      energy_ledger[mechanical_energy_base(high_index) + 1u] = vec4<f32>(
        high_cumulative.x + refinement.high_pair_kinetic_delta_j,
        high_next_pair_heat_j,
        high_next_wall_heat_j,
        high_cumulative.w
      );
      csr_peers[low_cursor] = mechanical_matching_mark_edge_inactive(
        csr_peers[low_cursor]
      );
      csr_peers[high_cursor] = mechanical_matching_mark_edge_inactive(
        csr_peers[high_cursor]
      );
      atomicAdd(
        &traversal_evidence[
          mechanical_matching_applied_pair_count_word(pass_index)
        ],
        1u
      );
    }
  }
  atomicAdd(
    &traversal_evidence[mechanical_matching_apply_count_word(pass_index)],
    1u
  );
}

@compute @workgroup_size(64)
fn apply_matching_cleanup_edge(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  apply_matching_cleanup_edge_for_index(global_id.x);
}

fn mechanical_diagnostic_capture_target_local_base(
  pass_index: u32,
  target_slot: u32
) {
  let target_index = mechanical_diagnostic_target_index(target_slot);
  let selection =
    energy_ledger[mechanical_energy_base(target_index)];
  let selected_peer = bitcast<u32>(selection.x);
  let target_cursor = bitcast<u32>(selection.z);
  let row =
    mechanical_diagnostic_target_row_word(pass_index, target_slot, 0u);
  var reciprocal_cursor = 0xffffffffu;
  var peer_mass_kg = 0.0;
  var flags =
    MECHANICAL_DIAGNOSTIC_TARGET_ROW_LOCAL_CAPTURE_COMPLETE;
  if (selected_peer < mechanical_params.particle_count) {
    flags = flags | MECHANICAL_DIAGNOSTIC_TARGET_ROW_SELECTED;
    peer_mass_kg = input_state[selected_peer * 2u].w;
    let peer_selection =
      energy_ledger[mechanical_energy_base(selected_peer)];
    if (bitcast<u32>(peer_selection.x) == target_index) {
      flags = flags | MECHANICAL_DIAGNOSTIC_TARGET_ROW_RECIPROCAL;
      reciprocal_cursor = bitcast<u32>(peer_selection.z);
    }
  }
  let input_pos_mass = input_state[target_index * 2u];
  let input_vel_u = input_state[target_index * 2u + 1u];
  let local_pos_mass = output_state[target_index * 2u];
  let local_vel_u = output_state[target_index * 2u + 1u];
  atomicStore(&mechanical_diagnostic_trace[row], pass_index);
  atomicStore(&mechanical_diagnostic_trace[row + 1u], target_index);
  atomicStore(&mechanical_diagnostic_trace[row + 2u], selected_peer);
  atomicStore(&mechanical_diagnostic_trace[row + 3u], target_cursor);
  atomicStore(&mechanical_diagnostic_trace[row + 4u], reciprocal_cursor);
  atomicStore(&mechanical_diagnostic_trace[row + 7u], flags);
  mechanical_diagnostic_target_row_store_vec3(
    pass_index,
    target_slot,
    11u,
    input_pos_mass.xyz
  );
  mechanical_diagnostic_target_row_store_vec3(
    pass_index,
    target_slot,
    14u,
    input_vel_u.xyz
  );
  mechanical_diagnostic_target_row_store_vec3(
    pass_index,
    target_slot,
    17u,
    local_pos_mass.xyz
  );
  mechanical_diagnostic_target_row_store_vec3(
    pass_index,
    target_slot,
    20u,
    local_vel_u.xyz
  );
  mechanical_diagnostic_target_row_store_f32(
    pass_index,
    target_slot,
    31u,
    peer_mass_kg
  );
}

fn mechanical_diagnostic_capture_target_refinement(
  pass_index: u32,
  low_index: u32,
  high_index: u32,
  low_position: vec3<f32>,
  high_position: vec3<f32>,
  low_initial_velocity: vec3<f32>,
  high_initial_velocity: vec3<f32>,
  low_mass_kg: f32,
  high_mass_kg: f32,
  low_initial_dv: vec3<f32>,
  high_initial_dv: vec3<f32>,
  constraint: vec4<f32>,
  refinement: MechanicalMatchingVelocityRefinement
) {
  let constraint_normal =
    mechanical_matching_constraint_normal(constraint);
  let low_round_zero_wall =
    mechanical_matching_project_wall_velocity(
      low_index,
      low_position,
      low_initial_velocity + low_initial_dv,
      low_mass_kg
    );
  let high_round_zero_wall =
    mechanical_matching_project_wall_velocity(
      high_index,
      high_position,
      high_initial_velocity + high_initial_dv,
      high_mass_kg
    );
  let pre_approach_residual_m_per_s = max(
    -dot(
      low_initial_velocity - high_initial_velocity,
      constraint_normal
    ),
    0.0
  );
  let post_approach_residual_m_per_s = max(
    -dot(
      refinement.low_velocity - refinement.high_velocity,
      constraint_normal
    ),
    0.0
  );
  for (
    var target_slot = 0u;
    target_slot < MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
    target_slot = target_slot + 1u
  ) {
    let target_index = mechanical_diagnostic_target_index(target_slot);
    if (target_index != low_index && target_index != high_index) {
      continue;
    }
    let row =
      mechanical_diagnostic_target_row_word(pass_index, target_slot, 0u);
    let target_is_low = target_index == low_index;
    let other_target =
      mechanical_diagnostic_target_index(1u - target_slot);
    var flags =
      atomicLoad(&mechanical_diagnostic_trace[row + 7u])
        | MECHANICAL_DIAGNOSTIC_TARGET_ROW_APPLIED;
    if (target_is_low) {
      flags =
        flags | MECHANICAL_DIAGNOSTIC_TARGET_ROW_TARGET_IS_LOW;
    }
    if (other_target == low_index || other_target == high_index) {
      flags =
        flags
          | MECHANICAL_DIAGNOSTIC_TARGET_ROW_PAIR_CONTAINS_BOTH_TARGETS;
    }
    let target_round_zero_clipped = select(
      high_round_zero_wall.clipped,
      low_round_zero_wall.clipped,
      target_is_low
    );
    let peer_round_zero_clipped = select(
      low_round_zero_wall.clipped,
      high_round_zero_wall.clipped,
      target_is_low
    );
    if (target_round_zero_clipped != 0u) {
      flags =
        flags
          | MECHANICAL_DIAGNOSTIC_TARGET_ROW_ROUND_ZERO_TARGET_WALL_CLIPPED;
    }
    if (peer_round_zero_clipped != 0u) {
      flags =
        flags
          | MECHANICAL_DIAGNOSTIC_TARGET_ROW_ROUND_ZERO_PEER_WALL_CLIPPED;
    }
    atomicStore(
      &mechanical_diagnostic_trace[row + 5u],
      bitcast<u32>(i32(round(constraint.w)))
    );
    atomicStore(
      &mechanical_diagnostic_trace[row + 6u],
      refinement.round_count
    );
    atomicStore(&mechanical_diagnostic_trace[row + 7u], flags);
    mechanical_diagnostic_target_row_store_vec3(
      pass_index,
      target_slot,
      8u,
      constraint.xyz
    );
    mechanical_diagnostic_target_row_store_f32(
      pass_index,
      target_slot,
      29u,
      pre_approach_residual_m_per_s
    );
    mechanical_diagnostic_target_row_store_f32(
      pass_index,
      target_slot,
      30u,
      post_approach_residual_m_per_s
    );
    mechanical_diagnostic_target_row_store_f32(
      pass_index,
      target_slot,
      31u,
      select(low_mass_kg, high_mass_kg, target_is_low)
    );
  }
}

fn mechanical_diagnostic_accumulate_pair_impulse(
  pass_index: u32,
  first_index: u32,
  second_index: u32,
  first_impulse: vec3<f32>,
  second_impulse: vec3<f32>
) {
  if (
    !mechanical_solver_finite3(first_impulse)
    || !mechanical_solver_finite3(second_impulse)
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  let first_material_bits =
    bitcast<u32>(source_thermo[first_index * 3u].x);
  let second_material_bits =
    bitcast<u32>(source_thermo[second_index * 3u].x);
  if (first_material_bits != second_material_bits) {
    atomicAdd(&mechanical_diagnostic_trace[17u], 1u);
  }
  let material_a_bits = atomicLoad(&mechanical_diagnostic_trace[12u]);
  let material_b_bits = atomicLoad(&mechanical_diagnostic_trace[13u]);
  let first_is_a_second_is_b =
    first_material_bits == material_a_bits
      && second_material_bits == material_b_bits;
  let first_is_b_second_is_a =
    first_material_bits == material_b_bits
      && second_material_bits == material_a_bits;
  if (!first_is_a_second_is_b && !first_is_b_second_is_a) { return; }
  let impulse_a = select(
    second_impulse,
    first_impulse,
    first_is_a_second_is_b
  );
  let impulse_b = select(
    first_impulse,
    second_impulse,
    first_is_a_second_is_b
  );
  let material_a_impulse = vec3<f32>(
    mechanical_diagnostic_trace_load_f32(20u),
    mechanical_diagnostic_trace_load_f32(21u),
    mechanical_diagnostic_trace_load_f32(22u)
  ) + impulse_a;
  let material_b_impulse = vec3<f32>(
    mechanical_diagnostic_trace_load_f32(23u),
    mechanical_diagnostic_trace_load_f32(24u),
    mechanical_diagnostic_trace_load_f32(25u)
  ) + impulse_b;
  let momentum_residual = vec3<f32>(
    mechanical_diagnostic_trace_load_f32(26u),
    mechanical_diagnostic_trace_load_f32(27u),
    mechanical_diagnostic_trace_load_f32(28u)
  ) + first_impulse + second_impulse;
  if (
    !mechanical_solver_finite3(material_a_impulse)
    || !mechanical_solver_finite3(material_b_impulse)
    || !mechanical_solver_finite3(momentum_residual)
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  atomicAdd(&mechanical_diagnostic_trace[16u], 1u);
  atomicMin(&mechanical_diagnostic_trace[18u], pass_index);
  atomicStore(&mechanical_diagnostic_trace[19u], pass_index);
  mechanical_diagnostic_trace_store_f32(20u, material_a_impulse.x);
  mechanical_diagnostic_trace_store_f32(21u, material_a_impulse.y);
  mechanical_diagnostic_trace_store_f32(22u, material_a_impulse.z);
  mechanical_diagnostic_trace_store_f32(23u, material_b_impulse.x);
  mechanical_diagnostic_trace_store_f32(24u, material_b_impulse.y);
  mechanical_diagnostic_trace_store_f32(25u, material_b_impulse.z);
  mechanical_diagnostic_trace_store_f32(26u, momentum_residual.x);
  mechanical_diagnostic_trace_store_f32(27u, momentum_residual.y);
  mechanical_diagnostic_trace_store_f32(28u, momentum_residual.z);
  let lateral_impulse = length(vec2<f32>(impulse_a.x, impulse_a.z));
  if (
    lateral_impulse
      > mechanical_diagnostic_trace_load_f32(29u)
  ) {
    mechanical_diagnostic_trace_store_f32(29u, lateral_impulse);
    atomicStore(
      &mechanical_diagnostic_trace[30u],
      min(first_index, second_index)
    );
    atomicStore(
      &mechanical_diagnostic_trace[31u],
      max(first_index, second_index)
    );
  }
  atomicOr(
    &mechanical_diagnostic_trace[2u],
    MECHANICAL_DIAGNOSTIC_TRACE_APPLY_OBSERVED
  );
}

fn mechanical_diagnostic_capture_target_three_block(
  pass_index: u32,
  block: MechanicalMatchingThreeBlockResult
) {
  if (!mechanical_diagnostic_target_tail_header_valid()) { return; }
  for (
    var target_slot = 0u;
    target_slot < MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
    target_slot = target_slot + 1u
  ) {
    let target_index = mechanical_diagnostic_target_index(target_slot);
    let target_is_tertiary = block.member_count == 4u
      && target_index == block.tertiary_index;
    if (
      target_index != block.center_index
      && target_index != block.primary_index
      && target_index != block.secondary_index
      && !target_is_tertiary
    ) { continue; }
    let selection =
      energy_ledger[mechanical_energy_base(target_index)];
    let selected_peer = bitcast<u32>(selection.x);
    let selected_cursor = bitcast<u32>(selection.z);
    if (
      selected_peer >= mechanical_params.particle_count
      || selected_cursor >= arrayLength(&matching_constraints)
      || selected_cursor >= arrayLength(&csr_peers)
      || mechanical_solver_peer_index(csr_peers[selected_cursor])
        != selected_peer
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let low_index = min(target_index, selected_peer);
    let high_index = max(target_index, selected_peer);
    let constraint = matching_constraints[selected_cursor];
    let constraint_normal =
      mechanical_matching_constraint_normal(constraint);
    let low_input_velocity = input_state[low_index * 2u + 1u].xyz;
    let high_input_velocity = input_state[high_index * 2u + 1u].xyz;
    let low_output_velocity = output_state[low_index * 2u + 1u].xyz;
    let high_output_velocity = output_state[high_index * 2u + 1u].xyz;
    let row =
      mechanical_diagnostic_target_row_word(pass_index, target_slot, 0u);
    var flags =
      atomicLoad(&mechanical_diagnostic_trace[row + 7u])
        | MECHANICAL_DIAGNOSTIC_TARGET_ROW_APPLIED
        | MECHANICAL_DIAGNOSTIC_TARGET_ROW_THREE_BLOCK_APPLIED;
    if (target_index == low_index) {
      flags = flags | MECHANICAL_DIAGNOSTIC_TARGET_ROW_TARGET_IS_LOW;
    }
    let other_target =
      mechanical_diagnostic_target_index(1u - target_slot);
    if (other_target == low_index || other_target == high_index) {
      flags =
        flags
          | MECHANICAL_DIAGNOSTIC_TARGET_ROW_PAIR_CONTAINS_BOTH_TARGETS;
    }
    atomicStore(
      &mechanical_diagnostic_trace[row + 5u],
      bitcast<u32>(i32(round(constraint.w)))
    );
    atomicStore(&mechanical_diagnostic_trace[row + 6u], 1u);
    atomicStore(&mechanical_diagnostic_trace[row + 7u], flags);
    mechanical_diagnostic_target_row_store_vec3(
      pass_index,
      target_slot,
      8u,
      constraint.xyz
    );
    mechanical_diagnostic_target_row_store_f32(
      pass_index,
      target_slot,
      29u,
      max(
        -dot(
          low_input_velocity - high_input_velocity,
          constraint_normal
        ),
        0.0
      )
    );
    mechanical_diagnostic_target_row_store_f32(
      pass_index,
      target_slot,
      30u,
      max(
        -dot(
          low_output_velocity - high_output_velocity,
          constraint_normal
        ),
        0.0
      )
    );
    mechanical_diagnostic_target_row_store_f32(
      pass_index,
      target_slot,
      31u,
      input_state[selected_peer * 2u].w
    );
  }
}

// Diagnostic-only deterministic replay. It runs in a separate dispatch after
// every apply invocation has finished, so it may safely repurpose the dead
// selection y/z/w lanes without racing the production matching dispatch.
// Replaying the exact pure helper also proves the traced impulse excludes wall
// momentum while the production output includes the interleaved wall clips.
@compute @workgroup_size(1)
fn replay_matching_cleanup_refinement_trace() {
  if (!mechanical_diagnostic_trace_header_valid()) { return; }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) { return; }
  if (
    atomicLoad(
      &traversal_evidence[
        mechanical_matching_apply_count_word(pass_index)
      ]
    ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  let target_tail_valid =
    mechanical_diagnostic_target_tail_header_valid();
  if (target_tail_valid) {
    for (
      var target_slot = 0u;
      target_slot < MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
      target_slot = target_slot + 1u
    ) {
      mechanical_diagnostic_capture_target_local_base(
        pass_index,
        target_slot
      );
    }
    let header = MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
    let prior_local_capture_count = atomicAdd(
      &mechanical_diagnostic_trace[header + 8u],
      MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
    );
    if (
      prior_local_capture_count
          + MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
        == ${solverBudget.cleanupPassBudget
          * SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS}u
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[header + 2u],
        MECHANICAL_DIAGNOSTIC_TARGET_TAIL_LOCAL_CAPTURE_COMPLETE
      );
    }
  }
  let published_total = atomicLoad(&graph_control[12u]);
  if (
    published_total > arrayLength(&csr_peers)
    || published_total > arrayLength(&matching_constraints)
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  for (
    var low_index = 0u;
    low_index < mechanical_params.particle_count;
    low_index = low_index + 1u
  ) {
    let selection = energy_ledger[mechanical_energy_base(low_index)];
    let high_index = bitcast<u32>(selection.x);
    if (
      high_index <= low_index
      || high_index >= mechanical_params.particle_count
    ) { continue; }
    let high_selection =
      energy_ledger[mechanical_energy_base(high_index)];
    if (bitcast<u32>(high_selection.x) != low_index) { continue; }
    let low_cursor = bitcast<u32>(selection.z);
    let high_cursor = bitcast<u32>(high_selection.z);
    if (
      low_cursor >= arrayLength(&matching_constraints)
      || high_cursor >= arrayLength(&matching_constraints)
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let low_constraint = matching_constraints[low_cursor];
    let high_constraint = matching_constraints[high_cursor];
    let low_pos_mass = input_state[low_index * 2u];
    let high_pos_mass = input_state[high_index * 2u];
    let low_initial_velocity = input_state[low_index * 2u + 1u].xyz;
    let high_initial_velocity = input_state[high_index * 2u + 1u].xyz;
    if (
      !(low_pos_mass.w > 0.0)
      || !(high_pos_mass.w > 0.0)
      || length(low_constraint.xyz - high_constraint.xyz) > 1.0e-5
      || !mechanical_matching_constraint_code_valid(low_constraint)
      || !mechanical_matching_constraint_code_valid(high_constraint)
      || low_constraint.w != high_constraint.w
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let terminal_path_window = pass_index + 16u
      >= ${solverBudget.cleanupPassBudget}u;
    var three_block = mechanical_matching_zero_three_block();
    if (terminal_path_window) {
      three_block = mechanical_matching_four_path_block(
        low_index,
        high_index,
        published_total
      );
    }
    if (three_block.valid == 0u) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    if (
      three_block.applied != 0u
      && three_block.topology == 1u
      && three_block.path_owner == 0u
    ) { continue; }
    if (three_block.applied == 0u) {
      three_block = mechanical_matching_three_block(
        low_index,
        high_index,
        low_cursor,
        high_cursor,
        published_total
      );
    }
    if (three_block.valid == 0u) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let primary_markers_inactive =
      mechanical_solver_edge_inactive(csr_peers[low_cursor])
      && mechanical_solver_edge_inactive(csr_peers[high_cursor]);
    if (
      three_block.applied != 0u
      && three_block.member_count == 4u
    ) {
      let all_block_markers_inactive = primary_markers_inactive
        && mechanical_solver_edge_inactive(
          csr_peers[three_block.center_secondary_cursor]
        )
        && mechanical_solver_edge_inactive(
          csr_peers[three_block.secondary_center_cursor]
        )
        && mechanical_solver_edge_inactive(
          csr_peers[three_block.center_tertiary_cursor]
        )
        && mechanical_solver_edge_inactive(
          csr_peers[three_block.tertiary_center_cursor]
        );
      let center_output_pos_mass =
        output_state[three_block.center_index * 2u];
      let primary_output_pos_mass =
        output_state[three_block.primary_index * 2u];
      let secondary_output_pos_mass =
        output_state[three_block.secondary_index * 2u];
      let tertiary_output_pos_mass =
        output_state[three_block.tertiary_index * 2u];
      let center_output_velocity =
        output_state[three_block.center_index * 2u + 1u].xyz;
      let primary_output_velocity =
        output_state[three_block.primary_index * 2u + 1u].xyz;
      let secondary_output_velocity =
        output_state[three_block.secondary_index * 2u + 1u].xyz;
      let tertiary_output_velocity =
        output_state[three_block.tertiary_index * 2u + 1u].xyz;
      let block_replay_conditioning = max(
        max(
          max(
            length(center_output_velocity),
            length(primary_output_velocity)
          ),
          max(
            length(secondary_output_velocity),
            length(tertiary_output_velocity)
          )
        ),
        max(
          max(
            length(three_block.center_velocity),
            length(three_block.primary_velocity)
          ),
          max(
            length(three_block.secondary_velocity),
            length(three_block.tertiary_velocity)
          )
        )
      );
      let block_replay_tolerance_m_per_s = max(
        1.0e-6,
        64.0 * 1.1920929e-7 * max(block_replay_conditioning, 1.0)
      );
      if (
        !all_block_markers_inactive
        || any(
          center_output_pos_mass
            != input_state[three_block.center_index * 2u]
        )
        || any(
          primary_output_pos_mass
            != input_state[three_block.primary_index * 2u]
        )
        || any(
          secondary_output_pos_mass
            != input_state[three_block.secondary_index * 2u]
        )
        || any(
          tertiary_output_pos_mass
            != input_state[three_block.tertiary_index * 2u]
        )
        || length(
          center_output_velocity - three_block.center_velocity
        ) > block_replay_tolerance_m_per_s
        || length(
          primary_output_velocity - three_block.primary_velocity
        ) > block_replay_tolerance_m_per_s
        || length(
          secondary_output_velocity - three_block.secondary_velocity
        ) > block_replay_tolerance_m_per_s
        || length(
          tertiary_output_velocity - three_block.tertiary_velocity
        ) > block_replay_tolerance_m_per_s
      ) {
        atomicOr(
          &mechanical_diagnostic_trace[2u],
          MECHANICAL_DIAGNOSTIC_TRACE_INVALID
        );
        return;
      }
      if (target_tail_valid) {
        mechanical_diagnostic_capture_target_three_block(
          pass_index,
          three_block
        );
      }
      mechanical_diagnostic_accumulate_pair_impulse(
        pass_index,
        three_block.secondary_index,
        three_block.center_index,
        three_block.secondary_impulse,
        three_block.center_secondary_impulse
      );
      if (three_block.topology == 0u) {
        mechanical_diagnostic_accumulate_pair_impulse(
          pass_index,
          three_block.tertiary_index,
          three_block.center_index,
          three_block.tertiary_impulse,
          three_block.center_tertiary_impulse
        );
      }
      let center_selection =
        energy_ledger[mechanical_energy_base(three_block.center_index)];
      let primary_selection =
        energy_ledger[mechanical_energy_base(three_block.primary_index)];
      let secondary_selection =
        energy_ledger[mechanical_energy_base(three_block.secondary_index)];
      let tertiary_selection =
        energy_ledger[mechanical_energy_base(three_block.tertiary_index)];
      energy_ledger[mechanical_energy_base(three_block.center_index)] =
        vec4<f32>(
          center_selection.x,
          three_block.center_primary_impulse
        );
      energy_ledger[mechanical_energy_base(three_block.primary_index)] =
        vec4<f32>(
          primary_selection.x,
          three_block.primary_impulse
        );
      energy_ledger[mechanical_energy_base(three_block.secondary_index)] =
        vec4<f32>(
          secondary_selection.x,
          select(
            three_block.secondary_impulse,
            three_block.center_tertiary_impulse,
            three_block.topology == 1u
          )
        );
      energy_ledger[mechanical_energy_base(three_block.tertiary_index)] =
        vec4<f32>(
          tertiary_selection.x,
          three_block.tertiary_impulse
        );
      continue;
    }
    if (three_block.applied != 0u) {
      let all_block_markers_inactive =
        primary_markers_inactive
        && mechanical_solver_edge_inactive(
          csr_peers[three_block.center_secondary_cursor]
        )
        && mechanical_solver_edge_inactive(
          csr_peers[three_block.secondary_center_cursor]
        );
      let center_output_pos_mass =
        output_state[three_block.center_index * 2u];
      let primary_output_pos_mass =
        output_state[three_block.primary_index * 2u];
      let secondary_output_pos_mass =
        output_state[three_block.secondary_index * 2u];
      let center_output_velocity =
        output_state[three_block.center_index * 2u + 1u].xyz;
      let primary_output_velocity =
        output_state[three_block.primary_index * 2u + 1u].xyz;
      let secondary_output_velocity =
        output_state[three_block.secondary_index * 2u + 1u].xyz;
      let block_replay_conditioning = max(
        max(
          length(center_output_velocity),
          length(primary_output_velocity)
        ),
        max(
          length(secondary_output_velocity),
          max(
            length(three_block.center_velocity),
            max(
              length(three_block.primary_velocity),
              length(three_block.secondary_velocity)
            )
          )
        )
      );
      let block_replay_tolerance_m_per_s = max(
        1.0e-6,
        64.0 * 1.1920929e-7 * max(block_replay_conditioning, 1.0)
      );
      if (
        !all_block_markers_inactive
        || any(
          center_output_pos_mass
            != input_state[three_block.center_index * 2u]
        )
        || any(
          primary_output_pos_mass
            != input_state[three_block.primary_index * 2u]
        )
        || any(
          secondary_output_pos_mass
            != input_state[three_block.secondary_index * 2u]
        )
        || length(
          center_output_velocity - three_block.center_velocity
        ) > block_replay_tolerance_m_per_s
        || length(
          primary_output_velocity - three_block.primary_velocity
        ) > block_replay_tolerance_m_per_s
        || length(
          secondary_output_velocity - three_block.secondary_velocity
        ) > block_replay_tolerance_m_per_s
      ) {
        atomicOr(
          &mechanical_diagnostic_trace[2u],
          MECHANICAL_DIAGNOSTIC_TRACE_INVALID
        );
        return;
      }
      if (target_tail_valid) {
        mechanical_diagnostic_capture_target_three_block(
          pass_index,
          three_block
        );
      }
      // Keep the primary mutual edge in the established scratch ABI. The
      // secondary selector is non-mutual, so account that edge directly and
      // separately rather than folding the center's net impulse into one pair.
      mechanical_diagnostic_accumulate_pair_impulse(
        pass_index,
        three_block.secondary_index,
        three_block.center_index,
        three_block.secondary_impulse,
        three_block.center_secondary_impulse
      );
      let center_selection =
        energy_ledger[mechanical_energy_base(three_block.center_index)];
      let primary_selection =
        energy_ledger[mechanical_energy_base(three_block.primary_index)];
      let secondary_selection =
        energy_ledger[mechanical_energy_base(three_block.secondary_index)];
      energy_ledger[mechanical_energy_base(three_block.center_index)] =
        vec4<f32>(
          center_selection.x,
          three_block.center_primary_impulse
        );
      energy_ledger[mechanical_energy_base(three_block.primary_index)] =
        vec4<f32>(
          primary_selection.x,
          three_block.primary_impulse
        );
      energy_ledger[mechanical_energy_base(three_block.secondary_index)] =
        vec4<f32>(
          secondary_selection.x,
          three_block.secondary_impulse
        );
      continue;
    }
    // An unused support may already be an inactive reservation from an
    // earlier pass, so its post-apply marker has no unique expected polarity.
    // The mutual primary is the only edge this fallback must retire.
    if (!primary_markers_inactive) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let pair_mass_kg = low_pos_mass.w + high_pos_mass.w;
    let initial_relative_dv = mechanical_matching_relative_velocity_delta(
      low_initial_velocity - high_initial_velocity,
      low_constraint
    );
    let low_initial_dv =
      high_pos_mass.w / pair_mass_kg * initial_relative_dv;
    let high_initial_dv =
      -(low_pos_mass.w / high_pos_mass.w) * low_initial_dv;
    let refinement = mechanical_matching_refine_wall_velocity_pair(
      low_index,
      high_index,
      output_state[low_index * 2u].xyz,
      output_state[high_index * 2u].xyz,
      low_initial_velocity,
      high_initial_velocity,
      low_pos_mass.w,
      high_pos_mass.w,
      low_initial_dv,
      high_initial_dv,
      low_constraint
    );
    let low_output_velocity = output_state[low_index * 2u + 1u].xyz;
    let high_output_velocity = output_state[high_index * 2u + 1u].xyz;
    let replay_conditioning = max(
      max(length(low_output_velocity), length(high_output_velocity)),
      max(
        length(refinement.low_velocity),
        length(refinement.high_velocity)
      )
    );
    let replay_tolerance_m_per_s = max(
      1.0e-6,
      64.0 * 1.1920929e-7 * max(replay_conditioning, 1.0)
    );
    if (
      refinement.valid == 0u
      || !mechanical_solver_finite3(refinement.low_pair_impulse)
      || !mechanical_solver_finite3(refinement.high_pair_impulse)
      || length(refinement.low_velocity - low_output_velocity)
        > replay_tolerance_m_per_s
      || length(refinement.high_velocity - high_output_velocity)
        > replay_tolerance_m_per_s
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    if (target_tail_valid) {
      mechanical_diagnostic_capture_target_refinement(
        pass_index,
        low_index,
        high_index,
        output_state[low_index * 2u].xyz,
        output_state[high_index * 2u].xyz,
        low_initial_velocity,
        high_initial_velocity,
        low_pos_mass.w,
        high_pos_mass.w,
        low_initial_dv,
        high_initial_dv,
        low_constraint,
        refinement
      );
    }
    energy_ledger[mechanical_energy_base(low_index)] = vec4<f32>(
      selection.x,
      refinement.low_pair_impulse
    );
    energy_ledger[mechanical_energy_base(high_index)] = vec4<f32>(
      high_selection.x,
      refinement.high_pair_impulse
    );
  }
}

fn mechanical_diagnostic_capture_target_post_wall(pass_index: u32) {
  if (!mechanical_diagnostic_target_tail_header_valid()) { return; }
  let header = MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
  if (
    atomicLoad(
      &traversal_evidence[
        mechanical_matching_wall_count_word(pass_index)
      ]
    ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[header + 2u],
      MECHANICAL_DIAGNOSTIC_TARGET_TAIL_INVALID
    );
    return;
  }
  for (
    var target_slot = 0u;
    target_slot < MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
    target_slot = target_slot + 1u
  ) {
    let target_index = mechanical_diagnostic_target_index(target_slot);
    let row =
      mechanical_diagnostic_target_row_word(pass_index, target_slot, 0u);
    let post_wall_pos_mass = output_state[target_index * 2u];
    let post_wall_vel_u = output_state[target_index * 2u + 1u];
    let local_position = vec3<f32>(
      mechanical_diagnostic_trace_load_f32(row + 17u),
      mechanical_diagnostic_trace_load_f32(row + 18u),
      mechanical_diagnostic_trace_load_f32(row + 19u)
    );
    let local_velocity = vec3<f32>(
      mechanical_diagnostic_trace_load_f32(row + 20u),
      mechanical_diagnostic_trace_load_f32(row + 21u),
      mechanical_diagnostic_trace_load_f32(row + 22u)
    );
    mechanical_diagnostic_target_row_store_vec3(
      pass_index,
      target_slot,
      23u,
      post_wall_pos_mass.xyz
    );
    mechanical_diagnostic_target_row_store_vec3(
      pass_index,
      target_slot,
      26u,
      post_wall_vel_u.xyz
    );
    var flags =
      atomicLoad(&mechanical_diagnostic_trace[row + 7u])
        | MECHANICAL_DIAGNOSTIC_TARGET_ROW_POST_WALL_CAPTURE_COMPLETE;
    if (
      any(post_wall_pos_mass.xyz != local_position)
      || any(post_wall_vel_u.xyz != local_velocity)
    ) {
      flags =
        flags | MECHANICAL_DIAGNOSTIC_TARGET_ROW_POST_WALL_CHANGED;
    }
    atomicStore(&mechanical_diagnostic_trace[row + 7u], flags);
  }
  let prior_post_wall_capture_count = atomicAdd(
    &mechanical_diagnostic_trace[header + 9u],
    MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
  );
  if (
    prior_post_wall_capture_count
        + MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS
      == ${solverBudget.cleanupPassBudget
        * SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS}u
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[header + 2u],
      MECHANICAL_DIAGNOSTIC_TARGET_TAIL_POST_WALL_CAPTURE_COMPLETE
    );
  }
}

// Diagnostic-only single-invocation reduction. The apply dispatch publishes
// each mutual pair's complete local-refinement impulse through the replay
// dispatch into its now-dead selection scratch row. After the wall dispatch,
// this reducer also captures the targeted post-wall state. Pair impulses
// exclude wall momentum by construction. No production pipeline binds the
// trace slot.
@compute @workgroup_size(1)
fn trace_matching_cleanup_apply() {
  if (!mechanical_diagnostic_trace_header_valid()) { return; }
  if (
    (
      atomicLoad(&mechanical_diagnostic_trace[2u])
        & MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    ) != 0u
  ) { return; }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) { return; }
  if (
    atomicLoad(
      &traversal_evidence[
        mechanical_matching_apply_count_word(pass_index)
      ]
    ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  mechanical_diagnostic_capture_target_post_wall(pass_index);
  let material_a_bits = atomicLoad(&mechanical_diagnostic_trace[12u]);
  let material_b_bits = atomicLoad(&mechanical_diagnostic_trace[13u]);
  var material_a_impulse = vec3<f32>(
    mechanical_diagnostic_trace_load_f32(20u),
    mechanical_diagnostic_trace_load_f32(21u),
    mechanical_diagnostic_trace_load_f32(22u)
  );
  var material_b_impulse = vec3<f32>(
    mechanical_diagnostic_trace_load_f32(23u),
    mechanical_diagnostic_trace_load_f32(24u),
    mechanical_diagnostic_trace_load_f32(25u)
  );
  var momentum_residual = vec3<f32>(
    mechanical_diagnostic_trace_load_f32(26u),
    mechanical_diagnostic_trace_load_f32(27u),
    mechanical_diagnostic_trace_load_f32(28u)
  );
  var largest_lateral_impulse =
    mechanical_diagnostic_trace_load_f32(29u);
  var configured_pair_count =
    atomicLoad(&mechanical_diagnostic_trace[16u]);
  var cross_material_pair_count =
    atomicLoad(&mechanical_diagnostic_trace[17u]);
  var first_configured_pass =
    atomicLoad(&mechanical_diagnostic_trace[18u]);
  var last_configured_pass =
    atomicLoad(&mechanical_diagnostic_trace[19u]);
  var largest_low_index =
    atomicLoad(&mechanical_diagnostic_trace[30u]);
  var largest_high_index =
    atomicLoad(&mechanical_diagnostic_trace[31u]);
  var pass_configured_pair_count = 0u;
  for (
    var low_index = 0u;
    low_index < mechanical_params.particle_count;
    low_index = low_index + 1u
  ) {
    let selection = energy_ledger[mechanical_energy_base(low_index)];
    let high_index = bitcast<u32>(selection.x);
    if (
      high_index <= low_index
      || high_index >= mechanical_params.particle_count
    ) { continue; }
    let high_selection =
      energy_ledger[mechanical_energy_base(high_index)];
    if (bitcast<u32>(high_selection.x) != low_index) { continue; }
    let low_impulse = selection.yzw;
    let high_impulse = high_selection.yzw;
    if (
      !mechanical_solver_finite3(low_impulse)
      || !mechanical_solver_finite3(high_impulse)
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let low_material_bits =
      bitcast<u32>(source_thermo[low_index * 3u].x);
    let high_material_bits =
      bitcast<u32>(source_thermo[high_index * 3u].x);
    if (low_material_bits != high_material_bits) {
      cross_material_pair_count = cross_material_pair_count + 1u;
    }
    let low_is_a_high_is_b =
      low_material_bits == material_a_bits
      && high_material_bits == material_b_bits;
    let low_is_b_high_is_a =
      low_material_bits == material_b_bits
      && high_material_bits == material_a_bits;
    if (!low_is_a_high_is_b && !low_is_b_high_is_a) { continue; }
    configured_pair_count = configured_pair_count + 1u;
    pass_configured_pair_count = pass_configured_pair_count + 1u;
    first_configured_pass = min(first_configured_pass, pass_index);
    last_configured_pass = pass_index;
    let impulse_a = select(
      high_impulse,
      low_impulse,
      low_is_a_high_is_b
    );
    let impulse_b = select(
      low_impulse,
      high_impulse,
      low_is_a_high_is_b
    );
    material_a_impulse = material_a_impulse + impulse_a;
    material_b_impulse = material_b_impulse + impulse_b;
    momentum_residual = momentum_residual + low_impulse + high_impulse;
    let lateral_impulse = length(vec2<f32>(impulse_a.x, impulse_a.z));
    if (lateral_impulse > largest_lateral_impulse) {
      largest_lateral_impulse = lateral_impulse;
      largest_low_index = low_index;
      largest_high_index = high_index;
    }
  }
  if (
    !mechanical_solver_finite3(material_a_impulse)
    || !mechanical_solver_finite3(material_b_impulse)
    || !mechanical_solver_finite3(momentum_residual)
    || !mechanical_solver_finite(largest_lateral_impulse)
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  atomicStore(&mechanical_diagnostic_trace[16u], configured_pair_count);
  atomicStore(
    &mechanical_diagnostic_trace[17u],
    cross_material_pair_count
  );
  atomicStore(
    &mechanical_diagnostic_trace[18u],
    first_configured_pass
  );
  atomicStore(
    &mechanical_diagnostic_trace[19u],
    last_configured_pass
  );
  mechanical_diagnostic_trace_store_f32(20u, material_a_impulse.x);
  mechanical_diagnostic_trace_store_f32(21u, material_a_impulse.y);
  mechanical_diagnostic_trace_store_f32(22u, material_a_impulse.z);
  mechanical_diagnostic_trace_store_f32(23u, material_b_impulse.x);
  mechanical_diagnostic_trace_store_f32(24u, material_b_impulse.y);
  mechanical_diagnostic_trace_store_f32(25u, material_b_impulse.z);
  mechanical_diagnostic_trace_store_f32(26u, momentum_residual.x);
  mechanical_diagnostic_trace_store_f32(27u, momentum_residual.y);
  mechanical_diagnostic_trace_store_f32(28u, momentum_residual.z);
  mechanical_diagnostic_trace_store_f32(29u, largest_lateral_impulse);
  atomicStore(&mechanical_diagnostic_trace[30u], largest_low_index);
  atomicStore(&mechanical_diagnostic_trace[31u], largest_high_index);
  atomicAdd(&mechanical_diagnostic_trace[14u], 1u);
  atomicOr(
    &mechanical_diagnostic_trace[2u],
    MECHANICAL_DIAGNOSTIC_TRACE_IMPULSE_FINITE
  );
  if (pass_configured_pair_count > 0u) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_APPLY_OBSERVED
    );
  }
}

fn project_matching_cleanup_walls_for_index(self_index: u32) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) { return; }
  if (
    !mechanical_matching_preflight(pass_index)
    || atomicLoad(
        &traversal_evidence[
          mechanical_matching_apply_count_word(pass_index)
        ]
      ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  let pos_mass = output_state[self_index * 2u];
  let vel_u = output_state[self_index * 2u + 1u];
  var position = pos_mass.xyz;
  var velocity = vel_u.xyz;
  let rest_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  var wall_clearance = 0.0;
  if (rest_volume > 0.0) {
    wall_clearance = 0.5 * mechanical_solver_cbrt(rest_volume);
    if (mechanical_params.grid_spacing_m > 0.0) {
      wall_clearance = min(
        wall_clearance,
        0.5 * mechanical_params.grid_spacing_m
      );
    }
    let min_dimension = min(
      mechanical_params.box_dims_m.x,
      min(mechanical_params.box_dims_m.y, mechanical_params.box_dims_m.z)
    );
    if (min_dimension > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dimension);
    }
  }
  let lower = vec3<f32>(wall_clearance);
  let upper = max(lower, mechanical_params.box_dims_m - lower);
  let lower_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(lower.x, upper.x),
    mechanical_solver_wall_boundary_tolerance_m(lower.y, upper.y),
    mechanical_solver_wall_boundary_tolerance_m(lower.z, upper.z)
  );
  let upper_tolerance_m = vec3<f32>(
    mechanical_solver_wall_boundary_tolerance_m(upper.x, lower.x),
    mechanical_solver_wall_boundary_tolerance_m(upper.y, lower.y),
    mechanical_solver_wall_boundary_tolerance_m(upper.z, lower.z)
  );
  if (position.x < lower.x) {
    position.x = lower.x;
  } else if (position.x > upper.x) {
    position.x = upper.x;
  }
  if (position.y < lower.y) {
    position.y = lower.y;
  } else if (position.y > upper.y) {
    position.y = upper.y;
  }
  if (position.z < lower.z) {
    position.z = lower.z;
  } else if (position.z > upper.z) {
    position.z = upper.z;
  }
  if (
    position.x <= lower.x + lower_tolerance_m.x
    && velocity.x < 0.0
  ) { velocity.x = 0.0; }
  if (
    position.x >= upper.x - upper_tolerance_m.x
    && velocity.x > 0.0
  ) { velocity.x = 0.0; }
  if (
    position.y <= lower.y + lower_tolerance_m.y
    && velocity.y < 0.0
  ) { velocity.y = 0.0; }
  if (
    position.y >= upper.y - upper_tolerance_m.y
    && velocity.y > 0.0
  ) { velocity.y = 0.0; }
  if (
    position.z <= lower.z + lower_tolerance_m.z
    && velocity.z < 0.0
  ) { velocity.z = 0.0; }
  if (
    position.z >= upper.z - upper_tolerance_m.z
    && velocity.z > 0.0
  ) { velocity.z = 0.0; }
  let wall_kinetic_delta_j = 0.5 * pos_mass.w * (
    dot(velocity, velocity) - dot(vel_u.xyz, vel_u.xyz)
  );
  let wall_conditioning_j = 0.5 * pos_mass.w * (
    dot(velocity, velocity) + dot(vel_u.xyz, vel_u.xyz)
  );
  let wall_tolerance_j = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(wall_conditioning_j, 1.0)
  );
  let scale = particle_scales[self_index];
  let epoch_displacement_m = length(
    position - mechanical_solver_epoch_position(self_index)
  );
  let trust_tolerance_m = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(scale.z, 1.0)
  );
  if (
    !mechanical_solver_finite3(position)
    || !mechanical_solver_finite3(velocity)
    || !mechanical_solver_finite(wall_kinetic_delta_j)
    || scale.z < 0.0
    || wall_kinetic_delta_j > wall_tolerance_j
    || epoch_displacement_m > scale.z + trust_tolerance_m
  ) {
    atomicOr(
      &graph_control[14u],
      select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
        mechanical_solver_finite(wall_kinetic_delta_j)
          && wall_kinetic_delta_j > wall_tolerance_j
      )
    );
    return;
  }
  let wall_heat_j = max(0.0, -wall_kinetic_delta_j);
  let cumulative = energy_ledger[mechanical_energy_base(self_index) + 1u];
  let next_wall_heat_j = cumulative.z + wall_heat_j;
  let next_u = select(
    vel_u.w,
    cumulative.w
      + (cumulative.y + next_wall_heat_j) / pos_mass.w,
    pos_mass.w > 0.0
  );
  if (!mechanical_solver_finite(next_u) || next_u < 0.0) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
        .NEGATIVE_INTERNAL_ENERGY}u
    );
    return;
  }
  if (
    any(position != pos_mass.xyz)
    || any(velocity != vel_u.xyz)
  ) {
    // Pair activity reads only endpoint positions and velocities; a wall
    // projection that changed either makes this particle a mover for the
    // next pass's moved-set expansion.
    mechanical_matching_owner_record_mover(self_index);
  }
  output_state[self_index * 2u] = vec4<f32>(position, pos_mass.w);
  output_state[self_index * 2u + 1u] = vec4<f32>(velocity, next_u);
  energy_ledger[mechanical_energy_base(self_index) + 1u] = vec4<f32>(
    cumulative.x,
    cumulative.y,
    next_wall_heat_j,
    cumulative.w
  );
  particle_scales[self_index].w = max(0.0, scale.z - epoch_displacement_m);
  atomicAdd(
    &traversal_evidence[mechanical_matching_wall_count_word(pass_index)],
    1u
  );
}

@compute @workgroup_size(64)
fn project_matching_cleanup_walls(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  project_matching_cleanup_walls_for_index(global_id.x);
}

fn finalize_matching_cleanup_pass_body() {
  if (!mechanical_solver_full_path_enabled()) { return; }
  if (arrayLength(&matching_cleanup_dispatch) < 3u) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  let pass_index = mechanical_matching_current_pass();
  if (
    pass_index
      >= ${solverBudget.cleanupPassBudget}u
  ) { return; }
  if (
    !mechanical_matching_preflight(pass_index)
    || atomicLoad(
      &traversal_evidence[mechanical_matching_wall_count_word(pass_index)]
    ) != mechanical_params.particle_count
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (
    atomicLoad(
      &traversal_evidence[
        mechanical_matching_applied_pair_count_word(pass_index)
      ]
    ) == 0u
  ) {
    let terminal_position_ratio = atomicLoad(
      &traversal_evidence[
        mechanical_matching_max_position_ratio_word(pass_index)
      ]
    );
    let terminal_velocity_residual = atomicLoad(
      &traversal_evidence[
        mechanical_matching_max_velocity_residual_word(pass_index)
      ]
    );
    if (
      bitcast<f32>(terminal_position_ratio) <= 1.0
      && bitcast<f32>(terminal_velocity_residual) <= ${
        SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
          .toExponential(1)
      }
      && (pass_index & 1u)
        == ${((solverBudget.cleanupPassBudget - 1) & 1)}u
    ) {
      // No unprocessed violated edge remains and the all-edge residual is
      // certified. Convergence is accepted only on the fixed terminal-buffer
      // parity. An otherwise-terminal opposite-parity pass advances once so
      // the following conflict-free copy publishes the identical state into
      // the host's deterministic final buffer. Then latch the particle
      // dispatch to zero and synthesize the unused evidence tail on-GPU.
      for (
        var completed_pass = pass_index + 1u;
        completed_pass
          < ${solverBudget.cleanupPassBudget}u;
        completed_pass = completed_pass + 1u
      ) {
        atomicStore(
          &traversal_evidence[
            mechanical_matching_selection_count_word(completed_pass)
          ],
          mechanical_params.particle_count
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_copy_count_word(completed_pass)
          ],
          mechanical_params.particle_count
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_apply_count_word(completed_pass)
          ],
          mechanical_params.particle_count
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_wall_count_word(completed_pass)
          ],
          mechanical_params.particle_count
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_applied_pair_count_word(completed_pass)
          ],
          0u
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_max_position_ratio_word(completed_pass)
          ],
          terminal_position_ratio
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_max_velocity_residual_word(completed_pass)
          ],
          terminal_velocity_residual
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_contact_count_word(completed_pass)
          ],
          atomicLoad(
            &traversal_evidence[
              mechanical_matching_contact_count_word(pass_index)
            ]
          )
        );
      }
      atomicStore(
        &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
          .matchingCleanupPassCount}u],
        ${solverBudget.cleanupPassBudget}u
      );
      atomicOr(
        &graph_control[15u],
        ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_CLEANUP}u
      );
      atomicStore(&matching_cleanup_dispatch[0u], 0u);
      atomicStore(&matching_cleanup_dispatch[1u], 1u);
      atomicStore(&matching_cleanup_dispatch[2u], 1u);
      return;
    }
    // A zero matching with residual remaining is the delimiter between fixed
    // edge-order sweeps: every currently violated edge was already processed.
    // Advance once; the next selection pass clears the private CSR markers.
  }
  let prior_pass = atomicAdd(
    &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .matchingCleanupPassCount}u],
    1u
  );
  if (
    prior_pass + 1u
      == ${solverBudget.cleanupPassBudget}u
  ) {
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.MATCHING_CLEANUP}u
    );
  }
}

@compute @workgroup_size(1)
fn finalize_matching_cleanup_pass() {
  finalize_matching_cleanup_pass_body();
}

@compute @workgroup_size(64)
fn restore_matching_cleanup_trust(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let final_pass =
    ${solverBudget.cleanupPassBudget - 1}u;
  if (
    atomicLoad(&graph_control[14u]) != 0u
    || arrayLength(&matching_constraints)
      < mechanical_params.directed_pair_capacity
    || mechanical_matching_current_pass()
      != ${solverBudget.cleanupPassBudget}u
    || atomicLoad(
      &traversal_evidence[mechanical_matching_wall_count_word(final_pass)]
    ) != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_CLEANUP}u
    ) == 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  particle_scales[self_index].z = particle_scales[self_index].x;
  particle_scales[self_index].w = particle_scales[self_index].y;
  atomicAdd(
    &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .matchingCleanupTrustRestoreCount}u],
    1u
  );
  if (self_index == 0u) {
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE
        .MATCHING_TRUST_RESTORED}u
    );
  }
}

@compute @workgroup_size(64)
fn verify_contact_residual(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  let graph_was_verified =
    atomicLoad(&graph_control[16u]) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.GRAPH_VERIFIED}u
    ) != 0u;
  let row_bounds_valid = graph_was_verified
    && total <= mechanical_params.directed_pair_capacity
    && total <= arrayLength(&csr_peers)
    && begin <= end
    && end <= total;
  if (row_bounds_valid) {
    // Cleanup is unconditional once CSR bounds are known. Even a prior
    // solver failure must not leave solver-private high bits in the retained
    // public peer buffer.
    for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
      csr_peers[cursor] = mechanical_solver_peer_index(csr_peers[cursor]);
    }
  }
  let final_iteration =
    mechanical_params.solver_iteration_count - 1u;
  let solver_stages_incomplete = (
    atomicLoad(
      &graph_control[mechanical_solve_count_word(final_iteration)]
    ) != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & mechanical_iteration_stage_bit(final_iteration)
    ) == 0u
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_VERIFIED}u
    ) == 0u
    || atomicLoad(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupPassCount}u]
    ) != ${solverBudget.cleanupPassBudget}u
    || atomicLoad(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupTrustRestoreCount}u]
    ) != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_CLEANUP}u
    ) == 0u
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE
          .MATCHING_TRUST_RESTORED}u
    ) == 0u
  );
  if (solver_stages_incomplete) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  // Residual workgroups publish into one sticky word. A sibling can report a
  // real residual before this invocation reaches the preflight; preserve that
  // primary bit without relabelling completed solver work as incomplete.
  if (atomicLoad(&graph_control[14u]) != 0u) { return; }
  if (!row_bounds_valid) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  var max_position_residual = 0.0;
  var max_velocity_residual = 0.0;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = csr_peers[cursor];
    // Certify the same immutable supporting halfspace and swept response frame
    // used by selection and application. Recomputing finite-volume geometry
    // here would certify a different constraint family than cleanup solved.
    let low_index = min(self_index, other_index);
    let high_index = max(self_index, other_index);
    let pair = mechanical_matching_constraint_pair(
      low_index,
      high_index,
      cursor
    );
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    if (pair.active_pair == 0u) { continue; }
    if (pair.unilateral == 1u) {
      let self_volume = max(
        source_mechanics[self_index * 8u + 4u].w,
        0.0
      );
      let other_volume = max(
        source_mechanics[other_index * 8u + 4u].w,
        0.0
      );
      let rest_distance = 0.5 * (
        mechanical_solver_cbrt(self_volume)
          + mechanical_solver_cbrt(other_volume)
      );
      let position_tolerance = max(
        1.0e-5,
        ${SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION}
          * rest_distance
      );
      if (pair.position_residual > position_tolerance) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.POSITION_RESIDUAL}u
        );
      }
      if (pair.velocity_residual > ${
        SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S
          .toExponential(1)
      }) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.VELOCITY_RESIDUAL}u
        );
      }
      max_position_residual = max(
        max_position_residual,
        pair.position_residual
      );
      max_velocity_residual = max(
        max_velocity_residual,
        pair.velocity_residual
      );
    }
  }
  atomicMax(
    &graph_control[27u],
    bitcast<u32>(max_position_residual)
  );
  atomicMax(
    &graph_control[28u],
    bitcast<u32>(max_velocity_residual)
  );
  atomicMax(
    &traversal_evidence[30u],
    bitcast<u32>(max_position_residual)
  );
  atomicMax(
    &traversal_evidence[31u],
    bitcast<u32>(max_velocity_residual)
  );
  atomicAdd(&graph_control[17u], 1u);
  if (self_index == 0u) {
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    );
  }
}

// The production verifier is fail-closed and siblings may observe its sticky
// bit before scanning their own rows. These diagnostic passes independently
// measure the complete terminal constraint set, then choose one deterministic
// global CSR cursor and materialize it without changing production evidence.
@compute @workgroup_size(64)
fn measure_terminal_residual_trace(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_diagnostic_trace_header_valid()) { return; }
  if (self_index == 0u) {
    atomicStore(
      &mechanical_diagnostic_trace[15u],
      atomicLoad(&graph_control[14u])
    );
    atomicStore(
      &mechanical_diagnostic_trace[62u],
      atomicLoad(&graph_control[28u])
    );
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_TERMINAL_MEASURED
    );
  }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (begin > end || end > arrayLength(&csr_peers)) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = mechanical_solver_peer_index(csr_peers[cursor]);
    if (other_index >= mechanical_params.particle_count) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let pair = mechanical_matching_constraint_pair(
      min(self_index, other_index),
      max(self_index, other_index),
      cursor
    );
    if (pair.valid == 0u) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    if (pair.active_pair == 0u || pair.unilateral == 0u) { continue; }
    atomicMax(
      &mechanical_diagnostic_trace[32u],
      bitcast<u32>(pair.velocity_residual)
    );
    atomicAdd(&mechanical_diagnostic_trace[63u], 1u);
  }
}

@compute @workgroup_size(64)
fn select_terminal_residual_trace(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_diagnostic_trace_header_valid()) { return; }
  let terminal_max_bits =
    atomicLoad(&mechanical_diagnostic_trace[32u]);
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (begin > end || end > arrayLength(&csr_peers)) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = mechanical_solver_peer_index(csr_peers[cursor]);
    if (other_index >= mechanical_params.particle_count) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    let pair = mechanical_matching_constraint_pair(
      min(self_index, other_index),
      max(self_index, other_index),
      cursor
    );
    if (pair.valid == 0u) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
      return;
    }
    if (
      pair.active_pair == 1u
      && pair.unilateral == 1u
      && bitcast<u32>(pair.velocity_residual) == terminal_max_bits
    ) {
      atomicMin(&mechanical_diagnostic_trace[33u], cursor);
    }
  }
}

@compute @workgroup_size(1)
fn materialize_terminal_residual_trace() {
  if (!mechanical_diagnostic_trace_header_valid()) { return; }
  let winner_cursor = atomicLoad(&mechanical_diagnostic_trace[33u]);
  let production_max_bits = atomicLoad(&mechanical_diagnostic_trace[62u]);
  let measured_max_bits = atomicLoad(&mechanical_diagnostic_trace[32u]);
  if (production_max_bits == measured_max_bits) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_PRODUCTION_MAX_MATCH
    );
  }
  if (mechanical_diagnostic_target_tail_header_valid()) {
    let header = MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
    let expected_target_capture_count =
      atomicLoad(&mechanical_diagnostic_trace[14u])
        * MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS;
    let local_capture_count =
      atomicLoad(&mechanical_diagnostic_trace[header + 8u]);
    let post_wall_capture_count =
      atomicLoad(&mechanical_diagnostic_trace[header + 9u]);
    if (
      local_capture_count == expected_target_capture_count
      && post_wall_capture_count == expected_target_capture_count
    ) {
      atomicOr(
        &mechanical_diagnostic_trace[header + 2u],
        MECHANICAL_DIAGNOSTIC_TARGET_TAIL_LOCAL_CAPTURE_COMPLETE
          | MECHANICAL_DIAGNOSTIC_TARGET_TAIL_POST_WALL_CAPTURE_COMPLETE
      );
    } else {
      atomicOr(
        &mechanical_diagnostic_trace[header + 2u],
        MECHANICAL_DIAGNOSTIC_TARGET_TAIL_INVALID
      );
    }
  }
  if (winner_cursor == 0xffffffffu) {
    if (atomicLoad(&mechanical_diagnostic_trace[63u]) != 0u) {
      atomicOr(
        &mechanical_diagnostic_trace[2u],
        MECHANICAL_DIAGNOSTIC_TRACE_INVALID
      );
    }
    return;
  }
  var source_index = 0xffffffffu;
  for (
    var candidate = 0u;
    candidate < mechanical_params.particle_count;
    candidate = candidate + 1u
  ) {
    let begin = source_offsets[candidate];
    let end = source_offsets[candidate + 1u];
    if (winner_cursor >= begin && winner_cursor < end) {
      source_index = candidate;
      break;
    }
  }
  if (
    source_index == 0xffffffffu
    || winner_cursor >= arrayLength(&csr_peers)
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  let peer_index =
    mechanical_solver_peer_index(csr_peers[winner_cursor]);
  if (peer_index >= mechanical_params.particle_count) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  let low_index = min(source_index, peer_index);
  let high_index = max(source_index, peer_index);
  var reciprocal_cursor = 0xffffffffu;
  let peer_begin = source_offsets[peer_index];
  let peer_end = source_offsets[peer_index + 1u];
  for (
    var cursor = peer_begin;
    cursor < peer_end;
    cursor = cursor + 1u
  ) {
    if (
      mechanical_solver_peer_index(csr_peers[cursor]) == source_index
    ) {
      reciprocal_cursor = cursor;
      break;
    }
  }
  let pair = mechanical_matching_constraint_pair(
    low_index,
    high_index,
    winner_cursor
  );
  let constraint = matching_constraints[winner_cursor];
  if (
    reciprocal_cursor == 0xffffffffu
    || pair.valid == 0u
    || pair.active_pair == 0u
    || pair.unilateral == 0u
    || !mechanical_matching_constraint_code_valid(constraint)
  ) {
    atomicOr(
      &mechanical_diagnostic_trace[2u],
      MECHANICAL_DIAGNOSTIC_TRACE_INVALID
    );
    return;
  }
  let constraint_normal =
    mechanical_matching_constraint_normal(constraint);
  let low_pos_mass = input_state[low_index * 2u];
  let high_pos_mass = input_state[high_index * 2u];
  let low_velocity = input_state[low_index * 2u + 1u].xyz;
  let high_velocity = input_state[high_index * 2u + 1u].xyz;
  let low_material =
    u32(round(source_thermo[low_index * 3u].x));
  let high_material =
    u32(round(source_thermo[high_index * 3u].x));
  var low_domain = 0u;
  var high_domain = 0u;
  if (mechanical_params.identity_enabled != 0u) {
    low_domain = source_identity[low_index];
    high_domain = source_identity[high_index];
  }
  atomicStore(&mechanical_diagnostic_trace[34u], source_index);
  atomicStore(&mechanical_diagnostic_trace[35u], peer_index);
  atomicStore(&mechanical_diagnostic_trace[36u], low_index);
  atomicStore(&mechanical_diagnostic_trace[37u], high_index);
  atomicStore(&mechanical_diagnostic_trace[38u], reciprocal_cursor);
  atomicStore(
    &mechanical_diagnostic_trace[39u],
    bitcast<u32>(i32(round(constraint.w)))
  );
  mechanical_diagnostic_trace_store_f32(40u, pair.position_residual);
  mechanical_diagnostic_trace_store_f32(41u, pair.velocity_residual);
  mechanical_diagnostic_trace_store_f32(42u, constraint.x);
  mechanical_diagnostic_trace_store_f32(43u, constraint.y);
  mechanical_diagnostic_trace_store_f32(44u, constraint.z);
  mechanical_diagnostic_trace_store_f32(45u, constraint_normal.x);
  mechanical_diagnostic_trace_store_f32(46u, constraint_normal.y);
  mechanical_diagnostic_trace_store_f32(47u, constraint_normal.z);
  atomicStore(&mechanical_diagnostic_trace[48u], low_material);
  atomicStore(&mechanical_diagnostic_trace[49u], high_material);
  atomicStore(
    &mechanical_diagnostic_trace[50u],
    mechanical_solver_phase_class(low_index)
  );
  atomicStore(
    &mechanical_diagnostic_trace[51u],
    mechanical_solver_phase_class(high_index)
  );
  atomicStore(&mechanical_diagnostic_trace[52u], low_domain);
  atomicStore(&mechanical_diagnostic_trace[53u], high_domain);
  mechanical_diagnostic_trace_store_f32(54u, low_pos_mass.w);
  mechanical_diagnostic_trace_store_f32(55u, high_pos_mass.w);
  let relative_velocity = low_velocity - high_velocity;
  mechanical_diagnostic_trace_store_f32(56u, relative_velocity.x);
  mechanical_diagnostic_trace_store_f32(57u, relative_velocity.y);
  mechanical_diagnostic_trace_store_f32(58u, relative_velocity.z);
  mechanical_diagnostic_trace_store_f32(59u, pair.barrier_dv.x);
  mechanical_diagnostic_trace_store_f32(60u, pair.barrier_dv.y);
  mechanical_diagnostic_trace_store_f32(61u, pair.barrier_dv.z);
  if (mechanical_diagnostic_target_tail_header_valid()) {
    let header = MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD;
    let target_a = mechanical_diagnostic_target_index(0u);
    let target_b = mechanical_diagnostic_target_index(1u);
    let target_a_matches =
      target_a == low_index || target_a == high_index;
    let target_b_matches =
      target_b == low_index || target_b == high_index;
    let exact_pair_match =
      target_a_matches
        && target_b_matches
        && target_a != target_b;
    var target_match_bits = 0u;
    if (target_a_matches) {
      target_match_bits = target_match_bits | 1u;
    }
    if (target_b_matches) {
      target_match_bits = target_match_bits | 2u;
    }
    if (exact_pair_match) {
      target_match_bits = target_match_bits | 4u;
      atomicOr(
        &mechanical_diagnostic_trace[header + 2u],
        MECHANICAL_DIAGNOSTIC_TARGET_TAIL_WINNER_TARGET_MATCH
      );
    }
    atomicStore(
      &mechanical_diagnostic_trace[header + 10u],
      target_match_bits
    );
  }
  atomicOr(
    &mechanical_diagnostic_trace[2u],
    MECHANICAL_DIAGNOSTIC_TRACE_WINNER_MATERIALIZED
  );
}

`;
}

function createSchroederSpatialMechanicalGraphSolverWgslForBudget(
  solverBudget
) {
  return /* wgsl */ `
${createSchroederSpatialMechanicalGraphSolverCoreWgsl(solverBudget)}

struct MechanicalMatchingOwnerFrontierCounts {
  active_count: u32,
  contact_count: u32,
  active_cursor_count: u32,
  valid: u32,
};

var<workgroup> mechanical_matching_owner_active_count: atomic<u32>;
var<workgroup> mechanical_matching_owner_contact_count: atomic<u32>;
var<workgroup> mechanical_matching_owner_cursor_count: atomic<u32>;
var<workgroup> mechanical_matching_owner_count_invalid: atomic<u32>;
// Compacted frontier list for the chunked owner: seeded by one validated
// full-particle scan per dispatch, appended at admission transitions inside
// expansion. Capacity mirrors the owner's active-particle cap; a frontier
// larger than the cap fails the pass closed before any phase consumes a
// truncated list.
var<workgroup> mechanical_matching_owner_list:
  array<u32, ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}>;
var<workgroup> mechanical_matching_owner_list_count: atomic<u32>;
// Double-buffered mover lists for moved-set incremental expansion: the
// apply and wall phases record every particle whose state word they wrote;
// the next logical pass's expansion evaluates only those rows. Overflow or
// a fresh dispatch forces the complete frontier scan instead (fail-safe).
var<workgroup> mechanical_matching_owner_moved_a:
  array<u32, ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}>;
var<workgroup> mechanical_matching_owner_moved_b:
  array<u32, ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}>;
var<workgroup> mechanical_matching_owner_moved_count_a: atomic<u32>;
var<workgroup> mechanical_matching_owner_moved_count_b: atomic<u32>;
var<workgroup> mechanical_matching_owner_moved_phase: u32;
var<workgroup> mechanical_matching_owner_moved_prev_valid: u32;
var<workgroup> mechanical_matching_owner_wall_pending_count: atomic<u32>;

fn mechanical_matching_owner_record_mover(moved_index: u32) {
  let pending_prior = atomicOr(
    &matching_cleanup_dispatch[
      MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + moved_index
    ],
    MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT
  );
  if ((pending_prior & MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT) == 0u) {
    atomicAdd(&mechanical_matching_owner_wall_pending_count, 1u);
  }
  if (mechanical_matching_owner_moved_phase == 0u) {
    let slot = atomicAdd(&mechanical_matching_owner_moved_count_a, 1u);
    if (slot < ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u) {
      mechanical_matching_owner_moved_a[slot] = moved_index;
    }
  } else {
    let slot = atomicAdd(&mechanical_matching_owner_moved_count_b, 1u);
    if (slot < ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u) {
      mechanical_matching_owner_moved_b[slot] = moved_index;
    }
  }
}

fn mechanical_matching_owner_frontier_counts(
  lane: u32,
  published_total: u32
) -> MechanicalMatchingOwnerFrontierCounts {
  var result = MechanicalMatchingOwnerFrontierCounts(0u, 0u, 0u, 0u);
  if (lane == 0u) {
    atomicStore(&mechanical_matching_owner_active_count, 0u);
    atomicStore(&mechanical_matching_owner_contact_count, 0u);
    atomicStore(&mechanical_matching_owner_cursor_count, 0u);
    atomicStore(&mechanical_matching_owner_count_invalid, 0u);
  }
  workgroupBarrier();
  var local_active_count = 0u;
  var local_contact_count = 0u;
  var local_cursor_count = 0u;
  var local_invalid = 0u;
  if (
    arrayLength(&source_offsets) < mechanical_params.particle_count + 1u
    || published_total > arrayLength(&matching_constraints)
    || published_total > arrayLength(&csr_peers)
  ) {
    local_invalid = 1u;
  } else {
    for (
      var self_index = lane;
      self_index < mechanical_params.particle_count;
      self_index = self_index + 128u
    ) {
      let flags = atomicLoad(
        &matching_cleanup_dispatch[
          MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
        ]
      );
      let frontier_active =
        (flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) != 0u;
      let contact_active =
        (flags & MECHANICAL_MATCHING_OWNER_CONTACT_BIT) != 0u;
      if (
        (flags & ~(MECHANICAL_MATCHING_OWNER_FRONTIER_BIT
          | MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT
          | MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT
          | MECHANICAL_MATCHING_OWNER_CONTACT_BIT)) != 0u
        || (contact_active && !frontier_active)
      ) {
        local_invalid = 1u;
        continue;
      }
      if (frontier_active) {
        let begin = source_offsets[self_index];
        let end = source_offsets[self_index + 1u];
        if (begin > end || end > published_total) {
          local_invalid = 1u;
          continue;
        }
        let degree = end - begin;
        if (local_cursor_count > published_total - degree) {
          local_invalid = 1u;
          continue;
        }
        local_active_count = local_active_count + 1u;
        local_cursor_count = local_cursor_count + degree;
      }
      if (contact_active) {
        local_contact_count = local_contact_count + 1u;
      }
    }
  }
  if (local_invalid != 0u) {
    atomicOr(&mechanical_matching_owner_count_invalid, 1u);
  } else {
    atomicAdd(
      &mechanical_matching_owner_active_count,
      local_active_count
    );
    atomicAdd(
      &mechanical_matching_owner_contact_count,
      local_contact_count
    );
    let prior_cursor_count = atomicAdd(
      &mechanical_matching_owner_cursor_count,
      local_cursor_count
    );
    if (prior_cursor_count > published_total - local_cursor_count) {
      atomicOr(&mechanical_matching_owner_count_invalid, 1u);
    }
  }
  workgroupBarrier();
  if (atomicLoad(&mechanical_matching_owner_count_invalid) != 0u) {
    return result;
  }
  result.active_count =
    atomicLoad(&mechanical_matching_owner_active_count);
  result.contact_count =
    atomicLoad(&mechanical_matching_owner_contact_count);
  result.active_cursor_count =
    atomicLoad(&mechanical_matching_owner_cursor_count);
  result.valid = 1u;
  return result;
}

// Seed the compacted frontier list for one chunked owner dispatch. This runs
// the exact validation of mechanical_matching_owner_frontier_counts over
// every particle once per dispatch and records each frontier member's index,
// so the order-free per-pass phases (selection/copy/apply/wall/propagate)
// iterate the bounded contact set instead of rescanning every particle. The
// dormant-discovery expansion phase deliberately KEEPS its full particle
// scan: same-pass cascade admission order is part of the deterministic
// logical-pass contract and must not depend on list order.
fn mechanical_matching_owner_seed_frontier(
  lane: u32,
  published_total: u32
) -> MechanicalMatchingOwnerFrontierCounts {
  var result = MechanicalMatchingOwnerFrontierCounts(0u, 0u, 0u, 0u);
  if (lane == 0u) {
    atomicStore(&mechanical_matching_owner_active_count, 0u);
    atomicStore(&mechanical_matching_owner_contact_count, 0u);
    atomicStore(&mechanical_matching_owner_cursor_count, 0u);
    atomicStore(&mechanical_matching_owner_count_invalid, 0u);
    atomicStore(&mechanical_matching_owner_list_count, 0u);
  }
  workgroupBarrier();
  var local_active_count = 0u;
  var local_contact_count = 0u;
  var local_cursor_count = 0u;
  var local_invalid = 0u;
  if (
    arrayLength(&source_offsets) < mechanical_params.particle_count + 1u
    || published_total > arrayLength(&matching_constraints)
    || published_total > arrayLength(&csr_peers)
  ) {
    local_invalid = 1u;
  } else {
    for (
      var self_index = lane;
      self_index < mechanical_params.particle_count;
      self_index = self_index + 128u
    ) {
      let flags = atomicLoad(
        &matching_cleanup_dispatch[
          MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
        ]
      );
      let frontier_active =
        (flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) != 0u;
      let contact_active =
        (flags & MECHANICAL_MATCHING_OWNER_CONTACT_BIT) != 0u;
      if (
        (flags & ~(MECHANICAL_MATCHING_OWNER_FRONTIER_BIT
          | MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT
          | MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT
          | MECHANICAL_MATCHING_OWNER_CONTACT_BIT)) != 0u
        || (contact_active && !frontier_active)
      ) {
        local_invalid = 1u;
        continue;
      }
      if (frontier_active) {
        let begin = source_offsets[self_index];
        let end = source_offsets[self_index + 1u];
        if (begin > end || end > published_total) {
          local_invalid = 1u;
          continue;
        }
        let degree = end - begin;
        if (local_cursor_count > published_total - degree) {
          local_invalid = 1u;
          continue;
        }
        local_active_count = local_active_count + 1u;
        local_cursor_count = local_cursor_count + degree;
        let slot = atomicAdd(&mechanical_matching_owner_list_count, 1u);
        if (slot < ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u) {
          mechanical_matching_owner_list[slot] = self_index;
        }
      }
      if (contact_active) {
        local_contact_count = local_contact_count + 1u;
      }
    }
  }
  if (local_invalid != 0u) {
    atomicOr(&mechanical_matching_owner_count_invalid, 1u);
  } else {
    atomicAdd(
      &mechanical_matching_owner_active_count,
      local_active_count
    );
    atomicAdd(
      &mechanical_matching_owner_contact_count,
      local_contact_count
    );
    let prior_cursor_count = atomicAdd(
      &mechanical_matching_owner_cursor_count,
      local_cursor_count
    );
    if (prior_cursor_count > published_total - local_cursor_count) {
      atomicOr(&mechanical_matching_owner_count_invalid, 1u);
    }
  }
  workgroupBarrier();
  if (atomicLoad(&mechanical_matching_owner_count_invalid) != 0u) {
    return result;
  }
  result.active_count =
    atomicLoad(&mechanical_matching_owner_active_count);
  result.contact_count =
    atomicLoad(&mechanical_matching_owner_contact_count);
  result.active_cursor_count =
    atomicLoad(&mechanical_matching_owner_cursor_count);
  result.valid = 1u;
  return result;
}

// Uniform snapshot of the incrementally maintained owner counters. Equals a
// full recount of the flag words because every flag transition passes
// through mechanical_matching_owner_note_admission on the unique lane whose
// atomicOr flipped the bit.
fn mechanical_matching_owner_counter_snapshot(
  published_total: u32
) -> MechanicalMatchingOwnerFrontierCounts {
  var result = MechanicalMatchingOwnerFrontierCounts(0u, 0u, 0u, 0u);
  if (
    atomicLoad(&mechanical_matching_owner_count_invalid) != 0u
    || atomicLoad(&mechanical_matching_owner_cursor_count) > published_total
  ) {
    return result;
  }
  result.active_count =
    atomicLoad(&mechanical_matching_owner_active_count);
  result.contact_count =
    atomicLoad(&mechanical_matching_owner_contact_count);
  result.active_cursor_count =
    atomicLoad(&mechanical_matching_owner_cursor_count);
  result.valid = 1u;
  return result;
}

// Counter/list bookkeeping for one admission transition, called by the lane
// whose atomicOr observed the bit flip (uniqueness comes from the atomic).
fn mechanical_matching_owner_note_admission(
  admitted_index: u32,
  prior_flags: u32,
  published_total: u32
) {
  if ((prior_flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) == 0u) {
    let begin = source_offsets[admitted_index];
    let end = source_offsets[admitted_index + 1u];
    if (begin > end || end > published_total) {
      atomicOr(&mechanical_matching_owner_count_invalid, 1u);
    } else {
      atomicAdd(&mechanical_matching_owner_active_count, 1u);
      let degree = end - begin;
      let prior_cursor_count = atomicAdd(
        &mechanical_matching_owner_cursor_count,
        degree
      );
      if (prior_cursor_count > published_total - degree) {
        atomicOr(&mechanical_matching_owner_count_invalid, 1u);
      }
      let slot = atomicAdd(&mechanical_matching_owner_list_count, 1u);
      if (slot < ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u) {
        mechanical_matching_owner_list[slot] = admitted_index;
      }
    }
  }
  if ((prior_flags & MECHANICAL_MATCHING_OWNER_CONTACT_BIT) == 0u) {
    atomicAdd(&mechanical_matching_owner_contact_count, 1u);
  }
}


// One frontier member's dormant-discovery scan: evaluate every
// not-yet-ever-active cursor of the member's CSR row against live state and
// admit newly active unilateral pairs. Shared by the full-scan and moved-set
// expansion modes so both admit identically for a given evaluation set.
fn mechanical_matching_owner_expand_member(
  self_index: u32,
  published_total: u32
) {
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (
    begin > end
    || end > published_total
    || published_total > arrayLength(&matching_constraints)
    || published_total > arrayLength(&csr_peers)
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
        .CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let encoded_peer = csr_peers[cursor];
    let peer_index = mechanical_solver_peer_index(encoded_peer);
    if (peer_index >= mechanical_params.particle_count) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
    .CSR_BOUNDS_OR_RANK}u
      );
      continue;
    }
    // Known-active constraints are re-evaluated by deterministic row
    // selection below. Expansion owns only dormant discovery, so a
    // steady-state cursor executes the pair law in just one phase; its
    // first active transition is deliberately rechecked by selection.
    if (mechanical_matching_edge_ever_active(encoded_peer)) {
      continue;
    }
    let low_index = min(self_index, peer_index);
    let high_index = max(self_index, peer_index);
    let pair = mechanical_matching_constraint_pair(
      low_index,
      high_index,
      cursor
    );
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
    } else if (pair.active_pair != 0u && pair.unilateral != 0u) {
      csr_peers[cursor] =
        encoded_peer | MECHANICAL_MATCHING_EDGE_EVER_ACTIVE_BIT;
      let contact_flags = MECHANICAL_MATCHING_OWNER_FRONTIER_BIT
        | MECHANICAL_MATCHING_OWNER_CONTACT_BIT;
      let self_prior_flags = atomicOr(
        &matching_cleanup_dispatch[
    MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
        ],
        contact_flags
      );
      mechanical_matching_owner_note_admission(
        self_index,
        self_prior_flags,
        published_total
      );
      let peer_prior_flags = atomicOr(
        &matching_cleanup_dispatch[
    MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + peer_index
        ],
        contact_flags
      );
      mechanical_matching_owner_note_admission(
        peer_index,
        peer_prior_flags,
        published_total
      );
      // A just-admitted peer may already have passed expansion in this
      // workgroup. Give it one complete selection scan so its reverse
      // cursor is visible in this same logical pass; selection records
      // active cursors and clears this transient flag afterward.
      if (
        (peer_prior_flags & MECHANICAL_MATCHING_OWNER_CONTACT_BIT) == 0u
      ) {
        atomicOr(
    &matching_cleanup_dispatch[
      MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + peer_index
    ],
    MECHANICAL_MATCHING_OWNER_FULL_SELECTION_BIT
        );
      }
    }
  }
}

@compute @workgroup_size(128)
fn run_matching_cleanup_global_owner(
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let lane = local_id.x;
  let owner_word_count =
    MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE
      + mechanical_params.particle_count;
  if (lane == 0u) {
    mechanical_matching_persistent_pass =
      mechanical_matching_current_pass();
    mechanical_matching_persistent_active_count = 0u;
    mechanical_matching_persistent_contact_count = 0u;
    mechanical_matching_persistent_dispatch_active = 0u;
    if (
      mechanical_solver_full_path_enabled()
      && arrayLength(&matching_cleanup_dispatch) < owner_word_count
    ) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
      );
    } else if (
      mechanical_solver_full_path_enabled()
      && mechanical_matching_persistent_pass
        < ${solverBudget.cleanupPassBudget}u
      && atomicLoad(&graph_control[14u]) == 0u
    ) {
      mechanical_matching_persistent_dispatch_active = 1u;
    }
  }
  let dispatch_active = workgroupUniformLoad(
    &mechanical_matching_persistent_dispatch_active
  );
  // The host encodes ceil(cleanupPassBudget / ownerPassesPerDispatch)
  // chunked owner quanta for the full logical horizon. Once a prior quantum
  // has synthesized the terminal receipt tail (or failed closed), make every
  // remaining directly encoded quantum a uniform early return instead of
  // executing its otherwise-unavoidable barrier skeleton; the matching
  // in-loop latch below performs the same uniform exit between the logical
  // passes of one quantum. This is entirely GPU-resident and does not add an
  // indirect usage, host observation, or queue fence.
  if (dispatch_active == 0u) {
    if (lane == 0u && arrayLength(&matching_cleanup_dispatch) >= 3u) {
      atomicStore(&matching_cleanup_dispatch[0u], 0u);
      atomicStore(&matching_cleanup_dispatch[1u], 1u);
      atomicStore(&matching_cleanup_dispatch[2u], 1u);
    }
    return;
  }
  storageBarrier();
  // One validated full-particle frontier scan + list build per dispatch;
  // every later pass reads the incrementally maintained counters and
  // iterates the compacted list in its order-free phases.
  let owner_seed_counts = mechanical_matching_owner_seed_frontier(
    lane,
    atomicLoad(&graph_control[12u])
  );
  if (lane == 0u && owner_seed_counts.valid == 0u) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
  }
  workgroupBarrier();
  storageBarrier();

  for (
    var owner_pass = 0u;
    owner_pass
      < ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH}u;
    owner_pass = owner_pass + 1u
  ) {
    if (lane == 0u) {
      mechanical_matching_persistent_pass =
        mechanical_matching_current_pass();
      mechanical_matching_persistent_active_count = 0u;
      mechanical_matching_persistent_contact_count = 0u;
      mechanical_matching_persistent_dispatch_active = 0u;
      if (
        mechanical_solver_full_path_enabled()
        && mechanical_matching_persistent_pass
          < ${solverBudget.cleanupPassBudget}u
        && atomicLoad(&graph_control[14u]) == 0u
      ) {
        mechanical_matching_persistent_dispatch_active = 1u;
      }
    }
    // Chunked-pass latch: finalize_matching_cleanup_pass_body advanced the
    // logical pass clock (or synthesized the converged terminal tail, or a
    // stage failed closed) at the end of the previous loop iteration, and
    // this re-check observes it before committing to another logical pass.
    // workgroupUniformLoad both publishes lane 0's writes (it is a control
    // barrier) and returns a workgroup-uniform value, so the break below is
    // uniform across the workgroup and the unconditional barriers of later
    // iterations stay in uniform control flow -- the same pattern as the
    // fresh-dispatch early return above, applied inside the loop.
    let pass_latch_active = workgroupUniformLoad(
      &mechanical_matching_persistent_dispatch_active
    );
    if (pass_latch_active == 0u) {
      break;
    }
    let published_total_before_expansion = atomicLoad(&graph_control[12u]);
    let frontier_counts_before_expansion =
      mechanical_matching_owner_counter_snapshot(
        published_total_before_expansion
      );
    if (lane == 0u) {
      if (frontier_counts_before_expansion.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
            .CSR_BOUNDS_OR_RANK}u
        );
      } else {
        mechanical_matching_persistent_active_count =
          frontier_counts_before_expansion.active_count;
        mechanical_matching_persistent_contact_count =
          frontier_counts_before_expansion.contact_count;
        atomicStore(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_COUNT_WORD
          ],
          frontier_counts_before_expansion.active_count
        );
        atomicStore(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_CURSOR_COUNT_WORD
          ],
          frontier_counts_before_expansion.active_cursor_count
        );
        if (
          frontier_counts_before_expansion.active_count
            > ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
          || frontier_counts_before_expansion.active_cursor_count
            > ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS}u
        ) {
          atomicOr(
            &graph_control[14u],
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
              .ITERATION_INCOMPLETE}u
          );
        }
      }
    }
    workgroupBarrier();
    storageBarrier();
    let expand_frontier = mechanical_solver_full_path_enabled()
      && mechanical_matching_persistent_pass
        < ${solverBudget.cleanupPassBudget}u
      && arrayLength(&matching_cleanup_dispatch) >= owner_word_count
      && atomicLoad(&graph_control[14u]) == 0u;

    // The frontier is monotone for the complete cleanup. Only a particle that
    // already moved through contact or wall projection can wake a frozen
    // dormant face. Scan those rows before selection and admit both endpoints
    // in the same logical pass. Two unflagged endpoints never move, so their
    // dormant constraint cannot become active behind this frontier.
    // Full-sweep vs incremental pass selection, shared by the expansion and
    // wall phases. Plain reads: these words are written only by lane 0
    // between the pass barriers, so their values are workgroup-uniform here
    // without a control barrier (which would be illegal in conditional
    // flow).
    var owner_moved_prev_count = 0u;
    if (mechanical_matching_owner_moved_phase == 0u) {
      owner_moved_prev_count =
        atomicLoad(&mechanical_matching_owner_moved_count_b);
    } else {
      owner_moved_prev_count =
        atomicLoad(&mechanical_matching_owner_moved_count_a);
    }
    let owner_full_sweep_pass =
      mechanical_matching_owner_moved_prev_valid == 0u
      || owner_moved_prev_count > ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u;

    if (expand_frontier) {
      let published_total = atomicLoad(&graph_control[12u]);
      // Moved-set incremental expansion: a dormant pair's activity decision
      // reads only the frozen constraint row and the two endpoints' live
      // input_state, so its outcome is bit-identical until an endpoint's
      // state changes. After the first pass of a chunked dispatch, only the
      // rows of particles recorded as movers by the previous pass's apply
      // and wall phases need re-evaluation; recorder overflow or a fresh
      // dispatch falls back to the complete frontier scan. Same-pass cascade
      // admissions still occur through the mover set exactly when the
      // enabling movement happened, which is the same pass the full scan
      // first evaluates them with changed inputs.
      let moved_prev_count = owner_moved_prev_count;
      if (owner_full_sweep_pass) {
        for (
          var self_index = lane;
          self_index < mechanical_params.particle_count;
          self_index = self_index + 128u
        ) {
          let flags = atomicLoad(
            &matching_cleanup_dispatch[
              MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
            ]
          );
          if ((flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) == 0u) {
            continue;
          }
          mechanical_matching_owner_expand_member(
            self_index,
            published_total
          );
        }
      } else {
        for (
          var moved_slot = lane;
          moved_slot < moved_prev_count;
          moved_slot = moved_slot + 128u
        ) {
          var moved_index = 0u;
          if (mechanical_matching_owner_moved_phase == 0u) {
            moved_index = mechanical_matching_owner_moved_b[moved_slot];
          } else {
            moved_index = mechanical_matching_owner_moved_a[moved_slot];
          }
          if (moved_index >= mechanical_params.particle_count) {
            continue;
          }
          let flags = atomicLoad(
            &matching_cleanup_dispatch[
              MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + moved_index
            ]
          );
          if ((flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) == 0u) {
            continue;
          }
          mechanical_matching_owner_expand_member(
            moved_index,
            published_total
          );
        }
      }
    }
    workgroupBarrier();
    storageBarrier();

    let published_total_after_expansion = atomicLoad(&graph_control[12u]);
    let frontier_counts_after_expansion =
      mechanical_matching_owner_counter_snapshot(
        published_total_after_expansion
      );
    if (lane == 0u && expand_frontier) {
      if (frontier_counts_after_expansion.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
            .CSR_BOUNDS_OR_RANK}u
        );
      } else if (atomicLoad(&graph_control[14u]) == 0u) {
        mechanical_matching_persistent_active_count =
          frontier_counts_after_expansion.active_count;
        mechanical_matching_persistent_contact_count =
          frontier_counts_after_expansion.contact_count;
        atomicStore(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_COUNT_WORD
          ],
          frontier_counts_after_expansion.active_count
        );
        atomicStore(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_CURSOR_COUNT_WORD
          ],
          frontier_counts_after_expansion.active_cursor_count
        );
        if (
          frontier_counts_after_expansion.active_count
            > ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
          || frontier_counts_after_expansion.active_cursor_count
            > ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS}u
          || (
            mechanical_matching_persistent_pass + 16u
              >= ${solverBudget.cleanupPassBudget}u
            && frontier_counts_after_expansion.active_cursor_count
              > ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS}u
          )
        ) {
          atomicOr(
            &graph_control[14u],
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
              .ITERATION_INCOMPLETE}u
          );
        }
      }
    }
    workgroupBarrier();
    storageBarrier();
    let execute_pass = mechanical_solver_full_path_enabled()
      && mechanical_matching_persistent_pass
        < ${solverBudget.cleanupPassBudget}u
      && atomicLoad(&graph_control[14u]) == 0u;

    if (lane == 0u && execute_pass) {
      atomicStore(
        &traversal_evidence[
          mechanical_matching_selection_count_word(
            mechanical_matching_persistent_pass
          )
        ],
        mechanical_params.particle_count
          - mechanical_matching_persistent_contact_count
      );
      atomicStore(
        &traversal_evidence[
          mechanical_matching_contact_count_word(
            mechanical_matching_persistent_pass
          )
        ],
        mechanical_matching_persistent_contact_count
      );
      if (
        mechanical_matching_persistent_pass == 0u
        && mechanical_matching_jacobi_residual_converged()
      ) {
        let final_iteration = mechanical_params.solver_iteration_count - 1u;
        atomicStore(
          &traversal_evidence[
            mechanical_matching_max_position_ratio_word(0u)
          ],
          atomicLoad(
            &graph_control[
              mechanical_pre_solve_position_violation_ratio_word(
                final_iteration
              )
            ]
          )
        );
        atomicStore(
          &traversal_evidence[
            mechanical_matching_max_velocity_residual_word(0u)
          ],
          atomicLoad(
            &graph_control[
              mechanical_pre_solve_velocity_residual_word(final_iteration)
            ]
          )
        );
      }
    }
    storageBarrier();

    if (execute_pass) {
      let owner_list_total = min(
        atomicLoad(&mechanical_matching_owner_list_count),
        ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
      );
      for (
        var list_slot = lane;
        list_slot < owner_list_total;
        list_slot = list_slot + 128u
      ) {
        let self_index = mechanical_matching_owner_list[list_slot];
        let flags = atomicLoad(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
          ]
        );
        if ((flags & MECHANICAL_MATCHING_OWNER_CONTACT_BIT) != 0u) {
          select_matching_cleanup_edge_for_index(self_index, false);
        }
      }
    }
    storageBarrier();

    if (lane == 0u && execute_pass) {
      // Pass 0 must re-baseline output from the Jacobi-final input (the
      // solver iterations ping-pong the buffers before cleanup). From pass 1
      // on, the propagate phase leaves input_state == output_state for every
      // frontier member at each pass end, so the re-baseline is a
      // value-identical no-op: store the completeness proof directly and
      // skip the traversal. The standalone per-pass pipeline path keeps the
      // explicit copy dispatch on every pass.
      var copy_workset_count = 0u;
      if (mechanical_matching_persistent_pass == 0u) {
        copy_workset_count = mechanical_matching_persistent_active_count;
      }
      atomicStore(
        &traversal_evidence[
          mechanical_matching_copy_count_word(
            mechanical_matching_persistent_pass
          )
        ],
        mechanical_params.particle_count - copy_workset_count
      );
    }
    storageBarrier();

    if (execute_pass && mechanical_matching_persistent_pass == 0u) {
      let owner_list_total = min(
        atomicLoad(&mechanical_matching_owner_list_count),
        ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
      );
      for (
        var list_slot = lane;
        list_slot < owner_list_total;
        list_slot = list_slot + 128u
      ) {
        let self_index = mechanical_matching_owner_list[list_slot];
        let flags = atomicLoad(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
          ]
        );
        if ((flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) != 0u) {
          copy_matching_cleanup_state_for_index(self_index);
        }
      }
    }
    storageBarrier();

    storageBarrier();

    if (lane == 0u && execute_pass) {
      atomicStore(
        &traversal_evidence[
          mechanical_matching_apply_count_word(
            mechanical_matching_persistent_pass
          )
        ],
        mechanical_params.particle_count
          - mechanical_matching_persistent_contact_count
      );
    }
    storageBarrier();

    if (execute_pass) {
      let owner_list_total = min(
        atomicLoad(&mechanical_matching_owner_list_count),
        ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
      );
      for (
        var list_slot = lane;
        list_slot < owner_list_total;
        list_slot = list_slot + 128u
      ) {
        let self_index = mechanical_matching_owner_list[list_slot];
        let flags = atomicLoad(
          &matching_cleanup_dispatch[
            MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
          ]
        );
        if ((flags & MECHANICAL_MATCHING_OWNER_CONTACT_BIT) != 0u) {
          apply_matching_cleanup_edge_for_index(self_index);
        }
      }
    }
    storageBarrier();

    // Snapshot for the full-sweep pending-counter rebase below. The
    // workgroup counter zero-initializes each chunked dispatch while
    // WALL_PENDING bits persist in storage, so a full sweep claims bits
    // this dispatch never counted; per-claim decrements would wrap the
    // counter below zero. Instead the sweep leaves the counter alone and
    // lane 0 subtracts this pre-sweep snapshot afterwards: a fixed-amount
    // subtract commutes with the sweep's own concurrent record_mover
    // increments, leaving exactly the freshly recorded pending count.
    var owner_wall_pending_rebase = 0u;
    if (lane == 0u && execute_pass) {
      // Full-sweep passes wall-project every frontier member (completeness
      // complement = N - frontier). Incremental passes project exactly the
      // wall-pending claims (complement = N - pending): a member's wall
      // outcome is a pure function of its own output state, so a member
      // whose state did not change since its last projection re-derives
      // bit-identical writes and is exactly skippable.
      var wall_workset_count = mechanical_matching_persistent_active_count;
      if (!owner_full_sweep_pass) {
        wall_workset_count =
          atomicLoad(&mechanical_matching_owner_wall_pending_count);
      } else {
        owner_wall_pending_rebase =
          atomicLoad(&mechanical_matching_owner_wall_pending_count);
      }
      atomicStore(
        &traversal_evidence[
          mechanical_matching_wall_count_word(
            mechanical_matching_persistent_pass
          )
        ],
        mechanical_params.particle_count - wall_workset_count
      );
    }
    storageBarrier();

    if (execute_pass) {
      if (owner_full_sweep_pass) {
        let owner_list_total = min(
          atomicLoad(&mechanical_matching_owner_list_count),
          ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
        );
        for (
          var list_slot = lane;
          list_slot < owner_list_total;
          list_slot = list_slot + 128u
        ) {
          let self_index = mechanical_matching_owner_list[list_slot];
          // Claim (clear) the pending bit but do NOT decrement the counter
          // per claim: bits set by the previous dispatch were never counted
          // by this dispatch's zero-initialized workgroup counter, and a
          // per-claim decrement wraps it. Lane 0 rebases the counter by the
          // pre-sweep snapshot after this loop instead.
          let prior_flags = atomicAnd(
            &matching_cleanup_dispatch[
              MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + self_index
            ],
            ~MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT
          );
          if ((prior_flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) != 0u) {
            project_matching_cleanup_walls_for_index(self_index);
          }
        }
      } else {
        // Incremental wall: exactly the pending claims. Every pending member
        // is present in the previous or current mover list (record_mover
        // appends where it sets the bit; a fresh dispatch full-sweeps), and
        // the atomicAnd claim admits each member once even when it appears
        // in both lists.
        var wall_prev_total = 0u;
        if (mechanical_matching_owner_moved_phase == 0u) {
          wall_prev_total =
            atomicLoad(&mechanical_matching_owner_moved_count_b);
        } else {
          wall_prev_total =
            atomicLoad(&mechanical_matching_owner_moved_count_a);
        }
        wall_prev_total = min(wall_prev_total, ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u);
        var wall_cur_total = 0u;
        if (mechanical_matching_owner_moved_phase == 0u) {
          wall_cur_total =
            atomicLoad(&mechanical_matching_owner_moved_count_a);
        } else {
          wall_cur_total =
            atomicLoad(&mechanical_matching_owner_moved_count_b);
        }
        wall_cur_total = min(wall_cur_total, ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u);
        for (
          var wall_slot = lane;
          wall_slot < wall_prev_total + wall_cur_total;
          wall_slot = wall_slot + 128u
        ) {
          var wall_index = 0u;
          if (wall_slot < wall_prev_total) {
            if (mechanical_matching_owner_moved_phase == 0u) {
              wall_index = mechanical_matching_owner_moved_b[wall_slot];
            } else {
              wall_index = mechanical_matching_owner_moved_a[wall_slot];
            }
          } else {
            let cur_slot = wall_slot - wall_prev_total;
            if (mechanical_matching_owner_moved_phase == 0u) {
              wall_index = mechanical_matching_owner_moved_a[cur_slot];
            } else {
              wall_index = mechanical_matching_owner_moved_b[cur_slot];
            }
          }
          if (wall_index >= mechanical_params.particle_count) {
            continue;
          }
          let prior_flags = atomicAnd(
            &matching_cleanup_dispatch[
              MECHANICAL_MATCHING_OWNER_ACTIVE_FLAG_BASE + wall_index
            ],
            ~MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT
          );
          if (
            (prior_flags & MECHANICAL_MATCHING_OWNER_WALL_PENDING_BIT) == 0u
          ) {
            continue;
          }
          atomicSub(&mechanical_matching_owner_wall_pending_count, 1u);
          if ((prior_flags & MECHANICAL_MATCHING_OWNER_FRONTIER_BIT) != 0u) {
            project_matching_cleanup_walls_for_index(wall_index);
          }
        }
      }
    }
    storageBarrier();

    if (execute_pass) {
      if (owner_full_sweep_pass) {
        let owner_list_total = min(
          atomicLoad(&mechanical_matching_owner_list_count),
          ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u
        );
        for (
          var list_slot = lane;
          list_slot < owner_list_total;
          list_slot = list_slot + 128u
        ) {
          let self_index = mechanical_matching_owner_list[list_slot];
          input_state[self_index * 2u] = output_state[self_index * 2u];
          input_state[self_index * 2u + 1u] =
            output_state[self_index * 2u + 1u];
        }
      } else {
        // Only members whose output changed this pass (apply members plus
        // wall changes, i.e. exactly the current mover list) need the
        // output -> input propagate; everyone else is already equal.
        // Duplicate entries are harmless value-identical copies.
        var propagate_total = 0u;
        if (mechanical_matching_owner_moved_phase == 0u) {
          propagate_total =
            atomicLoad(&mechanical_matching_owner_moved_count_a);
        } else {
          propagate_total =
            atomicLoad(&mechanical_matching_owner_moved_count_b);
        }
        propagate_total = min(propagate_total, ${SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES}u);
        for (
          var propagate_slot = lane;
          propagate_slot < propagate_total;
          propagate_slot = propagate_slot + 128u
        ) {
          var propagate_index = 0u;
          if (mechanical_matching_owner_moved_phase == 0u) {
            propagate_index =
              mechanical_matching_owner_moved_a[propagate_slot];
          } else {
            propagate_index =
              mechanical_matching_owner_moved_b[propagate_slot];
          }
          if (propagate_index >= mechanical_params.particle_count) {
            continue;
          }
          input_state[propagate_index * 2u] =
            output_state[propagate_index * 2u];
          input_state[propagate_index * 2u + 1u] =
            output_state[propagate_index * 2u + 1u];
        }
      }
    }
    storageBarrier();

    if (lane == 0u && execute_pass) {
      finalize_matching_cleanup_pass_body();
    }
    storageBarrier();
    // Rotate the mover buffers: this pass's recorded movers become the next
    // pass's expansion set, and the buffer that will collect next pass is
    // cleared. Zero-initialized workgroup state makes the first pass of a
    // fresh dispatch fall back to the complete frontier scan.
    if (lane == 0u && execute_pass) {
      if (owner_full_sweep_pass) {
        // Rebase the pending counter: the full sweep claimed every set
        // WALL_PENDING bit without touching the counter, so subtracting
        // the pre-sweep snapshot leaves exactly the count of bits the
        // sweep's own wall projections freshly recorded. The fixed-amount
        // subtract commutes with those concurrent increments.
        atomicSub(
          &mechanical_matching_owner_wall_pending_count,
          owner_wall_pending_rebase
        );
      }
      mechanical_matching_owner_moved_prev_valid = 1u;
      if (mechanical_matching_owner_moved_phase == 0u) {
        mechanical_matching_owner_moved_phase = 1u;
        atomicStore(&mechanical_matching_owner_moved_count_b, 0u);
      } else {
        mechanical_matching_owner_moved_phase = 0u;
        atomicStore(&mechanical_matching_owner_moved_count_a, 0u);
      }
    }
    workgroupBarrier();
  }
  if (lane == 0u && arrayLength(&matching_cleanup_dispatch) >= 3u) {
    atomicStore(
      &matching_cleanup_dispatch[0u],
      select(
        0u,
        1u,
        mechanical_solver_full_path_enabled()
          && mechanical_matching_current_pass()
            < ${solverBudget.cleanupPassBudget}u
          && atomicLoad(&graph_control[14u]) == 0u
      )
    );
  }
}
`;
}

function createSchroederSpatialMechanicalInterfaceReceiptWgslForBudget(
  solverBudget
) {
  return /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

@group(0) @binding(0) var<storage, read> final_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> source_identity: array<u32>;
@group(0) @binding(4) var<storage, read> csr_peers: array<u32>;
@group(0) @binding(5) var<storage, read> source_offsets: array<u32>;
@group(0) @binding(6) var<storage, read_write> graph_control:
  array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> interface_receipt:
  array<atomic<u32>>;
@group(0) @binding(8) var<uniform> mechanical_params:
  MechanicalProposalParams;
@group(0) @binding(9) var<storage, read> spatial_source_rows:
  array<f32>;

const INTERFACE_RECEIPT_HEADER_WORDS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS}u;
const INTERFACE_RECEIPT_ROW_WORDS: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS}u;
const INTERFACE_RECEIPT_STATUS_BUILDING: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_BUILDING}u;
const INTERFACE_RECEIPT_STATUS_READY: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_READY}u;
const INTERFACE_RECEIPT_STATUS_ADMITTED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_ADMITTED}u;
const INTERFACE_RECEIPT_STATUS_FAIL_CLOSED: u32 =
  ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_FAIL_CLOSED}u;

fn interface_receipt_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn interface_receipt_invalid_value() -> f32 {
  // Keep the payload runtime-derived so WGSL implementations do not reject a
  // constant NaN during shader validation. Either infinity (zero payload) or
  // NaN (nonzero payload) is rejected by interface_receipt_finite.
  return bitcast<f32>(mechanical_params.generation_id | 0x7f800000u);
}

fn interface_receipt_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

struct InterfaceReceiptFace {
  area_m2: f32,
  normal_axis: u32,
  admitted: u32,
};

fn interface_receipt_interval_overlap_m(
  delta_m: f32,
  self_edge_m: f32,
  other_edge_m: f32
) -> f32 {
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  return max(
    0.0,
    min(
      min(self_edge_m, other_edge_m),
      half_sum_m - abs(delta_m)
    )
  );
}

fn interface_receipt_tangent_zero_tolerance_m(
  delta_m: vec3<f32>,
  self_edge_m: f32,
  other_edge_m: f32
) -> f32 {
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let geometric_scale_m = max(
    max(
      max(abs(delta_m.x), max(abs(delta_m.y), abs(delta_m.z))),
      max(self_edge_m, other_edge_m)
    ),
    max(half_sum_m, 1.0e-12)
  );
  return 16.0 * 1.1920929e-7 * geometric_scale_m;
}

fn interface_receipt_face_at_delta(
  delta_m: vec3<f32>,
  self_edge_m: f32,
  other_edge_m: f32,
  normal_tolerance_m: f32
) -> InterfaceReceiptFace {
  let rejected = InterfaceReceiptFace(0.0, 0u, 0u);
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let separation_m = abs(delta_m) - vec3<f32>(half_sum_m);
  var normal_axis = 0u;
  var normal_separation_m = separation_m.x;
  if (separation_m.y > normal_separation_m) {
    normal_axis = 1u;
    normal_separation_m = separation_m.y;
  }
  if (separation_m.z > normal_separation_m) {
    normal_axis = 2u;
    normal_separation_m = separation_m.z;
  }
  if (normal_separation_m > normal_tolerance_m) { return rejected; }
  var overlap_a_m = 0.0;
  var overlap_b_m = 0.0;
  if (normal_axis == 0u) {
    overlap_a_m = interface_receipt_interval_overlap_m(
      delta_m.y,
      self_edge_m,
      other_edge_m
    );
    overlap_b_m = interface_receipt_interval_overlap_m(
      delta_m.z,
      self_edge_m,
      other_edge_m
    );
  } else if (normal_axis == 1u) {
    overlap_a_m = interface_receipt_interval_overlap_m(
      delta_m.x,
      self_edge_m,
      other_edge_m
    );
    overlap_b_m = interface_receipt_interval_overlap_m(
      delta_m.z,
      self_edge_m,
      other_edge_m
    );
  } else {
    overlap_a_m = interface_receipt_interval_overlap_m(
      delta_m.x,
      self_edge_m,
      other_edge_m
    );
    overlap_b_m = interface_receipt_interval_overlap_m(
      delta_m.y,
      self_edge_m,
      other_edge_m
    );
  }
  let tangent_zero_tolerance_m =
    interface_receipt_tangent_zero_tolerance_m(
      delta_m,
      self_edge_m,
      other_edge_m
    );
  if (
    overlap_a_m <= tangent_zero_tolerance_m
    || overlap_b_m <= tangent_zero_tolerance_m
  ) { return rejected; }
  let area_m2 = overlap_a_m * overlap_b_m;
  if (!interface_receipt_finite(area_m2) || area_m2 <= 0.0) {
    return rejected;
  }
  return InterfaceReceiptFace(area_m2, normal_axis, 1u);
}

fn interface_receipt_swept_axis_interval(
  start_m: f32,
  sweep_m: f32,
  half_sum_m: f32
) -> vec3<f32> {
  if (abs(sweep_m) <= 1.0e-12) {
    if (abs(start_m) > half_sum_m) { return vec3<f32>(0.0); }
    return vec3<f32>(-3.402823e+38, 3.402823e+38, 1.0);
  }
  let first_t = (-half_sum_m - start_m) / sweep_m;
  let second_t = (half_sum_m - start_m) / sweep_m;
  return vec3<f32>(
    min(first_t, second_t),
    max(first_t, second_t),
    1.0
  );
}

fn interface_receipt_epoch_position(index: u32) -> vec3<f32> {
  let base = index * 16u;
  return vec3<f32>(
    spatial_source_rows[base + 12u],
    spatial_source_rows[base + 13u],
    spatial_source_rows[base + 14u]
  );
}

fn interface_receipt_phase_class(index: u32) -> u32 {
  let row5 = source_mechanics[index * 8u + 5u];
  let row6 = source_mechanics[index * 8u + 6u];
  if (row5.x > 0.5) { return 2u; }
  if (row6.z > 0.5 && row6.z < 1.5) { return 1u; }
  return 0u;
}

fn interface_receipt_same_phase_lineage(
  self_index: u32,
  other_index: u32
) -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  return capacity > 0u
    && mechanical_params.phase_lane_count > 1u
    && self_index < capacity * mechanical_params.phase_lane_count
    && other_index < capacity * mechanical_params.phase_lane_count
    && self_index % capacity == other_index % capacity;
}

fn interface_receipt_same_body_solid(
  self_index: u32,
  other_index: u32
) -> bool {
  if (
    interface_receipt_phase_class(self_index) != 2u
    || interface_receipt_phase_class(other_index) != 2u
  ) { return false; }
  let self_material = source_thermo[self_index * 3u].x;
  let other_material = source_thermo[other_index * 3u].x;
  if (abs(self_material - other_material) >= 0.5) { return false; }
  if (mechanical_params.identity_enabled == 0u) { return true; }
  let self_domain = source_identity[self_index];
  let other_domain = source_identity[other_index];
  return self_domain == 0u
    || other_domain == 0u
    || self_domain == other_domain;
}

fn interface_receipt_unilateral_pair(
  self_index: u32,
  other_index: u32
) -> bool {
  let self_class = interface_receipt_phase_class(self_index);
  let other_class = interface_receipt_phase_class(other_index);
  if (self_class == 0u || other_class == 0u) { return false; }
  let self_material = source_thermo[self_index * 3u].x;
  let other_material = source_thermo[other_index * 3u].x;
  if (abs(self_material - other_material) >= 0.5) { return true; }
  if (
    (self_class == 2u && other_class == 1u)
    || (self_class == 1u && other_class == 2u)
  ) { return true; }
  if (
    self_class != 2u
    || other_class != 2u
    || mechanical_params.identity_enabled == 0u
  ) { return false; }
  let self_domain = source_identity[self_index];
  let other_domain = source_identity[other_index];
  return self_domain != 0u
    && other_domain != 0u
    && self_domain != other_domain;
}

fn interface_receipt_pair_value(
  self_index: u32,
  other_index: u32
) -> f32 {
  // Receipt v2 refines the already-authenticated mechanical CSR; it does not
  // claim a second, complete AABB neighbor traversal. The broad mixed-law
  // envelope contains the campaign's staggered face candidates while keeping
  // receipt materialization O(E) in the retained directed graph.
  if (
    self_index >= mechanical_params.particle_count
    || other_index >= mechanical_params.particle_count
    || self_index == other_index
    || interface_receipt_same_phase_lineage(self_index, other_index)
    || interface_receipt_same_body_solid(self_index, other_index)
    || !interface_receipt_unilateral_pair(self_index, other_index)
  ) { return 0.0; }
  let self_pos_mass = final_state[self_index * 2u];
  let other_pos_mass = final_state[other_index * 2u];
  let self_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  let other_volume = max(
    source_mechanics[other_index * 8u + 4u].w,
    0.0
  );
  if (
    self_pos_mass.w <= 0.0
    || other_pos_mass.w <= 0.0
    || self_volume <= 0.0
    || other_volume <= 0.0
  ) { return -1.0; }
  let self_edge_m = interface_receipt_cbrt(self_volume);
  let other_edge_m = interface_receipt_cbrt(other_volume);
  let half_sum_m = 0.5 * (self_edge_m + other_edge_m);
  let tolerance_m = max(
    1.0e-5,
    ${SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION}
      * half_sum_m
  );
  let final_delta = self_pos_mass.xyz - other_pos_mass.xyz;
  if (
    !interface_receipt_finite(self_edge_m)
    || !interface_receipt_finite(other_edge_m)
    || !interface_receipt_finite(half_sum_m)
    || !interface_receipt_finite(tolerance_m)
    || !interface_receipt_finite(final_delta.x)
    || !interface_receipt_finite(final_delta.y)
    || !interface_receipt_finite(final_delta.z)
  ) {
    return interface_receipt_invalid_value();
  }
  let final_face = interface_receipt_face_at_delta(
    final_delta,
    self_edge_m,
    other_edge_m,
    tolerance_m
  );
  if (final_face.admitted != 0u) { return final_face.area_m2; }
  // The unilateral solver owns swept-impact semantics. Preserve the exact
  // finite-volume face at first AABB impact even when later constraint cleanup
  // leaves the endpoints separated.
  let epoch_delta = interface_receipt_epoch_position(self_index)
    - interface_receipt_epoch_position(other_index);
  let sweep_delta = final_delta - epoch_delta;
  if (
    !interface_receipt_finite(epoch_delta.x)
    || !interface_receipt_finite(epoch_delta.y)
    || !interface_receipt_finite(epoch_delta.z)
    || !interface_receipt_finite(sweep_delta.x)
    || !interface_receipt_finite(sweep_delta.y)
    || !interface_receipt_finite(sweep_delta.z)
  ) {
    return interface_receipt_invalid_value();
  }
  let interval_x = interface_receipt_swept_axis_interval(
    epoch_delta.x,
    sweep_delta.x,
    half_sum_m
  );
  let interval_y = interface_receipt_swept_axis_interval(
    epoch_delta.y,
    sweep_delta.y,
    half_sum_m
  );
  let interval_z = interface_receipt_swept_axis_interval(
    epoch_delta.z,
    sweep_delta.z,
    half_sum_m
  );
  if (
    interval_x.z == 0.0
    || interval_y.z == 0.0
    || interval_z.z == 0.0
  ) { return -1.0; }
  if (
    !interface_receipt_finite(interval_x.x)
    || !interface_receipt_finite(interval_x.y)
    || !interface_receipt_finite(interval_y.x)
    || !interface_receipt_finite(interval_y.y)
    || !interface_receipt_finite(interval_z.x)
    || !interface_receipt_finite(interval_z.y)
  ) { return interface_receipt_invalid_value(); }
  let entry_t = max(interval_x.x, max(interval_y.x, interval_z.x));
  let exit_t = min(interval_x.y, min(interval_y.y, interval_z.y));
  if (entry_t > exit_t || exit_t < 0.0 || entry_t > 1.0) { return -1.0; }
  let impact_t = clamp(entry_t, 0.0, 1.0);
  let impact_face = interface_receipt_face_at_delta(
    epoch_delta + impact_t * sweep_delta,
    self_edge_m,
    other_edge_m,
    0.0
  );
  if (impact_face.admitted == 0u) { return -1.0; }
  return impact_face.area_m2;
}

fn interface_receipt_static_header_valid() -> bool {
  return arrayLength(&interface_receipt)
      >= INTERFACE_RECEIPT_HEADER_WORDS
    && atomicLoad(&interface_receipt[0u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_MAGIC >>> 0}u
    && atomicLoad(&interface_receipt[1u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_VERSION}u
    && atomicLoad(&interface_receipt[2u])
      == mechanical_params.generation_id
    && atomicLoad(&interface_receipt[3u])
      == mechanical_params.storage_generation
    && atomicLoad(&interface_receipt[4u])
      == mechanical_params.physics_tick
    && atomicLoad(&interface_receipt[5u])
      == mechanical_params.physics_substep
    && atomicLoad(&interface_receipt[6u])
      == mechanical_params.position_epoch
    && atomicLoad(&interface_receipt[7u])
      == mechanical_params.topology_epoch
    && atomicLoad(&interface_receipt[8u])
      == mechanical_params.support_epoch
    && atomicLoad(&interface_receipt[9u])
      == bitcast<u32>(mechanical_params.apply_selected_level)
    && atomicLoad(&interface_receipt[10u])
      == mechanical_params.particle_count
    && atomicLoad(&interface_receipt[11u])
      == mechanical_params.directed_pair_capacity
    && atomicLoad(&interface_receipt[12u])
      == mechanical_params.particle_count + 1u
    && atomicLoad(&interface_receipt[13u])
      == atomicLoad(&graph_control[12u]);
}

@compute @workgroup_size(1)
fn initialize_contact_interface_receipt(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u) { return; }
  let total = atomicLoad(&graph_control[12u]);
  let offset_words = mechanical_params.particle_count + 1u;
  let available_words = arrayLength(&interface_receipt);
  let prefix_words = INTERFACE_RECEIPT_HEADER_WORDS + offset_words;
  let layout_valid = total <= mechanical_params.directed_pair_capacity
    && prefix_words <= available_words
    && total <= (available_words - prefix_words) / INTERFACE_RECEIPT_ROW_WORDS;
  atomicStore(
    &interface_receipt[0u],
    ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_MAGIC >>> 0}u
  );
  atomicStore(
    &interface_receipt[1u],
    ${SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_VERSION}u
  );
  atomicStore(&interface_receipt[2u], mechanical_params.generation_id);
  atomicStore(&interface_receipt[3u], mechanical_params.storage_generation);
  atomicStore(&interface_receipt[4u], mechanical_params.physics_tick);
  atomicStore(&interface_receipt[5u], mechanical_params.physics_substep);
  atomicStore(&interface_receipt[6u], mechanical_params.position_epoch);
  atomicStore(&interface_receipt[7u], mechanical_params.topology_epoch);
  atomicStore(&interface_receipt[8u], mechanical_params.support_epoch);
  atomicStore(
    &interface_receipt[9u],
    bitcast<u32>(mechanical_params.apply_selected_level)
  );
  atomicStore(&interface_receipt[10u], mechanical_params.particle_count);
  atomicStore(
    &interface_receipt[11u],
    mechanical_params.directed_pair_capacity
  );
  atomicStore(&interface_receipt[12u], offset_words);
  atomicStore(&interface_receipt[13u], total);
  atomicStore(&interface_receipt[14u], 0u);
  atomicStore(
    &interface_receipt[15u],
    select(
      INTERFACE_RECEIPT_STATUS_READY
        | INTERFACE_RECEIPT_STATUS_FAIL_CLOSED,
      INTERFACE_RECEIPT_STATUS_BUILDING,
      layout_valid
    )
  );
}

@compute @workgroup_size(64)
fn materialize_contact_interface_receipt(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (
    !interface_receipt_static_header_valid()
    || atomicLoad(&interface_receipt[15u])
      != INTERFACE_RECEIPT_STATUS_BUILDING
    || atomicLoad(&graph_control[14u]) != 0u
    || atomicLoad(&graph_control[17u]) != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    ) == 0u
  ) {
    atomicOr(
      &interface_receipt[15u],
      INTERFACE_RECEIPT_STATUS_FAIL_CLOSED
    );
    return;
  }
  let total = atomicLoad(&interface_receipt[13u]);
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (begin > end || end > total) {
    atomicOr(
      &interface_receipt[15u],
      INTERFACE_RECEIPT_STATUS_FAIL_CLOSED
    );
    return;
  }
  let offset_base = INTERFACE_RECEIPT_HEADER_WORDS;
  atomicStore(&interface_receipt[offset_base + self_index], begin);
  if (self_index + 1u == mechanical_params.particle_count) {
    atomicStore(
      &interface_receipt[offset_base + mechanical_params.particle_count],
      end
    );
  }
  let row_base = offset_base + mechanical_params.particle_count + 1u;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let peer_index = csr_peers[cursor];
    let pair_value = interface_receipt_pair_value(
      self_index,
      peer_index
    );
    if (!interface_receipt_finite(pair_value)) {
      atomicOr(
        &interface_receipt[15u],
        INTERFACE_RECEIPT_STATUS_FAIL_CLOSED
      );
      return;
    }
    let row = row_base + cursor * INTERFACE_RECEIPT_ROW_WORDS;
    atomicStore(&interface_receipt[row], peer_index);
    atomicStore(&interface_receipt[row + 1u], bitcast<u32>(pair_value));
  }
  atomicAdd(&interface_receipt[14u], end - begin);
}

@compute @workgroup_size(1)
fn seal_contact_interface_receipt(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u) { return; }
  let required_stages =
    ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.PROPOSAL_PUBLISHED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.COMMITTED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_CLEANUP}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE.MATCHING_TRUST_RESTORED}u;
  let admitted =
    interface_receipt_static_header_valid()
    && atomicLoad(&interface_receipt[15u])
      == INTERFACE_RECEIPT_STATUS_BUILDING
    && atomicLoad(&interface_receipt[14u])
      == atomicLoad(&interface_receipt[13u])
    && atomicLoad(&graph_control[14u]) == 0u
    && atomicLoad(&graph_control[16u]) == mechanical_params.particle_count
    && atomicLoad(&graph_control[17u]) == mechanical_params.particle_count
    && atomicLoad(&graph_control[18u]) == mechanical_params.particle_count
    && atomicLoad(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupPassCount}u]
    ) == ${solverBudget.cleanupPassBudget}u
    && atomicLoad(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupTrustRestoreCount}u]
    ) == mechanical_params.particle_count
    && (atomicLoad(&graph_control[15u]) & required_stages)
      == required_stages;
  if (!admitted) {
    atomicStore(
      &interface_receipt[15u],
      INTERFACE_RECEIPT_STATUS_READY
        | INTERFACE_RECEIPT_STATUS_FAIL_CLOSED
    );
    return;
  }
  atomicOr(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE
      .CONTACT_INTERFACE_RECEIPT_PUBLISHED}u
  );
  atomicStore(
    &interface_receipt[15u],
    INTERFACE_RECEIPT_STATUS_READY | INTERFACE_RECEIPT_STATUS_ADMITTED
  );
}
`;
}

function createSchroederSpatialMechanicalProposalApplyWgslForBudget(
  solverBudget
) {
  return /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

@group(0) @binding(0) var<storage, read> original_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> final_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> proposal_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> output_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> graph_control: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> mechanical_params: MechanicalProposalParams;
@group(0) @binding(7) var<storage, read_write> matching_cleanup_control:
  array<atomic<u32>>;

fn mechanical_publish_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn mechanical_publish_finite3(value: vec3<f32>) -> bool {
  return mechanical_publish_finite(value.x)
    && mechanical_publish_finite(value.y)
    && mechanical_publish_finite(value.z);
}

fn mechanical_publish_measure_count_word(iteration: u32) -> u32 {
  if (iteration < 4u) { return 19u + iteration; }
  if (iteration < 8u) {
    return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.measureCount4}u
      + (iteration - 4u);
  }
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.measureCount8}u
    + (iteration - 8u);
}

fn mechanical_publish_solve_count_word(iteration: u32) -> u32 {
  if (iteration < 4u) { return 23u + iteration; }
  if (iteration < 8u) {
    return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.solveCount4}u
      + (iteration - 4u);
  }
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD.solveCount8}u
    + (iteration - 8u);
}

fn mechanical_publish_energy_count_word(iteration: u32) -> u32 {
  if (iteration < 4u) { return 32u + iteration; }
  if (iteration < 8u) {
    return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .energyMeasureCount4}u + (iteration - 4u);
  }
  return ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .energyMeasureCount8}u + (iteration - 8u);
}

fn mechanical_publish_header_word(word: u32) -> u32 {
  return bitcast<u32>(proposal_rows[word / 4u][word % 4u]);
}

fn mechanical_publish_header_valid() -> bool {
  return arrayLength(&proposal_rows)
      >= ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
        + mechanical_params.particle_count * 2u
    && mechanical_publish_header_word(0u)
      == mechanical_params.proposal_magic
    && mechanical_publish_header_word(1u)
      == mechanical_params.proposal_version
    && mechanical_publish_header_word(2u)
      == mechanical_params.generation_id
    && mechanical_publish_header_word(3u)
      == mechanical_params.support_epoch
    && mechanical_publish_header_word(4u)
      == mechanical_params.particle_count
    && mechanical_publish_header_word(5u)
      == mechanical_params.proposal_row_words
    && mechanical_publish_header_word(6u)
      == mechanical_params.contact_support_profile_id
    && mechanical_publish_header_word(7u)
      == mechanical_params.separation_support_profile_id
    && mechanical_publish_header_word(8u)
      == mechanical_params.interface_support_profile_id
    && mechanical_publish_header_word(9u)
      == mechanical_params.position_epoch
    && mechanical_publish_header_word(10u)
      == mechanical_params.topology_epoch
    && mechanical_publish_header_word(11u)
      == mechanical_params.storage_generation
    && mechanical_publish_header_word(12u)
      == mechanical_params.physics_tick
    && mechanical_publish_header_word(13u)
      == mechanical_params.physics_substep
    && mechanical_publish_header_word(14u)
      == mechanical_params.traversal_count
    && mechanical_publish_header_word(15u)
      == mechanical_params.consumer_count;
}

fn mechanical_publish_graph_header_valid() -> bool {
  return arrayLength(&graph_control)
      >= ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS}u
    && atomicLoad(&graph_control[0u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC}u
    && atomicLoad(&graph_control[1u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION}u
    && atomicLoad(&graph_control[2u]) == mechanical_params.generation_id
    && atomicLoad(&graph_control[3u]) == mechanical_params.storage_generation
    && atomicLoad(&graph_control[4u]) == mechanical_params.physics_tick
    && atomicLoad(&graph_control[5u]) == mechanical_params.physics_substep
    && atomicLoad(&graph_control[6u]) == mechanical_params.position_epoch
    && atomicLoad(&graph_control[7u]) == mechanical_params.topology_epoch
    && atomicLoad(&graph_control[8u]) == mechanical_params.support_epoch
    && bitcast<i32>(atomicLoad(&graph_control[9u]))
      == mechanical_params.apply_selected_level
    && atomicLoad(&graph_control[10u])
      == mechanical_params.directed_pair_capacity;
}

fn mechanical_publish_matching_cleanup_header_valid() -> bool {
  return arrayLength(&matching_cleanup_control)
      >= ${solverBudget.matchingCleanupControlWords}u
    && atomicLoad(&matching_cleanup_control[0u])
      == ${MATCHING_CLEANUP_CONTROL_MAGIC}u
    && atomicLoad(&matching_cleanup_control[1u])
      == ${MATCHING_CLEANUP_CONTROL_VERSION}u
    && atomicLoad(&matching_cleanup_control[2u])
      == mechanical_params.generation_id
    && atomicLoad(&matching_cleanup_control[3u])
      == mechanical_params.storage_generation
    && atomicLoad(&matching_cleanup_control[4u])
      == mechanical_params.physics_tick
    && atomicLoad(&matching_cleanup_control[5u])
      == mechanical_params.physics_substep
    && atomicLoad(&matching_cleanup_control[6u])
      == mechanical_params.position_epoch
    && atomicLoad(&matching_cleanup_control[7u])
      == mechanical_params.topology_epoch
    && atomicLoad(&matching_cleanup_control[8u])
      == mechanical_params.support_epoch
    && atomicLoad(&matching_cleanup_control[9u])
      == mechanical_params.particle_count
    && atomicLoad(&matching_cleanup_control[10u])
      == mechanical_params.solver_iteration_count
    && atomicLoad(&matching_cleanup_control[11u])
      == ${solverBudget.cleanupPassBudget}u;
}

@compute @workgroup_size(64)
fn publish_contact_proposal(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  if (atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .fullSolverPath}u]) == 0u) { return; }
  if (
    !mechanical_publish_header_valid()
    || !mechanical_publish_graph_header_valid()
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.HEADER_OR_EPOCH}u
    );
    return;
  }
  if (
    atomicLoad(&graph_control[14u]) != 0u
    || atomicLoad(&graph_control[17u])
      != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    ) == 0u
  ) { return; }
  let original_position = original_state[particle_index * 2u];
  let original_velocity = original_state[particle_index * 2u + 1u];
  let final_position = final_state[particle_index * 2u];
  let final_velocity = final_state[particle_index * 2u + 1u];
  let dx = final_position.xyz - original_position.xyz;
  let dv = final_velocity.xyz - original_velocity.xyz;
  let du = final_velocity.w - original_velocity.w;
  let mechanical_heat_j = final_position.w * du;
  if (
    !mechanical_publish_finite3(dx)
    || !mechanical_publish_finite3(dv)
    || !mechanical_publish_finite(du)
    || !mechanical_publish_finite(mechanical_heat_j)
    || final_velocity.w < 0.0
    || du < 0.0
    || mechanical_heat_j < 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let proposal_row =
    ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
      + particle_index * 2u;
  proposal_rows[proposal_row] = vec4<f32>(dx, mechanical_heat_j);
  proposal_rows[proposal_row + 1u] = vec4<f32>(dv, du);
  atomicAdd(&graph_control[18u], 1u);
}

// The retained graph remains authoritative even when it has no rows: this
// path is reached only after exact traversal, the source-count scan, and the
// finalized append/CSR counters all agree on zero directed pairs.  It avoids
// running sixteen vacuous Jacobi rounds over every particle while publishing the
// same zero proposal rows and authenticated completion evidence.
@compute @workgroup_size(64)
fn complete_zero_contact_proposal(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  let required_stages =
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.INITIALIZED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SCANNED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u;
  let zero_graph_admitted =
    mechanical_publish_header_valid()
    && mechanical_publish_graph_header_valid()
    && mechanical_publish_matching_cleanup_header_valid()
    && mechanical_params.solver_iteration_count
      == ${solverBudget.jacobiIterations}u
    && atomicLoad(&graph_control[11u]) == 0u
    && atomicLoad(&graph_control[12u]) == 0u
    && atomicLoad(&graph_control[13u]) == 0u
    && atomicLoad(&graph_control[14u]) == 0u
    && atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .fullSolverPath}u]) == 0u
    && atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .zeroEdgeDispatchX}u])
      == (mechanical_params.particle_count + 63u) / 64u
    && atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .zeroEdgeDispatchY}u]) == 1u
    && atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .zeroEdgeDispatchZ}u]) == 1u
    && (
      atomicLoad(&graph_control[15u]) & required_stages
    ) == required_stages;
  if (!zero_graph_admitted) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.STAGE_ORDER}u
    );
    return;
  }
  let original_position = original_state[particle_index * 2u];
  let original_velocity = original_state[particle_index * 2u + 1u];
  if (
    !mechanical_publish_finite3(original_position.xyz)
    || !mechanical_publish_finite(original_position.w)
    || !mechanical_publish_finite3(original_velocity.xyz)
    || !mechanical_publish_finite(original_velocity.w)
    || original_position.w < 0.0
    || original_velocity.w < 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let proposal_row =
    ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
      + particle_index * 2u;
  proposal_rows[proposal_row] = vec4<f32>(0.0);
  proposal_rows[proposal_row + 1u] = vec4<f32>(0.0);
  // Scratch B is the normal even-round final state buffer. Initializing it
  // from the immutable post-G2P state lets the ordinary seal/commit path
  // remain the sole public-state publication path.
  output_state[particle_index * 2u] = original_position;
  output_state[particle_index * 2u + 1u] = original_velocity;
  atomicAdd(&graph_control[16u], 1u);
  atomicAdd(&graph_control[17u], 1u);
  atomicAdd(&graph_control[18u], 1u);
  for (var iteration = 0u;
    iteration < mechanical_params.solver_iteration_count;
    iteration = iteration + 1u) {
    atomicAdd(
      &graph_control[mechanical_publish_measure_count_word(iteration)],
      1u
    );
    atomicAdd(
      &graph_control[mechanical_publish_solve_count_word(iteration)],
      1u
    );
    atomicAdd(
      &graph_control[mechanical_publish_energy_count_word(iteration)],
      1u
    );
  }
  if (particle_index == 0u) {
    atomicAdd(&traversal_evidence[26u], 1u);
    atomicAdd(
      &traversal_evidence[28u],
      mechanical_params.solver_iteration_count
    );
    atomicAdd(
      &traversal_evidence[29u],
      mechanical_params.solver_iteration_count
    );
    atomicAdd(
      &traversal_evidence[32u],
      mechanical_params.solver_iteration_count
    );
    // The authenticated zero-edge route is an explicit solver bypass: no
    // conflict graph exists to clean up, but it still synthesizes the same
    // terminal cleanup certificate required by publication consumers.
    atomicStore(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupPassCount}u],
      ${solverBudget.cleanupPassBudget}u
    );
    atomicStore(
      &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
        .matchingCleanupTrustRestoreCount}u],
      mechanical_params.particle_count
    );
    for (
      var cleanup_pass = 0u;
      cleanup_pass
        < ${solverBudget.cleanupPassBudget}u;
      cleanup_pass = cleanup_pass + 1u
    ) {
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.selectionCountWord}u + cleanup_pass
        ],
        mechanical_params.particle_count
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.copyCountWord}u + cleanup_pass
        ],
        mechanical_params.particle_count
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.applyCountWord}u + cleanup_pass
        ],
        mechanical_params.particle_count
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.wallCountWord}u + cleanup_pass
        ],
        mechanical_params.particle_count
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.appliedPairCountWord}u + cleanup_pass
        ],
        0u
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.maxPositionRatioWord}u + cleanup_pass
        ],
        0u
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.maxVelocityResidualWord}u + cleanup_pass
        ],
        0u
      );
      atomicStore(
        &matching_cleanup_control[
          ${solverBudget.contactCountWord}u + cleanup_pass
        ],
        0u
      );
    }
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.GRAPH_VERIFIED}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_0}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_1}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_2}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_3}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_4}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_5}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_6}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_7}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_0}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_1}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_2}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_3}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_4}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_5}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_6}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_7}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATIONS_8_15}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE
        .ENERGY_ITERATIONS_8_15}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_VERIFIED}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.MATCHING_CLEANUP}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE
        .MATCHING_TRUST_RESTORED}u
    );
  }
}

@compute @workgroup_size(1)
fn seal_contact_proposal() {
  let headers_valid = mechanical_publish_header_valid()
    && mechanical_publish_graph_header_valid();
  if (!headers_valid) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.HEADER_OR_EPOCH}u
    );
  }
  let residual_verified =
    atomicLoad(&graph_control[17u]) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    ) != 0u;
  let rows_complete = atomicLoad(&graph_control[18u])
    == mechanical_params.particle_count;
  if (
    !headers_valid
    || !residual_verified
    || !rows_complete
    || atomicLoad(&graph_control[14u]) != 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.PUBLICATION_INCOMPLETE}u
    );
    // Evidence status is a bit field. A terminal rejection is both observable
    // (READY) and fail-closed; publishing only FAIL_CLOSED would leave readers
    // unable to distinguish an unfinished dispatch from a sealed rejection.
    atomicStore(&traversal_evidence[2u], 5u);
    return;
  }
  atomicStore(
    &traversal_evidence[14u],
    atomicLoad(&graph_control[11u])
  );
  atomicStore(
    &traversal_evidence[16u],
    atomicLoad(&graph_control[12u])
  );
  atomicStore(
    &traversal_evidence[17u],
    atomicLoad(&graph_control[13u])
  );
  atomicStore(
    &traversal_evidence[30u],
    atomicLoad(&graph_control[27u])
  );
  atomicStore(
    &traversal_evidence[31u],
    atomicLoad(&graph_control[28u])
  );
  atomicAdd(&traversal_evidence[27u], 1u);
  atomicOr(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.PROPOSAL_PUBLISHED}u
  );
  // Status is the externally observed publication word; write it only after
  // every proposal row and all retained evidence have been sealed.
  atomicStore(&traversal_evidence[2u], 3u);
}

@compute @workgroup_size(64)
fn commit_contact_proposal(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  if (
    atomicLoad(&graph_control[14u]) != 0u
    || atomicLoad(&graph_control[18u])
      != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.PROPOSAL_PUBLISHED}u
    ) == 0u
    || !mechanical_publish_header_valid()
    || !mechanical_publish_graph_header_valid()
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.PUBLICATION_INCOMPLETE}u
    );
    return;
  }
  output_state[particle_index * 2u] = final_state[particle_index * 2u];
  output_state[particle_index * 2u + 1u]
    = final_state[particle_index * 2u + 1u];
  if (particle_index == 0u) {
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.COMMITTED}u
    );
  }
}
`;
}

// Per-budget compiled WGSL variants. The declared solver budget appears in
// shader source as interpolated constants, so each (jacobiIterations,
// cleanupPassBudget) pair compiles its own variant; the cache below plus the
// budget-suffixed pipeline cache keys make the variants cheap and exact.
const mechanicalSolverBudgetWgslCache = new Map();
export function schroederSpatialMechanicalSolverBudgetWgsl(solverBudget) {
  const cacheKey = solverBudget?.cacheKey;
  if (typeof cacheKey !== 'string' || !cacheKey) {
    throw new TypeError(
      'mechanical solver budget WGSL requires a resolved solver budget'
    );
  }
  let entry = mechanicalSolverBudgetWgslCache.get(cacheKey);
  if (!entry) {
    entry = Object.freeze({
      solver: createSchroederSpatialMechanicalGraphSolverWgslForBudget(
        solverBudget
      ),
      interfaceReceipt:
        createSchroederSpatialMechanicalInterfaceReceiptWgslForBudget(
          solverBudget
        ),
      apply: createSchroederSpatialMechanicalProposalApplyWgslForBudget(
        solverBudget
      )
    });
    mechanicalSolverBudgetWgslCache.set(cacheKey, entry);
  }
  return entry;
}
const schroederSpatialMechanicalBatchSolverBudgetWgsl =
  schroederSpatialMechanicalSolverBudgetWgsl(
    SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET
  );
export const schroederSpatialMechanicalGraphSolverWgsl =
  schroederSpatialMechanicalBatchSolverBudgetWgsl.solver;
export const schroederSpatialMechanicalInterfaceReceiptWgsl =
  schroederSpatialMechanicalBatchSolverBudgetWgsl.interfaceReceipt;
export const schroederSpatialMechanicalProposalApplyWgsl =
  schroederSpatialMechanicalBatchSolverBudgetWgsl.apply;

// --- W5: exported pipeline-descriptor factory -------------------------------
//
// Single source of truth for every compute-pipeline descriptor the canonical
// mechanical proposal encodes. The runtime encode path below consumes THIS
// factory, and the admission-time prewarm enumeration
// (enumerateSchroederSpatialMechanicalPrewarmPipelineDescriptors) re-exports
// the same descriptors, so a prewarmed cache key can never drift from the key
// the encode later asks for.
//
// Every descriptor is a complete createCachedExplicitComputePipeline argument
// ({ cacheKey, label, code, entryPoint, bindings }). Descriptors whose code is
// budget-compiled (solver / interface-receipt / apply WGSL) carry the sealed
// solver-budget key (j{n}.p{n}) as a cacheKey suffix, exactly as the encode
// always keyed them.

export const SCHROEDER_SPATIAL_MECHANICAL_PROJECTION_VARIANTS =
  Object.freeze(['aggregate', 'active-rank', 'flat']);

function mechanicalBuildWgslForVariant(
  mechanicalProjectionVariant,
  directoryAbiVersion
) {
  if (mechanicalProjectionVariant === 'aggregate') {
    return directoryAbiVersion === 2
      ? schroederSpatialMechanicalProposalV2Wgsl
      : schroederSpatialMechanicalProposalWgsl;
  }
  if (mechanicalProjectionVariant === 'active-rank') {
    return directoryAbiVersion === 2
      ? schroederSpatialMechanicalProposalV2ActiveRankWgsl
      : schroederSpatialMechanicalProposalActiveRankWgsl;
  }
  return directoryAbiVersion === 2
    ? schroederSpatialMechanicalProposalV2FlatWgsl
    : schroederSpatialMechanicalProposalFlatWgsl;
}

export function schroederSpatialMechanicalPipelineDescriptors({
  solverBudget,
  mechanicalProjectionVariant = 'aggregate',
  directoryAbiVersion = 1,
  diagnosticTrace = false
} = {}) {
  if (typeof solverBudget?.cacheKey !== 'string' || !solverBudget.cacheKey) {
    throw new TypeError(
      'mechanical pipeline descriptors require a resolved solver budget'
    );
  }
  if (
    !SCHROEDER_SPATIAL_MECHANICAL_PROJECTION_VARIANTS
      .includes(mechanicalProjectionVariant)
  ) {
    throw new RangeError(
      `mechanical pipeline descriptors do not support projection variant ${
        String(mechanicalProjectionVariant)
      }`
    );
  }
  if (directoryAbiVersion !== 1 && directoryAbiVersion !== 2) {
    throw new RangeError(
      `canonical mechanical proposal does not support directory ABI v${directoryAbiVersion}`
    );
  }
  const solverBudgetWgsl = schroederSpatialMechanicalSolverBudgetWgsl(
    solverBudget
  );
  const budgetKey = (cacheKey) => `${cacheKey}.${solverBudget.cacheKey}`;
  const mechanicalBuildWgsl = mechanicalBuildWgslForVariant(
    mechanicalProjectionVariant,
    directoryAbiVersion
  );
  const buildBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(12, 'uniform'),
    computeBufferBinding(13, 'read-only-storage')
  ];
  const controlBindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'uniform'),
    computeBufferBinding(9, 'storage')
  ];
  const solverBindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'read-only-storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(12, 'storage')
  ];
  const solverIterationBindings = [
    ...solverBindings,
    computeBufferBinding(16, 'uniform', {
      minBindingSize: MECHANICAL_SOLVER_ITERATION_PARAMS_BYTES
    })
  ];
  const residualVerifyBindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'read-only-storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(13, 'storage')
  ];
  const matchingConstraintInitializerBindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'read-only-storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(12, 'storage'),
    computeBufferBinding(13, 'storage'),
    computeBufferBinding(14, 'storage')
  ];
  const matchingCleanupBindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'read-only-storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(12, 'storage'),
    computeBufferBinding(13, 'storage'),
    computeBufferBinding(14, 'storage')
  ];
  const diagnosticRefinementReplayBindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'read-only-storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(12, 'storage'),
    computeBufferBinding(13, 'storage'),
    computeBufferBinding(15, 'storage')
  ];
  const diagnosticApplyTraceBindings = [
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(12, 'storage'),
    computeBufferBinding(15, 'storage')
  ];
  const diagnosticTerminalTraceBindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'read-only-storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(13, 'storage'),
    computeBufferBinding(15, 'storage')
  ];
  const diagnosticMaterializeTraceBindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'read-only-storage'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(13, 'storage'),
    computeBufferBinding(15, 'storage')
  ];
  const interfaceReceiptBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'uniform'),
    computeBufferBinding(9, 'read-only-storage')
  ];
  const applyBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'uniform'),
    computeBufferBinding(7, 'storage')
  ];
  return Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-mechanical-pipeline-descriptors.v1',
    solverBudgetCacheKey: solverBudget.cacheKey,
    mechanicalProjectionVariant,
    directoryAbiVersion,
    diagnosticTrace: Boolean(diagnosticTrace),
    initialize: {
      cacheKey: 'ulg-schroeder-spatial-mechanical-contact-graph-initialize.v11',
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-initialize',
      code: schroederSpatialMechanicalGraphControlWgsl,
      entryPoint: 'initialize_contact_graph',
      bindings: controlBindings
    },
    reduction: {
      cacheKey:
        `ulg-schroeder-spatial-mechanical-contact-graph-support-reduction.${
          mechanicalProjectionVariant
        }.directory-v${directoryAbiVersion}.v12`,
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-support-reduction',
      code: mechanicalBuildWgsl,
      entryPoint: 'reduce_support',
      bindings: buildBindings
    },
    materialize: {
      cacheKey: `ulg-schroeder-spatial-mechanical-contact-graph-traversal.${
        mechanicalProjectionVariant
      }.directory-v${directoryAbiVersion}.v16`,
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-traversal',
      code: mechanicalBuildWgsl,
      entryPoint: 'materialize_contact_graph',
      bindings: buildBindings
    },
    finalizeCounts: {
      cacheKey: 'ulg-schroeder-spatial-mechanical-contact-graph-finalize-counts.v11',
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-finalize-counts',
      code: schroederSpatialMechanicalGraphControlWgsl,
      entryPoint: 'finalize_contact_graph_counts',
      bindings: controlBindings
    },
    scatter: {
      cacheKey: 'ulg-schroeder-spatial-mechanical-contact-graph-scatter-csr.v11',
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-scatter-csr',
      code: schroederSpatialMechanicalGraphControlWgsl,
      entryPoint: 'scatter_contact_graph_csr',
      bindings: controlBindings
    },
    validate: {
      cacheKey: 'ulg-schroeder-spatial-mechanical-contact-graph-validate-csr.v12',
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-validate-csr',
      code: schroederSpatialMechanicalGraphControlWgsl,
      entryPoint: 'validate_contact_graph_csr',
      bindings: controlBindings
    },
    index: {
      cacheKey: 'ulg-schroeder-spatial-mechanical-contact-graph-index-csr.v7',
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-index-csr',
      code: schroederSpatialMechanicalGraphControlWgsl,
      entryPoint: 'index_contact_graph_csr',
      bindings: controlBindings
    },
    solverMeasure: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-graph-measure-runtime.v2'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-measure-runtime',
      code: solverBudgetWgsl.solver,
      entryPoint: 'measure_runtime_iteration',
      bindings: solverIterationBindings
    },
    solverSolve: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-graph-solve-runtime.v2'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-solve-runtime',
      code: solverBudgetWgsl.solver,
      entryPoint: 'solve_runtime_iteration',
      bindings: solverIterationBindings
    },
    solverAllocateEnergy: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-graph-energy-allocate-runtime.v2'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-energy-allocate-runtime',
      code: solverBudgetWgsl.solver,
      entryPoint: 'allocate_energy_runtime_iteration',
      bindings: solverIterationBindings
    },
    initializeMatchingConstraints: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-matching-constraints-initialize.v22'
      ),
      label: 'ulg-schroeder-spatial-mechanical-matching-constraints-initialize',
      code: solverBudgetWgsl.solver,
      entryPoint: 'initialize_matching_cleanup_constraints',
      bindings: matchingConstraintInitializerBindings
    },
    matchingCleanup: diagnosticTrace
      ? {
        select: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-matching-cleanup-select.v27'
          ),
          label: 'ulg-schroeder-spatial-mechanical-matching-cleanup-select',
          code: solverBudgetWgsl.solver,
          entryPoint: 'select_matching_cleanup_edge',
          bindings: matchingCleanupBindings
        },
        copy: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-matching-cleanup-copy.v24'
          ),
          label: 'ulg-schroeder-spatial-mechanical-matching-cleanup-copy',
          code: solverBudgetWgsl.solver,
          entryPoint: 'copy_matching_cleanup_state',
          bindings: matchingCleanupBindings
        },
        apply: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-matching-cleanup-apply.v29'
          ),
          label: 'ulg-schroeder-spatial-mechanical-matching-cleanup-apply',
          code: solverBudgetWgsl.solver,
          entryPoint: 'apply_matching_cleanup_edge',
          bindings: matchingCleanupBindings
        },
        walls: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-matching-cleanup-walls.v25'
          ),
          label: 'ulg-schroeder-spatial-mechanical-matching-cleanup-walls',
          code: solverBudgetWgsl.solver,
          entryPoint: 'project_matching_cleanup_walls',
          bindings: matchingCleanupBindings
        },
        finalize: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-matching-cleanup-finalize.v24'
          ),
          label: 'ulg-schroeder-spatial-mechanical-matching-cleanup-finalize',
          code: solverBudgetWgsl.solver,
          entryPoint: 'finalize_matching_cleanup_pass',
          bindings: matchingCleanupBindings
        }
      }
      : null,
    matchingCleanupOwner: diagnosticTrace
      ? null
      : {
        cacheKey: budgetKey(
          'ulg-schroeder-spatial-mechanical-matching-cleanup-global-owner.v12'
        ),
        label: 'ulg-schroeder-spatial-mechanical-matching-cleanup-global-owner',
        code: solverBudgetWgsl.solver,
        entryPoint: 'run_matching_cleanup_global_owner',
        bindings: matchingCleanupBindings
      },
    restoreMatchingTrust: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-matching-cleanup-restore-trust.v24'
      ),
      label: 'ulg-schroeder-spatial-mechanical-matching-cleanup-restore-trust',
      code: solverBudgetWgsl.solver,
      entryPoint: 'restore_matching_cleanup_trust',
      bindings: matchingCleanupBindings
    },
    verify: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-residual-verify.v35'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-residual-verify',
      code: solverBudgetWgsl.solver,
      entryPoint: 'verify_contact_residual',
      bindings: residualVerifyBindings
    },
    diagnosticTracePipelines: diagnosticTrace
      ? {
        replay: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-diagnostic-trace-refinement-replay.v6'
          ),
          label: 'ulg-schroeder-spatial-mechanical-diagnostic-trace-refinement-replay',
          code: solverBudgetWgsl.solver,
          entryPoint: 'replay_matching_cleanup_refinement_trace',
          bindings: diagnosticRefinementReplayBindings
        },
        apply: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-diagnostic-trace-apply.v7'
          ),
          label: 'ulg-schroeder-spatial-mechanical-diagnostic-trace-apply',
          code: solverBudgetWgsl.solver,
          entryPoint: 'trace_matching_cleanup_apply',
          bindings: diagnosticApplyTraceBindings
        },
        measure: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-diagnostic-trace-measure.v3'
          ),
          label: 'ulg-schroeder-spatial-mechanical-diagnostic-trace-measure',
          code: solverBudgetWgsl.solver,
          entryPoint: 'measure_terminal_residual_trace',
          bindings: diagnosticTerminalTraceBindings
        },
        select: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-diagnostic-trace-select.v3'
          ),
          label: 'ulg-schroeder-spatial-mechanical-diagnostic-trace-select',
          code: solverBudgetWgsl.solver,
          entryPoint: 'select_terminal_residual_trace',
          bindings: diagnosticTerminalTraceBindings
        },
        materialize: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-diagnostic-trace-materialize.v4'
          ),
          label: 'ulg-schroeder-spatial-mechanical-diagnostic-trace-materialize',
          code: solverBudgetWgsl.solver,
          entryPoint: 'materialize_terminal_residual_trace',
          bindings: diagnosticMaterializeTraceBindings
        }
      }
      : null,
    verifyEnergy: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-energy-verify.v27'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-energy-verify',
      code: solverBudgetWgsl.solver,
      entryPoint: 'verify_contact_energy',
      bindings: solverBindings
    },
    initializeInterfaceReceipt: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-interface-receipt-initialize.v5'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-interface-receipt-initialize',
      code: solverBudgetWgsl.interfaceReceipt,
      entryPoint: 'initialize_contact_interface_receipt',
      bindings: interfaceReceiptBindings
    },
    materializeInterfaceReceipt: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-interface-receipt-materialize.v5'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-interface-receipt-materialize',
      code: solverBudgetWgsl.interfaceReceipt,
      entryPoint: 'materialize_contact_interface_receipt',
      bindings: interfaceReceiptBindings
    },
    sealInterfaceReceipt: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-interface-receipt-seal.v5'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-interface-receipt-seal',
      code: solverBudgetWgsl.interfaceReceipt,
      entryPoint: 'seal_contact_interface_receipt',
      bindings: interfaceReceiptBindings
    },
    publish: {
      cacheKey: budgetKey('ulg-schroeder-spatial-mechanical-proposal-publish.v11'),
      label: 'ulg-schroeder-spatial-mechanical-proposal-publish',
      code: solverBudgetWgsl.apply,
      entryPoint: 'publish_contact_proposal',
      bindings: applyBindings
    },
    zeroContactComplete: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-proposal-zero-contact-complete.v8'
      ),
      label: 'ulg-schroeder-spatial-mechanical-proposal-zero-contact-complete',
      code: solverBudgetWgsl.apply,
      entryPoint: 'complete_zero_contact_proposal',
      bindings: applyBindings
    },
    seal: {
      cacheKey: budgetKey('ulg-schroeder-spatial-mechanical-proposal-seal.v11'),
      label: 'ulg-schroeder-spatial-mechanical-proposal-seal',
      code: solverBudgetWgsl.apply,
      entryPoint: 'seal_contact_proposal',
      bindings: applyBindings
    },
    commit: {
      cacheKey: budgetKey('ulg-schroeder-spatial-mechanical-proposal-commit.v11'),
      label: 'ulg-schroeder-spatial-mechanical-proposal-commit',
      code: solverBudgetWgsl.apply,
      entryPoint: 'commit_contact_proposal',
      bindings: applyBindings
    }
  });
}

// W5 admission-time prewarm enumeration (consumed by the mechanics resident
// stage worker's lane-admission hook). Flattens the descriptor factory across
// the canonical solver budgets and the live projection/ABI variants into a
// deduplicated list of exact prewarmCachedExplicitComputePipeline arguments.
//
// Defaults are deliberately the LANE-HOT configuration: both canonical solver
// budgets (batch j16.p1024 and interactive j16.p512 -- the only budgets any
// production caller selects), the aggregate and flat projection variants (a
// lane runs 'aggregate' when its epoch commits an aggregate view and 'flat'
// otherwise; 'active-rank' stays opt-in), directory ABI v1 (the only version
// the epoch stage admits today), and no diagnostic-trace variants.
export function enumerateSchroederSpatialMechanicalPrewarmPipelineDescriptors({
  solverBudgets = [
    SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET,
    SCHROEDER_SPATIAL_MECHANICAL_INTERACTIVE_SOLVER_BUDGET
  ],
  mechanicalProjectionVariants = ['aggregate', 'flat'],
  directoryAbiVersions = [1],
  diagnosticTrace = false
} = {}) {
  const descriptorsByCacheKey = new Map();
  const collect = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.cacheKey === 'string' && typeof value.entryPoint === 'string') {
      if (!descriptorsByCacheKey.has(value.cacheKey)) {
        descriptorsByCacheKey.set(value.cacheKey, value);
      }
      return;
    }
    for (const nested of Object.values(value)) {
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        collect(nested);
      }
    }
  };
  for (const solverBudget of solverBudgets) {
    for (const mechanicalProjectionVariant of mechanicalProjectionVariants) {
      for (const directoryAbiVersion of directoryAbiVersions) {
        const table = schroederSpatialMechanicalPipelineDescriptors({
          solverBudget,
          mechanicalProjectionVariant,
          directoryAbiVersion,
          diagnosticTrace
        });
        for (const [field, value] of Object.entries(table)) {
          if (
            field === 'schema'
            || field === 'solverBudgetCacheKey'
            || field === 'mechanicalProjectionVariant'
            || field === 'directoryAbiVersion'
            || field === 'diagnosticTrace'
          ) continue;
          collect(value);
        }
      }
    }
  }
  return [...descriptorsByCacheKey.values()];
}

function createBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, size),
    usage
  }), device);
}

function prepareMechanicalProposalCapture({
  request,
  device,
  particleCount,
  controlByteLength,
  evidenceByteLength,
  matchingCleanupByteLength
}) {
  if (!request) return null;
  const { record, sequenceIndex, sequenceStepCount } = request;
  if (record.destroyed) {
    throw new Error('mechanical proposal capture was destroyed before encode');
  }
  if (record.nextSequenceIndex !== sequenceIndex) {
    throw new Error(
      'mechanical proposal capture sequence advanced before this proposal encoded'
    );
  }
  const layout = createMechanicalProposalCaptureLayout({
    sequenceStepCount,
    particleCount,
    controlByteLength,
    evidenceByteLength,
    matchingCleanupByteLength
  });
  if (!record.buffer) {
    const maxBufferSize = finiteNumber(
      device?.limits?.maxBufferSize,
      Number.MAX_SAFE_INTEGER
    );
    if (layout.totalByteLength > maxBufferSize) {
      throw new RangeError(
        'mechanical proposal capture exceeds the device maxBufferSize limit'
      );
    }
    record.buffer = createBuffer(
      device,
      'ulg-schroeder-spatial-mechanical-proposal-capture',
      layout.totalByteLength,
      GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
    );
    record.device = device;
    record.particleCount = particleCount;
    record.layout = layout;
  } else if (
    record.device !== device
    || record.particleCount !== particleCount
    || record.layout?.totalByteLength !== layout.totalByteLength
    || record.layout?.history?.strideByteLength
      !== layout.history.strideByteLength
  ) {
    throw new Error(
      'mechanical proposal capture device, particle count, or layout changed'
    );
  }
  return Object.freeze({
    record,
    sequenceIndex,
    sequenceStepCount,
    buffer: record.buffer,
    layout: record.layout
  });
}

function destroyMechanicalProposalPoolSlot(slot) {
  if (!slot || slot.destroyed === true) return false;
  for (const buffer of [
    slot.proposalBuffer,
    slot.evidenceBuffer,
    slot.matchingCleanupControlBuffer,
    slot.matchingConstraintBuffer,
    slot.supportBuffer,
    slot.sourceCountBuffer,
    slot.sourceOffsetBuffer,
    slot.appendStagingBuffer,
    slot.directedPeerBuffer,
    slot.scratchStateABuffer,
    slot.scratchStateBBuffer,
    slot.scaleBuffer,
    slot.graphControlBuffer,
    slot.indirectDispatchBuffer,
    slot.conditionalDispatchBuffer,
    slot.expectationBuffer,
    slot.paramsBuffer,
    slot.solverIterationParamsBuffer,
    slot.identityDisabledBuffer
  ]) buffer?.destroy?.();
  slot.sourceCountScan?.destroy?.();
  slot.destroyed = true;
  slot.inUseGenerationId = null;
  slot.generation = null;
  return true;
}

function mechanicalProposalPoolSlot(
  device,
  particleCount,
  arenaIndex = 0,
  generation = null,
  pairGraphByteBudget = null,
  solverBudget = null
) {
  if (typeof solverBudget?.cacheKey !== 'string') {
    throw new TypeError(
      'mechanical proposal pool requires a resolved solver budget'
    );
  }
  let devicePools = mechanicalProposalPools.get(device);
  if (!devicePools) {
    devicePools = new Map();
    mechanicalProposalPools.set(device, devicePools);
  }
  // Fixed per-particle graph storage must track the live cohort, not the next
  // power of two. The old rounding doubled all fixed buffers at 32,769 rows
  // and collapsed an 8 MiB graph from 278,503 directed rows to 32,743.
  const capacity = exactU32(particleCount, 'particleCount', { positive: true });
  if (capacity >= 0x4000_0000) {
    throw new RangeError(
      'canonical mechanical particleCount must leave two private CSR flag bits'
    );
  }
  const deviceLimits = {
    maxBufferSize: Number.isFinite(device.limits?.maxBufferSize)
      ? device.limits.maxBufferSize
      : Number.MAX_SAFE_INTEGER,
    maxStorageBufferBindingSize: Number.isFinite(
      device.limits?.maxStorageBufferBindingSize
    )
      ? device.limits.maxStorageBufferBindingSize
      : Number.MAX_SAFE_INTEGER
  };
  const matchingConstraintDeviceCapacity = Math.floor(
    Math.min(
      deviceLimits.maxBufferSize,
      deviceLimits.maxStorageBufferBindingSize
    ) / MATCHING_CONSTRAINT_BYTES_PER_DIRECTED_PAIR
  );
  if (matchingConstraintDeviceCapacity < 1) {
    throw new RangeError(
      'canonical mechanical matching-constraint storage cannot retain one '
      + 'directed row on this device'
    );
  }
  const maximumDirectedPairCapacity = Math.min(
    0xffff_ffff,
    Math.trunc(
      finiteNumber(
        device.limits?.maxComputeWorkgroupsPerDimension,
        65535
      )
    ) * WORKGROUP_SIZE,
    matchingConstraintDeviceCapacity
  );
  const deviceCapacityPlan = createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: capacity,
    maximumDirectedPairCapacity,
    matchingCleanupPasses: solverBudget.cleanupPassBudget,
    maxRetainedBytes: Number.MAX_SAFE_INTEGER,
    deviceLimits
  });
  const minimumDirectedPairCapacity = capacity
    * SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE;
  if (
    !Number.isSafeInteger(minimumDirectedPairCapacity)
    || minimumDirectedPairCapacity > 0xffff_ffff
    || minimumDirectedPairCapacity > maximumDirectedPairCapacity
    || minimumDirectedPairCapacity > deviceCapacityPlan.directedPairCapacity
  ) {
    throw new RangeError(
      `canonical mechanical pair graph cannot retain the required `
      + `${SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE} `
      + `directed rows per particle for ${capacity} particles on this device`
    );
  }
  const matchingCleanupOwnerWorkspaceWordLength =
    SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_HEADER_WORDS
      + capacity;
  const matchingCleanupOwnerWorkspaceByteLength =
    matchingCleanupOwnerWorkspaceWordLength
      * Uint32Array.BYTES_PER_ELEMENT;
  if (
    !Number.isSafeInteger(matchingCleanupOwnerWorkspaceByteLength)
    || matchingCleanupOwnerWorkspaceByteLength > deviceLimits.maxBufferSize
    || matchingCleanupOwnerWorkspaceByteLength
      > deviceLimits.maxStorageBufferBindingSize
  ) {
    throw new RangeError(
      'canonical mechanical matching-cleanup owner workspace exceeds device '
      + 'buffer limits'
    );
  }
  const matchingCleanupOwnerExtraByteLength = Math.max(
    0,
    matchingCleanupOwnerWorkspaceByteLength
      - deviceCapacityPlan.layout.bufferLayouts.conditionalDispatch.byteLength
  );
  const totalBytesPerDirectedPair =
    deviceCapacityPlan.bytesPerDirectedPair
      + MATCHING_CONSTRAINT_BYTES_PER_DIRECTED_PAIR;
  const defaultPairGraphByteBudget = Math.max(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_DEFAULT,
    deviceCapacityPlan.fixedRetainedByteLength
      + matchingCleanupOwnerExtraByteLength
      + minimumDirectedPairCapacity
        * totalBytesPerDirectedPair
  );
  const resolvedPairGraphByteBudget = pairGraphByteBudget == null
    ? defaultPairGraphByteBudget
    : pairGraphByteBudget;
  const budgetDirectedPairCapacity = Math.floor(
    (
      resolvedPairGraphByteBudget
        - deviceCapacityPlan.fixedRetainedByteLength
        - matchingCleanupOwnerExtraByteLength
    ) / totalBytesPerDirectedPair
  );
  if (budgetDirectedPairCapacity < minimumDirectedPairCapacity) {
    throw new RangeError(
      `canonical mechanical pair graph maxRetainedBytes `
      + `${resolvedPairGraphByteBudget} cannot admit the required `
      + `${minimumDirectedPairCapacity} directed pairs after fixed retained `
      + `buffers, owner flags, and private matching constraints; `
      + `device/budget capacity is `
      + `${Math.max(0, budgetDirectedPairCapacity)}`
    );
  }
  const graphPlan = createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: capacity,
    maximumDirectedPairCapacity: Math.min(
      maximumDirectedPairCapacity,
      budgetDirectedPairCapacity
    ),
    minimumDirectedPairCapacity,
    matchingCleanupPasses: solverBudget.cleanupPassBudget,
    maxRetainedBytes: resolvedPairGraphByteBudget,
    deviceLimits
  });
  const graphLayout = graphPlan.layout;
  const matchingConstraintByteLength =
    graphLayout.directedPairCapacity
      * MATCHING_CONSTRAINT_BYTES_PER_DIRECTED_PAIR;
  const totalRetainedByteLength =
    graphLayout.retainedByteLength
      + matchingConstraintByteLength
      + matchingCleanupOwnerExtraByteLength;
  if (totalRetainedByteLength > resolvedPairGraphByteBudget) {
    throw new RangeError(
      `canonical mechanical pair graph retained byte length `
      + `${totalRetainedByteLength} exceeds configured budget `
      + `${resolvedPairGraphByteBudget}`
    );
  }
  const exactArenaIndex = exactU32(
    Math.max(0, Math.trunc(finiteNumber(arenaIndex, 0))),
    'generation.execution.arenaIndex'
  );
  const key = String(exactArenaIndex);
  const solverIterationUniformPlan = mechanicalSolverIterationUniformPlan(
    device,
    solverBudget.jacobiIterations
  );
  let slot = devicePools.get(key);
  if (slot?.inUseGenerationId != null) {
    throw new Error(
      `mechanical proposal arena ${exactArenaIndex} is still leased by generation ${slot.inUseGenerationId}`
    );
  }
  const cacheHit = Boolean(
    slot
    && slot.destroyed !== true
    && slot.capacity >= capacity
    && slot.directedPairCapacity >= graphLayout.directedPairCapacity
    && slot.matchingCleanupControlBuffer
    && slot.matchingConstraintBuffer
    && slot.conditionalDispatchBuffer?.size
      >= matchingCleanupOwnerWorkspaceByteLength
    && slot.solverIterationParamsBuffer
    && slot.solverIterationParamsStrideBytes
      === solverIterationUniformPlan.strideBytes
    && slot.solverIterationParamsByteLength
      === solverIterationUniformPlan.byteLength
    && slot.solverBudgetKey === solverBudget.cacheKey
    && slot.graphLayout?.schema
      === ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA
    && slot.graphLayout?.controlWords
      === SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS
    && slot.graphLayout?.matchingCleanupControlWords
      === solverBudget.matchingCleanupControlWords
    && slot.totalRetainedByteLength <= resolvedPairGraphByteBudget
  );
  const priorAllocationCount = slot?.totalBufferCreationCount ?? 0;
  if (!cacheHit) {
    destroyMechanicalProposalPoolSlot(slot);
    const bufferLayout = graphLayout.bufferLayouts;
    const allocatedBuffers = [];
    const createTrackedBuffer = (...args) => {
      const buffer = createBuffer(...args);
      allocatedBuffers.push(buffer);
      return buffer;
    };
    let sourceCountScan = null;
    const graphUsage =
      GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST;
    try {
      sourceCountScan = createWebGpuU32ExclusiveScan(device, {
        maxElementCount: capacity,
        fixedElementCount: capacity,
        retainParamsBuffer: true,
        label: `ulg-schroeder-spatial-mechanical-contact-graph-count-scan-${key}`
      });
      const proposalBuffer = createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-proposals-${key}`,
        bufferLayout.proposals.byteLength,
        graphUsage
      );
      slot = {
        arenaIndex: exactArenaIndex,
        capacity,
        directedPairCapacity: graphLayout.directedPairCapacity,
        minimumDirectedPairCapacity,
        graphLayout,
        matchingConstraintByteLength,
        matchingCleanupOwnerWorkspaceWordLength,
        matchingCleanupOwnerWorkspaceByteLength,
        matchingCleanupOwnerExtraByteLength,
        totalRetainedByteLength,
        pairGraphByteBudget: resolvedPairGraphByteBudget,
        proposalBuffer,
        evidenceBuffer: createTrackedBuffer(
          device,
          `ulg-schroeder-spatial-mechanical-contact-graph-evidence-${key}`,
          bufferLayout.evidence.byteLength,
          graphUsage
        ),
        matchingCleanupControlBuffer: createTrackedBuffer(
          device,
          `ulg-schroeder-spatial-mechanical-matching-cleanup-control-${key}`,
          bufferLayout.matchingCleanupControl.byteLength,
          graphUsage
        ),
        matchingConstraintBuffer: createTrackedBuffer(
          device,
          `ulg-schroeder-spatial-mechanical-matching-constraints-${key}`,
          matchingConstraintByteLength,
          graphUsage
        ),
      supportBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-global-support-bound-${key}`,
        (
          MECHANICAL_SUPPORT_HEADER_WORDS
            + capacity * MECHANICAL_SUPPORT_ROW_WORDS
            + MECHANICAL_SUPPORT_TRAILER_WORDS
        ) * Uint32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      ),
      sourceCountBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-source-counts-${key}`,
        bufferLayout.sourceCounts.byteLength,
        graphUsage
      ),
      sourceOffsetBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-source-offsets-${key}`,
        bufferLayout.sourceOffsets.byteLength,
        graphUsage
      ),
      appendStagingBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-append-staging-${key}`,
        bufferLayout.appendStaging.byteLength,
        graphUsage
      ),
      directedPeerBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-directed-peers-${key}`,
        bufferLayout.directedPeers.byteLength,
        graphUsage
      ),
      scratchStateABuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-scratch-a-${key}`,
        bufferLayout.scratchStateA.byteLength,
        graphUsage
      ),
      scratchStateBBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-scratch-b-${key}`,
        bufferLayout.scratchStateB.byteLength,
        graphUsage
      ),
      scaleBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-scales-${key}`,
        bufferLayout.scales.byteLength,
        graphUsage
      ),
      energyLedgerBuffer: proposalBuffer,
      graphControlBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-control-${key}`,
        bufferLayout.control.byteLength,
        graphUsage
      ),
      indirectDispatchBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-indirect-${key}`,
        bufferLayout.indirectDispatch.byteLength,
        GPU_BUFFER_USAGE.INDIRECT
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      conditionalDispatchBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-conditional-${key}`,
        matchingCleanupOwnerWorkspaceByteLength,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.INDIRECT
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      expectationBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-expectation-${key}`,
        EXPECTATION_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      paramsBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-params-${key}`,
        MECHANICAL_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      solverIterationParamsBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-solver-iterations-${key}`,
        solverIterationUniformPlan.byteLength,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      solverIterationParamsStrideBytes:
        solverIterationUniformPlan.strideBytes,
      solverIterationParamsByteLength:
        solverIterationUniformPlan.byteLength,
      solverBudgetKey: solverBudget.cacheKey,
      identityDisabledBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-identity-disabled-${key}`,
        capacity * Uint32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      ),
      sourceCountScan,
      destroyed: false,
      inUseGenerationId: null,
      generation: null,
      releaseScheduled: false,
      totalBufferCreationCount: priorAllocationCount
        + 18
        + sourceCountScan.allocationEntries().length,
      acquisitionCount: 0
      };
      device.queue.writeBuffer(
        slot.solverIterationParamsBuffer,
        0,
        solverIterationUniformPlan.values
      );
    } catch (error) {
      for (const buffer of allocatedBuffers) buffer?.destroy?.();
      sourceCountScan?.destroy?.();
      throw error;
    }
    devicePools.set(key, slot);
  }
  return { slot, cacheHit };
}

export function destroySchroederSpatialMechanicalProposalRuntime(device) {
  const devicePools = mechanicalProposalPools.get(device);
  if (!devicePools) return false;
  for (const slot of devicePools.values()) destroyMechanicalProposalPoolSlot(slot);
  devicePools.clear();
  mechanicalProposalPools.delete(device);
  return true;
}

export function runSchroederSpatialMechanicalProposalWebGpu({
  device,
  generation,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  mlsMpmParticleUpload,
  boxDimsM = [5, 5, 5],
  gridSpacingM = sphParticleState?.smoothingLengthM ?? 0,
  relaxation = mlsMpmParticleState?.particleSeparationRelaxation ?? 0.35,
  normalVelocityDamping =
    mlsMpmParticleState?.particleSeparationVelocityDamping ?? 0.25,
  selectedLevel = null,
  pairGraphByteBudget = null,
  retainCompleteAuthenticatedCellCliques = false,
  gpuTimestampRecorder = null,
  // Diagnostic pass-level GPU timestamps for this proposal's compute
  // passes (build, Jacobi iterations, cleanup owner, verify, publish).
  // Requires a device created with 'timestamp-query'; inert otherwise.
  gpuPassTimestampProfilingRequested = false,
  diagnosticTrace = null,
  capture = null,
  sequenceIndex = null,
  sequenceStepCount = null,
  // Per-invocation solver knobs. jacobiIterations defaults to the proven 16
  // rounds; cleanupPassBudget has NO default and every caller must select
  // one (batch preset 1024, interactive preset 512). Both are validated by
  // resolveSchroederSpatialMechanicalSolverBudget and sealed into the run's
  // control header, pipelines, and telemetry.
  jacobiIterations = SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
  cleanupPassBudget
} = {}) {
  const solverBudget = resolveSchroederSpatialMechanicalSolverBudget({
    jacobiIterations,
    cleanupPassBudget
  });
  const particleCount = Math.max(0, Math.trunc(finiteNumber(
    sphParticleState?.particleCount ?? mlsMpmParticleState?.particleCount,
    0
  )));
  if (particleCount < 1 || particleCount !== mlsMpmParticleState?.particleCount) {
    throw new RangeError('canonical mechanical proposals require matching positive particle counts');
  }
  if (particleCount >= 0x8000_0000) {
    throw new RangeError(
      'canonical mechanical aggregate-summary preflight requires particleCount below 2^31'
    );
  }
  const captureRequest = resolveMechanicalProposalCaptureRequest({
    capture,
    sequenceIndex,
    sequenceStepCount
  });
  const immutableSelectedLevel = selectedLevel == null
    ? MECHANICAL_APPLY_ALL_LEVELS
    : exactI32(Number(selectedLevel), 'selectedLevel');
  const rawPhaseCarrierPlan = sphParticleUpload?.phaseCarrierPlan
    ?? mlsMpmParticleUpload?.phaseCarrierPlan
    ?? sphParticleState?.phaseCarrierPlan
    ?? mlsMpmParticleState?.phaseCarrierPlan
    ?? null;
  const phaseCarrierPlan = validateSphPhaseCarrierPlan(
    rawPhaseCarrierPlan,
    particleCount
  );
  if (rawPhaseCarrierPlan && phaseCarrierPlan.accepted !== true) {
    throw new TypeError(
      'canonical mechanical proposals require an exact phase-carrier lineage plan'
    );
  }
  const authority = resolveMechanicalSpatialAuthority({
    device,
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload,
    particleCount
  });
  const resolvedDiagnosticTrace = resolveMechanicalDiagnosticTrace({
    device,
    diagnosticTrace,
    execution: authority.execution,
    particleCount,
    solverBudget
  });
  const aggregateView = generation?.aggregateView || null;
  const activeRankView = generation?.activeRankView
    ?? authority.execution?.activeRankView
    ?? null;
  let aggregateHierarchyEnabled = false;
  let activeRankViewEnabled = false;
  let aggregateViewBuffer = authority.directoryBuffer;
  let aggregateSourceRowLayoutId = 0;
  let aggregateCapacityWords = 0;
  let aggregateAdmissionStatus = 'schroeder-spatial-aggregate-view-absent';
  if (aggregateView) {
    const aggregateAdmission = validateSchroederSpatialAggregateViewDescriptor(
      aggregateView,
      {
        generationId: authority.execution.generationId,
        deviceOrdinal: authority.execution.deviceOrdinal,
        laneOrdinal: authority.execution.laneOrdinal,
        leaseToken: authority.execution.leaseToken,
        sourceFamilyId: authority.execution.sourceFamilyId,
        storageGeneration: authority.execution.storageGeneration,
        physicsTick: authority.execution.physicsTick,
        physicsSubstep: authority.execution.physicsSubstep,
        positionEpoch: authority.execution.positionEpoch,
        topologyEpoch: authority.execution.topologyEpoch,
        chartEpoch: authority.execution.chartEpoch,
        levelEpoch: authority.execution.levelEpoch,
        supportEpoch: authority.execution.supportEpoch,
        completionOrdinal: authority.execution.buildOrdinal,
        sourceCount: particleCount,
        sourceCapacity: authority.execution.sourceCapacity,
        cellCapacity: authority.execution.cellCapacity,
        sourceRowLayoutId: authority.source.sourceRowLayoutId
      }
    );
    aggregateAdmissionStatus = aggregateAdmission.status;
    const exactSourceAuthority = aggregateView.spatialExecution
        === authority.execution
      && aggregateView.spatialSource === authority.source
      && aggregateView.sourceStateBuffer === authority.stateBuffer
      && aggregateView.sourceThermoBuffer === authority.thermoBuffer
      && (
        !authority.identityBuffer
        || aggregateView.sourceIdentityBuffer === authority.identityBuffer
      );
    if (aggregateAdmission.admitted !== true || !exactSourceAuthority) {
      const error = new TypeError(
        aggregateAdmission.admitted !== true
          ? `canonical mechanical aggregate hierarchy was rejected: ${
              aggregateAdmission.status
            }`
          : 'canonical mechanical aggregate hierarchy does not share the exact source authority'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_MECHANICAL_AGGREGATE_AUTHENTICATION';
      throw error;
    }
    aggregateViewBuffer = requireBuffer(
      device,
      aggregateView.aggregateViewBuffer,
      'generation.aggregateView.aggregateViewBuffer'
    );
    aggregateSourceRowLayoutId = exactU32(
      aggregateView.sourceRowLayoutId,
      'generation.aggregateView.sourceRowLayoutId',
      { positive: true }
    );
    aggregateCapacityWords = exactU32(
      aggregateView.layout?.wordLength,
      'generation.aggregateView.layout.wordLength',
      { positive: true }
    );
    aggregateHierarchyEnabled = true;
  }
  let activeRankViewAdmissionStatus = activeRankView
    ? 'schroeder-spatial-active-rank-view-not-selected'
    : 'schroeder-spatial-active-rank-view-absent';
  if (!aggregateHierarchyEnabled && activeRankView) {
    const activeRankAdmission = validateSchroederSpatialActiveRankViewDescriptor(
      activeRankView,
      {
        spatialExecution: authority.execution,
        sourceBuffer: authority.execution.sourceBuffer,
        directoryBuffer: authority.directoryBuffer,
        sourceCount: particleCount,
        sourceCapacity: authority.execution.sourceCapacity,
        sourceRowLayoutId: authority.source.sourceRowLayoutId,
        generationId: authority.execution.generationId,
        storageGeneration: authority.execution.storageGeneration,
        physicsTick: authority.execution.physicsTick,
        physicsSubstep: authority.execution.physicsSubstep,
        positionEpoch: authority.execution.positionEpoch,
        topologyEpoch: authority.execution.topologyEpoch,
        chartEpoch: authority.execution.chartEpoch,
        levelEpoch: authority.execution.levelEpoch,
        supportEpoch: authority.execution.supportEpoch,
        buildOrdinal: authority.execution.buildOrdinal
      }
    );
    activeRankViewAdmissionStatus = activeRankAdmission.status;
    if (activeRankAdmission.admitted !== true) {
      const error = new TypeError(
        `canonical mechanical active-rank view was rejected: ${
          activeRankAdmission.status
        }`
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_MECHANICAL_ACTIVE_RANK_AUTHENTICATION';
      throw error;
    }
    aggregateViewBuffer = requireBuffer(
      device,
      activeRankView.activeRankViewBuffer,
      'generation.activeRankView.activeRankViewBuffer'
    );
    aggregateSourceRowLayoutId = exactU32(
      activeRankView.sourceRowLayoutId,
      'generation.activeRankView.sourceRowLayoutId',
      { positive: true }
    );
    aggregateCapacityWords = exactU32(
      activeRankView.layout?.wordLength,
      'generation.activeRankView.layout.wordLength',
      { positive: true }
    );
    activeRankViewEnabled = true;
  }
  if (
    immutableSelectedLevel !== MECHANICAL_APPLY_ALL_LEVELS
    && (
      immutableSelectedLevel < authority.execution.queryMinLevel
      || immutableSelectedLevel > authority.execution.queryMaxLevel
    )
  ) {
    throw new RangeError(
      `selectedLevel ${immutableSelectedLevel} is outside the authenticated spatial range ${
        authority.execution.queryMinLevel
      }..${authority.execution.queryMaxLevel}`
    );
  }
  const spatialSourceBuffer = requireBuffer(
    device,
    authority.source.sourceBuffer ?? authority.source.activeNodeBuffer,
    'generation.source.sourceBuffer'
  );
  const consumerAuthentications = SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.map(
    ({ consumerId, supportProfileId }) => {
      const authentication = resolveSchroederSpatialExactNearConsumerGeneration(
        generation,
        {
          device,
          runtime: generation.runtime,
          consumerId,
          supportProfileId,
          expectedTraversalCount:
            SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
          sourceBuffer: spatialSourceBuffer
        }
      );
      if (authentication?.ready !== true || authentication.authenticated !== true) {
        const error = new Error(
          authentication?.reason
          || `Canonical spatial mechanical consumer ${consumerId} was not authenticated`
        );
        error.code = 'ERR_SCHROEDER_SPATIAL_MECHANICAL_AUTHENTICATION';
        throw error;
      }
      return authentication;
    }
  );
  const contactAuthentication = consumerAuthentications[0];
  const poolAcquisition = mechanicalProposalPoolSlot(
    device,
    particleCount,
    authority.execution.arenaIndex,
    generation,
    pairGraphByteBudget,
    solverBudget
  );
  const pool = poolAcquisition.slot;
  const identityBuffer = authority.identityBuffer || pool.identityDisabledBuffer;
  const proposalBuffer = pool.proposalBuffer;
  const evidenceBuffer = pool.evidenceBuffer;
  const supportBuffer = pool.supportBuffer;
  const expectationBuffer = pool.expectationBuffer;
  const paramsBuffer = pool.paramsBuffer;
  const uniformQueryLevel = authority.execution.queryMinLevel
      === authority.execution.queryMaxLevel
    ? exactI32(
        authority.execution.queryMinLevel,
        'execution uniform query level'
      )
    : null;
  const evidenceInitial = createMechanicalPairGraphEvidenceHeader({
    execution: authority.execution,
    selectedLevel: immutableSelectedLevel,
    particleCount,
    particleCapacity: pool.capacity,
    directedPairCapacity: pool.directedPairCapacity
  });
  device.queue.writeBuffer(
    expectationBuffer,
    0,
    contactAuthentication.expectationData
  );
  device.queue.writeBuffer(paramsBuffer, 0, createMechanicalParamsArray({
    particleCount,
    directedPairCapacity: pool.directedPairCapacity,
    relaxation,
    normalVelocityDamping,
    gridSpacingM,
    boxDimsM,
    identityEnabled: Boolean(authority.identityBuffer),
    selectedLevel: immutableSelectedLevel,
    phaseLineageCapacity: phaseCarrierPlan.lineageCapacity,
    phaseLaneCount: phaseCarrierPlan.phaseLaneCount,
    retainCompleteAuthenticatedCellCliques,
    aggregateHierarchyEnabled,
    activeRankViewEnabled,
    aggregateSourceRowLayoutId,
    aggregateCapacityWords,
    solverIterationCount: solverBudget.jacobiIterations,
    execution: authority.execution
  }));
  device.queue.writeBuffer(evidenceBuffer, 0, evidenceInitial);
  device.queue.writeBuffer(
    pool.matchingCleanupControlBuffer,
    0,
    createMechanicalMatchingCleanupControlHeader(
      authority.execution,
      particleCount,
      solverBudget
    )
  );
  device.queue.writeBuffer(
    proposalBuffer,
    0,
    createMechanicalProposalHeader(authority.execution, particleCount)
  );

  const mechanicalProjectionVariant = aggregateHierarchyEnabled
    ? 'aggregate'
    : (activeRankViewEnabled ? 'active-rank' : 'flat');
  const directoryAbiVersion = exactU32(
    authority.execution.directoryAbiVersion
      ?? generation?.directoryAbiVersion
      ?? 1,
    'execution.directoryAbiVersion',
    { positive: true }
  );
  // W5: every pipeline descriptor (cache key, WGSL, entry point, bindings)
  // comes from the exported factory the admission-time prewarm enumeration
  // also consumes, so a prewarmed cache key can never drift from the key
  // this encode asks for. Budget-compiled shader variants keep their sealed
  // (jacobiIterations, cleanupPassBudget) cacheKey suffix inside the
  // factory; the factory also owns the directory-ABI validation.
  const pipelineDescriptors = schroederSpatialMechanicalPipelineDescriptors({
    solverBudget,
    mechanicalProjectionVariant,
    directoryAbiVersion,
    diagnosticTrace: Boolean(resolvedDiagnosticTrace)
  });
  const createPipeline = (descriptor) => (
    createCachedExplicitComputePipeline(device, descriptor)
  );
  const initializePipeline = createPipeline(pipelineDescriptors.initialize);
  const reductionPipeline = createPipeline(pipelineDescriptors.reduction);
  const materializePipeline = createPipeline(pipelineDescriptors.materialize);
  const finalizeCountsPipeline = createPipeline(
    pipelineDescriptors.finalizeCounts
  );
  const scatterPipeline = createPipeline(pipelineDescriptors.scatter);
  const validatePipeline = createPipeline(pipelineDescriptors.validate);
  const indexPipeline = createPipeline(pipelineDescriptors.index);
  const solverPipelines = Object.freeze({
    measure: createPipeline(pipelineDescriptors.solverMeasure),
    solve: createPipeline(pipelineDescriptors.solverSolve),
    allocateEnergy: createPipeline(pipelineDescriptors.solverAllocateEnergy)
  });
  const initializeMatchingConstraintsPipeline = createPipeline(
    pipelineDescriptors.initializeMatchingConstraints
  );
  const matchingCleanupPipelines = resolvedDiagnosticTrace
    ? Object.freeze({
      select: createPipeline(pipelineDescriptors.matchingCleanup.select),
      copy: createPipeline(pipelineDescriptors.matchingCleanup.copy),
      apply: createPipeline(pipelineDescriptors.matchingCleanup.apply),
      walls: createPipeline(pipelineDescriptors.matchingCleanup.walls),
      finalize: createPipeline(pipelineDescriptors.matchingCleanup.finalize)
    })
    : null;
  const matchingCleanupOwnerPipeline = resolvedDiagnosticTrace
    ? null
    : createPipeline(pipelineDescriptors.matchingCleanupOwner);
  const restoreMatchingTrustPipeline = createPipeline(
    pipelineDescriptors.restoreMatchingTrust
  );
  const verifyPipeline = createPipeline(pipelineDescriptors.verify);
  const diagnosticTracePipelines = resolvedDiagnosticTrace
    ? Object.freeze({
      replay: createPipeline(
        pipelineDescriptors.diagnosticTracePipelines.replay
      ),
      apply: createPipeline(
        pipelineDescriptors.diagnosticTracePipelines.apply
      ),
      measure: createPipeline(
        pipelineDescriptors.diagnosticTracePipelines.measure
      ),
      select: createPipeline(
        pipelineDescriptors.diagnosticTracePipelines.select
      ),
      materialize: createPipeline(
        pipelineDescriptors.diagnosticTracePipelines.materialize
      )
    })
    : null;
  const verifyEnergyPipeline = createPipeline(pipelineDescriptors.verifyEnergy);
  const initializeInterfaceReceiptPipeline = createPipeline(
    pipelineDescriptors.initializeInterfaceReceipt
  );
  const materializeInterfaceReceiptPipeline = createPipeline(
    pipelineDescriptors.materializeInterfaceReceipt
  );
  const sealInterfaceReceiptPipeline = createPipeline(
    pipelineDescriptors.sealInterfaceReceipt
  );
  const publishPipeline = createPipeline(pipelineDescriptors.publish);
  const zeroContactCompletePipeline = createPipeline(
    pipelineDescriptors.zeroContactComplete
  );
  const sealPipeline = createPipeline(pipelineDescriptors.seal);
  const commitPipeline = createPipeline(pipelineDescriptors.commit);
  const workgroups = Math.max(1, Math.ceil(particleCount / WORKGROUP_SIZE));
  const buildEntries = (
    stateBuffer,
    mechanicsBuffer,
    { includeAggregate = false } = {}
  ) => [
    { binding: 0, resource: { buffer: stateBuffer } },
    { binding: 1, resource: { buffer: authority.thermoBuffer } },
    { binding: 2, resource: { buffer: mechanicsBuffer } },
    { binding: 3, resource: { buffer: identityBuffer } },
    { binding: 4, resource: { buffer: authority.directoryBuffer } },
    { binding: 5, resource: { buffer: spatialSourceBuffer } },
    { binding: 6, resource: { buffer: pool.sourceCountBuffer } },
    { binding: 7, resource: { buffer: pool.appendStagingBuffer } },
    { binding: 8, resource: { buffer: pool.graphControlBuffer } },
    { binding: 9, resource: { buffer: evidenceBuffer } },
    { binding: 10, resource: { buffer: supportBuffer } },
    { binding: 11, resource: { buffer: expectationBuffer } },
    { binding: 12, resource: { buffer: paramsBuffer } },
    { binding: 13, resource: { buffer: aggregateViewBuffer } }
  ];
  const controlEntries = [
    { binding: 0, resource: { buffer: pool.sourceCountBuffer } },
    { binding: 1, resource: { buffer: pool.sourceOffsetBuffer } },
    { binding: 2, resource: { buffer: pool.appendStagingBuffer } },
    { binding: 3, resource: { buffer: pool.directedPeerBuffer } },
    { binding: 4, resource: { buffer: pool.graphControlBuffer } },
    { binding: 5, resource: { buffer: evidenceBuffer } },
    { binding: 6, resource: { buffer: proposalBuffer } },
    { binding: 7, resource: { buffer: pool.scaleBuffer } },
    { binding: 8, resource: { buffer: paramsBuffer } },
    { binding: 9, resource: { buffer: supportBuffer } }
  ];
  const solverEntries = (
    inputStateBuffer,
    outputStateBuffer,
    mechanicsBuffer,
    traversalControlBuffer = evidenceBuffer
  ) => [
    { binding: 0, resource: { buffer: inputStateBuffer } },
    { binding: 1, resource: { buffer: outputStateBuffer } },
    { binding: 2, resource: { buffer: authority.thermoBuffer } },
    { binding: 3, resource: { buffer: mechanicsBuffer } },
    { binding: 4, resource: { buffer: identityBuffer } },
    { binding: 5, resource: { buffer: pool.directedPeerBuffer } },
    { binding: 6, resource: { buffer: pool.sourceOffsetBuffer } },
    { binding: 7, resource: { buffer: pool.scaleBuffer } },
    { binding: 8, resource: { buffer: pool.graphControlBuffer } },
    { binding: 9, resource: { buffer: spatialSourceBuffer } },
    { binding: 10, resource: { buffer: traversalControlBuffer } },
    { binding: 11, resource: { buffer: paramsBuffer } },
    { binding: 12, resource: { buffer: pool.energyLedgerBuffer } }
  ];
  const solverIterationEntries = (
    inputStateBuffer,
    outputStateBuffer,
    mechanicsBuffer,
    iteration
  ) => [
    ...solverEntries(inputStateBuffer, outputStateBuffer, mechanicsBuffer),
    {
      binding: 16,
      resource: {
        buffer: pool.solverIterationParamsBuffer,
        offset: iteration * pool.solverIterationParamsStrideBytes,
        size: MECHANICAL_SOLVER_ITERATION_PARAMS_BYTES
      }
    }
  ];
  const residualVerifyEntries = (
    inputStateBuffer,
    mechanicsBuffer,
    traversalControlBuffer = evidenceBuffer
  ) => [
    { binding: 0, resource: { buffer: inputStateBuffer } },
    { binding: 3, resource: { buffer: mechanicsBuffer } },
    { binding: 5, resource: { buffer: pool.directedPeerBuffer } },
    { binding: 6, resource: { buffer: pool.sourceOffsetBuffer } },
    { binding: 8, resource: { buffer: pool.graphControlBuffer } },
    { binding: 9, resource: { buffer: spatialSourceBuffer } },
    { binding: 10, resource: { buffer: traversalControlBuffer } },
    { binding: 11, resource: { buffer: paramsBuffer } },
    { binding: 13, resource: { buffer: pool.matchingConstraintBuffer } }
  ];
  const matchingConstraintInitializerEntries = (
    inputStateBuffer,
    mechanicsBuffer
  ) => [
    { binding: 0, resource: { buffer: inputStateBuffer } },
    { binding: 2, resource: { buffer: authority.thermoBuffer } },
    { binding: 3, resource: { buffer: mechanicsBuffer } },
    { binding: 4, resource: { buffer: identityBuffer } },
    { binding: 5, resource: { buffer: pool.directedPeerBuffer } },
    { binding: 6, resource: { buffer: pool.sourceOffsetBuffer } },
    { binding: 8, resource: { buffer: pool.graphControlBuffer } },
    { binding: 9, resource: { buffer: spatialSourceBuffer } },
    { binding: 11, resource: { buffer: paramsBuffer } },
    { binding: 12, resource: { buffer: pool.energyLedgerBuffer } },
    { binding: 13, resource: { buffer: pool.matchingConstraintBuffer } },
    { binding: 14, resource: { buffer: pool.conditionalDispatchBuffer } }
  ];
  const matchingCleanupEntries = (
    inputStateBuffer,
    outputStateBuffer,
    mechanicsBuffer
  ) => [
    { binding: 0, resource: { buffer: inputStateBuffer } },
    { binding: 1, resource: { buffer: outputStateBuffer } },
    { binding: 3, resource: { buffer: mechanicsBuffer } },
    { binding: 5, resource: { buffer: pool.directedPeerBuffer } },
    { binding: 6, resource: { buffer: pool.sourceOffsetBuffer } },
    { binding: 7, resource: { buffer: pool.scaleBuffer } },
    { binding: 8, resource: { buffer: pool.graphControlBuffer } },
    { binding: 9, resource: { buffer: spatialSourceBuffer } },
    {
      binding: 10,
      resource: { buffer: pool.matchingCleanupControlBuffer }
    },
    { binding: 11, resource: { buffer: paramsBuffer } },
    { binding: 12, resource: { buffer: pool.energyLedgerBuffer } },
    { binding: 13, resource: { buffer: pool.matchingConstraintBuffer } },
    { binding: 14, resource: { buffer: pool.conditionalDispatchBuffer } }
  ];
  const diagnosticTraceResource = resolvedDiagnosticTrace
    ? {
        buffer: resolvedDiagnosticTrace.buffer,
        offset: resolvedDiagnosticTrace.byteOffset,
        size: resolvedDiagnosticTrace.byteLength
      }
    : null;
  const diagnosticRefinementReplayEntries = (
    inputStateBuffer,
    outputStateBuffer,
    mechanicsBuffer
  ) => [
    { binding: 0, resource: { buffer: inputStateBuffer } },
    { binding: 1, resource: { buffer: outputStateBuffer } },
    { binding: 2, resource: { buffer: authority.thermoBuffer } },
    { binding: 3, resource: { buffer: mechanicsBuffer } },
    { binding: 5, resource: { buffer: pool.directedPeerBuffer } },
    { binding: 6, resource: { buffer: pool.sourceOffsetBuffer } },
    { binding: 8, resource: { buffer: pool.graphControlBuffer } },
    { binding: 9, resource: { buffer: spatialSourceBuffer } },
    {
      binding: 10,
      resource: { buffer: pool.matchingCleanupControlBuffer }
    },
    { binding: 11, resource: { buffer: paramsBuffer } },
    { binding: 12, resource: { buffer: pool.energyLedgerBuffer } },
    { binding: 13, resource: { buffer: pool.matchingConstraintBuffer } },
    { binding: 15, resource: diagnosticTraceResource }
  ];
  const diagnosticApplyTraceEntries = (outputStateBuffer) => [
    { binding: 1, resource: { buffer: outputStateBuffer } },
    { binding: 2, resource: { buffer: authority.thermoBuffer } },
    { binding: 8, resource: { buffer: pool.graphControlBuffer } },
    {
      binding: 10,
      resource: { buffer: pool.matchingCleanupControlBuffer }
    },
    { binding: 11, resource: { buffer: paramsBuffer } },
    { binding: 12, resource: { buffer: pool.energyLedgerBuffer } },
    { binding: 15, resource: diagnosticTraceResource }
  ];
  const diagnosticTerminalTraceEntries = (
    finalStateBuffer,
    mechanicsBuffer
  ) => [
    { binding: 0, resource: { buffer: finalStateBuffer } },
    { binding: 3, resource: { buffer: mechanicsBuffer } },
    { binding: 5, resource: { buffer: pool.directedPeerBuffer } },
    { binding: 6, resource: { buffer: pool.sourceOffsetBuffer } },
    { binding: 8, resource: { buffer: pool.graphControlBuffer } },
    { binding: 9, resource: { buffer: spatialSourceBuffer } },
    { binding: 11, resource: { buffer: paramsBuffer } },
    { binding: 13, resource: { buffer: pool.matchingConstraintBuffer } },
    { binding: 15, resource: diagnosticTraceResource }
  ];
  const diagnosticMaterializeTraceEntries = (
    finalStateBuffer,
    mechanicsBuffer
  ) => [
    { binding: 0, resource: { buffer: finalStateBuffer } },
    { binding: 2, resource: { buffer: authority.thermoBuffer } },
    { binding: 3, resource: { buffer: mechanicsBuffer } },
    { binding: 4, resource: { buffer: identityBuffer } },
    { binding: 5, resource: { buffer: pool.directedPeerBuffer } },
    { binding: 6, resource: { buffer: pool.sourceOffsetBuffer } },
    { binding: 9, resource: { buffer: spatialSourceBuffer } },
    { binding: 11, resource: { buffer: paramsBuffer } },
    { binding: 13, resource: { buffer: pool.matchingConstraintBuffer } },
    { binding: 15, resource: diagnosticTraceResource }
  ];
  const interfaceReceiptEntries = (
    finalStateBuffer,
    mechanicsBuffer
  ) => [
    { binding: 0, resource: { buffer: finalStateBuffer } },
    { binding: 1, resource: { buffer: authority.thermoBuffer } },
    { binding: 2, resource: { buffer: mechanicsBuffer } },
    { binding: 3, resource: { buffer: identityBuffer } },
    { binding: 4, resource: { buffer: pool.directedPeerBuffer } },
    { binding: 5, resource: { buffer: pool.sourceOffsetBuffer } },
    { binding: 6, resource: { buffer: pool.graphControlBuffer } },
    { binding: 7, resource: { buffer: pool.appendStagingBuffer } },
    { binding: 8, resource: { buffer: paramsBuffer } },
    { binding: 9, resource: { buffer: spatialSourceBuffer } }
  ];
  const applyEntries = (originalStateBuffer, finalStateBuffer, outputStateBuffer) => [
    { binding: 0, resource: { buffer: originalStateBuffer } },
    { binding: 1, resource: { buffer: finalStateBuffer } },
    { binding: 2, resource: { buffer: proposalBuffer } },
    { binding: 3, resource: { buffer: outputStateBuffer } },
    { binding: 4, resource: { buffer: pool.graphControlBuffer } },
    { binding: 5, resource: { buffer: evidenceBuffer } },
    { binding: 6, resource: { buffer: paramsBuffer } },
    { binding: 7, resource: { buffer: pool.matchingCleanupControlBuffer } }
  ];
  const bindGroup = (pipelineInfo, entries, label) => device.createBindGroup({
    label,
    layout: pipelineInfo.bindGroupLayout,
    entries
  });
  const contactTimestampActive = Boolean(
    gpuTimestampRecorder?.active === true
      && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
      && typeof gpuTimestampRecorder.endEncoderSpan === 'function'
  );
  const contactPassProfiler = createSphGpuTimestampProfiler({
    device,
    enabled: gpuPassTimestampProfilingRequested === true,
    capacity: 48,
    label: 'ulg-schroeder-spatial-mechanical-contact-passes'
  });
  // The split-pass encode below exists for timing; enter it when either
  // instrument is live.
  const contactPassSplitActive = contactTimestampActive
    || contactPassProfiler.enabled === true;
  const beginContactTimestamp = (encoder, stage) => (
    contactTimestampActive
      ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
          producerId: `schroeder-spatial-mechanical-contact-graph:${stage}`,
          stage,
          spanClass: 'same-production-command-encoder',
          generationId: authority.execution.generationId
        })
      : null
  );
  const endContactTimestamp = (encoder, token) => {
    if (token) gpuTimestampRecorder.endEncoderSpan(encoder, token);
  };

  const candidateBytesCapacity = pool.directedPairCapacity
    * pool.graphLayout.bytesPerDirectedPair;
  const consumerReceipts = Object.freeze(Object.fromEntries(
    consumerAuthentications.map((authentication) => {
      const receipt = bindSchroederSpatialExactNearResidentConsumerEvidence(
        authentication,
        Object.freeze({
          schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_SCHEMA,
          status: SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_STATUS,
          evidenceBuffer,
          controlBuffer: pool.graphControlBuffer,
          evidenceWordCount: SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS,
          candidateVisitCountWord:
            SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD
              .candidateVisitCount,
          requiredDirectedPairCountWord:
            SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD
              .requiredDirectedPairCount,
          publishedDirectedPairCountWord:
            SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD
              .publishedDirectedPairCount,
          statusFlagsWord:
            SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.statusFlags,
          pairStorageCapacityBytes: candidateBytesCapacity,
          configuredRetainedByteBudget: pool.pairGraphByteBudget,
          pairGraphSchema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
          resultCountersObserved: false,
          failClosedOnOverflow: true,
          partialPublicationAllowed: false,
          fullReadbackPerformed: false
        })
      );
      return [authentication.consumerId, receipt];
    })
  ));

  let lifecycleStatus = 'prepared';
  let encodeAttempted = false;
  let preparedScan = null;
  let encodedDispatchCount = 0;
  let encodedComputePassCount = 0;
  let released = false;
  let releaseScheduled = false;
  let releasePromise = null;
  let submissionObserved = false;
  const releaseLease = () => {
    if (released) return false;
    released = true;
    lifecycleStatus = 'released';
    if (pool.inUseGenerationId === authority.execution.generationId) {
      pool.inUseGenerationId = null;
      pool.generation = null;
      pool.releaseScheduled = false;
    }
    return true;
  };
  const releaseAfterSubmittedWork = () => {
    if (releaseScheduled || released) return false;
    releaseScheduled = true;
    lifecycleStatus = 'submission-observed';
    pool.releaseScheduled = true;
    const fence = typeof device?.queue?.onSubmittedWorkDone === 'function'
      ? Promise.resolve(device.queue.onSubmittedWorkDone())
      : Promise.resolve();
    const scanRelease = preparedScan
      ? pool.sourceCountScan.releasePreparedAfter(preparedScan, fence)
      : fence;
    releasePromise = Promise.all([fence, scanRelease]).then(
      () => {
        preparedScan = null;
        return releaseLease();
      },
      (error) => {
        releaseScheduled = false;
        lifecycleStatus = submissionObserved
          ? 'submitted'
          : (encodeAttempted ? 'encoded' : 'prepared');
        pool.releaseScheduled = false;
        releasePromise = null;
        throw error;
      }
    );
    return true;
  };
  const markSubmittedWork = () => {
    if (
      released
      || releaseScheduled
      || submissionObserved
      || lifecycleStatus !== 'encoded'
    ) return false;
    submissionObserved = true;
    lifecycleStatus = 'submitted';
    return true;
  };
  const canReleaseQueueOrdered = () => (
    released !== true
    && releaseScheduled !== true
    && submissionObserved === true
    && lifecycleStatus === 'submitted'
    && (
      !preparedScan
      || (
        typeof pool.sourceCountScan.canReleasePreparedQueueOrdered === 'function'
        && typeof pool.sourceCountScan.releasePreparedQueueOrdered === 'function'
        && pool.sourceCountScan.canReleasePreparedQueueOrdered(
          preparedScan
        ) === true
      )
    )
  );
  const releaseQueueOrdered = () => {
    if (!canReleaseQueueOrdered()) {
      throw new Error(
        'queue-ordered mechanical proposal release requires an exact submitted idle proposal'
      );
    }
    if (preparedScan) {
      const scanReleased =
        pool.sourceCountScan.releasePreparedQueueOrdered(preparedScan);
      if (scanReleased !== true) {
        throw new Error(
          'queue-ordered mechanical proposal scan owner did not confirm release'
        );
      }
      preparedScan = null;
    }
    return releaseLease();
  };
  const contactGraph = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
    status: 'schroeder-spatial-mechanical-pair-graph-prepared',
    construction:
      'single-exact-near-traversal-source-count-scan-local-rank-csr',
    retainCompleteAuthenticatedCellCliques:
      Boolean(retainCompleteAuthenticatedCellCliques),
    selectedLevel: immutableSelectedLevel,
    particleCapacity: pool.capacity,
    directedPairCapacity: pool.directedPairCapacity,
    minimumDirectedPairsPerParticle:
      SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE,
    minimumDirectedPairCapacity: pool.minimumDirectedPairCapacity,
    candidateCapacityBytes: candidateBytesCapacity,
    configuredRetainedByteBudget: pool.pairGraphByteBudget,
    retainedByteLength: pool.graphLayout.retainedByteLength,
    matchingConstraintByteLength: pool.matchingConstraintByteLength,
    matchingCleanupOwnerWorkspaceWordLength:
      pool.matchingCleanupOwnerWorkspaceWordLength,
    matchingCleanupOwnerWorkspaceByteLength:
      pool.matchingCleanupOwnerWorkspaceByteLength,
    totalRetainedByteLength: pool.totalRetainedByteLength,
    appendRecordStrideWords: 3,
    directedRowWords: 1,
    sourceCountBuffer: pool.sourceCountBuffer,
    sourceOffsetBuffer: pool.sourceOffsetBuffer,
    appendStagingBuffer: pool.appendStagingBuffer,
    directedPeerBuffer: pool.directedPeerBuffer,
    interfaceReceiptBuffer: pool.appendStagingBuffer,
    interfaceReceiptSchema:
      ULG_SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_SCHEMA,
    interfaceReceiptHeaderWords:
      SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS,
    interfaceReceiptRowWords:
      SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS,
    sourceThermoBuffer: authority.thermoBuffer,
    sourceIdentityBuffer: identityBuffer,
    identityEnabled: Boolean(authority.identityBuffer),
    phaseLineageCapacity: phaseCarrierPlan.lineageCapacity,
    phaseLaneCount: phaseCarrierPlan.phaseLaneCount,
    controlBuffer: pool.graphControlBuffer,
    matchingCleanupControlBuffer: pool.matchingCleanupControlBuffer,
    indirectDispatchBuffer: pool.indirectDispatchBuffer,
    indirectDispatchOffsetBytes: 0,
    conditionalDispatchBuffer: pool.conditionalDispatchBuffer,
    conditionalDispatchOffsetBytes:
      pool.graphLayout.conditionalDispatchOffsetBytes,
    controlDispatchSourceOffsetBytes:
      pool.graphLayout.controlDispatchEvidenceOffsetBytes,
    scratchStateABuffer: pool.scratchStateABuffer,
    scratchStateBBuffer: pool.scratchStateBBuffer,
    scaleBuffer: pool.scaleBuffer,
    energyLedgerBuffer: pool.energyLedgerBuffer,
    energyLedgerAliasedToProposalRows: true,
    energyLedgerByteOffset: MECHANICAL_PROPOSAL_HEADER_BYTES,
    energyLedgerAliasLifetime: 'solver-scratch-until-proposal-publication',
    layout: pool.graphLayout
  });
  const contactInterfaceReceipt = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_SCHEMA,
    status: 'schroeder-spatial-mechanical-interface-receipt-deferred',
    ready: true,
    generation,
    device,
    generationId: authority.execution.generationId,
    storageGeneration: authority.execution.storageGeneration,
    physicsTick: authority.execution.physicsTick,
    physicsSubstep: authority.execution.physicsSubstep,
    positionEpoch: authority.execution.positionEpoch,
    topologyEpoch: authority.execution.topologyEpoch,
    supportEpoch: authority.execution.supportEpoch,
    selectedLevel: immutableSelectedLevel,
    particleCount,
    directedPairCapacity: pool.directedPairCapacity,
    buffer: pool.appendStagingBuffer,
    bufferAliasRole:
      'post-scatter-mechanical-append-staging-interface-receipt',
    headerWords:
      SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS,
    rowWords: SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS,
    signedAreaPolicy:
      'positive-active-area-negative-inactive-interface-zero-non-interface',
    sourceThermoBuffer: authority.thermoBuffer,
    sourceIdentityBuffer: identityBuffer,
    identityEnabled: Boolean(authority.identityBuffer),
    phaseLineageCapacity: phaseCarrierPlan.lineageCapacity,
    phaseLaneCount: phaseCarrierPlan.phaseLaneCount,
    fullParticleReadbackPerformed: false,
    hostSummaryReadbackPerformed: false,
    failClosed: true,
    get released() { return released; },
    get releaseScheduled() { return releaseScheduled; }
  });
  const artifact = {
    schema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA,
    status: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS,
    ready: true,
    proposalMode: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE,
    backend: 'webgpu',
    particleCount,
    generation,
    generationId: authority.execution.generationId,
    arenaIndex: authority.execution.arenaIndex ?? 0,
    proposalCapacity: pool.capacity,
    proposalPoolCacheHit: poolAcquisition.cacheHit,
    proposalPoolAllocationCount: pool.totalBufferCreationCount,
    proposalPoolAcquisitionCount: pool.acquisitionCount + 1,
    supportEpoch: authority.execution.supportEpoch,
    selectedLevel: immutableSelectedLevel,
    encodePolicy: 'single-use-immutable-selected-level',
    sourcePositionAuthority:
      SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY,
    supportProfiles: SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS,
    multiConsumerTraversal: true,
    traversalCount: SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
    solverIterationCount: solverBudget.jacobiIterations,
    // The declared solver budget, sealed. The encoded horizon is exactly the
    // declared cleanupPassBudget: the compiled shader variant, the control
    // header words 10/11, and the receipt lanes are all derived from this
    // one declaration, and the budget-compiled pipelines verify the header
    // words on-GPU (fail-closed on mismatch).
    solverBudgetDeclared: solverBudget,
    solverBudgetSealPolicy:
      'declared-budget-compiled-into-pipeline-variants-and-verified-against-control-header-words-10-11-fail-closed',
    // Fixed (scan-independent) deferred dispatch count for the declared
    // budget: 18 bundle commands + 3 dispatches per Jacobi round + the
    // cleanup path (ceil(passes / ownerPassesPerDispatch) chunked owner
    // dispatches in production, each looping its logical passes in-shader;
    // the legacy diagnostic ping-pong encodes 5 stage dispatches plus 2
    // trace dispatches per pass and 3 terminal trace dispatches).
    encodedDeferredDispatchFloor:
      18
      + 3 * solverBudget.jacobiIterations
      + (resolvedDiagnosticTrace
        ? 7 * solverBudget.cleanupPassBudget + 3
        : solverBudget.ownerDispatches),
    matchingCleanupLogicalPassCount:
      solverBudget.cleanupPassBudget,
    matchingCleanupEncodedPassCount: resolvedDiagnosticTrace
      ? solverBudget.cleanupPassBudget
      : solverBudget.encodedPassBudget,
    matchingCleanupOwnerPassesPerDispatch: resolvedDiagnosticTrace
      ? null
      : solverBudget.ownerPassesPerDispatch,
    matchingCleanupOwnerDispatchCount: resolvedDiagnosticTrace
      ? 0
      : solverBudget.ownerDispatches,
    matchingCleanupOwnerMaxActiveParticles: resolvedDiagnosticTrace
      ? null
      : SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES,
    matchingCleanupOwnerMaxIncidentCursors: resolvedDiagnosticTrace
      ? null
      : SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS,
    matchingCleanupOwnerTerminalMaxIncidentCursors: resolvedDiagnosticTrace
      ? null
      : SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS,
    solverPolicy:
      `retained-csr-${solverBudget.jacobiIterations}-round-reciprocal-mass-tensor-bounded-velocity-jacobi-aggregate-position-trust-${solverBudget.cleanupPassBudget}-pass-logical-receipt-pre-and-post-certified-monotone-contact-wall-frontier-owner-terminal-path-contained-${solverBudget.ownerPassesPerDispatch}-passes-per-dispatch-chunked-gpu-uniform-early-tail-fail-closed-if-budget-exhausted-fused-energy-measure-nonnegative-edge-heat-final-residual-seal-then-commit`,
    aggregateHierarchyEnabled,
    aggregateAdmissionStatus,
    activeRankViewEnabled,
    activeRankViewAdmissionStatus,
    spatialProjectionMode: mechanicalProjectionVariant,
    directoryAbiVersion,
    aggregateSummaryCapability:
      aggregateHierarchyEnabled
        ? 'homogeneous-domain-summary-exact-record-status-v1'
        : (activeRankViewEnabled
          ? 'base-epoch-active-rank-prefix-source-index-v1'
          : 'not-bound-flat-canonical-directory-fallback'),
    contactGraph,
    contactInterfaceReceipt,
    graphControlBuffer: pool.graphControlBuffer,
    matchingCleanupControlBuffer: pool.matchingCleanupControlBuffer,
    indirectDispatchBuffer: pool.indirectDispatchBuffer,
    conditionalDispatchBuffer: pool.conditionalDispatchBuffer,
    sourceCountBuffer: pool.sourceCountBuffer,
    sourceOffsetBuffer: pool.sourceOffsetBuffer,
    appendStagingBuffer: pool.appendStagingBuffer,
    directedPeerBuffer: pool.directedPeerBuffer,
    interfaceReceiptBuffer: pool.appendStagingBuffer,
    interfaceReceiptSchema:
      ULG_SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_SCHEMA,
    interfaceReceiptHeaderWords:
      SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS,
    interfaceReceiptRowWords:
      SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS,
    scratchStateABuffer: pool.scratchStateABuffer,
    scratchStateBBuffer: pool.scratchStateBBuffer,
    scaleBuffer: pool.scaleBuffer,
    scaleStrideFloats: 4,
    energyLedgerBuffer: pool.energyLedgerBuffer,
    energyLedgerAliasedToProposalRows: true,
    energyLedgerByteOffset: MECHANICAL_PROPOSAL_HEADER_BYTES,
    energyLedgerAliasLifetime: 'solver-scratch-until-proposal-publication',
    energyLedgerRowStrideFloats: 8,
    diagnosticTrace: resolvedDiagnosticTrace,
    consumerAuthentications: Object.freeze([...consumerAuthentications]),
    consumerReceipts,
    consumerReceipt(consumerId) {
      return consumerReceipts[consumerId] ?? null;
    },
    proposalBuffer,
    proposalBufferSchema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_BUFFER_SCHEMA,
    proposalHeaderWords: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS,
    proposalHeaderLayout: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT,
    proposalRowByteOffset: MECHANICAL_PROPOSAL_HEADER_BYTES,
    proposalRowWords: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS,
    proposalRowStrideFloats: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_FLOATS,
    proposalBufferByteLength:
      MECHANICAL_PROPOSAL_HEADER_BYTES
        + particleCount * MECHANICAL_PROPOSAL_ROW_BYTES,
    evidence: Object.freeze({
      schema: ULG_SCHROEDER_SPATIAL_CONSUMER_GPU_EVIDENCE_SCHEMA,
      status: 'gpu-retained-contact-graph-deferred-encode-ready',
      buffer: evidenceBuffer,
      traversalBuffers: Object.freeze([evidenceBuffer]),
      scaleMeasurementBuffer: pool.scaleBuffer,
      graphControlBuffer: pool.graphControlBuffer,
      traversalCount: SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
      wordCount: SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS,
      layout: SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT,
      generationId: authority.execution.generationId,
      supportEpoch: authority.execution.supportEpoch,
      selectedLevel: immutableSelectedLevel,
      supportProfileIds: SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.map(
        ({ supportProfileId }) => supportProfileId
      ),
      privateBuildCount: 0,
      exhaustiveTraversalCount: 0,
      fixedCandidateBuildCount: 0,
      fullParticleReadbackPerformed: false
    }),
    directoryBuildCount: 0,
    sharedGenerationDirectoryBuildCount: 1,
    privateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    fixedCandidateBuildCount: 0,
    candidateBudget: null,
    candidateByteBudget: candidateBytesCapacity,
    configuredRetainedByteBudget: pool.pairGraphByteBudget,
    retainedGraphByteLength: pool.graphLayout.retainedByteLength,
    matchingConstraintByteLength: pool.matchingConstraintByteLength,
    matchingCleanupOwnerWorkspaceByteLength:
      pool.matchingCleanupOwnerWorkspaceByteLength,
    totalRetainedGraphByteLength: pool.totalRetainedByteLength,
    minimumDirectedPairsPerParticle:
      SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE,
    minimumDirectedPairCapacity: pool.minimumDirectedPairCapacity,
    directedPairCapacity: pool.directedPairCapacity,
    fullParticleReadbackPerformed: false,
    readbackMode: 'no-full-readback',
    uniformQueryLevel,
    applyLevelFilterPolicy: immutableSelectedLevel === MECHANICAL_APPLY_ALL_LEVELS
      ? 'constructor-bound-all-authenticated-levels'
      : 'constructor-bound-selected-level',
    bufferOwnership: 'device-arena-runtime-cache',
    ownsProposalBuffer: false,
    ownsEvidenceBuffer: false,
    encodeApply(encoder, {
      stateBuffer,
      mechanicsBuffer = authority.mechanicsBuffer,
      selectedLevel: requestedSelectedLevel = null
    } = {}) {
      if (released || releaseScheduled) {
        throw new Error('mechanical proposal cannot apply after arena release begins');
      }
      if (encodeAttempted) {
        throw new Error('mechanical contact graph encodeApply is single-use');
      }
      if (
        !encoder?.clearBuffer
        || !encoder?.copyBufferToBuffer
        || !encoder?.beginComputePass
      ) {
        throw new TypeError(
          'mechanical contact graph encodeApply requires a GPUCommandEncoder-like object'
        );
      }
      const canonicalStateBuffer = requireBuffer(
        device,
        stateBuffer,
        'mechanical proposal apply stateBuffer'
      );
      const canonicalMechanicsBuffer = requireBuffer(
        device,
        mechanicsBuffer,
        'mechanical proposal apply mechanicsBuffer'
      );
      const requestedLevel = requestedSelectedLevel == null
        ? MECHANICAL_APPLY_ALL_LEVELS
        : exactI32(Number(requestedSelectedLevel), 'mechanical proposal selectedLevel');
      if (requestedLevel !== immutableSelectedLevel) {
        throw new Error(
          'mechanical proposal selectedLevel must match its immutable constructor binding'
        );
      }
      const stateByteLength = particleCount * 8 * Float32Array.BYTES_PER_ELEMENT;
      if (
        Number.isFinite(canonicalStateBuffer.size)
        && canonicalStateBuffer.size < stateByteLength
      ) {
        throw new RangeError(
          'mechanical proposal apply stateBuffer is smaller than the authenticated particle state'
        );
      }
      const capturePlan = prepareMechanicalProposalCapture({
        request: captureRequest,
        device,
        particleCount,
        controlByteLength:
          pool.graphLayout.bufferLayouts.control.byteLength,
        evidenceByteLength:
          SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS
            * Uint32Array.BYTES_PER_ELEMENT,
        matchingCleanupByteLength:
          pool.graphLayout.bufferLayouts.matchingCleanupControl.byteLength
      });
      encodeAttempted = true;
      lifecycleStatus = 'encoding';
      try {
        encoder.clearBuffer(supportBuffer);
        encoder.clearBuffer(pool.sourceCountBuffer);
        encoder.clearBuffer(pool.conditionalDispatchBuffer);
        const buildTimestamp = beginContactTimestamp(encoder, 'build');
        const firstControlBindGroup = bindGroup(
          initializePipeline,
          controlEntries,
          'ulg-schroeder-spatial-mechanical-contact-graph-initialize-bind-group'
        );
        const currentBuildEntries = buildEntries(
          canonicalStateBuffer,
          canonicalMechanicsBuffer,
          { includeAggregate: aggregateHierarchyEnabled }
        );
        const currentMaterializeEntries = buildEntries(
          canonicalStateBuffer,
          canonicalMechanicsBuffer,
          { includeAggregate: aggregateHierarchyEnabled }
        );
        const supportBindGroup = bindGroup(
          reductionPipeline,
          currentBuildEntries,
          'ulg-schroeder-spatial-mechanical-contact-graph-support-bind-group'
        );
        const materializeBindGroup = bindGroup(
          materializePipeline,
          currentMaterializeEntries,
          'ulg-schroeder-spatial-mechanical-contact-graph-traversal-bind-group'
        );
        const zeroEdgeDispatch = (pass) => {
          if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
            throw new TypeError(
              'mechanical contact graph requires compute-pass indirect dispatch'
            );
          }
          pass.dispatchWorkgroupsIndirect(
            pool.conditionalDispatchBuffer,
            contactGraph.conditionalDispatchOffsetBytes
          );
        };
        if (contactTimestampActive) {
          const buildStages = [
            {
              stage: 'initialize',
              label: 'ulg-schroeder-spatial-mechanical-contact-graph-initialize',
              pipeline: initializePipeline.pipeline,
              bindGroup: firstControlBindGroup
            },
            {
              stage: 'support-reduction',
              label:
                'ulg-schroeder-spatial-mechanical-contact-graph-support-reduction',
              pipeline: reductionPipeline.pipeline,
              bindGroup: supportBindGroup
            },
            {
              stage: 'materialize',
              label: 'ulg-schroeder-spatial-mechanical-contact-graph-materialize',
              pipeline: materializePipeline.pipeline,
              bindGroup: materializeBindGroup
            }
          ];
          for (const buildStage of buildStages) {
            const stageTimestamp = beginContactTimestamp(
              encoder,
              buildStage.stage
            );
            const pass = encoder.beginComputePass({ label: buildStage.label });
            pass.setPipeline(buildStage.pipeline);
            pass.setBindGroup(0, buildStage.bindGroup);
            if (buildStage.stage === 'materialize' && activeRankViewEnabled) {
              if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
                throw new TypeError(
                  'mechanical active-rank traversal requires indirect dispatch'
                );
              }
              pass.dispatchWorkgroupsIndirect(
                activeRankView.activeRankViewBuffer,
                activeRankView.dispatchOffsetBytes
              );
            } else {
              pass.dispatchWorkgroups(workgroups);
            }
            pass.end();
            endContactTimestamp(encoder, stageTimestamp);
          }
        } else {
          const firstPass = encoder.beginComputePass({
            label: 'ulg-schroeder-spatial-mechanical-contact-graph-build'
          });
          firstPass.setPipeline(initializePipeline.pipeline);
          firstPass.setBindGroup(0, firstControlBindGroup);
          firstPass.dispatchWorkgroups(workgroups);
          firstPass.setPipeline(reductionPipeline.pipeline);
          firstPass.setBindGroup(0, supportBindGroup);
          firstPass.dispatchWorkgroups(workgroups);
          firstPass.setPipeline(materializePipeline.pipeline);
          firstPass.setBindGroup(0, materializeBindGroup);
          if (activeRankViewEnabled) {
            if (typeof firstPass.dispatchWorkgroupsIndirect !== 'function') {
              throw new TypeError(
                'mechanical active-rank traversal requires indirect dispatch'
              );
            }
            firstPass.dispatchWorkgroupsIndirect(
              activeRankView.activeRankViewBuffer,
              activeRankView.dispatchOffsetBytes
            );
          } else {
            firstPass.dispatchWorkgroups(workgroups);
          }
          firstPass.end();
        }
        endContactTimestamp(encoder, buildTimestamp);

        preparedScan = pool.sourceCountScan.prepare({
          inputBuffer: pool.sourceCountBuffer,
          outputBuffer: pool.sourceOffsetBuffer,
          elementCount: pool.capacity
        });
        const scanTimestamp = beginContactTimestamp(encoder, 'count-scan');
        pool.sourceCountScan.encodePrepared(encoder, preparedScan, {
          labelPrefix: 'ulg-schroeder-spatial-mechanical-contact-graph-counts'
        });
        endContactTimestamp(encoder, scanTimestamp);

        const finalizeTimestamp = beginContactTimestamp(encoder, 'finalize');
        const finalizePass = encoder.beginComputePass({
          label: 'ulg-schroeder-spatial-mechanical-contact-graph-finalize'
        });
        finalizePass.setPipeline(finalizeCountsPipeline.pipeline);
        finalizePass.setBindGroup(0, bindGroup(
          finalizeCountsPipeline,
          controlEntries,
          'ulg-schroeder-spatial-mechanical-contact-graph-finalize-bind-group'
        ));
        finalizePass.dispatchWorkgroups(1);
        finalizePass.end();
        endContactTimestamp(encoder, finalizeTimestamp);
        encoder.copyBufferToBuffer(
          pool.graphControlBuffer,
          pool.graphLayout.controlDispatchEvidenceOffsetBytes,
          pool.indirectDispatchBuffer,
          0,
          3 * Uint32Array.BYTES_PER_ELEMENT
        );
        encoder.copyBufferToBuffer(
          pool.graphControlBuffer,
          pool.graphLayout.conditionalDispatchSourceOffsetBytes,
          pool.conditionalDispatchBuffer,
          0,
          3 * Uint32Array.BYTES_PER_ELEMENT
        );

        const encodeScatterAndValidation = (pass) => {
          pass.setPipeline(scatterPipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            scatterPipeline,
            controlEntries,
            'ulg-schroeder-spatial-mechanical-contact-graph-scatter-bind-group'
          ));
          if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
            throw new TypeError(
              'mechanical contact graph requires compute-pass indirect dispatch'
            );
          }
          pass.dispatchWorkgroupsIndirect(
            pool.indirectDispatchBuffer,
            0
          );
          pass.setPipeline(indexPipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            indexPipeline,
            controlEntries,
            'ulg-schroeder-spatial-mechanical-contact-graph-index-bind-group'
          ));
          pass.dispatchWorkgroups(workgroups);
          pass.setPipeline(validatePipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            validatePipeline,
            controlEntries,
            'ulg-schroeder-spatial-mechanical-contact-graph-validate-bind-group'
          ));
          pass.dispatchWorkgroups(workgroups);
          const zeroContactEntries = applyEntries(
            canonicalStateBuffer,
            pool.scratchStateABuffer,
            pool.scratchStateBBuffer
          );
          pass.setPipeline(zeroContactCompletePipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            zeroContactCompletePipeline,
            zeroContactEntries,
            'ulg-schroeder-spatial-mechanical-proposal-zero-contact-complete-bind-group'
          ));
          zeroEdgeDispatch(pass);
        };
        const encodeSolverIteration = (
          pass,
          iteration,
          inputStateBuffer,
          outputStateBuffer
        ) => {
          const entries = solverIterationEntries(
            inputStateBuffer,
            outputStateBuffer,
            canonicalMechanicsBuffer,
            iteration
          );
          const iterationBindGroup = bindGroup(
            solverPipelines.measure,
            entries,
            `ulg-schroeder-spatial-mechanical-contact-graph-iteration-${iteration}-bind-group`
          );
          pass.setPipeline(solverPipelines.measure.pipeline);
          pass.setBindGroup(0, iterationBindGroup);
          pass.dispatchWorkgroups(workgroups);
          pass.setPipeline(solverPipelines.solve.pipeline);
          pass.setBindGroup(0, iterationBindGroup);
          pass.dispatchWorkgroups(workgroups);
          pass.setPipeline(solverPipelines.allocateEnergy.pipeline);
          pass.setBindGroup(0, iterationBindGroup);
          pass.dispatchWorkgroups(workgroups);
        };
        const createMatchingCleanupBindGroups = (
          cleanupInputStateBuffer,
          cleanupOutputStateBuffer,
          orientation
        ) => {
          const entries = matchingCleanupEntries(
            cleanupInputStateBuffer,
            cleanupOutputStateBuffer,
            canonicalMechanicsBuffer
          );
          return Object.freeze({
            initialize: bindGroup(
              initializeMatchingConstraintsPipeline,
              matchingConstraintInitializerEntries(
                cleanupInputStateBuffer,
                canonicalMechanicsBuffer
              ),
              `ulg-schroeder-spatial-mechanical-matching-constraints-initialize-${orientation}-bind-group`
            ),
            ...Object.fromEntries(
            Object.entries(matchingCleanupPipelines || {}).map(
              ([stage, pipeline]) => [
                stage,
                bindGroup(
                  pipeline,
                  entries,
                  `ulg-schroeder-spatial-mechanical-matching-cleanup-${stage}-${orientation}-bind-group`
                )
              ]
            )
            ),
            owner: matchingCleanupOwnerPipeline
              ? bindGroup(
                  matchingCleanupOwnerPipeline,
                  entries,
                  `ulg-schroeder-spatial-mechanical-matching-cleanup-global-owner-${orientation}-bind-group`
                )
              : null,
            restoreTrust: bindGroup(
              restoreMatchingTrustPipeline,
              entries,
              `ulg-schroeder-spatial-mechanical-matching-cleanup-restore-trust-${orientation}-bind-group`
            ),
            traceReplay: diagnosticTracePipelines
              ? bindGroup(
                  diagnosticTracePipelines.replay,
                  diagnosticRefinementReplayEntries(
                    cleanupInputStateBuffer,
                    cleanupOutputStateBuffer,
                    canonicalMechanicsBuffer
                  ),
                  `ulg-schroeder-spatial-mechanical-diagnostic-trace-refinement-replay-${orientation}-bind-group`
                )
              : null,
            traceApply: diagnosticTracePipelines
              ? bindGroup(
                  diagnosticTracePipelines.apply,
                  diagnosticApplyTraceEntries(cleanupOutputStateBuffer),
                  `ulg-schroeder-spatial-mechanical-diagnostic-trace-apply-${orientation}-bind-group`
                )
              : null
          });
        };
        const matchingCleanupBindGroups = Object.freeze({
          aToB: createMatchingCleanupBindGroups(
            pool.scratchStateABuffer,
            pool.scratchStateBBuffer,
            'a-to-b'
          ),
          bToA: createMatchingCleanupBindGroups(
            pool.scratchStateBBuffer,
            pool.scratchStateABuffer,
            'b-to-a'
          )
        });
        const matchingCleanupBindGroupsFor = (cleanupInputStateBuffer) => (
          cleanupInputStateBuffer === pool.scratchStateABuffer
            ? matchingCleanupBindGroups.aToB
            : matchingCleanupBindGroups.bToA
        );
        const encodeMatchingCleanupPass = (
          pass,
          cleanupInputStateBuffer,
          initializeConstraints = false
        ) => {
          if (!matchingCleanupPipelines) {
            throw new Error(
              'legacy mechanical matching cleanup requires diagnostic trace mode'
            );
          }
          const groups = matchingCleanupBindGroupsFor(
            cleanupInputStateBuffer
          );
          if (initializeConstraints) {
            pass.setPipeline(initializeMatchingConstraintsPipeline.pipeline);
            pass.setBindGroup(0, groups.initialize);
            pass.dispatchWorkgroups(workgroups);
          }
          for (const stage of ['select', 'copy', 'apply']) {
            const pipeline = matchingCleanupPipelines[stage];
            pass.setPipeline(pipeline.pipeline);
            pass.setBindGroup(0, groups[stage]);
            pass.dispatchWorkgroups(workgroups);
          }
          if (diagnosticTracePipelines) {
            pass.setPipeline(diagnosticTracePipelines.replay.pipeline);
            pass.setBindGroup(0, groups.traceReplay);
            pass.dispatchWorkgroups(1);
          }
          pass.setPipeline(matchingCleanupPipelines.walls.pipeline);
          pass.setBindGroup(0, groups.walls);
          pass.dispatchWorkgroups(workgroups);
          if (diagnosticTracePipelines) {
            pass.setPipeline(diagnosticTracePipelines.apply.pipeline);
            pass.setBindGroup(0, groups.traceApply);
            pass.dispatchWorkgroups(1);
          }
          pass.setPipeline(matchingCleanupPipelines.finalize.pipeline);
          pass.setBindGroup(0, groups.finalize);
          pass.dispatchWorkgroups(1);
        };
        const encodeMatchingCleanupOwner = (
          pass,
          cleanupInputStateBuffer
        ) => {
          if (!matchingCleanupOwnerPipeline) {
            throw new Error(
              'mechanical matching cleanup owner is unavailable in diagnostic trace mode'
            );
          }
          const groups = matchingCleanupBindGroupsFor(
            cleanupInputStateBuffer
          );
          pass.setPipeline(initializeMatchingConstraintsPipeline.pipeline);
          pass.setBindGroup(0, groups.initialize);
          pass.dispatchWorkgroups(workgroups);
          pass.setPipeline(matchingCleanupOwnerPipeline.pipeline);
          pass.setBindGroup(0, groups.owner);
          for (
            let ownerDispatch = 0;
            ownerDispatch
              < solverBudget.ownerDispatches;
            ownerDispatch += 1
          ) {
            pass.dispatchWorkgroups(1);
          }
        };
        const encodeMatchingTrustRestore = (
          pass,
          finalCleanupStateBuffer
        ) => {
          const groups = matchingCleanupBindGroupsFor(
            finalCleanupStateBuffer
          );
          pass.setPipeline(restoreMatchingTrustPipeline.pipeline);
          pass.setBindGroup(0, groups.restoreTrust);
          pass.dispatchWorkgroups(workgroups);
        };
        const encodeVerification = (
          pass,
          finalStateBuffer,
          outputStateBuffer
        ) => {
          const entries = solverEntries(
            finalStateBuffer,
            outputStateBuffer,
            canonicalMechanicsBuffer
          );
          const residualEntries = residualVerifyEntries(
            finalStateBuffer,
            canonicalMechanicsBuffer
          );
          pass.setPipeline(verifyEnergyPipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            verifyEnergyPipeline,
            entries,
            'ulg-schroeder-spatial-mechanical-contact-energy-verify-bind-group'
          ));
          pass.dispatchWorkgroups(1);
          pass.setPipeline(verifyPipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            verifyPipeline,
            residualEntries,
            'ulg-schroeder-spatial-mechanical-contact-residual-verify-bind-group'
          ));
          pass.dispatchWorkgroups(workgroups);
          if (diagnosticTracePipelines) {
            const diagnosticTerminalEntries =
              diagnosticTerminalTraceEntries(
                finalStateBuffer,
                canonicalMechanicsBuffer
              );
            pass.setPipeline(diagnosticTracePipelines.measure.pipeline);
            pass.setBindGroup(0, bindGroup(
              diagnosticTracePipelines.measure,
              diagnosticTerminalEntries,
              'ulg-schroeder-spatial-mechanical-diagnostic-trace-measure-bind-group'
            ));
            pass.dispatchWorkgroups(workgroups);
            pass.setPipeline(diagnosticTracePipelines.select.pipeline);
            pass.setBindGroup(0, bindGroup(
              diagnosticTracePipelines.select,
              diagnosticTerminalEntries,
              'ulg-schroeder-spatial-mechanical-diagnostic-trace-select-bind-group'
            ));
            pass.dispatchWorkgroups(workgroups);
            pass.setPipeline(diagnosticTracePipelines.materialize.pipeline);
            pass.setBindGroup(0, bindGroup(
              diagnosticTracePipelines.materialize,
              diagnosticMaterializeTraceEntries(
                finalStateBuffer,
                canonicalMechanicsBuffer
              ),
              'ulg-schroeder-spatial-mechanical-diagnostic-trace-materialize-bind-group'
            ));
            pass.dispatchWorkgroups(1);
          }
          const receiptEntries = interfaceReceiptEntries(
            finalStateBuffer,
            canonicalMechanicsBuffer
          );
          pass.setPipeline(initializeInterfaceReceiptPipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            initializeInterfaceReceiptPipeline,
            receiptEntries,
            'ulg-schroeder-spatial-mechanical-contact-interface-receipt-initialize-bind-group'
          ));
          pass.dispatchWorkgroups(1);
          pass.setPipeline(materializeInterfaceReceiptPipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            materializeInterfaceReceiptPipeline,
            receiptEntries,
            'ulg-schroeder-spatial-mechanical-contact-interface-receipt-materialize-bind-group'
          ));
          pass.dispatchWorkgroups(workgroups);
        };

        // Round zero can read the immutable canonical post-G2P state directly.
        // Keep canonical untouched until the sealed commit, then alternate the
        // remaining rounds solely between the two scratch buffers.
        let inputStateBuffer = canonicalStateBuffer;
        let outputStateBuffer = pool.scratchStateABuffer;
        const advanceSolverState = (iteration) => {
          const completedOutputBuffer = outputStateBuffer;
          outputStateBuffer = iteration === 0
            ? pool.scratchStateBBuffer
            : inputStateBuffer;
          inputStateBuffer = completedOutputBuffer;
        };
        const advanceMatchingCleanupState = () => {
          const completedOutputBuffer = outputStateBuffer;
          outputStateBuffer = inputStateBuffer;
          inputStateBuffer = completedOutputBuffer;
        };
        const legacyMatchingCleanupActive = Boolean(
          diagnosticTracePipelines
        );
        if (contactPassSplitActive) {
          const validationTimestamp = beginContactTimestamp(
            encoder,
            'scatter-validate'
          );
          const validationPass = encoder.beginComputePass({
            label: 'ulg-schroeder-spatial-mechanical-contact-graph-scatter-validate',
            ...contactPassProfiler.passDescriptorExtras('scatter-validate')
          });
          encodeScatterAndValidation(validationPass);
          validationPass.end();
          endContactTimestamp(encoder, validationTimestamp);
          for (
            let iteration = 0;
            iteration < solverBudget.jacobiIterations;
            iteration += 1
          ) {
            const iterationTimestamp = beginContactTimestamp(
              encoder,
              `iteration-${iteration}`
            );
            const iterationPass = encoder.beginComputePass({
              label:
                `ulg-schroeder-spatial-mechanical-contact-graph-iteration-${iteration}`,
              ...contactPassProfiler.passDescriptorExtras('jacobi-iterations')
            });
            encodeSolverIteration(
              iterationPass,
              iteration,
              inputStateBuffer,
              outputStateBuffer
            );
            iterationPass.end();
            endContactTimestamp(encoder, iterationTimestamp);
            advanceSolverState(iteration);
          }
          if (legacyMatchingCleanupActive) {
            for (
              let cleanupPass = 0;
              cleanupPass < solverBudget.cleanupPassBudget;
              cleanupPass += 1
            ) {
              const cleanupTimestamp = beginContactTimestamp(
                encoder,
                `matching-cleanup-${cleanupPass}`
              );
              const cleanupPassEncoder = encoder.beginComputePass({
                label:
                  `ulg-schroeder-spatial-mechanical-matching-cleanup-${cleanupPass}`
              });
              encodeMatchingCleanupPass(
                cleanupPassEncoder,
                inputStateBuffer,
                cleanupPass === 0
              );
              advanceMatchingCleanupState();
              if (
                cleanupPass + 1
                  === solverBudget.cleanupPassBudget
              ) {
                encodeMatchingTrustRestore(
                  cleanupPassEncoder,
                  inputStateBuffer
                );
              }
              cleanupPassEncoder.end();
              endContactTimestamp(encoder, cleanupTimestamp);
            }
          } else {
            const cleanupTimestamp = beginContactTimestamp(
              encoder,
              'matching-cleanup-global-owner'
            );
            const cleanupPassEncoder = encoder.beginComputePass({
              label:
                'ulg-schroeder-spatial-mechanical-matching-cleanup-global-owner',
              ...contactPassProfiler.passDescriptorExtras(
                'matching-cleanup-owner'
              )
            });
            encodeMatchingCleanupOwner(
              cleanupPassEncoder,
              inputStateBuffer
            );
            encodeMatchingTrustRestore(
              cleanupPassEncoder,
              inputStateBuffer
            );
            cleanupPassEncoder.end();
            endContactTimestamp(encoder, cleanupTimestamp);
          }
          const verificationTimestamp = beginContactTimestamp(
            encoder,
            'energy-residual-verify'
          );
          const verificationPass = encoder.beginComputePass({
            label: 'ulg-schroeder-spatial-mechanical-contact-graph-verify',
            ...contactPassProfiler.passDescriptorExtras('energy-residual-verify')
          });
          encodeVerification(
            verificationPass,
            inputStateBuffer,
            outputStateBuffer
          );
          verificationPass.end();
          endContactTimestamp(encoder, verificationTimestamp);
        } else {
          const secondPass = encoder.beginComputePass({
            label: 'ulg-schroeder-spatial-mechanical-contact-graph-solve'
          });
          encodeScatterAndValidation(secondPass);
          for (
            let iteration = 0;
            iteration < solverBudget.jacobiIterations;
            iteration += 1
          ) {
            encodeSolverIteration(
              secondPass,
              iteration,
              inputStateBuffer,
              outputStateBuffer
            );
            advanceSolverState(iteration);
          }
          if (legacyMatchingCleanupActive) {
            // Graph zero-edge completion uses conditionalDispatchBuffer as
            // indirect arguments in secondPass. Diagnostic cleanup binds that
            // buffer writable, so WebGPU requires a distinct usage scope.
            secondPass.end();
            const diagnosticCleanupPass = encoder.beginComputePass({
              label:
                'ulg-schroeder-spatial-mechanical-matching-cleanup-diagnostic'
            });
            for (
              let cleanupPass = 0;
              cleanupPass < solverBudget.cleanupPassBudget;
              cleanupPass += 1
            ) {
              encodeMatchingCleanupPass(
                diagnosticCleanupPass,
                inputStateBuffer,
                cleanupPass === 0
              );
              advanceMatchingCleanupState();
            }
            encodeMatchingTrustRestore(
              diagnosticCleanupPass,
              inputStateBuffer
            );
            encodeVerification(
              diagnosticCleanupPass,
              inputStateBuffer,
              outputStateBuffer
            );
            diagnosticCleanupPass.end();
          } else {
            // The graph's zero-edge completion reads conditionalDispatchBuffer
            // as indirect arguments above. WebGPU forbids binding that same
            // buffer writable in one compute-pass usage scope, so the owner
            // gets a distinct pass before it writes its compact workspace.
            secondPass.end();
            const cleanupPass = encoder.beginComputePass({
              label:
                'ulg-schroeder-spatial-mechanical-matching-cleanup-global-owner'
            });
            encodeMatchingCleanupOwner(cleanupPass, inputStateBuffer);
            encodeMatchingTrustRestore(cleanupPass, inputStateBuffer);
            encodeVerification(cleanupPass, inputStateBuffer, outputStateBuffer);
            cleanupPass.end();
          }
        }
        // Diagnostic replay tracks every legacy ping-pong swap. Production's
        // single global owner copies each completed output back into this
        // fixed input buffer before advancing the exact global pass clock.
        const finalStateBuffer = inputStateBuffer;

        const publishTimestamp = beginContactTimestamp(encoder, 'publish');
        const publishPass = encoder.beginComputePass({
          label: 'ulg-schroeder-spatial-mechanical-contact-graph-publish',
          ...contactPassProfiler.passDescriptorExtras('publish')
        });
        const publishEntries = applyEntries(
          canonicalStateBuffer,
          finalStateBuffer,
          outputStateBuffer
        );
        publishPass.setPipeline(publishPipeline.pipeline);
        publishPass.setBindGroup(0, bindGroup(
          publishPipeline,
          publishEntries,
          'ulg-schroeder-spatial-mechanical-proposal-publish-bind-group'
        ));
        publishPass.dispatchWorkgroups(workgroups);
        publishPass.end();
        endContactTimestamp(encoder, publishTimestamp);

        const commitTimestamp = beginContactTimestamp(encoder, 'seal-commit');
        const commitPass = encoder.beginComputePass({
          label: 'ulg-schroeder-spatial-mechanical-contact-graph-commit',
          ...contactPassProfiler.passDescriptorExtras('seal-commit')
        });
        const commitEntries = applyEntries(
          outputStateBuffer,
          finalStateBuffer,
          canonicalStateBuffer
        );
        commitPass.setPipeline(sealPipeline.pipeline);
        commitPass.setBindGroup(0, bindGroup(
          sealPipeline,
          commitEntries,
          'ulg-schroeder-spatial-mechanical-proposal-seal-bind-group'
        ));
        commitPass.dispatchWorkgroups(1);
        commitPass.setPipeline(commitPipeline.pipeline);
        commitPass.setBindGroup(0, bindGroup(
          commitPipeline,
          commitEntries,
          'ulg-schroeder-spatial-mechanical-proposal-commit-bind-group'
        ));
        commitPass.dispatchWorkgroups(workgroups);
        commitPass.setPipeline(sealInterfaceReceiptPipeline.pipeline);
        commitPass.setBindGroup(0, bindGroup(
          sealInterfaceReceiptPipeline,
          interfaceReceiptEntries(
            finalStateBuffer,
            canonicalMechanicsBuffer
          ),
          'ulg-schroeder-spatial-mechanical-contact-interface-receipt-seal-bind-group'
        ));
        commitPass.dispatchWorkgroups(1);
        commitPass.end();
        endContactTimestamp(encoder, commitTimestamp);
        if (capturePlan) {
          const history = capturePlan.layout.history;
          const historyByteOffset =
            history.byteOffset
            + capturePlan.sequenceIndex * history.strideByteLength;
          encoder.copyBufferToBuffer(
            pool.graphControlBuffer,
            0,
            capturePlan.buffer,
            historyByteOffset + history.control.byteOffset,
            history.control.byteLength
          );
          encoder.copyBufferToBuffer(
            evidenceBuffer,
            0,
            capturePlan.buffer,
            historyByteOffset + history.evidence.byteOffset,
            history.evidence.byteLength
          );
          encoder.copyBufferToBuffer(
            pool.matchingCleanupControlBuffer,
            0,
            capturePlan.buffer,
            historyByteOffset + history.matchingCleanup.byteOffset,
            history.matchingCleanup.byteLength
          );
          if (
            capturePlan.sequenceIndex
              === capturePlan.sequenceStepCount - 1
          ) {
            const finalLayout = capturePlan.layout.final;
            encoder.copyBufferToBuffer(
              canonicalStateBuffer,
              0,
              capturePlan.buffer,
              finalLayout.state.byteOffset,
              finalLayout.state.byteLength
            );
            encoder.copyBufferToBuffer(
              authority.thermoBuffer,
              0,
              capturePlan.buffer,
              finalLayout.thermo.byteOffset,
              finalLayout.thermo.byteLength
            );
            encoder.copyBufferToBuffer(
              canonicalMechanicsBuffer,
              0,
              capturePlan.buffer,
              finalLayout.mechanics.byteOffset,
              finalLayout.mechanics.byteLength
            );
            encoder.copyBufferToBuffer(
              identityBuffer,
              0,
              capturePlan.buffer,
              finalLayout.identity.byteOffset,
              finalLayout.identity.byteLength
            );
          }
        }
        encodedDispatchCount =
          18
          + 3 * solverBudget.jacobiIterations
          + (
            legacyMatchingCleanupActive
              ? 5 * solverBudget.cleanupPassBudget
              : solverBudget.ownerDispatches
          )
          + (
            diagnosticTracePipelines
              ? 2 * solverBudget.cleanupPassBudget + 3
              : 0
          )
          + preparedScan.encodedDispatchCount;
        encodedComputePassCount = contactPassSplitActive
          ? 9
            + solverBudget.jacobiIterations
            + (
              legacyMatchingCleanupActive
                ? solverBudget.cleanupPassBudget
                : 1
            )
          : 7;
        if (capturePlan) {
          capturePlan.record.lastProposal = artifact;
          capturePlan.record.nextSequenceIndex += 1;
        }
        contactPassProfiler.resolve(encoder);
        lifecycleStatus = 'encoded';
        return true;
      } catch (error) {
        if (preparedScan) {
          pool.sourceCountScan.releasePrepared(preparedScan, {
            discardedEncoder: true
          });
          preparedScan = null;
        }
        lifecycleStatus = 'encode-failed';
        throw error;
      }
    },
    cleanupTemporaryBuffersAfterSubmittedWork() {
      return false;
    },
    // Diagnostic pass-level GPU times for this proposal's compute passes.
    // Resolves after the caller's submit completes (mapAsync waits on the
    // queue); one-shot -- the profiler's query resources are destroyed
    // with the read.
    async readContactGpuPassProfile() {
      try {
        return await contactPassProfiler.read();
      } finally {
        contactPassProfiler.destroy?.();
      }
    },
    markSubmittedWork,
    canReleaseQueueOrdered,
    releaseQueueOrdered,
    releaseAfterSubmittedWork,
    destroy: releaseAfterSubmittedWork,
    get lifecycleStatus() { return lifecycleStatus; },
    get encodedDispatchCount() { return encodedDispatchCount; },
    get encodedComputePassCount() { return encodedComputePassCount; },
    get released() { return released; },
    get releaseScheduled() { return releaseScheduled; },
    get releasePromise() { return releasePromise; },
    get submissionObserved() { return submissionObserved; }
  };
  Object.freeze(artifact);
  pool.inUseGenerationId = authority.execution.generationId;
  pool.generation = generation;
  pool.releaseScheduled = false;
  pool.acquisitionCount += 1;
  liveMechanicalProposalArtifacts.add(artifact);
  return artifact;
}

export function schroederSpatialMechanicalProposalMatchesContract(
  proposal,
  { device = null, generation = null } = {}
) {
  const traversalBuffers = proposal?.evidence?.traversalBuffers;
  const contactGraph = proposal?.contactGraph;
  const contactInterfaceReceipt = proposal?.contactInterfaceReceipt;
  return Boolean(
    proposal
    && Object.isFrozen(proposal)
    && proposal.schema === ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA
    && proposal.status === SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS
    && proposal.ready === true
    && proposal.proposalMode === SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE
    && proposal.sourcePositionAuthority
      === SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY
    && proposal.encodePolicy === 'single-use-immutable-selected-level'
    && (
      proposal.lifecycleStatus === 'prepared'
      || proposal.lifecycleStatus === 'encoded'
      || proposal.lifecycleStatus === 'submitted'
    )
    && proposal.released !== true
    && proposal.releaseScheduled !== true
    && proposal.generation === generation
    && proposal.generationId === generation?.execution?.generationId
    && proposal.supportEpoch === generation?.execution?.supportEpoch
    && contactInterfaceReceipt?.schema
      === ULG_SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_SCHEMA
    && contactInterfaceReceipt.ready === true
    && contactInterfaceReceipt.generation === generation
    && contactInterfaceReceipt.device === device
    && contactInterfaceReceipt.buffer === proposal.appendStagingBuffer
    && contactInterfaceReceipt.generationId === proposal.generationId
    && contactInterfaceReceipt.supportEpoch === proposal.supportEpoch
    && contactInterfaceReceipt.selectedLevel === proposal.selectedLevel
    && contactInterfaceReceipt.particleCount === proposal.particleCount
    && contactInterfaceReceipt.fullParticleReadbackPerformed === false
    && contactInterfaceReceipt.hostSummaryReadbackPerformed === false
    && contactInterfaceReceipt.failClosed === true
    && proposal.traversalCount
      === SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT
    // The solver budget is a declared, sealed per-invocation parameter. The
    // contract requires the seal to be present and internally consistent:
    // the encoded horizon must equal the declared cleanup budget, and the
    // reported counts must match the sealed declaration exactly.
    && Number.isInteger(proposal.solverIterationCount)
    && proposal.solverIterationCount
      >= SCHROEDER_SPATIAL_MECHANICAL_JACOBI_ITERATIONS_MIN
    && proposal.solverIterationCount
      <= SCHROEDER_SPATIAL_MECHANICAL_JACOBI_ITERATIONS_MAX
    && Number.isInteger(proposal.matchingCleanupLogicalPassCount)
    && proposal.matchingCleanupLogicalPassCount
      >= SCHROEDER_SPATIAL_MECHANICAL_CLEANUP_PASS_BUDGET_MIN
    && proposal.matchingCleanupLogicalPassCount
      <= SCHROEDER_SPATIAL_MECHANICAL_CLEANUP_PASS_BUDGET_MAX
    && proposal.matchingCleanupEncodedPassCount
      === proposal.matchingCleanupLogicalPassCount
    && proposal.solverBudgetDeclared?.jacobiIterations
      === proposal.solverIterationCount
    && proposal.solverBudgetDeclared?.cleanupPassBudget
      === proposal.matchingCleanupLogicalPassCount
    && proposal.solverBudgetDeclared?.encodedPassBudget
      === proposal.matchingCleanupLogicalPassCount
    && Object.isFrozen(proposal.solverBudgetDeclared)
    && proposal.evidence?.traversalCount
      === SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT
    && Array.isArray(traversalBuffers)
    && traversalBuffers.length === 1
    && traversalBuffers[0] === proposal.evidence?.buffer
    && traversalBuffers.every((buffer) => webGpuBufferMatchesDevice(buffer, device))
    && proposal.privateBuildCount === 0
    && proposal.fixedCandidateBuildCount === 0
    && proposal.exhaustiveTraversalCount === 0
    && proposal.fullParticleReadbackPerformed === false
    && webGpuBufferMatchesDevice(proposal.proposalBuffer, device)
    && webGpuBufferMatchesDevice(proposal.evidence?.buffer, device)
    && webGpuBufferMatchesDevice(
      proposal.matchingCleanupControlBuffer,
      device
    )
    && webGpuBufferMatchesDevice(proposal.scaleBuffer, device)
    && webGpuBufferMatchesDevice(proposal.energyLedgerBuffer, device)
    && proposal.energyLedgerBuffer === proposal.proposalBuffer
    && proposal.energyLedgerAliasedToProposalRows === true
    && proposal.energyLedgerByteOffset === MECHANICAL_PROPOSAL_HEADER_BYTES
    && proposal.energyLedgerAliasLifetime
      === 'solver-scratch-until-proposal-publication'
    && webGpuBufferMatchesDevice(
      proposal.evidence?.scaleMeasurementBuffer,
      device
    )
    && contactGraph?.schema
      === ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA
    && contactGraph.status
      === 'schroeder-spatial-mechanical-pair-graph-prepared'
    && contactGraph.selectedLevel === proposal.selectedLevel
    && Number.isInteger(contactGraph.directedPairCapacity)
    && contactGraph.directedPairCapacity > 0
    && contactGraph.directedPairCapacity === proposal.directedPairCapacity
    && contactGraph.layout?.readbackRequired === false
    && webGpuBufferMatchesDevice(contactGraph.sourceCountBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.sourceOffsetBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.appendStagingBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.directedPeerBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.controlBuffer, device)
    && webGpuBufferMatchesDevice(
      contactGraph.matchingCleanupControlBuffer,
      device
    )
    && webGpuBufferMatchesDevice(contactGraph.indirectDispatchBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.conditionalDispatchBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.scratchStateABuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.scratchStateBBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.scaleBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.energyLedgerBuffer, device)
    && contactGraph.energyLedgerBuffer === proposal.proposalBuffer
    && contactGraph.energyLedgerAliasedToProposalRows === true
    && contactGraph.energyLedgerByteOffset === MECHANICAL_PROPOSAL_HEADER_BYTES
    && contactGraph.energyLedgerAliasLifetime
      === 'solver-scratch-until-proposal-publication'
    && contactGraph.controlBuffer === proposal.graphControlBuffer
    && contactGraph.matchingCleanupControlBuffer
      === proposal.matchingCleanupControlBuffer
    && contactGraph.indirectDispatchBuffer === proposal.indirectDispatchBuffer
    && contactGraph.conditionalDispatchBuffer
      === proposal.conditionalDispatchBuffer
    && contactGraph.sourceCountBuffer === proposal.sourceCountBuffer
    && contactGraph.sourceOffsetBuffer === proposal.sourceOffsetBuffer
    && contactGraph.appendStagingBuffer === proposal.appendStagingBuffer
    && contactGraph.directedPeerBuffer === proposal.directedPeerBuffer
    && contactGraph.scratchStateABuffer === proposal.scratchStateABuffer
    && contactGraph.scratchStateBBuffer === proposal.scratchStateBBuffer
    && contactGraph.scaleBuffer === proposal.scaleBuffer
    && contactGraph.energyLedgerBuffer === proposal.energyLedgerBuffer
    && typeof proposal.encodeApply === 'function'
  );
}

export function isLiveSchroederSpatialMechanicalProposal(
  proposal,
  { device = null, generation = null } = {}
) {
  return Boolean(
    liveMechanicalProposalArtifacts.has(proposal)
    && schroederSpatialMechanicalProposalMatchesContract(proposal, {
      device,
      generation
    })
  );
}
