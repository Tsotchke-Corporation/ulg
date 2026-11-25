// Extracted from sphMlsMpmGpuStep.js (Gate 6 Phase D mechanical decomposition).

import {
  composeWgslModule,
  composeWgslVariantFromSource,
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
  SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS,
  SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT,
  SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V1,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_P2G_FINALIZED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_CLEARING,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_BUILDING,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_ENERGY_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_G2P_CLAIMED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_CONSUMED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_TEMPORAL_COARSE_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_LAW_EXACT_P2G,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_CROSS_LEVEL,
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS,
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_MAGIC,
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS,
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_VERSION,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ENERGY_READY,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_G2P_CLAIMED,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_CONSUMED,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ACCUMULATING,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_FAIL_CLOSED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_NONFINITE,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_PHASE_REJECTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CLAIMED,
  SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED,
  SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_REJECTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY,
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0,
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_UNSUPPORTED_SOURCE,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_IDENTITY_MISMATCH,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_NONFINITE,
  ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
  SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
  ULG_REACTION_CLOSURE_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_PREVIEW_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
  validateSchroederSpatialMechanicsViewDescriptor,
  validateSchroederSpatialMechanicsFieldViewDescriptor,
  validateSchroederSpatialActiveSourceViewDescriptor,
  SCHROEDER_SPATIAL_FIELD_CONSUMER_DIRECT_DISPATCH_MAGIC
} from '../../../ulg-gpu-abi/src/index.js';
import {
  GPU_PHASE_IDS,
  requestOpticalGpuDevice
} from '../material/opticalGpuBuffers.js';
import {
  createGpuReadbackTelemetry,
  createGpuReadbackTelemetryAccumulator,
  mergeGpuReadbackTelemetry
} from './sphGpuReadbackTelemetry.js';
import {
  adoptSphGpuParticleDispersedMediumOpticsSidecar,
  destroyMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers,
  ensureSphGpuParticleBufferSetBorrowLifecycle,
  releaseOrDestroyPooledParticleBuffer,
  registerTopologyStableSphDispersedMediumOpticsSourceFamilyContinuation,
  retireSphGpuParticleBufferSetDispersedMediumOptics,
  runSphGpuParticleBufferSetCleanupAfterBorrows,
  sphGpuParticleUploadAdvertisesDispersedMediumOptics,
  sphGpuParticleUploadExactMassBuffer,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  sphParticleStateRequiresExplicitIdentity,
  transferSphGpuParticleBufferSetDispersedMediumOpticsOwnership
} from './sphGpuBuffers.js';
import {
  MLS_MPM_GPU_GRID_VELOCITY_FLOATS,
  SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
  pressureInterfaceGridForceAdmissionAllowsApplication,
  runMlsMpmGridUpdateWithOptionalWebGpu
} from './sphGridUpdateGpuKernel.js';
import {
  SPH_GAS_PRESSURE_CELL_FLOATS,
  packGasPressureCellRows,
  runSphPressureInterfaceForceRowsWebGpu
} from './sphPressureInterfaceGpuKernel.js';
import {
  createSphCpuSeededGasPressureAuthorityGpu,
  describeSphCpuSeededGasPressureAuthorityGpu,
  discardSphCpuSeededGasPressureAuthorityGpu,
  isExactSphCpuSeededGasPressureAuthorityGpu
} from './sphCpuSeededGasPressureAuthorityGpu.js';
import {
  SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE,
  SPH_SPATIAL_GAS_DIAGNOSTICS_NONE,
  SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS as SPH_RETAINED_SPATIAL_GAS_COMPACT_ROW_FLOATS,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V1,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V4,
  ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA as ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA_EXACT,
  describeSphSpatialGasPressureAuthority,
  isExactSphSpatialGasPressureAuthoritySource,
  resolveSphSpatialVaporAerosolProducerRead,
  forkSphSpatialVaporAerosolProducerRead,
  releaseSphSpatialVaporAerosolProducerRead,
  releaseSphSpatialGasLedgerEosAfterQueue,
  runSphSpatialGasLedgerEosRetainedWebGpu
} from './sphSpatialGasLedgerEosGpu.js';
import {
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
  MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL,
  MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS,
  normalizeMlsMpmResidentSummaryScope,
  runMlsMpmResidentSummaryWebGpu
} from './sphMlsMpmGpuSummary.js';
import {
  resolveSphThermalEnvironmentAuthority,
  resolveSphWallReservoirAuthority
} from '../thermalEnvironmentAuthority.js';
import {
  residentProductMassDevice,
  residentProductMassMatchesDevice,
  tagResidentProductMassDevice,
  tagWebGpuBufferDevice,
  webGpuBufferDevice,
  webGpuDeviceId,
  webGpuDeviceMismatchInfo
} from './sphGpuDeviceIdentity.js';
import {
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_DISPATCHES,
  SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES,
  SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
  SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY,
  SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
  isLiveSchroederSpatialMechanicalProposal,
  schroederSpatialMechanicalProposalMatchesContract,
  runSchroederSpatialMechanicalProposalWebGpu
} from './schroederSpatialMechanicalProposalsGpu.js';


export const STEP_SCOPE = 'mls-mpm-resident-step-p2g-grid-update-g2p';
export const DEFAULT_BOX_DIMS_M = Object.freeze([5, 5, 5]);
export const DEFAULT_GRAVITY_M_PER_S2 = Object.freeze([0, -9.80665, 0]);
export const DEFAULT_CFL_FACTOR = 0.6;
export const ULG_SCHROEDER_FAR_FORCE_DELTA_FUSION_EXECUTION_SCHEMA =
  'peercompute.ulg.mls-mpm-schroeder-far-force-delta-fusion-execution.v0';
export const ULG_SPH_REACTION_PLACEMENT_CONTINUATION_ADOPTION_SCHEMA =
  'peercompute.ulg.sph-reaction-placement-continuation-adoption.v1';
export const reactionPlacementContinuationAdoptionRecords = new WeakMap();
export const SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS =
  SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_ROW_LAYOUT.length;
export const SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS =
  SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_ROW_LAYOUT.length;
export const SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS =
  SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_ROW_LAYOUT.length;
export const SCHROEDER_FAR_FORCE_DELTA_FUSION_WORKGROUP_SIZE = 64;
export const FULL_READBACK_MODE = 'full-parity-readback';
export const NO_FULL_READBACK_MODE = 'no-full-readback';
export const SAME_DEVICE_QUEUE_ORDERING_FENCE_POLICY =
  'same-device-queue-ordering-before-admission';
export const SAME_DEVICE_QUEUE_ORDERING_FENCE_STATUS =
  'same-device-queue-ordering-established';
export const SAME_DEVICE_QUEUE_ORDERING_FENCE_METHOD =
  'same-device-queue-submit-order';
export const EXACT_GAS_PRESSURE_MECHANICS_P2G_READ_FAMILIES = Object.freeze([
  'sph-particle-state',
  'mls-mpm-mechanics',
  'schroeder-spatial-epoch'
]);
export const EXACT_GAS_PRESSURE_MECHANICS_GRID_READ_FAMILIES = Object.freeze([
  'mls-mpm-grid',
  'resident-gas-pressure',
  'schroeder-spatial-epoch'
]);
export const EXACT_GAS_PRESSURE_MECHANICS_G2P_READ_FAMILIES = Object.freeze([
  'sph-particle-state',
  'mls-mpm-mechanics',
  'mls-mpm-grid',
  'schroeder-spatial-epoch'
]);
export const EXACT_GAS_PRESSURE_MECHANICS_TRANSIENT_GRID_BUFFER_REFS =
  Object.freeze([
    'mls-mpm-p2g-grid-buffer',
    'mls-mpm-grid-update-buffer'
  ]);
export const MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP = 'every-step';
export const MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY = 'final-only';
export const MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_PLAN_ONLY = 'plan-only';
export const MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE = 'none';
export const MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_EVERY_STEP = 'every-step';
export const MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_FINAL_ONLY = 'final-only';
export const MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_NONE = 'none';
export const P2G_ACCUMULATOR_COMPONENTS = 4;
export const MECHANICS_FIELD_P2G_STENCIL_SIZE = 27;
export const MECHANICS_FIELD_P2G_CONTRIBUTION_FLOATS = 12;
export const COMPACT_MECHANICS_PREFLIGHT_ENTRY_POINTS = Object.freeze([
  Object.freeze({ id: 'header', entryPoint: 'preflight_compact_mechanics_view' }),
  Object.freeze({ id: 'owner', entryPoint: 'preflight_compact_mechanics_owner_identity' }),
  Object.freeze({ id: 'epoch', entryPoint: 'preflight_compact_mechanics_epoch_identity' }),
  Object.freeze({ id: 'grid', entryPoint: 'preflight_compact_mechanics_grid_geometry' }),
  Object.freeze({ id: 'topology', entryPoint: 'preflight_compact_mechanics_topology_counts' }),
  Object.freeze({ id: 'dispatch', entryPoint: 'preflight_compact_mechanics_dispatch' })
]);
export const MECHANICS_FIELD_PREFLIGHT_ENTRY_POINTS = Object.freeze([
  Object.freeze({ id: 'field-claim', entryPoint: 'claim_mechanics_field_mutation' }),
  Object.freeze({ id: 'field-header', entryPoint: 'preflight_mechanics_field_header' }),
  Object.freeze({ id: 'field-layout', entryPoint: 'preflight_mechanics_field_layout' })
]);
export const FUSED_SINGLE_LEVEL_MECHANICS_FIELD_G2P_RECEIPT_ENTRY_POINTS =
  Object.freeze([
    Object.freeze({ id: 'claim', entryPoint: 'claim_g2p_energy_receipt' }),
    Object.freeze({ id: 'measure', entryPoint: 'measure_g2p_energy_receipt' }),
    Object.freeze({ id: 'consume-field', entryPoint: 'consume_g2p_energy_receipt' })
  ]);
export const SCHROEDER_MECHANICAL_DEFERRED_ENTRY_POINTS = Object.freeze([
  'initialize_contact_graph',
  'reduce_support',
  'materialize_contact_graph',
  'finalize_contact_graph_counts',
  'scatter_contact_graph_csr',
  'index_contact_graph_csr',
  'validate_contact_graph_csr',
  'complete_zero_contact_proposal',
  ...Array.from(
    { length: SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS },
    () => [
      'measure_runtime_iteration',
      'solve_runtime_iteration',
      'allocate_energy_runtime_iteration'
    ]
  ).flat(),
  'initialize_matching_cleanup_constraints',
  ...Array.from(
    { length: SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_DISPATCHES },
    () => 'run_matching_cleanup_global_owner'
  ),
  'restore_matching_cleanup_trust',
  'verify_contact_energy',
  'verify_contact_residual',
  'initialize_contact_interface_receipt',
  'materialize_contact_interface_receipt',
  'publish_contact_proposal',
  'seal_contact_proposal',
  'commit_contact_proposal',
  'seal_contact_interface_receipt'
]);
// This is the fixed portion of the retained-graph bundle. The exclusive scan
// contributes a capacity-dependent number of additional dispatches which is
// reconciled from the encoded proposal artifact instead of guessed here.
export const SCHROEDER_MECHANICAL_DEFERRED_DISPATCH_COUNT =
  SCHROEDER_MECHANICAL_DEFERRED_ENTRY_POINTS.length;
export const SCHROEDER_MECHANICAL_DEFERRED_PARTICLE_PARALLEL_DISPATCH_COUNT =
  // Six graph/source commands, constraint initialization, and five
  // post-cleanup publication commands are particle/source-axis dispatches.
  // The bounded cleanup owner is one workgroup and is intentionally excluded.
  12
  + 3 * SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS;
const SCHROEDER_ACTIVE_NODE_FLOATS = SCHROEDER_ACTIVE_NODE_ROW_LAYOUT.length;
export const SCHROEDER_LEVEL_ASSIGNMENT_FLOATS = SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length;
export const ULG_MLS_MPM_RESIDENT_STAGE_TIMING_SCHEMA =
  'peercompute.ulg.mls-mpm-resident-stage-timing.v0';

export const ULG_MLS_MPM_RESIDENT_DISPATCH_TOPOLOGY_SCHEMA = 'peercompute.ulg.mls-mpm-resident-dispatch-topology.v0';
export const ULG_MLS_MPM_RESIDENT_GPU_LANE_ADAPTER_SCHEMA = 'peercompute.ulg.mls-mpm-resident-gpu-lane-adapter.v0';
export const ULG_MLS_MPM_FUSED_ACTIVE_GRID_DISPATCH_SCHEMA = 'peercompute.ulg.mls-mpm-fused-active-grid-dispatch.v0';
export const ULG_MLS_MPM_ACTIVE_GRID_DISPATCH_POLICY_SCHEMA = 'peercompute.ulg.mls-mpm-active-grid-dispatch-policy.v0';
export const ULG_MLS_MPM_RESIDENT_SEQUENCE_LANE_CONTRACT_SCHEMA = 'peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0';
export const ULG_MLS_MPM_FUSED_RESIDENT_SIDECAR_PLAN_SCHEMA = 'peercompute.ulg.mls-mpm-fused-resident-sidecar-plan.v0';
export const ULG_MLS_MPM_FUSED_RESIDENT_SIDECAR_STEP_EVIDENCE_SCHEMA = 'peercompute.ulg.mls-mpm-fused-resident-sidecar-step-evidence.v0';
export const ULG_UNIFORM_GAUGE_PRESSURE_STRESS_ADMISSION_SCHEMA =
  'peercompute.ulg.uniform-gauge-pressure-stress-admission.v0';
export const ULG_MLS_MPM_SIDECAR_AWARE_RESIDENT_SEQUENCE_SCHEMA = 'peercompute.ulg.mls-mpm-sidecar-aware-resident-sequence.v0';
export const ULG_MLS_MPM_THERMAL_SIDECAR_DIRECT_RUNNER_CONTRACT_SCHEMA = 'peercompute.ulg.mls-mpm-thermal-sidecar-direct-runner-contract.v0';
export const ULG_MLS_MPM_THERMAL_SIDECAR_DIRECT_RUNNER_STEP_SCHEMA = 'peercompute.ulg.mls-mpm-thermal-sidecar-direct-runner-step.v0';
export const ULG_SCHROEDER_PARTICLE_STORAGE_ADOPTION_SCHEMA =
  'peercompute.ulg.schroeder-particle-storage-adoption.v0';
