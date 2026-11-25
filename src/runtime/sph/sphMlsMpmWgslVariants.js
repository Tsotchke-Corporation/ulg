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
  mlsMpmG2pReconstructWgsl,
  mlsMpmGridUpdateWgsl,
  mlsMpmP2gGridProjectionWgsl,
  sphResidentProductHistoryFilteredAppendWgsl,
  sphReactionProductEventCompactWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  mlsMpmG2pReconstructCanonicalSpatialWgsl,
  mlsMpmG2pReconstructCanonicalSpatialUnobservedWgsl,
  mlsMpmP2gGridProjectionCanonicalSpatialWgsl,
  mlsMpmP2gGridProjectionCanonicalSpatialUnobservedWgsl,
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_BYTES,
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_LAYOUT,
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_MAGIC,
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_OFFSET_WORDS,
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES
} from '../../../ulg-gpu-abi/src/schroederMechanicsSpatialAuthorityWgsl.js';
import {
  GPU_PHASE_IDS,
  requestOpticalGpuDevice
} from '../material/opticalGpuBuffers.js';
import { acquireQueueOrderedPooledBuffer, computeBufferBinding, createCachedExplicitBindGroup, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup, deferConfirmedSubmittedWorkCleanup, registerQueueOrderedPooledBufferReturn, releaseOrDestroyQueueOrderedPooledBuffer, releaseQueueOrderedPooledBuffer } from '../webgpuComputeLayout.js';
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
  createMlsMpmGridSpec,
  MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
  MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED,
  exactGasPressureMechanicsP2gProductSourceIsolationCertified,
  MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
  MLS_MPM_GPU_GRID_NODE_FLOATS,
  resolveMlsMpmP2gBackendPolicy,
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  runMlsMpmP2gGridProjectionWithOptionalWebGpu
} from './sphGridGpuKernel.js';
import {
  MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO,
  MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
  MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT,
  MLS_MPM_PARTICLE_SEPARATION_VELOCITY_DAMPING_DEFAULT,
  ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA,
  acquireMlsMpmG2pExactMassCapture,
  destroyRetainedMlsMpmG2pOutputComponents,
  encodeMlsMpmParticleSeparationPasses,
  maxSeparationRestDistanceM,
  runMlsMpmG2pWithOptionalWebGpu
} from './sphG2pGpuKernel.js';
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

import {
  COMPACT_MECHANICS_PREFLIGHT_ENTRY_POINTS,
  COMPUTE_DISPATCH_INDIRECT_UINTS,
  DEFAULT_BOX_DIMS_M,
  FULL_READBACK_MODE,
  FUSED_SINGLE_LEVEL_MECHANICS_FIELD_G2P_RECEIPT_ENTRY_POINTS,
  GPU_BUFFER_USAGE,
  GPU_MAP_MODE,
  MECHANICS_FIELD_P2G_CONTRIBUTION_FLOATS,
  MECHANICS_FIELD_PREFLIGHT_ENTRY_POINTS,
  MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY,
  NO_FULL_READBACK_MODE,
  P2G_ACCUMULATOR_COMPONENTS,
  SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS,
  SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS,
  SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS,
  SCHROEDER_FAR_FORCE_DELTA_FUSION_WORKGROUP_SIZE,
  SCHROEDER_MECHANICAL_DEFERRED_DISPATCH_COUNT,
  SCHROEDER_MECHANICAL_DEFERRED_ENTRY_POINTS,
  SCHROEDER_MECHANICAL_DEFERRED_PARTICLE_PARALLEL_DISPATCH_COUNT,
  SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS,
  ULG_MLS_MPM_RESIDENT_DISPATCH_TOPOLOGY_SCHEMA,
  ULG_SCHROEDER_FAR_FORCE_DELTA_FUSION_EXECUTION_SCHEMA,
  ULG_SPH_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA,
  finiteNumber,
  uniqueNonEmptyStrings
} from './sphMlsMpmStepContracts.js';


export function finiteVector3(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  return [
    finiteNumber(source?.[0], fallback[0]),
    finiteNumber(source?.[1], fallback[1]),
    finiteNumber(source?.[2], fallback[2])
  ];
}

export function noFullReadbackG2pParticleScaleStability({
  particleCount = 0,
  source = 'webgpu-g2p-shader'
} = {}) {
  return {
    schema: ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA,
    status: 'gpu-g2p-cap-policy-applied-in-shader',
    source,
    particleCount: Math.max(0, Math.round(finiteNumber(particleCount, 0))),
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    mechanicsVolumeRatioJOffset: 18,
    minVolumeRatioJAllowed: 0.1,
    maxRadiusGrowthRatioAllowed: MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO,
    maxVolumeRatioJAllowed: MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
    policyAppliedInG2p: true,
    policyAppliedInShader: true,
    capCountKnown: false,
    capCount: null,
    invalidCountKnown: false,
    invalidCount: null,
    effectiveFiniteCount: 0,
    minEffectiveVolumeRatioJ: null,
    maxEffectiveVolumeRatioJ: null,
    maxRawVolumeRatioJ: null,
    cappedSamples: []
  };
}

export function createResidentDispatchTopology({
  particleCount = 0,
  gridSpec = null,
  activeGridDispatch = null,
  substepCount = 1,
  fusedResidentMechanics = false,
  fusedResidentSequence = false,
  canonicalSpatialAuthority = false,
  mechanicsFieldViewEnabled = false,
  p2gBackend = MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER
} = {}) {
  const boundedParticleCount = Math.max(0, Math.floor(finiteNumber(particleCount, 0)));
  const workgroupSize = 64;
  const gridNodeCount = Math.max(0, Math.floor(finiteNumber(gridSpec?.gridNodeCount, 0)));
  const useActiveGrid = activeGridDispatch?.useActiveGrid === true;
  const activeGridNodeCountKnown = !useActiveGrid
    || activeGridDispatch?.activeNodeCountKnown !== false;
  const activeGridNodeCount = !useActiveGrid
    ? gridNodeCount
    : (activeGridNodeCountKnown
        ? Math.max(0, Math.floor(finiteNumber(activeGridDispatch?.activeNodeCount, 0)))
        : null);
  const activeGridNodeCapacity = !useActiveGrid
    ? gridNodeCount
    : Math.max(0, Math.floor(finiteNumber(
        activeGridDispatch?.activeNodeCapacity,
        gridNodeCount
      )));
  const gridInvocationUpperBound = activeGridNodeCountKnown
    ? activeGridNodeCount
    : activeGridNodeCapacity;
  const compactMechanicsView = activeGridDispatch?.compactMechanicsView === true;
  const boundedSubstepCount = Math.max(1, Math.floor(finiteNumber(substepCount, 1)));
  const particleWorkgroups = Math.max(1, Math.ceil(boundedParticleCount / workgroupSize));
  const gridWorkgroups = Math.max(1, Math.ceil(gridInvocationUpperBound / workgroupSize));
  const activeGridAxis = useActiveGrid ? 'active-grid-node' : 'grid-node';
  const p2gBackendPolicy = resolveMlsMpmP2gBackendPolicy({
    requestedBackend: p2gBackend,
    supportsOceanTiledKernel: false
  });
  const p2g = {
    stageId: 'p2g',
    topology: mechanicsFieldViewEnabled
      ? 'particle-parallel-field-contribution-emission'
      : 'particle-parallel-scatter',
    backendPolicy: p2gBackendPolicy,
    backendPolicyStatus: p2gBackendPolicy.status,
    requestedBackend: p2gBackendPolicy.requestedBackend,
    effectiveBackend: p2gBackendPolicy.effectiveBackend,
    backendFallbackReason: p2gBackendPolicy.fallbackReason,
    entryPoint: 'main',
    dispatchAxis: 'particle',
    dispatchWorkgroupsPerSubstep: particleWorkgroups,
    invocationLimitPerSubstep: boundedParticleCount,
    workgroupSize,
    particleCount: boundedParticleCount,
    particleLoopInShader: false,
    perParticleLocalStencil: 'quadratic-3x3x3-grid-stencil',
    perParticleLocalStencilNodeCount: 27,
    gridWriteMode: mechanicsFieldViewEnabled
      ? 'stable-radix-ordered-field-reduction'
      : 'atomic-grid-accumulator-scatter',
    gridAccumulatorComponents: mechanicsFieldViewEnabled
      ? MECHANICS_FIELD_P2G_CONTRIBUTION_FLOATS
      : P2G_ACCUMULATOR_COMPONENTS,
    contributionRecordFloats: mechanicsFieldViewEnabled
      ? MECHANICS_FIELD_P2G_CONTRIBUTION_FLOATS
      : 0,
    stableCandidateOrder: mechanicsFieldViewEnabled
      ? 'retained-mechanics-field-stable-radix-order'
      : null
  };
  const p2gFinalize = {
    stageId: 'p2gFinalize',
    topology: mechanicsFieldViewEnabled
      ? 'mechanics-field-parallel-stable-reduction'
      : 'grid-node-parallel-finalize',
    entryPoint: 'finalize_grid',
    dispatchAxis: mechanicsFieldViewEnabled ? 'mechanics-field' : activeGridAxis,
    dispatchWorkgroupsPerSubstep: gridWorkgroups,
    dispatchWorkgroupsPerSubstepExact: activeGridNodeCountKnown,
    invocationLimitPerSubstep: activeGridNodeCountKnown ? activeGridNodeCount : null,
    invocationLimitPerSubstepUpperBound: gridInvocationUpperBound,
    workgroupSize,
    fullGridNodeCount: gridNodeCount,
    activeGridNodeCount,
    activeGridNodeCountKnown,
    activeGridNodeCapacity,
    activeGridEnabled: useActiveGrid,
    particleLoopInShader: false,
    stableContributionLoopInShader: mechanicsFieldViewEnabled
  };
  const p2gAccumulatorClear = {
    stageId: 'p2gAccumulatorClear',
    topology: useActiveGrid ? 'active-grid-node-parallel-accumulator-clear' : 'encoder-full-buffer-clear',
    entryPoint: useActiveGrid ? 'clear_accumulators' : 'GPUCommandEncoder.clearBuffer',
    dispatchAxis: useActiveGrid ? activeGridAxis : 'full-grid-buffer',
    dispatchWorkgroupsPerSubstep: useActiveGrid ? gridWorkgroups : 0,
    dispatchWorkgroupsPerSubstepExact: !useActiveGrid || activeGridNodeCountKnown,
    invocationLimitPerSubstep: useActiveGrid && !activeGridNodeCountKnown
      ? null
      : (useActiveGrid ? activeGridNodeCount : gridNodeCount),
    invocationLimitPerSubstepUpperBound: useActiveGrid
      ? gridInvocationUpperBound
      : gridNodeCount,
    workgroupSize,
    fullGridNodeCount: gridNodeCount,
    activeGridNodeCount,
    activeGridNodeCountKnown,
    activeGridNodeCapacity,
    activeGridEnabled: useActiveGrid,
    particleLoopInShader: false,
    bufferClearMode: useActiveGrid ? 'active-grid-compute-clear' : 'full-accumulator-clearBuffer'
  };
  const gridUpdate = {
    stageId: 'gridUpdate',
    topology: 'grid-node-parallel-update',
    entryPoint: 'main',
    dispatchAxis: activeGridAxis,
    dispatchWorkgroupsPerSubstep: gridWorkgroups,
    dispatchWorkgroupsPerSubstepExact: activeGridNodeCountKnown,
    invocationLimitPerSubstep: activeGridNodeCountKnown ? activeGridNodeCount : null,
    invocationLimitPerSubstepUpperBound: gridInvocationUpperBound,
    workgroupSize,
    fullGridNodeCount: gridNodeCount,
    activeGridNodeCount,
    activeGridNodeCountKnown,
    activeGridNodeCapacity,
    activeGridEnabled: useActiveGrid,
    particleLoopInShader: false
  };
  const g2p = {
    stageId: 'g2p',
    topology: 'particle-parallel-gather',
    entryPoint: 'main',
    dispatchAxis: 'particle',
    dispatchWorkgroupsPerSubstep: particleWorkgroups,
    invocationLimitPerSubstep: boundedParticleCount,
    workgroupSize,
    particleCount: boundedParticleCount,
    particleLoopInShader: false,
    perParticleLocalStencil: 'quadratic-3x3x3-grid-stencil',
    perParticleLocalStencilNodeCount: 27,
    gridReadMode: 'grid-node-gather'
  };
  const g2pAuthorityFinalize = {
    stageId: 'g2pAuthorityFinalize',
    topology: 'particle-parallel-global-authority-finalize',
    entryPoint: 'finalize_canonical_spatial_authority',
    dispatchAxis: 'particle',
    dispatchWorkgroupsPerSubstep: canonicalSpatialAuthority ? particleWorkgroups : 0,
    invocationLimitPerSubstep: canonicalSpatialAuthority ? boundedParticleCount : 0,
    workgroupSize,
    particleCount: boundedParticleCount,
    particleLoopInShader: false,
    enabled: canonicalSpatialAuthority === true,
    rejectionPolicy: 'global-copy-through-to-immutable-input-family'
  };
  const spatialMechanicalProposalApply = {
    stageId: 'spatialMechanicalProposalApply',
    topology:
      'retained-csr-contact-graph-mixed-particle-fixed-and-indirect-bundle',
    entryPoint: 'retained_contact_graph_bundle',
    entryPoints: SCHROEDER_MECHANICAL_DEFERRED_ENTRY_POINTS,
    dispatchAxis: 'mixed-particle-fixed-and-gpu-indirect-pair',
    fixedDispatchCountPerSubstep: canonicalSpatialAuthority
      ? SCHROEDER_MECHANICAL_DEFERRED_DISPATCH_COUNT
      : 0,
    exclusiveScanDispatchCountPerSubstep: canonicalSpatialAuthority
      ? null
      : 0,
    dispatchCountPerSubstep: canonicalSpatialAuthority ? null : 0,
    dispatchCountPerSubstepExact: canonicalSpatialAuthority !== true,
    encodedComputePassCountPerSubstep: canonicalSpatialAuthority ? null : 0,
    dispatchWorkgroupsPerSubstep: canonicalSpatialAuthority ? null : 0,
    dispatchWorkgroupsPerSubstepExact: canonicalSpatialAuthority !== true,
    particleParallelDispatchCountPerSubstep: canonicalSpatialAuthority
      ? SCHROEDER_MECHANICAL_DEFERRED_PARTICLE_PARALLEL_DISPATCH_COUNT
      : 0,
    particleParallelDispatchCountPerSubstepExact: true,
    particleParallelDispatchCountSemantics:
      'encoded-particle-or-source-axis-commands-including-zero-indirect-dispatches',
    particleParallelWorkgroupsPerSubstep: canonicalSpatialAuthority
      ? null
      : 0,
    particleParallelWorkgroupsPerSubstepExact:
      canonicalSpatialAuthority !== true,
    particleParallelWorkgroupsPerSubstepUpperBound: canonicalSpatialAuthority
      ? particleWorkgroups
        * SCHROEDER_MECHANICAL_DEFERRED_PARTICLE_PARALLEL_DISPATCH_COUNT
      : 0,
    invocationLimitPerDispatch: null,
    invocationLimitPerSubstep: null,
    workgroupSize,
    particleCount: boundedParticleCount,
    particleLoopInShader: false,
    enabled: canonicalSpatialAuthority === true,
    proposalStatus: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS,
    proposalMode: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE,
    proposalSource: SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY,
    exactNearTraversalCount: SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
    solverIterationCount: SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
    graphInitializationDispatchCount: 1,
    supportReductionDispatchCount: 1,
    exactNearTraversalDispatchCount: 1,
    exclusiveScanDispatchCount: null,
    graphFinalizeDispatchCount: 1,
    csrScatterIndirectDispatchCount: 1,
    csrIndexDispatchCount: 1,
    graphValidationDispatchCount: 1,
    zeroEdgeCompletionIndirectDispatchCount: 1,
    scaleMeasurementDispatchCount:
      SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
    solverApplyDispatchCount: SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
    energyAllocationDispatchCount:
      SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
    matchingCleanupPassCount:
      SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES,
    matchingCleanupLogicalPassCount:
      SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES,
    matchingCleanupEncodedPassCount:
      SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_ENCODED_PASSES,
    matchingCleanupDispatchCount:
      SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_OWNER_DISPATCHES,
    matchingTrustRestoreDispatchCount: 1,
    energyVerificationDispatchCount: 1,
    residualVerificationDispatchCount: 1,
    proposalPublicationDispatchCount: 1,
    proposalSealDispatchCount: 1,
    stateCommitDispatchCount: 1,
    dispatchCountEvidence: canonicalSpatialAuthority
      ? 'awaiting-post-encode-proposal-artifact'
      : 'disabled',
    workgroupCountEvidence: canonicalSpatialAuthority
      ? 'gpu-indirect-pair-count-not-host-materialized'
      : 'disabled',
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0
  };
  const compactMechanicsViewPreflight = {
    stageId: 'compactMechanicsViewPreflight',
    topology: 'ordered-authenticated-compact-view-preflight-stages',
    entryPoint: 'preflight_compact_mechanics_view',
    entryPoints: COMPACT_MECHANICS_PREFLIGHT_ENTRY_POINTS.map(
      ({ entryPoint }) => entryPoint
    ),
    dispatchAxis: 'authority-header-and-node-list',
    dispatchWorkgroupsPerSubstep: compactMechanicsView
      ? COMPACT_MECHANICS_PREFLIGHT_ENTRY_POINTS.length
      : 0,
    invocationLimitPerSubstep: compactMechanicsView
      ? COMPACT_MECHANICS_PREFLIGHT_ENTRY_POINTS.length
      : 0,
    workgroupSize: 1,
    enabled: compactMechanicsView,
    rejectionPolicy: 'zero-indirect-dispatch-and-global-canonical-copy-through',
    nodeLoopInShader: false
  };
  const compactMechanicsNodeValidation = {
    stageId: 'compactMechanicsNodeValidation',
    topology: 'compact-node-parallel-strict-order-validation',
    entryPoint: 'validate_compact_mechanics_nodes',
    dispatchAxis: 'compact-grid-node',
    dispatchWorkgroupsPerSubstep: compactMechanicsView ? gridWorkgroups : 0,
    dispatchWorkgroupsPerSubstepExact: !compactMechanicsView
      || activeGridNodeCountKnown,
    invocationLimitPerSubstep: compactMechanicsView && activeGridNodeCountKnown
      ? activeGridNodeCount
      : null,
    invocationLimitPerSubstepUpperBound: compactMechanicsView
      ? gridInvocationUpperBound
      : 0,
    workgroupSize,
    enabled: compactMechanicsView,
    nodeLoopInShader: false,
    rejectionPolicy: 'atomic-reject-and-zero-later-indirect-dispatch'
  };
  const mechanicsFieldDispatchesPerSubstep = mechanicsFieldViewEnabled
    ? MECHANICS_FIELD_PREFLIGHT_ENTRY_POINTS.length
      + 1 // field-key validation in the compact validation pass
      + 1 // P2G momentum seal
      + 3 // begin, build, and summarize contact heat; P2G finalize clears rows
      + 1 // grid-velocity mutation claim
      + 1 // unlike-field contact
      + 1 // velocity/heat seal
      + FUSED_SINGLE_LEVEL_MECHANICS_FIELD_G2P_RECEIPT_ENTRY_POINTS.length
    : 0;
  const dispatchesPerSubstepExcludingSpatialMechanicalProposal =
    (useActiveGrid ? 5 : 4)
    + (compactMechanicsView
        ? COMPACT_MECHANICS_PREFLIGHT_ENTRY_POINTS.length + 1
        : 0)
    + (canonicalSpatialAuthority ? 1 : 0)
    + mechanicsFieldDispatchesPerSubstep;
  const dispatchesPerSubstep = canonicalSpatialAuthority
    ? null
    : dispatchesPerSubstepExcludingSpatialMechanicalProposal;
  const workgroupsPerSubstepExcludingSpatialMechanicalProposal =
    particleWorkgroups
    + (useActiveGrid ? gridWorkgroups : 0)
    + gridWorkgroups
    + gridWorkgroups
    + particleWorkgroups
    + (compactMechanicsView
        ? COMPACT_MECHANICS_PREFLIGHT_ENTRY_POINTS.length + gridWorkgroups
        : 0)
    + (canonicalSpatialAuthority ? particleWorkgroups : 0);
  const workgroupsPerSubstep = canonicalSpatialAuthority
    ? null
    : workgroupsPerSubstepExcludingSpatialMechanicalProposal;
  return {
    schema: ULG_MLS_MPM_RESIDENT_DISPATCH_TOPOLOGY_SCHEMA,
    status: 'resident-dispatch-topology-ready',
    backend: 'webgpu',
    fusedResidentMechanics: fusedResidentMechanics === true,
    fusedResidentSequence: fusedResidentSequence === true,
    substepCount: boundedSubstepCount,
    workgroupSize,
    particleCount: boundedParticleCount,
    fullGridNodeCount: gridNodeCount,
    activeGridNodeCount,
    activeGridNodeCountKnown,
    activeGridNodeCapacity,
    activeGridEnabled: useActiveGrid,
    compactMechanicsView,
    canonicalSpatialAuthority: canonicalSpatialAuthority === true,
    activeGridDispatchStatus: activeGridDispatch?.status || null,
    p2gBackendPolicy,
    p2gBackendPolicyStatus: p2gBackendPolicy.status,
    p2gBackendRequested: p2gBackendPolicy.requestedBackend,
    p2gBackendEffective: p2gBackendPolicy.effectiveBackend,
    p2gBackendFallbackReason: p2gBackendPolicy.fallbackReason,
    particleParallelStages: canonicalSpatialAuthority
      ? ['p2g', 'g2p', 'spatialMechanicalProposalApply', 'g2pAuthorityFinalize']
      : ['p2g', 'g2p'],
    gridParallelStages: useActiveGrid
      ? [
          ...(compactMechanicsView ? ['compactMechanicsViewPreflight'] : []),
          ...(compactMechanicsView ? ['compactMechanicsNodeValidation'] : []),
          'p2gAccumulatorClear',
          'p2gFinalize',
          'gridUpdate'
        ]
      : ['p2gFinalize', 'gridUpdate'],
    cpuParticleLoopInHotPath: false,
    mechanicsField: {
      enabled: mechanicsFieldViewEnabled,
      dispatchesPerSubstep: mechanicsFieldDispatchesPerSubstep,
      receiptMode: mechanicsFieldViewEnabled
        ? 'single-level-local-field-no-cross-level-reflux'
        : 'disabled',
      receiptEntryPoints: mechanicsFieldViewEnabled
        ? FUSED_SINGLE_LEVEL_MECHANICS_FIELD_G2P_RECEIPT_ENTRY_POINTS.map(
            ({ entryPoint }) => entryPoint
          )
        : []
    },
    p2g,
    compactMechanicsViewPreflight,
    compactMechanicsNodeValidation,
    p2gAccumulatorClear,
    p2gFinalize,
    gridUpdate,
    g2p,
    spatialMechanicalProposalApply,
    g2pAuthorityFinalize,
    dispatchesPerSubstepExcludingSpatialMechanicalProposal,
    dispatchesPerSubstep,
    totalDispatches: dispatchesPerSubstep == null
      ? null
      : boundedSubstepCount * dispatchesPerSubstep,
    workgroupsPerSubstepExcludingSpatialMechanicalProposal,
    workgroupsPerSubstep,
    workgroupsPerSubstepExact: canonicalSpatialAuthority !== true
      && (!useActiveGrid || activeGridNodeCountKnown),
    workgroupsPerSubstepUpperBound: canonicalSpatialAuthority
      ? null
      : workgroupsPerSubstep,
    totalWorkgroups: workgroupsPerSubstep == null
      ? null
      : boundedSubstepCount * workgroupsPerSubstep,
    totalWorkgroupsExact: canonicalSpatialAuthority !== true
      && (!useActiveGrid || activeGridNodeCountKnown),
    totalWorkgroupsUpperBound: workgroupsPerSubstep == null
      ? null
      : boundedSubstepCount * workgroupsPerSubstep
  };
}

export function recordSpatialMechanicalProposalEncoding(topology, proposal) {
  const stage = topology?.spatialMechanicalProposalApply;
  if (!stage?.enabled) return topology;
  const encodedDispatchCount = Number(proposal?.encodedDispatchCount);
  const encodedComputePassCount = Number(proposal?.encodedComputePassCount);
  // The deferred bundle's fixed dispatch count follows the proposal's
  // declared, sealed solver budget; the batch-preset constant remains the
  // fallback for proposals predating the sealed-budget contract.
  const deferredDispatchFloor = Number.isInteger(
    proposal?.encodedDeferredDispatchFloor
  )
    ? proposal.encodedDeferredDispatchFloor
    : SCHROEDER_MECHANICAL_DEFERRED_DISPATCH_COUNT;
  if (
    !Number.isInteger(encodedDispatchCount)
    || encodedDispatchCount < deferredDispatchFloor
    || !Number.isInteger(encodedComputePassCount)
    || encodedComputePassCount < 1
  ) {
    throw new Error(
      'Canonical spatial mechanical proposal did not publish truthful post-encode dispatch metadata'
    );
  }
  const exclusiveScanDispatchCount = encodedDispatchCount
    - deferredDispatchFloor;
  stage.exclusiveScanDispatchCount = exclusiveScanDispatchCount;
  stage.exclusiveScanDispatchCountPerSubstep = exclusiveScanDispatchCount;
  stage.dispatchCountPerSubstep = encodedDispatchCount;
  stage.dispatchCountPerSubstepExact = true;
  stage.encodedComputePassCountPerSubstep = encodedComputePassCount;
  stage.dispatchCountEvidence = 'post-encode-proposal-artifact';
  // Reconcile the declared-plan stage summary with the proposal's sealed
  // per-invocation solver budget.
  if (Number.isInteger(proposal?.solverIterationCount)) {
    stage.solverIterationCount = proposal.solverIterationCount;
    stage.scaleMeasurementDispatchCount = proposal.solverIterationCount;
    stage.solverApplyDispatchCount = proposal.solverIterationCount;
    stage.energyAllocationDispatchCount = proposal.solverIterationCount;
    stage.particleParallelDispatchCountPerSubstep =
      12 + 3 * proposal.solverIterationCount;
  }
  if (Number.isInteger(proposal?.matchingCleanupLogicalPassCount)) {
    stage.matchingCleanupPassCount = proposal.matchingCleanupEncodedPassCount;
    stage.matchingCleanupLogicalPassCount =
      proposal.matchingCleanupLogicalPassCount;
    stage.matchingCleanupEncodedPassCount =
      proposal.matchingCleanupEncodedPassCount;
    stage.matchingCleanupDispatchCount =
      proposal.matchingCleanupOwnerDispatchCount;
  }
  if (proposal?.solverBudgetDeclared) {
    stage.solverBudgetDeclared = proposal.solverBudgetDeclared;
  }

  topology.dispatchesPerSubstep =
    topology.dispatchesPerSubstepExcludingSpatialMechanicalProposal
      + encodedDispatchCount;
  topology.totalDispatches = topology.substepCount
    * topology.dispatchesPerSubstep;
  // The pair scatter count remains GPU-indirect and the hierarchical scan has
  // level-dependent workgroups. Reporting a fabricated particle-wide total is
  // worse than leaving the workgroup total explicitly unknown.
  topology.workgroupsPerSubstep = null;
  topology.workgroupsPerSubstepExact = false;
  topology.workgroupsPerSubstepUpperBound = null;
  topology.totalWorkgroups = null;
  topology.totalWorkgroupsExact = false;
  topology.totalWorkgroupsUpperBound = null;
  return topology;
}

export function recordCanonicalAuthorityRestoreFold(topology) {
  const finalize = topology?.g2pAuthorityFinalize;
  if (!finalize?.enabled) return topology;
  const removedWorkgroups = Math.max(0, finalize.dispatchWorkgroupsPerSubstep || 0);
  finalize.enabled = false;
  finalize.dispatchWorkgroupsPerSubstep = 0;
  finalize.invocationLimitPerSubstep = 0;
  finalize.foldedIntoStage = 'particleSeparationBinFill';
  finalize.rejectionPolicy = 'global-copy-through-in-ordered-separation-bin-fill';
  topology.particleParallelStages = topology.particleParallelStages.filter(
    (stageId) => stageId !== 'g2pAuthorityFinalize'
  );
  topology.canonicalAuthorityRestoreStage = 'particleSeparationBinFill';
  if (Number.isFinite(topology.dispatchesPerSubstep)) {
    topology.dispatchesPerSubstep = Math.max(
      0,
      topology.dispatchesPerSubstep - 1
    );
    topology.totalDispatches = topology.substepCount
      * topology.dispatchesPerSubstep;
  }
  if (Number.isFinite(topology.workgroupsPerSubstep)) {
    topology.workgroupsPerSubstep = Math.max(
      0,
      topology.workgroupsPerSubstep - removedWorkgroups
    );
    topology.totalWorkgroups = topology.substepCount
      * topology.workgroupsPerSubstep;
  }
  return topology;
}

// Read-only "nothing here" bindings: a zero row that satisfies a shader binding
// when the corresponding feature is off. Every one of these was allocated and
// filled with zeros from the host on every substep -- measured at 32 apiece per
// batch -- for contents that never vary and that no shader writes. WebGPU
// zero-initialises a new buffer, so there is nothing to upload either.
//
// Safe to share where a real buffer would not be: nothing owns these, nothing
// mutates them, and their contents are identical by construction. They are
// deliberately excluded from every per-substep destroy list.
const SHARED_ZERO_PLACEHOLDER_BUFFERS = new WeakMap();

export function sharedZeroPlaceholderBuffer(device, label, byteLength, usage) {
  const size = Math.max(4, byteLength);
  let byKey = SHARED_ZERO_PLACEHOLDER_BUFFERS.get(device);
  if (!byKey) {
    byKey = new Map();
    SHARED_ZERO_PLACEHOLDER_BUFFERS.set(device, byKey);
  }
  const key = `${label}|${size}|${usage}`;
  let buffer = byKey.get(key);
  if (!buffer) {
    buffer = device.createBuffer({ label, size, usage });
    byKey.set(key, buffer);
  }
  return buffer;
}

