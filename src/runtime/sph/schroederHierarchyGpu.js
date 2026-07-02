import {
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
  SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_ROW_LAYOUT,
  SCHROEDER_CONSERVATION_SUMMARY_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_COUPLING_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_STATE_DELTA_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_TRANSFER_ROW_LAYOUT,
  SCHROEDER_HIERARCHY_AGGREGATE_NODE_ROW_LAYOUT,
  SCHROEDER_HIERARCHY_AGGREGATE_ROW_LAYOUT,
  SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ROW_LAYOUT,
  SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_ROW_LAYOUT,
  SCHROEDER_LAW_QUEUE_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_ROW_LAYOUT,
  SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ROW_LAYOUT,
  SCHROEDER_PHASE_VOLUME_MIGRATION_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_INDEX_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_SCHEMA,
  ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CONSERVATION_SUMMARY_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_COUPLING_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_ADMISSION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA,
  ULG_SCHROEDER_PORTABLE_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA,
  ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA,
  ULG_SCHROEDER_STATE_DELTA_MERGE_ADMISSION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  schroederHierarchyAggregateNodeBucketReduceWgsl,
  schroederHierarchyAggregateNodeReduceWgsl,
  schroederHierarchyAggregateWgsl,
  schroederActiveNodeIndexWgsl,
  schroederActiveNodeListWgsl,
  schroederActiveNodeSortedIndexWgsl,
  schroederConservationSummaryWgsl,
  schroederCrossLevelCouplingWgsl,
  schroederCrossLevelStateDeltaMergeWgsl,
  schroederCrossLevelStateDeltaWgsl,
  schroederCrossLevelTransferWgsl,
  schroederLevelAssignmentWgsl,
  schroederLawNeighborCandidateWgsl,
  schroederLawQueueWgsl,
  schroederPhaseVolumeDiagnosticSummaryWgsl,
  schroederPhaseVolumeLevelUpdateWgsl,
  schroederPhaseVolumeMigrationWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import { runMlsMpmResidentStepWithOptionalWebGpu } from './sphMlsMpmGpuStep.js';

export {
  ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_INDEX_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_SCHEMA,
  ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CONSERVATION_SUMMARY_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_COUPLING_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_ADMISSION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA,
  ULG_SCHROEDER_PORTABLE_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA,
  ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA,
  ULG_SCHROEDER_STATE_DELTA_MERGE_ADMISSION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA
};

export const SCHROEDER_ACTIVE_NODE_FLOATS = SCHROEDER_ACTIVE_NODE_ROW_LAYOUT.length;
export const SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_UINTS =
  SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_ROW_LAYOUT.length;
export const SCHROEDER_CONSERVATION_SUMMARY_FLOATS = SCHROEDER_CONSERVATION_SUMMARY_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS = SCHROEDER_CROSS_LEVEL_COUPLING_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS = SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS = SCHROEDER_CROSS_LEVEL_STATE_DELTA_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS = SCHROEDER_CROSS_LEVEL_TRANSFER_ROW_LAYOUT.length;
export const SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS = SCHROEDER_HIERARCHY_AGGREGATE_NODE_ROW_LAYOUT.length;
export const SCHROEDER_HIERARCHY_AGGREGATE_FLOATS = SCHROEDER_HIERARCHY_AGGREGATE_ROW_LAYOUT.length;
export const SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS = SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ROW_LAYOUT.length;
export const SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS = SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_ROW_LAYOUT.length;
export const SCHROEDER_LAW_QUEUE_FLOATS = SCHROEDER_LAW_QUEUE_ROW_LAYOUT.length;
export const SCHROEDER_LEVEL_ASSIGNMENT_FLOATS = SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length;
export const SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS = SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_ROW_LAYOUT.length;
export const SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS = SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ROW_LAYOUT.length;
export const SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS = SCHROEDER_PHASE_VOLUME_MIGRATION_ROW_LAYOUT.length;
export const SCHROEDER_ACTIVE_NODE_INDEX_WORKGROUP_SIZE = 64;
export const SCHROEDER_ACTIVE_NODE_SORTED_INDEX_WORKGROUP_SIZE = 64;
export const SCHROEDER_ACTIVE_NODE_WORKGROUP_SIZE = 64;
export const SCHROEDER_CONSERVATION_SUMMARY_WORKGROUP_SIZE = 64;
export const SCHROEDER_CROSS_LEVEL_COUPLING_WORKGROUP_SIZE = 64;
export const SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_WORKGROUP_SIZE = 64;
export const SCHROEDER_CROSS_LEVEL_STATE_DELTA_WORKGROUP_SIZE = 64;
export const SCHROEDER_CROSS_LEVEL_TRANSFER_WORKGROUP_SIZE = 64;
export const SCHROEDER_HIERARCHY_AGGREGATE_NODE_WORKGROUP_SIZE = 64;
export const SCHROEDER_HIERARCHY_AGGREGATE_WORKGROUP_SIZE = 64;
export const SCHROEDER_LAW_NEIGHBOR_CANDIDATE_WORKGROUP_SIZE = 64;
export const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT = 8;
export const SCHROEDER_LAW_QUEUE_WORKGROUP_SIZE = 64;
export const SCHROEDER_LEVEL_ASSIGNMENT_WORKGROUP_SIZE = 64;
export const SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_WORKGROUP_SIZE = 1;
export const SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_WORKGROUP_SIZE = 64;
export const SCHROEDER_PHASE_VOLUME_MIGRATION_WORKGROUP_SIZE = 64;
export const SCHROEDER_ACTIVE_NODE_SCOPE = 'schroeder-gpu-active-node-list';
export const SCHROEDER_ACTIVE_NODE_INDEX_SCOPE = 'schroeder-gpu-active-node-index';
export const SCHROEDER_CROSS_LEVEL_COUPLING_SCOPE = 'schroeder-gpu-cross-level-coupling';
export const SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCOPE = 'schroeder-gpu-law-neighbor-candidates';
export const SCHROEDER_LAW_QUEUE_SCOPE = 'schroeder-gpu-law-queue';
export const SCHROEDER_LEVEL_ASSIGNMENT_SCOPE = 'schroeder-gpu-level-assignment';
export const SCHROEDER_SAME_LEVEL_MECHANICS_SCOPE = 'schroeder-same-level-mls-mpm-ocean-mechanics';
export const SCHROEDER_NO_FULL_READBACK_MODE = 'no-full-readback';
export const SCHROEDER_FULL_READBACK_MODE = 'full-assignment-readback';
export const SCHROEDER_FULL_ACTIVE_NODE_READBACK_MODE = 'full-active-node-readback';
export const SCHROEDER_FULL_ACTIVE_NODE_INDEX_READBACK_MODE = 'full-active-node-index-readback';
export const SCHROEDER_FULL_ACTIVE_NODE_SORTED_INDEX_READBACK_MODE = 'full-active-node-sorted-index-readback';
export const SCHROEDER_FULL_CROSS_LEVEL_READBACK_MODE = 'full-cross-level-readback';
export const SCHROEDER_FULL_CONSERVATION_SUMMARY_READBACK_MODE = 'full-conservation-summary-readback';
export const SCHROEDER_FULL_CROSS_LEVEL_STATE_DELTA_MERGE_READBACK_MODE = 'full-cross-level-state-delta-merge-readback';
export const SCHROEDER_FULL_CROSS_LEVEL_STATE_DELTA_READBACK_MODE = 'full-cross-level-state-delta-readback';
export const SCHROEDER_FULL_CROSS_LEVEL_TRANSFER_READBACK_MODE = 'full-cross-level-transfer-readback';
export const SCHROEDER_FULL_HIERARCHY_AGGREGATE_NODE_READBACK_MODE = 'full-schroeder-hierarchy-aggregate-node-readback';
export const SCHROEDER_FULL_HIERARCHY_AGGREGATE_READBACK_MODE = 'full-schroeder-hierarchy-aggregate-readback';
export const SCHROEDER_FULL_LAW_NEIGHBOR_CANDIDATE_READBACK_MODE = 'full-schroeder-law-neighbor-candidate-readback';
export const SCHROEDER_FULL_LAW_QUEUE_READBACK_MODE = 'full-schroeder-law-queue-readback';
export const SCHROEDER_COMPACT_LAW_NEIGHBOR_DIAGNOSTIC_READBACK_MODE = 'compact-schroeder-law-neighbor-diagnostic-readback';
export const SCHROEDER_COMPACT_PHASE_VOLUME_DIAGNOSTIC_READBACK_MODE = 'compact-schroeder-phase-volume-diagnostic-summary-readback';
export const SCHROEDER_FULL_PHASE_VOLUME_LEVEL_UPDATE_READBACK_MODE = 'full-schroeder-phase-volume-level-update-readback';
export const SCHROEDER_FULL_PHASE_VOLUME_MIGRATION_READBACK_MODE = 'full-schroeder-phase-volume-migration-readback';
export const SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE = 'auto';
export const SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE = 'exact-active-node-scan';
export const SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE = 'bucketed-active-node-index';
export const SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE = 'sorted-radix-active-node-index';
export const SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_DISABLED_MODE = 'disabled';
export const SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_AUTO_MODE = 'auto';
export const SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_FORCE_MODE = 'force';
export const DEFAULT_SCHROEDER_LAW_NEIGHBOR_FALLBACK_SCAN_RATIO_THRESHOLD = 0.25;
export const DEFAULT_SCHROEDER_LAW_NEIGHBOR_BUCKET_PRESSURE_RATIO_THRESHOLD = 0.05;
export const SCHROEDER_EXACT_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE = 'gpu-exact-global-scan-o-n2';
export const SCHROEDER_BUCKETED_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE =
  'gpu-bucketed-bounded-slot-reduction';
export const SCHROEDER_AGGREGATE_NODE_REDUCTION_AUTO_MODE = 'auto';
export const DEFAULT_AGGREGATE_NODE_BUCKET_REDUCTION_MIN_ROWS = 512;
export const DEFAULT_AGGREGATE_NODE_BUCKET_SLOT_CAPACITY = 32;
export const DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY = 32;
export const SCHROEDER_LOCAL_LAW_REACTION_MASK = 1;
export const SCHROEDER_LOCAL_LAW_CONTACT_MASK = 2;
export const SCHROEDER_LOCAL_LAW_INTERFACE_MASK = 4;
export const SCHROEDER_LOCAL_LAW_QUEUE_MASK =
  SCHROEDER_LOCAL_LAW_REACTION_MASK
  | SCHROEDER_LOCAL_LAW_CONTACT_MASK
  | SCHROEDER_LOCAL_LAW_INTERFACE_MASK;
export const DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET = 64;

const DEFAULT_MIN_LEVEL = -8;
const DEFAULT_MAX_LEVEL = 8;
const DEFAULT_BASE_GRID_SPACING_M = 1;
const DEFAULT_TARGET_SUPPORT_CELLS = 1.5;
const DEFAULT_SUPPORT_RADIUS_SCALE = 1;
const DEFAULT_HYSTERESIS_BAND = 0.15;
const DEFAULT_TILE_CELL_COUNT = 8;
const DEFAULT_SUPPORT_INFLATE_CELLS = 1;
const DEFAULT_GAS_PHASE_ID = 3;
const DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD = 64;
const DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD = 1;
const DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE = 1e-4;
const SCHROEDER_STATE_DELTA_OUTPUT_FAMILY = 'schroeder-hierarchy-state-delta';
const SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY = 'schroeder-hierarchy';
const SCHROEDER_STATE_DELTA_MERGE_ADMITTED_STATUSES = new Set([
  'schroeder-state-delta-merge-admission-published',
  'schroeder-state-delta-merge-admission-admitted',
  'worker-retained-schroeder-state-delta-output-admitted',
  'accepted',
  'admitted'
]);
const SCHROEDER_PHASE_VOLUME_MIGRATION_ADMITTED_STATUSES = new Set([
  'schroeder-phase-volume-migration-admission-published',
  'schroeder-phase-volume-migration-admission-admitted',
  'worker-retained-schroeder-phase-volume-migration-output-admitted',
  'accepted',
  'admitted'
]);

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nextPowerOfTwo(value) {
  let result = 1;
  const target = Math.max(1, Math.ceil(finiteNumber(value, 1)));
  while (result < target) result *= 2;
  return result;
}

function finitePositive(value, fallback) {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
}

function normalizeAggregateNodeReductionMode(mode, aggregateRowCount) {
  const requested = String(mode || SCHROEDER_AGGREGATE_NODE_REDUCTION_AUTO_MODE);
  if (requested === SCHROEDER_EXACT_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE) {
    return SCHROEDER_EXACT_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE;
  }
  if (requested === SCHROEDER_BUCKETED_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE) {
    return SCHROEDER_BUCKETED_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE;
  }
  const rowCount = Math.max(0, Math.round(finiteNumber(aggregateRowCount, 0)));
  return rowCount >= DEFAULT_AGGREGATE_NODE_BUCKET_REDUCTION_MIN_ROWS
    ? SCHROEDER_BUCKETED_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE
    : SCHROEDER_EXACT_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE;
}

function aggregateNodeReductionModeId(mode) {
  return mode === SCHROEDER_BUCKETED_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE ? 2 : 1;
}

function aggregateNodeBucketPlan({
  aggregateRowCount = 0,
  bucketCount = null,
  bucketSlotCapacity = DEFAULT_AGGREGATE_NODE_BUCKET_SLOT_CAPACITY
} = {}) {
  const rowCount = Math.max(0, Math.round(finiteNumber(aggregateRowCount, 0)));
  const slotCapacity = Math.max(1, Math.round(finiteNumber(
    bucketSlotCapacity,
    DEFAULT_AGGREGATE_NODE_BUCKET_SLOT_CAPACITY
  )));
  const targetBucketCount = bucketCount == null
    ? Math.max(1, Math.ceil(rowCount / Math.max(1, Math.floor(slotCapacity / 2))))
    : Math.max(1, Math.round(finiteNumber(bucketCount, 1)));
  const resolvedBucketCount = nextPowerOfTwo(targetBucketCount);
  const bucketSlotCount = Math.max(1, resolvedBucketCount * slotCapacity);
  return {
    bucketCount: resolvedBucketCount,
    bucketSlotCapacity: slotCapacity,
    bucketSlotCount,
    bucketCountByteLength: Math.max(4, resolvedBucketCount * Uint32Array.BYTES_PER_ELEMENT),
    bucketSlotByteLength: Math.max(4, bucketSlotCount * Uint32Array.BYTES_PER_ELEMENT),
    rowBucketSlotByteLength: Math.max(4, rowCount * Uint32Array.BYTES_PER_ELEMENT)
  };
}

function activeNodeIndexBucketPlan({
  activeNodeCount = 0,
  bucketCount = null,
  bucketSlotCapacity = DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY
} = {}) {
  const nodeCount = Math.max(0, Math.round(finiteNumber(activeNodeCount, 0)));
  const slotCapacity = Math.max(1, Math.round(finiteNumber(
    bucketSlotCapacity,
    DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY
  )));
  const targetBucketCount = bucketCount == null
    ? Math.max(1, Math.ceil(nodeCount / Math.max(1, Math.floor(slotCapacity / 2))))
    : Math.max(1, Math.round(finiteNumber(bucketCount, 1)));
  const resolvedBucketCount = nextPowerOfTwo(targetBucketCount);
  const bucketSlotCount = Math.max(1, resolvedBucketCount * slotCapacity);
  return {
    bucketCount: resolvedBucketCount,
    bucketSlotCapacity: slotCapacity,
    bucketSlotCount,
    bucketCountByteLength: Math.max(4, resolvedBucketCount * Uint32Array.BYTES_PER_ELEMENT),
    bucketSlotByteLength: Math.max(4, bucketSlotCount * Uint32Array.BYTES_PER_ELEMENT),
    nodeBucketSlotByteLength: Math.max(4, nodeCount * Uint32Array.BYTES_PER_ELEMENT),
    overflowCounterByteLength: 4 * Uint32Array.BYTES_PER_ELEMENT
  };
}

function activeNodeSortedIndexPlan({
  activeNodeCount = 0,
  bucketCount = null
} = {}) {
  const nodeCount = Math.max(0, Math.round(finiteNumber(activeNodeCount, 0)));
  const targetBucketCount = bucketCount == null
    ? Math.max(1, nodeCount)
    : Math.max(1, Math.round(finiteNumber(bucketCount, 1)));
  const resolvedBucketCount = nextPowerOfTwo(targetBucketCount);
  const bucketRangeOffsetCount = resolvedBucketCount + 1;
  return {
    bucketCount: resolvedBucketCount,
    bucketRangeOffsetCount,
    bucketCountByteLength: Math.max(4, resolvedBucketCount * Uint32Array.BYTES_PER_ELEMENT),
    bucketCursorByteLength: Math.max(4, resolvedBucketCount * Uint32Array.BYTES_PER_ELEMENT),
    bucketRangeOffsetByteLength: Math.max(4, bucketRangeOffsetCount * Uint32Array.BYTES_PER_ELEMENT),
    sortedActiveIndexByteLength: Math.max(4, nodeCount * Uint32Array.BYTES_PER_ELEMENT),
    diagnosticCounterByteLength: 4 * Uint32Array.BYTES_PER_ELEMENT
  };
}

function clampInteger(value, min, max) {
  const rounded = Math.round(finiteNumber(value, 0));
  return Math.max(Math.round(min), Math.min(Math.round(max), rounded));
}

function assertPackedInputs({ sphParticleState, mlsMpmParticleState }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('Schroeder level assignment requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('Schroeder level assignment requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle counts must match for Schroeder level assignment');
  }
  if (!(sphParticleState.state instanceof Float32Array) || !(sphParticleState.thermo instanceof Float32Array)) {
    throw new TypeError('Schroeder level assignment requires packed Float32Array SPH state and thermo rows');
  }
  if (!(mlsMpmParticleState.mechanics instanceof Float32Array)) {
    throw new TypeError('Schroeder level assignment requires packed Float32Array MLS-MPM mechanics rows');
  }
}

function writeStorageBuffer(device, label, data) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function optionalSourceStateBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
}

function optionalSourceThermoBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
}

function optionalSourceMechanicsBuffer(mlsMpmParticleUpload) {
  return mlsMpmParticleUpload?.status === 'webgpu-uploaded' ? mlsMpmParticleUpload.mechanicsBuffer : null;
}

export function estimateSchroederLevelFromSupportRadius({
  supportRadiusM,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL
} = {}) {
  const supportRadius = finitePositive(supportRadiusM, 0);
  const baseDx = finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M);
  const targetCells = finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS);
  if (!(supportRadius > 0)) {
    return clampInteger(0, minLevel, maxLevel);
  }
  const nativeDx = supportRadius / targetCells;
  const rawLevel = Math.round(Math.log2(Math.max(nativeDx / baseDx, 1e-12)));
  return clampInteger(rawLevel, minLevel, maxLevel);
}

export function estimateSchroederLevelDeltaForVolumeRatio(volumeRatio) {
  const ratio = finitePositive(volumeRatio, 1);
  return Math.round(Math.log2(Math.cbrt(ratio)));
}

export function createSchroederLevelAssignmentParamsArray({
  particleCount = 0,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  chartId = 0,
  minSupportRadiusM = 0,
  maxSupportRadiusM = 0,
  fallbackSupportRadiusM = 0,
  hysteresisBand = DEFAULT_HYSTERESIS_BAND,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setInt32(4, Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)), true);
  view.setInt32(8, Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(16, finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M), true);
  view.setFloat32(20, finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS), true);
  view.setFloat32(24, Math.max(0, finiteNumber(supportRadiusScale, DEFAULT_SUPPORT_RADIUS_SCALE)), true);
  view.setFloat32(28, finiteNumber(chartId, 0), true);
  view.setFloat32(32, Math.max(0, finiteNumber(minSupportRadiusM, 0)), true);
  view.setFloat32(36, Math.max(0, finiteNumber(maxSupportRadiusM, 0)), true);
  view.setFloat32(40, Math.max(0, finiteNumber(fallbackSupportRadiusM, 0)), true);
  view.setFloat32(44, Math.max(0, finiteNumber(hysteresisBand, DEFAULT_HYSTERESIS_BAND)), true);
  return buffer;
}

export function createSchroederLevelAssignmentPlan({
  sphParticleState,
  mlsMpmParticleState,
  baseGridSpacingM = sphParticleState?.smoothingLengthM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  chartId = 0,
  minSupportRadiusM = 0,
  maxSupportRadiusM = 0,
  fallbackSupportRadiusM = 0,
  hysteresisBand = DEFAULT_HYSTERESIS_BAND
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const particleCount = sphParticleState.particleCount;
  const assignmentByteLength = Math.max(
    4,
    particleCount * SCHROEDER_LEVEL_ASSIGNMENT_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
    status: 'schroeder-level-assignment-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_LEVEL_ASSIGNMENT_SCOPE,
    particleCount,
    minLevel: Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)),
    maxLevel: Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)),
    baseGridSpacingM: finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M),
    targetSupportCells: finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS),
    supportRadiusScale: Math.max(0, finiteNumber(supportRadiusScale, DEFAULT_SUPPORT_RADIUS_SCALE)),
    chartId: finiteNumber(chartId, 0),
    minSupportRadiusM: Math.max(0, finiteNumber(minSupportRadiusM, 0)),
    maxSupportRadiusM: Math.max(0, finiteNumber(maxSupportRadiusM, 0)),
    fallbackSupportRadiusM: Math.max(0, finiteNumber(fallbackSupportRadiusM, 0)),
    hysteresisBand: Math.max(0, finiteNumber(hysteresisBand, DEFAULT_HYSTERESIS_BAND)),
    assignmentRowLayout: [...SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT],
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    assignmentStrideBytes: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    assignmentByteLength,
    sourceStateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    sourceThermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    sourceMechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederActiveNodeParamsArray({
  particleCount = 0,
  tileCellCount = DEFAULT_TILE_CELL_COUNT,
  supportInflateCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minTileSpacingM = 0,
  maxTileSpacingM = 0,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(tileCellCount, DEFAULT_TILE_CELL_COUNT))), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(12, 0, true);
  view.setFloat32(16, Math.max(0, finiteNumber(supportInflateCells, DEFAULT_SUPPORT_INFLATE_CELLS)), true);
  view.setFloat32(20, Math.max(0, finiteNumber(minTileSpacingM, 0)), true);
  view.setFloat32(24, Math.max(0, finiteNumber(maxTileSpacingM, 0)), true);
  view.setFloat32(28, 0, true);
  return buffer;
}

export function createSchroederActiveNodeIndexParamsArray({
  activeNodeCount = 0,
  activeNodeStrideFloats = SCHROEDER_ACTIVE_NODE_FLOATS,
  bucketCount = 0,
  bucketSlotCapacity = DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY,
  bucketSlotCount = 0,
  nodeSlotCount = 0,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(activeNodeCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    activeNodeStrideFloats,
    SCHROEDER_ACTIVE_NODE_FLOATS
  ))), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(bucketCount, 0))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    bucketSlotCapacity,
    DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY
  ))), true);
  view.setUint32(16, Math.max(0, Math.round(finiteNumber(bucketSlotCount, 0))), true);
  view.setUint32(20, Math.max(0, Math.round(finiteNumber(nodeSlotCount, 0))), true);
  view.setUint32(24, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(28, 0, true);
  view.setUint32(32, 0, true);
  view.setUint32(36, 0, true);
  view.setUint32(40, 0, true);
  view.setUint32(44, 0, true);
  view.setUint32(48, 0, true);
  view.setUint32(52, 0, true);
  view.setUint32(56, 0, true);
  view.setUint32(60, 0, true);
  return buffer;
}

export function createSchroederActiveNodeSortedIndexParamsArray({
  activeNodeCount = 0,
  activeNodeStrideFloats = SCHROEDER_ACTIVE_NODE_FLOATS,
  bucketCount = 0,
  bucketRangeOffsetCount = 0,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(activeNodeCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    activeNodeStrideFloats,
    SCHROEDER_ACTIVE_NODE_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(bucketCount, 1))), true);
  view.setUint32(12, Math.max(2, Math.round(finiteNumber(bucketRangeOffsetCount, 2))), true);
  view.setUint32(16, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(20, 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  view.setUint32(32, 0, true);
  view.setUint32(36, 0, true);
  view.setUint32(40, 0, true);
  view.setUint32(44, 0, true);
  view.setUint32(48, 0, true);
  view.setUint32(52, 0, true);
  view.setUint32(56, 0, true);
  view.setUint32(60, 0, true);
  return buffer;
}

export function createSchroederLawQueueParamsArray({
  activeNodeCount = 0,
  activeNodeStrideFloats = SCHROEDER_ACTIVE_NODE_FLOATS,
  lawQueueStrideFloats = SCHROEDER_LAW_QUEUE_FLOATS,
  flags = 0,
  enabledLawMask = SCHROEDER_LOCAL_LAW_QUEUE_MASK,
  candidateBudget = DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET,
  queueEpoch = 0,
  stateFamilyId = 1
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(activeNodeCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    activeNodeStrideFloats,
    SCHROEDER_ACTIVE_NODE_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    lawQueueStrideFloats,
    SCHROEDER_LAW_QUEUE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(16, Math.max(0, finiteNumber(enabledLawMask, SCHROEDER_LOCAL_LAW_QUEUE_MASK)), true);
  view.setFloat32(20, Math.max(0, finiteNumber(
    candidateBudget,
    DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET
  )), true);
  view.setFloat32(24, finiteNumber(queueEpoch, 0), true);
  view.setFloat32(28, finiteNumber(stateFamilyId, 1), true);
  return buffer;
}

export function createSchroederLawNeighborCandidateParamsArray({
  lawQueueCount = 0,
  activeNodeCount = 0,
  particleCount = 0,
  lawQueueStrideFloats = SCHROEDER_LAW_QUEUE_FLOATS,
  activeNodeStrideFloats = SCHROEDER_ACTIVE_NODE_FLOATS,
  neighborCandidateStrideFloats = SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS,
  sourceCandidateSpanStrideFloats = SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS,
  stateStrideFloats = SPH_GPU_PARTICLE_STATE_FLOATS,
  candidateBudget = DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET,
  enabledLawMask = SCHROEDER_LOCAL_LAW_QUEUE_MASK,
  activeNodeIndexEnabled = false,
  activeNodeIndexBucketCount = 0,
  activeNodeIndexBucketSlotCapacity = 0,
  activeNodeIndexBucketSlotCount = 0,
  activeNodeSortedIndexEnabled = false,
  activeNodeSortedIndexBucketCount = 0,
  activeNodeSortedIndexBucketRangeOffsetCount = 0,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(80);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(lawQueueCount, 0))), true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(activeNodeCount, 0))), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    lawQueueStrideFloats,
    SCHROEDER_LAW_QUEUE_FLOATS
  ))), true);
  view.setUint32(16, Math.max(1, Math.round(finiteNumber(
    activeNodeStrideFloats,
    SCHROEDER_ACTIVE_NODE_FLOATS
  ))), true);
  view.setUint32(20, Math.max(1, Math.round(finiteNumber(
    neighborCandidateStrideFloats,
    SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS
  ))), true);
  view.setUint32(24, Math.max(1, Math.round(finiteNumber(
    stateStrideFloats,
    SPH_GPU_PARTICLE_STATE_FLOATS
  ))), true);
  view.setUint32(28, Math.max(1, Math.round(finiteNumber(
    candidateBudget,
    DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET
  ))), true);
  view.setUint32(32, Math.max(0, Math.round(finiteNumber(enabledLawMask, SCHROEDER_LOCAL_LAW_QUEUE_MASK))), true);
  view.setUint32(36, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(40, Math.max(1, Math.round(finiteNumber(
    sourceCandidateSpanStrideFloats,
    SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS
  ))), true);
  view.setUint32(44, activeNodeIndexEnabled ? 1 : 0, true);
  view.setUint32(48, Math.max(0, Math.round(finiteNumber(activeNodeIndexBucketCount, 0))), true);
  view.setUint32(52, Math.max(0, Math.round(finiteNumber(activeNodeIndexBucketSlotCapacity, 0))), true);
  view.setUint32(56, Math.max(0, Math.round(finiteNumber(activeNodeIndexBucketSlotCount, 0))), true);
  view.setUint32(60, activeNodeSortedIndexEnabled ? 1 : 0, true);
  view.setUint32(64, Math.max(0, Math.round(finiteNumber(activeNodeSortedIndexBucketCount, 0))), true);
  view.setUint32(68, Math.max(0, Math.round(finiteNumber(activeNodeSortedIndexBucketRangeOffsetCount, 0))), true);
  view.setUint32(72, 0, true);
  view.setUint32(76, 0, true);
  return buffer;
}

export function createSchroederCrossLevelCouplingParamsArray({
  particleCount = 0,
  maxLevel = DEFAULT_MAX_LEVEL,
  parentLevelDelta = 1,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  couplingHaloCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minCouplingRadiusM = 0,
  maxCouplingRadiusM = 0,
  tileCellCount = DEFAULT_TILE_CELL_COUNT,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setInt32(4, Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)), true);
  view.setInt32(8, Math.max(1, Math.round(finiteNumber(parentLevelDelta, 1))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(16, finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M), true);
  view.setFloat32(20, Math.max(0, finiteNumber(couplingHaloCells, DEFAULT_SUPPORT_INFLATE_CELLS)), true);
  view.setFloat32(24, Math.max(0, finiteNumber(minCouplingRadiusM, 0)), true);
  view.setFloat32(28, Math.max(0, finiteNumber(maxCouplingRadiusM, 0)), true);
  view.setUint32(32, Math.max(1, Math.round(finiteNumber(tileCellCount, DEFAULT_TILE_CELL_COUNT))), true);
  view.setUint32(36, 0, true);
  view.setFloat32(40, 0, true);
  view.setFloat32(44, 0, true);
  return buffer;
}