export const ULG_MLS_MPM_FUSED_RESIDENT_SEQUENCE_PREFLIGHT_SCHEMA = 'peercompute.ulg.mls-mpm-fused-resident-sequence-preflight.v0';
export const ULG_MLS_MPM_WEBGPU_OCEAN_HOT_LOOP_BUDGET_SCHEMA = 'peercompute.ulg.mls-mpm-webgpu-ocean-hot-loop-budget.v0';
export const ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.mls-mpm-resident-compute-task.v0';
export const ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.mls-mpm-resident-compute-task-result.v0';
export const ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.mls-mpm-resident-steps-compute-task.v0';
export const ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.mls-mpm-resident-steps-compute-task-result.v0';
export const ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-only-resident-steps-compute-task.v0';
export const ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-only-resident-steps-compute-task-result.v0';
export const ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-p2g-stage-compute-task.v0';
export const ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-p2g-stage-compute-task-result.v0';
export const ULG_MLS_MPM_MECHANICS_P2G_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-p2g-stage-task-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-grid-update-stage-compute-task.v0';
export const ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-grid-update-stage-compute-task-result.v0';
export const ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-grid-update-stage-task-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-g2p-stage-compute-task.v0';
export const ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-g2p-stage-compute-task-result.v0';
export const ULG_MLS_MPM_MECHANICS_G2P_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-g2p-stage-task-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_STAGE_TASK_CHAIN_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-stage-task-chain.v0';
export const ULG_MLS_MPM_MECHANICS_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-worker-compact-publication-candidate.v0';
export const ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.sph-pressure-interface-stage-compute-task.v0';
export const ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.sph-pressure-interface-stage-compute-task-result.v0';
export const ULG_SPH_PRESSURE_INTERFACE_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.pressure-interface-stage-task-evidence.v0';
export const ULG_SPH_PRESSURE_INTERFACE_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA = 'peercompute.ulg.sph-pressure-interface-worker-compact-publication-candidate.v0';
export const ULG_SPH_PRESSURE_INTERFACE_SOURCE_KEY_REPLAY_DESCRIPTOR_SCHEMA = 'peercompute.ulg.sph-pressure-interface-source-key-replay-descriptor.v0';
export const ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.sph-spatial-gas-ledger-producer-stage-compute-task.v0';
export const ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.sph-spatial-gas-ledger-producer-stage-compute-task-result.v0';
export const ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.spatial-gas-ledger-producer-stage-task-evidence.v0';
export const ULG_SPH_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA = 'peercompute.ulg.sph-spatial-gas-species-ledger.v0';
export const ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA = 'peercompute.ulg.sph-retained-spatial-gas-species-ledger-source.v0';
export const ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.sph-gas-cell-eos-producer-stage-compute-task.v0';
export const ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.sph-gas-cell-eos-producer-stage-compute-task-result.v0';
export const ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.gas-cell-eos-producer-stage-task-evidence.v0';
export const ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA = 'peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0';
export const ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA = 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0';
export const ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA = 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0';
export const ULG_SPH_THERMAL_PHASE_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA = 'peercompute.ulg.sph-thermal-phase-worker-compact-publication-candidate.v0';
export const ULG_SPH_REACTION_PRODUCT_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA = 'peercompute.ulg.sph-reaction-product-worker-compact-publication-candidate.v0';
export const ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.sph-thermal-phase-stage-compute-task.v0';
export const ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.sph-thermal-phase-stage-compute-task-result.v0';
export const ULG_SPH_THERMAL_PHASE_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.thermal-phase-stage-task-evidence.v0';

export function thermalAuthorityTaskPayloadFromStepOptions(stepOptions = {}) {
  const thermalEnvironmentAuthority =
    resolveSphThermalEnvironmentAuthority({
      ambientTemperatureK: stepOptions.ambientTemperatureK,
      thermalEnvironmentAuthority:
        stepOptions.thermalEnvironmentAuthority ?? null
    });
  const wallReservoirAuthority =
    resolveSphWallReservoirAuthority({
      wallTemperaturesK: stepOptions.wallTemperaturesK,
      wallReservoirAuthority:
        stepOptions.wallReservoirAuthority ?? null,
      wallModel: stepOptions.wallModel
    });
  return {
    ambientTemperatureK:
      thermalEnvironmentAuthority.ambientTemperatureK,
    thermalEnvironmentAuthority,
    wallTemperaturesK: { ...wallReservoirAuthority.faces },
    wallReservoirAuthority
  };
}
export const ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.sph-reaction-product-stage-compute-task.v0';
export const ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.sph-reaction-product-stage-compute-task-result.v0';
export const ULG_SPH_REACTION_PRODUCT_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.reaction-product-stage-task-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_STAGE_LANE_CONTRACT_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-stage-lane-contract.v0';
export const ULG_MLS_MPM_MECHANICS_CHILD_STAGE_KERNEL_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-child-stage-kernel-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_CHILD_P2G_STAGE_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-child-p2g-stage-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_CHILD_GRID_UPDATE_STAGE_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-child-grid-update-stage-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_CHILD_G2P_STAGE_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-child-g2p-stage-evidence.v0';
export const ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA = 'peercompute.ulg.mls-mpm-resident-steps-commit-delta.v0';
export const ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA = 'peercompute.ulg.mls-mpm-resident-steps-state-delta.v0';
export const ULG_MLS_MPM_RESIDENT_STEPS_SOLVER_TASK_BRIDGE_SCHEMA = 'peercompute.ulg.mls-mpm-resident-steps-solver-task-bridge.v0';
export const ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_DESCRIPTOR_SCHEMA =
  'peercompute.ulg.schroeder-adopted-particle-storage-descriptor.v0';
export const ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_CONTINUATION_SCHEDULE_SCHEMA =
  'peercompute.ulg.schroeder-adopted-particle-storage-continuation-schedule.v0';
export const ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_LOCAL_RESOLVER_SCHEMA =
  'peercompute.ulg.schroeder-adopted-particle-storage-local-resolver.v0';
export const SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILY_NAMES = Object.freeze([
  'sph-particle-state',
  'mls-mpm-particle-mechanics',
  'sph-particle-thermo',
  'sph-particle-identity'
]);

export const MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY = Object.freeze({
  excluded: 0,
  eligible: 1,
  rejected: 2
});

function normalizedMechanicsFieldContactKey(value) {
  if (value == null || typeof value.length !== 'number' || value.length < 4) {
    return null;
  }
  const key = Array.from({ length: 4 }, (_, index) => Number(value[index]));
  return key.every((word) => (
    Number.isSafeInteger(word) && word >= 0 && word <= 0xffff_ffff
  )) ? key : null;
}

export function classifyMlsMpmMechanicsFieldContactPair(leftValue, rightValue) {
  const left = normalizedMechanicsFieldContactKey(leftValue);
  const right = normalizedMechanicsFieldContactKey(rightValue);
  const rejected = (reason) => ({
    accepted: false,
    eligible: false,
    policy: MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.rejected,
    reason
  });
  if (!left || !right) return rejected('malformed-field-key');
  if (left[0] !== right[0]) {
    return {
      accepted: true,
      eligible: false,
      policy: MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.excluded,
      reason: 'different-grid-node'
    };
  }
  for (const key of [left, right]) {
    const [, phaseId, materialId, continuityDomainId] = key;
    const phaseReady = phaseId >= GPU_PHASE_IDS.solid
      && phaseId <= GPU_PHASE_IDS.plasma;
    const domainReady = phaseId === GPU_PHASE_IDS.solid
      ? continuityDomainId !== 0
      : continuityDomainId === 0;
    if (!phaseReady || materialId === 0 || !domainReady) {
      return rejected('invalid-phase-material-domain-key');
    }
  }
  const leftPhase = left[1];
  const rightPhase = right[1];
  const leftNoncondensed = leftPhase >= GPU_PHASE_IDS.gas;
  const rightNoncondensed = rightPhase >= GPU_PHASE_IDS.gas;
  if (leftNoncondensed && rightNoncondensed) {
    return {
      accepted: true,
      eligible: false,
      policy: MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.excluded,
      reason: 'all-noncondensed-contact-owned-by-eos'
    };
  }
  if (leftNoncondensed !== rightNoncondensed) {
    return {
      accepted: true,
      eligible: false,
      policy: MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.excluded,
      reason: 'mixed-noncondensed-contact-requires-authenticated-interface-receipt'
    };
  }
  if (left[2] !== right[2]) {
    return {
      accepted: true,
      eligible: true,
      policy: MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.eligible,
      reason: 'different-material-condensed-contact'
    };
  }
  const solidLiquidInterface = (
    leftPhase === GPU_PHASE_IDS.solid
      && rightPhase === GPU_PHASE_IDS.liquid
  ) || (
    leftPhase === GPU_PHASE_IDS.liquid
      && rightPhase === GPU_PHASE_IDS.solid
  );
  if (solidLiquidInterface) {
    return {
      accepted: true,
      eligible: true,
      policy: MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.eligible,
      reason: 'same-material-solid-liquid-interface-contact'
    };
  }
  const distinctSolidDomains = leftPhase === GPU_PHASE_IDS.solid
    && rightPhase === GPU_PHASE_IDS.solid
    && left[3] !== right[3];
  return {
    accepted: true,
    eligible: distinctSolidDomains,
    policy: distinctSolidDomains
      ? MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.eligible
      : MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.excluded,
    reason: distinctSolidDomains
      ? 'same-material-distinct-solid-domain-contact'
      : 'same-material-continuum-phase-companion'
  };
}

export function normalizeMlsMpmResidentCompactSummaryMode(value) {
  const mode = String(value || MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP).trim().toLowerCase();
  if (mode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY) {
    return MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY;
  }
  if (
    mode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_PLAN_ONLY
    || mode === 'active-grid-plan-only'
    || mode === 'dispatch-plan-only'
    || mode === 'no-readback-plan'
  ) {
    return MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_PLAN_ONLY;
  }
  if (
    mode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE
    || mode === 'skip'
    || mode === 'disabled'
  ) {
    return MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE;
  }
  return MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP;
}

export function normalizeMlsMpmActiveGridPlanRefreshMode(value) {
  const mode = String(value || MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_EVERY_STEP).trim().toLowerCase();
  if (mode === MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_FINAL_ONLY) {
    return MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_FINAL_ONLY;
  }
  if (
    mode === MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_NONE
    || mode === 'skip'
    || mode === 'disabled'
  ) {
    return MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_NONE;
  }
  return MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_EVERY_STEP;
}

export function compactSummaryStepCountForMode({
  readbackMode = FULL_READBACK_MODE,
  compactSummaryMode = MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP,
  stepCount = 1
} = {}) {
  if (readbackMode !== NO_FULL_READBACK_MODE) return 0;
  if (compactSummaryMode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE) return 0;
  if (compactSummaryMode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_PLAN_ONLY) return 0;
  if (compactSummaryMode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY) return 1;
  return Math.max(1, Math.round(finiteNumber(stepCount, 1)));
}

export function compactSummaryModeRequestsReadback(mode) {
  return mode !== MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE
    && mode !== MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_PLAN_ONLY;
}
export const ULG_LAW_GRAPH_NODE_TASK_REF_SCHEMA = 'peercompute.ulg.law-graph-node-task-ref.v0';
export const PEERCOMPUTE_GPU_FENCE_REPORT_SCHEMA = 'peercompute.compute.gpu-fence-report.v0';
export const PEERCOMPUTE_GPU_FENCE_REQUIREMENT_SCHEMA = 'peercompute.compute.gpu-fence-requirement.v0';
export const PEERCOMPUTE_GPU_RESIDENT_LANE_TASK_SCHEMA = 'peercompute.compute.gpu-resident-lane-task.v0';
export const COMPACT_SUMMARY_READBACK_BYTES = MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
export const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};
const fusedCrossLevelRefluxDummyBuffers = new WeakMap();

export function fusedCrossLevelRefluxDummyBuffer(device) {
  let buffer = fusedCrossLevelRefluxDummyBuffers.get(device);
  if (!buffer) {
    buffer = tagWebGpuBufferDevice(device.createBuffer({
      label: 'ulg-mls-mpm-fused-empty-cross-level-reflux',
      size: 16,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    }), device);
    fusedCrossLevelRefluxDummyBuffers.set(device, buffer);
  }
  return buffer;
}
export const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};
export const DEFAULT_FUSED_ACTIVE_GRID_SAFETY_CELLS = 3;
export const FUSED_P2G_PARAMS_BYTES = 160;
export const FUSED_ACTIVE_SOURCE_V2_P2G_PARAMS_BYTES = 208;
export const FUSED_ACTIVE_P2G_PARAMS_BYTES = 176;
export const FUSED_CANONICAL_G2P_PARAMS_BYTES = 144;
export const FUSED_ACTIVE_SOURCE_V2_G2P_PARAMS_BYTES = 176;
export const SCHROEDER_SPATIAL_EPOCH_SCHEMA = 'peercompute.ulg.schroeder-spatial-epoch.v1';
export const SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA =
  'peercompute.ulg.schroeder-spatial-epoch-generation.v1';
export const COMPUTE_DISPATCH_INDIRECT_UINTS = 3;
export const MECHANICS_STAGE_ORDER = Object.freeze(['p2g', 'gridUpdate', 'g2p']);
export const SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID = 'spatialGasLedgerProducer';
export const GAS_CELL_EOS_PRODUCER_STAGE_ID = 'gasCellEosProducer';
export const PRESSURE_INTERFACE_STAGE_ID = 'pressureInterface';
export const THERMAL_PHASE_STAGE_ID = 'thermalPhase';
export const REACTION_PRODUCT_STAGE_ID = 'reactionProduct';
export const PRESSURE_INTERFACE_SOURCE_KEY_BUFFER_REF = 'sph-interface-source-key-buffer';
export const SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS = 12;

export function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

/**
 * Capture the optional synchronous queue-stage summary interface without
 * assuming that every active GPU timestamp recorder implements it.
 *
 * Timestamp-query span recorders resolve asynchronously and intentionally do
 * not expose `stageGpuMs()` / `stageGpuStats()`. Queue-fence recorders do. The
 * shared runtime accepts both recorder kinds, so `active` alone is not a method
 * capability contract.
 */
