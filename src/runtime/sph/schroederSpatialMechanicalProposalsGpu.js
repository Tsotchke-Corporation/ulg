import { cachedWebGpuBindGroup } from '../webgpuBindGroupCache.js';
import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNear.js';
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

import {
  EXPECTATION_BYTES,
  GPU_BUFFER_USAGE,
  MATCHING_CONSTRAINT_BYTES_PER_DIRECTED_PAIR,
  MECHANICAL_APPLY_ALL_LEVELS,
  MECHANICAL_PARAMS_BYTES,
  MECHANICAL_PROPOSAL_HEADER_BYTES,
  MECHANICAL_PROPOSAL_ROW_BYTES,
  MECHANICAL_SOLVER_ITERATION_PARAMS_BYTES,
  MECHANICAL_SUPPORT_HEADER_WORDS,
  MECHANICAL_SUPPORT_ROW_WORDS,
  MECHANICAL_SUPPORT_TRAILER_WORDS,
  SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET,
  SCHROEDER_SPATIAL_MECHANICAL_CLEANUP_PASS_BUDGET_MAX,
  SCHROEDER_SPATIAL_MECHANICAL_CLEANUP_PASS_BUDGET_MIN,
  SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS,
  SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION,
  SCHROEDER_SPATIAL_MECHANICAL_INTERACTIVE_SOLVER_BUDGET,
  SCHROEDER_SPATIAL_MECHANICAL_JACOBI_ITERATIONS_MAX,
  SCHROEDER_SPATIAL_MECHANICAL_JACOBI_ITERATIONS_MIN,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS,
  SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_DEFAULT,
  SCHROEDER_SPATIAL_MECHANICAL_PARALLEL_JACOBI_CLEANUP_ROUNDS_DEFAULT,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_FLOATS,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS,
  SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
  SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY,
  SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
  ULG_SCHROEDER_SPATIAL_CONSUMER_GPU_EVIDENCE_SCHEMA,
  ULG_SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_SCHEMA,
  ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_BUFFER_SCHEMA,
  ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA,
  WORKGROUP_SIZE,
  createMechanicalMatchingCleanupControlHeader,
  createMechanicalPairGraphEvidenceHeader,
  createMechanicalParamsArray,
  createMechanicalProposalCaptureLayout,
  createMechanicalProposalHeader,
  exactI32,
  exactU32,
  finiteNumber,
  liveMechanicalProposalArtifacts,
  mechanicalProposalPools,
  mechanicalSolverIterationUniformPlan,
  requireBuffer,
  resolveMechanicalDiagnosticTrace,
  resolveMechanicalProposalCaptureRequest,
  resolveMechanicalSpatialAuthority,
  resolveSchroederSpatialMechanicalSolverBudget,
  schroederSpatialMechanicalProposalActiveRankWgsl,
  schroederSpatialMechanicalProposalFlatWgsl,
  schroederSpatialMechanicalProposalV2ActiveRankWgsl,
  schroederSpatialMechanicalProposalV2FlatWgsl,
  schroederSpatialMechanicalProposalV2Wgsl,
  schroederSpatialMechanicalProposalWgsl
} from './schroederSpatialMechanicalProposalsContracts.js';