export function createSchroederConservationSummaryParamsArray({
  crossLevelCandidateCount = 0,
  crossLevelStrideFloats = SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
  summaryStrideFloats = SCHROEDER_CONSERVATION_SUMMARY_FLOATS,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(crossLevelCandidateCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    crossLevelStrideFloats,
    SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    summaryStrideFloats,
    SCHROEDER_CONSERVATION_SUMMARY_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  return buffer;
}

export function createSchroederCrossLevelTransferParamsArray({
  crossLevelCandidateCount = 0,
  crossLevelStrideFloats = SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
  stateStrideFloats = SPH_GPU_PARTICLE_STATE_FLOATS,
  transferStrideFloats = SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(crossLevelCandidateCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    crossLevelStrideFloats,
    SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    stateStrideFloats,
    SPH_GPU_PARTICLE_STATE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    transferStrideFloats,
    SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS
  ))), true);
  view.setUint32(16, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(20, 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  return buffer;
}

export function createSchroederCrossLevelStateDeltaParamsArray({
  crossLevelCandidateCount = 0,
  transferStrideFloats = SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS,
  stateDeltaStrideFloats = SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(crossLevelCandidateCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    transferStrideFloats,
    SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    stateDeltaStrideFloats,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(16, 0, true);
  view.setUint32(20, 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  return buffer;
}

export function createSchroederCrossLevelStateDeltaMergeParamsArray({
  crossLevelCandidateCount = 0,
  stateDeltaStrideFloats = SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
  mergeStrideFloats = SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS,
  flags = 0,
  mergeEpoch = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(crossLevelCandidateCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    stateDeltaStrideFloats,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    mergeStrideFloats,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(16, finiteNumber(mergeEpoch, 0), true);
  view.setFloat32(20, 0, true);
  view.setFloat32(24, 0, true);
  view.setFloat32(28, 0, true);
  return buffer;
}

export function createSchroederHierarchyAggregateParamsArray({
  aggregateRowCount = 0,
  mergeStrideFloats = SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS,
  aggregateStrideFloats = SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(aggregateRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    mergeStrideFloats,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    aggregateStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(16, 0, true);
  view.setUint32(20, 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  return buffer;
}

export function createSchroederHierarchyAggregateNodeParamsArray({
  aggregateRowCount = 0,
  aggregateStrideFloats = SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
  aggregateNodeStrideFloats = SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
  flags = 0,
  bucketCount = 0,
  bucketSlotCapacity = 0,
  bucketSlotCount = 0,
  aggregateReductionMode = SCHROEDER_EXACT_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(aggregateRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    aggregateStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    aggregateNodeStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(16, Math.max(0, Math.round(finiteNumber(bucketCount, 0))), true);
  view.setUint32(20, Math.max(0, Math.round(finiteNumber(bucketSlotCapacity, 0))), true);
  view.setUint32(24, Math.max(0, Math.round(finiteNumber(bucketSlotCount, 0))), true);
  view.setUint32(28, aggregateNodeReductionModeId(aggregateReductionMode), true);
  view.setUint32(32, 0, true);
  view.setUint32(36, 0, true);
  view.setUint32(40, 0, true);
  view.setUint32(44, 0, true);
  view.setUint32(48, 0, true);
  view.setUint32(52, 0, true);
  view.setUint32(56, 0, true);
  view.setUint32(60, 0, true);
  return buffer;
}

export function createSchroederPhaseVolumeMigrationParamsArray({
  particleCount = 0,
  aggregateNodeCount = 0,
  assignmentStrideFloats = SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
  aggregateNodeStrideFloats = SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
  migrationStrideFloats = SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  flags = 0,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  coarsenLevelDeltaThreshold = DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD,
  gasPhaseId = DEFAULT_GAS_PHASE_ID,
  migrationEpoch = 0,
  aggregateResidualTolerance = DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(aggregateNodeCount, 0))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(assignmentStrideFloats, SCHROEDER_LEVEL_ASSIGNMENT_FLOATS))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    aggregateNodeStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
  ))), true);
  view.setUint32(16, Math.max(1, Math.round(finiteNumber(
    migrationStrideFloats,
    SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS
  ))), true);
  view.setInt32(20, Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)), true);
  view.setInt32(24, Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)), true);
  view.setUint32(28, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(32, finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M), true);
  view.setFloat32(36, finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS), true);
  view.setFloat32(40, Math.max(0, finiteNumber(supportRadiusScale, DEFAULT_SUPPORT_RADIUS_SCALE)), true);
  view.setFloat32(44, Math.max(1, finiteNumber(
    phaseVolumeExpandThreshold,
    DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD
  )), true);
  view.setFloat32(48, Math.max(0, finiteNumber(
    coarsenLevelDeltaThreshold,
    DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD
  )), true);
  view.setFloat32(52, finiteNumber(gasPhaseId, DEFAULT_GAS_PHASE_ID), true);
  view.setFloat32(56, finiteNumber(migrationEpoch, 0), true);
  view.setFloat32(60, Math.max(0, finiteNumber(
    aggregateResidualTolerance,
    DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE
  )), true);
  return buffer;
}

export function createSchroederPhaseVolumeLevelUpdateParamsArray({
  migrationRowCount = 0,
  migrationStrideFloats = SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
  levelUpdateStrideFloats = SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
  admissionApproved = false,
  stateFamilyId = 1,
  migrationEpoch = 0,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(migrationRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    migrationStrideFloats,
    SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    levelUpdateStrideFloats,
    SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS
  ))), true);
  view.setUint32(12, admissionApproved ? 1 : 0, true);
  view.setFloat32(16, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(20, finiteNumber(migrationEpoch, 0), true);
  view.setUint32(24, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(28, 0, true);
  return buffer;
}

export function createSchroederPhaseVolumeDiagnosticSummaryParamsArray({
  levelUpdateRowCount = 0,
  levelUpdateStrideFloats = SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
  summaryStrideFloats = SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS,
  flags = 0,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  migrationEpoch = 0,
  stateFamilyId = 1
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(levelUpdateRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    levelUpdateStrideFloats,
    SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    summaryStrideFloats,
    SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(16, Math.max(1, finiteNumber(
    phaseVolumeExpandThreshold,
    DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD
  )), true);
  view.setFloat32(20, finiteNumber(migrationEpoch, 0), true);
  view.setFloat32(24, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(28, 0, true);
  return buffer;
}

function assertLevelAssignmentInput(levelAssignment) {
  if (
    levelAssignment?.schema !== ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA
    && levelAssignment?.schema !== ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA
  ) {
    throw new TypeError('Schroeder active node list requires a Schroeder level assignment input');
  }
  const particleCount = Math.max(0, Math.round(finiteNumber(levelAssignment.particleCount, 0)));
  if (particleCount <= 0) {
    throw new RangeError('Schroeder active node list requires at least one level-assigned particle');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    levelAssignment.assignmentStrideFloats,
    SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
  )));
  if (stride !== SCHROEDER_LEVEL_ASSIGNMENT_FLOATS) {
    throw new RangeError('Schroeder active node list requires the current level-assignment row layout');
  }
}

function assertActiveNodeListInput(activeNodeList, particleCount) {
  if (
    activeNodeList?.schema !== ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA
    && activeNodeList?.schema !== ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA
  ) {
    throw new TypeError('Schroeder cross-level coupling requires a Schroeder active-node input');
  }
  const activeCandidateCount = Math.max(0, Math.round(finiteNumber(activeNodeList.activeCandidateCount, 0)));
  if (activeCandidateCount !== particleCount) {
    throw new RangeError('Schroeder cross-level coupling requires active-node rows for every level-assigned particle');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    activeNodeList.activeNodeStrideFloats,
    SCHROEDER_ACTIVE_NODE_FLOATS
  )));
  if (stride !== SCHROEDER_ACTIVE_NODE_FLOATS) {
    throw new RangeError('Schroeder cross-level coupling requires the current active-node row layout');
  }
}

function assertLawQueueActiveNodeInput(activeNodeList) {
  if (
    activeNodeList?.schema !== ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA
    && activeNodeList?.schema !== ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA
  ) {
    throw new TypeError('Schroeder law queue requires a Schroeder active-node input');
  }
  const activeNodeCount = Math.max(0, Math.round(finiteNumber(
    activeNodeList.activeCandidateCount ?? activeNodeList.particleCount,
    0
  )));
  if (activeNodeCount <= 0) {
    throw new RangeError('Schroeder law queue requires at least one active-node row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    activeNodeList.activeNodeStrideFloats,
    SCHROEDER_ACTIVE_NODE_FLOATS
  )));
  if (stride !== SCHROEDER_ACTIVE_NODE_FLOATS) {
    throw new RangeError('Schroeder law queue requires the current active-node row layout');
  }
}

function assertLawQueueInput(lawQueue) {
  if (
    lawQueue?.schema !== ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA
    && lawQueue?.schema !== ULG_SCHROEDER_LAW_QUEUE_SCHEMA
  ) {
    throw new TypeError('Schroeder law-neighbor candidates require a Schroeder law queue input');
  }
  const lawQueueCount = Math.max(0, Math.round(finiteNumber(
    lawQueue.activeNodeCount ?? lawQueue.lawQueueCount ?? lawQueue.lawQueueRowCount,
    0
  )));
  if (lawQueueCount <= 0) {
    throw new RangeError('Schroeder law-neighbor candidates require at least one law queue row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    lawQueue.lawQueueStrideFloats,
    SCHROEDER_LAW_QUEUE_FLOATS
  )));
  if (stride !== SCHROEDER_LAW_QUEUE_FLOATS) {
    throw new RangeError('Schroeder law-neighbor candidates require the current law queue row layout');
  }
}

function assertLawNeighborActiveNodeInput(activeNodeList) {
  if (
    activeNodeList?.schema !== ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA
    && activeNodeList?.schema !== ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA
  ) {
    throw new TypeError('Schroeder law-neighbor candidates require a Schroeder active-node input');
  }
  const activeNodeCount = Math.max(0, Math.round(finiteNumber(
    activeNodeList.activeCandidateCount ?? activeNodeList.particleCount,
    0
  )));
  if (activeNodeCount <= 0) {
    throw new RangeError('Schroeder law-neighbor candidates require at least one active-node row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    activeNodeList.activeNodeStrideFloats,
    SCHROEDER_ACTIVE_NODE_FLOATS
  )));
  if (stride !== SCHROEDER_ACTIVE_NODE_FLOATS) {
    throw new RangeError('Schroeder law-neighbor candidates require the current active-node row layout');
  }
}

function assertLawNeighborActiveNodeIndexInput(activeNodeIndex) {
  if (
    activeNodeIndex?.schema !== ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA
    && activeNodeIndex?.schema !== ULG_SCHROEDER_ACTIVE_NODE_INDEX_SCHEMA
  ) {
    throw new TypeError('Schroeder law-neighbor candidates require a Schroeder active-node index input');
  }
  const activeNodeCount = Math.max(0, Math.round(finiteNumber(activeNodeIndex.activeNodeCount, 0)));
  if (activeNodeCount <= 0) {
    throw new RangeError('Schroeder law-neighbor active-node index requires at least one active-node row');
  }
  const bucketSlotCapacity = Math.max(0, Math.round(finiteNumber(activeNodeIndex.bucketSlotCapacity, 0)));
  const bucketSlotCount = Math.max(0, Math.round(finiteNumber(activeNodeIndex.bucketSlotCount, 0)));
  if (bucketSlotCapacity <= 0 || bucketSlotCount <= 0) {
    throw new RangeError('Schroeder law-neighbor active-node index requires non-empty bucket slots');
  }
}

function assertLawNeighborActiveNodeSortedIndexInput(activeNodeSortedIndex) {
  if (
    activeNodeSortedIndex?.schema !== ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA
    && activeNodeSortedIndex?.schema !== ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_SCHEMA
  ) {
    throw new TypeError('Schroeder law-neighbor candidates require a Schroeder sorted active-node index input');
  }
  const activeNodeCount = Math.max(0, Math.round(finiteNumber(activeNodeSortedIndex.activeNodeCount, 0)));
  if (activeNodeCount <= 0) {
    throw new RangeError('Schroeder law-neighbor sorted active-node index requires at least one active-node row');
  }
  const bucketCount = Math.max(0, Math.round(finiteNumber(activeNodeSortedIndex.bucketCount, 0)));
  const bucketRangeOffsetCount = Math.max(0, Math.round(finiteNumber(
    activeNodeSortedIndex.bucketRangeOffsetCount,
    0
  )));
  if (bucketCount <= 0 || bucketRangeOffsetCount < bucketCount + 1) {
    throw new RangeError('Schroeder law-neighbor sorted active-node index requires bucket range offsets');
  }
}

function normalizeLawNeighborTraversalPolicyMode(mode) {
  const resolved = String(mode || SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE);
  if (resolved === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE) {
    return SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE;
  }
  if (resolved === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE) {
    return SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE;
  }
  if (resolved === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE) {
    return SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE;
  }
  return SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE;
}

function normalizeActiveNodeSortedIndexPolicyMode(mode) {
  const resolved = String(mode || SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_AUTO_MODE);
  if (resolved === SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_DISABLED_MODE) {
    return SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_DISABLED_MODE;
  }
  if (resolved === SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_FORCE_MODE) {
    return SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_FORCE_MODE;
  }
  return SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_AUTO_MODE;
}

export function decodeSchroederLawNeighborTraversalDiagnostics(counters = []) {
  const source = ArrayBuffer.isView(counters) || Array.isArray(counters) ? counters : [];
  const read = (index) => Math.max(0, Math.round(finiteNumber(source[index], 0)));
  return {
    candidateInvocationCount: read(0),
    bucketIndexAttemptCount: read(1),
    bucketSelectedCount: read(2),
    exactFallbackScanCount: read(3),
    exactFallbackSelectedCount: read(4),
    inactiveCandidateCount: read(5),
    bucketPressureCount: read(6),
    sourceSpanWriteCount: read(7)
  };
}

export function createSchroederLawNeighborTraversalPolicy({
  lawNeighborCandidates = null,
  diagnosticCounters = lawNeighborCandidates?.diagnosticCounters,
  activeNodeIndexEnabled = lawNeighborCandidates?.activeNodeIndexEnabled ?? false,
  activeNodeSortedIndexEnabled = lawNeighborCandidates?.activeNodeSortedIndexEnabled ?? false,
  lawQueueCount = lawNeighborCandidates?.lawQueueCount ?? 0,
  candidateBudget = lawNeighborCandidates?.candidateBudget ?? DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET,
  activeNodeIndexBucketCount = lawNeighborCandidates?.activeNodeIndexBucketCount ?? 0,
  traversalPolicyMode = lawNeighborCandidates?.traversalPolicyMode
    ?? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE,
  fallbackScanRatioThreshold = DEFAULT_SCHROEDER_LAW_NEIGHBOR_FALLBACK_SCAN_RATIO_THRESHOLD,
  bucketPressureRatioThreshold = DEFAULT_SCHROEDER_LAW_NEIGHBOR_BUCKET_PRESSURE_RATIO_THRESHOLD,
  sortedRadixTraversalAvailable = false
} = {}) {
  if (
    lawNeighborCandidates
    && lawNeighborCandidates.schema !== ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA
    && lawNeighborCandidates.schema !== ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA
  ) {
    throw new TypeError('Schroeder law-neighbor traversal policy requires law-neighbor candidate input');
  }
  const mode = normalizeLawNeighborTraversalPolicyMode(traversalPolicyMode);
  const diagnostics = decodeSchroederLawNeighborTraversalDiagnostics(diagnosticCounters);
  const diagnosticCountersAvailable = (
    (ArrayBuffer.isView(diagnosticCounters) || Array.isArray(diagnosticCounters))
    && diagnosticCounters.length >= SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT
  );
  const resolvedLawQueueCount = Math.max(0, Math.round(finiteNumber(lawQueueCount, 0)));
  const resolvedCandidateBudget = Math.max(1, Math.round(finiteNumber(
    candidateBudget,
    DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET
  )));
  const expectedCandidateInvocationCount = resolvedLawQueueCount * resolvedCandidateBudget;
  const fallbackDenominator = Math.max(
    1,
    diagnostics.bucketIndexAttemptCount || diagnostics.candidateInvocationCount || expectedCandidateInvocationCount
  );
  const bucketPressureDenominator = Math.max(
    1,
    diagnostics.bucketIndexAttemptCount || diagnostics.candidateInvocationCount || activeNodeIndexBucketCount || resolvedLawQueueCount
  );
  const bucketHitRatio = diagnosticCountersAvailable
    ? diagnostics.bucketSelectedCount / Math.max(1, diagnostics.bucketIndexAttemptCount)
    : 0;
  const exactFallbackScanRatio = diagnosticCountersAvailable
    ? diagnostics.exactFallbackScanCount / fallbackDenominator
    : 0;
  const bucketPressureRatio = diagnosticCountersAvailable
    ? diagnostics.bucketPressureCount / bucketPressureDenominator
    : 0;
  const fallbackThreshold = Math.max(0, finiteNumber(
    fallbackScanRatioThreshold,
    DEFAULT_SCHROEDER_LAW_NEIGHBOR_FALLBACK_SCAN_RATIO_THRESHOLD
  ));
  const bucketPressureThreshold = Math.max(0, finiteNumber(
    bucketPressureRatioThreshold,
    DEFAULT_SCHROEDER_LAW_NEIGHBOR_BUCKET_PRESSURE_RATIO_THRESHOLD
  ));
  const appliedTraversalIndexMode = activeNodeSortedIndexEnabled
    ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE
    : (activeNodeIndexEnabled
    ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE
    : SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE);
  const forcedSortedRadix = mode === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE;
  const forcedBucket = mode === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE;
  const forcedExactScan = mode === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE;
  const diagnosticSortedRadixPressure = diagnosticCountersAvailable
    && mode === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE
    && (
      exactFallbackScanRatio > fallbackThreshold
      || bucketPressureRatio > bucketPressureThreshold
    );
  const sortedRadixIndexRequired = forcedSortedRadix || diagnosticSortedRadixPressure;
  const recommendedTraversalIndexMode = sortedRadixIndexRequired
    ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE
    : (forcedExactScan
      ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE
      : (forcedBucket && activeNodeIndexEnabled
        ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE
        : appliedTraversalIndexMode));
  const selectedTraversalIndexMode = (
    sortedRadixIndexRequired && (sortedRadixTraversalAvailable || activeNodeSortedIndexEnabled)
  )
    ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE
    : recommendedTraversalIndexMode === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE
      ? appliedTraversalIndexMode
      : (recommendedTraversalIndexMode === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE
        && activeNodeIndexEnabled
        ? appliedTraversalIndexMode
        : recommendedTraversalIndexMode);
  const sortedRadixIndexStatus = activeNodeSortedIndexEnabled
    ? 'sorted-radix-active-node-index-selected'
    : (sortedRadixIndexRequired
    ? (sortedRadixTraversalAvailable
      ? 'sorted-radix-active-node-index-selected'
      : 'sorted-radix-active-node-index-required-pending-implementation')
    : 'sorted-radix-active-node-index-not-required');
  let traversalPolicyStatus = 'traversal-policy-auto-within-diagnostic-thresholds';
  if (forcedSortedRadix) {
    traversalPolicyStatus = 'traversal-policy-forced-sorted-radix-index';
  } else if (!diagnosticCountersAvailable) {
    traversalPolicyStatus = 'traversal-policy-pending-compact-diagnostic-counters';
  } else if (diagnosticSortedRadixPressure) {
    traversalPolicyStatus = 'traversal-policy-diagnostics-require-sorted-radix-index';
  } else if (forcedExactScan) {
    traversalPolicyStatus = 'traversal-policy-forced-exact-active-node-scan';
  } else if (forcedBucket) {
    traversalPolicyStatus = activeNodeIndexEnabled
      ? 'traversal-policy-forced-bucketed-active-node-index'
      : 'traversal-policy-forced-bucketed-index-unavailable-using-exact-scan';
  }
  return {
    status: traversalPolicyStatus,
    policyMode: mode,
    appliedTraversalIndexMode,
    recommendedTraversalIndexMode,
    selectedTraversalIndexMode,
    sortedRadixIndexRequired,
    sortedRadixIndexStatus,
    sortedRadixTraversalAvailable: Boolean(sortedRadixTraversalAvailable || activeNodeSortedIndexEnabled),
    diagnosticCountersAvailable,
    diagnosticReadbackRecommended: !diagnosticCountersAvailable
      && mode === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE,
    diagnostics,
    ratios: {
      bucketHitRatio,
      exactFallbackScanRatio,
      bucketPressureRatio
    },
    thresholds: {
      fallbackScanRatioThreshold: fallbackThreshold,
      bucketPressureRatioThreshold: bucketPressureThreshold
    },
    fullParticleReadbackRequired: false,
    stateAuthorityStatus: 'state-manager-admission-required-before-traversal-policy-mutation'
  };
}

export function createSchroederActiveNodeSortedIndexSelection({
  activeNodeSortedIndex = null,
  enableActiveNodeSortedIndex = false,
  activeNodeSortedIndexPolicyMode = SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_AUTO_MODE,
  lawNeighborTraversalPolicyMode = SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE,
  lawNeighborTraversalDiagnosticCounters = null,
  lawNeighborCandidates = null,
  activeNodeIndexEnabled = lawNeighborCandidates?.activeNodeIndexEnabled ?? false,
  activeNodeIndexBucketCount = lawNeighborCandidates?.activeNodeIndexBucketCount ?? 0,
  lawQueueCount = lawNeighborCandidates?.lawQueueCount ?? 0,
  candidateBudget = lawNeighborCandidates?.candidateBudget ?? DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET,
  fallbackScanRatioThreshold = DEFAULT_SCHROEDER_LAW_NEIGHBOR_FALLBACK_SCAN_RATIO_THRESHOLD,
  bucketPressureRatioThreshold = DEFAULT_SCHROEDER_LAW_NEIGHBOR_BUCKET_PRESSURE_RATIO_THRESHOLD,
  sortedRadixTraversalAvailable = false
} = {}) {
  const policyMode = normalizeActiveNodeSortedIndexPolicyMode(activeNodeSortedIndexPolicyMode);
  const traversalPolicyMode = normalizeLawNeighborTraversalPolicyMode(lawNeighborTraversalPolicyMode);
  const diagnosticCounters = lawNeighborTraversalDiagnosticCounters ?? lawNeighborCandidates?.diagnosticCounters ?? null;
  const suppliedRetainedIndex = Boolean(activeNodeSortedIndex);
  const forcedByLegacyFlag = Boolean(enableActiveNodeSortedIndex);
  const forcedByUseCaseConfig = policyMode === SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_FORCE_MODE;
  const disabledByUseCaseConfig = policyMode === SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_DISABLED_MODE;
  const forcedByTraversalPolicy = traversalPolicyMode === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE;
  const traversalPolicy = createSchroederLawNeighborTraversalPolicy({
    diagnosticCounters,
    activeNodeIndexEnabled,
    activeNodeSortedIndexEnabled: suppliedRetainedIndex,
    lawQueueCount,
    candidateBudget,
    activeNodeIndexBucketCount,
    traversalPolicyMode,
    fallbackScanRatioThreshold,
    bucketPressureRatioThreshold,
    sortedRadixTraversalAvailable: Boolean(sortedRadixTraversalAvailable || suppliedRetainedIndex)
  });
  const diagnosticDrivenBuild = (
    policyMode === SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_AUTO_MODE
    && traversalPolicyMode === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE
    && traversalPolicy.sortedRadixIndexRequired
  );
  const policyAllowsBuild = !disabledByUseCaseConfig || forcedByLegacyFlag || suppliedRetainedIndex;
  const selected = suppliedRetainedIndex
    || forcedByLegacyFlag
    || (policyAllowsBuild && (
      forcedByUseCaseConfig
      || forcedByTraversalPolicy
      || diagnosticDrivenBuild
    ));
  const shouldBuild = selected && !suppliedRetainedIndex;

  let status = 'active-node-sorted-index-policy-auto-kept-bucket-or-exact-traversal';
  let buildReason = 'sorted-radix-index-not-selected';
  if (suppliedRetainedIndex) {
    status = 'active-node-sorted-index-policy-supplied-retained-index';
    buildReason = 'supplied-retained-active-node-sorted-index';
  } else if (forcedByLegacyFlag) {
    status = 'active-node-sorted-index-policy-forced-by-enable-flag';
    buildReason = 'legacy-enable-active-node-sorted-index-flag';
  } else if (disabledByUseCaseConfig) {
    status = 'active-node-sorted-index-policy-disabled-by-use-case-config';
    buildReason = 'peercompute-use-case-disabled-sorted-radix-index';
  } else if (forcedByUseCaseConfig) {
    status = 'active-node-sorted-index-policy-forced-by-use-case-config';
    buildReason = 'peercompute-use-case-forced-sorted-radix-index';
  } else if (forcedByTraversalPolicy) {
    status = 'active-node-sorted-index-policy-forced-by-traversal-policy';
    buildReason = 'law-neighbor-traversal-policy-forced-sorted-radix-index';
  } else if (diagnosticDrivenBuild) {
    status = 'active-node-sorted-index-policy-selected-by-traversal-diagnostics';
    buildReason = 'compact-law-neighbor-diagnostics-require-sorted-radix-index';
  } else if (traversalPolicy.diagnosticReadbackRecommended) {
    status = 'active-node-sorted-index-policy-pending-compact-diagnostics';
    buildReason = 'compact-law-neighbor-diagnostic-counters-needed';
  }

  return {
    policyMode,
    status,
    selected,
    shouldBuild,
    suppliedRetainedIndex,
    buildReason,
    forcedByUseCaseConfig,
    forcedByLegacyFlag,
    forcedByTraversalPolicy,
    disabledByUseCaseConfig,
    diagnosticDrivenBuild,
    diagnosticCountersAvailable: traversalPolicy.diagnosticCountersAvailable,
    diagnosticReadbackRecommended: traversalPolicy.diagnosticReadbackRecommended,
    traversalPolicyStatus: traversalPolicy.status,
    traversalPolicyMode: traversalPolicy.policyMode,
    recommendedTraversalIndexMode: traversalPolicy.recommendedTraversalIndexMode,
    selectedTraversalIndexMode: selected
      ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE
      : traversalPolicy.selectedTraversalIndexMode,
    sortedRadixIndexRequired: traversalPolicy.sortedRadixIndexRequired || forcedByTraversalPolicy || forcedByUseCaseConfig,
    sortedRadixIndexStatus: selected
      ? 'sorted-radix-active-node-index-selected-for-construction'
      : traversalPolicy.sortedRadixIndexStatus,
    sortedRadixTraversalAvailable: Boolean(sortedRadixTraversalAvailable || suppliedRetainedIndex || selected),
    diagnostics: traversalPolicy.diagnostics,
    ratios: traversalPolicy.ratios,
    thresholds: traversalPolicy.thresholds,
    peerComputeConfigStatus: disabledByUseCaseConfig && !forcedByLegacyFlag && !suppliedRetainedIndex
      ? 'peercompute-use-case-config-disables-sorted-radix-index'
      : 'peercompute-use-case-config-allows-sorted-radix-index',
    fullParticleReadbackRequired: false
  };
}

function assertCrossLevelCouplingInput(crossLevelCoupling) {
  if (
    crossLevelCoupling?.schema !== ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA
    && crossLevelCoupling?.schema !== ULG_SCHROEDER_CROSS_LEVEL_COUPLING_SCHEMA
  ) {
    throw new TypeError('Schroeder conservation summary requires a Schroeder cross-level coupling input');
  }
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelCoupling.crossLevelCandidateCount, 0)));
  if (candidateCount <= 0) {
    throw new RangeError('Schroeder conservation summary requires at least one cross-level candidate');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    crossLevelCoupling.crossLevelStrideFloats,
    SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS
  )));
  if (stride !== SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS) {
    throw new RangeError('Schroeder conservation summary requires the current cross-level row layout');
  }
}

function assertSphParticleStateInput(sphParticleState) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('Schroeder cross-level transfer requires a packed SPH GPU particle buffer');
  }
  if (!(sphParticleState.state instanceof Float32Array)) {
    throw new TypeError('Schroeder cross-level transfer requires packed Float32Array SPH state rows');
  }
}

function assertCrossLevelTransferInput(crossLevelTransfer) {
  if (
    crossLevelTransfer?.schema !== ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA
    && crossLevelTransfer?.schema !== ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_SCHEMA
  ) {
    throw new TypeError('Schroeder cross-level state delta requires a Schroeder cross-level transfer input');
  }
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelTransfer.crossLevelCandidateCount, 0)));
  if (candidateCount <= 0) {
    throw new RangeError('Schroeder cross-level state delta requires at least one transfer candidate');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    crossLevelTransfer.transferStrideFloats,
    SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS
  )));
  if (stride !== SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS) {
    throw new RangeError('Schroeder cross-level state delta requires the current transfer row layout');
  }
}

function assertCrossLevelStateDeltaInput(crossLevelStateDelta) {
  if (
    crossLevelStateDelta?.schema !== ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA
    && crossLevelStateDelta?.schema !== ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_SCHEMA
  ) {
    throw new TypeError('Schroeder cross-level state-delta merge requires a Schroeder cross-level state-delta input');
  }
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelStateDelta.crossLevelCandidateCount, 0)));
  if (candidateCount <= 0) {
    throw new RangeError('Schroeder cross-level state-delta merge requires at least one pending state-delta row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    crossLevelStateDelta.stateDeltaStrideFloats,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS
  )));
  if (stride !== SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS) {
    throw new RangeError('Schroeder cross-level state-delta merge requires the current state-delta row layout');
  }
}

function schroederStateDeltaMergeAdmissionDescriptor(admission = null) {
  if (!admission || typeof admission !== 'object') return null;
  return admission.schroederStateDeltaPublication
    || admission.admittedSchroederStateDeltaPublication
    || admission.publication
    || admission.descriptor
    || admission;
}

export function schroederStateDeltaMergeAdmissionAllowsApplication({
  stateDeltaMergeAdmission = null,
  crossLevelStateDelta = null,
  stateDeltaRowCount = 0
} = {}) {
  const descriptor = schroederStateDeltaMergeAdmissionDescriptor(stateDeltaMergeAdmission);
  const status = stateDeltaMergeAdmission?.status || descriptor?.status || null;
  const descriptorStatus = descriptor?.status
    || stateDeltaMergeAdmission?.publicationStatus
    || stateDeltaMergeAdmission?.admittedStatus
    || status;
  const outputFamilies = Array.isArray(stateDeltaMergeAdmission?.outputFamilies)
    ? stateDeltaMergeAdmission.outputFamilies
    : (Array.isArray(descriptor?.outputFamilies) ? descriptor.outputFamilies : []);
  const admittedRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      stateDeltaMergeAdmission?.schroederStateDeltaRowCount
        ?? descriptor?.schroederStateDeltaRowCount
        ?? stateDeltaMergeAdmission?.stateDeltaRowCount
        ?? descriptor?.stateDeltaRowCount,
      stateDeltaRowCount
    ))
  );
  const requiredRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      crossLevelStateDelta?.crossLevelCandidateCount,
      stateDeltaRowCount
    ))
  );
  const admissionApproved = stateDeltaMergeAdmission?.stateDeltaMergeApproved === true;
  const descriptorAdmitted = SCHROEDER_STATE_DELTA_MERGE_ADMITTED_STATUSES.has(descriptorStatus)
    || descriptor?.committed === true
    || stateDeltaMergeAdmission?.committed === true;
  const familyAccepted = outputFamilies.includes(SCHROEDER_STATE_DELTA_OUTPUT_FAMILY);
  const rowCountAccepted = admittedRowCount >= requiredRowCount || requiredRowCount === 0;
  return {
    schema: ULG_SCHROEDER_STATE_DELTA_MERGE_ADMISSION_SCHEMA,
    status: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted
      ? 'schroeder-state-delta-merge-admission-approved'
      : 'schroeder-state-delta-merge-admission-blocked',
    approved: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted,
    admissionApproved,
    descriptorAdmitted,
    descriptorStatus,
    familyAccepted,
    rowCountAccepted,
    stateDeltaRowCount: admittedRowCount,
    requiredStateDeltaRowCount: requiredRowCount,
    sourceHotBufferKey: stateDeltaMergeAdmission?.sourceHotBufferKey
      || stateDeltaMergeAdmission?.hotBufferKey
      || descriptor?.sourceHotBufferKey
      || descriptor?.hotBufferKey
      || null,
    outputFamilies: [...outputFamilies]
  };
}