export function summarizeGpuTimestampRecorderQueueStages(
  gpuTimestampRecorder = null
) {
  const provided = gpuTimestampRecorder !== null
    && gpuTimestampRecorder !== undefined;
  const active = gpuTimestampRecorder?.active === true;
  const capabilities = {
    measureQueueStage:
      typeof gpuTimestampRecorder?.measureQueueStage === 'function',
    encoderSpans: Boolean(
      gpuTimestampRecorder?.encoderSpansSupported !== false
      && typeof gpuTimestampRecorder?.beginEncoderSpan === 'function'
      && typeof gpuTimestampRecorder?.endEncoderSpan === 'function'
    ),
    stageGpuMs: typeof gpuTimestampRecorder?.stageGpuMs === 'function',
    stageGpuStats: typeof gpuTimestampRecorder?.stageGpuStats === 'function'
  };
  let stageGpuMs = null;
  let stageGpuStats = null;
  let stageGpuMsValid = false;
  let stageGpuStatsValid = false;
  if (active && capabilities.stageGpuMs) {
    const value = gpuTimestampRecorder.stageGpuMs();
    stageGpuMsValid = Boolean(
      value
      && typeof value === 'object'
      && !Array.isArray(value)
    );
    stageGpuMs = stageGpuMsValid ? value : null;
  }
  if (active && capabilities.stageGpuStats) {
    const value = gpuTimestampRecorder.stageGpuStats();
    stageGpuStatsValid = Boolean(
      value
      && typeof value === 'object'
      && !Array.isArray(value)
    );
    stageGpuStats = stageGpuStatsValid ? value : null;
  }
  const status = !provided
    ? 'gpu-timestamp-recorder-not-provided'
    : !active
      ? 'gpu-timestamp-recorder-inactive'
      : !capabilities.stageGpuMs && !capabilities.stageGpuStats
        ? 'gpu-timestamp-recorder-stage-summary-unavailable'
        : (
            capabilities.stageGpuMs !== stageGpuMsValid
            || capabilities.stageGpuStats !== stageGpuStatsValid
          )
          ? 'gpu-timestamp-recorder-stage-summary-invalid'
          : !capabilities.stageGpuMs || !capabilities.stageGpuStats
            ? 'gpu-timestamp-recorder-stage-summary-partial'
            : 'gpu-timestamp-recorder-stage-summary-ready';
  return {
    status,
    recorderSchema: gpuTimestampRecorder?.schema ?? null,
    recorderKind: gpuTimestampRecorder?.recorderKind ?? null,
    active,
    capabilities,
    stageGpuMs,
    stageGpuStats
  };
}

export function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function finiteNumberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function resolveUniformGaugePressureStressAdmission({
  pressureInterfaceForceSolver = null,
  pressureInterfaceGridForceAdmission = null,
  consumerDeviceId = null
} = {}) {
  const forceRowCount = Math.max(0, Math.round(finiteNumber(
    pressureInterfaceForceSolver?.forceRowCount,
    0
  )));
  const legacyAdmission = pressureInterfaceGridForceAdmissionAllowsApplication({
    pressureInterfaceGridForceAdmission,
    pressureInterfaceForceSolver,
    forceRowCount,
    consumerDeviceId
  });
  const explicitPressurePa = Number(pressureInterfaceForceSolver?.uniformGaugePressureStressPa);
  const fallbackPressurePa = Number(pressureInterfaceForceSolver?.gasInterfaceGaugePressurePa);
  const explicitUniformEvidence = pressureInterfaceForceSolver?.uniformGaugePressureStressEligible === true
    && Number.isFinite(explicitPressurePa);
  // Backward compatibility for already-published uniform solvers. Local fields
  // must carry explicit uniformity evidence; silently averaging them here would
  // discard the spatial authority the pressure stage worked to establish.
  const legacyUniformEvidence = !('uniformGaugePressureStressEligible' in (pressureInterfaceForceSolver || {}))
    && pressureInterfaceForceSolver?.pressureFieldMode === 'uniform-single-cell-sealed-gas'
    && pressureInterfaceForceSolver?.localPressureGradientReady !== true
    && Number.isFinite(fallbackPressurePa);
  const uniformEvidenceAccepted = explicitUniformEvidence || legacyUniformEvidence;
  const pressurePa = explicitUniformEvidence ? explicitPressurePa : fallbackPressurePa;
  const solverReady = pressureInterfaceForceSolver?.status === 'pressure-interface-force-solver-ready';
  const approved = solverReady
    && legacyAdmission.approved === true
    && uniformEvidenceAccepted
    && Number.isFinite(pressurePa);
  const status = approved
    ? 'uniform-gauge-pressure-stress-consumption-approved'
    : (!pressureInterfaceForceSolver
        ? 'uniform-gauge-pressure-stress-not-requested'
        : (!solverReady
            ? 'uniform-gauge-pressure-stress-blocked-solver-not-ready'
            : (legacyAdmission.approved !== true
                ? 'uniform-gauge-pressure-stress-blocked-admission'
                : 'uniform-gauge-pressure-stress-blocked-nonuniform-field')));
  return {
    schema: ULG_UNIFORM_GAUGE_PRESSURE_STRESS_ADMISSION_SCHEMA,
    status,
    approved,
    enabled: approved,
    pressurePa: approved ? pressurePa : 0,
    requestedPressurePa: Number.isFinite(pressurePa) ? pressurePa : null,
    target: 'condensed-particle-solid-plus-liquid-fraction',
    applicationPath: approved ? 'mls-mpm-p2g-isotropic-external-stress' : null,
    uniformEvidenceAccepted,
    uniformEvidenceSource: explicitUniformEvidence
      ? (pressureInterfaceForceSolver.uniformGaugePressureStressSource || 'explicit-solver-evidence')
      : (legacyUniformEvidence ? 'legacy-uniform-single-cell-solver' : null),
    sourcePressureRangePa: pressureInterfaceForceSolver?.uniformGaugePressureStressRangePa ?? null,
    legacySurfaceTractionSuppressed: Boolean(pressureInterfaceForceSolver),
    legacyAdmissionStatus: legacyAdmission.status,
    legacyAdmissionApproved: legacyAdmission.approved === true,
    sourceSolverSchema: pressureInterfaceForceSolver?.schema ?? null,
    sourceSolverStatus: pressureInterfaceForceSolver?.status ?? null,
    sourceSolverForceRowCount: forceRowCount,
    sourceSolverFingerprint: pressureInterfaceGridForceAdmission?.pressureInterfaceForceSolverFingerprint
      ?? pressureInterfaceGridForceAdmission?.sourceKey
      ?? null,
    consumerDeviceId: consumerDeviceId || null,
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

export function uniqueNonEmptyStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean))];
}

function normalizeSchroederAdoptedParticleStorageConsumerMode(value = 'same-device') {
  const mode = String(value || 'same-device').trim().toLowerCase();
  return ['cross-peer', 'remote-peer', 'distributed-peer'].includes(mode)
    ? 'cross-peer'
    : 'same-device';
}

export function createSchroederAdoptedParticleStorageContinuationSchedule({
  continuationPlan = null,
  consumerMode = 'same-device',
  required = false,
  taskIdPrefix = null,
  laneId = null,
  stateKey = null
} = {}) {
  const plan = continuationPlan && typeof continuationPlan === 'object' ? continuationPlan : null;
  const requested = Boolean(plan || required);
  const mode = normalizeSchroederAdoptedParticleStorageConsumerMode(plan?.consumerMode || consumerMode);
  const sameDeviceReady = Boolean(
    plan
    && mode === 'same-device'
    && plan.ready === true
    && plan.sameDeviceContinuationReady === true
  );
  const crossPeerReady = Boolean(
    plan
    && mode === 'cross-peer'
    && plan.ready === true
    && plan.crossPeerContinuationReady === true
  );
  const scheduled = sameDeviceReady || crossPeerReady;
  const retainedBufferRefs = scheduled
    ? uniqueNonEmptyStrings(plan?.sameDevicePrivateLaneRefs?.length
        ? plan.sameDevicePrivateLaneRefs
        : plan?.retainedBufferRefs)
    : [];
  const crossPeerBlocked = Boolean(plan && mode === 'cross-peer' && !crossPeerReady);
  const requiredBlocked = Boolean(required && !scheduled);
  const failClosed = crossPeerBlocked || requiredBlocked;
  const reason = scheduled
    ? null
    : (
        plan?.reason
        || plan?.crossPeerReplayBlocker
        || (mode === 'cross-peer'
          ? 'cross-peer-portable-materialization-required'
          : 'same-device-private-lane-continuation-not-ready')
      );
  return {
    schema: ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_CONTINUATION_SCHEDULE_SCHEMA,
    status: !requested
      ? 'schroeder-adopted-particle-storage-continuation-not-requested'
      : scheduled
        ? (mode === 'cross-peer'
            ? 'schroeder-adopted-particle-storage-cross-peer-scheduled'
            : 'schroeder-adopted-particle-storage-same-device-scheduled')
        : (mode === 'cross-peer'
            ? 'blocked-schroeder-adopted-particle-storage-cross-peer-scheduling'
            : 'blocked-schroeder-adopted-particle-storage-same-device-scheduling'),
    requested,
    scheduled,
    failClosed,
    reason,
    consumerMode: mode,
    taskIdPrefix,
    laneId,
    stateKey,
    sourceHotBufferKey: plan?.hotBufferKey || plan?.sourceHotBufferKey || null,
    sourceStateKey: plan?.stateKey || null,
    sourceCacheKey: plan?.cacheKey || null,
    continuationPlan,
    continuationPlanSchema: plan?.schema || null,
    continuationPlanStatus: plan?.status || null,
    continuationPlanReady: plan?.ready === true,
    sameDeviceContinuationReady: plan?.sameDeviceContinuationReady === true,
    sameDevicePrivateLaneContinuation: sameDeviceReady,
    sameDevicePrivateLaneRefs: mode === 'same-device' ? retainedBufferRefs : [],
    retainedBufferRefs,
    retainedBufferRefCount: retainedBufferRefs.length,
    crossPeerContinuationReady: plan?.crossPeerContinuationReady === true,
    crossPeerReplayReady: plan?.crossPeerReplayReady === true,
    crossPeerReplayStatus: plan?.crossPeerReplayStatus || null,
    crossPeerReplayBlocker: plan?.crossPeerReplayBlocker || null,
    portableSnapshotRequired: plan?.portableSnapshotRequired === true,
    portableSnapshotAvailable: plan?.portableSnapshotAvailable === true,
    portableMaterializationSeedAvailable: plan?.portableMaterializationSeedAvailable === true,
    portableReplayAvailable: plan?.portableReplayAvailable === true,
    rawGpuBufferTransferAllowed: false,
    rawGpuBufferTransferDetected: plan?.rawGpuBufferTransferDetected === true,
    descriptorOnlyPeerComputeHandoff: true,
    authoritativeStateMutation: false,
    schedulerPolicy: mode === 'cross-peer'
      ? 'fail-closed-until-portable-snapshot-or-materialization-seed'
      : 'same-device-private-lane-descriptor-continuation'
  };
}

function schroederAdoptedParticleStorageRoleRefs(schedule = null) {
  const refs = uniqueNonEmptyStrings(schedule?.sameDevicePrivateLaneRefs?.length
    ? schedule.sameDevicePrivateLaneRefs
    : schedule?.retainedBufferRefs);
  const byRole = {
    state: refs.find((ref) => /(^|[-_:])state([-_:]|$)/i.test(ref) && !/thermo/i.test(ref))
      || refs.find((ref) => ref === 'sph-state-buffer')
      || null,
    thermo: refs.find((ref) => /thermo/i.test(ref))
      || refs.find((ref) => ref === 'sph-thermo-buffer')
      || null,
    mechanics: refs.find((ref) => /mechanics/i.test(ref))
      || refs.find((ref) => ref === 'mls-mpm-mechanics-buffer')
      || null,
    identity: refs.find((ref) => /identity/i.test(ref))
      || refs.find((ref) => ref === 'sph-particle-identity-buffer')
      || null
  };
  return { refs, byRole };
}

function resolveSchroederAdoptedParticleStorageLocalBuffer({
  resolver = null,
  ref = null,
  role = null,
  schedule = null
} = {}) {
  if (!resolver || !ref) return null;
  let resolved = null;
  if (typeof resolver === 'function') {
    resolved = resolver(ref, { role, schedule });
  } else if (resolver instanceof Map) {
    resolved = resolver.get(ref);
  } else if (resolver && typeof resolver === 'object') {
    resolved = resolver[ref] || resolver[role] || null;
  }
  if (!resolved) return null;
  const buffer = resolved.buffer || resolved.gpuBuffer || null;
  if (!buffer) return null;
  return {
    ref,
    role,
    buffer,
    byteLength: Math.max(0, Math.round(finiteNumber(resolved.byteLength, 0))),
    strideBytes: Math.max(0, Math.round(finiteNumber(resolved.strideBytes, 0))),
    particleCount: Math.max(0, Math.round(finiteNumber(resolved.particleCount, 0))),
    status: resolved.status || 'retained-buffer-ready',
    resourceKey: resolved.resourceKey || ref
  };
}

