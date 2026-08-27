import assert from 'node:assert/strict';
import { test } from 'node:test';
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
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
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
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA,
  ULG_SCHROEDER_STATE_DELTA_MERGE_ADMISSION_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_ACTIVE_NODE_FLOATS,
  SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_UINTS,
  SCHROEDER_CONSERVATION_SUMMARY_FLOATS,
  SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
  SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS,
  SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
  SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS,
  SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
  SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
  SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS,
  SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS,
  SCHROEDER_LAW_QUEUE_FLOATS,
  SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
  SCHROEDER_COMPACT_FAR_AGGREGATE_DIAGNOSTIC_READBACK_MODE,
  SCHROEDER_COMPACT_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_READBACK_MODE,
  SCHROEDER_COMPACT_LAW_NEIGHBOR_DIAGNOSTIC_READBACK_MODE,
  SCHROEDER_COMPACT_PHASE_VOLUME_DIAGNOSTIC_READBACK_MODE,
  SCHROEDER_FULL_ACTIVE_NODE_SORTED_INDEX_READBACK_MODE,
  SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_AUTO_MODE,
  SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_DISABLED_MODE,
  SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_FORCE_MODE,
  SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE,
  SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE,
  SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE,
  SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
  SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT,
  SCHROEDER_NO_FULL_READBACK_MODE,
  SCHROEDER_SPATIAL_TRANSITION_POLICY_CONSERVATIVE_RESIDENT,
  SCHROEDER_SPATIAL_TRANSITION_POLICY_OBSERVED_COMPACT_DIAGNOSTIC,
  SCHROEDER_LOCAL_LAW_QUEUE_MASK,
  SCHROEDER_BUCKETED_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE,
  DEFAULT_AGGREGATE_NODE_BUCKET_REDUCTION_MIN_ROWS,
  DEFAULT_AGGREGATE_NODE_BUCKET_SLOT_CAPACITY,
  DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY,
  DEFAULT_SCHROEDER_LAW_NEIGHBOR_BUCKET_PRESSURE_RATIO_THRESHOLD,
  DEFAULT_SCHROEDER_LAW_NEIGHBOR_FALLBACK_SCAN_RATIO_THRESHOLD,
  DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_CANDIDATE_BUDGET,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_ACCELERATION_PRESSURE_THRESHOLD,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_ACCELERATION_SCALE,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_MAX_ACCELERATION_M_PER_S2,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_ERROR_BOUND,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_FORCE_SCALE,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_GRAVITATIONAL_CONSTANT,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_NEAR_FIELD_SUPPORT_SCALE,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_OPENING_THETA,
  DEFAULT_SCHROEDER_FAR_AGGREGATE_SOFTENING_LENGTH_M,
  SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS,
  SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS,
  SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS,
  SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
  SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS,
  SCHROEDER_FAR_AGGREGATE_LAW_MASK,
  SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS,
  SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS,
  SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
  SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK,
  SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_OUTPUT_FAMILY,
  SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_OUTPUT_FAMILY,
  SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_TARGET_FAMILY,
  SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS,
  SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS,
  SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS,
  SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS,
  SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES,
  SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK,
  SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS,
  SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_MISSING_ROW,
  SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
  SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
  SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS,
  SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS,
  SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS,
  createSchroederActiveNodeIndexParamsArray,
  createSchroederActiveNodeIndexPlan,
  createSchroederActiveNodeListPlan,
  createSchroederActiveNodeParamsArray,
  createSchroederActiveNodeSortedIndexParamsArray,
  createSchroederActiveNodeSortedIndexPlan,
  createSchroederActiveNodeSortedIndexSelection,
  createSchroederCrossLevelCouplingParamsArray,
  createSchroederCrossLevelCouplingPlan,
  createSchroederConservationSummaryParamsArray,
  createSchroederConservationSummaryPlan,
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
  createSchroederFarAggregateLawConsumerAuthorityPolicy,
  createSchroederFarAggregateLawConsumerDiagnosticSummaryParamsArray,
  createSchroederFarAggregateLawConsumerDiagnosticSummaryPlan,
  createSchroederFarAggregateLawConsumerParamsArray,
  createSchroederFarAggregateLawConsumerPlan,
  createSchroederHierarchyAggregateParamsArray,
  createSchroederHierarchyAggregateNodeParamsArray,
  createSchroederHierarchyAggregateNodePlan,
  createSchroederHierarchyAggregatePlan,
  createSchroederLawNeighborCandidateParamsArray,
  createSchroederLawNeighborCandidatePlan,
  createSchroederLawNeighborTraversalPolicy,
  createSchroederLawQueueParamsArray,
  createSchroederLawQueuePlan,
  createSchroederLevelAssignmentParamsArray,
  createSchroederLevelAssignmentPlan,
  createSchroederPhaseVolumeAssignmentOverlayIndexParamsArray,
  createSchroederPhaseVolumeAssignmentOverlayIndexPlan,
  createSchroederParticleStorageAllocationParamsArray,
  createSchroederParticleStorageAllocationPlan,
  createSchroederParticleStorageFreeListPlan,
  createSchroederParticleStorageFreeListRows,
  createSchroederParticleStorageMaterializationParamsArray,
  createSchroederParticleStorageMaterializationPlan,
  createSchroederParticleStorageSlotAssignmentParamsArray,
  createSchroederParticleStorageSlotAssignmentPlan,
  createSchroederPhaseVolumeDiagnosticSummaryParamsArray,
  createSchroederPhaseVolumeDiagnosticSummaryPlan,
  createSchroederPhaseVolumeLevelUpdateAssignmentOverlayPlan,
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
  createSchroederPortableSummaryPlan,
  createSchroederSameLevelMechanicsPlan,
  createSchroederTwoLevelCoverageAdmission,
  decodeSchroederLawNeighborTraversalDiagnostics,
  estimateSchroederLevelDeltaForVolumeRatio,
  estimateSchroederLevelFromSupportRadius,
  runSchroederActiveNodeIndexWebGpu,
  runSchroederActiveNodeListWebGpu,
  runSchroederActiveNodeSortedIndexWebGpu,
  runSchroederPhaseVolumeAssignmentOverlayIndexWebGpu,
  runSchroederConservationSummaryWebGpu,
  runSchroederCrossLevelCouplingWebGpu,
  runSchroederCrossLevelStateDeltaMergeWebGpu,
  runSchroederCrossLevelStateDeltaWebGpu,
  runSchroederCrossLevelTransferWebGpu,
  runSchroederFarAggregateCandidateWebGpu,
  runSchroederFarAggregateDiagnosticSummaryWebGpu,
  runSchroederFarAggregateForceApplicationWebGpu,
  runSchroederFarAggregateForceSummaryWebGpu,
  runSchroederFarAggregateGasCellImportWebGpu,
  runSchroederFarAggregateGasStateDeltaWebGpu,
  runSchroederFarAggregateLawConsumerDiagnosticSummaryWebGpu,
  runSchroederFarAggregateLawConsumerWebGpu,
  runSchroederHierarchyAggregateNodeReductionWebGpu,
  runSchroederHierarchyAggregateWebGpu,
  runSchroederLawNeighborCandidateWebGpu,
  runSchroederLawQueueWebGpu,
  runSchroederLevelAssignmentWebGpu,
  runSchroederParticleStorageAllocationWebGpu,
  runSchroederParticleStorageMaterializationWebGpu,
  runSchroederParticleStorageSlotAssignmentWebGpu,
  runSchroederPhaseVolumeDiagnosticSummaryWebGpu,
  runSchroederPhaseVolumeSplitMergeApplyWebGpu,
  runSchroederPhaseVolumeLevelUpdateWebGpu,
  runSchroederPhaseVolumeMigrationWebGpu,
  runSchroederPhaseVolumeSplitMergeProposalWebGpu,
  runSchroederPhaseVolumeTargetAggregateWebGpu,
  runSchroederSameLevelMechanicsWebGpu,
  createSchroederHierarchyArtifactRetirementFence,
  createSchroederTwoLevelCanonicalEpochController,
  schroederParticleStorageAllocatorAdmissionAllowsApplication,
  schroederParticleStorageMaterializationAdmissionAllowsApplication,
  schroederParticleStorageSlotAssignmentAdmissionAllowsApplication,
  schroederFarAggregateGasStateDeltaAdmissionAllowsApplication,
  schroederFarAggregateLawConsumerAdmissionAllowsConsumption,
  schroederFarAggregateForceApplicationAdmissionAllowsApplication,
  schroederGridSpacingForLevel,
  schroederPhaseVolumeMigrationAdmissionAllowsApplication,
  schroederPhaseVolumeSplitMergeAdmissionAllowsApplication,
  schroederStateDeltaMergeAdmissionAllowsApplication
} from '../src/runtime/sph/schroederHierarchyGpu.js';
import { MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT } from '../src/runtime/sph/sphGpuBuffers.js';
import {
  mergeResidentProductMassBuffersWebGpu
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA
} from '../src/runtime/sph/sphReactionGpuSummary.js';
import {
  tagWebGpuBufferDevice,
  tagResidentProductMassDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  createQueueOrderedCleanupClaimIssuer,
  registerQueueOrderedCleanupClaim,
  releaseSubmittedWorkCleanupQueueOrdered
} from '../src/runtime/webgpuComputeLayout.js';
import {
  createGpuReadbackTelemetry
} from '../src/runtime/sph/sphGpuReadbackTelemetry.js';
import {
  buildSphThermalMaterialTable,
  runSphThermalStepWebGpu
} from '../src/runtime/sph/sphThermalGpuKernel.js';
import {
  buildMlsMpmMechanicsMaterialTable
} from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import {
  createReferenceMaterialClosures
} from '../src/runtime/material/materialClosures.js';
import {
  SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_READER_PHASE,
  admitSchroederSpatialEpochTransactionReader,
  createSchroederSpatialEpochTransaction,
  sealSchroederSpatialEpochTransactionReaders,
  summarizeSchroederSpatialEpochTransaction
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import {
  SCHROEDER_SPATIAL_POSITION_TRANSITION_FINAL_SEAL,
  SCHROEDER_SPATIAL_POSITION_TRANSITION_MAGIC,
  SCHROEDER_SPATIAL_POSITION_TRANSITION_STATUS,
  SCHROEDER_SPATIAL_POSITION_TRANSITION_VERSION,
  publishPreparedSchroederSpatialSuccessorSourceFamily
} from '../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import {
  runSchroederSpatialEpochGenerationWithBackpressureWebGpu,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  runSchroederSpatialMechanicalProposalWebGpu
} from '../src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js';
import {
  schroederLevelAssignmentWgsl,
  schroederParticleStorageMaterializationWgsl,
  schroederPhaseVolumeMigrationWgsl,
  schroederPhaseVolumeTargetAggregateWgsl
} from '../ulg-gpu-abi/src/wgsl.js';
import {
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION
} from '../ulg-gpu-abi/src/schroederSpatialTopologyTransition.js';

const referenceMaterialClosures = createReferenceMaterialClosures();
const canonicalSidecarThermalMaterialTable = buildSphThermalMaterialTable({
  h2o: referenceMaterialClosures.h2o.properties
});
const canonicalSidecarMechanicsMaterialTable =
  buildMlsMpmMechanicsMaterialTable({
    h2o: referenceMaterialClosures.h2o.properties
  });

function residentProductMassFixture(device, label) {
  const productEventStrideBytes =
    SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const productEventBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: productEventStrideBytes,
    usage: 4 | 8 | 128
  }), device);
  let releaseCount = 0;
  const handle = {
    schema: ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA,
    status: 'resident-product-mass-buffer-retained',
    source: 'schroeder-hierarchy-test-product-event',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: productEventStrideBytes,
    productEventRowCount: 1,
    productEventActiveEventCount: 1,
    productEventStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    productEventStrideBytes,
    productEventGenerationCount: 1,
    productEventSourceRowCounts: [1],
    mergeSourceProductEventBufferCount: 1,
    mergeSourceProductEventRowCounts: [1],
    mergeSourceProductEventBufferByteLengths: [productEventStrideBytes],
    productInventoryCount: 0,
    gasSpeciesLedgerCount: 0,
    gasSpeciesReadbackByteLength: 0,
    sealedBoxGasProductMoles: 0,
    visibleProductMassKg: 0,
    unplacedProductMassKg: 0,
    unplacedGasProductMassKg: 0,
    destroyResidentProductMassBuffers() {
      releaseCount += 1;
      productEventBuffer.destroy();
      return true;
    }
  };
  Object.defineProperty(handle, 'releaseCount', {
    get() {
      return releaseCount;
    }
  });
  return tagResidentProductMassDevice(handle, device);
}

function assertExactZeroReadbackTelemetry(execution) {
  assert.equal(execution.readbackTelemetryComplete, true);
  assert.equal(execution.mapAsyncCount, 0);
  assert.equal(execution.readbackBytes, 0);
  assert.equal(execution.hostQueueFenceCount, 0);
  assert.deepEqual(execution.readbackTelemetryUnknownSources, []);
}

function canonicalSidecarReactionTable() {
  const records = new Float32Array([
    1, 2, 3, 900,
    -1000, 0.35, 1, 2,
    1, 0, 0, 0
  ]);
  return {
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionCount: 1,
    records,
    combinedRecords: records
  };
}

function manualBuffers({
  particleCount = 1,
  massKg = 1000,
  restDensityKgPerM3 = 1000,
  restVolumeM3 = 1,
  volumeRatioJ = 1,
  smoothingLengthM = 0.1,
  visualParticleRadiusM = 0.05,
  materialId = 1,
  phaseId = 2
} = {}) {
  const state = new Float32Array(particleCount * 8);
  const thermo = new Float32Array(particleCount * 12);
  const mechanics = new Float32Array(particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  for (let index = 0; index < particleCount; index += 1) {
    const stateOffset = index * 8;
    const thermoOffset = index * 12;
    const mechanicsOffset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
    state[stateOffset] = index;
    state[stateOffset + 1] = 0;
    state[stateOffset + 2] = 0;
    state[stateOffset + 3] = massKg;
    thermo[thermoOffset] = materialId;
    thermo[thermoOffset + 1] = phaseId;
    thermo[thermoOffset + 3] = restDensityKgPerM3;
    thermo[thermoOffset + 8] = smoothingLengthM;
    thermo[thermoOffset + 11] = visualParticleRadiusM;
    mechanics[mechanicsOffset + 18] = volumeRatioJ;
    mechanics[mechanicsOffset + 19] = restVolumeM3;
  }
  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      smoothingLengthM,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics
    }
  };
}

function createFakeWebGpuDevice({ allowReadbackCopies = false } = {}) {
  const createdBuffers = [];
  const writes = [];
  const shaderModules = [];
  const dispatches = [];
  const submitted = [];
  const bindGroups = [];
  const queueFenceCalls = [];
  return {
    createdBuffers,
    writes,
    shaderModules,
    dispatches,
    submitted,
    bindGroups,
    queueFenceCalls,
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        destroyCount: 0,
        destroy() {
          this.destroyCount += 1;
          this.destroyed = true;
        },
        async mapAsync() {
          return undefined;
        },
        getMappedRange() {
          return this._mappedData?.buffer ?? new ArrayBuffer(size);
        },
        unmap() {
          this.unmapped = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      shaderModules.push(descriptor);
      return descriptor;
    },
    createComputePipeline(descriptor) {
      return {
        descriptor,
        getBindGroupLayout(index) {
          return { label: `${descriptor.label || 'pipeline'}-layout-${index}` };
        }
      };
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder() {
      let boundGroup = null;
      return {
        clearBuffer() {},
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup(index, value) {
              boundGroup = value;
            },
            dispatchWorkgroups(x, y = 1, z = 1) {
              dispatches.push([x, y, z]);
            },
            dispatchWorkgroupsIndirect() {
              dispatches.push(['indirect']);
            },
            end() {}
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination) {
          const destinationLabel = String(destination?.label || '');
          const compactTopologyReceipt =
            destinationLabel.includes(
              'spatial-topology-transition-compact-readback'
            );
          const compactPositionReceipt =
            destinationLabel.includes(
              'spatial-position-transition-compact-readback'
            );
          if (
            !allowReadbackCopies
            && destinationLabel.includes('readback')
            && !compactTopologyReceipt
            && !compactPositionReceipt
          ) {
            throw new Error('Schroeder no-full-readback test should not copy to a readback buffer');
          }
          if (String(source?.label || '').includes('reaction-discovery-evidence')) {
            const words = source._writtenData instanceof Uint32Array
              ? source._writtenData.slice()
              : new Uint32Array(16);
            const particleCount = words[12] ?? 0;
            words[0] = particleCount;
            words[1] = particleCount;
            words[2] = 0;
            words[3] = particleCount * 2;
            words[4] = particleCount;
            words[5] = 0;
            words[6] = Math.min(1, particleCount);
            words[7] = particleCount;
            words[8] = 0;
            words[14] = 0;
            words[15] = 0;
            destination._mappedData = words;
          }
          if (
            String(source?.label || '')
              .includes('spatial-position-transition-receipt')
          ) {
            const entries = Object.fromEntries(
              (boundGroup?.entries ?? []).map((entry) => [
                entry.binding,
                entry.resource.buffer
              ])
            );
            const [
              sourceCount,
              successorCount,
              generationId,
              nonce,
              sourceEpoch
            ] = entries[2]._writtenData;
            const sourceMasses = entries[0]._masses
              ?? new Array(sourceCount).fill(1);
            const successorMasses = entries[1]._masses
              ?? new Array(successorCount).fill(1);
            const sourcePositions = entries[0]._positions
              ?? Array.from({ length: sourceCount }, (_, index) => [
                index, 0, 0
              ]);
            const successorPositions = entries[1]._positions
              ?? Array.from({ length: successorCount }, (_, index) => [
                index, 0, 0
              ]);
            const comparisonCount = Math.max(sourceCount, successorCount);
            let comparedActiveCount = 0;
            let movedParticleCount = 0;
            for (
              let index = 0;
              index < Math.min(sourceCount, successorCount);
              index += 1
            ) {
              if (
                !(Number(sourceMasses[index]) > 0)
                || !(Number(successorMasses[index]) > 0)
              ) continue;
              comparedActiveCount += 1;
              const sourcePosition = sourcePositions[index] ?? [index, 0, 0];
              const successorPosition =
                successorPositions[index] ?? [index, 0, 0];
              if (sourcePosition.some(
                (value, axis) => value !== successorPosition[axis]
              )) {
                movedParticleCount += 1;
              }
            }
            const changed = movedParticleCount > 0;
            const words = new Uint32Array(20);
            words.set([
              SCHROEDER_SPATIAL_POSITION_TRANSITION_MAGIC,
              SCHROEDER_SPATIAL_POSITION_TRANSITION_VERSION,
              generationId,
              nonce,
              sourceEpoch,
              sourceCount,
              successorCount,
              comparisonCount,
              comparisonCount,
              comparedActiveCount,
              movedParticleCount,
              0,
              0,
              1,
              changed ? 1 : 0,
              changed ? sourceEpoch + 1 : sourceEpoch,
              SCHROEDER_SPATIAL_POSITION_TRANSITION_STATUS.COMPLETE,
              0,
              0,
              SCHROEDER_SPATIAL_POSITION_TRANSITION_FINAL_SEAL
            ]);
            destination._mappedData = words;
          }
          if (
            String(source?.label || '')
              .includes('spatial-topology-transition-receipt')
          ) {
            const entries = Object.fromEntries(
              (boundGroup?.entries ?? []).map((entry) => [
                entry.binding,
                entry.resource.buffer
              ])
            );
            const [
              sourceCount,
              successorCount,
              generationId,
              nonce,
              sourceEpoch,
              forceAdvance
            ] = entries[2]._writtenData;
            const sourceMasses = entries[0]._masses
              ?? new Array(sourceCount).fill(1);
            const successorMasses = entries[1]._masses
              ?? new Array(successorCount).fill(1);
            const comparisonCount = Math.max(sourceCount, successorCount);
            let sourceActiveCount = 0;
            let successorActiveCount = 0;
            let activatedCount = 0;
            let deactivatedCount = 0;
            for (let index = 0; index < comparisonCount; index += 1) {
              const sourceActive =
                index < sourceCount && Number(sourceMasses[index]) > 0;
              const successorActive =
                index < successorCount && Number(successorMasses[index]) > 0;
              if (sourceActive) sourceActiveCount += 1;
              if (successorActive) successorActiveCount += 1;
              if (sourceActive !== successorActive) {
                if (successorActive) activatedCount += 1;
                else deactivatedCount += 1;
              }
            }
            const xorCount = activatedCount + deactivatedCount;
            const changed = xorCount > 0 || forceAdvance === 1;
            const words = new Uint32Array(24);
            words.set([
              SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC,
              SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION,
              generationId,
              nonce,
              sourceEpoch,
              sourceCount,
              successorCount,
              comparisonCount,
              1,
              comparisonCount,
              sourceActiveCount,
              successorActiveCount,
              activatedCount,
              deactivatedCount,
              xorCount,
              0,
              0,
              forceAdvance,
              1,
              changed ? 1 : 0,
              changed ? sourceEpoch + 1 : sourceEpoch,
              SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.COMPLETE,
              0,
              SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL
            ]);
            destination._mappedData = words;
          }
        },
        finish() {
          return { label: 'fake-schroeder-command-buffer' };
        }
      };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        if (offset === 0 && ArrayBuffer.isView(data)) {
          buffer._writtenData = new data.constructor(data);
        }
        writes.push({ label: buffer.label, offset, byteLength: data?.byteLength ?? 0 });
      },
      submit(commands) {
        submitted.push(commands);
      },
      async onSubmittedWorkDone() {
        queueFenceCalls.push({
          submissionCount: submitted.length,
          stack: new Error('unexpected queue fence').stack
        });
        return undefined;
      }
    }
  };
}

function authoritativeUploadFamily(device, {
  particleCount,
  storageGeneration = 1,
  physicsTick = 0,
  physicsSubstep = 0,
  positionEpoch = 0,
  topologyEpoch = 0,
  chartEpoch = 0,
  levelEpoch = 0,
  supportEpoch = 0,
  slot = 0,
  prefix = 'authoritative-source'
} = {}) {
  const stateStrideBytes = 8 * Float32Array.BYTES_PER_ELEMENT;
  const thermoStrideBytes = 12 * Float32Array.BYTES_PER_ELEMENT;
  const mechanicsStrideBytes =
    MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
    * Float32Array.BYTES_PER_ELEMENT;
  const identityStrideBytes = Uint32Array.BYTES_PER_ELEMENT;
  const stateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${prefix}-state`,
    size: particleCount * stateStrideBytes,
    usage: 128
  }), device);
  const thermoBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${prefix}-thermo`,
    size: particleCount * thermoStrideBytes,
    usage: 128
  }), device);
  const identityBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${prefix}-identity`,
    size: particleCount * identityStrideBytes,
    usage: 128
  }), device);
  const mechanicsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${prefix}-mechanics`,
    size: particleCount * mechanicsStrideBytes,
    usage: 128
  }), device);
  const epoch = {
    storageGeneration,
    bufferFamilyGeneration: storageGeneration,
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    physicsTick,
    physicsSubstep,
    positionEpoch,
    topologyEpoch,
    chartEpoch,
    levelEpoch,
    supportEpoch
  };
  return {
    sphParticleUpload: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      particleCount,
      ...epoch,
      stateStrideBytes,
      thermoStrideBytes,
      stateBufferByteLength: stateBuffer.size,
      thermoBufferByteLength: thermoBuffer.size,
      identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
      identityStrideBytes,
      identityBufferByteLength: identityBuffer.size,
      identityRequired: true,
      stateBuffer,
      thermoBuffer,
      identityBuffer,
      ownsStateBuffer: true,
      ownsThermoBuffer: true,
      ownsIdentityBuffer: true,
      slot,
      sourceSlot: slot,
      nextSlot: slot === 0 ? 1 : 0,
      step: physicsTick,
      time: 0
    },
    mlsMpmParticleUpload: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      particleCount,
      ...epoch,
      mechanicsStrideBytes,
      mechanicsBufferByteLength: mechanicsBuffer.size,
      mechanicsBuffer,
      ownsMechanicsBuffer: true,
      slot,
      sourceSlot: slot,
      nextSlot: slot === 0 ? 1 : 0,
      step: physicsTick,
      time: 0
    }
  };
}

async function driveAuthoritativeCanonicalEpochs(options, {
  prefix = 'authoritative-two-level',
  terminalOwnsThermoBuffer = false
} = {}) {
  const controller = options.canonicalEpochController;
  assert.ok(controller, 'authoritative runner must receive the canonical epoch controller');
  let epoch = controller.initialEpoch;
  let finalInternalUploads = null;
  let postMechanicsEpoch = null;
  for (let ordinal = 0; ordinal < 3; ordinal += 1) {
    controller.admitP2g(epoch);
    controller.admitG2p(epoch);
    const sourceSph = epoch.sphParticleUpload;
    const sourceMls = epoch.mlsMpmParticleUpload;
    const nextSlot = (sourceSph.slot ?? 0) === 0 ? 1 : 0;
    const nextStorageGeneration = sourceSph.storageGeneration + 1;
    const nextPhysicsSubstep = epoch.generation.execution.physicsSubstep + 1;
    const nextPositionEpoch = epoch.generation.execution.positionEpoch + 1;
    const stateBuffer = tagWebGpuBufferDevice(options.device.createBuffer({
      label: `${prefix}-state-${ordinal}`,
      size: sourceSph.stateBufferByteLength,
      usage: 128
    }), options.device);
    const mechanicsBuffer = tagWebGpuBufferDevice(options.device.createBuffer({
      label: `${prefix}-mechanics-${ordinal}`,
      size: sourceMls.mechanicsBufferByteLength,
      usage: 128
    }), options.device);
    const commonEpoch = {
      storageGeneration: nextStorageGeneration,
      bufferFamilyGeneration: nextStorageGeneration,
      bufferFamilyGenerationStatus:
        'schroeder-two-level-substep-buffer-family-generation-advanced',
      physicsTick: epoch.generation.execution.physicsTick,
      physicsSubstep: nextPhysicsSubstep,
      positionEpoch: nextPositionEpoch,
      topologyEpoch: epoch.generation.execution.topologyEpoch,
      chartEpoch: epoch.generation.execution.chartEpoch,
      levelEpoch: epoch.generation.execution.levelEpoch,
      supportEpoch: epoch.generation.execution.supportEpoch
    };
    finalInternalUploads = {
      sphParticleUpload: {
        ...sourceSph,
        ...commonEpoch,
        stateBuffer,
        ownsStateBuffer: true,
        ownsThermoBuffer: ordinal === 2
          ? terminalOwnsThermoBuffer
          : false,
        ownsIdentityBuffer: false,
        slot: nextSlot,
        sourceSlot: sourceSph.slot ?? 0,
        nextSlot,
        time: (sourceSph.time ?? 0) + (ordinal < 2 ? options.dt / 2 : 0)
      },
      mlsMpmParticleUpload: {
        ...sourceMls,
        ...commonEpoch,
        mechanicsBuffer,
        ownsMechanicsBuffer: true,
        slot: nextSlot,
        sourceSlot: sourceMls.slot ?? 0,
        nextSlot,
        time: (sourceMls.time ?? 0) + (ordinal < 2 ? options.dt / 2 : 0)
      }
    };
    controller.commitAndRelease(epoch, {
      nextParticleUploads: finalInternalUploads,
      // E_r is always private. Even when no optional sidecar readers are
      // enabled, the terminal S* family must be reclassified once at the
      // macro boundary and committed through one public E* transaction.
      terminal: ordinal === 2,
      status: ordinal === 2
        ? 'test-final-coarse-state-submitted'
        : `test-fine-substep-${ordinal}-submitted`
    });
    if (ordinal < 2) {
      const priorEpoch = epoch;
      epoch = await controller.refresh({
        priorEpoch,
        currentSphParticleUpload: finalInternalUploads.sphParticleUpload,
        currentMlsMpmParticleUpload: finalInternalUploads.mlsMpmParticleUpload
      });
      const priorFineField =
        priorEpoch.generation.parentFieldView?.fineFieldView;
      if (priorFineField?.ownerRuntime?.releaseExecutionQueueOrdered) {
        assert.equal(
          priorFineField.ownerRuntime.releaseExecutionQueueOrdered(
            priorFineField
          ),
          true
        );
      } else if (priorFineField) {
        // Narrow dependency-injection seam for unit fixtures that provide a
        // structurally exact generation without a live field runtime.
        priorFineField.released = true;
      }
      controller.releaseFusedPriorEpochAfterSuccessor(priorEpoch, {
        successorEpoch: epoch
      });
    }
  }
  postMechanicsEpoch = await controller.refreshForPostMechanics({
    priorEpoch: epoch,
    currentSphParticleUpload: finalInternalUploads.sphParticleUpload,
    currentMlsMpmParticleUpload: finalInternalUploads.mlsMpmParticleUpload,
    enabledConsumerReaderIds: options.postMechanicsConsumerReaderIds,
    consumerSupportProfileIds:
      options.postMechanicsConsumerSupportProfileIds
  });
  const sourceSlot = options.sphParticleUpload.slot ?? 0;
  const nextSlot = sourceSlot === 0 ? 1 : 0;
  const nextStep = (options.sphParticleState.step ?? 0) + 1;
  const nextTime = (options.sphParticleState.time ?? 0) + options.dt;
  const nextParticleUploads = {
    sphParticleUpload: {
      ...finalInternalUploads.sphParticleUpload,
      sourceStage: 'schroeder-two-level-mechanics-step',
      physicsTick: nextStep,
      physicsSubstep: 0,
      slot: nextSlot,
      sourceSlot,
      nextSlot,
      step: nextStep,
      time: nextTime
    },
    mlsMpmParticleUpload: {
      ...finalInternalUploads.mlsMpmParticleUpload,
      sourceStage: 'schroeder-two-level-mechanics-step',
      physicsTick: nextStep,
      physicsSubstep: 0,
      slot: nextSlot,
      sourceSlot,
      nextSlot,
      step: nextStep,
      time: nextTime
    }
  };
  return {
    schema: 'peercompute.ulg.schroeder-two-level-mechanics-step-execution.v0',
    status: 'schroeder-two-level-mechanics-step-submitted',
    backend: 'webgpu',
    readbackMode: 'no-full-readback',
    fullParticleReadbackPerformed: false,
    fullParticleReadbackFree: true,
    ...createGpuReadbackTelemetry({
      scope: 'test-authoritative-two-level-mechanics'
    }),
    phaseVolumeInterfaceTransport: {
      enabled: true,
      pressureScale: 1,
      dragScale: 1,
      maxImpulseFraction: 0.5,
      ambientBoundaryEvidence: 'sealed-external-impulse-and-work'
    },
    internalEnergyTransferStatus:
      'signed-pressure-compensation-plus-nonnegative-drag-causal-heat-deposited-by-transpose-g2p',
    refluxEvidenceStatus:
      'gpu-measured-equal-opposite-linear-angular-pressure-drag-energy-ledger',
    couplingMode: 'composite-grid-subcycled-delta-prolongation',
    fineLevel: options.fineLevel,
    coarseLevel: options.fineLevel + 1,
    fineSubstepCount: options.fineSubstepCount,
    fineSubstepDt: options.dt / options.fineSubstepCount,
    internalPressureScale: options.internalPressureScale,
    ambientPressurePa: options.ambientPressurePa,
    ambientPressureAppliedInStressProjection: true,
    fineGridSpacingM: options.baseGridSpacingM,
    coarseGridSpacingM: options.baseGridSpacingM * 2,
    conservation: { massResidualKg: 0 },
    compactSummary: { compactGpuSummaryAvailable: true },
    stateBuffer: nextParticleUploads.sphParticleUpload.stateBuffer,
    mechanicsBuffer: nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer,
    nextSphParticleState: {
      ...options.sphParticleState,
      status: 'gpu-resident-unread-ready',
      step: nextStep,
      time: nextTime,
      physicsTick: nextStep,
      physicsSubstep: 0
    },
    nextMlsMpmParticleState: {
      ...options.mlsMpmParticleState,
      status: 'gpu-resident-unread-ready',
      step: nextStep,
      time: nextTime,
      physicsTick: nextStep,
      physicsSubstep: 0
    },
    nextParticleUploads,
    postMechanicsEpoch,
    postMechanicsCanonicalUploads: Object.freeze({
      sphParticleUpload: postMechanicsEpoch.sphParticleUpload,
      mlsMpmParticleUpload: postMechanicsEpoch.mlsMpmParticleUpload
    }),
    canonicalEpochControllerSummary: controller.summary()
  };
}

function approvedStateDeltaMergeAdmission({
  rowCount = 130,
  hotBufferKey = 'ulg:test:schroeder-state-delta-admission-hot-buffer'
} = {}) {
  return {
    schema: ULG_SCHROEDER_STATE_DELTA_MERGE_ADMISSION_SCHEMA,
    status: 'schroeder-state-delta-merge-admission-admitted',
    stateDeltaMergeApproved: true,
    outputFamilies: ['schroeder-hierarchy-state-delta'],
    schroederStateDeltaRowCount: rowCount,
    hotBufferKey,
    sourceHotBufferKey: hotBufferKey,
    committed: true
  };
}

function approvedPhaseVolumeMigrationAdmission({
  rowCount = 130,
  hotBufferKey = 'ulg:test:schroeder-phase-volume-admission-hot-buffer'
} = {}) {
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_ADMISSION_SCHEMA,
    status: 'schroeder-phase-volume-migration-admission-admitted',
    phaseVolumeMigrationApproved: true,
    outputFamilies: ['schroeder-phase-volume-migration'],
    schroederPhaseVolumeMigrationRowCount: rowCount,
    hotBufferKey,
    sourceHotBufferKey: hotBufferKey,
    committed: true
  };
}

function approvedPhaseVolumeSplitMergeAdmission({
  rowCount = 130,
  hotBufferKey = 'ulg:test:schroeder-phase-volume-split-merge-admission-hot-buffer'
} = {}) {
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_ADMISSION_SCHEMA,
    status: 'schroeder-phase-volume-split-merge-admission-admitted',
    phaseVolumeSplitMergeApproved: true,
    outputFamilies: ['schroeder-phase-volume-split-merge-apply'],
    schroederPhaseVolumeSplitMergeProposalRowCount: rowCount,
    hotBufferKey,
    sourceHotBufferKey: hotBufferKey,
    committed: true
  };
}

function approvedParticleStorageAllocatorAdmission({
  rowCount = 130,
  currentParticleCapacity = rowCount,
  requiredParticleCapacity = currentParticleCapacity,
  hotBufferKey = 'ulg:test:schroeder-particle-storage-allocator-admission-hot-buffer'
} = {}) {
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATOR_ADMISSION_SCHEMA,
    status: 'schroeder-particle-storage-allocator-admission-admitted',
    particleStorageAllocationApproved: true,
    particleCapacityApproved: true,
    outputFamilies: ['schroeder-particle-storage-allocation'],
    targetStateFamilies: [...SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES],
    schroederParticleStorageAllocationRowCount: rowCount,
    currentParticleCapacity,
    requiredParticleCapacity,
    hotBufferKey,
    sourceHotBufferKey: hotBufferKey,
    committed: true
  };
}

function approvedParticleStorageSlotAssignmentAdmission({
  rowCount = 130,
  hotBufferKey = 'ulg:test:schroeder-particle-storage-slot-assignment-admission-hot-buffer'
} = {}) {
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ADMISSION_SCHEMA,
    status: 'schroeder-particle-storage-slot-assignment-admission-admitted',
    particleStorageSlotAssignmentApproved: true,
    freeListDescriptorApproved: true,
    outputFamilies: ['schroeder-particle-storage-slot-assignment'],
    targetStateFamilies: [...SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES],
    schroederParticleStorageSlotAssignmentRowCount: rowCount,
    hotBufferKey,
    sourceHotBufferKey: hotBufferKey,
    committed: true
  };
}

function approvedParticleStorageMaterializationAdmission({
  rowCount = 130,
  requiredParticleCapacity = rowCount,
  hotBufferKey = 'ulg:test:schroeder-particle-storage-materialization-admission-hot-buffer'
} = {}) {
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMISSION_SCHEMA,
    status: 'schroeder-particle-storage-materialization-admission-admitted',
    particleStorageMaterializationApproved: true,
    particleIdentityMutationApproved: true,
    slotAssignmentDescriptorApproved: true,
    outputFamilies: ['schroeder-particle-storage-materialization'],
    targetStateFamilies: [...SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES],
    schroederParticleStorageMaterializationRowCount: rowCount,
    requiredParticleCapacity,
    hotBufferKey,
    sourceHotBufferKey: hotBufferKey,
    committed: true
  };
}

function approvedFarAggregateForceApplicationAdmission({
  rowCount = 130,
  hotBufferKey = 'ulg:test:schroeder-far-force-application-admission-hot-buffer'
} = {}) {
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ADMISSION_SCHEMA,
    status: 'schroeder-far-aggregate-force-application-admission-admitted',
    farAggregateForceApplicationApproved: true,
    farAggregateDiagnosticsAccepted: true,
    outputFamilies: ['schroeder-far-aggregate-force-application'],
    schroederFarAggregateForceApplicationRowCount: rowCount,
    hotBufferKey,
    sourceHotBufferKey: hotBufferKey,
    committed: true
  };
}

function approvedFarAggregateLawConsumerAdmission({
  rowCount = 130,
  enabledConsumerLawMask = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK,
  hotBufferKey = 'ulg:test:schroeder-far-law-consumer-admission-hot-buffer'
} = {}) {
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_ADMISSION_SCHEMA,
    status: 'schroeder-far-aggregate-law-consumer-admission-admitted',
    farAggregateLawConsumerApproved: true,
    farAggregateDiagnosticsAccepted: true,
    outputFamilies: ['schroeder-far-aggregate-law-consumer'],
    schroederFarAggregateLawConsumerRowCount: rowCount,
    enabledConsumerLawMask,
    hotBufferKey,
    sourceHotBufferKey: hotBufferKey,
    committed: true
  };
}

function approvedFarAggregateGasStateDeltaAdmission({
  rowCount = 130,
  hotBufferKey = 'ulg:test:schroeder-far-gas-state-delta-admission-hot-buffer'
} = {}) {
  return {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ADMISSION_SCHEMA,
    status: 'schroeder-far-aggregate-gas-state-delta-admission-admitted',
    farAggregateGasStateDeltaApproved: true,
    outputFamilies: [SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_OUTPUT_FAMILY],
    targetStateFamily: SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_TARGET_FAMILY,
    schroederFarAggregateGasStateDeltaRowCount: rowCount,
    hotBufferKey,
    sourceHotBufferKey: hotBufferKey,
    committed: true
  };
}

test('Schroeder ABI exposes a compact level-assignment row', () => {
  assert.equal(ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA, 'peercompute.ulg.schroeder-level-assignment.v0');
  assert.equal(
    ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-level-assignment-execution.v0'
  );
  assert.equal(SCHROEDER_LEVEL_ASSIGNMENT_FLOATS, 16);
  assert.equal(SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length, SCHROEDER_LEVEL_ASSIGNMENT_FLOATS);
  assert.equal(SCHROEDER_LEVEL_ASSIGNMENT_FLOATS % 4, 0);
  assert.equal(ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA, 'peercompute.ulg.schroeder-active-node-list.v0');
  assert.equal(
    ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-active-node-list-execution.v0'
  );
  assert.equal(SCHROEDER_ACTIVE_NODE_FLOATS, 16);
  assert.equal(SCHROEDER_ACTIVE_NODE_ROW_LAYOUT.length, SCHROEDER_ACTIVE_NODE_FLOATS);
  assert.equal(SCHROEDER_ACTIVE_NODE_FLOATS % 4, 0);
  assert.equal(ULG_SCHROEDER_ACTIVE_NODE_INDEX_SCHEMA, 'peercompute.ulg.schroeder-active-node-index.v0');
  assert.equal(
    ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-active-node-index-execution.v0'
  );
  assert.equal(ULG_SCHROEDER_LAW_QUEUE_SCHEMA, 'peercompute.ulg.schroeder-law-queue.v0');
  assert.equal(
    ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-law-queue-execution.v0'
  );
  assert.equal(SCHROEDER_LAW_QUEUE_FLOATS, 32);
  assert.equal(SCHROEDER_LAW_QUEUE_ROW_LAYOUT.length, SCHROEDER_LAW_QUEUE_FLOATS);
  assert.equal(SCHROEDER_LAW_QUEUE_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA,
    'peercompute.ulg.schroeder-law-neighbor-candidate.v0'
  );
  assert.equal(
    ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-law-neighbor-candidate-execution.v0'
  );
  assert.equal(SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS, 16);
  assert.equal(
    SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ROW_LAYOUT.length,
    SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS
  );
  assert.equal(SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS % 4, 0);
  assert.equal(SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS, 4);
  assert.deepEqual(SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_ROW_LAYOUT, [
    'sourceParticleIndex:f32',
    'candidateOffset:f32',
    'candidateCount:f32',
    'status:f32'
  ]);
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-candidate.v0'
  );
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-candidate-execution.v0'
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS, 32);
  assert.equal(
    SCHROEDER_FAR_AGGREGATE_CANDIDATE_ROW_LAYOUT.length,
    SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-force-summary.v0'
  );
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-force-summary-execution.v0'
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS, 32);
  assert.equal(
    SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_ROW_LAYOUT.length,
    SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-diagnostic-summary.v0'
  );
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-diagnostic-summary-execution.v0'
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS, 32);
  assert.equal(
    SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_ROW_LAYOUT.length,
    SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-law-consumer.v0'
  );
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-law-consumer-execution.v0'
  );
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_ADMISSION_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-law-consumer-admission.v0'
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS, 32);
  assert.equal(
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_ROW_LAYOUT.length,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-law-consumer-diagnostic-summary.v0'
  );
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-law-consumer-diagnostic-summary-execution.v0'
  );
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_AUTHORITY_POLICY_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-law-consumer-authority-policy.v0'
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS, 32);
  assert.equal(
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_ROW_LAYOUT.length,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-gas-state-delta.v0'
  );
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-gas-state-delta-execution.v0'
  );
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ADMISSION_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-gas-state-delta-admission.v0'
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS, 32);
  assert.equal(
    SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ROW_LAYOUT.length,
    SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-gas-cell-import.v0'
  );
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-gas-cell-import-execution.v0'
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS, 12);
  assert.equal(
    SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT.length,
    SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-force-application.v0'
  );
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-force-application-execution.v0'
  );
  assert.equal(
    ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ADMISSION_SCHEMA,
    'peercompute.ulg.schroeder-far-aggregate-force-application-admission.v0'
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS, 32);
  assert.equal(
    SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ROW_LAYOUT.length,
    SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS
  );
  assert.equal(SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS % 4, 0);
  assert.equal(ULG_SCHROEDER_CROSS_LEVEL_COUPLING_SCHEMA, 'peercompute.ulg.schroeder-cross-level-coupling.v0');
  assert.equal(
    ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-cross-level-coupling-execution.v0'
  );
  assert.equal(SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS, 16);
  assert.equal(SCHROEDER_CROSS_LEVEL_COUPLING_ROW_LAYOUT.length, SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS);
  assert.equal(SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS % 4, 0);
  assert.equal(ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_SCHEMA, 'peercompute.ulg.schroeder-cross-level-transfer.v0');
  assert.equal(
    ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-cross-level-transfer-execution.v0'
  );
  assert.equal(SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS, 24);
  assert.equal(SCHROEDER_CROSS_LEVEL_TRANSFER_ROW_LAYOUT.length, SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS);
  assert.equal(SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_SCHEMA,
    'peercompute.ulg.schroeder-cross-level-state-delta.v0'
  );
  assert.equal(
    ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-cross-level-state-delta-execution.v0'
  );
  assert.equal(SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS, 32);
  assert.equal(SCHROEDER_CROSS_LEVEL_STATE_DELTA_ROW_LAYOUT.length, SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS);
  assert.equal(SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_STATE_DELTA_MERGE_ADMISSION_SCHEMA,
    'peercompute.ulg.schroeder-state-delta-merge-admission.v0'
  );
  assert.equal(
    ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_SCHEMA,
    'peercompute.ulg.schroeder-cross-level-state-delta-merge.v0'
  );
  assert.equal(
    ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-cross-level-state-delta-merge-execution.v0'
  );
  assert.equal(SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS, 32);
  assert.equal(
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_ROW_LAYOUT.length,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS
  );
  assert.equal(SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS % 4, 0);
  assert.equal(ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA, 'peercompute.ulg.schroeder-hierarchy-aggregate.v0');
  assert.equal(
    ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-hierarchy-aggregate-execution.v0'
  );
  assert.equal(SCHROEDER_HIERARCHY_AGGREGATE_FLOATS, 32);
  assert.equal(SCHROEDER_HIERARCHY_AGGREGATE_ROW_LAYOUT.length, SCHROEDER_HIERARCHY_AGGREGATE_FLOATS);
  assert.equal(SCHROEDER_HIERARCHY_AGGREGATE_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA,
    'peercompute.ulg.schroeder-hierarchy-aggregate-node.v0'
  );
  assert.equal(
    ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-hierarchy-aggregate-node-execution.v0'
  );
  assert.equal(SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS, 32);
  assert.equal(
    SCHROEDER_HIERARCHY_AGGREGATE_NODE_ROW_LAYOUT.length,
    SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
  );
  assert.equal(SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-migration.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-migration-execution.v0'
  );
  assert.equal(SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS, 32);
  assert.equal(
    SCHROEDER_PHASE_VOLUME_MIGRATION_ROW_LAYOUT.length,
    SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS
  );
  assert.equal(SCHROEDER_PHASE_VOLUME_MIGRATION_ROW_LAYOUT[31], 'refinePressureReasonMask:f32');
  assert.equal(SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_ADMISSION_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-migration-admission.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-split-merge-proposal.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-split-merge-proposal-execution.v0'
  );
  assert.equal(SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS, 32);
  assert.equal(
    SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_ROW_LAYOUT.length,
    SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS
  );
  assert.equal(
    SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_ROW_LAYOUT[4],
    'proposalModeId:f32'
  );
  assert.equal(
    SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_ROW_LAYOUT[29],
    'stateAdmissionRequired:f32'
  );
  assert.equal(SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_ADMISSION_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-split-merge-admission.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-split-merge-apply.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-split-merge-apply-execution.v0'
  );
  assert.equal(SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS, 32);
  assert.equal(
    SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_ROW_LAYOUT.length,
    SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS
  );
  assert.equal(SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_ROW_LAYOUT[7], 'particleCountDelta:f32');
  assert.equal(SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_ROW_LAYOUT[31], 'stateFamilyId:f32');
  assert.equal(SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATOR_ADMISSION_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-allocator-admission.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-allocation.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-allocation-execution.v0'
  );
  assert.equal(SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS, 32);
  assert.equal(
    SCHROEDER_PARTICLE_STORAGE_ALLOCATION_ROW_LAYOUT.length,
    SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS
  );
  assert.equal(SCHROEDER_PARTICLE_STORAGE_ALLOCATION_ROW_LAYOUT[8], 'sourceSlotActionId:f32');
  assert.equal(SCHROEDER_PARTICLE_STORAGE_ALLOCATION_ROW_LAYOUT[30], 'targetStateFamilyMask:f32');
  assert.equal(SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_FREE_LIST_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-free-list.v0'
  );
  assert.equal(SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS, 8);
  assert.equal(
    SCHROEDER_PARTICLE_STORAGE_FREE_LIST_ROW_LAYOUT.length,
    SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS
  );
  assert.equal(SCHROEDER_PARTICLE_STORAGE_FREE_LIST_ROW_LAYOUT[3], 'maxSlotsPerRow:f32');
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ADMISSION_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-slot-assignment-admission.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-slot-assignment.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-slot-assignment-execution.v0'
  );
  assert.equal(SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS, 32);
  assert.equal(
    SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ROW_LAYOUT.length,
    SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS
  );
  assert.equal(
    SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ROW_LAYOUT[9],
    'assignedTargetSlotStartIndex:f32'
  );
  assert.equal(
    SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ROW_LAYOUT[17],
    'targetSlotCapacityResidual:f32'
  );
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMISSION_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-materialization-admission.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-materialization.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-materialization-execution.v0'
  );
  assert.equal(SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS, 32);
  assert.equal(
    SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ROW_LAYOUT.length,
    SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS
  );
  assert.equal(
    SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ROW_LAYOUT[12],
    'writtenTargetSlotStartIndex:f32'
  );
  assert.equal(
    SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ROW_LAYOUT[22],
    'targetVolumeRatioJ:f32'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-level-update.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-level-update-execution.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-level-update-assignment-overlay.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-assignment-overlay-index.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-assignment-overlay-index-execution.v0'
  );
  assert.equal(SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_MISSING_ROW, 0xffffffff);
  assert.equal(SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS, 32);
  assert.equal(
    SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ROW_LAYOUT.length,
    SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS
  );
  assert.equal(SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ROW_LAYOUT[31], 'refinePressureReasonMask:f32');
  assert.equal(SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-diagnostic-summary.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-phase-volume-diagnostic-summary-execution.v0'
  );
  assert.equal(SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS, 32);
  assert.equal(
    SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_ROW_LAYOUT.length,
    SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS
  );
  assert.equal(SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_ROW_LAYOUT[30], 'refinePressureCount:f32');
  assert.equal(SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_ROW_LAYOUT[31], 'refinePressureReasonMask:f32');
  assert.equal(SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA,
    'peercompute.ulg.schroeder-portable-summary.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PORTABLE_SUMMARY_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-portable-summary-execution.v0'
  );
  assert.equal(
    ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA,
    'peercompute.ulg.schroeder-render-lod-summary.v0'
  );
  assert.equal(ULG_SCHROEDER_CONSERVATION_SUMMARY_SCHEMA, 'peercompute.ulg.schroeder-conservation-summary.v0');
  assert.equal(
    ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-conservation-summary-execution.v0'
  );
  assert.equal(SCHROEDER_CONSERVATION_SUMMARY_FLOATS, 16);
  assert.equal(SCHROEDER_CONSERVATION_SUMMARY_ROW_LAYOUT.length, SCHROEDER_CONSERVATION_SUMMARY_FLOATS);
  assert.equal(SCHROEDER_CONSERVATION_SUMMARY_FLOATS % 4, 0);
  assert.equal(
    ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_SCHEMA,
    'peercompute.ulg.schroeder-active-node-sorted-index.v0'
  );
  assert.equal(
    ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-active-node-sorted-index-execution.v0'
  );
  assert.equal(SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_UINTS, 4);
  assert.equal(
    SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_ROW_LAYOUT.length,
    SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_UINTS
  );
  assert.equal(ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA, 'peercompute.ulg.schroeder-same-level-mechanics.v0');
  assert.equal(
    ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-same-level-mechanics-execution.v0'
  );
});

test('Schroeder level estimates model water-to-steam scale migration without 700x particles', () => {
  assert.equal(estimateSchroederLevelDeltaForVolumeRatio(700), 3);
  assert.equal(schroederGridSpacingForLevel({
    selectedLevel: 3,
    baseGridSpacingM: 0.125,
    minLevel: -8,
    maxLevel: 8
  }), 1);
  assert.equal(
    estimateSchroederLevelFromSupportRadius({
      supportRadiusM: Math.cbrt(700),
      baseGridSpacingM: 1,
      targetSupportCells: 1,
      minLevel: -8,
      maxLevel: 8
    }),
    3
  );
});

test('Schroeder level assignment plan is GPU-first and readback-free by contract', () => {
  const buffers = manualBuffers({ particleCount: 2 });
  const plan = createSchroederLevelAssignmentPlan({
    ...buffers,
    baseGridSpacingM: 0.25,
    minLevel: -4,
    maxLevel: 6,
    targetSupportCells: 1.5
  });
  assert.equal(plan.schema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA);
  assert.equal(plan.status, 'schroeder-level-assignment-plan-ready');
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);
  assert.equal(plan.assignmentByteLength, 2 * 16 * Float32Array.BYTES_PER_ELEMENT);

  const params = createSchroederLevelAssignmentParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 2);
  assert.equal(view.getInt32(4, true), -4);
  assert.equal(view.getInt32(8, true), 6);
  assert.equal(view.getFloat32(16, true), 0.25);
});

test('authoritative two-level coverage derives one pair covering every live assignment row', () => {
  const assignments = new Float32Array(
    4 * SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
  );
  const writeLiveRow = (index, level) => {
    const offset = index * SCHROEDER_LEVEL_ASSIGNMENT_FLOATS;
    assignments[offset] = level;
    assignments[offset + 1] = 0.125 * (2 ** level);
    assignments[offset + 2] = 0.05;
    assignments[offset + 3] = 1;
    assignments[offset + 4] = 1;
    assignments[offset + 5] = 1;
    assignments[offset + 6] = 1;
    assignments[offset + 7] = 1000;
    assignments[offset + 10] = 1;
  };
  writeLiveRow(0, -1);
  writeLiveRow(1, 0);
  writeLiveRow(2, -1);
  const admission = createSchroederTwoLevelCoverageAdmission({
    levelAssignment: {
      schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
      particleCount: 4,
      assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
      minLevel: -8,
      maxLevel: 8,
      fullReadbackPerformed: true,
      assignments
    },
    requestedFineLevel: 1
  });
  assert.equal(admission.admitted, true);
  assert.equal(admission.fineLevel, -1);
  assert.equal(admission.coarseLevel, 0);
  assert.equal(admission.coverageMinLevel, -1);
  assert.equal(admission.coverageMaxLevel, 0);
  assert.equal(admission.liveRowCount, 3);
  assert.equal(admission.allLiveRowsCovered, true);
  assert.equal(admission.readbackRequired, false);
});

test('authoritative two-level coverage rejects the prior silent zero-descriptor freeze', async () => {
  assert.throws(
    () => createSchroederTwoLevelCoverageAdmission({
      levelAssignment: {
        schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
        particleCount: 3,
        assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
        minLevel: -8,
        maxLevel: 8,
        fullReadbackPerformed: false,
        assignments: new Float32Array()
      },
      requestedFineLevel: 1
    }),
    (error) => {
      assert.equal(
        error?.code,
        'ERR_SCHROEDER_TWO_LEVEL_COVERAGE_UNPROVEN'
      );
      assert.equal(error?.coverageMinLevel, -8);
      assert.equal(error?.coverageMaxLevel, 8);
      assert.equal(error?.recommendedFineLevel, -8);
      assert.equal(error?.recommendedMinLevel, -8);
      assert.equal(error?.recommendedMaxLevel, -7);
      return true;
    }
  );
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({
    particleCount: 3,
    smoothingLengthM: 0.25
  });
  let generationCallCount = 0;
  let mechanicsCallCount = 0;
  await assert.rejects(
    runSchroederSameLevelMechanicsWebGpu({
      device,
      ...buffers,
      selectedLevel: 1,
      minLevel: -8,
      maxLevel: 8,
      baseGridSpacingM: 0.25,
      enableTwoLevelMechanics: true,
      twoLevelMechanicsAuthority: 'authoritative',
      enablePressureInterfaceOwnerScope: false,
      spatialEpochGenerationRunner: async () => {
        generationCallCount += 1;
        throw new Error('coverage must reject before spatial generation');
      },
      twoLevelMechanicsRunner: async () => {
        mechanicsCallCount += 1;
        throw new Error('coverage must reject before mechanics');
      }
    }),
    (error) => {
      assert.equal(
        error?.code,
        'ERR_SCHROEDER_TWO_LEVEL_COVERAGE_UNPROVEN'
      );
      return true;
    }
  );
  assert.equal(generationCallCount, 0);
  assert.equal(mechanicsCallCount, 0);
});

test('Schroeder level assignment WGSL uses only authenticated V0*J current volume', () => {
  assert.match(
    schroederLevelAssignmentWgsl,
    /let mechanics_volume_m3 = rest_volume_m3 \* volume_ratio_j/
  );
  assert.match(
    schroederLevelAssignmentWgsl,
    /let current_volume_authority_valid =/
  );
  assert.match(schroederLevelAssignmentWgsl, /constitutive_status == 1\.0/);
  assert.match(schroederLevelAssignmentWgsl, /eos_status == 1\.0/);
  assert.doesNotMatch(
    schroederLevelAssignmentWgsl,
    /phase_volume_reference_mass_kg|mass_kg \/ rest_density_kg_per_m3/
  );
  assert.match(schroederLevelAssignmentWgsl, /physical_radius_m = ss_volume_radius\(source_volume_m3\)/);
  assert.match(schroederLevelAssignmentWgsl, /level_assignments\[assignment_offset \+ 3u\] = represented_volume_m3/);
  assert.match(schroederLevelAssignmentWgsl, /level_assignments\[assignment_offset \+ 5u\] = source_volume_m3/);
});

test('Schroeder active-node plan uses retained level assignments as unsorted tile ranges', () => {
  const levelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-level-assignment-submitted',
    particleCount: 5,
    storageGeneration: 7,
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    assignmentBuffer: { label: 'fake-assignment-buffer' }
  };
  const plan = createSchroederActiveNodeListPlan({
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 2
  });
  assert.equal(plan.schema, ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA);
  assert.equal(plan.status, 'schroeder-active-node-list-plan-ready');
  assert.equal(plan.sourceAssignmentSchema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(plan.activeCandidateCount, 5);
  assert.equal(plan.outputCompaction, 'unsorted-one-row-per-particle-tile-range');
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);
  assert.equal(plan.activeNodeByteLength, 5 * 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(
    plan.spatialEpochSourceSchema,
    'peercompute.ulg.schroeder-spatial-active-node-source.v1'
  );
  assert.equal(plan.spatialEpochSourceStatus, 'schroeder-spatial-active-node-source-ready');
  assert.equal(plan.spatialEpochSourceReady, true);
  assert.equal(plan.spatialEpochLevelSpacingMode, 'base-grid-spacing-times-pow2-level');
  assert.equal(
    plan.spatialEpochPositionAuthority,
    'same-epoch-pre-integration-particle-state'
  );
  assert.ok(plan.spatialEpochMaxLevel >= plan.spatialEpochMinLevel);
  assert.ok(plan.spatialEpochBaseGridSpacingM > 0);

  const params = createSchroederActiveNodeParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 5);
  assert.equal(view.getUint32(4, true), 4);
  assert.equal(view.getFloat32(16, true), 2);
  assert.equal(view.getUint32(32, true), 0);
  assert.equal(view.getUint32(36, true), SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS);
  assert.equal(view.getUint32(40, true), 0);
});

test('Schroeder phase-volume level update assignment overlay targets active-node level selection', () => {
  const levelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-level-assignment-submitted',
    particleCount: 5,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    assignmentBuffer: { label: 'fake-assignment-buffer' }
  };
  const phaseVolumeLevelUpdate = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-level-update-submitted',
    migrationRowCount: 5,
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    levelUpdateBuffer: { label: 'fake-phase-volume-level-update-buffer' },
    levelUpdateBufferByteLength: 5 * SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  };
  const overlay = createSchroederPhaseVolumeLevelUpdateAssignmentOverlayPlan({
    phaseVolumeLevelUpdate,
    levelAssignment,
    selectedLevel: 1
  });
  assert.equal(overlay.schema, ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA);
  assert.equal(overlay.status, 'schroeder-phase-volume-level-update-assignment-overlay-ready');
  assert.equal(overlay.phaseVolumeAssignmentOverlayEnabled, true);
  assert.equal(overlay.selectedLevelSource, 'state-manager-admitted-phase-volume-level-update');
  assert.equal(overlay.nativeLevelSource, 'phase-volume-level-update-target-level');
  assert.equal(overlay.overlayIndexMode, 'row-aligned-source-particle-index');
  assert.equal(overlay.sparseOverlayIndexStatus, 'not-required-row-aligned-level-update-rows');
  assert.equal(overlay.rawGpuBufferTransferAllowed, false);
  assert.equal(overlay.fullParticleReadbackRequired, false);

  const plan = createSchroederActiveNodeListPlan({
    levelAssignment,
    phaseVolumeAssignmentOverlay: overlay,
    tileCellCount: 4,
    supportInflateCells: 2
  });
  assert.equal(plan.phaseVolumeAssignmentOverlayStatus, overlay.status);
  assert.equal(
    plan.phaseVolumeAssignmentOverlayConsumerStatus,
    'phase-volume-level-update-assignment-overlay-consumed-by-active-node-selection'
  );
  assert.equal(plan.phaseVolumeAssignmentOverlayEnabled, true);
  assert.equal(plan.phaseVolumeAssignmentOverlayRowCount, 5);
  assert.equal(plan.phaseVolumeAssignmentOverlayRetainedBuffer, true);
  assert.equal(plan.phaseVolumeAssignmentOverlayRawGpuBufferTransferAllowed, false);
  assert.equal(plan.phaseVolumeAssignmentOverlayFullParticleReadbackRequired, false);
  assert.equal(plan.phaseVolumeLevelSelectionSource, 'state-manager-admitted-phase-volume-level-update');
  assert.equal(plan.phaseVolumeNativeLevelSource, 'phase-volume-level-update-target-level');
  assert.equal(plan.spatialEpochSourceReady, false);
  assert.equal(
    plan.spatialEpochSourceStatus,
    'schroeder-spatial-active-node-source-rejected-phase-volume-overlay'
  );

  const params = createSchroederActiveNodeParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(32, true), 5);
  assert.equal(view.getUint32(36, true), SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS);
  assert.equal(view.getUint32(40, true), 1);
});

test('Schroeder sparse phase-volume assignment overlay requires retained source-particle index', () => {
  const levelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-level-assignment-submitted',
    particleCount: 5,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    assignmentBuffer: { label: 'fake-assignment-buffer' }
  };
  const phaseVolumeLevelUpdate = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-level-update-submitted',
    migrationRowCount: 2,
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    levelUpdateBuffer: { label: 'fake-phase-volume-level-update-buffer' },
    levelUpdateBufferByteLength: 2 * SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  };
  const overlay = createSchroederPhaseVolumeLevelUpdateAssignmentOverlayPlan({
    phaseVolumeLevelUpdate,
    levelAssignment,
    selectedLevel: 1
  });
  assert.equal(overlay.status, 'schroeder-phase-volume-level-update-assignment-overlay-ready');
  assert.equal(overlay.phaseVolumeAssignmentOverlayEnabled, true);
  assert.equal(overlay.rowAlignedWithParticles, false);
  assert.equal(overlay.sparseOverlayIndexRequired, true);
  assert.equal(overlay.overlayIndexMode, 'sparse-source-particle-index-required');

  const blockedActivePlan = createSchroederActiveNodeListPlan({
    levelAssignment,
    phaseVolumeAssignmentOverlay: overlay
  });
  assert.equal(blockedActivePlan.phaseVolumeAssignmentOverlayAvailable, true);
  assert.equal(blockedActivePlan.phaseVolumeAssignmentOverlayEnabled, false);
  assert.equal(blockedActivePlan.phaseVolumeAssignmentOverlayIndexRequired, true);
  assert.equal(blockedActivePlan.phaseVolumeAssignmentOverlayIndexEnabled, false);
  assert.equal(
    blockedActivePlan.phaseVolumeAssignmentOverlayConsumerStatus,
    'blocked-phase-volume-level-update-assignment-overlay-index-required'
  );

  const indexPlan = createSchroederPhaseVolumeAssignmentOverlayIndexPlan({
    phaseVolumeAssignmentOverlay: overlay,
    levelAssignment
  });
  assert.equal(indexPlan.schema, ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_SCHEMA);
  assert.equal(indexPlan.status, 'schroeder-phase-volume-assignment-overlay-index-plan-ready');
  assert.equal(indexPlan.particleCount, 5);
  assert.equal(indexPlan.phaseVolumeAssignmentOverlayRowCount, 2);
  assert.equal(indexPlan.indexByteLength, 5 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(indexPlan.duplicateSourcePolicy, 'atomic-min-first-admitted-row-wins');
  assert.equal(indexPlan.rawGpuBufferTransferAllowed, false);

  const params = createSchroederPhaseVolumeAssignmentOverlayIndexParamsArray(indexPlan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 5);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS);
  assert.equal(view.getUint32(12, true), SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_MISSING_ROW);
});

test('Schroeder active-node index plan builds a retained bucket indirection table', () => {
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 5,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer: { label: 'fake-active-node-buffer' }
  };
  const plan = createSchroederActiveNodeIndexPlan({
    activeNodeList,
    bucketSlotCapacity: 4
  });

  assert.equal(plan.schema, ULG_SCHROEDER_ACTIVE_NODE_INDEX_SCHEMA);
  assert.equal(plan.status, 'schroeder-active-node-index-plan-ready');
  assert.equal(plan.sourceActiveNodeSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(plan.activeNodeCount, 5);
  assert.equal(plan.activeNodeStrideFloats, SCHROEDER_ACTIVE_NODE_FLOATS);
  assert.equal(plan.bucketCount, 4);
  assert.equal(plan.bucketSlotCapacity, 4);
  assert.equal(plan.bucketSlotCount, 16);
  assert.equal(plan.nodeSlotCount, 5);
  assert.equal(plan.bucketCountByteLength, 4 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.bucketSlotByteLength, 16 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.nodeBucketSlotByteLength, 5 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.overflowCounterByteLength, 4 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.outputCompaction, 'bucketed-active-node-indirection-slots');
  assert.equal(plan.capacityStatus, 'bucket-capacity-provisioned-fail-closed-on-overflow');
  assert.equal(plan.indexCoverageStatus, 'tile-min-anchor-index-not-authoritative-overlap-pruning');
  assert.equal(plan.consumerStatus, 'available-for-next-law-neighbor-indexed-traversal-slice');
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederActiveNodeIndexParamsArray(plan);
  const view = new DataView(params);
  assert.equal(params.byteLength, 64);
  assert.equal(view.getUint32(0, true), 5);
  assert.equal(view.getUint32(4, true), SCHROEDER_ACTIVE_NODE_FLOATS);
  assert.equal(view.getUint32(8, true), 4);
  assert.equal(view.getUint32(12, true), 4);
  assert.equal(view.getUint32(16, true), 16);
  assert.equal(view.getUint32(20, true), 5);
  assert.equal(view.getUint32(24, true), 0);
});

test('Schroeder active-node sorted index plan builds retained radix bucket ranges', () => {
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 5,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer: { label: 'fake-active-node-buffer' }
  };
  const plan = createSchroederActiveNodeSortedIndexPlan({
    activeNodeList,
    bucketCount: 8
  });

  assert.equal(plan.schema, ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_SCHEMA);
  assert.equal(plan.status, 'schroeder-active-node-sorted-index-plan-ready');
  assert.equal(plan.sourceActiveNodeSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(plan.activeNodeCount, 5);
  assert.equal(plan.activeNodeStrideFloats, SCHROEDER_ACTIVE_NODE_FLOATS);
  assert.equal(plan.bucketCount, 8);
  assert.equal(plan.bucketRangeOffsetCount, 9);
  assert.deepEqual(plan.bucketRangeRowLayout, [...SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_ROW_LAYOUT]);
  assert.equal(plan.bucketRangeStrideUints, SCHROEDER_ACTIVE_NODE_SORTED_BUCKET_RANGE_UINTS);
  assert.equal(plan.bucketCountByteLength, 8 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.bucketCursorByteLength, 8 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.bucketRangeOffsetByteLength, 9 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.sortedActiveIndexByteLength, 5 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.diagnosticCounterByteLength, 4 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.outputCompaction, 'contiguous-active-node-index-ranges-by-radix-bucket');
  assert.equal(plan.capacityStatus, 'unbounded-per-bucket-range-no-fixed-slot-overflow');
  assert.equal(plan.indexCoverageStatus, 'hash-bucket-ranges-require-exact-overlap-validation');
  assert.equal(plan.consumerStatus, 'available-for-law-neighbor-sorted-radix-traversal');
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederActiveNodeSortedIndexParamsArray(plan);
  const view = new DataView(params);
  assert.equal(params.byteLength, 64);
  assert.equal(view.getUint32(0, true), 5);
  assert.equal(view.getUint32(4, true), SCHROEDER_ACTIVE_NODE_FLOATS);
  assert.equal(view.getUint32(8, true), 8);
  assert.equal(view.getUint32(12, true), 9);
  assert.equal(view.getUint32(16, true), 0);
});

test('Schroeder law queue plan projects active nodes into local law work descriptors', () => {
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 130,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer: { label: 'fake-active-node-buffer' }
  };
  const plan = createSchroederLawQueuePlan({
    activeNodeList,
    queueEpoch: 7,
    stateFamilyId: 2
  });
  assert.equal(plan.schema, ULG_SCHROEDER_LAW_QUEUE_SCHEMA);
  assert.equal(plan.status, 'schroeder-law-queue-plan-ready');
  assert.equal(plan.sourceActiveNodeSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(plan.activeNodeCount, 130);
  assert.equal(plan.lawQueueStrideFloats, SCHROEDER_LAW_QUEUE_FLOATS);
  assert.equal(plan.lawQueueByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.enabledLawMask, SCHROEDER_LOCAL_LAW_QUEUE_MASK);
  assert.equal(plan.candidateBudget, DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET);
  assert.equal(plan.queueEpoch, 7);
  assert.equal(plan.stateFamilyId, 2);
  assert.deepEqual(plan.lawFamilies, ['reaction', 'contact', 'interface']);
  assert.equal(plan.queueTopology, 'one-law-queue-row-per-active-node');
  assert.equal(plan.outputCompaction, 'active-node-local-law-queue-descriptors');
  assert.equal(
    plan.exactNearFieldRequirement,
    'reaction-contact-interface-queues-require-exact-near-field-validation'
  );
  assert.equal(plan.aggregateAdmissibilityStatus, 'far-aggregate-laws-not-enabled-for-local-queues');
  assert.equal(plan.reactionScopeStatus, 'sedenion-scope-preserved-for-reaction-queue');
  assert.equal(plan.stateMutationStatus, 'law-queue-planned-no-state-mutation');
  assert.equal(plan.stateAuthorityStatus, 'state-manager-admission-required-before-law-output-mutation');
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederLawQueueParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_ACTIVE_NODE_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_LAW_QUEUE_FLOATS);
  assert.equal(view.getFloat32(16, true), SCHROEDER_LOCAL_LAW_QUEUE_MASK);
  assert.equal(view.getFloat32(20, true), DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET);
  assert.equal(view.getFloat32(24, true), 7);
  assert.equal(view.getFloat32(28, true), 2);
});

test('Schroeder law-neighbor candidate plan expands law queues through active-node traversal rows', () => {
  const lawQueue = {
    schema: ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
    status: 'schroeder-law-queue-submitted',
    activeNodeCount: 3,
    lawQueueStrideFloats: SCHROEDER_LAW_QUEUE_FLOATS,
    lawQueueBuffer: { label: 'fake-law-queue-buffer' },
    candidateBudget: 5,
    queueEpoch: 11
  };
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 3,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer: { label: 'fake-active-node-buffer' }
  };
  const plan = createSchroederLawNeighborCandidatePlan({
    lawQueue,
    activeNodeList,
    particleCount: 3,
    candidateBudget: 5
  });
  assert.equal(plan.schema, ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA);
  assert.equal(plan.status, 'schroeder-law-neighbor-candidate-plan-ready');
  assert.equal(plan.sourceLawQueueSchema, ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA);
  assert.equal(plan.sourceActiveNodeSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(plan.sourceActiveNodeIndexSchema, null);
  assert.equal(plan.particleCount, 3);
  assert.equal(plan.lawQueueCount, 3);
  assert.equal(plan.activeNodeCount, 3);
  assert.equal(plan.activeNodeIndexEnabled, false);
  assert.equal(plan.activeNodeIndexBucketCount, 0);
  assert.equal(plan.activeNodeIndexBucketSlotCapacity, 0);
  assert.equal(plan.activeNodeIndexBucketSlotCount, 0);
  assert.equal(plan.activeNodeSortedIndexEnabled, false);
  assert.equal(plan.activeNodeSortedIndexBucketCount, 0);
  assert.equal(plan.activeNodeSortedIndexBucketRangeOffsetCount, 0);
  assert.equal(plan.candidateBudget, 5);
  assert.equal(plan.neighborCandidateCount, 15);
  assert.equal(plan.lawQueueStrideFloats, SCHROEDER_LAW_QUEUE_FLOATS);
  assert.equal(plan.activeNodeStrideFloats, SCHROEDER_ACTIVE_NODE_FLOATS);
  assert.equal(plan.neighborCandidateStrideFloats, SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS);
  assert.equal(plan.neighborCandidateByteLength, 15 * 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.sourceCandidateSpanCount, 3);
  assert.equal(plan.sourceCandidateSpanStrideFloats, SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS);
  assert.equal(plan.sourceCandidateSpanByteLength, 3 * 4 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.diagnosticCounterCount, SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT);
  assert.equal(
    plan.diagnosticCounterByteLength,
    SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT * Uint32Array.BYTES_PER_ELEMENT
  );
  assert.deepEqual(plan.diagnosticCounterLayout, [
    'candidateInvocationCount:u32',
    'bucketIndexAttemptCount:u32',
    'bucketSelectedCount:u32',
    'exactFallbackScanCount:u32',
    'exactFallbackSelectedCount:u32',
    'inactiveCandidateCount:u32',
    'bucketPressureCount:u32',
    'sourceSpanWriteCount:u32'
  ]);
  assert.equal(plan.enumerationMode, 'schroeder-active-node-tile-traversal-neighbor-enumeration');
  assert.equal(plan.outputCompaction, 'fixed-budget-law-neighbor-candidate-rows');
  assert.equal(plan.candidateIndexingMode, 'particle-source-candidate-span-table');
  assert.equal(plan.pressureInterfaceSpatialIndexStatus, 'pressure-interface-source-span-spatial-index-planned');
  assert.equal(plan.pressureInterfaceSpatialIndexMode, 'source-particle-candidate-span-table');
  assert.equal(
    plan.pressureInterfaceSpatialIndexConsumerStatus,
    'available-for-pressure-interface-contact-kinematics-source-span-binding'
  );
  assert.equal(
    plan.pressureInterfaceSpatialIndexFallbackPolicy,
    'no-implicit-full-candidate-scan-without-source-span-descriptor'
  );
  assert.equal(plan.activeNodeIndexConsumerStatus, 'active-node-index-disabled-full-active-node-scan');
  assert.equal(
    plan.treeTraversalStatus,
    'active-node-tile-traversal-before-sorted-schroeder-tree-index'
  );
  assert.equal(plan.traversalPolicyMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE);
  assert.equal(plan.traversalPolicyStatus, 'traversal-policy-pending-compact-diagnostic-counters');
  assert.equal(plan.appliedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE);
  assert.equal(plan.recommendedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE);
  assert.equal(plan.sortedRadixIndexStatus, 'sorted-radix-active-node-index-not-required-without-diagnostics');
  assert.equal(plan.traversalDiagnosticReadbackPolicy, 'compact-counter-readback-optional');
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederLawNeighborCandidateParamsArray(plan);
  const view = new DataView(params);
  assert.equal(params.byteLength, 80);
  assert.equal(view.getUint32(0, true), 3);
  assert.equal(view.getUint32(4, true), 3);
  assert.equal(view.getUint32(8, true), 3);
  assert.equal(view.getUint32(12, true), SCHROEDER_LAW_QUEUE_FLOATS);
  assert.equal(view.getUint32(16, true), SCHROEDER_ACTIVE_NODE_FLOATS);
  assert.equal(view.getUint32(20, true), SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS);
  assert.equal(view.getUint32(24, true), 8);
  assert.equal(view.getUint32(28, true), 5);
  assert.equal(view.getUint32(32, true), SCHROEDER_LOCAL_LAW_QUEUE_MASK);
  assert.equal(view.getUint32(40, true), SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS);
  assert.equal(view.getUint32(44, true), 0);
  assert.equal(view.getUint32(48, true), 0);
  assert.equal(view.getUint32(52, true), 0);
  assert.equal(view.getUint32(56, true), 0);
  assert.equal(view.getUint32(60, true), 0);
  assert.equal(view.getUint32(64, true), 0);
  assert.equal(view.getUint32(68, true), 0);
});

test('Schroeder law-neighbor candidate plan can consume an active-node bucket index', () => {
  const lawQueue = {
    schema: ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
    status: 'schroeder-law-queue-submitted',
    activeNodeCount: 3,
    lawQueueStrideFloats: SCHROEDER_LAW_QUEUE_FLOATS,
    lawQueueBuffer: { label: 'fake-law-queue-buffer' },
    candidateBudget: 5,
    queueEpoch: 11
  };
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 3,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer: { label: 'fake-active-node-buffer' }
  };
  const activeNodeIndex = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-index-submitted',
    activeNodeCount: 3,
    bucketCount: 2,
    bucketSlotCapacity: 4,
    bucketSlotCount: 8,
    bucketSlotBuffer: { label: 'fake-active-node-index-bucket-slots' }
  };
  const plan = createSchroederLawNeighborCandidatePlan({
    lawQueue,
    activeNodeList,
    activeNodeIndex,
    particleCount: 3,
    candidateBudget: 5
  });

  assert.equal(plan.activeNodeIndexEnabled, true);
  assert.equal(plan.sourceActiveNodeIndexSchema, ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA);
  assert.equal(plan.activeNodeIndexBucketCount, 2);
  assert.equal(plan.activeNodeIndexBucketSlotCapacity, 4);
  assert.equal(plan.activeNodeIndexBucketSlotCount, 8);
  assert.equal(plan.activeNodeSortedIndexEnabled, false);
  assert.equal(plan.enumerationMode, 'schroeder-active-node-indexed-tile-traversal-neighbor-enumeration');
  assert.equal(plan.activeNodeIndexConsumerStatus, 'active-node-bucket-index-consumed-with-exact-scan-fallback');
  assert.equal(plan.treeTraversalStatus, 'active-node-bucket-index-traversal-with-exact-scan-fallback');
  assert.equal(plan.appliedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(plan.recommendedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);

  const params = createSchroederLawNeighborCandidateParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(44, true), 1);
  assert.equal(view.getUint32(48, true), 2);
  assert.equal(view.getUint32(52, true), 4);
  assert.equal(view.getUint32(56, true), 8);
  assert.equal(view.getUint32(60, true), 0);
  assert.equal(view.getUint32(64, true), 0);
  assert.equal(view.getUint32(68, true), 0);
});

test('Schroeder law-neighbor candidate plan can consume a sorted active-node index', () => {
  const lawQueue = {
    schema: ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
    status: 'schroeder-law-queue-submitted',
    activeNodeCount: 3,
    lawQueueStrideFloats: SCHROEDER_LAW_QUEUE_FLOATS,
    lawQueueBuffer: { label: 'fake-law-queue-buffer' },
    candidateBudget: 5,
    queueEpoch: 11
  };
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 3,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer: { label: 'fake-active-node-buffer' }
  };
  const activeNodeSortedIndex = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-sorted-index-submitted',
    activeNodeCount: 3,
    bucketCount: 4,
    bucketRangeOffsetCount: 5,
    bucketRangeOffsetBuffer: { label: 'fake-sorted-range-offsets' },
    sortedActiveIndexBuffer: { label: 'fake-sorted-active-indices' }
  };
  const plan = createSchroederLawNeighborCandidatePlan({
    lawQueue,
    activeNodeList,
    activeNodeSortedIndex,
    particleCount: 3,
    candidateBudget: 5
  });

  assert.equal(plan.activeNodeSortedIndexEnabled, true);
  assert.equal(plan.sourceActiveNodeSortedIndexSchema, ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA);
  assert.equal(plan.activeNodeSortedIndexBucketCount, 4);
  assert.equal(plan.activeNodeSortedIndexBucketRangeOffsetCount, 5);
  assert.equal(plan.enumerationMode, 'schroeder-active-node-sorted-radix-range-traversal-neighbor-enumeration');
  assert.equal(plan.activeNodeIndexConsumerStatus, 'active-node-sorted-radix-index-consumed-with-exact-scan-fallback');
  assert.equal(plan.treeTraversalStatus, 'active-node-sorted-radix-range-traversal-with-exact-scan-fallback');
  assert.equal(plan.appliedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE);
  assert.equal(plan.recommendedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE);
  assert.equal(plan.sortedRadixIndexStatus, 'sorted-radix-active-node-index-available');

  const params = createSchroederLawNeighborCandidateParamsArray(plan);
  const view = new DataView(params);
  assert.equal(params.byteLength, 80);
  assert.equal(view.getUint32(44, true), 0);
  assert.equal(view.getUint32(60, true), 1);
  assert.equal(view.getUint32(64, true), 4);
  assert.equal(view.getUint32(68, true), 5);
});

test('Schroeder law-neighbor traversal diagnostics decode compact counters', () => {
  const decoded = decodeSchroederLawNeighborTraversalDiagnostics(new Uint32Array([
    10,
    8,
    6,
    2,
    1,
    4,
    3,
    5
  ]));

  assert.deepEqual(decoded, {
    candidateInvocationCount: 10,
    bucketIndexAttemptCount: 8,
    bucketSelectedCount: 6,
    exactFallbackScanCount: 2,
    exactFallbackSelectedCount: 1,
    inactiveCandidateCount: 4,
    bucketPressureCount: 3,
    sourceSpanWriteCount: 5
  });
});

test('Schroeder law-neighbor traversal policy preserves bucket mode without diagnostic readback', () => {
  const policy = createSchroederLawNeighborTraversalPolicy({
    lawNeighborCandidates: {
      schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
      activeNodeIndexEnabled: true,
      lawQueueCount: 4,
      candidateBudget: 8,
      activeNodeIndexBucketCount: 4,
      diagnosticCounters: new Uint32Array()
    }
  });

  assert.equal(policy.status, 'traversal-policy-pending-compact-diagnostic-counters');
  assert.equal(policy.policyMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE);
  assert.equal(policy.appliedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(policy.recommendedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(policy.selectedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(policy.smallSceneDefaultIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(policy.bucketFirstDefault, true);
  assert.equal(policy.sortedRadixIndexRequired, false);
  assert.equal(policy.sortedRadixEscalationAllowed, false);
  assert.equal(policy.sortedRadixEscalationTrigger, null);
  assert.equal(policy.diagnosticCountersAvailable, false);
  assert.equal(policy.diagnosticReadbackRecommended, true);
  assert.equal(policy.fullParticleReadbackRequired, false);
});

test('Schroeder law-neighbor traversal policy requires sorted radix when counters show pressure', () => {
  const policy = createSchroederLawNeighborTraversalPolicy({
    lawNeighborCandidates: {
      schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
      activeNodeIndexEnabled: true,
      lawQueueCount: 4,
      candidateBudget: 8,
      activeNodeIndexBucketCount: 4,
      diagnosticCounters: new Uint32Array([
        32,
        32,
        4,
        28,
        8,
        20,
        8,
        4
      ])
    }
  });

  assert.equal(policy.status, 'traversal-policy-diagnostics-require-sorted-radix-index');
  assert.equal(policy.appliedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(policy.recommendedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE);
  assert.equal(policy.selectedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(policy.smallSceneDefaultIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(policy.bucketFirstDefault, true);
  assert.equal(policy.sortedRadixIndexRequired, true);
  assert.equal(policy.sortedRadixEscalationAllowed, true);
  assert.equal(policy.sortedRadixEscalationTrigger, 'compact-law-neighbor-diagnostics');
  assert.equal(policy.sortedRadixIndexStatus, 'sorted-radix-active-node-index-required-pending-implementation');
  assert.equal(policy.diagnosticCountersAvailable, true);
  assert.equal(policy.diagnosticReadbackRecommended, false);
  assert.ok(policy.ratios.exactFallbackScanRatio > DEFAULT_SCHROEDER_LAW_NEIGHBOR_FALLBACK_SCAN_RATIO_THRESHOLD);
  assert.ok(policy.ratios.bucketPressureRatio > DEFAULT_SCHROEDER_LAW_NEIGHBOR_BUCKET_PRESSURE_RATIO_THRESHOLD);
});

test('Schroeder law-neighbor traversal policy keeps forced bucket mode explicit', () => {
  const policy = createSchroederLawNeighborTraversalPolicy({
    lawNeighborCandidates: {
      schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
      activeNodeIndexEnabled: true,
      lawQueueCount: 4,
      candidateBudget: 8,
      activeNodeIndexBucketCount: 4,
      diagnosticCounters: new Uint32Array([
        32,
        32,
        1,
        31,
        8,
        20,
        8,
        4
      ])
    },
    traversalPolicyMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE
  });

  assert.equal(policy.status, 'traversal-policy-forced-bucketed-active-node-index');
  assert.equal(policy.recommendedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(policy.bucketFirstDefault, false);
  assert.equal(policy.sortedRadixIndexRequired, false);
  assert.equal(policy.sortedRadixEscalationTrigger, null);
});

test('Schroeder active-node sorted index selection waits for compact diagnostics in auto mode', () => {
  const selection = createSchroederActiveNodeSortedIndexSelection({
    activeNodeIndexEnabled: true,
    activeNodeIndexBucketCount: 4,
    lawQueueCount: 4,
    candidateBudget: 8,
    activeNodeSortedIndexPolicyMode: SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_AUTO_MODE
  });

  assert.equal(selection.policyMode, SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_AUTO_MODE);
  assert.equal(selection.status, 'active-node-sorted-index-policy-pending-compact-diagnostics');
  assert.equal(selection.selected, false);
  assert.equal(selection.shouldBuild, false);
  assert.equal(selection.smallSceneDefaultIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(selection.bucketFirstDefault, true);
  assert.equal(selection.sortedRadixBuildTrigger, null);
  assert.equal(selection.sortedRadixBuildAllowedByPolicy, true);
  assert.equal(selection.sortedRadixEscalationTrigger, null);
  assert.equal(selection.diagnosticReadbackRecommended, true);
  assert.equal(selection.sortedRadixTraversalAvailable, false);
  assert.equal(selection.fullParticleReadbackRequired, false);
});

test('Schroeder active-node sorted index selection uses diagnostics to escalate', () => {
  const selection = createSchroederActiveNodeSortedIndexSelection({
    activeNodeIndexEnabled: true,
    activeNodeIndexBucketCount: 4,
    lawQueueCount: 4,
    candidateBudget: 8,
    lawNeighborTraversalDiagnosticCounters: new Uint32Array([
      32,
      32,
      4,
      28,
      8,
      20,
      8,
      4
    ])
  });

  assert.equal(selection.status, 'active-node-sorted-index-policy-selected-by-traversal-diagnostics');
  assert.equal(selection.selected, true);
  assert.equal(selection.shouldBuild, true);
  assert.equal(selection.diagnosticDrivenBuild, true);
  assert.equal(selection.sortedRadixIndexRequired, true);
  assert.equal(selection.sortedRadixIndexStatus, 'sorted-radix-active-node-index-selected-for-construction');
  assert.equal(selection.bucketFirstDefault, false);
  assert.equal(selection.sortedRadixBuildTrigger, 'compact-law-neighbor-diagnostics');
  assert.equal(selection.sortedRadixEscalationTrigger, 'compact-law-neighbor-diagnostics');
  assert.equal(selection.selectedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE);
  assert.equal(selection.peerComputeConfigStatus, 'peercompute-use-case-config-allows-sorted-radix-index');
});

test('Schroeder active-node sorted index selection honors PeerCompute force and disable modes', () => {
  const forced = createSchroederActiveNodeSortedIndexSelection({
    activeNodeSortedIndexPolicyMode: SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_FORCE_MODE,
    lawNeighborTraversalPolicyMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE,
    activeNodeIndexEnabled: true
  });
  assert.equal(forced.status, 'active-node-sorted-index-policy-forced-by-use-case-config');
  assert.equal(forced.selected, true);
  assert.equal(forced.shouldBuild, true);
  assert.equal(forced.forcedByUseCaseConfig, true);
  assert.equal(forced.sortedRadixBuildTrigger, 'peercompute-use-case-force');
  assert.equal(forced.bucketFirstDefault, false);

  const disabled = createSchroederActiveNodeSortedIndexSelection({
    activeNodeSortedIndexPolicyMode: SCHROEDER_ACTIVE_NODE_SORTED_INDEX_POLICY_DISABLED_MODE,
    lawNeighborTraversalPolicyMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
    activeNodeIndexEnabled: true
  });
  assert.equal(disabled.status, 'active-node-sorted-index-policy-disabled-by-use-case-config');
  assert.equal(disabled.selected, false);
  assert.equal(disabled.shouldBuild, false);
  assert.equal(disabled.forcedByTraversalPolicy, true);
  assert.equal(disabled.sortedRadixBuildAllowedByPolicy, false);
  assert.equal(disabled.sortedRadixBuildTrigger, 'forced-traversal-policy');
  assert.equal(disabled.bucketFirstDefault, false);
  assert.equal(disabled.peerComputeConfigStatus, 'peercompute-use-case-config-disables-sorted-radix-index');
});

test('Schroeder cross-level coupling plan keeps child-parent candidates GPU-resident', () => {
  const levelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-level-assignment-submitted',
    particleCount: 4,
    maxLevel: 6,
    baseGridSpacingM: 0.25,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    assignmentBuffer: { label: 'fake-assignment-buffer' }
  };
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 4,
    tileCellCount: 4,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer: { label: 'fake-active-node-buffer' }
  };
  const plan = createSchroederCrossLevelCouplingPlan({
    levelAssignment,
    activeNodeList,
    parentLevelDelta: 1,
    couplingHaloCells: 2,
    minCouplingRadiusM: 0.125
  });
  assert.equal(plan.schema, ULG_SCHROEDER_CROSS_LEVEL_COUPLING_SCHEMA);
  assert.equal(plan.status, 'schroeder-cross-level-coupling-plan-ready');
  assert.equal(plan.sourceAssignmentSchema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(plan.sourceActiveNodeSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(plan.crossLevelCandidateCount, 4);
  assert.equal(plan.outputCompaction, 'one-child-parent-candidate-row-per-particle');
  assert.equal(plan.hierarchyRole, 'cross-level-parent-candidate-generation');
  assert.equal(plan.couplingConsumerStatus, 'planned-not-yet-applied-to-mls-mpm-grid-transfer');
  assert.equal(plan.crossLevelByteLength, 4 * 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederCrossLevelCouplingParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 4);
  assert.equal(view.getInt32(4, true), 6);
  assert.equal(view.getInt32(8, true), 1);
  assert.equal(view.getFloat32(16, true), 0.25);
  assert.equal(view.getFloat32(20, true), 2);
  assert.equal(view.getFloat32(24, true), 0.125);
  assert.equal(view.getUint32(32, true), 4);
});

test('Schroeder conservation summary plan keeps cross-level residuals GPU-resident', () => {
  const crossLevelCoupling = {
    schema: ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA,
    status: 'schroeder-cross-level-coupling-submitted',
    crossLevelCandidateCount: 130,
    crossLevelStrideFloats: SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
    crossLevelBuffer: { label: 'fake-cross-level-buffer' }
  };
  const plan = createSchroederConservationSummaryPlan({ crossLevelCoupling });
  assert.equal(plan.schema, ULG_SCHROEDER_CONSERVATION_SUMMARY_SCHEMA);
  assert.equal(plan.status, 'schroeder-conservation-summary-plan-ready');
  assert.equal(plan.sourceCrossLevelSchema, ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA);
  assert.equal(plan.crossLevelCandidateCount, 130);
  assert.equal(plan.summaryRowCount, 3);
  assert.equal(plan.outputCompaction, 'one-conservation-summary-row-per-workgroup');
  assert.equal(plan.conservativeTransferStatus, 'summary-only-no-state-mutation');
  assert.equal(plan.residualCounterStatus, 'planned-gpu-resident-workgroup-partials');
  assert.deepEqual(plan.conservedQuantities, ['mass', 'represented-volume']);
  assert.equal(plan.summaryByteLength, 3 * 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederConservationSummaryParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_CONSERVATION_SUMMARY_FLOATS);
});

test('Schroeder cross-level transfer plan carries conserved motion and energy rows', () => {
  const buffers = manualBuffers({ particleCount: 130 });
  const crossLevelCoupling = {
    schema: ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA,
    status: 'schroeder-cross-level-coupling-submitted',
    crossLevelCandidateCount: 130,
    crossLevelStrideFloats: SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
    crossLevelBuffer: { label: 'fake-cross-level-buffer' }
  };
  const plan = createSchroederCrossLevelTransferPlan({
    crossLevelCoupling,
    sphParticleState: buffers.sphParticleState
  });
  assert.equal(plan.schema, ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_SCHEMA);
  assert.equal(plan.status, 'schroeder-cross-level-transfer-plan-ready');
  assert.equal(plan.sourceCrossLevelSchema, ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA);
  assert.equal(plan.sourceParticleSchema, ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA);
  assert.equal(plan.crossLevelCandidateCount, 130);
  assert.equal(plan.outputCompaction, 'one-conservative-transfer-row-per-cross-level-candidate');
  assert.equal(plan.conservativeTransferStatus, 'transfer-rows-ready-no-state-mutation');
  assert.deepEqual(plan.conservedQuantities, ['mass', 'represented-volume', 'momentum', 'internal-energy']);
  assert.equal(plan.transferByteLength, 130 * 24 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederCrossLevelTransferParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS);
  assert.equal(view.getUint32(8, true), 8);
  assert.equal(view.getUint32(12, true), SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS);
});

test('Schroeder cross-level state delta plan applies transfer rows as pending conserved deltas', () => {
  const crossLevelTransfer = {
    schema: ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA,
    status: 'schroeder-cross-level-transfer-submitted',
    crossLevelCandidateCount: 130,
    transferStrideFloats: SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS,
    transferBuffer: { label: 'fake-transfer-buffer' }
  };
  const plan = createSchroederCrossLevelStateDeltaPlan({ crossLevelTransfer });
  assert.equal(plan.schema, ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_SCHEMA);
  assert.equal(plan.status, 'schroeder-cross-level-state-delta-plan-ready');
  assert.equal(plan.sourceTransferSchema, ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA);
  assert.equal(plan.crossLevelCandidateCount, 130);
  assert.equal(plan.outputCompaction, 'one-pending-state-delta-row-per-transfer-candidate');
  assert.equal(plan.conservativeTransferStatus, 'pending-state-delta-planned');
  assert.equal(plan.stateMutationTarget, 'schroeder-pending-state-delta-buffer');
  assert.equal(plan.stateMutationStatus, 'pending-state-delta-not-authoritative');
  assert.equal(plan.stateAuthorityStatus, 'requires-state-manager-admission-before-authoritative-merge');
  assert.deepEqual(plan.conservedQuantities, ['mass', 'represented-volume', 'momentum', 'internal-energy']);
  assert.equal(plan.stateDeltaByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederCrossLevelStateDeltaParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS);
});

test('Schroeder state-delta merge admission gates authoritative merge', () => {
  const crossLevelStateDelta = {
    schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA,
    status: 'schroeder-cross-level-state-delta-submitted',
    crossLevelCandidateCount: 5,
    stateDeltaStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
    stateDeltaBuffer: { label: 'fake-state-delta-buffer' }
  };
  const blocked = schroederStateDeltaMergeAdmissionAllowsApplication({
    stateDeltaMergeAdmission: {
      status: 'schroeder-state-delta-merge-admission-admitted',
      outputFamilies: ['other-family'],
      stateDeltaMergeApproved: true,
      schroederStateDeltaRowCount: 5
    },
    crossLevelStateDelta,
    stateDeltaRowCount: 5
  });
  assert.equal(blocked.schema, ULG_SCHROEDER_STATE_DELTA_MERGE_ADMISSION_SCHEMA);
  assert.equal(blocked.status, 'schroeder-state-delta-merge-admission-blocked');
  assert.equal(blocked.approved, false);
  assert.equal(blocked.familyAccepted, false);

  const approved = schroederStateDeltaMergeAdmissionAllowsApplication({
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 5 }),
    crossLevelStateDelta,
    stateDeltaRowCount: 5
  });
  assert.equal(approved.status, 'schroeder-state-delta-merge-admission-approved');
  assert.equal(approved.approved, true);
  assert.equal(approved.familyAccepted, true);
  assert.equal(approved.rowCountAccepted, true);
});

test('Schroeder cross-level state-delta merge plan requires StateManager admission', () => {
  const crossLevelStateDelta = {
    schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA,
    status: 'schroeder-cross-level-state-delta-submitted',
    crossLevelCandidateCount: 130,
    stateDeltaStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
    stateDeltaBuffer: { label: 'fake-state-delta-buffer' }
  };
  const blocked = createSchroederCrossLevelStateDeltaMergePlan({ crossLevelStateDelta });
  assert.equal(blocked.schema, ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_SCHEMA);
  assert.equal(blocked.status, 'schroeder-cross-level-state-delta-merge-plan-blocked-admission-required');
  assert.equal(blocked.stateDeltaMergeAdmissionApproved, false);
  assert.equal(blocked.stateMutationStatus, 'blocked-state-delta-merge-admission-required');

  const approved = createSchroederCrossLevelStateDeltaMergePlan({
    crossLevelStateDelta,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 130 }),
    mergeEpoch: 7
  });
  assert.equal(approved.status, 'schroeder-cross-level-state-delta-merge-plan-ready');
  assert.equal(approved.stateDeltaMergeAdmissionApproved, true);
  assert.equal(approved.outputCompaction, 'one-admitted-state-delta-merge-row-per-pending-delta');
  assert.deepEqual(approved.outputFamilies, ['schroeder-hierarchy-state-delta']);
  assert.equal(approved.stateFamily, 'schroeder-hierarchy');
  assert.equal(approved.stateMutationStatus, 'state-delta-merge-planned');
  assert.equal(approved.stateAuthorityStatus, 'state-manager-admission-present');
  assert.equal(approved.mergeByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);

  const params = createSchroederCrossLevelStateDeltaMergeParamsArray(approved);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS);
  assert.equal(view.getFloat32(16, true), 7);
});

test('Schroeder hierarchy aggregate plan materializes admitted merge rows as unsorted contributions', () => {
  const crossLevelStateDeltaMerge = {
    schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA,
    status: 'schroeder-cross-level-state-delta-merge-submitted',
    crossLevelCandidateCount: 130,
    mergeStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS,
    mergedStateDeltaBuffer: { label: 'fake-merged-state-delta-buffer' }
  };
  const plan = createSchroederHierarchyAggregatePlan({ crossLevelStateDeltaMerge });
  assert.equal(plan.schema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA);
  assert.equal(plan.status, 'schroeder-hierarchy-aggregate-plan-ready');
  assert.equal(plan.sourceStateDeltaMergeSchema, ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA);
  assert.equal(plan.aggregateRowCount, 130);
  assert.equal(plan.outputCompaction, 'unsorted-one-aggregate-contribution-row-per-admitted-merge-row');
  assert.equal(plan.aggregateReductionStatus, 'pending-keyed-reduction');
  assert.equal(plan.stateFamily, 'schroeder-hierarchy');
  assert.deepEqual(plan.outputFamilies, [
    'schroeder-hierarchy-state-delta',
    'schroeder-hierarchy-aggregate-contributions'
  ]);
  assert.equal(plan.stateMutationStatus, 'aggregate-contribution-materialization-planned');
  assert.equal(plan.stateAuthorityStatus, 'state-manager-admitted-merge-buffer-source');
  assert.equal(plan.aggregateByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederHierarchyAggregateParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_HIERARCHY_AGGREGATE_FLOATS);
});

test('Schroeder phase-volume target aggregate plan emits assignment-derived target-cell contributions', () => {
  const levelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-level-assignment-submitted',
    particleCount: 8,
    minLevel: -2,
    maxLevel: 8,
    baseGridSpacingM: 0.25,
    targetSupportCells: 1.5,
    supportRadiusScale: 1,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    assignmentBuffer: { label: 'retained-level-assignment-buffer' }
  };
  const plan = createSchroederPhaseVolumeTargetAggregatePlan({
    levelAssignment,
    identityRequired: true,
    phaseVolumeExpandThreshold: 64,
    gasPhaseId: 3,
    aggregateEpoch: 12
  });
  assert.equal(plan.schema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA);
  assert.equal(plan.status, 'schroeder-phase-volume-target-aggregate-plan-ready');
  assert.equal(plan.sourceAssignmentSchema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(plan.aggregateSourceMode, 'phase-volume-target-level-assignment');
  assert.equal(plan.identityRequired, true);
  assert.equal(plan.aggregateIdentityKeyMode, 'exact-render-domain-id');
  assert.equal(plan.aggregateRowCount, 8);
  assert.equal(plan.outputCompaction, 'one-phase-volume-target-aggregate-contribution-row-per-assignment-row');
  assert.equal(plan.aggregateReductionStatus, 'pending-keyed-reduction');
  assert.equal(plan.stateAuthorityStatus, 'derived-from-current-level-assignment-no-authoritative-state-mutation');
  assert.equal(plan.aggregateByteLength, 8 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederPhaseVolumeTargetAggregateParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 8);
  assert.equal(view.getUint32(4, true), SCHROEDER_LEVEL_ASSIGNMENT_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_HIERARCHY_AGGREGATE_FLOATS);
  assert.equal(view.getInt32(16, true), -2);
  assert.equal(view.getInt32(20, true), 8);
  assert.equal(view.getFloat32(44, true), 64);
  assert.equal(view.getFloat32(48, true), 3);
  assert.equal(view.getFloat32(52, true), 12);
});

test('Schroeder phase-volume topology keys aggregates and migration by exact particle identity', () => {
  assert.match(
    schroederPhaseVolumeTargetAggregateWgsl,
    /@binding\(5\) var<storage, read> particle_identity: array<u32>/
  );
  assert.match(
    schroederPhaseVolumeTargetAggregateWgsl,
    /aggregate_rows\[aggregate_offset \+ 0u\] = f32\(particle_identity\[particle_index\]\)/
  );
  assert.match(
    schroederPhaseVolumeMigrationWgsl,
    /@binding\(4\) var<storage, read> particle_identity: array<u32>/
  );
  assert.match(
    schroederPhaseVolumeMigrationWgsl,
    /ss_pvm_same_cell\(node_offset, particle_domain, target_level_i32, chart_id, target_cell\)/
  );
  assert.match(
    schroederPhaseVolumeMigrationWgsl,
    /abs\(node_domain - particle_domain\) < 0\.5/
  );
});

test('Schroeder hierarchy aggregate-node plan reduces duplicate parent keys on GPU', () => {
  const hierarchyAggregate = {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA,
    status: 'schroeder-hierarchy-aggregate-submitted',
    aggregateRowCount: 130,
    aggregateStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
    aggregateBuffer: { label: 'fake-hierarchy-aggregate-buffer' }
  };
  const plan = createSchroederHierarchyAggregateNodePlan({ hierarchyAggregate });
  assert.equal(plan.schema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA);
  assert.equal(plan.status, 'schroeder-hierarchy-aggregate-node-plan-ready');
  assert.equal(plan.sourceHierarchyAggregateSchema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA);
  assert.equal(plan.aggregateRowCount, 130);
  assert.equal(plan.outputCompaction, 'one-row-per-contribution-first-occurrence-nodes-active-duplicates-suppressed');
  assert.equal(plan.aggregateReductionStatus, 'exact-first-occurrence-global-scan');
  assert.equal(plan.aggregateReductionMode, 'gpu-exact-global-scan-o-n2');
  assert.equal(plan.capacityStatus, 'no-extra-capacity-required-output-row-per-input-row');
  assert.equal(plan.stateFamily, 'schroeder-hierarchy');
  assert.deepEqual(plan.outputFamilies, [
    'schroeder-hierarchy-state-delta',
    'schroeder-hierarchy-aggregate-nodes'
  ]);
  assert.equal(plan.stateMutationStatus, 'aggregate-node-reduction-planned');
  assert.equal(plan.aggregateNodeByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederHierarchyAggregateNodeParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_HIERARCHY_AGGREGATE_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS);
});

test('Schroeder hierarchy aggregate-node plan selects bucketed reduction beyond diagnostic counts', () => {
  const aggregateRowCount = DEFAULT_AGGREGATE_NODE_BUCKET_REDUCTION_MIN_ROWS * 2;
  const hierarchyAggregate = {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA,
    status: 'schroeder-hierarchy-aggregate-submitted',
    aggregateRowCount,
    aggregateStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
    aggregateBuffer: { label: 'large-hierarchy-aggregate-buffer' }
  };
  const plan = createSchroederHierarchyAggregateNodePlan({ hierarchyAggregate });
  assert.equal(plan.aggregateReductionMode, SCHROEDER_BUCKETED_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE);
  assert.equal(plan.aggregateReductionStatus, 'bucketed-bounded-slot-reduction-planned');
  assert.equal(plan.outputCompaction, 'bucketed-first-occurrence-nodes-active-duplicates-suppressed');
  assert.equal(plan.capacityStatus, 'bucket-capacity-provisioned-fail-closed-on-overflow');
  assert.equal(plan.bucketSlotCapacity, DEFAULT_AGGREGATE_NODE_BUCKET_SLOT_CAPACITY);
  assert.ok(plan.bucketCount > 0);
  assert.ok(plan.bucketSlotCount >= aggregateRowCount);
  assert.ok(plan.bucketCountByteLength >= plan.bucketCount * Uint32Array.BYTES_PER_ELEMENT);
  assert.ok(plan.bucketSlotByteLength >= plan.bucketSlotCount * Uint32Array.BYTES_PER_ELEMENT);
  assert.ok(plan.rowBucketSlotByteLength >= aggregateRowCount * Uint32Array.BYTES_PER_ELEMENT);

  const params = createSchroederHierarchyAggregateNodeParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), aggregateRowCount);
  assert.equal(view.getUint32(16, true), plan.bucketCount);
  assert.equal(view.getUint32(20, true), plan.bucketSlotCapacity);
  assert.equal(view.getUint32(24, true), plan.bucketSlotCount);
  assert.equal(view.getUint32(28, true), 2);
});

test('Schroeder far-aggregate candidate plan traverses aggregate-admissible laws over retained nodes', () => {
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 4,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer: { label: 'fake-active-node-buffer' }
  };
  const hierarchyAggregateNode = {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
    status: 'schroeder-hierarchy-aggregate-node-reduction-submitted',
    aggregateNodeCount: 6,
    aggregateNodeStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
    aggregateNodeBuffer: { label: 'fake-hierarchy-aggregate-node-buffer' }
  };
  const plan = createSchroederFarAggregateCandidatePlan({
    activeNodeList,
    hierarchyAggregateNode,
    candidateBudget: 5,
    baseGridSpacingM: 0.25,
    openingTheta: 0.75,
    nearFieldSupportScale: 3,
    farFieldErrorBound: 0.02,
    queueEpoch: 9,
    stateFamilyId: 2
  });

  assert.equal(plan.schema, ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_SCHEMA);
  assert.equal(plan.status, 'schroeder-far-aggregate-candidate-plan-ready');
  assert.equal(plan.sourceActiveNodeSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(plan.sourceHierarchyAggregateNodeSchema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA);
  assert.equal(plan.activeNodeCount, 4);
  assert.equal(plan.aggregateNodeCount, 6);
  assert.equal(plan.candidateBudget, 5);
  assert.equal(plan.farAggregateCandidateCount, 20);
  assert.equal(plan.enabledFarLawMask, SCHROEDER_FAR_AGGREGATE_LAW_MASK);
  assert.deepEqual(plan.farAggregateLawFamilies, ['gravity', 'radiation', 'plasma', 'gas-far-field-summary']);
  assert.equal(plan.farAggregateCandidateStrideFloats, SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS);
  assert.equal(plan.farAggregateCandidateByteLength, 20 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.traversalMode, 'barnes-hut-style-aggregate-opening-over-schroeder-nodes');
  assert.equal(plan.outputCompaction, 'fixed-budget-far-aggregate-candidate-rows-per-active-node');
  assert.equal(
    plan.aggregateAdmissibilityStatus,
    'aggregate-admissible-laws-only-local-incompressibility-and-reactions-excluded'
  );
  assert.equal(
    plan.exactNearFieldRequirement,
    'near-field-excluded-use-law-neighbor-candidates-for-exact-pairs'
  );
  assert.equal(plan.conservationStatus, 'read-only-aggregate-traversal-no-state-mutation');
  assert.equal(plan.stateAuthorityStatus, 'state-manager-admitted-aggregate-node-source-required');
  assert.deepEqual(plan.outputFamilies, [
    'schroeder-far-aggregate-candidates',
    'schroeder-hierarchy-aggregate-nodes'
  ]);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederFarAggregateCandidateParamsArray(plan);
  const view = new DataView(params);
  assert.equal(params.byteLength, 64);
  assert.equal(view.getUint32(0, true), 4);
  assert.equal(view.getUint32(4, true), 6);
  assert.equal(view.getUint32(8, true), SCHROEDER_ACTIVE_NODE_FLOATS);
  assert.equal(view.getUint32(12, true), SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS);
  assert.equal(view.getUint32(16, true), SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS);
  assert.equal(view.getUint32(20, true), 5);
  assert.equal(view.getUint32(24, true), SCHROEDER_FAR_AGGREGATE_LAW_MASK);
  assert.equal(view.getFloat32(32, true), 0.25);
  assert.equal(view.getFloat32(36, true), 0.75);
  assert.equal(view.getFloat32(40, true), 3);
  assert.equal(Math.round(view.getFloat32(44, true) * 100), 2);
  assert.equal(view.getFloat32(48, true), 9);
  assert.equal(view.getFloat32(52, true), 2);
});

test('Schroeder far-aggregate force summary plan reduces candidates into read-only law summaries', () => {
  const farAggregateCandidates = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-candidates-submitted',
    activeNodeCount: 4,
    aggregateNodeCount: 6,
    candidateBudget: 5,
    farAggregateCandidateCount: 20,
    farAggregateCandidateStrideFloats: SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS,
    enabledFarLawMask: SCHROEDER_FAR_AGGREGATE_LAW_MASK,
    farAggregateCandidateBuffer: { label: 'fake-far-aggregate-candidate-buffer' }
  };
  const plan = createSchroederFarAggregateForceSummaryPlan({
    farAggregateCandidates,
    gravitationalConstant: 10,
    softeningLengthM: 0.25,
    forceScale: 2,
    farFieldErrorBound: 0.03,
    queueEpoch: 12,
    stateFamilyId: 3
  });

  assert.equal(plan.schema, ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_SCHEMA);
  assert.equal(plan.status, 'schroeder-far-aggregate-force-summary-plan-ready');
  assert.equal(plan.sourceFarAggregateCandidateSchema, ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_EXECUTION_SCHEMA);
  assert.equal(plan.activeNodeCount, 4);
  assert.equal(plan.farAggregateCandidateCount, 20);
  assert.equal(plan.candidateBudget, 5);
  assert.equal(plan.forceSummaryRowCount, 4);
  assert.equal(plan.forceSummaryStrideFloats, SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS);
  assert.equal(plan.forceSummaryByteLength, 4 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.gravitationalConstant, 10);
  assert.equal(plan.softeningLengthM, 0.25);
  assert.equal(plan.forceScale, 2);
  assert.equal(plan.farFieldErrorBound, 0.03);
  assert.equal(plan.forceMode, 'read-only-gravity-like-far-aggregate-acceleration-summary');
  assert.equal(plan.outputCompaction, 'one-far-aggregate-force-summary-row-per-active-node');
  assert.equal(plan.aggregateAdmissibilityStatus, 'consumes-aggregate-admissible-far-field-candidates-only');
  assert.equal(plan.errorBoundStatus, 'physical-error-bound-declared-on-summary-rows');
  assert.equal(plan.conservationStatus, 'read-only-force-summary-no-state-mutation');
  assert.equal(plan.stateMutationRequired, false);
  assert.equal(plan.stateMutationStatus, 'force-summary-only-no-state-mutation');
  assert.equal(plan.stateAuthorityStatus, 'state-manager-admission-required-before-any-force-application');
  assert.deepEqual(plan.outputFamilies, [
    'schroeder-far-aggregate-force-summary',
    'schroeder-far-aggregate-candidates'
  ]);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederFarAggregateForceSummaryParamsArray(plan);
  const view = new DataView(params);
  assert.equal(params.byteLength, 64);
  assert.equal(view.getUint32(0, true), 4);
  assert.equal(view.getUint32(4, true), 20);
  assert.equal(view.getUint32(8, true), SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS);
  assert.equal(view.getUint32(12, true), SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS);
  assert.equal(view.getUint32(16, true), 5);
  assert.equal(view.getUint32(20, true), SCHROEDER_FAR_AGGREGATE_LAW_MASK);
  assert.equal(view.getFloat32(32, true), 10);
  assert.equal(view.getFloat32(36, true), 0.25);
  assert.equal(view.getFloat32(40, true), 2);
  assert.equal(Math.round(view.getFloat32(44, true) * 100), 3);
  assert.equal(view.getFloat32(48, true), 12);
  assert.equal(view.getFloat32(52, true), 3);
});

test('Schroeder far-aggregate diagnostic summary plan compacts force-quality pressure', () => {
  const farAggregateForceSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-force-summary-submitted',
    activeNodeCount: 4,
    forceSummaryRowCount: 4,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    forceSummaryBuffer: { label: 'fake-far-aggregate-force-summary-buffer' }
  };
  const plan = createSchroederFarAggregateDiagnosticSummaryPlan({
    farAggregateForceSummary,
    openingTheta: 0.75,
    farFieldErrorBound: 0.03,
    accelerationPressureThreshold: 12,
    queueEpoch: 14,
    stateFamilyId: 4
  });

  assert.equal(plan.schema, ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_SCHEMA);
  assert.equal(plan.status, 'schroeder-far-aggregate-diagnostic-summary-plan-ready');
  assert.equal(plan.sourceFarAggregateForceSummarySchema, ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA);
  assert.equal(plan.forceSummaryRowCount, 4);
  assert.equal(plan.diagnosticSummaryRowCount, 1);
  assert.equal(plan.summaryRowCount, 1);
  assert.equal(plan.forceSummaryStrideFloats, SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS);
  assert.equal(plan.diagnosticSummaryStrideFloats, SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS);
  assert.equal(plan.diagnosticSummaryByteLength, 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.openingTheta, 0.75);
  assert.equal(plan.farFieldErrorBound, 0.03);
  assert.equal(plan.accelerationPressureThreshold, 12);
  assert.equal(plan.outputCompaction, 'one-compact-far-aggregate-diagnostic-summary-row');
  assert.equal(plan.diagnosticStatus, 'far-aggregate-diagnostics-ready');
  assert.equal(plan.farFieldQualityStatus, 'far-aggregate-force-quality-pressure-ready');
  assert.equal(plan.readbackPolicy, 'compact-summary-only-no-particle-readback');
  assert.equal(plan.conservationStatus, 'diagnostic-summary-only-no-state-mutation');
  assert.equal(plan.stateMutationRequired, false);
  assert.equal(plan.stateMutationStatus, 'far-aggregate-diagnostic-summary-only-no-state-mutation');
  assert.equal(plan.stateAuthorityStatus, 'state-manager-admission-required-before-any-far-force-application');
  assert.deepEqual(plan.outputFamilies, [
    'schroeder-far-aggregate-diagnostics',
    'schroeder-far-aggregate-force-summary'
  ]);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederFarAggregateDiagnosticSummaryParamsArray(plan);
  const view = new DataView(params);
  assert.equal(params.byteLength, 48);
  assert.equal(view.getUint32(0, true), 4);
  assert.equal(view.getUint32(4, true), SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS);
  assert.equal(view.getFloat32(16, true), 0.75);
  assert.equal(Math.round(view.getFloat32(20, true) * 100), 3);
  assert.equal(view.getFloat32(24, true), 12);
  assert.equal(view.getFloat32(28, true), 14);
  assert.equal(view.getFloat32(32, true), 4);
  assert.equal(DEFAULT_SCHROEDER_FAR_AGGREGATE_ACCELERATION_PRESSURE_THRESHOLD, 0);
});

test('Schroeder far-aggregate force application admission gates mutation targets', () => {
  const farAggregateForceSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-force-summary-submitted',
    activeNodeCount: 5,
    forceSummaryRowCount: 5,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    forceSummaryBuffer: { label: 'fake-far-force-summary' }
  };
  const farAggregateDiagnosticSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-diagnostic-summary-submitted',
    diagnosticSummaryRowCount: 1,
    diagnosticSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS,
    diagnosticSummaryBuffer: { label: 'fake-far-diagnostics' },
    stateMutationRequired: false
  };
  const blocked = schroederFarAggregateForceApplicationAdmissionAllowsApplication({
    farAggregateForceApplicationAdmission: {
      status: 'schroeder-far-aggregate-force-application-admission-admitted',
      outputFamilies: ['other-family'],
      farAggregateForceApplicationApproved: true,
      schroederFarAggregateForceApplicationRowCount: 5
    },
    farAggregateForceSummary,
    farAggregateDiagnosticSummary,
    forceApplicationRowCount: 5
  });
  assert.equal(blocked.schema, ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ADMISSION_SCHEMA);
  assert.equal(blocked.status, 'schroeder-far-aggregate-force-application-admission-blocked');
  assert.equal(blocked.approved, false);
  assert.equal(blocked.familyAccepted, false);

  const approved = schroederFarAggregateForceApplicationAdmissionAllowsApplication({
    farAggregateForceApplicationAdmission: approvedFarAggregateForceApplicationAdmission({ rowCount: 5 }),
    farAggregateForceSummary,
    farAggregateDiagnosticSummary,
    forceApplicationRowCount: 5
  });
  assert.equal(approved.status, 'schroeder-far-aggregate-force-application-admission-approved');
  assert.equal(approved.approved, true);
  assert.equal(approved.familyAccepted, true);
  assert.equal(approved.rowCountAccepted, true);
  assert.equal(approved.diagnosticsAccepted, true);
});

test('Schroeder far-aggregate force application plan requires StateManager admission', () => {
  const { sphParticleState } = manualBuffers({ particleCount: 5, massKg: 2, smoothingLengthM: 0.25 });
  const farAggregateForceSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-force-summary-submitted',
    activeNodeCount: 5,
    forceSummaryRowCount: 5,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    forceSummaryBuffer: { label: 'fake-far-force-summary' },
    queueEpoch: 7,
    stateFamilyId: 3
  };
  const farAggregateDiagnosticSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-diagnostic-summary-submitted',
    diagnosticSummaryRowCount: 1,
    diagnosticSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS,
    diagnosticSummaryBuffer: { label: 'fake-far-diagnostics' },
    stateMutationRequired: false
  };
  const blocked = createSchroederFarAggregateForceApplicationPlan({
    farAggregateForceSummary,
    farAggregateDiagnosticSummary,
    sphParticleState,
    dtS: 0.01
  });
  assert.equal(blocked.schema, ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_SCHEMA);
  assert.equal(blocked.status, 'schroeder-far-aggregate-force-application-plan-blocked-admission-required');
  assert.equal(blocked.farAggregateForceApplicationAdmissionApproved, false);
  assert.equal(blocked.stateMutationStatus, 'blocked-far-aggregate-force-application-admission-required');
  assert.equal(blocked.stateAuthorityStatus, 'requires-state-manager-admission-before-far-force-application');

  const approved = createSchroederFarAggregateForceApplicationPlan({
    farAggregateForceSummary,
    farAggregateDiagnosticSummary,
    sphParticleState,
    farAggregateForceApplicationAdmission: approvedFarAggregateForceApplicationAdmission({ rowCount: 5 }),
    dtS: 0.01,
    accelerationScale: 2,
    maxAccelerationMPerS2: 50,
    maxFarFieldErrorBound: 0.03,
    maxOpeningRatio: 0.75
  });
  assert.equal(approved.status, 'schroeder-far-aggregate-force-application-plan-ready');
  assert.equal(approved.farAggregateForceApplicationAdmissionApproved, true);
  assert.equal(approved.forceApplicationRowCount, 5);
  assert.equal(approved.forceApplicationStrideFloats, SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS);
  assert.equal(approved.forceApplicationByteLength, 5 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(approved.forceApplicationMode, 'admitted-acceleration-to-velocity-momentum-delta');
  assert.equal(approved.outputCompaction, 'one-admitted-far-aggregate-force-application-row-per-source');
  assert.equal(approved.conservationStatus, 'force-application-delta-ready');
  assert.equal(approved.energyPolicy, 'kinetic-delta-reported-potential-read-only');
  assert.equal(approved.stateMutationRequired, true);
  assert.equal(approved.stateMutationStatus, 'far-aggregate-force-application-planned');
  assert.equal(approved.stateAuthorityStatus, 'state-manager-admission-present');
  assert.deepEqual(approved.conservedQuantities, ['momentum-delta', 'kinetic-energy-delta']);
  assert.deepEqual(approved.outputFamilies, [
    'schroeder-far-aggregate-force-application',
    'schroeder-far-aggregate-force-summary'
  ]);
  assert.equal(DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_ACCELERATION_SCALE, 1);
  assert.equal(DEFAULT_SCHROEDER_FAR_AGGREGATE_APPLICATION_MAX_ACCELERATION_M_PER_S2, 0);

  const params = createSchroederFarAggregateForceApplicationParamsArray({
    ...approved,
    admissionApproved: approved.farAggregateForceApplicationAdmissionApproved
  });
  const view = new DataView(params);
  assert.equal(params.byteLength, 64);
  assert.equal(view.getUint32(0, true), 5);
  assert.equal(view.getUint32(4, true), 5);
  assert.equal(view.getUint32(8, true), SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS);
  assert.equal(view.getUint32(12, true), 8);
  assert.equal(view.getUint32(16, true), SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS);
  assert.equal(view.getUint32(20, true), 1);
  assert.equal(Math.round(view.getFloat32(32, true) * 100), 1);
  assert.equal(view.getFloat32(36, true), 2);
  assert.equal(view.getFloat32(40, true), 50);
  assert.equal(Math.round(view.getFloat32(44, true) * 100), 3);
  assert.equal(view.getFloat32(48, true), 0.75);
  assert.equal(view.getFloat32(52, true), 7);
  assert.equal(view.getFloat32(56, true), 3);
});

test('Schroeder phase-volume migration plan consumes aggregate nodes for water-to-steam scale changes', () => {
  const levelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-level-assignment-submitted',
    particleCount: 130,
    minLevel: -4,
    maxLevel: 8,
    baseGridSpacingM: 0.25,
    targetSupportCells: 1.5,
    supportRadiusScale: 1,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    assignmentBuffer: { label: 'fake-level-assignment-buffer' }
  };
  const hierarchyAggregateNode = {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
    status: 'schroeder-hierarchy-aggregate-node-reduction-submitted',
    aggregateRowCount: 130,
    aggregateNodeStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
    aggregateNodeBuffer: { label: 'fake-hierarchy-aggregate-node-buffer' }
  };
  const plan = createSchroederPhaseVolumeMigrationPlan({
    levelAssignment,
    hierarchyAggregateNode,
    identityRequired: true,
    phaseVolumeExpandThreshold: 64,
    coarsenLevelDeltaThreshold: 1,
    gasPhaseId: 3,
    migrationEpoch: 11
  });
  assert.equal(plan.schema, ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA);
  assert.equal(plan.status, 'schroeder-phase-volume-migration-plan-ready');
  assert.equal(plan.sourceAssignmentSchema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(plan.sourceHierarchyAggregateNodeSchema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA);
  assert.equal(plan.particleCount, 130);
  assert.equal(plan.aggregateNodeCount, 130);
  assert.equal(plan.phaseVolumeStatus, 'phase-volume-migration-planned');
  assert.equal(plan.migrationMode, 'physical-volume-level-target-with-aggregate-coherence');
  assert.equal(plan.aggregateCoherenceRequirement, 'retained-aggregate-node-buffer-consumed');
  assert.equal(plan.identityRequired, true);
  assert.equal(plan.aggregateIdentityKeyMode, 'exact-render-domain-id');
  assert.equal(plan.refinePressurePolicy, 'explicit-gpu-row-mask-before-any-split-merge-mutation');
  assert.deepEqual(plan.refinePressureReasonBits, SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS);
  assert.equal(
    plan.waterToSteamScaleStatus,
    'water-to-steam-expansion-maps-to-coarser-levels-without-particle-multiplication'
  );
  assert.deepEqual(plan.outputFamilies, [
    'schroeder-hierarchy-state-delta',
    'schroeder-phase-volume-migration',
    'schroeder-hierarchy-aggregate-nodes'
  ]);
  assert.equal(plan.stateMutationStatus, 'phase-volume-migration-planned');
  assert.equal(plan.stateAuthorityStatus, 'requires-state-manager-admission-for-authoritative-level-migration');
  assert.equal(plan.migrationByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederPhaseVolumeMigrationParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), 130);
  assert.equal(view.getUint32(8, true), SCHROEDER_LEVEL_ASSIGNMENT_FLOATS);
  assert.equal(view.getUint32(12, true), SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS);
  assert.equal(view.getUint32(16, true), SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS);
  assert.equal(view.getInt32(20, true), -4);
  assert.equal(view.getInt32(24, true), 8);
  assert.equal(view.getFloat32(32, true), 0.25);
  assert.equal(view.getFloat32(44, true), 64);
  assert.equal(view.getFloat32(48, true), 1);
  assert.equal(view.getFloat32(52, true), 3);
  assert.equal(view.getFloat32(56, true), 11);
});

test('Schroeder phase-volume migration admission gates authoritative level updates', () => {
  const phaseVolumeMigration = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-migration-submitted',
    particleCount: 5,
    migrationStrideFloats: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
    migrationBuffer: { label: 'fake-phase-volume-migration-buffer' }
  };
  const blocked = schroederPhaseVolumeMigrationAdmissionAllowsApplication({
    phaseVolumeMigrationAdmission: {
      status: 'schroeder-phase-volume-migration-admission-admitted',
      outputFamilies: ['other-family'],
      phaseVolumeMigrationApproved: true,
      schroederPhaseVolumeMigrationRowCount: 5
    },
    phaseVolumeMigration,
    migrationRowCount: 5
  });
  assert.equal(blocked.schema, ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_ADMISSION_SCHEMA);
  assert.equal(blocked.status, 'schroeder-phase-volume-migration-admission-blocked');
  assert.equal(blocked.approved, false);
  assert.equal(blocked.familyAccepted, false);

  const approved = schroederPhaseVolumeMigrationAdmissionAllowsApplication({
    phaseVolumeMigrationAdmission: approvedPhaseVolumeMigrationAdmission({ rowCount: 5 }),
    phaseVolumeMigration,
    migrationRowCount: 5
  });
  assert.equal(approved.status, 'schroeder-phase-volume-migration-admission-approved');
  assert.equal(approved.approved, true);
  assert.equal(approved.familyAccepted, true);
  assert.equal(approved.rowCountAccepted, true);
});

test('Schroeder phase-volume split/merge proposal plan is proposal-only before admission', () => {
  const phaseVolumeMigration = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-migration-submitted',
    particleCount: 130,
    migrationStrideFloats: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
    migrationEpoch: 7,
    migrationBuffer: { label: 'fake-phase-volume-migration-buffer' }
  };
  const plan = createSchroederPhaseVolumeSplitMergeProposalPlan({
    phaseVolumeMigration,
    proposalEpoch: 9,
    stateFamilyId: 3
  });
  assert.equal(plan.schema, ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_SCHEMA);
  assert.equal(plan.status, 'schroeder-phase-volume-split-merge-proposal-plan-ready');
  assert.equal(plan.sourcePhaseVolumeMigrationSchema, ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA);
  assert.equal(plan.migrationRowCount, 130);
  assert.equal(plan.proposalStrideFloats, SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS);
  assert.equal(plan.proposalByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.proposalMode, 'proposal-only-no-particle-mutation');
  assert.equal(plan.outputCompaction, 'one-phase-volume-split-merge-proposal-row-per-migration-row');
  assert.equal(plan.splitMergePolicy, 'coarsen-eligible-merge-or-refine-pressure-split-proposals');
  assert.equal(
    plan.conservationContinuityPolicy,
    'zero-momentum-energy-delta-until-state-manager-admitted-apply'
  );
  assert.equal(plan.mutationAdmissionRequiredBeforeApply, true);
  assert.equal(plan.stateMutationRequired, false);
  assert.equal(plan.stateMutationStatus, 'proposal-buffer-only-no-particle-mutation');
  assert.equal(
    plan.stateAuthorityStatus,
    'state-manager-admission-required-before-any-particle-count-mutation'
  );
  assert.deepEqual(plan.conservedQuantities, [
    'mass',
    'represented-volume',
    'momentum-delta',
    'internal-energy-delta'
  ]);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederPhaseVolumeSplitMergeProposalParamsArray(plan);
  const view = new DataView(params);
  // 48 bytes: the tail carries the optional aggregate-node binding metadata
  // used for merged-child cell momentum.
  assert.equal(params.byteLength, 48);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS);
  assert.equal(view.getFloat32(16, true), 9);
  assert.equal(view.getFloat32(20, true), 3);
  assert.equal(view.getUint32(32, true), 0);
  assert.equal(
    plan.mergedChildMomentumSource,
    'merge-leader-velocity-no-aggregate-node-rows'
  );
});

test('Schroeder phase-volume split/merge admission gates apply rows', () => {
  const phaseVolumeSplitMergeProposal = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-split-merge-proposal-submitted',
    migrationRowCount: 5,
    proposalStrideFloats: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS,
    proposalBuffer: { label: 'fake-phase-volume-split-merge-proposal-buffer' }
  };
  const blocked = schroederPhaseVolumeSplitMergeAdmissionAllowsApplication({
    phaseVolumeSplitMergeAdmission: {
      status: 'schroeder-phase-volume-split-merge-admission-admitted',
      outputFamilies: ['other-family'],
      phaseVolumeSplitMergeApproved: true,
      schroederPhaseVolumeSplitMergeProposalRowCount: 5
    },
    phaseVolumeSplitMergeProposal,
    proposalRowCount: 5
  });
  assert.equal(blocked.schema, ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_ADMISSION_SCHEMA);
  assert.equal(blocked.status, 'schroeder-phase-volume-split-merge-admission-blocked');
  assert.equal(blocked.approved, false);
  assert.equal(blocked.familyAccepted, false);

  const approved = schroederPhaseVolumeSplitMergeAdmissionAllowsApplication({
    phaseVolumeSplitMergeAdmission: approvedPhaseVolumeSplitMergeAdmission({ rowCount: 5 }),
    phaseVolumeSplitMergeProposal,
    proposalRowCount: 5
  });
  assert.equal(approved.status, 'schroeder-phase-volume-split-merge-admission-approved');
  assert.equal(approved.approved, true);
  assert.equal(approved.familyAccepted, true);
  assert.equal(approved.rowCountAccepted, true);
});

test('Schroeder phase-volume split/merge apply plan requires StateManager admission', () => {
  const phaseVolumeSplitMergeProposal = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-split-merge-proposal-submitted',
    migrationRowCount: 130,
    proposalStrideFloats: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS,
    proposalEpoch: 7,
    stateFamilyId: 3,
    proposalBuffer: { label: 'fake-phase-volume-split-merge-proposal-buffer' }
  };
  const blocked = createSchroederPhaseVolumeSplitMergeApplyPlan({ phaseVolumeSplitMergeProposal });
  assert.equal(blocked.schema, ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_SCHEMA);
  assert.equal(blocked.status, 'schroeder-phase-volume-split-merge-apply-plan-blocked-admission-required');
  assert.equal(blocked.phaseVolumeSplitMergeAdmissionApproved, false);
  assert.equal(blocked.stateMutationRequired, false);
  assert.equal(blocked.stateMutationStatus, 'blocked-phase-volume-split-merge-admission-required');

  const approved = createSchroederPhaseVolumeSplitMergeApplyPlan({
    phaseVolumeSplitMergeProposal,
    phaseVolumeSplitMergeAdmission: approvedPhaseVolumeSplitMergeAdmission({ rowCount: 130 }),
    applyEpoch: 11,
    residualTolerance: 1e-5
  });
  assert.equal(approved.status, 'schroeder-phase-volume-split-merge-apply-plan-ready');
  assert.equal(approved.phaseVolumeSplitMergeAdmissionApproved, true);
  assert.equal(approved.outputCompaction, 'one-admitted-phase-volume-split-merge-apply-row-per-proposal-row');
  assert.equal(approved.applyMode, 'state-manager-admitted-split-merge-intent');
  assert.equal(
    approved.particleStorageMutationStatus,
    'deferred-to-state-manager-particle-storage-allocator'
  );
  assert.equal(approved.stateMutationRequired, true);
  assert.equal(approved.stateMutationStatus, 'phase-volume-split-merge-apply-planned');
  assert.equal(approved.stateAuthorityStatus, 'state-manager-admission-present');
  assert.equal(approved.applyByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);

  const params = createSchroederPhaseVolumeSplitMergeApplyParamsArray({
    ...approved,
    admissionApproved: approved.phaseVolumeSplitMergeAdmissionApproved
  });
  const view = new DataView(params);
  assert.equal(params.byteLength, 32);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS);
  assert.equal(view.getUint32(12, true), 1);
  assert.equal(view.getFloat32(16, true), 11);
  assert.equal(view.getFloat32(20, true), 3);
});

test('Schroeder particle-storage allocator admission gates allocation rows', () => {
  const phaseVolumeSplitMergeApply = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-split-merge-apply-submitted',
    proposalRowCount: 5,
    applyStrideFloats: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS,
    applyBuffer: { label: 'fake-phase-volume-split-merge-apply-buffer' }
  };
  const blocked = schroederParticleStorageAllocatorAdmissionAllowsApplication({
    particleStorageAllocatorAdmission: {
      status: 'schroeder-particle-storage-allocator-admission-admitted',
      outputFamilies: ['schroeder-particle-storage-allocation'],
      targetStateFamilies: ['sph-particle-state'],
      particleStorageAllocationApproved: true,
      particleCapacityApproved: true,
      schroederParticleStorageAllocationRowCount: 5,
      currentParticleCapacity: 5,
      requiredParticleCapacity: 5,
      committed: true
    },
    phaseVolumeSplitMergeApply,
    applyRowCount: 5,
    requiredParticleCapacity: 5
  });
  assert.equal(blocked.schema, ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATOR_ADMISSION_SCHEMA);
  assert.equal(blocked.status, 'schroeder-particle-storage-allocator-admission-blocked');
  assert.equal(blocked.approved, false);
  assert.equal(blocked.targetFamiliesAccepted, false);

  const approved = schroederParticleStorageAllocatorAdmissionAllowsApplication({
    particleStorageAllocatorAdmission: approvedParticleStorageAllocatorAdmission({
      rowCount: 5,
      currentParticleCapacity: 8,
      requiredParticleCapacity: 6
    }),
    phaseVolumeSplitMergeApply,
    applyRowCount: 5,
    requiredParticleCapacity: 6
  });
  assert.equal(approved.status, 'schroeder-particle-storage-allocator-admission-approved');
  assert.equal(approved.approved, true);
  assert.equal(approved.familyAccepted, true);
  assert.equal(approved.rowCountAccepted, true);
  assert.equal(approved.capacityAccepted, true);
  assert.equal(approved.targetFamiliesAccepted, true);
});

test('Schroeder particle-storage allocation plan requires allocator admission', () => {
  const phaseVolumeSplitMergeApply = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-split-merge-apply-submitted',
    proposalRowCount: 130,
    applyStrideFloats: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS,
    applyEpoch: 11,
    stateFamilyId: 3,
    applyBuffer: { label: 'fake-phase-volume-split-merge-apply-buffer' }
  };
  const blocked = createSchroederParticleStorageAllocationPlan({ phaseVolumeSplitMergeApply });
  assert.equal(blocked.schema, ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_SCHEMA);
  assert.equal(blocked.status, 'schroeder-particle-storage-allocation-plan-blocked-admission-required');
  assert.equal(blocked.particleStorageAllocatorAdmissionApproved, false);
  assert.equal(blocked.stateMutationRequired, false);
  assert.equal(blocked.stateMutationStatus, 'blocked-particle-storage-allocator-admission-required');

  const approved = createSchroederParticleStorageAllocationPlan({
    phaseVolumeSplitMergeApply,
    particleStorageAllocatorAdmission: approvedParticleStorageAllocatorAdmission({
      rowCount: 130,
      currentParticleCapacity: 192,
      requiredParticleCapacity: 160
    }),
    allocatorEpoch: 12,
    currentParticleCapacity: 192,
    requiredParticleCapacity: 160
  });
  assert.equal(approved.status, 'schroeder-particle-storage-allocation-plan-ready');
  assert.equal(approved.particleStorageAllocatorAdmissionApproved, true);
  assert.equal(approved.outputCompaction, 'one-admitted-particle-storage-allocation-row-per-apply-row');
  assert.equal(approved.allocationMode, 'state-manager-admitted-slot-allocation-intents');
  assert.equal(approved.slotAssignmentStatus, 'sentinel-slot-indices-await-free-list-compaction');
  assert.equal(approved.targetStateFamilyMask, SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK);
  assert.deepEqual(approved.targetStateFamilies, SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES);
  assert.equal(approved.currentParticleCapacity, 192);
  assert.equal(approved.requiredParticleCapacity, 160);
  assert.equal(approved.stateMutationRequired, true);
  assert.equal(approved.stateMutationStatus, 'particle-storage-allocation-planned');
  assert.equal(approved.stateAuthorityStatus, 'state-manager-admission-present');
  assert.equal(approved.allocationByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);

  const params = createSchroederParticleStorageAllocationParamsArray({
    ...approved,
    admissionApproved: approved.particleStorageAllocatorAdmissionApproved
  });
  const view = new DataView(params);
  assert.equal(params.byteLength, 48);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS);
  assert.equal(view.getUint32(12, true), 1);
  assert.equal(view.getFloat32(16, true), 12);
  assert.equal(view.getFloat32(20, true), 3);
  assert.equal(view.getFloat32(24, true), 192);
  assert.equal(view.getFloat32(28, true), 160);
  assert.equal(view.getFloat32(32, true), SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK);
});

test('Schroeder particle-storage free-list plan publishes a retained descriptor row', () => {
  const rows = createSchroederParticleStorageFreeListRows({
    baseSlotIndex: 32,
    slotCapacity: 96,
    availableSlotCount: 64,
    maxSlotsPerRow: 2,
    committedEpoch: 5
  });
  assert.equal(rows.length, SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS);
  assert.equal(rows[0], 32);
  assert.equal(rows[1], 96);
  assert.equal(rows[2], 64);
  assert.equal(rows[3], 2);

  const plan = createSchroederParticleStorageFreeListPlan({ freeListRows: rows });
  assert.equal(plan.schema, ULG_SCHROEDER_PARTICLE_STORAGE_FREE_LIST_SCHEMA);
  assert.equal(plan.status, 'schroeder-particle-storage-free-list-ready');
  assert.equal(plan.freeListStrideFloats, SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS);
  assert.equal(plan.slotCapacity, 96);
  assert.equal(plan.availableSlotCount, 64);
  assert.equal(plan.maxSlotsPerRow, 2);
  assert.equal(plan.committed, true);
  assert.equal(plan.fullParticleReadbackRequired, false);
});

test('Schroeder particle-storage slot-assignment admission gates free-list assignment', () => {
  const particleStorageAllocation = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA,
    status: 'schroeder-particle-storage-allocation-submitted',
    applyRowCount: 5,
    allocationStrideFloats: SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS,
    allocationBuffer: { label: 'fake-particle-storage-allocation-buffer' }
  };
  const particleStorageFreeList = createSchroederParticleStorageFreeListPlan({
    slotCapacity: 16,
    availableSlotCount: 8,
    maxSlotsPerRow: 1
  });
  const blocked = schroederParticleStorageSlotAssignmentAdmissionAllowsApplication({
    particleStorageSlotAssignmentAdmission: {
      status: 'schroeder-particle-storage-slot-assignment-admission-admitted',
      outputFamilies: ['schroeder-particle-storage-slot-assignment'],
      targetStateFamilies: ['sph-particle-state'],
      particleStorageSlotAssignmentApproved: true,
      freeListDescriptorApproved: true,
      schroederParticleStorageSlotAssignmentRowCount: 5,
      committed: true
    },
    particleStorageAllocation,
    particleStorageFreeList,
    allocationRowCount: 5
  });
  assert.equal(blocked.schema, ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ADMISSION_SCHEMA);
  assert.equal(blocked.status, 'schroeder-particle-storage-slot-assignment-admission-blocked');
  assert.equal(blocked.approved, false);
  assert.equal(blocked.targetFamiliesAccepted, false);

  const approved = schroederParticleStorageSlotAssignmentAdmissionAllowsApplication({
    particleStorageSlotAssignmentAdmission: approvedParticleStorageSlotAssignmentAdmission({ rowCount: 5 }),
    particleStorageAllocation,
    particleStorageFreeList,
    allocationRowCount: 5
  });
  assert.equal(approved.status, 'schroeder-particle-storage-slot-assignment-admission-approved');
  assert.equal(approved.approved, true);
  assert.equal(approved.familyAccepted, true);
  assert.equal(approved.rowCountAccepted, true);
  assert.equal(approved.targetFamiliesAccepted, true);
  assert.equal(approved.freeListAccepted, true);
});

test('Schroeder particle-storage slot-assignment plan requires assignment admission', () => {
  const particleStorageAllocation = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA,
    status: 'schroeder-particle-storage-allocation-submitted',
    applyRowCount: 130,
    allocationStrideFloats: SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS,
    allocatorEpoch: 11,
    stateFamilyId: 3,
    allocationBuffer: { label: 'fake-particle-storage-allocation-buffer' }
  };
  const particleStorageFreeList = createSchroederParticleStorageFreeListPlan({
    baseSlotIndex: 32,
    slotCapacity: 192,
    availableSlotCount: 160,
    maxSlotsPerRow: 2
  });
  const blocked = createSchroederParticleStorageSlotAssignmentPlan({
    particleStorageAllocation,
    particleStorageFreeList
  });
  assert.equal(blocked.schema, ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_SCHEMA);
  assert.equal(blocked.status, 'schroeder-particle-storage-slot-assignment-plan-blocked-admission-required');
  assert.equal(blocked.particleStorageSlotAssignmentAdmissionApproved, false);
  assert.equal(blocked.stateMutationRequired, false);

  const approved = createSchroederParticleStorageSlotAssignmentPlan({
    particleStorageAllocation,
    particleStorageFreeList,
    particleStorageSlotAssignmentAdmission: approvedParticleStorageSlotAssignmentAdmission({ rowCount: 130 }),
    assignmentEpoch: 12
  });
  assert.equal(approved.status, 'schroeder-particle-storage-slot-assignment-plan-ready');
  assert.equal(approved.particleStorageSlotAssignmentAdmissionApproved, true);
  assert.equal(approved.outputCompaction, 'one-admitted-slot-assignment-row-per-allocation-row');
  assert.equal(approved.assignmentMode, 'state-manager-admitted-free-list-slot-assignment');
  assert.equal(approved.stateMutationStatus, 'particle-storage-slot-assignment-planned');
  assert.equal(approved.slotAssignmentByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);

  const params = createSchroederParticleStorageSlotAssignmentParamsArray({
    ...approved,
    admissionApproved: approved.particleStorageSlotAssignmentAdmissionApproved,
    maxSlotsPerRow: particleStorageFreeList.maxSlotsPerRow
  });
  const view = new DataView(params);
  assert.equal(params.byteLength, 48);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_PARTICLE_STORAGE_FREE_LIST_FLOATS);
  assert.equal(view.getUint32(12, true), SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS);
  assert.equal(view.getUint32(16, true), 1);
  assert.equal(view.getFloat32(24, true), 12);
  assert.equal(view.getFloat32(28, true), 3);
  assert.equal(view.getFloat32(36, true), 2);
});

test('Schroeder particle-storage materialization admission gates particle-buffer writes', () => {
  const particleStorageSlotAssignment = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-particle-storage-slot-assignment-submitted',
    allocationRowCount: 5,
    slotAssignmentStrideFloats: SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS,
    slotAssignmentBuffer: { label: 'fake-particle-storage-slot-assignment-buffer' }
  };
  const blocked = schroederParticleStorageMaterializationAdmissionAllowsApplication({
    particleStorageMaterializationAdmission: {
      status: 'schroeder-particle-storage-materialization-admission-admitted',
      outputFamilies: ['schroeder-particle-storage-materialization'],
      targetStateFamilies: ['sph-particle-state'],
      particleStorageMaterializationApproved: true,
      slotAssignmentDescriptorApproved: true,
      schroederParticleStorageMaterializationRowCount: 5,
      committed: true
    },
    particleStorageSlotAssignment,
    assignmentRowCount: 5
  });
  assert.equal(blocked.schema, ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMISSION_SCHEMA);
  assert.equal(blocked.status, 'schroeder-particle-storage-materialization-admission-blocked');
  assert.equal(blocked.approved, false);
  assert.equal(blocked.targetFamiliesAccepted, false);

  const approved = schroederParticleStorageMaterializationAdmissionAllowsApplication({
    particleStorageMaterializationAdmission: approvedParticleStorageMaterializationAdmission({ rowCount: 5 }),
    particleStorageSlotAssignment,
    assignmentRowCount: 5
  });
  assert.equal(approved.status, 'schroeder-particle-storage-materialization-admission-approved');
  assert.equal(approved.approved, true);
  assert.equal(approved.familyAccepted, true);
  assert.equal(approved.rowCountAccepted, true);
  assert.equal(approved.targetFamiliesAccepted, true);
  assert.equal(approved.slotAssignmentAccepted, true);
});

test('Schroeder particle-storage materialization plan requires StateManager admission', () => {
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const particleStorageSlotAssignment = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-particle-storage-slot-assignment-submitted',
    allocationRowCount: 5,
    slotAssignmentStrideFloats: SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS,
    assignmentEpoch: 21,
    stateFamilyId: 3,
    slotAssignmentBuffer: { label: 'fake-particle-storage-slot-assignment-buffer' }
  };
  const blocked = createSchroederParticleStorageMaterializationPlan({
    ...buffers,
    particleStorageSlotAssignment
  });
  assert.equal(blocked.schema, ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_SCHEMA);
  assert.equal(blocked.status, 'schroeder-particle-storage-materialization-plan-blocked-admission-required');
  assert.equal(blocked.particleStorageMaterializationAdmissionApproved, false);
  assert.equal(blocked.stateMutationRequired, false);

  const approved = createSchroederParticleStorageMaterializationPlan({
    ...buffers,
    particleStorageSlotAssignment,
    particleStorageMaterializationAdmission: approvedParticleStorageMaterializationAdmission({
      rowCount: 5,
      requiredParticleCapacity: 8
    }),
    outputParticleCapacity: 8,
    materializationEpoch: 22,
    stateFamilyId: 4
  });
  assert.equal(approved.status, 'schroeder-particle-storage-materialization-plan-ready');
  assert.equal(approved.particleStorageMaterializationAdmissionApproved, true);
  assert.equal(approved.outputCompaction, 'one-admitted-particle-storage-materialization-row-per-assignment-row');
  assert.equal(approved.materializationMode, 'state-manager-admitted-particle-buffer-materialization');
  assert.equal(approved.replacementPolicy, 'retained-output-buffers-await-state-manager-swap');
  assert.equal(approved.sourceParticleCount, 3);
  assert.equal(approved.outputParticleCapacity, 8);
  assert.equal(approved.stateMutationStatus, 'particle-storage-materialization-planned');
  assert.equal(approved.stateByteLength, 8 * 8 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(approved.thermoByteLength, 8 * 12 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(approved.mechanicsByteLength, 8 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(approved.identityByteLength, 8 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(approved.identityStrideUints, 1);
  assert.equal(approved.identityRequired, false);
  assert.equal(approved.materializationByteLength, 5 * 32 * Float32Array.BYTES_PER_ELEMENT);

  const params = createSchroederParticleStorageMaterializationParamsArray({
    ...approved,
    admissionApproved: approved.particleStorageMaterializationAdmissionApproved
  });
  const view = new DataView(params);
  assert.equal(params.byteLength, 64);
  assert.equal(view.getUint32(0, true), 5);
  assert.equal(view.getUint32(4, true), SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS);
  assert.equal(view.getUint32(8, true), 3);
  assert.equal(view.getUint32(12, true), 8);
  assert.equal(view.getUint32(16, true), 2);
  assert.equal(view.getUint32(20, true), 3);
  assert.equal(view.getUint32(24, true), 8);
  assert.equal(view.getUint32(28, true), SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS);
  assert.equal(view.getUint32(32, true), 1);
  assert.equal(view.getFloat32(40, true), 22);
  assert.equal(view.getFloat32(44, true), 4);
});

test('Schroeder materialization WGSL preserves exact identity and blocks cross-domain merges', () => {
  assert.match(
    schroederParticleStorageMaterializationWgsl,
    /@binding\(9\) var<storage, read> source_particle_identity: array<u32>/
  );
  assert.match(
    schroederParticleStorageMaterializationWgsl,
    /out_particle_identity\[target_index\] = source_particle_identity\[source_index\]/
  );
  assert.match(schroederParticleStorageMaterializationWgsl, /ss_psm_merge_identity_compatible/);
  assert.match(
    schroederParticleStorageMaterializationWgsl,
    /ss_psm_write_empty\(materialization_offset, assignment_offset, 64\.0\)/
  );
  assert.match(
    schroederParticleStorageMaterializationWgsl,
    /out_sph_thermo\[thermo_base \+ 2u\] = vec4<f32>\(thermo2\.x, 0\.0, 0\.0, thermo2\.w\)/
  );
});

test('Schroeder phase-volume level update plan requires StateManager admission', () => {
  const phaseVolumeMigration = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-migration-submitted',
    particleCount: 130,
    migrationStrideFloats: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
    migrationBuffer: { label: 'fake-phase-volume-migration-buffer' }
  };
  const blocked = createSchroederPhaseVolumeLevelUpdatePlan({ phaseVolumeMigration });
  assert.equal(blocked.schema, ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA);
  assert.equal(blocked.status, 'schroeder-phase-volume-level-update-plan-blocked-admission-required');
  assert.equal(blocked.phaseVolumeMigrationAdmissionApproved, false);
  assert.equal(blocked.stateMutationStatus, 'blocked-phase-volume-level-update-admission-required');

  const approved = createSchroederPhaseVolumeLevelUpdatePlan({
    phaseVolumeMigration,
    phaseVolumeMigrationAdmission: approvedPhaseVolumeMigrationAdmission({ rowCount: 130 }),
    migrationEpoch: 7
  });
  assert.equal(approved.status, 'schroeder-phase-volume-level-update-plan-ready');
  assert.equal(approved.phaseVolumeMigrationAdmissionApproved, true);
  assert.equal(approved.outputCompaction, 'one-admitted-phase-volume-level-update-row-per-migration-row');
  assert.deepEqual(approved.outputFamilies, [
    'schroeder-hierarchy-state-delta',
    'schroeder-phase-volume-migration',
    'schroeder-phase-volume-level-update'
  ]);
  assert.equal(approved.stateFamily, 'schroeder-hierarchy');
  assert.equal(approved.stateMutationStatus, 'phase-volume-level-update-planned');
  assert.equal(approved.stateAuthorityStatus, 'state-manager-admission-present');
  assert.equal(approved.levelUpdateByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);

  const params = createSchroederPhaseVolumeLevelUpdateParamsArray({
    ...approved,
    admissionApproved: approved.phaseVolumeMigrationAdmissionApproved
  });
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS);
  assert.equal(view.getUint32(12, true), 1);
  assert.equal(view.getFloat32(20, true), 7);
});

test('Schroeder phase-volume diagnostic summary plan reads compact admitted level updates only', () => {
  const phaseVolumeLevelUpdate = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-level-update-submitted',
    migrationRowCount: 130,
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    migrationEpoch: 7,
    levelUpdateBuffer: { label: 'fake-phase-volume-level-update-buffer' }
  };
  const plan = createSchroederPhaseVolumeDiagnosticSummaryPlan({
    phaseVolumeLevelUpdate,
    phaseVolumeExpandThreshold: 64
  });
  assert.equal(plan.schema, ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_SCHEMA);
  assert.equal(plan.status, 'schroeder-phase-volume-diagnostic-summary-plan-ready');
  assert.equal(plan.sourcePhaseVolumeLevelUpdateSchema, ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA);
  assert.equal(plan.levelUpdateRowCount, 130);
  assert.equal(plan.summaryRowCount, 1);
  assert.equal(plan.outputCompaction, 'one-compact-phase-volume-diagnostic-summary-row');
  assert.equal(plan.diagnosticStatus, 'phase-volume-diagnostics-ready');
  assert.equal(plan.visibleStressCaseStatus, 'water-to-steam-level-migration-diagnostics-ready');
  assert.equal(plan.refinePressurePolicy, 'compact-summary-count-and-reason-mask-no-particle-readback');
  assert.deepEqual(plan.refinePressureReasonBits, SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS);
  assert.equal(plan.readbackPolicy, 'compact-summary-only-no-particle-readback');
  assert.equal(plan.summaryByteLength, 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederPhaseVolumeDiagnosticSummaryParamsArray(plan);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 130);
  assert.equal(view.getUint32(4, true), SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS);
  assert.equal(view.getFloat32(16, true), 64);
  assert.equal(view.getFloat32(20, true), 7);
});

test('Schroeder portable summary plan exposes render LOD descriptors without GPUBuffer transfer', () => {
  const levelAssignmentByteLength = 3 * SCHROEDER_LEVEL_ASSIGNMENT_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const activeNodeByteLength = 3 * SCHROEDER_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const lawQueueByteLength = 3 * SCHROEDER_LAW_QUEUE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const neighborByteLength = 9 * SCHROEDER_LAW_NEIGHBOR_CANDIDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const farAggregateCandidateByteLength =
    12 * SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const farAggregateForceSummaryByteLength =
    3 * SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const farAggregateDiagnosticSummaryByteLength =
    SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const farAggregateLawConsumerByteLength =
    3 * SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const farAggregateLawConsumerDiagnosticSummaryByteLength =
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const farAggregateGasStateDeltaByteLength =
    3 * SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const farAggregateGasCellImportByteLength =
    3 * SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const farAggregateForceApplicationByteLength =
    3 * SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const aggregateNodeByteLength = 2 * SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const summaryByteLength = SCHROEDER_CONSERVATION_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const phaseDiagnosticByteLength =
    SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const plan = createSchroederPortableSummaryPlan({
    levelAssignment: {
      schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
      status: 'schroeder-level-assignment-submitted',
      particleCount: 3,
      assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
      assignmentBuffer: { label: 'retained-level-assignment' },
      assignmentBufferByteLength: levelAssignmentByteLength
    },
    activeNodeList: {
      schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
      status: 'schroeder-active-node-list-submitted',
      particleCount: 3,
      activeCandidateCount: 3,
      activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
      activeNodeBuffer: { label: 'retained-active-node-list' },
      activeNodeBufferByteLength: activeNodeByteLength
    },
    lawQueue: {
      schema: ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
      status: 'schroeder-law-queue-submitted',
      activeNodeCount: 3,
      lawQueueStrideFloats: SCHROEDER_LAW_QUEUE_FLOATS,
      lawQueueBuffer: { label: 'retained-law-queue' },
      lawQueueBufferByteLength: lawQueueByteLength
    },
    lawNeighborCandidates: {
      schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
      status: 'schroeder-law-neighbor-candidates-submitted',
      neighborCandidateCount: 9,
      neighborCandidateBuffer: { label: 'retained-law-neighbor-candidates' },
      neighborCandidateBufferByteLength: neighborByteLength
    },
    farAggregateCandidates: {
      schema: ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_EXECUTION_SCHEMA,
      status: 'schroeder-far-aggregate-candidates-submitted',
      farAggregateCandidateCount: 12,
      farAggregateCandidateStrideFloats: SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS,
      farAggregateCandidateBuffer: { label: 'retained-far-aggregate-candidates' },
      farAggregateCandidateBufferByteLength: farAggregateCandidateByteLength
    },
    farAggregateForceSummary: {
      schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
      status: 'schroeder-far-aggregate-force-summary-submitted',
      activeNodeCount: 3,
      forceSummaryRowCount: 3,
      forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
      forceSummaryBuffer: { label: 'retained-far-aggregate-force-summary' },
      forceSummaryBufferByteLength: farAggregateForceSummaryByteLength
    },
    farAggregateDiagnosticSummary: {
      schema: ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
      status: 'schroeder-far-aggregate-diagnostic-summary-submitted',
      diagnosticSummaryRowCount: 1,
      diagnosticSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS,
      diagnosticSummaryRows: new Float32Array(SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS),
      diagnosticSummaryBuffer: { label: 'retained-far-aggregate-diagnostic-summary' },
      diagnosticSummaryBufferByteLength: farAggregateDiagnosticSummaryByteLength
    },
    farAggregateLawConsumer: {
      schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA,
      status: 'schroeder-far-aggregate-law-consumer-submitted',
      forceSummaryRowCount: 3,
      lawConsumerRowCount: 3,
      lawConsumerStrideFloats: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
      lawConsumerBuffer: { label: 'retained-far-aggregate-law-consumer' },
      lawConsumerBufferByteLength: farAggregateLawConsumerByteLength
    },
    farAggregateLawConsumerDiagnosticSummary: {
      schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
      status: 'schroeder-far-aggregate-law-consumer-diagnostic-summary-submitted',
      lawConsumerRowCount: 3,
      lawConsumerDiagnosticSummaryRowCount: 1,
      lawConsumerDiagnosticSummaryStrideFloats:
        SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS,
      lawConsumerDiagnosticSummaryRows: new Float32Array(
        SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS
      ),
      lawConsumerDiagnosticSummaryBuffer: {
        label: 'retained-far-aggregate-law-consumer-diagnostic-summary'
      },
      lawConsumerDiagnosticSummaryBufferByteLength: farAggregateLawConsumerDiagnosticSummaryByteLength
    },
    farAggregateGasStateDelta: {
      schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA,
      status: 'schroeder-far-aggregate-gas-state-delta-submitted',
      lawConsumerRowCount: 3,
      gasStateDeltaRowCount: 3,
      stateDeltaRowCount: 3,
      gasStateDeltaStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS,
      targetStateFamily: SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_TARGET_FAMILY,
      gasStateDeltaBuffer: { label: 'retained-far-aggregate-gas-state-delta' },
      gasStateDeltaBufferByteLength: farAggregateGasStateDeltaByteLength
    },
    farAggregateGasCellImport: {
      schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA,
      status: 'schroeder-far-aggregate-gas-cell-import-submitted',
      gasPressureCellRowCount: 3,
      pressureInterfaceGasPressureCellRowCount: 3,
      gasPressureCellRowStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS,
      pressureInterfaceGasPressureCellRowStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS,
      gasPressureCellRowByteLength: farAggregateGasCellImportByteLength,
      pressureInterfaceGasPressureCellRowByteLength: farAggregateGasCellImportByteLength,
      pressureInterfaceImportReady: true,
      retainedGasCellFieldSourceReady: true,
      retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
      gasPressureCellsBuffer: { label: 'retained-far-aggregate-gas-pressure-cells' }
    },
    farAggregateForceApplication: {
      schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA,
      status: 'schroeder-far-aggregate-force-application-submitted',
      forceSummaryRowCount: 3,
      forceApplicationRowCount: 3,
      forceApplicationStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS,
      forceApplicationBuffer: { label: 'retained-far-aggregate-force-application' },
      forceApplicationBufferByteLength: farAggregateForceApplicationByteLength
    },
    hierarchyAggregateNode: {
      schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
      status: 'schroeder-hierarchy-aggregate-node-submitted',
      aggregateNodeCount: 2,
      aggregateNodeStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
      aggregateNodeBuffer: { label: 'retained-hierarchy-aggregate-node' },
      aggregateNodeBufferByteLength: aggregateNodeByteLength
    },
    conservationSummary: {
      schema: ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
      status: 'schroeder-conservation-summary-submitted',
      summaryRowCount: 1,
      summaryBuffer: { label: 'retained-conservation-summary' },
      summaryBufferByteLength: summaryByteLength
    },
    phaseVolumeDiagnosticSummary: {
      schema: ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
      status: 'schroeder-phase-volume-diagnostic-summary-submitted',
      summaryRowCount: 1,
      summaryRows: new Float32Array(SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FLOATS),
      summaryBuffer: { label: 'retained-phase-volume-diagnostic-summary' },
      summaryBufferByteLength: phaseDiagnosticByteLength
    },
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    peerComputeUseCase: 'test-render-lod'
  });

  assert.equal(plan.schema, ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA);
  assert.equal(plan.status, 'schroeder-portable-summary-plan-ready');
  assert.equal(plan.transferMode, 'peercompute-portable-summary-descriptors');
  assert.equal(plan.portableSummaryMode, 'portable-descriptors-not-raw-gpubuffers');
  assert.equal(plan.portableMaterializationStatus, 'compact-summary-descriptor-ready-no-gpubuffer-transfer');
  assert.equal(plan.presentationAuthority, 'presentation-consumes-render-lod-summary-not-physics-state');
  assert.equal(plan.stateAuthorityStatus, 'state-manager-admission-required-before-authoritative-remote-replay');
  assert.equal(plan.peerComputeUseCase, 'test-render-lod');
  assert.equal(plan.selectedLevel, 2);
  assert.equal(plan.nativeGridSpacingM, 1);
  assert.equal(plan.activeNodeCount, 3);
  assert.equal(plan.aggregateNodeCount, 2);
  assert.equal(plan.lawQueueCount, 3);
  assert.equal(plan.lawNeighborCandidateCount, 9);
  assert.equal(plan.farAggregateCandidateCount, 12);
  assert.equal(plan.farAggregateForceSummaryCount, 3);
  assert.equal(plan.farAggregateDiagnosticSummaryCount, 1);
  assert.equal(plan.farAggregateLawConsumerCount, 3);
  assert.equal(plan.farAggregateLawConsumerDiagnosticSummaryCount, 1);
  assert.equal(plan.farAggregateGasStateDeltaCount, 3);
  assert.equal(plan.farAggregateGasCellImportCount, 3);
  assert.equal(plan.farAggregateForceApplicationCount, 3);
  assert.equal(plan.retainedRefCount, 15);
  assert.equal(plan.retainedBufferRefCount, 15);
  assert.equal(
    plan.retainedRefs.find((entry) => entry.family === 'schroeder-active-node-list')?.retainedBufferRef,
    'schroeder-active-node-list:render-lod-leaf-source'
  );
  assert.equal(
    plan.retainedRefs.find((entry) => entry.family === 'schroeder-hierarchy-aggregate-node')?.retainedBufferRef,
    'schroeder-hierarchy-aggregate-node:spatial-aggregate-render-proxy-source'
  );
  assert.equal(plan.sourceFamilyRole, 'canonical-pre-integration-x-n');
  assert.equal(plan.finalContinuationAuthority, false);
  assert.equal(plan.coherentSolidAuthority, false);
  assert.equal(
    plan.retainedRefs.find((entry) => entry.family === 'schroeder-far-aggregate-candidate')?.retainedBufferRef,
    'schroeder-far-aggregate-candidate:aggregate-admissible-far-field-law-candidates'
  );
  assert.equal(
    plan.retainedRefs.find((entry) => entry.family === 'schroeder-far-aggregate-force-summary')?.retainedBufferRef,
    'schroeder-far-aggregate-force-summary:read-only-far-field-force-summary'
  );
  assert.equal(
    plan.retainedRefs.find((entry) => entry.family === 'schroeder-far-aggregate-diagnostic-summary')?.retainedBufferRef,
    'schroeder-far-aggregate-diagnostic-summary:far-field-force-quality-diagnostics'
  );
  assert.equal(
    plan.retainedRefs.find((entry) => entry.family === 'schroeder-far-aggregate-law-consumer')?.retainedBufferRef,
    'schroeder-far-aggregate-law-consumer:read-only-radiation-plasma-gas-summary-consumers'
  );
  assert.equal(
    plan.retainedRefs.find((entry) => (
      entry.family === 'schroeder-far-aggregate-law-consumer-diagnostic-summary'
    ))?.retainedBufferRef,
    'schroeder-far-aggregate-law-consumer-diagnostic-summary:far-field-law-consumer-pressure-diagnostics'
  );
  assert.equal(
    plan.retainedRefs.find((entry) => (
      entry.family === SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_OUTPUT_FAMILY
    ))?.retainedBufferRef,
    'schroeder-far-aggregate-gas-state-delta:admitted-far-field-gas-pressure-state-deltas'
  );
  const retainedGasCellRef = plan.retainedRefs.find((entry) => (
    entry.family === SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_OUTPUT_FAMILY
  ));
  assert.equal(retainedGasCellRef?.role, 'retained-pressure-interface-gas-cell-rows');
  assert.equal(retainedGasCellRef?.rowCount, 3);
  assert.equal(retainedGasCellRef?.strideFloats, SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS);
  assert.equal(retainedGasCellRef?.byteLength, farAggregateGasCellImportByteLength);
  assert.equal(retainedGasCellRef?.retainedBufferRef, 'resident-gas-pressure-cells-buffer');
  assert.equal(
    plan.retainedRefs.find((entry) => entry.family === 'schroeder-far-aggregate-force-application')?.retainedBufferRef,
    'schroeder-far-aggregate-force-application:admitted-far-field-force-application-deltas'
  );
  assert.equal(plan.renderLod.schema, ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA);
  assert.equal(plan.renderLod.status, 'schroeder-render-lod-summary-planned');
  assert.equal(plan.renderLod.activeLeafProxyCount, 3);
  assert.equal(plan.renderLod.aggregateProxyCount, 2);
  assert.equal(plan.renderLod.lawQueueProxyCount, 3);
  assert.equal(plan.renderLod.farAggregateCandidateProxyCount, 12);
  assert.equal(plan.renderLod.farAggregateForceSummaryCount, 3);
  assert.equal(plan.renderLod.farAggregateDiagnosticSummaryCount, 1);
  assert.equal(plan.renderLod.farAggregateLawConsumerCount, 3);
  assert.equal(plan.renderLod.farAggregateLawConsumerDiagnosticSummaryCount, 1);
  assert.equal(plan.renderLod.farAggregateGasStateDeltaCount, 3);
  assert.equal(plan.renderLod.farAggregateGasCellImportCount, 3);
  assert.equal(plan.renderLod.farAggregateForceApplicationCount, 3);
  assert.equal(plan.renderLod.phaseVolumeDiagnosticRowsAvailable, true);
  assert.equal(plan.renderLod.fullParticleReadbackRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);
  assert.equal(
    plan.retainedRefs.every((entry) => entry.transferMode === 'descriptor-only-no-raw-gpubuffer-transfer'),
    true
  );
  assert.equal(plan.retainedRefs.some((entry) => Object.hasOwn(entry, 'buffer')), false);
  assert.equal(plan.retainedRefs.some((entry) => Object.hasOwn(entry, 'gpuBuffer')), false);
});

test('Schroeder same-level mechanics plan selects a native hierarchy grid spacing', () => {
  const buffers = manualBuffers({ particleCount: 2, smoothingLengthM: 0.125 });
  const plan = createSchroederSameLevelMechanicsPlan({
    ...buffers,
    selectedLevel: 3,
    baseGridSpacingM: 0.125,
    minLevel: -4,
    maxLevel: 6
  });
  assert.equal(plan.schema, ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA);
  assert.equal(plan.status, 'schroeder-same-level-mechanics-plan-ready');
  assert.equal(plan.nativeGridSpacingM, 1);
  assert.equal(plan.selectedLevel, 3);
  assert.equal(plan.mechanicsBackend, 'mls-mpm-resident-step-selected-schroeder-level');
  assert.equal(plan.crossLevelCouplingStatus, 'optional-candidate-generation-available-not-yet-consumed');
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.fullParticleReadbackRequired, false);
});

test('Schroeder WebGPU level assignment submits without default readback buffer', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3 });
  const result = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.5,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4
  });

  assert.equal(result.schema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(result.assignmentSchema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA);
  assert.equal(result.status, 'schroeder-level-assignment-submitted');
  assert.equal(result.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(result.fullReadbackPerformed, false);
  assert.equal(result.fullParticleReadbackPerformed, false);
  assert.equal(result.fullParticleReadbackFree, true);
  assert.equal(result.readbackTelemetryComplete, true);
  assert.equal(result.mapAsyncCount, 0);
  assert.equal(result.readbackBytes, 0);
  assert.equal(result.observedHostQueueFenceCount, 1);
  assert.equal(result.hostQueueFenceCount, 1);
  assert.equal(result.deferredCleanupHostQueueFenceCount, 1);
  assert.equal(result.unclassifiedHostQueueFenceCount, 0);
  assert.equal(result.normalHotLoopReadbackFree, false);
  assert.equal(result.productionHotLoopHostDependencyFree, true);
  assert.equal(result.retainedAssignmentBuffer, true);
  assert.ok(result.assignmentBuffer);
  assert.equal(
    webGpuBufferMatchesDevice(result.assignmentBuffer, device),
    true,
    'retained level assignments preserve same-device provenance for strict exact-near consumers'
  );
  assert.equal(result.assignmentBuffer.destroyed, false);
  assert.equal(result.assignmentBufferByteLength, 3 * 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(result.assignments.length, 0);
  assert.equal(device.submitted.length, 1);
  assert.deepEqual(device.dispatches, [[1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederLevelParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
  assert.equal(
    device.queueFenceCalls.length,
    1,
    'standalone level-assignment temporary cleanup retains its queue fence'
  );
});

test('Schroeder level-assignment local temporaries retire after their exact submit without a fence', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3 });
  const result = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.5,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4,
    queueOrderedLocalTemporaryCleanup: true
  });

  assert.deepEqual(device.queueFenceCalls, []);
  assert.equal(result.mapAsyncCount, 0);
  assert.equal(result.readbackBytes, 0);
  assert.equal(result.deferredCleanupHostQueueFenceCount, 0);
  assert.equal(result.productionHotLoopHostDependencyFree, true);
  assert.equal(result.assignmentBuffer.destroyed, false);
});

test('Schroeder level-assignment calls retain one queue-ordered params buffer per device', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3 });
  const first = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    queueOrderedLocalTemporaryCleanup: true
  });
  const second = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    queueOrderedLocalTemporaryCleanup: true
  });

  const params = device.createdBuffers.filter(
    (buffer) => buffer.label === 'ulg-schroeder-level-assignment-params'
  );
  assert.equal(params.length, 1);
  assert.equal(params[0].destroyed, false);
  first.destroyAssignmentBuffer();
  second.destroyAssignmentBuffer();
});

test('Schroeder WebGPU active-node list consumes retained assignments without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3 });
  const storageGeneration = 7;
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: 3,
    storageGeneration,
    stateBuffer: device.createBuffer({
      label: 'spatial-source-state',
      size: buffers.sphParticleState.state.byteLength,
      usage: 128
    }),
    thermoBuffer: device.createBuffer({
      label: 'spatial-source-thermo',
      size: buffers.sphParticleState.thermo.byteLength,
      usage: 128
    })
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: 3,
    storageGeneration,
    mechanicsBuffer: device.createBuffer({
      label: 'spatial-source-mechanics',
      size: buffers.mlsMpmParticleState.mechanics.byteLength,
      usage: 128
    })
  };
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    sphParticleUpload,
    mlsMpmParticleUpload,
    baseGridSpacingM: 0.5,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4
  });
  const activeNodes = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 1
  });

  assert.equal(activeNodes.schema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(activeNodes.activeNodeListSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA);
  assert.equal(activeNodes.status, 'schroeder-active-node-list-submitted');
  assert.equal(activeNodes.sourceAssignmentSchema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(activeNodes.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(activeNodes.fullReadbackPerformed, false);
  assert.equal(activeNodes.fullParticleReadbackPerformed, false);
  assert.equal(activeNodes.fullParticleReadbackFree, true);
  assert.equal(activeNodes.readbackTelemetryComplete, true);
  assert.equal(activeNodes.mapAsyncCount, 0);
  assert.equal(activeNodes.readbackBytes, 0);
  assert.equal(activeNodes.observedHostQueueFenceCount, 1);
  assert.equal(activeNodes.hostQueueFenceCount, 1);
  assert.equal(activeNodes.deferredCleanupHostQueueFenceCount, 1);
  assert.equal(activeNodes.unclassifiedHostQueueFenceCount, 0);
  assert.equal(activeNodes.normalHotLoopReadbackFree, false);
  assert.equal(activeNodes.productionHotLoopHostDependencyFree, true);
  assert.equal(activeNodes.retainedActiveNodeBuffer, true);
  assert.ok(activeNodes.activeNodeBuffer);
  assert.equal(activeNodes.activeNodeBuffer.destroyed, false);
  assert.equal(activeNodes.activeNodeBufferByteLength, 3 * 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(activeNodes.activeNodes.length, 0);
  assert.equal(
    activeNodes.spatialEpochSourceSchema,
    'peercompute.ulg.schroeder-spatial-active-node-source.v1'
  );
  assert.equal(activeNodes.spatialEpochSourceStatus, 'schroeder-spatial-active-node-source-ready');
  assert.equal(activeNodes.spatialEpochSourceReady, true);
  assert.equal(activeNodes.spatialEpochStorageGeneration, storageGeneration);
  assert.equal(activeNodes.spatialEpochLevelSpacingMode, 'base-grid-spacing-times-pow2-level');
  assert.equal(activeNodes.spatialEpochMinLevel, -2);
  assert.equal(activeNodes.spatialEpochMaxLevel, 4);
  assert.equal(activeNodes.spatialEpochBaseGridSpacingM, 0.5);
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederActiveNodeParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
  assert.equal(
    device.queueFenceCalls.length,
    2,
    'standalone assignment and active-node temporary cleanup each retain a queue fence'
  );
});

test('Schroeder active-node local temporaries retire without minting cross-stage authority', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3 });
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.5,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4,
    queueOrderedLocalTemporaryCleanup: true
  });
  const activeNodes = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 1,
    queueOrderedLocalTemporaryCleanup: true
  });

  assert.deepEqual(device.queueFenceCalls, []);
  assert.equal(activeNodes.hostQueueFenceCount, 0);
  assert.equal(activeNodes.deferredCleanupHostQueueFenceCount, 0);
  assert.equal(activeNodes.normalHotLoopReadbackFree, true);
  assert.equal(activeNodes.productionHotLoopHostDependencyFree, true);
  assert.equal(activeNodes.activeNodeBuffer.destroyed, false);
  assert.equal(activeNodes.queueOrderedFinalConsumerCapability, null);
});

test('Schroeder active-node calls retain queue-ordered controls per device', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3 });
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.5,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4,
    queueOrderedLocalTemporaryCleanup: true
  });
  const first = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 1,
    queueOrderedLocalTemporaryCleanup: true
  });
  const second = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 1,
    queueOrderedLocalTemporaryCleanup: true
  });

  for (const label of [
    'ulg-schroeder-active-node-phase-volume-assignment-overlay-disabled',
    'ulg-schroeder-active-node-phase-volume-assignment-overlay-index-disabled',
    'ulg-schroeder-active-node-params'
  ]) {
    assert.equal(
      device.createdBuffers.filter((buffer) => buffer.label === label).length,
      1
    );
  }
  assert.equal(first.activeNodeBuffer.destroyed, false);
  assert.equal(second.activeNodeBuffer.destroyed, false);
  first.destroyActiveNodeBuffer();
  second.destroyActiveNodeBuffer();
});

test('Schroeder active-node final consumer seals prior transfer claims on its existing submit', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3 });
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.5,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4
  });
  const issuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'prior-hierarchy-transfer'
  });
  const producerOutput = {};
  let cleanupCount = 0;
  const cleanup = () => {
    cleanupCount += 1;
  };
  const producerClaim = registerQueueOrderedCleanupClaim(
    issuer,
    device,
    {
      producerOutput,
      cleanup
    }
  );
  const submissionsBefore = device.submitted.length;
  const fencesBefore = device.queueFenceCalls.length;

  const activeNodes = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 1,
    queueOrderedCleanup: true,
    queueOrderedProducerClaims: [producerClaim]
  });

  assert.equal(device.submitted.length, submissionsBefore + 1);
  assert.equal(device.queueFenceCalls.length, fencesBefore);
  assert.equal(activeNodes.observedHostQueueFenceCount, 0);
  assert.equal(activeNodes.hostQueueFenceCount, 0);
  assert.equal(activeNodes.normalHotLoopReadbackFree, true);
  assert.equal(
    Object.prototype.propertyIsEnumerable.call(
      activeNodes,
      'queueOrderedFinalConsumerCapability'
    ),
    false
  );
  const capability = activeNodes.queueOrderedFinalConsumerCapability;
  assert.ok(capability);
  releaseSubmittedWorkCleanupQueueOrdered(
    device,
    cleanup,
    {
      queueOrderedFinalConsumer: capability,
      producerClaim,
      producerOutput,
      producerFamily: 'prior-hierarchy-transfer'
    }
  );
  assert.equal(cleanupCount, 1);
  assert.equal(device.queueFenceCalls.length, fencesBefore);
});

test('Schroeder WebGPU active-node list consumes retained phase-volume assignment overlay', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3 });
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.5,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4
  });
  const phaseVolumeLevelUpdate = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-level-update-submitted',
    migrationRowCount: 3,
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    levelUpdateBuffer: { label: 'retained-phase-volume-level-update-buffer' },
    levelUpdateBufferByteLength: 3 * SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  };
  const activeNodes = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    phaseVolumeLevelUpdate,
    selectedLevel: 1,
    tileCellCount: 4,
    supportInflateCells: 1
  });

  assert.equal(activeNodes.schema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(
    activeNodes.phaseVolumeAssignmentOverlayStatus,
    'schroeder-phase-volume-level-update-assignment-overlay-ready'
  );
  assert.equal(
    activeNodes.phaseVolumeAssignmentOverlayConsumerStatus,
    'phase-volume-level-update-assignment-overlay-consumed-by-active-node-selection'
  );
  assert.equal(activeNodes.phaseVolumeAssignmentOverlayEnabled, true);
  assert.equal(activeNodes.phaseVolumeAssignmentOverlayRowCount, 3);
  assert.equal(activeNodes.phaseVolumeAssignmentOverlayRetainedBuffer, true);
  assert.equal(activeNodes.phaseVolumeLevelSelectionSource, 'state-manager-admitted-phase-volume-level-update');
  assert.equal(activeNodes.phaseVolumeNativeLevelSource, 'phase-volume-level-update-target-level');
  assert.equal(activeNodes.fullParticleReadbackPerformed, false);
  assert.equal(activeNodes.phaseVolumeAssignmentOverlayRawGpuBufferTransferAllowed, false);
  assert.equal(activeNodes.phaseVolumeAssignmentOverlayFullParticleReadbackRequired, false);
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1]]);
  assert.equal(device.bindGroups.at(-1).entries.length, 5);
  assert.equal(device.bindGroups.at(-1).entries[3].resource.buffer, phaseVolumeLevelUpdate.levelUpdateBuffer);
  assert.ok(device.shaderModules.some((module) => module.code.includes('phase_volume_level_updates')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder WebGPU sparse phase-volume overlay index builds and feeds active nodes', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3 });
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.5,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4
  });
  const phaseVolumeLevelUpdate = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-level-update-submitted',
    migrationRowCount: 2,
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    levelUpdateBuffer: { label: 'retained-sparse-phase-volume-level-update-buffer' },
    levelUpdateBufferByteLength: 2 * SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  };
  const overlay = createSchroederPhaseVolumeLevelUpdateAssignmentOverlayPlan({
    phaseVolumeLevelUpdate,
    levelAssignment,
    selectedLevel: 1
  });
  const index = await runSchroederPhaseVolumeAssignmentOverlayIndexWebGpu({
    device,
    phaseVolumeAssignmentOverlay: overlay,
    levelAssignment
  });
  assert.equal(index.schema, ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_EXECUTION_SCHEMA);
  assert.equal(index.phaseVolumeAssignmentOverlayIndexSchema, ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_SCHEMA);
  assert.equal(index.status, 'schroeder-phase-volume-assignment-overlay-index-submitted');
  assert.equal(index.retainedIndexBuffer, true);
  assert.ok(index.indexBuffer);
  assert.equal(index.indexBuffer.destroyed, false);
  assert.equal(index.indexBufferByteLength, 3 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(index.fullParticleReadbackPerformed, false);
  assert.equal(index.indexRows.length, 0);

  const activeNodes = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    phaseVolumeAssignmentOverlay: overlay,
    phaseVolumeAssignmentOverlayIndex: index,
    selectedLevel: 1,
    tileCellCount: 4,
    supportInflateCells: 1
  });
  assert.equal(activeNodes.phaseVolumeAssignmentOverlayAvailable, true);
  assert.equal(activeNodes.phaseVolumeAssignmentOverlayEnabled, true);
  assert.equal(activeNodes.phaseVolumeAssignmentOverlayIndexRequired, true);
  assert.equal(activeNodes.phaseVolumeAssignmentOverlayIndexEnabled, true);
  assert.equal(activeNodes.phaseVolumeAssignmentOverlayIndexStatus, index.status);
  assert.equal(activeNodes.phaseVolumeAssignmentOverlayIndexByteLength, 3 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(
    activeNodes.phaseVolumeAssignmentOverlayConsumerStatus,
    'phase-volume-level-update-assignment-overlay-consumed-by-active-node-selection'
  );
  assert.equal(activeNodes.phaseVolumeLevelSelectionSource, 'state-manager-admitted-phase-volume-level-update');
  assert.equal(device.bindGroups.at(-1).entries.length, 5);
  assert.equal(device.bindGroups.at(-1).entries[4].resource.buffer, index.indexBuffer);
  assert.ok(device.shaderModules.some((module) => module.code.includes('atomicMin')));
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]);
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder WebGPU active-node index builds retained bucket slots without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3 });
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.5,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4
  });
  const activeNodes = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 1
  });
  const index = await runSchroederActiveNodeIndexWebGpu({
    device,
    activeNodeList: activeNodes,
    bucketSlotCapacity: DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY
  });

  assert.equal(index.schema, ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA);
  assert.equal(index.activeNodeIndexSchema, ULG_SCHROEDER_ACTIVE_NODE_INDEX_SCHEMA);
  assert.equal(index.status, 'schroeder-active-node-index-submitted');
  assert.equal(index.sourceActiveNodeSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(index.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(index.fullReadbackPerformed, false);
  assert.equal(index.fullParticleReadbackPerformed, false);
  assert.equal(index.fullParticleReadbackFree, true);
  assert.equal(index.readbackTelemetryComplete, true);
  assert.equal(index.mapAsyncCount, 0);
  assert.equal(index.readbackBytes, 0);
  assert.equal(index.hostQueueFenceCount, 1);
  assert.equal(index.normalHotLoopReadbackFree, false);
  assert.equal(index.retainedIndexBuffers, true);
  assert.ok(index.bucketCountBuffer);
  assert.ok(index.bucketSlotBuffer);
  assert.ok(index.nodeBucketSlotBuffer);
  assert.ok(index.overflowCounterBuffer);
  assert.equal(index.bucketCountBuffer.destroyed, false);
  assert.equal(index.bucketSlotBuffer.destroyed, false);
  assert.equal(index.nodeBucketSlotBuffer.destroyed, false);
  assert.equal(index.overflowCounterBuffer.destroyed, false);
  assert.equal(index.activeNodeCount, 3);
  assert.equal(index.bucketCount, 1);
  assert.equal(index.bucketSlotCapacity, DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY);
  assert.equal(index.bucketSlotCount, DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY);
  assert.equal(index.nodeSlotCount, 3);
  assert.equal(index.bucketCounts.length, 0);
  assert.equal(index.bucketSlots.length, 0);
  assert.equal(index.nodeBucketSlots.length, 0);
  assert.equal(index.overflowCounters.length, 0);
  assert.equal(index.indexStatus, 'bucketed-active-node-index-submitted');
  assert.equal(index.capacityStatus, 'bucket-capacity-provisioned-fail-closed-on-overflow');
  assert.equal(index.indexCoverageStatus, 'tile-min-anchor-index-not-authoritative-overlap-pruning');
  assert.equal(index.stateMutationStatus, 'active-node-index-submitted-no-state-mutation');
  assert.equal(
    index.stateAuthorityStatus,
    'index-buffer-derived-from-active-node-list-no-state-admission-required'
  );
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederActiveNodeIndexParams')));
  assert.ok(device.createdBuffers.some((buffer) => buffer.label === 'ulg-schroeder-active-node-index-bucket-counts'));
  assert.ok(device.createdBuffers.some((buffer) => buffer.label === 'ulg-schroeder-active-node-index-bucket-slots'));
  assert.ok(device.createdBuffers.some((buffer) => buffer.label === 'ulg-schroeder-active-node-index-node-bucket-slots'));
  assert.ok(device.createdBuffers.some((buffer) => buffer.label === 'ulg-schroeder-active-node-index-overflow-counters'));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder active-node index local temporaries retire while retained outputs stay live', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3 });
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.5,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4,
    queueOrderedLocalTemporaryCleanup: true
  });
  const activeNodes = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 1,
    queueOrderedLocalTemporaryCleanup: true
  });
  const index = await runSchroederActiveNodeIndexWebGpu({
    device,
    activeNodeList: activeNodes,
    bucketSlotCapacity: DEFAULT_ACTIVE_NODE_INDEX_BUCKET_SLOT_CAPACITY,
    queueOrderedLocalTemporaryCleanup: true
  });

  assert.deepEqual(device.queueFenceCalls, []);
  assert.equal(index.hostQueueFenceCount, 0);
  assert.equal(index.normalHotLoopReadbackFree, true);
  for (const retained of [
    index.bucketCountBuffer,
    index.bucketSlotBuffer,
    index.nodeBucketSlotBuffer,
    index.overflowCounterBuffer
  ]) {
    assert.equal(retained.destroyed, false);
  }
});

test('Schroeder WebGPU active-node sorted index builds retained radix ranges without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3 });
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.5,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4
  });
  const activeNodes = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 1
  });
  const index = await runSchroederActiveNodeSortedIndexWebGpu({
    device,
    activeNodeList: activeNodes,
    bucketCount: 4
  });

  assert.equal(index.schema, ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA);
  assert.equal(index.activeNodeSortedIndexSchema, ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_SCHEMA);
  assert.equal(index.status, 'schroeder-active-node-sorted-index-submitted');
  assert.equal(index.sourceActiveNodeSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(index.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(index.fullReadbackPerformed, false);
  assert.equal(index.fullParticleReadbackPerformed, false);
  assert.equal(index.fullParticleReadbackFree, true);
  assert.equal(index.readbackTelemetryComplete, true);
  assert.equal(index.mapAsyncCount, 0);
  assert.equal(index.readbackBytes, 0);
  assert.equal(index.hostQueueFenceCount, 1);
  assert.equal(index.normalHotLoopReadbackFree, false);
  assert.equal(index.retainedIndexBuffers, true);
  assert.ok(index.bucketCountBuffer);
  assert.ok(index.bucketRangeOffsetBuffer);
  assert.ok(index.bucketCursorBuffer);
  assert.ok(index.sortedActiveIndexBuffer);
  assert.ok(index.diagnosticCounterBuffer);
  assert.equal(index.bucketCountBuffer.destroyed, false);
  assert.equal(index.bucketRangeOffsetBuffer.destroyed, false);
  assert.equal(index.bucketCursorBuffer.destroyed, false);
  assert.equal(index.sortedActiveIndexBuffer.destroyed, false);
  assert.equal(index.diagnosticCounterBuffer.destroyed, false);
  assert.equal(index.activeNodeCount, 3);
  assert.equal(index.bucketCount, 4);
  assert.equal(index.bucketRangeOffsetCount, 5);
  assert.equal(index.bucketCounts.length, 0);
  assert.equal(index.bucketRangeOffsets.length, 0);
  assert.equal(index.sortedActiveIndices.length, 0);
  assert.equal(index.diagnosticCounters.length, 0);
  assert.equal(index.indexStatus, 'sorted-radix-active-node-index-submitted');
  assert.equal(index.capacityStatus, 'unbounded-per-bucket-range-no-fixed-slot-overflow');
  assert.equal(index.indexCoverageStatus, 'hash-bucket-ranges-require-exact-overlap-validation');
  assert.equal(index.stateMutationStatus, 'active-node-sorted-index-submitted-no-state-mutation');
  assert.equal(
    index.stateAuthorityStatus,
    'index-buffer-derived-from-active-node-list-no-state-admission-required'
  );
  assert.deepEqual(device.dispatches, [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
  ]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederActiveNodeSortedIndexParams')));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-active-node-sorted-index-bucket-range-offsets'
    && buffer.size === 5 * Uint32Array.BYTES_PER_ELEMENT
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-active-node-sorted-index-active-indices'
    && buffer.size === 3 * Uint32Array.BYTES_PER_ELEMENT
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder law queue consumes retained active nodes without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 130,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer: { label: 'retained-active-node-buffer' }
  };
  const lawQueue = await runSchroederLawQueueWebGpu({
    device,
    activeNodeList,
    queueEpoch: 7,
    stateFamilyId: 2
  });

  assert.equal(lawQueue.schema, ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA);
  assert.equal(lawQueue.lawQueueSchema, ULG_SCHROEDER_LAW_QUEUE_SCHEMA);
  assert.equal(lawQueue.status, 'schroeder-law-queue-submitted');
  assert.equal(lawQueue.sourceActiveNodeSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(lawQueue.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(lawQueue.fullReadbackPerformed, false);
  assert.equal(lawQueue.fullParticleReadbackPerformed, false);
  assert.equal(lawQueue.fullParticleReadbackFree, true);
  assert.equal(lawQueue.normalHotLoopReadbackFree, true);
  assertExactZeroReadbackTelemetry(lawQueue);
  assert.equal(lawQueue.retainedLawQueueBuffer, true);
  assert.ok(lawQueue.lawQueueBuffer);
  assert.equal(lawQueue.lawQueueBuffer.destroyed, false);
  assert.equal(lawQueue.lawQueueBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(lawQueue.lawQueueRows.length, 0);
  assert.equal(lawQueue.lawQueueStatus, 'local-law-queues-submitted');
  assert.equal(
    lawQueue.exactNearFieldRequirement,
    'reaction-contact-interface-queues-require-exact-near-field-validation'
  );
  assert.equal(lawQueue.reactionScopeStatus, 'sedenion-scope-preserved-for-reaction-queue');
  assert.equal(lawQueue.stateMutationStatus, 'law-queue-buffer-submitted-no-state-mutation');
  assert.equal(lawQueue.stateAuthorityStatus, 'state-manager-admission-required-before-law-output-mutation');
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederLawQueueParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder law-neighbor candidates consume retained law queues without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const lawQueueBuffer = device.createBuffer({
    label: 'retained-law-queue-buffer',
    size: 3 * SCHROEDER_LAW_QUEUE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const activeNodeBuffer = device.createBuffer({
    label: 'retained-active-node-buffer',
    size: 3 * SCHROEDER_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const stateBuffer = device.createBuffer({
    label: 'retained-state-buffer',
    size: 3 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const lawQueue = {
    schema: ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
    status: 'schroeder-law-queue-submitted',
    activeNodeCount: 3,
    lawQueueStrideFloats: SCHROEDER_LAW_QUEUE_FLOATS,
    lawQueueBuffer,
    enabledLawMask: SCHROEDER_LOCAL_LAW_QUEUE_MASK,
    candidateBudget: 4,
    queueEpoch: 7
  };
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 3,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer
  };
  const candidates = await runSchroederLawNeighborCandidateWebGpu({
    device,
    lawQueue,
    activeNodeList,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      particleCount: 3,
      stateBuffer
    },
    candidateBudget: 4
  });

  assert.equal(candidates.schema, ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA);
  assert.equal(candidates.neighborCandidateSchema, ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA);
  assert.equal(candidates.status, 'schroeder-law-neighbor-candidates-submitted');
  assert.equal(candidates.sourceLawQueueSchema, ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA);
  assert.equal(candidates.sourceActiveNodeSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(candidates.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(candidates.fullReadbackPerformed, false);
  assert.equal(candidates.compactDiagnosticReadbackPerformed, false);
  assert.equal(candidates.fullParticleReadbackPerformed, false);
  assert.equal(candidates.fullParticleReadbackFree, true);
  assert.equal(candidates.normalHotLoopReadbackFree, true);
  assertExactZeroReadbackTelemetry(candidates);
  assert.equal(candidates.particleCount, 3);
  assert.equal(candidates.lawQueueCount, 3);
  assert.equal(candidates.activeNodeCount, 3);
  assert.equal(candidates.candidateBudget, 4);
  assert.equal(candidates.neighborCandidateCount, 12);
  assert.equal(candidates.sourceCandidateSpanCount, 3);
  assert.equal(candidates.activeNodeIndexEnabled, false);
  assert.equal(candidates.activeNodeIndexConsumerStatus, 'active-node-index-disabled-full-active-node-scan');
  assert.equal(candidates.retainedNeighborCandidateBuffer, true);
  assert.equal(candidates.retainedSourceCandidateSpanBuffer, true);
  assert.equal(candidates.retainedDiagnosticCounterBuffer, true);
  assert.ok(candidates.neighborCandidateBuffer);
  assert.ok(candidates.sourceCandidateSpanBuffer);
  assert.ok(candidates.diagnosticCounterBuffer);
  assert.equal(candidates.neighborCandidateBuffer.destroyed, false);
  assert.equal(candidates.sourceCandidateSpanBuffer.destroyed, false);
  assert.equal(candidates.diagnosticCounterBuffer.destroyed, false);
  assert.equal(candidates.neighborCandidateBufferByteLength, 12 * 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(candidates.sourceCandidateSpanBufferByteLength, 3 * 4 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(
    candidates.diagnosticCounterBufferByteLength,
    SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT * Uint32Array.BYTES_PER_ELEMENT
  );
  assert.equal(candidates.neighborCandidateRows.length, 0);
  assert.equal(candidates.sourceCandidateSpanRows.length, 0);
  assert.equal(candidates.diagnosticCounters.length, 0);
  assert.equal(candidates.traversalDiagnosticStatus, 'law-neighbor-traversal-diagnostic-counters-submitted');
  assert.equal(candidates.traversalPolicyStatus, 'traversal-policy-pending-compact-diagnostic-counters');
  assert.equal(candidates.traversalPolicyMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_AUTO_MODE);
  assert.equal(candidates.appliedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE);
  assert.equal(candidates.recommendedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE);
  assert.equal(candidates.selectedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_EXACT_SCAN_MODE);
  assert.equal(candidates.sortedRadixIndexRequired, false);
  assert.equal(candidates.sortedRadixIndexStatus, 'sorted-radix-active-node-index-not-required');
  assert.equal(candidates.diagnosticCountersAvailable, false);
  assert.equal(candidates.diagnosticReadbackRecommended, true);
  assert.equal(candidates.traversalPolicy.fullParticleReadbackRequired, false);
  assert.equal(candidates.neighborCandidateStatus, 'local-law-neighbor-candidates-submitted');
  assert.equal(candidates.sourceCandidateSpanStatus, 'local-law-neighbor-source-spans-submitted');
  assert.equal(candidates.pressureInterfaceSpatialIndexStatus, 'pressure-interface-source-span-spatial-index-submitted');
  assert.equal(candidates.pressureInterfaceSpatialIndexMode, 'source-particle-candidate-span-table');
  assert.equal(
    candidates.pressureInterfaceSpatialIndexConsumerStatus,
    'available-for-pressure-interface-contact-kinematics-source-span-binding'
  );
  assert.equal(
    candidates.pressureInterfaceSpatialIndexFallbackPolicy,
    'no-implicit-full-candidate-scan-without-source-span-descriptor'
  );
  assert.equal(candidates.stateMutationStatus, 'law-neighbor-candidates-buffer-submitted-no-state-mutation');
  assert.equal(
    candidates.stateAuthorityStatus,
    'state-manager-admission-required-before-law-neighbor-output-mutation'
  );
  assert.equal(candidates.enumerationMode, 'schroeder-active-node-tile-traversal-neighbor-enumeration');
  assert.equal(candidates.treeTraversalStatus, 'active-node-tile-traversal-before-sorted-schroeder-tree-index');
  assert.equal(candidates.candidateIndexingMode, 'particle-source-candidate-span-table');
  assert.deepEqual(device.dispatches, [[1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederLawNeighborParams')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('active_nodes')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('active_node_index_bucket_slots')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('source_candidate_span_rows')));
  assert.equal(device.bindGroups.at(-1).entries.length, 10);
  assert.equal(device.bindGroups.at(-1).entries[1].resource.buffer, activeNodeBuffer);
  assert.equal(device.bindGroups.at(-1).entries[4].resource.buffer, candidates.sourceCandidateSpanBuffer);
  assert.equal(device.bindGroups.at(-1).entries[6].resource.buffer.label, 'ulg-schroeder-law-neighbor-active-node-index-slots-dummy');
  assert.equal(device.bindGroups.at(-1).entries[7].resource.buffer, candidates.diagnosticCounterBuffer);
  assert.equal(
    device.bindGroups.at(-1).entries[8].resource.buffer.label,
    'ulg-schroeder-law-neighbor-active-node-sorted-index-range-offsets-dummy'
  );
  assert.equal(
    device.bindGroups.at(-1).entries[9].resource.buffer.label,
    'ulg-schroeder-law-neighbor-active-node-sorted-index-active-indices-dummy'
  );
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-law-neighbor-candidates-params'
    && write.byteLength === 80
  )));
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-law-neighbor-diagnostic-counters'
    && write.byteLength === SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT * Uint32Array.BYTES_PER_ELEMENT
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-law-neighbor-candidates-params'
    && buffer.size === 80
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-law-neighbor-diagnostic-counters'
    && buffer.size === SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT * Uint32Array.BYTES_PER_ELEMENT
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder law-neighbor candidates consume retained active-node bucket index slots', async () => {
  const device = createFakeWebGpuDevice();
  const lawQueueBuffer = device.createBuffer({
    label: 'retained-law-queue-buffer',
    size: 3 * SCHROEDER_LAW_QUEUE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const activeNodeBuffer = device.createBuffer({
    label: 'retained-active-node-buffer',
    size: 3 * SCHROEDER_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const activeNodeIndexBucketSlotBuffer = device.createBuffer({
    label: 'retained-active-node-index-bucket-slots',
    size: 8 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const stateBuffer = device.createBuffer({
    label: 'retained-state-buffer',
    size: 3 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const lawQueue = {
    schema: ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
    status: 'schroeder-law-queue-submitted',
    activeNodeCount: 3,
    lawQueueStrideFloats: SCHROEDER_LAW_QUEUE_FLOATS,
    lawQueueBuffer,
    enabledLawMask: SCHROEDER_LOCAL_LAW_QUEUE_MASK,
    candidateBudget: 4,
    queueEpoch: 7
  };
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 3,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer
  };
  const activeNodeIndex = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-index-submitted',
    activeNodeCount: 3,
    bucketCount: 2,
    bucketSlotCapacity: 4,
    bucketSlotCount: 8,
    bucketSlotBuffer: activeNodeIndexBucketSlotBuffer
  };
  const candidates = await runSchroederLawNeighborCandidateWebGpu({
    device,
    lawQueue,
    activeNodeList,
    activeNodeIndex,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      particleCount: 3,
      stateBuffer
    },
    candidateBudget: 4
  });

  assert.equal(candidates.activeNodeIndexEnabled, true);
  assert.equal(candidates.sourceActiveNodeIndexSchema, ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA);
  assert.equal(candidates.sourceActiveNodeIndexStatus, 'schroeder-active-node-index-submitted');
  assert.equal(candidates.activeNodeIndexBucketCount, 2);
  assert.equal(candidates.activeNodeIndexBucketSlotCapacity, 4);
  assert.equal(candidates.activeNodeIndexBucketSlotCount, 8);
  assert.equal(candidates.enumerationMode, 'schroeder-active-node-indexed-tile-traversal-neighbor-enumeration');
  assert.equal(candidates.treeTraversalStatus, 'active-node-bucket-index-traversal-with-exact-scan-fallback');
  assert.equal(
    candidates.activeNodeIndexConsumerStatus,
    'active-node-bucket-index-consumed-with-exact-scan-fallback'
  );
  assert.equal(candidates.traversalPolicyStatus, 'traversal-policy-pending-compact-diagnostic-counters');
  assert.equal(candidates.appliedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(candidates.recommendedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(candidates.selectedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(candidates.retainedDiagnosticCounterBuffer, true);
  assert.equal(device.bindGroups.at(-1).entries.length, 10);
  assert.equal(device.bindGroups.at(-1).entries[6].resource.buffer, activeNodeIndexBucketSlotBuffer);
  assert.equal(device.bindGroups.at(-1).entries[7].resource.buffer, candidates.diagnosticCounterBuffer);
  assert.equal(
    device.bindGroups.at(-1).entries[8].resource.buffer.label,
    'ulg-schroeder-law-neighbor-active-node-sorted-index-range-offsets-dummy'
  );
  assert.equal(
    device.bindGroups.at(-1).entries[9].resource.buffer.label,
    'ulg-schroeder-law-neighbor-active-node-sorted-index-active-indices-dummy'
  );
  assert.equal(activeNodeIndexBucketSlotBuffer.destroyed, false);
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-law-neighbor-candidates-params'
    && write.byteLength === 80
  )));
});

test('Schroeder law-neighbor candidates consume retained sorted active-node ranges', async () => {
  const device = createFakeWebGpuDevice();
  const lawQueueBuffer = device.createBuffer({
    label: 'retained-law-queue-buffer',
    size: 3 * SCHROEDER_LAW_QUEUE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const activeNodeBuffer = device.createBuffer({
    label: 'retained-active-node-buffer',
    size: 3 * SCHROEDER_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const sortedRangeOffsetBuffer = device.createBuffer({
    label: 'retained-sorted-active-node-range-offsets',
    size: 5 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const sortedActiveIndexBuffer = device.createBuffer({
    label: 'retained-sorted-active-node-indices',
    size: 3 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const stateBuffer = device.createBuffer({
    label: 'retained-state-buffer',
    size: 3 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const lawQueue = {
    schema: ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
    status: 'schroeder-law-queue-submitted',
    activeNodeCount: 3,
    lawQueueStrideFloats: SCHROEDER_LAW_QUEUE_FLOATS,
    lawQueueBuffer,
    enabledLawMask: SCHROEDER_LOCAL_LAW_QUEUE_MASK,
    candidateBudget: 4,
    queueEpoch: 7
  };
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 3,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer
  };
  const activeNodeSortedIndex = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-sorted-index-submitted',
    activeNodeCount: 3,
    bucketCount: 4,
    bucketRangeOffsetCount: 5,
    bucketRangeOffsetBuffer: sortedRangeOffsetBuffer,
    sortedActiveIndexBuffer
  };
  const candidates = await runSchroederLawNeighborCandidateWebGpu({
    device,
    lawQueue,
    activeNodeList,
    activeNodeSortedIndex,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      particleCount: 3,
      stateBuffer
    },
    candidateBudget: 4,
    traversalPolicyMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE
  });

  assert.equal(candidates.activeNodeSortedIndexEnabled, true);
  assert.equal(
    candidates.sourceActiveNodeSortedIndexSchema,
    ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA
  );
  assert.equal(candidates.sourceActiveNodeSortedIndexStatus, 'schroeder-active-node-sorted-index-submitted');
  assert.equal(candidates.activeNodeSortedIndexBucketCount, 4);
  assert.equal(candidates.activeNodeSortedIndexBucketRangeOffsetCount, 5);
  assert.equal(
    candidates.enumerationMode,
    'schroeder-active-node-sorted-radix-range-traversal-neighbor-enumeration'
  );
  assert.equal(candidates.treeTraversalStatus, 'active-node-sorted-radix-range-traversal-with-exact-scan-fallback');
  assert.equal(
    candidates.activeNodeIndexConsumerStatus,
    'active-node-sorted-radix-index-consumed-with-exact-scan-fallback'
  );
  assert.equal(candidates.traversalPolicyStatus, 'traversal-policy-forced-sorted-radix-index');
  assert.equal(candidates.appliedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE);
  assert.equal(candidates.recommendedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE);
  assert.equal(candidates.selectedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE);
  assert.equal(candidates.sortedRadixIndexRequired, true);
  assert.equal(candidates.sortedRadixIndexStatus, 'sorted-radix-active-node-index-selected');
  assert.equal(device.bindGroups.at(-1).entries.length, 10);
  assert.equal(device.bindGroups.at(-1).entries[8].resource.buffer, sortedRangeOffsetBuffer);
  assert.equal(device.bindGroups.at(-1).entries[9].resource.buffer, sortedActiveIndexBuffer);
  assert.equal(sortedRangeOffsetBuffer.destroyed, false);
  assert.equal(sortedActiveIndexBuffer.destroyed, false);
  assert.ok(device.shaderModules.some((module) => module.code.includes('active_node_sorted_bucket_range_offsets')));
});

test('Schroeder law-neighbor candidates can read compact traversal diagnostics only', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const lawQueueBuffer = device.createBuffer({
    label: 'retained-law-queue-buffer',
    size: 3 * SCHROEDER_LAW_QUEUE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const activeNodeBuffer = device.createBuffer({
    label: 'retained-active-node-buffer',
    size: 3 * SCHROEDER_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const stateBuffer = device.createBuffer({
    label: 'retained-state-buffer',
    size: 3 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const lawQueue = {
    schema: ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
    status: 'schroeder-law-queue-submitted',
    activeNodeCount: 3,
    lawQueueStrideFloats: SCHROEDER_LAW_QUEUE_FLOATS,
    lawQueueBuffer,
    enabledLawMask: SCHROEDER_LOCAL_LAW_QUEUE_MASK,
    candidateBudget: 4,
    queueEpoch: 7
  };
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 3,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer
  };
  const candidates = await runSchroederLawNeighborCandidateWebGpu({
    device,
    lawQueue,
    activeNodeList,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      particleCount: 3,
      stateBuffer
    },
    candidateBudget: 4,
    readbackMode: SCHROEDER_COMPACT_LAW_NEIGHBOR_DIAGNOSTIC_READBACK_MODE
  });

  assert.equal(candidates.readbackMode, SCHROEDER_COMPACT_LAW_NEIGHBOR_DIAGNOSTIC_READBACK_MODE);
  assert.equal(candidates.fullReadbackPerformed, false);
  assert.equal(candidates.compactDiagnosticReadbackPerformed, true);
  assert.equal(candidates.fullParticleReadbackPerformed, false);
  assert.equal(candidates.normalHotLoopReadbackFree, false);
  assert.equal(candidates.neighborCandidateRows.length, 0);
  assert.equal(candidates.sourceCandidateSpanRows.length, 0);
  assert.equal(candidates.diagnosticCounters.length, SCHROEDER_LAW_NEIGHBOR_DIAGNOSTIC_COUNTER_COUNT);
  assert.equal(candidates.traversalPolicyStatus, 'traversal-policy-auto-within-diagnostic-thresholds');
  assert.equal(candidates.diagnosticCountersAvailable, true);
  assert.equal(candidates.diagnosticReadbackRecommended, false);
  assert.equal(candidates.sortedRadixIndexRequired, false);
  assert.ok(device.createdBuffers.some((buffer) => buffer.label === 'ulg-schroeder-law-neighbor-diagnostic-counters-readback'));
  assert.equal(
    device.createdBuffers.some((buffer) => buffer.label === 'ulg-schroeder-law-neighbor-candidates-readback'),
    false
  );
  assert.equal(
    device.createdBuffers.some((buffer) => buffer.label === 'ulg-schroeder-law-neighbor-source-spans-readback'),
    false
  );
});

test('Schroeder WebGPU cross-level coupling consumes retained hierarchy buffers without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.25,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4
  });
  const activeNodes = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 1
  });
  const crossLevel = await runSchroederCrossLevelCouplingWebGpu({
    device,
    levelAssignment,
    activeNodeList: activeNodes,
    parentLevelDelta: 1,
    couplingHaloCells: 2
  });

  assert.equal(crossLevel.schema, ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA);
  assert.equal(crossLevel.crossLevelCouplingSchema, ULG_SCHROEDER_CROSS_LEVEL_COUPLING_SCHEMA);
  assert.equal(crossLevel.status, 'schroeder-cross-level-coupling-submitted');
  assert.equal(crossLevel.sourceAssignmentSchema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(crossLevel.sourceActiveNodeSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(crossLevel.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(crossLevel.fullReadbackPerformed, false);
  assert.equal(crossLevel.fullParticleReadbackPerformed, false);
  assert.equal(crossLevel.fullParticleReadbackFree, true);
  assert.equal(crossLevel.normalHotLoopReadbackFree, true);
  assertExactZeroReadbackTelemetry(crossLevel);
  assert.equal(crossLevel.retainedCrossLevelBuffer, true);
  assert.ok(crossLevel.crossLevelBuffer);
  assert.equal(crossLevel.crossLevelBuffer.destroyed, false);
  assert.equal(crossLevel.crossLevelBufferByteLength, 3 * 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(crossLevel.crossLevelCouplings.length, 0);
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1], [1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederCrossLevelParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder conservation summary consumes retained cross-level buffers without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 130, smoothingLengthM: 0.25 });
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.25,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4
  });
  const activeNodes = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 1
  });
  const crossLevel = await runSchroederCrossLevelCouplingWebGpu({
    device,
    levelAssignment,
    activeNodeList: activeNodes,
    parentLevelDelta: 1,
    couplingHaloCells: 2
  });
  const summary = await runSchroederConservationSummaryWebGpu({
    device,
    crossLevelCoupling: crossLevel
  });

  assert.equal(summary.schema, ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA);
  assert.equal(summary.conservationSummarySchema, ULG_SCHROEDER_CONSERVATION_SUMMARY_SCHEMA);
  assert.equal(summary.status, 'schroeder-conservation-summary-submitted');
  assert.equal(summary.sourceCrossLevelSchema, ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA);
  assert.equal(summary.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(summary.fullReadbackPerformed, false);
  assert.equal(summary.fullParticleReadbackPerformed, false);
  assert.equal(summary.fullParticleReadbackFree, true);
  assert.equal(summary.normalHotLoopReadbackFree, true);
  assertExactZeroReadbackTelemetry(summary);
  assert.equal(summary.retainedSummaryBuffer, true);
  assert.ok(summary.summaryBuffer);
  assert.equal(summary.summaryBuffer.destroyed, false);
  assert.equal(summary.summaryRowCount, 3);
  assert.equal(summary.summaryBufferByteLength, 3 * 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(summary.summaryRows.length, 0);
  assert.equal(summary.residualCounterStatus, 'workgroup-partial-summary-gpu-resident');
  assert.equal(summary.conservativeTransferStatus, 'summary-only-no-state-mutation');
  assert.deepEqual(device.dispatches, [[3, 1, 1], [3, 1, 1], [3, 1, 1], [3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederConservationSummaryParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder cross-level transfer consumes retained candidates and particle state without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 130, smoothingLengthM: 0.25 });
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.25,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4
  });
  const activeNodes = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 1
  });
  const crossLevel = await runSchroederCrossLevelCouplingWebGpu({
    device,
    levelAssignment,
    activeNodeList: activeNodes,
    parentLevelDelta: 1,
    couplingHaloCells: 2
  });
  const transfer = await runSchroederCrossLevelTransferWebGpu({
    device,
    ...buffers,
    crossLevelCoupling: crossLevel
  });

  assert.equal(transfer.schema, ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA);
  assert.equal(transfer.crossLevelTransferSchema, ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_SCHEMA);
  assert.equal(transfer.status, 'schroeder-cross-level-transfer-submitted');
  assert.equal(transfer.sourceCrossLevelSchema, ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA);
  assert.equal(transfer.sourceParticleSchema, ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA);
  assert.equal(transfer.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(transfer.fullReadbackPerformed, false);
  assert.equal(transfer.fullParticleReadbackPerformed, false);
  assert.equal(transfer.fullParticleReadbackFree, true);
  assert.equal(transfer.normalHotLoopReadbackFree, true);
  assertExactZeroReadbackTelemetry(transfer);
  assert.equal(transfer.retainedTransferBuffer, true);
  assert.ok(transfer.transferBuffer);
  assert.equal(transfer.transferBuffer.destroyed, false);
  assert.equal(transfer.transferBufferByteLength, 130 * 24 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(transfer.transferRows.length, 0);
  assert.equal(transfer.conservativeTransferStatus, 'transfer-rows-ready-no-state-mutation');
  assert.equal(transfer.stateMutationStatus, 'not-applied-transfer-rows-only');
  assert.deepEqual(
    device.dispatches,
    [[3, 1, 1], [3, 1, 1], [3, 1, 1], [3, 1, 1]]
  );
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederCrossLevelTransferParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder cross-level state delta consumes retained transfer rows without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 130, smoothingLengthM: 0.25 });
  const levelAssignment = await runSchroederLevelAssignmentWebGpu({
    device,
    ...buffers,
    baseGridSpacingM: 0.25,
    targetSupportCells: 1,
    minLevel: -2,
    maxLevel: 4
  });
  const activeNodes = await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment,
    tileCellCount: 4,
    supportInflateCells: 1
  });
  const crossLevel = await runSchroederCrossLevelCouplingWebGpu({
    device,
    levelAssignment,
    activeNodeList: activeNodes,
    parentLevelDelta: 1,
    couplingHaloCells: 2
  });
  const transfer = await runSchroederCrossLevelTransferWebGpu({
    device,
    ...buffers,
    crossLevelCoupling: crossLevel
  });
  const stateDelta = await runSchroederCrossLevelStateDeltaWebGpu({
    device,
    crossLevelTransfer: transfer
  });

  assert.equal(stateDelta.schema, ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA);
  assert.equal(stateDelta.stateDeltaSchema, ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_SCHEMA);
  assert.equal(stateDelta.status, 'schroeder-cross-level-state-delta-submitted');
  assert.equal(stateDelta.sourceTransferSchema, ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA);
  assert.equal(stateDelta.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(stateDelta.fullReadbackPerformed, false);
  assert.equal(stateDelta.fullParticleReadbackPerformed, false);
  assert.equal(stateDelta.fullParticleReadbackFree, true);
  assert.equal(stateDelta.normalHotLoopReadbackFree, true);
  assertExactZeroReadbackTelemetry(stateDelta);
  assert.equal(stateDelta.retainedStateDeltaBuffer, true);
  assert.ok(stateDelta.stateDeltaBuffer);
  assert.equal(stateDelta.stateDeltaBuffer.destroyed, false);
  assert.equal(stateDelta.stateDeltaBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(stateDelta.stateDeltaRows.length, 0);
  assert.equal(stateDelta.conservativeTransferStatus, 'state-delta-ready-pending-admission');
  assert.equal(stateDelta.stateMutationStatus, 'pending-state-delta-submitted-awaiting-admission');
  assert.equal(stateDelta.stateAuthorityStatus, 'requires-state-manager-admission-before-authoritative-merge');
  assert.deepEqual(
    device.dispatches,
    [[3, 1, 1], [3, 1, 1], [3, 1, 1], [3, 1, 1], [3, 1, 1]]
  );
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederCrossLevelStateDeltaParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder cross-level state-delta merge blocks without admission and dispatches no work', async () => {
  const device = createFakeWebGpuDevice();
  const crossLevelStateDelta = {
    schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA,
    status: 'schroeder-cross-level-state-delta-submitted',
    crossLevelCandidateCount: 130,
    stateDeltaStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
    stateDeltaBuffer: { label: 'retained-state-delta-buffer' }
  };
  const merge = await runSchroederCrossLevelStateDeltaMergeWebGpu({
    device,
    crossLevelStateDelta
  });

  assert.equal(merge.schema, ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA);
  assert.equal(merge.stateDeltaMergeSchema, ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_SCHEMA);
  assert.equal(merge.status, 'schroeder-cross-level-state-delta-merge-blocked-admission-required');
  assert.equal(merge.stateDeltaMergeAdmissionApproved, false);
  assert.equal(merge.retainedMergedStateDeltaBuffer, false);
  assert.equal(merge.mergedStateDeltaBufferByteLength, 0);
  assert.equal(merge.conservativeTransferStatus, 'state-delta-merge-blocked-admission-required');
  assert.equal(merge.stateMutationStatus, 'blocked-state-delta-merge-admission-required');
  assert.equal(device.dispatches.length, 0);
  assert.equal(device.submitted.length, 0);
});

test('Schroeder cross-level state-delta merge consumes retained deltas after admission without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const crossLevelStateDelta = {
    schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA,
    status: 'schroeder-cross-level-state-delta-submitted',
    crossLevelCandidateCount: 130,
    stateDeltaStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
    stateDeltaBuffer: { label: 'retained-state-delta-buffer' }
  };
  const merge = await runSchroederCrossLevelStateDeltaMergeWebGpu({
    device,
    crossLevelStateDelta,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 130 }),
    mergeEpoch: 7
  });

  assert.equal(merge.schema, ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA);
  assert.equal(merge.stateDeltaMergeSchema, ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_SCHEMA);
  assert.equal(merge.status, 'schroeder-cross-level-state-delta-merge-submitted');
  assert.equal(merge.stateDeltaMergeAdmissionApproved, true);
  assert.equal(merge.stateDeltaMergeAdmissionStatus, 'schroeder-state-delta-merge-admission-approved');
  assert.equal(merge.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(merge.fullReadbackPerformed, false);
  assert.equal(merge.fullParticleReadbackPerformed, false);
  assert.equal(merge.normalHotLoopReadbackFree, true);
  assert.equal(merge.retainedMergedStateDeltaBuffer, true);
  assert.ok(merge.mergedStateDeltaBuffer);
  assert.equal(merge.mergedStateDeltaBuffer.destroyed, false);
  assert.equal(merge.mergedStateDeltaBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(merge.mergedStateDeltaRows.length, 0);
  assert.equal(merge.conservativeTransferStatus, 'state-delta-merge-submitted');
  assert.equal(merge.stateMutationStatus, 'admitted-state-delta-merge-buffer-submitted');
  assert.equal(merge.stateAuthorityStatus, 'state-manager-admitted-retained-merge-buffer');
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederCrossLevelStateDeltaMergeParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder hierarchy aggregate materializes retained admitted merge rows without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const crossLevelStateDeltaMerge = {
    schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA,
    status: 'schroeder-cross-level-state-delta-merge-submitted',
    crossLevelCandidateCount: 130,
    mergeStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS,
    mergedStateDeltaBuffer: { label: 'retained-merged-state-delta-buffer' }
  };
  const aggregate = await runSchroederHierarchyAggregateWebGpu({
    device,
    crossLevelStateDeltaMerge
  });

  assert.equal(aggregate.schema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA);
  assert.equal(aggregate.hierarchyAggregateSchema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA);
  assert.equal(aggregate.status, 'schroeder-hierarchy-aggregate-submitted');
  assert.equal(aggregate.sourceStateDeltaMergeSchema, ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA);
  assert.equal(aggregate.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(aggregate.fullReadbackPerformed, false);
  assert.equal(aggregate.fullParticleReadbackPerformed, false);
  assert.equal(aggregate.normalHotLoopReadbackFree, true);
  assert.equal(aggregate.retainedAggregateBuffer, true);
  assert.ok(aggregate.aggregateBuffer);
  assert.equal(aggregate.aggregateBuffer.destroyed, false);
  assert.equal(aggregate.aggregateBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(aggregate.aggregateRows.length, 0);
  assert.equal(aggregate.outputCompaction, 'unsorted-one-aggregate-contribution-row-per-admitted-merge-row');
  assert.equal(aggregate.aggregateReductionStatus, 'pending-keyed-reduction');
  assert.equal(aggregate.conservativeTransferStatus, 'hierarchy-aggregate-contributions-submitted');
  assert.equal(aggregate.stateMutationStatus, 'aggregate-contribution-buffer-submitted');
  assert.equal(aggregate.stateAuthorityStatus, 'state-manager-admitted-merge-buffer-materialized');
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederHierarchyAggregateParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder phase-volume target aggregate materializes retained assignment target rows without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const identityBuffer = { label: 'retained-particle-identity-buffer' };
  const levelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-level-assignment-submitted',
    particleCount: 130,
    minLevel: -4,
    maxLevel: 8,
    baseGridSpacingM: 0.25,
    targetSupportCells: 1.5,
    supportRadiusScale: 1,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    assignmentBuffer: { label: 'retained-level-assignment-buffer' }
  };
  const aggregate = await runSchroederPhaseVolumeTargetAggregateWebGpu({
    device,
    levelAssignment,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      identityRequired: true,
      identityBuffer
    },
    phaseVolumeExpandThreshold: 64,
    gasPhaseId: 3,
    aggregateEpoch: 11
  });

  assert.equal(aggregate.schema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA);
  assert.equal(aggregate.hierarchyAggregateSchema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA);
  assert.equal(aggregate.status, 'schroeder-phase-volume-target-aggregate-submitted');
  assert.equal(aggregate.sourceAssignmentSchema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(aggregate.aggregateSourceMode, 'phase-volume-target-level-assignment');
  assert.equal(aggregate.identityRequired, true);
  assert.equal(aggregate.aggregateIdentityKeyMode, 'exact-render-domain-id');
  assert.equal(aggregate.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(aggregate.fullReadbackPerformed, false);
  assert.equal(aggregate.fullParticleReadbackPerformed, false);
  assert.equal(aggregate.fullParticleReadbackFree, true);
  assert.equal(aggregate.readbackTelemetryComplete, true);
  assert.equal(aggregate.mapAsyncCount, 0);
  assert.equal(aggregate.readbackBytes, 0);
  assert.equal(aggregate.hostQueueFenceCount, 1);
  assert.equal(aggregate.normalHotLoopReadbackFree, false);
  assert.equal(aggregate.retainedAggregateBuffer, true);
  assert.ok(aggregate.aggregateBuffer);
  assert.equal(aggregate.aggregateBuffer.destroyed, false);
  assert.equal(aggregate.aggregateBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(aggregate.aggregateRows.length, 0);
  assert.equal(aggregate.outputCompaction, 'one-phase-volume-target-aggregate-contribution-row-per-assignment-row');
  assert.equal(aggregate.aggregateReductionStatus, 'pending-keyed-reduction');
  assert.equal(aggregate.conservativeTransferStatus, 'phase-volume-target-aggregate-contributions-submitted');
  assert.equal(aggregate.stateMutationStatus, 'phase-volume-target-aggregate-contribution-buffer-submitted');
  assert.equal(aggregate.stateAuthorityStatus, 'derived-from-current-level-assignment-no-authoritative-state-mutation');
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederPhaseVolumeTargetAggregateParams')));
  assert.equal(
    device.bindGroups.at(-1).entries.find((entry) => entry.binding === 5).resource.buffer,
    identityBuffer
  );
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder hierarchy aggregate-node reduction consumes retained aggregate contributions without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const hierarchyAggregate = {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA,
    status: 'schroeder-hierarchy-aggregate-submitted',
    aggregateRowCount: 130,
    aggregateStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
    aggregateBuffer: { label: 'retained-hierarchy-aggregate-buffer' }
  };
  const aggregateNode = await runSchroederHierarchyAggregateNodeReductionWebGpu({
    device,
    hierarchyAggregate
  });

  assert.equal(aggregateNode.schema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA);
  assert.equal(aggregateNode.hierarchyAggregateNodeSchema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA);
  assert.equal(aggregateNode.status, 'schroeder-hierarchy-aggregate-node-reduction-submitted');
  assert.equal(aggregateNode.sourceHierarchyAggregateSchema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA);
  assert.equal(aggregateNode.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(aggregateNode.fullReadbackPerformed, false);
  assert.equal(aggregateNode.fullParticleReadbackPerformed, false);
  assert.equal(aggregateNode.fullParticleReadbackFree, true);
  assert.equal(aggregateNode.readbackTelemetryComplete, true);
  assert.equal(aggregateNode.mapAsyncCount, 0);
  assert.equal(aggregateNode.readbackBytes, 0);
  assert.equal(aggregateNode.hostQueueFenceCount, 1);
  assert.equal(aggregateNode.normalHotLoopReadbackFree, false);
  assert.equal(aggregateNode.retainedAggregateNodeBuffer, true);
  assert.ok(aggregateNode.aggregateNodeBuffer);
  assert.equal(aggregateNode.aggregateNodeBuffer.destroyed, false);
  assert.equal(aggregateNode.aggregateNodeBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(aggregateNode.aggregateNodeRows.length, 0);
  assert.equal(aggregateNode.outputCompaction, 'one-row-per-contribution-first-occurrence-nodes-active-duplicates-suppressed');
  assert.equal(aggregateNode.aggregateReductionStatus, 'exact-first-occurrence-global-scan');
  assert.equal(aggregateNode.aggregateReductionMode, 'gpu-exact-global-scan-o-n2');
  assert.equal(aggregateNode.conservativeTransferStatus, 'hierarchy-aggregate-nodes-submitted');
  assert.equal(aggregateNode.stateMutationStatus, 'aggregate-node-buffer-submitted');
  assert.equal(aggregateNode.stateAuthorityStatus, 'state-manager-admitted-aggregate-nodes-materialized');
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederHierarchyAggregateNodeReduceParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder hierarchy aggregate-node bucket reduction keeps large reductions GPU-resident', async () => {
  const device = createFakeWebGpuDevice();
  const aggregateRowCount = DEFAULT_AGGREGATE_NODE_BUCKET_REDUCTION_MIN_ROWS * 2;
  const hierarchyAggregate = {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA,
    status: 'schroeder-hierarchy-aggregate-submitted',
    aggregateRowCount,
    aggregateStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
    aggregateBuffer: { label: 'retained-large-hierarchy-aggregate-buffer' }
  };
  const aggregateNode = await runSchroederHierarchyAggregateNodeReductionWebGpu({
    device,
    hierarchyAggregate
  });

  assert.equal(aggregateNode.schema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA);
  assert.equal(aggregateNode.status, 'schroeder-hierarchy-aggregate-node-reduction-submitted');
  assert.equal(aggregateNode.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(aggregateNode.fullReadbackPerformed, false);
  assert.equal(aggregateNode.fullParticleReadbackPerformed, false);
  assert.equal(aggregateNode.hostQueueFenceCount, 1);
  assert.equal(aggregateNode.normalHotLoopReadbackFree, false);
  assert.equal(aggregateNode.retainedAggregateNodeBuffer, true);
  assert.equal(aggregateNode.aggregateReductionStatus, 'bucketed-bounded-slot-reduction-submitted');
  assert.equal(aggregateNode.aggregateReductionMode, SCHROEDER_BUCKETED_HIERARCHY_AGGREGATE_NODE_REDUCTION_MODE);
  assert.equal(aggregateNode.capacityStatus, 'bucket-capacity-provisioned-fail-closed-on-overflow');
  assert.equal(aggregateNode.bucketSlotCapacity, DEFAULT_AGGREGATE_NODE_BUCKET_SLOT_CAPACITY);
  assert.ok(aggregateNode.bucketCount > 0);
  assert.ok(aggregateNode.bucketSlotCount >= aggregateRowCount);
  assert.equal(aggregateNode.aggregateNodeRows.length, 0);
  assert.deepEqual(device.dispatches, [
    [Math.ceil(aggregateNode.bucketSlotCount / 64), 1, 1],
    [Math.ceil(aggregateRowCount / 64), 1, 1],
    [Math.ceil(aggregateRowCount / 64), 1, 1]
  ]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederHierarchyAggregateNodeBucketReduceParams')));
  assert.ok(device.createdBuffers.some((buffer) => buffer.label === 'ulg-schroeder-hierarchy-aggregate-node-bucket-counts'));
  assert.ok(device.createdBuffers.some((buffer) => buffer.label === 'ulg-schroeder-hierarchy-aggregate-node-bucket-slots'));
  assert.ok(device.createdBuffers.some((buffer) => buffer.label === 'ulg-schroeder-hierarchy-aggregate-node-row-bucket-slots'));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder far-aggregate candidates consume retained active and aggregate nodes without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const activeNodeBuffer = device.createBuffer({
    label: 'retained-active-node-buffer',
    size: 4 * SCHROEDER_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const aggregateNodeBuffer = device.createBuffer({
    label: 'retained-hierarchy-aggregate-node-buffer',
    size: 6 * SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const activeNodeList = {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
    status: 'schroeder-active-node-list-submitted',
    activeCandidateCount: 4,
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeBuffer
  };
  const hierarchyAggregateNode = {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
    status: 'schroeder-hierarchy-aggregate-node-reduction-submitted',
    aggregateNodeCount: 6,
    aggregateNodeStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
    aggregateNodeBuffer
  };
  const candidates = await runSchroederFarAggregateCandidateWebGpu({
    device,
    activeNodeList,
    hierarchyAggregateNode,
    candidateBudget: 5,
    baseGridSpacingM: 0.25,
    openingTheta: 0.75,
    nearFieldSupportScale: 3,
    farFieldErrorBound: 0.02,
    queueEpoch: 9,
    stateFamilyId: 2
  });

  assert.equal(candidates.schema, ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_EXECUTION_SCHEMA);
  assert.equal(candidates.farAggregateCandidateSchema, ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_SCHEMA);
  assert.equal(candidates.status, 'schroeder-far-aggregate-candidates-submitted');
  assert.equal(candidates.sourceActiveNodeSchema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(candidates.sourceHierarchyAggregateNodeSchema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA);
  assert.equal(candidates.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(candidates.fullReadbackPerformed, false);
  assert.equal(candidates.fullParticleReadbackPerformed, false);
  assert.equal(candidates.normalHotLoopReadbackFree, true);
  assert.equal(candidates.activeNodeCount, 4);
  assert.equal(candidates.aggregateNodeCount, 6);
  assert.equal(candidates.candidateBudget, 5);
  assert.equal(candidates.farAggregateCandidateCount, 20);
  assert.equal(candidates.retainedFarAggregateCandidateBuffer, true);
  assert.ok(candidates.farAggregateCandidateBuffer);
  assert.equal(candidates.farAggregateCandidateBuffer.destroyed, false);
  assert.equal(candidates.farAggregateCandidateBufferByteLength, 20 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(candidates.farAggregateCandidateRows.length, 0);
  assert.equal(candidates.traversalMode, 'barnes-hut-style-aggregate-opening-over-schroeder-nodes');
  assert.equal(
    candidates.aggregateAdmissibilityStatus,
    'aggregate-admissible-laws-only-local-incompressibility-and-reactions-excluded'
  );
  assert.equal(
    candidates.exactNearFieldRequirement,
    'near-field-excluded-use-law-neighbor-candidates-for-exact-pairs'
  );
  assert.equal(candidates.conservationStatus, 'read-only-aggregate-traversal-no-state-mutation');
  assert.equal(candidates.stateMutationStatus, 'far-aggregate-candidates-buffer-submitted-no-state-mutation');
  assert.equal(candidates.stateAuthorityStatus, 'state-manager-admitted-aggregate-node-source-consumed');
  assert.deepEqual(device.dispatches.slice(-1), [[1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederFarAggregateCandidateParams')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('opening_theta')));
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-far-aggregate-candidates-params'
    && write.byteLength === 64
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-far-aggregate-candidates-out'
    && buffer.size === 20 * 32 * Float32Array.BYTES_PER_ELEMENT
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder far-aggregate force summaries reduce retained candidates without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const farAggregateCandidateBuffer = device.createBuffer({
    label: 'retained-far-aggregate-candidate-buffer',
    size: 20 * SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const farAggregateCandidates = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-candidates-submitted',
    activeNodeCount: 4,
    candidateBudget: 5,
    farAggregateCandidateCount: 20,
    farAggregateCandidateStrideFloats: SCHROEDER_FAR_AGGREGATE_CANDIDATE_FLOATS,
    enabledFarLawMask: SCHROEDER_FAR_AGGREGATE_LAW_MASK,
    farAggregateCandidateBuffer
  };
  const summary = await runSchroederFarAggregateForceSummaryWebGpu({
    device,
    farAggregateCandidates,
    gravitationalConstant: 10,
    softeningLengthM: 0.25,
    forceScale: 2,
    farFieldErrorBound: 0.03,
    queueEpoch: 12,
    stateFamilyId: 3
  });

  assert.equal(summary.schema, ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA);
  assert.equal(summary.farAggregateForceSummarySchema, ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_SCHEMA);
  assert.equal(summary.status, 'schroeder-far-aggregate-force-summary-submitted');
  assert.equal(summary.sourceFarAggregateCandidateSchema, ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_EXECUTION_SCHEMA);
  assert.equal(summary.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(summary.fullReadbackPerformed, false);
  assert.equal(summary.fullParticleReadbackPerformed, false);
  assert.equal(summary.normalHotLoopReadbackFree, true);
  assert.equal(summary.activeNodeCount, 4);
  assert.equal(summary.farAggregateCandidateCount, 20);
  assert.equal(summary.forceSummaryRowCount, 4);
  assert.equal(summary.retainedForceSummaryBuffer, true);
  assert.ok(summary.forceSummaryBuffer);
  assert.equal(summary.forceSummaryBuffer.destroyed, false);
  assert.equal(summary.forceSummaryBufferByteLength, 4 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(summary.forceSummaryRows.length, 0);
  assert.equal(summary.forceMode, 'read-only-gravity-like-far-aggregate-acceleration-summary');
  assert.equal(summary.errorBoundStatus, 'physical-error-bound-declared-on-summary-rows');
  assert.equal(summary.conservationStatus, 'read-only-force-summary-no-state-mutation');
  assert.equal(summary.stateMutationRequired, false);
  assert.equal(summary.stateMutationStatus, 'force-summary-only-no-state-mutation');
  assert.equal(summary.stateAuthorityStatus, 'state-manager-admission-required-before-any-force-application');
  assert.deepEqual(device.dispatches.slice(-1), [[1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederFarAggregateForceSummaryParams')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('gravitational_constant')));
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-far-aggregate-force-summary-params'
    && write.byteLength === 64
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-far-aggregate-force-summary-out'
    && buffer.size === 4 * 32 * Float32Array.BYTES_PER_ELEMENT
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder far-aggregate diagnostic summaries compact force pressure without particle readback', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const forceSummaryBuffer = device.createBuffer({
    label: 'retained-far-aggregate-force-summary-buffer',
    size: 4 * SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const farAggregateForceSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-force-summary-submitted',
    activeNodeCount: 4,
    forceSummaryRowCount: 4,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    forceSummaryBuffer
  };
  const diagnostics = await runSchroederFarAggregateDiagnosticSummaryWebGpu({
    device,
    farAggregateForceSummary,
    openingTheta: 0.75,
    farFieldErrorBound: 0.03,
    accelerationPressureThreshold: 12,
    queueEpoch: 14,
    stateFamilyId: 4,
    readbackMode:
      SCHROEDER_COMPACT_FAR_AGGREGATE_DIAGNOSTIC_READBACK_MODE
  });

  assert.equal(diagnostics.schema, ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA);
  assert.equal(
    diagnostics.farAggregateDiagnosticSummarySchema,
    ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_SCHEMA
  );
  assert.equal(diagnostics.status, 'schroeder-far-aggregate-diagnostic-summary-submitted');
  assert.equal(
    diagnostics.sourceFarAggregateForceSummarySchema,
    ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA
  );
  assert.equal(diagnostics.readbackMode, SCHROEDER_COMPACT_FAR_AGGREGATE_DIAGNOSTIC_READBACK_MODE);
  assert.equal(diagnostics.compactSummaryReadbackPerformed, true);
  assert.equal(diagnostics.fullReadbackPerformed, false);
  assert.equal(diagnostics.fullParticleReadbackPerformed, false);
  assert.equal(diagnostics.normalHotLoopReadbackFree, false);
  assert.equal(diagnostics.forceSummaryRowCount, 4);
  assert.equal(diagnostics.diagnosticSummaryRowCount, 1);
  assert.equal(diagnostics.retainedDiagnosticSummaryBuffer, true);
  assert.ok(diagnostics.diagnosticSummaryBuffer);
  assert.equal(diagnostics.diagnosticSummaryBuffer.destroyed, false);
  assert.equal(diagnostics.diagnosticSummaryBufferByteLength, 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(diagnostics.diagnosticSummaryRows.length, 32);
  assert.equal(diagnostics.summaryRows.length, 32);
  assert.equal(diagnostics.diagnosticStatus, 'far-aggregate-diagnostics-submitted');
  assert.equal(diagnostics.farFieldQualityStatus, 'far-aggregate-force-quality-pressure-submitted');
  assert.equal(diagnostics.readbackPolicy, 'compact-summary-only-no-particle-readback');
  assert.equal(diagnostics.conservationStatus, 'diagnostic-summary-only-no-state-mutation');
  assert.equal(diagnostics.stateMutationRequired, false);
  assert.equal(diagnostics.stateMutationStatus, 'far-aggregate-diagnostic-summary-only-no-state-mutation');
  assert.equal(diagnostics.stateAuthorityStatus, 'state-manager-admission-required-before-any-far-force-application');
  assert.deepEqual(device.dispatches.slice(-1), [[1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederFarAggregateDiagnosticSummaryParams')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('opening_ratio_pressure_source_count')));
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-far-aggregate-diagnostic-summary-params'
    && write.byteLength === 48
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-far-aggregate-diagnostic-summary-out'
    && buffer.size === 32 * Float32Array.BYTES_PER_ELEMENT
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-far-aggregate-diagnostic-summary-readback'
    && buffer.size === 32 * Float32Array.BYTES_PER_ELEMENT
  )));
});

test('Schroeder far-aggregate law consumer plan requires StateManager admission', () => {
  const farAggregateForceSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-force-summary-submitted',
    activeNodeCount: 4,
    forceSummaryRowCount: 4,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS
  };
  const farAggregateDiagnosticSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-diagnostic-summary-submitted',
    forceSummaryRowCount: 4,
    diagnosticSummaryRowCount: 1,
    diagnosticSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS,
    stateMutationRequired: false,
    fullParticleReadbackRequired: false
  };
  const blocked = createSchroederFarAggregateLawConsumerPlan({
    farAggregateForceSummary,
    farAggregateDiagnosticSummary
  });
  assert.equal(blocked.schema, ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_SCHEMA);
  assert.equal(blocked.status, 'schroeder-far-aggregate-law-consumer-plan-blocked-admission-required');
  assert.equal(blocked.farAggregateLawConsumerAdmissionApproved, false);
  assert.equal(blocked.lawConsumerRowCount, 4);
  assert.equal(blocked.lawConsumerStrideFloats, SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_ROW_LAYOUT.length);
  assert.equal(blocked.lawConsumerStrideFloats, SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS);
  assert.equal(blocked.lawConsumerByteLength, 4 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.deepEqual(blocked.lawFamilies, ['radiation', 'plasma-electromagnetic', 'gas-summary']);
  assert.equal(blocked.consumerMode, 'read-only-radiation-plasma-gas-summary-proxies');
  assert.equal(blocked.stateMutationRequired, false);
  assert.equal(blocked.stateMutationStatus, 'blocked-far-aggregate-law-consumer-admission-required');
  assert.equal(blocked.stateAuthorityStatus, 'requires-state-manager-admission-before-far-aggregate-law-consumer');

  const admission = schroederFarAggregateLawConsumerAdmissionAllowsConsumption({
    farAggregateLawConsumerAdmission: approvedFarAggregateLawConsumerAdmission({ rowCount: 4 }),
    farAggregateForceSummary,
    farAggregateDiagnosticSummary,
    lawConsumerRowCount: 4
  });
  assert.equal(admission.schema, ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_ADMISSION_SCHEMA);
  assert.equal(admission.status, 'schroeder-far-aggregate-law-consumer-admission-approved');
  assert.equal(admission.approved, true);
  assert.equal(admission.consumerMaskAccepted, true);

  const admitted = createSchroederFarAggregateLawConsumerPlan({
    farAggregateForceSummary,
    farAggregateDiagnosticSummary,
    farAggregateLawConsumerAdmission: approvedFarAggregateLawConsumerAdmission({ rowCount: 4 })
  });
  assert.equal(admitted.status, 'schroeder-far-aggregate-law-consumer-plan-ready');
  assert.equal(admitted.farAggregateLawConsumerAdmissionApproved, true);
  assert.equal(admitted.conservationStatus, 'law-consumer-summary-ready-no-state-mutation');
  assert.equal(admitted.stateAuthorityStatus, 'state-manager-admitted-read-only-far-aggregate-law-consumer');

  const params = createSchroederFarAggregateLawConsumerParamsArray({
    forceSummaryRowCount: 4,
    admissionApproved: true
  });
  const view = new DataView(params);
  assert.equal(params.byteLength, 80);
  assert.equal(view.getUint32(0, true), 4);
  assert.equal(view.getUint32(12, true), SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS);
  assert.equal(view.getUint32(16, true), SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK);
  assert.equal(view.getUint32(20, true), 1);
});

test('Schroeder far-aggregate law consumer blocks without admission and dispatches no work', async () => {
  const device = createFakeWebGpuDevice();
  const farAggregateForceSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-force-summary-submitted',
    activeNodeCount: 4,
    forceSummaryRowCount: 4,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    forceSummaryBuffer: { label: 'retained-far-force-summary' }
  };
  const lawConsumer = await runSchroederFarAggregateLawConsumerWebGpu({
    device,
    farAggregateForceSummary
  });

  assert.equal(lawConsumer.schema, ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA);
  assert.equal(lawConsumer.farAggregateLawConsumerSchema, ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_SCHEMA);
  assert.equal(lawConsumer.status, 'schroeder-far-aggregate-law-consumer-blocked-admission-required');
  assert.equal(lawConsumer.farAggregateLawConsumerAdmissionApproved, false);
  assert.equal(lawConsumer.retainedLawConsumerBuffer, false);
  assert.equal(lawConsumer.lawConsumerBufferByteLength, 0);
  assert.equal(lawConsumer.lawConsumerRows.length, 0);
  assert.equal(lawConsumer.stateMutationRequired, false);
  assert.equal(lawConsumer.stateMutationStatus, 'blocked-far-aggregate-law-consumer-admission-required');
  assert.equal(lawConsumer.stateAuthorityStatus, 'requires-state-manager-admission-before-far-aggregate-law-consumer');
  assert.deepEqual(device.dispatches, []);
});

test('Schroeder far-aggregate law consumer emits retained read-only law rows after admission', async () => {
  const device = createFakeWebGpuDevice();
  const forceSummaryBuffer = device.createBuffer({
    label: 'retained-far-force-summary',
    size: 4 * SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const diagnosticSummaryBuffer = device.createBuffer({
    label: 'retained-far-diagnostic-summary',
    size: SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const farAggregateForceSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-force-summary-submitted',
    activeNodeCount: 4,
    forceSummaryRowCount: 4,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    forceSummaryBuffer,
    queueEpoch: 7,
    stateFamilyId: 3
  };
  const farAggregateDiagnosticSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-diagnostic-summary-submitted',
    forceSummaryRowCount: 4,
    diagnosticSummaryRowCount: 1,
    diagnosticSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_FLOATS,
    diagnosticSummaryBuffer,
    stateMutationRequired: false,
    fullParticleReadbackRequired: false
  };

  const lawConsumer = await runSchroederFarAggregateLawConsumerWebGpu({
    device,
    farAggregateForceSummary,
    farAggregateDiagnosticSummary,
    farAggregateLawConsumerAdmission: approvedFarAggregateLawConsumerAdmission({ rowCount: 4 }),
    radiationScale: 2,
    plasmaScale: 3,
    gasSummaryScale: 4,
    gasTemperatureK: 500,
    gasConstantProxy: 123,
    maxFarFieldErrorBound: 0.03,
    maxOpeningRatio: 0.75
  });

  assert.equal(lawConsumer.schema, ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA);
  assert.equal(lawConsumer.farAggregateLawConsumerSchema, ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_SCHEMA);
  assert.equal(lawConsumer.status, 'schroeder-far-aggregate-law-consumer-submitted');
  assert.equal(lawConsumer.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(lawConsumer.fullReadbackPerformed, false);
  assert.equal(lawConsumer.fullParticleReadbackPerformed, false);
  assert.equal(lawConsumer.normalHotLoopReadbackFree, true);
  assert.equal(lawConsumer.farAggregateLawConsumerAdmissionApproved, true);
  assert.equal(lawConsumer.lawConsumerRowCount, 4);
  assert.equal(lawConsumer.retainedLawConsumerBuffer, true);
  assert.ok(lawConsumer.lawConsumerBuffer);
  assert.equal(lawConsumer.lawConsumerBuffer.destroyed, false);
  assert.equal(lawConsumer.lawConsumerBufferByteLength, 4 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(lawConsumer.lawConsumerRows.length, 0);
  assert.equal(lawConsumer.consumerMode, 'read-only-radiation-plasma-gas-summary-proxies');
  assert.equal(lawConsumer.conservationStatus, 'law-consumer-summary-submitted-no-state-mutation');
  assert.equal(lawConsumer.stateMutationRequired, false);
  assert.equal(lawConsumer.stateMutationStatus, 'admitted-far-aggregate-law-consumer-buffer-submitted');
  assert.equal(lawConsumer.stateAuthorityStatus, 'state-manager-admitted-read-only-far-aggregate-law-consumer');
  assert.deepEqual(device.dispatches.slice(-1), [[1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederFarAggregateLawConsumerParams')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('radiation_exposure')));
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-far-aggregate-law-consumer-params'
    && write.byteLength === 80
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-far-aggregate-law-consumer-out'
    && buffer.size === 4 * 32 * Float32Array.BYTES_PER_ELEMENT
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('law-consumer-readback')),
    false
  );
});

test('Schroeder far-aggregate law consumer diagnostic summary plan compacts consumer pressure signals', () => {
  const farAggregateLawConsumer = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-law-consumer-submitted',
    forceSummaryRowCount: 4,
    lawConsumerRowCount: 4,
    lawConsumerStrideFloats: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
    queueEpoch: 7,
    stateFamilyId: 3,
    stateMutationRequired: false,
    fullParticleReadbackRequired: false
  };
  const plan = createSchroederFarAggregateLawConsumerDiagnosticSummaryPlan({
    farAggregateLawConsumer,
    radiationPressureThreshold: 11,
    plasmaPressureThreshold: 13,
    gasPressureThreshold: 17
  });

  assert.equal(plan.schema, ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_SCHEMA);
  assert.equal(plan.status, 'schroeder-far-aggregate-law-consumer-diagnostic-summary-plan-ready');
  assert.equal(
    plan.sourceFarAggregateLawConsumerSchema,
    ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA
  );
  assert.equal(plan.lawConsumerRowCount, 4);
  assert.equal(plan.lawConsumerStrideFloats, SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS);
  assert.equal(
    plan.lawConsumerDiagnosticSummaryStrideFloats,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS
  );
  assert.equal(
    plan.lawConsumerDiagnosticSummaryByteLength,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(plan.lawConsumerDiagnosticSummaryRowCount, 1);
  assert.equal(plan.radiationPressureThreshold, 11);
  assert.equal(plan.plasmaPressureThreshold, 13);
  assert.equal(plan.gasPressureThreshold, 17);
  assert.equal(plan.outputCompaction, 'one-compact-far-aggregate-law-consumer-diagnostic-summary-row');
  assert.equal(plan.diagnosticStatus, 'far-aggregate-law-consumer-diagnostics-ready');
  assert.equal(plan.farFieldConsumerQualityStatus, 'far-aggregate-law-consumer-pressure-diagnostics-ready');
  assert.equal(plan.readbackPolicy, 'compact-summary-only-no-particle-readback');
  assert.equal(plan.conservationStatus, 'law-consumer-diagnostic-summary-only-no-state-mutation');
  assert.equal(plan.stateMutationRequired, false);
  assert.equal(plan.stateMutationStatus, 'far-aggregate-law-consumer-diagnostic-summary-only-no-state-mutation');
  assert.equal(plan.stateAuthorityStatus, 'state-manager-admission-required-before-any-law-consumer-state-mutation');
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = createSchroederFarAggregateLawConsumerDiagnosticSummaryParamsArray(plan);
  const view = new DataView(params);
  assert.equal(params.byteLength, 48);
  assert.equal(view.getUint32(0, true), 4);
  assert.equal(view.getUint32(4, true), SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS);
  assert.equal(view.getFloat32(16, true), 11);
  assert.equal(view.getFloat32(20, true), 13);
  assert.equal(view.getFloat32(24, true), 17);
  assert.equal(view.getFloat32(28, true), 7);
  assert.equal(view.getFloat32(32, true), 3);
});

test('Schroeder far-aggregate law consumer diagnostic summary emits compact retained diagnostics', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const lawConsumerBuffer = device.createBuffer({
    label: 'retained-far-law-consumer',
    size: 4 * SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const farAggregateLawConsumer = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-law-consumer-submitted',
    forceSummaryRowCount: 4,
    lawConsumerRowCount: 4,
    lawConsumerStrideFloats: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
    lawConsumerBuffer,
    queueEpoch: 7,
    stateFamilyId: 3,
    stateMutationRequired: false,
    fullParticleReadbackRequired: false
  };

  const diagnostics = await runSchroederFarAggregateLawConsumerDiagnosticSummaryWebGpu({
    device,
    farAggregateLawConsumer,
    radiationPressureThreshold: 11,
    plasmaPressureThreshold: 13,
    gasPressureThreshold: 17,
    readbackMode:
      SCHROEDER_COMPACT_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_READBACK_MODE
  });

  assert.equal(
    diagnostics.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA
  );
  assert.equal(
    diagnostics.farAggregateLawConsumerDiagnosticSummarySchema,
    ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_SCHEMA
  );
  assert.equal(diagnostics.status, 'schroeder-far-aggregate-law-consumer-diagnostic-summary-submitted');
  assert.equal(
    diagnostics.readbackMode,
    SCHROEDER_COMPACT_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_READBACK_MODE
  );
  assert.equal(diagnostics.compactSummaryReadbackPerformed, true);
  assert.equal(diagnostics.fullReadbackPerformed, false);
  assert.equal(diagnostics.fullParticleReadbackPerformed, false);
  assert.equal(diagnostics.normalHotLoopReadbackFree, false);
  assert.equal(diagnostics.lawConsumerRowCount, 4);
  assert.equal(diagnostics.lawConsumerDiagnosticSummaryRowCount, 1);
  assert.equal(diagnostics.retainedDiagnosticSummaryBuffer, true);
  assert.equal(diagnostics.retainedLawConsumerDiagnosticSummaryBuffer, true);
  assert.ok(diagnostics.lawConsumerDiagnosticSummaryBuffer);
  assert.equal(diagnostics.lawConsumerDiagnosticSummaryBuffer.destroyed, false);
  assert.equal(
    diagnostics.lawConsumerDiagnosticSummaryBufferByteLength,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(diagnostics.diagnosticSummaryRows.length, SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS);
  assert.equal(
    diagnostics.lawConsumerDiagnosticSummaryRows.length,
    SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS
  );
  assert.equal(diagnostics.summaryRows.length, SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS);
  assert.equal(diagnostics.diagnosticStatus, 'far-aggregate-law-consumer-diagnostics-submitted');
  assert.equal(diagnostics.farFieldConsumerQualityStatus, 'far-aggregate-law-consumer-pressure-diagnostics-submitted');
  assert.equal(diagnostics.readbackPolicy, 'compact-summary-only-no-particle-readback');
  assert.equal(diagnostics.conservationStatus, 'law-consumer-diagnostic-summary-only-no-state-mutation');
  assert.equal(diagnostics.stateMutationRequired, false);
  assert.equal(diagnostics.stateMutationStatus, 'far-aggregate-law-consumer-diagnostic-summary-only-no-state-mutation');
  assert.equal(diagnostics.stateAuthorityStatus, 'state-manager-admission-required-before-any-law-consumer-state-mutation');
  assert.deepEqual(device.dispatches.slice(-1), [[1, 1, 1]]);
  assert.ok(
    device.shaderModules.some((module) => (
      module.code.includes('SchroederFarAggregateLawConsumerDiagnosticSummaryParams')
    ))
  );
  assert.ok(device.shaderModules.some((module) => module.code.includes('pressure_consumer_count')));
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-far-aggregate-law-consumer-diagnostic-summary-params'
    && write.byteLength === 48
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-far-aggregate-law-consumer-diagnostic-summary-out'
    && buffer.size === SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS
      * Float32Array.BYTES_PER_ELEMENT
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-far-aggregate-law-consumer-diagnostic-summary-readback'
    && buffer.size === SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS
      * Float32Array.BYTES_PER_ELEMENT
  )));
});

test('Schroeder far-aggregate law consumer authority policy keeps pressure diagnostics read-only by default', () => {
  const summaryRows = new Float32Array(SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS);
  summaryRows[0] = 4;
  summaryRows[1] = 2;
  summaryRows[2] = 1;
  summaryRows[3] = 2;
  summaryRows[7] = 100;
  summaryRows[8] = 60;
  summaryRows[9] = 7;
  summaryRows[11] = 101325;
  summaryRows[13] = 9;
  summaryRows[14] = 10;
  summaryRows[17] = 1;
  summaryRows[18] = 1;
  summaryRows[20] = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK;
  summaryRows[21] = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK;
  const farAggregateLawConsumerDiagnosticSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-law-consumer-diagnostic-summary-submitted',
    lawConsumerRowCount: 4,
    lawConsumerDiagnosticSummaryRowCount: 1,
    lawConsumerDiagnosticSummaryStrideFloats:
      SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS,
    lawConsumerDiagnosticSummaryRows: summaryRows
  };

  const policy = createSchroederFarAggregateLawConsumerAuthorityPolicy({
    farAggregateLawConsumerDiagnosticSummary,
    pressureRatioThreshold: 0.4
  });

  assert.equal(policy.schema, ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_AUTHORITY_POLICY_SCHEMA);
  assert.equal(
    policy.status,
    'schroeder-far-aggregate-law-consumer-authority-policy-read-only-pressure-observed'
  );
  assert.equal(policy.diagnosticRowsAvailable, true);
  assert.equal(policy.lawConsumerRowCount, 4);
  assert.equal(policy.activeConsumerCount, 2);
  assert.equal(policy.blockedConsumerCount, 1);
  assert.equal(policy.pressureConsumerCount, 2);
  assert.equal(policy.pressureRatio, 0.5);
  assert.equal(policy.pressureSignalDetected, true);
  assert.equal(policy.enabledConsumerLawMask, SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK);
  assert.equal(policy.emittedConsumerLawMask, SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK);
  assert.equal(policy.recommendedStateDeltaRequired, true);
  assert.equal(policy.allowStateDeltaMutation, false);
  assert.equal(policy.stateDeltaAdmissionRequired, false);
  assert.equal(policy.mutationPolicy, 'read-only-law-consumer-summary-retained');
  assert.equal(policy.stateMutationRequired, false);
  assert.equal(policy.stateMutationStatus, 'far-field-consumer-remains-read-only-summary');
  assert.equal(
    policy.stateAuthorityStatus,
    'state-manager-admission-not-required-for-read-only-law-consumer-policy'
  );
  assert.equal(policy.fullParticleReadbackRequired, false);
});

test('Schroeder far-aggregate law consumer authority policy can require future state-delta admission', () => {
  const summaryRows = new Float32Array(SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS);
  summaryRows[0] = 4;
  summaryRows[1] = 2;
  summaryRows[3] = 2;
  summaryRows[11] = 101325;
  summaryRows[20] = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK;
  summaryRows[21] = SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_MASK;
  const farAggregateLawConsumerDiagnosticSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-law-consumer-diagnostic-summary-submitted',
    lawConsumerRowCount: 4,
    lawConsumerDiagnosticSummaryRowCount: 1,
    lawConsumerDiagnosticSummaryStrideFloats:
      SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_FLOATS,
    lawConsumerDiagnosticSummaryRows: summaryRows
  };

  const policy = createSchroederFarAggregateLawConsumerAuthorityPolicy({
    farAggregateLawConsumerDiagnosticSummary,
    allowStateDeltaMutation: true,
    pressureRatioThreshold: 0.4
  });

  assert.equal(
    policy.status,
    'schroeder-far-aggregate-law-consumer-authority-policy-state-delta-admission-required'
  );
  assert.equal(policy.pressureSignalDetected, true);
  assert.equal(policy.recommendedStateDeltaRequired, true);
  assert.equal(policy.allowStateDeltaMutation, true);
  assert.equal(policy.stateDeltaAdmissionRequired, true);
  assert.equal(
    policy.mutationPolicy,
    'state-delta-admission-required-before-any-far-field-consumer-mutation'
  );
  assert.equal(policy.conservationStatus, 'future-far-field-consumer-state-delta-requires-admission');
  assert.equal(policy.stateMutationRequired, false);
  assert.equal(policy.stateMutationStatus, 'far-field-consumer-state-delta-requires-new-admission');
  assert.equal(
    policy.stateAuthorityStatus,
    'requires-state-manager-admission-before-far-field-consumer-state-delta'
  );
  assert.deepEqual(policy.futureOutputFamilies, ['schroeder-far-aggregate-law-consumer-state-delta']);
});

test('Schroeder far-aggregate gas state delta requires authority policy and StateManager admission', () => {
  const farAggregateLawConsumer = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-law-consumer-submitted',
    forceSummaryRowCount: 4,
    lawConsumerRowCount: 4,
    lawConsumerStrideFloats: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
    lawConsumerBuffer: { label: 'retained-far-law-consumer' },
    queueEpoch: 7,
    stateFamilyId: 3
  };
  const readOnlyPolicy = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_AUTHORITY_POLICY_SCHEMA,
    status: 'schroeder-far-aggregate-law-consumer-authority-policy-read-only-pressure-observed',
    stateDeltaAdmissionRequired: false,
    fullParticleReadbackRequired: false
  };
  const stateDeltaPolicy = {
    ...readOnlyPolicy,
    status: 'schroeder-far-aggregate-law-consumer-authority-policy-state-delta-admission-required',
    stateDeltaAdmissionRequired: true
  };

  const policyBlocked = createSchroederFarAggregateGasStateDeltaPlan({
    farAggregateLawConsumer,
    farAggregateLawConsumerAuthorityPolicy: readOnlyPolicy
  });
  assert.equal(policyBlocked.schema, ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_SCHEMA);
  assert.equal(
    policyBlocked.status,
    'schroeder-far-aggregate-gas-state-delta-plan-blocked-authority-policy-read-only'
  );
  assert.equal(policyBlocked.stateMutationRequired, false);
  assert.equal(
    policyBlocked.stateMutationStatus,
    'blocked-far-aggregate-gas-state-delta-authority-policy-read-only'
  );

  const admissionBlocked = createSchroederFarAggregateGasStateDeltaPlan({
    farAggregateLawConsumer,
    farAggregateLawConsumerAuthorityPolicy: stateDeltaPolicy
  });
  assert.equal(
    admissionBlocked.status,
    'schroeder-far-aggregate-gas-state-delta-plan-blocked-admission-required'
  );
  assert.equal(admissionBlocked.authorityPolicyAccepted, true);
  assert.equal(admissionBlocked.farAggregateGasStateDeltaAdmissionApproved, false);
  assert.equal(admissionBlocked.pressureInterfaceImportRequired, false);

  const admission = schroederFarAggregateGasStateDeltaAdmissionAllowsApplication({
    farAggregateGasStateDeltaAdmission: approvedFarAggregateGasStateDeltaAdmission({ rowCount: 4 }),
    farAggregateLawConsumer,
    farAggregateLawConsumerAuthorityPolicy: stateDeltaPolicy,
    stateDeltaRowCount: 4
  });
  assert.equal(admission.schema, ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ADMISSION_SCHEMA);
  assert.equal(admission.status, 'schroeder-far-aggregate-gas-state-delta-admission-approved');
  assert.equal(admission.approved, true);
  assert.equal(admission.outputFamilyAccepted, true);
  assert.equal(admission.targetStateFamilyAccepted, true);
  assert.equal(admission.policyAccepted, true);

  const admitted = createSchroederFarAggregateGasStateDeltaPlan({
    farAggregateLawConsumer,
    farAggregateLawConsumerAuthorityPolicy: stateDeltaPolicy,
    farAggregateGasStateDeltaAdmission: approvedFarAggregateGasStateDeltaAdmission({ rowCount: 4 }),
    referencePressurePa: 100000,
    pressureDeltaScale: 0.5,
    densityDeltaScale: 2,
    gasGamma: 1.3
  });
  assert.equal(admitted.status, 'schroeder-far-aggregate-gas-state-delta-plan-ready');
  assert.equal(admitted.farAggregateGasStateDeltaAdmissionApproved, true);
  assert.equal(admitted.gasStateDeltaRowCount, 4);
  assert.equal(admitted.gasStateDeltaStrideFloats, SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS);
  assert.equal(admitted.gasStateDeltaByteLength, 4 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(admitted.targetStateFamily, SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_TARGET_FAMILY);
  assert.equal(admitted.pressureInterfaceImportRequired, true);
  assert.equal(admitted.stateMutationRequired, true);
  assert.deepEqual(admitted.outputFamilies, [
    SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_OUTPUT_FAMILY,
    SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_TARGET_FAMILY
  ]);

  const params = createSchroederFarAggregateGasStateDeltaParamsArray({
    ...admitted,
    admissionApproved: true
  });
  const view = new DataView(params);
  assert.equal(params.byteLength, 64);
  assert.equal(view.getUint32(0, true), 4);
  assert.equal(view.getUint32(4, true), SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS);
  assert.equal(view.getUint32(8, true), SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS);
  assert.equal(view.getUint32(12, true), 1);
  assert.equal(view.getUint32(16, true), 64);
  assert.equal(view.getFloat32(32, true), 100000);
  assert.equal(view.getFloat32(36, true), 0.5);
  assert.equal(view.getFloat32(40, true), 2);
  assert.ok(Math.abs(view.getFloat32(44, true) - 1.3) < 1e-6);
  assert.equal(view.getFloat32(48, true), 7);
  assert.equal(view.getFloat32(52, true), 3);
});

test('Schroeder far-aggregate gas state delta blocks without admission and dispatches no work', async () => {
  const device = createFakeWebGpuDevice();
  const lawConsumerBuffer = device.createBuffer({
    label: 'retained-far-law-consumer',
    size: 4 * SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const farAggregateLawConsumer = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-law-consumer-submitted',
    forceSummaryRowCount: 4,
    lawConsumerRowCount: 4,
    lawConsumerStrideFloats: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
    lawConsumerBuffer
  };
  const stateDeltaPolicy = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_AUTHORITY_POLICY_SCHEMA,
    status: 'schroeder-far-aggregate-law-consumer-authority-policy-state-delta-admission-required',
    stateDeltaAdmissionRequired: true,
    fullParticleReadbackRequired: false
  };

  const gasStateDelta = await runSchroederFarAggregateGasStateDeltaWebGpu({
    device,
    farAggregateLawConsumer,
    farAggregateLawConsumerAuthorityPolicy: stateDeltaPolicy
  });

  assert.equal(gasStateDelta.schema, ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA);
  assert.equal(gasStateDelta.farAggregateGasStateDeltaSchema, ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_SCHEMA);
  assert.equal(gasStateDelta.status, 'schroeder-far-aggregate-gas-state-delta-blocked-admission-required');
  assert.equal(gasStateDelta.farAggregateGasStateDeltaAdmissionApproved, false);
  assert.equal(gasStateDelta.retainedGasStateDeltaBuffer, false);
  assert.equal(gasStateDelta.gasStateDeltaBufferByteLength, 0);
  assert.equal(gasStateDelta.gasStateDeltaRows.length, 0);
  assert.equal(gasStateDelta.fullParticleReadbackFree, true);
  assert.equal(gasStateDelta.readbackTelemetryComplete, true);
  assert.deepEqual(gasStateDelta.readbackTelemetryUnknownSources, []);
  assert.equal(gasStateDelta.mapAsyncCount, 0);
  assert.equal(gasStateDelta.readbackBytes, 0);
  assert.equal(gasStateDelta.hostQueueFenceCount, 0);
  assert.equal(gasStateDelta.normalHotLoopReadbackFree, true);
  assert.equal(gasStateDelta.stateMutationRequired, false);
  assert.equal(gasStateDelta.pressureInterfaceImportRequired, false);
  assert.deepEqual(device.dispatches, []);
});

test('Schroeder far-aggregate gas state delta emits retained GPU pressure deltas after admission', async () => {
  const device = createFakeWebGpuDevice();
  const lawConsumerBuffer = device.createBuffer({
    label: 'retained-far-law-consumer',
    size: 4 * SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const farAggregateLawConsumer = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-law-consumer-submitted',
    forceSummaryRowCount: 4,
    lawConsumerRowCount: 4,
    lawConsumerStrideFloats: SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_FLOATS,
    lawConsumerBuffer,
    queueEpoch: 7,
    stateFamilyId: 3
  };
  const stateDeltaPolicy = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_AUTHORITY_POLICY_SCHEMA,
    status: 'schroeder-far-aggregate-law-consumer-authority-policy-state-delta-admission-required',
    stateDeltaAdmissionRequired: true,
    fullParticleReadbackRequired: false
  };

  const gasStateDelta = await runSchroederFarAggregateGasStateDeltaWebGpu({
    device,
    farAggregateLawConsumer,
    farAggregateLawConsumerAuthorityPolicy: stateDeltaPolicy,
    farAggregateGasStateDeltaAdmission: approvedFarAggregateGasStateDeltaAdmission({ rowCount: 4 }),
    referencePressurePa: 100000,
    pressureDeltaScale: 0.5,
    densityDeltaScale: 2,
    gasGamma: 1.3
  });

  assert.equal(gasStateDelta.schema, ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA);
  assert.equal(gasStateDelta.farAggregateGasStateDeltaSchema, ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_SCHEMA);
  assert.equal(gasStateDelta.status, 'schroeder-far-aggregate-gas-state-delta-submitted');
  assert.equal(gasStateDelta.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(gasStateDelta.fullReadbackPerformed, false);
  assert.equal(gasStateDelta.fullParticleReadbackPerformed, false);
  assert.equal(gasStateDelta.fullParticleReadbackFree, true);
  assert.equal(gasStateDelta.readbackTelemetryComplete, true);
  assert.deepEqual(gasStateDelta.readbackTelemetryUnknownSources, []);
  assert.equal(gasStateDelta.mapAsyncCount, 0);
  assert.equal(gasStateDelta.readbackBytes, 0);
  assert.equal(gasStateDelta.hostQueueFenceCount, 0);
  assert.equal(gasStateDelta.normalHotLoopReadbackFree, true);
  assert.equal(gasStateDelta.farAggregateGasStateDeltaAdmissionApproved, true);
  assert.equal(gasStateDelta.gasStateDeltaRowCount, 4);
  assert.equal(gasStateDelta.retainedGasStateDeltaBuffer, true);
  assert.ok(gasStateDelta.gasStateDeltaBuffer);
  assert.equal(gasStateDelta.gasStateDeltaBuffer.destroyed, false);
  assert.equal(gasStateDelta.gasStateDeltaBufferByteLength, 4 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(gasStateDelta.gasStateDeltaRows.length, 0);
  assert.equal(gasStateDelta.stateMutationRequired, true);
  assert.equal(gasStateDelta.stateMutationStatus, 'admitted-far-aggregate-gas-state-delta-buffer-submitted');
  assert.equal(gasStateDelta.stateAuthorityStatus, 'state-manager-admitted-retained-gas-state-delta-buffer');
  assert.equal(gasStateDelta.pressureInterfaceImportRequired, true);
  assert.deepEqual(device.dispatches.slice(-1), [[1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederFarAggregateGasStateDeltaParams')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('pressure_delta')));
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-far-aggregate-gas-state-delta-params'
    && write.byteLength === 64
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-far-aggregate-gas-state-delta-out'
    && buffer.size === 4 * 32 * Float32Array.BYTES_PER_ELEMENT
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('gas-state-delta-readback')),
    false
  );
});

test('Schroeder far-aggregate gas-cell import materializes retained pressure rows after gas admission', async () => {
  const device = createFakeWebGpuDevice();
  const gasStateDeltaBuffer = device.createBuffer({
    label: 'retained-far-aggregate-gas-state-delta',
    size: 4 * SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const forceSummaryBuffer = device.createBuffer({
    label: 'retained-far-aggregate-force-summary',
    size: 4 * SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const farAggregateGasStateDelta = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-gas-state-delta-submitted',
    lawConsumerRowCount: 4,
    gasStateDeltaRowCount: 4,
    stateDeltaRowCount: 4,
    gasStateDeltaStrideFloats: SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS,
    gasStateDeltaBuffer,
    gasStateDeltaBufferByteLength:
      4 * SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    farAggregateGasStateDeltaAdmissionApproved: true,
    pressureInterfaceImportRequired: true,
    stateMutationRequired: true,
    fullParticleReadbackRequired: false,
    queueEpoch: 9,
    stateFamilyId: 5
  };
  const farAggregateForceSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-force-summary-submitted',
    activeNodeCount: 4,
    forceSummaryRowCount: 4,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    forceSummaryBuffer,
    forceSummaryBufferByteLength:
      4 * SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    queueEpoch: 9
  };

  const plan = createSchroederFarAggregateGasCellImportPlan({
    farAggregateGasStateDelta,
    farAggregateForceSummary,
    defaultCellVolumeM3: 0.125
  });
  assert.equal(plan.schema, ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA);
  assert.equal(plan.status, 'schroeder-far-aggregate-gas-cell-import-plan-ready');
  assert.equal(plan.gasPressureCellRowCount, 4);
  assert.equal(plan.pressureInterfaceGasPressureCellRowCount, 4);
  assert.equal(plan.gasPressureCellRowStrideFloats, SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS);
  assert.equal(
    plan.gasPressureCellRowByteLength,
    4 * SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(plan.pressureInterfaceImportReady, true);
  assert.equal(plan.retainedGasCellFieldSourceReady, true);
  assert.deepEqual(plan.outputFamilies, [SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_OUTPUT_FAMILY]);
  assert.deepEqual(plan.retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(plan.retainedGasCellFieldSource.consumerAccessProtocol, 'same-device-retained-buffer-ref');
  assert.equal(plan.retainedGasCellFieldSource.cpuSnapshotRequiredForPortableImport, true);
  assert.equal(plan.localPressureGradientReady, false);
  assert.equal(plan.localPressureGradientStatus, 'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read');
  assert.equal(plan.conservativeTransferStatus, 'retained-gas-pressure-cells-ready-for-pressure-interface');

  const params = createSchroederFarAggregateGasCellImportParamsArray(plan);
  const view = new DataView(params);
  assert.equal(params.byteLength, 48);
  assert.equal(view.getUint32(0, true), 4);
  assert.equal(view.getUint32(4, true), SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS);
  assert.equal(view.getUint32(8, true), 4);
  assert.equal(view.getUint32(12, true), SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS);
  assert.equal(view.getUint32(16, true), SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS);

  const gasCellImport = await runSchroederFarAggregateGasCellImportWebGpu({
    device,
    farAggregateGasStateDelta,
    farAggregateForceSummary,
    defaultCellVolumeM3: 0.125
  });

  assert.equal(gasCellImport.schema, ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA);
  assert.equal(gasCellImport.farAggregateGasCellImportSchema, ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA);
  assert.equal(gasCellImport.status, 'schroeder-far-aggregate-gas-cell-import-submitted');
  assert.equal(gasCellImport.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(gasCellImport.fullReadbackPerformed, false);
  assert.equal(gasCellImport.fullParticleReadbackPerformed, false);
  assert.equal(gasCellImport.fullParticleReadbackFree, true);
  assert.equal(gasCellImport.readbackTelemetryComplete, true);
  assert.deepEqual(gasCellImport.readbackTelemetryUnknownSources, []);
  assert.equal(gasCellImport.mapAsyncCount, 0);
  assert.equal(gasCellImport.readbackBytes, 0);
  assert.equal(gasCellImport.hostQueueFenceCount, 0);
  assert.equal(gasCellImport.normalHotLoopReadbackFree, true);
  assert.equal(gasCellImport.pressureInterfaceImportReady, true);
  assert.equal(gasCellImport.retainedGasCellFieldSourceReady, true);
  assert.equal(gasCellImport.localPressureGradientReady, false);
  assert.equal(
    gasCellImport.localPressureGradientStatus,
    'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read'
  );
  assert.equal(gasCellImport.gasPressureCellRows.length, 0);
  assert.equal(gasCellImport.gasPressureCellRowsBufferRetained, true);
  assert.equal(gasCellImport.pressureInterfaceGasPressureCellRowsBufferRetained, true);
  assert.ok(gasCellImport.gasPressureCellsBuffer);
  assert.equal(gasCellImport.gasPressureCellsBuffer.destroyed, false);
  assert.equal(gasCellImport.gasPressureCellRowCount, 4);
  assert.equal(gasCellImport.pressureInterfaceGasPressureCellRowCount, 4);
  assert.equal(
    gasCellImport.gasPressureCellRowByteLength,
    4 * SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  assert.deepEqual(gasCellImport.retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(
    gasCellImport.retainedGasCellFieldSource.schema,
    'peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0'
  );
  assert.equal(gasCellImport.retainedGasCellFieldSource.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(gasCellImport.retainedGasCellFieldSource.stateManagerAdmissionRequired, true);
  assert.deepEqual(device.dispatches.slice(-1), [[1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederFarAggregateGasCellImportParams')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('gas_cell_rows')));
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-far-aggregate-gas-cell-import-params'
    && write.byteLength === 48
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-far-aggregate-gas-cell-import-pressure-cells-out'
    && buffer.size === 4 * SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS * Float32Array.BYTES_PER_ELEMENT
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('gas-cell-import-readback')),
    false
  );
});

test('Schroeder far-aggregate force application blocks without admission and dispatches no work', async () => {
  const device = createFakeWebGpuDevice();
  const { sphParticleState } = manualBuffers({ particleCount: 4, massKg: 2, smoothingLengthM: 0.25 });
  const farAggregateForceSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-force-summary-submitted',
    activeNodeCount: 4,
    forceSummaryRowCount: 4,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    forceSummaryBuffer: { label: 'retained-far-force-summary' }
  };
  const application = await runSchroederFarAggregateForceApplicationWebGpu({
    device,
    farAggregateForceSummary,
    sphParticleState,
    dtS: 0.01
  });

  assert.equal(application.schema, ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA);
  assert.equal(application.farAggregateForceApplicationSchema, ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_SCHEMA);
  assert.equal(application.status, 'schroeder-far-aggregate-force-application-blocked-admission-required');
  assert.equal(application.farAggregateForceApplicationAdmissionApproved, false);
  assert.equal(application.retainedForceApplicationBuffer, false);
  assert.equal(application.forceApplicationBufferByteLength, 0);
  assert.equal(application.forceApplicationRows.length, 0);
  assert.equal(application.stateMutationRequired, false);
  assert.equal(application.stateMutationStatus, 'blocked-far-aggregate-force-application-admission-required');
  assert.equal(application.stateAuthorityStatus, 'requires-state-manager-admission-before-far-force-application');
  assert.deepEqual(device.dispatches, []);
});

test('Schroeder far-aggregate force application emits retained deltas after admission without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const { sphParticleState } = manualBuffers({ particleCount: 4, massKg: 2, smoothingLengthM: 0.25 });
  const forceSummaryBuffer = device.createBuffer({
    label: 'retained-far-force-summary',
    size: 4 * SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  const farAggregateForceSummary = {
    schema: ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA,
    status: 'schroeder-far-aggregate-force-summary-submitted',
    activeNodeCount: 4,
    forceSummaryRowCount: 4,
    forceSummaryStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_FLOATS,
    forceSummaryBuffer,
    queueEpoch: 7,
    stateFamilyId: 3
  };
  const application = await runSchroederFarAggregateForceApplicationWebGpu({
    device,
    farAggregateForceSummary,
    sphParticleState,
    farAggregateForceApplicationAdmission: approvedFarAggregateForceApplicationAdmission({ rowCount: 4 }),
    dtS: 0.01,
    accelerationScale: 2,
    maxAccelerationMPerS2: 50,
    maxFarFieldErrorBound: 0.03,
    maxOpeningRatio: 0.75
  });

  assert.equal(application.schema, ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA);
  assert.equal(application.farAggregateForceApplicationSchema, ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_SCHEMA);
  assert.equal(application.status, 'schroeder-far-aggregate-force-application-submitted');
  assert.equal(application.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(application.fullReadbackPerformed, false);
  assert.equal(application.fullParticleReadbackPerformed, false);
  assert.equal(application.normalHotLoopReadbackFree, true);
  assert.equal(application.farAggregateForceApplicationAdmissionApproved, true);
  assert.equal(application.forceApplicationRowCount, 4);
  assert.equal(application.retainedForceApplicationBuffer, true);
  assert.ok(application.forceApplicationBuffer);
  assert.equal(application.forceApplicationBuffer.destroyed, false);
  assert.equal(application.forceApplicationBufferByteLength, 4 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(application.forceApplicationRows.length, 0);
  assert.equal(application.conservationStatus, 'force-application-delta-submitted');
  assert.equal(application.energyPolicy, 'kinetic-delta-reported-potential-read-only');
  assert.equal(application.stateMutationRequired, true);
  assert.equal(application.stateMutationStatus, 'admitted-far-aggregate-force-application-buffer-submitted');
  assert.equal(application.stateAuthorityStatus, 'state-manager-admitted-retained-force-application-buffer');
  assert.deepEqual(device.dispatches.slice(-1), [[1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederFarAggregateForceApplicationParams')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('kinetic_energy_delta')));
  assert.ok(device.writes.some((write) => (
    write.label === 'ulg-schroeder-far-aggregate-force-application-params'
    && write.byteLength === 64
  )));
  assert.ok(device.createdBuffers.some((buffer) => (
    buffer.label === 'ulg-schroeder-far-aggregate-force-application-out'
    && buffer.size === 4 * 32 * Float32Array.BYTES_PER_ELEMENT
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('force-application-readback')),
    false
  );
});

test('Schroeder phase-volume migration consumes retained aggregate nodes without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const identityBuffer = { label: 'retained-particle-identity-buffer' };
  const levelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-level-assignment-submitted',
    particleCount: 130,
    minLevel: -4,
    maxLevel: 8,
    baseGridSpacingM: 0.25,
    targetSupportCells: 1.5,
    supportRadiusScale: 1,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    assignmentBuffer: { label: 'retained-level-assignment-buffer' }
  };
  const hierarchyAggregateNode = {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
    status: 'schroeder-hierarchy-aggregate-node-reduction-submitted',
    aggregateRowCount: 130,
    aggregateNodeStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
    aggregateNodeBuffer: { label: 'retained-hierarchy-aggregate-node-buffer' }
  };
  const migration = await runSchroederPhaseVolumeMigrationWebGpu({
    device,
    levelAssignment,
    hierarchyAggregateNode,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      identityRequired: true,
      identityBuffer
    },
    phaseVolumeExpandThreshold: 64,
    coarsenLevelDeltaThreshold: 1,
    gasPhaseId: 3,
    migrationEpoch: 11
  });

  assert.equal(migration.schema, ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA);
  assert.equal(migration.phaseVolumeMigrationSchema, ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA);
  assert.equal(migration.status, 'schroeder-phase-volume-migration-submitted');
  assert.equal(migration.sourceAssignmentSchema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(migration.sourceHierarchyAggregateNodeSchema, ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA);
  assert.equal(migration.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(migration.fullReadbackPerformed, false);
  assert.equal(migration.fullParticleReadbackPerformed, false);
  assert.equal(migration.fullParticleReadbackFree, true);
  assert.equal(migration.readbackTelemetryComplete, true);
  assert.equal(migration.mapAsyncCount, 0);
  assert.equal(migration.readbackBytes, 0);
  assert.equal(migration.hostQueueFenceCount, 1);
  assert.equal(migration.normalHotLoopReadbackFree, false);
  assert.equal(migration.retainedMigrationBuffer, true);
  assert.ok(migration.migrationBuffer);
  assert.equal(migration.migrationBuffer.destroyed, false);
  assert.equal(migration.migrationBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(migration.migrationRows.length, 0);
  assert.equal(migration.phaseVolumeStatus, 'phase-volume-migration-submitted');
  assert.equal(migration.migrationMode, 'physical-volume-level-target-with-aggregate-coherence');
  assert.equal(migration.aggregateCoherenceRequirement, 'retained-aggregate-node-buffer-consumed');
  assert.equal(migration.identityRequired, true);
  assert.equal(migration.aggregateIdentityKeyMode, 'exact-render-domain-id');
  assert.equal(migration.refinePressurePolicy, 'explicit-gpu-row-mask-before-any-split-merge-mutation');
  assert.deepEqual(migration.refinePressureReasonBits, SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS);
  assert.equal(migration.conservativeTransferStatus, 'phase-volume-migration-submitted');
  assert.equal(migration.stateMutationStatus, 'phase-volume-migration-buffer-submitted');
  assert.equal(migration.stateAuthorityStatus, 'requires-state-manager-admission-for-authoritative-level-migration');
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederPhaseVolumeMigrationParams')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('refine_pressure_reason_mask')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('sparse_surface_refine_pressure')));
  assert.equal(
    device.bindGroups.at(-1).entries.find((entry) => entry.binding === 4).resource.buffer,
    identityBuffer
  );
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder phase-volume level update blocks without admission and dispatches no work', async () => {
  const device = createFakeWebGpuDevice();
  const phaseVolumeMigration = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-migration-submitted',
    particleCount: 130,
    migrationStrideFloats: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
    migrationBuffer: { label: 'retained-phase-volume-migration-buffer' }
  };
  const update = await runSchroederPhaseVolumeLevelUpdateWebGpu({
    device,
    phaseVolumeMigration
  });

  assert.equal(update.schema, ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA);
  assert.equal(update.phaseVolumeLevelUpdateSchema, ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA);
  assert.equal(update.status, 'schroeder-phase-volume-level-update-blocked-admission-required');
  assert.equal(update.phaseVolumeMigrationAdmissionApproved, false);
  assert.equal(update.fullParticleReadbackFree, true);
  assert.equal(update.readbackTelemetryComplete, true);
  assert.equal(update.mapAsyncCount, 0);
  assert.equal(update.readbackBytes, 0);
  assert.equal(update.hostQueueFenceCount, 0);
  assert.equal(update.normalHotLoopReadbackFree, true);
  assert.equal(update.retainedLevelUpdateBuffer, false);
  assert.equal(update.levelUpdateBufferByteLength, 0);
  assert.equal(update.levelUpdateRows.length, 0);
  assert.equal(update.conservativeTransferStatus, 'phase-volume-level-update-blocked-admission-required');
  assert.equal(update.stateMutationStatus, 'blocked-phase-volume-level-update-admission-required');
  assert.deepEqual(device.dispatches, []);
});

test('Schroeder phase-volume split/merge proposals consume retained migrations without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const phaseVolumeMigration = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-migration-submitted',
    particleCount: 130,
    migrationStrideFloats: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
    migrationEpoch: 11,
    migrationBuffer: { label: 'retained-phase-volume-migration-buffer' }
  };
  const proposal = await runSchroederPhaseVolumeSplitMergeProposalWebGpu({
    device,
    phaseVolumeMigration,
    proposalEpoch: 12,
    stateFamilyId: 4
  });

  assert.equal(proposal.schema, ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_EXECUTION_SCHEMA);
  assert.equal(
    proposal.phaseVolumeSplitMergeProposalSchema,
    ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_SCHEMA
  );
  assert.equal(proposal.status, 'schroeder-phase-volume-split-merge-proposal-submitted');
  assert.equal(proposal.sourcePhaseVolumeMigrationSchema, ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA);
  assert.equal(proposal.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(proposal.fullReadbackPerformed, false);
  assert.equal(proposal.fullParticleReadbackPerformed, false);
  assert.equal(proposal.fullParticleReadbackFree, true);
  assert.equal(proposal.readbackTelemetryComplete, true);
  assert.equal(proposal.mapAsyncCount, 0);
  assert.equal(proposal.readbackBytes, 0);
  assert.equal(proposal.hostQueueFenceCount, 1);
  assert.equal(proposal.normalHotLoopReadbackFree, false);
  assert.equal(proposal.retainedProposalBuffer, true);
  assert.ok(proposal.proposalBuffer);
  assert.equal(proposal.proposalBuffer.destroyed, false);
  assert.equal(proposal.proposalBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(proposal.proposalRows.length, 0);
  assert.equal(proposal.proposalMode, 'proposal-only-no-particle-mutation');
  assert.equal(proposal.stateMutationRequired, false);
  assert.equal(proposal.stateMutationStatus, 'proposal-buffer-submitted-no-particle-mutation');
  assert.equal(
    proposal.stateAuthorityStatus,
    'state-manager-admission-required-before-any-particle-count-mutation'
  );
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => (
    module.code.includes('SchroederPhaseVolumeSplitMergeProposalParams')
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('proposal-readback')),
    false
  );
});

test('Schroeder phase-volume split/merge apply blocks without admission and dispatches no work', async () => {
  const device = createFakeWebGpuDevice();
  const phaseVolumeSplitMergeProposal = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-split-merge-proposal-submitted',
    migrationRowCount: 130,
    proposalStrideFloats: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS,
    proposalBuffer: { label: 'retained-phase-volume-split-merge-proposal-buffer' }
  };
  const apply = await runSchroederPhaseVolumeSplitMergeApplyWebGpu({
    device,
    phaseVolumeSplitMergeProposal
  });

  assert.equal(apply.schema, ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA);
  assert.equal(apply.phaseVolumeSplitMergeApplySchema, ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_SCHEMA);
  assert.equal(apply.status, 'schroeder-phase-volume-split-merge-apply-blocked-admission-required');
  assert.equal(apply.phaseVolumeSplitMergeAdmissionApproved, false);
  assert.equal(apply.retainedApplyBuffer, false);
  assert.equal(apply.applyBufferByteLength, 0);
  assert.equal(apply.applyRows.length, 0);
  assert.equal(apply.stateMutationRequired, false);
  assert.equal(apply.stateMutationStatus, 'blocked-phase-volume-split-merge-admission-required');
  assert.deepEqual(device.dispatches, []);
});

test('Schroeder phase-volume split/merge apply consumes retained proposals after admission without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const phaseVolumeSplitMergeProposal = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-split-merge-proposal-submitted',
    migrationRowCount: 130,
    proposalStrideFloats: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_FLOATS,
    proposalEpoch: 11,
    stateFamilyId: 4,
    proposalBuffer: { label: 'retained-phase-volume-split-merge-proposal-buffer' }
  };
  const apply = await runSchroederPhaseVolumeSplitMergeApplyWebGpu({
    device,
    phaseVolumeSplitMergeProposal,
    phaseVolumeSplitMergeAdmission: approvedPhaseVolumeSplitMergeAdmission({ rowCount: 130 }),
    applyEpoch: 12,
    stateFamilyId: 4,
    residualTolerance: 1e-5
  });

  assert.equal(apply.schema, ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA);
  assert.equal(apply.phaseVolumeSplitMergeApplySchema, ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_SCHEMA);
  assert.equal(apply.status, 'schroeder-phase-volume-split-merge-apply-submitted');
  assert.equal(
    apply.sourcePhaseVolumeSplitMergeProposalSchema,
    ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_EXECUTION_SCHEMA
  );
  assert.equal(apply.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(apply.fullReadbackPerformed, false);
  assert.equal(apply.fullParticleReadbackPerformed, false);
  assert.equal(apply.normalHotLoopReadbackFree, true);
  assert.equal(apply.phaseVolumeSplitMergeAdmissionApproved, true);
  assert.equal(apply.retainedApplyBuffer, true);
  assert.ok(apply.applyBuffer);
  assert.equal(apply.applyBuffer.destroyed, false);
  assert.equal(apply.applyBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(apply.applyRows.length, 0);
  assert.equal(apply.applyMode, 'state-manager-admitted-split-merge-intent');
  assert.equal(
    apply.particleStorageMutationStatus,
    'deferred-to-state-manager-particle-storage-allocator'
  );
  assert.equal(apply.stateMutationRequired, true);
  assert.equal(apply.stateMutationStatus, 'phase-volume-split-merge-apply-buffer-submitted');
  assert.equal(
    apply.stateAuthorityStatus,
    'state-manager-admitted-phase-volume-split-merge-apply-materialized'
  );
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => (
    module.code.includes('SchroederPhaseVolumeSplitMergeApplyParams')
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('apply-readback')),
    false
  );
});

test('Schroeder particle-storage allocation blocks without admission and dispatches no work', async () => {
  const device = createFakeWebGpuDevice();
  const phaseVolumeSplitMergeApply = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-split-merge-apply-submitted',
    proposalRowCount: 130,
    applyStrideFloats: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS,
    applyBuffer: { label: 'retained-phase-volume-split-merge-apply-buffer' }
  };
  const allocation = await runSchroederParticleStorageAllocationWebGpu({
    device,
    phaseVolumeSplitMergeApply
  });

  assert.equal(allocation.schema, ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA);
  assert.equal(allocation.particleStorageAllocationSchema, ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_SCHEMA);
  assert.equal(allocation.status, 'schroeder-particle-storage-allocation-blocked-admission-required');
  assert.equal(allocation.particleStorageAllocatorAdmissionApproved, false);
  assert.equal(allocation.retainedAllocationBuffer, false);
  assert.equal(allocation.allocationBufferByteLength, 0);
  assert.equal(allocation.allocationRows.length, 0);
  assert.equal(allocation.stateMutationRequired, false);
  assert.equal(allocation.stateMutationStatus, 'blocked-particle-storage-allocator-admission-required');
  assert.deepEqual(device.dispatches, []);
});

test('Schroeder particle-storage allocation consumes admitted apply rows without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const phaseVolumeSplitMergeApply = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-split-merge-apply-submitted',
    proposalRowCount: 130,
    applyStrideFloats: SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_FLOATS,
    applyEpoch: 11,
    stateFamilyId: 4,
    applyBuffer: { label: 'retained-phase-volume-split-merge-apply-buffer' }
  };
  const allocation = await runSchroederParticleStorageAllocationWebGpu({
    device,
    phaseVolumeSplitMergeApply,
    particleStorageAllocatorAdmission: approvedParticleStorageAllocatorAdmission({
      rowCount: 130,
      currentParticleCapacity: 192,
      requiredParticleCapacity: 160
    }),
    allocatorEpoch: 12,
    stateFamilyId: 4,
    currentParticleCapacity: 192,
    requiredParticleCapacity: 160
  });

  assert.equal(allocation.schema, ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA);
  assert.equal(allocation.particleStorageAllocationSchema, ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_SCHEMA);
  assert.equal(allocation.status, 'schroeder-particle-storage-allocation-submitted');
  assert.equal(
    allocation.sourcePhaseVolumeSplitMergeApplySchema,
    ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA
  );
  assert.equal(allocation.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(allocation.fullReadbackPerformed, false);
  assert.equal(allocation.fullParticleReadbackPerformed, false);
  assert.equal(allocation.normalHotLoopReadbackFree, true);
  assert.equal(allocation.particleStorageAllocatorAdmissionApproved, true);
  assert.equal(allocation.retainedAllocationBuffer, true);
  assert.ok(allocation.allocationBuffer);
  assert.equal(allocation.allocationBuffer.destroyed, false);
  assert.equal(allocation.allocationBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(allocation.allocationRows.length, 0);
  assert.equal(allocation.allocationMode, 'state-manager-admitted-slot-allocation-intents');
  assert.equal(allocation.slotAssignmentStatus, 'sentinel-slot-indices-await-free-list-compaction');
  assert.equal(allocation.currentParticleCapacity, 192);
  assert.equal(allocation.requiredParticleCapacity, 160);
  assert.equal(allocation.stateMutationRequired, true);
  assert.equal(allocation.stateMutationStatus, 'particle-storage-allocation-buffer-submitted');
  assert.equal(
    allocation.stateAuthorityStatus,
    'state-manager-admitted-particle-storage-allocation-materialized'
  );
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => (
    module.code.includes('SchroederParticleStorageAllocationParams')
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('allocation-readback')),
    false
  );
});

test('Schroeder particle-storage slot assignment blocks without admission and dispatches no work', async () => {
  const device = createFakeWebGpuDevice();
  const particleStorageAllocation = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA,
    status: 'schroeder-particle-storage-allocation-submitted',
    applyRowCount: 130,
    allocationStrideFloats: SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS,
    allocationBuffer: { label: 'retained-particle-storage-allocation-buffer' }
  };
  const particleStorageFreeList = createSchroederParticleStorageFreeListPlan({
    slotCapacity: 192,
    availableSlotCount: 160
  });
  const assignment = await runSchroederParticleStorageSlotAssignmentWebGpu({
    device,
    particleStorageAllocation,
    particleStorageFreeList
  });

  assert.equal(assignment.schema, ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(assignment.particleStorageSlotAssignmentSchema, ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_SCHEMA);
  assert.equal(assignment.status, 'schroeder-particle-storage-slot-assignment-blocked-admission-required');
  assert.equal(assignment.particleStorageSlotAssignmentAdmissionApproved, false);
  assert.equal(assignment.retainedSlotAssignmentBuffer, false);
  assert.equal(assignment.slotAssignmentBufferByteLength, 0);
  assert.equal(assignment.slotAssignmentRows.length, 0);
  assert.deepEqual(device.dispatches, []);
});

test('Schroeder particle-storage slot assignment consumes allocation rows and free list without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const particleStorageAllocation = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA,
    status: 'schroeder-particle-storage-allocation-submitted',
    applyRowCount: 130,
    allocationStrideFloats: SCHROEDER_PARTICLE_STORAGE_ALLOCATION_FLOATS,
    allocatorEpoch: 11,
    stateFamilyId: 4,
    allocationBuffer: { label: 'retained-particle-storage-allocation-buffer' }
  };
  const particleStorageFreeList = createSchroederParticleStorageFreeListPlan({
    baseSlotIndex: 32,
    slotCapacity: 192,
    availableSlotCount: 160,
    maxSlotsPerRow: 2
  });
  const assignment = await runSchroederParticleStorageSlotAssignmentWebGpu({
    device,
    particleStorageAllocation,
    particleStorageFreeList,
    particleStorageSlotAssignmentAdmission: approvedParticleStorageSlotAssignmentAdmission({ rowCount: 130 }),
    assignmentEpoch: 12,
    stateFamilyId: 4
  });

  assert.equal(assignment.schema, ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(assignment.particleStorageSlotAssignmentSchema, ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_SCHEMA);
  assert.equal(assignment.status, 'schroeder-particle-storage-slot-assignment-submitted');
  assert.equal(assignment.sourceParticleStorageAllocationSchema, ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA);
  assert.equal(assignment.sourceParticleStorageFreeListSchema, ULG_SCHROEDER_PARTICLE_STORAGE_FREE_LIST_SCHEMA);
  assert.equal(assignment.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(assignment.fullReadbackPerformed, false);
  assert.equal(assignment.fullParticleReadbackPerformed, false);
  assert.equal(assignment.normalHotLoopReadbackFree, true);
  assert.equal(assignment.particleStorageSlotAssignmentAdmissionApproved, true);
  assert.equal(assignment.retainedSlotAssignmentBuffer, true);
  assert.ok(assignment.slotAssignmentBuffer);
  assert.equal(assignment.slotAssignmentBuffer.destroyed, false);
  assert.equal(assignment.slotAssignmentBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(assignment.slotAssignmentRows.length, 0);
  assert.equal(assignment.assignmentMode, 'state-manager-admitted-free-list-slot-assignment');
  assert.equal(assignment.stateMutationStatus, 'particle-storage-slot-assignment-buffer-submitted');
  assert.equal(
    assignment.stateAuthorityStatus,
    'state-manager-admitted-particle-storage-slot-assignment-materialized'
  );
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => (
    module.code.includes('SchroederParticleStorageSlotAssignmentParams')
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('slot-assignment-readback')),
    false
  );
});

test('Schroeder particle-storage materialization blocks without admission and dispatches no work', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const particleStorageSlotAssignment = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-particle-storage-slot-assignment-submitted',
    allocationRowCount: 130,
    slotAssignmentStrideFloats: SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS,
    slotAssignmentBuffer: { label: 'retained-particle-storage-slot-assignment-buffer' }
  };
  const materialization = await runSchroederParticleStorageMaterializationWebGpu({
    device,
    ...buffers,
    particleStorageSlotAssignment
  });

  assert.equal(materialization.schema, ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA);
  assert.equal(
    materialization.particleStorageMaterializationSchema,
    ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_SCHEMA
  );
  assert.equal(materialization.status, 'schroeder-particle-storage-materialization-blocked-admission-required');
  assert.equal(materialization.particleStorageMaterializationAdmissionApproved, false);
  assert.equal(materialization.retainedParticleBuffers, false);
  assert.equal(materialization.retainedMaterializationBuffer, false);
  assert.equal(materialization.materializationBufferByteLength, 0);
  assert.equal(materialization.materializationRows.length, 0);
  assert.equal(materialization.fullParticleReadbackFree, true);
  assert.equal(materialization.readbackTelemetryComplete, true);
  assert.deepEqual(materialization.readbackTelemetryUnknownSources, []);
  assert.equal(materialization.mapAsyncCount, 0);
  assert.equal(materialization.readbackBytes, 0);
  assert.equal(materialization.hostQueueFenceCount, 0);
  assert.equal(materialization.normalHotLoopReadbackFree, true);
  assert.equal(materialization.stateMutationRequired, false);
  assert.equal(
    materialization.stateMutationStatus,
    'blocked-particle-storage-materialization-admission-required'
  );
  assert.deepEqual(device.dispatches, []);
});

test('Schroeder particle-storage materialization rejects a device below its identity-aware storage-binding limit', async () => {
  const device = createFakeWebGpuDevice();
  device.limits = { maxStorageBuffersPerShaderStage: 8 };
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const particleStorageSlotAssignment = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-particle-storage-slot-assignment-submitted',
    allocationRowCount: 3,
    slotAssignmentStrideFloats: SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS,
    slotAssignmentBuffer: { label: 'retained-particle-storage-slot-assignment-buffer' }
  };

  await assert.rejects(
    runSchroederParticleStorageMaterializationWebGpu({
      device,
      ...buffers,
      particleStorageSlotAssignment,
      particleStorageMaterializationAdmission: approvedParticleStorageMaterializationAdmission({
        rowCount: 3,
        requiredParticleCapacity: 3
      }),
      outputParticleCapacity: 3
    }),
    /requires 10 storage buffers per shader stage/
  );
  assert.deepEqual(device.dispatches, []);
  assert.deepEqual(device.createdBuffers, []);
});

test('Schroeder particle-storage materialization writes retained particle buffers without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const particleStorageSlotAssignment = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-particle-storage-slot-assignment-submitted',
    allocationRowCount: 130,
    slotAssignmentStrideFloats: SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_FLOATS,
    assignmentEpoch: 12,
    stateFamilyId: 4,
    slotAssignmentBuffer: { label: 'retained-particle-storage-slot-assignment-buffer' }
  };
  const materialization = await runSchroederParticleStorageMaterializationWebGpu({
    device,
    ...buffers,
    particleStorageSlotAssignment,
    particleStorageMaterializationAdmission: approvedParticleStorageMaterializationAdmission({
      rowCount: 130,
      requiredParticleCapacity: 8
    }),
    outputParticleCapacity: 8,
    materializationEpoch: 13,
    stateFamilyId: 4
  });

  assert.equal(materialization.schema, ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA);
  assert.equal(
    materialization.particleStorageMaterializationSchema,
    ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_SCHEMA
  );
  assert.equal(materialization.status, 'schroeder-particle-storage-materialization-submitted');
  assert.equal(
    materialization.sourceParticleStorageSlotAssignmentSchema,
    ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA
  );
  assert.equal(materialization.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(materialization.fullReadbackPerformed, false);
  assert.equal(materialization.fullParticleReadbackPerformed, false);
  assert.equal(materialization.fullParticleReadbackFree, true);
  assert.equal(materialization.readbackTelemetryComplete, true);
  assert.deepEqual(materialization.readbackTelemetryUnknownSources, []);
  assert.equal(materialization.mapAsyncCount, 0);
  assert.equal(materialization.readbackBytes, 0);
  assert.equal(materialization.hostQueueFenceCount, 0);
  assert.equal(materialization.normalHotLoopReadbackFree, true);
  assert.equal(materialization.particleStorageMaterializationAdmissionApproved, true);
  assert.equal(materialization.retainedParticleBuffers, true);
  assert.equal(materialization.retainedMaterializationBuffer, true);
  assert.ok(materialization.particleStateBuffer);
  assert.ok(materialization.particleThermoBuffer);
  assert.ok(materialization.particleMechanicsBuffer);
  assert.ok(materialization.particleIdentityBuffer);
  assert.ok(materialization.materializationBuffer);
  assert.equal(materialization.particleStateBuffer.destroyed, false);
  assert.equal(materialization.particleThermoBuffer.destroyed, false);
  assert.equal(materialization.particleMechanicsBuffer.destroyed, false);
  assert.equal(materialization.particleIdentityBuffer.destroyed, false);
  assert.equal(materialization.materializationBuffer.destroyed, false);
  assert.equal(materialization.stateBufferByteLength, 8 * 8 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(materialization.thermoBufferByteLength, 8 * 12 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(materialization.mechanicsBufferByteLength, 8 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(materialization.identityBufferByteLength, 8 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(materialization.identityStrideBytes, Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(materialization.materializationBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(materialization.materializationRows.length, 0);
  assert.equal(materialization.materializationMode, 'state-manager-admitted-particle-buffer-materialization');
  assert.equal(materialization.replacementPolicy, 'retained-output-buffers-await-state-manager-swap');
  assert.equal(
    materialization.stateMutationStatus,
    'particle-storage-materialization-buffer-submitted'
  );
  assert.equal(
    materialization.stateAuthorityStatus,
    'state-manager-admitted-particle-storage-materialization-materialized'
  );
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => (
    module.code.includes('SchroederParticleStorageMaterializationParams')
  )));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('materialization-readback')),
    false
  );
});

test('Schroeder phase-volume level update consumes retained migration rows after admission without default readback', async () => {
  const device = createFakeWebGpuDevice();
  const phaseVolumeMigration = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-migration-submitted',
    particleCount: 130,
    migrationStrideFloats: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
    migrationBuffer: { label: 'retained-phase-volume-migration-buffer' }
  };
  const update = await runSchroederPhaseVolumeLevelUpdateWebGpu({
    device,
    phaseVolumeMigration,
    phaseVolumeMigrationAdmission: approvedPhaseVolumeMigrationAdmission({ rowCount: 130 }),
    migrationEpoch: 11
  });

  assert.equal(update.schema, ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA);
  assert.equal(update.phaseVolumeLevelUpdateSchema, ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA);
  assert.equal(update.status, 'schroeder-phase-volume-level-update-submitted');
  assert.equal(update.sourcePhaseVolumeMigrationSchema, ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA);
  assert.equal(update.phaseVolumeMigrationAdmissionApproved, true);
  assert.equal(update.phaseVolumeMigrationAdmissionStatus, 'schroeder-phase-volume-migration-admission-approved');
  assert.equal(update.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(update.fullReadbackPerformed, false);
  assert.equal(update.fullParticleReadbackPerformed, false);
  assert.equal(update.fullParticleReadbackFree, true);
  assert.equal(update.readbackTelemetryComplete, true);
  assert.equal(update.mapAsyncCount, 0);
  assert.equal(update.readbackBytes, 0);
  assert.equal(update.hostQueueFenceCount, 1);
  assert.equal(update.normalHotLoopReadbackFree, false);
  assert.equal(update.retainedLevelUpdateBuffer, true);
  assert.ok(update.levelUpdateBuffer);
  assert.equal(update.levelUpdateBuffer.destroyed, false);
  assert.equal(update.levelUpdateBufferByteLength, 130 * 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(update.levelUpdateRows.length, 0);
  assert.equal(update.outputCompaction, 'one-admitted-phase-volume-level-update-row-per-migration-row');
  assert.equal(update.conservativeTransferStatus, 'phase-volume-level-update-submitted');
  assert.equal(update.stateMutationStatus, 'phase-volume-level-update-buffer-submitted');
  assert.equal(update.stateAuthorityStatus, 'state-manager-admitted-phase-volume-level-update-materialized');
  assert.deepEqual(device.dispatches, [[3, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederPhaseVolumeLevelUpdateParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder phase-volume diagnostic summary remains fully resident when compact readback is disabled', async () => {
  const device = createFakeWebGpuDevice();
  const phaseVolumeLevelUpdate = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-level-update-submitted',
    migrationRowCount: 130,
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    migrationEpoch: 11,
    levelUpdateBuffer: { label: 'retained-phase-volume-level-update-buffer' }
  };
  const summary = await runSchroederPhaseVolumeDiagnosticSummaryWebGpu({
    device,
    phaseVolumeLevelUpdate,
    phaseVolumeExpandThreshold: 64,
    readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
  });

  assert.equal(summary.status, 'schroeder-phase-volume-diagnostic-summary-submitted');
  assert.equal(summary.readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(summary.compactSummaryReadbackPerformed, false);
  assert.equal(summary.fullReadbackPerformed, false);
  assert.equal(summary.fullParticleReadbackPerformed, false);
  assert.equal(summary.fullParticleReadbackFree, true);
  assert.equal(summary.readbackTelemetryComplete, true);
  assert.equal(summary.mapAsyncCount, 0);
  assert.equal(summary.readbackBytes, 0);
  assert.equal(summary.hostQueueFenceCount, 1);
  assert.equal(summary.deferredCleanupHostQueueFenceCount, 1);
  assert.equal(summary.unclassifiedHostQueueFenceCount, 0);
  assert.equal(summary.normalHotLoopReadbackFree, false);
  assert.equal(summary.productionHotLoopHostDependencyFree, true);
  assert.equal(summary.summaryRows.length, 0);
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('readback')),
    false
  );
});

test('Schroeder phase-volume diagnostic summary consumes admitted level updates with compact readback', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const phaseVolumeLevelUpdate = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-level-update-submitted',
    migrationRowCount: 130,
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    migrationEpoch: 11,
    levelUpdateBuffer: { label: 'retained-phase-volume-level-update-buffer' }
  };
  const summary = await runSchroederPhaseVolumeDiagnosticSummaryWebGpu({
    device,
    phaseVolumeLevelUpdate,
    phaseVolumeExpandThreshold: 64
  });

  assert.equal(summary.schema, ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA);
  assert.equal(summary.phaseVolumeDiagnosticSummarySchema, ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_SCHEMA);
  assert.equal(summary.status, 'schroeder-phase-volume-diagnostic-summary-submitted');
  assert.equal(summary.sourcePhaseVolumeLevelUpdateSchema, ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA);
  assert.equal(summary.readbackMode, SCHROEDER_COMPACT_PHASE_VOLUME_DIAGNOSTIC_READBACK_MODE);
  assert.equal(summary.compactSummaryReadbackPerformed, true);
  assert.equal(summary.fullReadbackPerformed, false);
  assert.equal(summary.fullParticleReadbackPerformed, false);
  assert.equal(summary.fullParticleReadbackFree, true);
  assert.equal(summary.readbackTelemetryComplete, true);
  assert.equal(summary.mapAsyncCount, 1);
  assert.equal(summary.readbackBytes, summary.summaryByteLength);
  assert.equal(summary.hostQueueFenceCount, 1);
  assert.equal(summary.finalDiagnosticMapAsyncCount, 1);
  assert.equal(
    summary.finalDiagnosticReadbackBytes,
    summary.summaryByteLength
  );
  assert.equal(summary.deferredCleanupHostQueueFenceCount, 1);
  assert.equal(summary.unclassifiedMapAsyncCount, 0);
  assert.equal(summary.unclassifiedReadbackBytes, 0);
  assert.equal(summary.unclassifiedHostQueueFenceCount, 0);
  assert.equal(summary.normalHotLoopReadbackFree, false);
  assert.equal(summary.productionHotLoopHostDependencyFree, true);
  assert.equal(summary.retainedSummaryBuffer, true);
  assert.ok(summary.summaryBuffer);
  assert.equal(summary.summaryBuffer.destroyed, false);
  assert.equal(summary.summaryBufferByteLength, 32 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(summary.summaryRows.length, 32);
  assert.equal(summary.diagnosticStatus, 'phase-volume-diagnostics-submitted');
  assert.equal(summary.visibleStressCaseStatus, 'water-to-steam-level-migration-diagnostics-submitted');
  assert.equal(summary.refinePressurePolicy, 'compact-summary-count-and-reason-mask-no-particle-readback');
  assert.deepEqual(summary.refinePressureReasonBits, SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS);
  assert.equal(summary.conservativeTransferStatus, 'diagnostic-summary-only-no-conservative-transfer');
  assert.equal(summary.stateMutationStatus, 'diagnostic-summary-only-no-state-mutation');
  assert.deepEqual(device.dispatches, [[1, 1, 1]]);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederPhaseVolumeDiagnosticSummaryParams')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('refine_pressure_count')));
});

test('Schroeder same-level mechanics runs SS prepasses before dense resident backend', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const spatialEpochGeneration = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    status: 'schroeder-spatial-epoch-generation-submitted',
    ready: true,
    selected: true,
    source: { sourceCount: 3, phaseVolumeAssignmentOverlayEnabled: false },
    execution: {
      schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
      submitPerformed: true,
      directoryBuffer: { label: 'retained-spatial-directory' },
      generationId: 17,
      storageGeneration: 23,
      positionEpoch: 29,
      topologyEpoch: 31,
      deviceOrdinal: 37,
      laneOrdinal: 41,
      leaseToken: 43,
      sourceFamilyId: 47,
      physicsTick: 53,
      physicsSubstep: 59,
      chartEpoch: 61,
      levelEpoch: 67,
      supportEpoch: 71
    },
    directoryBuildCount: 1,
    privateLookupBuildCount: 0,
    releaseScheduled: false,
    fullParticleReadbackFree: true,
    ...createGpuReadbackTelemetry({
      scope: 'schroeder-same-level-test-spatial-epoch-generation'
    })
  };
  const continuationStateBuffer = tagWebGpuBufferDevice(
    device.createBuffer({
      label: 'resident-step-stubbed-state',
      size: buffers.sphParticleState.state.byteLength,
      usage: 128
    }),
    device
  );
  const continuationThermoBuffer = tagWebGpuBufferDevice(
    device.createBuffer({
      label: 'resident-step-stubbed-thermo',
      size: buffers.sphParticleState.thermo.byteLength,
      usage: 128
    }),
    device
  );
  const continuationMechanicsBuffer = tagWebGpuBufferDevice(
    device.createBuffer({
      label: 'resident-step-stubbed-mechanics',
      size: buffers.mlsMpmParticleState.mechanics.byteLength,
      usage: 128
    }),
    device
  );
  const residentStepRunner = async (options) => {
    calls.push(options);
    return {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
      status: 'resident-step-stubbed',
      gridSpacingM: options.gridSpacingM,
      readbackMode: options.readbackMode,
      schroederSelectedLevel: options.schroederSelectedLevel,
      hasActiveNodeList: Boolean(options.schroederActiveNodeList),
      hasLawQueue: Boolean(options.schroederLawQueue),
      hasLawNeighborCandidates: Boolean(options.schroederLawNeighborCandidates),
      hasCrossLevelCoupling: Boolean(options.schroederCrossLevelCoupling),
      hasConservationSummary: Boolean(options.schroederConservationSummary),
      hasCrossLevelTransfer: Boolean(options.schroederCrossLevelTransfer),
      hasCrossLevelStateDelta: Boolean(options.schroederCrossLevelStateDelta),
      hasCrossLevelStateDeltaMerge: Boolean(options.schroederCrossLevelStateDeltaMerge),
      hasHierarchyAggregate: Boolean(options.schroederHierarchyAggregate),
      hasHierarchyAggregateNode: Boolean(options.schroederHierarchyAggregateNode),
      hasPhaseVolumeMigration: Boolean(options.schroederPhaseVolumeMigration),
      hasPhaseVolumeSplitMergeProposal: Boolean(options.schroederPhaseVolumeSplitMergeProposal),
      hasPhaseVolumeSplitMergeApply: Boolean(options.schroederPhaseVolumeSplitMergeApply),
      hasPhaseVolumeLevelUpdate: Boolean(options.schroederPhaseVolumeLevelUpdate),
      hasPhaseVolumeDiagnosticSummary: Boolean(options.schroederPhaseVolumeDiagnosticSummary),
      fuseNoFullResidentMechanics: options.fuseNoFullResidentMechanics,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      residentContinuationReady: true,
      nextParticleUploads: {
        sphParticleUpload: {
          particleCount: buffers.sphParticleState.particleCount,
          stateBuffer: continuationStateBuffer,
          thermoBuffer: continuationThermoBuffer
        },
        mlsMpmParticleUpload: {
          particleCount: buffers.mlsMpmParticleState.particleCount,
          mechanicsBuffer: continuationMechanicsBuffer
        }
      },
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-same-level-test-resident-step'
      })
    };
  };
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 4,
    tileCellCount: 4,
    spatialEpochGeneration,
    residentStepRunner
  });

  assert.equal(result.schema, ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA);
  assert.equal(result.sameLevelMechanicsSchema, ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA);
  assert.equal(result.status, 'schroeder-same-level-mechanics-submitted');
  assert.equal(result.selectedLevel, 2);
  assert.equal(result.mechanicsGridSpacingM, 1);
  assert.equal(
    result.normalHotLoopReadbackFree,
    false,
    JSON.stringify({
      readbackTelemetryComplete: result.readbackTelemetryComplete,
      mapAsyncCount: result.mapAsyncCount,
      readbackBytes: result.readbackBytes,
      hostQueueFenceCount: result.hostQueueFenceCount,
      readbackTelemetryUnknownSources: result.readbackTelemetryUnknownSources
    })
  );
  assert.equal(result.readbackTelemetryComplete, true);
  assert.equal(result.mapAsyncCount, 0);
  assert.equal(result.readbackBytes, 0);
  assert.equal(
    result.hostQueueFenceCount,
    2,
    'the standalone non-paired hierarchy reports both deferred prepass cleanup fences'
  );
  assert.equal(result.deferredCleanupHostQueueFenceCount, 2);
  assert.equal(result.unclassifiedHostQueueFenceCount, 0);
  assert.equal(result.productionHotLoopHostDependencyFree, true);
  assert.equal(result.fullParticleReadbackFree, true);
  assert.equal(result.residentContinuationReady, true);
  assert.equal(result.levelAssignment.retainedAssignmentBuffer, true);
  assert.equal(result.activeNodeList.retainedActiveNodeBuffer, true);
  assert.equal(
    result.localRetainedRenderBuffers.schema,
    'peercompute.ulg.schroeder-local-retained-render-buffer-resolver.v0'
  );
  assert.equal(result.localRetainedRenderBuffers.status, 'schroeder-local-retained-render-buffers-ready');
  assert.equal(result.localRetainedRenderBuffers.sameDeviceOnly, true);
  assert.equal(result.localRetainedRenderBuffers.peerComputePortable, false);
  assert.equal(result.localRetainedRenderBuffers.rawGpuBufferTransferAllowed, false);
  assert.equal(result.localRetainedRenderBuffers.frameCopyReadbackRequired, false);
  assert.equal(result.localRetainedRenderBuffers.fullParticleReadbackRequired, false);
  assert.deepEqual(result.localRetainedRenderBuffers.retainedBufferRefs, [
    'schroeder-active-node-list:render-lod-leaf-source'
  ]);
  assert.equal(result.localRetainedRenderBuffers.buffers[0].retainedBufferRef, 'schroeder-active-node-list:render-lod-leaf-source');
  assert.ok(result.localRetainedRenderBuffers.buffers[0].buffer);
  assert.equal(result.localRetainedRenderBuffers.buffers[0].transferMode, 'same-device-local-resolver-no-peer-transfer');
  assert.equal(result.lawQueue.retainedLawQueueBuffer, true);
  assert.equal(result.lawQueue.activeNodeCount, 3);
  assert.equal(result.lawQueue.lawQueueStatus, 'local-law-queues-submitted');
  assert.equal(result.lawQueue.reactionScopeStatus, 'sedenion-scope-preserved-for-reaction-queue');
  assert.equal(result.lawQueue.stateMutationStatus, 'law-queue-buffer-submitted-no-state-mutation');
  assert.equal(result.lawNeighborCandidates.retainedNeighborCandidateBuffer, true);
  assert.equal(result.lawNeighborCandidates.lawQueueCount, 3);
  assert.equal(result.lawNeighborCandidates.neighborCandidateCount, 3 * DEFAULT_SCHROEDER_LAW_QUEUE_CANDIDATE_BUDGET);
  assert.equal(result.lawNeighborCandidates.outputCompaction, 'fixed-budget-law-neighbor-candidate-rows');
  assert.equal(result.crossLevelCoupling.retainedCrossLevelBuffer, true);
  assert.equal(result.crossLevelCoupling.crossLevelCandidateCount, 3);
  assert.equal(result.conservationSummary.retainedSummaryBuffer, true);
  assert.equal(result.conservationSummary.summaryRowCount, 1);
  assert.equal(result.conservationSummary.conservativeTransferStatus, 'summary-only-no-state-mutation');
  assert.equal(result.crossLevelTransfer.retainedTransferBuffer, true);
  assert.equal(result.crossLevelTransfer.crossLevelCandidateCount, 3);
  assert.equal(result.crossLevelTransfer.conservativeTransferStatus, 'transfer-rows-ready-no-state-mutation');
  assert.equal(result.crossLevelStateDelta.retainedStateDeltaBuffer, true);
  assert.equal(result.crossLevelStateDelta.crossLevelCandidateCount, 3);
  assert.equal(result.crossLevelStateDelta.conservativeTransferStatus, 'state-delta-ready-pending-admission');
  assert.equal(result.crossLevelStateDelta.stateMutationStatus, 'pending-state-delta-submitted-awaiting-admission');
  assert.equal(result.crossLevelStateDelta.stateAuthorityStatus, 'requires-state-manager-admission-before-authoritative-merge');
  assert.equal(result.crossLevelStateDeltaMerge, null);
  assert.equal(result.hierarchyAggregate, null);
  assert.equal(result.hierarchyAggregateNode, null);
  assert.equal(result.phaseVolumeMigration, null);
  assert.equal(result.phaseVolumeSplitMergeProposal, null);
  assert.equal(result.phaseVolumeSplitMergeApply, null);
  assert.equal(result.phaseVolumeLevelUpdate, null);
  assert.equal(result.phaseVolumeDiagnosticSummary, null);
  assert.equal(result.phaseVolumeDiagnosticSummary, null);
  assert.equal(result.phaseVolumeLevelUpdate, null);
  assert.equal(result.phaseVolumeMigration, null);
  assert.equal(result.residentStep.hasActiveNodeList, true);
  assert.equal(result.residentStep.hasLawQueue, true);
  assert.equal(result.residentStep.hasLawNeighborCandidates, true);
  assert.equal(result.residentStep.hasCrossLevelCoupling, true);
  assert.equal(result.residentStep.hasConservationSummary, true);
  assert.equal(result.residentStep.hasCrossLevelTransfer, true);
  assert.equal(result.residentStep.hasCrossLevelStateDelta, true);
  assert.equal(result.residentStep.hasCrossLevelStateDeltaMerge, false);
  assert.equal(result.residentStep.hasHierarchyAggregate, false);
  assert.equal(result.residentStep.hasHierarchyAggregateNode, false);
  assert.equal(result.residentStep.hasPhaseVolumeMigration, false);
  assert.equal(result.residentStep.hasPhaseVolumeSplitMergeProposal, false);
  assert.equal(result.residentStep.hasPhaseVolumeSplitMergeApply, false);
  assert.equal(result.residentStep.hasPhaseVolumeLevelUpdate, false);
  assert.equal(result.residentStep.hasPhaseVolumeDiagnosticSummary, false);
  assert.equal(
    result.activeNodeConsumerStatus,
    'active-node-list-published-for-render-lod-and-spatial-directory-production'
  );
  assert.equal(
    result.spatialEpochConsumerStatus,
    'canonical-spatial-directory-forwarded-to-resident-p2g'
  );
  assert.equal(
    result.crossLevelCouplingStatus,
    'candidate-generation-submitted-not-yet-consumed-by-mls-mpm-grid-transfer'
  );
  assert.equal(result.conservationSummaryStatus, 'schroeder-conservation-summary-submitted');
  assert.equal(result.crossLevelTransferStatus, 'schroeder-cross-level-transfer-submitted');
  assert.equal(result.crossLevelStateDeltaStatus, 'schroeder-cross-level-state-delta-submitted');
  assert.equal(result.crossLevelStateDeltaMergeStatus, 'disabled-cross-level-state-delta-merge-admission-not-provided');
  assert.equal(result.hierarchyAggregateStatus, 'disabled-cross-level-state-delta-merge');
  assert.equal(result.hierarchyAggregateNodeStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.phaseVolumeMigrationStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.phaseVolumeSplitMergeProposalStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.phaseVolumeSplitMergeApplyStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.phaseVolumeLevelUpdateStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.phaseVolumeDiagnosticSummaryStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.phaseVolumeDiagnosticSummaryStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.phaseVolumeLevelUpdateStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.conservativeTransferStatus, 'state-delta-ready-pending-admission');
  assert.equal(result.stateMutationStatus, 'pending-state-delta-submitted-awaiting-admission');
  assert.equal(result.stateAuthorityStatus, 'requires-state-manager-admission-before-authoritative-merge');
  assert.equal(result.lawQueueStatus, 'schroeder-law-queue-submitted');
  assert.equal(
    result.lawQueueConsumerStatus,
    'law-queue-consumed-by-law-neighbor-candidates-and-forwarded-to-resident-backend'
  );
  assert.equal(result.lawNeighborCandidateStatus, 'schroeder-law-neighbor-candidates-submitted');
  assert.equal(
    result.lawNeighborCandidateConsumerStatus,
    'law-neighbor-candidates-forwarded-to-resident-backend'
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].gridSpacingM, 1);
  assert.equal(calls[0].schroederSelectedLevel, 2);
  assert.equal(calls[0].schroederSpatialEpochGeneration, spatialEpochGeneration);
  assert.equal(calls[0].canonicalSpatialRequired, true);
  assert.equal(calls[0].schroederLevelAssignment.schema, ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA);
  assert.equal(calls[0].readbackMode, SCHROEDER_NO_FULL_READBACK_MODE);
  assert.equal(calls[0].preferWebGpu, true);
  assert.equal(calls[0].schroederLawQueue.schema, ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA);
  assert.equal(
    calls[0].schroederLawNeighborCandidates.schema,
    ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA
  );
  assert.equal(calls[0].schroederCrossLevelCoupling.schema, ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA);
  assert.equal(calls[0].schroederConservationSummary.schema, ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA);
  assert.equal(calls[0].schroederCrossLevelTransfer.schema, ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA);
  assert.equal(calls[0].schroederCrossLevelStateDelta.schema, ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA);
  assert.equal(calls[0].schroederCrossLevelStateDeltaMerge, null);
  assert.equal(calls[0].schroederHierarchyAggregate, null);
  assert.equal(calls[0].schroederHierarchyAggregateNode, null);
  assert.equal(calls[0].schroederPhaseVolumeMigration, null);
  assert.equal(calls[0].schroederPhaseVolumeSplitMergeProposal, null);
  assert.equal(calls[0].schroederPhaseVolumeSplitMergeApply, null);
  assert.equal(calls[0].schroederPhaseVolumeLevelUpdate, null);
  assert.equal(calls[0].schroederPhaseVolumeDiagnosticSummary, null);
  assert.equal(calls[0].schroederPhaseVolumeDiagnosticSummary, null);
  assert.equal(calls[0].schroederPhaseVolumeLevelUpdate, null);
  assert.equal(calls[0].fuseNoFullResidentMechanics, true);
  assert.equal(calls[0].fuseNoFullResidentMechanicsActiveGrid, true);
  assert.deepEqual(
    device.dispatches,
    [[1, 1, 1], [1, 1, 1], [1, 1, 1], [3, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]
  );
  await result.schroederHierarchyArtifactRetirementPromise;
  let ledgerSummary = result.currentSchroederHierarchyArtifactLedgerSummary();
  assert.equal(ledgerSummary.retirementCompleted, true);
  assert.equal(ledgerSummary.pendingTransferCount, 1);
  assert.equal(ledgerSummary.unretiredOwnedResourceCount, 1);
  assert.equal(ledgerSummary.blockers.length, 0);
  await result.localRetainedRenderBuffers.destroyRetainedBuffers();
  ledgerSummary = result.currentSchroederHierarchyArtifactLedgerSummary();
  assert.equal(ledgerSummary.pendingTransferCount, 0);
  assert.equal(ledgerSummary.unretiredOwnedResourceCount, 0);
  assert.equal(result.schroederHierarchyArtifactLedgerSummary.unretiredOwnedResourceCount, 0);
});

test('Schroeder same-level mechanics releases an owned spatial generation when the resident step throws', async () => {
  const device = createFakeWebGpuDevice();
  const ownerDeviceId = webGpuDeviceId(device);
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: 3,
    storageGeneration: 5,
    stateBuffer: device.createBuffer({ label: 'failure-sph-state', size: 96, usage: 128 }),
    thermoBuffer: device.createBuffer({ label: 'failure-sph-thermo', size: 144, usage: 128 }),
    identityBuffer: device.createBuffer({ label: 'failure-sph-identity', size: 12, usage: 128 })
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: 3,
    storageGeneration: 5,
    mechanicsBuffer: device.createBuffer({ label: 'failure-mls-mechanics', size: 384, usage: 128 })
  };
  const spatialGenerationCalls = [];
  const releasedExecutions = [];
  let capturedTransaction = null;
  const generation = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    status: 'schroeder-spatial-epoch-generation-submitted',
    ready: true,
    selected: true,
    source: {
      ready: true,
      sourceCount: 3,
      phaseVolumeAssignmentOverlayEnabled: false
    },
    execution: {
      schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
      submitPerformed: true,
      deviceId: ownerDeviceId,
      directoryBuffer: device.createBuffer({
        label: 'owned-spatial-directory',
        size: 4096,
        usage: 128
      }),
      generationId: 23,
      buildOrdinal: 23,
      sortUniqueOrdinal: 23
    },
    runtime: {
      schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
      status: 'schroeder-spatial-epoch-gpu-runtime-ready',
      deviceId: ownerDeviceId,
      ownsExecution(execution) {
        return execution === generation.execution;
      },
      isExecutionSubmitted(execution) {
        return execution === generation.execution
          && execution.submitPerformed === true;
      },
      async releaseExecutionAfter(execution, submissionFence) {
        releasedExecutions.push({ execution, submissionFence });
        await submissionFence;
        return true;
      }
    },
    directoryBuildCount: 1,
    privateLookupBuildCount: 0,
    releaseScheduled: false
  };
  Object.defineProperty(generation.execution, 'ownerRuntime', {
    value: generation.runtime,
    enumerable: false,
    writable: false,
    configurable: false
  });
  const transactionAwareFailingRunner = async (options) => {
    capturedTransaction = options.schroederSpatialEpochTransaction;
    throw new Error('intentional resident-step failure after spatial directory creation');
  };
  transactionAwareFailingRunner.schroederSpatialEpochTransactionAware = true;

  await assert.rejects(
    () => runSchroederSameLevelMechanicsWebGpu({
      device,
      ...buffers,
      sphParticleUpload,
      mlsMpmParticleUpload,
      selectedLevel: 0,
      baseGridSpacingM: 0.25,
      enableLawQueue: false,
      enableCrossLevelCoupling: false,
      spatialEpochGenerationRunner: async (options) => {
        spatialGenerationCalls.push(options);
        const levelAssignment = options.levelAssignment;
        const epochIdentity = {
          storageGeneration: levelAssignment.storageGeneration,
          physicsTick: levelAssignment.physicsTick,
          physicsSubstep: levelAssignment.physicsSubstep,
          positionEpoch: levelAssignment.positionEpoch,
          topologyEpoch: levelAssignment.topologyEpoch,
          chartEpoch: levelAssignment.chartEpoch,
          levelEpoch: levelAssignment.levelEpoch,
          supportEpoch: levelAssignment.supportEpoch
        };
        Object.assign(generation.source, {
          sourceBuffer: levelAssignment.assignmentBuffer,
          sourceStateBuffer: levelAssignment.sourceStateBuffer,
          ...epochIdentity
        });
        Object.assign(generation.execution, {
          sourceBuffer: levelAssignment.assignmentBuffer,
          ...epochIdentity
        });
        assert.equal(options.selectedLevel, 0);
        assert.deepEqual(options.mechanicsGrid.gridDims.length, 3);
        return generation;
      },
      residentStepRunner: transactionAwareFailingRunner
    }),
    /intentional resident-step failure after spatial directory creation/
  );

  assert.equal(spatialGenerationCalls.length, 1);
  assert.ok(spatialGenerationCalls[0].levelAssignment.assignmentBuffer);
  assert.equal(
    spatialGenerationCalls[0].particleBufferSet,
    null,
    'single-level exact-near contact must not pay for an unused far-field aggregate'
  );
  assert.ok(capturedTransaction);
  const transactionSummary =
    summarizeSchroederSpatialEpochTransaction(capturedTransaction);
  assert.equal(transactionSummary.state, 'aborted');
  assert.match(transactionSummary.abortReason, /intentional resident-step failure/);
  assert.equal(transactionSummary.counters.commitCount, 0);
  assert.equal(transactionSummary.counters.releaseScheduleCount, 0);
  assert.equal(generation.releaseScheduled, true);
  assert.ok(generation.releasePromise);
  assert.equal(await generation.releasePromise, true);
  assert.equal(releasedExecutions.length, 1);
  assert.equal(releasedExecutions[0].execution, generation.execution);
  assert.equal(typeof releasedExecutions[0].submissionFence?.then, 'function');
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-released-after-final-consumer'
  );
  await Promise.resolve();
  const retainedLevelAssignments = device.createdBuffers.filter(
    (buffer) => buffer.label === 'ulg-schroeder-level-assignments-out'
  );
  const retainedActiveNodes = device.createdBuffers.filter(
    (buffer) => buffer.label === 'ulg-schroeder-active-nodes-out'
  );
  assert.equal(retainedLevelAssignments.length, 1);
  assert.equal(retainedActiveNodes.length, 1);
  assert.equal(retainedLevelAssignments[0].destroyCount, 1);
  assert.equal(retainedActiveNodes[0].destroyCount, 1);
});

test('Schroeder same-level mechanics reclaims a render transfer when final handoff attachment fails', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  let resolveGenerationFence;
  const generationFence = new Promise((resolve) => {
    resolveGenerationFence = resolve;
  });
  const spatialEpochGeneration = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    status: 'schroeder-spatial-epoch-generation-submitted',
    ready: true,
    selected: true,
    source: { sourceCount: 3, phaseVolumeAssignmentOverlayEnabled: false },
    execution: {
      schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
      submitPerformed: true,
      directoryBuffer: { label: 'borrowed-spatial-directory' }
    },
    releasePromise: generationFence
  };
  let capturedGeneration = null;

  await assert.rejects(
    () => runSchroederSameLevelMechanicsWebGpu({
      device,
      ...buffers,
      selectedLevel: 0,
      baseGridSpacingM: 0.25,
      enableLawQueue: false,
      enableCrossLevelCoupling: false,
      spatialEpochGeneration,
      residentStepRunner: async (options) => {
        capturedGeneration = options.schroederSpatialEpochGeneration;
        const residentStep = { status: 'resident-step-stubbed' };
        Object.defineProperty(residentStep, 'schroederHierarchyArtifactLedger', {
          value: null,
          configurable: false
        });
        return residentStep;
      }
    }),
    /Cannot redefine property: schroederHierarchyArtifactLedger/
  );

  assert.equal(capturedGeneration, spatialEpochGeneration);
  assert.equal(
    device.createdBuffers.find((buffer) => buffer.label === 'ulg-schroeder-active-nodes-out')
      ?.destroyCount,
    0
  );
  resolveGenerationFence(true);
  await capturedGeneration.releasePromise;
  await Promise.resolve();
  const retainedLevelAssignments = device.createdBuffers.filter(
    (buffer) => buffer.label === 'ulg-schroeder-level-assignments-out'
  );
  const retainedActiveNodes = device.createdBuffers.filter(
    (buffer) => buffer.label === 'ulg-schroeder-active-nodes-out'
  );
  assert.equal(retainedLevelAssignments.length, 1);
  assert.equal(retainedActiveNodes.length, 1);
  assert.equal(retainedLevelAssignments[0].destroyCount, 1);
  assert.equal(retainedActiveNodes[0].destroyCount, 1);
});

test('Schroeder final-transition policy rejects unsupported and ambiguous injected modes before GPU work', async () => {
  const device = createFakeWebGpuDevice();
  await assert.rejects(
    runSchroederSameLevelMechanicsWebGpu({
      device,
      spatialTransitionPolicy: 'unsupported-transition-policy'
    }),
    /requires a supported spatialTransitionPolicy/
  );
  await assert.rejects(
    runSchroederSameLevelMechanicsWebGpu({
      device,
      spatialTopologyTransitionRunner: async () => ({})
    }),
    /injected topology transition runner requires observed-compact-diagnostic/
  );
  assert.equal(device.createdBuffers.length, 0);
});

test('authoritative successor assignment credentials reject incomplete or unauthenticated tuples before GPU work', async () => {
  const cases = [
    {
      label: 'source-family only',
      options: { levelAssignmentSourceFamily: Object.freeze({}) },
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_LEVEL_ASSIGNMENT_ADMISSION'
    },
    {
      label: 'consumer lease only',
      options: { levelAssignmentSourceFamilyLease: Object.freeze({}) },
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_LEVEL_ASSIGNMENT_ADMISSION'
    },
    {
      label: 'family and lease without assignment',
      options: {
        levelAssignmentSourceFamily: Object.freeze({}),
        levelAssignmentSourceFamilyLease: Object.freeze({})
      },
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_LEVEL_ASSIGNMENT_ADMISSION'
    },
    {
      label: 'assignment and family without lease',
      options: {
        levelAssignment: Object.freeze({}),
        levelAssignmentSourceFamily: Object.freeze({})
      },
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_LEVEL_ASSIGNMENT_ADMISSION'
    },
    {
      label: 'authoritative assignment without exact successor credentials',
      options: { levelAssignment: Object.freeze({}) },
      code: 'ERR_SCHROEDER_TWO_LEVEL_SPATIAL_TRANSACTION_REQUIRED'
    }
  ];
  for (const { label, options, code } of cases) {
    const device = createFakeWebGpuDevice();
    const buffers = manualBuffers({
      particleCount: 3,
      smoothingLengthM: 0.25
    });
    let residentCallCount = 0;
    let generationCallCount = 0;
    await assert.rejects(
      runSchroederSameLevelMechanicsWebGpu({
        device,
        ...buffers,
        ...options,
        enableTwoLevelMechanics: true,
        twoLevelMechanicsAuthority: 'authoritative',
        spatialEpochGenerationRunner: async () => {
          generationCallCount += 1;
          throw new Error('must reject before generation');
        }
      }),
      (error) => {
        assert.equal(error?.code, code, label);
        return true;
      }
    );
    assert.equal(generationCallCount, 0, label);
    assert.equal(device.createdBuffers.length, 0, label);
    assert.equal(device.queue.submissions?.length ?? 0, 0, label);
  }
});

test('Schroeder single-level commits and fences a generation before successor publication', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const uploads = authoritativeUploadFamily(device, {
    particleCount: 3,
    storageGeneration: 5,
    physicsTick: 7,
    physicsSubstep: 11,
    positionEpoch: 13,
    topologyEpoch: 17,
    chartEpoch: 19,
    levelEpoch: 23,
    supportEpoch: 29,
    prefix: 'postcommit-successor'
  });
  let resolveGenerationFence;
  const generationFence = new Promise((resolve) => {
    resolveGenerationFence = resolve;
  });
  let fenceCallCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    fenceCallCount += 1;
    return generationFence;
  };
  let generation = null;
  let publicationCallCount = 0;
  const residentStepRunner = async (options) => {
    generation = options.schroederSpatialEpochGeneration;
    const readerInputs = {
      generation,
      sphParticleUpload: options.sphParticleUpload,
      mlsMpmParticleUpload: options.mlsMpmParticleUpload
    };
    admitSchroederSpatialEpochTransactionReader(
      options.schroederSpatialEpochTransaction,
      {
        readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
        phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
        ...readerInputs
      }
    );
    admitSchroederSpatialEpochTransactionReader(
      options.schroederSpatialEpochTransaction,
      {
        readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
        phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
        ...readerInputs
      }
    );
    sealSchroederSpatialEpochTransactionReaders(
      options.schroederSpatialEpochTransaction
    );
    return {
      status: 'resident-step-stubbed',
      nextParticleUploads: {
        sphParticleUpload: options.sphParticleUpload,
        mlsMpmParticleUpload: options.mlsMpmParticleUpload
      }
    };
  };
  residentStepRunner.schroederSpatialEpochTransactionAware = true;
  residentStepRunner.schroederSpatialTopologyTransitionAware = true;

  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    ...uploads,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableLawQueue: false,
    enableCrossLevelCoupling: false,
    enablePortableSummary: true,
    enablePressureInterfaceOwnerScope: false,
    residentStepRunner,
    spatialTransitionPolicy:
      SCHROEDER_SPATIAL_TRANSITION_POLICY_OBSERVED_COMPACT_DIAGNOSTIC,
    spatialSuccessorPublicationRunner(plan, { commitReceipt }) {
      publicationCallCount += 1;
      assert.ok(commitReceipt);
      assert.equal(generation.releaseScheduled, true);
      assert.equal(generation.execution.released, false);
      return publishPreparedSchroederSpatialSuccessorSourceFamily(
        plan,
        { commitReceipt }
      );
    }
  });

  assert.equal(publicationCallCount, 1);
  assert.equal(
    result.residentStep.schroederSpatialTopologyTransitionReceipt
      .topologyChanged,
    false
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.topologyEpoch,
    generation.execution.topologyEpoch,
    'the default compact topology comparison preserves an exact no-change epoch'
  );
  assert.equal(
    result.residentStep.schroederSpatialPositionTransitionReceipt
      .positionChanged,
    false
  );
  assert.equal(
    result.residentStep.schroederSpatialPositionTransitionReceipt
      .terminalQueueOutcomeObserved,
    true
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.positionEpoch,
    generation.execution.positionEpoch,
    'no resident position mutation and no topology mutation preserve position identity'
  );
  assert.equal(
    device.createdBuffers.filter(
      (buffer) => buffer.label === 'ulg-schroeder-level-assignments-out'
    ).length,
    2,
    'one lookup classifier plus one shared successor/render classifier'
  );
  assert.equal(
    result.finalRenderProxyBuildStatus,
    'final-render-proxy-published-from-exact-committed-successor'
  );
  assert.equal(result.finalRenderProxyPublished, true);
  assert.equal(
    result.finalRenderProxySourceFamily,
    result.schroederSpatialSuccessorSourceFamily
  );
  assert.equal(
    result.localRetainedRenderBuffers.sourceFamily,
    result.schroederSpatialSuccessorSourceFamily
  );
  assert.equal(
    result.localRetainedRenderBuffers.buffers.length,
    1,
    'the committed render resolver must quarantine stale aggregate/proxy families'
  );
  assert.equal(
    result.localRetainedRenderBuffers.buffers[0].sourceFamily,
    result.schroederSpatialSuccessorSourceFamily
  );
  assert.equal(
    result.localRetainedRenderBuffers.buffers[0].sourceEpochIdentity,
    result.schroederSpatialSuccessorSourceFamily.successorEpochIdentity
  );
  assert.equal(
    result.portableSummary.sourceFamily,
    result.schroederSpatialSuccessorSourceFamily
  );
  assert.equal(
    result.portableSummary.retainedRefs.every((entry) => (
      entry.sourceFamily === result.schroederSpatialSuccessorSourceFamily
      && entry.sourceEpochIdentity
        === result.schroederSpatialSuccessorSourceFamily.successorEpochIdentity
      && entry.finalContinuationAuthority === true
    )),
    true
  );
  const activeNodeBuffers = device.createdBuffers.filter(
    (buffer) => buffer.label === 'ulg-schroeder-active-nodes-out'
  );
  assert.equal(activeNodeBuffers.length, 2);
  assert.equal(
    result.localRetainedRenderBuffers.buffers[0].buffer,
    activeNodeBuffers[1],
    'the renderer must receive the post-mechanics active-node buffer'
  );
  assert.equal(result.spatialEpochGenerationReleaseScheduled, true);
  assert.equal(result.spatialEpochTransactionReleaseScheduled, true);
  assert.equal(fenceCallCount >= 1, true);
  assert.equal(generation.execution.released, false);
  resolveGenerationFence(true);
  assert.equal(await result.schroederSpatialEpochReleasePromise, true);
  assert.equal(generation.execution.released, true);
});

test('Schroeder default closure advances actual resident motion exactly once', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const uploads = authoritativeUploadFamily(device, {
    particleCount: 3,
    storageGeneration: 5,
    physicsTick: 7,
    positionEpoch: 13,
    topologyEpoch: 17,
    chartEpoch: 19,
    levelEpoch: 23,
    supportEpoch: 29,
    prefix: 'default-closure-motion'
  });
  uploads.sphParticleUpload.stateBuffer._masses = [1, 1, 1];
  uploads.sphParticleUpload.stateBuffer._positions = [
    [0, 0, 0],
    [1, 0, 0],
    [2, 0, 0]
  ];
  const finalStateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'default-closure-motion-final-state',
    size: uploads.sphParticleUpload.stateBufferByteLength,
    usage: 128
  }), device);
  finalStateBuffer._masses = [1, 1, 1];
  finalStateBuffer._positions = [
    [0, 0, 0],
    [1.125, 0, 0],
    [2, 0, 0]
  ];
  let generation = null;
  const residentStepRunner = async (options) => {
    generation = options.schroederSpatialEpochGeneration;
    const readerInputs = {
      generation,
      sphParticleUpload: options.sphParticleUpload,
      mlsMpmParticleUpload: options.mlsMpmParticleUpload
    };
    for (const [readerId, phase] of [
      [
        SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
        SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION
      ],
      [
        SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
        SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT
      ]
    ]) {
      admitSchroederSpatialEpochTransactionReader(
        options.schroederSpatialEpochTransaction,
        { readerId, phase, ...readerInputs }
      );
    }
    sealSchroederSpatialEpochTransactionReaders(
      options.schroederSpatialEpochTransaction
    );
    return {
      status: 'resident-step-actual-position-motion',
      nextParticleUploads: {
        sphParticleUpload: {
          ...options.sphParticleUpload,
          stateBuffer: finalStateBuffer,
          // This descriptor is deliberately excessive. The compact GPU
          // receipt, not mutable metadata, owns the exact +1 transition.
          positionEpoch: options.sphParticleUpload.positionEpoch + 91
        },
        mlsMpmParticleUpload: {
          ...options.mlsMpmParticleUpload,
          positionEpoch: options.mlsMpmParticleUpload.positionEpoch + 91
        }
      }
    };
  };
  residentStepRunner.schroederSpatialEpochTransactionAware = true;
  residentStepRunner.schroederSpatialTopologyTransitionAware = true;

  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    ...uploads,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableLawQueue: false,
    enableCrossLevelCoupling: false,
    enablePressureInterfaceOwnerScope: false,
    residentStepRunner,
    spatialTransitionPolicy:
      SCHROEDER_SPATIAL_TRANSITION_POLICY_OBSERVED_COMPACT_DIAGNOSTIC
  });

  const positionReceipt =
    result.residentStep.schroederSpatialPositionTransitionReceipt;
  assert.equal(positionReceipt.positionChanged, true);
  assert.equal(positionReceipt.movedParticleCount, 1);
  assert.equal(positionReceipt.terminalQueueOutcomeObserved, true);
  assert.equal(
    positionReceipt.nextPositionEpoch,
    generation.execution.positionEpoch + 1
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.positionEpoch,
    generation.execution.positionEpoch + 1,
    'one or many moved particles advance the public position generation once'
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.topologyEpoch,
    generation.execution.topologyEpoch
  );
});

test('Schroeder conservative closure invalidates epochs without compact transition readback', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const uploads = authoritativeUploadFamily(device, {
    particleCount: 3,
    storageGeneration: 5,
    physicsTick: 7,
    positionEpoch: 13,
    topologyEpoch: 17,
    chartEpoch: 19,
    levelEpoch: 23,
    supportEpoch: 29,
    prefix: 'default-closure-position-spoof'
  });
  uploads.sphParticleUpload.stateBuffer._masses = [1, 1, 1];
  uploads.sphParticleUpload.stateBuffer._positions = [
    [0, 0, 0],
    [1, 0, 0],
    [2, 0, 0]
  ];
  let generation = null;
  const residentStepRunner = async (options) => {
    generation = options.schroederSpatialEpochGeneration;
    const readerInputs = {
      generation,
      sphParticleUpload: options.sphParticleUpload,
      mlsMpmParticleUpload: options.mlsMpmParticleUpload
    };
    for (const [readerId, phase] of [
      [
        SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
        SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION
      ],
      [
        SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
        SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT
      ]
    ]) {
      admitSchroederSpatialEpochTransactionReader(
        options.schroederSpatialEpochTransaction,
        { readerId, phase, ...readerInputs }
      );
    }
    sealSchroederSpatialEpochTransactionReaders(
      options.schroederSpatialEpochTransaction
    );
    return {
      status: 'resident-step-descriptor-position-spoof',
      nextParticleUploads: {
        sphParticleUpload: {
          ...options.sphParticleUpload,
          positionEpoch: options.sphParticleUpload.positionEpoch + 99
        },
        mlsMpmParticleUpload: {
          ...options.mlsMpmParticleUpload,
          positionEpoch: options.mlsMpmParticleUpload.positionEpoch + 99
        }
      }
    };
  };
  residentStepRunner.schroederSpatialEpochTransactionAware = true;
  residentStepRunner.schroederSpatialTopologyTransitionAware = true;

  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    ...uploads,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableLawQueue: false,
    enableCrossLevelCoupling: false,
    enablePressureInterfaceOwnerScope: false,
    residentStepRunner
  });

  assert.equal(
    result.schroederSpatialTransitionPolicy,
    SCHROEDER_SPATIAL_TRANSITION_POLICY_CONSERVATIVE_RESIDENT
  );
  assert.equal(
    result.schroederSpatialTransitionCompactReadbackPerformed,
    false
  );
  assert.equal(
    result.residentStep.schroederSpatialPositionTransitionReceipt,
    undefined
  );
  assert.equal(
    result.residentStep.schroederSpatialTopologyTransitionReceipt,
    undefined
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.positionEpoch,
    generation.execution.positionEpoch + 1,
    'the conservative policy advances exactly once instead of trusting mutable upload metadata'
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.topologyEpoch,
    generation.execution.topologyEpoch + 1
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.positionAuthority,
    'conservative-mechanics-integration-transition'
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.topologyTransitionMode,
    'gpu-resident-conservative-topology-advance'
  );
  assert.equal(
    device.createdBuffers.some((buffer) => (
      buffer.label ===
        'ulg-schroeder-spatial-topology-transition-compact-readback'
      || buffer.label ===
        'ulg-schroeder-spatial-position-transition-compact-readback'
    )),
    false
  );
});

test('Schroeder default closure activates a dormant high slot with one successor classifier', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({
    particleCount: 3,
    smoothingLengthM: 0.25
  });
  const uploads = authoritativeUploadFamily(device, {
    particleCount: 3,
    storageGeneration: 5,
    physicsTick: 7,
    positionEpoch: 13,
    topologyEpoch: 17,
    chartEpoch: 19,
    levelEpoch: 23,
    supportEpoch: 29,
    prefix: 'default-closure-activation'
  });
  uploads.sphParticleUpload.stateBuffer._masses = [1, 1, 0];
  const finalStateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'default-closure-activation-final-state',
    size: uploads.sphParticleUpload.stateBufferByteLength,
    usage: 128
  }), device);
  finalStateBuffer._masses = [1, 1, 1];
  let generation = null;
  const residentStepRunner = async (options) => {
    generation = options.schroederSpatialEpochGeneration;
    const readerInputs = {
      generation,
      sphParticleUpload: options.sphParticleUpload,
      mlsMpmParticleUpload: options.mlsMpmParticleUpload
    };
    for (const [readerId, phase] of [
      [
        SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
        SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION
      ],
      [
        SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
        SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT
      ]
    ]) {
      admitSchroederSpatialEpochTransactionReader(
        options.schroederSpatialEpochTransaction,
        { readerId, phase, ...readerInputs }
      );
    }
    sealSchroederSpatialEpochTransactionReaders(
      options.schroederSpatialEpochTransaction
    );
    return {
      status: 'resident-step-activated-high-slot',
      nextParticleUploads: {
        sphParticleUpload: {
          ...options.sphParticleUpload,
          stateBuffer: finalStateBuffer,
          positionEpoch: options.sphParticleUpload.positionEpoch + 1
        },
        mlsMpmParticleUpload: {
          ...options.mlsMpmParticleUpload,
          positionEpoch: options.mlsMpmParticleUpload.positionEpoch + 1
        }
      }
    };
  };
  residentStepRunner.schroederSpatialEpochTransactionAware = true;
  residentStepRunner.schroederSpatialTopologyTransitionAware = true;

  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    ...uploads,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableLawQueue: false,
    enableCrossLevelCoupling: false,
    enablePressureInterfaceOwnerScope: false,
    residentStepRunner,
    spatialTransitionPolicy:
      SCHROEDER_SPATIAL_TRANSITION_POLICY_OBSERVED_COMPACT_DIAGNOSTIC
  });

  const topologyReceipt =
    result.residentStep.schroederSpatialTopologyTransitionReceipt;
  assert.equal(topologyReceipt.topologyChanged, true);
  assert.equal(topologyReceipt.activatedCount, 1);
  assert.equal(topologyReceipt.deactivatedCount, 0);
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.topologyEpoch,
    generation.execution.topologyEpoch + 1
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.positionEpoch,
    generation.execution.positionEpoch + 1,
    'the exact mechanics upload transition advances position independently'
  );
  const successorAssignment =
    result.residentStep.nextParticleUploads
      .schroederSpatialSuccessorLevelAssignment;
  assert.equal(successorAssignment.sourceStateBuffer, finalStateBuffer);
  assert.equal(
    successorAssignment.sourceThermoBuffer,
    result.residentStep.nextParticleUploads.sphParticleUpload.thermoBuffer
  );
  assert.equal(
    successorAssignment.sourceMechanicsBuffer,
    result.residentStep.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer
  );
  assert.equal(
    device.createdBuffers.filter(
      (buffer) => buffer.label === 'ulg-schroeder-level-assignments-out'
    ).length,
    2,
    'activation still runs only lookup plus shared successor/render classification'
  );
});

test('Schroeder owner scope submits borrowed pressure before resident mechanics and captures one final generation fence', async () => {
  const device = createFakeWebGpuDevice();
  const ownerDeviceId = webGpuDeviceId(device);
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: 3,
    storageGeneration: 5,
    stateBuffer: device.createBuffer({ label: 'owner-scope-sph-state', size: 96, usage: 128 }),
    thermoBuffer: device.createBuffer({ label: 'owner-scope-sph-thermo', size: 144, usage: 128 }),
    identityBuffer: device.createBuffer({ label: 'owner-scope-sph-identity', size: 12, usage: 128 })
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: 3,
    storageGeneration: 5,
    mechanicsBuffer: device.createBuffer({ label: 'owner-scope-mls-mechanics', size: 384, usage: 128 })
  };
  const calls = [];
  let forceRowsDestroyed = false;
  let temporaryBuffersDestroyed = false;
  const exactNearQueryProfile = Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
    status: 'schroeder-spatial-exact-near-query-profile-ready',
    ready: true,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
  });
  const generation = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    status: 'schroeder-spatial-epoch-generation-submitted',
    ready: true,
    selected: true,
    source: {
      ready: true,
      sourceCount: 3,
      phaseVolumeAssignmentOverlayEnabled: false,
      exactNearQueryProfile
    },
    execution: {
      schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
      status: 'schroeder-spatial-epoch-gpu-build-submitted',
      submitPerformed: true,
      deviceId: ownerDeviceId,
      sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
      exactNearQueryProfile,
      queryGeometryEvidence: exactNearQueryProfile,
      directoryBuffer: device.createBuffer({
        label: 'owner-scope-spatial-directory',
        size: 4096,
        usage: 128
      }),
      generationId: 17,
      buildOrdinal: 17,
      sortUniqueOrdinal: 17
    },
    runtime: {
      schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
      status: 'schroeder-spatial-epoch-gpu-runtime-ready',
      deviceId: ownerDeviceId,
      ownsExecution(execution) {
        return execution === generation.execution;
      },
      isExecutionSubmitted(execution) {
        return execution === generation.execution
          && execution.submitPerformed === true;
      },
      async releaseExecutionAfter(execution, submissionFence) {
        assert.equal(execution, generation.execution);
        calls.push('release');
        await submissionFence;
        return true;
      }
    },
    directoryBuildCount: 1,
    privateLookupBuildCount: 0,
    releaseScheduled: false
  };
  Object.defineProperty(generation.execution, 'ownerRuntime', {
    value: generation.runtime,
    enumerable: false,
    writable: false,
    configurable: false
  });
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    elementCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 0.25,
    elements: [{}],
    spatialEpochInterfaceProvenanceStatus:
      'material-interface-current-particle-epoch-ready',
    spatialEpochSourceStateBuffer: sphParticleUpload.stateBuffer,
    spatialEpochSourceThermoBuffer: sphParticleUpload.thermoBuffer,
    spatialEpochSourceIdentityBuffer:
      sphParticleUpload.identityBuffer,
    spatialEpochSourceMechanicsBuffer:
      mlsMpmParticleUpload.mechanicsBuffer,
    spatialEpochOwnerScopeSampleSequenceIndex: 0,
    spatialEpochOwnerScopeSampleSequenceStepCount: 8,
    spatialEpochOwnerScopeSampleCadence:
      'once-per-resident-batch-first-substep-before-integration',
    spatialEpochOwnerScopeBuildMs: 2.5,
    candidateReadback: true,
    candidateReadbackMode: 'compact-active-readback',
    renderRowsReadback: false,
    renderFieldReadback: false
  };
  let pressureOptions = null;
  let residentOptions = null;
  const transactionAwareResidentRunner = async (options) => {
    calls.push('resident');
    residentOptions = options;
    const readerInputs = {
      generation: options.schroederSpatialEpochGeneration,
      sphParticleUpload: options.sphParticleUpload,
      mlsMpmParticleUpload: options.mlsMpmParticleUpload
    };
    admitSchroederSpatialEpochTransactionReader(
      options.schroederSpatialEpochTransaction,
      {
        readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
        phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
        ...readerInputs
      }
    );
    admitSchroederSpatialEpochTransactionReader(
      options.schroederSpatialEpochTransaction,
      {
        readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
        phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
        ...readerInputs
      }
    );
    sealSchroederSpatialEpochTransactionReaders(
      options.schroederSpatialEpochTransaction
    );
    return {
      status: 'resident-step-stubbed',
      nextParticleUploads: {
        sphParticleUpload: options.sphParticleUpload,
        mlsMpmParticleUpload: options.mlsMpmParticleUpload
      }
    };
  };
  transactionAwareResidentRunner.schroederSpatialEpochTransactionAware = true;

  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    sphParticleUpload,
    mlsMpmParticleUpload,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableLawQueue: false,
    enableCrossLevelCoupling: false,
    spatialEpochGenerationRunner: async (options) => {
      calls.push('generation');
      const levelAssignment = options.levelAssignment;
      const epochIdentity = {
        storageGeneration: levelAssignment.storageGeneration,
        physicsTick: levelAssignment.physicsTick,
        physicsSubstep: levelAssignment.physicsSubstep,
        positionEpoch: levelAssignment.positionEpoch,
        topologyEpoch: levelAssignment.topologyEpoch,
        chartEpoch: levelAssignment.chartEpoch,
        levelEpoch: levelAssignment.levelEpoch,
        supportEpoch: levelAssignment.supportEpoch
      };
      Object.assign(generation.source, {
        sourceBuffer: levelAssignment.assignmentBuffer,
        sourceStateBuffer: levelAssignment.sourceStateBuffer,
        ...epochIdentity
      });
      Object.assign(generation.execution, {
        sourceBuffer: levelAssignment.assignmentBuffer,
        ...epochIdentity
      });
      assert.equal(options.selectedLevel, 0);
      assert.equal(options.mechanicsGrid.gridNodeCount > 0, true);
      return generation;
    },
    pressureInterfaceStageRunner: async (options) => {
      calls.push('pressure');
      pressureOptions = options;
      return {
        status: 'pressure-interface-stage-solver-ready',
        pressureInterfaceOwnerScopeTemporaryCleanupDelegated: true,
        pressureInterfaceOwnerScopeTemporaryCleanupStatus:
          'pending-generation-owner-final-consumer-fence',
        gpuFence: {
          status: 'gpu-fence-delegated-pending',
          delegatedToGenerationOwner: true
        },
        pressureInterfaceForceSolver: {
          status: 'pressure-interface-force-solver-ready',
          schroederSpatialExactNearBorrowedGeneration: true,
          schroederSpatialExactNearDirectoryBuildCount: 0,
          schroederSpatialExactNearSharedGenerationDirectoryBuildCount: 1,
          schroederSpatialExactNearPrivateParticleBinBuildCount: 0,
          schroederSpatialExactNearFixedCandidateBuildCount: 0,
          schroederSpatialExactNearExhaustiveParticleScanCount: 0,
          schroederSpatialExactNearConsumerReleaseAuthority: 'generation-owner'
        },
        forceRowsBuffer: { label: 'diagnostic-pressure-force-rows' },
        destroyForceRowsBuffer() {
          forceRowsDestroyed = true;
        },
        destroyOwnerScopeTemporaryBuffers() {
          temporaryBuffersDestroyed = true;
        }
      };
    },
    residentStepRunner: transactionAwareResidentRunner,
    residentStepOptions: {
      materialInterfaceField,
      pressureFeedback: {
        status: 'wall-pressure-ledger-ready',
        totalPressurePa: 101325,
        gasCellField: {
          status: 'gas-cell-pressure-field-ready',
          uniformPressurePa: 101325
        }
      }
    }
  });

  assert.deepEqual(calls.slice(0, 4), ['generation', 'pressure', 'resident', 'release']);
  assert.equal(pressureOptions.schroederSpatialEpochGeneration, generation);
  assert.equal(pressureOptions.materialInterfaceField, materialInterfaceField);
  assert.equal(pressureOptions.sharedSpatialFenceAuthority, 'generation-owner');
  assert.equal(pressureOptions.retainForceRowsBuffer, true);
  assert.equal(residentOptions.pressureInterfaceForceRowsBuffer, undefined);
  assert.ok(residentOptions.schroederSpatialEpochTransaction);
  assert.equal(result.spatialEpochTransactionMounted, true);
  assert.equal(result.spatialEpochTransaction.state, 'release-scheduled');
  assert.deepEqual(
    result.spatialEpochTransaction.admittedReaders.map(({ readerId }) => readerId),
    ['pressure-interface', 'mechanics-p2g', 'mechanics-g2p']
  );
  assert.equal(result.spatialEpochTransaction.counters.directoryBuildCount, 1);
  assert.equal(result.spatialEpochTransaction.counters.readerAdmissionCount, 3);
  assert.equal(result.spatialEpochTransaction.counters.proposalSealCount, 1);
  assert.equal(result.spatialEpochTransaction.counters.commitCount, 1);
  assert.equal(result.spatialEpochTransaction.counters.releaseScheduleCount, 1);
  assert.equal(result.spatialEpochTransaction.counters.staleLawInputForwardCount, 0);
  assert.equal(result.spatialEpochTransaction.counters.legacyPrivateLookupBuildCount, 0);
  assert.equal(result.spatialEpochTransaction.counters.legacyExhaustiveTraversalCount, 0);
  assert.equal(result.pressureInterfaceOwnerScope.diagnosticOnly, true);
  assert.equal(result.pressureInterfaceOwnerScope.borrowedSpatialGeneration, true);
  assert.equal(result.pressureInterfaceOwnerScope.directoryBuildCount, 0);
  assert.equal(result.pressureInterfaceOwnerScope.sampleSequenceIndex, 0);
  assert.equal(result.pressureInterfaceOwnerScope.sampleSequenceStepCount, 8);
  assert.equal(
    result.pressureInterfaceOwnerScope.sampleCadence,
    'once-per-resident-batch-first-substep-before-integration'
  );
  assert.equal(result.pressureInterfaceOwnerScope.materialInterfaceBuildMs, 2.5);
  assert.equal(result.pressureInterfaceOwnerScope.materialInterfaceCandidateReadback, true);
  assert.equal(
    result.pressureInterfaceOwnerScope.materialInterfaceCandidateReadbackMode,
    'compact-active-readback'
  );
  assert.equal(result.pressureInterfaceOwnerScope.compactDiagnosticReadbackPerformed, true);
  assert.equal(result.pressureInterfaceOwnerScope.fullParticleReadbackPerformed, false);
  assert.equal(result.normalHotLoopReadbackFree, false);
  assert.equal(result.pressureInterfaceOwnerScope.forceRowsAppliedToResidentMechanics, false);
  assert.equal(result.pressureInterfaceOwnerScope.consumerFenceDelegatedToGenerationOwner, true);
  assert.equal(result.spatialEpochGenerationReleaseScheduled, true);
  assert.equal(result.levelAssignmentCleanupScheduled, true);
  assert.equal(await generation.releasePromise, true);
  const finalizedTransaction =
    result.currentSchroederSpatialEpochTransactionSummary();
  assert.equal(finalizedTransaction.state, 'released');
  assert.equal(finalizedTransaction.counters.releaseCount, 1);
  const finalizedGeneration =
    result.currentSchroederSpatialEpochGenerationSummary();
  assert.equal(
    finalizedGeneration.releaseStatus,
    'spatial-epoch-generation-released-after-final-consumer'
  );
  assert.equal(finalizedGeneration.releaseAttemptCount, 1);
  assert.equal(finalizedGeneration.releaseFailureCount, 0);
  await Promise.resolve();
  assert.equal(forceRowsDestroyed, true);
  assert.equal(temporaryBuffersDestroyed, true);
  assert.equal(
    device.createdBuffers.find(
      (buffer) => buffer.label === 'ulg-schroeder-level-assignments-out'
    )?.destroyed,
    true
  );
});

test('Schroeder owner scope skips an optional pressure reader when current interface geometry cannot solve', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: 3,
    storageGeneration: 5,
    stateBuffer: device.createBuffer({ label: 'blocked-owner-scope-sph-state', size: 96, usage: 128 }),
    thermoBuffer: device.createBuffer({ label: 'blocked-owner-scope-sph-thermo', size: 144, usage: 128 }),
    identityBuffer: device.createBuffer({ label: 'blocked-owner-scope-sph-identity', size: 12, usage: 128 })
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: 3,
    storageGeneration: 5,
    mechanicsBuffer: device.createBuffer({ label: 'blocked-owner-scope-mls-mechanics', size: 384, usage: 128 })
  };
  let interfaceDestroyCount = 0;
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    elementCount: 1,
    readySurfaceCount: 0,
    totalSurfaceAreaM2: 0,
    elements: [{}],
    spatialEpochInterfaceProvenanceStatus:
      'material-interface-current-particle-epoch-ready',
    spatialEpochSourceStateBuffer: sphParticleUpload.stateBuffer,
    spatialEpochSourceThermoBuffer: sphParticleUpload.thermoBuffer,
    spatialEpochSourceIdentityBuffer: sphParticleUpload.identityBuffer,
    spatialEpochSourceMechanicsBuffer: mlsMpmParticleUpload.mechanicsBuffer,
    spatialEpochOwnerScopeEphemeral: true,
    destroyMaterialInterfaceFieldBuffers() {
      interfaceDestroyCount += 1;
    }
  };
  let pressureCallCount = 0;
  let residentCallCount = 0;
  const exactNearQueryProfile = Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
    status: 'schroeder-spatial-exact-near-query-profile-ready',
    ready: true,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
  });
  const spatialEpochGeneration = {
    status: 'schroeder-spatial-epoch-generation-submitted',
    ready: true,
    selected: true,
    source: {
      ready: true,
      sourceCount: 3,
      phaseVolumeAssignmentOverlayEnabled: false,
      exactNearQueryProfile
    },
    execution: {
      sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
      exactNearQueryProfile,
      queryGeometryEvidence: exactNearQueryProfile
    },
    releasePromise: Promise.resolve(false)
  };

  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    sphParticleUpload,
    mlsMpmParticleUpload,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    spatialEpochGeneration,
    enableLawQueue: false,
    enableCrossLevelCoupling: false,
    pressureInterfaceStageRunner: async () => {
      pressureCallCount += 1;
      throw new Error('blocked pressure owner scope must not execute');
    },
    residentStepRunner: async () => {
      residentCallCount += 1;
      return { status: 'resident-step-stubbed' };
    },
    residentStepOptions: {
      materialInterfaceField,
      pressureFeedback: {
        status: 'wall-pressure-ledger-ready',
        totalPressurePa: 101325,
        gasCellField: {
          status: 'gas-cell-pressure-field-ready',
          uniformPressurePa: 101325
        }
      }
    }
  });

  assert.equal(pressureCallCount, 0);
  assert.equal(residentCallCount, 1);
  assert.equal(result.pressureInterfaceOwnerScope.eligible, false);
  assert.equal(
    result.pressureInterfaceOwnerScope.eligibilityBlockers.some(
      (blocker) => blocker.startsWith('pressure-interface-coupling-not-ready:')
    ),
    true
  );
  assert.equal(
    result.pressureInterfaceOwnerScope.pressureInterfaceCouplingStatus,
    'pressure-interface-coupling-blocked'
  );
  assert.equal(result.spatialEpochGeneration?.selected, true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(interfaceDestroyCount, 0);
  assert.match(
    materialInterfaceField.spatialEpochOwnerScopeCleanupBlockedReason,
    /did not confirm/
  );
});

test('Schroeder owner scope retires an ephemeral interface field when spatial setup fails', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  let destroyCount = 0;
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-physics-material-interface-field.v0',
    status: 'material-interface-field-ready',
    spatialEpochOwnerScopeEphemeral: true,
    destroyMaterialInterfaceFieldBuffers() {
      destroyCount += 1;
    }
  };

  await assert.rejects(
    () => runSchroederSameLevelMechanicsWebGpu({
      device,
      ...buffers,
      selectedLevel: 0,
      baseGridSpacingM: 0.25,
      enableLawQueue: false,
      enableCrossLevelCoupling: false,
      spatialEpochGenerationRunner: async () => {
        throw new Error('intentional owner-scope spatial setup failure');
      },
      residentStepOptions: { materialInterfaceField }
    }),
    /intentional owner-scope spatial setup failure/
  );

  await Promise.resolve();
  await Promise.resolve();
  assert.equal(materialInterfaceField.spatialEpochOwnerScopeCleanupScheduled, true);
  assert.equal(destroyCount, 1);
  assert.equal(
    device.createdBuffers.find(
      (buffer) => buffer.label === 'ulg-schroeder-level-assignments-out'
    )?.destroyed,
    true
  );
  assert.equal(
    device.createdBuffers.find(
      (buffer) => buffer.label === 'ulg-schroeder-active-nodes-out'
    )?.destroyed,
    true
  );
});

test('Schroeder same-level mechanics fails closed on unresolved spatial arena backpressure', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  let residentCallCount = 0;

  await assert.rejects(
    () => runSchroederSameLevelMechanicsWebGpu({
      device,
      ...buffers,
      selectedLevel: 0,
      baseGridSpacingM: 0.25,
      enableLawQueue: false,
      enableCrossLevelCoupling: false,
      spatialEpochGenerationRunner: async () => ({
        schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
        status: 'schroeder-spatial-epoch-generation-backpressure',
        reason: 'test spatial arena is exhausted',
        errorCode: 'ERR_SCHROEDER_SPATIAL_ARENA_EXHAUSTED',
        ready: false,
        selected: false,
        directoryBuildCount: 0,
        privateLookupBuildCount: 0
      }),
      residentStepRunner: async () => {
        residentCallCount += 1;
        return { status: 'resident-step-must-not-run' };
      }
    }),
    (error) => (
      error?.code === 'ERR_SCHROEDER_SPATIAL_ARENA_EXHAUSTED'
      && /spatial arena is exhausted/.test(error.message)
    )
  );

  assert.equal(residentCallCount, 0);
  await Promise.resolve();
  assert.equal(
    device.createdBuffers.find(
      (buffer) => buffer.label === 'ulg-schroeder-level-assignments-out'
    )?.destroyed,
    true
  );
  assert.equal(
    device.createdBuffers.find(
      (buffer) => buffer.label === 'ulg-schroeder-active-nodes-out'
    )?.destroyed,
    true
  );
});

test('Schroeder same-level mechanics consumes prior phase-volume level update as active-node overlay', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const phaseVolumeLevelUpdate = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-level-update-submitted',
    migrationRowCount: 3,
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    levelUpdateBuffer: { label: 'retained-phase-volume-level-update-buffer' },
    levelUpdateBufferByteLength: 3 * SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    phaseVolumeMigrationAdmissionApproved: true,
    conservativeTransferStatus: 'phase-volume-level-update-submitted',
    stateMutationStatus: 'phase-volume-level-update-buffer-submitted',
    stateAuthorityStatus: 'state-manager-admitted-phase-volume-level-update-materialized'
  };
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 4,
    tileCellCount: 4,
    phaseVolumeLevelUpdate,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasPhaseVolumeAssignmentOverlay: Boolean(options.schroederPhaseVolumeAssignmentOverlay),
        hasPhaseVolumeLevelUpdate: Boolean(options.schroederPhaseVolumeLevelUpdate)
      };
    }
  });

  assert.equal(result.phaseVolumeAssignmentOverlayEnabled, true);
  assert.equal(
    result.phaseVolumeAssignmentOverlayStatus,
    'schroeder-phase-volume-level-update-assignment-overlay-ready'
  );
  assert.equal(
    result.phaseVolumeAssignmentOverlayConsumerStatus,
    'phase-volume-level-update-assignment-overlay-consumed-by-active-node-selection'
  );
  assert.equal(result.phaseVolumeAssignmentOverlayRetainedBuffer, true);
  assert.equal(result.phaseVolumeAssignmentOverlayRowCount, 3);
  assert.equal(result.phaseVolumeAssignmentOverlayRawGpuBufferTransferAllowed, false);
  assert.equal(result.phaseVolumeAssignmentOverlayFullParticleReadbackRequired, false);
  assert.equal(result.phaseVolumeLevelSelectionSource, 'state-manager-admitted-phase-volume-level-update');
  assert.equal(result.activeNodeList.phaseVolumeAssignmentOverlayEnabled, true);
  assert.equal(
    result.activeNodeList.phaseVolumeAssignmentOverlayConsumerStatus,
    'phase-volume-level-update-assignment-overlay-consumed-by-active-node-selection'
  );
  assert.equal(result.activeNodeList.phaseVolumeNativeLevelSource, 'phase-volume-level-update-target-level');
  assert.equal(result.phaseVolumeLevelUpdateStatus, 'schroeder-phase-volume-level-update-submitted');
  assert.equal(result.phaseVolumeLevelUpdateConsumerStatus, 'phase-volume-level-update-forwarded-to-resident-backend');
  assert.equal(result.residentStep.hasPhaseVolumeAssignmentOverlay, true);
  assert.equal(result.residentStep.hasPhaseVolumeLevelUpdate, true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederPhaseVolumeAssignmentOverlay.schema,
    ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA
  );
  assert.equal(
    calls[0].schroederPhaseVolumeLevelUpdate.schema,
    ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA
  );
  assert.equal(device.bindGroups[1].entries[3].resource.buffer, phaseVolumeLevelUpdate.levelUpdateBuffer);
});

test('Schroeder same-level mechanics auto-indexes sparse phase-volume overlays for active nodes', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const phaseVolumeLevelUpdate = {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
    status: 'schroeder-phase-volume-level-update-submitted',
    migrationRowCount: 2,
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    levelUpdateBuffer: { label: 'retained-sparse-phase-volume-level-update-buffer' },
    levelUpdateBufferByteLength: 2 * SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    phaseVolumeMigrationAdmissionApproved: true,
    conservativeTransferStatus: 'phase-volume-level-update-submitted',
    stateMutationStatus: 'phase-volume-level-update-buffer-submitted',
    stateAuthorityStatus: 'state-manager-admitted-phase-volume-level-update-materialized'
  };
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 4,
    tileCellCount: 4,
    phaseVolumeLevelUpdate,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasPhaseVolumeAssignmentOverlay: Boolean(options.schroederPhaseVolumeAssignmentOverlay),
        hasPhaseVolumeAssignmentOverlayIndex: Boolean(options.schroederPhaseVolumeAssignmentOverlayIndex),
        hasPhaseVolumeLevelUpdate: Boolean(options.schroederPhaseVolumeLevelUpdate)
      };
    }
  });

  assert.equal(result.phaseVolumeAssignmentOverlayAvailable, true);
  assert.equal(result.phaseVolumeAssignmentOverlayEnabled, true);
  assert.equal(result.phaseVolumeAssignmentOverlayIndexRequired, true);
  assert.equal(result.phaseVolumeAssignmentOverlayIndexEnabled, true);
  assert.equal(result.phaseVolumeAssignmentOverlayIndexStatus, 'schroeder-phase-volume-assignment-overlay-index-submitted');
  assert.equal(result.phaseVolumeAssignmentOverlayIndexByteLength, 3 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(result.activeNodeList.phaseVolumeAssignmentOverlayIndexEnabled, true);
  assert.equal(result.residentStep.hasPhaseVolumeAssignmentOverlay, true);
  assert.equal(result.residentStep.hasPhaseVolumeAssignmentOverlayIndex, true);
  assert.equal(result.residentStep.hasPhaseVolumeLevelUpdate, true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederPhaseVolumeAssignmentOverlayIndex.schema,
    ULG_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_INDEX_EXECUTION_SCHEMA
  );
  assert.equal(result.phaseVolumeNextTickAssignmentOverlay?.schema, ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA);
  assert.equal(
    result.schroederPhaseVolumeNextTickAssignmentOverlay?.schema,
    ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA
  );
  assert.equal(
    result.schroederPhaseVolumeNextTickAssignmentOverlay?.levelUpdateBuffer,
    phaseVolumeLevelUpdate.levelUpdateBuffer
  );
  assert.equal(result.schroederPhaseVolumeNextTickAssignmentOverlay?.sameDeviceOnly, true);
  assert.equal(result.schroederPhaseVolumeNextTickAssignmentOverlay?.rawGpuBufferTransferAllowed, false);
  assert.equal(
    result.phaseVolumeNextTickAssignmentOverlayConsumerStatus,
    'phase-volume-level-update-overlay-ready-for-next-resident-tick'
  );
  assert.equal(result.phaseVolumeNextTickAssignmentOverlayIndexRequired, true);
  assert.equal(result.phaseVolumeNextTickAssignmentOverlayRawGpuBufferTransferAllowed, false);
});

test('Schroeder same-level mechanics can emit portable render LOD summary', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 1,
    baseGridSpacingM: 0.25,
    enableLawQueue: false,
    enableCrossLevelCoupling: false,
    enablePortableSummary: true,
    portableSummaryPeerComputeUseCase: 'test-same-level-render-lod',
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasPortableSummary: Boolean(options.schroederPortableSummary),
        portableSummarySchema: options.schroederPortableSummary?.schema,
        portableSummaryStatus: options.schroederPortableSummary?.status,
        portableSummaryTransferMode: options.schroederPortableSummary?.transferMode,
        renderLodStatus: options.schroederPortableSummary?.renderLodStatus,
        retainedRefCount: options.schroederPortableSummary?.retainedRefCount
      };
    }
  });

  assert.equal(result.portableSummary.schema, ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA);
  assert.equal(result.portableSummary.status, 'schroeder-portable-summary-plan-ready');
  assert.equal(result.portableSummary.peerComputeUseCase, 'test-same-level-render-lod');
  assert.equal(result.portableSummary.transferMode, 'peercompute-portable-summary-descriptors');
  assert.equal(result.portableSummary.retainedRefCount, 2);
  assert.equal(result.portableSummary.retainedBufferRefCount, 2);
  assert.equal(result.portableSummary.retainedRefs.length, 2);
  assert.equal(
    result.portableSummary.retainedRefs[0].retainedBufferRef,
    'schroeder-level-assignment:native-scale-classification'
  );
  assert.equal(result.portableSummary.retainedRefs[1].family, 'schroeder-active-node-list');
  assert.equal(result.portableSummary.retainedRefs[1].role, 'render-lod-leaf-source');
  assert.equal(
    result.portableSummary.retainedRefs[1].retainedBufferRef,
    'schroeder-active-node-list:render-lod-leaf-source'
  );
  assert.equal(result.portableSummary.retainedRefs[1].transferMode, 'descriptor-only-no-raw-gpubuffer-transfer');
  assert.equal(Object.hasOwn(result.portableSummary.retainedRefs[1], 'buffer'), false);
  assert.equal(Object.hasOwn(result.portableSummary.retainedRefs[1], 'gpuBuffer'), false);
  assert.equal(result.portableSummary.activeNodeCount, 3);
  assert.equal(result.portableSummary.aggregateNodeCount, 0);
  assert.equal(result.portableSummary.lawQueueCount, 0);
  assert.equal(result.portableSummary.lawNeighborCandidateCount, 0);
  assert.equal(result.portableSummary.renderLodStatus, 'schroeder-render-lod-summary-planned');
  assert.equal(result.portableSummary.renderLodMode, 'active-node-leaf-and-aggregate-proxy-lod');
  assert.equal(result.portableSummary.renderLod.schema, ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA);
  assert.equal(result.portableSummary.renderLod.activeLeafProxyCount, 3);
  assert.equal(result.portableSummary.renderLod.aggregateProxyCount, 0);
  assert.equal(result.portableSummary.renderLod.lawQueueProxyCount, 0);
  assert.equal(result.portableSummary.renderLod.fullParticleReadbackRequired, false);
  assert.equal(result.portableSummary.fullParticleReadbackRequired, false);
  assert.equal(result.portableSummaryStatus, 'schroeder-portable-summary-plan-ready');
  assert.equal(result.renderLodStatus, 'schroeder-render-lod-summary-planned');
  assert.equal(result.portableSummaryTransferMode, 'peercompute-portable-summary-descriptors');
  assert.equal(result.residentStep.hasPortableSummary, true);
  assert.equal(result.residentStep.portableSummarySchema, ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA);
  assert.equal(result.residentStep.portableSummaryStatus, 'schroeder-portable-summary-plan-ready');
  assert.equal(result.residentStep.portableSummaryTransferMode, 'peercompute-portable-summary-descriptors');
  assert.equal(result.residentStep.renderLodStatus, 'schroeder-render-lod-summary-planned');
  assert.equal(result.residentStep.retainedRefCount, 2);
  assert.equal(
    result.localRetainedRenderBuffers.retainedBufferRefs[0],
    'schroeder-active-node-list:render-lod-leaf-source'
  );
  assert.ok(result.localRetainedRenderBuffers.buffers[0].buffer);
  assert.equal(result.localRetainedRenderBuffers.buffers[0].gpuBuffer, result.localRetainedRenderBuffers.buffers[0].buffer);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].schroederPortableSummary.schema, ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA);
  assert.equal(calls[0].schroederPortableSummary.renderLod.activeLeafProxyCount, 3);
  assert.equal(calls[0].schroederPortableSummary.renderLod.aggregateProxyCount, 0);
  assert.equal(
    calls[0].schroederPortableSummary.retainedRefs.every(
      (entry) => entry.transferMode === 'descriptor-only-no-raw-gpubuffer-transfer'
    ),
    true
  );
  assert.equal(calls[0].schroederPortableSummary.retainedRefs.some((entry) => Object.hasOwn(entry, 'buffer')), false);
  assert.equal(calls[0].schroederPortableSummary.retainedRefs.some((entry) => Object.hasOwn(entry, 'gpuBuffer')), false);
});

test('Schroeder same-level mechanics can build an opt-in active-node index before resident backend', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableActiveNodeIndex: true,
    activeNodeIndexBucketSlotCapacity: 4,
    enableLawQueue: false,
    enableCrossLevelCoupling: false,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasActiveNodeList: Boolean(options.schroederActiveNodeList),
        hasLawQueue: Boolean(options.schroederLawQueue)
      };
    }
  });

  assert.equal(result.activeNodeIndex.schema, ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA);
  assert.equal(result.activeNodeIndex.activeNodeIndexSchema, ULG_SCHROEDER_ACTIVE_NODE_INDEX_SCHEMA);
  assert.equal(result.activeNodeIndex.status, 'schroeder-active-node-index-submitted');
  assert.equal(result.activeNodeIndex.activeNodeCount, 3);
  assert.equal(result.activeNodeIndex.bucketCount, 2);
  assert.equal(result.activeNodeIndex.bucketSlotCapacity, 4);
  assert.equal(result.activeNodeIndex.bucketSlotCount, 8);
  assert.equal(result.activeNodeIndex.outputCompaction, 'bucketed-active-node-indirection-slots');
  assert.equal(result.activeNodeIndex.capacityStatus, 'bucket-capacity-provisioned-fail-closed-on-overflow');
  assert.equal(result.activeNodeIndex.indexCoverageStatus, 'tile-min-anchor-index-not-authoritative-overlap-pruning');
  assert.equal(result.activeNodeIndex.retainedIndexBuffers, true);
  assert.equal(result.activeNodeIndex.bucketSlotBufferByteLength, 8 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(result.activeNodeIndexStatus, 'schroeder-active-node-index-submitted');
  assert.equal(
    result.activeNodeIndexConsumerStatus,
    'active-node-index-available-not-yet-authoritative-for-law-neighbor-traversal'
  );
  assert.equal(
    result.activeNodeConsumerStatus,
    'active-node-list-published-for-render-lod-and-spatial-directory-production'
  );
  assert.equal(result.lawQueue, null);
  assert.equal(result.lawQueueStatus, 'disabled-local-law-queue');
  assert.equal(result.residentStep.hasActiveNodeList, true);
  assert.equal(result.residentStep.hasLawQueue, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].schroederActiveNodeList.schema, ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA);
  assert.equal(calls[0].schroederLawQueue, null);
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]);
});

test('Schroeder same-level mechanics can build an opt-in sorted active-node index before resident backend', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableActiveNodeSortedIndex: true,
    activeNodeSortedIndexBucketCount: 4,
    enableLawQueue: false,
    enableCrossLevelCoupling: false,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasActiveNodeSortedIndex: Boolean(options.schroederActiveNodeSortedIndex),
        hasLawQueue: Boolean(options.schroederLawQueue)
      };
    }
  });

  assert.equal(result.activeNodeSortedIndex.schema, ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA);
  assert.equal(
    result.activeNodeSortedIndex.activeNodeSortedIndexSchema,
    ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_SCHEMA
  );
  assert.equal(result.activeNodeSortedIndex.status, 'schroeder-active-node-sorted-index-submitted');
  assert.equal(result.activeNodeSortedIndex.activeNodeCount, 3);
  assert.equal(result.activeNodeSortedIndex.bucketCount, 4);
  assert.equal(result.activeNodeSortedIndex.bucketRangeOffsetCount, 5);
  assert.equal(result.activeNodeSortedIndex.outputCompaction, 'contiguous-active-node-index-ranges-by-radix-bucket');
  assert.equal(result.activeNodeSortedIndex.capacityStatus, 'unbounded-per-bucket-range-no-fixed-slot-overflow');
  assert.equal(result.activeNodeSortedIndex.retainedIndexBuffers, true);
  assert.equal(result.activeNodeSortedIndexPolicyStatus, 'active-node-sorted-index-policy-forced-by-enable-flag');
  assert.equal(result.activeNodeSortedIndexSelection.forcedByLegacyFlag, true);
  assert.equal(result.activeNodeSortedIndexSelection.shouldBuild, true);
  assert.equal(result.activeNodeSortedIndexStatus, 'schroeder-active-node-sorted-index-submitted');
  assert.equal(result.activeNodeSortedIndexConsumerStatus, 'active-node-sorted-radix-index-available-not-yet-consumed');
  assert.equal(result.activeNodeIndex, null);
  assert.equal(result.activeNodeIndexStatus, 'disabled-active-node-index');
  assert.equal(result.lawQueue, null);
  assert.equal(result.lawQueueStatus, 'disabled-local-law-queue');
  assert.equal(result.residentStep.hasActiveNodeSortedIndex, true);
  assert.equal(result.residentStep.hasLawQueue, false);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederActiveNodeSortedIndex.schema,
    ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA
  );
  assert.equal(calls[0].schroederLawQueue, null);
  assert.deepEqual(device.dispatches, [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
  ]);
});

test('Schroeder same-level mechanics forwards opt-in active-node index to law-neighbor traversal', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const lawNeighborCalls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableActiveNodeIndex: true,
    activeNodeIndexBucketSlotCapacity: 4,
    enableCrossLevelCoupling: false,
    lawNeighborCandidateReadbackMode: SCHROEDER_COMPACT_LAW_NEIGHBOR_DIAGNOSTIC_READBACK_MODE,
    lawNeighborTraversalPolicyMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE,
    lawNeighborTraversalPolicyFallbackScanRatioThreshold: 0.125,
    lawNeighborTraversalPolicyBucketPressureRatioThreshold: 0.03125,
    lawNeighborCandidateRunner: async (options) => {
      lawNeighborCalls.push(options);
      return {
        schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
        status: 'schroeder-law-neighbor-candidates-submitted',
        lawQueueCount: options.lawQueue.activeNodeCount,
        neighborCandidateCount: options.lawQueue.activeNodeCount * options.candidateBudget,
        candidateBudget: options.candidateBudget,
        enumerationMode: 'schroeder-active-node-indexed-tile-traversal-neighbor-enumeration',
        outputCompaction: 'fixed-budget-law-neighbor-candidate-rows',
        treeTraversalStatus: 'active-node-bucket-index-traversal-with-exact-scan-fallback',
        activeNodeIndexEnabled: Boolean(options.activeNodeIndex),
        activeNodeIndexConsumerStatus: 'active-node-bucket-index-consumed-with-exact-scan-fallback',
        traversalDiagnosticStatus: 'law-neighbor-traversal-diagnostic-counters-submitted',
        traversalPolicyStatus: 'traversal-policy-forced-bucketed-active-node-index',
        traversalPolicyMode: options.traversalPolicyMode,
        appliedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE,
        recommendedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE,
        selectedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE,
        sortedRadixIndexRequired: false,
        sortedRadixIndexStatus: 'sorted-radix-active-node-index-not-required',
        diagnosticCountersAvailable: true,
        diagnosticReadbackRecommended: false,
        diagnosticCounterBuffer: { label: 'stub-traversal-diagnostics' },
        diagnosticCounterBufferByteLength: 8 * Uint32Array.BYTES_PER_ELEMENT,
        neighborCandidateBuffer: { label: 'stub-indexed-law-neighbor-candidates' },
        neighborCandidateBufferByteLength: 4 * Float32Array.BYTES_PER_ELEMENT
      };
    },
    residentStepRunner: async (options) => ({
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
      status: 'resident-step-stubbed',
      hasLawNeighborCandidates: Boolean(options.schroederLawNeighborCandidates)
    })
  });

  assert.equal(lawNeighborCalls.length, 1);
  assert.equal(lawNeighborCalls[0].activeNodeIndex.schema, ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA);
  assert.equal(lawNeighborCalls[0].activeNodeIndex.bucketSlotCapacity, 4);
  assert.equal(lawNeighborCalls[0].readbackMode, SCHROEDER_COMPACT_LAW_NEIGHBOR_DIAGNOSTIC_READBACK_MODE);
  assert.equal(lawNeighborCalls[0].traversalPolicyMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(lawNeighborCalls[0].traversalPolicyFallbackScanRatioThreshold, 0.125);
  assert.equal(lawNeighborCalls[0].traversalPolicyBucketPressureRatioThreshold, 0.03125);
  assert.equal(result.lawNeighborCandidates.activeNodeIndexEnabled, true);
  assert.equal(
    result.lawNeighborCandidates.activeNodeIndexConsumerStatus,
    'active-node-bucket-index-consumed-with-exact-scan-fallback'
  );
  assert.equal(result.lawNeighborCandidates.treeTraversalStatus, 'active-node-bucket-index-traversal-with-exact-scan-fallback');
  assert.equal(result.lawNeighborCandidates.traversalPolicyStatus, 'traversal-policy-forced-bucketed-active-node-index');
  assert.equal(
    result.lawNeighborCandidates.recommendedTraversalIndexMode,
    SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE
  );
  assert.equal(result.lawNeighborCandidates.selectedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_BUCKET_MODE);
  assert.equal(result.lawNeighborCandidates.sortedRadixIndexRequired, false);
  assert.equal(
    result.lawNeighborCandidates.sortedRadixIndexStatus,
    'sorted-radix-active-node-index-not-required'
  );
  assert.equal(result.lawNeighborCandidates.diagnosticCountersAvailable, true);
  assert.equal(result.lawNeighborCandidates.retainedDiagnosticCounterBuffer, true);
  assert.equal(result.activeNodeIndexConsumerStatus, 'active-node-bucket-index-consumed-with-exact-scan-fallback');
  assert.equal(result.lawNeighborCandidateConsumerStatus, 'law-neighbor-candidates-forwarded-to-resident-backend');
  assert.equal(result.residentStep.hasLawNeighborCandidates, true);
});

test('Schroeder same-level mechanics forwards opt-in sorted active-node index to law-neighbor traversal', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const lawNeighborCalls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableActiveNodeSortedIndex: true,
    activeNodeSortedIndexBucketCount: 4,
    enableCrossLevelCoupling: false,
    lawNeighborTraversalPolicyMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
    lawNeighborCandidateRunner: async (options) => {
      lawNeighborCalls.push(options);
      return {
        schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
        status: 'schroeder-law-neighbor-candidates-submitted',
        lawQueueCount: options.lawQueue.activeNodeCount,
        neighborCandidateCount: options.lawQueue.activeNodeCount * options.candidateBudget,
        candidateBudget: options.candidateBudget,
        enumerationMode: 'schroeder-active-node-sorted-radix-range-traversal-neighbor-enumeration',
        outputCompaction: 'fixed-budget-law-neighbor-candidate-rows',
        treeTraversalStatus: 'active-node-sorted-radix-range-traversal-with-exact-scan-fallback',
        activeNodeIndexEnabled: false,
        activeNodeSortedIndexEnabled: Boolean(options.activeNodeSortedIndex),
        activeNodeIndexConsumerStatus: 'active-node-sorted-radix-index-consumed-with-exact-scan-fallback',
        traversalDiagnosticStatus: 'law-neighbor-traversal-diagnostic-counters-submitted',
        traversalPolicyStatus: 'traversal-policy-forced-sorted-radix-index',
        traversalPolicyMode: options.traversalPolicyMode,
        appliedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
        recommendedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
        selectedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
        sortedRadixIndexRequired: true,
        sortedRadixIndexStatus: 'sorted-radix-active-node-index-selected',
        diagnosticCountersAvailable: false,
        diagnosticReadbackRecommended: true,
        diagnosticCounterBuffer: { label: 'stub-traversal-diagnostics' },
        diagnosticCounterBufferByteLength: 8 * Uint32Array.BYTES_PER_ELEMENT,
        neighborCandidateBuffer: { label: 'stub-sorted-law-neighbor-candidates' },
        neighborCandidateBufferByteLength: 4 * Float32Array.BYTES_PER_ELEMENT
      };
    },
    residentStepRunner: async (options) => ({
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
      status: 'resident-step-stubbed',
      hasActiveNodeSortedIndex: Boolean(options.schroederActiveNodeSortedIndex),
      hasLawNeighborCandidates: Boolean(options.schroederLawNeighborCandidates)
    })
  });

  assert.equal(lawNeighborCalls.length, 1);
  assert.equal(
    lawNeighborCalls[0].activeNodeSortedIndex.schema,
    ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA
  );
  assert.equal(lawNeighborCalls[0].activeNodeSortedIndex.bucketCount, 4);
  assert.equal(lawNeighborCalls[0].activeNodeIndex, null);
  assert.equal(lawNeighborCalls[0].traversalPolicyMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE);
  assert.equal(result.lawNeighborCandidates.activeNodeSortedIndexEnabled, true);
  assert.equal(result.lawNeighborCandidates.activeNodeIndexEnabled, false);
  assert.equal(
    result.lawNeighborCandidates.activeNodeIndexConsumerStatus,
    'active-node-sorted-radix-index-consumed-with-exact-scan-fallback'
  );
  assert.equal(
    result.lawNeighborCandidates.treeTraversalStatus,
    'active-node-sorted-radix-range-traversal-with-exact-scan-fallback'
  );
  assert.equal(result.lawNeighborCandidates.selectedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE);
  assert.equal(result.lawNeighborCandidates.sortedRadixIndexStatus, 'sorted-radix-active-node-index-selected');
  assert.equal(result.activeNodeSortedIndexConsumerStatus, 'active-node-sorted-radix-index-consumed-by-law-neighbor-traversal');
  assert.equal(result.residentStep.hasActiveNodeSortedIndex, true);
  assert.equal(result.residentStep.hasLawNeighborCandidates, true);
});

test('Schroeder same-level mechanics builds sorted active-node index from traversal policy', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const lawNeighborCalls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableActiveNodeIndex: true,
    activeNodeIndexBucketSlotCapacity: 4,
    enableCrossLevelCoupling: false,
    lawNeighborTraversalPolicyMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
    activeNodeSortedIndexBucketCount: 4,
    lawNeighborCandidateRunner: async (options) => {
      lawNeighborCalls.push(options);
      return {
        schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
        status: 'schroeder-law-neighbor-candidates-submitted',
        lawQueueCount: options.lawQueue.activeNodeCount,
        neighborCandidateCount: options.lawQueue.activeNodeCount * options.candidateBudget,
        candidateBudget: options.candidateBudget,
        enumerationMode: 'schroeder-active-node-sorted-radix-range-traversal-neighbor-enumeration',
        outputCompaction: 'fixed-budget-law-neighbor-candidate-rows',
        treeTraversalStatus: 'active-node-sorted-radix-range-traversal-with-exact-scan-fallback',
        activeNodeIndexEnabled: Boolean(options.activeNodeIndex),
        activeNodeSortedIndexEnabled: Boolean(options.activeNodeSortedIndex),
        activeNodeIndexConsumerStatus: 'active-node-sorted-radix-index-consumed-with-exact-scan-fallback',
        traversalDiagnosticStatus: 'law-neighbor-traversal-diagnostic-counters-submitted',
        traversalPolicyStatus: 'traversal-policy-forced-sorted-radix-index',
        traversalPolicyMode: options.traversalPolicyMode,
        appliedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
        recommendedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
        selectedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
        sortedRadixIndexRequired: true,
        sortedRadixIndexStatus: 'sorted-radix-active-node-index-selected',
        diagnosticCountersAvailable: false,
        diagnosticReadbackRecommended: true,
        diagnosticCounterBuffer: { label: 'stub-policy-sorted-traversal-diagnostics' },
        diagnosticCounterBufferByteLength: 8 * Uint32Array.BYTES_PER_ELEMENT,
        neighborCandidateBuffer: { label: 'stub-policy-sorted-law-neighbor-candidates' },
        neighborCandidateBufferByteLength: 4 * Float32Array.BYTES_PER_ELEMENT
      };
    },
    residentStepRunner: async (options) => ({
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
      status: 'resident-step-stubbed',
      hasActiveNodeIndex: Boolean(options.schroederActiveNodeList),
      hasActiveNodeSortedIndex: Boolean(options.schroederActiveNodeSortedIndex),
      hasLawNeighborCandidates: Boolean(options.schroederLawNeighborCandidates)
    })
  });

  assert.equal(lawNeighborCalls.length, 1);
  assert.equal(lawNeighborCalls[0].activeNodeIndex.schema, ULG_SCHROEDER_ACTIVE_NODE_INDEX_EXECUTION_SCHEMA);
  assert.equal(
    lawNeighborCalls[0].activeNodeSortedIndex.schema,
    ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA
  );
  assert.equal(lawNeighborCalls[0].activeNodeSortedIndex.bucketCount, 4);
  assert.equal(result.activeNodeSortedIndexPolicyStatus, 'active-node-sorted-index-policy-forced-by-traversal-policy');
  assert.equal(result.activeNodeSortedIndexSelection.forcedByTraversalPolicy, true);
  assert.equal(result.activeNodeSortedIndexSelection.shouldBuild, true);
  assert.equal(result.activeNodeSortedIndexStatus, 'schroeder-active-node-sorted-index-submitted');
  assert.equal(result.lawNeighborCandidates.activeNodeSortedIndexEnabled, true);
  assert.equal(result.lawNeighborCandidates.selectedTraversalIndexMode, SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE);
  assert.equal(result.activeNodeSortedIndexConsumerStatus, 'active-node-sorted-radix-index-consumed-by-law-neighbor-traversal');
  assert.equal(result.residentStep.hasActiveNodeSortedIndex, true);
  assert.equal(result.residentStep.hasLawNeighborCandidates, true);
});

test('Schroeder same-level mechanics builds sorted active-node index from traversal diagnostics', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const lawNeighborCalls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableActiveNodeIndex: true,
    activeNodeIndexBucketSlotCapacity: 4,
    enableCrossLevelCoupling: false,
    lawNeighborTraversalDiagnosticCounters: new Uint32Array([
      32,
      32,
      4,
      28,
      8,
      20,
      8,
      4
    ]),
    activeNodeSortedIndexBucketCount: 8,
    lawNeighborCandidateRunner: async (options) => {
      lawNeighborCalls.push(options);
      return {
        schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
        status: 'schroeder-law-neighbor-candidates-submitted',
        lawQueueCount: options.lawQueue.activeNodeCount,
        neighborCandidateCount: options.lawQueue.activeNodeCount * options.candidateBudget,
        candidateBudget: options.candidateBudget,
        enumerationMode: 'schroeder-active-node-sorted-radix-range-traversal-neighbor-enumeration',
        outputCompaction: 'fixed-budget-law-neighbor-candidate-rows',
        treeTraversalStatus: 'active-node-sorted-radix-range-traversal-with-exact-scan-fallback',
        activeNodeIndexEnabled: Boolean(options.activeNodeIndex),
        activeNodeSortedIndexEnabled: Boolean(options.activeNodeSortedIndex),
        activeNodeIndexConsumerStatus: 'active-node-sorted-radix-index-consumed-with-exact-scan-fallback',
        traversalDiagnosticStatus: 'law-neighbor-traversal-diagnostic-counters-submitted',
        traversalPolicyStatus: 'traversal-policy-diagnostics-require-sorted-radix-index',
        traversalPolicyMode: options.traversalPolicyMode,
        appliedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
        recommendedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
        selectedTraversalIndexMode: SCHROEDER_LAW_NEIGHBOR_TRAVERSAL_POLICY_SORTED_RADIX_MODE,
        sortedRadixIndexRequired: true,
        sortedRadixIndexStatus: 'sorted-radix-active-node-index-selected',
        diagnosticCountersAvailable: true,
        diagnosticReadbackRecommended: false,
        diagnosticCounterBuffer: { label: 'stub-diagnostic-sorted-traversal-diagnostics' },
        diagnosticCounterBufferByteLength: 8 * Uint32Array.BYTES_PER_ELEMENT,
        neighborCandidateBuffer: { label: 'stub-diagnostic-sorted-law-neighbor-candidates' },
        neighborCandidateBufferByteLength: 4 * Float32Array.BYTES_PER_ELEMENT
      };
    },
    residentStepRunner: async (options) => ({
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
      status: 'resident-step-stubbed',
      hasActiveNodeSortedIndex: Boolean(options.schroederActiveNodeSortedIndex),
      hasLawNeighborCandidates: Boolean(options.schroederLawNeighborCandidates)
    })
  });

  assert.equal(lawNeighborCalls.length, 1);
  assert.equal(
    lawNeighborCalls[0].activeNodeSortedIndex.schema,
    ULG_SCHROEDER_ACTIVE_NODE_SORTED_INDEX_EXECUTION_SCHEMA
  );
  assert.equal(lawNeighborCalls[0].activeNodeSortedIndex.bucketCount, 8);
  assert.equal(result.activeNodeSortedIndexPolicyStatus, 'active-node-sorted-index-policy-selected-by-traversal-diagnostics');
  assert.equal(result.activeNodeSortedIndexSelection.diagnosticDrivenBuild, true);
  assert.equal(result.activeNodeSortedIndexSelection.diagnosticCountersAvailable, true);
  assert.equal(result.activeNodeSortedIndexSelection.shouldBuild, true);
  assert.equal(result.activeNodeSortedIndexStatus, 'schroeder-active-node-sorted-index-submitted');
  assert.equal(result.lawNeighborCandidates.activeNodeSortedIndexEnabled, true);
  assert.equal(result.lawNeighborCandidates.sortedRadixIndexRequired, true);
  assert.equal(result.residentStep.hasActiveNodeSortedIndex, true);
});

test('Schroeder same-level mechanics can run admitted state-delta merge before resident backend', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 4,
    tileCellCount: 4,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 3 }),
    farAggregateDiagnosticReadbackMode:
      SCHROEDER_COMPACT_FAR_AGGREGATE_DIAGNOSTIC_READBACK_MODE,
    mergeEpoch: 9,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasCrossLevelStateDeltaMerge: Boolean(options.schroederCrossLevelStateDeltaMerge),
        hasHierarchyAggregate: Boolean(options.schroederHierarchyAggregate),
        hasHierarchyAggregateNode: Boolean(options.schroederHierarchyAggregateNode),
        hasFarAggregateCandidates: Boolean(options.schroederFarAggregateCandidates),
        hasFarAggregateForceSummary: Boolean(options.schroederFarAggregateForceSummary),
        hasFarAggregateDiagnosticSummary: Boolean(options.schroederFarAggregateDiagnosticSummary),
        hasPhaseVolumeMigration: Boolean(options.schroederPhaseVolumeMigration),
        hasPhaseVolumeSplitMergeProposal: Boolean(options.schroederPhaseVolumeSplitMergeProposal),
        hasPhaseVolumeSplitMergeApply: Boolean(options.schroederPhaseVolumeSplitMergeApply),
        hasPhaseVolumeLevelUpdate: Boolean(options.schroederPhaseVolumeLevelUpdate),
        hasPhaseVolumeDiagnosticSummary: Boolean(options.schroederPhaseVolumeDiagnosticSummary)
      };
    }
  });

  assert.equal(result.crossLevelStateDeltaMerge.retainedMergedStateDeltaBuffer, true);
  assert.equal(result.crossLevelStateDeltaMerge.crossLevelCandidateCount, 3);
  assert.equal(result.crossLevelStateDeltaMerge.conservativeTransferStatus, 'state-delta-merge-submitted');
  assert.equal(result.crossLevelStateDeltaMerge.stateMutationStatus, 'admitted-state-delta-merge-buffer-submitted');
  assert.equal(result.crossLevelStateDeltaMerge.stateAuthorityStatus, 'state-manager-admitted-retained-merge-buffer');
  assert.equal(result.hierarchyAggregate.retainedAggregateBuffer, true);
  assert.equal(result.hierarchyAggregate.aggregateRowCount, 3);
  assert.equal(result.hierarchyAggregate.aggregateReductionStatus, 'pending-keyed-reduction');
  assert.equal(result.hierarchyAggregate.conservativeTransferStatus, 'hierarchy-aggregate-contributions-submitted');
  assert.equal(result.hierarchyAggregate.stateMutationStatus, 'aggregate-contribution-buffer-submitted');
  assert.equal(result.hierarchyAggregate.stateAuthorityStatus, 'state-manager-admitted-merge-buffer-materialized');
  assert.equal(result.hierarchyAggregateNode.retainedAggregateNodeBuffer, true);
  assert.equal(result.hierarchyAggregateNode.aggregateRowCount, 3);
  assert.equal(result.hierarchyAggregateNode.aggregateReductionStatus, 'exact-first-occurrence-global-scan');
  assert.equal(result.hierarchyAggregateNode.aggregateReductionMode, 'gpu-exact-global-scan-o-n2');
  assert.equal(result.hierarchyAggregateNode.conservativeTransferStatus, 'hierarchy-aggregate-nodes-submitted');
  assert.equal(result.hierarchyAggregateNode.stateMutationStatus, 'aggregate-node-buffer-submitted');
  assert.equal(result.hierarchyAggregateNode.stateAuthorityStatus, 'state-manager-admitted-aggregate-nodes-materialized');
  assert.equal(result.phaseVolumeTargetAggregate.retainedAggregateBuffer, true);
  assert.equal(result.phaseVolumeTargetAggregate.aggregateRowCount, 3);
  assert.equal(result.phaseVolumeTargetAggregate.aggregateSourceMode, 'phase-volume-target-level-assignment');
  assert.equal(
    result.phaseVolumeTargetAggregate.conservativeTransferStatus,
    'phase-volume-target-aggregate-contributions-submitted'
  );
  assert.equal(result.phaseVolumeTargetAggregateNode.retainedAggregateNodeBuffer, true);
  assert.equal(result.phaseVolumeTargetAggregateNode.aggregateRowCount, 3);
  assert.equal(result.phaseVolumeTargetAggregateNode.aggregateReductionStatus, 'exact-first-occurrence-global-scan');
  assert.equal(result.farAggregateCandidates.retainedFarAggregateCandidateBuffer, true);
  assert.equal(result.farAggregateCandidates.farAggregateCandidateCount, 96);
  assert.equal(result.farAggregateCandidates.traversalMode, 'barnes-hut-style-aggregate-opening-over-schroeder-nodes');
  assert.equal(
    result.farAggregateCandidates.aggregateAdmissibilityStatus,
    'aggregate-admissible-laws-only-local-incompressibility-and-reactions-excluded'
  );
  assert.equal(result.farAggregateCandidates.conservationStatus, 'read-only-aggregate-traversal-no-state-mutation');
  assert.equal(result.farAggregateForceSummary.retainedForceSummaryBuffer, true);
  assert.equal(result.farAggregateForceSummary.forceSummaryRowCount, 3);
  assert.equal(result.farAggregateForceSummary.forceMode, 'read-only-gravity-like-far-aggregate-acceleration-summary');
  assert.equal(result.farAggregateForceSummary.stateMutationRequired, false);
  assert.equal(result.farAggregateForceSummary.conservationStatus, 'read-only-force-summary-no-state-mutation');
  assert.equal(result.farAggregateDiagnosticSummary.retainedDiagnosticSummaryBuffer, true);
  assert.equal(result.farAggregateDiagnosticSummary.forceSummaryRowCount, 3);
  assert.equal(result.farAggregateDiagnosticSummary.diagnosticSummaryRowCount, 1);
  assert.equal(result.farAggregateDiagnosticSummary.compactSummaryReadbackPerformed, true);
  assert.equal(result.farAggregateDiagnosticSummary.diagnosticStatus, 'far-aggregate-diagnostics-submitted');
  assert.equal(result.farAggregateDiagnosticSummary.farFieldQualityStatus, 'far-aggregate-force-quality-pressure-submitted');
  assert.equal(result.farAggregateDiagnosticSummary.stateMutationRequired, false);
  assert.equal(result.farAggregateDiagnosticSummary.conservationStatus, 'diagnostic-summary-only-no-state-mutation');
  assert.equal(result.phaseVolumeMigration.retainedMigrationBuffer, true);
  assert.equal(result.phaseVolumeMigration.particleCount, 3);
  assert.equal(result.phaseVolumeMigration.aggregateNodeCount, 3);
  assert.equal(result.phaseVolumeMigration.aggregateNodeSourceMode, 'phase-volume-target-aggregate-node');
  assert.equal(
    result.phaseVolumeMigration.aggregateNodeSourceStatus,
    'schroeder-hierarchy-aggregate-node-reduction-submitted'
  );
  assert.equal(result.phaseVolumeMigration.phaseVolumeStatus, 'phase-volume-migration-submitted');
  assert.equal(result.phaseVolumeMigration.migrationMode, 'physical-volume-level-target-with-aggregate-coherence');
  assert.equal(result.phaseVolumeMigration.aggregateCoherenceRequirement, 'retained-aggregate-node-buffer-consumed');
  assert.equal(result.phaseVolumeMigration.refinePressurePolicy, 'explicit-gpu-row-mask-before-any-split-merge-mutation');
  assert.deepEqual(result.phaseVolumeMigration.refinePressureReasonBits, SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS);
  assert.equal(result.phaseVolumeMigration.conservativeTransferStatus, 'phase-volume-migration-submitted');
  assert.equal(result.phaseVolumeMigration.stateMutationStatus, 'phase-volume-migration-buffer-submitted');
  assert.equal(
    result.phaseVolumeMigration.stateAuthorityStatus,
    'requires-state-manager-admission-for-authoritative-level-migration'
  );
  assert.equal(result.phaseVolumeSplitMergeProposal.retainedProposalBuffer, true);
  assert.equal(result.phaseVolumeSplitMergeProposal.migrationRowCount, 3);
  assert.equal(result.phaseVolumeSplitMergeProposal.proposalMode, 'proposal-only-no-particle-mutation');
  assert.equal(
    result.phaseVolumeSplitMergeProposal.splitMergePolicy,
    'coarsen-eligible-merge-or-refine-pressure-split-proposals'
  );
  assert.equal(result.phaseVolumeSplitMergeProposal.mutationAdmissionRequiredBeforeApply, true);
  assert.equal(result.phaseVolumeSplitMergeProposal.stateMutationRequired, false);
  assert.equal(
    result.phaseVolumeSplitMergeProposal.stateAuthorityStatus,
    'state-manager-admission-required-before-any-particle-count-mutation'
  );
  assert.equal(result.phaseVolumeSplitMergeApply, null);
  assert.equal(result.phaseVolumeLevelUpdate, null);
  assert.equal(result.phaseVolumeDiagnosticSummary, null);
  assert.equal(result.crossLevelStateDeltaMergeStatus, 'schroeder-cross-level-state-delta-merge-submitted');
  assert.equal(result.hierarchyAggregateStatus, 'schroeder-hierarchy-aggregate-submitted');
  assert.equal(result.hierarchyAggregateNodeStatus, 'schroeder-hierarchy-aggregate-node-reduction-submitted');
  assert.equal(result.phaseVolumeTargetAggregateStatus, 'schroeder-phase-volume-target-aggregate-submitted');
  assert.equal(result.phaseVolumeTargetAggregateNodeStatus, 'schroeder-hierarchy-aggregate-node-reduction-submitted');
  assert.equal(result.farAggregateCandidateStatus, 'schroeder-far-aggregate-candidates-submitted');
  assert.equal(result.farAggregateCandidateConsumerStatus, 'far-aggregate-candidates-forwarded-to-resident-backend');
  assert.equal(result.farAggregateForceSummaryStatus, 'schroeder-far-aggregate-force-summary-submitted');
  assert.equal(result.farAggregateForceSummaryConsumerStatus, 'far-aggregate-force-summary-forwarded-to-resident-backend');
  assert.equal(result.farAggregateDiagnosticSummaryStatus, 'schroeder-far-aggregate-diagnostic-summary-submitted');
  assert.equal(
    result.farAggregateDiagnosticSummaryConsumerStatus,
    'far-aggregate-diagnostic-summary-forwarded-to-resident-backend'
  );
  assert.equal(result.phaseVolumeMigrationStatus, 'schroeder-phase-volume-migration-submitted');
  assert.equal(
    result.phaseVolumeSplitMergeProposalStatus,
    'schroeder-phase-volume-split-merge-proposal-submitted'
  );
  assert.equal(
    result.phaseVolumeSplitMergeProposalConsumerStatus,
    'phase-volume-split-merge-proposal-forwarded-to-resident-backend'
  );
  assert.equal(
    result.phaseVolumeSplitMergeApplyStatus,
    'disabled-phase-volume-split-merge-admission-not-provided'
  );
  assert.equal(
    result.phaseVolumeSplitMergeApplyConsumerStatus,
    'disabled-phase-volume-split-merge-admission-not-provided'
  );
  assert.equal(result.phaseVolumeLevelUpdateStatus, 'disabled-phase-volume-level-update-admission-not-provided');
  assert.equal(result.phaseVolumeDiagnosticSummaryStatus, 'disabled-phase-volume-level-update-admission-not-provided');
  assert.equal(result.conservativeTransferStatus, 'phase-volume-migration-submitted');
  assert.equal(result.stateMutationStatus, 'phase-volume-migration-buffer-submitted');
  assert.equal(result.stateAuthorityStatus, 'requires-state-manager-admission-for-authoritative-level-migration');
  assert.equal(result.residentStep.hasCrossLevelStateDeltaMerge, true);
  assert.equal(result.residentStep.hasHierarchyAggregate, true);
  assert.equal(result.residentStep.hasHierarchyAggregateNode, true);
  assert.equal(result.residentStep.hasFarAggregateCandidates, true);
  assert.equal(result.residentStep.hasFarAggregateForceSummary, true);
  assert.equal(result.residentStep.hasFarAggregateDiagnosticSummary, true);
  assert.equal(result.residentStep.hasPhaseVolumeMigration, true);
  assert.equal(result.residentStep.hasPhaseVolumeSplitMergeProposal, true);
  assert.equal(result.residentStep.hasPhaseVolumeSplitMergeApply, false);
  assert.equal(result.residentStep.hasPhaseVolumeLevelUpdate, false);
  assert.equal(result.residentStep.hasPhaseVolumeDiagnosticSummary, false);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederCrossLevelStateDeltaMerge.schema,
    ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederHierarchyAggregate.schema,
    ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederHierarchyAggregateNode.schema,
    ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederFarAggregateCandidates.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederFarAggregateForceSummary.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederFarAggregateDiagnosticSummary.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederPhaseVolumeMigration.schema,
    ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederPhaseVolumeSplitMergeProposal.schema,
    ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_EXECUTION_SCHEMA
  );
  assert.equal(calls[0].schroederPhaseVolumeSplitMergeApply, null);
  assert.equal(calls[0].schroederPhaseVolumeLevelUpdate, null);
  assert.equal(calls[0].schroederPhaseVolumeDiagnosticSummary, null);
  assert.deepEqual(
    device.dispatches,
    [[1, 1, 1], [1, 1, 1], [1, 1, 1], [3, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [2, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]
  );
});

test('Schroeder same-level mechanics forwards admitted far-force application deltas to resident backend', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 4,
    tileCellCount: 4,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 3 }),
    farAggregateForceApplicationAdmission: approvedFarAggregateForceApplicationAdmission({ rowCount: 3 }),
    enablePhaseVolumeMigration: false,
    mergeEpoch: 10,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasFarAggregateForceSummary: Boolean(options.schroederFarAggregateForceSummary),
        hasFarAggregateDiagnosticSummary: Boolean(options.schroederFarAggregateDiagnosticSummary),
        hasFarAggregateForceApplication: Boolean(options.schroederFarAggregateForceApplication),
        hasPhaseVolumeMigration: Boolean(options.schroederPhaseVolumeMigration)
      };
    }
  });

  assert.equal(result.farAggregateForceSummary.retainedForceSummaryBuffer, true);
  assert.equal(result.farAggregateDiagnosticSummary.retainedDiagnosticSummaryBuffer, true);
  assert.equal(result.farAggregateForceApplication.retainedForceApplicationBuffer, true);
  assert.equal(result.farAggregateForceApplication.forceSummaryRowCount, 3);
  assert.equal(result.farAggregateForceApplication.forceApplicationRowCount, 3);
  assert.equal(result.farAggregateForceApplication.forceApplicationMode, 'admitted-acceleration-to-velocity-momentum-delta');
  assert.equal(result.farAggregateForceApplication.farAggregateForceApplicationAdmissionApproved, true);
  assert.equal(result.farAggregateForceApplication.conservationStatus, 'force-application-delta-submitted');
  assert.equal(result.farAggregateForceApplication.energyPolicy, 'kinetic-delta-reported-potential-read-only');
  assert.equal(result.farAggregateForceApplication.stateMutationRequired, true);
  assert.equal(
    result.farAggregateForceApplication.stateMutationStatus,
    'admitted-far-aggregate-force-application-buffer-submitted'
  );
  assert.equal(
    result.farAggregateForceApplication.stateAuthorityStatus,
    'state-manager-admitted-retained-force-application-buffer'
  );
  assert.equal(result.farAggregateForceApplicationStatus, 'schroeder-far-aggregate-force-application-submitted');
  assert.equal(
    result.farAggregateForceApplicationConsumerStatus,
    'far-aggregate-force-application-forwarded-to-resident-backend'
  );
  assert.equal(result.phaseVolumeMigration, null);
  assert.equal(result.phaseVolumeMigrationStatus, 'disabled-phase-volume-migration');
  assert.equal(result.conservativeTransferStatus, 'force-application-delta-submitted');
  assert.equal(result.stateMutationStatus, 'admitted-far-aggregate-force-application-buffer-submitted');
  assert.equal(result.stateAuthorityStatus, 'state-manager-admitted-retained-force-application-buffer');
  assert.equal(result.residentStep.hasFarAggregateForceSummary, true);
  assert.equal(result.residentStep.hasFarAggregateDiagnosticSummary, true);
  assert.equal(result.residentStep.hasFarAggregateForceApplication, true);
  assert.equal(result.residentStep.hasPhaseVolumeMigration, false);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederFarAggregateForceApplication.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA
  );
  assert.equal(calls[0].schroederPhaseVolumeMigration, null);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederFarAggregateForceApplicationParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('force-application-readback')),
    false
  );
});

test('Schroeder same-level mechanics forwards admitted phase-volume split/merge apply intents', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 4,
    tileCellCount: 4,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 3 }),
    phaseVolumeSplitMergeAdmission: approvedPhaseVolumeSplitMergeAdmission({ rowCount: 3 }),
    mergeEpoch: 13,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasPhaseVolumeMigration: Boolean(options.schroederPhaseVolumeMigration),
        hasPhaseVolumeSplitMergeProposal: Boolean(options.schroederPhaseVolumeSplitMergeProposal),
        hasPhaseVolumeSplitMergeApply: Boolean(options.schroederPhaseVolumeSplitMergeApply),
        hasParticleStorageAllocation: Boolean(options.schroederParticleStorageAllocation),
        hasPhaseVolumeLevelUpdate: Boolean(options.schroederPhaseVolumeLevelUpdate)
      };
    }
  });

  assert.equal(result.phaseVolumeMigration.retainedMigrationBuffer, true);
  assert.equal(result.phaseVolumeSplitMergeProposal.retainedProposalBuffer, true);
  assert.equal(result.phaseVolumeSplitMergeApply.retainedApplyBuffer, true);
  assert.equal(result.phaseVolumeSplitMergeApply.proposalRowCount, 3);
  assert.equal(result.phaseVolumeSplitMergeApply.outputCompaction, 'one-admitted-phase-volume-split-merge-apply-row-per-proposal-row');
  assert.equal(result.phaseVolumeSplitMergeApply.applyMode, 'state-manager-admitted-split-merge-intent');
  assert.equal(result.phaseVolumeSplitMergeApply.phaseVolumeSplitMergeAdmissionApproved, true);
  assert.equal(
    result.phaseVolumeSplitMergeApply.particleStorageMutationStatus,
    'deferred-to-state-manager-particle-storage-allocator'
  );
  assert.equal(result.phaseVolumeSplitMergeApply.stateMutationRequired, true);
  assert.equal(result.phaseVolumeSplitMergeApply.stateMutationStatus, 'phase-volume-split-merge-apply-buffer-submitted');
  assert.equal(
    result.phaseVolumeSplitMergeApply.stateAuthorityStatus,
    'state-manager-admitted-phase-volume-split-merge-apply-materialized'
  );
  assert.equal(result.particleStorageAllocation, null);
  assert.equal(result.phaseVolumeLevelUpdate, null);
  assert.equal(result.phaseVolumeSplitMergeApplyStatus, 'schroeder-phase-volume-split-merge-apply-submitted');
  assert.equal(
    result.phaseVolumeSplitMergeApplyConsumerStatus,
    'phase-volume-split-merge-apply-forwarded-to-resident-backend'
  );
  assert.equal(
    result.particleStorageAllocationStatus,
    'disabled-particle-storage-allocator-admission-not-provided'
  );
  assert.equal(result.phaseVolumeLevelUpdateStatus, 'disabled-phase-volume-level-update-admission-not-provided');
  assert.equal(result.conservativeTransferStatus, 'phase-volume-split-merge-apply-submitted');
  assert.equal(result.stateMutationStatus, 'phase-volume-split-merge-apply-buffer-submitted');
  assert.equal(result.stateAuthorityStatus, 'state-manager-admitted-phase-volume-split-merge-apply-materialized');
  assert.equal(result.residentStep.hasPhaseVolumeMigration, true);
  assert.equal(result.residentStep.hasPhaseVolumeSplitMergeProposal, true);
  assert.equal(result.residentStep.hasPhaseVolumeSplitMergeApply, true);
  assert.equal(result.residentStep.hasParticleStorageAllocation, false);
  assert.equal(result.residentStep.hasPhaseVolumeLevelUpdate, false);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederPhaseVolumeSplitMergeApply.schema,
    ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA
  );
  assert.equal(calls[0].schroederParticleStorageAllocation, null);
  assert.equal(calls[0].schroederPhaseVolumeLevelUpdate, null);
  assert.equal(device.dispatches.length, 19);
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('split-merge-apply-readback')),
    false
  );
});

test('Schroeder same-level mechanics forwards admitted particle-storage allocation intents', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 4,
    tileCellCount: 4,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 3 }),
    phaseVolumeSplitMergeAdmission: approvedPhaseVolumeSplitMergeAdmission({ rowCount: 3 }),
    particleStorageAllocatorAdmission: approvedParticleStorageAllocatorAdmission({
      rowCount: 3,
      currentParticleCapacity: 8,
      requiredParticleCapacity: 6
    }),
    mergeEpoch: 14,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasPhaseVolumeSplitMergeApply: Boolean(options.schroederPhaseVolumeSplitMergeApply),
        hasParticleStorageAllocation: Boolean(options.schroederParticleStorageAllocation),
        hasParticleStorageSlotAssignment: Boolean(options.schroederParticleStorageSlotAssignment),
        hasPhaseVolumeLevelUpdate: Boolean(options.schroederPhaseVolumeLevelUpdate)
      };
    }
  });

  assert.equal(result.phaseVolumeSplitMergeApply.retainedApplyBuffer, true);
  assert.equal(result.particleStorageAllocation.retainedAllocationBuffer, true);
  assert.equal(result.particleStorageAllocation.applyRowCount, 3);
  assert.equal(result.particleStorageAllocation.outputCompaction, 'one-admitted-particle-storage-allocation-row-per-apply-row');
  assert.equal(result.particleStorageAllocation.allocationMode, 'state-manager-admitted-slot-allocation-intents');
  assert.equal(result.particleStorageAllocation.slotAssignmentStatus, 'sentinel-slot-indices-await-free-list-compaction');
  assert.equal(result.particleStorageAllocation.particleStorageAllocatorAdmissionApproved, true);
  assert.deepEqual(result.particleStorageAllocation.targetStateFamilies, SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES);
  assert.equal(result.particleStorageAllocation.targetStateFamilyMask, SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK);
  assert.equal(result.particleStorageAllocation.currentParticleCapacity, 3);
  assert.equal(result.particleStorageAllocation.requiredParticleCapacity, 6);
  assert.equal(
    result.particleStorageAllocation.particleStorageMutationStatus,
    'allocation-intents-ready-no-particle-buffer-resize'
  );
  assert.equal(result.particleStorageAllocation.stateMutationRequired, true);
  assert.equal(result.particleStorageAllocation.stateMutationStatus, 'particle-storage-allocation-buffer-submitted');
  assert.equal(
    result.particleStorageAllocation.stateAuthorityStatus,
    'state-manager-admitted-particle-storage-allocation-materialized'
  );
  assert.equal(result.particleStorageSlotAssignment, null);
  assert.equal(result.phaseVolumeLevelUpdate, null);
  assert.equal(result.particleStorageAllocationStatus, 'schroeder-particle-storage-allocation-submitted');
  assert.equal(
    result.particleStorageAllocationConsumerStatus,
    'particle-storage-allocation-forwarded-to-resident-backend'
  );
  assert.equal(result.particleStorageSlotAssignmentStatus, 'disabled-particle-storage-free-list-not-provided');
  assert.equal(result.phaseVolumeLevelUpdateStatus, 'disabled-phase-volume-level-update-admission-not-provided');
  assert.equal(result.conservativeTransferStatus, 'particle-storage-allocation-submitted');
  assert.equal(result.stateMutationStatus, 'particle-storage-allocation-buffer-submitted');
  assert.equal(result.stateAuthorityStatus, 'state-manager-admitted-particle-storage-allocation-materialized');
  assert.equal(result.residentStep.hasPhaseVolumeSplitMergeApply, true);
  assert.equal(result.residentStep.hasParticleStorageAllocation, true);
  assert.equal(result.residentStep.hasParticleStorageSlotAssignment, false);
  assert.equal(result.residentStep.hasPhaseVolumeLevelUpdate, false);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederParticleStorageAllocation.schema,
    ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATION_EXECUTION_SCHEMA
  );
  assert.equal(calls[0].schroederParticleStorageSlotAssignment, null);
  assert.equal(calls[0].schroederPhaseVolumeLevelUpdate, null);
  assert.equal(device.dispatches.length, 20);
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('particle-storage-allocation-readback')),
    false
  );
});

test('Schroeder same-level mechanics forwards admitted particle-storage slot assignments', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const particleStorageFreeList = createSchroederParticleStorageFreeListPlan({
    baseSlotIndex: 32,
    slotCapacity: 96,
    availableSlotCount: 64,
    maxSlotsPerRow: 2
  });
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 4,
    tileCellCount: 4,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 3 }),
    phaseVolumeSplitMergeAdmission: approvedPhaseVolumeSplitMergeAdmission({ rowCount: 3 }),
    particleStorageAllocatorAdmission: approvedParticleStorageAllocatorAdmission({
      rowCount: 3,
      currentParticleCapacity: 8,
      requiredParticleCapacity: 6
    }),
    particleStorageFreeList,
    particleStorageSlotAssignmentAdmission: approvedParticleStorageSlotAssignmentAdmission({ rowCount: 3 }),
    mergeEpoch: 15,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasParticleStorageAllocation: Boolean(options.schroederParticleStorageAllocation),
        hasParticleStorageSlotAssignment: Boolean(options.schroederParticleStorageSlotAssignment),
        hasParticleStorageMaterialization: Boolean(options.schroederParticleStorageMaterialization),
        hasPhaseVolumeLevelUpdate: Boolean(options.schroederPhaseVolumeLevelUpdate)
      };
    }
  });

  assert.equal(result.particleStorageAllocation.retainedAllocationBuffer, true);
  assert.equal(result.particleStorageSlotAssignment.retainedSlotAssignmentBuffer, true);
  assert.equal(result.particleStorageSlotAssignment.allocationRowCount, 3);
  assert.equal(result.particleStorageSlotAssignment.outputCompaction, 'one-admitted-slot-assignment-row-per-allocation-row');
  assert.equal(result.particleStorageSlotAssignment.assignmentMode, 'state-manager-admitted-free-list-slot-assignment');
  assert.equal(result.particleStorageSlotAssignment.particleStorageSlotAssignmentAdmissionApproved, true);
  assert.deepEqual(result.particleStorageSlotAssignment.targetStateFamilies, SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES);
  assert.equal(result.particleStorageSlotAssignment.targetStateFamilyMask, SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_MASK);
  assert.equal(result.particleStorageSlotAssignment.sourceParticleStorageFreeListSchema, ULG_SCHROEDER_PARTICLE_STORAGE_FREE_LIST_SCHEMA);
  assert.equal(
    result.particleStorageSlotAssignment.particleStorageMutationStatus,
    'slot-assignments-ready-no-particle-buffer-write'
  );
  assert.equal(result.particleStorageSlotAssignment.stateMutationRequired, true);
  assert.equal(
    result.particleStorageSlotAssignment.stateMutationStatus,
    'particle-storage-slot-assignment-buffer-submitted'
  );
  assert.equal(
    result.particleStorageSlotAssignment.stateAuthorityStatus,
    'state-manager-admitted-particle-storage-slot-assignment-materialized'
  );
  assert.equal(result.particleStorageMaterialization, null);
  assert.equal(result.phaseVolumeLevelUpdate, null);
  assert.equal(result.particleStorageSlotAssignmentStatus, 'schroeder-particle-storage-slot-assignment-submitted');
  assert.equal(
    result.particleStorageSlotAssignmentConsumerStatus,
    'particle-storage-slot-assignment-forwarded-to-resident-backend'
  );
  assert.equal(
    result.particleStorageMaterializationStatus,
    'disabled-particle-storage-materialization-admission-not-provided'
  );
  assert.equal(result.conservativeTransferStatus, 'particle-storage-slot-assignment-submitted');
  assert.equal(result.stateMutationStatus, 'particle-storage-slot-assignment-buffer-submitted');
  assert.equal(result.stateAuthorityStatus, 'state-manager-admitted-particle-storage-slot-assignment-materialized');
  assert.equal(result.residentStep.hasParticleStorageAllocation, true);
  assert.equal(result.residentStep.hasParticleStorageSlotAssignment, true);
  assert.equal(result.residentStep.hasParticleStorageMaterialization, false);
  assert.equal(result.residentStep.hasPhaseVolumeLevelUpdate, false);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederParticleStorageSlotAssignment.schema,
    ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_EXECUTION_SCHEMA
  );
  assert.equal(calls[0].schroederParticleStorageMaterialization, null);
  assert.equal(calls[0].schroederPhaseVolumeLevelUpdate, null);
  assert.equal(device.dispatches.length, 21);
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('slot-assignment-readback')),
    false
  );
});

test('Schroeder same-level mechanics forwards admitted particle-storage materialization buffers', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const particleStorageFreeList = createSchroederParticleStorageFreeListPlan({
    baseSlotIndex: 32,
    slotCapacity: 96,
    availableSlotCount: 64,
    maxSlotsPerRow: 2
  });
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 4,
    tileCellCount: 4,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 3 }),
    phaseVolumeSplitMergeAdmission: approvedPhaseVolumeSplitMergeAdmission({ rowCount: 3 }),
    particleStorageAllocatorAdmission: approvedParticleStorageAllocatorAdmission({
      rowCount: 3,
      currentParticleCapacity: 8,
      requiredParticleCapacity: 6
    }),
    particleStorageFreeList,
    particleStorageSlotAssignmentAdmission: approvedParticleStorageSlotAssignmentAdmission({ rowCount: 3 }),
    particleStorageMaterializationAdmission: approvedParticleStorageMaterializationAdmission({
      rowCount: 3,
      requiredParticleCapacity: 8
    }),
    particleStorageCountSummary: {
      schema: 'peercompute.ulg.schroeder-particle-storage-count-summary-execution.v0',
      status: 'schroeder-particle-storage-count-summary-submitted',
      admittedParticleCountDelta: 1,
      countSummary: {
        materializationRowCount: 3,
        admittedRowCount: 3,
        writtenTargetSlotCount: 3,
        appendedTargetSlotCount: 1,
        freedSourceSlotCount: 0,
        admittedParticleCountDelta: 1,
        blockedRowCount: 0
      }
    },
    mergeEpoch: 16,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasParticleStorageAllocation: Boolean(options.schroederParticleStorageAllocation),
        hasParticleStorageSlotAssignment: Boolean(options.schroederParticleStorageSlotAssignment),
        hasParticleStorageMaterialization: Boolean(options.schroederParticleStorageMaterialization),
        hasPhaseVolumeLevelUpdate: Boolean(options.schroederPhaseVolumeLevelUpdate)
      };
    }
  });

  assert.equal(result.particleStorageAllocation.retainedAllocationBuffer, true);
  assert.equal(result.particleStorageSlotAssignment.retainedSlotAssignmentBuffer, true);
  assert.equal(result.particleStorageMaterialization.retainedParticleBuffers, true);
  assert.equal(result.particleStorageMaterialization.retainedMaterializationBuffer, true);
  assert.equal(result.particleStorageMaterialization.assignmentRowCount, 3);
  assert.equal(result.particleStorageMaterialization.sourceParticleCount, 3);
  assert.equal(result.particleStorageMaterialization.outputParticleCapacity, 8);
  assert.equal(
    result.particleStorageMaterialization.outputCompaction,
    'one-admitted-particle-storage-materialization-row-per-assignment-row'
  );
  assert.equal(
    result.particleStorageMaterialization.materializationMode,
    'state-manager-admitted-particle-buffer-materialization'
  );
  assert.equal(
    result.particleStorageMaterialization.replacementPolicy,
    'retained-output-buffers-await-state-manager-swap'
  );
  assert.equal(result.particleStorageMaterialization.particleStorageMaterializationAdmissionApproved, true);
  assert.equal(
    result.particleStorageMaterialization.particleStorageMutationStatus,
    'particle-buffers-materialization-ready'
  );
  assert.equal(result.particleStorageMaterialization.stateMutationRequired, true);
  assert.equal(
    result.particleStorageMaterialization.stateMutationStatus,
    'particle-storage-materialization-buffer-submitted'
  );
  assert.equal(
    result.particleStorageMaterialization.stateAuthorityStatus,
    'state-manager-admitted-particle-storage-materialization-materialized'
  );
  assert.equal(result.particleStorageMaterialization.stateBufferByteLength, 8 * 8 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(result.particleStorageMaterialization.thermoBufferByteLength, 8 * 12 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(
    result.particleStorageMaterialization.mechanicsBufferByteLength,
    8 * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(
    result.particleStorageMaterialization.materializationBufferByteLength,
    3 * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(
    result.particleStorageMaterializationStatus,
    'schroeder-particle-storage-materialization-submitted'
  );
  assert.equal(
    result.particleStorageMaterializationConsumerStatus,
    'particle-storage-materialization-forwarded-to-resident-backend'
  );
  assert.equal(result.conservativeTransferStatus, 'particle-storage-materialization-submitted');
  assert.equal(result.stateMutationStatus, 'particle-storage-materialization-buffer-submitted');
  assert.equal(result.stateAuthorityStatus, 'state-manager-admitted-particle-storage-materialization-materialized');
  assert.equal(result.residentStep.hasParticleStorageAllocation, true);
  assert.equal(result.residentStep.hasParticleStorageSlotAssignment, true);
  assert.equal(result.residentStep.hasParticleStorageMaterialization, true);
  assert.equal(result.residentStep.hasPhaseVolumeLevelUpdate, false);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederParticleStorageMaterialization.schema,
    ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA
  );
  assert.equal(calls[0].schroederPhaseVolumeLevelUpdate, null);
  // 22 SS prepass dispatches; the count summary is caller-injected here so
  // the default-on summary reduction dispatch does not run.
  assert.equal(device.dispatches.length, 22);
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('materialization-readback')),
    false
  );
  assert.equal(
    result.particleStorageCountSummary?.status,
    'schroeder-particle-storage-count-summary-submitted'
  );
  // Zeroed fake-device readback reports no freed slots, so compaction skips.
  assert.equal(result.particleStorageCompaction, null);
});

test('Schroeder same-level mechanics forwards admitted far-aggregate law consumers to resident backend', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 4,
    tileCellCount: 4,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 3 }),
    farAggregateLawConsumerAdmission: approvedFarAggregateLawConsumerAdmission({ rowCount: 3 }),
    farAggregateLawConsumerRadiationScale: 2,
    farAggregateLawConsumerPlasmaScale: 3,
    farAggregateLawConsumerGasSummaryScale: 4,
    farAggregateDiagnosticReadbackMode:
      SCHROEDER_COMPACT_FAR_AGGREGATE_DIAGNOSTIC_READBACK_MODE,
    farAggregateLawConsumerDiagnosticReadbackMode:
      SCHROEDER_COMPACT_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_READBACK_MODE,
    enablePhaseVolumeMigration: false,
    mergeEpoch: 11,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasFarAggregateForceSummary: Boolean(options.schroederFarAggregateForceSummary),
        hasFarAggregateDiagnosticSummary: Boolean(options.schroederFarAggregateDiagnosticSummary),
        hasFarAggregateLawConsumer: Boolean(options.schroederFarAggregateLawConsumer),
        hasFarAggregateLawConsumerDiagnosticSummary: Boolean(
          options.schroederFarAggregateLawConsumerDiagnosticSummary
        ),
        hasFarAggregateLawConsumerAuthorityPolicy: Boolean(
          options.schroederFarAggregateLawConsumerAuthorityPolicy
        ),
        hasFarAggregateForceApplication: Boolean(options.schroederFarAggregateForceApplication),
        hasPhaseVolumeMigration: Boolean(options.schroederPhaseVolumeMigration)
      };
    }
  });

  assert.equal(result.farAggregateForceSummary.retainedForceSummaryBuffer, true);
  assert.equal(result.farAggregateDiagnosticSummary.retainedDiagnosticSummaryBuffer, true);
  assert.equal(result.farAggregateLawConsumer.retainedLawConsumerBuffer, true);
  assert.equal(result.farAggregateLawConsumer.forceSummaryRowCount, 3);
  assert.equal(result.farAggregateLawConsumer.lawConsumerRowCount, 3);
  assert.equal(result.farAggregateLawConsumer.consumerMode, 'read-only-radiation-plasma-gas-summary-proxies');
  assert.deepEqual(result.farAggregateLawConsumer.lawFamilies, ['radiation', 'plasma-electromagnetic', 'gas-summary']);
  assert.equal(result.farAggregateLawConsumer.farAggregateLawConsumerAdmissionApproved, true);
  assert.equal(result.farAggregateLawConsumer.conservationStatus, 'law-consumer-summary-submitted-no-state-mutation');
  assert.equal(result.farAggregateLawConsumer.stateMutationRequired, false);
  assert.equal(
    result.farAggregateLawConsumer.stateMutationStatus,
    'admitted-far-aggregate-law-consumer-buffer-submitted'
  );
  assert.equal(
    result.farAggregateLawConsumer.stateAuthorityStatus,
    'state-manager-admitted-read-only-far-aggregate-law-consumer'
  );
  assert.equal(result.farAggregateLawConsumerStatus, 'schroeder-far-aggregate-law-consumer-submitted');
  assert.equal(
    result.farAggregateLawConsumerConsumerStatus,
    'far-aggregate-law-consumer-forwarded-to-resident-backend'
  );
  assert.equal(result.farAggregateLawConsumerDiagnosticSummary.retainedDiagnosticSummaryBuffer, true);
  assert.equal(result.farAggregateLawConsumerDiagnosticSummary.lawConsumerRowCount, 3);
  assert.equal(result.farAggregateLawConsumerDiagnosticSummary.lawConsumerDiagnosticSummaryRowCount, 1);
  assert.equal(
    result.farAggregateLawConsumerDiagnosticSummary.status,
    'schroeder-far-aggregate-law-consumer-diagnostic-summary-submitted'
  );
  assert.equal(
    result.farAggregateLawConsumerDiagnosticSummary.conservationStatus,
    'law-consumer-diagnostic-summary-only-no-state-mutation'
  );
  assert.equal(
    result.farAggregateLawConsumerDiagnosticSummary.stateMutationStatus,
    'far-aggregate-law-consumer-diagnostic-summary-only-no-state-mutation'
  );
  assert.equal(
    result.farAggregateLawConsumerDiagnosticSummaryStatus,
    'schroeder-far-aggregate-law-consumer-diagnostic-summary-submitted'
  );
  assert.equal(
    result.farAggregateLawConsumerDiagnosticSummaryConsumerStatus,
    'far-aggregate-law-consumer-diagnostic-summary-forwarded-to-resident-backend'
  );
  assert.equal(
    result.farAggregateLawConsumerAuthorityPolicy.status,
    'schroeder-far-aggregate-law-consumer-authority-policy-read-only-summary'
  );
  assert.equal(result.farAggregateLawConsumerAuthorityPolicy.diagnosticRowsAvailable, true);
  assert.equal(result.farAggregateLawConsumerAuthorityPolicy.pressureSignalDetected, false);
  assert.equal(result.farAggregateLawConsumerAuthorityPolicy.recommendedStateDeltaRequired, false);
  assert.equal(result.farAggregateLawConsumerAuthorityPolicy.stateDeltaAdmissionRequired, false);
  assert.equal(result.farAggregateLawConsumerAuthorityPolicy.stateMutationRequired, false);
  assert.equal(
    result.farAggregateLawConsumerAuthorityPolicy.stateMutationStatus,
    'far-field-consumer-remains-read-only-summary'
  );
  assert.equal(
    result.farAggregateLawConsumerAuthorityPolicyStatus,
    'schroeder-far-aggregate-law-consumer-authority-policy-read-only-summary'
  );
  assert.equal(
    result.farAggregateLawConsumerAuthorityPolicyConsumerStatus,
    'far-aggregate-law-consumer-authority-policy-forwarded-to-resident-backend'
  );
  assert.equal(result.farAggregateForceApplication, null);
  assert.equal(result.farAggregateForceApplicationStatus, 'disabled-far-aggregate-force-application-admission-not-provided');
  assert.equal(result.phaseVolumeMigration, null);
  assert.equal(result.phaseVolumeMigrationStatus, 'disabled-phase-volume-migration');
  assert.equal(result.conservativeTransferStatus, 'law-consumer-summary-submitted-no-state-mutation');
  assert.equal(result.stateMutationStatus, 'admitted-far-aggregate-law-consumer-buffer-submitted');
  assert.equal(result.stateAuthorityStatus, 'state-manager-admitted-read-only-far-aggregate-law-consumer');
  assert.equal(result.residentStep.hasFarAggregateForceSummary, true);
  assert.equal(result.residentStep.hasFarAggregateDiagnosticSummary, true);
  assert.equal(result.residentStep.hasFarAggregateLawConsumer, true);
  assert.equal(result.residentStep.hasFarAggregateLawConsumerDiagnosticSummary, true);
  assert.equal(result.residentStep.hasFarAggregateLawConsumerAuthorityPolicy, true);
  assert.equal(result.residentStep.hasFarAggregateForceApplication, false);
  assert.equal(result.residentStep.hasPhaseVolumeMigration, false);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederFarAggregateLawConsumer.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederFarAggregateLawConsumerDiagnosticSummary.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederFarAggregateLawConsumerAuthorityPolicy.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_AUTHORITY_POLICY_SCHEMA
  );
  assert.equal(calls[0].schroederFarAggregateForceApplication, null);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederFarAggregateLawConsumerParams')));
  assert.ok(
    device.shaderModules.some((module) => (
      module.code.includes('SchroederFarAggregateLawConsumerDiagnosticSummaryParams')
    ))
  );
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('law-consumer-readback')),
    false
  );
  assert.equal(
    device.createdBuffers.some((buffer) => (
      String(buffer.label).includes('law-consumer-diagnostic-summary-readback')
    )),
    true
  );
});

test('Schroeder same-level mechanics forwards admitted far-aggregate gas state deltas to resident backend', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 4,
    tileCellCount: 4,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 3 }),
    farAggregateLawConsumerAdmission: approvedFarAggregateLawConsumerAdmission({ rowCount: 3 }),
    farAggregateGasStateDeltaAdmission: approvedFarAggregateGasStateDeltaAdmission({ rowCount: 3 }),
    farAggregateLawConsumerAuthorityPolicy: {
      schema: ULG_SCHROEDER_FAR_AGGREGATE_LAW_CONSUMER_AUTHORITY_POLICY_SCHEMA,
      status: 'schroeder-far-aggregate-law-consumer-authority-policy-state-delta-admission-required',
      diagnosticRowsAvailable: true,
      lawConsumerRowCount: 3,
      activeConsumerCount: 3,
      blockedConsumerCount: 0,
      pressureConsumerCount: 3,
      pressureRatio: 1,
      pressureRatioThreshold: 0.4,
      pressureSignalDetected: true,
      allowStateDeltaMutation: true,
      recommendedStateDeltaRequired: true,
      stateDeltaAdmissionRequired: true,
      authorityBoundary: 'diagnostic-policy-only-no-authoritative-mutation',
      mutationPolicy: 'state-delta-admission-required-before-any-far-field-consumer-mutation',
      conservationStatus: 'future-far-field-consumer-state-delta-requires-admission',
      stateMutationRequired: false,
      stateMutationStatus: 'far-field-consumer-state-delta-requires-new-admission',
      stateAuthorityStatus: 'requires-state-manager-admission-before-far-field-consumer-state-delta',
      fullParticleReadbackRequired: false
    },
    farAggregateGasStateDeltaReferencePressurePa: 100000,
    farAggregateGasStateDeltaPressureScale: 0.5,
    farAggregateGasStateDeltaDensityScale: 2,
    farAggregateGasStateDeltaGamma: 1.3,
    enablePhaseVolumeMigration: false,
    mergeEpoch: 13,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasFarAggregateLawConsumer: Boolean(options.schroederFarAggregateLawConsumer),
        hasFarAggregateLawConsumerAuthorityPolicy: Boolean(
          options.schroederFarAggregateLawConsumerAuthorityPolicy
        ),
        hasFarAggregateGasStateDelta: Boolean(options.schroederFarAggregateGasStateDelta),
        hasFarAggregateGasCellImport: Boolean(options.schroederFarAggregateGasCellImport),
        hasFarAggregateForceApplication: Boolean(options.schroederFarAggregateForceApplication),
        hasPhaseVolumeMigration: Boolean(options.schroederPhaseVolumeMigration)
      };
    }
  });

  assert.equal(result.farAggregateGasStateDelta.retainedGasStateDeltaBuffer, true);
  assert.equal(result.farAggregateGasStateDelta.gasStateDeltaRowCount, 3);
  assert.equal(result.farAggregateGasStateDelta.targetStateFamily, SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_TARGET_FAMILY);
  assert.equal(result.farAggregateGasStateDelta.pressureInterfaceImportRequired, true);
  assert.equal(result.farAggregateGasStateDelta.farAggregateGasStateDeltaAdmissionApproved, true);
  assert.equal(result.farAggregateGasStateDelta.stateMutationRequired, true);
  assert.equal(
    result.farAggregateGasStateDelta.stateMutationStatus,
    'admitted-far-aggregate-gas-state-delta-buffer-submitted'
  );
  assert.equal(
    result.farAggregateGasStateDelta.stateAuthorityStatus,
    'state-manager-admitted-retained-gas-state-delta-buffer'
  );
  assert.equal(result.farAggregateGasStateDeltaStatus, 'schroeder-far-aggregate-gas-state-delta-submitted');
  assert.equal(
    result.farAggregateGasStateDeltaConsumerStatus,
    'far-aggregate-gas-state-delta-forwarded-to-resident-backend'
  );
  assert.equal(result.farAggregateGasCellImport.status, 'schroeder-far-aggregate-gas-cell-import-submitted');
  assert.equal(result.farAggregateGasCellImport.gasPressureCellRowCount, 3);
  assert.equal(result.farAggregateGasCellImport.pressureInterfaceGasPressureCellRowCount, 3);
  assert.equal(result.farAggregateGasCellImport.pressureInterfaceImportReady, true);
  assert.equal(result.farAggregateGasCellImport.retainedGasCellFieldSourceReady, true);
  assert.equal(result.farAggregateGasCellImport.retainedGasPressureCellsBuffer, true);
  assert.equal(result.farAggregateGasCellImport.gasCellFieldSnapshotReady, false);
  assert.equal(result.farAggregateGasCellImport.localPressureGradientReady, false);
  assert.equal(
    result.farAggregateGasCellImport.conservativeTransferStatus,
    'retained-gas-pressure-cells-ready-for-pressure-interface'
  );
  assert.equal(result.farAggregateGasCellImportStatus, 'schroeder-far-aggregate-gas-cell-import-submitted');
  assert.equal(
    result.farAggregateGasCellImportConsumerStatus,
    'far-aggregate-gas-cell-import-forwarded-to-resident-backend'
  );
  assert.equal(result.farAggregateForceApplication, null);
  assert.equal(result.phaseVolumeMigration, null);
  assert.equal(
    result.conservativeTransferStatus,
    'retained-gas-pressure-cells-ready-for-pressure-interface'
  );
  assert.equal(result.stateMutationStatus, 'admitted-far-aggregate-gas-state-delta-buffer-submitted');
  assert.equal(result.stateAuthorityStatus, 'state-manager-admitted-retained-gas-state-delta-buffer');
  assert.equal(result.residentStep.hasFarAggregateLawConsumer, true);
  assert.equal(result.residentStep.hasFarAggregateLawConsumerAuthorityPolicy, true);
  assert.equal(result.residentStep.hasFarAggregateGasStateDelta, true);
  assert.equal(result.residentStep.hasFarAggregateGasCellImport, true);
  assert.equal(result.residentStep.hasFarAggregateForceApplication, false);
  assert.equal(result.residentStep.hasPhaseVolumeMigration, false);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederFarAggregateGasStateDelta.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederFarAggregateGasCellImport.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA
  );
  assert.equal(calls[0].schroederFarAggregateGasCellImport.pressureInterfaceImportReady, true);
  assert.equal(calls[0].schroederFarAggregateGasCellImport.gasPressureCellsBuffer.destroyed, false);
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederFarAggregateGasStateDeltaParams')));
  assert.ok(device.shaderModules.some((module) => module.code.includes('SchroederFarAggregateGasCellImportParams')));
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('gas-state-delta-readback')),
    false
  );
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('gas-cell-import-readback')),
    false
  );
});

test('Schroeder same-level mechanics can apply admitted phase-volume level updates before resident backend', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 4,
    tileCellCount: 4,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 3 }),
    phaseVolumeMigrationAdmission: approvedPhaseVolumeMigrationAdmission({ rowCount: 3 }),
    farAggregateDiagnosticReadbackMode:
      SCHROEDER_COMPACT_FAR_AGGREGATE_DIAGNOSTIC_READBACK_MODE,
    phaseVolumeDiagnosticReadbackMode:
      SCHROEDER_COMPACT_PHASE_VOLUME_DIAGNOSTIC_READBACK_MODE,
    mergeEpoch: 12,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasFarAggregateCandidates: Boolean(options.schroederFarAggregateCandidates),
        hasFarAggregateForceSummary: Boolean(options.schroederFarAggregateForceSummary),
        hasFarAggregateDiagnosticSummary: Boolean(options.schroederFarAggregateDiagnosticSummary),
        hasPhaseVolumeMigration: Boolean(options.schroederPhaseVolumeMigration),
        hasPhaseVolumeSplitMergeProposal: Boolean(options.schroederPhaseVolumeSplitMergeProposal),
        hasPhaseVolumeSplitMergeApply: Boolean(options.schroederPhaseVolumeSplitMergeApply),
        hasPhaseVolumeLevelUpdate: Boolean(options.schroederPhaseVolumeLevelUpdate),
        hasPhaseVolumeDiagnosticSummary: Boolean(options.schroederPhaseVolumeDiagnosticSummary)
      };
    }
  });

  assert.equal(result.phaseVolumeMigration.retainedMigrationBuffer, true);
  assert.equal(result.phaseVolumeMigration.aggregateNodeSourceMode, 'phase-volume-target-aggregate-node');
  assert.equal(result.phaseVolumeSplitMergeProposal.retainedProposalBuffer, true);
  assert.equal(result.phaseVolumeSplitMergeProposal.migrationRowCount, 3);
  assert.equal(result.phaseVolumeSplitMergeProposal.proposalMode, 'proposal-only-no-particle-mutation');
  assert.equal(result.phaseVolumeSplitMergeProposal.stateMutationRequired, false);
  assert.equal(result.phaseVolumeSplitMergeApply, null);
  assert.equal(result.phaseVolumeTargetAggregate.retainedAggregateBuffer, true);
  assert.equal(result.phaseVolumeTargetAggregate.aggregateSourceMode, 'phase-volume-target-level-assignment');
  assert.equal(result.phaseVolumeTargetAggregateNode.retainedAggregateNodeBuffer, true);
  assert.equal(result.farAggregateCandidates.retainedFarAggregateCandidateBuffer, true);
  assert.equal(result.farAggregateCandidates.farAggregateCandidateCount, 96);
  assert.equal(result.farAggregateCandidateStatus, 'schroeder-far-aggregate-candidates-submitted');
  assert.equal(result.farAggregateForceSummary.retainedForceSummaryBuffer, true);
  assert.equal(result.farAggregateForceSummary.forceSummaryRowCount, 3);
  assert.equal(result.farAggregateForceSummaryStatus, 'schroeder-far-aggregate-force-summary-submitted');
  assert.equal(result.farAggregateDiagnosticSummary.retainedDiagnosticSummaryBuffer, true);
  assert.equal(result.farAggregateDiagnosticSummary.forceSummaryRowCount, 3);
  assert.equal(result.farAggregateDiagnosticSummary.diagnosticSummaryRowCount, 1);
  assert.equal(result.farAggregateDiagnosticSummaryStatus, 'schroeder-far-aggregate-diagnostic-summary-submitted');
  assert.equal(result.phaseVolumeLevelUpdate.retainedLevelUpdateBuffer, true);
  assert.equal(result.phaseVolumeLevelUpdate.migrationRowCount, 3);
  assert.equal(result.phaseVolumeLevelUpdate.outputCompaction, 'one-admitted-phase-volume-level-update-row-per-migration-row');
  assert.equal(result.phaseVolumeLevelUpdate.phaseVolumeMigrationAdmissionApproved, true);
  assert.equal(result.phaseVolumeLevelUpdate.conservativeTransferStatus, 'phase-volume-level-update-submitted');
  assert.equal(result.phaseVolumeLevelUpdate.stateMutationStatus, 'phase-volume-level-update-buffer-submitted');
  assert.equal(
    result.phaseVolumeLevelUpdate.stateAuthorityStatus,
    'state-manager-admitted-phase-volume-level-update-materialized'
  );
  assert.equal(result.phaseVolumeDiagnosticSummary.retainedSummaryBuffer, true);
  assert.equal(result.phaseVolumeDiagnosticSummary.summaryRowCount, 1);
  assert.equal(result.phaseVolumeDiagnosticSummary.compactSummaryReadbackPerformed, true);
  assert.equal(result.phaseVolumeDiagnosticSummary.diagnosticStatus, 'phase-volume-diagnostics-submitted');
  assert.equal(
    result.phaseVolumeDiagnosticSummary.visibleStressCaseStatus,
    'water-to-steam-level-migration-diagnostics-submitted'
  );
  assert.equal(result.phaseVolumeDiagnosticSummary.summaryRows.length, 32);
  assert.equal(
    result.phaseVolumeDiagnosticSummary.refinePressurePolicy,
    'compact-summary-count-and-reason-mask-no-particle-readback'
  );
  assert.deepEqual(
    result.phaseVolumeDiagnosticSummary.refinePressureReasonBits,
    SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASON_BITS
  );
  assert.equal(result.phaseVolumeMigrationStatus, 'schroeder-phase-volume-migration-submitted');
  assert.equal(
    result.phaseVolumeSplitMergeProposalStatus,
    'schroeder-phase-volume-split-merge-proposal-submitted'
  );
  assert.equal(
    result.phaseVolumeSplitMergeApplyStatus,
    'disabled-phase-volume-split-merge-admission-not-provided'
  );
  assert.equal(result.phaseVolumeTargetAggregateStatus, 'schroeder-phase-volume-target-aggregate-submitted');
  assert.equal(result.phaseVolumeTargetAggregateNodeStatus, 'schroeder-hierarchy-aggregate-node-reduction-submitted');
  assert.equal(result.phaseVolumeLevelUpdateStatus, 'schroeder-phase-volume-level-update-submitted');
  assert.equal(result.phaseVolumeLevelUpdateConsumerStatus, 'phase-volume-level-update-forwarded-to-resident-backend');
  assert.equal(result.phaseVolumeNativeLevelSource, 'state-manager-admitted-phase-volume-level-update');
  assert.equal(result.phaseVolumeSelectedLevel, 2);
  assert.equal(result.phaseVolumeLevelUpdateRetainedBuffer, true);
  assert.equal(result.phaseVolumeLevelUpdateRowCount, 3);
  assert.equal(result.phaseVolumeDiagnosticSummaryStatus, 'schroeder-phase-volume-diagnostic-summary-submitted');
  assert.equal(result.phaseVolumeDiagnosticSummaryConsumerStatus, 'phase-volume-diagnostic-summary-forwarded-to-resident-backend');
  assert.equal(result.conservativeTransferStatus, 'phase-volume-level-update-submitted');
  assert.equal(result.stateMutationStatus, 'phase-volume-level-update-buffer-submitted');
  assert.equal(result.stateAuthorityStatus, 'state-manager-admitted-phase-volume-level-update-materialized');
  assert.equal(result.residentStep.hasFarAggregateCandidates, true);
  assert.equal(result.residentStep.hasFarAggregateForceSummary, true);
  assert.equal(result.residentStep.hasFarAggregateDiagnosticSummary, true);
  assert.equal(result.residentStep.hasPhaseVolumeMigration, true);
  assert.equal(result.residentStep.hasPhaseVolumeSplitMergeProposal, true);
  assert.equal(result.residentStep.hasPhaseVolumeSplitMergeApply, false);
  assert.equal(result.residentStep.hasPhaseVolumeLevelUpdate, true);
  assert.equal(result.residentStep.hasPhaseVolumeDiagnosticSummary, true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].schroederPhaseVolumeLevelUpdate.schema,
    ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederPhaseVolumeSplitMergeProposal.schema,
    ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_PROPOSAL_EXECUTION_SCHEMA
  );
  assert.equal(calls[0].schroederPhaseVolumeSplitMergeApply, null);
  assert.equal(
    calls[0].schroederFarAggregateCandidates.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_CANDIDATE_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederFarAggregateForceSummary.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_FORCE_SUMMARY_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederFarAggregateDiagnosticSummary.schema,
    ULG_SCHROEDER_FAR_AGGREGATE_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA
  );
  assert.equal(
    calls[0].schroederPhaseVolumeDiagnosticSummary.schema,
    ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA
  );
  assert.deepEqual(
    device.dispatches,
    [[1, 1, 1], [1, 1, 1], [1, 1, 1], [3, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [2, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]]
  );
});

test('Schroeder same-level mechanics can disable cross-level candidate generation per use case', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableCrossLevelCoupling: false,
    enablePhaseVolumeMigration: false,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 3 }),
    phaseVolumeMigrationAdmission: approvedPhaseVolumeMigrationAdmission({ rowCount: 3 }),
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
      status: 'resident-step-stubbed',
      hasLawQueue: Boolean(options.schroederLawQueue),
      hasCrossLevelCoupling: Boolean(options.schroederCrossLevelCoupling)
    };
    }
  });

  assert.equal(result.crossLevelCoupling, null);
  assert.equal(result.lawQueue.retainedLawQueueBuffer, true);
  assert.equal(result.lawQueueStatus, 'schroeder-law-queue-submitted');
  assert.equal(result.conservationSummary, null);
  assert.equal(result.crossLevelTransfer, null);
  assert.equal(result.crossLevelStateDelta, null);
  assert.equal(result.crossLevelStateDeltaMerge, null);
  assert.equal(result.hierarchyAggregate, null);
  assert.equal(result.hierarchyAggregateNode, null);
  assert.equal(result.phaseVolumeTargetAggregate, null);
  assert.equal(result.phaseVolumeTargetAggregateNode, null);
  assert.equal(result.phaseVolumeLevelUpdate, null);
  assert.equal(result.phaseVolumeDiagnosticSummary, null);
  assert.equal(result.crossLevelCouplingStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.conservationSummaryStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.crossLevelTransferStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.crossLevelStateDeltaStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.crossLevelStateDeltaMergeStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.hierarchyAggregateStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.hierarchyAggregateNodeStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.phaseVolumeMigrationStatus, 'disabled-same-level-only-mechanics');
  assert.equal(result.conservativeTransferStatus, 'not-run');
  assert.equal(result.stateMutationStatus, 'not-run');
  assert.equal(result.stateAuthorityStatus, 'not-run');
  assert.equal(result.residentStep.hasLawQueue, true);
  assert.equal(result.residentStep.hasCrossLevelCoupling, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].schroederLawQueue.schema, ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA);
  assert.equal(calls[0].schroederCrossLevelCoupling, null);
  assert.equal(calls[0].schroederConservationSummary, null);
  assert.equal(calls[0].schroederCrossLevelTransfer, null);
  assert.equal(calls[0].schroederCrossLevelStateDelta, null);
  assert.equal(calls[0].schroederCrossLevelStateDeltaMerge, null);
  assert.equal(calls[0].schroederHierarchyAggregate, null);
  assert.equal(calls[0].schroederHierarchyAggregateNode, null);
  assert.equal(calls[0].schroederPhaseVolumeMigration, null);
  assert.equal(calls[0].schroederPhaseVolumeTargetAggregate, null);
  assert.equal(calls[0].schroederPhaseVolumeTargetAggregateNode, null);
  assert.equal(calls[0].schroederPhaseVolumeLevelUpdate, null);
  assert.equal(calls[0].schroederPhaseVolumeDiagnosticSummary, null);
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1], [1, 1, 1], [3, 1, 1]]);
});

test('Schroeder phase-volume migration remains independently available when cross-level coupling is disabled', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableLawQueue: false,
    enableCrossLevelCoupling: false,
    enablePhaseVolumeMigration: true,
    stateDeltaMergeAdmission: approvedStateDeltaMergeAdmission({ rowCount: 3 }),
    phaseVolumeMigrationAdmission: approvedPhaseVolumeMigrationAdmission({ rowCount: 3 }),
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed'
      };
    }
  });

  assert.equal(result.crossLevelCoupling, null);
  assert.equal(result.crossLevelStateDeltaMerge, null);
  assert.equal(result.hierarchyAggregate, null);
  assert.ok(result.phaseVolumeTargetAggregate);
  assert.ok(result.phaseVolumeTargetAggregateNode);
  assert.ok(result.phaseVolumeMigration);
  assert.ok(result.phaseVolumeLevelUpdate);
  assert.ok(result.phaseVolumeDiagnosticSummary);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].schroederPhaseVolumeMigration);
  assert.ok(calls[0].schroederPhaseVolumeLevelUpdate);
});

test('Schroeder same-level mechanics can disable local law queue per use case', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const calls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableLawQueue: false,
    enableCrossLevelCoupling: false,
    residentStepRunner: async (options) => {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed',
        hasLawQueue: Boolean(options.schroederLawQueue)
      };
    }
  });

  assert.equal(result.lawQueue, null);
  assert.equal(result.lawQueueStatus, 'disabled-local-law-queue');
  assert.equal(result.lawQueueConsumerStatus, 'disabled-local-law-queue');
  assert.equal(result.residentStep.hasLawQueue, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].schroederLawQueue, null);
  assert.equal(calls[0].gasPressureMechanicsBoundaryEnabled, true);
  assert.deepEqual(device.dispatches, [[1, 1, 1], [1, 1, 1]]);
});

test('Schroeder single-level resident handoff preserves explicit gas-pressure boundary opt-out', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  let capturedOptions = null;

  await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    enableLawQueue: false,
    enableCrossLevelCoupling: false,
    enablePressureInterfaceOwnerScope: false,
    residentStepOptions: {
      gasPressureMechanicsBoundaryEnabled: false
    },
    residentStepRunner: async (options) => {
      capturedOptions = options;
      return {
        schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
        status: 'resident-step-stubbed'
      };
    }
  });

  assert.equal(capturedOptions?.gasPressureMechanicsBoundaryEnabled, false);
});

test('Schroeder same-level mechanics runs count summary and compaction over materialized storage', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const residentCalls = [];
  const borrowedDestroyCounts = new Map();
  const borrowedBuffer = (label) => ({
    label,
    destroy() {
      borrowedDestroyCounts.set(label, (borrowedDestroyCounts.get(label) || 0) + 1);
    }
  });
  const residentStepRunner = async (options) => {
    residentCalls.push(options);
    return {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
      status: 'resident-step-stubbed'
    };
  };
  const injectedMaterialization = {
    schema: 'peercompute.ulg.schroeder-particle-storage-materialization-execution.v0',
    status: 'schroeder-particle-storage-materialization-submitted',
    particleStorageMaterializationAdmissionApproved: true,
    materializationBuffer: borrowedBuffer('retained-materialization-rows'),
    particleStateBuffer: borrowedBuffer('materialized-state'),
    particleThermoBuffer: borrowedBuffer('materialized-thermo'),
    particleMechanicsBuffer: borrowedBuffer('materialized-mechanics'),
    particleIdentityBuffer: borrowedBuffer('materialized-identity'),
    assignmentRowCount: 3,
    materializationStrideFloats: 32,
    sourceParticleCount: 3,
    outputParticleCapacity: 6,
    retainedParticleBuffers: true,
    destroyParticleBuffers() {
      this.destroyParticleBuffersCallCount = (this.destroyParticleBuffersCallCount || 0) + 1;
    }
  };
  const countSummaryCalls = [];
  const countSummaryRunner = async (options) => {
    countSummaryCalls.push(options);
    return {
      schema: 'peercompute.ulg.schroeder-particle-storage-count-summary-execution.v0',
      status: 'schroeder-particle-storage-count-summary-submitted',
      countPolicy: 'append-only-freed-slots-await-compaction',
      admittedParticleCountDelta: 1,
      authoritativeParticleCount: 4,
      countSummary: {
        admittedRowCount: 3,
        writtenTargetSlotCount: 1,
        appendedTargetSlotCount: 1,
        freedSourceSlotCount: 2,
        admittedParticleCountDelta: 1
      }
    };
  };
  const compactionCalls = [];
  const compactedStateBuffer = device.createBuffer({ label: 'compacted-state', size: 64, usage: 128 });
  const compactedThermoBuffer = device.createBuffer({ label: 'compacted-thermo', size: 64, usage: 128 });
  const compactedMechanicsBuffer = device.createBuffer({ label: 'compacted-mechanics', size: 64, usage: 128 });
  const compactedIdentityBuffer = device.createBuffer({ label: 'compacted-identity', size: 64, usage: 128 });
  const compactionRunner = async (options) => {
    compactionCalls.push(options);
    return {
      schema: 'peercompute.ulg.schroeder-particle-storage-compaction-execution.v0',
      status: 'schroeder-particle-storage-compaction-submitted',
      compactionMode: 'order-preserving-live-slot-stream-compaction',
      particleStorageMaterializationAdmissionApproved: true,
      retainedParticleBuffers: true,
      liveParticleCount: 2,
      admittedParticleCountDelta: -1,
      sourceParticleCount: 3,
      outputParticleCapacity: 6,
      particleStateBuffer: compactedStateBuffer,
      particleThermoBuffer: compactedThermoBuffer,
      particleMechanicsBuffer: compactedMechanicsBuffer,
      particleIdentityBuffer: compactedIdentityBuffer,
      compactionSummary: { liveParticleCount: 2, freedHoleCount: 4 }
    };
  };

  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    particleStorageMaterialization: injectedMaterialization,
    particleStorageCountSummaryRunner: countSummaryRunner,
    particleStorageCompactionRunner: compactionRunner,
    residentStepRunner
  });

  // Count summary consumed the retained materialization rows and attached
  // the explicit delta to the materialization descriptor.
  assert.equal(countSummaryCalls.length, 1);
  assert.equal(countSummaryCalls[0].particleStorageMaterialization, injectedMaterialization);
  assert.equal(injectedMaterialization.admittedParticleCountDelta, 1);

  // Freed holes triggered compaction, and the resident backend received the
  // compaction execution as the storage adoption source.
  assert.equal(compactionCalls.length, 1);
  assert.equal(residentCalls.length, 1);
  assert.equal(
    residentCalls[0].schroederParticleStorageMaterialization.schema,
    'peercompute.ulg.schroeder-particle-storage-compaction-execution.v0'
  );
  assert.equal(
    residentCalls[0].schroederParticleStorageMaterialization.admittedParticleCountDelta,
    -1
  );

  // Caller-injected materialization buffers are never destroyed by the
  // orchestrator.
  assert.equal(injectedMaterialization.destroyParticleBuffersCallCount || 0, 0);
  assert.deepEqual(Object.fromEntries(borrowedDestroyCounts), {});
  assert.ok(injectedMaterialization.particleStateBuffer);

  // Compact metadata is exposed on the same-level result.
  assert.equal(result.particleStorageCountSummary.admittedParticleCountDelta, 1);
  assert.equal(result.particleStorageCountSummary.countSummary.freedSourceSlotCount, 2);
  assert.equal(result.particleStorageCompaction.liveParticleCount, 2);
  assert.equal(result.particleStorageCompaction.admittedParticleCountDelta, -1);
  assert.equal(result.particleStorageMaterialization.admittedParticleCountDelta, 1);

  await result.schroederHierarchyArtifactRetirementPromise;
  const ledgerSummary = result.currentSchroederHierarchyArtifactLedgerSummary();
  assert.equal(
    ledgerSummary.resources['particle-storage-materialization:particle-state'].owned,
    false
  );
  assert.equal(
    ledgerSummary.resources['particle-storage-materialization:materialization-rows'].owned,
    false
  );
  assert.equal(injectedMaterialization.destroyParticleBuffersCallCount || 0, 0);
  assert.deepEqual(Object.fromEntries(borrowedDestroyCounts), {});
  assert.deepEqual(
    [
      compactedStateBuffer.destroyCount,
      compactedThermoBuffer.destroyCount,
      compactedMechanicsBuffer.destroyCount,
      compactedIdentityBuffer.destroyCount
    ],
    [1, 1, 1, 1]
  );
  await result.releaseSchroederHierarchyArtifactTransfers({
    transferClass: 'render',
    submitted: false
  });
});

test('Schroeder same-level mechanics skips compaction when no slots were freed', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const residentCalls = [];
  const residentStepRunner = async (options) => {
    residentCalls.push(options);
    return { status: 'resident-step-stubbed' };
  };
  const injectedMaterialization = {
    schema: 'peercompute.ulg.schroeder-particle-storage-materialization-execution.v0',
    status: 'schroeder-particle-storage-materialization-submitted',
    particleStorageMaterializationAdmissionApproved: true,
    materializationBuffer: { label: 'retained-materialization-rows' },
    particleStateBuffer: { label: 'materialized-state' },
    particleThermoBuffer: { label: 'materialized-thermo' },
    particleMechanicsBuffer: { label: 'materialized-mechanics' },
    assignmentRowCount: 3,
    materializationStrideFloats: 32,
    sourceParticleCount: 3,
    outputParticleCapacity: 6,
    retainedParticleBuffers: true
  };
  const compactionCalls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    particleStorageMaterialization: injectedMaterialization,
    particleStorageCountSummaryRunner: async () => ({
      status: 'schroeder-particle-storage-count-summary-submitted',
      countPolicy: 'append-only-freed-slots-await-compaction',
      admittedParticleCountDelta: 1,
      authoritativeParticleCount: 4,
      countSummary: { admittedRowCount: 3, appendedTargetSlotCount: 1, freedSourceSlotCount: 0 }
    }),
    particleStorageCompactionRunner: async (options) => {
      compactionCalls.push(options);
      return {};
    },
    residentStepRunner
  });

  assert.equal(compactionCalls.length, 0);
  assert.equal(result.particleStorageCompaction, null);
  assert.equal(injectedMaterialization.admittedParticleCountDelta, 1);
  assert.equal(
    residentCalls[0].schroederParticleStorageMaterialization,
    injectedMaterialization
  );
});

test('Schroeder same-level mechanics skips adoption for pure-copy materialization epochs', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const residentCalls = [];
  const injectedMaterialization = {
    schema: 'peercompute.ulg.schroeder-particle-storage-materialization-execution.v0',
    status: 'schroeder-particle-storage-materialization-submitted',
    particleStorageMaterializationAdmissionApproved: true,
    materializationBuffer: { label: 'retained-materialization-rows' },
    particleStateBuffer: { label: 'materialized-state' },
    particleThermoBuffer: { label: 'materialized-thermo' },
    particleMechanicsBuffer: { label: 'materialized-mechanics' },
    assignmentRowCount: 3,
    materializationStrideFloats: 32,
    sourceParticleCount: 3,
    outputParticleCapacity: 6,
    retainedParticleBuffers: true
  };
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    particleStorageMaterialization: injectedMaterialization,
    particleStorageCountSummaryRunner: async () => ({
      status: 'schroeder-particle-storage-count-summary-submitted',
      countPolicy: 'append-only-freed-slots-await-compaction',
      admittedParticleCountDelta: 0,
      authoritativeParticleCount: 3,
      countSummary: { admittedRowCount: 3, appendedTargetSlotCount: 0, freedSourceSlotCount: 0 }
    }),
    residentStepRunner: async (options) => {
      residentCalls.push(options);
      return { status: 'resident-step-stubbed' };
    }
  });

  // A zero-delta epoch with nothing appended and nothing freed rebuilds the
  // identical particle set from step-input state; adopting it would supersede
  // the step's mechanics/thermal outputs every tick and freeze the sim.
  assert.equal(result.particleStorageAdoptionNoTopologyChange, true);
  assert.equal(result.particleStorageAdoptionSkipped, true);
  assert.equal(residentCalls[0].schroederParticleStorageMaterialization, null);
});

test('Schroeder same-level mechanics skips adoption for torn free-only epochs', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const residentCalls = [];
  const injectedMaterialization = {
    schema: 'peercompute.ulg.schroeder-particle-storage-materialization-execution.v0',
    status: 'schroeder-particle-storage-materialization-submitted',
    particleStorageMaterializationAdmissionApproved: true,
    materializationBuffer: { label: 'retained-materialization-rows' },
    particleStateBuffer: { label: 'materialized-state' },
    particleThermoBuffer: { label: 'materialized-thermo' },
    particleMechanicsBuffer: { label: 'materialized-mechanics' },
    assignmentRowCount: 3,
    materializationStrideFloats: 32,
    sourceParticleCount: 3,
    outputParticleCapacity: 6,
    retainedParticleBuffers: true
  };
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    particleStorageMaterialization: injectedMaterialization,
    particleStorageCountSummaryRunner: async () => ({
      status: 'schroeder-particle-storage-count-summary-submitted',
      countPolicy: 'append-only-freed-slots-await-compaction',
      admittedParticleCountDelta: 0,
      authoritativeParticleCount: 3,
      countSummary: { admittedRowCount: 3, writtenTargetSlotCount: 0, appendedTargetSlotCount: 0, freedSourceSlotCount: 3 }
    }),
    residentStepRunner: async (options) => {
      residentCalls.push(options);
      return { status: 'resident-step-stubbed' };
    }
  });

  // Frees with no written targets = a merge group split apart by admission
  // (participants admitted, their child-writing leader blocked). Adopting it
  // would delete the freed members' mass; the epoch is discarded instead.
  assert.equal(result.particleStorageAdoptionTornGroupDetected, true);
  assert.equal(result.particleStorageAdoptionSkipped, true);
  assert.equal(residentCalls[0].schroederParticleStorageMaterialization, null);
});

test('Schroeder same-level mechanics runs the two-level step in observation mode when enabled', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const residentCalls = [];
  const residentStepRunner = async (options) => {
    residentCalls.push(options);
    return { status: 'resident-step-stubbed' };
  };
  const twoLevelCalls = [];
  const twoLevelMechanicsRunner = async (options) => {
    twoLevelCalls.push(options);
    return {
      schema: 'peercompute.ulg.schroeder-two-level-mechanics-step-execution.v0',
      status: 'schroeder-two-level-mechanics-step-submitted',
      couplingMode: 'composite-grid-subcycled-delta-prolongation',
      fineLevel: options.fineLevel,
      coarseLevel: options.fineLevel + 1,
      fineSubstepCount: options.fineSubstepCount,
      fineSubstepDt: options.dt / options.fineSubstepCount,
      cflFactor: options.cflFactor,
      fineGridSpacingM: 0.25,
      coarseGridSpacingM: 0.5,
      conservation: { massResidualKg: 0 },
      conservativeTransferStatus: 'two-level-composite-grid-step-submitted-restriction-and-delta-prolongation'
    };
  };

  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 2,
    baseGridSpacingM: 0.25,
    minLevel: -2,
    maxLevel: 6,
    enableTwoLevelMechanics: true,
    twoLevelFineSubstepCount: 2,
    cflFactor: 0.8,
    twoLevelConservationSummaryReadback: true,
    twoLevelMechanicsRunner,
    residentStepRunner,
    residentStepOptions: {
      internalPressureScale: 0.75,
      ambientPressurePa: 101325
    }
  });

  // The two-level stage received the orchestrated level assignment plus
  // BOTH active-node lists: the selected level's retained list and a
  // coarse list produced at selectedLevel + 1.
  assert.equal(twoLevelCalls.length, 1);
  const call = twoLevelCalls[0];
  assert.equal(call.fineLevel, 2);
  assert.equal(call.fineSubstepCount, 2);
  assert.equal(call.cflFactor, 0.8);
  assert.equal(call.internalPressureScale, 0.75);
  assert.equal(call.ambientPressurePa, 101325);
  assert.ok(call.levelAssignment.assignmentBuffer);
  assert.ok(call.fineActiveNodeList.activeNodeBuffer);
  assert.ok(call.coarseActiveNodeList.activeNodeBuffer);
  assert.equal(call.fineActiveNodeList.selectedLevel, 2);
  assert.equal(call.coarseActiveNodeList.selectedLevel, 3);
  // Observation mode: outputs are released, telemetry only, and the
  // resident authority path still runs.
  assert.equal(call.retainOutputParticleBuffers, false);
  assert.equal(call.conservationSummaryReadback, true);
  assert.equal(
    call.compactSummaryReadback,
    false,
    'conservation diagnostics must not implicitly serialize the particle hot loop'
  );
  assert.equal(residentCalls.length, 1);

  assert.equal(result.twoLevelMechanics.status, 'schroeder-two-level-mechanics-step-submitted');
  assert.equal(result.twoLevelMechanics.authority, 'observation-only-resident-step-remains-authoritative');
  assert.equal(result.twoLevelMechanics.fineSubstepCount, 2);
  assert.equal(result.twoLevelMechanics.cflFactor, 0.8);
  assert.equal(result.twoLevelMechanics.coarseLevel, 3);
});

test('Schroeder same-level mechanics leaves two-level mode off by default', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const twoLevelCalls = [];
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    selectedLevel: 0,
    baseGridSpacingM: 0.25,
    twoLevelMechanicsRunner: async (options) => {
      twoLevelCalls.push(options);
      return {};
    },
    residentStepRunner: async () => ({ status: 'resident-step-stubbed' })
  });
  assert.equal(twoLevelCalls.length, 0);
  assert.equal(result.twoLevelMechanics, null);
});

test('paired-v2 mechanics fields require an explicit two-level opt-in', async () => {
  const device = createFakeWebGpuDevice();
  await assert.rejects(
    runSchroederSameLevelMechanicsWebGpu({
      device,
      enableMechanicsFieldPairV2: true
    }),
    (error) => {
      assert.equal(
        error?.code,
        'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_V2_REQUIRES_TWO_LEVEL'
      );
      return true;
    }
  );
  assert.equal(device.createdBuffers.length, 0);
  assert.equal(device.queue.submissions?.length ?? 0, 0);
});

test('canonical two-level epochs reject a mechanics-field mode change at mount', () => {
  const common = {
    device: createFakeWebGpuDevice(),
    initialLevelAssignment: {},
    initialTransaction: { twoLevelAuthoritative: true },
    sphParticleState: { particleCount: 1 },
    mlsMpmParticleState: { particleCount: 1 }
  };
  for (const mechanicsFieldPairV2Enabled of [false, true]) {
    assert.throws(
      () => createSchroederTwoLevelCanonicalEpochController({
        ...common,
        initialGeneration: {
          selected: true,
          mechanicsFieldPairV2Enabled: !mechanicsFieldPairV2Enabled
        },
        mechanicsFieldPairV2Enabled
      }),
      (error) => {
        assert.equal(
          error?.code,
          'ERR_SCHROEDER_TWO_LEVEL_MECHANICS_FIELD_MODE'
        );
        return true;
      }
    );
  }
});

test('injected spatial generations fail closed on paired-v2 requested and observed mode mismatch', async () => {
  for (const {
    enableMechanicsFieldPairV2,
    injected
  } of [
    {
      enableMechanicsFieldPairV2: false,
      injected: {
        mechanicsFieldPairV2Requested: true,
        mechanicsFieldPairV2Enabled: true,
        mechanicsFieldConstructionMode: 'paired-v2-shared-radix',
        mechanicsFieldPair: {}
      }
    },
    {
      enableMechanicsFieldPairV2: true,
      injected: {
        mechanicsFieldPairV2Requested: false,
        mechanicsFieldPairV2Enabled: false,
        mechanicsFieldConstructionMode: 'independent-v2',
        mechanicsFieldPair: null,
        mechanicsFieldView: {}
      }
    }
  ]) {
    const device = createFakeWebGpuDevice();
    const buffers = manualBuffers({
      particleCount: 3,
      smoothingLengthM: 0.25
    });
    let residentCallCount = 0;
    await assert.rejects(
      runSchroederSameLevelMechanicsWebGpu({
        device,
        ...buffers,
        selectedLevel: 0,
        minLevel: 0,
        maxLevel: 1,
        baseGridSpacingM: 0.25,
        enableTwoLevelMechanics: true,
        enableMechanicsFieldPairV2,
        spatialEpochGeneration: {
          selected: true,
          ready: true,
          ...injected
        },
        residentStepRunner: async () => {
          residentCallCount += 1;
          return { status: 'resident-step-must-not-run' };
        }
      }),
      (error) => {
        assert.equal(
          error?.code,
          'ERR_SCHROEDER_TWO_LEVEL_MECHANICS_FIELD_MODE'
        );
        return true;
      }
    );
    assert.equal(residentCallCount, 0);
  }
});

test('Schroeder two-level authority builds one canonical generation with two compact level views', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const uploads = authoritativeUploadFamily(device, { particleCount: 3 });
  const residentCalls = [];
  let coupledResult = null;
  let initialAggregateView = null;
  const generationCalls = [];
  const generatedEpochs = [];
  const spatialEpochGenerationRunner = async (options) => {
    generationCalls.push(options);
    const generation =
      await runSchroederSpatialEpochGenerationWithBackpressureWebGpu(options);
    generatedEpochs.push(generation);
    return generation;
  };
  const twoLevelMechanicsRunner = async (options) => {
    initialAggregateView =
      options.canonicalEpochController.initialEpoch.generation.aggregateView;
    coupledResult = await driveAuthoritativeCanonicalEpochs(options);
    return coupledResult;
  };
  twoLevelMechanicsRunner.schroederSpatialTopologyTransitionAware = true;

  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    ...uploads,
    selectedLevel: 1,
    minLevel: 0,
    maxLevel: 1,
    baseGridSpacingM: 0.25,
    dt: 5e-4,
    enableTwoLevelMechanics: true,
    twoLevelMechanicsAuthority: 'authoritative',
    twoLevelFineSubstepCount: 2,
    enablePortableSummary: true,
    twoLevelMechanicsRunner,
    spatialEpochGenerationRunner,
    residentStepOptions: {
      internalPressureScale: 0.75,
      ambientPressurePa: 101325
    },
    residentStepRunner: async (options) => {
      residentCalls.push(options);
      return { status: 'resident-step-stubbed' };
    }
  });

  // The resident runner is replaced entirely; the synthesized step exposes
  // the scene-consumed envelope fields from the two-level outputs.
  assert.equal(residentCalls.length, 0);
  assert.equal(result.spatialEpochGeneration.selected, true);
  assert.equal(result.spatialEpochGenerationDirectoryBuildCount, 1);
  assert.equal(result.spatialEpochGeneration.mechanicsLevelCount, 2);
  assert.deepEqual(result.spatialEpochGeneration.mechanicsLevels, [0, 1]);
  assert.equal(result.mechanicsFieldPairV2Requested, false);
  assert.equal(result.mechanicsFieldPairV2Enabled, false);
  assert.equal(result.mechanicsFieldConstructionMode, 'independent-v2');
  assert.equal(
    result.spatialEpochGeneration.mechanicsFieldPairV2Requested,
    false
  );
  assert.equal(result.spatialEpochGeneration.mechanicsFieldPairV2Enabled, false);
  assert.equal(
    result.spatialEpochGeneration.mechanicsFieldConstructionMode,
    'independent-v2'
  );
  assert.equal(
    result.twoLevelMechanics.coverageStatus,
    'schroeder-two-level-coverage-admitted'
  );
  assert.equal(result.twoLevelMechanics.coverageSource, 'classifier-clamp-range');
  assert.equal(result.twoLevelMechanics.requestedFineLevel, 1);
  assert.equal(result.twoLevelMechanics.fineLevel, 0);
  assert.equal(result.twoLevelMechanics.coarseLevel, 1);
  assert.equal(result.twoLevelMechanics.allLiveRowsCovered, true);
  assert.equal(
    initialAggregateView,
    null,
    'private mechanics E0 must not build an unconsumed FAR aggregate'
  );
  assert.equal(generationCalls.length, 4);
  assert.deepEqual(
    generationCalls.map(({ activeSourceCapacity }) => activeSourceCapacity),
    [3, 3, 3, 3],
    'initial, refreshed private, and terminal public epochs retain exact A=N'
  );
  assert.deepEqual(
    generatedEpochs.map(({ mechanicsLevelCount }) => mechanicsLevelCount),
    [2, 2, 2, 0],
    'terminal public E* omits the unconsumed mechanics view chain'
  );
  assert.deepEqual(
    generationCalls.map(({ mechanicsFieldPairV2Enabled }) => (
      mechanicsFieldPairV2Enabled
    )),
    [false, false, false, false],
    'the default route remains independent-v2 across every canonical epoch'
  );
  assert.deepEqual(
    generationCalls.map(({ particleBufferSet }) => (
      particleBufferSet == null
    )),
    [true, true, true, false],
    'only terminal public E* receives aggregate source buffers'
  );
  assert.deepEqual(
    generationCalls.map(({ exactNearCellTreeEnabled }) => (
      exactNearCellTreeEnabled
    )),
    [false, false, false, false],
    'a FAR-only public E* does not need an exact-near tree'
  );
  assert.deepEqual(
    generatedEpochs.map(({ aggregateView }) => aggregateView != null),
    [false, false, false, true]
  );
  assert.deepEqual(
    generatedEpochs.map(({ exactNearCellTree }) => exactNearCellTree != null),
    [false, false, false, false]
  );
  assert.deepEqual(
    generatedEpochs.map(({ phaseVolumeSidecarsEnabled }) => (
      phaseVolumeSidecarsEnabled
    )),
    [true, true, true, false],
    'private mechanics epochs retain S9-A/B while terminal public E* omits them'
  );
  assert.deepEqual(
    generatedEpochs.map(({ mechanicsLevelViews }) => (
      mechanicsLevelViews.filter((levelView) => (
        levelView.phaseVolumeMoment?.submitPerformed === true
        && levelView.phaseVolumeReceipt?.submitPerformed === true
      )).length
    )),
    [2, 2, 2, 0]
  );
  assert.deepEqual(
    generatedEpochs.map(({ phaseVolumeInterfaceProposal }) => (
      phaseVolumeInterfaceProposal?.submitPerformed === true
    )),
    [true, true, true, false],
    'consumer-driven scheduling preserves S9-C only on mechanics epochs'
  );
  assert.equal(
    coupledResult.postMechanicsEpoch.generation.aggregateView,
    generatedEpochs[3].aggregateView
  );
  assert.equal(
    coupledResult.postMechanicsEpoch.transaction.aggregateViewRequired,
    true
  );
  assert.equal(
    coupledResult.postMechanicsEpoch.transaction.twoLevelAuthoritative,
    false
  );
  assert.equal(coupledResult.postMechanicsEpoch.generation.mechanicsView, null);
  assert.equal(
    coupledResult.postMechanicsEpoch.generation.mechanicsFieldView,
    null
  );
  assert.equal(
    coupledResult.postMechanicsEpoch.generation.mechanicsFieldPair,
    null
  );
  assert.equal(coupledResult.postMechanicsEpoch.generation.hierarchyView, null);
  assert.equal(coupledResult.postMechanicsEpoch.generation.parentFieldView, null);
  assert.equal(result.spatialEpochGenerationReleaseScheduled, true);
  assert.equal(result.spatialEpochTransactionMounted, true);
  assert.equal(
    result.spatialEpochTransactionStatus,
    'schroeder-spatial-epoch-transaction-released'
  );
  assert.equal(
    result.spatialEpochConsumerStatus,
    'canonical-spatial-directory-consumed-by-two-level-authoritative-mechanics'
  );
  const step = result.residentStep;
  assert.equal(step.status, 'schroeder-two-level-authoritative-step-executed');
  assert.equal(step.backend, 'webgpu');
  assert.equal(step.readbackMode, 'no-full-readback');
  assert.equal(step.fullParticleReadbackPerformed, false);
  assert.equal(step.fullParticleReadbackFree, true);
  assert.equal(step.residentContinuationReady, true);
  assert.equal(step.readbackTelemetryComplete, true);
  assert.deepEqual(step.readbackTelemetryUnknownSources, []);
  assert.equal(step.mapAsyncCount, 0);
  assert.equal(step.readbackBytes, 0);
  assert.equal(step.hostQueueFenceCount, 0);
  assert.equal(step.normalHotLoopReadbackFree, true);
  assert.equal(result.fullParticleReadbackPerformed, false);
  assert.equal(result.fullParticleReadbackFree, true);
  assert.equal(result.residentContinuationReady, true);
  assert.equal(result.readbackTelemetryComplete, true);
  assert.deepEqual(result.readbackTelemetryUnknownSources, []);
  assert.equal(result.mapAsyncCount, 0);
  assert.equal(result.readbackBytes, 0);
  assert.equal(
    result.hostQueueFenceCount,
    0,
    'independent-v2 local submitted temporaries retire without a host fence'
  );
  assert.equal(result.normalHotLoopReadbackFree, true);
  assert.equal(
    await result.schroederTwoLevelAggregateTraversalRetirementPromise,
    true
  );
  assert.equal(
    device.queueFenceCalls.some(({ stack }) => (
      String(stack).includes('scheduleTwoLevelAggregateTraversalCleanup')
    )),
    false,
    'the exact finalized public E* submit receipt retires its traversal without a host fence'
  );
  assert.equal(
    device.queueFenceCalls.some(({ stack }) => (
      String(stack).includes('runSchroederLevelAssignmentWebGpu')
    )),
    false,
    'independent-v2 macro-boundary reclassification retires only local temporaries after submit'
  );
  assert.deepEqual(
    result.schroederHierarchyArtifactTransferCleanupClaims,
    [],
    'observation-mode local cleanup does not mint cross-stage transfer claims'
  );
  assert.equal(
    result.queueOrderedFinalConsumerCapability ?? null,
    null,
    'observation-mode local cleanup does not publish resident render authority'
  );
  assert.equal(step.twoLevelMechanicsAuthority, 'authoritative');
  assert.equal(step.twoLevelMechanicsStatus,
    'schroeder-two-level-mechanics-step-submitted');
  assert.equal(step.twoLevelFineSubstepCount, 2);
  assert.equal(step.twoLevelAuthoritativeCommitVerified, true);
  assert.equal(
    result.twoLevelMechanics.canonicalEpochControllerSummary
      .mechanicsFieldPairV2Requested,
    false
  );
  assert.equal(
    result.twoLevelMechanics.canonicalEpochControllerSummary
      .mechanicsFieldPairV2Enabled,
    false
  );
  assert.deepEqual(
    result.twoLevelMechanics.canonicalEpochControllerSummary
      .mechanicsFieldConstructionModes,
    ['independent-v2', 'independent-v2', 'independent-v2', 'not-built']
  );
  assert.equal(step.internalPressureScale, 0.75);
  assert.equal(step.ambientPressurePa, 101325);
  assert.equal(step.sidecars, 'shared-post-mechanics-closure');
  assert.deepEqual(
    step.phaseVolumeInterfaceTransport,
    result.twoLevelMechanics.phaseVolumeInterfaceTransport
  );
  assert.equal(
    step.internalEnergyTransferStatus,
    result.twoLevelMechanics.internalEnergyTransferStatus
  );
  assert.equal(
    step.refluxEvidenceStatus,
    result.twoLevelMechanics.refluxEvidenceStatus
  );
  assert.equal(step.phaseVolumeInterfaceTransport.enabled, true);
  assert.ok(result.schroederSpatialSuccessorSourceFamily);
  assert.equal(
    result.schroederSpatialTransitionPolicy,
    SCHROEDER_SPATIAL_TRANSITION_POLICY_CONSERVATIVE_RESIDENT
  );
  assert.equal(
    result.schroederSpatialTransitionCompactReadbackPerformed,
    false
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.topologyEpoch,
    result.schroederSpatialSuccessorSourceFamily.sourceEpochIdentity
      .topologyEpoch + 1
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.positionEpoch,
    result.schroederSpatialSuccessorSourceFamily.sourceEpochIdentity
      .positionEpoch + 1
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.topologyTransitionMode,
    'gpu-resident-conservative-topology-advance'
  );
  assert.equal(
    result.schroederSpatialSuccessorSourceFamily.positionAuthority,
    'conservative-mechanics-integration-transition'
  );
  assert.equal(
    result.twoLevelMechanics.schroederSpatialTopologyTransitionReceipt,
    undefined
  );
  assert.equal(
    result.twoLevelMechanics.schroederSpatialPositionTransitionReceipt,
    undefined
  );
  assert.equal(
    device.createdBuffers.some((buffer) => (
      buffer.label ===
        'ulg-schroeder-spatial-topology-transition-compact-readback'
      || buffer.label ===
        'ulg-schroeder-spatial-position-transition-compact-readback'
    )),
    false
  );
  assert.equal(
    step.nextParticleUploads.schroederSpatialSuccessorSourceFamily,
    result.schroederSpatialSuccessorSourceFamily,
    'resident continuation must be the exact final published envelope'
  );
  assert.equal(
    step.schroederSpatialSuccessorSourceFamily,
    result.schroederSpatialSuccessorSourceFamily
  );
  assert.equal(result.finalRenderProxyPublished, true);
  assert.equal(
    result.portableSummary.sourceFamily,
    result.schroederSpatialSuccessorSourceFamily
  );
  assert.equal(
    result.portableSummary.retainedRefs.every((entry) => (
      entry.sourceFamily === result.schroederSpatialSuccessorSourceFamily
      && entry.sourceEpochIdentity
        === result.schroederSpatialSuccessorSourceFamily.successorEpochIdentity
      && entry.finalContinuationAuthority === true
    )),
    true
  );
  assert.equal(
    result.localRetainedRenderBuffers.buffers[0].sourceFamily,
    result.schroederSpatialSuccessorSourceFamily
  );
  assert.equal(step.nextParticleUploads.sphParticleUpload.schema,
    ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA);
  assert.equal(step.particlePingPong.nextStep, 1);
  assert.equal(step.particlePingPong.nextTime, 5e-4);
  assert.equal(step.particlePingPong.nextSlot, 1);
  assert.equal(
    result.twoLevelMechanics.authority,
    'two-level-authoritative-resident-mechanics-replaced'
  );
  assert.equal(result.twoLevelMechanics.internalPressureScale, 0.75);
  assert.equal(result.twoLevelMechanics.ambientPressurePa, 101325);
  assert.equal(
    result.twoLevelMechanics.canonicalEpochControllerSummary.epochCount,
    4
  );
  assert.equal(
    step.publicAggregateTraversalReceipt.querySourceLayout,
    'schroeder-level-assignment-v0'
  );
  assert.equal(
    step.publicAggregateTraversalReceipt
      .canonicalQueryProvenanceAuthenticated,
    true
  );
  assert.equal(
    step.publicAggregateTraversalReceipt.submissionAuthenticated,
    true
  );
  assert.equal(step.publicAggregateTraversalReceipt.resultAuthenticated, false);
  assert.equal(
    step.publicAggregateTraversalReceipt.authoritativeStateMutationCount,
    0
  );
  assert.deepEqual(
    summarizeSchroederSpatialEpochTransaction(
      coupledResult.postMechanicsEpoch.transaction
    ).consumerReceipts.map((receipt) => receipt.consumerId),
    [SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE]
  );
  assert.equal(
    await result.schroederTwoLevelAggregateTraversalRetirementPromise,
    true
  );
  const queueFenceCountBeforeRenderRelease = device.queueFenceCalls.length;
  await result.localRetainedRenderBuffers.destroyRetainedBuffers({
    queueOrderedFinalConsumer: Object.freeze({
      source: 'foreign-successor-capability'
    })
  });
  assert.equal(
    device.queueFenceCalls.length,
    queueFenceCountBeforeRenderRelease + 1,
    'a claim-free cold result retires locally instead of consuming a successor capability'
  );
  assert.equal(
    result.currentSchroederHierarchyArtifactLedgerSummary()
      .pendingTransferCount,
    0
  );
});

test('Schroeder two-level authority quarantines a committed continuation when exact successor publication is rejected', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const uploads = authoritativeUploadFamily(device, { particleCount: 3 });
  const twoLevelMechanicsRunner = (options) =>
    driveAuthoritativeCanonicalEpochs(options, {
      prefix: 'rejected-successor-publication'
    });
  twoLevelMechanicsRunner.schroederSpatialTopologyTransitionAware = true;
  let publicationCallCount = 0;

  await assert.rejects(
    runSchroederSameLevelMechanicsWebGpu({
      device,
      ...buffers,
      ...uploads,
      selectedLevel: 0,
      minLevel: 0,
      maxLevel: 1,
      baseGridSpacingM: 0.25,
      dt: 5e-4,
      enableTwoLevelMechanics: true,
      twoLevelMechanicsAuthority: 'authoritative',
      twoLevelFineSubstepCount: 2,
      twoLevelMechanicsRunner,
      spatialSuccessorPublicationRunner() {
        publicationCallCount += 1;
        return Object.freeze({
          status: 'schroeder-successor-source-family-publication-rejected',
          published: false,
          sourceFamily: null,
          reason: 'injected exact-identity rejection'
        });
      },
      residentStepRunner: async () => ({ status: 'must-not-run' })
    }),
    (error) => {
      assert.equal(
        error.code,
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_REJECTED'
      );
      assert.equal(error.committedContinuationQuarantined, true);
      assert.match(error.message, /injected exact-identity rejection/);
      return true;
    }
  );
  assert.equal(publicationCallCount, 1);
  await new Promise((resolve) => setImmediate(resolve));
});

test('Schroeder two-level rejection releases a warm successor product-history view without releasing its shared input arena view', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const uploads = authoritativeUploadFamily(device, { particleCount: 3 });
  const rawInputResidentProductMass = residentProductMassFixture(
    device,
    'warm-product-history-input-source'
  );
  const inputResidentProductMass =
    await mergeResidentProductMassBuffersWebGpu({
      device,
      emittedResidentProductMass: rawInputResidentProductMass,
      allowHostCompactionObservation: false
    });
  const emittedResidentProductMass = residentProductMassFixture(
    device,
    'warm-product-history-emitted-source'
  );
  const originalInputRelease =
    inputResidentProductMass.destroyResidentProductMassBuffers;
  let inputReleaseCount = 0;
  inputResidentProductMass.destroyResidentProductMassBuffers = function () {
    inputReleaseCount += 1;
    return originalInputRelease.call(this);
  };
  let successorResidentProductMass = null;
  let successorReleaseCount = 0;
  const twoLevelMechanicsRunner = (options) =>
    driveAuthoritativeCanonicalEpochs(options, {
      prefix: 'rejected-warm-product-history-publication'
    });
  twoLevelMechanicsRunner.schroederSpatialTopologyTransitionAware = true;

  await assert.rejects(
    runSchroederSameLevelMechanicsWebGpu({
      device,
      ...buffers,
      ...uploads,
      selectedLevel: 0,
      minLevel: 0,
      maxLevel: 1,
      baseGridSpacingM: 0.25,
      dt: 5e-4,
      enableTwoLevelMechanics: true,
      twoLevelMechanicsAuthority: 'authoritative',
      twoLevelFineSubstepCount: 2,
      twoLevelMechanicsRunner,
      spatialSuccessorPublicationRunner(plan) {
        successorResidentProductMass =
          plan.productHistoryCommitGate?.residentProductMass ?? null;
        assert.ok(successorResidentProductMass);
        assert.notEqual(
          successorResidentProductMass,
          inputResidentProductMass
        );
        assert.equal(
          successorResidentProductMass.productEventBuffer,
          inputResidentProductMass.productEventBuffer
        );
        assert.equal(
          successorResidentProductMass.productEventHistoryArenaWarmReuse,
          true
        );
        const originalSuccessorRelease =
          successorResidentProductMass.destroyResidentProductMassBuffers;
        successorResidentProductMass.destroyResidentProductMassBuffers =
          function () {
            successorReleaseCount += 1;
            return originalSuccessorRelease.call(this);
          };
        return Object.freeze({
          status: 'schroeder-successor-source-family-publication-rejected',
          published: false,
          sourceFamily: null,
          reason: 'injected warm product-history identity rejection'
        });
      },
      residentStepOptions: {
        residentProductMass: inputResidentProductMass,
        thermalMaterialTable: canonicalSidecarThermalMaterialTable,
        reactionTable: canonicalSidecarReactionTable(),
        reactionStepRunner: async () => ({
          status: 'reaction-step-executed',
          backend: 'webgpu',
          residentProductMass: emittedResidentProductMass,
          fullParticleReadbackPerformed: false,
          fullParticleReadbackFree: true,
          ...createGpuReadbackTelemetry({
            scope: 'test-warm-product-history-reaction-sidecar'
          })
        })
      },
      residentStepRunner: async () => ({ status: 'must-not-run' })
    }),
    (error) => {
      assert.equal(
        error.code,
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_REJECTED'
      );
      assert.equal(error.committedContinuationQuarantined, true);
      assert.match(error.message, /warm product-history identity rejection/);
      return true;
    }
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(successorReleaseCount, 1);
  assert.equal(inputReleaseCount, 0);

  inputResidentProductMass.destroyResidentProductMassBuffers();
  rawInputResidentProductMass.destroyResidentProductMassBuffers();
  emittedResidentProductMass.destroyResidentProductMassBuffers();
});

test('Schroeder two-level authority rejects a forged successful successor publication receipt', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const uploads = authoritativeUploadFamily(device, { particleCount: 3 });
  const twoLevelMechanicsRunner = (options) =>
    driveAuthoritativeCanonicalEpochs(options, {
      prefix: 'forged-successor-publication'
    });
  twoLevelMechanicsRunner.schroederSpatialTopologyTransitionAware = true;
  let publicationCallCount = 0;

  await assert.rejects(
    runSchroederSameLevelMechanicsWebGpu({
      device,
      ...buffers,
      ...uploads,
      selectedLevel: 0,
      minLevel: 0,
      maxLevel: 1,
      baseGridSpacingM: 0.25,
      dt: 5e-4,
      enableTwoLevelMechanics: true,
      twoLevelMechanicsAuthority: 'authoritative',
      twoLevelFineSubstepCount: 2,
      twoLevelMechanicsRunner,
      spatialSuccessorPublicationRunner() {
        publicationCallCount += 1;
        return Object.freeze({
          schema:
            'peercompute.ulg.schroeder-successor-source-family-publication-receipt.v1',
          status: 'schroeder-successor-source-family-published',
          published: true,
          sourceFamily: Object.freeze({
            ready: true,
            authenticated: true,
            status:
              'schroeder-committed-successor-source-family-authenticated'
          }),
          reason: null
        });
      },
      residentStepRunner: async () => ({ status: 'must-not-run' })
    }),
    (error) => {
      assert.equal(
        error.code,
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_PUBLICATION_REJECTED'
      );
      assert.equal(error.committedContinuationQuarantined, true);
      assert.match(error.message, /publication receipt|published/i);
      return true;
    }
  );
  assert.equal(publicationCallCount, 1);
  await new Promise((resolve) => setImmediate(resolve));
});

test('canonical epoch refresh waits for cached-runtime arena capacity and retires an orphaned submitted assignment', async () => {
  const device = createFakeWebGpuDevice();
  const uploads = authoritativeUploadFamily(device, { particleCount: 2 });
  const refreshedAssignment = {
    physicsTick: 0,
    physicsSubstep: 1,
    submitPerformed: false,
    releaseScheduled: false
  };
  let encodeCount = 0;
  let availabilityWaitCount = 0;
  let releaseCount = 0;
  const refreshRuntime = {
    proveFineSubstepAuthority() {
      return Object.freeze({ status: 'fake-topology-stable-proof' });
    },
    encode() {
      encodeCount += 1;
      if (encodeCount === 1) {
        const error = new Error(
          'cached frozen refresh arenas still await an earlier controller fence'
        );
        error.code = 'ERR_SCHROEDER_FROZEN_REFRESH_BACKPRESSURE';
        throw error;
      }
      return refreshedAssignment;
    },
    waitForAvailableArena() {
      availabilityWaitCount += 1;
      return Promise.resolve(true);
    },
    markExecutionSubmitted(execution) {
      assert.equal(execution, refreshedAssignment);
      execution.submitPerformed = true;
      return true;
    },
    releaseAfterQueue(execution) {
      assert.equal(execution, refreshedAssignment);
      releaseCount += 1;
      execution.releaseScheduled = true;
      return Promise.resolve(true);
    }
  };
  const initialGeneration = {
    selected: true,
    ready: true,
    releaseScheduled: true,
    releasePromise: null,
    execution: {
      generationId: 1,
      physicsTick: 0,
      physicsSubstep: 0,
      positionEpoch: 0,
      topologyEpoch: 0,
      chartEpoch: 0,
      levelEpoch: 0,
      supportEpoch: 0
    },
    hierarchyView: {}
  };
  const timestampStages = [];
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(encoder, descriptor) {
      timestampStages.push(descriptor?.stage ?? null);
      return { encoder };
    },
    endEncoderSpan(encoder, token) {
      assert.equal(token.encoder, encoder);
    }
  };
  let mechanicalProposalOptions = null;
  const controller = createSchroederTwoLevelCanonicalEpochController({
    device,
    initialGeneration,
    initialLevelAssignment: {
      physicsTick: 0,
      physicsSubstep: 0
    },
    initialTransaction: { twoLevelAuthoritative: true },
    sphParticleState: { particleCount: 2 },
    mlsMpmParticleState: { particleCount: 2 },
    initialSphParticleUpload: uploads.sphParticleUpload,
    initialMlsMpmParticleUpload: uploads.mlsMpmParticleUpload,
    fineLevel: 0,
    fineMechanicsGrid: {
      gridNodeCount: 64,
      gridDims: [4, 4, 4],
      gridShift: 1,
      gridSpacingM: 0.25
    },
    coarseMechanicsGrid: {
      gridNodeCount: 27,
      gridDims: [3, 3, 3],
      gridShift: 1,
      gridSpacingM: 0.5
    },
    boxDimsM: [5, 5, 5],
    gpuTimestampRecorder,
    refreshRuntime,
    spatialEpochGenerationRunner: async () => {
      throw new Error('generation must not run after prior release failure');
    },
    mechanicalProposalRunner: (options) => {
      mechanicalProposalOptions = options;
      return {
        releaseAfterSubmittedWork() { return true; },
        releasePromise: Promise.resolve(true)
      };
    }
  });
  assert.equal(
    mechanicalProposalOptions?.gpuTimestampRecorder,
    gpuTimestampRecorder
  );
  controller.initialEpoch.committed = true;
  await assert.rejects(
    controller.refresh({
      priorEpoch: controller.initialEpoch,
      currentSphParticleUpload: uploads.sphParticleUpload,
      currentMlsMpmParticleUpload: uploads.mlsMpmParticleUpload
    }),
    (error) => {
      assert.equal(error.code, 'ERR_SCHROEDER_TWO_LEVEL_GENERATION_RELEASE');
      return true;
    }
  );
  assert.equal(encodeCount, 2);
  assert.equal(availabilityWaitCount, 1);
  assert.equal(refreshedAssignment.submitPerformed, true);
  assert.equal(refreshedAssignment.releaseScheduled, true);
  assert.equal(releaseCount, 1);
  assert.deepEqual(timestampStages, [
    'frozen-assignment-refresh',
    'frozen-assignment-refresh'
  ]);
});

test('canonical refresh preserves the submission error while one stable orphan retry recovers a rejected fence', async () => {
  const device = createFakeWebGpuDevice();
  const uploads = authoritativeUploadFamily(device, { particleCount: 2 });
  const secondFence = {};
  secondFence.promise = new Promise((resolve) => {
    secondFence.resolve = resolve;
  });
  const refreshedAssignment = {
    physicsTick: 0,
    physicsSubstep: 1,
    submitPerformed: false,
    releaseScheduled: false
  };
  let uncertainMarkCount = 0;
  let releaseAttemptCount = 0;
  const refreshRuntime = {
    proveFineSubstepAuthority() {
      return Object.freeze({ status: 'fake-topology-stable-proof' });
    },
    encode() { return refreshedAssignment; },
    markExecutionSubmitted() { return false; },
    markExecutionSubmissionUncertain(execution) {
      assert.equal(execution, refreshedAssignment);
      uncertainMarkCount += 1;
      execution.submitPerformed = true;
      return true;
    },
    releaseAfterQueue(execution) {
      assert.equal(execution, refreshedAssignment);
      releaseAttemptCount += 1;
      return releaseAttemptCount === 1
        ? Promise.reject(new Error('first orphan retirement fence rejected'))
        : secondFence.promise;
    }
  };
  const controller = createSchroederTwoLevelCanonicalEpochController({
    device,
    initialGeneration: {
      selected: true,
      ready: true,
      execution: { generationId: 1 },
      hierarchyView: {}
    },
    initialLevelAssignment: { physicsTick: 0, physicsSubstep: 0 },
    initialTransaction: { twoLevelAuthoritative: true },
    sphParticleState: { particleCount: 2 },
    mlsMpmParticleState: { particleCount: 2 },
    initialSphParticleUpload: uploads.sphParticleUpload,
    initialMlsMpmParticleUpload: uploads.mlsMpmParticleUpload,
    fineLevel: 0,
    fineMechanicsGrid: {
      gridNodeCount: 64,
      gridDims: [4, 4, 4],
      gridShift: 1,
      gridSpacingM: 0.25
    },
    coarseMechanicsGrid: {
      gridNodeCount: 27,
      gridDims: [3, 3, 3],
      gridShift: 1,
      gridSpacingM: 0.5
    },
    boxDimsM: [5, 5, 5],
    refreshRuntime,
    spatialEpochGenerationRunner: async () => {
      throw new Error('generation must not run after uncertain submission');
    },
    mechanicalProposalRunner: () => ({
      releaseAfterSubmittedWork() { return true; },
      releasePromise: Promise.resolve(true)
    })
  });
  controller.initialEpoch.committed = true;
  let originatingError = null;
  await assert.rejects(
    controller.refresh({
      priorEpoch: controller.initialEpoch,
      currentSphParticleUpload: uploads.sphParticleUpload,
      currentMlsMpmParticleUpload: uploads.mlsMpmParticleUpload
    }),
    (error) => {
      originatingError = error;
      assert.equal(
        error.code,
        'ERR_SCHROEDER_TWO_LEVEL_REFRESH_SUBMISSION_UNCERTAIN'
      );
      assert.equal(typeof error.schroederRefreshCleanupRecovery, 'function');
      assert.match(
        error.schroederRefreshCleanupError.message,
        /first orphan retirement fence rejected/
      );
      return true;
    }
  );
  assert.equal(uncertainMarkCount, 1);
  assert.equal(releaseAttemptCount, 1);

  const recoveryA = originatingError.schroederRefreshCleanupRecovery();
  const recoveryB = originatingError.schroederRefreshCleanupRecovery();
  assert.equal(recoveryA, recoveryB);
  assert.equal(releaseAttemptCount, 2);
  secondFence.resolve(true);
  assert.equal(await recoveryA, true);
  assert.equal(await recoveryB, true);
  assert.equal(
    await originatingError.schroederRefreshCleanupCompletionPromise,
    true
  );
  assert.equal(controller.summary().refreshAttemptCount, 1);
  assert.equal(controller.summary().activeRefreshAttemptCount, 0);
});

test('canonical refresh does not duplicate uncertain acknowledgement when mark throws after submission', async () => {
  const device = createFakeWebGpuDevice();
  const uploads = authoritativeUploadFamily(device, { particleCount: 2 });
  const refreshedAssignment = {
    physicsTick: 0,
    physicsSubstep: 1,
    submitPerformed: false,
    releaseScheduled: false
  };
  const acknowledgementError = new Error(
    'mark submitted threw after recording exact submission'
  );
  let uncertainMarkCount = 0;
  let releaseAttemptCount = 0;
  const refreshRuntime = {
    proveFineSubstepAuthority() {
      return Object.freeze({ status: 'fake-topology-stable-proof' });
    },
    encode() { return refreshedAssignment; },
    markExecutionSubmitted(execution) {
      execution.submitPerformed = true;
      throw acknowledgementError;
    },
    markExecutionSubmissionUncertain() {
      uncertainMarkCount += 1;
      return true;
    },
    releaseAfterQueue(execution) {
      assert.equal(execution, refreshedAssignment);
      releaseAttemptCount += 1;
      return Promise.resolve(true);
    }
  };
  const controller = createSchroederTwoLevelCanonicalEpochController({
    device,
    initialGeneration: {
      selected: true,
      ready: true,
      execution: { generationId: 1 },
      hierarchyView: {}
    },
    initialLevelAssignment: { physicsTick: 0, physicsSubstep: 0 },
    initialTransaction: { twoLevelAuthoritative: true },
    sphParticleState: { particleCount: 2 },
    mlsMpmParticleState: { particleCount: 2 },
    initialSphParticleUpload: uploads.sphParticleUpload,
    initialMlsMpmParticleUpload: uploads.mlsMpmParticleUpload,
    fineLevel: 0,
    fineMechanicsGrid: {
      gridNodeCount: 64,
      gridDims: [4, 4, 4],
      gridShift: 1,
      gridSpacingM: 0.25
    },
    coarseMechanicsGrid: {
      gridNodeCount: 27,
      gridDims: [3, 3, 3],
      gridShift: 1,
      gridSpacingM: 0.5
    },
    boxDimsM: [5, 5, 5],
    refreshRuntime,
    spatialEpochGenerationRunner: async () => {
      throw new Error('generation must not run after acknowledgement failure');
    },
    mechanicalProposalRunner: () => ({
      releaseAfterSubmittedWork() { return true; },
      releasePromise: Promise.resolve(true)
    })
  });
  controller.initialEpoch.committed = true;
  await assert.rejects(
    controller.refresh({
      priorEpoch: controller.initialEpoch,
      currentSphParticleUpload: uploads.sphParticleUpload,
      currentMlsMpmParticleUpload: uploads.mlsMpmParticleUpload
    }),
    (error) => {
      assert.equal(error, acknowledgementError);
      assert.equal(typeof error.schroederRefreshCleanupRecovery, 'function');
      return true;
    }
  );
  assert.equal(uncertainMarkCount, 0);
  assert.equal(releaseAttemptCount, 1);
  assert.equal(controller.summary().activeRefreshAttemptCount, 0);
});

test('canonical controller loss supersedes a post-generation refresh orphan without a stale queue callback', async () => {
  const device = createFakeWebGpuDevice();
  let resolveDeviceLoss;
  const deviceLoss = new Promise((resolve) => { resolveDeviceLoss = resolve; });
  let rejectNormalFence;
  const normalFence = new Promise((_, reject) => { rejectNormalFence = reject; });
  normalFence.catch(() => {});
  let fenceRequestCount = 0;
  device.lost = deviceLoss;
  device.queue.onSubmittedWorkDone = () => {
    fenceRequestCount += 1;
    return normalFence;
  };

  const particleCount = 2;
  const uploads = authoritativeUploadFamily(device, { particleCount });
  const continuationBuffers = authoritativeUploadFamily(device, {
    particleCount,
    storageGeneration: 2,
    physicsTick: 0,
    physicsSubstep: 1,
    positionEpoch: 1,
    prefix: 'loss-refresh-continuation'
  });
  const nextUploads = {
    sphParticleUpload: {
      ...uploads.sphParticleUpload,
      storageGeneration: 2,
      bufferFamilyGeneration: 2,
      physicsSubstep: 1,
      positionEpoch: 1,
      stateBuffer: continuationBuffers.sphParticleUpload.stateBuffer,
      ownsStateBuffer: true,
      ownsThermoBuffer: false,
      ownsIdentityBuffer: false,
      slot: 1,
      sourceSlot: 0,
      nextSlot: 1
    },
    mlsMpmParticleUpload: {
      ...uploads.mlsMpmParticleUpload,
      storageGeneration: 2,
      bufferFamilyGeneration: 2,
      physicsSubstep: 1,
      positionEpoch: 1,
      mechanicsBuffer:
        continuationBuffers.mlsMpmParticleUpload.mechanicsBuffer,
      ownsMechanicsBuffer: true,
      slot: 1,
      sourceSlot: 0,
      nextSlot: 1
    }
  };
  const assignmentBuffer = device.createBuffer({
    label: 'loss-refresh-initial-assignment',
    size: particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const initialLevelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: 16,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    sourceStateBuffer: uploads.sphParticleUpload.stateBuffer,
    sourceStateBufferBorrowed: true,
    sourceThermoBuffer: uploads.sphParticleUpload.thermoBuffer,
    sourceThermoBufferBorrowed: true,
    sourceThermoBufferByteLength: particleCount * 12 * 4,
    sourceMechanicsBuffer: uploads.mlsMpmParticleUpload.mechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    sourceMechanicsBufferByteLength: particleCount * 32 * 4,
    storageGeneration: 1,
    bufferFamilyGeneration: 1,
    physicsTick: 0,
    physicsSubstep: 0,
    positionEpoch: 0,
    topologyEpoch: 0,
    chartEpoch: 0,
    levelEpoch: 0,
    supportEpoch: 0,
    minLevel: 0,
    maxLevel: 1,
    chartId: 0,
    baseGridSpacingM: 0.25
  };
  const fineMechanicsGrid = {
    gridNodeCount: 64,
    gridDims: [4, 4, 4],
    gridShift: 1,
    gridSpacingM: 0.25
  };
  const coarseMechanicsGrid = {
    gridNodeCount: 27,
    gridDims: [3, 3, 3],
    gridShift: 1,
    gridSpacingM: 0.5
  };
  const initialGeneration = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment: initialLevelAssignment,
    particleCount,
    particleIdentityBuffer: uploads.sphParticleUpload.identityBuffer,
    particleIdentityStrideWords: 1,
    particleBufferSet: null,
    exactNearCellTreeEnabled: false,
    mechanicsLevels: [
      { selectedLevel: 0, mechanicsGrid: fineMechanicsGrid },
      { selectedLevel: 1, mechanicsGrid: coarseMechanicsGrid }
    ]
  });
  assert.equal(initialGeneration.selected, true);
  const initialTransaction = createSchroederSpatialEpochTransaction({
    device,
    generation: initialGeneration,
    sphParticleUpload: uploads.sphParticleUpload,
    mlsMpmParticleUpload: uploads.mlsMpmParticleUpload,
    twoLevelAuthoritative: true,
    enabledConsumerReaderIds: [],
    consumerSupportProfileIds: {}
  });
  let failedGeneration = null;
  const controller = createSchroederTwoLevelCanonicalEpochController({
    device,
    initialGeneration,
    initialLevelAssignment,
    initialTransaction,
    sphParticleState: { particleCount },
    mlsMpmParticleState: { particleCount },
    initialSphParticleUpload: uploads.sphParticleUpload,
    initialMlsMpmParticleUpload: uploads.mlsMpmParticleUpload,
    fineLevel: 0,
    fineMechanicsGrid,
    coarseMechanicsGrid,
    boxDimsM: [1, 1, 1],
    mechanicsEpochMode: 'fused-private-mechanics',
    spatialEpochGenerationRunner: async (options) => {
      failedGeneration = await
        runSchroederSpatialEpochGenerationWithBackpressureWebGpu(options);
      // Fail only after the exact generation owner exists. The refresh orphan
      // ledger must retire this branded generation plus its assignment.
      failedGeneration.mechanicsLevelCount = 1;
      return failedGeneration;
    }
  });
  controller.admitP2g(controller.initialEpoch);
  controller.admitG2p(controller.initialEpoch);
  controller.commitAndRelease(controller.initialEpoch, {
    nextParticleUploads: nextUploads,
    terminal: false,
    status: 'loss-refresh-private-continuation'
  });

  const refreshOutcome = controller.refresh({
    priorEpoch: controller.initialEpoch,
    currentSphParticleUpload: nextUploads.sphParticleUpload,
    currentMlsMpmParticleUpload: nextUploads.mlsMpmParticleUpload
  }).then(
    () => null,
    (error) => error
  );
  await Promise.race([
    (async () => {
      while (!failedGeneration || fenceRequestCount < 1) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    })(),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error('refresh orphan did not reach owner retirement')),
      750
    ))
  ]);
  const fenceCountBeforeLoss = fenceRequestCount;
  let abortSettled = false;
  const abort = controller.abortAllAfter(
    new Error('controller loss superseded refresh orphan'),
    {
      mechanicsRetirement: Promise.resolve(true),
      deviceLost: true
    }
  ).then((retired) => {
    abortSettled = true;
    return retired;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(abortSettled, false);
  assert.equal(fenceRequestCount, fenceCountBeforeLoss);

  resolveDeviceLoss({ reason: 'destroyed', message: 'refresh orphan loss' });
  assert.equal(await Promise.race([
    abort,
    new Promise((_, reject) => setTimeout(
      () => reject(new Error('controller loss cleanup did not complete')),
      750
    ))
  ]), true);
  const refreshError = await refreshOutcome;
  assert.equal(refreshError.code, 'ERR_SCHROEDER_TWO_LEVEL_REFRESHED_GENERATION');
  assert.equal(controller.summary().activeRefreshAttemptCount, 0);
  assert.match(controller.summary().status, /cleanup-complete$/);
  assert.equal(initialTransaction.state, 'aborted');
  assert.equal(failedGeneration.releaseStatus,
    'spatial-epoch-generation-device-loss-retired');
  assert.equal(fenceRequestCount, fenceCountBeforeLoss);

  rejectNormalFence(new Error('stale normal refresh fence after loss'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(initialTransaction.state, 'aborted');
  assert.equal(failedGeneration.releaseStatus,
    'spatial-epoch-generation-device-loss-retired');
  assert.equal(fenceRequestCount, fenceCountBeforeLoss);
  for (const buffer of [
    uploads.sphParticleUpload.stateBuffer,
    uploads.sphParticleUpload.thermoBuffer,
    uploads.sphParticleUpload.identityBuffer,
    uploads.mlsMpmParticleUpload.mechanicsBuffer,
    nextUploads.sphParticleUpload.stateBuffer,
    nextUploads.mlsMpmParticleUpload.mechanicsBuffer,
    assignmentBuffer
  ]) {
    assert.equal(buffer.destroyCount, 0);
  }
});

test('hierarchy artifact retirement waits for full controller completion and a fresh final fence', async () => {
  let resolveController;
  let resolveFinalFence;
  const controllerCompletion = new Promise((resolve) => {
    resolveController = resolve;
  });
  const finalFence = new Promise((resolve) => {
    resolveFinalFence = resolve;
  });
  let finalFenceRequestCount = 0;
  let settled = false;
  const retirementFence = createSchroederHierarchyArtifactRetirementFence({
    device: {
      queue: {
        onSubmittedWorkDone() {
          finalFenceRequestCount += 1;
          return finalFence;
        }
      }
    },
    ownerCompletion: controllerCompletion,
    requirePostControllerQueueFence: true
  });
  retirementFence.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(finalFenceRequestCount, 0);
  assert.equal(settled, false);
  resolveController(true);
  await Promise.resolve();
  assert.equal(finalFenceRequestCount, 1);
  assert.equal(settled, false);
  resolveFinalFence();
  assert.equal(await retirementFence, true);
  assert.equal(settled, true);
});

test('Schroeder two-level authoritative mode adopts admitted merged storage over the coupled outputs', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const uploads = authoritativeUploadFamily(device, { particleCount: 3 });
  const fakeBuffer = (label, size = 4096) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 }),
    device
  );
  const twoLevelMechanicsRunner = (options) =>
    driveAuthoritativeCanonicalEpochs(options, { prefix: 'adoption-two-level' });
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    ...uploads,
    selectedLevel: 0,
    minLevel: 0,
    maxLevel: 1,
    baseGridSpacingM: 0.25,
    dt: 5e-4,
    enableTwoLevelMechanics: true,
    twoLevelMechanicsAuthority: 'authoritative',
    twoLevelFineSubstepCount: 2,
    twoLevelMechanicsRunner,
    enableParticleStorageMaterialization: true,
    enableParticleStorageCountSummary: false,
    particleStorageMaterialization: {
      schema: ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA,
      status: 'schroeder-particle-storage-materialization-submitted',
      particleStorageMaterializationAdmissionApproved: true,
      retainedParticleBuffers: true,
      sourceParticleCount: 3,
      outputParticleCapacity: 6,
      admittedParticleCountDelta: -1,
      targetStateFamilies: [
        'sph-particle-state',
        'mls-mpm-particle-mechanics',
        'sph-particle-thermo',
        'sph-particle-identity'
      ],
      particleStateBuffer: fakeBuffer('merged-state'),
      particleThermoBuffer: fakeBuffer('merged-thermo'),
      particleMechanicsBuffer: fakeBuffer('merged-mechanics'),
      particleIdentityBuffer: fakeBuffer(
        'merged-identity',
        6 * Uint32Array.BYTES_PER_ELEMENT
      ),
      stateBufferByteLength: 6 * 8 * 4,
      thermoBufferByteLength: 6 * 12 * 4,
      mechanicsBufferByteLength: 6 * 32 * 4,
      identityBufferByteLength: 6 * Uint32Array.BYTES_PER_ELEMENT,
      identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
      identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
      identityRequired: true,
      particleIdentityMutationApproved: true,
      identityRevision: 1
    },
    residentStepRunner: async () => ({ status: 'resident-step-stubbed' })
  });

  const step = result.residentStep;
  assert.equal(step.status, 'schroeder-two-level-authoritative-step-executed');
  assert.equal(step.fullParticleReadbackPerformed, false);
  assert.equal(step.fullParticleReadbackFree, true);
  assert.equal(step.residentContinuationReady, true);
  assert.equal(step.readbackTelemetryComplete, true);
  assert.deepEqual(step.readbackTelemetryUnknownSources, []);
  assert.equal(step.mapAsyncCount, 0);
  assert.equal(step.readbackBytes, 0);
  assert.equal(step.hostQueueFenceCount, 0);
  assert.equal(step.normalHotLoopReadbackFree, true);
  // Admitted merged storage supersedes the coupled step's outputs: the
  // continuation uploads carry the adopted buffers with the authoritative
  // (merged) count, and the coupled outputs are released.
  assert.equal(step.schroederParticleStorageAdoption.adopted, true);
  assert.equal(step.schroederParticleStorageAdoption.authoritativeParticleCount, 2);
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.label, 'merged-state');
  assert.equal(step.nextParticleUploads.sphParticleUpload.particleCount, 2);
  assert.equal(
    step.nextParticleUploads.sphParticleUpload.sourceStage,
    'schroeder-particle-storage-materialization'
  );
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer.label, 'merged-mechanics');
  assert.equal(step.nextSphParticleState.particleCount, 2);
  assert.equal(step.nextMlsMpmParticleState.particleCount, 2);
  assert.equal(
    step.nextParticleUploads.schroederSpatialSuccessorSourceFamily ?? null,
    result.schroederSpatialSuccessorSourceFamily ?? null
  );
});

test('M4: Schroeder two-level authoritative mode runs the thermal sidecar sequentially on the coupled outputs', async () => {
  const device = createFakeWebGpuDevice();
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const uploads = authoritativeUploadFamily(device, { particleCount: 3 });
  let coupledResult = null;
  let canonicalEpochController = null;
  const thermalCalls = [];
  let thermalStepResult = null;
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    ...uploads,
    selectedLevel: 0,
    minLevel: 0,
    maxLevel: 1,
    baseGridSpacingM: 0.25,
    dt: 5e-4,
    enableTwoLevelMechanics: true,
    enableMechanicsFieldPairV2: true,
    twoLevelMechanicsAuthority: 'authoritative',
    twoLevelFineSubstepCount: 2,
    twoLevelMechanicsRunner: async (options) => {
      canonicalEpochController = options.canonicalEpochController;
      coupledResult = await driveAuthoritativeCanonicalEpochs(options, {
        prefix: 'thermal-two-level'
      });
      return coupledResult;
    },
    residentStepOptions: {
      thermalMaterialTable: canonicalSidecarThermalMaterialTable,
      mechanicsMaterialTable: canonicalSidecarMechanicsMaterialTable,
      thermalStepRunner: async (options) => {
        thermalCalls.push(options);
        thermalStepResult = await runSphThermalStepWebGpu(options);
        return thermalStepResult;
      }
    },
    residentStepRunner: async () => ({ status: 'resident-step-stubbed' })
  });

  const step = result.residentStep;
  assert.equal(result.mechanicsFieldPairV2Requested, true);
  assert.equal(result.mechanicsFieldPairV2Enabled, true);
  assert.equal(result.mechanicsFieldConstructionMode, 'paired-v2-shared-radix');
  assert.equal(
    result.spatialEpochGeneration.mechanicsFieldPairV2Requested,
    true
  );
  assert.equal(result.spatialEpochGeneration.mechanicsFieldPairV2Enabled, true);
  assert.equal(
    result.spatialEpochGeneration.mechanicsFieldConstructionMode,
    'paired-v2-shared-radix'
  );
  assert.equal(
    result.twoLevelMechanics.canonicalEpochControllerSummary
      .mechanicsFieldPairV2Requested,
    true
  );
  assert.equal(
    result.twoLevelMechanics.canonicalEpochControllerSummary
      .mechanicsFieldPairV2Enabled,
    true
  );
  assert.deepEqual(
    result.twoLevelMechanics.canonicalEpochControllerSummary
      .mechanicsFieldConstructionModes,
    [
      'paired-v2-shared-radix',
      'paired-v2-shared-radix',
      'paired-v2-shared-radix',
      'not-built'
    ]
  );
  assert.equal(
    await result.schroederTwoLevelAggregateTraversalRetirementPromise,
    true
  );
  await Promise.resolve();
  assert.deepEqual(
    device.queueFenceCalls,
    [],
    'successful paired canonical submission retires queue-ordered sidecars without a CPU fence'
  );
  assert.equal(result.twoLevelMechanics.sidecarHostQueueFenceCount, 0);
  assert.equal(step.observedHostQueueFenceCount, 0);
  assert.equal(step.hostQueueFenceCount, 0);
  assert.equal(step.normalHotLoopReadbackFree, true);
  assert.equal(step.sidecars, 'shared-post-mechanics-closure');
  assert.ok(
    step.postMechanicsClosure.queueOrderedFinalConsumerCapabilities.upstream,
    'the existing mechanics-refresh submit seals the sidecar producer claim'
  );
  assert.equal(thermalCalls.length, 1);
  const retiredThermalGraph = thermalCalls[0].thermalResponseGraphUpload;
  assert.equal(retiredThermalGraph.destroyed, true);
  for (const graphBuffer of [
    retiredThermalGraph.responseRecordBuffer,
    retiredThermalGraph.responseBuffer,
    retiredThermalGraph.responseThermalConductivityBuffer,
    retiredThermalGraph.graphNodeBuffer,
    retiredThermalGraph.graphSampleBuffer
  ]) {
    assert.equal(graphBuffer.destroyCount, 1);
  }
  // The sidecar consumes the freshly classified public E* family, not the
  // private S* descriptor or a later-mutated continuation wrapper.
  assert.equal(
    thermalCalls[0].sourceStateBuffer,
    coupledResult.postMechanicsCanonicalUploads.sphParticleUpload.stateBuffer
  );
  assert.equal(
    thermalCalls[0].sourceThermoBuffer,
    coupledResult.postMechanicsCanonicalUploads.sphParticleUpload.thermoBuffer
  );
  assert.equal(thermalCalls[0].readbackMode, 'no-full-readback');
  assert.equal(
    thermalCalls[0].schroederSpatialEpochGeneration,
    coupledResult.postMechanicsEpoch.generation
  );
  assert.equal(
    coupledResult.postMechanicsEpoch.generation
      .exactNearCellTree?.submitPerformed,
    true,
    'thermal readers require the terminal E* exact-near tree'
  );
  assert.equal(
    coupledResult.postMechanicsEpoch.generation.aggregateView?.submitPerformed,
    true,
    'the terminal FAR reader requires the E* aggregate'
  );
  assert.equal(
    coupledResult.postMechanicsEpoch.generation
      .phaseVolumeInterfaceProposalEnabled,
    false,
    'terminal E* has no P2G/G2P reader and must not rebuild S9-A/B/C'
  );
  assert.deepEqual(
    coupledResult.postMechanicsEpoch.generation.mechanicsLevelViews.map(
      (levelView) => [
        levelView.phaseVolumeMoment ?? null,
        levelView.phaseVolumeReceipt ?? null
      ]
    ),
    []
  );
  assert.equal(
    coupledResult.postMechanicsEpoch.transaction
      .phaseVolumeInterfaceProposalAuthoritative,
    false
  );
  assert.equal(
    coupledResult.postMechanicsEpoch.transaction.aggregateViewRequired,
    true
  );
  assert.equal(
    coupledResult.postMechanicsEpoch.transaction.twoLevelAuthoritative,
    false
  );
  assert.equal(
    thermalCalls[0].schroederSpatialThermalProposal.generationId,
    coupledResult.postMechanicsEpoch.generation.execution.generationId
  );
  assert.equal(
    thermalCalls[0].schroederSpatialThermalProposal.exhaustiveTraversalCount,
    0
  );
  assert.equal(
    thermalCalls[0].schroederSpatialThermalProposal.privateBuildCount,
    0
  );
  assert.deepEqual(
    result.twoLevelMechanics.canonicalEpochControllerSummary.epochKinds,
    ['mechanics', 'mechanics', 'mechanics', 'post-mechanics']
  );
  assert.equal(
    result.twoLevelMechanics.canonicalEpochControllerSummary.committedEpochCount,
    4
  );
  assert.deepEqual(
    summarizeSchroederSpatialEpochTransaction(
      coupledResult.postMechanicsEpoch.transaction
    ).consumerReceipts.map((receipt) => receipt.consumerId),
    [
      SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION,
      SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION,
      SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE
    ]
  );
  assert.match(
    coupledResult.postMechanicsEpoch.transaction.state,
    /^(release-scheduled|released)$/
  );
  // The continuation chains the thermal outputs, not the raw coupled state.
  assert.equal(
    step.nextParticleUploads.sphParticleUpload.stateBuffer,
    thermalStepResult.stateBuffer
  );
  assert.equal(
    step.nextParticleUploads.sphParticleUpload.thermoBuffer,
    thermalStepResult.thermoBuffer
  );
  assert.equal(
    step.nextParticleUploads.sphParticleUpload.sourceStage,
    'schroeder-two-level-post-mechanics-closure'
  );
});

test('M4: Schroeder two-level authoritative mode chains the reaction sidecar after thermal', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const uploads = authoritativeUploadFamily(device, { particleCount: 3 });
  let coupledResult = null;
  let thermalStepResult = null;
  const reactionCalls = [];
  const timedProducerIds = [];
  const reactionStateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'reaction-state-out', size: 4096, usage: 128
  }), device);
  const reactionThermoBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'reaction-thermo-out', size: 4096, usage: 128
  }), device);
  const reactionMechanicsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'reaction-mechanics-out', size: 4096, usage: 128
  }), device);
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    ...uploads,
    selectedLevel: 0,
    minLevel: 0,
    maxLevel: 1,
    baseGridSpacingM: 0.25,
    dt: 5e-4,
    enableTwoLevelMechanics: true,
    twoLevelMechanicsAuthority: 'authoritative',
    twoLevelFineSubstepCount: 2,
    gpuTimestampRecorder: {
      active: true,
      async measureQueueStage(descriptor, runStage) {
        timedProducerIds.push(descriptor?.producerId ?? null);
        return runStage();
      }
    },
    twoLevelMechanicsRunner: async (options) => {
      coupledResult = await driveAuthoritativeCanonicalEpochs(options, {
        prefix: 'reaction-two-level',
        terminalOwnsThermoBuffer: true
      });
      tagWebGpuBufferDevice(
        coupledResult.postMechanicsEpoch.generation.source.sourceStateBuffer,
        device
      );
      tagWebGpuBufferDevice(
        coupledResult.postMechanicsEpoch.generation.source.sourceBuffer,
        device
      );
      return coupledResult;
    },
    residentStepOptions: {
      thermalMaterialTable: canonicalSidecarThermalMaterialTable,
      thermalStepRunner: async (options) => {
        thermalStepResult = await runSphThermalStepWebGpu(options);
        return thermalStepResult;
      },
      reactionTable: canonicalSidecarReactionTable(),
      reactionStepRunner: async (options) => {
        reactionCalls.push(options);
        return {
          status: 'reaction-step-executed',
          stateBuffer: reactionStateBuffer,
          thermoBuffer: reactionThermoBuffer,
          mechanicsBuffer: reactionMechanicsBuffer,
          ownsStateBuffer: false,
          ownsThermoBuffer: false,
          ownsMechanicsBuffer: false
        };
      }
    },
    residentStepRunner: async () => ({ status: 'resident-step-stubbed' })
  });

  const step = result.residentStep;
  assert.equal(step.sidecars, 'shared-post-mechanics-closure');
  assert.equal(
    result.twoLevelMechanics.sidecarHostQueueFenceCount,
    2,
    'the non-paired sidecar route reports its reaction-proposal and graph fences'
  );
  assert.ok(step.observedHostQueueFenceCount >= 2);
  assert.equal(step.normalHotLoopReadbackFree, false);
  assert.equal(reactionCalls.length, 1);
  assert.ok(timedProducerIds.includes(
    'schroeder-hierarchy:two-level-post-mechanics-reaction-discovery-proposal'
  ));
  assert.ok(timedProducerIds.includes(
    'schroeder-hierarchy:two-level-coupled-mechanics'
  ));
  assert.ok(timedProducerIds.includes(
    'schroeder-hierarchy:two-level-post-mechanics-reactionStep'
  ));
  assert.equal(timedProducerIds.includes(
    'schroeder-hierarchy:two-level-post-mechanics-spatialReactionDiscoveryProposal'
  ), false);
  // Sequential chaining: the reaction consumes the thermal outputs and the
  // coupled mechanics.
  assert.equal(
    reactionCalls[0].sourceStateBuffer,
    thermalStepResult.stateBuffer
  );
  assert.equal(
    reactionCalls[0].sourceThermoBuffer,
    thermalStepResult.thermoBuffer
  );
  assert.equal(reactionCalls[0].sourceMechanicsBuffer, coupledResult.mechanicsBuffer);
  assert.equal(reactionCalls[0].readbackMode, 'no-full-readback');
  assert.equal(
    reactionCalls[0].schroederSpatialEpochGeneration,
    coupledResult.postMechanicsEpoch.generation
  );
  assert.equal(
    reactionCalls[0].schroederSpatialReactionDiscoveryProposal.generationId,
    coupledResult.postMechanicsEpoch.generation.execution.generationId
  );
  assert.equal(
    reactionCalls[0].schroederSpatialReactionDiscoveryProposal
      .privateLookupBuildCount,
    0
  );
  assert.equal(
    reactionCalls[0].schroederSpatialReactionDiscoveryProposal
      .fixedCandidateBuildCount,
    0
  );
  assert.equal(
    reactionCalls[0].schroederSpatialReactionDiscoveryProposal
      .exhaustiveTraversalCount,
    0
  );
  assert.deepEqual(
    result.twoLevelMechanics.canonicalEpochControllerSummary.epochKinds,
    ['mechanics', 'mechanics', 'mechanics', 'post-mechanics']
  );
  assert.equal(
    result.twoLevelMechanics.canonicalEpochControllerSummary.committedEpochCount,
    4
  );
  assert.deepEqual(
    summarizeSchroederSpatialEpochTransaction(
      coupledResult.postMechanicsEpoch.transaction
    ).consumerReceipts.map((receipt) => receipt.consumerId),
    [
      SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION,
      SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION,
      SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE,
      SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY
    ]
  );
  // The continuation chains the reaction outputs (highest sidecar tier).
  assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer, reactionStateBuffer);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, reactionThermoBuffer);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer, reactionMechanicsBuffer);
  assert.equal(step.nextParticleUploads.sphParticleUpload.ownsStateBuffer, false);
  assert.equal(step.nextParticleUploads.sphParticleUpload.ownsThermoBuffer, false);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.ownsMechanicsBuffer, false);
  assert.equal(
    step.nextParticleUploads.sphParticleUpload.sourceStage,
    'schroeder-two-level-post-mechanics-closure'
  );
  await result.schroederTwoLevelPositiveCompletionPromise;
  await new Promise((resolve) => setImmediate(resolve));
  for (const borrowedReplacement of [
    reactionStateBuffer,
    reactionThermoBuffer,
    reactionMechanicsBuffer
  ]) {
    assert.equal(borrowedReplacement.destroyCount, 0);
  }
});

test('M4: paired canonical mechanics refresh settles thermal and reaction sidecar claims at one existing submit', async () => {
  const device = createFakeWebGpuDevice({ allowReadbackCopies: true });
  const buffers = manualBuffers({ particleCount: 3, smoothingLengthM: 0.25 });
  const uploads = authoritativeUploadFamily(device, { particleCount: 3 });
  let retiredThermalGraph = null;
  let retiredReactionProposal = null;
  const reactionStateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'paired-reaction-state-out', size: 4096, usage: 128
  }), device);
  const reactionThermoBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'paired-reaction-thermo-out', size: 4096, usage: 128
  }), device);
  const reactionMechanicsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'paired-reaction-mechanics-out', size: 4096, usage: 128
  }), device);
  const result = await runSchroederSameLevelMechanicsWebGpu({
    device,
    ...buffers,
    ...uploads,
    selectedLevel: 0,
    minLevel: 0,
    maxLevel: 1,
    baseGridSpacingM: 0.25,
    dt: 5e-4,
    enableTwoLevelMechanics: true,
    enableMechanicsFieldPairV2: true,
    twoLevelMechanicsAuthority: 'authoritative',
    twoLevelFineSubstepCount: 2,
    twoLevelMechanicsRunner: async (options) => (
      driveAuthoritativeCanonicalEpochs(options, {
        prefix: 'paired-reaction-two-level',
        terminalOwnsThermoBuffer: true
      })
    ),
    residentStepOptions: {
      thermalMaterialTable: canonicalSidecarThermalMaterialTable,
      mechanicsMaterialTable: canonicalSidecarMechanicsMaterialTable,
      thermalStepRunner: async (options) => {
        retiredThermalGraph = options.thermalResponseGraphUpload;
        return runSphThermalStepWebGpu(options);
      },
      reactionTable: canonicalSidecarReactionTable(),
      reactionStepRunner: async (options) => {
        retiredReactionProposal =
          options.schroederSpatialReactionDiscoveryProposal;
        return {
          status: 'reaction-step-executed',
          backend: 'webgpu',
          stateBuffer: reactionStateBuffer,
          thermoBuffer: reactionThermoBuffer,
          mechanicsBuffer: reactionMechanicsBuffer,
          ownsStateBuffer: false,
          ownsThermoBuffer: false,
          ownsMechanicsBuffer: false,
          fullParticleReadbackPerformed: false,
          fullParticleReadbackFree: true,
          ...createGpuReadbackTelemetry({
            scope: 'test-paired-reaction-sidecar'
          })
        };
      }
    },
    residentStepRunner: async () => ({ status: 'resident-step-stubbed' })
  });

  await result.schroederTwoLevelAggregateTraversalRetirementPromise;
  await Promise.resolve();
  const step = result.residentStep;
  assert.deepEqual(device.queueFenceCalls, []);
  assert.equal(result.twoLevelMechanics.sidecarHostQueueFenceCount, 0);
  assert.equal(step.hostQueueFenceCount, 0);
  assert.equal(step.normalHotLoopReadbackFree, true);
  assert.ok(
    step.postMechanicsClosure.queueOrderedFinalConsumerCapabilities.upstream
  );
  assert.equal(retiredReactionProposal.released, true);
  assert.equal(retiredThermalGraph.destroyed, true);
  for (const graphBuffer of [
    retiredThermalGraph.responseRecordBuffer,
    retiredThermalGraph.responseBuffer,
    retiredThermalGraph.responseThermalConductivityBuffer,
    retiredThermalGraph.graphNodeBuffer,
    retiredThermalGraph.graphSampleBuffer
  ]) {
    assert.equal(graphBuffer.destroyCount, 1);
  }
});

test('the neighbour candidate arena is byte-bounded instead of scaling with particle count', () => {
  // It used to be lawQueueCount * candidateBudget rows unconditionally: 4 KiB
  // per queue row, about 4 GiB at a million particles before any useful state.
  const n = 1_000_000;
  const plan = createSchroederLawNeighborCandidatePlan({
    lawQueue: { schema: ULG_SCHROEDER_LAW_QUEUE_SCHEMA, activeNodeCount: n, lawQueueCount: n },
    activeNodeList: {
      schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
      activeCandidateCount: n,
      particleCount: n
    },
    particleCount: n
  });
  assert.ok(
    plan.neighborCandidateByteLength <= plan.candidateArenaByteBudget,
    'arena must respect its byte budget'
  );
  assert.ok(
    plan.neighborCandidateByteLength < 512 * 1024 * 1024,
    `arena should be bounded, got ${plan.neighborCandidateByteLength} bytes`
  );
});

test('a bound arena publishes what it dropped rather than truncating silently', () => {
  const n = 1_000_000;
  const plan = createSchroederLawNeighborCandidatePlan({
    lawQueue: { schema: ULG_SCHROEDER_LAW_QUEUE_SCHEMA, activeNodeCount: n, lawQueueCount: n },
    activeNodeList: {
      schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
      activeCandidateCount: n,
      particleCount: n
    },
    particleCount: n
  });
  assert.equal(plan.candidateArenaBound, true);
  assert.ok(plan.droppedCandidateCount > 0, 'dropped rows must be reported');
  assert.equal(
    plan.requestedNeighborCandidateCount - plan.neighborCandidateCount,
    plan.droppedCandidateCount
  );
  assert.ok(plan.admittedCandidateBudget < plan.candidateBudget);
});

test('the kernel receives the admitted budget, not the requested one', () => {
  // Writing candidateBudget rows into an arena sized for fewer runs past the
  // end of the buffer, so the params must carry the admitted value.
  const n = 1_000_000;
  const plan = createSchroederLawNeighborCandidatePlan({
    lawQueue: { schema: ULG_SCHROEDER_LAW_QUEUE_SCHEMA, activeNodeCount: n, lawQueueCount: n },
    activeNodeList: {
      schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
      activeCandidateCount: n,
      particleCount: n
    },
    particleCount: n
  });
  const params = new DataView(createSchroederLawNeighborCandidateParamsArray(plan));
  const budgetInParams = params.getUint32(28, true);
  assert.equal(budgetInParams, plan.admittedCandidateBudget);
  assert.ok(
    budgetInParams * n <= plan.neighborCandidateCount,
    'the kernel must not be able to write past the arena'
  );
});

test('an unbound arena honours the full candidate budget', () => {
  // Small scenes must be unaffected by the cap.
  const n = 1000;
  const plan = createSchroederLawNeighborCandidatePlan({
    lawQueue: { schema: ULG_SCHROEDER_LAW_QUEUE_SCHEMA, activeNodeCount: n, lawQueueCount: n },
    activeNodeList: {
      schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
      activeCandidateCount: n,
      particleCount: n
    },
    particleCount: n
  });
  assert.equal(plan.candidateArenaBound, false);
  assert.equal(plan.droppedCandidateCount, 0);
  assert.equal(plan.admittedCandidateBudget, plan.candidateBudget);
});