function schroederPhaseVolumeMigrationAdmissionDescriptor(admission = null) {
  if (!admission || typeof admission !== 'object') return null;
  return admission.schroederPhaseVolumeMigrationPublication
    || admission.admittedSchroederPhaseVolumeMigrationPublication
    || admission.publication
    || admission.descriptor
    || admission;
}

export function schroederPhaseVolumeMigrationAdmissionAllowsApplication({
  phaseVolumeMigrationAdmission = null,
  phaseVolumeMigration = null,
  migrationRowCount = 0
} = {}) {
  const descriptor = schroederPhaseVolumeMigrationAdmissionDescriptor(phaseVolumeMigrationAdmission);
  const status = phaseVolumeMigrationAdmission?.status || descriptor?.status || null;
  const descriptorStatus = descriptor?.status
    || phaseVolumeMigrationAdmission?.publicationStatus
    || phaseVolumeMigrationAdmission?.admittedStatus
    || status;
  const outputFamilies = Array.isArray(phaseVolumeMigrationAdmission?.outputFamilies)
    ? phaseVolumeMigrationAdmission.outputFamilies
    : (Array.isArray(descriptor?.outputFamilies) ? descriptor.outputFamilies : []);
  const admittedRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      phaseVolumeMigrationAdmission?.schroederPhaseVolumeMigrationRowCount
        ?? descriptor?.schroederPhaseVolumeMigrationRowCount
        ?? phaseVolumeMigrationAdmission?.migrationRowCount
        ?? descriptor?.migrationRowCount,
      migrationRowCount
    ))
  );
  const requiredRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      phaseVolumeMigration?.particleCount,
      migrationRowCount
    ))
  );
  const admissionApproved = phaseVolumeMigrationAdmission?.phaseVolumeMigrationApproved === true;
  const descriptorAdmitted = SCHROEDER_PHASE_VOLUME_MIGRATION_ADMITTED_STATUSES.has(descriptorStatus)
    || descriptor?.committed === true
    || phaseVolumeMigrationAdmission?.committed === true;
  const familyAccepted = outputFamilies.includes('schroeder-phase-volume-migration');
  const rowCountAccepted = admittedRowCount >= requiredRowCount || requiredRowCount === 0;
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_ADMISSION_SCHEMA,
    status: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted
      ? 'schroeder-phase-volume-migration-admission-approved'
      : 'schroeder-phase-volume-migration-admission-blocked',
    approved: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted,
    admissionApproved,
    descriptorAdmitted,
    descriptorStatus,
    familyAccepted,
    rowCountAccepted,
    migrationRowCount: admittedRowCount,
    requiredMigrationRowCount: requiredRowCount,
    sourceHotBufferKey: phaseVolumeMigrationAdmission?.sourceHotBufferKey
      || phaseVolumeMigrationAdmission?.hotBufferKey
      || descriptor?.sourceHotBufferKey
      || descriptor?.hotBufferKey
      || null,
    outputFamilies: [...outputFamilies]
  };
}

function assertCrossLevelStateDeltaMergeInput(crossLevelStateDeltaMerge) {
  if (
    crossLevelStateDeltaMerge?.schema !== ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA
    && crossLevelStateDeltaMerge?.schema !== ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_SCHEMA
  ) {
    throw new TypeError('Schroeder hierarchy aggregate requires an admitted cross-level state-delta merge input');
  }
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelStateDeltaMerge.crossLevelCandidateCount, 0)));
  if (candidateCount <= 0) {
    throw new RangeError('Schroeder hierarchy aggregate requires at least one admitted merge row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    crossLevelStateDeltaMerge.mergeStrideFloats,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS
  )));
  if (stride !== SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS) {
    throw new RangeError('Schroeder hierarchy aggregate requires the current merge row layout');
  }
}

function assertHierarchyAggregateInput(hierarchyAggregate) {
  if (
    hierarchyAggregate?.schema !== ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA
    && hierarchyAggregate?.schema !== ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA
  ) {
    throw new TypeError('Schroeder hierarchy aggregate-node reduction requires a Schroeder hierarchy aggregate input');
  }
  const aggregateRowCount = Math.max(0, Math.round(finiteNumber(hierarchyAggregate.aggregateRowCount, 0)));
  if (aggregateRowCount <= 0) {
    throw new RangeError('Schroeder hierarchy aggregate-node reduction requires at least one aggregate contribution row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregate.aggregateStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_FLOATS
  )));
  if (stride !== SCHROEDER_HIERARCHY_AGGREGATE_FLOATS) {
    throw new RangeError('Schroeder hierarchy aggregate-node reduction requires the current aggregate contribution row layout');
  }
}

function assertHierarchyAggregateNodeInput(hierarchyAggregateNode) {
  if (
    hierarchyAggregateNode?.schema !== ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA
    && hierarchyAggregateNode?.schema !== ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA
  ) {
    throw new TypeError('Schroeder phase-volume migration requires a Schroeder hierarchy aggregate-node input');
  }
  const aggregateNodeCount = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregateNode.aggregateNodeCount ?? hierarchyAggregateNode.aggregateRowCount,
    0
  )));
  if (aggregateNodeCount <= 0) {
    throw new RangeError('Schroeder phase-volume migration requires at least one aggregate-node row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregateNode.aggregateNodeStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
  )));
  if (stride !== SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS) {
    throw new RangeError('Schroeder phase-volume migration requires the current aggregate-node row layout');
  }
}

function assertPhaseVolumeMigrationInput(phaseVolumeMigration) {
  if (
    phaseVolumeMigration?.schema !== ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA
    && phaseVolumeMigration?.schema !== ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA
  ) {
    throw new TypeError('Schroeder phase-volume level update requires a Schroeder phase-volume migration input');
  }
  const migrationRowCount = Math.max(0, Math.round(finiteNumber(phaseVolumeMigration.particleCount, 0)));
  if (migrationRowCount <= 0) {
    throw new RangeError('Schroeder phase-volume level update requires at least one migration row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    phaseVolumeMigration.migrationStrideFloats,
    SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS
  )));
  if (stride !== SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS) {
    throw new RangeError('Schroeder phase-volume level update requires the current migration row layout');
  }
}

function assertPhaseVolumeLevelUpdateInput(phaseVolumeLevelUpdate) {
  if (
    phaseVolumeLevelUpdate?.schema !== ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA
    && phaseVolumeLevelUpdate?.schema !== ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA
  ) {
    throw new TypeError('Schroeder phase-volume diagnostic summary requires a Schroeder phase-volume level-update input');
  }
  const migrationRowCount = Math.max(0, Math.round(finiteNumber(phaseVolumeLevelUpdate.migrationRowCount, 0)));
  if (migrationRowCount <= 0) {
    throw new RangeError('Schroeder phase-volume diagnostic summary requires at least one level-update row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    phaseVolumeLevelUpdate.levelUpdateStrideFloats,
    SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS
  )));
  if (stride !== SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS) {
    throw new RangeError('Schroeder phase-volume diagnostic summary requires the current level-update row layout');
  }
}