export function createSchroederAdoptedParticleStorageLocalResolverBinding({
  schedule = null,
  resolver = null,
  sphParticleState = null,
  mlsMpmParticleState = null
} = {}) {
  const requested = schedule?.scheduled === true && schedule.consumerMode === 'same-device';
  const { refs, byRole } = schroederAdoptedParticleStorageRoleRefs(schedule);
  const identityRequired = schedule?.continuationPlan?.identityRequired === true;
  const requiredRoles = [
    'state',
    'thermo',
    'mechanics',
    ...(identityRequired ? ['identity'] : [])
  ];
  const resolvedRoles = [
    'state',
    'thermo',
    'mechanics',
    ...(byRole.identity ? ['identity'] : [])
  ];
  const missingDeclaredRefs = requiredRoles
    .filter((role) => !byRole[role])
    .map((role) => `${role}-ref`);
  const resolved = {
    state: resolveSchroederAdoptedParticleStorageLocalBuffer({
      resolver,
      ref: byRole.state,
      role: 'state',
      schedule
    }),
    thermo: resolveSchroederAdoptedParticleStorageLocalBuffer({
      resolver,
      ref: byRole.thermo,
      role: 'thermo',
      schedule
    }),
    mechanics: resolveSchroederAdoptedParticleStorageLocalBuffer({
      resolver,
      ref: byRole.mechanics,
      role: 'mechanics',
      schedule
    }),
    identity: resolveSchroederAdoptedParticleStorageLocalBuffer({
      resolver,
      ref: byRole.identity,
      role: 'identity',
      schedule
    })
  };
  const missingResolvedRefs = resolvedRoles
    .filter((role) => byRole[role] && !resolved[role])
    .map((role) => byRole[role]);
  const resolverMissing = requested && !resolver;
  const ready = Boolean(
    requested
    && !resolverMissing
    && missingDeclaredRefs.length === 0
    && missingResolvedRefs.length === 0
  );
  const particleCount = Math.max(
    0,
    Math.round(finiteNumber(
      resolved.state?.particleCount
        || resolved.thermo?.particleCount
        || resolved.mechanics?.particleCount
        || resolved.identity?.particleCount
        || sphParticleState?.particleCount
        || mlsMpmParticleState?.particleCount,
      0
    ))
  );
  const blocker = ready
    ? null
    : !requested
      ? 'schroeder-adopted-particle-storage-continuation-not-scheduled'
      : resolverMissing
        ? 'same-device-retained-buffer-resolver-required'
        : missingDeclaredRefs.length > 0
          ? 'schroeder-adopted-particle-storage-required-refs-missing'
          : 'schroeder-adopted-particle-storage-local-resolver-missing-retained-refs';
  const sphParticleUpload = ready
    ? {
        schema: 'peercompute.ulg.schroeder-adopted-particle-storage-sph-upload.v0',
        status: 'webgpu-uploaded',
        source: 'schroeder-adopted-particle-storage-local-resolver',
        sourceHotBufferKey: schedule.sourceHotBufferKey || null,
        particleCount,
        stateBuffer: resolved.state.buffer,
        thermoBuffer: resolved.thermo.buffer,
        identityBuffer: resolved.identity?.buffer || null,
        stateBufferByteLength: resolved.state.byteLength,
        thermoBufferByteLength: resolved.thermo.byteLength,
        identityBufferByteLength: resolved.identity?.byteLength ?? 0,
        identitySchema: resolved.identity
          ? ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
          : null,
        identityStrideBytes: resolved.identity?.strideBytes
          || (resolved.identity ? SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT : 0),
        identityRequired,
        identityRevision: schedule?.continuationPlan?.identityRevision || null,
        renderDomainKeys: { ...(schedule?.continuationPlan?.renderDomainKeys || {}) },
        ownsStateBuffer: false,
        ownsThermoBuffer: false,
        ownsIdentityBuffer: false,
        retainedBufferRefs: [byRole.state, byRole.thermo, byRole.identity].filter(Boolean),
        sameDeviceOnly: true,
        peerComputePortable: false,
        rawGpuBufferPeerComputeTransfer: false
      }
    : null;
  const mlsMpmParticleUpload = ready
    ? {
        schema: 'peercompute.ulg.schroeder-adopted-particle-storage-mls-mpm-upload.v0',
        status: 'webgpu-uploaded',
        source: 'schroeder-adopted-particle-storage-local-resolver',
        sourceHotBufferKey: schedule.sourceHotBufferKey || null,
        particleCount,
        mechanicsBuffer: resolved.mechanics.buffer,
        mechanicsBufferByteLength: resolved.mechanics.byteLength,
        retainedBufferRefs: [byRole.mechanics],
        sameDeviceOnly: true,
        peerComputePortable: false,
        rawGpuBufferPeerComputeTransfer: false
      }
    : null;
  return {
    schema: ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_LOCAL_RESOLVER_SCHEMA,
    status: !requested
      ? 'schroeder-adopted-particle-storage-local-resolver-not-requested'
      : ready
        ? 'schroeder-adopted-particle-storage-local-resolver-ready'
        : 'blocked-schroeder-adopted-particle-storage-local-resolver',
    requested,
    ready,
    blocker,
    sameDeviceOnly: true,
    peerComputePortable: false,
    descriptorOnlyPeerComputeHandoff: true,
    rawGpuBufferTransferAllowed: false,
    rawGpuBufferPeerComputeTransfer: false,
    sourceHotBufferKey: schedule?.sourceHotBufferKey || null,
    retainedBufferRefs: refs,
    requiredRefsByRole: byRole,
    missingDeclaredRefs,
    missingResolvedRefs,
    resolvedRefs: uniqueNonEmptyStrings(
      resolvedRoles.map((role) => resolved[role]?.ref)
    ),
    resolvedRefCount: resolvedRoles.filter((role) => resolved[role]).length,
    identityRequired,
    identityResolved: Boolean(resolved.identity),
    particleCount,
    sphParticleUpload,
    mlsMpmParticleUpload,
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

export function summarizeSchroederAdoptedParticleStorageLocalResolverBinding(binding = null) {
  if (!binding || typeof binding !== 'object') return null;
  return {
    schema: binding.schema || ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_LOCAL_RESOLVER_SCHEMA,
    status: binding.status || null,
    requested: binding.requested === true,
    ready: binding.ready === true,
    blocker: binding.blocker || null,
    sameDeviceOnly: binding.sameDeviceOnly === true,
    peerComputePortable: binding.peerComputePortable === true,
    descriptorOnlyPeerComputeHandoff: binding.descriptorOnlyPeerComputeHandoff === true,
    rawGpuBufferTransferAllowed: binding.rawGpuBufferTransferAllowed === true,
    rawGpuBufferPeerComputeTransfer: binding.rawGpuBufferPeerComputeTransfer === true,
    sourceHotBufferKey: binding.sourceHotBufferKey || null,
    retainedBufferRefs: [...(binding.retainedBufferRefs || [])],
    requiredRefsByRole: { ...(binding.requiredRefsByRole || {}) },
    missingDeclaredRefs: [...(binding.missingDeclaredRefs || [])],
    missingResolvedRefs: [...(binding.missingResolvedRefs || [])],
    resolvedRefs: [...(binding.resolvedRefs || [])],
    resolvedRefCount: binding.resolvedRefCount ?? 0,
    identityRequired: binding.identityRequired === true,
    identityResolved: binding.identityResolved === true,
    particleCount: binding.particleCount ?? 0,
    sphUploadReady: binding.sphParticleUpload?.status === 'webgpu-uploaded',
    mlsMpmUploadReady: binding.mlsMpmParticleUpload?.status === 'webgpu-uploaded'
  };
}

function isGpuHandleLikeValue(value) {
  if (!value || typeof value !== 'object') return false;
  const ctor = value.constructor?.name || '';
  if (/^GPU/.test(ctor)) return true;
  return typeof value.mapAsync === 'function' && typeof value.destroy === 'function';
}

function workerTransportableStructuredCloneValue(value, seen = new Set(), depth = 0) {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' ? undefined : value;
  }
  if (isGpuHandleLikeValue(value)) return undefined;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  if (seen.has(value) || depth > 12) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const cloned = workerTransportableStructuredCloneValue(entry, seen, depth + 1);
      return cloned === undefined ? null : cloned;
    });
  }
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    const cloned = workerTransportableStructuredCloneValue(entry, seen, depth + 1);
    if (cloned !== undefined) out[key] = cloned;
  }
  return out;
}

export function workerTransportableMaterialInterfaceField(field = null) {
  if (!field || typeof field !== 'object') return field ?? null;
  const hadRetainedSourceKeyBuffer = Boolean(field.interfaceSourceKeyBuffer);
  const transportable = workerTransportableStructuredCloneValue(field);
  if (!transportable || typeof transportable !== 'object') return null;
  if (hadRetainedSourceKeyBuffer) {
    // The retained sph-interface-source-key GPU buffer stays main-thread
    // owned; the worker-side pressure stage keeps its legacy non-sidecar
    // fallback when this transport marker is present without the buffer.
    transportable.interfaceSourceKeyBufferRetained = true;
    transportable.interfaceSourceKeyBufferMainThreadRetained = true;
    transportable.interfaceSourceKeyBufferTransport =
      'main-thread-retained-not-worker-clonable';
  }
  return transportable;
}

export function normalizeSameDeviceRetainedBufferImportDescriptor(source = null) {
  if (!source || typeof source !== 'object' || source.sameDevice !== true) return null;
  const sourceHotBufferKey = typeof source.sourceHotBufferKey === 'string' && source.sourceHotBufferKey.trim()
    ? source.sourceHotBufferKey.trim()
    : (
        typeof source.hotBufferKey === 'string' && source.hotBufferKey.trim()
          ? source.hotBufferKey.trim()
          : (
              typeof source.hotBufferRecordKey === 'string' && source.hotBufferRecordKey.trim()
                ? source.hotBufferRecordKey.trim()
                : null
            )
      );
  if (!sourceHotBufferKey) return null;
  return {
    ...source,
    sourceHotBufferKey,
    sameDevice: true
  };
}

export function isPressureInterfaceGasCellFieldAdmissionApproved(admission = null) {
  return admission?.schema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
    && admission?.status === 'pressure-interface-gas-cell-field-consumption-approved'
    && admission?.gasCellFieldConsumptionApproved === true;
}

const RETAINED_GAS_CELL_IMPORT_GRAPH_KEYS = Object.freeze([
  'retainedGasCellFieldSource',
  'pressureInterfaceGasCellFieldImport',
  'pressureInterfaceGasCellFieldAdmission',
  'gasCellFieldAdmission',
  'admission'
]);

const RETAINED_GAS_CELL_IMPORT_GRAPH_LIMIT = 64;
const RETAINED_GAS_CELL_PRESSURE_ALIAS_KEYS = Object.freeze([
  'gasPressureCellsBuffer',
  'pressureInterfaceGasPressureCellsBuffer',
  'retainedGasPressureCellsBuffer'
]);
const RETAINED_GAS_CELL_CONTROL_ALIAS_KEYS = Object.freeze([
  'gasAuthorityControlBuffer',
  'retainedGasAuthorityControlBuffer',
  'pressureInterfaceGasAuthorityControlBuffer'
]);
const RETAINED_GAS_CELL_IMPORT_SNAPSHOT_KEYS = Object.freeze([
  ...RETAINED_GAS_CELL_IMPORT_GRAPH_KEYS,
  ...RETAINED_GAS_CELL_PRESSURE_ALIAS_KEYS,
  ...RETAINED_GAS_CELL_CONTROL_ALIAS_KEYS,
  'schema',
  'status',
  'gasCellFieldConsumptionApproved',
  'retainedGasCellFieldSourceReady'
]);

function retainedGasCellImportGraphError(code, message, cause = null) {
  const error = new Error(message);
  error.code = code;
  if (cause != null) error.cause = cause;
  return error;
}

function retainedGasCellImportOwnDescriptor(record, key) {
  try {
    return Object.getOwnPropertyDescriptor(record, key) || null;
  } catch (cause) {
    throw retainedGasCellImportGraphError(
      'ERR_ULG_RETAINED_GAS_CELL_IMPORT_DESCRIPTOR_INSPECTION',
      `retained gas-cell import descriptor inspection failed for ${key}`,
      cause
    );
  }
}

export function retainedGasCellImportGraph(importValue = null) {
  const pending = [];
  const scheduled = new Set();
  const records = [];
  const byRecord = new Map();
  const descriptorCache = new WeakMap();
  const prototypeCache = new WeakMap();
  const descriptorFor = (record, key) => {
    let cache = descriptorCache.get(record);
    if (!cache) descriptorCache.set(record, cache = new Map());
    if (!cache.has(key)) {
      cache.set(key, retainedGasCellImportOwnDescriptor(record, key));
    }
    return cache.get(key);
  };
  const inheritedSchemasFor = (record) => {
    const schemas = [];
    const seen = new Set([record]);
    let cursor = record;
    while (cursor != null) {
      try {
        if (!prototypeCache.has(cursor)) {
          prototypeCache.set(cursor, Object.getPrototypeOf(cursor));
        }
        cursor = prototypeCache.get(cursor);
      } catch (cause) {
        throw retainedGasCellImportGraphError(
          'ERR_ULG_RETAINED_GAS_CELL_IMPORT_PROTOTYPE_INSPECTION',
          'retained gas-cell import prototype could not be inspected',
          cause
        );
      }
      if (cursor == null) break;
      if (seen.has(cursor) || seen.size >= RETAINED_GAS_CELL_IMPORT_GRAPH_LIMIT) {
        throw retainedGasCellImportGraphError(
          'ERR_ULG_RETAINED_GAS_CELL_IMPORT_GRAPH_LIMIT',
          'retained gas-cell import prototype chain is cyclic or exceeds the bounded depth'
        );
      }
      seen.add(cursor);
      const descriptor = descriptorFor(cursor, 'schema');
      if (!descriptor) continue;
      if (!Object.hasOwn(descriptor, 'value')) {
        throw retainedGasCellImportGraphError(
          'ERR_ULG_RETAINED_GAS_CELL_IMPORT_SCHEMA_ACCESSOR',
          'retained gas-cell import inherited schema must be a data property'
        );
      }
      schemas.push(descriptor.value);
    }
    return Object.freeze(schemas);
  };
  const enqueue = (record) => {
    if (
      !record
      || (typeof record !== 'object' && typeof record !== 'function')
      || scheduled.has(record)
    ) return;
    if (scheduled.size >= RETAINED_GAS_CELL_IMPORT_GRAPH_LIMIT) {
      throw retainedGasCellImportGraphError(
        'ERR_ULG_RETAINED_GAS_CELL_IMPORT_GRAPH_LIMIT',
        `retained gas-cell import graph exceeds ${RETAINED_GAS_CELL_IMPORT_GRAPH_LIMIT} records`
      );
    }
    scheduled.add(record);
    pending.push(record);
  };
  enqueue(importValue);
  while (pending.length > 0) {
    const record = pending.shift();
    const descriptors = new Map();
    for (const key of RETAINED_GAS_CELL_IMPORT_SNAPSHOT_KEYS) {
      const descriptor = descriptorFor(record, key);
      descriptors.set(key, descriptor);
      if (
        (RETAINED_GAS_CELL_IMPORT_GRAPH_KEYS.includes(key) || key === 'schema')
        && descriptor
        && !Object.hasOwn(descriptor, 'value')
      ) {
        throw retainedGasCellImportGraphError(
          'ERR_ULG_RETAINED_GAS_CELL_IMPORT_LINK_ACCESSOR',
          `retained gas-cell import wrapper link ${key} must be an own data property`
        );
      }
    }
    const inheritedSchemas = inheritedSchemasFor(record);
    const captured = Object.freeze({ record, descriptors, inheritedSchemas });
    records.push(captured);
    byRecord.set(record, captured);
    for (const key of RETAINED_GAS_CELL_IMPORT_GRAPH_KEYS) {
      const descriptor = descriptors.get(key);
      if (descriptor && Object.hasOwn(descriptor, 'value')) {
        enqueue(descriptor.value);
      }
    }
  }
  return Object.freeze({
    records: Object.freeze(records),
    byRecord
  });
}

function retainedGasCellImportCapturedValue(captured = null, key) {
  const descriptor = captured?.descriptors?.get(key) || null;
  return descriptor && Object.hasOwn(descriptor, 'value')
    ? descriptor.value
    : undefined;
}

export function retainedGasCellImportRecordValue(graph = null, record = null, key) {
  return retainedGasCellImportCapturedValue(graph?.byRecord?.get(record), key);
}

function retainedGasCellImportOwnDataValue(record = null, key) {
  if (!record || (typeof record !== 'object' && typeof record !== 'function')) {
    return undefined;
  }
  const descriptor = retainedGasCellImportOwnDescriptor(record, key);
  return descriptor && Object.hasOwn(descriptor, 'value')
    ? descriptor.value
    : undefined;
}

export function retainedGasCellSourceFromImportGraph(graph = null) {
  const records = graph?.records || [];
  const exactSource = records.find(({ record }) => (
    isExactSphSpatialGasPressureAuthoritySource(record)
  ));
  if (exactSource) return exactSource.record;
  for (const schema of [
    ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
    ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V4,
    ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3,
    ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2,
    ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V1,
    ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA
  ]) {
    const source = records.find((captured) => (
      retainedGasCellImportCapturedValue(captured, 'schema') === schema
    ));
    if (source) return source.record;
  }
  return null;
}

