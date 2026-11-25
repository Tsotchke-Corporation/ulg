// Extracted from schroederHierarchyGpu.js (Gate 6 Phase D mechanical decomposition).

import {
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
  SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_ROW_LAYOUT,
  SCHROEDER_CONSERVATION_SUMMARY_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_COUPLING_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_STATE_DELTA_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_TRANSFER_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_CANDIDATE_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_ROW_LAYOUT,
  SCHROEDER_HIERARCHY_AGGREGATE_NODE_ROW_LAYOUT,
  SCHROEDER_HIERARCHY_AGGREGATE_ROW_LAYOUT,
  SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ROW_LAYOUT,
  SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_ROW_LAYOUT,
  SCHROEDER_LAW_QUEUE_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  SCHROEDER_PARTICLE_STORAGE_ALLOCATION_ROW_LAYOUT,
  SCHROEDER_PARTICLE_STORAGE_FREE_LIST_ROW_LAYOUT,
  SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ROW_LAYOUT,
  SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ROW_LAYOUT,
  SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_ROW_LAYOUT,
  SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ROW_LAYOUT,
  SCHROEDER_PHASE_VOLUME_MIGRATION_ROW_LAYOUT,
  SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_ROW_LAYOUT,
  SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_ROW_LAYOUT,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
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
  ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ADMISSION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ADMISSION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_ADMISSION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_AUTHORITY_POLICY_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATOR_ADMISSION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_FREE_LIST_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMISSION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ADMISSION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_ADMISSION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_ADMISSION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_SCHEMA,
  ULG_SCHROEDER_PORTABLE_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA,
  ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA,
  ULG_SCHROEDER_STATE_DELTA_MERGE_ADMISSION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  acquireQueueOrderedPooledBuffer,
  assertQueueOrderedCleanupClaimsRegistered,
  cancelQueueOrderedCleanupClaim,
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline,
  createQueueOrderedCleanupClaimIssuer,
  deferSubmittedWorkCleanup,
  registerQueueOrderedCleanupClaim,
  registerQueueOrderedPooledBufferReturn,
  releaseOrDestroyQueueOrderedPooledBuffer,
  releaseQueueOrderedPooledBuffer,
  sealQueueOrderedFinalConsumerCapability,
  submitQueueOrderedWork,
  releaseSubmittedWorkCleanupQueueOrdered,
  withWorkerQueueSubmitBurstWriteThrough,
  workerQueueSubmitBurstStats
} from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  adoptSphGpuParticleDispersedMediumOpticsSidecar,
  advanceExactParentSphDispersedMediumOpticsTopologyEpoch,
  cloneSphGpuParticleUploadWithoutDispersedMediumOptics,
  ensureSphGpuParticleBufferSetBorrowLifecycle,
  exactParentSphDispersedMediumOpticsTopologyEpochTransitionMatches,
  registerTopologyStableSphDispersedMediumOpticsSourceFamilyContinuation,
  retireSphGpuParticleBufferSetDispersedMediumOptics,
  sphGpuParticleUploadAdvertisesDispersedMediumOptics,
  sphParticleStateRequiresExplicitIdentity
} from './sphGpuBuffers.js';
import {
  appendGpuReadbackTelemetryObservation,
  createGpuReadbackTelemetry,
  mergeGpuReadbackTelemetry
} from './sphGpuReadbackTelemetry.js';
import {
  cloneMlsMpmParticleStateForNext,
  cloneSphParticleStateForNext,
  destroyMlsMpmResidentStepBuffers,
  retainedContinuationBuffersFromUploads,
  rollbackMlsMpmPhaseSlotContinuationOwnership,
  commitFreshSphDispersedMediumOpticsReplacement,
  createSchroederParticleStorageAdoption,
  isFreshSphDispersedMediumOpticsReplacementPending,
  isSameResidentProductMass,
  mergeResidentProductMassBuffersWebGpu,
  preflightFreshSphDispersedMediumOpticsReplacementCommit,
  registerFreshSphDispersedMediumOpticsReplacement,
  rejectFreshSphDispersedMediumOpticsReplacement,
  runSchroederFarForceDeltaFusionWebGpu,
  runMlsMpmResidentStepWithOptionalWebGpu,
  runSphPressureInterfaceStageComputeTask,
  selectSphReactionActivationWatchTable,
  sphDispersedMediumOpticsMatchesParticleUpload,
  sphDispersedMediumOpticsRemapRequiredError,
  summarizeGpuTimestampRecorderQueueStages,
  transferMaterialPropertyBankAuxiliaryOwnership,
  ULG_MLS_MPM_RESIDENT_STAGE_TIMING_SCHEMA
} from './sphMlsMpmGpuStep.js';
import {
  createSchroederSpatialAggregateTraversalGpu,
  finalizeSchroederSpatialAggregateTraversalSubmissionReceipt,
  isFinalizedSchroederSpatialAggregateTraversalSubmissionReceipt
} from './schroederSpatialAggregateTraversalGpu.js';
import {
  SCHROEDER_FROZEN_LEVEL_ASSIGNMENT_REFRESH_MODE,
  SCHROEDER_FROZEN_SPATIAL_KEY_CHURN_TARGETS_OPTION,
  createSchroederFrozenLevelAssignmentRefreshGpu
} from './schroederFrozenLevelAssignmentRefreshGpu.js';


export const SCHROEDER_ACTIVE_NODE_FLOATS = SCHROEDER_ACTIVE_NODE_ROW_LAYOUT.length;
export const SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_UINTS =
  SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_ROW_LAYOUT.length;
export const SCHROEDER_CONSERVATION_SUMMARY_FLOATS = SCHROEDER_CONSERVATION_SUMMARY_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS = SCHROEDER_CROSS_LEVEL_COUPLING_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS = SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS = SCHROEDER_CROSS_LEVEL_STATE_DELTA_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS = SCHROEDER_CROSS_LEVEL_TRANSFER_ROW_LAYOUT.length;
export const SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS = SCHROEDER_FAR_AGGREGATE_CANDIDATE_ROW_LAYOUT.length;
export const SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS =
  SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_ROW_LAYOUT.length;
export const SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS =
  SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ROW_LAYOUT.length;
export const SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS = SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_ROW_LAYOUT.length;
export const SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS =
  SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT.length;
export const SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS =
  SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ROW_LAYOUT.length;
export const SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS =
  SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_ROW_LAYOUT.length;
export const SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS =
  SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_ROW_LAYOUT.length;
export const SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS = SCHROEDER_HIERARCHY_AGGREGATE_NODE_ROW_LAYOUT.length;
export const SCHROEDER_HIERARCHY_AGGREGATE_FLOATS = SCHROEDER_HIERARCHY_AGGREGATE_ROW_LAYOUT.length;
export const SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS = SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ROW_LAYOUT.length;
export const SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS = SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_ROW_LAYOUT.length;
export const SCHROEDER_LAW_QUEUE_FLOATS = SCHROEDER_LAW_QUEUE_ROW_LAYOUT.length;
export const SCHROEDER_LEVEL_ASSIGNMENT_FLOATS = SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length;
export const SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS = SCHROEDER_PARTICLE_STORAGE_ALLOCATION_ROW_LAYOUT.length;
export const SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS = SCHROEDER_PARTICLE_STORAGE_FREE_LIST_ROW_LAYOUT.length;
export const SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS =
  SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ROW_LAYOUT.length;
export const SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS =
  SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ROW_LAYOUT.length;
export const SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS = SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_ROW_LAYOUT.length;
export const SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS = SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ROW_LAYOUT.length;
export const SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS = SCHROEDER_PHASE_VOLUME_MIGRATION_ROW_LAYOUT.length;
export const SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS =
  SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_ROW_LAYOUT.length;
export const SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS =
  SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_ROW_LAYOUT.length;
export const SCHROEDER_ACTIVE_NODE_INDEX_WORKGROUP_SIZE = 64;
export const SCHROEDER_ACTIVE_NODE_SORTED_INDEX_WORKGROUP_SIZE = 64;
export const SCHROEDER_ACTIVE_NODE_WORKGROUP_SIZE = 64;
export const SCHROEDER_CONSERVATION_SUMMARY_WORKGROUP_SIZE = 64;
export const SCHROEDER_CROSS_LEVEL_COUPLING_WORKGROUP_SIZE = 64;
export const SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_WORKGROUP_SIZE = 64;
export const SCHROEDER_CROSS_LEVEL_STATE_DELTA_WORKGROUP_SIZE = 64;
export const SCHROEDER_CROSS_LEVEL_TRANSFER_WORKGROUP_SIZE = 64;
export const SCHROEDER_FAR_AGGREGATE_CANDIDATE_WORKGROUP_SIZE = 64;
export const SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_WORKGROUP_SIZE = 1;
export const SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_WORKGROUP_SIZE = 64;
export const SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_WORKGROUP_SIZE = 64;
export const SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_WORKGROUP_SIZE = 64;
export const SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_WORKGROUP_SIZE = 64;
export const SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_WORKGROUP_SIZE = 1;
export const SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_WORKGROUP_SIZE = 64;
export const SCHROEDER_HIERARCHY_AGGREGATE_NODE_WORKGROUP_SIZE = 64;
export const SCHROEDER_HIERARCHY_AGGREGATE_WORKGROUP_SIZE = 64;
export const SCHROEDER_LAW_NEIGHBOR_CANDIDATE_WORKGROUP_SIZE = 64;
export const SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT = 8;
export const SCHROEDER_LAW_QUEUE_WORKGROUP_SIZE = 64;
export const SCHROEDER_LEVEL_ASSIGNMENT_WORKGROUP_SIZE = 64;
export const SCHROEDER_PARTICLE_STORAGE_ALLOCATION_WORKGROUP_SIZE = 64;
export const SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_STORAGE_BUFFER_COUNT = 10;
export const SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_WORKGROUP_SIZE = 64;
export const SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_WORKGROUP_SIZE = 64;
export const SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_WORKGROUP_SIZE = 1;
export const SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_WORKGROUP_SIZE = 64;
export const SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_WORKGROUP_SIZE = 64;
export const SCHROEDER_PHASE_VOLUME_MIGRATION_WORKGROUP_SIZE = 64;
export const SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_WORKGROUP_SIZE = 64;
export const SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_WORKGROUP_SIZE = 64;
export const SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_MISSING_ROW = 0xffffffff;
const schroederActiveNodeControlBuffersByDevice = new WeakMap();
const schroederLevelAssignmentControlBuffersByDevice = new WeakMap();
export const SCHROEDER_ACTIVE_NODE_SCOPE = 'schroeder-gpu-active-node-list';
export const SCHROEDER_ACTIVE_NODE_INDEX_SCOPE = 'schroeder-gpu-active-node-index';
export const SCHROEDER_CROSS_LEVEL_COUPLING_SCOPE = 'schroeder-gpu-cross-level-coupling';
export const SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCOPE = 'schroeder-gpu-law-neighbor-candidates';
export const SCHROEDER_LAW_QUEUE_SCOPE = 'schroeder-gpu-law-queue';
export const SCHROEDER_LEVEL_ASSIGNMENT_SCOPE = 'schroeder-gpu-level-assignment';
export const SCHROEDER_SAME_LEVEL_MECHANICS_SCOPE = 'schroeder-same-level-mls-mpm-ocean-mechanics';
export const SCHROEDER_NO_FULL_READBACK_MODE = 'no-full-readback';
export const SCHROEDER_FULL_READBACK_MODE = 'full-assignment-readback';
export const SCHROEDER_TWO_LEVEL_COVERAGE_ADMISSION_SCHEMA =
  'peercompute.ulg.schroeder-two-level-coverage-admission.v0';
export const SCHROEDER_SPATIAL_TRANSITION_POLICY_CONSERVATIVE_RESIDENT =
  'conservative-resident';
export const SCHROEDER_SPATIAL_TRANSITION_POLICY_OBSERVED_COMPACT_DIAGNOSTIC =
  'observed-compact-diagnostic';
export const SCHROEDER_FULL_ACTIVE_NODE_READBACK_MODE = 'full-active-node-readback';
export const SCHROEDER_FULL_ACTIVE_NODE_INDEX_READBACK_MODE = 'full-active-node-index-readback';
export const SCHROEDER_FULL_ACTIVE_NODE_SORTED_INDEX_READBACK_MODE = 'full-active-node-sorted-index-readback';
export const SCHROEDER_FULL_CROSS_LEVEL_READBACK_MODE = 'full-cross-level-readback';
export const SCHROEDER_FULL_CONSERVATION_SUMMARY_READBACK_MODE = 'full-conservation-summary-readback';
export const SCHROEDER_FULL_CROSS_LEVEL_STATE_DELTA_MERGE_READBACK_MODE = 'full-cross-level-state-delta-merge-readback';
export const SCHROEDER_FULL_CROSS_LEVEL_STATE_DELTA_READBACK_MODE = 'full-cross-level-state-delta-readback';
export const SCHROEDER_FULL_CROSS_LEVEL_TRANSFER_READBACK_MODE = 'full-cross-level-transfer-readback';
export const SCHROEDER_FULL_FAR_AGGREGATE_CANDIDATE_READBACK_MODE = 'full-schroeder-far-aggregate-candidate-readback';
export const SCHROEDER_COMPACT_FAR_AGGREGATE_DIAGNOSTIC_READBACK_MODE =
  'compact-schroeder-far-aggregate-diagnostic-summary-readback';
export const SCHROEDER_FULL_FAR_AGGREGATE_FORCE_APPLICATION_READBACK_MODE =
  'full-schroeder-far-aggregate-force-application-readback';
export const SCHROEDER_FULL_FAR_AGGREGATE_FORCE_SUMMARY_READBACK_MODE = 'full-schroeder-far-aggregate-force-summary-readback';
export const SCHROEDER_FULL_FAR_AGGREGATE_GAS_STATE_DELTA_READBACK_MODE =
  'full-schroeder-far-aggregate-gas-state-delta-readback';
export const SCHROEDER_FULL_FAR_AGGREGATE_GAS_CELL_IMPORT_READBACK_MODE =
  'full-schroeder-far-aggregate-gas-cell-import-readback';
export const SCHROEDER_COMPACT_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_READBACK_MODE =
  'compact-schroeder-far-aggregate-law-consumer-diagnostic-summary-readback';
export const SCHROEDER_FULL_FAR_AGGREGATE_LAW_CONSUMER_READBACK_MODE =
  'full-schroeder-far-aggregate-law-consumer-readback';
export const SCHROEDER_FULL_HIERARCHY_AGGREGATE_NODE_READBACK_MODE = 'full-schroeder-hierarchy-aggregate-node-readback';
export const SCHROEDER_FULL_HIERARCHY_AGGREGATE_READBACK_MODE = 'full-schroeder-hierarchy-aggregate-readback';
export const SCHROEDER_FULL_LAW_NEIGHBOR_CANDIDATE_READBACK_MODE = 'full-schroeder-law-neighbor-candidate-readback';
export const SCHROEDER_FULL_LAW_QUEUE_READBACK_MODE = 'full-schroeder-law-queue-readback';
export const SCHROEDER_COMPACT_LAW_NEIGHBOR_DIAGNOSTIC_READBACK_MODE = 'compact-schroeder-law-neighbor-diagnostic-readback';
export const SCHROEDER_COMPACT_PHASE_VOLUME_DIAGNOSTIC_READBACK_MODE = 'compact-schroeder-phase-volume-diagnostic-summary-readback';
export const SCHROEDER_FULL_PHASE_VOLUME_LEVEL_UPDATE_READBACK_MODE = 'full-schroeder-phase-volume-level-update-readback';
export const SCHROEDER_FULL_PHASE_VOLUME_MIGRATION_READBACK_MODE = 'full-schroeder-phase-volume-migration-readback';
export const SCHROEDER_FULL_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_READBACK_MODE =
  'full-schroeder-phase-volume-split-merge-proposal-readback';
export const SCHROEDER_FULL_PHASE_VOLUME_SPLIT_MERGE_APPLY_READBACK_MODE =
  'full-schroeder-phase-volume-split-merge-apply-readback';
export const SCHROEDER_FULL_PARTICLE_STORAGE_ALLOCATION_READBACK_MODE =
  'full-schroeder-particle-storage-allocation-readback';
export const SCHROEDER_FULL_PARTICLE_STORAGE_MATERIALIZATION_READBACK_MODE =
  'full-schroeder-particle-storage-materialization-readback';
export const SCHROEDER_FULL_PARTICLE_STORAGE_SLOT_ASSIGNMENT_READBACK_MODE =
  'full-schroeder-particle-storage-slot-assignment-readback';
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
export const SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_AGGREGATE_MISSING_MASK = 1;
export const SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_RESIDUAL_MASK = 2;
export const SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_SPARSE_SURFACE_MASK = 4;
export const SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS = Object.freeze([
  {
    bit: SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_AGGREGATE_MISSING_MASK,
    reason: 'aggregate-missing-or-interface-pressure'
  },
  {
    bit: SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_RESIDUAL_MASK,
    reason: 'conservation-residual-pressure'
  },
  {
    bit: SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_SPARSE_SURFACE_MASK,
    reason: 'sparse-surface-preserve-fine-pressure'
  },
  { bit: 8, reason: 'reaction-front-pressure-reserved' },
  { bit: 16, reason: 'wall-boundary-pressure-reserved' },
  { bit: 32, reason: 'shock-or-high-gradient-pressure-reserved' },
  { bit: 64, reason: 'material-interface-support-pressure' }
]);
export const DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET = 64;

// Ceiling on the neighbour-candidate arena, independent of particle count.
// 256 MiB is generous for the scenes this runs today and still bounded, which
// the previous per-particle reservation was not.
export const DEFAULT_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ARENA_BYTE_BUDGET = 256 * 1024 * 1024;
export const SCHROEDER_FAR_LAW_GRAVITY_MASK = 8;
export const SCHROEDER_FAR_LAW_RADIATION_MASK = 16;
export const SCHROEDER_FAR_LAW_PLASMA_MASK = 32;
export const SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK = 64;
export const SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK =
  SCHROEDER_FAR_LAW_RADIATION_MASK
  | SCHROEDER_FAR_LAW_PLASMA_MASK
  | SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK;
export const SCHROEDER_FAR_AGGREGATE_LAW_MASK =
  SCHROEDER_FAR_LAW_GRAVITY_MASK
  | SCHROEDER_FAR_LAW_RADIATION_MASK
  | SCHROEDER_FAR_LAW_PLASMA_MASK
  | SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET = 32;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA = 0.5;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_NEAR_FIELD_SUPPORT_SCALE = 2;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND = 0.01;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_GRAVITATIONAL_CONSTANT = 6.67430e-11;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_SOFTENING_LENGTH_M = 1e-3;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_FORCE_SCALE = 1;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_ACCELERATION_PRESSURE_THRESHOLD = 0;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_ACCELERATION_SCALE = 1;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_MAX_ACCELERATION_M_PER_S2 = 0;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_SCALE = 1;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_SCALE = 1;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_SUMMARY_SCALE = 1;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_TEMPERATURE_K = 293.15;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_CONSTANT_PROXY = 287.05;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_PRESSURE_THRESHOLD = 0;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_PRESSURE_THRESHOLD = 0;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_PRESSURE_THRESHOLD = 0;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_POLICY_PRESSURE_RATIO_THRESHOLD = 0;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_POLICY_ALLOW_STATE_DELTA_MUTATION = false;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_REFERENCE_PRESSURE_PA = 101325;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_PRESSURE_SCALE = 1;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_DENSITY_SCALE = 1;
export const DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_GAMMA = 1.4;
export const SCHROEDER_PARTICLE_STORAGE_FAMILY_SPH_STATE_MASK = 1;
export const SCHROEDER_PARTICLE_STORAGE_FAMILY_MLS_MPM_MECHANICS_MASK = 2;
export const SCHROEDER_PARTICLE_STORAGE_FAMILY_SPH_THERMO_MASK = 4;
export const SCHROEDER_PARTICLE_STORAGE_FAMILY_SPH_IDENTITY_MASK = 8;
export const SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK =
  SCHROEDER_PARTICLE_STORAGE_FAMILY_SPH_STATE_MASK
  | SCHROEDER_PARTICLE_STORAGE_FAMILY_MLS_MPM_MECHANICS_MASK
  | SCHROEDER_PARTICLE_STORAGE_FAMILY_SPH_THERMO_MASK
  | SCHROEDER_PARTICLE_STORAGE_FAMILY_SPH_IDENTITY_MASK;
export const SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES = Object.freeze([
  'sph-particle-state',
  'mls-mpm-particle-mechanics',
  'sph-particle-thermo',
  'sph-particle-identity'
]);
export const SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_STATE_DELTA_OUTPUT_FAMILY =
  'schroeder-far-aggregate-law-consumer-state-delta';
export const SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_OUTPUT_FAMILY =
  'schroeder-far-aggregate-gas-state-delta';
export const SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_OUTPUT_FAMILY =
  'resident-gas-pressure';
export const SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_TARGET_FAMILY = 'gas-pressure';

export const DEFAULT_MIN_LEVEL = -8;
export const DEFAULT_MAX_LEVEL = 8;
export const DEFAULT_BASE_GRID_SPACING_M = 1;
export const DEFAULT_TARGET_SUPPORT_CELLS = 1.5;
export const DEFAULT_SUPPORT_RADIUS_SCALE = 1;
export const DEFAULT_HYSTERESIS_BAND = 0.15;
export const DEFAULT_TILE_CELL_COUNT = 8;
export const DEFAULT_SUPPORT_INFLATE_CELLS = 1;
export const DEFAULT_GAS_PHASE_ID = 3;
export const DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD = 64;
export const DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD = 1;
export const DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE = 1e-4;
const SCHROEDER_STATE_DELTA_OUTPUT_FAMILY = 'schroeder-hierarchy-state-delta';
const SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY = 'schroeder-hierarchy';
const SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_OUTPUT_FAMILY =
  'schroeder-phase-volume-split-merge-apply';
const SCHROEDER_PARTICLE_STORAGE_ALLOCATION_OUTPUT_FAMILY =
  'schroeder-particle-storage-allocation';
const SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_OUTPUT_FAMILY =
  'schroeder-particle-storage-slot-assignment';
const SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_OUTPUT_FAMILY =
  'schroeder-particle-storage-materialization';
const SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_OUTPUT_FAMILY =
  'schroeder-far-aggregate-force-application';
const SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_OUTPUT_FAMILY =
  'schroeder-far-aggregate-law-consumer';
const SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_OUTPUT_FAMILY =
  'schroeder-far-aggregate-law-consumer-diagnostics';
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
const SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_ADMITTED_STATUSES = new Set([
  'schroeder-phase-volume-split-merge-admission-published',
  'schroeder-phase-volume-split-merge-admission-admitted',
  'worker-retained-schroeder-phase-volume-split-merge-output-admitted',
  'accepted',
  'admitted'
]);
const SCHROEDER_PARTICLE_STORAGE_ALLOCATOR_ADMITTED_STATUSES = new Set([
  'schroeder-particle-storage-allocator-admission-published',
  'schroeder-particle-storage-allocator-admission-admitted',
  'worker-retained-schroeder-particle-storage-allocation-output-admitted',
  'accepted',
  'admitted'
]);
const SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ADMITTED_STATUSES = new Set([
  'schroeder-particle-storage-slot-assignment-admission-published',
  'schroeder-particle-storage-slot-assignment-admission-admitted',
  'worker-retained-schroeder-particle-storage-slot-assignment-output-admitted',
  'accepted',
  'admitted'
]);
const SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMITTED_STATUSES = new Set([
  'schroeder-particle-storage-materialization-admission-published',
  'schroeder-particle-storage-materialization-admission-admitted',
  'worker-retained-schroeder-particle-storage-materialization-output-admitted',
  'accepted',
  'admitted'
]);
const SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ADMITTED_STATUSES = new Set([
  'schroeder-far-aggregate-force-application-admission-published',
  'schroeder-far-aggregate-force-application-admission-admitted',
  'worker-retained-schroeder-far-aggregate-force-application-output-admitted',
  'accepted',
  'admitted'
]);
const SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_ADMITTED_STATUSES = new Set([
  'schroeder-far-aggregate-law-consumer-admission-published',
  'schroeder-far-aggregate-law-consumer-admission-admitted',
  'worker-retained-schroeder-far-aggregate-law-consumer-output-admitted',
  'accepted',
  'admitted'
]);
const SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ADMITTED_STATUSES = new Set([
  'schroeder-far-aggregate-gas-state-delta-admission-published',
  'schroeder-far-aggregate-gas-state-delta-admission-admitted',
  'worker-retained-schroeder-far-aggregate-gas-state-delta-output-admitted',
  'accepted',
  'admitted'
]);

export const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

export const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

// Frozen level classification is reused across fine substeps while positions
// advance. The count/profile key selects persistent, capacity-sized device
// arenas; it is not program identity. The refresh factory separately shares
// immutable programs by device + stable execution ABI, so a topology change
// may allocate a new runtime without recompiling a particle-count variant.
const SCHROEDER_FROZEN_ASSIGNMENT_REFRESH_RUNTIME_CACHE = new WeakMap();
const SCHROEDER_AGGREGATE_TRAVERSAL_RUNTIME_CACHE = new WeakMap();

export function cachedSchroederFrozenAssignmentRefreshRuntime(
  device,
  particleCount,
  { spatialKeyChurnObservationEnabled = false } = {}
) {
  let byParticleCount =
    SCHROEDER_FROZEN_ASSIGNMENT_REFRESH_RUNTIME_CACHE.get(device);
  if (!byParticleCount) {
    byParticleCount = new Map();
    SCHROEDER_FROZEN_ASSIGNMENT_REFRESH_RUNTIME_CACHE.set(
      device,
      byParticleCount
    );
  }
  const cacheKey = `${particleCount}:${
    spatialKeyChurnObservationEnabled ? 'spatial-key-churn' : 'production'
  }`;
  let runtime = byParticleCount.get(cacheKey);
  if (!runtime) {
    runtime = createSchroederFrozenLevelAssignmentRefreshGpu(device, {
      maxParticleCount: particleCount,
      // One accepted private predecessor retains its terminal assignment
      // while the successor rotates its current and next fine assignments.
      // Three shared slots cover that bounded overlap without retiring a
      // still-authenticated predecessor or changing any physical substep.
      arenaCount: 3,
      spatialKeyChurnObservationEnabled,
      label: `ulg-schroeder-two-level-frozen-refresh-${particleCount}`
    });
    byParticleCount.set(cacheKey, runtime);
  }
  return runtime;
}

export function cachedSchroederAggregateTraversalRuntime(device, particleCount) {
  let byParticleCount =
    SCHROEDER_AGGREGATE_TRAVERSAL_RUNTIME_CACHE.get(device);
  if (!byParticleCount) {
    byParticleCount = new Map();
    SCHROEDER_AGGREGATE_TRAVERSAL_RUNTIME_CACHE.set(
      device,
      byParticleCount
    );
  }
  let runtime = byParticleCount.get(particleCount);
  if (!runtime) {
    runtime = createSchroederSpatialAggregateTraversalGpu(device, {
      maxQueryCount: particleCount,
      arenaCount: 3,
      label: `ulg-schroeder-public-e-star-aggregate-traversal-${particleCount}`
    });
    byParticleCount.set(particleCount, runtime);
  }
  return runtime;
}

/**
 * Enumerate GPU allocations owned by device-cached Schroeder hierarchy
 * runtimes and shared control buffers so resident lane retirement never
 * raw-destroys cached arenas still shared with subsequent lanes on the same
 * GPUDevice (e.g. two-level frozen-assignment refresh after Reset).
 */
export function schroederHierarchyDeviceRuntimeAllocationOwnership(device) {
  const buffers = new Set();
  if (!device || typeof device !== 'object') {
    return Object.freeze({ buffers: Object.freeze([]) });
  }
  for (const runtime of SCHROEDER_FROZEN_ASSIGNMENT_REFRESH_RUNTIME_CACHE.get(device)?.values() ?? []) {
    for (const entry of runtime?.allocationEntries?.() ?? []) {
      if (entry?.buffer) buffers.add(entry.buffer);
    }
  }
  for (const runtime of SCHROEDER_AGGREGATE_TRAVERSAL_RUNTIME_CACHE.get(device)?.values() ?? []) {
    for (const entry of runtime?.allocationEntries?.() ?? []) {
      if (entry?.buffer) buffers.add(entry.buffer);
    }
  }
  const activeNodeControls = schroederActiveNodeControlBuffersByDevice.get(device);
  if (activeNodeControls) {
    for (const value of Object.values(activeNodeControls)) {
      if (value && typeof value === 'object' && typeof value.destroy === 'function') {
        buffers.add(value);
      }
    }
  }
  const levelAssignControls = schroederLevelAssignmentControlBuffersByDevice.get(device);
  if (levelAssignControls) {
    for (const value of Object.values(levelAssignControls)) {
      if (value && typeof value === 'object' && typeof value.destroy === 'function') {
        buffers.add(value);
      }
    }
  }
  return Object.freeze({ buffers: Object.freeze([...buffers]) });
}

export const schroederHierarchySubmittedTemporaryCleanupClaimIssuer =
  createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'schroeder-hierarchy-submitted-temporaries'
  });