export function writeGpuBuffer(device, label, data, usage = GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST) {
  const byteLength = Math.max(4, data?.byteLength ?? 0);
  const buffer = device.createBuffer({ label, size: byteLength, usage });
  if (data?.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

export function createSchroederFarForceDeltaFusionParamsArray({
  particleCount = 0,
  stateStrideFloats = SPH_GPU_PARTICLE_STATE_FLOATS,
  forceApplicationRowCount = 0,
  forceApplicationStrideFloats = SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(stateStrideFloats, SPH_GPU_PARTICLE_STATE_FLOATS))), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(forceApplicationRowCount, 0))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    forceApplicationStrideFloats,
    SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS
  ))), true);
  view.setUint32(16, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(20, 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  return buffer;
}

const schroederFarForceDeltaFusionWgsl = `
struct SchroederFarForceDeltaFusionParams {
  particle_count: u32,
  state_stride: u32,
  force_application_row_count: u32,
  force_application_stride: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> source_state_rows: array<f32>;
@group(0) @binding(1) var<storage, read> force_application_rows: array<f32>;
@group(0) @binding(2) var<storage, read_write> output_state_rows: array<f32>;
@group(0) @binding(3) var<uniform> params: SchroederFarForceDeltaFusionParams;

const DEFAULT_STATE_STRIDE: u32 = 8u;
const DEFAULT_FORCE_APPLICATION_STRIDE: u32 = 32u;

@compute @workgroup_size(64)
fn copy_state(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  let state_stride = max(params.state_stride, DEFAULT_STATE_STRIDE);
  let offset = particle_index * state_stride;
  for (var component = 0u; component < state_stride; component = component + 1u) {
    output_state_rows[offset + component] = source_state_rows[offset + component];
  }
}

@compute @workgroup_size(64)
fn apply_delta(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_index = global_id.x;
  if (row_index >= params.force_application_row_count) {
    return;
  }
  let state_stride = max(params.state_stride, DEFAULT_STATE_STRIDE);
  let force_stride = max(params.force_application_stride, DEFAULT_FORCE_APPLICATION_STRIDE);
  let force_offset = row_index * force_stride;
  let source_particle_f = force_application_rows[force_offset + 0u];
  let source_particle = u32(max(source_particle_f, 0.0));
  if (source_particle >= params.particle_count) {
    return;
  }
  let status = force_application_rows[force_offset + 29u];
  let admitted = force_application_rows[force_offset + 24u] > 0.0;
  let mutation_required = force_application_rows[force_offset + 25u] > 0.0;
  let full_particle_readback_required = force_application_rows[force_offset + 26u] > 0.0;
  if (!(admitted && mutation_required && !full_particle_readback_required && status > 0.0 && status < 32.0)) {
    return;
  }
  let state_offset = source_particle * state_stride;
  output_state_rows[state_offset + 4u] = output_state_rows[state_offset + 4u] + force_application_rows[force_offset + 8u];
  output_state_rows[state_offset + 5u] = output_state_rows[state_offset + 5u] + force_application_rows[force_offset + 9u];
  output_state_rows[state_offset + 6u] = output_state_rows[state_offset + 6u] + force_application_rows[force_offset + 10u];
}
`;

function assertSchroederFarAggregateForceApplicationInput(schroederFarAggregateForceApplication) {
  if (
    schroederFarAggregateForceApplication?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_EXECUTION_SCHEMA
    && schroederFarAggregateForceApplication?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_SCHEMA
  ) {
    throw new TypeError('Schroeder far-force delta fusion requires a Schroeder far-force application artifact');
  }
  if (schroederFarAggregateForceApplication.farAggregateForceApplicationAdmissionApproved !== true) {
    throw new Error('Schroeder far-force delta fusion requires admitted far-force application rows');
  }
  if (schroederFarAggregateForceApplication.stateMutationRequired !== true) {
    throw new Error('Schroeder far-force delta fusion requires mutation-ready far-force application rows');
  }
  const rowCount = Math.max(0, Math.round(finiteNumber(
    schroederFarAggregateForceApplication.forceApplicationRowCount,
    0
  )));
  if (rowCount <= 0) {
    throw new RangeError('Schroeder far-force delta fusion requires at least one force-application row');
  }
  const stride = Math.max(1, Math.round(finiteNumber(
    schroederFarAggregateForceApplication.forceApplicationStrideFloats,
    SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS
  )));
  if (stride !== SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS) {
    throw new RangeError('Schroeder far-force delta fusion requires the current force-application row layout');
  }
}

export function assertSchroederFarAggregateGasStateDeltaInput(schroederFarAggregateGasStateDelta) {
  if (
    schroederFarAggregateGasStateDelta?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_EXECUTION_SCHEMA
    && schroederFarAggregateGasStateDelta?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_SCHEMA
  ) {
    throw new TypeError('Schroeder resident gas-pressure bridge requires a Schroeder far-aggregate gas state-delta artifact');
  }
  if (schroederFarAggregateGasStateDelta.farAggregateGasStateDeltaAdmissionApproved !== true) {
    throw new Error('Schroeder resident gas-pressure bridge requires admitted gas state-delta rows');
  }
  if (schroederFarAggregateGasStateDelta.stateMutationRequired !== true) {
    throw new Error('Schroeder resident gas-pressure bridge requires mutation-ready gas state-delta rows');
  }
  if (schroederFarAggregateGasStateDelta.fullParticleReadbackRequired === true) {
    throw new Error('Schroeder resident gas-pressure bridge forbids full particle readback gas state deltas');
  }
  const rowCount = Math.max(0, Math.round(finiteNumber(
    schroederFarAggregateGasStateDelta.gasStateDeltaRowCount
      ?? schroederFarAggregateGasStateDelta.stateDeltaRowCount,
    0
  )));
  if (rowCount <= 0) {
    throw new RangeError('Schroeder resident gas-pressure bridge requires at least one gas state-delta row');
  }
  const stride = Math.max(1, Math.round(finiteNumber(
    schroederFarAggregateGasStateDelta.gasStateDeltaStrideFloats
      ?? schroederFarAggregateGasStateDelta.stateDeltaStrideFloats,
    SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS
  )));
  if (stride !== SCHROEDER_FAR_AGGREGATE_GAS_STATE_DELTA_FLOATS) {
    throw new RangeError('Schroeder resident gas-pressure bridge requires the current gas state-delta row layout');
  }
  const retainedBuffer = Boolean(
    schroederFarAggregateGasStateDelta.gasStateDeltaBuffer
    || schroederFarAggregateGasStateDelta.stateDeltaBuffer
  );
  const explicitRows = schroederFarAggregateGasStateDelta.gasStateDeltaRows instanceof Float32Array
    || schroederFarAggregateGasStateDelta.stateDeltaRows instanceof Float32Array;
  if (!retainedBuffer && !explicitRows) {
    throw new TypeError('Schroeder resident gas-pressure bridge requires retained gas state-delta rows or explicit rows');
  }
}

export function assertSchroederFarAggregateGasCellImportInput(schroederFarAggregateGasCellImport) {
  if (
    schroederFarAggregateGasCellImport?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA
    && schroederFarAggregateGasCellImport?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA
  ) {
    throw new TypeError('Schroeder resident gas-pressure bridge requires a Schroeder far-aggregate gas-cell import artifact');
  }
  if (schroederFarAggregateGasCellImport.pressureInterfaceImportReady !== true) {
    throw new Error('Schroeder resident gas-pressure bridge requires import-ready gas-cell rows');
  }
  if (schroederFarAggregateGasCellImport.fullParticleReadbackRequired === true) {
    throw new Error('Schroeder resident gas-pressure bridge forbids full particle readback gas-cell imports');
  }
  const rowCount = Math.max(0, Math.round(finiteNumber(
    schroederFarAggregateGasCellImport.pressureInterfaceGasPressureCellRowCount
      ?? schroederFarAggregateGasCellImport.gasPressureCellRowCount,
    0
  )));
  if (rowCount <= 0) {
    throw new RangeError('Schroeder resident gas-pressure bridge requires at least one gas-cell row');
  }
  const stride = Math.max(1, Math.round(finiteNumber(
    schroederFarAggregateGasCellImport.pressureInterfaceGasPressureCellRowStrideFloats
      ?? schroederFarAggregateGasCellImport.gasPressureCellRowStrideFloats,
    SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS
  )));
  if (stride !== SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_FLOATS) {
    throw new RangeError('Schroeder resident gas-pressure bridge requires the current pressure gas-cell row layout');
  }
  const retainedBuffer = Boolean(
    schroederFarAggregateGasCellImport.gasPressureCellsBuffer
    || schroederFarAggregateGasCellImport.pressureInterfaceGasPressureCellsBuffer
  );
  const explicitRows = schroederFarAggregateGasCellImport.gasPressureCellRows instanceof Float32Array;
  if (!retainedBuffer && !explicitRows) {
    throw new TypeError('Schroeder resident gas-pressure bridge requires retained gas-cell rows or explicit rows');
  }
}

export async function runSchroederFarForceDeltaFusionWebGpu({
  device,
  sphParticleState,
  sourceStateBuffer = null,
  schroederFarAggregateForceApplication = null,
  retainOutputParticleBuffers = true,
  readbackMode = NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederFarForceDeltaFusionWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('Schroeder far-force delta fusion requires a packed SPH GPU particle buffer');
  }
  assertSchroederFarAggregateForceApplicationInput(schroederFarAggregateForceApplication);
  const particleCount = Math.max(0, Math.round(finiteNumber(sphParticleState.particleCount, 0)));
  if (particleCount !== sphParticleState.particleCount) {
    throw new RangeError('Schroeder far-force delta fusion requires an integral SPH particle count');
  }
  const forceApplicationRowCount = Math.max(0, Math.round(finiteNumber(
    schroederFarAggregateForceApplication.forceApplicationRowCount,
    0
  )));
  const stateStrideFloats = SPH_GPU_PARTICLE_STATE_FLOATS;
  const stateByteLength = Math.max(4, particleCount * stateStrideFloats * Float32Array.BYTES_PER_ELEMENT);
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const borrowedStateBuffer = sourceStateBuffer || sphParticleState.stateBuffer || null;
  const sourceStateRows = sphParticleState.state instanceof Float32Array ? sphParticleState.state : null;
  if (!borrowedStateBuffer && !(sourceStateRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-force delta fusion requires retained/uploaded SPH state or explicit state rows');
  }
  if (sourceStateRows && sourceStateRows.length < particleCount * stateStrideFloats) {
    throw new RangeError('Schroeder far-force delta fusion received too few SPH state rows');
  }
  const borrowedForceApplicationBuffer = schroederFarAggregateForceApplication.forceApplicationBuffer || null;
  const forceApplicationRows = schroederFarAggregateForceApplication.forceApplicationRows instanceof Float32Array
    ? schroederFarAggregateForceApplication.forceApplicationRows
    : null;
  if (!borrowedForceApplicationBuffer && !(forceApplicationRows instanceof Float32Array)) {
    throw new TypeError('Schroeder far-force delta fusion requires retained force-application rows or explicit rows');
  }

  const stateBuffer = borrowedStateBuffer
    || writeGpuBuffer(device, 'ulg-schroeder-far-force-delta-fusion-state-in', sourceStateRows);
  const forceApplicationBuffer = borrowedForceApplicationBuffer
    || writeGpuBuffer(device, 'ulg-schroeder-far-force-delta-fusion-application-in', forceApplicationRows);
  const outputStateBuffer = device.createBuffer({
    label: 'ulg-schroeder-far-force-delta-fusion-state-out',
    size: stateByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsArray = createSchroederFarForceDeltaFusionParamsArray({
    particleCount,
    stateStrideFloats,
    forceApplicationRowCount,
    forceApplicationStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS
  });
  const paramsBuffer = writeGpuBuffer(
    device,
    'ulg-schroeder-far-force-delta-fusion-params',
    paramsArray,
    GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  );
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-far-force-delta-fusion-readback',
      size: stateByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedOutputStateBuffer = false;
  try {
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ];
    const { pipeline: copyPipeline, bindGroupLayout: copyLayout, cacheStatus: copyCacheStatus } =
      createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-schroeder-far-force-delta-fusion-copy.v0',
        label: 'ulg-schroeder-far-force-delta-fusion-copy',
        code: schroederFarForceDeltaFusionWgsl,
        entryPoint: 'copy_state',
        bindings
      });
    const { pipeline: applyPipeline, bindGroupLayout: applyLayout, cacheStatus: applyCacheStatus } =
      createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-schroeder-far-force-delta-fusion-apply.v0',
        label: 'ulg-schroeder-far-force-delta-fusion-apply',
        code: schroederFarForceDeltaFusionWgsl,
        entryPoint: 'apply_delta',
        bindings
      });
    const entries = [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: forceApplicationBuffer } },
      { binding: 2, resource: { buffer: outputStateBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } }
    ];
    const copyBindGroup = createCachedExplicitBindGroup(device, {
      label: 'ulg-schroeder-far-force-delta-copy',
      layout: copyLayout,
      entries
    });
    const applyBindGroup = createCachedExplicitBindGroup(device, {
      label: 'ulg-schroeder-far-force-delta-apply',
      layout: applyLayout,
      entries
    });
    const encoder = device.createCommandEncoder();
    const copyPass = encoder.beginComputePass();
    copyPass.setPipeline(copyPipeline);
    copyPass.setBindGroup(0, copyBindGroup);
    copyPass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(particleCount / SCHROEDER_FAR_FORCE_DELTA_FUSION_WORKGROUP_SIZE)
    ));
    copyPass.end();
    const applyPass = encoder.beginComputePass();
    applyPass.setPipeline(applyPipeline);
    applyPass.setBindGroup(0, applyBindGroup);
    applyPass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(forceApplicationRowCount / SCHROEDER_FAR_FORCE_DELTA_FUSION_WORKGROUP_SIZE)
    ));
    applyPass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(outputStateBuffer, 0, readBuffer, 0, stateByteLength);
    }
    device.queue.submit([encoder.finish()]);
    let state = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      state = new Float32Array(readBuffer.getMappedRange()).slice(0, particleCount * stateStrideFloats);
      readBuffer.unmap();
    }

    const result = {
      schema: ULG_SCHROEDER_FAR_FORCE_DELTA_FUSION_EXECUTION_SCHEMA,
      status: 'schroeder-far-force-delta-fusion-submitted',
      backend: 'webgpu',
      sourceFarAggregateForceApplicationSchema: schroederFarAggregateForceApplication.schema,
      sourceFarAggregateForceApplicationStatus: schroederFarAggregateForceApplication.status ?? null,
      particleCount,
      stateStrideFloats,
      forceApplicationRowCount,
      forceApplicationStrideFloats: SCHROEDER_FAR_AGGREGATE_FORCE_APPLICATION_FLOATS,
      stateBuffer: outputStateBuffer,
      outputStateBuffer,
      stateBufferByteLength: stateByteLength,
      retainedOutputParticleBuffers: Boolean(retainOutputParticleBuffers),
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: !noFullReadback,
      fullParticleReadbackFree: noFullReadback,
      ...createGpuReadbackTelemetry({
        scope: 'schroeder-far-force-delta-fusion',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : stateByteLength,
        hostQueueFenceCount: 0
      }),
      state,
      pipelineCacheStatus: copyCacheStatus === applyCacheStatus ? copyCacheStatus : 'mixed-cache-status',
      velocityDeltaFusionStatus: 'admitted-far-force-deltas-applied-to-sph-state-buffer',
      stateMutationStatus: 'admitted-far-force-delta-fused-state-buffer-submitted',
      stateAuthorityStatus: 'resident-state-manager-admitted-far-force-delta-state-owner',
      forceApplicationRowsConsumed: true,
      sourceStateBufferRetained: Boolean(sourceStateBuffer || borrowedStateBuffer),
      sourceForceApplicationBufferRetained: Boolean(borrowedForceApplicationBuffer),
      destroyOutputParticleBuffers() {
        outputStateBuffer.destroy?.();
      },
      scientificValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    };
    returnedOutputStateBuffer = true;
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedStateBuffer) stateBuffer.destroy?.();
      if (!borrowedForceApplicationBuffer) forceApplicationBuffer.destroy?.();
      if (!retainOutputParticleBuffers || !returnedOutputStateBuffer) outputStateBuffer.destroy?.();
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

function createComputeDispatchIndirectArgs(workgroupCountX, workgroupCountY = 1, workgroupCountZ = 1) {
  const args = new Uint32Array(COMPUTE_DISPATCH_INDIRECT_UINTS);
  args[0] = Math.max(1, Math.floor(finiteNumber(workgroupCountX, 1)));
  args[1] = Math.max(1, Math.floor(finiteNumber(workgroupCountY, 1)));
  args[2] = Math.max(1, Math.floor(finiteNumber(workgroupCountZ, 1)));
  return args;
}

export function activeGridDispatchPlanBuffers(planHint = null) {
  return [
    planHint?.dispatchArgsBuffer,
    planHint?.metadataBuffer
  ].filter(Boolean);
}

export function activeGridDispatchPlanHintFromCompactSummary(compactGpuSummary = null) {
  const plan = compactGpuSummary?.activeGridDispatchPlan;
  const dispatchArgsBuffer = compactGpuSummary?.activeGridDispatchPlanDispatchArgsBuffer ?? null;
  const metadataBuffer = compactGpuSummary?.activeGridDispatchPlanMetadataBuffer ?? null;
  if (
    plan?.status !== 'gpu-active-grid-summary-dispatch-plan-ready'
    || !dispatchArgsBuffer
    || !metadataBuffer
  ) {
    return null;
  }
  const hint = {
    schema: 'peercompute.ulg.mls-mpm-active-grid-summary-dispatch-plan-hint.v0',
    status: 'active-grid-summary-dispatch-plan-hint-ready',
    source: plan.source || 'compact-summary-gpu-sidecar',
    plan: { ...plan },
    dispatchArgsBuffer,
    metadataBuffer,
    dispatchArgsBufferByteLength: compactGpuSummary.activeGridDispatchPlanDispatchArgsBufferByteLength
      ?? plan.dispatchArgsBufferByteLength
      ?? 0,
    metadataBufferByteLength: compactGpuSummary.activeGridDispatchPlanMetadataBufferByteLength
      ?? plan.metadataBufferByteLength
      ?? 0,
    destroyed: false
  };
  hint.destroyActiveGridDispatchPlanBuffers = () => {
    if (hint.destroyed) return;
    hint.destroyed = true;
    compactGpuSummary.destroyActiveGridDispatchPlanBuffers?.();
  };
  return hint;
}

function activeGridDispatchPlanHintCompatibility(planHint, {
  activeGridDispatch,
  gridSpec,
  stepCount = 1,
  dt = 0
} = {}) {
  const result = (compatible, reason, details = {}) => ({
    compatible,
    reason,
    ...details
  });
  if (!planHint) {
    return result(false, 'no-active-grid-dispatch-plan-hint');
  }
  if (planHint.status !== 'active-grid-summary-dispatch-plan-hint-ready') {
    return result(false, 'active-grid-dispatch-plan-hint-status-not-ready', {
      hintStatus: planHint.status ?? null
    });
  }
  if (planHint.destroyed === true) {
    return result(false, 'active-grid-dispatch-plan-hint-destroyed');
  }
  if (!planHint.dispatchArgsBuffer) {
    return result(false, 'active-grid-dispatch-plan-hint-missing-dispatch-args-buffer');
  }
  if (activeGridDispatch?.useActiveGrid !== true) {
    return result(false, 'active-grid-dispatch-disabled');
  }
  if (!gridSpec) {
    return result(false, 'active-grid-dispatch-grid-spec-missing');
  }
  const plan = planHint.plan || {};
  const planDims = Array.isArray(plan.gridDims) ? plan.gridDims : [];
  if (planDims.length < 3 || planDims.some((value, axis) => Math.round(Number(value)) !== gridSpec.gridDims[axis])) {
    return result(false, 'active-grid-dispatch-plan-grid-dims-mismatch', {
      planGridDims: planDims.slice(0, 3),
      expectedGridDims: [...gridSpec.gridDims]
    });
  }
  if (Math.round(Number(plan.gridShift)) !== gridSpec.shift) {
    return result(false, 'active-grid-dispatch-plan-grid-shift-mismatch', {
      planGridShift: Math.round(Number(plan.gridShift)),
      expectedGridShift: gridSpec.shift
    });
  }
  if (Math.abs(finiteNumber(plan.gridSpacingM, Number.NaN) - gridSpec.gridSpacingM) > 1e-9) {
    return result(false, 'active-grid-dispatch-plan-grid-spacing-mismatch', {
      planGridSpacingM: finiteNumber(plan.gridSpacingM, Number.NaN),
      expectedGridSpacingM: gridSpec.gridSpacingM
    });
  }
  if (Math.round(Number(plan.gridNodeCount)) !== gridSpec.gridNodeCount) {
    return result(false, 'active-grid-dispatch-plan-grid-node-count-mismatch', {
      planGridNodeCount: Math.round(Number(plan.gridNodeCount)),
      expectedGridNodeCount: gridSpec.gridNodeCount
    });
  }
  if (Math.round(Number(plan.safetyCells)) !== Math.round(Number(activeGridDispatch.safetyCells))) {
    return result(false, 'active-grid-dispatch-plan-safety-cells-mismatch', {
      planSafetyCells: Math.round(Number(plan.safetyCells)),
      expectedSafetyCells: Math.round(Number(activeGridDispatch.safetyCells))
    });
  }
  const expectedStepCount = Math.max(1, Math.round(finiteNumber(stepCount, 1)));
  if (Math.round(Number(plan.stepCount)) !== expectedStepCount) {
    return result(false, 'active-grid-dispatch-plan-step-count-mismatch', {
      planStepCount: Math.round(Number(plan.stepCount)),
      expectedStepCount
    });
  }
  if (Math.abs(finiteNumber(plan.dt, 0) - finiteNumber(dt, 0)) > 1e-9) {
    return result(false, 'active-grid-dispatch-plan-dt-mismatch', {
      planDt: finiteNumber(plan.dt, 0),
      expectedDt: finiteNumber(dt, 0)
    });
  }
  return result(true, 'active-grid-dispatch-plan-compatible', {
    hintStatus: planHint.status,
    hintSource: planHint.source ?? null
  });
}

function activeGridDispatchPlanHintCompatible(planHint, options = {}) {
  return activeGridDispatchPlanHintCompatibility(planHint, options).compatible === true;
}

export function createActiveGridComputeDispatchArgsBuffer(
  device,
  activeGridDispatch,
  workgroupCountX,
  activeGridDispatchPlanHint = null,
  planCompatibility = {}
) {
  if (activeGridDispatch?.useActiveGrid !== true) return null;
  const hintCompatibility = activeGridDispatchPlanHintCompatibility(activeGridDispatchPlanHint, {
    activeGridDispatch,
    ...planCompatibility
  });
  if (hintCompatibility.compatible) {
    return {
      schema: 'peercompute.ulg.mls-mpm-active-grid-compute-dispatch-indirect.v0',
      status: 'gpu-summary-active-grid-indirect-dispatch-ready',
      source: 'compact-summary-gpu-sidecar',
      buffer: activeGridDispatchPlanHint.dispatchArgsBuffer,
      metadataBuffer: activeGridDispatchPlanHint.metadataBuffer,
      ownsBuffer: false,
      bufferByteLength: activeGridDispatchPlanHint.dispatchArgsBufferByteLength,
      metadataBufferByteLength: activeGridDispatchPlanHint.metadataBufferByteLength,
      offsetBytes: 0,
      workgroupCountX: Math.max(1, Math.floor(finiteNumber(workgroupCountX, 1))),
      workgroupCountY: 1,
      workgroupCountZ: 1,
      workgroupSize: 64,
      activeGridNodeCount: Math.max(0, Math.floor(finiteNumber(activeGridDispatch.activeNodeCount, 0))),
      fullGridNodeCount: Math.max(0, Math.floor(finiteNumber(activeGridDispatch.fullGridNodeCount, 0))),
      indirectDispatchUsed: false,
      indirectDispatchUseCount: 0,
      directDispatchFallbackCount: 0,
      dispatchMode: 'pending',
      dispatchPlanHintStatus: activeGridDispatchPlanHint.status,
      dispatchPlanHintSource: activeGridDispatchPlanHint.source,
      dispatchPlanHintBorrowed: true,
      dispatchPlanHintCompatibilityReason: hintCompatibility.reason,
      dispatchPlanHintCompatibility: hintCompatibility
    };
  }
  const args = createComputeDispatchIndirectArgs(workgroupCountX);
  const canPool = typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice;
  const usage = GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST;
  const buffer = canPool
    ? (() => {
        const pooled = acquireQueueOrderedPooledBuffer(device, {
          bucketKey: 'ulg-mls-mpm-active-grid-dispatch-indirect-args',
          label: 'ulg-mls-mpm-active-grid-dispatch-indirect-args',
          size: Math.max(4, args.byteLength),
          usage
        });
        registerQueueOrderedPooledBufferReturn(pooled, device, {
          bucketKey: 'ulg-mls-mpm-active-grid-dispatch-indirect-args',
          size: Math.max(4, args.byteLength),
          usage
        });
        device.queue.writeBuffer(pooled, 0, args);
        return pooled;
      })()
    : writeGpuBuffer(
        device,
        'ulg-mls-mpm-active-grid-dispatch-indirect-args',
        args,
        usage
      );
  return {
    schema: 'peercompute.ulg.mls-mpm-active-grid-compute-dispatch-indirect.v0',
    status: 'cpu-seeded-active-grid-indirect-dispatch-ready',
    source: 'active-grid-dispatch-cpu-metadata',
    buffer,
    ownsBuffer: true,
    bufferByteLength: args.byteLength,
    offsetBytes: 0,
    workgroupCountX: args[0],
    workgroupCountY: args[1],
    workgroupCountZ: args[2],
    workgroupSize: 64,
    activeGridNodeCount: Math.max(0, Math.floor(finiteNumber(activeGridDispatch.activeNodeCount, 0))),
    fullGridNodeCount: Math.max(0, Math.floor(finiteNumber(activeGridDispatch.fullGridNodeCount, 0))),
    indirectDispatchUsed: false,
    indirectDispatchUseCount: 0,
    directDispatchFallbackCount: 0,
    dispatchMode: 'pending',
    dispatchPlanHintStatus: activeGridDispatchPlanHint?.status ?? null,
    dispatchPlanHintSource: activeGridDispatchPlanHint?.source ?? null,
    dispatchPlanHintBorrowed: false,
    dispatchPlanHintCompatibilityReason: hintCompatibility.reason,
    dispatchPlanHintCompatibility: hintCompatibility
  };
}

export function createCompactMechanicsViewIndirectDispatchArgs(
  device,
  schroederSpatialDirectory,
  gridSpec
) {
  if (
    schroederSpatialDirectory?.mechanicsViewEnabled !== true
    || !schroederSpatialDirectory.mechanicsViewIndirectDispatchBuffer
  ) return null;
  const size = COMPUTE_DISPATCH_INDIRECT_UINTS * Uint32Array.BYTES_PER_ELEMENT;
  const usage = GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_DST;
  const canPool = typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice;
  const buffer = canPool
    ? (() => {
        const pooled = acquireQueueOrderedPooledBuffer(device, {
          bucketKey: 'ulg-mls-mpm-compact-mechanics-indirect-dispatch-staging',
          label: 'ulg-mls-mpm-compact-mechanics-indirect-dispatch-staging',
          size,
          usage
        });
        registerQueueOrderedPooledBufferReturn(pooled, device, {
          bucketKey: 'ulg-mls-mpm-compact-mechanics-indirect-dispatch-staging',
          size,
          usage
        });
        return pooled;
      })()
    : device.createBuffer({
        label: 'ulg-mls-mpm-compact-mechanics-indirect-dispatch-staging',
        size,
        usage
      });
  return {
    schema: 'peercompute.ulg.mls-mpm-compact-mechanics-view-indirect-dispatch.v1',
    status: 'gpu-authored-compact-mechanics-view-indirect-dispatch-ready',
    source: 'ss-spatial-mechanics-view-v1',
    buffer,
    ownsBuffer: true,
    bufferByteLength: COMPUTE_DISPATCH_INDIRECT_UINTS * Uint32Array.BYTES_PER_ELEMENT,
    sourceBuffer: schroederSpatialDirectory.mechanicsViewIndirectDispatchBuffer,
    sourceBufferByteLength: schroederSpatialDirectory.mechanicsViewByteLength,
    sourceOffsetBytes: schroederSpatialDirectory.mechanicsViewIndirectDispatchOffsetBytes,
    metadataBufferByteLength: 0,
    offsetBytes: 0,
    workgroupCountX: null,
    workgroupCountY: null,
    workgroupCountZ: null,
    workgroupSize: 64,
    activeGridNodeCount: null,
    activeGridNodeCountKnown: false,
    activeGridNodeCapacity: schroederSpatialDirectory.mechanicsViewNodeCapacity,
    fullGridNodeCount: Math.max(0, Math.floor(finiteNumber(gridSpec?.gridNodeCount, 0))),
    indirectDispatchUsed: false,
    indirectDispatchUseCount: 0,
    directDispatchFallbackCount: 0,
    dispatchMode: 'pending',
    dispatchPlanHintStatus: null,
    dispatchPlanHintSource: null,
    dispatchPlanHintBorrowed: false,
    dispatchPlanHintCompatibilityReason: 'canonical-compact-mechanics-view',
    dispatchPlanHintCompatibility: null
  };
}

export function createMechanicsFieldViewIndirectDispatchArgs(
  device,
  schroederSpatialDirectory,
  gridSpec
) {
  if (
    schroederSpatialDirectory?.mechanicsFieldViewEnabled !== true
    || !schroederSpatialDirectory.mechanicsFieldViewIndirectDispatchBuffer
  ) return null;
  const buffer = device.createBuffer({
    label: 'ulg-mls-mpm-mechanics-field-view-indirect-dispatch-staging',
    size: COMPUTE_DISPATCH_INDIRECT_UINTS * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_DST
  });
  return {
    schema: 'peercompute.ulg.mls-mpm-mechanics-field-view-indirect-dispatch.v2',
    status: 'gpu-authored-mechanics-field-view-indirect-dispatch-ready',
    source: 'ss-spatial-mechanics-field-view-v5',
    buffer,
    ownsBuffer: true,
    bufferByteLength: COMPUTE_DISPATCH_INDIRECT_UINTS * Uint32Array.BYTES_PER_ELEMENT,
    sourceBuffer:
      schroederSpatialDirectory.mechanicsFieldViewIndirectDispatchBuffer,
    sourceBufferByteLength: schroederSpatialDirectory.mechanicsFieldViewByteLength,
    sourceOffsetBytes:
      schroederSpatialDirectory.mechanicsFieldViewIndirectDispatchOffsetBytes,
    metadataBufferByteLength: 0,
    offsetBytes: 0,
    workgroupCountX: null,
    workgroupCountY: null,
    workgroupCountZ: null,
    workgroupSize: 64,
    dispatchDimensions: 2,
    dispatchLinearization:
      'linearGroup=workgroup.x+workgroup.y*dispatchX',
    sourceDispatchWorkgroups:
      schroederSpatialDirectory.mechanicsFieldViewExecution
        ?.sourceDispatchWorkgroups ?? null,
    candidateDispatchWorkgroups:
      schroederSpatialDirectory.mechanicsFieldViewExecution
        ?.candidateDispatchWorkgroups ?? null,
    maxComputeWorkgroupsPerDimension:
      schroederSpatialDirectory.mechanicsFieldViewExecution
        ?.maxComputeWorkgroupsPerDimension ?? null,
    activeGridNodeCount: null,
    activeGridNodeCountKnown: false,
    activeGridNodeCapacity:
      schroederSpatialDirectory.mechanicsFieldViewLayout?.fieldCapacity ?? 0,
    fullGridNodeCount: Math.max(0, Math.floor(finiteNumber(gridSpec?.gridNodeCount, 0))),
    indirectDispatchUsed: false,
    indirectDispatchUseCount: 0,
    directDispatchFallbackCount: 0,
    dispatchMode: 'pending',
    dispatchPlanHintStatus: null,
    dispatchPlanHintSource: null,
    dispatchPlanHintBorrowed: false,
    dispatchPlanHintCompatibilityReason: 'canonical-mechanics-field-view',
    dispatchPlanHintCompatibility: null
  };
}

export function copyCompactMechanicsViewIndirectDispatchArgs(encoder, indirectDispatchArgs) {
  if (
    !indirectDispatchArgs?.sourceBuffer
    || !indirectDispatchArgs?.buffer
    || typeof encoder?.copyBufferToBuffer !== 'function'
  ) {
    const error = new Error(
      'Canonical compact mechanics requires GPU dispatch-argument staging'
    );
    error.code = 'ERR_COMPACT_MECHANICS_INDIRECT_COPY_REQUIRED';
    throw error;
  }
  encoder.copyBufferToBuffer(
    indirectDispatchArgs.sourceBuffer,
    indirectDispatchArgs.sourceOffsetBytes,
    indirectDispatchArgs.buffer,
    0,
    COMPUTE_DISPATCH_INDIRECT_UINTS * Uint32Array.BYTES_PER_ELEMENT
  );
  indirectDispatchArgs.gpuCopyCount = (indirectDispatchArgs.gpuCopyCount ?? 0) + 1;
}

export function dispatchCompactMechanicsViewPass(pass, indirectDispatchArgs) {
  if (
    !indirectDispatchArgs?.buffer
    || typeof pass?.dispatchWorkgroupsIndirect !== 'function'
  ) {
    const error = new Error(
      'Canonical compact mechanics requires GPU-authored dispatchWorkgroupsIndirect'
    );
    error.code = 'ERR_COMPACT_MECHANICS_INDIRECT_DISPATCH_REQUIRED';
    throw error;
  }
  pass.dispatchWorkgroupsIndirect(
    indirectDispatchArgs.buffer,
    indirectDispatchArgs.offsetBytes
  );
  indirectDispatchArgs.indirectDispatchUsed = true;
  indirectDispatchArgs.indirectDispatchUseCount += 1;
  indirectDispatchArgs.dispatchMode = 'dispatchWorkgroupsIndirect';
  return 'dispatchWorkgroupsIndirect';
}

export function dispatchActiveGridComputePass(pass, directWorkgroupCount, indirectDispatchArgs) {
  if (indirectDispatchArgs?.buffer && typeof pass.dispatchWorkgroupsIndirect === 'function') {
    pass.dispatchWorkgroupsIndirect(indirectDispatchArgs.buffer, indirectDispatchArgs.offsetBytes);
    indirectDispatchArgs.indirectDispatchUsed = true;
    indirectDispatchArgs.indirectDispatchUseCount += 1;
    indirectDispatchArgs.dispatchMode = 'dispatchWorkgroupsIndirect';
    return 'dispatchWorkgroupsIndirect';
  }
  pass.dispatchWorkgroups(directWorkgroupCount);
  if (indirectDispatchArgs) {
    indirectDispatchArgs.directDispatchFallbackCount += 1;
    if (indirectDispatchArgs.dispatchMode === 'pending') {
      indirectDispatchArgs.dispatchMode = 'dispatchWorkgroups';
    }
  }
  return 'dispatchWorkgroups';
}

export function activeGridIndirectDispatchDescriptor(indirectDispatchArgs) {
  if (!indirectDispatchArgs) return null;
  return {
    schema: indirectDispatchArgs.schema,
    status: indirectDispatchArgs.status,
    source: indirectDispatchArgs.source,
    bufferByteLength: indirectDispatchArgs.bufferByteLength,
    metadataBufferByteLength: indirectDispatchArgs.metadataBufferByteLength ?? 0,
    sourceBufferByteLength: indirectDispatchArgs.sourceBufferByteLength ?? 0,
    sourceOffsetBytes: indirectDispatchArgs.sourceOffsetBytes ?? null,
    ownsBuffer: indirectDispatchArgs.ownsBuffer !== false,
    offsetBytes: indirectDispatchArgs.offsetBytes,
    workgroupCountX: indirectDispatchArgs.workgroupCountX,
    workgroupCountY: indirectDispatchArgs.workgroupCountY,
    workgroupCountZ: indirectDispatchArgs.workgroupCountZ,
    workgroupSize: indirectDispatchArgs.workgroupSize,
    dispatchDimensions: indirectDispatchArgs.dispatchDimensions ?? 1,
    dispatchLinearization: indirectDispatchArgs.dispatchLinearization ?? null,
    sourceDispatchWorkgroups:
      indirectDispatchArgs.sourceDispatchWorkgroups
        ? [...indirectDispatchArgs.sourceDispatchWorkgroups]
        : null,
    candidateDispatchWorkgroups:
      indirectDispatchArgs.candidateDispatchWorkgroups
        ? [...indirectDispatchArgs.candidateDispatchWorkgroups]
        : null,
    maxComputeWorkgroupsPerDimension:
      indirectDispatchArgs.maxComputeWorkgroupsPerDimension ?? null,
    activeGridNodeCount: indirectDispatchArgs.activeGridNodeCount,
    activeGridNodeCountKnown: indirectDispatchArgs.activeGridNodeCountKnown !== false,
    activeGridNodeCapacity: indirectDispatchArgs.activeGridNodeCapacity
      ?? indirectDispatchArgs.activeGridNodeCount,
    fullGridNodeCount: indirectDispatchArgs.fullGridNodeCount,
    indirectDispatchUsed: indirectDispatchArgs.indirectDispatchUsed,
    indirectDispatchUseCount: indirectDispatchArgs.indirectDispatchUseCount,
    directDispatchFallbackCount: indirectDispatchArgs.directDispatchFallbackCount,
    gpuCopyCount: indirectDispatchArgs.gpuCopyCount ?? 0,
    dispatchMode: indirectDispatchArgs.dispatchMode,
    dispatchPlanHintStatus: indirectDispatchArgs.dispatchPlanHintStatus ?? null,
    dispatchPlanHintSource: indirectDispatchArgs.dispatchPlanHintSource ?? null,
    dispatchPlanHintBorrowed: indirectDispatchArgs.dispatchPlanHintBorrowed === true,
    dispatchPlanHintCompatibilityReason: indirectDispatchArgs.dispatchPlanHintCompatibilityReason ?? null,
    dispatchPlanHintCompatibility: indirectDispatchArgs.dispatchPlanHintCompatibility
      ? { ...indirectDispatchArgs.dispatchPlanHintCompatibility }
      : null
  };
}

export function attachActiveGridIndirectDispatchTopology(dispatchTopology, indirectDispatchArgs) {
  if (!dispatchTopology || !indirectDispatchArgs) return dispatchTopology;
  const descriptor = activeGridIndirectDispatchDescriptor(indirectDispatchArgs);
  dispatchTopology.activeGridIndirectDispatch = descriptor;
  for (const stageId of [
    'compactMechanicsNodeValidation',
    'p2gAccumulatorClear',
    'p2gFinalize',
    'gridUpdate'
  ]) {
    if (!dispatchTopology[stageId]) continue;
    dispatchTopology[stageId].dispatchSubmissionMode = descriptor.dispatchMode;
    dispatchTopology[stageId].indirectDispatchReady = true;
    dispatchTopology[stageId].indirectDispatchUsed = descriptor.indirectDispatchUsed;
    dispatchTopology[stageId].indirectDispatchArgsBufferByteLength = descriptor.bufferByteLength;
    dispatchTopology[stageId].indirectDispatchWorkgroupCountX = descriptor.workgroupCountX;
  }
  return dispatchTopology;
}

export function attachMechanicsFieldIndirectDispatchTopology(
  dispatchTopology,
  indirectDispatchArgs
) {
  if (!dispatchTopology || !indirectDispatchArgs) return dispatchTopology;
  const descriptor = activeGridIndirectDispatchDescriptor(
    indirectDispatchArgs
  );
  dispatchTopology.mechanicsField.indirectDispatch = descriptor;
  for (const stageId of [
    'p2gAccumulatorClear',
    'p2gFinalize',
    'gridUpdate'
  ]) {
    if (!dispatchTopology[stageId]) continue;
    dispatchTopology[stageId].dispatchSubmissionMode =
      descriptor.dispatchMode;
    dispatchTopology[stageId].indirectDispatchReady = true;
    dispatchTopology[stageId].indirectDispatchUsed =
      descriptor.indirectDispatchUsed;
    dispatchTopology[stageId].indirectDispatchArgsBufferByteLength =
      descriptor.bufferByteLength;
    dispatchTopology[stageId].indirectDispatchWorkgroupCountX =
      descriptor.workgroupCountX;
    dispatchTopology[stageId].indirectDispatchWorkgroupCountY =
      descriptor.workgroupCountY;
    dispatchTopology[stageId].indirectDispatchWorkgroupCountZ =
      descriptor.workgroupCountZ;
    dispatchTopology[stageId].indirectDispatchDimensions =
      descriptor.dispatchDimensions;
    dispatchTopology[stageId].indirectDispatchLinearization =
      descriptor.dispatchLinearization;
  }
  return dispatchTopology;
}

export async function readGpuBuffer(device, sourceBuffer, byteLength, label) {
  const readback = device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(sourceBuffer, 0, readback, 0, byteLength);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPU_MAP_MODE.READ);
  const copy = readback.getMappedRange().slice(0, byteLength);
  readback.unmap();
  readback.destroy?.();
  return copy;
}