function retainedGasCellImportSchemaObservation(graph = null) {
  let exactSchemaMutated = false;
  let forgedV4Authority = false;
  let retiredAuthoritySchema = false;
  for (const captured of graph?.records || []) {
    const schema = retainedGasCellImportCapturedValue(captured, 'schema');
    const exactIdentity = isExactSphSpatialGasPressureAuthoritySource(
      captured.record
    );
    if (
      exactIdentity
      && schema !== ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
    ) exactSchemaMutated = true;
    if (
      !exactIdentity
      && schema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
    ) forgedV4Authority = true;
    if (
      schema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2
      || schema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3
      || schema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V4
    ) retiredAuthoritySchema = true;
    for (const inheritedSchema of captured.inheritedSchemas) {
      if (inheritedSchema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA) {
        forgedV4Authority = true;
      }
      if (
        inheritedSchema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2
        || inheritedSchema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3
        || inheritedSchema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V4
      ) retiredAuthoritySchema = true;
    }
  }
  return Object.freeze({
    exactSchemaMutated,
    forgedV4Authority,
    retiredAuthoritySchema
  });
}

function retainedGasCellAdmissionFromImportGraph(graph = null) {
  for (const key of [
    'pressureInterfaceGasCellFieldAdmission',
    'gasCellFieldAdmission',
    'admission'
  ]) {
    const captured = graph?.records?.find((entry) => {
      const value = retainedGasCellImportCapturedValue(entry, key);
      return value && (typeof value === 'object' || typeof value === 'function');
    });
    if (captured) return retainedGasCellImportCapturedValue(captured, key);
  }
  return null;
}

export function retainedGasCellImportAliasObservation(graph = null) {
  let pressureAlias = null;
  let controlAlias = null;
  let aliasPresent = false;
  const accessorKeys = [];
  const inspect = (captured, keys, assign) => {
    for (const key of keys) {
      const descriptor = captured.descriptors.get(key);
      if (!descriptor) continue;
      aliasPresent = true;
      if (!Object.hasOwn(descriptor, 'value')) {
        accessorKeys.push(key);
        continue;
      }
      if (descriptor.value !== null && descriptor.value !== undefined) {
        assign(descriptor.value);
      }
    }
  };
  for (const captured of graph?.records || []) {
    inspect(captured, RETAINED_GAS_CELL_PRESSURE_ALIAS_KEYS, (value) => {
      if (pressureAlias == null) pressureAlias = value;
    });
    inspect(captured, RETAINED_GAS_CELL_CONTROL_ALIAS_KEYS, (value) => {
      if (controlAlias == null) controlAlias = value;
    });
  }
  return Object.freeze({
    pressureAlias,
    controlAlias,
    accessorKeys: Object.freeze(accessorKeys),
    aliasPresent,
    accessorRejected: accessorKeys.length > 0,
    nonNullAliasObserved: pressureAlias != null || controlAlias != null
  });
}

function retainedGasCellImportAdmissionApproved(graph = null, admission = null) {
  const captured = graph?.byRecord?.get(admission) || null;
  if (!captured) return isPressureInterfaceGasCellFieldAdmissionApproved(admission);
  return retainedGasCellImportCapturedValue(captured, 'schema')
      === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
    && retainedGasCellImportCapturedValue(captured, 'status')
      === 'pressure-interface-gas-cell-field-consumption-approved'
    && retainedGasCellImportCapturedValue(
      captured,
      'gasCellFieldConsumptionApproved'
    ) === true;
}

export function normalizePressureInterfaceGasCellFieldImport(
  importValue = null,
  { device = null } = {}
) {
  const source = importValue && typeof importValue === 'object' ? importValue : null;
  const importGraph = retainedGasCellImportGraph(source);
  const retainedGasCellFieldSource =
    retainedGasCellSourceFromImportGraph(importGraph);
  const sourceSchema = retainedGasCellImportRecordValue(
    importGraph,
    source,
    'schema'
  );
  const sourceStatus = retainedGasCellImportRecordValue(
    importGraph,
    source,
    'status'
  );
  const retainedSourceStatus = retainedGasCellImportRecordValue(
    importGraph,
    retainedGasCellFieldSource,
    'status'
  );
  const schemaObservation = retainedGasCellImportSchemaObservation(importGraph);
  const aliasObservation = retainedGasCellImportAliasObservation(importGraph);
  const gasPressureCellsBuffer = aliasObservation.pressureAlias;
  const exactPressureAuthorityIdentity = Boolean(
    retainedGasCellFieldSource
    && isExactSphSpatialGasPressureAuthoritySource(retainedGasCellFieldSource)
  );
  const exactV4SchemaMutated = schemaObservation.exactSchemaMutated;
  const forgedV4Authority = schemaObservation.forgedV4Authority;
  const retiredAuthoritySchema = schemaObservation.retiredAuthoritySchema;
  const exactV4Authority = Boolean(
    exactPressureAuthorityIdentity && !exactV4SchemaMutated
  );
  const exactV4Description = exactV4Authority
    ? describeSphSpatialGasPressureAuthority(
        retainedGasCellFieldSource,
        device ? { device } : {}
      )
    : null;
  const exactV4RawAliasRejected = exactPressureAuthorityIdentity && Boolean(
    aliasObservation.aliasPresent
  );
  const gasCellField = exactPressureAuthorityIdentity
    ? null
    : source?.gasCellFieldSnapshot
      || source?.gasCellField
      || source?.pressureFeedback?.gasCellField
      || null;
  const sourceIsSchroederGasCellImport =
    sourceSchema === ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA
    || sourceSchema === ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA;
  const pressureInterfaceGasPressureCellRowCount = Math.max(0, Math.trunc(finiteNumber(
    exactPressureAuthorityIdentity
      ? 0
      : source?.pressureInterfaceGasPressureCellRowCount
        ?? source?.gasPressureCellRowCount
        ?? retainedGasCellFieldSource?.pressureInterfaceGasPressureCellRowCount,
    0
  )));
  const pressureInterfaceGasPressureCellRowStrideFloats = Math.max(0, Math.trunc(finiteNumber(
    exactV4Description?.pressureCellStrideFloats
      ?? source?.pressureInterfaceGasPressureCellRowStrideFloats
      ?? source?.gasPressureCellRowStrideFloats
      ?? retainedGasCellFieldSource?.pressureInterfaceGasPressureCellRowStrideFloats,
    SPH_GAS_PRESSURE_CELL_FLOATS
  )));
  const pressureInterfaceGasPressureCellRowByteLength = Math.max(0, Math.trunc(finiteNumber(
    exactV4Description?.pressureCellCapacity
      ? exactV4Description.pressureCellCapacity
        * exactV4Description.pressureCellStrideFloats
        * Float32Array.BYTES_PER_ELEMENT
      : source?.pressureInterfaceGasPressureCellRowByteLength
      ?? source?.gasPressureCellRowByteLength
      ?? retainedGasCellFieldSource?.pressureInterfaceGasPressureCellRowByteLength,
    pressureInterfaceGasPressureCellRowCount
      * Math.max(pressureInterfaceGasPressureCellRowStrideFloats, SPH_GAS_PRESSURE_CELL_FLOATS)
      * Float32Array.BYTES_PER_ELEMENT
  )));
  const pressureInterfaceGasPressureCellRowCapacity = Math.max(0, Math.trunc(finiteNumber(
    exactV4Description?.pressureCellCapacity
      ?? source?.pressureInterfaceGasPressureCellRowCapacity
      ?? source?.gasPressureCellRowCapacity
      ?? retainedGasCellFieldSource?.pressureInterfaceGasPressureCellRowCapacity
      ?? retainedGasCellFieldSource?.gasPressureCellRowCapacity,
    0
  )));
  const capturedAdmission = retainedGasCellAdmissionFromImportGraph(importGraph);
  const retainedGasPressureBufferRefs = exactPressureAuthorityIdentity
    ? []
    : uniqueNonEmptyStrings([
        ...(retainedGasCellImportOwnDataValue(
          source,
          'retainedGasPressureBufferRefs'
        ) || []),
        ...(retainedGasCellImportOwnDataValue(
          retainedGasCellFieldSource,
          'retainedGasPressureBufferRefs'
        ) || []),
        ...(retainedGasCellImportOwnDataValue(
          capturedAdmission,
          'retainedGasPressureBufferRefs'
        ) || [])
      ]);
  const workerRetainedGasPressureBufferRefs = exactPressureAuthorityIdentity
    ? []
    : uniqueNonEmptyStrings([
        ...(retainedGasCellImportOwnDataValue(
          source,
          'workerRetainedGasPressureBufferRefs'
        ) || []),
        ...(retainedGasCellImportOwnDataValue(
          retainedGasCellFieldSource,
          'workerRetainedGasPressureBufferRefs'
        ) || []),
        ...(retainedGasCellImportOwnDataValue(
          capturedAdmission,
          'workerRetainedGasPressureBufferRefs'
        ) || [])
      ]);
  const exactV4AuthorityReady = Boolean(
    exactV4Authority
    && !forgedV4Authority
    && !retiredAuthoritySchema
    && exactV4Description?.readyObserved === true
    && !exactV4RawAliasRejected
    && retainedSourceStatus === 'retained-gas-cell-eos-source-submitted'
    && pressureInterfaceGasPressureCellRowCapacity > 0
    && pressureInterfaceGasPressureCellRowStrideFloats
      === SPH_GAS_PRESSURE_CELL_FLOATS
    && exactV4Description.consumerSubmittedObserved !== true
    && exactV4Description.consumerBorrowedObserved !== true
    && exactV4Description.releaseScheduledObserved !== true
    && exactV4Description.releasedObserved !== true
    && exactV4Description.terminalObserved !== true
    && (!device || exactV4Description.deviceAuthenticated === true)
  );
  const retainedRowsReady = exactV4AuthorityReady || Boolean(
    !exactPressureAuthorityIdentity
      && !forgedV4Authority
      && !retiredAuthoritySchema
      && !aliasObservation.accessorRejected
      && gasPressureCellsBuffer
      && pressureInterfaceGasPressureCellRowCount > 0
      && pressureInterfaceGasPressureCellRowStrideFloats === SPH_GAS_PRESSURE_CELL_FLOATS
      && (
        source?.pressureInterfaceImportReady === true
        || source?.pressureInterfaceGasPressureCellRowsBufferRetained === true
        || source?.gasPressureCellRowsBufferRetained === true
        || retainedGasCellFieldSource?.pressureInterfaceGasPressureCellRowsBufferRetained === true
      )
  );
  const derivedSchroederAdmission = sourceIsSchroederGasCellImport && retainedRowsReady
    ? {
        schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
        status: 'pressure-interface-gas-cell-field-consumption-approved',
        gasCellFieldConsumptionApproved: true,
        sourceSchema: source.schema,
        sourceHotBufferKey:
          source.sourceHotBufferKey
          || source.hotBufferKey
          || retainedGasCellFieldSource?.sourceHotBufferKey
          || null,
        sourceStage: source.sourceStage || retainedGasCellFieldSource?.sourceStage || 'schroederFarAggregateGasCellImport',
        retainedGasPressureBufferRefs,
        workerRetainedGasPressureBufferRefs,
        retainedGasCellFieldSource,
        pressureInterfaceGasPressureCellRowCount,
        pressureInterfaceGasPressureCellRowStrideFloats,
        pressureInterfaceGasPressureCellRowByteLength,
        stateManagerAdmitted: true,
        authoritativeStateMutation: false
      }
    : null;
  const admission = capturedAdmission || derivedSchroederAdmission || null;
  const admissionApprovalShapeValid = derivedSchroederAdmission === admission
    ? isPressureInterfaceGasCellFieldAdmissionApproved(admission)
    : retainedGasCellImportAdmissionApproved(importGraph, admission);
  const exactAdmissionSource = retainedGasCellImportRecordValue(
    importGraph,
    admission,
    'retainedGasCellFieldSource'
  );
  const exactAdmissionSourceMatches = !exactPressureAuthorityIdentity
    || exactAdmissionSource === retainedGasCellFieldSource;
  const admissionApproved = Boolean(
    admissionApprovalShapeValid && exactAdmissionSourceMatches
  );
  const normalizedAdmission = exactPressureAuthorityIdentity
    ? (admissionApproved
        ? Object.freeze({
            schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
            status: 'pressure-interface-gas-cell-field-consumption-approved',
            gasCellFieldConsumptionApproved: true,
            retainedGasCellFieldSource
          })
        : null)
    : admission;
  const schemaAccepted = sourceSchema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA
    || sourceIsSchroederGasCellImport
    || exactV4Authority;
  const statusAccepted = sourceStatus === 'pressure-interface-gas-cell-field-import-ready'
    || (
      exactV4Authority
      && source === retainedGasCellFieldSource
      && sourceStatus === 'retained-gas-cell-eos-source-submitted'
    )
    || (
      sourceIsSchroederGasCellImport
      && sourceStatus === 'schroeder-far-aggregate-gas-cell-import-submitted'
      && source?.pressureInterfaceImportReady === true
    );
  const localPressureGradientReady = gasCellField?.localPressureGradientReady === true
    && Array.isArray(gasCellField?.cells)
    && gasCellField.cells.length > 0;
  const retainedLocalPressureGradientReady =
    retainedRowsReady && !exactV4AuthorityReady;
  const retainedRefsReady = exactV4AuthorityReady
    || retainedGasPressureBufferRefs.length > 0
    || workerRetainedGasPressureBufferRefs.length > 0;
  const importReady = Boolean(
    !exactV4SchemaMutated
      && !forgedV4Authority
      && !retiredAuthoritySchema
      && !exactV4RawAliasRejected
      && !aliasObservation.accessorRejected
      && schemaAccepted
      && statusAccepted
      && (localPressureGradientReady || retainedRowsReady)
      && admissionApproved
      && retainedRefsReady
  );
  const blocker = (() => {
    if (!source) return 'pressure-interface-gas-cell-field-import-not-supplied';
    if (exactV4SchemaMutated) {
      return 'pressure-interface-gas-cell-field-import-v4-source-schema-mutated';
    }
    if (forgedV4Authority) {
      return 'pressure-interface-gas-cell-field-import-v4-source-identity-invalid';
    }
    if (retiredAuthoritySchema) {
      return 'pressure-interface-gas-cell-field-import-retired-source-schema-rejected';
    }
    if (exactV4RawAliasRejected) {
      return 'pressure-interface-gas-cell-field-import-v4-raw-buffer-alias-rejected';
    }
    if (aliasObservation.accessorRejected) {
      return 'pressure-interface-gas-cell-field-import-raw-buffer-alias-accessor-rejected';
    }
    if (!schemaAccepted) {
      return 'pressure-interface-gas-cell-field-import-schema-invalid';
    }
    if (!statusAccepted) {
      return 'pressure-interface-gas-cell-field-import-not-ready';
    }
    if (!(localPressureGradientReady || retainedRowsReady)) {
      return 'pressure-interface-gas-cell-field-import-local-gradient-required';
    }
    if (!admissionApproved) {
      return 'pressure-interface-gas-cell-field-import-admission-required';
    }
    if (!retainedRefsReady) {
      return 'pressure-interface-gas-cell-field-import-retained-buffer-ref-required';
    }
    return null;
  })();
  const exactString = (...values) => values.find((value) => (
    typeof value === 'string' && value.length > 0
  )) || null;
  const exactBoolean = (...values) => {
    const value = values.find((candidate) => typeof candidate === 'boolean');
    return value ?? null;
  };
  const exactEpochIdentity = exactV4Description?.epochIdentity || null;
  return {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
    sourceSchema: sourceSchema || null,
    status: importReady ? 'pressure-interface-gas-cell-field-import-ready' : blocker,
    blocker,
    importReady,
    gasCellField: exactPressureAuthorityIdentity
      ? null
      : (importReady ? gasCellField : null),
    gasCellFieldPresent: exactPressureAuthorityIdentity
      ? false
      : Boolean(gasCellField),
    localPressureGradientReady:
      localPressureGradientReady || retainedLocalPressureGradientReady,
    retainedLocalPressureGradientReady,
    gpuPressureAuthorityReady: exactV4AuthorityReady,
    gasPressureCellLogicalCountGpuAuthored: exactV4AuthorityReady,
    exactGasPressureAuthorityDescription: exactV4Description,
    exactGasPressureAuthorityDeviceAuthenticated:
      exactV4Description?.deviceAuthenticated === true,
    exactGasPressureAuthorityRawAliasRejected: exactV4RawAliasRejected,
    pressureInterfaceGasCellFieldAdmission: normalizedAdmission,
    pressureInterfaceGasCellFieldAdmissionApproved: admissionApproved,
    sourceHotBufferKey: exactPressureAuthorityIdentity
      ? exactString(
          retainedGasCellImportOwnDataValue(source, 'sourceHotBufferKey'),
          retainedGasCellImportOwnDataValue(source, 'hotBufferKey')
        )
      : source?.sourceHotBufferKey
        || source?.hotBufferKey
        || admission?.sourceHotBufferKey
        || null,
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs,
    ...(exactPressureAuthorityIdentity ? {} : {
      gasPressureCellsBuffer,
      retainedGasPressureCellsBuffer: gasPressureCellsBuffer
    }),
    pressureInterfaceGasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowCapacity,
    pressureInterfaceGasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained: retainedRowsReady,
    retainedGasCellFieldSource,
    sameDevice: exactPressureAuthorityIdentity
      ? exactBoolean(
          retainedGasCellImportOwnDataValue(source, 'sameDevice'),
          retainedGasCellImportOwnDataValue(retainedGasCellFieldSource, 'sameDevice')
        )
      : source?.sameDevice ?? retainedGasCellFieldSource?.sameDevice ?? null,
    workerLocal: exactPressureAuthorityIdentity
      ? exactBoolean(
          retainedGasCellImportOwnDataValue(source, 'workerLocal'),
          retainedGasCellImportOwnDataValue(retainedGasCellFieldSource, 'workerLocal')
        )
      : source?.workerLocal ?? retainedGasCellFieldSource?.workerLocal ?? null,
    deviceId: exactPressureAuthorityIdentity
      ? exactString(
          retainedGasCellImportOwnDataValue(source, 'deviceId'),
          retainedGasCellImportOwnDataValue(retainedGasCellFieldSource, 'deviceId')
        )
      : source?.deviceId || retainedGasCellFieldSource?.deviceId || null,
    stateKey: exactPressureAuthorityIdentity
      ? exactString(
          retainedGasCellImportOwnDataValue(source, 'stateKey'),
          retainedGasCellImportOwnDataValue(retainedGasCellFieldSource, 'stateKey')
        )
      : source?.stateKey || retainedGasCellFieldSource?.stateKey || null,
    sourceTaskId: exactPressureAuthorityIdentity
      ? exactString(
          retainedGasCellImportOwnDataValue(source, 'sourceTaskId'),
          retainedGasCellImportOwnDataValue(retainedGasCellFieldSource, 'sourceTaskId')
        )
      : source?.sourceTaskId || retainedGasCellFieldSource?.sourceTaskId || null,
    ...(exactPressureAuthorityIdentity ? {} : {
      spatialGeneration:
        source?.spatialGeneration ?? retainedGasCellFieldSource?.spatialGeneration ?? null,
      spatialEpoch:
        source?.spatialEpoch ?? retainedGasCellFieldSource?.spatialEpoch ?? null
    }),
    spatialEpochPositionEpoch:
      exactPressureAuthorityIdentity
        ? exactEpochIdentity?.positionEpoch ?? null
        : source?.spatialEpochPositionEpoch
          ?? retainedGasCellFieldSource?.spatialEpochPositionEpoch
          ?? null,
    spatialEpochTopologyEpoch:
      exactPressureAuthorityIdentity
        ? exactEpochIdentity?.topologyEpoch ?? null
        : source?.spatialEpochTopologyEpoch
          ?? retainedGasCellFieldSource?.spatialEpochTopologyEpoch
          ?? null,
    spatialEpochChartEpoch:
      exactPressureAuthorityIdentity
        ? exactEpochIdentity?.chartEpoch ?? null
        : source?.spatialEpochChartEpoch
          ?? retainedGasCellFieldSource?.spatialEpochChartEpoch
          ?? null,
    spatialEpochLevelEpoch:
      exactPressureAuthorityIdentity
        ? exactEpochIdentity?.levelEpoch ?? null
        : source?.spatialEpochLevelEpoch
          ?? retainedGasCellFieldSource?.spatialEpochLevelEpoch
          ?? null,
    spatialEpochSupportEpoch:
      exactPressureAuthorityIdentity
        ? exactEpochIdentity?.supportEpoch ?? null
        : source?.spatialEpochSupportEpoch
          ?? retainedGasCellFieldSource?.spatialEpochSupportEpoch
          ?? null,
    lifecycleStatus:
      exactPressureAuthorityIdentity
        ? exactV4Description?.releaseStatusObserved || null
        : source?.lifecycleStatus || retainedGasCellFieldSource?.lifecycleStatus || null,
    consumed: exactPressureAuthorityIdentity
      ? exactV4Description?.consumerSubmittedObserved === true
      : source?.consumed === true || retainedGasCellFieldSource?.consumed === true,
    finalConsumerConsumed:
      exactPressureAuthorityIdentity
        ? exactV4Description?.consumerSubmittedObserved === true
        : source?.finalConsumerConsumed === true
          || retainedGasCellFieldSource?.finalConsumerConsumed === true,
    consumerConsumed:
      exactPressureAuthorityIdentity
        ? exactV4Description?.consumerSubmittedObserved === true
        : source?.consumerConsumed === true
          || retainedGasCellFieldSource?.consumerConsumed === true,
    releaseScheduled:
      exactPressureAuthorityIdentity
        ? exactV4Description?.releaseScheduledObserved === true
        : source?.releaseScheduled === true
          || retainedGasCellFieldSource?.releaseScheduled === true,
    released: exactPressureAuthorityIdentity
      ? exactV4Description?.releasedObserved === true
      : source?.released === true || retainedGasCellFieldSource?.released === true,
    terminal: exactPressureAuthorityIdentity
      ? exactV4Description?.terminalObserved === true
      : source?.terminal === true || retainedGasCellFieldSource?.terminal === true,
    ...(exactPressureAuthorityIdentity ? {} : {
      spatialGasLedgerEosExecution: source?.spatialGasLedgerEosExecution
        || retainedGasCellFieldSource?.spatialGasLedgerEosExecution
        || null,
      releaseAfterFinalConsumerQueue: source?.releaseAfterFinalConsumerQueue
        || retainedGasCellFieldSource?.releaseAfterFinalConsumerQueue
        || null
    }),
    pressureFieldMode: exactPressureAuthorityIdentity
      ? exactString(
          retainedGasCellImportOwnDataValue(
            retainedGasCellFieldSource,
            'pressureFieldMode'
          )
        )
      : gasCellField?.pressureFieldMode
        || source?.pressureFieldMode
        || retainedGasCellFieldSource?.pressureFieldMode
        || null,
    pressureFieldResolution: exactPressureAuthorityIdentity
      ? exactString(
          retainedGasCellImportOwnDataValue(
            retainedGasCellFieldSource,
            'pressureFieldResolution'
          )
        )
      : gasCellField?.pressureFieldResolution
        || source?.pressureFieldResolution
        || retainedGasCellFieldSource?.pressureFieldResolution
        || null,
    localPressureGradientStatus: exactPressureAuthorityIdentity
      ? exactString(
          retainedGasCellImportOwnDataValue(
            retainedGasCellFieldSource,
            'localPressureGradientStatus'
          )
        )
      : gasCellField?.localPressureGradientStatus
        || source?.localPressureGradientStatus
        || null
  };
}

