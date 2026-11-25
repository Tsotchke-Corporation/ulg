// Extracted from schroederHierarchyGpu.js (Gate 6 Phase D mechanical decomposition).

import { validateSchroederSpatialMechanicsFieldViewDescriptor } from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
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
  schroederFarAggregateCandidateWgsl,
  schroederFarAggregateDiagnosticSummaryWgsl,
  schroederFarAggregateForceApplicationWgsl,
  schroederFarAggregateForceSummaryWgsl,
  schroederFarAggregateGasCellImportWgsl,
  schroederFarAggregateGasStateDeltaWgsl,
  schroederFarAggregateLawConsumerDiagnosticSummaryWgsl,
  schroederFarAggregateLawConsumerWgsl,
  schroederLevelAssignmentWgsl,
  schroederLawNeighborCandidateWgsl,
  schroederLawQueueWgsl,
  schroederParticleStorageAllocationWgsl,
  schroederParticleStorageMaterializationWgsl,
  schroederParticleStorageSlotAssignmentWgsl,
  schroederPhaseVolumeAssignmentOverlayIndexWgsl,
  schroederPhaseVolumeDiagnosticSummaryWgsl,
  schroederPhaseVolumeLevelUpdateWgsl,
  schroederPhaseVolumeMigrationWgsl,
  schroederPhaseVolumeSplitMergeApplyWgsl,
  schroederPhaseVolumeSplitMergeProposalWgsl,
  schroederPhaseVolumeTargetAggregateWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
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
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import {
  SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS,
  runSchroederSpatialMechanicalProposalWebGpu
} from './schroederSpatialMechanicalProposalsGpu.js';
import {
  SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY,
  SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_READER_PHASE,
  SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE,
  SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID,
  advanceSchroederSpatialEpochTransactionPrivate,
  abortSchroederSpatialEpochTransaction,
  admitSchroederSpatialEpochTransactionLateConsumer,
  admitSchroederSpatialEpochTransactionReader,
  commitSchroederSpatialEpochTransaction,
  createSchroederSingleLevelQueueOrderedCleanupCapability,
  createSchroederSpatialEpochTransaction,
  schroederSpatialEpochReaderRequiresExactNearCellTree,
  scheduleSchroederSpatialEpochTransactionRelease,
  sealSchroederSpatialEpochTransactionReaders,
  sealSchroederSpatialEpochTransactionProposals,
  summarizeSchroederSpatialEpochTransaction,
  validateSchroederSpatialEpochTransactionSourceFamily
} from './schroederSpatialEpochTransaction.js';

import {
  DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY,
  DEFAULT_AGGREGATE_NODE_BUCKET_SLOT_CAPACITY,
  DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE,
  DEFAULT_BASE_GRID_SPACING_M,
  DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD,
  DEFAULT_GAS_PHASE_ID,
  DEFAULT_HYSTERESIS_BAND,
  DEFAULT_MAX_LEVEL,
  DEFAULT_MIN_LEVEL,
  DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_ACCELERATION_PRESSURE_THRESHOLD,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_ACCELERATION_SCALE,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_MAX_ACCELERATION_M_PER_S2,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_FORCE_SCALE,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_DENSITY_SCALE,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_GAMMA,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_PRESSURE_SCALE,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_REFERENCE_PRESSURE_PA,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_GRAVITATIONAL_CONSTANT,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_CONSTANT_PROXY,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_PRESSURE_THRESHOLD,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_SUMMARY_SCALE,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_TEMPERATURE_K,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_PRESSURE_THRESHOLD,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_SCALE,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_PRESSURE_THRESHOLD,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_SCALE,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_NEAR_FIELD_SUPPORT_SCALE,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_SOFTENING_LENGTH_M,
  DEFAULT_SCHROEDER_LAW_NEIGHBOR_BUCKET_PRESSURE_RATIO_THRESHOLD,
  DEFAULT_SCHROEDER_LAW_NEIGHBOR_FALLBACK_SCAN_RATIO_THRESHOLD,
  DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET,
  DEFAULT_SUPPORT_INFLATE_CELLS,
  DEFAULT_SUPPORT_RADIUS_SCALE,
  DEFAULT_TARGET_SUPPORT_CELLS,
  DEFAULT_TILE_CELL_COUNT,
  GPU_BUFFER_USAGE,
  GPU_MAP_MODE,
  SCHROEDER_ACTIVE_NODE_FLOATS,
  SCHROEDER_ACTIVE_NODE_INDEX_WORKGROUP_SIZE,
  SCHROEDER_ACTIVE_NODE_SORTED_INDEX_WORKGROUP_SIZE,
  SCHROEDER_ACTIVE_NODE_WORKGROUP_SIZE,
  SCHROEDER_AGGREGATE_NODE_REDUCTION_AUTO_MODE,
  SCHROEDER_BUCKETED_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE,
  SCHROEDER_COMPACT_FAR_AGGREGATE_DIAGNOSTIC_READBACK_MODE,
  SCHROEDER_COMPACT_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_READBACK_MODE,
  SCHROEDER_COMPACT_LAW_NEIGHBOR_DIAGNOSTIC_READBACK_MODE,
  SCHROEDER_COMPACT_PHASE_VOLUME_DIAGNOSTIC_READBACK_MODE,
  SCHROEDER_CONSERVATION_SUMMARY_FLOATS,
  SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
  SCHROEDER_CROSS_LEVEL_COUPLING_WORKGROUP_SIZE,
  SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
  SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS,
  SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_WORKGROUP_SIZE,
  SCHROEDER_CROSS_LEVEL_STATE_DELTA_WORKGROUP_SIZE,
  SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS,
  SCHROEDER_CROSS_LEVEL_TRANSFER_WORKGROUP_SIZE,
  SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS,
  SCHROEDER_FAR_AGGREGATE_CANDIDATE_WORKGROUP_SIZE,
  SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS,
  SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS,
  SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_WORKGROUP_SIZE,
  SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
  SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_WORKGROUP_SIZE,
  SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS,
  SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_OUTPUT_FAMILY,
  SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_WORKGROUP_SIZE,
  SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS,
  SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_WORKGROUP_SIZE,
  SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS,
  SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
  SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK,
  SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_WORKGROUP_SIZE,
  SCHROEDER_FAR_AGGREGATE_LAW_MASK,
  SCHROEDER_FAR_LAW_GAS_SUMMARY_MASK,
  SCHROEDER_FULL_ACTIVE_NODE_INDEX_READBACK_MODE,
  SCHROEDER_FULL_ACTIVE_NODE_READBACK_MODE,
  SCHROEDER_FULL_ACTIVE_NODE_SORTED_INDEX_READBACK_MODE,
  SCHROEDER_FULL_CONSERVATION_SUMMARY_READBACK_MODE,
  SCHROEDER_FULL_CROSS_LEVEL_READBACK_MODE,
  SCHROEDER_FULL_CROSS_LEVEL_STATE_DELTA_MERGE_READBACK_MODE,
  SCHROEDER_FULL_CROSS_LEVEL_STATE_DELTA_READBACK_MODE,
  SCHROEDER_FULL_CROSS_LEVEL_TRANSFER_READBACK_MODE,
  SCHROEDER_FULL_FAR_AGGREGATE_CANDIDATE_READBACK_MODE,
  SCHROEDER_FULL_FAR_AGGREGATE_FORCE_APPLICATION_READBACK_MODE,
  SCHROEDER_FULL_FAR_AGGREGATE_FORCE_SUMMARY_READBACK_MODE,
  SCHROEDER_FULL_FAR_AGGREGATE_GAS_CELL_IMPORT_READBACK_MODE,
  SCHROEDER_FULL_FAR_AGGREGATE_GAS_STATE_DELTA_READBACK_MODE,
  SCHROEDER_FULL_FAR_AGGREGATE_LAW_CONSUMER_READBACK_MODE,
  SCHROEDER_FULL_HIERARCHY_AGGREGATE_NODE_READBACK_MODE,
  SCHROEDER_FULL_HIERARCHY_AGGREGATE_READBACK_MODE,
  SCHROEDER_FULL_LAW_NEIGHBOR_CANDIDATE_READBACK_MODE,
  SCHROEDER_FULL_LAW_QUEUE_READBACK_MODE,
  SCHROEDER_FULL_PARTICLE_STORAGE_ALLOCATION_READBACK_MODE,
  SCHROEDER_FULL_PARTICLE_STORAGE_MATERIALIZATION_READBACK_MODE,
  SCHROEDER_FULL_PARTICLE_STORAGE_SLOT_ASSIGNMENT_READBACK_MODE,
  SCHROEDER_FULL_PHASE_VOLUME_LEVEL_UPDATE_READBACK_MODE,
  SCHROEDER_FULL_PHASE_VOLUME_MIGRATION_READBACK_MODE,
  SCHROEDER_FULL_PHASE_VOLUME_SPLIT_MERGE_APPLY_READBACK_MODE,
  SCHROEDER_FULL_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_READBACK_MODE,
  SCHROEDER_FULL_READBACK_MODE,
  SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
  SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
  SCHROEDER_HIERARCHY_AGGREGATE_NODE_WORKGROUP_SIZE,
  SCHROEDER_HIERARCHY_AGGREGATE_WORKGROUP_SIZE,
  SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS,
  SCHROEDER_LAW_NEIGHBOR_CANDIDATE_WORKGROUP_SIZE,
  SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS,
  SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE,
  SCHROEDER_LAW_QUEUE_FLOATS,
  SCHROEDER_LAW_QUEUE_WORKGROUP_SIZE,
  SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
  SCHROEDER_LEVEL_ASSIGNMENT_SCOPE,
  SCHROEDER_LEVEL_ASSIGNMENT_WORKGROUP_SIZE,
  SCHROEDER_LOCAL_LAW_QUEUE_MASK,
  SCHROEDER_NO_FULL_READBACK_MODE,
  SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS,
  SCHROEDER_PARTICLE_STORAGE_ALLOCATION_WORKGROUP_SIZE,
  SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS,
  SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_STORAGE_BUFFER_COUNT,
  SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_WORKGROUP_SIZE,
  SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS,
  SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_WORKGROUP_SIZE,
  SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK,
  SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_WORKGROUP_SIZE,
  SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS,
  SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
  SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_WORKGROUP_SIZE,
  SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
  SCHROEDER_PHASE_VOLUME_MIGRATION_WORKGROUP_SIZE,
  SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS,
  SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS,
  SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_WORKGROUP_SIZE,
  SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS,
  SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_WORKGROUP_SIZE,
  activeNodeSharedControlBuffers,
  assertPackedInputs,
  completeSchroederSubmittedTemporaryCleanup,
  createSchroederActiveNodeIndexParamsArray,
  createSchroederActiveNodeIndexPlan,
  createSchroederActiveNodeListPlan,
  createSchroederActiveNodeParamsArray,
  createSchroederActiveNodeSortedIndexParamsArray,
  createSchroederActiveNodeSortedIndexPlan,
  createSchroederConservationSummaryParamsArray,
  createSchroederConservationSummaryPlan,
  createSchroederCrossLevelCouplingParamsArray,
  createSchroederCrossLevelCouplingPlan,
  createSchroederCrossLevelStateDeltaMergeParamsArray,
  createSchroederCrossLevelStateDeltaMergePlan,
  createSchroederCrossLevelStateDeltaParamsArray,
  createSchroederCrossLevelStateDeltaPlan,
  createSchroederCrossLevelTransferParamsArray,
  createSchroederCrossLevelTransferPlan,
  createSchroederFarAggregateCandidateParamsArray,
  createSchroederFarAggregateCandidatePlan,
  createSchroederFarAggregateDiagnosticSummaryParamsArray,
  createSchroederFarAggregateDiagnosticSummaryPlan,
  createSchroederFarAggregateForceApplicationParamsArray,
  createSchroederFarAggregateForceApplicationPlan,
  createSchroederFarAggregateForceSummaryParamsArray,
  createSchroederFarAggregateForceSummaryPlan,
  createSchroederFarAggregateGasCellImportParamsArray,
  createSchroederFarAggregateGasCellImportPlan,
  createSchroederFarAggregateGasStateDeltaParamsArray,
  createSchroederFarAggregateGasStateDeltaPlan,
  createSchroederFarAggregateLawConsumerDiagnosticSummaryParamsArray,
  createSchroederFarAggregateLawConsumerDiagnosticSummaryPlan,
  createSchroederFarAggregateLawConsumerParamsArray,
  createSchroederFarAggregateLawConsumerPlan,
  createSchroederHierarchyAggregateNodeParamsArray,
  createSchroederHierarchyAggregateNodePlan,
  createSchroederHierarchyAggregateParamsArray,
  createSchroederHierarchyAggregatePlan,
  createSchroederLawNeighborCandidateParamsArray,
  createSchroederLawNeighborCandidatePlan,
  createSchroederLawNeighborTraversalPolicy,
  createSchroederLawQueueParamsArray,
  createSchroederLawQueuePlan,
  createSchroederLevelAssignmentParamsArray,
  createSchroederLevelAssignmentPlan,
  createSchroederParticleStorageAllocationParamsArray,
  createSchroederParticleStorageAllocationPlan,
  createSchroederParticleStorageMaterializationParamsArray,
  createSchroederParticleStorageMaterializationPlan,
  createSchroederParticleStorageSlotAssignmentParamsArray,
  createSchroederParticleStorageSlotAssignmentPlan,
  createSchroederPhaseVolumeAssignmentOverlayIndexParamsArray,
  createSchroederPhaseVolumeAssignmentOverlayIndexPlan,
  createSchroederPhaseVolumeDiagnosticSummaryParamsArray,
  createSchroederPhaseVolumeDiagnosticSummaryPlan,
  createSchroederPhaseVolumeLevelUpdateParamsArray,
  createSchroederPhaseVolumeLevelUpdatePlan,
  createSchroederPhaseVolumeMigrationParamsArray,
  createSchroederPhaseVolumeMigrationPlan,
  createSchroederPhaseVolumeSplitMergeApplyParamsArray,
  createSchroederPhaseVolumeSplitMergeApplyPlan,
  createSchroederPhaseVolumeSplitMergeProposalParamsArray,
  createSchroederPhaseVolumeSplitMergeProposalPlan,
  createSchroederPhaseVolumeTargetAggregateParamsArray,
  createSchroederPhaseVolumeTargetAggregatePlan,
  deferredFinalRenderActiveNodeSubmissions,
  finalRenderActiveNodeSubmissionDeferralToken,
  finiteNumber,
  levelAssignmentSharedControlBuffers,
  normalizeSchroederPhaseVolumeAssignmentOverlay,
  optionalSourceIdentityBuffer,
  optionalSourceMechanicsBuffer,
  optionalSourceStateBuffer,
  optionalSourceThermoBuffer,
  resolveSchroederParticleBufferFamilyGeneration,
  schroederHierarchySubmittedTemporaryCleanupClaimIssuer,
  writeStorageBuffer
} from './schroederHierarchyPlans.js';


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
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  queueOrderedCleanup = false,
  queueOrderedLocalTemporaryCleanup = false
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederLevelAssignmentWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const bufferFamilyGeneration = resolveSchroederParticleBufferFamilyGeneration({
    sphParticleUpload,
    mlsMpmParticleUpload,
    particleCount: sphParticleState.particleCount
  });
  const classificationSphParticleState =
    bufferFamilyGeneration.ready === true
      ? {
          ...sphParticleState,
          step:
            sphParticleUpload.physicsTick
            ?? sphParticleUpload.step
            ?? sphParticleState.step,
          physicsSubstep:
            sphParticleUpload.physicsSubstep
            ?? sphParticleState.physicsSubstep,
          positionEpoch:
            sphParticleUpload.positionEpoch
            ?? sphParticleState.positionEpoch,
          topologyEpoch:
            sphParticleUpload.topologyEpoch
            ?? sphParticleState.topologyEpoch,
          chartEpoch:
            sphParticleUpload.chartEpoch
            ?? sphParticleState.chartEpoch,
          levelEpoch:
            sphParticleUpload.levelEpoch
            ?? sphParticleState.levelEpoch,
          supportEpoch:
            sphParticleUpload.supportEpoch
            ?? sphParticleState.supportEpoch
        }
      : sphParticleState;
  const classificationMlsMpmParticleState =
    bufferFamilyGeneration.ready === true
      ? {
          ...mlsMpmParticleState,
          step:
            mlsMpmParticleUpload.physicsTick
            ?? mlsMpmParticleUpload.step
            ?? mlsMpmParticleState.step,
          physicsSubstep:
            mlsMpmParticleUpload.physicsSubstep
            ?? mlsMpmParticleState.physicsSubstep,
          positionEpoch:
            mlsMpmParticleUpload.positionEpoch
            ?? mlsMpmParticleState.positionEpoch,
          topologyEpoch:
            mlsMpmParticleUpload.topologyEpoch
            ?? mlsMpmParticleState.topologyEpoch,
          chartEpoch:
            mlsMpmParticleUpload.chartEpoch
            ?? mlsMpmParticleState.chartEpoch,
          levelEpoch:
            mlsMpmParticleUpload.levelEpoch
            ?? mlsMpmParticleState.levelEpoch,
          supportEpoch:
            mlsMpmParticleUpload.supportEpoch
            ?? mlsMpmParticleState.supportEpoch
        }
      : mlsMpmParticleState;
  const plan = createSchroederLevelAssignmentPlan({
    sphParticleState: classificationSphParticleState,
    mlsMpmParticleState: classificationMlsMpmParticleState,
    storageGeneration: bufferFamilyGeneration.storageGeneration,
    bufferFamilyGenerationStatus: bufferFamilyGeneration.status,
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
  const useQueueOrderedAssignmentPool = Boolean(
    noFullReadback
    && typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice
  );
  const assignmentUsage = GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC;
  const assignmentBuffer = tagWebGpuBufferDevice(
    useQueueOrderedAssignmentPool
      ? registerQueueOrderedPooledBufferReturn(
          acquireQueueOrderedPooledBuffer(device, {
            bucketKey: 'ulg-schroeder-level-assignments-out',
            label: 'ulg-schroeder-level-assignments-out',
            size: plan.assignmentByteLength,
            usage: assignmentUsage
          }),
          device,
          {
            bucketKey: 'ulg-schroeder-level-assignments-out',
            size: plan.assignmentByteLength,
            usage: assignmentUsage
          }
        )
      : device.createBuffer({
          label: 'ulg-schroeder-level-assignments-out',
          size: plan.assignmentByteLength,
          usage: assignmentUsage
        }),
    device
  );
  let assignmentBufferReleased = false;
  const releaseAssignmentBuffer = () => {
    if (assignmentBufferReleased) return;
    assignmentBufferReleased = true;
    releaseOrDestroyQueueOrderedPooledBuffer(assignmentBuffer, {
      allowPool: useQueueOrderedAssignmentPool && submissionObserved
    });
  };
  const paramsBuffer = levelAssignmentSharedControlBuffers(device).paramsBuffer;
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-level-assignments-readback',
      size: plan.assignmentByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedAssignmentBuffer = false;
  let submissionObserved = false;
  let successfulReturn = false;
  let result = null;

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
    const bindGroup = createCachedExplicitBindGroup(device, {
      label: 'ulg-schroeder-level-assignment',
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
    submissionObserved = true;

    let assignments = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      assignments = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.particleCount * SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
      );
      readBuffer.unmap();
    }

    result = {
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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-level-assignment',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.assignmentByteLength
      }),
      sourceStateBuffer: stateBuffer,
      sourceStateBufferBorrowed: Boolean(borrowedStateBuffer),
      sourceStateBufferByteLength: bufferFamilyGeneration
        .requiredStateBufferByteLength,
      // Material/phase/rest-density and support metadata are part of the
      // assignment ABI. Preserve the exact thermo source just as strictly as
      // state and V0/J mechanics so a post-closure generation cannot be
      // confused with the pre-closure lookup assignment.
      sourceThermoBuffer: thermoBuffer,
      sourceThermoBufferBorrowed: Boolean(borrowedThermoBuffer),
      sourceThermoBufferByteLength: bufferFamilyGeneration
        .requiredThermoBufferByteLength,
      // Keep the exact retained mechanics source alongside the assignment.
      // Consumers that require strict V0 * J provenance must use this buffer
      // directly rather than the assignment's intentionally fallback-capable
      // volume columns.
      sourceMechanicsBuffer: mechanicsBuffer,
      sourceMechanicsBufferBorrowed: Boolean(borrowedMechanicsBuffer),
      sourceMechanicsBufferByteLength: bufferFamilyGeneration
        .requiredMechanicsBufferByteLength,
      retainedAssignmentBuffer: Boolean(retainAssignmentBuffer),
      assignmentBufferByteLength: plan.assignmentByteLength,
      assignments,
      bufferFamilyGeneration,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainAssignmentBuffer) {
      result.assignmentBuffer = assignmentBuffer;
      result.destroyAssignmentBuffer = releaseAssignmentBuffer;
      returnedRetainedAssignmentBuffer = true;
    }
    successfulReturn = true;
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedStateBuffer) stateBuffer.destroy?.();
      if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
      if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
      if (!retainAssignmentBuffer || !returnedRetainedAssignmentBuffer) releaseAssignmentBuffer();
      readBuffer?.destroy?.();
    };
    if (
      noFullReadback
      && (
        queueOrderedCleanup === true
        || queueOrderedLocalTemporaryCleanup === true
      )
      && submissionObserved
      && successfulReturn
    ) {
      cleanup();
    } else if (noFullReadback) {
      const deferred = deferSubmittedWorkCleanup(device, cleanup);
      if (deferred === true && successfulReturn && result) {
        appendGpuReadbackTelemetryObservation(result, {
          hostQueueFenceCount: 1,
          deferredCleanupHostQueueFenceCount: 1
        }, {
          source: 'schroeder-level-assignment-temporary-cleanup'
        });
      }
    } else {
      cleanup();
    }
  }
}