export function createSpatialGasLedgerProductEventCompactParams({
  productEventRowCount,
  productEventStrideFloats,
  spatialGasSupportVolumeFallbackM3 = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.floor(finiteNumber(productEventRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.floor(finiteNumber(productEventStrideFloats, SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS))), true);
  view.setUint32(8, SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS, true);
  view.setUint32(12, 0, true);
  view.setFloat32(16, Math.max(0, finiteNumber(spatialGasSupportVolumeFallbackM3, 0)), true);
  view.setUint32(20, 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  return buffer;
}

export function createSpatialGasLedgerProductEventCompactWgsl() {
  return recordWgslVariantManifest(composeWgslModule({
    moduleId: 'spatial-gas-ledger',
    variantId: 'product-event-compact',
    includeProvenanceHeader: false,
    fragments: [
      {
        slot: 'spatial-gas-compact-params',
        code: `struct Params {
  product_event_row_count: u32,
  product_event_stride_floats: u32,
  compact_stride_floats: u32,
  pad0: u32,
  spatial_gas_support_volume_fallback_m3: f32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
};

@group(0) @binding(0) var<storage, read> product_events: array<f32>;
@group(0) @binding(1) var<storage, read_write> compact_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;`
      },
      {
        slot: 'spatial-gas-compact-main',
        code: `@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  if (row >= params.product_event_row_count) {
    return;
  }
  let src = row * params.product_event_stride_floats;
  let dst = row * params.compact_stride_floats;
  let status = product_events[src + 18u];
  let routing = product_events[src + 10u];
  let moles = product_events[src + 9u];
  let source_support_volume = product_events[src + 23u];
  let support_volume = select(
    params.spatial_gas_support_volume_fallback_m3,
    source_support_volume,
    source_support_volume > 0.0
  );
  compact_rows[dst + 0u] = product_events[src + 0u];
  compact_rows[dst + 1u] = product_events[src + 1u];
  compact_rows[dst + 2u] = product_events[src + 2u];
  compact_rows[dst + 3u] = product_events[src + 4u];
  compact_rows[dst + 4u] = product_events[src + 3u];
  compact_rows[dst + 5u] = moles;
  compact_rows[dst + 6u] = product_events[src + 16u];
  compact_rows[dst + 7u] = support_volume;
  compact_rows[dst + 8u] = product_events[src + 5u];
  compact_rows[dst + 9u] = f32(row);
  compact_rows[dst + 10u] = status;
  compact_rows[dst + 11u] = routing;
}`
      }
    ]
  }));
}

function productTermMetadataByIndexForSpatialLedger(reactionTable) {
  const terms = Array.isArray(reactionTable?.productTermMetadata)
    ? reactionTable.productTermMetadata
    : [];
  return new Map(terms.map((term) => [Math.round(Number(term.productTermIndex) || 0), term]));
}

function materialForSpatialGasCompactRow(row, terms) {
  const rawProductTermIndex = Number(row.productTermIndex);
  const productTermIndex = Number.isFinite(rawProductTermIndex)
    && rawProductTermIndex >= 0
      ? Math.round(rawProductTermIndex)
      : null;
  const term = productTermIndex == null
    ? null
    : terms.get(productTermIndex) || null;
  return String(term?.material || Math.round(Number(row.materialId) || 0)).toLowerCase();
}

function spatialGasGridKey(index) {
  return index.map((value) => Math.round(value)).join(',');
}

export function decodeSpatialGasLedgerCompactRows(values, {
  productEventRowCount = null,
  boxDimsM = null,
  reactionTable = null,
  source = 'gpu-resident-product-event-compact-spatial-ledger',
  spatialGasSupportVolumeFallbackM3 = 0,
  retainedSpatialGasSourceBufferRefs = [],
  workerRetainedSpatialGasSourceBufferRefs = [],
  retainedSpatialGasLedgerBufferRefs = [],
  workerRetainedSpatialGasLedgerBufferRefs = []
} = {}) {
  if (!(values instanceof Float32Array) || values.length % SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS !== 0) {
    throw new TypeError('decodeSpatialGasLedgerCompactRows requires f32 rows aligned to the compact spatial gas layout');
  }
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M).map((value) => Math.max(value, 1e-9));
  const terms = productTermMetadataByIndexForSpatialLedger(reactionTable);
  const rows = [];
  const maxRows = productEventRowCount == null
    ? values.length / SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
    : Math.min(
        Math.max(0, Math.floor(finiteNumber(productEventRowCount, 0))),
        values.length / SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
      );
  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    const offset = rowIndex * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS;
    const status = values[offset + 10];
    const moles = finiteNumber(values[offset + 5], 0);
    const supportVolumeM3 = finiteNumber(values[offset + 7], 0);
    const routingId = finiteNumber(values[offset + 11], 1);
    const positionM = [values[offset], values[offset + 1], values[offset + 2]].map((value) => finiteNumber(value, NaN));
    if (
      status <= 0.5
      || routingId <= 0.5
      || routingId >= 1.5
      || moles <= 0
      || supportVolumeM3 <= 0
      || positionM.some((value) => !Number.isFinite(value))
    ) {
      continue;
    }
    const sourceDiscriminant = finiteNumber(values[offset + 8], 0);
    const particleSource = Object.is(sourceDiscriminant, -1);
    rows.push({
      positionM,
      materialId: finiteNumber(values[offset + 3], 0),
      massKg: finiteNumber(values[offset + 4], 0),
      moles,
      temperatureK: finiteNumber(values[offset + 6], 293.15),
      supportVolumeM3,
      sourceKind: particleSource ? 'particle' : 'product-event',
      sourceDiscriminant,
      productTermIndex: particleSource
        ? null
        : Math.round(sourceDiscriminant),
      particleIndex: particleSource
        ? Math.round(finiteNumber(values[offset + 9], rowIndex))
        : null,
      sourceRowIndex: Math.round(finiteNumber(values[offset + 9], rowIndex)),
      routingId,
      status: 'ready'
    });
  }
  if (!rows.length) return null;
  const meanSupportVolumeM3 = rows.reduce((sum, row) => sum + row.supportVolumeM3, 0) / rows.length;
  const supportEdgeM = Math.cbrt(Math.max(meanSupportVolumeM3, 1e-12));
  const cellDims = dims.map((dim) => Math.max(1, Math.ceil(dim / supportEdgeM)));
  const buckets = new Map();
  for (const row of rows) {
    const gridIndex = row.positionM.map((position, axis) => {
      const normalized = dims[axis] > 0 ? position / dims[axis] : 0;
      return Math.max(0, Math.min(cellDims[axis] - 1, Math.floor(normalized * cellDims[axis])));
    });
    const key = spatialGasGridKey(gridIndex);
    const bucket = buckets.get(key) || {
      index: buckets.size,
      gridIndex,
      weightedPositionM: [0, 0, 0],
      weightMoles: 0,
      volumeM3: 0,
      bySpecies: {},
      sourceEventCount: 0,
      sourceRowIndices: []
    };
    bucket.weightMoles += row.moles;
    bucket.volumeM3 += row.supportVolumeM3;
    bucket.weightedPositionM = bucket.weightedPositionM.map((value, axis) => value + row.positionM[axis] * row.moles);
    bucket.sourceEventCount += 1;
    bucket.sourceRowIndices.push(row.sourceRowIndex);
    const material = materialForSpatialGasCompactRow(row, terms);
    const species = bucket.bySpecies[material] || (bucket.bySpecies[material] = {
      material,
      materialId: row.materialId,
      massKg: 0,
      moles: 0,
      temperatureMoleK: 0,
      eventCount: 0
    });
    species.massKg += row.massKg;
    species.moles += row.moles;
    species.temperatureMoleK += row.moles * row.temperatureK;
    species.eventCount += 1;
    buckets.set(key, bucket);
  }
  const cells = [...buckets.values()].map((bucket) => ({
    index: bucket.index,
    gridIndex: bucket.gridIndex,
    centerM: bucket.weightMoles > 0
      ? bucket.weightedPositionM.map((value) => value / bucket.weightMoles)
      : bucket.gridIndex.map((value, axis) => (value + 0.5) * (dims[axis] / cellDims[axis])),
    volumeM3: bucket.volumeM3,
    sourceEventCount: bucket.sourceEventCount,
    sourceRowIndices: [...bucket.sourceRowIndices],
    bySpecies: Object.fromEntries(Object.entries(bucket.bySpecies).map(([material, species]) => [
      material,
      {
        material,
        materialId: species.materialId,
        massKg: species.massKg,
        moles: species.moles,
        temperatureK: species.moles > 0 ? species.temperatureMoleK / species.moles : 293.15,
        eventCount: species.eventCount
      }
    ]))
  }));
  const retainedSourceRefs = uniqueNonEmptyStrings([
    ...retainedSpatialGasSourceBufferRefs,
    ...workerRetainedSpatialGasSourceBufferRefs
  ]);
  const retainedLedgerRefs = uniqueNonEmptyStrings([
    ...retainedSpatialGasLedgerBufferRefs,
    ...workerRetainedSpatialGasLedgerBufferRefs
  ]);
  return {
    schema: ULG_SPH_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA,
    status: 'spatial-gas-species-ledger-ready',
    source,
    spatialGasLedgerDerivation: 'positioned-product-event-rows',
    spatialGasPositionSource: 'resident-product-event-row-positions',
    spatialGasSupportVolumeSource: spatialGasSupportVolumeFallbackM3 > 0
      ? 'product-event-row-support-volume-or-derived-gas-ledger-share'
      : 'product-event-row-support-volume',
    spatialGasSupportVolumeFallbackM3: Math.max(0, finiteNumber(spatialGasSupportVolumeFallbackM3, 0)),
    retainedSpatialGasSourceBufferRefs: uniqueNonEmptyStrings(retainedSpatialGasSourceBufferRefs),
    workerRetainedSpatialGasSourceBufferRefs: uniqueNonEmptyStrings(workerRetainedSpatialGasSourceBufferRefs),
    spatialGasSourceBufferRetained: retainedSourceRefs.length > 0,
    retainedSpatialGasLedgerBufferRefs: uniqueNonEmptyStrings(retainedSpatialGasLedgerBufferRefs),
    workerRetainedSpatialGasLedgerBufferRefs: uniqueNonEmptyStrings(workerRetainedSpatialGasLedgerBufferRefs),
    spatialGasLedgerBufferRetained: retainedLedgerRefs.length > 0,
    cellDims,
    cellCount: cells.length,
    cells,
    sourceEventRowCount: rows.length,
    scannedProductEventRowCount: maxRows,
    pressureClosure: 'ideal-gas-law-per-cell',
    spatialGasSpeciesLedgerValidation: false,
    scientificValidation: false,
    gasValidation: false,
    fullPhysicsValidation: false
  };
}

function aggregateGasRecordsForSpatialLedger(...sources) {
  const records = [];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    if (Array.isArray(source.gasSpeciesLedger?.records)) records.push(...source.gasSpeciesLedger.records);
    if (Array.isArray(source.records)) records.push(...source.records);
    if (source.bySpecies && typeof source.bySpecies === 'object') records.push(...Object.values(source.bySpecies));
  }
  const byMaterial = new Map();
  for (const record of records) {
    const moles = finiteNumber(record?.moles, 0);
    const massKg = finiteNumber(record?.massKg, 0);
    if (!(moles > 0) || !(massKg >= 0)) continue;
    const material = String(record?.material || Math.round(finiteNumber(record?.materialId, 0))).toLowerCase();
    const bucket = byMaterial.get(material) || {
      material,
      materialId: finiteNumber(record?.materialId, 0),
      massKg: 0,
      moles: 0,
      temperatureMoleK: 0,
      eventCount: 0
    };
    const temperatureK = finiteNumber(record?.temperatureK, 293.15);
    bucket.massKg += massKg;
    bucket.moles += moles;
    bucket.temperatureMoleK += moles * temperatureK;
    bucket.eventCount += Math.max(0, finiteNumber(record?.eventCount, 0));
    byMaterial.set(material, bucket);
  }
  return [...byMaterial.values()];
}

export function deriveSpatialGasSupportVolumeFallbackM3({
  boxDimsM = null,
  residentProductMass = null,
  reactionSummary = null,
  gasPressureSummary = null,
  productEventRowCount = 0,
  explicitFallbackM3 = null
} = {}) {
  const explicit = finiteNumber(explicitFallbackM3, 0);
  if (explicit > 0) return explicit;
  const records = aggregateGasRecordsForSpatialLedger(
    residentProductMass,
    reactionSummary,
    gasPressureSummary?.gasSpeciesLedger,
    gasPressureSummary
  );
  if (!records.length) return 0;
  const dims = finiteVector3(boxDimsM || gasPressureSummary?.boxDimsM, DEFAULT_BOX_DIMS_M)
    .map((value) => Math.max(value, 1e-9));
  const volumeM3 = dims.reduce((product, value) => product * value, 1);
  const gasEventCount = records.reduce((sum, record) => sum + Math.max(0, finiteNumber(record?.eventCount, 0)), 0);
  const denominator = gasEventCount > 0
    ? gasEventCount
    : Math.max(1, Math.floor(finiteNumber(productEventRowCount, 0)) || records.length);
  return volumeM3 / denominator;
}

export function deriveAuthoritativeSpatialGasGrid(
  schroederSpatialEpochGeneration = null
) {
  if (
    schroederSpatialEpochGeneration?.ready !== true
    || schroederSpatialEpochGeneration?.selected !== true
  ) {
    return null;
  }
  const levelViews = Array.isArray(
    schroederSpatialEpochGeneration.mechanicsLevelViews
  )
    ? schroederSpatialEpochGeneration.mechanicsLevelViews
    : [];
  if (levelViews.length < 1 || levelViews.length > SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS) return null;
  const selected = levelViews[levelViews.length - 1];
  const field = selected?.mechanicsFieldView || null;
  const gridDims = Array.from(field?.gridDims || []);
  const gridNodeCount = Number(field?.gridNodeCount);
  const gridShift = Number(field?.gridShift);
  const gridSpacingM = Math.fround(Number(field?.gridSpacingM));
  const selectedLevel = Number(selected?.selectedLevel);
  if (
    gridDims.length !== 3
    || gridDims.some((value) => (
      !Number.isSafeInteger(value) || value < 1
    ))
    || !Number.isSafeInteger(gridNodeCount)
    || gridNodeCount < 1
    || gridDims.reduce((product, value) => product * value, 1)
      !== gridNodeCount
    || !Number.isSafeInteger(gridShift)
    || gridShift < 0
    || !Number.isFinite(gridSpacingM)
    || !(gridSpacingM > 0)
    || !Number.isInteger(selectedLevel)
  ) {
    return null;
  }
  return Object.freeze({
    selectedLevel,
    gridDims: Object.freeze(gridDims),
    gridNodeCount,
    gridShift,
    gridSpacingM,
    levelCount: levelViews.length,
    source:
      'same-generation-selected-mechanics-occupancy-grid'
  });
}

export function spatialGasLedgerFromAggregateGasLedger({
  residentProductMass = null,
  reactionSummary = null,
  gasPressureSummary = null,
  boxDimsM = null,
  source = 'resident-product-mass-aggregate-gas-ledger-uniform-spatial-ledger',
  retainedSpatialGasSourceBufferRefs = [],
  workerRetainedSpatialGasSourceBufferRefs = [],
  retainedSpatialGasLedgerBufferRefs = [],
  workerRetainedSpatialGasLedgerBufferRefs = []
} = {}) {
  const records = aggregateGasRecordsForSpatialLedger(
    residentProductMass,
    reactionSummary,
    gasPressureSummary?.gasSpeciesLedger,
    gasPressureSummary
  );
  if (records.length === 0) return null;
  const dims = finiteVector3(boxDimsM || gasPressureSummary?.boxDimsM, DEFAULT_BOX_DIMS_M)
    .map((value) => Math.max(value, 1e-9));
  const volumeM3 = dims.reduce((product, value) => product * value, 1);
  const bySpecies = Object.fromEntries(records.map((record) => [
    record.material,
    {
      material: record.material,
      materialId: record.materialId,
      massKg: record.massKg,
      moles: record.moles,
      temperatureK: record.moles > 0 ? record.temperatureMoleK / record.moles : 293.15,
      eventCount: record.eventCount
    }
  ]));
  const retainedSourceRefs = uniqueNonEmptyStrings([
    ...retainedSpatialGasSourceBufferRefs,
    ...workerRetainedSpatialGasSourceBufferRefs
  ]);
  const retainedLedgerRefs = uniqueNonEmptyStrings([
    ...retainedSpatialGasLedgerBufferRefs,
    ...workerRetainedSpatialGasLedgerBufferRefs
  ]);
  return {
    schema: ULG_SPH_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA,
    status: 'spatial-gas-species-ledger-ready',
    source,
    spatialGasLedgerDerivation: 'aggregate-gas-ledger-single-cell-sealed-box',
    spatialGasPositionSource: 'aggregate-gas-ledger-no-positioned-product-events',
    retainedSpatialGasSourceBufferRefs: uniqueNonEmptyStrings(retainedSpatialGasSourceBufferRefs),
    workerRetainedSpatialGasSourceBufferRefs: uniqueNonEmptyStrings(workerRetainedSpatialGasSourceBufferRefs),
    spatialGasSourceBufferRetained: retainedSourceRefs.length > 0,
    retainedSpatialGasLedgerBufferRefs: uniqueNonEmptyStrings(retainedSpatialGasLedgerBufferRefs),
    workerRetainedSpatialGasLedgerBufferRefs: uniqueNonEmptyStrings(workerRetainedSpatialGasLedgerBufferRefs),
    spatialGasLedgerBufferRetained: retainedLedgerRefs.length > 0,
    cellDims: [1, 1, 1],
    cellCount: 1,
    cells: [{
      index: 0,
      gridIndex: [0, 0, 0],
      centerM: dims.map((value) => value * 0.5),
      volumeM3,
      sourceEventCount: records.reduce((sum, record) => sum + record.eventCount, 0),
      sourceRowIndices: [],
      bySpecies
    }],
    sourceEventRowCount: 0,
    sourceAggregateGasRecordCount: records.length,
    pressureClosure: 'ideal-gas-law-single-cell-sealed-box',
    spatialGasSpeciesLedgerValidation: false,
    scientificValidation: false,
    gasValidation: false,
    fullPhysicsValidation: false
  };
}

export function compactSpatialGasRowsFromProductEventRows(productEventRows, {
  productEventRowCount = null,
  productEventStrideFloats = SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  spatialGasSupportVolumeFallbackM3 = 0
} = {}) {
  if (!(productEventRows instanceof Float32Array)) return null;
  const stride = Math.max(1, Math.floor(finiteNumber(productEventStrideFloats, SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS)));
  const rowCount = Math.min(
    Math.floor(productEventRows.length / stride),
    productEventRowCount == null
      ? Math.floor(productEventRows.length / stride)
      : Math.max(0, Math.floor(finiteNumber(productEventRowCount, 0)))
  );
  const compactRows = new Float32Array(rowCount * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS);
  for (let row = 0; row < rowCount; row += 1) {
    const src = row * stride;
    const dst = row * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS;
    const status = productEventRows[src + 18] ?? 0;
    const routing = productEventRows[src + 10] ?? 0;
    const moles = productEventRows[src + 9] ?? 0;
    const sourceSupportVolume = productEventRows[src + 23] ?? 0;
    const supportVolume = sourceSupportVolume > 0
      ? sourceSupportVolume
      : Math.max(0, finiteNumber(spatialGasSupportVolumeFallbackM3, 0));
    const active = status > 0.5 && routing > 0.5 && routing < 1.5 && moles > 0 && supportVolume > 0;
    if (!active) continue;
    compactRows[dst] = productEventRows[src] ?? 0;
    compactRows[dst + 1] = productEventRows[src + 1] ?? 0;
    compactRows[dst + 2] = productEventRows[src + 2] ?? 0;
    compactRows[dst + 3] = productEventRows[src + 4] ?? 0;
    compactRows[dst + 4] = productEventRows[src + 3] ?? 0;
    compactRows[dst + 5] = moles;
    compactRows[dst + 6] = productEventRows[src + 16] ?? 293.15;
    compactRows[dst + 7] = supportVolume;
    compactRows[dst + 8] = productEventRows[src + 5] ?? 0;
    compactRows[dst + 9] = row;
    compactRows[dst + 10] = 1;
    compactRows[dst + 11] = routing;
  }
  return compactRows;
}

const MLS_MPM_WGSL_VARIANT_MANIFESTS = new Map();

export function getSphMlsMpmWgslVariantManifests() {
  return Object.freeze(Object.fromEntries(MLS_MPM_WGSL_VARIANT_MANIFESTS.entries()));
}

function recordWgslVariantManifest(variant) {
  MLS_MPM_WGSL_VARIANT_MANIFESTS.set(`${variant.moduleId}:${variant.variantId}`, Object.freeze({
    schema: variant.schema,
    moduleId: variant.moduleId,
    variantId: variant.variantId,
    activeFragments: variant.activeFragments,
    overriddenSlots: variant.overriddenSlots,
    fingerprint: variant.fingerprint
  }));
  return variant.code;
}

function createActiveGridP2gProjectionWgsl(
  sourceWgsl = mlsMpmP2gGridProjectionWgsl,
  variantId = 'active-grid'
) {
  return recordWgslVariantManifest(composeWgslVariantFromSource({
    moduleId: 'mls-mpm-p2g',
    variantId,
    baseSource: sourceWgsl,
    slots: [
      {
        slot: 'p2g-active-grid-params',
        match: `  schroeder_spatial_pad2: u32,
};`,
        code: `  schroeder_spatial_pad2: u32,
  active_start_i: u32,
  active_start_j: u32,
  active_start_k: u32,
  active_count_i: u32,
  active_count_j: u32,
  active_count_k: u32,
  active_node_count: u32,
  active_pad0: u32,
};`
      },
      {
        slot: 'p2g-active-node-filter',
        match: `fn p2g_node_enabled(i: u32, j: u32, k: u32) -> bool {
  return true;
}`,
        code: `fn p2g_node_enabled(i: u32, j: u32, k: u32) -> bool {
  return i >= params.active_start_i
    && j >= params.active_start_j
    && k >= params.active_start_k
    && i < params.active_start_i + params.active_count_i
    && j < params.active_start_j + params.active_count_j
    && k < params.active_start_k + params.active_count_k;
}`
      },
      {
        slot: 'p2g-active-finalize-index',
        match: `fn p2g_finalize_node_index(global_index: u32) -> u32 {
  if (global_index >= params.grid_node_count) {
    return params.grid_node_count;
  }
  return global_index;
}`,
        code: `fn p2g_finalize_node_index(global_index: u32) -> u32 {
  if (global_index >= params.active_node_count) {
    return params.grid_node_count;
  }
  let active_plane = max(params.active_count_j * params.active_count_k, 1u);
  let active_i = global_index / active_plane;
  let active_rem = global_index - active_i * active_plane;
  let active_j = active_rem / max(params.active_count_k, 1u);
  let active_k = active_rem - active_j * params.active_count_k;
  let i = active_i + params.active_start_i;
  let j = active_j + params.active_start_j;
  let k = active_k + params.active_start_k;
  if (i >= params.grid_nx || j >= params.grid_ny || k >= params.grid_nz) {
    return params.grid_node_count;
  }
  return (i * params.grid_ny + j) * params.grid_nz + k;
}`
      }
    ],
    append: [
      {
        slot: 'p2g-active-clear-accumulators',
        code: `@compute @workgroup_size(64)
fn clear_accumulators(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = p2g_finalize_node_index(global_id.x);
  if (node_index >= params.grid_node_count) {
    return;
  }
  let accumulator_base = node_index * 4u;
  atomicStore(&grid_accumulators[accumulator_base], 0);
  atomicStore(&grid_accumulators[accumulator_base + 1u], 0);
  atomicStore(&grid_accumulators[accumulator_base + 2u], 0);
  atomicStore(&grid_accumulators[accumulator_base + 3u], 0);
}`
      }
    ]
  }));
}

function createActiveGridUpdateWgsl() {
  return recordWgslVariantManifest(composeWgslVariantFromSource({
    moduleId: 'mls-mpm-grid-update',
    variantId: 'active-grid',
    baseSource: mlsMpmGridUpdateWgsl,
    slots: [
      {
        slot: 'grid-update-active-params',
        match: `  wall_barrier_min_gap_m: f32,
};`,
        code: `  wall_barrier_min_gap_m: f32,
  active_start_i: u32,
  active_start_j: u32,
  active_start_k: u32,
  active_count_i: u32,
  active_count_j: u32,
  active_count_k: u32,
  active_node_count: u32,
  active_pad0: u32,
};`
      },
      {
        slot: 'grid-update-active-node-index',
        match: `  let node_index = global_id.x;
  if (node_index >= params.grid_node_count) {
    return;
  }

  let row0 = p2g_grid_nodes[node_index * 2u];`,
        code: `  let active_index = global_id.x;
  if (active_index >= params.active_node_count) {
    return;
  }
  let active_plane = max(params.active_count_j * params.active_count_k, 1u);
  let active_i = active_index / active_plane;
  let active_rem = active_index - active_i * active_plane;
  let active_j = active_rem / max(params.active_count_k, 1u);
  let active_k = active_rem - active_j * params.active_count_k;
  let i = active_i + params.active_start_i;
  let j = active_j + params.active_start_j;
  let k = active_k + params.active_start_k;
  if (i >= params.grid_nx || j >= params.grid_ny || k >= params.grid_nz) {
    return;
  }
  let node_index = (i * params.grid_ny + j) * params.grid_nz + k;

  let row0 = p2g_grid_nodes[node_index * 2u];`
      }
    ]
  }));
}

function createCompactMechanicsP2gProjectionWgsl(
  sourceWgsl,
  variantId = 'compact-mechanics'
) {
  const rejectedFlags = SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_FAIL_CLOSED
    | SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_INVALID_SOURCE
    | SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_CAPACITY_OVERFLOW;
  return recordWgslVariantManifest(composeWgslVariantFromSource({
    moduleId: 'mls-mpm-p2g',
    variantId,
    baseSource: sourceWgsl,
    slots: [
      {
        slot: 'compact-mechanics-immutable-authority-binding',
        match: '@group(0) @binding(7) var<storage, read_write> schroeder_spatial_authority_evidence: array<atomic<u32>>;',
        code: '@group(0) @binding(7) var<storage, read> schroeder_spatial_authority_evidence: array<u32>;'
      },
      {
        slot: 'compact-mechanics-owned-rejection-evidence',
        kind: 'range',
        start: 'fn p2g_spatial_evidence_add(word: u32, value: u32) {',
        end: '\nfn p2g_authenticate_spatial_header',
        code: `fn p2g_spatial_evidence_add(word: u32, value: u32) {
  let evidence_word = compact_mechanics_evidence_word(word);
  if (params.schroeder_spatial_evidence_enabled != 0u
      && evidence_word < arrayLength(&grid_accumulators)) {
    atomicAdd(&grid_accumulators[evidence_word], bitcast<i32>(value));
  }
}

fn compact_mechanics_evidence_word(word: u32) -> u32 {
  return params.grid_node_count * 4u + word;
}

fn compact_mechanics_view_reject() {
  let rejection_word = compact_mechanics_evidence_word(14u);
  if (rejection_word < arrayLength(&grid_accumulators)) {
    atomicStore(&grid_accumulators[rejection_word], 1);
  }
}

fn p2g_spatial_reject(word: u32) {
  compact_mechanics_view_reject();
}

fn p2g_spatial_authority_rejected() -> bool {
  let rejection_word = compact_mechanics_evidence_word(14u);
  let structural_rejection_word = compact_mechanics_evidence_word(15u);
  return structural_rejection_word >= arrayLength(&grid_accumulators)
    || atomicLoad(&grid_accumulators[rejection_word]) != 0
    || atomicLoad(&grid_accumulators[structural_rejection_word]) != 0;
}

fn p2g_spatial_evidence_identity(particle_index: u32) {
  if (params.schroeder_spatial_evidence_enabled == 0u || particle_index != 0u) {
    return;
  }
  atomicStore(
    &grid_accumulators[compact_mechanics_evidence_word(4u)],
    bitcast<i32>(0x4d534131u)
  );
  atomicStore(
    &grid_accumulators[compact_mechanics_evidence_word(5u)],
    bitcast<i32>(params.schroeder_spatial_generation_id)
  );
}
`
      },
      {
        slot: 'compact-mechanics-p2g-preflight-gate',
        match: `fn p2g_particle_enabled(particle_index: u32) -> bool {
  p2g_authenticate_spatial_header(particle_index);`,
        code: `fn p2g_particle_enabled(particle_index: u32) -> bool {
  if (p2g_spatial_authority_rejected()) {
    return false;
  }
  p2g_authenticate_spatial_header(particle_index);
  if (p2g_spatial_authority_rejected()) {
    return false;
  }`
      },
      {
        slot: 'compact-mechanics-p2g-node-index-mapping',
        match: `fn p2g_finalize_node_index(global_index: u32) -> u32 {
  if (global_index >= params.grid_node_count) {
    return params.grid_node_count;
  }
  return global_index;
}`,
        code: `fn p2g_finalize_node_index(global_index: u32) -> u32 {
  let bound_words = arrayLength(&schroeder_spatial_authority_evidence);
  if (bound_words <= 53u) {
    return params.grid_node_count;
  }
  let node_count = schroeder_spatial_authority_evidence[46u];
  let node_offset_words = schroeder_spatial_authority_evidence[53u];
  if (
    global_index >= node_count
    || node_offset_words > bound_words
    || node_count > bound_words - node_offset_words
  ) {
    return params.grid_node_count;
  }
  let node_index =
    schroeder_spatial_authority_evidence[node_offset_words + global_index];
  return select(node_index, params.grid_node_count, node_index >= params.grid_node_count);
}`
      }
    ],
    append: [
      {
        slot: 'compact-mechanics-preflight-and-clear',
        code: `fn compact_mechanics_view_word(index: u32) -> u32 {
  return schroeder_spatial_authority_evidence[index];
}

@compute @workgroup_size(1)
fn preflight_compact_mechanics_view() {
  let bound_words = arrayLength(&schroeder_spatial_authority_evidence);
  let minimum_words = ${SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS}u;
  if (bound_words < minimum_words) {
    compact_mechanics_view_reject();
    return;
  }
  let flags = compact_mechanics_view_word(22u);
  let rejected_flags = ${rejectedFlags}u;
  if (
    params.resident_product_event_count != 0u
    || !p2g_spatial_directory_admitted()
    || !p2g_canonical_query_geometry_admitted()
  ) {
    compact_mechanics_view_reject();
    return;
  }
  if (compact_mechanics_view_word(20u) != ${SCHROEDER_SPATIAL_MECHANICS_VIEW_MAGIC}u
    || compact_mechanics_view_word(21u) != ${SCHROEDER_SPATIAL_MECHANICS_VIEW_VERSION}u) {
    compact_mechanics_view_reject();
    return;
  }
  if (flags != ${SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_READY | SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_ADMITTED}u
    || (flags & rejected_flags) != 0u) {
    compact_mechanics_view_reject();
  }
}

fn compact_mechanics_view_preflight_continue() -> bool {
  if (p2g_spatial_authority_rejected()) {
    return false;
  }
  if (arrayLength(&schroeder_spatial_authority_evidence)
    < ${SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS}u) {
    compact_mechanics_view_reject();
    return false;
  }
  return true;
}

@compute @workgroup_size(1)
fn preflight_compact_mechanics_owner_identity() {
  if (!compact_mechanics_view_preflight_continue()) {
    return;
  }
  if (
    compact_mechanics_view_word(23u) != params.schroeder_spatial_generation_id
    || compact_mechanics_view_word(24u) != params.schroeder_spatial_device_ordinal
    || compact_mechanics_view_word(25u) != params.schroeder_spatial_lane_ordinal
    || compact_mechanics_view_word(26u) != params.schroeder_spatial_lease_token
  ) {
    compact_mechanics_view_reject();
    return;
  }
  if (
    compact_mechanics_view_word(27u) != params.schroeder_spatial_source_family_id
    || compact_mechanics_view_word(28u) != params.schroeder_spatial_storage_generation
    || compact_mechanics_view_word(29u) != params.schroeder_spatial_physics_tick
    || compact_mechanics_view_word(30u) != params.schroeder_spatial_physics_substep
  ) {
    compact_mechanics_view_reject();
    return;
  }
}

@compute @workgroup_size(1)
fn preflight_compact_mechanics_epoch_identity() {
  if (!compact_mechanics_view_preflight_continue()) {
    return;
  }
  if (
    compact_mechanics_view_word(31u) != params.schroeder_spatial_position_epoch
    || compact_mechanics_view_word(32u) != params.schroeder_spatial_topology_epoch
    || compact_mechanics_view_word(33u) != params.schroeder_spatial_chart_epoch
    || compact_mechanics_view_word(34u) != params.schroeder_spatial_level_epoch
    || compact_mechanics_view_word(35u) != params.schroeder_spatial_support_epoch
  ) {
    compact_mechanics_view_reject();
    return;
  }
  if (
    compact_mechanics_view_word(36u) != params.particle_count
    || compact_mechanics_view_word(37u) != bitcast<u32>(params.schroeder_selected_level)
    || compact_mechanics_view_word(52u) != params.schroeder_spatial_pad2
    || schroeder_spatial_directory[33u] != params.schroeder_spatial_pad2
  ) {
    compact_mechanics_view_reject();
    return;
  }
}

@compute @workgroup_size(1)
fn preflight_compact_mechanics_grid_geometry() {
  if (!compact_mechanics_view_preflight_continue()) {
    return;
  }
  if (params.grid_nx == 0u || params.grid_ny == 0u || params.grid_nz == 0u) {
    compact_mechanics_view_reject();
    return;
  }
  let occupancy_word_count = params.grid_node_count / 32u
    + select(0u, 1u, params.grid_node_count % 32u != 0u);
  let node_count = compact_mechanics_view_word(46u);
  if (
    compact_mechanics_view_word(38u) != params.grid_node_count
    || compact_mechanics_view_word(39u) != params.grid_nx
    || compact_mechanics_view_word(40u) != params.grid_ny
    || compact_mechanics_view_word(41u) != params.grid_nz
    || compact_mechanics_view_word(42u) != params.shift
    || compact_mechanics_view_word(43u) != bitcast<u32>(params.grid_spacing_m)
    || compact_mechanics_view_word(44u) != occupancy_word_count
    || compact_mechanics_view_word(45u) != params.grid_node_count
    || node_count > params.grid_node_count
  ) {
    compact_mechanics_view_reject();
    return;
  }
}

@compute @workgroup_size(1)
fn preflight_compact_mechanics_topology_counts() {
  if (!compact_mechanics_view_preflight_continue()) {
    return;
  }
  let bound_words = arrayLength(&schroeder_spatial_authority_evidence);
  let node_count = compact_mechanics_view_word(46u);
  let selected_source_count = compact_mechanics_view_word(50u);
  let stencil_visit_count = compact_mechanics_view_word(51u);
  if (
    compact_mechanics_view_word(47u) != 0u
    || compact_mechanics_view_word(48u) != 0u
    || compact_mechanics_view_word(49u) != params.particle_count
    || selected_source_count > params.particle_count
    || selected_source_count > 0xffffffffu / 27u
  ) {
    compact_mechanics_view_reject();
    return;
  }
  if (
    stencil_visit_count > selected_source_count * 27u
    || node_count > stencil_visit_count
  ) {
    compact_mechanics_view_reject();
    return;
  }
  let node_offset_words = compact_mechanics_view_word(53u);
  let required_words = compact_mechanics_view_word(54u);
  let capacity_words = compact_mechanics_view_word(55u);
  if (params.grid_node_count > 0xffffffffu - node_offset_words
    || node_count > 0xffffffffu - node_offset_words) {
    compact_mechanics_view_reject();
    return;
  }
  if (
    node_offset_words != ${SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS}u
    || required_words != node_offset_words + node_count
    || capacity_words != node_offset_words + params.grid_node_count
    || capacity_words > bound_words
  ) {
    compact_mechanics_view_reject();
    return;
  }
  let source_row_layout_id = compact_mechanics_view_word(56u);
  if (
    source_row_layout_id != params.schroeder_spatial_pad1
    || (source_row_layout_id != ${SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0}u
      && source_row_layout_id != ${SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0}u)
  ) {
    compact_mechanics_view_reject();
    return;
  }
}

@compute @workgroup_size(1)
fn preflight_compact_mechanics_dispatch() {
  if (!compact_mechanics_view_preflight_continue()) {
    return;
  }
  let node_count = compact_mechanics_view_word(46u);
  let occupancy_word_count = params.grid_node_count / 32u
    + select(0u, 1u, params.grid_node_count % 32u != 0u);
  let expected_dispatch_x = node_count / 64u
    + select(0u, 1u, node_count % 64u != 0u);
  let expected_dispatch_yz = select(0u, 1u, node_count > 0u);
  if (
    compact_mechanics_view_word(57u) != expected_dispatch_x
    || compact_mechanics_view_word(58u)
      != ${SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS}u + occupancy_word_count
    || compact_mechanics_view_word(59u) != params.schroeder_spatial_generation_id
  ) {
    compact_mechanics_view_reject();
    return;
  }
  if (
    compact_mechanics_view_word(${SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS}u)
      != expected_dispatch_x
    || compact_mechanics_view_word(${SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS + 1}u)
      != expected_dispatch_yz
    || compact_mechanics_view_word(${SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS + 2}u)
      != expected_dispatch_yz
  ) {
    compact_mechanics_view_reject();
    return;
  }
}

@compute @workgroup_size(64)
fn validate_compact_mechanics_nodes(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (p2g_spatial_authority_rejected()) {
    return;
  }
  let compact_index = global_id.x;
  let bound_words = arrayLength(&schroeder_spatial_authority_evidence);
  if (bound_words <= 53u) {
    compact_mechanics_view_reject();
    return;
  }
  let node_count = compact_mechanics_view_word(46u);
  let node_offset_words = compact_mechanics_view_word(53u);
  if (compact_index >= node_count) {
    return;
  }
  if (
    node_offset_words > bound_words
    || node_count > bound_words - node_offset_words
  ) {
    compact_mechanics_view_reject();
    return;
  }
  let node_index = compact_mechanics_view_word(node_offset_words + compact_index);
  var ordered = node_index < params.grid_node_count;
  if (compact_index > 0u) {
    let previous_node = compact_mechanics_view_word(
      node_offset_words + compact_index - 1u
    );
    ordered = ordered && previous_node < node_index;
  }
  if (!ordered) {
    compact_mechanics_view_reject();
  }
}

@compute @workgroup_size(64)
fn clear_accumulators(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = p2g_finalize_node_index(global_id.x);
  if (node_index >= params.grid_node_count) {
    return;
  }
  let accumulator_base = node_index * 4u;
  atomicStore(&grid_accumulators[accumulator_base], 0);
  atomicStore(&grid_accumulators[accumulator_base + 1u], 0);
  atomicStore(&grid_accumulators[accumulator_base + 2u], 0);
  atomicStore(&grid_accumulators[accumulator_base + 3u], 0);
}
`
      }
    ]
  }));
}