function gasCellEosProducerGasCellField(result = null) {
  return result?.gasCellFieldSnapshot
    || result?.gasCellField
    || result?.pressureFeedback?.gasCellField
    || null;
}

export function retainedGasCellEosProducerSourceReady(result = null) {
  const importGraph = retainedGasCellImportGraph(result);
  const source = retainedGasCellSourceFromImportGraph(importGraph);
  const sourceSchema = retainedGasCellImportRecordValue(
    importGraph,
    source,
    'schema'
  );
  const sourceStatus = retainedGasCellImportRecordValue(
    importGraph,
    source,
    'status'
  );
  const sourceReady = retainedGasCellImportRecordValue(
    importGraph,
    result,
    'retainedGasCellFieldSourceReady'
  ) === true;
  const exactAuthorityIdentity = Boolean(
    source && isExactSphSpatialGasPressureAuthoritySource(source)
  );
  const schemaObservation = retainedGasCellImportSchemaObservation(importGraph);
  const aliasObservation = retainedGasCellImportAliasObservation(importGraph);
  if (exactAuthorityIdentity) {
    if (
      sourceSchema !== ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
      || schemaObservation.exactSchemaMutated
      || schemaObservation.forgedV4Authority
      || schemaObservation.retiredAuthoritySchema
    ) {
      return false;
    }
    const description = describeSphSpatialGasPressureAuthority(source);
    const rowCapacity = Math.max(0, Math.floor(finiteNumber(
      retainedGasCellImportOwnDataValue(
        source,
        'pressureInterfaceGasPressureCellRowCapacity'
      ) ?? retainedGasCellImportOwnDataValue(
        source,
        'gasPressureCellRowCapacity'
      ),
      0
    )));
    const strideFloats = Math.max(0, Math.floor(finiteNumber(
      retainedGasCellImportOwnDataValue(
        source,
        'pressureInterfaceGasPressureCellRowStrideFloats'
      ),
      0
    )));
    return Boolean(
      sourceReady
      && sourceStatus === 'retained-gas-cell-eos-source-submitted'
      && !aliasObservation.aliasPresent
      && description?.readyObserved === true
      && description.consumerSubmittedObserved !== true
      && description.consumerBorrowedObserved !== true
      && description.releaseScheduledObserved !== true
      && description.releasedObserved !== true
      && description.terminalObserved !== true
      && rowCapacity > 0
      && strideFloats === SPH_GAS_PRESSURE_CELL_FLOATS
    );
  }
  if (
    schemaObservation.forgedV4Authority
    || schemaObservation.retiredAuthoritySchema
    || aliasObservation.accessorRejected
  ) return false;
  const buffer = aliasObservation.pressureAlias;
  const rowCount = Math.max(0, Math.floor(finiteNumber(
    result?.pressureInterfaceGasPressureCellRowCount
      ?? result?.gasPressureCellRowCount
      ?? source?.pressureInterfaceGasPressureCellRowCount,
    0
  )));
  const strideFloats = Math.max(0, Math.floor(finiteNumber(
    result?.pressureInterfaceGasPressureCellRowStrideFloats
      ?? result?.gasPressureCellRowStrideFloats
      ?? source?.pressureInterfaceGasPressureCellRowStrideFloats,
    0
  )));
  return Boolean(
    sourceReady
    && source?.ready === true
    && source?.localPressureGradientReady === true
    && buffer
    && rowCount > 0
    && strideFloats === SPH_GAS_PRESSURE_CELL_FLOATS
    && (
      sourceSchema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V1
      || sourceSchema === ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA
    )
  );
}

export function gasCellEosProducerResultReady(result = null) {
  const gasCellField = gasCellEosProducerGasCellField(result);
  return Boolean(
    retainedGasCellEosProducerSourceReady(result)
      || (
        result
        && gasCellField?.localPressureGradientReady === true
        && Array.isArray(gasCellField?.cells)
        && gasCellField.cells.length > 0
      )
  );
}

export function spatialGasLedgerProducerResultReady(result = null) {
  const exactProducedAuthority = Boolean(
    result?.retainedGasCellFieldSourceReady === true
    && isExactSphSpatialGasPressureAuthoritySource(
      result?.retainedGasCellFieldSource
    )
    && result?.exactGasPressureAuthorityDescription?.readyObserved === true
    && Math.max(0, finiteNumber(
      result.exactGasPressureAuthorityDescription.pressureCellCapacity,
      0
    )) > 0
  );
  return Boolean(
    exactProducedAuthority
    || retainedGasCellEosProducerSourceReady(result)
    ||
    (
      result?.retainedSpatialGasLedgerSourceReady === true
      && result?.retainedSpatialGasLedgerSource?.ready === true
      && result?.retainedSpatialGasLedgerSource?.schema
        === ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA_EXACT
      && result?.spatialGasLedgerRowsBuffer
      && Math.max(0, finiteNumber(result?.compactSpatialGasRowCount, 0)) > 0
    )
    || (
      result?.spatialGasSpeciesLedger?.status === 'spatial-gas-species-ledger-ready'
      && Array.isArray(result.spatialGasSpeciesLedger.cells)
      && result.spatialGasSpeciesLedger.cells.length > 0
    )
  );
}

export function spatialGasLedgerFromProducerOrOptions(stageResults = {}, stepOptions = {}) {
  const producerResult = stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID] || null;
  const produced = producerResult?.spatialGasSpeciesLedger || null;
  if (produced?.status === 'spatial-gas-species-ledger-ready') return produced;
  if (
    producerResult?.retainedSpatialGasLedgerSourceReady === true
    && producerResult?.retainedSpatialGasLedgerSource?.schema
      !== ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA_EXACT
  ) {
    return producerResult.retainedSpatialGasLedgerSource || null;
  }
  return stepOptions.spatialGasSpeciesLedger
    || stepOptions.gasPressureSummary?.spatialGasSpeciesLedger
    || stepOptions.pressureSummary?.spatialGasSpeciesLedger
    || null;
}