export function createSchroederActiveNodeListPlan({
  levelAssignment,
  tileCellCount = DEFAULT_TILE_CELL_COUNT,
  supportInflateCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minTileSpacingM = 0,
  maxTileSpacingM = 0
} = {}) {
  assertLevelAssignmentInput(levelAssignment);
  const particleCount = Math.max(0, Math.round(finiteNumber(levelAssignment.particleCount, 0)));
  const activeNodeByteLength = Math.max(
    4,
    particleCount * SCHROEDER_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
    status: 'schroeder-active-node-list-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_ACTIVE_NODE_SCOPE,
    sourceAssignmentSchema: levelAssignment.schema,
    sourceAssignmentStatus: levelAssignment.status ?? null,
    particleCount,
    activeCandidateCount: particleCount,
    tileCellCount: Math.max(1, Math.round(finiteNumber(tileCellCount, DEFAULT_TILE_CELL_COUNT))),
    supportInflateCells: Math.max(0, finiteNumber(supportInflateCells, DEFAULT_SUPPORT_INFLATE_CELLS)),
    minTileSpacingM: Math.max(0, finiteNumber(minTileSpacingM, 0)),
    maxTileSpacingM: Math.max(0, finiteNumber(maxTileSpacingM, 0)),
    assignmentRowLayout: [...SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT],
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    activeNodeRowLayout: [...SCHROEDER_ACTIVE_NODE_ROW_LAYOUT],
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeStrideBytes: SCHROEDER_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    activeNodeByteLength,
    outputCompaction: 'unsorted-one-row-per-particle-tile-range',
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederActiveNodeIndexPlan({
  activeNodeList,
  bucketCount = null,
  bucketSlotCapacity = DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY
} = {}) {
  assertLawNeighborActiveNodeInput(activeNodeList);
  const activeNodeCount = Math.max(0, Math.round(finiteNumber(
    activeNodeList.activeCandidateCount ?? activeNodeList.particleCount,
    0
  )));
  const bucketPlan = activeNodeIndexBucketPlan({
    activeNodeCount,
    bucketCount,
    bucketSlotCapacity
  });
  return {
    schema: ULG_SCHROEDER_ACTIVE_NODE_INDEX_SCHEMA,
    status: 'schroeder-active-node-index-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_ACTIVE_NODE_INDEX_SCOPE,
    sourceActiveNodeSchema: activeNodeList.schema,
    sourceActiveNodeStatus: activeNodeList.status ?? null,
    activeNodeCount,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    bucketCount: bucketPlan.bucketCount,
    bucketSlotCapacity: bucketPlan.bucketSlotCapacity,
    bucketSlotCount: bucketPlan.bucketSlotCount,
    nodeSlotCount: activeNodeCount,
    bucketCountByteLength: bucketPlan.bucketCountByteLength,
    bucketSlotByteLength: bucketPlan.bucketSlotByteLength,
    nodeBucketSlotByteLength: bucketPlan.nodeBucketSlotByteLength,
    overflowCounterByteLength: bucketPlan.overflowCounterByteLength,
    indexTopology: 'bucketed-active-node-tile-anchor-index',
    outputCompaction: 'bucketed-active-node-indirection-slots',
    capacityStatus: 'bucket-capacity-provisioned-fail-closed-on-overflow',
    indexCoverageStatus: 'tile-min-anchor-index-not-authoritative-overlap-pruning',
    consumerStatus: 'available-for-next-law-neighbor-indexed-traversal-slice',
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederActiveNodeSortedIndexPlan({
  activeNodeList,
  bucketCount = null
} = {}) {
  assertLawNeighborActiveNodeInput(activeNodeList);
  const activeNodeCount = Math.max(0, Math.round(finiteNumber(
    activeNodeList.activeCandidateCount ?? activeNodeList.particleCount,
    0
  )));
  const sortedPlan = activeNodeSortedIndexPlan({
    activeNodeCount,
    bucketCount
  });
  return {
    schema: ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_SCHEMA,
    status: 'schroeder-active-node-sorted-index-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_ACTIVE_NODE_INDEX_SCOPE,
    sourceActiveNodeSchema: activeNodeList.schema,
    sourceActiveNodeStatus: activeNodeList.status ?? null,
    activeNodeCount,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    bucketCount: sortedPlan.bucketCount,
    bucketRangeOffsetCount: sortedPlan.bucketRangeOffsetCount,
    bucketRangeRowLayout: [...SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_ROW_LAYOUT],
    bucketRangeStrideUints: SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_UINTS,
    bucketCountByteLength: sortedPlan.bucketCountByteLength,
    bucketCursorByteLength: sortedPlan.bucketCursorByteLength,
    bucketRangeOffsetByteLength: sortedPlan.bucketRangeOffsetByteLength,
    sortedActiveIndexByteLength: sortedPlan.sortedActiveIndexByteLength,
    diagnosticCounterByteLength: sortedPlan.diagnosticCounterByteLength,
    indexTopology: 'radix-bucket-active-node-tile-anchor-ranges',
    outputCompaction: 'contiguous-active-node-index-ranges-by-radix-bucket',
    capacityStatus: 'unbounded-per-bucket-range-no-fixed-slot-overflow',
    indexCoverageStatus: 'hash-bucket-ranges-require-exact-overlap-validation',
    consumerStatus: 'available-for-law-neighbor-sorted-radix-traversal',
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederLawQueuePlan({
  activeNodeList,
  enabledLawMask = SCHROEDER_LOCAL_LAW_QUEUE_MASK,
  candidateBudget = DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET,
  queueEpoch = 0,
  stateFamilyId = 1
} = {}) {
  assertLawQueueActiveNodeInput(activeNodeList);
  const activeNodeCount = Math.max(0, Math.round(finiteNumber(
    activeNodeList.activeCandidateCount ?? activeNodeList.particleCount,
    0
  )));
  const resolvedLawMask = Math.max(0, Math.round(finiteNumber(enabledLawMask, SCHROEDER_LOCAL_LAW_QUEUE_MASK)));
  const lawFamilies = [];
  if ((resolvedLawMask & SCHROEDER_LOCAL_LAW_REACTION_MASK) !== 0) lawFamilies.push('reaction');
  if ((resolvedLawMask & SCHROEDER_LOCAL_LAW_CONTACT_MASK) !== 0) lawFamilies.push('contact');
  if ((resolvedLawMask & SCHROEDER_LOCAL_LAW_INTERFACE_MASK) !== 0) lawFamilies.push('interface');
  const lawQueueByteLength = Math.max(
    4,
    activeNodeCount * SCHROEDER_LAW_QUEUE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_LAW_QUEUE_SCHEMA,
    status: 'schroeder-law-queue-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_LAW_QUEUE_SCOPE,
    sourceActiveNodeSchema: activeNodeList.schema,
    sourceActiveNodeStatus: activeNodeList.status ?? null,
    activeNodeCount,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    lawQueueRowLayout: [...SCHROEDER_LAW_QUEUE_ROW_LAYOUT],
    lawQueueStrideFloats: SCHROEDER_LAW_QUEUE_FLOATS,
    lawQueueStrideBytes: SCHROEDER_LAW_QUEUE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    lawQueueByteLength,
    enabledLawMask: resolvedLawMask,
    candidateBudget: Math.max(0, finiteNumber(
      candidateBudget,
      DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET
    )),
    queueEpoch: finiteNumber(queueEpoch, 0),
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    lawFamilies,
    queueTopology: 'one-law-queue-row-per-active-node',
    outputCompaction: 'active-node-local-law-queue-descriptors',
    exactNearFieldRequirement: 'reaction-contact-interface-queues-require-exact-near-field-validation',
    aggregateAdmissibilityStatus: 'far-aggregate-laws-not-enabled-for-local-queues',
    reactionScopeStatus: 'sedenion-scope-preserved-for-reaction-queue',
    stateMutationTarget: 'schroeder-retained-local-law-queue-buffer',
    stateMutationStatus: 'law-queue-planned-no-state-mutation',
    stateAuthorityStatus: 'state-manager-admission-required-before-law-output-mutation',
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederLawNeighborCandidatePlan({
  lawQueue,
  activeNodeList,
  activeNodeIndex = null,
  activeNodeSortedIndex = null,
  sphParticleState = null,
  sphParticleUpload = null,
  particleCount = null,
  candidateBudget = lawQueue?.candidateBudget ?? DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET,
  enabledLawMask = lawQueue?.enabledLawMask ?? SCHROEDER_LOCAL_LAW_QUEUE_MASK
} = {}) {
  assertLawQueueInput(lawQueue);
  assertLawNeighborActiveNodeInput(activeNodeList);
  if (activeNodeIndex) {
    assertLawNeighborActiveNodeIndexInput(activeNodeIndex);
  }
  if (activeNodeSortedIndex) {
    assertLawNeighborActiveNodeSortedIndexInput(activeNodeSortedIndex);
  }
  const resolvedParticleCount = Math.max(0, Math.round(finiteNumber(
    particleCount ?? sphParticleUpload?.particleCount ?? sphParticleState?.particleCount,
    0
  )));
  if (resolvedParticleCount <= 0) {
    throw new RangeError('Schroeder law-neighbor candidates require at least one particle');
  }
  const lawQueueCount = Math.max(0, Math.round(finiteNumber(
    lawQueue.activeNodeCount ?? lawQueue.lawQueueCount ?? lawQueue.lawQueueRowCount,
    0
  )));
  const activeNodeCount = Math.max(0, Math.round(finiteNumber(
    activeNodeList.activeCandidateCount ?? activeNodeList.particleCount,
    0
  )));
  const activeNodeIndexEnabled = Boolean(activeNodeIndex);
  const activeNodeSortedIndexEnabled = Boolean(activeNodeSortedIndex);
  const activeNodeIndexActiveNodeCount = activeNodeIndexEnabled
    ? Math.max(0, Math.round(finiteNumber(activeNodeIndex.activeNodeCount, 0)))
    : 0;
  if (activeNodeIndexEnabled && activeNodeIndexActiveNodeCount !== activeNodeCount) {
    throw new RangeError('Schroeder law-neighbor active-node index must match the active-node list row count');
  }
  const activeNodeSortedIndexActiveNodeCount = activeNodeSortedIndexEnabled
    ? Math.max(0, Math.round(finiteNumber(activeNodeSortedIndex.activeNodeCount, 0)))
    : 0;
  if (activeNodeSortedIndexEnabled && activeNodeSortedIndexActiveNodeCount !== activeNodeCount) {
    throw new RangeError('Schroeder law-neighbor sorted active-node index must match the active-node list row count');
  }
  const activeNodeIndexBucketCount = activeNodeIndexEnabled
    ? Math.max(0, Math.round(finiteNumber(activeNodeIndex.bucketCount, 0)))
    : 0;
  const activeNodeIndexBucketSlotCapacity = activeNodeIndexEnabled
    ? Math.max(0, Math.round(finiteNumber(activeNodeIndex.bucketSlotCapacity, 0)))
    : 0;
  const activeNodeIndexBucketSlotCount = activeNodeIndexEnabled
    ? Math.max(0, Math.round(finiteNumber(activeNodeIndex.bucketSlotCount, 0)))
    : 0;
  const activeNodeSortedIndexBucketCount = activeNodeSortedIndexEnabled
    ? Math.max(0, Math.round(finiteNumber(activeNodeSortedIndex.bucketCount, 0)))
    : 0;
  const activeNodeSortedIndexBucketRangeOffsetCount = activeNodeSortedIndexEnabled
    ? Math.max(0, Math.round(finiteNumber(activeNodeSortedIndex.bucketRangeOffsetCount, 0)))
    : 0;
  const resolvedCandidateBudget = Math.max(1, Math.round(finiteNumber(
    candidateBudget,
    DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET
  )));
  const resolvedLawMask = Math.max(0, Math.round(finiteNumber(enabledLawMask, SCHROEDER_LOCAL_LAW_QUEUE_MASK)));
  const neighborCandidateCount = lawQueueCount * resolvedCandidateBudget;
  const neighborCandidateByteLength = Math.max(
    4,
    neighborCandidateCount * SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceCandidateSpanCount = resolvedParticleCount;
  const sourceCandidateSpanByteLength = Math.max(
    4,
    sourceCandidateSpanCount * SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  const diagnosticCounterCount = SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT;
  const diagnosticCounterByteLength = diagnosticCounterCount * Uint32Array.BYTES_PER_ELEMENT;
  return {
    schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA,
    status: 'schroeder-law-neighbor-candidate-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCOPE,
    sourceLawQueueSchema: lawQueue.schema,
    sourceLawQueueStatus: lawQueue.status ?? null,
    sourceActiveNodeSchema: activeNodeList.schema,
    sourceActiveNodeStatus: activeNodeList.status ?? null,
    sourceActiveNodeIndexSchema: activeNodeIndex?.schema ?? null,
    sourceActiveNodeIndexStatus: activeNodeIndex?.status ?? null,
    sourceActiveNodeSortedIndexSchema: activeNodeSortedIndex?.schema ?? null,
    sourceActiveNodeSortedIndexStatus: activeNodeSortedIndex?.status ?? null,
    particleCount: resolvedParticleCount,
    lawQueueCount,
    activeNodeCount,
    activeNodeIndexEnabled,
    activeNodeIndexBucketCount,
    activeNodeIndexBucketSlotCapacity,
    activeNodeIndexBucketSlotCount,
    activeNodeSortedIndexEnabled,
    activeNodeSortedIndexBucketCount,
    activeNodeSortedIndexBucketRangeOffsetCount,
    lawQueueStrideFloats: SCHROEDER_LAW_QUEUE_FLOATS,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    neighborCandidateCount,
    neighborCandidateRowLayout: [...SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ROW_LAYOUT],
    neighborCandidateStrideFloats: SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS,
    neighborCandidateStrideBytes: SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    sourceCandidateSpanCount,
    sourceCandidateSpanRowLayout: [...SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_ROW_LAYOUT],
    sourceCandidateSpanStrideFloats: SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS,
    sourceCandidateSpanStrideBytes: SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    neighborCandidateByteLength,
    sourceCandidateSpanByteLength,
    diagnosticCounterCount,
    diagnosticCounterByteLength,
    diagnosticCounterLayout: [
      'candidateInvocationCount:u32',
      'bucketIndexAttemptCount:u32',
      'bucketSelectedCount:u32',
      'exactFallbackScanCount:u32',
      'exactFallbackSelectedCount:u32',
      'inactiveCandidateCount:u32',
      'bucketPressureCount:u32',
      'sourceSpanWriteCount:u32'
    ],
    enabledLawMask: resolvedLawMask,
    candidateBudget: resolvedCandidateBudget,
    queueEpoch: finiteNumber(lawQueue.queueEpoch, 0),
    enumerationMode: activeNodeSortedIndexEnabled
      ? 'schroeder-active-node-sorted-radix-range-traversal-neighbor-enumeration'
      : (activeNodeIndexEnabled
      ? 'schroeder-active-node-indexed-tile-traversal-neighbor-enumeration'
      : 'schroeder-active-node-tile-traversal-neighbor-enumeration'),
    outputCompaction: 'fixed-budget-law-neighbor-candidate-rows',
    candidateIndexingMode: 'particle-source-candidate-span-table',
    activeNodeIndexConsumerStatus: activeNodeSortedIndexEnabled
      ? 'active-node-sorted-radix-index-consumed-with-exact-scan-fallback'
      : (activeNodeIndexEnabled
      ? 'active-node-bucket-index-consumed-with-exact-scan-fallback'
      : 'active-node-index-disabled-full-active-node-scan'),
    treeTraversalStatus: activeNodeSortedIndexEnabled
      ? 'active-node-sorted-radix-range-traversal-with-exact-scan-fallback'
      : (activeNodeIndexEnabled
      ? 'active-node-bucket-index-traversal-with-exact-scan-fallback'
      : 'active-node-tile-traversal-before-sorted-schroeder-tree-index'),
    traversalPolicyMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE,
    traversalPolicyStatus: 'traversal-policy-pending-compact-diagnostic-counters',
    appliedTraversalIndexMode: activeNodeSortedIndexEnabled
      ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE
      : (activeNodeIndexEnabled
      ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE
      : SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE),
    recommendedTraversalIndexMode: activeNodeSortedIndexEnabled
      ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE
      : (activeNodeIndexEnabled
      ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE
      : SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE),
    sortedRadixIndexStatus: activeNodeSortedIndexEnabled
      ? 'sorted-radix-active-node-index-available'
      : 'sorted-radix-active-node-index-not-required-without-diagnostics',
    traversalDiagnosticReadbackPolicy: 'compact-counter-readback-optional',
    exactNearFieldRequirement: 'candidate-rows-feed-reaction-contact-interface-exact-near-field-consumers',
    stateMutationTarget: 'schroeder-retained-local-law-neighbor-candidate-buffer',
    stateMutationStatus: 'law-neighbor-candidates-planned-no-state-mutation',
    stateAuthorityStatus: 'state-manager-admission-required-before-law-neighbor-output-mutation',
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederCrossLevelCouplingPlan({
  levelAssignment,
  activeNodeList,
  parentLevelDelta = 1,
  baseGridSpacingM = levelAssignment?.baseGridSpacingM ?? DEFAULT_BASE_GRID_SPACING_M,
  maxLevel = levelAssignment?.maxLevel ?? DEFAULT_MAX_LEVEL,
  couplingHaloCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minCouplingRadiusM = 0,
  maxCouplingRadiusM = 0,
  tileCellCount = activeNodeList?.tileCellCount ?? DEFAULT_TILE_CELL_COUNT
} = {}) {
  assertLevelAssignmentInput(levelAssignment);
  const particleCount = Math.max(0, Math.round(finiteNumber(levelAssignment.particleCount, 0)));
  assertActiveNodeListInput(activeNodeList, particleCount);
  const crossLevelByteLength = Math.max(
    4,
    particleCount * SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_CROSS_LEVEL_COUPLING_SCHEMA,
    status: 'schroeder-cross-level-coupling-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_CROSS_LEVEL_COUPLING_SCOPE,
    sourceAssignmentSchema: levelAssignment.schema,
    sourceAssignmentStatus: levelAssignment.status ?? null,
    sourceActiveNodeSchema: activeNodeList.schema,
    sourceActiveNodeStatus: activeNodeList.status ?? null,
    particleCount,
    crossLevelCandidateCount: particleCount,
    parentLevelDelta: Math.max(1, Math.round(finiteNumber(parentLevelDelta, 1))),
    maxLevel: Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)),
    baseGridSpacingM: finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M),
    couplingHaloCells: Math.max(0, finiteNumber(couplingHaloCells, DEFAULT_SUPPORT_INFLATE_CELLS)),
    minCouplingRadiusM: Math.max(0, finiteNumber(minCouplingRadiusM, 0)),
    maxCouplingRadiusM: Math.max(0, finiteNumber(maxCouplingRadiusM, 0)),
    tileCellCount: Math.max(1, Math.round(finiteNumber(tileCellCount, DEFAULT_TILE_CELL_COUNT))),
    assignmentRowLayout: [...SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT],
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    activeNodeRowLayout: [...SCHROEDER_ACTIVE_NODE_ROW_LAYOUT],
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    crossLevelRowLayout: [...SCHROEDER_CROSS_LEVEL_COUPLING_ROW_LAYOUT],
    crossLevelStrideFloats: SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
    crossLevelStrideBytes: SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    crossLevelByteLength,
    outputCompaction: 'one-child-parent-candidate-row-per-particle',
    hierarchyRole: 'cross-level-parent-candidate-generation',
    couplingConsumerStatus: 'planned-not-yet-applied-to-mls-mpm-grid-transfer',
    conservationRole: 'candidate-rows-carry-mass-and-volume-for-later-conservative-transfer',
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederCrossLevelTransferPlan({
  crossLevelCoupling,
  sphParticleState
} = {}) {
  assertCrossLevelCouplingInput(crossLevelCoupling);
  assertSphParticleStateInput(sphParticleState);
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelCoupling.crossLevelCandidateCount, 0)));
  const transferByteLength = Math.max(
    4,
    candidateCount * SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_SCHEMA,
    status: 'schroeder-cross-level-transfer-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-cross-level-transfer-rows',
    sourceCrossLevelSchema: crossLevelCoupling.schema,
    sourceCrossLevelStatus: crossLevelCoupling.status ?? null,
    sourceParticleSchema: sphParticleState.schema,
    crossLevelCandidateCount: candidateCount,
    crossLevelStrideFloats: SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    transferRowLayout: [...SCHROEDER_CROSS_LEVEL_TRANSFER_ROW_LAYOUT],
    transferStrideFloats: SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS,
    transferStrideBytes: SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    transferByteLength,
    outputCompaction: 'one-conservative-transfer-row-per-cross-level-candidate',
    conservativeTransferStatus: 'transfer-rows-ready-no-state-mutation',
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederCrossLevelStateDeltaPlan({
  crossLevelTransfer
} = {}) {
  assertCrossLevelTransferInput(crossLevelTransfer);
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelTransfer.crossLevelCandidateCount, 0)));
  const stateDeltaByteLength = Math.max(
    4,
    candidateCount * SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_SCHEMA,
    status: 'schroeder-cross-level-state-delta-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-cross-level-state-delta',
    sourceTransferSchema: crossLevelTransfer.schema,
    sourceTransferStatus: crossLevelTransfer.status ?? null,
    crossLevelCandidateCount: candidateCount,
    transferStrideFloats: SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS,
    stateDeltaRowLayout: [...SCHROEDER_CROSS_LEVEL_STATE_DELTA_ROW_LAYOUT],
    stateDeltaStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
    stateDeltaStrideBytes: SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    stateDeltaByteLength,
    outputCompaction: 'one-pending-state-delta-row-per-transfer-candidate',
    conservativeTransferStatus: 'pending-state-delta-planned',
    stateMutationTarget: 'schroeder-pending-state-delta-buffer',
    stateMutationStatus: 'pending-state-delta-not-authoritative',
    stateAuthorityStatus: 'requires-state-manager-admission-before-authoritative-merge',
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederCrossLevelStateDeltaMergePlan({
  crossLevelStateDelta,
  stateDeltaMergeAdmission = null,
  mergeEpoch = 0
} = {}) {
  assertCrossLevelStateDeltaInput(crossLevelStateDelta);
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelStateDelta.crossLevelCandidateCount, 0)));
  const admission = schroederStateDeltaMergeAdmissionAllowsApplication({
    stateDeltaMergeAdmission,
    crossLevelStateDelta,
    stateDeltaRowCount: candidateCount
  });
  const mergeByteLength = Math.max(
    4,
    candidateCount * SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_SCHEMA,
    status: admission.approved
      ? 'schroeder-cross-level-state-delta-merge-plan-ready'
      : 'schroeder-cross-level-state-delta-merge-plan-blocked-admission-required',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-cross-level-state-delta-merge',
    sourceStateDeltaSchema: crossLevelStateDelta.schema,
    sourceStateDeltaStatus: crossLevelStateDelta.status ?? null,
    crossLevelCandidateCount: candidateCount,
    stateDeltaStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
    mergeRowLayout: [...SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_ROW_LAYOUT],
    mergeStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS,
    mergeStrideBytes: SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    mergeByteLength,
    outputCompaction: 'one-admitted-state-delta-merge-row-per-pending-delta',
    outputFamilies: [SCHROEDER_STATE_DELTA_OUTPUT_FAMILY],
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    admission,
    stateDeltaMergeAdmissionSchema: admission.schema,
    stateDeltaMergeAdmissionStatus: admission.status,
    stateDeltaMergeAdmissionApproved: admission.approved,
    stateDeltaMergeAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
    conservativeTransferStatus: admission.approved
      ? 'state-delta-merge-ready'
      : 'state-delta-merge-blocked-admission-required',
    stateMutationTarget: 'schroeder-retained-admitted-state-delta-merge-buffer',
    stateMutationStatus: admission.approved
      ? 'state-delta-merge-planned'
      : 'blocked-state-delta-merge-admission-required',
    stateAuthorityStatus: admission.approved
      ? 'state-manager-admission-present'
      : 'requires-state-manager-admission-before-authoritative-merge',
    mergeEpoch: finiteNumber(mergeEpoch, 0),
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederHierarchyAggregatePlan({
  crossLevelStateDeltaMerge
} = {}) {
  assertCrossLevelStateDeltaMergeInput(crossLevelStateDeltaMerge);
  const aggregateRowCount = Math.max(0, Math.round(finiteNumber(
    crossLevelStateDeltaMerge.crossLevelCandidateCount,
    0
  )));
  const aggregateByteLength = Math.max(
    4,
    aggregateRowCount * SCHROEDER_HIERARCHY_AGGREGATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA,
    status: 'schroeder-hierarchy-aggregate-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-hierarchy-aggregate-contributions',
    sourceStateDeltaMergeSchema: crossLevelStateDeltaMerge.schema,
    sourceStateDeltaMergeStatus: crossLevelStateDeltaMerge.status ?? null,
    aggregateRowCount,
    mergeStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS,
    aggregateRowLayout: [...SCHROEDER_HIERARCHY_AGGREGATE_ROW_LAYOUT],
    aggregateStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
    aggregateStrideBytes: SCHROEDER_HIERARCHY_AGGREGATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    aggregateByteLength,
    outputCompaction: 'unsorted-one-aggregate-contribution-row-per-admitted-merge-row',
    aggregateReductionStatus: 'pending-keyed-reduction',
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    outputFamilies: [SCHROEDER_STATE_DELTA_OUTPUT_FAMILY, 'schroeder-hierarchy-aggregate-contributions'],
    stateMutationTarget: 'schroeder-retained-hierarchy-aggregate-contribution-buffer',
    stateMutationStatus: 'aggregate-contribution-materialization-planned',
    stateAuthorityStatus: 'state-manager-admitted-merge-buffer-source',
    conservativeTransferStatus: 'hierarchy-aggregate-contributions-ready',
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederHierarchyAggregateNodePlan({
  hierarchyAggregate,
  aggregateReductionMode = SCHROEDER_AGGREGATE_NODE_REDUCTION_AUTO_MODE,
  bucketCount = null,
  bucketSlotCapacity = DEFAULT_AGGREGATE_NODE_BUCKET_SLOT_CAPACITY
} = {}) {
  assertHierarchyAggregateInput(hierarchyAggregate);
  const aggregateRowCount = Math.max(0, Math.round(finiteNumber(hierarchyAggregate.aggregateRowCount, 0)));
  const resolvedReductionMode = normalizeAggregateNodeReductionMode(aggregateReductionMode, aggregateRowCount);
  const bucketPlan = aggregateNodeBucketPlan({
    aggregateRowCount,
    bucketCount,
    bucketSlotCapacity
  });
  const bucketReduction = resolvedReductionMode === SCHROEDER_BUCKETED_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE;
  const aggregateNodeByteLength = Math.max(
    4,
    aggregateRowCount * SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA,
    status: 'schroeder-hierarchy-aggregate-node-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-hierarchy-aggregate-node-reduction',
    sourceHierarchyAggregateSchema: hierarchyAggregate.schema,
    sourceHierarchyAggregateStatus: hierarchyAggregate.status ?? null,
    aggregateRowCount,
    aggregateStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
    aggregateNodeRowLayout: [...SCHROEDER_HIERARCHY_AGGREGATE_NODE_ROW_LAYOUT],
    aggregateNodeStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
    aggregateNodeStrideBytes: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    aggregateNodeByteLength,
    outputCompaction: bucketReduction
      ? 'bucketed-first-occurrence-nodes-active-duplicates-suppressed'
      : 'one-row-per-contribution-first-occurrence-nodes-active-duplicates-suppressed',
    aggregateReductionStatus: bucketReduction
      ? 'bucketed-bounded-slot-reduction-planned'
      : 'exact-first-occurrence-global-scan',
    aggregateReductionMode: resolvedReductionMode,
    aggregateReductionModeId: aggregateNodeReductionModeId(resolvedReductionMode),
    aggregateReductionAutoThreshold: DEFAULT_AGGREGATE_NODE_BUCKET_REDUCTION_MIN_ROWS,
    bucketCount: bucketReduction ? bucketPlan.bucketCount : 0,
    bucketSlotCapacity: bucketReduction ? bucketPlan.bucketSlotCapacity : 0,
    bucketSlotCount: bucketReduction ? bucketPlan.bucketSlotCount : 0,
    bucketCountByteLength: bucketReduction ? bucketPlan.bucketCountByteLength : 0,
    bucketSlotByteLength: bucketReduction ? bucketPlan.bucketSlotByteLength : 0,
    rowBucketSlotByteLength: bucketReduction ? bucketPlan.rowBucketSlotByteLength : 0,
    capacityStatus: bucketReduction
      ? 'bucket-capacity-provisioned-fail-closed-on-overflow'
      : 'no-extra-capacity-required-output-row-per-input-row',
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    outputFamilies: [SCHROEDER_STATE_DELTA_OUTPUT_FAMILY, 'schroeder-hierarchy-aggregate-nodes'],
    stateMutationTarget: 'schroeder-retained-hierarchy-aggregate-node-buffer',
    stateMutationStatus: 'aggregate-node-reduction-planned',
    stateAuthorityStatus: 'state-manager-admitted-aggregate-contribution-source',
    conservativeTransferStatus: 'hierarchy-aggregate-nodes-ready',
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederPhaseVolumeMigrationPlan({
  levelAssignment,
  hierarchyAggregateNode,
  baseGridSpacingM = levelAssignment?.baseGridSpacingM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = levelAssignment?.minLevel ?? DEFAULT_MIN_LEVEL,
  maxLevel = levelAssignment?.maxLevel ?? DEFAULT_MAX_LEVEL,
  targetSupportCells = levelAssignment?.targetSupportCells ?? DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = levelAssignment?.supportRadiusScale ?? DEFAULT_SUPPORT_RADIUS_SCALE,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  coarsenLevelDeltaThreshold = DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD,
  gasPhaseId = DEFAULT_GAS_PHASE_ID,
  migrationEpoch = 0,
  aggregateResidualTolerance = DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE
} = {}) {
  assertLevelAssignmentInput(levelAssignment);
  assertHierarchyAggregateNodeInput(hierarchyAggregateNode);
  const particleCount = Math.max(0, Math.round(finiteNumber(levelAssignment.particleCount, 0)));
  const aggregateNodeCount = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregateNode.aggregateNodeCount ?? hierarchyAggregateNode.aggregateRowCount,
    0
  )));
  const migrationByteLength = Math.max(
    4,
    particleCount * SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA,
    status: 'schroeder-phase-volume-migration-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-phase-volume-migration',
    sourceAssignmentSchema: levelAssignment.schema,
    sourceAssignmentStatus: levelAssignment.status ?? null,
    sourceHierarchyAggregateNodeSchema: hierarchyAggregateNode.schema,
    sourceHierarchyAggregateNodeStatus: hierarchyAggregateNode.status ?? null,
    particleCount,
    aggregateNodeCount,
    minLevel: Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)),
    maxLevel: Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)),
    baseGridSpacingM: finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M),
    targetSupportCells: finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS),
    supportRadiusScale: Math.max(0, finiteNumber(supportRadiusScale, DEFAULT_SUPPORT_RADIUS_SCALE)),
    phaseVolumeExpandThreshold: Math.max(1, finiteNumber(
      phaseVolumeExpandThreshold,
      DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD
    )),
    coarsenLevelDeltaThreshold: Math.max(0, finiteNumber(
      coarsenLevelDeltaThreshold,
      DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD
    )),
    gasPhaseId: finiteNumber(gasPhaseId, DEFAULT_GAS_PHASE_ID),
    migrationEpoch: finiteNumber(migrationEpoch, 0),
    aggregateResidualTolerance: Math.max(0, finiteNumber(
      aggregateResidualTolerance,
      DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE
    )),
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    aggregateNodeStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
    migrationRowLayout: [...SCHROEDER_PHASE_VOLUME_MIGRATION_ROW_LAYOUT],
    migrationStrideFloats: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
    migrationStrideBytes: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    migrationByteLength,
    phaseVolumeStatus: 'phase-volume-migration-planned',
    migrationMode: 'physical-volume-level-target-with-aggregate-coherence',
    aggregateCoherenceRequirement: 'retained-aggregate-node-buffer-consumed',
    waterToSteamScaleStatus: 'water-to-steam-expansion-maps-to-coarser-levels-without-particle-multiplication',
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    outputFamilies: [
      SCHROEDER_STATE_DELTA_OUTPUT_FAMILY,
      'schroeder-phase-volume-migration',
      'schroeder-hierarchy-aggregate-nodes'
    ],
    stateMutationTarget: 'schroeder-retained-phase-volume-migration-buffer',
    stateMutationStatus: 'phase-volume-migration-planned',
    stateAuthorityStatus: 'requires-state-manager-admission-for-authoritative-level-migration',
    conservativeTransferStatus: 'phase-volume-migration-ready',
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederPhaseVolumeLevelUpdatePlan({
  phaseVolumeMigration,
  phaseVolumeMigrationAdmission = null,
  migrationEpoch = phaseVolumeMigration?.migrationEpoch ?? 0,
  stateFamilyId = 1
} = {}) {
  assertPhaseVolumeMigrationInput(phaseVolumeMigration);
  const migrationRowCount = Math.max(0, Math.round(finiteNumber(phaseVolumeMigration.particleCount, 0)));
  const admission = schroederPhaseVolumeMigrationAdmissionAllowsApplication({
    phaseVolumeMigrationAdmission,
    phaseVolumeMigration,
    migrationRowCount
  });
  const levelUpdateByteLength = Math.max(
    4,
    migrationRowCount * SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA,
    status: admission.approved
      ? 'schroeder-phase-volume-level-update-plan-ready'
      : 'schroeder-phase-volume-level-update-plan-blocked-admission-required',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-phase-volume-level-update',
    sourcePhaseVolumeMigrationSchema: phaseVolumeMigration.schema,
    sourcePhaseVolumeMigrationStatus: phaseVolumeMigration.status ?? null,
    migrationRowCount,
    migrationStrideFloats: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
    levelUpdateRowLayout: [...SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ROW_LAYOUT],
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    levelUpdateStrideBytes: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    levelUpdateByteLength,
    outputCompaction: 'one-admitted-phase-volume-level-update-row-per-migration-row',
    admission,
    phaseVolumeMigrationAdmissionSchema: admission.schema,
    phaseVolumeMigrationAdmissionStatus: admission.status,
    phaseVolumeMigrationAdmissionApproved: admission.approved,
    phaseVolumeMigrationAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    migrationEpoch: finiteNumber(migrationEpoch, 0),
    outputFamilies: [
      SCHROEDER_STATE_DELTA_OUTPUT_FAMILY,
      'schroeder-phase-volume-migration',
      'schroeder-phase-volume-level-update'
    ],
    stateMutationTarget: 'schroeder-retained-phase-volume-level-update-buffer',
    conservativeTransferStatus: admission.approved
      ? 'phase-volume-level-update-ready'
      : 'phase-volume-level-update-blocked-admission-required',
    stateMutationStatus: admission.approved
      ? 'phase-volume-level-update-planned'
      : 'blocked-phase-volume-level-update-admission-required',
    stateAuthorityStatus: admission.approved
      ? 'state-manager-admission-present'
      : 'requires-state-manager-admission-for-authoritative-level-migration',
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederPhaseVolumeDiagnosticSummaryPlan({
  phaseVolumeLevelUpdate,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  migrationEpoch = phaseVolumeLevelUpdate?.migrationEpoch ?? 0,
  stateFamilyId = phaseVolumeLevelUpdate?.stateFamilyId ?? 1
} = {}) {
  assertPhaseVolumeLevelUpdateInput(phaseVolumeLevelUpdate);
  const levelUpdateRowCount = Math.max(0, Math.round(finiteNumber(phaseVolumeLevelUpdate.migrationRowCount, 0)));
  const summaryByteLength = SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_SCHEMA,
    status: 'schroeder-phase-volume-diagnostic-summary-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-phase-volume-diagnostic-summary',
    sourcePhaseVolumeLevelUpdateSchema: phaseVolumeLevelUpdate.schema,
    sourcePhaseVolumeLevelUpdateStatus: phaseVolumeLevelUpdate.status ?? null,
    levelUpdateRowCount,
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    summaryRowLayout: [...SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_ROW_LAYOUT],
    summaryStrideFloats: SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS,
    summaryStrideBytes: summaryByteLength,
    summaryByteLength,
    summaryRowCount: 1,
    outputCompaction: 'one-compact-phase-volume-diagnostic-summary-row',
    phaseVolumeExpandThreshold: Math.max(1, finiteNumber(
      phaseVolumeExpandThreshold,
      DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD
    )),
    migrationEpoch: finiteNumber(migrationEpoch, 0),
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    diagnosticStatus: 'phase-volume-diagnostics-ready',
    visibleStressCaseStatus: 'water-to-steam-level-migration-diagnostics-ready',
    readbackPolicy: 'compact-summary-only-no-particle-readback',
    outputFamilies: [
      'schroeder-phase-volume-diagnostics',
      'schroeder-phase-volume-level-update'
    ],
    stateMutationStatus: 'diagnostic-summary-only-no-state-mutation',
    stateAuthorityStatus: 'state-manager-admitted-level-update-source',
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederConservationSummaryPlan({
  crossLevelCoupling,
  summaryWorkgroupSize = SCHROEDER_CONSERVATION_SUMMARY_WORKGROUP_SIZE
} = {}) {
  assertCrossLevelCouplingInput(crossLevelCoupling);
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelCoupling.crossLevelCandidateCount, 0)));
  const workgroupSize = Math.max(1, Math.round(finiteNumber(
    summaryWorkgroupSize,
    SCHROEDER_CONSERVATION_SUMMARY_WORKGROUP_SIZE
  )));
  const summaryRowCount = Math.max(1, Math.ceil(candidateCount / workgroupSize));
  const summaryByteLength = Math.max(
    4,
    summaryRowCount * SCHROEDER_CONSERVATION_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_CONSERVATION_SUMMARY_SCHEMA,
    status: 'schroeder-conservation-summary-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-cross-level-conservation-summary',
    sourceCrossLevelSchema: crossLevelCoupling.schema,
    sourceCrossLevelStatus: crossLevelCoupling.status ?? null,
    crossLevelCandidateCount: candidateCount,
    crossLevelStrideFloats: SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
    summaryRowLayout: [...SCHROEDER_CONSERVATION_SUMMARY_ROW_LAYOUT],
    summaryStrideFloats: SCHROEDER_CONSERVATION_SUMMARY_FLOATS,
    summaryStrideBytes: SCHROEDER_CONSERVATION_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    summaryWorkgroupSize: workgroupSize,
    summaryRowCount,
    summaryByteLength,
    outputCompaction: 'one-conservation-summary-row-per-workgroup',
    conservativeTransferStatus: 'summary-only-no-state-mutation',
    residualCounterStatus: 'planned-gpu-resident-workgroup-partials',
    conservedQuantities: ['mass', 'represented-volume'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

function schroederPortableRetainedRef({
  family,
  artifact = null,
  schema = artifact?.schema ?? null,
  status = artifact?.status ?? null,
  rowCount = 0,
  strideFloats = 0,
  byteLength = 0,
  retained = false,
  role = null
} = {}) {
  return {
    family,
    role,
    schema,
    status,
    rowCount: Math.max(0, Math.round(finiteNumber(rowCount, 0))),
    strideFloats: Math.max(0, Math.round(finiteNumber(strideFloats, 0))),
    byteLength: Math.max(0, Math.round(finiteNumber(byteLength, 0))),
    retained: Boolean(retained),
    transferMode: 'descriptor-only-no-raw-gpubuffer-transfer'
  };
}

export function createSchroederPortableSummaryPlan({
  levelAssignment = null,
  activeNodeList,
  activeNodeIndex = null,
  activeNodeSortedIndex = null,
  lawQueue = null,
  lawNeighborCandidates = null,
  hierarchyAggregateNode = null,
  conservationSummary = null,
  phaseVolumeDiagnosticSummary = null,
  selectedLevel = levelAssignment?.selectedLevel ?? 0,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  renderLodMode = 'active-node-leaf-and-aggregate-proxy-lod',
  peerComputeUseCase = 'portable-schroeder-summary'
} = {}) {
  const particleCount = Math.max(0, Math.round(finiteNumber(
    activeNodeList?.particleCount ?? activeNodeList?.activeCandidateCount,
    0
  )));
  assertActiveNodeListInput(activeNodeList, particleCount);
  if (levelAssignment) assertLevelAssignmentInput(levelAssignment);
  if (activeNodeIndex) assertLawNeighborActiveNodeIndexInput(activeNodeIndex);
  if (activeNodeSortedIndex) assertLawNeighborActiveNodeSortedIndexInput(activeNodeSortedIndex);
  if (lawQueue) assertLawQueueInput(lawQueue);
  if (hierarchyAggregateNode) assertHierarchyAggregateNodeInput(hierarchyAggregateNode);

  const activeNodeCount = Math.max(0, Math.round(finiteNumber(
    activeNodeList.activeCandidateCount ?? activeNodeList.particleCount,
    particleCount
  )));
  const aggregateNodeCount = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregateNode?.aggregateNodeCount ?? hierarchyAggregateNode?.aggregateRowCount,
    0
  )));
  const lawQueueCount = Math.max(0, Math.round(finiteNumber(lawQueue?.activeNodeCount, 0)));
  const lawNeighborCandidateCount = Math.max(0, Math.round(finiteNumber(
    lawNeighborCandidates?.neighborCandidateCount,
    0
  )));
  const phaseDiagnosticRowsAvailable = phaseVolumeDiagnosticSummary?.summaryRows instanceof Float32Array
    || Array.isArray(phaseVolumeDiagnosticSummary?.summaryRows);
  const retainedRefs = [
    schroederPortableRetainedRef({
      family: 'schroeder-level-assignment',
      role: 'native-scale-classification',
      artifact: levelAssignment,
      rowCount: levelAssignment?.particleCount,
      strideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
      byteLength: levelAssignment?.assignmentBufferByteLength ?? levelAssignment?.assignmentByteLength,
      retained: Boolean(levelAssignment?.assignmentBuffer)
    }),
    schroederPortableRetainedRef({
      family: 'schroeder-active-node-list',
      role: 'render-lod-leaf-source',
      artifact: activeNodeList,
      rowCount: activeNodeCount,
      strideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
      byteLength: activeNodeList.activeNodeBufferByteLength ?? activeNodeList.activeNodeByteLength,
      retained: Boolean(activeNodeList.activeNodeBuffer)
    }),
    activeNodeIndex ? schroederPortableRetainedRef({
      family: 'schroeder-active-node-index',
      role: 'small-scene-neighbor-accelerator',
      artifact: activeNodeIndex,
      rowCount: activeNodeIndex.bucketSlotCount,
      strideFloats: 1,
      byteLength: activeNodeIndex.bucketSlotByteLength,
      retained: Boolean(activeNodeIndex.bucketSlotBuffer)
    }) : null,
    activeNodeSortedIndex ? schroederPortableRetainedRef({
      family: 'schroeder-active-node-sorted-index',
      role: 'sorted-radix-neighbor-accelerator',
      artifact: activeNodeSortedIndex,
      rowCount: activeNodeSortedIndex.activeNodeCount,
      strideFloats: 1,
      byteLength: activeNodeSortedIndex.sortedActiveIndexByteLength,
      retained: Boolean(activeNodeSortedIndex.sortedActiveIndexBuffer)
    }) : null,
    lawQueue ? schroederPortableRetainedRef({
      family: 'schroeder-law-queue',
      role: 'near-field-law-work',
      artifact: lawQueue,
      rowCount: lawQueueCount,
      strideFloats: SCHROEDER_LAW_QUEUE_FLOATS,
      byteLength: lawQueue.lawQueueBufferByteLength ?? lawQueue.lawQueueByteLength,
      retained: Boolean(lawQueue.lawQueueBuffer)
    }) : null,
    lawNeighborCandidates ? schroederPortableRetainedRef({
      family: 'schroeder-law-neighbor-candidate',
      role: 'near-field-law-candidates',
      artifact: lawNeighborCandidates,
      rowCount: lawNeighborCandidateCount,
      strideFloats: SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS,
      byteLength: lawNeighborCandidates.neighborCandidateBufferByteLength
        ?? lawNeighborCandidates.neighborCandidateByteLength,
      retained: Boolean(lawNeighborCandidates.neighborCandidateBuffer)
    }) : null,
    hierarchyAggregateNode ? schroederPortableRetainedRef({
      family: 'schroeder-hierarchy-aggregate-node',
      role: 'coherent-aggregate-render-proxy-source',
      artifact: hierarchyAggregateNode,
      rowCount: aggregateNodeCount,
      strideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
      byteLength: hierarchyAggregateNode.aggregateNodeBufferByteLength
        ?? hierarchyAggregateNode.aggregateNodeByteLength,
      retained: Boolean(hierarchyAggregateNode.aggregateNodeBuffer)
    }) : null,
    conservationSummary ? schroederPortableRetainedRef({
      family: 'schroeder-conservation-summary',
      role: 'cross-level-residual-summary',
      artifact: conservationSummary,
      rowCount: conservationSummary.summaryRowCount,
      strideFloats: SCHROEDER_CONSERVATION_SUMMARY_FLOATS,
      byteLength: conservationSummary.summaryBufferByteLength ?? conservationSummary.summaryByteLength,
      retained: Boolean(conservationSummary.summaryBuffer)
    }) : null,
    phaseVolumeDiagnosticSummary ? schroederPortableRetainedRef({
      family: 'schroeder-phase-volume-diagnostic-summary',
      role: 'phase-volume-render-lod-hint',
      artifact: phaseVolumeDiagnosticSummary,
      rowCount: phaseVolumeDiagnosticSummary.summaryRowCount,
      strideFloats: SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS,
      byteLength: phaseVolumeDiagnosticSummary.summaryBufferByteLength
        ?? phaseVolumeDiagnosticSummary.summaryByteLength,
      retained: Boolean(phaseVolumeDiagnosticSummary.summaryBuffer)
    }) : null
  ].filter(Boolean);
  const retainedBufferRefCount = retainedRefs.filter((entry) => entry.retained).length;
  const nativeGridSpacingM = schroederGridSpacingForLevel({
    selectedLevel,
    baseGridSpacingM
  });
  const renderLod = {
    schema: ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA,
    status: 'schroeder-render-lod-summary-planned',
    mode: renderLodMode,
    selectedLevel: Math.round(finiteNumber(selectedLevel, 0)),
    nativeGridSpacingM,
    activeLeafProxyCount: activeNodeCount,
    aggregateProxyCount: aggregateNodeCount,
    lawQueueProxyCount: lawQueueCount,
    phaseVolumeDiagnosticRowsAvailable: phaseDiagnosticRowsAvailable,
    opticalPolicy: 'consume-closure-derived-optics-and-pbr-through-render-pipeline',
    geometryPolicy: aggregateNodeCount > 0
      ? 'aggregate-nodes-for-coherent-bulk-active-nodes-for-leaves'
      : 'active-nodes-as-leaf-lod-proxies',
    fullParticleReadbackRequired: false
  };
  return {
    schema: ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA,
    status: 'schroeder-portable-summary-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-portable-render-lod-summary',
    peerComputeUseCase,
    summaryMode: 'descriptor-only-retained-buffer-summary',
    portableSummaryMode: 'portable-descriptors-not-raw-gpubuffers',
    selectedLevel: Math.round(finiteNumber(selectedLevel, 0)),
    nativeGridSpacingM,
    particleCount,
    activeNodeCount,
    aggregateNodeCount,
    lawQueueCount,
    lawNeighborCandidateCount,
    retainedRefs,
    retainedRefCount: retainedRefs.length,
    retainedBufferRefCount,
    renderLod,
    renderLodStatus: renderLod.status,
    renderLodMode: renderLod.mode,
    transferMode: 'peercompute-portable-summary-descriptors',
    portableMaterializationStatus: 'compact-summary-descriptor-ready-no-gpubuffer-transfer',
    presentationAuthority: 'presentation-consumes-render-lod-summary-not-physics-state',
    stateAuthorityStatus: 'state-manager-admission-required-before-authoritative-remote-replay',
    outputFamilies: [
      'schroeder-portable-summary',
      'schroeder-render-lod-summary',
      'schroeder-retained-buffer-descriptors'
    ],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function schroederGridSpacingForLevel({
  selectedLevel = 0,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL
} = {}) {
  const level = clampInteger(selectedLevel, minLevel, maxLevel);
  const baseDx = finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M);
  return baseDx * (2 ** level);
}

export function createSchroederSameLevelMechanicsPlan({
  sphParticleState,
  mlsMpmParticleState,
  selectedLevel = 0,
  baseGridSpacingM = sphParticleState?.smoothingLengthM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  tileCellCount = DEFAULT_TILE_CELL_COUNT
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const level = clampInteger(selectedLevel, minLevel, maxLevel);
  const nativeGridSpacingM = schroederGridSpacingForLevel({
    selectedLevel: level,
    baseGridSpacingM,
    minLevel,
    maxLevel
  });
  return {
    schema: ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA,
    status: 'schroeder-same-level-mechanics-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_SAME_LEVEL_MECHANICS_SCOPE,
    particleCount: sphParticleState.particleCount,
    selectedLevel: level,
    minLevel: Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)),
    maxLevel: Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)),
    baseGridSpacingM: finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M),
    nativeGridSpacingM,
    tileCellCount: Math.max(1, Math.round(finiteNumber(tileCellCount, DEFAULT_TILE_CELL_COUNT))),
    readbackMode,
    mechanicsBackend: 'mls-mpm-resident-step-selected-schroeder-level',
    denseLocalBackend: 'existing-mls-mpm-ocean-resident-mechanics',
    hierarchyRole: 'same-level-dense-local-mechanics',
    crossLevelCouplingStatus: 'optional-candidate-generation-available-not-yet-consumed',
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export async function runSchroederLevelAssignmentWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  baseGridSpacingM = sphParticleState?.smoothingLengthM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  chartId = 0,
  minSupportRadiusM = 0,
  maxSupportRadiusM = 0,
  fallbackSupportRadiusM = 0,
  hysteresisBand = DEFAULT_HYSTERESIS_BAND,
  retainAssignmentBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederLevelAssignmentWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const plan = createSchroederLevelAssignmentPlan({
    sphParticleState,
    mlsMpmParticleState,
    baseGridSpacingM,
    minLevel,
    maxLevel,
    targetSupportCells,
    supportRadiusScale,
    chartId,
    minSupportRadiusM,
    maxSupportRadiusM,
    fallbackSupportRadiusM,
    hysteresisBand
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedStateBuffer = optionalSourceStateBuffer(sphParticleUpload);
  const borrowedThermoBuffer = optionalSourceThermoBuffer(sphParticleUpload);
  const borrowedMechanicsBuffer = optionalSourceMechanicsBuffer(mlsMpmParticleUpload);
  const stateBuffer = borrowedStateBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-level-sph-state-in', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-level-sph-thermo-in', sphParticleState.thermo);
  const mechanicsBuffer = borrowedMechanicsBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-level-mls-mpm-mechanics-in', mlsMpmParticleState.mechanics);
  const assignmentBuffer = device.createBuffer({
    label: 'ulg-schroeder-level-assignments-out',
    size: plan.assignmentByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-level-assignment-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-level-assignments-readback',
      size: plan.assignmentByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedAssignmentBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederLevelAssignmentParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-level-assignment.v0',
      label: 'ulg-schroeder-level-assignment',
      code: schroederLevelAssignmentWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 2, resource: { buffer: mechanicsBuffer } },
        { binding: 3, resource: { buffer: assignmentBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(plan.particleCount / SCHROEDER_LEVEL_ASSIGNMENT_WORKGROUP_SIZE)));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(assignmentBuffer, 0, readBuffer, 0, plan.assignmentByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let assignments = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      assignments = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.particleCount * SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
      assignmentSchema: plan.schema,
      status: 'schroeder-level-assignment-submitted',
      backend: 'webgpu',
      kernelScope: SCHROEDER_LEVEL_ASSIGNMENT_SCOPE,
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback ? SCHROEDER_NO_FULL_READBACK_MODE : SCHROEDER_FULL_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedAssignmentBuffer: Boolean(retainAssignmentBuffer),
      assignmentBufferByteLength: plan.assignmentByteLength,
      assignments,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainAssignmentBuffer) {
      result.assignmentBuffer = assignmentBuffer;
      result.destroyAssignmentBuffer = () => assignmentBuffer.destroy?.();
      returnedRetainedAssignmentBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedStateBuffer) stateBuffer.destroy?.();
      if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
      if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
      if (!retainAssignmentBuffer || !returnedRetainedAssignmentBuffer) assignmentBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederActiveNodeListWebGpu({
  device,
  levelAssignment,
  tileCellCount = DEFAULT_TILE_CELL_COUNT,
  supportInflateCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minTileSpacingM = 0,
  maxTileSpacingM = 0,
  retainActiveNodeBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederActiveNodeListWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederActiveNodeListPlan({
    levelAssignment,
    tileCellCount,
    supportInflateCells,
    minTileSpacingM,
    maxTileSpacingM
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedAssignmentBuffer = levelAssignment?.assignmentBuffer || null;
  const assignmentRows = levelAssignment?.assignments instanceof Float32Array
    ? levelAssignment.assignments
    : null;
  if (!borrowedAssignmentBuffer && !(assignmentRows instanceof Float32Array)) {
    throw new TypeError('Schroeder active node list requires a retained assignment buffer or explicit assignment rows');
  }
  const assignmentBuffer = borrowedAssignmentBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-active-node-assignment-in', assignmentRows);
  const activeNodeBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-nodes-out',
    size: plan.activeNodeByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-active-nodes-readback',
      size: plan.activeNodeByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedActiveNodeBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederActiveNodeParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-active-node-list.v0',
      label: 'ulg-schroeder-active-node-list',
      code: schroederActiveNodeListWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: assignmentBuffer } },
        { binding: 1, resource: { buffer: activeNodeBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(plan.particleCount / SCHROEDER_ACTIVE_NODE_WORKGROUP_SIZE)));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(activeNodeBuffer, 0, readBuffer, 0, plan.activeNodeByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let activeNodes = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      activeNodes = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.activeCandidateCount * SCHROEDER_ACTIVE_NODE_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
      activeNodeListSchema: plan.schema,
      status: 'schroeder-active-node-list-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback ? SCHROEDER_NO_FULL_READBACK_MODE : SCHROEDER_FULL_ACTIVE_NODE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedActiveNodeBuffer: Boolean(retainActiveNodeBuffer),
      activeNodeBufferByteLength: plan.activeNodeByteLength,
      activeNodes,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainActiveNodeBuffer) {
      result.activeNodeBuffer = activeNodeBuffer;
      result.destroyActiveNodeBuffer = () => activeNodeBuffer.destroy?.();
      returnedRetainedActiveNodeBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedAssignmentBuffer) assignmentBuffer.destroy?.();
      if (!retainActiveNodeBuffer || !returnedRetainedActiveNodeBuffer) activeNodeBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederActiveNodeIndexWebGpu({
  device,
  activeNodeList,
  bucketCount = null,
  bucketSlotCapacity = DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY,
  retainIndexBuffers = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederActiveNodeIndexWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederActiveNodeIndexPlan({
    activeNodeList,
    bucketCount,
    bucketSlotCapacity
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedActiveNodeBuffer = activeNodeList?.activeNodeBuffer || null;
  const activeNodeRows = activeNodeList?.activeNodes instanceof Float32Array
    ? activeNodeList.activeNodes
    : null;
  if (!borrowedActiveNodeBuffer && !(activeNodeRows instanceof Float32Array && activeNodeRows.byteLength > 0)) {
    throw new TypeError('Schroeder active-node index requires a retained active-node buffer or explicit active-node rows');
  }
  const activeNodeBuffer = borrowedActiveNodeBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-active-node-index-active-nodes-in', activeNodeRows);
  const bucketCountBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-index-bucket-counts',
    size: plan.bucketCountByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const bucketSlotBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-index-bucket-slots',
    size: plan.bucketSlotByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const nodeBucketSlotBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-index-node-bucket-slots',
    size: plan.nodeBucketSlotByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const overflowCounterBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-index-overflow-counters',
    size: plan.overflowCounterByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-index-params',
    size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const bucketCountReadBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-active-node-index-bucket-counts-readback',
      size: plan.bucketCountByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  const bucketSlotReadBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-active-node-index-bucket-slots-readback',
      size: plan.bucketSlotByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  const nodeBucketSlotReadBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-active-node-index-node-bucket-slots-readback',
      size: plan.nodeBucketSlotByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  const overflowCounterReadBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-active-node-index-overflow-counters-readback',
      size: plan.overflowCounterByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedIndexBuffers = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederActiveNodeIndexParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'uniform')
    ];
    const clearPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-active-node-index.clear.v0',
      label: 'ulg-schroeder-active-node-index-clear',
      code: schroederActiveNodeIndexWgsl,
      entryPoint: 'clearIndex',
      bindings
    });
    const assignPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-active-node-index.assign.v0',
      label: 'ulg-schroeder-active-node-index-assign',
      code: schroederActiveNodeIndexWgsl,
      entryPoint: 'assignIndex',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: assignPipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: activeNodeBuffer } },
        { binding: 1, resource: { buffer: bucketCountBuffer } },
        { binding: 2, resource: { buffer: bucketSlotBuffer } },
        { binding: 3, resource: { buffer: nodeBucketSlotBuffer } },
        { binding: 4, resource: { buffer: overflowCounterBuffer } },
        { binding: 5, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(clearPipeline.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(Math.max(plan.bucketCount, plan.bucketSlotCount, plan.activeNodeCount, 4) / SCHROEDER_ACTIVE_NODE_INDEX_WORKGROUP_SIZE)
    ));
    pass.setPipeline(assignPipeline.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(plan.activeNodeCount / SCHROEDER_ACTIVE_NODE_INDEX_WORKGROUP_SIZE)));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(bucketCountBuffer, 0, bucketCountReadBuffer, 0, plan.bucketCountByteLength);
      encoder.copyBufferToBuffer(bucketSlotBuffer, 0, bucketSlotReadBuffer, 0, plan.bucketSlotByteLength);
      encoder.copyBufferToBuffer(nodeBucketSlotBuffer, 0, nodeBucketSlotReadBuffer, 0, plan.nodeBucketSlotByteLength);
      encoder.copyBufferToBuffer(overflowCounterBuffer, 0, overflowCounterReadBuffer, 0, plan.overflowCounterByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let bucketCounts = new Uint32Array();
    let bucketSlots = new Uint32Array();
    let nodeBucketSlots = new Uint32Array();
    let overflowCounters = new Uint32Array();
    if (!noFullReadback) {
      await bucketCountReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      bucketCounts = new Uint32Array(bucketCountReadBuffer.getMappedRange()).slice(0, plan.bucketCount);
      bucketCountReadBuffer.unmap();
      await bucketSlotReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      bucketSlots = new Uint32Array(bucketSlotReadBuffer.getMappedRange()).slice(0, plan.bucketSlotCount);
      bucketSlotReadBuffer.unmap();
      await nodeBucketSlotReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      nodeBucketSlots = new Uint32Array(nodeBucketSlotReadBuffer.getMappedRange()).slice(0, plan.activeNodeCount);
      nodeBucketSlotReadBuffer.unmap();
      await overflowCounterReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      overflowCounters = new Uint32Array(overflowCounterReadBuffer.getMappedRange()).slice(0, 4);
      overflowCounterReadBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA,
      activeNodeIndexSchema: plan.schema,
      status: 'schroeder-active-node-index-submitted',
      backend: 'webgpu',
      clearPipelineCacheStatus: clearPipeline.cacheStatus,
      assignPipelineCacheStatus: assignPipeline.cacheStatus,
      readbackMode: noFullReadback ? SCHROEDER_NO_FULL_READBACK_MODE : SCHROEDER_FULL_ACTIVE_NODE_INDEX_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedIndexBuffers: Boolean(retainIndexBuffers),
      bucketCounts,
      bucketSlots,
      nodeBucketSlots,
      overflowCounters,
      indexStatus: 'bucketed-active-node-index-submitted',
      capacityStatus: plan.capacityStatus,
      indexCoverageStatus: plan.indexCoverageStatus,
      stateMutationStatus: 'active-node-index-submitted-no-state-mutation',
      stateAuthorityStatus: 'index-buffer-derived-from-active-node-list-no-state-admission-required',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainIndexBuffers) {
      result.bucketCountBuffer = bucketCountBuffer;
      result.bucketSlotBuffer = bucketSlotBuffer;
      result.nodeBucketSlotBuffer = nodeBucketSlotBuffer;
      result.overflowCounterBuffer = overflowCounterBuffer;
      result.destroyIndexBuffers = () => {
        bucketCountBuffer.destroy?.();
        bucketSlotBuffer.destroy?.();
        nodeBucketSlotBuffer.destroy?.();
        overflowCounterBuffer.destroy?.();
      };
      returnedRetainedIndexBuffers = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedActiveNodeBuffer) activeNodeBuffer.destroy?.();
      if (!retainIndexBuffers || !returnedRetainedIndexBuffers) {
        bucketCountBuffer.destroy?.();
        bucketSlotBuffer.destroy?.();
        nodeBucketSlotBuffer.destroy?.();
        overflowCounterBuffer.destroy?.();
      }
      paramsBuffer.destroy?.();
      bucketCountReadBuffer?.destroy?.();
      bucketSlotReadBuffer?.destroy?.();
      nodeBucketSlotReadBuffer?.destroy?.();
      overflowCounterReadBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederActiveNodeSortedIndexWebGpu({
  device,
  activeNodeList,
  bucketCount = null,
  retainIndexBuffers = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederActiveNodeSortedIndexWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederActiveNodeSortedIndexPlan({
    activeNodeList,
    bucketCount
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedActiveNodeBuffer = activeNodeList?.activeNodeBuffer || null;
  const activeNodeRows = activeNodeList?.activeNodes instanceof Float32Array
    ? activeNodeList.activeNodes
    : null;
  if (!borrowedActiveNodeBuffer && !(activeNodeRows instanceof Float32Array && activeNodeRows.byteLength > 0)) {
    throw new TypeError('Schroeder sorted active-node index requires a retained active-node buffer or explicit active-node rows');
  }
  const activeNodeBuffer = borrowedActiveNodeBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-active-node-sorted-index-active-nodes-in', activeNodeRows);
  const bucketCountBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-sorted-index-bucket-counts',
    size: plan.bucketCountByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const bucketRangeOffsetBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-sorted-index-bucket-range-offsets',
    size: plan.bucketRangeOffsetByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const bucketCursorBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-sorted-index-bucket-cursors',
    size: plan.bucketCursorByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const sortedActiveIndexBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-sorted-index-active-indices',
    size: plan.sortedActiveIndexByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const diagnosticCounterBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-sorted-index-diagnostic-counters',
    size: plan.diagnosticCounterByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-sorted-index-params',
    size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const bucketCountReadBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-active-node-sorted-index-bucket-counts-readback',
      size: plan.bucketCountByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  const bucketRangeOffsetReadBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-active-node-sorted-index-bucket-range-offsets-readback',
      size: plan.bucketRangeOffsetByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  const sortedActiveIndexReadBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-active-node-sorted-index-active-indices-readback',
      size: plan.sortedActiveIndexByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  const diagnosticCounterReadBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-active-node-sorted-index-diagnostic-counters-readback',
      size: plan.diagnosticCounterByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedIndexBuffers = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederActiveNodeSortedIndexParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'uniform')
    ];
    const clearPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-active-node-sorted-index.clear.v0',
      label: 'ulg-schroeder-active-node-sorted-index-clear',
      code: schroederActiveNodeSortedIndexWgsl,
      entryPoint: 'clearSortedIndex',
      bindings
    });
    const countPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-active-node-sorted-index.count.v0',
      label: 'ulg-schroeder-active-node-sorted-index-count',
      code: schroederActiveNodeSortedIndexWgsl,
      entryPoint: 'countSortedIndex',
      bindings
    });
    const prefixPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-active-node-sorted-index.prefix.v0',
      label: 'ulg-schroeder-active-node-sorted-index-prefix',
      code: schroederActiveNodeSortedIndexWgsl,
      entryPoint: 'prefixSortedIndex',
      bindings
    });
    const scatterPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-active-node-sorted-index.scatter.v0',
      label: 'ulg-schroeder-active-node-sorted-index-scatter',
      code: schroederActiveNodeSortedIndexWgsl,
      entryPoint: 'scatterSortedIndex',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: scatterPipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: activeNodeBuffer } },
        { binding: 1, resource: { buffer: bucketCountBuffer } },
        { binding: 2, resource: { buffer: bucketRangeOffsetBuffer } },
        { binding: 3, resource: { buffer: bucketCursorBuffer } },
        { binding: 4, resource: { buffer: sortedActiveIndexBuffer } },
        { binding: 5, resource: { buffer: diagnosticCounterBuffer } },
        { binding: 6, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(clearPipeline.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(Math.max(plan.bucketRangeOffsetCount, plan.activeNodeCount, 4) / SCHROEDER_ACTIVE_NODE_SORTED_INDEX_WORKGROUP_SIZE)
    ));
    pass.setPipeline(countPipeline.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(plan.activeNodeCount / SCHROEDER_ACTIVE_NODE_SORTED_INDEX_WORKGROUP_SIZE)));
    pass.setPipeline(prefixPipeline.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.setPipeline(scatterPipeline.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(plan.activeNodeCount / SCHROEDER_ACTIVE_NODE_SORTED_INDEX_WORKGROUP_SIZE)));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(bucketCountBuffer, 0, bucketCountReadBuffer, 0, plan.bucketCountByteLength);
      encoder.copyBufferToBuffer(
        bucketRangeOffsetBuffer,
        0,
        bucketRangeOffsetReadBuffer,
        0,
        plan.bucketRangeOffsetByteLength
      );
      encoder.copyBufferToBuffer(sortedActiveIndexBuffer, 0, sortedActiveIndexReadBuffer, 0, plan.sortedActiveIndexByteLength);
      encoder.copyBufferToBuffer(
        diagnosticCounterBuffer,
        0,
        diagnosticCounterReadBuffer,
        0,
        plan.diagnosticCounterByteLength
      );
    }
    device.queue.submit([encoder.finish()]);

    let bucketCounts = new Uint32Array();
    let bucketRangeOffsets = new Uint32Array();
    let sortedActiveIndices = new Uint32Array();
    let diagnosticCounters = new Uint32Array();
    if (!noFullReadback) {
      await bucketCountReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      bucketCounts = new Uint32Array(bucketCountReadBuffer.getMappedRange()).slice(0, plan.bucketCount);
      bucketCountReadBuffer.unmap();
      await bucketRangeOffsetReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      bucketRangeOffsets = new Uint32Array(bucketRangeOffsetReadBuffer.getMappedRange()).slice(
        0,
        plan.bucketRangeOffsetCount
      );
      bucketRangeOffsetReadBuffer.unmap();
      await sortedActiveIndexReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      sortedActiveIndices = new Uint32Array(sortedActiveIndexReadBuffer.getMappedRange()).slice(0, plan.activeNodeCount);
      sortedActiveIndexReadBuffer.unmap();
      await diagnosticCounterReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      diagnosticCounters = new Uint32Array(diagnosticCounterReadBuffer.getMappedRange()).slice(0, 4);
      diagnosticCounterReadBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA,
      activeNodeSortedIndexSchema: plan.schema,
      status: 'schroeder-active-node-sorted-index-submitted',
      backend: 'webgpu',
      clearPipelineCacheStatus: clearPipeline.cacheStatus,
      countPipelineCacheStatus: countPipeline.cacheStatus,
      prefixPipelineCacheStatus: prefixPipeline.cacheStatus,
      scatterPipelineCacheStatus: scatterPipeline.cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_ACTIVE_NODE_SORTED_INDEX_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedIndexBuffers: Boolean(retainIndexBuffers),
      bucketCounts,
      bucketRangeOffsets,
      sortedActiveIndices,
      diagnosticCounters,
      indexStatus: 'sorted-radix-active-node-index-submitted',
      capacityStatus: plan.capacityStatus,
      indexCoverageStatus: plan.indexCoverageStatus,
      stateMutationStatus: 'active-node-sorted-index-submitted-no-state-mutation',
      stateAuthorityStatus: 'index-buffer-derived-from-active-node-list-no-state-admission-required',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainIndexBuffers) {
      result.bucketCountBuffer = bucketCountBuffer;
      result.bucketRangeOffsetBuffer = bucketRangeOffsetBuffer;
      result.bucketCursorBuffer = bucketCursorBuffer;
      result.sortedActiveIndexBuffer = sortedActiveIndexBuffer;
      result.diagnosticCounterBuffer = diagnosticCounterBuffer;
      result.destroyIndexBuffers = () => {
        bucketCountBuffer.destroy?.();
        bucketRangeOffsetBuffer.destroy?.();
        bucketCursorBuffer.destroy?.();
        sortedActiveIndexBuffer.destroy?.();
        diagnosticCounterBuffer.destroy?.();
      };
      returnedRetainedIndexBuffers = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedActiveNodeBuffer) activeNodeBuffer.destroy?.();
      if (!retainIndexBuffers || !returnedRetainedIndexBuffers) {
        bucketCountBuffer.destroy?.();
        bucketRangeOffsetBuffer.destroy?.();
        bucketCursorBuffer.destroy?.();
        sortedActiveIndexBuffer.destroy?.();
        diagnosticCounterBuffer.destroy?.();
      }
      paramsBuffer.destroy?.();
      bucketCountReadBuffer?.destroy?.();
      bucketRangeOffsetReadBuffer?.destroy?.();
      sortedActiveIndexReadBuffer?.destroy?.();
      diagnosticCounterReadBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederLawQueueWebGpu({
  device,
  activeNodeList,
  enabledLawMask = SCHROEDER_LOCAL_LAW_QUEUE_MASK,
  candidateBudget = DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET,
  queueEpoch = 0,
  stateFamilyId = 1,
  retainLawQueueBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederLawQueueWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederLawQueuePlan({
    activeNodeList,
    enabledLawMask,
    candidateBudget,
    queueEpoch,
    stateFamilyId
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedActiveNodeBuffer = activeNodeList?.activeNodeBuffer || null;
  const activeNodeRows = activeNodeList?.activeNodes instanceof Float32Array
    ? activeNodeList.activeNodes
    : null;
  if (!borrowedActiveNodeBuffer && !(activeNodeRows instanceof Float32Array)) {
    throw new TypeError('Schroeder law queue requires a retained active-node buffer or explicit active-node rows');
  }
  const activeNodeBuffer = borrowedActiveNodeBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-law-queue-active-node-in', activeNodeRows);
  const lawQueueBuffer = device.createBuffer({
    label: 'ulg-schroeder-law-queue-out',
    size: plan.lawQueueByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-law-queue-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-law-queue-readback',
      size: plan.lawQueueByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedLawQueueBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederLawQueueParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-law-queue.v0',
      label: 'ulg-schroeder-law-queue',
      code: schroederLawQueueWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: activeNodeBuffer } },
        { binding: 1, resource: { buffer: lawQueueBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(plan.activeNodeCount / SCHROEDER_LAW_QUEUE_WORKGROUP_SIZE)));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(lawQueueBuffer, 0, readBuffer, 0, plan.lawQueueByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let lawQueueRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      lawQueueRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.activeNodeCount * SCHROEDER_LAW_QUEUE_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
      lawQueueSchema: plan.schema,
      status: 'schroeder-law-queue-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback ? SCHROEDER_NO_FULL_READBACK_MODE : SCHROEDER_FULL_LAW_QUEUE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedLawQueueBuffer: Boolean(retainLawQueueBuffer),
      lawQueueBufferByteLength: plan.lawQueueByteLength,
      lawQueueRows,
      lawQueueStatus: 'local-law-queues-submitted',
      exactNearFieldRequirement: plan.exactNearFieldRequirement,
      aggregateAdmissibilityStatus: plan.aggregateAdmissibilityStatus,
      reactionScopeStatus: plan.reactionScopeStatus,
      conservativeTransferStatus: 'local-law-queue-descriptors-submitted-no-transfer',
      stateMutationStatus: 'law-queue-buffer-submitted-no-state-mutation',
      stateAuthorityStatus: 'state-manager-admission-required-before-law-output-mutation',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainLawQueueBuffer) {
      result.lawQueueBuffer = lawQueueBuffer;
      result.destroyLawQueueBuffer = () => lawQueueBuffer.destroy?.();
      returnedRetainedLawQueueBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedActiveNodeBuffer) activeNodeBuffer.destroy?.();
      if (!retainLawQueueBuffer || !returnedRetainedLawQueueBuffer) lawQueueBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederLawNeighborCandidateWebGpu({
  device,
  lawQueue,
  activeNodeList,
  activeNodeIndex = null,
  activeNodeSortedIndex = null,
  sphParticleState = null,
  sphParticleUpload = null,
  sourceStateBuffer = null,
  sourceActiveNodeBuffer = null,
  sourceActiveNodeIndexBucketSlotBuffer = null,
  sourceActiveNodeSortedIndexBucketRangeOffsetBuffer = null,
  sourceActiveNodeSortedIndexActiveIndexBuffer = null,
  particleCount = null,
  candidateBudget = lawQueue?.candidateBudget ?? DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET,
  enabledLawMask = lawQueue?.enabledLawMask ?? SCHROEDER_LOCAL_LAW_QUEUE_MASK,
  retainNeighborCandidateBuffer = true,
  retainDiagnosticCounterBuffer = true,
  traversalPolicyMode = SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE,
  traversalPolicyFallbackScanRatioThreshold = DEFAULT_SCHROEDER_LAW_NEIGHBOR_FALLBACK_SCAN_RATIO_THRESHOLD,
  traversalPolicyBucketPressureRatioThreshold = DEFAULT_SCHROEDER_LAW_NEIGHBOR_BUCKET_PRESSURE_RATIO_THRESHOLD,
  sortedRadixTraversalAvailable = false,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederLawNeighborCandidateWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederLawNeighborCandidatePlan({
    lawQueue,
    activeNodeList,
    activeNodeIndex,
    activeNodeSortedIndex,
    sphParticleState,
    sphParticleUpload,
    particleCount,
    candidateBudget,
    enabledLawMask
  });
  const compactDiagnosticReadback = readbackMode === SCHROEDER_COMPACT_LAW_NEIGHBOR_DIAGNOSTIC_READBACK_MODE;
  const fullCandidateReadback = readbackMode !== SCHROEDER_NO_FULL_READBACK_MODE && !compactDiagnosticReadback;
  const noFullReadback = !fullCandidateReadback;
  const borrowedLawQueueBuffer = lawQueue?.lawQueueBuffer || null;
  const lawQueueRows = lawQueue?.lawQueueRows instanceof Float32Array
    ? lawQueue.lawQueueRows
    : null;
  if (!borrowedLawQueueBuffer && !(lawQueueRows instanceof Float32Array && lawQueueRows.byteLength > 0)) {
    throw new TypeError('Schroeder law-neighbor candidates require a retained law queue buffer or explicit law queue rows');
  }
  const borrowedActiveNodeBuffer = sourceActiveNodeBuffer || activeNodeList?.activeNodeBuffer || null;
  const activeNodeRows = activeNodeList?.activeNodes instanceof Float32Array
    ? activeNodeList.activeNodes
    : null;
  if (!borrowedActiveNodeBuffer && !(activeNodeRows instanceof Float32Array && activeNodeRows.byteLength > 0)) {
    throw new TypeError('Schroeder law-neighbor candidates require a retained active-node buffer or explicit active-node rows');
  }
  const borrowedStateBuffer = sourceStateBuffer
    || optionalSourceStateBuffer(sphParticleUpload)
    || sphParticleUpload?.stateBuffer
    || sphParticleState?.stateBuffer
    || null;
  const stateRows = sphParticleState?.state instanceof Float32Array ? sphParticleState.state : null;
  if (!borrowedStateBuffer && !(stateRows instanceof Float32Array && stateRows.byteLength > 0)) {
    throw new TypeError('Schroeder law-neighbor candidates require a retained/uploaded state buffer or explicit SPH state rows');
  }
  const lawQueueBuffer = borrowedLawQueueBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-law-neighbor-law-queue-in', lawQueueRows);
  const activeNodeBuffer = borrowedActiveNodeBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-law-neighbor-active-node-in', activeNodeRows);
  const stateBuffer = borrowedStateBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-law-neighbor-sph-state-in', stateRows);
  const borrowedActiveNodeIndexBucketSlotBuffer = plan.activeNodeIndexEnabled
    ? (sourceActiveNodeIndexBucketSlotBuffer || activeNodeIndex?.bucketSlotBuffer || null)
    : null;
  const activeNodeIndexBucketSlots = activeNodeIndex?.bucketSlots instanceof Uint32Array
    ? activeNodeIndex.bucketSlots
    : null;
  if (
    plan.activeNodeIndexEnabled
    && !borrowedActiveNodeIndexBucketSlotBuffer
    && !(activeNodeIndexBucketSlots instanceof Uint32Array && activeNodeIndexBucketSlots.byteLength > 0)
  ) {
    throw new TypeError('Schroeder law-neighbor indexed traversal requires retained active-node bucket slots');
  }
  const activeNodeIndexBucketSlotBuffer = plan.activeNodeIndexEnabled
    ? (borrowedActiveNodeIndexBucketSlotBuffer
      || writeStorageBuffer(device, 'ulg-schroeder-law-neighbor-active-node-index-slots-in', activeNodeIndexBucketSlots))
    : writeStorageBuffer(
      device,
      'ulg-schroeder-law-neighbor-active-node-index-slots-dummy',
      new Uint32Array([0xffffffff])
    );
  const borrowedActiveNodeSortedIndexBucketRangeOffsetBuffer = plan.activeNodeSortedIndexEnabled
    ? (sourceActiveNodeSortedIndexBucketRangeOffsetBuffer || activeNodeSortedIndex?.bucketRangeOffsetBuffer || null)
    : null;
  const borrowedActiveNodeSortedIndexActiveIndexBuffer = plan.activeNodeSortedIndexEnabled
    ? (sourceActiveNodeSortedIndexActiveIndexBuffer || activeNodeSortedIndex?.sortedActiveIndexBuffer || null)
    : null;
  const activeNodeSortedIndexBucketRangeOffsets = activeNodeSortedIndex?.bucketRangeOffsets instanceof Uint32Array
    ? activeNodeSortedIndex.bucketRangeOffsets
    : null;
  const activeNodeSortedIndices = activeNodeSortedIndex?.sortedActiveIndices instanceof Uint32Array
    ? activeNodeSortedIndex.sortedActiveIndices
    : null;
  if (
    plan.activeNodeSortedIndexEnabled
    && !borrowedActiveNodeSortedIndexBucketRangeOffsetBuffer
    && !(activeNodeSortedIndexBucketRangeOffsets instanceof Uint32Array && activeNodeSortedIndexBucketRangeOffsets.byteLength > 0)
  ) {
    throw new TypeError('Schroeder law-neighbor sorted traversal requires retained bucket range offsets');
  }
  if (
    plan.activeNodeSortedIndexEnabled
    && !borrowedActiveNodeSortedIndexActiveIndexBuffer
    && !(activeNodeSortedIndices instanceof Uint32Array && activeNodeSortedIndices.byteLength > 0)
  ) {
    throw new TypeError('Schroeder law-neighbor sorted traversal requires retained sorted active indices');
  }
  const activeNodeSortedIndexBucketRangeOffsetBuffer = plan.activeNodeSortedIndexEnabled
    ? (borrowedActiveNodeSortedIndexBucketRangeOffsetBuffer
      || writeStorageBuffer(
        device,
        'ulg-schroeder-law-neighbor-active-node-sorted-index-range-offsets-in',
        activeNodeSortedIndexBucketRangeOffsets
      ))
    : writeStorageBuffer(
      device,
      'ulg-schroeder-law-neighbor-active-node-sorted-index-range-offsets-dummy',
      new Uint32Array([0, 0])
    );
  const activeNodeSortedIndexActiveIndexBuffer = plan.activeNodeSortedIndexEnabled
    ? (borrowedActiveNodeSortedIndexActiveIndexBuffer
      || writeStorageBuffer(
        device,
        'ulg-schroeder-law-neighbor-active-node-sorted-index-active-indices-in',
        activeNodeSortedIndices
      ))
    : writeStorageBuffer(
      device,
      'ulg-schroeder-law-neighbor-active-node-sorted-index-active-indices-dummy',
      new Uint32Array([0xffffffff])
    );
  const neighborCandidateBuffer = device.createBuffer({
    label: 'ulg-schroeder-law-neighbor-candidates-out',
    size: plan.neighborCandidateByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const sourceCandidateSpanBuffer = device.createBuffer({
    label: 'ulg-schroeder-law-neighbor-source-spans-out',
    size: plan.sourceCandidateSpanByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const diagnosticCounterBuffer = device.createBuffer({
    label: 'ulg-schroeder-law-neighbor-diagnostic-counters',
    size: plan.diagnosticCounterByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-law-neighbor-candidates-params',
    size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const candidateReadBuffer = !fullCandidateReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-law-neighbor-candidates-readback',
      size: plan.neighborCandidateByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  const sourceSpanReadBuffer = !fullCandidateReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-law-neighbor-source-spans-readback',
      size: plan.sourceCandidateSpanByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  const diagnosticReadBuffer = !(compactDiagnosticReadback || fullCandidateReadback)
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-law-neighbor-diagnostic-counters-readback',
      size: plan.diagnosticCounterByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedNeighborCandidateBuffer = false;
  let returnedRetainedSourceCandidateSpanBuffer = false;
  let returnedRetainedDiagnosticCounterBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederLawNeighborCandidateParamsArray(plan));
    device.queue.writeBuffer(diagnosticCounterBuffer, 0, new Uint32Array(plan.diagnosticCounterCount));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'uniform'),
      computeBufferBinding(6, 'read-only-storage'),
      computeBufferBinding(7, 'storage'),
      computeBufferBinding(8, 'read-only-storage'),
      computeBufferBinding(9, 'read-only-storage')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-law-neighbor-candidates.active-node-traversal.v5',
      label: 'ulg-schroeder-law-neighbor-candidates',
      code: schroederLawNeighborCandidateWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: lawQueueBuffer } },
        { binding: 1, resource: { buffer: activeNodeBuffer } },
        { binding: 2, resource: { buffer: stateBuffer } },
        { binding: 3, resource: { buffer: neighborCandidateBuffer } },
        { binding: 4, resource: { buffer: sourceCandidateSpanBuffer } },
        { binding: 5, resource: { buffer: paramsBuffer } },
        { binding: 6, resource: { buffer: activeNodeIndexBucketSlotBuffer } },
        { binding: 7, resource: { buffer: diagnosticCounterBuffer } },
        { binding: 8, resource: { buffer: activeNodeSortedIndexBucketRangeOffsetBuffer } },
        { binding: 9, resource: { buffer: activeNodeSortedIndexActiveIndexBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.neighborCandidateCount / SCHROEDER_LAW_NEIGHBOR_CANDIDATE_WORKGROUP_SIZE)
    ));
    pass.end();
    if (fullCandidateReadback) {
      encoder.copyBufferToBuffer(
        neighborCandidateBuffer,
        0,
        candidateReadBuffer,
        0,
        plan.neighborCandidateByteLength
      );
      encoder.copyBufferToBuffer(
        sourceCandidateSpanBuffer,
        0,
        sourceSpanReadBuffer,
        0,
        plan.sourceCandidateSpanByteLength
      );
    }
    if (compactDiagnosticReadback || fullCandidateReadback) {
      encoder.copyBufferToBuffer(
        diagnosticCounterBuffer,
        0,
        diagnosticReadBuffer,
        0,
        plan.diagnosticCounterByteLength
      );
    }
    device.queue.submit([encoder.finish()]);

    let neighborCandidateRows = new Float32Array();
    let sourceCandidateSpanRows = new Float32Array();
    let diagnosticCounters = new Uint32Array();
    if (fullCandidateReadback) {
      await candidateReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      neighborCandidateRows = new Float32Array(candidateReadBuffer.getMappedRange()).slice(
        0,
        plan.neighborCandidateCount * SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS
      );
      candidateReadBuffer.unmap();
      await sourceSpanReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      sourceCandidateSpanRows = new Float32Array(sourceSpanReadBuffer.getMappedRange()).slice(
        0,
        plan.sourceCandidateSpanCount * SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS
      );
      sourceSpanReadBuffer.unmap();
    }
    if (compactDiagnosticReadback || fullCandidateReadback) {
      await diagnosticReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      diagnosticCounters = new Uint32Array(diagnosticReadBuffer.getMappedRange()).slice(
        0,
        plan.diagnosticCounterCount
      );
      diagnosticReadBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
      neighborCandidateSchema: plan.schema,
      status: 'schroeder-law-neighbor-candidates-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: fullCandidateReadback
        ? SCHROEDER_FULL_LAW_NEIGHBOR_CANDIDATE_READBACK_MODE
        : (compactDiagnosticReadback
          ? SCHROEDER_COMPACT_LAW_NEIGHBOR_DIAGNOSTIC_READBACK_MODE
          : SCHROEDER_NO_FULL_READBACK_MODE),
      fullReadbackPerformed: fullCandidateReadback,
      compactDiagnosticReadbackPerformed: compactDiagnosticReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: readbackMode === SCHROEDER_NO_FULL_READBACK_MODE,
      retainedNeighborCandidateBuffer: Boolean(retainNeighborCandidateBuffer),
      neighborCandidateBufferByteLength: plan.neighborCandidateByteLength,
      neighborCandidateRows,
      retainedSourceCandidateSpanBuffer: Boolean(retainNeighborCandidateBuffer),
      sourceCandidateSpanBufferByteLength: plan.sourceCandidateSpanByteLength,
      sourceCandidateSpanRows,
      retainedDiagnosticCounterBuffer: Boolean(retainDiagnosticCounterBuffer),
      diagnosticCounterBufferByteLength: plan.diagnosticCounterByteLength,
      diagnosticCounters,
      activeNodeIndexEnabled: plan.activeNodeIndexEnabled,
      sourceActiveNodeIndexSchema: plan.sourceActiveNodeIndexSchema,
      sourceActiveNodeIndexStatus: plan.sourceActiveNodeIndexStatus,
      activeNodeIndexBucketCount: plan.activeNodeIndexBucketCount,
      activeNodeIndexBucketSlotCapacity: plan.activeNodeIndexBucketSlotCapacity,
      activeNodeIndexBucketSlotCount: plan.activeNodeIndexBucketSlotCount,
      activeNodeSortedIndexEnabled: plan.activeNodeSortedIndexEnabled,
      sourceActiveNodeSortedIndexSchema: plan.sourceActiveNodeSortedIndexSchema,
      sourceActiveNodeSortedIndexStatus: plan.sourceActiveNodeSortedIndexStatus,
      activeNodeSortedIndexBucketCount: plan.activeNodeSortedIndexBucketCount,
      activeNodeSortedIndexBucketRangeOffsetCount: plan.activeNodeSortedIndexBucketRangeOffsetCount,
      activeNodeIndexConsumerStatus: plan.activeNodeIndexConsumerStatus,
      traversalDiagnosticStatus: 'law-neighbor-traversal-diagnostic-counters-submitted',
      sourceCandidateSpanStatus: 'local-law-neighbor-source-spans-submitted',
      neighborCandidateStatus: 'local-law-neighbor-candidates-submitted',
      conservativeTransferStatus: 'local-law-neighbor-candidates-submitted-no-transfer',
      stateMutationStatus: 'law-neighbor-candidates-buffer-submitted-no-state-mutation',
      stateAuthorityStatus: 'state-manager-admission-required-before-law-neighbor-output-mutation',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    const traversalPolicy = createSchroederLawNeighborTraversalPolicy({
      lawNeighborCandidates: result,
      traversalPolicyMode,
      fallbackScanRatioThreshold: traversalPolicyFallbackScanRatioThreshold,
      bucketPressureRatioThreshold: traversalPolicyBucketPressureRatioThreshold,
      sortedRadixTraversalAvailable: sortedRadixTraversalAvailable || plan.activeNodeSortedIndexEnabled
    });
    result.traversalPolicy = traversalPolicy;
    result.traversalPolicyMode = traversalPolicy.policyMode;
    result.traversalPolicyStatus = traversalPolicy.status;
    result.appliedTraversalIndexMode = traversalPolicy.appliedTraversalIndexMode;
    result.recommendedTraversalIndexMode = traversalPolicy.recommendedTraversalIndexMode;
    result.selectedTraversalIndexMode = traversalPolicy.selectedTraversalIndexMode;
    result.sortedRadixIndexRequired = traversalPolicy.sortedRadixIndexRequired;
    result.sortedRadixIndexStatus = traversalPolicy.sortedRadixIndexStatus;
    result.diagnosticCountersAvailable = traversalPolicy.diagnosticCountersAvailable;
    result.diagnosticReadbackRecommended = traversalPolicy.diagnosticReadbackRecommended;
    if (retainNeighborCandidateBuffer) {
      result.neighborCandidateBuffer = neighborCandidateBuffer;
      result.destroyNeighborCandidateBuffer = () => neighborCandidateBuffer.destroy?.();
      result.sourceCandidateSpanBuffer = sourceCandidateSpanBuffer;
      result.destroySourceCandidateSpanBuffer = () => sourceCandidateSpanBuffer.destroy?.();
      returnedRetainedNeighborCandidateBuffer = true;
      returnedRetainedSourceCandidateSpanBuffer = true;
    }
    if (retainDiagnosticCounterBuffer) {
      result.diagnosticCounterBuffer = diagnosticCounterBuffer;
      result.destroyDiagnosticCounterBuffer = () => diagnosticCounterBuffer.destroy?.();
      returnedRetainedDiagnosticCounterBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedLawQueueBuffer) lawQueueBuffer.destroy?.();
      if (!borrowedActiveNodeBuffer) activeNodeBuffer.destroy?.();
      if (!borrowedStateBuffer) stateBuffer.destroy?.();
      if (!borrowedActiveNodeIndexBucketSlotBuffer) activeNodeIndexBucketSlotBuffer.destroy?.();
      if (!borrowedActiveNodeSortedIndexBucketRangeOffsetBuffer) {
        activeNodeSortedIndexBucketRangeOffsetBuffer.destroy?.();
      }
      if (!borrowedActiveNodeSortedIndexActiveIndexBuffer) {
        activeNodeSortedIndexActiveIndexBuffer.destroy?.();
      }
      if (!retainNeighborCandidateBuffer || !returnedRetainedNeighborCandidateBuffer) {
        neighborCandidateBuffer.destroy?.();
      }
      if (!retainNeighborCandidateBuffer || !returnedRetainedSourceCandidateSpanBuffer) {
        sourceCandidateSpanBuffer.destroy?.();
      }
      if (!retainDiagnosticCounterBuffer || !returnedRetainedDiagnosticCounterBuffer) {
        diagnosticCounterBuffer.destroy?.();
      }
      paramsBuffer.destroy?.();
      candidateReadBuffer?.destroy?.();
      sourceSpanReadBuffer?.destroy?.();
      diagnosticReadBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederCrossLevelCouplingWebGpu({
  device,
  levelAssignment,
  activeNodeList,
  parentLevelDelta = 1,
  baseGridSpacingM = levelAssignment?.baseGridSpacingM ?? DEFAULT_BASE_GRID_SPACING_M,
  maxLevel = levelAssignment?.maxLevel ?? DEFAULT_MAX_LEVEL,
  couplingHaloCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minCouplingRadiusM = 0,
  maxCouplingRadiusM = 0,
  tileCellCount = activeNodeList?.tileCellCount ?? DEFAULT_TILE_CELL_COUNT,
  retainCrossLevelBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederCrossLevelCouplingWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederCrossLevelCouplingPlan({
    levelAssignment,
    activeNodeList,
    parentLevelDelta,
    baseGridSpacingM,
    maxLevel,
    couplingHaloCells,
    minCouplingRadiusM,
    maxCouplingRadiusM,
    tileCellCount
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedAssignmentBuffer = levelAssignment?.assignmentBuffer || null;
  const assignmentRows = levelAssignment?.assignments instanceof Float32Array
    ? levelAssignment.assignments
    : null;
  if (!borrowedAssignmentBuffer && !(assignmentRows instanceof Float32Array)) {
    throw new TypeError('Schroeder cross-level coupling requires a retained assignment buffer or explicit assignment rows');
  }
  const borrowedActiveNodeBuffer = activeNodeList?.activeNodeBuffer || null;
  const activeNodeRows = activeNodeList?.activeNodes instanceof Float32Array
    ? activeNodeList.activeNodes
    : null;
  if (!borrowedActiveNodeBuffer && !(activeNodeRows instanceof Float32Array)) {
    throw new TypeError('Schroeder cross-level coupling requires a retained active-node buffer or explicit active-node rows');
  }
  const assignmentBuffer = borrowedAssignmentBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-cross-level-assignment-in', assignmentRows);
  const activeNodeBuffer = borrowedActiveNodeBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-cross-level-active-node-in', activeNodeRows);
  const crossLevelBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-couplings-out',
    size: plan.crossLevelByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-cross-level-couplings-readback',
      size: plan.crossLevelByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedCrossLevelBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederCrossLevelCouplingParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-cross-level-coupling.v0',
      label: 'ulg-schroeder-cross-level-coupling',
      code: schroederCrossLevelCouplingWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: assignmentBuffer } },
        { binding: 1, resource: { buffer: activeNodeBuffer } },
        { binding: 2, resource: { buffer: crossLevelBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.particleCount / SCHROEDER_CROSS_LEVEL_COUPLING_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(crossLevelBuffer, 0, readBuffer, 0, plan.crossLevelByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let crossLevelCouplings = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      crossLevelCouplings = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.crossLevelCandidateCount * SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA,
      crossLevelCouplingSchema: plan.schema,
      status: 'schroeder-cross-level-coupling-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback ? SCHROEDER_NO_FULL_READBACK_MODE : SCHROEDER_FULL_CROSS_LEVEL_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedCrossLevelBuffer: Boolean(retainCrossLevelBuffer),
      crossLevelBufferByteLength: plan.crossLevelByteLength,
      crossLevelCouplings,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainCrossLevelBuffer) {
      result.crossLevelBuffer = crossLevelBuffer;
      result.destroyCrossLevelBuffer = () => crossLevelBuffer.destroy?.();
      returnedRetainedCrossLevelBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedAssignmentBuffer) assignmentBuffer.destroy?.();
      if (!borrowedActiveNodeBuffer) activeNodeBuffer.destroy?.();
      if (!retainCrossLevelBuffer || !returnedRetainedCrossLevelBuffer) crossLevelBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederConservationSummaryWebGpu({
  device,
  crossLevelCoupling,
  retainSummaryBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederConservationSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederConservationSummaryPlan({ crossLevelCoupling });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedCrossLevelBuffer = crossLevelCoupling?.crossLevelBuffer || null;
  const crossLevelRows = crossLevelCoupling?.crossLevelCouplings instanceof Float32Array
    ? crossLevelCoupling.crossLevelCouplings
    : null;
  if (!borrowedCrossLevelBuffer && !(crossLevelRows instanceof Float32Array)) {
    throw new TypeError('Schroeder conservation summary requires a retained cross-level buffer or explicit rows');
  }
  const crossLevelBuffer = borrowedCrossLevelBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-conservation-cross-level-in', crossLevelRows);
  const summaryBuffer = device.createBuffer({
    label: 'ulg-schroeder-conservation-summary-out',
    size: plan.summaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-conservation-summary-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-conservation-summary-readback',
      size: plan.summaryByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedSummaryBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederConservationSummaryParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-conservation-summary.v0',
      label: 'ulg-schroeder-conservation-summary',
      code: schroederConservationSummaryWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: crossLevelBuffer } },
        { binding: 1, resource: { buffer: summaryBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(plan.summaryRowCount);
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(summaryBuffer, 0, readBuffer, 0, plan.summaryByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let summaryRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      summaryRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.summaryRowCount * SCHROEDER_CONSERVATION_SUMMARY_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
      conservationSummarySchema: plan.schema,
      status: 'schroeder-conservation-summary-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_CONSERVATION_SUMMARY_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedSummaryBuffer: Boolean(retainSummaryBuffer),
      summaryBufferByteLength: plan.summaryByteLength,
      summaryRows,
      residualCounterStatus: 'workgroup-partial-summary-gpu-resident',
      conservativeTransferStatus: 'summary-only-no-state-mutation',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainSummaryBuffer) {
      result.summaryBuffer = summaryBuffer;
      result.destroySummaryBuffer = () => summaryBuffer.destroy?.();
      returnedRetainedSummaryBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedCrossLevelBuffer) crossLevelBuffer.destroy?.();
      if (!retainSummaryBuffer || !returnedRetainedSummaryBuffer) summaryBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederCrossLevelTransferWebGpu({
  device,
  sphParticleState,
  sphParticleUpload = null,
  crossLevelCoupling,
  retainTransferBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederCrossLevelTransferWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederCrossLevelTransferPlan({ crossLevelCoupling, sphParticleState });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedCrossLevelBuffer = crossLevelCoupling?.crossLevelBuffer || null;
  const crossLevelRows = crossLevelCoupling?.crossLevelCouplings instanceof Float32Array
    ? crossLevelCoupling.crossLevelCouplings
    : null;
  if (!borrowedCrossLevelBuffer && !(crossLevelRows instanceof Float32Array)) {
    throw new TypeError('Schroeder cross-level transfer requires a retained cross-level buffer or explicit rows');
  }
  const borrowedStateBuffer = optionalSourceStateBuffer(sphParticleUpload);
  const crossLevelBuffer = borrowedCrossLevelBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-transfer-cross-level-in', crossLevelRows);
  const stateBuffer = borrowedStateBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-transfer-sph-state-in', sphParticleState.state);
  const transferBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-transfer-out',
    size: plan.transferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-transfer-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-cross-level-transfer-readback',
      size: plan.transferByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedTransferBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederCrossLevelTransferParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-cross-level-transfer.v0',
      label: 'ulg-schroeder-cross-level-transfer',
      code: schroederCrossLevelTransferWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: crossLevelBuffer } },
        { binding: 1, resource: { buffer: stateBuffer } },
        { binding: 2, resource: { buffer: transferBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.crossLevelCandidateCount / SCHROEDER_CROSS_LEVEL_TRANSFER_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(transferBuffer, 0, readBuffer, 0, plan.transferByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let transferRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      transferRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.crossLevelCandidateCount * SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA,
      crossLevelTransferSchema: plan.schema,
      status: 'schroeder-cross-level-transfer-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_CROSS_LEVEL_TRANSFER_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedTransferBuffer: Boolean(retainTransferBuffer),
      transferBufferByteLength: plan.transferByteLength,
      transferRows,
      conservativeTransferStatus: 'transfer-rows-ready-no-state-mutation',
      stateMutationStatus: 'not-applied-transfer-rows-only',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainTransferBuffer) {
      result.transferBuffer = transferBuffer;
      result.destroyTransferBuffer = () => transferBuffer.destroy?.();
      returnedRetainedTransferBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedCrossLevelBuffer) crossLevelBuffer.destroy?.();
      if (!borrowedStateBuffer) stateBuffer.destroy?.();
      if (!retainTransferBuffer || !returnedRetainedTransferBuffer) transferBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederCrossLevelStateDeltaWebGpu({
  device,
  crossLevelTransfer,
  retainStateDeltaBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederCrossLevelStateDeltaWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederCrossLevelStateDeltaPlan({ crossLevelTransfer });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedTransferBuffer = crossLevelTransfer?.transferBuffer || null;
  const transferRows = crossLevelTransfer?.transferRows instanceof Float32Array
    ? crossLevelTransfer.transferRows
    : null;
  if (!borrowedTransferBuffer && !(transferRows instanceof Float32Array)) {
    throw new TypeError('Schroeder cross-level state delta requires a retained transfer buffer or explicit rows');
  }
  const transferBuffer = borrowedTransferBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-state-delta-transfer-in', transferRows);
  const stateDeltaBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-state-delta-out',
    size: plan.stateDeltaByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-state-delta-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-cross-level-state-delta-readback',
      size: plan.stateDeltaByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedStateDeltaBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederCrossLevelStateDeltaParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-cross-level-state-delta.v0',
      label: 'ulg-schroeder-cross-level-state-delta',
      code: schroederCrossLevelStateDeltaWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: transferBuffer } },
        { binding: 1, resource: { buffer: stateDeltaBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.crossLevelCandidateCount / SCHROEDER_CROSS_LEVEL_STATE_DELTA_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(stateDeltaBuffer, 0, readBuffer, 0, plan.stateDeltaByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let stateDeltaRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      stateDeltaRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.crossLevelCandidateCount * SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA,
      stateDeltaSchema: plan.schema,
      status: 'schroeder-cross-level-state-delta-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_CROSS_LEVEL_STATE_DELTA_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedStateDeltaBuffer: Boolean(retainStateDeltaBuffer),
      stateDeltaBufferByteLength: plan.stateDeltaByteLength,
      stateDeltaRows,
      conservativeTransferStatus: 'state-delta-ready-pending-admission',
      stateMutationStatus: 'pending-state-delta-submitted-awaiting-admission',
      stateAuthorityStatus: 'requires-state-manager-admission-before-authoritative-merge',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainStateDeltaBuffer) {
      result.stateDeltaBuffer = stateDeltaBuffer;
      result.destroyStateDeltaBuffer = () => stateDeltaBuffer.destroy?.();
      returnedRetainedStateDeltaBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedTransferBuffer) transferBuffer.destroy?.();
      if (!retainStateDeltaBuffer || !returnedRetainedStateDeltaBuffer) stateDeltaBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederCrossLevelStateDeltaMergeWebGpu({
  device,
  crossLevelStateDelta,
  stateDeltaMergeAdmission = null,
  mergeEpoch = 0,
  retainMergedStateDeltaBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederCrossLevelStateDeltaMergeWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederCrossLevelStateDeltaMergePlan({
    crossLevelStateDelta,
    stateDeltaMergeAdmission,
    mergeEpoch
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  if (!plan.stateDeltaMergeAdmissionApproved) {
    return {
      ...plan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA,
      stateDeltaMergeSchema: plan.schema,
      status: 'schroeder-cross-level-state-delta-merge-blocked-admission-required',
      backend: 'webgpu',
      readbackMode,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedMergedStateDeltaBuffer: false,
      mergedStateDeltaBufferByteLength: 0,
      mergedStateDeltaRows: new Float32Array(),
      conservativeTransferStatus: 'state-delta-merge-blocked-admission-required',
      stateMutationStatus: 'blocked-state-delta-merge-admission-required',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  const borrowedStateDeltaBuffer = crossLevelStateDelta?.stateDeltaBuffer || null;
  const stateDeltaRows = crossLevelStateDelta?.stateDeltaRows instanceof Float32Array
    ? crossLevelStateDelta.stateDeltaRows
    : null;
  if (!borrowedStateDeltaBuffer && !(stateDeltaRows instanceof Float32Array)) {
    throw new TypeError('Schroeder cross-level state-delta merge requires a retained state-delta buffer or explicit rows');
  }
  const stateDeltaBuffer = borrowedStateDeltaBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-state-delta-merge-in', stateDeltaRows);
  const mergedStateDeltaBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-state-delta-merge-out',
    size: plan.mergeByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-state-delta-merge-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-cross-level-state-delta-merge-readback',
      size: plan.mergeByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedMergedStateDeltaBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederCrossLevelStateDeltaMergeParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-cross-level-state-delta-merge.v0',
      label: 'ulg-schroeder-cross-level-state-delta-merge',
      code: schroederCrossLevelStateDeltaMergeWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: stateDeltaBuffer } },
        { binding: 1, resource: { buffer: mergedStateDeltaBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.crossLevelCandidateCount / SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(mergedStateDeltaBuffer, 0, readBuffer, 0, plan.mergeByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let mergedStateDeltaRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      mergedStateDeltaRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.crossLevelCandidateCount * SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA,
      stateDeltaMergeSchema: plan.schema,
      status: 'schroeder-cross-level-state-delta-merge-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_CROSS_LEVEL_STATE_DELTA_MERGE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedMergedStateDeltaBuffer: Boolean(retainMergedStateDeltaBuffer),
      mergedStateDeltaBufferByteLength: plan.mergeByteLength,
      mergedStateDeltaRows,
      conservativeTransferStatus: 'state-delta-merge-submitted',
      stateMutationStatus: 'admitted-state-delta-merge-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-retained-merge-buffer',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainMergedStateDeltaBuffer) {
      result.mergedStateDeltaBuffer = mergedStateDeltaBuffer;
      result.destroyMergedStateDeltaBuffer = () => mergedStateDeltaBuffer.destroy?.();
      returnedRetainedMergedStateDeltaBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedStateDeltaBuffer) stateDeltaBuffer.destroy?.();
      if (!retainMergedStateDeltaBuffer || !returnedRetainedMergedStateDeltaBuffer) mergedStateDeltaBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederHierarchyAggregateWebGpu({
  device,
  crossLevelStateDeltaMerge,
  retainAggregateBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederHierarchyAggregateWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederHierarchyAggregatePlan({ crossLevelStateDeltaMerge });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedMergeBuffer = crossLevelStateDeltaMerge?.mergedStateDeltaBuffer || null;
  const mergeRows = crossLevelStateDeltaMerge?.mergedStateDeltaRows instanceof Float32Array
    ? crossLevelStateDeltaMerge.mergedStateDeltaRows
    : null;
  if (!borrowedMergeBuffer && !(mergeRows instanceof Float32Array)) {
    throw new TypeError('Schroeder hierarchy aggregate requires a retained merge buffer or explicit rows');
  }
  const mergeBuffer = borrowedMergeBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-hierarchy-aggregate-merge-in', mergeRows);
  const aggregateBuffer = device.createBuffer({
    label: 'ulg-schroeder-hierarchy-aggregate-out',
    size: plan.aggregateByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-hierarchy-aggregate-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-hierarchy-aggregate-readback',
      size: plan.aggregateByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedAggregateBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederHierarchyAggregateParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-hierarchy-aggregate.v0',
      label: 'ulg-schroeder-hierarchy-aggregate',
      code: schroederHierarchyAggregateWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: mergeBuffer } },
        { binding: 1, resource: { buffer: aggregateBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.aggregateRowCount / SCHROEDER_HIERARCHY_AGGREGATE_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(aggregateBuffer, 0, readBuffer, 0, plan.aggregateByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let aggregateRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      aggregateRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.aggregateRowCount * SCHROEDER_HIERARCHY_AGGREGATE_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA,
      hierarchyAggregateSchema: plan.schema,
      status: 'schroeder-hierarchy-aggregate-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_HIERARCHY_AGGREGATE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedAggregateBuffer: Boolean(retainAggregateBuffer),
      aggregateBufferByteLength: plan.aggregateByteLength,
      aggregateRows,
      aggregateReductionStatus: 'pending-keyed-reduction',
      conservativeTransferStatus: 'hierarchy-aggregate-contributions-submitted',
      stateMutationStatus: 'aggregate-contribution-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-merge-buffer-materialized',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainAggregateBuffer) {
      result.aggregateBuffer = aggregateBuffer;
      result.destroyAggregateBuffer = () => aggregateBuffer.destroy?.();
      returnedRetainedAggregateBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedMergeBuffer) mergeBuffer.destroy?.();
      if (!retainAggregateBuffer || !returnedRetainedAggregateBuffer) aggregateBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederHierarchyAggregateNodeReductionWebGpu({
  device,
  hierarchyAggregate,
  retainAggregateNodeBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  aggregateReductionMode = SCHROEDER_AGGREGATE_NODE_REDUCTION_AUTO_MODE,
  bucketCount = null,
  bucketSlotCapacity = DEFAULT_AGGREGATE_NODE_BUCKET_SLOT_CAPACITY
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederHierarchyAggregateNodeReductionWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederHierarchyAggregateNodePlan({
    hierarchyAggregate,
    aggregateReductionMode,
    bucketCount,
    bucketSlotCapacity
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const bucketReduction = plan.aggregateReductionMode === SCHROEDER_BUCKETED_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE;
  const borrowedAggregateBuffer = hierarchyAggregate?.aggregateBuffer || null;
  const aggregateRows = hierarchyAggregate?.aggregateRows instanceof Float32Array
    ? hierarchyAggregate.aggregateRows
    : null;
  if (!borrowedAggregateBuffer && !(aggregateRows instanceof Float32Array)) {
    throw new TypeError('Schroeder hierarchy aggregate-node reduction requires a retained aggregate buffer or explicit rows');
  }
  const aggregateBuffer = borrowedAggregateBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-hierarchy-aggregate-node-in', aggregateRows);
  const aggregateNodeBuffer = device.createBuffer({
    label: 'ulg-schroeder-hierarchy-aggregate-nodes-out',
    size: plan.aggregateNodeByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsArray = createSchroederHierarchyAggregateNodeParamsArray(plan);
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-hierarchy-aggregate-node-params',
    size: paramsArray.byteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const bucketCountBuffer = bucketReduction ? device.createBuffer({
    label: 'ulg-schroeder-hierarchy-aggregate-node-bucket-counts',
    size: plan.bucketCountByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  }) : null;
  const bucketSlotBuffer = bucketReduction ? device.createBuffer({
    label: 'ulg-schroeder-hierarchy-aggregate-node-bucket-slots',
    size: plan.bucketSlotByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  }) : null;
  const rowBucketSlotBuffer = bucketReduction ? device.createBuffer({
    label: 'ulg-schroeder-hierarchy-aggregate-node-row-bucket-slots',
    size: plan.rowBucketSlotByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  }) : null;
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-hierarchy-aggregate-node-readback',
      size: plan.aggregateNodeByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedAggregateNodeBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray);
    if (bucketReduction) {
      device.queue.writeBuffer(bucketCountBuffer, 0, new Uint32Array(plan.bucketCount));
      const bucketSlots = new Uint32Array(plan.bucketSlotCount);
      bucketSlots.fill(0xffffffff);
      device.queue.writeBuffer(bucketSlotBuffer, 0, bucketSlots);
      const rowBucketSlots = new Uint32Array(plan.aggregateRowCount);
      rowBucketSlots.fill(0xffffffff);
      device.queue.writeBuffer(rowBucketSlotBuffer, 0, rowBucketSlots);
    }
    const exactBindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const bucketBindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'uniform')
    ];
    const exactPipeline = bucketReduction ? null : createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-hierarchy-aggregate-node-reduction.v0',
      label: 'ulg-schroeder-hierarchy-aggregate-node-reduction',
      code: schroederHierarchyAggregateNodeReduceWgsl,
      entryPoint: 'main',
      bindings: exactBindings
    });
    const bucketClearPipeline = bucketReduction ? createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-hierarchy-aggregate-node-bucket-reduction-clear.v0',
      label: 'ulg-schroeder-hierarchy-aggregate-node-bucket-clear',
      code: schroederHierarchyAggregateNodeBucketReduceWgsl,
      entryPoint: 'clearBuckets',
      bindings: bucketBindings
    }) : null;
    const bucketAssignPipeline = bucketReduction ? createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-hierarchy-aggregate-node-bucket-reduction-assign.v0',
      label: 'ulg-schroeder-hierarchy-aggregate-node-bucket-assign',
      code: schroederHierarchyAggregateNodeBucketReduceWgsl,
      entryPoint: 'assignBuckets',
      bindings: bucketBindings
    }) : null;
    const bucketReducePipeline = bucketReduction ? createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-hierarchy-aggregate-node-bucket-reduction-reduce.v0',
      label: 'ulg-schroeder-hierarchy-aggregate-node-bucket-reduce',
      code: schroederHierarchyAggregateNodeBucketReduceWgsl,
      entryPoint: 'reduceBuckets',
      bindings: bucketBindings
    }) : null;
    const bindGroup = device.createBindGroup({
      layout: bucketReduction ? bucketReducePipeline.bindGroupLayout : exactPipeline.bindGroupLayout,
      entries: bucketReduction
        ? [
          { binding: 0, resource: { buffer: aggregateBuffer } },
          { binding: 1, resource: { buffer: aggregateNodeBuffer } },
          { binding: 2, resource: { buffer: bucketCountBuffer } },
          { binding: 3, resource: { buffer: bucketSlotBuffer } },
          { binding: 4, resource: { buffer: rowBucketSlotBuffer } },
          { binding: 5, resource: { buffer: paramsBuffer } }
        ]
        : [
          { binding: 0, resource: { buffer: aggregateBuffer } },
          { binding: 1, resource: { buffer: aggregateNodeBuffer } },
          { binding: 2, resource: { buffer: paramsBuffer } }
        ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    if (bucketReduction) {
      pass.setPipeline(bucketClearPipeline.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.max(
        1,
        Math.ceil(
          Math.max(plan.bucketCount, plan.bucketSlotCount, plan.aggregateRowCount)
            / SCHROEDER_HIERARCHY_AGGREGATE_NODE_WORKGROUP_SIZE
        )
      ));
      pass.setPipeline(bucketAssignPipeline.pipeline);
      pass.dispatchWorkgroups(Math.max(
        1,
        Math.ceil(plan.aggregateRowCount / SCHROEDER_HIERARCHY_AGGREGATE_NODE_WORKGROUP_SIZE)
      ));
      pass.setPipeline(bucketReducePipeline.pipeline);
    } else {
      pass.setPipeline(exactPipeline.pipeline);
      pass.setBindGroup(0, bindGroup);
    }
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.aggregateRowCount / SCHROEDER_HIERARCHY_AGGREGATE_NODE_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(aggregateNodeBuffer, 0, readBuffer, 0, plan.aggregateNodeByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let aggregateNodeRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      aggregateNodeRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.aggregateRowCount * SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
      hierarchyAggregateNodeSchema: plan.schema,
      status: 'schroeder-hierarchy-aggregate-node-reduction-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: bucketReduction
        ? bucketReducePipeline.cacheStatus
        : exactPipeline.cacheStatus,
      aggregateBucketClearPipelineCacheStatus: bucketClearPipeline?.cacheStatus ?? null,
      aggregateBucketAssignPipelineCacheStatus: bucketAssignPipeline?.cacheStatus ?? null,
      aggregateBucketReducePipelineCacheStatus: bucketReducePipeline?.cacheStatus ?? null,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_HIERARCHY_AGGREGATE_NODE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedAggregateNodeBuffer: Boolean(retainAggregateNodeBuffer),
      aggregateNodeBufferByteLength: plan.aggregateNodeByteLength,
      aggregateNodeRows,
      aggregateReductionStatus: bucketReduction
        ? 'bucketed-bounded-slot-reduction-submitted'
        : 'exact-first-occurrence-global-scan',
      aggregateReductionMode: plan.aggregateReductionMode,
      bucketCount: plan.bucketCount,
      bucketSlotCapacity: plan.bucketSlotCapacity,
      bucketSlotCount: plan.bucketSlotCount,
      capacityStatus: plan.capacityStatus,
      conservativeTransferStatus: 'hierarchy-aggregate-nodes-submitted',
      stateMutationStatus: 'aggregate-node-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-aggregate-nodes-materialized',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainAggregateNodeBuffer) {
      result.aggregateNodeBuffer = aggregateNodeBuffer;
      result.destroyAggregateNodeBuffer = () => aggregateNodeBuffer.destroy?.();
      returnedRetainedAggregateNodeBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedAggregateBuffer) aggregateBuffer.destroy?.();
      if (!retainAggregateNodeBuffer || !returnedRetainedAggregateNodeBuffer) aggregateNodeBuffer.destroy?.();
      bucketCountBuffer?.destroy?.();
      bucketSlotBuffer?.destroy?.();
      rowBucketSlotBuffer?.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederPhaseVolumeMigrationWebGpu({
  device,
  levelAssignment,
  hierarchyAggregateNode,
  baseGridSpacingM = levelAssignment?.baseGridSpacingM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = levelAssignment?.minLevel ?? DEFAULT_MIN_LEVEL,
  maxLevel = levelAssignment?.maxLevel ?? DEFAULT_MAX_LEVEL,
  targetSupportCells = levelAssignment?.targetSupportCells ?? DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = levelAssignment?.supportRadiusScale ?? DEFAULT_SUPPORT_RADIUS_SCALE,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  coarsenLevelDeltaThreshold = DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD,
  gasPhaseId = DEFAULT_GAS_PHASE_ID,
  migrationEpoch = 0,
  aggregateResidualTolerance = DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE,
  retainMigrationBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederPhaseVolumeMigrationWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederPhaseVolumeMigrationPlan({
    levelAssignment,
    hierarchyAggregateNode,
    baseGridSpacingM,
    minLevel,
    maxLevel,
    targetSupportCells,
    supportRadiusScale,
    phaseVolumeExpandThreshold,
    coarsenLevelDeltaThreshold,
    gasPhaseId,
    migrationEpoch,
    aggregateResidualTolerance
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedAssignmentBuffer = levelAssignment?.assignmentBuffer || null;
  const assignmentRows = levelAssignment?.assignments instanceof Float32Array
    ? levelAssignment.assignments
    : null;
  if (!borrowedAssignmentBuffer && !(assignmentRows instanceof Float32Array)) {
    throw new TypeError('Schroeder phase-volume migration requires a retained assignment buffer or explicit rows');
  }
  const borrowedAggregateNodeBuffer = hierarchyAggregateNode?.aggregateNodeBuffer || null;
  const aggregateNodeRows = hierarchyAggregateNode?.aggregateNodeRows instanceof Float32Array
    ? hierarchyAggregateNode.aggregateNodeRows
    : null;
  if (!borrowedAggregateNodeBuffer && !(aggregateNodeRows instanceof Float32Array)) {
    throw new TypeError('Schroeder phase-volume migration requires a retained aggregate-node buffer or explicit rows');
  }

  const assignmentBuffer = borrowedAssignmentBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-phase-volume-assignment-in', assignmentRows);
  const aggregateNodeBuffer = borrowedAggregateNodeBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-phase-volume-aggregate-node-in', aggregateNodeRows);
  const migrationBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-migration-out',
    size: plan.migrationByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-migration-params',
    size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-phase-volume-migration-readback',
      size: plan.migrationByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedMigrationBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederPhaseVolumeMigrationParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-phase-volume-migration.v0',
      label: 'ulg-schroeder-phase-volume-migration',
      code: schroederPhaseVolumeMigrationWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: assignmentBuffer } },
        { binding: 1, resource: { buffer: aggregateNodeBuffer } },
        { binding: 2, resource: { buffer: migrationBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.particleCount / SCHROEDER_PHASE_VOLUME_MIGRATION_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(migrationBuffer, 0, readBuffer, 0, plan.migrationByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let migrationRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      migrationRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.particleCount * SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
      phaseVolumeMigrationSchema: plan.schema,
      status: 'schroeder-phase-volume-migration-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_PHASE_VOLUME_MIGRATION_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedMigrationBuffer: Boolean(retainMigrationBuffer),
      migrationBufferByteLength: plan.migrationByteLength,
      migrationRows,
      phaseVolumeStatus: 'phase-volume-migration-submitted',
      migrationMode: 'physical-volume-level-target-with-aggregate-coherence',
      aggregateCoherenceRequirement: 'retained-aggregate-node-buffer-consumed',
      conservativeTransferStatus: 'phase-volume-migration-submitted',
      stateMutationStatus: 'phase-volume-migration-buffer-submitted',
      stateAuthorityStatus: 'requires-state-manager-admission-for-authoritative-level-migration',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainMigrationBuffer) {
      result.migrationBuffer = migrationBuffer;
      result.destroyMigrationBuffer = () => migrationBuffer.destroy?.();
      returnedRetainedMigrationBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedAssignmentBuffer) assignmentBuffer.destroy?.();
      if (!borrowedAggregateNodeBuffer) aggregateNodeBuffer.destroy?.();
      if (!retainMigrationBuffer || !returnedRetainedMigrationBuffer) migrationBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederPhaseVolumeLevelUpdateWebGpu({
  device,
  phaseVolumeMigration,
  phaseVolumeMigrationAdmission = null,
  migrationEpoch = phaseVolumeMigration?.migrationEpoch ?? 0,
  stateFamilyId = 1,
  retainLevelUpdateBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederPhaseVolumeLevelUpdateWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederPhaseVolumeLevelUpdatePlan({
    phaseVolumeMigration,
    phaseVolumeMigrationAdmission,
    migrationEpoch,
    stateFamilyId
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  if (!plan.phaseVolumeMigrationAdmissionApproved) {
    return {
      ...plan,
      schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
      phaseVolumeLevelUpdateSchema: plan.schema,
      status: 'schroeder-phase-volume-level-update-blocked-admission-required',
      backend: 'webgpu',
      readbackMode,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedLevelUpdateBuffer: false,
      levelUpdateBufferByteLength: 0,
      levelUpdateRows: new Float32Array(),
      conservativeTransferStatus: 'phase-volume-level-update-blocked-admission-required',
      stateMutationStatus: 'blocked-phase-volume-level-update-admission-required',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  const borrowedMigrationBuffer = phaseVolumeMigration?.migrationBuffer || null;
  const migrationRows = phaseVolumeMigration?.migrationRows instanceof Float32Array
    ? phaseVolumeMigration.migrationRows
    : null;
  if (!borrowedMigrationBuffer && !(migrationRows instanceof Float32Array)) {
    throw new TypeError('Schroeder phase-volume level update requires a retained migration buffer or explicit rows');
  }
  const migrationBuffer = borrowedMigrationBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-phase-volume-level-update-in', migrationRows);
  const levelUpdateBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-level-update-out',
    size: plan.levelUpdateByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-level-update-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-phase-volume-level-update-readback',
      size: plan.levelUpdateByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedLevelUpdateBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederPhaseVolumeLevelUpdateParamsArray({
      ...plan,
      admissionApproved: plan.phaseVolumeMigrationAdmissionApproved
    }));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-phase-volume-level-update.v0',
      label: 'ulg-schroeder-phase-volume-level-update',
      code: schroederPhaseVolumeLevelUpdateWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: migrationBuffer } },
        { binding: 1, resource: { buffer: levelUpdateBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.migrationRowCount / SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(levelUpdateBuffer, 0, readBuffer, 0, plan.levelUpdateByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let levelUpdateRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      levelUpdateRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.migrationRowCount * SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
      phaseVolumeLevelUpdateSchema: plan.schema,
      status: 'schroeder-phase-volume-level-update-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_PHASE_VOLUME_LEVEL_UPDATE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedLevelUpdateBuffer: Boolean(retainLevelUpdateBuffer),
      levelUpdateBufferByteLength: plan.levelUpdateByteLength,
      levelUpdateRows,
      conservativeTransferStatus: 'phase-volume-level-update-submitted',
      stateMutationStatus: 'phase-volume-level-update-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-phase-volume-level-update-materialized',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainLevelUpdateBuffer) {
      result.levelUpdateBuffer = levelUpdateBuffer;
      result.destroyLevelUpdateBuffer = () => levelUpdateBuffer.destroy?.();
      returnedRetainedLevelUpdateBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedMigrationBuffer) migrationBuffer.destroy?.();
      if (!retainLevelUpdateBuffer || !returnedRetainedLevelUpdateBuffer) levelUpdateBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederPhaseVolumeDiagnosticSummaryWebGpu({
  device,
  phaseVolumeLevelUpdate,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  migrationEpoch = phaseVolumeLevelUpdate?.migrationEpoch ?? 0,
  stateFamilyId = phaseVolumeLevelUpdate?.stateFamilyId ?? 1,
  retainSummaryBuffer = true,
  readbackMode = SCHROEDER_COMPACT_PHASE_VOLUME_DIAGNOSTIC_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederPhaseVolumeDiagnosticSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederPhaseVolumeDiagnosticSummaryPlan({
    phaseVolumeLevelUpdate,
    phaseVolumeExpandThreshold,
    migrationEpoch,
    stateFamilyId
  });
  const compactSummaryReadback = readbackMode === SCHROEDER_COMPACT_PHASE_VOLUME_DIAGNOSTIC_READBACK_MODE;
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedLevelUpdateBuffer = phaseVolumeLevelUpdate?.levelUpdateBuffer || null;
  const levelUpdateRows = phaseVolumeLevelUpdate?.levelUpdateRows instanceof Float32Array
    ? phaseVolumeLevelUpdate.levelUpdateRows
    : null;
  if (!borrowedLevelUpdateBuffer && !(levelUpdateRows instanceof Float32Array)) {
    throw new TypeError('Schroeder phase-volume diagnostic summary requires a retained level-update buffer or explicit rows');
  }

  const levelUpdateBuffer = borrowedLevelUpdateBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-phase-volume-diagnostic-summary-in', levelUpdateRows);
  const summaryBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-diagnostic-summary-out',
    size: plan.summaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-diagnostic-summary-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = compactSummaryReadback
    ? device.createBuffer({
      label: 'ulg-schroeder-phase-volume-diagnostic-summary-readback',
      size: plan.summaryByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    })
    : null;
  let returnedRetainedSummaryBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederPhaseVolumeDiagnosticSummaryParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-phase-volume-diagnostic-summary.v0',
      label: 'ulg-schroeder-phase-volume-diagnostic-summary',
      code: schroederPhaseVolumeDiagnosticSummaryWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: levelUpdateBuffer } },
        { binding: 1, resource: { buffer: summaryBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    if (compactSummaryReadback) {
      encoder.copyBufferToBuffer(summaryBuffer, 0, readBuffer, 0, plan.summaryByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let summaryRows = new Float32Array();
    if (compactSummaryReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      summaryRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
      phaseVolumeDiagnosticSummarySchema: plan.schema,
      status: 'schroeder-phase-volume-diagnostic-summary-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode,
      compactSummaryReadbackPerformed: compactSummaryReadback,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedSummaryBuffer: Boolean(retainSummaryBuffer),
      summaryBufferByteLength: plan.summaryByteLength,
      summaryRows,
      diagnosticStatus: 'phase-volume-diagnostics-submitted',
      visibleStressCaseStatus: 'water-to-steam-level-migration-diagnostics-submitted',
      conservativeTransferStatus: 'diagnostic-summary-only-no-conservative-transfer',
      stateMutationStatus: 'diagnostic-summary-only-no-state-mutation',
      stateAuthorityStatus: 'state-manager-admitted-level-update-source',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainSummaryBuffer) {
      result.summaryBuffer = summaryBuffer;
      result.destroySummaryBuffer = () => summaryBuffer.destroy?.();
      returnedRetainedSummaryBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedLevelUpdateBuffer) levelUpdateBuffer.destroy?.();
      if (!retainSummaryBuffer || !returnedRetainedSummaryBuffer) summaryBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback || compactSummaryReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederSameLevelMechanicsWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  levelAssignment = null,
  activeNodeList = null,
  activeNodeIndex = null,
  activeNodeSortedIndex = null,
  lawQueue = null,
  lawNeighborCandidates = null,
  crossLevelCoupling = null,
  conservationSummary = null,
  crossLevelTransfer = null,
  crossLevelStateDelta = null,
  crossLevelStateDeltaMerge = null,
  hierarchyAggregate = null,
  hierarchyAggregateNode = null,
  phaseVolumeMigration = null,
  phaseVolumeLevelUpdate = null,
  phaseVolumeDiagnosticSummary = null,
  portableSummary = null,
  stateDeltaMergeAdmission = null,
  phaseVolumeMigrationAdmission = null,
  selectedLevel = 0,
  baseGridSpacingM = sphParticleState?.smoothingLengthM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  tileCellCount = DEFAULT_TILE_CELL_COUNT,
  supportInflateCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  enableActiveNodeIndex = false,
  activeNodeIndexBucketCount = null,
  activeNodeIndexBucketSlotCapacity = DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY,
  enableActiveNodeSortedIndex = false,
  activeNodeSortedIndexPolicyMode = SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_AUTO_MODE,
  activeNodeSortedIndexBucketCount = null,
  enableLawQueue = true,
  enableLawNeighborCandidates = true,
  enabledLawMask = SCHROEDER_LOCAL_LAW_QUEUE_MASK,
  lawQueueCandidateBudget = DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET,
  lawNeighborCandidateBudget = lawQueueCandidateBudget,
  lawNeighborCandidateReadbackMode = null,
  lawNeighborTraversalDiagnosticCounters = null,
  lawNeighborTraversalPolicyMode = SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE,
  lawNeighborTraversalPolicyFallbackScanRatioThreshold = DEFAULT_SCHROEDER_LAW_NEIGHBOR_FALLBACK_SCAN_RATIO_THRESHOLD,
  lawNeighborTraversalPolicyBucketPressureRatioThreshold = DEFAULT_SCHROEDER_LAW_NEIGHBOR_BUCKET_PRESSURE_RATIO_THRESHOLD,
  sortedRadixTraversalAvailable = false,
  enableCrossLevelCoupling = true,
  enableConservationSummary = enableCrossLevelCoupling,
  enableCrossLevelTransfer = enableConservationSummary,
  enableCrossLevelStateDelta = enableCrossLevelTransfer,
  enableCrossLevelStateDeltaMerge = Boolean(stateDeltaMergeAdmission),
  enableHierarchyAggregate = enableCrossLevelStateDeltaMerge,
  enableHierarchyAggregateNodeReduction = enableHierarchyAggregate,
  enablePhaseVolumeMigration = enableHierarchyAggregateNodeReduction,
  enablePhaseVolumeLevelUpdate = Boolean(phaseVolumeMigrationAdmission),
  enablePhaseVolumeDiagnosticSummary = enablePhaseVolumeLevelUpdate,
  enablePortableSummary = false,
  portableSummaryPeerComputeUseCase = 'same-level-schroeder-portable-summary',
  parentLevelDelta = 1,
  couplingHaloCells = supportInflateCells,
  minCouplingRadiusM = 0,
  maxCouplingRadiusM = 0,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  coarsenLevelDeltaThreshold = DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD,
  gasPhaseId = DEFAULT_GAS_PHASE_ID,
  aggregateResidualTolerance = DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE,
  boxDimsM = [5, 5, 5],
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  gravityMPerS2 = mlsMpmParticleState?.gravityMPerS2,
  cflFactor = mlsMpmParticleState?.gridCflFactor,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  activeNodeIndexRunner = runSchroederActiveNodeIndexWebGpu,
  activeNodeSortedIndexRunner = runSchroederActiveNodeSortedIndexWebGpu,
  lawQueueRunner = runSchroederLawQueueWebGpu,
  lawNeighborCandidateRunner = runSchroederLawNeighborCandidateWebGpu,
  crossLevelCouplingRunner = runSchroederCrossLevelCouplingWebGpu,
  conservationSummaryRunner = runSchroederConservationSummaryWebGpu,
  crossLevelTransferRunner = runSchroederCrossLevelTransferWebGpu,
  crossLevelStateDeltaRunner = runSchroederCrossLevelStateDeltaWebGpu,
  crossLevelStateDeltaMergeRunner = runSchroederCrossLevelStateDeltaMergeWebGpu,
  hierarchyAggregateRunner = runSchroederHierarchyAggregateWebGpu,
  hierarchyAggregateNodeReductionRunner = runSchroederHierarchyAggregateNodeReductionWebGpu,
  phaseVolumeMigrationRunner = runSchroederPhaseVolumeMigrationWebGpu,
  phaseVolumeLevelUpdateRunner = runSchroederPhaseVolumeLevelUpdateWebGpu,
  phaseVolumeDiagnosticSummaryRunner = runSchroederPhaseVolumeDiagnosticSummaryWebGpu,
  portableSummaryRunner = createSchroederPortableSummaryPlan,
  phaseVolumeDiagnosticReadbackMode = SCHROEDER_COMPACT_PHASE_VOLUME_DIAGNOSTIC_READBACK_MODE,
  mergeEpoch = 0,
  residentStepRunner = runMlsMpmResidentStepWithOptionalWebGpu,
  residentStepOptions = {}
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  if (typeof residentStepRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a residentStepRunner function');
  }
  if (enableActiveNodeIndex && typeof activeNodeIndexRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires an activeNodeIndexRunner function');
  }
  if (enableActiveNodeSortedIndex && typeof activeNodeSortedIndexRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires an activeNodeSortedIndexRunner function');
  }
  if (enableLawQueue && typeof lawQueueRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a lawQueueRunner function');
  }
  if (enableLawQueue && enableLawNeighborCandidates && typeof lawNeighborCandidateRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a lawNeighborCandidateRunner function');
  }
  if (enableCrossLevelCoupling && typeof crossLevelCouplingRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a crossLevelCouplingRunner function');
  }
  if (enableCrossLevelCoupling && enableConservationSummary && typeof conservationSummaryRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a conservationSummaryRunner function');
  }
  if (enableCrossLevelCoupling && enableCrossLevelTransfer && typeof crossLevelTransferRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a crossLevelTransferRunner function');
  }
  if (enableCrossLevelCoupling && enableCrossLevelTransfer && enableCrossLevelStateDelta && typeof crossLevelStateDeltaRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a crossLevelStateDeltaRunner function');
  }
  if (
    enableCrossLevelCoupling
    && enableCrossLevelTransfer
    && enableCrossLevelStateDelta
    && enableCrossLevelStateDeltaMerge
    && typeof crossLevelStateDeltaMergeRunner !== 'function'
  ) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a crossLevelStateDeltaMergeRunner function');
  }
  if (
    enableCrossLevelCoupling
    && enableCrossLevelTransfer
    && enableCrossLevelStateDelta
    && enableCrossLevelStateDeltaMerge
    && enableHierarchyAggregate
    && typeof hierarchyAggregateRunner !== 'function'
  ) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a hierarchyAggregateRunner function');
  }
  if (
    enableCrossLevelCoupling
    && enableCrossLevelTransfer
    && enableCrossLevelStateDelta
    && enableCrossLevelStateDeltaMerge
    && enableHierarchyAggregate
    && enableHierarchyAggregateNodeReduction
    && typeof hierarchyAggregateNodeReductionRunner !== 'function'
  ) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a hierarchyAggregateNodeReductionRunner function');
  }
  if (
    enableCrossLevelCoupling
    && enableCrossLevelTransfer
    && enableCrossLevelStateDelta
    && enableCrossLevelStateDeltaMerge
    && enableHierarchyAggregate
    && enableHierarchyAggregateNodeReduction
    && enablePhaseVolumeMigration
    && typeof phaseVolumeMigrationRunner !== 'function'
  ) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a phaseVolumeMigrationRunner function');
  }
  if (
    enableCrossLevelCoupling
    && enableCrossLevelTransfer
    && enableCrossLevelStateDelta
    && enableCrossLevelStateDeltaMerge
    && enableHierarchyAggregate
    && enableHierarchyAggregateNodeReduction
    && enablePhaseVolumeMigration
    && enablePhaseVolumeLevelUpdate
    && typeof phaseVolumeLevelUpdateRunner !== 'function'
  ) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a phaseVolumeLevelUpdateRunner function');
  }
  if (
    enableCrossLevelCoupling
    && enableCrossLevelTransfer
    && enableCrossLevelStateDelta
    && enableCrossLevelStateDeltaMerge
    && enableHierarchyAggregate
    && enableHierarchyAggregateNodeReduction
    && enablePhaseVolumeMigration
    && enablePhaseVolumeLevelUpdate
    && enablePhaseVolumeDiagnosticSummary
    && typeof phaseVolumeDiagnosticSummaryRunner !== 'function'
  ) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a phaseVolumeDiagnosticSummaryRunner function');
  }
  if (enablePortableSummary && typeof portableSummaryRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a portableSummaryRunner function');
  }
  const plan = createSchroederSameLevelMechanicsPlan({
    sphParticleState,
    mlsMpmParticleState,
    selectedLevel,
    baseGridSpacingM,
    minLevel,
    maxLevel,
    readbackMode,
    tileCellCount
  });
  const resolvedLevelAssignment = levelAssignment || await runSchroederLevelAssignmentWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    baseGridSpacingM: plan.baseGridSpacingM,
    minLevel: plan.minLevel,
    maxLevel: plan.maxLevel,
    targetSupportCells,
    supportRadiusScale,
    retainAssignmentBuffer: true,
    readbackMode
  });
  const resolvedActiveNodeList = activeNodeList || await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment: resolvedLevelAssignment,
    tileCellCount,
    supportInflateCells,
    retainActiveNodeBuffer: true,
    readbackMode
  });
  const resolvedActiveNodeIndex = !enableActiveNodeIndex
    ? null
    : activeNodeIndex || await activeNodeIndexRunner({
      device,
      activeNodeList: resolvedActiveNodeList,
      bucketCount: activeNodeIndexBucketCount,
      bucketSlotCapacity: activeNodeIndexBucketSlotCapacity,
      retainIndexBuffers: true,
      readbackMode
    });
  const activeNodeSortedIndexSelection = createSchroederActiveNodeSortedIndexSelection({
    activeNodeSortedIndex,
    enableActiveNodeSortedIndex,
    activeNodeSortedIndexPolicyMode,
    lawNeighborTraversalPolicyMode,
    lawNeighborTraversalDiagnosticCounters,
    lawNeighborCandidates,
    activeNodeIndexEnabled: Boolean(resolvedActiveNodeIndex),
    activeNodeIndexBucketCount: resolvedActiveNodeIndex?.bucketCount ?? activeNodeIndexBucketCount ?? 0,
    lawQueueCount: resolvedActiveNodeList.activeNodeCount,
    candidateBudget: lawNeighborCandidateBudget,
    fallbackScanRatioThreshold: lawNeighborTraversalPolicyFallbackScanRatioThreshold,
    bucketPressureRatioThreshold: lawNeighborTraversalPolicyBucketPressureRatioThreshold,
    sortedRadixTraversalAvailable
  });
  if (activeNodeSortedIndexSelection.shouldBuild && typeof activeNodeSortedIndexRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires an activeNodeSortedIndexRunner function');
  }
  const resolvedActiveNodeSortedIndex = !activeNodeSortedIndexSelection.selected
    ? null
    : activeNodeSortedIndex || await activeNodeSortedIndexRunner({
      device,
      activeNodeList: resolvedActiveNodeList,
      bucketCount: activeNodeSortedIndexBucketCount,
      retainIndexBuffers: true,
      readbackMode
    });
  const resolvedLawQueue = !enableLawQueue
    ? null
    : lawQueue || await lawQueueRunner({
      device,
      activeNodeList: resolvedActiveNodeList,
      enabledLawMask,
      candidateBudget: lawQueueCandidateBudget,
      queueEpoch: mergeEpoch,
      retainLawQueueBuffer: true,
      readbackMode
    });
  const resolvedLawNeighborCandidates = !resolvedLawQueue || !enableLawNeighborCandidates
    ? null
    : lawNeighborCandidates || await lawNeighborCandidateRunner({
      device,
      lawQueue: resolvedLawQueue,
      activeNodeList: resolvedActiveNodeList,
      activeNodeIndex: resolvedActiveNodeIndex,
      activeNodeSortedIndex: resolvedActiveNodeSortedIndex,
      sphParticleState,
      sphParticleUpload,
      candidateBudget: lawNeighborCandidateBudget,
      enabledLawMask,
      retainNeighborCandidateBuffer: true,
      traversalPolicyMode: lawNeighborTraversalPolicyMode,
      traversalPolicyFallbackScanRatioThreshold: lawNeighborTraversalPolicyFallbackScanRatioThreshold,
      traversalPolicyBucketPressureRatioThreshold: lawNeighborTraversalPolicyBucketPressureRatioThreshold,
      sortedRadixTraversalAvailable: activeNodeSortedIndexSelection.sortedRadixTraversalAvailable
        || sortedRadixTraversalAvailable
        || Boolean(resolvedActiveNodeSortedIndex),
      readbackMode: lawNeighborCandidateReadbackMode ?? readbackMode
    });
  const resolvedCrossLevelCoupling = !enableCrossLevelCoupling
    ? null
    : crossLevelCoupling || await crossLevelCouplingRunner({
      device,
      levelAssignment: resolvedLevelAssignment,
      activeNodeList: resolvedActiveNodeList,
      parentLevelDelta,
      baseGridSpacingM: plan.baseGridSpacingM,
      maxLevel: plan.maxLevel,
      couplingHaloCells,
      minCouplingRadiusM,
      maxCouplingRadiusM,
      tileCellCount,
      retainCrossLevelBuffer: true,
      readbackMode
    });
  const resolvedConservationSummary = !resolvedCrossLevelCoupling || !enableConservationSummary
    ? null
    : conservationSummary || await conservationSummaryRunner({
      device,
      crossLevelCoupling: resolvedCrossLevelCoupling,
      retainSummaryBuffer: true,
      readbackMode
    });
  const resolvedCrossLevelTransfer = !resolvedCrossLevelCoupling || !enableCrossLevelTransfer
    ? null
    : crossLevelTransfer || await crossLevelTransferRunner({
      device,
      sphParticleState,
      sphParticleUpload,
      crossLevelCoupling: resolvedCrossLevelCoupling,
      retainTransferBuffer: true,
      readbackMode
    });
  const resolvedCrossLevelStateDelta = !resolvedCrossLevelTransfer || !enableCrossLevelStateDelta
    ? null
    : crossLevelStateDelta || await crossLevelStateDeltaRunner({
      device,
      crossLevelTransfer: resolvedCrossLevelTransfer,
      retainStateDeltaBuffer: true,
      readbackMode
    });
  const resolvedCrossLevelStateDeltaMerge = !resolvedCrossLevelStateDelta || !enableCrossLevelStateDeltaMerge
    ? null
    : crossLevelStateDeltaMerge || await crossLevelStateDeltaMergeRunner({
      device,
      crossLevelStateDelta: resolvedCrossLevelStateDelta,
      stateDeltaMergeAdmission,
      mergeEpoch,
      retainMergedStateDeltaBuffer: true,
      readbackMode
    });
  const resolvedHierarchyAggregate = !resolvedCrossLevelStateDeltaMerge || !enableHierarchyAggregate
    ? null
    : hierarchyAggregate || await hierarchyAggregateRunner({
      device,
      crossLevelStateDeltaMerge: resolvedCrossLevelStateDeltaMerge,
      retainAggregateBuffer: true,
      readbackMode
    });
  const resolvedHierarchyAggregateNode = !resolvedHierarchyAggregate || !enableHierarchyAggregateNodeReduction
    ? null
    : hierarchyAggregateNode || await hierarchyAggregateNodeReductionRunner({
      device,
      hierarchyAggregate: resolvedHierarchyAggregate,
      retainAggregateNodeBuffer: true,
      readbackMode
    });
  const resolvedPhaseVolumeMigration = !resolvedLevelAssignment || !resolvedHierarchyAggregateNode || !enablePhaseVolumeMigration
    ? null
    : phaseVolumeMigration || await phaseVolumeMigrationRunner({
      device,
      levelAssignment: resolvedLevelAssignment,
      hierarchyAggregateNode: resolvedHierarchyAggregateNode,
      baseGridSpacingM: plan.baseGridSpacingM,
      minLevel: plan.minLevel,
      maxLevel: plan.maxLevel,
      targetSupportCells,
      supportRadiusScale,
      phaseVolumeExpandThreshold,
      coarsenLevelDeltaThreshold,
      gasPhaseId,
      migrationEpoch: mergeEpoch,
      aggregateResidualTolerance,
      retainMigrationBuffer: true,
      readbackMode
    });
  const resolvedPhaseVolumeLevelUpdate = !resolvedPhaseVolumeMigration || !enablePhaseVolumeLevelUpdate
    ? null
    : phaseVolumeLevelUpdate || await phaseVolumeLevelUpdateRunner({
      device,
      phaseVolumeMigration: resolvedPhaseVolumeMigration,
      phaseVolumeMigrationAdmission,
      migrationEpoch: mergeEpoch,
      retainLevelUpdateBuffer: true,
      readbackMode
    });
  const resolvedPhaseVolumeDiagnosticSummary = !resolvedPhaseVolumeLevelUpdate || !enablePhaseVolumeDiagnosticSummary
    ? null
    : phaseVolumeDiagnosticSummary || await phaseVolumeDiagnosticSummaryRunner({
      device,
      phaseVolumeLevelUpdate: resolvedPhaseVolumeLevelUpdate,
      phaseVolumeExpandThreshold,
      migrationEpoch: mergeEpoch,
      retainSummaryBuffer: true,
      readbackMode: phaseVolumeDiagnosticReadbackMode
    });
  const resolvedPortableSummary = !enablePortableSummary
    ? null
    : portableSummary || await portableSummaryRunner({
      levelAssignment: resolvedLevelAssignment,
      activeNodeList: resolvedActiveNodeList,
      activeNodeIndex: resolvedActiveNodeIndex,
      activeNodeSortedIndex: resolvedActiveNodeSortedIndex,
      lawQueue: resolvedLawQueue,
      lawNeighborCandidates: resolvedLawNeighborCandidates,
      hierarchyAggregateNode: resolvedHierarchyAggregateNode,
      conservationSummary: resolvedConservationSummary,
      phaseVolumeDiagnosticSummary: resolvedPhaseVolumeDiagnosticSummary,
      selectedLevel: plan.selectedLevel,
      baseGridSpacingM: plan.baseGridSpacingM,
      peerComputeUseCase: portableSummaryPeerComputeUseCase
    });
  const residentStep = await residentStepRunner({
    ...residentStepOptions,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    gridSpacingM: plan.nativeGridSpacingM,
    boxDimsM,
    dt,
    gravityMPerS2,
    cflFactor,
    preferWebGpu: true,
    device,
    readbackMode,
    schroederLevelAssignment: resolvedLevelAssignment,
    schroederSelectedLevel: plan.selectedLevel,
    schroederActiveNodeList: resolvedActiveNodeList,
    schroederActiveNodeSortedIndex: resolvedActiveNodeSortedIndex,
    schroederLawQueue: resolvedLawQueue,
    schroederLawNeighborCandidates: resolvedLawNeighborCandidates,
    schroederCrossLevelCoupling: resolvedCrossLevelCoupling,
    schroederConservationSummary: resolvedConservationSummary,
    schroederCrossLevelTransfer: resolvedCrossLevelTransfer,
    schroederCrossLevelStateDelta: resolvedCrossLevelStateDelta,
    schroederCrossLevelStateDeltaMerge: resolvedCrossLevelStateDeltaMerge,
    schroederHierarchyAggregate: resolvedHierarchyAggregate,
    schroederHierarchyAggregateNode: resolvedHierarchyAggregateNode,
    schroederPhaseVolumeMigration: resolvedPhaseVolumeMigration,
    schroederPhaseVolumeLevelUpdate: resolvedPhaseVolumeLevelUpdate,
    schroederPhaseVolumeDiagnosticSummary: resolvedPhaseVolumeDiagnosticSummary,
    schroederPortableSummary: resolvedPortableSummary,
    fuseNoFullResidentMechanics: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    fuseNoFullResidentActiveGrid: true
  });

  return {
    ...plan,
    schema: ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA,
    sameLevelMechanicsSchema: plan.schema,
    status: 'schroeder-same-level-mechanics-submitted',
    backend: 'webgpu',
    readbackMode,
    fullParticleReadbackPerformed: false,
    normalHotLoopReadbackFree: readbackMode === SCHROEDER_NO_FULL_READBACK_MODE,
    levelAssignment: {
      schema: resolvedLevelAssignment.schema,
      status: resolvedLevelAssignment.status,
      particleCount: resolvedLevelAssignment.particleCount,
      retainedAssignmentBuffer: Boolean(resolvedLevelAssignment.assignmentBuffer),
      assignmentBufferByteLength: resolvedLevelAssignment.assignmentBufferByteLength ?? resolvedLevelAssignment.assignmentByteLength ?? 0
    },
    activeNodeList: {
      schema: resolvedActiveNodeList.schema,
      status: resolvedActiveNodeList.status,
      activeCandidateCount: resolvedActiveNodeList.activeCandidateCount,
      outputCompaction: resolvedActiveNodeList.outputCompaction,
      retainedActiveNodeBuffer: Boolean(resolvedActiveNodeList.activeNodeBuffer),
      activeNodeBufferByteLength: resolvedActiveNodeList.activeNodeBufferByteLength ?? resolvedActiveNodeList.activeNodeByteLength ?? 0
    },
    activeNodeIndex: resolvedActiveNodeIndex ? {
      schema: resolvedActiveNodeIndex.schema,
      activeNodeIndexSchema: resolvedActiveNodeIndex.activeNodeIndexSchema,
      status: resolvedActiveNodeIndex.status,
      activeNodeCount: resolvedActiveNodeIndex.activeNodeCount,
      bucketCount: resolvedActiveNodeIndex.bucketCount,
      bucketSlotCapacity: resolvedActiveNodeIndex.bucketSlotCapacity,
      bucketSlotCount: resolvedActiveNodeIndex.bucketSlotCount,
      outputCompaction: resolvedActiveNodeIndex.outputCompaction,
      capacityStatus: resolvedActiveNodeIndex.capacityStatus,
      indexCoverageStatus: resolvedActiveNodeIndex.indexCoverageStatus,
      retainedIndexBuffers: Boolean(
        resolvedActiveNodeIndex.bucketCountBuffer
        || resolvedActiveNodeIndex.bucketSlotBuffer
        || resolvedActiveNodeIndex.nodeBucketSlotBuffer
        || resolvedActiveNodeIndex.overflowCounterBuffer
      ),
      bucketCountBufferByteLength: resolvedActiveNodeIndex.bucketCountByteLength ?? 0,
      bucketSlotBufferByteLength: resolvedActiveNodeIndex.bucketSlotByteLength ?? 0,
      nodeBucketSlotBufferByteLength: resolvedActiveNodeIndex.nodeBucketSlotByteLength ?? 0,
      overflowCounterBufferByteLength: resolvedActiveNodeIndex.overflowCounterByteLength ?? 0
    } : null,
    activeNodeSortedIndexSelection: {
      policyMode: activeNodeSortedIndexSelection.policyMode,
      status: activeNodeSortedIndexSelection.status,
      selected: activeNodeSortedIndexSelection.selected,
      shouldBuild: activeNodeSortedIndexSelection.shouldBuild,
      suppliedRetainedIndex: activeNodeSortedIndexSelection.suppliedRetainedIndex,
      buildReason: activeNodeSortedIndexSelection.buildReason,
      forcedByUseCaseConfig: activeNodeSortedIndexSelection.forcedByUseCaseConfig,
      forcedByLegacyFlag: activeNodeSortedIndexSelection.forcedByLegacyFlag,
      forcedByTraversalPolicy: activeNodeSortedIndexSelection.forcedByTraversalPolicy,
      disabledByUseCaseConfig: activeNodeSortedIndexSelection.disabledByUseCaseConfig,
      diagnosticDrivenBuild: activeNodeSortedIndexSelection.diagnosticDrivenBuild,
      diagnosticCountersAvailable: activeNodeSortedIndexSelection.diagnosticCountersAvailable,
      diagnosticReadbackRecommended: activeNodeSortedIndexSelection.diagnosticReadbackRecommended,
      traversalPolicyStatus: activeNodeSortedIndexSelection.traversalPolicyStatus,
      recommendedTraversalIndexMode: activeNodeSortedIndexSelection.recommendedTraversalIndexMode,
      selectedTraversalIndexMode: activeNodeSortedIndexSelection.selectedTraversalIndexMode,
      sortedRadixIndexRequired: activeNodeSortedIndexSelection.sortedRadixIndexRequired,
      sortedRadixIndexStatus: activeNodeSortedIndexSelection.sortedRadixIndexStatus,
      sortedRadixTraversalAvailable: activeNodeSortedIndexSelection.sortedRadixTraversalAvailable,
      peerComputeConfigStatus: activeNodeSortedIndexSelection.peerComputeConfigStatus,
      fullParticleReadbackRequired: activeNodeSortedIndexSelection.fullParticleReadbackRequired
    },
    activeNodeSortedIndex: resolvedActiveNodeSortedIndex ? {
      schema: resolvedActiveNodeSortedIndex.schema,
      activeNodeSortedIndexSchema: resolvedActiveNodeSortedIndex.activeNodeSortedIndexSchema,
      status: resolvedActiveNodeSortedIndex.status,
      activeNodeCount: resolvedActiveNodeSortedIndex.activeNodeCount,
      bucketCount: resolvedActiveNodeSortedIndex.bucketCount,
      bucketRangeOffsetCount: resolvedActiveNodeSortedIndex.bucketRangeOffsetCount,
      outputCompaction: resolvedActiveNodeSortedIndex.outputCompaction,
      capacityStatus: resolvedActiveNodeSortedIndex.capacityStatus,
      indexCoverageStatus: resolvedActiveNodeSortedIndex.indexCoverageStatus,
      retainedIndexBuffers: Boolean(
        resolvedActiveNodeSortedIndex.bucketCountBuffer
        || resolvedActiveNodeSortedIndex.bucketRangeOffsetBuffer
        || resolvedActiveNodeSortedIndex.sortedActiveIndexBuffer
        || resolvedActiveNodeSortedIndex.diagnosticCounterBuffer
      ),
      bucketRangeOffsetBufferByteLength: resolvedActiveNodeSortedIndex.bucketRangeOffsetByteLength ?? 0,
      sortedActiveIndexBufferByteLength: resolvedActiveNodeSortedIndex.sortedActiveIndexByteLength ?? 0,
      diagnosticCounterBufferByteLength: resolvedActiveNodeSortedIndex.diagnosticCounterByteLength ?? 0
    } : null,
    lawQueue: resolvedLawQueue ? {
      schema: resolvedLawQueue.schema,
      status: resolvedLawQueue.status,
      activeNodeCount: resolvedLawQueue.activeNodeCount,
      outputCompaction: resolvedLawQueue.outputCompaction,
      lawQueueStatus: resolvedLawQueue.lawQueueStatus,
      exactNearFieldRequirement: resolvedLawQueue.exactNearFieldRequirement,
      reactionScopeStatus: resolvedLawQueue.reactionScopeStatus,
      stateMutationStatus: resolvedLawQueue.stateMutationStatus,
      stateAuthorityStatus: resolvedLawQueue.stateAuthorityStatus,
      retainedLawQueueBuffer: Boolean(resolvedLawQueue.lawQueueBuffer),
      lawQueueBufferByteLength: resolvedLawQueue.lawQueueBufferByteLength
        ?? resolvedLawQueue.lawQueueByteLength
        ?? 0
    } : null,
    lawNeighborCandidates: resolvedLawNeighborCandidates ? {
      schema: resolvedLawNeighborCandidates.schema,
      status: resolvedLawNeighborCandidates.status,
      lawQueueCount: resolvedLawNeighborCandidates.lawQueueCount,
      neighborCandidateCount: resolvedLawNeighborCandidates.neighborCandidateCount,
      candidateBudget: resolvedLawNeighborCandidates.candidateBudget,
      enumerationMode: resolvedLawNeighborCandidates.enumerationMode,
      outputCompaction: resolvedLawNeighborCandidates.outputCompaction,
      treeTraversalStatus: resolvedLawNeighborCandidates.treeTraversalStatus,
      activeNodeIndexEnabled: Boolean(resolvedLawNeighborCandidates.activeNodeIndexEnabled),
      activeNodeSortedIndexEnabled: Boolean(resolvedLawNeighborCandidates.activeNodeSortedIndexEnabled),
      activeNodeIndexConsumerStatus: resolvedLawNeighborCandidates.activeNodeIndexConsumerStatus,
      traversalDiagnosticStatus: resolvedLawNeighborCandidates.traversalDiagnosticStatus,
      traversalPolicyStatus: resolvedLawNeighborCandidates.traversalPolicyStatus,
      traversalPolicyMode: resolvedLawNeighborCandidates.traversalPolicyMode,
      appliedTraversalIndexMode: resolvedLawNeighborCandidates.appliedTraversalIndexMode,
      recommendedTraversalIndexMode: resolvedLawNeighborCandidates.recommendedTraversalIndexMode,
      selectedTraversalIndexMode: resolvedLawNeighborCandidates.selectedTraversalIndexMode,
      sortedRadixIndexRequired: Boolean(resolvedLawNeighborCandidates.sortedRadixIndexRequired),
      sortedRadixIndexStatus: resolvedLawNeighborCandidates.sortedRadixIndexStatus,
      diagnosticCountersAvailable: Boolean(resolvedLawNeighborCandidates.diagnosticCountersAvailable),
      diagnosticReadbackRecommended: Boolean(resolvedLawNeighborCandidates.diagnosticReadbackRecommended),
      retainedDiagnosticCounterBuffer: Boolean(resolvedLawNeighborCandidates.diagnosticCounterBuffer),
      diagnosticCounterBufferByteLength: resolvedLawNeighborCandidates.diagnosticCounterBufferByteLength
        ?? resolvedLawNeighborCandidates.diagnosticCounterByteLength
        ?? 0,
      retainedNeighborCandidateBuffer: Boolean(resolvedLawNeighborCandidates.neighborCandidateBuffer),
      neighborCandidateBufferByteLength: resolvedLawNeighborCandidates.neighborCandidateBufferByteLength
        ?? resolvedLawNeighborCandidates.neighborCandidateByteLength
        ?? 0
    } : null,
    crossLevelCoupling: resolvedCrossLevelCoupling ? {
      schema: resolvedCrossLevelCoupling.schema,
      status: resolvedCrossLevelCoupling.status,
      crossLevelCandidateCount: resolvedCrossLevelCoupling.crossLevelCandidateCount,
      outputCompaction: resolvedCrossLevelCoupling.outputCompaction,
      retainedCrossLevelBuffer: Boolean(resolvedCrossLevelCoupling.crossLevelBuffer),
      crossLevelBufferByteLength: resolvedCrossLevelCoupling.crossLevelBufferByteLength
        ?? resolvedCrossLevelCoupling.crossLevelByteLength
        ?? 0
    } : null,
    conservationSummary: resolvedConservationSummary ? {
      schema: resolvedConservationSummary.schema,
      status: resolvedConservationSummary.status,
      summaryRowCount: resolvedConservationSummary.summaryRowCount,
      outputCompaction: resolvedConservationSummary.outputCompaction,
      residualCounterStatus: resolvedConservationSummary.residualCounterStatus,
      conservativeTransferStatus: resolvedConservationSummary.conservativeTransferStatus,
      retainedSummaryBuffer: Boolean(resolvedConservationSummary.summaryBuffer),
      summaryBufferByteLength: resolvedConservationSummary.summaryBufferByteLength
        ?? resolvedConservationSummary.summaryByteLength
        ?? 0
    } : null,
    crossLevelTransfer: resolvedCrossLevelTransfer ? {
      schema: resolvedCrossLevelTransfer.schema,
      status: resolvedCrossLevelTransfer.status,
      crossLevelCandidateCount: resolvedCrossLevelTransfer.crossLevelCandidateCount,
      outputCompaction: resolvedCrossLevelTransfer.outputCompaction,
      conservativeTransferStatus: resolvedCrossLevelTransfer.conservativeTransferStatus,
      stateMutationStatus: resolvedCrossLevelTransfer.stateMutationStatus,
      retainedTransferBuffer: Boolean(resolvedCrossLevelTransfer.transferBuffer),
      transferBufferByteLength: resolvedCrossLevelTransfer.transferBufferByteLength
        ?? resolvedCrossLevelTransfer.transferByteLength
        ?? 0
    } : null,
    crossLevelStateDelta: resolvedCrossLevelStateDelta ? {
      schema: resolvedCrossLevelStateDelta.schema,
      status: resolvedCrossLevelStateDelta.status,
      crossLevelCandidateCount: resolvedCrossLevelStateDelta.crossLevelCandidateCount,
      outputCompaction: resolvedCrossLevelStateDelta.outputCompaction,
      conservativeTransferStatus: resolvedCrossLevelStateDelta.conservativeTransferStatus,
      stateMutationStatus: resolvedCrossLevelStateDelta.stateMutationStatus,
      stateAuthorityStatus: resolvedCrossLevelStateDelta.stateAuthorityStatus,
      retainedStateDeltaBuffer: Boolean(resolvedCrossLevelStateDelta.stateDeltaBuffer),
      stateDeltaBufferByteLength: resolvedCrossLevelStateDelta.stateDeltaBufferByteLength
        ?? resolvedCrossLevelStateDelta.stateDeltaByteLength
        ?? 0
    } : null,
    crossLevelStateDeltaMerge: resolvedCrossLevelStateDeltaMerge ? {
      schema: resolvedCrossLevelStateDeltaMerge.schema,
      status: resolvedCrossLevelStateDeltaMerge.status,
      crossLevelCandidateCount: resolvedCrossLevelStateDeltaMerge.crossLevelCandidateCount,
      outputCompaction: resolvedCrossLevelStateDeltaMerge.outputCompaction,
      conservativeTransferStatus: resolvedCrossLevelStateDeltaMerge.conservativeTransferStatus,
      stateMutationStatus: resolvedCrossLevelStateDeltaMerge.stateMutationStatus,
      stateAuthorityStatus: resolvedCrossLevelStateDeltaMerge.stateAuthorityStatus,
      retainedMergedStateDeltaBuffer: Boolean(resolvedCrossLevelStateDeltaMerge.mergedStateDeltaBuffer),
      mergedStateDeltaBufferByteLength: resolvedCrossLevelStateDeltaMerge.mergedStateDeltaBufferByteLength
        ?? resolvedCrossLevelStateDeltaMerge.mergeByteLength
        ?? 0
    } : null,
    hierarchyAggregate: resolvedHierarchyAggregate ? {
      schema: resolvedHierarchyAggregate.schema,
      status: resolvedHierarchyAggregate.status,
      aggregateRowCount: resolvedHierarchyAggregate.aggregateRowCount,
      outputCompaction: resolvedHierarchyAggregate.outputCompaction,
      aggregateReductionStatus: resolvedHierarchyAggregate.aggregateReductionStatus,
      conservativeTransferStatus: resolvedHierarchyAggregate.conservativeTransferStatus,
      stateMutationStatus: resolvedHierarchyAggregate.stateMutationStatus,
      stateAuthorityStatus: resolvedHierarchyAggregate.stateAuthorityStatus,
      retainedAggregateBuffer: Boolean(resolvedHierarchyAggregate.aggregateBuffer),
      aggregateBufferByteLength: resolvedHierarchyAggregate.aggregateBufferByteLength
        ?? resolvedHierarchyAggregate.aggregateByteLength
        ?? 0
    } : null,
    hierarchyAggregateNode: resolvedHierarchyAggregateNode ? {
      schema: resolvedHierarchyAggregateNode.schema,
      status: resolvedHierarchyAggregateNode.status,
      aggregateRowCount: resolvedHierarchyAggregateNode.aggregateRowCount,
      outputCompaction: resolvedHierarchyAggregateNode.outputCompaction,
      aggregateReductionStatus: resolvedHierarchyAggregateNode.aggregateReductionStatus,
      aggregateReductionMode: resolvedHierarchyAggregateNode.aggregateReductionMode,
      capacityStatus: resolvedHierarchyAggregateNode.capacityStatus,
      conservativeTransferStatus: resolvedHierarchyAggregateNode.conservativeTransferStatus,
      stateMutationStatus: resolvedHierarchyAggregateNode.stateMutationStatus,
      stateAuthorityStatus: resolvedHierarchyAggregateNode.stateAuthorityStatus,
      retainedAggregateNodeBuffer: Boolean(resolvedHierarchyAggregateNode.aggregateNodeBuffer),
      aggregateNodeBufferByteLength: resolvedHierarchyAggregateNode.aggregateNodeBufferByteLength
        ?? resolvedHierarchyAggregateNode.aggregateNodeByteLength
        ?? 0
    } : null,
    phaseVolumeMigration: resolvedPhaseVolumeMigration ? {
      schema: resolvedPhaseVolumeMigration.schema,
      status: resolvedPhaseVolumeMigration.status,
      particleCount: resolvedPhaseVolumeMigration.particleCount,
      aggregateNodeCount: resolvedPhaseVolumeMigration.aggregateNodeCount,
      phaseVolumeStatus: resolvedPhaseVolumeMigration.phaseVolumeStatus,
      migrationMode: resolvedPhaseVolumeMigration.migrationMode,
      aggregateCoherenceRequirement: resolvedPhaseVolumeMigration.aggregateCoherenceRequirement,
      phaseVolumeExpandThreshold: resolvedPhaseVolumeMigration.phaseVolumeExpandThreshold,
      coarsenLevelDeltaThreshold: resolvedPhaseVolumeMigration.coarsenLevelDeltaThreshold,
      conservativeTransferStatus: resolvedPhaseVolumeMigration.conservativeTransferStatus,
      stateMutationStatus: resolvedPhaseVolumeMigration.stateMutationStatus,
      stateAuthorityStatus: resolvedPhaseVolumeMigration.stateAuthorityStatus,
      retainedMigrationBuffer: Boolean(resolvedPhaseVolumeMigration.migrationBuffer),
      migrationBufferByteLength: resolvedPhaseVolumeMigration.migrationBufferByteLength
        ?? resolvedPhaseVolumeMigration.migrationByteLength
        ?? 0
    } : null,
    phaseVolumeLevelUpdate: resolvedPhaseVolumeLevelUpdate ? {
      schema: resolvedPhaseVolumeLevelUpdate.schema,
      status: resolvedPhaseVolumeLevelUpdate.status,
      migrationRowCount: resolvedPhaseVolumeLevelUpdate.migrationRowCount,
      outputCompaction: resolvedPhaseVolumeLevelUpdate.outputCompaction,
      phaseVolumeMigrationAdmissionApproved: resolvedPhaseVolumeLevelUpdate.phaseVolumeMigrationAdmissionApproved,
      conservativeTransferStatus: resolvedPhaseVolumeLevelUpdate.conservativeTransferStatus,
      stateMutationStatus: resolvedPhaseVolumeLevelUpdate.stateMutationStatus,
      stateAuthorityStatus: resolvedPhaseVolumeLevelUpdate.stateAuthorityStatus,
      retainedLevelUpdateBuffer: Boolean(resolvedPhaseVolumeLevelUpdate.levelUpdateBuffer),
      levelUpdateBufferByteLength: resolvedPhaseVolumeLevelUpdate.levelUpdateBufferByteLength
        ?? resolvedPhaseVolumeLevelUpdate.levelUpdateByteLength
        ?? 0
    } : null,
    phaseVolumeDiagnosticSummary: resolvedPhaseVolumeDiagnosticSummary ? {
      schema: resolvedPhaseVolumeDiagnosticSummary.schema,
      status: resolvedPhaseVolumeDiagnosticSummary.status,
      summaryRowCount: resolvedPhaseVolumeDiagnosticSummary.summaryRowCount,
      diagnosticStatus: resolvedPhaseVolumeDiagnosticSummary.diagnosticStatus,
      visibleStressCaseStatus: resolvedPhaseVolumeDiagnosticSummary.visibleStressCaseStatus,
      readbackPolicy: resolvedPhaseVolumeDiagnosticSummary.readbackPolicy,
      compactSummaryReadbackPerformed: resolvedPhaseVolumeDiagnosticSummary.compactSummaryReadbackPerformed,
      retainedSummaryBuffer: Boolean(resolvedPhaseVolumeDiagnosticSummary.summaryBuffer),
      summaryBufferByteLength: resolvedPhaseVolumeDiagnosticSummary.summaryBufferByteLength
        ?? resolvedPhaseVolumeDiagnosticSummary.summaryByteLength
        ?? 0,
      summaryRows: resolvedPhaseVolumeDiagnosticSummary.summaryRows instanceof Float32Array
        ? Array.from(resolvedPhaseVolumeDiagnosticSummary.summaryRows)
        : []
    } : null,
    portableSummary: resolvedPortableSummary ? {
      schema: resolvedPortableSummary.schema,
      status: resolvedPortableSummary.status,
      portableSummaryMode: resolvedPortableSummary.portableSummaryMode,
      transferMode: resolvedPortableSummary.transferMode,
      peerComputeUseCase: resolvedPortableSummary.peerComputeUseCase,
      retainedRefCount: resolvedPortableSummary.retainedRefCount,
      retainedBufferRefCount: resolvedPortableSummary.retainedBufferRefCount,
      activeNodeCount: resolvedPortableSummary.activeNodeCount,
      aggregateNodeCount: resolvedPortableSummary.aggregateNodeCount,
      lawQueueCount: resolvedPortableSummary.lawQueueCount,
      lawNeighborCandidateCount: resolvedPortableSummary.lawNeighborCandidateCount,
      renderLodStatus: resolvedPortableSummary.renderLodStatus,
      renderLodMode: resolvedPortableSummary.renderLodMode,
      renderLod: resolvedPortableSummary.renderLod ? {
        schema: resolvedPortableSummary.renderLod.schema,
        status: resolvedPortableSummary.renderLod.status,
        mode: resolvedPortableSummary.renderLod.mode,
        selectedLevel: resolvedPortableSummary.renderLod.selectedLevel,
        nativeGridSpacingM: resolvedPortableSummary.renderLod.nativeGridSpacingM,
        activeLeafProxyCount: resolvedPortableSummary.renderLod.activeLeafProxyCount,
        aggregateProxyCount: resolvedPortableSummary.renderLod.aggregateProxyCount,
        lawQueueProxyCount: resolvedPortableSummary.renderLod.lawQueueProxyCount,
        phaseVolumeDiagnosticRowsAvailable: resolvedPortableSummary.renderLod.phaseVolumeDiagnosticRowsAvailable,
        opticalPolicy: resolvedPortableSummary.renderLod.opticalPolicy,
        geometryPolicy: resolvedPortableSummary.renderLod.geometryPolicy,
        fullParticleReadbackRequired: resolvedPortableSummary.renderLod.fullParticleReadbackRequired === true
      } : null,
      portableMaterializationStatus: resolvedPortableSummary.portableMaterializationStatus,
      presentationAuthority: resolvedPortableSummary.presentationAuthority,
      stateAuthorityStatus: resolvedPortableSummary.stateAuthorityStatus,
      fullParticleReadbackRequired: resolvedPortableSummary.fullParticleReadbackRequired === true
    } : null,
    residentStep,
    residentStepStatus: residentStep?.status ?? null,
    residentStepSchema: residentStep?.schema ?? null,
    mechanicsGridSpacingM: plan.nativeGridSpacingM,
    denseLocalBackend: 'existing-mls-mpm-ocean-resident-mechanics',
    activeNodeConsumerStatus: 'active-node-list-forwarded-to-mls-mpm-p2g-g2p',
    activeNodeIndexStatus: resolvedActiveNodeIndex?.status ?? 'disabled-active-node-index',
    activeNodeSortedIndexPolicyStatus: activeNodeSortedIndexSelection.status,
    activeNodeSortedIndexPolicyMode: activeNodeSortedIndexSelection.policyMode,
    activeNodeSortedIndexBuildReason: activeNodeSortedIndexSelection.buildReason,
    activeNodeSortedIndexStatus: resolvedActiveNodeSortedIndex?.status ?? 'disabled-active-node-sorted-index',
    activeNodeSortedIndexConsumerStatus: resolvedLawNeighborCandidates?.activeNodeSortedIndexEnabled
      ? 'active-node-sorted-radix-index-consumed-by-law-neighbor-traversal'
      : (resolvedActiveNodeSortedIndex
        ? 'active-node-sorted-radix-index-available-not-yet-consumed'
        : 'disabled-active-node-sorted-index'),
    activeNodeIndexConsumerStatus: resolvedLawNeighborCandidates?.activeNodeIndexConsumerStatus
      ?? (resolvedActiveNodeIndex
        ? 'active-node-index-available-not-yet-authoritative-for-law-neighbor-traversal'
        : 'disabled-active-node-index'),
    lawQueueStatus: resolvedLawQueue?.status ?? 'disabled-local-law-queue',
    lawQueueConsumerStatus: resolvedLawQueue
      ? (resolvedLawNeighborCandidates
        ? 'law-queue-consumed-by-law-neighbor-candidates-and-forwarded-to-resident-backend'
        : 'law-queue-submitted-not-yet-consumed-by-reaction-contact-interface')
      : 'disabled-local-law-queue',
    lawNeighborCandidateStatus: resolvedLawNeighborCandidates?.status ?? (
      resolvedLawQueue ? 'disabled-law-neighbor-candidates' : 'disabled-local-law-queue'
    ),
    lawNeighborCandidateConsumerStatus: resolvedLawNeighborCandidates
      ? 'law-neighbor-candidates-forwarded-to-resident-backend'
      : (resolvedLawQueue ? 'disabled-law-neighbor-candidates' : 'disabled-local-law-queue'),
    crossLevelCouplingStatus: resolvedCrossLevelCoupling
      ? 'candidate-generation-submitted-not-yet-consumed-by-mls-mpm-grid-transfer'
      : 'disabled-same-level-only-mechanics',
    conservationSummaryStatus: resolvedConservationSummary?.status ?? (
      resolvedCrossLevelCoupling ? 'disabled-cross-level-summary' : 'disabled-same-level-only-mechanics'
    ),
    crossLevelTransferStatus: resolvedCrossLevelTransfer?.status ?? (
      resolvedCrossLevelCoupling ? 'disabled-cross-level-transfer' : 'disabled-same-level-only-mechanics'
    ),
    crossLevelStateDeltaStatus: resolvedCrossLevelStateDelta?.status ?? (
      resolvedCrossLevelTransfer ? 'disabled-cross-level-state-delta' : (
        resolvedCrossLevelCoupling ? 'disabled-cross-level-transfer' : 'disabled-same-level-only-mechanics'
      )
    ),
    crossLevelStateDeltaMergeStatus: resolvedCrossLevelStateDeltaMerge?.status ?? (
      resolvedCrossLevelStateDelta
        ? 'disabled-cross-level-state-delta-merge-admission-not-provided'
        : (resolvedCrossLevelCoupling ? 'disabled-cross-level-state-delta' : 'disabled-same-level-only-mechanics')
    ),
    hierarchyAggregateStatus: resolvedHierarchyAggregate?.status ?? (
      resolvedCrossLevelStateDeltaMerge
        ? 'disabled-hierarchy-aggregate-materialization'
        : (resolvedCrossLevelStateDelta ? 'disabled-cross-level-state-delta-merge' : 'disabled-same-level-only-mechanics')
    ),
    hierarchyAggregateNodeStatus: resolvedHierarchyAggregateNode?.status ?? (
      resolvedHierarchyAggregate
        ? 'disabled-hierarchy-aggregate-node-reduction'
        : (resolvedCrossLevelStateDeltaMerge ? 'disabled-hierarchy-aggregate-materialization' : 'disabled-same-level-only-mechanics')
    ),
    phaseVolumeMigrationStatus: resolvedPhaseVolumeMigration?.status ?? (
      resolvedHierarchyAggregateNode
        ? 'disabled-phase-volume-migration'
        : (resolvedHierarchyAggregate
          ? 'disabled-hierarchy-aggregate-node-reduction'
          : (resolvedCrossLevelStateDeltaMerge ? 'disabled-hierarchy-aggregate-materialization' : 'disabled-same-level-only-mechanics'))
    ),
    phaseVolumeLevelUpdateStatus: resolvedPhaseVolumeLevelUpdate?.status ?? (
      resolvedPhaseVolumeMigration
        ? 'disabled-phase-volume-level-update-admission-not-provided'
        : (resolvedHierarchyAggregateNode ? 'disabled-phase-volume-migration' : 'disabled-same-level-only-mechanics')
    ),
    phaseVolumeDiagnosticSummaryStatus: resolvedPhaseVolumeDiagnosticSummary?.status ?? (
      resolvedPhaseVolumeLevelUpdate
        ? 'disabled-phase-volume-diagnostic-summary'
        : (resolvedPhaseVolumeMigration ? 'disabled-phase-volume-level-update-admission-not-provided' : 'disabled-same-level-only-mechanics')
    ),
    portableSummaryStatus: resolvedPortableSummary?.status ?? 'disabled-schroeder-portable-summary',
    renderLodStatus: resolvedPortableSummary?.renderLodStatus ?? 'disabled-schroeder-render-lod-summary',
    portableSummaryTransferMode: resolvedPortableSummary?.transferMode ?? null,
    conservativeTransferStatus: resolvedPhaseVolumeLevelUpdate?.conservativeTransferStatus
      ?? resolvedPhaseVolumeMigration?.conservativeTransferStatus
      ?? resolvedHierarchyAggregateNode?.conservativeTransferStatus
      ?? resolvedHierarchyAggregate?.conservativeTransferStatus
      ?? resolvedCrossLevelStateDeltaMerge?.conservativeTransferStatus
      ?? resolvedCrossLevelStateDelta?.conservativeTransferStatus
      ?? resolvedCrossLevelTransfer?.conservativeTransferStatus
      ?? resolvedConservationSummary?.conservativeTransferStatus
      ?? 'not-run',
    stateMutationStatus: resolvedPhaseVolumeLevelUpdate?.stateMutationStatus
      ?? resolvedPhaseVolumeMigration?.stateMutationStatus
      ?? resolvedHierarchyAggregateNode?.stateMutationStatus
      ?? resolvedHierarchyAggregate?.stateMutationStatus
      ?? resolvedCrossLevelStateDeltaMerge?.stateMutationStatus
      ?? resolvedCrossLevelStateDelta?.stateMutationStatus
      ?? resolvedCrossLevelTransfer?.stateMutationStatus
      ?? 'not-run',
    stateAuthorityStatus: resolvedPhaseVolumeLevelUpdate?.stateAuthorityStatus
      ?? resolvedPhaseVolumeMigration?.stateAuthorityStatus
      ?? resolvedHierarchyAggregateNode?.stateAuthorityStatus
      ?? resolvedHierarchyAggregate?.stateAuthorityStatus
      ?? resolvedCrossLevelStateDeltaMerge?.stateAuthorityStatus
      ?? resolvedCrossLevelStateDelta?.stateAuthorityStatus
      ?? 'not-run',
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}