function createCompactMechanicsGridUpdateWgsl() {
  return recordWgslVariantManifest(composeWgslVariantFromSource({
    moduleId: 'mls-mpm-grid-update',
    variantId: 'compact-mechanics',
    baseSource: mlsMpmGridUpdateWgsl,
    slots: [
      {
        slot: 'compact-mechanics-grid-update-view-binding',
        match: '@group(0) @binding(3) var<storage, read> pressure_force_rows: array<vec4<f32>>;',
        code: `@group(0) @binding(3) var<storage, read> pressure_force_rows: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> compact_mechanics_view: array<u32>;`
      },
      {
        slot: 'compact-mechanics-grid-update-node-index',
        match: `  let node_index = global_id.x;
  if (node_index >= params.grid_node_count) {
    return;
  }

  let row0 = p2g_grid_nodes[node_index * 2u];`,
        code: `  let compact_index = global_id.x;
  if (arrayLength(&compact_mechanics_view) <= 53u) {
    return;
  }
  let node_count = compact_mechanics_view[46u];
  let node_offset_words = compact_mechanics_view[53u];
  if (
    compact_index >= node_count
    || node_offset_words > arrayLength(&compact_mechanics_view)
    || node_count > arrayLength(&compact_mechanics_view) - node_offset_words
  ) {
    return;
  }
  let node_index = compact_mechanics_view[node_offset_words + compact_index];
  if (node_index >= params.grid_node_count) {
    return;
  }

  let row0 = p2g_grid_nodes[node_index * 2u];`
      }
    ]
  }));
}

function createMechanicsFieldP2gProjectionWgsl(
  sourceWgsl,
  variantId = 'mechanics-field'
) {
  const rejectedFlags = SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_CAPACITY_OVERFLOW;
  return recordWgslVariantManifest(composeWgslVariantFromSource({
    moduleId: 'mls-mpm-p2g',
    variantId,
    baseSource: sourceWgsl,
    slots: [
      {
        slot: 'mechanics-field-mutation-params',
        match: `  schroeder_spatial_pad2: u32,
};`,
        code: `  schroeder_spatial_pad2: u32,
  mechanics_field_expected_mutation_ordinal: u32,
  mechanics_field_output_mutation_ordinal: u32,
  mechanics_field_expected_state_encoding: u32,
  pressure_required_consumer_mask: u32,
};`
      },
      {
        slot: 'mechanics-field-deterministic-reduction-bindings',
        match: `@group(0) @binding(5) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> grid_nodes: array<vec4<f32>>;`,
        code: `// Product events are forbidden in mechanics-field mode. Reuse their
// binding for particle-major, non-atomic P2G contribution records and the
// superseded dense-grid output binding for the field builder's retained
// stable candidate order.
@group(0) @binding(5) var<storage, read_write> product_events: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> p2g_field_sorted_candidate_indices: array<u32>;`
      },
      {
        slot: 'mechanics-field-owned-rejection-evidence',
        kind: 'range',
        start: 'fn p2g_spatial_evidence_add(word: u32, value: u32) {',
        end: '\nfn p2g_authenticate_spatial_header',
        code: `fn p2g_spatial_evidence_add(word: u32, value: u32) {
  // The producer-owned mechanics field view is immutable to evidence counters.
}

fn compact_mechanics_rejection_word() -> u32 {
  return 2u;
}

fn compact_mechanics_view_reject() {
  if (arrayLength(&grid_accumulators)
      >= ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u) {
    atomicOr(
      &grid_accumulators[2u],
      bitcast<i32>(${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
        | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE}u)
    );
    atomicStore(&grid_accumulators[34u], 0);
    atomicStore(&grid_accumulators[44u], 0);
    atomicStore(&grid_accumulators[45u], 0);
    atomicStore(&grid_accumulators[46u], 0);
    atomicStore(
      &grid_accumulators[
        ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS}u
      ],
      0
    );
    atomicStore(
      &grid_accumulators[
        ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS + 1}u
      ],
      0
    );
    atomicStore(
      &grid_accumulators[
        ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS + 2}u
      ],
      0
    );
  }
}

fn p2g_spatial_reject(word: u32) {
  compact_mechanics_view_reject();
}

fn p2g_spatial_authority_rejected() -> bool {
  if (arrayLength(&grid_accumulators)
      < ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u) {
    return true;
  }
  let status = bitcast<u32>(atomicLoad(&grid_accumulators[2u]));
  return (status & ${rejectedFlags}u) != 0u;
}

fn p2g_spatial_evidence_identity(particle_index: u32) {
  // The borrowed mechanics-view header is immutable to every consumer.
}
`
      },
      {
        slot: 'mechanics-field-p2g-accumulator-helpers',
        match: `fn p2g_atomic_add(node_index: u32, mass: f32, momentum: vec3<f32>) {
  let base = node_index * 4u;
  atomicAdd(&grid_accumulators[base], p2g_quantize(mass));
  atomicAdd(&grid_accumulators[base + 1u], p2g_quantize(momentum.x));
  atomicAdd(&grid_accumulators[base + 2u], p2g_quantize(momentum.y));
  atomicAdd(&grid_accumulators[base + 3u], p2g_quantize(momentum.z));
}`,
        code: `fn p2g_atomic_add(node_index: u32, mass: f32, momentum: vec3<f32>) {
  // Product-event mechanics is forbidden by the compact-field preflight.
  // Keep this legacy function only so the unused product-event entry point
  // remains a valid WGSL module; it is never dispatched in field mode.
}

const P2G_FIELD_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC}u;
const P2G_FIELD_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION}u;
const P2G_FIELD_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED
}u;
const P2G_FIELD_REJECTED_FLAGS: u32 = ${rejectedFlags}u;
const P2G_FIELD_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u;
const P2G_FIELD_DESCRIPTOR_WORDS: u32 = 32u;
const P2G_FIELD_KEY_WORDS: u32 = 4u;
const P2G_FIELD_ACCUMULATOR_WORDS: u32 = 8u;
const P2G_FIELD_RECEIPT_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS}u;
const P2G_FIELD_STATE_WORDS: u32 = 8u;
const P2G_FIELD_PRESSURE_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS}u;
const P2G_FIELD_STENCIL_SIZE: u32 = 27u;
const P2G_FIELD_WORKGROUP_SIZE: u32 = 64u;
const P2G_FIELD_CONTRIBUTION_ROWS: u32 = 3u;
const P2G_FIELD_INVALID_INDEX: u32 = 0xffffffffu;
const P2G_FIELD_RECEIPT_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC}u;
const P2G_FIELD_RECEIPT_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION}u;
const P2G_FIELD_RECEIPT_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED
}u;
const P2G_FIELD_RECEIPT_PHASE_EMPTY: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_EMPTY}u;
const P2G_FIELD_RECEIPT_PHASE_P2G_FINALIZED: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_P2G_FINALIZED}u;
const P2G_FIELD_RECEIPT_PHASE_CONSUMED: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_CONSUMED}u;
const P2G_PRESSURE_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC}u;
const P2G_PRESSURE_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION}u;
const P2G_PRESSURE_LAW_EXACT: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_LAW_EXACT_P2G}u;
const P2G_PRESSURE_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_ADMITTED
}u;
const P2G_PRESSURE_FAIL_CLOSED: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_FAIL_CLOSED}u;
const P2G_PRESSURE_CONSUMER_LOCAL: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL}u;
const P2G_PRESSURE_CONSUMER_CROSS_LEVEL: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_CROSS_LEVEL}u;

fn p2g_field_word(index: u32) -> u32 {
  return bitcast<u32>(atomicLoad(&grid_accumulators[index]));
}

fn p2g_field_store_word(index: u32, value: u32) {
  atomicStore(&grid_accumulators[index], bitcast<i32>(value));
}

fn p2g_field_dispatch_shape_admitted() -> bool {
  let field_count = p2g_field_word(34u);
  let group_count = field_count / P2G_FIELD_WORKGROUP_SIZE
    + select(
      0u,
      1u,
      field_count % P2G_FIELD_WORKGROUP_SIZE != 0u
    );
  let dispatch_x = p2g_field_word(
    ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS}u
  );
  let dispatch_y = p2g_field_word(
    ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS + 1}u
  );
  let dispatch_z = p2g_field_word(
    ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS + 2}u
  );
  if (field_count == 0u) {
    return dispatch_x == 0u
      && dispatch_y == 0u
      && dispatch_z == 0u
      && p2g_field_word(44u) == 0u
      && p2g_field_word(45u) == 0u
      && p2g_field_word(46u) == 0u;
  }
  if (
    dispatch_x == 0u
    || dispatch_x > group_count
    || dispatch_y == 0u
    || dispatch_z != 1u
  ) {
    return false;
  }
  let expected_y = group_count / dispatch_x
    + select(0u, 1u, group_count % dispatch_x != 0u);
  return dispatch_y == expected_y
    && p2g_field_word(44u) == dispatch_x
    && p2g_field_word(45u) == dispatch_y
    && p2g_field_word(46u) == dispatch_z;
}

fn p2g_field_linear_invocation(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>
) -> u32 {
  let dispatch_x = p2g_field_word(
    ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS}u
  );
  let linear_group =
    workgroup_id.x + workgroup_id.y * dispatch_x;
  return linear_group * P2G_FIELD_WORKGROUP_SIZE + local_id.x;
}

fn p2g_field_receipt_offset() -> u32 {
  return p2g_field_word(30u) - P2G_FIELD_RECEIPT_WORDS;
}

fn p2g_field_pressure_offset() -> u32 {
  return p2g_field_word(30u)
    + p2g_field_word(32u) * P2G_FIELD_STATE_WORDS;
}

fn p2g_pressure_receipt_seal(
  field_count: u32,
  source_mutation_ordinal: u32,
  required_mask: u32
) -> u32 {
  return P2G_PRESSURE_MAGIC
    ^ P2G_PRESSURE_VERSION
    ^ P2G_PRESSURE_READY_ADMITTED
    ^ P2G_PRESSURE_LAW_EXACT
    ^ bitcast<u32>(params.ambient_pressure_pa)
    ^ bitcast<u32>(params.internal_pressure_scale)
    ^ field_count
    ^ source_mutation_ordinal
    ^ required_mask
    ^ p2g_field_word(3u)
    ^ p2g_field_word(8u)
    ^ p2g_field_word(9u)
    ^ p2g_field_word(10u)
    ^ p2g_field_word(38u);
}

fn p2g_field_receipt_reusable() -> bool {
  let offset = p2g_field_receipt_offset();
  let magic = p2g_field_word(offset);
  if (magic == 0u) {
    return p2g_field_word(offset + 3u) == P2G_FIELD_RECEIPT_PHASE_EMPTY;
  }
  return magic == P2G_FIELD_RECEIPT_MAGIC
    && p2g_field_word(offset + 1u) == P2G_FIELD_RECEIPT_VERSION
    && p2g_field_word(offset + 2u) == P2G_FIELD_RECEIPT_READY_ADMITTED
    && p2g_field_word(offset + 3u) == P2G_FIELD_RECEIPT_PHASE_CONSUMED;
}

fn p2g_field_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn p2g_field_reject() {
  if (arrayLength(&grid_accumulators) >= P2G_FIELD_HEADER_WORDS) {
    let state_offset = p2g_field_word(30u);
    atomicOr(
      &grid_accumulators[2u],
      bitcast<i32>(${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
        | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE}u)
    );
    p2g_field_store_word(34u, 0u);
    p2g_field_store_word(44u, 0u);
    p2g_field_store_word(45u, 0u);
    p2g_field_store_word(46u, 0u);
    p2g_field_store_word(${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS}u, 0u);
    p2g_field_store_word(${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS + 1}u, 0u);
    p2g_field_store_word(${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS + 2}u, 0u);
    p2g_field_store_word(59u, ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY}u);
    if (state_offset >= P2G_FIELD_RECEIPT_WORDS
        && state_offset <= arrayLength(&grid_accumulators)) {
      let receipt = state_offset - P2G_FIELD_RECEIPT_WORDS;
      p2g_field_store_word(receipt + 26u, P2G_PRESSURE_FAIL_CLOSED);
    }
  }
  compact_mechanics_view_reject();
}

fn p2g_field_view_structurally_admitted() -> bool {
  let bound_words = arrayLength(&grid_accumulators);
  if (bound_words < P2G_FIELD_HEADER_WORDS) { return false; }
  let flags = p2g_field_word(2u);
  let descriptor_offset = p2g_field_word(24u);
  let key_offset = p2g_field_word(26u);
  let accumulator_offset = p2g_field_word(28u);
  let state_offset = p2g_field_word(30u);
  let field_capacity = p2g_field_word(32u);
  let field_count = p2g_field_word(34u);
  let capacity_words = p2g_field_word(42u);
  let pressure_offset = state_offset
    + field_capacity * P2G_FIELD_STATE_WORDS;
  return p2g_field_word(0u) == P2G_FIELD_MAGIC
    && p2g_field_word(1u) == P2G_FIELD_VERSION
    && flags == P2G_FIELD_READY_ADMITTED
    && (flags & P2G_FIELD_REJECTED_FLAGS) == 0u
    && p2g_field_word(3u) == params.schroeder_spatial_generation_id
    && p2g_field_word(4u) == params.schroeder_spatial_device_ordinal
    && p2g_field_word(5u) == params.schroeder_spatial_lane_ordinal
    && p2g_field_word(6u) == params.schroeder_spatial_lease_token
    && p2g_field_word(7u) == params.schroeder_spatial_source_family_id
    && p2g_field_word(8u) == params.schroeder_spatial_storage_generation
    && p2g_field_word(9u) == params.schroeder_spatial_physics_tick
    && p2g_field_word(10u) == params.schroeder_spatial_physics_substep
    && p2g_field_word(11u) == params.schroeder_spatial_position_epoch
    && p2g_field_word(12u) == params.schroeder_spatial_topology_epoch
    && p2g_field_word(13u) == params.schroeder_spatial_chart_epoch
    && p2g_field_word(14u) == params.schroeder_spatial_level_epoch
    && p2g_field_word(15u) == params.schroeder_spatial_support_epoch
    && p2g_field_word(16u) == params.particle_count
    && bitcast<i32>(p2g_field_word(17u)) == params.schroeder_selected_level
    && p2g_field_word(18u) == params.grid_node_count
    && p2g_field_word(19u) == params.grid_nx
    && p2g_field_word(20u) == params.grid_ny
    && p2g_field_word(21u) == params.grid_nz
    && p2g_field_word(22u) == params.shift
    && p2g_field_word(23u) == bitcast<u32>(params.grid_spacing_m)
    && descriptor_offset == P2G_FIELD_HEADER_WORDS
    && p2g_field_word(25u) == P2G_FIELD_DESCRIPTOR_WORDS
    && p2g_field_word(27u) == P2G_FIELD_KEY_WORDS
    && p2g_field_word(29u) == P2G_FIELD_ACCUMULATOR_WORDS
    && p2g_field_word(31u) == P2G_FIELD_STATE_WORDS
    && p2g_field_word(33u) % P2G_FIELD_STENCIL_SIZE == 0u
    && p2g_field_word(33u) / P2G_FIELD_STENCIL_SIZE == params.particle_count
    && p2g_field_word(33u) < P2G_FIELD_INVALID_INDEX
    && p2g_field_word(33u) <= arrayLength(&p2g_field_sorted_candidate_indices)
    && p2g_field_word(33u)
      <= arrayLength(&product_events) / P2G_FIELD_CONTRIBUTION_ROWS
    && field_count <= field_capacity
    && p2g_field_word(41u)
      == pressure_offset + field_count * P2G_FIELD_PRESSURE_WORDS
    && descriptor_offset <= key_offset
    && key_offset <= accumulator_offset
    && accumulator_offset <= state_offset
    && state_offset >= P2G_FIELD_RECEIPT_WORDS
    && state_offset == accumulator_offset
      + field_capacity * P2G_FIELD_ACCUMULATOR_WORDS
      + P2G_FIELD_RECEIPT_WORDS
    && capacity_words <= bound_words
    && state_offset <= capacity_words
    && field_capacity
      <= (capacity_words - state_offset) / P2G_FIELD_STATE_WORDS
    && pressure_offset >= state_offset
    && pressure_offset <= capacity_words
    && field_capacity
      <= (capacity_words - pressure_offset) / P2G_FIELD_PRESSURE_WORDS
    && capacity_words
      == pressure_offset + field_capacity * P2G_FIELD_PRESSURE_WORDS
    && p2g_field_dispatch_shape_admitted();
}

fn p2g_field_mutation_current() -> bool {
  return p2g_field_word(63u) == params.mechanics_field_output_mutation_ordinal;
}

fn p2g_field_view_admitted() -> bool {
  return p2g_field_view_structurally_admitted()
    && p2g_field_mutation_current()
    && !p2g_spatial_authority_rejected();
}

fn p2g_field_descriptor(particle_index: u32) -> vec4<u32> {
  let base = p2g_field_word(24u) + particle_index * P2G_FIELD_DESCRIPTOR_WORDS;
  return vec4<u32>(
    p2g_field_word(base),
    p2g_field_word(base + 1u),
    p2g_field_word(base + 2u),
    p2g_field_word(base + 3u)
  );
}

fn p2g_field_key_compare(field_index: u32, key: vec4<u32>) -> i32 {
  let base = p2g_field_word(26u) + field_index * P2G_FIELD_KEY_WORDS;
  for (var word = 0u; word < P2G_FIELD_KEY_WORDS; word = word + 1u) {
    let candidate = p2g_field_word(base + word);
    if (candidate < key[word]) { return -1; }
    if (candidate > key[word]) { return 1; }
  }
  return 0;
}

fn p2g_field_find(
  particle_index: u32,
  stencil_ordinal: u32,
  node_index: u32
) -> u32 {
  if (p2g_spatial_authority_rejected()) { return P2G_FIELD_INVALID_INDEX; }
  if (stencil_ordinal >= 27u) { return P2G_FIELD_INVALID_INDEX; }
  let descriptor = p2g_field_descriptor(particle_index);
  if (descriptor.w != 1u) { return P2G_FIELD_INVALID_INDEX; }
  let descriptor_base = p2g_field_word(24u)
    + particle_index * P2G_FIELD_DESCRIPTOR_WORDS;
  let field_index = p2g_field_word(descriptor_base + 4u + stencil_ordinal);
  if (field_index >= p2g_field_word(34u)) {
    return P2G_FIELD_INVALID_INDEX;
  }
  let key = vec4<u32>(node_index, descriptor.x, descriptor.y, descriptor.z);
  return select(
    P2G_FIELD_INVALID_INDEX,
    field_index,
    p2g_field_key_compare(field_index, key) == 0
  );
}

fn p2g_field_clear_particle_contributions(particle_index: u32) {
  let candidate_count = p2g_field_word(33u);
  let first_candidate = particle_index * P2G_FIELD_STENCIL_SIZE;
  if (first_candidate > candidate_count
      || P2G_FIELD_STENCIL_SIZE > candidate_count - first_candidate) {
    p2g_field_reject();
    return;
  }
  for (var stencil_ordinal = 0u;
      stencil_ordinal < P2G_FIELD_STENCIL_SIZE;
      stencil_ordinal = stencil_ordinal + 1u) {
    let candidate_index = first_candidate + stencil_ordinal;
    let row = candidate_index * P2G_FIELD_CONTRIBUTION_ROWS;
    if (row + 2u >= arrayLength(&product_events)) {
      p2g_field_reject();
      return;
    }
    // Row 2.w is an exact normal-f32 publish marker. Clearing that row makes
    // every stale payload row unobservable without a full buffer clear pass.
    product_events[row + 2u] = vec4<f32>(0.0);
  }
}

fn p2g_field_store_contribution(
  particle_index: u32,
  stencil_ordinal: u32,
  node_index: u32,
  mass: f32,
  momentum: vec3<f32>,
  mass_gradient: vec3<f32>,
  represented_volume_m3: f32,
  pressure_volume_moment_pa_m3: f32
) {
  let field_index = p2g_field_find(particle_index, stencil_ordinal, node_index);
  if (field_index == P2G_FIELD_INVALID_INDEX) {
    p2g_field_reject();
    return;
  }
  if (!p2g_field_finite(mass) || mass < 0.0
      || !all(vec3<bool>(
        p2g_field_finite(momentum.x),
        p2g_field_finite(momentum.y),
        p2g_field_finite(momentum.z)
      ))
      || !all(vec3<bool>(
        p2g_field_finite(mass_gradient.x),
        p2g_field_finite(mass_gradient.y),
        p2g_field_finite(mass_gradient.z)
      ))
      || !(represented_volume_m3 > 0.0)
      || !p2g_field_finite(represented_volume_m3)
      || !(pressure_volume_moment_pa_m3 >= 0.0)
      || !p2g_field_finite(pressure_volume_moment_pa_m3)) {
    p2g_field_reject();
    return;
  }
  let candidate_index = particle_index * P2G_FIELD_STENCIL_SIZE
    + stencil_ordinal;
  let row = candidate_index * P2G_FIELD_CONTRIBUTION_ROWS;
  if (candidate_index >= p2g_field_word(33u)
      || candidate_index == P2G_FIELD_INVALID_INDEX
      || row + 2u >= arrayLength(&product_events)) {
    p2g_field_reject();
    return;
  }
  product_events[row] = vec4<f32>(mass, momentum);
  product_events[row + 1u] = vec4<f32>(mass_gradient, 0.0);
  // Publish last so a stale or torn three-row record is never observable.
  product_events[row + 2u] = vec4<f32>(
    represented_volume_m3,
    pressure_volume_moment_pa_m3,
    0.0,
    1.0
  );
}

fn p2g_field_group_at_sorted_position(sorted_position: u32) -> u32 {
  let candidate_count = p2g_field_word(33u);
  if (sorted_position >= candidate_count
      || sorted_position >= arrayLength(&p2g_field_sorted_candidate_indices)) {
    return P2G_FIELD_INVALID_INDEX;
  }
  let candidate_index = p2g_field_sorted_candidate_indices[sorted_position];
  if (candidate_index >= candidate_count) {
    return P2G_FIELD_INVALID_INDEX;
  }
  let particle_index = candidate_index / P2G_FIELD_STENCIL_SIZE;
  let stencil_ordinal = candidate_index
    - particle_index * P2G_FIELD_STENCIL_SIZE;
  if (particle_index >= params.particle_count
      || stencil_ordinal >= P2G_FIELD_STENCIL_SIZE) {
    return P2G_FIELD_INVALID_INDEX;
  }
  let descriptor_base = p2g_field_word(24u)
    + particle_index * P2G_FIELD_DESCRIPTOR_WORDS;
  return p2g_field_word(descriptor_base + 4u + stencil_ordinal);
}

fn p2g_field_group_lower_bound(field_index: u32) -> u32 {
  var lower = 0u;
  var upper = p2g_field_word(33u);
  loop {
    if (lower >= upper) { break; }
    let middle = lower + (upper - lower) / 2u;
    let group = p2g_field_group_at_sorted_position(middle);
    if (group < field_index) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
  }
  return lower;
}

fn p2g_weight_derivative_at(weights_coordinate: f32, offset: i32) -> f32 {
  if (offset == 0) { return weights_coordinate - 1.5; }
  if (offset == 1) { return 2.0 * (1.0 - weights_coordinate); }
  if (offset == 2) { return weights_coordinate - 0.5; }
  return 0.0;
}`
      },
      {
        slot: 'mechanics-field-p2g-admission-gate',
        match: `  if (!p2g_particle_enabled(particle_index)) {
    return;
  }

  let state_base = particle_index * 2u;`,
        code: `  p2g_field_clear_particle_contributions(particle_index);
  if (!p2g_particle_enabled(particle_index)) {
    return;
  }
  if (!p2g_field_mutation_current()) {
    return;
  }
  if (!p2g_field_view_admitted()) {
    p2g_field_reject();
    return;
  }

  let state_base = particle_index * 2u;`
      },
      {
        slot: 'mechanics-field-p2g-particle-deposit',
        match: `        p2g_atomic_add(node_index, weight * pos_mass.w, weight * particle_momentum);`,
        code: `        let weight_gradient = params.inv_grid_spacing_m * vec3<f32>(
          p2g_weight_derivative_at(p_grid.x - f32(base_x), ox)
            * p2g_weight_at(wy, oy) * p2g_weight_at(wz, oz),
          p2g_weight_at(wx, ox)
            * p2g_weight_derivative_at(p_grid.y - f32(base_y), oy)
            * p2g_weight_at(wz, oz),
          p2g_weight_at(wx, ox) * p2g_weight_at(wy, oy)
            * p2g_weight_derivative_at(p_grid.z - f32(base_z), oz)
        );
        p2g_field_store_contribution(
          particle_index,
          u32(ox * 9i + oy * 3i + oz),
          node_index,
          weight * pos_mass.w,
          weight * particle_momentum,
          pos_mass.w * weight_gradient,
          weight * volume,
          weight * volume * resolved_absolute_pressure_pa
        );`
      },
      {
        slot: 'mechanics-field-p2g-finalize',
        kind: 'range',
        start: '@compute @workgroup_size(64)\nfn finalize_grid',
        end: '\n\nfn compact_mechanics_view_word',
        code: `@compute @workgroup_size(64)
fn finalize_grid(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let field_index = p2g_field_linear_invocation(local_id, workgroup_id);
  if (!p2g_field_view_admitted() || field_index >= p2g_field_word(34u)) {
    return;
  }
  let state_base = p2g_field_word(30u) + field_index * P2G_FIELD_STATE_WORDS;
  let key_base = p2g_field_word(26u) + field_index * P2G_FIELD_KEY_WORDS;
  let node_index = p2g_field_word(key_base);
  let candidate_count = p2g_field_word(33u);
  let first_sorted_position = p2g_field_group_lower_bound(field_index);
  if (first_sorted_position >= candidate_count
      || p2g_field_group_at_sorted_position(first_sorted_position)
        != field_index
      || (first_sorted_position > 0u
        && p2g_field_group_at_sorted_position(first_sorted_position - 1u)
          >= field_index)) {
    p2g_field_reject();
    return;
  }
  var mass = 0.0;
  var momentum = vec3<f32>(0.0);
  var mass_gradient = vec3<f32>(0.0);
  var represented_volume_m3 = 0.0;
  var pressure_volume_moment_pa_m3 = 0.0;
  var contribution_count = 0u;
  var previous_candidate = P2G_FIELD_INVALID_INDEX;
  var sorted_position = first_sorted_position;
  loop {
    if (sorted_position >= candidate_count) { break; }
    let group = p2g_field_group_at_sorted_position(sorted_position);
    if (group != field_index) {
      if (group < field_index) {
        p2g_field_reject();
        return;
      }
      break;
    }
    let candidate_index =
      p2g_field_sorted_candidate_indices[sorted_position];
    if (previous_candidate != P2G_FIELD_INVALID_INDEX
        && candidate_index <= previous_candidate) {
      p2g_field_reject();
      return;
    }
    previous_candidate = candidate_index;
    let particle_index = candidate_index / P2G_FIELD_STENCIL_SIZE;
    let stencil_ordinal = candidate_index
      - particle_index * P2G_FIELD_STENCIL_SIZE;
    if (p2g_field_find(particle_index, stencil_ordinal, node_index)
        != field_index) {
      p2g_field_reject();
      return;
    }
    let row = candidate_index * P2G_FIELD_CONTRIBUTION_ROWS;
    let contribution0 = product_events[row];
    let contribution1 = product_events[row + 1u];
    let contribution2 = product_events[row + 2u];
    let contribution_published = contribution2.w;
    if (contribution_published != 0.0) {
      if (contribution_published != 1.0
          || !p2g_field_finite(contribution0.x)
          || contribution0.x < 0.0
          || !all(vec3<bool>(
            p2g_field_finite(contribution0.y),
            p2g_field_finite(contribution0.z),
            p2g_field_finite(contribution0.w)
          ))
          || !all(vec3<bool>(
            p2g_field_finite(contribution1.x),
            p2g_field_finite(contribution1.y),
            p2g_field_finite(contribution1.z)
          ))
          || !(contribution2.x > 0.0)
          || !p2g_field_finite(contribution2.x)
          || !(contribution2.y >= 0.0)
          || !p2g_field_finite(contribution2.y)
          || contribution2.z != 0.0
          || contribution_count == P2G_FIELD_INVALID_INDEX) {
        p2g_field_reject();
        return;
      }
      let next_mass = mass + contribution0.x;
      let next_momentum = momentum + contribution0.yzw;
      let next_mass_gradient = mass_gradient + contribution1.xyz;
      let next_represented_volume_m3 =
        represented_volume_m3 + contribution2.x;
      let next_pressure_volume_moment_pa_m3 =
        pressure_volume_moment_pa_m3 + contribution2.y;
      if (!p2g_field_finite(next_mass) || next_mass < 0.0
          || !all(vec3<bool>(
            p2g_field_finite(next_momentum.x),
            p2g_field_finite(next_momentum.y),
            p2g_field_finite(next_momentum.z)
          ))
          || !all(vec3<bool>(
            p2g_field_finite(next_mass_gradient.x),
            p2g_field_finite(next_mass_gradient.y),
            p2g_field_finite(next_mass_gradient.z)
          ))
          || !(next_represented_volume_m3 > 0.0)
          || !p2g_field_finite(next_represented_volume_m3)
          || !(next_pressure_volume_moment_pa_m3 >= 0.0)
          || !p2g_field_finite(next_pressure_volume_moment_pa_m3)) {
        p2g_field_reject();
        return;
      }
      mass = next_mass;
      momentum = next_momentum;
      mass_gradient = next_mass_gradient;
      represented_volume_m3 = next_represented_volume_m3;
      pressure_volume_moment_pa_m3 =
        next_pressure_volume_moment_pa_m3;
      contribution_count = contribution_count + 1u;
    }
    sorted_position = sorted_position + 1u;
  }
  p2g_field_store_word(state_base, bitcast<u32>(mass));
  p2g_field_store_word(state_base + 1u, bitcast<u32>(momentum.x));
  p2g_field_store_word(state_base + 2u, bitcast<u32>(momentum.y));
  p2g_field_store_word(state_base + 3u, bitcast<u32>(momentum.z));
  p2g_field_store_word(state_base + 4u, bitcast<u32>(mass_gradient.x));
  p2g_field_store_word(state_base + 5u, bitcast<u32>(mass_gradient.y));
  p2g_field_store_word(state_base + 6u, bitcast<u32>(mass_gradient.z));
  p2g_field_store_word(
    state_base + 7u,
    select(0u, contribution_count, mass > 0.0)
  );
  let absolute_pressure_pa =
    pressure_volume_moment_pa_m3 / represented_volume_m3;
  if (!(absolute_pressure_pa >= 0.0)
      || !p2g_field_finite(absolute_pressure_pa)
      || !(mass > 0.0)
      || contribution_count == 0u) {
    p2g_field_reject();
    return;
  }
  let pressure_base =
    p2g_field_pressure_offset() + field_index * P2G_FIELD_PRESSURE_WORDS;
  p2g_field_store_word(
    pressure_base,
    bitcast<u32>(pressure_volume_moment_pa_m3)
  );
  p2g_field_store_word(
    pressure_base + 1u,
    bitcast<u32>(represented_volume_m3)
  );
  p2g_field_store_word(
    pressure_base + 2u,
    bitcast<u32>(absolute_pressure_pa)
  );
  // Count publishes the immutable row last.
  p2g_field_store_word(pressure_base + 3u, contribution_count);
}
`
      },
      {
        slot: 'mechanics-field-accumulator-clear',
        match: `@compute @workgroup_size(64)
fn clear_accumulators(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = p2g_finalize_node_index(global_id.x);
  if (node_index >= params.grid_node_count) {
    return;
  }
  let accumulator_base = node_index * 4u;
  atomicStore(&grid_accumulators[accumulator_base], 0);
  atomicStore(&grid_accumulators[accumulator_base + 1u], 0);
  atomicStore(&grid_accumulators[accumulator_base + 2u], 0);
  atomicStore(&grid_accumulators[accumulator_base + 3u], 0);
}`,
        code: `@compute @workgroup_size(64)
fn clear_accumulators(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let field_index = p2g_field_linear_invocation(local_id, workgroup_id);
  if (!p2g_field_view_admitted() || field_index >= p2g_field_word(34u)) {
    return;
  }
  let accumulator_base = p2g_field_word(28u)
    + field_index * P2G_FIELD_ACCUMULATOR_WORDS;
  let state_base = p2g_field_word(30u) + field_index * P2G_FIELD_STATE_WORDS;
  let pressure_base =
    p2g_field_pressure_offset() + field_index * P2G_FIELD_PRESSURE_WORDS;
  for (var word = 0u; word < P2G_FIELD_ACCUMULATOR_WORDS; word = word + 1u) {
    atomicStore(&grid_accumulators[accumulator_base + word], 0);
  }
  for (var word = 0u; word < P2G_FIELD_STATE_WORDS; word = word + 1u) {
    atomicStore(&grid_accumulators[state_base + word], 0);
  }
  for (var word = 0u; word < P2G_FIELD_PRESSURE_WORDS; word = word + 1u) {
    atomicStore(&grid_accumulators[pressure_base + word], 0);
  }
  if (field_index == 0u) {
    p2g_field_store_word(43u, p2g_field_word(34u) * P2G_FIELD_ACCUMULATOR_WORDS);
  }
}`
      }
    ],
    append: [
      {
        slot: 'mechanics-field-preflight-and-seal',
        code: `fn preflight_mechanics_field_continue() -> bool {
  if (!p2g_field_view_structurally_admitted()) {
    p2g_field_reject();
    return false;
  }
  if (!p2g_field_mutation_current() || p2g_spatial_authority_rejected()) {
    return false;
  }
  return true;
}

@compute @workgroup_size(1)
fn claim_mechanics_field_mutation() {
  if (p2g_spatial_authority_rejected()) { return; }
  if (!p2g_field_view_structurally_admitted()
      || !p2g_field_receipt_reusable()
      || p2g_field_word(38u) != params.schroeder_spatial_pad2
      || p2g_field_word(59u) != params.mechanics_field_expected_state_encoding
      || params.mechanics_field_output_mutation_ordinal
        != params.mechanics_field_expected_mutation_ordinal + 1u) {
    compact_mechanics_view_reject();
    return;
  }
  loop {
    let claimed = atomicCompareExchangeWeak(
      &grid_accumulators[63u],
      bitcast<i32>(params.mechanics_field_expected_mutation_ordinal),
      bitcast<i32>(params.mechanics_field_output_mutation_ordinal)
    );
    if (claimed.exchanged) { break; }
    if (bitcast<u32>(claimed.old_value)
        != params.mechanics_field_expected_mutation_ordinal) {
      compact_mechanics_view_reject();
      return;
    }
  }
  p2g_field_store_word(43u, 0u);
  p2g_field_store_word(
    59u,
    ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY}u
  );
}

@compute @workgroup_size(1)
fn preflight_mechanics_field_header() {
  if (!preflight_mechanics_field_continue()) { return; }
  if (p2g_field_word(38u) != params.schroeder_spatial_pad2
      || p2g_field_word(47u) != ${SCHROEDER_SPATIAL_MECHANICS_VIEW_MAGIC}u
      || p2g_field_word(48u) != ${SCHROEDER_SPATIAL_MECHANICS_VIEW_VERSION}u
      || p2g_field_word(58u) != 0u
      || p2g_field_word(59u) != ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY}u
      || p2g_field_word(63u)
        != params.mechanics_field_output_mutation_ordinal) {
    p2g_field_reject();
  }
}

@compute @workgroup_size(1)
fn preflight_mechanics_field_layout() {
  if (!preflight_mechanics_field_continue()) { return; }
  if (p2g_field_word(35u) != 0u
      || p2g_field_word(37u) != 0u
      || p2g_field_word(43u) != 0u
      || !p2g_field_dispatch_shape_admitted()) {
    p2g_field_reject();
  }
}

@compute @workgroup_size(64)
fn validate_mechanics_field_keys(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (!preflight_mechanics_field_continue()) { return; }
  let field_index = p2g_field_linear_invocation(local_id, workgroup_id);
  let field_count = p2g_field_word(34u);
  if (field_index >= field_count) { return; }
  let key_offset = p2g_field_word(26u) + field_index * P2G_FIELD_KEY_WORDS;
  let node_index = p2g_field_word(key_offset);
  var ordered = node_index < params.grid_node_count;
  if (field_index > 0u) {
    let previous = key_offset - P2G_FIELD_KEY_WORDS;
    var strictly_less = false;
    var decided = false;
    for (var word = 0u; word < P2G_FIELD_KEY_WORDS; word = word + 1u) {
      let a = p2g_field_word(previous + word);
      let b = p2g_field_word(key_offset + word);
      if (!decided && a != b) {
        strictly_less = a < b;
        decided = true;
      }
    }
    ordered = ordered && decided && strictly_less;
  }
  if (!ordered) { p2g_field_reject(); }
}

@compute @workgroup_size(1)
fn seal_mechanics_field_momentum_state() {
  if (!p2g_field_mutation_current()) { return; }
  if (!p2g_field_view_admitted() || p2g_spatial_authority_rejected()) {
    p2g_field_reject();
    return;
  }
  let allowed_pressure_consumers =
    P2G_PRESSURE_CONSUMER_LOCAL
      | P2G_PRESSURE_CONSUMER_CROSS_LEVEL;
  if (params.pressure_required_consumer_mask == 0u
      || (params.pressure_required_consumer_mask
        & ~allowed_pressure_consumers) != 0u) {
    p2g_field_reject();
    return;
  }
  p2g_field_store_word(
    59u,
    ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT}u
  );
  let receipt = p2g_field_receipt_offset();
  for (var word = 0u; word < P2G_FIELD_RECEIPT_WORDS; word = word + 1u) {
    p2g_field_store_word(receipt + word, 0u);
  }
  p2g_field_store_word(receipt, P2G_FIELD_RECEIPT_MAGIC);
  p2g_field_store_word(receipt + 1u, P2G_FIELD_RECEIPT_VERSION);
  p2g_field_store_word(receipt + 2u, P2G_FIELD_RECEIPT_READY_ADMITTED);
  p2g_field_store_word(
    receipt + 5u, params.mechanics_field_output_mutation_ordinal
  );
  p2g_field_store_word(receipt + 6u, p2g_field_word(34u));
  p2g_field_store_word(receipt + 24u, P2G_PRESSURE_MAGIC);
  p2g_field_store_word(receipt + 25u, P2G_PRESSURE_VERSION);
  p2g_field_store_word(receipt + 26u, P2G_PRESSURE_READY_ADMITTED);
  p2g_field_store_word(receipt + 27u, P2G_PRESSURE_LAW_EXACT);
  p2g_field_store_word(
    receipt + 28u,
    bitcast<u32>(params.ambient_pressure_pa)
  );
  p2g_field_store_word(
    receipt + 29u,
    bitcast<u32>(params.internal_pressure_scale)
  );
  p2g_field_store_word(receipt + 30u, p2g_field_word(34u));
  p2g_field_store_word(
    receipt + 31u,
    params.mechanics_field_output_mutation_ordinal
  );
  p2g_field_store_word(
    receipt + 32u,
    params.pressure_required_consumer_mask
  );
  p2g_field_store_word(receipt + 33u, 0u);
  p2g_field_store_word(receipt + 34u, 0u);
  p2g_field_store_word(
    receipt + 35u,
    p2g_pressure_receipt_seal(
      p2g_field_word(34u),
      params.mechanics_field_output_mutation_ordinal,
      params.pressure_required_consumer_mask
    )
  );
  // Publish the reusable receipt phase last, after every identity/count word.
  p2g_field_store_word(
    receipt + 3u, P2G_FIELD_RECEIPT_PHASE_P2G_FINALIZED
  );
}
`
      }
    ]
  }));
}