export function pressureSummaryWithSpatialGasLedgerProducerResult(pressureSummary = null, result = null) {
  const ledger = result?.spatialGasSpeciesLedger || null;
  const retainedSource = result?.retainedSpatialGasLedgerSourceReady === true
    && result?.retainedSpatialGasLedgerSource?.schema
      !== ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA_EXACT
    ? result.retainedSpatialGasLedgerSource || null
    : null;
  if (ledger?.status !== 'spatial-gas-species-ledger-ready' && !retainedSource) {
    return pressureSummary;
  }
  const base = pressureSummary && typeof pressureSummary === 'object'
    ? pressureSummary
    : {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'spatial-gas-ledger-producer-pressure-summary-local',
        source: 'spatial-gas-ledger-producer-stage'
      };
  return {
    ...base,
    spatialGasSpeciesLedger: ledger || null,
    spatialGasSpeciesLedgerSchema: ledger?.schema || null,
    spatialGasSpeciesLedgerStatus: ledger?.status || null,
    retainedSpatialGasLedgerSource: retainedSource,
    retainedSpatialGasLedgerSourceSchema: retainedSource?.schema || null,
    retainedSpatialGasLedgerSourceStatus: retainedSource?.status || null,
    retainedSpatialGasLedgerSourceReady: Boolean(retainedSource),
    residentSpatialGasSpeciesLedgerStatus: retainedSource
      ? 'resident-spatial-gas-ledger-retained-source-available'
      : 'resident-spatial-gas-species-ledger-available'
  };
}

export function pressureSummaryWithGasCellEosProducerResult(pressureSummary = null, result = null) {
  const gasCellField = gasCellEosProducerGasCellField(result);
  const retainedSource = retainedGasCellEosProducerSourceReady(result)
    ? result.retainedGasCellFieldSource
    : null;
  if (!gasCellField?.localPressureGradientReady && !retainedSource) return pressureSummary;
  const base = pressureSummary && typeof pressureSummary === 'object'
    ? pressureSummary
    : {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'gas-cell-eos-producer-pressure-summary-local',
        source: 'gas-cell-eos-producer-stage'
      };
  return {
    ...base,
    gasCellField: gasCellField || null,
    retainedGasCellFieldSource: retainedSource,
    retainedGasCellFieldSourceReady: Boolean(retainedSource),
    pressureFeedback: base.pressureFeedback && typeof base.pressureFeedback === 'object'
      ? {
          ...base.pressureFeedback,
          gasCellField: gasCellField || null,
          retainedGasCellFieldSource: retainedSource,
          retainedGasCellFieldSourceReady: Boolean(retainedSource)
        }
      : base.pressureFeedback
  };
}

export function pressureFeedbackWithGasCellEosProducerResult(pressureFeedback = null, result = null) {
  const gasCellField = gasCellEosProducerGasCellField(result);
  const retainedSource = retainedGasCellEosProducerSourceReady(result)
    ? result.retainedGasCellFieldSource
    : null;
  if (!gasCellField?.localPressureGradientReady && !retainedSource) return pressureFeedback;
  if (!pressureFeedback || typeof pressureFeedback !== 'object') return null;
  return {
    ...pressureFeedback,
    schema: pressureFeedback.schema || 'peercompute.ulg.sph-gas-pressure-feedback.v0',
    status: pressureFeedback.status || 'gas-cell-eos-producer-pressure-feedback-local',
    gasCellField: gasCellField || null,
    retainedGasCellFieldSource: retainedSource,
    retainedGasCellFieldSourceReady: Boolean(retainedSource)
  };
}

export function gasCellEosProducerRetainedGasPressureRefs(result = null) {
  return uniqueNonEmptyStrings([
    ...(result?.retainedGasPressureBufferRefs || []),
    ...(result?.retainedGasCellFieldSource?.retainedGasPressureBufferRefs || [])
  ]);
}

export function gasCellEosProducerWorkerRetainedGasPressureRefs(result = null) {
  return uniqueNonEmptyStrings([
    ...(result?.workerRetainedGasPressureBufferRefs || []),
    ...(result?.retainedGasCellFieldSource?.workerRetainedGasPressureBufferRefs || [])
  ]);
}

function gasCellEosFinalConsumerScheduledStatus({
  retainedGasPressureRowsConsumed = false,
  pressureStageStatus = 'completed'
} = {}) {
  if (retainedGasPressureRowsConsumed) {
    return 'gas-cell-eos-final-consumer-release-scheduled-after-pressure-submit';
  }
  if (pressureStageStatus === 'error') {
    return 'gas-cell-eos-final-consumer-release-scheduled-after-pressure-error';
  }
  if (pressureStageStatus === 'omitted') {
    return 'gas-cell-eos-final-consumer-release-scheduled-after-pressure-omitted';
  }
  if (pressureStageStatus === 'not-run') {
    return 'gas-cell-eos-final-consumer-release-scheduled-after-pressure-not-run';
  }
  if (pressureStageStatus === 'lane-aborted') {
    return 'gas-cell-eos-final-consumer-release-scheduled-after-lane-abort';
  }
  return 'gas-cell-eos-final-consumer-release-scheduled-after-pressure-nonconsuming-terminal';
}

const gasCellEosFinalConsumerReleaseOwners = new WeakSet();
// The retained execution is the exceptional cleanup owner for an exact v4
// pressure authority, but it must never enter a result/clone/host transport
// graph. Same-realm stage progression finds it only by the exact source object.
export const exactSpatialGasPressureExecutionBySource = new WeakMap();

export const GAS_CELL_EOS_FINAL_CONSUMER_SCHEDULED_STATUSES = new Set([
  'gas-cell-eos-final-consumer-retired-queue-ordered-after-pressure-submit',
  'gas-cell-eos-final-consumer-release-scheduled-after-pressure-submit',
  'gas-cell-eos-final-consumer-release-scheduled-after-pressure-nonconsuming-terminal',
  'gas-cell-eos-final-consumer-release-scheduled-after-pressure-error',
  'gas-cell-eos-final-consumer-release-scheduled-after-pressure-omitted',
  'gas-cell-eos-final-consumer-release-scheduled-after-pressure-not-run',
  'gas-cell-eos-final-consumer-release-scheduled-after-lane-abort'
]);