export const finalRenderActiveNodeSubmissionDeferralToken = Object.freeze({
  schema: 'peercompute.ulg.final-render-active-node-submit-deferral.v0'
});
export const deferredFinalRenderActiveNodeSubmissions = new WeakMap();
export const schroederHierarchyTransferCleanupClaimIssuers = new Map(
  ['render', 'next-tick'].map((transferClass) => {
    const producerFamily =
      `schroeder-hierarchy-artifact-transfer:${transferClass}`;
    return [
      producerFamily,
      createQueueOrderedCleanupClaimIssuer({ producerFamily })
    ];
  })
);
export const schroederHierarchySidecarCleanupClaimIssuer =
  createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'schroeder-two-level-sidecar-temporaries'
  });

export function completeSchroederSubmittedTemporaryCleanup({
  device,
  cleanup,
  deferredCleanupRequired,
  queueOrderedCleanup = false,
  submissionObserved = false,
  queueOrderedSubmissionReceipt = null,
  resultAuthority = null
} = {}) {
  if (!deferredCleanupRequired) {
    cleanup?.();
    return null;
  }
  if (
    queueOrderedCleanup === true
    && submissionObserved === true
    && queueOrderedSubmissionReceipt
    && resultAuthority
  ) {
    let producerClaim = null;
    try {
      producerClaim = registerQueueOrderedCleanupClaim(
        schroederHierarchySubmittedTemporaryCleanupClaimIssuer,
        device,
        {
          producerOutput: resultAuthority,
          cleanup
        }
      );
      const queueOrderedFinalConsumer =
        sealQueueOrderedFinalConsumerCapability(
          queueOrderedSubmissionReceipt,
          device,
          {
            finalConsumerOwner: resultAuthority,
            producerClaims: [producerClaim]
          }
        );
      const receipt = releaseSubmittedWorkCleanupQueueOrdered(
        device,
        cleanup,
        {
          queueOrderedFinalConsumer,
          producerClaim,
          producerOutput: resultAuthority,
          producerFamily: 'schroeder-hierarchy-submitted-temporaries'
        }
      );
      resultAuthority.queueOrderedCleanupReceipt = receipt;
      resultAuthority.queueCompletionStatus = receipt.queueCompletionStatus;
      resultAuthority.queueCompletionMethod = receipt.queueCompletionMethod;
      return receipt;
    } catch {
      if (producerClaim != null) {
        try {
          cancelQueueOrderedCleanupClaim(
            producerClaim,
            device,
            {
              producerOutput: resultAuthority,
              cleanup
            }
          );
        } catch {
          // A sealed claim cannot be cancelled. The conservative fallback
          // below still owns the exact temporary ledger.
        }
      }
    }
  }
  const deferred = deferSubmittedWorkCleanup(device, cleanup);
  if (deferred === true && resultAuthority) {
    appendGpuReadbackTelemetryObservation(resultAuthority, {
      hostQueueFenceCount: 1,
      deferredCleanupHostQueueFenceCount: 1
    }, {
      source: 'schroeder-hierarchy-submitted-temporary-cleanup'
    });
    resultAuthority.queueCompletionStatus = 'queue-submitted-cleanup-deferred';
    resultAuthority.queueCompletionMethod =
      'deferred queue.onSubmittedWorkDone cleanup';
  }
  return deferred;
}

export function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function createSchroederTwoLevelResidentStageTiming(
  gpuTimestampRecorder = null
) {
  if (gpuTimestampRecorder?.active !== true) return null;
  const summary = summarizeGpuTimestampRecorderQueueStages(
    gpuTimestampRecorder
  );
  const rawEncoderTimestampProfile =
    typeof gpuTimestampRecorder?.encoderTimestampProfile === 'function'
      ? gpuTimestampRecorder.encoderTimestampProfile()
      : null;
  const encoderStageGpuMs = rawEncoderTimestampProfile?.stageGpuMs
    && typeof rawEncoderTimestampProfile.stageGpuMs === 'object'
    && !Array.isArray(rawEncoderTimestampProfile.stageGpuMs)
      ? { ...rawEncoderTimestampProfile.stageGpuMs }
      : null;
  const encoderStageGpuStats = rawEncoderTimestampProfile?.stageGpuStats
    && typeof rawEncoderTimestampProfile.stageGpuStats === 'object'
    && !Array.isArray(rawEncoderTimestampProfile.stageGpuStats)
      ? Object.fromEntries(Object.entries(
          rawEncoderTimestampProfile.stageGpuStats
        ).map(([stage, stats]) => [stage, { ...stats }]))
      : null;
  const gpuTimestampProfile = rawEncoderTimestampProfile
    && typeof rawEncoderTimestampProfile === 'object'
      ? {
          ...rawEncoderTimestampProfile,
          stageGpuMs: encoderStageGpuMs,
          stageGpuStats: encoderStageGpuStats
        }
      : null;
  if (
    summary.stageGpuMs == null
    && summary.stageGpuStats == null
    && gpuTimestampProfile == null
  ) return null;
  return {
    schema: ULG_MLS_MPM_RESIDENT_STAGE_TIMING_SCHEMA,
    totalMs: null,
    stageMs: {},
    // Queue-fence stage windows are diagnostic wall-clock GPU completion
    // intervals. They deliberately remain separate from timestamp-query pass
    // spans (`stageGpuMs`) because the former serialize the queue and include
    // submit latency.
    stageGpuMs: encoderStageGpuMs,
    gpuTimestampProfile,
    queueStageGpuMs: summary.stageGpuMs == null
      ? null
      : { ...summary.stageGpuMs },
    queueStageGpuStats: summary.stageGpuStats == null
      ? null
      : Object.fromEntries(Object.entries(summary.stageGpuStats).map(
          ([stage, stats]) => [stage, { ...stats }]
        )),
    queueStageGpuSummaryStatus: summary.status,
    queueStageGpuRecorderSchema: summary.recorderSchema,
    queueStageGpuRecorderKind: summary.recorderKind,
    queueStageGpuRecorderCapabilities: { ...summary.capabilities }
  };
}

function nextPowerOfTwo(value) {
  let result = 1;
  const target = Math.max(1, Math.ceil(finiteNumber(value, 1)));
  while (result < target) result *= 2;
  return result;
}

export function finitePositive(value, fallback) {
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

export function assertPackedInputs({ sphParticleState, mlsMpmParticleState }) {
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

export function writeStorageBuffer(device, label, data, { copySource = false } = {}) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE
      | GPU_BUFFER_USAGE.COPY_DST
      | (copySource ? GPU_BUFFER_USAGE.COPY_SRC : 0)
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

export function activeNodeSharedControlBuffers(device, paramsByteLength) {
  let controls = schroederActiveNodeControlBuffersByDevice.get(device);
  if (controls) {
    if (Number(controls.paramsBuffer?.size ?? 0) < paramsByteLength) {
      throw new RangeError(
        'Retained Schroeder active-node params buffer is smaller than the active ABI'
      );
    }
    return controls;
  }
  controls = Object.freeze({
    disabledOverlayBuffer: writeStorageBuffer(
      device,
      'ulg-schroeder-active-node-phase-volume-assignment-overlay-disabled',
      new Float32Array(1)
    ),
    disabledOverlayIndexBuffer: writeStorageBuffer(
      device,
      'ulg-schroeder-active-node-phase-volume-assignment-overlay-index-disabled',
      new Uint32Array([
        SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_MISSING_ROW
      ])
    ),
    paramsBuffer: device.createBuffer({
      label: 'ulg-schroeder-active-node-params',
      size: paramsByteLength,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    })
  });
  schroederActiveNodeControlBuffersByDevice.set(device, controls);
  return controls;
}

export function levelAssignmentSharedControlBuffers(device) {
  let controls = schroederLevelAssignmentControlBuffersByDevice.get(device);
  if (controls) return controls;
  controls = Object.freeze({
    paramsBuffer: device.createBuffer({
      label: 'ulg-schroeder-level-assignment-params',
      size: 48,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    })
  });
  schroederLevelAssignmentControlBuffersByDevice.set(device, controls);
  return controls;
}

export function optionalSourceStateBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
}

export function optionalSourceThermoBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
}

export function optionalSourceIdentityBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.identityBuffer : null;
}

export function optionalSourceMechanicsBuffer(mlsMpmParticleUpload) {
  return mlsMpmParticleUpload?.status === 'webgpu-uploaded' ? mlsMpmParticleUpload.mechanicsBuffer : null;
}

function explicitPositiveU32(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 0xffff_ffff
    ? number
    : null;
}

function gpuBufferHasBytes(buffer, requiredBytes) {
  if (!buffer) return false;
  const size = Number(buffer.size ?? buffer.byteLength);
  return !Number.isFinite(size) || size >= requiredBytes;
}

// Exported for the worker-lane seed stage (refactor increment W4a): the seed
// must publish bufferFamilyGenerationStatus from this resolver's ACTUAL
// verdict before running the level-assignment kernel, never from its own
// assumption about the caller-supplied lineage words.
export function resolveSchroederParticleBufferFamilyGeneration({
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  particleCount = 0
} = {}) {
  const count = Math.max(0, Math.round(finiteNumber(particleCount, 0)));
  const sphGeneration = explicitPositiveU32(
    sphParticleUpload?.storageGeneration ?? sphParticleUpload?.bufferFamilyGeneration
  );
  const mlsGeneration = explicitPositiveU32(
    mlsMpmParticleUpload?.storageGeneration ?? mlsMpmParticleUpload?.bufferFamilyGeneration
  );
  const countsMatch = sphParticleUpload?.particleCount === count
    && mlsMpmParticleUpload?.particleCount === count;
  const stateBytes = count * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const thermoBytes = count * SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const mechanicsBytes = count
    * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const identityRequired = sphParticleUpload?.identityRequired === true;
  const identityBytes = count * SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT;
  const buffersSized = gpuBufferHasBytes(sphParticleUpload?.stateBuffer, stateBytes)
    && gpuBufferHasBytes(sphParticleUpload?.thermoBuffer, thermoBytes)
    && gpuBufferHasBytes(mlsMpmParticleUpload?.mechanicsBuffer, mechanicsBytes)
    && (!identityRequired || gpuBufferHasBytes(sphParticleUpload?.identityBuffer, identityBytes));
  const ready = sphParticleUpload?.status === 'webgpu-uploaded'
    && mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    && count > 0
    && countsMatch
    && buffersSized
    && sphGeneration != null
    && sphGeneration === mlsGeneration;
  return {
    schema: 'peercompute.ulg.schroeder-particle-buffer-family-generation.v1',
    status: ready
      ? 'schroeder-particle-buffer-family-generation-ready'
      : 'schroeder-particle-buffer-family-generation-rejected',
    ready,
    storageGeneration: ready ? sphGeneration : null,
    sphStorageGeneration: sphGeneration,
    mlsMpmStorageGeneration: mlsGeneration,
    countsMatch,
    buffersSized,
    particleCount: count,
    requiredStateBufferByteLength: stateBytes,
    requiredThermoBufferByteLength: thermoBytes,
    requiredMechanicsBufferByteLength: mechanicsBytes,
    requiredIdentityBufferByteLength: identityRequired ? identityBytes : 0,
    identityRequired,
    reason: ready
      ? null
      : (!countsMatch
          ? 'particle upload counts do not match the spatial source count'
          : (!buffersSized
              ? 'particle buffer family is missing or undersized'
              : 'state/thermo and mechanics uploads do not publish one matching positive generation'))
  };
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
  storageGeneration = null,
  bufferFamilyGenerationStatus = null,
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
  const physicsTick = Math.max(0, Math.round(finiteNumber(
    sphParticleState?.step ?? mlsMpmParticleState?.step,
    0
  )));
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
    physicsTick,
    physicsSubstep: Math.max(0, Math.round(finiteNumber(
      sphParticleState?.physicsSubstep ?? mlsMpmParticleState?.physicsSubstep,
      0
    ))),
    positionEpoch: Math.max(0, Math.round(finiteNumber(
      sphParticleState?.positionEpoch,
      physicsTick
    ))),
    topologyEpoch: Math.max(0, Math.round(finiteNumber(
      sphParticleState?.topologyEpoch,
      0
    ))),
    chartEpoch: Math.max(0, Math.round(finiteNumber(
      sphParticleState?.chartEpoch,
      0
    ))),
    levelEpoch: Math.max(0, Math.round(finiteNumber(
      sphParticleState?.levelEpoch,
      physicsTick
    ))),
    supportEpoch: Math.max(0, Math.round(finiteNumber(
      sphParticleState?.supportEpoch,
      physicsTick
    ))),
    storageGeneration: explicitPositiveU32(storageGeneration),
    bufferFamilyGenerationStatus: bufferFamilyGenerationStatus
      ?? (explicitPositiveU32(storageGeneration) != null
        ? 'schroeder-particle-buffer-family-generation-ready'
        : 'schroeder-particle-buffer-family-generation-unavailable'),
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
  phaseVolumeAssignmentOverlayRowCount = 0,
  phaseVolumeAssignmentOverlayStrideFloats = SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
  phaseVolumeAssignmentOverlayEnabled = false,
  phaseVolumeAssignmentOverlayIndexEnabled = false,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(tileCellCount, DEFAULT_TILE_CELL_COUNT))), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(12, 0, true);
  view.setFloat32(16, Math.max(0, finiteNumber(supportInflateCells, DEFAULT_SUPPORT_INFLATE_CELLS)), true);
  view.setFloat32(20, Math.max(0, finiteNumber(minTileSpacingM, 0)), true);
  view.setFloat32(24, Math.max(0, finiteNumber(maxTileSpacingM, 0)), true);
  view.setFloat32(28, 0, true);
  view.setUint32(32, Math.max(0, Math.round(finiteNumber(phaseVolumeAssignmentOverlayRowCount, 0))), true);
  view.setUint32(36, Math.max(1, Math.round(finiteNumber(
    phaseVolumeAssignmentOverlayStrideFloats,
    SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS
  ))), true);
  view.setUint32(40, phaseVolumeAssignmentOverlayEnabled ? 1 : 0, true);
  view.setUint32(44, phaseVolumeAssignmentOverlayIndexEnabled ? 1 : 0, true);
  view.setUint32(48, 0, true);
  view.setUint32(52, 0, true);
  view.setUint32(56, 0, true);
  view.setUint32(60, 0, true);
  return buffer;
}

export function createSchroederPhaseVolumeAssignmentOverlayIndexParamsArray({
  particleCount = 0,
  phaseVolumeAssignmentOverlayRowCount = 0,
  phaseVolumeAssignmentOverlayStrideFloats = SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
  missingRow = SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_MISSING_ROW
} = {}) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(phaseVolumeAssignmentOverlayRowCount, 0))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    phaseVolumeAssignmentOverlayStrideFloats,
    SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(
    missingRow,
    SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_MISSING_ROW
  ))), true);
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
  // Rows per queue entry the arena can actually hold. The plan sets this below
  // candidateBudget when the byte cap binds; the kernel must use it, because
  // writing candidateBudget rows into a smaller arena runs past the end of the
  // buffer.
  admittedCandidateBudget = null,
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
    admittedCandidateBudget ?? candidateBudget,
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

export function createSchroederFarAggregateCandidateParamsArray({
  activeNodeCount = 0,
  aggregateNodeCount = 0,
  activeNodeStrideFloats = SCHROEDER_ACTIVE_NODE_FLOATS,
  aggregateNodeStrideFloats = SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
  farAggregateCandidateStrideFloats = SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS,
  candidateBudget = DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET,
  enabledFarLawMask = SCHROEDER_FAR_AGGREGATE_LAW_MASK,
  flags = 0,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  openingTheta = DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA,
  nearFieldSupportScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_NEAR_FIELD_SUPPORT_SCALE,
  farFieldErrorBound = DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  queueEpoch = 0,
  stateFamilyId = 1
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(activeNodeCount, 0))), true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(aggregateNodeCount, 0))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    activeNodeStrideFloats,
    SCHROEDER_ACTIVE_NODE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    aggregateNodeStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
  ))), true);
  view.setUint32(16, Math.max(1, Math.round(finiteNumber(
    farAggregateCandidateStrideFloats,
    SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS
  ))), true);
  view.setUint32(20, Math.max(1, Math.round(finiteNumber(
    candidateBudget,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET
  ))), true);
  view.setUint32(24, Math.max(0, Math.round(finiteNumber(
    enabledFarLawMask,
    SCHROEDER_FAR_AGGREGATE_LAW_MASK
  ))), true);
  view.setUint32(28, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(32, finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M), true);
  view.setFloat32(36, Math.max(0, finiteNumber(
    openingTheta,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA
  )), true);
  view.setFloat32(40, Math.max(0, finiteNumber(
    nearFieldSupportScale,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_NEAR_FIELD_SUPPORT_SCALE
  )), true);
  view.setFloat32(44, Math.max(0, finiteNumber(
    farFieldErrorBound,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND
  )), true);
  view.setFloat32(48, finiteNumber(queueEpoch, 0), true);
  view.setFloat32(52, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(56, 0, true);
  view.setFloat32(60, 0, true);
  return buffer;
}

export function createSchroederFarAggregateForceSummaryParamsArray({
  activeNodeCount = 0,
  farAggregateCandidateCount = 0,
  farAggregateCandidateStrideFloats = SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS,
  forceSummaryStrideFloats = SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
  candidateBudget = DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET,
  enabledFarLawMask = SCHROEDER_FAR_AGGREGATE_LAW_MASK,
  flags = 0,
  gravitationalConstant = DEFAULT_SCHROEDER_FAR_AGGREGATE_GRAVITATIONAL_CONSTANT,
  softeningLengthM = DEFAULT_SCHROEDER_FAR_AGGREGATE_SOFTENING_LENGTH_M,
  forceScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_FORCE_SCALE,
  farFieldErrorBound = DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  queueEpoch = 0,
  stateFamilyId = 1
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(activeNodeCount, 0))), true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(
    farAggregateCandidateCount,
    0
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    farAggregateCandidateStrideFloats,
    SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    forceSummaryStrideFloats,
    SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS
  ))), true);
  view.setUint32(16, Math.max(1, Math.round(finiteNumber(
    candidateBudget,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET
  ))), true);
  view.setUint32(20, Math.max(0, Math.round(finiteNumber(
    enabledFarLawMask,
    SCHROEDER_FAR_AGGREGATE_LAW_MASK
  ))), true);
  view.setUint32(24, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(28, 0, true);
  view.setFloat32(32, Math.max(0, finiteNumber(
    gravitationalConstant,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_GRAVITATIONAL_CONSTANT
  )), true);
  view.setFloat32(36, Math.max(0, finiteNumber(
    softeningLengthM,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_SOFTENING_LENGTH_M
  )), true);
  view.setFloat32(40, finiteNumber(
    forceScale,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_FORCE_SCALE
  ), true);
  view.setFloat32(44, Math.max(0, finiteNumber(
    farFieldErrorBound,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND
  )), true);
  view.setFloat32(48, finiteNumber(queueEpoch, 0), true);
  view.setFloat32(52, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(56, 0, true);
  view.setFloat32(60, 0, true);
  return buffer;
}

export function createSchroederFarAggregateDiagnosticSummaryParamsArray({
  forceSummaryRowCount = 0,
  forceSummaryStrideFloats = SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
  diagnosticSummaryStrideFloats = SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS,
  flags = 0,
  openingTheta = DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA,
  farFieldErrorBound = DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  accelerationPressureThreshold = DEFAULT_SCHROEDER_FAR_AGGREGATE_ACCELERATION_PRESSURE_THRESHOLD,
  queueEpoch = 0,
  stateFamilyId = 1
} = {}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(forceSummaryRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    forceSummaryStrideFloats,
    SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    diagnosticSummaryStrideFloats,
    SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(16, Math.max(0, finiteNumber(
    openingTheta,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA
  )), true);
  view.setFloat32(20, Math.max(0, finiteNumber(
    farFieldErrorBound,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND
  )), true);
  view.setFloat32(24, Math.max(0, finiteNumber(
    accelerationPressureThreshold,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_ACCELERATION_PRESSURE_THRESHOLD
  )), true);
  view.setFloat32(28, finiteNumber(queueEpoch, 0), true);
  view.setFloat32(32, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(36, 0, true);
  view.setFloat32(40, 0, true);
  view.setFloat32(44, 0, true);
  return buffer;
}

export function createSchroederFarAggregateLawConsumerParamsArray({
  forceSummaryRowCount = 0,
  forceSummaryStrideFloats = SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
  diagnosticSummaryStrideFloats = SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS,
  lawConsumerStrideFloats = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
  enabledConsumerLawMask = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK,
  admissionApproved = false,
  flags = 0,
  radiationScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_SCALE,
  plasmaScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_SCALE,
  gasSummaryScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_SUMMARY_SCALE,
  gasTemperatureK = DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_TEMPERATURE_K,
  maxFarFieldErrorBound = DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  maxOpeningRatio = DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA,
  queueEpoch = 0,
  stateFamilyId = 1,
  gasConstantProxy = DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_CONSTANT_PROXY
} = {}) {
  const buffer = new ArrayBuffer(80);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(forceSummaryRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    forceSummaryStrideFloats,
    SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    diagnosticSummaryStrideFloats,
    SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS
  ))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    lawConsumerStrideFloats,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS
  ))), true);
  view.setUint32(16, Math.max(0, Math.round(finiteNumber(
    enabledConsumerLawMask,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK
  ))), true);
  view.setUint32(20, admissionApproved ? 1 : 0, true);
  view.setUint32(24, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(28, 0, true);
  view.setFloat32(32, finiteNumber(
    radiationScale,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_SCALE
  ), true);
  view.setFloat32(36, finiteNumber(
    plasmaScale,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_SCALE
  ), true);
  view.setFloat32(40, finiteNumber(
    gasSummaryScale,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_SUMMARY_SCALE
  ), true);
  view.setFloat32(44, Math.max(0, finiteNumber(
    gasTemperatureK,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_TEMPERATURE_K
  )), true);
  view.setFloat32(48, Math.max(0, finiteNumber(
    maxFarFieldErrorBound,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND
  )), true);
  view.setFloat32(52, Math.max(0, finiteNumber(
    maxOpeningRatio,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA
  )), true);
  view.setFloat32(56, finiteNumber(queueEpoch, 0), true);
  view.setFloat32(60, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(64, Math.max(0, finiteNumber(
    gasConstantProxy,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_CONSTANT_PROXY
  )), true);
  view.setFloat32(68, 0, true);
  view.setFloat32(72, 0, true);
  view.setFloat32(76, 0, true);
  return buffer;
}

export function createSchroederFarAggregateLawConsumerDiagnosticSummaryParamsArray({
  lawConsumerRowCount = 0,
  lawConsumerStrideFloats = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
  diagnosticSummaryStrideFloats = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS,
  flags = 0,
  radiationPressureThreshold =
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_PRESSURE_THRESHOLD,
  plasmaPressureThreshold =
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_PRESSURE_THRESHOLD,
  gasPressureThreshold =
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_PRESSURE_THRESHOLD,
  queueEpoch = 0,
  stateFamilyId = 1
} = {}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(lawConsumerRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    lawConsumerStrideFloats,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    diagnosticSummaryStrideFloats,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(16, Math.max(0, finiteNumber(
    radiationPressureThreshold,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_PRESSURE_THRESHOLD
  )), true);
  view.setFloat32(20, Math.max(0, finiteNumber(
    plasmaPressureThreshold,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_PRESSURE_THRESHOLD
  )), true);
  view.setFloat32(24, Math.max(0, finiteNumber(
    gasPressureThreshold,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_PRESSURE_THRESHOLD
  )), true);
  view.setFloat32(28, finiteNumber(queueEpoch, 0), true);
  view.setFloat32(32, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(36, 0, true);
  view.setFloat32(40, 0, true);
  view.setFloat32(44, 0, true);
  return buffer;
}

export function createSchroederFarAggregateGasStateDeltaParamsArray({
  lawConsumerRowCount = 0,
  lawConsumerStrideFloats = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
  gasStateDeltaStrideFloats = SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS,
  admissionApproved = false,
  enabledConsumerLawMask = SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK,
  flags = 0,
  referencePressurePa = DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_REFERENCE_PRESSURE_PA,
  pressureDeltaScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_PRESSURE_SCALE,
  densityDeltaScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_DENSITY_SCALE,
  gasGamma = DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_GAMMA,
  queueEpoch = 0,
  stateFamilyId = 1,
  targetFamilyId = 1
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(lawConsumerRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    lawConsumerStrideFloats,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    gasStateDeltaStrideFloats,
    SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS
  ))), true);
  view.setUint32(12, admissionApproved ? 1 : 0, true);
  view.setUint32(16, Math.max(0, Math.round(finiteNumber(
    enabledConsumerLawMask,
    SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK
  ))), true);
  view.setUint32(20, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  view.setFloat32(32, Math.max(0, finiteNumber(
    referencePressurePa,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_REFERENCE_PRESSURE_PA
  )), true);
  view.setFloat32(36, Math.max(0, finiteNumber(
    pressureDeltaScale,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_PRESSURE_SCALE
  )), true);
  view.setFloat32(40, Math.max(0, finiteNumber(
    densityDeltaScale,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_DENSITY_SCALE
  )), true);
  view.setFloat32(44, Math.max(1.01, finiteNumber(
    gasGamma,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_GAMMA
  )), true);
  view.setFloat32(48, finiteNumber(queueEpoch, 0), true);
  view.setFloat32(52, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(56, finiteNumber(targetFamilyId, 1), true);
  view.setFloat32(60, 0, true);
  return buffer;
}

export function createSchroederFarAggregateGasCellImportParamsArray({
  gasStateDeltaRowCount = 0,
  gasStateDeltaStrideFloats = SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS,
  forceSummaryRowCount = 0,
  forceSummaryStrideFloats = SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
  gasCellStrideFloats = SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS,
  flags = 0,
  defaultCellVolumeM3 = 0,
  queueEpoch = 0,
  stateFamilyId = 1,
  targetFamilyId = 1
} = {}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(gasStateDeltaRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    gasStateDeltaStrideFloats,
    SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS
  ))), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(forceSummaryRowCount, 0))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    forceSummaryStrideFloats,
    SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS
  ))), true);
  view.setUint32(16, Math.max(1, Math.round(finiteNumber(
    gasCellStrideFloats,
    SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS
  ))), true);
  view.setUint32(20, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  view.setFloat32(32, Math.max(0, finiteNumber(defaultCellVolumeM3, 0)), true);
  view.setFloat32(36, finiteNumber(queueEpoch, 0), true);
  view.setFloat32(40, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(44, finiteNumber(targetFamilyId, 1), true);
  return buffer;
}

export function createSchroederFarAggregateForceApplicationParamsArray({
  particleCount = 0,
  forceSummaryRowCount = 0,
  forceSummaryStrideFloats = SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
  particleStateStrideFloats = SPH_GPU_PARTICLE_STATE_FLOATS,
  forceApplicationStrideFloats = SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS,
  admissionApproved = false,
  flags = 0,
  dtS = 0,
  accelerationScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_ACCELERATION_SCALE,
  maxAccelerationMPerS2 = DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_MAX_ACCELERATION_M_PER_S2,
  maxFarFieldErrorBound = DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  maxOpeningRatio = DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA,
  queueEpoch = 0,
  stateFamilyId = 1
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(forceSummaryRowCount, 0))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    forceSummaryStrideFloats,
    SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS
  ))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    particleStateStrideFloats,
    SPH_GPU_PARTICLE_STATE_FLOATS
  ))), true);
  view.setUint32(16, Math.max(1, Math.round(finiteNumber(
    forceApplicationStrideFloats,
    SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS
  ))), true);
  view.setUint32(20, admissionApproved ? 1 : 0, true);
  view.setUint32(24, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(28, 0, true);
  view.setFloat32(32, Math.max(0, finiteNumber(dtS, 0)), true);
  view.setFloat32(36, finiteNumber(
    accelerationScale,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_ACCELERATION_SCALE
  ), true);
  view.setFloat32(40, Math.max(0, finiteNumber(
    maxAccelerationMPerS2,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_MAX_ACCELERATION_M_PER_S2
  )), true);
  view.setFloat32(44, Math.max(0, finiteNumber(
    maxFarFieldErrorBound,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND
  )), true);
  view.setFloat32(48, Math.max(0, finiteNumber(
    maxOpeningRatio,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA
  )), true);
  view.setFloat32(52, finiteNumber(queueEpoch, 0), true);
  view.setFloat32(56, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(60, 0, true);
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

export function createSchroederPhaseVolumeTargetAggregateParamsArray({
  aggregateRowCount = 0,
  assignmentStrideFloats = SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
  aggregateStrideFloats = SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
  flags = 0,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  gasPhaseId = DEFAULT_GAS_PHASE_ID,
  aggregateEpoch = 0,
  stateFamilyId = 1,
  stateVec4Stride = 0,
  thermoVec4Stride = 0
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(aggregateRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    assignmentStrideFloats,
    SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    aggregateStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setInt32(16, Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)), true);
  view.setInt32(20, Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)), true);
  // pad0 carries the sph-state vec4 stride for contribution momentum; zero
  // keeps the legacy zero-momentum contributions.
  view.setUint32(24, Math.max(0, Math.round(finiteNumber(stateVec4Stride, 0))), true);
  view.setUint32(28, 0, true);
  view.setFloat32(32, finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M), true);
  view.setFloat32(36, finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS), true);
  view.setFloat32(40, Math.max(0, finiteNumber(supportRadiusScale, DEFAULT_SUPPORT_RADIUS_SCALE)), true);
  view.setFloat32(44, Math.max(1, finiteNumber(
    phaseVolumeExpandThreshold,
    DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD
  )), true);
  view.setFloat32(48, finiteNumber(gasPhaseId, DEFAULT_GAS_PHASE_ID), true);
  view.setFloat32(52, finiteNumber(aggregateEpoch, 0), true);
  view.setFloat32(56, finiteNumber(stateFamilyId, 1), true);
  // pad2 carries the sph-thermo vec4 stride for contribution mass*T sums;
  // zero keeps legacy zero-energy contributions.
  view.setFloat32(60, Math.max(0, Math.round(finiteNumber(thermoVec4Stride, 0))), true);
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