function takeDeferredFinalRenderActiveNodeSubmission(
  result,
  device,
  action
) {
  const record = deferredFinalRenderActiveNodeSubmissions.get(result);
  if (!record || record.device !== device || record.state !== 'pending') {
    const error = new Error(
      `Final render active-node submission cannot ${action}: pending authority is missing or stale`
    );
    error.code =
      'ERR_SCHROEDER_FINAL_RENDER_ACTIVE_NODE_SUBMISSION_AUTHORITY';
    throw error;
  }
  record.state = action;
  deferredFinalRenderActiveNodeSubmissions.delete(result);
  return record;
}

export function finalizeDeferredFinalRenderActiveNodeSubmission(result, device) {
  const record = takeDeferredFinalRenderActiveNodeSubmission(
    result,
    device,
    'finalize'
  );
  try {
    return record.finalize();
  } catch (error) {
    try {
      record.abort();
    } catch {
      // Preserve the exact finalization failure.
    }
    throw error;
  }
}

export function abortDeferredFinalRenderActiveNodeSubmission(result, device) {
  if (!deferredFinalRenderActiveNodeSubmissions.has(result)) return false;
  const record = takeDeferredFinalRenderActiveNodeSubmission(
    result,
    device,
    'abort'
  );
  record.abort();
  return true;
}

export async function runSchroederActiveNodeListWebGpu({
  device,
  levelAssignment,
  phaseVolumeAssignmentOverlay = null,
  phaseVolumeAssignmentOverlayIndex = null,
  phaseVolumeLevelUpdate = null,
  selectedLevel = 0,
  tileCellCount = DEFAULT_TILE_CELL_COUNT,
  supportInflateCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minTileSpacingM = 0,
  maxTileSpacingM = 0,
  retainActiveNodeBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  queueOrderedCleanup = false,
  queueOrderedLocalTemporaryCleanup = false,
  queueOrderedProducerClaims = [],
  queueOrderedSubmissionDeferralToken = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederActiveNodeListWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const resolvedPhaseVolumeAssignmentOverlay = normalizeSchroederPhaseVolumeAssignmentOverlay({
    phaseVolumeAssignmentOverlay,
    phaseVolumeLevelUpdate,
    levelAssignment,
    selectedLevel
  });
  const plan = createSchroederActiveNodeListPlan({
    levelAssignment,
    phaseVolumeAssignmentOverlay: resolvedPhaseVolumeAssignmentOverlay,
    phaseVolumeAssignmentOverlayIndex,
    selectedLevel,
    tileCellCount,
    supportInflateCells,
    minTileSpacingM,
    maxTileSpacingM
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const deferQueueOrderedSubmission =
    queueOrderedSubmissionDeferralToken
      === finalRenderActiveNodeSubmissionDeferralToken;
  if (
    queueOrderedSubmissionDeferralToken != null
    && deferQueueOrderedSubmission !== true
  ) {
    const error = new Error(
      'Schroeder active-node submission deferral requires exact private authority'
    );
    error.code =
      'ERR_SCHROEDER_ACTIVE_NODE_SUBMISSION_DEFERRAL_UNAUTHORIZED';
    throw error;
  }
  if (
    deferQueueOrderedSubmission
    && (!noFullReadback || queueOrderedCleanup !== true)
  ) {
    const error = new Error(
      'Schroeder active-node submission deferral requires queue-ordered no-full-readback cleanup'
    );
    error.code =
      'ERR_SCHROEDER_ACTIVE_NODE_SUBMISSION_DEFERRAL_ROUTE';
    throw error;
  }
  if (!Array.isArray(queueOrderedProducerClaims)) {
    throw new TypeError(
      'Schroeder active-node queueOrderedProducerClaims must be an array'
    );
  }
  if (
    queueOrderedProducerClaims.length > 0
    && (!noFullReadback || queueOrderedCleanup !== true)
  ) {
    const error = new Error(
      'External hierarchy transfer claims require the exact resident active-node final consumer'
    );
    error.code =
      'ERR_SCHROEDER_ACTIVE_NODE_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED';
    throw error;
  }
  const borrowedAssignmentBuffer = levelAssignment?.assignmentBuffer || null;
  const assignmentRows = levelAssignment?.assignments instanceof Float32Array
    ? levelAssignment.assignments
    : null;
  if (!borrowedAssignmentBuffer && !(assignmentRows instanceof Float32Array)) {
    throw new TypeError('Schroeder active node list requires a retained assignment buffer or explicit assignment rows');
  }
  const assignmentBuffer = borrowedAssignmentBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-active-node-assignment-in', assignmentRows);
  const activeNodeParams = createSchroederActiveNodeParamsArray(plan);
  const sharedControlBuffers = activeNodeSharedControlBuffers(
    device,
    activeNodeParams.byteLength
  );
  const borrowedPhaseVolumeAssignmentOverlayBuffer = plan.phaseVolumeAssignmentOverlayEnabled
    ? (resolvedPhaseVolumeAssignmentOverlay?.levelUpdateBuffer || null)
    : null;
  const phaseVolumeAssignmentOverlayRows = plan.phaseVolumeAssignmentOverlayEnabled
    && resolvedPhaseVolumeAssignmentOverlay?.levelUpdateRows instanceof Float32Array
    ? resolvedPhaseVolumeAssignmentOverlay.levelUpdateRows
    : null;
  const phaseVolumeAssignmentOverlayBuffer = borrowedPhaseVolumeAssignmentOverlayBuffer
    || (phaseVolumeAssignmentOverlayRows
        ? writeStorageBuffer(
          device,
          'ulg-schroeder-active-node-phase-volume-assignment-overlay-in',
          phaseVolumeAssignmentOverlayRows
        )
        : sharedControlBuffers.disabledOverlayBuffer);
  const borrowedPhaseVolumeAssignmentOverlayIndexBuffer = plan.phaseVolumeAssignmentOverlayIndexEnabled
    ? (phaseVolumeAssignmentOverlayIndex?.indexBuffer || null)
    : null;
  const phaseVolumeAssignmentOverlayIndexBuffer = borrowedPhaseVolumeAssignmentOverlayIndexBuffer
    || sharedControlBuffers.disabledOverlayIndexBuffer;
  const useQueueOrderedActiveNodePool = Boolean(
    noFullReadback
    && typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice
  );
  const activeNodeUsage = GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC;
  const activeNodeBuffer = tagWebGpuBufferDevice(
    useQueueOrderedActiveNodePool
      ? registerQueueOrderedPooledBufferReturn(
          acquireQueueOrderedPooledBuffer(device, {
            bucketKey: 'ulg-schroeder-active-nodes-out',
            label: 'ulg-schroeder-active-nodes-out',
            size: plan.activeNodeByteLength,
            usage: activeNodeUsage
          }),
          device,
          {
            bucketKey: 'ulg-schroeder-active-nodes-out',
            size: plan.activeNodeByteLength,
            usage: activeNodeUsage
          }
        )
      : device.createBuffer({
          label: 'ulg-schroeder-active-nodes-out',
          size: plan.activeNodeByteLength,
          usage: activeNodeUsage
        }),
    device
  );
  let activeNodeBufferReleased = false;
  const releaseActiveNodeBuffer = () => {
    if (activeNodeBufferReleased) return;
    activeNodeBufferReleased = true;
    releaseOrDestroyQueueOrderedPooledBuffer(activeNodeBuffer, {
      allowPool: useQueueOrderedActiveNodePool && submissionObserved
    });
  };
  const paramsBuffer = sharedControlBuffers.paramsBuffer;
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-active-nodes-readback',
      size: plan.activeNodeByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedActiveNodeBuffer = false;
  let submissionObserved = false;
  let successfulReturn = false;
  let result = null;
  let queueOrderedSubmissionReceipt = null;
  let queueOrderedFinalConsumerCapability = null;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, activeNodeParams);
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'storage')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-active-node-list.v2',
      label: 'ulg-schroeder-active-node-list',
      code: schroederActiveNodeListWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      label: 'ulg-schroeder-active-node-list',
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: assignmentBuffer } },
        { binding: 1, resource: { buffer: activeNodeBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
        { binding: 3, resource: { buffer: phaseVolumeAssignmentOverlayBuffer } },
        { binding: 4, resource: { buffer: phaseVolumeAssignmentOverlayIndexBuffer } }
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
    const commandBuffer = encoder.finish();
    if (noFullReadback && queueOrderedCleanup === true) {
      assertQueueOrderedCleanupClaimsRegistered(
        device,
        queueOrderedProducerClaims
      );
      queueOrderedSubmissionReceipt = submitQueueOrderedWork(
        device,
        [commandBuffer]
      );
    } else {
      device.queue.submit([commandBuffer]);
    }
    submissionObserved = true;

    let activeNodes = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      activeNodes = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.activeCandidateCount * SCHROEDER_ACTIVE_NODE_FLOATS
      );
      readBuffer.unmap();
    }

    result = {
      ...plan,
      schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
      activeNodeListSchema: plan.schema,
      status: 'schroeder-active-node-list-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback ? SCHROEDER_NO_FULL_READBACK_MODE : SCHROEDER_FULL_ACTIVE_NODE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-active-node-list',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.activeNodeByteLength
      }),
      phaseVolumeAssignmentOverlayStatus: plan.phaseVolumeAssignmentOverlayStatus,
      phaseVolumeAssignmentOverlayConsumerStatus: plan.phaseVolumeAssignmentOverlayConsumerStatus,
      phaseVolumeAssignmentOverlayEnabled: plan.phaseVolumeAssignmentOverlayEnabled,
      phaseVolumeAssignmentOverlayAvailable: plan.phaseVolumeAssignmentOverlayAvailable,
      phaseVolumeAssignmentOverlayRowCount: plan.phaseVolumeAssignmentOverlayRowCount,
      phaseVolumeAssignmentOverlayStrideFloats: plan.phaseVolumeAssignmentOverlayStrideFloats,
      phaseVolumeAssignmentOverlayRetainedBuffer: plan.phaseVolumeAssignmentOverlayRetainedBuffer,
      phaseVolumeAssignmentOverlayRowAlignedWithParticles: plan.phaseVolumeAssignmentOverlayRowAlignedWithParticles,
      phaseVolumeAssignmentOverlayIndexRequired: plan.phaseVolumeAssignmentOverlayIndexRequired,
      phaseVolumeAssignmentOverlayIndexEnabled: plan.phaseVolumeAssignmentOverlayIndexEnabled,
      phaseVolumeAssignmentOverlayIndexSchema: plan.phaseVolumeAssignmentOverlayIndexSchema,
      phaseVolumeAssignmentOverlayIndexStatus: plan.phaseVolumeAssignmentOverlayIndexStatus,
      phaseVolumeAssignmentOverlayIndexByteLength: plan.phaseVolumeAssignmentOverlayIndexByteLength,
      phaseVolumeAssignmentOverlayIndexMode: plan.phaseVolumeAssignmentOverlayIndexMode,
      phaseVolumeAssignmentOverlaySparseIndexStatus: plan.phaseVolumeAssignmentOverlaySparseIndexStatus,
      phaseVolumeAssignmentOverlayTransferMode: plan.phaseVolumeAssignmentOverlayTransferMode,
      phaseVolumeAssignmentOverlayRawGpuBufferTransferAllowed:
        plan.phaseVolumeAssignmentOverlayRawGpuBufferTransferAllowed,
      phaseVolumeAssignmentOverlayFullParticleReadbackRequired:
        plan.phaseVolumeAssignmentOverlayFullParticleReadbackRequired,
      phaseVolumeLevelSelectionSource: plan.phaseVolumeLevelSelectionSource,
      phaseVolumeNativeLevelSource: plan.phaseVolumeNativeLevelSource,
      retainedActiveNodeBuffer: Boolean(retainActiveNodeBuffer),
      activeNodeBufferByteLength: plan.activeNodeByteLength,
      activeNodes,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    Object.defineProperty(
      result,
      'queueOrderedFinalConsumerCapability',
      {
        get: () => queueOrderedFinalConsumerCapability,
        enumerable: false,
        configurable: false
      }
    );
    if (retainActiveNodeBuffer) {
      result.activeNodeBuffer = activeNodeBuffer;
      result.destroyActiveNodeBuffer = releaseActiveNodeBuffer;
      returnedRetainedActiveNodeBuffer = true;
    }
    successfulReturn = true;
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedAssignmentBuffer) assignmentBuffer.destroy?.();
      if (
        !borrowedPhaseVolumeAssignmentOverlayBuffer
        && phaseVolumeAssignmentOverlayBuffer
          !== sharedControlBuffers.disabledOverlayBuffer
      ) {
        phaseVolumeAssignmentOverlayBuffer.destroy?.();
      }
      if (
        !borrowedPhaseVolumeAssignmentOverlayIndexBuffer
        && phaseVolumeAssignmentOverlayIndexBuffer
          !== sharedControlBuffers.disabledOverlayIndexBuffer
      ) {
        phaseVolumeAssignmentOverlayIndexBuffer.destroy?.();
      }
      if (!retainActiveNodeBuffer || !returnedRetainedActiveNodeBuffer) releaseActiveNodeBuffer();
      readBuffer?.destroy?.();
    };
    const recordHostQueueFence = () => {
      if (!result) return;
      appendGpuReadbackTelemetryObservation(result, {
        hostQueueFenceCount: 1,
        deferredCleanupHostQueueFenceCount: 1
      }, {
        source: 'schroeder-active-node-temporary-cleanup'
      });
    };
    const finalizeQueueOrderedSubmission = () => {
      let producerClaim = null;
      try {
        producerClaim = registerQueueOrderedCleanupClaim(
          schroederHierarchySubmittedTemporaryCleanupClaimIssuer,
          device,
          {
            producerOutput: result,
            cleanup
          }
        );
        const capability = sealQueueOrderedFinalConsumerCapability(
          queueOrderedSubmissionReceipt,
          device,
          {
            finalConsumerOwner: result,
            producerClaims: [
              producerClaim,
              ...queueOrderedProducerClaims
            ]
          }
        );
        // The result's getter was installed before seal, and this assignment
        // happens before fallible producer cleanup. Remaining hierarchy
        // transfer claims therefore stay reachable if local destruction fails.
        queueOrderedFinalConsumerCapability = capability;
        try {
          const receipt = releaseSubmittedWorkCleanupQueueOrdered(
            device,
            cleanup,
            {
              queueOrderedFinalConsumer: capability,
              producerClaim,
              producerOutput: result,
              producerFamily:
                'schroeder-hierarchy-submitted-temporaries'
            }
          );
          result.queueOrderedCleanupReceipt = receipt;
          result.queueCompletionStatus = receipt.queueCompletionStatus;
          result.queueCompletionMethod = receipt.queueCompletionMethod;
        } catch {
          try {
            if (deferSubmittedWorkCleanup(device, cleanup) === true) {
              recordHostQueueFence();
            }
          } catch {
            // The capability remains published; retain rather than replay or
            // strand any external class claim.
          }
        }
      } catch {
        if (queueOrderedFinalConsumerCapability == null) {
          if (producerClaim != null) {
            try {
              cancelQueueOrderedCleanupClaim(
                producerClaim,
                device,
                {
                  producerOutput: result,
                  cleanup
                }
              );
            } catch {
              // Preserve the fallback cleanup path.
            }
          }
          if (deferSubmittedWorkCleanup(device, cleanup) === true) {
            recordHostQueueFence();
          }
        }
      }
      return queueOrderedFinalConsumerCapability;
    };
    if (
      noFullReadback
      && queueOrderedCleanup === true
      && submissionObserved
      && successfulReturn
    ) {
      if (deferQueueOrderedSubmission) {
        if (deferredFinalRenderActiveNodeSubmissions.has(result)) {
          throw new Error(
            'Final render active-node submission deferral was registered twice'
          );
        }
        deferredFinalRenderActiveNodeSubmissions.set(result, {
          device,
          state: 'pending',
          finalize: finalizeQueueOrderedSubmission,
          abort: cleanup
        });
      } else {
        finalizeQueueOrderedSubmission();
      }
    } else if (
      noFullReadback
      && queueOrderedLocalTemporaryCleanup === true
      && submissionObserved
      && successfulReturn
    ) {
      cleanup();
    } else if (noFullReadback) {
      if (deferSubmittedWorkCleanup(device, cleanup) === true) {
        recordHostQueueFence();
      }
    } else {
      cleanup();
    }
  }
}