function promiseFromConfirmedThenable(value) {
  if (
    value == null
    || (typeof value !== 'object' && typeof value !== 'function')
  ) return null;
  let then;
  try {
    then = value.then;
  } catch {
    return null;
  }
  if (typeof then !== 'function') return null;
  return new Promise((resolve, reject) => {
    try {
      then.call(value, resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
}

export function gasCellEosFinalConsumerCleanupTelemetryUnknown(source) {
  const telemetry = createGpuReadbackTelemetryAccumulator({
    scope: 'sph-gas-cell-eos-final-consumer-cleanup'
  });
  telemetry.markUnknown(source);
  return telemetry.snapshot();
}

export function gasCellEosFinalConsumerCleanupTelemetryNotApplicable() {
  return createGpuReadbackTelemetry({
    scope: 'sph-gas-cell-eos-final-consumer-cleanup'
  });
}

function gasCellEosFinalConsumerCleanupTelemetrySnapshot(...roots) {
  const pending = roots.filter(Boolean);
  const visited = new Set();
  while (pending.length > 0) {
    const owner = pending.shift();
    if (
      (!owner || (typeof owner !== 'object' && typeof owner !== 'function'))
      || visited.has(owner)
    ) continue;
    visited.add(owner);
    if (
      typeof owner.deferredCleanupReadbackTelemetrySnapshot === 'function'
    ) {
      try {
        return owner.deferredCleanupReadbackTelemetrySnapshot.call(owner);
      } catch {
        return null;
      }
    }
    pending.push(
      owner.spatialGasLedgerEosExecution,
      owner.retainedGasCellFieldSource,
      owner.retainedSpatialGasLedgerSource,
      owner.sourceSpatialGasLedger
    );
  }
  return null;
}

function attachForwardedRetainedExecutionLifecycle(target, execution) {
  if (!target || !execution) return target;
  Object.defineProperties(target, {
    releaseAttempted: {
      enumerable: true,
      get() { return execution.releaseAttempted === true; }
    },
    releaseScheduled: {
      enumerable: true,
      get() { return execution.releaseScheduled === true; }
    },
    releasePromise: {
      enumerable: true,
      get() { return execution.releasePromise || null; }
    },
    released: {
      enumerable: true,
      get() { return execution.released === true; }
    },
    releaseQuarantined: {
      enumerable: true,
      get() { return execution.releaseQuarantined === true; }
    },
    releaseStatus: {
      enumerable: true,
      get() { return execution.releaseStatus || null; }
    },
    releaseError: {
      enumerable: true,
      get() { return execution.releaseError || null; }
    },
    terminal: {
      enumerable: true,
      get() { return execution.terminal === true; }
    },
    deferredCleanupReadbackTelemetrySnapshot: {
      enumerable: true,
      value: () => execution.deferredCleanupReadbackTelemetrySnapshot()
    }
  });
  return target;
}

/**
 * Retire the retained spatial-gas/EOS owner after the pressure stage reaches a
 * terminal point. Pressure does not need to consume the rows: a blocked, CPU,
 * omitted, or failed pressure stage is still the final possible consumer for
 * this lane and must release the three-slot arena owner.
 */
export function scheduleSphGasCellEosFinalConsumerRelease({
  pressureInterfaceGasCellFieldImport = null,
  gasCellEosProducerResult = null,
  spatialGasLedgerProducerResult = null,
  device = null,
  retainedGasPressureRowsConsumed = false,
  pressureStageStatus = 'completed'
} = {}) {
  const cpuSeededGasPressureAuthority =
    gasCellEosProducerResult?.cpuSeededGasPressureAuthority || null;
  const cpuSeededGasPressureDescription =
    cpuSeededGasPressureAuthority && device
      ? describeSphCpuSeededGasPressureAuthorityGpu(
          cpuSeededGasPressureAuthority,
          { device }
        )
      : null;
  const exactLiveCpuSeededGasPressureAuthority = Boolean(
    cpuSeededGasPressureAuthority
    && device
    && isExactSphCpuSeededGasPressureAuthorityGpu(
      cpuSeededGasPressureAuthority,
      device
    )
  );
  const exactRetiredCpuSeededGasPressureAuthority = Boolean(
    cpuSeededGasPressureDescription?.deviceAuthenticated === true
    && cpuSeededGasPressureDescription.retiredObserved === true
  );
  const exactGasPressureSource = [
    pressureInterfaceGasCellFieldImport?.retainedGasCellFieldSource,
    gasCellEosProducerResult?.retainedGasCellFieldSource,
    spatialGasLedgerProducerResult?.retainedGasCellFieldSource,
    gasCellEosProducerResult,
    spatialGasLedgerProducerResult
  ].find((source) => (
    source?.schema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
    && isExactSphSpatialGasPressureAuthoritySource(source)
  )) || null;
  const exactGasPressureDescription = exactGasPressureSource && device
    ? describeSphSpatialGasPressureAuthority(
        exactGasPressureSource,
        { device }
      )
    : null;
  const exactGasPressureExecution = exactGasPressureSource
    ? exactSpatialGasPressureExecutionBySource.get(exactGasPressureSource)
      || null
    : null;
  const gasExecution = gasCellEosProducerResult?.spatialGasLedgerEosExecution
    || gasCellEosProducerResult?.retainedGasCellFieldSource
      ?.spatialGasLedgerEosExecution
    || null;
  const spatialExecution = spatialGasLedgerProducerResult
    ?.spatialGasLedgerEosExecution || null;
  const producedGasBuffer = gasCellEosProducerResult?.gasPressureCellsBuffer
    || gasCellEosProducerResult?.retainedGasPressureCellsBuffer
    || spatialGasLedgerProducerResult?.gasPressureCellsBuffer
    || spatialGasLedgerProducerResult?.retainedGasPressureCellsBuffer
    || null;
  const importAliasesProducedOwner = Boolean(
    pressureInterfaceGasCellFieldImport
    && (
      (!gasCellEosProducerResult && !spatialGasLedgerProducerResult)
      || (
        pressureInterfaceGasCellFieldImport.retainedGasCellFieldSource
        && pressureInterfaceGasCellFieldImport.retainedGasCellFieldSource
          === gasCellEosProducerResult?.retainedGasCellFieldSource
      )
      || (
        pressureInterfaceGasCellFieldImport.retainedGasCellFieldSource
        && pressureInterfaceGasCellFieldImport.retainedGasCellFieldSource
          === spatialGasLedgerProducerResult?.retainedGasCellFieldSource
      )
      || (
        producedGasBuffer
        && (
          pressureInterfaceGasCellFieldImport.gasPressureCellsBuffer
            === producedGasBuffer
          || pressureInterfaceGasCellFieldImport.retainedGasPressureCellsBuffer
            === producedGasBuffer
          || pressureInterfaceGasCellFieldImport.pressureInterfaceGasPressureCellsBuffer
            === producedGasBuffer
        )
      )
      || pressureInterfaceGasCellFieldImport.releaseAfterFinalConsumerQueue
        === gasCellEosProducerResult?.releaseAfterFinalConsumerQueue
      || pressureInterfaceGasCellFieldImport.releaseAfterFinalConsumerQueue
        === spatialGasLedgerProducerResult?.releaseAfterFinalConsumerQueue
    )
  );
  const candidates = [
    {
      source: 'pressure-interface-import-publication',
      owner: importAliasesProducedOwner
        ? pressureInterfaceGasCellFieldImport
        : null
    },
    {
      source: 'gas-cell-eos-producer-result',
      owner: gasCellEosProducerResult
    },
    {
      source: 'gas-cell-eos-retained-source',
      owner: gasCellEosProducerResult?.retainedGasCellFieldSource
    },
    {
      source: 'gas-cell-eos-retained-execution',
      owner: gasExecution
    },
    {
      source: 'spatial-gas-ledger-producer-result',
      owner: spatialGasLedgerProducerResult
    },
    {
      source: 'spatial-gas-ledger-retained-gas-source',
      owner: spatialGasLedgerProducerResult?.retainedGasCellFieldSource
    },
    {
      source: 'spatial-gas-ledger-retained-source',
      owner: spatialGasLedgerProducerResult?.retainedSpatialGasLedgerSource
    },
    {
      source: 'spatial-gas-ledger-retained-execution',
      owner: spatialExecution
    }
  ];
  const candidate = candidates.find(
    ({ owner }) => typeof owner?.releaseAfterFinalConsumerQueue === 'function'
  ) || null;
  const lifecycleRoots = [
    candidate?.owner,
    candidate?.owner?.retainedGasCellFieldSource,
    candidate?.owner?.retainedSpatialGasLedgerSource,
    candidate?.owner?.spatialGasLedgerEosExecution,
    gasExecution,
    spatialExecution
  ].filter((root, index, roots) => (
    root
    && (typeof root === 'object' || typeof root === 'function')
    && roots.indexOf(root) === index
  ));
  const releasePromise = () => (
    lifecycleRoots.find((root) => root.releasePromise)?.releasePromise || null
  );
  const lifecycleFlag = (field) => lifecycleRoots.some(
    (root) => root?.[field] === true
  );
  const lifecycleValue = (field) => lifecycleRoots.find(
    (root) => root?.[field] != null
  )?.[field] ?? null;
  const releaseAlreadyScheduled = () => Boolean(
    lifecycleFlag('releaseScheduled')
    || lifecycleFlag('released')
    || releasePromise()
  );
  const releaseAttempted = () => lifecycleFlag('releaseAttempted');
  const releaseQuarantined = () => lifecycleFlag('releaseQuarantined');
  const releaseIdentity = cpuSeededGasPressureAuthority
    || exactGasPressureSource
    || gasExecution
    || spatialExecution
    || candidate?.owner?.spatialGasLedgerEosExecution
    || candidate?.owner?.releaseAfterFinalConsumerQueue
    || candidate?.owner
    || null;
  const scheduledStatus = gasCellEosFinalConsumerScheduledStatus({
    retainedGasPressureRowsConsumed,
    pressureStageStatus
  });
  if (exactRetiredCpuSeededGasPressureAuthority) {
    gasCellEosFinalConsumerReleaseOwners.add(
      cpuSeededGasPressureAuthority
    );
    return {
      scheduled: true,
      status:
        'gas-cell-eos-final-consumer-retired-queue-ordered-after-pressure-submit',
      source: 'exact-cpu-seeded-gas-pressure-authority',
      error: null,
      releasePromise: null,
      alreadyScheduled: true,
      cleanupMode: 'same-queue-pressure-final-consumer-retirement',
      deferredCleanupReadbackTelemetry:
        gasCellEosFinalConsumerCleanupTelemetryNotApplicable()
    };
  }
  if (
    exactGasPressureDescription?.deviceAuthenticated === true
    && exactGasPressureDescription.consumerSubmittedObserved === true
    && exactGasPressureDescription.releasedObserved === true
    && exactGasPressureDescription.terminalObserved === true
  ) {
    gasCellEosFinalConsumerReleaseOwners.add(exactGasPressureSource);
    return {
      scheduled: true,
      status:
        'gas-cell-eos-final-consumer-retired-queue-ordered-after-pressure-submit',
      source: 'exact-v4-gas-pressure-authority',
      error: null,
      releasePromise: null,
      alreadyScheduled: true,
      cleanupMode: 'same-queue-pressure-final-consumer-retirement',
      deferredCleanupReadbackTelemetry:
        gasCellEosFinalConsumerCleanupTelemetryNotApplicable()
    };
  }
  if (exactLiveCpuSeededGasPressureAuthority) {
    gasCellEosFinalConsumerReleaseOwners.add(
      cpuSeededGasPressureAuthority
    );
    let discarded = false;
    let discardError = null;
    try {
      discarded = discardSphCpuSeededGasPressureAuthorityGpu(
        cpuSeededGasPressureAuthority,
        device
      ) === true;
    } catch (error) {
      discardError = error instanceof Error ? error.message : String(error);
    }
    return {
      scheduled: discarded,
      status: discarded
        ? scheduledStatus
        : 'gas-cell-eos-final-consumer-release-schedule-error',
      source: 'exact-cpu-seeded-gas-pressure-authority-exceptional-discard',
      error: discardError,
      releasePromise: null,
      alreadyScheduled: false,
      cleanupMode: 'exact-unconsumed-authority-discard',
      deferredCleanupReadbackTelemetry: discarded
        ? gasCellEosFinalConsumerCleanupTelemetryNotApplicable()
        : gasCellEosFinalConsumerCleanupTelemetryUnknown(
            'cpu-seeded-gas-pressure-authority-exceptional-discard-failed'
          )
    };
  }
  if (
    exactGasPressureDescription?.deviceAuthenticated === true
    && exactGasPressureDescription.terminalObserved === true
    && exactGasPressureDescription.releasedObserved !== true
  ) {
    gasCellEosFinalConsumerReleaseOwners.add(exactGasPressureSource);
    return {
      scheduled: false,
      status: exactGasPressureDescription.releaseStatusObserved
        || 'gas-cell-eos-final-consumer-release-quarantined',
      source: 'exact-v4-gas-pressure-authority',
      error: 'exact v4 gas-pressure authority reached a terminal unreleased state',
      releasePromise: null,
      alreadyScheduled: false,
      cleanupMode: 'exact-authority-terminal-quarantine',
      deferredCleanupReadbackTelemetry:
        gasCellEosFinalConsumerCleanupTelemetryUnknown(
          'exact-v4-gas-pressure-authority-terminal-unreleased'
        )
    };
  }
  if (
    exactGasPressureDescription?.deviceAuthenticated === true
    && exactGasPressureExecution
  ) {
    gasCellEosFinalConsumerReleaseOwners.add(exactGasPressureSource);
    let accepted = false;
    let releaseError = null;
    try {
      accepted = releaseSphSpatialGasLedgerEosAfterQueue(
        exactGasPressureExecution
      ) === true;
    } catch (error) {
      releaseError = error instanceof Error ? error.message : String(error);
    }
    const releasePromise = exactGasPressureExecution.releasePromise || null;
    const scheduled = Boolean(
      accepted
      || exactGasPressureExecution.releaseScheduled === true
      || releasePromise
      || exactGasPressureExecution.released === true
    );
    return {
      scheduled,
      status: scheduled
        ? scheduledStatus
        : (exactGasPressureExecution.releaseStatus
          || 'gas-cell-eos-final-consumer-release-schedule-error'),
      source: 'exact-v4-private-spatial-gas-ledger-eos-execution',
      error: releaseError || exactGasPressureExecution.releaseError || null,
      releasePromise,
      alreadyScheduled: accepted !== true && scheduled,
      cleanupMode: 'exact-unconsumed-authority-host-fence-release',
      deferredCleanupReadbackTelemetry:
        exactGasPressureExecution.deferredCleanupReadbackTelemetrySnapshot?.()
        || gasCellEosFinalConsumerCleanupTelemetryUnknown(
          'exact-v4-private-execution-cleanup-snapshot-missing'
        )
    };
  }
  const retainedOwnerExpected = Boolean(
    cpuSeededGasPressureAuthority
    || exactGasPressureSource
    || gasExecution
    || spatialExecution
    || gasCellEosProducerResult?.retainedGasCellFieldSource
      ?.finalConsumerReleaseRequired === true
    || spatialGasLedgerProducerResult?.retainedGasCellFieldSource
      ?.finalConsumerReleaseRequired === true
    || spatialGasLedgerProducerResult?.retainedSpatialGasLedgerSource
      ?.finalConsumerReleaseRequired === true
  );
  if (!candidate) {
    const deferredCleanupReadbackTelemetry = retainedOwnerExpected
      ? gasCellEosFinalConsumerCleanupTelemetryUnknown(
          'gas-cell-eos-final-consumer-release-callback-missing'
        )
      : gasCellEosFinalConsumerCleanupTelemetryNotApplicable();
    return {
      scheduled: false,
      status: retainedOwnerExpected
        ? 'gas-cell-eos-final-consumer-release-callback-missing'
        : 'gas-cell-eos-final-consumer-release-not-applicable',
      source: null,
      error: null,
      releasePromise: null,
      alreadyScheduled: false,
      deferredCleanupReadbackTelemetry
    };
  }
  if (releaseQuarantined()) {
    gasCellEosFinalConsumerReleaseOwners.add(releaseIdentity);
    const deferredCleanupReadbackTelemetry =
      gasCellEosFinalConsumerCleanupTelemetrySnapshot(
        candidate.owner,
        gasExecution,
        spatialExecution
      ) || gasCellEosFinalConsumerCleanupTelemetryUnknown(
        'gas-cell-eos-final-consumer-cleanup-snapshot-missing'
      );
    return {
      scheduled: false,
      status: lifecycleValue('releaseStatus')
        || 'gas-cell-eos-final-consumer-release-quarantined',
      source: candidate.source,
      error: lifecycleValue('releaseError'),
      releasePromise: releasePromise(),
      alreadyScheduled: false,
      deferredCleanupReadbackTelemetry
    };
  }
  if (releaseAlreadyScheduled()) {
    gasCellEosFinalConsumerReleaseOwners.add(releaseIdentity);
    const deferredCleanupReadbackTelemetry =
      gasCellEosFinalConsumerCleanupTelemetrySnapshot(
        candidate.owner,
        gasExecution,
        spatialExecution
      ) || gasCellEosFinalConsumerCleanupTelemetryUnknown(
        'gas-cell-eos-final-consumer-cleanup-snapshot-missing'
      );
    return {
      scheduled: true,
      status: scheduledStatus,
      source: candidate.source,
      error: null,
      releasePromise: releasePromise(),
      alreadyScheduled: true,
      deferredCleanupReadbackTelemetry
    };
  }
  if (
    releaseAttempted()
    || gasCellEosFinalConsumerReleaseOwners.has(releaseIdentity)
  ) {
    const deferredCleanupReadbackTelemetry =
      gasCellEosFinalConsumerCleanupTelemetrySnapshot(
        candidate.owner,
        gasExecution,
        spatialExecution
      ) || gasCellEosFinalConsumerCleanupTelemetryUnknown(
        'gas-cell-eos-final-consumer-cleanup-snapshot-missing'
      );
    return {
      scheduled: false,
      status: 'gas-cell-eos-final-consumer-release-already-invoked',
      source: candidate.source,
      error: null,
      releasePromise: releasePromise(),
      alreadyScheduled: false,
      deferredCleanupReadbackTelemetry
    };
  }
  gasCellEosFinalConsumerReleaseOwners.add(releaseIdentity);
  try {
    const accepted = candidate.owner.releaseAfterFinalConsumerQueue.call(
      candidate.owner
    ) === true;
    const nowScheduled = accepted || releaseAlreadyScheduled();
    const deferredCleanupReadbackTelemetry =
      gasCellEosFinalConsumerCleanupTelemetrySnapshot(
        candidate.owner,
        gasExecution,
        spatialExecution
      ) || gasCellEosFinalConsumerCleanupTelemetryUnknown(
        'gas-cell-eos-final-consumer-cleanup-snapshot-missing'
      );
    return {
      scheduled: nowScheduled,
      status: nowScheduled
        ? scheduledStatus
        : releaseQuarantined()
          ? lifecycleValue('releaseStatus')
            || 'gas-cell-eos-final-consumer-release-quarantined'
          : 'gas-cell-eos-final-consumer-release-schedule-rejected',
      source: candidate.source,
      error: lifecycleValue('releaseError'),
      releasePromise: releasePromise(),
      alreadyScheduled: !accepted && nowScheduled,
      deferredCleanupReadbackTelemetry
    };
  } catch (error) {
    const nowScheduled = releaseAlreadyScheduled();
    const deferredCleanupReadbackTelemetry =
      gasCellEosFinalConsumerCleanupTelemetrySnapshot(
        candidate.owner,
        gasExecution,
        spatialExecution
      ) || gasCellEosFinalConsumerCleanupTelemetryUnknown(
        'gas-cell-eos-final-consumer-cleanup-snapshot-missing'
      );
    return {
      scheduled: nowScheduled,
      status: nowScheduled
        ? scheduledStatus
        : 'gas-cell-eos-final-consumer-release-schedule-error',
      source: candidate.source,
      error: error instanceof Error ? error.message : String(error),
      releasePromise: releasePromise(),
      alreadyScheduled: nowScheduled,
      deferredCleanupReadbackTelemetry
    };
  }
}

export function publishGasCellEosProducerImportForPressureInterface({
  residentAuthorityHost = null,
  gasCellEosProducerResult = null,
  pressureInterfaceGasCellFieldAdmission = null,
  cacheKey = null,
  stateKey = null,
  sourceTaskId = null,
  sourceNodeId = 'ulg-resident-gas-cell-eos-law',
  sourceStage = GAS_CELL_EOS_PRODUCER_STAGE_ID
} = {}) {
  const gasCellField = gasCellEosProducerGasCellField(gasCellEosProducerResult);
  const retainedGasPressureBufferRefs = gasCellEosProducerRetainedGasPressureRefs(gasCellEosProducerResult);
  const workerRetainedGasPressureBufferRefs = gasCellEosProducerWorkerRetainedGasPressureRefs(gasCellEosProducerResult);
  const resultBase = {
    schema: 'peercompute.ulg.gas-cell-eos-producer-pressure-interface-import-publication.v0',
    sourceStage,
    sourceTaskId: sourceTaskId || gasCellEosProducerResult?.computeTaskId || null,
    pressureInterfaceGasCellFieldAdmission,
    pressureInterfaceGasCellFieldImport: null,
    admissionPublication: null,
    importPublication: null,
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs
  };
  if (!gasCellEosProducerResultReady(gasCellEosProducerResult)) {
    return {
      ...resultBase,
      status: 'blocked-gas-cell-eos-producer-result-required',
      blocker: 'ready-gas-cell-eos-producer-result-required'
    };
  }
  let admission = pressureInterfaceGasCellFieldAdmission;
  let admissionPublication = null;
  const admissionApproved = () => isPressureInterfaceGasCellFieldAdmissionApproved(admission);
  if (!admissionApproved() && typeof residentAuthorityHost?.publishPressureInterfaceGasCellFieldAdmission === 'function') {
    admissionPublication = residentAuthorityHost.publishPressureInterfaceGasCellFieldAdmission({
      cacheKey,
      stateKey,
      source: gasCellEosProducerResult,
      sourceTaskId: sourceTaskId || gasCellEosProducerResult?.computeTaskId || null,
      sourceNodeId,
      sourceStage,
      gasCellFieldSnapshot: gasCellField,
      retainedGasPressureBufferRefs,
      workerRetainedGasPressureBufferRefs
    });
    admission = admissionPublication?.pressureInterfaceGasCellFieldAdmission || admission;
  }
  if (!admissionApproved()) {
    return {
      ...resultBase,
      status: 'blocked-gas-cell-eos-producer-admission-required',
      blocker: 'pressure-interface-gas-cell-field-admission-required',
      pressureInterfaceGasCellFieldAdmission: admission,
      admissionPublication
    };
  }
  if (typeof residentAuthorityHost?.publishPressureInterfaceGasCellFieldImportSource !== 'function') {
    return {
      ...resultBase,
      status: 'blocked-gas-cell-eos-producer-import-publisher-required',
      blocker: 'resident-authority-host-import-publisher-required',
      pressureInterfaceGasCellFieldAdmission: admission,
      admissionPublication
    };
  }
  const importPublication = residentAuthorityHost.publishPressureInterfaceGasCellFieldImportSource({
    cacheKey,
    stateKey,
    source: gasCellEosProducerResult,
    sourceTaskId: sourceTaskId || gasCellEosProducerResult?.computeTaskId || null,
    sourceNodeId,
    sourceStage,
    gasCellFieldSnapshot: gasCellField,
    pressureInterfaceGasCellFieldAdmission: admission,
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs
  });
  return {
    ...resultBase,
    status: importPublication?.pressureInterfaceGasCellFieldImport?.status === 'pressure-interface-gas-cell-field-import-ready'
      ? 'gas-cell-eos-producer-import-published'
      : (importPublication?.status || 'gas-cell-eos-producer-import-publication-blocked'),
    blocker: null,
    pressureInterfaceGasCellFieldAdmission: admission,
    pressureInterfaceGasCellFieldImport: importPublication?.pressureInterfaceGasCellFieldImport || null,
    admissionPublication,
    importPublication
  };
}