export function createSchroederPhaseVolumeSplitMergeProposalParamsArray({
  migrationRowCount = 0,
  migrationStrideFloats = SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
  proposalStrideFloats = SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS,
  flags = 0,
  proposalEpoch = 0,
  stateFamilyId = 1,
  coarsenModeId = 1,
  refineModeId = 2,
  aggregateNodeCount = 0,
  aggregateNodeStrideFloats = SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
} = {}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(migrationRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    migrationStrideFloats,
    SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    proposalStrideFloats,
    SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(16, finiteNumber(proposalEpoch, 0), true);
  view.setFloat32(20, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(24, finiteNumber(coarsenModeId, 1), true);
  view.setFloat32(28, finiteNumber(refineModeId, 2), true);
  view.setUint32(32, Math.max(0, Math.round(finiteNumber(aggregateNodeCount, 0))), true);
  view.setUint32(36, Math.max(1, Math.round(finiteNumber(
    aggregateNodeStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
  ))), true);
  return buffer;
}

export function createSchroederPhaseVolumeSplitMergeApplyParamsArray({
  proposalRowCount = 0,
  proposalStrideFloats = SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS,
  applyStrideFloats = SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS,
  admissionApproved = false,
  applyEpoch = 0,
  stateFamilyId = 1,
  residualTolerance = DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(proposalRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    proposalStrideFloats,
    SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    applyStrideFloats,
    SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS
  ))), true);
  view.setUint32(12, admissionApproved ? 1 : 0, true);
  view.setFloat32(16, finiteNumber(applyEpoch, 0), true);
  view.setFloat32(20, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(24, Math.max(0, finiteNumber(
    residualTolerance,
    DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE
  )), true);
  view.setFloat32(28, Math.max(0, finiteNumber(flags, 0)), true);
  return buffer;
}

export function createSchroederParticleStorageAllocationParamsArray({
  applyRowCount = 0,
  applyStrideFloats = SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS,
  allocationStrideFloats = SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS,
  admissionApproved = false,
  allocatorEpoch = 0,
  stateFamilyId = 1,
  currentParticleCapacity = applyRowCount,
  requiredParticleCapacity = currentParticleCapacity,
  targetStateFamilyMask = SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK,
  flags = 0,
  preservePhaseSlots = false
} = {}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(applyRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    applyStrideFloats,
    SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    allocationStrideFloats,
    SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS
  ))), true);
  view.setUint32(12, admissionApproved ? 1 : 0, true);
  view.setFloat32(16, finiteNumber(allocatorEpoch, 0), true);
  view.setFloat32(20, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(24, Math.max(0, finiteNumber(currentParticleCapacity, applyRowCount)), true);
  view.setFloat32(28, Math.max(0, finiteNumber(requiredParticleCapacity, currentParticleCapacity)), true);
  view.setFloat32(32, Math.max(0, finiteNumber(
    targetStateFamilyMask,
    SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK
  )), true);
  view.setFloat32(36, Math.max(0, finiteNumber(flags, 0)) | (preservePhaseSlots ? 1 : 0), true);
  view.setFloat32(40, 0, true);
  view.setFloat32(44, 0, true);
  return buffer;
}

export function createSchroederParticleStorageFreeListRows({
  baseSlotIndex = 0,
  slotCapacity = 0,
  availableSlotCount = slotCapacity,
  maxSlotsPerRow = 1,
  committedEpoch = 0,
  targetStateFamilyMask = SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK,
  status = 1
} = {}) {
  const rows = new Float32Array(SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS);
  rows[0] = Math.max(0, finiteNumber(baseSlotIndex, 0));
  rows[1] = Math.max(0, finiteNumber(slotCapacity, 0));
  rows[2] = Math.max(0, finiteNumber(availableSlotCount, slotCapacity));
  rows[3] = Math.max(1, finiteNumber(maxSlotsPerRow, 1));
  rows[4] = finiteNumber(committedEpoch, 0);
  rows[5] = Math.max(0, finiteNumber(targetStateFamilyMask, SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK));
  rows[6] = finiteNumber(status, 1);
  rows[7] = 0;
  return rows;
}

export function createSchroederParticleStorageSlotAssignmentParamsArray({
  allocationRowCount = 0,
  allocationStrideFloats = SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS,
  freeListStrideFloats = SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS,
  slotAssignmentStrideFloats = SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS,
  admissionApproved = false,
  flags = 0,
  preservePhaseSlots = false,
  assignmentEpoch = 0,
  stateFamilyId = 1,
  targetStateFamilyMask = SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK,
  maxSlotsPerRow = 1
} = {}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(allocationRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    allocationStrideFloats,
    SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    freeListStrideFloats,
    SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS
  ))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    slotAssignmentStrideFloats,
    SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS
  ))), true);
  view.setUint32(16, admissionApproved ? 1 : 0, true);
  view.setUint32(20, Math.max(0, Math.round(finiteNumber(flags, 0))) | (preservePhaseSlots ? 1 : 0), true);
  view.setFloat32(24, finiteNumber(assignmentEpoch, 0), true);
  view.setFloat32(28, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(32, Math.max(0, finiteNumber(
    targetStateFamilyMask,
    SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK
  )), true);
  view.setFloat32(36, Math.max(1, finiteNumber(maxSlotsPerRow, 1)), true);
  view.setFloat32(40, 0, true);
  view.setFloat32(44, 0, true);
  return buffer;
}

export function createSchroederParticleStorageMaterializationParamsArray({
  assignmentRowCount = 0,
  assignmentStrideFloats = SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS,
  sourceParticleCount = 0,
  outputParticleCapacity = sourceParticleCount,
  stateStrideVec4s = SPH_GPU_PARTICLE_STATE_FLOATS / 4,
  thermoStrideVec4s = SPH_GPU_PARTICLE_THERMO_FLOATS / 4,
  mechanicsStrideVec4s = MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS / 4,
  materializationStrideFloats = SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS,
  admissionApproved = false,
  flags = 0,
  materializationEpoch = 0,
  stateFamilyId = 1,
  targetStateFamilyMask = SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(assignmentRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    assignmentStrideFloats,
    SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS
  ))), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(sourceParticleCount, 0))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(outputParticleCapacity, sourceParticleCount))), true);
  view.setUint32(16, Math.max(1, Math.round(finiteNumber(
    stateStrideVec4s,
    SPH_GPU_PARTICLE_STATE_FLOATS / 4
  ))), true);
  view.setUint32(20, Math.max(1, Math.round(finiteNumber(
    thermoStrideVec4s,
    SPH_GPU_PARTICLE_THERMO_FLOATS / 4
  ))), true);
  view.setUint32(24, Math.max(1, Math.round(finiteNumber(
    mechanicsStrideVec4s,
    MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS / 4
  ))), true);
  view.setUint32(28, Math.max(1, Math.round(finiteNumber(
    materializationStrideFloats,
    SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS
  ))), true);
  view.setUint32(32, admissionApproved ? 1 : 0, true);
  view.setUint32(36, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(40, finiteNumber(materializationEpoch, 0), true);
  view.setFloat32(44, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(48, Math.max(0, finiteNumber(
    targetStateFamilyMask,
    SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK
  )), true);
  view.setFloat32(52, 0, true);
  view.setFloat32(56, 0, true);
  view.setFloat32(60, 0, true);
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
  const smallSceneDefaultIndexMode = activeNodeIndexEnabled
    ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE
    : SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE;
  const bucketFirstDefault = Boolean(
    mode === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE
      && activeNodeIndexEnabled
      && !activeNodeSortedIndexEnabled
  );
  const diagnosticSortedRadixPressure = diagnosticCountersAvailable
    && mode === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE
    && (
      exactFallbackScanRatio > fallbackThreshold
      || bucketPressureRatio > bucketPressureThreshold
    );
  const sortedRadixIndexRequired = forcedSortedRadix || diagnosticSortedRadixPressure;
  const sortedRadixEscalationTrigger = forcedSortedRadix
    ? 'forced-traversal-policy'
    : (diagnosticSortedRadixPressure
      ? 'compact-law-neighbor-diagnostics'
      : (activeNodeSortedIndexEnabled ? 'supplied-retained-sorted-index' : null));
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
    smallSceneDefaultIndexMode,
    bucketFirstDefault,
    sortedRadixIndexRequired,
    sortedRadixEscalationAllowed: Boolean(sortedRadixIndexRequired || activeNodeSortedIndexEnabled),
    sortedRadixEscalationTrigger,
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
  const smallSceneDefaultIndexMode = activeNodeIndexEnabled
    ? SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE
    : SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE;
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
  const sortedRadixBuildTrigger = suppliedRetainedIndex
    ? 'supplied-retained-sorted-index'
    : (forcedByLegacyFlag
      ? 'legacy-enable-active-node-sorted-index-flag'
      : (forcedByUseCaseConfig
        ? 'peercompute-use-case-force'
        : (forcedByTraversalPolicy
          ? 'forced-traversal-policy'
          : (diagnosticDrivenBuild ? 'compact-law-neighbor-diagnostics' : null))));
  const bucketFirstDefault = Boolean(
    policyMode === SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_AUTO_MODE
      && traversalPolicyMode === SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE
      && activeNodeIndexEnabled
      && !selected
  );

  return {
    policyMode,
    status,
    selected,
    shouldBuild,
    smallSceneDefaultIndexMode,
    bucketFirstDefault,
    suppliedRetainedIndex,
    buildReason,
    sortedRadixBuildTrigger,
    sortedRadixBuildAllowedByPolicy: policyAllowsBuild,
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
    sortedRadixEscalationTrigger: traversalPolicy.sortedRadixEscalationTrigger,
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

function schroederPhaseVolumeSplitMergeAdmissionDescriptor(admission = null) {
  if (!admission || typeof admission !== 'object') return null;
  return admission.schroederPhaseVolumeSplitMergePublication
    || admission.admittedSchroederPhaseVolumeSplitMergePublication
    || admission.publication
    || admission.descriptor
    || admission;
}

export function schroederPhaseVolumeSplitMergeAdmissionAllowsApplication({
  phaseVolumeSplitMergeAdmission = null,
  phaseVolumeSplitMergeProposal = null,
  proposalRowCount = 0
} = {}) {
  const descriptor = schroederPhaseVolumeSplitMergeAdmissionDescriptor(phaseVolumeSplitMergeAdmission);
  const status = phaseVolumeSplitMergeAdmission?.status || descriptor?.status || null;
  const descriptorStatus = descriptor?.status
    || phaseVolumeSplitMergeAdmission?.publicationStatus
    || phaseVolumeSplitMergeAdmission?.admittedStatus
    || status;
  const outputFamilies = Array.isArray(phaseVolumeSplitMergeAdmission?.outputFamilies)
    ? phaseVolumeSplitMergeAdmission.outputFamilies
    : (Array.isArray(descriptor?.outputFamilies) ? descriptor.outputFamilies : []);
  const admittedRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      phaseVolumeSplitMergeAdmission?.schroederPhaseVolumeSplitMergeProposalRowCount
        ?? descriptor?.schroederPhaseVolumeSplitMergeProposalRowCount
        ?? phaseVolumeSplitMergeAdmission?.schroederPhaseVolumeSplitMergeRowCount
        ?? descriptor?.schroederPhaseVolumeSplitMergeRowCount
        ?? phaseVolumeSplitMergeAdmission?.proposalRowCount
        ?? descriptor?.proposalRowCount,
      proposalRowCount
    ))
  );
  const requiredRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      phaseVolumeSplitMergeProposal?.migrationRowCount,
      proposalRowCount
    ))
  );
  const admissionApproved = phaseVolumeSplitMergeAdmission?.phaseVolumeSplitMergeApproved === true;
  const descriptorAdmitted = SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_ADMITTED_STATUSES.has(descriptorStatus)
    || descriptor?.committed === true
    || phaseVolumeSplitMergeAdmission?.committed === true;
  const familyAccepted = outputFamilies.includes(SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_OUTPUT_FAMILY);
  const rowCountAccepted = admittedRowCount >= requiredRowCount || requiredRowCount === 0;
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_ADMISSION_SCHEMA,
    status: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted
      ? 'schroeder-phase-volume-split-merge-admission-approved'
      : 'schroeder-phase-volume-split-merge-admission-blocked',
    approved: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted,
    admissionApproved,
    descriptorAdmitted,
    descriptorStatus,
    familyAccepted,
    rowCountAccepted,
    proposalRowCount: admittedRowCount,
    requiredProposalRowCount: requiredRowCount,
    sourceHotBufferKey: phaseVolumeSplitMergeAdmission?.sourceHotBufferKey
      || phaseVolumeSplitMergeAdmission?.hotBufferKey
      || descriptor?.sourceHotBufferKey
      || descriptor?.hotBufferKey
      || null,
    outputFamilies: [...outputFamilies]
  };
}

function schroederParticleStorageAllocatorAdmissionDescriptor(admission = null) {
  if (!admission || typeof admission !== 'object') return null;
  return admission.schroederParticleStorageAllocatorPublication
    || admission.admittedSchroederParticleStorageAllocatorPublication
    || admission.publication
    || admission.descriptor
    || admission;
}

export function schroederParticleStorageAllocatorAdmissionAllowsApplication({
  particleStorageAllocatorAdmission = null,
  phaseVolumeSplitMergeApply = null,
  applyRowCount = 0,
  requiredParticleCapacity = 0
} = {}) {
  const descriptor = schroederParticleStorageAllocatorAdmissionDescriptor(particleStorageAllocatorAdmission);
  const status = particleStorageAllocatorAdmission?.status || descriptor?.status || null;
  const descriptorStatus = descriptor?.status
    || particleStorageAllocatorAdmission?.publicationStatus
    || particleStorageAllocatorAdmission?.admittedStatus
    || status;
  const outputFamilies = Array.isArray(particleStorageAllocatorAdmission?.outputFamilies)
    ? particleStorageAllocatorAdmission.outputFamilies
    : (Array.isArray(descriptor?.outputFamilies) ? descriptor.outputFamilies : []);
  const targetStateFamilies = Array.isArray(particleStorageAllocatorAdmission?.targetStateFamilies)
    ? particleStorageAllocatorAdmission.targetStateFamilies
    : (Array.isArray(descriptor?.targetStateFamilies) ? descriptor.targetStateFamilies : []);
  const admittedRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      particleStorageAllocatorAdmission?.schroederParticleStorageAllocationRowCount
        ?? descriptor?.schroederParticleStorageAllocationRowCount
        ?? particleStorageAllocatorAdmission?.applyRowCount
        ?? descriptor?.applyRowCount,
      applyRowCount
    ))
  );
  const requiredRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      phaseVolumeSplitMergeApply?.proposalRowCount,
      applyRowCount
    ))
  );
  const admittedCapacity = Math.max(0, Math.round(finiteNumber(
    particleStorageAllocatorAdmission?.currentParticleCapacity
      ?? descriptor?.currentParticleCapacity
      ?? particleStorageAllocatorAdmission?.particleCapacity
      ?? descriptor?.particleCapacity,
    requiredParticleCapacity
  )));
  const requiredCapacity = Math.max(0, Math.round(finiteNumber(
    particleStorageAllocatorAdmission?.requiredParticleCapacity
      ?? descriptor?.requiredParticleCapacity,
    requiredParticleCapacity
  )));
  const admissionApproved = particleStorageAllocatorAdmission?.particleStorageAllocationApproved === true;
  const descriptorAdmitted = SCHROEDER_PARTICLE_STORAGE_ALLOCATOR_ADMITTED_STATUSES.has(descriptorStatus)
    || descriptor?.committed === true
    || particleStorageAllocatorAdmission?.committed === true;
  const familyAccepted = outputFamilies.includes(SCHROEDER_PARTICLE_STORAGE_ALLOCATION_OUTPUT_FAMILY);
  const rowCountAccepted = admittedRowCount >= requiredRowCount || requiredRowCount === 0;
  const capacityApproved = particleStorageAllocatorAdmission?.particleCapacityApproved === true
    || descriptor?.particleCapacityApproved === true;
  const capacityAccepted = capacityApproved && admittedCapacity >= requiredCapacity;
  const targetFamiliesAccepted = SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES.every((family) => (
    targetStateFamilies.includes(family)
  ));
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATOR_ADMISSION_SCHEMA,
    status:
      admissionApproved
      && descriptorAdmitted
      && familyAccepted
      && rowCountAccepted
      && capacityAccepted
      && targetFamiliesAccepted
        ? 'schroeder-particle-storage-allocator-admission-approved'
        : 'schroeder-particle-storage-allocator-admission-blocked',
    approved:
      admissionApproved
      && descriptorAdmitted
      && familyAccepted
      && rowCountAccepted
      && capacityAccepted
      && targetFamiliesAccepted,
    admissionApproved,
    descriptorAdmitted,
    descriptorStatus,
    familyAccepted,
    rowCountAccepted,
    capacityApproved,
    capacityAccepted,
    targetFamiliesAccepted,
    allocationRowCount: admittedRowCount,
    requiredAllocationRowCount: requiredRowCount,
    currentParticleCapacity: admittedCapacity,
    requiredParticleCapacity: requiredCapacity,
    targetStateFamilies: [...targetStateFamilies],
    sourceHotBufferKey: particleStorageAllocatorAdmission?.sourceHotBufferKey
      || particleStorageAllocatorAdmission?.hotBufferKey
      || descriptor?.sourceHotBufferKey
      || descriptor?.hotBufferKey
      || null,
    outputFamilies: [...outputFamilies]
  };
}

function schroederParticleStorageSlotAssignmentAdmissionDescriptor(admission = null) {
  if (!admission || typeof admission !== 'object') return null;
  return admission.schroederParticleStorageSlotAssignmentPublication
    || admission.admittedSchroederParticleStorageSlotAssignmentPublication
    || admission.publication
    || admission.descriptor
    || admission;
}

export function schroederParticleStorageSlotAssignmentAdmissionAllowsApplication({
  particleStorageSlotAssignmentAdmission = null,
  particleStorageAllocation = null,
  particleStorageFreeList = null,
  allocationRowCount = 0
} = {}) {
  const descriptor = schroederParticleStorageSlotAssignmentAdmissionDescriptor(
    particleStorageSlotAssignmentAdmission
  );
  const status = particleStorageSlotAssignmentAdmission?.status || descriptor?.status || null;
  const descriptorStatus = descriptor?.status
    || particleStorageSlotAssignmentAdmission?.publicationStatus
    || particleStorageSlotAssignmentAdmission?.admittedStatus
    || status;
  const outputFamilies = Array.isArray(particleStorageSlotAssignmentAdmission?.outputFamilies)
    ? particleStorageSlotAssignmentAdmission.outputFamilies
    : (Array.isArray(descriptor?.outputFamilies) ? descriptor.outputFamilies : []);
  const targetStateFamilies = Array.isArray(particleStorageSlotAssignmentAdmission?.targetStateFamilies)
    ? particleStorageSlotAssignmentAdmission.targetStateFamilies
    : (Array.isArray(descriptor?.targetStateFamilies) ? descriptor.targetStateFamilies : []);
  const admittedRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      particleStorageSlotAssignmentAdmission?.schroederParticleStorageSlotAssignmentRowCount
        ?? descriptor?.schroederParticleStorageSlotAssignmentRowCount
        ?? particleStorageSlotAssignmentAdmission?.allocationRowCount
        ?? descriptor?.allocationRowCount,
      allocationRowCount
    ))
  );
  const requiredRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      particleStorageAllocation?.applyRowCount,
      allocationRowCount
    ))
  );
  const admissionApproved = particleStorageSlotAssignmentAdmission?.particleStorageSlotAssignmentApproved === true;
  const descriptorAdmitted = SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ADMITTED_STATUSES.has(descriptorStatus)
    || descriptor?.committed === true
    || particleStorageSlotAssignmentAdmission?.committed === true;
  const familyAccepted = outputFamilies.includes(SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_OUTPUT_FAMILY);
  const rowCountAccepted = admittedRowCount >= requiredRowCount || requiredRowCount === 0;
  const targetFamiliesAccepted = SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES.every((family) => (
    targetStateFamilies.includes(family)
  ));
  const freeListAccepted = particleStorageSlotAssignmentAdmission?.freeListDescriptorApproved === true
    || descriptor?.freeListDescriptorApproved === true
    || particleStorageFreeList?.committed === true
    || particleStorageFreeList?.status === 'schroeder-particle-storage-free-list-ready';
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ADMISSION_SCHEMA,
    status:
      admissionApproved
      && descriptorAdmitted
      && familyAccepted
      && rowCountAccepted
      && targetFamiliesAccepted
      && freeListAccepted
        ? 'schroeder-particle-storage-slot-assignment-admission-approved'
        : 'schroeder-particle-storage-slot-assignment-admission-blocked',
    approved:
      admissionApproved
      && descriptorAdmitted
      && familyAccepted
      && rowCountAccepted
      && targetFamiliesAccepted
      && freeListAccepted,
    admissionApproved,
    descriptorAdmitted,
    descriptorStatus,
    familyAccepted,
    rowCountAccepted,
    targetFamiliesAccepted,
    freeListAccepted,
    slotAssignmentRowCount: admittedRowCount,
    requiredSlotAssignmentRowCount: requiredRowCount,
    targetStateFamilies: [...targetStateFamilies],
    sourceHotBufferKey: particleStorageSlotAssignmentAdmission?.sourceHotBufferKey
      || particleStorageSlotAssignmentAdmission?.hotBufferKey
      || descriptor?.sourceHotBufferKey
      || descriptor?.hotBufferKey
      || null,
    outputFamilies: [...outputFamilies]
  };
}

function schroederParticleStorageMaterializationAdmissionDescriptor(admission = null) {
  if (!admission || typeof admission !== 'object') return null;
  return admission.schroederParticleStorageMaterializationPublication
    || admission.admittedSchroederParticleStorageMaterializationPublication
    || admission.publication
    || admission.descriptor
    || admission;
}

export function schroederParticleStorageMaterializationAdmissionAllowsApplication({
  particleStorageMaterializationAdmission = null,
  particleStorageSlotAssignment = null,
  assignmentRowCount = 0
} = {}) {
  const descriptor = schroederParticleStorageMaterializationAdmissionDescriptor(
    particleStorageMaterializationAdmission
  );
  const status = particleStorageMaterializationAdmission?.status || descriptor?.status || null;
  const descriptorStatus = descriptor?.status
    || particleStorageMaterializationAdmission?.publicationStatus
    || particleStorageMaterializationAdmission?.admittedStatus
    || status;
  const outputFamilies = Array.isArray(particleStorageMaterializationAdmission?.outputFamilies)
    ? particleStorageMaterializationAdmission.outputFamilies
    : (Array.isArray(descriptor?.outputFamilies) ? descriptor.outputFamilies : []);
  const targetStateFamilies = Array.isArray(particleStorageMaterializationAdmission?.targetStateFamilies)
    ? particleStorageMaterializationAdmission.targetStateFamilies
    : (Array.isArray(descriptor?.targetStateFamilies) ? descriptor.targetStateFamilies : []);
  const admittedRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      particleStorageMaterializationAdmission?.schroederParticleStorageMaterializationRowCount
        ?? descriptor?.schroederParticleStorageMaterializationRowCount
        ?? particleStorageMaterializationAdmission?.assignmentRowCount
        ?? descriptor?.assignmentRowCount,
      assignmentRowCount
    ))
  );
  const requiredRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      particleStorageSlotAssignment?.allocationRowCount,
      assignmentRowCount
    ))
  );
  const materializationApproved =
    particleStorageMaterializationAdmission?.particleStorageMaterializationApproved === true;
  const particleIdentityMutationApproved =
    particleStorageMaterializationAdmission?.particleIdentityMutationApproved === true
    || descriptor?.particleIdentityMutationApproved === true;
  const descriptorAdmitted = SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMITTED_STATUSES.has(descriptorStatus)
    || descriptor?.committed === true
    || particleStorageMaterializationAdmission?.committed === true;
  const familyAccepted = outputFamilies.includes(SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_OUTPUT_FAMILY);
  const rowCountAccepted = admittedRowCount >= requiredRowCount || requiredRowCount === 0;
  const targetFamiliesAccepted = SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES.every((family) => (
    targetStateFamilies.includes(family)
  ));
  const slotAssignmentAccepted =
    particleStorageMaterializationAdmission?.slotAssignmentDescriptorApproved === true
    || descriptor?.slotAssignmentDescriptorApproved === true
    || particleStorageSlotAssignment?.status === 'schroeder-particle-storage-slot-assignment-submitted'
    || particleStorageSlotAssignment?.committed === true;
  const approved =
    materializationApproved
    && descriptorAdmitted
    && familyAccepted
    && rowCountAccepted
    && targetFamiliesAccepted
    && particleIdentityMutationApproved
    && slotAssignmentAccepted;
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMISSION_SCHEMA,
    status: approved
      ? 'schroeder-particle-storage-materialization-admission-approved'
      : 'schroeder-particle-storage-materialization-admission-blocked',
    approved,
    materializationApproved,
    particleIdentityMutationApproved,
    descriptorAdmitted,
    descriptorStatus,
    familyAccepted,
    rowCountAccepted,
    targetFamiliesAccepted,
    slotAssignmentAccepted,
    materializationRowCount: admittedRowCount,
    requiredMaterializationRowCount: requiredRowCount,
    targetStateFamilies: [...targetStateFamilies],
    sourceHotBufferKey: particleStorageMaterializationAdmission?.sourceHotBufferKey
      || particleStorageMaterializationAdmission?.hotBufferKey
      || descriptor?.sourceHotBufferKey
      || descriptor?.hotBufferKey
      || null,
    outputFamilies: [...outputFamilies]
  };
}

function schroederFarAggregateForceApplicationAdmissionDescriptor(admission = null) {
  if (!admission || typeof admission !== 'object') return null;
  return admission.schroederFarAggregateForceApplicationPublication
    || admission.admittedSchroederFarAggregateForceApplicationPublication
    || admission.publication
    || admission.descriptor
    || admission;
}

function schroederFarAggregateLawConsumerAdmissionDescriptor(admission = null) {
  if (!admission || typeof admission !== 'object') return null;
  return admission.schroederFarAggregateLawConsumerPublication
    || admission.admittedSchroederFarAggregateLawConsumerPublication
    || admission.publication
    || admission.descriptor
    || admission;
}

function schroederFarAggregateGasStateDeltaAdmissionDescriptor(admission = null) {
  if (!admission || typeof admission !== 'object') return null;
  return admission.schroederFarAggregateGasStateDeltaPublication
    || admission.admittedSchroederFarAggregateGasStateDeltaPublication
    || admission.publication
    || admission.descriptor
    || admission;
}