function createSingleLevelMechanicsFieldP2gProjectionWgsl(
  sourceWgsl,
  variantId = 'single-level-mechanics-field'
) {
  return recordWgslVariantManifest(composeWgslVariantFromSource({
    moduleId: 'mls-mpm-p2g',
    variantId,
    baseSource: sourceWgsl,
    slots: [
      {
        slot: 'single-level-mechanics-field-p2g-finalize-heat-clear',
        match: '  p2g_field_store_word(pressure_base + 3u, contribution_count);',
        code: `  p2g_field_store_word(pressure_base + 3u, contribution_count);
  // P2G contributions live in the transient deterministic reduction buffer;
  // the ordinary fused single-level field accumulator bank remains a
  // separate mutable heat/work ledger while these pressure rows stay
  // immutable through local transport and G2P.`
      }
    ]
  }));
}

function createActiveSourceV2MechanicsFieldP2gWgsl(
  sourceWgsl,
  variantId = 'active-source-v2-mechanics-field'
) {
  const rejectedStatusMask =
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_FAIL_CLOSED
    | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_INVALID_SOURCE
    | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_CAPACITY_OVERFLOW
    | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_UNSUPPORTED_SOURCE
    | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_IDENTITY_MISMATCH
    | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_NONFINITE;
  return recordWgslVariantManifest(composeWgslVariantFromSource({
    moduleId: 'mls-mpm-p2g',
    variantId,
    baseSource: sourceWgsl,
    slots: [
      {
        slot: 'active-source-v2-p2g-params',
        match: `  pressure_required_consumer_mask: u32,
};`,
        code: `  pressure_required_consumer_mask: u32,
  active_source_physical_capacity: u32,
  active_source_active_capacity: u32,
  active_source_view_capacity_words: u32,
  active_source_active_to_physical_offset_words: u32,
  active_source_physical_to_active_offset_words: u32,
  active_source_fingerprint: u32,
  active_source_dispatch_x_limit: u32,
  active_source_header_words: u32,
  temporal_coarse_enabled: u32,
  temporal_coarse_successor_dt: f32,
  temporal_coarse_pad0: u32,
  temporal_coarse_pad1: u32,
};`
      },
      {
        slot: 'active-source-v2-p2g-authority-binding',
        match: '@group(0) @binding(8) var<storage, read> schroeder_spatial_directory: array<u32>;',
        code: '@group(0) @binding(8) var<storage, read> active_source_view: array<u32>;'
      },
      {
        slot: 'active-source-v2-p2g-authority',
        kind: 'range',
        start: 'const SCHROEDER_SPATIAL_MAGIC: u32',
        end: '\nfn p2g_finalize_node_index',
        code: `const ACTIVE_SOURCE_MAGIC: u32 = ${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC}u;
const ACTIVE_SOURCE_VERSION: u32 = ${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION}u;
const ACTIVE_SOURCE_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS}u;
const ACTIVE_SOURCE_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_READY
    | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_ADMITTED
}u;
const ACTIVE_SOURCE_REJECTED_MASK: u32 = ${rejectedStatusMask}u;
const ACTIVE_SOURCE_MISSING: u32 = ${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL}u;
const ACTIVE_SOURCE_ACTIVE_DISPATCH: u32 = ${
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS
}u;
const ACTIVE_SOURCE_CANDIDATE_DISPATCH: u32 = ${
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS
}u;
const ACTIVE_SOURCE_PHYSICAL_DISPATCH: u32 = ${
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS
}u;
const TEMPORAL_COARSE_MAGIC: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_TEMPORAL_COARSE_MAGIC
}u;

fn p2g_temporal_coarse_params_admitted() -> bool {
  if (params.temporal_coarse_pad0 != 0u
      || params.temporal_coarse_pad1 != 0u
      || params.temporal_coarse_enabled > 1u) {
    return false;
  }
  if (params.temporal_coarse_enabled == 0u) {
    return bitcast<u32>(params.temporal_coarse_successor_dt) == 0u;
  }
  return p2g_field_finite(params.temporal_coarse_successor_dt)
    && params.temporal_coarse_successor_dt > params.dt;
}

fn p2g_temporal_coarse_seal() -> u32 {
  return TEMPORAL_COARSE_MAGIC
    ^ bitcast<u32>(params.temporal_coarse_successor_dt)
    ^ bitcast<u32>(params.schroeder_selected_level)
    ^ p2g_field_word(34u)
    ^ params.mechanics_field_output_mutation_ordinal
    ^ params.schroeder_spatial_generation_id
    ^ params.schroeder_spatial_storage_generation
    ^ params.schroeder_spatial_physics_tick
    ^ params.schroeder_spatial_physics_substep
    ^ p2g_field_word(38u);
}

fn p2g_active_source_fold(value: u32, word: u32) -> u32 {
  return (value ^ word) * 0x01000193u;
}

fn p2g_active_source_projection_seal() -> u32 {
  var value = p2g_active_source_fold(
    active_source_view[31u],
    active_source_view[25u]
  );
  value = p2g_active_source_fold(value, active_source_view[26u]);
  value = p2g_active_source_fold(value, active_source_view[27u]);
  value = p2g_active_source_fold(value, active_source_view[18u]);
  value = p2g_active_source_fold(value, active_source_view[20u]);
  return p2g_active_source_fold(value, active_source_view[30u]);
}

fn p2g_active_source_dispatch_admitted(
  invocation_count: u32,
  offset: u32
) -> bool {
  let group_count = invocation_count / 64u
    + select(0u, 1u, invocation_count % 64u != 0u);
  let x = active_source_view[offset];
  let y = active_source_view[offset + 1u];
  let z = active_source_view[offset + 2u];
  if (invocation_count == 0u) {
    return x == 0u && y == 1u && z == 1u;
  }
  let expected_x = min(group_count, params.active_source_dispatch_x_limit);
  let expected_y = group_count / expected_x
    + select(0u, 1u, group_count % expected_x != 0u);
  return x == expected_x && y == expected_y && z == 1u;
}

fn p2g_spatial_directory_admitted() -> bool {
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < ACTIVE_SOURCE_HEADER_WORDS) {
    return false;
  }
  let physical_count = active_source_view[16u];
  let physical_capacity = active_source_view[17u];
  let active_count = active_source_view[18u];
  let active_capacity = active_source_view[19u];
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let capacity_words = active_source_view[27u];
  let active_candidate_count = active_source_view[43u];
  return params.schroeder_spatial_directory_enabled != 0u
    && params.active_source_dispatch_x_limit > 0u
    && params.active_source_header_words == ACTIVE_SOURCE_HEADER_WORDS
    && active_source_view[0u] == ACTIVE_SOURCE_MAGIC
    && active_source_view[1u] == ACTIVE_SOURCE_VERSION
    && (active_source_view[2u] & ACTIVE_SOURCE_READY_ADMITTED)
      == ACTIVE_SOURCE_READY_ADMITTED
    && (active_source_view[2u] & ACTIVE_SOURCE_REJECTED_MASK) == 0u
    && active_source_view[3u] == params.schroeder_spatial_generation_id
    && params.schroeder_spatial_generation_id > 0u
    && active_source_view[4u] == params.schroeder_spatial_device_ordinal
    && active_source_view[5u] == params.schroeder_spatial_lane_ordinal
    && active_source_view[6u] == params.schroeder_spatial_lease_token
    && active_source_view[7u] == params.schroeder_spatial_source_family_id
    && active_source_view[8u] == params.schroeder_spatial_storage_generation
    && active_source_view[9u] == params.schroeder_spatial_physics_tick
    && active_source_view[10u] == params.schroeder_spatial_physics_substep
    && active_source_view[11u] == params.schroeder_spatial_position_epoch
    && active_source_view[12u] == params.schroeder_spatial_topology_epoch
    && active_source_view[13u] == params.schroeder_spatial_chart_epoch
    && active_source_view[14u] == params.schroeder_spatial_level_epoch
    && active_source_view[15u] == params.schroeder_spatial_support_epoch
    && physical_count == params.particle_count
    && physical_count <= physical_capacity
    && physical_capacity == params.active_source_physical_capacity
    && active_count <= physical_count
    && active_count <= active_capacity
    && active_capacity == params.active_source_active_capacity
    && active_source_view[20u] == physical_count - active_count
    && active_source_view[21u] == 0u
    && active_source_view[22u] == 0u
    && active_source_view[23u]
      == ${SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0}u
    && active_source_view[24u]
      == ${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS}u
    && active_to_physical
      == params.active_source_active_to_physical_offset_words
    && active_to_physical == ACTIVE_SOURCE_HEADER_WORDS
    && physical_to_active
      == params.active_source_physical_to_active_offset_words
    && physical_to_active == active_to_physical + active_capacity
    && capacity_words == params.active_source_view_capacity_words
    && capacity_words == physical_to_active + physical_capacity
    && capacity_words <= bound_words
    && active_source_view[28u] <= capacity_words
    && active_source_view[29u] == params.schroeder_spatial_pad2
    && active_source_view[30u] == params.schroeder_spatial_pad2
    && active_source_view[31u] == params.active_source_fingerprint
    && active_source_view[32u] == physical_count
    && active_source_view[33u] == active_count
    && active_source_view[34u] == active_count
    && active_source_view[35u] == active_count
    && active_source_view[36u] <= physical_count
    && active_source_view[37u] == 64u
    && active_source_view[38u] == params.active_source_dispatch_x_limit
    && active_source_view[40u] == ACTIVE_SOURCE_ACTIVE_DISPATCH
    && active_source_view[41u] == ACTIVE_SOURCE_CANDIDATE_DISPATCH
    && active_source_view[42u] == ACTIVE_SOURCE_PHYSICAL_DISPATCH
    && active_count <= 0xffffffffu / 27u
    && active_candidate_count == active_count * 27u
    && active_source_view[44u] == active_capacity * 27u
    && active_source_view[47u] == p2g_active_source_projection_seal()
    && p2g_active_source_dispatch_admitted(
      active_count,
      ACTIVE_SOURCE_ACTIVE_DISPATCH
    )
    && p2g_active_source_dispatch_admitted(
      active_candidate_count,
      ACTIVE_SOURCE_CANDIDATE_DISPATCH
    )
    && p2g_active_source_dispatch_admitted(
      physical_count,
      ACTIVE_SOURCE_PHYSICAL_DISPATCH
    );
}

fn p2g_canonical_query_geometry_admitted() -> bool {
  // Query geometry is folded into the exact host-authenticated fingerprint.
  return p2g_spatial_directory_admitted();
}

fn p2g_spatial_evidence_add(word: u32, value: u32) {
  // The producer-owned ActiveSource and mechanics view are immutable.
}

fn compact_mechanics_view_reject() {
  if (arrayLength(&grid_accumulators)
      >= ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u) {
    atomicOr(
      &grid_accumulators[2u],
      bitcast<i32>(${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
        | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE}u)
    );
    atomicStore(&grid_accumulators[34u], 0);
    atomicStore(&grid_accumulators[44u], 0);
    atomicStore(&grid_accumulators[45u], 0);
    atomicStore(&grid_accumulators[46u], 0);
    atomicStore(
      &grid_accumulators[
        ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS}u
      ],
      0
    );
    atomicStore(
      &grid_accumulators[
        ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS + 1}u
      ],
      0
    );
    atomicStore(
      &grid_accumulators[
        ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS + 2}u
      ],
      0
    );
  }
}

fn p2g_spatial_reject(word: u32) {
  compact_mechanics_view_reject();
}

fn p2g_spatial_authority_rejected() -> bool {
  if (arrayLength(&grid_accumulators)
      < ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u) {
    return true;
  }
  let status = bitcast<u32>(atomicLoad(&grid_accumulators[2u]));
  return (status & ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_CAPACITY_OVERFLOW
}u) != 0u;
}

fn p2g_spatial_evidence_identity(particle_index: u32) {}

fn p2g_authenticate_spatial_header(particle_index: u32) {
  if (!p2g_spatial_directory_admitted()) {
    p2g_spatial_reject(14u);
  }
}

fn p2g_physical_for_active(active_ordinal: u32) -> u32 {
  if (active_ordinal >= active_source_view[18u]) {
    return ACTIVE_SOURCE_MISSING;
  }
  let physical = active_source_view[
    active_source_view[25u] + active_ordinal
  ];
  if (physical >= params.particle_count
      || active_source_view[active_source_view[26u] + physical]
        != active_ordinal) {
    return ACTIVE_SOURCE_MISSING;
  }
  return physical;
}

fn p2g_active_for_physical(physical: u32) -> u32 {
  if (physical >= params.particle_count) {
    return ACTIVE_SOURCE_MISSING;
  }
  let active_ordinal =
    active_source_view[active_source_view[26u] + physical];
  if (active_ordinal == ACTIVE_SOURCE_MISSING) {
    return ACTIVE_SOURCE_MISSING;
  }
  if (active_ordinal >= active_source_view[18u]
      || active_source_view[active_source_view[25u] + active_ordinal]
        != physical) {
    return ACTIVE_SOURCE_MISSING;
  }
  return active_ordinal;
}

fn p2g_particle_enabled(particle_index: u32) -> bool {
  if (p2g_spatial_authority_rejected()
      || p2g_active_for_physical(particle_index) == ACTIVE_SOURCE_MISSING) {
    return false;
  }
  let descriptor_base = bitcast<u32>(atomicLoad(&grid_accumulators[24u]))
    + particle_index * 32u;
  return descriptor_base + 3u < arrayLength(&grid_accumulators)
    && bitcast<u32>(atomicLoad(&grid_accumulators[descriptor_base + 3u]))
      == 1u;
}
`
      },
      {
        slot: 'active-source-v2-field-candidate-cardinality',
        match: `    && p2g_field_word(33u) % P2G_FIELD_STENCIL_SIZE == 0u
    && p2g_field_word(33u) / P2G_FIELD_STENCIL_SIZE == params.particle_count`,
        code: `    && p2g_field_word(33u) == active_source_view[43u]
    && p2g_field_word(33u) % P2G_FIELD_STENCIL_SIZE == 0u
    && p2g_field_word(33u) / P2G_FIELD_STENCIL_SIZE
      == active_source_view[18u]`
      },
      {
        slot: 'active-source-v2-contribution-clear-identity',
        match: 'fn p2g_field_clear_particle_contributions(particle_index: u32) {\n  let candidate_count = p2g_field_word(33u);\n  let first_candidate = particle_index * P2G_FIELD_STENCIL_SIZE;',
        code: 'fn p2g_field_clear_particle_contributions(active_ordinal: u32) {\n  let candidate_count = p2g_field_word(33u);\n  let first_candidate = active_ordinal * P2G_FIELD_STENCIL_SIZE;'
      },
      {
        slot: 'active-source-v2-contribution-store-signature',
        match: `fn p2g_field_store_contribution(
  particle_index: u32,
  stencil_ordinal: u32,`,
        code: `fn p2g_field_store_contribution(
  active_ordinal: u32,
  particle_index: u32,
  stencil_ordinal: u32,`
      },
      {
        slot: 'active-source-v2-contribution-candidate-identity',
        match: `  let candidate_index = particle_index * P2G_FIELD_STENCIL_SIZE
    + stencil_ordinal;`,
        code: `  let candidate_index = active_ordinal * P2G_FIELD_STENCIL_SIZE
    + stencil_ordinal;`
      },
      {
        slot: 'active-source-v2-contribution-call-identity',
        match: `        p2g_field_store_contribution(
          particle_index,`,
        code: `        p2g_field_store_contribution(
          active_ordinal,
          particle_index,`
      },
      {
        slot: 'active-source-v2-sorted-candidate-projection',
        match: `  let particle_index = candidate_index / P2G_FIELD_STENCIL_SIZE;
  let stencil_ordinal = candidate_index
    - particle_index * P2G_FIELD_STENCIL_SIZE;
  if (particle_index >= params.particle_count
      || stencil_ordinal >= P2G_FIELD_STENCIL_SIZE) {
    return P2G_FIELD_INVALID_INDEX;
  }
  let descriptor_base = p2g_field_word(24u)
    + particle_index * P2G_FIELD_DESCRIPTOR_WORDS;`,
        code: `  let active_ordinal = candidate_index / P2G_FIELD_STENCIL_SIZE;
  let stencil_ordinal = candidate_index
    - active_ordinal * P2G_FIELD_STENCIL_SIZE;
  let particle_index = p2g_physical_for_active(active_ordinal);
  if (particle_index == ACTIVE_SOURCE_MISSING
      || stencil_ordinal >= P2G_FIELD_STENCIL_SIZE) {
    return P2G_FIELD_INVALID_INDEX;
  }
  let descriptor_base = p2g_field_word(24u)
    + particle_index * P2G_FIELD_DESCRIPTOR_WORDS;`
      },
      {
        slot: 'active-source-v2-final-reduction-projection',
        match: `    let particle_index = candidate_index / P2G_FIELD_STENCIL_SIZE;
    let stencil_ordinal = candidate_index
      - particle_index * P2G_FIELD_STENCIL_SIZE;
    if (p2g_field_find(particle_index, stencil_ordinal, node_index)
        != field_index) {`,
        code: `    let active_ordinal = candidate_index / P2G_FIELD_STENCIL_SIZE;
    let particle_index = p2g_physical_for_active(active_ordinal);
    let stencil_ordinal = candidate_index
      - active_ordinal * P2G_FIELD_STENCIL_SIZE;
    if (particle_index == ACTIVE_SOURCE_MISSING
        || p2g_field_find(particle_index, stencil_ordinal, node_index)
          != field_index) {`
      },
      {
        slot: 'active-source-v2-indirect-p2g-entry',
        match: `@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  p2g_field_clear_particle_contributions(particle_index);
  if (!p2g_particle_enabled(particle_index)) {
    return;
  }
  if (!p2g_field_mutation_current()) {
    return;
  }
  if (!p2g_field_view_admitted()) {
    p2g_field_reject();
    return;
  }`,
        code: `@compute @workgroup_size(64)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let dispatch_x = max(
    active_source_view[ACTIVE_SOURCE_ACTIVE_DISPATCH],
    1u
  );
  let active_ordinal =
    (workgroup_id.x + workgroup_id.y * dispatch_x) * 64u + local_id.x;
  if (active_ordinal >= active_source_view[18u]) {
    return;
  }
  let particle_index = p2g_physical_for_active(active_ordinal);
  if (particle_index == ACTIVE_SOURCE_MISSING) {
    p2g_field_reject();
    return;
  }
  p2g_field_clear_particle_contributions(active_ordinal);
  if (!p2g_field_mutation_current()) {
    return;
  }
  if (!p2g_field_view_admitted()) {
    p2g_field_reject();
    return;
  }
  if (!p2g_particle_enabled(particle_index)) {
    return;
  }`
      },
      {
        slot: 'active-source-v2-compact-source-counts',
        match: '    || compact_mechanics_view_word(49u) != params.particle_count\n    || selected_source_count > params.particle_count',
        code: '    || compact_mechanics_view_word(49u) != active_source_view[18u]\n    || selected_source_count > active_source_view[18u]'
      },
      {
        slot: 'active-source-v2-completion-lineage',
        match: `    || compact_mechanics_view_word(52u) != params.schroeder_spatial_pad2
    || schroeder_spatial_directory[33u] != params.schroeder_spatial_pad2`,
        code: `    || compact_mechanics_view_word(52u) != params.schroeder_spatial_pad2
    || active_source_view[30u] != params.schroeder_spatial_pad2`
      },
      {
        slot: 'active-source-v2-temporal-coarse-contribution-signature',
        match: `  momentum: vec3<f32>,
  mass_gradient: vec3<f32>,`,
        code: `  momentum: vec3<f32>,
  successor_momentum: vec3<f32>,
  mass_gradient: vec3<f32>,`
      },
      {
        slot: 'active-source-v2-temporal-coarse-contribution-validation',
        match: `      || !all(vec3<bool>(
        p2g_field_finite(mass_gradient.x),
        p2g_field_finite(mass_gradient.y),
        p2g_field_finite(mass_gradient.z)
      ))
      || !(represented_volume_m3 > 0.0)`,
        code: `      || !all(vec3<bool>(
        p2g_field_finite(successor_momentum.x),
        p2g_field_finite(successor_momentum.y),
        p2g_field_finite(successor_momentum.z)
      ))
      || (params.temporal_coarse_enabled == 0u
        && any(successor_momentum != vec3<f32>(0.0)))
      || !all(vec3<bool>(
        p2g_field_finite(mass_gradient.x),
        p2g_field_finite(mass_gradient.y),
        p2g_field_finite(mass_gradient.z)
      ))
      || !(represented_volume_m3 > 0.0)`
      },
      {
        slot: 'active-source-v2-temporal-coarse-contribution-record',
        match: `  product_events[row] = vec4<f32>(mass, momentum);
  product_events[row + 1u] = vec4<f32>(mass_gradient, 0.0);
  // Publish last so a stale or torn three-row record is never observable.
  product_events[row + 2u] = vec4<f32>(
    represented_volume_m3,
    pressure_volume_moment_pa_m3,
    0.0,
    1.0
  );`,
        code: `  product_events[row] = vec4<f32>(mass, momentum);
  product_events[row + 1u] = vec4<f32>(
    mass_gradient,
    successor_momentum.x
  );
  // ActiveSource-v2 uses the exact sign of the strictly-positive represented
  // volume as its publish tag. This keeps the candidate record at three vec4
  // rows while row1.w/row2.zw carry the immediate successor momentum. Store
  // the tagged row last so a stale or torn record remains unpublished.
  product_events[row + 2u] = vec4<f32>(
    -represented_volume_m3,
    pressure_volume_moment_pa_m3,
    successor_momentum.y,
    successor_momentum.z
  );`
      },
      {
        slot: 'active-source-v2-temporal-coarse-particle-momentum',
        match: `        p2g_field_store_contribution(
          active_ordinal,
          particle_index,`,
        code: `        var successor_particle_momentum = vec3<f32>(0.0);
        if (params.temporal_coarse_enabled != 0u) {
          let successor_stress_scale =
            -params.temporal_coarse_successor_dt * volume * 4.0
            * params.inv_grid_spacing_m * params.inv_grid_spacing_m;
          let successor_aff_x = vec3<f32>(
            pos_mass.w * c00 + successor_stress_scale * sigma.x.x,
            pos_mass.w * c01 + successor_stress_scale * sigma.x.y,
            pos_mass.w * c02 + successor_stress_scale * sigma.x.z
          );
          let successor_aff_y = vec3<f32>(
            pos_mass.w * c10 + successor_stress_scale * sigma.y.x,
            pos_mass.w * c11 + successor_stress_scale * sigma.y.y,
            pos_mass.w * c12 + successor_stress_scale * sigma.y.z
          );
          let successor_aff_z = vec3<f32>(
            pos_mass.w * c20 + successor_stress_scale * sigma.z.x,
            pos_mass.w * c21 + successor_stress_scale * sigma.z.y,
            pos_mass.w * c22 + successor_stress_scale * sigma.z.z
          );
          successor_particle_momentum = pos_mass.w * vel_u.xyz + vec3<f32>(
            dot(successor_aff_x, dpos),
            dot(successor_aff_y, dpos),
            dot(successor_aff_z, dpos)
          );
        }
        p2g_field_store_contribution(
          active_ordinal,
          particle_index,`
      },
      {
        slot: 'active-source-v2-temporal-coarse-contribution-arg',
        match: `          weight * pos_mass.w,
          weight * particle_momentum,
          pos_mass.w * weight_gradient,`,
        code: `          weight * pos_mass.w,
          weight * particle_momentum,
          weight * successor_particle_momentum,
          pos_mass.w * weight_gradient,`
      },
      {
        slot: 'active-source-v2-temporal-coarse-reduction-accumulator',
        match: `  var momentum = vec3<f32>(0.0);
  var mass_gradient = vec3<f32>(0.0);`,
        code: `  var momentum = vec3<f32>(0.0);
  var successor_momentum = vec3<f32>(0.0);
  var mass_gradient = vec3<f32>(0.0);`
      },
      {
        slot: 'active-source-v2-temporal-coarse-publish-tag',
        match: `    let contribution_published = contribution2.w;
    if (contribution_published != 0.0) {
      if (contribution_published != 1.0
          || !p2g_field_finite(contribution0.x)`,
        code: `    let contribution_published = contribution2.x != 0.0;
    if (contribution_published) {
      if (!p2g_field_finite(contribution0.x)`
      },
      {
        slot: 'active-source-v2-temporal-coarse-payload-validation',
        match: `          || !(contribution2.x > 0.0)
          || !p2g_field_finite(contribution2.x)
          || !(contribution2.y >= 0.0)
          || !p2g_field_finite(contribution2.y)
          || contribution2.z != 0.0
          || contribution_count == P2G_FIELD_INVALID_INDEX)`,
        code: `          || !(contribution2.x < 0.0)
          || !p2g_field_finite(contribution2.x)
          || !(contribution2.y >= 0.0)
          || !p2g_field_finite(contribution2.y)
          || !p2g_field_finite(contribution1.w)
          || !p2g_field_finite(contribution2.z)
          || !p2g_field_finite(contribution2.w)
          || (params.temporal_coarse_enabled == 0u
            && (contribution1.w != 0.0
              || contribution2.z != 0.0
              || contribution2.w != 0.0))
          || contribution_count == P2G_FIELD_INVALID_INDEX)`
      },
      {
        slot: 'active-source-v2-temporal-coarse-stable-reduction',
        match: `      let next_mass = mass + contribution0.x;
      let next_momentum = momentum + contribution0.yzw;
      let next_mass_gradient = mass_gradient + contribution1.xyz;
      let next_represented_volume_m3 =
        represented_volume_m3 + contribution2.x;`,
        code: `      let next_mass = mass + contribution0.x;
      let next_momentum = momentum + contribution0.yzw;
      let next_successor_momentum = successor_momentum + vec3<f32>(
        contribution1.w,
        contribution2.z,
        contribution2.w
      );
      let next_mass_gradient = mass_gradient + contribution1.xyz;
      let next_represented_volume_m3 =
        represented_volume_m3 - contribution2.x;`
      },
      {
        slot: 'active-source-v2-temporal-coarse-running-sum-validation',
        match: `          || !all(vec3<bool>(
            p2g_field_finite(next_mass_gradient.x),`,
        code: `          || !all(vec3<bool>(
            p2g_field_finite(next_successor_momentum.x),
            p2g_field_finite(next_successor_momentum.y),
            p2g_field_finite(next_successor_momentum.z)
          ))
          || !all(vec3<bool>(
            p2g_field_finite(next_mass_gradient.x),`
      },
      {
        slot: 'active-source-v2-temporal-coarse-running-sum-commit',
        match: `      mass = next_mass;
      momentum = next_momentum;
      mass_gradient = next_mass_gradient;`,
        code: `      mass = next_mass;
      momentum = next_momentum;
      successor_momentum = next_successor_momentum;
      mass_gradient = next_mass_gradient;`
      },
      {
        slot: 'active-source-v2-temporal-coarse-field-sidecar',
        match: `  p2g_field_store_word(
    pressure_base + 2u,
    bitcast<u32>(absolute_pressure_pa)
  );
  // Count publishes the immutable row last.`,
        code: `  p2g_field_store_word(
    pressure_base + 2u,
    bitcast<u32>(absolute_pressure_pa)
  );
  if (params.temporal_coarse_enabled != 0u) {
    let accumulator_base = p2g_field_word(28u)
      + field_index * P2G_FIELD_ACCUMULATOR_WORDS;
    p2g_field_store_word(
      accumulator_base,
      bitcast<u32>(successor_momentum.x)
    );
    p2g_field_store_word(
      accumulator_base + 1u,
      bitcast<u32>(successor_momentum.y)
    );
    p2g_field_store_word(
      accumulator_base + 2u,
      bitcast<u32>(successor_momentum.z)
    );
  }
  // Count publishes the immutable row last.`
      },
      {
        slot: 'active-source-v2-temporal-coarse-preflight',
        match: `      || p2g_field_word(58u) != 0u
      || p2g_field_word(59u) != ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY}u`,
        code: `      || p2g_field_word(58u) != 0u
      || !p2g_temporal_coarse_params_admitted()
      || p2g_field_word(59u) != ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY}u`
      },
      {
        slot: 'active-source-v2-temporal-coarse-receipt',
        match: `  p2g_field_store_word(receipt + 6u, p2g_field_word(34u));
  p2g_field_store_word(receipt + 24u, P2G_PRESSURE_MAGIC);`,
        code: `  p2g_field_store_word(receipt + 6u, p2g_field_word(34u));
  if (params.temporal_coarse_enabled != 0u) {
    p2g_field_store_word(receipt + 13u, TEMPORAL_COARSE_MAGIC);
    p2g_field_store_word(
      receipt + 14u,
      bitcast<u32>(params.temporal_coarse_successor_dt)
    );
    // Publish the temporal subreceipt seal after its identity and dt.
    p2g_field_store_word(receipt + 15u, p2g_temporal_coarse_seal());
  }
  p2g_field_store_word(receipt + 24u, P2G_PRESSURE_MAGIC);`
      }
    ]
  }));
}