export async function runSchroederPhaseVolumeAssignmentOverlayIndexWebGpu({
  device,
  phaseVolumeAssignmentOverlay,
  levelAssignment,
  retainIndexBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  queueOrderedCleanup = false
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError(
      'runSchroederPhaseVolumeAssignmentOverlayIndexWebGpu requires a WebGPU-like device with queue.writeBuffer'
    );
  }
  const plan = createSchroederPhaseVolumeAssignmentOverlayIndexPlan({
    phaseVolumeAssignmentOverlay,
    levelAssignment
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedLevelUpdateBuffer = phaseVolumeAssignmentOverlay?.levelUpdateBuffer || null;
  const levelUpdateRows = phaseVolumeAssignmentOverlay?.levelUpdateRows instanceof Float32Array
    ? phaseVolumeAssignmentOverlay.levelUpdateRows
    : null;
  if (!borrowedLevelUpdateBuffer && !(levelUpdateRows instanceof Float32Array)) {
    throw new TypeError(
      'Schroeder phase-volume assignment overlay index requires retained level-update rows or explicit rows'
    );
  }
  const levelUpdateBuffer = borrowedLevelUpdateBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-phase-volume-assignment-overlay-index-in', levelUpdateRows);
  const indexBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-assignment-overlay-index-out',
    size: plan.indexByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsPayload = createSchroederPhaseVolumeAssignmentOverlayIndexParamsArray(plan);
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-assignment-overlay-index-params',
    size: paramsPayload.byteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-phase-volume-assignment-overlay-index-readback',
      size: plan.indexByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedIndexBuffer = false;
  let submissionObserved = false;
  let successfulReturn = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, paramsPayload);
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const clearPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-phase-volume-assignment-overlay-index-clear.v0',
      label: 'ulg-schroeder-phase-volume-assignment-overlay-index-clear',
      code: schroederPhaseVolumeAssignmentOverlayIndexWgsl,
      entryPoint: 'clear_index',
      bindings
    });
    const buildPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-phase-volume-assignment-overlay-index-build.v0',
      label: 'ulg-schroeder-phase-volume-assignment-overlay-index-build',
      code: schroederPhaseVolumeAssignmentOverlayIndexWgsl,
      entryPoint: 'build_index',
      bindings
    });
    const clearBindGroup = createCachedExplicitBindGroup(device, {
      layout: clearPipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: levelUpdateBuffer } },
        { binding: 1, resource: { buffer: indexBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const buildBindGroup = createCachedExplicitBindGroup(device, {
      layout: buildPipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: levelUpdateBuffer } },
        { binding: 1, resource: { buffer: indexBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(clearPipeline.pipeline);
    pass.setBindGroup(0, clearBindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.particleCount / SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_WORKGROUP_SIZE)
    ));
    pass.setPipeline(buildPipeline.pipeline);
    pass.setBindGroup(0, buildBindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(
        plan.phaseVolumeAssignmentOverlayRowCount
          / SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_WORKGROUP_SIZE
      )
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(indexBuffer, 0, readBuffer, 0, plan.indexByteLength);
    }
    device.queue.submit([encoder.finish()]);
    submissionObserved = true;

    let indexRows = new Uint32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      indexRows = new Uint32Array(readBuffer.getMappedRange()).slice(0, plan.particleCount);
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_EXECUTION_SCHEMA,
      phaseVolumeAssignmentOverlayIndexSchema: plan.schema,
      status: 'schroeder-phase-volume-assignment-overlay-index-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: {
        clear: clearPipeline.cacheStatus,
        build: buildPipeline.cacheStatus
      },
      readbackMode: noFullReadback ? SCHROEDER_NO_FULL_READBACK_MODE : 'full-index-readback',
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedIndexBuffer: Boolean(retainIndexBuffer),
      indexBufferByteLength: plan.indexByteLength,
      indexRows,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainIndexBuffer) {
      result.indexBuffer = indexBuffer;
      result.destroyIndexBuffer = () => indexBuffer.destroy?.();
      returnedRetainedIndexBuffer = true;
    }
    successfulReturn = true;
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedLevelUpdateBuffer) levelUpdateBuffer.destroy?.();
      if (!retainIndexBuffer || !returnedRetainedIndexBuffer) indexBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (
      noFullReadback
      && queueOrderedCleanup === true
      && submissionObserved
      && successfulReturn
    ) {
      cleanup();
    } else if (noFullReadback) {
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
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  queueOrderedCleanup = false,
  queueOrderedLocalTemporaryCleanup = false
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
  let submissionObserved = false;
  let successfulResult = null;
  let queueOrderedSubmissionReceipt = null;

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
    const bindGroup = createCachedExplicitBindGroup(device, {
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
    const commandBuffer = encoder.finish();
    if (queueOrderedCleanup === true) {
      queueOrderedSubmissionReceipt = submitQueueOrderedWork(
        device,
        [commandBuffer]
      );
    } else {
      device.queue.submit([commandBuffer]);
    }
    submissionObserved = true;

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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-active-node-index',
        mapAsyncCount: noFullReadback ? 0 : 4,
        readbackBytes: noFullReadback
          ? 0
          : (
              plan.bucketCountByteLength
              + plan.bucketSlotByteLength
              + plan.nodeBucketSlotByteLength
              + plan.overflowCounterByteLength
            )
      }),
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
    successfulResult = result;
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
    if (
      noFullReadback
      && queueOrderedLocalTemporaryCleanup === true
      && submissionObserved
      && successfulResult
    ) {
      cleanup();
    } else {
      completeSchroederSubmittedTemporaryCleanup({
        device,
        cleanup,
        deferredCleanupRequired: noFullReadback,
        queueOrderedCleanup,
        submissionObserved,
        queueOrderedSubmissionReceipt,
        resultAuthority: successfulResult
      });
    }
  }
}