export function schroederFarAggregateLawConsumerAdmissionAllowsConsumption({
  farAggregateLawConsumerAdmission = null,
  farAggregateForceSummary = null,
  farAggregateDiagnosticSummary = null,
  lawConsumerRowCount = 0,
  enabledConsumerLawMask = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK
} = {}) {
  const descriptor = schroederFarAggregateLawConsumerAdmissionDescriptor(
    farAggregateLawConsumerAdmission
  );
  const status = farAggregateLawConsumerAdmission?.status || descriptor?.status || null;
  const descriptorStatus = descriptor?.status
    || farAggregateLawConsumerAdmission?.publicationStatus
    || farAggregateLawConsumerAdmission?.admittedStatus
    || status;
  const outputFamilies = Array.isArray(farAggregateLawConsumerAdmission?.outputFamilies)
    ? farAggregateLawConsumerAdmission.outputFamilies
    : (Array.isArray(descriptor?.outputFamilies) ? descriptor.outputFamilies : []);
  const admittedRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      farAggregateLawConsumerAdmission?.schroederFarAggregateLawConsumerRowCount
        ?? descriptor?.schroederFarAggregateLawConsumerRowCount
        ?? farAggregateLawConsumerAdmission?.lawConsumerRowCount
        ?? descriptor?.lawConsumerRowCount
        ?? farAggregateLawConsumerAdmission?.forceSummaryRowCount
        ?? descriptor?.forceSummaryRowCount,
      lawConsumerRowCount
    ))
  );
  const requiredRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      farAggregateForceSummary?.forceSummaryRowCount ?? farAggregateForceSummary?.activeNodeCount,
      lawConsumerRowCount
    ))
  );
  const admissionApproved = farAggregateLawConsumerAdmission?.farAggregateLawConsumerApproved === true;
  const descriptorAdmitted = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_ADMITTED_STATUSES.has(descriptorStatus)
    || descriptor?.committed === true
    || farAggregateLawConsumerAdmission?.committed === true;
  const familyAccepted = outputFamilies.includes(SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_OUTPUT_FAMILY);
  const rowCountAccepted = admittedRowCount >= requiredRowCount || requiredRowCount === 0;
  const diagnosticsAccepted = farAggregateLawConsumerAdmission?.farAggregateDiagnosticsAccepted !== false
    && farAggregateDiagnosticSummary?.stateMutationRequired !== true
    && farAggregateDiagnosticSummary?.fullParticleReadbackRequired !== true;
  const resolvedConsumerMask = Math.max(0, Math.round(finiteNumber(
    farAggregateLawConsumerAdmission?.enabledConsumerLawMask
      ?? descriptor?.enabledConsumerLawMask
      ?? enabledConsumerLawMask,
    enabledConsumerLawMask
  ))) & SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK;
  const consumerMaskAccepted = resolvedConsumerMask !== 0;
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_ADMISSION_SCHEMA,
    status: admissionApproved
      && descriptorAdmitted
      && familyAccepted
      && rowCountAccepted
      && diagnosticsAccepted
      && consumerMaskAccepted
      ? 'schroeder-far-aggregate-law-consumer-admission-approved'
      : 'schroeder-far-aggregate-law-consumer-admission-blocked',
    approved: admissionApproved
      && descriptorAdmitted
      && familyAccepted
      && rowCountAccepted
      && diagnosticsAccepted
      && consumerMaskAccepted,
    admissionApproved,
    descriptorAdmitted,
    descriptorStatus,
    familyAccepted,
    rowCountAccepted,
    diagnosticsAccepted,
    consumerMaskAccepted,
    enabledConsumerLawMask: resolvedConsumerMask,
    lawConsumerRowCount: admittedRowCount,
    requiredLawConsumerRowCount: requiredRowCount,
    sourceHotBufferKey: farAggregateLawConsumerAdmission?.sourceHotBufferKey
      || farAggregateLawConsumerAdmission?.hotBufferKey
      || descriptor?.sourceHotBufferKey
      || descriptor?.hotBufferKey
      || null,
    outputFamilies: [...outputFamilies]
  };
}

export function schroederFarAggregateGasStateDeltaAdmissionAllowsApplication({
  farAggregateGasStateDeltaAdmission = null,
  farAggregateLawConsumer = null,
  farAggregateLawConsumerAuthorityPolicy = null,
  stateDeltaRowCount = 0,
  targetStateFamily = SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_TARGET_FAMILY
} = {}) {
  const descriptor = schroederFarAggregateGasStateDeltaAdmissionDescriptor(
    farAggregateGasStateDeltaAdmission
  );
  const status = farAggregateGasStateDeltaAdmission?.status || descriptor?.status || null;
  const descriptorStatus = descriptor?.status
    || farAggregateGasStateDeltaAdmission?.publicationStatus
    || farAggregateGasStateDeltaAdmission?.admittedStatus
    || status;
  const outputFamilies = Array.isArray(farAggregateGasStateDeltaAdmission?.outputFamilies)
    ? farAggregateGasStateDeltaAdmission.outputFamilies
    : (Array.isArray(descriptor?.outputFamilies) ? descriptor.outputFamilies : []);
  const admittedRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      farAggregateGasStateDeltaAdmission?.schroederFarAggregateGasStateDeltaRowCount
        ?? descriptor?.schroederFarAggregateGasStateDeltaRowCount
        ?? farAggregateGasStateDeltaAdmission?.gasStateDeltaRowCount
        ?? descriptor?.gasStateDeltaRowCount
        ?? farAggregateGasStateDeltaAdmission?.stateDeltaRowCount
        ?? descriptor?.stateDeltaRowCount,
      stateDeltaRowCount
    ))
  );
  const requiredRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      farAggregateLawConsumer?.lawConsumerRowCount ?? farAggregateLawConsumer?.forceSummaryRowCount,
      stateDeltaRowCount
    ))
  );
  const admissionApproved =
    farAggregateGasStateDeltaAdmission?.farAggregateGasStateDeltaApproved === true
    || farAggregateGasStateDeltaAdmission?.gasStateDeltaApproved === true;
  const descriptorAdmitted = SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ADMITTED_STATUSES.has(
    descriptorStatus
  ) || descriptor?.committed === true || farAggregateGasStateDeltaAdmission?.committed === true;
  const outputFamilyAccepted =
    outputFamilies.includes(SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_OUTPUT_FAMILY);
  const rowCountAccepted = admittedRowCount >= requiredRowCount || requiredRowCount === 0;
  const suppliedTargetStateFamily =
    farAggregateGasStateDeltaAdmission?.targetStateFamily
    ?? descriptor?.targetStateFamily
    ?? farAggregateGasStateDeltaAdmission?.farAggregateGasStateDeltaTargetFamily
    ?? descriptor?.farAggregateGasStateDeltaTargetFamily
    ?? null;
  const resolvedTargetStateFamily = suppliedTargetStateFamily || targetStateFamily;
  const targetStateFamilyAccepted =
    !suppliedTargetStateFamily || suppliedTargetStateFamily === targetStateFamily;
  const policyAccepted =
    farAggregateLawConsumerAuthorityPolicy?.stateDeltaAdmissionRequired === true
    && farAggregateLawConsumerAuthorityPolicy?.fullParticleReadbackRequired !== true;
  const approved = admissionApproved
    && descriptorAdmitted
    && outputFamilyAccepted
    && rowCountAccepted
    && targetStateFamilyAccepted
    && policyAccepted;
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ADMISSION_SCHEMA,
    status: approved
      ? 'schroeder-far-aggregate-gas-state-delta-admission-approved'
      : 'schroeder-far-aggregate-gas-state-delta-admission-blocked',
    approved,
    admissionApproved,
    descriptorAdmitted,
    descriptorStatus,
    outputFamilyAccepted,
    familyAccepted: outputFamilyAccepted,
    rowCountAccepted,
    targetStateFamilyAccepted,
    policyAccepted,
    stateDeltaRowCount: admittedRowCount,
    gasStateDeltaRowCount: admittedRowCount,
    requiredStateDeltaRowCount: requiredRowCount,
    targetStateFamily: resolvedTargetStateFamily,
    sourceHotBufferKey: farAggregateGasStateDeltaAdmission?.sourceHotBufferKey
      || farAggregateGasStateDeltaAdmission?.hotBufferKey
      || descriptor?.sourceHotBufferKey
      || descriptor?.hotBufferKey
      || null,
    outputFamilies: [...outputFamilies]
  };
}

export function schroederFarAggregateForceApplicationAdmissionAllowsApplication({
  farAggregateForceApplicationAdmission = null,
  farAggregateForceSummary = null,
  farAggregateDiagnosticSummary = null,
  forceApplicationRowCount = 0
} = {}) {
  const descriptor = schroederFarAggregateForceApplicationAdmissionDescriptor(
    farAggregateForceApplicationAdmission
  );
  const status = farAggregateForceApplicationAdmission?.status || descriptor?.status || null;
  const descriptorStatus = descriptor?.status
    || farAggregateForceApplicationAdmission?.publicationStatus
    || farAggregateForceApplicationAdmission?.admittedStatus
    || status;
  const outputFamilies = Array.isArray(farAggregateForceApplicationAdmission?.outputFamilies)
    ? farAggregateForceApplicationAdmission.outputFamilies
    : (Array.isArray(descriptor?.outputFamilies) ? descriptor.outputFamilies : []);
  const admittedRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      farAggregateForceApplicationAdmission?.schroederFarAggregateForceApplicationRowCount
        ?? descriptor?.schroederFarAggregateForceApplicationRowCount
        ?? farAggregateForceApplicationAdmission?.forceApplicationRowCount
        ?? descriptor?.forceApplicationRowCount
        ?? farAggregateForceApplicationAdmission?.forceSummaryRowCount
        ?? descriptor?.forceSummaryRowCount,
      forceApplicationRowCount
    ))
  );
  const requiredRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      farAggregateForceSummary?.forceSummaryRowCount ?? farAggregateForceSummary?.activeNodeCount,
      forceApplicationRowCount
    ))
  );
  const admissionApproved = farAggregateForceApplicationAdmission?.farAggregateForceApplicationApproved === true;
  const descriptorAdmitted = SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ADMITTED_STATUSES.has(descriptorStatus)
    || descriptor?.committed === true
    || farAggregateForceApplicationAdmission?.committed === true;
  const familyAccepted = outputFamilies.includes(SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_OUTPUT_FAMILY);
  const rowCountAccepted = admittedRowCount >= requiredRowCount || requiredRowCount === 0;
  const diagnosticsAccepted = farAggregateForceApplicationAdmission?.farAggregateDiagnosticsAccepted !== false
    && farAggregateDiagnosticSummary?.stateMutationRequired !== true;
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ADMISSION_SCHEMA,
    status: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted && diagnosticsAccepted
      ? 'schroeder-far-aggregate-force-application-admission-approved'
      : 'schroeder-far-aggregate-force-application-admission-blocked',
    approved: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted && diagnosticsAccepted,
    admissionApproved,
    descriptorAdmitted,
    descriptorStatus,
    familyAccepted,
    rowCountAccepted,
    diagnosticsAccepted,
    forceApplicationRowCount: admittedRowCount,
    requiredForceApplicationRowCount: requiredRowCount,
    sourceHotBufferKey: farAggregateForceApplicationAdmission?.sourceHotBufferKey
      || farAggregateForceApplicationAdmission?.hotBufferKey
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

function assertFarAggregateHierarchyNodeInput(hierarchyAggregateNode) {
  if (
    hierarchyAggregateNode?.schema !== ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA
    && hierarchyAggregateNode?.schema !== ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA
  ) {
    throw new TypeError('Schroeder far-aggregate candidates require a Schroeder hierarchy aggregate-node input');
  }
  const aggregateNodeCount = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregateNode.aggregateNodeCount ?? hierarchyAggregateNode.aggregateRowCount,
    0
  )));
  if (aggregateNodeCount <= 0) {
    throw new RangeError('Schroeder far-aggregate candidates require at least one aggregate-node row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregateNode.aggregateNodeStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
  )));
  if (stride !== SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS) {
    throw new RangeError('Schroeder far-aggregate candidates require the current aggregate-node row layout');
  }
}

function assertFarAggregateCandidateInput(farAggregateCandidates) {
  if (
    farAggregateCandidates?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_EXECUTION_SCHEMA
    && farAggregateCandidates?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_SCHEMA
  ) {
    throw new TypeError('Schroeder portable summary requires a Schroeder far-aggregate candidate input');
  }
  const candidateCount = Math.max(0, Math.round(finiteNumber(
    farAggregateCandidates.farAggregateCandidateCount ?? farAggregateCandidates.candidateCount,
    0
  )));
  if (candidateCount <= 0) {
    throw new RangeError('Schroeder far-aggregate candidate input requires at least one candidate row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    farAggregateCandidates.farAggregateCandidateStrideFloats,
    SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS
  )));
  if (stride !== SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS) {
    throw new RangeError('Schroeder far-aggregate candidate input requires the current row layout');
  }
}

function assertFarAggregateForceSummaryInput(farAggregateForceSummary) {
  if (
    farAggregateForceSummary?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA
    && farAggregateForceSummary?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_SCHEMA
  ) {
    throw new TypeError('Schroeder portable summary requires a Schroeder far-aggregate force summary input');
  }
  const summaryRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateForceSummary.forceSummaryRowCount ?? farAggregateForceSummary.activeNodeCount,
    0
  )));
  if (summaryRowCount <= 0) {
    throw new RangeError('Schroeder far-aggregate force summary input requires at least one summary row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    farAggregateForceSummary.forceSummaryStrideFloats,
    SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS
  )));
  if (stride !== SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS) {
    throw new RangeError('Schroeder far-aggregate force summary input requires the current row layout');
  }
}

function assertFarAggregateDiagnosticSummaryInput(farAggregateDiagnosticSummary) {
  if (
    farAggregateDiagnosticSummary?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA
    && farAggregateDiagnosticSummary?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_SCHEMA
  ) {
    throw new TypeError('Schroeder portable summary requires a Schroeder far-aggregate diagnostic summary input');
  }
  const summaryRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateDiagnosticSummary.diagnosticSummaryRowCount
      ?? farAggregateDiagnosticSummary.summaryRowCount,
    0
  )));
  if (summaryRowCount <= 0) {
    throw new RangeError('Schroeder far-aggregate diagnostic summary input requires at least one summary row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    farAggregateDiagnosticSummary.diagnosticSummaryStrideFloats
      ?? farAggregateDiagnosticSummary.summaryStrideFloats,
    SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS
  )));
  if (stride !== SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS) {
    throw new RangeError('Schroeder far-aggregate diagnostic summary input requires the current row layout');
  }
}

function assertFarAggregateLawConsumerInput(farAggregateLawConsumer) {
  if (
    farAggregateLawConsumer?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA
    && farAggregateLawConsumer?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_SCHEMA
  ) {
    throw new TypeError('Schroeder portable summary requires a Schroeder far-aggregate law consumer input');
  }
  const consumerRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateLawConsumer.lawConsumerRowCount ?? farAggregateLawConsumer.forceSummaryRowCount,
    0
  )));
  if (consumerRowCount <= 0) {
    throw new RangeError('Schroeder far-aggregate law consumer input requires at least one consumer row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    farAggregateLawConsumer.lawConsumerStrideFloats,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS
  )));
  if (stride !== SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS) {
    throw new RangeError('Schroeder far-aggregate law consumer input requires the current row layout');
  }
}

function assertFarAggregateLawConsumerDiagnosticSummaryInput(farAggregateLawConsumerDiagnosticSummary) {
  if (
    farAggregateLawConsumerDiagnosticSummary?.schema
      !== ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA
    && farAggregateLawConsumerDiagnosticSummary?.schema
      !== ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_SCHEMA
  ) {
    throw new TypeError('Schroeder portable summary requires a Schroeder far-aggregate law consumer diagnostic summary input');
  }
  const summaryRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateLawConsumerDiagnosticSummary.lawConsumerDiagnosticSummaryRowCount
      ?? farAggregateLawConsumerDiagnosticSummary.diagnosticSummaryRowCount
      ?? farAggregateLawConsumerDiagnosticSummary.summaryRowCount,
    0
  )));
  if (summaryRowCount <= 0) {
    throw new RangeError('Schroeder far-aggregate law consumer diagnostic summary input requires at least one summary row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    farAggregateLawConsumerDiagnosticSummary.lawConsumerDiagnosticSummaryStrideFloats
      ?? farAggregateLawConsumerDiagnosticSummary.diagnosticSummaryStrideFloats
      ?? farAggregateLawConsumerDiagnosticSummary.summaryStrideFloats,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS
  )));
  if (stride !== SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS) {
    throw new RangeError('Schroeder far-aggregate law consumer diagnostic summary input requires the current row layout');
  }
}

function assertFarAggregateGasStateDeltaInput(farAggregateGasStateDelta) {
  if (
    farAggregateGasStateDelta?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA
    && farAggregateGasStateDelta?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_SCHEMA
  ) {
    throw new TypeError('Schroeder portable summary requires a Schroeder far-aggregate gas state-delta input');
  }
  const stateDeltaRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateGasStateDelta.gasStateDeltaRowCount
      ?? farAggregateGasStateDelta.stateDeltaRowCount
      ?? farAggregateGasStateDelta.lawConsumerRowCount,
    0
  )));
  if (stateDeltaRowCount <= 0) {
    throw new RangeError('Schroeder far-aggregate gas state-delta input requires at least one delta row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    farAggregateGasStateDelta.gasStateDeltaStrideFloats
      ?? farAggregateGasStateDelta.stateDeltaStrideFloats,
    SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS
  )));
  if (stride !== SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS) {
    throw new RangeError('Schroeder far-aggregate gas state-delta input requires the current row layout');
  }
}

function assertFarAggregateGasCellImportInput({
  farAggregateGasStateDelta,
  farAggregateForceSummary
} = {}) {
  assertFarAggregateGasStateDeltaInput(farAggregateGasStateDelta);
  assertFarAggregateForceSummaryInput(farAggregateForceSummary);
  if (farAggregateGasStateDelta.farAggregateGasStateDeltaAdmissionApproved !== true) {
    throw new RangeError('Schroeder far-aggregate gas-cell import requires an admitted gas state-delta');
  }
  if (farAggregateGasStateDelta.pressureInterfaceImportRequired !== true) {
    throw new RangeError('Schroeder far-aggregate gas-cell import requires pressure-interface import intent');
  }
  if (farAggregateGasStateDelta.fullParticleReadbackRequired === true) {
    throw new RangeError('Schroeder far-aggregate gas-cell import cannot require full particle readback');
  }
}

function schroederLawConsumerDiagnosticSummaryRows(farAggregateLawConsumerDiagnosticSummary = null) {
  const rows = farAggregateLawConsumerDiagnosticSummary?.lawConsumerDiagnosticSummaryRows
    ?? farAggregateLawConsumerDiagnosticSummary?.diagnosticSummaryRows
    ?? farAggregateLawConsumerDiagnosticSummary?.summaryRows
    ?? null;
  if (rows instanceof Float32Array || Array.isArray(rows)) return rows;
  return null;
}

function schroederLawConsumerDiagnosticSummaryValue(
  farAggregateLawConsumerDiagnosticSummary,
  index,
  fallback = 0
) {
  const rows = schroederLawConsumerDiagnosticSummaryRows(farAggregateLawConsumerDiagnosticSummary);
  if (!rows || index < 0 || index >= rows.length) return fallback;
  return finiteNumber(rows[index], fallback);
}

function assertFarAggregateForceApplicationInput(farAggregateForceApplication) {
  if (
    farAggregateForceApplication?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA
    && farAggregateForceApplication?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_SCHEMA
  ) {
    throw new TypeError('Schroeder portable summary requires a Schroeder far-aggregate force application input');
  }
  const rowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateForceApplication.forceApplicationRowCount,
    0
  )));
  if (rowCount <= 0) {
    throw new RangeError('Schroeder far-aggregate force application input requires at least one application row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    farAggregateForceApplication.forceApplicationStrideFloats,
    SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS
  )));
  if (stride !== SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS) {
    throw new RangeError('Schroeder far-aggregate force application input requires the current row layout');
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

function assertPhaseVolumeSplitMergeProposalInput(phaseVolumeSplitMergeProposal) {
  if (
    phaseVolumeSplitMergeProposal?.schema !== ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_EXECUTION_SCHEMA
    && phaseVolumeSplitMergeProposal?.schema !== ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_SCHEMA
  ) {
    throw new TypeError(
      'Schroeder phase-volume split/merge apply requires a Schroeder split/merge proposal input'
    );
  }
  const proposalRowCount = Math.max(0, Math.round(finiteNumber(
    phaseVolumeSplitMergeProposal.migrationRowCount,
    0
  )));
  if (proposalRowCount <= 0) {
    throw new RangeError('Schroeder phase-volume split/merge apply requires at least one proposal row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    phaseVolumeSplitMergeProposal.proposalStrideFloats,
    SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS
  )));
  if (stride !== SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS) {
    throw new RangeError('Schroeder phase-volume split/merge apply requires the current proposal row layout');
  }
}

function assertPhaseVolumeSplitMergeApplyInput(phaseVolumeSplitMergeApply) {
  if (
    phaseVolumeSplitMergeApply?.schema !== ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA
    && phaseVolumeSplitMergeApply?.schema !== ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_SCHEMA
  ) {
    throw new TypeError(
      'Schroeder particle storage allocation requires a Schroeder split/merge apply input'
    );
  }
  const applyRowCount = Math.max(0, Math.round(finiteNumber(
    phaseVolumeSplitMergeApply.proposalRowCount,
    0
  )));
  if (applyRowCount <= 0) {
    throw new RangeError('Schroeder particle storage allocation requires at least one apply row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    phaseVolumeSplitMergeApply.applyStrideFloats,
    SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS
  )));
  if (stride !== SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS) {
    throw new RangeError('Schroeder particle storage allocation requires the current split/merge apply row layout');
  }
}

function assertParticleStorageAllocationInput(particleStorageAllocation) {
  if (
    particleStorageAllocation?.schema !== ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA
    && particleStorageAllocation?.schema !== ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_SCHEMA
  ) {
    throw new TypeError(
      'Schroeder particle storage slot assignment requires a Schroeder particle-storage allocation input'
    );
  }
  const allocationRowCount = Math.max(0, Math.round(finiteNumber(
    particleStorageAllocation.applyRowCount,
    0
  )));
  if (allocationRowCount <= 0) {
    throw new RangeError('Schroeder particle storage slot assignment requires at least one allocation row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    particleStorageAllocation.allocationStrideFloats,
    SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS
  )));
  if (stride !== SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS) {
    throw new RangeError('Schroeder particle storage slot assignment requires the current allocation row layout');
  }
}

function assertParticleStorageFreeListInput(particleStorageFreeList) {
  if (particleStorageFreeList?.schema !== ULG_SCHROEDER_PARTICLE_STORAGE_FREE_LIST_SCHEMA) {
    throw new TypeError('Schroeder particle storage slot assignment requires a Schroeder free-list descriptor');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    particleStorageFreeList.freeListStrideFloats,
    SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS
  )));
  if (stride !== SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS) {
    throw new RangeError('Schroeder particle storage free-list descriptor requires the current row layout');
  }
  const slotCapacity = Math.max(0, finiteNumber(particleStorageFreeList.slotCapacity, 0));
  if (slotCapacity <= 0) {
    throw new RangeError('Schroeder particle storage free-list descriptor requires positive slot capacity');
  }
}