function createMechanicsFieldG2pWgsl(
  sourceWgsl,
  variantId = 'mechanics-field'
) {
  return recordWgslVariantManifest(composeWgslVariantFromSource({
    moduleId: 'mls-mpm-g2p',
    variantId,
    baseSource: sourceWgsl,
    slots: [
      {
        slot: 'mechanics-field-g2p-reflux-binding',
        match: '@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;',
        code: '@group(0) @binding(1) var<storage, read_write> cross_level_reflux: array<atomic<u32>>;'
      },
      {
        slot: 'mechanics-field-g2p-unused-thermo-read',
        match: '  let _thermo_status = sph_thermo[particle_index * 3u + 2u].z;',
        code: '  // Binding 1 is the cross-level reflux ledger in this field variant.'
      },
      {
        slot: 'mechanics-field-g2p-field-binding',
        match: '@group(0) @binding(3) var<storage, read> updated_grid_nodes: array<vec4<f32>>;',
        code: '@group(0) @binding(3) var<storage, read_write> mechanics_field_view: array<atomic<u32>>;'
      },
      {
        slot: 'mechanics-field-g2p-immutable-authority-binding',
        match: '@group(0) @binding(7) var<storage, read_write> schroeder_spatial_authority_evidence: array<atomic<u32>>;',
        code: '@group(0) @binding(7) var<storage, read> schroeder_spatial_authority_evidence: array<u32>;'
      },
      {
        slot: 'mechanics-field-g2p-borrowed-success-evidence',
        kind: 'range',
        start: 'fn g2p_spatial_evidence_add(word: u32, value: u32) {',
        end: '\nfn g2p_canonical_query_geometry_admitted',
        code: `fn g2p_spatial_evidence_add(word: u32, value: u32) {
  // The producer-owned compact mechanics view is immutable.
}
`
      },
      {
        slot: 'mechanics-field-g2p-owned-rejection-evidence',
        kind: 'range',
        start: 'fn g2p_spatial_reject(word: u32) {',
        end: '\nfn g2p_authenticate_spatial_header',
        code: `fn g2p_spatial_reject(word: u32) {
  if (arrayLength(&mechanics_field_view)
      >= ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u) {
    atomicOr(
      &mechanics_field_view[2u],
      ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
        | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE}u
    );
    atomicStore(&mechanics_field_view[34u], 0u);
    atomicStore(
      &mechanics_field_view[
        ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS}u
      ],
      0u
    );
    atomicStore(
      &mechanics_field_view[
        ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS + 1}u
      ],
      0u
    );
    atomicStore(
      &mechanics_field_view[
        ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS + 2}u
      ],
      0u
    );
  }
}

fn g2p_p2g_authority_rejected() -> bool {
  if (arrayLength(&mechanics_field_view)
      < ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u) {
    return true;
  }
  let status = atomicLoad(&mechanics_field_view[2u]);
  return (status & ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_CAPACITY_OVERFLOW
}u) != 0u;
}

fn g2p_spatial_authority_rejected() -> bool {
  return g2p_p2g_authority_rejected();
}

fn g2p_spatial_evidence_identity(particle_index: u32) {
  // The producer-owned compact mechanics view is immutable.
}
`
      },
      {
        slot: 'mechanics-field-g2p-upstream-normalization-reject',
        optional: true,
        match: '    atomicStore(&schroeder_spatial_authority_evidence[14u], 1u);',
        code: '    g2p_spatial_reject(16u);'
      },
      {
        slot: 'mechanics-field-g2p-helpers',
        match: 'fn g2p_quadratic_weights(fx: f32) -> vec3<f32> {',
        code: `const G2P_FIELD_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC}u;
const G2P_FIELD_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION}u;
const G2P_FIELD_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED
}u;
const G2P_FIELD_DESCRIPTOR_WORDS: u32 = 32u;
const G2P_FIELD_KEY_WORDS: u32 = 4u;
const G2P_FIELD_STATE_WORDS: u32 = 8u;
const G2P_FIELD_PRESSURE_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS}u;
const G2P_FIELD_ACCUMULATOR_WORDS: u32 = 8u;
const G2P_FIELD_RECEIPT_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS}u;
const G2P_FIELD_RECEIPT_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC}u;
const G2P_FIELD_RECEIPT_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION}u;
const G2P_FIELD_RECEIPT_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED
}u;
const G2P_FIELD_RECEIPT_FAIL_CLOSED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_FAIL_CLOSED
}u;
const G2P_FIELD_RECEIPT_ENERGY_READY: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_ENERGY_READY}u;
const G2P_FIELD_RECEIPT_G2P_CLAIMED: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_G2P_CLAIMED}u;
const G2P_FIELD_RECEIPT_CONSUMED: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_CONSUMED}u;
const G2P_FIELD_PRESSURE_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC}u;
const G2P_FIELD_PRESSURE_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION}u;
const G2P_FIELD_PRESSURE_LAW_EXACT: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_LAW_EXACT_P2G}u;
const G2P_FIELD_PRESSURE_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_ADMITTED
}u;
const G2P_FIELD_PRESSURE_FAIL_CLOSED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_FAIL_CLOSED
}u;
const G2P_FIELD_INVALID_INDEX: u32 = 0xffffffffu;
const G2P_REFLUX_MAGIC: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_MAGIC}u;
const G2P_REFLUX_VERSION: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_VERSION}u;
const G2P_REFLUX_HEADER_WORDS: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS}u;
const G2P_REFLUX_ROW_WORDS: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS}u;
const G2P_REFLUX_READY_ADMITTED: u32 = ${
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
  | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED
}u;
const G2P_REFLUX_PHASE_ENERGY_READY: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ENERGY_READY}u;
const G2P_REFLUX_PHASE_G2P_CLAIMED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_G2P_CLAIMED}u;
const G2P_REFLUX_PHASE_CONSUMED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_CONSUMED}u;
const G2P_REFLUX_PHASE_ACCUMULATING: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ACCUMULATING}u;
const G2P_REFLUX_FAIL_CLOSED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_FAIL_CLOSED}u;
const G2P_REFLUX_NONFINITE: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_NONFINITE}u;
const G2P_REFLUX_PHASE_REJECTED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_PHASE_REJECTED}u;
const G2P_TERMINAL_CLAIMED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CLAIMED}u;
const G2P_TERMINAL_CONSUMED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED}u;
const G2P_TERMINAL_REJECTED: u32 = ${SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_REJECTED}u;

fn g2p_field_load(word: u32) -> u32 {
  return atomicLoad(&mechanics_field_view[word]);
}

fn g2p_field_store(word: u32, value: u32) {
  atomicStore(&mechanics_field_view[word], value);
}

fn g2p_reflux_load(word: u32) -> u32 {
  return atomicLoad(&cross_level_reflux[word]);
}

fn g2p_reflux_store(word: u32, value: u32) {
  atomicStore(&cross_level_reflux[word], value);
}

fn g2p_atomic_add_f32_field(word: u32, value: f32) -> bool {
  if (value != value || abs(value) > 3.402823466e+38) { return false; }
  loop {
    let prior_bits = g2p_field_load(word);
    let prior = bitcast<f32>(prior_bits);
    let next = prior + value;
    if (prior != prior || next != next || abs(next) > 3.402823466e+38) {
      return false;
    }
    let claimed = atomicCompareExchangeWeak(
      &mechanics_field_view[word], prior_bits, bitcast<u32>(next)
    );
    if (claimed.exchanged) { return true; }
  }
}

fn g2p_atomic_add_f32_reflux(word: u32, value: f32) -> bool {
  if (value != value || abs(value) > 3.402823466e+38) { return false; }
  loop {
    let prior_bits = g2p_reflux_load(word);
    let prior = bitcast<f32>(prior_bits);
    let next = prior + value;
    if (prior != prior || next != next || abs(next) > 3.402823466e+38) {
      return false;
    }
    let claimed = atomicCompareExchangeWeak(
      &cross_level_reflux[word], prior_bits, bitcast<u32>(next)
    );
    if (claimed.exchanged) { return true; }
  }
}

fn g2p_reflux_increment_checked(word: u32) -> bool {
  loop {
    let prior = g2p_reflux_load(word);
    if (prior == 0xffffffffu) { return false; }
    let claimed = atomicCompareExchangeWeak(
      &cross_level_reflux[word], prior, prior + 1u
    );
    if (claimed.exchanged) { return true; }
  }
}

fn g2p_field_receipt_offset() -> u32 {
  return g2p_field_load(30u) - G2P_FIELD_RECEIPT_WORDS;
}

fn g2p_field_receipt_addressable() -> bool {
  if (arrayLength(&mechanics_field_view)
      < ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u) {
    return false;
  }
  let state_offset = g2p_field_load(30u);
  return state_offset >= G2P_FIELD_RECEIPT_WORDS
    && state_offset <= arrayLength(&mechanics_field_view)
    && state_offset - G2P_FIELD_RECEIPT_WORDS
      <= arrayLength(&mechanics_field_view) - G2P_FIELD_RECEIPT_WORDS;
}

fn g2p_field_pressure_offset() -> u32 {
  return g2p_field_load(30u)
    + g2p_field_load(32u) * G2P_FIELD_STATE_WORDS;
}

fn g2p_field_pressure_receipt_seal() -> u32 {
  let receipt = g2p_field_receipt_offset();
  return G2P_FIELD_PRESSURE_MAGIC
    ^ G2P_FIELD_PRESSURE_VERSION
    ^ G2P_FIELD_PRESSURE_READY_ADMITTED
    ^ G2P_FIELD_PRESSURE_LAW_EXACT
    ^ g2p_field_load(receipt + 28u)
    ^ g2p_field_load(receipt + 29u)
    ^ g2p_field_load(receipt + 30u)
    ^ g2p_field_load(receipt + 31u)
    ^ g2p_field_load(receipt + 32u)
    ^ g2p_field_load(3u)
    ^ g2p_field_load(8u)
    ^ g2p_field_load(9u)
    ^ g2p_field_load(10u)
    ^ g2p_field_load(38u);
}

fn g2p_field_receipt_structural_core() -> bool {
  if (!g2p_field_receipt_addressable()) { return false; }
  let state_offset = g2p_field_load(30u);
  let receipt = g2p_field_receipt_offset();
  let pressure_required = g2p_field_load(receipt + 32u);
  let pressure_claimed = g2p_field_load(receipt + 33u);
  let pressure_consumed = g2p_field_load(receipt + 34u);
  return state_offset >= G2P_FIELD_RECEIPT_WORDS
    && state_offset == g2p_field_load(28u)
      + g2p_field_load(32u) * G2P_FIELD_ACCUMULATOR_WORDS
      + G2P_FIELD_RECEIPT_WORDS
    && g2p_field_load(receipt) == G2P_FIELD_RECEIPT_MAGIC
    && g2p_field_load(receipt + 1u) == G2P_FIELD_RECEIPT_VERSION
    && g2p_field_load(receipt + 2u) == G2P_FIELD_RECEIPT_READY_ADMITTED
    && g2p_field_load(receipt + 5u) == g2p_field_load(63u)
    && g2p_field_load(receipt + 6u) == g2p_field_load(34u)
    && g2p_field_load(receipt + 24u) == G2P_FIELD_PRESSURE_MAGIC
    && g2p_field_load(receipt + 25u) == G2P_FIELD_PRESSURE_VERSION
    && g2p_field_load(receipt + 26u)
      == G2P_FIELD_PRESSURE_READY_ADMITTED
    && g2p_field_load(receipt + 27u) == G2P_FIELD_PRESSURE_LAW_EXACT
    && g2p_field_load(receipt + 30u) == g2p_field_load(34u)
    && g2p_field_load(receipt + 31u) <= g2p_field_load(receipt + 5u)
    && pressure_required != 0u
    && pressure_claimed == pressure_required
    && pressure_consumed == pressure_required
    && g2p_field_load(receipt + 35u)
      == g2p_field_pressure_receipt_seal();
}

fn g2p_field_receipt_structural(phase: u32) -> bool {
  return g2p_field_receipt_structural_core()
    && g2p_field_load(g2p_field_receipt_offset() + 3u) == phase;
}

fn g2p_receipt_reject(replay: bool, skipped: bool, duplicate: bool) {
  if (g2p_field_receipt_addressable()) {
    let receipt = g2p_field_receipt_offset();
    g2p_field_store(receipt + 2u, G2P_FIELD_RECEIPT_FAIL_CLOSED);
    g2p_field_store(receipt + 26u, G2P_FIELD_PRESSURE_FAIL_CLOSED);
  }
  if (g2p_reflux_present()) {
    atomicOr(
      &cross_level_reflux[2u],
      G2P_REFLUX_FAIL_CLOSED | G2P_REFLUX_PHASE_REJECTED
    );
    g2p_reflux_store(80u, G2P_TERMINAL_REJECTED);
    if (replay) { _ = g2p_reflux_increment_checked(108u); }
    if (skipped) { _ = g2p_reflux_increment_checked(109u); }
    if (duplicate) { _ = g2p_reflux_increment_checked(110u); }
  }
  g2p_spatial_reject(17u);
}

fn g2p_selected_is_coarse() -> bool {
  return g2p_reflux_present()
    && params.schroeder_selected_level == bitcast<i32>(g2p_reflux_load(78u));
}

@compute @workgroup_size(1)
fn claim_g2p_energy_receipt() {
  if (!g2p_field_view_admitted_for_claim()) {
    g2p_receipt_reject(false, true, false);
    return;
  }
  let receipt = g2p_field_receipt_offset();
  let field_phase = g2p_field_load(receipt + 3u);
  if (field_phase != G2P_FIELD_RECEIPT_ENERGY_READY) {
    g2p_receipt_reject(
      field_phase == G2P_FIELD_RECEIPT_CONSUMED,
      field_phase < G2P_FIELD_RECEIPT_ENERGY_READY,
      field_phase == G2P_FIELD_RECEIPT_G2P_CLAIMED
    );
    return;
  }
  if (g2p_reflux_present()) {
    let selected_coarse = g2p_selected_is_coarse();
    let selected_fine = params.schroeder_selected_level
      == bitcast<i32>(g2p_reflux_load(77u));
    let committed = g2p_reflux_load(8u);
    let consumed = g2p_reflux_load(15u);
    let expected = g2p_reflux_load(54u);
    let ordered_fine = selected_fine
      && committed == consumed + 1u && committed <= expected
      && g2p_reflux_load(59u) == G2P_REFLUX_PHASE_ACCUMULATING;
    let ordered_coarse = selected_coarse
      && committed == expected && consumed == expected
      && g2p_reflux_load(59u) == G2P_REFLUX_PHASE_ENERGY_READY;
    let ordered = ordered_fine || ordered_coarse;
    if (g2p_reflux_load(2u) != G2P_REFLUX_READY_ADMITTED
        || !ordered
        || g2p_field_load(receipt + 4u) != select(consumed, expected, selected_coarse)
        || g2p_field_load(receipt + 12u) != g2p_reflux_load(83u)) {
      g2p_receipt_reject(false, !ordered, false);
      return;
    }
    if (selected_coarse) {
      loop {
        let ledger_claim = atomicCompareExchangeWeak(
          &cross_level_reflux[59u],
          G2P_REFLUX_PHASE_ENERGY_READY,
          G2P_REFLUX_PHASE_G2P_CLAIMED
        );
        if (ledger_claim.exchanged) { break; }
        if (ledger_claim.old_value != G2P_REFLUX_PHASE_ENERGY_READY) {
          g2p_receipt_reject(false, false, true);
          return;
        }
      }
      loop {
        let terminal_claim = atomicCompareExchangeWeak(
          &cross_level_reflux[80u], 0u, G2P_TERMINAL_CLAIMED
        );
        if (terminal_claim.exchanged) { break; }
        if (terminal_claim.old_value != 0u) {
          g2p_receipt_reject(
            terminal_claim.old_value == G2P_TERMINAL_CONSUMED,
            false,
            terminal_claim.old_value == G2P_TERMINAL_CLAIMED
          );
          return;
        }
      }
    }
  }
  g2p_field_store(receipt + 10u, 0u);
  g2p_field_store(receipt + 18u, 0u);
  g2p_field_store(receipt + 19u, 0u);
  loop {
    let field_claim = atomicCompareExchangeWeak(
      &mechanics_field_view[receipt + 3u],
      G2P_FIELD_RECEIPT_ENERGY_READY,
      G2P_FIELD_RECEIPT_G2P_CLAIMED
    );
    if (field_claim.exchanged) { break; }
    if (field_claim.old_value != G2P_FIELD_RECEIPT_ENERGY_READY) {
      g2p_receipt_reject(false, false, true);
      return;
    }
  }
}

fn g2p_field_specific_energy(field_index: u32, field_mass: f32) -> f32 {
  if (!(field_mass > 0.0)
      || !g2p_field_receipt_structural(G2P_FIELD_RECEIPT_G2P_CLAIMED)) {
    g2p_receipt_reject(false, true, false);
    return 0.0;
  }
  let accumulator = g2p_field_load(28u)
    + field_index * G2P_FIELD_ACCUMULATOR_WORDS;
  let heat_j = bitcast<f32>(g2p_field_load(accumulator));
  if (!(heat_j >= 0.0) || heat_j != heat_j
      || abs(heat_j) > 3.402823466e+38) {
    if (g2p_reflux_present()) {
      atomicOr(&cross_level_reflux[2u], G2P_REFLUX_NONFINITE);
    }
    g2p_receipt_reject(false, false, false);
    return 0.0;
  }
  return heat_j / field_mass;
}

fn g2p_field_pressure_specific_energy(
  field_index: u32,
  field_mass: f32
) -> f32 {
  if (!(field_mass > 0.0)
      || !g2p_field_receipt_structural(G2P_FIELD_RECEIPT_G2P_CLAIMED)) {
    g2p_receipt_reject(false, true, false);
    return 0.0;
  }
  let accumulator = g2p_field_load(28u)
    + field_index * G2P_FIELD_ACCUMULATOR_WORDS;
  let pressure_internal_compensation_j =
    bitcast<f32>(g2p_field_load(accumulator + 3u));
  if (pressure_internal_compensation_j
        != pressure_internal_compensation_j
      || abs(pressure_internal_compensation_j) > 3.402823466e+38) {
    if (g2p_reflux_present()) {
      atomicOr(&cross_level_reflux[2u], G2P_REFLUX_NONFINITE);
    }
    g2p_receipt_reject(false, false, false);
    return 0.0;
  }
  return pressure_internal_compensation_j / field_mass;
}

fn g2p_field_route_specific_energy(field_index: u32, field_mass: f32) -> f32 {
  if (!(field_mass > 0.0)
      || !g2p_field_receipt_structural(G2P_FIELD_RECEIPT_G2P_CLAIMED)) {
    g2p_receipt_reject(false, true, false);
    return 0.0;
  }
  let accumulator = g2p_field_load(28u)
    + field_index * G2P_FIELD_ACCUMULATOR_WORDS;
  let route_heat_j = bitcast<f32>(g2p_field_load(accumulator + 2u));
  if (!(route_heat_j >= 0.0) || route_heat_j != route_heat_j
      || abs(route_heat_j) > 3.402823466e+38) {
    if (g2p_reflux_present()) {
      atomicOr(&cross_level_reflux[2u], G2P_REFLUX_NONFINITE);
    }
    g2p_receipt_reject(false, false, false);
    return 0.0;
  }
  return route_heat_j / field_mass;
}

fn g2p_reflux_present() -> bool {
  return arrayLength(&cross_level_reflux) >= G2P_REFLUX_HEADER_WORDS
    && g2p_reflux_load(0u) == G2P_REFLUX_MAGIC;
}

fn g2p_reflux_admitted() -> bool {
  if (!g2p_reflux_present()) { return true; }
  let capacity = g2p_reflux_load(3u);
  let structural = g2p_reflux_load(1u) == G2P_REFLUX_VERSION
    && capacity > 0u
    && g2p_reflux_load(5u) == G2P_REFLUX_ROW_WORDS
    && g2p_reflux_load(6u) == G2P_REFLUX_HEADER_WORDS
    && G2P_REFLUX_HEADER_WORDS <= arrayLength(&cross_level_reflux)
    && capacity <= (
      arrayLength(&cross_level_reflux) - G2P_REFLUX_HEADER_WORDS
    ) / G2P_REFLUX_ROW_WORDS;
  if (!structural) { return false; }
  let selected_fine = params.schroeder_selected_level
    == bitcast<i32>(g2p_reflux_load(77u));
  let selected_coarse = params.schroeder_selected_level
    == bitcast<i32>(g2p_reflux_load(78u));
  if (!selected_fine && !selected_coarse) { return false; }
  let committed = g2p_reflux_load(8u);
  let consumed = g2p_reflux_load(15u);
  let expected = g2p_reflux_load(54u);
  let ordered = select(
    committed == consumed + 1u && committed <= expected
      && g2p_reflux_load(59u) == G2P_REFLUX_PHASE_ACCUMULATING,
    committed == expected && consumed == expected
      && g2p_reflux_load(59u) == G2P_REFLUX_PHASE_G2P_CLAIMED,
    selected_coarse
  );
  let coarse_registry_matches = !selected_coarse
    || g2p_reflux_load(4u) == g2p_field_load(34u);
  let coarse_provenance_matches = !selected_coarse || (
    g2p_reflux_load(62u) == g2p_field_load(63u)
    && g2p_reflux_load(63u)
      == ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT}u
    && g2p_reflux_load(64u) == g2p_field_load(3u)
    && g2p_reflux_load(65u) == g2p_field_load(4u)
    && g2p_reflux_load(66u) == g2p_field_load(5u)
    && g2p_reflux_load(67u) == g2p_field_load(6u)
    && g2p_reflux_load(68u) == g2p_field_load(7u)
    && g2p_reflux_load(69u) == g2p_field_load(8u)
    && g2p_reflux_load(70u) == g2p_field_load(9u)
    && g2p_reflux_load(71u) == g2p_field_load(10u)
    && g2p_reflux_load(72u) == g2p_field_load(11u)
    && g2p_reflux_load(73u) == g2p_field_load(12u)
    && g2p_reflux_load(74u) == g2p_field_load(13u)
    && g2p_reflux_load(75u) == g2p_field_load(14u)
    && g2p_reflux_load(76u) == g2p_field_load(15u)
  );
  return g2p_reflux_load(2u) == G2P_REFLUX_READY_ADMITTED
    && ordered
    && coarse_registry_matches
    && coarse_provenance_matches;
}

fn g2p_reflux_specific_energy(field_index: u32, field_mass: f32) -> f32 {
  if (!g2p_reflux_present()
      || params.schroeder_selected_level != bitcast<i32>(g2p_reflux_load(78u))
      || !(field_mass > 0.0)) { return 0.0; }
  if (field_index >= g2p_reflux_load(4u)) {
    g2p_receipt_reject(false, true, false);
    return 0.0;
  }
  let key_base = g2p_field_load(26u) + field_index * G2P_FIELD_KEY_WORDS;
  let row = G2P_REFLUX_HEADER_WORDS + field_index * G2P_REFLUX_ROW_WORDS;
  for (var word = 0u; word < 4u; word = word + 1u) {
    if (g2p_reflux_load(row + word) != g2p_field_load(key_base + word)) {
      g2p_receipt_reject(false, true, false);
      return 0.0;
    }
  }
  let frozen_mass = bitcast<f32>(g2p_reflux_load(row + 4u));
  let state = g2p_field_load(30u) + field_index * G2P_FIELD_STATE_WORDS;
  let contribution_count = max(1u, g2p_field_load(state + 7u));
  let n_epsilon = min(
    0.25,
    f32(contribution_count) * 5.960464477539063e-8
  );
  let gamma_n = n_epsilon / max(1.0e-20, 1.0 - n_epsilon);
  let mass_tolerance = max(
    8.0 * 1.175494351e-38,
    gamma_n * (abs(frozen_mass) + abs(field_mass))
  );
  if (abs(frozen_mass - field_mass) > mass_tolerance) {
    g2p_receipt_reject(false, true, false);
    return 0.0;
  }
  return bitcast<f32>(g2p_reflux_load(row + 8u)) / field_mass;
}

fn g2p_field_view_admitted_core() -> bool {
  let words = arrayLength(&mechanics_field_view);
  if (words < ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u) {
    return false;
  }
  let flags = g2p_field_load(2u);
  let field_capacity = g2p_field_load(32u);
  let field_count = g2p_field_load(34u);
  let state_offset = g2p_field_load(30u);
  let capacity_words = g2p_field_load(42u);
  return g2p_field_load(0u) == G2P_FIELD_MAGIC
    && g2p_field_load(1u) == G2P_FIELD_VERSION
    && flags == G2P_FIELD_READY_ADMITTED
    && g2p_field_load(3u) == params.schroeder_spatial_generation_id
    && g2p_field_load(4u) == params.schroeder_spatial_device_ordinal
    && g2p_field_load(5u) == params.schroeder_spatial_lane_ordinal
    && g2p_field_load(6u) == params.schroeder_spatial_lease_token
    && g2p_field_load(7u) == params.schroeder_spatial_source_family_id
    && g2p_field_load(8u) == params.schroeder_spatial_storage_generation
    && g2p_field_load(9u) == params.schroeder_spatial_physics_tick
    && g2p_field_load(10u) == params.schroeder_spatial_physics_substep
    && g2p_field_load(11u) == params.schroeder_spatial_position_epoch
    && g2p_field_load(12u) == params.schroeder_spatial_topology_epoch
    && g2p_field_load(13u) == params.schroeder_spatial_chart_epoch
    && g2p_field_load(14u) == params.schroeder_spatial_level_epoch
    && g2p_field_load(15u) == params.schroeder_spatial_support_epoch
    && g2p_field_load(16u) == params.particle_count
    && bitcast<i32>(g2p_field_load(17u)) == params.schroeder_selected_level
    && g2p_field_load(18u) == params.grid_node_count
    && g2p_field_load(19u) == params.grid_nx
    && g2p_field_load(20u) == params.grid_ny
    && g2p_field_load(21u) == params.grid_nz
    && g2p_field_load(22u) == params.shift
    && g2p_field_load(23u) == bitcast<u32>(params.grid_spacing_m)
    && g2p_field_load(24u)
      == ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u
    && g2p_field_load(25u) == G2P_FIELD_DESCRIPTOR_WORDS
    && g2p_field_load(27u) == G2P_FIELD_KEY_WORDS
    && g2p_field_load(31u) == G2P_FIELD_STATE_WORDS
    && g2p_field_load(59u)
      == ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT}u
    && g2p_field_load(63u) == params.schroeder_spatial_pad0
    && field_count <= field_capacity
    && capacity_words == words
    && state_offset <= capacity_words
    && field_capacity <= 357913941u
    && capacity_words - state_offset
      == field_capacity
        * (G2P_FIELD_STATE_WORDS + G2P_FIELD_PRESSURE_WORDS);
}

fn g2p_field_view_admitted_for_claim() -> bool {
  return g2p_field_view_admitted_core()
    && g2p_field_receipt_structural_core();
}

fn g2p_field_view_admitted() -> bool {
  return g2p_field_view_admitted_core()
    && g2p_field_receipt_structural(G2P_FIELD_RECEIPT_G2P_CLAIMED);
}

fn g2p_field_key_compare(field_index: u32, key: vec4<u32>) -> i32 {
  let base = g2p_field_load(26u) + field_index * G2P_FIELD_KEY_WORDS;
  for (var word = 0u; word < G2P_FIELD_KEY_WORDS; word = word + 1u) {
    let candidate = g2p_field_load(base + word);
    if (candidate < key[word]) { return -1; }
    if (candidate > key[word]) { return 1; }
  }
  return 0;
}

fn g2p_field_find(
  particle_index: u32,
  stencil_ordinal: u32,
  node_index: u32
) -> u32 {
  if (!g2p_field_view_admitted()) { return G2P_FIELD_INVALID_INDEX; }
  if (stencil_ordinal >= 27u) { return G2P_FIELD_INVALID_INDEX; }
  let descriptor_base = g2p_field_load(24u)
    + particle_index * G2P_FIELD_DESCRIPTOR_WORDS;
  let descriptor = vec4<u32>(
    g2p_field_load(descriptor_base),
    g2p_field_load(descriptor_base + 1u),
    g2p_field_load(descriptor_base + 2u),
    g2p_field_load(descriptor_base + 3u)
  );
  if (descriptor.w != 1u) { return G2P_FIELD_INVALID_INDEX; }
  let field_index = g2p_field_load(descriptor_base + 4u + stencil_ordinal);
  if (field_index >= g2p_field_load(34u)) {
    return G2P_FIELD_INVALID_INDEX;
  }
  let key = vec4<u32>(node_index, descriptor.x, descriptor.y, descriptor.z);
  return select(
    G2P_FIELD_INVALID_INDEX,
    field_index,
    g2p_field_key_compare(field_index, key) == 0
  );
}

fn g2p_scale_close(left: f32, right: f32, count: u32) -> bool {
  if (left != left || right != right
      || abs(left) > 3.402823466e+38
      || abs(right) > 3.402823466e+38) { return false; }
  let n_epsilon = min(0.25, f32(max(1u, count)) * 5.960464477539063e-8);
  let gamma_n = n_epsilon / max(1.0e-20, 1.0 - n_epsilon);
  let tolerance = max(
    8.0 * 1.175494351e-38,
    gamma_n * (abs(left) + abs(right))
  );
  return abs(left - right) <= tolerance;
}

fn g2p_conditioned_scale_close(
  left: f32,
  right: f32,
  operation_conditioning: f32,
  count: u32
) -> bool {
  if (left != left || right != right
      || operation_conditioning != operation_conditioning
      || operation_conditioning < 0.0
      || abs(left) > 3.402823466e+38
      || abs(right) > 3.402823466e+38
      || operation_conditioning > 3.402823466e+38) { return false; }
  let n_epsilon = min(0.25, f32(max(1u, count)) * 5.960464477539063e-8);
  let gamma_n = n_epsilon / max(1.0e-20, 1.0 - n_epsilon);
  let scale = max(abs(left) + abs(right), operation_conditioning);
  if (scale != scale || scale > 3.402823466e+38) { return false; }
  let tolerance = max(
    8.0 * 1.175494351e-38,
    gamma_n * scale
  );
  return abs(left - right) <= tolerance;
}

fn g2p_field_absolute_pressure(
  field_index: u32
) -> vec2<f32> {
  if (field_index >= g2p_field_load(34u)) {
    return vec2<f32>(0.0, 0.0);
  }
  let row =
    g2p_field_pressure_offset() + field_index * G2P_FIELD_PRESSURE_WORDS;
  if (row < g2p_field_pressure_offset()
      || row + G2P_FIELD_PRESSURE_WORDS
        > arrayLength(&mechanics_field_view)) {
    return vec2<f32>(0.0, 0.0);
  }
  let pressure_volume_moment = bitcast<f32>(g2p_field_load(row));
  let represented_volume = bitcast<f32>(g2p_field_load(row + 1u));
  let absolute_pressure = bitcast<f32>(g2p_field_load(row + 2u));
  let contribution_count = g2p_field_load(row + 3u);
  let valid = represented_volume > 0.0
    && absolute_pressure >= 0.0
    && contribution_count > 0u
    && pressure_volume_moment == pressure_volume_moment
    && represented_volume == represented_volume
    && absolute_pressure == absolute_pressure
    && abs(pressure_volume_moment) <= 3.402823466e+38
    && abs(represented_volume) <= 3.402823466e+38
    && abs(absolute_pressure) <= 3.402823466e+38
    && g2p_scale_close(
      pressure_volume_moment,
      represented_volume * absolute_pressure,
      max(2u, contribution_count)
    );
  return vec2<f32>(
    select(0.0, absolute_pressure, valid),
    select(0.0, 1.0, valid)
  );
}


fn g2p_saturating_product(left: u32, right: u32) -> u32 {
  if (left == 0u || right == 0u) { return 0u; }
  // Cross-level mechanics supports r <= 4, so every evidence product uses at
  // most r + 1.
  // Keep the malformed-input guard division-free; some Vulkan Tint/SPIR-V
  // stacks have crashed while lowering a variable unsigned divisor here.
  if (right > 5u || left > 0x33333333u) { return 0xffffffffu; }
  return left * right;
}

fn g2p_saturating_add(left: u32, right: u32) -> u32 {
  if (left > 0xffffffffu - right) { return 0xffffffffu; }
  return left + right;
}

fn g2p_energy_finite(value: f32) -> bool {
  // Inspect the exponent: floating-point self-comparisons can be optimized
  // under finite-math assumptions and did not reject a stored NaN on device.
  return (bitcast<u32>(value) & 0x7f800000u) != 0x7f800000u;
}

@compute @workgroup_size(64)
fn measure_g2p_energy_receipt(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle = global_id.x;
  if (particle >= params.particle_count
      || !g2p_field_receipt_structural(G2P_FIELD_RECEIPT_G2P_CLAIMED)) {
    return;
  }
  let state = particle * 2u;
  let mass = sph_state[state].w;
  let prior = sph_state[state + 1u].w;
  let next = out_sph_state[state + 1u].w;
  // prior/next are gauge-relative specific energies (phase-caloric ice is
  // negative), so only their finiteness is structural.
  if (!(mass >= 0.0) || !g2p_energy_finite(mass)
      || !g2p_energy_finite(prior) || !g2p_energy_finite(next)) {
    g2p_receipt_reject(false, false, false);
    return;
  }
  let delta_j = mass * (next - prior);
  // Pressure compensation is signed: reversible mechanical work can remove
  // internal energy, even when dissipative heat is nonnegative. Protect the
  // absolute energies of positive-mass particles above, not the delta's sign.
  // Finite zero-mass tombstone energy lanes remain irrelevant. This f32 state
  // difference has ulp(u) conditioning, so it is diagnostic rather than an
  // exact measured-vs-expected equality gate. Published-vs-consumed heat and
  // pressure-compensation accounting is enforced separately below.
  if (!g2p_energy_finite(delta_j)) {
    g2p_receipt_reject(false, false, false);
    return;
  }
  if (mass > 0.0) {
    if (!g2p_atomic_add_f32_field(
        g2p_field_receipt_offset() + 19u,
        delta_j
      )) {
      g2p_receipt_reject(false, false, false);
      return;
    }
    if (g2p_reflux_present() && !g2p_reflux_increment_checked(94u)) {
      g2p_receipt_reject(false, false, false);
    }
  }
}

@compute @workgroup_size(1)
fn consume_g2p_energy_receipt() {
  if (g2p_spatial_authority_rejected()
      || !g2p_field_receipt_structural(G2P_FIELD_RECEIPT_G2P_CLAIMED)) {
    g2p_receipt_reject(false, true, false);
    return;
  }
  let receipt = g2p_field_receipt_offset();
  let published_field_heat = bitcast<f32>(g2p_field_load(receipt + 9u));
  let consumed_field_heat = bitcast<f32>(g2p_field_load(receipt + 10u));
  let published_pressure_internal_compensation =
    bitcast<f32>(g2p_field_load(receipt + 17u));
  let consumed_pressure_internal_compensation =
    bitcast<f32>(g2p_field_load(receipt + 18u));
  let measured_particle_internal_energy_delta =
    bitcast<f32>(g2p_field_load(receipt + 19u));
  // Fine route heat is included in the field accumulator. Terminal coarse
  // route heat is deliberately published through reflux row8 instead, so its
  // already-measured transpose (H115) must participate in this receipt close.
  var consumed_coarse_reflux_heat = 0.0;
  if (g2p_reflux_present() && g2p_selected_is_coarse()) {
    consumed_coarse_reflux_heat =
      bitcast<f32>(g2p_reflux_load(115u));
  }
  // This close compares sums assembled by field-row reduction, 27-point
  // transpose interpolation, and particle receipt reduction. Particle count
  // alone is not a valid rounding bound. Cross-level H94 is the measured
  // contribution count; the local fallback conservatively counts one
  // interpolation plus one particle reduction per stencil sample and every
  // published field row.
  let local_energy_evidence_count = g2p_saturating_add(
    select(
      0xffffffffu,
      params.particle_count * 28u,
      params.particle_count <= 0x09249249u
    ),
    g2p_field_load(34u)
  );
  var energy_evidence_count = local_energy_evidence_count;
  if (g2p_reflux_present()) {
    energy_evidence_count = max(
      energy_evidence_count,
      g2p_reflux_load(94u)
    );
  }
  // The exact accounting gates are published-vs-consumed: both sides come from
  // the same well-conditioned accumulators. The particle-side measurement is
  // a state difference whose error is ulp(u) per particle, so it is not an
  // exact measured-vs-expected equality gate. measure_g2p_energy_receipt admits
  // either finite delta sign while protecting absolute positive-mass energy.
  // The measured sum must remain finite before this receipt can close.
  if (!g2p_energy_finite(measured_particle_internal_energy_delta)
      || !g2p_scale_close(
      published_field_heat,
      consumed_field_heat,
      energy_evidence_count
    ) || !g2p_scale_close(
      published_pressure_internal_compensation,
      consumed_pressure_internal_compensation,
      energy_evidence_count
    )) {
    g2p_receipt_reject(false, false, false);
    return;
  }
  if (g2p_reflux_present()
      && !g2p_atomic_add_f32_reflux(
        84u,
        consumed_field_heat + consumed_coarse_reflux_heat
      )) {
    g2p_receipt_reject(false, false, false);
    return;
  }
  loop {
    let field_consume = atomicCompareExchangeWeak(
      &mechanics_field_view[receipt + 3u],
      G2P_FIELD_RECEIPT_G2P_CLAIMED,
      G2P_FIELD_RECEIPT_CONSUMED
    );
    if (field_consume.exchanged) { break; }
    if (field_consume.old_value != G2P_FIELD_RECEIPT_G2P_CLAIMED) {
      g2p_receipt_reject(
        field_consume.old_value == G2P_FIELD_RECEIPT_CONSUMED,
        false,
        true
      );
      return;
    }
  }
}

@compute @workgroup_size(1)
fn consume_g2p_fine_reflux_receipt() {
  if (!g2p_reflux_present() || g2p_selected_is_coarse()) { return; }
  if (g2p_spatial_authority_rejected()
      || !g2p_field_receipt_structural(G2P_FIELD_RECEIPT_CONSUMED)) {
    g2p_receipt_reject(false, true, false);
    return;
  }
  let committed = g2p_reflux_load(8u);
  let consumed = g2p_reflux_load(15u);
  let expected = g2p_reflux_load(54u);
  if (consumed == 0xffffffffu
      || committed != consumed + 1u || committed > expected) {
    g2p_receipt_reject(false, true, false);
    return;
  }
  let fine_evidence_count = g2p_saturating_product(
    params.particle_count, committed
  );
  let published_fine_route = bitcast<f32>(g2p_reflux_load(112u));
  let consumed_fine_route = bitcast<f32>(g2p_reflux_load(114u));
  let published_local_heat = bitcast<f32>(g2p_reflux_load(116u));
  let consumed_local_heat = bitcast<f32>(g2p_reflux_load(117u));
  if (!g2p_scale_close(
      published_fine_route,
      consumed_fine_route,
      fine_evidence_count
    )) {
    g2p_receipt_reject(false, false, false);
    return;
  }
  // Local heat is reconstructed on particles as (field total - routed heat).
  // That subtraction is conditioned by both large operands, not by the tiny
  // remainder alone. Keep the independently published local ledger as the
  // target, but bound its transpose residual by the actual decomposition.
  let fine_heat_decomposition_conditioning =
    abs(published_fine_route) + abs(consumed_fine_route)
      + abs(published_local_heat) + abs(consumed_local_heat);
  if (!g2p_conditioned_scale_close(
      published_local_heat,
      consumed_local_heat,
      fine_heat_decomposition_conditioning,
      fine_evidence_count
    )) {
    g2p_receipt_reject(false, false, false);
    return;
  }
  let measured_particle_heat = bitcast<f32>(g2p_reflux_load(84u));
  let intended_particle_heat = consumed_fine_route + consumed_local_heat;
  if (!g2p_scale_close(
      measured_particle_heat, intended_particle_heat, fine_evidence_count
    )) {
    g2p_receipt_reject(false, false, false);
    return;
  }
  if (!g2p_reflux_increment_checked(120u)) {
    g2p_receipt_reject(false, true, false);
    return;
  }
  loop {
    let advanced = atomicCompareExchangeWeak(
      &cross_level_reflux[15u], consumed, committed
    );
    if (advanced.exchanged) { break; }
    if (advanced.old_value != consumed) {
      g2p_receipt_reject(false, false, true);
      return;
    }
  }
}

@compute @workgroup_size(1)
fn consume_g2p_coarse_reflux_receipt() {
  if (!g2p_reflux_present() || !g2p_selected_is_coarse()) { return; }
  if (g2p_spatial_authority_rejected()
      || !g2p_field_receipt_structural(G2P_FIELD_RECEIPT_CONSUMED)) {
    g2p_receipt_reject(false, true, false);
    return;
  }
  let committed = g2p_reflux_load(8u);
  let consumed = g2p_reflux_load(15u);
  let expected = g2p_reflux_load(54u);
  let route_target = bitcast<f32>(g2p_reflux_load(30u));
  let route_consumed = bitcast<f32>(g2p_reflux_load(114u))
    + bitcast<f32>(g2p_reflux_load(115u));
  let actual_total_consumed = bitcast<f32>(g2p_reflux_load(84u));
  let published_local_heat = bitcast<f32>(g2p_reflux_load(116u));
  let consumed_local_heat = bitcast<f32>(g2p_reflux_load(117u));
  let published_total = route_target + published_local_heat;
  if (committed != expected || consumed != expected
      || g2p_reflux_load(97u) != g2p_reflux_load(98u)
      || g2p_reflux_load(111u) != g2p_reflux_load(98u) + 1u
      || g2p_reflux_load(9u) != g2p_reflux_load(4u)
      || g2p_reflux_load(124u) != 0xffffffffu
      || g2p_reflux_load(125u) != 0u) {
    g2p_receipt_reject(false, true, false);
    return;
  }
  let macro_evidence_count = g2p_saturating_product(
    params.particle_count, expected + 1u
  );
  if (!g2p_scale_close(
      route_target,
      route_consumed,
      macro_evidence_count
    )) {
    g2p_receipt_reject(false, false, false);
    return;
  }
  if (!g2p_scale_close(
      published_total,
      actual_total_consumed,
      macro_evidence_count
    )) {
    g2p_receipt_reject(false, false, false);
    return;
  }
  if (!g2p_scale_close(
      bitcast<f32>(g2p_reflux_load(112u)),
      bitcast<f32>(g2p_reflux_load(114u)),
      g2p_saturating_product(params.particle_count, expected)
    )) {
    g2p_receipt_reject(false, false, false);
    return;
  }
  if (!g2p_scale_close(
      bitcast<f32>(g2p_reflux_load(113u)),
      bitcast<f32>(g2p_reflux_load(115u)),
      params.particle_count
    )) {
    g2p_receipt_reject(false, false, false);
    return;
  }
  let macro_heat_decomposition_conditioning =
    abs(route_target) + abs(route_consumed)
      + abs(published_local_heat) + abs(consumed_local_heat);
  if (!g2p_conditioned_scale_close(
      published_local_heat,
      consumed_local_heat,
      macro_heat_decomposition_conditioning,
      macro_evidence_count
    )) {
    g2p_receipt_reject(false, false, false);
    return;
  }
  if (g2p_reflux_load(99u) != 1u
      || !g2p_reflux_increment_checked(96u)
      || g2p_reflux_load(96u) != 1u
      || !g2p_reflux_increment_checked(121u)) {
    g2p_receipt_reject(false, true, false);
    return;
  }
  g2p_reflux_store(100u, 1u);
  g2p_reflux_store(101u, 1u);
  g2p_reflux_store(102u, 1u);
  g2p_reflux_store(103u, 1u);
  g2p_reflux_store(118u, 1u);
  g2p_reflux_store(119u, 1u);
  g2p_reflux_store(59u, G2P_REFLUX_PHASE_CONSUMED);
  let token = (
    g2p_reflux_load(82u)
      ^ (g2p_reflux_load(83u) * 0x9e3779b9u)
      ^ (g2p_reflux_load(111u) * 0x85ebca6bu)
  ) | 1u;
  g2p_reflux_store(80u, G2P_TERMINAL_CONSUMED);
  g2p_reflux_store(81u, token);
  // Publication token is the persistent transaction commit word and is last.
  g2p_reflux_store(95u, token);
}

fn g2p_quadratic_weights(fx: f32) -> vec3<f32> {`
      },
      {
        slot: 'mechanics-field-g2p-inactive-carrier-copy',
        match: `  let pos_mass = sph_state[state_base];
  let vel_u = sph_state[state_base + 1u];`,
        code: `  let pos_mass = sph_state[state_base];
  let vel_u = sph_state[state_base + 1u];
  // Fixed-capacity reaction and phase-companion rows are valid retained
  // storage, but deliberately have no mechanics-field descriptor while
  // empty. Preserve them without turning that expected absence into a
  // generation-wide exact-key rejection.
  if (!(pos_mass.w > 0.0)) {
    g2p_copy_input_particle(state_base, mechanics_base);
    return;
  }
  if (!g2p_reflux_admitted()) {
    g2p_spatial_reject(17u);
    g2p_copy_input_particle(state_base, mechanics_base);
    return;
  }`
      },
      {
        slot: 'mechanics-field-g2p-sample',
        match: `        let idx = g2p_grid_index(node_i, node_j, node_k);
        let grid_row = updated_grid_nodes[idx * 2u];
        let grid_meta = updated_grid_nodes[idx * 2u + 1u];
        if (!(grid_row.x > 0.0) && !(grid_meta.w > 0.0)) {
          continue;
        }
        sampled_weight = sampled_weight + weight;
        let grid_velocity = grid_row.yzw;`,
        code: `        let idx = g2p_grid_index(node_i, node_j, node_k);
        let field_index = g2p_field_find(
          particle_index,
          u32(a * 9i + b * 3i + c),
          idx
        );
        if (field_index == G2P_FIELD_INVALID_INDEX) {
          g2p_spatial_reject(17u);
          continue;
        }
        let state_base = g2p_field_load(30u)
          + field_index * G2P_FIELD_STATE_WORDS;
        let field_mass = bitcast<f32>(g2p_field_load(state_base));
        let field_status = g2p_field_load(state_base + 7u);
        if (!(field_mass > 0.0) || field_status == 0u) {
          continue;
        }
        let field_pressure = g2p_field_absolute_pressure(field_index);
        if (field_pressure.y != 1.0) {
          sampled_pressure_valid = false;
          g2p_spatial_reject(17u);
          continue;
        }
        let field_pressure_bits = bitcast<u32>(field_pressure.x);
        if (!sampled_pressure_initialized) {
          sampled_pressure_initialized = true;
          sampled_pressure_common_bits = field_pressure_bits;
        } else if (field_pressure_bits != sampled_pressure_common_bits) {
          sampled_pressure_uniform = false;
        }
        sampled_absolute_pressure =
          sampled_absolute_pressure + weight * field_pressure.x;
        sampled_pressure_weight = sampled_pressure_weight + weight;
        sampled_weight = sampled_weight + weight;
        let grid_velocity = vec3<f32>(
          bitcast<f32>(g2p_field_load(state_base + 1u)),
          bitcast<f32>(g2p_field_load(state_base + 2u)),
          bitcast<f32>(g2p_field_load(state_base + 3u))
        );
        let field_specific_energy = g2p_field_specific_energy(
          field_index, field_mass
        );
        let field_pressure_specific_energy =
          g2p_field_pressure_specific_energy(field_index, field_mass);
        let field_route_specific_energy = g2p_field_route_specific_energy(
          field_index, field_mass
        );
        let reflux_specific_energy = g2p_reflux_specific_energy(
          field_index, field_mass
        );
        sampled_internal_energy_delta = sampled_internal_energy_delta
          + weight * (
            field_specific_energy
              + field_pressure_specific_energy
              + reflux_specific_energy
          );
        sampled_field_internal_energy_delta =
          sampled_field_internal_energy_delta
          + weight * field_specific_energy;
        sampled_pressure_internal_energy_delta =
          sampled_pressure_internal_energy_delta
          + weight * field_pressure_specific_energy;
        sampled_field_route_internal_energy_delta =
          sampled_field_route_internal_energy_delta
          + weight * field_route_specific_energy;
        sampled_route_internal_energy_delta =
          sampled_route_internal_energy_delta
          + weight * (field_route_specific_energy + reflux_specific_energy);`
      },
      {
        slot: 'mechanics-field-g2p-energy-accumulator',
        match: '  var sampled_weight = 0.0;',
        code: `  var sampled_weight = 0.0;
  // Keep the energy transpose on the raw P2G basis. Velocity reconstruction
  // may renormalize clipped support, but doing that to energy would violate
  // sum_p m_p * sum_i(w_pi * E_i/m_i) == sum_i E_i.
  var sampled_internal_energy_delta = 0.0;
  var sampled_field_internal_energy_delta = 0.0;
  var sampled_pressure_internal_energy_delta = 0.0;
  var sampled_field_route_internal_energy_delta = 0.0;
  var sampled_route_internal_energy_delta = 0.0;
  var sampled_absolute_pressure = 0.0;
  var sampled_pressure_weight = 0.0;
  var sampled_pressure_common_bits = 0u;
  var sampled_pressure_initialized = false;
  var sampled_pressure_uniform = true;
  var sampled_pressure_valid = true;`
      },
      {
        slot: 'mechanics-field-g2p-energy-deposit',
        match: '  out_sph_state[state_base + 1u] = vec4<f32>(velocity.x, velocity.y, velocity.z, vel_u.w);',
        code: `  var resolved_absolute_pressure = 0.0;
  if (sampled_pressure_initialized && sampled_pressure_weight > 0.0) {
    if (sampled_pressure_uniform) {
      // Preserve an exactly uniform/reference pressure bitwise. This avoids
      // turning log(P/Pref) into a one-ULP non-identity in the thermal pass.
      resolved_absolute_pressure =
        bitcast<f32>(sampled_pressure_common_bits);
    } else {
      resolved_absolute_pressure =
        sampled_absolute_pressure / sampled_pressure_weight;
    }
  }
  let next_internal_energy = vel_u.w + sampled_internal_energy_delta;
  // Specific internal energy is gauge-relative: a phase-caloric table zeroes
  // liquid at the triple point, so ice is legitimately negative. Mechanics
  // admits any finite value; the caloric domain belongs to the thermal graph.
  if (next_internal_energy != next_internal_energy
      || abs(next_internal_energy) > 3.402823466e+38
      || !sampled_pressure_valid
      || !sampled_pressure_initialized
      || !(sampled_pressure_weight > 0.0)
      || resolved_absolute_pressure != resolved_absolute_pressure
      || resolved_absolute_pressure < 0.0
      || abs(resolved_absolute_pressure) > 3.402823466e+38
      || sampled_field_internal_energy_delta
        != sampled_field_internal_energy_delta
      || abs(sampled_field_internal_energy_delta) > 3.402823466e+38
      || sampled_field_internal_energy_delta < 0.0
      || sampled_pressure_internal_energy_delta
        != sampled_pressure_internal_energy_delta
      || abs(sampled_pressure_internal_energy_delta) > 3.402823466e+38
      || sampled_field_route_internal_energy_delta
        != sampled_field_route_internal_energy_delta
      || abs(sampled_field_route_internal_energy_delta) > 3.402823466e+38
      || sampled_field_route_internal_energy_delta < 0.0
      || sampled_route_internal_energy_delta != sampled_route_internal_energy_delta
      || abs(sampled_route_internal_energy_delta) > 3.402823466e+38
      || sampled_route_internal_energy_delta < 0.0) {
    g2p_spatial_reject(17u);
    g2p_copy_input_particle(state_base, mechanics_base);
    return;
  }
  if (!g2p_atomic_add_f32_field(
      g2p_field_receipt_offset() + 10u,
      pos_mass.w * sampled_field_internal_energy_delta
    )) {
    g2p_receipt_reject(false, false, false);
    g2p_copy_input_particle(state_base, mechanics_base);
    return;
  }
  if (!g2p_atomic_add_f32_field(
      g2p_field_receipt_offset() + 18u,
      pos_mass.w * sampled_pressure_internal_energy_delta
    )) {
    g2p_receipt_reject(false, false, false);
    g2p_copy_input_particle(state_base, mechanics_base);
    return;
  }
  if (g2p_reflux_present()) {
    let consumed_route_j = pos_mass.w * sampled_route_internal_energy_delta;
    let consumed_local_j = pos_mass.w * max(
      0.0,
      sampled_field_internal_energy_delta
        - sampled_field_route_internal_energy_delta
    );
    let route_split_word = select(114u, 115u, g2p_selected_is_coarse());
    if (!g2p_atomic_add_f32_reflux(route_split_word, consumed_route_j)
        || !g2p_atomic_add_f32_reflux(117u, consumed_local_j)) {
      g2p_receipt_reject(false, false, false);
      g2p_copy_input_particle(state_base, mechanics_base);
      return;
    }
  }
  out_sph_state[state_base + 1u] = vec4<f32>(
    velocity.x, velocity.y, velocity.z, next_internal_energy
  );`
      },
      {
        slot: 'mechanics-field-g2p-resolved-pressure-publication',
        match: '  out_mls_mechanics[mechanics_base + 7u] = row7;',
        code: `  out_mls_mechanics[mechanics_base + 7u] = vec4<f32>(
    resolved_absolute_pressure, row7.y, row7.z, row7.w
  );`
      },
      {
        slot: 'mechanics-field-g2p-canonical-rollback-receipt',
        match: '    g2p_copy_input_particle(particle_index * 2u, particle_index * 8u);',
        code: `    g2p_copy_input_particle(particle_index * 2u, particle_index * 8u);
    // Canonical final rollback is the only place that can see receipt-stage
    // rejection after candidate reconstruction. Particle zero publishes one
    // durable rollback event while every invocation preserves bitwise input.
    if (particle_index == 0u && g2p_reflux_present()) {
      _ = g2p_reflux_increment_checked(122u);
    }`
      }
    ]
  }));
}