export async function runSchroederActiveNodeSortedIndexWebGpu({
  device,
  activeNodeList,
  bucketCount = null,
  retainIndexBuffers = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  queueOrderedCleanup = false,
  queueOrderedLocalTemporaryCleanup = false
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
  let submissionObserved = false;
  let successfulResult = null;
  let queueOrderedSubmissionReceipt = null;

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
    const bindGroup = createCachedExplicitBindGroup(device, {
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
    const commandBuffer = encoder.finish();
    if (queueOrderedCleanup === true) {
      queueOrderedSubmissionReceipt = submitQueueOrderedWork(
        device,
        [commandBuffer]
      );
    } else {
      device.queue.submit([commandBuffer]);
    }
    submissionObserved = true;

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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-active-node-sorted-index',
        mapAsyncCount: noFullReadback ? 0 : 4,
        readbackBytes: noFullReadback
          ? 0
          : (
              plan.bucketCountByteLength
              + plan.bucketRangeOffsetByteLength
              + plan.sortedActiveIndexByteLength
              + plan.diagnosticCounterByteLength
            )
      }),
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
    successfulResult = result;
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
    if (
      noFullReadback
      && queueOrderedLocalTemporaryCleanup === true
      && submissionObserved
      && successfulResult
    ) {
      cleanup();
    } else {
      completeSchroederSubmittedTemporaryCleanup({
        device,
        cleanup,
        deferredCleanupRequired: noFullReadback,
        queueOrderedCleanup,
        submissionObserved,
        queueOrderedSubmissionReceipt,
        resultAuthority: successfulResult
      });
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
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  queueOrderedCleanup = false,
  queueOrderedLocalTemporaryCleanup = true
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
  let submissionObserved = false;
  let successfulResult = null;
  let queueOrderedSubmissionReceipt = null;

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
    const bindGroup = createCachedExplicitBindGroup(device, {
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
    const commandBuffer = encoder.finish();
    if (
      noFullReadback
      && (
        queueOrderedCleanup === true
        || queueOrderedLocalTemporaryCleanup === true
      )
    ) {
      queueOrderedSubmissionReceipt = submitQueueOrderedWork(
        device,
        [commandBuffer]
      );
    } else {
      device.queue.submit([commandBuffer]);
    }
    submissionObserved = true;

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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-law-queue',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.lawQueueByteLength
      }),
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
    successfulResult = result;
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedActiveNodeBuffer) activeNodeBuffer.destroy?.();
      if (!retainLawQueueBuffer || !returnedRetainedLawQueueBuffer) lawQueueBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    completeSchroederSubmittedTemporaryCleanup({
      device,
      cleanup,
      deferredCleanupRequired: noFullReadback,
      queueOrderedCleanup: Boolean(
        queueOrderedCleanup === true
        || queueOrderedLocalTemporaryCleanup === true
      ),
      submissionObserved,
      queueOrderedSubmissionReceipt,
      resultAuthority: successfulResult
    });
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
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  queueOrderedCleanup = false,
  queueOrderedLocalTemporaryCleanup = true
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
  let submissionObserved = false;
  let successfulResult = null;
  let queueOrderedSubmissionReceipt = null;

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
    const bindGroup = createCachedExplicitBindGroup(device, {
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
    const commandBuffer = encoder.finish();
    if (
      (
        queueOrderedCleanup === true
        || queueOrderedLocalTemporaryCleanup === true
      )
      && readbackMode === SCHROEDER_NO_FULL_READBACK_MODE
    ) {
      queueOrderedSubmissionReceipt = submitQueueOrderedWork(
        device,
        [commandBuffer]
      );
    } else {
      device.queue.submit([commandBuffer]);
    }
    submissionObserved = true;

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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-law-neighbor-candidates',
        mapAsyncCount: fullCandidateReadback
          ? 3
          : (compactDiagnosticReadback ? 1 : 0),
        readbackBytes: fullCandidateReadback
          ? (
            plan.neighborCandidateByteLength
            + plan.sourceCandidateSpanByteLength
            + plan.diagnosticCounterByteLength
          )
          : (compactDiagnosticReadback ? plan.diagnosticCounterByteLength : 0)
      }),
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
      pressureInterfaceSpatialIndexStatus: 'pressure-interface-source-span-spatial-index-submitted',
      pressureInterfaceSpatialIndexMode: plan.pressureInterfaceSpatialIndexMode,
      pressureInterfaceSpatialIndexConsumerStatus:
        'available-for-pressure-interface-contact-kinematics-source-span-binding',
      pressureInterfaceSpatialIndexFallbackPolicy:
        'no-implicit-full-candidate-scan-without-source-span-descriptor',
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
    successfulResult = result;
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
    completeSchroederSubmittedTemporaryCleanup({
      device,
      cleanup,
      deferredCleanupRequired: noFullReadback,
      queueOrderedCleanup: Boolean(
        (
          queueOrderedCleanup === true
          || queueOrderedLocalTemporaryCleanup === true
        )
        && readbackMode === SCHROEDER_NO_FULL_READBACK_MODE
      ),
      submissionObserved,
      queueOrderedSubmissionReceipt,
      resultAuthority: successfulResult
    });
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
    const bindGroup = createCachedExplicitBindGroup(device, {
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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-cross-level-coupling',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.crossLevelByteLength
      }),
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
    const bindGroup = createCachedExplicitBindGroup(device, {
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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-conservation-summary',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.summaryByteLength
      }),
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
    const bindGroup = createCachedExplicitBindGroup(device, {
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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-cross-level-transfer',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.transferByteLength
      }),
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
    const bindGroup = createCachedExplicitBindGroup(device, {
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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-cross-level-state-delta',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.stateDeltaByteLength
      }),
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
    const bindGroup = createCachedExplicitBindGroup(device, {
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
    const bindGroup = createCachedExplicitBindGroup(device, {
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

export async function runSchroederPhaseVolumeTargetAggregateWebGpu({
  device,
  levelAssignment,
  physicalGasGrouping = false,
  physicalLiquidGrouping = false,
  sphParticleState = null,
  sphParticleUpload = null,
  baseGridSpacingM = levelAssignment?.baseGridSpacingM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = levelAssignment?.minLevel ?? DEFAULT_MIN_LEVEL,
  maxLevel = levelAssignment?.maxLevel ?? DEFAULT_MAX_LEVEL,
  targetSupportCells = levelAssignment?.targetSupportCells ?? DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = levelAssignment?.supportRadiusScale ?? DEFAULT_SUPPORT_RADIUS_SCALE,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  gasPhaseId = DEFAULT_GAS_PHASE_ID,
  aggregateEpoch = 0,
  stateFamilyId = 1,
  retainAggregateBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  queueOrderedCleanup = false
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederPhaseVolumeTargetAggregateWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const identityRequired = sphParticleUpload?.identityRequired === true
    || sphParticleStateRequiresExplicitIdentity(sphParticleState);
  const plan = createSchroederPhaseVolumeTargetAggregatePlan({
    levelAssignment,
    identityRequired,
    baseGridSpacingM,
    minLevel,
    maxLevel,
    targetSupportCells,
    supportRadiusScale,
    phaseVolumeExpandThreshold,
    gasPhaseId,
    aggregateEpoch,
    stateFamilyId
  });
  plan.physicalGasGrouping = physicalGasGrouping === true;
  plan.physicalLiquidGrouping = physicalLiquidGrouping === true;
  if (plan.physicalGasGrouping && plan.physicalLiquidGrouping) {
    plan.aggregateIdentityKeyMode = 'fluid-material-phase-source-level-chart-cell';
  } else if (plan.physicalGasGrouping) {
    plan.aggregateIdentityKeyMode = 'gas-material-source-level-chart-cell';
  } else if (plan.physicalLiquidGrouping) {
    plan.aggregateIdentityKeyMode = 'liquid-material-source-level-chart-cell';
  }
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedAssignmentBuffer = levelAssignment?.assignmentBuffer || null;
  const assignmentRows = levelAssignment?.assignments instanceof Float32Array
    ? levelAssignment.assignments
    : null;
  if (!borrowedAssignmentBuffer && !(assignmentRows instanceof Float32Array)) {
    throw new TypeError('Schroeder phase-volume target aggregate requires a retained assignment buffer or explicit rows');
  }
  const assignmentBuffer = borrowedAssignmentBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-phase-volume-target-aggregate-assignment-in', assignmentRows);
  const borrowedStateBuffer = sphParticleUpload?.status === 'webgpu-uploaded'
    ? sphParticleUpload.stateBuffer
    : null;
  const stateRows = sphParticleState?.state instanceof Float32Array ? sphParticleState.state : null;
  const stateProvided = Boolean(borrowedStateBuffer || stateRows);
  const stateBuffer = borrowedStateBuffer
    || writeStorageBuffer(
      device,
      'ulg-schroeder-phase-volume-target-aggregate-state-in',
      stateRows || new Float32Array(SPH_GPU_PARTICLE_STATE_FLOATS)
    );
  const borrowedThermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded'
    ? sphParticleUpload.thermoBuffer
    : null;
  const thermoRows = sphParticleState?.thermo instanceof Float32Array ? sphParticleState.thermo : null;
  const thermoProvided = Boolean(borrowedThermoBuffer || thermoRows);
  const thermoBuffer = borrowedThermoBuffer
    || writeStorageBuffer(
      device,
      'ulg-schroeder-phase-volume-target-aggregate-thermo-in',
      thermoRows || new Float32Array(SPH_GPU_PARTICLE_THERMO_FLOATS)
    );
  const borrowedIdentityBuffer = optionalSourceIdentityBuffer(sphParticleUpload);
  const identityRows = sphParticleState?.identity instanceof Uint32Array
    && sphParticleState.identity.length >= plan.aggregateRowCount * SPH_GPU_PARTICLE_IDENTITY_UINTS
    ? sphParticleState.identity
    : null;
  if (identityRequired && !borrowedIdentityBuffer && !identityRows) {
    throw new TypeError(
      'Schroeder phase-volume target aggregate requires identity for arbitrary render domains'
    );
  }
  const identityBuffer = borrowedIdentityBuffer
    || writeStorageBuffer(
      device,
      'ulg-schroeder-phase-volume-target-aggregate-identity-in',
      identityRows || new Uint32Array(plan.aggregateRowCount * SPH_GPU_PARTICLE_IDENTITY_UINTS)
    );
  const aggregateBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-target-aggregate-out',
    size: plan.aggregateByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsArray = createSchroederPhaseVolumeTargetAggregateParamsArray({
    ...plan,
    flags: (plan.physicalGasGrouping ? 1 : 0) | (plan.physicalLiquidGrouping ? 2 : 0),
    stateVec4Stride: stateProvided ? SPH_GPU_PARTICLE_STATE_FLOATS / 4 : 0,
    thermoVec4Stride: thermoProvided ? SPH_GPU_PARTICLE_THERMO_FLOATS / 4 : 0
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-target-aggregate-params',
    size: paramsArray.byteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-phase-volume-target-aggregate-readback',
      size: plan.aggregateByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedAggregateBuffer = false;
  let submissionObserved = false;
  let successfulResult = null;
  let queueOrderedSubmissionReceipt = null;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray);
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'read-only-storage'),
      computeBufferBinding(5, 'read-only-storage')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-phase-volume-target-aggregate.v5',
      label: 'ulg-schroeder-phase-volume-target-aggregate',
      code: schroederPhaseVolumeTargetAggregateWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: assignmentBuffer } },
        { binding: 1, resource: { buffer: aggregateBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
        { binding: 3, resource: { buffer: stateBuffer } },
        { binding: 4, resource: { buffer: thermoBuffer } },
        { binding: 5, resource: { buffer: identityBuffer } }
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
    const commandBuffer = encoder.finish();
    if (queueOrderedCleanup === true) {
      queueOrderedSubmissionReceipt = submitQueueOrderedWork(
        device,
        [commandBuffer]
      );
    } else {
      device.queue.submit([commandBuffer]);
    }
    submissionObserved = true;

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
      status: 'schroeder-phase-volume-target-aggregate-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_HIERARCHY_AGGREGATE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-phase-volume-target-aggregate',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.aggregateByteLength,
        hostQueueFenceCount: 0
      }),
      retainedAggregateBuffer: Boolean(retainAggregateBuffer),
      aggregateBufferByteLength: plan.aggregateByteLength,
      aggregateRows,
      aggregateReductionStatus: 'pending-keyed-reduction',
      aggregateIdentityKeyMode: plan.aggregateIdentityKeyMode,
      identityRequired,
      conservativeTransferStatus: 'phase-volume-target-aggregate-contributions-submitted',
      stateMutationStatus: 'phase-volume-target-aggregate-contribution-buffer-submitted',
      stateAuthorityStatus: 'derived-from-current-level-assignment-no-authoritative-state-mutation',
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
    successfulResult = result;
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedAssignmentBuffer) assignmentBuffer.destroy?.();
      if (!borrowedStateBuffer) stateBuffer.destroy?.();
      if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
      if (!borrowedIdentityBuffer) identityBuffer.destroy?.();
      if (!retainAggregateBuffer || !returnedRetainedAggregateBuffer) aggregateBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    completeSchroederSubmittedTemporaryCleanup({
      device,
      cleanup,
      deferredCleanupRequired: noFullReadback,
      queueOrderedCleanup,
      submissionObserved,
      queueOrderedSubmissionReceipt,
      resultAuthority: successfulResult
    });
  }
}

export async function runSchroederHierarchyAggregateNodeReductionWebGpu({
  device,
  hierarchyAggregate,
  retainAggregateNodeBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  aggregateReductionMode = SCHROEDER_AGGREGATE_NODE_REDUCTION_AUTO_MODE,
  bucketCount = null,
  bucketSlotCapacity = DEFAULT_AGGREGATE_NODE_BUCKET_SLOT_CAPACITY,
  queueOrderedCleanup = false
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
  let submissionObserved = false;
  let successfulResult = null;
  let queueOrderedSubmissionReceipt = null;

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
    const bindGroup = createCachedExplicitBindGroup(device, {
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
    const commandBuffer = encoder.finish();
    if (queueOrderedCleanup === true) {
      queueOrderedSubmissionReceipt = submitQueueOrderedWork(
        device,
        [commandBuffer]
      );
    } else {
      device.queue.submit([commandBuffer]);
    }
    submissionObserved = true;

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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-hierarchy-aggregate-node-reduction',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.aggregateNodeByteLength,
        hostQueueFenceCount: 0
      }),
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
    successfulResult = result;
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
    completeSchroederSubmittedTemporaryCleanup({
      device,
      cleanup,
      deferredCleanupRequired: noFullReadback,
      queueOrderedCleanup,
      submissionObserved,
      queueOrderedSubmissionReceipt,
      resultAuthority: successfulResult
    });
  }
}

export async function runSchroederFarAggregateCandidateWebGpu({
  device,
  activeNodeList,
  hierarchyAggregateNode,
  retainFarAggregateCandidateBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  candidateBudget = DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET,
  enabledFarLawMask = SCHROEDER_FAR_AGGREGATE_LAW_MASK,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  openingTheta = DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA,
  nearFieldSupportScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_NEAR_FIELD_SUPPORT_SCALE,
  farFieldErrorBound = DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  queueEpoch = 0,
  stateFamilyId = 1
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederFarAggregateCandidateWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederFarAggregateCandidatePlan({
    activeNodeList,
    hierarchyAggregateNode,
    candidateBudget,
    enabledFarLawMask,
    baseGridSpacingM,
    openingTheta,
    nearFieldSupportScale,
    farFieldErrorBound,
    queueEpoch,
    stateFamilyId
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedActiveNodeBuffer = activeNodeList?.activeNodeBuffer || null;
  const activeNodeRows = activeNodeList?.activeNodes instanceof Float32Array
    ? activeNodeList.activeNodes
    : null;
  if (!borrowedActiveNodeBuffer && !(activeNodeRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-aggregate candidates require a retained active-node buffer or explicit rows');
  }
  const borrowedAggregateNodeBuffer = hierarchyAggregateNode?.aggregateNodeBuffer || null;
  const aggregateNodeRows = hierarchyAggregateNode?.aggregateNodeRows instanceof Float32Array
    ? hierarchyAggregateNode.aggregateNodeRows
    : null;
  if (!borrowedAggregateNodeBuffer && !(aggregateNodeRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-aggregate candidates require a retained aggregate-node buffer or explicit rows');
  }

  const activeNodeBuffer = borrowedActiveNodeBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-far-aggregate-active-node-in', activeNodeRows);
  const aggregateNodeBuffer = borrowedAggregateNodeBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-far-aggregate-node-in', aggregateNodeRows);
  const farAggregateCandidateBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-candidates-out',
    size: plan.farAggregateCandidateByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsArray = createSchroederFarAggregateCandidateParamsArray(plan);
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-candidates-params',
    size: paramsArray.byteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-far-aggregate-candidates-readback',
      size: plan.farAggregateCandidateByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedFarAggregateCandidateBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray);
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-far-aggregate-candidates.v0',
      label: 'ulg-schroeder-far-aggregate-candidates',
      code: schroederFarAggregateCandidateWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: activeNodeBuffer } },
        { binding: 1, resource: { buffer: aggregateNodeBuffer } },
        { binding: 2, resource: { buffer: farAggregateCandidateBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.farAggregateCandidateCount / SCHROEDER_FAR_AGGREGATE_CANDIDATE_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(
        farAggregateCandidateBuffer,
        0,
        readBuffer,
        0,
        plan.farAggregateCandidateByteLength
      );
    }
    device.queue.submit([encoder.finish()]);

    let farAggregateCandidateRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      farAggregateCandidateRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.farAggregateCandidateCount * SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_EXECUTION_SCHEMA,
      farAggregateCandidateSchema: plan.schema,
      status: 'schroeder-far-aggregate-candidates-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_FAR_AGGREGATE_CANDIDATE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedFarAggregateCandidateBuffer: Boolean(retainFarAggregateCandidateBuffer),
      farAggregateCandidateBufferByteLength: plan.farAggregateCandidateByteLength,
      farAggregateCandidateRows,
      traversalMode: plan.traversalMode,
      aggregateAdmissibilityStatus: plan.aggregateAdmissibilityStatus,
      exactNearFieldRequirement: plan.exactNearFieldRequirement,
      conservationStatus: plan.conservationStatus,
      stateMutationStatus: 'far-aggregate-candidates-buffer-submitted-no-state-mutation',
      stateAuthorityStatus: 'state-manager-admitted-aggregate-node-source-consumed',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainFarAggregateCandidateBuffer) {
      result.farAggregateCandidateBuffer = farAggregateCandidateBuffer;
      result.destroyFarAggregateCandidateBuffer = () => farAggregateCandidateBuffer.destroy?.();
      returnedRetainedFarAggregateCandidateBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedActiveNodeBuffer) activeNodeBuffer.destroy?.();
      if (!borrowedAggregateNodeBuffer) aggregateNodeBuffer.destroy?.();
      if (!retainFarAggregateCandidateBuffer || !returnedRetainedFarAggregateCandidateBuffer) {
        farAggregateCandidateBuffer.destroy?.();
      }
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

export async function runSchroederFarAggregateForceSummaryWebGpu({
  device,
  farAggregateCandidates,
  retainForceSummaryBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  candidateBudget = farAggregateCandidates?.candidateBudget ?? DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET,
  enabledFarLawMask = farAggregateCandidates?.enabledFarLawMask ?? SCHROEDER_FAR_AGGREGATE_LAW_MASK,
  gravitationalConstant = DEFAULT_SCHROEDER_FAR_AGGREGATE_GRAVITATIONAL_CONSTANT,
  softeningLengthM = DEFAULT_SCHROEDER_FAR_AGGREGATE_SOFTENING_LENGTH_M,
  forceScale = DEFAULT_SCHROEDER_FAR_AGGREGATE_FORCE_SCALE,
  farFieldErrorBound = farAggregateCandidates?.farFieldErrorBound ?? DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  queueEpoch = farAggregateCandidates?.queueEpoch ?? 0,
  stateFamilyId = farAggregateCandidates?.stateFamilyId ?? 1
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederFarAggregateForceSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederFarAggregateForceSummaryPlan({
    farAggregateCandidates,
    candidateBudget,
    enabledFarLawMask,
    gravitationalConstant,
    softeningLengthM,
    forceScale,
    farFieldErrorBound,
    queueEpoch,
    stateFamilyId
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedFarCandidateBuffer = farAggregateCandidates?.farAggregateCandidateBuffer || null;
  const farAggregateCandidateRows = farAggregateCandidates?.farAggregateCandidateRows instanceof Float32Array
    ? farAggregateCandidates.farAggregateCandidateRows
    : null;
  if (!borrowedFarCandidateBuffer && !(farAggregateCandidateRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-aggregate force summary requires a retained far-aggregate candidate buffer or explicit rows');
  }

  const farAggregateCandidateBuffer = borrowedFarCandidateBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-far-aggregate-force-candidates-in', farAggregateCandidateRows);
  const forceSummaryBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-force-summary-out',
    size: plan.forceSummaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsArray = createSchroederFarAggregateForceSummaryParamsArray(plan);
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-force-summary-params',
    size: paramsArray.byteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-far-aggregate-force-summary-readback',
      size: plan.forceSummaryByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedForceSummaryBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray);
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-far-aggregate-force-summary.v0',
      label: 'ulg-schroeder-far-aggregate-force-summary',
      code: schroederFarAggregateForceSummaryWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: farAggregateCandidateBuffer } },
        { binding: 1, resource: { buffer: forceSummaryBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.activeNodeCount / SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(forceSummaryBuffer, 0, readBuffer, 0, plan.forceSummaryByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let forceSummaryRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      forceSummaryRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.forceSummaryRowCount * SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
      farAggregateForceSummarySchema: plan.schema,
      status: 'schroeder-far-aggregate-force-summary-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_FAR_AGGREGATE_FORCE_SUMMARY_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedForceSummaryBuffer: Boolean(retainForceSummaryBuffer),
      forceSummaryBufferByteLength: plan.forceSummaryByteLength,
      forceSummaryRows,
      aggregateAdmissibilityStatus: plan.aggregateAdmissibilityStatus,
      errorBoundStatus: plan.errorBoundStatus,
      conservationStatus: plan.conservationStatus,
      stateMutationRequired: false,
      stateMutationStatus: plan.stateMutationStatus,
      stateAuthorityStatus: plan.stateAuthorityStatus,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainForceSummaryBuffer) {
      result.forceSummaryBuffer = forceSummaryBuffer;
      result.destroyForceSummaryBuffer = () => forceSummaryBuffer.destroy?.();
      returnedRetainedForceSummaryBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedFarCandidateBuffer) farAggregateCandidateBuffer.destroy?.();
      if (!retainForceSummaryBuffer || !returnedRetainedForceSummaryBuffer) forceSummaryBuffer.destroy?.();
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

export async function runSchroederFarAggregateDiagnosticSummaryWebGpu({
  device,
  farAggregateForceSummary,
  openingTheta = farAggregateForceSummary?.openingTheta ?? DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA,
  farFieldErrorBound = farAggregateForceSummary?.farFieldErrorBound ?? DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  accelerationPressureThreshold = DEFAULT_SCHROEDER_FAR_AGGREGATE_ACCELERATION_PRESSURE_THRESHOLD,
  queueEpoch = farAggregateForceSummary?.queueEpoch ?? 0,
  stateFamilyId = farAggregateForceSummary?.stateFamilyId ?? 1,
  retainDiagnosticSummaryBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederFarAggregateDiagnosticSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederFarAggregateDiagnosticSummaryPlan({
    farAggregateForceSummary,
    openingTheta,
    farFieldErrorBound,
    accelerationPressureThreshold,
    queueEpoch,
    stateFamilyId
  });
  const compactSummaryReadback = readbackMode === SCHROEDER_COMPACT_FAR_AGGREGATE_DIAGNOSTIC_READBACK_MODE;
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedForceSummaryBuffer = farAggregateForceSummary?.forceSummaryBuffer || null;
  const forceSummaryRows = farAggregateForceSummary?.forceSummaryRows instanceof Float32Array
    ? farAggregateForceSummary.forceSummaryRows
    : null;
  if (!borrowedForceSummaryBuffer && !(forceSummaryRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-aggregate diagnostic summary requires a retained force-summary buffer or explicit rows');
  }

  const forceSummaryBuffer = borrowedForceSummaryBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-far-aggregate-diagnostic-summary-in', forceSummaryRows);
  const diagnosticSummaryBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-diagnostic-summary-out',
    size: plan.diagnosticSummaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsArray = createSchroederFarAggregateDiagnosticSummaryParamsArray(plan);
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-diagnostic-summary-params',
    size: paramsArray.byteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = compactSummaryReadback
    ? device.createBuffer({
      label: 'ulg-schroeder-far-aggregate-diagnostic-summary-readback',
      size: plan.diagnosticSummaryByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    })
    : null;
  let returnedRetainedDiagnosticSummaryBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray);
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-far-aggregate-diagnostic-summary.v0',
      label: 'ulg-schroeder-far-aggregate-diagnostic-summary',
      code: schroederFarAggregateDiagnosticSummaryWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: forceSummaryBuffer } },
        { binding: 1, resource: { buffer: diagnosticSummaryBuffer } },
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
      encoder.copyBufferToBuffer(
        diagnosticSummaryBuffer,
        0,
        readBuffer,
        0,
        plan.diagnosticSummaryByteLength
      );
    }
    device.queue.submit([encoder.finish()]);

    let diagnosticSummaryRows = new Float32Array();
    if (compactSummaryReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      diagnosticSummaryRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
      farAggregateDiagnosticSummarySchema: plan.schema,
      status: 'schroeder-far-aggregate-diagnostic-summary-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode,
      compactSummaryReadbackPerformed: compactSummaryReadback,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedDiagnosticSummaryBuffer: Boolean(retainDiagnosticSummaryBuffer),
      diagnosticSummaryBufferByteLength: plan.diagnosticSummaryByteLength,
      diagnosticSummaryRows,
      summaryRows: diagnosticSummaryRows,
      diagnosticStatus: 'far-aggregate-diagnostics-submitted',
      farFieldQualityStatus: 'far-aggregate-force-quality-pressure-submitted',
      conservationStatus: 'diagnostic-summary-only-no-state-mutation',
      stateMutationRequired: false,
      stateMutationStatus: plan.stateMutationStatus,
      stateAuthorityStatus: plan.stateAuthorityStatus,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainDiagnosticSummaryBuffer) {
      result.diagnosticSummaryBuffer = diagnosticSummaryBuffer;
      result.destroyDiagnosticSummaryBuffer = () => diagnosticSummaryBuffer.destroy?.();
      returnedRetainedDiagnosticSummaryBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedForceSummaryBuffer) forceSummaryBuffer.destroy?.();
      if (!retainDiagnosticSummaryBuffer || !returnedRetainedDiagnosticSummaryBuffer) {
        diagnosticSummaryBuffer.destroy?.();
      }
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

export async function runSchroederFarAggregateLawConsumerWebGpu({
  device,
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
  stateFamilyId = farAggregateForceSummary?.stateFamilyId ?? 1,
  retainLawConsumerBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederFarAggregateLawConsumerWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederFarAggregateLawConsumerPlan({
    farAggregateForceSummary,
    farAggregateDiagnosticSummary,
    farAggregateLawConsumerAdmission,
    enabledConsumerLawMask,
    radiationScale,
    plasmaScale,
    gasSummaryScale,
    gasTemperatureK,
    gasConstantProxy,
    maxFarFieldErrorBound,
    maxOpeningRatio,
    queueEpoch,
    stateFamilyId
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  if (!plan.farAggregateLawConsumerAdmissionApproved) {
    return {
      ...plan,
      schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA,
      farAggregateLawConsumerSchema: plan.schema,
      status: 'schroeder-far-aggregate-law-consumer-blocked-admission-required',
      backend: 'webgpu',
      readbackMode,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedLawConsumerBuffer: false,
      lawConsumerBufferByteLength: 0,
      lawConsumerRows: new Float32Array(),
      conservationStatus: 'law-consumer-blocked-admission-required',
      stateMutationRequired: false,
      stateMutationStatus: 'blocked-far-aggregate-law-consumer-admission-required',
      stateAuthorityStatus: 'requires-state-manager-admission-before-far-aggregate-law-consumer',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  const borrowedForceSummaryBuffer = farAggregateForceSummary?.forceSummaryBuffer || null;
  const forceSummaryRows = farAggregateForceSummary?.forceSummaryRows instanceof Float32Array
    ? farAggregateForceSummary.forceSummaryRows
    : null;
  if (!borrowedForceSummaryBuffer && !(forceSummaryRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-aggregate law consumer requires a retained force-summary buffer or explicit rows');
  }
  const borrowedDiagnosticSummaryBuffer = farAggregateDiagnosticSummary?.diagnosticSummaryBuffer
    || farAggregateDiagnosticSummary?.summaryBuffer
    || null;
  const diagnosticSummaryRows = farAggregateDiagnosticSummary?.diagnosticSummaryRows instanceof Float32Array
    ? farAggregateDiagnosticSummary.diagnosticSummaryRows
    : (farAggregateDiagnosticSummary?.summaryRows instanceof Float32Array
        ? farAggregateDiagnosticSummary.summaryRows
        : null);
  if (!borrowedDiagnosticSummaryBuffer && !(diagnosticSummaryRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-aggregate law consumer requires retained compact diagnostics or explicit rows');
  }

  const forceSummaryBuffer = borrowedForceSummaryBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-far-aggregate-law-consumer-force-summary-in', forceSummaryRows);
  const diagnosticSummaryBuffer = borrowedDiagnosticSummaryBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-far-aggregate-law-consumer-diagnostic-summary-in', diagnosticSummaryRows);
  const lawConsumerBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-law-consumer-out',
    size: plan.lawConsumerByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsArray = createSchroederFarAggregateLawConsumerParamsArray({
    ...plan,
    admissionApproved: plan.farAggregateLawConsumerAdmissionApproved
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-law-consumer-params',
    size: paramsArray.byteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-far-aggregate-law-consumer-readback',
      size: plan.lawConsumerByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedLawConsumerBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray);
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-far-aggregate-law-consumer.v0',
      label: 'ulg-schroeder-far-aggregate-law-consumer',
      code: schroederFarAggregateLawConsumerWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: forceSummaryBuffer } },
        { binding: 1, resource: { buffer: diagnosticSummaryBuffer } },
        { binding: 2, resource: { buffer: lawConsumerBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.lawConsumerRowCount / SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(
        lawConsumerBuffer,
        0,
        readBuffer,
        0,
        plan.lawConsumerByteLength
      );
    }
    device.queue.submit([encoder.finish()]);

    let lawConsumerRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      lawConsumerRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.lawConsumerRowCount * SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA,
      farAggregateLawConsumerSchema: plan.schema,
      status: 'schroeder-far-aggregate-law-consumer-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_FAR_AGGREGATE_LAW_CONSUMER_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedLawConsumerBuffer: Boolean(retainLawConsumerBuffer),
      lawConsumerBufferByteLength: plan.lawConsumerByteLength,
      lawConsumerRows,
      consumerMode: plan.consumerMode,
      aggregateAdmissibilityStatus: plan.aggregateAdmissibilityStatus,
      exactNearFieldRequirement: plan.exactNearFieldRequirement,
      diagnosticPressurePolicy: plan.diagnosticPressurePolicy,
      conservationStatus: 'law-consumer-summary-submitted-no-state-mutation',
      stateMutationRequired: false,
      stateMutationStatus: 'admitted-far-aggregate-law-consumer-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-read-only-far-aggregate-law-consumer',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainLawConsumerBuffer) {
      result.lawConsumerBuffer = lawConsumerBuffer;
      result.destroyLawConsumerBuffer = () => lawConsumerBuffer.destroy?.();
      returnedRetainedLawConsumerBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedForceSummaryBuffer) forceSummaryBuffer.destroy?.();
      if (!borrowedDiagnosticSummaryBuffer) diagnosticSummaryBuffer.destroy?.();
      if (!retainLawConsumerBuffer || !returnedRetainedLawConsumerBuffer) {
        lawConsumerBuffer.destroy?.();
      }
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

export async function runSchroederFarAggregateLawConsumerDiagnosticSummaryWebGpu({
  device,
  farAggregateLawConsumer,
  radiationPressureThreshold =
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_RADIATION_PRESSURE_THRESHOLD,
  plasmaPressureThreshold =
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_PLASMA_PRESSURE_THRESHOLD,
  gasPressureThreshold =
    DEFAULT_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_GAS_PRESSURE_THRESHOLD,
  queueEpoch = farAggregateLawConsumer?.queueEpoch ?? 0,
  stateFamilyId = farAggregateLawConsumer?.stateFamilyId ?? 1,
  retainDiagnosticSummaryBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError(
      'runSchroederFarAggregateLawConsumerDiagnosticSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer'
    );
  }
  const plan = createSchroederFarAggregateLawConsumerDiagnosticSummaryPlan({
    farAggregateLawConsumer,
    radiationPressureThreshold,
    plasmaPressureThreshold,
    gasPressureThreshold,
    queueEpoch,
    stateFamilyId
  });
  const compactSummaryReadback =
    readbackMode === SCHROEDER_COMPACT_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_READBACK_MODE;
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedLawConsumerBuffer = farAggregateLawConsumer?.lawConsumerBuffer || null;
  const lawConsumerRows = farAggregateLawConsumer?.lawConsumerRows instanceof Float32Array
    ? farAggregateLawConsumer.lawConsumerRows
    : null;
  if (!borrowedLawConsumerBuffer && !(lawConsumerRows instanceof Float32Array)) {
    throw new TypeError(
      'Schroeder far-aggregate law consumer diagnostic summary requires a retained law-consumer buffer or explicit rows'
    );
  }

  const lawConsumerBuffer = borrowedLawConsumerBuffer
    || writeStorageBuffer(
      device,
      'ulg-schroeder-far-aggregate-law-consumer-diagnostic-summary-in',
      lawConsumerRows
    );
  const diagnosticSummaryBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-law-consumer-diagnostic-summary-out',
    size: plan.lawConsumerDiagnosticSummaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsArray = createSchroederFarAggregateLawConsumerDiagnosticSummaryParamsArray(plan);
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-law-consumer-diagnostic-summary-params',
    size: paramsArray.byteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = compactSummaryReadback
    ? device.createBuffer({
      label: 'ulg-schroeder-far-aggregate-law-consumer-diagnostic-summary-readback',
      size: plan.lawConsumerDiagnosticSummaryByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    })
    : null;
  let returnedRetainedDiagnosticSummaryBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray);
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-far-aggregate-law-consumer-diagnostic-summary.v0',
      label: 'ulg-schroeder-far-aggregate-law-consumer-diagnostic-summary',
      code: schroederFarAggregateLawConsumerDiagnosticSummaryWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: lawConsumerBuffer } },
        { binding: 1, resource: { buffer: diagnosticSummaryBuffer } },
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
      encoder.copyBufferToBuffer(
        diagnosticSummaryBuffer,
        0,
        readBuffer,
        0,
        plan.lawConsumerDiagnosticSummaryByteLength
      );
    }
    device.queue.submit([encoder.finish()]);

    let diagnosticSummaryRows = new Float32Array();
    if (compactSummaryReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      diagnosticSummaryRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
      farAggregateLawConsumerDiagnosticSummarySchema: plan.schema,
      status: 'schroeder-far-aggregate-law-consumer-diagnostic-summary-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode,
      compactSummaryReadbackPerformed: compactSummaryReadback,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedDiagnosticSummaryBuffer: Boolean(retainDiagnosticSummaryBuffer),
      retainedLawConsumerDiagnosticSummaryBuffer: Boolean(retainDiagnosticSummaryBuffer),
      diagnosticSummaryBufferByteLength: plan.lawConsumerDiagnosticSummaryByteLength,
      lawConsumerDiagnosticSummaryBufferByteLength: plan.lawConsumerDiagnosticSummaryByteLength,
      diagnosticSummaryRows,
      lawConsumerDiagnosticSummaryRows: diagnosticSummaryRows,
      summaryRows: diagnosticSummaryRows,
      diagnosticStatus: 'far-aggregate-law-consumer-diagnostics-submitted',
      farFieldConsumerQualityStatus: 'far-aggregate-law-consumer-pressure-diagnostics-submitted',
      conservationStatus: 'law-consumer-diagnostic-summary-only-no-state-mutation',
      stateMutationRequired: false,
      stateMutationStatus: plan.stateMutationStatus,
      stateAuthorityStatus: plan.stateAuthorityStatus,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainDiagnosticSummaryBuffer) {
      result.diagnosticSummaryBuffer = diagnosticSummaryBuffer;
      result.lawConsumerDiagnosticSummaryBuffer = diagnosticSummaryBuffer;
      result.destroyDiagnosticSummaryBuffer = () => diagnosticSummaryBuffer.destroy?.();
      result.destroyLawConsumerDiagnosticSummaryBuffer = result.destroyDiagnosticSummaryBuffer;
      returnedRetainedDiagnosticSummaryBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedLawConsumerBuffer) lawConsumerBuffer.destroy?.();
      if (!retainDiagnosticSummaryBuffer || !returnedRetainedDiagnosticSummaryBuffer) {
        diagnosticSummaryBuffer.destroy?.();
      }
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

export async function runSchroederFarAggregateGasStateDeltaWebGpu({
  device,
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
  targetFamilyId = 1,
  retainGasStateDeltaBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederFarAggregateGasStateDeltaWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederFarAggregateGasStateDeltaPlan({
    farAggregateLawConsumer,
    farAggregateLawConsumerAuthorityPolicy,
    farAggregateGasStateDeltaAdmission,
    referencePressurePa,
    pressureDeltaScale,
    densityDeltaScale,
    gasGamma,
    enabledConsumerLawMask,
    queueEpoch,
    stateFamilyId,
    targetFamilyId
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  if (!plan.farAggregateGasStateDeltaAdmissionApproved) {
    const policyBlocked = !plan.authorityPolicyAccepted;
    return {
      ...plan,
      schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA,
      farAggregateGasStateDeltaSchema: plan.schema,
      status: policyBlocked
        ? 'schroeder-far-aggregate-gas-state-delta-blocked-authority-policy-read-only'
        : 'schroeder-far-aggregate-gas-state-delta-blocked-admission-required',
      backend: 'webgpu',
      readbackMode,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-far-aggregate-gas-state-delta-blocked',
        mapAsyncCount: 0,
        readbackBytes: 0,
        hostQueueFenceCount: 0
      }),
      retainedGasStateDeltaBuffer: false,
      gasStateDeltaBufferByteLength: 0,
      gasStateDeltaRows: new Float32Array(),
      stateDeltaRows: new Float32Array(),
      pressureInterfaceImportRequired: false,
      stateMutationRequired: false,
      stateMutationStatus: policyBlocked
        ? 'blocked-far-aggregate-gas-state-delta-authority-policy-read-only'
        : 'blocked-far-aggregate-gas-state-delta-admission-required',
      stateAuthorityStatus: policyBlocked
        ? 'requires-authority-policy-state-delta-before-gas-state-delta'
        : 'requires-state-manager-admission-before-far-aggregate-gas-state-delta',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  const borrowedLawConsumerBuffer = farAggregateLawConsumer?.lawConsumerBuffer || null;
  const lawConsumerRows = farAggregateLawConsumer?.lawConsumerRows instanceof Float32Array
    ? farAggregateLawConsumer.lawConsumerRows
    : null;
  if (!borrowedLawConsumerBuffer && !(lawConsumerRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-aggregate gas state-delta requires a retained law-consumer buffer or explicit rows');
  }

  const lawConsumerBuffer = borrowedLawConsumerBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-far-aggregate-gas-state-delta-law-consumer-in', lawConsumerRows);
  const gasStateDeltaBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-gas-state-delta-out',
    size: plan.gasStateDeltaByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsArray = createSchroederFarAggregateGasStateDeltaParamsArray({
    ...plan,
    admissionApproved: plan.farAggregateGasStateDeltaAdmissionApproved
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-gas-state-delta-params',
    size: paramsArray.byteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-far-aggregate-gas-state-delta-readback',
      size: plan.gasStateDeltaByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedGasStateDeltaBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray);
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-far-aggregate-gas-state-delta.v0',
      label: 'ulg-schroeder-far-aggregate-gas-state-delta',
      code: schroederFarAggregateGasStateDeltaWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: lawConsumerBuffer } },
        { binding: 1, resource: { buffer: gasStateDeltaBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.gasStateDeltaRowCount / SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(
        gasStateDeltaBuffer,
        0,
        readBuffer,
        0,
        plan.gasStateDeltaByteLength
      );
    }
    device.queue.submit([encoder.finish()]);

    let gasStateDeltaRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      gasStateDeltaRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.gasStateDeltaRowCount * SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA,
      farAggregateGasStateDeltaSchema: plan.schema,
      status: 'schroeder-far-aggregate-gas-state-delta-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_FAR_AGGREGATE_GAS_STATE_DELTA_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-far-aggregate-gas-state-delta',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.gasStateDeltaByteLength,
        hostQueueFenceCount: 0
      }),
      retainedGasStateDeltaBuffer: Boolean(retainGasStateDeltaBuffer),
      gasStateDeltaBufferByteLength: plan.gasStateDeltaByteLength,
      stateDeltaBufferByteLength: plan.gasStateDeltaByteLength,
      gasStateDeltaRows,
      stateDeltaRows: gasStateDeltaRows,
      conservationStatus: 'pending-gas-pressure-state-delta-requires-admitted-import',
      stateMutationRequired: true,
      stateMutationStatus: 'admitted-far-aggregate-gas-state-delta-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-retained-gas-state-delta-buffer',
      pressureInterfaceImportRequired: true,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainGasStateDeltaBuffer) {
      result.gasStateDeltaBuffer = gasStateDeltaBuffer;
      result.stateDeltaBuffer = gasStateDeltaBuffer;
      result.destroyGasStateDeltaBuffer = () => gasStateDeltaBuffer.destroy?.();
      result.destroyStateDeltaBuffer = result.destroyGasStateDeltaBuffer;
      returnedRetainedGasStateDeltaBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedLawConsumerBuffer) lawConsumerBuffer.destroy?.();
      if (!retainGasStateDeltaBuffer || !returnedRetainedGasStateDeltaBuffer) {
        gasStateDeltaBuffer.destroy?.();
      }
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

function gasCellFieldSnapshotFromSchroederRows(rows, rowStrideFloats = SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS) {
  if (!(rows instanceof Float32Array) || rows.length <= 0) return null;
  const stride = Math.max(1, Math.round(finiteNumber(rowStrideFloats, SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS)));
  const cells = [];
  for (let offset = 0, index = 0; offset + 11 < rows.length; offset += stride, index += 1) {
    const status = rows[offset + 3];
    const pressurePa = rows[offset + 7];
    if (!(status > 0) || !(pressurePa >= 0)) continue;
    cells.push({
      index,
      gridIndex: [
        Math.max(0, Math.round(finiteNumber(rows[offset], 0))),
        Math.max(0, Math.round(finiteNumber(rows[offset + 1], 0))),
        Math.max(0, Math.round(finiteNumber(rows[offset + 2], 0)))
      ],
      centerM: [
        finiteNumber(rows[offset + 4], 0),
        finiteNumber(rows[offset + 5], 0),
        finiteNumber(rows[offset + 6], 0)
      ],
      pressurePa,
      pressureGradientPaPerM: [
        finiteNumber(rows[offset + 8], 0),
        finiteNumber(rows[offset + 9], 0),
        finiteNumber(rows[offset + 10], 0)
      ],
      volumeM3: Math.max(0, finiteNumber(rows[offset + 11], 0)),
      status: 'local-gas-pressure-cell-ready'
    });
  }
  if (cells.length <= 0) return null;
  return {
    schema: 'peercompute.ulg.sph-local-pressure-gradient-field.v0',
    status: 'gas-cell-pressure-field-ready',
    source: 'schroeder-far-aggregate-gas-cell-import',
    pressureFieldMode: 'local-gas-cell-pressure-gradient',
    pressureFieldResolution: 'structured-gas-cell-grid',
    pressureGradientStatus: 'schroeder-far-aggregate-gas-pressure-cells-materialized',
    localPressureGradientReady: true,
    localPressureGradientStatus: 'local-pressure-gradient-ready',
    localPressureGradientValidation: false,
    cells
  };
}

export async function runSchroederFarAggregateGasCellImportWebGpu({
  device,
  farAggregateGasStateDelta,
  farAggregateForceSummary,
  defaultCellVolumeM3 = 0,
  queueEpoch = farAggregateGasStateDelta?.queueEpoch ?? farAggregateForceSummary?.queueEpoch ?? 0,
  stateFamilyId = farAggregateGasStateDelta?.stateFamilyId ?? 1,
  targetFamilyId = farAggregateGasStateDelta?.targetFamilyId ?? 1,
  retainGasPressureCellsBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederFarAggregateGasCellImportWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederFarAggregateGasCellImportPlan({
    farAggregateGasStateDelta,
    farAggregateForceSummary,
    defaultCellVolumeM3,
    queueEpoch,
    stateFamilyId,
    targetFamilyId
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedGasStateDeltaBuffer =
    farAggregateGasStateDelta?.gasStateDeltaBuffer || farAggregateGasStateDelta?.stateDeltaBuffer || null;
  const gasStateDeltaRows = farAggregateGasStateDelta?.gasStateDeltaRows instanceof Float32Array
    ? farAggregateGasStateDelta.gasStateDeltaRows
    : (farAggregateGasStateDelta?.stateDeltaRows instanceof Float32Array
        ? farAggregateGasStateDelta.stateDeltaRows
        : null);
  const borrowedForceSummaryBuffer = farAggregateForceSummary?.forceSummaryBuffer || null;
  const forceSummaryRows = farAggregateForceSummary?.forceSummaryRows instanceof Float32Array
    ? farAggregateForceSummary.forceSummaryRows
    : null;
  if (!borrowedGasStateDeltaBuffer && !(gasStateDeltaRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-aggregate gas-cell import requires a retained gas state-delta buffer or explicit rows');
  }
  if (!borrowedForceSummaryBuffer && !(forceSummaryRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-aggregate gas-cell import requires a retained force-summary buffer or explicit rows');
  }

  const gasStateDeltaBuffer = borrowedGasStateDeltaBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-far-aggregate-gas-cell-import-delta-in', gasStateDeltaRows);
  const forceSummaryBuffer = borrowedForceSummaryBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-far-aggregate-gas-cell-import-force-summary-in', forceSummaryRows);
  const gasPressureCellsBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-gas-cell-import-pressure-cells-out',
    size: plan.gasPressureCellRowByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsArray = createSchroederFarAggregateGasCellImportParamsArray({
    ...plan,
    defaultCellVolumeM3: plan.defaultCellVolumeM3
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-gas-cell-import-params',
    size: paramsArray.byteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-far-aggregate-gas-cell-import-readback',
      size: plan.gasPressureCellRowByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedGasPressureCellsBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray);
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-far-aggregate-gas-cell-import.v0',
      label: 'ulg-schroeder-far-aggregate-gas-cell-import',
      code: schroederFarAggregateGasCellImportWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'storage'),
        computeBufferBinding(3, 'uniform')
      ]
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: gasStateDeltaBuffer } },
        { binding: 1, resource: { buffer: forceSummaryBuffer } },
        { binding: 2, resource: { buffer: gasPressureCellsBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.gasPressureCellRowCount / SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(
        gasPressureCellsBuffer,
        0,
        readBuffer,
        0,
        plan.gasPressureCellRowByteLength
      );
    }
    device.queue.submit([encoder.finish()]);

    let gasPressureCellRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      gasPressureCellRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.gasPressureCellRowCount * SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS
      );
      readBuffer.unmap();
    }
    const gasCellFieldSnapshot = gasCellFieldSnapshotFromSchroederRows(
      gasPressureCellRows,
      SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS
    );
    const result = {
      ...plan,
      schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA,
      farAggregateGasCellImportSchema: plan.schema,
      status: 'schroeder-far-aggregate-gas-cell-import-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_FAR_AGGREGATE_GAS_CELL_IMPORT_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-far-aggregate-gas-cell-import',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.gasPressureCellRowByteLength,
        hostQueueFenceCount: 0
      }),
      gasPressureCellRows,
      gasPressureCellRowsBufferRetained: Boolean(retainGasPressureCellsBuffer),
      pressureInterfaceGasPressureCellRowsBufferRetained: Boolean(retainGasPressureCellsBuffer),
      gasCellFieldSnapshot,
      gasCellField: gasCellFieldSnapshot,
      localPressureGradientReady: gasCellFieldSnapshot?.localPressureGradientReady === true,
      localPressureGradientStatus: gasCellFieldSnapshot
        ? 'local-pressure-gradient-ready'
        : 'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read',
      pressureInterfaceImportReady: true,
      retainedSourceFamilies: [SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_OUTPUT_FAMILY],
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainGasPressureCellsBuffer) {
      result.gasPressureCellsBuffer = gasPressureCellsBuffer;
      result.pressureInterfaceGasPressureCellsBuffer = gasPressureCellsBuffer;
      result.destroyGasPressureCellsBuffer = () => gasPressureCellsBuffer.destroy?.();
      returnedRetainedGasPressureCellsBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedGasStateDeltaBuffer) gasStateDeltaBuffer.destroy?.();
      if (!borrowedForceSummaryBuffer) forceSummaryBuffer.destroy?.();
      if (!retainGasPressureCellsBuffer || !returnedRetainedGasPressureCellsBuffer) {
        gasPressureCellsBuffer.destroy?.();
      }
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

export async function runSchroederFarAggregateForceApplicationWebGpu({
  device,
  farAggregateForceSummary,
  farAggregateDiagnosticSummary = null,
  sphParticleState,
  sphParticleUpload = null,
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
  stateFamilyId = farAggregateForceSummary?.stateFamilyId ?? 1,
  retainForceApplicationBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederFarAggregateForceApplicationWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederFarAggregateForceApplicationPlan({
    farAggregateForceSummary,
    farAggregateDiagnosticSummary,
    sphParticleState,
    farAggregateForceApplicationAdmission,
    dtS,
    accelerationScale,
    maxAccelerationMPerS2,
    maxFarFieldErrorBound,
    maxOpeningRatio,
    queueEpoch,
    stateFamilyId
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  if (!plan.farAggregateForceApplicationAdmissionApproved) {
    return {
      ...plan,
      schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA,
      farAggregateForceApplicationSchema: plan.schema,
      status: 'schroeder-far-aggregate-force-application-blocked-admission-required',
      backend: 'webgpu',
      readbackMode,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedForceApplicationBuffer: false,
      forceApplicationBufferByteLength: 0,
      forceApplicationRows: new Float32Array(),
      conservationStatus: 'force-application-blocked-admission-required',
      energyPolicy: plan.energyPolicy,
      stateMutationRequired: false,
      stateMutationStatus: 'blocked-far-aggregate-force-application-admission-required',
      stateAuthorityStatus: 'requires-state-manager-admission-before-far-force-application',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  const borrowedForceSummaryBuffer = farAggregateForceSummary?.forceSummaryBuffer || null;
  const forceSummaryRows = farAggregateForceSummary?.forceSummaryRows instanceof Float32Array
    ? farAggregateForceSummary.forceSummaryRows
    : null;
  if (!borrowedForceSummaryBuffer && !(forceSummaryRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-aggregate force application requires a retained force-summary buffer or explicit rows');
  }
  const borrowedStateBuffer =
    optionalSourceStateBuffer(sphParticleUpload)
    || sphParticleUpload?.stateBuffer
    || sphParticleState?.stateBuffer
    || null;
  const stateRows = sphParticleState?.state instanceof Float32Array ? sphParticleState.state : null;
  if (!borrowedStateBuffer && !(stateRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-aggregate force application requires retained/uploaded SPH state or explicit rows');
  }

  const forceSummaryBuffer = borrowedForceSummaryBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-far-aggregate-force-application-summary-in', forceSummaryRows);
  const stateBuffer = borrowedStateBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-far-aggregate-force-application-state-in', stateRows);
  const forceApplicationBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-force-application-out',
    size: plan.forceApplicationByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsArray = createSchroederFarAggregateForceApplicationParamsArray({
    ...plan,
    admissionApproved: plan.farAggregateForceApplicationAdmissionApproved
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-aggregate-force-application-params',
    size: paramsArray.byteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-far-aggregate-force-application-readback',
      size: plan.forceApplicationByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedForceApplicationBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray);
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-far-aggregate-force-application.v0',
      label: 'ulg-schroeder-far-aggregate-force-application',
      code: schroederFarAggregateForceApplicationWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: forceSummaryBuffer } },
        { binding: 1, resource: { buffer: stateBuffer } },
        { binding: 2, resource: { buffer: forceApplicationBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.forceApplicationRowCount / SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(
        forceApplicationBuffer,
        0,
        readBuffer,
        0,
        plan.forceApplicationByteLength
      );
    }
    device.queue.submit([encoder.finish()]);

    let forceApplicationRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      forceApplicationRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.forceApplicationRowCount * SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA,
      farAggregateForceApplicationSchema: plan.schema,
      status: 'schroeder-far-aggregate-force-application-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_FAR_AGGREGATE_FORCE_APPLICATION_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedForceApplicationBuffer: Boolean(retainForceApplicationBuffer),
      forceApplicationBufferByteLength: plan.forceApplicationByteLength,
      forceApplicationRows,
      conservationStatus: 'force-application-delta-submitted',
      energyPolicy: plan.energyPolicy,
      stateMutationRequired: true,
      stateMutationStatus: 'admitted-far-aggregate-force-application-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-retained-force-application-buffer',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainForceApplicationBuffer) {
      result.forceApplicationBuffer = forceApplicationBuffer;
      result.destroyForceApplicationBuffer = () => forceApplicationBuffer.destroy?.();
      returnedRetainedForceApplicationBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedForceSummaryBuffer) forceSummaryBuffer.destroy?.();
      if (!borrowedStateBuffer) stateBuffer.destroy?.();
      if (!retainForceApplicationBuffer || !returnedRetainedForceApplicationBuffer) {
        forceApplicationBuffer.destroy?.();
      }
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
  interfaceRefinementFieldView = null,
  physicalLiquidGrouping = false,
  sphParticleState = null,
  sphParticleUpload = null,
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
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  queueOrderedCleanup = false
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederPhaseVolumeMigrationWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const identityRequired = sphParticleUpload?.identityRequired === true
    || sphParticleStateRequiresExplicitIdentity(sphParticleState);
  const plan = createSchroederPhaseVolumeMigrationPlan({
    levelAssignment,
    hierarchyAggregateNode,
    identityRequired,
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
  if (interfaceRefinementFieldView) {
    const admission = validateSchroederSpatialMechanicsFieldViewDescriptor(interfaceRefinementFieldView, {
      physicalSourceCount: plan.particleCount
    });
    if (!admission.admitted || interfaceRefinementFieldView.sourceBuffer !== levelAssignment.assignmentBuffer
        || interfaceRefinementFieldView.identityBuffer !== sphParticleUpload?.identityBuffer) {
      throw new TypeError('Interface refinement requires the current admitted mechanics field and source family');
    }
  }
  plan.physicalLiquidGrouping = physicalLiquidGrouping === true && Boolean(interfaceRefinementFieldView);
  plan.flags = (interfaceRefinementFieldView ? 1 : 0) | (plan.physicalLiquidGrouping ? 2 : 0);
  plan.interfaceRefinementPolicy = interfaceRefinementFieldView
    ? (plan.physicalLiquidGrouping
      ? 'current-physical-support-fluid-interface-bounded-octet'
      : 'current-physical-support-condensed-neighbor-bounded-octet')
    : 'disabled';
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
  const borrowedIdentityBuffer = optionalSourceIdentityBuffer(sphParticleUpload);
  const identityRows = sphParticleState?.identity instanceof Uint32Array
    && sphParticleState.identity.length >= plan.particleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS
    ? sphParticleState.identity
    : null;
  if (identityRequired && !borrowedIdentityBuffer && !identityRows) {
    throw new TypeError(
      'Schroeder phase-volume migration requires identity for arbitrary render domains'
    );
  }
  const identityBuffer = borrowedIdentityBuffer
    || writeStorageBuffer(
      device,
      'ulg-schroeder-phase-volume-migration-identity-in',
      identityRows || new Uint32Array(plan.particleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS)
    );
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
  let submissionObserved = false;
  let successfulResult = null;
  let queueOrderedSubmissionReceipt = null;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederPhaseVolumeMigrationParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform'),
      computeBufferBinding(4, 'read-only-storage'),
      computeBufferBinding(5, 'read-only-storage')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-phase-volume-migration.v5',
      label: 'ulg-schroeder-phase-volume-migration',
      code: schroederPhaseVolumeMigrationWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: assignmentBuffer } },
        { binding: 1, resource: { buffer: aggregateNodeBuffer } },
        { binding: 2, resource: { buffer: migrationBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } },
        { binding: 4, resource: { buffer: identityBuffer } },
        { binding: 5, resource: { buffer: interfaceRefinementFieldView?.fieldViewBuffer || identityBuffer } }
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
    const commandBuffer = encoder.finish();
    if (queueOrderedCleanup === true) {
      queueOrderedSubmissionReceipt = submitQueueOrderedWork(
        device,
        [commandBuffer]
      );
    } else {
      device.queue.submit([commandBuffer]);
    }
    submissionObserved = true;

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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-phase-volume-migration',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.migrationByteLength,
        hostQueueFenceCount: 0
      }),
      retainedMigrationBuffer: Boolean(retainMigrationBuffer),
      migrationBufferByteLength: plan.migrationByteLength,
      migrationRows,
      phaseVolumeStatus: 'phase-volume-migration-submitted',
      migrationMode: 'physical-volume-level-target-with-aggregate-coherence',
      aggregateCoherenceRequirement: 'retained-aggregate-node-buffer-consumed',
      aggregateIdentityKeyMode: plan.aggregateIdentityKeyMode,
      identityRequired,
      refinePressurePolicy: plan.refinePressurePolicy,
      refinePressureReasonBits: [...SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS],
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
    successfulResult = result;
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedAssignmentBuffer) assignmentBuffer.destroy?.();
      if (!borrowedAggregateNodeBuffer) aggregateNodeBuffer.destroy?.();
      if (!borrowedIdentityBuffer) identityBuffer.destroy?.();
      if (!retainMigrationBuffer || !returnedRetainedMigrationBuffer) migrationBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    completeSchroederSubmittedTemporaryCleanup({
      device,
      cleanup,
      deferredCleanupRequired: noFullReadback,
      queueOrderedCleanup,
      submissionObserved,
      queueOrderedSubmissionReceipt,
      resultAuthority: successfulResult
    });
  }
}

export async function runSchroederPhaseVolumeSplitMergeProposalWebGpu({
  device,
  phaseVolumeMigration,
  hierarchyAggregateNode = null,
  proposalEpoch = phaseVolumeMigration?.migrationEpoch ?? 0,
  stateFamilyId = 1,
  coarsenModeId = 1,
  refineModeId = 2,
  retainProposalBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  queueOrderedCleanup = false
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError(
      'runSchroederPhaseVolumeSplitMergeProposalWebGpu requires a WebGPU-like device with queue.writeBuffer'
    );
  }
  const plan = createSchroederPhaseVolumeSplitMergeProposalPlan({
    phaseVolumeMigration,
    hierarchyAggregateNode,
    proposalEpoch,
    stateFamilyId,
    coarsenModeId,
    refineModeId
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedMigrationBuffer = phaseVolumeMigration?.migrationBuffer || null;
  const borrowedAggregateNodeBuffer = plan.aggregateNodeCount > 0
    ? (hierarchyAggregateNode?.aggregateNodeBuffer || null)
    : null;
  const aggregateNodeRows = plan.aggregateNodeCount > 0
    && hierarchyAggregateNode?.aggregateNodeRows instanceof Float32Array
    ? hierarchyAggregateNode.aggregateNodeRows
    : null;
  const migrationRows = phaseVolumeMigration?.migrationRows instanceof Float32Array
    ? phaseVolumeMigration.migrationRows
    : null;
  if (!borrowedMigrationBuffer && !(migrationRows instanceof Float32Array)) {
    throw new TypeError('Schroeder phase-volume split/merge proposals require a retained migration buffer or explicit rows');
  }

  const migrationBuffer = borrowedMigrationBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-phase-volume-split-merge-proposal-in', migrationRows);
  const aggregateNodeBuffer = borrowedAggregateNodeBuffer
    || writeStorageBuffer(
      device,
      'ulg-schroeder-phase-volume-split-merge-proposal-aggregate-nodes-in',
      aggregateNodeRows instanceof Float32Array && aggregateNodeRows.length >= SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
        ? aggregateNodeRows
        : new Float32Array(SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS)
    );
  const proposalBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-split-merge-proposal-out',
    size: plan.proposalByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-split-merge-proposal-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-phase-volume-split-merge-proposal-readback',
      size: plan.proposalByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedProposalBuffer = false;
  let submissionObserved = false;
  let successfulResult = null;
  let queueOrderedSubmissionReceipt = null;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederPhaseVolumeSplitMergeProposalParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform'),
      computeBufferBinding(3, 'read-only-storage')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-phase-volume-split-merge-proposal.v1',
      label: 'ulg-schroeder-phase-volume-split-merge-proposal',
      code: schroederPhaseVolumeSplitMergeProposalWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: migrationBuffer } },
        { binding: 1, resource: { buffer: proposalBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
        { binding: 3, resource: { buffer: aggregateNodeBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.migrationRowCount / SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(proposalBuffer, 0, readBuffer, 0, plan.proposalByteLength);
    }
    const commandBuffer = encoder.finish();
    if (queueOrderedCleanup === true) {
      queueOrderedSubmissionReceipt = submitQueueOrderedWork(
        device,
        [commandBuffer]
      );
    } else {
      device.queue.submit([commandBuffer]);
    }
    submissionObserved = true;

    let proposalRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      proposalRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.migrationRowCount * SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_EXECUTION_SCHEMA,
      phaseVolumeSplitMergeProposalSchema: plan.schema,
      status: 'schroeder-phase-volume-split-merge-proposal-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-phase-volume-split-merge-proposal',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.proposalByteLength,
        hostQueueFenceCount: 0
      }),
      retainedProposalBuffer: Boolean(retainProposalBuffer),
      proposalBufferByteLength: plan.proposalByteLength,
      proposalRows,
      proposalMode: 'proposal-only-no-particle-mutation',
      conservativeTransferStatus: 'split-merge-proposals-submitted-no-authoritative-transfer',
      stateMutationStatus: 'proposal-buffer-submitted-no-particle-mutation',
      stateAuthorityStatus: 'state-manager-admission-required-before-any-particle-count-mutation',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainProposalBuffer) {
      result.proposalBuffer = proposalBuffer;
      result.destroyProposalBuffer = () => proposalBuffer.destroy?.();
      returnedRetainedProposalBuffer = true;
    }
    successfulResult = result;
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedMigrationBuffer) migrationBuffer.destroy?.();
      if (!borrowedAggregateNodeBuffer) aggregateNodeBuffer.destroy?.();
      if (!retainProposalBuffer || !returnedRetainedProposalBuffer) proposalBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    completeSchroederSubmittedTemporaryCleanup({
      device,
      cleanup,
      deferredCleanupRequired: noFullReadback,
      queueOrderedCleanup,
      submissionObserved,
      queueOrderedSubmissionReceipt,
      resultAuthority: successfulResult
    });
  }
}

export async function runSchroederPhaseVolumeSplitMergeApplyWebGpu({
  device,
  phaseVolumeSplitMergeProposal,
  phaseVolumeSplitMergeAdmission = null,
  applyEpoch = phaseVolumeSplitMergeProposal?.proposalEpoch ?? 0,
  stateFamilyId = phaseVolumeSplitMergeProposal?.stateFamilyId ?? 1,
  residualTolerance = DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE,
  retainApplyBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError(
      'runSchroederPhaseVolumeSplitMergeApplyWebGpu requires a WebGPU-like device with queue.writeBuffer'
    );
  }
  const plan = createSchroederPhaseVolumeSplitMergeApplyPlan({
    phaseVolumeSplitMergeProposal,
    phaseVolumeSplitMergeAdmission,
    applyEpoch,
    stateFamilyId,
    residualTolerance
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  if (!plan.phaseVolumeSplitMergeAdmissionApproved) {
    return {
      ...plan,
      schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA,
      phaseVolumeSplitMergeApplySchema: plan.schema,
      status: 'schroeder-phase-volume-split-merge-apply-blocked-admission-required',
      backend: 'webgpu',
      readbackMode,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedApplyBuffer: false,
      applyBufferByteLength: 0,
      applyRows: new Float32Array(),
      conservativeTransferStatus: 'phase-volume-split-merge-apply-blocked-admission-required',
      stateMutationRequired: false,
      stateMutationStatus: 'blocked-phase-volume-split-merge-admission-required',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  const borrowedProposalBuffer = phaseVolumeSplitMergeProposal?.proposalBuffer || null;
  const proposalRows = phaseVolumeSplitMergeProposal?.proposalRows instanceof Float32Array
    ? phaseVolumeSplitMergeProposal.proposalRows
    : null;
  if (!borrowedProposalBuffer && !(proposalRows instanceof Float32Array)) {
    throw new TypeError('Schroeder phase-volume split/merge apply requires a retained proposal buffer or explicit rows');
  }
  const proposalBuffer = borrowedProposalBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-phase-volume-split-merge-apply-in', proposalRows);
  const applyBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-split-merge-apply-out',
    size: plan.applyByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-split-merge-apply-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-phase-volume-split-merge-apply-readback',
      size: plan.applyByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedApplyBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederPhaseVolumeSplitMergeApplyParamsArray({
      ...plan,
      admissionApproved: plan.phaseVolumeSplitMergeAdmissionApproved
    }));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-phase-volume-split-merge-apply.v0',
      label: 'ulg-schroeder-phase-volume-split-merge-apply',
      code: schroederPhaseVolumeSplitMergeApplyWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: proposalBuffer } },
        { binding: 1, resource: { buffer: applyBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.proposalRowCount / SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(applyBuffer, 0, readBuffer, 0, plan.applyByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let applyRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      applyRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.proposalRowCount * SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA,
      phaseVolumeSplitMergeApplySchema: plan.schema,
      status: 'schroeder-phase-volume-split-merge-apply-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_PHASE_VOLUME_SPLIT_MERGE_APPLY_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedApplyBuffer: Boolean(retainApplyBuffer),
      applyBufferByteLength: plan.applyByteLength,
      applyRows,
      conservativeTransferStatus: 'phase-volume-split-merge-apply-submitted',
      stateMutationStatus: 'phase-volume-split-merge-apply-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-phase-volume-split-merge-apply-materialized',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainApplyBuffer) {
      result.applyBuffer = applyBuffer;
      result.destroyApplyBuffer = () => applyBuffer.destroy?.();
      returnedRetainedApplyBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedProposalBuffer) proposalBuffer.destroy?.();
      if (!retainApplyBuffer || !returnedRetainedApplyBuffer) applyBuffer.destroy?.();
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

export async function runSchroederParticleStorageAllocationWebGpu({
  device,
  phaseVolumeSplitMergeApply,
  particleStorageAllocatorAdmission = null,
  allocatorEpoch = phaseVolumeSplitMergeApply?.applyEpoch ?? 0,
  stateFamilyId = phaseVolumeSplitMergeApply?.stateFamilyId ?? 1,
  currentParticleCapacity = phaseVolumeSplitMergeApply?.proposalRowCount ?? 0,
  requiredParticleCapacity = currentParticleCapacity,
  targetStateFamilyMask = SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK,
  preservePhaseSlots = false,
  retainAllocationBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError(
      'runSchroederParticleStorageAllocationWebGpu requires a WebGPU-like device with queue.writeBuffer'
    );
  }
  const plan = createSchroederParticleStorageAllocationPlan({
    phaseVolumeSplitMergeApply,
    particleStorageAllocatorAdmission,
    allocatorEpoch,
    stateFamilyId,
    currentParticleCapacity,
    requiredParticleCapacity,
    targetStateFamilyMask,
    preservePhaseSlots
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  if (!plan.particleStorageAllocatorAdmissionApproved) {
    return {
      ...plan,
      schema: ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA,
      particleStorageAllocationSchema: plan.schema,
      status: 'schroeder-particle-storage-allocation-blocked-admission-required',
      backend: 'webgpu',
      readbackMode,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedAllocationBuffer: false,
      allocationBufferByteLength: 0,
      allocationRows: new Float32Array(),
      conservativeTransferStatus: 'particle-storage-allocation-blocked-admission-required',
      stateMutationRequired: false,
      stateMutationStatus: 'blocked-particle-storage-allocator-admission-required',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  const borrowedApplyBuffer = phaseVolumeSplitMergeApply?.applyBuffer || null;
  const applyRows = phaseVolumeSplitMergeApply?.applyRows instanceof Float32Array
    ? phaseVolumeSplitMergeApply.applyRows
    : null;
  if (!borrowedApplyBuffer && !(applyRows instanceof Float32Array)) {
    throw new TypeError('Schroeder particle storage allocation requires a retained apply buffer or explicit rows');
  }
  const applyBuffer = borrowedApplyBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-particle-storage-allocation-in', applyRows);
  const allocationBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-allocation-out',
    size: plan.allocationByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-allocation-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-particle-storage-allocation-readback',
      size: plan.allocationByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedAllocationBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederParticleStorageAllocationParamsArray({
      ...plan,
      admissionApproved: plan.particleStorageAllocatorAdmissionApproved
    }));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-particle-storage-allocation.v2',
      label: 'ulg-schroeder-particle-storage-allocation',
      code: schroederParticleStorageAllocationWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: applyBuffer } },
        { binding: 1, resource: { buffer: allocationBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.applyRowCount / SCHROEDER_PARTICLE_STORAGE_ALLOCATION_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(allocationBuffer, 0, readBuffer, 0, plan.allocationByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let allocationRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      allocationRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.applyRowCount * SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA,
      particleStorageAllocationSchema: plan.schema,
      status: 'schroeder-particle-storage-allocation-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_PARTICLE_STORAGE_ALLOCATION_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedAllocationBuffer: Boolean(retainAllocationBuffer),
      allocationBufferByteLength: plan.allocationByteLength,
      allocationRows,
      conservativeTransferStatus: 'particle-storage-allocation-submitted',
      stateMutationStatus: 'particle-storage-allocation-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-particle-storage-allocation-materialized',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainAllocationBuffer) {
      result.allocationBuffer = allocationBuffer;
      result.destroyAllocationBuffer = () => allocationBuffer.destroy?.();
      returnedRetainedAllocationBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedApplyBuffer) applyBuffer.destroy?.();
      if (!retainAllocationBuffer || !returnedRetainedAllocationBuffer) allocationBuffer.destroy?.();
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

export async function runSchroederParticleStorageSlotAssignmentWebGpu({
  device,
  particleStorageAllocation,
  particleStorageFreeList,
  particleStorageSlotAssignmentAdmission = null,
  assignmentEpoch = particleStorageAllocation?.allocatorEpoch ?? 0,
  stateFamilyId = particleStorageAllocation?.stateFamilyId ?? 1,
  targetStateFamilyMask = particleStorageAllocation?.targetStateFamilyMask
    ?? SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK,
  retainSlotAssignmentBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError(
      'runSchroederParticleStorageSlotAssignmentWebGpu requires a WebGPU-like device with queue.writeBuffer'
    );
  }
  const plan = createSchroederParticleStorageSlotAssignmentPlan({
    particleStorageAllocation,
    particleStorageFreeList,
    particleStorageSlotAssignmentAdmission,
    assignmentEpoch,
    stateFamilyId,
    targetStateFamilyMask
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  if (!plan.particleStorageSlotAssignmentAdmissionApproved) {
    return {
      ...plan,
      schema: ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA,
      particleStorageSlotAssignmentSchema: plan.schema,
      status: 'schroeder-particle-storage-slot-assignment-blocked-admission-required',
      backend: 'webgpu',
      readbackMode,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedSlotAssignmentBuffer: false,
      slotAssignmentBufferByteLength: 0,
      slotAssignmentRows: new Float32Array(),
      conservativeTransferStatus: 'particle-storage-slot-assignment-blocked-admission-required',
      stateMutationRequired: false,
      stateMutationStatus: 'blocked-particle-storage-slot-assignment-admission-required',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  const borrowedAllocationBuffer = particleStorageAllocation?.allocationBuffer || null;
  const allocationRows = particleStorageAllocation?.allocationRows instanceof Float32Array
    ? particleStorageAllocation.allocationRows
    : null;
  if (!borrowedAllocationBuffer && !(allocationRows instanceof Float32Array)) {
    throw new TypeError('Schroeder particle storage slot assignment requires retained allocation rows or explicit rows');
  }
  const borrowedFreeListBuffer = particleStorageFreeList?.freeListBuffer || null;
  const freeListRows = particleStorageFreeList?.freeListRows instanceof Float32Array
    ? particleStorageFreeList.freeListRows
    : null;
  if (!borrowedFreeListBuffer && !(freeListRows instanceof Float32Array)) {
    throw new TypeError('Schroeder particle storage slot assignment requires a retained free-list buffer or explicit rows');
  }
  const allocationBuffer = borrowedAllocationBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-particle-storage-slot-assignment-allocation-in', allocationRows);
  const freeListBuffer = borrowedFreeListBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-particle-storage-slot-assignment-free-list-in', freeListRows);
  const slotAssignmentBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-schroeder-particle-storage-slot-assignment-out',
    size: plan.slotAssignmentByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  }), device);
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-slot-assignment-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-particle-storage-slot-assignment-readback',
      size: plan.slotAssignmentByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedSlotAssignmentBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederParticleStorageSlotAssignmentParamsArray({
      ...plan,
      admissionApproved: plan.particleStorageSlotAssignmentAdmissionApproved,
      maxSlotsPerRow: particleStorageFreeList.maxSlotsPerRow
    }));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-particle-storage-slot-assignment.v1',
      label: 'ulg-schroeder-particle-storage-slot-assignment',
      code: schroederParticleStorageSlotAssignmentWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: allocationBuffer } },
        { binding: 1, resource: { buffer: freeListBuffer } },
        { binding: 2, resource: { buffer: slotAssignmentBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.allocationRowCount / SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(slotAssignmentBuffer, 0, readBuffer, 0, plan.slotAssignmentByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let slotAssignmentRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      slotAssignmentRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.allocationRowCount * SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA,
      particleStorageSlotAssignmentSchema: plan.schema,
      status: 'schroeder-particle-storage-slot-assignment-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_PARTICLE_STORAGE_SLOT_ASSIGNMENT_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedSlotAssignmentBuffer: Boolean(retainSlotAssignmentBuffer),
      slotAssignmentBufferByteLength: plan.slotAssignmentByteLength,
      slotAssignmentRows,
      conservativeTransferStatus: 'particle-storage-slot-assignment-submitted',
      stateMutationStatus: 'particle-storage-slot-assignment-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-particle-storage-slot-assignment-materialized',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainSlotAssignmentBuffer) {
      result.slotAssignmentBuffer = slotAssignmentBuffer;
      result.destroySlotAssignmentBuffer = () => slotAssignmentBuffer.destroy?.();
      returnedRetainedSlotAssignmentBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedAllocationBuffer) allocationBuffer.destroy?.();
      if (!borrowedFreeListBuffer) freeListBuffer.destroy?.();
      if (!retainSlotAssignmentBuffer || !returnedRetainedSlotAssignmentBuffer) slotAssignmentBuffer.destroy?.();
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

export async function runSchroederParticleStorageMaterializationWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  particleStorageSlotAssignment,
  particleStorageMaterializationAdmission = null,
  outputParticleCapacity = null,
  materializationEpoch = particleStorageSlotAssignment?.assignmentEpoch ?? 0,
  stateFamilyId = particleStorageSlotAssignment?.stateFamilyId ?? 1,
  targetStateFamilyMask = particleStorageSlotAssignment?.targetStateFamilyMask
    ?? SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK,
  retainParticleBuffers = true,
  retainMaterializationBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError(
      'runSchroederParticleStorageMaterializationWebGpu requires a WebGPU-like device with queue.writeBuffer'
    );
  }
  const plan = createSchroederParticleStorageMaterializationPlan({
    sphParticleState,
    mlsMpmParticleState,
    particleStorageSlotAssignment,
    particleStorageMaterializationAdmission,
    outputParticleCapacity,
    materializationEpoch,
    stateFamilyId,
    targetStateFamilyMask
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  if (!plan.particleStorageMaterializationAdmissionApproved) {
    return {
      ...plan,
      schema: ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA,
      particleStorageMaterializationSchema: plan.schema,
      status: 'schroeder-particle-storage-materialization-blocked-admission-required',
      backend: 'webgpu',
      readbackMode,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-particle-storage-materialization-blocked',
        mapAsyncCount: 0,
        readbackBytes: 0,
        hostQueueFenceCount: 0
      }),
      retainedParticleBuffers: false,
      retainedMaterializationBuffer: false,
      materializationBufferByteLength: 0,
      materializationRows: new Float32Array(),
      conservativeTransferStatus: 'particle-storage-materialization-blocked-admission-required',
      stateMutationRequired: false,
      stateMutationStatus: 'blocked-particle-storage-materialization-admission-required',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  const maxStorageBuffersPerShaderStage = Number(
    device.limits?.maxStorageBuffersPerShaderStage
  );
  if (
    Number.isFinite(maxStorageBuffersPerShaderStage)
    && maxStorageBuffersPerShaderStage
      < SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_STORAGE_BUFFER_COUNT
  ) {
    throw new RangeError(
      'Schroeder particle storage materialization requires '
      + `${SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_STORAGE_BUFFER_COUNT} `
      + 'storage buffers per shader stage; request the resident-SPH WebGPU device limits'
    );
  }

  const borrowedSlotAssignmentBuffer = particleStorageSlotAssignment?.slotAssignmentBuffer || null;
  const slotAssignmentRows = particleStorageSlotAssignment?.slotAssignmentRows instanceof Float32Array
    ? particleStorageSlotAssignment.slotAssignmentRows
    : null;
  if (!borrowedSlotAssignmentBuffer && !(slotAssignmentRows instanceof Float32Array)) {
    throw new TypeError(
      'Schroeder particle storage materialization requires retained slot-assignment rows or explicit rows'
    );
  }
  const borrowedStateBuffer = optionalSourceStateBuffer(sphParticleUpload);
  const borrowedThermoBuffer = optionalSourceThermoBuffer(sphParticleUpload);
  const borrowedIdentityBuffer = optionalSourceIdentityBuffer(sphParticleUpload);
  const borrowedMechanicsBuffer = optionalSourceMechanicsBuffer(mlsMpmParticleUpload);
  const packedIdentity = sphParticleState.identity instanceof Uint32Array
    && sphParticleState.identity.length >= plan.sourceParticleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS
    ? sphParticleState.identity
    : null;
  const identityRequired = plan.identityRequired || sphParticleUpload?.identityRequired === true;
  if (identityRequired && !borrowedIdentityBuffer && !packedIdentity) {
    throw new TypeError(
      'Schroeder particle storage materialization requires particle identity for arbitrary render domains'
    );
  }
  const slotAssignmentBuffer = borrowedSlotAssignmentBuffer
    || writeStorageBuffer(
      device,
      'ulg-schroeder-particle-storage-materialization-slot-assignment-in',
      slotAssignmentRows
    );
  const sourceStateBuffer = borrowedStateBuffer
    || writeStorageBuffer(
      device,
      'ulg-schroeder-particle-storage-materialization-state-in',
      sphParticleState.state,
      { copySource: true }
    );
  const sourceThermoBuffer = borrowedThermoBuffer
    || writeStorageBuffer(
      device,
      'ulg-schroeder-particle-storage-materialization-thermo-in',
      sphParticleState.thermo,
      { copySource: true }
    );
  const sourceIdentityBuffer = borrowedIdentityBuffer
    || writeStorageBuffer(
      device,
      'ulg-schroeder-particle-storage-materialization-identity-in',
      packedIdentity
        || new Uint32Array(plan.sourceParticleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS),
      { copySource: true }
    );
  const sourceMechanicsBuffer = borrowedMechanicsBuffer
    || writeStorageBuffer(
      device,
      'ulg-schroeder-particle-storage-materialization-mechanics-in',
      mlsMpmParticleState.mechanics,
      { copySource: true }
    );
  const outputStateBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-materialization-state-out',
    size: plan.stateByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const outputThermoBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-materialization-thermo-out',
    size: plan.thermoByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const outputMechanicsBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-materialization-mechanics-out',
    size: plan.mechanicsByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const outputIdentityBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-materialization-identity-out',
    size: plan.identityByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const materializationBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-materialization-rows-out',
    size: plan.materializationByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-materialization-params',
    size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-particle-storage-materialization-readback',
      size: plan.materializationByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedParticleBuffers = false;
  let returnedRetainedMaterializationBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederParticleStorageMaterializationParamsArray({
      ...plan,
      admissionApproved: plan.particleStorageMaterializationAdmissionApproved
    }));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'storage'),
      computeBufferBinding(7, 'storage'),
      computeBufferBinding(8, 'uniform'),
      computeBufferBinding(9, 'read-only-storage'),
      computeBufferBinding(10, 'storage')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-particle-storage-materialization.v6',
      label: 'ulg-schroeder-particle-storage-materialization',
      code: schroederParticleStorageMaterializationWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = createCachedExplicitBindGroup(device, {
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: slotAssignmentBuffer } },
        { binding: 1, resource: { buffer: sourceStateBuffer } },
        { binding: 2, resource: { buffer: sourceThermoBuffer } },
        { binding: 3, resource: { buffer: sourceMechanicsBuffer } },
        { binding: 4, resource: { buffer: outputStateBuffer } },
        { binding: 5, resource: { buffer: outputThermoBuffer } },
        { binding: 6, resource: { buffer: outputMechanicsBuffer } },
        { binding: 7, resource: { buffer: materializationBuffer } },
        { binding: 8, resource: { buffer: paramsBuffer } },
        { binding: 9, resource: { buffer: sourceIdentityBuffer } },
        { binding: 10, resource: { buffer: outputIdentityBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(
      sourceStateBuffer,
      0,
      outputStateBuffer,
      0,
      Math.max(
        Float32Array.BYTES_PER_ELEMENT,
        plan.sourceParticleCount * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
      )
    );
    encoder.copyBufferToBuffer(
      sourceThermoBuffer,
      0,
      outputThermoBuffer,
      0,
      Math.max(
        Float32Array.BYTES_PER_ELEMENT,
        plan.sourceParticleCount * SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT
      )
    );
    encoder.copyBufferToBuffer(
      sourceMechanicsBuffer,
      0,
      outputMechanicsBuffer,
      0,
      Math.max(
        Float32Array.BYTES_PER_ELEMENT,
        plan.sourceParticleCount
          * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
          * Float32Array.BYTES_PER_ELEMENT
      )
    );
    encoder.copyBufferToBuffer(
      sourceIdentityBuffer,
      0,
      outputIdentityBuffer,
      0,
      Math.max(
        Uint32Array.BYTES_PER_ELEMENT,
        plan.sourceParticleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT
      )
    );
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.assignmentRowCount / SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(materializationBuffer, 0, readBuffer, 0, plan.materializationByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let materializationRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      materializationRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.assignmentRowCount * SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA,
      particleStorageMaterializationSchema: plan.schema,
      status: 'schroeder-particle-storage-materialization-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_PARTICLE_STORAGE_MATERIALIZATION_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-particle-storage-materialization',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.materializationByteLength,
        hostQueueFenceCount: 0
      }),
      retainedParticleBuffers: Boolean(retainParticleBuffers),
      retainedMaterializationBuffer: Boolean(retainMaterializationBuffer),
      stateBufferByteLength: plan.stateByteLength,
      thermoBufferByteLength: plan.thermoByteLength,
      mechanicsBufferByteLength: plan.mechanicsByteLength,
      identityBufferByteLength: plan.identityByteLength,
      identityStrideBytes: SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
      identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
      identityRequired,
      identityRevision: sphParticleUpload?.identityRevision
        || sphParticleState.identityRevision
        || null,
      renderDomainKeys: {
        ...(sphParticleUpload?.renderDomainKeys || sphParticleState.renderDomainKeys || {})
      },
      materializationBufferByteLength: plan.materializationByteLength,
      materializationRows,
      conservativeTransferStatus: 'particle-storage-materialization-submitted',
      stateMutationStatus: 'particle-storage-materialization-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-particle-storage-materialization-materialized',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainParticleBuffers) {
      result.particleStateBuffer = outputStateBuffer;
      result.particleThermoBuffer = outputThermoBuffer;
      result.particleMechanicsBuffer = outputMechanicsBuffer;
      result.particleIdentityBuffer = outputIdentityBuffer;
      result.destroyParticleBuffers = () => {
        outputStateBuffer.destroy?.();
        outputThermoBuffer.destroy?.();
        outputMechanicsBuffer.destroy?.();
        outputIdentityBuffer.destroy?.();
      };
      returnedRetainedParticleBuffers = true;
    }
    if (retainMaterializationBuffer) {
      result.materializationBuffer = materializationBuffer;
      result.destroyMaterializationBuffer = () => materializationBuffer.destroy?.();
      returnedRetainedMaterializationBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedSlotAssignmentBuffer) slotAssignmentBuffer.destroy?.();
      if (!borrowedStateBuffer) sourceStateBuffer.destroy?.();
      if (!borrowedThermoBuffer) sourceThermoBuffer.destroy?.();
      if (!borrowedIdentityBuffer) sourceIdentityBuffer.destroy?.();
      if (!borrowedMechanicsBuffer) sourceMechanicsBuffer.destroy?.();
      if (!retainParticleBuffers || !returnedRetainedParticleBuffers) {
        outputStateBuffer.destroy?.();
        outputThermoBuffer.destroy?.();
        outputMechanicsBuffer.destroy?.();
        outputIdentityBuffer.destroy?.();
      }
      if (!retainMaterializationBuffer || !returnedRetainedMaterializationBuffer) {
        materializationBuffer.destroy?.();
      }
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
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  queueOrderedCleanup = false
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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-phase-volume-level-update-blocked',
        mapAsyncCount: 0,
        readbackBytes: 0,
        hostQueueFenceCount: 0
      }),
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
  let submissionObserved = false;
  let successfulResult = null;
  let queueOrderedSubmissionReceipt = null;

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
    const bindGroup = createCachedExplicitBindGroup(device, {
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
    const commandBuffer = encoder.finish();
    if (queueOrderedCleanup === true) {
      queueOrderedSubmissionReceipt = submitQueueOrderedWork(
        device,
        [commandBuffer]
      );
    } else {
      device.queue.submit([commandBuffer]);
    }
    submissionObserved = true;

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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-phase-volume-level-update',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : plan.levelUpdateByteLength,
        hostQueueFenceCount: 0
      }),
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
    successfulResult = result;
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedMigrationBuffer) migrationBuffer.destroy?.();
      if (!retainLevelUpdateBuffer || !returnedRetainedLevelUpdateBuffer) levelUpdateBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    completeSchroederSubmittedTemporaryCleanup({
      device,
      cleanup,
      deferredCleanupRequired: noFullReadback,
      queueOrderedCleanup,
      submissionObserved,
      queueOrderedSubmissionReceipt,
      resultAuthority: successfulResult
    });
  }
}

export async function runSchroederPhaseVolumeDiagnosticSummaryWebGpu({
  device,
  phaseVolumeLevelUpdate,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  migrationEpoch = phaseVolumeLevelUpdate?.migrationEpoch ?? 0,
  stateFamilyId = phaseVolumeLevelUpdate?.stateFamilyId ?? 1,
  retainSummaryBuffer = true,
  readbackMode = SCHROEDER_COMPACT_PHASE_VOLUME_DIAGNOSTIC_READBACK_MODE,
  queueOrderedCleanup = false
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
  let submissionObserved = false;
  let successfulResult = null;
  let queueOrderedSubmissionReceipt = null;

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
    const bindGroup = createCachedExplicitBindGroup(device, {
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
    const commandBuffer = encoder.finish();
    if (queueOrderedCleanup === true) {
      queueOrderedSubmissionReceipt = submitQueueOrderedWork(
        device,
        [commandBuffer]
      );
    } else {
      device.queue.submit([commandBuffer]);
    }
    submissionObserved = true;

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
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-phase-volume-diagnostic-summary',
        mapAsyncCount: compactSummaryReadback ? 1 : 0,
        readbackBytes: compactSummaryReadback ? plan.summaryByteLength : 0,
        finalDiagnosticMapAsyncCount: compactSummaryReadback ? 1 : 0,
        finalDiagnosticReadbackBytes:
          compactSummaryReadback ? plan.summaryByteLength : 0,
        hostQueueFenceCount: 0
      }),
      retainedSummaryBuffer: Boolean(retainSummaryBuffer),
      summaryBufferByteLength: plan.summaryByteLength,
      summaryRows,
      diagnosticStatus: 'phase-volume-diagnostics-submitted',
      visibleStressCaseStatus: 'water-to-steam-level-migration-diagnostics-submitted',
      refinePressurePolicy: plan.refinePressurePolicy,
      refinePressureReasonBits: [...SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS],
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
    successfulResult = result;
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedLevelUpdateBuffer) levelUpdateBuffer.destroy?.();
      if (!retainSummaryBuffer || !returnedRetainedSummaryBuffer) summaryBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    completeSchroederSubmittedTemporaryCleanup({
      device,
      cleanup,
      deferredCleanupRequired: noFullReadback || compactSummaryReadback,
      queueOrderedCleanup,
      submissionObserved,
      queueOrderedSubmissionReceipt,
      resultAuthority: successfulResult
    });
  }
}

export const SCHROEDER_TWO_LEVEL_MECHANICAL_READER_IDS = Object.freeze(
  SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.map(({ consumerId }) => consumerId)
);

export function createSchroederHierarchyArtifactRetirementFence({
  device,
  ownerCompletion,
  requirePostControllerQueueFence = false
} = {}) {
  if (!ownerCompletion || typeof ownerCompletion.then !== 'function') {
    return null;
  }
  if (!requirePostControllerQueueFence) return ownerCompletion;
  return Promise.resolve(ownerCompletion).then(async (confirmed) => {
    if (confirmed !== true) return false;
    if (typeof device?.queue?.onSubmittedWorkDone !== 'function') {
      return false;
    }
    try {
      // A controller completion confirms that every generation, proposal,
      // transaction, and assignment release scheduled so far has crossed its
      // owner fence. Take one final fence after that confirmation so artifact
      // retirement also waits for later epochs and post-mechanics cleanup.
      await device.queue.onSubmittedWorkDone();
      return true;
    } catch {
      return false;
    }
  }, () => false);
}

export const SCHROEDER_TWO_LEVEL_MECHANICAL_READER_PHASE = Object.freeze({
  [SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRESSURE_CONTACT_PROPOSAL,
  [SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.SEPARATION_PROPOSAL,
  [SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE]:
    SCHROEDER_SPATIAL_EPOCH_READER_PHASE.LOCAL_MATERIAL_INTERFACE_PROPOSAL
});

export function schroederTwoLevelMechanicalSupportProfiles() {
  return Object.freeze(Object.fromEntries(
    SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.map(({
      consumerId,
      supportProfileId
    }) => [consumerId, supportProfileId])
  ));
}

export const SCHROEDER_TWO_LEVEL_CANONICAL_EPOCH_MODE_LEGACY_PROPOSALS =
  'legacy-per-epoch-mechanical-proposals';
export const SCHROEDER_TWO_LEVEL_CANONICAL_EPOCH_MODE_FUSED_PRIVATE =
  'fused-private-mechanics';

export function requireCanonicalTwoLevelEpochUploadFamily({
  sphParticleUpload,
  mlsMpmParticleUpload,
  particleCount,
  allowTopologyChange = false
}) {
  const resolvedParticleCount = sphParticleUpload?.particleCount;
  if (
    sphParticleUpload?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || sphParticleUpload?.status !== 'webgpu-uploaded'
    || mlsMpmParticleUpload?.schema
      !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || mlsMpmParticleUpload?.status !== 'webgpu-uploaded'
    || !Number.isInteger(resolvedParticleCount)
    || resolvedParticleCount < 1
    || mlsMpmParticleUpload.particleCount !== resolvedParticleCount
    || (!allowTopologyChange && resolvedParticleCount !== particleCount)
  ) {
    const error = new TypeError(
      'Canonical two-level epochs require one complete resident SPH/MLS upload family'
    );
    error.code = 'ERR_SCHROEDER_TWO_LEVEL_UPLOAD_FAMILY';
    throw error;
  }
}

function canonicalTwoLevelBufferSize(buffer) {
  return buffer == null ? null : Number(buffer.size);
}

export function snapshotCanonicalTwoLevelEpochUploadFamily(
  sphParticleUpload,
  mlsMpmParticleUpload
) {
  const stateBuffer = sphParticleUpload?.stateBuffer ?? null;
  const thermoBuffer = sphParticleUpload?.thermoBuffer ?? null;
  const identityBuffer = sphParticleUpload?.identityBuffer ?? null;
  const mechanicsBuffer = mlsMpmParticleUpload?.mechanicsBuffer ?? null;
  return Object.freeze({
    sphParticleUpload,
    mlsMpmParticleUpload,
    sphSchema: sphParticleUpload?.schema ?? null,
    mlsSchema: mlsMpmParticleUpload?.schema ?? null,
    sphStatus: sphParticleUpload?.status ?? null,
    mlsStatus: mlsMpmParticleUpload?.status ?? null,
    particleCount: sphParticleUpload?.particleCount ?? null,
    mlsParticleCount: mlsMpmParticleUpload?.particleCount ?? null,
    stateBuffer,
    thermoBuffer,
    identityBuffer,
    mechanicsBuffer,
    stateBufferSize: canonicalTwoLevelBufferSize(stateBuffer),
    thermoBufferSize: canonicalTwoLevelBufferSize(thermoBuffer),
    identityBufferSize: canonicalTwoLevelBufferSize(identityBuffer),
    mechanicsBufferSize: canonicalTwoLevelBufferSize(mechanicsBuffer),
    stateBufferByteLength: sphParticleUpload?.stateBufferByteLength ?? null,
    thermoBufferByteLength: sphParticleUpload?.thermoBufferByteLength ?? null,
    identityBufferByteLength: sphParticleUpload?.identityBufferByteLength ?? null,
    mechanicsBufferByteLength:
      mlsMpmParticleUpload?.mechanicsBufferByteLength ?? null,
    stateStrideBytes: sphParticleUpload?.stateStrideBytes ?? null,
    thermoStrideBytes: sphParticleUpload?.thermoStrideBytes ?? null,
    identityStrideBytes: sphParticleUpload?.identityStrideBytes ?? null,
    mechanicsStrideBytes: mlsMpmParticleUpload?.mechanicsStrideBytes ?? null
  });
}

export function canonicalTwoLevelEpochUploadFamilyMatchesSnapshot(
  sphParticleUpload,
  mlsMpmParticleUpload,
  snapshot
) {
  if (!snapshot) return false;
  const stateBuffer = sphParticleUpload?.stateBuffer ?? null;
  const thermoBuffer = sphParticleUpload?.thermoBuffer ?? null;
  const identityBuffer = sphParticleUpload?.identityBuffer ?? null;
  const mechanicsBuffer = mlsMpmParticleUpload?.mechanicsBuffer ?? null;
  return Boolean(
    sphParticleUpload === snapshot.sphParticleUpload
    && mlsMpmParticleUpload === snapshot.mlsMpmParticleUpload
    && sphParticleUpload?.schema === snapshot.sphSchema
    && mlsMpmParticleUpload?.schema === snapshot.mlsSchema
    && sphParticleUpload?.status === snapshot.sphStatus
    && mlsMpmParticleUpload?.status === snapshot.mlsStatus
    && sphParticleUpload?.particleCount === snapshot.particleCount
    && mlsMpmParticleUpload?.particleCount === snapshot.mlsParticleCount
    && stateBuffer === snapshot.stateBuffer
    && thermoBuffer === snapshot.thermoBuffer
    && identityBuffer === snapshot.identityBuffer
    && mechanicsBuffer === snapshot.mechanicsBuffer
    && canonicalTwoLevelBufferSize(stateBuffer) === snapshot.stateBufferSize
    && canonicalTwoLevelBufferSize(thermoBuffer) === snapshot.thermoBufferSize
    && canonicalTwoLevelBufferSize(identityBuffer) === snapshot.identityBufferSize
    && canonicalTwoLevelBufferSize(mechanicsBuffer)
      === snapshot.mechanicsBufferSize
    && stateBuffer?.destroyed !== true
    && thermoBuffer?.destroyed !== true
    && identityBuffer?.destroyed !== true
    && mechanicsBuffer?.destroyed !== true
    && sphParticleUpload?.stateBufferByteLength
      === snapshot.stateBufferByteLength
    && sphParticleUpload?.thermoBufferByteLength
      === snapshot.thermoBufferByteLength
    && sphParticleUpload?.identityBufferByteLength
      === snapshot.identityBufferByteLength
    && mlsMpmParticleUpload?.mechanicsBufferByteLength
      === snapshot.mechanicsBufferByteLength
    && sphParticleUpload?.stateStrideBytes === snapshot.stateStrideBytes
    && sphParticleUpload?.thermoStrideBytes === snapshot.thermoStrideBytes
    && sphParticleUpload?.identityStrideBytes === snapshot.identityStrideBytes
    && mlsMpmParticleUpload?.mechanicsStrideBytes
      === snapshot.mechanicsStrideBytes
  );
}

/**
 * Own the immutable directory/transaction/proposal chain for the mechanics
 * epochs inside one two-level macro step.  Logical commit and physical
 * assignment retirement are deliberately separate: a refreshed assignment
 * is released only after the next refresh that reads it has been submitted.
 */