function assertParticleStorageSlotAssignmentInput(particleStorageSlotAssignment) {
  if (
    particleStorageSlotAssignment?.schema !== ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA
    && particleStorageSlotAssignment?.schema !== ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_SCHEMA
  ) {
    throw new TypeError(
      'Schroeder particle storage materialization requires a Schroeder slot-assignment input'
    );
  }
  const assignmentRowCount = Math.max(0, Math.round(finiteNumber(
    particleStorageSlotAssignment.allocationRowCount,
    0
  )));
  if (assignmentRowCount <= 0) {
    throw new RangeError('Schroeder particle storage materialization requires at least one assignment row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    particleStorageSlotAssignment.slotAssignmentStrideFloats,
    SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS
  )));
  if (stride !== SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS) {
    throw new RangeError('Schroeder particle storage materialization requires the current slot-assignment row layout');
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
  phaseVolumeAssignmentOverlay = null,
  phaseVolumeAssignmentOverlayIndex = null,
  phaseVolumeLevelUpdate = null,
  selectedLevel = 0,
  tileCellCount = DEFAULT_TILE_CELL_COUNT,
  supportInflateCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minTileSpacingM = 0,
  maxTileSpacingM = 0
} = {}) {
  assertLevelAssignmentInput(levelAssignment);
  const resolvedPhaseVolumeAssignmentOverlay = normalizeSchroederPhaseVolumeAssignmentOverlay({
    phaseVolumeAssignmentOverlay,
    phaseVolumeLevelUpdate,
    levelAssignment,
    selectedLevel
  });
  const overlaySummary = summarizeSchroederPhaseVolumeAssignmentOverlay(resolvedPhaseVolumeAssignmentOverlay);
  const particleCount = Math.max(0, Math.round(finiteNumber(levelAssignment.particleCount, 0)));
  if (phaseVolumeAssignmentOverlayIndex) {
    assertPhaseVolumeAssignmentOverlayIndexInput(phaseVolumeAssignmentOverlayIndex, particleCount);
  }
  const overlayIndexEnabled = Boolean(phaseVolumeAssignmentOverlayIndex?.indexBuffer);
  const overlayIndexRequired = overlaySummary.phaseVolumeAssignmentOverlayEnabled
    && overlaySummary.sparseOverlayIndexRequired;
  const overlayConsumable = overlaySummary.phaseVolumeAssignmentOverlayEnabled
    && (overlaySummary.rowAlignedWithParticles || overlayIndexEnabled);
  const overlayConsumerStatus = overlayConsumable
    ? 'phase-volume-level-update-assignment-overlay-consumed-by-active-node-selection'
    : (overlayIndexRequired
        ? 'blocked-phase-volume-level-update-assignment-overlay-index-required'
        : overlaySummary.consumerStatus);
  const activeNodeByteLength = Math.max(
    4,
    particleCount * SCHROEDER_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  const spatialEpochMinLevel = Math.round(finiteNumber(
    levelAssignment.minLevel,
    selectedLevel
  ));
  const spatialEpochMaxLevel = Math.round(finiteNumber(
    levelAssignment.maxLevel,
    selectedLevel
  ));
  const spatialEpochBaseGridSpacingM = finitePositive(
    levelAssignment.baseGridSpacingM,
    DEFAULT_BASE_GRID_SPACING_M
  );
  const spatialEpochChartId = Math.round(finiteNumber(levelAssignment.chartId, 0));
  const spatialEpochStorageGeneration = explicitPositiveU32(
    levelAssignment.storageGeneration
  );
  const spatialDirectorySourceReady = spatialEpochStorageGeneration != null
    && spatialEpochMaxLevel >= spatialEpochMinLevel
    && spatialEpochChartId >= 0
    && spatialEpochChartId <= 0x00ff_ffff;
  const spatialEpochSourceReady = spatialDirectorySourceReady && !overlayConsumable;
  return {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
    status: 'schroeder-active-node-list-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_ACTIVE_NODE_SCOPE,
    sourceAssignmentSchema: levelAssignment.schema,
    sourceAssignmentStatus: levelAssignment.status ?? null,
    phaseVolumeAssignmentOverlaySchema: overlaySummary.schema,
    phaseVolumeAssignmentOverlayStatus: overlaySummary.status,
    phaseVolumeAssignmentOverlayConsumerStatus: overlayConsumerStatus,
    phaseVolumeAssignmentOverlayAvailable: overlaySummary.phaseVolumeAssignmentOverlayEnabled,
    phaseVolumeAssignmentOverlayEnabled: overlayConsumable,
    phaseVolumeAssignmentOverlayRowCount: overlaySummary.rowCount,
    phaseVolumeAssignmentOverlayStrideFloats: overlaySummary.strideFloats,
    phaseVolumeAssignmentOverlayRetainedBuffer: overlaySummary.retainedBuffer,
    phaseVolumeAssignmentOverlayRowAlignedWithParticles: overlaySummary.rowAlignedWithParticles,
    phaseVolumeAssignmentOverlayIndexRequired: overlayIndexRequired,
    phaseVolumeAssignmentOverlayIndexEnabled: overlayIndexEnabled,
    phaseVolumeAssignmentOverlayIndexSchema: phaseVolumeAssignmentOverlayIndex?.schema ?? null,
    phaseVolumeAssignmentOverlayIndexStatus: phaseVolumeAssignmentOverlayIndex?.status ?? null,
    phaseVolumeAssignmentOverlayIndexByteLength: phaseVolumeAssignmentOverlayIndex?.indexBufferByteLength
      ?? phaseVolumeAssignmentOverlayIndex?.indexByteLength
      ?? 0,
    phaseVolumeAssignmentOverlayIndexMode: overlaySummary.overlayIndexMode,
    phaseVolumeAssignmentOverlaySparseIndexStatus: overlaySummary.sparseOverlayIndexStatus,
    phaseVolumeAssignmentOverlayTransferMode: overlaySummary.transferMode,
    phaseVolumeAssignmentOverlayRetainedBufferRef: overlaySummary.retainedBufferRef,
    phaseVolumeAssignmentOverlayRawGpuBufferTransferAllowed: overlaySummary.rawGpuBufferTransferAllowed,
    phaseVolumeAssignmentOverlayFullParticleReadbackRequired: overlaySummary.fullParticleReadbackRequired,
    phaseVolumeLevelSelectionSource: overlayConsumable
      ? overlaySummary.selectedLevelSource
      : 'configured-selected-schroeder-level',
    phaseVolumeNativeLevelSource: overlayConsumable
      ? overlaySummary.nativeLevelSource
      : 'level-assignment-native-support-radius',
    sourcePhaseVolumeLevelUpdateSchema: overlaySummary.sourcePhaseVolumeLevelUpdateSchema ?? null,
    sourcePhaseVolumeLevelUpdateStatus: overlaySummary.sourcePhaseVolumeLevelUpdateStatus ?? null,
    particleCount,
    activeCandidateCount: particleCount,
    selectedLevel: Math.round(finiteNumber(selectedLevel, 0)),
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
    // Generic directory production accepts an admitted phase-volume overlay:
    // each row carries its own native spacing and the key pass validates it.
    // Exact-near law views remain stricter until they publish a spacing
    // sidecar for query-radius expansion.
    spatialDirectorySourceSchema:
      'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
    spatialDirectorySourceStatus: spatialDirectorySourceReady
      ? 'schroeder-spatial-directory-source-ready'
      : (spatialEpochStorageGeneration == null
          ? 'schroeder-spatial-directory-source-rejected-generation'
          : 'schroeder-spatial-directory-source-rejected-level-contract'),
    spatialDirectorySourceReady,
    // The canonical ss-spatial-epoch.v1 adapter consumes these rows without a
    // readback.  Keep the spacing and identity proof beside the retained
    // buffer so an exact-near consumer never has to infer it from a selected
    // render/mechanics LOD.  Phase-volume overlays can introduce arbitrary
    // per-row spacing, so v1 deliberately rejects them until the directory
    // carries an explicit spacing sidecar.
    spatialEpochSourceSchema: 'peercompute.ulg.schroeder-spatial-active-node-source.v1',
    spatialEpochSourceStatus: spatialEpochSourceReady
      ? 'schroeder-spatial-active-node-source-ready'
      : (overlayConsumable
          ? 'schroeder-spatial-active-node-source-rejected-phase-volume-overlay'
          : (spatialEpochStorageGeneration == null
              ? 'schroeder-spatial-active-node-source-rejected-generation'
              : 'schroeder-spatial-active-node-source-rejected-level-contract')),
    spatialEpochSourceReady,
    spatialEpochSourceAdapter: 'active-node-rows-one-row-per-particle',
    spatialEpochLevelSpacingMode: 'base-grid-spacing-times-pow2-level',
    spatialEpochPositionAuthority: 'same-epoch-pre-integration-particle-state',
    spatialEpochMinLevel,
    spatialEpochMaxLevel,
    spatialEpochBaseGridSpacingM,
    spatialEpochChartId,
    spatialEpochPhysicsTick: Math.max(0, Math.round(finiteNumber(
      levelAssignment.physicsTick ?? levelAssignment.positionEpoch,
      0
    ))),
    spatialEpochPhysicsSubstep: Math.max(0, Math.round(finiteNumber(
      levelAssignment.physicsSubstep,
      0
    ))),
    spatialEpochPositionEpoch: Math.max(0, Math.round(finiteNumber(
      levelAssignment.positionEpoch ?? levelAssignment.physicsTick,
      0
    ))),
    spatialEpochTopologyEpoch: Math.max(0, Math.round(finiteNumber(
      levelAssignment.topologyEpoch,
      0
    ))),
    spatialEpochChartEpoch: Math.max(0, Math.round(finiteNumber(
      levelAssignment.chartEpoch,
      0
    ))),
    spatialEpochLevelEpoch: Math.max(0, Math.round(finiteNumber(
      levelAssignment.levelEpoch,
      0
    ))),
    spatialEpochSupportEpoch: Math.max(0, Math.round(finiteNumber(
      levelAssignment.supportEpoch,
      0
    ))),
    spatialEpochStorageGeneration,
    spatialEpochBufferFamilyGenerationStatus:
      levelAssignment.bufferFamilyGenerationStatus ?? null,
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
  candidateArenaByteBudget = DEFAULT_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ARENA_BYTE_BUDGET,
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
  // Byte-bounded candidate arena.
  //
  // This used to be lawQueueCount * candidateBudget rows unconditionally: a
  // fixed worst-case reservation of 64 rows x 64 bytes = 4 KiB for every queue
  // row, which reaches roughly 4 GiB at a million particles before any useful
  // state exists. sol-critic's Priority 3 asks for a byte-bounded arena with
  // published overflow evidence instead of a reservation that scales with
  // particle count times a constant nobody measured.
  //
  // The budget is still honoured whenever it fits. When it does not, the arena
  // is capped and the shortfall is reported rather than silently truncated --
  // sol-critic is explicit that a bounded cap must say what it dropped, because
  // silent truncation reads as "covered everything" when it did not.
  const candidateRowByteLength =
    SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const requestedNeighborCandidateCount = lawQueueCount * resolvedCandidateBudget;
  const neighborCandidateArenaByteBudget = Math.max(
    candidateRowByteLength,
    Math.round(finiteNumber(
      candidateArenaByteBudget,
      DEFAULT_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ARENA_BYTE_BUDGET
    ))
  );
  const arenaRowCapacity = Math.max(
    1,
    Math.floor(neighborCandidateArenaByteBudget / candidateRowByteLength)
  );
  const neighborCandidateCount = Math.min(requestedNeighborCandidateCount, arenaRowCapacity);
  const neighborCandidateArenaBound =
    neighborCandidateCount < requestedNeighborCandidateCount;
  // Rows per queue entry actually available once the cap binds. The kernel must
  // use this, not resolvedCandidateBudget, or it will write past the arena.
  const admittedCandidateBudget = lawQueueCount > 0
    ? Math.max(1, Math.floor(neighborCandidateCount / lawQueueCount))
    : resolvedCandidateBudget;
  const neighborCandidateByteLength = Math.max(
    4,
    neighborCandidateCount * candidateRowByteLength
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
    // Overflow evidence for the byte-bounded arena. admittedCandidateBudget is
    // what a kernel may actually use per queue row; when it drops below
    // candidateBudget the cap has bound, and droppedCandidateCount says by how
    // many rows. Publishing this is the difference between a bounded arena and
    // a silent truncation, which sol-critic explicitly forbids.
    admittedCandidateBudget,
    candidateArenaByteBudget: neighborCandidateArenaByteBudget,
    candidateArenaBound: neighborCandidateArenaBound,
    requestedNeighborCandidateCount,
    droppedCandidateCount: Math.max(
      0,
      requestedNeighborCandidateCount - neighborCandidateCount
    ),
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
    pressureInterfaceSpatialIndexStatus: 'pressure-interface-source-span-spatial-index-planned',
    pressureInterfaceSpatialIndexMode: 'source-particle-candidate-span-table',
    pressureInterfaceSpatialIndexConsumerStatus:
      'available-for-pressure-interface-contact-kinematics-source-span-binding',
    pressureInterfaceSpatialIndexFallbackPolicy:
      'no-implicit-full-candidate-scan-without-source-span-descriptor',
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

export function createSchroederPhaseVolumeTargetAggregatePlan({
  levelAssignment,
  identityRequired = false,
  baseGridSpacingM = levelAssignment?.baseGridSpacingM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = levelAssignment?.minLevel ?? DEFAULT_MIN_LEVEL,
  maxLevel = levelAssignment?.maxLevel ?? DEFAULT_MAX_LEVEL,
  targetSupportCells = levelAssignment?.targetSupportCells ?? DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = levelAssignment?.supportRadiusScale ?? DEFAULT_SUPPORT_RADIUS_SCALE,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  gasPhaseId = DEFAULT_GAS_PHASE_ID,
  aggregateEpoch = 0,
  stateFamilyId = 1
} = {}) {
  assertLevelAssignmentInput(levelAssignment);
  const aggregateRowCount = Math.max(0, Math.round(finiteNumber(levelAssignment.particleCount, 0)));
  const aggregateByteLength = Math.max(
    4,
    aggregateRowCount * SCHROEDER_HIERARCHY_AGGREGATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA,
    status: 'schroeder-phase-volume-target-aggregate-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-phase-volume-target-aggregate-contributions',
    sourceAssignmentSchema: levelAssignment.schema,
    sourceAssignmentStatus: levelAssignment.status ?? null,
    aggregateSourceMode: 'phase-volume-target-level-assignment',
    identityRequired: identityRequired === true,
    aggregateIdentityKeyMode: identityRequired
      ? 'exact-render-domain-id'
      : 'legacy-zero-or-explicit-render-domain-id',
    aggregateRowCount,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    aggregateRowLayout: [...SCHROEDER_HIERARCHY_AGGREGATE_ROW_LAYOUT],
    aggregateStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
    aggregateStrideBytes: SCHROEDER_HIERARCHY_AGGREGATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    aggregateByteLength,
    minLevel: Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)),
    maxLevel: Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)),
    baseGridSpacingM: finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M),
    targetSupportCells: finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS),
    supportRadiusScale: Math.max(0, finiteNumber(supportRadiusScale, DEFAULT_SUPPORT_RADIUS_SCALE)),
    phaseVolumeExpandThreshold: Math.max(1, finiteNumber(
      phaseVolumeExpandThreshold,
      DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD
    )),
    gasPhaseId: finiteNumber(gasPhaseId, DEFAULT_GAS_PHASE_ID),
    aggregateEpoch: finiteNumber(aggregateEpoch, 0),
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    outputCompaction: 'one-phase-volume-target-aggregate-contribution-row-per-assignment-row',
    aggregateReductionStatus: 'pending-keyed-reduction',
    outputFamilies: [
      SCHROEDER_STATE_DELTA_OUTPUT_FAMILY,
      'schroeder-phase-volume-target-aggregate-contributions'
    ],
    stateMutationTarget: 'schroeder-retained-phase-volume-target-aggregate-buffer',
    stateMutationStatus: 'phase-volume-target-aggregate-contribution-materialization-planned',
    stateAuthorityStatus: 'derived-from-current-level-assignment-no-authoritative-state-mutation',
    conservativeTransferStatus: 'phase-volume-target-aggregate-contributions-ready',
    conservedQuantities: ['mass', 'represented-volume'],
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