function createSingleLevelMechanicsFieldG2pWgsl(
  sourceWgsl,
  variantId = 'single-level-mechanics-field'
) {
  return recordWgslVariantManifest(composeWgslVariantFromSource({
    moduleId: 'mls-mpm-g2p',
    variantId,
    baseSource: sourceWgsl,
    slots: [
      {
        slot: 'single-level-mechanics-field-static-no-reflux',
        match: `fn g2p_reflux_present() -> bool {
  return arrayLength(&cross_level_reflux) >= G2P_REFLUX_HEADER_WORDS
    && g2p_reflux_load(0u) == G2P_REFLUX_MAGIC;
}`,
        code: `fn g2p_reflux_present() -> bool {
  // runFusedNoFullMlsMpmMechanicsWebGpu always binds the dummy ledger.
  return false;
}`
      },
      {
        slot: 'single-level-mechanics-field-per-particle-admission',
        match: `  if (!g2p_reflux_admitted()) {
    g2p_spatial_reject(17u);
    g2p_copy_input_particle(state_base, mechanics_base);
    return;
  }`,
        code: `  // The field header and claimed local-energy receipt are immutable for
  // this dispatch, so authenticate them once per particle rather than once
  // for every stencil sample.
  if (!g2p_field_view_admitted()) {
    g2p_spatial_reject(17u);
    g2p_copy_input_particle(state_base, mechanics_base);
    return;
  }`
      },
      {
        slot: 'single-level-mechanics-field-stencil-admission-hoist',
        match: '  if (!g2p_field_view_admitted()) { return G2P_FIELD_INVALID_INDEX; }',
        code: '  // Field admission was authenticated once by this particle invocation.'
      },
      {
        slot: 'single-level-mechanics-field-energy-admission-hoist',
        match: `fn g2p_field_specific_energy(field_index: u32, field_mass: f32) -> f32 {
  if (!(field_mass > 0.0)
      || !g2p_field_receipt_structural(G2P_FIELD_RECEIPT_G2P_CLAIMED)) {
    g2p_receipt_reject(false, true, false);
    return 0.0;
  }
  let accumulator = g2p_field_load(28u)
    + field_index * G2P_FIELD_ACCUMULATOR_WORDS;
  let heat_j = bitcast<f32>(g2p_field_load(accumulator));
  if (!(heat_j >= 0.0) || heat_j != heat_j
      || abs(heat_j) > 3.402823466e+38) {
    if (g2p_reflux_present()) {
      atomicOr(&cross_level_reflux[2u], G2P_REFLUX_NONFINITE);
    }
    g2p_receipt_reject(false, false, false);
    return 0.0;
  }
  return heat_j / field_mass;
}`,
        code: `fn g2p_field_specific_energy(field_index: u32, field_mass: f32) -> f32 {
  // Admission and receipt phase were authenticated once before the stencil.
  if (!(field_mass > 0.0)) {
    g2p_receipt_reject(false, true, false);
    return 0.0;
  }
  let accumulator = g2p_field_load(28u)
    + field_index * G2P_FIELD_ACCUMULATOR_WORDS;
  let heat_j = bitcast<f32>(g2p_field_load(accumulator));
  if (!(heat_j >= 0.0) || heat_j != heat_j
      || abs(heat_j) > 3.402823466e+38) {
    g2p_receipt_reject(false, false, false);
    return 0.0;
  }
  return heat_j / field_mass;
}`
      },
      {
        slot: 'single-level-mechanics-field-pressure-energy-admission-hoist',
        match: `fn g2p_field_pressure_specific_energy(
  field_index: u32,
  field_mass: f32
) -> f32 {
  if (!(field_mass > 0.0)
      || !g2p_field_receipt_structural(G2P_FIELD_RECEIPT_G2P_CLAIMED)) {
    g2p_receipt_reject(false, true, false);
    return 0.0;
  }
  let accumulator = g2p_field_load(28u)
    + field_index * G2P_FIELD_ACCUMULATOR_WORDS;
  let pressure_internal_compensation_j =
    bitcast<f32>(g2p_field_load(accumulator + 3u));
  if (pressure_internal_compensation_j
        != pressure_internal_compensation_j
      || abs(pressure_internal_compensation_j) > 3.402823466e+38) {
    if (g2p_reflux_present()) {
      atomicOr(&cross_level_reflux[2u], G2P_REFLUX_NONFINITE);
    }
    g2p_receipt_reject(false, false, false);
    return 0.0;
  }
  return pressure_internal_compensation_j / field_mass;
}`,
        code: `fn g2p_field_pressure_specific_energy(
  field_index: u32,
  field_mass: f32
) -> f32 {
  // Admission and receipt phase were authenticated once before the stencil.
  if (!(field_mass > 0.0)) {
    g2p_receipt_reject(false, true, false);
    return 0.0;
  }
  let accumulator = g2p_field_load(28u)
    + field_index * G2P_FIELD_ACCUMULATOR_WORDS;
  let pressure_internal_compensation_j =
    bitcast<f32>(g2p_field_load(accumulator + 3u));
  if (pressure_internal_compensation_j
        != pressure_internal_compensation_j
      || abs(pressure_internal_compensation_j) > 3.402823466e+38) {
    g2p_receipt_reject(false, false, false);
    return 0.0;
  }
  return pressure_internal_compensation_j / field_mass;
}`
      },
      {
        slot: 'single-level-mechanics-field-g2p-sample',
        match: `        let field_specific_energy = g2p_field_specific_energy(
          field_index, field_mass
        );
        let field_pressure_specific_energy =
          g2p_field_pressure_specific_energy(field_index, field_mass);
        let field_route_specific_energy = g2p_field_route_specific_energy(
          field_index, field_mass
        );
        let reflux_specific_energy = g2p_reflux_specific_energy(
          field_index, field_mass
        );
        sampled_internal_energy_delta = sampled_internal_energy_delta
          + weight * (
            field_specific_energy
              + field_pressure_specific_energy
              + reflux_specific_energy
          );
        sampled_field_internal_energy_delta =
          sampled_field_internal_energy_delta
          + weight * field_specific_energy;
        sampled_pressure_internal_energy_delta =
          sampled_pressure_internal_energy_delta
          + weight * field_pressure_specific_energy;
        sampled_field_route_internal_energy_delta =
          sampled_field_route_internal_energy_delta
          + weight * field_route_specific_energy;
        sampled_route_internal_energy_delta =
          sampled_route_internal_energy_delta
          + weight * (field_route_specific_energy + reflux_specific_energy);`,
        code: `        // This fused route always binds the four-word dummy reflux buffer.
        // Preserve the local field-energy transpose, but do not authenticate or
        // sample cross-level route/reflux state that cannot exist here.
        let field_specific_energy = g2p_field_specific_energy(
          field_index, field_mass
        );
        let field_pressure_specific_energy =
          g2p_field_pressure_specific_energy(field_index, field_mass);
        sampled_internal_energy_delta = sampled_internal_energy_delta
          + weight * (
            field_specific_energy + field_pressure_specific_energy
          );
        sampled_field_internal_energy_delta =
          sampled_field_internal_energy_delta
          + weight * field_specific_energy;
        sampled_pressure_internal_energy_delta =
          sampled_pressure_internal_energy_delta
          + weight * field_pressure_specific_energy;`
      },
      {
        slot: 'single-level-mechanics-field-route-accumulators',
        match: `  var sampled_field_route_internal_energy_delta = 0.0;
  var sampled_route_internal_energy_delta = 0.0;`,
        code: ''
      },
      {
        slot: 'single-level-mechanics-field-route-validation',
        match: `      || sampled_field_route_internal_energy_delta
        != sampled_field_route_internal_energy_delta
      || abs(sampled_field_route_internal_energy_delta) > 3.402823466e+38
      || sampled_field_route_internal_energy_delta < 0.0
      || sampled_route_internal_energy_delta != sampled_route_internal_energy_delta
      || abs(sampled_route_internal_energy_delta) > 3.402823466e+38
      || sampled_route_internal_energy_delta < 0.0`,
        code: ''
      },
      {
        slot: 'single-level-mechanics-field-route-deposit',
        match: `  if (g2p_reflux_present()) {
    let consumed_route_j = pos_mass.w * sampled_route_internal_energy_delta;
    let consumed_local_j = pos_mass.w * max(
      0.0,
      sampled_field_internal_energy_delta
        - sampled_field_route_internal_energy_delta
    );
    let route_split_word = select(114u, 115u, g2p_selected_is_coarse());
    if (!g2p_atomic_add_f32_reflux(route_split_word, consumed_route_j)
        || !g2p_atomic_add_f32_reflux(117u, consumed_local_j)) {
      g2p_receipt_reject(false, false, false);
      g2p_copy_input_particle(state_base, mechanics_base);
      return;
    }
  }
`,
        code: ''
      },
      {
        slot: 'single-level-mechanics-field-g2p-canonical-rollback',
        match: `    g2p_copy_input_particle(particle_index * 2u, particle_index * 8u);
    // Canonical final rollback is the only place that can see receipt-stage
    // rejection after candidate reconstruction. Particle zero publishes one
    // durable rollback event while every invocation preserves bitwise input.
    if (particle_index == 0u && g2p_reflux_present()) {
      _ = g2p_reflux_increment_checked(122u);
    }`,
        code: `    // Single-level finalization has no cross-level terminal receipt.
    g2p_copy_input_particle(particle_index * 2u, particle_index * 8u);`
      }
    ]
  }));
}

// Fused grid-update params are bound to the mechanics-field grid-update
// kernels, whose GridUpdateParams view is 256 bytes (see that WGSL).
export const FUSED_GRID_UPDATE_PARAMS_BYTES = 256;