export {
  ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA,
  ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_BUFFER_SCHEMA,
  ULG_SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_SCHEMA,
  ULG_SCHROEDER_SPATIAL_CONSUMER_GPU_EVIDENCE_SCHEMA,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS,
  SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE,
  ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_CAPTURE_SCHEMA,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_CAPTURE_MODE,
  SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_VERSION,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_FLOATS,
  SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_PASSES_PER_DISPATCH,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_DISPATCHES,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_PARTICLES,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MOVED_CAPACITY,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_MAX_ACTIVE_CURSORS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_TERMINAL_MAX_ACTIVE_CURSORS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_WALL_REFINEMENT_ROUNDS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_VERSION,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_BYTES,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_VERSION,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_HEADER_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_TARGETS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_ROW_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TRACE_BYTES,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_TAIL_STATUS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TARGET_ROW_STATUS,
  SCHROEDER_SPATIAL_MECHANICAL_DIAGNOSTIC_TRACE_STATUS,
  SCHROEDER_SPATIAL_MECHANICAL_VELOCITY_RESIDUAL_TOLERANCE_M_PER_S,
  SCHROEDER_SPATIAL_MECHANICAL_RECIPROCAL_LAPLACIAN_BOUND_FACTOR,
  SCHROEDER_SPATIAL_MECHANICAL_POSITION_TRUST_DIAMETERS,
  SCHROEDER_SPATIAL_MECHANICAL_POSITION_RESIDUAL_TOLERANCE_FRACTION,
  SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_DEFAULT,
  SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE,
  SCHROEDER_SPATIAL_MECHANICAL_JACOBI_ITERATIONS_MIN,
  SCHROEDER_SPATIAL_MECHANICAL_JACOBI_ITERATIONS_MAX,
  SCHROEDER_SPATIAL_MECHANICAL_CLEANUP_PASS_BUDGET_MIN,
  SCHROEDER_SPATIAL_MECHANICAL_CLEANUP_PASS_BUDGET_MAX,
  SCHROEDER_SPATIAL_MECHANICAL_BATCH_CLEANUP_PASS_BUDGET,
  SCHROEDER_SPATIAL_MECHANICAL_INTERACTIVE_CLEANUP_PASS_BUDGET,
  SCHROEDER_SPATIAL_MECHANICAL_PARALLEL_JACOBI_CLEANUP_ROUNDS_DEFAULT,
  resolveSchroederSpatialMechanicalSolverBudget,
  SCHROEDER_SPATIAL_MECHANICAL_BATCH_SOLVER_BUDGET,
  SCHROEDER_SPATIAL_MECHANICAL_INTERACTIVE_SOLVER_BUDGET,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE,
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE,
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION,
  createSchroederSpatialMechanicalProposalCapture,
  describeSchroederSpatialMechanicalProposalCapture,
  destroySchroederSpatialMechanicalProposalCapture,
  classifySchroederSpatialMechanicalPair,
  schroederSpatialMechanicalPairRequiresUnilateralContact,
  schroederSpatialMechanicalPairSharesPhaseLineage,
  evaluateSchroederSpatialMechanicalPhaseGeometryOcclusion,
  evaluateSchroederSpatialMechanicalInterfaceFaceContact,
  evaluateSchroederSpatialMechanicalPairProposal,
  createSchroederSpatialExactNearExpectationArray,
  schroederSpatialMechanicalProposalWgsl,
  schroederSpatialMechanicalProposalV2Wgsl,
  schroederSpatialMechanicalProposalFlatWgsl,
  schroederSpatialMechanicalProposalActiveRankWgsl,
  schroederSpatialMechanicalProposalV2FlatWgsl,
  schroederSpatialMechanicalProposalV2ActiveRankWgsl
} from './schroederSpatialMechanicalProposalsContracts.js';

import {
  createSchroederSpatialMechanicalGraphSolverWgslForBudget,
  createSchroederSpatialMechanicalInterfaceReceiptWgslForBudget,
  createSchroederSpatialMechanicalProposalApplyWgslForBudget,
  schroederSpatialMechanicalGraphControlWgsl
} from './schroederSpatialMechanicalProposalsWgsl.js';