export function createSchroederFarAggregateCandidatePlan({
  activeNodeList,
  hierarchyAggregateNode,
  candidateBudget = DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET,
  enabledFarLawMask = SCHROEDER_FAR_AGGREGATE_LAW_MASK,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  openingTheta = DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA,
  nearFieldSupportScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_NEAR_FIELD_SUPPORT_SCALE,
  farFieldErrorBound = DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  queueEpoch = 0,
  stateFamilyId = 1
} = {}) {
  assertLawNeighborActiveNodeInput(activeNodeList);
  assertFarAggregateHierarchyNodeInput(hierarchyAggregateNode);
  const activeNodeCount = Math.max(0, Math.round(finiteNumber(
    activeNodeList.activeCandidateCount ?? activeNodeList.particleCount,
    0
  )));
  const aggregateNodeCount = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregateNode.aggregateNodeCount ?? hierarchyAggregateNode.aggregateRowCount,
    0
  )));
  const resolvedCandidateBudget = Math.max(1, Math.round(finiteNumber(
    candidateBudget,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET
  )));
  const farAggregateCandidateCount = activeNodeCount * resolvedCandidateBudget;
  const farAggregateCandidateByteLength = Math.max(
    4,
    farAggregateCandidateCount * SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  const resolvedFarLawMask = Math.max(0, Math.round(finiteNumber(
    enabledFarLawMask,
    SCHROEDER_FAR_AGGREGATE_LAW_MASK
  )));
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_SCHEMA,
    status: 'schroeder-far-aggregate-candidate-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-far-aggregate-candidates',
    sourceActiveNodeSchema: activeNodeList.schema,
    sourceActiveNodeStatus: activeNodeList.status ?? null,
    sourceHierarchyAggregateNodeSchema: hierarchyAggregateNode.schema,
    sourceHierarchyAggregateNodeStatus: hierarchyAggregateNode.status ?? null,
    activeNodeCount,
    aggregateNodeCount,
    candidateBudget: resolvedCandidateBudget,
    farAggregateCandidateCount,
    enabledFarLawMask: resolvedFarLawMask,
    farAggregateLawFamilies: ['gravity', 'radiation', 'plasma', 'gas-far-field-summary'],
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    aggregateNodeStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
    farAggregateCandidateRowLayout: [...SCHROEDER_FAR_AGGREGATE_CANDIDATE_ROW_LAYOUT],
    farAggregateCandidateStrideFloats: SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS,
    farAggregateCandidateStrideBytes: SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    farAggregateCandidateByteLength,
    baseGridSpacingM: finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M),
    openingTheta: Math.max(0, finiteNumber(
      openingTheta,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA
    )),
    nearFieldSupportScale: Math.max(0, finiteNumber(
      nearFieldSupportScale,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_NEAR_FIELD_SUPPORT_SCALE
    )),
    farFieldErrorBound: Math.max(0, finiteNumber(
      farFieldErrorBound,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND
    )),
    queueEpoch: finiteNumber(queueEpoch, 0),
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    traversalMode: 'barnes-hut-style-aggregate-opening-over-schroeder-nodes',
    outputCompaction: 'fixed-budget-far-aggregate-candidate-rows-per-active-node',
    aggregateAdmissibilityStatus: resolvedFarLawMask > 0
      ? 'aggregate-admissible-laws-only-local-incompressibility-and-reactions-excluded'
      : 'far-aggregate-law-mask-disabled',
    exactNearFieldRequirement: 'near-field-excluded-use-law-neighbor-candidates-for-exact-pairs',
    conservationStatus: 'read-only-aggregate-traversal-no-state-mutation',
    stateMutationStatus: 'far-aggregate-candidates-buffer-submitted-no-state-mutation',
    stateAuthorityStatus: 'state-manager-admitted-aggregate-node-source-required',
    outputFamilies: [
      'schroeder-far-aggregate-candidates',
      'schroeder-hierarchy-aggregate-nodes'
    ],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederFarAggregateForceSummaryPlan({
  farAggregateCandidates,
  candidateBudget = farAggregateCandidates?.candidateBudget ?? DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET,
  enabledFarLawMask = farAggregateCandidates?.enabledFarLawMask ?? SCHROEDER_FAR_AGGREGATE_LAW_MASK,
  gravitationalConstant = DEFAULT_SCHROEDER_FAR_AGGREGATE_GRAVITATIONAL_CONSTANT,
  softeningLengthM = DEFAULT_SCHROEDER_FAR_AGGREGATE_SOFTENING_LENGTH_M,
  forceScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_FORCE_SCALE,
  farFieldErrorBound = farAggregateCandidates?.farFieldErrorBound ?? DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  queueEpoch = farAggregateCandidates?.queueEpoch ?? 0,
  stateFamilyId = farAggregateCandidates?.stateFamilyId ?? 1
} = {}) {
  assertFarAggregateCandidateInput(farAggregateCandidates);
  const activeNodeCount = Math.max(0, Math.round(finiteNumber(
    farAggregateCandidates.activeNodeCount,
    0
  )));
  if (activeNodeCount <= 0) {
    throw new RangeError('Schroeder far-aggregate force summary requires at least one active source row');
  }
  const resolvedCandidateBudget = Math.max(1, Math.round(finiteNumber(
    candidateBudget,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET
  )));
  const farAggregateCandidateCount = Math.max(0, Math.round(finiteNumber(
    farAggregateCandidates.farAggregateCandidateCount ?? farAggregateCandidates.candidateCount,
    activeNodeCount * resolvedCandidateBudget
  )));
  const forceSummaryRowCount = activeNodeCount;
  const forceSummaryByteLength = Math.max(
    4,
    forceSummaryRowCount * SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  const resolvedFarLawMask = Math.max(0, Math.round(finiteNumber(
    enabledFarLawMask,
    SCHROEDER_FAR_AGGREGATE_LAW_MASK
  )));
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_SCHEMA,
    status: 'schroeder-far-aggregate-force-summary-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-far-aggregate-force-summary',
    sourceFarAggregateCandidateSchema: farAggregateCandidates.schema,
    sourceFarAggregateCandidateStatus: farAggregateCandidates.status ?? null,
    activeNodeCount,
    farAggregateCandidateCount,
    candidateBudget: resolvedCandidateBudget,
    enabledFarLawMask: resolvedFarLawMask,
    forceSummaryRowCount,
    farAggregateCandidateStrideFloats: SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS,
    forceSummaryRowLayout: [...SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_ROW_LAYOUT],
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    forceSummaryStrideBytes: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    forceSummaryByteLength,
    gravitationalConstant: Math.max(0, finiteNumber(
      gravitationalConstant,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_GRAVITATIONAL_CONSTANT
    )),
    softeningLengthM: Math.max(0, finiteNumber(
      softeningLengthM,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_SOFTENING_LENGTH_M
    )),
    forceScale: finiteNumber(
      forceScale,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_FORCE_SCALE
    ),
    farFieldErrorBound: Math.max(0, finiteNumber(
      farFieldErrorBound,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND
    )),
    queueEpoch: finiteNumber(queueEpoch, 0),
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    lawFamilies: ['gravity'],
    forceMode: 'read-only-gravity-like-far-aggregate-acceleration-summary',
    outputCompaction: 'one-far-aggregate-force-summary-row-per-active-node',
    aggregateAdmissibilityStatus: resolvedFarLawMask > 0
      ? 'consumes-aggregate-admissible-far-field-candidates-only'
      : 'far-aggregate-law-mask-disabled',
    errorBoundStatus: 'physical-error-bound-declared-on-summary-rows',
    conservationStatus: 'read-only-force-summary-no-state-mutation',
    stateMutationRequired: false,
    stateMutationStatus: 'force-summary-only-no-state-mutation',
    stateAuthorityStatus: 'state-manager-admission-required-before-any-force-application',
    outputFamilies: [
      'schroeder-far-aggregate-force-summary',
      'schroeder-far-aggregate-candidates'
    ],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederFarAggregateDiagnosticSummaryPlan({
  farAggregateForceSummary,
  openingTheta = farAggregateForceSummary?.openingTheta ?? DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA,
  farFieldErrorBound = farAggregateForceSummary?.farFieldErrorBound ?? DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  accelerationPressureThreshold = DEFAULT_SCHROEDER_FAR_AGGREGATE_ACCELERATION_PRESSURE_THRESHOLD,
  queueEpoch = farAggregateForceSummary?.queueEpoch ?? 0,
  stateFamilyId = farAggregateForceSummary?.stateFamilyId ?? 1
} = {}) {
  assertFarAggregateForceSummaryInput(farAggregateForceSummary);
  const forceSummaryRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateForceSummary.forceSummaryRowCount ?? farAggregateForceSummary.activeNodeCount,
    0
  )));
  if (forceSummaryRowCount <= 0) {
    throw new RangeError('Schroeder far-aggregate diagnostic summary requires at least one force-summary row');
  }
  const diagnosticSummaryByteLength =
    SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_SCHEMA,
    status: 'schroeder-far-aggregate-diagnostic-summary-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-far-aggregate-diagnostic-summary',
    sourceFarAggregateForceSummarySchema: farAggregateForceSummary.schema,
    sourceFarAggregateForceSummaryStatus: farAggregateForceSummary.status ?? null,
    forceSummaryRowCount,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    diagnosticSummaryRowLayout: [...SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_ROW_LAYOUT],
    diagnosticSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS,
    diagnosticSummaryStrideBytes: diagnosticSummaryByteLength,
    diagnosticSummaryByteLength,
    diagnosticSummaryRowCount: 1,
    summaryRowCount: 1,
    openingTheta: Math.max(0, finiteNumber(
      openingTheta,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA
    )),
    farFieldErrorBound: Math.max(0, finiteNumber(
      farFieldErrorBound,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND
    )),
    accelerationPressureThreshold: Math.max(0, finiteNumber(
      accelerationPressureThreshold,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_ACCELERATION_PRESSURE_THRESHOLD
    )),
    queueEpoch: finiteNumber(queueEpoch, 0),
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    outputCompaction: 'one-compact-far-aggregate-diagnostic-summary-row',
    diagnosticStatus: 'far-aggregate-diagnostics-ready',
    farFieldQualityStatus: 'far-aggregate-force-quality-pressure-ready',
    readbackPolicy: 'compact-summary-only-no-particle-readback',
    conservationStatus: 'diagnostic-summary-only-no-state-mutation',
    stateMutationRequired: false,
    stateMutationStatus: 'far-aggregate-diagnostic-summary-only-no-state-mutation',
    stateAuthorityStatus: 'state-manager-admission-required-before-any-far-force-application',
    outputFamilies: [
      'schroeder-far-aggregate-diagnostics',
      'schroeder-far-aggregate-force-summary'
    ],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederFarAggregateLawConsumerPlan({
  farAggregateForceSummary,
  farAggregateDiagnosticSummary = null,
  farAggregateLawConsumerAdmission = null,
  enabledConsumerLawMask = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK,
  radiationScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_SCALE,
  plasmaScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_SCALE,
  gasSummaryScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_SUMMARY_SCALE,
  gasTemperatureK = DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_TEMPERATURE_K,
  gasConstantProxy = DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_CONSTANT_PROXY,
  maxFarFieldErrorBound = farAggregateDiagnosticSummary?.farFieldErrorBound
    ?? farAggregateForceSummary?.farFieldErrorBound
    ?? DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  maxOpeningRatio = farAggregateDiagnosticSummary?.openingTheta
    ?? farAggregateForceSummary?.openingTheta
    ?? DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA,
  queueEpoch = farAggregateForceSummary?.queueEpoch ?? 0,
  stateFamilyId = farAggregateForceSummary?.stateFamilyId ?? 1
} = {}) {
  assertFarAggregateForceSummaryInput(farAggregateForceSummary);
  if (farAggregateDiagnosticSummary) assertFarAggregateDiagnosticSummaryInput(farAggregateDiagnosticSummary);
  const forceSummaryRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateForceSummary.forceSummaryRowCount ?? farAggregateForceSummary.activeNodeCount,
    0
  )));
  if (forceSummaryRowCount <= 0) {
    throw new RangeError('Schroeder far-aggregate law consumer requires at least one force-summary row');
  }
  const resolvedConsumerMask = Math.max(0, Math.round(finiteNumber(
    enabledConsumerLawMask,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK
  ))) & SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK;
  const admission = schroederFarAggregateLawConsumerAdmissionAllowsConsumption({
    farAggregateLawConsumerAdmission,
    farAggregateForceSummary,
    farAggregateDiagnosticSummary,
    lawConsumerRowCount: forceSummaryRowCount,
    enabledConsumerLawMask: resolvedConsumerMask
  });
  const lawConsumerByteLength = Math.max(
    4,
    forceSummaryRowCount * SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  const lawFamilies = [];
  if ((admission.enabledConsumerLawMask & SCHROEDER_FAR_LAW_RADIATION_MASK) !== 0) lawFamilies.push('radiation');
  if ((admission.enabledConsumerLawMask & SCHROEDER_FAR_LAW_PLASMA_MASK) !== 0) lawFamilies.push('plasma-electromagnetic');
  if ((admission.enabledConsumerLawMask & SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK) !== 0) lawFamilies.push('gas-summary');
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_SCHEMA,
    status: admission.approved
      ? 'schroeder-far-aggregate-law-consumer-plan-ready'
      : 'schroeder-far-aggregate-law-consumer-plan-blocked-admission-required',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-far-aggregate-law-consumer',
    sourceFarAggregateForceSummarySchema: farAggregateForceSummary.schema,
    sourceFarAggregateForceSummaryStatus: farAggregateForceSummary.status ?? null,
    sourceFarAggregateDiagnosticSummarySchema: farAggregateDiagnosticSummary?.schema ?? null,
    sourceFarAggregateDiagnosticSummaryStatus: farAggregateDiagnosticSummary?.status ?? null,
    forceSummaryRowCount,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    diagnosticSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS,
    lawConsumerRowLayout: [...SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_ROW_LAYOUT],
    lawConsumerStrideFloats: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
    lawConsumerStrideBytes: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    lawConsumerByteLength,
    lawConsumerRowCount: forceSummaryRowCount,
    enabledConsumerLawMask: admission.enabledConsumerLawMask,
    requestedConsumerLawMask: resolvedConsumerMask,
    lawFamilies,
    radiationScale: finiteNumber(
      radiationScale,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_SCALE
    ),
    plasmaScale: finiteNumber(
      plasmaScale,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_SCALE
    ),
    gasSummaryScale: finiteNumber(
      gasSummaryScale,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_SUMMARY_SCALE
    ),
    gasTemperatureK: Math.max(0, finiteNumber(
      gasTemperatureK,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_TEMPERATURE_K
    )),
    gasConstantProxy: Math.max(0, finiteNumber(
      gasConstantProxy,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_CONSTANT_PROXY
    )),
    maxFarFieldErrorBound: Math.max(0, finiteNumber(
      maxFarFieldErrorBound,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND
    )),
    maxOpeningRatio: Math.max(0, finiteNumber(
      maxOpeningRatio,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA
    )),
    queueEpoch: finiteNumber(queueEpoch, 0),
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    admission,
    farAggregateLawConsumerAdmissionSchema: admission.schema,
    farAggregateLawConsumerAdmissionStatus: admission.status,
    farAggregateLawConsumerAdmissionApproved: admission.approved,
    farAggregateLawConsumerAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
    outputCompaction: 'one-far-aggregate-law-consumer-row-per-source',
    consumerMode: 'read-only-radiation-plasma-gas-summary-proxies',
    aggregateAdmissibilityStatus: 'aggregate-admissible-far-field-laws-only-local-laws-excluded',
    exactNearFieldRequirement: 'local-incompressibility-reaction-contact-interface-remain-near-field',
    diagnosticPressurePolicy: 'compact-diagnostics-gate-consumer-row-status',
    conservationStatus: admission.approved
      ? 'law-consumer-summary-ready-no-state-mutation'
      : 'law-consumer-blocked-admission-required',
    stateMutationRequired: false,
    stateMutationStatus: admission.approved
      ? 'far-aggregate-law-consumer-summary-planned'
      : 'blocked-far-aggregate-law-consumer-admission-required',
    stateAuthorityStatus: admission.approved
      ? 'state-manager-admitted-read-only-far-aggregate-law-consumer'
      : 'requires-state-manager-admission-before-far-aggregate-law-consumer',
    outputFamilies: [
      SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_OUTPUT_FAMILY,
      'schroeder-far-aggregate-force-summary',
      'schroeder-far-aggregate-diagnostics'
    ],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederFarAggregateLawConsumerDiagnosticSummaryPlan({
  farAggregateLawConsumer,
  radiationPressureThreshold =
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_PRESSURE_THRESHOLD,
  plasmaPressureThreshold =
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_PRESSURE_THRESHOLD,
  gasPressureThreshold =
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_PRESSURE_THRESHOLD,
  queueEpoch = farAggregateLawConsumer?.queueEpoch ?? 0,
  stateFamilyId = farAggregateLawConsumer?.stateFamilyId ?? 1
} = {}) {
  assertFarAggregateLawConsumerInput(farAggregateLawConsumer);
  const lawConsumerRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateLawConsumer.lawConsumerRowCount ?? farAggregateLawConsumer.forceSummaryRowCount,
    0
  )));
  if (lawConsumerRowCount <= 0) {
    throw new RangeError('Schroeder far-aggregate law consumer diagnostic summary requires at least one consumer row');
  }
  const diagnosticSummaryByteLength =
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_SCHEMA,
    status: 'schroeder-far-aggregate-law-consumer-diagnostic-summary-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-far-aggregate-law-consumer-diagnostic-summary',
    sourceFarAggregateLawConsumerSchema: farAggregateLawConsumer.schema,
    sourceFarAggregateLawConsumerStatus: farAggregateLawConsumer.status ?? null,
    lawConsumerRowCount,
    lawConsumerStrideFloats: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
    lawConsumerDiagnosticSummaryRowLayout: [
      ...SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_ROW_LAYOUT
    ],
    lawConsumerDiagnosticSummaryStrideFloats:
      SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS,
    lawConsumerDiagnosticSummaryStrideBytes: diagnosticSummaryByteLength,
    lawConsumerDiagnosticSummaryByteLength: diagnosticSummaryByteLength,
    lawConsumerDiagnosticSummaryRowCount: 1,
    summaryRowCount: 1,
    radiationPressureThreshold: Math.max(0, finiteNumber(
      radiationPressureThreshold,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_PRESSURE_THRESHOLD
    )),
    plasmaPressureThreshold: Math.max(0, finiteNumber(
      plasmaPressureThreshold,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_PRESSURE_THRESHOLD
    )),
    gasPressureThreshold: Math.max(0, finiteNumber(
      gasPressureThreshold,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_PRESSURE_THRESHOLD
    )),
    queueEpoch: finiteNumber(queueEpoch, 0),
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    outputCompaction: 'one-compact-far-aggregate-law-consumer-diagnostic-summary-row',
    diagnosticStatus: 'far-aggregate-law-consumer-diagnostics-ready',
    farFieldConsumerQualityStatus: 'far-aggregate-law-consumer-pressure-diagnostics-ready',
    readbackPolicy: 'compact-summary-only-no-particle-readback',
    conservationStatus: 'law-consumer-diagnostic-summary-only-no-state-mutation',
    stateMutationRequired: false,
    stateMutationStatus: 'far-aggregate-law-consumer-diagnostic-summary-only-no-state-mutation',
    stateAuthorityStatus: 'state-manager-admission-required-before-any-law-consumer-state-mutation',
    outputFamilies: [
      SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_OUTPUT_FAMILY,
      SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_OUTPUT_FAMILY
    ],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederFarAggregateLawConsumerAuthorityPolicy({
  farAggregateLawConsumerDiagnosticSummary,
  allowStateDeltaMutation =
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_POLICY_ALLOW_STATE_DELTA_MUTATION,
  pressureRatioThreshold =
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_POLICY_PRESSURE_RATIO_THRESHOLD,
  queueEpoch = farAggregateLawConsumerDiagnosticSummary?.queueEpoch ?? 0,
  stateFamilyId = farAggregateLawConsumerDiagnosticSummary?.stateFamilyId ?? 1
} = {}) {
  assertFarAggregateLawConsumerDiagnosticSummaryInput(farAggregateLawConsumerDiagnosticSummary);
  const rows = schroederLawConsumerDiagnosticSummaryRows(farAggregateLawConsumerDiagnosticSummary);
  const diagnosticRowsAvailable = Boolean(rows && rows.length >= SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS);
  const declaredRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateLawConsumerDiagnosticSummary.lawConsumerRowCount
      ?? farAggregateLawConsumerDiagnosticSummary.forceSummaryRowCount,
    0
  )));
  const lawConsumerRowCount = Math.max(0, Math.round(finiteNumber(
    diagnosticRowsAvailable
      ? schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 0, declaredRowCount)
      : declaredRowCount,
    declaredRowCount
  )));
  const activeConsumerCount = diagnosticRowsAvailable
    ? Math.max(0, schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 1, 0))
    : 0;
  const blockedConsumerCount = diagnosticRowsAvailable
    ? Math.max(0, schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 2, 0))
    : 0;
  const pressureConsumerCount = diagnosticRowsAvailable
    ? Math.max(0, schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 3, 0))
    : 0;
  const pressureRatio = lawConsumerRowCount > 0 ? pressureConsumerCount / lawConsumerRowCount : 0;
  const resolvedPressureRatioThreshold = Math.max(0, finiteNumber(
    pressureRatioThreshold,
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_POLICY_PRESSURE_RATIO_THRESHOLD
  ));
  const rowPressureSignal = pressureConsumerCount > 0;
  const ratioPressureSignal = resolvedPressureRatioThreshold > 0 && pressureRatio >= resolvedPressureRatioThreshold;
  const pressureSignalDetected = diagnosticRowsAvailable && (rowPressureSignal || ratioPressureSignal);
  const stateDeltaAdmissionRequired = Boolean(allowStateDeltaMutation) && pressureSignalDetected;
  const recommendedStateDeltaRequired = pressureSignalDetected;
  const enabledConsumerLawMask = diagnosticRowsAvailable
    ? Math.max(0, Math.round(schroederLawConsumerDiagnosticSummaryValue(
      farAggregateLawConsumerDiagnosticSummary,
      20,
      0
    )))
    : 0;
  const emittedConsumerLawMask = diagnosticRowsAvailable
    ? Math.max(0, Math.round(schroederLawConsumerDiagnosticSummaryValue(
      farAggregateLawConsumerDiagnosticSummary,
      21,
      0
    )))
    : 0;
  const status = !diagnosticRowsAvailable
    ? 'schroeder-far-aggregate-law-consumer-authority-policy-awaiting-compact-diagnostics'
    : (stateDeltaAdmissionRequired
        ? 'schroeder-far-aggregate-law-consumer-authority-policy-state-delta-admission-required'
        : (pressureSignalDetected
            ? 'schroeder-far-aggregate-law-consumer-authority-policy-read-only-pressure-observed'
            : 'schroeder-far-aggregate-law-consumer-authority-policy-read-only-summary'));
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_AUTHORITY_POLICY_SCHEMA,
    status,
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-far-aggregate-law-consumer-authority-policy',
    sourceFarAggregateLawConsumerDiagnosticSummarySchema:
      farAggregateLawConsumerDiagnosticSummary.schema,
    sourceFarAggregateLawConsumerDiagnosticSummaryStatus:
      farAggregateLawConsumerDiagnosticSummary.status ?? null,
    diagnosticRowsAvailable,
    lawConsumerRowCount,
    activeConsumerCount,
    blockedConsumerCount,
    pressureConsumerCount,
    pressureRatio,
    pressureRatioThreshold: resolvedPressureRatioThreshold,
    pressureSignalDetected,
    enabledConsumerLawMask,
    emittedConsumerLawMask,
    totalRadiationExposureProxy: diagnosticRowsAvailable
      ? schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 7, 0)
      : 0,
    maxRadiationExposureProxy: diagnosticRowsAvailable
      ? schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 8, 0)
      : 0,
    maxPlasmaCollectiveAccelerationProxy: diagnosticRowsAvailable
      ? schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 9, 0)
      : 0,
    maxGasPressureProxyPa: diagnosticRowsAvailable
      ? schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 11, 0)
      : 0,
    maxAccelerationMagnitudeMPerS2: diagnosticRowsAvailable
      ? schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 13, 0)
      : 0,
    maxPotentialMagnitudeJPerKg: diagnosticRowsAvailable
      ? schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 14, 0)
      : 0,
    errorPressureCount: diagnosticRowsAvailable
      ? schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 17, 0)
      : 0,
    openingPressureCount: diagnosticRowsAvailable
      ? schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 18, 0)
      : 0,
    overflowPressureCount: diagnosticRowsAvailable
      ? schroederLawConsumerDiagnosticSummaryValue(farAggregateLawConsumerDiagnosticSummary, 19, 0)
      : 0,
    allowStateDeltaMutation: Boolean(allowStateDeltaMutation),
    recommendedStateDeltaRequired,
    stateDeltaAdmissionRequired,
    stateDeltaOutputFamily: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_STATE_DELTA_OUTPUT_FAMILY,
    authorityBoundary: 'diagnostic-policy-only-no-authoritative-mutation',
    mutationPolicy: stateDeltaAdmissionRequired
      ? 'state-delta-admission-required-before-any-far-field-consumer-mutation'
      : 'read-only-law-consumer-summary-retained',
    queueEpoch: finiteNumber(queueEpoch, 0),
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    readbackPolicy: diagnosticRowsAvailable
      ? 'compact-law-consumer-diagnostic-summary-consumed'
      : 'descriptor-only-policy-awaits-compact-diagnostic-rows',
    conservationStatus: stateDeltaAdmissionRequired
      ? 'future-far-field-consumer-state-delta-requires-admission'
      : 'law-consumer-authority-policy-no-state-mutation',
    stateMutationRequired: false,
    stateMutationStatus: stateDeltaAdmissionRequired
      ? 'far-field-consumer-state-delta-requires-new-admission'
      : 'far-field-consumer-remains-read-only-summary',
    stateAuthorityStatus: stateDeltaAdmissionRequired
      ? 'requires-state-manager-admission-before-far-field-consumer-state-delta'
      : 'state-manager-admission-not-required-for-read-only-law-consumer-policy',
    outputFamilies: [
      SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_OUTPUT_FAMILY,
      SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_OUTPUT_FAMILY
    ],
    futureOutputFamilies: stateDeltaAdmissionRequired
      ? [SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_STATE_DELTA_OUTPUT_FAMILY]
      : [],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederFarAggregateGasStateDeltaPlan({
  farAggregateLawConsumer,
  farAggregateLawConsumerAuthorityPolicy = null,
  farAggregateGasStateDeltaAdmission = null,
  referencePressurePa = DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_REFERENCE_PRESSURE_PA,
  pressureDeltaScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_PRESSURE_SCALE,
  densityDeltaScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_DENSITY_SCALE,
  gasGamma = DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_GAMMA,
  enabledConsumerLawMask = SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK,
  queueEpoch = farAggregateLawConsumer?.queueEpoch ?? 0,
  stateFamilyId = farAggregateLawConsumer?.stateFamilyId ?? 1,
  targetFamilyId = 1
} = {}) {
  assertFarAggregateLawConsumerInput(farAggregateLawConsumer);
  const lawConsumerRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateLawConsumer.lawConsumerRowCount ?? farAggregateLawConsumer.forceSummaryRowCount,
    0
  )));
  if (lawConsumerRowCount <= 0) {
    throw new RangeError('Schroeder far-aggregate gas state-delta requires at least one law-consumer row');
  }
  const authorityPolicySchemaAccepted =
    farAggregateLawConsumerAuthorityPolicy?.schema
      === ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_AUTHORITY_POLICY_SCHEMA;
  const policyAllowsStateDelta =
    authorityPolicySchemaAccepted
    && farAggregateLawConsumerAuthorityPolicy?.stateDeltaAdmissionRequired === true;
  const admission = schroederFarAggregateGasStateDeltaAdmissionAllowsApplication({
    farAggregateGasStateDeltaAdmission,
    farAggregateLawConsumer,
    farAggregateLawConsumerAuthorityPolicy,
    stateDeltaRowCount: lawConsumerRowCount,
    targetStateFamily: SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_TARGET_FAMILY
  });
  const gasStateDeltaByteLength = Math.max(
    4,
    lawConsumerRowCount
      * SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS
      * Float32Array.BYTES_PER_ELEMENT
  );
  const ready = policyAllowsStateDelta && admission.approved;
  const policyBlocked = !policyAllowsStateDelta;
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_SCHEMA,
    status: ready
      ? 'schroeder-far-aggregate-gas-state-delta-plan-ready'
      : (policyBlocked
          ? 'schroeder-far-aggregate-gas-state-delta-plan-blocked-authority-policy-read-only'
          : 'schroeder-far-aggregate-gas-state-delta-plan-blocked-admission-required'),
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-far-aggregate-gas-state-delta',
    sourceFarAggregateLawConsumerSchema: farAggregateLawConsumer.schema,
    sourceFarAggregateLawConsumerStatus: farAggregateLawConsumer.status ?? null,
    sourceFarAggregateLawConsumerAuthorityPolicySchema:
      farAggregateLawConsumerAuthorityPolicy?.schema ?? null,
    sourceFarAggregateLawConsumerAuthorityPolicyStatus:
      farAggregateLawConsumerAuthorityPolicy?.status ?? null,
    lawConsumerRowCount,
    lawConsumerStrideFloats: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
    gasStateDeltaRowLayout: [...SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ROW_LAYOUT],
    gasStateDeltaStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS,
    gasStateDeltaStrideBytes:
      SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    gasStateDeltaByteLength,
    gasStateDeltaRowCount: lawConsumerRowCount,
    stateDeltaRowCount: lawConsumerRowCount,
    enabledConsumerLawMask: Math.max(0, Math.round(finiteNumber(
      enabledConsumerLawMask,
      SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK
    ))) & SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK,
    referencePressurePa: Math.max(0, finiteNumber(
      referencePressurePa,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_REFERENCE_PRESSURE_PA
    )),
    pressureDeltaScale: finiteNumber(
      pressureDeltaScale,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_PRESSURE_SCALE
    ),
    densityDeltaScale: finiteNumber(
      densityDeltaScale,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_DENSITY_SCALE
    ),
    gasGamma: Math.max(1.01, finiteNumber(
      gasGamma,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_GAMMA
    )),
    queueEpoch: finiteNumber(queueEpoch, 0),
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    targetFamilyId: finiteNumber(targetFamilyId, 1),
    targetStateFamily: SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_TARGET_FAMILY,
    admission,
    farAggregateGasStateDeltaAdmissionSchema: admission.schema,
    farAggregateGasStateDeltaAdmissionStatus: admission.status,
    farAggregateGasStateDeltaAdmissionApproved: admission.approved,
    farAggregateGasStateDeltaAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
    authorityPolicyAccepted: policyAllowsStateDelta,
    outputCompaction: 'one-admitted-far-aggregate-gas-state-delta-row-per-law-consumer-row',
    gasStateDeltaMode: 'retained-gas-pressure-density-state-delta',
    targetStatePolicy: 'gas-pressure-family-import-through-pressure-interface-admission',
    pressureInterfaceImportRequired: ready,
    conservationStatus: ready
      ? 'pending-gas-pressure-state-delta-requires-admitted-import'
      : (policyBlocked
          ? 'gas-state-delta-blocked-authority-policy-read-only'
          : 'gas-state-delta-blocked-admission-required'),
    stateMutationRequired: ready,
    stateMutationStatus: ready
      ? 'far-aggregate-gas-state-delta-planned'
      : (policyBlocked
          ? 'blocked-far-aggregate-gas-state-delta-authority-policy-read-only'
          : 'blocked-far-aggregate-gas-state-delta-admission-required'),
    stateAuthorityStatus: ready
      ? 'state-manager-admitted-far-aggregate-gas-state-delta'
      : (policyBlocked
          ? 'requires-authority-policy-state-delta-before-gas-state-delta'
          : 'requires-state-manager-admission-before-far-aggregate-gas-state-delta'),
    outputFamilies: [
      SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_OUTPUT_FAMILY,
      SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_TARGET_FAMILY
    ],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederFarAggregateGasCellImportPlan({
  farAggregateGasStateDelta,
  farAggregateForceSummary,
  defaultCellVolumeM3 = 0,
  queueEpoch = farAggregateGasStateDelta?.queueEpoch ?? farAggregateForceSummary?.queueEpoch ?? 0,
  stateFamilyId = farAggregateGasStateDelta?.stateFamilyId ?? 1,
  targetFamilyId = farAggregateGasStateDelta?.targetFamilyId ?? 1
} = {}) {
  assertFarAggregateGasCellImportInput({ farAggregateGasStateDelta, farAggregateForceSummary });
  const gasStateDeltaRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateGasStateDelta.gasStateDeltaRowCount
      ?? farAggregateGasStateDelta.stateDeltaRowCount,
    0
  )));
  const forceSummaryRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateForceSummary.forceSummaryRowCount ?? farAggregateForceSummary.activeNodeCount,
    0
  )));
  const gasCellRowByteLength = Math.max(
    4,
    gasStateDeltaRowCount
      * SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS
      * Float32Array.BYTES_PER_ELEMENT
  );
  const retainedGasPressureBufferRefs = ['resident-gas-pressure-cells-buffer'];
  const retainedGasCellFieldSource = {
    schema: 'peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0',
    status: 'pressure-interface-retained-gas-cell-field-source-ready',
    sourceHotBufferKey: farAggregateGasStateDelta.farAggregateGasStateDeltaAdmissionSourceHotBufferKey ?? null,
    sourceTaskId: null,
    sourceStage: 'schroederFarAggregateGasCellImport',
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs: [],
    pressureInterfaceGasPressureCellRowCount: gasStateDeltaRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS,
    pressureInterfaceGasPressureCellRowByteLength: gasCellRowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    pressureFieldMode: 'local-gas-cell-pressure-gradient',
    pressureFieldResolution: 'structured-gas-cell-grid',
    sourceFamilies: [SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_OUTPUT_FAMILY],
    consumerAccessProtocol: 'same-device-retained-buffer-ref',
    stateManagerAdmissionRequired: true,
    cpuSnapshotRequiredForPortableImport: true
  };
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA,
    status: 'schroeder-far-aggregate-gas-cell-import-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-far-aggregate-gas-cell-import',
    sourceFarAggregateGasStateDeltaSchema: farAggregateGasStateDelta.schema,
    sourceFarAggregateGasStateDeltaStatus: farAggregateGasStateDelta.status ?? null,
    sourceFarAggregateForceSummarySchema: farAggregateForceSummary.schema,
    sourceFarAggregateForceSummaryStatus: farAggregateForceSummary.status ?? null,
    gasStateDeltaRowCount,
    gasStateDeltaStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS,
    forceSummaryRowCount,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    gasPressureCellRowLayout: [...SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT],
    pressureInterfaceGasPressureCellRowLayout: [...SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT],
    gasPressureCellRowCount: gasStateDeltaRowCount,
    pressureInterfaceGasPressureCellRowCount: gasStateDeltaRowCount,
    gasPressureCellRowStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS,
    pressureInterfaceGasPressureCellRowStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS,
    gasPressureCellRowByteLength: gasCellRowByteLength,
    pressureInterfaceGasPressureCellRowByteLength: gasCellRowByteLength,
    defaultCellVolumeM3: Math.max(0, finiteNumber(defaultCellVolumeM3, 0)),
    queueEpoch: finiteNumber(queueEpoch, 0),
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    targetFamilyId: finiteNumber(targetFamilyId, 1),
    targetStateFamily: SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_TARGET_FAMILY,
    outputCompaction: 'one-pressure-interface-gas-cell-row-per-admitted-gas-state-delta-row',
    pressureInterfaceImportReady: true,
    pressureInterfaceImportRequired: true,
    pressureFieldMode: 'local-gas-cell-pressure-gradient',
    pressureFieldResolution: 'structured-gas-cell-grid',
    localPressureGradientReady: false,
    localPressureGradientStatus: 'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read',
    conservativeTransferStatus: 'retained-gas-pressure-cells-ready-for-pressure-interface',
    retainedGasPressureBufferRefs,
    retainedGasCellFieldSource,
    retainedGasCellFieldSourceSchema: retainedGasCellFieldSource.schema,
    retainedGasCellFieldSourceStatus: retainedGasCellFieldSource.status,
    retainedGasCellFieldSourceReady: true,
    outputFamilies: [SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_OUTPUT_FAMILY],
    stateMutationRequired: false,
    stateMutationStatus: 'admitted-gas-pressure-deltas-materialized-as-retained-pressure-cells',
    stateAuthorityStatus: 'state-manager-admitted-gas-delta-materialized-for-pressure-interface',
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederFarAggregateForceApplicationPlan({
  farAggregateForceSummary,
  farAggregateDiagnosticSummary = null,
  sphParticleState,
  farAggregateForceApplicationAdmission = null,
  dtS = 0,
  accelerationScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_ACCELERATION_SCALE,
  maxAccelerationMPerS2 = DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_MAX_ACCELERATION_M_PER_S2,
  maxFarFieldErrorBound = farAggregateDiagnosticSummary?.farFieldErrorBound
    ?? farAggregateForceSummary?.farFieldErrorBound
    ?? DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  maxOpeningRatio = farAggregateDiagnosticSummary?.openingTheta
    ?? farAggregateForceSummary?.openingTheta
    ?? DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA,
  queueEpoch = farAggregateForceSummary?.queueEpoch ?? 0,
  stateFamilyId = farAggregateForceSummary?.stateFamilyId ?? 1
} = {}) {
  assertFarAggregateForceSummaryInput(farAggregateForceSummary);
  if (farAggregateDiagnosticSummary) assertFarAggregateDiagnosticSummaryInput(farAggregateDiagnosticSummary);
  assertSphParticleStateInput(sphParticleState);
  const forceSummaryRowCount = Math.max(0, Math.round(finiteNumber(
    farAggregateForceSummary.forceSummaryRowCount ?? farAggregateForceSummary.activeNodeCount,
    0
  )));
  if (forceSummaryRowCount <= 0) {
    throw new RangeError('Schroeder far-aggregate force application requires at least one force-summary row');
  }
  const particleCount = Math.max(0, Math.round(finiteNumber(sphParticleState.particleCount, 0)));
  const admission = schroederFarAggregateForceApplicationAdmissionAllowsApplication({
    farAggregateForceApplicationAdmission,
    farAggregateForceSummary,
    farAggregateDiagnosticSummary,
    forceApplicationRowCount: forceSummaryRowCount
  });
  const forceApplicationByteLength = Math.max(
    4,
    forceSummaryRowCount * SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_SCHEMA,
    status: admission.approved
      ? 'schroeder-far-aggregate-force-application-plan-ready'
      : 'schroeder-far-aggregate-force-application-plan-blocked-admission-required',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-far-aggregate-force-application',
    sourceFarAggregateForceSummarySchema: farAggregateForceSummary.schema,
    sourceFarAggregateForceSummaryStatus: farAggregateForceSummary.status ?? null,
    sourceFarAggregateDiagnosticSummarySchema: farAggregateDiagnosticSummary?.schema ?? null,
    sourceFarAggregateDiagnosticSummaryStatus: farAggregateDiagnosticSummary?.status ?? null,
    sourceParticleSchema: sphParticleState.schema,
    particleCount,
    forceSummaryRowCount,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    particleStateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    forceApplicationRowLayout: [...SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ROW_LAYOUT],
    forceApplicationStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS,
    forceApplicationStrideBytes: SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    forceApplicationByteLength,
    forceApplicationRowCount: forceSummaryRowCount,
    dtS: Math.max(0, finiteNumber(dtS, 0)),
    accelerationScale: finiteNumber(
      accelerationScale,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_ACCELERATION_SCALE
    ),
    maxAccelerationMPerS2: Math.max(0, finiteNumber(
      maxAccelerationMPerS2,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_MAX_ACCELERATION_M_PER_S2
    )),
    maxFarFieldErrorBound: Math.max(0, finiteNumber(
      maxFarFieldErrorBound,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND
    )),
    maxOpeningRatio: Math.max(0, finiteNumber(
      maxOpeningRatio,
      DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA
    )),
    queueEpoch: finiteNumber(queueEpoch, 0),
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    admission,
    farAggregateForceApplicationAdmissionSchema: admission.schema,
    farAggregateForceApplicationAdmissionStatus: admission.status,
    farAggregateForceApplicationAdmissionApproved: admission.approved,
    farAggregateForceApplicationAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
    outputCompaction: 'one-admitted-far-aggregate-force-application-row-per-source',
    forceApplicationMode: 'admitted-acceleration-to-velocity-momentum-delta',
    conservationStatus: admission.approved
      ? 'force-application-delta-ready'
      : 'force-application-blocked-admission-required',
    energyPolicy: 'kinetic-delta-reported-potential-read-only',
    conservedQuantities: ['momentum-delta', 'kinetic-energy-delta'],
    stateMutationTarget: 'schroeder-retained-far-aggregate-force-application-delta-buffer',
    stateMutationRequired: admission.approved,
    stateMutationStatus: admission.approved
      ? 'far-aggregate-force-application-planned'
      : 'blocked-far-aggregate-force-application-admission-required',
    stateAuthorityStatus: admission.approved
      ? 'state-manager-admission-present'
      : 'requires-state-manager-admission-before-far-force-application',
    outputFamilies: [
      SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_OUTPUT_FAMILY,
      'schroeder-far-aggregate-force-summary'
    ],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederPhaseVolumeMigrationPlan({
  levelAssignment,
  hierarchyAggregateNode,
  identityRequired = false,
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
    identityRequired: identityRequired === true,
    aggregateIdentityKeyMode: identityRequired
      ? 'exact-render-domain-id'
      : 'legacy-zero-or-explicit-render-domain-id',
    refinePressurePolicy: 'explicit-gpu-row-mask-before-any-split-merge-mutation',
    refinePressureReasonBits: [...SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS],
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

export function createSchroederPhaseVolumeSplitMergeProposalPlan({
  phaseVolumeMigration,
  hierarchyAggregateNode = null,
  proposalEpoch = phaseVolumeMigration?.migrationEpoch ?? 0,
  stateFamilyId = 1,
  coarsenModeId = 1,
  refineModeId = 2
} = {}) {
  assertPhaseVolumeMigrationInput(phaseVolumeMigration);
  const aggregateNodeCount = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregateNode?.aggregateNodeCount ?? hierarchyAggregateNode?.aggregateRowCount,
    0
  )));
  const migrationRowCount = Math.max(0, Math.round(finiteNumber(phaseVolumeMigration.particleCount, 0)));
  const proposalByteLength = Math.max(
    4,
    migrationRowCount * SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_SCHEMA,
    status: 'schroeder-phase-volume-split-merge-proposal-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-phase-volume-split-merge-proposals',
    sourcePhaseVolumeMigrationSchema: phaseVolumeMigration.schema,
    sourcePhaseVolumeMigrationStatus: phaseVolumeMigration.status ?? null,
    migrationRowCount,
    migrationStrideFloats: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
    aggregateNodeCount,
    aggregateNodeStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
    // Nonzero aggregate node count enables mass-weighted cell momentum on
    // merged children; zero keeps the legacy leader-velocity behavior.
    mergedChildMomentumSource: aggregateNodeCount > 0
      ? 'hierarchy-aggregate-node-cell-momentum'
      : 'merge-leader-velocity-no-aggregate-node-rows',
    proposalRowLayout: [...SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_ROW_LAYOUT],
    proposalStrideFloats: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS,
    proposalStrideBytes: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    proposalByteLength,
    proposalEpoch: finiteNumber(proposalEpoch, 0),
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    coarsenModeId: finiteNumber(coarsenModeId, 1),
    refineModeId: finiteNumber(refineModeId, 2),
    proposalMode: 'proposal-only-no-particle-mutation',
    outputCompaction: 'one-phase-volume-split-merge-proposal-row-per-migration-row',
    splitMergePolicy: 'coarsen-eligible-merge-or-refine-pressure-split-proposals',
    conservationContinuityPolicy: 'zero-momentum-energy-delta-until-state-manager-admitted-apply',
    mutationAdmissionRequiredBeforeApply: true,
    stateMutationTarget: 'schroeder-retained-phase-volume-split-merge-proposal-buffer',
    stateMutationRequired: false,
    stateMutationStatus: 'proposal-buffer-only-no-particle-mutation',
    stateAuthorityStatus: 'state-manager-admission-required-before-any-particle-count-mutation',
    conservativeTransferStatus: 'split-merge-proposals-ready-no-authoritative-transfer',
    conservedQuantities: ['mass', 'represented-volume', 'momentum-delta', 'internal-energy-delta'],
    outputFamilies: [
      'schroeder-phase-volume-split-merge-proposal',
      'schroeder-phase-volume-migration'
    ],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederPhaseVolumeSplitMergeApplyPlan({
  phaseVolumeSplitMergeProposal,
  phaseVolumeSplitMergeAdmission = null,
  applyEpoch = phaseVolumeSplitMergeProposal?.proposalEpoch ?? 0,
  stateFamilyId = phaseVolumeSplitMergeProposal?.stateFamilyId ?? 1,
  residualTolerance = DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE
} = {}) {
  assertPhaseVolumeSplitMergeProposalInput(phaseVolumeSplitMergeProposal);
  const proposalRowCount = Math.max(0, Math.round(finiteNumber(
    phaseVolumeSplitMergeProposal.migrationRowCount,
    0
  )));
  const admission = schroederPhaseVolumeSplitMergeAdmissionAllowsApplication({
    phaseVolumeSplitMergeAdmission,
    phaseVolumeSplitMergeProposal,
    proposalRowCount
  });
  const applyByteLength = Math.max(
    4,
    proposalRowCount * SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_SCHEMA,
    status: admission.approved
      ? 'schroeder-phase-volume-split-merge-apply-plan-ready'
      : 'schroeder-phase-volume-split-merge-apply-plan-blocked-admission-required',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-phase-volume-split-merge-apply',
    sourcePhaseVolumeSplitMergeProposalSchema: phaseVolumeSplitMergeProposal.schema,
    sourcePhaseVolumeSplitMergeProposalStatus: phaseVolumeSplitMergeProposal.status ?? null,
    proposalRowCount,
    proposalStrideFloats: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS,
    applyRowLayout: [...SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_ROW_LAYOUT],
    applyStrideFloats: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS,
    applyStrideBytes: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    applyByteLength,
    outputCompaction: 'one-admitted-phase-volume-split-merge-apply-row-per-proposal-row',
    admission,
    phaseVolumeSplitMergeAdmissionSchema: admission.schema,
    phaseVolumeSplitMergeAdmissionStatus: admission.status,
    phaseVolumeSplitMergeAdmissionApproved: admission.approved,
    phaseVolumeSplitMergeAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    applyEpoch: finiteNumber(applyEpoch, 0),
    residualTolerance: Math.max(0, finiteNumber(
      residualTolerance,
      DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE
    )),
    applyMode: 'state-manager-admitted-split-merge-intent',
    particleStorageMutationStatus: admission.approved
      ? 'deferred-to-state-manager-particle-storage-allocator'
      : 'blocked-split-merge-admission-required',
    conservationContinuityPolicy: 'proposal-momentum-energy-deltas-preserved-for-replay',
    outputFamilies: [
      SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_OUTPUT_FAMILY,
      'schroeder-phase-volume-split-merge-proposal'
    ],
    stateMutationTarget: 'schroeder-retained-phase-volume-split-merge-apply-buffer',
    conservativeTransferStatus: admission.approved
      ? 'phase-volume-split-merge-apply-ready'
      : 'phase-volume-split-merge-apply-blocked-admission-required',
    stateMutationRequired: admission.approved,
    stateMutationStatus: admission.approved
      ? 'phase-volume-split-merge-apply-planned'
      : 'blocked-phase-volume-split-merge-admission-required',
    stateAuthorityStatus: admission.approved
      ? 'state-manager-admission-present'
      : 'requires-state-manager-admission-before-particle-count-mutation',
    conservedQuantities: ['mass', 'represented-volume', 'momentum-delta', 'internal-energy-delta'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederParticleStorageAllocationPlan({
  phaseVolumeSplitMergeApply,
  particleStorageAllocatorAdmission = null,
  allocatorEpoch = phaseVolumeSplitMergeApply?.applyEpoch ?? 0,
  stateFamilyId = phaseVolumeSplitMergeApply?.stateFamilyId ?? 1,
  currentParticleCapacity = phaseVolumeSplitMergeApply?.proposalRowCount ?? 0,
  requiredParticleCapacity = currentParticleCapacity,
  targetStateFamilyMask = SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK,
  preservePhaseSlots = false
} = {}) {
  assertPhaseVolumeSplitMergeApplyInput(phaseVolumeSplitMergeApply);
  const applyRowCount = Math.max(0, Math.round(finiteNumber(
    phaseVolumeSplitMergeApply.proposalRowCount,
    0
  )));
  const requiredCapacity = Math.max(0, Math.round(finiteNumber(
    requiredParticleCapacity,
    currentParticleCapacity
  )));
  const admission = schroederParticleStorageAllocatorAdmissionAllowsApplication({
    particleStorageAllocatorAdmission,
    phaseVolumeSplitMergeApply,
    applyRowCount,
    requiredParticleCapacity: requiredCapacity
  });
  const allocationByteLength = Math.max(
    4,
    applyRowCount * SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_SCHEMA,
    status: admission.approved
      ? 'schroeder-particle-storage-allocation-plan-ready'
      : 'schroeder-particle-storage-allocation-plan-blocked-admission-required',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-particle-storage-allocation',
    sourcePhaseVolumeSplitMergeApplySchema: phaseVolumeSplitMergeApply.schema,
    sourcePhaseVolumeSplitMergeApplyStatus: phaseVolumeSplitMergeApply.status ?? null,
    preservePhaseSlots: preservePhaseSlots === true,
    applyRowCount,
    applyStrideFloats: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS,
    allocationRowLayout: [...SCHROEDER_PARTICLE_STORAGE_ALLOCATION_ROW_LAYOUT],
    allocationStrideFloats: SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS,
    allocationStrideBytes: SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    allocationByteLength,
    outputCompaction: 'one-admitted-particle-storage-allocation-row-per-apply-row',
    admission,
    particleStorageAllocatorAdmissionSchema: admission.schema,
    particleStorageAllocatorAdmissionStatus: admission.status,
    particleStorageAllocatorAdmissionApproved: admission.approved,
    particleStorageAllocatorAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
    targetStateFamilies: [...SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES],
    targetStateFamilyMask: Math.max(0, finiteNumber(
      targetStateFamilyMask,
      SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK
    )),
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    allocatorEpoch: finiteNumber(allocatorEpoch, 0),
    currentParticleCapacity: Math.max(0, finiteNumber(currentParticleCapacity, applyRowCount)),
    requiredParticleCapacity: requiredCapacity,
    allocationMode: 'state-manager-admitted-slot-allocation-intents',
    slotAssignmentStatus: 'sentinel-slot-indices-await-free-list-compaction',
    particleStorageMutationStatus: admission.approved
      ? 'allocation-intents-ready-no-particle-buffer-resize'
      : 'blocked-particle-storage-allocator-admission-required',
    outputFamilies: [
      SCHROEDER_PARTICLE_STORAGE_ALLOCATION_OUTPUT_FAMILY,
      SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_OUTPUT_FAMILY
    ],
    stateMutationTarget: 'schroeder-retained-particle-storage-allocation-buffer',
    conservativeTransferStatus: admission.approved
      ? 'particle-storage-allocation-ready'
      : 'particle-storage-allocation-blocked-admission-required',
    stateMutationRequired: admission.approved,
    stateMutationStatus: admission.approved
      ? 'particle-storage-allocation-planned'
      : 'blocked-particle-storage-allocator-admission-required',
    stateAuthorityStatus: admission.approved
      ? 'state-manager-admission-present'
      : 'requires-state-manager-admission-before-particle-storage-allocation',
    conservedQuantities: ['mass', 'represented-volume', 'momentum-delta', 'internal-energy-delta'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederParticleStorageFreeListPlan({
  baseSlotIndex,
  slotCapacity,
  availableSlotCount,
  maxSlotsPerRow,
  committedEpoch,
  targetStateFamilyMask,
  freeListRows = null,
  freeListBuffer = null
} = {}) {
  const requestedBaseSlotIndex = baseSlotIndex ?? 0;
  const requestedSlotCapacity = slotCapacity ?? 0;
  const requestedAvailableSlotCount = availableSlotCount ?? requestedSlotCapacity;
  const requestedMaxSlotsPerRow = maxSlotsPerRow ?? 1;
  const requestedCommittedEpoch = committedEpoch ?? 0;
  const requestedTargetStateFamilyMask = targetStateFamilyMask ?? SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK;
  const rows = freeListRows instanceof Float32Array
    ? freeListRows
    : createSchroederParticleStorageFreeListRows({
      baseSlotIndex: requestedBaseSlotIndex,
      slotCapacity: requestedSlotCapacity,
      availableSlotCount: requestedAvailableSlotCount,
      maxSlotsPerRow: requestedMaxSlotsPerRow,
      committedEpoch: requestedCommittedEpoch,
      targetStateFamilyMask: requestedTargetStateFamilyMask
    });
  const normalizedBaseSlotIndex = Math.max(0, finiteNumber(baseSlotIndex ?? rows[0], 0));
  const normalizedSlotCapacity = Math.max(0, finiteNumber(slotCapacity ?? rows[1], 0));
  const normalizedAvailableSlotCount = Math.max(0, finiteNumber(
    availableSlotCount ?? rows[2],
    normalizedSlotCapacity
  ));
  const normalizedMaxSlotsPerRow = Math.max(1, finiteNumber(maxSlotsPerRow ?? rows[3], 1));
  const normalizedCommittedEpoch = finiteNumber(committedEpoch ?? rows[4], 0);
  const normalizedTargetStateFamilyMask = Math.max(0, finiteNumber(
    targetStateFamilyMask ?? rows[5],
    SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK
  ));
  const freeListByteLength = Math.max(
    4,
    SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_FREE_LIST_SCHEMA,
    status: 'schroeder-particle-storage-free-list-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-particle-storage-free-list-descriptor',
    freeListRowLayout: [...SCHROEDER_PARTICLE_STORAGE_FREE_LIST_ROW_LAYOUT],
    freeListStrideFloats: SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS,
    freeListStrideBytes: SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    freeListByteLength,
    baseSlotIndex: normalizedBaseSlotIndex,
    slotCapacity: normalizedSlotCapacity,
    availableSlotCount: normalizedAvailableSlotCount,
    maxSlotsPerRow: normalizedMaxSlotsPerRow,
    committedEpoch: normalizedCommittedEpoch,
    targetStateFamilyMask: normalizedTargetStateFamilyMask,
    targetStateFamilies: [...SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES],
    retainedFreeListBuffer: Boolean(freeListBuffer),
    freeListRows: freeListBuffer ? null : rows,
    freeListBuffer: freeListBuffer || null,
    committed: true,
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederParticleStorageSlotAssignmentPlan({
  particleStorageAllocation,
  particleStorageFreeList,
  particleStorageSlotAssignmentAdmission = null,
  assignmentEpoch = particleStorageAllocation?.allocatorEpoch ?? 0,
  stateFamilyId = particleStorageAllocation?.stateFamilyId ?? 1,
  targetStateFamilyMask = particleStorageAllocation?.targetStateFamilyMask
    ?? SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK
} = {}) {
  assertParticleStorageAllocationInput(particleStorageAllocation);
  assertParticleStorageFreeListInput(particleStorageFreeList);
  const allocationRowCount = Math.max(0, Math.round(finiteNumber(
    particleStorageAllocation.applyRowCount,
    0
  )));
  const admission = schroederParticleStorageSlotAssignmentAdmissionAllowsApplication({
    particleStorageSlotAssignmentAdmission,
    particleStorageAllocation,
    particleStorageFreeList,
    allocationRowCount
  });
  const slotAssignmentByteLength = Math.max(
    4,
    allocationRowCount * SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_SCHEMA,
    status: admission.approved
      ? 'schroeder-particle-storage-slot-assignment-plan-ready'
      : 'schroeder-particle-storage-slot-assignment-plan-blocked-admission-required',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-particle-storage-slot-assignment',
    sourceParticleStorageAllocationSchema: particleStorageAllocation.schema,
    sourceParticleStorageAllocationStatus: particleStorageAllocation.status ?? null,
    preservePhaseSlots: particleStorageAllocation.preservePhaseSlots === true,
    sourceParticleStorageFreeListSchema: particleStorageFreeList.schema,
    sourceParticleStorageFreeListStatus: particleStorageFreeList.status ?? null,
    allocationRowCount,
    allocationStrideFloats: SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS,
    freeListStrideFloats: SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS,
    slotAssignmentRowLayout: [...SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ROW_LAYOUT],
    slotAssignmentStrideFloats: SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS,
    slotAssignmentStrideBytes: SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    slotAssignmentByteLength,
    outputCompaction: 'one-admitted-slot-assignment-row-per-allocation-row',
    admission,
    particleStorageSlotAssignmentAdmissionSchema: admission.schema,
    particleStorageSlotAssignmentAdmissionStatus: admission.status,
    particleStorageSlotAssignmentAdmissionApproved: admission.approved,
    particleStorageSlotAssignmentAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
    targetStateFamilies: [...SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES],
    targetStateFamilyMask: Math.max(0, finiteNumber(
      targetStateFamilyMask,
      SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK
    )),
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    assignmentEpoch: finiteNumber(assignmentEpoch, 0),
    assignmentMode: 'state-manager-admitted-free-list-slot-assignment',
    particleStorageMutationStatus: admission.approved
      ? 'slot-assignments-ready-no-particle-buffer-write'
      : 'blocked-particle-storage-slot-assignment-admission-required',
    outputFamilies: [
      SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_OUTPUT_FAMILY,
      SCHROEDER_PARTICLE_STORAGE_ALLOCATION_OUTPUT_FAMILY
    ],
    stateMutationTarget: 'schroeder-retained-particle-storage-slot-assignment-buffer',
    conservativeTransferStatus: admission.approved
      ? 'particle-storage-slot-assignment-ready'
      : 'particle-storage-slot-assignment-blocked-admission-required',
    stateMutationRequired: admission.approved,
    stateMutationStatus: admission.approved
      ? 'particle-storage-slot-assignment-planned'
      : 'blocked-particle-storage-slot-assignment-admission-required',
    stateAuthorityStatus: admission.approved
      ? 'state-manager-admission-present'
      : 'requires-state-manager-admission-before-particle-storage-slot-assignment',
    conservedQuantities: ['mass', 'represented-volume', 'momentum-delta', 'internal-energy-delta'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederParticleStorageMaterializationPlan({
  sphParticleState,
  mlsMpmParticleState,
  particleStorageSlotAssignment,
  particleStorageMaterializationAdmission = null,
  outputParticleCapacity = null,
  materializationEpoch = particleStorageSlotAssignment?.assignmentEpoch ?? 0,
  stateFamilyId = particleStorageSlotAssignment?.stateFamilyId ?? 1,
  targetStateFamilyMask = particleStorageSlotAssignment?.targetStateFamilyMask
    ?? SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  assertParticleStorageSlotAssignmentInput(particleStorageSlotAssignment);
  if (particleStorageSlotAssignment.preservePhaseSlots === true) {
    throw new TypeError('Fixed phase-slot assignments require a phase-aware materializer');
  }
  const assignmentRowCount = Math.max(0, Math.round(finiteNumber(
    particleStorageSlotAssignment.allocationRowCount,
    0
  )));
  const sourceParticleCount = Math.max(0, Math.round(finiteNumber(
    sphParticleState.particleCount,
    0
  )));
  const admittedCapacity = Math.max(
    sourceParticleCount,
    Math.round(finiteNumber(
      outputParticleCapacity
        ?? particleStorageMaterializationAdmission?.requiredParticleCapacity
        ?? particleStorageMaterializationAdmission?.particleCapacity
        ?? particleStorageSlotAssignment.freeListCapacity
        ?? sourceParticleCount,
      sourceParticleCount
    ))
  );
  const admission = schroederParticleStorageMaterializationAdmissionAllowsApplication({
    particleStorageMaterializationAdmission,
    particleStorageSlotAssignment,
    assignmentRowCount
  });
  const stateByteLength = Math.max(
    4,
    admittedCapacity * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  const thermoByteLength = Math.max(
    4,
    admittedCapacity * SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  const mechanicsByteLength = Math.max(
    4,
    admittedCapacity * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  const identityByteLength = Math.max(
    Uint32Array.BYTES_PER_ELEMENT,
    admittedCapacity * SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT
  );
  const materializationByteLength = Math.max(
    4,
    assignmentRowCount * SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_SCHEMA,
    status: admission.approved
      ? 'schroeder-particle-storage-materialization-plan-ready'
      : 'schroeder-particle-storage-materialization-plan-blocked-admission-required',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-particle-storage-materialization',
    sourceParticleStorageSlotAssignmentSchema: particleStorageSlotAssignment.schema,
    sourceParticleStorageSlotAssignmentStatus: particleStorageSlotAssignment.status ?? null,
    assignmentRowCount,
    assignmentStrideFloats: SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS,
    materializationRowLayout: [...SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ROW_LAYOUT],
    materializationStrideFloats: SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS,
    materializationStrideBytes: SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS
      * Float32Array.BYTES_PER_ELEMENT,
    materializationByteLength,
    outputCompaction: 'one-admitted-particle-storage-materialization-row-per-assignment-row',
    admission,
    particleStorageMaterializationAdmissionSchema: admission.schema,
    particleStorageMaterializationAdmissionStatus: admission.status,
    particleStorageMaterializationAdmissionApproved: admission.approved,
    particleIdentityMutationApproved: admission.particleIdentityMutationApproved === true,
    particleStorageMaterializationAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
    targetStateFamilies: [...SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES],
    targetStateFamilyMask: Math.max(0, finiteNumber(
      targetStateFamilyMask,
      SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK
    )),
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    materializationEpoch: finiteNumber(materializationEpoch, 0),
    sourceParticleCount,
    outputParticleCapacity: admittedCapacity,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    identityStrideUints: SPH_GPU_PARTICLE_IDENTITY_UINTS,
    stateStrideVec4s: SPH_GPU_PARTICLE_STATE_FLOATS / 4,
    thermoStrideVec4s: SPH_GPU_PARTICLE_THERMO_FLOATS / 4,
    mechanicsStrideVec4s: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS / 4,
    stateByteLength,
    thermoByteLength,
    mechanicsByteLength,
    identityByteLength,
    identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
    identityRequired: sphParticleStateRequiresExplicitIdentity(sphParticleState),
    materializationMode: 'state-manager-admitted-particle-buffer-materialization',
    replacementPolicy: 'retained-output-buffers-await-state-manager-swap',
    particleStorageMutationStatus: admission.approved
      ? 'particle-buffers-materialization-ready'
      : 'blocked-particle-storage-materialization-admission-required',
    outputFamilies: [
      SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_OUTPUT_FAMILY,
      SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_OUTPUT_FAMILY,
      ...SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES
    ],
    stateMutationTarget: 'schroeder-retained-particle-state-mechanics-thermo-identity-buffers',
    conservativeTransferStatus: admission.approved
      ? 'particle-storage-materialization-ready'
      : 'particle-storage-materialization-blocked-admission-required',
    stateMutationRequired: admission.approved,
    stateMutationStatus: admission.approved
      ? 'particle-storage-materialization-planned'
      : 'blocked-particle-storage-materialization-admission-required',
    stateAuthorityStatus: admission.approved
      ? 'state-manager-admission-present'
      : 'requires-state-manager-admission-before-particle-buffer-materialization',
    conservedQuantities: ['mass', 'represented-volume', 'momentum-delta', 'internal-energy-delta'],
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

export function createSchroederPhaseVolumeLevelUpdateAssignmentOverlayPlan({
  phaseVolumeLevelUpdate,
  levelAssignment = null,
  selectedLevel = 0
} = {}) {
  assertPhaseVolumeLevelUpdateInput(phaseVolumeLevelUpdate);
  const levelUpdateRowCount = Math.max(0, Math.round(finiteNumber(
    phaseVolumeLevelUpdate.migrationRowCount,
    0
  )));
  const particleCount = Math.max(0, Math.round(finiteNumber(
    levelAssignment?.particleCount,
    phaseVolumeLevelUpdate.particleCount ?? levelUpdateRowCount
  )));
  const retainedLevelUpdateBuffer = Boolean(phaseVolumeLevelUpdate.levelUpdateBuffer);
  const explicitLevelUpdateRows = phaseVolumeLevelUpdate.levelUpdateRows instanceof Float32Array;
  const rowAlignedWithParticles = particleCount === 0 || levelUpdateRowCount >= particleCount;
  const overlayAvailable = retainedLevelUpdateBuffer || explicitLevelUpdateRows;
  const status = overlayAvailable
    ? 'schroeder-phase-volume-level-update-assignment-overlay-ready'
    : 'schroeder-phase-volume-level-update-assignment-overlay-blocked-retained-buffer-required';
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA,
    status,
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-active-node-level-selection',
    sourcePhaseVolumeLevelUpdateSchema: phaseVolumeLevelUpdate.schema,
    sourcePhaseVolumeLevelUpdateStatus: phaseVolumeLevelUpdate.status ?? null,
    sourceLevelAssignmentSchema: levelAssignment?.schema ?? null,
    sourceLevelAssignmentStatus: levelAssignment?.status ?? null,
    selectedLevel: Math.round(finiteNumber(selectedLevel, 0)),
    selectedLevelSource: overlayAvailable
      ? 'state-manager-admitted-phase-volume-level-update'
      : 'configured-selected-schroeder-level',
    nativeLevelSource: overlayAvailable
      ? 'phase-volume-level-update-target-level'
      : 'level-assignment-native-support-radius',
    phaseVolumeAssignmentOverlayEnabled: overlayAvailable,
    rowAlignedWithParticles,
    overlayIndexMode: rowAlignedWithParticles
      ? 'row-aligned-source-particle-index'
      : 'sparse-source-particle-index-required',
    sparseOverlayIndexRequired: !rowAlignedWithParticles,
    sparseOverlayIndexStatus: rowAlignedWithParticles
      ? 'not-required-row-aligned-level-update-rows'
      : 'required-for-sparse-phase-volume-level-update-rows',
    levelSelectionMode: 'target-level-overrides-level-assignment-when-admitted',
    levelUpdateRowCount,
    phaseVolumeAssignmentOverlayRowCount: levelUpdateRowCount,
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    phaseVolumeAssignmentOverlayStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    retainedLevelUpdateBuffer,
    retainedPhaseVolumeAssignmentOverlayBuffer: retainedLevelUpdateBuffer,
    levelUpdateBufferByteLength: phaseVolumeLevelUpdate.levelUpdateBufferByteLength
      ?? phaseVolumeLevelUpdate.levelUpdateByteLength
      ?? levelUpdateRowCount * SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    descriptorOnly: true,
    sameDeviceOnly: true,
    peerComputePortable: true,
    transferMode: 'descriptor-only-same-device-retained-buffer-ref',
    retainedBufferRef: 'schroeder-phase-volume-level-update:assignment-overlay-source',
    rawGpuBufferTransferAllowed: false,
    fullReadbackRequired: false,
    fullParticleReadbackRequired: false,
    normalHotLoopReadbackFree: true,
    consumerStatus: overlayAvailable
      ? 'phase-volume-level-update-assignment-overlay-ready-for-active-node-selection'
      : 'disabled-phase-volume-level-update-overlay-not-provided',
    levelUpdateBuffer: phaseVolumeLevelUpdate.levelUpdateBuffer || null,
    levelUpdateRows: explicitLevelUpdateRows ? phaseVolumeLevelUpdate.levelUpdateRows : null
  };
}

function assertPhaseVolumeAssignmentOverlayInput(phaseVolumeAssignmentOverlay) {
  if (phaseVolumeAssignmentOverlay?.schema !== ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA) {
    throw new TypeError('Schroeder active node list requires a Schroeder phase-volume assignment overlay input');
  }
  const rowCount = Math.max(0, Math.round(finiteNumber(
    phaseVolumeAssignmentOverlay.phaseVolumeAssignmentOverlayRowCount
      ?? phaseVolumeAssignmentOverlay.levelUpdateRowCount,
    0
  )));
  if (phaseVolumeAssignmentOverlay.phaseVolumeAssignmentOverlayEnabled && rowCount <= 0) {
    throw new RangeError('Schroeder phase-volume assignment overlay requires at least one level-update row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    phaseVolumeAssignmentOverlay.phaseVolumeAssignmentOverlayStrideFloats
      ?? phaseVolumeAssignmentOverlay.levelUpdateStrideFloats,
    SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS
  )));
  if (stride !== SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS) {
    throw new RangeError('Schroeder phase-volume assignment overlay requires the current level-update row layout');
  }
}

export function normalizeSchroederPhaseVolumeAssignmentOverlay({
  phaseVolumeAssignmentOverlay = null,
  phaseVolumeLevelUpdate = null,
  levelAssignment = null,
  selectedLevel = 0
} = {}) {
  if (phaseVolumeAssignmentOverlay) {
    assertPhaseVolumeAssignmentOverlayInput(phaseVolumeAssignmentOverlay);
    return phaseVolumeAssignmentOverlay;
  }
  if (!phaseVolumeLevelUpdate) {
    return null;
  }
  return createSchroederPhaseVolumeLevelUpdateAssignmentOverlayPlan({
    phaseVolumeLevelUpdate,
    levelAssignment,
    selectedLevel
  });
}

function summarizeSchroederPhaseVolumeAssignmentOverlay(phaseVolumeAssignmentOverlay) {
  if (!phaseVolumeAssignmentOverlay) {
    return {
      schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA,
      status: 'disabled-phase-volume-level-update-overlay-not-provided',
      phaseVolumeAssignmentOverlayEnabled: false,
      consumerStatus: 'disabled-phase-volume-level-update-overlay-not-provided',
      rowCount: 0,
      strideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
      retainedBuffer: false,
      rowAlignedWithParticles: false,
      sparseOverlayIndexRequired: false,
      nativeLevelSource: 'level-assignment-native-support-radius',
      selectedLevelSource: 'configured-selected-schroeder-level',
      rawGpuBufferTransferAllowed: false,
      fullParticleReadbackRequired: false
    };
  }
  return {
    schema: phaseVolumeAssignmentOverlay.schema,
    status: phaseVolumeAssignmentOverlay.status,
    sourcePhaseVolumeLevelUpdateSchema: phaseVolumeAssignmentOverlay.sourcePhaseVolumeLevelUpdateSchema ?? null,
    sourcePhaseVolumeLevelUpdateStatus: phaseVolumeAssignmentOverlay.sourcePhaseVolumeLevelUpdateStatus ?? null,
    phaseVolumeAssignmentOverlayEnabled: phaseVolumeAssignmentOverlay.phaseVolumeAssignmentOverlayEnabled === true,
    consumerStatus: phaseVolumeAssignmentOverlay.phaseVolumeAssignmentOverlayEnabled
      ? 'phase-volume-level-update-assignment-overlay-consumed-by-active-node-selection'
      : (phaseVolumeAssignmentOverlay.consumerStatus ?? 'disabled-phase-volume-level-update-overlay-not-provided'),
    rowCount: phaseVolumeAssignmentOverlay.phaseVolumeAssignmentOverlayRowCount
      ?? phaseVolumeAssignmentOverlay.levelUpdateRowCount
      ?? 0,
    strideFloats: phaseVolumeAssignmentOverlay.phaseVolumeAssignmentOverlayStrideFloats
      ?? phaseVolumeAssignmentOverlay.levelUpdateStrideFloats
      ?? SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    retainedBuffer: Boolean(phaseVolumeAssignmentOverlay.levelUpdateBuffer),
    rowAlignedWithParticles: phaseVolumeAssignmentOverlay.rowAlignedWithParticles === true,
    sparseOverlayIndexRequired: phaseVolumeAssignmentOverlay.sparseOverlayIndexRequired === true,
    overlayIndexMode: phaseVolumeAssignmentOverlay.overlayIndexMode ?? null,
    sparseOverlayIndexStatus: phaseVolumeAssignmentOverlay.sparseOverlayIndexStatus ?? null,
    nativeLevelSource: phaseVolumeAssignmentOverlay.nativeLevelSource ?? 'level-assignment-native-support-radius',
    selectedLevelSource: phaseVolumeAssignmentOverlay.selectedLevelSource ?? 'configured-selected-schroeder-level',
    transferMode: phaseVolumeAssignmentOverlay.transferMode ?? 'descriptor-only-same-device-retained-buffer-ref',
    retainedBufferRef: phaseVolumeAssignmentOverlay.retainedBufferRef ?? null,
    rawGpuBufferTransferAllowed: phaseVolumeAssignmentOverlay.rawGpuBufferTransferAllowed === true,
    fullParticleReadbackRequired: phaseVolumeAssignmentOverlay.fullParticleReadbackRequired === true
  };
}

function assertPhaseVolumeAssignmentOverlayIndexInput(phaseVolumeAssignmentOverlayIndex, particleCount = 0) {
  if (
    phaseVolumeAssignmentOverlayIndex?.schema !== ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_EXECUTION_SCHEMA
    && phaseVolumeAssignmentOverlayIndex?.schema !== ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_SCHEMA
  ) {
    throw new TypeError('Schroeder active node list requires a Schroeder phase-volume assignment overlay index input');
  }
  const indexParticleCount = Math.max(0, Math.round(finiteNumber(
    phaseVolumeAssignmentOverlayIndex.particleCount,
    0
  )));
  const requiredParticleCount = Math.max(0, Math.round(finiteNumber(particleCount, 0)));
  if (requiredParticleCount > 0 && indexParticleCount < requiredParticleCount) {
    throw new RangeError('Schroeder phase-volume assignment overlay index must cover every active particle');
  }
  if (phaseVolumeAssignmentOverlayIndex.indexStrideUints !== 1) {
    throw new RangeError('Schroeder phase-volume assignment overlay index requires one u32 row per particle');
  }
}

export function createSchroederPhaseVolumeAssignmentOverlayIndexPlan({
  phaseVolumeAssignmentOverlay,
  levelAssignment
} = {}) {
  assertPhaseVolumeAssignmentOverlayInput(phaseVolumeAssignmentOverlay);
  assertLevelAssignmentInput(levelAssignment);
  const particleCount = Math.max(0, Math.round(finiteNumber(levelAssignment.particleCount, 0)));
  const rowCount = Math.max(0, Math.round(finiteNumber(
    phaseVolumeAssignmentOverlay.phaseVolumeAssignmentOverlayRowCount
      ?? phaseVolumeAssignmentOverlay.levelUpdateRowCount,
    0
  )));
  const indexByteLength = Math.max(4, particleCount * Uint32Array.BYTES_PER_ELEMENT);
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_SCHEMA,
    status: 'schroeder-phase-volume-assignment-overlay-index-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-phase-volume-assignment-overlay-index',
    sourcePhaseVolumeAssignmentOverlaySchema: phaseVolumeAssignmentOverlay.schema,
    sourcePhaseVolumeAssignmentOverlayStatus: phaseVolumeAssignmentOverlay.status ?? null,
    sourcePhaseVolumeLevelUpdateSchema: phaseVolumeAssignmentOverlay.sourcePhaseVolumeLevelUpdateSchema ?? null,
    sourceLevelAssignmentSchema: levelAssignment.schema,
    sourceLevelAssignmentStatus: levelAssignment.status ?? null,
    particleCount,
    phaseVolumeAssignmentOverlayRowCount: rowCount,
    phaseVolumeAssignmentOverlayStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    indexStrideUints: 1,
    indexByteLength,
    missingRow: SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_MISSING_ROW,
    duplicateSourcePolicy: 'atomic-min-first-admitted-row-wins',
    outputCompaction: 'one-u32-level-update-row-index-per-particle',
    retainedIndexBufferRef: 'schroeder-phase-volume-assignment-overlay-index:source-particle-row-map',
    descriptorOnly: true,
    sameDeviceOnly: true,
    peerComputePortable: true,
    transferMode: 'descriptor-only-same-device-retained-buffer-ref',
    rawGpuBufferTransferAllowed: false,
    fullReadbackRequired: false,
    fullParticleReadbackRequired: false,
    normalHotLoopReadbackFree: true
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
    refinePressurePolicy: 'compact-summary-count-and-reason-mask-no-particle-readback',
    refinePressureReasonBits: [...SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS],
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
  sourceFamily = null,
  schema = artifact?.schema ?? null,
  status = artifact?.status ?? null,
  rowCount = 0,
  strideFloats = 0,
  byteLength = 0,
  retained = false,
  role = null,
  retainedBufferRef = null
} = {}) {
  const resolvedFamily = String(family || '').trim();
  const resolvedRole = String(role || '').trim();
  const resolvedRetainedBufferRef = retainedBufferRef
    || artifact?.retainedBufferRef
    || artifact?.resourceKey
    || (retained && resolvedFamily
      ? `${resolvedFamily}:${resolvedRole || 'default'}`
      : null);
  const finalCommittedSource = Boolean(
    sourceFamily?.ready === true
    && sourceFamily.authenticated === true
    && sourceFamily.sourceFamilyRole
      === 'committed-successor-x-n-plus-1'
    && sourceFamily.successorEpochIdentity
  );
  const sourceGenerationId = finalCommittedSource
    ? sourceFamily.sourceGenerationId
    : (artifact?.spatialEpochGenerationId
      ?? artifact?.sourceGenerationId
      ?? artifact?.generationId
      ?? null);
  const sourceEpochIdentity = finalCommittedSource
    ? sourceFamily.successorEpochIdentity
    : Object.freeze({
        storageGeneration:
          artifact?.spatialEpochStorageGeneration
          ?? artifact?.storageGeneration
          ?? null,
        physicsTick:
          artifact?.spatialEpochPhysicsTick ?? artifact?.physicsTick ?? null,
        physicsSubstep:
          artifact?.spatialEpochPhysicsSubstep
          ?? artifact?.physicsSubstep
          ?? null,
        positionEpoch:
          artifact?.spatialEpochPositionEpoch ?? artifact?.positionEpoch ?? null,
        topologyEpoch:
          artifact?.spatialEpochTopologyEpoch ?? artifact?.topologyEpoch ?? null,
        chartEpoch:
          artifact?.spatialEpochChartEpoch ?? artifact?.chartEpoch ?? null,
        levelEpoch:
          artifact?.spatialEpochLevelEpoch ?? artifact?.levelEpoch ?? null,
        supportEpoch:
          artifact?.spatialEpochSupportEpoch ?? artifact?.supportEpoch ?? null
      });
  return {
    family,
    role,
    sourceFamily: finalCommittedSource ? sourceFamily : null,
    sourceFamilyStatus: finalCommittedSource ? sourceFamily.status : null,
    sourceDeviceId: finalCommittedSource ? sourceFamily.deviceId : null,
    sourceFamilyRole: finalCommittedSource
      ? sourceFamily.sourceFamilyRole
      : 'canonical-pre-integration-x-n',
    sourceGenerationId,
    sourceEpochIdentity,
    positionAuthority: finalCommittedSource
      ? sourceFamily.positionAuthority
      : 'same-epoch-pre-integration-particle-state',
    finalContinuationAuthority: finalCommittedSource,
    coherentSolidAuthority: finalCommittedSource,
    schema,
    status,
    rowCount: Math.max(0, Math.round(finiteNumber(rowCount, 0))),
    strideFloats: Math.max(0, Math.round(finiteNumber(strideFloats, 0))),
    byteLength: Math.max(0, Math.round(finiteNumber(byteLength, 0))),
    retained: Boolean(retained),
    retainedBufferRef: resolvedRetainedBufferRef,
    transferMode: 'descriptor-only-no-raw-gpubuffer-transfer'
  };
}

function schroederLocalRetainedRenderBufferDescriptor({
  family,
  role,
  artifact = null,
  sourceFamily = null,
  buffer = null,
  rowCount = 0,
  strideFloats = 0,
  byteLength = 0
} = {}) {
  if (!buffer) return null;
  const retainedRef = schroederPortableRetainedRef({
    family,
    role,
    artifact,
    sourceFamily,
    rowCount,
    strideFloats,
    byteLength,
    retained: true
  });
  return {
    ...retainedRef,
    buffer,
    gpuBuffer: buffer,
    resourceKey: retainedRef.retainedBufferRef,
    sameDeviceOnly: true,
    peerComputePortable: false,
    descriptorOnlyPeerComputeHandoff: true,
    rawGpuBufferTransferAllowed: false,
    transferMode: 'same-device-local-resolver-no-peer-transfer'
  };
}

export function createSchroederLocalRetainedRenderBufferResolverSummary({
  activeNodeList = null,
  hierarchyAggregateNode = null,
  sourceFamily = null,
  ownsActiveNodeList = false,
  ownsHierarchyAggregateNode = false,
  releaseRetainedBuffers = null
} = {}) {
  const buffers = [
    schroederLocalRetainedRenderBufferDescriptor({
      family: 'schroeder-active-node-list',
      role: 'render-lod-leaf-source',
      artifact: activeNodeList,
      sourceFamily,
      buffer: activeNodeList?.activeNodeBuffer || null,
      rowCount: activeNodeList?.activeCandidateCount ?? activeNodeList?.particleCount,
      strideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
      byteLength: activeNodeList?.activeNodeBufferByteLength ?? activeNodeList?.activeNodeByteLength
    }),
    schroederLocalRetainedRenderBufferDescriptor({
      family: 'schroeder-hierarchy-aggregate-node',
      role: 'spatial-aggregate-render-proxy-source',
      artifact: hierarchyAggregateNode,
      sourceFamily,
      buffer: hierarchyAggregateNode?.aggregateNodeBuffer || null,
      rowCount: hierarchyAggregateNode?.aggregateNodeCount ?? hierarchyAggregateNode?.aggregateRowCount,
      strideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
      byteLength: hierarchyAggregateNode?.aggregateNodeBufferByteLength
        ?? hierarchyAggregateNode?.aggregateNodeByteLength
    })
  ].filter(Boolean);
  const releasedFamilies = new Set();
  const destroyRetainedBuffers = ({
    families = null,
    queueOrderedFinalConsumer = null
  } = {}) => {
    const requestedFamilies = new Set(
      families == null ? buffers.map((entry) => entry.family) : (Array.isArray(families) ? families : [families])
    );
    const pendingFamilies = [...requestedFamilies].filter((family) => !releasedFamilies.has(family));
    if (pendingFamilies.length === 0) return false;
    let completion = true;
    if (typeof releaseRetainedBuffers === 'function') {
      completion = releaseRetainedBuffers({
        families: pendingFamilies,
        queueOrderedFinalConsumer
      });
    } else {
      if (pendingFamilies.includes('schroeder-active-node-list') && ownsActiveNodeList) {
        activeNodeList?.destroyActiveNodeBuffer?.();
      }
      if (
        pendingFamilies.includes('schroeder-hierarchy-aggregate-node')
        && ownsHierarchyAggregateNode
      ) {
        hierarchyAggregateNode?.destroyAggregateNodeBuffer?.();
      }
    }
    for (const family of pendingFamilies) releasedFamilies.add(family);
    return completion ?? true;
  };
  return {
    schema: 'peercompute.ulg.schroeder-local-retained-render-buffer-resolver.v0',
    status: buffers.length > 0
      ? 'schroeder-local-retained-render-buffers-ready'
      : 'schroeder-local-retained-render-buffers-empty',
    source: 'same-device-schroeder-execution-artifacts',
    sourceFamily:
      sourceFamily?.ready === true && sourceFamily.authenticated === true
        ? sourceFamily
        : null,
    sourceFamilyStatus:
      sourceFamily?.ready === true && sourceFamily.authenticated === true
        ? sourceFamily.status
        : null,
    sourceDeviceId:
      sourceFamily?.ready === true && sourceFamily.authenticated === true
        ? sourceFamily.deviceId
        : null,
    sourceFamilyRole:
      sourceFamily?.ready === true && sourceFamily.authenticated === true
        ? sourceFamily.sourceFamilyRole
        : 'canonical-pre-integration-x-n',
    positionAuthority:
      sourceFamily?.ready === true && sourceFamily.authenticated === true
        ? sourceFamily.positionAuthority
        : 'same-epoch-pre-integration-particle-state',
    finalContinuationAuthority:
      sourceFamily?.ready === true && sourceFamily.authenticated === true,
    coherentSolidAuthority:
      sourceFamily?.ready === true && sourceFamily.authenticated === true,
    sourceGenerationId:
      buffers[0]?.sourceGenerationId
      ?? buffers[1]?.sourceGenerationId
      ?? null,
    sourceEpochIdentity:
      buffers[0]?.sourceEpochIdentity
      ?? buffers[1]?.sourceEpochIdentity
      ?? null,
    sameDeviceOnly: true,
    peerComputePortable: false,
    descriptorOnlyPeerComputeHandoff: true,
    rawGpuBufferTransferAllowed: false,
    rawGpuBufferTransferRequired: false,
    frameCopyReadbackRequired: false,
    fullParticleReadbackRequired: false,
    bufferCount: buffers.length,
    scopedFamilyRelease: true,
    retainedBufferRefs: buffers.map((entry) => entry.retainedBufferRef),
    buffers,
    ownedBufferCount: Number(ownsActiveNodeList && activeNodeList?.activeNodeBuffer)
      + Number(ownsHierarchyAggregateNode && hierarchyAggregateNode?.aggregateNodeBuffer),
    destroyRetainedBuffers,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function createSchroederPortableSummaryPlan({
  levelAssignment = null,
  activeNodeList,
  activeNodeIndex = null,
  activeNodeSortedIndex = null,
  lawQueue = null,
  lawNeighborCandidates = null,
  farAggregateCandidates = null,
  farAggregateForceSummary = null,
  farAggregateDiagnosticSummary = null,
  farAggregateLawConsumer = null,
  farAggregateLawConsumerDiagnosticSummary = null,
  farAggregateLawConsumerAuthorityPolicy = null,
  farAggregateGasStateDelta = null,
  farAggregateGasCellImport = null,
  farAggregateForceApplication = null,
  hierarchyAggregateNode = null,
  conservationSummary = null,
  phaseVolumeDiagnosticSummary = null,
  sourceFamily = null,
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
  if (farAggregateCandidates) assertFarAggregateCandidateInput(farAggregateCandidates);
  if (farAggregateForceSummary) assertFarAggregateForceSummaryInput(farAggregateForceSummary);
  if (farAggregateDiagnosticSummary) assertFarAggregateDiagnosticSummaryInput(farAggregateDiagnosticSummary);
  if (farAggregateLawConsumer) assertFarAggregateLawConsumerInput(farAggregateLawConsumer);
  if (farAggregateLawConsumerDiagnosticSummary) {
    assertFarAggregateLawConsumerDiagnosticSummaryInput(farAggregateLawConsumerDiagnosticSummary);
  }
  if (farAggregateGasStateDelta) assertFarAggregateGasStateDeltaInput(farAggregateGasStateDelta);
  if (farAggregateGasCellImport) {
    if (
      farAggregateGasCellImport.schema !== ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA
      && farAggregateGasCellImport.schema !== ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA
    ) {
      throw new TypeError('Schroeder portable summary requires a Schroeder far-aggregate gas-cell import input');
    }
  }
  if (farAggregateForceApplication) assertFarAggregateForceApplicationInput(farAggregateForceApplication);
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
  const farAggregateCandidateCount = Math.max(0, Math.round(finiteNumber(
    farAggregateCandidates?.farAggregateCandidateCount ?? farAggregateCandidates?.candidateCount,
    0
  )));
  const farAggregateForceSummaryCount = Math.max(0, Math.round(finiteNumber(
    farAggregateForceSummary?.forceSummaryRowCount ?? farAggregateForceSummary?.activeNodeCount,
    0
  )));
  const farAggregateDiagnosticSummaryCount = Math.max(0, Math.round(finiteNumber(
    farAggregateDiagnosticSummary?.diagnosticSummaryRowCount
      ?? farAggregateDiagnosticSummary?.summaryRowCount,
    0
  )));
  const farAggregateLawConsumerCount = Math.max(0, Math.round(finiteNumber(
    farAggregateLawConsumer?.lawConsumerRowCount ?? farAggregateLawConsumer?.forceSummaryRowCount,
    0
  )));
  const farAggregateLawConsumerDiagnosticSummaryCount = Math.max(0, Math.round(finiteNumber(
    farAggregateLawConsumerDiagnosticSummary?.lawConsumerDiagnosticSummaryRowCount
      ?? farAggregateLawConsumerDiagnosticSummary?.diagnosticSummaryRowCount
      ?? farAggregateLawConsumerDiagnosticSummary?.summaryRowCount,
    0
  )));
  const farAggregateGasStateDeltaCount = Math.max(0, Math.round(finiteNumber(
    farAggregateGasStateDelta?.gasStateDeltaRowCount
      ?? farAggregateGasStateDelta?.stateDeltaRowCount
      ?? farAggregateGasStateDelta?.lawConsumerRowCount,
    0
  )));
  const farAggregateGasCellImportCount = Math.max(0, Math.round(finiteNumber(
    farAggregateGasCellImport?.pressureInterfaceGasPressureCellRowCount
      ?? farAggregateGasCellImport?.gasPressureCellRowCount,
    0
  )));
  const farAggregateForceApplicationCount = Math.max(0, Math.round(finiteNumber(
    farAggregateForceApplication?.forceApplicationRowCount,
    0
  )));
  const phaseDiagnosticRowsAvailable = phaseVolumeDiagnosticSummary?.summaryRows instanceof Float32Array
    || Array.isArray(phaseVolumeDiagnosticSummary?.summaryRows);
  const finalCommittedSource = Boolean(
    sourceFamily?.ready === true
    && sourceFamily.authenticated === true
    && sourceFamily.sourceFamilyRole
      === 'committed-successor-x-n-plus-1'
    && sourceFamily.successorEpochIdentity
  );
  const retainedRef = (descriptor) => schroederPortableRetainedRef({
    ...descriptor,
    sourceFamily
  });
  const retainedRefs = [
    retainedRef({
      family: 'schroeder-level-assignment',
      role: 'native-scale-classification',
      artifact: levelAssignment,
      rowCount: levelAssignment?.particleCount,
      strideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
      byteLength: levelAssignment?.assignmentBufferByteLength ?? levelAssignment?.assignmentByteLength,
      retained: Boolean(levelAssignment?.assignmentBuffer)
    }),
    retainedRef({
      family: 'schroeder-active-node-list',
      role: 'render-lod-leaf-source',
      artifact: activeNodeList,
      rowCount: activeNodeCount,
      strideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
      byteLength: activeNodeList.activeNodeBufferByteLength ?? activeNodeList.activeNodeByteLength,
      retained: Boolean(activeNodeList.activeNodeBuffer)
    }),
    activeNodeIndex ? retainedRef({
      family: 'schroeder-active-node-index',
      role: 'small-scene-neighbor-accelerator',
      artifact: activeNodeIndex,
      rowCount: activeNodeIndex.bucketSlotCount,
      strideFloats: 1,
      byteLength: activeNodeIndex.bucketSlotByteLength,
      retained: Boolean(activeNodeIndex.bucketSlotBuffer)
    }) : null,
    activeNodeSortedIndex ? retainedRef({
      family: 'schroeder-active-node-sorted-index',
      role: 'sorted-radix-neighbor-accelerator',
      artifact: activeNodeSortedIndex,
      rowCount: activeNodeSortedIndex.activeNodeCount,
      strideFloats: 1,
      byteLength: activeNodeSortedIndex.sortedActiveIndexByteLength,
      retained: Boolean(activeNodeSortedIndex.sortedActiveIndexBuffer)
    }) : null,
    lawQueue ? retainedRef({
      family: 'schroeder-law-queue',
      role: 'near-field-law-work',
      artifact: lawQueue,
      rowCount: lawQueueCount,
      strideFloats: SCHROEDER_LAW_QUEUE_FLOATS,
      byteLength: lawQueue.lawQueueBufferByteLength ?? lawQueue.lawQueueByteLength,
      retained: Boolean(lawQueue.lawQueueBuffer)
    }) : null,
    lawNeighborCandidates ? retainedRef({
      family: 'schroeder-law-neighbor-candidate',
      role: 'near-field-law-candidates',
      artifact: lawNeighborCandidates,
      rowCount: lawNeighborCandidateCount,
      strideFloats: SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS,
      byteLength: lawNeighborCandidates.neighborCandidateBufferByteLength
        ?? lawNeighborCandidates.neighborCandidateByteLength,
      retained: Boolean(lawNeighborCandidates.neighborCandidateBuffer)
    }) : null,
    farAggregateCandidates ? retainedRef({
      family: 'schroeder-far-aggregate-candidate',
      role: 'aggregate-admissible-far-field-law-candidates',
      artifact: farAggregateCandidates,
      rowCount: farAggregateCandidateCount,
      strideFloats: SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS,
      byteLength: farAggregateCandidates.farAggregateCandidateBufferByteLength
        ?? farAggregateCandidates.farAggregateCandidateByteLength,
      retained: Boolean(farAggregateCandidates.farAggregateCandidateBuffer)
    }) : null,
    farAggregateForceSummary ? retainedRef({
      family: 'schroeder-far-aggregate-force-summary',
      role: 'read-only-far-field-force-summary',
      artifact: farAggregateForceSummary,
      rowCount: farAggregateForceSummaryCount,
      strideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
      byteLength: farAggregateForceSummary.forceSummaryBufferByteLength
        ?? farAggregateForceSummary.forceSummaryByteLength,
      retained: Boolean(farAggregateForceSummary.forceSummaryBuffer)
    }) : null,
    farAggregateDiagnosticSummary ? retainedRef({
      family: 'schroeder-far-aggregate-diagnostic-summary',
      role: 'far-field-force-quality-diagnostics',
      artifact: farAggregateDiagnosticSummary,
      rowCount: farAggregateDiagnosticSummaryCount,
      strideFloats: SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS,
      byteLength: farAggregateDiagnosticSummary.diagnosticSummaryBufferByteLength
        ?? farAggregateDiagnosticSummary.diagnosticSummaryByteLength,
      retained: Boolean(farAggregateDiagnosticSummary.diagnosticSummaryBuffer)
    }) : null,
    farAggregateLawConsumer ? retainedRef({
      family: 'schroeder-far-aggregate-law-consumer',
      role: 'read-only-radiation-plasma-gas-summary-consumers',
      artifact: farAggregateLawConsumer,
      rowCount: farAggregateLawConsumerCount,
      strideFloats: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
      byteLength: farAggregateLawConsumer.lawConsumerBufferByteLength
        ?? farAggregateLawConsumer.lawConsumerByteLength,
      retained: Boolean(farAggregateLawConsumer.lawConsumerBuffer)
    }) : null,
    farAggregateLawConsumerDiagnosticSummary ? retainedRef({
      family: 'schroeder-far-aggregate-law-consumer-diagnostic-summary',
      role: 'far-field-law-consumer-pressure-diagnostics',
      artifact: farAggregateLawConsumerDiagnosticSummary,
      rowCount: farAggregateLawConsumerDiagnosticSummaryCount,
      strideFloats: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS,
      byteLength: farAggregateLawConsumerDiagnosticSummary.lawConsumerDiagnosticSummaryBufferByteLength
        ?? farAggregateLawConsumerDiagnosticSummary.diagnosticSummaryBufferByteLength
        ?? farAggregateLawConsumerDiagnosticSummary.lawConsumerDiagnosticSummaryByteLength
        ?? farAggregateLawConsumerDiagnosticSummary.diagnosticSummaryByteLength,
      retained: Boolean(
        farAggregateLawConsumerDiagnosticSummary.lawConsumerDiagnosticSummaryBuffer
        || farAggregateLawConsumerDiagnosticSummary.diagnosticSummaryBuffer
      )
    }) : null,
    farAggregateGasStateDelta ? retainedRef({
      family: SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_OUTPUT_FAMILY,
      role: 'admitted-far-field-gas-pressure-state-deltas',
      artifact: farAggregateGasStateDelta,
      rowCount: farAggregateGasStateDeltaCount,
      strideFloats: SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS,
      byteLength: farAggregateGasStateDelta.gasStateDeltaBufferByteLength
        ?? farAggregateGasStateDelta.stateDeltaBufferByteLength
        ?? farAggregateGasStateDelta.gasStateDeltaByteLength
        ?? farAggregateGasStateDelta.stateDeltaByteLength,
      retained: Boolean(
        farAggregateGasStateDelta.gasStateDeltaBuffer
        || farAggregateGasStateDelta.stateDeltaBuffer
      )
    }) : null,
    farAggregateGasCellImport ? retainedRef({
      family: SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_OUTPUT_FAMILY,
      role: 'retained-pressure-interface-gas-cell-rows',
      artifact: farAggregateGasCellImport,
      rowCount: farAggregateGasCellImportCount,
      strideFloats: SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS,
      byteLength: farAggregateGasCellImport.pressureInterfaceGasPressureCellRowByteLength
        ?? farAggregateGasCellImport.gasPressureCellRowByteLength,
      retained: Boolean(
        farAggregateGasCellImport.gasPressureCellsBuffer
        || farAggregateGasCellImport.pressureInterfaceGasPressureCellsBuffer
      ),
      retainedBufferRef: farAggregateGasCellImport.retainedGasPressureBufferRefs?.[0]
        || farAggregateGasCellImport.retainedGasCellFieldSource?.retainedGasPressureBufferRefs?.[0]
        || null
    }) : null,
    farAggregateForceApplication ? retainedRef({
      family: 'schroeder-far-aggregate-force-application',
      role: 'admitted-far-field-force-application-deltas',
      artifact: farAggregateForceApplication,
      rowCount: farAggregateForceApplicationCount,
      strideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS,
      byteLength: farAggregateForceApplication.forceApplicationBufferByteLength
        ?? farAggregateForceApplication.forceApplicationByteLength,
      retained: Boolean(farAggregateForceApplication.forceApplicationBuffer)
    }) : null,
    hierarchyAggregateNode ? retainedRef({
      family: 'schroeder-hierarchy-aggregate-node',
      role: 'spatial-aggregate-render-proxy-source',
      artifact: hierarchyAggregateNode,
      rowCount: aggregateNodeCount,
      strideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
      byteLength: hierarchyAggregateNode.aggregateNodeBufferByteLength
        ?? hierarchyAggregateNode.aggregateNodeByteLength,
      retained: Boolean(hierarchyAggregateNode.aggregateNodeBuffer)
    }) : null,
    conservationSummary ? retainedRef({
      family: 'schroeder-conservation-summary',
      role: 'cross-level-residual-summary',
      artifact: conservationSummary,
      rowCount: conservationSummary.summaryRowCount,
      strideFloats: SCHROEDER_CONSERVATION_SUMMARY_FLOATS,
      byteLength: conservationSummary.summaryBufferByteLength ?? conservationSummary.summaryByteLength,
      retained: Boolean(conservationSummary.summaryBuffer)
    }) : null,
    phaseVolumeDiagnosticSummary ? retainedRef({
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
    sourceFamily: finalCommittedSource ? sourceFamily : null,
    sourceFamilyRole: finalCommittedSource
      ? sourceFamily.sourceFamilyRole
      : 'canonical-pre-integration-x-n',
    finalContinuationAuthority: finalCommittedSource,
    coherentSolidAuthority: finalCommittedSource,
    selectedLevel: Math.round(finiteNumber(selectedLevel, 0)),
    nativeGridSpacingM,
    activeLeafProxyCount: activeNodeCount,
    aggregateProxyCount: aggregateNodeCount,
    lawQueueProxyCount: lawQueueCount,
    farAggregateCandidateProxyCount: farAggregateCandidateCount,
    farAggregateForceSummaryCount,
    farAggregateDiagnosticSummaryCount,
    farAggregateLawConsumerCount,
    farAggregateLawConsumerDiagnosticSummaryCount,
    farAggregateGasStateDeltaCount,
    farAggregateGasCellImportCount,
    farAggregateForceApplicationCount,
    phaseVolumeDiagnosticRowsAvailable: phaseDiagnosticRowsAvailable,
    opticalPolicy: 'consume-closure-derived-optics-and-pbr-through-render-pipeline',
    geometryPolicy: aggregateNodeCount > 0
      ? 'spatial-aggregate-nodes-for-lod-active-nodes-for-leaves'
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
    sourceFamily: finalCommittedSource ? sourceFamily : null,
    sourceFamilyStatus: finalCommittedSource ? sourceFamily.status : null,
    sourceDeviceId: finalCommittedSource ? sourceFamily.deviceId : null,
    sourceFamilyRole: finalCommittedSource
      ? sourceFamily.sourceFamilyRole
      : 'canonical-pre-integration-x-n',
    sourceGenerationId:
      retainedRefs[0]?.sourceGenerationId ?? null,
    sourceEpochIdentity:
      retainedRefs[0]?.sourceEpochIdentity ?? null,
    positionAuthority: finalCommittedSource
      ? sourceFamily.positionAuthority
      : 'same-epoch-pre-integration-particle-state',
    finalContinuationAuthority: finalCommittedSource,
    coherentSolidAuthority: finalCommittedSource,
    summaryMode: 'descriptor-only-retained-buffer-summary',
    portableSummaryMode: 'portable-descriptors-not-raw-gpubuffers',
    selectedLevel: Math.round(finiteNumber(selectedLevel, 0)),
    nativeGridSpacingM,
    particleCount,
    activeNodeCount,
    aggregateNodeCount,
    lawQueueCount,
    lawNeighborCandidateCount,
    farAggregateCandidateCount,
    farAggregateForceSummaryCount,
    farAggregateDiagnosticSummaryCount,
    farAggregateLawConsumerCount,
    farAggregateLawConsumerDiagnosticSummaryCount,
    farAggregateGasStateDeltaCount,
    farAggregateGasCellImportCount,
    farAggregateForceApplicationCount,
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

export function createSchroederTwoLevelCoverageAdmission({
  levelAssignment,
  requestedFineLevel = 0,
  // Levels the mechanics consumer chains (an N-level chain of 2:1 pairs).
  // The two-level runner keeps 2; a chain consumer passes its level count.
  maxChainLevelCount = 2
} = {}) {
  const chainLevelCount = Number(maxChainLevelCount);
  if (!Number.isInteger(chainLevelCount) || chainLevelCount < 2) {
    throw new RangeError(
      'Authoritative coverage maxChainLevelCount must be an integer of at least 2'
    );
  }
  assertLevelAssignmentInput(levelAssignment);
  const particleCount = Math.max(
    0,
    Math.round(finiteNumber(levelAssignment.particleCount, 0))
  );
  const stride = Math.max(
    0,
    Math.round(finiteNumber(
      levelAssignment.assignmentStrideFloats,
      SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
    ))
  );
  if (stride !== SCHROEDER_LEVEL_ASSIGNMENT_FLOATS) {
    throw new RangeError(
      'Authoritative two-level coverage requires the current level-assignment row layout'
    );
  }
  const assignments = levelAssignment.assignments;
  const completeAssignmentRows =
    levelAssignment.fullReadbackPerformed === true
    && assignments instanceof Float32Array
    && assignments.length >= particleCount * stride;
  let coverageMinLevel;
  let coverageMaxLevel;
  let liveRowCount = null;
  let coverageSource;
  if (completeAssignmentRows) {
    liveRowCount = 0;
    for (let index = 0; index < particleCount; index += 1) {
      const offset = index * stride;
      const massKg = assignments[offset + 6];
      const supportRadiusM = assignments[offset + 2];
      const representedVolumeM3 = assignments[offset + 3];
      const restVolumeM3 = assignments[offset + 4];
      const currentVolumeM3 = assignments[offset + 5];
      const restDensityKgPerM3 = assignments[offset + 7];
      const active =
        massKg > 0
        && supportRadiusM >= 0
        && representedVolumeM3 >= 0
        && restVolumeM3 > 0
        && currentVolumeM3 > 0
        && restDensityKgPerM3 > 0;
      if (!active) continue;
      const level = assignments[offset];
      if (!Number.isInteger(level)) {
        const error = new Error(
          'Authoritative two-level coverage rejects a non-integer live assignment level'
        );
        error.code = 'ERR_SCHROEDER_TWO_LEVEL_COVERAGE_INVALID_ASSIGNMENT';
        error.particleIndex = index;
        throw error;
      }
      coverageMinLevel = coverageMinLevel == null
        ? level
        : Math.min(coverageMinLevel, level);
      coverageMaxLevel = coverageMaxLevel == null
        ? level
        : Math.max(coverageMaxLevel, level);
      liveRowCount += 1;
    }
    coverageSource = 'complete-level-assignment-readback';
  } else {
    coverageMinLevel = Math.round(finiteNumber(
      levelAssignment.minLevel,
      DEFAULT_MIN_LEVEL
    ));
    coverageMaxLevel = Math.round(finiteNumber(
      levelAssignment.maxLevel,
      DEFAULT_MAX_LEVEL
    ));
    coverageSource = 'classifier-clamp-range';
  }
  if (coverageMinLevel == null || coverageMaxLevel == null) {
    const fineLevel = Math.round(finiteNumber(requestedFineLevel, 0));
    return Object.freeze({
      schema: SCHROEDER_TWO_LEVEL_COVERAGE_ADMISSION_SCHEMA,
      status: 'schroeder-two-level-coverage-admitted-no-live-rows',
      admitted: true,
      requestedFineLevel: fineLevel,
      fineLevel,
      coarseLevel: fineLevel + 1,
      coverageMinLevel: null,
      coverageMaxLevel: null,
      coverageSource,
      liveRowCount,
      allLiveRowsCovered: true,
      readbackRequired: false
    });
  }
  if (coverageMaxLevel < coverageMinLevel) {
    throw new RangeError(
      'Authoritative two-level coverage requires an ordered classifier range'
    );
  }
  if (coverageMaxLevel - coverageMinLevel > chainLevelCount - 1) {
    const error = new Error(
      'Authoritative two-level mechanics cannot prove coverage for classifier '
        + `levels [${coverageMinLevel}, ${coverageMaxLevel}]; configure one `
        + `adjacent pair (minLevel=${coverageMinLevel}, `
        + `maxLevel=${coverageMinLevel + chainLevelCount - 1}) or use a mechanics hierarchy `
        + 'that covers every admitted level'
    );
    error.code = 'ERR_SCHROEDER_TWO_LEVEL_COVERAGE_UNPROVEN';
    error.coverageMinLevel = coverageMinLevel;
    error.coverageMaxLevel = coverageMaxLevel;
    error.recommendedFineLevel = coverageMinLevel;
    error.recommendedMinLevel = coverageMinLevel;
    error.recommendedMaxLevel = coverageMinLevel + chainLevelCount - 1;
    error.coverageSource = coverageSource;
    throw error;
  }
  return Object.freeze({
    schema: SCHROEDER_TWO_LEVEL_COVERAGE_ADMISSION_SCHEMA,
    status: 'schroeder-two-level-coverage-admitted',
    admitted: true,
    requestedFineLevel: Math.round(finiteNumber(requestedFineLevel, 0)),
    fineLevel: coverageMinLevel,
    coarseLevel: coverageMinLevel + 1,
    // The chained levels this admission covers, finest first.
    chainLevels: Object.freeze(Array.from(
      { length: Math.max(2, coverageMaxLevel - coverageMinLevel + 1) },
      (_, index) => coverageMinLevel + index
    )),
    coverageMinLevel,
    coverageMaxLevel,
    coverageSource,
    liveRowCount,
    allLiveRowsCovered: true,
    readbackRequired: false
  });
}