export const mlsMpmMechanicsFieldGridUpdateWgsl = `
struct GridUpdateParams {
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  receipt_mode_flags: u32,
  pad_u1: u32,
  pad_u2: u32,
  grid_spacing_m: f32,
  dt: f32,
  gravity_x: f32,
  gravity_y: f32,
  gravity_z: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  cfl_factor: f32,
  wall_barrier_elastic_stiffness_n_per_m: f32,
  wall_barrier_contact_scale: f32,
  wall_barrier_min_gap_m: f32,
  // Bytes 80..239 belong to the phase-volume transport / surface-stress views
  // of the same shared 256-byte params uniform.
  shared_transport_params: array<vec4<u32>, 10>,
  // A1 direct-dispatch snapshot, bytes 240..255 (see
  // SCHROEDER_SPATIAL_FIELD_CONSUMER_DIRECT_DISPATCH_MAGIC).
  dispatch_snapshot: vec4<u32>,
};

@group(0) @binding(0) var<storage, read_write> field_view: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: GridUpdateParams;

const FIELD_CONSUMER_DIRECT_DISPATCH_MAGIC: u32 = ${SCHROEDER_SPATIAL_FIELD_CONSUMER_DIRECT_DISPATCH_MAGIC}u;

// A direct 1D launch of this field consumer runs only the workgroups the
// staged indirect launch would have run. Workgroup-uniform; inert otherwise.
fn direct_dispatch_excludes(workgroup_id: vec3<u32>) -> bool {
  return params.dispatch_snapshot.w == FIELD_CONSUMER_DIRECT_DISPATCH_MAGIC
    && (workgroup_id.y != 0u || workgroup_id.z != 0u
      || params.dispatch_snapshot.z == 0u
      || workgroup_id.x >= params.dispatch_snapshot.x * params.dispatch_snapshot.y);
}

const FIELD_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC}u;
const FIELD_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION}u;
const FIELD_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED
}u;
const FIELD_KEY_WORDS: u32 = 4u;
const FIELD_STATE_WORDS: u32 = 8u;
const FIELD_WORKGROUP_SIZE: u32 = 64u;
const FIELD_PRESSURE_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS}u;
const FIELD_ACCUMULATOR_WORDS: u32 = 8u;
const FIELD_RECEIPT_WORDS: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS}u;
const FIELD_RECEIPT_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC}u;
const FIELD_RECEIPT_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION}u;
const FIELD_RECEIPT_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_ADMITTED
}u;
const FIELD_RECEIPT_FAIL_CLOSED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_FAIL_CLOSED
}u;
const FIELD_RECEIPT_PHASE_P2G_FINALIZED: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_P2G_FINALIZED}u;
const FIELD_RECEIPT_PHASE_HEAT_CLEARING: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_CLEARING}u;
const FIELD_RECEIPT_PHASE_HEAT_BUILDING: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_HEAT_BUILDING}u;
const FIELD_RECEIPT_PHASE_ENERGY_READY: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_ENERGY_READY}u;
const FIELD_RECEIPT_DEFER_SEAL: u32 = 1u;
const FIELD_PRESSURE_MAGIC: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC}u;
const FIELD_PRESSURE_VERSION: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION}u;
const FIELD_PRESSURE_LAW_EXACT: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_LAW_EXACT_P2G}u;
const FIELD_PRESSURE_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_READY
  | SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_ADMITTED
}u;
const FIELD_PRESSURE_FAIL_CLOSED: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_STATUS_FAIL_CLOSED}u;
const FIELD_PRESSURE_CONSUMER_LOCAL: u32 = ${SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_CONSUMER_LOCAL}u;

fn field_word(index: u32) -> u32 {
  return atomicLoad(&field_view[index]);
}

fn field_store(index: u32, value: u32) {
  atomicStore(&field_view[index], value);
}

fn field_dispatch_shape_admitted() -> bool {
  let field_count = field_word(34u);
  let group_count = field_count / FIELD_WORKGROUP_SIZE
    + select(0u, 1u, field_count % FIELD_WORKGROUP_SIZE != 0u);
  let dispatch_x = field_word(60u);
  let dispatch_y = field_word(61u);
  let dispatch_z = field_word(62u);
  if (field_count == 0u) {
    return dispatch_x == 0u
      && dispatch_y == 0u
      && dispatch_z == 0u
      && field_word(44u) == 0u
      && field_word(45u) == 0u
      && field_word(46u) == 0u;
  }
  if (
    dispatch_x == 0u
    || dispatch_x > group_count
    || dispatch_y == 0u
    || dispatch_z != 1u
  ) {
    return false;
  }
  let expected_y = group_count / dispatch_x
    + select(0u, 1u, group_count % dispatch_x != 0u);
  return dispatch_y == expected_y
    && field_word(44u) == dispatch_x
    && field_word(45u) == dispatch_y
    && field_word(46u) == dispatch_z;
}

fn field_linear_invocation(
  local_id: vec3<u32>,
  workgroup_id: vec3<u32>
) -> u32 {
  let linear_group =
    workgroup_id.x + workgroup_id.y * field_word(60u);
  return linear_group * FIELD_WORKGROUP_SIZE + local_id.x;
}

fn field_receipt_offset() -> u32 {
  return field_word(30u) - FIELD_RECEIPT_WORDS;
}

fn field_pressure_offset() -> u32 {
  return field_word(30u)
    + field_word(32u) * FIELD_STATE_WORDS;
}

fn field_pressure_receipt_seal() -> u32 {
  let receipt = field_receipt_offset();
  return FIELD_PRESSURE_MAGIC
    ^ FIELD_PRESSURE_VERSION
    ^ FIELD_PRESSURE_READY_ADMITTED
    ^ FIELD_PRESSURE_LAW_EXACT
    ^ field_word(receipt + 28u)
    ^ field_word(receipt + 29u)
    ^ field_word(receipt + 30u)
    ^ field_word(receipt + 31u)
    ^ field_word(receipt + 32u)
    ^ field_word(3u)
    ^ field_word(8u)
    ^ field_word(9u)
    ^ field_word(10u)
    ^ field_word(38u);
}

fn field_pressure_receipt_admitted() -> bool {
  let receipt = field_receipt_offset();
  let required = field_word(receipt + 32u);
  let claimed = field_word(receipt + 33u);
  let consumed = field_word(receipt + 34u);
  return field_word(receipt + 24u) == FIELD_PRESSURE_MAGIC
    && field_word(receipt + 25u) == FIELD_PRESSURE_VERSION
    && field_word(receipt + 26u) == FIELD_PRESSURE_READY_ADMITTED
    && field_word(receipt + 27u) == FIELD_PRESSURE_LAW_EXACT
    && field_word(receipt + 30u) == field_word(34u)
    && field_word(receipt + 31u) == params.pad_u1
    && (required & FIELD_PRESSURE_CONSUMER_LOCAL) != 0u
    && (claimed & ~required) == 0u
    && (consumed & ~claimed) == 0u
    && field_word(receipt + 35u) == field_pressure_receipt_seal();
}

fn field_receipt_reject() {
  let receipt = field_receipt_offset();
  field_store(receipt + 2u, FIELD_RECEIPT_FAIL_CLOSED);
  field_store(receipt + 26u, FIELD_PRESSURE_FAIL_CLOSED);
  field_store(2u, ${
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
  }u);
  field_store(44u, 0u);
  field_store(45u, 0u);
  field_store(46u, 0u);
  field_store(60u, 0u);
  field_store(61u, 0u);
  field_store(62u, 0u);
}

fn field_receipt_reject_reason(reason: u32) {
  let receipt = field_receipt_offset();
  loop {
    let claimed = atomicCompareExchangeWeak(
      &field_view[receipt + 4u], 0u, reason
    );
    if (claimed.exchanged || claimed.old_value != 0u) { break; }
  }
  field_receipt_reject();
}

fn field_receipt_admitted(phase: u32) -> bool {
  let receipt = field_receipt_offset();
  return field_word(receipt) == FIELD_RECEIPT_MAGIC
    && field_word(receipt + 1u) == FIELD_RECEIPT_VERSION
    && field_word(receipt + 2u) == FIELD_RECEIPT_READY_ADMITTED
    && field_word(receipt + 3u) == phase
    && field_word(receipt + 5u) == field_word(63u)
    && field_word(receipt + 6u) == field_word(34u);
}

fn field_atomic_add_f32(index: u32, value: f32) -> bool {
  if (value != value || abs(value) > 3.402823466e+38) { return false; }
  loop {
    let old_bits = atomicLoad(&field_view[index]);
    let old_value = bitcast<f32>(old_bits);
    let next_value = old_value + value;
    if (old_value != old_value || next_value != next_value
        || abs(next_value) > 3.402823466e+38) { return false; }
    let exchanged = atomicCompareExchangeWeak(
      &field_view[index], old_bits, bitcast<u32>(next_value)
    );
    if (exchanged.exchanged) { return true; }
  }
}

fn field_heat_add(field_index: u32, heat_j: f32) -> bool {
  if (!(heat_j >= 0.0) || heat_j != heat_j
      || abs(heat_j) > 3.402823466e+38) { return false; }
  if (heat_j == 0.0) { return true; }
  let accumulator = field_word(28u)
    + field_index * FIELD_ACCUMULATOR_WORDS;
  if (!field_atomic_add_f32(accumulator, heat_j)) { return false; }
  atomicAdd(&field_view[accumulator + 1u], 1u);
  return true;
}

fn field_structurally_admitted() -> bool {
  let pressure_offset = field_pressure_offset();
  return arrayLength(&field_view) >= ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u
    && field_word(0u) == FIELD_MAGIC
    && field_word(1u) == FIELD_VERSION
    && field_word(2u) == FIELD_READY_ADMITTED
    && field_word(18u) == params.grid_node_count
    && field_word(19u) == params.grid_nx
    && field_word(20u) == params.grid_ny
    && field_word(21u) == params.grid_nz
    && field_word(22u) == params.shift
    && field_word(23u) == bitcast<u32>(params.grid_spacing_m)
    && field_word(34u) <= field_word(32u)
    && field_word(30u) >= FIELD_RECEIPT_WORDS
    && field_word(30u) == field_word(28u)
      + field_word(32u) * FIELD_ACCUMULATOR_WORDS
      + FIELD_RECEIPT_WORDS
    && pressure_offset >= field_word(30u)
    && pressure_offset <= field_word(42u)
    && field_word(42u)
      == pressure_offset + field_word(32u) * FIELD_PRESSURE_WORDS
    && field_word(41u)
      == pressure_offset + field_word(34u) * FIELD_PRESSURE_WORDS
    && field_word(42u) <= arrayLength(&field_view)
    && field_dispatch_shape_admitted();
}

fn field_operation_admitted(encoding: u32) -> bool {
  return field_structurally_admitted()
    && field_word(63u) == params.pad_u2
    && field_word(59u) == encoding;
}

@compute @workgroup_size(1)
fn begin_heat_receipt() {
  if (!field_structurally_admitted()
      || field_word(63u) != params.pad_u1
      || field_word(59u)
        != ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT}u
      || !field_receipt_admitted(FIELD_RECEIPT_PHASE_P2G_FINALIZED)) {
    if (field_structurally_admitted()) { field_receipt_reject_reason(1u); }
    return;
  }
  let receipt = field_receipt_offset();
  loop {
    let claimed = atomicCompareExchangeWeak(
      &field_view[receipt + 3u],
      FIELD_RECEIPT_PHASE_P2G_FINALIZED,
      FIELD_RECEIPT_PHASE_HEAT_CLEARING
    );
    if (claimed.exchanged) { break; }
    if (claimed.old_value != FIELD_RECEIPT_PHASE_P2G_FINALIZED) {
      field_receipt_reject_reason(2u);
      return;
    }
  }
  // The sidecar summary is built exactly once after the P2G accumulator bank
  // has been cleared. Cross-level metadata is installed by the reflux owner.
  field_store(receipt + 4u, 0u);
  field_store(receipt + 7u, 0u);
  for (var word = 8u; word < 24u; word = word + 1u) {
    field_store(receipt + word, 0u);
  }
}

@compute @workgroup_size(64)
fn clear_heat_rows(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (direct_dispatch_excludes(workgroup_id)) { return; }
  let field_index = field_linear_invocation(local_id, workgroup_id);
  if (!field_structurally_admitted()
      || !field_receipt_admitted(FIELD_RECEIPT_PHASE_HEAT_CLEARING)
      || field_index >= field_word(34u)) { return; }
  let accumulator = field_word(28u)
    + field_index * FIELD_ACCUMULATOR_WORDS;
  for (var word = 0u; word < FIELD_ACCUMULATOR_WORDS; word = word + 1u) {
    field_store(accumulator + word, 0u);
  }
}

@compute @workgroup_size(1)
fn begin_heat_build() {
  if (!field_structurally_admitted()
      || field_word(63u) != params.pad_u1
      || field_word(59u)
        != ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT}u
      || !field_receipt_admitted(FIELD_RECEIPT_PHASE_HEAT_CLEARING)) {
    if (field_structurally_admitted()) { field_receipt_reject_reason(3u); }
    return;
  }
  let receipt = field_receipt_offset();
  loop {
    let claimed = atomicCompareExchangeWeak(
      &field_view[receipt + 3u],
      FIELD_RECEIPT_PHASE_HEAT_CLEARING,
      FIELD_RECEIPT_PHASE_HEAT_BUILDING
    );
    if (claimed.exchanged) { break; }
    if (claimed.old_value != FIELD_RECEIPT_PHASE_HEAT_CLEARING) {
      field_receipt_reject_reason(4u);
      return;
    }
  }
}

@compute @workgroup_size(1)
fn claim_velocity_state() {
  if (!field_structurally_admitted()
      || field_word(59u)
        != ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT}u
      || !field_receipt_admitted(FIELD_RECEIPT_PHASE_HEAT_BUILDING)
      || !field_pressure_receipt_admitted()
      || params.pad_u2 != params.pad_u1 + 1u) {
    return;
  }
  loop {
    let claimed = atomicCompareExchangeWeak(
      &field_view[63u],
      params.pad_u1,
      params.pad_u2
    );
    if (claimed.exchanged) { break; }
    if (claimed.old_value != params.pad_u1) { return; }
  }
  field_store(field_receipt_offset() + 5u, params.pad_u2);
  let pressure_claims = atomicOr(
    &field_view[field_receipt_offset() + 33u],
    FIELD_PRESSURE_CONSUMER_LOCAL
  );
  if ((pressure_claims & FIELD_PRESSURE_CONSUMER_LOCAL) != 0u) {
    field_receipt_reject_reason(5u);
    return;
  }
  field_store(
    59u,
    ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY}u
  );
}

fn field_node_position(field_index: u32) -> vec3<f32> {
  let key = field_word(26u) + field_index * FIELD_KEY_WORDS;
  let node_index = field_word(key);
  let plane = params.grid_ny * params.grid_nz;
  let i = node_index / plane;
  let remainder = node_index - i * plane;
  let j = remainder / params.grid_nz;
  let k = remainder - j * params.grid_nz;
  return vec3<f32>(
    f32(i32(i) - i32(params.shift)),
    f32(i32(j) - i32(params.shift)),
    f32(i32(k) - i32(params.shift))
  ) * params.grid_spacing_m;
}

fn field_wall_response_alpha(node_mass_kg: f32, gap_m: f32) -> f32 {
  let min_gap_m = max(1.0e-12, abs(params.wall_barrier_min_gap_m));
  let effective_gap_m = max(max(gap_m, 0.0), min_gap_m);
  let barrier_stiffness = select(
    0.0,
    node_mass_kg / (effective_gap_m * effective_gap_m),
    node_mass_kg > 0.0
  );
  let normal_stiffness = max(
    0.0,
    barrier_stiffness + max(params.wall_barrier_elastic_stiffness_n_per_m, 0.0)
  );
  let stiffness_ratio = select(
    0.0,
    normal_stiffness * params.dt * params.dt / node_mass_kg,
    node_mass_kg > 0.0 && params.dt > 0.0
  );
  return clamp(
    (stiffness_ratio / (1.0 + stiffness_ratio))
      * clamp(params.wall_barrier_contact_scale, 0.0, 1.0),
    0.0,
    1.0
  );
}

fn field_wall_corrected_normal_velocity(
  value: f32,
  node_mass_kg: f32,
  gap_m: f32
) -> f32 {
  let alpha = field_wall_response_alpha(node_mass_kg, gap_m);
  let inward = max(0.0, -value);
  var corrected = value + inward * alpha;
  if (alpha >= 1.0 - 1.0e-6 && corrected < 1.0e-6 && value < 0.0) {
    corrected = 0.0;
  }
  return corrected;
}

fn field_clamp_velocity_to_speed(
  velocity: vec3<f32>,
  max_speed_m_per_s: f32
) -> vec3<f32> {
  let finite_velocity = all(vec3<bool>(
    (bitcast<u32>(velocity.x) & 0x7fffffffu) < 0x7f800000u,
    (bitcast<u32>(velocity.y) & 0x7fffffffu) < 0x7f800000u,
    (bitcast<u32>(velocity.z) & 0x7fffffffu) < 0x7f800000u
  ));
  let finite_cap =
    (bitcast<u32>(max_speed_m_per_s) & 0x7fffffffu) < 0x7f800000u;
  if (!finite_velocity || !finite_cap || !(max_speed_m_per_s > 0.0)) {
    return vec3<f32>(0.0);
  }
  let guarded_max_speed = max_speed_m_per_s * 0.9999847412109375;
  if (!(guarded_max_speed > 0.0)) {
    return vec3<f32>(0.0);
  }
  let largest_component = max(
    max(abs(velocity.x), abs(velocity.y)),
    abs(velocity.z)
  );
  if (largest_component > 0.0) {
    let largest_bits = bitcast<u32>(largest_component);
    if (largest_bits < 0x00800000u || largest_bits > 0x7e800000u) {
      return vec3<f32>(0.0);
    }
    let scaled_velocity = velocity / largest_component;
    let scaled_length = length(scaled_velocity);
    if (
      !((bitcast<u32>(scaled_length) & 0x7fffffffu) < 0x7f800000u)
      || !(scaled_length > 0.0)
    ) {
      return vec3<f32>(0.0);
    }
    if (largest_component > guarded_max_speed / scaled_length) {
      return scaled_velocity * (guarded_max_speed / scaled_length);
    }
  }
  return velocity;
}

@compute @workgroup_size(64)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (direct_dispatch_excludes(workgroup_id)) { return; }
  let field_index = field_linear_invocation(local_id, workgroup_id);
  if (!field_operation_admitted(
      ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY}u
    ) || field_index >= field_word(34u)) { return; }
  let state = field_word(30u) + field_index * FIELD_STATE_WORDS;
  let mass = bitcast<f32>(field_word(state));
  if (!(mass > 0.0)) {
    field_store(state + 1u, 0u);
    field_store(state + 2u, 0u);
    field_store(state + 3u, 0u);
    field_store(state + 7u, 0u);
    return;
  }
  var velocity = vec3<f32>(
    bitcast<f32>(field_word(state + 1u)),
    bitcast<f32>(field_word(state + 2u)),
    bitcast<f32>(field_word(state + 3u))
  ) / mass + vec3<f32>(params.gravity_x, params.gravity_y, params.gravity_z) * params.dt;
  let vmax = params.cfl_factor * params.grid_spacing_m / max(params.dt, 1.0e-12);
  velocity = field_clamp_velocity_to_speed(velocity, vmax);
  let velocity_before_wall = velocity;
  let node = field_node_position(field_index);
  let epsilon = max(1.0e-7, abs(params.grid_spacing_m) * 1.0e-6);
  if (node.x <= params.grid_spacing_m + epsilon) {
    velocity.x = field_wall_corrected_normal_velocity(
      velocity.x,
      mass,
      max(0.0, node.x - params.grid_spacing_m + epsilon)
    );
  }
  if (node.x >= params.box_x - params.grid_spacing_m - epsilon) {
    velocity.x = -field_wall_corrected_normal_velocity(
      -velocity.x,
      mass,
      max(0.0, params.box_x - params.grid_spacing_m - node.x + epsilon)
    );
  }
  if (node.y < params.grid_spacing_m - epsilon) {
    velocity.y = field_wall_corrected_normal_velocity(
      velocity.y,
      mass,
      max(0.0, node.y)
    );
  }
  if (node.y >= params.box_y - params.grid_spacing_m - epsilon) {
    velocity.y = -field_wall_corrected_normal_velocity(
      -velocity.y,
      mass,
      max(0.0, params.box_y - params.grid_spacing_m - node.y + epsilon)
    );
  }
  if (node.z <= params.grid_spacing_m + epsilon) {
    velocity.z = field_wall_corrected_normal_velocity(
      velocity.z,
      mass,
      max(0.0, node.z - params.grid_spacing_m + epsilon)
    );
  }
  if (node.z >= params.box_z - params.grid_spacing_m - epsilon) {
    velocity.z = -field_wall_corrected_normal_velocity(
      -velocity.z,
      mass,
      max(0.0, params.box_z - params.grid_spacing_m - node.z + epsilon)
    );
  }
  velocity = field_clamp_velocity_to_speed(velocity, vmax);
  let wall_heat_j = max(
    0.0,
    0.5 * mass * (
      dot(velocity_before_wall, velocity_before_wall) - dot(velocity, velocity)
    )
  );
  if (!field_heat_add(field_index, wall_heat_j)) {
    field_receipt_reject_reason(6u);
    return;
  }
  field_store(state + 1u, bitcast<u32>(velocity.x));
  field_store(state + 2u, bitcast<u32>(velocity.y));
  field_store(state + 3u, bitcast<u32>(velocity.z));
}

fn field_velocity(state: u32) -> vec3<f32> {
  return vec3<f32>(
    bitcast<f32>(field_word(state + 1u)),
    bitcast<f32>(field_word(state + 2u)),
    bitcast<f32>(field_word(state + 3u))
  );
}

fn field_set_velocity(state: u32, velocity: vec3<f32>) {
  field_store(state + 1u, bitcast<u32>(velocity.x));
  field_store(state + 2u, bitcast<u32>(velocity.y));
  field_store(state + 3u, bitcast<u32>(velocity.z));
}

const FIELD_CONTACT_PAIR_EXCLUDED: u32 = ${MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.excluded}u;
const FIELD_CONTACT_PAIR_ELIGIBLE: u32 = ${MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.eligible}u;
const FIELD_CONTACT_PAIR_REJECTED: u32 = ${MLS_MPM_MECHANICS_FIELD_CONTACT_POLICY.rejected}u;

fn field_contact_key_valid(key: u32) -> bool {
  let phase_id = field_word(key + 1u);
  let material_id = field_word(key + 2u);
  let continuity_domain_id = field_word(key + 3u);
  let phase_ready = phase_id >= ${GPU_PHASE_IDS.solid}u
    && phase_id <= ${GPU_PHASE_IDS.plasma}u;
  let domain_ready = select(
    continuity_domain_id == 0u,
    continuity_domain_id != 0u,
    phase_id == ${GPU_PHASE_IDS.solid}u
  );
  return phase_ready && material_id != 0u && domain_ready;
}

fn field_contact_pair_policy(left_key: u32, right_key: u32) -> u32 {
  if (
    field_word(left_key) != field_word(right_key)
    || !field_contact_key_valid(left_key)
    || !field_contact_key_valid(right_key)
  ) {
    return FIELD_CONTACT_PAIR_REJECTED;
  }
  let left_phase = field_word(left_key + 1u);
  let right_phase = field_word(right_key + 1u);
  let left_noncondensed = left_phase >= ${GPU_PHASE_IDS.gas}u;
  let right_noncondensed = right_phase >= ${GPU_PHASE_IDS.gas}u;
  if (left_noncondensed && right_noncondensed) {
    return FIELD_CONTACT_PAIR_EXCLUDED;
  }
  if (left_noncondensed != right_noncondensed) {
    // A co-node gas/condensed overlap is not sufficient authority for a hard
    // collision impulse. Noncondensed pressure has its own EOS evolution, and
    // coupling it to a condensed field requires a same-epoch interface
    // receipt. Treating every trace newborn gas lane as a rigid contact field
    // transfers its pressure velocity into the whole condensed population.
    return FIELD_CONTACT_PAIR_EXCLUDED;
  }
  let left_material = field_word(left_key + 2u);
  let right_material = field_word(right_key + 2u);
  if (left_material != right_material) {
    return FIELD_CONTACT_PAIR_ELIGIBLE;
  }
  let solid_liquid_interface = (
    left_phase == ${GPU_PHASE_IDS.solid}u
      && right_phase == ${GPU_PHASE_IDS.liquid}u
  ) || (
    left_phase == ${GPU_PHASE_IDS.liquid}u
      && right_phase == ${GPU_PHASE_IDS.solid}u
  );
  if (solid_liquid_interface) {
    return FIELD_CONTACT_PAIR_ELIGIBLE;
  }
  let distinct_solid_domains = left_phase == ${GPU_PHASE_IDS.solid}u
    && right_phase == ${GPU_PHASE_IDS.solid}u
    && field_word(left_key + 3u) != field_word(right_key + 3u);
  return select(
    FIELD_CONTACT_PAIR_EXCLUDED,
    FIELD_CONTACT_PAIR_ELIGIBLE,
    distinct_solid_domains
  );
}

@compute @workgroup_size(64)
fn contact_fields(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (direct_dispatch_excludes(workgroup_id)) { return; }
  let first = field_linear_invocation(local_id, workgroup_id);
  let field_count = field_word(34u);
  if (!field_operation_admitted(
      ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY}u
    ) || first >= field_count) { return; }
  let key_offset = field_word(26u);
  let first_key = key_offset + first * FIELD_KEY_WORDS;
  let node_index = field_word(first_key);
  if (first > 0u) {
    let previous_key = first_key - FIELD_KEY_WORDS;
    if (field_word(previous_key) == node_index) { return; }
  }
  var end = first + 1u;
  loop {
    if (end >= field_count) { break; }
    let key = key_offset + end * FIELD_KEY_WORDS;
    if (field_word(key) != node_index) { break; }
    end = end + 1u;
  }
  let state_offset = field_word(30u);
  for (var left = first; left < end; left = left + 1u) {
    let left_state = state_offset + left * FIELD_STATE_WORDS;
    let left_mass = bitcast<f32>(field_word(left_state));
    if (!(left_mass > 0.0) || field_word(left_state + 7u) == 0u) { continue; }
    let left_contact_key = key_offset + left * FIELD_KEY_WORDS;
    for (var right = left + 1u; right < end; right = right + 1u) {
      let right_state = state_offset + right * FIELD_STATE_WORDS;
      let right_mass = bitcast<f32>(field_word(right_state));
      if (!(right_mass > 0.0) || field_word(right_state + 7u) == 0u) { continue; }
      let right_contact_key = key_offset + right * FIELD_KEY_WORDS;
      let contact_policy = field_contact_pair_policy(
        left_contact_key,
        right_contact_key
      );
      if (contact_policy == FIELD_CONTACT_PAIR_REJECTED) {
        field_receipt_reject_reason(7u);
        return;
      }
      if (contact_policy != FIELD_CONTACT_PAIR_ELIGIBLE) { continue; }
      let left_gradient = vec3<f32>(
        bitcast<f32>(field_word(left_state + 4u)),
        bitcast<f32>(field_word(left_state + 5u)),
        bitcast<f32>(field_word(left_state + 6u))
      ) / left_mass;
      let right_gradient = vec3<f32>(
        bitcast<f32>(field_word(right_state + 4u)),
        bitcast<f32>(field_word(right_state + 5u)),
        bitcast<f32>(field_word(right_state + 6u))
      ) / right_mass;
      let normal_raw = left_gradient - right_gradient;
      let normal_length2 = dot(normal_raw, normal_raw);
      if (normal_length2 <= 1.0e-12) { continue; }
      let normal = normal_raw / sqrt(normal_length2);
      var left_velocity = field_velocity(left_state);
      var right_velocity = field_velocity(right_state);
      let kinetic_before = 0.5 * left_mass * dot(left_velocity, left_velocity)
        + 0.5 * right_mass * dot(right_velocity, right_velocity);
      let closing_velocity = dot(right_velocity - left_velocity, normal);
      if (closing_velocity >= 0.0) { continue; }
      let inv_left = 1.0 / left_mass;
      let inv_right = 1.0 / right_mass;
      let impulse = -closing_velocity / (inv_left + inv_right);
      left_velocity = left_velocity - impulse * inv_left * normal;
      right_velocity = right_velocity + impulse * inv_right * normal;
      // Contact projection can rotate/add components after the main field CFL
      // pass. Re-apply the overflow-safe Euclidean cap before publishing the
      // pair so the motion envelope remains a bound on every stored field.
      let vmax = params.cfl_factor * params.grid_spacing_m
        / max(params.dt, 1.0e-12);
      left_velocity = field_clamp_velocity_to_speed(left_velocity, vmax);
      right_velocity = field_clamp_velocity_to_speed(right_velocity, vmax);
      let kinetic_after = 0.5 * left_mass * dot(left_velocity, left_velocity)
        + 0.5 * right_mass * dot(right_velocity, right_velocity);
      let contact_heat_j = max(0.0, kinetic_before - kinetic_after);
      let pair_mass = left_mass + right_mass;
      let left_heat_j = select(
        0.5 * contact_heat_j,
        contact_heat_j * (left_mass / pair_mass),
        pair_mass > 0.0
      );
      // Deposit the rounded remainder to the last causal participant so the
      // pair's field-local heat sum is exactly the measured kinetic loss.
      let right_heat_j = max(0.0, contact_heat_j - left_heat_j);
      if (!field_heat_add(left, left_heat_j)
          || !field_heat_add(right, right_heat_j)) {
        field_receipt_reject_reason(8u);
        return;
      }
      field_set_velocity(left_state, left_velocity);
      field_set_velocity(right_state, right_velocity);
    }
  }
}

@compute @workgroup_size(64)
fn summarize_heat_rows(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (direct_dispatch_excludes(workgroup_id)) { return; }
  let field_index = field_linear_invocation(local_id, workgroup_id);
  if (!field_operation_admitted(
      ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY}u
    ) || !field_receipt_admitted(FIELD_RECEIPT_PHASE_HEAT_BUILDING)
      || field_index >= field_word(34u)) { return; }
  let accumulator = field_word(28u)
    + field_index * FIELD_ACCUMULATOR_WORDS;
  let heat_j = bitcast<f32>(field_word(accumulator));
  let pressure_internal_compensation_j =
    bitcast<f32>(field_word(accumulator + 3u));
  let ambient_impulse = vec3<f32>(
    bitcast<f32>(field_word(accumulator + 4u)),
    bitcast<f32>(field_word(accumulator + 5u)),
    bitcast<f32>(field_word(accumulator + 6u))
  );
  let ambient_external_work_j =
    bitcast<f32>(field_word(accumulator + 7u));
  let contribution_count = field_word(accumulator + 1u);
  let state = field_word(30u) + field_index * FIELD_STATE_WORDS;
  let mass = bitcast<f32>(field_word(state));
  if (!(heat_j >= 0.0) || heat_j != heat_j
      || abs(heat_j) > 3.402823466e+38
      || pressure_internal_compensation_j
        != pressure_internal_compensation_j
      || abs(pressure_internal_compensation_j) > 3.402823466e+38
      || any(ambient_impulse != ambient_impulse)
      || any(abs(ambient_impulse) > vec3<f32>(3.402823466e+38))
      || ambient_external_work_j != ambient_external_work_j
      || abs(ambient_external_work_j) > 3.402823466e+38
      || !(mass >= 0.0) || mass != mass
      || abs(mass) > 3.402823466e+38) {
    field_receipt_reject_reason(9u);
    return;
  }
  let receipt = field_receipt_offset();
  if (!field_atomic_add_f32(receipt + 8u, heat_j)) {
    field_receipt_reject_reason(10u);
    return;
  }
  if (!field_atomic_add_f32(
      receipt + 16u,
      pressure_internal_compensation_j
    )) {
    field_receipt_reject_reason(11u);
    return;
  }
  if (!field_atomic_add_f32(receipt + 20u, ambient_impulse.x)
      || !field_atomic_add_f32(receipt + 21u, ambient_impulse.y)
      || !field_atomic_add_f32(receipt + 22u, ambient_impulse.z)
      || !field_atomic_add_f32(
        receipt + 23u,
        ambient_external_work_j
      )) {
    field_receipt_reject_reason(12u);
    return;
  }
  if (contribution_count > 0u) {
    atomicAdd(&field_view[receipt + 7u], contribution_count);
  }
  let specific_heat = select(0.0, heat_j / mass, mass > 0.0);
  if (specific_heat >= 0.0 && specific_heat == specific_heat
      && abs(specific_heat) <= 3.402823466e+38) {
    atomicMax(&field_view[receipt + 11u], bitcast<u32>(specific_heat));
  } else {
    field_receipt_reject_reason(13u);
  }
}

@compute @workgroup_size(1)
fn seal_velocity_state() {
  if (!field_operation_admitted(
      ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY}u
    ) || !field_receipt_admitted(FIELD_RECEIPT_PHASE_HEAT_BUILDING)
      || !field_pressure_receipt_admitted()) {
    if (field_structurally_admitted()) { field_receipt_reject_reason(14u); }
    return;
  }
  let receipt = field_receipt_offset();
  let total_heat_j = bitcast<f32>(field_word(receipt + 8u));
  let total_pressure_internal_compensation_j =
    bitcast<f32>(field_word(receipt + 16u));
  let total_ambient_impulse = vec3<f32>(
    bitcast<f32>(field_word(receipt + 20u)),
    bitcast<f32>(field_word(receipt + 21u)),
    bitcast<f32>(field_word(receipt + 22u))
  );
  let total_ambient_external_work_j =
    bitcast<f32>(field_word(receipt + 23u));
  if (!(total_heat_j >= 0.0) || total_heat_j != total_heat_j
      || abs(total_heat_j) > 3.402823466e+38
      || total_pressure_internal_compensation_j
        != total_pressure_internal_compensation_j
      || abs(total_pressure_internal_compensation_j) > 3.402823466e+38
      || any(total_ambient_impulse != total_ambient_impulse)
      || any(abs(total_ambient_impulse) > vec3<f32>(3.402823466e+38))
      || total_ambient_external_work_j != total_ambient_external_work_j
      || abs(total_ambient_external_work_j) > 3.402823466e+38) {
    field_receipt_reject_reason(15u);
    return;
  }
  let pressure_claimed = field_word(receipt + 33u);
  let pressure_consumed = field_word(receipt + 34u);
  if ((pressure_claimed & FIELD_PRESSURE_CONSUMER_LOCAL) == 0u
      || (pressure_consumed & FIELD_PRESSURE_CONSUMER_LOCAL) != 0u) {
    field_receipt_reject_reason(16u);
    return;
  }
  field_store(receipt + 9u, bitcast<u32>(total_heat_j));
  field_store(
    receipt + 17u,
    bitcast<u32>(total_pressure_internal_compensation_j)
  );
  field_store(
    59u,
    ${SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT}u
  );
  // Publish local pressure consumption only after transport, contact, and all
  // energy/ambient summaries have validated successfully.
  field_store(
    receipt + 34u,
    pressure_consumed | FIELD_PRESSURE_CONSUMER_LOCAL
  );
  if ((params.receipt_mode_flags & FIELD_RECEIPT_DEFER_SEAL) == 0u) {
    field_store(receipt + 3u, FIELD_RECEIPT_PHASE_ENERGY_READY);
  }
}
`;

function createActiveSourceV2MechanicsFieldG2pWgsl(
  sourceWgsl,
  variantId = 'active-source-v2-mechanics-field'
) {
  const rejectedStatusMask =
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_FAIL_CLOSED
    | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_INVALID_SOURCE
    | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_CAPACITY_OVERFLOW
    | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_UNSUPPORTED_SOURCE
    | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_IDENTITY_MISMATCH
    | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_NONFINITE;
  return recordWgslVariantManifest(composeWgslVariantFromSource({
    moduleId: 'mls-mpm-g2p',
    variantId,
    baseSource: sourceWgsl,
    slots: [
      {
        slot: 'active-source-v2-g2p-params',
        match: `  schroeder_spatial_pad0: u32,
};`,
        code: `  schroeder_spatial_pad0: u32,
  active_source_physical_capacity: u32,
  active_source_active_capacity: u32,
  active_source_view_capacity_words: u32,
  active_source_active_to_physical_offset_words: u32,
  active_source_physical_to_active_offset_words: u32,
  active_source_fingerprint: u32,
  active_source_dispatch_x_limit: u32,
  active_source_completion_ordinal: u32,
};`
      },
      {
        slot: 'active-source-v2-g2p-authority-bindings',
        match: `@group(0) @binding(7) var<storage, read> schroeder_spatial_authority_evidence: array<u32>;
@group(0) @binding(8) var<storage, read> schroeder_spatial_directory: array<u32>;`,
        code: `@group(0) @binding(7) var<storage, read> schroeder_spatial_authority_evidence: array<u32>;
@group(0) @binding(8) var<storage, read> active_source_view: array<u32>;`
      },
      {
        slot: 'active-source-v2-g2p-authority',
        kind: 'range',
        start: 'const G2P_SCHROEDER_SPATIAL_MAGIC: u32',
        end: '\nfn g2p_particle_enabled',
        code: `const G2P_ACTIVE_SOURCE_MAGIC: u32 = ${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC}u;
const G2P_ACTIVE_SOURCE_VERSION: u32 = ${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION}u;
const G2P_ACTIVE_SOURCE_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS}u;
const G2P_ACTIVE_SOURCE_READY_ADMITTED: u32 = ${
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_READY
    | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_ADMITTED
}u;
const G2P_ACTIVE_SOURCE_REJECTED_MASK: u32 = ${rejectedStatusMask}u;
const G2P_ACTIVE_SOURCE_MISSING: u32 = ${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL}u;
const G2P_ACTIVE_DISPATCH: u32 = ${
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS
}u;
const G2P_CANDIDATE_DISPATCH: u32 = ${
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS
}u;
const G2P_PHYSICAL_DISPATCH: u32 = ${
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS
}u;

fn g2p_active_source_fold(value: u32, word: u32) -> u32 {
  return (value ^ word) * 0x01000193u;
}

fn g2p_active_source_projection_seal() -> u32 {
  var value = g2p_active_source_fold(
    active_source_view[31u],
    active_source_view[25u]
  );
  value = g2p_active_source_fold(value, active_source_view[26u]);
  value = g2p_active_source_fold(value, active_source_view[27u]);
  value = g2p_active_source_fold(value, active_source_view[18u]);
  value = g2p_active_source_fold(value, active_source_view[20u]);
  return g2p_active_source_fold(value, active_source_view[30u]);
}

fn g2p_active_source_dispatch_admitted(
  invocation_count: u32,
  offset: u32
) -> bool {
  let groups = invocation_count / 64u
    + select(0u, 1u, invocation_count % 64u != 0u);
  let x = active_source_view[offset];
  let y = active_source_view[offset + 1u];
  let z = active_source_view[offset + 2u];
  if (invocation_count == 0u) {
    return x == 0u && y == 1u && z == 1u;
  }
  let expected_x = min(groups, params.active_source_dispatch_x_limit);
  let expected_y = groups / expected_x
    + select(0u, 1u, groups % expected_x != 0u);
  return x == expected_x && y == expected_y && z == 1u;
}

fn g2p_spatial_directory_admitted() -> bool {
  let bound_words = arrayLength(&active_source_view);
  if (bound_words < G2P_ACTIVE_SOURCE_HEADER_WORDS) {
    return false;
  }
  let physical_count = active_source_view[16u];
  let physical_capacity = active_source_view[17u];
  let active_count = active_source_view[18u];
  let active_capacity = active_source_view[19u];
  let active_to_physical = active_source_view[25u];
  let physical_to_active = active_source_view[26u];
  let capacity_words = active_source_view[27u];
  let candidates = active_source_view[43u];
  return params.schroeder_spatial_directory_enabled != 0u
    && params.active_source_dispatch_x_limit > 0u
    && active_source_view[0u] == G2P_ACTIVE_SOURCE_MAGIC
    && active_source_view[1u] == G2P_ACTIVE_SOURCE_VERSION
    && (active_source_view[2u] & G2P_ACTIVE_SOURCE_READY_ADMITTED)
      == G2P_ACTIVE_SOURCE_READY_ADMITTED
    && (active_source_view[2u] & G2P_ACTIVE_SOURCE_REJECTED_MASK) == 0u
    && active_source_view[3u] == params.schroeder_spatial_generation_id
    && params.schroeder_spatial_generation_id > 0u
    && active_source_view[4u] == params.schroeder_spatial_device_ordinal
    && active_source_view[5u] == params.schroeder_spatial_lane_ordinal
    && active_source_view[6u] == params.schroeder_spatial_lease_token
    && active_source_view[7u] == params.schroeder_spatial_source_family_id
    && active_source_view[8u] == params.schroeder_spatial_storage_generation
    && active_source_view[9u] == params.schroeder_spatial_physics_tick
    && active_source_view[10u] == params.schroeder_spatial_physics_substep
    && active_source_view[11u] == params.schroeder_spatial_position_epoch
    && active_source_view[12u] == params.schroeder_spatial_topology_epoch
    && active_source_view[13u] == params.schroeder_spatial_chart_epoch
    && active_source_view[14u] == params.schroeder_spatial_level_epoch
    && active_source_view[15u] == params.schroeder_spatial_support_epoch
    && physical_count == params.particle_count
    && physical_count <= physical_capacity
    && physical_capacity == params.active_source_physical_capacity
    && active_count <= physical_count
    && active_count <= active_capacity
    && active_capacity == params.active_source_active_capacity
    && active_source_view[20u] == physical_count - active_count
    && active_source_view[21u] == 0u
    && active_source_view[22u] == 0u
    && active_source_view[23u]
      == ${SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0}u
    && active_source_view[24u]
      == ${SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SOURCE_STRIDE_FLOATS}u
    && active_to_physical
      == params.active_source_active_to_physical_offset_words
    && active_to_physical == G2P_ACTIVE_SOURCE_HEADER_WORDS
    && physical_to_active
      == params.active_source_physical_to_active_offset_words
    && physical_to_active == active_to_physical + active_capacity
    && capacity_words == params.active_source_view_capacity_words
    && capacity_words == physical_to_active + physical_capacity
    && capacity_words <= bound_words
    && active_source_view[29u]
      == params.active_source_completion_ordinal
    && active_source_view[30u]
      == params.active_source_completion_ordinal
    && active_source_view[31u] == params.active_source_fingerprint
    && active_source_view[32u] == physical_count
    && active_source_view[33u] == active_count
    && active_source_view[34u] == active_count
    && active_source_view[35u] == active_count
    && active_source_view[37u] == 64u
    && active_source_view[38u] == params.active_source_dispatch_x_limit
    && active_source_view[40u] == G2P_ACTIVE_DISPATCH
    && active_source_view[41u] == G2P_CANDIDATE_DISPATCH
    && active_source_view[42u] == G2P_PHYSICAL_DISPATCH
    && active_count <= 0xffffffffu / 27u
    && candidates == active_count * 27u
    && active_source_view[44u] == active_capacity * 27u
    && active_source_view[47u] == g2p_active_source_projection_seal()
    && g2p_active_source_dispatch_admitted(
      active_count,
      G2P_ACTIVE_DISPATCH
    )
    && g2p_active_source_dispatch_admitted(
      candidates,
      G2P_CANDIDATE_DISPATCH
    )
    && g2p_active_source_dispatch_admitted(
      physical_count,
      G2P_PHYSICAL_DISPATCH
    );
}

fn g2p_canonical_query_geometry_admitted() -> bool {
  return g2p_spatial_directory_admitted();
}

fn g2p_spatial_evidence_add(word: u32, value: u32) {}

fn g2p_spatial_reject(word: u32) {
  if (arrayLength(&mechanics_field_view)
      >= ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u) {
    atomicOr(
      &mechanics_field_view[2u],
      ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
        | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE}u
    );
    atomicStore(&mechanics_field_view[34u], 0u);
    atomicStore(
      &mechanics_field_view[
        ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS}u
      ],
      0u
    );
    atomicStore(
      &mechanics_field_view[
        ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS + 1}u
      ],
      0u
    );
    atomicStore(
      &mechanics_field_view[
        ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS + 2}u
      ],
      0u
    );
  }
}

fn g2p_p2g_authority_rejected() -> bool {
  if (arrayLength(&mechanics_field_view)
      < ${SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS}u) {
    return true;
  }
  let status = atomicLoad(&mechanics_field_view[2u]);
  return (status & ${
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_FAIL_CLOSED
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_INVALID_SOURCE
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_CAPACITY_OVERFLOW
}u) != 0u;
}

fn g2p_spatial_authority_rejected() -> bool {
  return g2p_p2g_authority_rejected();
}

fn g2p_spatial_evidence_identity(particle_index: u32) {}

fn g2p_authenticate_spatial_header(particle_index: u32) {
  if (particle_index == 0u && !g2p_spatial_directory_admitted()) {
    g2p_spatial_reject(16u);
  }
}
`
      },
      {
        slot: 'active-source-v2-physical-g2p-admission',
        kind: 'range',
        start: 'fn g2p_particle_enabled(particle_index: u32) -> bool {',
        end: '\nfn g2p_copy_input_particle',
        code: `fn g2p_particle_enabled(particle_index: u32) -> bool {
  g2p_authenticate_spatial_header(particle_index);
  if (g2p_spatial_authority_rejected()
      || particle_index >= params.particle_count) {
    return false;
  }
  let active_ordinal = active_source_view[
    active_source_view[26u] + particle_index
  ];
  if (active_ordinal == G2P_ACTIVE_SOURCE_MISSING) {
    return false;
  }
  if (active_ordinal >= active_source_view[18u]
      || active_source_view[active_source_view[25u] + active_ordinal]
        != particle_index) {
    g2p_spatial_reject(17u);
    return false;
  }
  let descriptor_base = g2p_field_load(24u)
    + particle_index * G2P_FIELD_DESCRIPTOR_WORDS;
  return descriptor_base + 3u < arrayLength(&mechanics_field_view)
    && g2p_field_load(descriptor_base + 3u) == 1u;
}
`
      }
    ]
  }));
}

export const mlsMpmP2gGridProjectionActiveGridWgsl =
  createActiveGridP2gProjectionWgsl(mlsMpmP2gGridProjectionWgsl, 'active-grid');
export const mlsMpmP2gGridProjectionCanonicalSpatialActiveGridWgsl =
  createActiveGridP2gProjectionWgsl(
    mlsMpmP2gGridProjectionCanonicalSpatialWgsl,
    'canonical-spatial-active-grid'
  );
export const mlsMpmP2gGridProjectionCanonicalSpatialUnobservedActiveGridWgsl =
  createActiveGridP2gProjectionWgsl(
    mlsMpmP2gGridProjectionCanonicalSpatialUnobservedWgsl,
    'canonical-spatial-unobserved-active-grid'
  );
export const mlsMpmP2gGridProjectionCanonicalSpatialCompactMechanicsWgsl =
  createCompactMechanicsP2gProjectionWgsl(
    mlsMpmP2gGridProjectionCanonicalSpatialWgsl,
    'canonical-spatial-compact-mechanics'
  );
export const mlsMpmP2gGridProjectionCanonicalSpatialUnobservedCompactMechanicsWgsl =
  createCompactMechanicsP2gProjectionWgsl(
    mlsMpmP2gGridProjectionCanonicalSpatialUnobservedWgsl,
    'canonical-spatial-unobserved-compact-mechanics'
  );
export const mlsMpmP2gGridProjectionCanonicalSpatialMechanicsFieldWgsl =
  createMechanicsFieldP2gProjectionWgsl(
    mlsMpmP2gGridProjectionCanonicalSpatialCompactMechanicsWgsl,
    'canonical-spatial-mechanics-field'
  );
export const mlsMpmP2gGridProjectionCanonicalSpatialUnobservedMechanicsFieldWgsl =
  createMechanicsFieldP2gProjectionWgsl(
    mlsMpmP2gGridProjectionCanonicalSpatialUnobservedCompactMechanicsWgsl,
    'canonical-spatial-unobserved-mechanics-field'
  );
export const mlsMpmP2gGridProjectionCanonicalSpatialSingleLevelMechanicsFieldWgsl =
  createSingleLevelMechanicsFieldP2gProjectionWgsl(
    mlsMpmP2gGridProjectionCanonicalSpatialMechanicsFieldWgsl,
    'canonical-spatial-single-level-mechanics-field'
  );
export const mlsMpmP2gGridProjectionCanonicalSpatialUnobservedSingleLevelMechanicsFieldWgsl =
  createSingleLevelMechanicsFieldP2gProjectionWgsl(
    mlsMpmP2gGridProjectionCanonicalSpatialUnobservedMechanicsFieldWgsl,
    'canonical-spatial-unobserved-single-level-mechanics-field'
  );
export const mlsMpmP2gGridProjectionCanonicalSpatialActiveSourceV2SingleLevelMechanicsFieldWgsl =
  createActiveSourceV2MechanicsFieldP2gWgsl(
    mlsMpmP2gGridProjectionCanonicalSpatialSingleLevelMechanicsFieldWgsl,
    'canonical-spatial-active-source-v2-single-level-mechanics-field'
  );
export const mlsMpmP2gGridProjectionCanonicalSpatialUnobservedActiveSourceV2SingleLevelMechanicsFieldWgsl =
  createActiveSourceV2MechanicsFieldP2gWgsl(
    mlsMpmP2gGridProjectionCanonicalSpatialUnobservedSingleLevelMechanicsFieldWgsl,
    'canonical-spatial-unobserved-active-source-v2-single-level-mechanics-field'
  );
export const mlsMpmG2pReconstructCanonicalSpatialMechanicsFieldWgsl =
  createMechanicsFieldG2pWgsl(
    mlsMpmG2pReconstructCanonicalSpatialWgsl,
    'canonical-spatial-mechanics-field'
  );
export const mlsMpmG2pReconstructCanonicalSpatialUnobservedMechanicsFieldWgsl =
  createMechanicsFieldG2pWgsl(
    mlsMpmG2pReconstructCanonicalSpatialUnobservedWgsl,
    'canonical-spatial-unobserved-mechanics-field'
  );
export const mlsMpmG2pReconstructCanonicalSpatialActiveSourceV2MechanicsFieldWgsl =
  createActiveSourceV2MechanicsFieldG2pWgsl(
    mlsMpmG2pReconstructCanonicalSpatialMechanicsFieldWgsl,
    'canonical-spatial-active-source-v2-mechanics-field'
  );
export const mlsMpmG2pReconstructCanonicalSpatialUnobservedActiveSourceV2MechanicsFieldWgsl =
  createActiveSourceV2MechanicsFieldG2pWgsl(
    mlsMpmG2pReconstructCanonicalSpatialUnobservedMechanicsFieldWgsl,
    'canonical-spatial-unobserved-active-source-v2-mechanics-field'
  );
export const mlsMpmG2pReconstructCanonicalSpatialSingleLevelMechanicsFieldWgsl =
  createSingleLevelMechanicsFieldG2pWgsl(
    mlsMpmG2pReconstructCanonicalSpatialMechanicsFieldWgsl,
    'canonical-spatial-single-level-mechanics-field'
  );
export const mlsMpmG2pReconstructCanonicalSpatialUnobservedSingleLevelMechanicsFieldWgsl =
  createSingleLevelMechanicsFieldG2pWgsl(
    mlsMpmG2pReconstructCanonicalSpatialUnobservedMechanicsFieldWgsl,
    'canonical-spatial-unobserved-single-level-mechanics-field'
  );
export const mlsMpmG2pReconstructCanonicalSpatialActiveSourceV2SingleLevelMechanicsFieldWgsl =
  createActiveSourceV2MechanicsFieldG2pWgsl(
    mlsMpmG2pReconstructCanonicalSpatialSingleLevelMechanicsFieldWgsl,
    'canonical-spatial-active-source-v2-single-level-mechanics-field'
  );
export const mlsMpmG2pReconstructCanonicalSpatialUnobservedActiveSourceV2SingleLevelMechanicsFieldWgsl =
  createActiveSourceV2MechanicsFieldG2pWgsl(
    mlsMpmG2pReconstructCanonicalSpatialUnobservedSingleLevelMechanicsFieldWgsl,
    'canonical-spatial-unobserved-active-source-v2-single-level-mechanics-field'
  );
// Spatial (grid-measured) density term for the liquid EOS. DISABLED: with
// particle lattices coarser than the grid, the estimator aliases above rest
// density inside perfectly packed blocks and the Tait ^7 stiffness turns the
// overshoot into an explosion at spawn (verified: both blocks blasted apart
// by t=0.14). The plumbing stays for a stabilized estimator to re-enable.
export const MLS_MPM_GRID_DENSITY_PRESSURE_ENABLED = false;
export const mlsMpmGridUpdateActiveGridWgsl = createActiveGridUpdateWgsl();
export const mlsMpmGridUpdateCompactMechanicsWgsl = createCompactMechanicsGridUpdateWgsl();