export {
  schroederSpatialMechanicalGraphControlWgsl
} from './schroederSpatialMechanicalProposalsWgsl.js';

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
  const pairGraphAbiKey = (cacheKey) => (
    `${cacheKey}.pair-graph-v${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION}`
  );
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
      cacheKey: pairGraphAbiKey(
        'ulg-schroeder-spatial-mechanical-contact-graph-initialize.v12'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-initialize',
      code: schroederSpatialMechanicalGraphControlWgsl,
      entryPoint: 'initialize_contact_graph',
      bindings: controlBindings
    },
    reduction: {
      cacheKey:
        `ulg-schroeder-spatial-mechanical-contact-graph-support-reduction.${
          mechanicalProjectionVariant
        }.directory-v${directoryAbiVersion}.v13`,
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
      cacheKey: pairGraphAbiKey(
        'ulg-schroeder-spatial-mechanical-contact-graph-finalize-counts.v12'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-finalize-counts',
      code: schroederSpatialMechanicalGraphControlWgsl,
      entryPoint: 'finalize_contact_graph_counts',
      bindings: controlBindings
    },
    scatter: {
      cacheKey: pairGraphAbiKey(
        'ulg-schroeder-spatial-mechanical-contact-graph-scatter-csr.v12'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-scatter-csr',
      code: schroederSpatialMechanicalGraphControlWgsl,
      entryPoint: 'scatter_contact_graph_csr',
      bindings: controlBindings
    },
    validate: {
      cacheKey: pairGraphAbiKey(
        'ulg-schroeder-spatial-mechanical-contact-graph-validate-csr.v14'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-validate-csr',
      code: schroederSpatialMechanicalGraphControlWgsl,
      entryPoint: 'validate_contact_graph_csr',
      bindings: controlBindings
    },
    index: {
      cacheKey: pairGraphAbiKey(
        'ulg-schroeder-spatial-mechanical-contact-graph-index-csr.v8'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-index-csr',
      code: schroederSpatialMechanicalGraphControlWgsl,
      entryPoint: 'index_contact_graph_csr',
      bindings: controlBindings
    },
    solverMeasure: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-graph-measure-runtime.v3'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-measure-runtime',
      code: solverBudgetWgsl.solver,
      entryPoint: 'measure_runtime_iteration',
      bindings: solverIterationBindings
    },
    solverSolve: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-graph-solve-runtime.v3'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-graph-solve-runtime',
      code: solverBudgetWgsl.solver,
      entryPoint: 'solve_runtime_iteration',
      bindings: solverIterationBindings
    },
    solverAllocateEnergy: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-graph-energy-allocate-runtime.v3'
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
    parallelJacobiCleanup: diagnosticTrace || !(solverBudget.parallelJacobiCleanupRounds > 0)
      ? null
      : {
        measure: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-parallel-jacobi-cleanup-measure.v1'
          ),
          label: 'ulg-schroeder-spatial-mechanical-parallel-jacobi-cleanup-measure',
          code: solverBudgetWgsl.solver,
          entryPoint: 'parallel_jacobi_cleanup_measure',
          bindings: matchingCleanupBindings
        },
        checkConverged: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-parallel-jacobi-cleanup-check-converged.v1'
          ),
          label:
            'ulg-schroeder-spatial-mechanical-parallel-jacobi-cleanup-check-converged',
          code: solverBudgetWgsl.solver,
          entryPoint: 'parallel_jacobi_cleanup_check_converged',
          bindings: matchingCleanupBindings
        },
        solve: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-parallel-jacobi-cleanup-solve.v1'
          ),
          label: 'ulg-schroeder-spatial-mechanical-parallel-jacobi-cleanup-solve',
          code: solverBudgetWgsl.solver,
          entryPoint: 'parallel_jacobi_cleanup_solve',
          bindings: matchingCleanupBindings
        },
        allocateEnergy: {
          cacheKey: budgetKey(
            'ulg-schroeder-spatial-mechanical-parallel-jacobi-cleanup-allocate-energy.v1'
          ),
          label:
            'ulg-schroeder-spatial-mechanical-parallel-jacobi-cleanup-allocate-energy',
          code: solverBudgetWgsl.solver,
          entryPoint: 'parallel_jacobi_cleanup_allocate_energy',
          bindings: matchingCleanupBindings
        }
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
        'ulg-schroeder-spatial-mechanical-contact-interface-receipt-initialize.v6'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-interface-receipt-initialize',
      code: solverBudgetWgsl.interfaceReceipt,
      entryPoint: 'initialize_contact_interface_receipt',
      bindings: interfaceReceiptBindings
    },
    materializeInterfaceReceipt: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-interface-receipt-materialize.v6'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-interface-receipt-materialize',
      code: solverBudgetWgsl.interfaceReceipt,
      entryPoint: 'materialize_contact_interface_receipt',
      bindings: interfaceReceiptBindings
    },
    sealInterfaceReceipt: {
      cacheKey: budgetKey(
        'ulg-schroeder-spatial-mechanical-contact-interface-receipt-seal.v6'
      ),
      label: 'ulg-schroeder-spatial-mechanical-contact-interface-receipt-seal',
      code: solverBudgetWgsl.interfaceReceipt,
      entryPoint: 'seal_contact_interface_receipt',
      bindings: interfaceReceiptBindings
    },
    publish: {
      cacheKey: budgetKey(pairGraphAbiKey(
        'ulg-schroeder-spatial-mechanical-proposal-publish.v12'
      )),
      label: 'ulg-schroeder-spatial-mechanical-proposal-publish',
      code: solverBudgetWgsl.apply,
      entryPoint: 'publish_contact_proposal',
      bindings: applyBindings
    },
    zeroContactComplete: {
      cacheKey: budgetKey(pairGraphAbiKey(
        'ulg-schroeder-spatial-mechanical-proposal-zero-contact-complete.v9'
      )),
      label: 'ulg-schroeder-spatial-mechanical-proposal-zero-contact-complete',
      code: solverBudgetWgsl.apply,
      entryPoint: 'complete_zero_contact_proposal',
      bindings: applyBindings
    },
    seal: {
      cacheKey: budgetKey(pairGraphAbiKey(
        'ulg-schroeder-spatial-mechanical-proposal-seal.v12'
      )),
      label: 'ulg-schroeder-spatial-mechanical-proposal-seal',
      code: solverBudgetWgsl.apply,
      entryPoint: 'seal_contact_proposal',
      bindings: applyBindings
    },
    commit: {
      cacheKey: budgetKey(pairGraphAbiKey(
        'ulg-schroeder-spatial-mechanical-proposal-commit.v12'
      )),
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

function mechanicalProposalPoolSlotOwnedBuffers(slot) {
  return [
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
  ];
}

function destroyMechanicalProposalPoolSlot(slot) {
  if (!slot || slot.destroyed === true) return false;
  for (const buffer of mechanicalProposalPoolSlotOwnedBuffers(slot)) {
    buffer?.destroy?.();
  }
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
  solverBudget = null,
  selectedLevel = MECHANICAL_APPLY_ALL_LEVELS
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
  // A shared-dt chain retains a distinct single-use proposal for each level.
  // The generation arena alone aliases those live owners.
  const key = `${exactArenaIndex}:${selectedLevel}`;
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

/**
 * Enumerate the exact device's private arena owners, including released leases.
 * This is physical allocation ownership, not a proposal-liveness receipt: the
 * cache keeps these buffers until replacement or explicit runtime destruction.
 * No allocations, queue operations, releases, or cache changes occur here.
 */
export function schroederSpatialMechanicalDeviceRuntimeAllocationOwnership(device) {
  const incomplete = (message, cause) => {
    const error = new Error(message, cause == null ? undefined : { cause });
    error.code =
      'ERR_SCHROEDER_SPATIAL_MECHANICAL_RUNTIME_ALLOCATION_OWNERSHIP_INCOMPLETE';
    return error;
  };
  if (!device || typeof device !== 'object') {
    throw incomplete('mechanical runtime allocation ownership requires the exact device');
  }
  const buffers = new Set();
  let runtimeCount = 0;
  const collect = (buffer) => {
    // Nested scan allocations may be untagged; their exact private cache owner
    // is authoritative. Reject positively branded foreign buffers, never retag.
    if (
      !buffer || typeof buffer !== 'object'
      || typeof buffer.destroy !== 'function'
      || !webGpuBufferMatchesDevice(buffer, device)
    ) throw incomplete('mechanical runtime allocation ownership does not match its device');
    buffers.add(buffer);
  };
  try {
    for (const slot of mechanicalProposalPools.get(device)?.values() ?? []) {
      if (!slot || typeof slot !== 'object') {
        throw incomplete('mechanical runtime owner slot is unavailable');
      }
      // A failed replacement can leave the old, already destroyed slot cached.
      if (slot.destroyed === true) continue;
      runtimeCount += 1;
      for (const buffer of mechanicalProposalPoolSlotOwnedBuffers(slot)) collect(buffer);
      if (typeof slot.sourceCountScan?.allocationEntries !== 'function') {
        throw incomplete('mechanical runtime scan cannot enumerate its owned allocations');
      }
      const allocations = slot.sourceCountScan.allocationEntries();
      if (!Array.isArray(allocations) || allocations.length === 0) {
        throw incomplete('mechanical runtime scan allocation list is invalid');
      }
      for (const allocation of allocations) collect(allocation?.buffer);
    }
  } catch (error) {
    if (
      error?.code
        === 'ERR_SCHROEDER_SPATIAL_MECHANICAL_RUNTIME_ALLOCATION_OWNERSHIP_INCOMPLETE'
    ) throw error;
    throw incomplete('mechanical runtime allocation enumeration failed', error);
  }
  return Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-mechanical-runtime-allocation-ownership.v0',
    status: 'mechanical-proposal-runtime-allocation-ownership-complete',
    runtimeCount,
    allocationCount: buffers.size,
    buffers: Object.freeze([...buffers])
  });
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
  cleanupPassBudget,
  contactInnerRounds = 1,
  parallelJacobiCleanupRounds = SCHROEDER_SPATIAL_MECHANICAL_PARALLEL_JACOBI_CLEANUP_ROUNDS_DEFAULT,
  unilateralVelocityImpulseHandledByMechanicsField = false
} = {}) {
  const solverBudget = resolveSchroederSpatialMechanicalSolverBudget({
    jacobiIterations,
    cleanupPassBudget,
    contactInnerRounds,
    parallelJacobiCleanupRounds
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
    particleCount,
    {
      // Tier0 retains a deliberately compact one-lane carrier family while
      // laws are quiescent. A schedule-boundary activation can enter the
      // canonical contact solver without inventing three absent companion
      // lanes; phase-changing stages still use the strict four-lane transfer
      // validator at their own boundary.
      allowLawsQuiescentSingleLane: true
    }
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
    solverBudget,
    immutableSelectedLevel
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
    unilateralVelocityImpulseHandledByMechanicsField: Boolean(unilateralVelocityImpulseHandledByMechanicsField),
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
  const parallelJacobiCleanupPipelines = pipelineDescriptors.parallelJacobiCleanup
    ? Object.freeze({
      measure: createPipeline(pipelineDescriptors.parallelJacobiCleanup.measure),
      checkConverged: createPipeline(
        pipelineDescriptors.parallelJacobiCleanup.checkConverged
      ),
      solve: createPipeline(pipelineDescriptors.parallelJacobiCleanup.solve),
      allocateEnergy: createPipeline(
        pipelineDescriptors.parallelJacobiCleanup.allocateEnergy
      )
    })
    : null;
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
    traversalControlBuffer = evidenceBuffer,
    solverSpatialRowsBuffer = spatialSourceBuffer
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
    { binding: 9, resource: { buffer: solverSpatialRowsBuffer } },
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
    ...solverEntries(
      inputStateBuffer,
      outputStateBuffer,
      mechanicsBuffer,
      evidenceBuffer,
      supportBuffer
    ),
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
    { binding: 7, resource: { buffer: pool.matchingConstraintBuffer } },
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
  const bindGroup = (pipelineInfo, entries, label) => cachedWebGpuBindGroup(device, {
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
  // Diagnostic captures and timing spans retain their original, uninterrupted
  // encoder contract. Presentation gaps are an explicit production-only option.
  const supportsSubmissionGaps = !resolvedDiagnosticTrace
    && !captureRequest
    && gpuTimestampRecorder?.active !== true
    && gpuPassTimestampProfilingRequested !== true;
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
    const statusBeforeRelease = lifecycleStatus;
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
        // A partially encoded batch is not a terminal proposal, even when its
        // retirement fence fails. Preserve its exact pre-retirement state.
        lifecycleStatus = statusBeforeRelease;
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
    interfaceReceiptBuffer: pool.matchingConstraintBuffer,
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
    buffer: pool.matchingConstraintBuffer,
    bufferAliasRole:
      'post-verification-mechanical-matching-constraint-interface-receipt',
    bufferAliasLifetime:
      'matching-constraints-through-final-residual-and-diagnostic-verification-then-interface-receipt-through-thermal-consumer-release',
    headerWords:
      SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_HEADER_WORDS,
    rowWords: SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_ROW_WORDS,
    indexAlgorithm:
      SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_ALGORITHM_SOURCE_LOCAL_LINEAR_PROBE,
    indexSlotsPerPublishedRow:
      SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_INDEX_SLOTS_PER_ROW,
    indexPolicy:
      'optional-source-local-50-percent-load-cursor-hash-independent-fail-closed-linear-fallback',
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
        : solverBudget.parallelJacobiCleanupDispatches
          + solverBudget.ownerDispatches),
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
    interfaceReceiptBuffer: pool.matchingConstraintBuffer,
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
    supportsSubmissionGaps,
    encodeApply(encoder, options = {}) {
      // Preserve the existing synchronous, single-encoder API even when a
      // caller accidentally forwards the opt-in batching flag to this method.
      return artifact.encodeApplyBatches(encoder, {
        ...options,
        submissionGaps: false
      }).next().value;
    },
    *encodeApplyBatches(encoder, {
      stateBuffer,
      mechanicsBuffer = authority.mechanicsBuffer,
      selectedLevel: requestedSelectedLevel = null,
      submissionGaps = false
    } = {}) {
      if (released || releaseScheduled) {
        throw new Error('mechanical proposal cannot apply after arena release begins');
      }
      if (encodeAttempted) {
        throw new Error('mechanical contact graph encodeApply is single-use');
      }
      const requireEncoder = (value) => {
        if (
          typeof value?.clearBuffer !== 'function'
          || typeof value?.copyBufferToBuffer !== 'function'
          || typeof value?.beginComputePass !== 'function'
        ) {
          throw new TypeError(
            'mechanical contact graph encodeApply requires a GPUCommandEncoder-like object'
          );
        }
      };
      requireEncoder(encoder);
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
      const submissionGapsEnabled = submissionGaps === true
        && supportsSubmissionGaps;
      let encoderExposed = false;
      let encodeCompleted = false;
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
            parallelMeasure: parallelJacobiCleanupPipelines
              ? bindGroup(
                  parallelJacobiCleanupPipelines.measure,
                  entries,
                  `ulg-schroeder-spatial-mechanical-parallel-jacobi-cleanup-measure-${orientation}-bind-group`
                )
              : null,
            parallelCheckConverged: parallelJacobiCleanupPipelines
              ? bindGroup(
                  parallelJacobiCleanupPipelines.checkConverged,
                  entries,
                  `ulg-schroeder-spatial-mechanical-parallel-jacobi-cleanup-check-converged-${orientation}-bind-group`
                )
              : null,
            parallelSolve: parallelJacobiCleanupPipelines
              ? bindGroup(
                  parallelJacobiCleanupPipelines.solve,
                  entries,
                  `ulg-schroeder-spatial-mechanical-parallel-jacobi-cleanup-solve-${orientation}-bind-group`
                )
              : null,
            parallelAllocateEnergy: parallelJacobiCleanupPipelines
              ? bindGroup(
                  parallelJacobiCleanupPipelines.allocateEnergy,
                  entries,
                  `ulg-schroeder-spatial-mechanical-parallel-jacobi-cleanup-allocate-energy-${orientation}-bind-group`
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
          const alternateGroups = cleanupInputStateBuffer === pool.scratchStateABuffer
            ? matchingCleanupBindGroups.bToA
            : matchingCleanupBindGroups.aToB;
          pass.setPipeline(initializeMatchingConstraintsPipeline.pipeline);
          pass.setBindGroup(0, groups.initialize);
          pass.dispatchWorkgroups(workgroups);
          if (
            parallelJacobiCleanupPipelines
            && solverBudget.parallelJacobiCleanupRounds > 0
          ) {
            for (
              let round = 0;
              round < solverBudget.parallelJacobiCleanupRounds;
              round += 1
            ) {
              const isEven = (round & 1) === 0;
              const roundGroups = isEven ? groups : alternateGroups;
              pass.setPipeline(parallelJacobiCleanupPipelines.measure.pipeline);
              pass.setBindGroup(0, roundGroups.parallelMeasure);
              pass.dispatchWorkgroups(workgroups);
              if (isEven) {
                pass.setPipeline(
                  parallelJacobiCleanupPipelines.checkConverged.pipeline
                );
                pass.setBindGroup(0, roundGroups.parallelCheckConverged);
                pass.dispatchWorkgroups(1);
              }
              pass.setPipeline(parallelJacobiCleanupPipelines.solve.pipeline);
              pass.setBindGroup(0, roundGroups.parallelSolve);
              pass.dispatchWorkgroups(workgroups);
              pass.setPipeline(
                parallelJacobiCleanupPipelines.allocateEnergy.pipeline
              );
              pass.setBindGroup(0, roundGroups.parallelAllocateEnergy);
              pass.dispatchWorkgroups(workgroups);
            }
            // Final even-parity convergence check and selection-ledger reset
            // on cleanupInputStateBuffer before any serial owner polish.
            pass.setPipeline(parallelJacobiCleanupPipelines.measure.pipeline);
            pass.setBindGroup(0, groups.parallelMeasure);
            pass.dispatchWorkgroups(workgroups);
            pass.setPipeline(
              parallelJacobiCleanupPipelines.checkConverged.pipeline
            );
            pass.setBindGroup(0, groups.parallelCheckConverged);
            pass.dispatchWorkgroups(1);
          }
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
          let secondPass = encoder.beginComputePass({
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
            if (submissionGapsEnabled && (
              (iteration + 1) % 4 === 0
              || iteration + 1 === solverBudget.jacobiIterations
            )) {
              secondPass.end();
              // The caller can submit as soon as this generator yields. Even
              // throw()/return() before resumption must therefore retain the
              // scan lease until the caller's submitted-work retirement fence.
              encoderExposed = true;
              const previousEncoder = encoder;
              encoder = yield Object.freeze({
                stage: 'jacobi-iterations',
                completedJacobiIterations: iteration + 1
              });
              if (released || releaseScheduled) {
                throw new Error(
                  'mechanical proposal cannot resume after arena release begins'
                );
              }
              requireEncoder(encoder);
              if (encoder === previousEncoder) {
                throw new TypeError(
                  'mechanical contact batch requires a fresh GPUCommandEncoder'
                );
              }
              if (iteration + 1 < solverBudget.jacobiIterations) {
                secondPass = encoder.beginComputePass({
                  label: 'ulg-schroeder-spatial-mechanical-contact-graph-solve'
                });
              }
            }
          }
          if (legacyMatchingCleanupActive) {
            // Graph zero-edge completion uses conditionalDispatchBuffer as
            // indirect arguments in secondPass. Diagnostic cleanup binds that
            // buffer writable, so WebGPU requires a distinct usage scope.
            if (!submissionGapsEnabled) secondPass.end();
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
            if (!submissionGapsEnabled) secondPass.end();
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
              : solverBudget.parallelJacobiCleanupDispatches
                + solverBudget.ownerDispatches
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
          : (submissionGapsEnabled
              ? 6 + Math.ceil(solverBudget.jacobiIterations / 4)
              : 7);
        if (capturePlan) {
          capturePlan.record.lastProposal = artifact;
          capturePlan.record.nextSequenceIndex += 1;
        }
        contactPassProfiler.resolve(encoder);
        lifecycleStatus = 'encoded';
        encodeCompleted = true;
        return true;
      } finally {
        if (!encodeCompleted) {
          if (preparedScan && !encoderExposed) {
            pool.sourceCountScan.releasePrepared(preparedScan, {
              discardedEncoder: true
            });
            preparedScan = null;
          }
          if (!released && !releaseScheduled) lifecycleStatus = 'encode-failed';
        }
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
    && contactInterfaceReceipt.buffer === proposal.interfaceReceiptBuffer
    && proposal.contactGraph?.interfaceReceiptBuffer
      === proposal.interfaceReceiptBuffer
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
